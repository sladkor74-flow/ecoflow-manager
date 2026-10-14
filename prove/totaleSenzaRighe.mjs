// UNA RIGA SENZA NUMERO NON VALE ZERO NEL TOTALE (revisione del 14/10/2026 sulle
// decisioni dell'utente del 13/10/2026: gli anni passati con lo stesso numero nei
// due moduli).
//
// Il 2026 guardato il 05/01/2027, prima che la chiusura dell'anno salvi la lettura
// del 31/12: le righe dei cinque impianti che dichiarano la rete dicevano «—» col
// loro perche', ma il totale della colonna delle Giacenze, che e' anche la KPI
// «Giacenza rete a portale», diceva 25,88 t, il solo piazzale di Nappi Sud, e il
// totale a portale delle Dichiarazioni 0: righe senza numero contate come zero,
// senza dirlo. Ora una riga che il numero non ce l'ha per mancanza del dato fa del
// totale del canale un «—», e il totale dice quali righe e perche', con la stessa
// regola e le stesse parole nei due moduli (totaleDellaColonna,
// shared/giacenzaPortale.ts). La rete di chi non la dichiara non manca.
//
// Qui si prova:
// 1. la regola;
// 2. le due funzioni vere su un archivio costruito: l'anno chiuso prima della
//    chiusura, poi dopo; l'anno in corso com'era; senza il file degli ordini non
//    dichiarati; un piazzale senza nessuna lettura;
// 3. le pagine: la tabella delle Giacenze e la Quadratura lo dicono sopra i numeri;
// 4. sui dati veri (../dati-veri/, se c'e'): il 2026 guardato il 05/01/2027, e
//    l'anno in corso che non cambia di un chilo.
// npm run prove
import { build } from 'esbuild';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as PORTALE from '../base44/shared/giacenzaPortale.ts';
import { PERCHE_PIAZZALE_SENZA_LETTURA } from '../base44/shared/giacenzaStoccaggi.ts';
import { normalizzaRagioneSociale as norm } from '../base44/shared/normalizzaRagioneSociale.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
const manca = (nome) => () => { throw new Error(`${nome} non c'e'`); };
const totaleDellaColonna = PORTALE.totaleDellaColonna || manca('totaleDellaColonna');
const PERCHE_TOTALE_SENZA_RIGHE = PORTALE.PERCHE_TOTALE_SENZA_RIGHE || manca('PERCHE_TOTALE_SENZA_RIGHE');
const { PERCHE_SENZA_LETTURA_DEL_TRENTUNO, PERCHE_SENZA_FOTOGRAFIA } = PORTALE;
const prova = (f) => { try { return f(); } catch (e) { return { errore: String(e && e.message) }; } };

