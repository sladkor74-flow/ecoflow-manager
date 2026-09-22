// Prova degli AVVISI sulle date da sistemare: che dicano di che perimetro
// parlano e che contino la stessa cosa dovunque (regola dell'utente, 23/09/2026:
// due numeri diversi per lo stesso insieme non devono esistere, e ogni avviso
// deve dire di che anno e di che canale parla).
//
// Due pezzi:
//   - l'alert di target di un mese (base44/functions/checkTargetAlerts), che si
//     portava dietro i terminati senza fine trasporto di QUALUNQUE anno: un
//     ordine del 2024 restava dentro l'alert di settembre 2026 per sempre;
//   - l'avviso in testa agli elenchi (src/components/primarie-rete/DateDaSistemare.jsx),
//     che sommava senza dirlo gli ordini del periodo scelto e i senza fine
//     trasporto di qualunque anno, e contava righe invece di ordini.
//
// La funzione importa l'SDK da npm e il componente e' JSX: tutti e due si
// impacchettano con esbuild (quello di vite, gia' fra i pacchetti). Il giorno e'
// fissato al 23/09/2026, altrimenti il mese corrente cambierebbe col calendario.
// npm run prove
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// --- il giorno fisso: mercoledi' 23/09/2026
const ADESSO = Date.parse('2026-09-23T10:00:00Z');
const DataVera = Date;
class DataFissa extends DataVera {
  constructor(...a) { super(...(a.length ? a : [ADESSO])); }
  static now() { return ADESSO; }
}
globalThis.Date = DataFissa;

