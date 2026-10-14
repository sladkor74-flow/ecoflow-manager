// IL FUEL SURCHARGE NEI TRE REPORT DELL'AMMINISTRAZIONE DELL'ATTIVA, COME VOCE A
// SE' CON LA SUA RIGA (decisione dell'utente del 13/10/2026 sera).
//
// L'utente: il Fuel Surcharge «deve essere una voce disgiunta con un proprio
// rigo (per canale)», nei report dell'amministrazione e nelle fatture; e prima,
// il 12/10/2026, «ci sarà in entrambi i casi una riga con l'importo standard ed
// una per il surplus (sempre riferito alle stesse tonnellate raccolte o
// trattate nel mese)», tutto «semplice a colpo d'occhio». Fino a questa
// decisione (la domanda D3 del progetto del surplus) i report uscivano coi soli
// formulari e la pagina diceva che il surplus si fatturava a parte.
//
// I report sono tre, ciascuno di un canale, in Excel e in PDF: il report
// dell'attiva (src/lib/fatturazioneExport.js: rete, ACI, extra raccolta) e il
// format dell'amministrazione (src/lib/formatAmministrazione.js e
// formatAmministrazioneExport.js: rete e ACI). Qui si producono i file veri, si
// riaprono e si guarda:
//   1. la tabella: i formulari di prima, e a parte la riga del surplus coi suoi
//      pezzi nelle colonne del modello (il nome sotto il Tipo, l'origine sotto
//      l'Ordine, la validita' sotto la Data, «+5,00 €/t sulle 471,65 t del
//      mese» sotto il FIR), la Quantita' vuota, il TOTALE che la comprende;
//   2. l'Excel del report dell'attiva: la riga vuota, il «Totale formulari», la
//      riga del surplus vestita come nella passiva, il TOTALE; il foglio Note;
//   3. l'Excel del format: le formule, CALCOLATE, cosi' si vede che le somme
//      non prendono due volte le tonnellate (i chili del TOTALE sono 471.650,
//      non 943.300) e che gli euro sommano formulari e surplus una volta sola;
//   4. i PDF, con jspdf vero: la riga del surplus intera in ogni impaginazione
//      (anche le colonne strette dell'ACI e il caso piu' lungo), nel colore del
//      surplus, il TOTALE col surplus e il totale dei formulari nel sottotitolo;
//   5. due record dello stesso surplus (l'importo che cambia a meta' mese):
//      due righe distinte, e i totali che tornano al centesimo;
//   6. sui dati veri dell'11/10/2026: ottobre fin li' (113 formulari, 321,83 t,
//      +1.609,15 €) e settembre senza surplus, identico a prima (380 righe,
//      1.120.240 kg, 226.288,48 €).
// Il caso di ottobre e' costruito sulle 471,65 t della rete al 13/10/2026:
// 95 formulari a 202 €/t (95.273,30 €), Fuel Surcharge 471,65 t × 5 = 2.358,25
// €, TOTALE 97.631,55 €. La copia dei dati veri si ferma all'11/10, a 321,83 t.
//
// node prove/reportAmministrazioneSurplus.mjs
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveObjectURL } from 'node:buffer';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { calcolaRigheAttiva, eRigaSurplus } from '../base44/shared/attivaCalcolo.ts';
import { caricaLibPagine } from './dati/libPagine.mjs';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = JSON.stringify;
const uguali = (a, b) => J(a) === J(b);

const modulo = await import('exceljs');
const ExcelJS = modulo.default || modulo;

// ─── le librerie dei report, coi PDF fatti da jspdf vero ───
const jspdf = pathToFileURL(qui('../node_modules/jspdf/dist/jspdf.node.min.js')).href;
globalThis.__TABELLA = await caricaLibPagine('lib/esportaTabella', [
  [/await import\('jspdf'\)/g, `await import('${jspdf}').then(m => m.default || m)`],
  [/doc\.save\(`\$\{nomeSicuro\(nomeFile\)\}\.pdf`\);/g, 'globalThis.__PDF = doc.output();'],
]);
const conTabella = [["await import('@/lib/esportaTabella')", 'globalThis.__TABELLA']];
const fatt = await caricaLibPagine('lib/fatturazioneExport', conTabella);
const amm = await caricaLibPagine('lib/formatAmministrazioneExport', conTabella);
// Le due tabelle, con surplus vuoto se la libreria non lo da' (il codice di
// prima della decisione): cosi' la controprova fallisce verifica per verifica,
// e non si ferma alla prima.
const libAmm = await caricaLibPagine('lib/formatAmministrazione');
const tabellaAmministrazione = (...a) => ({ surplus: [], ...libAmm.tabellaAmministrazione(...a) });
const tabellaAttiva = (...a) => ({ surplus: [], ...fatt.tabellaAttiva(...a) });
const STATO = { letto: true, utente: 'Prova', archivi: [], caricamenti_aperti: [] };

/** Il PDF appena fatto: le scritte nell'ordine in cui sono disegnate, e il flusso intero. */
async function pdf(fai) {
  const finestra = globalThis.window;
  delete globalThis.window;
  try { globalThis.__PDF = ''; await fai(); } finally { globalThis.window = finestra; }
  const flusso = String(globalThis.__PDF);
  const scritte = (flusso.match(/\((?:\\.|[^()\\])*\)\s*Tj/g) || [])
    .map(x => x.slice(1, x.lastIndexOf(')')).replace(/\\(\d{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8))).replace(/\\([()\\])/g, '$1').replace(/\x80/g, '€'));
  return { scritte, testo: scritte.join(' '), flusso };
}

/** L'Excel appena fatto, riaperto: il download si intercetta e il file si rilegge. */
async function excel(fai) {
  const scaricati = [];
  const prima = globalThis.document;
  globalThis.document = { body: { appendChild() {} }, createElement: () => ({ click() { scaricati.push({ nome: this.download, blob: resolveObjectURL(this.href) }); }, remove() {} }) };
  try { await fai(); } finally { if (prima === undefined) delete globalThis.document; else globalThis.document = prima; }
  const f = scaricati[scaricati.length - 1];
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await f.blob.arrayBuffer()));
  return { nome: f.nome, wb, ws: wb.worksheets[0] };
}
const valore = (v) => (v && typeof v === 'object' && !(v instanceof Date) && 'result' in v ? v.result : v);
const formula = (c) => (c.value && typeof c.value === 'object' && 'formula' in c.value ? c.value.formula : null);
const righeDi = (ws) => { const out = []; for (let n = 1; n <= ws.rowCount; n++) out.push((ws.getRow(n).values || []).slice(1).map(valore)); return out; };
/** Il foglio «Note» come testo: le etichette nella prima colonna, le frasi nella seconda. */
const testoNote = (wb) => righeDi(wb.getWorksheet('Note')).flat().filter(v => typeof v === 'string').join('\n');
const rigaCon = (ws, testo) => { for (let n = 1; n <= ws.rowCount; n++) if ((ws.getRow(n).values || []).includes(testo)) return ws.getRow(n); return null; };

