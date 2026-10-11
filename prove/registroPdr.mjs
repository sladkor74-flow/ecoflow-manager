// L'ANAGRAFICA DEI PDR RISCRITTA A META' NON E' «CARICATA OGGI»
// (revisione della chiusura, 11/10/2026).
//
// importPdrFile svuota l'anagrafica (Pdr.deleteMany) e la riscrive a blocchi di
// cento. Se un blocco non entrava scriveva nel registro «parziale» senza la
// modalita': era l'unico caricamento a non scriverla. Per la regola del
// registro (registroCaricamenti.ts), che dall'11/10 usa anche la dashboard, un
// «parziale» senza «sostituzione» e' un caricamento riuscito: l'anagrafica con
// cento PDR in meno risultava «caricata oggi», e spariva la voce che prima
// diceva quanto era vecchio l'ultimo caricamento riuscito.
//
// Qui la funzione vera, impacchettata con un SDK finto, un foglio finto e uno
// scaricamento finto; poi le righe che scrive, giudicate dalla regola del
// registro e dalla dashboard. npm run prove
import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'node:url';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const R = await import(pathToFileURL(qui('../base44/shared/registroCaricamenti.ts')).href);
const C = await import(pathToFileURL(qui('../base44/shared/cruscotto.ts')).href);

// L'SDK finto: l'anagrafica vuota, il registro che si scrive, e un blocco che
// non entra mai (quello che contiene il PDR 999) o una cancellazione che cade.
const SDK_FINTO = `
const entita = (nome) => ({
  list: async () => [],
  filter: async () => [],
  create: async (r) => { if (nome === 'UploadLog') globalThis.__SCRITTO.push({ ...r }); return { id: 'n' + globalThis.__SCRITTO.length, ...r }; },
  update: async (id, r) => ({ id, ...r }),
  bulkCreate: async (righe) => {
    if (globalThis.__BLOCCO_ROTTO && righe.some(r => r.id_pdr === 999)) throw new Error('database non raggiungibile');
    globalThis.__SCRITTI_PDR += righe.length; return righe;
  },
  delete: async () => ({}),
  deleteMany: async () => { if (globalThis.__CANCELLAZIONE_CADE) throw new Error('socket hang up'); return {}; },
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
const integrations = { Core: { CreateFileSignedUrl: async () => ({ signed_url: 'http://finto/PDR.xlsx' }) } };
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: 'admin', email: 'prova@prova', full_name: 'Prova' }) }, asServiceRole: { entities, integrations }, entities, integrations };
}`;
// Il foglio: la riga delle intestazioni attese e le righe dei PDR.
const XLSX_FINTO = `
export const read = () => ({ SheetNames: ['Foglio1'], Sheets: { Foglio1: {} } });
export const utils = { sheet_to_json: () => globalThis.__RIGHE_FOGLIO };`;

const pacchetto = await build({
  entryPoints: [qui('../base44/functions/importPdrFile/entry.ts')],
  bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
  plugins: [{ name: 'finti', setup(b) {
    b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
    b.onResolve({ filter: /^npm:xlsx/ }, () => ({ path: 'xlsx', namespace: 'xlsx-finto' }));
    b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
    b.onLoad({ filter: /.*/, namespace: 'xlsx-finto' }, () => ({ contents: XLSX_FINTO, loader: 'js' }));
  } }],
});
const importPdr = (await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'))).default;

const INTESTAZIONI = ['Soft deleted', 'ID Cliente', 'Codice Esterno', 'Ragione Sociale', 'Sede Legale', 'CAP', 'Comune', 'Prov.', 'Nazione',
  'Riferimento', 'Tel', 'Fax', 'Email', 'Cod. Fiscale', 'Partita IVA', 'Codice Import', 'ID PDR', 'Cod. Esterno PDR', 'Descrizione', 'Indirizzo',
  'CAP', 'Comune', 'Prov.', 'Nazione', 'Riferimento', 'Tel', 'Fax', 'Email', 'Iscrizione al R.E.N.T.Ri.', 'ID U/L RENTRi', 'Tipo di formulario',
  'Sospeso', 'KeyAccount', 'Partner Operativo', 'Trasportatore Principale', 'Latitudine', 'Longitudine', 'Approsimazione', 'PlaceID'];
// Centocinquanta PDR: due blocchi da cento; il PDR 999 sta nel secondo.
const riga = (i) => { const r = new Array(39).fill(null); r[0] = false; r[1] = 1000 + i; r[3] = 'Gommista ' + i; r[16] = i === 149 ? 999 : i + 1; return r; };
const FOGLIO = [INTESTAZIONI, ...Array.from({ length: 150 }, (_, i) => riga(i))];

// Le pause della funzione (fra un blocco e l'altro, e fra un tentativo e
// l'altro) qui non servono.
const pausaVera = globalThis.setTimeout;
globalThis.setTimeout = (fn) => pausaVera(fn, 0);
globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });

