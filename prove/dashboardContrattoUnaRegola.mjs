// IL CONTRATTO DELLA RETE E' UNA REGOLA SOLA: LA DASHBOARD LA CHIAMA E RISPONDE
// COME PRIMA (migliorie del 14/10/2026, gruppo H-2).
//
// L'utente, il 14/10/2026, sulle migliorie proposte: «per me ok sulle cose da
// sistemare, sulla velocità e su quanto da creare, procedi pure». Fra le cose da
// sistemare: il contratto della rete (target annuo, raccolto, atteso alla data,
// scarto, regioni con le variazioni, avvisi del target) lo contava
// getDashboardRaccolta, e base44/shared/contrattoRete.ts ne aveva una COPIA per
// EcoTyna, tenuta allineata da prove/ecotynaContratto.mjs campo per campo. Ora la
// dashboard calcola il contratto con contrattoReteDegliAnni, e EcoTyna con
// contrattoDellaRete, che e' lo stesso conto per un anno.
//
// Qui:
// 1. il sorgente: la dashboard chiama contrattoReteDegliAnni e non ha piu' le
//    regole del contratto sue; contrattoDellaRete passa da contrattoReteDegliAnni;
// 2. su archivi costruiti, la funzione nuova contro quella del commit 5939d15
//    (l'ultimo con la copia, letto da git): la risposta INTERA identica al
//    carattere (non vicina) e le stesse letture, archivio per archivio, per
//    l'anno in corso prima e dopo la variazione di ottobre, con la variazione
//    superata, un anno chiuso di ripiego e uno col suo contratto, un anno senza
//    contratto, piu' anni insieme, un mese, nessun anno, i contratti che non si
//    leggono, il contratto senza riparto, copiato da confermare o senza target;
// 3. sulla copia dei dati veri dell'11/10/2026, prima e dopo la variazione
//    registrata nella prova (come prove/variazioneContratto.mjs): 2026, 2025
//    chiuso, 2027 senza contratto, 2025 e 2026 insieme, ottobre; identica e con
//    le stesse letture.
// Se un giorno la regola del contratto cambia apposta, il confronto col 5939d15
// va rifatto contro il commit di quel cambio, come prove/dashboardDatiVeri.mjs
// fa col 7607980. Senza git il confronto si salta e lo dice; senza la copia dei
// dati veri si salta la parte 3. node prove/dashboardContrattoUnaRegola.mjs
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as A from '../base44/shared/attesoContratto.ts';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + String(extra).slice(0, 900)); } };
const J = (x) => JSON.stringify(x);
const sorgente = (p) => readFileSync(qui('../' + p), 'utf8').replace(/\r/g, '');
const senzaCommenti = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const RIFERIMENTO = '5939d15';

// ─── 1. IL SORGENTE ───
console.log('1. IL SORGENTE: UNA REGOLA SOLA');
const dashboard = senzaCommenti(sorgente('base44/functions/getDashboardRaccolta/entry.ts'));
const condiviso = senzaCommenti(sorgente('base44/shared/contrattoRete.ts'));
verifica('getDashboardRaccolta conta il contratto con contrattoReteDegliAnni', /import \{[^}]*\bcontrattoReteDegliAnni\b[^}]*\} from "\.\.\/\.\.\/shared\/contrattoRete\.ts"/.test(dashboard)
  && /contrattoReteDegliAnni\(\{ commesse: commesseLette, anni, rete, reteAnno, oggi \}\)/.test(dashboard), (dashboard.match(/.*contrattoRete.*/g) || []).join('\n'));
