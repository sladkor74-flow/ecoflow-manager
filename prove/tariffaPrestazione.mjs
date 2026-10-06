// La prestazione di una tariffa vale solo per la fatturazione PASSIVA.
//
// Era obbligatoria sull'entita' Tariffa, per tutte e due le direzioni: ogni
// modifica di una tariffa ATTIVA veniva respinta con «Error in field
// prestazione: Field required», e nessuna delle sette tariffe Ecotyre si poteva
// piu' toccare. Ci siamo arrivati addosso il 06/10/2026 provando a scrivere la
// scadenza del 31/12/2026 su una tariffa attiva.
//
// A richiederla per le passive e' gestisciAnagrafiche, che sa in quale direzione
// sta andando - e che per le attive la rifiuta se c'e'. npm run prove
import { readFileSync } from 'node:fs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const sorgente = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const senzaCommenti = (s) => s.replace(/^\s*\/\/.*$/gm, '');

const entita = JSON.parse(senzaCommenti(sorgente('base44/entities/Tariffa.jsonc')));
const funzione = sorgente('base44/functions/gestisciAnagrafiche/entry.ts');

console.log('L\'ENTITA\' NON LA PRETENDE DA TUTTI');
verifica('prestazione non e\' fra i campi obbligatori dell\'entita\'',
  !(entita.required || []).includes('prestazione'), JSON.stringify(entita.required));
verifica('ma il campo esiste ancora, con il suo elenco di valori',
  !!entita.properties.prestazione && Array.isArray(entita.properties.prestazione.enum),
  JSON.stringify(entita.properties.prestazione && entita.properties.prestazione.enum));
verifica('e unita di misura e valore restano obbligatori per tutte',
  (entita.required || []).includes('unita_misura') && (entita.required || []).includes('valore'));

console.log('A PRETENDERLA E\' CHI SA LA DIREZIONE');
verifica('per le passive la prestazione resta obbligatoria',
  /\['fornitore_id', 'direzione', 'tipologia', 'prestazione', 'unita_misura', 'valore'\]/.test(funzione));
verifica('per le attive no',
  /\['cliente', 'direzione', 'tipologia', 'unita_misura', 'valore'\]/.test(funzione));
verifica('e una tariffa attiva con la prestazione viene rifiutata, dicendo perche\'',
  funzione.includes("Il campo prestazione non si applica alla fatturazione attiva."));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
