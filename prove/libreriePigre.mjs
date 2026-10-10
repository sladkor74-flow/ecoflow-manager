// Prova delle LIBRERIE PESANTI CHE SI CARICANO QUANDO SERVONO, 10/10/2026.
//
// xlsx (430 kB) e jspdf (384 kB) non vanno importati in testa a un file: si
// prendono dentro la funzione che li usa. Il pacchetto e' uno, quindi **basta un
// solo import statico per disfare il lavoro di tutti gli altri**: la libreria
// entra nel chunk principale e i venti `await import` degli altri file non
// servono piu' a niente. Fino al 10/10/2026 era cosi' - venti file pigri e
// dodici statici - e tutto quel peso si apriva con la prima pagina.
//
// Questa prova e' un presidio contro il ritorno silenzioso del difetto: un
// import statico aggiunto per comodita' non dara' nessun errore, non rompera'
// nessuna prova di logica, e il pacchetto tornera' grosso senza che nessuno se
// ne accorga. L'unico segnale sarebbe una riga fra i warning di build, e i
// warning di build si imparano a ignorare.
//
// NON prova che gli export funzionino: quelle funzioni scrivono file col
// browser (XLSX.writeFile, doc.save) e qui non c'e' un browser. Prova la forma:
// nessun import statico, la libreria presa dentro la funzione, la funzione
// asincrona, e - la trappola vera - l'await in tutti i chiamanti.
// npm run prove
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const radice = fileURLToPath(new URL('..', import.meta.url));

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// --- Tutti i sorgenti del browser ---
const sorgenti = [];
const gira = (dir) => {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { gira(p); continue; }
    if (/\.(js|jsx)$/.test(n)) sorgenti.push(p);
  }
};
gira(join(radice, 'src'));

/**
 * Gli import statici di un modulo pesante, in un sorgente.
 * Statico vuol dire in testa: `import ... from 'xlsx'`. Pigro vuol dire dentro
 * una funzione: `await import('xlsx')`.
 */
const importiStatici = (testo, modulo) => testo.split('\n')
  .map((r, i) => ({ r: r.trim(), n: i + 1 }))
  .filter(({ r }) => /^import\b/.test(r) && new RegExp(`from\\s*['"]${modulo.replace(/[/@.]/g, '\\$&')}['"]`).test(r));

const PESANTI = ['xlsx', 'jspdf', '@/lib/esportaTabella'];

console.log('NESSUN IMPORT STATICO DELLE LIBRERIE PESANTI');
for (const modulo of PESANTI) {
  const colpevoli = [];
  for (const p of sorgenti) {
    // Il file che DEFINISCE esportaTabella non importa se stesso.
    if (modulo === '@/lib/esportaTabella' && /esportaTabella\.js$/.test(p)) continue;
    const trovati = importiStatici(readFileSync(p, 'utf8'), modulo);
    if (trovati.length) colpevoli.push(`${relative(radice, p).replace(/\\/g, '/')}:${trovati[0].n}`);
  }
  verifica(`${modulo} non e' importato staticamente da nessuno`, colpevoli.length === 0, colpevoli.join(', '));
}

console.log('IL RILEVATORE FUNZIONA (altrimenti la prova sopra passa sempre)');
// Una prova che cerca qualcosa e non lo trova mai non prova niente: qui si
// controlla che saprebbe trovarlo.
verifica('riconosce un import statico', importiStatici("import * as XLSX from 'xlsx';", 'xlsx').length === 1);
verifica('riconosce anche le doppie virgolette', importiStatici('import { jsPDF } from "jspdf";', 'jspdf').length === 1);
verifica('riconosce un import con alias di percorso', importiStatici("import { x } from '@/lib/esportaTabella';", '@/lib/esportaTabella').length === 1);
verifica('NON confonde un import pigro con uno statico', importiStatici("  const XLSX = await import('xlsx');", 'xlsx').length === 0);
verifica('NON si fa ingannare da un nome che contiene il modulo', importiStatici("import x from 'xlsx-style';", 'xlsx').length === 0);
verifica('NON si fa ingannare da un commento', importiStatici("// import * as XLSX from 'xlsx';", 'xlsx').length === 0);

