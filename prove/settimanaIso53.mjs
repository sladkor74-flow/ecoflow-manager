// Prova della SETTIMANA 53 DEL 2026 (chiusura dell'audit, 11/10/2026).
//
// La settimana ISO 53 del 2026 va da lunedi' 28/12/2026 a domenica 03/01/2027.
// Il filtro per anno e settimana delle Secondarie confrontava l'anno del GIORNO:
// «2026, settimana 53» perdeva l'1, il 2 e il 3 gennaio, e «2027, settimana 53»
// prendeva solo quelli. Allo stesso modo «2026, settimana 1» perdeva il 29, 30 e
// 31 dicembre 2025. Con una settimana scelta l'anno e' quello della settimana ISO
// (annoSettimanaIso, annoPerFiltro in shared/movimenti.ts); con il solo anno,
// quello del giorno, come sempre.
//
// La revisione del primo giro ha trovato la regola solo nel dettaglio della
// pagina: KPI e matrice (computeSecondarieMatrix), il file (exportSecondarie) e
// le pivot (shared/pivotCalculator.ts) confrontavano ancora l'anno del giorno, e
// con gli stessi filtri la pagina diceva due viaggi nel dettaglio e uno nei KPI.
// Qui le tre parti si provano con gli stessi movimenti e devono dire lo stesso
// numero del dettaglio.
// npm run prove
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { settimanaIso, annoSettimanaIso, annoPerFiltro, periodoMovimento } from '../base44/shared/movimenti.ts';
import { computeAllPivots } from '../base44/shared/pivotCalculator.ts';
import { caricaFunzione, chiama } from './dati/bancoFunzioni.mjs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const qui = (p) => fileURLToPath(new URL(p, import.meta.url));

// i giorni costruiti uno per uno, dal 25/12/2026 al 10/01/2027
const giorni = [];
for (let d = new Date(Date.UTC(2026, 11, 25)); d <= new Date(Date.UTC(2027, 0, 10)); d.setUTCDate(d.getUTCDate() + 1)) giorni.push(d.toISOString().slice(0, 10));
// il filtro come lo fa la pagina: anno e settimana scelti
const filtra = (anno, settimana) => giorni.filter(g => (settimana === null || settimanaIso(g) === settimana) && annoPerFiltro(g, settimana !== null) === anno);

