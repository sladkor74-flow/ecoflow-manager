// IL FILE «SMOCO-Fatturazione EXTRA RACCOLTA» DICE I NUMERI DELLA FATTURA
// (chiusura dell'audit, 11/10/2026, revisione dei soldi).
//
// 1. Il «Totale imponibile» sommava i sovracosti del ricavo di tutti gli
//    interventi, anche di quelli che la fattura non conta (un terminato senza
//    peso effettivo, una secondaria): 504,00 contro 454,00 della fattura e
//    dell'analisi per produttore dello stesso file.
// 2. Il file non riceveva le tariffe lette dalla pagina: con la Tariffa
//    EXTRA_RACCOLTA a un valore diverso dalla base diceva un altro prezzo.
// 3. Un peso che manca si scriveva 0 kg; il PDF scriveva i numeri col punto
//    decimale («404»), non all'italiana.
// Dall'11/10/2026 i due file passano dal corredo dei documenti che escono: l'Excel
// si riapre da quello scaricato (exceljs), il PDF si rende con jspdf e se ne
// rilegge il testo. I controlli sono gli stessi.
// 4. Revisione delle migliorie (11/10/2026): passato a esportaSezioniPdf, il PDF
//    scriveva il prezzo col tipo 'euro', due decimali fissi. Una tariffa al chilo
//    da 0,202 usciva «0,20 €», mentre l'Excel dello stesso mese diceva 0,202. Ora
//    il prezzo tiene da due a quattro decimali in tutti e due i file.
// npm run prove
import { readFileSync } from 'node:fs';
import { resolveObjectURL } from 'node:buffer';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { caricaLibPagine } from './dati/libPagine.mjs';
import { calcolaRigheAttiva } from '../base44/shared/attivaCalcolo.ts';
import { contestoPrezzi, calcExtraRaccolta } from '../src/lib/extraRaccoltaCalc.js';
import { cifreItaliane } from '../src/lib/formatoSoldi.js';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// Il PDF: la macchina comune (esportaTabella.js) con jspdf vero, e il documento
// tenuto in memoria invece di salvarlo.
const jspdf = pathToFileURL(fileURLToPath(new URL('../node_modules/jspdf/dist/jspdf.node.min.js', import.meta.url))).href;
globalThis.__TABELLA = await caricaLibPagine('lib/esportaTabella', [
  [/await import\('jspdf'\)/g, `await import('${jspdf}').then(m => m.default || m)`],
  [/doc\.save\(`\$\{nomeSicuro\(nomeFile\)\}\.pdf`\);/g, 'globalThis.__PDF = doc.output();'],
]);
const lib = await caricaLibPagine('lib/extraRaccoltaExport', [
  ["await import('@/lib/esportaTabella')", 'globalThis.__TABELLA'],
  // un import relativo senza estensione, se ci fosse, node non lo risolve
  ["from './extraRaccoltaCalc'", "from './extraRaccoltaCalc.js'"],
]);
const { exportExtraRaccoltaExcel, exportExtraRaccoltaPDF } = lib;
// jspdf, se trova un window, lo prende per un browser: il finto di utils.js non serve piu'.
delete globalThis.window;
// Lo stato dei dati gia' letto: il server qui non c'e'.
const STATO = { letto: true, utente: 'Prova', archivi: [{ archivio: 'extra raccolta', entita: 'ExtraRaccolta', dati_fino_al: '2026-09-30' }] };

