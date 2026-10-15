// ECOTYNA LEGGE IL CONTRATTO, NON LA SOMMA DEI RACCOGLITORI (variazione del
// contratto del 14/10/2026, gruppo F-1).
//
// L'utente, il 14/10/2026: «falla tu la registrazione ed aggiorna tutto, ma fai
// in modo che quando si faccia una tale variazione i moduli collegati come la
// dashboard si aggiornino di conseguenza». Registrata la variazione di ottobre
// (Puglia +100 t, contratto 11.650 t), dashboard e Andamento si muovevano; a
// EcoTyna, alla domanda «Qual è oggi il target annuo 2026 del contratto Ecotyre
// sulla rete, e com'è messa la Puglia rispetto all'atteso?», il pianificatore
// sceglieva target_raccoglitori, che il contratto non lo leggeva: «11.650,00 t,
// come risulta dal modulo Target & Status» era la SOMMA DEI TARGET DEI
// RACCOGLITORI (il giorno prima sarebbe stata 11.650 contro un contratto di
// 11.550), e sulla Puglia «il dato [...] non è filtrato per area geografica».
// Qui:
// 1. su archivi costruiti: lo strumento contratto_ecotyre dice gli stessi numeri
//    di getDashboardRaccolta (la funzione vera, sul banco con l'SDK finto), campo
//    per campo, prima e dopo la variazione, con una variazione superata, senza
//    contratto e col contratto che non si legge; il filtro della regione e il
//    mese; target_raccoglitori chiama la somma dei raccoglitori col suo nome,
//    porta accanto il contratto e la differenza, e ogni raccoglitore la regione;
// 2. sulla copia dei dati veri dell'11/10/2026 con la variazione registrata
//    nella prova (come prove/variazioneContratto.mjs): gli stessi confronti, e
//    con i dati fino al 12/10 i numeri del sito di oggi (atteso 8.869,611 t,
//    Puglia 1.950,16 t);
// 3. il pianificatore: la scelta degli strumenti la fa il modello, quindi non e'
//    deterministica; si prova il testo che gli arriva (il catalogo: lo strumento
//    del contratto prima di target_raccoglitori, con le parole delle domande) e
//    che la domanda dell'utente e quella del chip passano allo strumento senza
//    filtri ignorati; e la regola 3-septdecies nelle istruzioni della risposta.
// UNA REGOLA SOLA (migliorie del 14/10/2026, gruppo H-2): prima contrattoRete.ts
// era una copia delle regole della dashboard, e questa prova la teneva allineata.
// Ora getDashboardRaccolta conta il contratto con contrattoReteDegliAnni e
// contrattoDellaRete e' lo stesso conto per un anno: qui si guarda anche il
// sorgente (lo stesso conto) e i confronti campo per campo restano, perche' sono
// quelli che dicono che EcoTyna e la dashboard danno gli stessi numeri sulla
// funzione vera. Che la dashboard risponda come prima, al carattere, lo dice
// prove/dashboardContrattoUnaRegola.mjs.
// Senza la copia dei dati veri la parte 2 si salta e lo dice.
// node prove/ecotynaContratto.mjs
import { build } from 'esbuild';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as A from '../base44/shared/attesoContratto.ts';
import { STRUMENTI, catalogoStrumenti } from '../base44/shared/strumentiAssistente.ts';
import { istruzioniPiano, strumentiDalPiano, testoDati } from '../base44/shared/pianoAssistente.ts';
import { fetchAll } from '../base44/shared/fetchAll.ts';
import { righeAndamento } from '../base44/shared/andamentoTarget.ts';
import { raccoltoPerRaccoglitore } from '../base44/shared/quadroCommessa.ts';
import { normalizzaRagioneSociale as normalizza } from '../base44/shared/normalizzaRagioneSociale.ts';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + String(extra).slice(0, 700)); } };
const J = (x) => JSON.stringify(x);
const sorgente = (p) => readFileSync(qui('../' + p), 'utf8').replace(/\r/g, '');
const tonn = (v) => (v === null || v === undefined ? null : Math.round(Number(v) * 1000) / 1000);
const cento = (v) => (v === null || v === undefined ? null : Math.round(Number(v) * 100) / 100);
const strumento = (nome) => STRUMENTI.find(s => s.nome === nome) || null;

