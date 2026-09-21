// Esportazione delle dichiarazioni degli impianti: un foglio con il riepilogo
// mese per mese, uno con il dettaglio dei materiali e uno con la quadratura.
import { MESI, materialiDi, statoDichiarazione, CANALI } from '@/lib/dichiarazioniImpianti';

const nomeCanale = (f) => {
  const c = CANALI.find(x => x.chiave === f.canale);
  return `${c ? c.nome : f.canale}${f.provenienza ? ` ${f.provenienza}` : ''}`;
};
const STATO_PAROLE = { nessuna: '', non_dovuta: 'non dovuta', solo_metalli: 'solo metalli ferrosi', inserita: 'inserita', ricevuta: 'in mano', caricata: 'caricata a portale' };

export async function esportaDichiarazioni(dati) {
  if (!dati) return;
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  const riepilogo = [['Impianto', 'Canale', 'Operazione', ...MESI, 'Caricato (t)']];
  const dettaglio = [['Impianto', 'Canale', 'Operazione', 'Mese', 'Conferito (kg)', 'Dichiarato (kg)', 'Granulo (kg)', 'Fibre (kg)', 'Metalli (kg)', 'Ciabattato (kg)', 'Cippato (kg)', 'CSS-C (kg)', 'Altro (kg)', 'Stato', 'Ricevuta il', 'Caricata il', 'Note']];
  for (const s of dati.siti.filter(x => x.tipo_destinazione !== 'stoc')) {
    for (const f of s.flussi) {
      riepilogo.push([
        s.sito, nomeCanale(f), s.operazione || '',
        ...f.mesi.map(m => (m.dichiarazione ? m.dichiarazione.quantita_kg : null)),
        f.dichiarato_caricato_t,
      ]);
      for (const m of f.mesi) {
        const d = m.dichiarazione;
        if (!d && !m.conferito_kg) continue;
        dettaglio.push([
          s.sito, nomeCanale(f), s.operazione || '', m.mese, m.conferito_kg || null,
          d ? d.quantita_kg : null, d ? d.granulo_kg : null, d ? d.fibre_kg : null, d ? d.metalli_kg : null,
          d ? d.ciabattato_kg : null, d ? d.cippato_kg : null, d ? d.cssc_kg : null, d ? d.altro_kg : null,
          STATO_PAROLE[statoDichiarazione(d, { canale: f.canale, dichiara_rete: s.dichiara_rete })], (d && d.ricevuta_il) || '', (d && d.caricata_il) || '', (d && d.note) || '',
        ]);
      }
    }
  }

  // Un canale per volta: la rete degli impianti, e rete e ACI degli stoccaggi su righe diverse.
  const quadratura = [['Impianto', 'Ruolo', 'Canale', 'Giacenza iniziale (t)', 'Entrato (t)', 'Uscito in secondaria (t)', 'Dichiarato caricato (t)', 'Giacenza calcolata (t)', 'A portale, fotografia (t)', 'Non ancora nel file (t)', 'Dichiarato dopo la fotografia (t)', 'Giacenza a portale aggiornata (t)', 'Scarto (t)', 'Esito']];
  for (const s of dati.siti) {
    const stoc = s.tipo_destinazione === 'stoc';
    quadratura.push([
      s.sito, stoc ? 'stoccaggio' : 'impianto', nomeCanale({ canale: s.canale || 'RETE' }),
      s.giacenza_iniziale_t, s.entrato_confronto_t, s.uscito_confronto_t || 0, stoc ? null : s.dichiarato_caricato_rete_t,
      s.giacenza_calcolata_t, stoc ? null : s.giacenza_portale_foto_t, stoc ? null : (s.aggiunti_alla_foto_t || 0), stoc ? null : (s.dichiarato_dopo_foto_t || 0),
      s.giacenza_portale_t, s.scarto_t,
      s.quadra === true ? 'quadra' : s.quadra === false ? 'da verificare' : 'nessun dato a portale',
    ]);
  }

  // Gli stoccaggi non dichiarano: entrate, partenze in secondaria e verso chi.
  const stoccaggi = [['Stoccaggio', 'Anche impianto', 'Canale', 'Entrati (t)', 'Ripartiti in secondaria (t)', 'Saldo dell\'anno (t)', 'Verso impianto', 'Partiti verso l\'impianto (t)', 'In attesa di dichiarazione a portale (t)', 'In piazzale, questo canale (t)']];
  for (const s of dati.stoccaggi || []) {
    for (const c of s.canali) {
      const verso = c.verso.length ? c.verso : [null];
      verso.forEach((v, i) => stoccaggi.push([
        s.sito, s.anche_impianto ? 'sì' : '', nomeCanale({ canale: c.canale }),
        i === 0 ? c.entrato_t : null, i === 0 ? c.uscito_t : null, i === 0 ? c.saldo_t : null,
        v ? v.impianto : '', v ? v.t : null, v && v.in_attesa_t !== null ? v.in_attesa_t : null,
        i === 0 ? c.in_piazzale_t : null,
      ]));
    }
  }

  const aggiungi = (nome, righe, formati) => {
    const ws = XLSX.utils.aoa_to_sheet(righe);
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let C = range.s.c; C <= range.e.c; C++) {
      const formato = formati && formati[C];
      if (!formato) continue;
      for (let R = 1; R <= range.e.r; R++) {
        const cella = ws[XLSX.utils.encode_cell({ r: R, c: C })];
        if (cella && cella.t === 'n') cella.z = formato;
      }
    }
    ws['!cols'] = righe[0].map(h => ({ wch: Math.min(28, Math.max(11, String(h).length + 2)) }));
    XLSX.utils.book_append_sheet(wb, ws, nome);
  };
  // Tonnellate con due decimali, chilogrammi interi.
  const t2 = '#,##0.00';
  aggiungi('Riepilogo', riepilogo, { ...Object.fromEntries(MESI.map((_, i) => [i + 3, '#,##0'])), [MESI.length + 3]: t2 });
  aggiungi('Dettaglio', dettaglio, Object.fromEntries([4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => [i, '#,##0'])));
  aggiungi('Quadratura', quadratura, Object.fromEntries([3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => [i, t2])));
  aggiungi('Stoccaggi', stoccaggi, Object.fromEntries([3, 4, 5, 7, 8, 9].map(i => [i, t2])));

  XLSX.writeFile(wb, `Dichiarazioni impianti ${dati.anno}.xlsx`);
}
