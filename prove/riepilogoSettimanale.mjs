// IL RIEPILOGO DELLA SETTIMANA PER LA DIREZIONE (14/10/2026).
//
// Fra le cose da creare approvate dall'utente il 14/10/2026: «un riepilogo
// settimanale per la direzione, il lunedi', in PDF o per email: target e scarti
// per regione, alert critici, dichiarazioni da fare, fatture del mese». Il
// pulsante sta nella dashboard (src/components/dashboard/RiepilogoSettimanale.jsx),
// il PDF lo costruisce src/lib/riepilogoSettimanale.js coi numeri che la
// dashboard ha gia' letto, e l'unica lettura in piu', al clic, e' il raccolto
// della settimana (base44/functions/riepilogoSettimana, conto in
// base44/shared/riepilogoSettimana.ts).
//
// 1. la settimana: da lunedi' a domenica sul giorno italiano, appena finita o in
//    corso, a cavallo del mese e dell'anno, tutti i giorni di due anni;
// 2. il conto della settimana: il giorno italiano di fine trasporto (mai la
//    chiusura), terminati, ordini distinti, le secondarie dell'extra fuori, un
//    archivio non letto che non diventa zero;
// 3. la funzione sul banco: tre letture filtrate, una pagina per archivio,
//    nessun euro, il lunedi' controllato;
// 4. il PDF col jspdf vero su dati costruiti, con le funzioni vere della
//    dashboard sul banco: testo estratto sezione per sezione, i numeri della
//    dashboard, «—» per i giorni che i dati non coprono, la copia di chi non e'
//    amministratore senza costi ne' margine, una parte non letta detta nella sua
//    sezione, tutti gli ID degli eseguiti, nessuna frase tagliata;
// 5. la pagina: il pulsante per tutti, la lettura solo al clic, il modulo del
//    PDF scaricato al clic; e la dashboard vera montata (paginaFinta), per chi
//    e' amministratore e per chi no: all'apertura le letture di sempre, al
//    pulsante i numeri gia' letti, e il clic costa una chiamata sola;
// 6. sui dati veri dell'11/10/2026 (copia in ../dati-veri, fuori dal
//    repository): le due settimane della copia, coi numeri della dashboard e il
//    raccolto rifatto qui dall'archivio, e quanto legge il clic;
// 7. il PDF si legge tutto (revisione del 15/10/2026): uno scarto e una
//    variazione in meno leggibili, i cinque archivi caricati dopo la notte e il
//    titolo di una voce lunga interi, e su ogni PDF della prova nessuna riga in
//    due byte, nessuna cella oltre le tre righe, nessun titolo fuori pagina;
//    e dalla prova del cambio d'anno (15/10/2026) un margine con prezzi che
//    mancano «—» con la nota del perche', e l'ACI col contratto copiato che
//    dice «previsione copiata dal ..., da confermare»;
// 8. le misure del riepilogo (perIlPdf, pezziDellaCella) contro il jspdf vero.
// node prove/riepilogoSettimanale.mjs (MOSTRA=1 stampa il testo dei PDF,
// SALVA=<cartella fuori dal repository> li scrive per guardarli, TRACCIA=1 dice
// dove si ferma una sezione)
import { build } from 'esbuild';
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
// Una sezione che si ferma con un errore (col codice di prima i moduli non ci
// sono) conta come fallita e si va avanti con la prossima.
const sezione = async (titolo, corpo) => {
  console.log(titolo);
  try { await corpo(); } catch (e) { ko++; console.log(`  FALLITA: ${titolo}: si ferma con un errore (${String(e && e.message).slice(0, 300)})`); if (process.env.TRACCIA) console.log(e.stack); }
};
const sorgente = (p) => (existsSync(qui('../' + p)) ? readFileSync(qui('../' + p), 'utf8').replace(/\r/g, '') : '');
const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

// L'orologio fermo: le funzioni e la pagina chiedono oggi a oggiRoma().
const OraVera = Date;
const conOra = async (iso, f) => {
  const ms = OraVera.parse(iso);
  globalThis.Date = class extends OraVera { constructor(...a) { if (a.length) super(...a); else super(ms); } static now() { return ms; } };
  try { return await f(); } finally { globalThis.Date = OraVera; }
};

// ─── LE FUNZIONI SUL BANCO ───
// L'SDK finto legge da globalThis.__ARCHIVI come la piattaforma: uguaglianza,
// $in, $gte, $lte, ordinamento e pagine; conta le letture per archivio; un
// archivio in globalThis.__ROTTI non risponde.
const SDK_FINTO = `
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => {
  const x = r[k];
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    if ('$in' in v && !v.$in.includes(x)) return false;
    if ('$nin' in v && v.$nin.includes(x)) return false;
    if ('$gte' in v && !(x != null && String(x) >= String(v.$gte))) return false;
    if ('$lte' in v && !(x != null && String(x) <= String(v.$lte))) return false;
    if ('$ne' in v && x === v.$ne) return false;
    return true;
  }
  if (v === null) return x === null || x === undefined || x === '';
  return x === v;
});
const ordina = (righe, sort) => { const campo = String(sort || 'id').replace(/^[-+]/, ''); const giu = String(sort || '').startsWith('-');
  return [...righe].sort((a, b) => { const x = a[campo], y = b[campo]; if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y)); return giu ? -c : c; }); };
const conta = (nome, metodo, f) => { (globalThis.__LETTURE = globalThis.__LETTURE || []).push({ nome, metodo, filtro: f }); if ((globalThis.__ROTTI || []).includes(nome)) throw new Error('archivio ' + nome + ' non raggiungibile'); };
const entita = (nome) => ({
  list: async (sort, lim = 1e9, skip = 0) => { conta(nome, 'list'); return ordina(globalThis.__ARCHIVI[nome] || [], sort).slice(skip, skip + lim); },
  filter: async (f, sort, lim = 1e9, skip = 0) => { conta(nome, 'filter', f); return ordina((globalThis.__ARCHIVI[nome] || []).filter(r => soddisfa(r, f)), sort).slice(skip, skip + lim); },
  get: async (id) => (globalThis.__ARCHIVI[nome] || []).find(r => r.id === id) || null,
  create: async (r) => { (globalThis.__SCRITTE = globalThis.__SCRITTE || []).push('create ' + nome); return r; },
  update: async (_id, r) => { (globalThis.__SCRITTE = globalThis.__SCRITTE || []).push('update ' + nome); return r; },
  bulkCreate: async (r) => { (globalThis.__SCRITTE = globalThis.__SCRITTE || []).push('bulkCreate ' + nome); return r; },
  bulkUpdate: async (r) => { (globalThis.__SCRITTE = globalThis.__SCRITTE || []).push('bulkUpdate ' + nome); return r; },
  delete: async () => { (globalThis.__SCRITTE = globalThis.__SCRITTE || []).push('delete ' + nome); return {}; },
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: globalThis.__RUOLO || 'admin', email: 'prova@prova', full_name: 'Prova' }) }, asServiceRole: { entities, functions: { invoke: async () => ({ data: {} }) } }, entities,
    functions: { invoke: async (n) => { throw new Error('nessuna altra funzione: ' + n); } } };
}`;
const caricaFunzione = async (nome) => {
  const p = await build({
    entryPoints: [qui(`../base44/functions/${nome}/entry.ts`)], bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
    plugins: [{ name: 'sdk-finto', setup(b) {
      b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
      b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
    } }],
  });
  const m = await import('data:text/javascript;base64,' + Buffer.from(p.outputFiles[0].text).toString('base64'));
  return async (corpo, { archivi, ruolo = 'admin', ora, rotti = [] }) => {
    globalThis.__ARCHIVI = archivi; globalThis.__RUOLO = ruolo; globalThis.__LETTURE = []; globalThis.__ROTTI = rotti; globalThis.__SCRITTE = [];
    const r = await conOra(ora, () => m.default({ json: async () => corpo }));
    return { stato: r.status, j: await r.json(), letture: globalThis.__LETTURE, scritte: globalThis.__SCRITTE };
  };
};

// ─── LE PAGINE: LA LIBRERIA DEL PDF, IL PULSANTE, LE SEZIONI DELLA DASHBOARD ───
// Un pacchetto solo, con React lato server, il client finto, e il corredo dei
// PDF con jspdf vero: il documento resta in memoria invece di scaricarsi.
const jspdf = pathToFileURL(qui('../node_modules/jspdf/dist/jspdf.node.min.js')).href;
const ESTENSIONI = ['', '.js', '.jsx', '.ts'];
const daAlias = (p) => { const base = qui('../src/' + p.slice(2)); return ESTENSIONI.map(e => base + e).find(f => existsSync(f) && /\.\w+$/.test(f)) || base; };
const nomiSezioni = ['QuadroInBreve', 'SezioneRete', 'SezioneAci', 'SezioneExtra', 'SezioneImpianti', 'SezioneFatturazione', 'SezioneEconomia'];
const INGRESSO = `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import { MemoryRouter } from 'react-router-dom';
${nomiSezioni.map(n => `import ${n} from ${J(qui(`../src/components/dashboard/${n}.jsx`))};`).join('\n')}
import RiepilogoSettimanale from ${J(qui('../src/components/dashboard/RiepilogoSettimanale.jsx'))};
export { settimanaDaRiepilogare, giorniDellaSettimana } from ${J(qui('../src/components/dashboard/RiepilogoSettimanale.jsx'))};
export * as R from ${J(qui('../src/lib/riepilogoSettimanale.js'))};
export { esportaSezioniPdf } from ${J(qui('../src/lib/esportaTabella.js'))};
export { argomentiQuadroPdf } from ${J(qui('../src/components/dashboard/esportaQuadro.js'))};
export { unisciVoci, vociDalMargine } from ${J(qui('../src/components/dashboard/vociDashboard.js'))};
export { cifreRete, righeRegioni } from ${J(qui('../src/components/dashboard/righeQuadro.js'))};
const C = { ${nomiSezioni.join(', ')}, RiepilogoSettimanale };
export const disegna = (nome, props) => renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(C[nome], props)));
`;
let L = null;
try {
  const p = await build({
    stdin: { contents: INGRESSO, resolveDir: qui('.'), loader: 'js' }, bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent',
    loader: { '.jsx': 'jsx', '.js': 'jsx' }, define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'alias', setup(b) {
      b.onResolve({ filter: /^@\/api\/base44Client$/ }, () => ({ path: 'client', namespace: 'finto' }));
      b.onLoad({ filter: /.*/, namespace: 'finto' }, () => ({ contents: 'export const base44 = { functions: { invoke: async (n) => { throw new Error("nessuna chiamata: " + n); } }, auth: { me: async () => { throw new Error("nessuna chiamata: auth"); } } };', loader: 'js' }));
      b.onResolve({ filter: /^jspdf$/ }, () => ({ path: jspdf, external: true }));
      b.onResolve({ filter: /^(exceljs|xlsx)$/ }, (a) => ({ path: a.path, external: true }));
      // il PDF resta in memoria: doc.save diventa doc.output
      b.onLoad({ filter: /esportaTabella\.js$/ }, (a) => ({ contents: readFileSync(a.path, 'utf8').replace(/doc\.save\(`\$\{nomeSicuro\(nomeFile\)\}\.pdf`\);/g, 'globalThis.__PDF = doc.output(); globalThis.__NOME_PDF = `${nomeSicuro(nomeFile)}.pdf`;'), loader: 'jsx' }));
      b.onResolve({ filter: /^@\// }, (a) => ({ path: daAlias(a.path) }));
    } }],
  });
  if (typeof globalThis.window === 'undefined') globalThis.window = { self: 1, top: 1, matchMedia: () => ({ matches: false, addListener() {}, removeListener() {} }) };
  L = await import('data:text/javascript;base64,' + Buffer.from(p.outputFiles[0].text).toString('base64'));
} catch (e) { verifica('il pulsante, la libreria del PDF e le sezioni si impacchettano', false, String(e && e.message).slice(0, 600)); }
// jspdf, se trova un window, lo prende per un browser
delete globalThis.window;

