// Di una data conta il GIORNO, non l'ora, e il giorno e' quello italiano.
//
// I file del portale salvano le date a mezzanotte, ma non sempre a mezzanotte
// UTC: una mezzanotte italiana d'estate arriva nel file come 22:00Z del giorno
// prima. Tagliando la stringa, o leggendo l'ora UTC, si sbaglia il giorno; e a
// cavallo di fine mese si sbaglia il mese, cioe' un trasporto del 1 ottobre
// finisce contato a settembre.
//
// Qui l'istante si converte nel fuso italiano e se ne prende il giorno di
// calendario, che e' il giorno scritto sul formulario. Regola della direzione,
// 19/09/2026: "non conta l'ora ma il giorno indicato, tutti i ragionamenti vanno
// fatti sul giorno, considera sempre l'ora italiana".
//
// Questo file non importa niente apposta: lo usano sia dataEnrichment sia
// raccoltoCalculator, che si importano a vicenda.

// Il formatter si crea una volta sola: viene chiamato su decine di migliaia di righe.
const GIORNO_ROMA = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Il giorno italiano di una data, come 'AAAA-MM-GG'. Stringa vuota se non e' una data. */
export function giornoRoma(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  return GIORNO_ROMA.format(d);
}

/** L'anno del giorno italiano, oppure null. */
export function annoRoma(v) {
  const g = giornoRoma(v);
  return g ? Number(g.slice(0, 4)) : null;
}

/** L'indice del mese (0-11) del giorno italiano, oppure -1. */
export function meseRoma(v) {
  const g = giornoRoma(v);
  return g ? Number(g.slice(5, 7)) - 1 : -1;
}

/** Oggi, in Italia. */
export const oggiRoma = () => GIORNO_ROMA.format(new Date());
