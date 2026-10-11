// IL MOTIVO DEL RINVIO ARRIVA A VIDEO (revisione della chiusura, 11/10/2026).
//
// Il congelamento della passiva (Consuntivi, in Verifiche Fornitori) e il
// salvataggio della chiusura dell'anno (Giacenze) rispondono 409 «rinviato» col
// motivo quando un archivio che leggono si sta riscrivendo o e' rimasto a meta'.
// Il client delle funzioni lancia pero' un errore per ogni risposta non 2xx, e
// le due pagine mostravano il suo message: «Request failed with status code
// 409», in inglese e senza dire quale caricamento ripetere.
//
// Qui si fa tutto il giro vero: le due funzioni impacchettate con un SDK finto
// che risponde un registro con le primarie riscritte stamattina e finite
// «parziale»; il client delle funzioni dell'SDK installato, con un adattatore
// che risponde quello che risponde la funzione; e, dal sorgente delle due
// pagine, l'espressione che finisce a video nel catch. npm run prove
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const SDK_FINTO = `
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => (v && typeof v === 'object' && Array.isArray(v.$in)) ? v.$in.includes(r[k]) : r[k] === v);
const entita = (nome) => ({
  list: async () => [],
  filter: async (f, _s, lim) => (nome === 'UploadLog' ? globalThis.__REGISTRO.filter(r => soddisfa(r, f)).slice(0, lim || 1e9) : []),
  create: async (r) => ({ id: 'n', ...r }), update: async (id, r) => ({ id, ...r }), bulkCreate: async (x) => x,
  delete: async () => ({}), deleteMany: async () => ({}),
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
const integrations = { Core: new Proxy({}, { get: () => async () => ({}) }) };
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: 'admin', email: 'prova@prova', full_name: 'Prova' }) }, asServiceRole: { entities, integrations }, entities, integrations, functions: { invoke: async () => ({ data: {} }) } };
}`;

const funzione = async (nome) => {
  const pacchetto = await build({
    entryPoints: [qui(`../base44/functions/${nome}/entry.ts`)],
    bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
    plugins: [{ name: 'sdk-finto', setup(b) {
      b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
      b.onResolve({ filter: /^npm:xlsx/ }, () => ({ path: 'xlsx', namespace: 'xlsx-finto' }));
      b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
      b.onLoad({ filter: /.*/, namespace: 'xlsx-finto' }, () => ({ contents: 'export const read = () => ({ SheetNames: [] }); export const utils = { sheet_to_json: () => [] };', loader: 'js' }));
    } }],
  });
  return (await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'))).default;
};

// Le primarie riscritte stamattina e finite «parziale»: l'archivio e' a meta'.
globalThis.__REGISTRO = [{
  id: 'u1', tipo_file: 'primarie', esito: 'parziale', modalita: 'sostituzione', nome_file: 'PRIMARIE.xlsx', utente: 'Antonio',
  created_date: new Date(Date.now() - 3600e3).toISOString().replace('Z', ''),
}];

// Il client delle funzioni come lo crea l'SDK installato, con un adattatore che
// risponde quello che risponde la funzione vera.
const { createAxiosClient } = await import(pathToFileURL(qui('../node_modules/@base44/sdk/dist/utils/axios-client.js')).href);
const { createFunctionsModule } = await import(pathToFileURL(qui('../node_modules/@base44/sdk/dist/modules/functions.js')).href);
const { AxiosError } = await import(pathToFileURL(qui('../node_modules/axios/index.js')).href);
const invocaCome = (f) => {
  const ax = createAxiosClient({ baseURL: 'http://finto/api', interceptResponses: false });
  ax.defaults.adapter = async (config) => {
    const r = await f({ json: async () => JSON.parse(config.data || '{}') });
    const risposta = { data: await r.json(), status: r.status, statusText: '', headers: {}, config, request: {} };
    if (r.status >= 200 && r.status < 300) return risposta;
    throw new AxiosError('Request failed with status code ' + r.status, 'ERR_BAD_REQUEST', config, {}, risposta);
  };
  return createFunctionsModule(ax, 'app').invoke;
};
const erroreDi = async (nome, corpo) => {
  try { await invocaCome(await funzione(nome))(nome, corpo); return null; } catch (e) { return e; }
};

// Dal sorgente della pagina: l'aiuto che legge il motivo (se c'e') e
// l'espressione che il catch mette a video, valutate sull'errore vero.
const sorgente = (p) => readFileSync(qui('../' + p), 'utf8').replace(/\r/g, '');
const aiuto = (src) => {
  const m = src.match(/^const motivoErrore = (\(e\) => [^\n]+);$/m);
  return m ? new Function(`return ${m[1]};`)() : undefined;
};
const aVideo = (espressione, src, e) => new Function('motivoErrore', 'e', `return ${espressione};`)(aiuto(src), e);

console.log('CONSUNTIVI: IL CONGELAMENTO DELLA PASSIVA RINVIATO');
{
  const e = await erroreDi('congelaPassivaMese', { anno: 2026, mese: 9, canale: 'RETE', nota: 'chiusura del mese' });
  const motivo = e && e.response && e.response.data && e.response.data.error;
  verifica('la funzione risponde 409 col motivo (le primarie da ricaricare)', e && e.response.status === 409 && /Rinviato/.test(motivo || '') && /primarie/.test(motivo) && /Ricarica il file/.test(motivo), String(motivo));
  verifica('e il client lo lancia come «Request failed with status code 409»', e && e.message === 'Request failed with status code 409', e && e.message);
  const src = sorgente('src/components/verifiche-fornitori/Consuntivi.jsx');
  const blocco = src.slice(src.indexOf('const congela = async'), src.indexOf('const c = esito && esito.confronto'));
  const presa = blocco.match(/\} catch \(e\) \{ setErrore\(([^;]+)\); \}/);
  verifica('il catch di «Congela» si trova', !!presa, blocco.slice(-300));
  const testo = presa ? aVideo(presa[1], src, e) : null;
  verifica('a video arriva il motivo del server, non il codice di stato', testo === motivo, String(testo));
}

