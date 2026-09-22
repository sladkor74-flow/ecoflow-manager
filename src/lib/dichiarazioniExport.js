// Esportazione delle dichiarazioni degli impianti: un foglio con il riepilogo
// mese per mese, uno con il dettaglio dei materiali e uno con la quadratura.
import { MESI, materialiDi, statoDichiarazione, CANALI } from '@/lib/dichiarazioniImpianti';
import { INTESTAZIONE_DATE, righeExcelDate } from '@/components/giacenze/DateDaSistemare';

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
  // Le ultime colonne (22/09/2026): i formulari di quel canale senza fine
  // trasporto, che non si collocano in nessun mese e che la giacenza calcolata non
  // conta finche' la data non arriva; quelli che il portale conosce; i carichi del
  // file senza giorno di arrivo. E che cosa comporta, a parole. Arrivi e
  // partenze (terziarie per un impianto, secondarie per uno stoccaggio) hanno
  // colonne loro: un peso che li somma non vuol dire niente (22/09/2026).
  const quadratura = [['Impianto', 'Ruolo', 'Canale', 'Giacenza iniziale (t)', 'Entrato (t)', 'Uscito in secondaria (t)', 'Dichiarato caricato (t)', 'Giacenza calcolata (t)', 'A portale, fotografia (t)', 'Non ancora nel file (t)', 'Dichiarato dopo la fotografia (t)', 'Giacenza a portale aggiornata (t)', 'Scarto (t)', 'Esito',
    'Arrivati senza fine trasporto', 'Arrivati senza fine trasporto (kg)', 'Partiti senza fine trasporto', 'Partiti senza fine trasporto (kg)',
    'Arrivati: fra i non dichiarati del portale (kg)', 'Arrivati: gia\' dichiarati a portale (kg)', 'Carichi del file senza giorno di arrivo (kg)', 'Formulari con le date da sistemare', 'Che cosa comporta']];
  for (const s of dati.siti) {
    const stoc = s.tipo_destinazione === 'stoc';
    const g = (s.date_da_sistemare || []).find(x => x.canale === (s.canale || 'RETE'));
    const sf = g && g.senza_fine;
    quadratura.push([
      s.sito, stoc ? 'stoccaggio' : 'impianto', nomeCanale({ canale: s.canale || 'RETE' }),
      s.giacenza_iniziale_t, s.entrato_confronto_t, s.uscito_confronto_t || 0, stoc ? null : s.dichiarato_caricato_rete_t,
      s.giacenza_calcolata_t, stoc ? null : s.giacenza_portale_foto_t, stoc ? null : (s.aggiunti_alla_foto_t || 0), stoc ? null : (s.dichiarato_dopo_foto_t || 0),
      s.giacenza_portale_t, s.scarto_t,
      s.quadra === true ? 'quadra' : s.quadra === false ? 'da verificare' : 'nessun dato a portale',
      // Fra i non dichiarati il portale li conta e la calcolata no; gia' dichiarati
      // pesano sulla calcolata solo se la dichiarazione e' registrata anche qui.
      sf ? sf.arrivi_n || 0 : 0, sf ? sf.arrivi_kg || 0 : 0, sf ? sf.partenze_n || 0 : 0, sf ? sf.partenze_kg || 0 : 0,
      sf && !stoc ? sf.nel_file_kg || 0 : null, sf && !stoc ? sf.gia_dichiarati_kg || 0 : null,
      s.foto_senza_giorno ? s.foto_senza_giorno.kg : null,
      g ? g.n : 0, g ? g.avviso || '' : '',
    ]);
  }

  // I formulari terminati con le date da sistemare, uno per riga: gli impianti e
  // gli stoccaggi, un canale per volta, con che cosa manca e che cosa comporta.
  // Gli stoccaggi puri stanno anche fra le righe della quadratura: si prendono una
  // volta sola, dall'elenco degli stoccaggi.
  const gruppiDate = [
    ...dati.siti.filter(x => x.tipo_destinazione !== 'stoc').flatMap(x => x.date_da_sistemare || []),
    ...(dati.stoccaggi || []).flatMap(x => x.date_da_sistemare || []),
  ];
  const date = [INTESTAZIONE_DATE, ...righeExcelDate(gruppiDate)];
  // I carichi del file del portale senza un giorno di arrivo all'impianto.
  const senzaGiorno = [['Impianto', 'Ordine primaria', 'Ordine secondaria', 'FIR', 'Peso (kg)', 'Perche\' non ha un giorno']];
  for (const s of dati.siti) {
    for (const o of (s.foto_senza_giorno && s.foto_senza_giorno.ordini) || []) {
      senzaGiorno.push([s.sito, o.ordine_primaria || '', o.ordine_secondaria || '', o.numero_fir || '', o.kg, o.perche || '']);
    }
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
  // Tonnellate con due decimali, tre se i kg non sono tondi (come formattaPesi);
  // chilogrammi interi. Con '#,##0.00' 12,345 t usciva 12,35.
  const t2 = '#,##0.00#';
  aggiungi('Riepilogo', riepilogo, { ...Object.fromEntries(MESI.map((_, i) => [i + 3, '#,##0'])), [MESI.length + 3]: t2 });
  aggiungi('Dettaglio', dettaglio, Object.fromEntries([4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => [i, '#,##0'])));
  aggiungi('Quadratura', quadratura, { ...Object.fromEntries([3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => [i, t2])), ...Object.fromEntries([14, 15, 16, 17, 18, 19, 20, 21].map(i => [i, '#,##0'])) });
  aggiungi('Stoccaggi', stoccaggi, Object.fromEntries([3, 4, 5, 7, 8, 9].map(i => [i, t2])));
  if (date.length > 1) aggiungi('Date da sistemare', date, { 6: '#,##0' });
  if (senzaGiorno.length > 1) aggiungi('Carichi senza giorno', senzaGiorno, { 4: '#,##0' });

  XLSX.writeFile(wb, `Dichiarazioni impianti ${dati.anno}.xlsx`);
}
