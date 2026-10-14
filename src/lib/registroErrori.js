// IL REGISTRO DEGLI ERRORI DEL SITO (migliorie del 14/10/2026, approvate
// dall'utente: «per me ok sulle cose da sistemare, sulla velocità e su quanto da
// creare, procedi pure»).
//
// Il fatto: un errore di rete o una pagina che si rompe, visti da un collega,
// l'amministratore li scopriva solo se il collega glielo diceva. Qui le pagine
// annotano da se' gli errori che incontrano nell'archivio ErroreSito
// (base44/entities/ErroreSito.jsonc):
// - una pagina che si rompe: PageErrorBoundary chiama segnalaErrorePagina;
// - un errore che nessuno ha preso: window «error» e «unhandledrejection»;
// - una chiamata a una funzione o a un archivio che non riesce (429, rete, 5xx,
//   4xx): agganciaChiamate, sul client di tutte le pagine, lo stesso punto in cui
//   permessi.js mette la sua guardia sulle scritture.
// L'amministratore li legge in Alert & Controllo, «Errori del sito»
// (src/components/alerts/ErroriSito.jsx), e la dashboard gli dice in «Da
// gestire» quanti ne sono arrivati da ieri (vociErroriSito, cruscotto.ts).
//
// IL FRENO. Il registro non deve mai peggiorare quello che annota:
// - un errore uguale nella stessa sessione si CONTA, non si riscrive: la riga
//   dopo, dello stesso errore, aspetta MINUTI_FRA_RIGHE_UGUALI, attese che
//   crescono (2, 10, 30 minuti, poi un'ora, due, quattro), col numero delle
//   volte di intanto; al piu' MASSIMO_RIGHE_PER_ERRORE righe al giorno per lo
//   stesso errore, cosi' un errore che si ripete per ore non si mangia le righe
//   degli altri (revisione del 15/10/2026: con una riga ogni 30 minuti un errore
//   solo esauriva il registro in dieci ore);
// - al massimo MASSIMO_RIGHE_PER_SESSIONE righe al giorno per sessione (una
//   scheda del browser: la memoria sta in sessionStorage, cosi' «Ricarica app»
//   dopo una pagina rotta non riparte da zero e la riga in attesa non si perde).
//   Il conto riparte quando cambia il giorno italiano: il gestionale installato
//   come applicazione resta aperto per giorni nella stessa finestra;
// - una scrittura per volta, distanziate di SPAZIO_FRA_SCRITTURE_MS. Un errore
//   nuovo non aspetta dietro a uno ripetuto: se la sua riga e' pronta prima, il
//   timer si rifissa (revisione del 15/10/2026: una pagina rotta restava in coda
//   fino a 30 minuti dietro a un errore di rete ripetuto);
// - quando la scheda va in secondo piano o si chiude (visibilitychange,
//   pagehide) le righe in attesa si scrivono subito, una volta, senza le attese
//   dello stesso errore ma con almeno due minuti fra due righe uguali:
//   altrimenti le volte contate dopo l'ultima riga se ne andavano con la
//   scheda, e all'amministratore arrivava «una volta» per un errore successo
//   quaranta. Poi, anche in secondo piano, tornano le attese di sempre;
// - dopo un 429 (il limite di richieste della piattaforma, che vale per tutta
//   l'app insieme) non si scrive niente per ATTESA_DOPO_UN_LIMITE_MS: oltre la
//   finestra di un minuto. Il 429 si vede a OGNI tentativo, anche quelli che il
//   limite di richieste (limiteRichieste.js) poi ripete: un ciclo che fallisce
//   per il limite non provoca nessuna scrittura finche' non si calma, nemmeno
//   in secondo piano;
// - se la scrittura dell'errore fallisce non si registra niente e non si rompe
//   niente: la riga si perde, e con un rifiuto (401, 403, 400, archivio che non
//   c'e') il registro si spegne per la sessione. La scrittura del registro fa un
//   tentativo solo, sull'archivio crudo, senza i ritentativi del limite di
//   richieste: un 429 la perde e fa aspettare il registro, mai cinque richieste
//   in piu' dentro una finestra gia' piena. Le chiamate all'archivio ErroreSito
//   non passano mai dalla cattura, quindi un errore del registro non diventa un
//   altro errore del registro.
// Le chiamate fallite si annotano DOPO i ritentativi del limite di richieste:
// un 429 che poi riesce non e' un errore del sito, ma ferma lo stesso il
// registro per due minuti.
//
// CHE COSA NON SI SCRIVE MAI. Della pagina solo il percorso: mai la query string
// ne' l'hash, dove possono stare un token o un filtro. Il messaggio passa da una
// funzione sola, pulisciMessaggio: niente token, email, indirizzi coi parametri,
// contenuti di file, codici lunghi, e nemmeno il nome della piattaforma (nessun
// riferimento visibile, regola dell'utente). Chi ha visto l'errore lo dice la
// piattaforma: created_by_id, che riempie lei e che la lettura restituisce
// sempre (created_by, l'email, spesso no: la scheda dell'amministratore risale
// all'email con una lettura sola degli utenti, raggruppaErrori).
//
// Gli import sono relativi e il file non tocca window in testa: le prove lo
// caricano direttamente in node (prove/registroErrori.mjs).
import { giornoRoma, oggiRoma } from './giornoItaliano.js';

export const ARCHIVIO_ERRORI = 'ErroreSito';
// Al giorno, per sessione: il conto riparte col giorno italiano.
export const MASSIMO_RIGHE_PER_SESSIONE = 20;
export const MASSIMO_RIGHE_PER_ERRORE = 8;
// Le attese fra due righe dello stesso errore: dopo la prima riga 2 minuti, dopo
// la seconda 10, poi 30, 60, 120 e da li' 240.
export const MINUTI_FRA_RIGHE_UGUALI = [2, 10, 30, 60, 120, 240];
export const ATTESA_PRIMA_DI_SCRIVERE_MS = 1500;
export const SPAZIO_FRA_SCRITTURE_MS = 3000;
export const ATTESA_DOPO_UN_LIMITE_MS = 2 * 60 * 1000;
// Quando la scheda va in secondo piano: quante righe insieme, al piu'.
export const MASSIMO_RIGHE_IN_USCITA = 5;
export const LUNGHEZZA_MESSAGGIO = 300;
// La conservazione a 40 giorni (AGENTS.md): le righe piu' vecchie le toglie
// l'amministratore dalla pagina, mai una cancellazione automatica.
export const GIORNI_DI_CONSERVAZIONE = 40;

