// Prova dei NUMERI DI ECOTYNA, ALL'ITALIANA (utente, 10/10/2026: «sistema i numeri
// di Ecotyna»).
//
// I dati arrivano al modello come numeri informatici e a volte li ricopiava cosi':
// «ECO.GEA SRL, rete, giugno 2026: 1600.00 euro per 3.38 t», mentre poco prima
// aveva scritto bene «372.976,50 euro». Ora la regola e' nelle istruzioni
// (3-duodecies) e dopo la risposta passa numeriAllItaliana, che converte solo
// quello che non e' ambiguo: ore, date, numeri d'ordine e «3.385 t» (tre o
// tremila?) restano come sono.
// npm run prove
import { readFileSync } from 'node:fs';
import { numeriAllItaliana as f } from '../base44/shared/formato.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const caso = (dentro, atteso, nome) => verifica(`${nome}: «${dentro}» -> «${atteso}»`, f(dentro) === atteso, `uscito «${f(dentro)}»`);

console.log('SI CONVERTE');
caso('ECO.GEA SRL, rete, giugno 2026: 1600.00 euro per 3.38 t di PFU raccolte.', 'ECO.GEA SRL, rete, giugno 2026: 1.600,00 euro per 3,38 t di PFU raccolte.', 'la risposta vera del 10/10');
caso('Totale 8818.55 t', 'Totale 8.818,55 t', 'le migliaia mancanti');
caso('1,617.22 t', '1.617,22 t', 'le migliaia all\'inglese');
caso('12400 kg', '12.400 kg', 'i chili interi');
caso('12.5 t', '12,50 t', 'tonnellate a due decimali');
caso('€ 1600.5', '€ 1.600,50', 'euro col simbolo davanti, a due decimali');
caso('€1,234.56', '€1.234,56', 'euro all\'inglese col simbolo');
caso('copertura 76.4%', 'copertura 76,4%', 'percentuali col loro decimale');
caso('0.5 tonnellate', '0,50 tonnellate', 'la parola intera, sempre due decimali');
caso('12.5 kg', '12,5 kg', 'i chili coi decimali che hanno');

console.log('NON SI TOCCA');
caso('372.976,50 euro', '372.976,50 euro', 'gia\' all\'italiana');
caso('1.617,22 t', '1.617,22 t', 'gia\' all\'italiana, le tonnellate');
caso('3.385 t', '3.385 t', 'ambiguo: tre o tremila tonnellate');
caso('alle 10.30 del 2026-06-30', 'alle 10.30 del 2026-06-30', 'ore e date');
caso('il FIR RGYTR025688FF e l\'ordine ET26152600', 'il FIR RGYTR025688FF e l\'ordine ET26152600', 'numeri di formulario e d\'ordine');
caso('2.059 righe di Baucina', '2.059 righe di Baucina', 'un conto senza unita\'');
caso('art. 188.1 del D.Lgs. 152/2006', 'art. 188.1 del D.Lgs. 152/2006', 'gli articoli di legge');
caso('', '', 'il vuoto');

console.log('ECOTYNA LA USA');
{
  const src = readFileSync(new URL('../base44/functions/chiediAssistente/entry.ts', import.meta.url), 'utf8');
  verifica('la regola e\' nelle istruzioni', /3-duodecies\. I numeri si scrivono all\\'italiana/.test(src));
  verifica('la risposta salvata passa dalla conversione', /risposta: numeriAllItaliana\(String\(esito\.risposta/.test(src));
  verifica('e anche quella restituita alla pagina', (src.match(/numeriAllItaliana\(String\(esito\.risposta/g) || []).length === 2);
}

console.log(`\n${ok} superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
