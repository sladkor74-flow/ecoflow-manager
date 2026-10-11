// Prova del TARGET DEL CONTRATTO E DELL'ATTESO ALLA DATA (chiusura dell'audit,
// 11/10/2026).
//
// 1. attesoContratto.ts: il target annuo e il riparto per regione dal contratto
//    dell'anno, le costanti del 2025 e del 2026 solo come ripiego dichiarato,
//    l'atteso col profilo mensile riportato all'annuo e i giorni coperti dai dati.
// 2. La Dashboard (getDashboardRaccolta, la funzione intera con un SDK finto):
//    - il contratto e' il modificato per ultimo, come in Target & Status (prima
//      il creato per ultimo);
//    - un anno senza contratto non ha target: niente «0%» e niente 11.550 t nel
//      grafico per regione (il riparto del 2026 valeva per ogni anno), ma null e
//      un avviso;
//    - la card dice l'atteso alla data e lo scarto;
//    - un contratto copiato dall'anno prima si dice copiato, da confermare.
// 3. checkTargetAlerts e lo scostamento grave del motore degli alert: un target
//    mensile copiato e non confermato si valuta ma non apre alert.
// 4. Target & Status non conta piu' sul giorno del dispositivo, e le card si
//    chiamano «Residuo dell'anno» e «Scarto del mese sull'atteso».
// 5. Il codice morto (getTargetDashboard, TargetDashboard.jsx, TARGET_ANNUO_TON)
//    non c'e' piu'.
// npm run prove
import { readFileSync, existsSync } from 'node:fs';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import * as A from '../base44/shared/attesoContratto.ts';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
const sorgente = (p) => readFileSync(qui('../' + p), 'utf8').replace(/\r/g, '');
const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
const vicino = (a, b, eps = 1e-6) => a !== null && a !== undefined && Math.abs(a - b) < eps;

// Il profilo del 2026 somma 11.571,64 t, non 11.550: si riporta all'annuo.
const PROFILO = [...Array(11).fill(1000), 571.64];
const quota = (giorno) => { const m = Number(giorno.slice(5, 7)) - 1; const g = Number(giorno.slice(8, 10)); const gm = new Date(Date.UTC(2026, m + 1, 0)).getUTCDate(); return (PROFILO.slice(0, m).reduce((s, v) => s + v, 0) + PROFILO[m] * g / gm) / 11571.64; };
const contratto2026 = { id: 'c26', anno: 2026, target_annuo_t: 11550, target_mensile_json: JSON.stringify(PROFILO), regioni_json: JSON.stringify([{ regione: 'Campania', target_t: 5000 }, { regione: 'Puglia', target_t: 6550 }]) };

console.log("1. IL TARGET E L'ATTESO DEL CONTRATTO");
verifica('il target annuo dal contratto', J(A.targetAnnuoDellAnno(contratto2026, 2026)) === J({ t: 11550, fonte: 'contratto', da_confermare: false }));
verifica('senza contratto: il ripiego solo per il 2025 e il 2026, e si dice', J(A.targetAnnuoDellAnno(null, 2026)) === J({ t: 11550, fonte: 'ripiego', da_confermare: false }) && A.targetAnnuoDellAnno(null, 2025).t === 11200 && J(A.targetAnnuoDellAnno(null, 2027)) === J({ t: null, fonte: null, da_confermare: false }));
const copiato = { ...contratto2026, id: 'c27', anno: 2027, storico_json: JSON.stringify([{ il: '2026-12-20', nota: 'copiato dal 2026, da confermare' }]) };
verifica('un contratto copiato si dice da confermare', A.targetAnnuoDellAnno(copiato, 2027).da_confermare === true);
verifica('il riparto per regione scritto nel codice vale solo per il 2026', A.regioniDellAnno(null, 2026).fonte === 'ripiego' && A.regioniDellAnno(null, 2026).righe.reduce((s, r) => s + r.target_t, 0) === 11550 && A.regioniDellAnno(null, 2027).righe.length === 0 && A.regioniDellAnno(contratto2026, 2026).fonte === 'contratto');
verifica('il profilo riportato all\'annuo: i pesi sommano 1', vicino(A.profiloMensile(contratto2026).pesi.reduce((s, v) => s + v, 0), 1) && A.profiloMensile(contratto2026).rivisto && vicino(A.profiloMensile(null).pesi[3], 1 / 12));
verifica('i giorni coperti: fino all\'ultimo dato, mai oltre oggi', A.giorniCopertiNelMese(2026, 9, '2026-10-07', '2026-10-10') === 7 && A.giorniCopertiNelMese(2026, 9, '2026-10-12', '2026-10-10') === 10
  && A.giorniCopertiNelMese(2026, 8, '2026-10-07') === 30 && A.giorniCopertiNelMese(2026, 10, '2026-10-07') === 0 && A.giorniCopertiNelMese(2026, 9, '') === 0);
