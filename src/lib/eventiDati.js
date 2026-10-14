import { useEffect, useRef } from 'react';

// I TARGET CAMBIATI ARRIVANO ANCHE ALLE PAGINE GIA' APERTE (14/10/2026).
//
// Richiesta dell'utente del 14/10/2026, dopo la variazione del contratto di
// ottobre (Puglia, +100 t, IRIGOM), testuale: «fai in modo che quando si faccia
// una tale variazione i moduli collegati come la dashboard si aggiornino di
// conseguenza». Le funzioni leggono il contratto e i target quando sono
// chiamate, ma le pagine li chiedono quando si aprono: la dashboard aperta in
// un'altra scheda del browser restava a 11.550 t finche' non la si ricaricava,
// e la scheda Commessa aperta prima della variazione e salvata dopo l'avrebbe
// tolta dai numeri senza avvisare.
//
// CHI SCRIVE il contratto o i target, a scrittura riuscita, chiama
// annunciaTarget({ anno, parti, origine }). parti dice che cosa e' cambiato:
// 'contratto' (CommessaEcotyre), 'annui' (TargetRaccoglitore), 'mensili'
// (TargetMensile). Il messaggio arriva alla stessa scheda con un evento della
// finestra (EVENTO_TARGET, come EVENTO_TODO, EVENTO_AGGIORNAMENTO ed
// EVENTO_LIVELLO) e alle altre schede dello stesso browser con un
// BroadcastChannel. Niente localStorage, che in una finestra privata o coi dati
// del sito bloccati manca: dove manca anche il canale, le altre schede si
// aggiornano alla prossima apertura come prima, e niente si rompe (ogni passo
// sta in un try).
//
// CHI MOSTRA quei numeri usa useTargetCambiati(interessa, rileggi): interessa
// dice che cosa rileggere per quel messaggio (un elenco vuoto: nessuna
// lettura), rileggi rilegge solo quello, mai la pagina intera. Il limite di
// richieste della piattaforma vale per tutta l'app (22/09/2026), quindi:
//  - una raffica (le celle dei target scritte una dopo l'altra) fa una
//    rilettura sola: si aspetta ATTESA_RILETTURA_MS dal primo messaggio e si
//    rilegge l'insieme;
//  - fra due riletture passano almeno INTERVALLO_RILETTURE_MS: chi tiene la
//    dashboard aperta accanto mentre scrive i target non la fa rileggere a ogni
//    cella;
//  - una scheda nascosta non rilegge: lo fa una volta sola quando torna
//    visibile;
//  - durante una rilettura non ne parte un'altra: la prossima parte dopo, una.
// Chi ha scritto non rilegge per il suo messaggio (origine, una per ogni pagina
// montata): si e' gia' rimesso i dati da se'.

export const EVENTO_TARGET = 'target-cambiati';
export const CANALE_TARGET = 'target-cambiati';
export const PARTI_TARGET = ['contratto', 'annui', 'mensili'];
export const ATTESA_RILETTURA_MS = 1500;
export const ATTESA_AL_RITORNO_MS = 200;
export const INTERVALLO_RILETTURE_MS = 30000;

/** Il messaggio ripulito ({ anno, parti, origine }), o null se non dice niente di utile. */
export function messaggioTarget(m) {
  if (!m || typeof m !== 'object') return null;
  const anno = Number(m.anno);
  if (!Number.isInteger(anno) || anno < 2000) return null;
  const parti = PARTI_TARGET.filter(p => Array.isArray(m.parti) && m.parti.includes(p));
  if (!parti.length) return null;
  return { anno, parti, origine: typeof m.origine === 'string' ? m.origine : '' };
}

// Un canale solo per scheda: un BroadcastChannel non riceve i suoi messaggi,
// quindi la scheda che scrive li riceve solo dall'evento della finestra, una
// volta, e le altre solo dal canale. undefined: non ancora aperto; null: il
// browser non lo ha.
let canale;
function canaleDellaScheda() {
  if (canale !== undefined) return canale;
  canale = null;
  try {
    if (typeof BroadcastChannel === 'function') canale = new BroadcastChannel(CANALE_TARGET);
  } catch (_e) { canale = null; }
  return canale;
}

