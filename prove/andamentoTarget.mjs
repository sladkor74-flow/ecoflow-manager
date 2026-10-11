// Prova dell'ANDAMENTO DI TARGET & STATUS E DELL'ABBINAMENTO DEI NOMI
// (chiusura dell'audit, 11/10/2026).
//
// 1. Un abbinatore solo fra il nome del target e quello del portale
//    (targetDelPortale): prima il nome esatto normalizzato, poi l'abbreviazione,
//    mai il contrario. Il codice sta una volta sola, in shared/andamentoTarget.ts
//    (con lo specchio in src/lib per le pagine), e shared/targetRaccoglitori.ts lo
//    riesporta per le funzioni: prima c'erano due copie, tenute uguali da questa
//    prova, piu' una terza col suo nome nel riepilogo di EcoTyna (assistente.ts).
//    Qui si controlla che le funzioni siano proprio le stesse e che le copie non
//    tornino.
// 2. La pagina e il file Excel dicono gli stessi numeri: le righe le costruisce
//    righeAndamento per tutti e due. Prima l'Excel scorreva il solo raccolto e
//    cercava il target per nome esatto: con 1.800 t di target (SMOCO Campania
//    1.000 e Basilicata 200 senza raccolto, PNEUSERVICE SRL 600 con 200 t
//    raccolte da PNEUSERVICE CONVERSANO SRL) la pagina diceva 1.800 e il file
//    1.000, e PNEUSERVICE CONVERSANO compariva con target 0 e residuo -200.
// 3. Il foglio Impianti ha le sole primarie RETE ricevute: niente colonne di un
//    target mensile per impianto che nessuno ha mai scritto.
// 4. Il mix delle classi (vista B) trova il target scritto abbreviato.
// npm run prove
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { righeAndamento, targetDelPortale as abbinaPagine, stessoRaccoglitore as stessoPagine } from '../base44/shared/andamentoTarget.ts';
import { targetDelPortale, stessoRaccoglitore } from '../base44/shared/targetRaccoglitori.ts';
import * as targetRaccoglitori from '../base44/shared/targetRaccoglitori.ts';
import * as andamentoTarget from '../base44/shared/andamentoTarget.ts';
import { computeRaccoltoData } from '../base44/shared/raccoltoCalculator.ts';
import { computeRaccoglitoriMixData } from '../base44/shared/primarieReteAnalytics.ts';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
const sorgente = (p) => readFileSync(qui('../' + p), 'utf8').replace(/\r/g, '');
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
const somma = (righe, campo) => Math.round(righe.reduce((s, r) => s + (Number(r[campo]) || 0), 0) * 1000) / 1000;

