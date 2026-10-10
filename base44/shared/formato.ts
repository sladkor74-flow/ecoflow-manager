// Formato dei numeri nei testi generati dal backend (alert, email, Assistente).
//
// Tonnellate: sempre due cifre dopo la virgola; la terza, cioe' i kg, solo se non
// e' zero. Separatore delle migliaia a punto e dei decimali a virgola, scritto a
// mano per non dipendere dalle impostazioni locali dell'ambiente.

export function formatoTonnellate(v) {
  const n = Math.round((Number(v) || 0) * 1000) / 1000;
  // Un numero infinito - una divisione per zero a monte - non e' un peso: si
  // scrive n/d. Prima toFixed dava "Infinity", senza virgola, e la riga dopo
  // si fermava con un errore: e con lei l'alert o l'email che la usava
  // (audit del 10/10/2026). Un valore mancante resta 0,00 come sempre.
  if (!Number.isFinite(n)) return 'n/d';
  const [intero, decimali] = Math.abs(n).toFixed(3).split('.');
  const dec = decimali.endsWith('0') ? decimali.slice(0, 2) : decimali;
  return (n < 0 ? '-' : '') + intero.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + dec;
}

/** Tonnellate a partire da un peso in kg. */
export const formatoKgInTonnellate = (kg) => formatoTonnellate((Number(kg) || 0) / 1000);

/** Arrotonda le tonnellate ai kg, senza perdere la terza cifra. */
export const arrotondaTonnellate = (v) => Math.round((Number(v) || 0) * 1000) / 1000;

/** Chilogrammi: sempre interi, con il punto delle migliaia. */
export function formatoKg(v) {
  const n = Math.round(Number(v) || 0);
  if (!Number.isFinite(n)) return 'n/d';
  return (n < 0 ? '-' : '') + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * I NUMERI DI UN TESTO SCRITTO DA ECOTYNA, ALL'ITALIANA (10/10/2026).
 *
 * I dati arrivano al modello come numeri informatici (1600, 3.38) e a volte li
 * ricopia cosi': «1600.00 euro per 3.38 t», accanto a risposte scritte bene
 * («372.976,50 euro»). La regola sta nelle istruzioni; questa e' la rete di
 * sicurezza, e converte SOLO quello che non e' ambiguo:
 *  - un numero seguito da un'unita' (t, tonnellate, kg, chili, euro, €, %) o
 *    preceduto da €;
 *  - scritto col punto decimale e una o due cifre dopo (1600.00, 3.38, 12.5),
 *    oppure con la virgola delle migliaia e il punto decimale (1,617.22), oppure
 *    intero senza separatori (12400 kg).
 * «3.385 t» resta com'e': all'italiana sono tremilatrecentottantacinque
 * tonnellate, all'inglese tre, e non si tira a indovinare. Le ore (10.30), le
 * date, i numeri d'ordine e tutto cio' che non ha un'unita' non si toccano.
 */
export function numeriAllItaliana(testo) {
  const migliaia = (intero) => String(intero).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  // Tonnellate ed euro con due decimali: «12.5 t» diventa «12,50 t». Le
  // percentuali e i chili restano coi decimali che hanno.
  const dueDecimali = (unita) => /^(t|tonnellat|€|euro|eur)/i.test(String(unita || ''));
  const decimali = (dec, unita) => (dec.length === 1 && dueDecimali(unita) ? dec + '0' : dec);
  const UNITA = '(?=\\s?(t\\b|tonnellat|kg\\b|chil|€|euro|eur\\b|%))';
  const NUMERO = '(?<![\\d.,])';
  let s = String(testo ?? '');
  // 1. Le migliaia all'inglese con i decimali: 1,617.22 t.
  s = s.replace(new RegExp(`${NUMERO}(\\d{1,3}(?:,\\d{3})+)\\.(\\d+)${UNITA}`, 'g'),
    (m, intero, dec, unita) => intero.replace(/,/g, '.') + ',' + decimali(dec, unita));
  s = s.replace(/(€\s?)(\d{1,3}(?:,\d{3})+)\.(\d+)/g, (m, eu, intero, dec) => eu + intero.replace(/,/g, '.') + ',' + decimali(dec, '€'));
  // 2. Il punto decimale con una o due cifre: 1600.00 euro, 3.38 t, 12.5%.
  s = s.replace(new RegExp(`${NUMERO}(\\d+)\\.(\\d{1,2})(?![\\d.,])${UNITA}`, 'g'),
    (m, intero, dec, unita) => migliaia(intero) + ',' + decimali(dec, unita));
  s = s.replace(/(€\s?)(\d+)\.(\d{1,2})(?![\d.,])/g, (m, eu, intero, dec) => eu + migliaia(intero) + ',' + decimali(dec, '€'));
  // 3. Un intero lungo senza separatori: 12400 kg.
  s = s.replace(new RegExp(`${NUMERO}(\\d{4,})(?![\\d.,])${UNITA}`, 'g'), (m, intero) => migliaia(intero));
  s = s.replace(/(€\s?)(\d{4,})(?![\d.,])/g, (m, eu, intero) => eu + migliaia(intero));
  return s;
}