/**
 * Le formule del foglio CALCOLATE, come le calcolerebbe il foglio di calcolo:
 * SUM su un intervallo, ROUND, e i riferimenti alle celle (una cella vuota vale
 * zero). Il risultato che il file porta scritto e' quello del gestionale; qui si
 * rifa' il conto dalle celle, e se una somma prendesse due volte le tonnellate
 * il numero sarebbe un altro.
 */
function calcolaCella(ws, rif, giro = 0) {
  if (giro > 50) throw new Error('formula circolare in ' + rif);
  const v = ws.getCell(rif).value;
  if (v && typeof v === 'object' && 'formula' in v) return calcolaFormula(ws, v.formula, giro + 1);
  return typeof v === 'number' ? v : 0;
}
function calcolaFormula(ws, f, giro = 0) {
  let e = f.replace(/SUM\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)/g, (_, c1, r1, c2, r2) => {
    if (c1 !== c2) throw new Error('somma su piu colonne: ' + f);
    let s = 0;
    for (let r = Number(r1); r <= Number(r2); r++) s += calcolaCella(ws, `${c1}${r}`, giro);
    return `(${s})`;
  });
  e = e.replace(/ROUND\(/g, 'TONDO(').replace(/\b([A-Z]{1,2})(\d+)\b/g, (_, c, r) => `(${calcolaCella(ws, c + r, giro)})`);
  return Function('TONDO', `return ${e};`)((x, n) => Math.round(Number((x * 10 ** n).toPrecision(15))) / 10 ** n);
}
const al2 = (x) => Math.round(x * 100) / 100;

// ─── il mese costruito: ottobre 2026 fino al 13/10, 471,65 t sulla rete ───
const tariffe = [
  { id: 't-rete', direzione: 'ATTIVA', tipologia: 'RETE', cliente: 'ECOTYRE', valore: 202, unita_misura: '€/t', stato: 'attivo', data_inizio_validita: '2026-01-01' },
  { id: 't-aci', direzione: 'ATTIVA', tipologia: 'ACI', cliente: 'ECOTYRE', regione: 'Campania', valore: 240, unita_misura: '€/t', stato: 'attivo', data_inizio_validita: '2026-01-01' },
  { id: 't-extra', direzione: 'ATTIVA', tipologia: 'EXTRA_RACCOLTA', cliente: 'ECOTYRE', valore: 202, unita_misura: '€/t', stato: 'attivo', data_inizio_validita: '2026-01-01' },
];
const base = { stato: 'terminato', cer: '160103', classe: 'A', provincia: 'NA', destinazione: 'IRIGOM SRL', trasportatore: 'ALFA SRL' };
const mov = (n, kg, giorno, altro = {}) => ({ ...base, id: 'r' + n, id_ordine: 'ET26' + String(n).padStart(6, '0'), numero_fir: 'FIR' + n, peso_effettivo: kg, trasporto_finito_il: `2026-10-${giorno}T08:00:00.000Z`, ...altro });
// 94 formulari da 4.965 kg e uno da 4.940: 471.650 kg, fra l'1 e il 13 ottobre
const reteAll = Array.from({ length: 95 }, (_, i) => mov(i + 1, i === 94 ? 4940 : 4965, String(1 + (i % 13)).padStart(2, '0')));
const aciAll = [mov(901, 1640, '03', { regione: 'Campania' }), mov(902, 2140, '07', { regione: 'Campania' }), mov(903, 3820, '11', { regione: 'Campania' })];
const extraAll = [mov(951, 460, '09', { id_ordine: 'EX951', prezzo_attivo_t: 202, sovracosto_raccolta: 120 })];
const fs = (tipologia, altro = {}) => ({
  id: 'fs-' + tipologia, gruppo: 'g-fs', nome: 'Fuel Surcharge', origine: 'CONSORZIO', riferimento: 'comunicazione Ecotyre',
  tipologia, prestazione: 'RACCOLTA', a_chi: 'tutti', euro_t_passiva: 5, euro_t_attiva: 5,
  data_inizio_validita: '2026-10-01', data_fine_validita: '2026-12-31', stato: 'attivo', ...altro,
});
const FUEL = [fs('RETE'), fs('ACI'), fs('EXTRA_RACCOLTA')];
const mese = (surplus) => calcolaRigheAttiva({ reteAll, aciAll, extraAll, fornitori: [], tariffe, anno: 2026, mese: 'Ottobre', surplus }).righe;
const CON = mese(FUEL);
const SENZA = mese([]);

verifica('i dati: la rete costruita fa 95 formulari, 471.650 kg, 95.273,30 € e la riga del Fuel Surcharge da 2.358,25 €',
  CON.RETE.length === 96 && CON.RETE.filter(eRigaSurplus).length === 1 && CON.RETE.find(eRigaSurplus).kg_riferimento === 471650 && CON.RETE.find(eRigaSurplus).totale === 2358.25
  && al2(SENZA.RETE.reduce((s, r) => s + r.totale, 0)) === 95273.3 && SENZA.RETE.reduce((s, r) => s + r.quantita, 0) === 471650,
  J(CON.RETE.filter(eRigaSurplus)));
verifica('...l\'ACI tre formulari (7.600 kg, 1.824,00 €) e 38,00 € di surplus; l\'extra raccolta un intervento e un sovracosto, e 2,30 €',
  CON.ACI.find(eRigaSurplus)?.totale === 38 && al2(SENZA.ACI.reduce((s, r) => s + r.totale, 0)) === 1824 && CON.EXTRA_RACCOLTA.find(eRigaSurplus)?.totale === 2.3 && SENZA.EXTRA_RACCOLTA.length === 2,
  J({ aci: CON.ACI.find(eRigaSurplus)?.totale, extra: CON.EXTRA_RACCOLTA.map(r => [r.descrizione, r.totale]) }));