console.log('LA SETTIMANA 53 DEL 2026');
verifica('va dal 28/12/2026 al 03/01/2027', filtra(2026, 53).join() === ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03'].join(), filtra(2026, 53).join());
verifica('«2027, settimana 53» non esiste: i giorni dall\'1 al 3 gennaio sono del 2026', filtra(2027, 53).length === 0, filtra(2027, 53).join());
verifica('la settimana 1 del 2027 comincia lunedi\' 4 gennaio', filtra(2027, 1)[0] === '2027-01-04' && filtra(2027, 1).length === 7);
verifica('il 29, 30 e 31 dicembre 2025 sono della settimana 1 del 2026', annoSettimanaIso('2025-12-29') === 2026 && settimanaIso('2025-12-29') === 1 && annoSettimanaIso('2025-12-28') === 2025);
verifica('con il solo anno vale il giorno: il 2027 comincia il 1° gennaio', filtra(2027, null)[0] === '2027-01-01' && filtra(2026, null).at(-1) === '2026-12-31');
verifica('un giorno che manca non ha anno', annoPerFiltro('', true) === null && annoPerFiltro(null, false) === null && annoSettimanaIso('') === null);

console.log('LE SECONDARIE FILTRANO COSI\'');
const pagina = readFileSync(new URL('../src/pages/Secondarie.jsx', import.meta.url), 'utf8').replace(/\r/g, '');
verifica('il dettaglio delle Secondarie usa l\'anno della settimana quando una settimana e\' scelta', /annoPerFiltro\(p\.giorno, filters\.settimana\.length > 0\)/.test(pagina) && /filters\.anno\.map\(String\)\.includes\(String\(annoP\)\)/.test(pagina));

// LO STESSO NUMERO NEL DETTAGLIO, NEI KPI, NEL FILE E NELLE PIVOT.
// Sei secondarie di rete terminate: due nella settimana 53 del 2026 a cavallo
// d'anno (29/12/2026 e 02/01/2027), una della settimana 1 del 2027, due della
// settimana 1 del 2026 a cavallo dall'anno prima (30/12/2025 e 02/01/2026), una
// di meta' dicembre 2026. Una ACI nella settimana 53, che resta nel suo canale.
// La mezzanotte italiana (23:30Z del 31/12 e' gia' il 1° gennaio a Roma) conta.
const sec = (id, fine, campi = {}) => ({ id, id_ordine: id, numero_fir: 'F' + id, stato: 'terminato', classe: 'P', prodotto: '.class1', stoccaggio: 'NAPPI SUD SRL', destinazione: 'IRIGOM SRL', tipo_destinazione: 'imp', trasportatore: 'SMOCO SRL', provincia: 'NA', peso_effettivo: 13000, ordine_immesso_il: fine.slice(0, 10) + 'T07:00:00Z', trasporto_iniziato_il: fine.slice(0, 10) + 'T07:00:00Z', trasporto_finito_il: fine, ...campi });
const SECONDARIE = [
  sec('S1', '2026-12-29T10:00:00Z'),
  sec('S2', '2026-12-31T23:30:00Z'),        // a Roma e' il 01/01/2027
  sec('S3', '2027-01-05T10:00:00Z'),
  sec('S4', '2025-12-30T10:00:00Z'),
  sec('S5', '2026-01-02T10:00:00Z'),
  sec('S6', '2026-12-15T10:00:00Z'),
  sec('A1', '2026-12-30T10:00:00Z', { classe: '9 - PFU Autodemolizione', prodotto: 'PFU Autodemolizione' }),
];
// il dettaglio della pagina (Secondarie.jsx): anno della settimana con una settimana scelta
const dettaglio = (anni, settimane, canale = null) => SECONDARIE.filter(r => {
  if (canale === 'Rete' && r.id.startsWith('A')) return false;
  const p = periodoMovimento(r);
  if (settimane.length && !settimane.map(String).includes(String(p.settimana))) return false;
  return !anni.length || anni.map(String).includes(String(annoPerFiltro(p.giorno, settimane.length > 0)));
}).map(r => r.id).sort().join(',');
const CASI = [
  { anni: ['2026'], settimane: ['53'], atteso: 'S1,S2', nome: '«2026, settimana 53»: il 29/12 e il 01/01' },
  { anni: ['2027'], settimane: ['53'], atteso: '', nome: '«2027, settimana 53»: nessuno' },
  { anni: ['2027'], settimane: ['1'], atteso: 'S3', nome: '«2027, settimana 1»: dal 04/01' },
  { anni: ['2026'], settimane: ['1'], atteso: 'S4,S5', nome: '«2026, settimana 1»: anche il 30/12/2025' },
  { anni: ['2026'], settimane: [], atteso: 'S1,S5,S6', nome: '«2026» senza settimana: l\'anno del giorno' },
];

console.log('KPI E MATRICE (computeSecondarieMatrix) COME IL DETTAGLIO');
const matrice = await caricaFunzione('computeSecondarieMatrix');
for (const c of CASI) {
  const { j } = await chiama(matrice, { db: { Secondaria: SECONDARIE }, corpo: { filters: { anno: c.anni, settimana: c.settimane, canale: ['Rete'] } } });
  const ordini = (j.byMese || []).reduce((s, x) => s + x.ordini, 0);
  const contati = (j.kpi && j.kpi.total_orders) ?? 0;
  verifica(`${c.nome}: ${c.atteso.split(',').filter(Boolean).length} viaggi`, dettaglio(c.anni, c.settimane, 'Rete') === c.atteso && ordini === c.atteso.split(',').filter(Boolean).length && contati === ordini, `dettaglio ${dettaglio(c.anni, c.settimane, 'Rete')}, matrice ${ordini}, KPI ${contati}`);
}
const unoSolo = await chiama(matrice, { db: { Secondaria: SECONDARIE }, corpo: { filters: { anno: 2026, settimana: 53, canale: 'Rete' } } });
verifica('anche con anno e settimana scritti come valore singolo', unoSolo.j.kpi.total_orders === 2, JSON.stringify(unoSolo.j.kpi));
const tuttiICanali = await chiama(matrice, { db: { Secondaria: SECONDARIE }, corpo: { filters: { anno: ['2026'], settimana: ['53'] } } });
verifica('l\'ACI della settimana 53 sta nel suo canale, mai sommata', JSON.stringify(tuttiICanali.j.canali.map(c => [c.canale, c.ordini])) === '[["Rete",2],["ACI",1]]' && tuttiICanali.j.kpi.total_orders === null, JSON.stringify(tuttiICanali.j.canali));

console.log('IL FILE (exportSecondarie) COME LO SCHERMO');
const XLSX_FINTO = `
export const utils = { book_new: () => ({ fogli: [] }), json_to_sheet: (righe) => ({ righe }), book_append_sheet: (wb, ws, nome) => { wb.fogli.push({ nome, righe: ws.righe }); } };
export function write() { return 'ZmludG8='; }`;
const SDK_FINTO = `
const entita = (nome) => ({
  list: async (_o, l = 1e9, s = 0) => (globalThis.__S53[nome] || []).slice(s, s + l),
  filter: async (_f, _o, l = 1e9, s = 0) => (globalThis.__S53[nome] || []).slice(s, s + l),
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
export function createClientFromRequest() { return { auth: { me: async () => ({ role: 'admin', email: 'prova' }) }, asServiceRole: { entities }, entities }; }`;
const pacco = await build({
  entryPoints: [qui('../base44/functions/exportSecondarie/entry.ts')], bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
  plugins: [{ name: 'finti', setup(b) {
    b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'finto' }));
    b.onResolve({ filter: /^npm:xlsx/ }, () => ({ path: 'xlsx', namespace: 'finto' }));
    b.onLoad({ filter: /.*/, namespace: 'finto' }, (a) => ({ contents: a.path === 'sdk' ? SDK_FINTO : XLSX_FINTO, loader: 'js' }));
  } }],
});
const esporta = await import('data:text/javascript;base64,' + Buffer.from(pacco.outputFiles[0].text).toString('base64'));
globalThis.__S53 = { Secondaria: SECONDARIE };
for (const c of CASI) {
  for (const mode of ['detail', 'matrix']) {
    const j = await (await esporta.default({ json: async () => ({ filters: { anno: c.anni, settimana: c.settimane, canale: ['Rete'] }, mode }) })).json();
    const n = (j.righe_per_canale && j.righe_per_canale.Rete) || 0;
    verifica(`${c.nome}, file ${mode === 'detail' ? 'di dettaglio' : 'di sintesi'}`, n === c.atteso.split(',').filter(Boolean).length, `${n} righe, attese ${c.atteso || 'nessuna'}`);
  }
}

