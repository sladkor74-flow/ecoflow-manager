// LE SCRITTURE TRACCIATE DELLE FUNZIONI (11/10/2026).
//
// L'involucro lato server dello storico delle modifiche: la regola e il motore
// stanno in campiTracciati.ts, uguali a quelli delle pagine; qui si aggiunge
// soltanto chi scrive (l'utente della richiesta: le funzioni scrivono col ruolo
// di servizio, e senza dirlo la riga direbbe «nessuno») e da quale funzione.
//
// Lo usano gestisciAnagrafiche (le tariffe scritte a mano e quelle chiuse da un
// prezzo nuovo) e preparaAnno (la copia delle tariffe nell'anno nuovo). Una
// funzione che scrive un campo tracciato senza passare di qui la trova
// prove/scrittureTracciate.mjs.
//
// archivi e' base44.asServiceRole.entities. Le risposte hanno la forma
// { record, traccia: { scritta, righe, motivo? } }: la traccia che non si
// scrive non annulla il dato, e la funzione la rimanda a chi ha salvato
// (notaTraccia la dice in una frase).
import { scriviTracciato, eliminaTracciato, creaTracciati, unisciTracce, notaTraccia } from "./campiTracciati.ts";

export { unisciTracce, notaTraccia };

/** Chi scrive, come si legge nello storico: il nome, o l'email. */
export const utenteDellaRichiesta = (user) => String((user && (user.full_name || user.email)) || '').trim();

/**
 * Crea (id vuoto) o modifica un record, registrando i campi tracciati che
 * cambiano. opzioni: { utente, origine, motivo, etichetta }.
 */
export function traccia(archivi, entita, id, patch, opzioni = {}) {
  return scriviTracciato(archivi, entita, id || null, patch, opzioni);
}

/** Cancella un record, registrando che cosa c'era. */
export function eliminaConTraccia(archivi, entita, id, opzioni = {}) {
  return eliminaTracciato(archivi, entita, id, opzioni);
}

/** Crea tanti record insieme, con una sola scrittura nel registro. */
export function creaConTraccia(archivi, entita, righe, opzioni = {}) {
  return creaTracciati(archivi, entita, righe, opzioni);
}