console.log('1. LA TABELLA: I FORMULARI DI PRIMA, IL SURPLUS NELLA SUA RIGA');
{
  const r1 = tabellaAttiva('RETE', CON.RETE, 2026, 'Ottobre'), r0 = tabellaAttiva('RETE', SENZA.RETE, 2026, 'Ottobre');
  verifica('report attiva, rete: le righe sono i 95 formulari, quelle di senza surplus', uguali(r1.righe, r0.righe) && r1.righe.length === 95, `${r1.righe.length}`);
  verifica('...una riga di surplus: il nome sotto il Tipo, l\'origine sotto l\'Ordine, la validita\' sotto la Data, la base sotto il FIR, la Quantita\' vuota, 5 €/t e 2.358,25 €',
    r1.surplus.length === 1 && uguali(r1.surplus[0]?.celle, ['Ottobre 2026', 'Fuel Surcharge', 'consorzio Ecotyre', 'dal 01/10/2026 al 31/12/2026', '+5,00 €/t sulle 471,65 t del mese', '', null, 5, 2358.25]),
    J(r1.surplus.map(s => s.celle)));
  verifica('...il Totale formulari e\' il TOTALE di prima (95.273,30), il TOTALE lo comprende (97.631,55)',
    r1.totale_formulari === 95273.3 && r0.totale === 95273.3 && r1.totale === 97631.55 && r0.totale_formulari === 95273.3, J([r1.totale_formulari, r1.totale, r0.totale]));
  verifica('...la colonna Quantita\' somma i soli formulari: 471.650 kg, non il doppio',
    [...r1.righe, ...r1.surplus.map(s => s.celle)].reduce((s, r) => s + (Number(r[6]) || 0), 0) === 471650);
  verifica('...senza surplus nessuna riga in piu\' e le parole di prima', r0.surplus.length === 0 && r0.righe_a_parole === '95 righe' && r1.righe_a_parole === '95 righe e la riga del Fuel Surcharge', J([r0.righe_a_parole, r1.righe_a_parole]));

  const a1 = tabellaAttiva('ACI', CON.ACI, 2026, 'Ottobre');
  verifica('report attiva, ACI: SMOCO Srl, il nome sotto il Tipo, il ticket vuoto, l\'origine sotto l\'Ordine, le Note vuote',
    uguali(a1.surplus[0]?.celle, ['', 'SMOCO Srl', 'Ottobre 2026', 'Fuel Surcharge', '', 'consorzio Ecotyre', 'dal 01/10/2026 al 31/12/2026', '+5,00 €/t sulle 7,60 t del mese', '', null, 5, 38, '']) && a1.righe.length === 3 && a1.totale === 1862,
    J(a1.surplus.map(s => s.celle)));
  const x1 = tabellaAttiva('EXTRA_RACCOLTA', CON.EXTRA_RACCOLTA, 2026, 'Ottobre');
  verifica('report attiva, extra raccolta: il nome sotto l\'Ordine (il Tipo non c\'e\'), l\'origine nelle Note; intervento e sovracosto restano due righe',
    uguali(x1.surplus[0]?.celle, ['Ottobre 2026', 'Fuel Surcharge', 'dal 01/10/2026 al 31/12/2026', '+5,00 €/t sulle 0,46 t del mese', null, 5, 2.3, 'consorzio Ecotyre']) && x1.righe.length === 2 && x1.totale_formulari === 212.92 && x1.totale === 215.22,
    J({ s: x1.surplus.map(s => s.celle), n: x1.righe.length, t: [x1.totale_formulari, x1.totale] }));

  const m1 = tabellaAmministrazione('RETE', CON.RETE, 2026, 'Ottobre'), m0 = tabellaAmministrazione('RETE', SENZA.RETE, 2026, 'Ottobre');
  verifica('format, rete: i 95 formulari di prima, 471.650 kg; il surplus col prezzo AL CHILO (0,005) e 2.358,25 €',
    uguali(m1.righe, m0.righe) && m1.totale_kg === 471650 && uguali(m1.surplus[0]?.celle, ['2026 OTTOBRE', 'Fuel Surcharge', 'consorzio Ecotyre', 'dal 01/10/2026 al 31/12/2026', '+5,00 €/t sulle 471,65 t del mese', '', null, 0.005, 2358.25, '']),
    J(m1.surplus.map(s => s.celle)));
  verifica('...totale_euro comprende il surplus (97.631,55), totale_euro_formulari no (95.273,30, il totale di prima)',
    m1.totale_euro === 97631.55 && m1.totale_euro_formulari === 95273.3 && m0.totale_euro === 95273.3 && m0.surplus.length === 0, J([m1.totale_euro, m1.totale_euro_formulari, m0.totale_euro]));
  const ma = tabellaAmministrazione('ACI', CON.ACI, 2026, 'Ottobre');
  verifica('format, ACI: il prezzo a tonnellata, SMOCO Srl, e la colonna Note VUOTA anche sulla riga del surplus («la scrivo io a mano»)',
    uguali(ma.surplus[0]?.celle, ['', 'SMOCO Srl', '2026 Ottobre', 'Fuel Surcharge', 'consorzio Ecotyre', 'dal 01/10/2026 al 31/12/2026', '+5,00 €/t sulle 7,60 t del mese', '', null, 5, 38, '']) && ma.totale_kg === 7600 && ma.totale_euro === 1862,
    J(ma.surplus.map(s => s.celle)));
  verifica('in tutte e cinque le impaginazioni la riga del surplus ha tante celle quante le colonne, e la Quantita\' vuota sotto la colonna dei chili',
    [r1, a1, x1, m1, ma].every(t => t.surplus.length === 1 && t.surplus.every(s => s.celle.length === t.colonne.length && s.celle[t.colonne.findIndex(c => c.tipo === 'kg')] === null)),
    J([r1, a1, x1, m1, ma].map(t => [t.colonne.length, t.surplus.map(s => s.celle.length)])));
  // un surplus a 5,125 €/t: al chilo sei decimali, perche' l'importo dell'Excel e' una formula su quella cella
  const strano = tabellaAmministrazione('RETE', mese([fs('RETE', { euro_t_attiva: 5.125 })]).RETE, 2026, 'Ottobre');
  verifica('format, rete: 5,125 €/t si scrivono 0,005125 €/kg (con cinque decimali sarebbe 0,00513 e un altro importo)',
    strano.surplus[0]?.celle[7] === 0.005125 && strano.surplus[0]?.totale === 2417.21 && al2(471650 * 0.005125) === 2417.21, J(strano.surplus[0]?.celle));
  // una riga sospesa non si fattura: resta fuori dai formulari, come prima
  const sospesa = CON.RETE.map((r, i) => (i === 0 ? { ...r, sospesa: true } : r));
  const ts = tabellaAttiva('RETE', sospesa, 2026, 'Ottobre');
  verifica('una riga sospesa resta fuori, e il TOTALE e\' il Totale formulari piu\' il surplus', ts.righe.length === 94 && ts.totale === al2(ts.totale_formulari + 2358.25), J([ts.righe.length, ts.totale_formulari, ts.totale]));
}