/** Dice alla scheda e alle altre schede aperte che il contratto o i target di un anno sono cambiati. */
export function annunciaTarget(m) {
  const msg = messaggioTarget(m);
  if (!msg) return null;
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent(EVENTO_TARGET, { detail: msg }));
    }
  } catch (_e) { /* la scheda si aggiorna alla prossima apertura */ }
  try {
    const c = canaleDellaScheda();
    if (c) c.postMessage(msg);
  } catch (_e) { /* le altre schede si aggiornano alla prossima apertura */ }
  return msg;
}

/** Ascolta i messaggi, dalla scheda e dalle altre; restituisce chi smette di ascoltare. */
export function ascoltaTarget(fn) {
  const su = (dato) => {
    const msg = messaggioTarget(dato);
    if (!msg) return;
    try { fn(msg); } catch (_e) { /* chi ascolta non ferma gli altri */ }
  };
  const daFinestra = (e) => su(e && e.detail);
  const daCanale = (e) => su(e && e.data);
  let finestra = null;
  let c = null;
  try {
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener(EVENTO_TARGET, daFinestra);
      finestra = window;
    }
  } catch (_e) { finestra = null; }
  try {
    c = canaleDellaScheda();
    if (c) c.addEventListener('message', daCanale);
  } catch (_e) { c = null; }
  return () => {
    try { if (finestra) finestra.removeEventListener(EVENTO_TARGET, daFinestra); } catch (_e) { /* niente da togliere */ }
    try { if (c) c.removeEventListener('message', daCanale); } catch (_e) { /* niente da togliere */ }
  };
}

/** La scheda e' nascosta (un'altra scheda davanti, finestra ridotta)? Nel dubbio no. */
export function schedaNascosta() {
  try { return typeof document !== 'undefined' && document.visibilityState === 'hidden'; } catch (_e) { return false; }
}

/**
 * La coda delle riletture di una pagina: raccoglie quello che c'e' da rileggere
 * e chiama rileggi(elenco) una volta per raffica, mai a scheda nascosta, mai
 * due insieme, e non piu' di una volta ogni `intervallo` millisecondi.
 */
export function codaRiletture({ rileggi, attesa = ATTESA_RILETTURA_MS, alRitorno = ATTESA_AL_RITORNO_MS, intervallo = INTERVALLO_RILETTURE_MS, nascosta = schedaNascosta, adesso = () => Date.now() }) {
  let daRileggere = new Set();
  let timer = null;
  let inCorso = false;
  let ultima = null;
  let fermata = false;
  const programma = (ritardo) => {
    if (fermata || timer !== null || inCorso || !daRileggere.size || nascosta()) return;
    const ora = adesso();
    const quando = Math.max(ora + ritardo, ultima === null ? ora : ultima + intervallo);
    timer = setTimeout(parti, Math.max(0, quando - ora));
  };
  async function parti() {
    timer = null;
    if (fermata || inCorso || !daRileggere.size) return;
    // nascosta mentre aspettava: rilegge quando torna visibile
    if (nascosta()) return;
    const cosa = [...daRileggere];
    daRileggere = new Set();
    inCorso = true;
    ultima = adesso();
    try { await rileggi(cosa); } catch (_e) { /* chi rilegge dice da se' quello che non e' riuscito */ }
    inCorso = false;
    programma(attesa);
  }
  return {
    aggiungi(cosa) {
      for (const x of cosa || []) daRileggere.add(x);
      programma(attesa);
    },
    visibile() { programma(alRitorno); },
    ferma() {
      fermata = true;
      daRileggere = new Set();
      if (timer !== null) { clearTimeout(timer); timer = null; }
    },
    get daRileggere() { return [...daRileggere]; },
    get inCorso() { return inCorso; },
  };
}

