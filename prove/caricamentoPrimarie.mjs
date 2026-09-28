// Prova del caricamento a blocchi: le primarie e gli altri file grandi.
//
// Nasce dal file caricato due volte del 14/09/2026 e dalle 57 righe perse la
// notte del 24/09/2026, e dai varchi da cui sono passati:
//
//   (a) DOPPIONI SILENZIOSI. Quando il conteggio dell'archivio non riusciva, il
//       browser ritentava il blocco lo stesso: 200 righe gia' entrate venivano
//       scritte una seconda volta. E il controllo finale saltava gli archivi non
//       contati, cosi' il caricamento si chiudeva come "successo" con i doppioni
//       dentro. Adesso un blocco di cui non si sa niente resta in sospeso, e un
//       archivio non contato non e' un archivio a posto.
//   (b) IL SOLO TOTALE NON BASTA. Contare le righe e confrontarle con quelle del
//       file prende un blocco entrato due volte (+200) e uno perso (-200) presi
//       da soli, ma NON i due insieme: si compensano, il totale torna esatto e
//       il caricamento si chiudeva "successo" con 200 ordini contati doppi e 200
//       spariti. Il metro e' il confronto ORDINE PER ORDINE con le righe che
//       quell'ordine ha nel file.
//       ATTENZIONE: non e' "un id_ordine una volta sola". Lo stesso ordine sta
//       legittimamente in archivio con piu' righe, una per classe o per prodotto
//       (chiaveOrdine in movimenti.ts): un criterio del genere dichiarerebbe
//       guasto ogni caricamento pulito. La prova lo dimostra su un file di 100
//       ordini in 120 righe.
//   (c) ANTI-REGRESSIONE CHE CADE. Il confronto con gli ordini in archivio si fa
//       PRIMA dello svuotamento, che avviene dopo, archivio per archivio: se un
//       primo tentativo muore dopo aver svuotato le primarie di rete, al secondo
//       tentativo quegli ordini non ci sono piu' e un file monco passerebbe
//       senza che nessuno chieda niente. Adesso si chiede conferma, e il segnale
//       e' che l'archivio si e' rimpicciolito rispetto a com'era.
//   (d) IL GESTIONALE NON SI RIPARAVA. Quando l'archivio non quadrava si diceva
//       "ricarica il file" e ci si fermava li'. La notte del 24/09/2026 sono
//       state 11.293 righe nel file e 11.236 in archivio, 57 perse, e tutto da
//       rifare. Adesso: si aspetta e si riconta (un conteggio subito dopo una
//       scrittura grossa puo' rispondere indietro), poi si riscrivono SOLO le
//       righe degli ordini che non tornano, poi si riverifica.
//
// Si prova anche il percorso dei file che NON sono le primarie (ordini non
// dichiarati, dichiarazioni, secondarie, terziarie): li' un blocco rimasto in
// sospeso non veniva mai sciolto, e un archivio con 650 righe su 450 chiudeva
// "successo" scrivendo "archivio verificato: 650 record".
//
// Si prova il percorso vero, non una sua imitazione: il modulo del browser
// (src/lib/importGrandeFile.js) parla con la function vera
// (base44/functions/importaBlocco), impacchettati con esbuild e con un SDK finto
// che tiene gli archivi in memoria (come in importDate.mjs). In mezzo si
// infilano i guasti: la rete che cade dopo che il blocco e' gia' entrato, il
// conteggio che non risponde, il conteggio che risponde col numero di prima, lo
// stesso blocco scritto due volte, delle righe che non entrano. npm run prove

// Le funzioni girano su un server a UTC e i seriali Excel sono orari da
// calendario: si fissa lo stesso fuso, altrimenti le date cambiano per macchina.
process.env.TZ = 'UTC';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';

const XLSX = await import('xlsx');
const { SHEET_MAP } = await import('../base44/shared/excelSchemas.ts');
const { eEseguito, riepilogoEseguiti } = await import('../base44/shared/movimenti.ts');

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + (extra ? ' — ' + extra : '')); } };

// Le attese fra un ritentativo e l'altro sono secondi veri: qui non servono.
const setTimeoutVero = globalThis.setTimeout;
globalThis.setTimeout = (fn, ms, ...resto) => setTimeoutVero(fn, ms > 20 ? 1 : ms, ...resto);
// utils.js guarda window.self per sapere se sta dentro un iframe.
globalThis.window = { self: {}, top: {} };

// ---------------------------------------------------------------------------
// L'SDK finto: gli archivi in memoria, con le stesse firme di quello vero
// ---------------------------------------------------------------------------
const SDK_FINTO = `
const valore = (r, campo) => (r ? r[campo] : undefined);
function ordina(righe, ordinamento) {
  const campo = String(ordinamento || 'id').replace(/^[-+]/, '') || 'id';
  const verso = String(ordinamento || '').startsWith('-') ? -1 : 1;
  return [...righe].sort((a, b) => {
    const x = valore(a, campo), y = valore(b, campo);
    if (x === y || (x == null && y == null)) return String(a.id).localeCompare(String(b.id));
    if (x == null) return 1;
    if (y == null) return -1;
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
    return (c === 0 ? String(a.id).localeCompare(String(b.id)) : c) * verso;
  });
}
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => (v && typeof v === 'object' && Array.isArray(v.$in) ? v.$in.includes(r[k]) : r[k] === v));
const proietta = (righe, campi) => (Array.isArray(campi) && campi.length
  ? righe.map(r => Object.fromEntries([...new Set(['id', ...campi])].filter(c => c in r).map(c => [c, r[c]])))
  : righe);
let progressivo = 0;
const nuovo = (d) => ({ id: 'r' + (++progressivo), created_date: new Date().toISOString(), ...d });
function entita(nome) {
  const righe = () => (globalThis.__ARCHIVI[nome] ||= []);
  return {
    // LA LETTURA CHE RISPONDE INDIETRO SUBITO DOPO UNA CANCELLAZIONE: e' la
    // lettura piu' esposta che esista, zero secondi da una scrittura grossa, e
    // qui si riproduce servendo la fotografia di PRIMA della cancellazione.
    // Serve a provare che nessun verdetto nasce piu' da li'.
    filter: async (f, ord = 'id', lim = 1e9, skip = 0) => {
      const prima = globalThis.__FILTRO_INDIETRO ? globalThis.__PRIMA_DI_CANCELLARE : null;
      const fonte = prima && prima.nome === nome && f && f.id_ordine && typeof f.id_ordine === 'object'
        ? prima.righe
        : righe();
      return ordina(fonte.filter(r => soddisfa(r, f)), ord).slice(skip, skip + lim);
    },
    // COME SI ROMPE UNA LETTURA A PAGINE (la regola sta in
    // base44/shared/fetchAll.ts, l'incidente e' quello del 15/09/2026: 44
    // doppioni e 44 mancanti su 10.543 primarie). Le pagine vere sono da 5.000
    // righe: con __PAGINE_CORTE si accorciano, cosi' il guasto si vede senza
    // dover fingere un archivio enorme.
    list: async (ord = 'id', lim = 1e9, skip = 0, campi = null) => {
      const tutte = ordina(righe(), ord);
      const corte = Number(globalThis.__PAGINE_CORTE) || 0;
      if (!corte) return proietta(tutte.slice(skip, skip + lim), campi);
      const quante = Math.min(lim, corte);
      const campo = String(ord || 'id').replace(/^[-+]/, '') || 'id';
      // UN ORDINAMENTO CON DEI PARI NON E' STABILE FRA UNA PAGINA E L'ALTRA: le
      // righe con lo stesso valore si scambiano di posto, e una che scivola
      // all'indietro non viene letta mai. Con 'id', che e' unico, non succede:
      // e' per questo che le pagine si leggono in ordine di id.
      if (globalThis.__ORDINE_INSTABILE && campo !== 'id' && skip > 0) {
        return proietta(tutte.slice(skip + 1, skip + 1 + quante), campi);
      }
      // La stessa riga servita in fondo a una pagina e in testa alla successiva:
      // non si perde niente, ma chi non deduplica la conta due volte.
      if (globalThis.__PAGINE_SOVRAPPOSTE && skip > 0) {
        return proietta(tutte.slice(skip - 1, skip - 1 + quante), campi);
      }
      return proietta(tutte.slice(skip, skip + quante), campi);
    },
    create: async (d) => { const r = nuovo(d); righe().push(r); return r; },
    update: async (id, d) => { const r = righe().find(x => x.id === id); if (r) Object.assign(r, d, { updated_date: new Date().toISOString() }); return r || { id, ...d }; },
    // Con un filtro si cancella solo quello che gli corrisponde: e' la
    // cancellazione mirata della riparazione. Senza, si svuota tutto.
    //
    // Si contano le cancellazioni con filtro: sono richieste al database, e il
    // limite e' di circa settanta al minuto PER TUTTA L'APP. Con __NO_IN si
    // finge una piattaforma che non accetta il filtro a lotti.
    deleteMany: async (f) => {
      if (!f || !Object.keys(f).length) { globalThis.__ARCHIVI[nome] = []; return; }
      // La fotografia di prima della cancellazione, per la lettura in ritardo.
      if (globalThis.__FILTRO_INDIETRO) globalThis.__PRIMA_DI_CANCELLARE = { nome, righe: [...righe()] };
      const aLotti = f.id_ordine && typeof f.id_ordine === 'object' && Array.isArray(f.id_ordine.$in);
      if (aLotti && globalThis.__NO_IN) throw new Error('operator $in is not supported by deleteMany');
      // La piattaforma respinge la richiesta per il limite di richieste: NON e'
      // un rifiuto del filtro a lotti, e non si deve ripiegare su un ordine per
      // volta proprio mentre l'app e' al limite.
      if (aLotti && globalThis.__LIMITE_RICHIESTE) {
        globalThis.__TENTATIVI_A_LOTTI = (globalThis.__TENTATIVI_A_LOTTI || 0) + 1;
        throw Object.assign(new Error('Rate limit exceeded'), { status: 429 });
      }
      // LA CANCELLAZIONE ARRIVA A DESTINAZIONE E POI L'INVOCAZIONE MUORE: le
      // righe spariscono davvero e la risposta non torna. E' il caso in cui
      // "dati intatti" sarebbe una bugia, e il contatore della function non
      // basta ad accorgersene, perche' si alza solo DOPO il ritorno.
      if (globalThis.__CADE_DOPO_AVER_TOLTO != null && (globalThis.__CANCELLAZIONI || 0) >= globalThis.__CADE_DOPO_AVER_TOLTO) {
        globalThis.__CANCELLAZIONI = (globalThis.__CANCELLAZIONI || 0) + 1;
        globalThis.__ARCHIVI[nome] = righe().filter(r => !soddisfa(r, f));
        throw new Error('socket hang up');
      }
      // La piattaforma ACCETTA il filtro a lotti e non toglie niente: se nessuno
      // controllasse, il browser riscriverebbe sopra righe ancora presenti.
      if (aLotti && globalThis.__IN_IGNORATO) return;
      // L'invocazione muore dopo aver gia' cancellato qualche lotto: e' il caso
      // in cui la function deve dire lo stesso quanti ne ha tolti.
      if (globalThis.__CADE_DOPO != null && (globalThis.__CANCELLAZIONI || 0) >= globalThis.__CADE_DOPO) {
        throw new Error('socket hang up');
      }
      globalThis.__CANCELLAZIONI = (globalThis.__CANCELLAZIONI || 0) + 1;
      globalThis.__ARCHIVI[nome] = righe().filter(r => !soddisfa(r, f));
    },
    // Il blocco entra A META' e poi la scrittura fallisce: e' il caso in cui un
    // secondo tentativo dentro la function scriverebbe quelle righe due volte e
    // risponderebbe lo stesso "scritte: tutte".
    bulkCreate: async (a) => {
      globalThis.__BULK = (globalThis.__BULK || 0) + 1;
      if (globalThis.__BULK_A_META) {
        globalThis.__BULK_A_META = false;
        const meta = a.slice(0, Math.floor(a.length / 2)).map(nuovo);
        righe().push(...meta);
        throw new Error('database non raggiungibile');
      }
      const n = a.map(nuovo); righe().push(...n); return n;
    },
  };
}
const entities = new Proxy({}, { get: (_t, nome) => entita(nome) });
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: 'admin', email: 'prova', full_name: 'Prova' }) }, asServiceRole: { entities }, entities };
}`;

// Il client del browser: ogni invoke passa dal banco di prova, che puo' far
// cadere la rete o far entrare un blocco due volte. Gli archivi che il browser
// legge da solo (il registro dei caricamenti) sono quelli veri in memoria.
const CLIENT_FINTO = `
export const base44 = {
  functions: { invoke: (nome, corpo) => globalThis.__INVOKE(nome, corpo) },
  entities: new Proxy({}, { get: (_t, nome) => globalThis.__ENTITA(String(nome)) }),
  auth: { me: async () => ({ full_name: 'Prova', email: 'prova' }) },
};`;

// Le stesse regole di lettura dell'SDK finto, per il client del browser.
const ordinaRighe = (righe, ordinamento) => {
  const campo = String(ordinamento || 'id').replace(/^[-+]/, '') || 'id';
  const verso = String(ordinamento || '').startsWith('-') ? -1 : 1;
  return [...righe].sort((a, b) => {
    const x = a ? a[campo] : undefined, y = b ? b[campo] : undefined;
    if (x === y || (x == null && y == null)) return String(a.id).localeCompare(String(b.id));
    if (x == null) return 1;
    if (y == null) return -1;
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
    return (c === 0 ? String(a.id).localeCompare(String(b.id)) : c) * verso;
  });
};
const soddisfaRiga = (r, f) => Object.entries(f || {}).every(([k, v]) => (v && typeof v === 'object' && Array.isArray(v.$in) ? v.$in.includes(r[k]) : r[k] === v));
globalThis.__ENTITA = (nome) => ({
  filter: async (f, ord = 'id', lim = 1e9, skip = 0) => ordinaRighe((globalThis.__ARCHIVI[nome] || []).filter(r => soddisfaRiga(r, f)), ord).slice(skip, skip + lim),
  list: async (ord = 'id', lim = 1e9, skip = 0) => ordinaRighe(globalThis.__ARCHIVI[nome] || [], ord).slice(skip, skip + lim),
  create: async (d) => { (globalThis.__ARCHIVI[nome] ||= []).push({ id: 'c' + Math.random(), created_date: new Date().toISOString(), ...d }); return d; },
  update: async () => ({}),
});

const XLSX_LOCALE = qui('../node_modules/xlsx/xlsx.mjs');
const ESTENSIONI = ['', '.js', '.jsx', '.ts', '.tsx'];
const daAlias = (p) => {
  const base = qui('../src/' + p.slice(2));
  return ESTENSIONI.map(e => base + e).find(existsSync) || base;
};

const finti = {
  name: 'moduli-finti',
  setup(b) {
    b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
    b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
    b.onResolve({ filter: /^@\/api\/base44Client$/ }, () => ({ path: 'client', namespace: 'client-finto' }));
    b.onLoad({ filter: /.*/, namespace: 'client-finto' }, () => ({ contents: CLIENT_FINTO, loader: 'js' }));
    b.onResolve({ filter: /^(npm:)?xlsx$/ }, () => ({ path: XLSX_LOCALE }));
    b.onResolve({ filter: /^@\// }, (args) => ({ path: daAlias(args.path) }));
  },
};

async function impacchetta(entrata) {
  const r = await build({
    entryPoints: [entrata], bundle: true, write: false, format: 'esm',
    platform: 'neutral', logLevel: 'silent', plugins: [finti],
  });
  return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
}

const modulo = await impacchetta(qui('../base44/functions/importaBlocco/entry.ts'));
const funzione = async (corpo = {}) => {
  const res = await modulo.default({ json: async () => corpo });
  return { status: res.status, body: await res.json() };
};
const {
  importaPrimarie, importaGrandeFile, testoVerificaArchivio, testoEseguiti,
  avvisiDaMostrare, ricalcoliDaRecuperare, dopoCaricamento, moduliDaRicalcolare,
  confermeAccumulate, recuperiDaFare, titoloAvviso, avvisoRosso, MODULI_AGGIORNATI,
  ricalcoliFermi, testoRicalcoli, qualificaDaRifare, segnaQualificaRinviata, archiviSenzaConteggio,
  riparazioniDaDire, archiviConFraseLoro,
  avvisoQualificaRinviata,
} = await impacchetta(qui('../src/lib/importGrandeFile.js'));
// La qualifica era l'unico dei ricalcoli che non guardava il registro dei
// caricamenti: rileggeva le primarie e salvava il riepilogo su un archivio
// appena dichiarato inaffidabile.
const moduloQualifica = await impacchetta(qui('../base44/functions/qualificaFornitori/entry.ts'));
const qualifica = async (corpo = {}) => {
  const res = await moduloQualifica.default({ json: async () => corpo });
  return { status: res.status, body: await res.json() };
};

// ---------------------------------------------------------------------------
// Il banco di prova: fra il browser e la function
// ---------------------------------------------------------------------------
let gancio = null;
let registro = [];
// Le funzioni dei ricalcoli: normalmente non si chiamano, e chiamarle e' un errore.
let ricalcoliFinti = null;
const descrivi = (c) => `${c.azione}${c.entita ? ' ' + c.entita : ''}${c.blocco != null ? ' #' + c.blocco : ''}`;
const cadutaDiRete = () => Object.assign(new Error('socket hang up'), { status: undefined });

globalThis.__INVOKE = async (nome, corpo) => {
  if (nome !== 'importaBlocco') {
    registro.push('ricalcolo ' + nome);
    if (!ricalcoliFinti) throw new Error('funzione non prevista: ' + nome);
    return ricalcoliFinti(nome, corpo);
  }
  registro.push(descrivi(corpo));
  const esegui = async () => {
    const res = await funzione(corpo);
    if (res.status >= 400) {
      throw Object.assign(new Error((res.body && res.body.error) || 'errore'), { status: res.status, data: res.body });
    }
    return { status: res.status, data: res.body };
  };
  return gancio ? gancio(corpo, esegui) : esegui();
};

const archivio = (nome) => globalThis.__ARCHIVI[nome] || [];
const distinti = (nome) => new Set(archivio(nome).map(r => r.id_ordine)).size;
const ultimoLog = (tipo = 'primarie') => [...archivio('UploadLog')].reverse().find(r => r.tipo_file === tipo) || {};
const quante = (azione) => registro.filter(r => r === azione).length;
// Quante righe ha ogni ordine in un archivio: il metro vero.
const righePerOrdine = (nome) => {
  const m = new Map();
  for (const r of archivio(nome)) m.set(r.id_ordine, (m.get(r.id_ordine) || 0) + 1);
  return m;
};

// ---------------------------------------------------------------------------
// Il file delle primarie, letto da un foglio vero
// ---------------------------------------------------------------------------
const colonne = Object.keys(SHEET_MAP.primarie.columns);
const RETE = 450;   // tre blocchi da 200: il secondo e' quello che si guasta
const ASSEGNATI = 30;
// Quanti giri fa la riparazione prima di arrendersi (GIRI_RIPARAZIONE in
// src/lib/importGrandeFile.js). Da quando un blocco non si riscrive piu' alla
// cieca, i giri SONO i ritentativi: ognuno comincia togliendo le righe di quegli
// ordini, quindi ritentare non puo' far entrare niente due volte.
const GIRI_RIPARAZIONE_ATTESI = 4;

function riga(i, { assegnato = false, classe = 'A', stato = null } = {}) {
  const id = `ORD-${String(i).padStart(5, '0')}`;
  return {
    ID: id, Stato: stato || (assegnato ? 'assegnato' : 'terminato'), Prodotto: `${classe} - PFU`, Classe: classe,
    Provincia: 'NA', Trasportatore: 'Raccoglitore Uno', Destinazione: 'Irigom Srl',
    Ordine_immesso_il: '01/09/2026 08:00',
    ...(assegnato ? { Peso_stimato: 9000 } : {
      Peso_effettivo: 12000,
      Trasporto_iniziato_il: '12/09/2026 07:00',
      Trasporto_finito_il: '13/09/2026 12:57:36',
    }),
  };
}
const righeFile = [
  ...Array.from({ length: RETE }, (_, i) => riga(i + 1)),
  ...Array.from({ length: ASSEGNATI }, (_, i) => riga(RETE + i + 1, { assegnato: true })),
];

// Lo stesso file, ma com'e' fatto DAVVERO un export delle primarie: 100 ordini,
// 20 dei quali con due classi, cioe' 120 righe. Le classi P, M, G1, G2 stanno
// tutte nelle primarie di rete (solo la classe 9 e' ACI), quindi lo stesso
// id_ordine compare due volte nello stesso archivio ed e' giusto cosi'.
const ORDINI_MISTI = 100;
const DUE_CLASSI = 20;
const righeMiste = [
  ...Array.from({ length: ORDINI_MISTI }, (_, i) => riga(i + 1, { classe: 'A' })),
  ...Array.from({ length: DUE_CLASSI }, (_, i) => riga(i + 1, { classe: 'M' })),
];
const RIGHE_MISTE = ORDINI_MISTI + DUE_CLASSI;

// Un file di 400 righe esatte, due blocchi da 200: e' quello che serve per il
// caso del blocco doppio e del blocco perso che si compensano.
const QUATTROCENTO = 400;
const righeQuattrocento = Array.from({ length: QUATTROCENTO }, (_, i) => riga(i + 1));

function fileFinto(righe = righeFile, intestazioni = colonne, nome = 'primarie.xlsx', foglio = 'PRIMARIE') {
  const aoa = [intestazioni, ...righe.map(r => intestazioni.map(c => (r[c] === undefined ? null : r[c])))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, foglio);
  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return { name: nome, arrayBuffer: async () => buffer };
}

async function caricamento(prepara, righe = righeFile) {
  globalThis.__ARCHIVI = {};
  globalThis.__CANCELLAZIONI = 0;
  globalThis.__NO_IN = false;
  globalThis.__LIMITE_RICHIESTE = false;
  globalThis.__CADE_DOPO = null;
  globalThis.__CADE_DOPO_AVER_TOLTO = null;
  globalThis.__IN_IGNORATO = false;
  globalThis.__FILTRO_INDIETRO = false;
  globalThis.__PRIMA_DI_CANCELLARE = null;
  globalThis.__PAGINE_CORTE = 0;
  globalThis.__ORDINE_INSTABILE = false;
  globalThis.__PAGINE_SOVRAPPOSTE = false;
  registro = [];
  gancio = null;
  ricalcoliFinti = null;
  if (prepara) prepara();
  return importaPrimarie({ file: fileFinto(righe) });
}

// Una fotografia dell'archivio com'e' in questo momento, nella forma con cui
// risponde conta_esatta: serve a far "rispondere indietro" la lettura.
const fotografia = (nome) => {
  const conteggi = {};
  for (const r of archivio(nome)) conteggi[r.id_ordine] = (conteggi[r.id_ordine] || 0) + 1;
  return { righe: archivio(nome).length, finito: true, conteggi, entita: nome };
};
// Una fotografia inventata: n ordini con una riga ciascuno.
const fotografiaDi = (n, nome = 'PrimariaRete') => ({
  righe: n, finito: true, entita: nome,
  conteggi: Object.fromEntries(Array.from({ length: n }, (_, i) => [`ORD-${String(i + 1).padStart(5, '0')}`, 1])),
});

// ---------------------------------------------------------------------------
// Il file degli ordini non dichiarati: il percorso che NON e' quello delle primarie
// ---------------------------------------------------------------------------
const colonneOnd = Object.keys(SHEET_MAP.ordini_non_dichiarati.columns);
const OND = 450;
const righeOnd = Array.from({ length: OND }, (_, i) => ({
  KeyAccount: 'SMOCO', Ordine_primaria: `ET2600${String(i + 1).padStart(4, '0')}`,
  Data_chiusura: '20/09/2026', ID_Cliente: 'C1', ID_PDR: `PDR-${i + 1}`,
  Punto_di_Raccolta: 'Gommista Uno', Provincia: 'NA', Prodotto: 'A - PFU',
  Status: 'terminato', CER: '160103', Mod_trattamento: 'R3',
  Peso_effettivo_Kg: 12000, Trasportatore: 'Raccoglitore Uno', Destinazione: 'Irigom Srl',
  Fine_trasporto: '13/09/2026', Numero_FIR: `FIR${i + 1}`, Peso_non_dichiarato_Kg: 12000,
}));

async function caricamentoGenerico(prepara) {
  globalThis.__ARCHIVI = {};
  registro = [];
  gancio = null;
  ricalcoliFinti = null;
  if (prepara) prepara();
  return importaGrandeFile({
    file: fileFinto(righeOnd, colonneOnd, 'ordini_non_dichiarati.xlsx', 'Sheet1'),
    tipoFile: 'ordini_non_dichiarati',
  });
}

// I guasti che si infilano in mezzo, sempre gli stessi.
let contaKo = 0;
const ganciaCadutaDopoLaScrittura = ({ entita = null, blocco = 1, maiArrivato = false } = {}) => {
  let rotto = false;
  return async (corpo, esegui) => {
    if ((corpo.azione === 'conta' || corpo.azione === 'conta_esatta') && contaKo > 0) { contaKo--; throw cadutaDiRete(); }
    if (corpo.azione === 'scrivi' && (entita === null || corpo.entita === entita) && corpo.blocco === blocco && !rotto) {
      rotto = true;
      if (!maiArrivato) await esegui();  // il blocco entra davvero...
      contaKo = 2;                       // ...e da qui il conteggio non risponde
      throw cadutaDiRete();              // ...ma il browser vede cadere la rete
    }
    return esegui();
  };
};

// ---------------------------------------------------------------------------
console.log('(b) IL METRO SONO LE RIGHE, NON GLI ORDINI: 100 ORDINI IN 120 RIGHE');
// Il controesempio: un caricamento perfetto di un file com'e' fatto davvero.
// Un criterio "ogni id_ordine una volta sola" qui troverebbe 20 doppioni
// inventati, chiuderebbe l'esito come parziale, fermerebbe i ricalcoli e
// marchierebbe l'archivio come inaffidabile - senza via d'uscita, perche' il
// rimedio proposto (ricaricare lo stesso file) darebbe lo stesso verdetto.

const esitoMisto = await caricamento(null, righeMiste);

verifica('in archivio ci sono tutte le righe del file', archivio('PrimariaRete').length === RIGHE_MISTE, `${archivio('PrimariaRete').length} righe`);
verifica('e sono di meno gli ordini, perche' + "' 20 hanno due classi", distinti('PrimariaRete') === ORDINI_MISTI, `${distinti('PrimariaRete')} ordini distinti su ${RIGHE_MISTE} righe`);
verifica('il caricamento e' + "' riuscito", esitoMisto.esito === 'successo', `${esitoMisto.esito} — ${ultimoLog().messaggio || ''}`);
verifica('nessun doppione inventato', esitoMisto.avviso_doppioni === null, JSON.stringify(esitoMisto.avviso_doppioni));
verifica('nessuna riga dichiarata mancante', esitoMisto.avviso_mancanti === null, JSON.stringify(esitoMisto.avviso_mancanti));
verifica("nessun archivio dichiarato non verificato", esitoMisto.avviso_non_verificato === null, JSON.stringify(esitoMisto.avviso_non_verificato));
verifica('nessuna riparazione: non c' + "'era niente da riparare", esitoMisto.avviso_riparazione === null, JSON.stringify(esitoMisto.avviso_riparazione));
verifica('nessuna riga di allarme sotto la scheda', testoVerificaArchivio(esitoMisto) === null, JSON.stringify(testoVerificaArchivio(esitoMisto)));
verifica('il registro non parla di ordini ripetuti', !String(ultimoLog().messaggio || '').includes('ripetut') && ultimoLog().esito === 'successo', ultimoLog().messaggio);
verifica('le righe importate sono quelle del file', esitoMisto.righe_importate === RIGHE_MISTE, String(esitoMisto.righe_importate));
// Un caricamento pulito non costa una richiesta in piu' di prima: il dettaglio
// viaggia sulle stesse pagine del conteggio.
verifica('il conteggio esatto si chiede una volta per archivio', quante('conta_esatta PrimariaRete') === 1, `${quante('conta_esatta PrimariaRete')} chiamate`);

// ---------------------------------------------------------------------------
console.log('(A1) UN BLOCCO DOPPIO E UNO PERSO SI COMPENSANO: IL TOTALE NON BASTA');
// Il caso peggiore: il blocco 0 finisce in archivio DUE VOLTE - la piattaforma
// lo scrive due volte e la rete cade prima che la risposta torni - mentre il
// blocco 1 non arriva mai. Alla fine l'archivio ha 400 righe su 400 attese - il
// totale torna - ma 200 ordini sono contati due volte e 200 sono spariti.
//
// La scrittura doppia arriva da fuori, non dal browser: il browser non riscrive
// piu' un blocco su una lettura sola (vedi (G15)), e la function non ha piu' il
// secondo tentativo di bulkCreate, che rispondeva "scritte: tutte" anche al
// secondo giro. Ma un blocco doppio puo' sempre nascere da una ripetizione
// altrui, e il gestionale se ne deve accorgere lo stesso.
//
// Col solo totale l'esito era "successo" e nessuno l'avrebbe mai saputo. Col
// confronto ordine per ordine si vede, e la riparazione lo rimette a posto.

let numeroDiPrima = 0;
let contaVecchia = 0;
const esitoCompensato = await caricamento(() => {
  let rottoZero = false;
  gancio = async (corpo, esegui) => {
    if (corpo.azione === 'conta' && contaVecchia > 0) {
      contaVecchia--;
      return { status: 200, data: { conteggio: numeroDiPrima, contato: true } };
    }
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && corpo.blocco === 0 && !rottoZero) {
      rottoZero = true;
      await esegui();              // il blocco entra davvero...
      await esegui();              // ...e la piattaforma lo scrive una seconda volta
      throw cadutaDiRete();        // ...e il browser vede solo cadere la rete
    }
    // il blocco 1 non arriva mai
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && corpo.blocco === 1) throw cadutaDiRete();
    return esegui();
  };
}, righeQuattrocento);

const perOrdine = righePerOrdine('PrimariaRete');
verifica('in archivio finiscono le righe del file, una volta sola', archivio('PrimariaRete').length === QUATTROCENTO, `${archivio('PrimariaRete').length} righe`);
verifica('e sono tutti e quattrocento gli ordini, non duecento contati doppi', distinti('PrimariaRete') === QUATTROCENTO, `${distinti('PrimariaRete')} ordini distinti`);
verifica('nessun ordine ha piu' + "' righe di quante ne ha nel file", [...perOrdine.values()].every(v => v === 1), JSON.stringify([...perOrdine.entries()].filter(([, v]) => v !== 1).slice(0, 3)));
verifica("il problema e' stato visto e riparato", !!esitoCompensato.avviso_riparazione && esitoCompensato.avviso_riparazione.risolto === true, JSON.stringify(esitoCompensato.avviso_riparazione));
verifica('si dice quante righe sono state rimesse a posto', (esitoCompensato.avviso_riparazione || {}).righe === QUATTROCENTO, JSON.stringify(esitoCompensato.avviso_riparazione));
verifica("dopo la riparazione il caricamento e' riuscito", esitoCompensato.esito === 'successo', `${esitoCompensato.esito} — ${ultimoLog().messaggio || ''}`);
verifica('il registro lo scrive', String(ultimoLog().messaggio || '').includes('rimesse a posto da sole'), ultimoLog().messaggio);
const testoCompensato = testoVerificaArchivio(esitoCompensato);
verifica('la scheda lo racconta con parole semplici', !!testoCompensato && testoCompensato.testo.includes('rimesse a posto da solo') && testoCompensato.testo.includes("niente da rifare"), testoCompensato && testoCompensato.testo);
verifica('e non resta nessun allarme', esitoCompensato.avviso_doppioni === null && esitoCompensato.avviso_mancanti === null && esitoCompensato.avviso_disallineamento === null, JSON.stringify({ d: esitoCompensato.avviso_doppioni, m: esitoCompensato.avviso_mancanti }));

// ---------------------------------------------------------------------------
console.log('(A1/B1d) LA CANCELLAZIONE CHE NON RISPONDE: NESSUN DOPPIONE NUOVO, E SI DICE COM\'E\'');
// Lo stesso guasto di sopra, ma la cancellazione mirata non risponde mai.
//
// C'era una regola contraria - "prima si scrive, poi si toglie" - per cui gli
// ordini che in archivio risultavano a zero si riscrivevano SENZA cancellare.
// Sembrava un passo che poteva solo migliorare le cose, e invece bastava una
// lettura in ritardo perche' fabbricasse righe doppie vere: l'archivio si
// chiudeva "successo" coi pesi contati doppi e tutti i ricalcoli partivano
// sopra. E' l'incidente del 14/09/2026 da una porta nuova.
//
// Adesso la riparazione e' IDEMPOTENTE: per ogni ordine si toglie e si
// riscrive, in un passo solo. Se il togliere non riesce, non si riscrive
// niente: l'archivio resta com'era - duecento ordini doppi e duecento spariti -
// e il gestionale lo dice tutto, con i numeri di adesso. Perdere righe e'
// rumoroso e si rimedia ricaricando; duplicarle e' silenzioso: fra i due si
// sceglie sempre il primo.

const esitoNonRiparato = await caricamento(() => {
  let rottoZero = false;
  gancio = async (corpo, esegui) => {
    if (corpo.azione === 'cancella_ordini') throw cadutaDiRete();
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && corpo.blocco === 0 && !rottoZero) {
      rottoZero = true;
      await esegui();
      await esegui();              // la piattaforma scrive il blocco due volte
      throw cadutaDiRete();
    }
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && corpo.blocco === 1) throw cadutaDiRete();
    return esegui();
  };
}, righeQuattrocento);

