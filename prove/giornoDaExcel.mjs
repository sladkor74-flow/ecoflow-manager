// Prova del giorno letto da una cella Excel nel browser (src/lib/evasioneAssegnati.js).
//
// Un giorno scritto in un foglio non ha un fuso, ma le due librerie che il
// gestionale usa non sono d'accordo su dove metterlo: exceljs - che legge gli
// .xlsx - di «14/07/2026» fa mezzanotte UTC; l'altra, che legge .xls, .ods e
// .csv, della stessa cella fa mezzanotte LOCALE. Prendendo sempre la parte UTC,
// come si faceva, i giorni della seconda strada tornavano indietro di un giorno,
// perche' dall'Italia siamo sempre avanti su UTC.
//
// Trovato il 01/10/2026 verificando le date dei consuntivi di settembre: nel
// file di NAPPI SUD la cella scritta «14-Jul» esce dalla libreria come
// 2026-07-13T22:00:00.000Z, e letta in UTC diventava il 13. Un giorno di scarto
// al confine del mese fa cambiare mese a un carico, e in un consuntivo di
// settembre un carico del 1 settembre letto 31 agosto diventa «riga di un altro
// mese»: esattamente la falsa difformita' che non si deve produrre.
//
// Il fuso si fissa prima di tutto il resto, altrimenti la stessa cella darebbe
// un giorno diverso su ogni macchina. npm run prove
process.env.TZ = 'Europe/Rome';
import { readFileSync } from 'node:fs';

// La libreria delle pagine importa gli alias @: qui si sostituiscono, come in
// reportSettimanali.mjs.
const sorgente = readFileSync(new URL('../src/lib/evasioneAssegnati.js', import.meta.url), 'utf8')
  .replace("import { formatTonnellate, dataServer } from '@/lib/utils';", 'const formatTonnellate = (x) => String(x); const dataServer = (x) => x;')
  .replace("import { giornoRoma } from '@/lib/giornoItaliano';", `import { giornoRoma } from ${JSON.stringify(new URL('../src/lib/giornoItaliano.js', import.meta.url).href)};`);
const { giornoDaExcel, valoreCella } = await import('data:text/javascript;base64,' + Buffer.from(sorgente).toString('base64'));

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

console.log('LO STESSO GIORNO DALLE DUE LIBRERIE');
// exceljs: mezzanotte UTC
const daExceljs = new Date(Date.UTC(2026, 6, 14));
// l'altra libreria: mezzanotte locale, cioe' le 22:00 UTC del 13
const daXlsx = new Date(2026, 6, 14);
verifica('la cella di exceljs e quella dell\'altra libreria sono diverse davvero',
  daExceljs.toISOString() === '2026-07-14T00:00:00.000Z' && daXlsx.toISOString() === '2026-07-13T22:00:00.000Z',
  `${daExceljs.toISOString()} / ${daXlsx.toISOString()}`);
verifica('e danno lo stesso giorno: il 14', giornoDaExcel(daExceljs) === '2026-07-14' && giornoDaExcel(daXlsx) === '2026-07-14',
  `${giornoDaExcel(daExceljs)} / ${giornoDaExcel(daXlsx)}`);

console.log('\nIL CONFINE DEL MESE, CHE E\' DOVE FA DANNO');
verifica('il 1 settembre non diventa il 31 agosto', giornoDaExcel(new Date(2026, 8, 1)) === '2026-09-01', giornoDaExcel(new Date(2026, 8, 1)));
verifica('il 1 gennaio non diventa il 31 dicembre dell\'anno prima', giornoDaExcel(new Date(2026, 0, 1)) === '2026-01-01', giornoDaExcel(new Date(2026, 0, 1)));
verifica('e in inverno, con un\'ora sola di scarto, lo stesso', giornoDaExcel(new Date(2026, 1, 1)) === '2026-02-01', giornoDaExcel(new Date(2026, 1, 1)));
verifica('il 31 agosto resta il 31 agosto', giornoDaExcel(new Date(2026, 7, 31)) === '2026-08-31');

console.log('\nUNA CELLA CON UN ORARIO VERO');
// Un orario non e' un giorno di calendario: si legge il giorno locale, che e'
// quello che si vede nel foglio.
verifica('una data con orario tiene il suo giorno', giornoDaExcel(new Date(2026, 6, 14, 10, 30)) === '2026-07-14', giornoDaExcel(new Date(2026, 6, 14, 10, 30)));

console.log('\nIL RESTO DELLE CELLE NON CAMBIA');
verifica('il testo resta testo', valoreCella('RGYTR027595LQ') === 'RGYTR027595LQ');
verifica('i numeri restano numeri', valoreCella(1680) === 1680 && valoreCella(0) === 0);
verifica('vuoto e niente restano null', valoreCella(null) === null && valoreCella(undefined) === null);
verifica('il testo ricco si concatena', valoreCella({ richText: [{ text: 'NAPPI ' }, { text: 'SUD' }] }) === 'NAPPI SUD');
verifica('una formula da\' il suo risultato', valoreCella({ result: 1680 }) === 1680);
verifica('e una formula che da\' una data passa dalla stessa regola',
  valoreCella({ result: new Date(2026, 8, 1) }) === '2026-09-01', valoreCella({ result: new Date(2026, 8, 1) }));
verifica('un link tiene il suo testo', valoreCella({ text: 'vedi' }) === 'vedi');
verifica('una cella che e\' una data passa dalla regola', valoreCella(new Date(2026, 6, 14)) === '2026-07-14');

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
