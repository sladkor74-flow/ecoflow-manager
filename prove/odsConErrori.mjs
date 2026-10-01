// Prova dell'apertura di un .ods con celle in errore (src/lib/fogliDiCalcolo.js).
//
// Il 01/10/2026 l'utente ha chiesto perche' dovesse convertire a mano in .xlsx
// il report .ods di Green Tyre Project. Guardando dentro il file: non e' il
// formato - otto .ods su undici si leggono cosi' come sono - sono le celle con
// `office:value-type="error"`, per cui il lettore rifiuta TUTTO il file. E
// quelle celle sono i controlli dell'utente stesso: formule `=G29-N29` che
// puntano al file di gestione e danno #VALORE!.
//
// Qui si costruisce un .ods finto con dentro una di quelle celle e si prova che:
// il lettore da solo si rifiuta, leggiCartella lo apre leggendo quella cella
// come testo, e lo DICE. npm run prove
import { zipSync, strToU8 } from 'fflate';
import { leggiCartella } from '../src/lib/fogliDiCalcolo.js';

const XLSX = await import('xlsx');

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const NS = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"'
  + ' xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"'
  + ' xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"';
const cella = (tipo, valore, testo) => `<table:table-cell office:value-type="${tipo}"${valore}><text:p>${testo}</text:p></table:table-cell>`;
const riga = (...celle) => `<table:table-row>${celle.join('')}</table:table-row>`;
const contenuto = (conErrore) => `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content ${NS} office:version="1.2"><office:body><office:spreadsheet>
<table:table table:name="ORDINI">
${riga(cella('string', '', 'N. Formulario'), cella('string', '', 'Kg'), cella('string', '', 'Controllo'))}
${riga(cella('string', '', 'PHHYQ002763NH'), cella('float', ' office:value="1880"', '1880'),
    conErrore
      ? '<table:table-cell office:value-type="error" office:string-value="#VALUE!" table:formula="of:=[.G29]-[.N29]"><text:p>#VALORE!</text:p></table:table-cell>'
      : cella('float', ' office:value="0"', '0'))}
${riga(cella('string', '', 'PHHYQ002764HW'), cella('float', ' office:value="2200"', '2200'), cella('float', ' office:value="0"', '0'))}
</table:table>
</office:spreadsheet></office:body></office:document-content>`;
// Il lettore riconosce un .ods dal manifest: senza quello non arriva nemmeno a
// guardare le celle (lo cerca in parse_zip).
const MANIFEST = '<?xml version="1.0"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">'
  + '<manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.spreadsheet"/></manifest:manifest>';
const ods = (conErrore) => zipSync({
  mimetype: strToU8('application/vnd.oasis.opendocument.spreadsheet'),
  'META-INF/manifest.xml': strToU8(MANIFEST),
  'content.xml': strToU8(contenuto(conErrore)),
});

console.log('UN .ODS CON UNA CELLA IN ERRORE');
const rotto = ods(true);
let errore = '';
try { XLSX.read(rotto, { type: 'array' }); } catch (e) { errore = String(e.message); }
verifica('la libreria da sola rifiuta tutto il file', /unsupported value type/i.test(errore), errore || 'nessun errore');

const { wb, nota } = leggiCartella(XLSX, rotto, { cellDates: true });
const righe = XLSX.utils.sheet_to_json(wb.Sheets.ORDINI, { header: 1, raw: true, blankrows: true, defval: '' });
verifica('leggiCartella lo apre', !!wb && wb.SheetNames.join() === 'ORDINI', JSON.stringify(wb && wb.SheetNames));
verifica('e legge tutte le righe, coi pesi giusti', righe.length === 3 && righe[1][0] === 'PHHYQ002763NH' && righe[1][1] === 1880
  && righe[2][0] === 'PHHYQ002764HW' && righe[2][1] === 2200, JSON.stringify(righe));
// Diventa la scritta dell'errore (il lettore prende office:string-value, in
// inglese): l'importante e' che sia testo e non un numero, cosi' nessun conto la
// prende per un peso.
verifica('la cella in errore diventa testo, non un numero', typeof righe[1][2] === 'string' && righe[1][2].startsWith('#'), JSON.stringify(righe[1]));
verifica('e lo dice, con quante erano', /una cella in errore/.test(nota) && /non si apriva affatto/.test(nota), nota);

console.log('\nQUELLO CHE SI APRE DA SOLO NON SI TOCCA');
const sano = ods(false);
const esito = leggiCartella(XLSX, sano, { cellDates: true });
verifica('un file sano si apre e non c\'e\' niente da dire', esito.nota === '' && esito.wb.SheetNames.join() === 'ORDINI', esito.nota);
// Lo stesso per un .xlsx, che e' la strada di tutti i giorni.
const cartella = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(cartella, XLSX.utils.aoa_to_sheet([['Kg'], [1880]]), 'Foglio');
const xlsx = XLSX.write(cartella, { type: 'array', bookType: 'xlsx' });
verifica('un .xlsx passa senza note', leggiCartella(XLSX, xlsx, {}).nota === '');

console.log('\nUN GUASTO DIVERSO RESTA UN GUASTO');
// Si ripara SOLO quel guasto. Un file compresso che non e' un foglio di calcolo
// da' il suo errore, non passa dalla riparazione e non diventa leggibile per
// magia: la riparazione guarda il messaggio, e se non e' quello rilancia.
const nonFoglio = zipSync({ 'qualcosa.txt': strToU8('non sono un foglio di calcolo') });
let riferito = '';
try { leggiCartella(XLSX, nonFoglio, {}); } catch (e) { riferito = String(e.message); }
verifica('un file che non e\' un foglio di calcolo da\' il suo errore', !!riferito && !/unsupported value type/i.test(riferito), riferito);
// Un .ods senza celle in errore ma guasto altrove: il messaggio e' un altro,
// quindi non si tocca.
const altro = zipSync({
  mimetype: strToU8('application/vnd.oasis.opendocument.spreadsheet'),
  'META-INF/manifest.xml': strToU8(MANIFEST),
  'content.xml': strToU8('<?xml version="1.0"?><niente'),
});
// Il lettore e' indulgente e di un XML storto non si lamenta: torna una
// cartella vuota. L'importante e' che la riparazione non si dichiari mai se non
// e' avvenuta, perche' quella nota la legge l'utente.
const esitoAltro = leggiCartella(XLSX, altro, {});
verifica('e di un .ods guasto in altro modo non dice di aver riparato niente', esitoAltro.nota === '', esitoAltro.nota);

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