verifica("il caricamento non si chiude come riuscito", esitoNonRiparato.esito === 'parziale', esitoNonRiparato.esito);
// LA PROVA CHE CONTA: la riparazione non ha riscritto niente alla cieca, quindi
// non ha aggiunto nemmeno una riga doppia. Gli ordini doppi sono i duecento di
// prima, non uno di piu'.
const perOrdineNonRiparato = righePerOrdine('PrimariaRete');
verifica('nessun ordine ha piu' + "' di due righe: la riparazione non ne ha aggiunte", [...perOrdineNonRiparato.values()].every(v => v <= 2), JSON.stringify([...perOrdineNonRiparato.entries()].filter(([, v]) => v > 2).slice(0, 3)));
verifica("gli ordini doppi sono i duecento di prima", [...perOrdineNonRiparato.values()].filter(v => v === 2).length === 200, String([...perOrdineNonRiparato.values()].filter(v => v === 2).length));
verifica('e non si e' + "' scritta nessuna riga senza aver prima tolto", esitoNonRiparato.avviso_riparazione === null, JSON.stringify(esitoNonRiparato.avviso_riparazione));
// Il gestionale dice tutte e due le cose, e con i numeri di adesso.
verifica('dice le righe di troppo', !!esitoNonRiparato.avviso_doppioni && esitoNonRiparato.avviso_doppioni.ordini === 200, JSON.stringify(esitoNonRiparato.avviso_doppioni && esitoNonRiparato.avviso_doppioni.ordini));
verifica('e dice anche le righe che mancano', !!esitoNonRiparato.avviso_mancanti && esitoNonRiparato.avviso_mancanti.ordini === 200, JSON.stringify(esitoNonRiparato.avviso_mancanti && esitoNonRiparato.avviso_mancanti.ordini));
verifica('con gli ordini per nome', ((((esitoNonRiparato.avviso_doppioni || {}).archivi || [])[0] || {}).esempi || []).length === 10, JSON.stringify(((esitoNonRiparato.avviso_doppioni || {}).archivi || [])[0]));
// I numeri detti sono quelli di ADESSO, non quelli di prima della riparazione:
// una richiesta di cancellazione partita e' gia' "toccato", e si e' ricontato.
verifica('i numeri detti sono quelli veri di adesso', (((esitoNonRiparato.avviso_doppioni || {}).archivi || [])[0] || {}).righe === archivio('PrimariaRete').length, `${(((esitoNonRiparato.avviso_doppioni || {}).archivi || [])[0] || {}).righe} contro ${archivio('PrimariaRete').length} righe vere`);
verifica('il registro non dice "successo" su un archivio cosi'  + "'", ultimoLog().esito === 'parziale', `${ultimoLog().esito} — ${ultimoLog().messaggio}`);
verifica('e nomina gli ordini che non tornano', String(ultimoLog().messaggio || '').includes('ordini con un numero di righe diverso'), ultimoLog().messaggio);
const testoNonRiparato = testoVerificaArchivio(esitoNonRiparato);
verifica('la scheda dice tutte e due le cose', !!testoNonRiparato && testoNonRiparato.testo.includes('200 righe di troppo') && testoNonRiparato.testo.includes('mancano 200 righe'), testoNonRiparato && testoNonRiparato.testo);
// La cancellazione e' partita e non si sa come sia finita: non si dice "ho
// tolto" e non si dice "non ho toccato niente".
verifica("e dice che la cancellazione e' partita senza risposta", (esitoNonRiparato.riparazione_incerta || []).join() === 'Primarie RETE' && testoNonRiparato.testo.includes('non ha saputo come sia andata'), JSON.stringify(esitoNonRiparato.riparazione_incerta));
verifica('e non si inventa di aver tolto delle righe', esitoNonRiparato.riparazione_tentata === null, JSON.stringify(esitoNonRiparato.riparazione_tentata));
verifica('i moduli collegati non si ricalcolano', moduliDaRicalcolare(esitoNonRiparato) === false);

// ---------------------------------------------------------------------------
console.log('(B1a) PRIMA DI GRIDARE SI RICONTA: IL CONTEGGIO PUO' + "' RISPONDERE INDIETRO");
// Subito dopo una scrittura grossa l'archivio puo' rispondere con un numero
// ancora vecchio. Prima bastava quello a dire "ricarica il file": un falso
// allarme, e tutto il gestionale fermo. Adesso si aspetta e si riconta.

const esitoFalsoAllarme = await caricamento(() => {
  let primaVolta = true;
  gancio = async (corpo, esegui) => {
    const risposta = await esegui();
    if (corpo.azione === 'conta_esatta' && corpo.entita === 'PrimariaRete' && primaVolta) {
      primaVolta = false;
      // la lettura risponde come se ci fossero solo le prime 250 righe
      const conteggi = Object.fromEntries(Object.entries(risposta.data.conteggi || {}).slice(0, 250));
      return { status: 200, data: { ...risposta.data, righe: 250, conteggi } };
    }
    return risposta;
  };
});

verifica('il conteggio si rifa' + "' una seconda volta", quante('conta_esatta PrimariaRete') === 2, `${quante('conta_esatta PrimariaRete')} chiamate`);
verifica("il caricamento e' riuscito: era un falso allarme", esitoFalsoAllarme.esito === 'successo', `${esitoFalsoAllarme.esito} — ${ultimoLog().messaggio || ''}`);
verifica('nessuna riparazione, nessuna riga toccata', esitoFalsoAllarme.avviso_riparazione === null && quante('cancella_ordini PrimariaRete') === 0, JSON.stringify(esitoFalsoAllarme.avviso_riparazione));
verifica('nessun allarme sotto la scheda', testoVerificaArchivio(esitoFalsoAllarme) === null, JSON.stringify(testoVerificaArchivio(esitoFalsoAllarme)));

// ---------------------------------------------------------------------------
console.log('(B1b) LE RIGHE PERSE SI RISCRIVONO, SOLO QUELLE');
// Il caso della notte del 24/09/2026: il browser crede di aver scritto il
// blocco, ma in archivio ne mancano 57. Prima: "Ricarica il file per
// riallinearlo", e undicimila righe da rifare. Adesso si riscrivono le 57.

const PERSE = 57;
const esitoPerse = await caricamento(() => {
  let fatto = false;
  gancio = async (corpo, esegui) => {
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && corpo.blocco === 0 && !fatto) {
      fatto = true;
      // entrano meno righe di quante il browser crede di averne mandate
      await funzione({ ...corpo, righe: corpo.righe.slice(0, corpo.righe.length - PERSE) });
      return { status: 200, data: { blocco: corpo.blocco, scritte: corpo.righe.length, fallite: 0 } };
    }
    return esegui();
  };
});

verifica('in archivio tornano tutte le righe del file', archivio('PrimariaRete').length === RETE, `${archivio('PrimariaRete').length} righe su ${RETE}`);
verifica('e nessun ordine manca', distinti('PrimariaRete') === RETE, `${distinti('PrimariaRete')} ordini`);
verifica('si sono riscritte solo le righe perse', (esitoPerse.avviso_riparazione || {}).righe === PERSE, JSON.stringify(esitoPerse.avviso_riparazione));
// La cancellazione si fa ANCHE per gli ordini che in archivio risultano a zero:
// nel caso onesto e' a vuoto, e nel caso della lettura in ritardo toglie le
// righe che la lettura non aveva visto. E' quello che rende la riparazione
// idempotente: qualunque cosa dica la lettura, doppioni non se ne creano. Costa
// una richiesta ogni cinquanta ordini.
verifica('la cancellazione si fa anche per gli ordini che risultano a zero', quante('cancella_ordini PrimariaRete') === 1, String(quante('cancella_ordini PrimariaRete')));
verifica('e nessun ordine finisce con due righe', [...righePerOrdine('PrimariaRete').values()].every(v => v === 1), JSON.stringify([...righePerOrdine('PrimariaRete').entries()].filter(([, v]) => v !== 1).slice(0, 3)));
verifica("l'archivio non e' stato svuotato una seconda volta", quante('svuota PrimariaRete') === 1, String(quante('svuota PrimariaRete')));
verifica("il caricamento e' riuscito", esitoPerse.esito === 'successo', `${esitoPerse.esito} — ${ultimoLog().messaggio || ''}`);
verifica('il registro dice quante righe sono state rimesse', String(ultimoLog().messaggio || '').includes(`${PERSE} righe rimesse a posto da sole`), ultimoLog().messaggio);
verifica('non resta nessun avviso di righe mancanti', esitoPerse.avviso_mancanti === null && esitoPerse.avviso_disallineamento === null, JSON.stringify(esitoPerse.avviso_mancanti));

// ---------------------------------------------------------------------------
console.log('(B1c) LE RIGHE DI TROPPO SI TOLGONO, SENZA SVUOTARE TUTTO');
// Lo stesso blocco entrato due volte: l'archivio ha 240 righe dove il file ne
// porta 120. Si tolgono le righe di quegli ordini e si riscrivono dal file.

const esitoDoppio = await caricamento(() => {
  let fatto = false;
  gancio = async (corpo, esegui) => {
    const risposta = await esegui();
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && corpo.blocco === 0 && !fatto) {
      fatto = true;
      await esegui();            // le stesse righe una seconda volta
    }
    return risposta;
  };
}, righeMiste);

verifica('in archivio restano le righe del file, non il doppio', archivio('PrimariaRete').length === RIGHE_MISTE, `${archivio('PrimariaRete').length} righe`);
verifica('e gli ordini con due classi hanno ancora due righe', righePerOrdine('PrimariaRete').get('ORD-00001') === 2, String(righePerOrdine('PrimariaRete').get('ORD-00001')));
verifica('le righe sbagliate sono state tolte una per ordine', quante('cancella_ordini PrimariaRete') >= 1, String(quante('cancella_ordini PrimariaRete')));
verifica("l'archivio non e' stato svuotato di nuovo", quante('svuota PrimariaRete') === 1, String(quante('svuota PrimariaRete')));
verifica('gli altri archivi non sono stati toccati dalla riparazione', quante('cancella_ordini Assegnato') === 0 && archivio('Assegnato').length === 0, String(archivio('Assegnato').length));
verifica("il caricamento e' riuscito dopo la riparazione", esitoDoppio.esito === 'successo', `${esitoDoppio.esito} — ${ultimoLog().messaggio || ''}`);
verifica('e la riparazione si dice', !!esitoDoppio.avviso_riparazione && esitoDoppio.avviso_riparazione.risolto === true, JSON.stringify(esitoDoppio.avviso_riparazione));

// Righe di un ordine che nel file NON c'e' affatto.
//
// FINO AL 28/09/2026 LA RIPARAZIONE LE TOGLIEVA. Adesso non le tocca piu', e il
// motivo e' lo storico conservato: dal 25/09 un archivio delle primarie contiene
// anche i terminati degli anni prima, che nel file non ci sono per definizione e
// che devono restare. La regola non puo' guardare in faccia l'ordine - non c'e'
// nessun modo sicuro, dal browser, di distinguere un residuo da un terminato
// conservato se la preparazione non avesse risposto - quindi vale per tutti: SI
// TOCCANO SOLO GLI ORDINI CHE IL FILE PORTA, perche' la riparazione si regge sul
// poter riscrivere cio' che toglie.
//
// Il prezzo e' questo scenario: la riga di troppo resta, il caricamento chiude
// PARZIALE, lo dice con il nome dell'ordine e i ricalcoli non partono. Si rimedia
// ricaricando lo stesso file, che svuota e riscrive. Fra tenere una riga di
// troppo che si vede e cancellare in silenzio una riga che nessuno puo'
// riscrivere, si tiene la prima.
const INTRUSO = 'ORD-99999';
const esitoIntruso = await caricamento(() => {
  let fatto = false;
  gancio = async (corpo, esegui) => {
    const risposta = await esegui();
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && corpo.blocco === 0 && !fatto) {
      fatto = true;
      // una riga che nel file non c'e': un residuo di un altro caricamento
      globalThis.__ARCHIVI.PrimariaRete.push({ id: 'intruso', id_ordine: INTRUSO, stato: 'terminato' });
    }
    return risposta;
  };
}, righeMiste);

verifica("la riga di un ordine che nel file non c'e' NON si tocca", archivio('PrimariaRete').some(r => r.id_ordine === INTRUSO), 'la riga e' + "' stata tolta");
verifica("e la riparazione non la conta fra le sue", !esitoIntruso.avviso_riparazione || !(esitoIntruso.avviso_riparazione.tolte > 0), JSON.stringify(esitoIntruso.avviso_riparazione));
verifica('il caricamento resta parziale e i ricalcoli sono fermi', esitoIntruso.esito === 'parziale' && moduliDaRicalcolare(esitoIntruso) === false, `${esitoIntruso.esito} — ${ultimoLog().messaggio || ''}`);
verifica("e si dice per nome qual e' l'ordine di troppo", !!esitoIntruso.avviso_doppioni && esitoIntruso.avviso_doppioni.ordini === 1 && JSON.stringify(esitoIntruso.avviso_doppioni).includes(INTRUSO), JSON.stringify(esitoIntruso.avviso_doppioni));
verifica('e la scheda dice di ricaricare lo stesso file', (testoVerificaArchivio(esitoIntruso) || {}).testo.includes('Ricarica lo stesso file'), JSON.stringify(testoVerificaArchivio(esitoIntruso)));

// ---------------------------------------------------------------------------
console.log('(A5) UN BLOCCO CHE SBAGLIA NON SI RISCRIVE: LE RIGHE LE RIMETTE LA RIPARAZIONE');
// Il blocco 1 (200 righe) resta in sospeso. Il blocco 2 (50 righe) sbaglia e
// non entra.
//
// Qui il browser riscriveva il blocco, se il conteggio diceva che non c'era. Ma
// "non c'e'" e "la lettura e' indietro di qualche secondo" sono lo stesso
// identico numero, e su quel numero sono nati i doppioni: nessuna quantita' di
// riletture li distingue. Adesso il blocco non si riscrive mai - resta in
// sospeso - e a rimettere quelle 50 righe e' la riparazione, che prima TOGLIE
// le righe di quegli ordini e poi riscrive quelle del file, quindi non puo'
// farne entrare due volte le stesse qualunque cosa la lettura racconti.

let tentativiDue = 0;
const esitoRitentato = await caricamento(() => {
  contaKo = 0;
  let rottoUno = false;
  gancio = async (corpo, esegui) => {
    if ((corpo.azione === 'conta' || corpo.azione === 'conta_esatta') && contaKo > 0) { contaKo--; throw cadutaDiRete(); }
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && corpo.blocco === 1 && !rottoUno) {
      rottoUno = true;
      await esegui();
      contaKo = 2;
      throw cadutaDiRete();
    }
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && corpo.blocco === 2) {
      tentativiDue++;
      if (tentativiDue === 1) throw cadutaDiRete();
    }
    return esegui();
  };
});

verifica('il blocco che sbaglia NON si riscrive', tentativiDue === 1, `${tentativiDue} tentativi`);
verifica('e le sue righe le rimette la riparazione', archivio('PrimariaRete').length === RETE, `${archivio('PrimariaRete').length} righe su ${RETE}`);
verifica("il caricamento e' riuscito", esitoRitentato.esito === 'successo', `${esitoRitentato.esito} — ${ultimoLog().messaggio || ''}`);
verifica('ed e' + "' stata la riparazione a rimetterle", (esitoRitentato.avviso_riparazione || {}).risolto === true, JSON.stringify(esitoRitentato.avviso_riparazione));
verifica('e non sono entrate righe doppie', distinti('PrimariaRete') === RETE, `${distinti('PrimariaRete')} ordini`);

// ---------------------------------------------------------------------------
console.log('(a) IL CONTEGGIO CHE NON RIESCE: IL BLOCCO NON SI RISCRIVE ALLA CIECA');
// La rete cade DOPO che il blocco e' entrato, e subito dopo il conteggio non
// risponde piu': e' la combinazione che faceva nascere i doppioni.

const esitoA = await caricamento(() => {
  contaKo = 0;
  gancio = ganciaCadutaDopoLaScrittura({ entita: 'PrimariaRete', blocco: 1 });
});

verifica('il blocco di cui non si sa niente non viene riscritto', quante('scrivi PrimariaRete #1') === 1, `${quante('scrivi PrimariaRete #1')} scritture`);
verifica('in archivio ci sono tutte le righe, nessuna in piu', archivio('PrimariaRete').length === RETE, `${archivio('PrimariaRete').length} righe`);
verifica('nessuna riga di troppo da segnalare', esitoA.avviso_doppioni === null, JSON.stringify(esitoA.avviso_doppioni));
verifica("la verifica finale scioglie il dubbio e il caricamento e' riuscito", esitoA.esito === 'successo', `${esitoA.esito} — ${ultimoLog().messaggio || ''}`);
verifica('le righe del blocco in sospeso risultano importate', esitoA.primarie_rete_importati === RETE, String(esitoA.primarie_rete_importati));
verifica('gli assegnati sono entrati lo stesso', archivio('Assegnato').length === ASSEGNATI, String(archivio('Assegnato').length));

// ---------------------------------------------------------------------------
console.log("(a) SE IL BLOCCO NON ERA ENTRATO: LO RIMETTE LA RIPARAZIONE");
// Stessa caduta di rete, ma il blocco non e' mai arrivato: le righe mancano
// davvero, e il conteggio non risponde piu' per due volte. Prima si chiudeva
// "parziale" con 200 righe in sospeso; adesso il controllo per ordine le trova
// e le riscrive.

const esitoA2 = await caricamento(() => {
  contaKo = 0;
  gancio = ganciaCadutaDopoLaScrittura({ entita: 'PrimariaRete', blocco: 1, maiArrivato: true });
});

verifica('le righe mancanti vengono rimesse', archivio('PrimariaRete').length === RETE, `${archivio('PrimariaRete').length} righe`);
verifica('sono duecento', (esitoA2.avviso_riparazione || {}).righe === 200, JSON.stringify(esitoA2.avviso_riparazione));
verifica("il caricamento si chiude riuscito", esitoA2.esito === 'successo', `${esitoA2.esito} — ${ultimoLog().messaggio}`);
verifica('non restano righe in sospeso', esitoA2.avviso_non_verificato === null, JSON.stringify(esitoA2.avviso_non_verificato));
verifica('mancavano righe, non ce n' + "'erano di troppo", esitoA2.avviso_doppioni === null, JSON.stringify(esitoA2.avviso_doppioni));

// ---------------------------------------------------------------------------
console.log("(a) LA SCRITTURA PASSA MA LA RISPOSTA SI PERDE");
// La scrittura entra davvero e il browser vede cadere la rete. Il blocco resta
// in sospeso - non si riscrive mai - e a scioglierlo e' la verifica ordine per
// ordine: se quelle righe ci sono, dire "200 righe non scritte" lascerebbe il
// caricamento "parziale", cioe' l'archivio inaffidabile per tutti i moduli.

let tentativiPersi = 0;
const esitoPersa = await caricamento(() => {
  gancio = async (corpo, esegui) => {
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && corpo.blocco === 1) {
      tentativiPersi++;
      await esegui();                              // la scrittura entra...
      throw cadutaDiRete();                        // ...ma la risposta si perde
    }
    return esegui();
  };
});

verifica('il blocco si scrive una volta sola', tentativiPersi === 1, `${tentativiPersi} tentativi`);
verifica("in archivio ci sono tutte le righe, una volta sola", archivio('PrimariaRete').length === RETE, `${archivio('PrimariaRete').length} righe`);
verifica("il caricamento e' riuscito, non 'parziale'", esitoPersa.esito === 'successo', `${esitoPersa.esito} — ${ultimoLog().messaggio || ''}`);
verifica('nessuna riga risulta non scritta', esitoPersa.righe_fallite === 0, String(esitoPersa.righe_fallite));
verifica('il registro non parla di righe non scritte', !String(ultimoLog().messaggio || '').includes('righe non scritte'), ultimoLog().messaggio);

// ---------------------------------------------------------------------------
console.log('(a) ARCHIVIO NON CONTATO: MAI UN "SUCCESSO", E NIENTE RIPARAZIONI ALLA CIECA');
// Il controllo finale non risponde per nessuno dei quattro archivi: non si puo'
// dire se le righe ci siano tutte e una volta sola, e non si tocca niente.

const esitoC = await caricamento(() => {
  gancio = async (corpo, esegui) => {
    if (corpo.azione === 'conta_esatta') throw cadutaDiRete();
    return esegui();
  };
});

verifica('un archivio non contato non e' + "' un archivio a posto", esitoC.esito === 'parziale', esitoC.esito);
verifica('si dicono tutti e quattro gli archivi', esitoC.avviso_non_verificato && esitoC.avviso_non_verificato.archivi.length === 4, JSON.stringify(esitoC.avviso_non_verificato));
verifica('nessuna riparazione alla cieca', quante('cancella_ordini PrimariaRete') === 0 && esitoC.avviso_riparazione === null, String(quante('cancella_ordini PrimariaRete')));
verifica('il registro dei caricamenti lo scrive', String(ultimoLog().messaggio || '').includes('archivi non contati') && ultimoLog().esito === 'parziale', ultimoLog().messaggio);
const testoC = testoVerificaArchivio(esitoC);
verifica('e la scheda lo dice con parole chiare', !!testoC && testoC.testo.includes("Non si e' riusciti a contare") && testoC.classe === 'text-amber-700', testoC && testoC.testo);

// ---------------------------------------------------------------------------
console.log('(b) IL CONTEGGIO ESATTO SI PUO' + "' RIPRENDERE DA DOVE SI E' FERMATO");
// Una sola invocazione ha dodici secondi: su un archivio grande non bastano. La
// function dice fin dove e' arrivata e il browser la richiama da li', invece di
// arrendersi e dichiarare l'archivio non contato (che blocca tutto il gestionale
// fino a un ricaricamento).

globalThis.__ARCHIVI = { PrimariaRete: Array.from({ length: 450 }, (_, i) => ({ id: 'x' + i, id_ordine: 'ORD-' + i })) };
const daZero = await funzione({ azione: 'conta_esatta', tipo_file: 'primarie', entita: 'PrimariaRete' });
verifica('da zero conta tutto', daZero.status === 200 && daZero.body.righe === 450 && daZero.body.finito === true, JSON.stringify(daZero.body));
const daMeta = await funzione({ azione: 'conta_esatta', tipo_file: 'primarie', entita: 'PrimariaRete', da_riga: 150 });
verifica("ripreso da meta' arriva allo stesso totale", daMeta.status === 200 && daMeta.body.righe === 450 && daMeta.body.finito === true, JSON.stringify(daMeta.body));
verifica('senza dettaglio non manda i conteggi per ordine', daZero.body.conteggi === null, JSON.stringify(daZero.body.conteggi));

globalThis.__ARCHIVI = { PrimariaRete: ['A', 'A', 'A', 'B', 'B', 'C', 'D'].map((o, i) => ({ id: 'x' + i, id_ordine: 'ORD-' + o })) };
const conDettaglio = await funzione({ azione: 'conta_esatta', tipo_file: 'primarie', entita: 'PrimariaRete', dettaglio: true });
verifica('col dettaglio dice quante righe ha ogni ordine', conDettaglio.body.righe === 7 && conDettaglio.body.conteggi['ORD-A'] === 3 && conDettaglio.body.conteggi['ORD-B'] === 2 && conDettaglio.body.conteggi['ORD-C'] === 1, JSON.stringify(conDettaglio.body.conteggi));
// Gli ordini distinti NON li conta la function: un giro vede solo le sue pagine,
// e il totale lo mette insieme il browser sommando i conteggi di tutti i giri.
verifica('e gli ordini distinti si contano dai conteggi', Object.keys(conDettaglio.body.conteggi).length === 4, JSON.stringify(conDettaglio.body.conteggi));

globalThis.__ARCHIVI = { AssegnatoAci: [] };
const contaVuoto = await funzione({ azione: 'conta_esatta', tipo_file: 'primarie', entita: 'AssegnatoAci' });
verifica('un archivio vuoto si conta, e fa zero', contaVuoto.status === 200 && contaVuoto.body.righe === 0 && contaVuoto.body.finito === true, JSON.stringify(contaVuoto.body));

const contaFuori = await funzione({ azione: 'conta_esatta', tipo_file: 'secondarie', entita: 'Secondaria' });
verifica("l'azione vale solo per le primarie", contaFuori.status === 400, JSON.stringify(contaFuori.body));

const contaArchivioSbagliato = await funzione({ azione: 'conta_esatta', tipo_file: 'primarie', entita: 'Inventato' });
verifica('un archivio che non esiste viene rifiutato', contaArchivioSbagliato.status === 400, JSON.stringify(contaArchivioSbagliato.body));

// (A6) Nei messaggi d'errore l'archivio si chiama come lo chiama chi lavora.
globalThis.__ARCHIVI = null;
const contaRotta = await funzione({ azione: 'conta_esatta', tipo_file: 'primarie', entita: 'PrimariaRete', nome: 'Primarie RETE' });
verifica("la fase dice 'Primarie RETE', non il nome del database", contaRotta.status === 500 && String(contaRotta.body.fase).includes('Primarie RETE') && !String(contaRotta.body.fase).includes('PrimariaRete'), JSON.stringify(contaRotta.body.fase));

// Il browser che riprende: la prima risposta dice di essersi fermata a 150.
const esitoRipreso = await caricamento(() => {
  let spezzato = false;
  gancio = async (corpo, esegui) => {
    const risposta = await esegui();
    if (corpo.azione === 'conta_esatta' && corpo.entita === 'PrimariaRete' && !spezzato) {
      spezzato = true;
      // come se il tempo fosse finito a meta': si e' contato fino alla riga 150
      const conteggi = Object.fromEntries(Object.entries(risposta.data.conteggi || {}).slice(0, 150));
      return { status: 200, data: { ...risposta.data, righe: 150, finito: false, conteggi } };
    }
    return risposta;
  };
});
verifica('il browser richiama il conteggio e lo porta a termine', quante('conta_esatta PrimariaRete') === 2, `${quante('conta_esatta PrimariaRete')} chiamate`);
verifica("l'archivio risulta contato e il caricamento riuscito", esitoRipreso.esito === 'successo' && esitoRipreso.avviso_non_verificato === null, `${esitoRipreso.esito} ${JSON.stringify(esitoRipreso.avviso_non_verificato)}`);

// Un conteggio che non avanza mai non manda il browser in tondo: si arrende e lo dice.
const esitoFermo = await caricamento(() => {
  gancio = async (corpo, esegui) => {
    const risposta = await esegui();
    if (corpo.azione === 'conta_esatta' && corpo.entita === 'PrimariaRete') {
      return { status: 200, data: { ...risposta.data, righe: 150, finito: false } };
    }
    return risposta;
  };
});
verifica('un conteggio che non avanza si ferma dopo due giri per volta', quante('conta_esatta PrimariaRete') === 4, `${quante('conta_esatta PrimariaRete')} chiamate`);
verifica("e l'archivio si dichiara non contato", esitoFermo.esito === 'parziale'
  && esitoFermo.avviso_non_verificato && esitoFermo.avviso_non_verificato.non_contato === true
  && esitoFermo.avviso_non_verificato.archivi.join() === 'Primarie RETE', JSON.stringify(esitoFermo.avviso_non_verificato));

// ---------------------------------------------------------------------------
console.log("(A2/A4/d) IL PERCORSO CHE NON E' QUELLO DELLE PRIMARIE: ORDINI NON DICHIARATI");
// UN CONTEGGIO NON SCIOGLIE UN BLOCCO CHE LA PIATTAFORMA NON HA CONFERMATO, e
// qui sta la correzione del settimo giro.
//
// Di un blocco non confermato non si sa se abbia lasciato in archivio zero
// righe, quelle giuste, o il doppio: una richiesta puo' essere stata eseguita
// due volte. Un conteggio uguale alle righe del file non distingue "ci sono una
// volta sola" da "la lettura e' indietro di qualche secondo", e su questo
// percorso non c'e' la riparazione a scioglierlo - non c'e' un id ordine comune
// a tutti i tipi di file. Prima bastava UNA lettura in ritardo e il caricamento
// si chiudeva "successo" con duecento righe entrate due volte.
//
// Adesso quelle righe si dicono in sospeso, il caricamento resta parziale e si
// ricarica il file, che svuota l'archivio e lo riscrive. Costa un ricaricamento
// quando l'archivio era a posto; l'alternativa e' un "successo" che nessuno
// puo' sostenere.

const esitoOnd = await caricamentoGenerico(() => {
  contaKo = 0;
  gancio = ganciaCadutaDopoLaScrittura({ blocco: 1 });
});

verifica('in archivio ci sono tutte le righe del file', archivio('OrdineNonDichiarato').length === OND, `${archivio('OrdineNonDichiarato').length} righe`);
verifica('il blocco in sospeso non viene riscritto', quante('scrivi #1') === 1, `${quante('scrivi #1')} scritture`);
verifica("il conteggio da solo non chiude il caricamento", esitoOnd.esito === 'parziale', `${esitoOnd.esito} — ${ultimoLog('ordini_non_dichiarati').messaggio || ''}`);
verifica('le righe in sospeso si dicono', (esitoOnd.avviso_non_verificato || {}).righe_incerte === 200, JSON.stringify(esitoOnd.avviso_non_verificato));
verifica("e non si dichiara che l'archivio non si e' potuto contare", (esitoOnd.avviso_non_verificato || {}).non_contato === false, JSON.stringify(esitoOnd.avviso_non_verificato));
verifica('le righe importate sono quelle confermate, non quelle lette', esitoOnd.righe_importate === OND - 200, String(esitoOnd.righe_importate));
verifica('la scheda lo dice con parole semplici', String((testoVerificaArchivio(esitoOnd) || {}).testo || '').includes('200 righe sono rimaste in sospeso'), JSON.stringify(testoVerificaArchivio(esitoOnd)));
verifica('e il titolo della finestra non promette un caricamento completato', titoloAvviso(avvisiDaMostrare(esitoOnd)) === "Caricamento da rifare: l'archivio non si e' potuto verificare", titoloAvviso(avvisiDaMostrare(esitoOnd)));
const logOnd = ultimoLog('ordini_non_dichiarati');
// "Verificato" era una parola piu' forte di quello che si e' fatto: qui c'e' UN
// conteggio, preso subito dopo la scrittura, e subito dopo una scrittura grossa
// la lettura puo' rispondere con un numero ancora indietro.
verifica("il registro dice che cosa ha risposto il conteggio, non che ha verificato", String(logOnd.messaggio || '').includes(`archivio contato dopo la scrittura: ${OND} record`) && !String(logOnd.messaggio || '').includes('verificato'), logOnd.messaggio);
verifica('e non si contraddice nella stessa riga', !String(logOnd.messaggio || '').includes('archivio non verificato'), logOnd.messaggio);
verifica('il registro dice che quelle righe non sono state confermate', String(logOnd.messaggio || '').includes('200 righe che la piattaforma non ha confermato'), logOnd.messaggio);
verifica("e nello storico i conti tornano", (logOnd.righe_importate || 0) + 200 === OND, `${logOnd.righe_importate} + 200 invece di ${OND}`);
verifica("il caricamento resta parziale nel registro", logOnd.esito === 'parziale', logOnd.esito);

// (A2) Un blocco entrato due volte: 650 righe su 450. Il registro NON deve
// scrivere "successo" ne' "archivio verificato: 650 record".
const esitoOndDoppio = await caricamentoGenerico(() => {
  let fatto = false;
  gancio = async (corpo, esegui) => {
    const risposta = await esegui();
    if (corpo.azione === 'scrivi' && corpo.blocco === 0 && !fatto) { fatto = true; await esegui(); }
    return risposta;
  };
});
const logOndDoppio = ultimoLog('ordini_non_dichiarati');
verifica('in archivio ci sono davvero le righe doppie', archivio('OrdineNonDichiarato').length === OND + 200, `${archivio('OrdineNonDichiarato').length} righe`);
verifica('a video il caricamento non e' + "' riuscito", esitoOndDoppio.esito === 'parziale', esitoOndDoppio.esito);
verifica('E NEMMENO NEL REGISTRO', logOndDoppio.esito === 'parziale', `${logOndDoppio.esito} — ${logOndDoppio.messaggio}`);
verifica('il registro non dice "archivio verificato" di un archivio che non lo e' + "'", !String(logOndDoppio.messaggio || '').includes('archivio verificato'), logOndDoppio.messaggio);
verifica('e dice quante righe ci sono e quante ne porta il file', String(logOndDoppio.messaggio || '').includes(`${OND + 200} righe su ${OND} del file`), logOndDoppio.messaggio);
verifica('dice anche che un blocco puo' + "' essere entrato due volte", String(logOndDoppio.messaggio || '').includes('entrato due volte'), logOndDoppio.messaggio);
// (A4) Il campo che ferma i ricalcoli lo produce anche questo percorso.
verifica('(A4) i ricalcoli si fermano: c' + "'e' l'avviso delle righe di troppo", !!esitoOndDoppio.avviso_doppioni && esitoOndDoppio.avviso_doppioni.righe_in_piu === 200, JSON.stringify(esitoOndDoppio.avviso_doppioni));
const testoOndDoppio = testoVerificaArchivio(esitoOndDoppio);
verifica('e la scheda non tace', !!testoOndDoppio && testoOndDoppio.testo.includes('200 righe di troppo'), testoOndDoppio && testoOndDoppio.testo);
// (G8) Qui la riparazione NON ESISTE: la finestra diceva "il gestionale ha gia'
// provato a rimetterle a posto da solo senza riuscirci", che su questo percorso
// e' semplicemente falso, e la riga sotto la scheda parlava di ricalcoli dei
// moduli collegati, che per gli ordini non dichiarati non ce n'e' nessuno.
verifica('nessuna riparazione viene raccontata dove non esiste', !esitoOndDoppio.avviso_riparazione && !esitoOndDoppio.riparazione_tentata, JSON.stringify({ r: esitoOndDoppio.avviso_riparazione, t: esitoOndDoppio.riparazione_tentata }));
verifica('e nessuna cancellazione mirata viene chiesta', quante('cancella_ordini') === 0, String(quante('cancella_ordini')));
verifica("la scheda non promette una riparazione che non c'e'", !!testoOndDoppio && !testoOndDoppio.testo.includes('rimettere a posto') && !testoOndDoppio.testo.includes('rimesse a posto'), testoOndDoppio && testoOndDoppio.testo);
verifica('e non parla di ricalcoli che qui non esistono', !!testoOndDoppio && !testoOndDoppio.testo.includes('ricalcoli dei moduli collegati'), testoOndDoppio && testoOndDoppio.testo);
// La stessa cosa nella finestra: il riquadro non deve nominare moduli che per
// questo tipo di file non esistono.
verifica('e nemmeno la finestra', avvisiDaMostrare(esitoOndDoppio).con_ricalcoli === false, JSON.stringify(avvisiDaMostrare(esitoOndDoppio).con_ricalcoli));
verifica('mentre per le primarie i moduli ci sono', (avvisiDaMostrare(esitoNonRiparato) || {}).con_ricalcoli === true, JSON.stringify(avvisiDaMostrare(esitoNonRiparato)));
verifica("e non promette la conferma del prossimo caricamento", !!testoOndDoppio && !testoOndDoppio.testo.includes('chiede una conferma'), testoOndDoppio && testoOndDoppio.testo);
// L'archivio si chiama col suo nome, non con la parola "archivio".
verifica("l'archivio ha un nome, non si chiama «archivio»", ((esitoOndDoppio.avviso_doppioni || {}).archivi || [{}])[0].nome === 'Ordini Non Dichiarati', JSON.stringify((esitoOndDoppio.avviso_doppioni || {}).archivi));

