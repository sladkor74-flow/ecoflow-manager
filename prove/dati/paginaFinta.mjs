// UNA PAGINA VERA, MONTATA SENZA BROWSER, PER CONTARE LE RICHIESTE CHE FA
// (12/10/2026, segnalazioni alte A3, A14 e A49 del 20/09).
//
// Il limite di richieste al minuto vale per tutta l'app insieme: una pagina che
// rilegge l'archivio a ogni filtro consuma il margine di tutti. Leggere il
// sorgente non basta a dirlo - una lettura in un useCallback che dipende dai
// filtri sembra innocua - e i numeri a video vanno confrontati prima e dopo.
// Qui la pagina gira davvero: i suoi useState, useEffect, useMemo e le sue
// chiamate, con un client finto che registra ogni richiesta.
//
// Come funziona. Il componente si impacchetta con esbuild e React si sostituisce
// con uno finto e "di superficie": esegue la pagina e i suoi hook, ma NON i
// componenti figli. Il risultato e' l'albero degli elementi, coi props che la
// pagina passa a ciascuno: la tabella riceve le righe, il campo di ricerca il
// conteggio dei trovati, il filtro il suo onChange. La prova legge quei props
// (sono i numeri a video) e chiama gli onChange come farebbe chi usa la pagina.
// I componenti figli, le icone e le librerie dell'interfaccia sono finti (non
// si eseguono); le librerie di src/lib sono quelle vere, tranne il client.
// L'orologio e' finto anche lui, per le attese come il debounce della ricerca.
//
// Sta in prove/dati perche' non e' una prova: esegui.mjs guarda solo i .mjs in
// cima alla cartella.
import { build } from 'esbuild';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, isAbsolute } from 'node:path';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
const SRC = qui('../../src/');

