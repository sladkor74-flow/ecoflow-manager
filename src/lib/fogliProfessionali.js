import { AUTORE_FILE } from './prodotto.js';
import { giornoRoma } from './giornoItaliano.js';
import { scarica } from './docxModello.js';
// IL CORREDO DEI FOGLI EXCEL CHE SI MANDANO FUORI.
//
// L'utente, 03/10/2026: «quando dico professionale intendo quello che hai gia'
// fatto quando mi fai pubblicare il report con le settimane nel modulo report,
// quello si' che e' un modo professionale di inviare documenti». Quel report e'
// un PDF con la fascia di intestazione, le intestazioni in negativo, le righe
// alternate e il piede col numero di pagina. I fogli Excel del gestionale invece
// uscivano come griglie di numeri nudi: la libreria con cui erano scritti
// (SheetJS) in questa versione non sa fare ne' grassetti ne' colori.
//
// exceljs, che il gestionale ha gia' per i blocchi di Irigom e per le verifiche,
// sa fare tutto: qui ci sono i pezzi comuni - gli stessi colori del PDF, i
// formati dei numeri, la fascia, le intestazioni, la riga dei totali e
// l'impostazione di stampa - cosi' tutti i fogli che mandiamo all'esterno si
// somigliano e si correggono in un punto solo.
//
// I colori sono quelli di src/lib/reportSettimanaleExport.js, scritti come li
// vuole exceljs (ARGB, con FF davanti per «del tutto opaco»).
//
// IL BLOCCO DI TESTA DEI DOCUMENTI CHE ESCONO (chiusura dell'audit, 11/10/2026).
// Fino a quel giorno la veste la seguivano solo il format dell'amministrazione e
// il report settimanale; gli altri file uscivano da SheetJS senza fascia ne'
// piede, e nessun file diceva fino a che giorno arrivano i dati: un foglio
// mandato il 10 con i dati al 7 non lo rivelava. Ora c'e' una sola
// intestazioneDocumento(), che usano questo corredo per gli Excel ed
// esportaTabella.js per i PDF, cosi' i due formati dicono le stesse cose:
// titolo, canale (uno per file), periodo «per fine trasporto», «dati fino al»
// con il giorno del caricamento, «generato il ... da ...», e il piede con le
// pagine. Il «fino al» lo legge il modulo di esportazione stesso, quando produce
// il file, dalla funzione datiFinoAl del server (leggiStatoDati).

export const COLORI = {
  scuro: 'FF0F4C5C',
  medio: 'FF1A7F8E',
  chiaro: 'FFE2EEF1',
  zebra: 'FFF8FBFC',
  bordo: 'FFD6DEE2',
  testo: 'FF1E293B',
  grigio: 'FF6E7882',
  ambra: 'FFD97706',
  ambraChiara: 'FFFEF3C7',
  bianco: 'FFFFFFFF',
};

// I formati dei numeri seguono le regole del gestionale: tonnellate con due
// decimali, chili interi, euro con due decimali e il simbolo, prezzi unitari con
// quattro perche' un euro al chilo si scrive 0,2020.
export const FORMATI = {
  tonnellate: '#,##0.00',
  // Tre decimali quando i chili non sono tondi: 12,345 t non si deve vedere
  // come 12,35 (regola dei pesi dell'utente).
  tonnellateTre: '#,##0.000',
  tonnellateFini: '#,##0.00#',
  kg: '#,##0',
  euro: '#,##0.00 "€"',
  prezzo: '#,##0.0000 "€"',
  // Un importo senza il simbolo, per le colonne che dicono gia' l'unita' nel
  // titolo («TOTALE [€]», «Prezzo Totale»): il simbolo in ogni cella non serve.
  importo: '#,##0.00',
  // Un prezzo che puo' essere a tonnellata (202,00) o al chilo (0,202): due
  // decimali, fino a quattro se ci sono. Con due fissi 0,202 si leggeva 0,20.
  prezzoLibero: '#,##0.00##',
  intero: '#,##0',
  // Un numero con due decimali che non e' ne' peso ne' denaro: per esempio i
  // viaggi pagati, che su un viaggio misto sono una quota (2,6) e non un intero.
  decimale2: '#,##0.00',
  percentuale: '#,##0.0',
  codice: '0',
  data: 'dd/mm/yyyy',
};

