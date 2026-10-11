// Specchio per le pagine di base44/shared/validitaTariffa.ts: le pagine non
// possono importare da base44/shared. Deve restare IDENTICO all'originale, a
// meno di questa intestazione e degli import, e lo controlla prove/specchi.mjs.
// E' nato l'11/10/2026 (chiusura dell'audit): il foglio dell'amministrazione
// leggeva la validita' delle tariffe a modo suo, e una tariffa non_attivo con la
// data di fine valeva in fattura ma non nel foglio. Chi cambia la regola la
// cambia nell'originale e la ricopia qui.
// Import relativi con l'estensione: cosi' lo leggono anche le prove in node.
import { giornoRoma } from './giornoItaliano.js';

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
