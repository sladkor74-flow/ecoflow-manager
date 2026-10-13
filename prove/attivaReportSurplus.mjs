// IL SURPLUS SULLE TARIFFE NELLE PAGINE DELL'ATTIVA E DEL MARGINE (13/10/2026).
//
// Richiesta dell'utente del 12/10/2026: in attiva come in passiva «una riga con
// l'importo standard ed una per il surplus (sempre riferito alle stesse
// tonnellate raccolte o trattate nel mese)», tutto «in modo ordinato, elegante e
// professionale nonché semplice a colpo d'occhio». Il primo caso e' il Fuel
// Surcharge del consorzio Ecotyre, +5 €/t dal 01/10/2026 al 31/12/2026.
//
// Il calcolo (attivaCalcolo.ts, margine.ts, prefattura.ts) fa gia' la riga del
// surplus; qui si prova come la mostrano le pagine, disegnate con React lato
// server sui dati veri dell'11/10/2026, con le tonnellate di settembre come
// esempio di un mese del Fuel Surcharge (lo si fa partire il 01/09):
//   1. src/lib/surplusVista.js, le parole e i conti comuni: la riga del surplus
//      si riconosce come la riconosce il calcolo, va in fondo, non si conta fra
//      le prestazioni ne' fra i chili, si scrive all'italiana;
//   2. il riepilogo (RiepilogoEcotyre.jsx): la scheda del canale dice la fattura
//      com'e', standard + Fuel Surcharge = totale (rete 226.288,48 + 5.601,20 =
//      231.889,68); il riscontro per servizio ha la riga del surplus con ordini e
//      chili fra parentesi; la riconciliazione non conta il surplus fra i
//      movimenti, su un mese chiuso dice quanto fatturare a parte, e quando sono
//      cambiati anche dei movimenti dice una strada sola (riaprire OPPURE
//      l'integrazione in due righe), perche' il surplus non si fatturi due volte;
//   3. il documento (AttivaDashboard.jsx) e il dettaglio (AttivaDetail.jsx):
//      380 prestazioni, non 381; la riga del surplus in fondo anche se il
//      documento la rilegge per prima; il file del dettaglio coi chili dei soli
//      formulari e il totale che comprende il surplus, e il PDF vero, in cui la
//      riga del surplus arriva intera (le tonnellate su cui si paga comprese);
//      un surplus che cambia importo a meta' mese: due righe, dette e distinte;
//   4. la scheda della riga (RigaDetailModal.jsx): «1.120,24 t del mese × 5,00
//      €/t», non «0 kg ÷ 1.000 × 5,00»;
//   5. la prefattura (PrefatturaEcotyre.jsx): il riquadro del surplus nelle forme
//      a (nel prezzo) e d (assente), e un ordine senza surplus;
//   6. il margine (MargineCommessa.jsx): +1.268,40 € sulla rete a settembre, la
//      colonna «di cui surplus», la ragione (le tonnellate di SMOCO), il foglio;
//   7. I TRE REPORT DELL'AMMINISTRAZIONE NON SI TOCCANO finche' l'utente non dice
//      come li vuole (domanda D3 del progetto): fatturazioneExport.js,
//      formatAmministrazione.js e formatAmministrazioneExport.js sono quelli del
//      13/10/2026 (l'impronta qui sotto), e sulle righe dei formulari (soloFormulari)
//      settembre fa ancora 380 righe, 1.120.240 kg e 226.288,48 € sulla rete, 6
//      righe, 18.890 kg e 4.410,10 € sull'ACI, con o senza il surplus. E sul
//      percorso vero: la pagina delle esportazioni (AttivaEsportazioni.jsx),
//      eseguita, passa ai quattro report le sole righe dei formulari.
// Senza surplus le pagine sono quelle di prima: nessuna parola, riga o colonna
// in piu'.
//
// node prove/attivaReportSurplus.mjs
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import * as attiva from '../base44/shared/attivaCalcolo.ts';
import { calcolaMargineAnno } from '../base44/shared/margine.ts';
import { confrontaPrefattura } from '../base44/shared/prefattura.ts';
import { caricaFunzione, chiama } from './dati/bancoFunzioni.mjs';
import { caricaLibPagine } from './dati/libPagine.mjs';
import { nomiImportati } from './dati/paginaFinta.mjs';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const testo = (p) => readFileSync(qui('../' + p), 'utf8').replace(/\r/g, '');
const uguali = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const somma = (righe, campo) => righe.reduce((s, r) => s + (Number(r[campo]) || 0), 0);
// il testo di una pagina disegnata, senza i tag e con gli spazi uniti
// le celle di una riga di tabella, come testo
const celle = (tr) => [...String(tr || '').matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => leggibile(m[1]));
const leggibile = (html) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