// (Rev1 §3) IL CONTEGGIO FINALE IN RITARDO, SUL PERCORSO CHE NON E' QUELLO
// DELLE PRIMARIE. Il blocco entra DUE VOLTE (la piattaforma lo ripete), la rete
// cade, e da li' in poi il conteggio risponde col numero del file. Bastava
// quella lettura sola: il caricamento si chiudeva "successo" con 200 righe
// entrate due volte e i pesi contati doppi da li' in avanti. Adesso il blocco
// non e' stato confermato, e un conteggio uguale alle righe del file non
// distingue "ci sono una volta sola" da una lettura in ritardo: non si dichiara
// riuscito.
const esitoOndLetturaIndietro = await caricamentoGenerico(() => {
  let fatto = false;
  let indietro = 0;
  gancio = async (corpo, esegui) => {
    if (corpo.azione === 'conta' && indietro > 0) {
      indietro--;
      return { status: 200, data: { conteggio: OND, contato: true } };
    }
    if (corpo.azione === 'scrivi' && corpo.blocco === 0 && !fatto) {
      fatto = true;
      await esegui();
      await esegui();          // la piattaforma scrive il blocco due volte
      indietro = 6;            // e da qui il conteggio risponde il numero del file
      throw cadutaDiRete();
    }
    return esegui();
  };
});
verifica('in archivio ci sono davvero le righe doppie', archivio('OrdineNonDichiarato').length === OND + 200, `${archivio('OrdineNonDichiarato').length} righe`);
verifica("la lettura in ritardo non chiude il caricamento", esitoOndLetturaIndietro.esito === 'parziale', `${esitoOndLetturaIndietro.esito} — ${ultimoLog('ordini_non_dichiarati').messaggio || ''}`);
verifica('e non si dichiara nessun "quadra"', esitoOndLetturaIndietro.righe_importate < OND, String(esitoOndLetturaIndietro.righe_importate));
verifica('lo dice a chi legge', !!testoVerificaArchivio(esitoOndLetturaIndietro), JSON.stringify(testoVerificaArchivio(esitoOndLetturaIndietro)));
verifica('e il registro non scrive un caricamento riuscito', ultimoLog('ordini_non_dichiarati').esito === 'parziale', ultimoLog('ordini_non_dichiarati').messaggio);

// Il conteggio finale che non risponde: si dice che l'archivio non e' contato,
// e basta quello - non si aggiunge anche la frase delle righe in sospeso.
const esitoOndNonContato = await caricamentoGenerico(() => {
  let scritto = 0;
  gancio = async (corpo, esegui) => {
    // il conteggio dello svuotamento deve funzionare, quello finale no
    if (corpo.azione === 'scrivi') { scritto++; return esegui(); }
    if (corpo.azione === 'conta' && scritto >= 3) throw cadutaDiRete();
    return esegui();
  };
});
const logNonContato = ultimoLog('ordini_non_dichiarati');
verifica("senza conteggio finale il caricamento non e' riuscito", esitoOndNonContato.esito === 'parziale', esitoOndNonContato.esito);
verifica("il registro dice che l'archivio non e' verificato", String(logNonContato.messaggio || '').includes('archivio non verificato'), logNonContato.messaggio);
verifica('e non dice anche il contrario', !String(logNonContato.messaggio || '').includes('archivio verificato:'), logNonContato.messaggio);
verifica('non si inventano righe in sospeso che non ci sono', !String(logNonContato.messaggio || '').includes('di cui non si sa'), logNonContato.messaggio);
const testoOnd = testoVerificaArchivio(esitoOndNonContato);
verifica('la scheda dice solo quello che e' + "' successo", !!testoOnd && testoOnd.testo.includes("Non si e' riusciti a contare") && !testoOnd.testo.includes('in sospeso'), testoOnd && testoOnd.testo);

// ---------------------------------------------------------------------------
console.log("(c) CARICAMENTO PRECEDENTE CHE HA GIA' SVUOTATO: SI CHIEDE CONFERMA");

const ids = righeFile.map(r => r.ID);
const TUTTI = new Set(ids).size;
const preparazione = (extra = {}) => funzione({
  azione: 'prepara', tipo_file: 'primarie', nome_file: 'primarie.xlsx',
  intestazioni: colonne, totale_righe: ids.length, ids, terminati: RETE,
  ultima_fine_trasporto: '13/09/2026 12:57:36', ...extra,
});
// utente: chi aveva avviato il caricamento morto. 'Prova' e' chi sta ricaricando
// adesso, cioe' il caso normale - uno si vede morire la scheda e riparte lui.
// Con un nome DIVERSO e una riga aperta da pochi minuti scatta invece il
// messaggio "sta caricando, aspetta che finisca": non c'e' niente da forzare,
// e lo si dice subito (prima lo si scopriva solo dopo aver premuto il pulsante
// rosso).
const logAperto = (minutiFa, primaCerano = TUTTI, utente = 'Mario Rossi') => ({
  id: 'log1', tipo_file: 'primarie', nome_file: 'primarie.xlsx', esito: 'in_corso',
  utente, modalita: 'sostituzione',
  created_date: new Date(Date.now() - minutiFa * 60 * 1000).toISOString(),
  ...(primaCerano === null ? {} : { righe_archivio_prima: primaCerano }),
  messaggio: 'Caricamento in corso: archivio in riscrittura.',
});
// Gli ordini rimasti in archivio, i primi n del file.
const restano = (n) => ({
  PrimariaRete: ids.slice(0, n).map((id, i) => ({ id: 'p' + i, id_ordine: id })),
});

// Chi si vede morire la scheda ricarica SUBITO, e ricarica lui: il varco vero e'
// li'. Prima si chiedeva conferma solo dopo dieci minuti, perche' si guardava
// "interrotto", e in quei dieci minuti il file passava in silenzio - il blocco
// "un altro sta caricando" non scatta, perche' e' la stessa persona.
for (const minuti of [1, 5, 9, 11, 30]) {
  globalThis.__ARCHIVI = { UploadLog: [logAperto(minuti, TUTTI, 'Prova')], ...restano(30) };
  const r = await preparazione();
  verifica(`ricaricato dalla stessa persona dopo ${minuti} minuti: si chiede conferma`, r.status === 409 && r.body.richiede_conferma === true, `${r.status} ${String(r.body.error || '').slice(0, 80)}`);
}

globalThis.__ARCHIVI = { UploadLog: [logAperto(1, TUTTI, 'Prova')], ...restano(30) };
const bloccata = await preparazione();
verifica('dice che il controllo non puo' + "' accorgersi di un file incompleto", String(bloccata.body.error || '').includes("non puo' accorgersi se il file e' incompleto"), bloccata.body.error);
// (A6/Rev3 §4) La frase NON dice piu' "si e' fermato": era falsa nel caso piu'
// comune, il caricamento arrivato in fondo perdendo delle righe.
verifica('e non dice il falso: quel caricamento puo' + "' essere arrivato in fondo", !String(bloccata.body.error || '').includes("si e' fermato"), bloccata.body.error);
verifica('dice quanti ordini sono rimasti e quanti ce ne erano', String(bloccata.body.dettaglio || '').includes('sono rimasti 30 ordini dei 480'), bloccata.body.dettaglio);
verifica('dice a chi ha lo stesso file che cosa fare', String(bloccata.body.dettaglio || '').includes('STESSO file'), bloccata.body.dettaglio);
verifica('e lo dice anche a chi ha un export piu' + "' nuovo", String(bloccata.body.dettaglio || '').includes("export piu' nuovo"), bloccata.body.dettaglio);
verifica('dice quale caricamento ha lasciato meno ordini', String(bloccata.body.dettaglio || '').includes('Prova') && String(bloccata.body.dettaglio).includes('primarie.xlsx'), bloccata.body.dettaglio);
verifica('nessun dato e' + "' stato toccato", bloccata.body.dati_intatti === true && archivio('PrimariaRete').length === 30);
verifica('la data e' + "' scritta all'italiana", /\b\d{2}\/\d{2}\/\d{4}\b/.test(String(bloccata.body.dettaglio)) && !/\d{4}-\d{2}-\d{2}/.test(String(bloccata.body.dettaglio)), bloccata.body.dettaglio);
verifica('e dice quale conferma sta chiedendo', bloccata.body.conferma === 'archivio_rimpicciolito', String(bloccata.body.conferma));

// Con la conferma si procede.
globalThis.__ARCHIVI = { UploadLog: [logAperto(1, TUTTI, 'Prova')], ...restano(30) };
const forzata = await preparazione({ conferma_forzatura: 'archivio_rimpicciolito' });
verifica('con la conferma la preparazione va avanti', forzata.status === 200 && forzata.body.preparato === true, JSON.stringify(forzata.body).slice(0, 200));
verifica('e apre la sua riga nel registro', archivio('UploadLog').some(l => l.esito === 'in_corso' && l.id !== 'log1'), JSON.stringify(archivio('UploadLog').map(l => l.esito)));
// (A6/Rev2 §1) Il numero di partenza NON scende: la riga nuova nasce con quanti
// ordini c'erano l'ultima volta che l'archivio era a posto, non con quelli di
// adesso. Scrivendo quelli di adesso il controllo si spegneva da solo.
const rigaNuova = archivio('UploadLog').find(l => l.esito === 'in_corso' && l.id !== 'log1') || {};
verifica('il numero di partenza non scende', rigaNuova.righe_archivio_prima === TUTTI, String(rigaNuova.righe_archivio_prima));
verifica('e la preparazione lo rimanda indietro giusto', forzata.body.righe_archivio_prima === TUTTI, String(forzata.body.righe_archivio_prima));

// Con l'archivio gia' vuoto il controllo resta vivo lo stesso: e' il caso in cui
// prima passava in silenzio un export rifiltrato.
globalThis.__ARCHIVI = { UploadLog: [logAperto(1, TUTTI, 'Prova')], PrimariaRete: [] };
await preparazione({ conferma_forzatura: 'archivio_rimpicciolito' });
const terzoTentativo = await preparazione();
verifica('al tentativo dopo il controllo protegge ancora', terzoTentativo.status === 409 && terzoTentativo.body.conferma === 'archivio_rimpicciolito', `${terzoTentativo.status} ${terzoTentativo.body.conferma}`);

// L'archivio non si e' rimpicciolito: non e' stato svuotato niente, il confronto
// di sopra ha avuto di che lavorare e non si chiede niente. E' chi ricarica lo
// stesso file dopo un caricamento chiuso male.
globalThis.__ARCHIVI = { UploadLog: [logAperto(1, TUTTI, 'Prova')], ...restano(TUTTI) };
const intatto = await preparazione();
verifica("con l'archivio ancora intero non si chiede conferma", intatto.status === 200 && intatto.body.preparato === true, JSON.stringify(intatto.body).slice(0, 200));

// Chi ha in mano un export PIU' NUOVO non viene mandato a ripescare quello
// vecchio: l'archivio non e' rimpicciolito, ha solo meno ordini del file nuovo.
globalThis.__ARCHIVI = { UploadLog: [logAperto(1, 400, 'Prova')], ...restano(400) };
const fileNuovo = await preparazione();
verifica("un file piu' nuovo, con piu' ordini dell'archivio, passa", fileNuovo.status === 200 && fileNuovo.body.preparato === true, `${fileNuovo.status} ${String(fileNuovo.body.error || '')}`);

// Senza un caricamento aperto alle spalle non si chiede niente.
globalThis.__ARCHIVI = { UploadLog: [] };
const normale = await preparazione();
verifica('un caricamento normale non chiede conferma', normale.status === 200 && normale.body.preparato === true, JSON.stringify(normale.body).slice(0, 200));

// Un caricamento concluso bene non tiene in ballo nessun archivio.
globalThis.__ARCHIVI = { UploadLog: [{
  id: 'log2', tipo_file: 'primarie', nome_file: 'primarie.xlsx', esito: 'successo',
  utente: 'Mario Rossi', modalita: 'sostituzione',
  created_date: new Date(Date.now() - 30 * 60 * 1000).toISOString(), righe_importate: RETE,
}] };
const dopoBuono = await preparazione();
verifica('dopo un caricamento riuscito non si chiede niente', dopoBuono.status === 200 && dopoBuono.body.preparato === true, JSON.stringify(dopoBuono.body).slice(0, 200));

// Una riga vecchia del registro, senza quanti ordini c'erano prima, non permette
// il confronto: non si inventa un allarme.
globalThis.__ARCHIVI = { UploadLog: [logAperto(1, null, 'Prova')], ...restano(30) };
const senzaMisura = await preparazione();
verifica('senza il numero di prima non si chiede conferma', senzaMisura.status === 200 && senzaMisura.body.preparato === true, `${senzaMisura.status} ${String(senzaMisura.body.error || '')}`);

// ---------------------------------------------------------------------------
console.log('(A3) UN COLLEGA CHE STA CARICANDO ADESSO NON SI E' + "' FERMATO");
// Mario sta caricando da un minuto e Anna parte anche lei. Prima le si diceva
// che il caricamento di prima "si e' fermato" e le si offriva il pulsante rosso
// "Forza caricamento"; la verita' - "Mario sta caricando, aspetta" - la scopriva
// solo dopo averlo premuto, perche' il blocco di concorrenza gira dopo.

globalThis.__ARCHIVI = { UploadLog: [logAperto(1, TUTTI, 'Mario Rossi')], ...restano(30) };
const collega = await preparazione();
verifica('il caricamento viene fermato', collega.status === 409, String(collega.status));
verifica('e gli si dice che un collega sta caricando', String(collega.body.error || '').includes('Mario Rossi sta caricando') && String(collega.body.error).includes('aspetta che finisca'), collega.body.error);
verifica('NON si dice che si e' + "' fermato", !String(collega.body.error || '').includes("si e' fermato"), collega.body.error);
verifica('e NON si offre nessun pulsante da forzare', !collega.body.richiede_conferma, JSON.stringify(collega.body.richiede_conferma));
verifica('i dati restano intatti', collega.body.dati_intatti === true && archivio('PrimariaRete').length === 30);
verifica('non si sporca il registro con un errore inventato', archivio('UploadLog').length === 1, String(archivio('UploadLog').length));

// Un collega la cui riga dice che il caricamento non e' riuscito non sta piu'
// scrivendo: li' il controllo dell'archivio rimpicciolito torna a valere.
globalThis.__ARCHIVI = { UploadLog: [{ ...logAperto(1, TUTTI, 'Mario Rossi'), messaggio: "Caricamento non riuscito: nessuna riga scritta dopo lo svuotamento dell'archivio." }], ...restano(30) };
const collegaMorto = await preparazione();
verifica("se il collega NON e' riuscito, si torna al controllo dell'archivio", collegaMorto.status === 409 && collegaMorto.body.conferma === 'archivio_rimpicciolito', `${collegaMorto.status} ${collegaMorto.body.conferma}`);

// ---------------------------------------------------------------------------
console.log('(A6) LE DUE CONFERME SONO SEPARATE');
// Il rimedio normale dopo un caricamento parziale passa per il pulsante rosso.
// Con un flag unico quel pulsante spegneva nello stesso tentativo anche il
// controllo degli ordini che sparirebbero, cioe' la protezione contro un export
// rifiltrato. Adesso ogni 409 dice quale conferma chiede, e si conferma quella.

const conOrdineFuori = () => ({
  UploadLog: [logAperto(1, TUTTI, 'Prova')],
  PrimariaRete: [...ids.slice(0, 30).map((id, i) => ({ id: 'p' + i, id_ordine: id })), { id: 'v1', id_ordine: 'ORD-99999' }],
});

globalThis.__ARCHIVI = conOrdineFuori();
const senzaNiente = await preparazione();
verifica('gli ordini che sparirebbero restano il messaggio piu' + "' importante", senzaNiente.status === 409 && String(senzaNiente.body.error || '').includes('meno dati') && senzaNiente.body.mancanti === 1, JSON.stringify(senzaNiente.body).slice(0, 200));
verifica('e dice quale conferma chiede', senzaNiente.body.conferma === 'ordini_mancanti', String(senzaNiente.body.conferma));

globalThis.__ARCHIVI = conOrdineFuori();
const soloRimpicciolito = await preparazione({ conferma_forzatura: 'archivio_rimpicciolito' });
verifica("confermare l'archivio rimpicciolito NON spegne il controllo degli ordini", soloRimpicciolito.status === 409 && soloRimpicciolito.body.conferma === 'ordini_mancanti', `${soloRimpicciolito.status} ${soloRimpicciolito.body.conferma}`);

globalThis.__ARCHIVI = conOrdineFuori();
const soloOrdini = await preparazione({ conferma_forzatura: 'ordini_mancanti' });
verifica("e confermare gli ordini NON spegne il controllo dell'archivio", soloOrdini.status === 409 && soloOrdini.body.conferma === 'archivio_rimpicciolito', `${soloOrdini.status} ${soloOrdini.body.conferma}`);

globalThis.__ARCHIVI = conOrdineFuori();
const tutteEDue = await preparazione({ conferma_forzatura: ['ordini_mancanti', 'archivio_rimpicciolito'] });
verifica('con tutte e due le conferme si procede', tutteEDue.status === 200 && tutteEDue.body.preparato === true, JSON.stringify(tutteEDue.body).slice(0, 150));

// ---------------------------------------------------------------------------
console.log('(B2) I RICALCOLI NON RESTANO APPESI');
// Un caricamento riuscito i cui ricalcoli non sono partiti - la scheda chiusa, la
// rete caduta - si riconosce dal registro e si rifa' da solo. E' la seconda
// regola assoluta: ogni caricamento aggiorna tutto.

const logRiuscito = (messaggio = '480 righe del file entrate in archivio') => ({
  id: 'ok1', tipo_file: 'primarie', nome_file: 'primarie.xlsx', esito: 'successo',
  utente: 'Prova', modalita: 'sostituzione', righe_importate: 480, messaggio,
  created_date: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
});

globalThis.__ARCHIVI = { UploadLog: [logRiuscito()] };
verifica('un caricamento riuscito senza la nota va rifatto', (await ricalcoliDaRecuperare()).includes('primarie'), JSON.stringify(await ricalcoliDaRecuperare()));

globalThis.__ARCHIVI = { UploadLog: [logRiuscito(`480 righe | ${MODULI_AGGIORNATI}`)] };
verifica('con la nota non si rifa' + "' piu'", !(await ricalcoliDaRecuperare()).includes('primarie'), JSON.stringify(await ricalcoliDaRecuperare()));

globalThis.__ARCHIVI = { UploadLog: [{ ...logRiuscito(), esito: 'parziale' }] };
verifica("su un archivio inaffidabile i ricalcoli non partono affatto", !(await ricalcoliDaRecuperare()).includes('primarie'), JSON.stringify(await ricalcoliDaRecuperare()));

// E quando i ricalcoli vanno tutti, la nota si scrive: col codice vero, function
// compresa.
globalThis.__ARCHIVI = { UploadLog: [logRiuscito()] };
registro = [];
gancio = null;
ricalcoliFinti = async () => ({ status: 200, data: {} });
const esitiRicalcoli = await dopoCaricamento('primarie');
// QUATTRO, NON CINQUE: la predittivita' e' stata tolta dai ricalcoli il
// 26/09/2026. La pagina si ricalcola da sola a ogni apertura senza scrivere
// niente, e il programma della settimana si fissa il mercoledi' alle 8: rifarlo
// a ogni caricamento cambierebbe il programmato, che deve restare quello deciso
// per confrontarlo col fatto.
verifica('i ricalcoli partono tutti e quattro', esitiRicalcoli.length === 4 && esitiRicalcoli.every(e => e.ok), JSON.stringify(esitiRicalcoli.map(e => [e.nome, e.ok])));
verifica('e il registro se lo segna', String(ultimoLog().messaggio || '').includes(MODULI_AGGIORNATI), ultimoLog().messaggio);
verifica('cosi' + "' la volta dopo non si ripetono", !(await ricalcoliDaRecuperare()).includes('primarie'), JSON.stringify(await ricalcoliDaRecuperare()));

// Un ricalcolo non riuscito non fa scrivere la nota: si rifara'.
globalThis.__ARCHIVI = { UploadLog: [logRiuscito()] };
ricalcoliFinti = async (nome) => (nome === 'qualificaFornitori' ? { status: 500, data: { error: 'non riuscito' } } : { status: 200, data: {} });
await dopoCaricamento('primarie');
verifica('con un ricalcolo non riuscito la nota non si scrive', !String(ultimoLog().messaggio || '').includes(MODULI_AGGIORNATI), ultimoLog().messaggio);
verifica('e il recupero lo ritrova', (await ricalcoliDaRecuperare()).includes('primarie'), JSON.stringify(await ricalcoliDaRecuperare()));
ricalcoliFinti = null;

// La nota non si scrive su un caricamento che non e' riuscito.
globalThis.__ARCHIVI = { UploadLog: [{ ...logRiuscito(), esito: 'parziale' }] };
const segnaSuParziale = await funzione({ azione: 'moduli_aggiornati', tipo_file: 'primarie' });
verifica('la nota non si appiccica a un caricamento parziale', segnaSuParziale.body.segnato === false, JSON.stringify(segnaSuParziale.body));

// (A4 / Rev2 §3) I ricalcoli partono solo su un caricamento riuscito: prima si
// fermavano solo sull'errore e sulle righe di troppo, e un archivio con righe
// mancanti o non contato li faceva partire lo stesso.
verifica('su un archivio a posto i moduli si ricalcolano', moduliDaRicalcolare({ esito: 'successo' }) === true);
verifica('su un parziale no', moduliDaRicalcolare({ esito: 'parziale' }) === false);
verifica('su un errore nemmeno', moduliDaRicalcolare({ esito: 'errore' }) === false);
verifica('e un caricamento senza esito parte come prima', moduliDaRicalcolare({}) === true);
verifica('archivio con righe di troppo: fermi', moduliDaRicalcolare(esitoNonRiparato) === false, esitoNonRiparato.esito);
verifica('archivio non contato: fermi', moduliDaRicalcolare(esitoC) === false, esitoC.esito);
verifica('dopo una riparazione riuscita: partono', moduliDaRicalcolare(esitoPerse) === true, esitoPerse.esito);

// (Rev2 §3) La qualifica rileggeva primarie, secondarie ed extra raccolta e
// salvava il riepilogo anche con un caricamento aperto: era l'unica a farlo.
// Adesso calcola, SALTA il salvataggio e risponde 200 dicendo che e' rinviata,
// come i quattro moduli fratelli: rispondere 409 chiudeva anche la PAGINA
// Qualifica Fornitori, che chiama la stessa function a ogni apertura, e dopo un
// caricamento parziale restava una schermata d'errore finche' non si ricaricava.
globalThis.__ARCHIVI = { UploadLog: [logAperto(1, TUTTI, 'Prova')] };
const qualificaRinviata = await qualifica({ anno: 2026 });
verifica('(Rev2 §3) la qualifica si rinvia con un caricamento aperto', qualificaRinviata.status === 200 && qualificaRinviata.body.rinviato === true, `${qualificaRinviata.status} ${String(qualificaRinviata.body.error || '').slice(0, 90)}`);
verifica('e la pagina continua ad aprirsi, col riepilogo calcolato', !!qualificaRinviata.body.riepilogo && Array.isArray(qualificaRinviata.body.soggetti), JSON.stringify(Object.keys(qualificaRinviata.body)).slice(0, 160));
verifica('dicendo che non e' + "' aggiornata", String(qualificaRinviata.body.avviso || '').includes('non aggiornata') && qualificaRinviata.body.riepilogo_salvato === false, String(qualificaRinviata.body.avviso || '').slice(0, 120));
verifica("e non scrive niente sull'archivio a meta'", !archivio('RiepilogoQualifica').length && !archivio('Alert').length, JSON.stringify(Object.keys(globalThis.__ARCHIVI)));
// Il ricalcolo deve continuare a dirsi NON fatto: il 200 con "rinviato" non
// vale come ricalcolo fatto, e la nota dei moduli aggiornati non si attacca.
globalThis.__ARCHIVI = { UploadLog: [logRiuscito()] };
ricalcoliFinti = async (nome) => (nome === 'qualificaFornitori'
  ? { status: 200, data: qualificaRinviata.body }
  : { status: 200, data: {} });
const conQualificaRinviata = await dopoCaricamento('primarie');
ricalcoliFinti = null;
const rigaQualifica = conQualificaRinviata.find(e => e.nome.includes('qualifica')) || {};
verifica('e per il ricalcolo resta "non aggiornato"', rigaQualifica.ok === false && String(rigaQualifica.errore).includes('rinviato'), JSON.stringify(rigaQualifica));
verifica('quindi la nota dei moduli aggiornati non si attacca', !String(ultimoLog().messaggio || '').includes(MODULI_AGGIORNATI), ultimoLog().messaggio);
globalThis.__ARCHIVI = { UploadLog: [] };
const qualificaNormale = await qualifica({ anno: 2026 });
verifica('senza caricamenti aperti la qualifica si fa', qualificaNormale.status === 200, `${qualificaNormale.status} ${String(qualificaNormale.body.error || '').slice(0, 90)}`);

// ---------------------------------------------------------------------------
console.log('(B3) GLI ORDINI "ESEGUITO": TUTTI I DATI, MA NESSUNO HA PREMUTO CHIUDI');
// A portale l'ordine ha peso, date e formulario, ma non e' chiuso. Il gestionale
// conta solo i "terminato": finche' resta cosi' sparisce da raccolto, giacenze,
// report, copertura del target e fatturazione. Sui dati veri ce n'era uno,
// ET26152600 da 3.620 kg, e mancava dal raccolto senza che nessuno lo dicesse.

verifica('un ordine "eseguito" si riconosce', eEseguito({ stato: 'Eseguito' }) === true && eEseguito({ stato: 'terminato' }) === false);
const riepEseguiti = riepilogoEseguiti([
  { id_ordine: 'ET26152600', stato: 'eseguito', peso_effettivo: 3620 },
  { id_ordine: 'ET26152600', stato: 'eseguito', peso_effettivo: 1000 },  // seconda classe: stesso ordine
  { id_ordine: 'ET26000001', stato: 'terminato', peso_effettivo: 12000 },
]);
verifica('si contano ordini distinti, non righe', riepEseguiti.ordini === 1 && riepEseguiti.righe === 2, JSON.stringify(riepEseguiti));
verifica('e i kg sono la somma delle sue righe, interi', riepEseguiti.kg === 4620, String(riepEseguiti.kg));
verifica('i terminati non ci entrano', riepEseguiti.esempi.length === 1 && riepEseguiti.esempi[0].id_ordine === 'ET26152600', JSON.stringify(riepEseguiti.esempi));

// Dal file, durante il caricamento: rete e ACI separati, mai sommati.
const righeConEseguiti = [
  ...Array.from({ length: 10 }, (_, i) => riga(i + 1)),
  { ...riga(900, { stato: 'eseguito' }), Peso_effettivo: 3620 },
  { ...riga(901, { stato: 'eseguito' }), Peso_effettivo: 1000 },
  { ...riga(902, { classe: '9', stato: 'eseguito' }), Prodotto: '9 - PFU Autodemolizione', Peso_effettivo: 500 },
];
const esitoEseguiti = await caricamento(null, righeConEseguiti);
verifica('si contano dal file, senza nessuna lettura in piu' + "'", !!esitoEseguiti.avviso_eseguiti, JSON.stringify(esitoEseguiti.avviso_eseguiti));
verifica('rete e ACI restano separati', ((esitoEseguiti.avviso_eseguiti || {}).rete || {}).ordini === 2 && ((esitoEseguiti.avviso_eseguiti || {}).aci || {}).ordini === 1, JSON.stringify(esitoEseguiti.avviso_eseguiti));
verifica('coi kg della rete, interi', ((esitoEseguiti.avviso_eseguiti || {}).rete || {}).kg === 4620, JSON.stringify(esitoEseguiti.avviso_eseguiti));
verifica('e quelli ACI non si sommano alla rete', ((esitoEseguiti.avviso_eseguiti || {}).aci || {}).kg === 500, JSON.stringify(esitoEseguiti.avviso_eseguiti));
const fraseEseguiti = testoEseguiti(esitoEseguiti.avviso_eseguiti);
verifica('la frase e' + "' in parole semplici", !!fraseEseguiti && fraseEseguiti.includes("non e' stato premuto Chiudi") && fraseEseguiti.includes('non entrano in nessun conto'), fraseEseguiti);
verifica('e nomina i due canali a parte', !!fraseEseguiti && fraseEseguiti.includes('Rete: 2 ordini') && fraseEseguiti.includes('ACI: 1 ordine'), fraseEseguiti);
verifica('il registro se li segna', String(ultimoLog().messaggio || '').includes("non e' stato premuto Chiudi") && String(ultimoLog().messaggio).includes('rete 2, ACI 1'), ultimoLog().messaggio);
// Nessun conto cambia: gli "eseguito" non diventano terminati.
verifica('non si sommano ai terminati: il caricamento resta riuscito', esitoEseguiti.esito === 'successo', `${esitoEseguiti.esito} — ${ultimoLog().messaggio}`);
verifica('e restano in archivio con il loro stato', archivio('PrimariaRete').filter(r => r.stato === 'eseguito').length === 2, String(archivio('PrimariaRete').filter(r => r.stato === 'eseguito').length));
// Senza ordini "eseguito" non si dice niente.
verifica('senza "eseguito" non si inventa nessun avviso', esitoMisto.avviso_eseguiti === null && testoEseguiti(null) === null, JSON.stringify(esitoMisto.avviso_eseguiti));

// ---------------------------------------------------------------------------
console.log("(B4) L'ETICHETTA DELLE RIGHE NELLO STORICO DICE IL NUMERO GIUSTO");
// Diceva 10.817 su un file di 11.293 righe, perche' i 476 assegnati non venivano
// contati: proprio quando si vuole capire se e' entrato tutto, quel numero
// confondeva. Adesso sono tutte le righe del file entrate in archivio.

const esitoEtichetta = await caricamento(null);
const logEtichetta = ultimoLog();
verifica('le righe entrate sono tutte quelle del file', logEtichetta.righe_importate === RETE + ASSEGNATI, `${logEtichetta.righe_importate} invece di ${RETE + ASSEGNATI}`);
verifica('e il risultato a video dice lo stesso numero', esitoEtichetta.righe_lette === RETE + ASSEGNATI && esitoEtichetta.righe_importate === RETE + ASSEGNATI, `${esitoEtichetta.righe_importate} / ${esitoEtichetta.righe_lette}`);
verifica('il messaggio lo spiega', String(logEtichetta.messaggio || '').startsWith(`${RETE + ASSEGNATI} righe del file entrate in archivio`), logEtichetta.messaggio);
verifica('i quattro archivi restano contati a parte', String(logEtichetta.messaggio || '').includes(`Rete: ${RETE}`) && String(logEtichetta.messaggio).includes(`Ass. Rete: ${ASSEGNATI}`), logEtichetta.messaggio);

// ---------------------------------------------------------------------------
console.log('(A6) GLI AVVISI CHE MERITANO LA FINESTRA, NON LA RIGA PICCOLA');
// Un caricamento che ferma tutto il gestionale finche' non si ricarica si
// annunciava con otto parole in ambra sotto la scheda: la finestra non conosceva
// ne' le righe di troppo ne' l'archivio non contato.

