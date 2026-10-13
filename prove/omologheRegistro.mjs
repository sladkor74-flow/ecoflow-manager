// Prova della lettura del registro di carico e scarico per le omologhe
// (leggiRegistroOmologhe, src/lib/omologhe.js), dall'audit del 20/09/2026, alta
// A15, corretta il 12/10/2026.
//
// Il criterio dell'utente e' «OMOLOGA OK»: il documento si recepisce una volta,
// al primo ritiro, e quella riga lo annota. La lettura accettava ogni cella che
// contenesse la parola «omologa», e un «OMOLOGA DA RIFARE» o un «IN ATTESA
// OMOLOGA» avrebbero fatto risultare recepita un'omologa che non lo e'.
// Sul registro vero del 09/10/2026 le annotazioni sono tutte OK: il difetto e'
// latente, e questa prova lo tiene chiuso. npm run prove
import * as XLSX from 'xlsx';
import { caricaLibPagine } from './dati/libPagine.mjs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const { leggiRegistroOmologhe } = await caricaLibPagine('lib/omologhe');

// Un registro finto col foglio «Dettaglio», come quello di Irigom.
const righe = [
  ['REGISTRO DI CARICO E SCARICO'],
  ['DATA', 'NR. FIR', 'PRODUTTORE', 'TIPOLOGIA DI RIFIUTO', 'KG'],
  ['05/01/2026', 'RGYTR000001AA', 'GOMME ROSSI SRL', 'OMOLOGA OK', 2500],
  ['06/01/2026', 'RGYTR000002AA', 'PNEUS BIANCHI SRL', 'OMOLOGA OK(R12)', 1800],
  ['07/01/2026', 'RGYTR000003AA', 'VERDI GOMME SNC', 'OMOLOGA DA RIFARE', 2000],
  ['08/01/2026', 'RGYTR000004AA', 'NERI PNEUMATICI', 'IN ATTESA OMOLOGA', 1500],
  ['09/01/2026', 'RGYTR000005AA', 'GIALLI SRL', 'omologa  ok', 1200],
  ['10/01/2026', 'RGYTR000006AA', 'GOMME ROSSI SRL', '', 2600],
];
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(righe), 'Dettaglio');
const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
const file = { name: 'registro di prova.xlsx', arrayBuffer: async () => buffer };

const { annotati, conferitori } = await leggiRegistroOmologhe(file);
const nomi = annotati.map(a => a.nome).sort();
verifica('valgono «OMOLOGA OK», anche con la nota del recupero o scritto in minuscolo',
  JSON.stringify(nomi) === JSON.stringify(['GIALLI SRL', 'GOMME ROSSI SRL', 'PNEUS BIANCHI SRL']), JSON.stringify(nomi));
verifica('«OMOLOGA DA RIFARE» e «IN ATTESA OMOLOGA» non sono omologhe recepite',
  !nomi.includes('VERDI GOMME SNC') && !nomi.includes('NERI PNEUMATICI'));
verifica('ma i loro carichi restano fra i conferitori: chi ha conferito senza omologa si vede',
  conferitori.some(c => c.nome === 'VERDI GOMME SNC') && conferitori.some(c => c.nome === 'NERI PNEUMATICI'), JSON.stringify(conferitori.map(c => c.nome)));
verifica('il produttore che ha l\'OK al primo ritiro conta i ritiri dopo senza annotazione',
  conferitori.find(c => c.nome === 'GOMME ROSSI SRL')?.carichi === 2);

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
