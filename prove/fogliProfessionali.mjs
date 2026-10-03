// I FOGLI EXCEL CHE SI MANDANO FUORI SONO VESTITI
// (src/lib/fogliProfessionali.js e il «format amministrazione» dell'attiva).
//
// L'utente, 03/10/2026: il modo professionale di mandare un documento e' quello
// del report settimanale in PDF - fascia di intestazione, intestazioni in
// negativo, righe alternate, piede con le pagine - e ha chiesto la stessa cosa
// per questi fogli. Prima erano griglie di numeri nudi.
//
// Questa prova apre davvero il file prodotto e guarda come e' fatto: non si fida
// del fatto che il codice chiami le funzioni dello stile, controlla che nel file
// ci siano il grassetto, i colori, i formati dei numeri e l'impostazione di
// stampa. npm run prove
import { caricaLibPagine } from './dati/libPagine.mjs';

// Il foglio dell'attiva finisce in un file che l'utente scarica: qui il
// download si sostituisce con un appoggio, cosi' la prova puo' riaprirlo.
// Il PDF non c'entra con questa prova, e la sua libreria si tira dietro mezzo
// browser: si sostituisce con un segnaposto, come il download.
const { exportAmministrazioneAttiva } = await caricaLibPagine('lib/formatAmministrazioneExport', [
  ["import { scarica } from '@/lib/docxModello';", 'const scarica = (b, n) => { globalThis.__foglio = { blob: b, nome: n }; };'],
  ["import { esportaTabellaPdf } from '@/lib/esportaTabella';", 'const esportaTabellaPdf = async () => {};'],
]);

const modulo = await import('exceljs');
const ExcelJS = modulo.default || modulo;

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// Le sei righe ACI vere di settembre 2026 e due di rete, dai file
// dell'amministrazione: gli stessi numeri di prove/formatAmministrazione.mjs.
const RETE = [
  { ordine: 'ET26135194', data_fine_trasporto: '2026-09-01T00:00:00Z', numero_fir: 'RGYTR027031WF', classe: 'P', quantita: 1940, tariffa_valore: 202, totale: 391.88, regione: 'Campania' },
  { ordine: 'ET26137286', data_fine_trasporto: '2026-09-01T00:00:00Z', numero_fir: 'LQQDP001425TP', classe: 'M', quantita: 10120, tariffa_valore: 202, totale: 2044.24, regione: 'Campania' },
];
const ACI = [
  { regione: 'Puglia', ordine: 'ET26126228', data_fine_trasporto: '2026-09-01T00:00:00Z', numero_fir: 'BSDCL002361RK', classe: 'PFU Autodemolizione', quantita: 2140, tariffa_valore: 240, totale: 513.6 },
  { regione: 'Calabria', ordine: 'ET26145279', data_fine_trasporto: '2026-09-11T00:00:00Z', numero_fir: 'TYDJR004693GV', classe: 'PFU Autodemolizione', quantita: 3820, tariffa_valore: 230, totale: 878.6 },
];

/** Apre il foglio appena prodotto. */
async function foglio(tipologia, righe) {
  globalThis.__foglio = null;
  await exportAmministrazioneAttiva(tipologia, righe, 2026, 'Settembre');
  const f = globalThis.__foglio;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await f.blob.arrayBuffer()));
  return { nome: f.nome, ws: wb.worksheets[0], wb };
}

const colore = (c) => (c.fill && c.fill.fgColor ? c.fill.fgColor.argb : '');