verifica("un archivio non contato apre la finestra", !!avvisiDaMostrare({ avviso_non_verificato: { non_contato: true, archivi: ['Primarie RETE'], righe_incerte: 0 } }), 'null');
verifica('le righe di troppo la aprono', !!avvisiDaMostrare({ avviso_doppioni: { righe_in_piu: 200, ordini: 100, archivi: [] } }), 'null');
verifica('e anche le righe che mancano', !!avvisiDaMostrare({ avviso_mancanti: { righe_mancanti: 57, ordini: 57, archivi: [] } }), 'null');
// Gli ordini "eseguito" NON aprono la finestra da soli: non c'e' niente da fare
// e niente da rifare. Sui dati veri ce n'e' quasi sempre almeno uno, quindi un
// caricamento perfettamente riuscito apriva comunque "Caricamento completato con
// avvisi", e la stessa notizia usciva in tre posti. Quando la finestra si apre
// per altro, pero', si devono leggere anche loro.
const soloEseguiti = { avviso_eseguiti: { rete: { ordini: 1, kg: 3620 }, aci: { ordini: 0, kg: 0 } } };
verifica('gli ordini "eseguito" da soli NON aprono la finestra', avvisiDaMostrare(soloEseguiti) === null, JSON.stringify(avvisiDaMostrare(soloEseguiti)));
verifica("ma se la finestra si apre per altro si leggono lo stesso", (avvisiDaMostrare({ ...soloEseguiti, avviso_mancanti: { righe_mancanti: 57, ordini: 57, archivi: [] } }) || {}).avviso_eseguiti === soloEseguiti.avviso_eseguiti, 'non arrivano');
verifica('un caricamento pulito non apre niente', avvisiDaMostrare(esitoMisto) === null, JSON.stringify(avvisiDaMostrare(esitoMisto)));
verifica('e una riparazione riuscita nemmeno: non c' + "'e' niente da fare", avvisiDaMostrare({ avviso_riparazione: { righe: 57, risolto: true, archivi: [] } }) === null, 'apre la finestra');

// ---------------------------------------------------------------------------
console.log('(G1) LA LETTURA CHE RISPONDE INDIETRO: NON SI DICHIARA QUADRA SU UN NUMERO CHE CAMBIA');
// IL CASO PIU' PERICOLOSO DI TUTTI, ed e' la riparazione stessa ad aprirlo.
//
// Subito dopo una scrittura grossa l'archivio puo' rispondere con un numero
// ancora indietro. Prima quel ritardo produceva un falso allarme; da quando si
// ripara, su quel numero si CANCELLA e si RISCRIVE.
//
// Qui l'ultimo blocco delle primarie di rete (50 righe) entra davvero, ma le
// prime due letture non lo vedono: sembrano mancare 50 ordini. La riparazione
// li riscrive, e adesso in archivio ci sono per davvero 500 righe su 450, cioe'
// 50 ordini coi pesi contati doppi. La terza lettura arriva ancora indietro e
// dice "450 righe, tutto a posto".
//
// Con una lettura sola dopo la riparazione il caricamento si chiudeva
// SUCCESSO, spunta verde, "non c'e' niente da rifare", e tutti i moduli si
// ricalcolavano sopra i pesi doppi: l'incidente del 14/09/2026 da una porta
// nuova. Adesso si riconta finche' due letture di fila non dicono la stessa
// cosa, e il verdetto e' quello vero.

const senzaUltimoBlocco = fotografiaDi(400);
const tuttoAPosto = fotografiaDi(450);
const esitoLetturaIndietro = await caricamento(() => {
  const indietro = [senzaUltimoBlocco, senzaUltimoBlocco, tuttoAPosto];
  gancio = async (corpo, esegui) => {
    if (corpo.azione === 'conta_esatta' && corpo.entita === 'PrimariaRete' && indietro.length) {
      return { status: 200, data: { ...indietro.shift(), dati_intatti: true } };
    }
    return esegui();
  };
});

// Prima quella lettura in ritardo faceva scattare la riparazione, che
// riscriveva senza cancellare e fabbricava 50 ordini con le righe doppie; poi
// un'altra lettura in ritardo diceva "450, tutto a posto" e il caricamento si
// chiudeva SUCCESSO coi pesi doppi dentro.
//
// Adesso quella lettura si riconosce subito: dice meno righe di quante la
// function ha CONFERMATO di averne scritte, quindi non e' un archivio a cui
// mancano righe, e' una lettura da rifare. Si rilegge, la terza volta risponde
// giusta, e non si e' toccato niente.
verifica('in archivio restano le righe del file, una volta sola', archivio('PrimariaRete').length === RETE, `${archivio('PrimariaRete').length} righe invece di ${RETE}`);
verifica('nessun ordine coi pesi contati doppi', [...righePerOrdine('PrimariaRete').values()].every(v => v === 1), JSON.stringify([...righePerOrdine('PrimariaRete').entries()].filter(([, v]) => v !== 1).slice(0, 3)));
verifica('e nessuna riga di troppo dichiarata', esitoLetturaIndietro.avviso_doppioni === null, JSON.stringify(esitoLetturaIndietro.avviso_doppioni));
verifica('il "successo" e' + "' onesto: l'archivio torna davvero", esitoLetturaIndietro.esito === 'successo' && archivio('PrimariaRete').length === RETE, `${esitoLetturaIndietro.esito} — ${ultimoLog().messaggio || ''}`);
// Il meccanismo: sulla lettura che smentisce le scritture confermate non si
// ripara e non si dichiara niente, si rilegge.
verifica("sulla lettura in ritardo non si e' toccato niente", esitoLetturaIndietro.avviso_riparazione === null && quante('cancella_ordini PrimariaRete') === 0, `${quante('cancella_ordini PrimariaRete')} cancellazioni`);
verifica("l'archivio si rilegge finche' la lettura non sta in piedi", quante('conta_esatta PrimariaRete') === 3, `${quante('conta_esatta PrimariaRete')} conteggi`);

// La stessa cosa, ma la lettura resta indietro per sempre: allora il verdetto
// non si costruisce su di lei. L'archivio si dichiara NON CONTATO, il
// caricamento resta parziale e i ricalcoli non partono - e la riparazione, che
// toglie e riscrive, non ha comunque potuto creare nemmeno un doppione.
const esitoSempreIndietro = await caricamento(() => {
  gancio = async (corpo, esegui) => {
    if (corpo.azione === 'conta_esatta' && corpo.entita === 'PrimariaRete') {
      return { status: 200, data: { ...senzaUltimoBlocco, dati_intatti: true } };
    }
    return esegui();
  };
});
verifica('una lettura che nega le scritture confermate si dichiara inaffidabile', ((esitoSempreIndietro.avviso_non_verificato || {}).incoerenti || []).join() === 'Primarie RETE', JSON.stringify(esitoSempreIndietro.avviso_non_verificato));
verifica('il caricamento resta parziale e i ricalcoli sono fermi', esitoSempreIndietro.esito === 'parziale' && moduliDaRicalcolare(esitoSempreIndietro) === false, esitoSempreIndietro.esito);
verifica('e non si elencano ordini presi da quella lettura', esitoSempreIndietro.avviso_mancanti === null && esitoSempreIndietro.avviso_doppioni === null, JSON.stringify({ m: esitoSempreIndietro.avviso_mancanti, d: esitoSempreIndietro.avviso_doppioni }));
verifica("in archivio non e' nato nessun doppione", [...righePerOrdine('PrimariaRete').values()].every(v => v === 1) && archivio('PrimariaRete').length === RETE, `${archivio('PrimariaRete').length} righe`);
const testoSempreIndietro = testoVerificaArchivio(esitoSempreIndietro);
verifica('la scheda dice che la lettura non e' + "' affidabile", !!testoSempreIndietro && testoSempreIndietro.testo.includes("la lettura non e' affidabile"), testoSempreIndietro && testoSempreIndietro.testo);

// E il conteggio che non si ferma MAI su un numero, senza smentire nessuna
// scrittura (i due numeri stanno tutti e due sopra le righe scritte): allora
// l'archivio si dichiara non contato perche' e' instabile, che e' un'altra cosa.
const esitoMaiFermo = await caricamento(() => {
  let letture = 0;
  gancio = async (corpo, esegui) => {
    if (corpo.azione === 'conta_esatta' && corpo.entita === 'PrimariaRete') {
      letture++;
      // una lettura su due dice una cosa, l'altra un'altra: non si assesta mai
      return { status: 200, data: { ...(letture % 2 ? fotografiaDi(470) : fotografiaDi(460)), dati_intatti: true } };
    }
    return esegui();
  };
});
verifica("un conteggio che non si ferma si dichiara non contato", !!esitoMaiFermo.avviso_non_verificato && (esitoMaiFermo.avviso_non_verificato.instabili || []).join() === 'Primarie RETE', JSON.stringify(esitoMaiFermo.avviso_non_verificato));
verifica('e il caricamento resta parziale', esitoMaiFermo.esito === 'parziale' && moduliDaRicalcolare(esitoMaiFermo) === false, esitoMaiFermo.esito);
// Di un archivio non contato non si elenca niente: gli ordini verrebbero dalla
// lettura appena dichiarata inaffidabile. Prima si diceva "mancano 50 righe su
// 50 ordini, Primarie RETE: 0 righe invece delle 450" e nella riga dopo "non si
// e' riusciti a contare": tre frasi che si smentivano a vicenda.
verifica('e di quell' + "'archivio non si elencano ordini ne' righe", esitoMaiFermo.avviso_mancanti === null && esitoMaiFermo.avviso_doppioni === null, JSON.stringify({ m: esitoMaiFermo.avviso_mancanti, d: esitoMaiFermo.avviso_doppioni }));
const testoMaiFermo = testoVerificaArchivio(esitoMaiFermo);
verifica('la scheda lo dice con parole semplici', !!testoMaiFermo && testoMaiFermo.testo.includes('due numeri diversi'), testoMaiFermo && testoMaiFermo.testo);
verifica('e non dice ne' + "' quante righe mancano ne' quante ne avanzano", !!testoMaiFermo && !testoMaiFermo.testo.includes('mancano') && !testoMaiFermo.testo.includes('righe di troppo'), testoMaiFermo && testoMaiFermo.testo);

// ---------------------------------------------------------------------------
console.log('(G2) LA RIPARAZIONE CHE SI FERMA A META\': I NUMERI SONO QUELLI DI ADESSO');
// La cancellazione riesce e la riscrittura no. Prima si usciva dal ciclo SENZA
// ricontare, quindi il verdetto veniva costruito sulla verifica di prima, cioe'
// su un archivio che non esisteva piu': a video si leggevano "200 righe di
// troppo" e "i pesi vengono contati doppi", con l'elenco nominale di ordini
// appena cancellati, mentre in archivio ne mancavano duecento.
//
// Nessun verdetto si costruisce su un conteggio precedente a un'operazione che
// ha toccato i dati.

const esitoMetaStrada = await caricamento(() => {
  let rottoZero = false;
  let verificato = false;
  gancio = async (corpo, esegui) => {
    // Dopo la prima verifica dell'archivio ogni scrittura su quell'archivio e'
    // una scrittura della riparazione: qui non ne passa nessuna.
    if (corpo.azione === 'conta_esatta' && corpo.entita === 'PrimariaRete') verificato = true;
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && verificato) throw cadutaDiRete();
    // il blocco 0 entra DUE VOLTE (la piattaforma lo ripete) e la rete cade:
    // nascono 200 ordini con due righe
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && corpo.blocco === 0 && !rottoZero) {
      rottoZero = true;
      await esegui();
      await esegui();
      throw cadutaDiRete();
    }
    return esegui();
  };
});

const righeVere = archivio('PrimariaRete').length;
verifica("la riparazione ha tolto le righe e non e' riuscita a rimetterle", righeVere === 250, `${righeVere} righe`);
verifica('il gestionale dice che MANCANO delle righe', !!esitoMetaStrada.avviso_mancanti && esitoMetaStrada.avviso_mancanti.ordini === 200, JSON.stringify(esitoMetaStrada.avviso_mancanti && esitoMetaStrada.avviso_mancanti.ordini));
verifica('e NON dice che ce ne sono di troppo', esitoMetaStrada.avviso_doppioni === null, JSON.stringify(esitoMetaStrada.avviso_doppioni));
verifica('i numeri sono quelli di adesso, non quelli di prima', ((esitoMetaStrada.avviso_mancanti || {}).archivi || [{}])[0].righe === righeVere, `${((esitoMetaStrada.avviso_mancanti || {}).archivi || [{}])[0].righe} contro ${righeVere} righe vere`);
const testoMeta = testoVerificaArchivio(esitoMetaStrada);
verifica('la scheda non parla di pesi contati doppi', !!testoMeta && testoMeta.testo.includes('mancano 200 righe') && !testoMeta.testo.includes('contati doppi'), testoMeta && testoMeta.testo);
// "Non sono riuscito, ecco che cosa ho toccato": il buco l'ha fatto adesso la
// riparazione, e non si fa credere che l'archivio fosse gia' cosi'.
verifica("e dice che e' stato il gestionale a togliere quelle righe", !!testoMeta && testoMeta.testo.includes("ha tolto 200 righe e non e' riuscito a riscriverle"), testoMeta && testoMeta.testo);
// (Rev3 §5) DUECENTO, NON QUATTROCENTO. La cancellazione di righe ne ha tolte
// 400, ma 200 erano di troppo: toglierle era il rimedio, non il danno. Il buco
// vero e' di 200 righe, che sono quelle che il file porta a quegli ordini.
verifica('e ne dice il numero giusto, non quelle di troppo', (esitoMetaStrada.riparazione_tentata || [])[0].righe === 200, JSON.stringify(esitoMetaStrada.riparazione_tentata));
// Le righe che la RIPARAZIONE non e' riuscita a riscrivere si contano: il
// browser sa di non averle scritte, e prima sparivano (l'unico a potersene
// accorgere restava il conteggio, cioe' proprio cio' di cui si dubita). Si
// contano una volta sola, non una per giro.
verifica("le righe che la riparazione non ha riscritto si contano", esitoMetaStrada.righe_fallite === 200, `${esitoMetaStrada.righe_fallite} invece di 200`);
const messaggioMeta = String(ultimoLog().messaggio || '');
verifica('e il registro le scrive', messaggioMeta.includes('200 righe non scritte'), messaggioMeta);
verifica('il registro dice "mancano delle righe", non "di troppo"', messaggioMeta.includes('in archivio mancano delle righe') && !messaggioMeta.includes('righe di troppo'), messaggioMeta);
verifica('e il caricamento resta parziale', ultimoLog().esito === 'parziale', `${ultimoLog().righe_importate} — ${ultimoLog().esito}`);
// (Rev1 §2) Anche "le righe del file entrate in archivio" deve essere il numero
// di adesso: diceva 450 su un archivio che ne aveva 250, e resta nello storico.
verifica('e le righe entrate sono quelle vere', ultimoLog().righe_importate === righeVere + ASSEGNATI, `${ultimoLog().righe_importate} invece di ${righeVere + ASSEGNATI}`);

// ---------------------------------------------------------------------------
console.log('(G3) RIGHE DI TROPPO E RIGHE MANCANTI: TRE FRASI, NON UNA');
// Il registro diceva sempre "ci sono righe di troppo e righe mancanti insieme",
// perche' il browser mandava solo la somma. E' proprio il caso capitato la
// notte del 24/09 (57 righe perse e nemmeno una di troppo): per chi lavora
// "righe di troppo" vuol dire pesi contati doppi, cioe' un guasto diverso e
// piu' grave, e si andava a cercare un danno che non c'era.

// (1) Tutte e due insieme: qui la riparazione non riesce a fare niente, quindi
//     restano sia i 200 ordini doppi sia i 200 spariti.
const esitoTutteEDue = await caricamento(() => {
  let rottoZero = false;
  let verificato = false;
  gancio = async (corpo, esegui) => {
    if (corpo.azione === 'cancella_ordini') throw cadutaDiRete();
    if (corpo.azione === 'conta_esatta' && corpo.entita === 'PrimariaRete') verificato = true;
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && verificato) throw cadutaDiRete();
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && corpo.blocco === 0 && !rottoZero) {
      rottoZero = true;
      await esegui();
      await esegui();              // la piattaforma scrive il blocco due volte
      throw cadutaDiRete();
    }
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && corpo.blocco === 1) throw cadutaDiRete();
    return esegui();
  };
}, righeQuattrocento);

verifica('ci sono davvero righe di troppo e righe mancanti', !!esitoTutteEDue.avviso_doppioni && !!esitoTutteEDue.avviso_mancanti, JSON.stringify({ d: !!esitoTutteEDue.avviso_doppioni, m: !!esitoTutteEDue.avviso_mancanti }));
verifica('e allora il registro dice proprio "tutte e due insieme"', String(ultimoLog().messaggio || '').includes('ci sono righe di troppo e righe mancanti insieme'), ultimoLog().messaggio);
// Qui la riparazione non e' riuscita a toccare niente: non si vanta di aver
// rimesso a posto delle righe e non dice di aver tolto niente.
verifica('e non si inventa una riparazione che non c' + "'e' stata", esitoTutteEDue.avviso_riparazione === null && esitoTutteEDue.riparazione_tentata === null, JSON.stringify({ r: esitoTutteEDue.avviso_riparazione, t: esitoTutteEDue.riparazione_tentata }));
const testoTutteEDue = testoVerificaArchivio(esitoTutteEDue);
verifica('la scheda dice tutte e due le cose', !!testoTutteEDue && testoTutteEDue.testo.includes('righe di troppo') && testoTutteEDue.testo.includes('mancano'), testoTutteEDue && testoTutteEDue.testo);

// (2) Mancano e basta: e' la notte del 24/09. Nessuna riga di troppo, e non si
//     deve andare a cercare pesi contati doppi (registro di (G2), qui sopra).
verifica('quando mancano e basta lo dice cosi' + "'", messaggioMeta.includes('in archivio mancano delle righe, e quelle righe non entrano in nessun conto'), messaggioMeta);
// (3) Di troppo e basta: registro di (A1/B1d), gia' verificato li'. Le tre
//     frasi sono distinte e nessuna contiene l'altra.
verifica('le tre frasi sono davvero diverse', messaggioMeta.includes('mancano delle righe') && !messaggioMeta.includes('di troppo') && !String(ultimoLog().messaggio || '').includes('mancano delle righe'), `${messaggioMeta} ||| ${ultimoLog().messaggio}`);

// ---------------------------------------------------------------------------
console.log('(G4) LE CONFERME: IL GIRO COME LO GUIDA LA PAGINA');
// I due controlli anti-regressione sono in fila e possono scattare insieme: un
// tentativo morto ha svuotato un archivio E nel file nuovo qualche ordine non
// c'e' piu'. La pagina mandava una conferma sola, l'ultima: ognuna spegneva un
// controllo e riaccendeva l'altro, e il pulsante "Forza caricamento" girava in
// tondo all'infinito - proprio nel caso per cui quel pulsante esiste.
//
// Qui il giro si guida COME LO GUIDA LA PAGINA (confermeAccumulate), non
// passando l'elenco a mano: e' la differenza fra provare il prodotto e provare
// una capacita' che il prodotto non ha.

globalThis.__ARCHIVI = conOrdineFuori();
let confermeInMano = [];      // azzerate quando si sceglie un file nuovo, come nella pagina
let daMandare = false;        // il primo tentativo non manda niente
let uscita = null;
const giriFatti = [];
for (let giro = 0; giro < 6 && !uscita; giro++) {
  const r = await preparazione(daMandare === false ? {} : { conferma_forzatura: daMandare });
  giriFatti.push(`${r.status}${r.body.conferma ? ' ' + r.body.conferma : ''}`);
  if (r.status !== 409) { uscita = r; break; }
  // e' esattamente quello che fa il pulsante "Forza caricamento"
  confermeInMano = confermeAccumulate(confermeInMano, r.body.conferma);
  daMandare = confermeInMano;
}
verifica('premendo "Forza caricamento" si arriva a caricare', !!uscita && uscita.status === 200 && uscita.body.preparato === true, giriFatti.join(' -> '));
verifica('e ci si arriva in tre tentativi, non all' + "'infinito", giriFatti.length === 3, giriFatti.join(' -> '));
verifica('le conferme si accumulano, non si sostituiscono', confermeInMano.length === 2 && confermeInMano.includes('ordini_mancanti') && confermeInMano.includes('archivio_rimpicciolito'), JSON.stringify(confermeInMano));
// Un file nuovo riparte da zero: una conferma data ieri non vale per il file di domani.
verifica('un file nuovo riparte senza conferme', JSON.stringify(confermeAccumulate([], 'ordini_mancanti')) === JSON.stringify(['ordini_mancanti']));
// I percorsi con un controllo solo continuano a mandare il vecchio "true".
verifica('dove il controllo e' + "' uno solo vale ancora il vecchio si'", JSON.stringify(confermeAccumulate(undefined, undefined)) === JSON.stringify([true]));

// ---------------------------------------------------------------------------
console.log('(G5) LA CANCELLAZIONE A LOTTI: QUATTRO RICHIESTE, NON DUECENTO');
// Una richiesta per ordine voleva dire duecento richieste dentro una sola
// invocazione, contro un limite di circa settanta al minuto PER TUTTA L'APP: si
// finiva in 429, l'invocazione sfondava i dodici secondi e la riparazione si
// fermava proprio a meta', cioe' dopo aver cancellato e prima di riscrivere.

globalThis.__ARCHIVI = { PrimariaRete: [] };
globalThis.__CANCELLAZIONI = 0;
globalThis.__NO_IN = false;
const duecentoOrdini = Array.from({ length: 200 }, (_, i) => `ORD-${String(i + 1).padStart(5, '0')}`);
globalThis.__ARCHIVI.PrimariaRete = duecentoOrdini.map((id, i) => ({ id: 'z' + i, id_ordine: id }));
const cancellati = await funzione({ azione: 'cancella_ordini', tipo_file: 'primarie', entita: 'PrimariaRete', nome: 'Primarie RETE', ordini: duecentoOrdini });
verifica('duecento ordini si cancellano tutti', cancellati.status === 200 && cancellati.body.cancellati === 200 && cancellati.body.finito === true, JSON.stringify(cancellati.body));
verifica('e le righe spariscono davvero', archivio('PrimariaRete').length === 0, String(archivio('PrimariaRete').length));
verifica('a lotti da cinquanta: quattro richieste, non duecento', globalThis.__CANCELLAZIONI === 4, `${globalThis.__CANCELLAZIONI} richieste al database`);

// Se la piattaforma non accettasse il filtro a lotti: fino a cinquanta ordini si
// ripiega su uno per volta, oltre NON si ripara e lo si dice.
globalThis.__NO_IN = true;
globalThis.__CANCELLAZIONI = 0;
globalThis.__ARCHIVI.PrimariaRete = duecentoOrdini.slice(0, 40).map((id, i) => ({ id: 'y' + i, id_ordine: id }));
const ripiego = await funzione({ azione: 'cancella_ordini', tipo_file: 'primarie', entita: 'PrimariaRete', nome: 'Primarie RETE', ordini: duecentoOrdini.slice(0, 40) });
verifica('senza il filtro a lotti, pochi ordini si tolgono lo stesso', ripiego.body.cancellati === 40 && ripiego.body.a_uno_per_volta === true, JSON.stringify(ripiego.body));
verifica('una richiesta per ordine', globalThis.__CANCELLAZIONI === 40, `${globalThis.__CANCELLAZIONI} richieste al database`);

globalThis.__CANCELLAZIONI = 0;
globalThis.__ARCHIVI.PrimariaRete = duecentoOrdini.map((id, i) => ({ id: 'w' + i, id_ordine: id }));
const troppi = await funzione({ azione: 'cancella_ordini', tipo_file: 'primarie', entita: 'PrimariaRete', nome: 'Primarie RETE', ordini: duecentoOrdini });
verifica('duecento invece non si toccano affatto', troppi.body.non_fatta === true, JSON.stringify(troppi.body));
verifica('e nessuna riga viene tolta a meta' + "'", archivio('PrimariaRete').length === 200 && globalThis.__CANCELLAZIONI === 0, `${archivio('PrimariaRete').length} righe, ${globalThis.__CANCELLAZIONI} richieste`);
// "DATI INTATTI" SOLO SE NON SI E' TENTATO NIENTE: qui una cancellazione e'
// PARTITA - e' stata rifiutata, ma e' partita - quindi non si dichiara che i
// dati sono intatti e chi chiama riconta. Costa una lettura e non fa mai dire
// il falso: un deleteMany rifiutato e un deleteMany eseguito che non risponde
// si assomigliano troppo per distinguerli da qui.
verifica("e non si dichiara che i dati sono intatti dopo averci provato", troppi.body.dati_intatti === false, JSON.stringify(troppi.body));
// E il motivo vero viaggia insieme: e' la frase che poi si legge a video.
verifica('il motivo dice che cosa e' + "' successo", String(troppi.body.motivo || '').includes("la cancellazione a lotti non e' stata accettata"), JSON.stringify(troppi.body.motivo));
globalThis.__NO_IN = false;

// ---------------------------------------------------------------------------
console.log('(G6) DENTRO LA RIPARAZIONE I RITENTATIVI FUNZIONANO');
// Il conteggio con cui si decide se un blocco ritentato era passato partiva da
// zero. Va bene sul percorso normale, dove l'archivio e' stato appena svuotato;
// dentro la riparazione l'archivio e' PIENO, nessuna delle due ipotesi tornava,
// si rispondeva sempre "non si sa" e il blocco restava in sospeso al primo
// colpo di rete. E' l'incidente del 24/09 in scala: 50 righe perse su 450.

const esitoRitentativoInRiparazione = await caricamento(() => {
  let verificato = false;
  let scrittureRiparazione = 0;
  gancio = async (corpo, esegui) => {
    if (corpo.azione === 'conta_esatta' && corpo.entita === 'PrimariaRete') verificato = true;
    // il blocco 2 (le ultime 50 righe) non arriva mai: 50 ordini spariti
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && corpo.blocco === 2 && !verificato) throw cadutaDiRete();
    // Le prime due scritture della riparazione NON entrano: cade la rete. Il
    // ritentativo deve chiedere all'archivio quante righe ha e capire che quel
    // blocco non e' passato, per riscriverlo subito. Col conteggio che riparte
    // da zero l'archivio pieno non corrispondeva a nessuna delle due ipotesi,
    // si rispondeva sempre "non si sa", il blocco restava in sospeso e il giro
    // finiva li': un tentativo per giro invece di cinque, e le 50 righe non
    // entravano piu'.
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && verificato) {
      scrittureRiparazione++;
      if (scrittureRiparazione <= 2) throw cadutaDiRete();
    }
    return esegui();
  };
});

verifica('le 50 righe perse tornano, una volta sola', archivio('PrimariaRete').length === RETE, `${archivio('PrimariaRete').length} righe`);
verifica('nessun ordine con due righe', [...righePerOrdine('PrimariaRete').values()].every(v => v === 1), JSON.stringify([...righePerOrdine('PrimariaRete').entries()].filter(([, v]) => v !== 1).slice(0, 3)));
verifica('il caricamento si chiude riuscito', esitoRitentativoInRiparazione.esito === 'successo', `${esitoRitentativoInRiparazione.esito} — ${ultimoLog().messaggio || ''}`);
verifica('e nessuna riga resta in sospeso', esitoRitentativoInRiparazione.avviso_non_verificato === null, JSON.stringify(esitoRitentativoInRiparazione.avviso_non_verificato));

// ---------------------------------------------------------------------------
console.log('(G7) I RICALCOLI DI RECUPERO: SOLO A CHI PUO' + "' CARICARE, E UNA VOLTA SOLA");
// Rileggono archivi interi e ci SCRIVONO, e nessuna di quelle funzioni guarda il
// livello: la pagina dei caricamenti si apre a tutti, quindi bastava che un
// collega in sola consultazione la aprisse per far riscrivere riepilogo della
// qualifica, verifiche, ritiri ed evasione degli assegnati.

const tuttiIPermessi = () => true;
verifica('chi puo' + "' caricare li recupera", recuperiDaFare(['primarie', 'secondarie'], { puoFare: tuttiIPermessi }).join() === 'primarie,secondarie');
verifica('chi consulta e basta non fa partire niente', recuperiDaFare(['primarie', 'secondarie'], { puoFare: () => false }).length === 0);
verifica('e senza sapere chi e' + "', non si fa niente", recuperiDaFare(['primarie'], {}).length === 0 && recuperiDaFare(['primarie']).length === 0);
verifica('chi puo' + "' caricare solo le secondarie recupera solo quelle", recuperiDaFare(['primarie', 'secondarie'], { puoFare: (t) => t === 'secondarie' }).join() === 'secondarie');
const gia = new Set(['primarie']);
verifica('e un recupero gia' + "' tentato non si ripete a ogni apertura", recuperiDaFare(['primarie', 'secondarie'], { puoFare: tuttiIPermessi, giaTentati: gia }).join() === 'secondarie');

// ---------------------------------------------------------------------------
console.log('(G8) LE FRASI NON DICONO PIU' + "' DI QUELLO CHE IL CODICE FA");

// (1) Il percorso che NON e' quello delle primarie: le frasi che parlano di
//     riparazione e di ricalcoli li' non hanno senso, ed e' verificato nella
//     prova (A2/A4/d) qui sopra, sullo stesso esito.

// (2) La riga sotto la scheda avvisa della finestra che si trovera' chi
//     ricarica: prima diceva "Ricarica lo stesso file" e chi obbediva si
//     trovava davanti "Caricamento bloccato: rischio perdita dati" senza
//     nessun preavviso.
//     La conferma NON e' automatica: scatta solo se in archivio restano meno
//     ordini di quanti ce n'erano quando il caricamento e' partito. Qui e'
//     cosi': si parte da 480 ordini e se ne perdono 200.
const esitoConConferma = await caricamento(() => {
  globalThis.__ARCHIVI = {
    UploadLog: [logAperto(1, TUTTI, 'Prova')],
    PrimariaRete: ids.slice(0, RETE).map((id, i) => ({ id: 'q' + i, id_ordine: id })),
    Assegnato: ids.slice(RETE).map((id, i) => ({ id: 'qa' + i, id_ordine: id })),
  };
  let rottoZero = false;
  let verificato = false;
  gancio = async (corpo, esegui) => {
    if (corpo.azione === 'conta_esatta' && corpo.entita === 'PrimariaRete') verificato = true;
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && verificato) throw cadutaDiRete();
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && corpo.blocco === 0 && !rottoZero) {
      rottoZero = true;
      await esegui();
      await esegui();              // la piattaforma scrive il blocco due volte
      throw cadutaDiRete();
    }
    return esegui();
  };
});
const testoConConferma = testoVerificaArchivio(esitoConConferma);
verifica("in archivio restano meno ordini di quanti ce n'erano", esitoConConferma.conferma_al_prossimo === true, String(esitoConConferma.conferma_al_prossimo));
verifica('e la riga sotto la scheda avvisa della finestra', !!testoConConferma && testoConConferma.testo.includes('chiede una conferma'), testoConConferma && testoConConferma.testo);
// (Rev3 §4) Il registro la promette solo quando sara' vera, e dice i numeri.
verifica('il registro la promette e dice i numeri', String(ultimoLog().messaggio || '').includes("verra' chiesta una conferma") && String(ultimoLog().messaggio || '').includes('dei 480 di prima'), ultimoLog().messaggio);
// E dove non sara' chiesta non si promette: il caricamento di (G2) parte da un
// archivio vuoto, quindi al prossimo giro non c'e' niente da confermare.
verifica('dove non sara' + "' chiesta non si promette", esitoMetaStrada.conferma_al_prossimo === false && !messaggioMeta.includes('verra' + "' chiesta una conferma"), `${esitoMetaStrada.conferma_al_prossimo} — ${messaggioMeta}`);
verifica('e nemmeno la riga sotto la scheda', !!testoMeta && !testoMeta.testo.includes('chiede una conferma'), testoMeta && testoMeta.testo);

// (3) Il titolo della finestra: chi deve solo aspettare il turno non legge
//     "rischio perdita dati".
globalThis.__ARCHIVI = { UploadLog: [logAperto(1, TUTTI, 'Mario Rossi')], ...restano(30) };
const collegaAlLavoro = await preparazione();
const finestraCollega = { type: 'error', status: 409, error: collegaAlLavoro.body.error, caricamento_in_corso: collegaAlLavoro.body.caricamento_in_corso };
verifica('a chi aspetta il turno si dice che un altro sta caricando', titoloAvviso(finestraCollega) === 'Aspetta: un altro caricamento in corso', titoloAvviso(finestraCollega));
verifica('e la finestra non e' + "' rossa", avvisoRosso(finestraCollega) === false);
verifica('chi invece rischia davvero legge il titolo rosso', titoloAvviso({ type: 'error', status: 409, richiede_conferma: true }) === 'Caricamento bloccato: rischio perdita dati' && avvisoRosso({ type: 'error', status: 409 }) === true);
verifica('e un caricamento con avvisi resta un avviso', titoloAvviso({ type: 'warning' }) === 'Caricamento completato con avvisi' && avvisoRosso({ type: 'warning' }) === false);
// Ma un caricamento con righe di troppo NON e' "completato": il titolo diceva
// il contrario del riquadro rosso che stava due righe sotto, ed e' la prima
// cosa che si legge.
const finestraDoppioni = { type: 'warning', avviso_doppioni: { righe_in_piu: 50, ordini: 50, archivi: [] } };
verifica("con righe di troppo il titolo non dice 'completato'", titoloAvviso(finestraDoppioni) === "Caricamento da rifare: l'archivio non torna con il file", titoloAvviso(finestraDoppioni));
verifica('e la finestra e' + "' rossa", avvisoRosso(finestraDoppioni) === true);
verifica('lo stesso per le righe che mancano', titoloAvviso({ type: 'warning', avviso_mancanti: { righe_mancanti: 57, ordini: 57, archivi: [] } }) === "Caricamento da rifare: l'archivio non torna con il file");
// L'archivio che non si e' potuto contare NON si racconta come "non torna con
// il file": il gestionale ha appena detto di non sapere com'e' messo, e nelle
// prove dei revisori l'archivio era a posto. Il titolo e' la prima riga che si
// legge e deve dire la stessa cosa della riga sotto.
const finestraNonContato = { type: 'warning', avviso_non_verificato: { non_contato: true, archivi: ['Primarie RETE'] } };
verifica("l'archivio non contato non si dichiara sbagliato", titoloAvviso(finestraNonContato) === "Caricamento da rifare: l'archivio non si e' potuto verificare", titoloAvviso(finestraNonContato));
verifica('e resta ambra, perche' + "' non si sa", avvisoRosso(finestraNonContato) === false);
// Sul percorso che non e' quello delle primarie righe di troppo e mancanti non
// si sanno per ordine: l'unico segnale e' il totale che non torna, e il titolo
// non lo guardava. Duecento righe perse su 450 aprivano "Caricamento completato".
const finestraDisallineata = { type: 'warning', avviso_disallineamento: { archivio: 250, file: 450 } };
verifica("un totale che non torna non e' un caricamento completato", titoloAvviso(finestraDisallineata) === "Caricamento da rifare: l'archivio non torna con il file", titoloAvviso(finestraDisallineata));
verifica('e la finestra e' + "' rossa anche li'", avvisoRosso(finestraDisallineata) === true);
verifica('gli ordini "eseguito" da soli non cambiano il titolo', titoloAvviso({ type: 'warning', avviso_eseguiti: { rete: { ordini: 1 }, aci: { ordini: 0 } } }) === 'Caricamento completato con avvisi');

