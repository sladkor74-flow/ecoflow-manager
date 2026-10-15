// Le sezioni PDF delle schede di Giacenze (06/10/2026).
//
// Una funzione per scheda: costruisce gli argomenti di esportaSezioniPdf con i
// dati che la scheda ha a video in quel momento. I numeri sono GREZZI - la
// formattazione la fa il `tipo` della colonna - e le tonnellate si passano in
// tonnellate, con tipo 't', mai in euro: un valore di riepilogo senza `tipo`
// verrebbe scritto in euro (esportaTabella.js).
//
// Rete, ACI ed extra raccolta restano colonne separate e non si sommano mai.

const ruolo = (r) => (r.tipo_destinazione === 'imp' ? 'Impianto' : 'Stoccaggio');
const comune = (anno, titolo) => ({
  nomeFile: `giacenze-${titolo.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${anno}`,
  intestazione: 'SMOCO S.r.l.  ·  COMMESSA ECOTYRE',
  titolo: `Giacenze · ${titolo}`,
  sottotitolo: `Anno ${anno}`,
  // Le note di queste schede spiegano come si leggono i numeri: non sono
  // «anomalie da guardare prima di pagare», che e' il titolo che arriva dalla
  // fatturazione (09/10/2026).
  titoloNote: 'Come si leggono questi numeri',
});

const MESI_BREVI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
/** 'AAAA-MM' -> 'Gen 2026'; senza mese il carico non si colloca, e si dice. */
const nomeMese = (m) => {
  if (!m) return 'senza fine trasporto';
  const i = Number(String(m).slice(5, 7)) - 1;
  return `${MESI_BREVI[i] || m} ${String(m).slice(0, 4)}`;
};
const giornoItaliano = (v) => (v ? String(v).slice(0, 10).split('-').reverse().join('/') : '');

// --- I perche' dei numeri che non ci sono, per i file (giro del 14/10/2026) ---
//
// Le decisioni dell'utente del 13/10/2026: un anno prima del gestionale non ha
// giacenze, un anno chiuso senza la lettura del 31/12 non ha il numero a portale,
// e una riga senza numero non vale zero nel totale. calcolaGiacenze lo dice con
// null e il perche' (totali.prima_del_gestionale e perche_prima_del_gestionale,
// totali.perche_totali per canale, perche_senza_giacenza e perche_canali sulle
// righe). La pagina lo scrive sopra la tabella; il PDF e il foglio Excel
// scrivevano celle vuote senza dire niente, e il foglio 0 nel TOTALE di ACI ed
// extra raccolta. Qui le note che lo dicono, le stesse per i due file.
// L'anno in corso coi numeri tutti presenti non ha note: i file restano quelli.

/** Le righe senza numero di un canale: le stesse che calcolaGiacenze lascia fuori dal totale. */
const CANALI_GIACENZA = [
  { chiave: 'RETE', nome: 'rete', campo: 'giacenza_portale_t', perche: (r) => r.perche_senza_giacenza },
  { chiave: 'ACI', nome: 'ACI', campo: 'giacenza_aci_t', perche: (r) => (r.perche_canali && r.perche_canali.ACI) || (r.tipo_destinazione === 'stoc' ? r.perche_senza_giacenza : null) },
  { chiave: 'EXTRA_RACCOLTA', nome: 'extra raccolta', campo: 'giacenza_extra_t', perche: (r) => r.perche_canali && r.perche_canali.EXTRA_RACCOLTA },
];
const manca = (v) => v === null || v === undefined;

/** Il perche' di una riga senza la giacenza di rete, o null se il numero c'e' o il perche' no. */
export const percheRigaSenzaRete = (r) => (manca(r.giacenza_portale_t) && r.perche_senza_giacenza ? r.perche_senza_giacenza : null);

/**
 * Le note che dicono perche' un numero della Situazione e' «—», e che cosa e'
 * l'attesa per noi chiusa. Nell'ordine: l'anno prima del gestionale (una volta
 * per tutto l'anno), i totali che non si fanno, canale per canale, le righe senza
 * numero raggruppate per perche', l'attesa per noi chiusa riga per riga.
 */
export function notePercheGiacenze(righe = [], totali = {}) {
  const note = [];
  const percheAnno = totali.prima_del_gestionale ? (totali.perche_prima_del_gestionale || '') : '';
  if (percheAnno) note.push(`Totali delle giacenze: —. ${percheAnno}`);
  for (const c of CANALI_GIACENZA) {
    const perche = !percheAnno && manca(totali[c.campo]) && totali.perche_totali && totali.perche_totali[c.chiave];
    if (perche) note.push(`Totale ${c.nome}: —. ${perche}`);
  }
  // Le righe: un perche' per gruppo, coi siti e i canali che non hanno il numero.
  const gruppi = new Map();
  for (const r of righe) {
    for (const c of CANALI_GIACENZA) {
      const perche = manca(r[c.campo]) ? c.perche(r) : null;
      if (!perche) continue;
      if (!gruppi.has(perche)) gruppi.set(perche, new Map());
      const chi = `${r.sito} (${r.tipo_destinazione === 'stoc' ? 'piazzale' : 'impianto'})`;
      const g = gruppi.get(perche);
      if (!g.has(chi)) g.set(chi, []);
      g.get(chi).push(c.nome);
    }
  }
  // Un perche' gia' scritto in una nota sopra (l'anno, o il totale che lo ha in
  // comune con le sue righe) non si ripete: si dice solo dove vale.
  for (const [perche, siti] of gruppi) {
    const elenco = [...siti].map(([chi, canali]) => `${chi}: ${canali.join(', ')}`).join('; ');
    note.push(note.some(n => n.includes(perche)) ? `«—» per lo stesso motivo: ${elenco}.` : `«—» su ${elenco}. ${perche}`);
  }
  // L'attesa che per noi e' un giro chiuso (decisioni dell'utente del 13/10/2026).
  for (const r of righe) {
    if (!(Number(r.in_attesa_chiusa_t) > 0) || !r.in_attesa_chiusa_perche) continue;
    note.push(`In attesa di dichiarazione, ${r.sito} (${r.tipo_destinazione === 'stoc' ? 'piazzale' : 'impianto'}): le tonnellate della colonna «Attesa per noi chiusa» sono ${r.in_attesa_chiusa_perche}. Nessuna dichiarazione le chiudera’ e non c’e’ niente da fare: il numero resta quello del portale, e serve alla quadratura.`);
  }
  return note;
}

