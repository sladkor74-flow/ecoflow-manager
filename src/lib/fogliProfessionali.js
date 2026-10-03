import { AUTORE_FILE } from './prodotto.js';
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
  intero: '#,##0',
  // Un numero con due decimali che non e' ne' peso ne' denaro: per esempio i
  // viaggi pagati, che su un viaggio misto sono una quota (2,6) e non un intero.
  decimale2: '#,##0.00',
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
 */
export function perLaStampa(ws, { ripeti = 0, orizzontale = true } = {}) {
  ws.pageSetup = {
    orientation: orizzontale ? 'landscape' : 'portrait',
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };
  if (ripeti > 0) ws.pageSetup.printTitlesRow = `1:${ripeti}`;
  ws.headerFooter = { oddFooter: '&L&9SMOCO S.r.l. — commessa Ecotyre&C&9&D&R&9Pagina &P di &N' };
  return ws;
}

/** La prima riga (o le prime) ferma mentre si scorre. */
export function bloccaRighe(ws, quante) {
  if (quante > 0) ws.views = [{ state: 'frozen', ySplit: quante }];
  return ws;
}

/** Il file, pronto da scaricare. */
export const bytesDi = (wb) => wb.xlsx.writeBuffer();