// (4) Gli ordini "eseguito": rete e ACI non si sommano nemmeno in testa alla
//     frase. Prima si apriva con "3 ordini hanno tutti i dati" e solo dopo si
//     elencavano i canali: e' proprio la somma che qui non si fa mai.
verifica('la frase degli "eseguito" non somma rete e ACI', !!fraseEseguiti && !fraseEseguiti.includes('3 ordini'), fraseEseguiti);

// ---------------------------------------------------------------------------
console.log("(G9) LA CANCELLAZIONE CHE RIESCE A META' E NON RISPONDE");
// cancella_ordini toglie un lotto per volta DENTRO LA STESSA INVOCAZIONE. Se il
// primo lotto passa e il secondo cade - la rete, i dodici secondi, il database -
// prima l'invocazione rispondeva 500 senza dire quanti ne aveva tolti, il
// browser leggeva "non ho toccato niente" e usciva dal ciclo SENZA RICONTARE:
// il verdetto tornava ai numeri di prima, cioe' cento ordini spariti e a video
// scritto che erano "di troppo", coi nomi di ordini che non esistevano piu'.
//
// Adesso quanti ne ha tolti si dice sempre, anche quando finisce male, e chi
// chiama considera l'archivio toccato e riconta.

globalThis.__ARCHIVI = { PrimariaRete: duecentoOrdini.map((id, i) => ({ id: 'k' + i, id_ordine: id })) };
globalThis.__CANCELLAZIONI = 0;
globalThis.__NO_IN = false;
globalThis.__LIMITE_RICHIESTE = false;
globalThis.__CADE_DOPO = 2;                    // due lotti passano, il terzo cade
const aMeta = await funzione({ azione: 'cancella_ordini', tipo_file: 'primarie', entita: 'PrimariaRete', nome: 'Primarie RETE', ordini: duecentoOrdini });
globalThis.__CADE_DOPO = null;
verifica('dice quanti ne ha tolti anche quando si interrompe', aMeta.status === 200 && aMeta.body.cancellati === 100, JSON.stringify(aMeta.body).slice(0, 140));
verifica('e dice che non ha finito', aMeta.body.finito === false && !!aMeta.body.interrotto, JSON.stringify(aMeta.body).slice(0, 140));
verifica("e non si dichiara a dati intatti dopo aver cancellato", aMeta.body.dati_intatti === false, JSON.stringify(aMeta.body).slice(0, 140));
verifica('le righe tolte sono proprio cento', archivio('PrimariaRete').length === 100, `${archivio('PrimariaRete').length} righe`);

// Lo stesso guasto dentro un caricamento vero: il verdetto deve essere quello
// di DOPO la cancellazione.
const esitoCancellazioneAMeta = await caricamento(() => {
  globalThis.__CADE_DOPO = 2;
  let rottoZero = false;
  gancio = async (corpo, esegui) => {
    // il blocco 0 entra DUE VOLTE (la piattaforma lo ripete) e la rete cade:
    // nascono 200 ordini con due righe
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && corpo.blocco === 0 && !rottoZero) {
      rottoZero = true;
      await esegui();
      await esegui();
      globalThis.__CADE_DOPO = 2;
      throw cadutaDiRete();
    }
    // il blocco 1 non arriva mai: 200 ordini spariti
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && corpo.blocco === 1) throw cadutaDiRete();
    return esegui();
  };
}, righeQuattrocento);
globalThis.__CADE_DOPO = null;

const righeDopoMeta = archivio('PrimariaRete').length;
const ordiniTolti = righeQuattrocento.filter(r => !archivio('PrimariaRete').some(x => x.id_ordine === r.ID)).map(r => r.ID);
verifica("la riparazione ha tolto cento ordini e non e' riuscita a riscriverli", ordiniTolti.length === 300, `${ordiniTolti.length} ordini fuori dall'archivio`);
verifica('il gestionale dice le righe che ci sono ADESSO', (((esitoCancellazioneAMeta.avviso_mancanti || {}).archivi || [])[0] || {}).righe === righeDopoMeta, `${(((esitoCancellazioneAMeta.avviso_mancanti || {}).archivi || [])[0] || {}).righe} contro ${righeDopoMeta} righe vere`);
verifica('e conta fra i mancanti anche quelli che ha tolto lui', (esitoCancellazioneAMeta.avviso_mancanti || {}).ordini === 300, JSON.stringify((esitoCancellazioneAMeta.avviso_mancanti || {}).ordini));
verifica("e dice che a togliere quelle righe e' stato lui", (esitoCancellazioneAMeta.riparazione_tentata || []).map(x => x.nome).join() === 'Primarie RETE', JSON.stringify(esitoCancellazioneAMeta.riparazione_tentata));
const testoAMeta = testoVerificaArchivio(esitoCancellazioneAMeta);
// (Rev3 §5) E DICE QUANTE. Degli ordini mancanti sono 300, ma il gestionale ne
// ha tolti cento: gli altri duecento non sono mai entrati (il blocco 1 non e'
// mai arrivato). La frase intera si prendeva tutto il buco.
verifica('la scheda lo dice con parole semplici', !!testoAMeta && testoAMeta.testo.includes("ha tolto 100 righe e non e' riuscito a riscriverle"), testoAMeta && testoAMeta.testo.slice(0, 200));
verifica('e non si prende anche le righe mai entrate', (esitoCancellazioneAMeta.riparazione_tentata || [])[0].righe === 100, JSON.stringify(esitoCancellazioneAMeta.riparazione_tentata));
verifica('il caricamento resta parziale e i ricalcoli sono fermi', esitoCancellazioneAMeta.esito === 'parziale' && moduliDaRicalcolare(esitoCancellazioneAMeta) === false, esitoCancellazioneAMeta.esito);
verifica('e lo storico non scrive piu' + "' righe di quante ne siano entrate", ultimoLog().righe_importate <= righeDopoMeta + ASSEGNATI, `${ultimoLog().righe_importate} su ${righeDopoMeta + ASSEGNATI}`);

// E il caso peggiore: LA CANCELLAZIONE ARRIVA A DESTINAZIONE MA LA RISPOSTA SI
// PERDE. Per il browser e' un errore di rete e basta: se si dichiarasse "non ho
// toccato niente" uscirebbe dal ciclo senza ricontare, e a chi lavora direbbe
// "200 righe di troppo, i pesi si contano doppi" con i nomi di ordini che la
// riparazione ha appena cancellato, mentre in archivio non c'e' piu' niente.
// Una richiesta PARTITA e' gia' "toccato".
const esitoRispostaPersa = await caricamento(() => {
  let rottoZero = false;
  gancio = async (corpo, esegui) => {
    // la cancellazione arriva e fa il suo lavoro, ma la risposta non torna
    if (corpo.azione === 'cancella_ordini') { await esegui(); throw cadutaDiRete(); }
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && corpo.blocco === 0 && !rottoZero) {
      rottoZero = true;
      await esegui();
      await esegui();              // la piattaforma scrive il blocco due volte
      throw cadutaDiRete();
    }
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && corpo.blocco === 1) throw cadutaDiRete();
    return esegui();
  };
}, righeQuattrocento);

const righeRimaste = archivio('PrimariaRete').length;
verifica('la cancellazione e' + "' arrivata davvero", righeRimaste === 0, `${righeRimaste} righe rimaste`);
verifica('e il gestionale racconta le righe di ADESSO', (((esitoRispostaPersa.avviso_mancanti || {}).archivi || [])[0] || {}).righe === righeRimaste, `${(((esitoRispostaPersa.avviso_mancanti || {}).archivi || [])[0] || {}).righe} contro ${righeRimaste}`);
verifica('dice che mancano tutte', (esitoRispostaPersa.avviso_mancanti || {}).ordini === QUATTROCENTO, JSON.stringify((esitoRispostaPersa.avviso_mancanti || {}).ordini));
verifica('e NON dice piu' + "' che ci sono righe di troppo", esitoRispostaPersa.avviso_doppioni === null, JSON.stringify(esitoRispostaPersa.avviso_doppioni));
verifica("e dice che la cancellazione e' partita senza risposta", (esitoRispostaPersa.riparazione_incerta || []).join() === 'Primarie RETE', JSON.stringify(esitoRispostaPersa.riparazione_incerta));
// L'archivio e' rimasto vuoto e il gestionale lo dice: nessuna riga entrata,
// esito "errore", e la riga del registro resta aperta col "non riuscito".
verifica('il caricamento non si chiude riuscito', esitoRispostaPersa.esito === 'errore' && moduliDaRicalcolare(esitoRispostaPersa) === false, esitoRispostaPersa.esito);
verifica('e lo storico non dice righe entrate che non ci sono', ultimoLog().righe_importate === 0, `${ultimoLog().righe_importate} invece di 0`);

// E quando l'archivio non si riesce piu' a contare DOPO una riparazione
// riuscita, lo storico non deve dimenticare le righe rimesse a posto: la
// colonna "Righe entrate" diceva 400 su un archivio che ne aveva 450 giuste, e
// resta bassa per sempre. Si conta quello che si sa per certo: le righe che la
// function ha confermato, ordine per ordine, mai piu' di quante ne ha il file.
const esitoRiparatoNonContato = await caricamento(() => {
  let letture = 0;
  let verificato = false;
  gancio = async (corpo, esegui) => {
    if (corpo.azione === 'conta_esatta' && corpo.entita === 'PrimariaRete') {
      letture++;
      verificato = true;
      // la prima lettura vede i 50 ordini mancanti, poi il conteggio non
      // risponde piu'
      if (letture > 2) throw cadutaDiRete();
      return esegui();
    }
    // il blocco 2 (le ultime 50 righe) non arriva mai
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && corpo.blocco === 2 && !verificato) throw cadutaDiRete();
    return esegui();
  };
});
verifica('la riparazione ha rimesso le righe', archivio('PrimariaRete').length === RETE, `${archivio('PrimariaRete').length} righe`);
verifica("l'archivio pero' non si e' potuto contare", ((esitoRiparatoNonContato.avviso_non_verificato || {}).archivi || []).join() === 'Primarie RETE', JSON.stringify(esitoRiparatoNonContato.avviso_non_verificato));
verifica('e lo storico conta anche le righe rimesse a posto', ultimoLog().righe_importate === RETE + ASSEGNATI, `${ultimoLog().righe_importate} invece di ${RETE + ASSEGNATI}`);

// ---------------------------------------------------------------------------
console.log("(G10) IL 429 NON E' UN RIFIUTO DEL FILTRO A LOTTI");
// Qualunque errore diverso da una caduta di rete faceva scattare il ripiego a
// un ordine per volta. Ma "Rate limit exceeded" non e' un filtro rifiutato: e'
// l'app al limite delle settanta richieste al minuto, e la riparazione ne
// sparava altre cinquanta proprio in quel momento. Si ripropone a chi chiama.

globalThis.__ARCHIVI = { PrimariaRete: duecentoOrdini.slice(0, 40).map((id, i) => ({ id: 'j' + i, id_ordine: id })) };
globalThis.__CANCELLAZIONI = 0;
globalThis.__TENTATIVI_A_LOTTI = 0;
globalThis.__LIMITE_RICHIESTE = true;
const col429 = await funzione({ azione: 'cancella_ordini', tipo_file: 'primarie', entita: 'PrimariaRete', nome: 'Primarie RETE', ordini: duecentoOrdini.slice(0, 40) });
globalThis.__LIMITE_RICHIESTE = false;
verifica('col limite di richieste NON si ripiega a un ordine per volta', globalThis.__CANCELLAZIONI === 0, `${globalThis.__CANCELLAZIONI} richieste una per ordine`);
verifica('la richiesta a lotti si ripete da sola e poi si arrende', globalThis.__TENTATIVI_A_LOTTI === 6, `${globalThis.__TENTATIVI_A_LOTTI} tentativi`);
verifica('e la risposta dice che non si e' + "' toccato niente", col429.status === 500 && col429.body.dati_intatti === true, JSON.stringify(col429.body).slice(0, 140));
verifica('le righe sono ancora tutte li' + "'", archivio('PrimariaRete').length === 40, `${archivio('PrimariaRete').length} righe`);
// Il filtro rifiutato davvero, invece, il ripiego lo fa ancora (prova (G5)).
globalThis.__NO_IN = true;
globalThis.__CANCELLAZIONI = 0;
await funzione({ azione: 'cancella_ordini', tipo_file: 'primarie', entita: 'PrimariaRete', nome: 'Primarie RETE', ordini: duecentoOrdini.slice(0, 40) });
globalThis.__NO_IN = false;
verifica('il filtro rifiutato davvero fa ancora il ripiego', globalThis.__CANCELLAZIONI === 40, `${globalThis.__CANCELLAZIONI} richieste`);

// ---------------------------------------------------------------------------
console.log('(G11) LA QUALIFICA RINVIATA NON SI RICHIAMA ALL' + "'INFINITO");
// Con un caricamento aperto o parziale la qualifica calcola e NON salva. Il
// riepilogo salvato resta vecchio, quindi "e' piu' vecchio dell'ultimo
// caricamento" resta vero per sempre: Fatturazione Passiva rifaceva il calcolo
// completo - primarie, secondarie ed extra raccolta piu' quattro letture - a
// OGNI apertura, all'infinito, proprio quando l'app e' gia' affaticata.

verifica('se il riepilogo e' + "' vecchio si rifa'", qualificaDaRifare(2026, { aggiornatoIl: 100, ultimoCaricamento: 200 }) === true);
verifica("se e' gia' aggiornato non si tocca", qualificaDaRifare(2026, { aggiornatoIl: 300, ultimoCaricamento: 200 }) === false);
segnaQualificaRinviata(2026, { ultimoCaricamento: 200, avviso: 'Qualifica non aggiornata: caricamento in corso.' });
verifica('dopo un "rinviato" non si insiste piu' + "'", qualificaDaRifare(2026, { aggiornatoIl: 100, ultimoCaricamento: 200 }) === false);
verifica('ma un caricamento nuovo fa ridare una possibilita' + "'", qualificaDaRifare(2026, { aggiornatoIl: 100, ultimoCaricamento: 999 }) === true);
verifica("e l'anno dopo non c'entra niente", qualificaDaRifare(2027, { aggiornatoIl: 100, ultimoCaricamento: 200 }) === true);
// E LA FRASE RESTA. Con un semplice segno, alla seconda apertura della scheda
// il segno c'era e l'avviso no: la scheda usciva muta e i numeri vecchi
// tornavano a sembrare freschi. Bastava cambiare pagina e tornare indietro.
verifica('la frase del rinvio si puo' + "' rimostrare alla riapertura", avvisoQualificaRinviata(2026, { ultimoCaricamento: 200 }) === 'Qualifica non aggiornata: caricamento in corso.', String(avvisoQualificaRinviata(2026, { ultimoCaricamento: 200 })));
verifica('e dopo un caricamento nuovo non c' + "'e' nessuna frase vecchia da mostrare", avvisoQualificaRinviata(2026, { ultimoCaricamento: 999 }) === null, String(avvisoQualificaRinviata(2026, { ultimoCaricamento: 999 })));

// ---------------------------------------------------------------------------
console.log('(G12) UN CARICAMENTO PARZIALE DICE QUALI MODULI RESTANO INDIETRO');
// Una secondaria chiusa "parziale" - basta una riga non entrata - fermava
// verifiche dei report, quadrature FIR, qualifica fornitori e piano delle
// secondarie, e non lo diceva a nessuno: nessuna riga, nessuna finestra, e
// nessun recupero. L'unico segno era la spunta ambra coi numeri.

const fermiSecondarie = ricalcoliFermi('secondarie', { esito: 'parziale', righe_importate: 1200, righe_fallite: 40 });
verifica('si dice per nome quali moduli restano indietro', (fermiSecondarie || []).length === 2 && fermiSecondarie.every(x => x.ok === false), JSON.stringify(fermiSecondarie));
const testoFermi = testoRicalcoli(fermiSecondarie);
verifica('e la riga sotto la scheda lo scrive', !!testoFermi && testoFermi.testo.includes('Non aggiornati') && testoFermi.testo.includes('qualifica fornitori'), testoFermi && testoFermi.testo);
verifica('col motivo, una volta sola', !!testoFermi && testoFermi.testo.includes("il caricamento non e' riuscito del tutto"), testoFermi && testoFermi.testo);
verifica('su un caricamento riuscito non si dice niente', ricalcoliFermi('secondarie', { esito: 'successo' }) === null);
verifica('e dove non ci sono moduli collegati nemmeno', ricalcoliFermi('ordini_non_dichiarati', { esito: 'parziale' }) === null);
verifica('per le primarie sono quattro', (ricalcoliFermi('primarie', { esito: 'parziale' }) || []).length === 4);

// ---------------------------------------------------------------------------
console.log('(G13) LE FRASI SCRITTE PER LA FINESTRA ARRIVANO ALLA FINESTRA');
// La finestra aveva una frase - "il gestionale ha gia' provato a rimetterle a
// posto da solo senza riuscirci" - che guardava un campo che non le arrivava
// mai: codice morto, una correzione che non poteva uscire ne' quando sarebbe
// stata giusta ne' quando sarebbe stata sbagliata. Stessa cosa per "ha tolto le
// righe sbagliate e non e' riuscito a riscriverle".

const conRiparazione = avvisiDaMostrare({
  avviso_mancanti: { righe_mancanti: 50, ordini: 50, archivi: [] },
  avviso_riparazione: { righe: 50, risolto: false, archivi: [{ nome: 'Primarie RETE', riscritte: 0, tolte: 50, risolto: false, contato: true }] },
  riparazione_tentata: ['Primarie RETE'],
  riparazione_incerta: ['Primarie ACI'],
});
verifica('la finestra riceve la riparazione', !!conRiparazione && !!conRiparazione.avviso_riparazione, JSON.stringify(conRiparazione && Object.keys(conRiparazione)));
verifica('e riceve anche "ha tolto e non e' + "' riuscito a riscrivere\"", (conRiparazione.riparazione_tentata || []).join() === 'Primarie RETE' && (conRiparazione.riparazione_incerta || []).join() === 'Primarie ACI', JSON.stringify(conRiparazione.riparazione_tentata));
// Ma da soli non aprono niente: una riparazione riuscita non ha niente da far
// fare a nessuno.
verifica('da soli non aprono la finestra', avvisiDaMostrare({ avviso_riparazione: { righe: 57, risolto: true, archivi: [] }, riparazione_tentata: ['Primarie RETE'] }) === null, 'apre la finestra');
// E LA FRASE CHE NON POTEVA USCIRE MAI e' stata tolta, non solo alimentata: il
// riquadro del totale che non torna si disegna solo quando NON ci sono ne'
// ordini di troppo ne' mancanti, e sulle primarie un totale sbagliato li porta
// sempre con se'; sull'altro percorso la riparazione non esiste. Quella frase
// non poteva comparire ne' quando sarebbe stata giusta ne' quando sarebbe stata
// sbagliata. Qui si guarda il file, perche' e' l'unico modo di accorgersi se
// torna.
const finestraJsx = readFileSync(qui('../src/components/shared/UploadResultDialog.jsx'), 'utf8');
verifica('la frase irraggiungibile non e' + "' tornata nella finestra", !finestraJsx.includes('ha gi\u00e0 provato a rimetterle a posto da solo senza riuscirci'), 'la frase e\' ancora li\'');
verifica('e il riquadro dice la cosa che serve: ricarica lo stesso file', finestraJsx.includes('Ricarica lo stesso file, senza rifiltrarlo.'), 'manca la frase buona');

// ---------------------------------------------------------------------------
console.log('(G14) "HA PROVATO" E "NON HA PROVATO" NON SI DICONO INSIEME');
// Erano due campi indipendenti stampati uno dietro l'altro: sullo stesso
// archivio si leggeva "ha provato a rimettere a posto delle righe (Primarie
// RETE: 200 riscritte)" e subito dopo "NON HA PROVATO a rimettere a posto
// l'archivio Primarie RETE".

const dueFrasi = testoVerificaArchivio({
  tipo_file: 'primarie',
  avviso_riparazione: { righe: 200, risolto: false, archivi: [{ nome: 'Primarie RETE', riscritte: 200, tolte: 0, risolto: false, contato: true }] },
  riparazione_non_fatta: [{ nome: 'Primarie RETE', motivo: "la cancellazione a lotti non e' stata accettata" }],
});
// E la frase unita non si contraddice a sua volta: "ma non ha potuto togliere
// quelle di troppo" scritto subito dopo "50 di troppo tolte" erano di nuovo due
// frasi opposte sullo stesso archivio. Si dice solo che non e' arrivato in fondo.
verifica('una frase sola, e dice tutte e due le cose', !!dueFrasi && dueFrasi.testo.includes("ma non e' arrivato in fondo"), dueFrasi && dueFrasi.testo);
const toltoEBasta = testoVerificaArchivio({
  tipo_file: 'primarie',
  avviso_riparazione: { righe: 50, risolto: false, archivi: [{ nome: 'Primarie RETE', riscritte: 0, tolte: 50, risolto: false, contato: true }] },
  riparazione_non_fatta: [{ nome: 'Primarie RETE', motivo: "la cancellazione a lotti non e' stata accettata" }],
});
verifica('e non dice "non ha potuto togliere" dopo aver detto quante ne ha tolte', !!toltoEBasta && toltoEBasta.testo.includes('50 di troppo tolte') && !toltoEBasta.testo.includes('non ha potuto togliere'), toltoEBasta && toltoEBasta.testo);
verifica('e non si dice anche "non ha provato" sullo stesso archivio', !!dueFrasi && !dueFrasi.testo.includes('non ha provato a rimettere a posto'), dueFrasi && dueFrasi.testo);
// Su un archivio diverso invece si dice, perche' li' e' vero.
const dueArchivi = testoVerificaArchivio({
  tipo_file: 'primarie',
  avviso_riparazione: { righe: 200, risolto: false, archivi: [{ nome: 'Primarie RETE', riscritte: 200, tolte: 0, risolto: false, contato: true }] },
  riparazione_non_fatta: [{ nome: 'Primarie ACI', motivo: 'troppi ordini' }],
});
verifica("su un altro archivio 'non ha provato' si dice ancora", !!dueArchivi && dueArchivi.testo.includes("non ha provato a rimettere a posto l'archivio Primarie ACI"), dueArchivi && dueArchivi.testo);

// E il caso vero da cui nasceva la contraddizione: la piattaforma rifiuta il
// filtro a lotti e gli ordini sono troppi per toglierli uno per uno. Prima il
// passo "aggiungi" aveva gia' riscritto duecento righe, quindi si leggeva "ha
// provato (200 riscritte)" e subito dopo "NON HA PROVATO", sullo stesso
// archivio. Adesso non si riscrive niente senza aver prima tolto: non si e'
// toccato nulla, e si dice quella cosa sola.
const esitoNonFatta = await caricamento(() => {
  globalThis.__NO_IN = true;
  let rottoZero = false;
  gancio = async (corpo, esegui) => {
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && corpo.blocco === 0 && !rottoZero) {
      rottoZero = true;
      await esegui();
      await esegui();              // la piattaforma scrive il blocco due volte
      throw cadutaDiRete();
    }
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && corpo.blocco === 1) throw cadutaDiRete();
    return esegui();
  };
}, righeQuattrocento);
globalThis.__NO_IN = false;
verifica("quando non si puo' cancellare non si riscrive niente", esitoNonFatta.avviso_riparazione === null && globalThis.__CANCELLAZIONI === 0, JSON.stringify({ r: esitoNonFatta.avviso_riparazione, c: globalThis.__CANCELLAZIONI }));
verifica("e l'archivio resta come lo si e' trovato", archivio('PrimariaRete').length === 400 && [...righePerOrdine('PrimariaRete').values()].filter(v => v === 2).length === 200, `${archivio('PrimariaRete').length} righe`);
verifica('si dice che non ci ha provato, e perche' + "'", (esitoNonFatta.riparazione_non_fatta || []).length === 1 && esitoNonFatta.riparazione_non_fatta[0].nome === 'Primarie RETE', JSON.stringify(esitoNonFatta.riparazione_non_fatta));
const testoNonFatta = testoVerificaArchivio(esitoNonFatta);
// UNA FRASE SOLA, E DICE IL VERO. La richiesta di cancellazione e' PARTITA e la
// piattaforma non ha detto di non averla eseguita (dati_intatti false): "non ha
// provato" sarebbe una bugia, e le due frasi non si dicono mai insieme.
verifica("si dice che ci ha provato e non e' arrivato in fondo", !!testoNonFatta && testoNonFatta.testo.includes("ma non e' arrivato in fondo") && !testoNonFatta.testo.includes('non ha provato a rimettere a posto'), testoNonFatta && testoNonFatta.testo.slice(0, 260));
// E senza parentesi vuote: di righe rimesse a posto non ce n'e' nessuna, quindi
// si scrive il nome dell'archivio e basta. "Primarie RETE: " non si legge.
verifica('e senza parentesi vuote', !!testoNonFatta && !testoNonFatta.testo.includes('(Primarie RETE: )'), testoNonFatta && testoNonFatta.testo.slice(0, 260));
// "NON HA PROVATO" RESTA DOVE E' VERO: quando la piattaforma risponde che non ha
// tentato niente (dati intatti), il gestionale non ha toccato quell'archivio.
const nonToccatoDavvero = testoVerificaArchivio({
  tipo_file: 'primarie',
  riparazione_non_fatta: [{ nome: 'Primarie RETE', motivo: "la cancellazione e' stata respinta per il limite di richieste", toccato: false }],
});
verifica("'non ha provato' resta dove il gestionale non ha toccato niente", !!nonToccatoDavvero && nonToccatoDavvero.testo.includes("non ha provato a rimettere a posto l'archivio Primarie RETE"), nonToccatoDavvero && nonToccatoDavvero.testo);
// E di un archivio che non si e' potuto contare non si afferma che "non torna
// ancora con il file": e' una cosa che il gestionale non sa.
const riparatoNonContato = testoVerificaArchivio({
  tipo_file: 'primarie',
  avviso_riparazione: { righe: 50, risolto: false, archivi: [{ nome: 'Primarie RETE', riscritte: 50, tolte: 0, risolto: false, contato: false }] },
  avviso_non_verificato: { non_contato: true, archivi: ['Primarie RETE'], instabili: ['Primarie RETE'], incoerenti: [], righe_incerte: 0 },
});
verifica("di un archivio non contato non si dice che non torna", !!riparatoNonContato && riparatoNonContato.testo.includes("non si e' potuto contare") && !riparatoNonContato.testo.includes('non torna ancora'), riparatoNonContato && riparatoNonContato.testo);
// E un archivio che non si e' fermato su un numero non si nomina dentro "non si
// e' riusciti a contare": ha risposto, e la sua frase dice un'altra cosa. La
// riga sotto la scheda lo faceva, la finestra no, e dello stesso archivio si
// leggevano due notizie diverse una sotto l'altra.
verifica("chi non si e' fermato su un numero non finisce fra i non contati", archiviSenzaConteggio({ archivi: ['Primarie RETE', 'Primarie ACI'], instabili: ['Primarie RETE'], incoerenti: [] }).join() === 'Primarie ACI');
verifica('e nemmeno chi ha smentito le scritture confermate', archiviSenzaConteggio({ archivi: ['Primarie RETE', 'Assegnati RETE'], instabili: [], incoerenti: ['Assegnati RETE'] }).join() === 'Primarie RETE');
verifica('chi non ha proprio risposto invece si nomina', archiviSenzaConteggio({ archivi: ['Primarie ACI'], instabili: [], incoerenti: [] }).join() === 'Primarie ACI' && archiviSenzaConteggio(null).length === 0);

// ---------------------------------------------------------------------------
console.log('(G15) IL "QUADRA" PRIMA DELLA RIPARAZIONE NON E' + "' UNA LETTURA SOLA");
// IL BUCO CHE RESTAVA APERTO. Il principio scritto in testa al file - "il quadra
// dopo una riparazione non e' una lettura sola" - valeva solo DOPO. Il primo
// verdetto, quello che decide se la riparazione parte, era una lettura sola: se
// rispondeva "450 su 450" mentre in archivio ce n'erano 650, il ciclo della
// riparazione non girava nemmeno e il caricamento si chiudeva SUCCESSO con
// duecento ordini dai pesi doppi dentro e tutti e cinque i ricalcoli sopra.

const perfetta450 = fotografiaDi(RETE);
const esitoLetturaSolaBugiarda = await caricamento(() => {
  let rottoZero = false;
  let prima = true;
  gancio = async (corpo, esegui) => {
    // il blocco 0 entra DUE VOLTE: 200 ordini con due righe
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && corpo.blocco === 0 && !rottoZero) {
      rottoZero = true;
      await esegui();
      await esegui();
      throw cadutaDiRete();
    }
    // e la PRIMA lettura risponde che e' tutto a posto: 450 su 450
    if (corpo.azione === 'conta_esatta' && corpo.entita === 'PrimariaRete' && prima) {
      prima = false;
      return { status: 200, data: { ...perfetta450, dati_intatti: true } };
    }
    return esegui();
  };
});
verifica('la lettura bugiarda non chiude il caricamento', quante('conta_esatta PrimariaRete') > 1, `${quante('conta_esatta PrimariaRete')} letture`);
verifica('i doppioni si vedono e si rimettono a posto', archivio('PrimariaRete').length === RETE && [...righePerOrdine('PrimariaRete').values()].every(v => v === 1), `${archivio('PrimariaRete').length} righe`);
verifica('e il "successo" e' + "' onesto", esitoLetturaSolaBugiarda.esito === 'successo' && esitoLetturaSolaBugiarda.avviso_doppioni === null, `${esitoLetturaSolaBugiarda.esito}`);
verifica('la riparazione c' + "'e' stata davvero", !!esitoLetturaSolaBugiarda.avviso_riparazione && esitoLetturaSolaBugiarda.avviso_riparazione.risolto === true, JSON.stringify(esitoLetturaSolaBugiarda.avviso_riparazione));
// Un caricamento pulito non paga niente: la lettura in piu' la fanno solo gli
// archivi in cui qualcosa e' andato storto.
verifica('su un caricamento pulito resta una lettura sola per archivio', quante('conta_esatta PrimariaAci') <= 1, `${quante('conta_esatta PrimariaAci')} letture ACI`);

// E L'ULTIMA SCRITTURA CIECA: un blocco NON si riscrive su un conteggio solo.
// Il blocco entra, la rete cade, il conteggio e' ancora indietro di sei secondi
// - il guasto che il commento in testa al file descrive - e quel numero indietro
// diventava il permesso di riscrivere: duecento righe entrate due volte.
const esitoUnaLetturaIndietro = await caricamento(() => {
  let rottoZero = false;
  numeroDiPrima = 0;
  contaVecchia = 0;
  gancio = async (corpo, esegui) => {
    if (corpo.azione === 'conta' && contaVecchia > 0) {
      contaVecchia--;
      return { status: 200, data: { conteggio: numeroDiPrima, contato: true } };
    }
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && corpo.blocco === 0 && !rottoZero) {
      rottoZero = true;
      await esegui();              // il blocco entra davvero...
      numeroDiPrima = 0;           // ...e UNA lettura risponde ancora zero
      contaVecchia = 1;
      throw cadutaDiRete();
    }
    return esegui();
  };
});
verifica('il blocco non si riscrive sulla lettura indietro', quante('cancella_ordini PrimariaRete') > 0 || quante('scrivi PrimariaRete #0') === 1, `${quante('scrivi PrimariaRete #0')} scritture, ${quante('cancella_ordini PrimariaRete')} cancellazioni`);
verifica('e in archivio non nasce nessun doppione', archivio('PrimariaRete').length === RETE && [...righePerOrdine('PrimariaRete').values()].every(v => v === 1), `${archivio('PrimariaRete').length} righe`);
verifica('il caricamento si chiude riuscito lo stesso', esitoUnaLetturaIndietro.esito === 'successo', esitoUnaLetturaIndietro.esito);