/**
 * Per le pagine: interessa(messaggio) restituisce che cosa rileggere (stringhe
 * della pagina, [] per niente), rileggi(elenco) lo rilegge. Le due funzioni si
 * prendono sempre dall'ultimo disegno, quindi vedono anno e scheda di adesso.
 */
export function useTargetCambiati(interessa, rileggi) {
  const ultime = useRef(null);
  ultime.current = { interessa, rileggi };
  useEffect(() => {
    const coda = codaRiletture({ rileggi: (cosa) => ultime.current.rileggi(cosa) });
    const smetti = ascoltaTarget((m) => {
      let cosa = [];
      try { cosa = ultime.current.interessa(m) || []; } catch (_e) { cosa = []; }
      if (cosa.length) coda.aggiungi(cosa);
    });
    const suVisibilita = () => { if (!schedaNascosta()) coda.visibile(); };
    let doc = null;
    try {
      if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('visibilitychange', suVisibilita);
        doc = document;
      }
    } catch (_e) { doc = null; }
    return () => {
      smetti();
      coda.ferma();
      try { if (doc) doc.removeEventListener('visibilitychange', suVisibilita); } catch (_e) { /* niente da togliere */ }
    };
  }, []);
}

// L'origine di una pagina montata: diversa per ogni montaggio e per ogni
// scheda del browser, cosi' la stessa pagina aperta in due schede non si
// scambia per se stessa.
const SCHEDA = (() => { try { return Math.random().toString(36).slice(2, 8); } catch (_e) { return 'scheda'; } })();
let progressivo = 0;
export function useOrigine(nome) {
  const r = useRef(null);
  if (r.current === null) r.current = `${nome}#${SCHEDA}.${++progressivo}`;
  return r.current;
}

const ORA_ROMA = (() => {
  try { return new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' }); } catch (_e) { return null; }
})();
/** L'ora italiana di adesso, «10:42». */
export const oraRoma = () => { try { return ORA_ROMA ? ORA_ROMA.format(new Date()) : ''; } catch (_e) { return ''; } };

// «quadro ed elenco»: la e davanti a una e diventa ed
const elencoE = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} ${/^[eE]/.test(xs[xs.length - 1]) ? 'ed' : 'e'} ${xs[xs.length - 1]}`);

/**
 * La riga che la pagina scrive dopo una rilettura: che cosa e' cambiato, che
 * cosa si e' riletto e a che ora, e che cosa no col motivo (allora i numeri a
 * video sono quelli di prima, e lo si dice). parti: le parti cambiate;
 * esiti: [{ nome: 'quadro', motivo: '' }], motivo vuoto se riletto.
 */
export function testoRilettura({ parti = [], anno, dove = 'in Target & Status', esiti = [], ora = '' }) {
  const contratto = parti.includes('contratto');
  const raccoglitori = parti.includes('annui') || parti.includes('mensili');
  const soggetto = contratto && raccoglitori ? 'Il contratto Ecotyre e i target dei raccoglitori'
    : contratto ? 'Il contratto Ecotyre' : 'I target dei raccoglitori';
  const verbo = contratto && !raccoglitori ? 'è cambiato' : 'sono cambiati';
  const riletti = esiti.filter(e => !e.motivo).map(e => e.nome);
  const mancati = esiti.filter(e => e.motivo);
  const pezzi = [];
  if (riletti.length) pezzi.push(`${elencoE(riletti)} ${riletti.length === 1 ? 'riletto' : 'riletti'}${ora ? ` alle ${ora}` : ''}`);
  if (mancati.length) {
    const uno = mancati.length === 1;
    pezzi.push(`${elencoE(mancati.map(e => e.nome))} non ${uno ? 'si è riletto' : 'si sono riletti'} (${[...new Set(mancati.map(e => e.motivo))].join('; ')}): ${uno ? 'quello' : 'quelli'} a video ${uno ? 'è' : 'sono'} di prima, ricarica la pagina`);
  }
  return `${soggetto} del ${anno} ${verbo} ${dove}${pezzi.length ? `: ${pezzi.join('; ')}` : ''}.`;
}