console.log('IL FOGLIO DELLA RETE');
{
  const { nome, ws, wb } = await foglio('RETE', RETE);
  verifica('il nome dice che formato e', nome === 'Format_amministrazione_RETE_Settembre_2026.xlsx', nome);
  verifica('il foglio porta il mese', /SETTEMBRE 2026/i.test(ws.name), ws.name);
  verifica('l autore e il gestionale', wb.creator === 'TreadRider — Gestionale PFU', String(wb.creator));

  // Riga 1: la fascia. Riga 2: il sottotitolo. Riga 3: le intestazioni.
  const fascia = ws.getRow(1);
  verifica('la fascia dice chi fattura e che canale', /SMOCO/.test(String(fascia.getCell(1).value)) && /RETE/.test(String(fascia.getCell(1).value)), String(fascia.getCell(1).value));
  verifica('e il mese, in fondo a destra', /SETTEMBRE 2026/.test(String(fascia.getCell(10).value)), String(fascia.getCell(10).value));
  verifica('la fascia e scura con il testo bianco e in grassetto',
    colore(fascia.getCell(1)) === 'FF0F4C5C' && fascia.getCell(1).font.bold === true && fascia.getCell(1).font.color.argb === 'FFFFFFFF',
    JSON.stringify({ sfondo: colore(fascia.getCell(1)), font: fascia.getCell(1).font }));
  verifica('il sottotitolo dice quante righe e quanti chili', /2 righe/.test(String(ws.getRow(2).getCell(1).value)) && /12.060/.test(String(ws.getRow(2).getCell(1).value)), String(ws.getRow(2).getCell(1).value));

  const testa = ws.getRow(3);
  verifica('le intestazioni sono quelle del file dell amministrazione',
    String(testa.getCell(1).value) === 'Periodo' && String(testa.getCell(8).value) === 'Prezzo Unitario (Euro/Kg)' && String(testa.getCell(10).value) === 'Regione',
    JSON.stringify([testa.getCell(1).value, testa.getCell(8).value, testa.getCell(10).value]));
  verifica('sono in negativo e in grassetto', colore(testa.getCell(1)) === 'FF1A7F8E' && testa.getCell(1).font.bold === true, colore(testa.getCell(1)));
  verifica('e vanno a capo, perche i titoli sono lunghi', testa.getCell(8).alignment.wrapText === true);

  // Le righe: la prima a sfondo pieno, la seconda zebrata.
  verifica('la prima riga porta i dati', String(ws.getRow(4).getCell(3).value) === 'ET26135194', String(ws.getRow(4).getCell(3).value));
  verifica('i chili sono un numero, non un testo', ws.getRow(4).getCell(7).value === 1940 && ws.getRow(4).getCell(7).numFmt === '#,##0',
    JSON.stringify([ws.getRow(4).getCell(7).value, ws.getRow(4).getCell(7).numFmt]));
  verifica('il prezzo al chilo ha quattro decimali', ws.getRow(4).getCell(8).value === 0.202 && /0\.0000/.test(ws.getRow(4).getCell(8).numFmt),
    JSON.stringify([ws.getRow(4).getCell(8).value, ws.getRow(4).getCell(8).numFmt]));
  verifica('e l importo due decimali con l euro', /"€"/.test(ws.getRow(4).getCell(9).numFmt), ws.getRow(4).getCell(9).numFmt);
  verifica('le righe si alternano', colore(ws.getRow(5).getCell(1)) === 'FFF8FBFC', colore(ws.getRow(5).getCell(1)));

  // I totali in fondo, sotto le loro colonne.
  const tot = ws.getRow(6);
  verifica('la riga dei totali ha l etichetta', String(tot.getCell(1).value) === 'TOTALE', String(tot.getCell(1).value));
  verifica('i chili totali stanno sotto i chili', tot.getCell(7).value === 12060, String(tot.getCell(7).value));
  verifica('e gli euro sotto gli euro', tot.getCell(9).value === 2436.12, String(tot.getCell(9).value));
  verifica('ed e in grassetto, con il bordo doppio sopra',
    tot.getCell(1).font.bold === true && tot.getCell(1).border.top.style === 'double',
    JSON.stringify(tot.getCell(1).border));

  console.log('SI PUO STAMPARE E SI PUO SCORRERE');
  verifica('sta in una pagina in larghezza', ws.pageSetup.fitToWidth === 1 && ws.pageSetup.orientation === 'landscape', JSON.stringify(ws.pageSetup.fitToWidth));
  verifica('le prime tre righe si ripetono su ogni pagina', ws.pageSetup.printTitlesRow === '1:3', String(ws.pageSetup.printTitlesRow));
  verifica('in fondo c e il numero di pagina', /Pagina &P di &N/.test(ws.headerFooter.oddFooter), String(ws.headerFooter.oddFooter));
  verifica('e le intestazioni restano ferme mentre si scorre', ws.views[0].state === 'frozen' && ws.views[0].ySplit === 3, JSON.stringify(ws.views));
  verifica('le colonne sono larghe quanto serve', ws.columns.every(c => c.width >= 12), JSON.stringify(ws.columns.map(c => c.width)));
}

console.log('IL FOGLIO DELL ACI');
{
  const { ws } = await foglio('ACI', ACI);
  verifica('la fascia dice ACI', /ACI/.test(String(ws.getRow(1).getCell(1).value)), String(ws.getRow(1).getCell(1).value));
  const testa = ws.getRow(3);
  verifica('niente colonna del ticket', !testa.values.some(v => /ticket/i.test(String(v || ''))), JSON.stringify(testa.values));
  verifica('il prezzo e a tonnellata, con due decimali',
    ws.getRow(4).getCell(10).value === 240 && ws.getRow(4).getCell(10).numFmt === '#,##0.00 "€"',
    JSON.stringify([ws.getRow(4).getCell(10).value, ws.getRow(4).getCell(10).numFmt]));
  // LE NOTE RESTANO VUOTE: le scrive l'amministrazione a mano.
  verifica('la colonna delle note resta vuota', !ws.getRow(4).getCell(12).value && !ws.getRow(5).getCell(12).value);
  verifica('i totali ci sono', ws.getRow(6).getCell(9).value === 5960 && ws.getRow(6).getCell(11).value === 1392.2,
    JSON.stringify([ws.getRow(6).getCell(9).value, ws.getRow(6).getCell(11).value]));
}

console.log('SENZA RIGHE NON SI ROMPE NIENTE');
{
  const { ws } = await foglio('RETE', []);
  verifica('il foglio esce comunque, con i totali a zero', ws.getRow(4).getCell(7).value === 0, String(ws.getRow(4).getCell(7).value));
}

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
