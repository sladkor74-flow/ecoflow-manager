// Prova della PRESENTAZIONE E DEL PDF DELL'ANDAMENTO (revisione finale della
// chiusura dell'audit, 11/10/2026).
//
// La presentazione di Target & Status, chiamata come la chiama la pagina, non
// diceva di che anno erano i numeri (la pagina non passava l'anno) e scriveva
// «dati fino al 07/10/2026»: i numeri del 2025 si leggevano come quelli del 2026.
// E chiamava «Scarto del mese sull'atteso» lo scarto dei mesi scelti nel filtro,
// mentre la card della pagina dice «Scarto di agosto sull'atteso». Si provano i
// file veri (statusExports.js, KpiCards.jsx e la chiamata scritta in
// TargetStatus.jsx), con pptxgenjs e React finti. npm run prove
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
if (typeof globalThis.window === 'undefined') globalThis.window = { self: 1, top: 1 };
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const pagina = readFileSync(qui('../src/pages/TargetStatus.jsx'), 'utf8').replace(/\r/g, '');
const chiamata = (/onPPT=\{\(\) => exportPPT\(([^)]*)\)\}/.exec(pagina) || [])[1] || '';
const argomenti = chiamata.split(',').map(s => s.trim()).filter(Boolean);

const FINTI = {
  pptx: `export default class { constructor() { this.slides = []; globalThis.__PPT = this; }
    defineLayout() {} addSlide() { const s = { testi: [], tabelle: [], addText(t) { this.testi.push(String(t)); }, addTable(r) { this.tabelle.push(r); } }; this.slides.push(s); return s; }
    async writeFile(o) { this.fileName = o.fileName; } }`,
  client: 'export const base44 = { functions: { invoke: async () => ({ data: {} }) } };',
  pdf: 'export async function esportaSezioniPdf(a) { globalThis.__PDF = a; }',
  react: `const h = (t, p, ...c) => ({ t, p: p || {}, c }); export default { createElement: h, Fragment: 'F' }; export const createElement = h;`,
  jsxrt: `export const Fragment = 'F'; export const jsx = (t, p) => ({ t, p: p || {}, c: [p && p.children] }); export const jsxs = jsx;`,
  lucide: `export const Target = 'i', TrendingUp = 'i', AlertTriangle = 'i', CalendarClock = 'i';`,
};
const plug = { name: 'finti', setup(b) {
  b.onResolve({ filter: /^pptxgenjs$/ }, () => ({ path: 'pptx', namespace: 'finto' }));
  b.onResolve({ filter: /^@\/api\/base44Client$/ }, () => ({ path: 'client', namespace: 'finto' }));
  b.onResolve({ filter: /^@\/lib\/esportaTabella$/ }, () => ({ path: 'pdf', namespace: 'finto' }));
  b.onResolve({ filter: /^react$/ }, () => ({ path: 'react', namespace: 'finto' }));
  b.onResolve({ filter: /^react\/jsx-runtime$/ }, () => ({ path: 'jsxrt', namespace: 'finto' }));
  b.onResolve({ filter: /^lucide-react$/ }, () => ({ path: 'lucide', namespace: 'finto' }));
  b.onResolve({ filter: /^@\// }, (a) => ({ path: qui('../src/' + a.path.slice(2) + '.js') }));
  b.onLoad({ filter: /.*/, namespace: 'finto' }, (a) => ({ contents: FINTI[a.path], loader: 'js' }));
} };
const carica = async (entry) => {
  const r = await build({ entryPoints: [qui(entry)], bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent', jsx: 'automatic', loader: { '.jsx': 'jsx', '.js': 'jsx' }, plugins: [plug] });
  return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
};
const lib = await carica('../src/lib/statusExports.js');
const { default: KpiCards } = await carica('../src/components/target-status/KpiCards.jsx');

// Le card del 2025 (target di ripiego), filtro mese Agosto, dati della rete fino al 07/10/2026.
const anno = 2025;
const kpis = { targetAnnuoTotale: 11200, fonteTarget: 'ripiego', targetDaConfermare: false, raccoltoTotale: 11000, residuoAnno: 200,
  scartoMese: -50, attesoMese: 950, mesiScarto: ['Agosto'], giornoDati: '2026-10-07', leftoverTotale: 200, deltaMeseCorrente: 50 };
const valori = { kpis, mergedData: [{ regione: 'Campania', raccoglitore: 'EMMESSE SRL', targetAnnuo: 1200, raccoltoTotale: 1000, leftover: 200 }],
  regioneData: [{ regione: 'Campania', totale: 1000 }], impiantiData: [{ impianto: 'IRIGOM SRL', totale: 1000 }], anno };
await lib.exportPPT(...argomenti.map(a => valori[a]));
const ppt = globalThis.__PPT;
const testi = ppt.slides.flatMap(s => [...s.testi, ...s.tabelle.flat(2).map(c => (c && typeof c === 'object' ? c.text : String(c)))]);
const etichetteKpi = ppt.slides[0].tabelle[0].slice(1).map(r => r[0]);
const stringhe = (n) => (n == null || typeof n === 'boolean' ? [] : typeof n !== 'object' ? [String(n)] : Array.isArray(n) ? n.flatMap(stringhe) : [...stringhe(n.c), ...(typeof n.t === 'function' ? stringhe(n.t(n.p)) : [])]);
const cardScarto = stringhe(KpiCards({ kpis, anno })).find(t => /^Scarto /.test(t)) || '';
const pptScarto = etichetteKpi.find(t => /^Scarto /.test(t)) || '';

console.log("L'ANNO DELLA PRESENTAZIONE");
verifica('la pagina passa l\'anno alla presentazione', argomenti.includes('anno'), chiamata);
verifica('e la presentazione del 2025 lo dice', testi.some(t => t.includes(String(anno))), ppt.slides[0].testi.slice(0, 2).join(' | '));

console.log("LO SCARTO DEI MESI SCELTI");
verifica('la presentazione chiama lo scarto come la card della pagina', cardScarto && pptScarto === cardScarto, `card «${cardScarto}», presentazione «${pptScarto}»`);
verifica('«Scarto di agosto sull\'atteso»', pptScarto === "Scarto di agosto sull'atteso", pptScarto);
verifica('anche la nota sotto la tabella', testi.some(t => /Scarto di agosto: raccolto meno atteso/.test(t)));
await lib.exportPPT({ ...kpis, mesiScarto: [] }, valori.mergedData, valori.regioneData, valori.impiantiData, anno);
const senzaFiltro = globalThis.__PPT.slides[0].tabelle[0].slice(1).map(r => r[0]).find(t => /^Scarto /.test(t));
verifica('senza filtro sui mesi resta «Scarto del mese sull\'atteso»', senzaFiltro === "Scarto del mese sull'atteso", senzaFiltro);
verifica('il riepilogo del PDF della pagina usa la stessa etichetta', /etichetta: `Scarto \$\{\(kpis\.mesiScarto \|\| \[\]\)\.length \? `di \$\{kpis\.mesiScarto\.join\(', '\)\.toLowerCase\(\)\}` : 'del mese'\} sull'atteso`/.test(pagina));

console.log(`\n${ok} superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