// ─── Le pagine, impacchettate con React lato server ───
const CLIENT_FINTO = 'export const base44 = { functions: { invoke: async () => ({ data: {} }) }, entities: new Proxy({}, { get: () => ({ list: async () => [], filter: async () => [] }) }) };';
const ESTENSIONI = ['', '.js', '.jsx', '.ts'];
const daAlias = (p) => { const base = qui('../src/' + p.slice(2)); return ESTENSIONI.map(e => base + e).find(existsSync) || base; };
const PAGINE = {
  Riepilogo: 'RiepilogoEcotyre', Dettaglio: 'AttivaDetail', Scheda: 'RigaDetailModal',
  Dashboard: 'AttivaDashboard', Prefattura: 'PrefatturaEcotyre', Margine: 'MargineCommessa',
};
const INGRESSO = `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
${Object.entries(PAGINE).map(([k, f]) => `import * as ${k} from ${JSON.stringify(qui(`../src/components/fatturazione/${f}.jsx`))};`).join('\n')}
export const moduli = { ${Object.keys(PAGINE).join(', ')} };
export const disegna = (C, props) => (C ? renderToStaticMarkup(React.createElement(C, props)) : '');
`;
let moduli = {}, disegna = () => '';
globalThis.window = globalThis.window || { self: 1, top: 1 };
try {
  const pacchetto = await build({
    stdin: { contents: INGRESSO, resolveDir: qui('.'), loader: 'js' },
    bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent',
    loader: { '.jsx': 'jsx', '.js': 'jsx' },
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'finti', setup(b) {
      b.onResolve({ filter: /^@\/api\/base44Client$/ }, () => ({ path: 'client', namespace: 'client-finto' }));
      b.onLoad({ filter: /.*/, namespace: 'client-finto' }, () => ({ contents: CLIENT_FINTO, loader: 'js' }));
      b.onResolve({ filter: /^@\// }, (args) => ({ path: daAlias(args.path) }));
    } }],
  });
  ({ moduli, disegna } = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64')));
} catch (e) { verifica('le pagine si impacchettano e si caricano', false, String(e && e.message).slice(0, 400)); }
// un componente che manca (le pagine di prima non lo esportano) disegna niente:
// le verifiche che lo usano falliscono una per una, col loro nome
const pezzo = (modulo, nome) => (moduli[modulo] || {})[nome] || null;
const vista = (modulo, nome, props) => { try { return leggibile(disegna(pezzo(modulo, nome), props)); } catch (e) { return `ERRORE ${e.message}`; } };
const html = (modulo, nome, props) => { try { return disegna(pezzo(modulo, nome), props); } catch (e) { return `ERRORE ${e.message}`; } };

// ─── La pagina delle esportazioni, eseguita davvero (parte 7) ───
// AttivaEsportazioni.jsx si esegue con un React piccolo e finto: i suoi hook e i
// suoi pulsanti, non i componenti figli. I quattro report (fatturazioneExport.js
// e formatAmministrazioneExport.js) diventano registratori: le righe che la
// pagina passa loro sono quelle che finirebbero nei file. Le librerie di src/lib
// restano vere, il client e' finto, i componenti e le icone sono finti.
const REACT_PICCOLO = `
let corrente = null;
export function useState(iniziale) {
  const s = corrente, i = s.indice++;
  if (!(i in s.valori)) s.valori[i] = typeof iniziale === 'function' ? iniziale() : iniziale;
  return [s.valori[i], (v) => { s.valori[i] = typeof v === 'function' ? v(s.valori[i]) : v; }];
}
export const useEffect = () => {};
export const useMemo = (f) => f();
export const useCallback = (f) => f;
export const useRef = (v) => ({ current: v });
export const Fragment = 'Fragment';
export function createElement(type, props, ...figli) { return { type, props: { ...(props || {}), children: figli.length === 1 ? figli[0] : figli } }; }
// il JSX automatico (jsconfig: react-jsx): i figli sono gia' nei props, la chiave a parte
export function jsx(type, props, key) { return { type, props: key === undefined ? { ...(props || {}) } : { ...(props || {}), key } }; }
export const jsxs = jsx;
export function esegui(C, props) { corrente = { indice: 0, valori: {} }; try { return C(props); } finally { corrente = null; } }
export default { useState, useEffect, useMemo, useCallback, useRef, Fragment, createElement };
`;
const registratore = (voci) => `const r = (formato) => async (tipologia, righe) => { globalThis.__RIGHE_AI_REPORT.push({ formato, tipologia, righe }); };\n${voci}`;
const MODULI_REGISTRATORI = {
  '@/lib/fatturazioneExport': registratore("export const exportFatturazioneAttiva = r('excel');\nexport const exportFatturazioneAttivaPdf = r('pdf');\nexport const nomeFileAttiva = (t, a, m, e) => `attiva ${t}.${e}`;"),
  '@/lib/formatAmministrazioneExport': registratore("export const exportAmministrazioneAttiva = r('amm-excel');\nexport const exportAmministrazioneAttivaPdf = r('amm-pdf');"),
  '@/lib/formatAmministrazione': 'export const nomeFileAmministrazione = (t, a, m, e) => `amministrazione ${t}.${e}`;',
};
const CLIENT_ESPORTAZIONI = 'export const base44 = { functions: { invoke: async () => ({ data: {} }) }, entities: new Proxy({}, { get: () => ({ list: async () => [], filter: async () => [] }) }), auth: { me: async () => ({}) } };';
const elementiDi = (x, out = []) => {
  if (Array.isArray(x)) { x.forEach(y => elementiDi(y, out)); return out; }
  if (x && typeof x === 'object' && x.props) { out.push(x); elementiDi(x.props.children, out); }
  return out;
};
const testoDi = (x) => (Array.isArray(x) ? x.map(testoDi).join('') : typeof x === 'string' || typeof x === 'number' ? String(x) : x && x.props ? testoDi(x.props.children) : '');
/**
 * Esegue la pagina delle esportazioni e preme, uno per volta, i pulsanti
 * [canale, testo]: per ciascuno le righe arrivate al report, o l'errore.
 */
async function righeDaiPulsanti(file, data, pulsanti) {
  let mod;
  try {
    const pacchetto = await build({
      stdin: { contents: `export { default as Pagina } from ${JSON.stringify(file)};\nexport { esegui } from 'react';\n`, resolveDir: qui('.'), loader: 'js' },
      bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent',
      loader: { '.jsx': 'jsx', '.js': 'jsx' }, define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [{ name: 'esportazioni', setup(b) {
        b.onResolve({ filter: /^react(\/jsx-runtime|\/jsx-dev-runtime)?$/ }, () => ({ path: 'react', namespace: 'piccolo' }));
        b.onResolve({ filter: /^@\/api\/base44Client$/ }, () => ({ path: 'client', namespace: 'piccolo' }));
        b.onResolve({ filter: /^@\/lib\/(fatturazioneExport|formatAmministrazioneExport|formatAmministrazione)$/ }, (a) => ({ path: a.path, namespace: 'piccolo' }));
        b.onResolve({ filter: /^(@\/components\/|lucide-react$)/ }, (a) => ({ path: `${a.path}|${a.importer}`, namespace: 'finto', pluginData: a }));
        b.onResolve({ filter: /^@\// }, (a) => ({ path: daAlias(a.path) }));
        b.onLoad({ filter: /.*/, namespace: 'piccolo' }, (a) => ({ contents: a.path === 'react' ? REACT_PICCOLO : a.path === 'client' ? CLIENT_ESPORTAZIONI : MODULI_REGISTRATORI[a.path], loader: 'js' }));
        b.onLoad({ filter: /.*/, namespace: 'finto' }, (a) => {
          const { nomi } = nomiImportati(readFileSync(a.pluginData.importer, 'utf8'), a.pluginData.path);
          return { contents: `const F = () => null;\nexport default F;\n${nomi.map(n => `export const ${n} = F;`).join('\n')}`, loader: 'js' };
        });
      } }],
    });
    mod = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
  } catch (e) {
    return pulsanti.map(([canale, pulsante]) => ({ canale, pulsante, errore: `la pagina non si carica: ${String(e && e.message).slice(0, 300)}` }));
  }
  const finestra = globalThis.window;
  globalThis.window = { ...(finestra || {}), confirm: () => true };
  const fatti = [];
  try {
    for (const [canale, pulsante] of pulsanti) {
      globalThis.__RIGHE_AI_REPORT = [];
      const albero = mod.esegui(mod.Pagina, { periodo: { anno: 2026, mese: 'Settembre' }, data, onReload: async () => {}, onVaiPrefattura: () => {} });
      const riquadro = elementiDi(albero).find(el => el.props.key === canale);
      const bottone = riquadro && elementiDi(riquadro).find(el => typeof el.props.onClick === 'function' && testoDi(el).trim() === pulsante);
      if (!bottone) { fatti.push({ canale, pulsante, errore: 'pulsante non trovato' }); continue; }
      try { await bottone.props.onClick(); } catch (e) { fatti.push({ canale, pulsante, errore: e.message }); continue; }
      const scritto = globalThis.__RIGHE_AI_REPORT[0];
      fatti.push({ canale, pulsante, righe: scritto ? scritto.righe : null, errore: scritto ? null : 'nessun report scritto' });
    }
  } finally {
    globalThis.window = finestra;
  }
  return fatti;
}

let V = {};
try { V = await caricaLibPagine('lib/surplusVista'); } catch (e) { verifica('src/lib/surplusVista.js si carica', false, String(e && e.message).slice(0, 200)); }
const vuoto = () => null;
const { eRigaSurplus = vuoto, soloFormulari = (r) => r, surplusInFondo = (r) => r, contiAttiva = () => ({}), tonnellateDaKg = vuoto, baseSurplus = vuoto,
  formulaSurplus = vuoto, dettaglioRigaSurplus = vuoto, righeAParole = vuoto, ordiniSurplusDaChiarire = () => [], STILE_SURPLUS = {},
  partiRigaSurplus = () => ({}), nomiVociSurplus = () => [], nomiSurplusDistinti = () => [], surplusPerNome = () => [], originiSurplus = () => [] } = V;

// ─── I dati veri ───
const CARTELLA = process.env.DATI_VERI || fileURLToPath(new URL('../../dati-veri/', import.meta.url));
const copie = existsSync(CARTELLA) ? readdirSync(CARTELLA).filter(n => /^treadrider-dati-veri-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n)).sort() : [];
const A = copie.length ? JSON.parse(gunzipSync(readFileSync(join(CARTELLA, copie[copie.length - 1]))).toString('utf8')).archivi : null;
// Il Fuel Surcharge com'e' (01/10-31/12) e lo stesso fatto partire il 01/09, per
// avere un mese intero di dati veri su cui guardarlo.
const fs = (tipologia, altro = {}) => ({
  id: 'fs-' + tipologia, gruppo: 'g-fs', nome: 'Fuel Surcharge', origine: 'CONSORZIO', riferimento: 'comunicazione Ecotyre',
  tipologia, prestazione: 'RACCOLTA', a_chi: 'tutti', euro_t_passiva: 5, euro_t_attiva: 5,
  data_inizio_validita: '2026-09-01', data_fine_validita: '2026-12-31', stato: 'attivo', ...altro,
});
const FUEL_SET = [fs('RETE'), fs('ACI'), fs('EXTRA_RACCOLTA')];

console.log('1. LE PAROLE E I CONTI COMUNI (src/lib/surplusVista.js)');
{
  const riga = { tipologia: 'RETE', descrizione: 'Fuel Surcharge', surplus_id: 'fs-RETE', origine_dato: 'SURPLUS', quantita: 0, kg_riferimento: 1120240, record_count: 380, tariffa_valore: 5, totale: 5601.2,
    note: 'Fuel Surcharge (consorzio Ecotyre), dal 01/10/2026 al 31/12/2026, sulle stesse 1.120,24 t del mese' };
  const formulario = { ordine: 'ET1', numero_fir: 'F1', quantita: 1940, tariffa_valore: 202, totale: 391.88, unita_misura: '€/t' };
  const corpo = { ordine: 'EX1', descrizione: 'Sovracosto raccolta', quantita: 0, unita_misura: '€ a corpo', totale: 120 };
  // la stessa regola del calcolo, che le pagine non possono importare
  const casi = [riga, formulario, corpo, { origine_dato: 'SURPLUS' }, { surplus_id: 'x' }, {}, null];
  verifica('eRigaSurplus dice quello che dice il calcolo', casi.every(c => !!eRigaSurplus(c) === !!attiva.eRigaSurplus(c)), JSON.stringify(casi.map(c => [!!eRigaSurplus(c), !!attiva.eRigaSurplus(c)])));
  verifica('la riga del surplus va in fondo, i formulari restano nel loro ordine', uguali(surplusInFondo([riga, formulario, corpo]), [formulario, corpo, riga]) && uguali(soloFormulari([riga, formulario, corpo]), [formulario, corpo]));
  const c = contiAttiva([riga, formulario, corpo, { ...formulario, ordine: 'ET2', sospesa: true }]);
  verifica('i conti: le prestazioni e i chili dei formulari, lo standard, il surplus, il totale (le sospese fuori)',
    c.formulari === 2 && c.kg === 1940 && c.standard === 511.88 && c.surplus === 5601.2 && c.totale === 6113.08, JSON.stringify(c));
  verifica('le tonnellate all\'italiana: due decimali, tre se i chili non sono tondi, «—» se mancano',
    tonnellateDaKg(1120240) === '1.120,24' && tonnellateDaKg(2309) === '2,309' && tonnellateDaKg(null) === '—' && tonnellateDaKg(0) === '0,00', [tonnellateDaKg(1120240), tonnellateDaKg(2309), tonnellateDaKg(null)].join(' | '));
  verifica('la base del surplus: «1.120,24 t × 5,00 €/t»', baseSurplus(1120240, 5) === '1.120,24 t × 5,00 €/t', String(baseSurplus(1120240, 5)));
  verifica('la formula: sulle tonnellate del mese, arrotondata una volta', formulaSurplus(riga) === '1.120,24 t del mese × 5,00 €/t = € 5.601,20, arrotondato una volta sul mese', String(formulaSurplus(riga)));
  verifica('da dove viene e quando vale, dalla nota del calcolo', dettaglioRigaSurplus(riga) === 'consorzio Ecotyre · dal 01/10/2026 al 31/12/2026', String(dettaglioRigaSurplus(riga)));
  verifica('una nota scritta in un altro modo resta com\'e\'', dettaglioRigaSurplus({ descrizione: 'Accordo', note: 'scritto a mano' }) === 'scritto a mano');
  verifica('le righe a parole', righeAParole([riga, formulario, corpo]) === '2 righe e la riga del Fuel Surcharge' && righeAParole([formulario]) === '1 riga', String(righeAParole([riga, formulario, corpo])));
  verifica('origine e periodo in pezzi, dalla nota del calcolo',
    uguali(partiRigaSurplus(riga), { origine: 'consorzio Ecotyre', periodo: 'dal 01/10/2026 al 31/12/2026', altro: [] })
    && uguali(partiRigaSurplus({ descrizione: 'Bonus', note: 'Bonus, fino al 31/12/2026, sulle stesse 5,00 t del mese' }), { origine: '', periodo: 'fino al 31/12/2026', altro: [] }), JSON.stringify(partiRigaSurplus(riga)));
  // Un surplus che cambia importo a meta' mese: due record con lo stesso nome,
  // due righe nel documento (revisione del 13/10/2026). Prima le pagine dicevano
  // «la riga del Fuel Surcharge» e due «Fuel Surcharge» uguali.
  const a5 = { ...riga, surplus_id: 'fs-a', tariffa_valore: 5, totale: 2831.05, kg_riferimento: 566210, note: 'Fuel Surcharge (consorzio Ecotyre), dal 01/09/2026 al 15/09/2026, sulle stesse 566,21 t del mese' };
  const a7 = { ...riga, surplus_id: 'fs-b', tariffa_valore: 7, totale: 3878.21, kg_riferimento: 554030, note: 'Fuel Surcharge (consorzio Ecotyre), dal 16/09/2026 al 31/12/2026, sulle stesse 554,03 t del mese' };
  verifica('due righe dello stesso surplus: «2 righe del Fuel Surcharge», non «la riga»', righeAParole([a5, a7, formulario, corpo]) === '2 righe e 2 righe del Fuel Surcharge'
    && righeAParole([riga, { ...riga, descrizione: 'Bonus' }, formulario]) === '1 riga, la riga del Bonus e la riga del Fuel Surcharge', `${righeAParole([a5, a7, formulario, corpo])} | ${righeAParole([riga, { ...riga, descrizione: 'Bonus' }, formulario])}`);
  verifica('...si distinguono dall\'importo, e dal periodo se l\'importo e\' lo stesso; un nome unico resta com\'e\'',
    uguali(nomiVociSurplus([a5, a7]), ['Fuel Surcharge a 5,00 €/t', 'Fuel Surcharge a 7,00 €/t']) && uguali(nomiVociSurplus([riga]), ['Fuel Surcharge'])
    && uguali(nomiVociSurplus([a5, { ...a7, tariffa_valore: 5 }]), ['Fuel Surcharge a 5,00 €/t, dal 01/09/2026 al 15/09/2026', 'Fuel Surcharge a 5,00 €/t, dal 16/09/2026 al 31/12/2026']),
    JSON.stringify([nomiVociSurplus([a5, a7]), nomiVociSurplus([a5, { ...a7, tariffa_valore: 5 }])]));
  const m5 = { nome: 'Fuel Surcharge', euro_t_attiva: 5, euro_t_passiva: 5, dal: '2026-09-01', al: '2026-09-15' };
  verifica('...e quelli del margine allo stesso modo (l\'importo incassato, o il pagato se manca)',
    uguali(nomiSurplusDistinti([m5, { ...m5, euro_t_attiva: 7, dal: '2026-09-16', al: '2026-12-31' }]), ['Fuel Surcharge a 5,00 €/t', 'Fuel Surcharge a 7,00 €/t'])
    && uguali(nomiSurplusDistinti([{ ...m5, euro_t_attiva: null }, { ...m5, euro_t_attiva: null, euro_t_passiva: 6 }]), ['Fuel Surcharge a 5,00 €/t', 'Fuel Surcharge a 6,00 €/t'])
    && uguali(nomiSurplusDistinti([m5]), ['Fuel Surcharge']), JSON.stringify(nomiSurplusDistinti([m5, { ...m5, euro_t_attiva: 7 }])));
  verifica('...stanno in fondo nell\'ordine delle date, anche se il documento le rilegge al contrario', uguali(surplusInFondo([a7, formulario, a5]), [formulario, a5, a7]));
  verifica('...e sotto un totale fanno un «di cui» solo, sommato in centesimi', uguali(surplusPerNome([a5, a7]), [{ nome: 'Fuel Surcharge', totale: 6709.26 }]), JSON.stringify(surplusPerNome([a5, a7])));
  verifica('le origini dei surplus, una volta sola', uguali(originiSurplus([a5, a7, formulario]), ['consorzio Ecotyre']) && uguali(originiSurplus([formulario]), []));
  const da = ordiniSurplusDaChiarire({ senza: [{ id_ordine: 'ET1', kg: 1000, atteso: 5 }], diversi: [{ id_ordine: 'ET2', kg: 2000, importo: 20, atteso: 10, righe: 2 }], in_piu: [{ id_ordine: 'ET3', kg: 500, importo: 2.5, righe: 1 }], senza_importo: [{ id_ordine: 'ET4', kg: 100, atteso: 0.5 }] });
  verifica('gli ordini da chiarire in un elenco solo, un importo che manca resta null',
    uguali(da.map(x => [x.id_ordine, x.cosa, x.trovato]), [['ET1', 'manca nella prefattura', 0], ['ET2', 'diverso (2 righe)', 20], ['ET3', 'il gestionale non lo prevede', 2.5], ['ET4', 'senza importo', null]]), JSON.stringify(da));
  // il colore e' il token --eco-surplus di src/index.css, lo stesso della passiva e
  // delle tariffe; l'etichetta «Surplus» c'e' per chi non distingue il colore
  verifica('la forma della riga: il colore del token --eco-surplus, l\'etichetta, il nome in corsivo, come nella passiva',
    ['fondo', 'barra', 'etichetta', 'barretta'].every(k => /hsl\(var\(--eco-surplus\)/.test(STILE_SURPLUS[k] || '')) && /italic/.test(STILE_SURPLUS.nome || '') && /uppercase/.test(STILE_SURPLUS.etichetta || '')
    && /--eco-surplus:/.test(testo('src/index.css')), JSON.stringify(STILE_SURPLUS));
}

if (!A) {
  console.log('  copia dei dati veri assente: parti 2-7 sui dati veri saltate');
} else {
  const db = (surplus, altro = {}) => ({
    PrimariaRete: A.PrimariaRete, PrimariaAci: A.PrimariaAci, ExtraRaccolta: A.ExtraRaccolta, Fornitore: A.Fornitore, Tariffa: A.Tariffa,
    Terziaria: A.Terziaria, SurplusTariffa: surplus, DocumentoFatturazione: [], VoceFatturazione: [], UploadLog: [], ...altro,
  });

  console.log('2. IL RIEPILOGO: LA FATTURA COM\'E\'');
  const riep = await caricaFunzione('getRiepilogoEcotyre');
  const R1 = await chiama(riep, { db: db(FUEL_SET), ruolo: 'user', corpo: { anno: 2026, mese: 'Settembre' } });
  const R0 = await chiama(riep, { db: db([]), ruolo: 'user', corpo: { anno: 2026, mese: 'Settembre' } });
  const canale = (R, c) => (R.j.tipologie || []).find(t => t.tipologia === c) || {};
  const rete1 = canale(R1, 'RETE'), aci1 = canale(R1, 'ACI'), rete0 = canale(R0, 'RETE');
  verifica('il riepilogo di settembre col Fuel Surcharge: rete 231.889,68 = 226.288,48 + 5.601,20',
    R1.stato === 200 && rete1.totale === 231889.68 && rete1.totale_standard === 226288.48 && rete1.totale_surplus === 5601.2, JSON.stringify({ s: R1.stato, t: rete1.totale, st: rete1.totale_standard }));
  const scheda1 = vista('Riepilogo', 'SchedaCanale', { t: rete1 });
  verifica('la scheda della rete: il totale, e sotto lo standard e il Fuel Surcharge con la sua base',
    scheda1.includes('€ 231.889,68') && /Standard · formulari del mese € 226\.288,48/.test(scheda1) && /Fuel Surcharge 1\.120,24 t × 5,00 €\/t consorzio Ecotyre · dal 01\/09\/2026 al 31\/12\/2026 € 5\.601,20/.test(scheda1), scheda1.slice(0, 400));
  verifica('...le tonnellate e gli ordini sono quelli dei formulari', /1\.120,24 t • 380 ordini/.test(scheda1), scheda1.slice(0, 200));
  verifica('...le regioni sono dei formulari e lo dice', /Formulari per regione del ritiro/.test(scheda1));
  const schedaA = vista('Riepilogo', 'SchedaCanale', { t: aci1 });
  verifica('la scheda dell\'ACI: 4.504,55 = 4.410,10 + 94,45, sulle 18,89 t', schedaA.includes('€ 4.504,55') && /€ 4\.410,10/.test(schedaA) && /18,89 t × 5,00 €\/t/.test(schedaA) && /€ 94,45/.test(schedaA), schedaA.slice(0, 300));
  const scheda0 = vista('Riepilogo', 'SchedaCanale', { t: rete0 });
  verifica('senza surplus la scheda e\' quella di prima: niente standard, niente surplus', scheda0.includes('€ 226.288,48') && !/Standard|Fuel Surcharge|Formulari per regione/.test(scheda0), scheda0.slice(0, 300));
  const riscontro = html('Riepilogo', 'RiscontroServizi', { tipologie: R1.j.tipologie || [] });
  const righeRete = (riscontro.split('<tbody>')[1] || '').split('</tr>').map(leggibile).filter(Boolean);
  verifica('il riscontro: la riga del Fuel Surcharge sotto i due servizi della rete, ordini e chili fra parentesi',
    righeRete.length >= 3 && /^Surplus Fuel Surcharge · 1\.120,24 t × 5,00 €\/t \(380\) \(1\.120\.240\) 5\.601,20$/.test(righeRete[righeRete.length - 1]) && /^Rete 380 1\.120\.240 231\.889,68$/.test(righeRete[0]), JSON.stringify(righeRete));
  verifica('...e le righe dei servizi sommano i chili del canale, senza il surplus',
    righeRete.slice(1, -1).reduce((s, t) => s + Number((t.split(' ').slice(-2)[0] || '0').replace(/\./g, '')), 0) === 1120240, JSON.stringify(righeRete));
  verifica('...e senza surplus non c\'e\'', !/Fuel Surcharge/.test(leggibile(html('Riepilogo', 'RiscontroServizi', { tipologie: R0.j.tipologie || [] }))));

  // La riconciliazione su un documento chiuso senza la riga del surplus, e su uno
  // aperto in cui manca un ordine arrivato dopo.
  const righeSet0 = attiva.calcolaRigheAttiva({ reteAll: A.PrimariaRete, aciAll: A.PrimariaAci, extraAll: A.ExtraRaccolta, fornitori: A.Fornitore, tariffe: A.Tariffa.filter(t => t.direzione === 'ATTIVA'), anno: 2026, mese: 'Settembre' }).righe.RETE;
  const righeSet1 = attiva.calcolaRigheAttiva({ reteAll: A.PrimariaRete, aciAll: A.PrimariaAci, extraAll: A.ExtraRaccolta, fornitori: A.Fornitore, tariffe: A.Tariffa.filter(t => t.direzione === 'ATTIVA'), anno: 2026, mese: 'Settembre', surplus: FUEL_SET }).righe.RETE;
  const docChiuso = { id: 'd1', tipo: 'ATTIVA', tipologia: 'RETE', anno: 2026, mese: 'Settembre', stato: 'chiusa', totale: 226288.48, data_elaborazione: '2026-10-05T10:00:00.000Z' };
  const RC = await chiama(riep, { db: db(FUEL_SET, { DocumentoFatturazione: [docChiuso], VoceFatturazione: righeSet0.map(r => ({ ...r, documento_id: 'd1' })) }), ruolo: 'user', corpo: { anno: 2026, mese: 'Settembre' } });
  const ricC = vista('Riepilogo', 'Riconciliazione', { t: canale(RC, 'RETE') });
  verifica('mese chiuso, surplus scritto dopo: si dice la riga del surplus e quanto fatturare a parte',
    /C'è la riga del Fuel Surcharge, che il documento non ha\./.test(ricC) &&/Fuel Surcharge: \+5\.601,20 € sulle 1\.120,24 t del mese/.test(ricC) && /\+€ 5\.601,20/.test(ricC) && /va fatturato a parte\. Il documento non si riapre da solo\./.test(ricC), ricC);
  verifica('...non e\' un movimento arrivato, e non si propone di riaprire per dei movimenti',
    !/movimento arrivato|movimenti arrivati|con peso o importo cambiato|questi movimenti si fatturano/.test(ricC), ricC);
  // il documento elaborato prima che arrivasse il primo ordine del mese: senza
  // quel formulario, e con la riga del surplus calcolata senza le sue tonnellate
  const docAperto = { ...docChiuso, stato: 'elaborata', totale: 0 };
  const arrivato = righeSet1.find(r => !attiva.eRigaSurplus(r));
  const senzaUno = attiva.calcolaRigheAttiva({ reteAll: A.PrimariaRete.filter(r => r.id !== arrivato.origine_record_id), aciAll: A.PrimariaAci, extraAll: A.ExtraRaccolta, fornitori: A.Fornitore, tariffe: A.Tariffa.filter(t => t.direzione === 'ATTIVA'), anno: 2026, mese: 'Settembre', surplus: FUEL_SET })
    .righe.RETE.map(r => ({ ...r, documento_id: 'd1' }));
  const RA = await chiama(riep, { db: db(FUEL_SET, { DocumentoFatturazione: [docAperto], VoceFatturazione: senzaUno }), ruolo: 'user', corpo: { anno: 2026, mese: 'Settembre' } });
  const ricA = vista('Riepilogo', 'Riconciliazione', { t: canale(RA, 'RETE') });
  verifica('documento aperto, un ordine arrivato dopo: un movimento arrivato, e la riga del surplus cambiata a parte',
    /1 movimento arrivato dopo l'elaborazione\./.test(ricA) && !/con peso o importo cambiato/.test(ricA) && /La riga del Fuel Surcharge è cambiata/.test(ricA) && /arrivate dopo/.test(ricA) && /Premi "Elabora Mese"/.test(ricA), ricA);
  // Lo stesso documento, ma CHIUSO col Fuel Surcharge gia' dentro (revisione del
  // 13/10/2026). Prima il riquadro diceva «va riaperto; in alternativa questi
  // movimenti si fatturano con un'integrazione» e, sotto, «Fuel Surcharge, 29,70
  // € in più, va fatturato a parte»: chi rielaborava aveva gia' i 29,70 € nel
  // documento nuovo, e chi fatturava la differenza (1.229,58, che li comprende)
  // li fatturava due volte. Ora una frase sola, con le due strade.
  const docMisto = { ...docChiuso, totale: Math.round(senzaUno.reduce((s, r) => s + r.totale, 0) * 100) / 100 };
  const RM = await chiama(riep, { db: db(FUEL_SET, { DocumentoFatturazione: [docMisto], VoceFatturazione: senzaUno }), ruolo: 'user', corpo: { anno: 2026, mese: 'Settembre' } });
  const ricM = vista('Riepilogo', 'Riconciliazione', { t: canale(RM, 'RETE') });
  verifica('mese chiuso, un ordine arrivato dopo e il surplus cambiato: una frase sola, riaprire OPPURE l\'integrazione in due righe',
    /Differenza: \+5,94 t , \+€ 1\.229,58/.test(ricM) && /si corregge in uno solo di due modi: riaprendo il documento e rielaborandolo, e il documento nuovo ha già la riga del Fuel Surcharge giusta; oppure con un'integrazione di \+€ 1\.229,58 in due righe, formulari \+€ 1\.199,88 e Fuel Surcharge \+€ 29,70\. Non tutti e due, o il surplus si fattura due volte\./.test(ricM), ricM);
  verifica('...e non dice piu\' anche di fatturare il surplus a parte', !/va fatturato a parte/.test(ricM) && !/in alternativa questi movimenti/.test(ricM) && /Fuel Surcharge: \+29,70 € sulle 5,94 t arrivate dopo/.test(ricM), ricM);

  console.log('3. IL DOCUMENTO E IL DETTAGLIO');
  const elab = await caricaFunzione('elaboraFatturazioneAttiva');
  const E1 = await chiama(elab, { db: db(FUEL_SET), ruolo: 'admin', corpo: { anno: 2026, mese: 'Settembre' } });
  const E0 = await chiama(elab, { db: db([]), ruolo: 'admin', corpo: { anno: 2026, mese: 'Settembre' } });
  const docDi = (E, c) => (E.db.DocumentoFatturazione || []).find(d => d.tipologia === c) || {};
  const vociDi = (E, c) => (E.db.VoceFatturazione || []).filter(v => v.documento_id === docDi(E, c).id);
  const doc1 = docDi(E1, 'RETE'), voci1 = vociDi(E1, 'RETE'), doc0 = docDi(E0, 'RETE'), voci0 = vociDi(E0, 'RETE');
  verifica('il documento della rete: 381 voci salvate (380 formulari e il surplus), 231.889,68',
    E1.stato === 200 && doc1.numero_voci === 381 && doc1.totale === 231889.68 && voci1.length === 381, JSON.stringify({ s: E1.stato, n: doc1.numero_voci, t: doc1.totale, err: E1.j.error }));
  // il documento si rilegge in un ordine qualunque: la riga del surplus per prima
  const rilette = [...voci1.filter(v => v.origine_dato === 'SURPLUS'), ...voci1.filter(v => v.origine_dato !== 'SURPLUS')];
  const conti = vista('Dashboard', 'ContiDocumento', { doc: doc1, righe: rilette });
  verifica('la scheda del documento: 380 prestazioni e 380 verificate, non 381',
    /Prestazioni 380 Verificate 380 Errori 0 Sospese 0/.test(conti), conti);
  verifica('...il totale, e sotto lo standard e il Fuel Surcharge', /^€ 231\.889,68 Standard · formulari € 226\.288,48 Surplus Fuel Surcharge € 5\.601,20/.test(conti), conti);
  const conti0 = vista('Dashboard', 'ContiDocumento', { doc: doc0, righe: voci0 });
  verifica('senza surplus la scheda e\' quella di prima', /^€ 226\.288,48 Prestazioni 380 Verificate 380 Errori 0 Sospese 0$/.test(conti0), conti0);
  const tot = vista('Dashboard', 'TotaleCanale', { label: 'Rete', doc: doc1, righe: rilette });
  verifica('il totale della rete fra i tre totali: «di cui Fuel Surcharge»', tot === 'Rete € 231.889,68 di cui Fuel Surcharge € 5.601,20', tot);
  verifica('...e senza surplus solo il totale', vista('Dashboard', 'TotaleCanale', { label: 'Rete', doc: doc0, righe: voci0 }) === 'Rete € 226.288,48');

  const tabella = html('Dettaglio', 'TabellaRighe', { righe: rilette });
  const righeTabella = (tabella.split('<tbody>')[1] || '').split('</tr>').filter(t => t.includes('<tr'));
  verifica('il dettaglio: 381 righe, la riga del surplus in fondo anche se il documento la rilegge per prima',
    righeTabella.length === 381 && righeTabella[380].includes('data-riga="surplus"') && !righeTabella.slice(0, 380).some(t => t.includes('data-riga="surplus"')), String(righeTabella.length));
  const ultima = leggibile(righeTabella[380]);
  verifica('...con il nome, l\'origine, il periodo, gli ordini, i chili fra parentesi, i suoi €/t e l\'importo',
    ultima === 'Surplus Fuel Surcharge consorzio Ecotyre · dal 01/09/2026 al 31/12/2026 · su 380 ordini del mese (1.120.240 kg) 5,00 €/t € 5.601,20 ok', ultima);
  verifica('...la barra e il nome nella forma comune', (righeTabella[380] || '').includes('--eco-surplus') && (righeTabella[380] || '').includes('italic') && (righeTabella[380] || '').includes('>Surplus<'));
  const barra = vista('Dettaglio', 'BarraConti', { righe: rilette });
  verifica('la barra del dettaglio: righe, chili dei formulari, totale, e lo standard col surplus',
    barra === '380 righe e la riga del Fuel Surcharge · 1.120.240 kg · € 231.889,68 (standard € 226.288,48 · Fuel Surcharge € 5.601,20)', barra);
  verifica('...e senza surplus quella di prima', vista('Dettaglio', 'BarraConti', { righe: voci0 }) === '380 righe · 1.120.240 kg · € 226.288,48', vista('Dettaglio', 'BarraConti', { righe: voci0 }));
  const opz = (pezzo('Dettaglio', 'opzioniEsportazione') || (() => ({})))('RETE', rilette, 'Settembre 2026');
  const ultimaFile = (opz.righe || [])[380] || {};
  const colonna = (titolo) => (opz.colonne || []).find(c => c.titolo === titolo) || { valore: () => undefined };
  // La riga del surplus nel file si legge come nella pagina: il nome nella prima
  // cella, poi su che cosa si paga e quando vale; l'origine nel sottotitolo.
  // Prima nel FIR c'era la nota intera del calcolo, e il PDF la tagliava a tre
  // righe proprio sulle tonnellate (revisione del 13/10/2026).
  verifica('il file del dettaglio: il surplus in fondo, il nome, le tonnellate e il periodo, i chili vuoti',
    (opz.righe || []).length === 381 && eRigaSurplus(ultimaFile) && colonna('Ordine').valore(ultimaFile) === 'Fuel Surcharge' && colonna('Quantità (kg)').valore(ultimaFile) === null
    && colonna('FIR').valore(ultimaFile) === '1.120,24 t × 5,00 €/t · dal 01/09/2026 al 31/12/2026' && colonna('Totale').valore(ultimaFile) === 5601.2
    && typeof opz.colore === 'function' && opz.colore(ultimaFile) === 'surplus', JSON.stringify((opz.colonne || []).map(c => c.valore(ultimaFile))));
  verifica('...il TOTALE: i chili dei formulari, gli euro col surplus; il sottotitolo lo dice, con l\'origine',
    opz.totali && opz.totali.valori[5] === 1120240 && opz.totali.valori[7] === 231889.68 && opz.sottotitolo === '380 righe e la riga del Fuel Surcharge (consorzio Ecotyre)', `${JSON.stringify(opz.totali)} ${opz.sottotitolo}`);
  const opz0 = (pezzo('Dettaglio', 'opzioniEsportazione') || (() => ({})))('RETE', voci0, 'Settembre 2026');
  verifica('...e senza surplus il file di prima', opz0.totali && opz0.totali.valori[5] === 1120240 && opz0.totali.valori[7] === 226288.48 && opz0.sottotitolo === '380 righe' && opz0.totali.etichetta === 'TOTALE'
    && (opz0.righe || []).every(r => opz0.colore(r) === null));
  // IL PDF VERO, scritto da esportaTabellaPdf (src/lib/esportaTabella.js), che
  // tiene al massimo tre righe per cella: la riga del surplus deve arrivarci
  // intera, tonnellate e periodo compresi, e col sottotitolo.
  {
    const radice = new URL('../', import.meta.url);
    const jspdf = pathToFileURL(fileURLToPath(new URL('node_modules/jspdf/dist/jspdf.node.min.js', radice))).href;
    const finestra = globalThis.window;
    let scritte = [];
    try {
      const { esportaTabellaPdf } = await caricaLibPagine('lib/esportaTabella', [
        [/await import\('jspdf'\)/g, `await import('${jspdf}').then(m => m.default || m)`],
        [/doc\.save\(`\$\{nomeSicuro\(nomeFile\)\}\.pdf`\);/g, 'globalThis.__pdfDettaglio = doc.output();'],
      ]);
      // jspdf, se trova un window, lo prende per un browser
      delete globalThis.window;
      await esportaTabellaPdf(opz);
      scritte = (String(globalThis.__pdfDettaglio || '').match(/\((?:\\.|[^()\\])*\)\s*Tj/g) || []).map(x => x.slice(1, x.lastIndexOf(')')).replace(/\\([()\\])/g, '$1'));
    } catch (e) {
      scritte = [`ERRORE ${e.message}`];
    } finally {
      globalThis.window = finestra;
    }
    const tutto = scritte.join(' ');
    verifica('il PDF del dettaglio: la riga del surplus intera, con le tonnellate su cui si paga e il periodo',
      scritte.includes('Fuel Surcharge') && /1\.120,24 t /.test(tutto) && /31\/12\/2026/.test(tutto) && scritte.some(s => /^1\.120,24 t /.test(s)), scritte.slice(-14).join(' | '));
    verifica('...e il sottotitolo con l\'origine', scritte.includes('380 righe e la riga del Fuel Surcharge (consorzio Ecotyre)'), scritte.slice(0, 6).join(' | '));
  }

  // UN SURPLUS CHE CAMBIA IMPORTO A META' MESE (§ 1.3 regola 7 del progetto):
  // 5 €/t fino al 15/09 e 7 €/t dal 16/09, due record e due righe. Prima le
  // pagine dicevano «la riga del Fuel Surcharge» e due «Fuel Surcharge» uguali,
  // e il file con 382 righe diceva «380 righe e la riga del Fuel Surcharge».
  const SET_DUE = [fs('RETE', { id: 'fs-a', data_fine_validita: '2026-09-15' }), fs('RETE', { id: 'fs-b', euro_t_attiva: 7, euro_t_passiva: 7, data_inizio_validita: '2026-09-16' })];
  const ED = await chiama(elab, { db: db(SET_DUE), ruolo: 'admin', corpo: { anno: 2026, mese: 'Settembre' } });
  const docD = docDi(ED, 'RETE'), vociD = vociDi(ED, 'RETE');
  verifica('due importi: il documento ha due righe del Fuel Surcharge (2.831,05 e 3.878,21)', vociD.filter(v => v.origine_dato === 'SURPLUS').map(v => v.totale).sort().join() === '2831.05,3878.21', JSON.stringify(vociD.filter(v => v.origine_dato === 'SURPLUS').map(v => v.totale)));
  const barraD = vista('Dettaglio', 'BarraConti', { righe: vociD });
  verifica('...la barra: «2 righe del Fuel Surcharge», ciascuna col suo importo',
    barraD === '380 righe e 2 righe del Fuel Surcharge · 1.120.240 kg · € 232.997,74 (standard € 226.288,48 · Fuel Surcharge a 5,00 €/t € 2.831,05 · Fuel Surcharge a 7,00 €/t € 3.878,21)', barraD);
  const totD = vista('Dashboard', 'TotaleCanale', { label: 'Rete', doc: docD, righe: vociD });
  verifica('...il totale del canale: un «di cui» solo', totD === 'Rete € 232.997,74 di cui Fuel Surcharge € 6.709,26', totD);
  const contiD = vista('Dashboard', 'ContiDocumento', { doc: docD, righe: vociD });
  verifica('...la scheda del documento: le due righe distinte', /Standard · formulari € 226\.288,48 Surplus Fuel Surcharge a 5,00 €\/t € 2\.831,05 Surplus Fuel Surcharge a 7,00 €\/t € 3\.878,21 Prestazioni 380/.test(contiD), contiD);
  const opzD = (pezzo('Dettaglio', 'opzioniEsportazione') || (() => ({})))('RETE', vociD, 'Settembre 2026');
  verifica('...il file: 382 righe e il sottotitolo che le conta', (opzD.righe || []).length === 382 && opzD.sottotitolo === '380 righe e 2 righe del Fuel Surcharge (consorzio Ecotyre)'
    && uguali((opzD.righe || []).slice(-2).map(r => (opzD.colonne || [])[2].valore(r)), ['566,21 t × 5,00 €/t · dal 01/09/2026 al 15/09/2026', '554,03 t × 7,00 €/t · dal 16/09/2026 al 31/12/2026']), `${opzD.sottotitolo} ${JSON.stringify((opzD.righe || []).slice(-2).map(r => (opzD.colonne || [])[2].valore(r)))}`);

  // Le due pagine intere, come le apre l'utente: il dettaglio (scheda Rete) e la
  // dashboard coi tre documenti. Prima la rete diceva «Rete (381)», «381 righe»,
  // la riga del surplus dove capitava con «0 kg», e «Prestazioni 381».
  const dati = (E) => Object.fromEntries(['RETE', 'ACI', 'EXTRA_RACCOLTA'].map(c => {
    const voci = vociDi(E, c);
    return [c, { documento: docDi(E, c).id ? docDi(E, c) : null, righe: [...voci.filter(v => v.origine_dato === 'SURPLUS'), ...voci.filter(v => v.origine_dato !== 'SURPLUS')] }];
  }));
  const paginaDettaglio = html('Dettaglio', 'default', { data: dati(E1), loading: false, periodo: { anno: 2026, mese: 'Settembre' } });
  const testoDettaglio = leggibile(paginaDettaglio);
  const righePagina = (paginaDettaglio.split('<tbody>')[1] || '').split('</tr>').filter(t => t.includes('<tr'));
  verifica('la pagina del dettaglio: «Rete (380)», la barra con standard e surplus',
    /Rete \(380\)/.test(testoDettaglio) && /380 righe e la riga del Fuel Surcharge · 1\.120\.240 kg · € 231\.889,68/.test(testoDettaglio), testoDettaglio.slice(0, 300));
  verifica('...la riga del surplus in fondo, senza «0 kg»',
    righePagina.length === 381 && /Fuel Surcharge/.test(leggibile(righePagina[380])) && !righePagina.slice(0, 380).some(t => /Fuel Surcharge/.test(t)) && !/ 0 kg/.test(leggibile(righePagina[380])), leggibile(righePagina[0] || '').slice(0, 200));
  const paginaDash = vista('Dashboard', 'default', {
    periodo: { anno: 2026, mese: 'Settembre' }, setPeriodo: () => {}, data: dati(E1), loading: false, elaborating: false,
    onElabora: async () => {}, onReload: async () => {}, isAdmin: true, anomalie: [], onVaiTariffe: () => {},
  });
  verifica('la pagina della dashboard: la rete con 380 prestazioni e il «di cui Fuel Surcharge» nei totali',
    /Rete elaborata € 231\.889,68 Standard · formulari € 226\.288,48 Surplus Fuel Surcharge € 5\.601,20 Prestazioni 380 Verificate 380/.test(paginaDash)
    && /Rete € 231\.889,68 di cui Fuel Surcharge € 5\.601,20/.test(paginaDash) && !/Prestazioni 381/.test(paginaDash), paginaDash.slice(0, 600));

  console.log('4. LA SCHEDA DELLA RIGA');
  const rigaSurplus = voci1.find(v => v.origine_dato === 'SURPLUS');
  const corpoS = vista('Scheda', 'CorpoRiga', { riga: rigaSurplus });
  verifica('la scheda del surplus: la formula sulle tonnellate del mese, non «0 kg»',
    corpoS.includes('1.120,24 t del mese × 5,00 €/t = € 5.601,20, arrotondato una volta sul mese') && !/0 kg ÷/.test(corpoS), corpoS);
  verifica('...il canale, chi fattura, su quanti ordini, il periodo', /Fuel Surcharge consorzio Ecotyre · dal 01\/09\/2026 al 31\/12\/2026/.test(corpoS) && /Canale: Rete/.test(corpoS) && /Fatturante: SMOCO Srl/.test(corpoS) && /Vale su: 380 ordini del mese/.test(corpoS), corpoS);
  const formulario = voci1.find(v => v.origine_dato !== 'SURPLUS' && v.quantita === 1940) || voci1.find(v => v.origine_dato !== 'SURPLUS');
  const formula = pezzo('Scheda', 'formula') || (() => '');
  verifica('la formula di un formulario non cambia', formula(formulario) === `${formulario.quantita.toLocaleString('de-DE')} kg ÷ 1.000 × € 202,00/t = € ${formulario.totale.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`, formula(formulario));

  console.log('5. LA PREFATTURA');
  const calcSet = attiva.calcolaRigheAttiva({ reteAll: A.PrimariaRete, aciAll: A.PrimariaAci, extraAll: A.ExtraRaccolta, fornitori: A.Fornitore, tariffe: A.Tariffa.filter(t => t.direzione === 'ATTIVA'), anno: 2026, mese: 'Settembre', surplus: FUEL_SET });
  const prefDa = (perOrdine) => attiva.TIPOLOGIE_ATTIVA.flatMap(c => calcSet.righe[c].filter(r => !attiva.eRigaSurplus(r) && c !== 'EXTRA_RACCOLTA'))
    .map(r => ({ id_ordine: r.ordine, numero_fir: r.numero_fir, kg: r.quantita, importo: perOrdine(r), prezzo: null, servizio: r.servizio_ecotyre === 'TRASP' ? 'Trasp' : 'Trasp+Tratt', giorno: '' }));
  const cent = (v) => Math.round(v * 100) / 100;
  // forma a: il surplus nel prezzo di ogni ordine (0,207 €/kg)
  const confA = confrontaPrefattura(prefDa(r => cent(r.totale + r.quantita * 5 / 1000)), calcSet.righe, new Map(), calcSet.surplus_del_mese);
  const sA = (confA.canali.find(x => x.canale === 'RETE') || {}).surplus;
  const riqA = vista('Prefattura', 'RiquadroSurplus', { canale: 'RETE', s: sA });
  verifica('forma a: il riquadro dice gestionale, prefattura nel prezzo, scarto d\'arrotondamento, e che torna',
    sA && /^Rete Surplus Fuel Surcharge torna, arrotondamento Gestionale € 5\.601,20 1\.120,24 t × 5,00 €\/t Prefattura € 5\.601,2\d nel prezzo degli ordini Scarto \+€ 0,0\d arrotondamento ordine per ordine/.test(riqA), riqA.slice(0, 400));
  // forma d: la prefattura non lo porta
  const confD = confrontaPrefattura(prefDa(r => r.totale), calcSet.righe, new Map(), calcSet.surplus_del_mese);
  const riqD = vista('Prefattura', 'RiquadroSurplus', { canale: 'RETE', s: (confD.canali.find(x => x.canale === 'RETE') || {}).surplus });
  verifica('forma d: «non in prefattura», la prefattura «non lo porta», scarto «—»', /non in prefattura/.test(riqD) && /Prefattura — non lo porta/.test(riqD) && /Scarto —/.test(riqD), riqD.slice(0, 300));
  // forma a con un ordine senza il surplus: si dice quale, in una tabella
  const primo = calcSet.righe.RETE.find(r => !attiva.eRigaSurplus(r) && r.quantita > 1000);
  const confX = confrontaPrefattura(prefDa(r => (r === primo ? r.totale : cent(r.totale + r.quantita * 5 / 1000))), calcSet.righe, new Map(), calcSet.surplus_del_mese);
  const riqX = vista('Prefattura', 'RiquadroSurplus', { canale: 'RETE', s: (confX.canali.find(x => x.canale === 'RETE') || {}).surplus });
  verifica('un ordine senza il surplus: «non torna», e l\'ordine nella tabella con quanto manca',
    /non torna/.test(riqX) && new RegExp(`${primo.ordine} [\\d.]+ ${cent(primo.quantita * 5 / 1000).toFixed(2).replace('.', ',')} 0,00 manca nella prefattura`).test(riqX), riqX.slice(0, 600));
  verifica('senza surplus non c\'e\' riquadro', vista('Prefattura', 'RiquadroSurplus', { canale: 'RETE', s: null }) === '');
  // un surplus che la prefattura porta nel prezzo e il gestionale non ha ancora:
  // l'ipotesi dice quanto e su quanti ordini, non «non lo porta»
  const calcSenza = attiva.calcolaRigheAttiva({ reteAll: A.PrimariaRete, aciAll: A.PrimariaAci, extraAll: A.ExtraRaccolta, fornitori: A.Fornitore, tariffe: A.Tariffa.filter(t => t.direzione === 'ATTIVA'), anno: 2026, mese: 'Settembre' });
  const confI = confrontaPrefattura(prefDa(r => cent(r.totale + r.quantita * 5 / 1000)), calcSenza.righe, new Map(), calcSenza.surplus_del_mese);
  const sI = (confI.canali.find(x => x.canale === 'RETE') || {}).surplus;
  const riqI = vista('Prefattura', 'RiquadroSurplus', { canale: 'RETE', s: sI });
  verifica('il surplus che il gestionale non ha: «da verificare», 5,00 €/t in più su 380 ordini',
    sI && sI.esito === 'ipotesi' && /^Rete Surplus non nel gestionale da verificare Gestionale nessun surplus nel mese Prefattura € 5\.601,2\d 5,00 €\/t in più su 380 ordini/.test(riqI), riqI.slice(0, 300));

  console.log('6. IL MARGINE');
  const datiMargine = (surplusAll) => ({ reteAll: A.PrimariaRete, aciAll: A.PrimariaAci, extraAll: A.ExtraRaccolta, secondarieAll: A.Secondaria, fornitori: A.Fornitore, tariffe: A.Tariffa, surplusAll });
  const M1 = calcolaMargineAnno(datiMargine(FUEL_SET), 2026, 8);
  const M0 = calcolaMargineAnno(datiMargine([]), 2026, 8);
  const reteM1 = M1.canali.find(c => c.canale === 'RETE'), reteM0 = M0.canali.find(c => c.canale === 'RETE');
  const schedaM = vista('Margine', 'SchedaMargine', { c: reteM1, anno: 2026 });
  verifica('la scheda della rete: il Fuel Surcharge di settembre, incassato, pagato, resta, e perche\'',
    /Già dentro ricavo, costo e margine: Surplus Fuel Surcharge · settembre Incassato € 5\.601,20 Pagato € 4\.332,80 Resta \+€ 1\.268,40 Sulle 253,68 t raccolte da SMOCO/.test(schedaM), schedaM.slice(0, 600));
  const tabM = html('Margine', 'TabellaMargine', { c: reteM1 });
  const testate = (tabM.match(/<th[^>]*>[^<]*<\/th>/g) || []).map(leggibile);
  const settembre = (tabM.split('</tr>').find(t => />Settembre</.test(t)) || '');
  verifica('la tabella: «di cui surplus €» accanto al margine, +1.268,40 a settembre, vuota negli altri mesi',
    testate[8] === 'di cui surplus €' && testate[7] === 'Margine €' && celle(settembre)[8] === '+1.268,40'
    && celle(tabM.split('</tr>').find(t => />Agosto</.test(t)))[8] === '', JSON.stringify({ testate, settembre: celle(settembre) }));
  verifica('...sotto, il surplus mese per mese con la ragione', /Settembre Surplus Fuel Surcharge incassato € 5\.601,20 pagato € 4\.332,80 resta \+€ 1\.268,40 sulle 253,68 t raccolte da SMOCO/.test(leggibile(tabM)), leggibile(tabM).slice(-400));
  const tabM0 = html('Margine', 'TabellaMargine', { c: reteM0 });
  verifica('senza surplus la tabella e\' quella di prima: dieci colonne, nessun surplus',
    (tabM0.match(/<th[\s>]/g) || []).length === 10 && !/surplus|Fuel/.test(tabM0) && !/Fuel|Già dentro/.test(vista('Margine', 'SchedaMargine', { c: reteM0, anno: 2026 })));
  const foglio = (pezzo('Margine', 'opzioniFoglioMargine') || (() => ({})))(reteM1, 2026);
  const colonneF = (foglio.colonne || []).map(c => c.titolo);
  const setF = (foglio.righe || [])[8] || {};
  verifica('il foglio del margine: le tre colonne del surplus in fondo, coi numeri di settembre',
    uguali(colonneF.slice(-3), ['Surplus incassato', 'Surplus pagato', 'Surplus nel margine']) && setF.mese === 'Settembre'
    && foglio.colonne[colonneF.length - 3].valore(setF) === 5601.2 && foglio.colonne[colonneF.length - 2].valore(setF) === 4332.8 && foglio.colonne[colonneF.length - 1].valore(setF) === 1268.4
    && foglio.colonne[colonneF.length - 1].valore(foglio.righe[7]) === null && /comprendono Fuel Surcharge/.test(foglio.sottotitolo), JSON.stringify({ colonneF, s: foglio.sottotitolo }));
  // due importi nello stesso mese (5 €/t fino al 15/09, 7 dal 16/09): prima due
  // blocchi «Surplus Fuel Surcharge · settembre» uguali, ora distinti dall'importo
  const reteMD = calcolaMargineAnno(datiMargine(SET_DUE), 2026, 8).canali.find(c => c.canale === 'RETE');
  const schedaMD = vista('Margine', 'SchedaMargine', { c: reteMD, anno: 2026 });
  const tabMD = leggibile(html('Margine', 'TabellaMargine', { c: reteMD }));
  verifica('il margine con due importi: i due blocchi distinti, nella scheda e sotto la tabella',
    /Surplus Fuel Surcharge a 5,00 €\/t · settembre Incassato € 2\.831,05/.test(schedaMD) && /Surplus Fuel Surcharge a 7,00 €\/t · settembre Incassato € 3\.878,21/.test(schedaMD)
    && /Settembre Surplus Fuel Surcharge a 5,00 €\/t incassato € 2\.831,05/.test(tabMD) && /Settembre Surplus Fuel Surcharge a 7,00 €\/t incassato € 3\.878,21/.test(tabMD), schedaMD.slice(schedaMD.indexOf('Già dentro'), schedaMD.indexOf('Già dentro') + 400));
  const foglio0 = (pezzo('Margine', 'opzioniFoglioMargine') || (() => ({})))(reteM0, 2026);
  verifica('...e senza surplus il foglio di prima', (foglio0.colonne || []).length === 12 && foglio0.sottotitolo === 'Ricavo della fatturazione attiva meno costo della fatturazione passiva');

  console.log('7. I TRE REPORT DELL\'AMMINISTRAZIONE NON CAMBIANO (D3)');
  const { tabellaAttiva } = await caricaLibPagine('lib/fatturazioneExport');
  const { tabellaAmministrazione } = await caricaLibPagine('lib/formatAmministrazione');
  const righeAci0 = vociDi(E0, 'ACI'), righeAci1 = vociDi(E1, 'ACI');
  const senzaId = (t) => JSON.parse(JSON.stringify(t));
  for (const [nome, fn, kgDi] of [['fatturazioneExport', tabellaAttiva, (t, c) => somma(t.righe.map(r => ({ q: r[c === 'RETE' ? 6 : 9] })), 'q')], ['formatAmministrazione', tabellaAmministrazione, (t) => t.totale_kg]]) {
    const r0 = fn('RETE', voci0, 2026, 'Settembre'), r1 = fn('RETE', soloFormulari(voci1), 2026, 'Settembre');
    const a0 = fn('ACI', righeAci0, 2026, 'Settembre'), a1 = fn('ACI', soloFormulari(righeAci1), 2026, 'Settembre');
    const euroDi = (t) => (t.totale_euro ?? t.totale);
    verifica(`${nome}: settembre 380 righe, 1.120.240 kg, 226.288,48 € sulla rete; 6, 18.890, 4.410,10 sull'ACI`,
      r0.righe.length === 380 && kgDi(r0, 'RETE') === 1120240 && euroDi(r0) === 226288.48 && a0.righe.length === 6 && kgDi(a0, 'ACI') === 18890 && euroDi(a0) === 4410.1,
      JSON.stringify({ n: r0.righe.length, kg: kgDi(r0, 'RETE'), e: euroDi(r0), an: a0.righe.length, akg: kgDi(a0, 'ACI'), ae: euroDi(a0) }));
    verifica(`${nome}: col Fuel Surcharge, sulle righe dei formulari, lo stesso foglio di senza`, uguali(senzaId(r1), senzaId(r0)) && uguali(senzaId(a1), senzaId(a0)));
  }
  // Con tutte le righe del documento, il report avrebbe una riga in piu' che non
  // sa scrivere (Tipo «Trasp.+Tratt.», niente ordine, 0 kg): finche'
  // l'amministrazione non dice come la vuole (D3), a quei fogli si passano le
  // righe dei formulari, soloFormulari.
  const intera = tabellaAmministrazione('RETE', voci1, 2026, 'Settembre');
  verifica('le righe intere del documento farebbero 381 righe nel format dell\'amministrazione: per questo soloFormulari', intera.righe.length === 381 && soloFormulari(voci1).length === 380);
  // IL PERCORSO VERO (revisione del 13/10/2026). Chi chiama i tre report e' la
  // pagina delle esportazioni, AttivaEsportazioni.jsx, coi pulsanti Excel, PDF,
  // «Format amm.» e «Format amm. PDF» di ogni canale: le righe che arrivano ai
  // report sono quelle che passa lei. Prima qui si filtrava a mano con
  // soloFormulari e si diceva «DA FARE»: la prova passava, e i fogli veri
  // uscivano con la riga del surplus travestita da «Trasp.+Tratt.» con 0 kg. Ora
  // la pagina si esegue davvero (i suoi hook e i suoi pulsanti, con React finto
  // e il client finto) e i quattro report sono sostituiti da registratori.
  // ESPORTAZIONI=<file> prova un'altra versione della pagina (una correzione
  // proposta, prima di metterla al suo posto).
  const fileEsportazioni = process.env.ESPORTAZIONI || qui('../src/components/fatturazione/AttivaEsportazioni.jsx');
  const passate = await righeDaiPulsanti(fileEsportazioni, dati(E1), [['RETE', 'Excel'], ['RETE', 'PDF'], ['RETE', 'Format amm.'], ['RETE', 'Format amm. PDF'], ['ACI', 'Format amm.']]);
  const formulariAci = soloFormulari(righeAci1);
  for (const p of passate) {
    const attese = p.canale === 'RETE' ? 380 : formulariAci.length;
    verifica(`AttivaEsportazioni, ${p.canale} «${p.pulsante}»: al report arrivano le sole righe dei formulari (${attese})`,
      !p.errore && p.righe && p.righe.length === attese && !p.righe.some(eRigaSurplus), p.errore || `${p.righe ? p.righe.length : 'nessuna'} righe, ${p.righe ? p.righe.filter(eRigaSurplus).length : 0} del surplus`);
  }
  const reteXls = passate.find(p => p.canale === 'RETE' && p.pulsante === 'Format amm.') || {};
  const ammVero = reteXls.righe ? tabellaAmministrazione('RETE', reteXls.righe, 2026, 'Settembre') : { righe: [] };
  const attVero = (passate.find(p => p.canale === 'RETE' && p.pulsante === 'Excel') || {}).righe;
  const attivaVera = attVero ? tabellaAttiva('RETE', attVero, 2026, 'Settembre') : { righe: [] };
  verifica('...e i fogli che escono dicono 380 righe, 1.120.240 kg e 226.288,48 €, come senza surplus',
    ammVero.righe.length === 380 && ammVero.totale_kg === 1120240 && ammVero.totale_euro === 226288.48 && attivaVera.righe.length === 380 && attivaVera.totale === 226288.48,
    JSON.stringify({ amm: [ammVero.righe.length, ammVero.totale_kg, ammVero.totale_euro], att: [attivaVera.righe.length, attivaVera.totale] }));
}

console.log('7b. I TRE REPORT SONO QUELLI DEL 13/10/2026');
{
  // L'impronta dei tre file com'erano al 13/10/2026 (HEAD 147272f), senza i \r.
  // Chi li cambia dopo la risposta dell'utente alla domanda D3 (la riga «Fuel
  // Surcharge» nei report dell'amministrazione) aggiorna qui l'impronta e prova i
  // fogli nuovi.
  const IMPRONTE = {
    'src/lib/fatturazioneExport.js': '36f25741147db7433d027071c26f4559c9f29177bc4e5bf147946a063883e128',
    'src/lib/formatAmministrazione.js': 'c7d0a6d30eeddeba057c4fa03b982bb005428c6eea47a3cd8904c0751ed865ca',
    'src/lib/formatAmministrazioneExport.js': '697f8487dc3b8f9d09953471a12eb064779faff73da659d07a56fdf7b8a17c8b',
  };
  for (const [file, impronta] of Object.entries(IMPRONTE)) {
    verifica(`${file} non e' cambiato`, createHash('sha256').update(testo(file)).digest('hex') === impronta);
  }
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
