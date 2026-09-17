// Esportazione delle dichiarazioni degli impianti: un foglio con il riepilogo
// mese per mese, uno con il dettaglio dei materiali e uno con la quadratura.
import { MESI, materialiDi, statoDichiarazione, CANALI } from '@/lib/dichiarazioniImpianti';

const nomeCanale = (f) => {
  const c = CANALI.find(x => x.chiave === f.canale);
  return `${c ? c.nome : f.canale}${f.provenienza ? ` ${f.provenienza}` : ''}`;
};
const STATO_PAROLE = { nessuna: '', inserita: 'inserita', ricevuta: 'in mano', caricata: 'caricata a portale' };

export async function esportaDichiarazioni(dati) {
  if (!dati) return;
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  const riepilogo = [['Impianto', 'Canale', 'Operazione', ...MESI, 'Caricato (t)']];
  const dettaglio = [['Impianto', 'Canale', 'Operazione', 'Mese', 'Conferito (kg)', 'Dichiarato (kg)', 'Granulo (kg)', 'Fibre (kg)', 'Metalli (kg)', 'Ciabattato (kg)', 'Cippato (kg)', 'CSS-C (kg)', 'Altro (kg)', 'Stato', 'Ricevuta il', 'Caricata il', 'Note']];
  for (const s of dati.siti) {
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
          STATO_PAROLE[statoDichiarazione(d)], (d && d.ricevuta_il) || '', (d && d.caricata_il) || '', (d && d.note) || '',
        ]);
      }
    }
  }

  const quadratura = [['Impianto', 'Ruolo', 'Giacenza iniziale (t)', 'Conferito rete (t)', 'Conferito ACI (t)', 'Extra raccolta (t)', 'Secondarie in (t)', 'Secondarie out (t)', 'Terziarie out (t)', 'Dichiarato caricato (t)', 'Giacenza calcolata (t)', 'Giacenza a portale (t)', 'Scarto (t)', 'Esito']];
  for (const s of dati.siti) {
    quadratura.push([
      s.sito, s.tipo_destinazione === 'stoc' ? 'stoccaggio' : 'impianto',
      s.giacenza_iniziale_t, s.conferito_t, s.conferito_aci_t, s.conferito_extra_t,
      s.secondarie_in_t, s.secondarie_out_t, s.terziarie_out_t, s.dichiarato_caricato_t,
      s.giacenza_calcolata_t, s.giacenza_portale_t, s.scarto_t,
      s.quadra === true ? 'quadra' : s.quadra === false ? 'da verificare' : 'nessun dato a portale',
    ]);
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
  aggiungi('Quadratura', quadratura, Object.fromEntries([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => [i, t2])));

  XLSX.writeFile(wb, `Dichiarazioni impianti ${dati.anno}.xlsx`);
}
