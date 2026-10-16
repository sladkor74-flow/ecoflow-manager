// LA SIMULAZIONE DEL MARGINE NELLA PAGINA, NEL PDF E NELL'EXCEL (16/10/2026).
//
// L'utente, 16/10/2026: simulare il margine della commessa al variare del costo
// €/t di SMOCO come raccoglitore, scritto a mano, «senza inficiare tutto il resto
// dei calcoli e della fatturazione», anche per mostrarlo al CEO di SMOCO. La
// regola e i conti stanno in src/lib/simulazioneMargine.js (la sua prova e'
// prove/simulazioneMargine.mjs); qui la sezione della scheda Margine
// (src/components/fatturazione/SimulazioneMargine.jsx, disegnata da
// MargineCommessa.jsx), i due file per il CEO (src/lib/simulazioneMargineExport.js)
// e la Guida:
//   a. la sezione disegnata con React vero, lato server: «SIMULAZIONE» e la frase
//      a video, tre canali separati e nessuna riga o riquadro che li somma (di
//      nessun numero dell'anno, per nessuna coppia di canali, e nessun numero
//      fuori dai riquadri dei canali), il mese senza prezzi «—» col perche',
//      pareggio e confronto, ogni numero dell'anno accanto alla sua etichetta,
//      numeri all'italiana; senza memoria del browser, con una memoria che
//      lancia, con l'ultimo valore ricordato e con una risposta senza la
//      raccolta di SMOCO;
//   b. MargineCommessa la disegna dentro il blocco dei dati, dopo le tabelle (nel
//      sorgente e montata col banco delle pagine), e prove/margine.mjs resta
//      verde; la sezione montata ricorda l'ultimo valore, la media degli esterni
//      va nel suo campo, e il PDF si prepara senza nessuna richiesta;
//   c. nessuna richiesta e nessuna scrittura: niente client, niente archivi,
//      niente storico; jspdf, SheetJS e il corredo dei PDF mai in testa;
//   d. il PDF vero (jspdf di node_modules): su ogni pagina «SIMULAZIONE», i
//      parametri, il giorno, «NON ENTRA NELLA FATTURAZIONE» e «Pagina x di N»;
//      ogni testo nei caratteri del PDF, titolo e sottotitolo che non si toccano,
//      nessuna cella oltre le tre righe, nessuna somma dei canali sulle pagine e
//      nelle note;
//   e. l'Excel riaperto con exceljs: i fogli Rete, ACI, Extra raccolta e Note,
//      «SIMULAZIONE» nella prima riga e nel piede di stampa, la riga d'avviso con
//      la frase, i numeri della regola, le celle che mancano vuote e mai 0,
//      nessuna somma dei canali in nessun foglio;
//   f. la Guida dice la simulazione e porta a /fatturazione?tab=margine;
//   g. nessuna larghezza oltre i 375 px del telefono;
//   h. sui dati veri dell'11/10/2026 (copia in ../dati-veri, fuori dal
//      repository; senza la copia la parte si salta e lo dice): la rete a
//      60 €/t fa 412.967,03 €, 23,2%, pareggio 251,20 €/t, media degli esterni
//      76,07 €/t, e il PDF e l'Excel veri passano le stesse verifiche.
// I moduli si caricano dentro un try: col codice di prima la prova fallisce
// nelle sue verifiche, non all'import. node prove/simulazioneMarginePagina.mjs
// (MOSTRA=1 stampa il testo dei PDF; SALVA=<cartella fuori dal repository>
// scrive i PDF e gli Excel per guardarli: quelli dei dati veri hanno i numeri veri)
import { build } from 'esbuild';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
const sezione = async (titolo, corpo) => {
  console.log(titolo);
  try { await corpo(); } catch (e) { ko++; console.log(`  FALLITA: ${titolo}: si ferma con un errore (${String(e && e.message).slice(0, 300)})`); if (process.env.TRACCIA) console.log(e.stack); }
};
// I file sono CRLF: le prove sul sorgente tolgono i \r.
const sorgente = (p) => (existsSync(qui('../' + p)) ? readFileSync(qui('../' + p), 'utf8').replace(/\r/g, '') : '');
const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const testoHtml = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&#x27;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const euroIt = (v) => { const [i, d] = Math.abs(v).toFixed(2).split('.'); return `${v < 0 ? '-' : ''}${i.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${d}`; };

// ─── I DATI COSTRUITI ───
// Gennaio-aprile 2026. Rete: SMOCO (interno) raccoglie 31 t, ALFA a 60 €/t e
// GAMMA a 80 €/t ne raccolgono 14. ACI: SMOCO e ALFA a febbraio; a marzo DELTA
// senza tariffa, quindi marzo e l'anno dell'ACI hanno il margine «—». Extra
// raccolta: un intervento di SMOCO a febbraio e uno di ALFA ad aprile.
const MARGINE = await import('../base44/shared/margine.ts');
const baseRiga = { stato: 'terminato', cer: '160103', classe: 'A' };
let n = 0;
const rete = (kg, giorno, chi) => ({ ...baseRiga, id: 'R' + (++n), id_ordine: 'ET' + n, numero_fir: 'F' + n, peso_effettivo: kg, ordine_immesso_il: giorno, trasporto_iniziato_il: giorno, trasporto_finito_il: giorno,
  trasportatore: chi, destinazione: 'BETA IMPIANTI', provincia: 'BA', tipo_destinazione: 'imp', automezzo: 'AA111AA' });
const aci = (kg, giorno, chi) => ({ ...rete(kg, giorno, chi), classe: 'C', regione: 'Puglia', peso_stimato: kg });
const intervento = (id, chi, giorno, kg, costo) => ({ id, stato: 'terminato', tipo_movimento: 'primaria', id_ordine: 'ER' + id, numero_fir: 'FIR ' + id, produttore: 'COMUNE DI PROVA', trasportatore: chi,
  destinazione: 'BETA IMPIANTI', tipo_destinazione: 'imp', provincia: 'BA', classe: 'P', cer: '160103', ordine_immesso_il: giorno, trasporto_iniziato_il: giorno, trasporto_finito_il: giorno,
  peso_effettivo: kg, prezzo_attivo_t: 250, costo_raccolta_t: costo, costo_trattamento_t: 90 });
const DATI = {
  reteAll: [
    rete(10000, '2026-01-12T09:00:00Z', 'SMOCO S.R.L.'), rete(5000, '2026-01-20T09:00:00Z', 'ALFA SRL'),
    rete(8000, '2026-02-10T09:00:00Z', 'SMOCO S.R.L.'), rete(4000, '2026-02-11T09:00:00Z', 'GAMMA SRL'),
    rete(6000, '2026-03-05T09:00:00Z', 'SMOCO S.R.L.'), rete(2000, '2026-03-06T09:00:00Z', 'GAMMA SRL'),
    rete(7000, '2026-04-07T09:00:00Z', 'SMOCO S.R.L.'), rete(3000, '2026-04-08T09:00:00Z', 'ALFA SRL'),
  ],
  aciAll: [aci(2000, '2026-02-12T09:00:00Z', 'SMOCO S.R.L.'), aci(1500, '2026-02-13T09:00:00Z', 'ALFA SRL'), aci(1200, '2026-03-12T09:00:00Z', 'SMOCO S.R.L.'), aci(800, '2026-03-13T09:00:00Z', 'DELTA SRL')],
  extraAll: [intervento('E1', 'SMOCO S.R.L.', '2026-02-03T08:00:00.000Z', 460, 100), intervento('E2', 'ALFA SRL', '2026-04-03T08:00:00.000Z', 400, 105)],
  secondarieAll: [],
  fornitori: [
    { ragione_sociale: 'SMOCO S.R.L.', stato: 'attivo', interno: true },
    { ragione_sociale: 'ALFA SRL', stato: 'attivo' }, { ragione_sociale: 'GAMMA SRL', stato: 'attivo' },
    { ragione_sociale: 'DELTA SRL', stato: 'attivo' }, { ragione_sociale: 'BETA IMPIANTI', stato: 'attivo' },
  ],
  tariffe: [
    { id: 'a1', direzione: 'ATTIVA', tipologia: 'RETE', cliente: 'ECOTYRE', valore: 202, unita_misura: '€/t', stato: 'attivo' },
    { id: 'a2', direzione: 'ATTIVA', tipologia: 'ACI', cliente: 'ECOTYRE', regione: 'Puglia', valore: 240, unita_misura: '€/t', stato: 'attivo' },
    { id: 'p1', direzione: 'PASSIVA', stato: 'attivo', prestazione: 'RACCOLTA', fornitore_nome: 'Alfa s.r.l.', tipologia: 'RETE', valore: 60, unita_misura: '€/t' },
    { id: 'p4', direzione: 'PASSIVA', stato: 'attivo', prestazione: 'RACCOLTA', fornitore_nome: 'Gamma srl', tipologia: 'RETE', valore: 80, unita_misura: '€/t' },
    { id: 'p2', direzione: 'PASSIVA', stato: 'attivo', prestazione: 'TRATTAMENTO', fornitore_nome: 'Beta Impianti', tipologia: 'RETE', valore: 80, unita_misura: '€/t' },
    { id: 'p3', direzione: 'PASSIVA', stato: 'attivo', prestazione: 'RACCOLTA', fornitore_nome: 'Alfa s.r.l.', tipologia: 'ACI', valore: 90, unita_misura: '€/t' },
    { id: 'p5', direzione: 'PASSIVA', stato: 'attivo', prestazione: 'TRATTAMENTO', fornitore_nome: 'Beta Impianti', tipologia: 'ACI', valore: 70, unita_misura: '€/t' },
  ],
};
// La risposta della funzione calcolaMargine: il calcolo e il momento del calcolo.
const DATA = { ...MARGINE.calcolaMargineAnno(DATI, 2026, 3), calcolato_il: '2026-10-16T08:30:00.000Z' };
const OGGI = '2026-10-16';
const PARAMETRI = { RETE: 60, ACI: 55, EXTRA_RACCOLTA: 70 };

