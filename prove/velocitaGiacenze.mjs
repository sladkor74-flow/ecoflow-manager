// GIACENZE E DICHIARAZIONI PIU' VELOCI, SENZA CAMBIARE UN NUMERO (giro della
// velocita' del 14/10/2026, sull'approvazione dell'utente: «per me ok sulle cose
// da sistemare, sulla velocità e su quanto da creare, procedi pure»).
//
// Le due pagine rifanno tutto il conto a ogni apertura, e le richieste agli
// archivi si contano per tutta l'app insieme (AGENTS.md, «Il limite di
// richieste della piattaforma»). Misurate sui dati veri dell'11/10/2026:
//   - calcolaGiacenze leggeva GiacenzaSito due volte su un anno chiuso (l'anno e
//     l'anno dopo): 19 richieste invece di 18;
//   - riepilogoDichiarazioni leggeva DichiarazioneSito due volte (l'anno e
//     tutte) e GiacenzaSito due volte su un anno chiuso: 16 e 17 richieste
//     invece di 15. E il report delle dichiarazioni e le primarie di rete, i due
//     archivi grandi, si leggevano dopo tutti gli altri e una pagina per volta:
//     otto richieste in fila, una dopo l'altra, invece delle quattro del report.
// Ora ogni archivio si legge una volta per chiamata, tutti insieme, a pagine da
// 5000 in ordine di id, e quello che serve per anno si prende in memoria.
//
// La prova fa girare le funzioni vere con un archivio finto che conta ogni
// richiesta, e il «giro» di ciascuna: 1 per quelle che partono subito, n+1 per
// quelle che partono dopo che ne e' tornata una del giro n. Il giro piu' alto e'
// quante richieste stanno in fila, cioe' il tempo che la rete aggiunge.
//   1. su un archivio costruito (gira anche senza i dati veri): ogni archivio
//      letto una volta, le richieste quante le pagine, il riepilogo in tanti
//      giri quante le pagine del report;
//   2. sui dati veri (../dati-veri/, se c'e'): lo stesso, sul 2026, sul 2025 e
//      sul 2024, con le misure;
//   3. in tutti e due, se git c'e', il confronto col codice di prima (il commit
//      5939d15, prima di questo giro): meno richieste, e le risposte identiche.
//      Unica differenza voluta: gli ordini da dichiarare degli impianti su un
//      anno passato, con l'etichetta che lo dice (ordini_dei_carichi_del,
//      prove/ordiniAnniPassati.mjs). L'anno dopo, che la pagina offre, risponde
//      come l'anno in corso: identico al carattere (revisione del 14/10/2026). Il
//      confronto delle risposte dice che questo giro non ha cambiato un numero:
//      chi poi cambia apposta le risposte di una delle due funzioni lo toglie
//      (o lo limita a richieste e giri) e lo scrive qui, come per
//      prove/dashboardDatiVeri.mjs. I controlli delle sezioni 1 e 2 restano.
// npm run prove
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { RIGHE_PER_PAGINA, ultimaPagina } from '../base44/shared/fetchAll.ts';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);

// Il codice di prima: il commit che precede questo giro.
const PRIMA = '5939d15';
const CAMBIATE_APPOSTA = `(se dopo il giro del 14/10/2026 le risposte sono cambiate apposta, questo confronto col commit ${PRIMA} non vale piu': si toglie, vedi in testa)`;

