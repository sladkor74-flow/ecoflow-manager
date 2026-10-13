// TARGET & STATUS: I FILTRI DELL'ANDAMENTO NON TOCCANO I NUMERI DELL'ANNO
// (segnalazione alta del 20/09, corretta il 12/10/2026).
//
// La pagina passava i filtri della scheda (mese, regione, raccoglitore, impianto)
// a computeRaccolto, e lo stesso raccolto filtrato andava alle card dell'anno, alla
// tabella «Raccolta RETE per regione e contratto» e al Report generale: con il
// filtro Mese = Settembre «Raccolto RETE nell'anno» diceva il solo settembre e il
// «Residuo dell'anno» passava da 11.400 a 11.500. Ora la pagina legge il raccolto
// una volta, per anno e canale, e i filtri si applicano in memoria
// (filtraRaccolto, src/lib/raccoltoFiltrato.js) solo alle tabelle che li
// prevedono. Qui si prova che:
//   1. il filtro in memoria da' gli stessi numeri della funzione filtrata;
//   2. la pagina da' l'anno intero alle card, alla tabella per contratto e al
//      Report generale, e non richiama la funzione a ogni filtro;
//   3. le card dicono quando i filtri non valgono e con quali vale lo scarto.
// npm run prove
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { computeRaccoltoData } from '../base44/shared/raccoltoCalculator.ts';
import { caricaLibPagine } from './dati/libPagine.mjs';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = JSON.stringify;

let filtraRaccolto = null;
try { ({ filtraRaccolto } = await caricaLibPagine('lib/raccoltoFiltrato')); } catch (e) { verifica('src/lib/raccoltoFiltrato.js si carica', false, e.message); }

// Un archivio con tre raccoglitori, quattro province, tre impianti, ritiri in
// tre mesi, un ritiro dell'anno prima, un cancellato e uno senza fine trasporto.
const mov = (id, giorno, provincia, trasportatore, destinazione, kg, extra = {}) => ({
  id, id_ordine: id, stato: 'terminato', provincia, trasportatore, destinazione, peso_effettivo: kg, numero_fir: 'F' + id,
  ordine_immesso_il: `${giorno}T08:00:00Z`, trasporto_iniziato_il: `${giorno}T06:00:00Z`, trasporto_finito_il: `${giorno}T10:00:00Z`, ...extra,
});
const RETE = [
  mov('a1', '2026-08-10', 'NA', 'NAPPI SUD SRL', 'IRIGOM', 100000),
  mov('a2', '2026-09-10', 'NA', 'NAPPI SUD SRL', 'IRIGOM', 50000),
  mov('a3', '2026-09-12', 'SA', 'NAPPI SUD SRL', 'TECNOGUM', 20000),
  mov('a4', '2026-07-03', 'BA', 'PNEUSERVICE CONVERSANO SRL', 'IRIGOM', 33333),
  mov('a5', '2026-09-30', 'BA', 'PNEUSERVICE CONVERSANO SRL', 'GATIM', 12345),
  mov('a6', '2026-09-15', 'CT', ' SMOCO SRL ', 'GATIM', 7777),
  mov('a7', '2026-09-16', 'XX', 'SMOCO SRL', '', 1000),
  mov('a8', '2025-09-10', 'NA', 'NAPPI SUD SRL', 'IRIGOM', 99000),
  mov('a9', '2026-09-10', 'NA', 'NAPPI SUD SRL', 'IRIGOM', 88000, { stato: 'cancellato' }),
  mov('a10', '2026-09-10', 'NA', 'NAPPI SUD SRL', 'IRIGOM', 5000, { trasporto_finito_il: null }),
];
const archivio = { list: async () => RETE, filter: async () => RETE };
const base44 = { asServiceRole: { entities: { PrimariaRete: archivio, PrimariaAci: { list: async () => [], filter: async () => [] } } } };

