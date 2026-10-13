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
// registro e dalla dashboard.
//
// E LA SOSTITUZIONE CHE NON ARRIVA IN FONDO RIMETTE L'ANAGRAFICA COM'ERA (audit
// del 20/09, alta A16; corretta il 12/10/2026): prima i PDR mancanti restavano
// mancanti fino al file successivo. L'SDK finto tiene un'anagrafica vera, in
// memoria, e la prova guarda che cosa resta dentro. npm run prove
import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'node:url';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const R = await import(pathToFileURL(qui('../base44/shared/registroCaricamenti.ts')).href);
const C = await import(pathToFileURL(qui('../base44/shared/cruscotto.ts')).href);

// L'SDK finto: l'anagrafica dei PDR in memoria (globalThis.__PDR), il registro
// che si scrive, un blocco che non entra mai (quello che contiene il PDR 999),
// una cancellazione che cade (a meta': ne toglie la meta' e poi si ferma) un
// certo numero di volte, e un ripristino che non entra (le righe «Vecchio»).
const SDK_FINTO = `
const entita = (nome) => ({
  list: async (_ordine, quanti = 1000, salta = 0) => (nome === 'Pdr' ? globalThis.__PDR.slice(salta, salta + quanti).map(r => ({ ...r })) : []),
  filter: async () => [],
  create: async (r) => { if (nome === 'UploadLog') globalThis.__SCRITTO.push({ ...r }); return { id: 'n' + globalThis.__SCRITTO.length, ...r }; },
  update: async (id, r) => ({ id, ...r }),
  bulkCreate: async (righe) => {
    if (globalThis.__BLOCCO_ROTTO && righe.some(r => r.id_pdr === 999)) throw new Error('database non raggiungibile');
    if (globalThis.__RIPRISTINO_CADE && righe.some(r => /^Vecchio/.test(String(r.ragione_sociale)))) throw new Error('database non raggiungibile');
    if (righe.some(r => 'id' in r || 'created_date' in r || 'created_by_id' in r)) globalThis.__CAMPI_DI_SISTEMA = true;
    for (const r of righe) globalThis.__PDR.push({ ...r, id: 'pdr' + (++globalThis.__CONTATORE), created_date: '2026-10-12T08:00:00' });
    globalThis.__SCRITTI_PDR += righe.length; return righe;
  },
  delete: async () => ({}),
  deleteMany: async () => {
    if (nome !== 'Pdr') return {};
    if (globalThis.__CADUTE_CANCELLAZIONE > 0) {
      globalThis.__CADUTE_CANCELLAZIONE--;
      globalThis.__PDR.splice(0, Math.floor(globalThis.__PDR.length / 2));
      throw new Error('socket hang up');
    }
    globalThis.__PDR = []; return {};
  },
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

// L'anagrafica di prima: centoventi PDR «Vecchio», con i campi che la
// piattaforma assegna da se'. Tutti nel file nuovo, che ne ha centocinquanta:
// il controllo anti-regressione lascia passare.
const ANAGRAFICA_DI_PRIMA = Array.from({ length: 120 }, (_, i) => ({
  id: 'v' + i, created_date: '2026-09-15T07:00:00', updated_date: '2026-09-15T07:00:00', created_by_id: 'u1',
  id_cliente: 1000 + i, ragione_sociale: 'Vecchio ' + i, id_pdr: i + 1, comune_pdr: 'Bari',
}));
const contenuto = (righe) => JSON.stringify(righe.map(r => [r.id_pdr, r.ragione_sociale, r.comune_pdr || null]).sort((a, b) => a[0] - b[0]));

const carica = async ({ corpo = {}, foglio = FOGLIO, bloccoRotto = false, cancellazioneCade = false, ripristinoCade = false, archivio = ANAGRAFICA_DI_PRIMA } = {}) => {
  globalThis.__SCRITTO = []; globalThis.__SCRITTI_PDR = 0; globalThis.__RIGHE_FOGLIO = foglio;
  globalThis.__BLOCCO_ROTTO = bloccoRotto; globalThis.__RIPRISTINO_CADE = ripristinoCade;
  globalThis.__CADUTE_CANCELLAZIONE = cancellazioneCade === true ? Infinity : Number(cancellazioneCade) || 0;
  globalThis.__PDR = archivio.map(r => ({ ...r })); globalThis.__CONTATORE = 0; globalThis.__CAMPI_DI_SISTEMA = false;
  const r = await importPdr({ json: async () => ({ file_uri: 'privato/PDR.xlsx', nome_file: 'PDR.xlsx', replace_existing: true, ...corpo }) });
  return { stato: r.status, j: await r.json(), registro: globalThis.__SCRITTO.map(x => ({ ...x, tipo_file: x.tipo_file || 'pdr' })), pdr: globalThis.__PDR };
};

// Il registro come lo legge la dashboard: il caricamento riuscito del 15/09 e,
// dopo, la riga che la funzione ha appena scritto (data di oggi).
const RIUSCITO_SETTEMBRE = { id: 'p1', tipo_file: 'pdr', esito: 'successo', modalita: 'sostituzione', created_date: '2026-09-15T07:00:00', nome_file: 'PDR.xlsx' };
const oggi = '2026-10-11', adesso = Date.parse('2026-10-11T08:00:00Z');
const conLaRiga = (scritta) => [{ id: 'p2', ...scritta, created_date: '2026-10-11T07:00:00' }, RIUSCITO_SETTEMBRE];
const dashboard = (registro) => C.cruscotto({ oggi, anno: 2026, adessoMs: adesso, tipiFile: ['pdr'], uploadLogs: registro, alertAperti: [], assegnatiRete: [], assegnatiAci: [], documenti: [], prefatture: [], richiesteEct: [] });

console.log('LA RISCRITTURA CHE NON ARRIVA IN FONDO RIMETTE L\'ANAGRAFICA COM\'ERA (A16)');
{
  const x = await carica({ bloccoRotto: true });
  const scritta = x.registro[x.registro.length - 1] || {};
  verifica('un blocco non entra: nell\'anagrafica tornano i 120 PDR di prima, coi loro dati, e nient\'altro',
    x.pdr.length === 120 && contenuto(x.pdr) === contenuto(ANAGRAFICA_DI_PRIMA), `${x.pdr.length} PDR`);
  verifica('il ripristino non riscrive i campi che la piattaforma assegna da se\'', globalThis.__CAMPI_DI_SISTEMA === false);
  verifica('chi carica lo sa subito: errore, dati intatti, ricarica il file',
    x.stato === 502 && x.j.ripristinata === true && x.j.dati_intatti === true && /ripristinata/.test(x.j.error) && /ricarica il file/.test(x.j.dettaglio), JSON.stringify(x.j));
  verifica('la riga del registro: errore senza modalita\', come un file rifiutato a dati intatti',
    scritta.esito === 'errore' && !scritta.modalita && scritta.righe_importate === 0 && /Ripristinata l'anagrafica di prima \(120 PDR\)/.test(scritta.messaggio), JSON.stringify(scritta));
  const d = dashboard(conLaRiga(scritta));
  const a = d.caricamenti.archivi[0];
  verifica('la dashboard non la dice «caricata oggi», e non grida: l\'anagrafica e\' quella del 15/09, intera', a.il === '2026-09-15' && !a.stato, JSON.stringify(a));
}

console.log('E SE NEMMENO IL RIPRISTINO ENTRA, LO DICE');
{
  const x = await carica({ bloccoRotto: true, ripristinoCade: true });
  const scritta = x.registro[x.registro.length - 1] || {};
  verifica('anagrafica incompleta: errore con modalita\' «sostituzione» e i numeri del ripristino',
    x.stato === 500 && x.j.dati_intatti === false && scritta.esito === 'errore' && scritta.modalita === 'sostituzione' && /fermato a 0 PDR su 120/.test(scritta.messaggio), JSON.stringify(scritta));
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
  verifica('e l\'anagrafica e\' quella del file nuovo, sola', x.pdr.length === 150 && !x.pdr.some(r => /^Vecchio/.test(r.ragione_sociale)), `${x.pdr.length} PDR`);
  const y = await carica({ cancellazioneCade: true });
  const caduta = y.registro[y.registro.length - 1] || {};
  verifica('la cancellazione cade a meta\' e non si riprende: l\'errore si scrive come riscrittura non riuscita', y.stato === 500 && caduta.esito === 'errore' && caduta.modalita === 'sostituzione' && y.j.dati_intatti === false, JSON.stringify(caduta));
  const d = dashboard(conLaRiga(caduta));
  verifica('e la dashboard lo dice', d.caricamenti.archivi[0].stato === 'non_riuscito', JSON.stringify(d.caricamenti.archivi[0]));
  // Una caduta sola: la cancellazione ne ha tolti meta', il ripristino li rimette.
  const z = await carica({ cancellazioneCade: 1 });
  const ripresa = z.registro[z.registro.length - 1] || {};
  verifica('la cancellazione cade una volta: il ripristino rimette i 120 PDR di prima, e il registro non grida',
    z.pdr.length === 120 && contenuto(z.pdr) === contenuto(ANAGRAFICA_DI_PRIMA) && ripresa.esito === 'errore' && !ripresa.modalita && z.j.dati_intatti === true && /Ripristinata/.test(ripresa.messaggio), JSON.stringify(ripresa));
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
