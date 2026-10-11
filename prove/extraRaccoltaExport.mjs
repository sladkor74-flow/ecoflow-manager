// IL FILE «SMOCO-Fatturazione EXTRA RACCOLTA» DICE I NUMERI DELLA FATTURA
// (chiusura dell'audit, 11/10/2026, revisione dei soldi).
//
// 1. Il «Totale imponibile» sommava i sovracosti del ricavo di tutti gli
//    interventi, anche di quelli che la fattura non conta (un terminato senza
//    peso effettivo, una secondaria): 504,00 contro 454,00 della fattura e
//    dell'analisi per produttore dello stesso file.
// 2. Il file non riceveva le tariffe lette dalla pagina: con la Tariffa
//    EXTRA_RACCOLTA a un valore diverso dalla base diceva un altro prezzo.
// 3. Un peso che manca si scriveva 0 kg; il PDF scriveva i numeri col punto
//    decimale («404»), non all'italiana.
// npm run prove
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { caricaLibPagine } from './dati/libPagine.mjs';
import { calcolaRigheAttiva } from '../base44/shared/attivaCalcolo.ts';
import { contestoPrezzi, calcExtraRaccolta } from '../src/lib/extraRaccoltaCalc.js';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// xlsx vero, ma senza scrivere il file: si tiene la tabella che diventa il foglio
const vero = createRequire(import.meta.url)('xlsx');
let righe = null;
globalThis.__XLSX = { ...vero, writeFile: () => {}, utils: { ...vero.utils, aoa_to_sheet: (d, o) => { righe = d; return vero.utils.aoa_to_sheet(d, o); } } };
// jspdf finto: si tengono i testi scritti
let testi = [];
class FintoPdf {
  text(t) { testi.push(String(t)); return this; }
}
for (const m of ['setFontSize', 'setFont', 'addPage', 'save']) FintoPdf.prototype[m] = function () { return this; };
globalThis.__JSPDF = { jsPDF: FintoPdf };
const lib = await caricaLibPagine('lib/extraRaccoltaExport', [
  ["await import('xlsx')", 'globalThis.__XLSX'],
  ["await import('jspdf')", 'globalThis.__JSPDF'],
  // un import relativo senza estensione, se ci fosse, node non lo risolve
  ["from './extraRaccoltaCalc'", "from './extraRaccoltaCalc.js'"],
]);
const { exportExtraRaccoltaExcel, exportExtraRaccoltaPDF } = lib;

const base = {
  stato: 'terminato', tipo_movimento: 'primaria', cer: '160103', classe: 'P', produttore: 'COMUNE DI ESEMPIO', trasportatore: 'LOGISTICA', destinazione: 'Irigom S.r.l.',
  ordine_immesso_il: '2026-09-01T00:00:00.000Z', trasporto_iniziato_il: '2026-09-10T00:00:00.000Z', trasporto_finito_il: '2026-09-10T00:00:00.000Z',
};
const interventi = [
  { ...base, id: 'A', id_ordine: 'ER-A', numero_fir: 'FIR-A', peso_effettivo: 2000, prezzo_attivo_t: 202, sovracosto_raccolta: 50 },
  // scheda vecchia: terminata, senza peso effettivo, con la quantita' ritirata e un sovracosto
  { ...base, id: 'B', id_ordine: 'ER-B', numero_fir: 'FIR-B', peso_effettivo: 0, quantita_ritirata: 3000, prezzo_attivo_t: 202, sovracosto_raccolta: 50 },
  // una secondaria con un sovracosto: non si fattura a Ecotyre, il ricavo sta sulla raccolta
  { ...base, id: 'C', id_ordine: 'ER-C', numero_fir: 'FIR-C', tipo_movimento: 'secondaria', stoccaggio: 'NAPPI SUD SRL', peso_effettivo: 4000, sovracosto_trasporto: 30 },
];
const cella = (etichetta) => (righe.find(r => r[0] === etichetta) || [])[1];

console.log('1. IL TOTALE IMPONIBILE E\' QUELLO DELLA FATTURA');
{
  await exportExtraRaccoltaExcel(interventi, 'Settembre', 2026);
  const fattura = calcolaRigheAttiva({ reteAll: [], aciAll: [], extraAll: interventi, fornitori: [], tariffe: [], anno: 2026, mese: 'Settembre' });
  const totFattura = Math.round(fattura.righe.EXTRA_RACCOLTA.reduce((s, r) => s + r.totale, 0) * 100) / 100;
  const rigaTot = righe.find(r => r[0] === 'TOTALE');
  verifica('totale imponibile 454,00, come la fattura (prima 534,00: i sovracosti di tutti)', cella('Totale imponibile') === 454 && totFattura === 454, `${cella('Totale imponibile')} / ${totFattura}`);
  verifica('e come i ricavi dell\'analisi per produttore dello stesso file', rigaTot && rigaTot[10] === 454, JSON.stringify(rigaTot));
  verifica('il sovracosto di raccolta e\' solo quello che si fattura: 50, non 100', cella('Sovracosto Raccolta') === 50, String(cella('Sovracosto Raccolta')));
  verifica('e quello di trasporto della secondaria non c\'e\': 0', cella('Sovracosto Trasporto') === 0, String(cella('Sovracosto Trasporto')));
}