console.log("1. UN ABBINATORE SOLO, ANCHE NELLE PAGINE");
{
  // le funzioni di targetRaccoglitori.ts sono quelle di andamentoTarget.ts, non copie
  for (const nome of ['targetDelPortale', 'stessoRaccoglitore']) {
    verifica(`${nome}: targetRaccoglitori.ts riesporta quella di andamentoTarget.ts`, typeof targetRaccoglitori[nome] === 'function' && targetRaccoglitori[nome] === andamentoTarget[nome]);
  }
  // e nessuno se ne riscrive una sua
  const senzaCommenti = (p) => sorgente(p).split('\n').filter(r => !r.trim().startsWith('//')).join('\n');
  for (const p of ['base44/shared/targetRaccoglitori.ts', 'base44/shared/assistente.ts']) {
    verifica(`${p} non ha una copia sua dell'abbinatore`, !/function (stessoRaccoglitore|targetDelPortale\w*)\(/.test(senzaCommenti(p)));
  }
  const casi = [
    [['PNEUSERVICE SRL'], 'PNEUSERVICE CONVERSANO SRL'],
    [['SMOCO S.r.l.'], 'SMOCO SRL'],
    [['Logistica Srl', 'Logistica & Pneumatici Srl'], 'LOGISTICA & PNEUMATICI SRL'],
    [['Logistica & Pneumatici'], 'LOGISTICA SRL'],
    [['Eco'], 'ECO RECUPERI SRL'],
    [[], 'SMOCO SRL'],
  ];
  for (const [candidati, portale] of casi) {
    verifica(`stessa risposta per ${portale}`, abbinaPagine(candidati, portale) === targetDelPortale(candidati, portale), J([abbinaPagine(candidati, portale), targetDelPortale(candidati, portale)]));
  }
  verifica('l\'abbreviazione vale solo in un verso', stessoRaccoglitore('PNEUSERVICE SRL', 'PNEUSERVICE CONVERSANO SRL') && !stessoPagine('PNEUSERVICE CONVERSANO SRL', 'PNEUSERVICE SRL'));
}

// --- i dati del caso dell'audit
let n = 0;
const T = (g) => `${g}T10:00:00Z`;
const prim = (tr, prov, kg, g, dest = 'IRIGOM S.R.L.') => ({ id: 'p' + String(++n).padStart(4, '0'), id_ordine: 'P' + n, stato: 'terminato', classe: 'P', prodotto: '.class1', provincia: prov, trasportatore: tr, destinazione: dest, tipo_destinazione: 'imp', peso_effettivo: kg, ordine_immesso_il: T(g), trasporto_iniziato_il: T(g), trasporto_finito_il: T(g) });
const PRIMARIE = [
  prim('PNEUSERVICE CONVERSANO SRL', 'BA', 120000, '2026-03-10'),
  prim('PNEUSERVICE CONVERSANO SRL', 'BA', 80000, '2026-04-10'),
  prim('SMOCO SRL', 'NA', 300000, '2026-03-10'),
  prim('SMOCO S.R.L.', 'NA', 50000, '2026-03-12', 'TECNOGUM SRL'), // la stessa ditta, scritta in un altro modo
];
const ANNUI = [
  { id: 'a1', raccoglitore: 'PNEUSERVICE SRL', regione: 'Puglia', target_tonnellate: 600, anno: 2026 },
  { id: 'a2', raccoglitore: 'SMOCO S.R.L.', regione: 'Campania', target_tonnellate: 1000, anno: 2026 },
  { id: 'a3', raccoglitore: 'SMOCO S.R.L.', regione: 'Basilicata', target_tonnellate: 200, anno: 2026 }, // nessun raccolto in Basilicata
];
const MENSILI = [
  { id: 'm1', raccoglitore: 'PNEUSERVICE SRL', regione: 'Puglia', mese: 'Marzo', target: 50, anno: 2026 },
  { id: 'm2', raccoglitore: 'SMOCO S.R.L.', regione: 'Campania', mese: 'Marzo', target: 100, anno: 2026 },
  { id: 'm3', raccoglitore: 'SMOCO S.R.L.', regione: 'Basilicata', mese: 'Marzo', target: 20, anno: 2026 },
];
const ARCHIVI = { PrimariaRete: PRIMARIE, PrimariaAci: [], TargetRaccoglitore: ANNUI, TargetMensile: MENSILI, ImpiantoTarget: [{ id: 'it1', impianto: 'IRIGOM S.R.L.', mese: 'Marzo', target: 999, anno: 2026 }] };
const sdkSemplice = { asServiceRole: { entities: new Proxy({}, { get: (_t, nome) => ({ list: async (_o, l = 1e9, s = 0) => (ARCHIVI[nome] || []).slice(s, s + l), filter: async (f, _o, l = 1e9, s = 0) => (ARCHIVI[nome] || []).filter(r => Object.entries(f || {}).every(([k, v]) => r[k] === v)).slice(s, s + l) }) }) } };
const raccolto = await computeRaccoltoData(sdkSemplice, { anno: [2026], canale: 'rete' });

console.log("2. LA PAGINA E IL FILE: LE STESSE RIGHE");
const righe = righeAndamento({ mensili: MENSILI, annui: ANNUI, raccolto: raccolto.by_raccoglitore });
const riga = (reg, k) => righe.filter(r => r.regione === reg && r.raccoglitore.toUpperCase().startsWith(k));
verifica('tutto il target c\'e\': 1.800 t', somma(righe, 'targetAnnuo') === 1800, J(righe.map(r => [r.regione, r.raccoglitore, r.targetAnnuo])));
verifica('il target senza raccolto resta (SMOCO in Basilicata)', riga('Basilicata', 'SMOCO').length === 1 && riga('Basilicata', 'SMOCO')[0].targetAnnuo === 200 && riga('Basilicata', 'SMOCO')[0].raccoltoTotale === 0);
const pn = riga('Puglia', 'PNEUSERVICE');
verifica('il target abbreviato e il raccolto del portale fanno una riga sola', pn.length === 1 && pn[0].targetAnnuo === 600 && pn[0].raccoltoTotale === 200 && pn[0].leftover === 400 && pn[0].nomi.includes('PNEUSERVICE CONVERSANO SRL'), J(pn));
const sm = riga('Campania', 'SMOCO');
verifica('due grafie dello stesso nome si sommano (prima la seconda prendeva il posto della prima)', sm.length === 1 && sm[0].raccoltoTotale === 350 && sm[0].mesi[2].raccolto === 350 && sm[0].mesi[2].target === 100, J(sm));
verifica('i filtri della pagina: per regione e per nome del portale', righeAndamento({ mensili: MENSILI, annui: ANNUI, raccolto: raccolto.by_raccoglitore, filtri: { regione: [], raccoglitore: ['PNEUSERVICE CONVERSANO SRL'] } }).length === 1
  && righeAndamento({ mensili: MENSILI, annui: ANNUI, raccolto: raccolto.by_raccoglitore, filtri: { regione: ['Basilicata'], raccoglitore: [] } }).length === 1);
const pagina = sorgente('src/pages/TargetStatus.jsx');
verifica('la pagina costruisce le righe con righeAndamento', /righeAndamento\(\{ mensili: targets, annui, raccolto: raccolto\.by_raccoglitore, filtri: filters \}\)/.test(pagina) && !/const riga = \(nome, regione\)/.test(pagina));

// --- il file Excel, la funzione intera con un SDK e un XLSX finti
const SDK_FINTO = `
const entita = (nome) => ({
  list: async (_o, l = 1e9, s = 0) => (globalThis.__ARCHIVI_ANDAMENTO[nome] || []).slice(s, s + l),
  filter: async (f, _o, l = 1e9, s = 0) => (globalThis.__ARCHIVI_ANDAMENTO[nome] || []).filter(r => Object.entries(f || {}).every(([k, v]) => r[k] === v)).slice(s, s + l),
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
export function createClientFromRequest() { return { auth: { me: async () => ({ role: 'user' }) }, asServiceRole: { entities }, entities }; }`;
const XLSX_FINTO = `
export const utils = {
  book_new: () => ({ fogli: [] }),
  aoa_to_sheet: (righe) => ({ righe }),
  book_append_sheet: (wb, ws, nome) => { wb.fogli.push({ nome, righe: ws.righe }); },
};
export function write(wb) { return Buffer.from(JSON.stringify(wb)).toString('base64'); }`;
globalThis.__ARCHIVI_ANDAMENTO = ARCHIVI;
const pacchetto = await build({
  entryPoints: [qui('../base44/functions/exportStatusExcel/entry.ts')],
  bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
  plugins: [{ name: 'finti', setup(b) {
    b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'finto' }));
    b.onResolve({ filter: /^npm:xlsx/ }, () => ({ path: 'xlsx', namespace: 'finto' }));
    b.onLoad({ filter: /.*/, namespace: 'finto' }, (a) => ({ contents: a.path === 'sdk' ? SDK_FINTO : XLSX_FINTO, loader: 'js' }));
  } }],
});
const modulo = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
const risposta = await (await modulo.default({ json: async () => ({ anno: 2026 }) })).json();
const libro = JSON.parse(Buffer.from(risposta.file_base64 || 'e30=', 'base64').toString());
const foglio = (nome) => ((libro.fogli || []).find(f => f.nome === nome) || { righe: [] }).righe;
const racc = foglio('Raccoglitori');
const corpo = racc.slice(1).map(r => ({ regione: r[0], raccoglitore: r[1], targetAnnuo: r[2], raccoltoTotale: r[3], leftover: r[4] }));
verifica('il file risponde', risposta.filename && racc.length > 1, J(risposta).slice(0, 300));
verifica('nel file tutto il target: 1.800 t, come la pagina', somma(corpo, 'targetAnnuo') === somma(righe, 'targetAnnuo'), J(corpo));
verifica('nel file le stesse righe della pagina, nello stesso ordine', J(corpo.map(r => [r.regione, r.raccoglitore, r.targetAnnuo, r.raccoltoTotale, r.leftover])) === J(righe.map(r => [r.regione, r.raccoglitore, r.targetAnnuo, r.raccoltoTotale, r.leftover])), J(corpo));
verifica('nel file il target senza raccolto c\'e\'', corpo.some(r => r.regione === 'Basilicata' && r.targetAnnuo === 200));
verifica('nessun «Leftover» in inglese: il residuo dell\'anno', racc[0][4] === "Residuo dell'anno (t)", J(racc[0]));