console.log('2. L\'EXCEL DEL REPORT DELL\'ATTIVA');
{
  const { ws, wb, nome } = await excel(() => fatt.exportFatturazioneAttiva('RETE', CON.RETE, 2026, 'Ottobre', { stato: STATO }));
  const righe = righeDi(ws);
  verifica('il nome del file e\' quello di prima', nome === 'Fatturazione_RETE_Ottobre_2026.xlsx', nome);
  verifica('le intestazioni, i 95 formulari, la riga vuota, poi Totale formulari, il Fuel Surcharge e il TOTALE: 100 righe',
    righe.length === 100 && righe[96].every(v => v === null || v === undefined || v === '') && righe[97][7] === 'Totale formulari' && righe[98][1] === 'Fuel Surcharge' && righe[99][7] === 'TOTALE', `${righe.length} ${J(righe.slice(95))}`);
  verifica('...il Totale formulari 95.273,30, il surplus 2.358,25, il TOTALE 97.631,55, tutti sotto il Prezzo Totale',
    righe[97][8] === 95273.3 && righe[98][8] === 2358.25 && righe[99][8] === 97631.55, J(righe.slice(97).map(r => r[8])));
  verifica('...la riga del surplus coi suoi pezzi e la Quantita\' VUOTA',
    uguali(righe[98].slice(0, 6), ['Ottobre 2026', 'Fuel Surcharge', 'consorzio Ecotyre', 'dal 01/10/2026 al 31/12/2026', '+5,00 €/t sulle 471,65 t del mese', '']) && (righe[98][6] === null || righe[98][6] === undefined) && righe[98][7] === 5,
    J(righe[98]));
  const s = ws.getRow(99);
  verifica('...vestita come nella passiva: fondo indaco chiaro, testo indaco scuro in corsivo, barra a sinistra',
    s.getCell(2).fill?.fgColor?.argb === 'FFEEF2FF' && s.getCell(2).font?.italic === true && s.getCell(2).font?.color?.argb === 'FF3730A3' && s.getCell(1).border?.left?.style === 'thick' && s.getCell(1).border?.left?.color?.argb === 'FF6366F1',
    J({ fill: s.getCell(2).fill, font: s.getCell(2).font, border: s.getCell(1).border }));
  verifica('...i testi vanno a capo nella loro cella, e la riga e\' alta quanto serve (le colonne non si allargano)',
    s.getCell(4).alignment?.wrapText === true && s.getCell(5).alignment?.wrapText === true && s.height >= 28 && ws.getColumn(5).width === 18, J({ h: s.height, w: ws.getColumn(5).width }));
  verifica('...il Totale formulari in grassetto, il TOTALE con la sua veste', ws.getRow(98).getCell(8).font?.bold === true && ws.getRow(100).getCell(8).border?.top?.style === 'double');
  const note = testoNote(wb);
  verifica('il foglio Note dice la riga del surplus a parole',
    /95 righe dei formulari, il loro totale, la riga del surplus e il TOTALE/.test(note) && /Fuel Surcharge \(consorzio Ecotyre\), dal 01\/10\/2026 al 31\/12\/2026: una voce a sé, con la sua riga sotto il «Totale formulari»; \+5,00 €\/t sulle 471,65 t del mese, su 95 ordini, € 2\.358,25\. Sono le stesse tonnellate dei formulari, per questo la Quantità della riga è vuota; il TOTALE la comprende\./.test(note)
    && /95 righe e la riga del Fuel Surcharge {2}· {2}formulari € 95\.273,30/.test(note), note);

  const zero = await excel(() => fatt.exportFatturazioneAttiva('RETE', SENZA.RETE, 2026, 'Ottobre', { stato: STATO }));
  const r0 = righeDi(zero.ws);
  const note0 = testoNote(zero.wb);
  verifica('senza surplus il foglio di prima: intestazioni, 95 righe, la riga vuota e il TOTALE (98 righe), niente Totale formulari',
    r0.length === 98 && r0[97][7] === 'TOTALE' && r0[97][8] === 95273.3 && !r0.some(r => r.includes('Totale formulari')) && /: 95 righe e il totale sotto il Prezzo Totale\./.test(note0) && !/Fuel|surplus/.test(note0), `${r0.length} ${note0}`);

  const aci = righeDi((await excel(() => fatt.exportFatturazioneAttiva('ACI', CON.ACI, 2026, 'Ottobre', { stato: STATO }))).ws);
  verifica('ACI: Totale formulari 1.824,00, il surplus 38,00 con le Note vuote, il TOTALE 1.862,00, sotto il Prezzo Totale',
    aci.length === 8 && aci[5][10] === 'Totale formulari' && aci[5][11] === 1824 && aci[6][3] === 'Fuel Surcharge' && aci[6][11] === 38 && !aci[6][12] && aci[7][11] === 1862, J(aci.slice(4)));
  const ext = righeDi((await excel(() => fatt.exportFatturazioneAttiva('EXTRA_RACCOLTA', CON.EXTRA_RACCOLTA, 2026, 'Ottobre', { stato: STATO }))).ws);
  verifica('extra raccolta: intervento e sovracosto, Totale formulari 212,92, il surplus 2,30 con l\'origine nelle Note, il TOTALE 215,22',
    ext.length === 7 && ext[4][5] === 'Totale formulari' && ext[4][6] === 212.92 && ext[5][1] === 'Fuel Surcharge' && ext[5][7] === 'consorzio Ecotyre' && ext[5][6] === 2.3 && ext[6][6] === 215.22, J(ext.slice(3)));
}