// E QUI STA LA CORREZIONE DI QUESTO GIRO. Il giro scorso la risposta era stata
// "leggiamo due volte": ma due letture in ritardo di fila sono esattamente cio'
// che fa una piattaforma indietro di qualche secondo, e il palo si era solo
// spostato di uno. Con SEI letture indietro di fila il caricamento si chiudeva
// "successo" con duecento ordini dai pesi doppi dentro e tutti i ricalcoli
// sopra. Adesso il blocco non si riscrive mai: le letture in ritardo possono
// essere quante si vuole, il doppione non nasce nemmeno.
const esitoLettureIndietro = await caricamento(() => {
  let rottoZero = false;
  numeroDiPrima = 0;
  contaVecchia = 0;
  gancio = async (corpo, esegui) => {
    if (corpo.azione === 'conta' && contaVecchia > 0) {
      contaVecchia--;
      return { status: 200, data: { conteggio: numeroDiPrima, contato: true } };
    }
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && corpo.blocco === 0 && !rottoZero) {
      rottoZero = true;
      await esegui();              // il blocco entra davvero...
      numeroDiPrima = 0;           // ...e SEI letture di fila rispondono zero
      contaVecchia = 6;
      throw cadutaDiRete();
    }
    return esegui();
  };
});
// Il blocco non si riscrive: se una seconda scrittura c'e', e' la riparazione,
// che PRIMA ha tolto le righe di quegli ordini (e allora non puo' duplicare).
verifica('sei letture indietro di fila non fanno riscrivere il blocco alla cieca', quante('scrivi PrimariaRete #0') === 1 || quante('cancella_ordini PrimariaRete') > 0, `${quante('scrivi PrimariaRete #0')} scritture, ${quante('cancella_ordini PrimariaRete')} cancellazioni`);
verifica("in archivio non nasce nessun doppione", archivio('PrimariaRete').length === RETE && [...righePerOrdine('PrimariaRete').values()].every(v => v === 1), `${archivio('PrimariaRete').length} righe`);
verifica('e nessun ordine ha i pesi contati doppi', esitoLettureIndietro.avviso_doppioni === null, JSON.stringify(esitoLettureIndietro.avviso_doppioni));
verifica('il caricamento si chiude riuscito', esitoLettureIndietro.esito === 'successo', `${esitoLettureIndietro.esito} — ${ultimoLog().messaggio || ''}`);

// E LA LETTURA FINALE IN RITARDO, DUE VOLTE DI FILA, SU UN ARCHIVIO CHE HA PIU'
// RIGHE DEL FILE. E' il controesempio del revisore: la piattaforma scrive il
// blocco due volte (200 ordini con due righe) e poi le due conta_esatta
// rispondono con la fotografia di prima, quella pulita. Il verdetto non puo'
// venire da li': l'archivio ha 650 righe e il file ne porta 450.
const pulita450 = fotografiaDi(RETE);
const esitoDueLettureFinaliIndietro = await caricamento(() => {
  let rottoZero = false;
  let indietro = 2;
  gancio = async (corpo, esegui) => {
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && corpo.blocco === 0 && !rottoZero) {
      rottoZero = true;
      await esegui();
      await esegui();            // la piattaforma scrive il blocco due volte
      throw cadutaDiRete();
    }
    if (corpo.azione === 'conta_esatta' && corpo.entita === 'PrimariaRete' && indietro > 0) {
      indietro--;
      return { status: 200, data: { ...pulita450, dati_intatti: true } };
    }
    return esegui();
  };
});
verifica('le due letture in ritardo non chiudono il caricamento', quante('conta_esatta PrimariaRete') > 2, `${quante('conta_esatta PrimariaRete')} letture`);
verifica("l'archivio torna con il file", archivio('PrimariaRete').length === RETE && [...righePerOrdine('PrimariaRete').values()].every(v => v === 1), `${archivio('PrimariaRete').length} righe`);
verifica('e i doppioni li ha tolti la riparazione', (esitoDueLettureFinaliIndietro.avviso_riparazione || {}).risolto === true, JSON.stringify(esitoDueLettureFinaliIndietro.avviso_riparazione));
verifica('nessun "successo" sopra i pesi doppi', esitoDueLettureFinaliIndietro.esito === 'successo' && esitoDueLettureFinaliIndietro.avviso_doppioni === null, `${esitoDueLettureFinaliIndietro.esito} — ${ultimoLog().messaggio || ''}`);

// ---------------------------------------------------------------------------
console.log('(G16) "DATI INTATTI" SI DICE SOLO SE NON SI E' + "' TENTATO NIENTE");
// cancella_ordini dichiarava "dati intatti" quando il SUO contatore era a zero,
// non quando il database era intatto. Ma un deleteMany che va in timeout puo'
// essere stato eseguito lo stesso - e' proprio il caso che riconosce
// eInterruzione - e il contatore si alza solo DOPO il ritorno. Il browser ci
// credeva, usciva senza ricontare, e cinquanta ordini del file cancellati
// adesso si leggevano a video come righe "di troppo", coi loro nomi.

globalThis.__ARCHIVI = { PrimariaRete: duecentoOrdini.slice(0, 100).map((id, i) => ({ id: 'v' + i, id_ordine: id })) };
globalThis.__CANCELLAZIONI = 0;
globalThis.__NO_IN = false;
globalThis.__LIMITE_RICHIESTE = false;
globalThis.__CADE_DOPO_AVER_TOLTO = 0;      // il primo lotto arriva, la risposta no
const toltaESpenta = await funzione({ azione: 'cancella_ordini', tipo_file: 'primarie', entita: 'PrimariaRete', nome: 'Primarie RETE', ordini: duecentoOrdini.slice(0, 100) });
globalThis.__CADE_DOPO_AVER_TOLTO = null;
verifica('le righe sono sparite davvero', archivio('PrimariaRete').length === 50, `${archivio('PrimariaRete').length} righe invece di 50`);
verifica("e la function NON dichiara i dati intatti", toltaESpenta.body.dati_intatti === false, JSON.stringify(toltaESpenta.body).slice(0, 160));
verifica('non si ripropone l' + "'errore: si risponde dicendo che non si sa", toltaESpenta.status === 200 && !!toltaESpenta.body.interrotto && toltaESpenta.body.finito === false, JSON.stringify(toltaESpenta.body).slice(0, 160));

// E il browser non crede a un "dati intatti" che arriva insieme a
// "ritentabile": ritentabile vuol dire interruzione, cioe' una richiesta
// partita che il database puo' aver eseguito lo stesso.
const esitoIntattiBugiardi = await caricamento(() => {
  let rottoZero = false;
  gancio = async (corpo, esegui) => {
    // la cancellazione arriva a destinazione, e la risposta dice "non ho toccato niente"
    if (corpo.azione === 'cancella_ordini') {
      await esegui();
      throw Object.assign(new Error('socket hang up'), {
        status: 500, data: { error: 'socket hang up', fase: 'cancellazione', dati_intatti: true, ritentabile: true },
      });
    }
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && corpo.blocco === 0 && !rottoZero) {
      rottoZero = true;
      await esegui();
      await esegui();              // 200 ordini con due righe
      throw cadutaDiRete();
    }
    return esegui();
  };
});
const righeDopoIntatti = archivio('PrimariaRete').length;
verifica("la cancellazione e' arrivata: quelle righe non ci sono piu'", righeDopoIntatti === RETE - 200, `${righeDopoIntatti} righe`);
verifica('il gestionale NON dice piu' + "' che ci sono righe di troppo", esitoIntattiBugiardi.avviso_doppioni === null, JSON.stringify(esitoIntattiBugiardi.avviso_doppioni));
verifica('dice che mancano, e i numeri sono quelli di adesso', !!esitoIntattiBugiardi.avviso_mancanti && ((esitoIntattiBugiardi.avviso_mancanti.archivi || [])[0] || {}).righe === righeDopoIntatti, JSON.stringify((esitoIntattiBugiardi.avviso_mancanti || {}).archivi));
verifica("e dice che a chiedere di togliere quelle righe e' stato lui", (esitoIntattiBugiardi.riparazione_incerta || []).join() === 'Primarie RETE', JSON.stringify(esitoIntattiBugiardi.riparazione_incerta));

// ---------------------------------------------------------------------------
console.log('(G17) NON SI DICE "HO TOLTO DELLE RIGHE" SE NON SE N' + "'E' TOLTA NESSUNA");
// IL CASO PIU' COMUNE DI TUTTI: le righe che non sono MAI entrate, cioe'
// esattamente le 57 righe perse la notte del 24/09. La riparazione chiede di
// togliere le righe di quegli ordini - che in archivio ne hanno ZERO - e poi
// non riesce a riscriverle. Si leggeva "ha tolto le righe sbagliate" e "quel
// buco l'ha fatto adesso il gestionale, non il file": falso, e manda a cercare
// un guasto del gestionale dove c'e' un guasto di rete, facendo perdere la sola
// notizia utile, cioe' che quelle righe non sono mai entrate.

const esitoMaiEntrate = await caricamento(() => {
  let verificato = false;
  gancio = async (corpo, esegui) => {
    if (corpo.azione === 'conta_esatta' && corpo.entita === 'PrimariaRete') verificato = true;
    // dopo la verifica nessuna scrittura passa piu': la riparazione non riscrive
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && verificato) throw cadutaDiRete();
    // il blocco 2 (le ultime 50 righe) non arriva mai
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && corpo.blocco === 2) throw cadutaDiRete();
    return esegui();
  };
});
const testoMaiEntrate = testoVerificaArchivio(esitoMaiEntrate);
verifica('le righe mancano davvero', archivio('PrimariaRete').length === RETE - 50 && (esitoMaiEntrate.avviso_mancanti || {}).righe_mancanti === 50, `${archivio('PrimariaRete').length} righe`);
verifica("la cancellazione a vuoto e' partita", quante('cancella_ordini PrimariaRete') > 0, '0 cancellazioni');
verifica('ma non si dice di aver tolto niente', esitoMaiEntrate.riparazione_tentata === null, JSON.stringify(esitoMaiEntrate.riparazione_tentata));
verifica('e la scheda non parla di righe sbagliate tolte', !!testoMaiEntrate && !testoMaiEntrate.testo.includes('ha tolto le righe sbagliate'), testoMaiEntrate && testoMaiEntrate.testo.slice(0, 200));
verifica('nemmeno il registro lo scrive', !String(ultimoLog().messaggio || '').includes('righe tolte dalla riparazione'), ultimoLog().messaggio);
verifica("e la notizia vera c'e': in archivio mancano delle righe", !!testoMaiEntrate && testoMaiEntrate.testo.includes('mancano 50 righe'), testoMaiEntrate && testoMaiEntrate.testo.slice(0, 200));
// Il confronto: quando le righe c'erano davvero, la stessa frase e' vera e si
// dice (e' il caso di (G2), dove riparazione_tentata vale "Primarie RETE").

// ---------------------------------------------------------------------------
console.log('(G18) SE LA CANCELLAZIONE NON PARTE, SI DICE E SI RITENTA');
// La riparazione si arrendeva in silenzio: nessun motivo a video, niente nel
// registro, e nessun secondo tentativo. Proprio la distinzione che questo
// gestionale si e' dato per iscritto - "ci ho provato e non e' bastato" contro
// "non ci ho nemmeno provato" - cadeva nel caso in cui serve.

const esitoRespinta = await caricamento(() => {
  globalThis.__LIMITE_RICHIESTE = true;   // la cancellazione a lotti viene respinta
  gancio = async (corpo, esegui) => {
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && corpo.blocco === 2) throw cadutaDiRete();
    return esegui();
  };
});
globalThis.__LIMITE_RICHIESTE = false;
// I giri della riparazione SONO i ritentativi, da quando un blocco non si
// riscrive piu' alla cieca: ognuno comincia togliendo le righe di quegli
// ordini, quindi ritentare non puo' duplicare niente (GIRI_RIPARAZIONE).
verifica('la riparazione ci ha provato piu' + "' di una volta", quante('cancella_ordini PrimariaRete') === GIRI_RIPARAZIONE_ATTESI, `${quante('cancella_ordini PrimariaRete')} tentativi`);
verifica('e si dice perche' + "' non e' riuscita", (esitoRespinta.riparazione_non_fatta || []).length === 1 && String(esitoRespinta.riparazione_non_fatta[0].motivo).includes('limite di richieste'), JSON.stringify(esitoRespinta.riparazione_non_fatta));
const testoRespinta = testoVerificaArchivio(esitoRespinta);
verifica('la scheda lo scrive con parole semplici', !!testoRespinta && testoRespinta.testo.includes('non ha provato a rimettere a posto') && testoRespinta.testo.includes('riprova fra un minuto'), testoRespinta && testoRespinta.testo.slice(0, 260));
verifica('e non si inventa di aver tolto delle righe', esitoRespinta.riparazione_tentata === null && esitoRespinta.riparazione_incerta === null, JSON.stringify({ t: esitoRespinta.riparazione_tentata, i: esitoRespinta.riparazione_incerta }));
verifica('il caricamento resta parziale e i ricalcoli sono fermi', esitoRespinta.esito === 'parziale' && moduliDaRicalcolare(esitoRespinta) === false, esitoRespinta.esito);

// E se la cancellazione non parte, le righe di quegli ordini sono ancora dove
// erano: non si azzera quello che il gestionale sapeva di aver scritto. Le
// righe si "dimenticano" PRIMA di chiedere la cancellazione, perche' stanno per
// sparire; se poi non sparisce niente vanno rimesse, altrimenti la colonna
// "Righe entrate" dello storico resta bassa per un buco che non c'e' stato.
const esitoRespintaNonContato = await caricamento(() => {
  globalThis.__LIMITE_RICHIESTE = true;
  gancio = async (corpo, esegui) => {
    // la lettura nega cinquanta righe che la function ha CONFERMATO di aver
    // scritto: l'archivio si dichiara non contato e i conti li tiene il browser
    if (corpo.azione === 'conta_esatta' && corpo.entita === 'PrimariaRete') {
      return { status: 200, data: { ...fotografiaDi(RETE - 50), dati_intatti: true } };
    }
    return esegui();
  };
});
globalThis.__LIMITE_RICHIESTE = false;
verifica("l'archivio si dichiara non contato per la lettura inaffidabile", ((esitoRespintaNonContato.avviso_non_verificato || {}).incoerenti || []).join() === 'Primarie RETE', JSON.stringify(esitoRespintaNonContato.avviso_non_verificato));
verifica('e lo storico non toglie righe che nessuno ha tolto', ultimoLog().righe_importate === RETE + ASSEGNATI, `${ultimoLog().righe_importate} invece di ${RETE + ASSEGNATI}`);

// ---------------------------------------------------------------------------
console.log('(G19) I NUMERI NON CONTANO DUE VOLTE LE STESSE RIGHE');
// "100 righe non scritte" dove ne mancavano 50, e nella stessa riga di registro
// "430 righe entrate su 480": 430 + 100 = 530, un numero che non esiste e che
// resta scritto nello storico per sempre. Le righe che la riparazione non ha
// riscritto sono LE STESSE della prima scrittura, riprovate.

const righeMancantiVere = 50;
verifica('le righe che mancano si contano una volta sola', esitoMaiEntrate.righe_fallite === righeMancantiVere, `${esitoMaiEntrate.righe_fallite} invece di ${righeMancantiVere}`);
const logMaiEntrate = ultimoLog();
verifica('e nello storico i conti tornano', (logMaiEntrate.righe_importate || 0) + (logMaiEntrate.righe_fallite || 0) === RETE + ASSEGNATI, `${logMaiEntrate.righe_importate} + ${logMaiEntrate.righe_fallite} invece di ${RETE + ASSEGNATI}`);

// E "N righe rimesse a posto" conta le righe DISTINTE, non una volta per ogni
// giro della riparazione: gli ordini toccati erano cinquanta e lo storico ne
// scriveva cento.
const esitoDueGiri = await caricamento(() => {
  let verificato = false;
  gancio = async (corpo, esegui) => {
    // la lettura resta indietro di 50 righe per sempre: la riparazione rifa'
    // due volte gli stessi cinquanta ordini
    if (corpo.azione === 'conta_esatta' && corpo.entita === 'PrimariaRete') {
      verificato = true;
      return { status: 200, data: { ...fotografiaDi(RETE - 50), dati_intatti: true } };
    }
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && corpo.blocco === 2 && !verificato) throw cadutaDiRete();
    return esegui();
  };
});
verifica('la riparazione ha fatto piu' + "' giri sugli stessi ordini", quante('cancella_ordini PrimariaRete') === GIRI_RIPARAZIONE_ATTESI, `${quante('cancella_ordini PrimariaRete')} cancellazioni`);
verifica('ma le righe rimesse a posto si contano una volta sola', (esitoDueGiri.avviso_riparazione || {}).riscritte === 50, JSON.stringify(esitoDueGiri.avviso_riparazione));
// Qui l'archivio, per il gestionale, NON torna col file (la lettura resta
// indietro per sempre): "rimesse a posto" sarebbe una bugia, e il numero deve
// restare uno solo lo stesso.
verifica('e il registro scrive lo stesso numero', String(ultimoLog().messaggio || '').includes('ha provato a rimettere a posto 50 righe di Primarie RETE'), ultimoLog().messaggio);
verifica("e non dice che le ha rimesse a posto, perche' l'archivio non torna", !String(ultimoLog().messaggio || '').includes('rimesse a posto da sole'), ultimoLog().messaggio);

// ---------------------------------------------------------------------------
console.log('(G20) IL REGISTRO CONSERVA CHE LE RIGHE LE HA TOLTE IL GESTIONALE');
// La notizia "quel buco l'ha fatto il gestionale adesso" viveva SOLO sullo
// schermo di chi aveva caricato, e spariva alla chiusura della scheda. Chi
// guarda lo storico domani leggeva "in archivio mancano delle righe" e andava a
// cercare un guasto del file.

verifica('il registro dice che le righe le ha tolte la riparazione', messaggioMeta.includes('righe tolte dalla riparazione e non rimesse: Primarie RETE'), messaggioMeta);
// (Rev3 §5) E QUANTE: duecento righe del file, non le quattrocento che la
// cancellazione ha tolto (meta' erano di troppo) e non tutto il buco.
verifica('e dice di chi e' + "' il buco, col numero", messaggioMeta.includes('Primarie RETE 200: quelle le ha tolte il gestionale, non il file'), messaggioMeta);
// E quando la cancellazione e' partita senza risposta lo scrive in un altro modo.
const esitoRegistroIncerto = await caricamento(() => {
  let rottoZero = false;
  gancio = async (corpo, esegui) => {
    if (corpo.azione === 'cancella_ordini') { await esegui(); throw cadutaDiRete(); }
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && corpo.blocco === 0 && !rottoZero) {
      rottoZero = true;
      await esegui();
      await esegui();
      throw cadutaDiRete();
    }
    return esegui();
  };
});
verifica('la cancellazione senza risposta resta scritta nello storico', String(ultimoLog().messaggio || '').includes('senza sapere come sia andata'), ultimoLog().messaggio);
verifica('e a video si dice la stessa cosa', (esitoRegistroIncerto.riparazione_incerta || []).join() === 'Primarie RETE', JSON.stringify(esitoRegistroIncerto.riparazione_incerta));

// ---------------------------------------------------------------------------
console.log('(G21) DOPO AVER CANCELLATO NON SI RILEGGE PER DECIDERE');
// IL DIFETTO CHE QUESTO GIRO E' ANDATO A TOGLIERE. La function, dopo il primo
// lotto di cancellazioni, rileggeva quegli ordini e - su QUELLA SOLA LETTURA,
// presa a zero secondi da una scrittura grossa - decideva che il filtro a lotti
// era stato ignorato: rispondeva "non ho tolto niente" e si fermava. Con una
// lettura in ritardo buttava via cinquanta ordini del file scrivendo a video il
// contrario esatto di quello che era successo, e nemmeno lo storico conservava
// chi avesse fatto il buco. Era l'unico punto di tutto il caricamento in cui un
// verdetto nasceva da una lettura sola presa subito dopo aver toccato i dati.

const esitoLetturaIndietroDopoCancellazione = await caricamento(() => {
  globalThis.__FILTRO_INDIETRO = true;    // dopo ogni cancellazione la lettura risponde indietro
  let rottoZero = false;
  gancio = async (corpo, esegui) => {
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && corpo.blocco === 0 && !rottoZero) {
      rottoZero = true;
      await esegui();
      await esegui();                     // 200 ordini con due righe
      throw cadutaDiRete();
    }
    return esegui();
  };
});
globalThis.__FILTRO_INDIETRO = false;
verifica("la lettura in ritardo non ferma la riparazione", archivio('PrimariaRete').length === RETE, `${archivio('PrimariaRete').length} righe invece di ${RETE}`);
verifica('e non sparisce nessun ordine del file', [...righePerOrdine('PrimariaRete').values()].every(v => v === 1) && distinti('PrimariaRete') === RETE, `${distinti('PrimariaRete')} ordini`);
verifica('il caricamento si chiude riuscito', esitoLetturaIndietroDopoCancellazione.esito === 'successo', `${esitoLetturaIndietroDopoCancellazione.esito} — ${ultimoLog().messaggio || ''}`);
verifica('e nessuno racconta di non aver tolto niente', esitoLetturaIndietroDopoCancellazione.riparazione_non_fatta === null, JSON.stringify(esitoLetturaIndietroDopoCancellazione.riparazione_non_fatta));

// E SE IL FILTRO FOSSE DAVVERO IGNORATO (la piattaforma accetta $in dentro
// deleteMany e non toglie niente): non e' mai successo, ma se succedesse il
// posto dove si vede e' il confronto ordine per ordine del giro DOPO. La
// riparazione se ne accorge perche' le righe di troppo AUMENTANO, si ferma e lo
// dice: non si moltiplicano a ogni giro e il caricamento resta parziale.
const esitoFiltroIgnorato = await caricamento(() => {
  globalThis.__IN_IGNORATO = true;
  let rottoZero = false;
  gancio = async (corpo, esegui) => {
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && corpo.blocco === 0 && !rottoZero) {
      rottoZero = true;
      await esegui();
      await esegui();                     // 200 ordini con due righe
      throw cadutaDiRete();
    }
    return esegui();
  };
});
globalThis.__IN_IGNORATO = false;
verifica('la riparazione si ferma al primo giro, appena vede che peggiora', quante('cancella_ordini PrimariaRete') === 1, `${quante('cancella_ordini PrimariaRete')} cancellazioni`);
verifica('e le righe di troppo non si moltiplicano a ogni giro', [...righePerOrdine('PrimariaRete').values()].every(v => v <= 3), JSON.stringify([...righePerOrdine('PrimariaRete').entries()].filter(([, v]) => v > 3).slice(0, 3)));
// E il motivo dice che cosa e' successo DAVVERO: la cancellazione ha dichiarato
// di togliere delle righe e quelle righe sono ancora li'. Prima diceva "ha
// chiesto di togliere le righe di troppo e dopo ce n'erano di piu' di prima",
// che si legge uguale anche quando di troppo non ce n'era nessuna e a
// moltiplicarle era stata la piattaforma riscrivendo due volte.
verifica('e lo dice invece di insistere', (esitoFiltroIgnorato.riparazione_non_fatta || []).length === 1 && String(esitoFiltroIgnorato.riparazione_non_fatta[0].motivo).includes("la cancellazione non le sta togliendo"), JSON.stringify(esitoFiltroIgnorato.riparazione_non_fatta));
verifica('e dice quante righe aveva chiesto di togliere', String((esitoFiltroIgnorato.riparazione_non_fatta || [{}])[0].motivo || '').includes('ha chiesto di togliere 400 righe'), JSON.stringify(esitoFiltroIgnorato.riparazione_non_fatta));
verifica('le righe di troppo si dicono per nome', !!esitoFiltroIgnorato.avviso_doppioni && esitoFiltroIgnorato.avviso_doppioni.ordini === 200, JSON.stringify((esitoFiltroIgnorato.avviso_doppioni || {}).ordini));
verifica('il caricamento non si chiude riuscito', esitoFiltroIgnorato.esito === 'parziale' && moduliDaRicalcolare(esitoFiltroIgnorato) === false, esitoFiltroIgnorato.esito);

// E il secondo tentativo di bulkCreate dentro la function: rispondeva "scritte:
// tutte" anche al secondo giro, quindi un primo tentativo entrato A META'
// faceva entrare il blocco due volte e il browser leggeva un successo pulito.
globalThis.__ARCHIVI = { PrimariaRete: [] };
globalThis.__BULK = 0;
globalThis.__BULK_A_META = true;
const bloccoAMeta = await funzione({
  azione: 'scrivi', tipo_file: 'primarie', entita: 'PrimariaRete', blocco: 0,
  righe: righeFile.slice(0, 200),
});
globalThis.__BULK_A_META = false;
verifica('il blocco si tenta una volta sola', globalThis.__BULK === 1, `${globalThis.__BULK} tentativi`);
verifica('in archivio restano le sole righe entrate a meta' + "'", archivio('PrimariaRete').length === 100, `${archivio('PrimariaRete').length} righe`);
verifica('e la function non racconta un successo pulito', bloccoAMeta.body.scritte === 0 && bloccoAMeta.body.fallite === 200 && bloccoAMeta.body.ritentabile === true, JSON.stringify(bloccoAMeta.body).slice(0, 160));

// ---------------------------------------------------------------------------
console.log('(G22) LE FRASI CHE DICEVANO IL FALSO');
// Quattro frasi trovate una per una dal revisore, con la riga e il file. Tutte
// e quattro erano la PRIMA cosa che si legge, e tutte e quattro dicevano il
// contrario di quello che era successo.

// (1) «Il gestionale NON HA PROVATO a rimettere a posto le righe da solo» su un
// archivio che aveva riparato. La riga sotto la scheda lo sapeva gia'; la
// finestra se lo calcolava per conto suo, e le due si leggevano una sotto
// l'altra. Adesso la regola e' una sola (riparazioniDaDire) e la finestra la usa.
const riparatoEDetto = {
  tipo_file: 'primarie',
  avviso_riparazione: { righe: 50, risolto: false, archivi: [{ nome: 'Primarie RETE', riscritte: 50, tolte: 0, risolto: false, contato: true }] },
  riparazione_non_fatta: [{ nome: 'Primarie RETE', motivo: "la cancellazione e' stata respinta per il limite di richieste" }],
};
const dette = riparazioniDaDire(riparatoEDetto);
verifica('di un archivio riparato non si dice che non ci ha provato', dette.nonFatta.length === 0, JSON.stringify(dette.nonFatta));
verifica('si dice che ci ha provato e non e' + "' arrivato in fondo", dette.aMeta.length === 1 && dette.aMeta[0].nome === 'Primarie RETE', JSON.stringify(dette.aMeta));
verifica('e la riga sotto la scheda dice la stessa cosa', String((testoVerificaArchivio(riparatoEDetto) || {}).testo || '').includes("ma non e' arrivato in fondo"), (testoVerificaArchivio(riparatoEDetto) || {}).testo);
verifica('la finestra usa la stessa regola, non una sua', finestraJsx.includes('riparazioniDaDire(state)'), 'la finestra se lo ricalcola da sola');
// (7) E il riquadro della riparazione riuscita esiste: il campo arrivava alla
// finestra e non lo disegnava nessuno.
verifica('e disegna anche la riparazione riuscita', finestraJsx.includes('ha rimesso a posto da solo delle righe'), 'manca il riquadro di avviso_riparazione');
verifica('nessun riquadro stampa piu' + "' riparazione_non_fatta da solo", !finestraJsx.includes('state.riparazione_non_fatta.map'), 'il riquadro vecchio e\' ancora li\'');

// (2) «DOPO LA RIPARAZIONE Primarie RETE ha dato due numeri diversi» detto
// quando la riparazione non era mai partita: se il conteggio non si ferma su un
// numero, la riparazione non parte proprio.
const instabileSenzaRiparazione = testoVerificaArchivio({
  tipo_file: 'primarie',
  avviso_non_verificato: { non_contato: true, archivi: ['Primarie RETE'], instabili: ['Primarie RETE'], incoerenti: [], righe_incerte: 0 },
});
verifica('non si dice "dopo la riparazione" di una riparazione mai partita', !!instabileSenzaRiparazione && !instabileSenzaRiparazione.testo.includes('Dopo la riparazione'), instabileSenzaRiparazione && instabileSenzaRiparazione.testo);
// E la frase generica, quando non si sa nemmeno di quale archivio si parla.
const nonContatoSenzaNomi = testoVerificaArchivio({
  tipo_file: 'primarie',
  avviso_non_verificato: { non_contato: true, archivi: [], instabili: [], incoerenti: [], righe_incerte: 0 },
});
verifica("senza nomi si dice 'l'archivio' e basta", !!nonContatoSenzaNomi && nonContatoSenzaNomi.testo.includes("Non si e' riusciti a contare l'archivio dopo la scrittura"), nonContatoSenzaNomi && nonContatoSenzaNomi.testo);
verifica('ma la notizia resta', !!instabileSenzaRiparazione && instabileSenzaRiparazione.testo.includes('due numeri diversi uno dopo l' + "'altro"), instabileSenzaRiparazione && instabileSenzaRiparazione.testo);
verifica('e nemmeno la finestra lo dice piu' + "'", !finestraJsx.includes('Dopo la riparazione'), 'la frase e\' ancora nella finestra');

// (3) «ha ricontato l'archivio, I NUMERI QUI SOTTO SONO QUELLI DI ADESSO» su un
// archivio che il gestionale dichiara di non aver contato: due frasi che si
// smentiscono nella stessa riga.
const incertaSenzaNumeri = testoVerificaArchivio({
  tipo_file: 'primarie',
  riparazione_incerta: ['Primarie RETE'],
  avviso_non_verificato: { non_contato: true, archivi: ['Primarie RETE'], instabili: [], incoerenti: [], righe_incerte: 0 },
});
verifica('su un archivio non contato non si promettono i numeri di adesso', !!incertaSenzaNumeri && !incertaSenzaNumeri.testo.includes('i numeri qui sotto sono quelli di adesso'), incertaSenzaNumeri && incertaSenzaNumeri.testo);
verifica('e si dice com' + "'e' davvero", !!incertaSenzaNumeri && incertaSenzaNumeri.testo.includes('non si sa nemmeno quante righe ci siano adesso'), incertaSenzaNumeri && incertaSenzaNumeri.testo);
const incertaConNumeri = testoVerificaArchivio({ tipo_file: 'primarie', riparazione_incerta: ['Primarie RETE'] });
verifica('dove invece si e' + "' contato, i numeri si promettono ancora", !!incertaConNumeri && incertaConNumeri.testo.includes('i numeri qui sotto sono quelli di adesso'), incertaConNumeri && incertaConNumeri.testo);

// (4) «L'ARCHIVIO E' VUOTO» in rosso su un archivio pieno. Le righe scritte sono
// quelle che la piattaforma ha CONFERMATO: se ogni risposta si perde e nessun
// conteggio risponde, quel numero e' zero e l'archivio puo' essere completo.
globalThis.__ARCHIVI = { UploadLog: [{ ...logAperto(1, TUTTI, ''), tipo_file: 'ordini_non_dichiarati' }] };
await funzione({
  azione: 'registra', tipo_file: 'ordini_non_dichiarati', nome_file: 'ond.xlsx',
  righe_importate: 0, righe_fallite: 0, righe_incerte: 480, totale_righe: 480,
});
const logVuoto = ultimoLog('ordini_non_dichiarati');
verifica('non si scrive "l' + "'archivio e' vuoto\" di un archivio non contato", !String(logVuoto.messaggio || '').includes("L'archivio e' vuoto"), logVuoto.messaggio);
verifica('si dice che non si sa che cosa ci sia dentro', String(logVuoto.messaggio || '').includes('non si sa che cosa ci sia dentro'), logVuoto.messaggio);
// E con l'archivio contato a zero la frase vera resta.
globalThis.__ARCHIVI = { UploadLog: [{ ...logAperto(1, TUTTI, ''), tipo_file: 'ordini_non_dichiarati' }] };
await funzione({
  azione: 'registra', tipo_file: 'ordini_non_dichiarati', nome_file: 'ond.xlsx',
  righe_importate: 0, righe_fallite: 480, conteggio_finale: 0, totale_righe: 480,
});
verifica("con l'archivio contato a zero si dice ancora che e' vuoto", String(ultimoLog('ordini_non_dichiarati').messaggio || '').includes("L'archivio e' vuoto"), ultimoLog('ordini_non_dichiarati').messaggio);
const paginaJsx = readFileSync(qui('../src/pages/CaricamentoDati.jsx'), 'utf8');
verifica('e la pagina non lo dice piu' + "' a occhi chiusi", paginaJsx.includes('res.data.avviso_non_verificato'), 'la pagina afferma ancora che l\'archivio e\' vuoto');

// (6) «450 righe invece delle 450 del file», proprio nel caso che il conteggio
// ordine per ordine esiste per prendere: un blocco doppio e uno perso si
// compensano, il totale torna e gli ordini no. Si legge come un errore di
// stampa, e chi lo legge smette di fidarsi del resto.
const totaleCheTorna = testoVerificaArchivio({
  tipo_file: 'primarie',
  avviso_mancanti: { righe_mancanti: 100, ordini: 100, archivi: [{ nome: 'Primarie RETE', righe: 450, attese: 450, ordini: 100, esempi: [] }] },
});
verifica('non si scrive "450 righe invece delle 450 del file"', !!totaleCheTorna && !totaleCheTorna.testo.includes('450 righe invece delle 450'), totaleCheTorna && totaleCheTorna.testo);
verifica('si dice che il totale torna ma gli ordini no', !!totaleCheTorna && totaleCheTorna.testo.includes('le righe sono 450 come nel file, ma non sono quelle degli ordini giusti'), totaleCheTorna && totaleCheTorna.testo);
const totaleDiverso = testoVerificaArchivio({
  tipo_file: 'primarie',
  avviso_mancanti: { righe_mancanti: 100, ordini: 100, archivi: [{ nome: 'Primarie RETE', righe: 350, attese: 450, ordini: 100, esempi: [] }] },
});
verifica('e quando i numeri sono diversi si dicono come prima', !!totaleDiverso && totaleDiverso.testo.includes('350 righe invece delle 450 del file'), totaleDiverso && totaleDiverso.testo);