export const NOMI_TIPI = {
  pagina: 'Pagina che si rompe',
  non_preso: 'Errore non preso',
  limite: 'Troppe richieste (429)',
  rete: 'Rete',
  server: 'Errore del server (5xx)',
  richiesta: 'Richiesta rifiutata (4xx)',
};

// ─── La pulizia del messaggio: una funzione sola ───

const tagliaA = (s, n) => (s.length > n ? `${s.slice(0, Math.max(1, n - 1)).trimEnd()}…` : s);

/** Il testo di un errore qualunque: il messaggio di un Error, una stringa, il campo error di una risposta. */
export function testoDi(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'object') {
    if (typeof v.message === 'string' && v.message) return v.message;
    if (typeof v.error === 'string' && v.error) return v.error;
    if (v.error && typeof v.error.message === 'string') return v.error.message;
    // Un oggetto senza messaggio non si trascrive: dentro ci possono essere dati.
    return '';
  }
  return String(v);
}

// Le estensioni che dicono un documento, non un pezzo del codice: un indirizzo
// che finisce cosi' e' un file, e il suo percorso puo' essere la chiave per
// aprirlo (AGENTS.md, «Il file_uri e' la chiave del documento»).
const ESTENSIONI_DI_CODICE = new Set(['js', 'mjs', 'jsx', 'ts', 'css', 'html', 'map']);

