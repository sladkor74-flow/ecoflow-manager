// CHI LEGGE IL SURPLUS SULLE TARIFFE (decisione del 13/10/2026).
//
// SurplusTariffa lo legge solo l'amministratore (rls.read come la scrittura):
// dentro c'e' euro_t_passiva, quanto SMOCO paga in piu' ai fornitori, che e' un
// costo, e un accordo commerciale pagato solo da SMOCO e' tutto un costo, nome e
// fornitori compresi. Chi non e' amministratore ha bisogno della sola parte
// attiva, quella che SMOCO fattura in piu' a Ecotyre (il Fuel Surcharge del
// consorzio, +5 €/t): la pagina Extra Raccolta la mostra nei riquadri, nelle
// fasce e nei file dell'elenco. Gliela da' la funzione di sola lettura
// leggiSurplus, con le regole di questo file; nel browser si chiede da
// src/lib/leggiSurplus.js.
//
// LA PARTE ATTIVA E' UN ELENCO DI CAMPI SCRITTO, non il record meno
// euro_t_passiva: un campo che domani si aggiunge all'archivio non arriva a chi
// non e' amministratore finche' non lo si aggiunge qui (la stessa scelta di
// getRiepilogoEcotyre, vedi «I costi dei fornitori sono dell'amministratore» in
// AGENTS.md). Sono i campi che il calcolo dell'attiva legge (surplusDelMovimento
// e i suoi vicini in surplus.ts) e quelli che la pagina scrive a video: nome,
// origine (per «consorzio Ecotyre»), canale, prestazione, a chi, l'importo da
// Ecotyre, le date e lo stato. Restano fuori euro_t_passiva, riferimento e note
// (come in EcoTyna), il gruppo e i campi della piattaforma (created_by e' un
// indirizzo email).
//
// fornitori_json va solo con «solo questi»: con un elenco la parte attiva vale
// sulle tonnellate di quei fornitori (il raccoglitore per la raccolta, la
// destinazione per trattamento e stoccaggio), e senza l'elenco la pagina non
// saprebbe su quali. Con «tutti» l'elenco non conta (fornitoriDelSurplus) e un
// elenco rimasto scritto da prima non si manda.
//
// Un surplus senza parte attiva - un accordo solo passivo, o uno sul trasporto
// delle secondarie, che a Ecotyre non si fattura - non si nomina nemmeno, come
// in EcoTyna e nello storico delle modifiche (campoRiservato). I disattivati
// restano: si leggono tutti e il calcolo li toglie in memoria, per tutti allo
// stesso modo. Prove: prove/chiLeggeCosa.mjs.
import { euroTDi } from "./surplus.ts";

/** I campi di un surplus che arrivano a chi non e' amministratore. */
export const CAMPI_PARTE_ATTIVA = ['id', 'nome', 'origine', 'tipologia', 'prestazione', 'a_chi', 'euro_t_attiva', 'data_inizio_validita', 'data_fine_validita', 'stato'];

const codice = (v) => String(v || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
const conElenco = (s) => String((s && s.a_chi) || 'tutti').trim().toLowerCase() === 'elenco';

/**
 * Vero se il surplus ha una parte da fatturare a Ecotyre: un importo attivo
 * valido (euroTDi) e una prestazione che si fattura, cioe' non il trasporto
 * delle secondarie (surplusDelMovimento lo salta nell'attiva).
 */
export function haParteAttiva(s) {
  return !!s && euroTDi(s, 'ATTIVA') !== null && codice(s.prestazione) !== 'TRASPORTO_SECONDARIA';
}

/** La parte attiva di un surplus: i soli CAMPI_PARTE_ATTIVA, e l'elenco dei fornitori se e' «solo questi». */
export function parteAttiva(s) {
  const out = {};
  for (const k of CAMPI_PARTE_ATTIVA) if (s[k] !== undefined) out[k] = s[k];
  out.euro_t_attiva = euroTDi(s, 'ATTIVA');
  if (conElenco(s) && s.fornitori_json !== undefined) out.fornitori_json = s.fornitori_json;
  return out;
}

/**
 * I surplus come li puo' leggere chi chiede: all'amministratore tutti, com'e'
 * scritto l'archivio; agli altri la sola parte attiva dei surplus che Ecotyre
 * paga. amministratore deve essere proprio true: senza si nega, perche' un costo
 * detto per sbaglio non si ritira.
 */
export function surplusPerChiLegge(surplusAll, amministratore) {
  const tutti = (surplusAll || []).filter(Boolean);
  if (amministratore === true) return tutti;
  return tutti.filter(haParteAttiva).map(parteAttiva);
}
