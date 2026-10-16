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
// Dal 16/10/2026 (difetto 9) lo dice chi legge: giornoDaExcel(d, ingenua) e
// valoreCella(v, ingenua), con ingenua vero per exceljs, che scrive l'ora del
// foglio con le cifre UTC, e falso per l'altra libreria, che la scrive con le
// cifre locali. La regola di prima guardava se la cella era a mezzanotte UTC:
// reggeva sui giorni senza ora, non su una cella con l'ora. «01/10/2025 22:07»
// letta da exceljs non e' mezzanotte, e le cifre locali dicevano il 2 ottobre:
// sei celle vere delle liste (SMOCO.xlsx, foglio BARI, riga 2, e cinque in
// assegnati.xlsx), che finivano al giorno dopo.
//
// Il fuso si fissa prima di tutto il resto, altrimenti la stessa cella darebbe
// un giorno diverso su ogni macchina. npm run prove
process.env.TZ = 'Europe/Rome';
import { caricaLibPagine } from './dati/libPagine.mjs';

// Le due librerie si caricano dai file: un modulo caricato da un indirizzo data:
// non risolve un import per nome.
const MODULI = new URL('../node_modules/', import.meta.url).href;
const { giornoDaExcel, valoreCella, leggiFogliLista } = await caricaLibPagine('lib/evasioneAssegnati', [
  ["import('exceljs')", `import('${MODULI}exceljs/dist/es5/exceljs.nodejs.js')`],
  ["import('xlsx')", `import('${MODULI}xlsx/xlsx.mjs')`],
]);
const XLSX = await import(MODULI + 'xlsx/xlsx.mjs');

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
verifica('e danno lo stesso giorno: il 14', giornoDaExcel(daExceljs, true) === '2026-07-14' && giornoDaExcel(daXlsx, false) === '2026-07-14',
  `${giornoDaExcel(daExceljs, true)} / ${giornoDaExcel(daXlsx, false)}`);

console.log('\nIL CONFINE DEL MESE, CHE E\' DOVE FA DANNO');
verifica('il 1 settembre non diventa il 31 agosto', giornoDaExcel(new Date(2026, 8, 1)) === '2026-09-01', giornoDaExcel(new Date(2026, 8, 1)));
verifica('il 1 gennaio non diventa il 31 dicembre dell\'anno prima', giornoDaExcel(new Date(2026, 0, 1)) === '2026-01-01', giornoDaExcel(new Date(2026, 0, 1)));
verifica('e in inverno, con un\'ora sola di scarto, lo stesso', giornoDaExcel(new Date(2026, 1, 1)) === '2026-02-01', giornoDaExcel(new Date(2026, 1, 1)));
verifica('il 31 agosto resta il 31 agosto', giornoDaExcel(new Date(2026, 7, 31)) === '2026-08-31');

console.log('\nUNA CELLA CON UN ORARIO VERO');
// Un orario non e' un giorno di calendario: si legge il giorno locale, che e'
// quello che si vede nel foglio.
verifica('una data con orario tiene il suo giorno', giornoDaExcel(new Date(2026, 6, 14, 10, 30)) === '2026-07-14', giornoDaExcel(new Date(2026, 6, 14, 10, 30)));

// La cella vera: SMOCO.xlsx, foglio BARI, riga 2, «01/10/2025 22:07». exceljs la
// da' come le 22:07 UTC; in Italia sono gia' le 00:07 del 2 ottobre, e prima la
// lista la leggeva cosi'.
const tardiExceljs = new Date(Date.UTC(2025, 9, 1, 22, 7, 29));
verifica("la cella delle 22:07 letta da exceljs resta il 1 ottobre", giornoDaExcel(tardiExceljs, true) === '2025-10-01', giornoDaExcel(tardiExceljs, true));
verifica("e la stessa cella dall'altra libreria, con le cifre locali, anche", giornoDaExcel(new Date(2025, 9, 1, 22, 7, 29), false) === '2025-10-01', giornoDaExcel(new Date(2025, 9, 1, 22, 7, 29), false));
verifica("d'inverno, alle 23:10, lo stesso", giornoDaExcel(new Date(Date.UTC(2026, 1, 12, 23, 10, 24)), true) === '2026-02-12' && giornoDaExcel(new Date(2026, 1, 12, 23, 10, 24), false) === '2026-02-12');
// Un Date costruito da un seriale puo' perdere un millesimo: si arrotonda al secondo.
verifica('un millesimo perso non sposta il giorno', giornoDaExcel(new Date(Date.UTC(2026, 6, 13, 23, 59, 59, 999)), true) === '2026-07-14' && giornoDaExcel(new Date(2026, 6, 13, 23, 59, 59, 999), false) === '2026-07-14');