console.log('CHI USA LA LIBRERIA SE LA PRENDE DENTRO LA FUNZIONE');
// Tre modi legittimi di avere la libreria senza importarla in testa, e la prima
// versione di questa prova li segnalava tutti e tre come difetti:
//   - `await import('xlsx')` dentro la funzione, il modo normale;
//   - un caricatore pigro del file, `const xlsx = () => import('xlsx')`
//     (lib/fileEcoTyna.js);
//   - RICEVERLA COME PARAMETRO, che e' il modo migliore: lib/formatoExcel.js e
//     lib/fogliDiCalcolo.js non la conoscono affatto, se la fa passare chi l'ha
//     caricata. Un modulo di sola logica non deve portarsi dietro mezzo
//     megabyte per formattare delle celle.
const pigroDentro = (t, modulo) => new RegExp(`import\\(['"]${modulo}['"]\\)`).test(t);
const arrivaDaFuori = (t, nome) => new RegExp(`function [A-Za-z0-9_]+\\([^)]*\\b${nome}\\b`).test(t);
for (const p of sorgenti) {
  const t = readFileSync(p, 'utf8');
  const nome = relative(radice, p).replace(/\\/g, '/');
  if (/\bXLSX\./.test(t) && !arrivaDaFuori(t, 'XLSX')) {
    verifica(`${nome} usa XLSX e lo carica pigro`, pigroDentro(t, 'xlsx'));
  }
  if (/new jsPDF\(/.test(t) && !arrivaDaFuori(t, 'jsPDF')) {
    verifica(`${nome} usa jsPDF e lo carica pigro`, pigroDentro(t, 'jspdf'));
  }
}
verifica('il rilevatore accetta la libreria ricevuta come parametro',
  arrivaDaFuori('export function formattaPesi(XLSX, ws) {', 'XLSX') === true);
verifica('e accetta il caricatore pigro del file',
  pigroDentro("const xlsx = () => import('xlsx');", 'xlsx') === true);
verifica('ma non accetta il nulla',
  pigroDentro('const wb = XLSX.utils.book_new();', 'xlsx') === false);

console.log('LE FUNZIONI CONVERTITE SONO ASINCRONE');
// Se una resta sincrona, dentro non puo' esserci un await: il file non
// compilerebbe. Ma puo' succedere il contrario - che qualcuno la riscriva
// sincrona rimettendo l'import statico - e allora il controllo sopra lo prende.
// Qui si fissa la firma, perche' i chiamanti ci contano.
const CONVERTITE = [
  ['src/lib/andamentoRaccoglitoriExport.js', 'scaricaExcelAndamento'],
  ['src/lib/consuntivoFornitoreFile.js', 'scaricaExcelConsuntivo'],
  ['src/lib/giacenzeDaDichiarareExport.js', 'exportDaDichiarareExcel'],
  ['src/lib/giacenzeExportAll.js', 'exportGiacenzeAllExcel'],
  ['src/lib/passivaExport.js', 'exportFatturazionePassiva'],
  ['src/lib/reportConferimentiExport.js', 'scaricaExcelConferimenti'],
  ['src/lib/fatturazioneExport.js', 'exportFatturazioneAttiva'],
  ['src/lib/extraRaccoltaExport.js', 'exportExtraRaccoltaExcel'],
  ['src/lib/extraRaccoltaExport.js', 'exportExtraRaccoltaPDF'],
  ['src/lib/reportSettimanaleExport.js', 'esportaReportSettimanalePdf'],
];
for (const [file, fn] of CONVERTITE) {
  const t = readFileSync(join(radice, file), 'utf8');
  verifica(`${fn} e' asincrona`, new RegExp(`export async function ${fn}\\b`).test(t),
    (t.match(new RegExp(`export (async )?function ${fn}\\b`)) || ['non trovata'])[0]);
}

console.log('E I CHIAMANTI ASPETTANO: E\' LA TRAPPOLA VERA');
// Un try/catch SINCRONO non prende l'errore di una funzione asincrona. Due
// chiamanti erano cosi' (PassivaModulo, ReportSettimanale): l'esportazione
// avrebbe fallito senza dire niente, che e' il modo peggiore di fallire. E in
// AttivaEsportazioni il nome del file si registra nello storico subito dopo
// averlo scritto: senza await la registrazione partiva prima del file.
const chiamateSenzaAwait = (fn) => {
  const fuori = [];
  for (const p of sorgenti) {
    const t = readFileSync(p, 'utf8');
    t.split('\n').forEach((r, i) => {
      // La definizione, l'import e i commenti non sono chiamate.
      if (/^\s*(\*|\/\/)/.test(r) || /^\s*(export )?(async )?function /.test(r) || /^\s*import\b/.test(r)) return;
      const idx = r.indexOf(fn + '(');
      if (idx < 0) return;
      const prima = r.slice(0, idx);
      if (/\bawait\s*$/.test(prima)) return;
      fuori.push(`${relative(radice, p).replace(/\\/g, '/')}:${i + 1}`);
    });
  }
  return fuori;
};
for (const [, fn] of CONVERTITE) {
  const senza = chiamateSenzaAwait(fn);
  verifica(`${fn} e' sempre attesa`, senza.length === 0, senza.join(', '));
}

console.log('IL CONTROLLO DEI CHIAMANTI FUNZIONA');
verifica('una chiamata senza await si trova', chiamateSenzaAwait('esportaReportSettimanalePdf').length === 0
  && chiamateSenzaAwait('useState').length > 0, 'useState dovrebbe comparire senza await');

console.log(`\n${ok} verifiche passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