console.log('3. L\'EXCEL DEL FORMAT: LE FORMULE, CALCOLATE');
{
  const { ws, nome } = await excel(() => amm.exportAmministrazioneAttiva('RETE', CON.RETE, 2026, 'Ottobre'));
  verifica('il nome del file e\' quello di prima', nome === 'Format_amministrazione_RETE_Ottobre_2026.xlsx', nome);
  verifica('il sottotitolo: «95 righe e la riga del Fuel Surcharge · 471.650 kg»', /^95 righe e la riga del Fuel Surcharge {2}· {2}471\.650 kg {2}· {2}commessa Ecotyre$/.test(String(ws.getRow(2).getCell(1).value)), String(ws.getRow(2).getCell(1).value));
  // righe 1-3 la testa, 4-98 i formulari, 99 il Totale formulari, 100 il surplus, 101 il TOTALE
  const sub = ws.getRow(99), sur = ws.getRow(100), tot = ws.getRow(101);
  verifica('sotto i formulari il Totale formulari, la riga del surplus e il TOTALE', sub.getCell(1).value === 'Totale formulari' && sur.getCell(2).value === 'Fuel Surcharge' && tot.getCell(1).value === 'TOTALE' && ws.rowCount === 101,
    J([sub.getCell(1).value, sur.getCell(2).value, tot.getCell(1).value, ws.rowCount]));
  verifica('Totale formulari: SUM(G4:G98) e SUM(I4:I98), i soli formulari', formula(sub.getCell(7)) === 'SUM(G4:G98)' && formula(sub.getCell(9)) === 'SUM(I4:I98)', J([formula(sub.getCell(7)), formula(sub.getCell(9))]));
  verifica('la riga del surplus: Quantita\' vuota, 0,005 €/kg, ROUND(471650*H100,2)',
    (sur.getCell(7).value === null || sur.getCell(7).value === undefined) && sur.getCell(8).value === 0.005 && formula(sur.getCell(9)) === 'ROUND(471650*H100,2)', J([sur.getCell(7).value, sur.getCell(8).value, formula(sur.getCell(9))]));
  verifica('il TOTALE: i chili SUM(G4:G98), gli euro SUM(I99:I100), cioe\' Totale formulari piu\' surplus',
    formula(tot.getCell(7)) === 'SUM(G4:G98)' && formula(tot.getCell(9)) === 'SUM(I99:I100)', J([formula(tot.getCell(7)), formula(tot.getCell(9))]));
  const kgTot = calcolaCella(ws, 'G101'), euroTot = calcolaCella(ws, 'I101'), euroSur = calcolaCella(ws, 'I100'), euroSub = calcolaCella(ws, 'I99');
  verifica('calcolate dal foglio: i chili del TOTALE sono 471.650, non 943.300: le tonnellate non si prendono due volte', kgTot === 471650, String(kgTot));
  verifica('...il surplus 2.358,25, il Totale formulari 95.273,30, il TOTALE 97.631,55: gli euro dei formulari una volta sola',
    al2(euroSur) === 2358.25 && al2(euroSub) === 95273.3 && al2(euroTot) === 97631.55, J([euroSur, euroSub, euroTot]));
  verifica('...e il foglio porta scritti gli stessi risultati', valore(tot.getCell(9).value) === 97631.55 && valore(sur.getCell(9).value) === 2358.25 && valore(sub.getCell(9).value) === 95273.3 && valore(tot.getCell(7).value) === 471650);
  verifica('la riga del surplus e\' vestita, il Totale formulari in grassetto',
    sur.getCell(2).fill?.fgColor?.argb === 'FFEEF2FF' && sur.getCell(2).font?.italic === true && sur.getCell(1).border?.left?.color?.argb === 'FF6366F1' && sub.getCell(1).font?.bold === true, J(sur.getCell(2).font));
  // il prezzo del surplus si corregge come quello dei formulari: l'importo si rifa' da solo
  sur.getCell(8).value = 0.006;
  verifica('un prezzo corretto nel foglio rifa\' l\'importo del surplus e il TOTALE (6 €/t: 2.829,90 e 98.103,20)',
    al2(calcolaCella(ws, 'I100')) === 2829.9 && al2(calcolaCella(ws, 'I101')) === 98103.2, J([calcolaCella(ws, 'I100'), calcolaCella(ws, 'I101')]));

  const aci = (await excel(() => amm.exportAmministrazioneAttiva('ACI', CON.ACI, 2026, 'Ottobre'))).ws;
  // righe 1-3 la testa, 4-6 i formulari, 7 il Totale formulari, 8 il surplus, 9 il TOTALE
  verifica('ACI: a tonnellata, ROUND(7600/1000*J8,2); i chili del TOTALE SUM(I4:I6), gli euro SUM(K7:K8)',
    formula(aci.getCell('K8')) === 'ROUND(7600/1000*J8,2)' && formula(aci.getCell('I9')) === 'SUM(I4:I6)' && formula(aci.getCell('K9')) === 'SUM(K7:K8)' && !aci.getCell('L8').value,
    J([formula(aci.getCell('K8')), formula(aci.getCell('I9')), formula(aci.getCell('K9')), aci.getCell('L8').value]));
  verifica('...calcolate: 7.600 kg, 38,00 € di surplus, 1.862,00 € in tutto',
    calcolaCella(aci, 'I9') === 7600 && al2(calcolaCella(aci, 'K8')) === 38 && al2(calcolaCella(aci, 'K9')) === 1862, J([calcolaCella(aci, 'I9'), calcolaCella(aci, 'K8'), calcolaCella(aci, 'K9')]));
  verifica('...e il sottotitolo coi chili all\'italiana anche sotto i diecimila: 7.600 kg (prima 7600)', /· {2}7\.600 kg {2}·/.test(String(aci.getRow(2).getCell(1).value)), String(aci.getRow(2).getCell(1).value));

  const zero = (await excel(() => amm.exportAmministrazioneAttiva('RETE', SENZA.RETE, 2026, 'Ottobre'))).ws;
  verifica('senza surplus il foglio di prima: i formulari e subito il TOTALE con SUM(G4:G98) e SUM(I4:I98), niente Totale formulari',
    zero.rowCount === 99 && zero.getRow(99).getCell(1).value === 'TOTALE' && formula(zero.getCell('G99')) === 'SUM(G4:G98)' && formula(zero.getCell('I99')) === 'SUM(I4:I98)' && !rigaCon(zero, 'Totale formulari')
    && /^95 righe {2}· {2}471\.650 kg {2}· {2}commessa Ecotyre$/.test(String(zero.getRow(2).getCell(1).value)),
    J([zero.rowCount, zero.getRow(99).getCell(1).value, String(zero.getRow(2).getCell(1).value)]));
}

