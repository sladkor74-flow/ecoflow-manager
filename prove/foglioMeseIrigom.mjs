// Prova del riepilogo Excel del mese di Irigom (excelDelMese in
// src/lib/documentiIrigom.js): si genera il foglio dal caso vero di agosto 2026 e
// si rilegge con exceljs. Quello che deve tornare e' la colonna con cui si
// decide quanto ferro mettere su ogni dichiarazione - «RESTA AI 38.000 KG» -
// perche' se dice un numero piu' grande del vero la dichiarazione sfora il limite
// del portale e viene rifiutata (regola a) dell'utente del 03/10/2026).
// npm run prove
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { componiMese, MAX_PER_DICHIARAZIONE_KG } from '../src/lib/praticaIrigom.js';
import { excelDelMese } from '../src/lib/documentiIrigom.js';

const ExcelJS = createRequire(import.meta.url)('exceljs');
const A = JSON.parse(readFileSync(new URL('./dati/irigom_agosto_2026.json', import.meta.url), 'utf8'));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const pratica = componiMese({ criterio: 'ordine', riga: A.riga, ferro: A.ferro, allegati: A.allegati, ddt: [], lettura: 'uscite', extra: A.extra, terziarie: A.terziarie });
const bytes = await excelDelMese({ pratica, contesto: { anno: 2026, mese: 'Agosto', data_lettera: '2026-09-18', nave: { nome: 'NAVE', partenza: '2026-08-28' } } });
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(bytes);
const ws = wb.worksheets[0];

// Le righe delle terziarie si riconoscono dal numero di terziaria in colonna A.
const perTerziaria = new Map();
ws.eachRow((riga, n) => {
  const a = String((riga.getCell(1).value) ?? '').trim();
  if (/^TER\d{8}$/.test(a)) perTerziaria.set(a, n);
});

console.log('LE TERZIARIE NEL FOGLIO DEL MESE');
verifica('ci sono tutte le terziarie della pratica', perTerziaria.size === pratica.terziarie.righe.length, `${perTerziaria.size} su ${pratica.terziarie.righe.length}`);

// Il valore di una cella con formula: exceljs rilegge { formula, result }.
const valore = (cella) => (cella && typeof cella.value === 'object' && cella.value !== null && 'result' in cella.value ? cella.value.result : (cella && cella.value));

console.log('QUANTO RESTA AI 38.000 KG SI CONTA SUL PESO DI CHIUSURA');
let conExtra = 0;
for (const t of pratica.terziarie.righe) {
  const n = perTerziaria.get(t.terziaria);
  if (!n) continue;
  const riga = ws.getRow(n);
  const resta = valore(riga.getCell(12));
  verifica(`${t.terziaria}: resta ai 38.000 come dice la pratica`, resta === t.residuo_kg, `foglio ${resta}, pratica ${t.residuo_kg}`);
  // La prova che morde: la terziaria che porta l'extra raccolta si chiude a
  // portale col peso intero, rete + extra. Contando 38.000 meno la sola rete, il
  // margine risultava piu' grande del vero esattamente dell'extra.
  if (t.extra_kg) {
    conExtra++;
    verifica(`${t.terziaria}: il margine non ignora l'extra raccolta`, resta === MAX_PER_DICHIARAZIONE_KG - t.totale_kg - t.extra_kg
      && resta !== MAX_PER_DICHIARAZIONE_KG - t.totale_kg, `${resta} contro ${MAX_PER_DICHIARAZIONE_KG - t.totale_kg} della sola rete`);
    const perCento = valore(riga.getCell(13));
    const atteso = (t.ferro_kg + pratica.extra.ferro_kg) / (t.totale_kg + t.extra_kg);
    verifica(`${t.terziaria}: la percentuale di ferro conta anche quello dell'extra`, Math.abs(perCento - atteso) < 1e-9, `${perCento} contro ${atteso}`);
  }
  verifica(`${t.terziaria}: la chiusura a portale non passa i 38.000 kg`, t.chiusura_portale_kg <= MAX_PER_DICHIARAZIONE_KG, String(t.chiusura_portale_kg));
}
verifica('una terziaria porta l\'extra raccolta, altrimenti la prova non proverebbe niente', conExtra === 1, String(conExtra));

console.log('I DDT DI CSS-C');
// Nei DDT non c'e' mai extra raccolta: il margine e' il totale della riga.
for (const d of pratica.cssc.righe) {
  verifica(`DDT ${d.ddt}: la chiusura non passa i 38.000 kg`, d.chiusura_portale_kg <= MAX_PER_DICHIARAZIONE_KG, String(d.chiusura_portale_kg));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
