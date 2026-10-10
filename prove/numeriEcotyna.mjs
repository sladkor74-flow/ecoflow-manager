// Prova dei NUMERI DI ECOTYNA, ALL'ITALIANA (utente, 10/10/2026: «sistema i numeri
// di Ecotyna» e poi: «con il punto alle migliaia e la virgola che separa le cifre
// decimali, fino a tre se servono e sono significative»).
//
// I dati arrivano al modello come numeri informatici e a volte li ricopiava cosi':
// «ECO.GEA SRL, rete, giugno 2026: 1600.00 euro per 3.38 t», mentre poco prima
// aveva scritto bene «372.976,50 euro». Ora la regola e' nelle istruzioni
// (3-duodecies) e dopo la risposta passa numeriAllItaliana: tonnellate da due a
// tre decimali, euro due, il resto fino a tre senza zeri inutili. Ore, date,
// numeri d'ordine e articoli non hanno un'unita' e restano come sono; «3.385 t»
// (tre o tremila?) si decide coi numeri che EcoTyna ha ricevuto.
// npm run prove
import { readFileSync } from 'node:fs';
import { numeriAllItaliana as f, numeriDeiDati, dateAllItaliana, testoAllItaliana } from '../base44/shared/formato.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const caso = (dentro, atteso, nome, valori = null) => verifica(`${nome}: «${dentro}» -> «${atteso}»`, f(dentro, valori) === atteso, `uscito «${f(dentro, valori)}»`);

console.log('SI CONVERTE');
caso('ECO.GEA SRL, rete, giugno 2026: 1600.00 euro per 3.38 t di PFU raccolte.', 'ECO.GEA SRL, rete, giugno 2026: 1.600,00 euro per 3,38 t di PFU raccolte.', 'la risposta vera del 10/10');
caso('Totale 8818.55 t', 'Totale 8.818,55 t', 'le migliaia mancanti');
caso('1,617.22 t', '1.617,22 t', 'le migliaia all\'inglese');
caso('12400 kg', '12.400 kg', 'i chili interi');
caso('12.5 t', '12,50 t', 'tonnellate: almeno due decimali');
caso('3.3851 t', '3,385 t', 'tonnellate: al massimo tre decimali');
caso('€ 1600.5', '€ 1.600,50', 'euro col simbolo davanti, sempre due decimali');
caso('€1,234.56', '€1.234,56', 'euro all\'inglese col simbolo');
caso('copertura 76.4%', 'copertura 76,4%', 'percentuali col loro decimale');
caso('copertura 76.40%', 'copertura 76,4%', 'senza zeri inutili in coda');
caso('0.5 tonnellate', '0,50 tonnellate', 'la parola intera, sempre due decimali');
caso('12.5 kg', '12,5 kg', 'i chili coi decimali che hanno');

console.log('TRE DECIMALI: SI DECIDE COI DATI');
{
  // I numeri che EcoTyna ha ricevuto: tonnellate in tonnellate, chili in chili.
  const valori = numeriDeiDati([{ tonnellate: 3.385, righe: [{ kg: 3385 }] }, { t: 0.125, euro: 1600, scarto: 3.38 }]);
  caso('3.385 t', '3,385 t', 'fra i dati c\'e\' 3,385: sono tre tonnellate', valori);
  caso('3.385 kg', '3.385 kg', 'fra i dati c\'e\' 3385 kg: sono tremila chili', valori);
  caso('0.125 t', '0,125 t', 'tre decimali significativi', valori);
  caso('3.380 t', '3,38 t', 'il terzo decimale a zero non serve', valori);
  caso('1.600 euro', '1.600 euro', 'gli euro coi dati: milleseicento', valori);
  caso('3.385 t', '3.385 t', 'senza i dati non si tira a indovinare');
}

