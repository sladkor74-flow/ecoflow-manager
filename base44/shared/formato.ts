// Formato dei numeri nei testi generati dal backend (alert, email, Assistente).
//
// Tonnellate: sempre due cifre dopo la virgola; la terza, cioe' i kg, solo se non
// e' zero. Separatore delle migliaia a punto e dei decimali a virgola, scritto a
// mano per non dipendere dalle impostazioni locali dell'ambiente.

import { giornoRoma } from "./giornoItaliano.ts";

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
 * Regola dell'utente: punto per le migliaia e virgola per i decimali, fino a tre
 * cifre decimali quando servono e sono significative. Le tonnellate ne hanno
 * almeno due (tre se i chili non sono tondi), gli euro sempre due, gli altri
 * numeri quelle che servono, senza zeri inutili in coda.
 *
 * I dati arrivano al modello come numeri informatici (1600, 3.385) e a volte li
 * ricopiava cosi': «1600.00 euro per 3.38 t». La regola sta nelle istruzioni;
 * questa e' la rete di sicurezza. Tocca solo un numero con la sua unita' (t,
 * tonnellate, kg, chili, euro, €, %): ore, date, numeri d'ordine e articoli di
 * legge non hanno un'unita' e restano come sono.
 *
 * «3.385 t» e' l'unico caso ambiguo: tre tonnellate scritte all'inglese o
 * tremilatrecentottantacinque scritte all'italiana. Si decide coi numeri che
 * EcoTyna ha davvero ricevuto (valori): se fra quelli c'e' 3,385 e non 3385, e'
 * all'inglese. Senza i valori, o se ci sono tutti e due, resta com'e'.
 *
 * @param {string} testo
 * @param {Set<number>} valori  i numeri dei dati, da numeriDeiDati (facoltativo)
 */
export function numeriAllItaliana(testo, valori = null) {
  const migliaia = (intero) => String(intero).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const tipo = (u) => { const x = String(u || '').toLowerCase(); return /^(€|euro|eur)/.test(x) ? 'euro' : /^(t|tonnellat)/.test(x) ? 't' : /^(kg|chil)/.test(x) ? 'kg' : 'altro'; };
  // Scrive il numero con le cifre che servono: euro 2, tonnellate da 2 a 3, il resto fino a 3.
  const scrivi = (intero, dec, unita) => {
    const t = tipo(unita);
    const n = Number(`${intero}.${dec || '0'}`);
    let testo = n.toFixed(t === 'euro' ? 2 : 3);
    const minimo = t === 'euro' || t === 't' ? 2 : 0;
    while (testo.includes('.') && testo.split('.')[1].length > minimo && testo.endsWith('0')) testo = testo.slice(0, -1);
    if (testo.endsWith('.')) testo = testo.slice(0, -1);
    const [i, d] = testo.split('.');
    return migliaia(i) + (d ? ',' + d : '');
  };
  const UNITA = '(?=\\s?(t\\b|tonnellat|kg\\b|chil|€|euro|eur\\b|%))';
  const NUMERO = '(?<![\\d.,])';
  let s = String(testo ?? '');
  // 1. Le migliaia all'inglese: 1,617.22 t.
  s = s.replace(new RegExp(`${NUMERO}(\\d{1,3}(?:,\\d{3})+)\\.(\\d+)${UNITA}`, 'g'), (m, i, d, u) => scrivi(i.replace(/,/g, ''), d, u));
  s = s.replace(/(€\s?)(\d{1,3}(?:,\d{3})+)\.(\d+)/g, (m, eu, i, d) => eu + scrivi(i.replace(/,/g, ''), d, '€'));
  // 2. Il punto decimale con una, due, quattro o piu' cifre: non puo' essere un gruppo
  //    di migliaia (che ne ha tre): 1600.00 euro, 3.38 t, 12.5%, 3.3851 t.
  s = s.replace(new RegExp(`${NUMERO}(\\d+)\\.(\\d{1,2}|\\d{4,})(?![\\d.,])${UNITA}`, 'g'), (m, i, d, u) => scrivi(i, d, u));
  s = s.replace(/(€\s?)(\d+)\.(\d{1,2}|\d{4,})(?![\d.,])/g, (m, eu, i, d) => eu + scrivi(i, d, '€'));
  // 3. Tre cifre dopo il punto: si decide coi numeri dei dati.
  if (valori && valori.size) {
    s = s.replace(new RegExp(`${NUMERO}(\\d{1,3})\\.(\\d{3})(?![\\d.,])${UNITA}`, 'g'), (m, i, d, u) => {
      const dec = Number(`${i}.${d}`), int = Number(`${i}${d}`);
      // Le tonnellate dei dati sono in tonnellate: 3,385 fra i dati vuol dire 3,385 t anche se
      // fra i dati c'e' 3385 (in chili). Per il resto il decimale vince solo se l'intero non c'e'.
      const decimale = tipo(u) === 't' ? valori.has(dec) : valori.has(dec) && !valori.has(int);
      return decimale ? scrivi(i, d, u) : m;
    });
  }
  // 4. Un intero lungo senza separatori: 12400 kg.
  s = s.replace(new RegExp(`${NUMERO}(\\d{4,})(?![\\d.,])${UNITA}`, 'g'), (m, i) => migliaia(i));
  s = s.replace(/(€\s?)(\d{4,})(?![\d.,])/g, (m, eu, i) => eu + migliaia(i));
  return s;
}

/** I numeri contenuti nei dati degli strumenti di EcoTyna, per numeriAllItaliana. */
export function numeriDeiDati(...oggetti) {
  const valori = new Set();
  const visita = (x, profondita = 0) => {
    if (profondita > 12 || x === null || x === undefined) return;
    if (typeof x === 'number') { if (Number.isFinite(x)) valori.add(x); return; }
    if (Array.isArray(x)) { for (const y of x) visita(y, profondita + 1); return; }
    if (typeof x === 'object') for (const y of Object.values(x)) visita(y, profondita + 1);
  };
  for (const o of oggetti) visita(o);
  return valori;
}

/**
 * LE DATE DI UN TESTO SCRITTO DA ECOTYNA, ALL'ITALIANA (utente, 10/10/2026: «sistema
 * anche le date»). I dati portano le date come le salva il gestionale, 2026-10-05,
 * e il modello a volte le ricopiava cosi'. Qui diventano 05/10/2026. Un istante con
 * l'ora (2026-06-30T23:30:00Z) diventa il suo giorno italiano, come in tutto il
 * gestionale (giornoRoma): a Roma quello e' gia' il 01/07/2026. Una data dentro un
 * nome di file o un codice (report_2026-10-05.xlsx) non si tocca.
 */
export function dateAllItaliana(testo) {
  const it = (g) => `${g.slice(8, 10)}/${g.slice(5, 7)}/${g.slice(0, 4)}`;
  const valida = (a, m, g) => Number(m) >= 1 && Number(m) <= 12 && Number(g) >= 1 && Number(g) <= 31;
  return String(testo ?? '').replace(/(?<![\w\-./])(\d{4})-(\d{2})-(\d{2})(T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?(?![\w\-])/g,
    (m, a, mese, g, ora) => {
      if (!valida(a, mese, g)) return m;
      if (ora) { const giorno = giornoRoma(m); return giorno ? it(giorno) : m; }
      return it(`${a}-${mese}-${g}`);
    });
}

/** Il testo di una risposta, all'italiana: numeri e date. */
export function testoAllItaliana(testo, valori = null) {
  return dateAllItaliana(numeriAllItaliana(testo, valori));
}
