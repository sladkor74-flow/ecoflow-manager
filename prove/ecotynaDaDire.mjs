// Prova della VERSIONE PARLATA E DEL TONO DI ECOTYNA, sulla funzione vera
// (utente, 11/10/2026: «vorrei rendere EcoTyna piu' realistica e con una voce
// meno robotica»).
//
// chiediAssistente si impacchetta con un SDK finto: l'archivio in memoria e il
// modello finto, che risponde al pianificatore e poi alla domanda. Si controlla:
//   1. che al modello si chieda da_dire, la versione da dire a voce, sia sulle
//      domande di norma sia su quelle sui dati (i due schemi della risposta);
//   2. che le istruzioni portino il tono (T: frasi intere, del tu, i nomi come si
//      dicono, niente stile telegrafico) e la regola della voce (V), e che la
//      regola D chieda la prima frase in italiano naturale;
//   3. che da_dire passi dalla stessa conversione della risposta (numeri e date
//      all'italiana), si salvi con la risposta e arrivi alla pagina;
//   4. che, se l'archivio rifiuta il campo, la risposta si salvi lo stesso.
// npm run prove
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const SDK_FINTO = `
const tabella = (nome) => (globalThis.__DB[nome] = globalThis.__DB[nome] || []);
const uguale = (r, f) => Object.entries(f || {}).every(([k, v]) => r[k] === v);
let progressivo = 0;
const entita = (nome) => ({
  list: async (_o, quanti = 5000, salta = 0) => tabella(nome).slice(salta, salta + quanti).map(r => ({ ...r })),
  filter: async (f, _o, quanti = 5000, salta = 0) => tabella(nome).filter(r => uguale(r, f)).slice(salta, salta + quanti).map(r => ({ ...r })),
  get: async (id) => ({ ...(tabella(nome).find(x => x.id === id) || {}) }),
  create: async (r) => { const nuovo = { id: nome + '-' + (++progressivo), ...r }; tabella(nome).push(nuovo); globalThis.__SCRITTE.push({ op: 'create', entita: nome, dati: r }); return { ...nuovo }; },
  update: async (id, r) => {
    const rifiutati = Object.keys(r).filter(k => (globalThis.__RIFIUTA || []).includes(k));
    if (rifiutati.length) throw new Error('Error in field ' + rifiutati[0] + ': extra fields not permitted');
    const t = tabella(nome); const i = t.findIndex(x => x.id === id); if (i >= 0) t[i] = { ...t[i], ...r };
    globalThis.__SCRITTE.push({ op: 'update', entita: nome, id, dati: r }); return { ...(t[i] || {}), ...r };
  },
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

const pacchetto = await build({
  entryPoints: [fileURLToPath(new URL('../base44/functions/chiediAssistente/entry.ts', import.meta.url))],
  bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
  plugins: [{ name: 'sdk-finto', setup(b) {
    b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
    b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
  } }],
});
const modulo = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));

const chiedi = async ({ domanda, piano, risposta, rifiuta = [] }) => {
  globalThis.__DB = {};
  globalThis.__SCRITTE = [];
  globalThis.__LLM = [];
  globalThis.__RUOLO = 'admin';
  globalThis.__RIFIUTA = rifiuta;
  globalThis.__RISPONDI = (args) => (args.response_json_schema && args.response_json_schema.properties && args.response_json_schema.properties.strumenti ? piano : risposta);
  const r = await modulo.default({ json: async () => ({ domanda }) });
  const j = await r.json();
  const risposte = globalThis.__LLM.filter(a => !(a.response_json_schema && a.response_json_schema.properties && a.response_json_schema.properties.strumenti));
  const ultima = risposte[risposte.length - 1] || {};
  const salvate = globalThis.__SCRITTE.filter(s => s.op === 'update' && s.entita === 'DomandaAssistente' && s.dati.stato === 'completata');
  return { stato: r.status, j, schema: ultima.response_json_schema || {}, prompt: String(ultima.prompt || ''), salvata: salvate[salvate.length - 1] };
};

const RISPOSTA = {
  risposta: 'Il responsabile tecnico controlla che l\'impianto sia autorizzato per i PFU. Al 2026-10-05 ne risultano 1600.00 euro di tariffa media.',
  da_dire: 'Deve controllare che l\'impianto sia autorizzato per i PFU: al 2026-10-05 la tariffa media e\' 1600.00 euro.',
  certezza: 'alta',
  fonti: [],
};

console.log('1. UNA DOMANDA DI NORMA');
{
  const e = await chiedi({
    domanda: 'Che cosa deve verificare il responsabile tecnico prima di affidare i PFU a un impianto?',
    piano: { strumenti: [], serve_normativa: true },
    risposta: RISPOSTA,
  });
  verifica('la funzione risponde', e.stato === 200, JSON.stringify(e.j).slice(0, 300));
  verifica('al modello si chiede la versione parlata', e.schema.properties && e.schema.properties.da_dire && e.schema.properties.da_dire.type === 'string', JSON.stringify(Object.keys(e.schema.properties || {})));
  verifica('ma non e\' obbligatoria: una risposta senza resta valida', JSON.stringify(e.schema.required) === '["risposta"]');
  verifica('le istruzioni portano il tono', /T\. IL TONO\. Scrivi come una collega esperta dell'ufficio che risponde a un collega: dai del tu, frasi intere in italiano naturale/.test(e.prompt));
  verifica('...con l\'esempio telegrafico da non seguire e quello giusto',
    /non "GREEN TYRE PROJECT SRL, rete, luglio 2026: 412,30 t; agosto 2026: 398,10 t", ma "A luglio 2026 Green Tyre ha raccolto 412,30 t sulla rete, ad agosto 398,10 t\."/.test(e.prompt));
  verifica('...i nomi come si dicono, ma interi quando si somigliano', /senza la forma societaria \(Srl, Spa\) e non tutte maiuscole/.test(e.prompt) && /Silvano Renato e Silvano Trasporti\) scrivili per intero/.test(e.prompt));
  verifica('...e il tono non cambia i numeri, ne\' porta consigli non chiesti', /niente consigli o piani d'azione che non sono stati chiesti\. Il tono cambia la forma, non i numeri/.test(e.prompt));
  verifica('le istruzioni portano la regola della voce', /V\. LA VERSIONE PARLATA\. In da_dire scrivi la stessa risposta come la diresti a voce a un collega: due o tre frasi, senza elenchi, tabelle/.test(e.prompt)
    && /I numeri che sono la risposta li dici esatti e all'italiana/.test(e.prompt) && /i canali non si sommano, un dato che manca non e' zero/.test(e.prompt));
  verifica('da_dire passa dalla conversione all\'italiana, come la risposta',
    e.j.da_dire === 'Deve controllare che l\'impianto sia autorizzato per i PFU: al 05/10/2026 la tariffa media e\' 1.600,00 euro.', e.j.da_dire);
  verifica('si salva con la risposta', !!e.j.da_dire && e.salvata && e.salvata.dati.da_dire === e.j.da_dire && /1\.600,00 euro/.test(e.salvata.dati.risposta), JSON.stringify(e.salvata && e.salvata.dati).slice(0, 300));
  verifica('e arriva alla pagina anche nel record', !!e.j.da_dire && e.j.record && e.j.record.da_dire === e.j.da_dire);
}

console.log('2. UNA DOMANDA SUI DATI');
{
  const e = await chiedi({
    domanda: 'Quando sono stati caricati gli ultimi file?',
    piano: { strumenti: [{ nome: 'caricamenti', parametri: {}, perche: 'la domanda e\' sui caricamenti' }], serve_normativa: false },
    risposta: { risposta: 'Le primarie non risultano caricate.', da_dire: 'Le primarie non risultano caricate.', certezza: 'alta' },
  });
  verifica('la funzione risponde', e.stato === 200, JSON.stringify(e.j).slice(0, 300));
  verifica('e\' la strada dei dati: niente fonti nello schema', e.schema.properties && !e.schema.properties.fonti, JSON.stringify(Object.keys(e.schema.properties || {})));
  verifica('anche qui si chiede la versione parlata', e.schema.properties && e.schema.properties.da_dire && e.schema.properties.da_dire.type === 'string');
  verifica('la regola D chiede la prima frase in italiano naturale',
    /D\. Il numero va nella PRIMA FRASE, con la sua etichetta \(soggetto, canale e periodo\), detto in italiano naturale come vuole la regola T\. Esempio: "Ad agosto 2026 Emmesse ha raccolto 412,30 t sulla rete, in 58 formulari\."/.test(e.prompt));
  verifica('niente piu\' l\'esempio telegrafico come modello', !/Esempio: "EMMESSE, rete, agosto 2026/.test(e.prompt));
  verifica('la regola dei consigli non chiesti resta', /D-quater\. Non aggiungere consigli, piani d'azione o raccomandazioni che non sono stati chiesti/.test(e.prompt));
  verifica('e il tono vale anche qui', /T\. IL TONO\./.test(e.prompt) && /V\. LA VERSIONE PARLATA\./.test(e.prompt));
}

console.log('3. SE L\'ARCHIVIO NON CONOSCE IL CAMPO');
{
  const e = await chiedi({
    domanda: 'Che cosa deve verificare il responsabile tecnico prima di affidare i PFU a un impianto?',
    piano: { strumenti: [], serve_normativa: true },
    risposta: RISPOSTA,
    rifiuta: ['da_dire'],
  });
  verifica('la risposta si salva lo stesso', e.stato === 200 && e.salvata && /1\.600,00 euro/.test(e.salvata.dati.risposta) && !('da_dire' in e.salvata.dati), JSON.stringify(e.j).slice(0, 300));
  verifica('e la pagina riceve comunque la versione parlata', /1\.600,00 euro/.test(e.j.da_dire || ''), e.j.da_dire);
}
{
  const e = await chiedi({
    domanda: 'Che cosa deve verificare il responsabile tecnico prima di affidare i PFU a un impianto?',
    piano: { strumenti: [], serve_normativa: true },
    risposta: { risposta: 'Deve controllare l\'autorizzazione.', certezza: 'alta' },
  });
  verifica('senza versione parlata non si scrive un campo vuoto', e.stato === 200 && e.salvata && !('da_dire' in e.salvata.dati) && e.j.da_dire === '', JSON.stringify(e.salvata && e.salvata.dati).slice(0, 200));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
