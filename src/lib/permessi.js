import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';

// Chi puo' fare che cosa, lato browser.
//
// Il gestionale ha un solo amministratore: e' l'unico che carica file, importa
// dati e modifica i moduli. Tutti gli altri lo usano per lavorare -- consultano
// ogni pagina ed esportano quello che serve -- ma non scrivono nulla; se hanno
// bisogno di un caricamento o di una correzione aprono una richiesta, che
// l'amministratore valuta e poi esegue lui.
//
// Qui si nascondono i comandi e si fermano le scritture partite per sbaglio.
// Il controllo che conta davvero resta quello del server, in
// base44/shared/permessi.ts: il browser e' comodo, non e' una serratura.

export const MESSAGGIO_SOLA_LETTURA =
  "Questa operazione è riservata all'amministratore. Puoi consultare ed esportare tutto: per un caricamento o una correzione apri una richiesta dal modulo Richieste.";

// Le uniche cose che un utente scrive sono le proprie: la richiesta
// all'amministratore e le esercitazioni del corso.
const ENTITA_LIBERE = new Set(['RichiestaUtente', 'EsercitazioneRT']);
const METODI_SCRITTURA = ['create', 'update', 'delete', 'bulkCreate', 'bulkUpdate', 'bulkDelete', 'deleteMany', 'updateMany'];

let ruoloCorrente = null;
let promessaRuolo = null;

/** Il ruolo dell'utente collegato, tenuto da parte dopo l'autenticazione. */
export function ricordaRuolo(user) {
  ruoloCorrente = user ? user.role || null : null;
}

async function ruolo() {
  if (ruoloCorrente) return ruoloCorrente;
  if (!promessaRuolo) {
    promessaRuolo = base44.auth.me()
      .then((u) => { ruoloCorrente = (u && u.role) || null; return ruoloCorrente; })
      .catch(() => null);
  }
  return promessaRuolo;
}

/** Permessi della pagina: chi guarda e se puo' cambiare qualcosa. */
export function usePermessi() {
  const { user, isLoadingAuth } = useAuth();
  const isAdmin = !!user && user.role === 'admin';
  return { user, isAdmin, soloLettura: !isAdmin, caricamento: isLoadingAuth };
}

/**
 * Rete di sicurezza: se un comando di scrittura sfugge e viene premuto da chi
 * non e' amministratore, la chiamata non parte e l'errore spiega il perche'.
 */
export function proteggiScritture() {
  if (base44.__scrittureProtette) return;
  const originale = base44.entities;
  if (!originale) return;
  const protetta = new Proxy({}, {
    get(_t, nome) {
      const gestore = originale[nome];
      if (!gestore || typeof nome !== 'string' || ENTITA_LIBERE.has(nome)) return gestore;
      return new Proxy(gestore, {
        get(g, metodo) {
          const valore = g[metodo];
          if (typeof valore !== 'function' || !METODI_SCRITTURA.includes(metodo)) return valore;
          return async (...args) => {
            if (await ruolo() !== 'admin') throw new Error(MESSAGGIO_SOLA_LETTURA);
            return valore.apply(g, args);
          };
        },
      });
    },
  });
  try {
    Object.defineProperty(base44, 'entities', { get: () => protetta, configurable: true });
    base44.__scrittureProtette = true;
  } catch (_e) { /* se la proprieta' non si puo' ridefinire restano i controlli del server */ }
}