// --- l'SDK finto: archivi in globalThis.__ARCHIVI, scritture in __SCRITTI (con
// il contenuto, che qui serve per leggere il testo degli alert)
const SDK_FINTO = `
const filtra = (righe, f) => righe.filter(r => Object.entries(f || {}).every(([k, v]) => (v && typeof v === 'object' && Array.isArray(v.$in)) ? v.$in.includes(r[k]) : r[k] === v));
function entita(nome) {
  const righe = () => (globalThis.__ARCHIVI[nome] || []);
  const scrivi = (x) => { (globalThis.__SCRITTI ||= []).push({ nome, ...x }); };
  return {
    filter: async (f, _o, lim = 1e9, skip = 0) => filtra(righe(), f).slice(skip, skip + lim),
    list: async (_o, lim = 1e9, skip = 0) => righe().slice(skip, skip + lim),
    create: async (d) => { scrivi({ op: 'create', d }); return { id: 'n' + Math.random(), ...d }; },
    update: async (id, d) => { scrivi({ op: 'update', id, d }); return { id, ...d }; },
    bulkCreate: async (a) => { scrivi({ op: 'bulkCreate', righe: a }); return a; },
  };
}
const entities = new Proxy({}, { get: (_t, nome) => entita(nome) });
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: 'admin', email: 'prova' }) }, asServiceRole: { entities }, entities };
}`;
const sdkFinto = {
  name: 'sdk-finto',
  setup(b) {
    b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'finto' }));
    b.onLoad({ filter: /.*/, namespace: 'finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
  },
};
const impacchetta = async (opzioni) => {
  const r = await build({ bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent', ...opzioni });
  return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
};
const m = await impacchetta({ entryPoints: [qui('../base44/functions/checkTargetAlerts/entry.ts')], plugins: [sdkFinto] });
const chiamaFunzione = async (body = {}) => (await m.default({ json: async () => body })).json();

// --- le primarie di rete del raccoglitore ALFA in Campania
const terminata = (id, extra) => ({ id, id_ordine: id, stato: 'terminato', trasportatore: 'ALFA SRL', provincia: 'NA', regione: 'Campania', classe: 'P', peso_effettivo: 1000, ...extra });
globalThis.__ARCHIVI = {
  TargetMensile: [
    { id: 't1', raccoglitore: 'ALFA SRL', regione: 'Campania', mese: 'Settembre', anno: 2026, target: 10 },
    { id: 't2', raccoglitore: 'ALFA SRL', regione: 'Campania', mese: 'Maggio', anno: 2024, target: 10 },
  ],
  PrimariaRete: [
    // il raccolto di settembre 2026: i dati arrivano al 20, il target non si raggiunge
    terminata('ET26SET', { ordine_immesso_il: '2026-09-01T08:00:00Z', trasporto_iniziato_il: '2026-09-19T08:00:00Z', trasporto_finito_il: '2026-09-20T10:00:00Z' }),
    // senza fine trasporto, immessi in periodi diversi
    terminata('ET26SF', { numero_fir: 'FIR-A', ordine_immesso_il: '2026-03-01T08:00:00Z', trasporto_iniziato_il: '2026-03-02T08:00:00Z' }),
    // seconda riga dello STESSO ordine (un secondo formulario): un ordine, non due
    { ...terminata('ET26SF', { numero_fir: 'FIR-B', ordine_immesso_il: '2026-03-01T08:00:00Z', trasporto_iniziato_il: '2026-03-02T08:00:00Z' }), id: 'r-bis' },
    terminata('ET25DIC', { ordine_immesso_il: '2025-12-15T08:00:00Z', trasporto_iniziato_il: '2025-12-16T08:00:00Z' }),
    terminata('ET24MAG', { ordine_immesso_il: '2024-05-01T08:00:00Z', trasporto_iniziato_il: '2024-05-02T08:00:00Z' }),
    terminata('ET-SENZA-DATE', {}),
  ],
  Alert: [], UploadLog: [], GiacenzaSito: [], ImpiantoTargetSecondaria: [],
};

console.log('ALERT DI TARGET: I SENZA FINE TRASPORTO SONO QUELLI DEL PERIODO DEL TARGET');
globalThis.__SCRITTI = [];
const settembre = await chiamaFunzione({ mese: 'Settembre', anno: 2026 });
const voce = (settembre.at_risk || []).concat(settembre.missed || [])[0] || {};
verifica('il raccoglitore e\' a rischio e porta i suoi senza fine trasporto', !!voce.raccoglitore, JSON.stringify(settembre).slice(0, 300));
verifica('conta quelli immessi nell\'anno del target e a dicembre dell\'anno prima', voce.senza_fine_trasporto === 2, JSON.stringify(voce));
verifica('due righe dello stesso ordine sono un ordine solo', voce.senza_fine_trasporto === 2 && settembre.senza_fine_trasporto === 4, String(settembre.senza_fine_trasporto));
verifica('gli altri periodi si contano a parte, non spariscono', voce.senza_fine_altri_periodi === 2, JSON.stringify(voce.senza_fine_altri_periodi));
verifica('il periodo e\' scritto nella voce', voce.senza_fine_periodo === 'immessi nel 2026 o a dicembre 2025', String(voce.senza_fine_periodo));
const creati = (globalThis.__SCRITTI.find(s => s.op === 'bulkCreate') || { righe: [] }).righe;
const alert = creati.find(a => a.entity_type === 'TargetMensile') || {};
verifica('l\'alert dice di che anno parla', String(alert.descrizione || '').includes('immessi nel 2026 o a dicembre 2025'), String(alert.descrizione).slice(0, 400));
verifica('e dice che ce ne sono altri, e dove si vedono', String(alert.descrizione || '').includes('Altri 2 ordini senza fine trasporto') && String(alert.descrizione).includes('Terminati Rete'), String(alert.descrizione).slice(0, 400));

console.log('LO STESSO ALERT SU UN ALTRO ANNO CONTA ALTRI ORDINI');
globalThis.__SCRITTI = [];
const maggio2024 = await chiamaFunzione({ mese: 'Maggio', anno: 2024 });
const voce24 = (maggio2024.missed || []).concat(maggio2024.at_risk || [])[0] || {};
verifica('nel 2024 conta il suo, non quelli del 2026', voce24.senza_fine_trasporto === 1 && voce24.senza_fine_altri_periodi === 3, JSON.stringify(voce24));
verifica('e lo dice nel testo', String((globalThis.__SCRITTI.find(s => s.op === 'bulkCreate') || { righe: [{}] }).righe.find(a => a.entity_type === 'TargetMensile').descrizione).includes('immesso nel 2024 o a dicembre 2023'));

console.log('AVVISO DEGLI ELENCHI: ORDINI DISTINTI E PERIMETRO DETTO');
const componente = await impacchetta({
  entryPoints: [qui('../src/components/primarie-rete/DateDaSistemare.jsx')],
  loader: { '.jsx': 'jsx' },
  // JSX alla vecchia maniera (React.createElement): cosi' non tira dentro
  // react/jsx-runtime, che a caricamento vuole un React vero
  jsx: 'transform',
  plugins: [{
    name: 'pagine-finte',
    setup(b) {
      // react (anche il suo jsx-runtime) e le icone non servono: le prove
      // chiamano solo i conti, non il JSX
      b.onResolve({ filter: /^react(\/|$)|^lucide-react$/ }, () => ({ path: 'vuoto', namespace: 'stub' }));
      // utils legge window a caricamento: qui basta formatIntero
      b.onResolve({ filter: /^@\/lib\/utils$/ }, () => ({ path: 'utils', namespace: 'stub' }));
      b.onResolve({ filter: /^@\/lib\// }, (a) => ({ path: qui('../src/lib/' + a.path.replace('@/lib/', '') + '.js') }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, (a) => ({
        contents: a.path === 'utils'
          ? 'export const formatIntero = (n) => String(Math.round(Number(n) || 0));'
          : 'export default {}; export const AlertTriangle = null; export const jsx = null; export const jsxs = null; export const jsxDEV = null; export const Fragment = null;',
        loader: 'js',
      }));
    },
  }],
});
const { riepilogoAvviso } = componente;
const riga = (id, extra) => ({ id_ordine: id, stato: 'terminato', ordine_immesso_il: '2026-06-01T08:00:00Z', trasporto_iniziato_il: '2026-06-02T08:00:00Z', trasporto_finito_il: '2026-06-02T10:00:00Z', ...extra });
const elenco = [
  riga('OK1'),                                                   // a posto
  riga('SF1', { numero_fir: 'F1', trasporto_finito_il: null }),   // senza fine trasporto
  riga('SF1', { numero_fir: 'F2', trasporto_finito_il: null }),   // stesso ordine, altra riga
  riga('SI1', { trasporto_iniziato_il: null }),                   // del periodo, senza inizio
  riga('INC1', { trasporto_iniziato_il: '2026-06-10T08:00:00Z', trasporto_finito_il: '2026-06-08T10:00:00Z' }),
  { ...riga('', { numero_fir: 'SOLOFIR', trasporto_finito_il: null }), id_ordine: '' },
  { ...riga('', { trasporto_finito_il: null }), id_ordine: '', numero_fir: '' },
  { id_ordine: 'AP1', stato: 'assegnato' },                       // non terminato: non si segnala
];
const av = riepilogoAvviso(elenco);
verifica('conta ordini distinti, non righe', av.quanti === 5, JSON.stringify({ quanti: av.quanti, ordini: av.ordini.map(o => o.chiave) }));
verifica('senza id vale il numero del formulario; senza nessuno dei due la riga conta per se\'', av.ordini.some(o => o.chiave === 'FIR:SOLOFIR') && av.ordini.some(o => o.chiave.startsWith('RIGA:')));
verifica('le due quote separate: i senza fine trasporto e quelli dell\'elenco', av.senza_fine_trasporto === 3 && av.nel_periodo === 2, JSON.stringify(av.perimetro));
verifica('il perimetro si scrive', av.perimetro === '3 senza fine trasporto, di qualunque anno e fuori da ogni filtro di periodo, e 2 fra quelli che l\'elenco mostra', av.perimetro);
verifica('il dettaglio conta ordini, non righe, nell\'ordine delle date obbligatorie', av.dettaglio === '1 senza inizio trasporto, 3 senza fine trasporto, 1 con date incoerenti', av.dettaglio);
const soloSenzaFine = riepilogoAvviso([riga('SF9', { trasporto_finito_il: null })]);
verifica('se sono tutti senza fine trasporto lo dice lo stesso', soloSenzaFine.perimetro === 'tutti senza fine trasporto, di qualunque anno e fuori da ogni filtro di periodo', soloSenzaFine.perimetro);
verifica('se sono tutti del periodo non si scrive un perimetro inutile', riepilogoAvviso([riga('SI9', { trasporto_iniziato_il: null })]).perimetro === '');
verifica('niente da sistemare: nessun numero', riepilogoAvviso([riga('OK9')]).quanti === 0 && riepilogoAvviso(null).quanti === 0);

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
