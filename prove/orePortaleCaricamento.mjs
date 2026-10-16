// LE DATE DI TRASPORTO CON L'ORA ARRIVANO FINO AL REGISTRO (difetto 9, 16/10/2026).
//
// Inizio e fine trasporto sono giorni: lo scrittore unico (dataDelPortale in
// base44/shared/primarie.ts) li salva a mezzanotte Z anche se la cella del file
// porta un'ora, e conta quelle celle (giorni_con_ora). Oggi sono zero: se il
// portale cominciasse a scrivere l'ora della fine, si deve vedere.
//
// La function a blocchi (importaBlocco) contava le celle blocco per blocco e
// sapeva scriverle nel registro, ma il browser (src/lib/importGrandeFile.js) non
// le sommava e non le mandava con «registra»: dal percorso a blocchi, che e'
// quello di tutti i caricamenti grandi, la nota nel registro non compariva mai.
//
// Qui il modulo vero del browser parla con la function vera, impacchettati con
// esbuild e con un SDK finto che tiene gli archivi in memoria (come in
// caricamentoPrimarie.mjs), sulle due strade:
//   - le primarie, quattro archivi: la somma va per archivio (archivi[a]);
//   - gli ordini non dichiarati, il percorso degli altri report.
// E senza date con l'ora la nota non c'e'.
//
// LA PROVA GIRA DUE VOLTE, con TZ=UTC (il server) e con TZ=Europe/Rome (il
// browser), come prove/orePortale.mjs: si rilancia da sola e pretende lo stesso
// esito e le stesse date salvate nei due fusi.
//
// npm run prove
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const FUSI = ['UTC', 'Europe/Rome'];

if (!process.env.ORE_PORTALE_CARICAMENTO_FUSO) {
  let fallite = 0;
  const scritte = {};
  for (const fuso of FUSI) {
    const r = spawnSync(process.execPath, ['--no-warnings', fileURLToPath(import.meta.url)], {
      env: { ...process.env, TZ: fuso, ORE_PORTALE_CARICAMENTO_FUSO: fuso }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    });
    const righe = (r.stdout || '').split(/\r?\n/);
    const riga = righe.find(l => l.startsWith('SCRITTE '));
    scritte[fuso] = riga ? riga.slice('SCRITTE '.length) : null;
    console.log(`\n===== con TZ=${fuso} =====`);
    console.log(righe.filter(l => !l.startsWith('SCRITTE ')).join('\n').trim());
    if ((r.stderr || '').trim()) console.log(r.stderr.trim());
    if (r.status !== 0) fallite++;
  }
  console.log('\nLE STESSE COSE IN TUTTI E DUE I FUSI');
  if (scritte.UTC === null || scritte['Europe/Rome'] === null) {
    fallite++;
    console.log('  FALLITA: un fuso non ha restituito i suoi valori');
  } else if (scritte.UTC !== scritte['Europe/Rome']) {
    fallite++;
    console.log(`  FALLITA: UTC ${scritte.UTC}\n           Roma ${scritte['Europe/Rome']}`);
  } else console.log(`  ${Object.keys(JSON.parse(scritte.UTC)).length} valori, identici`);
  console.log(fallite ? `\nFALLITA in ${fallite} punti` : '\ntutto superato, in UTC e in Roma');
  process.exit(fallite ? 1 : 0);
}

// ===========================================================================
// Da qui in giu' gira una volta per fuso.
// ===========================================================================
const FUSO = process.env.ORE_PORTALE_CARICAMENTO_FUSO;
const { build } = await import('esbuild');
const { existsSync } = await import('node:fs');
const XLSX = await import('xlsx');
const { SHEET_MAP } = await import('../base44/shared/excelSchemas.ts');

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + (extra ? ' — ' + extra : '')); } };
const SCRITTE = {};
const annota = (chiave, valore) => { SCRITTE[chiave] = valore === undefined ? null : valore; return valore; };

// Le attese fra un ritentativo e l'altro sono secondi veri: qui non servono, e
// nessuna verifica aspetta un numero di giri. Si aspetta la fine del
// caricamento, e basta.
const setTimeoutVero = globalThis.setTimeout;
globalThis.setTimeout = (fn, ms, ...resto) => setTimeoutVero(fn, ms > 20 ? 1 : ms, ...resto);
// utils.js guarda window.self per sapere se sta dentro un iframe.
globalThis.window = { self: {}, top: {} };

