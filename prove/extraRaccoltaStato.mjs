// IL GIORNO DI UNA SCHEDA DI EXTRA RACCOLTA E' IL GIORNO ITALIANO
// (src/lib/extraRaccoltaStato.js, chiusura dell'audit, 11/10/2026).
//
// Il fatto. giornoDaData rifaceva a mano la correzione del fuso: le 22 o le 23
// UTC esatte si spostavano avanti di tre ore, tutto il resto si leggeva in UTC.
// Una mezzanotte italiana la riconosceva, ma sbagliava due casi che giornoRoma -
// la regola di tutto il gestionale - fa giusti:
//   - le 22:00 UTC d'inverno sono le 23 italiane dello stesso giorno, e
//     finivano al giorno dopo;
//   - un'ora vera fra le 22 e mezzanotte UTC d'estate e' gia' il giorno dopo in
//     Italia, e restava indietro.
// La scheda mostrava cosi' un giorno diverso da quello con cui fattura, passiva
// e giacenze collocano l'intervento - a fine mese, un mese diverso. npm run prove
import { caricaLibPagine } from './dati/libPagine.mjs';
import { giornoRoma } from '../src/lib/giornoItaliano.js';

// movimenti.js importa altre librerie delle pagine con l'alias: qui servono solo
// le date, e le sue due funzioni si sostituiscono.
const { giornoDaData, dateDaCorreggere, dataDaGiorno } = await caricaLibPagine('lib/extraRaccoltaStato', [
  ["import { dateMancanti, dateIncoerenti } from '@/lib/movimenti';", 'const dateMancanti = () => [], dateIncoerenti = () => [];'],
]);

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

console.log('I DUE CASI CHE LA CORREZIONE A MANO SBAGLIAVA');
verifica('le 22:00 UTC del 15 gennaio sono le 23 italiane del 15', giornoDaData('2026-01-15T22:00:00.000Z') === '2026-01-15', giornoDaData('2026-01-15T22:00:00.000Z'));
verifica('le 22:30 UTC del 10 luglio sono le 0:30 italiane dell 11', giornoDaData('2026-07-10T22:30:00.000Z') === '2026-07-11', giornoDaData('2026-07-10T22:30:00.000Z'));
verifica('e a fine mese cambia il mese: le 22:30 UTC del 30 settembre sono ottobre', giornoDaData('2026-09-30T22:30:00.000Z') === '2026-10-01', giornoDaData('2026-09-30T22:30:00.000Z'));

console.log('E QUELLI CHE GIA ANDAVANO, CHE RESTANO COME SONO');
const casi = [
  ['2026-09-09T22:00:00.000Z', '2026-09-10'], // mezzanotte italiana d'estate
  ['2026-01-14T23:00:00.000Z', '2026-01-15'], // mezzanotte italiana d'inverno
  ['2026-09-10T00:00:00.000Z', '2026-09-10'], // mezzanotte UTC, come salva la scheda
  ['2026-09-10', '2026-09-10'],               // un giorno senza ora
  ['2026-12-31T22:59:00.000Z', '2026-12-31'], // l'ultimo minuto dell'anno, d'inverno
];
for (const [v, atteso] of casi) verifica(`${v} -> ${atteso}`, giornoDaData(v) === atteso, giornoDaData(v));
verifica('niente data, niente giorno', giornoDaData('') === '' && giornoDaData(null) === '' && giornoDaData('non una data') === '');

console.log('E UNA REGOLA SOLA: QUELLA DI GIORNOROMA');
{
  // Ogni ora di due giorni, uno d'estate e uno d'inverno: la scheda dice sempre
  // il giorno che dice il resto del gestionale.
  let uguali = true, primo = '';
  for (const base of ['2026-07-10', '2026-01-15']) {
    for (let h = 0; h < 24; h++) for (const m of [0, 30]) {
      const v = `${base}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`;
      if (giornoDaData(v) !== giornoRoma(v)) { uguali = false; primo = primo || v; }
    }
  }
  verifica('per ogni ora del giorno, d estate e d inverno', uguali, primo);
}

console.log('LA CORREZIONE DELLE SCHEDE VECCHIE');
{
  const vecchia = { trasporto_finito_il: '2026-09-09T22:00:00.000Z', ordine_immesso_il: '2026-09-01T00:00:00.000Z' };
  const c = dateDaCorreggere(vecchia);
  verifica('la mezzanotte italiana si riporta al giorno giusto, a mezzanotte UTC', c.trasporto_finito_il === '2026-09-10T00:00:00.000Z', JSON.stringify(c));
  verifica('e una data gia giusta non si tocca', !('ordine_immesso_il' in c));
  verifica('il giorno si salva a mezzanotte UTC', dataDaGiorno('2026-09-10') === '2026-09-10T00:00:00.000Z' && dataDaGiorno('') === null);
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