// ─── IL PACCHETTO: LA REGOLA, LA SEZIONE, I FILE E IL CORREDO DEI PDF ───
// Un pacchetto solo, col client finto che non risponde a niente, jspdf vero e
// exceljs vero da node_modules; il PDF resta in memoria (doc.save diventa
// doc.output), come in prove/riepilogoSettimanale.mjs.
const jspdf = pathToFileURL(qui('../node_modules/jspdf/dist/jspdf.node.min.js')).href;
const exceljs = pathToFileURL(createRequire(import.meta.url).resolve('exceljs')).href;
const ESTENSIONI = ['', '.js', '.jsx', '.ts'];
const daAlias = (p) => { const base = qui('../src/' + p.slice(2)); return ESTENSIONI.map(e => base + e).find(f => existsSync(f) && /\.\w+$/.test(f)) || base; };
const INGRESSO = `
export * as REGOLA from ${J(qui('../src/lib/simulazioneMargine.js'))};
export * as FILE from ${J(qui('../src/lib/simulazioneMargineExport.js'))};
export { formatTonnellate, formatPercentuale } from ${J(qui('../src/lib/utils.js'))};
export { conCostiDiversi } from ${J(qui('../src/components/fatturazione/SimulazioneMargine.jsx'))};
export { esportaSezioniPdf } from ${J(qui('../src/lib/esportaTabella.js'))};
`;
if (typeof globalThis.window === 'undefined') globalThis.window = { self: 1, top: 1, matchMedia: () => ({ matches: false, addListener() {}, removeListener() {} }) };
const RICHIESTE = [];
globalThis.__RICHIESTE = RICHIESTE;
let L = null;
try {
  const p = await build({
    stdin: { contents: INGRESSO, resolveDir: qui('.'), loader: 'js' }, bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent',
    loader: { '.jsx': 'jsx', '.js': 'jsx' }, define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'alias', setup(b) {
      b.onResolve({ filter: /^@\/api\/base44Client$/ }, () => ({ path: 'client', namespace: 'finto' }));
      b.onLoad({ filter: /.*/, namespace: 'finto' }, () => ({ contents: 'const no = (n) => async () => { globalThis.__RICHIESTE.push(n); throw new Error("nessuna richiesta: " + n); }; export const base44 = { functions: { invoke: (n) => no(n)() }, auth: { me: no("auth") }, entities: new Proxy({}, { get: (_t, k) => ({ list: no(k), filter: no(k), create: no(k), update: no(k), delete: no(k) }) }) };', loader: 'js' }));
      b.onResolve({ filter: /^jspdf$/ }, () => ({ path: jspdf, external: true }));
      b.onResolve({ filter: /^exceljs$/ }, () => ({ path: exceljs, external: true }));
      b.onLoad({ filter: /esportaTabella\.js$/ }, (a) => ({ contents: readFileSync(a.path, 'utf8').replace(/doc\.save\(`\$\{nomeSicuro\(nomeFile\)\}\.pdf`\);/g, 'globalThis.__PDF = doc.output(); globalThis.__NOME_PDF = `${nomeSicuro(nomeFile)}.pdf`;'), loader: 'jsx' }));
      b.onResolve({ filter: /^@\// }, (a) => ({ path: daAlias(a.path) }));
    } }],
  });
  L = await import('data:text/javascript;base64,' + Buffer.from(p.outputFiles[0].text).toString('base64'));
} catch (e) { verifica('la regola, la sezione e i file si impacchettano', false, String(e && e.message).slice(0, 600)); }
const R = L ? L.REGOLA : null;
const F = L ? L.FILE : null;
// La simulazione come la prepara la sezione per i file: la regola, coi costi diversi.
const simDi = (data, parametri) => L.conCostiDiversi(R.simulaMargine(data, parametri), data);

// ─── LE SOMME DEI CANALI, PER CERCARLE (revisione del 16/10/2026) ───
// Rete, ACI ed Extra raccolta non si sommano mai. La prima guardia cercava solo
// tre somme a video (costo simulato, margine vero, t di SMOCO): una riga
// «Insieme» col margine simulato dei tre canali, a video o nel foglio Note
// dell'Excel, passava. Qui ogni numero dell'anno che si sommerebbe (le t, il
// ricavo, il costo simulato, il margine vero, il margine simulato e la sua
// percentuale), per ogni coppia di canali e per tutti e tre, scritto
// all'italiana e come lo scriverebbe JavaScript (`${somma}`): non deve
// comparire da nessuna parte, ne' a video ne' nei file. Entra solo una somma
// in cui ogni canale porta un numero diverso da zero: con uno zero la «somma»
// e' il numero di un canale solo, che si deve leggere.
const CAMPI_DA_NON_SOMMARE = [['tonnellate_smoco', 't'], ['tonnellate', 't'], ['ricavo', 'euro'], ['costo_simulato', 'euro'], ['margine_vero', 'euro'], ['margine_simulato', 'euro'], ['margine_simulato_pct', 'pct']];
const sommeDeiCanali = (sim) => {
  const out = [];
  for (const [campo, tipo] of CAMPI_DA_NON_SOMMARE) {
    for (const insieme of [[0, 1], [0, 2], [1, 2], [0, 1, 2]]) {
      const valori = insieme.map(i => sim.canali[i] && sim.canali[i].anno ? sim.canali[i].anno[campo] : null).filter(v => typeof v === 'number' && v !== 0);
      if (valori.length !== insieme.length) continue;
      const crudo = valori.reduce((s, v) => s + v, 0);
      const valore = tipo === 'pct' ? Math.round(crudo * 10) / 10 : Math.round(crudo * 100) / 100;
      const italiani = tipo === 'pct' ? [`${L.formatPercentuale(valore)}%`] : tipo === 't' ? [L.formatTonnellate(valore), euroIt(valore)] : [euroIt(valore)];
      const crudi = [String(crudo), String(valore), ...(tipo === 'pct' ? [] : [valore.toFixed(2)])].filter(s => s.replace(/\D/g, '').length >= 3);
      out.push({ campo, canali: insieme.map(i => sim.canali[i].canale).join('+'), valore, crudo, italiani: [...new Set(italiani)], crudi: [...new Set(crudi)], numero: tipo !== 'pct' });
    }
  }
  return out;
};
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Le somme dei canali che il testo contiene: all'italiana con i confini del numero, crude col confine davanti. */
const sommeNelTesto = (testo, sim) => sommeDeiCanali(sim).flatMap(s => [
  ...s.italiani.filter(x => new RegExp(`(?<![\\d.,])${esc(x)}(?!\\d)`).test(testo)),
  ...s.crudi.filter(x => new RegExp(`(?<![\\d.])${esc(x)}`).test(testo)),
].map(x => `${s.campo} ${s.canali}: ${x}`));
/** Il blocco HTML di un canale nella sezione (dal suo riquadro al riquadro dopo). */
const bloccoDi = (html, k) => {
  const i = html.indexOf(`id="simulazione-${k}"`);
  const j = ['RETE', 'ACI', 'EXTRA_RACCOLTA'].map(x => html.indexOf(`id="simulazione-${x}"`)).filter(x => x > i).sort((a, b) => a - b)[0];
  return i < 0 ? '' : html.slice(html.lastIndexOf('<', i), j === undefined ? undefined : html.lastIndexOf('<', j));
};
/**
 * I numeri a video fuori dai riquadri dei canali: tolti i parametri, il periodo
 * e il giorno del margine non ne deve restare nessuno, perche' un numero che non
 * sta nel riquadro di un canale sarebbe di piu' canali insieme.
 */
const numeriFuoriDaiCanali = (html, sim) => {
  const i = html.indexOf('id="simulazione-RETE"');
  const fuori = testoHtml(i < 0 ? html : html.slice(0, html.lastIndexOf('<', i)));
  return fuori.split(R.testoParametri(sim.parametri)).join(' ').replace(/\d{2}\/\d{2}\/\d{4}/g, ' ').replace(new RegExp(`\\b${sim.anno}\\b`, 'g'), ' ').match(/\d[\d.,]*/g) || [];
};
/**
 * I sei numeri dell'anno di un canale, ciascuno con la sua etichetta, come si
 * leggono nel riquadro: un numero giusto scritto altrove (nella frase, nella
 * tabella) non basta, deve essere quello accanto all'etichetta.
 */