// L'Excel scaricato si riapre: le righe del foglio, coi valori veri delle celle.
let scaricato = null;
globalThis.document = { body: { appendChild() {} }, createElement: () => ({ click() { scaricato = resolveObjectURL(this.href); }, remove() {} }) };
const ExcelJS = (await import('exceljs')).default;
let righe = null;
let foglio = null;
async function esportaExcel(records, mese, anno, contesto) {
  await exportExtraRaccoltaExcel(records, mese, anno, contesto, { stato: STATO });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await scaricato.arrayBuffer()));
  const ws = wb.worksheets[0];
  foglio = ws;
  righe = [];
  for (let n = 1; n <= ws.rowCount; n++) righe.push((ws.getRow(n).values || []).slice(1));
}
// Il testo del PDF: fra parentesi tonde, con le lettere fuori dall'ASCII in ottale
// nella codifica dei font standard (€ e' 0x80, — e' 0x97, • e' 0x95).
const WIN = { 0x80: '€', 0x95: '•', 0x96: '–', 0x97: '—' };
const leggiPdf = (pdf) => [...new Set((String(pdf || '').match(/\((?:\\.|[^()\\])*\)\s*Tj/g) || [])
  .map(x => x.slice(1, x.lastIndexOf(')'))
    .replace(/\\(\d{3})/g, (_, o) => { const c = parseInt(o, 8); return WIN[c] || String.fromCharCode(c); })
    .replace(/\\([()\\])/g, '$1')
    // jspdf puo' scriverle anche come byte nudi, senza ottale
    .replace(/[\x80-\x9f]/g, (c) => WIN[c.charCodeAt(0)] || c)))];
let testi = [];

const base = {
  stato: 'terminato', tipo_movimento: 'primaria', cer: '160103', classe: 'P', produttore: 'COMUNE DI ESEMPIO', trasportatore: 'LOGISTICA', destinazione: 'Irigom S.r.l.',
  ordine_immesso_il: '2026-09-01T00:00:00.000Z', trasporto_iniziato_il: '2026-09-10T00:00:00.000Z', trasporto_finito_il: '2026-09-10T00:00:00.000Z',
};
const interventi = [
  { ...base, id: 'A', id_ordine: 'ER-A', numero_fir: 'FIR-A', peso_effettivo: 2000, prezzo_attivo_t: 202, sovracosto_raccolta: 50 },
  // scheda vecchia: terminata, senza peso effettivo, con la quantita' ritirata e un sovracosto
  { ...base, id: 'B', id_ordine: 'ER-B', numero_fir: 'FIR-B', peso_effettivo: 0, quantita_ritirata: 3000, prezzo_attivo_t: 202, sovracosto_raccolta: 50 },
  // una secondaria con un sovracosto: non si fattura a Ecotyre, il ricavo sta sulla raccolta
  { ...base, id: 'C', id_ordine: 'ER-C', numero_fir: 'FIR-C', tipo_movimento: 'secondaria', stoccaggio: 'NAPPI SUD SRL', peso_effettivo: 4000, sovracosto_trasporto: 30 },
];
const cella = (etichetta) => (righe.find(r => r[0] === etichetta) || [])[1];

console.log('1. IL TOTALE IMPONIBILE E\' QUELLO DELLA FATTURA');
{
  await esportaExcel(interventi, 'Settembre', 2026);
  const fattura = calcolaRigheAttiva({ reteAll: [], aciAll: [], extraAll: interventi, fornitori: [], tariffe: [], anno: 2026, mese: 'Settembre' });
  const totFattura = Math.round(fattura.righe.EXTRA_RACCOLTA.reduce((s, r) => s + r.totale, 0) * 100) / 100;
  const rigaTot = righe.find(r => r[0] === 'TOTALE');
  verifica('totale imponibile 454,00, come la fattura (prima 534,00: i sovracosti di tutti)', cella('Totale imponibile') === 454 && totFattura === 454, `${cella('Totale imponibile')} / ${totFattura}`);
  verifica('e come i ricavi dell\'analisi per produttore dello stesso file', rigaTot && rigaTot[10] === 454, JSON.stringify(rigaTot));
  verifica('il sovracosto di raccolta e\' solo quello che si fattura: 50, non 100', cella('Sovracosto Raccolta') === 50, String(cella('Sovracosto Raccolta')));
  verifica('e quello di trasporto della secondaria non c\'e\': 0', cella('Sovracosto Trasporto') === 0, String(cella('Sovracosto Trasporto')));
}

