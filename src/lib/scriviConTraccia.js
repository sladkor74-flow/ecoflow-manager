// LE SCRITTURE TRACCIATE DELLE PAGINE (11/10/2026).
//
// Ogni scrittura a mano di un numero che fa i conti - target, aperture,
// commessa, dichiarazioni, costi e prezzi dell'extra raccolta, voci della
// passiva - passa di qui: si rilegge il record, si scrive, e i campi tracciati
// che cambiano finiscono in ModificaDato con chi, quando, da dove e perche'.
// La regola (quali campi, quando un valore e' cambiato) e il motore stanno in
// src/lib/campiTracciati.js, specchio di base44/shared/campiTracciati.ts: le
// funzioni tracciano allo stesso modo con shared/traccia.ts.
//
// Se il dato si scrive e la traccia no, il dato resta e lo si dice: ogni
// risposta e' { record, traccia }, e avvisoTraccia(esito) da' il messaggio da
// mostrare (null se e' andato tutto bene). Chi chiama lo mostra: una scrittura
// che finisce fuori dallo storico senza dirlo e' proprio il buco che questo
// file chiude. prove/scrittureTracciate.mjs fallisce se una pagina scrive un
// archivio tracciato senza passare di qui.
import { base44 } from '@/api/base44Client';
import { scriviTracciato, eliminaTracciato, creaTracciati, eliminaTracciati, notaTraccia } from '@/lib/campiTracciati';

export { notaTraccia };

// Chi scrive si legge una volta per sessione: e' sempre l'amministratore
// collegato, e chiederlo a ogni salvataggio costerebbe una richiesta in piu'.
let promessaUtente = null;
function chiScrive() {
  if (!promessaUtente) {
    promessaUtente = Promise.resolve()
      .then(() => base44.auth.me())
      .then((u) => String((u && (u.full_name || u.email)) || '').trim())
      .catch(() => { promessaUtente = null; return ''; });
  }
  return promessaUtente;
}

// Da dove: la pagina che si ha davanti, se chi chiama non lo dice meglio.
const paginaCorrente = () => {
  try { return (typeof window !== 'undefined' && window.location && window.location.pathname) || ''; } catch { return ''; }
};

async function conChi(opzioni) {
  return {
    ...opzioni,
    utente: opzioni.utente || await chiScrive(),
    origine: opzioni.origine || paginaCorrente(),
  };
}

/**
 * Crea (id vuoto) o modifica un record di `entita`, tracciando i campi che
 * cambiano. opzioni: { motivo, etichetta, origine }. Restituisce
 * { record, traccia }; lancia solo se il dato non si e' potuto scrivere.
 */
export async function scriviConTraccia(entita, id, patch, opzioni = {}) {
  return scriviTracciato(base44.entities, entita, id || null, patch, await conChi(opzioni));
}

/** Cancella un record tracciato. opzioni.prima evita la rilettura quando il record e' gia' in mano. */
export async function eliminaConTraccia(entita, id, opzioni = {}) {
  return eliminaTracciato(base44.entities, entita, id, await conChi(opzioni));
}

/** Crea tanti record insieme (il modello o la copia della passiva), con una scrittura sola nel registro. */
export async function creaMoltiConTraccia(entita, righe, opzioni = {}) {
  return creaTracciati(base44.entities, entita, righe, await conChi(opzioni));
}

/** Cancella tanti record gia' in mano (le voci che un modello sostituisce), con una scrittura sola nel registro. */
export async function eliminaMoltiConTraccia(entita, records, opzioni = {}) {
  return eliminaTracciati(base44.entities, entita, records, await conChi(opzioni));
}

/**
 * Il messaggio per il toast quando il dato e' salvato ma la traccia no; null
 * se non c'e' niente da dire. Accetta uno o piu' esiti, o la traccia rimandata
 * da una funzione.
 */
export function avvisoTraccia(...esiti) {
  const nota = esiti.map(notaTraccia).find(Boolean);
  return nota ? { title: 'Salvato, ma fuori dallo storico', description: nota } : null;
}
