// UN BANCO PER PROVARE UNA FUNZIONE INTERA, CON UN ARCHIVIO FINTO IN MEMORIA
// (chiusura dell'audit, 11/10/2026).
//
// La funzione vera (base44/functions/<nome>/entry.ts) si impacchetta con esbuild
// e l'SDK della piattaforma si sostituisce con uno finto: ogni archivio e' un
// elenco in globalThis.__DB, filter confronta i campi uguali, e ogni scrittura
// finisce in globalThis.__SCRITTE, cosi' la prova vede che cosa la funzione ha
// scritto e che cosa no. Chi chiede e' globalThis.__RUOLO ('admin' o 'user').
//
// Sta in prove/dati perche' non e' una prova: esegui.mjs guarda solo i .mjs in
// cima alla cartella.
//
// bulkUpdate (12/10/2026): il motore degli alert aggiorna e chiude gli alert con
// bulkUpdate dentro un catch muto. Senza, sul banco le chiusure cadevano nel
// catch e una prova vedeva aperti alert che la funzione vera chiude. Come
// update: le righe ({ id, ...campi }) si fondono con quelle che ci sono, e la
// scrittura si registra una volta sola, con tutte le righe.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const SDK_FINTO = `
const tabella = (nome) => (globalThis.__DB[nome] = globalThis.__DB[nome] || []);
const uguale = (r, f) => Object.entries(f || {}).every(([k, v]) => r[k] === v);
let progressivo = 0;
const entita = (nome) => ({
  list: async (_ord, quanti = 5000, salta = 0) => tabella(nome).slice(salta, salta + quanti).map(r => ({ ...r })),
  filter: async (f, _ord, quanti = 5000, salta = 0) => tabella(nome).filter(r => uguale(r, f)).slice(salta, salta + quanti).map(r => ({ ...r })),
  get: async (id) => { const r = tabella(nome).find(x => x.id === id); if (!r) throw new Error('non trovato ' + id); return { ...r }; },
  create: async (r) => { const nuovo = { id: nome + '-nuovo-' + (++progressivo), ...r }; tabella(nome).push(nuovo); globalThis.__SCRITTE.push({ op: 'create', entita: nome, dati: r }); return { ...nuovo }; },
  bulkCreate: async (rr) => { for (const r of rr) tabella(nome).push({ id: nome + '-nuovo-' + (++progressivo), ...r }); globalThis.__SCRITTE.push({ op: 'bulkCreate', entita: nome, n: rr.length }); return rr; },
  update: async (id, r) => { const t = tabella(nome); const i = t.findIndex(x => x.id === id); if (i >= 0) t[i] = { ...t[i], ...r }; globalThis.__SCRITTE.push({ op: 'update', entita: nome, id, dati: r }); return { ...(t[i] || {}), ...r }; },
  bulkUpdate: async (rr) => { const t = tabella(nome); for (const r of rr) { const i = t.findIndex(x => x.id === r.id); if (i >= 0) t[i] = { ...t[i], ...r }; } globalThis.__SCRITTE.push({ op: 'bulkUpdate', entita: nome, righe: rr }); return rr; },
  delete: async (id) => { const t = tabella(nome); const i = t.findIndex(x => x.id === id); if (i >= 0) t.splice(i, 1); globalThis.__SCRITTE.push({ op: 'delete', entita: nome, id }); return {}; },
  deleteMany: async (f) => { const t = tabella(nome); const via = t.filter(r => uguale(r, f)); globalThis.__DB[nome] = t.filter(r => !uguale(r, f)); if (via.length) globalThis.__SCRITTE.push({ op: 'deleteMany', entita: nome, n: via.length }); return { deleted: via.length }; },
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
export function createClientFromRequest() {
  return {
    auth: { me: async () => ({ role: globalThis.__RUOLO, email: 'prova@prova' }) },
    asServiceRole: { entities, functions: { invoke: async () => ({ data: {} }) } },
    entities,
    functions: { invoke: async () => ({ data: {} }) },
  };
}`;

/** Il modulo della funzione, con l'SDK finto al posto di quello vero. */
export async function caricaFunzione(nome) {
  const pacchetto = await build({
    entryPoints: [fileURLToPath(new URL(`../../base44/functions/${nome}/entry.ts`, import.meta.url))],
    bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
    plugins: [{ name: 'sdk-finto', setup(b) {
      b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
      b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
    } }],
  });
  return import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
}

/**
 * Chiama la funzione con un archivio e un ruolo: { stato, j, scritte, db }.
 * L'archivio si copia, cosi' una chiamata non sporca la successiva.
 */
export async function chiama(modulo, { db = {}, ruolo = 'admin', corpo = {} } = {}) {
  globalThis.__DB = JSON.parse(JSON.stringify(db));
  globalThis.__SCRITTE = [];
  globalThis.__RUOLO = ruolo;
  const r = await modulo.default({ json: async () => corpo });
  return { stato: r.status, j: await r.json(), scritte: globalThis.__SCRITTE, db: globalThis.__DB };
}