/** Una cartella nuova, col nome del gestionale come autore. */
export async function nuovaCartella() {
  const modulo = await import('exceljs');
  const ExcelJS = modulo.default || modulo;
  const wb = new ExcelJS.Workbook();
  wb.creator = AUTORE_FILE;
  wb.created = new Date();
  return { ExcelJS, wb };
}

const riempi = (cella, colore) => { cella.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colore } }; };

/** Il filo di bordo tenue che divide le righe. */
export function bordi(cella, { sopra, sotto, doppioSopra } = {}) {
  const filo = { style: 'thin', color: { argb: COLORI.bordo } };
  cella.border = {
    ...(sopra ? { top: doppioSopra ? { style: 'double', color: { argb: COLORI.medio } } : filo } : {}),
    ...(sotto ? { bottom: filo } : {}),
  };
}

/**
 * LA FASCIA DEL TITOLO: sfondo scuro, testo bianco, su tutta la larghezza del
 * foglio. E' la prima cosa che si vede aprendo il file e dice di che documento
 * si tratta, come la testata del PDF.
 * @param {object} ws il foglio
 * @param {array} valori i valori della riga (il primo e' il titolo)
 * @param {number} quante quante colonne larga
 */
export function fascia(ws, valori, quante) {
  const riga = ws.addRow(valori);
  for (let c = 1; c <= quante; c++) {
    const cella = riga.getCell(c);
    riempi(cella, COLORI.scuro);
    cella.font = { bold: true, color: { argb: COLORI.bianco }, size: c === 1 ? 13 : 11 };
    cella.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'right' };
  }
  riga.height = 24;
  return riga;
}

/** La riga di sottotitolo sotto la fascia: piccola, grigia, senza sfondo. */
export function sottotitolo(ws, testo, quante) {
  const riga = ws.addRow([testo]);
  riga.getCell(1).font = { italic: true, size: 9, color: { argb: COLORI.grigio } };
  if (quante > 1) ws.mergeCells(riga.number, 1, riga.number, quante);
  return riga;
}

/**
 * L'INTESTAZIONE DI UNA TABELLA: sfondo medio, testo bianco in grassetto, testo
 * a capo (i titoli delle colonne dell'amministrazione sono lunghi: «Prezzo
 * Unitario (Euro/TON)» deve arrivare intero) e bordi.
 * @param {array} numeriche gli indici (da 1) delle colonne allineate a destra
 */
export function intestazione(ws, titoli, numeriche = []) {
  const riga = ws.addRow(titoli);
  riga.eachCell({ includeEmpty: true }, (cella, c) => {
    riempi(cella, COLORI.medio);
    cella.font = { bold: true, color: { argb: COLORI.bianco }, size: 10 };
    cella.alignment = { wrapText: true, vertical: 'middle', horizontal: numeriche.includes(c) ? 'right' : 'left' };
    bordi(cella, { sopra: true, sotto: true });
  });
  riga.height = 28;
  return riga;
}

/** I formati dei numeri di una riga: { 2: FORMATI.tonnellate, 5: FORMATI.euro }. */
export function formatta(riga, mappa) {
  for (const [c, z] of Object.entries(mappa || {})) riga.getCell(Number(c)).numFmt = z;
  return riga;
}

/**
 * Una riga di dettaglio. `rientro` serve alle voci che stanno sotto il loro
 * soggetto: nel foglio dell'amministrazione si leggono come un elenco rientrato.
 */
export function rigaDettaglio(ws, valori, { grassetto, sfondo, rientro, colore, quante } = {}) {
  const riga = ws.addRow(valori);
  const largo = quante || valori.length;
  for (let c = 1; c <= largo; c++) {
    const cella = riga.getCell(c);
    if (sfondo) riempi(cella, sfondo);
    cella.font = { bold: !!grassetto, size: 10, color: { argb: colore || COLORI.testo } };
    bordi(cella, { sotto: true });
  }
  if (rientro) riga.getCell(1).alignment = { indent: 2 };
  return riga;
}