const REGOLE = ['commessaDellAnno', 'targetAnnuoDellAnno', 'regioniDellAnno', 'attesoAllaData', 'attesoDellaRegione', 'giornoDeiDati', 'formatoTonnellate', 'PROV_TO_REGION'];
const sue = REGOLE.filter(f => new RegExp(`\\b${f}\\b`).test(dashboard));
verifica('e le regole del contratto non le ha piu\' sue (contratto, target, riparto, atteso, giorno dei dati, regione)', sue.length === 0, sue.join(', '));
// la dashboard sceglie le primarie dell'anno e le passa: e' la riga che
// prove/identitaFraModuli.mjs guasta per vedere il raccolto di rete rompersi
verifica('le primarie dell\'anno sono quelle della dashboard, passate al conto', dashboard.includes('const reteAnno = rete.filter(r => anni.includes(getAnno(r)));'));
const corpoDi = (s, nome) => { const i = s.indexOf(`export function ${nome}(`); if (i < 0) return ''; const j = s.indexOf('\nexport ', i + 1); return s.slice(i, j < 0 ? undefined : j); };
const unAnno = corpoDi(condiviso, 'contrattoDellaRete');
verifica('contrattoDellaRete (EcoTyna) e\' contrattoReteDegliAnni con un anno, senza regole sue', /contrattoReteDegliAnni\(\{ commesse, anni: \[a\], rete: tutte, oggi \}\)/.test(unAnno)
  && !REGOLE.some(f => new RegExp(`\\b${f}\\(`).test(unAnno)), unAnno.slice(0, 600));
const conti = REGOLE.filter(f => f !== 'PROV_TO_REGION').map(f => [f, (condiviso.match(new RegExp(`\\b${f}\\(`, 'g')) || []).length]);
verifica('in contrattoRete.ts ogni regola si chiama in un posto solo', conti.every(([, n]) => n === 1), J(conti));