console.log('1. IL FILTRO IN MEMORIA E LA FUNZIONE FILTRATA DICONO GLI STESSI NUMERI');
const anno = await computeRaccoltoData(base44, { anno: [2026], canale: 'rete' });
const tondo = (v) => Math.round(v * 1e6) / 1e6;
const mappa = (lista, chiave) => Object.fromEntries((lista || []).filter(e => e.totale > 0).map(e => [chiave(e), [tondo(e.totale), Object.entries(e.mesi).filter(([, v]) => v).map(([m, v]) => `${m}:${tondo(v)}`).join(',')]]).sort());
const vista = (r) => ({
  totale: tondo(r.totale_raccolto),
  raccoglitore: mappa(r.by_raccoglitore, e => `${e.raccoglitore}|${e.regione}`),
  regione: mappa(r.by_regione, e => e.regione),
  impianto: mappa(r.by_impianto, e => e.impianto),
  gruppo: mappa(r.by_raccoglitore_impianto, e => `${e.raccoglitore}|${e.regione}|${e.impianto}`),
});
const CASI = [
  { mese: ['Settembre'] },
  { mese: ['Agosto', 'Settembre'] },
  { regione: ['Campania'] },
  { raccoglitore: ['PNEUSERVICE CONVERSANO SRL'] },
  { impianto: ['GATIM'] },
  { mese: ['Settembre'], regione: ['Puglia', 'Sicilia'] },
  { regione: ['Altro'], impianto: ['N/D'] },
  { mese: ['Gennaio'] },
];
for (const filtri of CASI) {
  const funzione = await computeRaccoltoData(base44, { ...filtri, anno: [2026], canale: 'rete' });
  const memoria = filtraRaccolto ? filtraRaccolto(anno, filtri) : null;
  verifica(`stessi numeri con ${J(filtri)}`, memoria && J(vista(memoria)) === J(vista(funzione)), memoria ? `\n    funzione ${J(vista(funzione))}\n    memoria  ${J(vista(memoria))}` : '');
}
if (filtraRaccolto) {
  verifica('senza filtri il raccolto dell\'anno passa com\'e\'', filtraRaccolto(anno, { mese: [], regione: [], raccoglitore: [], impianto: [] }) === anno);
  const sett = filtraRaccolto(anno, { mese: ['Settembre'] });
  verifica('le voci dei filtri e le date da sistemare restano quelle dell\'anno', sett.filterOptions === anno.filterOptions && sett.date_da_sistemare === anno.date_da_sistemare);
  verifica('il raccolto dell\'anno non cambia filtrando', tondo(anno.totale_raccolto) === 224.455 && tondo(sett.totale_raccolto) === 91.122, `${anno.totale_raccolto} / ${sett.totale_raccolto}`);
}

console.log('2. LA PAGINA DA\' L\'ANNO INTERO DOVE SI PARLA DELL\'ANNO');
const senzaCommenti = (s) => s.replace(/\r/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const pagina = senzaCommenti(readFileSync(qui('../src/pages/TargetStatus.jsx'), 'utf8'));
const chiamateRete = pagina.match(/invoke\('computeRaccolto', \{ filters: \{[^}]*canale: 'rete'[^}]*\} \}\)/g) || [];
verifica('una sola lettura della rete, per anno e canale, senza i filtri della scheda', chiamateRete.length === 1 && chiamateRete[0] === "invoke('computeRaccolto', { filters: { anno: [anno], canale: 'rete' } })", J(chiamateRete));
verifica('cambiare un filtro non rilegge: la lettura dipende solo dall\'anno', /\}, \[anno\]\);/.test(pagina) && !/\}, \[filters, anno\]\);/.test(pagina));
verifica('i filtri si applicano in memoria', /const raccolto = useMemo\(\(\) => filtraRaccolto\(raccoltoAnno, filters\), \[raccoltoAnno, filters\]\);/.test(pagina));
verifica('le card dell\'anno leggono il raccolto senza filtri', /const raccoltoTotale = raccoltoAnno\?\.totale_raccolto \|\| 0;/.test(pagina) && /residuoAnno: contratto\.t === null \? null : contratto\.t - raccoltoTotale/.test(pagina));
verifica('la tabella per regione e contratto riceve l\'anno intero', /<AndamentoRegioni raccolto=\{raccoltoAnno\}/.test(pagina));
verifica('e cosi\' il Report generale', /<ReportGenerale [^>]*raccolto=\{raccoltoAnno\}/.test(pagina));
verifica('le tabelle coi filtri ricevono il raccolto filtrato', /righeAndamento\(\{ mensili: targets, annui, raccolto: raccolto\.by_raccoglitore, filtri: filters \}\)/.test(pagina) && /raccolto\.by_impianto/.test(pagina) && /for \(const r of raccolto\.by_regione\)/.test(pagina));
verifica('il riepilogo del PDF chiama il raccolto come la card', pagina.includes(`{ etichetta: "Raccolto RETE nell'anno", valore: kpis.raccoltoTotale, tipo: 't' }`));

