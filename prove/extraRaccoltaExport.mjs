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
// 6-12. IL SURPLUS SULLE TARIFFE (13/10/2026). L'utente ha accettato la proposta:
//    la riga del Fuel Surcharge anche nei file Excel e PDF dell'elenco. Fino a
//    oggi i file ricevevano i soli prezzi e riportavano gli importi standard.
//    Ora, dopo i sovracosti e prima del Totale imponibile, una riga per mese e
//    per surplus col nome, t × €/t e l'importo da Ecotyre, col centesimo del
//    mese come in fattura (22,33 e non i 22,34 delle quote); il Totale
//    imponibile la comprende. L'analisi per produttore, coi costi e il margine,
//    esce solo all'amministratore (opzioni.isAdmin; senza si nega), col surplus
//    in una riga sua; senza surplus il file e' quello di prima.
// 7, 10, 13. Revisione del 13/10/2026: nell'analisi di un file di piu' mesi le
//    righe del surplus vanno per mese e poi per nome (prima le sole passive
//    finivano in fondo, dopo il mese dopo); la riga del surplus dice che vale
//    sugli interventi fatturati, perche' il TOTALE QUANTITA' conta anche le
//    secondarie, e la tabella del PDF dice «SULLE STESSE TONNELLATE FATTURATE».
// npm run prove
import { readFileSync } from 'node:fs';
import { resolveObjectURL } from 'node:buffer';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { caricaLibPagine } from './dati/libPagine.mjs';
import { calcolaRigheAttiva } from '../base44/shared/attivaCalcolo.ts';
import { calcolaPassivaMese } from '../base44/shared/passivaCalcolo.ts';
import { contestoPrezzi, calcExtraRaccolta, totaliExtraRaccolta } from '../src/lib/extraRaccoltaCalc.js';
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
// L'analisi per produttore ha i costi: esce solo all'amministratore (13/10/2026).
// Le sezioni che la leggono esportano come lui; la 9 come chi non lo e'.
async function esportaExcel(records, mese, anno, contesto, permessi = { isAdmin: true }) {
  await exportExtraRaccoltaExcel(records, mese, anno, contesto, { stato: STATO, ...permessi });
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
// Tutti i testi nell'ordine in cui il PDF li scrive, anche ripetuti (testiPdf);
// leggiPdf li tiene una volta sola.
const testiPdf = (pdf) => (String(pdf || '').match(/\((?:\\.|[^()\\])*\)\s*Tj/g) || [])
  .map(x => x.slice(1, x.lastIndexOf(')'))
    .replace(/\\(\d{3})/g, (_, o) => { const c = parseInt(o, 8); return WIN[c] || String.fromCharCode(c); })
    .replace(/\\([()\\])/g, '$1')
    // jspdf puo' scriverle anche come byte nudi, senza ottale
    .replace(/[\x80-\x9f]/g, (c) => WIN[c.charCodeAt(0)] || c));
const leggiPdf = (pdf) => [...new Set(testiPdf(pdf))];
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
  verifica('la pagina passa il suo contesto all\'Excel e al PDF (e i permessi, dal 13/10/2026)',
    /exportExtraRaccoltaExcel\(terminati, mese, anno, contesto, \{ isAdmin \}\)/.test(src) && /exportExtraRaccoltaPDF\(terminati, mese, anno, contesto, \{ isAdmin \}\)/.test(src));
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

// ─── IL SURPLUS SULLE TARIFFE (13/10/2026) ───
// Il mese costruito di prove/extraRaccoltaSurplus.mjs: ottobre 2026 col Fuel
// Surcharge del consorzio, +5 €/t da Ecotyre e ai raccoglitori. Sui 4.465 kg
// fatturati la fattura ha 22,33 €; sommate intervento per intervento le quote
// fanno 22,34. Ai raccoglitori 20,03 € (EMMESSE 16,01, GREEN TYRE 4,02 per il
// suo subraccoglitore), a SMOCO, interna, niente.
const J = (x) => JSON.stringify(x);
const sezione = async (titolo, corpo) => {
  console.log(titolo);
  try { await corpo(); } catch (e) { ko++; console.log(`  FALLITA: ${titolo}: si ferma con un errore (${e && e.message})`); }
};
const subfornitori = await caricaLibPagine('lib/subfornitori');
const FORNITORI = [
  { id: 'F-EMM', ragione_sociale: 'EMMESSE SRLS', stato: 'attivo', ruolo_raccolta: true },
  { id: 'F-SMO', ragione_sociale: 'SMOCO S.R.L.', stato: 'attivo', interno: true, ruolo_raccolta: true },
  { id: 'F-GTP', ragione_sociale: 'GREEN TYRE PROJECT SRL', stato: 'attivo', ruolo_raccolta: true, ruolo_trattamento: true },
  { id: 'F-TOR', ragione_sociale: 'TORRES GIOVANNI', stato: 'attivo', fattura_tramite_nome: 'GREEN TYRE PROJECT SRL', ruolo_raccolta: true },
  { id: 'F-GAT', ragione_sociale: 'GATIM S.R.L.', stato: 'attivo', ruolo_trattamento: true },
  { id: 'F-NAP', ragione_sociale: 'NAPPI SUD SRL', stato: 'attivo', ruolo_stoccaggio: true },
];
const surplus = (id, tipologia, altro = {}) => ({
  id, gruppo: 'g-fs', nome: 'Fuel Surcharge', origine: 'CONSORZIO', riferimento: 'comunicazione Ecotyre', tipologia, prestazione: 'RACCOLTA',
  a_chi: 'tutti', fornitori_json: '', euro_t_passiva: 5, euro_t_attiva: 5,
  data_inizio_validita: '2026-10-01', data_fine_validita: '2026-12-31', stato: 'attivo', ...altro,
});
const FS = [surplus('fs-rete', 'RETE'), surplus('fs-aci', 'ACI'), surplus('fs-extra', 'EXTRA_RACCOLTA'),
  surplus('fs-spento', 'EXTRA_RACCOLTA', { nome: 'Vecchio accordo', stato: 'non_attivo', euro_t_passiva: 9, euro_t_attiva: 9 })];
const iv = (id, altro = {}) => ({
  id, stato: 'terminato', tipo_movimento: 'primaria', id_ordine: 'ER-' + id, numero_fir: 'FIR ' + id,
  produttore: 'COMUNE DI PROVA', trasportatore: 'EMMESSE SRLS', destinazione: 'GATIM S.R.L.', tipo_destinazione: 'imp',
  provincia: 'NA', classe: 'P', cer: '160103',
  ordine_immesso_il: '2026-09-20T08:00:00.000Z', trasporto_iniziato_il: '2026-09-28T08:00:00.000Z', trasporto_finito_il: '2026-10-05T08:00:00.000Z',
  peso_effettivo: 1000, prezzo_attivo_t: 202, costo_raccolta_t: 72, costo_trattamento_t: 90,
  ...altro,
});
const OTTOBRE = [
  iv('A', { peso_effettivo: 1001 }),
  iv('B', { peso_effettivo: 1001, trasporto_finito_il: '2026-10-20T08:00:00.000Z' }),
  iv('C', { trasportatore: 'SMOCO S.R.L.', produttore: 'COMUNE DI SMOCO', peso_effettivo: 460, costo_raccolta_t: 0, trasporto_finito_il: '2026-10-07T08:00:00.000Z' }),
  iv('D', { trasportatore: 'TORRES GIOVANNI', destinazione: 'GREEN TYRE PROJECT SRL', peso_effettivo: 803, costo_raccolta_t: 85, costo_trattamento_t: 100, trasporto_finito_il: '2026-10-09T08:00:00.000Z' }),
  // 22:30Z del 30/09 e' l'1/10 alle 00:30 in Italia: ottobre
  iv('E', { peso_effettivo: 1200, trasporto_finito_il: '2026-09-30T22:30:00.000Z' }),
  iv('G', { tipo_movimento: 'secondaria', stoccaggio: 'NAPPI SUD SRL', produttore: 'NAPPI SUD SRL', peso_effettivo: 2000, prezzo_attivo_t: 0,
    costo_raccolta_t: 0, costo_trasporto_viaggio: 150, trasporto_finito_il: '2026-10-12T08:00:00.000Z' }),
  iv('H', { peso_effettivo: 0, trasporto_finito_il: '2026-10-14T08:00:00.000Z' }),
];
const contestoCon = (s = FS) => contestoPrezzi([], FORNITORI, s, subfornitori);
const fatturaDi = (s, extraAll, mese = 'Ottobre') => calcolaRigheAttiva({ reteAll: [], aciAll: [], extraAll, fornitori: FORNITORI, tariffe: [], anno: 2026, mese, surplus: s }).righe.EXTRA_RACCOLTA;
const passivaDi = (s, extraAll) => calcolaPassivaMese({ primarieRete: [], primarieAci: [], secondarieAll: [], extraRaccoltaAll: extraAll, tariffeAll: [], fornitoriAll: FORNITORI, surplusAll: s }, 2026, 9, 'Ottobre', 'EXTRA_RACCOLTA');
const somma = (elenco, campo) => Math.round(elenco.reduce((s, r) => s + (Number(r[campo]) || 0), 0) * 100) / 100;
const rigaFoglio = (testo) => { let trovata = null; foglio.eachRow(r => { if (!trovata && r.getCell(1).value === testo) trovata = r; }); return trovata; };
const etichette = () => righe.map(r => r[0]);
// I valori di tutto il foglio sotto il blocco di testa (la riga del «generato il» cambia col minuto).
const valoriFoglio = () => righe.slice(righe.findIndex(r => r[0] === 'Nr. FIR'));
const indaco = (r) => !!r && r.getCell(1).fill && r.getCell(1).fill.fgColor && r.getCell(1).fill.fgColor.argb === 'FFEEF2FF'
  && r.getCell(1).font && r.getCell(1).font.italic === true && r.getCell(1).font.color && r.getCell(1).font.color.argb === 'FF3730A3'
  && r.getCell(1).border && r.getCell(1).border.left && r.getCell(1).border.left.style === 'thick' && r.getCell(1).border.left.color.argb === 'FF6366F1';

await sezione('6. SENZA SURPLUS IL FILE E\' QUELLO DI PRIMA', async () => {
  await esportaExcel(OTTOBRE, 'Ottobre', 2026, contestoPrezzi([], FORNITORI));
  const senza = valoriFoglio();
  const etichetteSenza = etichette();
  await esportaExcel(OTTOBRE, 'Ottobre', 2026, contestoCon([FS[0], FS[1], FS[3]]));
  verifica('col Fuel Surcharge della sola rete e dell\'ACI (e uno spento) il foglio e\' identico, cella per cella', J(valoriFoglio()) === J(senza));
  await esportaExcel(OTTOBRE, 'Ottobre', 2026, undefined);
  verifica('e anche senza contesto', J(valoriFoglio()) === J(senza));
  const i = etichetteSenza.indexOf('Sovracosto Trattamento');
  verifica('dopo i sovracosti viene subito il Totale imponibile, come prima', i > 0 && etichetteSenza[i + 1] === 'Totale imponibile', J(etichetteSenza.slice(i, i + 2)));
  verifica('nessuna riga dice «Surplus»', !righe.some(r => r.some(v => /surplus/i.test(String(v ?? '')))));
  verifica('l\'analisi ha le 12 colonne di prima', J(righe.find(r => r[0] === 'PRODUTTORE' && r[1] === 'costi aggiuntivi')) === J(['PRODUTTORE', 'costi aggiuntivi', 'raccolta', 'stoccaggio', 'trattamento', 'pulizia', 'trasporto', 'sovracosto raccoglitore', 'sovracosto impianto', 'costo totale', 'ricavi', 'margine']));
  await exportExtraRaccoltaPDF(OTTOBRE, 'Ottobre', 2026, contestoPrezzi([], FORNITORI), { stato: STATO, isAdmin: true });
  const pdf = leggiPdf(globalThis.__PDF);
  verifica('nel PDF niente riquadro e niente tabella del surplus', !pdf.some(t => /surplus/i.test(t)), pdf.filter(t => /surplus/i.test(t)).join(' | '));
});

await sezione('7. IL FUEL SURCHARGE NEL RIEPILOGO DELL\'EXCEL: DOPO I SOVRACOSTI, PRIMA DEL TOTALE', async () => {
  await esportaExcel(OTTOBRE, 'Ottobre', 2026, contestoCon());
  const fattura = fatturaDi(FS, OTTOBRE);
  const rigaFattura = fattura.filter(r => r.surplus_id);
  const e = etichette();
  const i = e.indexOf('Sovracosto Trattamento');
  verifica('l\'ordine: Sovracosto Trattamento, Fuel Surcharge, Totale imponibile', i > 0 && e[i + 1] === 'Fuel Surcharge' && e[i + 2] === 'Totale imponibile', J(e.slice(i, i + 3)));
  const fs = righe.find(r => r[0] === 'Fuel Surcharge') || [];
  verifica('l\'importo e\' quello della fattura, al centesimo del mese: 22,33 (le quote farebbero 22,34)', fs[1] === 22.33 && rigaFattura.length === 1 && rigaFattura[0].totale === 22.33
    && totaliExtraRaccolta(OTTOBRE, contestoCon()).surplus.quote_attivo === 22.34, J([fs[1], rigaFattura.map(r => r.totale)]));
  verifica('la riga dice t × €/t, il mese, gli interventi fatturati, l\'origine e il periodo', fs[2] === 'Surplus di ottobre 2026: 4,465 t × 5,00 €/t, sulle stesse tonnellate dei 5 interventi fatturati · consorzio Ecotyre · dal 01/10/2026 al 31/12/2026', String(fs[2]));
  verifica('il Totale imponibile comprende il surplus: 924,26, la fattura del mese', cella('Totale imponibile') === 924.26 && somma(fattura, 'totale') === 924.26, J([cella('Totale imponibile'), somma(fattura, 'totale')]));
  verifica('cioe\' lo standard (901,93) piu\' il surplus (22,33)', somma(fattura.filter(r => !r.surplus_id), 'totale') === 901.93);
  // Il TOTALE QUANTITA' e' quello di prima e conta anche la secondaria G
  // (2.000 kg), come nella sezione 2; il surplus vale sui chili fatturati, i
  // 4.465 kg della fattura, e la sua riga lo dice (revisione del 13/10/2026: la
  // frase di questa verifica diceva il contrario di quello che controllava).
  const kgFatturati = somma(fattura.filter(r => !r.surplus_id && r.quantita > 0), 'quantita');
  verifica('il totale dei chili e\' quello di prima: 6.465 kg, la secondaria compresa (il senza peso no)', cella("TOTALE QUANTITA' (kg)") === 4465 + 2000, String(cella("TOTALE QUANTITA' (kg)")));
  verifica('il surplus vale sui 4.465 kg fatturati, quelli della fattura, e la riga dice che sono gli interventi fatturati, non tutti',
    kgFatturati === 4465 && /^Surplus di ottobre 2026: 4,465 t /.test(fs[2]) && /sulle stesse tonnellate dei 5 interventi fatturati/.test(fs[2]) && !/tonnellate degli interventi/.test(fs[2]), J([kgFatturati, fs[2]]));
  const r = rigaFoglio('Fuel Surcharge');
  verifica('l\'importo ha il formato degli euro', r && /€/.test(r.getCell(2).numFmt), r ? r.getCell(2).numFmt : 'manca');
  verifica('la riga ha la forma del surplus: fondo indaco chiaro, corsivo indaco scuro, barra a sinistra', indaco(r), r ? J([r.getCell(1).fill, r.getCell(1).font, r.getCell(1).border]) : 'manca');
  verifica('le altre righe del riepilogo no', !indaco(rigaFoglio('Sovracosto Trattamento')) && !indaco(rigaFoglio('Totale imponibile')));
});

await sezione('8. L\'ANALISI DELL\'AMMINISTRATORE: IL SURPLUS IN UNA RIGA SUA, IL TOTALE TORNA', async () => {
  await esportaExcel(OTTOBRE, 'Ottobre', 2026, contestoPrezzi([], FORNITORI));
  const iP = righe.findIndex(r => r[0] === 'PRODUTTORE' && r[1] === 'costi aggiuntivi');
  const produttoriSenza = righe.slice(iP + 1, righe.findIndex(r => r[0] === 'TOTALE'));
  await esportaExcel(OTTOBRE, 'Ottobre', 2026, contestoCon());
  const iP2 = righe.findIndex(r => r[0] === 'PRODUTTORE' && r[1] === 'costi aggiuntivi');
  const iTot = righe.findIndex(r => r[0] === 'TOTALE');
  const corpo = righe.slice(iP2 + 1, iTot);
  verifica('le righe dei produttori sono quelle di prima, lo standard', J(corpo.filter(r => !/^Surplus/.test(r[0]))) === J(produttoriSenza), J(corpo));
  const s = corpo.find(r => r[0] === 'Surplus · Fuel Surcharge') || [];
  // colonne: 0 nome, 1 costi agg., 2 raccolta, 3 stoccaggio, 4 trattamento, 5 pulizia, 6 trasporto, 7 sovr. raccogl., 8 sovr. impianto, 9 costo totale, 10 ricavi, 11 margine
  verifica('la riga del surplus: 20,03 nella raccolta e nel costo totale, 22,33 di ricavi, 2,30 di margine (SMOCO e\' interna)',
    s[2] === 20.03 && s[9] === 20.03 && s[10] === 22.33 && s[11] === 2.3 && [1, 3, 4, 5, 6, 7, 8].every(c => s[c] === undefined || s[c] === null), J(s));
  verifica('ed e\' l\'ultima prima del TOTALE', corpo[corpo.length - 1] === s);
  const p = passivaDi(FS, OTTOBRE);
  const tot = righe[iTot];
  verifica('TOTALE ricavi = Totale imponibile = fattura (924,26)', tot[10] === 924.26 && tot[10] === cella('Totale imponibile'), J(tot));
  verifica('TOTALE costo = la passiva del mese, col surplus (1.058,71)', tot[9] === 1058.71 && p.totali.totale_complessivo === 1058.71, J([tot[9], p.totali.totale_complessivo]));
  verifica('in ogni riga le colonne dei costi fanno il costo totale', [...corpo, tot].every(r => Math.abs([1, 2, 3, 4, 5, 6, 7, 8].reduce((x, c) => x + (Number(r[c]) || 0), 0) - r[9]) < 0.005), J(corpo));
  verifica('e il margine e\' ricavi meno costi', [...corpo, tot].every(r => Math.abs((r[10] - r[9]) - r[11]) < 0.005));
  verifica('la riga del surplus ha la forma del surplus', indaco(rigaFoglio('Surplus · Fuel Surcharge')));
  verifica('il margine % lo comprende', cella('Margine % complessivo') === `${cifreItaliane(Math.round(((924.26 - 1058.71) / 924.26) * 10000) / 100, 2, 2)}%`, String(cella('Margine % complessivo')));
});

await sezione('9. CHI NON E\' AMMINISTRATORE: LA RIGA DA ECOTYRE SI\', I COSTI NO', async () => {
  const conAccordo = [...FS, surplus('tr', 'EXTRA_RACCOLTA', { nome: 'Accordo Gatim', origine: 'ACCORDO_COMMERCIALE', prestazione: 'TRATTAMENTO', euro_t_passiva: 3, euro_t_attiva: null })];
  for (const [nome, permessi] of [['non amministratore', { isAdmin: false }], ['senza permessi detti', {}]]) {
    await esportaExcel(OTTOBRE, 'Ottobre', 2026, contestoCon(conAccordo), permessi);
    const tutto = J(righe);
    verifica(`${nome}: la riga del Fuel Surcharge e il Totale imponibile ci sono`, cella('Fuel Surcharge') === 22.33 && cella('Totale imponibile') === 924.26, tutto.slice(0, 300));
    verifica(`${nome}: niente analisi per produttore, ne' costi ne' margine`, !righe.some(r => r[0] === 'PRODUTTORE' && r[1] === 'costi aggiuntivi') && !righe.some(r => r[0] === 'TOTALE' || r[0] === 'Margine % complessivo'), etichette().join(' | '));
    verifica(`${nome}: nessun importo ai fornitori (20,03, 16,01, 1.058,71) e l'accordo solo passivo non si nomina`, !/20\.03|16\.01|1058\.71|Accordo Gatim/.test(tutto), tutto.match(/20\.03|16\.01|1058\.71|Accordo Gatim/g));
    await exportExtraRaccoltaPDF(OTTOBRE, 'Ottobre', 2026, contestoCon(conAccordo), { stato: STATO, ...permessi });
    const pdf = leggiPdf(globalThis.__PDF);
    verifica(`${nome}: nel PDF niente analisi e nessun costo`, !pdf.includes('ANALISI MARGINE PER PRODUTTORE') && !pdf.some(t => /^(20,03|16,01|1\.058,71) €$|Accordo Gatim/.test(t)), pdf.filter(t => /ANALISI|20,03|1\.058|Accordo/.test(t)).join(' | '));
    verifica(`${nome}: il PDF ha il Fuel Surcharge e il Totale imponibile`, pdf.includes('Surplus · Fuel Surcharge') && pdf.includes('22,33 €') && pdf.includes('924,26 €'));
  }
  await esportaExcel(OTTOBRE, 'Ottobre', 2026, contestoCon(conAccordo), { isAdmin: true });
  const acc = righe.find(r => r[0] === 'Surplus · Accordo Gatim') || [];
  verifica('all\'amministratore l\'accordo solo passivo c\'e\', nella colonna del trattamento, senza ricavi', acc[4] > 0 && acc[9] === acc[4] && acc[10] === 0 && acc[11] === -acc[4], J(acc));
  verifica('e non sta nel riepilogo della fattura', !righe.some(r => r[0] === 'Accordo Gatim'));
});

await sezione('10. IL PDF: IL RIQUADRO PRIMA DEL TOTALE E LA TABELLA DEL SURPLUS', async () => {
  await exportExtraRaccoltaPDF(OTTOBRE, 'Ottobre', 2026, contestoCon(), { stato: STATO, isAdmin: true });
  const pdf = leggiPdf(globalThis.__PDF);
  const iTratt = pdf.indexOf('Sovracosto trattamento');
  const iBox = pdf.indexOf('Surplus · Fuel Surcharge');
  const iTot = pdf.indexOf('Totale imponibile');
  verifica('il riquadro del surplus sta fra i sovracosti e il Totale imponibile', iTratt >= 0 && iBox > iTratt && iTot > iBox, J([iTratt, iBox, iTot]));
  verifica('col suo importo, 22,33 €, e il Totale imponibile 924,26 €', pdf[iBox + 1] === '22,33 €' && pdf.includes('924,26 €'), J(pdf.slice(iBox, iBox + 4)));
  const iSez = pdf.findIndex(t => /^SURPLUS SULLE TARIFFE/.test(t));
  const iInterventi = pdf.indexOf('INTERVENTI');
  const iAnalisi = pdf.indexOf('ANALISI MARGINE PER PRODUTTORE');
  verifica('la tabella del surplus sta dopo gli interventi e prima dell\'analisi', iSez > iInterventi && iAnalisi > iSez, J([iInterventi, iSez, iAnalisi]));
  // Il riquadro dei chili conta anche la secondaria (6.465), la tabella del
  // surplus i 4,465 t fatturati: il titolo dice quali tonnellate sono.
  verifica('il titolo della tabella dice che le tonnellate sono quelle fatturate', pdf[iSez] === 'SURPLUS SULLE TARIFFE: RIGA A PARTE IN FATTURA, SULLE STESSE TONNELLATE FATTURATE', String(pdf[iSez]));
  const tutti = testiPdf(globalThis.__PDF);
  const iSezT = tutti.findIndex(t => /^SURPLUS SULLE TARIFFE/.test(t));
  const iAnalisiT = tutti.indexOf('ANALISI MARGINE PER PRODUTTORE');
  const sez = tutti.slice(iSezT, iAnalisiT);
  verifica('la riga: Surplus · Fuel Surcharge, Ottobre 2026, consorzio Ecotyre e il periodo, 4,465 t a 5,00 €, 22,33 €',
    J(sez.slice(-6)) === J(['Surplus · Fuel Surcharge', 'Ottobre 2026', 'consorzio Ecotyre · dal 01/10/2026 al 31/12/2026', '4,465', '5,00 €', '22,33 €']), sez.join(' | '));
  verifica('con una riga sola niente «Totale surplus»', !pdf.includes('Totale surplus'));
  const an = tutti.slice(iAnalisiT);
  verifica('nell\'analisi la riga del surplus, coi 20,03 € ai raccoglitori e 2,30 € di margine', an.includes('Surplus · Fuel Surcharge') && an.includes('20,03 €') && an.includes('2,30 €'), an.join(' | ').slice(0, 600));
  verifica('e il TOTALE dei ricavi e\' il Totale imponibile, 924,26 €; dei costi la passiva, 1.058,71 €', an.includes('924,26 €') && an.includes('1.058,71 €'), an.join(' | ').slice(0, 600));
});

await sezione('11. PIU\' SURPLUS E PIU\' MESI: UNA RIGA CIASCUNO, COL CENTESIMO DEL SUO MESE', async () => {
  // Il Fuel Surcharge a 5 €/t fino al 15/10 e a 6 €/t dal 16/10 (un importo che
  // cambia a meta' mese), e un intervento di novembre.
  const DUE = [
    surplus('fs5', 'EXTRA_RACCOLTA', { data_fine_validita: '2026-10-15' }),
    surplus('fs6', 'EXTRA_RACCOLTA', { euro_t_attiva: 6, euro_t_passiva: 6, data_inizio_validita: '2026-10-16' }),
  ];
  const N = iv('N', { peso_effettivo: 2000, trasporto_finito_il: '2026-11-10T08:00:00.000Z' });
  const elenco = [...OTTOBRE, N];
  await esportaExcel(elenco, 'Tutti', 2026, contestoCon(DUE));
  const ott = fatturaDi(DUE, elenco, 'Ottobre');
  const nov = fatturaDi(DUE, elenco, 'Novembre');
  const di = (righeFattura, id) => (righeFattura.find(r => r.surplus_id === id) || {}).totale;
  const e = etichette();
  const i = e.indexOf('Sovracosto Trattamento');
  verifica('tre righe, nell\'ordine dei mesi, distinte dall\'importo quando il nome e\' lo stesso nel mese',
    J(e.slice(i + 1, i + 4)) === J(['Fuel Surcharge a 5,00 €/t', 'Fuel Surcharge a 6,00 €/t', 'Fuel Surcharge']) && e[i + 4] === 'Totale imponibile', J(e.slice(i, i + 5)));
  const v = e.slice(i + 1, i + 4).map(n => righe.find(r => r[0] === n));
  verifica('ognuna con l\'importo della sua riga in fattura: 17,32 e 6,01 a ottobre, 12,00 a novembre',
    v[0][1] === di(ott, 'fs5') && v[0][1] === 17.32 && v[1][1] === di(ott, 'fs6') && v[1][1] === 6.01 && v[2][1] === di(nov, 'fs6') && v[2][1] === 12, J(v.map(x => x[1])));
  verifica('la descrizione dice il mese', /^Surplus di ottobre 2026: 3,464 t × 5,00 €\/t/.test(v[0][2]) && /^Surplus di ottobre 2026: 1,001 t × 6,00 €\/t/.test(v[1][2]) && /^Surplus di novembre 2026: 2,00 t × 6,00 €\/t/.test(v[2][2]), J(v.map(x => x[2])));
  verifica('il Totale imponibile e\' la somma delle due fatture', cella('Totale imponibile') === Math.round((somma(ott, 'totale') + somma(nov, 'totale')) * 100) / 100, J([cella('Totale imponibile'), somma(ott, 'totale'), somma(nov, 'totale')]));
  verifica('nell\'analisi il nome dice anche il mese', ['Surplus · Fuel Surcharge a 5,00 €/t, ottobre 2026', 'Surplus · Fuel Surcharge a 6,00 €/t, ottobre 2026', 'Surplus · Fuel Surcharge, novembre 2026'].every(n => righe.some(r => r[0] === n)),
    J(righe.filter(r => /^Surplus/.test(String(r[0]))).map(r => r[0])));
  await exportExtraRaccoltaPDF(elenco, 'Tutti', 2026, contestoCon(DUE), { stato: STATO, isAdmin: true });
  const pdf = leggiPdf(globalThis.__PDF);
  const iBox = pdf.indexOf('Surplus · Fuel Surcharge');
  verifica('nel PDF un riquadro solo per il Fuel Surcharge, col totale (35,33 €)', iBox >= 0 && pdf[iBox + 1] === '35,33 €', J(pdf.slice(iBox, iBox + 2)));
  verifica('e la tabella con le tre righe e il totale del surplus', ['Surplus · Fuel Surcharge a 5,00 €/t', 'Surplus · Fuel Surcharge a 6,00 €/t', 'Ottobre 2026', 'Novembre 2026', 'Totale surplus'].every(t => pdf.includes(t)), pdf.filter(t => /Surplus|2026$/.test(t)).join(' | '));
  // Due surplus con nomi diversi sulle stesse tonnellate: due righe, ognuna la sua.
  const ALTRO = [...FS, surplus('gtp', 'EXTRA_RACCOLTA', { nome: 'Accordo Green Tyre', origine: 'ACCORDO_COMMERCIALE', a_chi: 'elenco', fornitori_json: J([{ id: 'F-GTP', nome: '' }]), euro_t_passiva: 4, euro_t_attiva: 4 })];
  await esportaExcel(OTTOBRE, 'Ottobre', 2026, contestoCon(ALTRO));
  const f2 = fatturaDi(ALTRO, OTTOBRE);
  verifica('nomi diversi: una riga ciascuno, coi loro importi in fattura (Accordo Green Tyre 3,21 sul subraccoglitore, Fuel Surcharge 22,33)',
    cella('Accordo Green Tyre') === 3.21 && cella('Fuel Surcharge') === 22.33 && di(f2, 'gtp') === 3.21 && cella('Totale imponibile') === somma(f2, 'totale'), J([cella('Accordo Green Tyre'), cella('Fuel Surcharge'), cella('Totale imponibile'), somma(f2, 'totale')]));
  await exportExtraRaccoltaPDF(OTTOBRE, 'Ottobre', 2026, contestoCon(ALTRO), { stato: STATO });
  const pdf2 = leggiPdf(globalThis.__PDF);
  const iBox2 = pdf2.indexOf('Surplus sulle tariffe');
  verifica('e nel PDF un riquadro solo, «Surplus sulle tariffe», col totale dei due (25,54 €); i nomi nella tabella', iBox2 >= 0 && pdf2[iBox2 + 1] === '25,54 €'
    && pdf2.includes('Surplus · Accordo Green Tyre') && pdf2.includes('Surplus · Fuel Surcharge'), J(pdf2.slice(iBox2, iBox2 + 2)));
});

await sezione('12. LA PAGINA DA\' AI FILE IL SUO CONTESTO, COI SURPLUS, E I PERMESSI', async () => {
  const src = readFileSync(new URL('../src/pages/ExtraRaccolta.jsx', import.meta.url), 'utf8').replace(/\r/g, '');
  verifica('niente piu\' contesto dei soli prezzi per i file', !/contestoFile/.test(src));
  verifica('il contesto della pagina e\' quello coi surplus', /const contesto = useMemo\(\(\) => contestoPrezzi\(tariffeAttive, fornitori, surplusAll, subfornitori\)/.test(src));
  verifica('e la nota accanto ai pulsanti non dice piu\' che i file hanno gli importi standard', !/I file riportano gli importi standard/.test(src) && /Nei file il surplus ha la sua riga prima del totale imponibile, col centesimo del mese come in fattura/.test(src));
});

await sezione('13. NELL\'ANALISI LE RIGHE DEL SURPLUS VANNO PER MESE, POI PER NOME', async () => {
  // Il file «Tutti» di ottobre e novembre, con il Fuel Surcharge, un premio solo
  // da Ecotyre, un accordo col solo subraccoglitore e due accordi pagati solo ai
  // fornitori (il trattamento e il trasporto delle secondarie). Le righe uscivano
  // prima con la parte da Ecotyre e poi le sole passive: l'accordo dei trasporti
  // di ottobre dopo il Fuel Surcharge di novembre (revisione del 13/10/2026).
  const TUTTI = [surplus('fs-extra', 'EXTRA_RACCOLTA'),
    surplus('tr', 'EXTRA_RACCOLTA', { nome: 'Accordo trattamento', origine: 'ACCORDO_COMMERCIALE', prestazione: 'TRATTAMENTO', euro_t_passiva: 3, euro_t_attiva: null }),
    surplus('ts', 'EXTRA_RACCOLTA', { nome: 'Accordo trasporti', origine: 'ACCORDO_COMMERCIALE', prestazione: 'TRASPORTO_SECONDARIA', euro_t_passiva: 2, euro_t_attiva: null }),
    surplus('gtp', 'EXTRA_RACCOLTA', { nome: 'Accordo Green Tyre', origine: 'ACCORDO_COMMERCIALE', a_chi: 'elenco', fornitori_json: J([{ id: 'F-GTP', nome: '' }]), euro_t_passiva: 4, euro_t_attiva: 4 }),
    surplus('pr', 'EXTRA_RACCOLTA', { nome: 'Premio Ecotyre', prestazione: '', euro_t_passiva: null, euro_t_attiva: 1.5 }),
  ];
  const elenco = [...OTTOBRE, iv('N', { peso_effettivo: 2345, produttore: 'COMUNE DI NOVEMBRE', trasporto_finito_il: '2026-11-10T08:00:00.000Z' })];
  const atteso = [
    'Surplus · Accordo Green Tyre, ottobre 2026', 'Surplus · Accordo trasporti, ottobre 2026', 'Surplus · Accordo trattamento, ottobre 2026',
    'Surplus · Fuel Surcharge, ottobre 2026', 'Surplus · Premio Ecotyre, ottobre 2026',
    'Surplus · Accordo trattamento, novembre 2026', 'Surplus · Fuel Surcharge, novembre 2026', 'Surplus · Premio Ecotyre, novembre 2026',
  ];
  await esportaExcel(elenco, 'Tutti', 2026, contestoCon(TUTTI));
  const iP = righe.findIndex(r => r[0] === 'PRODUTTORE' && r[1] === 'costi aggiuntivi');
  const iTot = righe.findIndex(r => r[0] === 'TOTALE');
  const nomi = righe.slice(iP + 1, iTot).map(r => String(r[0])).filter(n => /^Surplus · /.test(n));
  verifica('nell\'Excel: ottobre poi novembre, e nel mese per nome', J(nomi) === J(atteso), J(nomi));
  verifica('le righe del surplus sono le ultime prima del TOTALE', righe.slice(iP + 1, iTot).slice(-atteso.length).every(r => /^Surplus · /.test(String(r[0]))));
  // L'ordine non cambia i conti: TOTALE costo = la passiva dei due mesi, ricavi = le due fatture.
  const passiva = (m, mese) => calcolaPassivaMese({ primarieRete: [], primarieAci: [], secondarieAll: [], extraRaccoltaAll: elenco, tariffeAll: [], fornitoriAll: FORNITORI, surplusAll: TUTTI }, 2026, m, mese, 'EXTRA_RACCOLTA').totali.totale_complessivo;
  const costi = Math.round((passiva(9, 'Ottobre') + passiva(10, 'Novembre')) * 100) / 100;
  const fatture = Math.round((somma(fatturaDi(TUTTI, elenco, 'Ottobre'), 'totale') + somma(fatturaDi(TUTTI, elenco, 'Novembre'), 'totale')) * 100) / 100;
  verifica('e i conti sono quelli: TOTALE costo = passiva di ottobre e novembre, ricavi = Totale imponibile = le due fatture',
    righe[iTot][9] === costi && righe[iTot][10] === fatture && cella('Totale imponibile') === fatture, J([righe[iTot][9], costi, righe[iTot][10], fatture]));
  await exportExtraRaccoltaPDF(elenco, 'Tutti', 2026, contestoCon(TUTTI), { stato: STATO, isAdmin: true });
  const tutti = testiPdf(globalThis.__PDF);
  // Nel PDF il nome lungo va a capo: «Surplus · Fuel Surcharge,» e sotto «novembre 2026».
  const an = tutti.slice(tutti.indexOf('ANALISI MARGINE PER PRODUTTORE'));
  const nomiPdf = an.map((t, j) => (/^Surplus · /.test(t) ? (/2026$/.test(t) ? t : `${t} ${an[j + 1]}`) : null)).filter(Boolean);
  verifica('nel PDF lo stesso ordine', J(nomiPdf) === J(atteso), J(nomiPdf));
  // Un surplus sul solo subraccoglitore vale su un intervento: la riga lo dice.
  await esportaExcel(OTTOBRE, 'Ottobre', 2026, contestoCon(TUTTI));
  const gtp = righe.find(r => r[0] === 'Accordo Green Tyre') || [];
  verifica('un intervento solo: «sulle stesse tonnellate dell\'intervento fatturato»', /^Surplus di ottobre 2026: 0,803 t × 4,00 €\/t, sulle stesse tonnellate dell'intervento fatturato · /.test(String(gtp[2])), String(gtp[2]));
});

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