console.log("3. IL FOGLIO IMPIANTI: LE SOLE PRIMARIE RICEVUTE");
const imp = foglio('Impianti');
verifica('le colonne: impianto, primarie RETE ricevute e i dodici mesi, niente target e delta', imp[0] && imp[0][1] === 'Primarie RETE ricevute (t)' && imp[0].length === 14 && !imp[0].some(c => /target|Δ/i.test(String(c))), J(imp[0]));
verifica('ImpiantoTarget non si legge piu\'', !/ImpiantoTarget/.test(sorgente('base44/functions/exportStatusExcel/entry.ts').replace(/\/\/.*$/gm, '')) && !/ImpiantoTarget/.test(pagina.replace(/\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')));
const tabella = sorgente('src/components/target-status/ImpiantiTable.jsx');
verifica('la tabella degli impianti non ha piu\' target ne\' delta, ne\' una cella da scrivere', !/EditableCell|onSaveTarget|m\.delta|m\.target/.test(tabella) && /Primarie RETE ricevute \[t\]/.test(tabella));

console.log("4. IL MIX DELLE CLASSI TROVA IL TARGET ABBREVIATO");
const mix = computeRaccoglitoriMixData(PRIMARIE, { 'PNEUSERVICE SRL': 600, 'SMOCO S.r.l.': 1000 }, { anno: [2026] });
const pnMix = mix.raccoglitori.find(r => r.raccoglitore === 'PNEUSERVICE CONVERSANO SRL');
verifica('vista B: il target di PNEUSERVICE SRL vale per PNEUSERVICE CONVERSANO SRL', pnMix && pnMix.target_raccoglitore === 600 && pnMix.percentuali_target.P > 0, J(pnMix));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