// ---------------------------------------------------------------------------
// L'SDK finto della function e il client finto del browser
// ---------------------------------------------------------------------------
const SDK_FINTO = `
const valore = (r, campo) => (r ? r[campo] : undefined);
function ordina(righe, ordinamento) {
  const campo = String(ordinamento || 'id').replace(/^[-+]/, '') || 'id';
  const verso = String(ordinamento || '').startsWith('-') ? -1 : 1;
  return [...righe].sort((a, b) => {
    const x = valore(a, campo), y = valore(b, campo);
    if (x === y || (x == null && y == null)) return String(a.id).localeCompare(String(b.id));
    if (x == null) return 1;
    if (y == null) return -1;
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
    return (c === 0 ? String(a.id).localeCompare(String(b.id)) : c) * verso;
  });
}
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => (v && typeof v === 'object' && Array.isArray(v.$in) ? v.$in.includes(r[k]) : r[k] === v));
let progressivo = 0;
const nuovo = (d) => ({ id: 'r' + String(++progressivo).padStart(6, '0'), created_date: new Date().toISOString(), ...d });
function entita(nome) {
  const righe = () => (globalThis.__ARCHIVI[nome] ||= []);
  return {
    filter: async (f, ord = 'id', lim = 1e9, skip = 0) => ordina(righe().filter(r => soddisfa(r, f)), ord).slice(skip, skip + lim),
    list: async (ord = 'id', lim = 1e9, skip = 0) => ordina(righe(), ord).slice(skip, skip + lim),
    get: async (id) => righe().find(r => r.id === id) || null,
    create: async (d) => { const r = nuovo(d); righe().push(r); return r; },
    update: async (id, d) => { const r = righe().find(x => x.id === id); if (r) Object.assign(r, d); return r || { id, ...d }; },
    deleteMany: async (f) => {
      if (!f || !Object.keys(f).length) { globalThis.__ARCHIVI[nome] = []; return; }
      globalThis.__ARCHIVI[nome] = righe().filter(r => !soddisfa(r, f));
    },
    bulkCreate: async (a) => { const n = a.map(nuovo); righe().push(...n); return n; },
  };
}
const entities = new Proxy({}, { get: (_t, nome) => entita(nome) });
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: 'admin', email: 'prova', full_name: 'Prova' }) }, asServiceRole: { entities }, entities };
}`;

const CLIENT_FINTO = `
export const base44 = {
  functions: { invoke: (nome, corpo) => globalThis.__INVOKE(nome, corpo) },
  entities: new Proxy({}, { get: (_t, nome) => globalThis.__ENTITA(String(nome)) }),
  auth: { me: async () => ({ full_name: 'Prova', email: 'prova' }) },
};`;

globalThis.__ENTITA = (nome) => ({
  filter: async (f) => (globalThis.__ARCHIVI[nome] || []).filter(r => Object.entries(f || {}).every(([k, v]) => r[k] === v)),
  list: async () => [...(globalThis.__ARCHIVI[nome] || [])],
  create: async (d) => { (globalThis.__ARCHIVI[nome] ||= []).push({ id: 'c' + Math.random(), created_date: new Date().toISOString(), ...d }); return d; },
  update: async () => ({}),
});

const ESTENSIONI = ['', '.js', '.jsx', '.ts', '.tsx'];
const daAlias = (p) => {
  const base = qui('../src/' + p.slice(2));
  return ESTENSIONI.map(e => base + e).find(existsSync) || base;
};
const finti = {
  name: 'moduli-finti',
  setup(b) {
    b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
    b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
    b.onResolve({ filter: /^@\/api\/base44Client$/ }, () => ({ path: 'client', namespace: 'client-finto' }));
    b.onLoad({ filter: /.*/, namespace: 'client-finto' }, () => ({ contents: CLIENT_FINTO, loader: 'js' }));
    b.onResolve({ filter: /^(npm:)?xlsx$/ }, () => ({ path: qui('../node_modules/xlsx/xlsx.mjs') }));
    b.onResolve({ filter: /^@\// }, (args) => ({ path: daAlias(args.path) }));
  },
};
async function impacchetta(entrata) {
  const r = await build({
    entryPoints: [entrata], bundle: true, write: false, format: 'esm',
    platform: 'neutral', logLevel: 'silent', plugins: [finti],
  });
  return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
}

const funzioneVera = await impacchetta(qui('../base44/functions/importaBlocco/entry.ts'));
const { importaPrimarie, importaGrandeFile } = await impacchetta(qui('../src/lib/importGrandeFile.js'));

// Il browser chiama solo importaBlocco: ogni altra funzione e' un errore.
const chiamate = [];
globalThis.__INVOKE = async (nome, corpo) => {
  if (nome !== 'importaBlocco') throw new Error('funzione non prevista: ' + nome);
  chiamate.push(corpo);
  const res = await funzioneVera.default({ json: async () => corpo });
  const body = await res.json();
  if (res.status >= 400) throw Object.assign(new Error((body && body.error) || 'errore'), { status: res.status, data: body });
  return { status: res.status, data: body };
};

const archivio = (nome) => globalThis.__ARCHIVI[nome] || [];
const ultimoLog = (tipo) => [...archivio('UploadLog')].reverse().find(r => r.tipo_file === tipo) || {};
const registra = () => [...chiamate].reverse().find(c => c.azione === 'registra') || {};
const NOTA = /avevano anche un'ora nel file: si e' tenuto il giorno|aveva anche un'ora nel file: si e' tenuto il giorno/;

function fileFinto(colonne, righe, nome, foglio) {
  const aoa = [colonne, ...righe.map(r => colonne.map(c => (r[c] === undefined ? null : r[c])))];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), foglio);
  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return { name: nome, arrayBuffer: async () => buffer };
}

