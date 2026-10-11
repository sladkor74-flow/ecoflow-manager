// IL QUINTO CONTROLLO: GIACENZE E DICHIARAZIONI SUI DATI VERI (11/10/2026).
//
// Regola dell'utente, testuale: «dichiarazioni e giacenze sono cose fondamentali
// e devono quadrare sempre come un orologio svizzero». Lo stesso giorno una
// correzione verde su tutte le prove costruite aveva rotto sul sito la colonna
// «Da dichiarare» di quattro impianti: il report del portale aggancia agli anni
// prima molto piu' dell'apertura, e nessun archivio di prova lo faceva. Le prove
// costruite non bastano: questa fa girare le funzioni vere di Giacenze e
// Dichiarazioni sulla copia degli archivi veri, in locale e senza toccare il sito,
// e pretende tre cose per ogni impianto e canale:
//   1. la giacenza di Giacenze e' quella di Dichiarazioni;
//   2. la somma della riga «Da dichiarare» e' la giacenza del canale;
//   3. i numeri sono quelli che il sito diceva quando la copia e' stata letta
//      (giacenze, quadratura col portale, totali). Una modifica che li sposta deve
//      dirlo: se e' voluta, dopo la pubblicazione si scarica una copia nuova.
//
// LA COPIA sta fuori dal repository, in ../dati-veri/ (non va su GitHub e non esce
// dal computer dell'utente): un file treadrider-dati-veri-AAAA-MM-GG.json.gz con
// gli archivi, il momento della lettura e le risposte del sito di quel momento
// (attesi). Si scarica dal browser, in sola lettura: vedi AGENTS.md, «I quattro
// controlli», e la memoria «dati-veri». Senza la copia la prova si salta e lo
// dice. L'orologio si ferma al momento della lettura, cosi' «oggi» e' quello di
// allora. npm run prove
import { build } from 'esbuild';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
const CARTELLA = process.env.DATI_VERI || qui('../../dati-veri/');
const copie = existsSync(CARTELLA) ? readdirSync(CARTELLA).filter(n => /^treadrider-dati-veri-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n)).sort() : [];
if (!copie.length) {
  console.log(`Nessuna copia dei dati veri in ${CARTELLA}: prova saltata.`);
  process.exit(0);
}
const copia = copie[copie.length - 1];
const DATI = JSON.parse(gunzipSync(readFileSync(CARTELLA + copia)).toString('utf8'));
console.log(`Copia: ${copia}, letta il ${DATI.meta.letto_fino_al} (commit pubblicato allora: ${DATI.meta.commit_pubblicato || '?'})`);

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// L'SDK finto legge dalla copia, come la piattaforma: uguaglianza, $in, $gte,
// $lte, null per il campo vuoto, ordinamento e pagine. Le scritture non vanno da
// nessuna parte: si contano.
globalThis.__DATI_VERI = DATI.archivi;
globalThis.__SCRITTE_DATI_VERI = [];
const SDK_FINTO = `
const valore = (r, k) => r[k];
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => {
  const x = valore(r, k);
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    if ('$in' in v && !v.$in.includes(x)) return false;
    if ('$nin' in v && v.$nin.includes(x)) return false;
    if ('$gte' in v && !(x != null && String(x) >= String(v.$gte))) return false;
    if ('$lte' in v && !(x != null && String(x) <= String(v.$lte))) return false;
    if ('$gt' in v && !(x != null && String(x) > String(v.$gt))) return false;
    if ('$lt' in v && !(x != null && String(x) < String(v.$lt))) return false;
    if ('$ne' in v && x === v.$ne) return false;
    return true;
  }
  if (v === null) return x === null || x === undefined || x === '';
  return x === v;
});
const ordina = (righe, sort) => {
  const campo = String(sort || 'id').replace(/^[-+]/, '');
  const giu = String(sort || '').startsWith('-');
  return [...righe].sort((a, b) => {
    const x = a[campo], y = b[campo];
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
    return giu ? -c : c;
  });
};
const entita = (nome) => ({
  list: async (sort, lim = 1e9, skip = 0) => ordina(globalThis.__DATI_VERI[nome] || [], sort).slice(skip, skip + lim),
  filter: async (f, sort, lim = 1e9, skip = 0) => ordina((globalThis.__DATI_VERI[nome] || []).filter(r => soddisfa(r, f)), sort).slice(skip, skip + lim),
  get: async (id) => (globalThis.__DATI_VERI[nome] || []).find(r => r.id === id) || null,
  create: async (r) => { globalThis.__SCRITTE_DATI_VERI.push('create ' + nome); return r; },
  update: async (_id, r) => { globalThis.__SCRITTE_DATI_VERI.push('update ' + nome); return r; },
  delete: async () => { globalThis.__SCRITTE_DATI_VERI.push('delete ' + nome); return {}; },
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: 'admin', email: 'controllo-dati-veri' }) }, asServiceRole: { entities }, entities,
    functions: { invoke: async (n) => { throw new Error('il controllo sui dati veri non chiama altre funzioni: ' + n); } } };
}`;
const funzione = async (nome) => {
  const pacchetto = await build({
    entryPoints: [qui(`../base44/functions/${nome}/entry.ts`)],
    bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
    plugins: [{ name: 'sdk-finto', setup(b) {
      b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
      b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
    } }],
  });
  const modulo = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
  return async (corpo) => { const r = await modulo.default({ json: async () => corpo }); return { stato: r.status, j: await r.json() }; };
};
// L'orologio fermo al momento della lettura della copia.
const OraVera = Date;
const conOra = async (iso, f) => {
  const ms = OraVera.parse(iso);
  globalThis.Date = class extends OraVera { constructor(...a) { if (a.length) super(...a); else super(ms); } static now() { return ms; } };
  try { return await f(); } finally { globalThis.Date = OraVera; }
};