// React finto, di superficie: una radice sola, i figli restano elementi.
const REACT_FINTO = `
const ELEMENTO = Symbol.for('elemento.finto');
let corrente = null;
let progressivoId = 0;
export const Fragment = function Fragment(p) { return p.children; };
export const StrictMode = Fragment;
export const Suspense = Fragment;
export function createElement(type, config, ...figli) {
  const props = {};
  let key = null;
  if (config) for (const k of Object.keys(config)) { if (k === 'key') key = config[k]; else if (k !== 'ref') props[k] = config[k]; }
  if (figli.length === 1) props.children = figli[0]; else if (figli.length > 1) props.children = figli;
  return { $$typeof: ELEMENTO, type, key, props };
}
// Il runtime automatico del JSX (jsconfig: react-jsx): i figli sono gia' nei props.
export function jsx(type, config, key) {
  const props = {};
  for (const k of Object.keys(config || {})) if (k !== 'ref' && k !== 'key') props[k] = config[k];
  return { $$typeof: ELEMENTO, type, key: key === undefined ? (config && config.key !== undefined ? config.key : null) : key, props };
}
export const jsxs = jsx;
export const jsxDEV = jsx;
export const isValidElement = (x) => !!x && x.$$typeof === ELEMENTO;
export const cloneElement = (el, props) => ({ ...el, props: { ...el.props, ...(props || {}) } });
const piatti = (x, out = []) => { if (Array.isArray(x)) x.forEach(y => piatti(y, out)); else if (x != null && typeof x !== 'boolean') out.push(x); return out; };
export const Children = { toArray: (x) => piatti(x), map: (x, f) => piatti(x).map(f), forEach: (x, f) => piatti(x).forEach(f), count: (x) => piatti(x).length, only: (x) => x };
export function createContext(valore) { const c = { _valore: valore }; c.Provider = function Provider(p) { return p.children; }; c.Consumer = function Consumer(p) { return p.children(valore); }; return c; }
export const forwardRef = (render) => { const f = function (props) { return render(props, null); }; f.displayName = render.displayName || render.name; return f; };
export const memo = (c) => c;
export const lazy = () => function Pigro() { return null; };
export class Component { constructor(props) { this.props = props; this.state = {}; } setState() {} }
export class PureComponent extends Component {}
export const version = '18.3.1';
const prendi = () => { if (!corrente) throw new Error('hook fuori da un componente montato'); return [corrente, corrente.indice++]; };
const cambiate = (a, b) => !a || !b || a.length !== b.length || a.some((x, k) => !Object.is(x, b[k]));
export function useState(iniziale) {
  const [r, i] = prendi();
  if (!r.hooks[i]) {
    const h = { valore: typeof iniziale === 'function' ? iniziale() : iniziale };
    h.imposta = (v) => { const nuovo = typeof v === 'function' ? v(h.valore) : v; if (Object.is(nuovo, h.valore)) return; h.valore = nuovo; r.programma(); };
    r.hooks[i] = h;
  }
  return [r.hooks[i].valore, r.hooks[i].imposta];
}
export function useReducer(riduttore, iniziale, init) {
  const [stato, imposta] = useState(() => (init ? init(iniziale) : iniziale));
  return [stato, (azione) => imposta(s => riduttore(s, azione))];
}
export function useEffect(fn, deps) {
  const [r, i] = prendi();
  const h = r.hooks[i] || (r.hooks[i] = { effetto: true });
  if (deps === undefined || cambiate(h.deps, deps)) {
    h.deps = deps;
    r.effetti.push(() => { if (h.pulisci) h.pulisci(); const c = fn(); h.pulisci = typeof c === 'function' ? c : null; });
  }
}
export const useLayoutEffect = useEffect;
export const useInsertionEffect = () => {};
export function useMemo(fn, deps) {
  const [r, i] = prendi();
  if (!r.hooks[i] || cambiate(r.hooks[i].deps, deps)) r.hooks[i] = { deps, valore: fn() };
  return r.hooks[i].valore;
}
export const useCallback = (fn, deps) => useMemo(() => fn, deps);
export function useRef(v) { const [r, i] = prendi(); if (!r.hooks[i]) r.hooks[i] = { current: v }; return r.hooks[i]; }
export const useContext = (c) => (c ? c._valore : undefined);
export const useId = () => ':r' + (++progressivoId) + ':';
export const useTransition = () => [false, (f) => f()];
export const startTransition = (f) => f();
export const useDeferredValue = (v) => v;
export const useSyncExternalStore = (_s, leggi) => leggi();
export const useImperativeHandle = () => {};
export const useDebugValue = () => {};

/** Monta un componente: lo esegue, poi i suoi effetti; ogni setState lo riesegue. */
export function monta(Comp, props = {}) {
  const r = { hooks: [], effetti: [], indice: 0, albero: null, programmato: false, rese: 0, smontato: false, errori: [], props };
  r.rendi = () => {
    r.programmato = false;
    if (r.smontato) return;
    const prima = corrente;
    corrente = r; r.indice = 0; r.effetti = [];
    try { r.albero = Comp(r.props); } finally { corrente = prima; }
    r.rese++;
    const effetti = r.effetti; r.effetti = [];
    for (const e of effetti) e();
  };
  r.programma = () => {
    if (r.programmato || r.smontato) return;
    r.programmato = true;
    queueMicrotask(() => { try { r.rendi(); } catch (e) { r.errori.push(e); } });
  };
  r.smonta = () => { r.smontato = true; for (const h of r.hooks) if (h && h.pulisci) h.pulisci(); };
  r.rendi();
  return r;
}
const React = { jsx, jsxs, jsxDEV, Fragment, StrictMode, Suspense, createElement, isValidElement, cloneElement, Children, createContext, forwardRef, memo, lazy, Component, PureComponent, version,
  useState, useReducer, useEffect, useLayoutEffect, useInsertionEffect, useMemo, useCallback, useRef, useContext, useId, useTransition, startTransition, useDeferredValue,
  useSyncExternalStore, useImperativeHandle, useDebugValue };
export default React;
`;

// Il client delle pagine: quello che la prova mette in globalThis.__CLIENTE_FINTO.
const CLIENTE_FINTO = `
export const base44 = new Proxy({}, { get: (_t, k) => (globalThis.__CLIENTE_FINTO || {})[k] });
export default base44;
`;

// Le librerie npm piccole e senza interfaccia restano vere; tutte le altre
// (icone, router, componenti dell'interfaccia, xlsx, jspdf...) diventano finte.
const NPM_VERI = new Set(['clsx', 'tailwind-merge', 'class-variance-authority', 'date-fns', 'fflate']);

