// LA DASHBOARD SUI DATI VERI (migliorie dell'11/10/2026).
//
// La lezione dello stesso giorno: una correzione verde su tutte le prove
// costruite aveva rotto sul sito la colonna «Da dichiarare» di Irigom. Qui la
// dashboard nuova gira sulla copia degli archivi veri (../dati-veri/, fuori dal
// repository: vedi prove/datiVeri.mjs e AGENTS.md, «I quattro controlli»), con
// l'orologio fermo al momento della lettura, e deve dire:
// 1. gli stessi numeri di prima, al carattere, nei campi che c'erano (la
//    funzione del commit 7607980, letta da git);
// 2. un quadro che torna col kpi e con se stesso: regioni, mesi e raccoglitori
//    fanno il raccolto della rete;
// 3. la cifra «Da dichiarare» degli impianti uguale alla colonna «Da dichiarare»
//    delle Dichiarazioni, canale per canale, sia dalla fotografia scritta quella
//    notte sia da quella rifatta adesso;
// 4. sulla copia dell'11/10/2026, i numeri del progetto: 8.818,55 t raccolte,
//    atteso 8.689,23 t, scarto +129,32 t, proiezione 11.721,90 t.
// 5. la pagina disegnata su quelle risposte: nessuna sezione si rompe, nessun
//    «NaN» o «undefined» a video, la tessera della rete dice i numeri del kpi e
//    il PDF del quadro non ha valori mancanti nascosti ne' euro.
// Revisione delle migliorie (11/10/2026), i rilievi dei revisori sui dati veri:
// - l'anno prima (il 2025, fatturato prima del gestionale, nessun documento
//   dell'attiva qui) non e' dodici mesi «da elaborare»: si guarda dal primo mese
//   con un documento, e senza documenti c'e' la nota; si misura al 31/12;
// - nessuna provincia data per ferma ha un ritiro negli ultimi due mesi finiti,
//   e ogni provincia senza ritiri da allora c'e' (KR, VV e TP l'11/10 no); chi
//   lavorava l'anno prima resta ferma anche dopo febbraio (12/10/2026);
// - il 2025, che ha un target di ripiego e nessun contratto, non dice alle
//   regioni che «il contratto Ecotyre del 2025» non ha il riparto (12/10/2026);
// - la quadratura con il portale della dashboard e' quella della pagina
//   Dichiarazioni Impianti (totali del riepilogo): rete 6 su 6 l'11/10/2026,
//   non «5 su 5»; l'ACI degli stoccaggi a parte, 1 su 1.
// Senza la copia la prova si salta e lo dice. npm run prove
import { build } from 'esbuild';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { quadroImpianti } from '../base44/shared/cruscotto.ts';
import { fotografiaDelGiorno, leggiFotografia } from '../base44/shared/indicatoriGiorno.ts';
import { raccoltoPerRaccoglitore, provinceFerme } from '../base44/shared/quadroCommessa.ts';
import { periodoMovimento, eTerminato } from '../base44/shared/movimenti.ts';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
const CARTELLA = process.env.DATI_VERI || qui('../../dati-veri/');
const copie = existsSync(CARTELLA) ? readdirSync(CARTELLA).filter(n => /^treadrider-dati-veri-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n)).sort() : [];
if (!copie.length) {
  console.log(`Nessuna copia dei dati veri in ${CARTELLA}: prova saltata.`);
  process.exit(0);
}
const copia = copie[copie.length - 1];
const DATI = JSON.parse(gunzipSync(readFileSync(CARTELLA + copia)).toString('utf8'));
console.log(`Copia: ${copia}, letta il ${DATI.meta.letto_fino_al}`);

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
const kg = (x) => Math.round(Number(x) * 1000);

