// Il report settimanale ricavato da un REGISTRO DI CARICO E SCARICO
// (src/lib/verifiche.js, reportDaRegistro): deve contenere i carichi E GLI
// SCARICHI.
//
// Il caso vero, segnalato dall'utente il 06/10/2026: settimana 40, Irigom,
// «1 registrato assente nel report» per un'uscita secondaria ACI di 12.820 kg.
// Nel registro quel movimento c'era - gruppo ACI, colonna "Uscite" - ma si
// leggevano le sole colonne degli ingressi, e la riga veniva scartata perche'
// senza peso. Il gestionale dava per non fatta una movimentazione eseguita.
//
// Le colonne delle uscite si prendono solo dentro i gruppi Ecotyre e ACI: il
// registro ne ha molte altre (CER 160103, 191202, CSS-C, ferro) che non sono
// movimenti di PFU della commessa. npm run prove
import { caricaLibPagine } from './dati/libPagine.mjs';
import * as XLSX from 'xlsx';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const lib = await caricaLibPagine('lib/verifiche');

// Un registro con la forma di quello vero: riga dei gruppi, riga delle
// intestazioni, poi i movimenti. Il gruppo ACI ha Ingresso, Uscite e Giacenza.
// Le celle unite di un foglio Excel, lette con SheetJS, portano il valore solo
// nella prima colonna del gruppo: e' cosi' che il lettore riconosce le campate.
const GRUPPI = ['', '', '', '', '', '', '', '', '', '', 'ECOTYRE', '', '', '', 'ACI', '', '', 'CER 160103', ''];
const INTEST = ['DATA', 'Nr. Prot.', 'Nr. Bolla o Ticket', 'PRODUTTORE', 'TRASPORTATORE', 'DESTINATARIO', 'INTERMEDIARIO', 'Nr. FIR', 'TIPOLOGIA DI RIFIUTO', 'GIACENZA TOT.', 'P', 'M', 'G1', 'G2', 'Ingresso', 'Uscite', 'Giacenza', 'USCITA', 'Scarico TRATT.'];
const vuota = () => new Array(INTEST.length).fill('');
const riga = (campi) => { const r = vuota(); for (const [i, v] of Object.entries(campi)) r[i] = v; return r; };

// un ingresso di rete: 2.620 kg in classe M
const ingresso = riga({ 0: '29/09/2026', 2: 'ET26142913', 3: 'LANEVE PNEUMATICI', 4: 'SMOCO', 5: 'IRIGOM', 6: 'ECOTYRE', 7: 'BSDCL002510QC', 11: 2620 });
// l'uscita ACI del caso vero: i chili stanno SOLO nella colonna Uscite del gruppo ACI
const uscitaAci = riga({ 0: '29/09/2026', 2: 'SEC26159929', 3: 'IRIGOM', 4: 'SMOCO', 5: 'GATIM', 6: 'ACI/ECOTYRE', 7: 'CNDJM000375BJ', 15: 12820 });
// un'uscita di un altro CER: non e' un movimento della commessa e non deve entrare
const uscitaFerro = riga({ 0: '29/09/2026', 3: 'IRIGOM', 4: 'SMOCO', 5: 'FER.METAL', 7: 'QZHRN003351BB', 17: 29940 });

const foglio = [GRUPPI, INTEST, ingresso, uscitaAci, uscitaFerro];
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(foglio), 'Dettaglio');

const registro = lib.reportDaRegistro(XLSX, wb, { inizio: '2026-09-28', fine: '2026-10-04' });
const tabelle = registro ? [registro] : null;

console.log('IL REGISTRO DI CARICO E SCARICO: I CARICHI E GLI SCARICHI');
{
  // reportDaRegistro non e' esportata: si passa dalla lettura del file, che la usa.
  // Qui si ricostruisce la stessa chiamata con il workbook gia' in memoria.
  const righe = tabelle && tabelle.length ? tabelle[0].righe : null;
  verifica('il registro si riconosce e produce una tabella', !!righe && righe.length > 1, JSON.stringify(tabelle && tabelle.map(t => t.nome)));
  if (righe) {
    const fir = righe.slice(1).map(r => r[6]);
    verifica('il carico c\'e\'', fir.includes('BSDCL002510QC'), JSON.stringify(fir));
    verifica('e lo scarico ACI pure: e\' il movimento che risultava «assente nel report»',
      fir.includes('CNDJM000375BJ'), JSON.stringify(fir));
    const u = righe.slice(1).find(r => r[6] === 'CNDJM000375BJ');
    verifica('con i suoi chili, presi dalla colonna delle uscite', u && u[8] === 12820, JSON.stringify(u));
    verifica('e con produttore e destinatario, che sono quelli che ne fanno un\'uscita',
      u && u[2] === 'IRIGOM' && u[4] === 'GATIM', JSON.stringify(u));
    verifica('la classe di uno scarico ACI resta ACI', u && u[7] === 'ACI', JSON.stringify(u));
    verifica('un\'uscita di un altro CER non entra: non e\' un movimento della commessa',
      !fir.includes('QZHRN003351BB'), JSON.stringify(fir));
    verifica('il nome della tabella dice che ci sono anche gli scarichi',
      /carichi e scarichi/.test(tabelle[0].nome), tabelle[0].nome);
  }
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