verifica('la quota attesa al 07/10 col profilo del contratto', vicino(A.quotaAttesa(contratto2026, 2026, '2026-10-07'), quota('2026-10-07')), String(A.quotaAttesa(contratto2026, 2026, '2026-10-07')));
verifica('un anno finito vale tutto, uno futuro niente, senza dati non si sa', A.quotaAttesa(contratto2026, 2025, '2026-01-03') === 1 && A.quotaAttesa(contratto2026, 2027, '2026-12-31') === 0 && A.quotaAttesa(contratto2026, 2026, '') === null);
const at = A.attesoAllaData(contratto2026, 2026, '2026-10-07');
verifica('l\'atteso alla data', vicino(at.atteso_t, 11550 * quota('2026-10-07')) && at.giorno === '2026-10-07' && at.target_t === 11550, J(at));
verifica('senza target niente atteso inventato', A.attesoAllaData(null, 2027, '2026-10-07').atteso_t === null && A.attesoAllaData(contratto2026, 2026, '2026-10-07', 5000).atteso_t !== null);

// --- le funzioni intere, con un SDK finto che ordina come la piattaforma
const SDK_FINTO = `
const ordina = (righe, campo) => {
  const c = String(campo || 'id').replace(/^-/, ''), giu = String(campo || '').startsWith('-');
  return [...righe].sort((a, b) => { const x = String(a[c] ?? ''), y = String(b[c] ?? ''); return x === y ? 0 : (x < y ? -1 : 1) * (giu ? -1 : 1); });
};
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => r[k] === v);
const entita = (nome) => ({
  list: async (o, l = 1e9, s = 0) => ordina(globalThis.__ARCHIVI_ATTESO[nome] || [], o).slice(s, s + l),
  filter: async (f, o, l = 1e9, s = 0) => ordina((globalThis.__ARCHIVI_ATTESO[nome] || []).filter(r => soddisfa(r, f)), o).slice(s, s + l),
  create: async (r) => r, update: async (id, r) => { globalThis.__SCRITTE_ATTESO.push({ nome, id, r }); return r; },
  bulkCreate: async (righe) => { globalThis.__SCRITTE_ATTESO.push(...righe.map(r => ({ nome, r }))); return righe; },
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
export function createClientFromRequest() { return { auth: { me: async () => ({ role: 'admin', email: 'prova' }) }, asServiceRole: { entities }, entities }; }`;
const funzione = async (nome) => {
  const pacchetto = await build({
    entryPoints: [qui(`../base44/functions/${nome}/entry.ts`)],
    bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
    plugins: [{ name: 'sdk-finto', setup(b) {
      b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'finto' }));
      b.onLoad({ filter: /.*/, namespace: 'finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
    } }],
  });
  const m = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
  return async (corpo) => (await m.default({ json: async () => corpo })).json();
};
let n = 0;
const T = (g) => `${g}T10:00:00Z`;
const prim = (tr, prov, kg, g) => ({ id: 'p' + String(++n).padStart(4, '0'), id_ordine: 'P' + n, stato: 'terminato', classe: 'P', provincia: prov, trasportatore: tr, destinazione: 'IRIGOM SRL', tipo_destinazione: 'imp', peso_effettivo: kg, ordine_immesso_il: T(g), trasporto_iniziato_il: T(g), trasporto_finito_il: T(g) });
const archivi = (extra) => ({ PrimariaRete: [], PrimariaAci: [], ExtraRaccolta: [], CommessaEcotyre: [], TargetMensile: [], Alert: [], UploadLog: [], ...extra });
globalThis.__SCRITTE_ATTESO = [];

