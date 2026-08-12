import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 


export const isIframe = window.self !== window.top;

// Formattazione numerica standard: punto per migliaia, virgola per decimali, 3 cifre decimali.
// Implementazione manuale per garantire il separatore delle migliaia su tutti gli ambienti.
export const formatNumber = (num, options = {}) => {
  const opts = { minimumFractionDigits: 3, maximumFractionDigits: 3, ...options };
  const n = Number(num);
  if (isNaN(n)) return '0,000';
  const fixed = Math.abs(n).toFixed(opts.maximumFractionDigits);
  const [intPart, decPart] = fixed.split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sign = n < 0 ? '-' : '';
  const dec = opts.maximumFractionDigits > 0 && decPart ? ',' + decPart : '';
  return sign + grouped + dec;
};

export const fmtTon = (num) => `${formatNumber(num)} t`;
export const fmtEuro = (num) => `${formatNumber(num)} €`;