// Costanti condivise per il modulo PFU (frontend).
import { oggiRoma } from './giornoItaliano.js';

export const MESI = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

export const MESI_BREVI = [
  'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu',
  'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'
];

// Il mese di oggi e' quello italiano, non quello del dispositivo (chiusura
// dell'audit, 11/10/2026): getMonth() leggeva il fuso del dispositivo, e a
// cavallo della mezzanotte fra due mesi un computer con un altro fuso diceva
// l'altro mese.
export function meseCorrente() {
  return MESI[Number(oggiRoma().slice(5, 7)) - 1];
}