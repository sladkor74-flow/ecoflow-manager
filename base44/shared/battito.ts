// IL BATTITO DEI LAVORI PIANIFICATI (chiusura dell'audit, 11/10/2026).
//
// Undici lavori girano da soli: l'alleggerimento dei documenti alle 3:15, il
// guardiano alle 5 con il controllo delle identita' fra moduli, il presidio e il
// controllo delle qualifiche nei giorni feriali, i target alle 9, il corso RT e
// il suo materiale ogni ora, il programma del mercoledi', il controllo normativo
// il 1° del mese, il motore degli alert a ogni caricamento. Fino a oggi solo il
// guardiano aveva un «non gira da N giorni», e ce l'aveva soltanto perche' lascia
// una riga IndicatoreGiorno con la data. Se dopo una pubblicazione (i 503 del
// 09/10/2026) o per il limite di richieste il controllo delle qualifiche o
// l'alleggerimento cominciano a rispondere 500, non se ne accorge nessuno: un
// controllo che dorme e uno che non trova niente si assomigliano troppo.
//
// Qui stanno due cose.
// - LAVORI: la tabella dei lavori, con la cadenza attesa scritta come il cron del
//   loro workflow. prove/battitoLavori.mjs la confronta con base44/workflows: un
//   lavoro nuovo non nasce senza battito, e un orario cambiato in un posto solo fa
//   cadere la prova.
// - conBattito: l'involucro che ogni lavoro mette attorno al suo corpo. Lascia una
//   riga EsecuzioneLavoro per lavoro, che si riscrive e non cresce: quando e'
//   partito, com'e' andata, quando e' riuscito l'ultima volta, in due parole che
//   cosa ha fatto, e l'errore. La scrive anche quando il lavoro fallisce, senza
//   coprire l'errore e senza cambiare la risposta: il battito e' un servizio in
//   piu', non un ostacolo.
//
// UN RINVIO NON SCRIVE NIENTE, NEMMENO IL BATTITO. E' la regola dei conti che si
// salvano (registroCaricamenti.ts, statoArchivi.ts): con un caricamento a meta' si
// risponde «rinviato» e non si tocca nessun archivio. Il caricamento da ripetere
// la dashboard lo dice gia' fra i caricamenti; qui un lavoro che resta rinviato per
// giorni si vede perche' l'ultima riuscita invecchia.
//
// La regola per giudicare il battito (quando un lavoro «non riesce») sta in
// presidi.ts, con le voci della dashboard.
import { eAmministratore } from "./permessi.ts";

// --- La cadenza: il cron dei workflow, letto nel fuso italiano ---

const ROMA = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short',
});
const SETTIMANA = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const ORA_MS = 3600000;

/** Le parti italiane di un istante: anno, mese (1-12), giorno, ora (0-23), giorno della settimana (0 = domenica). */
export function partiRoma(ms) {
  const p = {};
  for (const x of ROMA.formatToParts(new Date(ms))) p[x.type] = x.value;
  return { anno: Number(p.year), mese: Number(p.month), giorno: Number(p.day), ora: Number(p.hour) % 24, settimana: SETTIMANA[p.weekday] };
}

// Un campo del cron: '*', '5', '1-5', '8,14', '*/15'. null vuol dire «ogni».
function campoCron(testo, min, max) {
  const t = String(testo || '').trim();
  if (t === '*') return null;
  const valori = new Set();
  for (const parte of t.split(',')) {
    const [base, passo] = parte.split('/');
    const ogni = passo ? Number(passo) : 1;
    let da = min, a = max;
    if (base !== '*') {
      const [x, y] = base.split('-').map(Number);
      da = x; a = y === undefined ? (passo ? max : x) : y;
    }
    if (![da, a, ogni].every(Number.isInteger) || ogni < 1) return undefined;
    for (let v = da; v <= a; v += ogni) valori.add(v);
  }
  return valori;
}