globalThis.__DATI_VERI = DATI.archivi;
globalThis.__SCRITTE_DATI_VERI = [];
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
const entita = (nome) => ({
  list: async (sort, lim = 1e9, skip = 0) => ordina(globalThis.__DATI_VERI[nome] || [], sort).slice(skip, skip + lim),
  filter: async (f, sort, lim = 1e9, skip = 0) => ordina((globalThis.__DATI_VERI[nome] || []).filter(r => soddisfa(r, f)), sort).slice(skip, skip + lim),
  get: async (id) => (globalThis.__DATI_VERI[nome] || []).find(r => r.id === id) || null,
  create: async (r) => { globalThis.__SCRITTE_DATI_VERI.push('create ' + nome); return r; },
  update: async (_id, r) => { globalThis.__SCRITTE_DATI_VERI.push('update ' + nome); return r; },
  bulkCreate: async (r) => { globalThis.__SCRITTE_DATI_VERI.push('bulkCreate ' + nome); return r; },
  delete: async () => { globalThis.__SCRITTE_DATI_VERI.push('delete ' + nome); return {}; },
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: 'admin', email: 'controllo-dati-veri' }) }, asServiceRole: { entities }, entities,
    functions: { invoke: async (n) => { throw new Error('il controllo sui dati veri non chiama altre funzioni: ' + n); } } };
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
const ORA = DATI.meta.letto_fino_al;
const ANNO = Number(String(ORA).slice(0, 4));

console.log('1. I NUMERI DI PRIMA, AL CARATTERE');
const nuova = await funzione('getDashboardRaccolta');
const prima = await funzioneDi('7607980', 'getDashboardRaccolta');
const R = {};
for (const anno of [ANNO, ANNO - 1]) {
  R[anno] = await conOra(ORA, () => nuova({ anno: [anno] }));
  verifica(`${anno}: risponde`, R[anno].stato === 200, J(R[anno].j).slice(0, 300));
  if (!prima) continue;
  const p = await conOra(ORA, () => prima({ anno: [anno] }));
  const { quadro, ...resto } = R[anno].j;
  void quadro;
  verifica(`${anno}: kpi, regioni, date e avvisi identici a prima`, J(resto) === J(p.j), `${J(resto).slice(0, 300)}\n${J(p.j).slice(0, 300)}`);
}
if (!prima) console.log('  (git non disponibile: il confronto col codice di prima si salta)');

