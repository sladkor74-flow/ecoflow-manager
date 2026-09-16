// Specchio di base44/shared/livelli.ts per il browser.
//
// Serve a mostrare le cose giuste: quali comandi far vedere e, nel modulo Utenti,
// che cosa si sta concedendo a una persona. Il permesso vero lo decide il server.
// Quando si aggiunge un livello va aggiunto in tutti e due i file.

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
    ],
    nonPuo: [],
    caricamenti: 'tutti',
  },
  operatore_base: {
    chiave: 'operatore_base',
    nome: 'Operatore base',
    sommario: 'Consulta tutto e carica i tre file del portale: primarie, secondarie, terziarie.',
    puo: [
      'Tutto quello che fa chi è in consultazione',
      'Carica il file delle Primarie',
      'Carica il file delle Secondarie',
      'Carica il file delle Terziarie',
    ],
    nonPuo: [
      'Dichiarazioni di trattamento e ordini non dichiarati',
      'Fatturazione, tariffe e target',
      'Giacenze, extra raccolta, verifiche, qualifica fornitori, alert, to-do',
      'Livelli degli utenti',
    ],
    caricamenti: ['primarie', 'secondarie', 'terziarie'],
  },
  consultazione: {
    chiave: 'consultazione',
    nome: 'Consultazione',
    sommario: 'Guarda ed esporta; per modifiche apre una richiesta.',
    puo: [
      'Vede tutti i moduli e tutti i dati',
      'Esporta in Excel e in PDF quello che vede',
      "Usa l'Assistente e le esercitazioni del corso",
      "Apre richieste all'amministratore",
    ],
    nonPuo: [
      'Caricare o importare file',
      'Modificare qualcosa in qualunque modulo',
    ],
    caricamenti: [],
  },
};

export const LIVELLO_PREDEFINITO = 'consultazione';

export const livelloValido = (v) => (v && LIVELLI[v] ? v : LIVELLO_PREDEFINITO);

export const chiaveEmail = (v) => String(v || '').trim().toLowerCase();

export function puoCaricare(livello, tipoFile) {
  const l = LIVELLI[livello];
  if (!l) return false;
  if (l.caricamenti === 'tutti') return true;
  return l.caricamenti.includes(String(tipoFile || '').trim().toLowerCase());
}
