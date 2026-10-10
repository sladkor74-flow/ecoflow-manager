// GLI ANNI E IL MESE DA CUI PARTONO LE PAGINE (chiusura dell'audit, 11/10/2026).
//
// Le pagine avevano l'anno scritto a mano: Dichiarazioni [2026, 2025] e aperta sul
// 2026, Giacenze aperta sul 2026, la fatturazione su «Luglio 2026», passiva,
// attiva, margine ed extra raccolta con [2024, 2025, 2026]. Dal 1° gennaio 2027 il
// 2027 non si sarebbe potuto scegliere: e' la trappola dell'anno cablato che il
// 10/10 si era tolta dal guardiano notturno, rimasta nelle pagine. Qui tutto parte
// dal giorno italiano, come annoCorrenteRoma di Target & Status.

const GIORNO_ROMA = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Il giorno di oggi in Italia, aaaa-mm-gg. */
export const oggiInItalia = () => GIORNO_ROMA.format(new Date());

/** Il primo anno che le pagine lasciano scegliere: quello dei primi dati. */
export const PRIMO_ANNO_PAGINE = 2024;

export const MESI_PAGINE = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

/**
 * Gli anni da scegliere, dal piu' vecchio al piu' recente: da `dal` all'anno in
 * corso, piu' `dopo` anni oltre (le pagine che preparano l'anno nuovo).
 */
export function anniDaScegliere({ dal = PRIMO_ANNO_PAGINE, dopo = 0, oggi = oggiInItalia() } = {}) {
  const ultimo = Number(String(oggi).slice(0, 4)) + dopo;
  const anni = [];
  for (let a = dal; a <= ultimo; a++) anni.push(a);
  return anni;
}

/** L'anno in corso, in Italia: quello su cui una pagina si apre. */
export const annoDiOggi = (oggi = oggiInItalia()) => Number(String(oggi).slice(0, 4));

/**
 * Il mese su cui si lavora: l'ultimo finito, sul calendario italiano. L'11
 * ottobre e' settembre; il 2 gennaio e' il dicembre dell'anno prima.
 */
export function meseDiLavoro(oggi = oggiInItalia()) {
  const anno = Number(String(oggi).slice(0, 4));
  const mese = Number(String(oggi).slice(5, 7));
  return mese === 1 ? { anno: anno - 1, mese: 'Dicembre' } : { anno, mese: MESI_PAGINE[mese - 2] };
}