/**
 * Il cron di un workflow (minuto ora giorno mese settimana), come lo scrive la
 * piattaforma. null se non si capisce: chi lo usa lo dice, non indovina.
 */
export function leggiCron(cron) {
  const parti = String(cron || '').trim().split(/\s+/);
  if (parti.length !== 5) return null;
  const minuti = campoCron(parti[0], 0, 59);
  const ore = campoCron(parti[1], 0, 23);
  const giorni = campoCron(parti[2], 1, 31);
  const mesi = campoCron(parti[3], 1, 12);
  let settimana = campoCron(parti[4], 0, 7);
  if ([minuti, ore, giorni, mesi, settimana].includes(undefined) || minuti === null) return null;
  // La domenica si scrive 0 o 7.
  if (settimana && settimana.has(7)) { settimana = new Set(settimana); settimana.add(0); }
  return { minuti: [...minuti].sort((a, b) => a - b), ore, giorni, mesi, settimana, orario: ore === null };
}

// Regola del cron: se giorno del mese e giorno della settimana sono tutti e due
// ristretti, basta uno dei due.
function giornoVa(c, p) {
  if (c.giorni && c.settimana) return c.giorni.has(p.giorno) || c.settimana.has(p.settimana);
  if (c.giorni) return c.giorni.has(p.giorno);
  if (c.settimana) return c.settimana.has(p.settimana);
  return true;
}

// Oltre questo non si guarda indietro: per dire «da N giorni» basta.
const FINESTRA_MS = 60 * 24 * ORA_MS;

/**
 * I giri che il cron prevede fra due istanti (dopo `daMs`, fino a `aMs`
 * compreso), in millisecondi. Le ore si scorrono in UTC e si leggono a Roma: il
 * fuso italiano si sposta di ore intere, quindi il minuto e' lo stesso. (Un cron
 * fra le 2 e le 3 di notte, nell'ora che a ottobre si ripete, conterebbe due
 * giri: nessun workflow ne ha uno.)
 */
export function giriAttesi(cron, daMs, aMs) {
  const c = typeof cron === 'string' ? leggiCron(cron) : cron;
  if (!c || !(Number(aMs) > Number(daMs))) return [];
  const inizio = Math.max(Number(daMs), Number(aMs) - FINESTRA_MS);
  const out = [];
  for (let h = Math.floor(inizio / ORA_MS) * ORA_MS; h <= aMs; h += ORA_MS) {
    const p = partiRoma(h);
    if (c.ore && !c.ore.has(p.ora)) continue;
    if (c.mesi && !c.mesi.has(p.mese)) continue;
    if (!giornoVa(c, p)) continue;
    for (const m of c.minuti) {
      const t = h + m * 60000;
      if (t > daMs && t <= aMs) out.push(t);
    }
  }
  return out;
}

// --- I lavori ---

const conta = (n, uno, molti) => `${Number(n) || 0} ${Number(n) === 1 ? uno : molti}`;

/**
 * I LAVORI PIANIFICATI. Uno per funzione chiamata da un workflow: `cron` e' quello
 * del suo workflow (null per chi parte a evento, cioe' dopo un caricamento),
 * `titolo` e' come lo si chiama a video, `link` dove si guarda, `senza` che cosa
 * non succede finche' non riparte (la dashboard lo dice, perche' si capisca quanto
 * conta).
 *
 * - `eIlLavoro(corpo)`: per le funzioni che servono anche alle pagine, quando la
 *   chiamata e' il lavoro. Il riepilogo delle dichiarazioni lo apre ogni pagina,
 *   ma il guardiano e' solo `registra` senza anno, come lo chiama il workflow; i
 *   target li legge anche il pannello della dashboard, con crea_alerts falso.
 * - `giudica(j)`: quando una risposta 200 non e' una riuscita (la fotografia che
 *   non si e' potuta scrivere).
 * - `sintesi(j)`: che cosa ha fatto, in due parole.
 * - `soglia`: quanti giri mancati prima che la dashboard lo dica (presidi.ts).
 * - `dopo`: il passo che viene prima nello stesso workflow; se non riesce quello,
 *   questo non ha avuto occasione, e la voce e' una sola.
 */