console.log('3. LE CARD DICONO CHE COSA GUARDANO');
{
  const FINTI = {
    react: `const h = (t, p, ...c) => ({ t, p: p || {}, c }); export default { createElement: h, Fragment: 'F' }; export const createElement = h;`,
    jsxrt: `export const Fragment = 'F'; export const jsx = (t, p) => ({ t, p: p || {}, c: [p && p.children] }); export const jsxs = jsx;`,
    lucide: `export const Target = 'i', TrendingUp = 'i', AlertTriangle = 'i', CalendarClock = 'i';`,
  };
  const plug = { name: 'finti', setup(b) {
    b.onResolve({ filter: /^react$/ }, () => ({ path: 'react', namespace: 'finto' }));
    b.onResolve({ filter: /^react\/jsx-runtime$/ }, () => ({ path: 'jsxrt', namespace: 'finto' }));
    b.onResolve({ filter: /^lucide-react$/ }, () => ({ path: 'lucide', namespace: 'finto' }));
    b.onResolve({ filter: /^@\// }, (a) => ({ path: qui('../src/' + a.path.slice(2) + '.js') }));
    b.onLoad({ filter: /.*/, namespace: 'finto' }, (a) => ({ contents: FINTI[a.path], loader: 'js' }));
  } };
  const r = await build({ entryPoints: [qui('../src/components/target-status/KpiCards.jsx')], bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent', jsx: 'automatic', loader: { '.jsx': 'jsx', '.js': 'jsx' }, plugins: [plug] });
  const { default: KpiCards } = await import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
  const stringhe = (n) => (n == null || typeof n === 'boolean' ? [] : typeof n !== 'object' ? [String(n)] : Array.isArray(n) ? n.flatMap(stringhe) : [...stringhe(n.c), ...(typeof n.t === 'function' ? stringhe(n.t(n.p)) : [])]);
  const kpis = { targetAnnuoTotale: 11550, fonteTarget: 'contratto', raccoltoTotale: 150, residuoAnno: 11400, scartoMese: -5, attesoMese: 55, mesiScarto: ['Settembre'], giornoDati: '2026-10-07' };
  const con = stringhe(KpiCards({ kpis: { ...kpis, conFiltri: true, filtriScarto: ['regione Campania'] }, anno: 2026 })).join(' | ');
  const senza = stringhe(KpiCards({ kpis, anno: 2026 })).join(' | ');
  verifica('con un filtro, raccolto e residuo dicono che sono dell\'anno intero', (con.match(/Tutto l'anno: i filtri non valgono qui\./g) || []).length === 2, con);
  verifica('e lo scarto dice con quali filtri vale', /Con i filtri: regione Campania\./.test(con), con);
  verifica('senza filtri non si dice niente in piu\'', !/Tutto l'anno|Con i filtri/.test(senza), senza);
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