const numeriDelRiquadro = (c) => {
  const a = c.anno;
  const soldi = (v) => (v === null ? '—' : `€ ${R.scriviEuro(v)}`);
  const pct = (v) => `${L.formatPercentuale(v)}% del ricavo`;
  return [
    `Raccolte da SMOCO ${a.tonnellate_smoco === null ? '—' : `${L.formatTonnellate(a.tonnellate_smoco)} t`}`,
    `Costo simulato ${soldi(a.costo_simulato)}`,
    `Margine vero ${soldi(a.margine_vero)} ${a.margine_vero === null ? a.perche : pct(a.margine_vero_pct)}`,
    `Margine simulato ${soldi(a.margine_simulato)} ${a.margine_simulato === null ? (a.perche || 'serve il costo €/t di SMOCO') : `${pct(a.margine_simulato_pct)} · ${R.scriviEuroT(a.margine_simulato_t)}`}`,
    `Costo di pareggio ${R.scriviEuroT(c.pareggio.euro_t)} ${c.pareggio.testo}`,
    `Media dei raccoglitori esterni ${R.scriviEuroT(c.confronto.euro_t_esterni)} ${c.confronto.testo}`,
  ];
};

let disegna = null;
try {
  const { disegnaComponente } = await import('./dati/disegnaComponente.mjs');
  disegna = await disegnaComponente('src/components/fatturazione/SimulazioneMargine.jsx');
} catch (e) { verifica('la sezione si impacchetta per essere disegnata', false, String(e && e.message).slice(0, 400)); }

// La memoria del browser: nessuna, una che lancia, una che ricorda. Con un
// corpo asincrono la memoria resta finche' il corpo non ha finito.
const conMemoria = (memoria, f) => {
  const prima = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  if (memoria === 'lancia') Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError: accesso negato'); } });
  else if (memoria) Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: memoria });
  else delete globalThis.localStorage;
  const rimetti = () => { if (prima) Object.defineProperty(globalThis, 'localStorage', prima); else delete globalThis.localStorage; };
  let esito;
  try { esito = f(); } catch (e) { rimetti(); throw e; }
  if (esito && typeof esito.then === 'function') return esito.finally(rimetti);
  rimetti();
  return esito;
};
const memoriaFinta = (iniziale = {}) => { const m = new Map(Object.entries(iniziale)); return { scritte: [], getItem: (k) => (m.has(k) ? m.get(k) : null), setItem(k, v) { this.scritte.push([k, v]); m.set(k, String(v)); }, removeItem: (k) => m.delete(k), leggi: (k) => m.get(k) }; };

// ─────────────────────────────────────────────────────────────────────────────
await sezione('a. LA SEZIONE DISEGNATA: SIMULAZIONE, TRE CANALI, IL «—» COL PERCHE\'', async () => {
  if (!disegna || !R) throw new Error('la sezione o la regola non si sono caricate');
  const senza = conMemoria(null, () => disegna({ data: DATA }));
  const lancia = conMemoria('lancia', () => disegna({ data: DATA }));
  const t0 = testoHtml(senza);
  verifica('senza memoria del browser la sezione c\'e\', con «SIMULAZIONE» e la frase', t0.includes('SIMULAZIONE') && t0.includes(R.FRASE_SIMULAZIONE) && t0.includes('Simulazione — il costo di SMOCO come raccoglitore'), t0.slice(0, 300));
  verifica('con una memoria che lancia la sezione e\' la stessa, senza errori', lancia === senza, `${lancia.length} / ${senza.length}`);
  verifica('senza costo scritto: «Scrivi il costo €/t di SMOCO per vedere il margine simulato», la casella del valore unico accesa', t0.includes('Scrivi il costo €/t di SMOCO per vedere il margine simulato') && /type="checkbox"[^>]*checked=""/.test(senza) && t0.includes('Lo stesso costo per i tre canali'));
  verifica('...un campo solo, coi decimali del telefono, il segnaposto e «€/t»', (senza.match(/inputMode="decimal"/g) || []).length === 1 && /placeholder="es\. 62,50"/.test(senza) && t0.includes('€/t'));
  verifica('...e i due file spenti finche\' non c\'e\' un costo', /<button[^>]*disabled=""[^>]*>(?:(?!<\/button>)[\s\S])*PDF della simulazione/.test(senza) && /<button[^>]*disabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Excel della simulazione/.test(senza));
  const vuota = R.simulaMargine(DATA, { RETE: null, ACI: null, EXTRA_RACCOLTA: null });
  const reteV = vuota.canali[0];
  verifica('senza costo si vedono lo stesso le t di SMOCO, il margine vero, il pareggio e la media degli esterni', t0.includes(`${euroIt(reteV.anno.tonnellate_smoco)} t`) && t0.includes(`€ ${R.scriviEuro(reteV.anno.margine_vero)}`)
    && t0.includes(reteV.pareggio.testo) && t0.includes(R.scriviEuroT(reteV.confronto.euro_t_esterni)), t0.slice(0, 600));

  // L'ultimo valore ricordato: 60 €/t per la rete, 55 per l'ACI, 70 per l'extra.
  const memoria = memoriaFinta({ [R.CHIAVE_MEMORIA_SIMULAZIONE]: J({ uguali: false, unico: '', RETE: '60', ACI: '55', EXTRA_RACCOLTA: '70' }) });
  const html = conMemoria(memoria, () => disegna({ data: DATA }));
  const t = testoHtml(html);
  const sim = simDi(DATA, PARAMETRI);
  const blocco = (k) => bloccoDi(html, k);
  verifica('con l\'ultimo valore ricordato i tre campi lo riprendono, e la casella e\' spenta', (html.match(/inputMode="decimal"/g) || []).length === 3 && /value="60"/.test(html) && /value="55"/.test(html) && /value="70"/.test(html) && !/type="checkbox"[^>]*checked=""/.test(html));
  verifica('i tre canali, ciascuno nel suo riquadro, in ordine', ['RETE', 'ACI', 'EXTRA_RACCOLTA'].every(k => blocco(k)) && t.includes('Rete — 2026') && t.includes('ACI — 2026') && t.includes('Extra raccolta — 2026'));
  for (const c of sim.canali) {
    const b = testoHtml(blocco(c.canale));
    verifica(`${c.nome}: il margine simulato dell'anno della regola, con % ed €/t`, c.anno.margine_simulato === null ? b.includes(c.anno.perche) : (b.includes(`€ ${R.scriviEuro(c.anno.margine_simulato)}`) && b.includes(`${c.anno.margine_simulato_pct.toFixed(1).replace('.', ',')}% del ricavo`) && b.includes(R.scriviEuroT(c.anno.margine_simulato_t))), b.slice(0, 500));
    // Revisione del 16/10/2026: ogni numero dell'anno accanto alla sua
    // etichetta (un pareggio sbagliato nel riquadro passava, perche' la frase
    // e la tabella dei costi diversi avevano quello giusto).
    const riquadro = numeriDelRiquadro(c).filter(x => !b.includes(x));
    verifica(`${c.nome}: i sei numeri dell'anno, ognuno accanto alla sua etichetta (t di SMOCO, costo simulato, margine vero, margine simulato, pareggio, media degli esterni)`, riquadro.length === 0, J(riquadro) + ' | ' + b.slice(0, 700));
    verifica(`${c.nome}: il pareggio e il confronto, con le frasi della regola`, b.includes(c.pareggio.testo) && b.includes(c.confronto.testo), b.slice(0, 400));
    verifica(`${c.nome}: le note del canale`, (c.note || []).every(x => b.includes(x)), J(c.note));
    if (c.confronto.euro_t_esterni !== null) verifica(`${c.nome}: il pulsante «Usa la media degli esterni (${R.scriviEuroT(c.confronto.euro_t_esterni)})»`, b.includes(`Usa la media degli esterni (${R.scriviEuroT(c.confronto.euro_t_esterni)})`));
    verifica(`${c.nome}: la tabella del margine a costi diversi`, c.costi_diversi.length > 0 ? c.costi_diversi.every(r => b.includes(R.scriviEuroT(r.euro_t)) && (r.margine_simulato === null || b.includes(R.scriviEuro(r.margine_simulato)))) && b.includes('nel gestionale oggi') : true, J(c.costi_diversi));
    verifica(`${c.nome}: i raccoglitori esterni dentro un <details> chiuso`, /<details(?![^>]*\bopen\b)[^>]*>/.test(blocco(c.canale)) && c.esterni.every(e => b.includes(e.fornitore)));
  }
  // Il mese dell'ACI senza prezzi: margine vero e simulato «—», col perche'.
  const aciHtml = blocco('ACI');
  const marzo = (aciHtml.match(/<tr[^>]*>(?:(?!<\/tr>)[\s\S])*?Marzo[\s\S]*?<\/tr>/) || [''])[0];
  const celleMarzo = [...marzo.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => testoHtml(m[1]));
  const marzoSim = sim.canali[1].mesi[2];
  verifica('ACI marzo: prezzi mancanti, margine vero e simulato «—», col perche\' sotto il mese', marzoSim.margine_vero === null && marzoSim.perche && celleMarzo[0].includes(marzoSim.perche) && celleMarzo[3] === '—' && celleMarzo[4] === '—' && celleMarzo[5] === '—' && celleMarzo[2] === R.scriviEuro(marzoSim.costo_simulato), J(celleMarzo));
  verifica('ACI: anche l\'anno resta «—», e il pareggio dice perche\'', sim.canali[1].anno.margine_simulato === null && testoHtml(aciHtml).includes(sim.canali[1].pareggio.testo) && /non calcolabile/.test(sim.canali[1].pareggio.testo));
  // Nessuna riga o riquadro che somma i canali: nessun «totale», nessuna
  // somma di due o tre canali a video (anche del margine simulato e della sua
  // percentuale: revisione del 16/10/2026), e fuori dai riquadri dei canali
  // nessun numero oltre ai parametri, al periodo e al giorno.
  const somme = sommeNelTesto(t, sim);
  verifica('nessuna riga o riquadro che somma i canali: nessun «totale» e nessuna somma di due o tre canali a video', !/\btotal[ei]\b/i.test(t) && somme.length === 0 && sommeDeiCanali(sim).some(s => s.campo === 'margine_simulato'), J(somme));
  const fuori = numeriFuoriDaiCanali(html, sim);
  verifica('fuori dai riquadri dei canali nessun numero, tolti i parametri, il periodo e il giorno', fuori.length === 0, J(fuori));
  // La risposta di un calcolo senza la raccolta di SMOCO (la funzione di prima):
  // il margine vero c'e' ed e' giusto, e sotto ha la sua percentuale; la frase
  // della raccolta che manca la dice il margine simulato.
  const senzaRaccolta = JSON.parse(J(DATA));
  for (const c of senzaRaccolta.canali) { delete c.anno.raccolta; for (const m of c.mesi) delete m.raccolta; }
  const htmlSR = conMemoria(memoriaFinta({ [R.CHIAVE_MEMORIA_SIMULAZIONE]: J({ uguali: true, unico: '60' }) }), () => disegna({ data: senzaRaccolta }));
  const simSR = simDi(senzaRaccolta, { RETE: 60, ACI: 60, EXTRA_RACCOLTA: 60 });
  const reteSR = simSR.canali[0].anno;
  const bSR = testoHtml(bloccoDi(htmlSR, 'RETE'));
  verifica('senza la raccolta nella risposta: sotto il margine vero la sua percentuale, non la frase della raccolta', reteSR.margine_vero !== null && reteSR.perche !== '' && bSR.includes(`Margine vero € ${R.scriviEuro(reteSR.margine_vero)} ${L.formatPercentuale(reteSR.margine_vero_pct)}% del ricavo`) && !bSR.includes(`Margine vero € ${R.scriviEuro(reteSR.margine_vero)} ${reteSR.perche}`), bSR.slice(0, 600));
  verifica('...e il margine simulato «—» col perche\', le t di SMOCO «—»', bSR.includes(`Margine simulato — ${reteSR.perche}`) && bSR.includes('Raccolte da SMOCO —'), bSR.slice(0, 600));
  const malSR = simSR.canali.flatMap(c => numeriDelRiquadro(c).filter(x => !testoHtml(bloccoDi(htmlSR, c.canale)).includes(x)));
  verifica('...in tutti e tre i canali, ogni numero accanto alla sua etichetta', malSR.length === 0, J(malSR));
  verifica('numeri all\'italiana: niente decimali col punto, niente migliaia senza punto', !/\d\.\d{1,2}(?!\d)/.test(t.replace(/\d{2}\/\d{2}\/\d{4}/g, '')) && !/\b\d{5,}\b/.test(t) && t.includes('€ 2.670,00'), t.match(/\d\.\d{1,2}(?!\d)/g));
  verifica('i due file accesi col costo scritto', !/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>)[\s\S])*PDF della simulazione/.test(html) && !/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Excel della simulazione/.test(html));
  verifica('il periodo, il giorno del margine e i parametri in testa', t.includes(`Periodo: ${R.testoPeriodo(sim)}, per fine trasporto`) && t.includes('margine calcolato il 16/10/2026') && t.includes(R.testoParametri(sim.parametri)), t.slice(0, 500));
  verifica('senza data.canali la sezione non disegna niente', disegna({ data: {} }) === '' && disegna({ data: null }) === '');
  verifica('la sezione disegnata non ha chiesto niente al server', RICHIESTE.length === 0, J(RICHIESTE));
});