export const LAVORI = [
  {
    lavoro: 'alleggerisciDocumenti', workflow: 'PuliziaVerificheReport', cron: '15 3 * * *',
    titolo: "L'alleggerimento dei documenti dei fornitori", link: '/verifiche-fornitori',
    senza: "i documenti dei fornitori non si alleggeriscono",
    sintesi: (j) => `${conta(j.alleggeriti, 'documento alleggerito', 'documenti alleggeriti')}, ${conta(j.restano, 'rimasto', 'rimasti')}${j.file ? `; ${conta(j.file.cancellati, 'file tolto', 'file tolti')}` : ''}`,
  },
  {
    lavoro: 'riepilogoDichiarazioni', workflow: 'GuardianoNotturno', cron: '0 5 * * *',
    titolo: 'Il guardiano notturno', link: '/dichiarazioni-impianti',
    senza: "uno scostamento nuovo dal portale non lo segnala nessuno",
    eIlLavoro: (corpo) => corpo.registra === true && !corpo.anno,
    // La risposta esce anche se la riga del giorno non si e' potuta scrivere (il
    // guardiano non ostacola la pagina): per il lavoro, pero', quello e' un giro
    // non riuscito.
    giudica: (j) => (j.fotografia && j.fotografia.scritta === false
      ? { esito: 'fallito', errore: j.fotografia.errore || j.fotografia.motivo || 'la fotografia del giorno non è stata scritta' }
      : null),
    sintesi: (j) => (j.fotografia && j.fotografia.nota) || '',
  },
  {
    lavoro: 'controllaInvarianti', workflow: 'GuardianoNotturno', cron: '0 5 * * *', dopo: 'riepilogoDichiarazioni',
    titolo: 'Il controllo delle identità fra moduli', link: '/giacenze',
    senza: "un numero che due moduli dicono diverso non lo segnala nessuno",
    giudica: (j) => {
      const x = j.invarianti || {};
      if (x.scritte === false) return { esito: 'fallito', errore: x.motivo || "l'esito non è stato scritto" };
      if (Number(x.non_verificate) > 0) return { esito: 'fallito', errore: x.motivi || `${x.non_verificate} identità non verificate` };
      return null;
    },
    sintesi: (j) => (j.invarianti && j.invarianti.nota) || '',
  },
  {
    lavoro: 'presidioQualifica', workflow: 'PresidioDocumentiQualifica', cron: '40 6 * * 1-5',
    titolo: 'Il presidio dei documenti di qualifica', link: '/qualifica-fornitori',
    senza: "i documenti di qualifica rimasti indietro non si leggono",
    sintesi: (j) => `${conta(j.analizzati, 'documento letto', 'documenti letti')}, ${conta(j.falliti, 'non riuscito', 'non riusciti')}, ${conta(j.restano, 'rimasto', 'rimasti')}`,
  },
  {
    lavoro: 'controlloQualifiche', workflow: 'ControlloQualificaFornitori', cron: '30 7 * * 1-5',
    titolo: 'Il controllo delle qualifiche', link: '/qualifica-fornitori',
    senza: "il promemoria di scadenze e documenti mancanti non parte",
    sintesi: (j) => `${conta(j.da_inviare, 'novità', 'novità')} da segnalare${j.inviata ? ', email inviata' : ''}`,
  },
  {
    lavoro: 'checkTargetAlerts', workflow: 'TargetAlertsCheck', cron: '0 9 * * *',
    titolo: 'Il controllo dei target mensili', link: '/target-status',
    senza: "gli alert dei target mensili non si aggiornano",
    eIlLavoro: (corpo) => corpo.crea_alerts !== false,
    sintesi: (j) => `${conta((j.missed || []).length, 'target mancato', 'target mancati')}, ${conta((j.at_risk || []).length, 'a rischio', 'a rischio')}`,
  },
  {
    lavoro: 'aggiornaCorsoRT', workflow: 'AggiornamentoCorsoRT', cron: '55 * * * *', soglia: 6,
    titolo: "L'aggiornamento del corso RT", link: '/assistente',
    senza: "le schede del corso RT non si confrontano con le norme nuove",
    sintesi: (j) => `${conta(j.controllate, 'scheda ricontrollata', 'schede ricontrollate')}, ${conta(j.con_aggiornamenti, 'con aggiornamenti', 'con aggiornamenti')}`,
  },
  {
    lavoro: 'elaboraMaterialeCorso', workflow: 'ElaborazioneMaterialeCorso', cron: '25 * * * *', soglia: 6,
    titolo: "L'elaborazione del materiale del corso RT", link: '/assistente',
    senza: "il materiale nuovo del corso RT non diventa schede di studio",
    sintesi: (j) => conta(j.elaborate, 'parte elaborata', 'parti elaborate'),
  },
  {
    lavoro: 'analisiSettimanalePredittiva', workflow: 'Suggerimento Lunedi Predittivita', cron: '0 8,14 * * 3',
    titolo: 'Il programma del mercoledì delle secondarie', link: '/predittivita-secondarie',
    senza: "il programma delle secondarie della settimana dopo non si fissa da solo",
    sintesi: (j) => j.riassunto || '',
  },
  {
    lavoro: 'controlloNormativo', workflow: 'ControlloNormativoMensile', cron: '0 7 1 * *', soglia: 1,
    titolo: 'Il controllo normativo del mese', link: '/assistente',
    senza: "le novità normative del mese non diventano proposte",
    sintesi: (j) => j.saltato || conta(j.proposte, 'proposta', 'proposte'),
  },
  {
    // Parte a evento, alla fine di un caricamento: non ha un orario da mancare.
    lavoro: 'runAlertEngine', workflow: 'AlertEngineAutoRun', cron: null,
    titolo: 'Il motore degli alert', link: '/alert-engine',
    senza: "gli alert non si aggiornano sull'ultimo caricamento",
    sintesi: (j) => `${j.modulo || ''}: ${conta(j.alerts_creati, 'alert creato', 'alert creati')}, ${conta(j.alerts_chiusi, 'chiuso', 'chiusi')}`.replace(/^: /, ''),
  },
];