const ANNO = Number(String(DATI.meta.letto_fino_al).slice(0, 4));
const riepilogo = await funzione('riepilogoDichiarazioni');
const giacenze = await funzione('calcolaGiacenze');
const R = await conOra(DATI.meta.letto_fino_al, () => riepilogo({ anno: ANNO }));
const G = await conOra(DATI.meta.letto_fino_al, () => giacenze({ anno: ANNO }));
verifica('le due funzioni rispondono', R.stato === 200 && G.stato === 200, `${R.stato} ${G.stato} ${JSON.stringify(R.j.error || G.j.error || '')}`);
verifica('e non scrivono niente', globalThis.__SCRITTE_DATI_VERI.length === 0, globalThis.__SCRITTE_DATI_VERI.join(','));

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const t2 = (x) => (x === null || x === undefined ? null : Math.round(Number(x) * 100) / 100);
const CAMPO_GIACENZE = { RETE: 'giacenza_portale_t', ACI: 'giacenza_aci_t', EXTRA_RACCOLTA: 'giacenza_extra_t' };
const impiantiG = (G.j.righe || []).filter(x => x.tipo_destinazione !== 'stoc');

console.log('1. GIACENZE = DICHIARAZIONI, IMPIANTO PER IMPIANTO E CANALE PER CANALE');
console.log('2. LA RIGA «DA DICHIARARE» FA LA GIACENZA DEL CANALE');
let confronti = 0;
for (const s of R.j.siti || []) {
  const g = impiantiG.find(x => norm(x.sito) === norm(s.sito));
  for (const c of s.giacenze_canale || []) {
    confronti++;
    verifica(`${s.sito} ${c.canale}: Giacenze = Dichiarazioni`, g && t2(g[CAMPO_GIACENZE[c.canale]]) === t2(c.giacenza_t), `${g ? g[CAMPO_GIACENZE[c.canale]] : 'riga mancante'} / ${c.giacenza_t}`);
    if (c.giacenza_t === null) continue;
    const flussi = (s.flussi || []).filter(f => f.canale === c.canale);
    const somma = flussi.reduce((a, f) => a + (Number(f.resta_t) || 0), 0);
    verifica(`${s.sito} ${c.canale}: la riga «Da dichiarare» fa la giacenza`, t2(somma) === t2(c.giacenza_t), `${t2(somma)} / ${c.giacenza_t}`);
    const oltre = flussi.reduce((a, f) => a + (Number(f.uscito_oltre_kg) || 0), 0);
    verifica(`${s.sito} ${c.canale}: nessun «dichiarati in piu'» inventato`, oltre === 0, `${oltre} kg`);
  }
}
verifica('ci sono stati dei confronti', confronti > 0, String(confronti));