// L'archivio finto: uguaglianza, $in, $gte, $lte, null per il campo vuoto,
// ordinamento, pagine. Ogni richiesta si registra col suo giro.
globalThis.__ARCHIVI_VELOCITA = {};
globalThis.__RICHIESTE_VELOCITA = [];
globalThis.__GIRO_VELOCITA = { lettureFinite: 0, ultimaPagina: {} };
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
const ordinatiPer = new WeakMap();
const ordina = (nome, sort) => {
  const tutte = globalThis.__ARCHIVI_VELOCITA[nome] || [];
  if (!ordinatiPer.has(tutte)) ordinatiPer.set(tutte, new Map());
  const ordinati = ordinatiPer.get(tutte);
  const chiave = sort || 'id';
  if (ordinati.has(chiave)) return ordinati.get(chiave);
  const campo = String(sort || 'id').replace(/^[-+]/, '');
  const giu = String(sort || '').startsWith('-');
  const righe = [...tutte].sort((a, b) => {
    const x = a[campo], y = b[campo];
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
    return giu ? -c : c;
  });
  ordinati.set(chiave, righe);
  return righe;
};
// Il giro di una richiesta. Una pagina che continua una lettura viene dopo la
// pagina prima di quella lettura; una lettura che comincia viene dopo tutte le
// letture gia' finite (l'ultima pagina tornata). Cosi' due letture che vanno
// insieme restano insieme, comunque si alternino le loro pagine.
const ultima = (letti, chiesti) => letti === 0 || (letti < chiesti && letti % 1000 !== 0);
const segna = (nome, filtro, skip, lim, fai) => {
  const G = globalThis.__GIRO_VELOCITA;
  const lettura = nome + '|' + (filtro ? JSON.stringify(filtro) : '');
  const giro = skip ? (G.ultimaPagina[lettura] || 0) + 1 : G.lettureFinite + 1;
  G.ultimaPagina[lettura] = giro;
  const righe = fai().map(r => ({ ...r }));
  globalThis.__RICHIESTE_VELOCITA.push({ nome, filtro: filtro ? JSON.stringify(filtro) : null, skip: skip || 0, n: righe.length, giro });
  return new Promise(ok => setTimeout(() => {
    if (ultima(righe.length, lim)) G.lettureFinite = Math.max(G.lettureFinite, giro);
    ok(righe);
  }, 0));
};
const entita = (nome) => ({
  list: (sort, lim = 1e9, skip = 0) => segna(nome, null, skip, lim, () => ordina(nome, sort).slice(skip, skip + lim)),
  filter: (f, sort, lim = 1e9, skip = 0) => segna(nome, f, skip, lim, () => ordina(nome, sort).filter(r => soddisfa(r, f)).slice(skip, skip + lim)),
  get: async (id) => (globalThis.__ARCHIVI_VELOCITA[nome] || []).find(r => r.id === id) || null,
  create: async () => { throw new Error('la prova della velocita\\' non scrive: ' + nome); },
  update: async () => { throw new Error('la prova della velocita\\' non scrive: ' + nome); },
  delete: async () => { throw new Error('la prova della velocita\\' non scrive: ' + nome); },
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: 'admin', email: 'prova-velocita' }) }, asServiceRole: { entities }, entities,
    functions: { invoke: async (n) => { throw new Error('la prova della velocita\\' non chiama altre funzioni: ' + n); } } };
}`;
const carica = async (opzioni) => {
  const p = await build({ bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent', ...opzioni,
    plugins: [{ name: 'sdk-finto', setup(b) {
      b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
      b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
    } }] });
  const m = await import('data:text/javascript;base64,' + Buffer.from(p.outputFiles[0].text).toString('base64'));
  return async (corpo) => { const r = await m.default({ json: async () => corpo }); return { stato: r.status, j: await r.json() }; };
};
const funzione = (nome) => carica({ entryPoints: [qui(`../base44/functions/${nome}/entry.ts`)] });
// La funzione com'era al commit di prima, coi moduli condivisi di oggi.
const funzioneDi = async (commit, nome) => {
  let testo;
  try { testo = execSync(`git show ${commit}:base44/functions/${nome}/entry.ts`, { cwd: qui('..'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; }
  return carica({ stdin: { contents: testo, resolveDir: qui(`../base44/functions/${nome}`), sourcefile: `${nome}-${commit}.ts`, loader: 'ts' } });
};
const OraVera = Date;
const conOra = async (iso, f) => {
  const ms = OraVera.parse(iso);
  globalThis.Date = class extends OraVera { constructor(...a) { if (a.length) super(...a); else super(ms); } static now() { return ms; } };
  try { return await f(); } finally { globalThis.Date = OraVera; }
};

/** Le pagine che fetchAll chiede per leggere tutto un archivio di n righe. */
const pagine = (n) => {
  let letti = 0, quante = 0;
  for (;;) {
    const pagina = Math.max(0, Math.min(RIGHE_PER_PAGINA, n - letti));
    quante++;
    if (ultimaPagina(pagina, RIGHE_PER_PAGINA)) return quante;
    letti += pagina;
  }
};

/** Una chiamata misurata: risposta, richieste, letture per archivio, giri, tempo di calcolo. */
const misura = async (f, ora, corpo) => {
  globalThis.__RICHIESTE_VELOCITA = [];
  globalThis.__GIRO_VELOCITA = { lettureFinite: 0, ultimaPagina: {} };
  const cpu = process.cpuUsage();
  const R = await conOra(ora, () => f(corpo));
  const usato = process.cpuUsage(cpu);
  const richieste = globalThis.__RICHIESTE_VELOCITA;
  // VELOCITA_DETTAGLIO=1 stampa ogni richiesta col suo giro: giro:archivio@salto.
  if (process.env.VELOCITA_DETTAGLIO) console.log(J(corpo), richieste.map(x => `${x.giro}:${x.nome}@${x.skip}${x.filtro ? x.filtro : ''}`).join(' '));
  const perArchivio = {};
  for (const x of richieste) {
    const a = (perArchivio[x.nome] = perArchivio[x.nome] || { richieste: 0, letture: 0, righe: 0 });
    a.richieste++;
    a.righe += x.n;
    // Una lettura comincia dalla prima pagina.
    if (x.skip === 0) a.letture++;
  }
  return {
    R, perArchivio, richieste: richieste.length, righe: richieste.reduce((s, x) => s + x.n, 0),
    giri: richieste.reduce((m, x) => Math.max(m, x.giro), 0), ms: Math.round((usato.user + usato.system) / 1000),
  };
};

/** Quante richieste costa leggere una volta ciascuno gli archivi letti. */
const attese = (m) => Object.keys(m.perArchivio).reduce((s, nome) => s + pagine((globalThis.__ARCHIVI_VELOCITA[nome] || []).length), 0);

// Gli ordini da dichiarare degli impianti su un anno passato sono cambiati
// apposta (prove/ordiniAnniPassati.mjs), e i totali dicono di quali carichi sono
// (ordini_dei_carichi_del): per confrontare il resto si tolgono, e con loro le
// righe che senza quegli ordini non hanno niente.
const ALTRO_CHE_ORDINI = ['giacenza_portale_t', 'in_attesa_dichiarazione_t', 'dichiarato_t', 'conferito_t', 'conferito_aci_t', 'conferito_extra_t', 'secondarie_aci_in_t', 'secondarie_extra_in_t', 'target_totale_t', 'target_primarie_t'];
const senzaOrdini = (j, tenere) => ({
  ...j,
  totali: { ...j.totali, ordini_da_dichiarare: undefined, ordini_dei_carichi_del: undefined },
  righe: (j.righe || []).filter(tenere).map(r => ({ ...r, ordini_da_dichiarare: undefined })),
});
const chiaveRiga = (r) => `${r.sito}|${r.tipo_destinazione}`;
/**
 * Le Giacenze di adesso contro quelle di prima: identiche sull'anno in corso (e
 * sull'anno dopo, che si controlla con annoInCorso vero);
 * su un altro anno identiche tolti gli ordini degli impianti, e una riga di
 * prima che manca adesso deve essere un impianto che aveva solo quegli ordini.
 */
const confrontaGiacenze = (adesso, prima, annoInCorso) => {
  if (annoInCorso) return { uguali: J(adesso) === J(prima), sparite: [] };
  const ci = new Set((adesso.righe || []).map(chiaveRiga));
  const sparite = (prima.righe || []).filter(r => !ci.has(chiaveRiga(r)));
  const soloOrdini = sparite.every(r => r.tipo_destinazione === 'imp' && r.ordini_da_dichiarare > 0
    && ALTRO_CHE_ORDINI.every(c => !(Number(r[c]) > 0)) && !(r.date_da_sistemare || []).length);
  const ordiniStoccaggi = (j) => J((j.righe || []).filter(r => r.tipo_destinazione === 'stoc').map(r => [chiaveRiga(r), r.ordini_da_dichiarare]));
  return {
    uguali: soloOrdini && J(senzaOrdini(adesso, () => true)) === J(senzaOrdini(prima, r => ci.has(chiaveRiga(r))))
      && ordiniStoccaggi(adesso) === ordiniStoccaggi(prima),
    sparite: sparite.map(chiaveRiga),
  };
};

const giacenze = await funzione('calcolaGiacenze');
const riepilogo = await funzione('riepilogoDichiarazioni');
const giacenzePrima = await funzioneDi(PRIMA, 'calcolaGiacenze');
const riepilogoPrima = await funzioneDi(PRIMA, 'riepilogoDichiarazioni');
if (!giacenzePrima || !riepilogoPrima) console.log(`  (git non disponibile o storia tagliata: il confronto col codice del commit ${PRIMA} si salta)`);

/**
 * Le due funzioni su un anno: ogni archivio letto una volta, le richieste quante
 * le pagine, il riepilogo coi due archivi grandi insieme agli altri, e col
 * codice di prima meno richieste e le stesse risposte.
 */
const controllaAnno = async (etichetta, ora, anno, annoInCorso, { stampa = false } = {}) => {
  const paginePiuLunghe = Math.max(...['DichiarazioneTrattamento', 'PrimariaRete'].map(n => pagine((globalThis.__ARCHIVI_VELOCITA[n] || []).length)));
  const G = await misura(giacenze, ora, { anno });
  const D = await misura(riepilogo, ora, { anno });
  for (const [nome, m] of [['calcolaGiacenze', G], ['riepilogoDichiarazioni', D]]) {
    verifica(`${etichetta}: ${nome} risponde`, m.R.stato === 200, J(m.R.j).slice(0, 300));
    const piuVolte = Object.entries(m.perArchivio).filter(([, a]) => a.letture !== 1).map(([n, a]) => `${n} ${a.letture}`);
    verifica(`${etichetta}: ${nome} legge ogni archivio una volta`, !piuVolte.length, piuVolte.join(', '));
    verifica(`${etichetta}: ${nome} fa tante richieste quante le pagine degli archivi che legge`, m.richieste === attese(m), `${m.richieste} richieste, ${attese(m)} pagine`);
    verifica(`${etichetta}: ${nome} non ha richieste in fila oltre le pagine dell'archivio piu' lungo`, m.giri === paginePiuLunghe, `${m.giri} giri, ${paginePiuLunghe} pagine`);
  }
  verifica(`${etichetta}: il riepilogo legge anche il report e le primarie di rete, i due archivi grandi`,
    !!D.perArchivio.DichiarazioneTrattamento && !!D.perArchivio.PrimariaRete, J(Object.keys(D.perArchivio)));
  const righe = [];
  const descrivi = (nome, m) => `${nome} ${anno}: ${m.richieste} richieste, ${m.righe} righe, ${m.giri} in fila, ${m.ms} ms di calcolo`;
  righe.push(descrivi('calcolaGiacenze', G), descrivi('riepilogoDichiarazioni', D));
  if (giacenzePrima && riepilogoPrima) {
    const Gp = await misura(giacenzePrima, ora, { anno });
    const Dp = await misura(riepilogoPrima, ora, { anno });
    righe.push(`  prima: ${descrivi('calcolaGiacenze', Gp)}`, `  prima: ${descrivi('riepilogoDichiarazioni', Dp)}`);
    verifica(`${etichetta}: il riepilogo risponde come prima, al carattere`, J(D.R.j) === J(Dp.R.j), `${CAMBIATE_APPOSTA}\n${J(D.R.j).slice(0, 200)}\n${J(Dp.R.j).slice(0, 200)}`);
    const c = confrontaGiacenze(G.R.j, Gp.R.j, annoInCorso);
    verifica(`${etichetta}: le Giacenze rispondono come prima${annoInCorso ? ', al carattere' : ', tolti gli ordini degli impianti di un anno passato'}`, c.uguali, `${CAMBIATE_APPOSTA} (sparite ${J(c.sparite)})`);
    if (c.sparite.length) righe.push(`  righe che avevano solo gli ordini del file di oggi, e non ci sono piu': ${c.sparite.join(', ')}`);
    verifica(`${etichetta}: il riepilogo fa meno richieste, o le stesse, e meno in fila`, D.richieste <= Dp.richieste && D.giri < Dp.giri, `${D.richieste}/${Dp.richieste} richieste, ${D.giri}/${Dp.giri} in fila`);
    verifica(`${etichetta}: il riepilogo legge una volta quello che prima leggeva due volte`, D.richieste < Dp.richieste, `${D.richieste}/${Dp.richieste}`);
    verifica(`${etichetta}: le Giacenze non fanno piu' richieste di prima${annoInCorso ? '' : ', e una in meno su un anno che non e\' quello in corso'}`,
      annoInCorso ? G.richieste <= Gp.richieste : G.richieste < Gp.richieste, `${G.richieste}/${Gp.richieste}`);
  }
  if (stampa) for (const r of righe) console.log('  ' + r);
  return { G, D };
};

// ─────────────────────────────────────────────────────────────────────────────
console.log('1. SU UN ARCHIVIO COSTRUITO');
{
  // Il 15/06/2026: il 2026 e' l'anno in corso, il 2025 e' chiuso. Il report ha
  // tre pagine (10.500 righe), le primarie due (6.200): abbastanza per vedere
  // le richieste in fila.
  const ORA = '2026-06-15T10:00:00Z';
  const ALFA = 'ALFA RECYCLING SRL', NAPPI = 'NAPPI SUD SRL';
  const id = (p, i) => `${p}${String(i).padStart(6, '0')}`;
  const giorno = (i) => `${2025 + (i % 2)}-${String(1 + (i % 5)).padStart(2, '0')}-${String(1 + (i % 27)).padStart(2, '0')}T08:00:00Z`;
  const primarie = Array.from({ length: 6200 }, (_, i) => ({
    id: id('p', i), id_ordine: `ET${i}`, numero_fir: `FIR${i}`, stato: 'terminato', destinazione: i % 7 ? ALFA : NAPPI, tipo_destinazione: i % 7 ? 'imp' : 'stoc',
    peso_effettivo: 1000 + (i % 13) * 10, classe: 'P - fino a 35 kg', prodotto: '.class1', trasportatore: 'RACCOLTA SRL', provincia: 'NA',
    ordine_immesso_il: giorno(i), trasporto_iniziato_il: giorno(i), trasporto_finito_il: giorno(i), ordine_chiuso_il: giorno(i),
  }));
  const report = Array.from({ length: 10500 }, (_, i) => ({
    id: id('d', i), ordine_primaria: `ET${i % 9000}`, prodotto: '.class1', partner_operativo: i % 11 ? 'SMOCO S.r.l.' : 'ALTRO SRL', destinazione: ALFA,
    data_dichiarazione: giorno(i + 1), fine_trasporto: giorno(i), peso_associato_kg: 800,
  }));
  globalThis.__ARCHIVI_VELOCITA = {
    PrimariaRete: primarie,
    DichiarazioneTrattamento: report,
    OrdineNonDichiarato: Array.from({ length: 40 }, (_, i) => ({ id: id('o', i), ordine_primaria: `ET${6000 + i}`, numero_fir: `FIR${6000 + i}`, destinazione: ALFA, prodotto: '.class1', peso_non_dichiarato_kg: 900, fine_trasporto: giorno(6000 + i), created_date: '2026-06-10T06:00:00Z' })),
    Secondaria: [{ id: id('s', 1), id_ordine: 'SEC1', stato: 'terminato', stoccaggio: NAPPI, destinazione: ALFA, tipo_destinazione: 'imp', peso_effettivo: 5000, prodotto: '.class1', classe: 'P - fino a 35 kg', ordine_immesso_il: '2026-03-01T08:00:00Z', trasporto_iniziato_il: '2026-03-02T08:00:00Z', trasporto_finito_il: '2026-03-02T12:00:00Z' }],
    GiacenzaSito: [
      { id: id('g', 1), sito: ALFA, tipo_destinazione: 'imp', anno: 2025, dichiara_rete: true },
      // la lettura del 31/12 ha tutti e due i canali: dalla prova generale del
      // cambio d'anno (15/10/2026, difetto 6) un'ACI mai scritta su una riga con
      // apertura_del non e' zero ma «—», e il confronto col commit 5939d15, che
      // la leggeva zero, non varrebbe piu'
      { id: id('g', 2), sito: ALFA, tipo_destinazione: 'imp', anno: 2026, dichiara_rete: true, apertura_del: '2025-12-31', giacenza_riferimento_t: 12, giacenza_riferimento_aci_t: 0 },
      { id: id('g', 3), sito: NAPPI, tipo_destinazione: 'stoc', anno: 2026 },
    ],
    GiacenzaStoccaggio: [{ id: id('r', 1), sito: NAPPI, data_rilevazione: '2025-12-31', class1_kg: 20000, class9_kg: 0 }],
    DichiarazioneSito: [
      { id: id('m', 1), sito: ALFA, anno: 2025, mese: 'Dicembre', canale: 'RETE', provenienza: '', quantita_kg: 4000, caricata_inviata: true, caricata_il: '2026-01-10' },
      { id: id('m', 2), sito: ALFA, anno: 2026, mese: 'Gennaio', canale: 'RETE', provenienza: '', quantita_kg: 3000, caricata_inviata: true, caricata_il: '2026-02-10' },
    ],
    PrimariaAci: [], ExtraRaccolta: [], Terziaria: [], ImpiantoTargetSecondaria: [], TargetRaccoglitore: [], TargetMensile: [],
  };
  verifica('premessa: il report ha tre pagine e le primarie due', pagine(report.length) === 3 && pagine(primarie.length) === 2, `${pagine(report.length)} ${pagine(primarie.length)}`);
  await controllaAnno("l'anno in corso (2026)", ORA, 2026, true);
  await controllaAnno('un anno chiuso (2025)', ORA, 2025, false);
  // L'anno dopo, che la pagina offre: come l'anno in corso, al carattere.
  await controllaAnno("l'anno dopo (2027)", ORA, 2027, true);
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('2. SUI DATI VERI');
const CARTELLA = process.env.DATI_VERI || qui('../../dati-veri/');
const copie = existsSync(CARTELLA) ? readdirSync(CARTELLA).filter(n => /^treadrider-dati-veri-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n)).sort() : [];
if (!copie.length) console.log(`  nessuna copia dei dati veri in ${CARTELLA}: sezione saltata`);
else {
  const nome = copie[copie.length - 1];
  const DATI = JSON.parse(gunzipSync(readFileSync(CARTELLA + nome)).toString('utf8'));
  globalThis.__ARCHIVI_VELOCITA = DATI.archivi;
  const ORA = DATI.meta.letto_fino_al;
  const ANNO = Number(String(ORA).slice(0, 4));
  console.log(`  copia ${nome}, letta il ${ORA}`);
  // Anche l'anno dopo, che la pagina offre: risponde come l'anno in corso, al
  // carattere (revisione del 14/10/2026).
  for (const anno of [ANNO, ANNO - 1, ANNO - 2, ANNO + 1]) {
    await controllaAnno(`${anno}${anno === ANNO ? ", l'anno in corso" : anno > ANNO ? ", l'anno dopo" : ''}`, ORA, anno, anno >= ANNO, { stampa: true });
  }
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
