// Il numero di un formulario: come si normalizza, quanto due numeri sono
// lontani, e in che cosa differiscono detto in italiano.
//
// Stava tutto dentro reportSettimanali.ts, perche' la verifica dei report
// settimanali e' il posto dove e' nato: chi ci manda un elenco puo' sbagliare
// una lettera o una cifra, e dire "formulario non presente" di un carico che c'e'
// con un carattere diverso e' il modo piu' facile di inventare una difformita'.
//
// Il 01/10/2026 l'utente ha chiesto la stessa cosa per i consuntivi mensili:
// «le cose importanti su cui decidere sono il numero del formulario, l'id
// ordine, ma chi ci invia il report puo' anche sbagliare, ad esempio scambiando
// una lettera o una cifra, pertanto tu fai i paragoni con piu' informazioni
// della stessa riga». Due moduli, una regola sola: sta qui.

/** Solo lettere e cifre, maiuscole: i trattini e gli spazi non contano. */
export function normalizzaFir(v) {
  return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Numero dei formulari vidimati: 5 lettere, 6 cifre, 2 lettere (es. RGYTR027030CR). */
export const FORMATO_FIR = /^[A-Z]{5}\d{6}[A-Z]{2}$/;

/** Distanza di Damerau-Levenshtein ristretta, con uscita anticipata oltre il limite. */
export function distanzaFir(a, b, limite) {
  if (Math.abs(a.length - b.length) > limite) return limite + 1;
  const d = [];
  for (let i = 0; i <= a.length; i++) { d.push(new Array(b.length + 1).fill(0)); d[i][0] = i; }
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let minimoRiga = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + costo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      minimoRiga = Math.min(minimoRiga, d[i][j]);
    }
    if (minimoRiga > limite) return limite + 1;
  }
  return d[a.length][b.length];
}

// Caratteri che si scambiano leggendo o battendo a macchina.
const SOMIGLIANTI = { O: '0', '0': 'O', I: '1', '1': 'I', S: '5', '5': 'S', B: '8', '8': 'B', Z: '2', '2': 'Z' };

/**
 * Spiega in italiano in cosa differisce un numero da un altro: e' il dettaglio
 * da comunicare al fornitore, e vale per i formulari come per gli ID ordine.
 */
export function descriviDifferenzaFir(report, gestionale) {
  const a = normalizzaFir(report), b = normalizzaFir(gestionale);
  const pos = (i) => `in posizione ${i + 1}`;
  if (a.length === b.length + 1) {
    let i = 0;
    while (i < b.length && a[i] === b[i]) i++;
    if (a.slice(i + 1) === b.slice(i)) return `carattere in piu' "${a[i]}" ${pos(i)}`;
  }
  if (a.length + 1 === b.length) {
    let i = 0;
    while (i < a.length && a[i] === b[i]) i++;
    if (a.slice(i) === b.slice(i + 1)) return `manca il carattere "${b[i]}" ${pos(i)}`;
  }
  if (a.length === b.length) {
    const diversi = [];
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diversi.push(i);
    if (diversi.length === 1) {
      const i = diversi[0];
      const nota = SOMIGLIANTI[a[i]] === b[i] ? ', probabile scambio fra caratteri simili' : '';
      return `"${a[i]}" al posto di "${b[i]}" ${pos(i)}${nota}`;
    }
    if (diversi.length === 2 && diversi[1] === diversi[0] + 1 && a[diversi[0]] === b[diversi[1]] && a[diversi[1]] === b[diversi[0]]) {
      return `caratteri "${a[diversi[0]]}${a[diversi[1]]}" invertiti ${pos(diversi[0])}`;
    }
  }
  const n = distanzaFir(a, b, 5);
  return n <= 5 ? `${n} caratteri diversi` : 'numero diverso';
}