console.log('3. GLI STESSI NUMERI CHE IL SITO DICEVA QUANDO LA COPIA E\' STATA LETTA');
const attR = DATI.attesi.riepilogoDichiarazioni_2026 && DATI.attesi.riepilogoDichiarazioni_2026.risposta;
const attG = DATI.attesi.calcolaGiacenze_2026 && DATI.attesi.calcolaGiacenze_2026.risposta;
if (attR && ANNO === 2026) {
  for (const k of ['conferito_t', 'giacenza_calcolata_t', 'giacenza_portale_t', 'siti_che_quadrano', 'siti_da_quadrare', 'aci_che_quadrano', 'aci_da_quadrare', 'dichiarato_caricato_rete_t', 'dichiarato_caricato_aci_t', 'dichiarato_caricato_extra_t']) {
    verifica(`Dichiarazioni, totale ${k}`, t2(R.j.totali[k]) === t2(attR.totali[k]), `${R.j.totali[k]} contro ${attR.totali[k]} del sito`);
  }
  for (const a of attR.siti || []) {
    // Un piazzale ha una riga per canale, con lo stesso nome: si abbina per chiave.
    const s = (R.j.siti || []).find(x => (a.chiave ? x.chiave === a.chiave : norm(x.sito) === norm(a.sito)));
    verifica(`Dichiarazioni: ${a.chiave || a.sito} c'e' ancora`, !!s);
    if (!s) continue;
    verifica(`Dichiarazioni: ${a.sito}, quadratura col portale`, String(s.quadra) === String(a.quadra) && t2(s.giacenza_portale_t) === t2(a.giacenza_portale_t) && t2(s.giacenza_calcolata_t) === t2(a.giacenza_calcolata_t),
      `${s.giacenza_calcolata_t}/${s.giacenza_portale_t}/${s.quadra} contro ${a.giacenza_calcolata_t}/${a.giacenza_portale_t}/${a.quadra}`);
    for (const ac of a.giacenze_canale || []) {
      const c = (s.giacenze_canale || []).find(x => x.canale === ac.canale);
      verifica(`Dichiarazioni: ${a.sito} ${ac.canale}, giacenza`, c && t2(c.giacenza_t) === t2(ac.giacenza_t), `${c && c.giacenza_t} contro ${ac.giacenza_t}`);
    }
  }
}
if (attG && ANNO === 2026) {
  for (const k of ['conferito_t', 'giacenza_portale_t', 'conferito_extra_t', 'terziarie_t']) {
    verifica(`Giacenze, totale ${k}`, t2(G.j.totali[k]) === t2(attG.totali[k]), `${G.j.totali[k]} contro ${attG.totali[k]} del sito`);
  }
  for (const a of attG.righe || []) {
    const g = (G.j.righe || []).find(x => norm(x.sito) === norm(a.sito) && x.tipo_destinazione === a.tipo_destinazione);
    verifica(`Giacenze: ${a.sito} (${a.tipo_destinazione}) c'e' ancora`, !!g);
    if (!g) continue;
    for (const k of ['giacenza_portale_t', 'giacenza_rete_t', 'giacenza_aci_t', 'giacenza_extra_t']) {
      if (!(k in a)) continue;
      verifica(`Giacenze: ${a.sito} (${a.tipo_destinazione}) ${k}`, t2(g[k]) === t2(a[k]), `${g[k]} contro ${a[k]} del sito`);
    }
  }
}

console.log(`\n${ok} superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