const PER_NOME = new Map(LAVORI.map(l => [l.lavoro, l]));
export const lavoroDi = (nome) => PER_NOME.get(nome) || null;

// --- L'involucro ---

const TAGLIO = 500;
const taglia = (s) => { const t = String(s || '').trim(); return t.length > TAGLIO ? t.slice(0, TAGLIO - 1) + '…' : t; };

/** Il messaggio di un errore, anche quando arriva dal client delle funzioni. */
export function messaggioErrore(e) {
  return String((e && e.response && e.response.data && e.response.data.error) || (e && e.data && e.data.error) || (e && e.message) || e || 'errore sconosciuto');
}

// Il corpo della richiesta senza consumarlo: il lavoro lo deve leggere dopo.
async function corpoDellaRichiesta(req) {
  try {
    if (req && typeof req.clone === 'function') return (await req.clone().json()) || {};
    if (req && typeof req.json === 'function') return (await req.json()) || {};
  } catch (_e) { /* senza corpo: un oggetto vuoto */ }
  return {};
}

/**
 * Com'e' andato un giro, dalla risposta del lavoro. null = non si scrive niente
 * (un rinvio). La risposta si legge da una copia, cosi' resta intatta per chi
 * l'aspetta.
 */
export async function giudicaRisposta(voce, risposta) {
  let j = null;
  try { j = risposta && typeof risposta.clone === 'function' ? await risposta.clone().json() : null; } catch (_e) { j = null; }
  if (j && j.rinviato === true) return null;
  const stato = risposta && Number(risposta.status);
  if (stato >= 400) return { esito: 'fallito', errore: (j && (j.error || j.errore)) || `risposta ${stato}` };
  const giudizio = voce && voce.giudica && j ? voce.giudica(j) : null;
  if (giudizio) return giudizio;
  let sintesi = '';
  try { sintesi = voce && voce.sintesi && j ? voce.sintesi(j) : ''; } catch (_e) { sintesi = ''; }
  return { esito: 'riuscito', sintesi };
}

