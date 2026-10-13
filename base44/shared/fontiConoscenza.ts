// LE FONTI DI ECOTYNA E DELLA BASE DI CONOSCENZA: come si scrivono e quando
// dicono il vero (segnalazioni alte del 20/09/2026 A71, A72 e A76, corrette il
// 12/10/2026, quando l'utente ha chiesto un'EcoTyna "piu' realistica").
//
// Tre difetti, tutti dello stesso tipo: una certezza dichiarata che nessuno
// aveva verificato.
// - A72: le FAQ salvate da «Corretta, salva come FAQ» portano le fonti della
//   risposta come oggetti { titolo, riferimento, url }, e la base di conoscenza
//   le leggeva con map(String): nel testo che entra nel prompt di EcoTyna, del
//   controllo mensile, del corso e della qualifica diventavano «[object Object]».
//   Ora ogni fonte si legge come testo, «titolo - riferimento url», anche quelle
//   gia' salvate.
// - A71 e A76: il riquadro «Verificata sulle fonti» si accendeva quando la
//   ricerca online era accesa, non quando una fonte ufficiale era citata. Ora
//   vuole una fonte su un sito ufficiale (con la ricerca accesa: un indirizzo
//   scritto a memoria non e' una verifica) o una voce della base di conoscenza.
//
// Originale per le funzioni; lo specchio per le pagine e' src/lib/fontiConoscenza.js,
// identico a meno dell'intestazione. Non importa niente, cosi' lo leggono anche
// le prove in node.

/**
 * I siti delle fonti ufficiali, gli stessi di FONTI_UFFICIALI in
 * baseConoscenza.ts (lo controlla prove/ecotynaFonti.mjs). Vale anche un
 * sottodominio: www.normattiva.it e' normattiva.it.
 */
export const DOMINI_UFFICIALI = ['normattiva.it', 'gazzettaufficiale.it', 'rentri.gov.it', 'albonazionalegestoriambientali.it', 'mase.gov.it'];

/**
 * Una fonte come testo. Le fonti delle voci scritte a mano sono gia' testo; quelle
 * delle FAQ nate da una risposta sono oggetti: diventano «titolo - riferimento url».
 */
export function testoFonte(f) {
  if (f === null || f === undefined) return '';
  if (typeof f !== 'object') return String(f).trim();
  const testa = [f.titolo, f.riferimento].map(x => String(x ?? '').trim()).filter(Boolean).join(' - ');
  const url = String(f.url ?? '').trim();
  return [testa, url].filter(Boolean).join(' ');
}

/** Le fonti di un fonti_json come testi; un JSON illeggibile non ha fonti. */
export function leggiFontiTesto(json) {
  let v = [];
  try { v = JSON.parse(json || '[]'); } catch { return []; }
  return (Array.isArray(v) ? v : []).map(testoFonte).filter(Boolean);
}

/** true se l'indirizzo e' su uno dei siti ufficiali. */
export function urlUfficiale(url) {
  const m = String(url || '').trim().match(/^https?:\/\/([^/?#:\s]+)/i);
  if (!m) return false;
  const host = m[1].toLowerCase().replace(/\.$/, '');
  return DOMINI_UFFICIALI.some(d => host === d || host.endsWith('.' + d));
}

/**
 * Se una fonte di una risposta e' ufficiale. Le risposte dal 12/10/2026 lo
 * portano scritto (ufficiale); quelle di prima no, e per loro vale l'indirizzo,
 * ma solo se la ricerca online era accesa.
 */
export function fonteUfficiale(f, ricercaOnline) {
  if (!f || typeof f !== 'object') return false;
  if (typeof f.ufficiale === 'boolean') return f.ufficiale;
  return !!ricercaOnline && urlUfficiale(f.url);
}

/**
 * Il riquadro «Verificata sulle fonti»: almeno una fonte ufficiale citata, o una
 * voce della base di conoscenza usata (voce). La ricerca accesa da sola non basta.
 */
export function verificataSulleFonti(fonti, ricercaOnline) {
  return (Array.isArray(fonti) ? fonti : []).some(f => !!(f && typeof f === 'object' && (f.voce || fonteUfficiale(f, ricercaOnline))));
}
