// UN BANCO PER PROVARE ECOTYNA INTERA, chiediAssistente con un SDK finto
// (12/10/2026, segnalazioni alte del 20/09 A71-A76).
//
// Come prove/dati/bancoFunzioni.mjs, ma con il modello: InvokeLLM risponde al
// pianificatore (lo schema con «strumenti») con il piano della prova e alla
// domanda con la risposta della prova, e registra tutto quello che riceve. In
// piu':
// - __GUASTI: archivi la cui lettura va in errore, per gli strumenti che non
//   rispondono;
// - __RIEPILOGO: il riepilogo generale della commessa (situazioneGestionale) che
//   la funzione riceve: un testo, oppure 'errore' perche' la lettura non riesca.
//   Si sostituisce solo nell'import di chiediAssistente: gli strumenti usano il vero.
//
// Sta in prove/dati perche' non e' una prova: esegui.mjs guarda solo i .mjs in
// cima alla cartella.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const SDK_FINTO = `
const tabella = (nome) => (globalThis.__DB[nome] = globalThis.__DB[nome] || []);
const uguale = (r, f) => Object.entries(f || {}).every(([k, v]) => (v === null ? r[k] == null || r[k] === '' : r[k] === v));
const guasto = (nome) => { if ((globalThis.__GUASTI || []).includes(nome)) throw new Error('lettura di ' + nome + ' non riuscita'); };
let progressivo = 0;
const entita = (nome) => ({
  list: async (_o, quanti = 5000, salta = 0) => { guasto(nome); return tabella(nome).slice(salta, salta + quanti).map(r => ({ ...r })); },
  filter: async (f, _o, quanti = 5000, salta = 0) => { guasto(nome); return tabella(nome).filter(r => uguale(r, f)).slice(salta, salta + quanti).map(r => ({ ...r })); },
  get: async (id) => ({ ...(tabella(nome).find(x => x.id === id) || {}) }),
  create: async (r) => { const nuovo = { id: nome + '-' + (++progressivo), created_date: new Date().toISOString(), ...r }; tabella(nome).push(nuovo); globalThis.__SCRITTE.push({ op: 'create', entita: nome, dati: r }); return { ...nuovo }; },
  update: async (id, r) => { const t = tabella(nome); const i = t.findIndex(x => x.id === id); if (i >= 0) t[i] = { ...t[i], ...r }; globalThis.__SCRITTE.push({ op: 'update', entita: nome, id, dati: r }); return { ...(t[i] || {}), ...r }; },
  delete: async () => ({}),
  bulkCreate: async (rr) => rr,
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
const InvokeLLM = async (args) => { globalThis.__LLM.push(args); return globalThis.__RISPONDI(args); };
export function createClientFromRequest() {
  const integrations = { Core: { InvokeLLM, CreateFileSignedUrl: async () => ({ signed_url: '' }) } };
  return {
    auth: { me: async () => ({ id: 'u1', role: globalThis.__RUOLO, email: 'prova@prova', full_name: 'Prova' }) },
    asServiceRole: { entities, integrations, functions: { invoke: async () => ({ data: {} }) } },
    entities, integrations, functions: { invoke: async () => ({ data: {} }) },
  };
}`;

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
const ASSISTENTE = qui('../../base44/shared/assistente.ts').replace(/\\/g, '/');
const RIEPILOGO_FINTO = `
export * from ${JSON.stringify(ASSISTENTE)};
import { situazioneGestionale as vera } from ${JSON.stringify(ASSISTENTE)};
export async function situazioneGestionale(...a) {
  if (globalThis.__RIEPILOGO === 'errore') throw new Error('riepilogo non riuscito');
  if (typeof globalThis.__RIEPILOGO === 'string') return globalThis.__RIEPILOGO;
  return vera(...a);
}`;

/** chiediAssistente impacchettata con l'SDK finto. */
export async function caricaEcoTyna() {
  const pacchetto = await build({
    entryPoints: [qui('../../base44/functions/chiediAssistente/entry.ts')],
    bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
    plugins: [{ name: 'finti', setup(b) {
      b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
      b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
      b.onResolve({ filter: /shared\/assistente\.ts$/ }, (a) => (/chiediAssistente[\\/]entry\.ts$/.test(a.importer) ? { path: 'riepilogo', namespace: 'riepilogo-finto' } : undefined));
      b.onLoad({ filter: /.*/, namespace: 'riepilogo-finto' }, () => ({ contents: RIEPILOGO_FINTO, loader: 'js', resolveDir: qui('.') }));
    } }],
  });
  return import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
}

const ePiano = (args) => !!(args.response_json_schema && args.response_json_schema.properties && args.response_json_schema.properties.strumenti);

/**
 * Una domanda a EcoTyna: { stato, j, prompt, schema, salvata, scritte }. piano e
 * risposta sono quello che il modello finto restituisce; db l'archivio di partenza.
 */
export async function chiedi(modulo, { domanda, piano = { strumenti: [] }, risposta, db = {}, ruolo = 'admin', guasti = [], riepilogo, corpo = {} }) {
  globalThis.__DB = JSON.parse(JSON.stringify(db));
  globalThis.__SCRITTE = [];
  globalThis.__LLM = [];
  globalThis.__RUOLO = ruolo;
  globalThis.__GUASTI = guasti;
  globalThis.__RIEPILOGO = riepilogo;
  globalThis.__RISPONDI = (args) => (ePiano(args) ? piano : risposta);
  const r = await modulo.default({ json: async () => ({ domanda, ...corpo }) });
  const j = await r.json();
  const risposte = globalThis.__LLM.filter(a => !ePiano(a));
  const ultima = risposte[risposte.length - 1] || {};
  const salvate = globalThis.__SCRITTE.filter(s => s.op === 'update' && s.entita === 'DomandaAssistente' && s.dati.stato === 'completata');
  return {
    stato: r.status, j, prompt: String(ultima.prompt || ''), schema: ultima.response_json_schema || {}, internet: !!ultima.add_context_from_internet,
    salvata: salvate.length ? salvate[salvate.length - 1].dati : null, scritte: globalThis.__SCRITTE,
  };
}
