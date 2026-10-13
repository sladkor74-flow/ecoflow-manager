// IL SURPLUS HA UN COLORE SOLO, NELLE PAGINE E NEI PDF (13/10/2026).
//
// Richiesta dell'utente del 12/10/2026 sul surplus sulle tariffe: tutto «in
// modo ordinato, elegante e professionale nonché semplice a colpo d'occhio».
// La riga del surplus (il Fuel Surcharge) ha una forma sola in ogni pagina: la
// barretta e l'etichetta «Surplus» nel colore del token --eco-surplus di
// src/index.css (un indaco, chiaro e scuro col tema), il nome in corsivo
// (STILE_SURPLUS di src/lib/surplusVista.js). Nel giro del 13/10 la pagina e la
// scheda dell'extra raccolta l'avevano fatta con le classi indaco di Tailwind,
// un tono diverso e fuori dal tema; e il PDF del dettaglio dell'attiva
// (esportaTabella.js) riceveva il colore 'surplus' ma non lo conosceva, e
// scriveva la riga come le altre.
//
// Qui:
//   1. il token c'e', chiaro e scuro;
//   2. nessun file che mostra il surplus lo colora con le classi indaco, viola o
//      porpora di Tailwind (le eccezioni sono elencate col loro motivo, e una
//      che non serve piu' fa fallire la prova); la pagina e la scheda
//      dell'extra raccolta usano STILE_SURPLUS;
//   3. il PDF del dettaglio scrive la riga del surplus come i fogli della
//      passiva: testo indaco scuro in corsivo, fondo indaco chiaro, barra a
//      sinistra; le altre righe restano quelle di prima.
//
// node prove/surplusUnColore.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { caricaLibPagine } from './dati/libPagine.mjs';