/** La riga dei totali: grassetto, sfondo chiaro, bordo doppio sopra. */
export function rigaTotale(ws, valori, quante) {
  const riga = ws.addRow(valori);
  const largo = quante || valori.length;
  for (let c = 1; c <= largo; c++) {
    const cella = riga.getCell(c);
    riempi(cella, COLORI.chiaro);
    cella.font = { bold: true, size: 10, color: { argb: COLORI.scuro } };
    bordi(cella, { sopra: true, sotto: true, doppioSopra: true });
  }
  return riga;
}

/** Una riga che avverte: sfondo ambra chiaro, testo ambra. Non e' un errore del foglio, e' una cosa da guardare. */
export function rigaAvviso(ws, valori, quante) {
  return rigaDettaglio(ws, valori, { sfondo: COLORI.ambraChiara, colore: COLORI.ambra, quante });
}

/**
 * L'IMPOSTAZIONE DI STAMPA. Questi fogli si stampano e si allegano: senza questo
 * un foglio di 380 righe esce su venti pagine tagliate in larghezza.
 * @param {number} ripeti quante righe in cima ripetere su ogni pagina
 * @param {object} doc l'intestazione del documento (intestazioneDocumento): se
 *   c'e', il piede dice il titolo e il giorno in cui il file e' stato generato,
 *   non il giorno in cui lo si stampa (11/10/2026)
 */
export function perLaStampa(ws, { ripeti = 0, orizzontale = true, doc = null } = {}) {
  ws.pageSetup = {
    orientation: orizzontale ? 'landscape' : 'portrait',
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };
  if (ripeti > 0) ws.pageSetup.printTitlesRow = `1:${ripeti}`;
  ws.headerFooter = { oddFooter: doc ? piedeDelFoglio(doc) : '&L&9SMOCO S.r.l. — commessa Ecotyre&C&9&D&R&9Pagina &P di &N' };
  return ws;
}

/** La prima riga (o le prime) ferma mentre si scorre. */
export function bloccaRighe(ws, quante) {
  if (quante > 0) ws.views = [{ state: 'frozen', ySplit: quante }];
  return ws;
}

/** Il file, pronto da scaricare. */
export const bytesDi = (wb) => wb.xlsx.writeBuffer();

const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Scarica la cartella col suo nome; restituisce il nome, per chi lo registra nello storico. */
export async function scaricaCartella(wb, nomeFile) {
  scarica(new Blob([await bytesDi(wb)], { type: TIPO_XLSX }), nomeFile);
  return nomeFile;
}

// === IL BLOCCO DI TESTA (11/10/2026) ===

/** Chi manda il documento: la prima riga piccola dei PDF, la seconda dei fogli. */
export const ENTE = 'SMOCO S.r.l.  ·  COMMESSA ECOTYRE';

const NOMI_CANALE = { RETE: 'Rete', ACI: 'ACI', EXTRA_RACCOLTA: 'Extra raccolta' };
const ORA_ROMA = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' });

/** 'AAAA-MM-GG' (o un istante) scritto gg/mm/aaaa, sul giorno italiano. */
export function testoGiorno(v) {
  const g = /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : giornoRoma(v);
  return g ? g.split('-').reverse().join('/') : '';
}

// Che cosa si scrive per un archivio senza il suo giorno: un valore che manca
// non e' una data, e si dice perche' manca.
function giornoDellArchivio(a) {
  if (a.dati_fino_al) return testoGiorno(a.dati_fino_al);
  if (a.nessuna_riga_nostra) return 'nessuna riga del partner SMOCO';
  if (a.lettura_non_riuscita) return 'lettura non riuscita';
  if (a.vuoto) return 'archivio vuoto';
  return 'non disponibile';
}