/** Scheda Situazione: giacenza a portale, per classe, e che cosa resta da dichiarare. */
export function situazionePdf(anno, righe, totali) {
  // Su un anno che non e' quello in corso l'attesa conta solo i carichi di
  // quell'anno (calcolaGiacenze, revisione finale del 13/10/2026): lo dice
  // l'etichetta, come la pagina e la Quadratura delle Dichiarazioni.
  const attesaDel = (totali && totali.in_attesa_dei_carichi_del) || null;
  // Su un anno passato gli ordini da dichiarare sono i carichi di quell'anno
  // ancora aperti oggi (giro del 14/10/2026): lo dice la colonna, come la
  // pagina. L'anno e' ordini_dei_carichi_del, mai quello dell'attesa: sull'anno
  // dopo l'attesa e' dei carichi di quell'anno, gli ordini sono tutto il file.
  const ordiniDel = (totali && totali.ordini_dei_carichi_del) || null;
  // Un totale senza numero si scrive «—»: esportaTabella lascia vuota una cella
  // numerica null, e nel riepilogo non scriveva niente (14/10/2026).
  const oManca = (v) => (manca(v) ? '—' : v);
  // Una riga senza la giacenza di rete, col suo perche': «—» nella giacenza e
  // nelle classi, invece delle celle vuote. Le altre righe restano com'erano.
  const classeDi = (r, c) => (percheRigaSenzaRete(r) && !r.giacenza_classi_kg ? '—' : (r.giacenza_classi_kg || {})[c]);
  const chiusa = Number(totali && totali.in_attesa_chiusa_t) || 0;
  return {
    ...comune(anno, 'Situazione'),
    // Un anno prima del gestionale si dice in testa; il perche' intero e' la prima nota.
    ...(totali && totali.prima_del_gestionale ? { sottotitolo: `Anno ${anno} · prima del gestionale: la giacenza non si ricostruisce` } : {}),
    riepilogo: [
      { etichetta: 'Giacenza rete a portale', valore: oManca(totali.giacenza_portale_t), tipo: 't' },
      { etichetta: 'Giacenza ACI', valore: oManca(totali.giacenza_aci_t), tipo: 't' },
      { etichetta: attesaDel ? `In attesa di dichiarazione, dei carichi del ${attesaDel}` : 'In attesa di dichiarazione', valore: totali.in_attesa_dichiarazione_t, tipo: 't' },
      // La parte per noi chiusa, accanto all'attesa (decisioni dell'utente del 13/10/2026).
      ...(chiusa > 0 ? [{ etichetta: 'di cui per noi chiuse', valore: chiusa, tipo: 't' }] : []),
      { etichetta: 'Dichiarato nell’anno', valore: totali.dichiarato_t, tipo: 't' },
    ],
    sezioni: [{
      titolo: 'Siti',
      colonne: [
        { titolo: 'Sito', tipo: 'testo', peso: 2 },
        { titolo: 'Ruolo', tipo: 'testo', peso: 0.9 },
        { titolo: 'Giacenza rete', tipo: 't', peso: 1 },
        { titolo: 'P (kg)', tipo: 'intero', peso: 0.8 },
        { titolo: 'M (kg)', tipo: 'intero', peso: 0.8 },
        { titolo: 'G1 (kg)', tipo: 'intero', peso: 0.8 },
        { titolo: 'G2 (kg)', tipo: 'intero', peso: 0.8 },
        { titolo: 'ACI (kg)', tipo: 'intero', peso: 0.8 },
        { titolo: attesaDel ? `In attesa dich., dei carichi del ${attesaDel}` : 'In attesa dich.', tipo: 't', peso: 1 },
        { titolo: 'Attesa per noi chiusa', tipo: 't', peso: 0.9 },
        { titolo: ordiniDel ? `Ordini da dich., dei carichi del ${ordiniDel} ancora da dichiarare oggi` : 'Ordini da dich.', tipo: 'intero', peso: 0.8 },
        { titolo: 'Dichiarato', tipo: 't', peso: 1 },
      ],
      righe: righe.map(r => ({
        celle: [
          r.sito, ruolo(r), percheRigaSenzaRete(r) ? '—' : r.giacenza_portale_t,
          classeDi(r, 'P'), classeDi(r, 'M'), classeDi(r, 'G1'), classeDi(r, 'G2'), classeDi(r, 'ACI'),
          r.in_attesa_dichiarazione_t, Number(r.in_attesa_chiusa_t) > 0 ? r.in_attesa_chiusa_t : null, r.ordini_da_dichiarare, r.dichiarato_t,
        ],
      })),
    }],
    note: [
      ...notePercheGiacenze(righe, totali),
      'La giacenza di un impianto e’ la fotografia del portale; quella di un piazzale e’ l’ancora dell’anno piu’ tutti i movimenti finiti dopo. Rete, ACI ed extra raccolta non si sommano mai.',
    ],
  };
}

// --- L'elenco «Da dichiarare»: il file del portale piu' i carichi arrivati dopo ---
//
// Dal 15/10/2026 l'elenco e' il file degli ordini non dichiarati PIU' i carichi
// che il gestionale conosce e il file non ha ancora, MENO il dichiarato a
// portale dopo il file (getOrdiniDaDichiarare): per ogni impianto il totale e' la
// giacenza della Situazione e le righe il numero del pulsante. Il PDF e il
// foglio Excel della scheda portano le stesse righe, gli stessi totali e la
// colonna che dice se la riga e' nel file o arrivata dopo, col giorno del file;
// le frasi qui sotto le scrivono uguali nei due file. Sono testi per i file che
// escono: il meno si scrive «-», che i caratteri del PDF hanno.

