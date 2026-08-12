import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 


export const isIframe = window.self !== window.top;

// Formattazione numerica standard: punto per migliaia, virgola per decimali, 3 cifre decimali.
export const formatNumber = (num, options = {}) =>
  new Intl.NumberFormat('it-IT', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
    ...options,
  }).format(Number(num) || 0);

export const fmtTon = (num) => `${formatNumber(num)} t`;
export const fmtEuro = (num) => `${formatNumber(num)} €`;