console.log('2. IL QUADRO TORNA COL KPI E CON SE STESSO');
const { kpi, quadro: q } = R[ANNO].j;
verifica('raccolto, target, percentuale e atteso del kpi', q.rete.raccolto_t === kpi.raccolto_rete_anno && q.rete.target_t === kpi.target && q.rete.pct_target === kpi.raggiungimento_pct && q.rete.atteso && q.rete.atteso.scarto_t === kpi.atteso.scarto_t);
verifica('ACI ed extra del kpi', q.aci.raccolto_t === kpi.raccolto_aci_anno && q.extra.raccolto_t === kpi.raccolto_extra_anno);
verifica('le regioni (e quelle fuori dal contratto) fanno il raccolto della rete, al chilo', kg(q.rete.regioni.reduce((s, r) => s + r.raccolto_t, 0)) + kg(q.rete.fuori_contratto.raccolto_t) === kg(kpi.raccolto_rete_anno), `${q.rete.regioni.reduce((s, r) => s + r.raccolto_t, 0)} + ${q.rete.fuori_contratto.raccolto_t} / ${kpi.raccolto_rete_anno}`);
verifica('i mesi fanno il raccolto della rete', kg(q.rete.mesi.reduce((s, m) => s + (m.raccolto_t || 0), 0)) === kg(kpi.raccolto_rete_anno));
const perRaccoglitore = raccoltoPerRaccoglitore(DATI.archivi.PrimariaRete, ANNO);
verifica('il raccolto per raccoglitore (la regola di Target & Status) fa il raccolto della rete', kg(perRaccoglitore.reduce((s, r) => s + r.totale, 0)) === kg(kpi.raccolto_rete_anno));
verifica('la classifica dei raccoglitori c\'e\'', q.rete.raccoglitori && q.rete.raccoglitori.con_target > 0 && q.rete.raccoglitori.indietro.length + q.rete.raccoglitori.avanti.length > 0, J(q.rete.raccoglitori).slice(0, 300));
verifica('i ritiri sono ordini distinti, meno o quanti le righe', q.rete.ritiri > 0 && q.rete.ritiri <= DATI.archivi.PrimariaRete.length);
verifica('niente euro', !/euro|prezzo|costo|ricavo|margine/i.test(J(q)));
const passato = R[ANNO - 1].j.quadro;
verifica(`${ANNO - 1}: anno chiuso, proiezione = raccolto`, passato.anno_chiuso && passato.rete.proiezione && passato.rete.proiezione.finale, J(passato.rete.proiezione));
// L'attiva dell'anno prima: dal primo mese con un documento (la regola del
// cruscotto per l'anno prima); un anno senza documenti non si guarda, lo dice la
// nota. Prima qui si chiedevano dodici mesi, cioe' si dava per giusto il difetto.
const docsPassato = (DATI.archivi.DocumentoFatturazione || []).filter(d => d.tipo === 'ATTIVA' && Number(d.anno) === ANNO - 1 && !d.superato && d.stato !== 'bozza');
const MESI_ANNO = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const primoConDoc = MESI_ANNO.findIndex(m => docsPassato.some(d => d.mese === m));
verifica(`${ANNO - 1}: l'attiva dal primo mese con un documento (${docsPassato.length} documenti nella copia), mai mesi «da elaborare» prima`,
  Array.isArray(passato.mesi_attiva) && (primoConDoc < 0
    ? passato.mesi_attiva.length === 0 && new RegExp(`^Nessun documento della fatturazione attiva del ${ANNO - 1} nel gestionale`).test(passato.mesi_attiva_nota)
    : passato.mesi_attiva.length === 12 - primoConDoc && passato.mesi_attiva[0].mese === MESI_ANNO[primoConDoc] && passato.mesi_attiva[0].elaborato),
  J([passato.mesi_attiva && passato.mesi_attiva.map(m => [m.mese, m.elaborato]), passato.mesi_attiva_nota]));
verifica(`${ANNO - 1}: l'atteso e le etichette al 31/12/${ANNO - 1}, non al giorno dei dati del ${ANNO}`, passato.rete.atteso && passato.rete.atteso.giorno === `${ANNO - 1}-12-31` && passato.rete.atteso.fine_anno === true && passato.giorno_misura === `${ANNO - 1}-12-31`, J([passato.rete.atteso, passato.giorno_misura]));

