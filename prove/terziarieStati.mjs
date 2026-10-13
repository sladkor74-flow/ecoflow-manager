// Prova della pagina Terziarie (src/pages/Terziarie.jsx) sugli stati, dall'audit
// del 20/09/2026, alta A37, corretta il 12/10/2026.
//
// Senza un filtro di stato, gli indicatori e le uscite per impianto contavano
// ogni stato: il file TERZIARIE del 26/09/2026 portava 17 righe «assegnato»
// (unita' 30013, immesse il 18/09, senza peso) e «Spedizioni / Navi» le contava
// come navi partite. Come le secondarie (computeSecondarieMatrix) e i terminati
// ACI: senza filtro di stato si contano i soli terminati. La regola si prova
// sul sorgente, ricostruendo il conto della pagina su righe finte. npm run prove
import { readFileSync } from 'node:fs';
import { caricaLibPagine } from './dati/libPagine.mjs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const pagina = readFileSync(new URL('../src/pages/Terziarie.jsx', import.meta.url), 'utf8').replace(/\r/g, '');
const { eTerminato } = await caricaLibPagine('lib/movimenti');

console.log('IL CONTO DELLA PAGINA');
// Le righe che decidono il conto, prese dal sorgente cosi' come sono.
const blocco = pagina.slice(pagina.indexOf('  const conStato = '), pagina.indexOf('  const dateInElenco'));
verifica('il conto della pagina si trova', blocco.includes('const contati'), blocco.slice(0, 200));
// eslint-disable-next-line no-new-func
const conto = new Function('records', 'filters', 'eTerminato', `${blocco}\nreturn { contati, senzaFineInElenco, nonTerminatiInElenco };`);
const righe = [
  { id: 1, stato: 'terminato', peso_t: 25, senza_fine_trasporto: false },
  { id: 2, stato: 'terminato', peso_t: 30, senza_fine_trasporto: false },
  { id: 3, stato: 'assegnato', peso_t: 0, senza_fine_trasporto: false },
  { id: 4, stato: 'assegnato', peso_t: 0, senza_fine_trasporto: false },
  { id: 5, stato: 'terminato', peso_t: 20, senza_fine_trasporto: true },
];
let esito;
try { esito = conto(righe, { stato: [] }, eTerminato); } catch (e) { esito = { errore: e.message }; }
verifica('senza filtro di stato contano i soli terminati con fine trasporto',
  esito.contati && esito.contati.map(r => r.id).join() === '1,2', JSON.stringify(esito));
verifica('i non terminati dell\'elenco si dicono, non spariscono', esito.nonTerminatiInElenco === 2, JSON.stringify(esito));
verifica('il senza fine trasporto resta fuori come prima', esito.senzaFineInElenco === 1, JSON.stringify(esito));
let conStato;
try { conStato = conto(righe, { stato: ['assegnato'] }, eTerminato); } catch (e) { conStato = { errore: e.message }; }
verifica('con un filtro sugli stati contano gli stati scelti (l\'elenco e\' gia\' filtrato)',
  conStato.contati && conStato.contati.length === 4 && conStato.nonTerminatiInElenco === 0, JSON.stringify(conStato));

console.log('CHI USA IL CONTO');
verifica('gli indicatori usano i contati', /spedizioni: contati\.length/.test(pagina) && /totale_t: contati\.reduce/.test(pagina));
verifica('le uscite per impianto usano i contati', /<UscitePerImpianto records=\{contati\}/.test(pagina));
verifica('la pagina dice che cosa contano gli indicatori', /Indicatori e uscite per impianto contano \{conStato \? 'i trasporti degli stati scelti' : 'i trasporti terminati'\}/.test(pagina));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