console.log('1. LA REGOLA');
{
  const A = 'il perche\' di A', B = 'il perche\' di B';
  const tutte = prova(() => totaleDellaColonna([{ sito: 'X', t: 10 }, { sito: 'Y', t: 2.5 }, { sito: 'Z', t: 0 }]));
  verifica('tutte le righe col numero: la somma, nessun perche\'', tutte && tutte.t === 12.5 && tutte.perche === null && tutte.mancano.length === 0, J(tutte));
  const una = prova(() => totaleDellaColonna([{ sito: 'X', t: 10 }, { sito: 'IRIGOM SRL', t: null, perche: A }]));
  verifica('una riga senza il dato: il totale e\' «—», non 10', una && una.t === null && J(una.mancano) === J(['IRIGOM SRL']), J(una));
  verifica('e dice quale riga e perche\'', una && una.perche === "Il totale non si fa: la riga di IRIGOM SRL non ha il numero, e una riga senza numero non vale zero. il perche' di A", J(una && una.perche));
  const due = prova(() => totaleDellaColonna([{ sito: 'T-CYCLE', t: null, perche: A }, { sito: 'Gatim', t: null, perche: A }, { sito: 'NAPPI SUD (piazzale)', t: 25.88 }]));
  verifica('due righe con lo stesso perche\': in ordine alfabetico, e il perche\' una volta', due && due.t === null && due.perche === "Il totale non si fa: 2 righe non hanno il numero (Gatim, T-CYCLE), e una riga senza numero non vale zero. il perche' di A", J(due && due.perche));
  const diversi = prova(() => totaleDellaColonna([{ sito: 'X', t: null, perche: A }, { sito: 'Y', t: undefined, perche: B }]));
  verifica('due perche\' diversi: lo dice ogni riga', diversi && diversi.t === null && / Il perche' lo dice ogni riga\.$/.test(diversi.perche || ''), J(diversi));
  const nonDovuta = prova(() => totaleDellaColonna([{ sito: 'X', t: 7 }, { sito: 'TECNOGUM SRL', t: null, perche: null }]));
  verifica('una riga senza numero per accordo (la rete di chi non la dichiara) non manca: 7', nonDovuta && nonDovuta.t === 7 && nonDovuta.perche === null, J(nonDovuta));
  verifica('lo zero e\' un numero, non un buco', prova(() => totaleDellaColonna([{ sito: 'X', t: 0, perche: A }])).t === 0);
  verifica('il testo per tante righe', prova(() => PERCHE_TOTALE_SENZA_RIGHE(['A', 'B'], null)) === "Il totale non si fa: 2 righe non hanno il numero (A, B), e una riga senza numero non vale zero. Il perche' lo dice ogni riga.");
}

// --- Le funzioni vere, con un SDK finto: uguaglianza, $in, $gte, $lte, null ---
const ARCHIVI = {};
globalThis.__ARCHIVI_TOTALE_SENZA_RIGHE = ARCHIVI;
const SDK_FINTO = `
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    if ('$in' in v) return v.$in.includes(r[k]);
    if ('$gte' in v && !(r[k] != null && String(r[k]) >= String(v.$gte))) return false;
    if ('$lte' in v && !(r[k] != null && String(r[k]) <= String(v.$lte))) return false;
    return true;
  }
  if (v === null) return r[k] === null || r[k] === undefined || r[k] === '';
  return r[k] === v;
});
const ordina = (righe) => [...righe].sort((a, b) => String(a.id).localeCompare(String(b.id)));
const entita = (nome) => ({
  list: async (_o, lim = 1e9, skip = 0) => ordina(globalThis.__ARCHIVI_TOTALE_SENZA_RIGHE[nome] || []).slice(skip, skip + lim),
  filter: async (f, _o, lim = 1e9, skip = 0) => ordina((globalThis.__ARCHIVI_TOTALE_SENZA_RIGHE[nome] || []).filter(r => soddisfa(r, f))).slice(skip, skip + lim),
  create: async (r) => r, update: async (_id, r) => r, delete: async () => ({}),
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: 'admin', email: 'prova' }) }, asServiceRole: { entities }, entities };
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
  return async (corpo) => (await modulo.default({ json: async () => corpo })).json();
};
const OraVera = Date;
const conOra = async (iso, f) => {
  const ms = OraVera.parse(iso);
  globalThis.Date = class extends OraVera { constructor(...a) { if (a.length) super(...a); else super(ms); } static now() { return ms; } };
  try { return await f(); } finally { globalThis.Date = OraVera; }
};
let seq = 0;
const VUOTI = ['DichiarazioneTrattamento', 'Terziaria', 'ImpiantoTargetSecondaria', 'TargetRaccoglitore', 'TargetMensile',
  'GiacenzaStoccaggio', 'IndicatoreGiorno', 'PrimariaAci', 'ExtraRaccolta', 'Secondaria', 'OrdineNonDichiarato',
  'DichiarazioneSito', 'GiacenzaSito', 'PrimariaRete', 'CommessaEcotyre', 'RegistroCaricamento', 'StatoArchivio', 'UploadLog'];
const con = (nome, righe) => { ARCHIVI[nome] = righe.map(r => ({ id: 'r' + String(++seq).padStart(5, '0'), ...r })); };
const g = (giorno) => `${giorno}T08:00:00Z`;
const movimento = (id, dest, kg, giorno, extra = {}) => ({
  id_ordine: id, numero_fir: 'FIR' + id, classe: 'P - fino a 35 kg', prodotto: '.class1', destinazione: dest,
  tipo_destinazione: 'imp', stato: 'terminato', peso_effettivo: kg, trasportatore: 'RACCOLTA SRL', provincia: 'NA',
  ordine_immesso_il: g(giorno), trasporto_iniziato_il: g(giorno), trasporto_finito_il: g(giorno), ordine_chiuso_il: g(giorno), ...extra,
});
const nelFile = (ordine, dest, kg, fine) => ({ ordine_primaria: ordine, destinazione: dest, prodotto: '.class1', peso_non_dichiarato_kg: kg, created_date: '2026-10-05T06:00:00Z', fine_trasporto: fine });
const IRI = 'IRIGOM SRL', ALFA = 'ALFA RECYCLING SRL', TEC = 'TECNOGUM SRL', NAP = 'NAPPI SUD SRL', DEP = 'DEPOSITO NUOVO SRL';
const OGGI = '2026-10-11T10:00:00Z';
const GENNAIO = '2027-01-05T10:00:00Z';
// L'archivio: il 2026 aperto nel gestionale. Irigom e Alfa dichiarano la rete,
// Tecnogum no; Nappi Sud e' un piazzale con la lettura del 31/12/2025 e 25 t.
// chiusura: la chiusura del 2026 ha salvato la lettura del 31/12 (Irigom 30 t, Alfa 10 t).
// senzaFile: il file degli ordini non dichiarati non c'e'.
// depositoNuovo: un piazzale con un arrivo e nessuna lettura.
const archivio = ({ chiusura = false, senzaFile = false, depositoNuovo = false } = {}) => {
  for (const k of Object.keys(ARCHIVI)) delete ARCHIVI[k];
  for (const v of VUOTI) ARCHIVI[v] = [];
  con('GiacenzaSito', [
    { sito: IRI, tipo_destinazione: 'imp', anno: 2026, dichiara_rete: true },
    { sito: ALFA, tipo_destinazione: 'imp', anno: 2026, dichiara_rete: true },
    { sito: TEC, tipo_destinazione: 'imp', anno: 2026, dichiara_rete: false },
    { sito: NAP, tipo_destinazione: 'stoc', anno: 2026 },
    ...(depositoNuovo ? [{ sito: DEP, tipo_destinazione: 'stoc', anno: 2026 }] : []),
    ...(chiusura ? [
      { sito: IRI, tipo_destinazione: 'imp', anno: 2027, dichiara_rete: true, giacenza_riferimento_t: 30, apertura_del: '2026-12-31' },
      { sito: ALFA, tipo_destinazione: 'imp', anno: 2027, dichiara_rete: true, giacenza_riferimento_t: 10, apertura_del: '2026-12-31' },
    ] : []),
  ]);
  con('GiacenzaStoccaggio', [{ sito: NAP, data_rilevazione: '2025-12-31', class1_kg: 20000, class2_kg: 0, class3_kg: 0, class4_kg: 0, class9_kg: 0, created_date: '2026-01-02T09:00:00Z' }]);
  con('PrimariaRete', [
    movimento('ET26IRI03', IRI, 30000, '2026-03-10'),
    movimento('ET26ALFA04', ALFA, 10000, '2026-04-10'),
    movimento('ET26TEC05', TEC, 15000, '2026-05-10'),
    movimento('ET26NAP06', NAP, 5000, '2026-06-10', { tipo_destinazione: 'stoc' }),
    ...(depositoNuovo ? [movimento('ET26DEP07', DEP, 4000, '2026-07-10', { tipo_destinazione: 'stoc' })] : []),
  ]);
  con('OrdineNonDichiarato', senzaFile ? [] : [
    nelFile('ET26IRI03', IRI, 30000, '2026-03-10'), nelFile('ET26ALFA04', ALFA, 10000, '2026-04-10'), nelFile('ET26NAP06', NAP, 5000, '2026-06-10'),
    ...(depositoNuovo ? [nelFile('ET26DEP07', DEP, 4000, '2026-07-10')] : []),
  ]);
};
const giacenze = await funzione('calcolaGiacenze');
const riepilogo = await funzione('riepilogoDichiarazioni');
const due = async (ora, opzioni) => {
  archivio(opzioni);
  return { G: await conOra(ora, () => giacenze({ anno: 2026 })), R: await conOra(ora, () => riepilogo({ anno: 2026 })) };
};
const impG = (G, sito) => (G.righe || []).find(r => r.tipo_destinazione === 'imp' && norm(r.sito) === norm(sito)) || {};
const stocG = (G, sito) => (G.righe || []).find(r => r.tipo_destinazione === 'stoc' && norm(r.sito) === norm(sito)) || {};
const perche = (x) => (x && x.totali && x.totali.perche_totali) || null;

console.log('2. LE DUE FUNZIONI VERE, SU UN ARCHIVIO COSTRUITO');
const GEN = await due(GENNAIO);
{
  const { G, R } = GEN;
  const atteso = prova(() => PERCHE_TOTALE_SENZA_RIGHE([ALFA, IRI], PERCHE_SENZA_LETTURA_DEL_TRENTUNO(2026)));
  verifica('il 2026 guardato il 05/01/2027: Irigom e Alfa «—» col perche\' della lettura, Tecnogum per accordo, Nappi Sud 25 t',
    impG(G, IRI).giacenza_portale_t === null && impG(G, ALFA).giacenza_portale_t === null && impG(G, TEC).rete_non_dovuta === true && stocG(G, NAP).giacenza_portale_t === 25,
    J([impG(G, IRI).giacenza_portale_t, impG(G, ALFA).giacenza_portale_t, stocG(G, NAP).giacenza_portale_t]));
  verifica('il totale della rete delle Giacenze e\' «—», non le 25 t del solo piazzale', G.totali.giacenza_portale_t === null, J(G.totali.giacenza_portale_t));
  verifica('e il totale a portale delle Dichiarazioni e\' «—», non 0', R.totali.giacenza_portale_t === null, J(R.totali.giacenza_portale_t));
  verifica('tutti e due dicono quali impianti e perche\', con le stesse parole (Tecnogum non manca)',
    perche(G) && perche(R) && perche(G).RETE === atteso && perche(R).RETE === atteso && !/TECNOGUM/.test(atteso), J([perche(G), perche(R)]));
  verifica('ACI ed extra raccolta hanno il numero su ogni riga: i loro totali restano numeri, senza perche\'',
    typeof G.totali.giacenza_aci_t === 'number' && typeof G.totali.giacenza_extra_t === 'number' && !(perche(G) || {}).ACI && !(perche(G) || {}).EXTRA_RACCOLTA, J([G.totali.giacenza_aci_t, G.totali.giacenza_extra_t]));
  verifica('non e\' un anno prima del gestionale', G.totali.prima_del_gestionale === false && !R.prima_del_gestionale);
}
{
  // Dopo la chiusura: la lettura del 31/12 c'e', i totali tornano numeri.
  const { G, R } = await due(GENNAIO, { chiusura: true });
  verifica('dopo la chiusura: le letture del 31/12 (30 + 10) e il piazzale (25), totale 65 t nelle Giacenze, 40 a portale nelle Dichiarazioni, nessun perche\'',
    G.totali.giacenza_portale_t === 65 && R.totali.giacenza_portale_t === 40 && !perche(G) && !perche(R), J([G.totali.giacenza_portale_t, R.totali.giacenza_portale_t, perche(G), perche(R)]));
}
{
  // L'anno in corso, col file: com'era.
  const { G, R } = await due(OGGI);
  verifica('l\'anno in corso col file del portale: i totali di prima (65 t, 40 t), nessun perche\'',
    G.totali.giacenza_portale_t === 65 && R.totali.giacenza_portale_t === 40 && !perche(G) && !perche(R), J([G.totali.giacenza_portale_t, R.totali.giacenza_portale_t, perche(G), perche(R)]));
}
{
  // Senza il file degli ordini non dichiarati: gli impianti non hanno il numero.
  const { G, R } = await due(OGGI, { senzaFile: true });
  const atteso = prova(() => PERCHE_TOTALE_SENZA_RIGHE([ALFA, IRI], PERCHE_SENZA_FOTOGRAFIA));
  verifica('senza il file del portale: «—» in tutti e due i totali, col perche\' del file, le stesse parole',
    G.totali.giacenza_portale_t === null && R.totali.giacenza_portale_t === null && perche(G) && perche(R) && perche(G).RETE === atteso && perche(R).RETE === atteso, J([G.totali.giacenza_portale_t, R.totali.giacenza_portale_t, perche(G), perche(R)]));
}
{
  // Un piazzale senza nessuna lettura: manca alla rete e all'ACI delle Giacenze.
  // Il totale a portale delle Dichiarazioni e' dei soli impianti, e non cambia.
  const { G, R } = await due(OGGI, { depositoNuovo: true });
  const atteso = prova(() => PERCHE_TOTALE_SENZA_RIGHE([`${DEP} (piazzale)`], PERCHE_PIAZZALE_SENZA_LETTURA));
  verifica('un piazzale senza lettura: il totale della rete e dell\'ACI delle Giacenze e\' «—», col suo perche\'',
    stocG(G, DEP).giacenza_portale_t === null && G.totali.giacenza_portale_t === null && G.totali.giacenza_aci_t === null && perche(G) && perche(G).RETE === atteso && perche(G).ACI === atteso,
    J([stocG(G, DEP).giacenza_portale_t, G.totali.giacenza_portale_t, G.totali.giacenza_aci_t, perche(G)]));
  verifica('e il totale a portale delle Dichiarazioni, che e\' degli impianti, resta 40 t', R.totali.giacenza_portale_t === 40 && !perche(R), J([R.totali.giacenza_portale_t, perche(R)]));
}

console.log('3. LE PAGINE');
// La pagina disegnata (react-dom/server), coi componenti veri e gli alias di Vite.
// src/lib/utils.js guarda il browser appena caricata (isIframe): un window finto.
if (typeof globalThis.window === 'undefined') globalThis.window = { self: 1, top: 1 };
const ESTENSIONI = ['', '.js', '.jsx', '.ts'];
const daAlias = (p) => { const base = qui('../src/' + p.slice(2)); return ESTENSIONI.map(e => base + e).find(f => existsSync(f) && /\.\w+$/.test(f)) || base; };
const disegna = async (componente, props, esportato = 'default') => {
  try {
    const pacchetto = await build({
      stdin: { contents: `import React from 'react'; import { renderToStaticMarkup } from 'react-dom/server.browser'; import * as M from ${J(qui('../src/components/' + componente))}; export const disegna = (p) => renderToStaticMarkup(React.createElement(M[${J(esportato)}], p));`, resolveDir: qui('.'), loader: 'js' },
      bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent', loader: { '.jsx': 'jsx', '.js': 'jsx' }, define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [{ name: 'alias', setup(b) { b.onResolve({ filter: /^@\// }, (args) => ({ path: daAlias(args.path) })); } }],
    });
    const P = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
    return P.disegna(props).replace(/<[^>]+>/g, ' ').replace(/&#x27;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ');
  } catch (e) { return `ERRORE ${String(e && e.message).slice(0, 300)}`; }
};
{
  const { G, R } = GEN;
  const testo = await disegna('giacenze/SituazioneTable.jsx', { righe: G.righe, totali: G.totali, onVaiDaDichiarare: () => {} });
  verifica('Giacenze: sopra la tabella «Totale Rete: —. Il totale non si fa: 2 righe non hanno il numero (ALFA RECYCLING SRL, IRIGOM SRL)»',
    /Totale Rete: —\. Il totale non si fa: 2 righe non hanno il numero \(ALFA RECYCLING SRL, IRIGOM SRL\), e una riga senza numero non vale zero\. Il 2026 e' chiuso/.test(testo), testo.slice(0, 400));
  verifica('Giacenze: la riga TOTALE Rete dice «—», non 25,00 t', /TOTALE Rete —/.test(testo) && !/TOTALE Rete 25,00 t/.test(testo), (testo.match(/TOTALE Rete .{0,30}/) || [])[0]);
  verifica('Giacenze: nessun NaN o undefined a video', !/NaN|undefined/.test(testo), (testo.match(/.{40}(NaN|undefined).{40}/) || [])[0]);
  const q = await disegna('dichiarazioni/Quadratura.jsx', { dati: R });
  verifica('Quadratura: «Totale Rete a portale: —.» con le stesse parole delle Giacenze',
    q.includes(`Totale Rete a portale: —. ${R.totali.perche_totali && R.totali.perche_totali.RETE}`) && !!(R.totali.perche_totali && R.totali.perche_totali.RETE), q.slice(0, 400));
  const { G: G2, R: R2 } = await due(OGGI);
  const t2 = await disegna('giacenze/SituazioneTable.jsx', { righe: G2.righe, totali: G2.totali, onVaiDaDichiarare: () => {} });
  const q2 = await disegna('dichiarazioni/Quadratura.jsx', { dati: R2 });
  verifica('l\'anno in corso: nessun banner, il totale 65,00 t', !/Il totale non si fa/.test(t2 + q2) && /TOTALE Rete 65,00 t/.test(t2), (t2.match(/TOTALE Rete .{0,30}/) || [])[0]);
}

console.log('4. SUI DATI VERI');
const CARTELLA = process.env.DATI_VERI || qui('../../dati-veri/');
const copie = existsSync(CARTELLA) ? readdirSync(CARTELLA).filter(n => /^treadrider-dati-veri-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n)).sort() : [];
if (!copie.length) console.log(`  nessuna copia dei dati veri in ${CARTELLA}: sezione saltata`);
else {
  const DATI = JSON.parse(gunzipSync(readFileSync(CARTELLA + copie[copie.length - 1])).toString('utf8'));
  for (const k of Object.keys(ARCHIVI)) delete ARCHIVI[k];
  Object.assign(ARCHIVI, DATI.archivi);
  const ANNO = Number(String(DATI.meta.letto_fino_al).slice(0, 4));
  const quando = `${ANNO + 1}-01-05T10:00:00Z`;
  const G = await conOra(quando, () => giacenze({ anno: ANNO }));
  const R = await conOra(quando, () => riepilogo({ anno: ANNO }));
  const senza = (G.righe || []).filter(r => r.tipo_destinazione === 'imp' && r.giacenza_portale_t === null && !r.rete_non_dovuta).map(r => r.sito);
  verifica(`il ${ANNO} guardato il 05/01/${ANNO + 1}: gli impianti che dichiarano la rete sono «—» (${senza.length})`, senza.length >= 1, J(senza));
  verifica('e i due totali sono «—», non il solo piazzale (25,88 t) e non 0', G.totali.giacenza_portale_t === null && R.totali.giacenza_portale_t === null, J([G.totali.giacenza_portale_t, R.totali.giacenza_portale_t]));
  verifica('con le stesse parole, che nominano ogni impianto senza numero', perche(G) && perche(R) && perche(G).RETE === perche(R).RETE && senza.every(s => perche(G).RETE.includes(s)) && perche(G).RETE.includes(`lettura del 31/12/${ANNO}`), J([perche(G), perche(R)]));
  const Go = await conOra(DATI.meta.letto_fino_al, () => giacenze({ anno: ANNO }));
  const Ro = await conOra(DATI.meta.letto_fino_al, () => riepilogo({ anno: ANNO }));
  verifica(`l'anno in corso non cambia: ${Go.totali.giacenza_portale_t} t nelle Giacenze, ${Ro.totali.giacenza_portale_t} t a portale nelle Dichiarazioni, nessun perche'`,
    typeof Go.totali.giacenza_portale_t === 'number' && typeof Ro.totali.giacenza_portale_t === 'number' && !perche(Go) && !perche(Ro), J([Go.totali.giacenza_portale_t, Ro.totali.giacenza_portale_t, perche(Go), perche(Ro)]));
  if (ANNO === 2026 && String(DATI.meta.letto_fino_al).startsWith('2026-10-11')) {
    verifica('sulla copia dell\'11/10/2026: 1.643,10 t e 1.617,22 t, come prima', Go.totali.giacenza_portale_t === 1643.1 && Ro.totali.giacenza_portale_t === 1617.22, J([Go.totali.giacenza_portale_t, Ro.totali.giacenza_portale_t]));
  }
}

console.log(`\n${ok} superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
