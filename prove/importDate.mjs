// Prova delle date obbligatorie in importazione: immissione, inizio e fine
// trasporto devono entrare in archivio da qualunque forma esca l'export del
// portale. Due buchi che oggi non si vedono ma scattano al primo file
// esportato in modo diverso:
//   - il foglio si legge con cellDates, che restituisce un oggetto Date solo
//     per le celle con formato data: una colonna esportata come testo
//     ("13/09/2026") o come numero generico (seriale 46278,54) finiva in
//     archivio come stringa, e le tre date risultavano mancanti su tutte le
//     righe del caricamento;
//   - un'intestazione con uno spazio in coda passa il controllo della firma
//     (che normalizza) ma non veniva letta (la mappa cercava il nome esatto).
// Qui si costruisce un file Excel finto con tutti e tre i casi e lo si fa
// importare davvero, dalle due strade: lato server (importEcotyreFile) e a
// blocchi dal browser (importaBlocco). Le funzioni importano l'SDK da npm:
// come in predittivitaFunzioni.mjs si impacchettano con esbuild e un SDK finto
// che tiene gli archivi in memoria. npm run prove
// Le funzioni girano su un server a UTC, e i seriali Excel sono orari da
// calendario, senza fuso: qui si fissa lo stesso fuso del server, altrimenti la
// stessa cella darebbe un orario diverso su ogni macchina.
process.env.TZ = 'UTC';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dataPrimaria, DATE_PRIMARIE } from '../base44/shared/primarie.ts';
import { mappaColonne, checkSignature, FILE_SIGNATURES } from '../base44/shared/fileSignatures.ts';
import { SHEET_MAP } from '../base44/shared/excelSchemas.ts';

// xlsx fissa il suo riferimento delle date quando viene caricato: si carica
// dopo il fuso, altrimenti i seriali del file finto escono spostati di un'ora.
const XLSX = await import('xlsx');

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// ---------------------------------------------------------------------------
console.log('LA DATA, DA QUALUNQUE FORMA ESCA');

// 46278,54 = 13/09/2026 alle 12:57:36; il portale registra al secondo
verifica('seriale Excel come numero', dataPrimaria(46278.54) === '2026-09-13T12:57:36.000Z', String(dataPrimaria(46278.54)));
verifica('seriale Excel come testo, anche con la virgola', dataPrimaria('46278,54') === '2026-09-13T12:57:36.000Z' && dataPrimaria('46278.54') === '2026-09-13T12:57:36.000Z');
verifica('testo italiano, con e senza orario', dataPrimaria('13/09/2026') === '2026-09-13T00:00:00.000Z' && dataPrimaria('13/09/2026 12:57:36') === '2026-09-13T12:57:36.000Z' && dataPrimaria('13-09-2026 12:57') === '2026-09-13T12:57:00.000Z');
verifica('oggetto Date e testo ISO restano quelli', dataPrimaria(new Date('2026-09-13T12:57:36Z')) === '2026-09-13T12:57:36.000Z' && dataPrimaria('2026-09-13T12:57:36Z') === '2026-09-13T12:57:36.000Z');
verifica('cella vuota: nessuna data', dataPrimaria('') === null && dataPrimaria(null) === null && dataPrimaria(undefined) === null && dataPrimaria('   ') === null);
verifica('mese fuori scala: nessuna data inventata', dataPrimaria('09/13/2026') === null && dataPrimaria('32/01/2026') === null && dataPrimaria('non una data') === null && dataPrimaria(new Date('x')) === null);
verifica('le quattro colonne con una data', [...DATE_PRIMARIE].join(',') === 'ordine_immesso_il,trasporto_iniziato_il,trasporto_finito_il,ordine_chiuso_il');

// ---------------------------------------------------------------------------
console.log('INTESTAZIONI: LA LETTURA TOLLERANTE QUANTO IL CONTROLLO');

const colProva = { 'ID': 'id_ordine', 'Trasporto_finito_il': 'trasporto_finito_il', 'Peso_effettivo': 'peso_effettivo' };
const risolta = mappaColonne(colProva, ['ID', 'Trasporto_finito_il ', 'PESO_EFFETTIVO']);
verifica('spazio in coda e maiuscole: la colonna si trova lo stesso', risolta['Trasporto_finito_il '] === 'trasporto_finito_il' && risolta['PESO_EFFETTIVO'] === 'peso_effettivo', JSON.stringify(risolta));
verifica('una colonna che nel file non c\'e\' resta col suo nome', mappaColonne(colProva, ['ID'])['Trasporto_finito_il'] === 'trasporto_finito_il');
verifica('nessuna intestazione: la mappa non cambia', JSON.stringify(mappaColonne(colProva, [])) === JSON.stringify(colProva) && JSON.stringify(mappaColonne(colProva, null)) === JSON.stringify(colProva));