// (5) IL RITENTATIVO DOPO IL LIMITE DI RICHIESTE nella forma in cui il limite
// arriva davvero: deleteMany e' avvolto da conLimiteRichieste, si arrende, e
// l'errore risale al catch finale della function, che risponde 500 col 429 nel
// corpo. Guardando il solo stato, il ritentativo non scattava mai dal vivo.
const errore429NelCorpo = () => Object.assign(new Error('Request failed with status code 500'), {
  status: 500,
  data: { error: 'Rate limit exceeded: too many requests', fase: 'cancellazione', dati_intatti: true },
});
const esito429NelCorpo = await caricamento(() => {
  let prima = true;
  gancio = async (corpo, esegui) => {
    if (corpo.azione === 'cancella_ordini' && prima) { prima = false; throw errore429NelCorpo(); }
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && corpo.blocco === 2 && !registro.includes('cancella_ordini PrimariaRete')) throw cadutaDiRete();
    return esegui();
  };
});
verifica('un 500 col limite nel corpo fa ritentare la riparazione', quante('cancella_ordini PrimariaRete') >= 2, `${quante('cancella_ordini PrimariaRete')} tentativi`);
verifica('e le righe tornano', archivio('PrimariaRete').length === RETE, `${archivio('PrimariaRete').length} righe`);
verifica('il caricamento si chiude riuscito', esito429NelCorpo.esito === 'successo', `${esito429NelCorpo.esito} — ${ultimoLog().messaggio || ''}`);

// ---------------------------------------------------------------------------
console.log('(G23) LA RIPARAZIONE NON PERDE I PROPRI DUBBI');
// IL BUCO DEL GIRO SCORSO. La regola nuova - "il verdetto si regge su cio' che
// la piattaforma ha CONFERMATO di aver scritto, non su cio' che una lettura
// racconta" - era stata applicata alla PRIMA SCRITTURA e non alla RIPARAZIONE.
//
// Un ordine che la prima scrittura aveva confermato, e che la riparazione ha
// appena CANCELLATO senza riuscire a riscriverlo, usciva dall'elenco dei dubbi:
// da li' in poi a decidere tornava una lettura sola, e una lettura in ritardo
// mostra ancora l'archivio di PRIMA della cancellazione, cioe' pieno. Il
// caricamento chiudeva "successo" con duecento righe cancellate dal gestionale
// e mai rimesse, e i ricalcoli dei moduli partivano sopra.
//
// La regola e' la stessa di prima: un ordine e' certo solo quando risulta
// confermato SIA il togliere SIA il riscrivere.

// La lettura dice che mancano 200 ordini (non e' vero, ci sono tutti), la
// riparazione li toglie davvero, la riscrittura non risponde, e da li' in poi
// la lettura risponde con la fotografia di prima: l'archivio pieno.
const dubbiRiparazione = (riscrittureRotte) => () => {
  let cancellato = false;
  let rotte = riscrittureRotte;
  gancio = async (corpo, esegui) => {
    if (corpo.azione === 'conta_esatta' && corpo.entita === 'PrimariaRete') {
      return { status: 200, data: cancellato ? fotografiaDi(RETE) : fotografiaDi(RETE - 200) };
    }
    if (corpo.azione === 'cancella_ordini' && corpo.entita === 'PrimariaRete') {
      const r = await esegui();
      cancellato = true;
      return r;
    }
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && cancellato && rotte > 0) {
      rotte--;
      throw cadutaDiRete();
    }
    return esegui();
  };
};

// (1) Il giro in piu' RECUPERA le righe: e' il caso in cui tenere il dubbio
// paga subito.
const esitoDubbioRecuperato = await caricamento(dubbiRiparazione(1));
verifica('le righe cancellate dalla riparazione tornano in archivio', archivio('PrimariaRete').length === RETE, `${archivio('PrimariaRete').length} righe invece di ${RETE}`);
verifica('e nessun ordine ne ha due', [...righePerOrdine('PrimariaRete').values()].every(v => v === 1), JSON.stringify([...righePerOrdine('PrimariaRete').entries()].filter(([, v]) => v !== 1).slice(0, 3)));
verifica('e serve un giro in piu' + "' di riparazione", quante('cancella_ordini PrimariaRete') === 2, `${quante('cancella_ordini PrimariaRete')} cancellazioni`);
verifica('il caricamento si chiude riuscito, e questa volta e' + "' vero", esitoDubbioRecuperato.esito === 'successo', `${esitoDubbioRecuperato.esito} — ${ultimoLog().messaggio || ''}`);

// (2) E quando nessun giro ce la fa, NON si dichiara riuscito: sono duecento
// righe che il gestionale ha tolto e non e' riuscito a rimettere, e la lettura
// che dice il contrario e' proprio quella in ritardo.
const esitoDubbioAperto = await caricamento(dubbiRiparazione(99));
verifica("l'archivio e' rimasto senza le righe che la riparazione ha tolto", archivio('PrimariaRete').length === RETE - 200, `${archivio('PrimariaRete').length} righe`);
verifica('e il caricamento NON si chiude riuscito', esitoDubbioAperto.esito === 'parziale', `${esitoDubbioAperto.esito} — ${ultimoLog().messaggio || ''}`);
verifica('i ricalcoli dei moduli non partono', moduliDaRicalcolare(esitoDubbioAperto) === false, String(moduliDaRicalcolare(esitoDubbioAperto)));
verifica('gli ordini rimasti in dubbio si dicono per nome e per numero', JSON.stringify(((esitoDubbioAperto.avviso_non_verificato || {}).non_confermati || [])) === JSON.stringify([{ nome: 'Primarie RETE', ordini: 200 }]), JSON.stringify(esitoDubbioAperto.avviso_non_verificato));
const testoDubbioAperto = testoVerificaArchivio(esitoDubbioAperto);
verifica('e la riga sotto la scheda lo dice', !!testoDubbioAperto && testoDubbioAperto.testo.includes("non si e' potuto confermare che le righe siano entrate una volta sola"), testoDubbioAperto && testoDubbioAperto.testo.slice(0, 260));
verifica('la finestra si apre', !!avvisiDaMostrare(esitoDubbioAperto), JSON.stringify(avvisiDaMostrare(esitoDubbioAperto)));

// ---------------------------------------------------------------------------
console.log("(G24) IL PERCORSO NON PRIMARIE: UN CONTEGGIO NON SCIOGLIE UN BLOCCO NON CONFERMATO");
// Il gemello del difetto qui sopra, dall'altra parte. Quando la scrittura non
// conferma, decidiDalConteggio puo' rispondere "scritto": sulle primarie quel
// dubbio lo raccoglie ordiniDubbi, qui ordiniDubbi non veniva nemmeno letto e
// il verdetto tornava a nascere da un conteggio. Con la lettura indietro di una
// copia, il caricamento chiudeva "successo" con duecento righe entrate due
// volte e i pesi contati doppi da li' in poi.

const esitoOndDatoPerEntrato = await caricamentoGenerico(() => {
  let fatto = false;
  let indietro = false;
  gancio = async (corpo, esegui) => {
    // La lettura e' indietro di una copia: mostra l'archivio senza il secondo
    // esemplare del blocco, cioe' esattamente cio' che si vorrebbe sentire.
    if (corpo.azione === 'conta' && indietro) {
      return { status: 200, data: { conteggio: archivio('OrdineNonDichiarato').length - 200, contato: true } };
    }
    if (corpo.azione === 'scrivi' && corpo.blocco === 0 && !fatto) {
      fatto = true;
      await esegui();
      await esegui();          // la piattaforma scrive il blocco due volte
      indietro = true;
      throw cadutaDiRete();
    }
    return esegui();
  };
});
verifica('in archivio ci sono davvero le righe doppie', archivio('OrdineNonDichiarato').length === OND + 200, `${archivio('OrdineNonDichiarato').length} righe`);
verifica('il conteggio non chiude il caricamento', esitoOndDatoPerEntrato.esito === 'parziale', `${esitoOndDatoPerEntrato.esito} — ${ultimoLog('ordini_non_dichiarati').messaggio || ''}`);
verifica('le righe non confermate si dicono', (esitoOndDatoPerEntrato.avviso_non_verificato || {}).righe_incerte === 200, JSON.stringify(esitoOndDatoPerEntrato.avviso_non_verificato));
verifica('la riga sotto la scheda non tace', String((testoVerificaArchivio(esitoOndDatoPerEntrato) || {}).testo || '').includes('200 righe sono rimaste in sospeso'), JSON.stringify(testoVerificaArchivio(esitoOndDatoPerEntrato)));
const logOndDato = ultimoLog('ordini_non_dichiarati');
verifica('e il registro non scrive un caricamento riuscito', logOndDato.esito === 'parziale', logOndDato.messaggio);
verifica('il registro dice che quelle righe non sono state confermate', String(logOndDato.messaggio || '').includes('200 righe che la piattaforma non ha confermato'), logOndDato.messaggio);
verifica('i moduli collegati non si ricalcolano', moduliDaRicalcolare(esitoOndDatoPerEntrato) === false, String(moduliDaRicalcolare(esitoOndDatoPerEntrato)));

// ---------------------------------------------------------------------------
console.log('(G25) LO STORICO NON AFFERMA "NON SCRITTE" DI RIGHE CHE CI SONO');
// Il blocco entra DAVVERO, la risposta si perde, il conteggio lo da' per
// entrato, e la riparazione non riesce nemmeno a partire (la piattaforma
// rifiuta la cancellazione a dati intatti). In archivio ci sono tutte e 450 le
// righe, e lo storico scriveva "200 righe non scritte" - e, due parole dopo,
// "non si sa se le righe ci siano". Se non si sa, non si puo' affermare.

const esitoNonConfermatoIntatto = await caricamento(() => {
  let rotto = false;
  gancio = async (corpo, esegui) => {
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && corpo.blocco === 1 && !rotto) {
      rotto = true;
      await esegui();              // le righe entrano davvero...
      throw cadutaDiRete();        // ...e la risposta si perde
    }
    // La piattaforma rifiuta la cancellazione e dichiara di non aver tentato
    // niente: qui "non ha provato" e' vero.
    if (corpo.azione === 'cancella_ordini') {
      throw Object.assign(new Error('cancellazione rifiutata'), {
        status: 500, data: { error: 'cancellazione rifiutata', fase: 'cancellazione', dati_intatti: true },
      });
    }
    return esegui();
  };
});
verifica('in archivio ci sono tutte le righe del file', archivio('PrimariaRete').length === RETE && [...righePerOrdine('PrimariaRete').values()].every(v => v === 1), `${archivio('PrimariaRete').length} righe`);
verifica('il caricamento resta parziale, perche' + "' il gestionale non lo sa", esitoNonConfermatoIntatto.esito === 'parziale', esitoNonConfermatoIntatto.esito);
verifica('ma nessuno afferma che quelle righe non sono state scritte', esitoNonConfermatoIntatto.righe_fallite === 0, `${esitoNonConfermatoIntatto.righe_fallite} righe dichiarate non scritte`);
const logNonConfermato = ultimoLog();
verifica('e nemmeno lo storico', !String(logNonConfermato.messaggio || '').includes('righe non scritte') && (logNonConfermato.righe_fallite || 0) === 0, logNonConfermato.messaggio);
verifica('lo storico dice che di quelle righe non si sa', String(logNonConfermato.messaggio || '').includes('200 righe di cui non si sa se siano entrate'), logNonConfermato.messaggio);
// (Rev2 §5) E il registro conosce lo stato nuovo: prima quegli archivi finivano
// fra i "non contati", di un archivio contato benissimo.
verifica('il registro dice il motivo vero, non "archivi non contati"', String(logNonConfermato.messaggio || '').includes('ordini che la piattaforma non ha confermato: Primarie RETE 200') && !String(logNonConfermato.messaggio || '').includes('archivi non contati'), logNonConfermato.messaggio);
// (Rev2 §3 / Rev3 §4) E la finestra ha il suo riquadro: senza, l'elenco degli
// archivi a parte restava vuoto e scattava la frase generica "Non si e' riusciti
// a contare l'archivio" di un archivio contato dieci volte.
const testoNonConfermato = testoVerificaArchivio(esitoNonConfermatoIntatto);
verifica("la riga sotto la scheda non dice che non si e' riusciti a contare", !!testoNonConfermato && !testoNonConfermato.testo.includes("Non si e' riusciti a contare"), testoNonConfermato && testoNonConfermato.testo.slice(0, 260));
verifica('la finestra ha un riquadro per lo stato nuovo', finestraJsx.includes('nonConfermati.length > 0') && finestraJsx.includes('non si è potuto confermare che le righe siano entrate una volta sola'), 'manca il riquadro di non_confermati');
// La regola di chi ha "una frase sua" e' UNA SOLA e la usano tutte e due le
// superfici: finche' ognuna se la calcolava per conto suo, la finestra
// stampava "Non si e' riusciti a contare l'archivio" e la riga sotto la scheda,
// nello stesso momento, il motivo vero.
verifica('un archivio con ordini non confermati non fa scattare la frase generica', archiviConFraseLoro({ archivi: [], instabili: [], incoerenti: [], non_confermati: [{ nome: 'Primarie RETE', ordini: 200 }] }).join() === 'Primarie RETE', JSON.stringify(archiviConFraseLoro({ non_confermati: [{ nome: 'Primarie RETE', ordini: 200 }] })));
verifica('e la finestra usa la stessa regola, non una sua', finestraJsx.includes('archiviConFraseLoro(a)'), 'la finestra se lo ricalcola da sola');
verifica("'non ha provato' resta dove il gestionale non ha toccato niente", (esitoNonConfermatoIntatto.riparazione_non_fatta || [{}])[0].toccato === false, JSON.stringify(esitoNonConfermatoIntatto.riparazione_non_fatta));

// ---------------------------------------------------------------------------
console.log("(G26) IL FRENO NON SI FERMA NEL GIRO CHE AVREBBE CHIUSO IL CASO");
// Il freno serve a un caso solo: una piattaforma che ACCETTA il filtro a lotti
// e non toglie niente. La domanda giusta non e' "ci sono piu' righe di troppo
// di prima" - a quella si risponde "si'" anche quando la RISCRITTURA e' andata
// a destinazione due volte - ma "la cancellazione ha tolto le righe che diceva
// di togliere". Fermarsi sulla prima faceva buttare via il giro dopo, che
// comincia togliendo e avrebbe rimesso tutto a posto.

const esitoFrenoGiusto = await caricamento(() => {
  let persoUno = false;
  let doppiata = false;
  let cancellato = false;
  let contaRotti = 0;
  gancio = async (corpo, esegui) => {
    if ((corpo.azione === 'conta' || corpo.azione === 'conta_esatta') && contaRotti > 0) { contaRotti--; throw cadutaDiRete(); }
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && corpo.blocco === 1 && !persoUno) {
      persoUno = true;
      contaRotti = 2;              // il blocco non entra e il conteggio non risponde
      throw cadutaDiRete();
    }
    if (corpo.azione === 'cancella_ordini' && corpo.entita === 'PrimariaRete') {
      const r = await esegui();
      cancellato = true;
      return r;
    }
    // LA RISCRITTURA della riparazione entra DUE VOLTE e la risposta si perde:
    // le righe di troppo le fabbrica la piattaforma, non la cancellazione.
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && cancellato && !doppiata) {
      doppiata = true;
      await esegui();
      await esegui();
      throw cadutaDiRete();
    }
    return esegui();
  };
});
verifica('il giro dopo rimette tutto a posto', archivio('PrimariaRete').length === RETE && [...righePerOrdine('PrimariaRete').values()].every(v => v === 1), `${archivio('PrimariaRete').length} righe`);
verifica('e la riparazione fa il secondo giro invece di fermarsi', quante('cancella_ordini PrimariaRete') === 2, `${quante('cancella_ordini PrimariaRete')} cancellazioni`);
verifica('il caricamento si chiude riuscito', esitoFrenoGiusto.esito === 'successo', `${esitoFrenoGiusto.esito} — ${ultimoLog().messaggio || ''}`);
verifica('e nessuno scrive che il gestionale si e' + "' fermato", esitoFrenoGiusto.riparazione_non_fatta === null, JSON.stringify(esitoFrenoGiusto.riparazione_non_fatta));

// E QUANDO IL FRENO SCATTA DAVVERO: la cancellazione viene accettata e non
// toglie niente, la riscrittura entra e la risposta si perde. Alla riparazione
// non e' stato confermato NIENTE, quindi avviso_riparazione non la nomina - ed
// e' li' che si leggeva "il gestionale NON HA PROVATO a rimettere a posto
// l'archivio Primarie RETE", tre parole prima di "ha chiesto di togliere".
const esitoToccatoSenzaConferme = await caricamento(() => {
  globalThis.__IN_IGNORATO = true;
  let rottoZero = false;
  let cancellato = false;
  let riscritturaPersa = false;
  let contaRotti = 0;
  gancio = async (corpo, esegui) => {
    if ((corpo.azione === 'conta' || corpo.azione === 'conta_esatta') && contaRotti > 0) { contaRotti--; throw cadutaDiRete(); }
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && corpo.blocco === 0 && !rottoZero) {
      rottoZero = true;
      await esegui();
      await esegui();              // 200 ordini con due righe
      contaRotti = 2;
      throw cadutaDiRete();
    }
    if (corpo.azione === 'cancella_ordini' && corpo.entita === 'PrimariaRete') {
      const r = await esegui();
      cancellato = true;
      return r;
    }
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && cancellato && !riscritturaPersa) {
      riscritturaPersa = true;
      await esegui();              // le righe entrano...
      throw cadutaDiRete();        // ...e la risposta si perde
    }
    return esegui();
  };
});
globalThis.__IN_IGNORATO = false;
verifica('la riparazione ha toccato l' + "'archivio senza che le venisse confermato niente", esitoToccatoSenzaConferme.avviso_riparazione === null && (esitoToccatoSenzaConferme.riparazione_non_fatta || [{}])[0].toccato === true, JSON.stringify({ r: esitoToccatoSenzaConferme.avviso_riparazione, nf: esitoToccatoSenzaConferme.riparazione_non_fatta }));
const detteToccato = riparazioniDaDire(esitoToccatoSenzaConferme);
verifica('non si scrive che non ci ha provato', detteToccato.nonFatta.length === 0 && detteToccato.aMeta.length === 1, JSON.stringify({ nf: detteToccato.nonFatta, am: detteToccato.aMeta }));
const testoToccato = testoVerificaArchivio(esitoToccatoSenzaConferme);
verifica('si dice che ci ha provato e non e' + "' arrivato in fondo", !!testoToccato && testoToccato.testo.includes("ma non e' arrivato in fondo") && !testoToccato.testo.includes('non ha provato a rimettere a posto'), testoToccato && testoToccato.testo.slice(0, 300));
// E il buco non lo ha fatto il gestionale: il freno ha appena visto che quelle
// righe non sono uscite. "Ha tolto 400 righe" sarebbe il contrario del vero.
verifica("e non si attribuisce al gestionale un buco che non ha fatto", ((esitoToccatoSenzaConferme.riparazione_tentata || [{}])[0] || {}).righe === 0, JSON.stringify(esitoToccatoSenzaConferme.riparazione_tentata));
verifica('nemmeno nello storico', !String(ultimoLog().messaggio || '').includes('righe tolte dalla riparazione e non rimesse'), ultimoLog().messaggio);
verifica('il caricamento resta parziale', esitoToccatoSenzaConferme.esito === 'parziale' && moduliDaRicalcolare(esitoToccatoSenzaConferme) === false, esitoToccatoSenzaConferme.esito);

// ---------------------------------------------------------------------------
console.log('(G27) LE PAROLE DELLA SCHEDA');
// "1 blocchi CONFERMATI dall'archivio" scritto due righe sopra "di 200 ordini
// non si e' potuto confermare che le righe siano entrate". Il nome nel codice e'
// onesto - blocchiDatiPerEntrati - e a video usciva proprio la parola che tutto
// il giro e' andato a togliere.
verifica('la scheda non chiama "confermato" un blocco che nessuno ha confermato', !paginaJsx.includes("blocchi confermati dall'archivio"), 'la scheda dice ancora "confermati"');
verifica('e dice come lo chiama il codice: dato per entrato', paginaJsx.includes('blocco dato per entrato') && paginaJsx.includes('blocchi dati per entrati'), 'manca la parola giusta');

// ---------------------------------------------------------------------------
console.log("(e) LE DATE DEI MESSAGGI SI LEGGONO ALL'ITALIANA");
// I ritiri delle richieste si rinviano quando un caricamento delle primarie e'
// aperto: anche li' la data e' quella che legge chi lavora.

globalThis.__ARCHIVI = { UploadLog: [logAperto(30)] };
const rinvio = await funzione({ azione: 'ritiri_ect', tipo_file: 'primarie' });
verifica('i ritiri si rinviano con un caricamento aperto', rinvio.status === 409 && rinvio.body.rinviato === true, JSON.stringify(rinvio.body).slice(0, 150));
verifica('e la data del rinvio e' + "' all'italiana", /\b\d{2}\/\d{2}\/\d{4}\b/.test(String(rinvio.body.error)) && !/\d{4}-\d{2}-\d{2}/.test(String(rinvio.body.error)), rinvio.body.error);

// ---------------------------------------------------------------------------
console.log('(G28) QUANDO NON MANCAVA NIENTE, NON SI SCRIVE CHE MANCAVA');
// Da quando la riparazione gira ANCHE su un archivio che torna - per sciogliere
// il dubbio di un blocco che la piattaforma non ha confermato - le frasi della
// riparazione raccontavano l'altro caso: "Dopo il primo controllo mancavano o
// avanzavano delle righe". Non mancava niente: il primo controllo tornava, e a
// mancare era la CONFERMA. La finestra in questo caso non si apre, quindi
// quella riga e quella del registro sono tutto quello che chi lavora legge, e
// la seconda resta nello storico per sempre: chi la rilegge domani crede che la
// piattaforma abbia perso duecento righe - e' la notizia dell'incidente del
// 24/09 - e va a cercare un guasto che non c'e' mai stato.

const esitoSoloPerDubbio = await caricamento(() => {
  let rotto = false;
  gancio = async (corpo, esegui) => {
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && corpo.blocco === 1 && !rotto) {
      rotto = true;
      await esegui();              // le righe entrano davvero...
      throw cadutaDiRete();        // ...e la risposta si perde
    }
    return esegui();
  };
});
verifica('in archivio ci sono tutte le righe del file', archivio('PrimariaRete').length === RETE && [...righePerOrdine('PrimariaRete').values()].every(v => v === 1), `${archivio('PrimariaRete').length} righe`);
verifica('il caricamento e\' riuscito', esitoSoloPerDubbio.esito === 'successo', esitoSoloPerDubbio.esito);
verifica('la riparazione e\' partita per sciogliere il dubbio, e lo dice',
  (esitoSoloPerDubbio.avviso_riparazione || {}).archivi.every(a => a.solo_per_dubbio === true),
  JSON.stringify(esitoSoloPerDubbio.avviso_riparazione));
const testoSoloPerDubbio = testoVerificaArchivio(esitoSoloPerDubbio);
verifica('la riga sotto la scheda NON dice che mancavano o avanzavano righe',
  !!testoSoloPerDubbio && !testoSoloPerDubbio.testo.includes('mancavano o avanzavano'), testoSoloPerDubbio && testoSoloPerDubbio.testo.slice(0, 260));
verifica('dice invece che mancava la conferma, e che non mancava niente',
  testoSoloPerDubbio.testo.includes('non aveva la conferma') && testoSoloPerDubbio.testo.includes('Non mancava niente'), testoSoloPerDubbio.testo.slice(0, 260));
const logSoloPerDubbio = ultimoLog();
verifica('e nello storico non resta scritto "dopo il primo controllo"',
  !String(logSoloPerDubbio.messaggio || '').includes('dopo il primo controllo'), logSoloPerDubbio.messaggio);
verifica('lo storico dice perche\' le ha rifatte',
  String(logSoloPerDubbio.messaggio || '').includes("non aveva confermato che fossero entrate una volta sola"), logSoloPerDubbio.messaggio);
// E il caso opposto resta com'era: quando mancavano davvero, si dice che
// mancavano. La frase nuova non deve mangiarsi anche quella.
verifica('quando invece mancavano davvero, la frase resta quella',
  testoVerificaArchivio({ avviso_riparazione: { archivi: [{ nome: 'Primarie RETE', righe: 200, riscritte: 200, tolte: 0, risolto: true, contato: true, solo_per_dubbio: false }] } }).testo.includes('mancavano o avanzavano'),
  'la frase della mancanza e\' sparita');

// ---------------------------------------------------------------------------
console.log('(S) L\'ARCHIVIO CON LO STORICO CONSERVATO');
// Dal 25/09/2026 un archivio delle primarie non si svuota piu' a zero: i
// terminati degli anni prima che il file non contiene restano dov'erano
// (base44/shared/storicoConservato.ts). Tutto il verdetto del caricamento si
// regge su una frase sola, e da qui in giu' quella frase e': l'archivio si porta
// alla BASE NOTA e si verifica che sia esattamente quella; ogni blocco del file
// si scrive al massimo una volta; quindi l'archivio non puo' mai avere piu'
// righe di BASE + FILE, ne' in totale ne' per singolo ordine.

// Quattro righe che devono restare: un ordine con due classi, uno con una, e
// uno in stato "eseguito", che si conserva come un terminato e si SEGNALA
// (regola dell'utente, 28/09/2026: "un ordine in stato eseguito va segnalato e
// mantenuto, cosi' che al prossimo caricamento abbia un altro stato, terminato
// o cancellato"). E' uno stato di passaggio e si risolve da solo; trattarlo
// come un ordine mancante faceva chiedere la forzatura e, forzando,
// cancellava proprio l'ordine che l'avviso sugli eseguiti fa vedere.
const rigaStorico = (id, stato = 'terminato', extra = {}) => ({
  id: 'sto-' + id + '-' + (extra.n || 1), id_ordine: id, stato,
  trasporto_finito_il: '2024-06-10T08:00:00Z', ordine_immesso_il: '2024-05-01T08:00:00Z',
  peso_effettivo: 12000, classe: 'A', ...extra,
});
const STORICO_RIGHE = 4;
const idStorico = ['STO-00001', 'STO-00002', 'STO-00003'];
// Un cancellato immesso prima dell'anno del file: non e' storico e non e'
// mancante, si lascia andare senza chiedere niente.
const CANCELLATO_VECCHIO = 'CAN-00001';
// Una riga vecchia di un ordine che il file CONTIENE: quella si cancella e si
// riscrive, come tutte le altre.
const VECCHIA_DEL_FILE = 'ORD-00050';
const seminaStorico = () => {
  globalThis.__ARCHIVI.PrimariaRete = [
    rigaStorico('STO-00001'),
    rigaStorico('STO-00001', 'terminato', { n: 2, classe: 'M' }),
    rigaStorico('STO-00002'),
    rigaStorico('STO-00003', 'eseguito'),
    { id: 'can-1', id_ordine: CANCELLATO_VECCHIO, stato: 'cancellato', ordine_immesso_il: '2024-03-01T08:00:00Z' },
    { id: 'vecchia-1', id_ordine: VECCHIA_DEL_FILE, stato: 'terminato', trasporto_finito_il: '2026-09-13T12:57:36Z', ordine_immesso_il: '2026-09-01T08:00:00Z' },
  ];
};
const quanteRighe = (id) => righePerOrdine('PrimariaRete').get(id) || 0;

// (1) LA PREPARAZIONE non li conta fra i mancanti - altrimenti il caricamento si
// fermerebbe chiedendo la forzatura - e dice quante righe conserva.
const esitoStorico = await caricamento(seminaStorico, righeMiste);
verifica('il caricamento non si ferma a chiedere la forzatura', esitoStorico.esito === 'successo', `${esitoStorico.esito} — ${ultimoLog().messaggio || ''}`);
verifica('e dice quante righe di storico ha conservato', !!esitoStorico.storico_conservato && esitoStorico.storico_conservato.righe === STORICO_RIGHE, JSON.stringify(esitoStorico.storico_conservato));
verifica("l'anno da cui comincia il file lo dice il calendario", esitoStorico.storico_conservato.dal_anno === new Date().getFullYear() - 1, String(esitoStorico.storico_conservato.dal_anno));

// (2) LO SVUOTAMENTO li lascia e toglie tutto il resto.
verifica('le righe dello storico sono rimaste, tutte', idStorico.every(id => quanteRighe(id) > 0) && quanteRighe('STO-00001') === 2, JSON.stringify([...idStorico, 'STO-00001'].map(id => [id, quanteRighe(id)])));
verifica("e sono proprio le righe di prima, non righe riscritte", archivio('PrimariaRete').filter(r => String(r.id).startsWith('sto-')).length === STORICO_RIGHE, String(archivio('PrimariaRete').filter(r => String(r.id).startsWith('sto-')).length));
verifica('il cancellato degli anni prima se n\'e' + "' andato", quanteRighe(CANCELLATO_VECCHIO) === 0, String(quanteRighe(CANCELLATO_VECCHIO)));
verifica('la riga vecchia di un ordine che il file contiene e' + "' stata riscritta", quanteRighe(VECCHIA_DEL_FILE) === 1 && !archivio('PrimariaRete').some(r => r.id === 'vecchia-1'), String(quanteRighe(VECCHIA_DEL_FILE)));

// (4) IL VERDETTO QUADRA CON BASE + FILE, e i ricalcoli partono: senza questo,
// ogni caricamento chiuderebbe parziale e la seconda regola assoluta - ogni
// caricamento aggiorna tutti i moduli - si spegnerebbe da sola.
verifica("l'archivio ha le righe del file piu' quelle dello storico", archivio('PrimariaRete').length === RIGHE_MISTE + STORICO_RIGHE, `${archivio('PrimariaRete').length} righe`);
verifica('non si dichiarano righe di troppo ne' + "' mancanti", esitoStorico.avviso_doppioni === null && esitoStorico.avviso_mancanti === null && esitoStorico.avviso_disallineamento === null, JSON.stringify({ d: esitoStorico.avviso_doppioni, m: esitoStorico.avviso_mancanti }));
verifica('e i moduli collegati si ricalcolano', moduliDaRicalcolare(esitoStorico) === true, String(moduliDaRicalcolare(esitoStorico)));
verifica('le righe importate sono quelle del FILE, non gonfiate dallo storico', esitoStorico.righe_importate === RIGHE_MISTE, String(esitoStorico.righe_importate));
verifica('lo storico non apre la finestra da solo', avvisiDaMostrare(esitoStorico) === null, JSON.stringify(avvisiDaMostrare(esitoStorico)));
verifica('ma quando la finestra si apre per altro, si legge', (avvisiDaMostrare({ ...esitoStorico, avviso_calo: { righe_attuali: 1, righe_precedenti: 9 } }) || {}).storico_conservato !== null);
verifica('nel registro resta scritto quante righe di storico', String(ultimoLog().messaggio || '').includes(`storico conservato: ${STORICO_RIGHE} righe`), ultimoLog().messaggio);

// L'ORDINE "ESEGUITO" CONSERVATO SI VEDE. Si conserva come un terminato, ma
// chiamarlo terminato sarebbe falso, e soprattutto non si puo' conservarlo in
// silenzio: immesso prima dell'anno scorso resta fuori dall'export, quindi
// l'avviso sugli eseguiti - che guarda il FILE - non lo vede, e senza questo
// numero resterebbe in archivio senza comparire da nessuna parte.
verifica('quanti eseguiti si sono conservati si dice', !!esitoStorico.storico_conservato.eseguiti && esitoStorico.storico_conservato.eseguiti.righe === 1 && esitoStorico.storico_conservato.eseguiti.ordini === 1, JSON.stringify(esitoStorico.storico_conservato.eseguiti));
verifica('e resta scritto anche nel registro, con la parola giusta', String(ultimoLog().messaggio || '').includes('ordini terminati o eseguiti') && String(ultimoLog().messaggio || '').includes('1 di ordini in stato "eseguito"'), ultimoLog().messaggio);

// (3) UN BLOCCO RITENTATO SI RICONOSCE SOPRA LA BASE. La scrittura entra e la
// risposta si perde: il conteggio deve dire "era passato" contando anche le
// righe dello storico, altrimenti nessuna delle due ipotesi torna mai, il blocco
// resta in sospeso e il caricamento chiude "non si e' potuto verificare".
const esitoSopraLaBase = await caricamento(() => {
  seminaStorico();
  contaKo = 0;
  let rotto = false;
  gancio = async (corpo, esegui) => {
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && corpo.blocco === 0 && !rotto) {
      rotto = true;
      await esegui();          // il blocco entra davvero...
      throw cadutaDiRete();    // ...ma la risposta non torna
    }
    return esegui();
  };
}, righeMiste);
verifica("l'archivio ha dato il blocco per entrato", esitoSopraLaBase.blocchi_confermati_dal_conteggio === 1, String(esitoSopraLaBase.blocchi_confermati_dal_conteggio));
// Il dubbio su quel blocco lo scioglie la riparazione, che toglie e riscrive:
// e' cosi' anche senza storico. Cio' che qui deve restare vero e' che la
// riparazione non tocca MAI le righe conservate.
verifica('e la riparazione non tocca le righe dello storico', quanteRighe('STO-00001') === 2 && quanteRighe('STO-00002') === 1 && quanteRighe('STO-00003') === 1, JSON.stringify(idStorico.map(id => [id, quanteRighe(id)])));
verifica('non nasce nessun doppione sopra lo storico', archivio('PrimariaRete').length === RIGHE_MISTE + STORICO_RIGHE, `${archivio('PrimariaRete').length} righe`);
verifica("il caricamento e' riuscito", esitoSopraLaBase.esito === 'successo', `${esitoSopraLaBase.esito} — ${ultimoLog().messaggio || ''}`);

