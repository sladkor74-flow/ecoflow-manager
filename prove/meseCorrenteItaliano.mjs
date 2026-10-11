// Prova del MESE DI OGGI NELLE PAGINE (src/lib/pfuConstants.js, meseCorrente;
// chiusura dell'audit, 11/10/2026).
//
// meseCorrente() leggeva new Date().getMonth(), cioe' il mese nel fuso del
// dispositivo. A cavallo della mezzanotte fra due mesi un computer con un altro
// fuso diceva l'altro mese: alle 00:30 del 1° novembre in Italia, a New York e'
// ancora il 31 ottobre. Il giorno che conta e' quello italiano (oggiRoma), come
// in tutto il gestionale. Qui si ferma l'orologio e si cambia il fuso.
// npm run prove
import { meseCorrente } from '../src/lib/pfuConstants.js';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const Vero = Date;
let istante = 0;
globalThis.Date = class extends Vero {
  constructor(...a) { if (a.length) super(...a); else super(istante); }
  static now() { return istante; }
};
const alle = (iso, fuso) => { istante = Vero.parse(iso); process.env.TZ = fuso; return meseCorrente(); };

console.log('IL MESE E\' QUELLO ITALIANO, IN QUALUNQUE FUSO');
verifica('00:30 del 1° novembre in Italia, a New York ancora 31 ottobre: novembre', alle('2026-10-31T23:30:00Z', 'America/New_York') === 'Novembre', alle('2026-10-31T23:30:00Z', 'America/New_York'));
verifica('17:00 del 31 ottobre in Italia, a Tokyo gia\' 1° novembre: ottobre', alle('2026-10-31T16:00:00Z', 'Asia/Tokyo') === 'Ottobre', alle('2026-10-31T16:00:00Z', 'Asia/Tokyo'));
verifica('capodanno: 00:30 del 1° gennaio in Italia, in UTC ancora 31 dicembre: gennaio', alle('2026-12-31T23:30:00Z', 'UTC') === 'Gennaio', alle('2026-12-31T23:30:00Z', 'UTC'));
verifica('in Italia, un giorno qualunque: il suo mese', alle('2026-10-11T10:00:00Z', 'Europe/Rome') === 'Ottobre');

globalThis.Date = Vero;
console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