// Le province ferme: quelle che lavorano (un ritiro nell'anno o in quello prima)
// e non hanno ritiri terminati dal primo dei due mesi finiti in poi (fine
// trasporto, giorno italiano). Il conto si rifa' qui dalle primarie della copia.
{
  const ferme = q.rete.province_ferme;
  const oggiQ = String(q.oggi);
  const ass = Number(oggiQ.slice(0, 4)) * 12 + Number(oggiQ.slice(5, 7)) - 1 - 2;
  const dal = `${Math.floor(ass / 12)}-${String((ass % 12) + 1).padStart(2, '0')}-01`;
  const ultimo = new Map();
  for (const r of DATI.archivi.PrimariaRete || []) {
    const prov = String(r.provincia || '').toUpperCase().trim();
    const p = eTerminato(r) && prov ? periodoMovimento(r) : null;
    if (!p || p.anno < ANNO - 1 || p.anno > ANNO) continue;
    if (!ultimo.has(prov) || p.giorno > ultimo.get(prov)) ultimo.set(prov, p.giorno);
  }
  const attese = [...ultimo].filter(([, g]) => g < dal).map(([p]) => p).sort();
  const date = (ferme && ferme.province ? ferme.province.map(p => p.provincia) : []).sort();
  verifica(`province ferme: nessuna con un ritiro dal ${dal}, e ci sono tutte quelle senza (${date.length})`, ferme && ferme.anno_in_corso && ferme.dal && ferme.dal.giorno === dal && J(date) === J(attese), J([date, attese, ferme && ferme.dal]));
  if (copia === 'treadrider-dati-veri-2026-10-11.json.gz') {
    verifica('l\'11/10/2026 KR, VV e TP, che a settembre hanno raccolto, non sono ferme', !date.some(p => ['KR', 'VV', 'TP'].includes(p)), J(date));
  }
  // Il cambio d'anno dopo febbraio, sulle primarie vere: guardata il
  // 15/03/2027 la copia (ultimo ritiro a ottobre 2026) ha tutte ferme le
  // province che lavoravano nell'anno della copia. Prima il riquadro diceva
  // «nessuna»: dal 1° marzo lavorava solo chi aveva un ritiro nell'anno nuovo.
  const marzo = provinceFerme(DATI.archivi.PrimariaRete || [], ANNO + 1, `${ANNO + 1}-03-15`);
  const delAnno = new Set();
  for (const r of DATI.archivi.PrimariaRete || []) {
    const prov = String(r.provincia || '').toUpperCase().trim();
    const p = eTerminato(r) && prov ? periodoMovimento(r) : null;
    if (p && p.anno >= ANNO) delAnno.add(prov);
  }
  verifica(`il 15/03/${ANNO + 1}, senza ritiri dell'anno nuovo, le ${delAnno.size} province del ${ANNO} sono tutte ferme`, delAnno.size > 0 && J(marzo.province.map(p => p.provincia).sort()) === J([...delAnno].sort()), J([marzo.province.length, delAnno.size]));
}

