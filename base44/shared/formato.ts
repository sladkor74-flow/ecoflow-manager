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