console.log('LE PIVOT (pivotCalculator) COME LE SECONDARIE');
const archivio = (righe) => ({ list: async (_o, l = 1e9, s = 0) => righe.slice(s, s + l), filter: async (_f, _o, l = 1e9, s = 0) => righe.slice(s, s + l) });
const cliente = (tabelle) => ({ asServiceRole: { entities: new Proxy({}, { get: (_t, nome) => archivio(tabelle[nome] || []) }) } });
for (const c of CASI) {
  const res = await computeAllPivots(cliente({ Secondaria: SECONDARIE }), { anno: c.anni.map(Number), settimana: c.settimane.map(Number) }, ['F']);
  const n = (res.pivotF ? res.pivotF.rows : []).reduce((s, r) => s + r.values.count, 0);
  verifica(`${c.nome}, pivot delle secondarie di rete`, n === c.atteso.split(',').filter(Boolean).length, `${n} viaggi`);
}
// le primarie e l'immissione degli assegnati seguono la stessa regola
const prim = (id, fine) => ({ ...sec(id, fine), trasportatore: 'EMMESSE SRL', destinazione: 'GATIM SRL' });
const pivotA = await computeAllPivots(cliente({ PrimariaRete: [prim('P1', '2026-12-29T10:00:00Z'), prim('P2', '2027-01-02T10:00:00Z'), prim('P3', '2027-01-04T10:00:00Z')] }), { anno: [2026], settimana: [53] }, ['A']);
verifica('pivot delle primarie: «2026, settimana 53» prende anche il 02/01/2027', pivotA.pivotA.tree.totals.count === 2, JSON.stringify(pivotA.pivotA.tree.totals));
const ass = (id, immesso) => ({ id, id_ordine: id, ragione_sociale: 'OFFICINA', provincia: 'NA', peso_stimato: 1000, ordine_immesso_il: immesso });
const pivotH = await computeAllPivots(cliente({ Assegnato: [ass('H1', '2026-12-29T09:00:00Z'), ass('H2', '2027-01-03T09:00:00Z'), ass('H3', '2027-01-04T09:00:00Z')] }), { anno: [2026], settimana: [53] }, ['H']);
verifica('pivot degli assegnati, sull\'immissione: la stessa regola', pivotH.pivotH.tree.totals.count === 2, JSON.stringify(pivotH.pivotH.tree.totals));
const soloAnno = await computeAllPivots(cliente({ PrimariaRete: [prim('P1', '2026-12-29T10:00:00Z'), prim('P2', '2027-01-02T10:00:00Z')] }), { anno: [2026] }, ['A']);
verifica('con il solo anno vale il giorno: il 02/01/2027 e\' del 2027', soloAnno.pivotA.tree.totals.count === 1, JSON.stringify(soloAnno.pivotA.tree.totals));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
