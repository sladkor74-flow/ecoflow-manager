// Prova del GIORNO DELLE DATE negli export di dettaglio (src/lib/esportaTabella.js).
//
// Chiusura dell'audit, 11/10/2026. Il file si faceva da se' la correzione del
// giorno italiano e la faceva solo per le 22:00 e le 23:00 tonde: un trasporto
// finito alle 23:30 UTC del 30 giugno - in Italia gia' il 1° luglio - usciva nel
// PDF e nell'Excel al 30 giugno, mentre il resto del gestionale lo conta a luglio.
// Ora la data passa da giornoRoma (src/lib/giornoItaliano.js), come ovunque.
// Si provano il PDF (il testo delle celle) e l'Excel (il valore della cella).
// npm run prove
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { caricaLibPagine } from './dati/libPagine.mjs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const radice = new URL('../', import.meta.url);
const jspdf = pathToFileURL(new URL('node_modules/jspdf/dist/jspdf.node.min.js', radice).pathname.replace(/^\/([A-Za-z]:)/, '$1')).href;
// Un foglio finto: serve solo a vedere che cosa finisce nelle celle.
const XLSX_FINTO = "({ utils: { aoa_to_sheet: (aoa) => { globalThis.__aoa = aoa; return { '!ref': 'A1:A1' }; }, decode_range: () => ({ e: { r: 0 } }), encode_cell: () => 'A1', encode_range: () => 'A1:A1', book_new: () => ({}), book_append_sheet: () => {} }, writeFile: () => {} })";
const { esportaTabellaPdf, esportaTabellaExcel } = await caricaLibPagine('lib/esportaTabella', [
  [/await import\('jspdf'\)/g, `await import('${jspdf}').then(m => m.default || m)`],
  [/await import\('xlsx'\)/g, XLSX_FINTO],
  [/doc\.save\(`\$\{nomeSicuro\(nomeFile\)\}\.pdf`\);/g, 'globalThis.__pdf = doc.output();'],
]);
// Il finto window serviva solo a caricare utils.js: jspdf, se lo trova, lo
// prende per un browser e cerca li' atob e btoa.
delete globalThis.window;

const colonne = [
  { titolo: 'Ordine', valore: r => r.ordine, tipo: 'testo' },
  { titolo: 'Fine trasporto', valore: r => r.fine, tipo: 'data' },
  { titolo: 'Peso (kg)', valore: r => r.kg, tipo: 'kg' },
];
const righe = [
  { ordine: 'ET-MEZZANOTTE-UTC', fine: '2026-07-10T00:00:00.000Z', kg: 1000 },
  { ordine: 'ET-MEZZANOTTE-ITALIANA', fine: '2026-07-10T22:00:00.000Z', kg: 1000 },  // in Italia e' l'11
  { ordine: 'ET-23-30', fine: '2026-06-30T23:30:00.000Z', kg: 1000 },               // in Italia e' il 1° luglio
  { ordine: 'ET-POMERIGGIO', fine: '2026-07-15T14:20:00.000Z', kg: 1000 },
  { ordine: 'ET-SENZA', fine: null, kg: 1000 },
];

console.log('IL PDF SCRIVE IL GIORNO ITALIANO');
await esportaTabellaPdf({ nomeFile: 'prova', intestazione: 'SMOCO S.r.l.', titolo: 'Prova', sottotitolo: 'date', colonne, righe });
const scritte = [...new Set((String(globalThis.__pdf || '').match(/\((?:\\.|[^()\\])*\)\s*Tj/g) || []).map(x => x.slice(1, x.lastIndexOf(')'))))];
const c_e = (t) => scritte.some(s => s === t || s.includes(t));
verifica('mezzanotte UTC: lo stesso giorno', c_e('10/07/2026'));
verifica('mezzanotte italiana (22:00 UTC): il giorno dopo', c_e('11/07/2026'));
verifica('le 23:30 UTC del 30 giugno: in Italia e\' il 1° luglio', c_e('01/07/2026') && !c_e('30/06/2026'), scritte.filter(s => /\/2026/.test(s)).join(' | '));
verifica('un\'ora qualunque del giorno: quel giorno', c_e('15/07/2026'));

console.log("L'EXCEL METTE NELLA CELLA LO STESSO GIORNO");
await esportaTabellaExcel({ nomeFile: 'prova', titolo: 'Prova', colonne, righe });
const aoa = globalThis.__aoa || [];
const giornoCella = (i) => { const v = (aoa[4 + i] || [])[1]; return v instanceof Date ? v.toISOString().slice(0, 10) : v; };
verifica('mezzanotte UTC', giornoCella(0) === '2026-07-10', String(giornoCella(0)));
verifica('mezzanotte italiana', giornoCella(1) === '2026-07-11', String(giornoCella(1)));
verifica('le 23:30 UTC del 30 giugno vanno al 1° luglio', giornoCella(2) === '2026-07-01', String(giornoCella(2)));
verifica('un\'ora qualunque del giorno', giornoCella(3) === '2026-07-15', String(giornoCella(3)));
verifica('senza data la cella resta vuota', giornoCella(4) === null, String(giornoCella(4)));

console.log('NESSUNA CORREZIONE DEL GIORNO FATTA A MANO');
const sorgente = readFileSync(new URL('src/lib/esportaTabella.js', radice), 'utf8').replace(/\r/g, '');
verifica('il file usa giornoRoma', /import \{ giornoRoma \} from '@\/lib\/giornoItaliano';/.test(sorgente));
verifica('e non guarda piu\' le ore UTC', !/getUTCHours/.test(sorgente));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