/**
 * Il testo «dati fino al» di un documento, dallo stato letto dal server
 * (leggiStatoDati). Se tutti gli archivi letti arrivano allo stesso giorno e
 * sono stati caricati lo stesso giorno, una riga corta; altrimenti archivio per
 * archivio, perche' una data sola per primarie e secondarie direbbe di una
 * delle due una cosa falsa.
 */
export function testoDatiFinoAl(stato) {
  if (!stato || stato.letto === false) {
    return 'Dati fino al: non disponibile, la lettura non è riuscita al momento dell\'esportazione';
  }
  const archivi = stato.archivi || [];
  if (!archivi.length) return '';
  const giorni = new Set(archivi.map(a => a.dati_fino_al || ''));
  const caricati = new Set(archivi.map(a => a.caricato_il || ''));
  const [giorno] = [...giorni];
  const [caricato] = [...caricati];
  if (giorni.size === 1 && giorno && caricati.size === 1) {
    return `Dati fino al ${testoGiorno(giorno)}${caricato ? `  ·  caricati il ${testoGiorno(caricato)}` : ''}`;
  }
  return `Dati fino al: ${archivi.map(a => `${a.archivio} ${giornoDellArchivio(a)}${a.caricato_il ? ` (caricamento del ${testoGiorno(a.caricato_il)})` : ''}`).join('  ·  ')}`;
}

/**
 * L'INTESTAZIONE DI UN DOCUMENTO, uguale per Excel e PDF. Non legge niente: lo
 * stato dei dati glielo passa chi l'ha letto (documentoDa).
 * - titolo, sottotitolo: che cosa e'
 * - canale: 'RETE' | 'ACI' | 'EXTRA_RACCOLTA' (o un testo gia' scritto)
 * - periodo: 'Settembre 2026'; perFineTrasporto (vero se non si dice) aggiunge
 *   «per fine trasporto», che e' la regola del periodo di ogni movimento
 * - stato: { archivi, caricamenti_aperti, utente } dal server, o { letto: false }
 * - generatoIl: l'istante (di solito adesso)
 * Restituisce le righe gia' scritte, con le date gg/mm/aaaa del giorno italiano.
 */
export function intestazioneDocumento({ titolo = '', sottotitolo = '', canale = '', periodo = '', perFineTrasporto = true, stato = null, generatoIl = new Date(), ente = ENTE } = {}) {
  const nomeCanale = canale ? (NOMI_CANALE[canale] || String(canale)) : '';
  const periodoTesto = periodo ? `${periodo}${perFineTrasporto ? ', per fine trasporto' : ''}` : '';
  const quando = generatoIl instanceof Date ? generatoIl : new Date(generatoIl);
  const utente = stato && stato.utente ? String(stato.utente).trim() : '';
  const generato = `Generato il ${testoGiorno(quando)} alle ${ORA_ROMA.format(quando)}${utente ? ` da ${utente}` : ''}`;
  // Il «fino al» si scrive solo se il documento ha detto quali archivi legge:
  // senza, una data qualunque direbbe una cosa che il file non sa.
  const dati = stato && (stato.letto === false || (stato.archivi && stato.archivi.length)) ? testoDatiFinoAl(stato) : '';
  const avvisi = ((stato && stato.caricamenti_aperti) || []).map(a => `${a.titolo || 'Caricamento non concluso'}: i numeri di questo documento possono essere a metà.`);
  const contesto = [nomeCanale && `Canale: ${nomeCanale}`, periodoTesto && `Periodo: ${periodoTesto}`].filter(Boolean).join('  ·  ');
  return {
    ente, titolo, sottotitolo,
    canale: nomeCanale,
    periodo: periodoTesto,
    periodoBreve: periodo || '',
    dati,
    avvisi,
    generato,
    generatoGiorno: testoGiorno(quando),
    // Le righe del dettaglio, archivio per archivio, per il foglio «Note».
    archivi: ((stato && stato.archivi) || []).map(a => ({
      archivio: a.archivio,
      testo: `${giornoDellArchivio(a)}${a.cosa ? ` (${a.cosa})` : ''}${a.caricato_il ? `, caricamento del ${testoGiorno(a.caricato_il)}` : ''}${a.avviso ? `. ${a.avviso}` : ''}`,
    })),
    // Le righe sotto la fascia, nell'ordine in cui si leggono.
    righe: [contesto, dati, generato].filter(Boolean),
  };
}