console.log('NON SI TOCCA');
caso('372.976,50 euro', '372.976,50 euro', 'gia\' all\'italiana');
caso('1.617,22 t', '1.617,22 t', 'gia\' all\'italiana, le tonnellate');
caso('alle 10.30 del 2026-06-30', 'alle 10.30 del 2026-06-30', 'ore e date');
caso('il FIR RGYTR025688FF e l\'ordine ET26152600', 'il FIR RGYTR025688FF e l\'ordine ET26152600', 'numeri di formulario e d\'ordine');
caso('2.059 righe di Baucina', '2.059 righe di Baucina', 'un conto senza unita\'');
caso('art. 188.1 del D.Lgs. 152/2006', 'art. 188.1 del D.Lgs. 152/2006', 'gli articoli di legge');
caso('', '', 'il vuoto');

console.log('ECOTYNA LA USA');
{
  const src = readFileSync(new URL('../base44/functions/chiediAssistente/entry.ts', import.meta.url), 'utf8');
  verifica('la regola e\' nelle istruzioni, coi tre decimali significativi', /3-duodecies\. I numeri si scrivono all\\'italiana: punto per le migliaia e virgola per i decimali, con fino a tre cifre decimali quando servono e sono significative/.test(src));
  verifica('la regola delle date e\' nelle istruzioni', /3-terdecies\. Le date si scrivono all\\'italiana, giorno\/mese\/anno/.test(src));
  verifica('la risposta salvata passa dalla conversione di numeri e date, coi numeri dei dati', /risposta: testoAllItaliana\(String\(esito\.risposta[^\n]*numeriDeiDati\(risultati\.map\(r => r\.dati\)\)\)/.test(src));
  verifica('e anche quella restituita alla pagina', (src.match(/testoAllItaliana\(String\(esito\.risposta[^\n]*numeriDeiDati\(risultati/g) || []).length === 2);
}

console.log("LE DATE ALL'ITALIANA (utente, 10/10/2026: «sistema anche le date»)");
{
  const d = (dentro, atteso, nome) => verifica(`${nome}: «${dentro}» -> «${atteso}»`, dateAllItaliana(dentro) === atteso, `uscito «${dateAllItaliana(dentro)}»`);
  d('aggiornata al 2026-10-05.', 'aggiornata al 05/10/2026.', 'la risposta vera del 10/10');
  d('dal 2026-01-01 al 2026-12-31', 'dal 01/01/2026 al 31/12/2026', 'un intervallo');
  d('fine trasporto 2026-06-30T23:30:00Z', 'fine trasporto 01/07/2026', "un istante: il giorno italiano, a Roma e' gia' luglio");
  d('fine trasporto 2026-06-30T10:00:00.000Z', 'fine trasporto 30/06/2026', 'un istante di giorno');
  d('il file report_2026-10-05.xlsx', 'il file report_2026-10-05.xlsx', 'nei nomi dei file non si tocca');
  d('ET26-2026-10-05', 'ET26-2026-10-05', 'nei codici non si tocca');
  d('2026-13-45', '2026-13-45', 'una data che non esiste non si inventa');
  d('gia\' 05/10/2026', 'gia\' 05/10/2026', 'gia\' all\'italiana');
  verifica('numeri e date insieme', testoAllItaliana('1600.00 euro al 2026-10-05') === '1.600,00 euro al 05/10/2026', testoAllItaliana('1600.00 euro al 2026-10-05'));
}

console.log("RAGGRUPPARE NON E' FILTRARE");
{
  // Visto in produzione il 10/10/2026: «lo strumento delle giacenze non permette di
  // raggruppare per classe» su una risposta che le classi le dava.
  const R = new URL('../base44/shared/', import.meta.url).href;
  const { strumentiDalPiano } = await import(R + 'pianoAssistente.ts');
  const { catalogoStrumenti } = await import(R + 'strumentiAssistente.ts');
  const [g] = strumentiDalPiano({ strumenti: [{ nome: 'giacenze', parametri: { sito: 'Nappi Sud', raggruppa: 'classe' } }], canali: [], periodo: { anno: 2026 } }, catalogoStrumenti(), '2026-10-10', 'Che giacenza per classe ha il piazzale di Nappi Sud?');
  verifica('il raggruppamento non finisce fra i filtri ignorati', g && (g.ignorati || []).length === 0, JSON.stringify(g && g.ignorati));
}

console.log(`\n${ok} superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
