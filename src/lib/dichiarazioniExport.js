// Esportazione delle dichiarazioni degli impianti: un foglio con il riepilogo
// mese per mese, uno con il dettaglio dei materiali e uno con la quadratura.
import { MESI, materialiDi, statoDichiarazione, caricatoDelMese, CANALI } from '@/lib/dichiarazioniImpianti';
import { INTESTAZIONE_DATE, righeExcelDate } from '@/components/giacenze/DateDaSistemare';
import { documentoDa, nuovaCartella, foglioDaRighe, scaricaCartella } from '@/lib/fogliProfessionali';

const nomeCanale = (f) => {
  const c = CANALI.find(x => x.chiave === f.canale);
  return `${c ? c.nome : f.canale}${f.provenienza ? ` ${f.provenienza}` : ''}`;
};
// Il punto delle migliaia, all'italiana, nelle note scritte (11/10/2026).
const mig = (v) => String(Math.round(Number(v) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const STATO_PAROLE = { nessuna: '', non_dovuta: 'non dovuta', solo_metalli: 'solo metalli ferrosi', inserita: 'inserita', ricevuta: 'in mano', caricata: 'caricata a portale' };

// Gli archivi che il riepilogo delle dichiarazioni legge: i movimenti dei tre
// canali, la fotografia del portale e il report delle dichiarazioni.
const ARCHIVI_DICHIARAZIONI = ['PrimariaRete', 'PrimariaAci', 'Secondaria', 'Terziaria', 'ExtraRaccolta', 'OrdineNonDichiarato', 'DichiarazioneTrattamento'];

/**
 * IL FILE SI VESTE E DICE LA DATA DEI DATI (chiusura dell'audit, 11/10/2026).
 * Usciva da SheetJS, senza fascia ne' piede; ora ogni foglio passa dal corredo
 * comune (fogliProfessionali.js) con le stesse righe di prima, sotto il blocco
 * di testa: l'anno coi suoi due orologi, fino a che giorno arrivano i movimenti, la
 * fotografia del portale e il report delle dichiarazioni, generato il ... da
 * .... I canali restano su righe loro. opzioni.stato: lo stato dei dati gia'
 * letto (le prove).
 */
export async function esportaDichiarazioni(dati, opzioni = {}) {
  if (!dati) return;
  const doc = await documentoDa({
    titolo: `Dichiarazioni impianti ${dati.anno}`,
    // Due orologi, e la testa li dice tutti e due: il conferito e cio' che resta
    // stanno nel mese della fine trasporto, il dichiarato nel mese in cui e'
    // caricato a portale (per un R1 il mese della nave).
    sottotitolo: 'conferito per fine trasporto, dichiarato nel mese del caricamento a portale  ·  un canale per riga, mai sommati',
    periodo: `Anno ${dati.anno}`, perFineTrasporto: false, entita: ARCHIVI_DICHIARAZIONI,
    ...(opzioni.stato !== undefined ? { stato: opzioni.stato } : {}),
  });
  const { wb } = await nuovaCartella();

  // Due righe per flusso, come a video (06/10/2026): quello che in quel mese e'
  // stato dichiarato a portale e quello che in quel mese e' entrato. Il
  // dichiarato e' il solo caricato (caricatoDelMese): quantita_kg nudo, sulle
  // righe seminate, contiene il DA dichiarare, e il foglio diceva il contrario
  // dello schermo.
  // LA CASELLA DALL'ANNO PRIMA, come a video (11/10/2026): in testa alla riga,
  // prima di gennaio. Senza, la somma dei mesi non faceva la giacenza finche'
  // l'apertura non era consumata, e il foglio ripeteva il difetto corretto.
  const riepilogo = [['Impianto', 'Canale', 'Operazione', 'Voce', "Dall'anno prima", ...MESI, 'Totale (t)']];
  const dettaglio = [['Impianto', 'Canale', 'Operazione', 'Mese', 'Conferito (kg)', 'Uscito (kg)', 'Resta in giacenza (kg)', 'Dichiarato (kg)', 'Granulo (kg)', 'Fibre (kg)', 'Metalli (kg)', 'Ciabattato (kg)', 'Cippato (kg)', 'CSS-C (kg)', 'Altro (kg)', 'Stato', 'Ricevuta il', 'Caricata il', 'Note']];
  for (const s of dati.siti.filter(x => x.tipo_destinazione !== 'stoc')) {
    for (const f of s.flussi) {
      const prima = f.dall_anno_prima || null;
      riepilogo.push([
        s.sito, nomeCanale(f), s.operazione || '', 'Dichiarato a portale', null,
        ...f.mesi.map(m => caricatoDelMese(m) || null),
        f.dichiarato_caricato_t,
      ]);
      // LE QUATTRO VOCI DELLO SCHERMO (09/10/2026). «Dichiarato a portale» e' il
      // caricamento fatto in quel mese - per un R1 il mese della nave - e porta
      // via anche i mesi di prima; «Uscito» e' quanto dei carichi DI QUEL MESE e'
      // andato, con qualunque dichiarazione; «Resta» e' il complemento, e la sua
      // somma e' la giacenza. Senza le due voci nuove il foglio ripeteva il
      // difetto corretto a video: i mesi non tornavano col totale.
      riepilogo.push([
        s.sito, nomeCanale(f), s.operazione || '', 'Uscito nel mese', prima ? prima.uscito_kg || null : null,
        ...f.mesi.map(m => m.uscito_kg || null),
        f.uscito_t,
      ]);
      riepilogo.push([
        s.sito, nomeCanale(f), s.operazione || '', 'Conferito nel mese', prima ? prima.conferito_kg || null : null,
        ...f.mesi.map(m => m.conferito_kg || null),
        f.conferito_t,
      ]);
      riepilogo.push([
        s.sito, nomeCanale(f), s.operazione || '', 'Resta in giacenza',
        // La rete non dovuta per accordo non ha una giacenza (utente, 10/10/2026):
        // il foglio dice quello che dice la pagina, non un numero che la pagina tace.
        f.non_dovuta || !prima ? null : prima.resta_kg || null,
        ...f.mesi.map(m => (f.non_dovuta ? null : m.resta_kg || null)),
        f.non_dovuta ? 'non dovuta per accordo' : f.resta_t,
      ]);
      if (prima && (prima.conferito_kg || prima.uscito_kg)) {
        dettaglio.push([
          s.sito, nomeCanale(f), s.operazione || '', "Dall'anno prima", prima.conferito_kg || null,
          prima.uscito_kg || null, f.non_dovuta ? null : (prima.resta_kg || null),
          null, null, null, null, null, null, null, null, '', '', '',
          prima.dichiarato_dopo_kg ? `letti al ${String(prima.al || '').split('-').reverse().join('/')} ${mig(prima.letta_kg)} kg, meno ${mig(prima.dichiarato_dopo_kg)} kg dichiarati dopo` : '',
        ]);
      }
      for (const m of f.mesi) {
        const d = m.dichiarazione;
        if (!d && !m.conferito_kg) continue;
        dettaglio.push([
          s.sito, nomeCanale(f), s.operazione || '', m.mese, m.conferito_kg || null,
          // La rete non dovuta per accordo non «resta»: come nel Riepilogo (10/10/2026).
          m.uscito_kg || null, f.non_dovuta ? null : (m.resta_kg || null),
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
  // Un anno chiuso si confronta con la lettura del 31/12 salvata dalla chiusura,
  // non col portale di oggi (11/10/2026): la colonna lo dice.
  const quadratura = [['Impianto', 'Ruolo', 'Canale', 'Giacenza iniziale (t)', 'Entrato (t)', 'Uscito in secondaria (t)', 'Dichiarato caricato (t)', 'Giacenza calcolata (t)', dati.anno_chiuso ? 'A portale, lettura del 31/12 (t)' : 'A portale, fotografia (t)', 'Non ancora nel file (t)', 'Dichiarato dopo la fotografia (t)', 'Giacenza a portale aggiornata (t)', 'Scarto (t)', 'Esito',
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
      s.quadra === true ? 'quadra' : s.quadra === false ? 'da verificare'
        : s.quadratura_anno_chiuso && !s.quadratura_anno_chiuso.lettura ? "anno chiuso: vale per l'anno in corso" : 'nessun dato a portale',
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
  // UN PIAZZALE SENZA LETTURA NON HA UNA GIACENZA, E IL FOGLIO DICE PERCHE'
  // (revisione della chiusura dell'audit, 11/10/2026). Dal riepilogo arriva null
  // con il perche' accanto (in_piazzale_perche); qui la cella restava vuota e
  // basta, e una cella vuota si legge «niente» o «non lo so». L'ultima colonna lo
  // scrive, come la pagina.
  const stoccaggi = [['Stoccaggio', 'Anche impianto', 'Canale', 'Entrati (t)', 'Ripartiti in secondaria (t)', 'Saldo dell\'anno (t)', 'Verso impianto', 'Partiti verso l\'impianto (t)', 'In attesa di dichiarazione a portale (t)', 'In piazzale, questo canale (t)', 'Perché manca la giacenza in piazzale']];
  for (const s of dati.stoccaggi || []) {
    for (const c of s.canali) {
      const verso = c.verso.length ? c.verso : [null];
      verso.forEach((v, i) => stoccaggi.push([
        s.sito, s.anche_impianto ? 'sì' : '', nomeCanale({ canale: c.canale }),
        i === 0 ? c.entrato_t : null, i === 0 ? c.uscito_t : null, i === 0 ? c.saldo_t : null,
        v ? v.impianto : '', v ? v.t : null, v && v.in_attesa_t !== null ? v.in_attesa_t : null,
        i === 0 ? c.in_piazzale_t : null,
        i === 0 && (c.in_piazzale_t === null || c.in_piazzale_t === undefined) ? (c.in_piazzale_perche || '') : '',
      ]));
    }
  }

  // Ogni foglio: la prima riga e' l'intestazione, i formati sono quelli detti
  // colonna per colonna (le altre colonne restano come sono: un conteggio non
  // si legge come un peso).
  const aggiungi = (nome, righe, formati) => {
    foglioDaRighe(wb, nome, {
      doc, righe,
      formati: (c) => (formati && formati[c]) || null,
      larghezze: righe[0].map(h => Math.min(28, Math.max(11, String(h).length + 2))),
    });
  };
  // Tonnellate con due decimali, tre se i kg non sono tondi (come formattaPesi);
  // chilogrammi interi. Con '#,##0.00' 12,345 t usciva 12,35.
  const t2 = '#,##0.00#';
  // I kg dalla casella dall'anno prima (colonna 4) a dicembre, poi il totale in
  // tonnellate. Gli indici partivano da 3, la colonna della voce: dicembre usciva
  // in tonnellate e il totale senza formato (11/10/2026).
  aggiungi('Riepilogo', riepilogo, { ...Object.fromEntries(Array.from({ length: MESI.length + 1 }, (_, i) => [i + 4, '#,##0'])), [MESI.length + 5]: t2 });
  aggiungi('Dettaglio', dettaglio, Object.fromEntries([4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => [i, '#,##0'])));
  aggiungi('Quadratura', quadratura, { ...Object.fromEntries([3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => [i, t2])), ...Object.fromEntries([14, 15, 16, 17, 18, 19, 20, 21].map(i => [i, '#,##0'])) });
  aggiungi('Stoccaggi', stoccaggi, Object.fromEntries([3, 4, 5, 7, 8, 9].map(i => [i, t2])));
  if (date.length > 1) aggiungi('Date da sistemare', date, { 6: '#,##0' });
  if (senzaGiorno.length > 1) aggiungi('Carichi senza giorno', senzaGiorno, { 4: '#,##0' });

  return scaricaCartella(wb, `Dichiarazioni impianti ${dati.anno}.xlsx`);
}