const ESTENSIONI = ['.jsx', '.js', '.ts', '/index.jsx', '/index.js'];
const dalAlias = (p) => {
  const base = SRC + p.slice(2);
  return [base, ...ESTENSIONI.map(e => base + e)].find(f => existsSync(f) && /\.\w+$/.test(f)) || null;
};

const togliCommenti = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
const sorgenti = new Map();
const sorgenteDi = (f) => { if (!sorgenti.has(f)) sorgenti.set(f, existsSync(f) ? togliCommenti(readFileSync(f, 'utf8')) : ''); return sorgenti.get(f); };

/** I nomi che un file importa da un modulo: predefinito (il nome locale) e nominati. */
export function nomiImportati(sorgente, spec) {
  const esc = spec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:import|export)\\s+([^;]*?)\\s+from\\s+['"]${esc}['"]`, 'g');
  const nomi = new Set();
  let predefinito = null;
  for (const m of sorgente.matchAll(re)) {
    let clausola = m[1].trim();
    const graffe = clausola.match(/\{([^}]*)\}/);
    if (graffe) {
      for (const parte of graffe[1].split(',')) {
        const [orig, locale] = parte.trim().split(/\s+as\s+/);
        if (!orig) continue;
        if (orig === 'default') predefinito = predefinito || (locale || 'Predefinito').trim();
        else nomi.add(orig.trim());
      }
      clausola = clausola.replace(/\{[^}]*\}/, '');
    }
    clausola = clausola.replace(/\*\s+as\s+[\w$]+/, '').replace(/,/g, ' ').trim();
    if (/^[A-Za-z_$][\w$]*$/.test(clausola)) predefinito = predefinito || clausola;
  }
  return { nomi: [...nomi], predefinito };
}

// Il modulo finto: componenti che non si eseguono (il nome resta, per trovarli
// nell'albero) e hook che restituiscono un oggetto le cui funzioni non fanno niente.
const finto = (spec, { nomi, predefinito }) => `
const nulla = new Proxy(function () {}, {
  get: (_t, k) => (k === Symbol.iterator ? function* () { yield nulla; yield nulla; } : k === Symbol.toPrimitive ? () => '' : nulla),
  apply: () => nulla,
});
const crea = (nome) => {
  if (/^use[A-Z]/.test(nome)) return () => nulla;
  const f = function () { return null; };
  Object.defineProperty(f, 'name', { value: nome });
  f.__finto = nome;
  f.__modulo = ${JSON.stringify(spec)};
  return f;
};
export default crea(${JSON.stringify(predefinito || spec.split('/').pop())});
${nomi.map(n => `export const ${n} = crea(${JSON.stringify(n)});`).join('\n')}
`;

/**
 * Impacchetta il componente `src/<percorso>` (o il file dato) con React finto.
 * reali: gli import '@/...' di componenti da tenere veri (per le loro funzioni
 * esportate, come corrispondeIdOrdine); i componenti restano comunque non eseguiti.
 * Restituisce { Componente, modulo, monta }.
 */