console.log('2. LA DASHBOARD');
const dashboard = await funzione('getDashboardRaccolta');
const RETE = [prim('SMOCO SRL', 'NA', 4000000, '2026-03-10'), prim('PNEUSERVICE CONVERSANO SRL', 'BA', 3000000, '2026-10-07')];
// Due contratti del 2026: il creato per ultimo (11.000 t) e il modificato per
// ultimo (11.550 t). Vale il modificato, come in Target & Status.
globalThis.__ARCHIVI_ATTESO = archivi({ PrimariaRete: RETE, CommessaEcotyre: [
  { ...contratto2026, id: 'c26a', target_annuo_t: 11550, created_date: '2026-01-05T10:00:00', updated_date: '2026-06-01T10:00:00' },
  { ...contratto2026, id: 'c26b', target_annuo_t: 11000, created_date: '2026-02-01T10:00:00', updated_date: '2026-02-01T10:00:00' },
] });
const d26 = await dashboard({ anno: [2026] });
verifica('il contratto del 2026 e\' il modificato per ultimo', d26.kpi && d26.kpi.target === 11550, J(d26.kpi));
verifica('la percentuale dell\'anno', d26.kpi && vicino(d26.kpi.raggiungimento_pct, 7000 / 11550 * 100), J(d26.kpi));
const atteso26 = d26.kpi && d26.kpi.atteso;
verifica('l\'atteso al giorno dei dati (07/10), col profilo del contratto, e lo scarto', atteso26 && atteso26.giorno === '2026-10-07' && vicino(atteso26.atteso_t, 11550 * quota('2026-10-07'), 1e-3) && vicino(atteso26.scarto_t, 7000 - 11550 * quota('2026-10-07'), 1e-3) && vicino(atteso26.pct, quota('2026-10-07') * 100, 1e-6), J(atteso26));
verifica('il grafico per regione: contratto e atteso di ogni regione', J((d26.target_vs_raccolto || []).map(r => [r.regione, r.target])) === J([['Campania', 5000], ['Puglia', 6550]]) && (d26.target_vs_raccolto || []).every(r => vicino(r.atteso, r.target * quota('2026-10-07'), 1e-3)), J(d26.target_vs_raccolto));
verifica('nessun avviso quando il contratto c\'e\'', Array.isArray(d26.avvisi_target) && d26.avvisi_target.length === 0, J(d26.avvisi_target));

globalThis.__ARCHIVI_ATTESO = archivi({ PrimariaRete: RETE });
const d27 = await dashboard({ anno: [2027] });
verifica('il 2027 senza contratto: nessun target e nessuna percentuale, non «0%» ne\' «su 0 t»', d27.kpi && d27.kpi.target === null && d27.kpi.raggiungimento_pct === null && d27.kpi.atteso === null, J(d27.kpi));
verifica('il 2027 senza contratto: nel grafico nessuna delle 11.550 t del 2026', (d27.target_vs_raccolto || []).every(r => r.target === null) && !(d27.target_vs_raccolto || []).some(r => r.target === 4400), J(d27.target_vs_raccolto));
verifica('e lo si dice', (d27.avvisi_target || []).some(a => a.includes('2027') && a.includes('Target & Status')), J(d27.avvisi_target));
const d26senza = await dashboard({ anno: [2026] });
verifica('il 2026 senza contratto: il ripiego, dichiarato', d26senza.kpi.target === 11550 && J(d26senza.kpi.target_ripiego) === J([2026]) && (d26senza.avvisi_target || []).some(a => a.includes('ripiego')) && (d26senza.target_vs_raccolto || []).reduce((s, r) => s + r.target, 0) === 11550, J([d26senza.kpi, d26senza.avvisi_target]));