// ─── IL BANCO: la funzione nuova e quella di prima, con un SDK finto che conta ───
// L'SDK finto legge da globalThis.__ARCHIVIO come la piattaforma (uguaglianza,
// $in, $gte, $lte, ordinamento e pagine), restituisce copie delle righe (una
// funzione non sporca l'altra) e conta ogni chiamata: auth e ogni lettura,
// archivio per archivio. __GUASTO fa fallire la lettura di un archivio.
const SDK_FINTO = `
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => {
  const x = r[k];
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    if ('$in' in v && !v.$in.includes(x)) return false;
    if ('$gte' in v && !(x != null && String(x) >= String(v.$gte))) return false;
    if ('$lte' in v && !(x != null && String(x) <= String(v.$lte))) return false;
    return true;
  }
  if (v === null) return x === null || x === undefined || x === '';
  return x === v;
});
const ordina = (righe, sort) => { const campo = String(sort || 'id').replace(/^[-+]/, ''); const giu = String(sort || '').startsWith('-');
  return [...righe].sort((a, b) => { const x = a[campo], y = b[campo]; if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y)); return giu ? -c : c; }); };
const conta = (chiave) => { globalThis.__CHIAMATE[chiave] = (globalThis.__CHIAMATE[chiave] || 0) + 1; };
const guasto = (nome) => { if ((globalThis.__GUASTO || []).includes(nome)) throw new Error('archivio non raggiungibile'); };
const righe = (nome) => globalThis.__ARCHIVIO[nome] || [];
const entita = (nome) => ({
  list: async (sort, lim = 5000, skip = 0) => { conta(nome + '.list'); guasto(nome); return ordina(righe(nome), sort).slice(skip, skip + lim).map(r => ({ ...r })); },
  filter: async (f, sort, lim = 5000, skip = 0) => { conta(nome + '.filter'); guasto(nome); return ordina(righe(nome).filter(r => soddisfa(r, f)), sort).slice(skip, skip + lim).map(r => ({ ...r })); },
  get: async (id) => { conta(nome + '.get'); const r = righe(nome).find(x => x.id === id); return r ? { ...r } : null; },
  create: async (r) => { conta(nome + '.create'); return r; }, update: async (_id, r) => { conta(nome + '.update'); return r; },
  bulkCreate: async (r) => { conta(nome + '.bulkCreate'); return r; }, delete: async () => { conta(nome + '.delete'); return {}; },
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
const sdk = { auth: { me: async () => { conta('auth.me'); return { role: 'admin', email: 'prova' }; } }, asServiceRole: { entities }, entities,
  functions: { invoke: async (n) => { conta('functions.invoke'); throw new Error('non disponibile nella prova: ' + n); } } };
export function createClientFromRequest() { return sdk; }`;
const plug = { name: 'sdk-finto', setup(b) {
  b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
  b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
} };
const carica = async (opzioni) => import('data:text/javascript;base64,' + Buffer.from((await build({ bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent', plugins: [plug], ...opzioni })).outputFiles[0].text).toString('base64'));
const nuova = await carica({ entryPoints: [qui('../base44/functions/getDashboardRaccolta/entry.ts')] });
// La funzione del commit di riferimento, letta da git: la cartella e' quella di
// oggi (gli import relativi sono gli stessi), il codice quello di allora.
let prima = null;
try {
  const testo = execSync(`git show ${RIFERIMENTO}:base44/functions/getDashboardRaccolta/entry.ts`, { cwd: qui('..'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  prima = await carica({ stdin: { contents: testo, resolveDir: qui('../base44/functions/getDashboardRaccolta'), sourcefile: `getDashboardRaccolta-${RIFERIMENTO}.ts`, loader: 'ts' } });
} catch (_e) { prima = null; }

const OraVera = Date;
const conOra = async (iso, f) => {
  const ms = OraVera.parse(iso);
  globalThis.Date = class extends OraVera { constructor(...a) { if (a.length) super(...a); else super(ms); } static now() { return ms; } };
  try { return await f(); } finally { globalThis.Date = OraVera; }
};
const chiama = async (modulo, { archivio, corpo, ora, guasti = [] }) => {
  globalThis.__ARCHIVIO = archivio;
  globalThis.__GUASTO = guasti;
  globalThis.__CHIAMATE = {};
  const r = await conOra(ora, () => modulo.default({ json: async () => corpo }));
  return { stato: r.status, j: await r.json(), chiamate: { ...globalThis.__CHIAMATE } };
};
// Il primo punto in cui due risposte si separano, per dire dove.
const doveDiverge = (a, b, via = '') => {
  if (J(a) === J(b)) return null;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const chiavi = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    if (J(Object.keys(a)) !== J(Object.keys(b))) return `${via || '(radice)'}: chiavi ${J(Object.keys(a))} contro ${J(Object.keys(b))}`;
    for (const k of chiavi) { const d = doveDiverge(a[k], b[k], `${via}.${k}`); if (d) return d; }
  }
  return `${via || '(radice)'}: ${J(a)} contro ${J(b)}`;
};
const ordinate = (c) => Object.entries(c).sort(([x], [y]) => x.localeCompare(y));
const totale = (c) => Object.values(c).reduce((s, n) => s + n, 0);
let confronti = 0;
const comePrima = async (nome, scenario) => {
  const n = await chiama(nuova, scenario);
  verifica(`${nome}: la funzione nuova risponde`, n.stato === 200 && !n.j.error, J(n.j.error || n.stato));
  if (!prima) return n;
  const p = await chiama(prima, scenario);
  confronti++;
  verifica(`${nome}: la risposta intera e' quella di prima, al carattere`, J(n.j) === J(p.j), doveDiverge(n.j, p.j));
  verifica(`${nome}: le stesse letture, archivio per archivio (${totale(n.chiamate)} chiamate)`, J(ordinate(n.chiamate)) === J(ordinate(p.chiamate)) && totale(n.chiamate) <= totale(p.chiamate),
    `${J(ordinate(n.chiamate))} contro ${J(ordinate(p.chiamate))}`);
  return { ...n, chiamatePrima: p.chiamate };
};
if (!prima) console.log(`  (git non disponibile o commit ${RIFERIMENTO} non trovato: il confronto col codice di prima si salta)`);

// ─── 2. SU ARCHIVI COSTRUITI ───
console.log('2. SU ARCHIVI COSTRUITI, CONTRO IL CODICE DI PRIMA');
const PROFILO = [851.29, 915.48, 868.47, 932.55, 1053.85, 1100, 1100, 550, 1050, 1100, 1100, 950];
const contratto = (extra = {}) => ({
  id: 'c26', anno: 2026, target_annuo_t: 11550, created_date: '2026-01-05T10:00:00', updated_date: '2026-09-14T17:35:58',
  regioni_json: J([{ regione: 'Campania', target_t: 4400 }, { regione: 'Puglia', target_t: 2500 }, { regione: 'Basilicata', target_t: 500 }, { regione: 'Calabria', target_t: 1650 }, { regione: 'Sicilia', target_t: 2500 }]),
  target_mensile_iniziale_json: J([800, 750, 800, 950, 1100, 1100, 1050, 500, 1000, 1100, 1100, 950]),
  target_mensile_json: J(PROFILO),
  target_prezzo_regioni_json: J([{ regione: 'Puglia', target_t: 400, prezzo: 95 }, { regione: 'Calabria', target_t: 250, prezzo: 95 }]),
  destinazioni_json: J([{ destinazione: 'IRIGOM', target_t: 4450 }, { destinazione: 'T_CYCLE', target_t: 7100 }]),
  storico_json: J([{ il: '2026-09-14T17:35:58.203Z', da: 'Antonio', nota: 'importato dal foglio', prima: null }]),
  ...extra,
});
const OTTOBRE = { mese_idx: 9, regione: 'Puglia', t: 100, destinazione: 'IRIGOM', motivo: 'assegnazione del consorzio di ottobre', comunicata_il: '2026-10-14' };
const registra = (c, variazione, il = '2026-10-14T10:00:00.000Z') => {
  const v = A.variazioneDelContratto(c, variazione);
  return { ...c, ...v.patch, updated_date: il.replace('Z', ''), storico_json: A.storicoConVariazione(c.storico_json, { il, da: 'Antonio Castellano', voce: v.voce, prima: v.prima }) };
};
const VERO = contratto();
const NUOVO = registra(VERO, OTTOBRE);
const CAMPI = ['target_annuo_t', 'regioni_json', 'target_mensile_json', 'destinazioni_json'];
const RISCRITTO = { ...NUOVO, ...Object.fromEntries(CAMPI.map(k => [k, VERO[k]])), updated_date: '2026-10-20T09:00:00',
  storico_json: J([...JSON.parse(NUOVO.storico_json), { il: '2026-10-20T09:00:00.000Z', da: 'Antonio Castellano', nota: 'importato da contratto-ecotyre.xlsx', prima: Object.fromEntries(CAMPI.map(k => [k, NUOVO[k]])) }]) };
const C25 = { id: 'c25', anno: 2025, target_annuo_t: 11200, created_date: '2025-01-05T10:00:00', updated_date: '2025-02-01T10:00:00',
  regioni_json: J([{ regione: 'Campania', target_t: 4300 }, { regione: 'Puglia', target_t: 2400 }, { regione: 'Calabria', target_t: 1900 }, { regione: 'Sicilia', target_t: 2600 }]),
  target_mensile_json: J([900, 900, 900, 950, 1000, 1000, 1000, 500, 1000, 1050, 1000, 1000]), target_prezzo_regioni_json: J([{ regione: 'Calabria', target_t: 300, prezzo: 90 }]) };

let n = 0;
const PROV = ['NA', 'SA', 'BA', 'TA', 'LE', 'PZ', 'CS', 'RC', 'KR', 'PA', 'CT', 'CH', ''];
const giornoDi = (i, anno) => new OraVera(OraVera.UTC(anno, 0, 1 + (i % (anno === 2026 ? 281 : 365)))).toISOString().slice(0, 10);
// 2.500 primarie di rete (le pagine da 5.000 le prova la copia dei dati veri,
// 10.487 righe), con pesi che non fanno somme tonde, il campo regione a volte
// scritto, ritiri a cavallo della mezzanotte italiana, terminati senza fine
// trasporto e qualcuno nel limbo degli «eseguito».
const RETE = Array.from({ length: 2500 }, (_, i) => {
  const anno = i % 4 === 0 ? 2025 : 2026;
  const g = giornoDi(i * 7, anno);
  const ora = i % 37 === 0 ? '22:30:00' : '09:15:00';
  return { id: 'r' + String(++n).padStart(6, '0'), id_ordine: 'ORD' + Math.floor(i / 2), numero_fir: 'FIR' + i, stato: i % 211 === 3 ? 'eseguito' : 'terminato', classe: 'P', prodotto: '.class1',
    provincia: PROV[i % PROV.length], regione: i % 29 === 0 ? 'Puglia' : '', trasportatore: ['SMOCO S.R.L.', 'ALFA SRL', 'BETA SRL'][i % 3], destinazione: 'IRIGOM SRL', tipo_destinazione: 'imp', partner_operativo: 'SMOCO Srl',
    peso_effettivo: 1000 + ((i * 137) % 9001) + (i % 3) * 0.5, ordine_immesso_il: `${g}T07:00:00Z`, trasporto_iniziato_il: `${g}T08:00:00Z`,
    trasporto_finito_il: i % 997 === 5 ? null : `${g}T${ora}Z`, created_date: `${g}T12:00:00` };
});
const ACI = Array.from({ length: 260 }, (_, i) => {
  const anno = i % 5 === 0 ? 2025 : 2026;
  const g = giornoDi(i * 11, anno);
  return { id: 'a' + String(i).padStart(5, '0'), id_ordine: 'A' + i, stato: 'terminato', provincia: PROV[i % 9], regione: '', peso_effettivo: 300 + (i * 53) % 2100,
    ordine_immesso_il: `${g}T07:00:00Z`, trasporto_iniziato_il: `${g}T08:00:00Z`, trasporto_finito_il: i % 101 === 7 ? '' : `${g}T10:00:00Z` };
});
const EXTRA = [
  { id: 'x1', id_ordine: 'X1', stato: 'terminato', tipo_movimento: 'primaria', peso_effettivo: 4120, trasporto_finito_il: '2026-04-02T10:00:00Z', ordine_immesso_il: '2026-04-01T10:00:00Z', trasporto_iniziato_il: '2026-04-02T08:00:00Z' },
  { id: 'x2', id_ordine: 'X2', stato: 'terminato', tipo_movimento: 'secondaria', peso_effettivo: 4120, trasporto_finito_il: '2026-04-03T10:00:00Z' },
  { id: 'x3', id_ordine: 'X3', stato: 'terminato', tipo_movimento: 'primaria', peso_effettivo: 2210, trasporto_finito_il: '2025-11-30T23:30:00Z', ordine_immesso_il: '2025-11-29T10:00:00Z', trasporto_iniziato_il: '2025-11-30T20:00:00Z' },
];
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const archivio = (commesse, extra = {}) => ({
  PrimariaRete: RETE, PrimariaAci: ACI, ExtraRaccolta: EXTRA, CommessaEcotyre: commesse,
  TargetRaccoglitore: [{ id: 't1', anno: 2026, raccoglitore: 'SMOCO S.r.l.', regione: 'Puglia', impianto: 'IRIGOM SRL', target_tonnellate: 2600 },
    { id: 't2', anno: 2026, raccoglitore: 'ALFA SRL', regione: 'Campania', target_tonnellate: 4400 }, { id: 't3', anno: 2025, raccoglitore: 'BETA SRL', regione: 'Sicilia', target_tonnellate: 2600 }],
  TargetMensile: MESI.map((m, i) => ({ id: 'm' + i, anno: 2026, raccoglitore: 'ALFA SRL', regione: 'Campania', mese: m, target: 360 + i })),
  DocumentoFatturazione: [{ id: 'd1', tipo: 'ATTIVA', anno: 2025, mese: 'Novembre', tipologia: 'RETE', stato: 'chiusa' }],
  PrefatturaEcotyre: [{ id: 'f1', anno: 2025, mese: 'Novembre', superata: false, righe_json: '[]' }],
  ...extra,
});
const ORA = '2026-10-14T08:00:00Z';
const COSTRUITI = [
  ['2026, il contratto vero', { archivio: archivio([VERO, C25]), corpo: { anno: [2026] }, ora: ORA }],
  ['2026, con la variazione di ottobre registrata', { archivio: archivio([NUOVO, C25]), corpo: { anno: [2026] }, ora: ORA }],
  ['2026, con la variazione superata', { archivio: archivio([RISCRITTO, C25]), corpo: { anno: [2026] }, ora: ORA }],
  ['2025 chiuso, col suo contratto', { archivio: archivio([NUOVO, C25]), corpo: { anno: [2025] }, ora: ORA }],
  ['2025 chiuso, di ripiego (nessun contratto)', { archivio: archivio([NUOVO]), corpo: { anno: [2025] }, ora: ORA }],
  ['2027 senza contratto, guardato oggi', { archivio: archivio([NUOVO, C25]), corpo: { anno: [2027] }, ora: ORA }],
  ['2027 senza contratto, guardato l\'11/02/2027', { archivio: archivio([NUOVO, C25]), corpo: { anno: [2027] }, ora: '2027-02-11T08:00:00Z' }],
  ['2025 e 2026 insieme', { archivio: archivio([NUOVO, C25]), corpo: { anno: [2025, 2026] }, ora: ORA }],
  ['2026 e 2025 insieme, l\'ordine rovesciato', { archivio: archivio([NUOVO]), corpo: { anno: [2026, 2025] }, ora: ORA }],
  ['2026 e 2027 insieme (uno senza contratto)', { archivio: archivio([NUOVO, C25]), corpo: { anno: [2026, 2027] }, ora: ORA }],
  ['2026, settembre', { archivio: archivio([NUOVO, C25]), corpo: { anno: [2026], mese: ['Settembre'] }, ora: ORA }],
  ['2026, ottobre scritto come testo', { archivio: archivio([NUOVO, C25]), corpo: { anno: '2026', mese: 'Ottobre' }, ora: ORA }],
  ['nessun anno: l\'anno in corso', { archivio: archivio([NUOVO, C25]), corpo: {}, ora: ORA }],
  ['i contratti che non si leggono', { archivio: archivio([NUOVO, C25]), corpo: { anno: [2026] }, ora: ORA, guasti: ['CommessaEcotyre'] }],
  ['i contratti che non si leggono, 2025 e 2026', { archivio: archivio([NUOVO, C25]), corpo: { anno: [2025, 2026] }, ora: ORA, guasti: ['CommessaEcotyre'] }],
  ['il contratto senza riparto per regione (vale quello di ripiego del 2026)', { archivio: archivio([{ ...NUOVO, regioni_json: '[]' }, C25]), corpo: { anno: [2026] }, ora: ORA }],
  ['il contratto copiato, da confermare', { archivio: archivio([{ ...NUOVO, storico_json: J([{ il: '2026-01-02T10:00:00Z', nota: 'copiato dal 2025, da confermare', prima: null }]) }, C25]), corpo: { anno: [2026] }, ora: ORA }],
  ['il contratto senza target annuo (vale il ripiego)', { archivio: archivio([{ ...NUOVO, target_annuo_t: 0 }, C25]), corpo: { anno: [2026] }, ora: ORA }],
  ['due contratti del 2026: vale il modificato per ultimo', { archivio: archivio([{ ...VERO, id: 'c26b', updated_date: '2026-10-15T09:00:00' }, NUOVO, C25]), corpo: { anno: [2026] }, ora: ORA }],
  ['i target dei raccoglitori che non si leggono', { archivio: archivio([NUOVO, C25]), corpo: { anno: [2026] }, ora: ORA, guasti: ['TargetMensile'] }],
  ['il 2 gennaio, senza ritiri dell\'anno nuovo', { archivio: archivio([NUOVO, C25]), corpo: { anno: [2026] }, ora: '2026-01-02T08:00:00Z' }],
];
const risposte = {};
for (const [nome, scenario] of COSTRUITI) risposte[nome] = await comePrima(nome, scenario);
// che gli scenari dicano davvero quello che il nome promette
const R = (nome) => (risposte[nome] || {}).j || {};
verifica('gli scenari sono quelli: 11.550 prima, 11.650 dopo, 11.550 con la variazione superata, 11.200 il 2025 (contratto e ripiego), null il 2027, 22.850 il 2025 e 2026, null col 2027',
  J(['2026, il contratto vero', '2026, con la variazione di ottobre registrata', '2026, con la variazione superata', '2025 chiuso, col suo contratto', '2025 chiuso, di ripiego (nessun contratto)', '2027 senza contratto, guardato oggi', '2025 e 2026 insieme', '2026 e 2027 insieme (uno senza contratto)'].map(x => R(x).kpi && R(x).kpi.target))
  === J([11550, 11650, 11550, 11200, 11200, null, 22850, null]),
  J(Object.fromEntries(Object.keys(risposte).map(x => [x, R(x).kpi && R(x).kpi.target]))));
verifica('e gli avvisi: il ripiego, il 2027, i contratti non letti, il riparto, la copia', /si usano le 11\.200,00 t/.test(J(R('2025 chiuso, di ripiego (nessun contratto)').avvisi_target)) && /del 2027 non è inserito/.test(J(R('2026 e 2027 insieme (uno senza contratto)').avvisi_target))
  && /non si è potuto leggere/.test(J(R('i contratti che non si leggono').avvisi_target)) && /del 2025 non ha il riparto per regione/.test(J(R('2025 chiuso, di ripiego (nessun contratto)').avvisi_target))
  // il 2026 senza riparto nel contratto prende quello di ripiego scritto nel codice, senza avviso (come prima)
  && J((R('il contratto senza riparto per regione (vale quello di ripiego del 2026)').target_vs_raccolto || []).map(r => [r.regione, r.target])) === J([['Campania', 4400], ['Puglia', 2500], ['Basilicata', 500], ['Calabria', 1650], ['Sicilia', 2500]])
  && /va confermato/.test(J(R('il contratto copiato, da confermare').avvisi_target)) && J(R('il contratto senza target annuo (vale il ripiego)').kpi.target_ripiego) === J([2026]),
  J(['2025 chiuso, di ripiego (nessun contratto)', '2026 e 2027 insieme (uno senza contratto)', 'i contratti che non si leggono', 'il contratto senza riparto per regione (vale quello di ripiego del 2026)', 'il contratto copiato, da confermare', 'il contratto senza target annuo (vale il ripiego)']
    .map(x => [x, R(x).avvisi_target, R(x).kpi && R(x).kpi.target_ripiego, (R(x).target_vs_raccolto || []).map(r => [r.regione, r.target])])));
verifica('e con piu\' anni niente quadro, con un anno il quadro c\'e\'', R('2025 e 2026 insieme').quadro === null && !!R('2026, il contratto vero').quadro && R('2025 chiuso, col suo contratto').quadro.anno_chiuso === true);

// ─── 3. SULLA COPIA DEI DATI VERI ───
console.log('3. SULLA COPIA DEI DATI VERI, CONTRO IL CODICE DI PRIMA');
const CARTELLA = process.env.DATI_VERI || qui('../../dati-veri/');
const copie = existsSync(CARTELLA) ? readdirSync(CARTELLA).filter(x => /^treadrider-dati-veri-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(x)).sort() : [];
if (!copie.length) {
  console.log(`  Nessuna copia dei dati veri in ${CARTELLA}: parte saltata.`);
} else {
  const copia = copie[copie.length - 1];
  const DATI = JSON.parse(gunzipSync(readFileSync(CARTELLA + copia)).toString('utf8'));
  const ORA_V = DATI.meta.letto_fino_al;
  console.log(`  Copia: ${copia}, letta il ${ORA_V}`);
  const vero = (DATI.archivi.CommessaEcotyre || []).filter(c => Number(c.anno) === 2026).sort((a, b) => String(b.updated_date).localeCompare(String(a.updated_date)))[0];
  // La modifica dell'utente del 14/10/2026 sui raccoglitori (SMOCO in Puglia
  // 1.850 -> 1.950, ottobre 170 -> 270) e la variazione registrata nel
  // contratto, come in prove/variazioneContratto.mjs.
  const smoco = (r) => /^smoco/i.test(String(r.raccoglitore || '')) && r.regione === 'Puglia' && Number(r.anno) === 2026;
  const annui = (DATI.archivi.TargetRaccoglitore || []).map(r => (smoco(r) ? { ...r, target_tonnellate: Number(r.target_tonnellate) + 100 } : r));
  const mensili = (DATI.archivi.TargetMensile || []).map(r => (smoco(r) && r.mese === 'Ottobre' ? { ...r, target: Number(r.target) + 100 } : r));
  const esito = A.variazioneDelContratto(vero, { ...OTTOBRE });
  verifica('dati veri: la variazione si registra', esito.errori.length === 0, J(esito.errori));
  const nuovo = { ...vero, ...esito.patch, updated_date: '2026-10-14T10:00:00.000000', storico_json: A.storicoConVariazione(vero.storico_json, { il: '2026-10-14T10:00:00.000Z', da: 'Antonio Castellano', voce: esito.voce, prima: esito.prima }) };
  const primaDellaVariazione = { ...DATI.archivi, CommessaEcotyre: [vero] };
  const dopoLaVariazione = { ...DATI.archivi, CommessaEcotyre: [nuovo], TargetRaccoglitore: annui, TargetMensile: mensili };
  const VERI = [];
  for (const [quando, arch] of [['prima della variazione', primaDellaVariazione], ['dopo la variazione', dopoLaVariazione]]) {
    VERI.push([`dati veri ${quando}, 2026`, { archivio: arch, corpo: { anno: [2026] }, ora: ORA_V }]);
    VERI.push([`dati veri ${quando}, 2025 chiuso`, { archivio: arch, corpo: { anno: [2025] }, ora: ORA_V }]);
    VERI.push([`dati veri ${quando}, 2027 senza contratto`, { archivio: arch, corpo: { anno: [2027] }, ora: ORA_V }]);
    VERI.push([`dati veri ${quando}, 2025 e 2026 insieme`, { archivio: arch, corpo: { anno: [2025, 2026] }, ora: ORA_V }]);
    VERI.push([`dati veri ${quando}, 2026 ottobre`, { archivio: arch, corpo: { anno: [2026], mese: ['Ottobre'] }, ora: ORA_V }]);
  }
  VERI.push(['dati veri dopo la variazione, i contratti che non si leggono', { archivio: dopoLaVariazione, corpo: { anno: [2026] }, ora: ORA_V, guasti: ['CommessaEcotyre'] }]);
  const veri = {};
  for (const [nome, scenario] of VERI) veri[nome] = await comePrima(nome, scenario);
  const V = (nome) => (veri[nome] || {}).j || {};
  const k26 = V('dati veri prima della variazione, 2026').kpi || {};
  const d26 = V('dati veri dopo la variazione, 2026').kpi || {};
  verifica('dati veri: il contratto 11.550 prima e 11.650 dopo, il 2025 di ripiego (11.200), il 2027 senza (null)', k26.target === 11550 && d26.target === 11650
    && V('dati veri dopo la variazione, 2025 chiuso').kpi.target === 11200 && J(V('dati veri dopo la variazione, 2025 chiuso').kpi.target_ripiego) === J([2025])
    && V('dati veri dopo la variazione, 2027 senza contratto').kpi.target === null, J([k26.target, d26.target]));
  const l26 = veri['dati veri dopo la variazione, 2026'] || {};
  console.log(`  le letture del 2026: ${totale(l26.chiamate || {})} chiamate ora, ${l26.chiamatePrima ? totale(l26.chiamatePrima) : '?'} prima: ${J(ordinate(l26.chiamate || {}))}`);
  if (copia === 'treadrider-dati-veri-2026-10-11.json.gz') {
    // i numeri del progetto sulla copia dell'11/10/2026 (prove/dashboardDatiVeri.mjs)
    verifica('dati veri: 8.818,55 t raccolte, atteso 8.689,23 t, scarto +129,32 t (prima della variazione)', Math.round(k26.raccolto_rete_anno * 100) / 100 === 8818.55
      && Math.round(k26.atteso.atteso_t * 100) / 100 === 8689.23 && Math.round(k26.atteso.scarto_t * 100) / 100 === 129.32, J([k26.raccolto_rete_anno, k26.atteso]));
  }
}
if (prima) verifica(`confrontati ${confronti} casi col codice del ${RIFERIMENTO}`, confronti >= COSTRUITI.length, String(confronti));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