/**
 * Scrive il battito: una riga per lavoro, che si riscrive. Solo l'amministratore
 * (il lavoro pianificato gira come lui), e mai un errore che risalga: se la riga
 * non si scrive, il lavoro e la sua risposta restano quelli che sono.
 */
export async function registraBattito(base44, nome, { partenza, esito, errore = '', sintesi = '' }) {
  try {
    const b = typeof base44 === 'function' ? base44() : base44;
    if (!b) return false;
    const user = await b.auth.me().catch(() => null);
    if (!eAmministratore(user)) return false;
    const E = b.asServiceRole.entities.EsecuzioneLavoro;
    const gia = (await E.filter({ lavoro: nome })) || [];
    const prima = gia[0] || null;
    const il = new Date(partenza).toISOString();
    const riga = {
      lavoro: nome,
      ultima_partenza: il,
      ultimo_esito: esito,
      durata_ms: Math.max(0, Date.now() - partenza),
      sintesi: esito === 'riuscito' ? taglia(sintesi) : '',
      errore: esito === 'riuscito' ? '' : taglia(errore),
      ...(esito === 'riuscito'
        ? { ultima_riuscita: il, fallimenti_di_fila: 0 }
        : { fallimenti_di_fila: (Number(prima && prima.fallimenti_di_fila) || 0) + 1 }),
    };
    if (prima) {
      await E.update(prima.id, riga);
      // Due righe dello stesso lavoro sarebbero due storie: le altre si tolgono.
      for (const d of gia.slice(1)) await E.delete(d.id).catch(() => {});
    } else {
      // IL PRIMO GIRO REGISTRATO (revisione delle migliorie, 11/10/2026). Per un
      // lavoro che non e' mai riuscito la dashboard conta i giri mancati da qui,
      // questo compreso (presidi.ts): se nasce fallito, e' gia' un giro mancato.
      // Contando dalla nascita della riga, che e' la fine del giro, il primo
      // fallimento non contava, e il controllo normativo che non riesce al primo
      // giro col battito (01/11/2026) sarebbe rimasto zitto un mese. Non si
      // riscrive piu'.
      await E.create({ ...riga, prima_partenza: il });
    }
    return true;
  } catch (_e) {
    return false;
  }
}

/**
 * L'INVOLUCRO. Il lavoro (fn) gira come prima e la sua risposta esce com'e'; in
 * piu' resta il battito. `base44` e' il client, o una funzione che lo crea solo
 * se serve; `req` serve a chi ha `eIlLavoro`, per guardare il corpo senza
 * consumarlo. Un errore lanciato dal lavoro si registra e si rilancia, lo stesso.
 *
 *   export default async function(req) {
 *     return conBattito(() => conLimiteRichieste(createClientFromRequest(req)), 'nome', () => lavoro(req), req);
 *   }
 */
export async function conBattito(base44, nome, fn, req = null) {
  const voce = lavoroDi(nome);
  if (voce && voce.eIlLavoro) {
    const corpo = await corpoDellaRichiesta(req);
    let e = false;
    try { e = !!voce.eIlLavoro(corpo || {}); } catch (_e) { e = false; }
    if (!e) return fn();
  }
  const partenza = Date.now();
  let risposta;
  try {
    risposta = await fn();
  } catch (errore) {
    await registraBattito(base44, nome, { partenza, esito: 'fallito', errore: messaggioErrore(errore) });
    throw errore;
  }
  const giudizio = await giudicaRisposta(voce, risposta);
  if (giudizio) await registraBattito(base44, nome, { partenza, ...giudizio });
  return risposta;
}