globalThis.__ARCHIVI_ATTESO = archivi({ PrimariaRete: RETE, CommessaEcotyre: [copiato] });
const d27c = await dashboard({ anno: [2027] });
verifica('un contratto copiato e non confermato si dice', J(d27c.kpi.target_da_confermare) === J([2027]) && (d27c.avvisi_target || []).some(a => a.includes('copiato')), J([d27c.kpi, d27c.avvisi_target]));
const card = sorgente('src/components/dashboard/DashboardKpi.jsx');
verifica('la card dice «copiato, da confermare», l\'atteso e lo scarto, e «—» senza target', card.includes("'copiato, da confermare'") && card.includes('atteso al ${giornoMese(a.giorno)}') && card.includes('scarto ') && /value: '—'/.test(card));

console.log('3. I TARGET MENSILI COPIATI NON APRONO ALERT');
const allarmi = await funzione('checkTargetAlerts');
const notaCopia = JSON.stringify([{ il: '2025-12-20', nota: 'copiato dal 2025, da confermare' }]);
globalThis.__SCRITTE_ATTESO = [];
globalThis.__ARCHIVI_ATTESO = archivi({
  PrimariaRete: [prim('ALFA SRL', 'NA', 10000, '2026-01-10'), prim('BETA SRL', 'NA', 10000, '2026-01-12'), prim('GAMMA SRL', 'NA', 1000, '2026-02-20')],
  TargetMensile: [
    { id: 'm1', raccoglitore: 'ALFA SRL', regione: 'Campania', mese: 'Gennaio', anno: 2026, target: 100, storico_json: notaCopia },
    { id: 'm2', raccoglitore: 'BETA SRL', regione: 'Campania', mese: 'Gennaio', anno: 2026, target: 100 },
  ],
});
const r = await allarmi({ mese: 'Gennaio', anno: 2026 });
verifica('il target confermato non raggiunto apre l\'alert', (r.missed || []).map(x => x.raccoglitore).join() === 'BETA SRL', J(r.missed));
verifica('quello copiato si valuta, ma resta fuori dagli avvisi', (r.da_confermare || []).map(x => x.raccoglitore).join() === 'ALFA SRL' && !(r.at_risk || []).some(x => x.raccoglitore === 'ALFA SRL'), J([r.da_confermare, r.at_risk]));
const creati = globalThis.__SCRITTE_ATTESO.filter(x => x.nome === 'Alert' && x.r && x.r.titolo);
verifica('e nessun alert scritto per lui', creati.length === 1 && creati[0].r.titolo.includes('BETA SRL'), J(creati));
const pannello = sorgente('src/components/dashboard/TargetAlertsPanel.jsx');
verifica('il pannello della dashboard lo dice', /da_confermare/.test(pannello) && /da confermare in Target &amp; Status/.test(pannello));
// Lo scostamento grave del motore degli alert (regola scostamento_target), sui
// mesi conclusi dell'anno in corso: anche li' un target copiato non conta. Il
// giorno si ferma all'11/10/2026, cosi' gennaio e' concluso qualunque giorno
// giri la prova.
{
  const motore = await funzione('runAlertEngine');
  globalThis.__SCRITTE_ATTESO = [];
  const conRegione = (r) => ({ ...r, regione: 'Campania' });
  globalThis.__ARCHIVI_ATTESO = archivi({
    RegolaAlert: [{ id: 'rs', nome: 'Scostamento grave', modulo: 'primarie_rete', tipo_regola: 'scostamento_target', severita: 'critico', attiva: true, config: { soglia_pct: -15 } }],
    PrimariaRete: [conRegione(prim('ALFA SRL', 'NA', 10000, '2026-01-10')), conRegione(prim('BETA SRL', 'NA', 10000, '2026-01-12'))],
    TargetMensile: [
      { id: 'm1', raccoglitore: 'ALFA SRL', regione: 'Campania', mese: 'Gennaio', anno: 2026, target: 100, storico_json: notaCopia },
      { id: 'm2', raccoglitore: 'BETA SRL', regione: 'Campania', mese: 'Gennaio', anno: 2026, target: 100 },
    ],
  });
  const DataVera = Date;
  const istante = DataVera.parse('2026-10-11T10:00:00Z');
  globalThis.Date = class extends DataVera { constructor(...a) { super(...(a.length ? a : [istante])); } static now() { return istante; } };
  let esito;
  try { esito = await motore({ modulo: 'primarie_rete' }); } finally { globalThis.Date = DataVera; }
  const scostamenti = globalThis.__SCRITTE_ATTESO.filter(x => x.nome === 'Alert' && x.r && x.r.regola_id === 'rs').map(x => x.r.record_id);
  verifica('motore degli alert: lo scostamento grave si misura sul target confermato, non su quello copiato', J(scostamenti) === J(['BETA SRL|Campania|Gennaio']), J([scostamenti, esito && esito.error]));
}