const radice = fileURLToPath(new URL('../', import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const leggi = (p) => readFileSync(join(radice, p), 'utf8').replace(/\r/g, '');

console.log('1. IL TOKEN DEL SURPLUS, CHIARO E SCURO');
{
  const css = leggi('src/index.css');
  const valori = [...css.matchAll(/--eco-surplus:\s*([^;]+);/g)].map(m => m[1].trim());
  verifica('src/index.css definisce --eco-surplus per il tema chiaro e per quello scuro', valori.length >= 2 && new Set(valori).size >= 2, JSON.stringify(valori));
}

console.log('2. NESSUNA PAGINA DEL SURPLUS USA UN INDACO SUO');
{
  // Le classi di Tailwind che farebbero un secondo indaco (o un viola) accanto al token.
  const COLORE_SUO = /\b(?:bg|text|border|border-[lrtb]|ring|accent|fill|stroke|from|via|to|decoration|outline)-(?:indigo|violet|purple)-\d{2,3}\b/g;
  // Righe che usano quei colori per altro, col motivo. Una che non serve piu' fa
  // fallire la prova: l'elenco resta vero.
  const ALTRO = {
    // lo stato «approvata» del documento dell'attiva, di prima del surplus
    'src/components/fatturazione/AttivaDashboard.jsx': ["approvata: 'bg-purple-100 text-purple-700'"],
  };
  const tutti = [];
  const giro = (d) => { for (const n of readdirSync(join(radice, d))) { const p = join(d, n); if (statSync(join(radice, p)).isDirectory()) giro(p); else if (/\.(jsx?|tsx?)$/.test(n)) tutti.push(p.replace(/\\/g, '/')); } };
  giro('src');
  const delSurplus = tutti.filter(p => /surplus/i.test(leggi(p)));
  verifica('ci sono i file che mostrano il surplus (almeno le pagine dell\'extra raccolta, della passiva e delle tariffe)',
    ['src/pages/ExtraRaccolta.jsx', 'src/components/fatturazione/ExtraRaccoltaForm.jsx', 'src/components/fatturazione/PassivaSurplus.jsx', 'src/components/fatturazione/SurplusSezione.jsx'].every(f => delSurplus.includes(f)), delSurplus.length);
  const usate = new Set();
  for (const p of delSurplus) {
    const righe = leggi(p).split('\n');
    const fuori = righe.filter(r => (r.match(COLORE_SUO) || []).length && !(ALTRO[p] || []).some(a => { const c = r.includes(a); if (c) usate.add(`${p}|${a}`); return c; }));
    verifica(`${p}: il surplus prende il colore dal token, non da classi indaco, viola o porpora`, fuori.length === 0, fuori.map(r => r.trim().slice(0, 140)).join(' | '));
  }
  for (const [p, voci] of Object.entries(ALTRO)) for (const a of voci) verifica(`l'eccezione di ${p} serve ancora`, usate.has(`${p}|${a}`));
  const pagina = leggi('src/pages/ExtraRaccolta.jsx'), scheda = leggi('src/components/fatturazione/ExtraRaccoltaForm.jsx');
  verifica('la pagina dell\'extra raccolta compone il riquadro e il «di cui» con STILE_SURPLUS',
    /import \{ STILE_SURPLUS \} from '@\/lib\/surplusVista';/.test(pagina) && /const RIQUADRO_SURPLUS = `\$\{STILE_SURPLUS\.riquadro\} \$\{STILE_SURPLUS\.barretta\}`;/.test(pagina) && /const QUOTA_SURPLUS = STILE_SURPLUS\.diCui;/.test(pagina));
  verifica('la scheda dell\'intervento disegna la riga del surplus con STILE_SURPLUS (barretta, fondo, etichetta)',
    /import \{ STILE_SURPLUS \} from '@\/lib\/surplusVista';/.test(scheda) && /STILE_SURPLUS\.barretta\} \$\{STILE_SURPLUS\.fondo\}/.test(scheda) && /STILE_SURPLUS\.etichetta\}`\}>Surplus</.test(scheda));
}

console.log('3. IL PDF DEL DETTAGLIO: LA RIGA DEL SURPLUS COME NEI FOGLI DELLA PASSIVA');
{
  // Un jsPDF finto che registra i comandi: colore del testo, font, rettangoli e
  // testi, nell'ordine in cui la pagina li da'.
  globalThis.__comandi = [];
  const FINTO = `{ jsPDF: class {
    constructor() { this.pagine = 1; this.internal = { pageSize: { getWidth: () => 297, getHeight: () => 210 }, getNumberOfPages: () => this.pagine }; }
    splitTextToSize(t) { return [String(t)]; }
    getTextWidth(t) { return String(t).length; }
    getNumberOfPages() { return this.pagine; }
    addPage() { this.pagine++; }
    setPage() {}
    save() {}
    setFillColor(...c) { globalThis.__comandi.push(['riempi', c.join(',')]); }
    setTextColor(...c) { globalThis.__comandi.push(['colore', c.join(',')]); }
    setFont(f, s) { globalThis.__comandi.push(['font', s]); }
    rect(x, y, w, h, m) { globalThis.__comandi.push(['rett', w]); }
    roundedRect() {}
    setFontSize() {} setDrawColor() {} setLineWidth() {} line() {}
    text(t) { globalThis.__comandi.push(['testo', Array.isArray(t) ? t.join(' ') : String(t)]); }
  } }`;
  let esportaTabellaPdf = null;
  try {
    ({ esportaTabellaPdf } = await caricaLibPagine('lib/esportaTabella', [[/await import\('jspdf'\)/g, FINTO]]));
  } catch (e) { verifica('esportaTabella.js si carica', false, String(e && e.message).slice(0, 200)); }
  const colonne = [
    { titolo: 'Ordine', valore: r => r.ordine, tipo: 'testo' },
    { titolo: 'Totale', valore: r => r.totale, tipo: 'euro' },
  ];
  const righe = [
    { ordine: 'ET26000001', totale: 202 },
    { ordine: 'ET26000002', totale: 404 },
    { ordine: 'Fuel Surcharge', totale: 15, surplus: true },
  ];
  if (esportaTabellaPdf) {
    try {
      await esportaTabellaPdf({ nomeFile: 'prova', titolo: 'Prova', colonne, righe, colore: (r) => (r.surplus ? 'surplus' : null) });
    } catch (e) { verifica('il PDF si scrive', false, String(e && e.message).slice(0, 200)); }
  }
  const c = globalThis.__comandi;
  // lo stato (colore, font, ultimo riempimento) al momento di ogni testo
  const stati = [];
  let colore = '', font = '', riempi = [];
  for (const [k, v] of c) {
    if (k === 'colore') colore = v;
    else if (k === 'font') font = v;
    else if (k === 'riempi') riempi.push(v);
    else if (k === 'testo') stati.push({ testo: v, colore, font, riempi: [...riempi] });
  }
  const di = (t) => stati.find(s => s.testo === t) || {};
  const s = di('Fuel Surcharge'), f = di('ET26000002');
  verifica('la riga del surplus: testo indaco scuro (55,48,163) in corsivo', s.colore === '55,48,163' && s.font === 'italic', JSON.stringify(s));
  verifica('...sul fondo indaco chiaro (238,242,255) con la barra indaco (99,102,241)', (s.riempi || []).slice(-2).join(' | ') === '238,242,255 | 99,102,241', JSON.stringify((s.riempi || []).slice(-3)));
  verifica('...e il suo importo nello stesso colore', di('15,00 €').colore === '55,48,163' || stati.some(x => /15,00/.test(x.testo) && x.colore === '55,48,163'), JSON.stringify(stati.filter(x => /15,00/.test(x.testo))));
  verifica('le righe dei formulari restano quelle di prima: testo normale, colore del testo (30,41,59)', f.colore === '30,41,59' && f.font === 'normal' && di('ET26000001').colore === '30,41,59', JSON.stringify(f));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
