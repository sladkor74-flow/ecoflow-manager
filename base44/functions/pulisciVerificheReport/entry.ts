import alleggerisciDocumenti from "../alleggerisciDocumenti/entry.ts";

// VECCHIO NOME della pulizia notturna, tenuto solo per non lasciare a vuoto un
// lavoro pianificato che ancora lo chiami.
//
// Fino al 29/09/2026 questa funzione CANCELLAVA le verifiche dei report
// settimanali arrivate al quarantesimo giorno: spariva il record intero, storia
// compresa. L'utente ha chiesto il contrario - via il peso, resti la storia
// scritta - e il lavoro adesso lo fa alleggerisciDocumenti, che oltre alle
// verifiche si occupa di quadrature FIR, consuntivi, liste degli assegnati e
// controlli dell'evasione.
//
// Qui non si cancella piu' niente: si passa la richiesta cosi' com'e'. Chiamarla
// due volte nella stessa notte non fa danno, perche' la seconda non trova piu'
// niente da togliere.

export default async function(req) {
  return alleggerisciDocumenti(req);
}
