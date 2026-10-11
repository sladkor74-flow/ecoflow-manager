// GLI IMPORTI NELLE PAGINE DEI SOLDI, ALL'ITALIANA (chiusura dell'audit, 11/10/2026).
//
// Proprio dove si fattura i numeri non erano all'italiana: «€ {(doc.totale || 0).toFixed(2)}»
// nella dashboard dell'attiva e nello storico scriveva «€ 372976.50», col punto
// per i decimali e senza separatore delle migliaia, e uno ZERO se il totale non
// c'era; il dettaglio di una riga mostrava «€ 0.2020». La regola del gestionale e'
// un'altra: punto per le migliaia, virgola per i decimali, euro sempre a due
// decimali, e un valore che manca si scrive «—», non 0.
//
// Il raggruppamento delle migliaia e' fatto a mano, come in formatNumber di
// utils.js: Intl in italiano non separa le migliaia dei numeri a quattro cifre
// (1234,50). Il file non importa niente, cosi' le prove lo leggono in node.

const MANCA = '—';

const valoreDi = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Un numero con le cifre decimali fra min e max, all'italiana: 372.976,5 -> «372.976,50». */
export function cifreItaliane(v, min = 2, max = 2) {
  const n = valoreDi(v);
  if (n === null) return MANCA;
  const fisso = Math.abs(n).toFixed(max);
  const [intera, decimali = ''] = fisso.split('.');
  let dec = decimali;
  while (dec.length > min && dec.endsWith('0')) dec = dec.slice(0, -1);
  const segno = n < 0 && Number(fisso) !== 0 ? '-' : '';
  return segno + intera.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (dec ? ',' + dec : '');
}

/** Un importo: «€ 372.976,50»; «—» se manca. */
export const euro = (v) => (valoreDi(v) === null ? MANCA : `€ ${cifreItaliane(v, 2, 2)}`);

/**
 * Un prezzo unitario: due decimali, fino a quattro se servono, perche' un prezzo
 * al chilo (0,202) ne ha bisogno e uno a tonnellata (202,00) no. «—» se manca.
 */
export const prezzoUnitario = (v) => (valoreDi(v) === null ? MANCA : `€ ${cifreItaliane(v, 2, 4)}`);