console.log('CHIUSURA DELL\'ANNO: IL SALVATAGGIO RINVIATO');
{
  const e = await erroreDi('chiusuraAnno', { anno: 2025, azione: 'salva', letture: {}, decisioni: {}, letture_impianti: {}, lettera_fogli: null, sostituisci: false });
  const motivo = e && e.response && e.response.data && e.response.data.error;
  verifica('la funzione risponde 409 col motivo', e && e.response.status === 409 && /Rinviato/.test(motivo || '') && /Ricarica il file/.test(motivo || ''), String(motivo));
  const src = sorgente('src/components/giacenze/ChiusuraAnno.jsx');
  const blocco = src.slice(src.indexOf('const salva = async'), src.indexOf('const pronti = useMemo'));
  const presa = blocco.match(/riusciti a salvare', description: ([^,]+), variant: 'destructive'/);
  verifica('il toast di «Salva» si trova', !!presa, blocco.slice(-300));
  const testo = presa ? aVideo(presa[1], src, e) : null;
  verifica('a video arriva il motivo del server, non il codice di stato', testo === motivo, String(testo));
  // Anche la preparazione: un 500 col suo messaggio non diventa «status code 500».
  const prepara = blocco.length && src.slice(src.indexOf('const carica = async'), src.indexOf('// Cambiando anno si riparte da capo'));
  const presaPrepara = String(prepara).match(/riusciti a preparare la chiusura', description: ([^,]+), variant: 'destructive'/);
  const finto500 = new AxiosError('Request failed with status code 500', 'ERR_BAD_RESPONSE', {}, {}, { status: 500, data: { error: 'Anno non valido' } });
  verifica('e la preparazione dice il messaggio del server', presaPrepara && aVideo(presaPrepara[1], src, finto500) === 'Anno non valido', presaPrepara && String(aVideo(presaPrepara[1], src, finto500)));
}

console.log('SENZA RISPOSTA DEL SERVER RESTA IL MESSAGGIO DELL\'ERRORE');
{
  const src = sorgente('src/components/verifiche-fornitori/Consuntivi.jsx');
  const m = aiuto(src);
  verifica('un errore senza risposta (la rete caduta) si dice col suo messaggio', m && m(new Error('Network Error')) === 'Network Error');
  verifica('e una stringa lanciata si dice com\'e\'', m && m('qualcosa') === 'qualcosa');
}

console.log(`\n${ok} superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