// (5) LA RIPARAZIONE NON TOCCA MAI LO STORICO, nemmeno quando il conteggio glielo
// mostra come "righe di troppo". E' il punto che vale da solo tutto lo scenario:
// quelle righe il file non le contiene, quindi toglierle vorrebbe dire perderle
// per sempre - non c'e' niente da riscrivere.
const esitoStoricoInPiu = await caricamento(() => {
  seminaStorico();
  gancio = async (corpo, esegui) => {
    const risposta = await esegui();
    if (corpo.azione === 'conta_esatta' && corpo.entita === 'PrimariaRete' && risposta.data && risposta.data.conteggi) {
      // la lettura racconta una riga in piu' su un ordine conservato
      const conteggi = { ...risposta.data.conteggi, 'STO-00002': 2 };
      return { ...risposta, data: { ...risposta.data, righe: risposta.data.righe + 1, conteggi } };
    }
    return risposta;
  };
}, righeMiste);
verifica('le righe dello storico sono ancora tutte li' + "'", quanteRighe('STO-00002') === 1 && archivio('PrimariaRete').length === RIGHE_MISTE + STORICO_RIGHE, `${archivio('PrimariaRete').length} righe`);
verifica('e la cancellazione mirata non e' + "' mai partita", quante('cancella_ordini PrimariaRete') === 0, String(quante('cancella_ordini PrimariaRete')));
verifica('il caricamento resta parziale e lo dice', esitoStoricoInPiu.esito === 'parziale' && !!esitoStoricoInPiu.avviso_doppioni, `${esitoStoricoInPiu.esito}`);
// E la frase non chiama "del file" delle righe che il file non porta: e' la
// frase che spiega un guasto, e sbagliata li' manda a cercare il guasto sbagliato.
verifica('la frase non chiama "del file" le righe dello storico', (testoVerificaArchivio(esitoStoricoInPiu) || {}).testo.includes('fra il file e lo storico conservato'), JSON.stringify(testoVerificaArchivio(esitoStoricoInPiu)));

// E se lo storico avesse perso delle righe, non si ripara: SI DICE, perche' il
// file non le contiene e l'unico rimedio e' ricaricare tutto dal primo anno.
//
// Qui la lettura REGGE: in archivio le righe sono 124 come devono, perche'
// insieme alla riga di storico persa ne e' comparsa una di troppo di un ordine
// che il file non porta (e che quindi la riparazione non tocca). Senza questo
// pareggio la lettura direbbe meno righe di quante ne sono state confermate,
// cioe' sarebbe una lettura da buttare, e allora non si dichiara niente - vedi
// la prova subito sotto.
const esitoStoricoPerso = await caricamento(() => {
  seminaStorico();
  globalThis.__STORICO_ROTTO = false;
  gancio = async (corpo, esegui) => {
    const risposta = await esegui();
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && !globalThis.__STORICO_ROTTO) {
      // una riga che doveva restare non c'e' piu': nessuno puo' rimetterla,
      // perche' il file non la contiene
      globalThis.__STORICO_ROTTO = true;
      globalThis.__ARCHIVI.PrimariaRete = globalThis.__ARCHIVI.PrimariaRete.filter(r => r.id !== 'sto-STO-00001-2');
      // ...e una riga di troppo di un ordine che nel file non c'e': il totale
      // torna, quindi la lettura non smentisce niente.
      globalThis.__ARCHIVI.PrimariaRete.push({ id: 'fantasma-1', id_ordine: 'ORD-FANTASMA', stato: 'assegnato', ordine_immesso_il: '2026-09-01T08:00:00Z' });
    }
    return risposta;
  };
}, righeMiste);
verifica('lo storico che non torna si dice, con quante righe e quanti ordini', !!esitoStoricoPerso.avviso_storico_non_torna && esitoStoricoPerso.avviso_storico_non_torna.righe === 1 && esitoStoricoPerso.avviso_storico_non_torna.ordini === 1, JSON.stringify(esitoStoricoPerso.avviso_storico_non_torna));
verifica('la riparazione non ci prova nemmeno', quante('cancella_ordini PrimariaRete') === 0, String(quante('cancella_ordini PrimariaRete')));
verifica('e la finestra si apre dicendo il rimedio vero', (avvisiDaMostrare(esitoStoricoPerso) || {}).avviso_storico_non_torna !== null && (testoVerificaArchivio(esitoStoricoPerso) || {}).testo.includes('ricaricare il file completo dal primo anno'), JSON.stringify(testoVerificaArchivio(esitoStoricoPerso)));
// LA STESSA PERDITA NON ESCE DUE VOLTE CON DUE RIMEDI DIVERSI. Un ordine
// conservato a cui mancano delle righe finiva anche fra gli "ordini mancanti",
// dove la frase dice "ricarica lo stesso file, senza rifiltrarlo": per quelle
// righe non serve a niente, perche' il file non le contiene - ed e' lo stesso
// motivo per cui la riparazione non le tocca.
verifica('un ordine conservato che ha perso righe non e' + "' un \"ordine mancante\"", esitoStoricoPerso.avviso_mancanti === null, JSON.stringify(esitoStoricoPerso.avviso_mancanti));
verifica('e la finestra non dice anche "ricarica lo stesso file" per quelle righe', !(testoVerificaArchivio(esitoStoricoPerso) || {}).testo.includes('in archivio mancano'), JSON.stringify(testoVerificaArchivio(esitoStoricoPerso)));
// E il titolo dice la stessa cosa del riquadro rosso. Qui c'e' anche una riga di
// troppo, quindi vince "l'archivio non torna con il file"; con il solo storico
// che non torna il titolo non puo' dire "da rifare", perche' rifare il
// caricamento con lo stesso file quelle righe non le rimette.
verifica('il titolo non dice "completato"', !titoloAvviso(avvisiDaMostrare(esitoStoricoPerso)).startsWith('Caricamento completato'), titoloAvviso(avvisiDaMostrare(esitoStoricoPerso)));
verifica('e con il solo storico che non torna lo dice per nome', titoloAvviso({ type: 'warning', avviso_storico_non_torna: { righe: 1, ordini: 1 } }) === 'Lo storico conservato non torna: mancano righe degli anni prima', titoloAvviso({ type: 'warning', avviso_storico_non_torna: { righe: 1, ordini: 1 } }));
verifica('nel registro resta scritto che lo storico non e' + "' piu' completo", String(ultimoLog().messaggio || '').includes('storico conservato non piu' + "' completo"), ultimoLog().messaggio);
verifica("e il caricamento non si dichiara riuscito", esitoStoricoPerso.esito === 'parziale', esitoStoricoPerso.esito);

// SU UNA LETTURA DICHIARATA INAFFIDABILE NON SI AFFERMA CHE LO STORICO HA PERSO
// DELLE RIGHE. La lettura torna indietro di una riga e mostra un ordine
// conservato con una riga invece di due: in archivio ci sono tutte e due, e
// mandare a esportare l'intero storico dal portale per un guasto che non esiste
// e' la cosa peggiore che si possa dire qui. Il conteggio che smentisce le
// scritture confermate si butta, e con lui tutto quello che racconta.
const esitoLetturaIndietroStorico = await caricamento(() => {
  seminaStorico();
  gancio = async (corpo, esegui) => {
    const risposta = await esegui();
    if (corpo.azione === 'conta_esatta' && corpo.entita === 'PrimariaRete' && risposta.data && risposta.data.conteggi) {
      const conteggi = { ...risposta.data.conteggi, 'STO-00001': 1 };
      return { ...risposta, data: { ...risposta.data, righe: risposta.data.righe - 1, conteggi } };
    }
    return risposta;
  };
}, righeMiste);
verifica('in archivio le righe dello storico ci sono tutte', quanteRighe('STO-00001') === 2 && archivio('PrimariaRete').length === RIGHE_MISTE + STORICO_RIGHE, `${archivio('PrimariaRete').length} righe`);
verifica('e non si dichiara che lo storico ha perso delle righe', esitoLetturaIndietroStorico.avviso_storico_non_torna === null, JSON.stringify(esitoLetturaIndietroStorico.avviso_storico_non_torna));
verifica('si dice quello che e' + "' vero: la lettura non e' affidabile", (testoVerificaArchivio(esitoLetturaIndietroStorico) || {}).testo.includes("la lettura non e' affidabile"), JSON.stringify(testoVerificaArchivio(esitoLetturaIndietroStorico)));
verifica('e non si manda a ricaricare tutto dal primo anno per niente', !(testoVerificaArchivio(esitoLetturaIndietroStorico) || {}).testo.includes('ricaricare il file completo dal primo anno'));

// E QUANDO LA PERDITA E' VERA MA LA LETTURA NON LO PUO' DIMOSTRARE: la riga di
// storico sparisce davvero e il totale scende sotto le righe confermate. Il
// gestionale non puo' distinguere una perdita vera da una lettura in ritardo,
// e allora non afferma niente: il caricamento resta parziale, i moduli non si
// ricalcolano e si dice di ricaricare lo stesso file.
const esitoStoricoPersoSenzaProva = await caricamento(() => {
  seminaStorico();
  globalThis.__STORICO_ROTTO = false;
  gancio = async (corpo, esegui) => {
    const risposta = await esegui();
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete' && !globalThis.__STORICO_ROTTO) {
      globalThis.__STORICO_ROTTO = true;
      globalThis.__ARCHIVI.PrimariaRete = globalThis.__ARCHIVI.PrimariaRete.filter(r => r.id !== 'sto-STO-00001-2');
    }
    return risposta;
  };
}, righeMiste);
verifica('non si afferma niente su una lettura che smentisce le scritture', esitoStoricoPersoSenzaProva.avviso_storico_non_torna === null && !!esitoStoricoPersoSenzaProva.avviso_non_verificato, JSON.stringify(esitoStoricoPersoSenzaProva.avviso_storico_non_torna));
verifica('il caricamento resta parziale e i moduli non si ricalcolano', esitoStoricoPersoSenzaProva.esito === 'parziale' && moduliDaRicalcolare(esitoStoricoPersoSenzaProva) === false, esitoStoricoPersoSenzaProva.esito);

// L'ULTIMA RETE, LATO SERVER: la cancellazione mirata rifiuta gli ordini a cui
// il browser non dichiara nessuna riga nel file. Qui non ci deve arrivare mai
// niente - il freno vero e' nel browser - ma se il freno di la' si rompesse, di
// qua non si perde niente lo stesso.
globalThis.__ARCHIVI = { PrimariaRete: [rigaStorico('STO-00001'), rigaStorico('STO-00002')] };
registro = [];
gancio = null;
const frenoServer = await funzione({
  azione: 'cancella_ordini', tipo_file: 'primarie', entita: 'PrimariaRete',
  nome: 'Primarie RETE', ordini: ['STO-00001', 'STO-00002'],
  nel_file: { 'STO-00001': 0, 'STO-00002': 0 },
});
verifica('la cancellazione mirata rifiuta gli ordini che il file non porta', frenoServer.status === 200 && frenoServer.body.non_fatta === true && frenoServer.body.ordini_senza_file === 2, JSON.stringify(frenoServer.body));
verifica('e non ha toccato niente', frenoServer.body.dati_intatti === true && archivio('PrimariaRete').length === 2, String(archivio('PrimariaRete').length));
// Con gli ordini del file, invece, si cancella come sempre.
const frenoPassa = await funzione({
  azione: 'cancella_ordini', tipo_file: 'primarie', entita: 'PrimariaRete',
  nome: 'Primarie RETE', ordini: ['STO-00001'],
  nel_file: { 'STO-00001': 1 },
});
verifica('un ordine che il file porta si cancella come sempre', frenoPassa.body.cancellati === 1 && archivio('PrimariaRete').length === 1, JSON.stringify(frenoPassa.body));

// ---------------------------------------------------------------------------
console.log("(S2) LA RIPRESA DELLO SVUOTAMENTO NON PUO' GIRARE ALL'INFINITO");
// Un caricamento che deve fermarsi: l'errore si tiene, perche' e' proprio quello
// che si vuole leggere.
const caricamentoCheFallisce = async (prepara, righe = righeFile) => {
  try {
    await caricamento(prepara, righe);
    return Object.assign(new Error('il caricamento non si e' + "' fermato"), { data: {} });
  } catch (e) { return e; }
};

// "cancellati_ordini" sono gli ID che la function ha PASSATO a deleteMany, non
// le righe uscite: una piattaforma che accetta il filtro a lotti senza togliere
// niente risponde bene lo stesso. Con quel numero come prova di aver fatto dei
// progressi il ciclo non finiva mai - la barra scriveva "200 ordini tolti, si
// continua" all'infinito - e l'unica via d'uscita era chiudere la scheda, cioe'
// proprio il gesto che lascia l'archivio svuotato a meta'. L'unica prova buona
// e' che le righe rimaste siano SCESE.
let giriSvuota = 0;
// Se il ciclo non finisse, questa prova fallirebbe invece di non finire mai.
const TETTO_DI_PROVA = 60;
const esitoRipresaInfinita = await caricamentoCheFallisce(() => {
  seminaStorico();
  gancio = async (corpo, esegui) => {
    if (corpo.azione === 'svuota' && corpo.entita === 'PrimariaRete') {
      giriSvuota++;
      if (giriSvuota > TETTO_DI_PROVA) throw Object.assign(new Error('il ciclo di svuotamento non finisce mai'), { status: 400, data: { dati_intatti: false } });
      // dice di aver tolto duecento ordini e non ne toglie nemmeno uno
      return { status: 200, data: { svuotato: false, entita: 'PrimariaRete', conservati: STORICO_RIGHE, ripartire: true, cancellati_ordini: 200 } };
    }
    return esegui();
  };
}, righeMiste);
verifica('il ciclo finisce', giriSvuota <= TETTO_DI_PROVA, `${giriSvuota} svuotamenti`);
verifica("e si dice che lo svuotamento non e' riuscito", String(esitoRipresaInfinita.message).includes('Svuotamento') && String(esitoRipresaInfinita.message).includes('incompleto'), esitoRipresaInfinita.message);
verifica('senza dichiarare intatti dei dati che si e' + "' provato a togliere", esitoRipresaInfinita.data && esitoRipresaInfinita.data.dati_intatti === false, JSON.stringify(esitoRipresaInfinita.data));

// E UNA RIPRESA CHE VA AVANTI DAVVERO NON CONSUMA I TENTATIVI: la function si
// ferma al dodicesimo secondo, dice che non ha finito, e il giro dopo riprende
// da dove era arrivata. Qui le riprese sono piu' dei ritentativi disponibili,
// per far vedere che una ripresa non e' un ritentativo.
const DA_TOGLIERE = 8;
let giriRipresa = 0;
const esitoRipresaVera = await caricamento(() => {
  globalThis.__ARCHIVI.PrimariaRete = [
    rigaStorico('STO-00001'),
    ...Array.from({ length: DA_TOGLIERE }, (_, i) => ({
      id: 'vec-' + i, id_ordine: 'VEC-' + i, stato: 'cancellato', ordine_immesso_il: '2024-03-01T08:00:00Z',
    })),
  ];
  gancio = async (corpo, esegui) => {
    if (corpo.azione === 'svuota' && corpo.entita === 'PrimariaRete') {
      const dentro = globalThis.__ARCHIVI.PrimariaRete;
      const quale = dentro.findIndex(r => String(r.id_ordine).startsWith('VEC-'));
      if (quale >= 0) {
        giriRipresa++;
        dentro.splice(quale, 1);   // ne toglie uno per giro e dice che non ha finito
        return { status: 200, data: { svuotato: false, entita: 'PrimariaRete', conservati: 1, ripartire: true, cancellati_ordini: 1 } };
      }
    }
    return esegui();
  };
}, righeMiste);
verifica('una ripresa che toglie davvero va avanti oltre i ritentativi', giriRipresa === DA_TOGLIERE, `${giriRipresa} riprese`);
verifica('e il caricamento arriva in fondo', esitoRipresaVera.esito === 'successo' && archivio('PrimariaRete').length === RIGHE_MISTE + 1, `${esitoRipresaVera.esito} — ${archivio('PrimariaRete').length} righe`);

// ---------------------------------------------------------------------------
console.log('(S3) "NESSUN DATO MODIFICATO" SOLO SE NON SI E' + "' TOCCATO NIENTE");
// Gli archivi si svuotano e si riscrivono UNO PER VOLTA. Quando il filtro per ID
// non regge sul SECONDO, il primo e' gia' stato svuotato e riscritto col file
// nuovo: la finestra chiudeva in verde con "questo tentativo non ha modificato
// ne' cancellato nessun dato", che e' falso, e chi legge quella frase non
// ricarica - consulta un archivio mezzo nuovo e mezzo vecchio. Il server sa dire
// solo della propria invocazione: il conto del caricamento intero lo tiene il
// browser.
const filtroNonRegge = (entita) => ({
  status: 200,
  data: {
    svuotato: false, entita, non_fatta: true, dati_intatti: true,
    motivo: "Il filtro per ID non e' affidabile: l'archivio non e' stato toccato. Per ora serve un caricamento completo, dal primo anno.",
  },
});
const erroreSulSecondo = await caricamentoCheFallisce(() => {
  seminaStorico();
  gancio = async (corpo, esegui) => (corpo.azione === 'svuota' && corpo.entita === 'PrimariaAci'
    ? filtroNonRegge('PrimariaAci')
    : esegui());
}, righeMiste);
verifica('Primarie RETE e' + "' gia' stata svuotata e riscritta", archivio('PrimariaRete').length === RIGHE_MISTE + STORICO_RIGHE, `${archivio('PrimariaRete').length} righe`);
verifica('e non si dichiara che non si e' + "' modificato niente", erroreSulSecondo.data && erroreSulSecondo.data.dati_intatti === false, JSON.stringify(erroreSulSecondo.data));
verifica('la frase dice il rimedio e che gli altri archivi sono gia' + "' riscritti", String(erroreSulSecondo.message).includes('caricamento completo, dal primo anno') && String(erroreSulSecondo.message).includes('ricarica il file'), erroreSulSecondo.message);
// E SUL PRIMO ARCHIVIO LA FRASE RESTA QUELLA GIUSTA: li' non si e' toccato
// niente davvero, e dirlo e' l'unica cosa che evita un secondo tentativo uguale.
const erroreSulPrimo = await caricamentoCheFallisce(() => {
  seminaStorico();
  gancio = async (corpo, esegui) => (corpo.azione === 'svuota' && corpo.entita === 'PrimariaRete'
    ? filtroNonRegge('PrimariaRete')
    : esegui());
}, righeMiste);
verifica('sul primo archivio non si e' + "' toccato niente, e si dice", erroreSulPrimo.data && erroreSulPrimo.data.dati_intatti === true, JSON.stringify(erroreSulPrimo.data));
verifica("e l'archivio e' rimasto com'era", archivio('PrimariaRete').length === 6, `${archivio('PrimariaRete').length} righe`);

// ---------------------------------------------------------------------------
console.log("(S4) LE PAGINE DELL'ARCHIVIO SI LEGGONO IN ORDINE DI id");
// La regola sta in base44/shared/fetchAll.ts: le pagine si leggono sempre in
// ordine di id, l'unico ordinamento unico, e si deduplica. Con id_ordine - che
// lo stesso ordine ha su piu' righe - le righe pari si scambiano di posto fra
// una pagina e l'altra: il 15/09/2026 sono state 44 doppioni e 44 mancanti su
// 10.543 primarie.
//
// Qui non e' un dettaglio di prestazioni: da questa lettura esce il conto delle
// righe di CIASCUN ordine conservato, che fa da metro al confronto ordine per
// ordine di fine caricamento. Una riga letta due volte diventa un rosso "ci sono
// righe di troppo, quei pesi si contano doppi"; una saltata, un "lo storico
// conservato non torna" - e in tutti e due i casi i ricalcoli restano fermi.
const ORDINI_STORICI = 550;               // due righe ciascuno: 1.100 righe, piu' di una pagina corta
const seminaStoricoGrande = () => {
  globalThis.__ARCHIVI = {
    PrimariaRete: Array.from({ length: ORDINI_STORICI * 2 }, (_, i) => ({
      id: 'sto' + String(i).padStart(5, '0'),
      id_ordine: 'STO-' + String(Math.floor(i / 2)).padStart(5, '0'),
      stato: 'terminato', trasporto_finito_il: '2024-06-10T08:00:00Z', ordine_immesso_il: '2024-05-01T08:00:00Z',
    })),
  };
};
const tutteTornano = (corpo) => {
  const c = corpo && corpo.conservati && corpo.conservati.PrimariaRete;
  return !!c && c.righe === ORDINI_STORICI * 2 && c.ordini === ORDINI_STORICI
    && Object.keys(c.per_ordine).length === ORDINI_STORICI
    && Object.values(c.per_ordine).every(v => v === 2);
};
globalThis.__PAGINE_CORTE = 1000;
globalThis.__ORDINE_INSTABILE = true;
seminaStoricoGrande();
const prepInstabile = await preparazione();
verifica("con un ordinamento non unico una riga si perde: con 'id' no", tutteTornano(prepInstabile.body), JSON.stringify({ righe: prepInstabile.body.conservati && prepInstabile.body.conservati.PrimariaRete.righe, attese: ORDINI_STORICI * 2 }));
globalThis.__ORDINE_INSTABILE = false;
globalThis.__PAGINE_SOVRAPPOSTE = true;
seminaStoricoGrande();
const prepSovrapposte = await preparazione();
verifica('e una riga servita due volte non si conta due volte', tutteTornano(prepSovrapposte.body), JSON.stringify({ righe: prepSovrapposte.body.conservati && prepSovrapposte.body.conservati.PrimariaRete.righe, attese: ORDINI_STORICI * 2 }));
// E lo stesso vale per lo svuotamento, che rilegge l'archivio con la stessa
// lettura: una riga conservata che la lettura salta viene cancellata per sempre.
seminaStoricoGrande();
const svuotaSovrapposte = await funzione({ azione: 'svuota', tipo_file: 'primarie', entita: 'PrimariaRete', nome: 'Primarie RETE', ids });
verifica('e lo svuotamento conserva tutte le righe che deve conservare', svuotaSovrapposte.body.conservati === ORDINI_STORICI * 2 && archivio('PrimariaRete').length === ORDINI_STORICI * 2, `${svuotaSovrapposte.body.conservati} conservate, ${archivio('PrimariaRete').length} righe`);
globalThis.__PAGINE_CORTE = 0;
globalThis.__PAGINE_SOVRAPPOSTE = false;

// ---------------------------------------------------------------------------
console.log("(S5) IL VERDE CHE MENTE: sopra un archivio gia' riscritto non si dice");
// "Nessun dato modificato" si dice del CARICAMENTO, non dell'invocazione, e va
// detto su TUTTE le porte da cui un errore puo' uscire, non su una sola. La
// bandierina era consultata solo sul ramo "non fatta" dello svuotamento (S3):
// da tutte le altre l'errore del server usciva tale e quale, col suo
// dati_intatti a vero - e la finestra stampava in verde, con lo scudo, "questo
// tentativo non ha modificato ne' cancellato nessun dato" sopra un archivio
// appena svuotato e riscritto. Chi legge quella frase non ricarica.
//
// Un 401: la sessione scade mentre si carica, e un caricamento di primarie dura
// minuti. Il browser non lo ritenta, e il server - che sa dire solo della
// PROPRIA invocazione - risponde in buona fede "io non ho toccato niente".
const sessioneScaduta = () => Object.assign(new Error('Sessione scaduta'), {
  status: 401, data: { error: 'Sessione scaduta', dati_intatti: true },
});

// (a) LA PORTA PIU' RAGGIUNGIBILE: la registrazione finale, a caricamento GIA'
// COMPLETATO e archivio interamente riscritto. Quella invocazione non tocca
// niente davvero, quindi il server ha ragione a dire che i dati sono intatti.
const err401Registra = await caricamentoCheFallisce(() => {
  seminaStorico();
  gancio = async (corpo, esegui) => {
    if (corpo.azione === 'registra') throw sessioneScaduta();
    return esegui();
  };
}, righeMiste);
verifica("l'archivio era stato interamente riscritto", archivio('PrimariaRete').length === RIGHE_MISTE + STORICO_RIGHE, `${archivio('PrimariaRete').length} righe`);
verifica('e non si dichiara che non e' + "' stato modificato niente", err401Registra.data && err401Registra.data.dati_intatti === false, JSON.stringify(err401Registra.data));
verifica('il messaggio e lo stato del server restano quelli', err401Registra.status === 401 && String(err401Registra.message).includes('Sessione scaduta'), `${err401Registra.status} — ${err401Registra.message}`);

// (b) LO SVUOTAMENTO DEL SECONDO ARCHIVIO: il primo e' gia' riscritto col file nuovo.
const err401Aci = await caricamentoCheFallisce(() => {
  seminaStorico();
  gancio = async (corpo, esegui) => {
    if (corpo.azione === 'svuota' && corpo.entita === 'PrimariaAci') throw sessioneScaduta();
    return esegui();
  };
}, righeMiste);
verifica('Primarie RETE era gia' + "' svuotata e riscritta", archivio('PrimariaRete').length === RIGHE_MISTE + STORICO_RIGHE, `${archivio('PrimariaRete').length} righe`);
verifica('e il verde non esce nemmeno da quella porta', err401Aci.data && err401Aci.data.dati_intatti === false, JSON.stringify(err401Aci.data));

// (c) LA SCRITTURA, ad archivio appena svuotato: dentro restano solo le righe
// dello storico conservato, e il file non e' entrato.
const err401Scrivi = await caricamentoCheFallisce(() => {
  seminaStorico();
  gancio = async (corpo, esegui) => {
    if (corpo.azione === 'scrivi' && corpo.entita === 'PrimariaRete') throw sessioneScaduta();
    return esegui();
  };
}, righeMiste);
verifica("in archivio restano solo le righe dello storico", archivio('PrimariaRete').length === STORICO_RIGHE, `${archivio('PrimariaRete').length} righe`);
verifica('e nemmeno li' + "' si dice che i dati sono intatti", err401Scrivi.data && err401Scrivi.data.dati_intatti === false, JSON.stringify(err401Scrivi.data));

// (d) E NON SI GRIDA AL LUPO: sullo svuotamento del PRIMO archivio non si e'
// toccato niente davvero, e dirlo e' l'unica cosa che evita un secondo
// tentativo uguale.
const err401Primo = await caricamentoCheFallisce(() => {
  seminaStorico();
  gancio = async (corpo, esegui) => {
    if (corpo.azione === 'svuota' && corpo.entita === 'PrimariaRete') throw sessioneScaduta();
    return esegui();
  };
}, righeMiste);
verifica("l'archivio e' rimasto com'era", archivio('PrimariaRete').length === 6, `${archivio('PrimariaRete').length} righe`);
verifica('e quando non si e' + "' toccato niente il verde resta", err401Primo.data && err401Primo.data.dati_intatti === true, JSON.stringify(err401Primo.data));

// ---------------------------------------------------------------------------
console.log("(S6) UNA PREPARAZIONE MUTA NON PUO' FAR CANCELLARE LO STORICO");
// Se la preparazione non risponde i conservati - campo assente, oppure a zero:
// una scheda vecchia contro una function nuova, o una lettura dell'archivio
// tornata vuota per un attimo - il browser non mandava gli ID allo svuotamento,
// e senza ID la svuota fa il deleteMany di TUTTO: quattro righe di storico su
// quattro cancellate, esito "successo", ricalcoli partiti, nessun avviso e nel
// registro nemmeno una parola. E' il caso peggiore che ci sia, dati persi con la
// spunta verde. Adesso per gli archivi che HANNO uno storico gli ID si mandano
// SEMPRE, e la svuota ricalcola per conto suo che cosa conservare.
const senzaConservati = { PrimariaRete: { ordini: 0, righe: 0, per_ordine: {} }, PrimariaAci: { ordini: 0, righe: 0, per_ordine: {} } };
for (const comeRisponde of ['senza il campo conservati', 'con i conservati a zero']) {
  let idsMandati = null;
  const preparazioneMuta = await caricamentoCheFallisce(() => {
    seminaStorico();
    gancio = async (corpo, esegui) => {
      if (corpo.azione === 'svuota' && corpo.entita === 'PrimariaRete') idsMandati = corpo.ids;
      const res = await esegui();
      if (corpo.azione !== 'prepara') return res;
      const dati = { ...res.data };
      if (comeRisponde === 'senza il campo conservati') delete dati.conservati;
      else dati.conservati = senzaConservati;
      return { ...res, data: dati };
    };
  }, righeMiste);
  verifica(`${comeRisponde}: gli ID del file si mandano lo stesso`, Array.isArray(idsMandati) && idsMandati.length === ORDINI_MISTI, `${idsMandati && idsMandati.length} ID`);
  verifica(`${comeRisponde}: le righe dello storico sono ancora tutte in archivio`, quanteRighe('STO-00001') === 2 && quanteRighe('STO-00002') === 1 && quanteRighe('STO-00003') === 1, JSON.stringify(['STO-00001', 'STO-00002', 'STO-00003'].map(id => [id, quanteRighe(id)])));
  verifica(`${comeRisponde}: il caricamento non si chiude come riuscito`, String(preparazioneMuta.message).includes('Svuotamento') && String(preparazioneMuta.message).includes('Primarie RETE'), preparazioneMuta.message);
  verifica(`${comeRisponde}: e si dice che le due letture dell'archivio non tornano`, String(preparazioneMuta.message).includes('non tornano') && String(preparazioneMuta.message).includes(String(STORICO_RIGHE)), preparazioneMuta.message);
  verifica(`${comeRisponde}: senza dichiarare intatti dei dati toccati`, preparazioneMuta.data && preparazioneMuta.data.dati_intatti === false, JSON.stringify(preparazioneMuta.data));
}

// E IL CONTROLLO ESPLICITO: se lo svuotamento di un archivio che HA uno storico
// arriva a ZERO righe rimaste, quello storico e' stato cancellato. E' un caso da
// DICHIARARE, non da chiudere come riuscito e non da ritentare alla cieca: il
// file non contiene quelle righe e nessuno puo' rimetterle, l'unico rimedio e'
// un caricamento completo dal primo anno. Qui la piattaforma porta via tutto
// mentre la risposta dice, in buona fede, di aver conservato lo storico.
const storicoSpazzato = await caricamentoCheFallisce(() => {
  seminaStorico();
  gancio = async (corpo, esegui) => {
    if (corpo.azione === 'svuota' && corpo.entita === 'PrimariaRete') {
      globalThis.__ARCHIVI.PrimariaRete = [];
      return { status: 200, data: { svuotato: true, entita: 'PrimariaRete', conservati: STORICO_RIGHE, cancellati_ordini: 2 } };
    }
    return esegui();
  };
}, righeMiste);
verifica('un archivio con storico rimasto senza nessuna riga si dichiara', String(storicoSpazzato.message).includes("non e' rimasta nessuna riga") && String(storicoSpazzato.message).includes("Lo storico conservato non c'e' piu'"), storicoSpazzato.message);
verifica('e si dice subito, senza ritentare alla cieca', quante('svuota PrimariaRete') === 1, `${quante('svuota PrimariaRete')} svuotamenti`);
verifica('senza dichiarare intatti dei dati cancellati', storicoSpazzato.data && storicoSpazzato.data.dati_intatti === false, JSON.stringify(storicoSpazzato.data));
verifica('e il file non si riscrive sopra uno storico perso', archivio('PrimariaRete').length === 0, `${archivio('PrimariaRete').length} righe`);

// (S7) L'ALLARME PIU' GROSSO NON SI DA' SU UNA LETTURA SOLA
// E' la regola di tutto questo file, e vale soprattutto qui: dichiarare lo
// storico perduto manda qualcuno a rifare un export di piu' anni, che il portale
// non da' facilmente. Ma un conteggio puo' tornare vuoto per un attimo - e' lo
// stesso guasto contro cui il controllo dello zero e' stato scritto - e con una
// lettura sola il caricamento si fermava gridando che lo storico non c'era piu'
// mentre era tutto al suo posto. Adesso, prima di dichiarare, si guarda una
// seconda volta dopo la pausa.
console.log("(S7) LO STORICO PERDUTO NON SI DICHIARA SU UNA LETTURA SOLA");
let contaVuoteRimaste = 1;
const zeroDiPassaggio = await caricamento(() => {
  seminaStorico();
  // La lettura vuota si arma SOLO dopo lo svuotamento, cosi' cade esattamente
  // sul conteggio che decide se lo storico c'e' ancora, e non su una lettura
  // qualunque di prima: se cadesse altrove la prova passerebbe senza provare
  // niente.
  contaVuoteRimaste = 0;
  gancio = async (corpo, esegui) => {
    if (corpo.azione === 'svuota' && corpo.entita === 'PrimariaRete') {
      const r = await esegui();
      contaVuoteRimaste = 1;
      return r;
    }
    if (corpo.azione === 'conta' && corpo.entita === 'PrimariaRete' && contaVuoteRimaste > 0) {
      contaVuoteRimaste--;
      return { status: 200, data: { conteggio: 0 } };
    }
    return esegui();
  };
}, righeMiste);
verifica('la seconda lettura ritrova lo storico e il caricamento va avanti', zeroDiPassaggio.esito === 'successo', zeroDiPassaggio.esito);
verifica('nessuno dichiara lo storico perduto', !JSON.stringify(zeroDiPassaggio).includes("Lo storico conservato non c'e' piu'"), JSON.stringify(zeroDiPassaggio).slice(0, 200));
verifica('e le righe dello storico sono tutte ancora in archivio',
  archivio('PrimariaRete').filter(r => String(r.id_ordine || '').startsWith('STO-')).length === STORICO_RIGHE,
  `${archivio('PrimariaRete').filter(r => String(r.id_ordine || '').startsWith('STO-')).length} righe di storico`);
// E quando lo storico e' perso DAVVERO - tutte e due le letture dicono zero -
// l'allarme esce comunque: la seconda occhiata non e' un modo per tacere.
verifica('ma se lo storico e\' perso davvero l\'allarme esce lo stesso', String(storicoSpazzato.message).includes("Lo storico conservato non c'e' piu'"), storicoSpazzato.message);

// ---------------------------------------------------------------------------
console.log(`\n${ok} prove superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