// ---------------------------------------------------------------------------
console.log('LE PRIMARIE: LA SOMMA PER ARCHIVIO ARRIVA AL REGISTRO');
// ---------------------------------------------------------------------------
const colonnePrimarie = Object.keys(SHEET_MAP.primarie.columns);
const primaria = (id, { classe = 'A', stato = 'terminato', inizio, fine } = {}) => ({
  ID: id, Stato: stato, Prodotto: classe === '9' ? 'ACI - PFU da autodemolizione' : `${classe} - PFU`, Classe: classe, Provincia: 'NA',
  Trasportatore: 'Raccoglitore Uno', Destinazione: 'Irigom Srl', Ordine_immesso_il: '01/09/2026 08:00',
  ...(stato === 'assegnato' ? { Peso_stimato: 9000 } : { Peso_effettivo: 12000, Trasporto_iniziato_il: inizio, Trasporto_finito_il: fine }),
});
const righePrimarie = [
  // tre di rete con l'ora sull'inizio e sulla fine: 6 celle
  primaria('ET26900001', { inizio: '12/09/2026 07:00', fine: '13/09/2026 12:57:36' }),
  primaria('ET26900002', { inizio: '12/09/2026 07:00', fine: '13/09/2026 23:30' }),
  primaria('ET26900003', { inizio: '12/09/2026 07:00', fine: '13/09/2026 08:00' }),
  // una di rete senza ora: 0
  primaria('ET26900004', { inizio: '12/09/2026', fine: '13/09/2026' }),
  // una ACI con l'ora sulla sola fine: 1, in un altro archivio
  primaria('ET26900005', { classe: '9', inizio: '12/09/2026', fine: '13/09/2026 18:00' }),
  // un assegnato: niente trasporto
  primaria('ET26900006', { stato: 'assegnato' }),
];
globalThis.__ARCHIVI = {};
chiamate.length = 0;
const esitoPrimarie = await importaPrimarie({ file: fileFinto(colonnePrimarie, righePrimarie, 'primarie.xlsx', 'PRIMARIE') });
verifica('il caricamento riesce', esitoPrimarie && esitoPrimarie.esito === 'successo', JSON.stringify(esitoPrimarie && { esito: esitoPrimarie.esito, righe: esitoPrimarie.righe_importate }));
verifica('nel risultato: 7 date di trasporto con l\'ora', annota('primarie risultato', esitoPrimarie.giorni_con_ora) === 7, String(esitoPrimarie.giorni_con_ora));
const corpoPrimarie = registra();
const perArchivio = Object.fromEntries(Object.entries(corpoPrimarie.archivi || {}).map(([e, x]) => [e, (x && x.giorni_con_ora) || 0]));
verifica('«registra» le porta per archivio: 6 di rete e 1 ACI', annota('primarie per archivio', JSON.stringify(perArchivio)) === JSON.stringify({ PrimariaRete: 6, PrimariaAci: 1, Assegnato: 0, AssegnatoAci: 0 }), JSON.stringify(perArchivio));
const logPrimarie = ultimoLog('primarie');
verifica('il registro lo scrive: «7 date di inizio o fine trasporto avevano anche un\'ora nel file»', /\b7 date di inizio o fine trasporto avevano anche un'ora nel file: si e' tenuto il giorno/.test(String(logPrimarie.messaggio || '')), String(logPrimarie.messaggio || '').slice(0, 400));
annota('primarie esito registro', logPrimarie.esito);
// Le date salvate: il giorno, a mezzanotte Z; l'immissione con la sua ora.
const p2 = archivio('PrimariaRete').find(r => r.id_ordine === 'ET26900002') || {};
verifica('la fine delle 23:30 del 13/09 resta il 13/09, a mezzanotte Z', annota('fine ET26900002', p2.trasporto_finito_il) === '2026-09-13T00:00:00.000Z', p2.trasporto_finito_il);
verifica('l\'immissione tiene la sua ora', annota('immesso ET26900002', p2.ordine_immesso_il) === '2026-09-01T08:00:00.000Z', p2.ordine_immesso_il);