/** I chili all'italiana, interi, col punto delle migliaia. */
const kgItaliani = (v) => String(Math.round(Number(v) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const quanti = (n, uno, molti) => `${kgItaliani(n)} ${n === 1 ? uno : molti}`;

/**
 * Un carico che il file non ha, a parole: «arrivato dopo il file del
 * gg/mm/aaaa» solo se e' arrivato al sito dopo il giorno del file
 * (arrivato_dopo_il_file, getOrdiniDaDichiarare); se no «non ancora nel file del
 * gg/mm/aaaa (terminato il gg/mm/aaaa)». Un ordine terminato il 05/10 e chiuso a
 * portale dopo il file del 09/10 non e' arrivato dopo il file, e la scritta
 * diceva di si' (revisione del 15/10/2026). Stringa vuota per una riga del file.
 */
export const fuoriDalFile = (r, fotoDel) => {
  if (!r || r.nel_file !== false) return '';
  const del = fotoDel ? ` del ${giornoItaliano(fotoDel)}` : '';
  if (r.arrivato_dopo_il_file) return `arrivato dopo il file${del}`;
  const terminato = r.giorno_al_sito || r.fine_trasporto;
  return `non ancora nel file${del}${terminato ? ` (terminato il ${giornoItaliano(terminato)})` : ''}`;
};

/** La colonna «Nel file del portale»: «sì», o «no, » e quello che dice fuoriDalFile. */
export const testoNelFile = (r, fotoDel) => (r && r.nel_file === false ? `no, ${fuoriDalFile(r, fotoDel)}` : 'sì');

/**
 * LE TRE COLONNE SUL FILE DEL PORTALE DI OGNI FOGLIO CON L'ELENCO (15/10/2026):
 * se la riga e' nel file o no, il giorno in cui il carico e' arrivato
 * all'impianto quando non e' la fine trasporto della riga (per un carico passato
 * da uno stoccaggio quello della secondaria, e il mese della riga e' quello), e
 * il dichiarato a portale dopo il file tolto dalla riga. Stanno qui, e non con
 * l'Excel della scheda, perche' anche l'Excel di tutta la pagina Giacenze le
 * scriva uguali: questo file non importa niente, e le prove lo caricano cosi'
 * com'e'.
 */
export const INTESTAZIONI_NEL_FILE = ['Nel file del portale', "Arrivato all'impianto il", 'Dichiarato a portale dopo il file (kg)'];
export const celleNelFile = (r, fotoDel) => [
  testoNelFile(r, fotoDel),
  r && r.giorno_al_sito && r.giorno_al_sito !== r.fine_trasporto ? giornoItaliano(r.giorno_al_sito) : '',
  r && r.dichiarato_dopo_kg > 0 ? r.dichiarato_dopo_kg : '',
];

/**
 * I carichi che il file non ha sono tutti arrivati dopo il giorno del file? Se
 * si', la testa dice «+ 4 arrivati dopo»; se anche uno solo e' terminato prima
 * (o la risposta non lo dice), «+ 5 non ancora nel file», che e' vero sempre.
 */
export const tuttiArrivatiDopo = (parti) => !!(parti && parti.dopo_il_file && parti.dopo_il_file.ordini > 0
  && parti.dopo_il_file.arrivati_dopo === parti.dopo_il_file.ordini);

/** Il formulario nel gestionale di una riga: per un carico arrivato dopo il file, che cos'e' e quando e' terminato; poi le date da sistemare. */
export const testoFormularioRiga = (r) => [
  r && r.nel_file === false && r.carico
    ? `${r.carico.tipo === 'secondaria' ? 'secondaria' : 'primaria'} terminata il ${giornoItaliano(r.fine_trasporto)}${r.carico.da ? `, ${r.carico.tipo === 'secondaria' ? 'dal piazzale di ' : ''}${r.carico.da}` : ''}`
    : '',
  ...((r && r.date_da_sistemare) || []).map(d => `${d.tipo} ${d.id_ordine}: ${d.testo}`),
  r && r.giorno_al_sito && r.fine_trasporto && r.giorno_al_sito !== r.fine_trasporto ? `all’impianto il ${giornoItaliano(r.giorno_al_sito)}` : '',
  r && r.dichiarato_dopo_kg > 0 ? `nel file ${kgItaliani(r.peso_del_file_kg)} kg, ${kgItaliani(r.dichiarato_dopo_kg)} dichiarati a portale dopo il file` : '',
].filter(Boolean).join(' · ');

/**
 * Le frasi che spiegano l'elenco, uguali nel PDF e nell'Excel: che cosa e', le
 * parti del totale, la riga di riconciliazione del sito o degli impianti, lo
 * stoccaggio a parte. Vuoto se la risposta non ha il giorno del file.
 */
export function noteElencoDaDichiarare(dati = {}, filtri = {}) {
  const note = [];
  const foto = dati.foto_del;
  const parti = dati.parti;
  const giorno = foto ? giornoItaliano(foto) : '';
  const errore = dati.carichi_dopo_il_file && dati.carichi_dopo_il_file.errore;
  // Che l'elenco comprenda i carichi arrivati dopo lo dice la risposta
  // (carichi_dopo_il_file.cercati): dal pulsante di uno stoccaggio non si
  // cercano, e l'Excel lo affermava lo stesso perche' non riceveva il ruolo
  // (revisione del 15/10/2026). Senza quel dato vale il ruolo, come prima.
  const cercati = dati.carichi_dopo_il_file ? !!dati.carichi_dopo_il_file.cercati : filtri.ruolo !== 'stoc';
  if (foto && cercati && filtri.ruolo !== 'stoc') {
    note.push(`L’elenco e’ il file degli ordini non dichiarati del portale del ${giorno} piu’ i carichi che il gestionale conosce e il file non ha ancora, di solito arrivati dopo (colonna «Nel file del portale»). Caricando un file nuovo degli ordini non dichiarati quei carichi entrano nel file e l’etichetta sparisce.`);
  }
  if (errore) note.push(`I carichi arrivati dopo il file non si sono potuti leggere (${errore}): qui c’e’ solo il file del portale, e il totale non e’ la giacenza della scheda Situazione.`);
  if (parti && (parti.dopo_il_file.ordini > 0 || parti.dichiarato_dopo.kg > 0 || parti.oltre_kg > 0)) {
    const fuori = tuttiArrivatiDopo(parti)
      ? `${quanti(parti.dopo_il_file.ordini, 'carico arrivato', 'carichi arrivati')} dopo`
      : `${quanti(parti.dopo_il_file.ordini, 'carico', 'carichi')} non ancora nel file`;
    note.push(`Il totale: ${quanti(parti.nel_file.ordini, 'ordine', 'ordini')} nel file del ${giorno} (${kgItaliani(parti.nel_file.kg)} kg) + ${fuori} (${kgItaliani(parti.dopo_il_file.kg)} kg)`
      + `${parti.dichiarato_dopo.kg > 0 ? ` - ${kgItaliani(parti.dichiarato_dopo.kg)} kg dichiarati a portale dopo il file, tolti dai carichi arrivati da piu’ tempo come fa il portale` : ''}`
      + `${parti.oltre_kg > 0 ? ` - ${kgItaliani(parti.oltre_kg)} kg dichiarati oltre i carichi (giacenza sotto zero, da correggere)` : ''}`
      + ` = ${quanti((dati.totale_righe || 0), 'ordine', 'ordini')}, ${kgItaliani(dati.totale_kg)} kg.`);
  }
  if (parti && parti.imp.ordini > 0 && parti.stoc.ordini > 0) {
    note.push(`Come impianto, da dichiarare: ${quanti(parti.imp.ordini, 'ordine', 'ordini')}, ${kgItaliani(parti.imp.kg)} kg. Come stoccaggio, in attesa di dichiarazione: ${quanti(parti.stoc.ordini, 'ordine', 'ordini')}, ${kgItaliani(parti.stoc.kg)} kg, gia’ ripartiti in secondaria: li dichiara chi li ha ricevuti, e non sono giacenza degli impianti.`);
  }
  const r = dati.riconciliazione;
  if (r && !r.errore && !r.senza_fotografia) {
    const nome = r.sito || filtri.sito || '';
    if (r.non_dovuta) note.push(`Per accordo ${nome} non ci dichiara la rete: il portale non tiene per noi una giacenza di rete, e non c’e’ niente da riconciliare.`);
    else if (!r.solo_stoccaggio && r.carichi_del !== null && r.carichi_del !== undefined) {
      note.push(`Ordini dei carichi del ${r.carichi_del}: ${kgItaliani(r.file_ordini)} nel file del portale (${kgItaliani(r.file_kg)} kg) + ${kgItaliani(r.aggiunti_n)} non ancora nel file (${kgItaliani(r.aggiunti_kg)} kg) = ${kgItaliani(r.ordini_pulsante)}, il numero del pulsante della scheda Situazione del ${r.carichi_del}. La giacenza di un anno chiuso e’ la lettura del 31/12, non la somma di questo elenco.`);
    } else if (!r.solo_stoccaggio) {
      note.push(`Riconciliazione con la giacenza${nome ? ` di ${nome} come impianto` : ''}, tutto il sito: file del portale${r.foto_del ? ` del ${giornoItaliano(r.foto_del)}` : ''} ${quanti(r.file_ordini, 'ordine', 'ordini')}, ${kgItaliani(r.file_kg)} kg + ${quanti(r.aggiunti_n, 'carico', 'carichi')} non ancora nel file, ${kgItaliani(r.aggiunti_kg)} kg - dichiarato a portale dopo la fotografia, ${kgItaliani(r.dichiarato_dopo_kg)} kg = giacenza a portale ${kgItaliani(r.giacenza_kg)} kg, lo stesso numero delle Giacenze. Ordini: ${kgItaliani(r.file_ordini)} + ${kgItaliani(r.aggiunti_n)} = ${kgItaliani(r.ordini_pulsante)}, il numero del pulsante della scheda Situazione.`
        + `${r.filtri && r.elenco ? ` Con i filtri scelti l’elenco ne mostra ${quanti(r.elenco.ordini, 'ordine', 'ordini')}, ${kgItaliani(r.elenco.kg)} kg.` : ''}`);
    }
    if (r.stoccaggio && r.stoccaggio.ordini > 0) {
      note.push(`Come stoccaggio, ${nome} ha nel file ${quanti(r.stoccaggio.ordini, 'ordine', 'ordini')}, ${kgItaliani(r.stoccaggio.kg)} kg, passati dal piazzale e gia’ ripartiti in secondaria: per il portale sono in attesa di dichiarazione sullo stoccaggio, li dichiara chi li ha ricevuti, e non sono giacenza dell’impianto.`);
    }
  }
  const rs = dati.riconciliazione_siti;
  if (rs && rs.impianti && rs.impianti.length) {
    const dellAnno = rs.carichi_del !== null && rs.carichi_del !== undefined;
    const voci = rs.impianti.map(x => (x.non_dovuta
      ? `${x.sito}: per accordo non ci dichiara la rete, —`
      : dellAnno
        ? `${x.sito}: ${kgItaliani(x.file_ordini)} + ${kgItaliani(x.aggiunti_n)} = ${kgItaliani(x.ordini_pulsante)} ordini`
        : `${x.sito}: ${kgItaliani(x.file_kg)} + ${kgItaliani(x.aggiunti_kg)} - ${kgItaliani(x.dichiarato_dopo_kg)} = ${kgItaliani(x.giacenza_kg)} kg, ${kgItaliani(x.ordini_pulsante)} ordini`));
    note.push(`Riconciliazione con le giacenze, impianto per impianto (file del portale${rs.foto_del ? ` del ${giornoItaliano(rs.foto_del)}` : ''} + carichi non ancora nel file - dichiarato dopo la fotografia): ${voci.join('; ')}.`
      + (dellAnno ? '' : ` Impianti: ${quanti(rs.ordini_pulsante, 'ordine', 'ordini')}, ${kgItaliani(rs.giacenza_kg)} kg, la somma delle giacenze di rete degli impianti della scheda Situazione.`));
    if ((rs.stoccaggi || []).length) note.push(`In attesa di dichiarazione sugli stoccaggi, gia’ ripartiti e da dichiarare da chi li ha ricevuti, non giacenza degli impianti: ${rs.stoccaggi.map(x => `${x.sito} ${kgItaliani(x.ordini)} ordini, ${kgItaliani(x.kg)} kg`).join('; ')}.`);
  }
  if (filtri.senza_fine_ignoti && filtri.senza_fine_ignoti.n > 0) {
    const n = filtri.senza_fine_ignoti.n;
    note.push(`${quanti(n, 'arrivo', 'arrivi')} di rete senza fine trasporto (${kgItaliani(filtri.senza_fine_ignoti.kg)} kg), che il portale non conosce ancora: non ${n === 1 ? 'entra' : 'entrano'} in questo elenco ne’ nella giacenza finche’ la data non arriva.`);
  }
  return note;
}

/**
 * Scheda Da dichiarare: gli ordini che il portale aspetta ancora, con i filtri
 * che si hanno davanti in quel momento.
 *
 * Le righe sono TUTTE quelle del filtro, non la pagina a video (09/10/2026): il
 * totale sotto una tabella che ne mostra cento era proprio la lettura che ha
 * fatto credere che ottobre non fosse contato. Per lo stesso motivo il PDF si
 * apre con il conto per mese, che fa da riscontro alla giacenza dell'impianto.
 * Dal 15/10/2026 con i carichi arrivati dopo il file: il mese dice quanti sono
 * («di cui ... non ancora nel file»), l'ultima colonna degli ordini dice se la
 * riga e' nel file, e le note la riconciliazione con la giacenza.
 */
export function daDichiararePdf(anno, dati, filtri = {}) {
  const righe = dati.righe || [];
  const perMese = dati.per_mese || [];
  const date = dati.date_da_sistemare || { n: 0, kg: 0 };
  const parti = dati.parti || null;
  const fotoDel = dati.foto_del || null;
  const scelte = [
    filtri.sito ? `Sito: ${filtri.sito}` : 'Tutti i siti',
    filtri.ruolo === 'imp' ? 'solo i carichi da dichiarare come impianto'
      : filtri.ruolo === 'stoc' ? 'solo i carichi passati dal piazzale e gia’ ripartiti' : '',
    filtri.provincia ? `Provincia: ${filtri.provincia}` : '',
    filtri.anno ? `Anno di fine trasporto: ${filtri.anno}` : '',
    filtri.ricerca ? `Ricerca: ${filtri.ricerca}` : '',
    filtri.solo_date ? 'solo quelli col formulario da correggere' : '',
  ].filter(Boolean).join(' · ');
  // Impianto e stoccaggio insieme: due fasce dei mesi, come nella scheda.
  const dueRuoli = !!(parti && parti.imp.ordini > 0 && parti.stoc.ordini > 0);
  const fasciaMesi = (titolo, ruolo = null) => {
    const voci = perMese.map(m => ({ m, v: ruolo ? m[ruolo] || { ordini: 0, kg: 0 } : m })).filter(x => x.v.ordini > 0 || !ruolo);
    const conDopo = ruolo !== 'stoc';
    const tot = voci.reduce((t, { m, v }) => ({ ordini: t.ordini + v.ordini, kg: t.kg + v.kg, dopoN: t.dopoN + (conDopo && m.dopo_il_file ? m.dopo_il_file.ordini : 0), dopoKg: t.dopoKg + (conDopo && m.dopo_il_file ? m.dopo_il_file.kg : 0) }), { ordini: 0, kg: 0, dopoN: 0, dopoKg: 0 });
    // Il totale della fascia unica e' quello dell'elenco (che toglie anche il
    // dichiarato oltre i carichi); con due fasce, quello di ciascuna.
    const totale = ruolo ? tot : { ...tot, ordini: dati.totale_righe || righe.length, kg: dati.totale_kg || 0 };
    return {
      titolo,
      colonne: [
        { titolo: 'Mese di fine trasporto', tipo: 'testo', peso: 2 },
        { titolo: 'Ordini', tipo: 'intero', peso: 1 },
        { titolo: 'Peso da dichiarare', tipo: 'kg', peso: 1.4 },
        ...(conDopo ? [
          { titolo: 'Di cui non ancora nel file: ordini', tipo: 'intero', peso: 1.2 },
          { titolo: 'Di cui non ancora nel file: peso', tipo: 'kg', peso: 1.4 },
        ] : []),
      ],
      // Il totale si scrive solo dove c'e' qualcosa da totalizzare: su un
      // elenco vuoto una riga «Totale 0» sembrerebbe un dato.
      righe: [
        ...voci.map(({ m, v }) => ({ celle: [nomeMese(m.mese), v.ordini, v.kg, ...(conDopo ? [m.dopo_il_file ? m.dopo_il_file.ordini : 0, m.dopo_il_file ? m.dopo_il_file.kg : 0] : [])] })),
        ...(voci.length ? [{ stile: 'totale', celle: ['Totale', totale.ordini, totale.kg, ...(conDopo ? [tot.dopoN, tot.dopoKg] : [])] }] : []),
      ],
    };
  };
  const oltre = parti && parti.oltre_kg > 0 ? parti.oltre_kg : 0;
  return {
    ...comune(anno, 'Da dichiarare'),
    sottotitolo: scelte,
    riepilogo: [
      { etichetta: 'Ordini', valore: dati.totale_righe || righe.length, tipo: 'intero' },
      { etichetta: 'Peso da dichiarare', valore: dati.totale_kg || 0, tipo: 'kg' },
      { etichetta: 'Mesi coinvolti', valore: perMese.filter(m => m.mese).length, tipo: 'intero' },
      { etichetta: 'Col formulario da correggere', valore: date.n || 0, tipo: 'intero' },
      ...(parti && fotoDel ? [
        { etichetta: `Nel file del ${giornoItaliano(fotoDel)}`, valore: parti.nel_file.ordini, tipo: 'intero' },
        { etichetta: tuttiArrivatiDopo(parti) ? 'Arrivati dopo il file' : 'Non ancora nel file', valore: parti.dopo_il_file.ordini, tipo: 'intero' },
      ] : []),
    ],
    sezioni: [
      ...(dueRuoli
        ? [fasciaMesi('Da dichiarare come impianto, di quali mesi', 'imp'), fasciaMesi('In attesa sugli stoccaggi, di quali mesi', 'stoc')]
        : [fasciaMesi('Di quali mesi sono')]),
      {
        titolo: 'Ordini, dal carico arrivato da piu’ tempo',
        colonne: [
          // Le larghezze nascono dai dati veri: un numero d'ordine sta in dieci
          // caratteri, un FIR in tredici, e una colonna piu' stretta del suo
          // contenuto lo manda a capo in mezzo alla parola.
          { titolo: 'Ordine', tipo: 'testo', peso: 1.2 },
          { titolo: 'FIR', tipo: 'testo', peso: 1.4 },
          { titolo: 'Fine trasporto', tipo: 'testo', peso: 0.9 },
          { titolo: 'Attesa (gg)', tipo: 'intero', peso: 0.7 },
          { titolo: 'Punto di raccolta', tipo: 'testo', peso: 2 },
          { titolo: 'Comune', tipo: 'testo', peso: 1.2 },
          { titolo: 'Pr.', tipo: 'testo', peso: 0.35 },
          { titolo: 'Prodotto', tipo: 'testo', peso: 0.7 },
          { titolo: 'Peso da dichiarare', tipo: 'kg', peso: 1 },
          { titolo: 'Destinazione', tipo: 'testo', peso: 1.4 },
          { titolo: 'Trasferito a', tipo: 'testo', peso: 1.2 },
          { titolo: 'Formulario nel gestionale', tipo: 'testo', peso: 2 },
          { titolo: 'Nel file del portale', tipo: 'testo', peso: 1.2 },
        ],
        righe: [
          ...righe.map(r => ({
            celle: [
              r.ordine_primaria || r.ordine_secondaria, r.numero_fir, giornoItaliano(r.fine_trasporto), r.giorni_attesa,
              r.punto_di_raccolta, r.comune, r.provincia, r.prodotto, r.peso_non_dichiarato_kg,
              r.destinazione, r.destinazione_secondaria,
              testoFormularioRiga(r),
              testoNelFile(r, fotoDel),
            ],
          })),
          // Il dichiarato oltre i carichi (una giacenza sotto zero) sta in una
          // riga sua, perche' il totale sia quello della scheda.
          ...(righe.length && oltre ? [{ celle: ['Dichiarato dopo il file, oltre i carichi', null, null, null, null, null, null, null, -oltre, null, null, null, null] }] : []),
          ...(righe.length ? [{ stile: 'totale', celle: ['Totale', null, null, null, null, null, null, null, dati.totale_kg || 0, null, null, null, null] }] : []),
        ],
      },
    ],
    note: noteSchedaDaDichiarare(dati, filtri),
  };
}

/**
 * Tutte le note della scheda Da dichiarare, le stesse nel PDF e nell'Excel
 * (revisione del 15/10/2026): l'Excel chiamava noteElencoDaDichiarare senza i
 * filtri e senza le altre frasi, e i due file non dicevano le stesse cose.
 */
export function noteSchedaDaDichiarare(dati = {}, filtri = {}) {
  const date = dati.date_da_sistemare || { n: 0, kg: 0 };
  return [
    ...noteElencoDaDichiarare(dati, filtri),
    'Il peso e’ quello che il portale aspetta ancora per quell’ordine, non il peso del formulario: un ordine dichiarato a meta’ porta solo la parte che resta. Per un carico che il file non ha ancora e’ il peso del formulario nel gestionale.',
    'Tutto per fine del trasporto, mai per la data di chiusura a portale: il mese e’ quello in cui il carico e’ arrivato al sito, per un carico passato da uno stoccaggio la fine trasporto della secondaria. Un carico senza fine trasporto non si colloca in nessun mese e sta nel gruppo a parte.',
    date.n > 0 ? `${quanti(date.n, 'ordine ha', 'ordini hanno')}, nel gestionale, un formulario terminato senza tutte le date obbligatorie (${kgItaliani(date.kg)} kg): la colonna del formulario dice quali.` : '',
    // Dal pulsante di uno stoccaggio la cui attesa e' per noi tutta chiusa
    // (decisioni dell'utente del 13/10/2026): il PDF lo dice come la scheda.
    filtri.per_noi_chiusi ? `Per noi chiusi: ${filtri.per_noi_chiusi}. Il portale li attribuisce ancora allo stoccaggio, ma nessuna dichiarazione li chiudera’ e non c’e’ niente da fare: il numero resta quello del portale, e serve alla quadratura.` : '',
  ].filter(Boolean);
}

/**
 * Scheda Stoccaggi: la lettura del portale di ogni piazzale accanto alla
 * giacenza di oggi. Sono due cose diverse e si mostrano affiancate: una lettura
 * vecchia non e' la giacenza di adesso (06/10/2026). Rete e ACI non si sommano.
 *
 * `esitoDi(r)` da' il controllo della rilevazione in due pezzi: `breve` sta
 * nella colonna, `lungo` va in coda. Una cella del PDF tiene tre righe e poi
 * taglia: la frase intera finiva mozzata a meta' parola, e un controllo che
 * dice «confrontata con quella del 23/09/2026 piu' i movimenti del periodo: 2»
 * e' peggio che non dirlo (09/10/2026).
 */
export function stoccaggiPdf(anno, righe, esitoDi = () => '') {
  const esito = (r) => {
    const e = esitoDi(r);
    return typeof e === 'string' ? { breve: e, lungo: '' } : (e || { breve: '', lungo: '' });
  };
  const kgDi = (r, campi) => campi.reduce((s, c) => s + (Number(r[c]) || 0), 0);
  const reteDi = (r) => kgDi(r, ['class1_kg', 'class2_kg', 'class3_kg', 'class4_kg']) / 1000;
  const aciDi = (r) => (Number(r.class9_kg) || 0) / 1000;
  // Una riga senza la giacenza di oggi non vale zero nel totale (revisione del
  // 14/10/2026, la regola di totaleDellaColonna): il totale e' «—», e una nota
  // dice quali piazzali non hanno il numero. Il perche' lo dice la Situazione.
  const senzaOggi = (campo) => righe.filter(r => manca(r[campo])).map(r => r.sito);
  const sommaOggi = (campo) => (senzaOggi(campo).length ? '—' : righe.reduce((s, r) => s + (Number(r[campo]) || 0), 0));
  const notaSenzaOggi = [['giacenza_rete_t', 'rete'], ['giacenza_aci_t', 'ACI']]
    .filter(([campo]) => senzaOggi(campo).length)
    .map(([campo, nome]) => {
      const siti = senzaOggi(campo);
      return `Giacenza di oggi, ${nome}: —. Il totale non si fa: ${siti.length === 1 ? `la riga di ${siti[0]} non ha il numero` : `${siti.length} righe non hanno il numero (${siti.join(', ')})`}, e una riga senza numero non vale zero. Il perche’ lo dice la scheda Situazione.`;
    });
  return {
    ...comune(anno, 'Stoccaggi'),
    riepilogo: [
      { etichetta: 'Piazzali', valore: righe.length, tipo: 'intero' },
      { etichetta: 'Letto a portale, rete', valore: righe.reduce((s, r) => s + reteDi(r), 0), tipo: 't' },
      { etichetta: 'Giacenza di oggi, rete', valore: sommaOggi('giacenza_rete_t'), tipo: 't' },
      { etichetta: 'Giacenza di oggi, ACI', valore: sommaOggi('giacenza_aci_t'), tipo: 't' },
    ],
    sezioni: [{
      titolo: 'Piazzali: lettura del portale e giacenza di oggi',
      colonne: [
        { titolo: 'Unita’ locale', tipo: 'testo', peso: 1.6 },
        { titolo: 'Sito', tipo: 'testo', peso: 1.6 },
        { titolo: 'Rilevazione del', tipo: 'testo', peso: 0.9 },
        { titolo: 'P (kg)', tipo: 'intero', peso: 0.8 },
        { titolo: 'M (kg)', tipo: 'intero', peso: 0.8 },
        { titolo: 'G1 (kg)', tipo: 'intero', peso: 0.8 },
        { titolo: 'G2 (kg)', tipo: 'intero', peso: 0.8 },
        { titolo: 'ACI (kg)', tipo: 'intero', peso: 0.8 },
        { titolo: 'Letto rete (t)', tipo: 't', peso: 0.9 },
        { titolo: 'Letto ACI (t)', tipo: 't', peso: 0.9 },
        { titolo: 'Oggi rete (t)', tipo: 't', peso: 0.9 },
        { titolo: 'Oggi ACI (t)', tipo: 't', peso: 0.9 },
        { titolo: 'Controllo della rilevazione', tipo: 'testo', peso: 2.2 },
      ],
      righe: righe.map(r => ({
        celle: [
          [r.descrizione_unita, r.id_unita_stoccaggio ? `#${r.id_unita_stoccaggio}` : '', r.comune ? `${r.comune}${r.provincia ? ` (${r.provincia})` : ''}` : ''].filter(Boolean).join(' · '),
          r.sito, giornoItaliano(r.data_rilevazione),
          r.class1_kg, r.class2_kg, r.class3_kg, r.class4_kg, r.class9_kg,
          reteDi(r), aciDi(r),
          r.giacenza_rete_t, r.giacenza_aci_t,
          esito(r).breve,
        ],
      })),
    }],
    note: [
      ...notaSenzaOggi,
      ...righe.map(r => ({ r, e: esito(r) })).filter(x => x.e.lungo).map(x => `${x.r.sito}: ${x.e.lungo}`),
      'La lettura e’ la fotografia del portale di quel giorno; la giacenza di oggi e’ l’ancora dell’anno piu’ tutti i movimenti finiti dopo. Se la seconda e’ piu’ bassa, nel frattempo il materiale e’ uscito in secondaria.',
      'Rete (classi 1-4) e ACI (classe 9) non si sommano mai: sono due commesse diverse.',
      'Il saldo degli stoccaggi il portale lo mostra nella pagina Unita’ Locali di Stoccaggio, che non si esporta: questi valori si rilevano a mano quando lo si consulta.',
    ],
  };
}

/**
 * Scheda Chiusura anno: il dossier della fotografia del 31 dicembre, com'e' in
 * quel momento. Le letture che l'utente sta scrivendo ci sono gia' dentro,
 * perche' il dossier le rifa' a ogni «Aggiorna il confronto».
 */
export function chiusuraAnnoPdf(dossier, { decisioneDi = () => '', pesoInParole = () => '', nomeCanale = (c) => String(c || '').toLowerCase() } = {}) {
  const CLASSI = ['P', 'M', 'G1', 'G2', 'ACI'];
  const anno = dossier.anno;
  const confronti = [];
  for (const c of dossier.piazzali || []) {
    const attesaDi = (cl) => (c.attesa || []).find(a => a.classe === cl) || {};
    const lettaDi = (cl) => (c.verifica_lettura ? c.verifica_lettura.classi.find(x => x.classe === cl) : null);
    const salvataDi = (cl) => (c.verifica_da_salvare ? c.verifica_da_salvare.classi.find(x => x.classe === cl) : null);
    // Undici celle quante le colonne. Tutto quello che si dice del piazzale sta
    // nella PRIMA cella, che e' la piu' larga: messo nella seconda, che e' la
    // colonna «Classe», «nessuna rilevazione precedente» usciva spezzato in
    // «nessuna / rilevazio / ne prece» (09/10/2026).
    const quando = c.precedente_del ? `dal ${giornoItaliano(c.precedente_del)}` : 'senza rilevazione precedente';
    const dicembre = c.dicembre && c.dicembre.n ? ` · ${c.dicembre.n} voci di dicembre` : '';
    confronti.push({ stile: 'gruppo', celle: [`${c.nome} — ${quando}${dicembre}`, null, null, null, null, null, null, null, null, null, null] });
    for (const a of c.attesa || []) {
      const cl = a.classe;
      const letta = lettaDi(cl), salvata = salvataDi(cl), att = attesaDi(cl);
      confronti.push({
        celle: [
          '', cl, att.canale === 'ACI' ? 'ACI' : 'rete',
          att.precedente_kg, att.ingressi_kg, att.uscite_kg, att.atteso,
          c.lettura ? c.lettura[cl] : null,
          letta && letta.scarto ? letta.scarto : null,
          c.lettura ? c.rettifica.classi[cl] : null,
          salvata && salvata.scarto ? salvata.scarto : null,
        ],
      });
    }
  }
  return {
    nomeFile: `giacenze-chiusura-${anno}`,
    intestazione: 'SMOCO S.r.l.  ·  COMMESSA ECOTYRE',
    titolo: `Giacenze · Chiusura ${anno}`,
    sottotitolo: `Fotografia del ${giornoItaliano(dossier.giorno)}`,
    titoloNote: 'Come si leggono questi numeri',
    riepilogo: [
      { etichetta: 'Piazzali da fotografare', valore: dossier.riepilogo.piazzali, tipo: 'intero' },
      { etichetta: 'Fotografie pronte', valore: dossier.riepilogo.piazzali_pronti, tipo: 'intero' },
      { etichetta: 'Letture mancanti', valore: dossier.riepilogo.letture_mancanti, tipo: 'intero' },
      { etichetta: 'Dicembre da decidere', valore: dossier.riepilogo.voci_da_decidere, tipo: 'intero' },
    ],
    sezioni: [
      {
        titolo: 'Che cosa chiedere al portale',
        colonne: [
          { titolo: 'Sito', tipo: 'testo', peso: 1.6 },
          { titolo: 'Ruolo', tipo: 'testo', peso: 0.6 },
          { titolo: 'Che cosa serve', tipo: 'testo', peso: 2.2 },
          { titolo: 'Dove si legge', tipo: 'testo', peso: 3 },
          { titolo: 'In sospeso di dicembre', tipo: 'testo', peso: 2 },
          { titolo: 'Stato', tipo: 'testo', peso: 0.8 },
        ],
        righe: (dossier.richieste || []).map(q => ({
          celle: [q.nome, q.tipo, q.cosa, q.dove, q.dicembre.n ? pesoInParole(q.dicembre.per_canale) : '', q.stato === 'inserita' ? 'inserita' : 'da chiedere'],
        })),
      },
      {
        titolo: `Le letture del ${giornoItaliano(dossier.giorno)} · piazzali`,
        colonne: [
          { titolo: 'Piazzale', tipo: 'testo', peso: 2.4 },
          { titolo: 'Ultima rilevazione', tipo: 'testo', peso: 1 },
          ...CLASSI.map(c => ({ titolo: `${c} (kg)`, tipo: 'intero', peso: 1 })),
          { titolo: 'Fotografia', tipo: 'testo', peso: 1.6 },
        ],
        righe: (dossier.piazzali || []).map(p => ({
          celle: [
            p.nome, p.precedente_del ? giornoItaliano(p.precedente_del) : 'mai',
            ...CLASSI.map(c => (p.lettura ? p.lettura[c] : null)),
            p.gia_salvata ? `gia’ salvata al ${giornoItaliano(p.giorno)}` : p.pronto ? 'pronta' : `${p.blocchi.length} cosa/e da sistemare`,
          ],
        })),
      },
      {
        titolo: `Le letture del ${giornoItaliano(dossier.giorno)} · impianti`,
        colonne: [
          { titolo: 'Impianto', tipo: 'testo', peso: 2.4 },
          { titolo: 'PFU di rete non dichiarato (kg)', tipo: 'intero', peso: 1.4 },
          { titolo: 'ACI (kg)', tipo: 'intero', peso: 1 },
          { titolo: 'Lettera: PFU', tipo: 'intero', peso: 1 },
          { titolo: 'Lettera: ACI', tipo: 'intero', peso: 1 },
          { titolo: 'Scarto rete', tipo: 'intero', peso: 1 },
          { titolo: 'Scarto ACI', tipo: 'intero', peso: 1 },
        ],
        righe: (dossier.impianti || []).map(i => ({
          celle: [i.nome, i.lettura_kg, i.lettura_aci_kg, i.lettera ? i.lettera.pfu_kg : null, i.lettera ? i.lettera.aci_kg : null, i.scarto_kg, i.scarto_aci_kg],
        })),
      },
      {
        titolo: 'L’elenco di dicembre, voce per voce',
        colonne: [
          { titolo: 'Sito', tipo: 'testo', peso: 1.6 },
          { titolo: 'Movimento', tipo: 'testo', peso: 0.8 },
          { titolo: 'Canale', tipo: 'testo', peso: 0.8 },
          { titolo: 'ID ordine', tipo: 'testo', peso: 1 },
          { titolo: 'Formulario', tipo: 'testo', peso: 1 },
          { titolo: 'Classe', tipo: 'testo', peso: 0.5 },
          { titolo: 'Verso', tipo: 'testo', peso: 0.6 },
          { titolo: 'Peso (kg)', tipo: 'intero', peso: 0.8 },
          { titolo: 'Fine trasporto', tipo: 'testo', peso: 0.8 },
          { titolo: 'Chiuso a portale', tipo: 'testo', peso: 0.8 },
          { titolo: 'Controparte', tipo: 'testo', peso: 1.5 },
          { titolo: 'Decisione', tipo: 'testo', peso: 1.4 },
          { titolo: 'Perche’ e’ in elenco', tipo: 'testo', peso: 2 },
        ],
        // L'elenco e' gia' piatto: le stesse voci del dossier Excel, nello
        // stesso ordine. Un'uscita si scrive col segno meno, come li'.
        righe: [
          ...(dossier.elenco_dicembre && dossier.elenco_dicembre.voci ? dossier.elenco_dicembre.voci : []).map(v => ({
            celle: [
              `${v.nome} (${v.ruolo === 'stoc' ? 'piazzale' : 'impianto'})`, v.tipo, nomeCanale(v.canale), v.id_ordine, v.numero_fir,
              v.classe || 'senza classe', v.verso === 'uscita' ? 'uscita' : 'entrata',
              v.verso === 'uscita' ? -v.kg : v.kg, giornoItaliano(v.finito_il), v.chiuso_il ? giornoItaliano(v.chiuso_il) : 'non ancora',
              v.controparte, decisioneDi(v), v.perche,
            ],
          })),
          ...(dossier.elenco_dicembre && dossier.elenco_dicembre.aperti_prima ? dossier.elenco_dicembre.aperti_prima : []).map(v => ({
            celle: [
              `${v.nome} (${v.ruolo === 'stoc' ? 'piazzale' : 'impianto'})`, v.tipo, nomeCanale(v.canale), v.id_ordine, v.numero_fir,
              v.classe || 'senza classe', v.verso === 'uscita' ? 'uscita' : 'entrata',
              v.verso === 'uscita' ? -v.kg : v.kg, giornoItaliano(v.finito_il), v.chiuso_il ? giornoItaliano(v.chiuso_il) : 'non ancora',
              v.controparte, 'non si rettifica da qui', v.perche,
            ],
          })),
        ],
      },
      {
        titolo: 'Il confronto, piazzale per piazzale',
        colonne: [
          { titolo: 'Piazzale', tipo: 'testo', peso: 2 },
          { titolo: 'Classe', tipo: 'testo', peso: 0.6 },
          { titolo: 'Canale', tipo: 'testo', peso: 0.6 },
          { titolo: 'Prima', tipo: 'intero', peso: 1 },
          { titolo: 'Ingressi', tipo: 'intero', peso: 1 },
          { titolo: 'Uscite', tipo: 'intero', peso: 1 },
          { titolo: 'Attesa', tipo: 'intero', peso: 1 },
          { titolo: 'Letta al 31/12', tipo: 'intero', peso: 1 },
          { titolo: 'Scarto della lettura', tipo: 'intero', peso: 1 },
          { titolo: 'Da salvare', tipo: 'intero', peso: 1 },
          { titolo: 'Scarto dopo la rettifica', tipo: 'intero', peso: 1 },
        ],
        righe: confronti,
      },
    ],
    note: [
      'La fotografia del 31 dicembre e’ il punto da cui ripartono le giacenze dell’anno dopo: si legge a portale, si confronta con quello che i movimenti dicono e si salva.',
      'Il periodo di un movimento e’ sempre la fine del trasporto. La chiusura a portale dice soltanto se la fotografia lo contiene gia’: i movimenti di dicembre non ancora chiusi non ci sono, e vanno decisi uno per uno.',
      ...(dossier.avvisi || []).map(a => a.testo),
    ],
  };
}

/** Scheda Derivati: che cosa e' uscito dal trattamento. */
export function derivatiPdf(anno, righe, totali) {
  return {
    ...comune(anno, 'Derivati'),
    riepilogo: [
      { etichetta: 'Dichiarato', valore: totali.dichiarato_t, tipo: 't' },
      { etichetta: 'Granulo', valore: totali.granulo_t, tipo: 't' },
      { etichetta: 'Fibre', valore: totali.fibre_t, tipo: 't' },
      { etichetta: 'Metallo', valore: totali.metallo_t, tipo: 't' },
    ],
    sezioni: [{
      titolo: 'Derivati per sito',
      colonne: [
        { titolo: 'Sito', tipo: 'testo', peso: 2 },
        { titolo: 'Ruolo', tipo: 'testo', peso: 0.9 },
        { titolo: 'Dichiarato', tipo: 't', peso: 1 },
        { titolo: 'Granulo', tipo: 't', peso: 1 },
        { titolo: 'Fibre', tipo: 't', peso: 1 },
        { titolo: 'Metallo', tipo: 't', peso: 1 },
        { titolo: 'Ciabattato', tipo: 't', peso: 1 },
        { titolo: 'Cippato', tipo: 't', peso: 1 },
      ],
      righe: righe.filter(r => r.dichiarato_t > 0).map(r => ({
        celle: [r.sito, ruolo(r), r.dichiarato_t, r.granulo_t, r.fibre_t, r.metallo_t, r.ciabattato_t, r.cippato_t],
      })),
    }],
  };
}

/** Scheda Target: target, conferito, residuo e copertura. */
export function targetPdf(anno, righe, totali) {
  return {
    ...comune(anno, 'Target'),
    riepilogo: [
      { etichetta: 'Target primarie', valore: totali.target_primarie_t, tipo: 't' },
      { etichetta: 'Target totale', valore: totali.target_totale_t, tipo: 't' },
      { etichetta: 'Primarie RETE', valore: totali.conferito_primarie_t, tipo: 't' },
      { etichetta: 'Conferito RETE', valore: totali.conferito_t, tipo: 't' },
    ],
    sezioni: [{
      titolo: 'Target e conferito per sito',
      colonne: [
        { titolo: 'Sito', tipo: 'testo', peso: 2 },
        { titolo: 'Ruolo', tipo: 'testo', peso: 0.9 },
        { titolo: 'Target primarie', tipo: 't', peso: 1 },
        { titolo: 'Target totale', tipo: 't', peso: 1 },
        { titolo: 'Primarie RETE', tipo: 't', peso: 1 },
        { titolo: 'Secondarie', tipo: 't', peso: 1 },
        { titolo: 'Conferito RETE', tipo: 't', peso: 1 },
        { titolo: 'Residuo', tipo: 't', peso: 1 },
        { titolo: 'Copertura %', tipo: 'percentuale', peso: 0.8 },
        { titolo: 'ACI', tipo: 't', peso: 0.9 },
        { titolo: 'Extra raccolta', tipo: 't', peso: 0.9 },
      ],
      righe: righe.map(r => ({
        celle: [
          r.sito, ruolo(r), r.target_primarie_t, r.target_totale_t, r.conferito_primarie_t,
          r.secondarie_nette_t, r.conferito_t, r.residuo_t, r.percentuale_target,
          r.conferito_aci_t, r.conferito_extra_t,
        ],
      })),
    }],
    note: [
      'Residuo: target totale meno tutto quello che e’ arrivato, primarie e secondarie. Copertura: le sole primarie sul target totale.',
      'Il target delle primarie dei raccoglitori senza impianto scritto e’ ripartito mese per mese sui conferimenti.',
    ],
  };
}

/**
 * La griglia dei target dei raccoglitori di Target & Status: impianto,
 * raccoglitore, regione, i dodici target mensili e i totali. Dove l'impianto non
 * e' scritto si dice come il gestionale sta ripartendo quel target.
 */
export function targetRaccoglitoriPdf(anno, elenco, ripartizione) {
  const MESI_B = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
  const MESI_N = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
  const righe = (elenco || []).map(r => {
    const mesi = MESI_N.map(m => (r.mesi && r.mesi[m] && !r.mesi[m].non_raccoglie ? Number(r.mesi[m].target) || 0 : null));
    const somma = mesi.reduce((s, v) => s + (v || 0), 0);
    const annuo = r.annuo ? Number(r.annuo.target_tonnellate) || 0 : 0;
    const quote = r.impianto ? '' : ((ripartizione && ripartizione(r)) || []).map(q => `${q.impianto} ${q.pct}%`).join(', ');
    return {
      celle: [
        r.impianto || (quote ? `ripartito: ${quote}` : 'senza impianto'),
        r.nome, r.regione || '', annuo, ...mesi, somma, annuo ? Math.round((annuo - somma) * 1000) / 1000 : null,
      ],
    };
  });
  return {
    nomeFile: `target-raccoglitori-${anno}`,
    intestazione: 'SMOCO S.r.l.  ·  COMMESSA ECOTYRE',
    titolo: 'Target & Status · Target raccoglitori',
    sottotitolo: `Anno ${anno}`,
    riepilogo: [
      { etichetta: 'Righe', valore: righe.length, tipo: 'intero' },
      { etichetta: 'Target annuo totale', valore: righe.reduce((s, r) => s + (r.celle[3] || 0), 0), tipo: 't' },
    ],
    sezioni: [{
      titolo: 'Target per raccoglitore, impianto e regione',
      colonne: [
        { titolo: 'Impianto', tipo: 'testo', peso: 1.6 },
        { titolo: 'Raccoglitore', tipo: 'testo', peso: 1.6 },
        { titolo: 'Regione', tipo: 'testo', peso: 1 },
        { titolo: 'Annuo', tipo: 't', peso: 0.9 },
        ...MESI_B.map(m => ({ titolo: m, tipo: 't', peso: 0.7 })),
        { titolo: 'Somma mesi', tipo: 't', peso: 0.9 },
        { titolo: 'Da ripartire', tipo: 't', peso: 0.9 },
      ],
      righe,
    }],
    note: ['Dove l’impianto non e’ scritto, il target si ripartisce da se’ fra i siti dove quel raccoglitore ha portato le primarie dell’anno.'],
  };
}