// L'SDK finto legge da globalThis.__DATI come la piattaforma: uguaglianza, $in,
// $gte, $lte, null per il campo vuoto, ordinamento e pagine. __GUASTO fa fallire
// la lettura di un archivio.
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
const guasto = (nome) => { if (globalThis.__GUASTO && globalThis.__GUASTO.includes(nome)) throw new Error('archivio non raggiungibile'); };
const entita = (nome) => ({
  list: async (sort, lim = 1e9, skip = 0) => { guasto(nome); return ordina(globalThis.__DATI[nome] || [], sort).slice(skip, skip + lim); },
  filter: async (f, sort, lim = 1e9, skip = 0) => { guasto(nome); return ordina((globalThis.__DATI[nome] || []).filter(r => soddisfa(r, f)), sort).slice(skip, skip + lim); },
  get: async (id) => (globalThis.__DATI[nome] || []).find(r => r.id === id) || null,
  create: async (r) => r, update: async (_id, r) => r, bulkCreate: async (r) => r, delete: async () => ({}),
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
export const sdk = { auth: { me: async () => ({ role: 'admin', email: 'prova' }) }, asServiceRole: { entities }, entities,
  functions: { invoke: async (n) => { throw new Error('non disponibile nella prova: ' + n); } } };
export function createClientFromRequest() { return sdk; }`;
const plug = { name: 'sdk-finto', setup(b) {
  b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
  b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
} };
const modulo = async (opzioni) => import('data:text/javascript;base64,' + Buffer.from((await build({ bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent', plugins: [plug], ...opzioni })).outputFiles[0].text).toString('base64'));
const dashboard = await modulo({ entryPoints: [qui('../base44/functions/getDashboardRaccolta/entry.ts')] });
const { sdk } = await modulo({ stdin: { contents: SDK_FINTO, loader: 'js' } });
let contrattoRete = null;
try { contrattoRete = await import('../base44/shared/contrattoRete.ts'); } catch (_e) { /* il modulo nuovo non c'e': lo dice la verifica qui sotto */ }

// L'orologio fermo: «oggi» e' quello della prova, per la dashboard e per EcoTyna.
const OraVera = Date;
const conOra = async (iso, f) => {
  const ms = OraVera.parse(iso);
  globalThis.Date = class extends OraVera { constructor(...a) { if (a.length) super(...a); else super(ms); } static now() { return ms; } };
  try { return await f(); } finally { globalThis.Date = OraVera; }
};
const prepara = (archivi, guasto = []) => { globalThis.__DATI = archivi; globalThis.__GUASTO = guasto; };
const laDashboard = async (ora, anno) => conOra(ora, async () => (await dashboard.default({ json: async () => ({ anno: [anno] }) })).json());
const lo = async (nome, ora, p) => {
  const s = strumento(nome);
  if (!s) return null;
  return conOra(ora, () => s.esegui(sdk, p, null));
};

/**
 * Lo strumento contro la dashboard, campo per campo: gli stessi numeri, solo
 * arrotondati (tonnellate a tre decimali, percentuali a due).
 */
function stessiNumeri(nome, dati, d, { regione = '' } = {}) {
  if (!dati) { verifica(`${nome}: lo strumento risponde`, false, 'nessun dato'); return; }
  const q = d.quadro && d.quadro.rete;
  verifica(`${nome}: la dashboard risponde col quadro`, !!q, J(d.error || ''));
  if (!q) return;
  const k = d.kpi;
  verifica(`${nome}: target annuo del contratto`, dati.target_annuo_contratto_t === tonn(k.target), `${dati.target_annuo_contratto_t} contro ${k.target}`);
  verifica(`${nome}: raccolto`, dati.raccolto_t === tonn(k.raccolto_rete_anno), `${dati.raccolto_t} contro ${k.raccolto_rete_anno}`);
  verifica(`${nome}: percentuale del target`, dati.pct_del_target === cento(k.raggiungimento_pct), `${dati.pct_del_target} contro ${k.raggiungimento_pct}`);
  verifica(`${nome}: ritiri`, dati.ritiri === q.ritiri, `${dati.ritiri} contro ${q.ritiri}`);
  // il giorno delle etichette della dashboard (giorno_misura): per un anno chiuso il 31/12
  verifica(`${nome}: dati fino al (il giorno della misura)`, (dati.dati_fino_al || '') === (d.quadro.giorno_misura || ''), `${dati.dati_fino_al} contro ${d.quadro.giorno_misura}`);
  verifica(`${nome}: l'atteso e' al giorno dei dati`, !dati.atteso_alla_data || dati.atteso_alla_data.al === dati.dati_fino_al, `${J(dati.atteso_alla_data)} contro ${dati.dati_fino_al}`);
  verifica(`${nome}: l'anno chiuso si dice`, !!dati.anno_chiuso === !!d.quadro.anno_chiuso, `${dati.anno_chiuso} contro ${d.quadro.anno_chiuso}`);
  const a = dati.atteso_alla_data;
  verifica(`${nome}: atteso alla data`, q.atteso === null ? a === null && !!dati.atteso_perche
    : !!a && a.al === q.atteso.giorno && a.atteso_t === tonn(k.atteso.atteso_t) && a.pct_del_target === cento(k.atteso.pct) && a.scarto_t === tonn(k.atteso.scarto_t),
  `${J(a)} contro ${J(k.atteso)} / ${J(q.atteso)}`);
  verifica(`${nome}: residuo`, dati.residuo_t === q.residuo_t, `${dati.residuo_t} contro ${q.residuo_t}`);
  if ('proiezione_fine_anno' in dati) {
    const p = dati.proiezione_fine_anno;
    verifica(`${nome}: proiezione a fine anno`, q.proiezione === null ? p === null && dati.proiezione_perche === q.proiezione_perche
      : !!p && p.t === q.proiezione.t && p.pct_del_target === cento(q.proiezione.pct_target), `${J(p)} contro ${J(q.proiezione)}`);
    const r = dati.ritmo_che_serve;
    verifica(`${nome}: ritmo che serve`, q.ritmo === null ? r === null
      : !!r && r.servono_t_al_mese === q.ritmo.servono_t_mese && r.contratto_t_al_mese === q.ritmo.contratto_t_mese && r.pct_del_ritmo_del_contratto === cento(q.ritmo.pct_ritmo), `${J(r)} contro ${J(q.ritmo)}`);
  }
  const attese = (q.regioni || []).filter(r => !regione || r.regione.toLowerCase() === regione.toLowerCase());
  verifica(`${nome}: le regioni sono quelle della dashboard`, J((dati.regioni || []).map(r => r.regione)) === J(attese.map(r => r.regione)), `${J((dati.regioni || []).map(r => r.regione))} contro ${J(attese.map(r => r.regione))}`);
  for (const r of attese) {
    const x = (dati.regioni || []).find(y => y.regione === r.regione) || {};
    const tv = (d.target_vs_raccolto || []).find(y => y.regione === r.regione) || {};
    verifica(`${nome}: ${r.regione}, contratto, atteso, raccolto, scarto e percentuali`,
      x.contratto_t === r.target_t && x.atteso_t === r.atteso_t && x.raccolto_t === r.raccolto_t && x.scarto_t === r.scarto_t
      && x.pct_dell_atteso === cento(r.pct_atteso) && x.pct_del_contratto === (tv.target ? cento((tv.raccolto / tv.target) * 100) : null),
      `${J(x)} contro ${J(r)} ${J(tv)}`);
  }
  if (!regione) {
    const f = q.fuori_contratto;
    verifica(`${nome}: fuori dalle regioni del contratto`, f && f.raccolto_t > 0 ? J(dati.fuori_dalle_regioni_del_contratto) === J(f) : !dati.fuori_dalle_regioni_del_contratto, `${J(dati.fuori_dalle_regioni_del_contratto)} contro ${J(f)}`);
  }
  const vd = (q.variazioni || []).map(v => [v.mese, v.regione, v.t]);
  const vs = ((dati.variazioni_del_consorzio || {}).in_vigore || []).map(v => [v.mese, v.regione, v.t]);
  verifica(`${nome}: le variazioni in vigore`, J(vs) === J(vd), `${J(vs)} contro ${J(vd)}`);
  verifica(`${nome}: gli avvisi del target`, J(dati.avvisi || []) === J(d.avvisi_target || []), `${J(dati.avvisi)} contro ${J(d.avvisi_target)}`);
}

/**
 * La regola condivisa, ai numeri pieni: contrattoDellaRete e' getDashboardRaccolta
 * con un anno. Dal 14/10/2026 fanno lo stesso conto (contrattoReteDegliAnni): il
 * confronto resta, sulla funzione vera, e dice che nessuno dei due ci mette del
 * suo dopo.
 */
async function stessaRegola(nome, d, anno, oggi) {
  if (!contrattoRete) { verifica(`${nome}: c'e' contrattoDellaRete (base44/shared/contrattoRete.ts)`, false); return; }
  let commesse = null;
  try { commesse = await fetchAll(sdk.asServiceRole.entities.CommessaEcotyre); } catch (_e) { commesse = null; }
  const rete = await fetchAll(sdk.asServiceRole.entities.PrimariaRete, { stato: 'terminato' });
  const c = contrattoRete.contrattoDellaRete({ commesse, anno, rete, oggi });
  const kd = d.kpi;
  const kc = c.kpi;
  verifica(`${nome}: kpi della rete identici, non vicini`, J([kc.raccolto_rete_anno, kc.target, kc.raggiungimento_pct, kc.atteso, kc.target_ripiego, kc.target_da_confermare])
    === J([kd.raccolto_rete_anno, kd.target, kd.raggiungimento_pct, kd.atteso, kd.target_ripiego, kd.target_da_confermare]), `${J(kc)} contro ${J(kd)}`);
  verifica(`${nome}: le regioni identiche (target_vs_raccolto)`, J(c.target_vs_raccolto) === J(d.target_vs_raccolto), `${J(c.target_vs_raccolto)} contro ${J(d.target_vs_raccolto)}`);
  verifica(`${nome}: gli avvisi identici`, J(c.avvisi_target) === J(d.avvisi_target), `${J(c.avvisi_target)} contro ${J(d.avvisi_target)}`);
  const senza = (r) => { const { raccoglitori, ...resto } = r || {}; void raccoglitori; return resto; };
  verifica(`${nome}: il quadro della rete identico (senza la classifica dei raccoglitori)`, J(senza(c.rete)) === J(senza(d.quadro && d.quadro.rete)),
    Object.keys(senza(c.rete)).filter(x => J(senza(c.rete)[x]) !== J(senza(d.quadro.rete)[x])).join(', '));
}

// ─── 1. SU ARCHIVI COSTRUITI ───
console.log('1. SU ARCHIVI COSTRUITI');
verifica('c\'e\' lo strumento del contratto (contratto_ecotyre)', !!strumento('contratto_ecotyre'), STRUMENTI.map(s => s.nome).join(', '));
// Una regola sola (14/10/2026): la dashboard e EcoTyna chiamano lo stesso conto,
// e la dashboard non ha piu' una copia sua delle regole del contratto.
{
  const togli = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  const gdr = togli(sorgente('base44/functions/getDashboardRaccolta/entry.ts'));
  const cr = togli(sorgente('base44/shared/contrattoRete.ts'));
  const unAnno = cr.slice(cr.indexOf('export function contrattoDellaRete('));
  verifica('la dashboard e EcoTyna fanno lo stesso conto: contrattoReteDegliAnni', /contrattoReteDegliAnni\(\{ commesse: commesseLette, anni, rete, reteAnno, oggi \}\)/.test(gdr)
    && cr.includes('export function contrattoDellaRete(') && /contrattoReteDegliAnni\(\{ commesse, anni: \[a\], rete: tutte, oggi \}\)/.test(unAnno),
  (gdr.match(/.*contrattoRete.*/g) || []).join('\n'));
  verifica('e la dashboard non ha piu\' le regole del contratto sue', !/\b(targetAnnuoDellAnno|regioniDellAnno|attesoAllaData|attesoDellaRegione|giornoDeiDati|commessaDellAnno)\b/.test(gdr),
    (gdr.match(/.*\b(targetAnnuoDellAnno|regioniDellAnno|attesoAllaData|attesoDellaRegione|giornoDeiDati|commessaDellAnno)\b.*/g) || []).join('\n'));
}
const PROFILO = [851.29, 915.48, 868.47, 932.55, 1053.85, 1100, 1100, 550, 1050, 1100, 1100, 950];
const contratto = (extra = {}) => ({
  id: 'c26', anno: 2026, target_annuo_t: 11550, created_date: '2026-01-05T10:00:00', updated_date: '2026-09-14T17:35:58',
  regioni_json: J([{ regione: 'Campania', target_t: 4400 }, { regione: 'Puglia', target_t: 2500 }, { regione: 'Sicilia', target_t: 4650 }]),
  target_mensile_iniziale_json: J([800, 750, 800, 950, 1100, 1100, 1050, 500, 1000, 1100, 1100, 950]),
  target_mensile_json: J(PROFILO),
  budget_rete_json: J([720, 790, 920, 930, 900, 960, 970, 420, 1030, 1120, 1150, 1190]),
  target_prezzo_regioni_json: J([{ regione: 'Campania', target_t: 300, prezzo: 95 }]),
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
// Il foglio di inizio anno importato e salvato dopo la variazione: la riscrive.
const CAMPI = ['target_annuo_t', 'regioni_json', 'target_mensile_json', 'destinazioni_json'];
const RISCRITTO = { ...NUOVO, ...Object.fromEntries(CAMPI.map(k => [k, VERO[k]])), updated_date: '2026-10-20T09:00:00',
  storico_json: J([...JSON.parse(NUOVO.storico_json), { il: '2026-10-20T09:00:00.000Z', da: 'Antonio Castellano', nota: 'importato da contratto-ecotyre.xlsx', prima: Object.fromEntries(CAMPI.map(k => [k, NUOVO[k]])) }]) };

let n = 0;
const ritiro = (prov, kg, giorno, extra = {}) => {
  const id = 'p' + String(++n).padStart(4, '0');
  return { id, id_ordine: 'ET' + n, numero_fir: 'FIR' + n, stato: 'terminato', classe: 'P', prodotto: '.class1', provincia: prov, regione: '', trasportatore: 'SMOCO S.R.L.', destinazione: 'IRIGOM SRL', tipo_destinazione: 'imp', partner_operativo: 'SMOCO Srl',
    peso_effettivo: kg, ordine_immesso_il: giorno ? giorno + 'T07:00:00Z' : '', trasporto_iniziato_il: giorno ? giorno + 'T08:00:00Z' : '', trasporto_finito_il: giorno ? giorno + 'T10:00:00Z' : '', created_date: `2026-10-0${1 + (n % 9)}T10:00:00`, ...extra };
};
const RETE = [];
const MESI_GIORNI = ['01-15', '02-14', '03-16', '04-15', '05-14', '06-15', '07-15', '08-14', '09-15'];
for (const [i, g] of MESI_GIORNI.entries()) {
  RETE.push(ritiro('NA', 300000 + i * 1237, `2026-${g}`, { trasportatore: 'ALFA SRL' }));
  RETE.push(ritiro('SA', 120000 + i * 991, `2026-${g}`, { trasportatore: 'ALFA SRL' }));
  RETE.push(ritiro('BA', 140000 + i * 517, `2026-${g}`));
  RETE.push(ritiro('CT', 330000 + i * 733, `2026-${g}`, { trasportatore: 'BETA SRL' }));
}
RETE.push(ritiro('TA', 61234, '2026-10-06'));
// il campo regione scritto vince sulla provincia, come nella dashboard
RETE.push(ritiro('FG', 20001, '2026-10-07', { regione: 'Puglia' }));
RETE.push(ritiro('CH', 15500, '2026-09-20', { trasportatore: 'ALFA SRL' })); // Abruzzo: fuori dalle regioni del contratto
RETE.push(ritiro('NA', 99000, '2025-12-30', { trasportatore: 'ALFA SRL' })); // l'anno prima
RETE.push(ritiro('BA', 4000, '', {})); // senza fine trasporto: fuori da ogni conto
RETE.push(ritiro('BA', 3620, '2026-10-05', { stato: 'eseguito' })); // nel limbo: riserva, non raccolto
const TARGET_RACC = [
  { id: 't1', anno: 2026, raccoglitore: 'SMOCO S.r.l.', regione: 'Puglia', impianto: 'IRIGOM SRL', target_tonnellate: 2600 },
  { id: 't2', anno: 2026, raccoglitore: 'ALFA SRL', regione: 'Campania', target_tonnellate: 4400 },
  { id: 't3', anno: 2026, raccoglitore: 'BETA SRL', regione: 'Sicilia', target_tonnellate: 4650 },
];
const ORA = '2026-10-14T08:00:00Z';
const archivi = (commessa, extra = {}) => ({ PrimariaRete: RETE, CommessaEcotyre: commessa ? [commessa] : [], TargetRaccoglitore: TARGET_RACC, TargetMensile: [], ...extra });

if (strumento('contratto_ecotyre')) {
  for (const [nome, commessa] of [['prima della variazione', VERO], ['dopo la variazione', NUOVO], ['con la variazione superata', RISCRITTO]]) {
    prepara(archivi(commessa));
    const d = await laDashboard(ORA, 2026);
    const t = await lo('contratto_ecotyre', ORA, { anno: 2026 });
    stessiNumeri(`costruito, ${nome}`, t && t.dati, d);
    await conOra(ORA, () => stessaRegola(`costruito, ${nome}`, d, 2026, '2026-10-14'));
  }
  prepara(archivi(NUOVO));
  const dopo = (await lo('contratto_ecotyre', ORA, { anno: 2026 })).dati;
  verifica('dopo: 11.650 t, la Puglia 2.600 di cui +100 di variazioni, le altre regioni senza', dopo.target_annuo_contratto_t === 11650 && dopo.fonte_target === 'contratto'
    && dopo.regioni.find(r => r.regione === 'Puglia').contratto_t === 2600 && dopo.regioni.find(r => r.regione === 'Puglia').di_cui_variazioni_del_consorzio_t === 100
    && dopo.regioni.filter(r => r.regione !== 'Puglia').every(r => !('di_cui_variazioni_del_consorzio_t' in r)), J(dopo.regioni));
  const vc = dopo.variazioni_del_consorzio || {};
  verifica('dopo: la variazione a parole, con quanto sarebbe senza (testoVariazioni)', /ottobre, Puglia \+100,00 t \(assegnazione del consorzio di ottobre, comunicata il 14\/10\/2026\)/.test(vc.a_parole || '')
    && /11\.650,00 t: senza, sarebbe 11\.550,00 t/.test(vc.a_parole || '') && J(vc.in_vigore) === J([{ mese: 'Ottobre', regione: 'Puglia', t: 100, destinazione: 'IRIGOM', motivo: 'assegnazione del consorzio di ottobre', comunicata_il: '2026-10-14', nel_target_mensile_rivisto: true }]), J(vc));
  verifica('nessun nome di chi l\'ha registrata, nessun prezzo', !/Antonio/.test(J(dopo)) && !/prezzo/.test(J(dopo)), J(dopo).match(/.{0,40}(Antonio|prezzo).{0,40}/));
  prepara(archivi(VERO));
  const prima = (await lo('contratto_ecotyre', ORA, { anno: 2026 })).dati;
  verifica('prima: 11.550 t e nessuna variazione', prima.target_annuo_contratto_t === 11550 && !prima.variazioni_del_consorzio, J([prima.target_annuo_contratto_t, prima.variazioni_del_consorzio]));
  prepara(archivi(RISCRITTO));
  const superata = (await lo('contratto_ecotyre', ORA, { anno: 2026 })).dati;
  const vs = superata.variazioni_del_consorzio || {};
  verifica('superata: niente in vigore, la superata a parte e mai detta in vigore', superata.target_annuo_contratto_t === 11550 && (vs.in_vigore || []).length === 0 && (vs.superate || []).length === 1
    && !vs.a_parole && /non e' piu' nel contratto/.test(vs.superate_a_parole || ''), J(vs));

  console.log('   la riserva degli «eseguito» e le date');
  verifica('il ritiro nel limbo e\' detto a parte e non e\' nel raccolto', dopo.riserva_eseguiti && dopo.riserva_eseguiti.tonnellate === 3.62, J(dopo.riserva_eseguiti));
  verifica('e il terminato senza fine trasporto e\' fra le date da sistemare', dopo.date_obbligatorie_da_sistemare && dopo.date_obbligatorie_da_sistemare.senza_fine_trasporto
    && dopo.date_obbligatorie_da_sistemare.senza_fine_trasporto.formulari === 1 && dopo.terminati_senza_fine_trasporto_esclusi === 1, J([dopo.date_obbligatorie_da_sistemare, dopo.terminati_senza_fine_trasporto_esclusi]));

  console.log('   una regione, un mese');
  prepara(archivi(NUOVO));
  const d = await laDashboard(ORA, 2026);
  const puglia = (await lo('contratto_ecotyre', ORA, { anno: 2026, regione: 'puglia ' })).dati;
  stessiNumeri('la sola Puglia', puglia, d, { regione: 'Puglia' });
  verifica('la regione chiesta resta sola, i totali sono del contratto intero', puglia.regioni.length === 1 && puglia.regioni[0].regione === 'Puglia' && puglia.target_annuo_contratto_t === 11650 && !puglia.avviso_regione);
  const abruzzo = (await lo('contratto_ecotyre', ORA, { anno: 2026, regione: 'Abruzzo' })).dati;
  verifica('una regione fuori dal contratto: niente contratto ne\' atteso, il raccolto della riga «Fuori»', abruzzo.regioni.length === 0 && /Abruzzo non e' fra le regioni del contratto 2026: non ha un contratto ne' un atteso/.test(abruzzo.avviso_regione || '') && /15,50 t/.test(abruzzo.avviso_regione), abruzzo.avviso_regione);
  const molise = (await lo('contratto_ecotyre', ORA, { anno: 2026, regione: 'Molise' })).dati;
  verifica('una regione che non c\'e\': lo dice, con le regioni del contratto', molise.regioni.length === 0 && /"Molise" non e' fra le regioni del contratto 2026 \(Campania, Puglia, Sicilia\)/.test(molise.avviso_regione || ''), molise.avviso_regione);
  const ottobre = (await lo('contratto_ecotyre', ORA, { anno: 2026, mese: 'ottobre' })).dati;
  const mo = (ottobre.mesi_chiesti || [])[0] || {};
  const qm = d.quadro.rete.mesi[9];
  verifica('ottobre: il target mensile rivisto 1.200 (1.100 + 100), quello del profilo e l\'atteso come la dashboard, la variazione del mese',
    mo.mese === 'Ottobre' && mo.target_mensile_rivisto_t === 1200 && mo.target_mensile_iniziale_t === 1100 && mo.target_del_profilo_t === qm.target_t && mo.atteso_al_giorno_dei_dati_t === qm.atteso_t
    && mo.raccolto_t === qm.raccolto_t && mo.budget_smoco_t === 1120 && (mo.variazioni_del_consorzio || []).length === 1, J([mo, qm]));
  const novembre = (await lo('contratto_ecotyre', ORA, { anno: 2026, mese: 'novembre' })).dati.mesi_chiesti[0];
  verifica('novembre: il mese che i dati non coprono ha il raccolto null, non zero', novembre.raccolto_t === null && novembre.target_mensile_rivisto_t === 1100, J(novembre));

  console.log('   senza contratto, e col contratto che non si legge');
  prepara(archivi(null));
  const d27 = await laDashboard('2027-02-11T08:00:00Z', 2027);
  const t27 = (await lo('contratto_ecotyre', '2027-02-11T08:00:00Z', { anno: 2027 })).dati;
  stessiNumeri('il 2027 senza contratto', t27, d27);
  verifica('il 2027: target null col perche\', niente atteso, mai zero', t27.target_annuo_contratto_t === null && /non è inserito in Target & Status/.test(t27.target_perche || '') && /Non e' zero/.test(t27.target_perche) && t27.atteso_alla_data === null && !!t27.atteso_perche, J([t27.target_perche, t27.atteso_perche]));
  prepara(archivi(NUOVO), ['CommessaEcotyre']);
  const dg = await laDashboard(ORA, 2026);
  const tg = (await lo('contratto_ecotyre', ORA, { anno: 2026 })).dati;
  stessiNumeri('il contratto che non si legge', tg, dg);
  verifica('non si legge: ripiego dichiarato, mai «manca»', tg.fonte_target === 'ripiego' && /non si è potuto leggere/.test((tg.avvisi || []).join(' ')) && !!tg.target_di_ripiego, J([tg.fonte_target, tg.avvisi]));
}

console.log('   target_raccoglitori: la somma dei raccoglitori col suo nome, e il contratto accanto');
{
  prepara(archivi(VERO));
  const r = (await lo('target_raccoglitori', ORA, { anno: 2026 })).dati;
  verifica('il totale non si chiama piu\' target_totale_t: e\' somma_target_raccoglitori_t', !('target_totale_t' in r) && r.somma_target_raccoglitori_t === 11650, J(Object.keys(r)));
  const blocco = r.contratto_ecotyre || {};
  verifica('accanto, il contratto letto davvero: 11.550 t, e la differenza +100', blocco.target_annuo_contratto_t === 11550 && r.differenza_somma_raccoglitori_meno_contratto_t === 100, J([blocco.target_annuo_contratto_t, r.differenza_somma_raccoglitori_meno_contratto_t]));
  verifica('regione per regione: la Puglia dei raccoglitori ha 100 t piu\' del contratto, le altre niente', J(r.regioni_raccoglitori_contro_contratto) === J([
    { regione: 'Campania', somma_target_raccoglitori_t: 4400, contratto_t: 4400, differenza_t: 0 },
    { regione: 'Puglia', somma_target_raccoglitori_t: 2600, contratto_t: 2500, differenza_t: 100 },
    { regione: 'Sicilia', somma_target_raccoglitori_t: 4650, contratto_t: 4650, differenza_t: 0 }]), J(r.regioni_raccoglitori_contro_contratto));
  verifica('ogni raccoglitore ha la sua regione', J(r.raccoglitori.map(x => [x.raccoglitore, x.regione]).sort()) === J([['ALFA SRL', 'Campania'], ['BETA SRL', 'Sicilia'], ['SMOCO S.r.l.', 'Puglia']]), J(r.raccoglitori));
  verifica('e la nota dice i due livelli', /NON e' il target del contratto/.test(r.nota_livelli || '') && /contratto_ecotyre\.target_annuo_contratto_t/.test(r.nota_livelli || ''), r.nota_livelli);
  const alfa = r.raccoglitori.find(x => x.raccoglitore === 'ALFA SRL') || {};
  verifica('il raccolto fuori dalle regioni del suo target si dice (ALFA in Abruzzo)', alfa.fatto_fuori_dalle_regioni_del_suo_target_t === 15.5, J(alfa));
  prepara(archivi(NUOVO));
  const d = await laDashboard(ORA, 2026);
  const r2 = (await lo('target_raccoglitori', ORA, { anno: 2026 })).dati;
  verifica('dopo la variazione: differenza zero', r2.contratto_ecotyre && r2.contratto_ecotyre.target_annuo_contratto_t === 11650 && r2.differenza_somma_raccoglitori_meno_contratto_t === 0, J([r2.contratto_ecotyre && r2.contratto_ecotyre.target_annuo_contratto_t, r2.differenza_somma_raccoglitori_meno_contratto_t]));
  if (r2.contratto_ecotyre) stessiNumeri('il contratto dentro target_raccoglitori', r2.contratto_ecotyre, d);
  // un raccoglitore con target in piu' regioni, il fatto di ognuna
  prepara(archivi(NUOVO, { TargetRaccoglitore: [...TARGET_RACC, { id: 't4', anno: 2026, raccoglitore: 'SMOCO S.r.l.', regione: 'Calabria', target_tonnellate: 700 }] }));
  const r3 = (await lo('target_raccoglitori', ORA, { anno: 2026 })).dati;
  const smoco = r3.raccoglitori.find(x => x.raccoglitore === 'SMOCO S.r.l.') || {};
  const fattoPuglia = RETE.filter(x => x.stato === 'terminato' && x.trasportatore === 'SMOCO S.R.L.' && /^2026/.test(x.trasporto_finito_il)).reduce((s, x) => s + x.peso_effettivo, 0) / 1000;
  verifica('SMOCO in Puglia e in Calabria: un target per regione, col fatto di ognuna', smoco.regione === 'Puglia, Calabria' && J(smoco.per_regione) === J([{ regione: 'Puglia', target_t: 2600, fatto_t: tonn(fattoPuglia) }, { regione: 'Calabria', target_t: 700, fatto_t: 0 }]) && smoco.target_t === 3300, J(smoco));
  // la regione chiesta: prima non era un parametro, e la risposta diceva «non filtrato per area geografica»
  const r5 = (await lo('target_raccoglitori', ORA, { anno: 2026, regione: 'Puglia' })).dati;
  const smoco5 = (r5.raccoglitori || []).find(x => x.raccoglitore === 'SMOCO S.r.l.') || {};
  verifica('target_raccoglitori con la Puglia: i soli raccoglitori con un target li\', col target e il fatto della Puglia; le somme della rete restano',
    (r5.raccoglitori || []).length === 1 && J(smoco5.nella_regione_chiesta) === J({ regione: 'Puglia', target_t: 2600, fatto_t: tonn(fattoPuglia), residuo_t: cento(2600 - tonn(fattoPuglia)), percentuale: Math.round((tonn(fattoPuglia) / 2600) * 1000) / 10 }) && r5.somma_target_raccoglitori_della_regione_t === 2600
    && r5.somma_target_raccoglitori_t === 12350 && r5.contratto_ecotyre.regioni.length === 1 && r5.contratto_ecotyre.regioni[0].regione === 'Puglia'
    && J(r5.regioni_raccoglitori_contro_contratto) === J([{ regione: 'Puglia', somma_target_raccoglitori_t: 2600, contratto_t: 2600, differenza_t: 0 }]), J([r5.raccoglitori, r5.somma_target_raccoglitori_della_regione_t, r5.regioni_raccoglitori_contro_contratto]));
  const r6 = (await lo('target_raccoglitori', ORA, { anno: 2026, regione: 'Basilicata' })).dati;
  verifica('una regione senza raccoglitori: l\'elenco vuoto lo dice, e non e\' zero raccolto', (r6.raccoglitori || []).length === 0 && /Nessun raccoglitore ha un target in "Basilicata"/.test(r6.nota_regione || ''), r6.nota_regione);
  const sceltaRacc = strumentiDalPiano({ periodo: { anno: 2026 }, canali: ['RETE'], strumenti: [{ nome: 'target_raccoglitori', parametri: { anno: 2026, regione: 'Puglia' } }] }, catalogoStrumenti(), '2026-10-14', 'Chi e\' sotto target in Puglia?');
  verifica('e la regione non finisce piu\' fra i filtri ignorati', sceltaRacc.length === 1 && sceltaRacc[0].parametri.regione === 'Puglia' && (sceltaRacc[0].ignorati || []).length === 0, J(sceltaRacc));
  prepara(archivi(NUOVO), ['CommessaEcotyre']);
  const r4 = (await lo('target_raccoglitori', ORA, { anno: 2026 })).dati;
  verifica('il contratto che non si legge: avviso, e la somma non lo sostituisce', r4.contratto_ecotyre && r4.contratto_ecotyre.fonte_target === 'ripiego' && /non si è potuto leggere/.test(J(r4.contratto_ecotyre.avvisi)), J(r4.contratto_ecotyre && r4.contratto_ecotyre.avvisi));

  // SOLO CONTRO IL CONTRATTO VERO (revisione del 14/10/2026). Con la variazione
  // registrata e i contratti che non si leggono, i raccoglitori (Puglia 2.600) si
  // confrontavano col ripiego (2.500): +100 e la nota «una variazione non ancora
  // registrata». La scheda e il cruscotto (vociContrattoRaccoglitori) non
  // confrontano niente contro il ripiego, e cosi' ora EcoTyna.
  console.log('   target_raccoglitori: le differenze solo contro il contratto vero');
  const differenze = (x) => J([x.differenza_somma_raccoglitori_meno_contratto_t, x.regioni_raccoglitori_contro_contratto, x.confronto_col_contratto_perche]);
  verifica('contratti non letti: nessuna differenza col ripiego, e il perche\'', !('differenza_somma_raccoglitori_meno_contratto_t' in r4) && !r4.regioni_raccoglitori_contro_contratto
    && /non e' del contratto: e' il ripiego scritto nel gestionale, perche' i contratti non si sono potuti leggere/.test(r4.confronto_col_contratto_perche || '')
    && /riparto per regione accanto non e' del contratto/.test(r4.confronto_col_contratto_perche) && /non vuol dire una variazione da registrare/.test(r4.confronto_col_contratto_perche), differenze(r4));
  verifica('e la nota dei livelli rimanda al perche\'', /confronto_col_contratto_perche dice perche'/.test(r4.nota_livelli || ''), r4.nota_livelli);
  const SENZA_RIPARTO = { ...NUOVO, regioni_json: '[]' };
  prepara(archivi(SENZA_RIPARTO));
  const rr = (await lo('target_raccoglitori', ORA, { anno: 2026 })).dati;
  verifica('contratto senza riparto: il totale si confronta (11.650 col contratto), le regioni no, e il perche\'', rr.differenza_somma_raccoglitori_meno_contratto_t === 0 && !rr.regioni_raccoglitori_contro_contratto
    && /Il riparto per regione accanto non e' del contratto: e' il ripiego/.test(rr.confronto_col_contratto_perche || '') && !/target annuo accanto/.test(rr.confronto_col_contratto_perche), differenze(rr));
  const tr = (await lo('contratto_ecotyre', ORA, { anno: 2026 })).dati;
  verifica('e contratto_ecotyre dice che il riparto e\' di ripiego', tr.fonte_target === 'contratto' && /Il riparto per regione non e' del contratto: e' il ripiego/.test(tr.regioni_di_ripiego || ''), J([tr.fonte_target, tr.regioni_di_ripiego]));
  prepara(archivi(VERO));
  verifica('col contratto vero col suo riparto: niente perche\', regioni_di_ripiego assente', !('confronto_col_contratto_perche' in (await lo('target_raccoglitori', ORA, { anno: 2026 })).dati) && !('regioni_di_ripiego' in (await lo('contratto_ecotyre', ORA, { anno: 2026 })).dati));
  prepara(archivi({ ...NUOVO, target_annuo_t: 0 }));
  const rt0 = (await lo('target_raccoglitori', ORA, { anno: 2026 })).dati;
  verifica('contratto col riparto ma senza target annuo: le regioni si confrontano, il totale (ripiego) no', !('differenza_somma_raccoglitori_meno_contratto_t' in rt0) && (rt0.regioni_raccoglitori_contro_contratto || []).length === 3
    && /Il target annuo accanto \(11\.550,00 t\) non e' del contratto: e' il ripiego scritto nel gestionale\./.test(rt0.confronto_col_contratto_perche || ''), differenze(rt0));
  prepara(archivi(NUOVO, { TargetRaccoglitore: [] }));
  const rv = (await lo('target_raccoglitori', ORA, { anno: 2026 })).dati;
  verifica('senza target dei raccoglitori: niente confronto (non e\' -11.650 da registrare), e il perche\'', !('differenza_somma_raccoglitori_meno_contratto_t' in rv) && !rv.regioni_raccoglitori_contro_contratto
    && /non c'e' nessun target dei raccoglitori/.test(rv.confronto_col_contratto_perche || ''), differenze(rv));
  prepara(archivi(null, { TargetRaccoglitore: [...TARGET_RACC, { id: 't27', anno: 2027, raccoglitore: 'ALFA SRL', regione: 'Campania', target_tonnellate: 4000 }] }));
  const r27 = (await lo('target_raccoglitori', '2027-02-11T08:00:00Z', { anno: 2027 })).dati;
  verifica('il 2027 senza contratto: niente confronto, e il perche\'', !('differenza_somma_raccoglitori_meno_contratto_t' in r27) && /non c'e' il target del contratto Ecotyre/.test(r27.confronto_col_contratto_perche || ''), differenze(r27));

  // LA REGIONE CHIESTA PER TUTTI (revisione del 14/10/2026): anche chi ha il
  // target in una regione sola porta il fatto di quella regione, come la riga
  // raccoglitore | regione dell'Andamento (la regione della provincia, come
  // raccoltoPerRaccoglitore), e non quello di tutte le regioni.
  console.log('   target_raccoglitori con la regione: i numeri della regione per tutti, come l\'Andamento');
  const RETE_X = [...RETE, ritiro('NA', 7000, '2026-10-02', { trasportatore: 'ALFA SRL', regione: 'Puglia' })];
  prepara(archivi(NUOVO, { PrimariaRete: RETE_X }));
  const rc = (await lo('target_raccoglitori', ORA, { anno: 2026, regione: 'Campania' })).dati;
  const alfaC = (rc.raccoglitori || []).find(x => x.raccoglitore === 'ALFA SRL') || {};
  const andamento = righeAndamento({ annui: TARGET_RACC, raccolto: raccoltoPerRaccoglitore(RETE_X, 2026) });
  const rigaAlfa = andamento.find(x => x.raccoglitore === 'ALFA SRL' && x.regione === 'Campania') || {};
  verifica('ALFA in Campania: il fatto della Campania (senza i 15,50 t in Abruzzo) e\' quello dell\'Andamento, con residuo e percentuale',
    !!alfaC.nella_regione_chiesta && alfaC.nella_regione_chiesta.fatto_t === tonn(rigaAlfa.raccoltoTotale) && alfaC.fatto_t === tonn(rigaAlfa.raccoltoTotale + 15.5)
    && alfaC.nella_regione_chiesta.target_t === 4400 && alfaC.nella_regione_chiesta.percentuale === Math.round((tonn(rigaAlfa.raccoltoTotale) / 4400) * 1000) / 10
    && alfaC.nella_regione_chiesta.residuo_t === cento(4400 - tonn(rigaAlfa.raccoltoTotale)), J([alfaC, rigaAlfa.raccoltoTotale]));
  verifica('il ritiro di NA col campo regione «Puglia» e\' della Campania, come nell\'Andamento', rigaAlfa.raccoltoTotale > 0 && tonn(rigaAlfa.raccoltoTotale) === tonn(RETE_X.filter(x => x.trasportatore === 'ALFA SRL' && x.stato === 'terminato' && /^2026/.test(x.trasporto_finito_il) && ['NA', 'SA'].includes(x.provincia)).reduce((s, x) => s + x.peso_effettivo, 0) / 1000), J(rigaAlfa));
  verifica('la nota della regione dice quali numeri sono della regione e quali di tutte', /nella_regione_chiesta/.test(rc.nota_regione || '') && /fatto_t comprende anche il raccolto fuori dalle regioni del suo target/.test(rc.nota_regione), rc.nota_regione);
}

// ─── 2. SULLA COPIA DEI DATI VERI ───
console.log('2. SULLA COPIA DEI DATI VERI');
const CARTELLA = process.env.DATI_VERI || qui('../../dati-veri/');
const copie = existsSync(CARTELLA) ? readdirSync(CARTELLA).filter(x => /^treadrider-dati-veri-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(x)).sort() : [];
let esitoVero = null;
if (!copie.length) {
  console.log(`  Nessuna copia dei dati veri in ${CARTELLA}: parte saltata.`);
} else if (!strumento('contratto_ecotyre')) {
  verifica('dati veri: lo strumento del contratto c\'e\'', false);
} else {
  const copia = copie[copie.length - 1];
  const DATI = JSON.parse(gunzipSync(readFileSync(CARTELLA + copia)).toString('utf8'));
  const ORA_V = DATI.meta.letto_fino_al;
  const DELL_11_10 = copia === 'treadrider-dati-veri-2026-10-11.json.gz';
  console.log(`  Copia: ${copia}, letta il ${ORA_V}`);
  const vero = (DATI.archivi.CommessaEcotyre || []).filter(c => Number(c.anno) === 2026).sort((a, b) => String(b.updated_date).localeCompare(String(a.updated_date)))[0];
  // La modifica dell'utente del 14/10 sui raccoglitori (SMOCO in Puglia 1.850 -> 1.950)
  // e la variazione registrata nel contratto, come in prove/variazioneContratto.mjs.
  const smoco = (r) => /^smoco/i.test(String(r.raccoglitore || '')) && r.regione === 'Puglia' && Number(r.anno) === 2026;
  const annui = (DATI.archivi.TargetRaccoglitore || []).map(r => (smoco(r) ? { ...r, target_tonnellate: Number(r.target_tonnellate) + 100 } : r));
  const variazione = { ...OTTOBRE };
  const esito = A.variazioneDelContratto(vero, variazione);
  verifica('dati veri: la variazione si registra', esito.errori.length === 0, J(esito.errori));
  const nuovo = { ...vero, ...esito.patch, updated_date: '2026-10-14T10:00:00.000000', storico_json: A.storicoConVariazione(vero.storico_json, { il: '2026-10-14T10:00:00.000Z', da: 'Antonio Castellano', voce: esito.voce, prima: esito.prima }) };
  const base = { ...DATI.archivi, TargetRaccoglitore: annui };
  const risultati = {};
  for (const [nome, commessa] of [['prima', vero], ['dopo', nuovo]]) {
    prepara({ ...base, CommessaEcotyre: [commessa] });
    const d = await laDashboard(ORA_V, 2026);
    const t = (await lo('contratto_ecotyre', ORA_V, { anno: 2026 })).dati;
    const r = (await lo('target_raccoglitori', ORA_V, { anno: 2026 })).dati;
    stessiNumeri(`dati veri, ${nome} della variazione`, t, d);
    await conOra(ORA_V, () => stessaRegola(`dati veri, ${nome} della variazione`, d, 2026, String(ORA_V).slice(0, 10)));
    if (r.contratto_ecotyre && 'target_annuo_contratto_t' in r.contratto_ecotyre) stessiNumeri(`dati veri, ${nome}: il contratto dentro target_raccoglitori`, r.contratto_ecotyre, d);
    risultati[nome] = { d, t, r };
  }
  const { prima, dopo } = risultati;
  const regione = (x, nome) => (x.regioni || []).find(r => r.regione === nome) || {};
  verifica('dati veri: il contratto 11.550 -> 11.650 t, la Puglia 2.500 -> 2.600 di cui +100', prima.t.target_annuo_contratto_t === 11550 && dopo.t.target_annuo_contratto_t === 11650
    && regione(prima.t, 'Puglia').contratto_t === 2500 && regione(dopo.t, 'Puglia').contratto_t === 2600 && regione(dopo.t, 'Puglia').di_cui_variazioni_del_consorzio_t === 100, J([regione(prima.t, 'Puglia'), regione(dopo.t, 'Puglia')]));
  verifica('dati veri: le altre regioni hanno lo stesso atteso, lo stesso contratto e lo stesso scarto', ['Campania', 'Basilicata', 'Calabria', 'Sicilia'].every(x => J(regione(prima.t, x)) === J(regione(dopo.t, x))), J(['Campania', 'Sicilia'].map(x => [regione(prima.t, x), regione(dopo.t, x)])));
  verifica('dati veri: la variazione a parole', /senza, sarebbe 11\.550,00 t/.test((dopo.t.variazioni_del_consorzio || {}).a_parole || ''), J(dopo.t.variazioni_del_consorzio));
  if (DELL_11_10) {
    verifica('dati veri: il giorno dei dati della copia e\' l\'08/10/2026', dopo.t.dati_fino_al === '2026-10-08', dopo.t.dati_fino_al);
    // fino al 13/10 la somma dei raccoglitori era 11.650 e il contratto 11.550: e' il caso che si vedeva.
    // Campania (+0,38) e Calabria (-0,38) sono arrotondamenti dei target, come li colora la scheda.
    verifica('dati veri, prima della variazione: la somma dei raccoglitori 11.650 non e\' il contratto 11.550, e la differenza si dice', prima.r.somma_target_raccoglitori_t === 11650 && prima.r.contratto_ecotyre.target_annuo_contratto_t === 11550
      && prima.r.differenza_somma_raccoglitori_meno_contratto_t === 100 && (prima.r.regioni_raccoglitori_contro_contratto || []).filter(x => x.differenza_t !== 0 && !x.solo_arrotondamento).map(x => [x.regione, x.differenza_t]).join() === 'Puglia,100'
      && (prima.r.regioni_raccoglitori_contro_contratto || []).filter(x => x.solo_arrotondamento).map(x => x.regione).join() === 'Campania,Calabria',
      J([prima.r.somma_target_raccoglitori_t, prima.r.differenza_somma_raccoglitori_meno_contratto_t, prima.r.regioni_raccoglitori_contro_contratto]));
    verifica('dati veri: SMOCO ha la sua regione per ogni target (Puglia, Calabria, Basilicata)', (dopo.r.raccoglitori.find(x => /^SMOCO/i.test(x.raccoglitore)) || {}).regione === 'Puglia, Calabria, Basilicata', J(dopo.r.raccoglitori.find(x => /^SMOCO/i.test(x.raccoglitore))));
    // com'e' il sito dal 14/10: raccoglitori 11.650 e contratto 11.650, solo i due arrotondamenti
    verifica('dati veri, dopo la variazione: somma dei raccoglitori 11.650 = contratto 11.650, differenza zero e nessuna regione fuori soglia', dopo.r.somma_target_raccoglitori_t === 11650 && dopo.r.differenza_somma_raccoglitori_meno_contratto_t === 0
      && (dopo.r.regioni_raccoglitori_contro_contratto || []).every(x => x.differenza_t === 0 || x.solo_arrotondamento), J(dopo.r.regioni_raccoglitori_contro_contratto));
  }
  // I NUMERI DEL SITO DI OGGI. Il 14/10 il sito ha i dati fino al 12/10: atteso
  // 8.869,611 t (prima 8.830,901), la Puglia 1.950,16 (prima 1.911,45). Sono le
  // regole del contratto al 12/10; e con un ritiro di 0 kg il 12/10 aggiunto
  // nella prova, lo strumento e la dashboard dicono quegli stessi numeri.
  verifica('il sito al 12/10: atteso 8.830,901 -> 8.869,611 t, Puglia 1.911,45 -> 1.950,16 t (le regole del contratto)',
    tonn(A.attesoAllaData(vero, 2026, '2026-10-12').atteso_t) === 8830.901 && tonn(A.attesoAllaData(nuovo, 2026, '2026-10-12').atteso_t) === 8869.611
    && cento(A.attesoDellaRegione(vero, 2026, '2026-10-12', 'Puglia').atteso_t) === 1911.45 && cento(A.attesoDellaRegione(nuovo, 2026, '2026-10-12', 'Puglia').atteso_t) === 1950.16,
    J([A.attesoAllaData(nuovo, 2026, '2026-10-12').atteso_t, A.attesoDellaRegione(nuovo, 2026, '2026-10-12', 'Puglia').atteso_t]));
  const al12 = { ...base, CommessaEcotyre: [nuovo], PrimariaRete: [...DATI.archivi.PrimariaRete, { ...ritiro('BA', 0, '2026-10-12'), id: 'zzz-prova-12-10' }] };
  prepara(al12);
  const ORA_14 = '2026-10-14T08:00:00Z';
  const d12 = await laDashboard(ORA_14, 2026);
  const t12 = (await lo('contratto_ecotyre', ORA_14, { anno: 2026, regione: 'Puglia' })).dati;
  stessiNumeri('dati veri fino al 12/10, la Puglia', t12, d12, { regione: 'Puglia' });
  verifica('con i dati fino al 12/10 lo strumento dice l\'atteso del sito: 8.869,611 t, e la Puglia 1.950,16 t', t12.dati_fino_al === '2026-10-12' && t12.atteso_alla_data && t12.atteso_alla_data.atteso_t === 8869.611
    && cento(t12.regioni[0].atteso_t) === 1950.16, J([t12.atteso_alla_data, t12.regioni[0]]));

  // L'ANNO CHIUSO (revisione del 14/10/2026): il 2025 chiesto con i dati fino
  // all'08/10/2026 ha l'atteso al 31/12/2025, e dati_fino_al lo dice come le
  // etichette della dashboard (giorno_misura), non l'08/10/2026.
  console.log('   il 2025 chiuso, i contratti che non si leggono, le regioni dei raccoglitori');
  const tutteLeCommesse = [...(DATI.archivi.CommessaEcotyre || []).filter(c => Number(c.anno) !== 2026), nuovo];
  prepara({ ...base, CommessaEcotyre: tutteLeCommesse });
  const d25 = await laDashboard(ORA_V, 2025);
  const t25 = (await lo('contratto_ecotyre', ORA_V, { anno: 2025 })).dati;
  stessiNumeri('dati veri, il 2025 chiuso', t25, d25);
  verifica('dati veri, il 2025 chiuso: dati e atteso al 31/12/2025, non al giorno dei dati dell\'anno dopo', t25.dati_fino_al === '2025-12-31' && d25.quadro.giorno_misura === '2025-12-31'
    && t25.atteso_alla_data && t25.atteso_alla_data.al === '2025-12-31' && /Il 2025 e' chiuso: i suoi dati sono completi e i numeri sono al 31\/12\/2025/.test(t25.anno_chiuso || ''),
  J([t25.dati_fino_al, t25.atteso_alla_data, t25.anno_chiuso, d25.quadro.giorno_misura, d25.quadro.giorno_dati]));
  verifica('dati veri: il 2026 in corso non si dice chiuso', !('anno_chiuso' in dopo.t), dopo.t.anno_chiuso);

  // I contratti che non si leggono, con la variazione registrata: il caso del revisore.
  prepara({ ...base, CommessaEcotyre: [nuovo] }, ['CommessaEcotyre']);
  const rg = (await lo('target_raccoglitori', ORA_V, { anno: 2026 })).dati;
  verifica('dati veri, contratti non letti: nessuna differenza col ripiego (prima Puglia +100), e il perche\'', rg.somma_target_raccoglitori_t === 11650 && rg.contratto_ecotyre.fonte_target === 'ripiego'
    && !('differenza_somma_raccoglitori_meno_contratto_t' in rg) && !rg.regioni_raccoglitori_contro_contratto && /i contratti non si sono potuti leggere/.test(rg.confronto_col_contratto_perche || ''),
  J([rg.differenza_somma_raccoglitori_meno_contratto_t, rg.regioni_raccoglitori_contro_contratto, rg.confronto_col_contratto_perche]));
  prepara({ ...base, CommessaEcotyre: [{ ...nuovo, regioni_json: '[]' }] });
  const rs = (await lo('target_raccoglitori', ORA_V, { anno: 2026 })).dati;
  verifica('dati veri, contratto senza riparto: il totale col contratto (0), le regioni no', rs.differenza_somma_raccoglitori_meno_contratto_t === 0 && !rs.regioni_raccoglitori_contro_contratto
    && /riparto per regione accanto non e' del contratto/.test(rs.confronto_col_contratto_perche || ''), J([rs.differenza_somma_raccoglitori_meno_contratto_t, rs.regioni_raccoglitori_contro_contratto, rs.confronto_col_contratto_perche]));

  // Le regioni dei raccoglitori come l'Andamento di Target & Status: ogni
  // raccoglitore di ogni regione chiesta, contro le righe raccoglitore | regione
  // dell'Andamento (target mensili e annui veri) e contro quelle che la
  // dashboard mostra. Nappi Sud in Campania: 1.528,52 t, non 1.550,60.
  prepara({ ...base, CommessaEcotyre: [nuovo] });
  const dR = await laDashboard(ORA_V, 2026);
  const annui26 = base.TargetRaccoglitore.filter(t => Number(t.anno) === 2026);
  const andVero = righeAndamento({ mensili: (base.TargetMensile || []).filter(t => Number(t.anno) === 2026), annui: annui26, raccolto: raccoltoPerRaccoglitore((base.PrimariaRete || []).filter(r => r.stato === 'terminato'), 2026) });
  const mostrate = [...(dR.quadro.rete.raccoglitori.indietro || []), ...(dR.quadro.rete.raccoglitori.avanti || [])];
  const regioniTarget = [...new Set(annui26.map(t => t.regione).filter(Boolean))];
  let confrontate = 0, sulCruscotto = 0;
  for (const reg of regioniTarget) {
    const rr2 = (await lo('target_raccoglitori', ORA_V, { anno: 2026, regione: reg })).dati;
    const attesi = [...new Set(annui26.filter(t => t.regione === reg).map(t => normalizza(t.raccoglitore)))];
    verifica(`dati veri, ${reg}: l'elenco ha tutti i raccoglitori con un target li', ognuno coi numeri della regione`, (rr2.raccoglitori || []).length === attesi.length && rr2.raccoglitori.every(x => x.nella_regione_chiesta && x.nella_regione_chiesta.regione === reg), J(rr2.raccoglitori));
    for (const x of rr2.raccoglitori || []) {
      const riga = andVero.find(a => a.regione === reg && normalizza(a.raccoglitore) === normalizza(x.raccoglitore));
      confrontate++;
      verifica(`dati veri, ${x.raccoglitore} | ${reg}: il fatto della regione e' quello dell'Andamento`, !!riga && (x.nella_regione_chiesta || {}).fatto_t === tonn(riga.raccoltoTotale), `${J(x.nella_regione_chiesta)} contro ${riga && riga.raccoltoTotale}`);
      const m = mostrate.find(a => a.regione === reg && normalizza(a.raccoglitore) === normalizza(x.raccoglitore));
      if (m) { sulCruscotto++; verifica(`dati veri, ${x.raccoglitore} | ${reg}: e quello della dashboard`, (x.nella_regione_chiesta || {}).fatto_t === m.raccolto_t, `${(x.nella_regione_chiesta || {}).fatto_t} contro ${m.raccolto_t}`); }
    }
    const pct = (rr2.raccoglitori || []).map(x => (x.nella_regione_chiesta || {}).percentuale ?? 999);
    verifica(`dati veri, ${reg}: in ordine di percentuale nella regione`, pct.every((p, i) => !i || pct[i - 1] <= p), J(pct));
  }
  verifica('dati veri: confrontate tutte le righe dei target, e alcune anche con la dashboard', confrontate === new Set(annui26.map(t => `${normalizza(t.raccoglitore)}|${t.regione}`)).size && sulCruscotto > 0, `${confrontate} righe, ${sulCruscotto} sulla dashboard`);
  if (DELL_11_10) {
    const rcV = (await lo('target_raccoglitori', ORA_V, { anno: 2026, regione: 'Campania' })).dati;
    const nappi = (rcV.raccoglitori || []).find(x => /nappi/i.test(x.raccoglitore)) || {};
    verifica('dati veri: Nappi Sud in Campania 1.528,52 t (l\'Andamento), il totale 1.550,60 coi 22,08 t fuori regione', nappi.nella_regione_chiesta && nappi.nella_regione_chiesta.fatto_t === 1528.52 && nappi.fatto_t === 1550.6 && nappi.fatto_fuori_dalle_regioni_del_suo_target_t === 22.08, J(nappi));
  }
  esitoVero = { prima, dopo, t12 };
}

// ─── 3. IL PIANIFICATORE E LE ISTRUZIONI ───
console.log('3. IL PIANIFICATORE E LE ISTRUZIONI');
const DOMANDA = "Qual è oggi il target annuo 2026 del contratto Ecotyre sulla rete, e com'è messa la Puglia rispetto all'atteso?";
const CHIP = "Come stiamo con il contratto in Campania rispetto all'atteso a oggi?";
const testoPiano = istruzioniPiano(catalogoStrumenti(), DOMANDA, '2026-10-14');
const rigaDi = (nome) => testoPiano.split('\n').find(r => r.startsWith(`- ${nome}: `)) || '';
const posizione = (nome) => testoPiano.split('\n').findIndex(r => r.startsWith(`- ${nome}: `));
const rc = rigaDi('contratto_ecotyre');
verifica('il pianificatore vede contratto_ecotyre, prima di target_raccoglitori', !!rc && posizione('contratto_ecotyre') < posizione('target_raccoglitori'), `${posizione('contratto_ecotyre')} / ${posizione('target_raccoglitori')}`);
verifica('con le parole delle domande: contratto, target annuo, atteso, regione, come stiamo', ['CONTRATTO Ecotyre', 'target annuo del contratto', 'atteso alla data', 'per ogni regione', 'su una regione rispetto al contratto', '«come stiamo»'].every(x => rc.includes(x)), rc);
const rt = rigaDi('target_raccoglitori');
verifica('target_raccoglitori dice che la somma non e\' il contratto, e manda a contratto_ecotyre', /La somma dei loro target NON e' il contratto Ecotyre/.test(rt) && /usa contratto_ecotyre/.test(rt) && /con la sua regione/.test(rt), rt);
verifica('anche il riepilogo generale manda al contratto per i numeri precisi', /c'e' contratto_ecotyre/.test(rigaDi('panoramica_commessa')), rigaDi('panoramica_commessa'));
const scelta = strumentiDalPiano({ periodo: { anno: 2026, mese: 'Ottobre' }, canali: ['RETE'], strumenti: [{ nome: 'contratto_ecotyre', parametri: { anno: 2026, regione: 'Puglia', canale: 'RETE' } }] }, catalogoStrumenti(), '2026-10-14', DOMANDA);
verifica('la domanda dell\'utente: lo strumento del contratto con la Puglia, e nessun filtro ignorato', scelta.length === 1 && scelta[0].nome === 'contratto_ecotyre' && scelta[0].parametri.regione === 'Puglia' && scelta[0].parametri.anno === 2026 && (scelta[0].ignorati || []).length === 0, J(scelta));
const sceltaChip = strumentiDalPiano({ periodo: { anno: 2026, mese: 'Ottobre' }, canali: [], strumenti: [{ nome: 'contratto_ecotyre', parametri: { regione: 'Campania' } }] }, catalogoStrumenti(), '2026-10-14', CHIP);
verifica('il chip «a oggi»: la Campania, l\'anno e non il mese di ottobre', sceltaChip.length === 1 && sceltaChip[0].parametri.regione === 'Campania' && sceltaChip[0].parametri.anno === 2026 && !sceltaChip[0].parametri.mese && (sceltaChip[0].ignorati || []).length === 0, J(sceltaChip));
if (strumento('contratto_ecotyre')) {
  // La risposta allo strumento come la legge il modello: intera, senza tagli.
  const ora = esitoVero ? '2026-10-14T08:00:00Z' : ORA;
  if (!esitoVero) prepara(archivi(NUOVO));
  const esito = await conOra(ora, async () => ({ strumento: 'contratto_ecotyre', parametri: scelta[0].parametri, ...(await strumento('contratto_ecotyre').esegui(sdk, scelta[0].parametri, null)) }));
  const blocco = testoDati([esito]);
  verifica('il blocco dei dati arriva intero al modello (niente tagli)', !/ELENCO TAGLIATO|troncato/.test(blocco) && blocco.length < 24000, `${blocco.length} caratteri`);
  verifica('e porta il contratto, l\'atteso della Puglia e la variazione', /"target_annuo_contratto_t":11650/.test(blocco) && /"regione":"Puglia","contratto_t":2600,"di_cui_variazioni_del_consorzio_t":100,"atteso_t":/.test(blocco) && /senza, sarebbe 11\.550,00 t/.test(blocco), blocco.slice(0, 600));
}
const istruzioni = sorgente('base44/functions/chiediAssistente/entry.ts');
verifica('la regola 3-septdecies nelle istruzioni della risposta', /'3-septdecies\. Il target annuo del contratto Ecotyre, l\\'atteso alla data, lo scarto e le regioni li dice contratto_ecotyre/.test(istruzioni)
  && /somma_target_raccoglitori_t e\\' la somma dei target dei singoli raccoglitori e NON e\\' il contratto/.test(istruzioni) && /variazioni_del_consorzio/.test(istruzioni), (istruzioni.match(/.{0,80}septdecies.{0,200}/) || [''])[0]);
// Revisione del 14/10/2026: il giorno dell'atteso e' atteso_alla_data.al (per un
// anno chiuso il 31/12, non dati_fino_al dell'anno dopo), con una regione
// valgono i numeri della regione, e contro il ripiego non si parla di variazioni.
const regola = istruzioni.split('\n').find(r => r.includes("'3-septdecies.")) || '';
verifica('la regola: l\'atteso col giorno di atteso_alla_data.al, anche per un anno chiuso', /L\\'atteso si dice col suo giorno, atteso_alla_data\.al \(per un anno chiuso il 31\/12, mai l\\'ultima fine trasporto dell\\'anno dopo\)/.test(regola) && !regola.includes('col suo giorno (dati_fino_al)'), regola.slice(0, 900));
verifica('la regola: con una regione i numeri di nella_regione_chiesta, e confronto_col_contratto_perche', /di target_raccoglitori dici i numeri di nella_regione_chiesta/.test(regola) && /confronto_col_contratto_perche, di\\' quello e non parlare di variazioni da registrare/.test(regola), regola.slice(0, 900));
if (strumento('contratto_ecotyre')) {
  prepara(archivi(NUOVO));
  const nota = ((await lo('contratto_ecotyre', ORA, { anno: 2026 })).dati || {}).nota || '';
  verifica('la nota del contratto: l\'atteso al giorno di atteso_alla_data.al, e dati_fino_al il giorno della misura (31/12 per un anno chiuso)', /fino al suo giorno, atteso_alla_data\.al, e l'atteso, la percentuale attesa e lo scarto si dicono con quel giorno/.test(nota)
    && /per un anno chiuso il 31\/12 di quell'anno \(anno_chiuso/.test(nota) && !/fino a dati_fino_al, l'ultima fine trasporto/.test(nota), nota);
}
const codiceStrumenti = sorgente('base44/shared/strumentiAssistente.ts');
verifica('nel codice degli strumenti target_totale_t non c\'e\' piu\'', !/target_totale_t\s*:/.test(codiceStrumenti.replace(/\/\/.*$/gm, '')));

// ─── 4. IL CAMBIO D'ANNO ───
// Prova generale del cambio d'anno (15/10/2026): il 05/01/2027, con l'ultimo
// ritiro del 2026 al 22/12 (la pausa di Natale) e nessun ritiro del 2027,
// EcoTyna scriveva «i numeri sono al 31/12/2026» accanto a dati_fino_al
// 2026-12-22 e all'atteso del 22/12. Ora dati_fino_al e atteso_alla_data.al sono
// il 31/12/2026, l'atteso il target intero, e gli stessi del 15/01/2027, quando
// i ritiri di gennaio ci sono; e sono quelli della dashboard.
console.log("4. IL CAMBIO D'ANNO: IL 2026 GUARDATO DAL 2027");
if (strumento('contratto_ecotyre')) {
  const NATALE = [...RETE, ritiro('NA', 33000, '2026-11-20', { trasportatore: 'ALFA SRL' }), ritiro('BA', 21000, '2026-12-22')];
  const GENNAIO = [...NATALE, ritiro('NA', 12000, '2027-01-08', { trasportatore: 'ALFA SRL' }), ritiro('BA', 9000, '2027-01-14')];
  const C27 = contratto({ id: 'c27', anno: 2027, target_annuo_t: 11600, created_date: '2026-12-20T10:00:00', updated_date: '2026-12-20T10:00:00' });
  const giro = async (ora, rete) => {
    prepara({ ...archivi(VERO), PrimariaRete: rete, CommessaEcotyre: [VERO, C27] });
    const d = await laDashboard(ora, 2026);
    const t = (await lo('contratto_ecotyre', ora, { anno: 2026 })).dati;
    return { d, t };
  };
  const cinque = await giro('2027-01-05T10:00:00Z', NATALE);
  stessiNumeri('il 2026 il 05/01/2027', cinque.t, cinque.d);
  verifica('il 05/01/2027: dati_fino_al e atteso_alla_data.al sono il 31/12/2026, non il 22/12', cinque.t.dati_fino_al === '2026-12-31' && cinque.t.atteso_alla_data && cinque.t.atteso_alla_data.al === '2026-12-31', J([cinque.t.dati_fino_al, cinque.t.atteso_alla_data]));
  verifica('e l\'atteso e\' il target intero, con l\'anno detto chiuso', cinque.t.atteso_alla_data.atteso_t === 11550 && cinque.t.atteso_alla_data.pct_del_target === 100 && !!cinque.t.atteso_alla_data.anno_chiuso && /i numeri sono al 31\/12\/2026/.test(cinque.t.anno_chiuso || ''), J([cinque.t.atteso_alla_data, cinque.t.anno_chiuso]));
  verifica('la proiezione e\' il raccolto finale', cinque.t.proiezione_fine_anno && cinque.t.proiezione_fine_anno.finale === true && cinque.t.proiezione_fine_anno.t === cinque.t.raccolto_t, J([cinque.t.proiezione_fine_anno, cinque.t.raccolto_t]));
  const quindici = await giro('2027-01-15T10:00:00Z', GENNAIO);
  stessiNumeri('il 2026 il 15/01/2027', quindici.t, quindici.d);
  const numeri = (t) => J([t.dati_fino_al, t.atteso_alla_data, t.raccolto_t, t.residuo_t, t.proiezione_fine_anno, t.regioni]);
  verifica('il 05/01/2027 e il 15/01/2027 EcoTyna dice gli stessi numeri del 2026', numeri(cinque.t) === numeri(quindici.t), `\n    05/01 ${numeri(cinque.t).slice(0, 400)}\n    15/01 ${numeri(quindici.t).slice(0, 400)}`);
  // controprova: il 28/12/2026 il 2026 e' l'anno in corso, misurato al 22/12
  const dicembre = await giro('2026-12-28T10:00:00Z', NATALE);
  verifica('controprova: il 28/12/2026 il 2026 e\' misurato all\'ultimo ritiro, il 22/12', dicembre.t.dati_fino_al === '2026-12-22' && dicembre.t.atteso_alla_data.al === '2026-12-22' && !dicembre.t.anno_chiuso && dicembre.t.atteso_alla_data.atteso_t < 11550, J([dicembre.t.dati_fino_al, dicembre.t.atteso_alla_data]));
}

// ─── 5. IL CONTESTO GENERALE DI ECOTYNA SUL 2027 SENZA RITIRI ───
// Ritocco dopo la revisione del 15/10/2026. Il contesto generale di EcoTyna
// (situazioneGestionale di assistente.ts) conta l'atteso dell'anno in corso con
// attesoAllaData e attesoDellaRegione sul giorno dei dati, che il 05/01/2027,
// senza ritiri del 2027, e' il 22/12/2026: la quota di un giorno dell'anno prima
// era 0, e il contesto scriveva «quota attesa a oggi 0%» e «atteso a oggi 0,00
// t» per regione, mentre dashboard, Target & Status e lo strumento del
// contratto dicevano «—». Ora la quota di un giorno dell'anno prima e' null
// (attesoContratto.ts): l'atteso non c'e', non e' zero.
console.log('5. IL CONTESTO GENERALE DI ECOTYNA SUL 2027 SENZA RITIRI');
{
  const { situazioneGestionale } = await import('../base44/shared/assistente.ts');
  const NATALE = [...RETE, ritiro('NA', 33000, '2026-11-20', { trasportatore: 'ALFA SRL' }), ritiro('BA', 21000, '2026-12-22')];
  const GENNAIO = [...NATALE, ritiro('NA', 12000, '2027-01-08', { trasportatore: 'ALFA SRL' }), ritiro('BA', 9000, '2027-01-14')];
  const C27 = contratto({ id: 'c27', anno: 2027, target_annuo_t: 11600, created_date: '2026-12-20T10:00:00', updated_date: '2026-12-20T10:00:00' });
  const contesto = async (ora, rete) => {
    prepara({ ...archivi(VERO), PrimariaRete: rete, CommessaEcotyre: [VERO, C27] });
    const testo = await conOra(ora, () => situazioneGestionale(sdk, ora.slice(0, 10)));
    const righe = (Array.isArray(testo) ? testo.join('\n') : String(testo)).split('\n');
    const strumento2027 = (await lo('contratto_ecotyre', ora, { anno: 2027 })).dati;
    return { contratto: righe.find(r => r.startsWith('Contratto Ecotyre 2027')) || '', regioni: righe.filter(r => /^- [A-Z][a-z]+: contratto /.test(r)), strumento2027 };
  };
  const cinque = await contesto('2027-01-05T10:00:00Z', NATALE);
  verifica('il 05/01/2027 il contesto non dice «quota attesa a oggi 0%»: la quota non c\'e\', e lo dice', cinque.contratto && !/quota attesa a oggi 0%/.test(cinque.contratto) && /quota attesa non calcolabile/.test(cinque.contratto), cinque.contratto);
  verifica('e nessuna regione «atteso a oggi 0,00 t»: n/d', cinque.regioni.length > 0 && cinque.regioni.every(r => /atteso a oggi n\/d/.test(r) && !/atteso a oggi 0,00 t/.test(r)), J(cinque.regioni));
  verifica('come lo strumento del contratto sul 2027: l\'atteso non c\'e\', col perche\'', cinque.strumento2027 && cinque.strumento2027.atteso_alla_data === null && !!cinque.strumento2027.atteso_perche, J(cinque.strumento2027 && [cinque.strumento2027.atteso_alla_data, cinque.strumento2027.atteso_perche]));
  // controprova: arrivati i ritiri di gennaio, la quota e l'atteso ci sono
  const quindici = await contesto('2027-01-15T10:00:00Z', GENNAIO);
  verifica('controprova: il 15/01/2027, coi ritiri di gennaio, la quota attesa c\'e\' e non e\' zero', /quota attesa a oggi \d+,\d%/.test(quindici.contratto) && !/quota attesa a oggi 0%/.test(quindici.contratto) && /fino al 14\/01\/2027/.test(quindici.contratto), quindici.contratto);
  verifica('e le regioni hanno il loro atteso in tonnellate', quindici.regioni.length > 0 && quindici.regioni.every(r => /atteso a oggi \d[\d.]*,\d+ t/.test(r)), J(quindici.regioni));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
