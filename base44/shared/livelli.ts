// I livelli di accesso al gestionale.
//
// La piattaforma conosce due soli ruoli, amministratore e utente. I livelli
// intermedi li tiene il gestionale, nell'entita' LivelloUtente: una riga per
// persona, con l'email come chiave. Il livello vero di chi sta lavorando e'
// quello che dice questo file, non quello che dice il browser.
//
// Per aggiungere un livello nuovo si scrive una voce qui e una uguale nello
// specchio per il browser, src/lib/livelli.js: l'elenco dei permessi e' quello
// che l'amministratore legge quando assegna il livello, quindi va tenuto vero.

export const CARICAMENTI_OPERATORE_BASE = ['primarie', 'secondarie', 'terziarie'];

export const LIVELLI = {
  admin: {
    chiave: 'admin',
    nome: 'Amministratore',
    sommario: 'Governa il gestionale: carica, modifica, fattura.',
    puo: [
      'Carica e importa qualsiasi file',
      'Modifica ogni modulo, comprese fatturazione, tariffe e target',
      'Verifica i report degli impianti e gestisce alert e qualifica fornitori',
      'Decide i livelli degli altri utenti',
      'Allega file a EcoTyna (Excel, CSV, Word, PDF, immagini, testo) perché li legga, li controlli e li modifichi',
    ],
    nonPuo: [],
    caricamenti: 'tutti',
  },
  operatore_base: {
    chiave: 'operatore_base',
    nome: 'Operatore base',
    sommario: 'Consulta tutto e carica i tre file del portale: primarie, secondarie, terziarie.',
    puo: [
      'Tutto quello che fa chi e\' in consultazione',
      'Carica il file delle Primarie',
      'Carica il file delle Secondarie',
      'Carica il file delle Terziarie',
    ],
    nonPuo: [
      'Dichiarazioni di trattamento e ordini non dichiarati',
      'Fatturazione, tariffe e target',
      'Giacenze, extra raccolta, verifiche, qualifica fornitori, alert, to-do',
      'Livelli degli utenti',
      'Allegare file a EcoTyna',
    ],
    caricamenti: CARICAMENTI_OPERATORE_BASE,
  },
  consultazione: {
    chiave: 'consultazione',
    nome: 'Consultazione',
    sommario: 'Guarda ed esporta; per modifiche apre una richiesta.',
    puo: [
      'Vede tutti i moduli e tutti i dati',
      'Esporta in Excel e in PDF quello che vede',
      'Usa l\'Assistente e le esercitazioni del corso',
      'Scarica i file che EcoTyna prepara (Excel, CSV, Word, PDF, testo)',
      'Apre richieste all\'amministratore',
    ],
    nonPuo: [
      'Caricare o importare file, compresi gli allegati a EcoTyna',
      'Modificare qualcosa in qualunque modulo',
    ],
    caricamenti: [],
  },
};

export const LIVELLO_PREDEFINITO = 'consultazione';

/** Livello valido, con ritorno al predefinito se la riga dice qualcosa di ignoto. */
export const livelloValido = (v) => (v && LIVELLI[v] ? v : LIVELLO_PREDEFINITO);

export const chiaveEmail = (v) => String(v || '').trim().toLowerCase();

/**
 * Livello di chi ha fatto la richiesta. L'amministratore lo e' per la piattaforma;
 * per tutti gli altri si legge la riga del gestionale.
 */
export async function livelloDi(base44, user) {
  if (!user) return null;
  if (user.role === 'admin') return 'admin';
  try {
    const righe = await base44.asServiceRole.entities.LivelloUtente.filter(
      { email: chiaveEmail(user.email) }, '-updated_date', 1,
    );
    return livelloValido(righe && righe[0] ? righe[0].livello : null);
  } catch (_e) {
    // Se la riga non si riesce a leggere si concede il meno possibile.
    return LIVELLO_PREDEFINITO;
  }
}

/** true se quel livello puo' caricare quel tipo di file. */
export function puoCaricare(livello, tipoFile) {
  const l = LIVELLI[livello];
  if (!l) return false;
  if (l.caricamenti === 'tutti') return true;
  return l.caricamenti.includes(String(tipoFile || '').trim().toLowerCase());
}

/** Risposta per il caricamento che un livello non ha il permesso di fare. */
export function rispostaCaricamentoNegato(livello, tipoFile) {
  const nome = LIVELLI[livello] ? LIVELLI[livello].nome : 'Consultazione';
  return Response.json({
    error: `Il livello ${nome} non puo' caricare questo file (${tipoFile}). Apri una richiesta dal modulo Richieste.`,
    sola_lettura: true,
    dati_intatti: true,
  }, { status: 403 });
}