const carica = async ({ corpo = {}, foglio = FOGLIO, bloccoRotto = false, cancellazioneCade = false } = {}) => {
  globalThis.__SCRITTO = []; globalThis.__SCRITTI_PDR = 0; globalThis.__RIGHE_FOGLIO = foglio;
  globalThis.__BLOCCO_ROTTO = bloccoRotto; globalThis.__CANCELLAZIONE_CADE = cancellazioneCade;
  const r = await importPdr({ json: async () => ({ file_uri: 'privato/PDR.xlsx', nome_file: 'PDR.xlsx', replace_existing: true, ...corpo }) });
  return { stato: r.status, j: await r.json(), registro: globalThis.__SCRITTO.map(x => ({ ...x, tipo_file: x.tipo_file || 'pdr' })) };
};

// Il registro come lo legge la dashboard: il caricamento riuscito del 15/09 e,
// dopo, la riga che la funzione ha appena scritto (data di oggi).
const RIUSCITO_SETTEMBRE = { id: 'p1', tipo_file: 'pdr', esito: 'successo', modalita: 'sostituzione', created_date: '2026-09-15T07:00:00', nome_file: 'PDR.xlsx' };
const oggi = '2026-10-11', adesso = Date.parse('2026-10-11T08:00:00Z');
const conLaRiga = (scritta) => [{ id: 'p2', ...scritta, created_date: '2026-10-11T07:00:00' }, RIUSCITO_SETTEMBRE];
const dashboard = (registro) => C.cruscotto({ oggi, anno: 2026, adessoMs: adesso, tipiFile: ['pdr'], uploadLogs: registro, alertAperti: [], assegnatiRete: [], assegnatiAci: [], documenti: [], prefatture: [], richiesteEct: [] });

console.log('LA RISCRITTURA FINITA PARZIALE');
{
  const x = await carica({ bloccoRotto: true });
  const scritta = x.registro[x.registro.length - 1] || {};
  verifica('un blocco non entra: esito «parziale», 100 PDR su 150', x.j.esito === 'parziale' && scritta.esito === 'parziale' && scritta.righe_importate === 100 && scritta.righe_fallite === 50, JSON.stringify(scritta));
  verifica('e la riga dice che ha riscritto l\'anagrafica: modalita\' «sostituzione»', scritta.modalita === 'sostituzione', JSON.stringify(scritta));
  const stato = R.statoDelRegistro(conLaRiga(scritta), ['pdr'], adesso);
  verifica('per la regola del registro l\'anagrafica e\' inaffidabile: va ricaricata', stato.in_corso.length === 1 && stato.in_corso[0].esito === 'errore' && stato.ultimi.pdr.data === '2026-09-15', JSON.stringify(stato));
  const d = dashboard(conLaRiga(scritta));
  const a = d.caricamenti.archivi[0];
  verifica('la dashboard non la dice «caricata oggi»: l\'ultimo riuscito resta il 15/09', a.il === '2026-09-15' && a.stato === 'non_riuscito', JSON.stringify(a));
  verifica('e la voce rossa dice di ricaricare il file', d.da_gestire.some(v => v.gravita === 'critico' && v.titolo === 'Caricamento non riuscito: ricarica il file (Punti di raccolta)'), d.da_gestire.map(v => v.titolo).join(' | '));
}

console.log('L\'AGGIUNTA FINITA PARZIALE');
{
  const x = await carica({ bloccoRotto: true, corpo: { replace_existing: false } });
  const scritta = x.registro[x.registro.length - 1] || {};
  verifica('senza sostituzione la riga dice «aggiunta»', scritta.esito === 'parziale' && scritta.modalita === 'aggiunta', JSON.stringify(scritta));
  const d = dashboard(conLaRiga(scritta));
  verifica('e conta come caricata: l\'anagrafica di prima e\' intatta', d.caricamenti.archivi[0].il === '2026-10-11' && !d.caricamenti.archivi[0].stato, JSON.stringify(d.caricamenti.archivi[0]));
}