// Il testo del PDF: fra parentesi tonde, le lettere fuori dall'ASCII in ottale
// nella codifica dei font standard (€ 0x80, • 0x95, – 0x96, — 0x97), a volte
// come byte nudi. Righe nell'ordine in cui il PDF le scrive.
const WIN = { 0x80: '€', 0x95: '•', 0x96: '–', 0x97: '—' };
const testiPdf = (pdf) => (String(pdf || '').match(/\((?:\\.|[^()\\])*\)\s*Tj/g) || [])
  .map(x => x.slice(1, x.lastIndexOf(')'))
    .replace(/\\(\d{3})/g, (_, o) => { const c = parseInt(o, 8); return WIN[c] || String.fromCharCode(c); })
    .replace(/\\([()\\])/g, '$1')
    .replace(/[\x80-\x9f]/g, (c) => WIN[c.charCodeAt(0)] || c));
const html = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ');
/** Il PDF vero degli argomenti: { testi, tutto, pagine, nome, dueByte } */
let salvati = 0;
// Ogni PDF fatto dalla prova, con le righe che jspdf ha scritto in due byte per
// lettera (illeggibili): la sezione 7 li guarda tutti (revisione del 15/10/2026).
const PRODOTTI = [];
const pdfDi = async (argomenti) => {
  globalThis.__PDF = null;
  await L.esportaSezioniPdf(argomenti);
  const dueByte = String(globalThis.__PDF).split('\n').filter(l => /Tj/.test(l) && /\x00/.test(l));
  PRODOTTI.push({ argomenti, dueByte, nome: globalThis.__NOME_PDF });
  const testi = testiPdf(globalThis.__PDF);
  // SALVA=<cartella> scrive i PDF per guardarli (fuori dal repository: quelli dei dati veri hanno i numeri veri)
  if (process.env.SALVA) writeFileSync(join(process.env.SALVA, `${++salvati} ${globalThis.__NOME_PDF}`), globalThis.__PDF, 'latin1');
  return { testi, tutto: testi.join(' ').replace(/\s+/g, ' '), pagine: (String(globalThis.__PDF).match(/\/Type \/Page\b/g) || []).length, nome: globalThis.__NOME_PDF, dueByte };
};
/** Il testo fra il titolo di una sezione e quello della successiva. */
const parte = (tutto, da, a = null) => {
  const i = tutto.indexOf(da);
  if (i < 0) return '';
  const j = a ? tutto.indexOf(a, i + da.length) : -1;
  return tutto.slice(i, j < 0 ? undefined : j);
};
const tIt = (v) => { let [i, d] = (Math.round(Math.abs(v) * 1000) / 1000).toFixed(3).split('.'); while (d.length > 2 && d.endsWith('0')) d = d.slice(0, -1); return `${v < 0 ? '-' : ''}${i.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${d}`; };

let S = null;
await sezione('1. LA SETTIMANA: DA LUNEDI\' A DOMENICA, SUL GIORNO ITALIANO', async () => {
  S = await import('../base44/shared/riepilogoSettimana.ts');
  const s = (oggi, quale) => L.settimanaDaRiepilogare(oggi, quale);
  const casi = [
    ['2026-10-14', 'finita', '2026-10-05', '2026-10-11', 41, 2026, 'un mercoledi\': la settimana prima'],
    ['2026-10-14', 'in_corso', '2026-10-12', '2026-10-18', 42, 2026, 'la settimana di oggi'],
    ['2026-10-12', 'finita', '2026-10-05', '2026-10-11', 41, 2026, 'il lunedi\' mattina, quella appena finita ieri'],
    ['2026-10-11', 'finita', '2026-09-28', '2026-10-04', 40, 2026, 'la domenica la settimana non e\' ancora finita: quella prima, a cavallo di settembre e ottobre'],
    ['2026-10-11', 'in_corso', '2026-10-05', '2026-10-11', 41, 2026, 'la domenica, quella in corso finisce oggi'],
    ['2027-01-05', 'finita', '2026-12-28', '2027-01-03', 53, 2026, 'a cavallo dell\'anno: la settimana 53 del 2026'],
    ['2026-01-01', 'in_corso', '2025-12-29', '2026-01-04', 1, 2026, 'il 1° gennaio: la settimana 1 del 2026 comincia a dicembre'],
    ['2026-10-26', 'finita', '2026-10-19', '2026-10-25', 43, 2026, 'il lunedi\' dopo il cambio dell\'ora'],
  ];
  for (const [oggi, quale, dal, al, numero, annoS, perche] of casi) {
    const x = s(oggi, quale);
    verifica(`${oggi} ${quale}: dal ${dal} al ${al}, settimana ${numero} del ${annoS} (${perche})`, x && x.dal === dal && x.al === al && x.numero === numero && x.anno_settimana === annoS, J(x && [x.dal, x.al, x.numero, x.anno_settimana]));
  }
  verifica('i giorni scritti, da lunedi\' a domenica', J(s('2026-10-14', 'finita').giorni.map(g => `${g.nome} ${g.giorno}`)) === J(['lunedì 2026-10-05', 'martedì 2026-10-06', 'mercoledì 2026-10-07', 'giovedì 2026-10-08', 'venerdì 2026-10-09', 'sabato 2026-10-10', 'domenica 2026-10-11']));
  verifica('a cavallo dell\'anno, gli anni sono due', J(s('2027-01-05', 'finita').anni) === J([2026, 2027]) && J(s('2026-10-14', 'finita').anni) === J([2026]));
  verifica('l\'etichetta a video: «05/10 – 11/10/2026», «29/12/2025 – 04/01/2026»', L.giorniDellaSettimana(s('2026-10-14', 'finita')) === '05/10 – 11/10/2026' && L.giorniDellaSettimana(s('2026-01-01', 'in_corso')) === '29/12/2025 – 04/01/2026', L.giorniDellaSettimana(s('2026-10-14', 'finita')));
  // Ogni giorno di due anni: la settimana finita e' l'ultima intera prima di
  // oggi, quella in corso contiene oggi; il lunedi' e' quello che la funzione
  // accetta, e il numero e' quello della settimana ISO del gestionale.
  const { settimanaIso, annoSettimanaIso } = await import('../base44/shared/movimenti.ts');
  const sbagliati = [];
  for (let g = '2025-12-01'; g <= '2027-12-31'; g = S.piuGiorni(g, 1)) {
    const f = s(g, 'finita'), c = s(g, 'in_corso');
    const giorniFra = (a, b) => (OraVera.parse(b) - OraVera.parse(a)) / 86400000;
    const bene = S.eLunedi(f.dal) && S.eLunedi(c.dal) && f.al === S.piuGiorni(f.dal, 6) && c.al === S.piuGiorni(c.dal, 6)
      && c.dal <= g && g <= c.al && f.al < g && giorniFra(f.al, g) >= 1 && giorniFra(f.al, g) <= 7 && S.piuGiorni(f.dal, 7) === c.dal
      && f.numero === settimanaIso(f.dal) && f.anno_settimana === annoSettimanaIso(f.dal) && settimanaIso(f.al) === f.numero;
    if (!bene) sbagliati.push(g);
  }
  verifica('ogni giorno dal 01/12/2025 al 31/12/2027: finita e in corso giuste, lunedi\'-domenica, numero ISO', sbagliati.length === 0, sbagliati.slice(0, 5).join(', '));
  verifica('la funzione accetta solo un lunedi\' vero', S.eLunedi('2026-10-05') && !S.eLunedi('2026-10-06') && !S.eLunedi('2026-02-30') && !S.eLunedi('05/10/2026') && !S.eLunedi(''));
});

// ─── IL CASO COSTRUITO ───
// Oggi mercoledi' 14/10/2026; la settimana appena finita e' dal 05/10 all'11/10.
// Le primarie arrivano fino a giovedi' 08/10: venerdi', sabato e domenica non
// sono ancora nei dati.
const T = (g, ora = '10:00:00') => `${g}T${ora}Z`;
let progressivo = 0;
const riga = (o) => ({ id: 'r' + (++progressivo), id_ordine: o.id_ordine || ('P' + progressivo), stato: 'terminato', partner_operativo: 'SMOCO Srl', ordine_immesso_il: T('2026-09-01'), trasporto_iniziato_il: o.fine || T('2026-09-01'), trasporto_finito_il: o.fine, ...o });
const RETE = [
  // lunedi' 05/10: un ordine su due righe (una classe ciascuna): un ritiro
  riga({ id_ordine: 'R1', fine: T('2026-10-05'), provincia: 'BA', regione: 'Puglia', trasportatore: 'BETA SRL', peso_effettivo: 3000 }),
  riga({ id_ordine: 'R1', fine: T('2026-10-05'), provincia: 'BA', regione: 'Puglia', trasportatore: 'BETA SRL', peso_effettivo: 2000 }),
  // martedi' 06/10, Calabria
  riga({ id_ordine: 'R2', fine: T('2026-10-06'), provincia: 'CS', regione: 'Calabria', trasportatore: 'ALFA SRL', peso_effettivo: 5250 }),
  // giovedi' 08/10 alle 00:30 italiane: in UTC e' ancora mercoledi'
  riga({ id_ordine: 'R3', fine: '2026-10-07T22:30:00Z', provincia: 'NA', regione: 'Campania', trasportatore: 'ALFA SRL', peso_effettivo: 1000 }),
  // domenica 04/10 alle 23:30 italiane: la settimana prima, anche se in UTC e' le 21:30
  riga({ id_ordine: 'R4', fine: '2026-10-04T21:30:00Z', provincia: 'BA', regione: 'Puglia', trasportatore: 'BETA SRL', peso_effettivo: 7000 }),
  // cancellato il 06/10: non conta
  riga({ id_ordine: 'R6', fine: T('2026-10-06'), stato: 'cancellato', provincia: 'BA', regione: 'Puglia', trasportatore: 'BETA SRL', peso_effettivo: 9000 }),
  // Sicilia, fuori dalle regioni del contratto
  riga({ id_ordine: 'R7', fine: T('2026-10-06'), provincia: 'PA', regione: 'Sicilia', trasportatore: 'GAMMA SRL', peso_effettivo: 750 }),
  // chiuso a portale nella settimana ma finito a settembre: conta a settembre
  riga({ id_ordine: 'R8', fine: T('2026-09-20'), ordine_chiuso_il: T('2026-10-06'), provincia: 'NA', regione: 'Campania', trasportatore: 'ALFA SRL', peso_effettivo: 4321 }),
  // il resto dell'anno
  riga({ id_ordine: 'R9', fine: T('2026-03-10'), provincia: 'NA', regione: 'Campania', trasportatore: 'ALFA SRL', peso_effettivo: 600000 }),
  riga({ id_ordine: 'R10', fine: T('2026-06-10'), provincia: 'BA', regione: 'Puglia', trasportatore: 'BETA SRL', peso_effettivo: 400000 }),
  // rimasti «eseguito» a portale: 25 ordini, la voce ne mostra dieci, il PDF tutti
  ...Array.from({ length: 25 }, (_, i) => riga({ id_ordine: `ES${String(i + 1).padStart(3, '0')}`, stato: 'eseguito', fine: T('2026-09-15'), provincia: 'NA', regione: 'Campania', trasportatore: 'ALFA SRL', peso_effettivo: 100 })),
];
// lunedi' 12/10 alle 00:30 italiane: la settimana dopo, anche se in UTC e' domenica.
// Sta fuori dall'archivio del PDF, dove i dati arrivano a giovedi' 08/10.
const DOPO = riga({ id_ordine: 'R5', fine: '2026-10-11T22:30:00Z', provincia: 'BA', regione: 'Puglia', trasportatore: 'BETA SRL', peso_effettivo: 8000 });
const ACI = [
  riga({ id_ordine: 'A1', fine: T('2026-10-07'), provincia: 'NA', regione: 'Campania', trasportatore: 'DEMOLIZIONI SUD', peso_effettivo: 2500, costo_aci_tecnogum: 123.45 }),
  riga({ id_ordine: 'A2', fine: T('2026-05-07'), provincia: 'NA', regione: 'Campania', trasportatore: 'DEMOLIZIONI SUD', peso_effettivo: 10000 }),
];
const EXTRA = [
  // venerdi' 09/10: l'extra raccolta ha il suo modulo, conta fino a oggi
  riga({ id_ordine: 'E1', fine: T('2026-10-09'), tipo_movimento: 'primaria', provincia: 'NA', peso_effettivo: 1200, prezzo_attivo_t: 202, sovracosto_raccolta: 50 }),
  // il trasferimento in secondaria dello stesso peso non conta
  riga({ id_ordine: 'E2', fine: T('2026-10-09'), tipo_movimento: 'secondaria', provincia: 'NA', peso_effettivo: 1200 }),
];
const PROFILO = [851.29, 915.48, 868.47, 932.55, 1053.85, 1100, 1100, 550, 1050, 1100, 1100, 950];
const COMMESSA = { id: 'c26', anno: 2026, target_annuo_t: 11550, target_mensile_json: J(PROFILO),
  regioni_json: J([{ regione: 'Puglia', target_t: 4000 }, { regione: 'Calabria', target_t: 3000 }, { regione: 'Campania', target_t: 4550 }]),
  target_prezzo_regioni_json: J([{ regione: 'Campania', target_t: 650, prezzo: 95 }]), created_date: '2026-01-02T08:00:00Z', updated_date: '2026-01-02T08:00:00Z' };