// ─────────────────────────────────────────────────────────────────────────────
await sezione('b. LA SCHEDA MARGINE DISEGNA LA SEZIONE DENTRO IL BLOCCO DEI DATI', async () => {
  const s = sorgente('src/components/fatturazione/MargineCommessa.jsx');
  const blocco = s.indexOf('{!loading && data && (');
  const tabelle = s.indexOf('<TabellaMargine c={c} />', blocco);
  const sim = s.indexOf('<SimulazioneMargine data={data} />');
  const fine = s.indexOf('\n      )}', blocco);
  verifica('l\'import statico della sezione', /^import SimulazioneMargine from '\.\/SimulazioneMargine';$/m.test(s));
  verifica('<SimulazioneMargine data={data} /> dentro {!loading && data && (...)}, dopo le tabelle dei canali', blocco > 0 && tabelle > blocco && sim > tabelle && fine > sim && (s.match(/<SimulazioneMargine\b/g) || []).length === 1, J({ blocco, tabelle, sim, fine }));
  verifica('il modulo dei file non si carica in testa alla scheda', !/simulazioneMargineExport/.test(s));

  // La scheda vera, col banco delle pagine: con i dati la sezione riceve la
  // risposta del margine, mentre carica e con un errore non c'e'.
  const { caricaPagina, clienteFinto, aspetta, trova, elementi, nomeDi } = await import('./dati/paginaFinta.mjs');
  const pagina = await caricaPagina('components/fatturazione/MargineCommessa');
  const monta = async (funzioni) => {
    const c = clienteFinto({ funzioni });
    globalThis.__CLIENTE_FINTO = c.cliente;
    const r = pagina.monta(pagina.Componente, {});
    const primo = trova(r.albero, 'SimulazioneMargine').length;
    await aspetta(30);
    const tutti = [...elementi(r.albero)].map(nomeDi);
    r.smonta();
    return { r, c, primo, tutti, sezioni: trova(r.albero, 'SimulazioneMargine') };
  };
  const conDati = await monta({ calcolaMargine: async () => DATA });
  verifica('mentre carica la sezione non c\'e\'', conDati.primo === 0);
  verifica('coi dati c\'e\' una volta, con la risposta del margine', conDati.sezioni.length === 1 && conDati.sezioni[0].props.data === DATA, String(conDati.sezioni.length));
  verifica('...dopo le tre tabelle dei canali', conDati.tutti.lastIndexOf('TabellaMargine') >= 0 && conDati.tutti.indexOf('SimulazioneMargine') > conDati.tutti.lastIndexOf('TabellaMargine') && conDati.tutti.filter(x => x === 'TabellaMargine').length === 3, J(conDati.tutti.filter(x => /Tabella|Simulazione|Scheda/.test(x))));
  verifica('...e la scheda fa la sua sola richiesta, il margine', conDati.c.chiamate.length === 1 && conDati.c.chiamate[0].nome === 'calcolaMargine', J(conDati.c.chiamate));
  const conErrore = await monta({ calcolaMargine: async () => { throw new Error('non raggiungibile'); } });
  verifica('con un errore del margine la sezione non c\'e\'', conErrore.sezioni.length === 0);

  // La sezione montata (hook e effetti veri, figli finti): ricorda l'ultimo
  // valore nel browser e da nessun'altra parte, la media degli esterni va nel
  // suo campo, il PDF si prepara senza richieste.
  const sp = await caricaPagina('components/fatturazione/SimulazioneMargine');
  const memoria = memoriaFinta();
  await conMemoria(memoria, async () => {
    const c = clienteFinto({});
    globalThis.__CLIENTE_FINTO = c.cliente;
    const r = sp.monta(sp.Componente, { data: DATA });
    await aspetta(10);
    const campi = () => trova(r.albero, 'CampoEuroT');
    const canali = () => trova(r.albero, 'CanaleSimulato');
    const pdf = () => trova(r.albero, 'EsportaPdf')[0];
    verifica('montata: un campo solo, i tre canali, il PDF spento', campi().length === 1 && canali().length === 3 && pdf() && pdf().props.disabilitato === true && pdf().props.etichetta === 'PDF della simulazione');
    campi()[0].props.onCambia('60');
    await aspetta(10);
    const ricordato = JSON.parse(memoria.leggi(R.CHIAVE_MEMORIA_SIMULAZIONE) || '{}');
    verifica('scrivere 60 lo ricorda nel browser, con la sua chiave e basta', ricordato.unico === '60' && ricordato.uguali === true && memoria.scritte.every(([k]) => k === R.CHIAVE_MEMORIA_SIMULAZIONE), J(memoria.scritte));
    const atteso = simDi(DATA, { RETE: 60, ACI: 60, EXTRA_RACCOLTA: 60 });
    verifica('...e i tre canali hanno la simulazione della regola a 60,00 €/t', canali().every((el, i) => el.props.c.euro_t === 60 && J(el.props.c) === J(atteso.canali[i])), J(canali().map(el => el.props.c.anno.margine_simulato)));
    verifica('...il PDF si accende', pdf().props.disabilitato === false);
    const reteEl = canali()[0];
    const media = reteEl.props.c.confronto.euro_t_esterni;
    reteEl.props.onUsaMedia('RETE', media);
    await aspetta(10);
    const tre = campi();
    verifica(`«Usa la media degli esterni»: il valore unico si spegne, la rete prende ${R.scriviEuroT(media)}, ACI ed extra tengono 60`, tre.length === 3 && tre.map(x => x.props.valore).join('|') === `${euroIt(media)}|60|60` && canali()[0].props.c.euro_t === media && canali()[1].props.c.euro_t === 60, J(tre.map(x => x.props.valore)));
    const argomenti = await pdf().props.sezioni();
    verifica('il PDF si prepara dalla simulazione a video, con «SIMULAZIONE» nel titolo', argomenti && /^SIMULAZIONE/.test(argomenti.titolo) && argomenti.sottotitolo === R.testoParametri({ RETE: media, ACI: 60, EXTRA_RACCOLTA: 60 }), argomenti && argomenti.titolo);
    verifica('la sezione montata non ha fatto nessuna richiesta e nessuna scrittura', c.chiamate.length === 0, J(c.chiamate));
    r.smonta();
  });

  // prove/margine.mjs resta verde con la sezione dentro la scheda.
  const margine = spawnSync(process.execPath, [qui('margine.mjs')], { encoding: 'utf8', cwd: qui('..') });
  verifica('prove/margine.mjs resta verde', margine.status === 0, (margine.stdout || '').split('\n').filter(x => /FALLITA|verifiche/.test(x)).slice(0, 5).join(' | ') + (margine.stderr || '').slice(0, 300));
});