// Cio' che la firma accetta, la mappatura lo deve leggere: stesse intestazioni,
// tutte con uno spazio in coda.
const colonnePrimarie = Object.keys(SHEET_MAP.primarie.columns);
const conSpazio = colonnePrimarie.map(c => c + ' ');
verifica('la firma accetta le intestazioni con lo spazio in coda', checkSignature(conSpazio, FILE_SIGNATURES.primarie).match);
const risoltaTutte = mappaColonne(SHEET_MAP.primarie.columns, conSpazio);
const nonLette = colonnePrimarie.filter(c => risoltaTutte[c + ' '] !== SHEET_MAP.primarie.columns[c]);
verifica('e la mappatura le legge tutte', nonLette.length === 0, nonLette.slice(0, 3).join(', '));

// ---------------------------------------------------------------------------
// Il file Excel finto: le stesse tre date scritte in tre modi diversi
// ---------------------------------------------------------------------------

// L'intestazione della fine trasporto ha uno spazio in coda: e' il caso che
// passa il controllo della firma e non veniva letto.
const COL_FINE = 'Trasporto_finito_il ';
const intestazioni = colonnePrimarie.map(c => (c === 'Trasporto_finito_il' ? COL_FINE : c));

// tre righe: date come oggetto Date, come testo italiano, come seriale
const righeFile = [
  {
    ID: 'ORD-1', Stato: 'terminato', Prodotto: 'A - PFU', Classe: 'A', Provincia: 'NA',
    Peso_effettivo: 12000, Trasportatore: 'Raccoglitore Uno', Destinazione: 'Irigom Srl',
    Ordine_immesso_il: new Date(Date.UTC(2026, 8, 1, 8, 0, 0)),
    Trasporto_iniziato_il: new Date(Date.UTC(2026, 8, 12, 7, 0, 0)),
    [COL_FINE]: new Date(Date.UTC(2026, 8, 13, 12, 57, 36)),
  },
  {
    ID: 'ORD-2', Stato: 'terminato', Prodotto: 'A - PFU', Classe: 'A', Provincia: 'NA',
    Peso_effettivo: 8000, Trasportatore: 'Raccoglitore Uno', Destinazione: 'Irigom Srl',
    Ordine_immesso_il: '01/09/2026 08:00', Trasporto_iniziato_il: '12/09/2026 07:00',
    [COL_FINE]: '13/09/2026 12:57:36',
  },
  {
    ID: 'ORD-3', Stato: 'assegnato', Prodotto: 'A - PFU', Classe: 'A', Provincia: 'NA',
    Peso_stimato: 9000, Trasportatore: 'Raccoglitore Uno',
    Ordine_immesso_il: 46266.3333333333, Trasporto_iniziato_il: 46277.2916666667,
    [COL_FINE]: 46278.54,
  },
];

// Le tre date obbligatorie, uguali comunque siano scritte nel foglio.
const ATTESE = {
  'ORD-1': ['2026-09-01T08:00:00.000Z', '2026-09-12T07:00:00.000Z', '2026-09-13T12:57:36.000Z'],
  'ORD-2': ['2026-09-01T08:00:00.000Z', '2026-09-12T07:00:00.000Z', '2026-09-13T12:57:36.000Z'],
};
// L'assegnato non ha ancora un trasporto: negli archivi degli assegnati si
// conserva la sola immissione (CAMPI_ASSEGNATO).
const IMMISSIONE_ORD3 = '2026-09-01T08:00:00.000Z';

function fileExcel() {
  const aoa = [intestazioni, ...righeFile.map(r => intestazioni.map(c => (r[c] === undefined ? null : r[c])))];
  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'PRIMARIE');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellDates: true });
}

// Le righe come le legge il browser (importGrandeFile): seriali, niente Date.
function righeDalBrowser() {
  const buf = fileExcel();
  const wb = XLSX.read(buf, { type: 'array', cellDates: false });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { raw: true });
}

// ---------------------------------------------------------------------------
// Le funzioni: impacchettate con esbuild, con l'SDK finto e xlsx locale
// ---------------------------------------------------------------------------

const SDK_FINTO = `
const filtra = (righe, f) => righe.filter(r => Object.entries(f || {}).every(([k, v]) => r[k] === v));
function entita(nome) {
  const righe = () => (globalThis.__ARCHIVI[nome] ||= []);
  return {
    filter: async (f, _o, lim = 1e9, skip = 0) => filtra(righe(), f).slice(skip, skip + lim),
    list: async (_o, lim = 1e9, skip = 0) => righe().slice(skip, skip + lim),
    create: async (d) => { const r = { id: 'n' + Math.random(), ...d }; righe().push(r); return r; },
    update: async (id, d) => ({ id, ...d }),
    deleteMany: async () => { globalThis.__ARCHIVI[nome] = []; },
    bulkCreate: async (a) => { righe().push(...a); return a; },
  };
}
const entities = new Proxy({}, { get: (_t, nome) => entita(nome) });
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: 'admin', email: 'prova', full_name: 'Prova' }) }, asServiceRole: { entities }, entities };
}`;
const finti = {
  name: 'moduli-finti',
  setup(b) {
    b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'finto' }));
    b.onLoad({ filter: /.*/, namespace: 'finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
    b.onResolve({ filter: /^npm:xlsx/ }, () => ({ path: qui('../node_modules/xlsx/xlsx.mjs') }));
  },
};

