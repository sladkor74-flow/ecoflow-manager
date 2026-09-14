import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 


export const isIframe = window.self !== window.top;

// Formattazione numerica standard: punto per migliaia, virgola per decimali.
// Predefinito per le tonnellate: sempre due cifre decimali, la terza (i kg) solo
// se non e' zero. Implementazione manuale per garantire il separatore delle
// migliaia su tutti gli ambienti.
export const formatNumber = (num, options = {}) => {
  const max = options.maximumFractionDigits ?? 3;
  const min = Math.min(options.minimumFractionDigits ?? 2, max);
  const n = Number(num);
  if (isNaN(n)) return min > 0 ? '0,' + '0'.repeat(min) : '0';
  const fixed = Math.abs(n).toFixed(max);
  const [intPart, decPart = ''] = fixed.split('.');
  let dec = decPart;
  while (dec.length > min && dec.endsWith('0')) dec = dec.slice(0, -1);
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sign = n < 0 && Number(fixed) !== 0 ? '-' : '';
  return sign + grouped + (dec ? ',' + dec : '');
};

// Tonnellate: due decimali, tre se i kg non sono tondi.
export const formatTonnellate = (num) => formatNumber(num, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
// Chilogrammi: sempre interi.
export const formatKg = (num) => formatNumber(Math.round(Number(num) || 0), { minimumFractionDigits: 0, maximumFractionDigits: 0 });
// Percentuali: una cifra decimale.
export const formatPercentuale = (num, decimali = 1) => formatNumber(num, { minimumFractionDigits: decimali, maximumFractionDigits: decimali });

export const fmtTon = (num) => `${formatTonnellate(num)} t`;
export const fmtEuro = (num) => `${formatNumber(num)} €`;

// Helper per filtri multi-selezione: ritorna true se il filtro è vuoto o include il valore.
export const matchesMulti = (recordValue, filterArray) => {
  if (!filterArray || filterArray.length === 0) return true;
  return filterArray.includes(recordValue);
};