console.log('4. I PDF: LA RIGA DEL SURPLUS INTERA, NEL SUO COLORE');
{
  // i colori del surplus nel PDF (esportaTabella): fondo indaco chiaro, testo indaco scuro
  const COLORE = /0\.93 0\.95 1\.? rg/, TESTO = /0\.216 0\.188 0\.639 rg/;
  const pezzi = ['Fuel Surcharge', 'consorzio Ecotyre', 'dal 01/10/2026 al 31/12/2026'];
  for (const [nome, fai, attesi] of [
    ['report attiva, rete', () => fatt.exportFatturazioneAttivaPdf('RETE', CON.RETE, 2026, 'Ottobre', { stato: STATO }), { base: '+5,00 €/t sulle 471,65 t del mese', importo: '2.358,25 €', totale: '97.631,55 €', sotto: '95 righe e la riga del Fuel Surcharge  ·  formulari € 95.273,30  ·  cliente Ecotyre', piede: '96 righe', sub: ['95.273,30 €'] }],
    ['report attiva, ACI', () => fatt.exportFatturazioneAttivaPdf('ACI', CON.ACI, 2026, 'Ottobre', { stato: STATO }), { base: '+5,00 €/t sulle 7,60 t del mese', importo: '38,00 €', totale: '1.862,00 €', sotto: '3 righe e la riga del Fuel Surcharge  ·  formulari € 1.824,00  ·  cliente Ecotyre', piede: '4 righe', sub: ['1.824,00 €'] }],
    ['report attiva, extra raccolta', () => fatt.exportFatturazioneAttivaPdf('EXTRA_RACCOLTA', CON.EXTRA_RACCOLTA, 2026, 'Ottobre', { stato: STATO }), { base: '+5,00 €/t sulle 0,46 t del mese', importo: '2,30 €', totale: '215,22 €', sotto: '2 righe e la riga del Fuel Surcharge  ·  formulari € 212,92  ·  cliente Ecotyre', piede: '3 righe', sub: ['212,92 €'] }],
    ['format, rete', () => amm.exportAmministrazioneAttivaPdf('RETE', CON.RETE, 2026, 'Ottobre'), { base: '+5,00 €/t sulle 471,65 t del mese', importo: '2.358,25 €', totale: '97.631,55 €', sotto: '95 righe e la riga del Fuel Surcharge  ·  471.650 kg  ·  formulari € 95.273,30', piede: '96 righe', prezzo: '0,005 €', kg: '471.650', sub: ['471.650', '95.273,30 €'] }],
    ['format, ACI', () => amm.exportAmministrazioneAttivaPdf('ACI', CON.ACI, 2026, 'Ottobre'), { base: '+5,00 €/t sulle 7,60 t del mese', importo: '38,00 €', totale: '1.862,00 €', sotto: '3 righe e la riga del Fuel Surcharge  ·  7.600 kg  ·  formulari € 1.824,00', piede: '4 righe', kg: '7.600', sub: ['7.600', '1.824,00 €'] }],
  ]) {
    const p = await pdf(fai);
    // le righe di una cella che va a capo sono scritte una dopo l'altra: unite, la cella e' intera
    verifica(`${nome}: la riga del surplus intera (${[...pezzi, attesi.base].join(' | ')})`,
      [...pezzi, attesi.base].every(t => p.testo.replace(/\s+/g, ' ').includes(t)), J(p.scritte.slice(-24)));
    verifica(`${nome}: l'importo del surplus ${attesi.importo} e il TOTALE ${attesi.totale}${attesi.kg ? `, coi chili dei soli formulari (${attesi.kg})` : ''}`,
      p.scritte.includes(attesi.importo) && p.scritte[p.scritte.indexOf('TOTALE') + (attesi.kg ? 2 : 1)] === attesi.totale && (!attesi.kg || p.scritte[p.scritte.indexOf('TOTALE') + 1] === attesi.kg) && (!attesi.prezzo || p.scritte.includes(attesi.prezzo)),
      J(p.scritte.slice(p.scritte.indexOf('TOTALE'), p.scritte.indexOf('TOTALE') + 3)));
    verifica(`${nome}: il sottotitolo col totale dei formulari, e il piede «${attesi.piede}»`, p.scritte.includes(attesi.sotto) && p.scritte.some(s => s === attesi.piede), J(p.scritte.filter(s => /righe/.test(s))));
    verifica(`${nome}: la riga nel colore del surplus, come nei fogli della passiva`, COLORE.test(p.flusso) && TESTO.test(p.flusso));
    // IL «TOTALE FORMULARI» HA LA SUA RIGA ANCHE NEL PDF (14/10/2026): sotto
    // l'ultimo formulario, sopra il surplus e il TOTALE, coi numeri dei soli
    // formulari (nel format anche i chili), come nell'Excel. Il piede resta
    // quello di prima: formulari e surplus, non la riga del totale.
    const iSub = p.scritte.indexOf('Totale formulari');
    const iTot = p.scritte.indexOf('TOTALE');
    const iUltimoFir = p.scritte.reduce((u, s, i) => (/^FIR\d+$/.test(s) ? i : u), -1);
    const iSurplus = p.scritte.indexOf(attesi.importo, iSub + 1);
    verifica(`${nome}: la riga «Totale formulari» (${attesi.sub.join(', ')}), una sola, dopo l'ultimo formulario e prima del surplus e del TOTALE`,
      iSub > 0 && p.scritte.filter(s => s === 'Totale formulari').length === 1 && uguali(p.scritte.slice(iSub + 1, iSub + 1 + attesi.sub.length), attesi.sub)
      && iUltimoFir > 0 && iUltimoFir < iSub && iSurplus > iSub && iSurplus < iTot,
      J({ iSub, iUltimoFir, iSurplus, iTot, dopo: p.scritte.slice(iSub, iSub + 4) }));
  }
  // senza surplus: niente colore del surplus, niente parole nuove, il sottotitolo di prima
  const p0 = await pdf(() => fatt.exportFatturazioneAttivaPdf('RETE', SENZA.RETE, 2026, 'Ottobre', { stato: STATO }));
  verifica('senza surplus il PDF del report di prima: «95 righe · cliente Ecotyre», niente Fuel Surcharge ne\' il suo colore',
    p0.scritte.includes('95 righe  ·  cliente Ecotyre') && !/Fuel|formulari €/.test(p0.testo) && !COLORE.test(p0.flusso) && p0.scritte.includes('95.273,30 €'), J(p0.scritte.filter(s => /righe/.test(s))));
  const m0 = await pdf(() => amm.exportAmministrazioneAttivaPdf('RETE', SENZA.RETE, 2026, 'Ottobre'));
  verifica('...e quello del format: «95 righe · 471.650 kg»', m0.scritte.includes('95 righe  ·  471.650 kg') && !/Fuel/.test(m0.testo) && !COLORE.test(m0.flusso), J(m0.scritte.filter(s => /righe/.test(s))));
  verifica('...e senza surplus nessuna riga «Totale formulari»: il TOTALE e\' gia\' quello dei formulari, piede «95 righe»',
    !p0.scritte.includes('Totale formulari') && !m0.scritte.includes('Totale formulari') && p0.scritte.includes('95 righe') && m0.scritte.includes('95 righe'),
    J([p0.scritte.filter(s => /Totale|righe/.test(s)), m0.scritte.filter(s => /Totale|righe/.test(s))]));
  // il caso piu' lungo: un accordo commerciale, a 12,50 €/t, su 1.120,245 t e su colonne strette
  const lunga = (tip) => [{ ...CON[tip].find(eRigaSurplus), tariffa_valore: 12.5, kg_riferimento: 1120245, totale: 14003.06, note: 'Bonus trasporti (accordo commerciale), dal 16/10/2026 al 31/12/2026, sulle stesse 1.120,245 t del mese', descrizione: 'Bonus trasporti' }];
  for (const [nome, fai] of [
    ['report attiva, ACI', () => fatt.exportFatturazioneAttivaPdf('ACI', [...SENZA.ACI, ...lunga('ACI')], 2026, 'Ottobre', { stato: STATO })],
    ['format, ACI', () => amm.exportAmministrazioneAttivaPdf('ACI', [...SENZA.ACI, ...lunga('ACI')], 2026, 'Ottobre')],
    ['report attiva, rete', () => fatt.exportFatturazioneAttivaPdf('RETE', [...SENZA.RETE, ...lunga('RETE')], 2026, 'Ottobre', { stato: STATO })],
  ]) {
    const p = await pdf(fai);
    verifica(`${nome}: anche la riga piu' lunga arriva intera (accordo commerciale, +12,50 €/t sulle 1.120,245 t)`,
      ['Bonus trasporti', 'accordo commerciale', 'dal 16/10/2026 al 31/12/2026', '+12,50 €/t sulle 1.120,245 t del mese'].every(t => p.testo.replace(/\s+/g, ' ').includes(t)), J(p.scritte.slice(-22)));
  }
}