console.log("4. TARGET & STATUS: L'ATTESO SUI DATI, LE CARD COL SEGNO SPIEGATO");
const pagina = senzaCommenti(sorgente('src/pages/TargetStatus.jsx'));
verifica('nessun giorno del dispositivo', !/new Date\(/.test(pagina) && !/meseCorrente|getMeseCorrente/.test(pagina), (pagina.match(/.*new Date\(.*/g) || []).join('\n'));
verifica('l\'atteso per regione con attesoAllaData sul giorno dei dati', /attesoAllaData\(commessa, anno, giornoDati, contratto\)/.test(pagina) && /giornoDeiDati\(/.test(pagina));
verifica('nessuna costante del target scritta nella pagina', !/11550|11200|TARGET_BY_YEAR/.test(pagina));
// Il PDF dell'Andamento (statusExports.exportPDF) fa riepilogo.map: gli si
// passava l'oggetto delle card e si fermava con «kpis.map is not a function».
verifica('al PDF va un elenco di voci, come vuole il suo riepilogo', /const riepilogoPdf = \[/.test(pagina) && /exportPDF\(riepilogoPdf, /.test(pagina));
const cards = senzaCommenti(sorgente('src/components/target-status/KpiCards.jsx'));
verifica('«Residuo dell\'anno» e «Scarto del mese sull\'atteso», col segno spiegato', cards.includes("Residuo dell'anno") && cards.includes("sull'atteso") && /Positivo: avanti; negativo: indietro/.test(cards) && /Negativo: target superato/.test(cards) && !/Leftover|Delta Mese/.test(cards));

console.log('5. IL CODICE MORTO NON C\'E\' PIU\'');
verifica('getTargetDashboard e TargetDashboard.jsx sono tolti', !existsSync(qui('../base44/functions/getTargetDashboard/entry.ts')) && !existsSync(qui('../src/components/dashboard/TargetDashboard.jsx')));
const gdr = senzaCommenti(sorgente('base44/functions/getDashboardRaccolta/entry.ts'));
verifica('la Dashboard non ha piu\' costanti sue', !/TARGET_ANNUO\s*=|RISERVA_REGIONI|11550|4400/.test(gdr) && !/list\('-created_date', 50\)/.test(gdr));
verifica('TARGET_ANNUO_TON non c\'e\' piu\'', !/export const TARGET_ANNUO_TON/.test(sorgente('base44/shared/primarieReteAnalytics.ts')));

console.log('GLI SPECCHI NUOVI');
const corpo = (p) => { const righe = sorgente(p).split('\n'); let i = 0; while (i < righe.length && (righe[i].startsWith('//') || righe[i].trim() === '')) i++; return righe.slice(i).filter(x => !/^import .* from /.test(x)).join('\n').trim(); };
for (const [o, s] of [['base44/shared/attesoContratto.ts', 'src/lib/attesoContratto.js'], ['base44/shared/andamentoTarget.ts', 'src/lib/andamentoTarget.js']]) {
  verifica(`${s} e' lo specchio di ${o}`, corpo(o) === corpo(s));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