export async function caricaPagina(percorso, { reali = [], file = null } = {}) {
  const ingresso = file || dalAlias('@/' + percorso.replace(/^src\//, ''));
  if (!ingresso) throw new Error('pagina non trovata: ' + percorso);
  const veri = new Set(reali);
  // Una libreria di src/lib senza componente (13/10/2026): si impacchetta lo
  // stesso, con le sue esportazioni, e Componente resta undefined.
  const conPredefinito = /\bexport\s+default\b|\bexport\s*\{[^}]*\bdefault\b/.test(sorgenteDi(ingresso));
  const pacchetto = await build({
    stdin: {
      contents: `export * from ${JSON.stringify(ingresso)};\n${conPredefinito ? `export { default as Componente } from ${JSON.stringify(ingresso)};\n` : ''}export { monta } from 'react';\n`,
      resolveDir: dirname(ingresso), loader: 'js',
    },
    bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
    mainFields: ['module', 'main'], conditions: ['import', 'module', 'default'],
    loader: { '.jsx': 'jsx', '.js': 'jsx' },
    define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.DEV': 'false' },
    plugins: [{ name: 'pagina-finta', setup(b) {
      b.onResolve({ filter: /^react(\/jsx-runtime|\/jsx-dev-runtime)?$/ },() => ({ path: 'react', namespace: 'finto-react' }));
      b.onLoad({ filter: /.*/, namespace: 'finto-react' }, () => ({ contents: REACT_FINTO, loader: 'js' }));
      b.onResolve({ filter: /^@\/api\/base44Client$/ }, () => ({ path: 'client', namespace: 'finto-client' }));
      b.onLoad({ filter: /.*/, namespace: 'finto-client' }, () => ({ contents: CLIENTE_FINTO, loader: 'js' }));
      b.onResolve({ filter: /^@\// }, (a) => {
        const vero = a.path.startsWith('@/lib/') || veri.has(a.path);
        const f = dalAlias(a.path);
        if (vero && f) return { path: f };
        return { path: `${a.path}|${a.importer}`, namespace: 'finto-modulo', pluginData: { importatore: a.importer, spec: a.path } };
      });
      b.onResolve({ filter: /^[^./]/ }, (a) => {
        if (a.namespace === 'finto-react' || a.namespace === 'finto-client' || isAbsolute(a.path)) return undefined;
        const radice = a.path.startsWith('@') ? a.path.split('/').slice(0, 2).join('/') : a.path.split('/')[0];
        if (NPM_VERI.has(radice)) return undefined;
        // Un modulo finto per ogni file che lo importa: ciascuno ha i suoi nomi.
        return { path: `${a.path}|${a.importer}`, namespace: 'finto-modulo', pluginData: { importatore: a.importer, spec: a.path } };
      });
      b.onLoad({ filter: /.*/, namespace: 'finto-modulo' }, (a) => {
        const { importatore: imp, spec } = a.pluginData || {};
        const nomi = imp && existsSync(imp) ? nomiImportati(sorgenteDi(imp), spec) : { nomi: [], predefinito: null };
        return { contents: finto(spec || a.path, nomi), loader: 'js' };
      });
    } }],
  });
  if (typeof globalThis.window === 'undefined') globalThis.window = { self: 1, top: 1, matchMedia: () => ({ matches: false, addListener() {}, removeListener() {} }), confirm: () => true, alert: () => {} };
  const modulo = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
  return { Componente: modulo.Componente, modulo, monta: modulo.monta };
}

// === l'albero ===

const eElemento = (x) => !!x && typeof x === 'object' && x.$$typeof === Symbol.for('elemento.finto');

/** Tutti gli elementi dell'albero, in ordine, attraverso i children. */
export function* elementi(x) {
  if (x == null || typeof x === 'boolean') return;
  if (Array.isArray(x)) { for (const y of x) yield* elementi(y); return; }
  if (eElemento(x)) { yield x; yield* elementi(x.props.children); }
}

/** Il nome di un elemento: il tag html, o il nome del componente. */
export const nomeDi = (el) => (typeof el.type === 'string' ? el.type : (el.type && (el.type.__finto || el.type.displayName || el.type.name)) || '?');

/** Gli elementi con quel nome (o che soddisfano la condizione). */
export const trova = (albero, cond) => [...elementi(albero)].filter(el => (typeof cond === 'string' ? nomeDi(el) === cond : cond(el)));

/** Il testo dentro un elemento, come si leggerebbe a video (senza i figli non eseguiti). */
export function testo(x) {
  if (x == null || typeof x === 'boolean') return '';
  if (typeof x === 'string' || typeof x === 'number') return String(x);
  if (Array.isArray(x)) return x.map(testo).join('');
  if (eElemento(x)) return testo(x.props.children);
  return '';
}

/** Lascia finire le promesse in volo (non le attese dell'orologio finto). */
export async function aspetta(giri = 30) {
  for (let i = 0; i < giri; i++) await new Promise(r => setImmediate(r));
}

// === l'orologio finto ===

/** setTimeout e clearTimeout a comando: il tempo passa solo con avanza(ms). */
export function orologioFinto() {
  const veri = { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
  let adesso = 0, progressivo = 0;
  const attese = new Map();
  const o = {
    get adesso() { return adesso; },
    get inAttesa() { return attese.size; },
    installa() {
      globalThis.setTimeout = (fn, ms = 0, ...arg) => { const id = ++progressivo; attese.set(id, { quando: adesso + Math.max(0, Number(ms) || 0), fn, arg }); return id; };
      globalThis.clearTimeout = (id) => { attese.delete(id); };
      return o;
    },
    async avanza(ms) {
      const fine = adesso + ms;
      for (;;) {
        const prossima = [...attese.entries()].filter(([, a]) => a.quando <= fine).sort((x, y) => x[1].quando - y[1].quando || x[0] - y[0])[0];
        if (!prossima) break;
        attese.delete(prossima[0]);
        adesso = prossima[1].quando;
        prossima[1].fn(...prossima[1].arg);
        await aspetta(5);
      }
      adesso = fine;
      await aspetta(5);
    },
    ripristina() { globalThis.setTimeout = veri.setTimeout; globalThis.clearTimeout = veri.clearTimeout; },
  };
  return o;
}

// === il client finto ===

const uguale = (r, f) => Object.entries(f || {}).every(([k, v]) => (v && typeof v === 'object' && Array.isArray(v.$in) ? v.$in.includes(r[k]) : r[k] === v));

/**
 * Il client delle pagine, finto: registra ogni richiesta in `chiamate`.
 * funzioni: { nome: async (payload) => data } (un errore lanciato arriva alla
 * pagina come una risposta non riuscita); archivi: { Entita: [righe] }.
 * emetti(entita, evento) manda un evento a chi si e' iscritto con subscribe.
 */
export function clienteFinto({ funzioni = {}, archivi = {} } = {}) {
  const chiamate = [];
  const iscritti = [];
  const entita = (nome) => ({
    list: async (_ord, quanti = 5000, salta = 0) => { chiamate.push({ tipo: 'lettura', nome, metodo: 'list' }); return (archivi[nome] || []).slice(salta, salta + quanti).map(r => ({ ...r })); },
    filter: async (f, _ord, quanti = 5000, salta = 0) => { chiamate.push({ tipo: 'lettura', nome, metodo: 'filter', filtro: f }); return (archivi[nome] || []).filter(r => uguale(r, f)).slice(salta, salta + quanti).map(r => ({ ...r })); },
    get: async (id) => { chiamate.push({ tipo: 'lettura', nome, metodo: 'get' }); return { ...(archivi[nome] || []).find(r => r.id === id) }; },
    create: async (r) => { chiamate.push({ tipo: 'scrittura', nome, metodo: 'create' }); return { id: 'nuovo', ...r }; },
    update: async (id, r) => { chiamate.push({ tipo: 'scrittura', nome, metodo: 'update', id }); return { id, ...r }; },
    delete: async (id) => { chiamate.push({ tipo: 'scrittura', nome, metodo: 'delete', id }); return {}; },
    subscribe: (cb) => {
      const voce = { nome, cb, attiva: true };
      iscritti.push(voce);
      chiamate.push({ tipo: 'iscrizione', nome });
      return () => { voce.attiva = false; };
    },
  });
  const cliente = {
    entities: new Proxy({}, { get: (_t, n) => (typeof n === 'string' ? entita(n) : undefined) }),
    functions: {
      invoke: async (nome, payload = {}) => {
        chiamate.push({ tipo: 'funzione', nome, payload: JSON.parse(JSON.stringify(payload ?? {})) });
        const f = funzioni[nome];
        if (!f) return { data: {} };
        try {
          return { data: await f(payload ?? {}) };
        } catch (e) {
          const err = new Error('Request failed with status code ' + (e.status || 500));
          err.response = { status: e.status || 500, data: { error: e.message } };
          throw err;
        }
      },
    },
    auth: { me: async () => ({ role: 'admin', email: 'prova@prova' }) },
  };
  return {
    cliente, chiamate, iscritti,
    emetti: (nome, evento) => { for (const v of iscritti) if (v.attiva && v.nome === nome) v.cb(evento); },
    azzera: () => { chiamate.length = 0; },
    funzioniChiamate: (nome) => chiamate.filter(c => c.tipo === 'funzione' && (!nome || c.nome === nome)),
    letture: (nome) => chiamate.filter(c => c.tipo === 'lettura' && (!nome || c.nome === nome)),
  };
}