console.log('4b. LE RIGHE DI TOTALE IN MEZZO ALLA TABELLA (subtotali di esportaTabellaPdf)');
{
  // L'opzione da sola, sulla macchina comune: dove si scrive, che cosa dice, e
  // che il piede non la conta. Anche a cavallo di una pagina e con un `dopo`
  // fuori misura.
  const colonne = [{ titolo: 'Voce', tipo: 'testo', valore: (r) => r[0] }, { titolo: 'Chili', tipo: 'kg', valore: (r) => r[1] }, { titolo: 'Importo', tipo: 'euro', valore: (r) => r[2] }];
  const tabella = (righe, subtotali, totali) => pdf(() => globalThis.__TABELLA.esportaTabellaPdf({ nomeFile: 'prova', titolo: 'Prova', colonne, righe, subtotali, totali, documento: { stato: STATO } }));
  const p = await tabella([['a', 1000, 10], ['b', 2000, 20], ['c', null, 5]], [{ dopo: 2, etichetta: 'Parziale', valori: { 1: 3000, 2: 30 } }], { etichetta: 'TOTALE', valori: { 1: 3000, 2: 35 } });
  const corpo = p.scritte.slice(p.scritte.indexOf('a'), p.scritte.indexOf('TOTALE') + 3);
  verifica('dopo le prime due righe, coi suoi numeri all\'italiana; poi la terza riga e il TOTALE',
    uguali(corpo, ['a', '1.000', '10,00 €', 'b', '2.000', '20,00 €', 'Parziale', '3.000', '30,00 €', 'c', '5,00 €', 'TOTALE', '3.000', '35,00 €']), J(corpo));
  verifica('il piede conta le righe della tabella, non il subtotale: «3 righe»', p.scritte.includes('3 righe') && !p.scritte.includes('4 righe'), J(p.scritte.filter(s => /righe/.test(s))));
  // a cavallo di pagina: 150 righe, il subtotale dopo la 100a
  const molte = Array.from({ length: 150 }, (_, i) => [`r${i + 1}`, 1000, 1]);
  const q = await tabella(molte, [{ dopo: 100, etichetta: 'Parziale', valori: { 2: 100 } }], { etichetta: 'TOTALE', valori: { 2: 150 } });
  const iParz = q.scritte.indexOf('Parziale');
  const pagine = q.scritte.filter(s => /Pagina \d+ di \d+/.test(s)).length;
  verifica('su piu\' pagine: il subtotale fra la riga 100 e la 101, una volta sola, e il piede «150 righe» su ogni pagina',
    iParz > q.scritte.indexOf('r100') && iParz < q.scritte.indexOf('r101') && q.scritte[iParz + 1] === '100,00 €' && q.scritte.filter(s => s === 'Parziale').length === 1
    && pagine > 1 && q.scritte.filter(s => s === '150 righe').length === pagine, J({ iParz, pagine, n: q.scritte.filter(s => s === '150 righe').length }));
  const r = await tabella([['a', 1, 1]], [{ dopo: 99, etichetta: 'In fondo', valori: { 2: 1 } }, { dopo: -3, etichetta: 'In cima', valori: {} }]);
  verifica('un `dopo` oltre la fine va in fondo, uno negativo in cima', r.scritte.indexOf('In cima') < r.scritte.indexOf('a') && r.scritte.indexOf('In fondo') > r.scritte.indexOf('a') && r.scritte.includes('1 riga'),
    J(r.scritte.slice(r.scritte.indexOf('In cima'), r.scritte.indexOf('In fondo') + 2)));
  const s = await tabella([['a', 1, 1]]);
  verifica('senza subtotali la tabella di prima', !/Parziale|In fondo|In cima/.test(s.testo) && s.scritte.includes('1 riga'));
  // in una prima colonna stretta l'etichetta si allarga sulle celle vuote che
  // la seguono, e non va a capo; una cella di dati lunga invece a capo ci va
  const strette = [{ titolo: 'Reg.', tipo: 'testo', peso: 0.2, valore: (x) => x[0] }, ...Array.from({ length: 10 }, (_, i) => ({ titolo: `C${i}`, tipo: 'testo', valore: () => '' })), { titolo: 'Importo', tipo: 'euro', valore: (x) => x[1] }];
  const n = await pdf(() => globalThis.__TABELLA.esportaTabellaPdf({ nomeFile: 'prova', titolo: 'Prova', colonne: strette, righe: [['Campania', 1]], subtotali: [{ dopo: 1, etichetta: 'Totale formulari', valori: { 11: 1 } }], documento: { stato: STATO } }));
  verifica('nella colonna stretta «Totale formulari» resta su una riga, «Campania» va a capo come prima',
    n.scritte.includes('Totale formulari') && !n.scritte.includes('Campania'), J(n.scritte.slice(n.scritte.indexOf('Importo'), n.scritte.indexOf('Importo') + 8)));
}

console.log('5. DUE RECORD DELLO STESSO SURPLUS: DUE RIGHE, DISTINTE');
{
  // 5 €/t fino al 06/10 e 7 €/t dal 07/10: due record, due righe
  const DUE = mese([fs('RETE', { id: 'fs-a', data_fine_validita: '2026-10-06' }), fs('RETE', { id: 'fs-b', euro_t_attiva: 7, data_inizio_validita: '2026-10-07' })]);
  const t = tabellaAttiva('RETE', DUE.RETE, 2026, 'Ottobre');
  const m = tabellaAmministrazione('RETE', DUE.RETE, 2026, 'Ottobre');
  const atteso = DUE.RETE.filter(eRigaSurplus).reduce((s, r) => s + Math.round(r.totale * 100), 0) / 100;
  verifica('due righe, distinte dalla validita\' e dalla base', t.surplus.length === 2 && t.surplus[0]?.celle[3] === 'dal 01/10/2026 al 06/10/2026' && /^\+5,00 €\/t sulle /.test(t.surplus[0]?.celle[4]) && t.surplus[1]?.celle[3] === 'dal 07/10/2026 al 31/12/2026' && /^\+7,00 €\/t sulle /.test(t.surplus[1]?.celle[4]),
    J(t.surplus.map(s => s.celle)));
  verifica('...le tonnellate delle due righe sono quelle del mese, divise, non due volte', t.surplus.reduce((s, x) => s + x.kg, 0) === 471650, J(t.surplus.map(s => s.kg)));
  verifica('...il TOTALE e\' il Totale formulari piu\' le due righe, al centesimo', t.totale === al2(95273.3 + atteso) && m.totale_euro === t.totale && t.righe_a_parole === '95 righe e 2 righe del Fuel Surcharge', J([t.totale, m.totale_euro, atteso, t.righe_a_parole]));
  const { ws } = await excel(() => amm.exportAmministrazioneAttiva('RETE', DUE.RETE, 2026, 'Ottobre'));
  verifica('...nel format il TOTALE somma il Totale formulari e le due righe: SUM(I99:I101), calcolato', formula(ws.getCell('I102')) === 'SUM(I99:I101)' && al2(calcolaCella(ws, 'I102')) === t.totale && calcolaCella(ws, 'G102') === 471650,
    J([formula(ws.getCell('I102')), calcolaCella(ws, 'I102'), calcolaCella(ws, 'G102')]));
}

