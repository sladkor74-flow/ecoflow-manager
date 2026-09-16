// Ricerca per nome di un produttore che non si ferma alla scrittura: "PIUGOMME
// DISTRIBUZIONI S.R.L." trova "Piugomme Distribuzioni srl". Basta che ogni parola
// significativa cercata compaia nel nome; la forma societaria non conta.
// Serve a trovare, non a collegare: la scelta resta a chi guarda.

const FORME = new Set(['srl', 'srls', 'spa', 'sas', 'snc', 'sc', 'ss', 'soc', 'societa', 'unipersonale', 'ditta', 'di', 'del', 'della', 'dei', 'e', 'c']);

export const parole = (v) => String(v || '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim()
  .replace(/\b(?:[a-z] )+[a-z]\b/g, (m) => m.replace(/ /g, ''))
  .split(' ').filter(p => p && !FORME.has(p));

/** true se tutte le parole cercate compaiono nei testi indicati. */
export const corrispondeA = (cercate, ...testi) => {
  if (!cercate.length) return true;
  const nome = parole(testi.filter(Boolean).join(' ')).join(' ');
  return cercate.every(p => nome.includes(p));
};
