// Prova della cache delle letture di EcoTyna (base44/shared/cacheLetture.ts):
// gli strumenti di una domanda partono insieme e spesso leggono gli stessi
// archivi. npm run prove
import { nuovaCache, chiaveLettura } from '../base44/shared/cacheLetture.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const attendi = (ms) => new Promise(r => setTimeout(r, ms));

console.log('LA CHIAVE DI UNA LETTURA');
verifica('entita e filtro', chiaveLettura('PrimariaRete', { stato: 'terminato' }) === 'PrimariaRete|stato="terminato"');
verifica('senza filtro', chiaveLettura('Fornitore', null) === 'Fornitore|');
verifica("l'ordine delle chiavi non conta",
  chiaveLettura('X', { a: 1, b: 2 }) === chiaveLettura('X', { b: 2, a: 1 }));
verifica('filtri diversi sono letture diverse',
  chiaveLettura('X', { stato: 'terminato' }) !== chiaveLettura('X', { stato: 'eseguito' }));
verifica('entita diverse sono letture diverse',
  chiaveLettura('PrimariaRete', null) !== chiaveLettura('PrimariaAci', null));

console.log('LA STESSA LETTURA SI FA UNA VOLTA SOLA');
{
  const cache = nuovaCache();
  let volte = 0;
  const leggi = () => { volte++; return Promise.resolve(['riga']); };
  const a = await cache.leggi('k', leggi);
  const b = await cache.leggi('k', leggi);
  verifica('la funzione gira una volta', volte === 1, 'volte=' + volte);
  verifica('e il risultato e lo stesso', a === b && a[0] === 'riga');
  verifica('i conti lo dicono', cache.conti().letture === 1 && cache.conti().risparmiate === 1, JSON.stringify(cache.conti()));
}

console.log('CHI ARRIVA MENTRE LA LETTURA E IN CORSO SI METTE IN CODA');
{
  const cache = nuovaCache();
  let volte = 0;
  const lenta = async () => { volte++; await attendi(30); return ['righe']; };
  // Tre strumenti che partono insieme, come nella funzione vera.
  const esiti = await Promise.all([cache.leggi('k', lenta), cache.leggi('k', lenta), cache.leggi('k', lenta)]);
  verifica('una lettura sola per tre richieste', volte === 1, 'volte=' + volte);
  verifica('tutti e tre hanno lo stesso risultato', esiti[0] === esiti[1] && esiti[1] === esiti[2]);
  verifica('due risparmiate', cache.conti().risparmiate === 2, JSON.stringify(cache.conti()));
}

console.log('CHIAVI DIVERSE, LETTURE DIVERSE');
{
  const cache = nuovaCache();
  let volte = 0;
  const leggi = () => { volte++; return Promise.resolve(volte); };
  await cache.leggi('a', leggi);
  await cache.leggi('b', leggi);
  verifica('due letture', volte === 2 && cache.conti().letture === 2);
  verifica('nessuna risparmiata', cache.conti().risparmiate === 0);
}

console.log('UNA LETTURA CHE FALLISCE NON RESTA IN CACHE');
{
  const cache = nuovaCache();
  let volte = 0;
  const ballerina = async () => { volte++; if (volte === 1) throw new Error('rate limit'); return ['ok']; };
  let primoErrore = null;
  try { await cache.leggi('k', ballerina); } catch (e) { primoErrore = e.message; }
  verifica('il primo errore arriva a chi ha chiesto', primoErrore === 'rate limit');
  const secondo = await cache.leggi('k', ballerina);
  verifica('la volta dopo si riprova invece di ereditare l errore', secondo[0] === 'ok', 'volte=' + volte);
}

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
