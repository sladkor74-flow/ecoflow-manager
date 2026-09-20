// Prova della lettura della prefattura dal testo del PDF (base44/shared/prefattura.ts).
// Le righe hanno le tre forme trovate nel PDF vero di luglio 2026: le celle a
// volte si fondono (classe col produttore, tipo col formulario). npm run prove
import { leggiLineePdfPrefattura, confrontaPrefattura } from '../base44/shared/prefattura.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const testa = [
  ['PREFATTURA PROVVISORIA'], ['Prefattura n. 3716'], ['SMOCO Srl'],
  ['Riepilogo servizi prestati nel mese: 07/2026'],
  ['PFU classi da 1 a 4'], ['Tipo', 'Numero', 'Peso', 'Importo'],
  ['Trasp (pri)', '0', '0 Kg', '0,00 Euro'],
  ['Trasp+Tratt (pri)', '3', '7 300 Kg', '1 474,60 Euro'],
  ['Totale', '3', '7 300 Kg', '1 474,60 Euro'],
  ['PFU classe 9'], ['Tipo', 'Numero', 'Peso', 'Importo'],
  ['Trasp+Tratt (pri)', '1', '2 640 Kg', '607,20 Euro'],
  ['Totale', '1', '2 640 Kg', '607,20 Euro'],
  ['Ordine', 'KA', 'Produttore', 'Prodotto', 'Data', 'FIR', 'Tipo', 'Kg', 'Prezzo', 'Importo'],
];
const dettaglio = [
  // dieci celle: tutto separato
  ['ET25047044', 'Eco', 'OFFICINA ALFA SAS', '.class1', '01-07-2026', 'BSDCL002149HV', 'Trasp+Tratt', '2 300', '0,2020', '464,60'],
  // nove celle: la classe fusa col produttore
  ['ET25039351', 'Eco', 'AUTOMOTIVE BETA di ROSSI MARIO .class1', '01-07-2026', 'BSDCL002134YZ', 'Trasp+Tratt', '4 700', '0,2020', '949,40'],
  // otto celle: anche il tipo fuso col formulario
  ['ET26106530', 'Eco', 'TRASPORTI GAMMA SOC. COOPERATIVA .class4', '06-07-2026', 'RGYTR024226WS Trasp+Tratt', '300', '0,2020', '60,60'],
  // ACI, prezzo 0,23 al chilo
  ['ET26119999', 'Eco', 'DEMOLIZIONI DELTA SRL', '.class9', '15-07-2026', 'PHHYQ002800FH', 'Trasp+Tratt', '2 640', '0,2300', '607,20'],
];
const coda = [['.class9', 'PFU Autodemolizione'], ['Eco', 'Ecotyre Scrl, Via Provinciale 17, Vinovo, TO'], ['Powered by TCPDF (www.tcpdf.org)']];

const l = leggiLineePdfPrefattura([...testa, ...dettaglio, ...coda]);
verifica('quattro righe di dettaglio, nelle tre forme', l.righe.length === 4 && l.note.length === 0, JSON.stringify(l.note));
verifica('dieci celle: ordine, formulario, giorno, chili con lo spazio delle migliaia, importo', l.righe[0].id_ordine === 'ET25047044' && l.righe[0].numero_fir === 'BSDCL002149HV' && l.righe[0].giorno === '2026-07-01' && l.righe[0].kg === 2300 && l.righe[0].importo === 464.6 && l.righe[0].prezzo === 0.202);
verifica('nove celle: la classe fusa col produttore non disturba', l.righe[1].kg === 4700 && l.righe[1].importo === 949.4 && l.righe[1].servizio === 'Trasp+Tratt');
verifica('otto celle: il tipo fuso col formulario si separa', l.righe[2].numero_fir === 'RGYTR024226WS' && l.righe[2].servizio === 'Trasp+Tratt' && l.righe[2].kg === 300 && l.righe[2].importo === 60.6);
verifica('il mese si legge dal riepilogo: luglio 2026', l.periodo.anno === 2026 && l.periodo.mese_idx === 6);
verifica('i totali stampati dei due blocchi si sommano, e la lettura risulta completa', l.totali_stampati.ordini === 4 && l.totali_stampati.kg === 9940 && l.totali_stampati.euro === 2081.8 && l.completa === true, JSON.stringify(l.totali_stampati));
verifica('le righe del riepilogo e la legenda non diventano ordini', !l.righe.some(r => /class|Trasp \(/.test(r.id_ordine)));

const monca = leggiLineePdfPrefattura([...testa, ...dettaglio.slice(0, 3), ...coda]);
verifica('se manca una riga la lettura NON e\' completa, e lo dice', monca.completa === false && monca.note.some(n => /ATTENZIONE/.test(n) && /4 ordini/.test(n)));
const strana = leggiLineePdfPrefattura([...testa, ['ET26000001', 'Eco', 'riga', 'senza', 'numeri'], ...dettaglio, ...coda]);
verifica('una riga con un ordine ma non riconoscibile viene segnalata, non ignorata', strana.note.some(n => /ET26000001/.test(n)) && strana.righe.length === 4);

// il PDF letto si confronta come l'Excel
const vive = { RETE: dettaglio.slice(0, 3).map((d, i) => ({ ordine: d[0], numero_fir: l.righe[i].numero_fir, quantita: l.righe[i].kg, totale: l.righe[i].importo, tariffa_valore: 202, servizio_ecotyre: 'TRASP_TRATT' })), ACI: [{ ordine: 'ET26119999', numero_fir: 'PHHYQ002800FH', quantita: 2640, totale: 607.2, tariffa_valore: 230, servizio_ecotyre: 'TRASP_TRATT' }], EXTRA_RACCOLTA: [] };
verifica('e il confronto col gestionale coincide', confrontaPrefattura(l.righe, vive).coincide === true);

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
