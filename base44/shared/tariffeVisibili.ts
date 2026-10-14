// CHI LEGGE LE TARIFFE (decisione del 14/10/2026: «per me ok sulle cose da
// sistemare», sulle migliorie proposte quel giorno).
//
// Tariffa la legge solo l'amministratore (rls.read come la scrittura): le
// tariffe PASSIVE sono i prezzi dei fornitori, cioe' i costi, e i costi li vede
// solo lui. Fino al 14/10/2026 la lettura era aperta a chiunque fosse
// collegato: il gestionale le mostrava al solo amministratore, ma dal browser,
// con gli strumenti dello sviluppatore, chiunque leggeva l'archivio intero.
// E' la stessa strada del 13/10/2026 per SurplusTariffa (surplusVisibile.ts).
//
// Chi non e' amministratore ha bisogno delle sole tariffe ATTIVE, quello che
// SMOCO fattura a Ecotyre: la pagina Extra Raccolta sceglie con quelle il prezzo
// di un intervento senza prezzo scritto, come la fattura. Gliele da' la funzione
// di sola lettura leggiTariffe, con le regole di questo file; nel browser si
// chiede da src/lib/leggiTariffe.js.
//
// LA PARTE ATTIVA E' UN ELENCO DI CAMPI SCRITTO, non il record meno qualcosa: un
// campo che domani si aggiunge all'archivio non arriva a chi non e'
// amministratore finche' non lo si aggiunge qui. Sono i campi con cui la tariffa
// attiva si sceglie e si applica (findTariffa e prezzoAttivoExtra di
// ecotyreTariffe, tariffeAttiveValide): direzione, cliente, canale, la dicitura
// del servizio, regione e provincia, classe, codice EER, unita' e valore, le date
// e lo stato. Restano fuori le note (possono dire di un accordo, e a video non
// servono), i campi delle sole passive (fornitore, prestazione, destinazione,
// tratta, prezzo unico) e quelli della piattaforma (created_by e' un indirizzo
// email). L'ordine resta quello in cui arrivano: la funzione le legge per data
// di creazione, la piu' recente prima, come le leggeva la pagina, e fra due
// tariffe ugualmente specifiche decide quello (sortTariffe).
//
// Una tariffa senza direzione e' passiva: e' stata scritta prima che il campo
// esistesse (gestisciAnagrafiche e campoRiservato la leggono cosi'), e un costo
// non si manda per sbaglio. Le disattivate restano: il calcolo le toglie in
// memoria (tariffeAttiveValide), per tutti allo stesso modo. Prove:
// prove/tariffeRiservate.mjs.

/** I campi di una tariffa attiva che arrivano a chi non e' amministratore. */
export const CAMPI_TARIFFA_ATTIVA = [
  'id', 'direzione', 'cliente', 'tipologia', 'servizio_ecotyre', 'regione', 'provincia',
  'classe_materiale', 'eer_codice', 'unita_misura', 'valore',
  'data_inizio_validita', 'data_fine_validita', 'stato',
];

/** Vero se la tariffa e' attiva (quello che SMOCO fattura a Ecotyre); senza direzione e' passiva. */
export function eTariffaAttiva(t) {
  return !!t && String(t.direzione || 'PASSIVA').trim().toUpperCase() === 'ATTIVA';
}

/** Una tariffa attiva come la riceve chi non e' amministratore: i soli CAMPI_TARIFFA_ATTIVA. */
export function parteAttivaTariffa(t) {
  const out = {};
  for (const k of CAMPI_TARIFFA_ATTIVA) if (t[k] !== undefined) out[k] = t[k];
  return out;
}

/**
 * Le tariffe come le puo' leggere chi chiede: all'amministratore tutte, com'e'
 * scritto l'archivio; agli altri le sole attive, coi soli campi che servono.
 * amministratore deve essere proprio true: senza si nega, perche' un costo detto
 * per sbaglio non si ritira.
 */
export function tariffePerChiLegge(tariffeAll, amministratore) {
  const tutte = (tariffeAll || []).filter(Boolean);
  if (amministratore === true) return tutte;
  return tutte.filter(eTariffaAttiva).map(parteAttivaTariffa);
}