// ─────────────────────────────────────────────────────────────────────────────
await sezione('c. NESSUNA RICHIESTA, NESSUNA SCRITTURA, NIENTE LIBRERIE PESANTI IN TESTA', async () => {
  const sez = sorgente('src/components/fatturazione/SimulazioneMargine.jsx');
  const fil = sorgente('src/lib/simulazioneMargineExport.js');
  verifica('i due file ci sono', sez.length > 0 && fil.length > 0);
  for (const [nome, s] of [['SimulazioneMargine.jsx', sez], ['simulazioneMargineExport.js', fil]]) {
    verifica(`${nome}: niente client, niente funzioni, niente archivi, niente storico`, !/base44|invoke|entities|scriviConTraccia/.test(s), (s.match(/base44|invoke|entities|scriviConTraccia/g) || []).join());
    const statici = s.split('\n').filter(r => /^import\b/.test(r.trim()));
    verifica(`${nome}: niente jspdf, SheetJS, exceljs o il corredo dei PDF in testa`, !statici.some(r => /from\s+['"](xlsx|jspdf|exceljs|@\/lib\/esportaTabella)['"]/.test(r)), statici.join(' | '));
  }
  verifica('la sezione carica i file solo al clic', !/^import .*simulazioneMargineExport/m.test(sez) && (sez.match(/await import\('@\/lib\/simulazioneMargineExport'\)/g) || []).length === 2);
  // Chiusura del giro del 16/10/2026: la libreria del riepilogo della settimana
  // (perIlPdf, pezziDellaCella) non si importa in testa da nessun file
  // (prove/riepilogoSettimanale.mjs, sezione 5): i file della simulazione la
  // prendono al clic, dentro argomentiSimulazionePdf, che e' asincrona.
  verifica('simulazioneMargineExport.js: la libreria del riepilogo si prende al clic, dentro argomentiSimulazionePdf asincrona, mai in testa', !/^import .*['"]@\/lib\/riepilogoSettimanale['"]/m.test(fil)
    && /export async function argomentiSimulazionePdf\([^]*?await import\('@\/lib\/riepilogoSettimanale'\)/.test(fil), (fil.match(/^.*riepilogoSettimanale.*$/gm) || []).join(' | '));
  verifica('la memoria del browser la tocca solo la regola: la sezione non nomina localStorage', !/localStorage|sessionStorage|indexedDB/.test(senzaCommenti(sez)));
  verifica('i conti li fa la regola: la sezione la importa e non ricalcola', /from '@\/lib\/simulazioneMargine'/.test(sez) && /simulaMargine\(data, parametri\)/.test(sez) && !/\*\s*c\.euro_t|tonnellate_smoco\s*\*/.test(senzaCommenti(sez)));
  verifica('i file usano il corredo: exceljs da fogliProfessionali, il PDF da esportaSezioniPdf', /from '@\/lib\/fogliProfessionali'/.test(fil) && /nuovaCartella|foglioDaRighe|foglioNote|documentoDa/.test(fil) && !/XLSX\./.test(fil));
});

// ─────────────────────────────────────────────────────────────────────────────
// I PDF E GLI EXCEL: prima di loro jspdf non deve trovare un window.
delete globalThis.window;
const WIN = { 0x80: '€', 0x95: '•', 0x96: '–', 0x97: '—' };
const testiDi = (flusso) => (String(flusso || '').match(/\((?:\\.|[^()\\])*\)\s*Tj/g) || [])
  .map(x => x.slice(1, x.lastIndexOf(')')).replace(/\\(\d{3})/g, (_, o) => { const c = parseInt(o, 8); return WIN[c] || String.fromCharCode(c); }).replace(/\\([()\\])/g, '$1').replace(/[\x80-\x9f]/g, (c) => WIN[c.charCodeAt(0)] || c));
/** Il PDF vero: le pagine (il testo di ciascuna), il nome e le righe in due byte. */
let salvati = 0;
const pdfDi = async (argomenti) => {
  globalThis.__PDF = null;
  await L.esportaSezioniPdf(argomenti);
  const pdf = String(globalThis.__PDF || '');
  const flussi = [...pdf.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].map(m => m[1]).filter(f => /Tj/.test(f));
  const pagine = flussi.map(f => testiDi(f).join(' ').replace(/\s+/g, ' '));
  if (process.env.MOSTRA) console.log(pagine.join('\n----\n'));
  if (process.env.SALVA) writeFileSync(join(process.env.SALVA, `${++salvati} ${globalThis.__NOME_PDF}`), pdf, 'latin1');
  return { pagine, quante: (pdf.match(/\/Type \/Page\b/g) || []).length, nome: globalThis.__NOME_PDF, dueByte: pdf.split('\n').filter(l => /Tj/.test(l) && /\x00/.test(l)) };
};
const WIN_ANSI_ALTI = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
const carattereDelPdf = (c) => { const k = c.charCodeAt(0); return c.length === 1 && ((k >= 0x20 && k <= 0x7e) || (k >= 0xa0 && k <= 0xff) || WIN_ANSI_ALTI.includes(c)); };
const testiDegliArgomenti = (a) => [a.intestazione, a.titolo, a.sottotitolo, a.titoloNote, a.documento.periodo, ...a.riepilogo.flatMap(r => [r.etichetta, r.valore]), ...a.sezioni.flatMap(s => [s.titolo, ...s.colonne.map(c => c.titolo), ...s.righe.flatMap(r => r.celle)]), ...a.note].filter(x => typeof x === 'string');
/** Quello che esportaSezioniPdf taglierebbe o sovrapporrebbe (come in prove/riepilogoSettimanale.mjs, sezione 7). */
const tagliDelPdf = (doc, a) => {
  const W = doc.internal.pageSize.getWidth(), M = 10;
  const tagli = [];
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
  if (doc.getTextWidth(a.intestazione) > W - 2 * M) tagli.push({ dove: 'intestazione', testo: a.intestazione });
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
  const testa = doc.getTextWidth(a.titolo);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  if (testa + doc.getTextWidth(a.sottotitolo || '') + 10 > W - 2 * M) tagli.push({ dove: 'titolo e sottotitolo si toccano', testo: `${a.titolo} | ${a.sottotitolo}` });
  const riquadro = (W - 2 * M) / a.riepilogo.length - 2 - 3;
  for (const r of a.riepilogo) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2);
    if (doc.getTextWidth(r.etichetta) > riquadro) tagli.push({ dove: 'riquadro', testo: r.etichetta });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    if (typeof r.valore === 'string' && doc.getTextWidth(r.valore) > riquadro) tagli.push({ dove: 'riquadro', testo: r.valore });
  }
  for (const s of a.sezioni) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    if (doc.getTextWidth(`${s.titolo} (segue)`) > W - 2 * M) tagli.push({ dove: 'titolo della sezione', testo: s.titolo });
    const tot = s.colonne.reduce((t, c) => t + (c.peso || 1), 0);
    const larg = s.colonne.map(c => ((W - 2 * M) * (c.peso || 1)) / tot);
    doc.setFontSize(7.2);
    s.colonne.forEach((c, i) => { if (doc.splitTextToSize(c.titolo, larg[i] - 3).length > 2) tagli.push({ dove: `${s.titolo}: titolo della colonna`, testo: c.titolo }); });
    for (const r of s.righe) {
      doc.setFont('helvetica', r.stile ? 'bold' : 'normal'); doc.setFontSize(7.4);
      r.celle.forEach((v, i) => {
        if (typeof v !== 'string' || !v) return;
        const righe = doc.splitTextToSize(v, larg[i] - 3);
        if (righe.length > 3) tagli.push({ dove: `${s.titolo} / ${s.colonne[i].titolo}`, righe: righe.length, perso: righe.slice(3).join(' ') });
      });
    }
  }
  return tagli;
};
/** Le verifiche di un PDF della simulazione, su ogni pagina. */
const verificaPdf = async (nome, sim, argomenti) => {
  const { jsPDF } = await import(jspdf);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pdf = await pdfDi(argomenti);
  const parametri = R.testoParametri(sim.parametri);
  const male = pdf.pagine.map((p, i) => ({ i: i + 1, manca: ['SIMULAZIONE', parametri, '16/10/2026', 'NON ENTRA NELLA FATTURAZIONE', `Pagina ${i + 1} di ${pdf.quante}`].filter(x => !p.includes(x)) })).filter(x => x.manca.length);
  verifica(`${nome}: piu' pagine, e su ognuna «SIMULAZIONE», i parametri, il giorno, «NON ENTRA NELLA FATTURAZIONE» e «Pagina x di N»`, pdf.quante >= 2 && pdf.pagine.length === pdf.quante && male.length === 0, J({ pagine: pdf.quante, flussi: pdf.pagine.length, male }));
  verifica(`${nome}: nessuna riga in due byte`, pdf.dueByte.length === 0, pdf.dueByte.slice(0, 2).map(l => J(l).slice(0, 120)).join(' | '));
  const fuori = testiDegliArgomenti(argomenti).flatMap(s => [...s].filter(c => !carattereDelPdf(c)));
  verifica(`${nome}: ogni testo (titolo, intestazione, sottotitolo, riepilogo, sezioni, note) nei caratteri del PDF`, fuori.length === 0, J([...new Set(fuori)]));
  const tagli = tagliDelPdf(doc, argomenti);
  verifica(`${nome}: titolo e sottotitolo non si toccano, nessun riquadro o titolo fuori misura, nessuna cella oltre le tre righe`, tagli.length === 0, J(tagli.slice(0, 3)));
  verifica(`${nome}: il nome del file comincia con «SIMULAZIONE margine ${sim.anno}» e dice il giorno`, /^SIMULAZIONE margine \d{4} - costo SMOCO .+ - 16-10-2026\.pdf$/.test(pdf.nome || ''), pdf.nome);
  // Mai un totale dei canali (revisione del 16/10/2026): ne' sulle pagine ne'
  // nelle note, ne' fra i testi che il PDF riceve.
  const somme = [...new Set([...sommeNelTesto(pdf.pagine.join(' '), sim), ...sommeNelTesto(testiDegliArgomenti(argomenti).join(' | '), sim), ...sommeNelTesto(argomenti.note.join(' | '), sim)])];
  verifica(`${nome}: nessuna somma di due o tre canali, sulle pagine e nelle note`, somme.length === 0, J(somme));
  return pdf;
};

await sezione('d. IL PDF VERO: SIMULAZIONE SU OGNI PAGINA, I CARATTERI, LE MISURE', async () => {
  if (!F) throw new Error('il modulo dei file non si e\' caricato');
  verifica('l\'intestazione: «SIMULAZIONE DEL gg/mm/aaaa · NON ENTRA NELLA FATTURAZIONE · SMOCO S.r.l. · COMMESSA ECOTYRE»', F.intestazioneSimulazione(OGGI) === 'SIMULAZIONE DEL 16/10/2026  ·  NON ENTRA NELLA FATTURAZIONE  ·  SMOCO S.r.l.  ·  COMMESSA ECOTYRE', F.intestazioneSimulazione(OGGI));
  verifica('gli archivi del «dati fino al»', J(F.ENTITA_SIMULAZIONE) === J(['PrimariaRete', 'PrimariaAci', 'Secondaria', 'ExtraRaccolta']));
  const sim = simDi(DATA, PARAMETRI);
  const stato = { letto: false, utente: 'Prova Rossi' };
  const a = await F.argomentiSimulazionePdf(sim, { oggi: OGGI, stato });
  verifica('titolo con «SIMULAZIONE» in testa, sottotitolo coi parametri, il periodo e lo stato passato', /^SIMULAZIONE/.test(a.titolo) && a.sottotitolo === R.testoParametri(sim.parametri) && a.documento.periodo === R.testoPeriodo(sim) && a.documento.stato === stato && !a.documento.entita, J([a.titolo, a.sottotitolo, a.documento]));
  const b = await F.argomentiSimulazionePdf(sim, { oggi: OGGI });
  verifica('senza stato il PDF chiede il «dati fino al» dei quattro archivi del margine', J(b.documento) === J({ periodo: R.testoPeriodo(sim), entita: F.ENTITA_SIMULAZIONE }), J(b.documento));
  verifica('un riquadro per canale, mai un totale', a.riepilogo.length === 3 && ['Rete', 'ACI', 'Extra raccolta'].every((x, i) => a.riepilogo[i].etichetta.startsWith(x)) && !a.riepilogo.some(r => /total/i.test(r.etichetta)), J(a.riepilogo));
  verifica('...col margine simulato della regola, «—» per l\'ACI senza prezzi', a.riepilogo[0].valore.includes(`${R.scriviEuro(sim.canali[0].anno.margine_simulato)} €`) && a.riepilogo[1].valore === '—', J(a.riepilogo));
  verifica('quattro sezioni per canale, ognuna col nome del suo canale in testa', a.sezioni.length === 12 && a.sezioni.every((s, i) => s.titolo.startsWith(['Rete', 'ACI', 'Extra raccolta'][Math.floor(i / 4)] + ' — ')), J(a.sezioni.map(s => s.titolo)));
  const mesiRete = a.sezioni[0];
  const annoRete = mesiRete.righe[mesiRete.righe.length - 1];
  verifica('la riga Anno della rete in stile «totale», coi numeri della regola', annoRete.stile === 'totale' && annoRete.celle[0] === 'Anno' && annoRete.celle[2] === sim.canali[0].anno.costo_simulato && annoRete.celle[4] === sim.canali[0].anno.margine_simulato && annoRete.celle[6] === R.scriviEuroT(sim.canali[0].anno.margine_simulato_t), J(annoRete));
  const marzoAci = a.sezioni[4].righe.find(r => r.celle[0] === 'Marzo');
  verifica('ACI marzo nel PDF: «—» dove manca il margine, mai 0, e il perche\' nella nota', marzoAci && marzoAci.celle[3] === '—' && marzoAci.celle[4] === '—' && marzoAci.celle[5] === '—' && marzoAci.celle[8].includes('margine non calcolabile'), J(marzoAci));
  verifica('nessun null o undefined nelle celle del PDF', a.sezioni.every(s => s.righe.every(r => r.celle.every(v => v !== null && v !== undefined))));
  verifica('le note: la frase, i parametri, il giorno del margine, come si leggono, le note dei canali col nome davanti', a.note[0] === R.FRASE_SIMULAZIONE && a.note.some(x => x.includes(R.testoParametri(sim.parametri))) && a.note.some(x => x.includes('calcolato il 16/10/2026'))
    && a.note.some(x => /^Costo di pareggio/.test(x)) && a.note.some(x => /^Confronto con i raccoglitori esterni/.test(x)) && sim.canali.every(c => c.note.every(x => a.note.includes(`${c.nome}: ${x}`))) && a.titoloNote === 'Come si legge questa simulazione', J(a.note.slice(0, 3)));
  const pdf = await verificaPdf('PDF dei dati costruiti', sim, a);
  const tutto = pdf.pagine.join(' ');
  verifica('nel PDF il margine simulato della rete e il pareggio scritti all\'italiana', tutto.includes(`${R.scriviEuro(sim.canali[0].anno.margine_simulato)} €`) && tutto.includes(R.scriviEuroT(sim.canali[0].pareggio.euro_t)), tutto.slice(0, 300));
  verifica('...il periodo per fine trasporto e lo stato «non disponibile» nella testa', tutto.includes(`Periodo: ${R.testoPeriodo(sim)}, per fine trasporto`) && tutto.includes('Dati fino al: non disponibile'));
  verifica('nessuna richiesta per il PDF con lo stato gia\' letto', RICHIESTE.length === 0, J(RICHIESTE));
});

// ─────────────────────────────────────────────────────────────────────────────
const verificaExcel = async (nome, sim, { wb, nomeFile }) => {
  const ExcelJS = (await import(exceljs)).default;
  const riletto = new ExcelJS.Workbook();
  const byte = await wb.xlsx.writeBuffer();
  if (process.env.SALVA) writeFileSync(join(process.env.SALVA, `${++salvati} ${nomeFile}`), Buffer.from(byte));
  await riletto.xlsx.load(byte);
  const fogli = riletto.worksheets.map(w => w.name);
  verifica(`${nome}: i fogli Rete, ACI, Extra raccolta e Note`, J(fogli) === J(['Rete', 'ACI', 'Extra raccolta', 'Note']), J(fogli));
  verifica(`${nome}: il nome del file`, /^SIMULAZIONE margine \d{4} - costo SMOCO .+ - 16-10-2026\.xlsx$/.test(nomeFile), nomeFile);
  for (const ws of riletto.worksheets) {
    verifica(`${nome}, ${ws.name}: «SIMULAZIONE» nella prima riga e nel piede di stampa`, /^SIMULAZIONE/.test(String(ws.getRow(1).getCell(1).value)) && /SIMULAZIONE/.test(ws.headerFooter.oddFooter || ''), `${ws.getRow(1).getCell(1).value} | ${ws.headerFooter.oddFooter}`);
    verifica(`${nome}, ${ws.name}: la seconda riga dice il giorno e «NON ENTRA NELLA FATTURAZIONE»`, String(ws.getRow(2).getCell(1).value).startsWith(F.intestazioneSimulazione(OGGI)), String(ws.getRow(2).getCell(1).value));
  }
  const righe = (ws) => { const out = []; ws.eachRow({ includeEmpty: true }, (r, i) => { out[i] = r; }); return out; };
  sim.canali.forEach((c) => {
    const ws = riletto.getWorksheet(c.nome);
    const tutte = righe(ws);
    const valori = (r) => (r ? r.values.slice(1) : []);
    const iAvviso = tutte.findIndex(r => r && r.getCell(1).value === R.FRASE_SIMULAZIONE);
    const primaDopoLaTesta = tutte.findIndex((r, i) => i > 2 && r && valori(r).every(v => v === null || v === undefined || v === '')) + 1;
    verifica(`${nome}, ${c.nome}: la prima riga dopo la testa e' la frase della simulazione, in evidenza`, iAvviso > 0 && iAvviso === primaDopoLaTesta && /FEF3C7/i.test(J(tutte[iAvviso].getCell(1).fill)), J({ iAvviso, primaDopoLaTesta }));
    verifica(`${nome}, ${c.nome}: il titolo del foglio col canale e il costo`, String(ws.getRow(1).getCell(1).value) === `SIMULAZIONE — Margine ${c.nome} ${sim.anno}, costo SMOCO ${c.euro_t === null ? 'non scritto' : R.scriviEuroT(c.euro_t)}`, String(ws.getRow(1).getCell(1).value));
    const iTestata = tutte.findIndex(r => r && r.getCell(1).value === 'Mese');
    const celle = (r) => [2, 3, 4, 5, 6, 7, 8].map(k => r.getCell(k).value);
    const atteso = (p) => [p.tonnellate_smoco, p.costo_simulato, p.margine_vero, p.margine_simulato, p.margine_simulato_pct, p.margine_simulato_t, p.euro_t_esterni];
    const sbagliati = [...c.mesi, c.anno].map((p, k) => ({ p, r: tutte[iTestata + 1 + k] })).filter(({ p, r }) => !r || r.getCell(1).value !== p.mese || J(celle(r)) !== J(atteso(p)));
    verifica(`${nome}, ${c.nome}: mese per mese e l'anno, i numeri della regola, le celle che mancano vuote`, iTestata > 0 && sbagliati.length === 0, J(sbagliati.slice(0, 2).map(({ p, r }) => [p.mese, r && celle(r), atteso(p)])));
    const rAnno = tutte[iTestata + 1 + c.mesi.length];
    verifica(`${nome}, ${c.nome}: la riga Anno in grassetto sul fondo chiaro (l'anno del canale)`, rAnno && rAnno.getCell(1).value === 'Anno' && rAnno.getCell(1).font && rAnno.getCell(1).font.bold === true && /E2EEF1/i.test(J(rAnno.getCell(1).fill)));
    // I formati stanno sulle celle coi numeri: una cella vuota non ne ha.
    const formati = { 2: '#,##0.00#', 3: '#,##0.00', 4: '#,##0.00', 5: '#,##0.00', 6: '#,##0.0', 7: '#,##0.00', 8: '#,##0.00' };
    const senzaFormato = [...c.mesi, c.anno].flatMap((p, k) => Object.entries(formati).filter(([col, f]) => { const cella = tutte[iTestata + 1 + k].getCell(Number(col)); return typeof cella.value === 'number' && cella.numFmt !== f; }).map(([col]) => `${p.mese}:${col}`));
    verifica(`${nome}, ${c.nome}: i formati dai titoli (tonnellate, euro, percentuale)`, rAnno.getCell(2).numFmt === '#,##0.00#' && senzaFormato.length === 0, J(senzaFormato));
    const iVoci = tutte.findIndex(r => r && r.getCell(1).value === 'Costo di pareggio');
    verifica(`${nome}, ${c.nome}: il pareggio come numero (o vuoto), con la frase della regola`, iVoci > 0 && tutte[iVoci].getCell(2).value === c.pareggio.euro_t && tutte[iVoci].getCell(3).value === '€/t' && tutte[iVoci].getCell(4).value === c.pareggio.testo, J(iVoci > 0 && valori(tutte[iVoci])));
    const iMedia = tutte.findIndex(r => r && r.getCell(1).value === 'Media dei raccoglitori esterni');
    verifica(`${nome}, ${c.nome}: la media degli esterni`, iMedia > 0 && tutte[iMedia].getCell(2).value === c.confronto.euro_t_esterni, J(iMedia > 0 && valori(tutte[iMedia])));
    // Dove la regola dice null la cella e' vuota, mai 0 (un margine vero di 0,00 in un mese vuoto e' un numero).
    const zeri = [...c.mesi, c.anno].flatMap((p, k) => atteso(p).map((v, j) => ({ v, cella: tutte[iTestata + 1 + k].getCell(j + 2).value, dove: `${p.mese}:${j + 2}` }))).filter(x => x.v === null && x.cella !== null);
    verifica(`${nome}, ${c.nome}: un valore che manca e' una cella vuota, mai 0`, zeri.length === 0, J(zeri.slice(0, 3)));
  });
  const note = riletto.getWorksheet('Note');
  const testoNote = [];
  note.eachRow(r => testoNote.push(r.values.slice(1).join(' ')));
  verifica(`${nome}: il foglio Note con la frase, i parametri e il periodo`, testoNote.some(x => x.includes(R.FRASE_SIMULAZIONE)) && testoNote.some(x => x.includes(R.testoParametri(sim.parametri))) && testoNote.some(x => x.includes(R.testoPeriodo(sim))), testoNote.slice(0, 6).join(' | '));
  // Mai un totale dei canali (revisione del 16/10/2026): in nessun foglio,
  // Note compreso, ne' come numero in una cella ne' scritto in un testo. Il
  // piede di stampa e' testo anche lui.
  const somme = sommeDeiCanali(sim);
  const trovate = [];
  for (const ws of riletto.worksheets) {
    ws.eachRow({ includeEmpty: false }, (r, i) => r.eachCell({ includeEmpty: false }, (cella, k) => {
      const v = cella.value && typeof cella.value === 'object' && 'richText' in cella.value ? cella.value.richText.map(x => x.text).join('') : cella.value;
      if (typeof v === 'number') somme.filter(s => s.numero && (v === s.valore || v === s.crudo)).forEach(s => trovate.push(`${ws.name}!${i}:${k} ${s.campo} ${s.canali} = ${v}`));
      else if (typeof v === 'string') sommeNelTesto(v, sim).forEach(x => trovate.push(`${ws.name}!${i}:${k} ${x}`));
    }));
    sommeNelTesto(`${ws.headerFooter.oddHeader || ''} ${ws.headerFooter.oddFooter || ''}`, sim).forEach(x => trovate.push(`${ws.name} piede: ${x}`));
  }
  verifica(`${nome}: nessuna somma di due o tre canali in nessun foglio, Note compreso`, trovate.length === 0 && somme.length > 0, J(trovate.slice(0, 4)));
  return riletto;
};

await sezione('e. L\'EXCEL RIAPERTO CON EXCELJS: SIMULAZIONE, LA FRASE, I NUMERI DELLA REGOLA', async () => {
  if (!F) throw new Error('il modulo dei file non si e\' caricato');
  const sim = simDi(DATA, PARAMETRI);
  const cartella = await F.cartellaSimulazione(sim, { oggi: OGGI, stato: { letto: false, utente: 'prova' } });
  const riletto = await verificaExcel('Excel dei dati costruiti', sim, cartella);
  const aci = riletto.getWorksheet('ACI');
  let marzo = null;
  aci.eachRow(r => { if (r.getCell(1).value === 'Marzo' && !marzo) marzo = r; });
  verifica('ACI marzo nell\'Excel: margine vero e simulato vuoti, il perche\' nella nota', marzo && marzo.getCell(4).value === null && marzo.getCell(5).value === null && /margine non calcolabile/.test(String(marzo.getCell(9).value)), J(marzo && marzo.values));
  // Un canale senza costo scritto: il titolo lo dice, le celle simulate vuote.
  const parziale = simDi(DATA, { RETE: 60, ACI: null, EXTRA_RACCOLTA: null });
  await verificaExcel('Excel con la sola rete', parziale, await F.cartellaSimulazione(parziale, { oggi: OGGI, stato: { letto: false, utente: 'prova' } }));
  verifica('nessuna richiesta per l\'Excel con lo stato gia\' letto', RICHIESTE.length === 0, J(RICHIESTE));
  // Senza stato, una lettura sola per tutto il file (qui il client non risponde, e il file lo dice).
  RICHIESTE.length = 0;
  const senzaStato = await F.cartellaSimulazione(sim, { oggi: OGGI });
  verifica('senza stato il «dati fino al» si chiede una volta sola per tutti i fogli', RICHIESTE.filter(x => x === 'datiFinoAl').length === 1 && senzaStato.wb.worksheets.length === 4, J(RICHIESTE));
  RICHIESTE.length = 0;
});

// ─────────────────────────────────────────────────────────────────────────────
await sezione('f. LA GUIDA DICE LA SIMULAZIONE E PORTA AL MARGINE', async () => {
  const G = await import('../src/lib/guida.js');
  const fatt = G.MODULI.find(m => m.percorso === '/fatturazione');
  const voce = (fatt.soloAmministratore || []).find(x => /Simulazione/.test(x)) || '';
  verifica('nel modulo Fatturazione, fra le cose dell\'amministratore, la Simulazione della scheda Margine', /scheda Margine/.test(voce) && /costo €\/t di SMOCO come raccoglitore/.test(voce) && /uno per canale o lo stesso per tutti/.test(voce), voce);
  verifica('...margine mese per mese, pareggio, confronto con la media degli esterni, PDF ed Excel', /mese per mese/.test(voce) && /pareggio/.test(voce) && /media dei raccoglitori esterni/.test(voce) && /PDF/.test(voce) && /Excel/.test(voce));
  verifica('...solo una prova: non si salva, non entra nella fatturazione ne\' in nessun conto, il browser ricorda l\'ultimo valore', /solo una prova/.test(voce) && /non si salva/.test(voce) && /non entra nella fatturazione/.test(voce) && /nessun conto/.test(voce) && /ricorda l’ultimo valore/.test(voce));
  verifica('le parole «simulazione» e «pareggio» per la ricerca', fatt.parole.includes('simulazione') && fatt.parole.includes('pareggio'));
  verifica('la ricerca «simulazione pareggio» trova il modulo', G.cercaNellaGuida('simulazione pareggio', 'admin').moduli.some(m => m.percorso === '/fatturazione'));
  const mese = G.SEZIONI.find(s => s.id === 'mese');
  const fatturazione = mese.gruppi.find(g => g.titolo === 'La fatturazione');
  const el = (fatturazione.elementi || []).find(e => e.link && e.link.percorso === '/fatturazione?tab=margine');
  verifica('nei passi dell\'amministratore, «La fatturazione», il collegamento «Margine» a /fatturazione?tab=margine', el && el.link.testo === 'Margine' && /Simulazione/.test(el.testo) && /non entra nella fatturazione/.test(el.testo), J(el));
  verifica('...ed e\' fra i collegamenti della guida', G.collegamentiDellaGuida().some(l => l.percorso === '/fatturazione?tab=margine'));
  const guida = spawnSync(process.execPath, [qui('guida.mjs')], { encoding: 'utf8', cwd: qui('..') });
  verifica('prove/guida.mjs resta verde (numeri all\'italiana, nessun riferimento esterno, collegamenti veri)', guida.status === 0, (guida.stdout || '').split('\n').filter(x => /FALLITA|verifiche/.test(x)).slice(0, 5).join(' | '));
});

// ─────────────────────────────────────────────────────────────────────────────
await sezione('g. SUL TELEFONO: NIENTE OLTRE I 375 PX', async () => {
  const s = senzaCommenti(sorgente('src/components/fatturazione/SimulazioneMargine.jsx'));
  const classi = [...s.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)].map(m => m[1] || m[2]).join(' ');
  verifica('le classi della sezione si leggono', classi.length > 200);
  verifica('nessuna larghezza fissa oltre il telefono', !/\b(min-)?w-\[\d{3,}(px|rem)?\]/.test(classi) && !/(^|\s)(min-)?w-(9[6-9]|[1-9]\d{2,})(\s|$)/.test(classi) && !/\bmin-w-(sm|md|lg|xl|\dxl)\b/.test(classi), (classi.match(/\b(min-)?w-\S+/g) || []).join(' '));
  verifica('le colonne: una sul telefono, tre da 640 px', (s.match(/grid grid-cols-1 sm:grid-cols-3/g) || []).length >= 2);
  verifica('ogni tabella dentro un contenitore che scorre di lato', (s.match(/<table/g) || []).length === 3 && (s.match(/overflow-x-auto/g) || []).length === 3 && /border rounded-lg overflow-x-auto/.test(s));
  verifica('i testi lunghi vanno a capo', (s.match(/break-words/g) || []).length >= 4);
});

// ─────────────────────────────────────────────────────────────────────────────
// I DATI VERI DELL'11/10/2026 (copia in ../dati-veri, fuori dal repository).
const CARTELLA = process.env.DATI_VERI || qui('../../dati-veri/');
const copie = existsSync(CARTELLA) ? readdirSync(CARTELLA).filter(x => /^treadrider-dati-veri-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(x)).sort() : [];
if (!copie.length) console.log(`h. Nessuna copia dei dati veri in ${CARTELLA}: parte saltata.`);
else {
  await sezione(`h. SUI DATI VERI (${copie[copie.length - 1]}): LA RETE A 60 €/T, IL PDF E L'EXCEL`, async () => {
    if (!R || !F) throw new Error('la regola o i file non si sono caricati');
    const A = JSON.parse(gunzipSync(readFileSync(CARTELLA + copie[copie.length - 1])).toString('utf8')).archivi;
    const veri = { reteAll: A.PrimariaRete, aciAll: A.PrimariaAci, extraAll: A.ExtraRaccolta, secondarieAll: A.Secondaria, fornitori: A.Fornitore, tariffe: A.Tariffa, surplusAll: A.SurplusTariffa || [] };
    const data = { ...MARGINE.calcolaMargineAnno(veri, 2026, 9), calcolato_il: '2026-10-11T10:00:00.000Z' };
    const sim = simDi(data, { RETE: 60, ACI: 60, EXTRA_RACCOLTA: 60 });
    const [r, a, x] = sim.canali;
    verifica('rete a 60 €/t: 2.159,86 t di SMOCO, costo simulato 129.591,60 €, margine simulato 412.967,03 € (23,2%, 46,83 €/t)', r.anno.tonnellate_smoco === 2159.86 && r.anno.costo_simulato === 129591.6 && r.anno.margine_simulato === 412967.03 && r.anno.margine_simulato_pct === 23.2 && r.anno.margine_simulato_t === 46.83, J(r.anno));
    verifica('rete: pareggio 251,20 €/t, media degli esterni 76,07 €/t', r.pareggio.euro_t === 251.2 && r.confronto.euro_t_esterni === 76.07, J([r.pareggio, r.confronto.euro_t_esterni]));
    verifica('ACI: pareggio 126,26 €/t, media 94,82 €/t; extra raccolta: pareggio 118,09 €/t, media 90,00 €/t', a.pareggio.euro_t === 126.26 && a.confronto.euro_t_esterni === 94.82 && x.pareggio.euro_t === 118.09 && x.confronto.euro_t_esterni === 90, J([a.pareggio.euro_t, a.confronto.euro_t_esterni, x.pareggio.euro_t, x.confronto.euro_t_esterni]));
    if (disegna) {
      const memoria = memoriaFinta({ [R.CHIAVE_MEMORIA_SIMULAZIONE]: J({ uguali: true, unico: '60', RETE: '', ACI: '', EXTRA_RACCOLTA: '' }) });
      globalThis.window = { self: 1, top: 1 };
      const html = conMemoria(memoria, () => disegna({ data }));
      const t = testoHtml(html);
      delete globalThis.window;
      verifica('a video, sui dati veri: «€ 412.967,03», «23,2% del ricavo», «251,20 €/t» e «Usa la media degli esterni (76,07 €/t)»', t.includes('€ 412.967,03') && t.includes('23,2% del ricavo') && t.includes('251,20 €/t') && t.includes('Usa la media degli esterni (76,07 €/t)'), t.slice(0, 300));
      // Revisione del 16/10/2026: i numeri accanto alle loro etichette, e
      // nessuna somma dei canali (anche del margine simulato e della sua %).
      const bRete = testoHtml(bloccoDi(html, 'RETE'));
      verifica('a video, sul riquadro della rete: «Costo di pareggio 251,20 €/t» e «Margine simulato € 412.967,03 23,2% del ricavo · 46,83 €/t»', bRete.includes('Costo di pareggio 251,20 €/t') && bRete.includes('Margine simulato € 412.967,03 23,2% del ricavo · 46,83 €/t') && bRete.includes('Media dei raccoglitori esterni 76,07 €/t'), bRete.slice(0, 600));
      const male = sim.canali.flatMap(c => numeriDelRiquadro(c).filter(x => !testoHtml(bloccoDi(html, c.canale)).includes(x)));
      verifica('a video, sui dati veri: in tutti e tre i canali ogni numero dell\'anno accanto alla sua etichetta', male.length === 0, J(male));
      const somme = sommeNelTesto(t, sim);
      verifica('a video, sui dati veri: nessuna somma di due o tre canali (t, ricavo, costo simulato, margine vero, margine simulato e la sua %)', somme.length === 0 && sommeDeiCanali(sim).filter(s => s.campo === 'margine_simulato' || s.campo === 'margine_simulato_pct').length === 8, J(somme));
      const fuori = numeriFuoriDaiCanali(html, sim);
      verifica('a video, sui dati veri: fuori dai riquadri dei canali nessun numero, tolti i parametri, il periodo e il giorno', fuori.length === 0, J(fuori));
    }
    const argomenti = await F.argomentiSimulazionePdf(sim, { oggi: OGGI, stato: { letto: false, utente: 'Prova Rossi' } });
    verifica('il giorno del margine si legge: «calcolato l\'11/10/2026», non «il 11/10/2026»', argomenti.note.some(x => x.includes('calcolato l\'11/10/2026')) && !argomenti.note.some(x => x.includes('il 11/10')), argomenti.note[2]);
    await verificaPdf('PDF dei dati veri', sim, argomenti);
    await verificaExcel('Excel dei dati veri', sim, await F.cartellaSimulazione(sim, { oggi: OGGI, stato: { letto: false, utente: 'prova' } }));
    verifica('sui dati veri nessuna richiesta', RICHIESTE.length === 0, J(RICHIESTE));
  });
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
