import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 


export const isIframe = window.self !== window.top;

// Formattazione numerica standard: punto per migliaia, virgola per decimali, 3 cifre decimali.
export const formatNumber = (num) =>
  (Number(num) || 0).toLocaleString('it-IT', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export const formatTon = (num) => formatNumber(num) + ' t';

export const formatEuro = (num) =>
  (Number(num) || 0).toLocaleString('it-IT', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' €';