console.log('2. UN PESO CHE MANCA NON E\' ZERO');
{
  const rigaB = righe.find(r => r[0] === 'FIR-B');
  verifica('la scheda senza peso ha «—» nella quantita\', non 0 e non i 3.000 kg ritirati', rigaB && rigaB[8] === '—', JSON.stringify(rigaB));
  verifica('e il totale della quantita\' conta solo i pesi veri: 6.000 kg', cella("TOTALE QUANTITA' (kg)") === 6000, String(cella("TOTALE QUANTITA' (kg)")));
  const iTitolo = righe.findIndex(r => /^DA SISTEMARE: interventi terminati senza peso effettivo/.test(String(r[0] || '')));
  verifica('c\'e\' la riga «da sistemare» del peso mancante', iTitolo > 0, String(iTitolo));
  verifica('con la frase della fattura', iTitolo > 0 && righe[iTitolo + 1][0] === 'FIR-B' && /terminato senza peso effettivo/.test(righe[iTitolo + 1][1]), JSON.stringify(righe[iTitolo + 1]));
}

console.log('3. LE TARIFFE DELLA PAGINA ARRIVANO AL FILE');
{
  // la Tariffa EXTRA_RACCOLTA del 2026 a 210, e un intervento senza prezzo scritto
  const tariffa = { id: 'tx', direzione: 'ATTIVA', tipologia: 'EXTRA_RACCOLTA', cliente: 'ECOTYRE', valore: 210, unita_misura: '€/t', stato: 'attivo', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31' };
  const contesto = contestoPrezzi([tariffa], []);
  const senzaPrezzo = [{ ...base, id: 'D', id_ordine: 'ER-D', numero_fir: 'FIR-D', peso_effettivo: 1000 }];
  await exportExtraRaccoltaExcel(senzaPrezzo, 'Settembre', 2026, contesto);
  const rigaD = righe.find(r => r[0] === 'FIR-D');
  const pagina = calcExtraRaccolta(senzaPrezzo[0], contesto);
  const fattura = calcolaRigheAttiva({ reteAll: [], aciAll: [], extraAll: senzaPrezzo, fornitori: [], tariffe: [tariffa], anno: 2026, mese: 'Settembre' });
  verifica('col contesto della pagina il prezzo e\' quello della tabella: 210, come pagina e fattura', rigaD && rigaD[9] === 210 && pagina.prezzo_attivo === 210 && fattura.righe.EXTRA_RACCOLTA[0].tariffa_valore === 210,
    JSON.stringify([rigaD && rigaD[9], pagina.prezzo_attivo, fattura.righe.EXTRA_RACCOLTA[0] && fattura.righe.EXTRA_RACCOLTA[0].tariffa_valore]));
  verifica('e il totale della riga 210,00', rigaD && rigaD[10] === 210, JSON.stringify(rigaD));
  const src = readFileSync(new URL('../src/pages/ExtraRaccolta.jsx', import.meta.url), 'utf8').replace(/\r/g, '');
  verifica('la pagina passa il suo contesto all\'Excel e al PDF',
    /exportExtraRaccoltaExcel\(terminati, mese, anno, contesto\)/.test(src) && /exportExtraRaccoltaPDF\(terminati, mese, anno, contesto\)/.test(src));
}

console.log('4. IL PDF DICE GLI STESSI NUMERI, ALL\'ITALIANA');
{
  testi = [];
  await exportExtraRaccoltaPDF(interventi, 'Settembre', 2026);
  verifica('totale imponibile «454,00», come l\'Excel', testi.includes('Totale imponibile: 454,00'), testi.filter(t => /imponibile/.test(t)).join(' | '));
  verifica('i chili col punto delle migliaia: «2.000»', testi.includes('2.000'), testi.filter(t => /^2.?000$/.test(t)).join(' | '));
  verifica('il peso che manca si scrive «—»', testi.includes('—'));
  verifica('e la scheda senza peso si dice', testi.some(t => /FIR-B.*terminato senza peso effettivo/.test(t)), testi.filter(t => /senza peso/.test(t)).join(' | '));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