async function funzione(nome) {
  const r = await build({
    entryPoints: [qui(`../base44/functions/${nome}/entry.ts`)],
    bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent', plugins: [finti],
  });
  const m = await import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
  return async (body = {}) => { const res = await m.default({ json: async () => body }); return { status: res.status, body: await res.json() }; };
}

const dateDi = (r) => [r.ordine_immesso_il, r.trasporto_iniziato_il, r.trasporto_finito_il];
const archivio = (nome) => globalThis.__ARCHIVI[nome] || [];

// ---------------------------------------------------------------------------
console.log('IMPORTAZIONE LATO SERVER (importEcotyreFile)');

globalThis.__ARCHIVI = {};
const bufferFile = fileExcel();
globalThis.fetch = async (url) => (String(url) === 'prova://primarie.xlsx'
  ? { ok: true, arrayBuffer: async () => bufferFile }
  : { ok: false, status: 404, statusText: 'non previsto' });

const importaFile = await funzione('importEcotyreFile');
const esito = await importaFile({ file_url: 'prova://primarie.xlsx', tipo_file: 'primarie', nome_file: 'primarie.xlsx' });
verifica('il file passa il controllo delle intestazioni', esito.status === 200, JSON.stringify(esito.body).slice(0, 300));

const rete = archivio('PrimariaRete');
const assegnati = archivio('Assegnato');
verifica('due terminati di rete e un assegnato', rete.length === 2 && assegnati.length === 1, `rete ${rete.length}, assegnati ${assegnati.length}`);
for (const r of rete) {
  verifica(`le tre date dell'ordine ${r.id_ordine}`, JSON.stringify(dateDi(r)) === JSON.stringify(ATTESE[r.id_ordine]), JSON.stringify(dateDi(r)));
}
verifica("l'immissione dell'assegnato, scritta come seriale", assegnati.length === 1 && assegnati[0].ordine_immesso_il === IMMISSIONE_ORD3, JSON.stringify(assegnati.map(r => r.ordine_immesso_il)));
// 13/09/2026 e' una domenica: settimana ISO 37
const perFine = rete.find(r => r.id_ordine === 'ORD-2');
verifica('il mese e la settimana vengono dalla fine trasporto', perFine && perFine.mese === 'Settembre' && perFine.anno === 2026 && perFine.settimane === 37, JSON.stringify(perFine && { mese: perFine.mese, anno: perFine.anno, settimane: perFine.settimane }));

// ---------------------------------------------------------------------------
console.log('IMPORTAZIONE A BLOCCHI (importaBlocco)');

const righeBrowser = righeDalBrowser();
const importaBlocco = await funzione('importaBlocco');

globalThis.__ARCHIVI = {};
const blocco = await importaBlocco({
  azione: 'scrivi', tipo_file: 'primarie', entita: 'PrimariaRete',
  righe: righeBrowser.filter(r => String(r.Stato).toLowerCase() === 'terminato'), blocco: 0,
});
verifica('il blocco delle primarie entra', blocco.status === 200 && blocco.body.scritte === 2, JSON.stringify(blocco.body).slice(0, 300));
for (const r of archivio('PrimariaRete')) {
  verifica(`le tre date dell'ordine ${r.id_ordine}, a blocchi`, JSON.stringify(dateDi(r)) === JSON.stringify(ATTESE[r.id_ordine]), JSON.stringify(dateDi(r)));
}

const bloccoAss = await importaBlocco({
  azione: 'scrivi', tipo_file: 'primarie', entita: 'Assegnato',
  righe: righeBrowser.filter(r => String(r.Stato).toLowerCase() === 'assegnato'), blocco: 1,
});
verifica("il blocco degli assegnati entra con l'immissione", bloccoAss.status === 200 && archivio('Assegnato').length === 1 && archivio('Assegnato')[0].ordine_immesso_il === IMMISSIONE_ORD3, JSON.stringify(archivio('Assegnato').map(r => r.ordine_immesso_il)));

// Le stesse colonne in uno slot diverso: la conversione dipende dal campo, non
// dal tipo di file. Prima era accesa solo per le primarie e qui le tre date
// sarebbero entrate come sono uscite dal foglio.
globalThis.__ARCHIVI = {};
const bloccoSec = await importaBlocco({
  azione: 'scrivi', tipo_file: 'secondarie', entita: 'Secondaria',
  righe: righeBrowser.slice(0, 2).map(r => ({ ...r, Stoccaggio: 'Nappi Sud' })), blocco: 0,
});
verifica('il blocco delle secondarie entra', bloccoSec.status === 200 && bloccoSec.body.scritte === 2, JSON.stringify(bloccoSec.body).slice(0, 300));
for (const r of archivio('Secondaria')) {
  verifica(`le tre date dell'ordine ${r.id_ordine}, in un altro slot`, JSON.stringify(dateDi(r)) === JSON.stringify(ATTESE[r.id_ordine]), JSON.stringify(dateDi(r)));
}

console.log(`\n${ok} prove superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