/**
 * Chi sta esportando, se si riesce a saperlo: il nome e' di chi genera il file.
 * Una lettura che non riesce lascia il nome vuoto, non ferma il file.
 */
export async function leggiUtente() {
  try {
    const { chiediUtente } = await import('@/lib/statoDeiDati');
    return await chiediUtente();
  } catch (_e) {
    return '';
  }
}

/**
 * Lo stato dei dati degli archivi che il documento legge, chiesto al server nel
 * momento in cui si produce il file (funzione datiFinoAl). Non lancia mai: un
 * file che non riesce a dire fino a quando arrivano i dati esce lo stesso, e lo
 * dice. L'attesa ha un tetto, perche' l'esportazione non resti appesa. Le due
 * domande al server stanno in statoDeiDati.js, caricato solo qui: il corredo dei
 * fogli resta senza client (le prove lo caricano in node, dove la lettura non
 * riesce e il file lo dice).
 */
export async function leggiStatoDati(entita, { attesaMs = 8000 } = {}) {
  let timer = null;
  try {
    const { chiediStatoDati } = await import('@/lib/statoDeiDati');
    const dati = await Promise.race([
      chiediStatoDati(entita),
      new Promise((_, no) => { timer = setTimeout(() => no(new Error('nessuna risposta')), attesaMs); }),
    ]);
    if (!Array.isArray(dati.archivi)) throw new Error('risposta senza archivi');
    return { ...dati, letto: true };
  } catch (_e) {
    return { letto: false, utente: await leggiUtente() };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * L'intestazione di un documento con lo stato dei dati gia' letto: opzioni come
 * intestazioneDocumento, piu' entita (gli archivi che il documento legge). Lo
 * stato si puo' passare gia' fatto (opzioni.stato), e allora non si legge niente.
 */
export async function documentoDa(opzioni = {}) {
  const { entita, stato } = opzioni;
  const letto = stato !== undefined ? stato
    : (entita && entita.length ? await leggiStatoDati(entita) : { utente: await leggiUtente() });
  return intestazioneDocumento({ ...opzioni, stato: letto });
}

// Nel piede di un foglio la & e' un comando: si raddoppia per scriverla.
const perPiede = (t) => String(t || '').replace(/&/g, '&&');

/** Il piede del foglio stampato: chi, che cosa, quando e la pagina. */
function piedeDelFoglio(doc) {
  const titolo = perPiede(doc.titolo).slice(0, 70);
  return `&L&9SMOCO S.r.l. — ${titolo}&C&9${perPiede(`Generato il ${doc.generatoGiorno}`)}&R&9Pagina &P di &N`;
}

/**
 * IL BLOCCO DI TESTA IN UN FOGLIO: la fascia col titolo (e a destra canale e
 * periodo), poi chi manda il documento, canale e periodo per fine trasporto, i
 * dati fino al, chi l'ha generato e quando, gli avvisi sui caricamenti, e una
 * riga vuota. Restituisce quante righe occupa.
 */
export function testaDocumento(ws, doc, quante) {
  const largo = Math.max(1, quante || 1);
  const destra = [doc.canale, doc.periodoBreve].filter(Boolean).join('  ·  ');
  fascia(ws, largo > 1 ? [doc.titolo, ...new Array(largo - 2).fill(''), destra] : [doc.titolo], largo);
  sottotitolo(ws, [doc.ente, doc.sottotitolo].filter(Boolean).join('  ·  '), largo);
  for (const r of doc.righe) sottotitolo(ws, r, largo);
  for (const a of doc.avvisi || []) {
    const riga = sottotitolo(ws, a, largo);
    riga.getCell(1).font = { bold: true, size: 9, color: { argb: COLORI.ambra } };
  }
  ws.addRow([]);
  return ws.rowCount;
}

// Le colonne si riconoscono dal titolo, come in formatoExcel.js: le tonnellate
// con due decimali e il terzo se i chili non sono tondi, i chili interi.
const TONNELLATE = /\(t\)|\(ton\)|tonnellat|\bton\b|_t$|\[t\]/;
const CHILOGRAMMI = /\(kg\)|\bkg\b|peso_effettivo|peso_stimato|peso effettivo|peso stimato/;
const PERCENTUALI = /\(%\)/;

/** Il formato di una colonna dal suo titolo; undefined se il titolo non lo dice. */
export function formatoDaTitolo(titolo) {
  const h = String(titolo || '').toLowerCase().trim();
  if (!h) return undefined;
  if (h === 't' || TONNELLATE.test(h)) return FORMATI.tonnellateFini;
  if (CHILOGRAMMI.test(h)) return FORMATI.kg;
  if (PERCENTUALI.test(h)) return FORMATI.percentuale;
  return undefined;
}

// Un nome di foglio valido e unico: al massimo 31 caratteri, senza i segni che
// Excel rifiuta.
export function nomeFoglio(nome, wb) {
  const base = String(nome || 'Foglio').replace(/[\\/:*?"[\]]/g, '-').slice(0, 31) || 'Foglio';
  let n = base;
  for (let i = 2; wb.getWorksheet(n); i++) n = `${base.slice(0, 31 - String(i).length - 1)} ${i}`;
  return n;
}

const vuota = (r) => !r || !r.length || r.every(v => v === null || v === undefined || v === '');

/**
 * UN FOGLIO INTERO DALLE RIGHE DI UN EXPORT. Gli export costruiscono le loro
 * righe (un elenco di elenchi, come prima per SheetJS): qui si vestono, cella per
 * cella uguali, sotto il blocco di testa del documento.
 * - doc: intestazioneDocumento (facoltativo)
 * - righe: le righe dell'export
 * - testate: gli indici delle righe che sono intestazioni di tabella (di
 *   solito la prima; piu' d'una se il foglio ha piu' tabelle)
 * - stili: { indice: 'totale' | 'gruppo' | 'avviso' | 'nota' | 'testata' }; una
 *   riga che comincia per «TOTALE» e' un totale anche senza dirlo
 * - formati: { colonna (da 0): formato } per tutto il foglio, oppure una
 *   funzione (colonna, riga, indice, titoli) che lo dice cella per cella; dove
 *   non lo dice vale il titolo della colonna (formatoDaTitolo)
 * - larghezze: le larghezze delle colonne in caratteri
 */
export function foglioDaRighe(wb, nome, { doc = null, righe = [], testate = null, stili = {}, formati = null, larghezze = null, orizzontale = true } = {}) {
  const ws = wb.addWorksheet(nomeFoglio(nome, wb));
  const quante = Math.max(1, ...righe.map(r => (r ? r.length : 0)));
  const iTestate = new Set(testate || (righe.length ? [0] : []));
  const testa = doc ? testaDocumento(ws, doc, quante) : 0;
  let titoli = [];
  let zebra = 0;
  let primaTestata = 0;
  const formatoDi = (c, r, i) => {
    const f = typeof formati === 'function' ? formati(c, r, i, titoli) : formati ? formati[c] : undefined;
    return f !== undefined ? f : formatoDaTitolo(titoli[c]);
  };
  righe.forEach((r, i) => {
    const valori = (r || []).map(v => (v === undefined ? null : v));
    const stile = stili[i] || (iTestate.has(i) ? 'testata' : /^totale\b/i.test(String(valori[0] ?? '').trim()) ? 'totale' : null);
    if (stile === 'testata') {
      titoli = valori.map(v => String(v ?? ''));
      const numeriche = titoli.map((_t, c) => (formatoDi(c, valori, i) ? c + 1 : 0)).filter(Boolean);
      const riga = intestazione(ws, valori, numeriche);
      if (!primaTestata) primaTestata = riga.number;
      zebra = 0;
      return;
    }
    if (vuota(valori)) { ws.addRow(valori.length ? valori : []); zebra = 0; return; }
    let riga;
    if (stile === 'totale') riga = rigaTotale(ws, valori, quante);
    else if (stile === 'avviso') riga = rigaAvviso(ws, valori, quante);
    else if (stile === 'gruppo') riga = rigaDettaglio(ws, valori, { grassetto: true, sfondo: COLORI.zebra, quante });
    else if (stile === 'nota') {
      riga = ws.addRow(valori);
      riga.getCell(1).font = { italic: true, size: 9, color: { argb: COLORI.grigio } };
    } else riga = rigaDettaglio(ws, valori, { sfondo: zebra++ % 2 ? COLORI.zebra : null, quante });
    const mappa = {};
    valori.forEach((v, c) => {
      if (typeof v === 'number') { const f = formatoDi(c, valori, i); if (f) mappa[c + 1] = f; }
      else if (v instanceof Date) mappa[c + 1] = FORMATI.data;
    });
    formatta(riga, mappa);
  });
  // Le larghezze: quelle dette, oppure quanto serve al testo piu' lungo, entro un tetto.
  for (let c = 1; c <= quante; c++) {
    const detta = larghezze && larghezze[c - 1];
    const lungo = Math.max(0, ...righe.map((r, i) => {
      const v = r && r[c - 1];
      if (v === null || v === undefined || stili[i] === 'nota' || stili[i] === 'avviso') return 0;
      return iTestate.has(i) ? Math.min(24, String(v).length) : String(v instanceof Date ? '00/00/0000' : v).length;
    }));
    ws.getColumn(c).width = detta || Math.max(10, Math.min(48, lungo + 2));
  }
  // Una tabella sola: l'intestazione resta ferma e si ripete in stampa. Con piu'
  // tabelle nello stesso foglio si ripete il solo blocco di testa.
  const unaTabella = iTestate.size === 1 && primaTestata;
  if (unaTabella) bloccaRighe(ws, primaTestata);
  perLaStampa(ws, { ripeti: unaTabella ? primaTestata : testa, orizzontale, doc });
  return ws;
}

/**
 * IL FOGLIO «NOTE»: il blocco di testa per esteso, voce per voce, e le note del
 * documento. Serve dove le colonne del foglio dei dati non si toccano (i tre
 * report dell'attiva per l'amministrazione: AGENTS.md), ma il file deve dire lo
 * stesso fino a quando arrivano i dati, e da chi e quando e' stato generato.
 */
export function foglioNote(wb, doc, note = [], nome = 'Note') {
  const ws = wb.addWorksheet(nomeFoglio(nome, wb));
  ws.getColumn(1).width = 24;
  ws.getColumn(2).width = 110;
  fascia(ws, [doc.titolo, doc.periodoBreve], 2);
  sottotitolo(ws, [doc.ente, doc.sottotitolo].filter(Boolean).join('  ·  '), 2);
  ws.addRow([]);
  const voce = (etichetta, testo, { avviso } = {}) => {
    const riga = avviso ? rigaAvviso(ws, [etichetta, testo], 2) : rigaDettaglio(ws, [etichetta, testo], { quante: 2 });
    riga.getCell(1).font = { bold: true, size: 10, color: { argb: avviso ? COLORI.ambra : COLORI.scuro } };
    riga.getCell(1).alignment = { vertical: 'top' };
    riga.getCell(2).alignment = { wrapText: true, vertical: 'top' };
    return riga;
  };
  if (doc.canale) voce('Canale', doc.canale);
  if (doc.periodo) voce('Periodo', doc.periodo);
  if (doc.archivi.length) doc.archivi.forEach((a, i) => voce(i ? '' : 'Dati fino al', `${a.archivio}: ${a.testo}`));
  else if (doc.dati) voce('Dati fino al', doc.dati.replace(/^Dati fino al:?\s*/, ''));
  voce('Generato', doc.generato.replace(/^Generato /, ''));
  for (const a of doc.avvisi || []) voce('Attenzione', a, { avviso: true });
  if (note.length) {
    ws.addRow([]);
    note.forEach((n, i) => voce(i ? '' : 'Note', n));
  }
  perLaStampa(ws, { ripeti: 2, orizzontale: false, doc });
  return ws;
}