// ---------------------------------------------------------------------------
console.log('GLI ALTRI REPORT: IL PERCORSO DEGLI ORDINI NON DICHIARATI');
// ---------------------------------------------------------------------------
const colonneOnd = Object.keys(SHEET_MAP.ordini_non_dichiarati.columns);
const ond = (i, fine, chiusura = '20/09/2026 23:30') => ({
  KeyAccount: 'SMOCO', Ordine_primaria: `ET2690${String(i).padStart(4, '0')}`,
  Data_chiusura: chiusura, ID_Cliente: 'C1', ID_PDR: `PDR-${i}`,
  Punto_di_Raccolta: 'Gommista Uno', Provincia: 'NA', Prodotto: 'A - PFU',
  Status: 'terminato', CER: '160103', Mod_trattamento: 'R3',
  Peso_effettivo_Kg: 12000, Trasportatore: 'Raccoglitore Uno', Destinazione: 'Irigom Srl',
  Fine_trasporto: fine, Numero_FIR: `FIR${i}`, Peso_non_dichiarato_Kg: 12000,
});
// La chiusura ha la sua ora ed e' giusto: non si conta. Si contano le tre fini.
const righeOnd = [ond(1, '13/09/2026 10:00'), ond(2, '13/09/2026 22:15'), ond(3, '14/09/2026 06:00'), ond(4, '14/09/2026')];
globalThis.__ARCHIVI = {};
chiamate.length = 0;
const esitoOnd = await importaGrandeFile({ file: fileFinto(colonneOnd, righeOnd, 'ordini_non_dichiarati.xlsx', 'Foglio1'), tipoFile: 'ordini_non_dichiarati' });
verifica('il caricamento riesce', esitoOnd && esitoOnd.esito === 'successo', JSON.stringify(esitoOnd && { esito: esitoOnd.esito, righe: esitoOnd.righe_importate, errore: esitoOnd.ultimo_errore }));
verifica('nel risultato: 3 fini con l\'ora', annota('ond risultato', esitoOnd.giorni_con_ora) === 3, String(esitoOnd.giorni_con_ora));
verifica('«registra» le porta', annota('ond registra', registra().giorni_con_ora) === 3, String(registra().giorni_con_ora));
const logOnd = ultimoLog('ordini_non_dichiarati');
verifica('il registro lo scrive: «3 date di inizio o fine trasporto avevano anche un\'ora nel file»', /\b3 date di inizio o fine trasporto avevano anche un'ora nel file: si e' tenuto il giorno/.test(String(logOnd.messaggio || '')), String(logOnd.messaggio || '').slice(0, 400));
const o2 = archivio('OrdineNonDichiarato').find(r => /0002$/.test(String(r.ordine_primaria || ''))) || {};
verifica('la fine delle 22:15 resta il 13/09, la chiusura tiene le 23:30', annota('ond fine', o2.fine_trasporto) === '2026-09-13T00:00:00.000Z' && annota('ond chiusura', o2.data_chiusura) === '2026-09-20T23:30:00.000Z', `${o2.fine_trasporto} ${o2.data_chiusura}`);

// ---------------------------------------------------------------------------
console.log('SENZA DATE CON L\'ORA LA NOTA NON C\'E\'');
// ---------------------------------------------------------------------------
globalThis.__ARCHIVI = {};
chiamate.length = 0;
const esitoPulito = await importaGrandeFile({ file: fileFinto(colonneOnd, [ond(1, '13/09/2026'), ond(2, '14/09/2026')], 'ordini_non_dichiarati.xlsx', 'Foglio1'), tipoFile: 'ordini_non_dichiarati' });
verifica('il caricamento riesce', esitoPulito && esitoPulito.esito === 'successo', JSON.stringify(esitoPulito && esitoPulito.esito));
verifica('nel risultato: 0', annota('pulito risultato', esitoPulito.giorni_con_ora) === 0, String(esitoPulito.giorni_con_ora));
verifica('«registra» non manda niente', registra().giorni_con_ora === undefined, String(registra().giorni_con_ora));
verifica('e il registro non scrive la nota', !NOTA.test(String(ultimoLog('ordini_non_dichiarati').messaggio || '')), String(ultimoLog('ordini_non_dichiarati').messaggio || '').slice(0, 300));

console.log(`\n${ok} verifiche superate, ${ko} fallite (TZ=${FUSO})`);
console.log('SCRITTE ' + JSON.stringify(SCRITTE));
process.exit(ko ? 1 : 0);