const ARCHIVI = {
  PrimariaRete: RETE, PrimariaAci: ACI, ExtraRaccolta: EXTRA, CommessaEcotyre: [COMMESSA],
  Alert: [{ id: 'al1', stato: 'aperto', severita: 'critico', regola_nome: 'Scadenza qualifica', titolo: 'Documento scaduto', modulo: 'qualifica' }],
  UploadLog: [{ id: 'u1', tipo_file: 'primarie', esito: 'successo', created_date: '2026-10-09T15:00:00Z', nome_file: 'primarie.xlsx' }],
  RiepilogoQualifica: [{ id: 'q1', anno: 2026, scaduti: 2, non_conformi: 0, soggetti_critici: [{ nome: 'ALFA SRL' }], created_date: '2026-10-14T06:00:00Z' }],
};
const ORA = '2026-10-14T09:00:00Z';
const OGGI = '2026-10-14';

let F = null, D = null, C = null, settFinita = null;
await sezione('2. IL CONTO DELLA SETTIMANA', async () => {
  const conto = S.raccoltoDellaSettimana({ dal: '2026-10-05', oggi: OGGI, rete: [...RETE, DOPO], aci: ACI, extra: EXTRA });
  const g = (c, giorno) => (c.giorni.find(x => x.giorno === giorno) || {});
  verifica('rete: 12,00 t e 4 ritiri (l\'ordine su due righe conta uno)', conto.rete.t === 12 && conto.rete.ritiri === 4, J([conto.rete.t, conto.rete.ritiri]));
  verifica('lunedi\' 05/10: 5,00 t, un ritiro', g(conto.rete, '2026-10-05').t === 5 && g(conto.rete, '2026-10-05').ritiri === 1);
  verifica('le 00:30 italiane di giovedi\' 08/10 sono giovedi\', non mercoledi\'', g(conto.rete, '2026-10-08').t === 1 && g(conto.rete, '2026-10-07').t === 0);
  verifica('le 23:30 di domenica 04/10 e le 00:30 di lunedi\' 12/10 fuori dalla settimana', !conto.rete.giorni.some(x => x.t >= 7));
  verifica('un ordine chiuso a portale nella settimana ma finito a settembre non c\'e\'', !(conto.rete.raccoglitori || []).some(r => Math.abs(r.t - 4.321) < 1e-9) && conto.rete.t === 12);
  verifica('i cancellati non contano', g(conto.rete, '2026-10-06').t === 6, J(g(conto.rete, '2026-10-06')));
  verifica('le regioni: Puglia 5,00, Calabria 5,25, Campania 1,00, Sicilia 0,75', J(conto.rete.regioni.map(r => [r.regione, r.t])) === J([['Calabria', 5.25], ['Puglia', 5], ['Campania', 1], ['Sicilia', 0.75]]), J(conto.rete.regioni));
  verifica('i raccoglitori col nome del formulario e le loro regioni', J(conto.rete.raccoglitori.map(r => [r.raccoglitore, r.regioni, r.t, r.ritiri])) === J([['ALFA SRL', ['Calabria', 'Campania'], 6.25, 2], ['BETA SRL', ['Puglia'], 5, 1], ['GAMMA SRL', ['Sicilia'], 0.75, 1]]), J(conto.rete.raccoglitori));
  verifica('ACI: 2,50 t, un ritiro; extra raccolta: 1,20 t, la secondaria fuori', conto.aci.t === 2.5 && conto.aci.ritiri === 1 && conto.extra.t === 1.2 && conto.extra.ritiri === 1, J([conto.aci.t, conto.extra]));
  verifica('i canali non si sommano: nessun totale dei tre', !('totale' in conto) && !('t' in conto));
  const rotto = S.raccoltoDellaSettimana({ dal: '2026-10-05', oggi: OGGI, rete: null, aci: [], extra: EXTRA });
  verifica('un archivio non letto e\' { letto: false }, mai zero', rotto.rete.letto === false && !('t' in rotto.rete) && rotto.aci.letto === true && rotto.aci.t === 0);
  // la settimana in corso: oggi mercoledi' 14/10, giovedi' e dopo sono futuri
  const futura = riga({ id_ordine: 'F1', fine: T('2026-10-16'), provincia: 'BA', regione: 'Puglia', trasportatore: 'BETA SRL', peso_effettivo: 999000 });
  const inCorso = S.raccoltoDellaSettimana({ dal: '2026-10-12', oggi: OGGI, rete: [...RETE, DOPO, futura], aci: [], extra: [] });
  verifica('la settimana in corso: i giorni dopo oggi sono futuri, e una fine trasporto dopo oggi non conta', J(inCorso.giorni.map(x => x.futuro)) === J([false, false, false, true, true, true, true]) && inCorso.rete.t === 8 && inCorso.rete.giorni.length === 3, J([inCorso.rete.t, inCorso.rete.giorni]));
});

await sezione('3. LA FUNZIONE SUL BANCO', async () => {
  F = await caricaFunzione('riepilogoSettimana');
  const r = await F({ dal: '2026-10-05' }, { archivi: ARCHIVI, ruolo: 'user', ora: ORA });
  settFinita = r.j;
  verifica('risponde anche a chi non e\' amministratore', r.stato === 200 && r.j.dal === '2026-10-05' && r.j.al === '2026-10-11', J(r.j).slice(0, 300));
  verifica('i numeri del conto', r.j.rete && r.j.rete.t === 12 && r.j.aci.t === 2.5 && r.j.extra.t === 1.2, J([r.j.rete && r.j.rete.t, r.j.aci && r.j.aci.t, r.j.extra && r.j.extra.t]));
  verifica('tre letture, una per archivio, filtrate sulla fine trasporto della settimana', r.letture.length === 3 && J(r.letture.map(l => l.nome).sort()) === J(['ExtraRaccolta', 'PrimariaAci', 'PrimariaRete'])
    && r.letture.every(l => l.metodo === 'filter' && l.filtro.stato === 'terminato' && l.filtro.trasporto_finito_il.$gte === '2026-10-04T00:00:00' && l.filtro.trasporto_finito_il.$lte === '2026-10-11T23:59:59.999Z'), J(r.letture));
  verifica('poche righe: le sole della settimana (e qualche ora attorno)', r.j.righe_lette && r.j.righe_lette.rete === 6 && r.j.righe_lette.aci === 1 && r.j.righe_lette.extra === 2, J(r.j.righe_lette));
  verifica('nessun euro nella risposta: niente costi, prezzi, sovracosti', !/costo|prezzo|sovracosto|ricavo|margine|€/i.test(J(r.j)), J(r.j).match(/.{0,30}(costo|prezzo|sovracosto).{0,30}/i)?.[0]);
  verifica('nessuna scrittura', r.scritte.length === 0, J(r.scritte));
  const martedi = await F({ dal: '2026-10-06' }, { archivi: ARCHIVI, ora: ORA });
  const futura = await F({ dal: '2026-10-19' }, { archivi: ARCHIVI, ora: ORA });
  verifica('un giorno che non e\' lunedi\' si rifiuta, e cosi\' una settimana non ancora cominciata (400, nessuna lettura)', martedi.stato === 400 && /non è il lunedì/.test(martedi.j.error) && futura.stato === 400 && /non è ancora cominciata/.test(futura.j.error) && martedi.letture.length === 0 && futura.letture.length === 0, J([martedi.j, futura.j]));
  const rotta = await F({ dal: '2026-10-05' }, { archivi: ARCHIVI, ora: ORA, rotti: ['PrimariaAci'] });
  verifica('un archivio che non risponde: il suo canale { letto: false } col perche\', gli altri si contano', rotta.stato === 200 && rotta.j.aci.letto === false && /non raggiungibile/.test(rotta.j.aci.errore) && rotta.j.rete.t === 12 && rotta.j.righe_lette.aci === null, J(rotta.j.aci));
});