console.log('LA RISCRITTURA RIUSCITA, E QUELLA CHE CADE DURANTE LA CANCELLAZIONE');
{
  const x = await carica();
  const scritta = x.registro[x.registro.length - 1] || {};
  verifica('tutto entra: «successo» con la sua modalita\'', scritta.esito === 'successo' && scritta.modalita === 'sostituzione' && x.j.righe_importate === 150, JSON.stringify(scritta));
  const y = await carica({ cancellazioneCade: true });
  const caduta = y.registro[y.registro.length - 1] || {};
  verifica('la cancellazione cade a meta\': l\'errore si scrive come riscrittura non riuscita', y.stato === 500 && caduta.esito === 'errore' && caduta.modalita === 'sostituzione', JSON.stringify(caduta));
  const d = dashboard(conLaRiga(caduta));
  verifica('e la dashboard lo dice', d.caricamenti.archivi[0].stato === 'non_riuscito', JSON.stringify(d.caricamenti.archivi[0]));
}

console.log('UN FILE RIFIUTATO A DATI INTATTI NON BLOCCA NIENTE');
{
  const sbagliato = [INTESTAZIONI.map((h, i) => (i === 3 ? 'Nome' : h)), ...FOGLIO.slice(1)];
  const x = await carica({ foglio: sbagliato });
  const scritta = x.registro[x.registro.length - 1] || {};
  verifica('intestazioni sbagliate: «errore» senza modalita\', l\'anagrafica non si e\' toccata', x.stato === 400 && scritta.esito === 'errore' && !scritta.modalita, JSON.stringify(scritta));
  const d = dashboard(conLaRiga(scritta));
  verifica('e la dashboard non grida: resta il caricamento del 15/09, senza stato', d.caricamenti.archivi[0].il === '2026-09-15' && !d.caricamenti.archivi[0].stato, JSON.stringify(d.caricamenti.archivi[0]));
}

console.log('LE RIGHE GIA\' SCRITTE PRIMA DELL\'11/10/2026');
{
  // Il caso della revisione: le righe come le scriveva importPdrFile, senza
  // modalita'. La pagina chiede sempre la sostituzione, e un «parziale» nasce
  // solo dopo lo svuotamento: era una riscrittura a meta'.
  const registro = [
    { id: 'p2', tipo_file: 'pdr', esito: 'parziale', created_date: '2026-10-11T07:00:00', nome_file: 'PDR.xlsx', righe_importate: 3900, righe_fallite: 100, messaggio: '3900 PDR importati su 4000 totali (foglio: Foglio1)' },
    { id: 'p1', tipo_file: 'pdr', esito: 'successo', created_date: '2026-09-15T07:00:00', nome_file: 'PDR.xlsx', righe_importate: 4000, righe_fallite: 0 },
  ];
  const d = dashboard(registro);
  const a = d.caricamenti.archivi[0];
  verifica('un «parziale» dei PDR senza modalita\' e\' una riscrittura non riuscita', a.il === '2026-09-15' && a.stato === 'non_riuscito', JSON.stringify(a));
  verifica('e torna la voce sull\'eta\' dell\'ultimo caricamento riuscito', d.da_gestire.some(v => v.titolo === 'Punti di raccolta: dati di 26 giorni fa'), d.da_gestire.map(v => v.titolo).join(' | '));
  // Solo i PDR: gli altri caricamenti la modalita' la scrivono da sempre, e un
  // loro parziale senza modalita' resta quello che era.
  const altro = R.statoDelRegistro([{ id: 'g1', tipo_file: 'gommisti', esito: 'parziale', created_date: '2026-10-11T07:00:00' }], ['gommisti'], adesso);
  verifica('un parziale senza modalita\' di un altro file non cambia', altro.in_corso.length === 0 && altro.ultimi.gommisti && altro.ultimi.gommisti.data === '2026-10-11', JSON.stringify(altro));
}

globalThis.setTimeout = pausaVera;
console.log(`\n${ok} superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
