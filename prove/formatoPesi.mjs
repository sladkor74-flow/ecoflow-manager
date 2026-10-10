// Prova del FORMATO DEI PESI nei testi del backend (base44/shared/formato.ts):
// alert, email, EcoTyna. Regola dell'utente: tonnellate con due decimali, tre se
// i kg non sono tondi; kg interi; punto delle migliaia e virgola dei decimali.
//
// E un caso trovato dall'audit del 10/10/2026: un numero infinito - una divisione
// per zero a monte - faceva fermare formatoTonnellate con un errore, e con lei il
// testo che la usava. Ora si scrive n/d. Un valore che manca resta 0,00.
// npm run prove
import { formatoTonnellate, formatoKg, formatoKgInTonnellate } from '../base44/shared/formato.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const prova = (f, v) => { try { return f(v); } catch (e) { return 'ERRORE: ' + e.message; } };

console.log('LE TONNELLATE');
for (const [v, atteso] of [
  [1234.5, '1.234,50'], [8818.55, '8.818,55'], [12.345, '12,345'], [0.001, '0,001'],
  [-3.2, '-3,20'], [0, '0,00'], [null, '0,00'], [undefined, '0,00'], ['x', '0,00'], [1234567.891, '1.234.567,891'],
  [Infinity, 'n/d'], [-Infinity, 'n/d'],
]) verifica(`${String(v)} -> ${atteso}`, prova(formatoTonnellate, v) === atteso, prova(formatoTonnellate, v));
verifica('dai kg: 652.840 kg = 652,84 t', formatoKgInTonnellate(652840) === '652,84', formatoKgInTonnellate(652840));
verifica('dai kg, una divisione per zero: n/d', prova(formatoKgInTonnellate, 1 / 0) === 'n/d', prova(formatoKgInTonnellate, 1 / 0));

console.log('I CHILI');
for (const [v, atteso] of [
  [1234.4, '1.234'], [1234.5, '1.235'], [-4100, '-4.100'], [0, '0'], [null, '0'], [Infinity, 'n/d'],
]) verifica(`${String(v)} -> ${atteso}`, prova(formatoKg, v) === atteso, prova(formatoKg, v));

console.log(`\n${ok} superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
