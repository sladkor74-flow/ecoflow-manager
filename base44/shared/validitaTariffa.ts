// QUANDO UNA TARIFFA VALE: UNA REGOLA SOLA (chiusura dell'audit, 11/10/2026).
//
// Prima la stessa domanda aveva quattro risposte. La fattura attiva e la passiva
// tenevano anche le tariffe «non_attivo» purche' avessero una data di fine; il
// foglio dell'amministrazione e la lista dell'anno nuovo le scartavano. Dal
// 06/10/2026 tutte le tariffe seminate hanno una data di fine, quindi una
// tariffa messa a non_attivo avrebbe continuato a fatturare nella sua finestra,
// mentre il foglio e la lista dicevano che non c'era: due moduli, due prezzi.
//
// La regola e' quella che gestisciAnagrafiche scrive dal 19/09/2026: rinegoziare
// un prezzo CHIUDE la tariffa vecchia con la data di fine e la lascia 'attivo',
// perche' resti buona per i mesi gia' fatti; lo stato 'non_attivo' vuol dire
// «non deve valere mai», e quindi esclude sempre. Lo stato vuoto e' 'attivo',
// che e' il valore predefinito dello schema.
//
// A decidere in quale giorno vale e' la finestra di validita', confrontata col
// giorno italiano: una tariffa che finisce il 30 giugno vale per tutto il 30
// giugno, anche per un trasporto memorizzato alle 23 con l'ora vera.
//
// La usano la fattura attiva (ecotyreTariffe.ts), la passiva (passivaCalcolo.ts),
// il foglio dell'amministrazione (src/lib/passivaAmministrazione.js, dallo
// specchio src/lib/validitaTariffa.js) e la lista dell'anno nuovo
// (inizializzazioneAnno.ts).
import { giornoRoma } from "./giornoItaliano.ts";

/** Vero se la tariffa non e' disattivata: 'non_attivo' non vale mai, lo stato vuoto e' 'attivo'. */
export const tariffaNonDisattivata = (t) => !!t && String(t.stato || 'attivo') !== 'non_attivo';

/** Le tariffe che possono valere in almeno un giorno: tutte tranne le disattivate. */
export const tariffeNonDisattivate = (tariffe) => (tariffe || []).filter(tariffaNonDisattivata);

/**
 * Vero se la tariffa vale nel giorno `quando` (una data o un istante, letto sul
 * giorno italiano): non disattivata, e il giorno sta fra inizio e fine di
 * validita', estremi compresi. Senza inizio vale da sempre, senza fine per
 * sempre. Senza un giorno leggibile non vale: una tariffa con una validita' non
 * si sceglie a caso.
 */
export function tariffaValeIl(t, quando) {
  if (!tariffaNonDisattivata(t)) return false;
  const giorno = giornoRoma(quando);
  if (!giorno) return false;
  const inizio = String(t.data_inizio_validita || '').slice(0, 10);
  if (inizio && inizio > giorno) return false;
  const fine = String(t.data_fine_validita || '').slice(0, 10);
  if (fine && fine < giorno) return false;
  return true;
}

/**
 * Le tariffe 'non_attivo' CON UNA DATA DI FINE che si sovrappone al periodo
 * [dal, al] (giorni 'aaaa-mm-gg'). Fino all'11/10/2026 la fattura e la passiva
 * le facevano valere nella loro finestra; da quel giorno non valgono piu'. Se
 * ce n'e' una, chi calcola il mese lo dice: un prezzo che smette di valere non
 * deve sparire in silenzio, e se deve valere basta rimetterla attiva.
 */
export function disattivateNelPeriodo(tariffe, dal, al) {
  return (tariffe || []).filter(t => {
    if (!t || tariffaNonDisattivata(t)) return false;
    const fine = String(t.data_fine_validita || '').slice(0, 10);
    if (!fine) return false;
    const inizio = String(t.data_inizio_validita || '').slice(0, 10);
    return fine >= dal && (!inizio || inizio <= al);
  });
}