console.log('\nIL RESTO DELLE CELLE NON CAMBIA');
verifica('il testo resta testo', valoreCella('RGYTR027595LQ') === 'RGYTR027595LQ');
verifica('i numeri restano numeri', valoreCella(1680) === 1680 && valoreCella(0) === 0);
verifica('vuoto e niente restano null', valoreCella(null) === null && valoreCella(undefined) === null);
verifica('il testo ricco si concatena', valoreCella({ richText: [{ text: 'NAPPI ' }, { text: 'SUD' }] }) === 'NAPPI SUD');
verifica('una formula da\' il suo risultato', valoreCella({ result: 1680 }) === 1680);
verifica('e una formula che da\' una data passa dalla stessa regola',
  valoreCella({ result: new Date(2026, 8, 1) }, false) === '2026-09-01' && valoreCella({ result: new Date(Date.UTC(2025, 9, 1, 22, 7)) }, true) === '2025-10-01',
  `${valoreCella({ result: new Date(2026, 8, 1) }, false)} / ${valoreCella({ result: new Date(Date.UTC(2025, 9, 1, 22, 7)) }, true)}`);
verifica('un link tiene il suo testo', valoreCella({ text: 'vedi' }) === 'vedi');
verifica('una cella che e\' una data passa dalla regola', valoreCella(new Date(2026, 6, 14), false) === '2026-07-14' && valoreCella(new Date(Date.UTC(2025, 9, 1, 22, 7)), true) === '2025-10-01');
// Con .map(valoreCella) l'indice della colonna entrerebbe come ingenua: dalla
// seconda colonna in poi una cella dell'altra libreria si leggerebbe con le
// cifre UTC, cioe' in Italia il giorno prima per una data a mezzanotte.
const mezzanotteLocale = new Date(2026, 8, 1);
verifica("l'indice di .map non entra in valoreCella", JSON.stringify([mezzanotteLocale, mezzanotteLocale, mezzanotteLocale].map(valoreCella)) === JSON.stringify(['2026-09-01', '2026-09-01', '2026-09-01']),
  JSON.stringify([mezzanotteLocale, mezzanotteLocale, mezzanotteLocale].map(valoreCella)));

// ---------------------------------------------------------------------------
console.log('\nLA LISTA VERA, DALLE DUE STRADE');
// Un foglio con la cella delle 22:07, scritto come .xlsx (exceljs) e come .xls
// (l'altra libreria, con cellDates): la lista deve dire il 1 ottobre tutte e due
// le volte, nella colonna dove sta.
const seriale = 45931 + (22 * 60 + 7) / 1440; // 01/10/2025 22:07
const foglio = XLSX.utils.aoa_to_sheet([['Ordine', 'Immesso', 'Note'], ['ET25000001', seriale, 'x']]);
foglio.B2.z = 'dd/mm/yyyy hh:mm';
const cartella = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(cartella, foglio, 'BARI');
for (const [estensione, bookType] of [['xlsx', 'xlsx'], ['xls', 'biff8']]) {
  const dati = XLSX.write(cartella, { type: 'array', bookType });
  const letta = await leggiFogliLista([{ name: 'lista.' + estensione, arrayBuffer: async () => dati }]);
  const riga = letta.fogli[0] && letta.fogli[0].righe.find(r => r.c[0] === 'ET25000001');
  verifica(`.${estensione}: la cella delle 22:07 e' il 1 ottobre`, !!riga && riga.c[1] === '2025-10-01' && riga.c[2] === 'x', JSON.stringify(riga));
}


console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
