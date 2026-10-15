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

// ECOTYNA, «QUANTI FORMULARI QUESTA SETTIMANA?» IL 02/01/2027 (prova del cambio
// d'anno del 15/10/2026, difetto 14; D1, decisione dell'utente del
// 15/10/2026). Lo strumento settimana_formulari metteva l'anno di
// calendario accanto alla settimana ISO di oggi e rispondeva «settimana 53 del
// 2027, dal 2028-01-03 al 2027-12-31», zero formulari; strumentiDalPiano gli
// dava l'anno di calendario anche quando la domanda non lo diceva.
console.log('ECOTYNA: LA SETTIMANA DI OGGI E\' LA 53 DEL 2026');
{
  const S = await import('../base44/shared/strumentiAssistente.ts');
  const PA = await import('../base44/shared/pianoAssistente.ts');
  const catalogo = S.catalogoStrumenti();
  const piano = (parametri, periodo = {}) => ({ strumenti: [{ nome: 'settimana_formulari', parametri }], canali: ['RETE'], periodo, serve_normativa: false });
  const param = (oggi, domanda, p) => { const x = PA.strumentiDalPiano(p, catalogo, oggi, domanda)[0]; return x ? x.parametri : null; };
  const questa = param('2027-01-02', 'quanti formulari abbiamo questa settimana?', piano({}));
  verifica('il piano senza anno non riceve l\'anno di calendario', questa && questa.anno === undefined, JSON.stringify(questa));
  const la53 = param('2027-01-02', 'quanti formulari nella settimana 53?', piano({ settimana: 53 }, { settimana: 53 }));
  verifica('con la sola settimana nemmeno', la53 && la53.settimana === 53 && la53.anno === undefined, JSON.stringify(la53));
  verifica('un anno che la domanda dice resta', (param('2027-01-02', 'la settimana 53 del 2026', piano({ settimana: 53, anno: 2026 })) || {}).anno === 2026);
  // L'anno di calendario messo dal piano per abitudine, nei parametri o nel periodo, non passa.
  const abitudine = param('2027-01-02', 'quanti formulari nella settimana 53?', piano({ settimana: 53, anno: 2027 }, { settimana: 53, anno: 2027 }));
  verifica('l\'anno di calendario messo dal piano a una settimana detta senza anno non passa', abitudine && abitudine.settimana === 53 && abitudine.anno === undefined, JSON.stringify(abitudine));
  const questaConAnno = param('2027-01-02', 'quanti formulari abbiamo questa settimana?', piano({}, { anno: 2027 }));
  verifica('nemmeno a «questa settimana» col solo anno nel periodo', questaConAnno && questaConAnno.anno === undefined, JSON.stringify(questaConAnno));
  verifica('«la settimana 10 dell\'anno scorso» tiene l\'anno del piano', (param('2027-01-02', 'quanti formulari nella settimana 10 dell\'anno scorso?', piano({ settimana: 10, anno: 2026 })) || {}).anno === 2026);
  // Revisione del 15/10/2026: l'anno detto a parole in tutti i modi. «Dello
  // scorso anno» e «dell'anno precedente» non si riconoscevano, e col piano
  // {settimana 10, anno 2025} lo strumento rispondeva sulla 10 del 2026.
  for (const d of ['quanti formulari nella settimana 10 dello scorso anno?', 'quanti formulari nella settimana 10 dell\'anno precedente?', 'quanti formulari nella settimana 10 dell’anno scorso?', 'quanti formulari nella settimana 10 dell\'anno prima?', 'quanti formulari nella settimana 10 del 2025?']) {
    const p = param('2026-10-15', d, piano({ settimana: 10, anno: 2025 }, { settimana: 10, anno: 2025 }));
    verifica(`15/10/2026 «${d}»: resta la settimana 10 del 2025`, p && p.settimana === 10 && p.anno === 2025, JSON.stringify(p));
  }
  // Seconda revisione del 15/10/2026: un anno PASSATO scritto dal piano resta
  // sempre, anche se la domanda lo dice con parole che domandaDiceLAnno non
  // conosce; si toglie solo l'anno di oggi messo per abitudine. Prima «la
  // settimana 10 di due anni fa» col piano {settimana 10, anno 2024} rispondeva
  // sulla 10 del 2026.
  for (const [d, a] of [['quanti formulari nella settimana 10 di due anni fa?', 2024], ['quanti formulari nella settimana 10 del \'25?', 2025], ['quanti formulari nella settimana 10 di un anno fa?', 2025], ['quanti formulari nella settimana 10 di tre anni prima che finisse il contratto?', 2023]]) {
    const p = param('2026-10-15', d, piano({ settimana: 10, anno: a }, { settimana: 10, anno: a }));
    verifica(`15/10/2026 «${d}» col piano {settimana 10, anno ${a}}: l'anno del piano resta`, p && p.settimana === 10 && p.anno === a, JSON.stringify(p));
  }
  // E l'anno di oggi detto con l'apostrofo («del '26») si riconosce: la
  // settimana 50 del 2026 non e' ancora cominciata il 15/10/2026, e senza l'anno
  // lo strumento prenderebbe la 50 del 2025.
  const del26 = param('2026-10-15', 'quanti formulari nella settimana 50 del \'26?', piano({ settimana: 50, anno: 2026 }));
  verifica('«la settimana 50 del \'26» col piano {anno 2026}: resta il 2026', del26 && del26.anno === 2026, JSON.stringify(del26));
  verifica('domandaDiceLAnno riconosce «del \'25», «nel ’26», «due anni fa», «un anno fa»', typeof PA.domandaDiceLAnno === 'function' && ['la settimana 10 del \'25', 'nel ’26', 'due anni fa', 'un anno fa', 'tre anni fa'].every(d => PA.domandaDiceLAnno(d)));
  verifica('ma non scambia per un anno un giorno scritto dopo l\'apostrofo', typeof PA.domandaDiceLAnno === 'function' && !PA.domandaDiceLAnno('quanti formulari dall\'11 al 17?') && !PA.domandaDiceLAnno('la richiesta dell\'11/12') && !PA.domandaDiceLAnno('quanti anni fa abbiamo cominciato?'));
  // La controprova: l'anno di oggi messo dal piano per abitudine se ne va ancora.
  const abit26 = param('2026-10-15', 'quanti formulari nella settimana 10?', piano({ settimana: 10, anno: 2026 }, { settimana: 10, anno: 2026 }));
  verifica('l\'anno di oggi scritto dal piano a una settimana detta senza anno se ne va ancora', abit26 && abit26.anno === undefined, JSON.stringify(abit26));
  const tipografico = param('2026-10-15', 'quanti formulari nella settimana 10 di quest’anno?', piano({ settimana: 10, anno: 2026 }));
  verifica('«di quest’anno» con l\'apostrofo del telefono tiene l\'anno', tipografico && tipografico.anno === 2026, JSON.stringify(tipografico));
  verifica('domandaDiceLAnno: le frasi senza anno restano senza', typeof PA.domandaDiceLAnno === 'function' && ['quanti formulari questa settimana?', 'la settimana 53', 'quanti formulari nella settimana scorsa?'].every(d => !PA.domandaDiceLAnno(d)));

  // Lo strumento vero, a orologio fermo, con sei formulari dal 28/12/2026 al 02/01/2027.
  const giorniW = ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'];
  const archivi = { PrimariaRete: giorniW.map((g, i) => ({ id: 'w' + i, id_ordine: 'ET2699953' + i, numero_fir: 'FIR W53 ' + i, stato: 'terminato', partner_operativo: 'SMOCO', trasportatore: 'EMMESSE SRLS', destinazione: 'GATIM SRL', provincia: 'NA', classe: 'P',
    ordine_immesso_il: '2026-12-20T08:00:00Z', trasporto_iniziato_il: g + 'T08:00:00Z', trasporto_finito_il: g + 'T10:00:00Z', ordine_chiuso_il: g + 'T12:00:00Z', peso_effettivo: 1000 })) };
  const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => {
    const x = r[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if ('$in' in v && !v.$in.includes(x)) return false;
      if ('$gte' in v && !(x != null && String(x) >= String(v.$gte))) return false;
      if ('$lte' in v && !(x != null && String(x) <= String(v.$lte))) return false;
      if ('$lt' in v && !(x != null && String(x) < String(v.$lt))) return false;
      if ('$gt' in v && !(x != null && String(x) > String(v.$gt))) return false;
      return true;
    }
    if (v === null) return x === null || x === undefined || x === '';
    return x === v;
  });
  const ent = new Proxy({}, { get: (_t, n) => ({
    filter: async (f, _s, lim = 5000, skip = 0) => (archivi[n] || []).filter(r => soddisfa(r, f)).slice(skip, skip + lim).map(r => ({ ...r })),
    list: async (_s, lim = 5000, skip = 0) => (archivi[n] || []).slice(skip, skip + lim).map(r => ({ ...r })),
  }) });
  const sdk = { asServiceRole: { entities: ent }, entities: ent };
  const OraVera = Date;
  const alle = async (iso, f) => {
    const ms = OraVera.parse(iso);
    globalThis.Date = class extends OraVera { constructor(...a) { if (a.length) super(...a); else super(ms); } static now() { return ms; } };
    try { return await f(); } finally { globalThis.Date = OraVera; }
  };
  const primarie = (r) => { const c = ((r.dati || {}).canali || []).find(x => x.canale === 'RETE'); const f = c ? c.flussi.find(x => x.flusso === 'rete_primarie') : null; return f ? f.formulari : 0; };
  const oggi53 = await alle('2027-01-02T09:00:00Z', () => S.eseguiStrumento(sdk, 'settimana_formulari', questa, null));
  verifica('il 02/01/2027, senza parametri: settimana 53 del 2026, dal 28/12/2026 al 03/01/2027, sei formulari', oggi53.periodo === 'settimana 53 del 2026, dal 28/12/2026 al 03/01/2027' && primarie(oggi53) === 6, JSON.stringify({ periodo: oggi53.periodo, n: primarie(oggi53), errore: oggi53.errore }));
  const dal5 = await alle('2027-01-05T09:00:00Z', () => S.eseguiStrumento(sdk, 'settimana_formulari', { settimana: 53 }, null));
  verifica('il 05/01/2027 «la settimana 53» e\' l\'ultima 53 gia\' cominciata, quella del 2026', /^settimana 53 del 2026, dal 28\/12\/2026 al 03\/01\/2027$/.test(dal5.periodo) && primarie(dal5) === 6, dal5.periodo);
  const dal5w1 = await alle('2027-01-05T09:00:00Z', () => S.eseguiStrumento(sdk, 'settimana_formulari', {}, null));
  verifica('il 05/01/2027 senza parametri: la 1 del 2027, nessun formulario', /^settimana 1 del 2027, dal 04\/01\/2027 al 10\/01\/2027$/.test(dal5w1.periodo) && primarie(dal5w1) === 0, dal5w1.periodo);
  const non = await alle('2027-01-02T09:00:00Z', () => S.eseguiStrumento(sdk, 'settimana_formulari', { anno: 2027, settimana: 53 }, null));
  verifica('«la 53 del 2027» non esiste: lo dice, senza numeri', /Il 2027 ha 52 settimane ISO: la settimana 53 non c'e'/.test((non.dati || {}).avviso_settimana || '') && !!(non.dati || {}).numero_non_calcolabile && !(non.dati || {}).canali, JSON.stringify(non.dati));
  // La controprova: a meta' anno la settimana di oggi e' quella di sempre.
  const ottobre = await alle('2026-10-15T09:00:00Z', () => S.eseguiStrumento(sdk, 'settimana_formulari', {}, null));
  verifica('il 15/10/2026 senza parametri: la 42 del 2026', /^settimana 42 del 2026, dal 12\/10\/2026 al 18\/10\/2026$/.test(ottobre.periodo), ottobre.periodo);
  const la40 = await alle('2026-10-15T09:00:00Z', () => S.eseguiStrumento(sdk, 'settimana_formulari', { settimana: 40 }, null));
  verifica('il 15/10/2026 «la settimana 40»: quella del 2026', /^settimana 40 del 2026,/.test(la40.periodo), la40.periodo);
  const la50 = await alle('2026-10-15T09:00:00Z', () => S.eseguiStrumento(sdk, 'settimana_formulari', { settimana: 50 }, null));
  verifica('il 15/10/2026 «la settimana 50», che nel 2026 deve ancora venire: quella del 2025', /^settimana 50 del 2025,/.test(la50.periodo), la50.periodo);
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
