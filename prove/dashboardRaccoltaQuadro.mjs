// Prova della FUNZIONE DELLA DASHBOARD COL QUADRO DELLA COMMESSA
// (getDashboardRaccolta, migliorie dell'11/10/2026), intera, con un SDK finto
// che conta le letture.
//
// 1. I numeri di prima non cambiano: kpi, regioni, date da sistemare e avvisi
//    sono, al carattere, quelli della funzione com'era al commit 7607980 (la
//    leggo da git e la impacchetto accanto). Li leggono le prove e il controllo
//    delle identita' fra moduli.
// 2. Il quadro dice gli stessi numeri del kpi: tessera, sezione e card non
//    possono smentirsi.
// 3. Il bilancio delle richieste: aprire la dashboard non legge piu' di prima.
//    Prima partivano getDashboardStats, getDashboardRaccolta, cruscottoOperativo
//    e checkTargetAlerts (il pannello in fondo), e le primarie di rete si
//    leggevano intere tre volte; ora due funzioni, e le primarie una volta.
// 4. Niente euro, e un anno alla volta.
// npm run prove
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { periodoMovimento } from '../base44/shared/movimenti.ts';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);

const SDK_FINTO = `
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    if ('$in' in v) return v.$in.includes(r[k]);
    if ('$gte' in v || '$lte' in v) return (!('$gte' in v) || (r[k] != null && String(r[k]) >= String(v.$gte))) && (!('$lte' in v) || (r[k] != null && String(r[k]) <= String(v.$lte)));
    return true;
  }
  return r[k] === v;
});
const ordina = (righe, s) => { const c = String(s || 'id').replace(/^-/, ''), giu = String(s || '').startsWith('-');
  return [...righe].sort((a, b) => { const x = String(a[c] ?? ''), y = String(b[c] ?? ''); return x === y ? 0 : (x < y ? -1 : 1) * (giu ? -1 : 1); }); };
const conta = (nome) => { globalThis.__LETTURE[nome] = (globalThis.__LETTURE[nome] || 0) + 1; };
const entita = (nome) => ({
  list: async (s, l = 5000, k = 0) => { conta(nome); return ordina(globalThis.__ARCHIVIO[nome] || [], s).slice(k, k + l); },
  filter: async (f, s, l = 5000, k = 0) => { conta(nome); return ordina((globalThis.__ARCHIVIO[nome] || []).filter(r => soddisfa(r, f)), s).slice(k, k + l); },
  get: async (id) => (globalThis.__ARCHIVIO[nome] || []).find(r => r.id === id) || null,
  create: async (r) => { globalThis.__SCRITTE.push(nome); return r; }, update: async (_i, r) => { globalThis.__SCRITTE.push(nome); return r; },
  bulkCreate: async (r) => { globalThis.__SCRITTE.push(nome); return r; }, delete: async () => { globalThis.__SCRITTE.push(nome); return {}; },
});
const entities = new Proxy({}, { get: (_t, n) => entita(String(n)) });
export function createClientFromRequest() { return { auth: { me: async () => ({ role: globalThis.__RUOLO || 'admin', email: 'prova' }) }, asServiceRole: { entities }, entities }; }`;
const plugin = { name: 'sdk-finto', setup(b) {
  b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'finto' }));
  b.onLoad({ filter: /.*/, namespace: 'finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
} };
const carica = async (opzioni) => {
  const p = await build({ bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent', plugins: [plugin], ...opzioni });
  const m = await import('data:text/javascript;base64,' + Buffer.from(p.outputFiles[0].text).toString('base64'));
  return async (corpo) => { const r = await m.default({ json: async () => corpo }); return { stato: r.status, j: await r.json() }; };
};
const funzione = (nome) => carica({ entryPoints: [qui(`../base44/functions/${nome}/entry.ts`)] });
// La funzione com'era al commit 7607980, letta da git: la cartella e' quella di
// oggi (gli import relativi sono gli stessi), il codice quello di allora.
const funzioneDi = async (commit, nome) => {
  let testo;
  try { testo = execSync(`git show ${commit}:base44/functions/${nome}/entry.ts`, { cwd: qui('..'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; }
  return carica({ stdin: { contents: testo, resolveDir: qui('../base44/functions/getDashboardRaccolta'), sourcefile: `${nome}-${commit}.ts`, loader: 'ts' } });
};

// --- L'orologio fermo: domenica 11/10/2026, le 12 a Roma ---
const OraVera = Date;
const ADESSO = OraVera.parse('2026-10-11T10:00:00Z');
const conOra = async (f) => {
  globalThis.Date = class extends OraVera { constructor(...a) { if (a.length) super(...a); else super(ADESSO); } static now() { return ADESSO; } };
  try { return await f(); } finally { globalThis.Date = OraVera; }
};

// --- L'archivio: 12.345 primarie di rete, come quelle vere (piu' di due pagine) ---
let n = 0;
const T = (g, ora = '10:00:00') => `${g}T${ora}Z`;
const PROV = ['NA', 'SA', 'BA', 'LE', 'PZ', 'CS', 'RC', 'PA', 'CT', 'FI', ''];
const RACC = ['SMOCO SRL', 'PNEUSERVICE CONVERSANO SRL', 'GATIM S.R.L.', 'ALFA SRL', 'BETA SRL'];
const giornoDi = (i, anno) => { const d = new Date(Date.UTC(anno, 0, 1 + (i % (anno === 2026 ? 280 : 365)))); return d.toISOString().slice(0, 10); };
const PRIMARIE = Array.from({ length: 12345 }, (_, i) => {
  const anno = i % 3 === 0 ? 2025 : 2026;
  const g = giornoDi(i, anno);
  return { id: 'r' + String(++n).padStart(6, '0'), id_ordine: 'ORD' + Math.floor(i / 2), stato: 'terminato', provincia: PROV[i % PROV.length], trasportatore: RACC[i % RACC.length],
    peso_effettivo: 1000 + (i % 7) * 130, ordine_immesso_il: T(g), trasporto_iniziato_il: T(g), trasporto_finito_il: i % 997 === 5 ? null : T(g, i % 50 === 0 ? '22:30:00' : '10:00:00') };
});
const contratto = { id: 'c26', anno: 2026, target_annuo_t: 11550, target_mensile_json: J([851.29, 915.48, 868.47, 932.55, 1053.85, 1100, 1100, 550, 1050, 1100, 1100, 950]),
  regioni_json: J([{ regione: 'Campania', target_t: 4400 }, { regione: 'Puglia', target_t: 2500 }, { regione: 'Basilicata', target_t: 500 }, { regione: 'Calabria', target_t: 1650 }, { regione: 'Sicilia', target_t: 2500 }]),
  target_prezzo_regioni_json: J([{ regione: 'Puglia', target_t: 400, prezzo: 95 }, { regione: 'Calabria', target_t: 250, prezzo: 95 }]) };
const ARCHIVIO = {
  PrimariaRete: PRIMARIE,
  PrimariaAci: Array.from({ length: 300 }, (_, i) => ({ id: 'a' + i, id_ordine: 'A' + i, stato: 'terminato', provincia: PROV[i % 8], peso_effettivo: 500, trasporto_finito_il: T(giornoDi(i, 2026)), ordine_immesso_il: T(giornoDi(i, 2026)) })),
  ExtraRaccolta: [{ id: 'x1', id_ordine: 'X1', stato: 'terminato', tipo_movimento: 'primaria', peso_effettivo: 400, trasporto_finito_il: T('2026-04-02') }, { id: 'x2', id_ordine: 'X2', stato: 'terminato', tipo_movimento: 'secondaria', peso_effettivo: 400, trasporto_finito_il: T('2026-04-03') }],
  CommessaEcotyre: [contratto, { id: 'c25', anno: 2025, target_annuo_t: 11200 }],
  // anche ottobre: il pannello dei target di prima leggeva le primarie solo se il mese aveva target
  TargetMensile: [{ id: 'm1', raccoglitore: 'SMOCO S.r.l.', regione: 'Campania', mese: 'Gennaio', anno: 2026, target: 50 }, { id: 'm2', raccoglitore: 'ALFA SRL', regione: 'Puglia', mese: 'Gennaio', anno: 2025, target: 50 },
    { id: 'm3', raccoglitore: 'SMOCO S.r.l.', regione: 'Campania', mese: 'Ottobre', anno: 2026, target: 80 }],
  TargetRaccoglitore: [{ id: 't1', raccoglitore: 'SMOCO S.r.l.', regione: 'Campania', anno: 2026, target_tonnellate: 600 }],
  DocumentoFatturazione: [{ id: 'd1', tipo: 'ATTIVA', anno: 2025, mese: 'Gennaio', tipologia: 'RETE', stato: 'chiusa' }],
  PrefatturaEcotyre: [{ id: 'f1', anno: 2025, mese: 'Gennaio', superata: false, righe_json: '[]' }],
  Alert: [], UploadLog: [], Assegnato: [], AssegnatoAci: [], Secondaria: [], Terziaria: [],
};
globalThis.__ARCHIVIO = ARCHIVIO;
globalThis.__SCRITTE = [];
const chiama = async (f, corpo) => { globalThis.__LETTURE = {}; const r = await conOra(() => f(corpo)); return { ...r, letture: { ...globalThis.__LETTURE } }; };

const nuova = await funzione('getDashboardRaccolta');
const prima = await funzioneDi('7607980', 'getDashboardRaccolta');

console.log('1. I NUMERI DI PRIMA NON CAMBIANO');
if (!prima) console.log('  (git non disponibile: il confronto col codice di prima si salta)');
for (const corpo of [{ anno: [2026] }, { anno: [2025] }, { anno: [2025, 2026] }, {}, { anno: [2026], mese: ['Marzo'] }, { anno: [2027] }]) {
  const n1 = await chiama(nuova, corpo);
  verifica(`risponde (${J(corpo)})`, n1.stato === 200, J(n1.j).slice(0, 300));
  if (!prima) continue;
  const p1 = await chiama(prima, corpo);
  const { quadro, quadro_perche, ...resto } = n1.j;
  void quadro; void quadro_perche;
  verifica(`i campi di prima sono identici (${J(corpo)})`, J(resto) === J(p1.j), `${J(resto).slice(0, 200)} / ${J(p1.j).slice(0, 200)}`);
}

console.log('2. IL QUADRO DICE GLI STESSI NUMERI DEL KPI');
const r26 = await chiama(nuova, { anno: [2026] });
const { kpi, quadro } = r26.j;
verifica('la rete: raccolto, target, percentuale e atteso sono quelli del kpi', quadro.rete.raccolto_t === kpi.raccolto_rete_anno && quadro.rete.target_t === kpi.target && quadro.rete.pct_target === kpi.raggiungimento_pct
  && quadro.rete.atteso.atteso_t === kpi.atteso.atteso_t && quadro.rete.atteso.scarto_t === kpi.atteso.scarto_t && quadro.rete.atteso.giorno === kpi.atteso.giorno && quadro.giorno_dati === kpi.atteso.giorno, J([quadro.rete.atteso, kpi.atteso]));
verifica('l\'ACI e l\'extra raccolta pure', quadro.aci.raccolto_t === kpi.raccolto_aci_anno && quadro.aci.previsione_t === kpi.previsione_aci && quadro.extra.raccolto_t === kpi.raccolto_extra_anno, J([quadro.aci.raccolto_t, kpi.raccolto_aci_anno, quadro.extra, kpi.raccolto_extra_anno]));
verifica('l\'extra raccolta non conta i trasferimenti in secondaria', quadro.extra.interventi === 1 && quadro.extra.raccolto_t === 0.4);
const kg = (x) => Math.round(x * 1000);
verifica('le regioni piu\' quelle fuori contratto (Toscana, senza provincia) fanno il raccolto, al chilo', kg(quadro.rete.regioni.reduce((s, r) => s + r.raccolto_t, 0) + quadro.rete.fuori_contratto.raccolto_t) === kg(kpi.raccolto_rete_anno)
  && quadro.rete.fuori_contratto.regioni.map(r => r.regione).sort().join() === 'Altro,Toscana', J(quadro.rete.fuori_contratto));
verifica('le regioni del contratto sono quelle del grafico di prima, con lo stesso raccolto', J(quadro.rete.regioni.map(r => [r.regione, kg(r.raccolto_t)])) === J(r26.j.target_vs_raccolto.map(r => [r.regione, kg(r.raccolto)])));
verifica('i mesi fanno il raccolto', kg(quadro.rete.mesi.reduce((s, m) => s + (m.raccolto_t || 0), 0)) === kg(kpi.raccolto_rete_anno));
const righe26 = PRIMARIE.filter(r => (periodoMovimento(r) || {}).anno === 2026);
verifica('i ritiri sono ordini distinti (due righe per ordine), non righe', quadro.rete.ritiri === new Set(righe26.map(r => r.id_ordine)).size && quadro.rete.ritiri < righe26.length, `${quadro.rete.ritiri} su ${righe26.length} righe`);
verifica('i senza fine trasporto sono quelli di prima', quadro.rete.senza_fine_trasporto === r26.j.senza_fine_trasporto.rete);
const r25 = await chiama(nuova, { anno: [2025] });
verifica('un anno passato: chiuso, proiezione = raccolto, i suoi dodici mesi dell\'attiva', r25.j.quadro.anno_chiuso === true && r25.j.quadro.rete.proiezione.t === Math.round(r25.j.kpi.raccolto_rete_anno * 1000) / 1000 && r25.j.quadro.mesi_attiva.length === 12 && r25.j.quadro.mesi_attiva[0].chiuso === false, J(r25.j.quadro.mesi_attiva && r25.j.quadro.mesi_attiva[0]));
const multi = await chiama(nuova, { anno: [2025, 2026] });
verifica('due anni insieme: nessun quadro, col perche\'', multi.j.quadro === null && /un anno alla volta/.test(multi.j.quadro_perche), J([multi.j.quadro, multi.j.quadro_perche]));
const r27 = await chiama(nuova, { anno: [2027] });
verifica('il 2027 senza contratto: «—» dappertutto, niente zeri', r27.j.quadro.rete.target_t === null && r27.j.quadro.rete.atteso === null && r27.j.quadro.rete.residuo_t === null && r27.j.quadro.rete.proiezione === null, J(r27.j.quadro.rete).slice(0, 400));

console.log('3. IL BILANCIO DELLE RICHIESTE');
const pagine = (l, nome) => l[nome] || 0;
verifica('le primarie di rete: tre pagine, una lettura sola', pagine(r26.letture, 'PrimariaRete') === 3, J(r26.letture));
verifica('i target dei raccoglitori: una pagina ciascuno', pagine(r26.letture, 'TargetMensile') === 1 && pagine(r26.letture, 'TargetRaccoglitore') === 1, J(r26.letture));
verifica('l\'anno in corso non legge documenti e prefatture (li ha il cruscotto)', pagine(r26.letture, 'DocumentoFatturazione') === 0 && pagine(r26.letture, 'PrefatturaEcotyre') === 0, J(r26.letture));
verifica('un anno passato li legge, una pagina ciascuno', pagine(r25.letture, 'DocumentoFatturazione') === 1 && pagine(r25.letture, 'PrefatturaEcotyre') === 1, J(r25.letture));
verifica('due anni: niente letture del quadro', pagine(multi.letture, 'TargetMensile') === 0 && pagine(multi.letture, 'TargetRaccoglitore') === 0, J(multi.letture));
verifica('e la funzione non scrive niente', globalThis.__SCRITTE.length === 0, J(globalThis.__SCRITTE));
const totale = (l) => Object.values(l).reduce((s, v) => s + v, 0);
{
  // L'apertura della dashboard, prima e dopo, sullo stesso archivio. Prima:
  // getDashboardStats, getDashboardRaccolta, cruscottoOperativo e il pannello dei
  // target (checkTargetAlerts senza scrivere). Dopo: getDashboardRaccolta e
  // cruscottoOperativo. Il margine (solo amministratore) e' uguale prima e dopo,
  // e la chiusura del mese si legge solo quando si apre la sua sezione.
  const vecchie = await Promise.all(['getDashboardStats', 'getDashboardRaccolta', 'cruscottoOperativo', 'checkTargetAlerts'].map(f => funzioneDi('7607980', f)));
  const nuove = [nuova, await funzione('cruscottoOperativo')];
  if (vecchie.every(Boolean)) {
    const corpiPrima = [{ anno: [2026], mese: [] }, { anno: [2026], mese: [] }, {}, { crea_alerts: false }];
    const lettePrima = {}, letteDopo = {};
    for (const [i, f] of vecchie.entries()) { const r = await chiama(f, corpiPrima[i]); for (const [k, v] of Object.entries(r.letture)) lettePrima[k] = (lettePrima[k] || 0) + v; }
    for (const [i, f] of nuove.entries()) { const r = await chiama(f, i === 0 ? { anno: [2026] } : {}); verifica(`la funzione nuova ${i ? 'cruscottoOperativo' : 'getDashboardRaccolta'} risponde`, r.stato === 200, J(r.j).slice(0, 200)); for (const [k, v] of Object.entries(r.letture)) letteDopo[k] = (letteDopo[k] || 0) + v; }
    console.log(`  letture all'apertura: prima ${totale(lettePrima)}, dopo ${totale(letteDopo)}; primarie di rete prima ${pagine(lettePrima, 'PrimariaRete')}, dopo ${pagine(letteDopo, 'PrimariaRete')}`);
    verifica('aprire la dashboard legge meno di prima', totale(letteDopo) < totale(lettePrima), `${J(lettePrima)} / ${J(letteDopo)}`);
    // In tutte e due c'e' anche la lettura breve del «fino al» del cruscotto.
    verifica('le primarie di rete intere: una volta (3 pagine) invece di tre (9)', pagine(letteDopo, 'PrimariaRete') === 3 + 1 && pagine(lettePrima, 'PrimariaRete') === 9 + 1, `${pagine(lettePrima, 'PrimariaRete')} / ${pagine(letteDopo, 'PrimariaRete')}`);
    verifica('secondarie e terziarie intere non si leggono piu\': resta la lettura breve del «fino al»', letteDopo.Secondaria === 1 && letteDopo.Terziaria === 1 && lettePrima.Secondaria === 2 && lettePrima.Terziaria === 2, `${J(lettePrima)} / ${J(letteDopo)}`);
    verifica('il battito dei lavori: una lettura in piu\', una pagina', letteDopo.EsecuzioneLavoro === 1, J(letteDopo));
  } else {
    console.log('  (git non disponibile: il bilancio col codice di prima si salta)');
  }
}

console.log('4. NIENTE EURO, PER NESSUNO');
globalThis.__RUOLO = 'user';
const utente = await chiama(nuova, { anno: [2026] });
globalThis.__RUOLO = 'admin';
verifica('a chi non e\' amministratore la stessa risposta', J(utente.j) === J(r26.j));
const chiavi = (o, via = '') => (o && typeof o === 'object' ? Object.entries(o).flatMap(([k, v]) => [via + k, ...chiavi(v, via + k + '.')]) : []);
verifica('nel quadro nessuna chiave di euro, costi, ricavi, prezzi o margini', !chiavi(quadro).some(k => /euro|costo|ricavo|prezzo|margine/i.test(k)) && !/prezzo/i.test(J(quadro)), chiavi(quadro).filter(k => /euro|costo|ricavo|prezzo|margine/i.test(k)).join());
verifica('nessun campo totale che sommi i canali', !chiavi(quadro).some(k => /(^|\.)total/i.test(k)));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