let argomenti = null;
await sezione('4. IL PDF SU DATI COSTRUITI, COL JSPDF VERO', async () => {
  // Le funzioni vere della dashboard, sullo stesso archivio.
  const raccolta = await caricaFunzione('getDashboardRaccolta');
  const cruscotto = await caricaFunzione('cruscottoOperativo');
  const R = await raccolta({ anno: [2026] }, { archivi: ARCHIVI, ruolo: 'user', ora: ORA });
  const K = await cruscotto({}, { archivi: ARCHIVI, ruolo: 'user', ora: ORA });
  verifica('il quadro e il cruscotto rispondono', R.stato === 200 && R.j.quadro && K.stato === 200 && Array.isArray(K.j.da_gestire), J([R.j.error, K.j.error]));
  D = R.j; C = K.j;
  const q = D.quadro;
  const settimana = L.settimanaDaRiepilogare(OGGI, 'finita');
  const margine = { anno: 2026, canali: [
    { canale: 'RETE', anno: { ricavo: 100000, costo: 80000, margine: 20000, margine_pct: 20, tonnellate: 1012.3, margine_t: 19.76 }, mesi: [{ mese: 'Ottobre', ricavo: 1000, costo: 900, margine: 100, margine_pct: 10, tonnellate: 12, margine_t: 8.33, righe_senza_prezzo: 2, anomalie_passiva: 1 }] },
    { canale: 'ACI', anno: { ricavo: 2000, costo: 1500, margine: 500, margine_pct: 25, tonnellate: 12.5, margine_t: 40 }, mesi: [] },
    { canale: 'EXTRA_RACCOLTA', anno: { ricavo: 300, costo: 200, margine: 100, margine_pct: 33.3, tonnellate: 1.2, margine_t: 83.33 }, mesi: [] },
  ] };
  const base = (isAdmin) => ({
    settimana, lettura: { dati: settFinita, errore: '' }, oggi: OGGI,
    quadro: q, erroreQuadro: '', cruscotto: C, erroreCruscotto: '',
    voci: L.unisciVoci(C.da_gestire, L.vociDalMargine(margine, isAdmin)), mesiAttiva: C.mesi_attiva, notaAttiva: '', annoInCorso: true,
    margine: isAdmin ? margine : null, erroreMargine: '', isAdmin, utente: 'Prova Rossi',
  });
  argomenti = L.R.argomentiRiepilogoPdf(base(false));
  const pdf = await pdfDi(argomenti);
  const admin = await pdfDi(L.R.argomentiRiepilogoPdf(base(true)));
  if (process.env.MOSTRA) console.log(pdf.testi.join('\n'));
  const T1 = 'Rete — la settimana dal 05/10/2026 all\'11/10/2026';
  const titoli = [T1, 'Rete — chi ha raccolto nella settimana', 'Rete — il contratto Ecotyre 2026', 'Rete — il mese della settimana', 'Rete — regioni: target, scarto e la settimana',
    'Rete — raccoglitori più indietro', 'Rete — raccoglitori più avanti', 'ACI — autodemolitori (un canale a sé, non si somma alla rete)', 'Extra raccolta (sempre a parte)',
    'Impianti — quadratura e da dichiarare', 'Da gestire —', 'Ordini rimasti «eseguito» a portale: 25 ID', 'Fatturazione attiva verso Ecotyre 2026 — mesi per canale', 'Come si leggono questi numeri'];
  const posizioni = titoli.map(x => pdf.tutto.indexOf(x));
  verifica('le sezioni ci sono tutte, nell\'ordine', posizioni.every((p, i) => p >= 0 && (i === 0 || p > posizioni[i - 1])), J(titoli.filter((x, i) => posizioni[i] < 0)));
  verifica('il titolo, la settimana e il nome del file', pdf.tutto.includes('Riepilogo della settimana 41 del 2026') && pdf.tutto.includes('Da lunedì 05/10/2026 a domenica 11/10/2026') && pdf.nome === 'Riepilogo settimana 41 2026 - dal 05-10-2026 al 11-10-2026.pdf', pdf.nome);
  verifica('la testa del corredo comune: il periodo per fine trasporto, i dati fino al, chi l\'ha generato, «Pagina x di N»', pdf.tutto.includes('Periodo: dal 05/10/2026 all\'11/10/2026, per fine trasporto') && pdf.tutto.includes('Dati fino al 08/10/2026') && /Generato il \d\d\/\d\d\/\d{4} alle \d\d:\d\d da Prova Rossi/.test(pdf.tutto) && pdf.tutto.includes(`Pagina 1 di ${pdf.pagine}`) && pdf.tutto.includes('SMOCO S.r.l.'), pdf.testi.slice(0, 12).join(' | '));
  // La settimana giorno per giorno: i dati arrivano a giovedi' 08/10.
  const giorni = parte(pdf.tutto, T1, 'Rete — chi ha raccolto');
  verifica('giorno per giorno: lunedì 5,00 t, martedì 6,00 t (Calabria e Sicilia), mercoledì 0,00, giovedì 1,00', /lunedì 05\/10\/2026 5,00 1 /.test(giorni) && /martedì 06\/10\/2026 6,00 2 /.test(giorni) && /mercoledì 07\/10\/2026 0,00 0 /.test(giorni) && /giovedì 08\/10\/2026 1,00 1 /.test(giorni), giorni);
  verifica('venerdì, sabato e domenica, che i dati non coprono: «—», non zero', /venerdì 09\/10\/2026 — — /.test(giorni) && /sabato 10\/10\/2026 — — /.test(giorni) && /domenica 11\/10\/2026 — — /.test(giorni), giorni);
  verifica('il totale della settimana fino a giovedì: 12,00 t, 4 ritiri', /Settimana, fino all'08\/10\/2026 12,00 4/.test(giorni), giorni);
  const chi = parte(pdf.tutto, 'Rete — chi ha raccolto', 'Rete — il contratto');
  verifica('chi ha raccolto: ALFA 6,25 su Calabria e Campania, BETA 5,00, GAMMA 0,75, e il totale', chi.includes('ALFA SRL Calabria, Campania 6,25 2') && chi.includes('BETA SRL Puglia 5,00 1') && chi.includes('GAMMA SRL Sicilia 0,75 1') && chi.includes('Totale rete della settimana 12,00 4'), chi);
  // I numeri dell'anno sono quelli della dashboard: le cifre della sezione Rete
  // (cifreRete) e la tessera, come le disegna la pagina.
  const contratto = parte(pdf.tutto, 'Rete — il contratto Ecotyre 2026', 'Rete — il mese');
  const cifre = L.cifreRete(q.rete, { annoInCorso: true });
  const aVideo = html(L.disegna('SezioneRete', { quadro: q, arretrato: null, annoInCorso: true }));
  const tessera = html(L.disegna('QuadroInBreve', { quadro: q, impianti: null, annoInCorso: true, caricamento: false, onVai() {} }));
  verifica('il contratto: le cifre della dashboard, una per una, con la stessa scrittura', cifre.length >= 7 && cifre.every(c => contratto.includes(`${c.etichetta} ${String(c.valore).replace(/[▲▼]\s*/g, '')}`) && aVideo.includes(String(c.valore).replace(/[▲▼]\s*/g, '').trim().split(' ').slice(-2).join(' '))), J(cifre.map(c => [c.etichetta, c.valore])));
  verifica(`il raccolto dell'anno è quello della tessera: ${tIt(q.rete.raccolto_t)} t su ${tIt(q.rete.target_t)} t`, tessera.includes(`${tIt(q.rete.raccolto_t)} t su ${tIt(q.rete.target_t)} t`) && contratto.includes(`Raccolto ${tIt(q.rete.raccolto_t)} t`) && pdf.tutto.includes(`Rete: raccolto del 2026 ${tIt(q.rete.raccolto_t)} t`), tessera.slice(0, 200));
  verifica('lo scarto sull\'atteso nel riquadro e nella tabella, a parole e col segno', q.rete.atteso && pdf.tutto.includes(`Scarto sull'atteso ${q.rete.atteso.scarto_t >= 0 ? 'avanti' : 'indietro'} di ${tIt(Math.abs(q.rete.atteso.scarto_t))} t`) && pdf.tutto.includes(`Rete: scarto sull'atteso all'08/10 ${q.rete.atteso.scarto_t >= 0 ? '+' : '-'}${tIt(Math.abs(q.rete.atteso.scarto_t))} t`), contratto);
  const mese = parte(pdf.tutto, 'Rete — il mese della settimana', 'Rete — regioni');
  const ottobre = q.rete.mesi[9];
  verifica('il mese della settimana: ottobre, col suo target e il raccolto del quadro', mese.includes(`Ottobre 2026 (all'08/10) ${tIt(ottobre.target_t)} ${tIt(ottobre.atteso_t)} ${tIt(ottobre.raccolto_t)}`), mese);
  // Le regioni: l'anno come la tabella della dashboard, accanto la settimana;
  // la Sicilia della settimana va fra le regioni fuori dal contratto.
  const regioni = parte(pdf.tutto, 'Rete — regioni', 'Rete — raccoglitori più indietro');
  const righeAnno = L.righeRegioni(q.rete);
  const conSett = { Puglia: '5,00', Calabria: '5,25', Campania: '1,00' };
  verifica('ogni regione del contratto: target, atteso, raccolto, scarto del quadro e la settimana', righeAnno.filter(r => !r.fuori).length === 3 && righeAnno.filter(r => !r.fuori).every(r => regioni.includes(`${r.regione} ${tIt(r.target_t)} ${tIt(r.atteso_t)} ${tIt(r.raccolto_t)} ${tIt(r.scarto_t)}`) && new RegExp(`${r.regione} [^A-Z]*% ${conSett[r.regione]}`).test(regioni)), regioni);
  verifica('la Sicilia della settimana: «Fuori dalle regioni del contratto» 0,75', /Fuori dalle regioni del contratto [^A-Z]*0,75/.test(regioni), regioni);
  verifica('il totale della rete: il target del contratto e la settimana', regioni.includes(`Totale rete ${tIt(q.rete.target_t)}`) && /Totale rete .* 12,00/.test(regioni), regioni.slice(-200));
  // Senza riparto nel contratto le righe sono le regioni col raccolto dell'anno:
  // una regione della settimana che non c'e' non e' «fuori dal contratto».
  const senzaRiparto = { ...q, rete: { ...q.rete, regioni: q.rete.regioni.filter(r => r.regione !== 'Calabria').map(r => ({ ...r, target_t: null, atteso_t: null, scarto_t: null, pct_atteso: null })), fuori_contratto: { raccolto_t: 0, regioni: [] } } };
  const sr = parte((await pdfDi(L.R.argomentiRiepilogoPdf({ ...base(false), quadro: senzaRiparto }))).tutto, 'Rete — regioni', 'Rete — raccoglitori più indietro');
  verifica('senza riparto: la Calabria e la Sicilia della settimana sono «Altre regioni della settimana» 6,00, mai «fuori dal contratto»', /Altre regioni della settimana — — — — — 6,00/.test(sr) && !sr.includes('Fuori dalle regioni del contratto'), sr);
  // ACI ed extra raccolta: ognuno a se'.
  const aci = parte(pdf.tutto, 'ACI — autodemolitori', 'Extra raccolta (sempre a parte)');
  verifica('ACI: la settimana 2,50 t con un ritiro fino all\'08/10, l\'anno e la previsione indicativa', aci.includes('Raccolto della settimana 2,50 t 1 ritiro, fino all\'08/10/2026') && aci.includes(`Raccolto del 2026 ${tIt(q.aci.raccolto_t)} t`) && aci.includes(`Previsione indicativa del contratto ACI ${tIt(q.aci.previsione_t)} t`), aci);
  const extra = parte(pdf.tutto, 'Extra raccolta (sempre a parte)', 'Impianti');
  verifica('extra raccolta: venerdì conta (il suo modulo, fino a oggi), la secondaria no: 1,20 t, un intervento', extra.includes('Raccolto della settimana 1,20 t 1 intervento') && extra.includes(`Raccolto del 2026 ${tIt(q.extra.raccolto_t)} t`), extra);
  verifica('nessuna riga o colonna somma i canali', !/totale (dei canali|commessa|generale)|rete \+ aci|rete e aci insieme/i.test(pdf.tutto) && argomenti.sezioni.every(s => !(s.colonne.some(c => /^Rete$/.test(c.titolo)) && s.colonne.some(c => /totale/i.test(c.titolo)))));
  // Impianti: la notte qui non ha scritto, e lo si dice.
  const imp = parte(pdf.tutto, 'Impianti', 'Da gestire');
  verifica('impianti senza il controllo della notte: lo si dice, «—», mai zero', imp.includes('Il controllo della notte non c\'è.') && imp.includes('Quadratura e da dichiarare: —') && !/0,00/.test(imp), imp);
  // Da gestire: le voci del cruscotto, critiche per prime, con la loro frase.
  const dg = parte(pdf.tutto, 'Da gestire —', 'Fatturazione attiva verso Ecotyre');
  const critiche = C.da_gestire.filter(v => v.gravita === 'critico');
  verifica(`da gestire: le ${critiche.length} critiche con la loro frase, e la voce degli eseguiti`, critiche.length > 0 && critiche.every(v => dg.includes(v.titolo) && dg.includes(String(v.dettaglio || '').split(/\s+/).slice(0, 6).join(' '))) && dg.includes('Ordini in «eseguito» a portale'), dg.slice(0, 600));
  const ids = Array.from({ length: 25 }, (_, i) => `ES${String(i + 1).padStart(3, '0')}`);
  verifica('tutti i 25 ID degli eseguiti, anche oltre i dieci della voce', ids.every(id => dg.includes(id)), ids.filter(id => !dg.includes(id)).join(', '));
  verifica('le voci del margine non ci sono nella copia di chi non è amministratore', !/senza tariffa|anomalia in passiva|anomalie in passiva/.test(pdf.tutto));
  const fatt = parte(pdf.tutto, 'Fatturazione attiva verso Ecotyre 2026', 'Come si leggono');
  verifica('fatturazione: i mesi finiti per canale e il mese in corso', fatt.includes('Settembre da elaborare da elaborare da elaborare non caricata') && fatt.includes('Ottobre 2026, in corso in corso in corso in corso'), fatt.slice(0, 400));
  // La copia di chi non e' amministratore: niente costi, niente margine, niente euro.
  verifica('chi non è amministratore: niente economia, niente €, ne\' costo, ricavo o margine', !/€|Economia|costo|ricavo|margine/i.test(pdf.tutto) && !argomenti.sezioni.some(s => s.colonne.some(c => c.tipo === 'euro')), pdf.tutto.match(/.{0,40}(€|Economia|costo|ricavo|margine).{0,40}/i)?.[0]);
  verifica('...anche se la pagina gli passasse il margine', (() => { const x = L.R.argomentiRiepilogoPdf({ ...base(false), margine, voci: L.unisciVoci(C.da_gestire, L.vociDalMargine(margine, true)) }); return !x.sezioni.some(s => /Economia/.test(s.titolo) || s.colonne.some(c => c.tipo === 'euro')) && !/senza tariffa|in passiva/.test(J(x.sezioni)); })());
  const eco = parte(admin.tutto, 'Economia della commessa 2026', 'Come si leggono');
  verifica('la copia dell\'amministratore: l\'economia per canale, l\'anno e il mese della settimana, mai sommati', eco.includes('riservata all\'amministratore') && /Rete 2026, fino a oggi 100\.000,00 € 80\.000,00 € 20\.000,00 € 20,0% 1\.012,30 19,76 €/.test(eco) && /Rete Ottobre 2026 1\.000,00 € 900,00 € 100,00 €/.test(eco) && /ACI 2026, fino a oggi 2\.000,00 €/.test(eco) && !/Totale/i.test(eco), eco.slice(0, 500));
  verifica('...e le voci del margine fra quelle da gestire, e il nome del file lo dice', admin.tutto.includes('2 righe senza tariffa') && /con economia \(riservato\)\.pdf$/.test(admin.nome), admin.nome);
  // Una cella del PDF va a capo al massimo tre volte: una frase di 80 parole
  // (piu' di tre righe della colonna) deve arrivare intera, in piu' righe.
  const parole = Array.from({ length: 80 }, (_, i) => `parola${i}`);
  const lunga = { area: 'Prova', gravita: 'critico', titolo: 'Una voce lunga', dettaglio: `${parole.join(' ')} FINE.`, chiave: 'prova:lunga', sezione: 'generale' };
  const conLunga = await pdfDi(L.R.argomentiRiepilogoPdf({ ...base(false), voci: [lunga] }));
  verifica('nessuna frase tagliata: una voce di 80 parole arriva intera', conLunga.tutto.includes('parola79 FINE.') && parole.every(p => new RegExp(`\\b${p}\\b`).test(conLunga.tutto)), parole.filter(p => !new RegExp(`\\b${p}\\b`).test(conLunga.tutto)).join(' '));
  // Una parte non letta lo dice nella sua sezione, mai uno zero.
  const senzaSett = await pdfDi(L.R.argomentiRiepilogoPdf({ ...base(false), lettura: { dati: null, errore: 'Request failed with status code 503' } }));
  const ts = parte(senzaSett.tutto, T1, 'Rete — il contratto');
  verifica('la settimana non letta: la sezione lo dice col perché, nessuno zero, e i riquadri «—»', ts.includes('Il raccolto della settimana non si è potuto leggere: Request failed with status code 503') && !/\d,\d\d/.test(ts) && senzaSett.tutto.includes('Rete: raccolto della settimana —') && senzaSett.tutto.includes(`Rete: raccolto del 2026 ${tIt(q.rete.raccolto_t)} t`), ts);
  const senzaQuadro = await pdfDi(L.R.argomentiRiepilogoPdf({ ...base(false), quadro: null, erroreQuadro: 'tempo scaduto' }));
  verifica('il quadro non letto: «non si è caricato: tempo scaduto», l\'anno «—», «Dati fino al: non disponibile»', senzaQuadro.tutto.includes('Il quadro della commessa non si è caricato: tempo scaduto.') && senzaQuadro.tutto.includes('Rete: raccolto del 2026 —') && senzaQuadro.tutto.includes('Dati fino al: non disponibile'), senzaQuadro.testi.slice(0, 15).join(' | '));
  const senzaCruscotto = await pdfDi(L.R.argomentiRiepilogoPdf({ ...base(false), cruscotto: null, erroreCruscotto: 'archivio Alert non raggiungibile', voci: [], mesiAttiva: null }));
  verifica('il cruscotto non letto: impianti, da gestire e fatturazione lo dicono', senzaCruscotto.tutto.includes('Il controllo della notte non si è potuto leggere: archivio Alert non raggiungibile') && senzaCruscotto.tutto.includes('L\'elenco «Da gestire» non si è potuto leggere: archivio Alert non raggiungibile.') && senzaCruscotto.tutto.includes('I documenti della fatturazione del 2026 non si sono potuti leggere: archivio Alert non raggiungibile.'), senzaCruscotto.tutto.slice(-1500));
  const senzaMargine = await pdfDi(L.R.argomentiRiepilogoPdf({ ...base(true), margine: null, erroreMargine: 'rate limit exceeded' }));
  verifica('il margine non calcolato, nella copia dell\'amministratore: lo dice, nessun euro', senzaMargine.tutto.includes('Il margine non si è potuto calcolare: rate limit exceeded.') && !/€/.test(senzaMargine.tutto));
  verifica('niente «NaN», «undefined», «null» o «Infinity» nel PDF', ![pdf, admin, senzaSett, senzaQuadro, senzaCruscotto].some(x => /\bNaN\b|undefined|\bnull\b|Infinity/.test(x.tutto)), [pdf, admin, senzaSett, senzaQuadro, senzaCruscotto].map(x => (x.tutto.match(/.{0,40}(NaN|undefined|\bnull\b|Infinity).{0,40}/) || [''])[0]).join(' | '));
  verifica('nessun riferimento alla piattaforma nel PDF', !/base44/i.test(pdf.tutto + admin.tutto));
  // A cavallo dell'anno: la settimana dal 29/12/2025 al 04/01/2026, dalla dashboard del 2026.
  const cavallo = L.settimanaDaRiepilogare('2026-01-07', 'finita');
  const x = L.R.argomentiRiepilogoPdf({ ...base(false), settimana: cavallo, oggi: '2026-01-07', lettura: { dati: S.raccoltoDellaSettimana({ dal: cavallo.dal, oggi: '2026-01-07', rete: [riga({ fine: T('2025-12-30'), provincia: 'BA', regione: 'Puglia', trasportatore: 'BETA SRL', peso_effettivo: 2000 }), riga({ fine: T('2026-01-02'), provincia: 'BA', regione: 'Puglia', trasportatore: 'BETA SRL', peso_effettivo: 3000 })], aci: [], extra: [] }), errore: '' } });
  const xc = await pdfDi(x);
  verifica('a cavallo dell\'anno: i sette giorni dal 29/12/2025, tutti e due gli anni nella settimana, la nota dice di quale anno sono i numeri dell\'anno', xc.tutto.includes('Rete — la settimana dal 29/12/2025 al 04/01/2026') && /martedì 30\/12\/2025 2,00 1 /.test(xc.tutto) && /venerdì 02\/01\/2026 3,00 1 /.test(xc.tutto) && xc.tutto.includes('La settimana è a cavallo fra il 2025 e il 2026') && xc.tutto.includes('Riepilogo della settimana 1 del 2026'), parte(xc.tutto, 'Rete — la settimana', 'Rete — chi'));
});

await sezione('5. LA PAGINA: IL PULSANTE PER TUTTI, LA LETTURA SOLO AL CLIC', async () => {
  const pagina = senzaCommenti(sorgente('src/pages/Dashboard.jsx'));
  const comp = senzaCommenti(sorgente('src/components/dashboard/RiepilogoSettimanale.jsx'));
  verifica('la dashboard monta il pulsante, per tutti (fuori da ogni isAdmin)', /^import RiepilogoSettimanale from '@\/components\/dashboard\/RiepilogoSettimanale';$/m.test(pagina) && /<RiepilogoSettimanale oggi=\{oggi\} anno=\{anno\} isAdmin=\{isAdmin\} pronto=\{prontoRiepilogo\} dati=\{datiRiepilogo\} leggiSettimana=\{leggiSettimana\} \/>/.test(pagina) && !/isAdmin && <RiepilogoSettimanale/.test(pagina));
  verifica('la settimana si legge solo dentro leggiSettimana, che la pagina passa al pulsante: mai in un effetto', /const leggiSettimana = useCallback\(\(dal\) => base44\.functions\.invoke\('riepilogoSettimana', \{ dal \}\)/.test(pagina) && (pagina.match(/riepilogoSettimana'/g) || []).length === 1 && !/useEffect\([^]*?leggiSettimana\(/.test(pagina));
  verifica('il pulsante aspetta che ogni lettura abbia risposto, il margine solo per l\'amministratore', /const prontoRiepilogo = !!raccoltaPronta && !!\(cruscotto \|\| erroreCruscotto\) && \(!isAdmin \|\| !!margineAnno \|\| !!margineErrore\);/.test(pagina));
  verifica('il pulsante non chiama funzioni da se\', e il modulo del PDF lo prende al clic', !/functions\.invoke|base44/.test(comp.replace(/^import .*$/gm, '')) && /import\('@\/lib\/riepilogoSettimanale'\)/.test(comp) && !/^import .*riepilogoSettimanale'/m.test(comp));
  const nessunoInTesta = [];
  const gira = (d) => { for (const n of readdirSync(qui('../' + d), { withFileTypes: true })) { const p = `${d}/${n.name}`; if (n.isDirectory()) gira(p); else if (/\.(jsx?|ts)$/.test(n.name) && /^import .*['"]@\/lib\/riepilogoSettimanale['"]/m.test(sorgente(p))) nessunoInTesta.push(p); } };
  gira('src');
  verifica('nessun file importa in testa la libreria del PDF', nessunoInTesta.length === 0, nessunoInTesta.join(', '));
  // Il pulsante disegnato: per tutti, la nota «da girare alla direzione», niente email.
  const props = { oggi: OGGI, anno: 2026, pronto: true, dati: {}, leggiSettimana: async () => ({ dati: null, errore: '' }) };
  const utente = html(L.disegna('RiepilogoSettimanale', { ...props, isAdmin: false }));
  const admin = html(L.disegna('RiepilogoSettimanale', { ...props, isAdmin: true }));
  verifica('chi non è amministratore: il pulsante, le due settimane coi giorni, la nota, niente costi', utente.includes('Riepilogo della settimana (PDF)') && utente.includes('appena finita · 05/10 – 11/10/2026') && utente.includes('in corso · 12/10 – 18/10/2026') && utente.includes('Da girare alla direzione: il PDF si scarica e lo mandi tu, il gestionale non manda email.') && !/costi|margine|€|Economia/.test(utente), utente);
  verifica('l\'amministratore lo sa: la sua copia ha costi e margine', admin.includes('La tua copia, da amministratore, ha anche costi e margine.'));
  const attesa = L.disegna('RiepilogoSettimanale', { ...props, pronto: false, isAdmin: false });
  verifica('finché i numeri non sono arrivati il pulsante aspetta, e lo dice', /<button[^>]*disabled/.test(attesa) && html(attesa).includes('Il riepilogo si prepara quando i numeri della dashboard sono arrivati.'));
  const altroAnno = L.disegna('RiepilogoSettimanale', { ...props, anno: 2025 });
  verifica('guardando il 2025 la settimana del 2026 non si mescola: il pulsante dice di scegliere il 2026', /<button[^>]*disabled/.test(altroAnno) && html(altroAnno).includes('è del 2026: per il riepilogo scegli il 2026'), html(altroAnno));

  // LA PAGINA VERA, MONTATA (prove/dati/paginaFinta.mjs): le richieste che fa
  // all'apertura, che cosa passa al pulsante, e che cosa costa il clic.
  const { caricaPagina, clienteFinto, elementi, aspetta } = await import('./dati/paginaFinta.mjs');
  // La cartella della copia si toglie alla fine, anche se la prova cade (chiusura
  // del 15/10/2026): prima ne restava una nella cartella temporanea a ogni giro.
  const cartellaCopia = mkdtempSync(join(tmpdir(), 'riepilogo-settimana-'));
  const togliCartella = () => rmSync(cartellaCopia, { recursive: true, force: true });
  process.on('exit', togliCartella);
  const copia = join(cartellaCopia, 'Dashboard.jsx');
  const IMPORT_AUTH = "import { useAuth } from '@/lib/AuthContext';";
  verifica('la dashboard prende chi guarda da useAuth (la prova lo sostituisce)', sorgente('src/pages/Dashboard.jsx').includes(IMPORT_AUTH));
  writeFileSync(copia, readFileSync(qui('../src/pages/Dashboard.jsx'), 'utf8').replace(IMPORT_AUTH, 'const useAuth = () => ({ user: globalThis.__UTENTE || null });'));
  // l'elenco unico si fa con la libreria vera delle voci, come a video
  const P = await caricaPagina('pages/Dashboard', { file: copia, reali: ['@/components/dashboard/vociDashboard'] });
  const marginePagina = { anno: 2026, canali: [{ canale: 'RETE', anno: { ricavo: 1, costo: 1, margine: 0, margine_pct: 0, tonnellate: 1, margine_t: 0 }, mesi: [{ mese: 'Ottobre', righe_senza_prezzo: 1, anomalie_passiva: 0 }] }] };
  for (const ruolo of ['user', 'admin']) {
    let cadeLaSettimana = false;
    const f = clienteFinto({ funzioni: {
      getDashboardRaccolta: async () => D, cruscottoOperativo: async () => C, calcolaMargine: async () => marginePagina,
      riepilogoSettimana: async () => { if (cadeLaSettimana) throw Object.assign(new Error('servizio non raggiungibile'), { status: 503 }); return settFinita; },
    } });
    globalThis.__CLIENTE_FINTO = f.cliente;
    globalThis.__UTENTE = { id: 'u-' + ruolo, email: `${ruolo}@prova`, role: ruolo, full_name: 'Prova Rossi' };
    const m = await conOra(ORA, async () => { const x = P.monta(P.Componente, {}); await aspetta(80); return x; });
    const nomi = f.funzioniChiamate().map(c => c.nome).sort();
    verifica(`${ruolo}: all'apertura solo le letture di sempre, niente settimana`, J(nomi) === J(ruolo === 'admin' ? ['calcolaMargine', 'cruscottoOperativo', 'getDashboardRaccolta'] : ['cruscottoOperativo', 'getDashboardRaccolta']), J(nomi));
    // il pulsante sta fra le azioni dell'intestazione
    const intest = [...elementi(m.albero)].find(el => el.type && el.type.__finto === 'IntestazioneCommessa');
    const bottone = intest ? [...elementi(intest.props.azioni)].find(el => el.type && el.type.__finto === 'RiepilogoSettimanale') : null;
    const p = bottone ? bottone.props : {};
    verifica(`${ruolo}: il pulsante c'e', pronto quando tutte le letture hanno risposto, coi numeri gia' letti`, !!bottone && p.pronto === true && p.isAdmin === (ruolo === 'admin') && p.oggi === OGGI && p.anno === 2026
      && p.dati.quadro === D.quadro && p.dati.cruscotto === C && p.dati.mesiAttiva === C.mesi_attiva && p.dati.annoInCorso === true && p.dati.utente === 'Prova Rossi', J(bottone ? { pronto: p.pronto, isAdmin: p.isAdmin, oggi: p.oggi, anno: p.anno } : null));
    verifica(`${ruolo}: le voci sono tutte quelle dell'elenco${ruolo === 'admin' ? ', con quelle del margine' : ', senza il margine'}`, p.dati && p.dati.voci.length === (C.da_gestire.length + (ruolo === 'admin' ? 1 : 0)) && (ruolo === 'admin' ? p.dati.margine === marginePagina : p.dati.margine === null), p.dati && J([p.dati.voci.length, C.da_gestire.length]));
    f.azzera();
    const letta = p.leggiSettimana ? await p.leggiSettimana('2026-10-05') : null;
    verifica(`${ruolo}: il clic costa una chiamata sola, riepilogoSettimana col lunedi'`, J(f.funzioniChiamate().map(c => [c.nome, c.payload])) === J([['riepilogoSettimana', { dal: '2026-10-05' }]]) && letta && letta.dati === settFinita && letta.errore === '', J(f.funzioniChiamate()));
    cadeLaSettimana = true;
    const caduta = p.leggiSettimana ? await p.leggiSettimana('2026-10-05') : null;
    verifica(`${ruolo}: una lettura che cade torna col perche', e il PDF lo dira'`, caduta && caduta.dati === null && /servizio non raggiungibile/.test(caduta.errore), J(caduta));
    m.smonta();
  }
  delete globalThis.__UTENTE;
  togliCartella();
  verifica('la cartella temporanea della copia della dashboard non resta', !existsSync(cartellaCopia), cartellaCopia);
});

await sezione('6. SUI DATI VERI DELL\'11/10/2026', async () => {
  const CARTELLA = process.env.DATI_VERI || qui('../../dati-veri/');
  const copie = existsSync(CARTELLA) ? readdirSync(CARTELLA).filter(x => /^treadrider-dati-veri-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(x)).sort() : [];
  if (!copie.length) { console.log(`  Nessuna copia dei dati veri in ${CARTELLA}: sezione saltata.`); return; }
  const copia = copie[copie.length - 1];
  const DATI = JSON.parse(gunzipSync(readFileSync(CARTELLA + copia)).toString('utf8'));
  const A = DATI.archivi;
  const ora = DATI.meta.letto_fino_al;
  const oggi = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new OraVera(ora));
  const annoV = Number(oggi.slice(0, 4));
  console.log(`  Copia: ${copia}, letta il ${ora} (oggi ${oggi})`);
  const raccolta = await caricaFunzione('getDashboardRaccolta');
  const cruscotto = await caricaFunzione('cruscottoOperativo');
  const margineF = await caricaFunzione('calcolaMargine');
  const R = await raccolta({ anno: [annoV] }, { archivi: A, ruolo: 'user', ora });
  const letturaQuadro = globalThis.__LETTURE.length;
  const K = await cruscotto({}, { archivi: A, ruolo: 'user', ora });
  const M = await margineF({ anno: annoV }, { archivi: A, ruolo: 'admin', ora });
  verifica('quadro, cruscotto e margine rispondono sui dati veri', R.stato === 200 && R.j.quadro && K.stato === 200 && M.stato === 200, J([R.j.error, K.j.error, M.j.error]));
  const q = R.j.quadro;
  const { giornoRoma } = await import('../base44/shared/giornoItaliano.ts');
  // Il raccolto di una settimana rifatto qui dall'archivio intero, senza la funzione.
  const aMano = (righe, dal, al, filtro = () => true) => {
    const dentro = righe.filter(r => String(r.stato || '').toLowerCase() === 'terminato' && filtro(r) && giornoRoma(r.trasporto_finito_il) >= dal && giornoRoma(r.trasporto_finito_il) <= al && giornoRoma(r.trasporto_finito_il) <= oggi);
    return { t: Math.round(dentro.reduce((s, r) => s + (Number(r.peso_effettivo) || 0), 0)) / 1000, ordini: new Set(dentro.map((r, i) => r.id_ordine || r.numero_fir || `riga${i}`)).size };
  };
  const misure = [];
  for (const quale of ['finita', 'in_corso']) {
    const settimana = L.settimanaDaRiepilogare(oggi, quale);
    const W = await F({ dal: settimana.dal }, { archivi: A, ruolo: 'user', ora });
    misure.push(`${quale} ${settimana.dal}-${settimana.al}: ${W.letture.length} letture, righe ${J(W.j.righe_lette)}`);
    const atteso = aMano(A.PrimariaRete || [], settimana.dal, settimana.al);
    const attesoAci = aMano(A.PrimariaAci || [], settimana.dal, settimana.al);
    const attesoExtra = aMano(A.ExtraRaccolta || [], settimana.dal, settimana.al, r => String(r.tipo_movimento || 'primaria').toLowerCase() !== 'secondaria');
    verifica(`settimana ${quale} (${settimana.dal} - ${settimana.al}): rete ${atteso.t} t e ${atteso.ordini} ritiri, come dall'archivio intero`, W.stato === 200 && W.j.rete.t === atteso.t && W.j.rete.ritiri === atteso.ordini && W.j.aci.t === attesoAci.t && W.j.extra.t === attesoExtra.t, J([W.j.rete && W.j.rete.t, W.j.rete && W.j.rete.ritiri, atteso, W.j.aci && W.j.aci.t, attesoAci, W.j.extra && W.j.extra.t, attesoExtra]));
    verifica(`settimana ${quale}: tre letture, una pagina per archivio`, W.letture.length === 3, J(W.letture.map(l => l.nome)));
    verifica(`settimana ${quale}: le regioni e i raccoglitori fanno il totale, al chilo`, Math.round(W.j.rete.regioni.reduce((s, r) => s + r.t, 0) * 1000) === Math.round(W.j.rete.t * 1000) && Math.round(W.j.rete.raccoglitori.reduce((s, r) => s + r.t, 0) * 1000) === Math.round(W.j.rete.t * 1000));
    for (const isAdmin of [false, true]) {
      const voci = L.unisciVoci(K.j.da_gestire || [], L.vociDalMargine(M.j, isAdmin));
      const arg = L.R.argomentiRiepilogoPdf({ settimana, lettura: { dati: W.j, errore: '' }, oggi, quadro: q, cruscotto: K.j, voci, mesiAttiva: K.j.mesi_attiva, annoInCorso: true, margine: isAdmin ? M.j : null, isAdmin, utente: 'Prova' });
      const pdf = await pdfDi(arg);
      if (process.env.MOSTRA && quale === 'finita' && !isAdmin) console.log(pdf.testi.join('\n'));
      const chi = isAdmin ? 'amministratore' : 'altro utente';
      verifica(`${quale}, ${chi}: niente «NaN», «undefined», «null», «Infinity»`, !/\bNaN\b|undefined|\bnull\b|Infinity/.test(pdf.tutto), (pdf.tutto.match(/.{0,40}(NaN|undefined|\bnull\b|Infinity).{0,40}/) || [''])[0]);
      verifica(`${quale}, ${chi}: il raccolto della settimana del PDF e' quello dell'archivio, e l'anno quello della dashboard (${tIt(q.rete.raccolto_t)} t)`, pdf.tutto.includes(`Rete: raccolto della settimana ${tIt(atteso.t)} t`) && pdf.tutto.includes(`Rete: raccolto del ${annoV} ${tIt(q.rete.raccolto_t)} t`), pdf.testi.slice(0, 30).join(' | '));
      const cifre = L.cifreRete(q.rete, { annoInCorso: true });
      verifica(`${quale}, ${chi}: le cifre della rete della dashboard, tutte`, cifre.every(c => pdf.tutto.includes(`${c.etichetta} ${String(c.valore).replace(/[▲▼]\s*/g, '')}`)), cifre.filter(c => !pdf.tutto.includes(`${c.etichetta} ${String(c.valore).replace(/[▲▼]\s*/g, '')}`)).map(c => c.etichetta).join(', '));
      if (!isAdmin) verifica(`${quale}, ${chi}: niente €, niente economia, ne' costo, ricavo o margine`, !/€|Economia|costo|ricavo|margine/i.test(pdf.tutto), (pdf.tutto.match(/.{0,40}(€|Economia|costo|ricavo|margine).{0,40}/i) || [''])[0]);
      else verifica(`${quale}, ${chi}: l'economia dei tre canali, coi numeri del margine`, M.j.canali.every(c => pdf.tutto.includes(`${({ RETE: 'Rete', ACI: 'ACI', EXTRA_RACCOLTA: 'Extra raccolta' })[c.canale]} ${annoV}, fino a oggi`)) && /€/.test(pdf.tutto));
      const imp = K.j.impianti;
      if (imp && imp.stato === 'fresca') {
        verifica(`${quale}, ${chi}: impianti come la dashboard: «Rete: quadratura con il portale ${imp.quadrano} su ${imp.con_confronto}», da dichiarare rete ${tIt(imp.da_dichiarare.RETE.t)} t`, pdf.tutto.includes(`Rete: quadratura con il portale ${imp.quadrano} su ${imp.con_confronto}`) && pdf.tutto.includes(`Da dichiarare · Rete ${tIt(imp.da_dichiarare.RETE.t)} t`), parte(pdf.tutto, 'Impianti', 'Da gestire'));
      }
      const critiche = voci.filter(v => v.gravita === 'critico');
      verifica(`${quale}, ${chi}: le ${critiche.length} voci critiche, col titolo`, critiche.every(v => pdf.tutto.includes(v.titolo)), critiche.filter(v => !pdf.tutto.includes(v.titolo)).map(v => v.titolo).join(' | '));
      const es = voci.find(v => v.chiave === 'eseguiti');
      if (es && (es.elementi || []).length) verifica(`${quale}, ${chi}: tutti i ${es.elementi.length} ID degli eseguiti`, es.elementi.every(id => pdf.tutto.includes(id)));
      if (quale === 'in_corso') {
        const ultimo = q.giorno_dati;
        const dopo = settimana.giorni.filter(g => g.giorno > ultimo);
        verifica(`in corso: i giorni dopo i dati (${ultimo}) sono «—»`, dopo.length > 0 && dopo.every(g => new RegExp(`${g.nome} ${g.giorno.split('-').reverse().join('/')} — —`).test(pdf.tutto)), dopo.map(g => g.giorno).join(','));
      }
    }
  }
  console.log(`  Quanto legge il clic: ${misure.join(' · ')}; il quadro all'apertura fa ${letturaQuadro} letture (${(A.PrimariaRete || []).length} righe di rete in archivio).`);
});

// ─── 7. IL PDF SI LEGGE TUTTO (revisione del 15/10/2026) ───
// Il revisore ha trovato due difetti che nessuna prova toccava. Il meno
// tipografico di tSegno (U+2212), che i caratteri standard del PDF non hanno:
// jspdf scriveva allora la stringa intera in due byte per lettera, e «Non
// quadra: … −37,773 t» usciva illeggibile, come una variazione del consorzio in
// meno («(−100,00 t)») nella cella del target e nella nota. E le celle oltre le
// tre righe, che esportaSezioniPdf lascia cadere: «Caricati dopo la notte» coi
// cinque archivi del lunedi' mattina, il titolo di una voce lunga. Qui quei casi
// col jspdf vero; poi ogni PDF fatto dalla prova (sezioni 4, 6 e 7, dati veri
// compresi): nessuna riga in due byte, ogni testo coi caratteri del PDF, nessuna
// cella oltre le tre righe, nessun titolo fuori dalla pagina.
const WIN_ANSI_ALTI = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
const carattereDelPdf = (c) => { const k = c.charCodeAt(0); return c.length === 1 && ((k >= 0x20 && k <= 0x7e) || (k >= 0xa0 && k <= 0xff) || WIN_ANSI_ALTI.includes(c)); };
const testiDegliArgomenti = (a) => [a.titolo, a.sottotitolo, ...a.riepilogo.flatMap(r => [r.etichetta, r.valore]), ...a.sezioni.flatMap(s => [s.titolo, ...s.colonne.map(c => c.titolo), ...s.righe.flatMap(r => r.celle)]), ...a.note, a.documento.periodo, a.documento.stato.utente, ...(a.documento.stato.caricamenti_aperti || []).map(x => x.titolo)].filter(x => typeof x === 'string');
/** Quello che esportaSezioniPdf taglierebbe: le stesse larghezze, lo stesso corpo, lo stesso stile. */
const tagliDelPdf = (doc, a) => {
  const W = doc.internal.pageSize.getWidth(), M = 10;
  const tagli = [];
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
  const testa = doc.getTextWidth(a.titolo);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  if (testa + doc.getTextWidth(a.sottotitolo || '') + 10 > W - 2 * M) tagli.push({ dove: 'testata', testo: a.titolo });
  const riquadro = (W - 2 * M) / a.riepilogo.length - 2 - 3;
  for (const r of a.riepilogo) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2);
    if (doc.getTextWidth(r.etichetta) > riquadro) tagli.push({ dove: 'riquadro', testo: r.etichetta });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    if (typeof r.valore === 'string' && doc.getTextWidth(r.valore) > riquadro) tagli.push({ dove: 'riquadro', testo: r.valore });
  }
  for (const s of a.sezioni) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    if (doc.getTextWidth(`${s.titolo} (segue)`) > W - 2 * M) tagli.push({ dove: 'titolo della sezione', testo: s.titolo });
    const tot = s.colonne.reduce((t, c) => t + (c.peso || 1), 0);
    const larg = s.colonne.map(c => ((W - 2 * M) * (c.peso || 1)) / tot);
    doc.setFontSize(7.2);
    s.colonne.forEach((c, i) => { if (doc.splitTextToSize(c.titolo, larg[i] - 3).length > 2) tagli.push({ dove: `${s.titolo}: titolo della colonna`, testo: c.titolo }); });
    for (const r of s.righe) {
      doc.setFont('helvetica', r.stile ? 'bold' : 'normal'); doc.setFontSize(7.4);
      r.celle.forEach((v, i) => {
        if (typeof v !== 'string' || !v) return;
        const righe = doc.splitTextToSize(v, larg[i] - 3);
        if (righe.length > 3) tagli.push({ dove: `${s.titolo} / ${s.colonne[i].titolo}`, righe: righe.length, perso: righe.slice(3).join(' ') });
      });
    }
  }
  return tagli;
};

await sezione('7. IL PDF SI LEGGE TUTTO: IL MENO, LE CELLE LUNGHE, OGNI PDF DELLA PROVA', async () => {
  const { jsPDF } = await import(jspdf);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const q = D.quadro;
  const settimana = L.settimanaDaRiepilogare(OGGI, 'finita');
  const base = (x = {}) => ({ settimana, lettura: { dati: settFinita, errore: '' }, oggi: OGGI, quadro: q, erroreQuadro: '', cruscotto: C, erroreCruscotto: '',
    voci: C.da_gestire, mesiAttiva: C.mesi_attiva, notaAttiva: '', annoInCorso: true, margine: null, erroreMargine: '', isAdmin: false, utente: 'Prova Rossi', ...x });
  // Il lunedi' mattina: la notte e' fresca, un impianto ha la giacenza calcolata
  // sotto quella del portale e uno sopra, uno stoccaggio e' sotto zero, e i
  // cinque archivi della fotografia sono stati caricati dopo la notte.
  const ARCHIVI_DOPO = [['primarie', 'Primarie e assegnati'], ['secondarie', 'Secondarie'], ['terziarie', 'Terziarie'], ['ordini_non_dichiarati', 'Ordini non dichiarati'], ['dichiarazioni_trattamento', 'Dichiarazioni di trattamento']];
  const notte = { stato: 'fresca', giorno: OGGI, perche: '', quadrano: 4, con_confronto: 6,
    scostamenti: [{ sito: 'IRIGOM SRL', scarto_t: -37.773, calcolata_t: 100, portale_t: 137.773, stoccaggio: false }, { sito: 'NAPPI SUD SRL', scarto_t: 12.5, calcolata_t: 50, portale_t: 37.5, stoccaggio: true }],
    aci_stoccaggi: { quadrano: 1, con_confronto: 1 }, da_dichiarare: { RETE: { t: 10, impianti: 1 }, ACI: { t: 0, impianti: 0 }, EXTRA_RACCOLTA: { t: 0, impianti: 0 } },
    sotto_zero: [{ sito: 'NAPPI SUD SRL', canale: 'RETE', giacenza_t: -1.5 }],
    caricati_dopo: ARCHIVI_DOPO.map(([tipo_file, nome]) => ({ tipo_file, nome, il: '2026-10-14T06:30:00' })) };
  // Una variazione del consorzio in meno (VariazioneContratto.jsx: «Tonnellate in più o in meno»).
  const conVariazione = { ...q, rete: { ...q.rete, variazioni: [{ mese_idx: 9, mese: 'Ottobre', regione: 'Puglia', t: -100, motivo: 'riduzione del consorzio', comunicata_il: '2026-10-14' }] } };
  // La voce della prefattura a gennaio, coi dodici mesi dell'anno prima nel titolo
  // (cruscotto.ts), e una frase lunga accanto.
  const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
  const prefattura = { area: 'Fatturazione attiva', gravita: 'info', titolo: `Prefattura Ecotyre non caricata: ${MESI.map(m => `${m} 2026`).join(', ')}`, dettaglio: `Il confronto con la prefattura si fa prima di esportare: ${Array.from({ length: 90 }, (_, i) => `passo${i}`).join(' ')} FINE.`, chiave: 'attiva:prefattura', sezione: 'fatturazione' };
  const voci = [...C.da_gestire, prefattura];
  const arg = L.R.argomentiRiepilogoPdf(base({ cruscotto: { ...C, impianti: notte }, quadro: conVariazione, voci }));
  const pdf = await pdfDi(arg);
  if (process.env.MOSTRA) console.log(pdf.testi.join('\n'));
  const imp = parte(pdf.tutto, 'Impianti', 'Da gestire');
  verifica('lo scarto in meno si legge: «Non quadra: IRIGOM SRL -37,773 t», come il PDF del quadro', imp.includes('Non quadra: IRIGOM SRL -37,773 t calcolata 100,00 t, portale 137,773 t'), imp);
  verifica('...e quello in più resta com\'era: «+12,50 t»; la giacenza sotto zero «-1,50 t»', imp.includes('Non quadra: NAPPI SUD SRL (stoccaggio) +12,50 t') && imp.includes('Giacenza sotto zero: NAPPI SUD SRL, Rete -1,50 t'), imp);
  const contratto = parte(pdf.tutto, 'Rete — il contratto Ecotyre 2026', 'Rete — il mese');
  verifica('la variazione in meno si legge sotto il target: «Puglia (-100,00 t)»', contratto.includes('compresa la variazione del consorzio di ottobre in Puglia (-100,00 t)'), contratto.slice(0, 400));
  verifica('...e nella nota, intera', pdf.tutto.includes('Il contratto 2026 comprende una variazione del consorzio: ottobre, Puglia -100,00 t (riduzione del consorzio, comunicata il 14/10/2026). Senza, il target sarebbe'), (pdf.tutto.match(/Il contratto 2026 comprende.{0,160}/) || ['(non trovata)'])[0]);
  verifica('nessuna riga di questo PDF scritta in due byte per lettera', pdf.dueByte.length === 0, pdf.dueByte.slice(0, 3).map(l => J(l).slice(0, 120)).join(' | '));
  const sImp = arg.sezioni.find(s => /^Impianti/.test(s.titolo));
  const caricati = sImp ? sImp.righe.filter((r, i, tutte) => r.celle[0] === 'Caricati dopo la notte' || (r.celle[0] === '' && tutte.slice(0, i).some(x => x.celle[0] === 'Caricati dopo la notte'))).map(r => r.celle[1]) : [];
  verifica('i cinque archivi caricati dopo la notte, uno per riga, tutti nel PDF', J(caricati) === J(ARCHIVI_DOPO.map(([, nome]) => `${nome} (14/10)`)) && ARCHIVI_DOPO.every(([, nome]) => imp.includes(`${nome} (14/10)`)), J(caricati));
  // La voce lunga: il titolo e la frase continuano nelle righe sotto, e tornano interi.
  const sDg = arg.sezioni.find(s => /^Da gestire/.test(s.titolo));
  const i0 = sDg ? sDg.righe.findIndex(r => String(r.celle[2]).startsWith('Prefattura Ecotyre non caricata')) : -1;
  const sue = i0 < 0 ? [] : [sDg.righe[i0], ...sDg.righe.slice(i0 + 1).filter((r, k, resto) => resto.slice(0, k + 1).every(x => x.celle[0] === '' && x.celle[1] === ''))];
  const unisci = (col) => sue.map(r => r.celle[col]).filter(Boolean).join(' ');
  verifica('il titolo lungo della voce continua nelle righe sotto e torna intero, come la frase', sue.length > 1 && unisci(2) === prefattura.titolo && unisci(3) === prefattura.dettaglio, J(sue.map(r => r.celle.slice(2))).slice(0, 400));
  verifica('...e nel PDF ci sono tutti i dodici mesi e la frase fino in fondo', MESI.every(m => parte(pdf.tutto, 'Da gestire —', 'Fatturazione attiva verso Ecotyre').includes(`${m} 2026`)) && pdf.tutto.includes('passo89 FINE.'), MESI.filter(m => !pdf.tutto.includes(`${m} 2026`)).join(', '));
  // Un margine in perdita, nella copia dell'amministratore: il meno dei numeri si legge.
  const perdita = { anno: 2026, canali: [{ canale: 'RETE', anno: { ricavo: 1000, costo: 3500.5, margine: -2500.5, margine_pct: -250.05, tonnellate: 10, margine_t: -250.05 }, mesi: [] }] };
  const admin = await pdfDi(L.R.argomentiRiepilogoPdf(base({ isAdmin: true, margine: perdita, cruscotto: { ...C, impianti: notte }, quadro: conVariazione })));
  verifica('la copia dell\'amministratore, con la notte e la variazione in meno: un margine in perdita si legge («-2.500,50 €»), nessuna riga in due byte', admin.tutto.includes('Rete 2026, fino a oggi 1.000,00 € 3.500,50 € -2.500,50 €') && admin.dueByte.length === 0, parte(admin.tutto, 'Economia', 'Come si leggono').slice(0, 300));
  // UN MARGINE CON PREZZI MANCANTI E' «—», COL PERCHE' (prova del cambio d'anno,
  // 15/10/2026, difetto 18). Il 15/01/2027 la rete usciva [0, 0, 0, —] e
  // l'extra raccolta con un margine di -113,50 € fatto da un ricavo che mancava.
  // Il margine come lo da' il calcolo (margine.ts) quando mancano dei prezzi.
  const mancano = { anno: 2026, canali: [
    { canale: 'RETE', anno: { ricavo: 0, costo: 0, margine: null, margine_pct: null, tonnellate: 7.1, margine_t: null, parziale: true, prezzi_mancanti: 7,
      testo_prezzi_mancanti: '7 righe senza prezzo (3 dell\'attiva, 4 della passiva): margine non calcolabile', testo_da_confermare: '' }, mesi: [] },
    { canale: 'EXTRA_RACCOLTA', anno: { ricavo: 147, costo: 260.5, margine: null, margine_pct: null, tonnellate: 1.3, margine_t: null, parziale: true, prezzi_mancanti: 1,
      testo_prezzi_mancanti: '1 riga senza prezzo (1 dell\'attiva): margine non calcolabile', testo_da_confermare: '2 righe con la tariffa copiata dal 2025, da confermare in Target & Status › Nuovo anno' }, mesi: [] },
  ] };
  const argMancano = L.R.argomentiRiepilogoPdf(base({ isAdmin: true, margine: mancano }));
  const sEco = argMancano.sezioni.find(s => /^Economia/.test(s.titolo));
  const rigaRete = sEco && sEco.righe.find(r => r.celle[0] === 'Rete');
  const rigaExtra = sEco && sEco.righe.find(r => r.celle[0] === 'Extra raccolta');
  verifica('Economia con prezzi mancanti: margine, % ed €/t «—», ricavo e costo restano, e la nota dice perche\'', !!rigaRete && rigaRete.celle[4] === '—' && rigaRete.celle[5] === '—' && rigaRete.celle[7] === '—'
    && rigaRete.celle[2] === 0 && rigaRete.celle[8] === '7 righe senza prezzo (3 dell\'attiva, 4 della passiva): margine non calcolabile; ricavo e costo parziali', J(rigaRete));
  // una nota lunga continua nelle righe sotto (sezionePerIlPdf): si rimette insieme
  const iExtra = sEco ? sEco.righe.indexOf(rigaExtra) : -1;
  const notaExtra = iExtra < 0 ? '' : [rigaExtra, ...sEco.righe.slice(iExtra + 1).filter((r, k, resto) => resto.slice(0, k + 1).every(x => x.celle[0] === ''))].map(r => r.celle[8]).filter(Boolean).join(' ');
  verifica('...l\'extra raccolta non mostra il margine negativo di un ricavo che manca, e dice le tariffe da confermare', !!rigaExtra && rigaExtra.celle[4] === '—'
    && notaExtra === '1 riga senza prezzo (1 dell\'attiva): margine non calcolabile; ricavo e costo parziali; 2 righe con la tariffa copiata dal 2025, da confermare in Target & Status › Nuovo anno', notaExtra);
  const pdfMancano = await pdfDi(argMancano);
  const ecoMancano = parte(pdfMancano.tutto, 'Economia della commessa', 'Come si leggono');
  verifica('...e nel PDF: «margine non calcolabile», nessun -113,50, nessuna riga in due byte', ecoMancano.includes('margine non calcolabile') && !/-113,50/.test(ecoMancano) && pdfMancano.dueByte.length === 0, ecoMancano.slice(0, 400));
  const rigaPiena = (L.R.argomentiRiepilogoPdf(base({ isAdmin: true, margine: perdita })).sezioni.find(s => /^Economia/.test(s.titolo)) || { righe: [] }).righe[0];
  verifica('controprova: con tutti i prezzi la nota e\' vuota e il margine e\' il numero', !!rigaPiena && rigaPiena.celle[4] === -2500.5 && rigaPiena.celle[8] === '', J(rigaPiena));
  // L'ACI col contratto copiato dall'anno prima e non ancora confermato
  // (quadro.aci.da_confermare): la previsione e' quella dell'anno prima.
  const aciDi = (quadro) => parte((L.R.argomentiRiepilogoPdf(base({ quadro })).sezioni.find(s => /^ACI/.test(s.titolo)) || { righe: [] }).righe.map(r => r.celle.join(' ')).join(' | '), 'Previsione indicativa', ' | ') || '';
  const aciCopiata = aciDi({ ...q, aci: { ...q.aci, da_confermare: true } });
  verifica('ACI col contratto copiato: «previsione copiata dal 2025, da confermare»', aciCopiata.includes('previsione copiata dal 2025, da confermare'), aciCopiata);
  verifica('controprova: col contratto confermato la previsione non dice «copiata»', !/copiata/.test(aciDi(q)), aciDi(q));
  // Chi genera con un nome fuori dalla codifica: il piede resta leggibile.
  const nome = await pdfDi(L.R.argomentiRiepilogoPdf(base({ utente: 'Ștefan Łukasz' })));
  verifica('un nome fuori dalla codifica nel piede: «da Stefan Lukasz», leggibile', /da Stefan Lukasz/.test(nome.tutto) && nome.dueByte.length === 0, nome.testi.slice(0, 12).join(' | '));

  // OGNI PDF FATTO DALLA PROVA, dati veri compresi.
  const conDueByte = PRODOTTI.filter(p => p.dueByte.length);
  console.log(`  PDF fatti dalla prova e guardati qui: ${PRODOTTI.length}.`);
  verifica(`nessuno dei ${PRODOTTI.length} PDF della prova ha una riga scritta in due byte per lettera`, PRODOTTI.length >= 12 && conDueByte.length === 0, conDueByte.map(p => `${p.nome}: ${J(p.dueByte[0]).slice(0, 100)}`).join(' | '));
  const fuori = PRODOTTI.flatMap(p => testiDegliArgomenti(p.argomenti).filter(x => ![...x].every(carattereDelPdf)).map(x => `${p.nome}: ${x.slice(0, 80)}`));
  verifica('ogni testo degli argomenti ha solo caratteri che il PDF sa scrivere', fuori.length === 0, fuori.slice(0, 5).join(' | '));
  const tagli = PRODOTTI.flatMap(p => tagliDelPdf(doc, p.argomenti).map(x => ({ ...x, pdf: p.nome })));
  verifica('nessuna cella oltre le tre righe, nessun titolo di colonna oltre le due, nessun titolo o riquadro fuori dalla sua larghezza', tagli.length === 0, J(tagli.slice(0, 4)));
});

// ─── 8. LE MISURE DEL RIEPILOGO CONTRO IL JSPDF VERO ───
// perIlPdf e pezziDellaCella (src/lib/riepilogoSettimanale.js): la stima delle
// righe non deve mai stare sotto quella di jspdf, altrimenti un pezzo va oltre
// le tre righe e perde la coda; e i pezzi rimessi insieme sono il testo intero.
await sezione('8. LE MISURE DEL RIEPILOGO CONTRO IL JSPDF VERO', async () => {
  const { jsPDF } = await import(jspdf);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const { perIlPdf, pezziDellaCella, righeDelTesto } = L.R;
  const casi = [['−37,773 t', '-37,773 t'], ['Puglia (−100,00 t)', 'Puglia (-100,00 t)'], ['▲ avanti di 3,00 t', 'avanti di 3,00 t'], ['Ștefan Łukasz', 'Stefan Lukasz'], ['a → b … c ≥ d', 'a > b ... c >= d'],
    ['riga uno\nriga due', 'riga uno riga due'], ['à è é ì ò ù « » — – € ’ · °', 'à è é ì ò ù « » — – € ’ · °'], ['✓ fatto', '? fatto']];
  verifica('perIlPdf: il meno e i segni che il PDF non ha diventano caratteri suoi, il resto non cambia', casi.every(([da, a]) => perIlPdf(da) === a), J(casi.filter(([da, a]) => perIlPdf(da) !== a).map(([da]) => [da, perIlPdf(da)])));
  // Testi a caso ma sempre gli stessi: maiuscole larghe, cifre, accenti, parole piu' larghe della colonna.
  const PAROLE = ['IRIGOM', 'SRL', 'NAPPI', 'SUD', 'Dichiarazioni', 'trattamento', '(19/10),', 'mmmmmm', 'WWWWWW', '21345678,', 'è', 'perché', 'già', '—', '«eseguito»', 'Ottobre', '2026', 'l\'archivio', 'Giacenze', 'MMMMMMMMMMMM', 'iiiii', '€', '100.000,00', 'W'.repeat(60), '1'.repeat(150), 'à-è-ò', '%%%%', '@@@'];
  let seme = 12345;
  const caso = () => { seme = (seme * 1103515245 + 12345) % 2147483648; return seme / 2147483648; };
  const LARGHEZZE = [10, 20, 30.97, 49.8, 74.08, 133.2, 274];
  const sbagli = [], persi = [], sotto = [];
  let stimate = 0, vere = 0;
  for (let n = 0; n < 400; n++) {
    const testo = Array.from({ length: 1 + Math.floor(caso() * 160) }, () => PAROLE[Math.floor(caso() * PAROLE.length)]).join(' ');
    const w = LARGHEZZE[n % LARGHEZZE.length];
    const pezzi = pezziDellaCella(testo, w);
    for (const stile of ['normal', 'bold']) {
      doc.setFont('helvetica', stile); doc.setFontSize(7.4);
      for (const p of pezzi) { const k = doc.splitTextToSize(p, w).length; if (k > 3) sbagli.push({ w, stile, righe: k, pezzo: p.slice(0, 60) }); }
      const vero = doc.splitTextToSize(testo, w).length;
      const stima = righeDelTesto(testo, w).length;
      if (stima < vero) sotto.push({ w, stile, stima, vero });
      if (stile === 'bold') { stimate += stima; vere += vero; }
    }
    if (pezzi.join('').replace(/ /g, '') !== testo.replace(/ /g, '') || (testo.split(' ').every(x => doc.getTextWidth(x) < w * 0.9) && pezzi.join(' ') !== testo)) persi.push(testo.slice(0, 60));
  }
  verifica('400 testi in 7 larghezze: ogni pezzo sta in tre righe del jspdf vero, in tondo e in grassetto', sbagli.length === 0, J(sbagli.slice(0, 3)));
  verifica('...la stima delle righe non e\' mai sotto quella di jspdf', sotto.length === 0, J(sotto.slice(0, 3)));
  verifica('...i pezzi rimessi insieme sono il testo intero', persi.length === 0, persi.slice(0, 3).join(' | '));
  console.log(`  Righe stimate ${stimate} contro ${vere} del grassetto vero, su 400 testi.`);
  verifica(`...e la stima non spreca righe: ${stimate} contro ${vere} del grassetto vero (al massimo il 15% in piu')`, stimate <= vere * 1.15, `${stimate} / ${vere}`);
});

// ─── 9. IL MENO NEGLI ALTRI PDF DEL CORREDO (chiusura del 15/10/2026) ───
// Il riepilogo fa passare ogni testo da perIlPdf; gli altri PDF del corredo
// passano da perPdf (src/lib/esportaTabella.js), che il meno tipografico di
// tSegno (U+2212) non lo cambiava. Il caso trovato dal revisore del gruppo del
// riepilogo: il PDF del quadro della commessa con una variazione del consorzio
// in meno scriveva la cella sotto il target e la nota in due byte per lettera,
// illeggibili. Il PDF si fa qui col jspdf vero e non entra fra i PRODOTTI della
// sezione 7, che guardano gli argomenti del riepilogo.
await sezione('9. IL MENO NEGLI ALTRI PDF DEL CORREDO: IL QUADRO CON UNA VARIAZIONE IN MENO', async () => {
  const quadro = { anno: 2026, giorno_dati: '2026-10-08', giorno_misura: '2026-10-08',
    rete: { target_t: 11450, raccolto_t: 8818.55, ritiri: 3104, pct_target: 77, atteso: null, residuo_t: 2631.45, proiezione: null, proiezione_perche: '', ritmo: null,
      variazioni: [{ mese_idx: 9, mese: 'Ottobre', regione: 'Puglia', t: -100, motivo: '', comunicata_il: '' }],
      mesi: [], regioni: [], fuori_contratto: { raccolto_t: 0, regioni: [] }, raccoglitori: null, raccoglitori_perche: 'no' },
    aci: { raccolto_t: 1, ritiri: 1, previsione_t: null, mesi: [], regioni: [] }, extra: { raccolto_t: 0, interventi: 0, mesi: [] } };
  const arg = L.argomentiQuadroPdf({ quadro, impianti: null, annoInCorso: true, mesiAttiva: [], margine: null, conEconomia: false, isAdmin: false });
  arg.documento = { ...(arg.documento || {}), stato: { letto: false, utente: 'Prova' } };
  verifica('gli argomenti del quadro hanno davvero il meno tipografico (la prova guarda il caso giusto)', /−100,00 t/.test(J(arg)), J(arg).slice(0, 200));
  globalThis.__PDF = null;
  await L.esportaSezioniPdf(arg);
  const dueByte = String(globalThis.__PDF).split('\n').filter(l => /Tj/.test(l) && /\x00/.test(l));
  const tutto = testiPdf(globalThis.__PDF).join(' ').replace(/\s+/g, ' ');
  verifica('il PDF del quadro: «Puglia (-100,00 t)» si legge', /Puglia \(-100,00 t\)/.test(tutto), (tutto.match(/.{0,80}Puglia.{0,40}/) || ['(Puglia non c\'e\')'])[0]);
  verifica('...e nessuna riga del PDF e\' scritta in due byte per lettera', dueByte.length === 0, dueByte.slice(0, 2).map(l => J(l).slice(0, 120)).join(' | '));
});


console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
