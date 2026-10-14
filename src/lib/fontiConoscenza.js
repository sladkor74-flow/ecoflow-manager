// Specchio per le pagine di base44/shared/fontiConoscenza.ts: le pagine non
// possono importare da base44/shared. Deve restare IDENTICO all'originale, a
// meno di questa intestazione e degli import. E' nato il 12/10/2026 (segnalazioni
// alte del 20/09, A71, A72 e A76): la chat di EcoTyna e la base di conoscenza
// leggono le fonti come la funzione che le scrive - le FAQ con le fonti come
// testo, non «[object Object]», e il riquadro «Verificata sulle fonti» solo con
// una fonte ufficiale o una voce della base di conoscenza. Chi cambia la regola
// la cambia nell'originale e la ricopia qui.

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

const GIORNO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Il giorno in cui una fonte trovata online e' stata consultata, 'AAAA-MM-GG', o ''.
 *
 * CONSULTATA, NON VERIFICATA (decisione del 13/10/2026). Una pagina trovata con la
 * ricerca online, che nessuna voce della base di conoscenza cita, non l'ha
 * verificata nessuno: la si e' letta il giorno della domanda, e si scrive cosi',
 * «consultata il gg/mm/aaaa», come si cita una pagina internet. «Verificata il»
 * resta solo per le fonti di una voce, con la data della voce. Un indirizzo scritto
 * senza la ricerca accesa e' scritto a memoria: nessun giorno. Le risposte dal
 * 13/10/2026 portano il giorno scritto (consultata_il, lo mette fontiDellaRisposta
 * in baseConoscenza.ts); per quelle di prima vale il giorno della domanda, giorno.
 */
export function consultataIl(f, ricercaOnline, giorno) {
  if (!f || typeof f !== 'object' || f.voce) return '';
  const scritto = String(f.consultata_il || '').slice(0, 10);
  if (GIORNO.test(scritto)) return scritto;
  if (!ricercaOnline || !/^https?:\/\/\S/i.test(String(f.url || '').trim())) return '';
  const g = String(giorno || '').slice(0, 10);
  return GIORNO.test(g) ? g : '';
}