/** Di un indirizzo resta il percorso: niente dominio, query string, hash. Un file diventa «[file]». */
export function percorsoDi(indirizzo) {
  const s = String(indirizzo || '').trim();
  if (!s) return '';
  if (/^(data|blob):/i.test(s)) return '[file]';
  if (/^[a-z][\w+.-]*:\/\//i.test(s) && !/^(https?|wss?):\/\//i.test(s)) return '[file]';
  let p;
  try { p = new URL(s, 'http://indirizzo.invalid').pathname; } catch (_e) { p = s.replace(/^[a-z][\w+.-]*:\/\/[^/?#]*/i, ''); }
  p = String(p || '').split(/[?#]/)[0] || '/';
  const est = (p.match(/\.([a-z0-9]{2,5})$/i) || [])[1];
  if (est && !ESTENSIONI_DI_CODICE.has(est.toLowerCase())) return '[file]';
  return p;
}

/**
 * IL MESSAGGIO RIPULITO. Toglie, nell'ordine: caratteri di controllo, contenuti
 * di file (data: e blob:), token (JWT, Bearer, chiave=valore delle chiavi
 * sensibili), indirizzi (resta il percorso), query string rimaste attaccate a un
 * percorso, email, i dati dentro gli errori di validazione (input_value=...),
 * testi lunghi fra virgolette, codici lunghi (identificativi, chiavi), il nome
 * della piattaforma. Al piu' `massimo` caratteri.
 */
export function pulisciMessaggio(valore, massimo = LUNGHEZZA_MESSAGGIO) {
  let s = testoDi(valore);
  if (!s) return '';
  s = s.replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ');
  s = s.replace(/\b(?:data|blob):[^\s"'<>`]*/gi, '[file]');
  s = s.replace(/\beyJ[\w-]{4,}\.[\w-]{4,}(?:\.[\w-]*)?/g, '[token]');
  s = s.replace(/\b(Bearer|Basic|Token)\s+[\w.~+/=-]{8,}/gi, '$1 [token]');
  s = s.replace(/\b[a-z][\w+.-]*:\/\/[^\s"'<>`]+/gi, (u) => {
    const coda = (u.match(/[).,;:!]+$/) || [''])[0];
    return percorsoDi(coda ? u.slice(0, -coda.length) : u) + coda;
  });
  // Anche scritte in JSON («"password":"..."»), che e' la forma in cui il corpo
  // di una richiesta o di una risposta finisce dentro un errore (revisione del
  // 15/10/2026).
  s = s.replace(/(["']?)\b(access_token|refresh_token|id_token|token|api[_-]?key|password|passwd|pwd|secret|signature|x-amz-[\w-]+|sig|session(?:_?id)?)\1(\s*[=:]\s*)("[^"]*"|'[^']*'|[^\s&,;)}\]]+)/gi, '$1$2$1$3[tolto]');
  s = s.replace(/(\/[^\s?#"'<>]*)[?#][^\s"'<>]*/g, '$1');
  s = s.replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[email]');
  s = s.replace(/\binput_value=(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|\{[^}]*\}|\[[^\]]*\]|[^,\]\s]+)/g, 'input_value=[dato]');
  s = s.replace(/"[^"]{60,}"/g, '"[testo]"').replace(/'[^']{60,}'/g, "'[testo]'").replace(/«[^»]{60,}»/g, '«[testo]»');
  s = s.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[codice]');
  s = s.replace(/\b[0-9a-f]{16,}\b/gi, (t) => (/\d/.test(t) ? '[codice]' : t));
  // Un codice a caso ha maiuscole, minuscole e cifre insieme e niente trattini
  // bassi: i nomi dei file (PRIMARIE_RETE_2026) restano.
  s = s.replace(/\b[A-Za-z0-9-]{24,}\b/g, (t) => (/\d/.test(t) && /[A-Z]/.test(t) && /[a-z]/.test(t) ? '[codice]' : t));
  s = s.replace(/\[?\bBase44 SDK(?: Error)?\]?:?\s*/gi, '').replace(/\bBase44Error\b/g, 'Errore').replace(/base44/gi, 'piattaforma');
  s = s.replace(/\s+/g, ' ').trim();
  return tagliaA(s, massimo);
}

/** La pagina: solo il percorso, mai la query string ne' l'hash. */
export function paginaDi(posizione) {
  const p = posizione && typeof posizione === 'object' ? posizione.pathname : posizione;
  const s = String(p || '/').split(/[?#]/)[0] || '/';
  return pulisciMessaggio(s, 120) || '/';
}

/** Le prime righe della pila di un errore, coi soli percorsi dei file: «dove». */
export function dovePila(errore) {
  const pila = errore && typeof errore.stack === 'string' ? errore.stack : '';
  if (!pila) return '';
  const righe = pila.split('\n').map(r => r.trim()).filter(r => /^at\s|@/.test(r)).slice(0, 3)
    .map(r => r.replace(/\(?\b([a-z][\w+.-]*:\/\/[^\s)]+?)(:\d+:\d+)?\)?$/i, (_m, u, pos) => ` ${percorsoDi(u)}${pos || ''}`).replace(/^at\s+/, ''));
  return pulisciMessaggio(righe.join(' ← '), LUNGHEZZA_MESSAGGIO);
}

// ─── Che cosa e' una chiamata fallita ───

const statoDi = (e) => {
  const s = Number(e && (e.status ?? (e.response && e.response.status)));
  return Number.isFinite(s) && s > 0 ? s : null;
};
const corpoDi = (e) => (e && e.response && e.response.data !== undefined ? e.response.data : e && e.data);
const RETE = /network ?error|failed to fetch|load failed|networkerror|timeout|timed out|econn|enotfound|err_network|err_internet|socket hang up|request aborted/i;
// Il messaggio della guardia del browser (permessi.js) e quello del server: una
// scelta dei permessi, non un guasto.
const SOLA_LETTURA = /riservata all'amministratore/i;

function messaggioDellaRisposta(e, corpo) {
  let dalCorpo = '';
  if (corpo && typeof corpo === 'object') dalCorpo = testoDi(corpo.error !== undefined ? corpo : { message: corpo.message || corpo.detail });
  // Una pagina html (un 502 di chi sta in mezzo) non e' un messaggio.
  else if (typeof corpo === 'string' && corpo.length < 500 && !/^\s*</.test(corpo)) dalCorpo = corpo;
  return pulisciMessaggio(dalCorpo || testoDi(e) || 'Richiesta non riuscita');
}

/**
 * Il tipo di una chiamata fallita, o null se non e' un errore del sito:
 * - annullata (si e' cambiata pagina), 401 (la sessione e' scaduta: lo dice
 *   l'accesso, e una riga non si potrebbe nemmeno scrivere);
 * - le risposte che il gestionale da' apposta e la pagina spiega: il 409
 *   «rinviato» con un caricamento a meta' (rispostaRinviata, statoArchivi.ts),
 *   il 403 della sola lettura (rispostaSolaLettura, permessi.ts) e le due di
 *   apriFile (revisione del 15/10/2026): il 404 «senza_file», un documento
 *   oltre i quaranta giorni della conservazione, e il 403 «riservato», un file
 *   dell'amministratore. Altrimenti ogni clic su un documento vecchio diventava
 *   un errore del sito e una voce di «Da gestire».
 * Gli altri: limite (429), rete (nessuna risposta), server (5xx), richiesta (4xx).
 */
const RISPOSTE_APPOSTA = ['rinviato', 'sola_lettura', 'senza_file', 'riservato'];
export function classificaErroreChiamata(e) {
  if (!e) return null;
  const codice = String((e && (e.code || (e.originalError && e.originalError.code))) || '');
  const nome = String((e && e.name) || '');
  if (codice === 'ERR_CANCELED' || nome === 'CanceledError' || nome === 'AbortError') return null;
  const stato = statoDi(e);
  const corpo = corpoDi(e);
  if (corpo && typeof corpo === 'object' && RISPOSTE_APPOSTA.some(k => corpo[k] === true)) return null;
  if (stato === 401) return null;
  const messaggio = messaggioDellaRisposta(e, corpo);
  if (SOLA_LETTURA.test(messaggio)) return null;
  if (stato === 429 || (!stato && /rate limit|too many requests/i.test(messaggio))) return { tipo: 'limite', stato_http: 429, messaggio };
  if (!stato) return { tipo: RETE.test(messaggio) || /ERR_NETWORK|ECONNABORTED|ETIMEDOUT/.test(codice) ? 'rete' : 'richiesta', stato_http: null, messaggio };
  if (stato >= 500) return { tipo: 'server', stato_http: stato, messaggio };
  if (stato >= 400) return { tipo: 'richiesta', stato_http: stato, messaggio };
  return null;
}

// ─── Il registro: conta, frena, scrive ───

/** La chiave dell'errore uguale: tipo, chiamata, pagina e messaggio (le cifre lunghe non contano). */
export function improntaDi(r) {
  const x = r || {};
  return [x.tipo || '', x.coinvolto_tipo || '', x.coinvolto || '', x.pagina || '', String(x.messaggio || '').replace(/\d{4,}/g, '#')]
    .join('|').slice(0, 500);
}

const nuovaSessione = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const statoHttpDi = (e) => statoDi(e);

/** La memoria della sessione nel sessionStorage della scheda: dentro un try, perche' puo' mancare. */
export function memoriaDiSessione(finestra, chiave = 'treadrider.registroErrori') {
  return {
    leggi: () => { try { const s = finestra && finestra.sessionStorage ? finestra.sessionStorage.getItem(chiave) : null; return s ? JSON.parse(s) : null; } catch (_e) { return null; } },
    salva: (o) => { try { if (finestra && finestra.sessionStorage) finestra.sessionStorage.setItem(chiave, JSON.stringify(o)); } catch (_e) { /* senza memoria si va avanti lo stesso */ } },
  };
}

// I campi di una riga: un valore che manca non si scrive (null, non zero).
const CAMPI_RIGA = ['giorno', 'il', 'ultimo_il', 'pagina', 'tipo', 'messaggio', 'dove', 'coinvolto_tipo', 'coinvolto', 'stato_http', 'versione', 'sessione', 'volte', 'impronta', 'visto'];
const rigaDaScrivere = (r) => {
  const o = {};
  for (const k of CAMPI_RIGA) {
    const v = r[k];
    if (v === null || v === undefined || v === '') continue;
    o[k] = v;
  }
  return o;
};

/** L'eccezione e' il limite di richieste della piattaforma? (lo stesso criterio di limiteRichieste.js) */
const eLimite = (e) => statoHttpDi(e) === 429 || /rate limit|too many requests/i.test(testoDi(e));

// L'attesa dopo la n-esima riga dello stesso errore (n da 1), in millisecondi.
const attesaDopoRighe = (n) => MINUTI_FRA_RIGHE_UGUALI[Math.min(Math.max(1, n), MINUTI_FRA_RIGHE_UGUALI.length) - 1] * 60000;

/**
 * Il motore del registro, senza browser: scrivi(riga) e' la create
 * dell'archivio; adesso, pianifica e annulla sono l'orologio (finti nelle
 * prove); memoria e' quella della sessione. Restituisce { annota, limite,
 * inUscita, rientro, stato }:
 * - limite(): un tentativo qualunque ha preso un 429, il registro aspetta;
 * - inUscita(): la scheda va in secondo piano o si chiude, le righe in attesa
 *   si scrivono adesso; rientro(): la scheda e' tornata davanti.
 */
export function creaRegistro({
  scrivi,
  adesso = () => Date.now(),
  pianifica = (fn, ms) => setTimeout(fn, ms),
  annulla = (h) => clearTimeout(h),
  versione = null,
  memoria = null,
  massimo = MASSIMO_RIGHE_PER_SESSIONE,
  massimoPerErrore = MASSIMO_RIGHE_PER_ERRORE,
} = {}) {
  let letta = {};
  try { letta = (memoria && memoria.leggi && memoria.leggi()) || {}; } catch (_e) { letta = {}; }
  const sessione = typeof letta.sessione === 'string' && letta.sessione ? letta.sessione : nuovaSessione();
  // Il giorno dei conti: righe scritte oggi, in tutto e per errore.
  let giornoConti = typeof letta.giorno === 'string' ? letta.giorno : '';
  let scritte = Number(letta.scritte) || 0;
  // Per ogni errore: quando e' stata scritta la sua ultima riga (t) e quante
  // righe ha avuto oggi (n). Una memoria di prima del 15/10/2026 aveva solo t.
  const ultime = new Map(Object.entries(letta.ultime && typeof letta.ultime === 'object' ? letta.ultime : {})
    .map(([k, v]) => [k, v && typeof v === 'object' ? { t: Number(v.t) || 0, n: Number(v.n) || 0 } : { t: Number(v) || 0, n: 1 }]));
  const inAttesa = new Map();
  for (const r of Array.isArray(letta.in_attesa) ? letta.in_attesa : []) if (r && r.impronta) inAttesa.set(r.impronta, r);
  let ultimoLimite = Number(letta.ultimo_limite) || 0;
  let ultimaScrittura = Number(letta.ultima_scrittura) || 0;
  let spento = false;
  let inScrittura = false;
  let uscita = false;
  let timer = null;
  let timerQuando = null;
  let generazione = 0;
  let rifiutate = 0;

  const salva = () => {
    if (!memoria || !memoria.salva) return;
    try {
      memoria.salva({ sessione, giorno: giornoConti, scritte, ultime: Object.fromEntries(ultime), in_attesa: [...inAttesa.values()], ultimo_limite: ultimoLimite, ultima_scrittura: ultimaScrittura });
    } catch (_e) { /* niente */ }
  };

  // Cambiato il giorno italiano, i conti del giorno ripartono (le attese fra due
  // righe uguali no: contano dall'ultima riga scritta, anche di ieri).
  const nuovoGiorno = (t) => {
    const g = giornoRoma(t);
    if (!g || g === giornoConti) return;
    if (giornoConti) {
      scritte = 0;
      for (const u of ultime.values()) u.n = 0;
    }
    giornoConti = g;
  };

  // Quando la riga in attesa si puo' scrivere: Infinity se oggi non si puo' piu'.
  const quandoPronta = (r) => {
    const u = ultime.get(r.impronta);
    if (scritte >= massimo || (u && u.n >= massimoPerErrore)) return Infinity;
    const dopoLaUguale = u && u.t ? u.t + (uscita ? attesaDopoRighe(1) : attesaDopoRighe(u.n)) : 0;
    return Math.max(
      uscita ? 0 : (Number(r._primo) || 0) + ATTESA_PRIMA_DI_SCRIVERE_MS,
      dopoLaUguale,
      ultimoLimite ? ultimoLimite + ATTESA_DOPO_UN_LIMITE_MS : 0,
      uscita || !ultimaScrittura ? 0 : ultimaScrittura + SPAZIO_FRA_SCRITTURE_MS,
    );
  };

  function fermaTimer() {
    if (timer === null) return;
    const h = timer;
    timer = null;
    timerQuando = null;
    generazione++;
    try { annulla(h); } catch (_e) { /* un timer gia' partito si ignora da se' */ }
  }

  // Il timer e' uno: si fissa sulla prima riga pronta, e si rifissa se ne arriva
  // una pronta prima. Uno che scatta in anticipo non fa danni: non trova niente
  // di pronto e si rifissa.
  function programma() {
    if (spento || inScrittura || !inAttesa.size) return;
    const t = adesso();
    nuovoGiorno(t);
    const prossima = Math.min(...[...inAttesa.values()].map(quandoPronta));
    if (!Number.isFinite(prossima)) { fermaTimer(); return; }
    const quando = Math.max(t, prossima);
    if (timer !== null && timerQuando !== null && timerQuando <= quando) return;
    fermaTimer();
    const mia = ++generazione;
    timerQuando = quando;
    try {
      timer = pianifica(() => {
        if (mia !== generazione) return undefined;
        timer = null;
        timerQuando = null;
        return svuotaSicuro();
      }, quando - t);
    } catch (_e) { timer = null; timerQuando = null; }
  }

  async function scriviRiga(r, t) {
    // Conta come scritta prima di partire: se non riesce, si perde e basta,
    // e lo stesso errore non riprova prima del suo turno.
    scritte++;
    const u = ultime.get(r.impronta);
    ultime.set(r.impronta, { t, n: (u ? u.n : 0) + 1 });
    ultimaScrittura = t;
    try {
      await scrivi(rigaDaScrivere(r));
    } catch (e) {
      rifiutate++;
      const s = statoHttpDi(e);
      if (eLimite(e)) ultimoLimite = adesso();
      else if (s === 400 || s === 401 || s === 403 || s === 404 || SOLA_LETTURA.test(testoDi(e))) spento = true;
    }
  }

  async function svuota() {
    if (spento || inScrittura) return;
    const t = adesso();
    nuovoGiorno(t);
    // Prima gli errori che in questa sessione non hanno ancora una riga, poi i
    // piu' vecchi: un errore nuovo dice di piu' del conto di uno ripetuto.
    const nuovo = (r) => (ultime.has(r.impronta) ? 1 : 0);
    const pronte = [...inAttesa.values()].filter(r => quandoPronta(r) <= t)
      .sort((a, b) => nuovo(a) - nuovo(b) || (Number(a._primo) || 0) - (Number(b._primo) || 0));
    // L'uscita vale una volta: si scrive quello che e' pronto adesso, poi in
    // secondo piano tornano le attese di sempre (una scheda lasciata dietro per
    // ore non scrive una riga ogni due minuti).
    const usciva = uscita;
    uscita = false;
    if (!pronte.length) { programma(); return; }
    // Di solito una riga; con la scheda che se ne va, quelle pronte insieme
    // (al piu' MASSIMO_RIGHE_IN_USCITA), perche' dopo potrebbe non esserci tempo.
    const daScrivere = usciva ? pronte.slice(0, Math.min(MASSIMO_RIGHE_IN_USCITA, Math.max(0, massimo - scritte))) : [pronte[0]];
    if (!daScrivere.length) { programma(); return; }
    for (const r of daScrivere) inAttesa.delete(r.impronta);
    inScrittura = true;
    const scrivendo = daScrivere.map(r => scriviRiga(r, t));
    salva();
    try {
      await Promise.all(scrivendo);
    } finally {
      inScrittura = false;
    }
    salva();
    programma();
  }

  // Una promessa del registro non resta mai rifiutata: diventerebbe un errore
  // non preso, e il registro annoterebbe se stesso.
  const svuotaSicuro = () => svuota().catch(() => undefined);

  function annota(evento) {
    try {
      if (spento || !evento || !NOMI_TIPI[evento.tipo]) return false;
      const t = adesso();
      nuovoGiorno(t);
      const riga = {
        tipo: evento.tipo,
        messaggio: pulisciMessaggio(evento.messaggio) || NOMI_TIPI[evento.tipo],
        pagina: paginaDi(evento.pagina),
        dove: evento.dove ? pulisciMessaggio(evento.dove) : '',
        coinvolto_tipo: evento.coinvolto_tipo === 'funzione' || evento.coinvolto_tipo === 'archivio' ? evento.coinvolto_tipo : '',
        coinvolto: evento.coinvolto ? pulisciMessaggio(evento.coinvolto, 120) : '',
        stato_http: Number.isFinite(Number(evento.stato_http)) && Number(evento.stato_http) > 0 ? Number(evento.stato_http) : null,
      };
      const k = improntaDi(riga);
      if (riga.tipo === 'limite') ultimoLimite = t;
      const iso = new Date(t).toISOString();
      const gia = inAttesa.get(k);
      if (gia) {
        gia.volte = (Number(gia.volte) || 1) + 1;
        gia.ultimo_il = iso;
      } else {
        // Le righe in attesa contano nel massimo del giorno: mai piu' di
        // `massimo` righe, scritte o da scrivere.
        if (scritte + inAttesa.size >= massimo) { salva(); return false; }
        inAttesa.set(k, { ...riga, impronta: k, giorno: giornoRoma(t) || oggiRoma(), il: iso, ultimo_il: iso, volte: 1, sessione, versione: versione || '', visto: false, _primo: t });
      }
      salva();
      programma();
      return true;
    } catch (_e) {
      return false;
    }
  }

  function limite() {
    try {
      ultimoLimite = adesso();
      salva();
      programma();
    } catch (_e) { /* niente */ }
  }

  // La scheda va in secondo piano o si chiude: le righe pronte partono adesso,
  // dentro l'evento, perche' un timer di una scheda nascosta puo' non scattare.
  function inUscita() {
    try {
      uscita = true;
      if (spento || inScrittura || !inAttesa.size) return;
      fermaTimer();
      svuotaSicuro();
    } catch (_e) { /* niente */ }
  }

  function rientro() {
    uscita = false;
    try { programma(); } catch (_e) { /* niente */ }
  }

  // Le righe rimaste in attesa nella sessione (una pagina rotta e poi «Ricarica
  // app») si scrivono adesso, col freno di sempre.
  programma();

  return {
    annota,
    limite,
    inUscita,
    rientro,
    stato: () => ({ sessione, giorno: giornoConti, scritte, in_attesa: inAttesa.size, spento, ultimo_limite: ultimoLimite, rifiutate, programmata: timer !== null, uscita }),
  };
}

// ─── L'aggancio al client delle pagine ───

// Le chiamate gia' dette: un errore che una chiamata ha gia' annotato e che poi
// nessuno prende arriva anche a «unhandledrejection», e si conta una volta sola.
const DETTI = new WeakSet();
const giaDetto = (e) => {
  if (!e || typeof e !== 'object') return false;
  if (DETTI.has(e)) return true;
  DETTI.add(e);
  return false;
};

const AGGANCIATO = Symbol.for('treadrider.registroErrori.agganciato');
const NON_OSSERVATI = new Set(['subscribe', 'then']);

/**
 * Il modulo crudo del client (archivi o funzioni), SOTTO il limite di
 * richieste: la proprieta' com'e' sull'oggetto, letta senza passare dal suo
 * involucro (limiteRichieste.js e' un Proxy senza la trappola di
 * getOwnPropertyDescriptor, che quindi risponde con quella del client vero).
 * null se non si puo'.
 */
export function moduloCrudo(client, nome) {
  try {
    const d = client && Object.getOwnPropertyDescriptor(client, nome);
    if (!d) return null;
    if ('value' in d) return d.value && typeof d.value === 'object' ? d.value : null;
    const v = typeof d.get === 'function' ? d.get.call(client) : null;
    return v && typeof v === 'object' ? v : null;
  } catch (_e) {
    return null;
  }
}

// Ogni tentativo che prende un 429, anche quelli che il limite di richieste poi
// ripete: lo dice subito al registro, che smette di scrivere.
function osservaTentativi(archivi, funzioni, suLimite) {
  const vede = (e) => { try { if (eLimite(e)) suLimite(); } catch (_e) { /* niente */ } };
  const tentativiArchivi = archivi ? new Proxy(archivi, {
    get(t, nome) {
      const a = t[nome];
      if (typeof nome !== 'string' || nome === ARCHIVIO_ERRORI || !a || typeof a !== 'object') return a;
      return new Proxy(a, {
        get(x, metodo) {
          const v = x[metodo];
          if (typeof metodo !== 'string' || typeof v !== 'function' || NON_OSSERVATI.has(metodo)) return v;
          return async (...argomenti) => {
            try { return await v.apply(x, argomenti); } catch (e) { vede(e); throw e; }
          };
        },
      });
    },
  }) : null;
  const tentativiFunzioni = funzioni ? new Proxy(funzioni, {
    get(t, nome) {
      const v = t[nome];
      if (nome !== 'invoke' || typeof v !== 'function') return v;
      return async (...argomenti) => {
        try { return await v.apply(t, argomenti); } catch (e) { vede(e); throw e; }
      };
    },
  }) : null;
  return { tentativiArchivi, tentativiFunzioni };
}

/**
 * Osserva le chiamate del client: archivi (ogni metodo che restituisce una
 * promessa) e funzioni (invoke). Una chiamata fallita si annota e l'errore
 * riparte IDENTICO: la pagina vede quello che vedeva prima. Si rimette sul
 * client con defineProperty, come fa proteggiScritture (permessi.js), e il
 * segno degli archivi gia' avvolti dal limite di richieste
 * (Symbol.for('ecoflow.limiteRichieste')) passa com'e': altrimenti il limite li
 * avvolgerebbe due volte e una richiesta respinta partirebbe 36 volte invece di
 * 6. L'archivio degli errori non si osserva mai.
 *
 * Con suLimite (revisione del 15/10/2026) si guarda anche SOTTO il limite di
 * richieste: i moduli crudi si rimettono sul client osservati, il limite di
 * richieste li avvolge come prima, e sopra resta l'osservatore delle chiamate
 * fallite. Cosi' il registro sa del 429 al primo tentativo, non dopo il
 * minuto abbondante dei ritentativi.
 */
export function agganciaChiamate(client, segnala, { pagina = () => '/', suLimite = null } = {}) {
  if (!client || typeof client !== 'object' || client[AGGANCIATO]) return false;
  const nota = (e, coinvolto_tipo, coinvolto) => {
    try {
      if (giaDetto(e)) return;
      const c = classificaErroreChiamata(e);
      if (!c) return;
      segnala({ ...c, coinvolto_tipo, coinvolto, pagina: pagina() });
    } catch (_e) { /* il registro non rompe mai una pagina */ }
  };
  if (typeof suLimite === 'function') {
    try {
      const { tentativiArchivi, tentativiFunzioni } = osservaTentativi(moduloCrudo(client, 'entities'), moduloCrudo(client, 'functions'), suLimite);
      if (tentativiArchivi) Object.defineProperty(client, 'entities', { get: () => tentativiArchivi, configurable: true });
      if (tentativiFunzioni) Object.defineProperty(client, 'functions', { get: () => tentativiFunzioni, configurable: true });
    } catch (_e) { /* senza: il 429 si vede dopo i ritentativi, come prima */ }
  }
  // Letti adesso, passano dal limite di richieste (se il client ce l'ha) che
  // avvolge i moduli osservati qui sopra.
  const archivi = client.entities;
  const funzioni = client.functions;
  const archiviOsservati = archivi && typeof archivi === 'object' ? new Proxy(archivi, {
    get(t, nome) {
      const a = t[nome];
      if (typeof nome !== 'string' || nome === ARCHIVIO_ERRORI || !a || typeof a !== 'object') return a;
      return new Proxy(a, {
        get(x, metodo) {
          const v = x[metodo];
          if (typeof metodo !== 'string' || typeof v !== 'function' || NON_OSSERVATI.has(metodo)) return v;
          return async (...argomenti) => {
            try { return await v.apply(x, argomenti); } catch (e) { nota(e, 'archivio', `${nome}.${metodo}`); throw e; }
          };
        },
      });
    },
  }) : archivi;
  const funzioniOsservate = funzioni && typeof funzioni === 'object' ? new Proxy(funzioni, {
    get(t, nome) {
      const v = t[nome];
      if (nome !== 'invoke' || typeof v !== 'function') return v;
      return async (nomeFunzione, ...resto) => {
        try { return await v.call(t, nomeFunzione, ...resto); } catch (e) { nota(e, 'funzione', String(nomeFunzione || '')); throw e; }
      };
    },
  }) : funzioni;
  try {
    if (archiviOsservati) Object.defineProperty(client, 'entities', { get: () => archiviOsservati, configurable: true });
    if (funzioniOsservate) Object.defineProperty(client, 'functions', { get: () => funzioniOsservate, configurable: true });
    client[AGGANCIATO] = true;
    return true;
  } catch (_e) {
    // Se il client non si lascia ridefinire, restano gli errori delle pagine.
    return false;
  }
}

// ─── L'installazione nel browser ───

const CHIAVE = Symbol.for('treadrider.registroErrori');
// Il rumore che non e' un errore del sito: un avviso del browser sul ridisegno,
// uno script di un altro sito senza dettagli, le estensioni del browser.
const RUMORE = [/ResizeObserver loop/i, /^Script error\.?$/i];
const DA_ESTENSIONE = /(chrome|moz|safari(-web)?|ms-browser)-extension:\/\//i;
const daIgnorare = (messaggio, file, pila) => RUMORE.some(re => re.test(String(messaggio || '').trim()))
  || DA_ESTENSIONE.test(String(file || '')) || DA_ESTENSIONE.test(String(pila || ''))
  || SOLA_LETTURA.test(String(messaggio || ''));

/** La versione del codice: il nome del pacchetto pubblicato (assets/index-<versione>.js), se si sa. */
export function versioneDelCodice(documento) {
  try {
    const src = [...documento.querySelectorAll('script[src]')].map(s => s.getAttribute('src') || '').find(s => /\/assets\/index-[\w-]+\.js(\?|$)/.test(s));
    const m = src && src.match(/\/assets\/index-([\w-]+)\.js/);
    return m ? m[1] : null;
  } catch (_e) {
    return null;
  }
}

/** Il registro installato in questa scheda, se c'e'. */
export const registroAttivo = () => globalThis[CHIAVE] || null;

/**
 * Installa il registro nella pagina: le chiamate del client, gli errori non
 * presi, e da qui segnalaErrorePagina. Una volta sola; se qualcosa va storto
 * non installa niente e la pagina va avanti com'era.
 */
export function installaRegistroErrori(client, { finestra = typeof window !== 'undefined' ? window : null, ...opzioni } = {}) {
  try {
    if (globalThis[CHIAVE]) return globalThis[CHIAVE];
    if (!client || !finestra || typeof finestra.addEventListener !== 'function') return null;
    // Una pagina che si chiude interrompe le sue richieste: quegli errori non
    // sono del sito.
    let chiusura = false;
    const pagina = () => paginaDi(finestra.location);
    // La riga del registro si scrive sull'archivio crudo, preso prima di
    // agganciare le chiamate: un tentativo solo, senza i ritentativi del limite
    // di richieste (revisione del 15/10/2026). Se il crudo non si trova, si
    // scrive dal client come ogni altra scrittura.
    const crudi = moduloCrudo(client, 'entities') || client.entities;
    const registro = creaRegistro({
      scrivi: (riga) => crudi.ErroreSito.create(riga),
      memoria: memoriaDiSessione(finestra),
      versione: versioneDelCodice(finestra.document),
      ...opzioni,
    });
    const segnala = (evento) => (chiusura ? false : registro.annota(evento));
    agganciaChiamate(client, segnala, { pagina, suLimite: () => registro.limite() });
    finestra.addEventListener('error', (ev) => {
      try {
        // Un'immagine o uno script che non si caricano arrivano qui solo in
        // cattura: non e' questo il caso, ma si guarda lo stesso.
        if (!ev || (ev.target && ev.target !== finestra && ev.target.tagName)) return;
        const err = ev.error;
        if (giaDetto(err)) return;
        const grezzo = testoDi(err) || ev.message || '';
        if (daIgnorare(grezzo, ev.filename, err && err.stack)) return;
        segnala({ tipo: 'non_preso', messaggio: grezzo || 'Errore senza messaggio', pagina: pagina(),
          dove: dovePila(err) || (ev.filename ? `${percorsoDi(ev.filename)}:${ev.lineno || 0}:${ev.colno || 0}` : '') });
      } catch (_e) { /* niente */ }
    });
    finestra.addEventListener('unhandledrejection', (ev) => {
      try {
        const r = ev ? ev.reason : null;
        if (giaDetto(r)) return;
        const grezzo = testoDi(r) || 'Promessa rifiutata senza messaggio';
        if (daIgnorare(grezzo, '', r && r.stack)) return;
        segnala({ tipo: 'non_preso', messaggio: grezzo, pagina: pagina(), dove: dovePila(r) });
      } catch (_e) { /* niente */ }
    });
    // La scheda che va in secondo piano o si chiude: le righe in attesa si
    // scrivono adesso, con le volte contate fin qui (revisione del 15/10/2026).
    // visibilitychange arriva al documento, ed e' l'ultimo momento sicuro anche
    // sul telefono, dove una scheda in secondo piano si chiude senza pagehide.
    const documento = finestra.document && typeof finestra.document.addEventListener === 'function' ? finestra.document : finestra;
    documento.addEventListener('visibilitychange', () => {
      try {
        const stato = (finestra.document && finestra.document.visibilityState) || '';
        if (stato === 'hidden') registro.inUscita();
        else if (stato === 'visible') registro.rientro();
      } catch (_e) { /* niente */ }
    });
    finestra.addEventListener('pagehide', () => { chiusura = true; registro.inUscita(); });
    finestra.addEventListener('pageshow', () => { chiusura = false; registro.rientro(); });
    const installato = { registro, segnala, pagina, giaDetto };
    globalThis[CHIAVE] = installato;
    return installato;
  } catch (_e) {
    return null;
  }
}

/** Una pagina che si rompe (PageErrorBoundary): si annota col percorso e le prime righe della pila. */
export function segnalaErrorePagina(errore, info) {
  try {
    const r = globalThis[CHIAVE];
    if (!r) return false;
    if (r.giaDetto && r.giaDetto(errore)) return false;
    return r.segnala({ tipo: 'pagina', messaggio: testoDi(errore) || 'La pagina si è rotta', pagina: r.pagina(),
      dove: dovePila(errore) || dovePila({ stack: info && info.componentStack }) });
  } catch (_e) {
    return false;
  }
}

// ─── La pagina dell'amministratore ───

const MS_GIORNO = 86400000;
/** Il giorno n giorni prima di g (AAAA-MM-GG). */
export function giornoMeno(g, n) {
  const s = String(g || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  const t = Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) - n * MS_GIORNO;
  return new Date(t).toISOString().slice(0, 10);
}

const ORA_ROMA = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
/** gg/mm/aaaa hh:mm, ora italiana; «—» se non c'e'. Le date della piattaforma senza fuso sono UTC. */
export function dataOraItaliana(v) {
  if (!v) return '—';
  const s = String(v);
  const d = new Date(/(Z|[+-]\d{2}:?\d{2})$/.test(s) || !/T/.test(s) ? s : `${s}Z`);
  if (Number.isNaN(d.getTime())) return '—';
  return ORA_ROMA.format(d).replace(',', '');
}

/** Le email degli utenti per id: { id: email } da un elenco di utenti. */
export function emailPerId(utenti) {
  const m = new Map();
  for (const u of Array.isArray(utenti) ? utenti : []) if (u && u.id && u.email) m.set(String(u.id), String(u.email));
  return m;
}

/** Gli id di chi ha creato le righe, quando la riga non porta l'email (created_by). */
export const idSenzaEmail = (righe) => [...new Set((righe || []).filter(r => r && !r.created_by && r.created_by_id).map(r => String(r.created_by_id)))];

/**
 * Gli errori degli ultimi `giorni` giorni (oggi compreso), raggruppati per
 * errore uguale (l'impronta: messaggio, pagina, chiamata), con chi e quante
 * volte. Prima quelli da vedere, poi i piu' recenti.
 *
 * Chi: la riga porta created_by_id, e created_by (l'email) solo a volte: la
 * lettura della scheda non la restituisce (revisione del 15/10/2026, sulla copia
 * dei dati veri dell'11/10: 31.923 righe con created_by_id, nessuna con
 * created_by). utenti e' la mappa id -> email (emailPerId), letta una volta
 * dall'amministratore; senza, chi resta distinto per id e si dice «utente non
 * riconosciuto».
 */
export function raggruppaErrori(righe, { oggi = oggiRoma(), giorni = 7, utenti = null } = {}) {
  const emailDi = (r) => {
    if (r.created_by) return String(r.created_by);
    const id = r.created_by_id ? String(r.created_by_id) : '';
    if (id && utenti && typeof utenti.get === 'function' && utenti.get(id)) return String(utenti.get(id));
    if (id && utenti && typeof utenti === 'object' && typeof utenti.get !== 'function' && utenti[id]) return String(utenti[id]);
    return '';
  };
  const dal = giornoMeno(oggi, Math.max(1, giorni) - 1);
  const gruppi = new Map();
  for (const r of righe || []) {
    if (!r) continue;
    const g = String(r.giorno || '').slice(0, 10);
    if (!g || (dal && g < dal)) continue;
    const k = r.impronta || improntaDi(r);
    let x = gruppi.get(k);
    if (!x) {
      x = { chiave: k, tipo: r.tipo, messaggio: r.messaggio || '', pagina: r.pagina || '', coinvolto_tipo: r.coinvolto_tipo || '', coinvolto: r.coinvolto || '',
        stato_http: r.stato_http ?? null, dove: r.dove || '', volte: 0, righe: 0, chi: new Map(), sessioni: new Set(), versioni: new Set(), primo: null, ultimo: null, da_vedere: [] };
      gruppi.set(k, x);
    }
    const v = Math.max(1, Math.round(Number(r.volte) || 1));
    x.volte += v;
    x.righe++;
    // Due utenti non riconosciuti restano due: la chiave e' l'email, o l'id.
    const email = emailDi(r);
    const chi = email ? `e:${email.toLowerCase()}` : (r.created_by_id ? `i:${r.created_by_id}` : '');
    const c = x.chi.get(chi) || { email, id: r.created_by_id ? String(r.created_by_id) : '', volte: 0 };
    c.volte += v;
    x.chi.set(chi, c);
    if (r.sessione) x.sessioni.add(r.sessione);
    if (r.versione) x.versioni.add(r.versione);
    const il = r.il || r.created_date || null;
    const ultimo = r.ultimo_il || il;
    if (il && (!x.primo || String(il) < String(x.primo))) x.primo = il;
    if (ultimo && (!x.ultimo || String(ultimo) > String(x.ultimo))) x.ultimo = ultimo;
    if (!r.visto && r.id) x.da_vedere.push(r.id);
    if (!x.dove && r.dove) x.dove = r.dove;
  }
  return [...gruppi.values()]
    .map(x => ({ ...x, chi: [...x.chi.values()].sort((a, b) => b.volte - a.volte || a.email.localeCompare(b.email)), sessioni: x.sessioni.size, versioni: [...x.versioni] }))
    .sort((a, b) => (b.da_vedere.length > 0) - (a.da_vedere.length > 0) || String(b.ultimo || '').localeCompare(String(a.ultimo || '')) || b.volte - a.volte);
}

/** Il primo giorno che si tiene: le righe di prima sono piu' vecchie di GIORNI_DI_CONSERVAZIONE giorni. */
export const primoGiornoTenuto = (oggi, giorni = GIORNI_DI_CONSERVAZIONE) => giornoMeno(oggi, giorni);

/** Le righe piu' vecchie di 40 giorni. */
export function righeDaTogliere(righe, oggi = oggiRoma(), giorni = GIORNI_DI_CONSERVAZIONE) {
  const limite = primoGiornoTenuto(oggi, giorni);
  if (!limite) return [];
  return (righe || []).filter(r => r && /^\d{4}-\d{2}-\d{2}/.test(String(r.giorno || '')) && String(r.giorno).slice(0, 10) < limite);
}

/** I giorni da togliere, dal piu' vecchio: si cancellano un giorno per volta, con un filtro di uguaglianza. */
export function giorniDaTogliere(righe, oggi = oggiRoma(), giorni = GIORNI_DI_CONSERVAZIONE) {
  return [...new Set(righeDaTogliere(righe, oggi, giorni).map(r => String(r.giorno).slice(0, 10)))].sort();
}