console.log('2. UN PESO CHE MANCA NON E\' ZERO');
{
  const rigaB = righe.find(r => r[0] === 'FIR-B');
  verifica('la scheda senza peso ha «—» nella quantita\', non 0 e non i 3.000 kg ritirati', rigaB && rigaB[8] === '—', JSON.stringify(rigaB));
  verifica('e il totale della quantita\' conta solo i pesi veri: 6.000 kg', cella("TOTALE QUANTITA' (kg)") === 6000, String(cella("TOTALE QUANTITA' (kg)")));
  const iTitolo = righe.findIndex(r => /^DA SISTEMARE: interventi terminati senza peso effettivo/.test(String(r[0] || '')));
  verifica('c\'e\' la riga «da sistemare» del peso mancante', iTitolo > 0, String(iTitolo));
  verifica('con la frase della fattura', iTitolo > 0 && righe[iTitolo + 1][0] === 'FIR-B' && /terminato senza peso effettivo/.test(righe[iTitolo + 1][1]), JSON.stringify(righe[iTitolo + 1]));
}

console.log('3. LE TARIFFE DELLA PAGINA ARRIVANO AL FILE');
{
  // la Tariffa EXTRA_RACCOLTA del 2026 a 210, e un intervento senza prezzo scritto
  const tariffa = { id: 'tx', direzione: 'ATTIVA', tipologia: 'EXTRA_RACCOLTA', cliente: 'ECOTYRE', valore: 210, unita_misura: '€/t', stato: 'attivo', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31' };
  const contesto = contestoPrezzi([tariffa], []);
  const senzaPrezzo = [{ ...base, id: 'D', id_ordine: 'ER-D', numero_fir: 'FIR-D', peso_effettivo: 1000 }];
  await esportaExcel(senzaPrezzo, 'Settembre', 2026, contesto);
  const rigaD = righe.find(r => r[0] === 'FIR-D');
  const pagina = calcExtraRaccolta(senzaPrezzo[0], contesto);
  const fattura = calcolaRigheAttiva({ reteAll: [], aciAll: [], extraAll: senzaPrezzo, fornitori: [], tariffe: [tariffa], anno: 2026, mese: 'Settembre' });
  verifica('col contesto della pagina il prezzo e\' quello della tabella: 210, come pagina e fattura', rigaD && rigaD[9] === 210 && pagina.prezzo_attivo === 210 && fattura.righe.EXTRA_RACCOLTA[0].tariffa_valore === 210,
    JSON.stringify([rigaD && rigaD[9], pagina.prezzo_attivo, fattura.righe.EXTRA_RACCOLTA[0] && fattura.righe.EXTRA_RACCOLTA[0].tariffa_valore]));
  verifica('e il totale della riga 210,00', rigaD && rigaD[10] === 210, JSON.stringify(rigaD));
  const src = readFileSync(new URL('../src/pages/ExtraRaccolta.jsx', import.meta.url), 'utf8').replace(/\r/g, '');
  verifica('la pagina passa il suo contesto all\'Excel e al PDF',
    /exportExtraRaccoltaExcel\(terminati, mese, anno, contesto\)/.test(src) && /exportExtraRaccoltaPDF\(terminati, mese, anno, contesto\)/.test(src));
}

console.log('4. IL PDF DICE GLI STESSI NUMERI, ALL\'ITALIANA');
{
  await exportExtraRaccoltaPDF(interventi, 'Settembre', 2026, undefined, { stato: STATO });
  testi = leggiPdf(globalThis.__PDF);
  verifica('totale imponibile «454,00 €», come l\'Excel', testi.includes('Totale imponibile') && testi.includes('454,00 €'), testi.filter(t => /imponibile|454/.test(t)).join(' | '));
  verifica('i chili col punto delle migliaia: «2.000»', testi.includes('2.000'), testi.filter(t => /^2.?000$/.test(t)).join(' | '));
  verifica('il peso che manca si scrive «—»', testi.includes('—'));
  verifica('e la scheda senza peso si dice', /FIR-B.*terminato senza peso effettivo/.test(testi.join(' ')), testi.filter(t => /senza peso/.test(t)).join(' | '));
}

console.log('5. IL PREZZO DEL PDF E\' QUELLO DELL\'EXCEL: DA DUE A QUATTRO DECIMALI');
{
  // La tariffa al chilo del rilievo (0,202 €/kg, unita' che calcolaTotale
  // riconosce) e tre prezzi scritti sull'intervento: con tre decimali, con
  // quattro, e tondo, che resta con due e non uno di meno.
  const tariffaKg = { id: 'tkg', direzione: 'ATTIVA', tipologia: 'EXTRA_RACCOLTA', cliente: 'ECOTYRE', valore: 0.202, unita_misura: '€/kg', stato: 'attivo', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31' };
  const contesto = contestoPrezzi([tariffaKg], []);
  const prezzi = [
    { ...base, id: 'K', id_ordine: 'ER-K', numero_fir: 'FIR-K', peso_effettivo: 1000 },
    { ...base, id: 'T', id_ordine: 'ER-T', numero_fir: 'FIR-T', peso_effettivo: 2000, prezzo_attivo_t: 202.125 },
    { ...base, id: 'Q', id_ordine: 'ER-Q', numero_fir: 'FIR-Q', peso_effettivo: 1500, prezzo_attivo_t: 202.0625 },
    { ...base, id: 'R', id_ordine: 'ER-R', numero_fir: 'FIR-R', peso_effettivo: 1500, prezzo_attivo_t: 202 },
  ];
  const attesi = { 'FIR-K': [0.202, '0,202 €'], 'FIR-T': [202.125, '202,125 €'], 'FIR-Q': [202.0625, '202,0625 €'], 'FIR-R': [202, '202,00 €'] };
  await esportaExcel(prezzi, 'Settembre', 2026, contesto);
  const excel = {};
  foglio.eachRow(r => { if (attesi[r.getCell(1).value]) excel[r.getCell(1).value] = { valore: r.getCell(10).value, formato: r.getCell(10).numFmt }; });
  await exportExtraRaccoltaPDF(prezzi, 'Settembre', 2026, contesto, { stato: STATO });
  testi = leggiPdf(globalThis.__PDF);
  const prezziLetti = testi.filter(t => /^(0,2|202,)/.test(t)).join(' | ');
  for (const [fir, [valore, testo]] of Object.entries(attesi)) {
    const x = excel[fir] || {};
    verifica(`${fir}: l'Excel dice ${valore} col formato da due a quattro decimali`, x.valore === valore && x.formato === '#,##0.00##', JSON.stringify(x));
    // Il prezzo del PDF e' il numero dell'Excel scritto col formato dell'Excel.
    verifica(`${fir}: il PDF dice «${testo}», lo stesso prezzo`, testi.includes(testo) && x.valore !== undefined && testo === `${cifreItaliane(x.valore, 2, 4)} €`, prezziLetti);
  }
  verifica('nessun prezzo tagliato a due decimali (prima «0,20 €», «202,13 €», «202,06 €»)', !['0,20 €', '202,13 €', '202,06 €'].some(t => testi.includes(t)), prezziLetti);
  // Il totale si cerca nella riga di FIR-K, dal suo formulario al formulario
  // dopo: «202,00 €» c'e' anche come prezzo di FIR-R, e cercato in tutto il PDF
  // la verifica passava anche senza il totale (verifica del 12/10/2026).
  const iK = testi.indexOf('FIR-K');
  const dopoK = testi.findIndex((t, i) => i > iK && /^FIR-/.test(t));
  const rigaK = iK < 0 ? [] : testi.slice(iK, dopoK < 0 ? undefined : dopoK);
  verifica('e il totale della riga al chilo resta 202,00 €', rigaK.includes('202,00 €'), rigaK.join(' | '));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