console.log('3. IL «DA DICHIARARE» DEGLI IMPIANTI E\' LA COLONNA DELLE DICHIARAZIONI');
const riepilogo = await funzione('riepilogoDichiarazioni');
const D = await conOra(ORA, () => riepilogo({ anno: ANNO }));
verifica('le Dichiarazioni rispondono', D.stato === 200, J(D.j.error || ''));
// La colonna come la scrive Riepilogo.jsx: «—» per la rete non dovuta, la
// giacenza rossa sotto zero, il resto del flusso se e' sopra zero.
const colonna = (siti, canale) => {
  let k = 0;
  for (const s of siti.filter(x => x.tipo_destinazione !== 'stoc')) {
    for (const f of (s.flussi || []).filter(x => x.canale === canale)) {
      if (f.non_dovuta || (f.canale === 'RETE' && s.dichiara_rete === false)) continue;
      const g = (s.giacenze_canale || []).find(x => x.canale === f.canale);
      if (g && g.giacenza_t < 0) continue;
      if (f.resta_t > 0) k += kg(f.resta_t);
    }
  }
  return k;
};
const giorno = String(ORA).slice(0, 10);
// La quadratura con il portale come la scrive la pagina Dichiarazioni Impianti
// (DichiarazioniImpianti.jsx, dai totali del riepilogo) e come la scrive la dashboard.
const tot = D.j.totali || {};
const quadraturaPagina = { rete: `${tot.siti_che_quadrano} su ${tot.siti_che_quadrano + tot.siti_da_quadrare}`, aci: `${tot.aci_che_quadrano} su ${tot.aci_che_quadrano + tot.aci_da_quadrare}` };
const quadratura = (imp) => J({ rete: `${imp.quadrano} su ${imp.con_confronto}`, aci: imp.aci_stoccaggi ? `${imp.aci_stoccaggi.quadrano} su ${imp.aci_stoccaggi.con_confronto}` : null });
const rifatta = quadroImpianti(leggiFotografia(fotografiaDelGiorno(D.j.siti, { giorno, anno: ANNO, doppioni: D.j.doppioni || [] })), { archivi: [] }, giorno);
for (const c of ['RETE', 'ACI', 'EXTRA_RACCOLTA']) {
  verifica(`${c}: dalla fotografia rifatta adesso, la colonna «Da dichiarare» sommata`, kg(rifatta.da_dichiarare[c].t) === colonna(D.j.siti, c), `${rifatta.da_dichiarare[c].t} / ${colonna(D.j.siti, c) / 1000}`);
}
const scritta = (DATI.archivi.IndicatoreGiorno || []).filter(r => r.giorno && r.giorno <= giorno).sort((a, b) => String(b.giorno).localeCompare(String(a.giorno)))[0];
if (scritta) {
  const notte = quadroImpianti(leggiFotografia(scritta), { archivi: [] }, giorno);
  for (const c of ['RETE', 'ACI', 'EXTRA_RACCOLTA']) {
    verifica(`${c}: dalla fotografia scritta la notte del ${scritta.giorno}, lo stesso numero`, notte.stato === 'fresca' && kg(notte.da_dichiarare[c].t) === colonna(D.j.siti, c), `${notte.da_dichiarare && notte.da_dichiarare[c].t} / ${colonna(D.j.siti, c) / 1000}`);
  }
  // LA QUADRATURA E' QUELLA DELLA PAGINA (revisione delle migliorie, 11/10/2026).
  // Qui si contavano i soli impianti e si scriveva «5 su 5», mentre Dichiarazioni
  // Impianti diceva «Rete: quadratura con il portale 6 su 6»: la pagina conta
  // anche lo stoccaggio di Nappi Sud, rete, che ha la sua rilevazione a portale,
  // e l'ACI degli stoccaggi a parte. Lo stesso concetto, lo stesso numero.
  verifica(`dalla fotografia della notte del ${scritta.giorno}, la quadratura della pagina: rete ${quadraturaPagina.rete}, ACI degli stoccaggi ${quadraturaPagina.aci}`, quadratura(notte) === J(quadraturaPagina), `${quadratura(notte)} contro ${J(quadraturaPagina)}`);
}
verifica(`dalla fotografia rifatta adesso, la stessa: rete ${quadraturaPagina.rete}`, quadratura(rifatta) === J(quadraturaPagina), `${quadratura(rifatta)} contro ${J(quadraturaPagina)}`);
const cruscotto = await funzione('cruscottoOperativo');
const C = await conOra(ORA, () => cruscotto({}));
verifica('il cruscotto risponde, con gli impianti, senza scrivere niente', C.stato === 200 && C.j.impianti && C.j.impianti.giorno && globalThis.__SCRITTE_DATI_VERI.length === 0, J(C.j.error || globalThis.__SCRITTE_DATI_VERI));
const chiavi = (C.j.da_gestire || []).map(v => v.chiave);
verifica('le voci vere: tutte con chiave e sezione, chiavi mai ripetute', (C.j.da_gestire || []).every(v => v.chiave && v.sezione) && new Set(chiavi).size === chiavi.length, J(chiavi));

