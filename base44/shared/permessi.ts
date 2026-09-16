// Chi puo' fare che cosa.
//
// Il gestionale ha un solo amministratore: e' l'unico che carica file, importa
// dati e modifica qualunque modulo. Tutti gli altri utenti lo usano per lavorare
// -- consultano ogni pagina ed esportano quello che serve -- ma non scrivono
// nulla. Se hanno bisogno di un caricamento o di una correzione aprono una
// richiesta, che l'amministratore valuta e poi esegue lui.
//
// Questo file e' il punto unico della regola sul lato server: nascondere i
// pulsanti non basta, perche' le funzioni si possono chiamare anche da fuori.
// Lo specchio per il frontend e' src/lib/permessi.js.

export const MESSAGGIO_SOLA_LETTURA =
  "Questa operazione e' riservata all'amministratore. Puoi consultare ed esportare tutto; per un caricamento o una correzione apri una richiesta dal modulo Richieste.";

/** Risposta da rimandare a chi non e' amministratore. */
export function rispostaSolaLettura() {
  return Response.json({ error: MESSAGGIO_SOLA_LETTURA, sola_lettura: true }, { status: 403 });
}

/** true se l'utente e' l'amministratore del gestionale. */
export const eAmministratore = (user) => !!user && user.role === 'admin';

/**
 * Utente della richiesta, con il permesso di scrittura gia' deciso.
 * Restituisce { user, puoScrivere, errore }: se errore non e' null va
 * restituito subito, senza toccare i dati.
 */
export async function utenteCorrente(base44) {
  const user = await base44.auth.me().catch(() => null);
  if (!user) return { user: null, puoScrivere: false, errore: Response.json({ error: 'Unauthorized' }, { status: 401 }) };
  return { user, puoScrivere: eAmministratore(user), errore: null };
}

/**
 * Guardia per le funzioni che scrivono: { user, errore }.
 * Se errore non e' null la funzione deve restituirlo e fermarsi.
 */
export async function soloAmministratore(base44) {
  const { user, puoScrivere, errore } = await utenteCorrente(base44);
  if (errore) return { user: null, errore };
  if (!puoScrivere) return { user, errore: rispostaSolaLettura() };
  return { user, errore: null };
}