console.log('6. I DATI VERI DELL\'11/10/2026');
{
  const CARTELLA = process.env.DATI_VERI || qui('../../dati-veri/');
  const copie = existsSync(CARTELLA) ? readdirSync(CARTELLA).filter(n => /^treadrider-dati-veri-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n)).sort() : [];
  if (!copie.length) {
    console.log('  copia dei dati veri assente: parte saltata');
  } else {
    const A = JSON.parse(gunzipSync(readFileSync(join(CARTELLA, copie[copie.length - 1]))).toString('utf8')).archivi;
    const vere = (m, surplus) => calcolaRigheAttiva({ reteAll: A.PrimariaRete, aciAll: A.PrimariaAci, extraAll: A.ExtraRaccolta, fornitori: A.Fornitore, tariffe: A.Tariffa.filter(t => t.direzione === 'ATTIVA'), anno: 2026, mese: m, surplus }).righe;
    const ott = vere('Ottobre', FUEL);
    const t = tabellaAttiva('RETE', ott.RETE, 2026, 'Ottobre');
    const m = tabellaAmministrazione('RETE', ott.RETE, 2026, 'Ottobre');
    verifica('ottobre fino all\'11/10: 113 formulari, 321.830 kg e il Fuel Surcharge da 1.609,15 € sulle 321,83 t',
      t.righe.length === 113 && m.totale_kg === 321830 && t.surplus.length === 1 && t.surplus[0]?.totale === 1609.15 && t.surplus[0]?.base === '+5,00 €/t sulle 321,83 t del mese',
      J({ n: t.righe.length, kg: m.totale_kg, s: t.surplus.map(s => [s.base, s.totale]) }));
    verifica('...il TOTALE e\' il Totale formulari piu\' 1.609,15, nei due report', t.totale === al2(t.totale_formulari + 1609.15) && m.totale_euro === t.totale && m.totale_euro_formulari === t.totale_formulari, J([t.totale_formulari, t.totale, m.totale_euro]));
    const { ws } = await excel(() => amm.exportAmministrazioneAttiva('RETE', ott.RETE, 2026, 'Ottobre'));
    const n = ws.rowCount;
    verifica('...e nel format, calcolato, i chili del TOTALE restano 321.830', calcolaCella(ws, `G${n}`) === 321830 && al2(calcolaCella(ws, `I${n}`)) === t.totale, J([calcolaCella(ws, `G${n}`), calcolaCella(ws, `I${n}`)]));
    // i PDF di ottobre vero (14/10/2026): la riga «Totale formulari» coi numeri
    // dei formulari, il surplus, il TOTALE, e il piede che conta 114 righe
    const eu = (v) => `${v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
    for (const [nome, fai, sub] of [
      ['report attiva', () => fatt.exportFatturazioneAttivaPdf('RETE', ott.RETE, 2026, 'Ottobre', { stato: STATO }), [eu(t.totale_formulari)]],
      ['format', () => amm.exportAmministrazioneAttivaPdf('RETE', ott.RETE, 2026, 'Ottobre'), ['321.830', eu(t.totale_formulari)]],
    ]) {
      const p = await pdf(fai);
      const i = p.scritte.indexOf('Totale formulari');
      const iTot = p.scritte.indexOf('TOTALE');
      verifica(`...e il PDF del ${nome} di ottobre: «Totale formulari» ${sub.join(' ')}, poi 1.609,15 € del Fuel Surcharge, poi il TOTALE ${eu(t.totale)}; piede «114 righe»`,
        i > 0 && uguali(p.scritte.slice(i + 1, i + 1 + sub.length), sub) && p.scritte.indexOf('1.609,15 €', i) > i && p.scritte.indexOf('1.609,15 €', i) < iTot
        && p.scritte.slice(iTot + 1, iTot + 3).includes(eu(t.totale)) && p.scritte.includes('114 righe'),
        J({ sub: p.scritte.slice(i, i + 3), tot: p.scritte.slice(iTot, iTot + 3), piede: p.scritte.filter(s => /righe$/.test(s)) }));
    }

    // settembre senza surplus: i numeri che l'utente ha verificato, e nessuna riga in piu'
    const set = vere('Settembre', []);
    const s1 = tabellaAttiva('RETE', set.RETE, 2026, 'Settembre'), sm = tabellaAmministrazione('RETE', set.RETE, 2026, 'Settembre');
    const sa = tabellaAmministrazione('ACI', set.ACI, 2026, 'Settembre');
    verifica('settembre senza surplus: 380 righe, 1.120.240 kg, 226.288,48 €; ACI 6 righe, 18.890 kg, 4.410,10 €; nessuna riga di surplus',
      s1.righe.length === 380 && s1.totale === 226288.48 && sm.totale_kg === 1120240 && sm.totale_euro === 226288.48 && sa.righe.length === 6 && sa.totale_kg === 18890 && sa.totale_euro === 4410.1 && !s1.surplus.length && !sm.surplus.length,
      J({ n: s1.righe.length, t: s1.totale, kg: sm.totale_kg, aci: [sa.righe.length, sa.totale_kg, sa.totale_euro] }));
    const zs = (await excel(() => amm.exportAmministrazioneAttiva('RETE', set.RETE, 2026, 'Settembre'))).ws;
    verifica('...e il foglio: 383 righe, il TOTALE subito sotto, 1.120.240 kg e 226.288,48 €', zs.rowCount === 384 && zs.getCell('A384').value === 'TOTALE' && valore(zs.getCell('G384').value) === 1120240 && valore(zs.getCell('I384').value) === 226288.48,
      J([zs.rowCount, zs.getCell('A384').value, valore(zs.getCell('G384').value), valore(zs.getCell('I384').value)]));
  }
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