if (copia === 'treadrider-dati-veri-2026-10-11.json.gz') {
  console.log('4. I NUMERI DEL PROGETTO, SULLA COPIA DELL\'11/10/2026');
  const due = (x) => Math.round(x * 100) / 100;
  verifica('8.818,55 t raccolte, dati fino all\'08/10/2026', q.rete.raccolto_t === 8818.55 && q.giorno_dati === '2026-10-08', `${q.rete.raccolto_t} ${q.giorno_dati}`);
  verifica('atteso 8.689,23 t, scarto +129,32 t', due(q.rete.atteso.atteso_t) === 8689.23 && due(q.rete.atteso.scarto_t) === 129.32, J(q.rete.atteso));
  verifica('residuo 2.731,45 t, proiezione 11.721,90 t (101,5%)', due(q.rete.residuo_t) === 2731.45 && due(q.rete.proiezione.t) === 11721.9 && Math.round(q.rete.proiezione.pct_target * 10) / 10 === 101.5, J([q.rete.residuo_t, q.rete.proiezione]));
  verifica('servono 996,18 t al mese contro 1.043,34 (95,5%)', due(q.rete.ritmo.servono_t_mese) === 996.18 && due(q.rete.ritmo.contratto_t_mese) === 1043.34 && Math.round(q.rete.ritmo.pct_ritmo * 10) / 10 === 95.5, J(q.rete.ritmo));
  verifica('nessuna regione fuori dal contratto, quella notte', q.rete.fuori_contratto.raccolto_t === 0);
  verifica('Da dichiarare rete: 1.617,22 t su 4 impianti; «Rete: quadratura con il portale 6 su 6» come la pagina (5 impianti e Nappi Sud), ACI degli stoccaggi 1 su 1', rifatta.da_dichiarare.RETE.t === 1617.22 && rifatta.da_dichiarare.RETE.impianti === 4 && rifatta.quadrano === 6 && rifatta.con_confronto === 6
    && J(rifatta.aci_stoccaggi) === J({ con_confronto: 1, quadrano: 1 }) && quadraturaPagina.rete === '6 su 6', J([rifatta.da_dichiarare, rifatta.quadrano, rifatta.con_confronto, rifatta.aci_stoccaggi, quadraturaPagina]));
}

// LA PAGINA SUI DATI VERI. Le sezioni si disegnano con React lato server sulle
// risposte vere di quella notte (quadro e cruscotto), come le vedrebbe chi apre
// la dashboard: nessuna si rompe, nessun «NaN» o «undefined» a video, e i numeri
// della tessera della rete sono quelli del kpi. Lo stesso per il PDF del quadro.
console.log('5. LA PAGINA DISEGNATA SUI DATI VERI');
{
  const ESTENSIONI = ['', '.js', '.jsx', '.ts'];
  const daAlias = (p) => { const base = qui('../src/' + p.slice(2)); return ESTENSIONI.map(e => base + e).find(f => existsSync(f) && /\.\w+$/.test(f)) || base; };
  const nomi = ['QuadroInBreve', 'SezioneRete', 'SezioneAci', 'SezioneExtra', 'SezioneImpianti', 'SezioneFatturazione', 'FreschezzaDati', 'DaGestire'];
  const INGRESSO = `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import { MemoryRouter } from 'react-router-dom';
${nomi.map(n => `import ${n} from ${J(qui(`../src/components/dashboard/${n}.jsx`))};`).join('\n')}
export { argomentiQuadroPdf } from ${J(qui('../src/components/dashboard/esportaQuadro.js'))};
export { smista } from ${J(qui('../src/lib/avvisiNascosti.js'))};
export { riassuntoControlli, unisciVoci } from ${J(qui('../src/components/dashboard/vociDashboard.js'))};
const C = { ${nomi.join(', ')} };
export const disegna = (nome, props) => renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(C[nome], props)));
`;
  let L = null;
  try {
    const p = await build({
      stdin: { contents: INGRESSO, resolveDir: qui('.'), loader: 'js' }, bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent',
      loader: { '.jsx': 'jsx', '.js': 'jsx' }, define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [{ name: 'alias', setup(b) {
        b.onResolve({ filter: /^@\/api\/base44Client$/ }, () => ({ path: 'client', namespace: 'finto' }));
        b.onLoad({ filter: /.*/, namespace: 'finto' }, () => ({ contents: 'export const base44 = { functions: { invoke: async () => ({ data: {} }) } };', loader: 'js' }));
        b.onResolve({ filter: /^@\// }, (a) => ({ path: daAlias(a.path) }));
      } }],
    });
    if (typeof globalThis.window === 'undefined') globalThis.window = { self: 1, top: 1 };
    L = await import('data:text/javascript;base64,' + Buffer.from(p.outputFiles[0].text).toString('base64'));
  } catch (e) { verifica('le sezioni si impacchettano', false, String(e && e.message).slice(0, 300)); }
  if (L) {
    const testo = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
    const annoInCorso = true;
    const s = L.smista(C.j.da_gestire || [], [], giorno);
    const pagine = {};
    const props = {
      QuadroInBreve: { quadro: q, impianti: C.j.impianti, annoInCorso, caricamento: false, onVai() {} },
      SezioneRete: { quadro: q, arretrato: C.j.arretrato && C.j.arretrato.RETE, annoInCorso },
      SezioneAci: { quadro: q, arretrato: C.j.arretrato && C.j.arretrato.ACI, annoInCorso },
      SezioneExtra: { quadro: q },
      SezioneImpianti: { impianti: C.j.impianti, annoInCorso, anno: ANNO },
      SezioneFatturazione: { mesi: C.j.mesi_attiva, anno: ANNO },
      // i controlli automatici dalle voci vere, come li passa la pagina
      FreschezzaDati: { caricamenti: C.j.caricamenti, controlli: L.riassuntoControlli ? L.riassuntoControlli(L.unisciVoci(C.j.da_gestire || [], [])) : undefined },
      DaGestire: { visibili: s.visibili, nascoste: s.nascoste, filtro: null, aperto: true, onApri() {}, onNascondi() {}, onRimetti() {}, onRimettiTutte() {}, onTogliFiltro() {} },
    };
    for (const n of nomi) {
      try { pagine[n] = testo(L.disegna(n, props[n])); } catch (e) { verifica(`${n} si disegna sui dati veri`, false, String(e && e.message).slice(0, 300)); pagine[n] = ''; }
    }
    const tutto = Object.values(pagine).join(' ');
    if (process.env.MOSTRA) for (const n of nomi) console.log(`--- ${n}
${pagine[n].slice(0, 1500)}`);
    verifica('nessuna sezione vuota, nessun «NaN», «undefined» o «null» a video', nomi.every(n => pagine[n].length > 20) && !/\bNaN\b|undefined|\bnull\b|Infinity/.test(tutto), (tutto.match(/.{0,50}(NaN|undefined|\bnull\b|Infinity).{0,50}/) || [])[0]);
    const tIt = (v) => { let [i, d] = (Math.round(Math.abs(v) * 1000) / 1000).toFixed(3).split('.'); while (d.length > 2 && d.endsWith('0')) d = d.slice(0, -1); return `${i.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${d} t`; };
    verifica('la tessera della rete dice raccolto e target del kpi', pagine.QuadroInBreve.includes(`${tIt(kpi.raccolto_rete_anno)} su ${tIt(kpi.target)}`), pagine.QuadroInBreve.slice(0, 300));
    verifica('la sezione Impianti dice il «Da dichiarare» rete della notte', !C.j.impianti || C.j.impianti.stato !== 'fresca' || pagine.SezioneImpianti.includes(tIt(C.j.impianti.da_dichiarare.RETE.t)), pagine.SezioneImpianti.slice(0, 300));
    verifica('le voci vere si disegnano tutte, una volta', s.visibili.length === (C.j.da_gestire || []).length && s.visibili.every(x => pagine.DaGestire.includes(x.voce.titolo.slice(0, 30))), String(s.visibili.length));
    // La quadratura a video e' quella della pagina Dichiarazioni Impianti.
    verifica(`la sezione Impianti scrive «Rete: quadratura con il portale ${quadraturaPagina.rete}», come Dichiarazioni Impianti`, !C.j.impianti || C.j.impianti.stato !== 'fresca' || pagine.SezioneImpianti.includes(`Rete: quadratura con il portale ${quadraturaPagina.rete}`), (pagine.SezioneImpianti.match(/.{0,20}quadratura.{0,60}/) || [''])[0]);
    // I controlli automatici dicono quello che dicono le voci: mai «tutti
    // regolari» accanto a una voce dei presidi o del guardiano.
    const deiControlli = (C.j.da_gestire || []).filter(v => v.origine === 'presidi' || v.area === 'Manutenzione').length;
    verifica(`i controlli automatici sulle voci vere: ${deiControlli ? `${deiControlli} da gestire` : 'tutti regolari'}`, deiControlli ? pagine.FreschezzaDati.includes(`${deiControlli} da gestire`) && !pagine.FreschezzaDati.includes('tutti regolari') : pagine.FreschezzaDati.includes('tutti regolari'), (pagine.FreschezzaDati.match(/Controlli automatici.*/) || [''])[0]);
    // L'anno prima, come lo vede chi lo sceglie: atteso al 31/12, e l'attiva
    // senza righe «da elaborare» inventate, a video e nel PDF.
    const rete25 = testo(L.disegna('SezioneRete', { quadro: passato, arretrato: null, annoInCorso: false }));
    verifica(`${ANNO - 1} a video: «Atteso al 31/12», mai al giorno dei dati del ${ANNO}`, rete25.includes('Atteso al 31/12') && !rete25.includes(`Atteso al ${String(q.giorno_dati).slice(8, 10)}/${String(q.giorno_dati).slice(5, 7)}`), (rete25.match(/Atteso al [0-9/]+/) || [''])[0]);
    // Il perche' delle regioni dice il vero (12/10/2026): un target di ripiego
    // non e' un contratto, e il riparto manca perche' il contratto non c'e'.
    const regioni25 = (rete25.match(/Lo scarto per regione[^.]+\./) || [''])[0];
    verifica(`${ANNO - 1} (${passato.rete.ripiego ? 'target di ripiego' : 'contratto'}): le regioni dicono il perche' vero dello scarto che manca`, !passato.rete.ripiego || (/target di ripiego/.test(regioni25) && !/il contratto Ecotyre del \d{4} non ha il riparto/.test(rete25)), regioni25);
    const fatt25 = testo(L.disegna('SezioneFatturazione', { mesi: passato.mesi_attiva, nota: passato.mesi_attiva_nota, anno: ANNO - 1 }));
    const pdf25 = L.argomentiQuadroPdf({ quadro: passato, annoInCorso: false, mesiAttiva: passato.mesi_attiva });
    const celle25 = pdf25 ? pdf25.sezioni.flatMap(x => x.righe.flatMap(r => r.celle)) : [];
    const daElaborare = (passato.mesi_attiva || []).filter(m => !m.elaborato || (m.canali && Object.values(m.canali).some(c => !c.elaborato))).length;
    verifica(`${ANNO - 1}: «da elaborare» solo per i mesi dopo il primo documento (${daElaborare}), a video e nel PDF; la nota c'e'`, (daElaborare > 0 || (!fatt25.includes('da elaborare') && !celle25.includes('da elaborare'))) && (!passato.mesi_attiva_nota || (fatt25.includes(passato.mesi_attiva_nota) && pdf25.note.includes(`Fatturazione attiva: ${passato.mesi_attiva_nota}`))), J([fatt25.slice(0, 300), pdf25 && pdf25.note.slice(-1)]));
    const pdf = L.argomentiQuadroPdf({ quadro: q, impianti: C.j.impianti, annoInCorso, mesiAttiva: C.j.mesi_attiva });
    const celle = pdf ? pdf.sezioni.flatMap(x => x.righe.flatMap(r => r.celle)) : [];
    verifica('il PDF del quadro: niente valori mancanti nascosti (ogni cella e\' un numero, un testo o «—»), niente euro', pdf && celle.every(c => (typeof c === 'number' ? Number.isFinite(c) : typeof c === 'string')) && !/€/.test(J(pdf)), pdf && J(celle.filter(c => !(typeof c === 'string' || Number.isFinite(c)))).slice(0, 200));
  }
}

console.log(`\n${ok} superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
