// Prova di TRE INDICATORI CHE DICEVANO UNA COSA DIVERSA DAL RESTO, 10/10/2026.
//
// Trovati dall'audit di congruenza del 10/10/2026: nessuno dei tre cambia oggi un
// numero, perche' i dati di oggi non li fanno scattare; ma ognuno era un secondo
// modo di leggere lo stesso dato, e il giorno che i dati cambiano dice il falso.
//
// 1. Il report settimanale leggeva il giorno di fine trasporto con una sua
//    correzione fatta a mano: riportava al giorno italiano solo le ore 22:00 e
//    23:00 tonde. Un trasporto finito alle 23:30 UTC del 30 giugno - a Roma l'1:30
//    del primo luglio - restava a giugno nel report e andava a luglio in tutto il
//    resto del gestionale. Ora usa giornoRoma come tutti.
// 2. La matrice delle province contava il mese in corso come un mese vuoto: il
//    primo ottobre una provincia senza ritiri a settembre diventava «2 mesi
//    consecutivi senza raccolte», e l'avviso si spegneva al primo ritiro.
// 3. Nell'andamento dei raccoglitori la regex che doveva togliere gli spazi doppi
//    era /s+/: toglieva le lettere «s». «Emmesse Srl» diventava «Emme e Srl».
// npm run prove
import { readFileSync } from 'node:fs';
import { calcolaReportSettimanale } from '../base44/shared/reportSettimanale.ts';
import { computeProvinceMatrixData } from '../base44/shared/primarieReteAnalytics.ts';
import { oggiRoma } from '../base44/shared/giornoItaliano.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

console.log('IL REPORT SETTIMANALE LEGGE IL GIORNO ITALIANO');
{
  const annui = [{ regione: 'Campania', raccoglitore: 'C.L. SERVICE S.R.L.', target_tonnellate: 100 }];
  const rit = (fine, kg = 5000) => ({ stato: 'terminato', trasportatore: 'C.L. SERVICE S.R.L.', provincia: 'SA', peso_effettivo: kg, destinazione: 'Irigom S.r.l.', trasporto_finito_il: fine });
  const rete = [
    rit('2026-06-30T23:30:00Z', 5000),   // a Roma 01:30 del 1 luglio (ora legale): LUGLIO
    rit('2026-06-30T22:00:00Z', 1000),   // mezzanotte italiana tonda: luglio, come prima
    rit('2026-06-30T21:30:00Z', 300),    // a Roma 23:30 del 30 giugno: GIUGNO
    rit('2026-07-31T22:30:00Z', 700),    // a Roma 00:30 del 1 agosto: non luglio
    rit('2026-01-31T23:30:00Z', 2000),   // ora solare: a Roma 00:30 del 1 febbraio
    rit('2026-12-31T23:30:00Z', 4000),   // a Roma e' gia' il 2027: fuori dal 2026
  ];
  const riga = (m) => calcolaReportSettimanale({ rete, annui, anno: 2026, mese: m }).righe.find(r => r.raccoglitore === 'C.L. SERVICE S.R.L.');
  const lug = riga(7), giu = riga(6), gen = riga(1), feb = riga(2);
  verifica('luglio: il trasporto finito alle 23:30 UTC del 30/06 e la mezzanotte tonda (6 t)', lug && lug.raccolto_mese === 6, lug && String(lug.raccolto_mese));
  verifica('giugno: solo quello finito davvero il 30 a Roma (0,3 t)', giu && giu.raccolto_mese === 0.3, giu && String(giu.raccolto_mese));
  verifica('gennaio non si prende il 1 febbraio italiano', gen && gen.raccolto_mese === 0, gen && String(gen.raccolto_mese));
  verifica('febbraio se lo prende (2 t)', feb && feb.raccolto_mese === 2, feb && String(feb.raccolto_mese));
  verifica("l'anno si chiude al 31/12 italiano: il trasporto del 1/1/2027 non e' del 2026 (9 t)", lug && lug.totale_anno === 9, lug && String(lug.totale_anno));
  // La settimana: il 1 luglio 2026 e' mercoledi', settimana 27, la prima del mese.
  verifica('e il peso va nella settimana del giorno italiano, la prima di luglio', lug && lug.settimane[0] === 6, lug && JSON.stringify(lug.settimane));
}

console.log('LE PROVINCE: IL MESE IN CORSO NON E\' UN MESE VUOTO');
{
  const anno = Number(oggiRoma().slice(0, 4));
  const mm = (i) => String(i + 1).padStart(2, '0');
  const rit = (prov, meseIdx) => ({ provincia: prov, stato: 'terminato', numero_fir: 'F' + prov + meseIdx, trasporto_finito_il: `${anno}-${mm(meseIdx)}-10T09:00:00Z` });
  const OTTOBRE = 9;
  const records = [
    // SA: ritiri fino ad agosto, settembre vuoto, ottobre in corso e ancora vuoto
    ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => rit('SA', i)),
    // NA: ritiri fino a luglio, agosto e settembre vuoti: due mesi FINITI a zero
    ...[0, 1, 2, 3, 4, 5, 6].map(i => rit('NA', i)),
    // BA: tutti i mesi finiti, nessun avviso
    ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => rit('BA', i)),
  ];
  const m = computeProvinceMatrixData(records, OTTOBRE);
  const p = (x) => m.province.find(q => q.provincia === x);
  verifica('SA: un mese finito a zero piu\' il mese in corso non fanno due mesi senza raccolte', p('SA') && p('SA').has_2_consecutive_zeros === false);
  verifica('NA: agosto e settembre, due mesi finiti a zero, si segnalano', p('NA') && p('NA').has_2_consecutive_zeros === true && p('NA').last_zero_pair && p('NA').last_zero_pair.start === 'Agosto' && p('NA').last_zero_pair.end === 'Settembre',
    p('NA') && JSON.stringify(p('NA').last_zero_pair));
  verifica('BA: nessun avviso', p('BA') && p('BA').has_2_consecutive_zeros === false);
  verifica('nella lista delle province da guardare solo NA', m.province_with_zeros.map(q => q.provincia).join() === 'NA', m.province_with_zeros.map(q => q.provincia).join());
  verifica('la tabella mostra comunque il mese in corso', p('SA') && p('SA').mesiValues[OTTOBRE].passed === true);
  // Il primo giorno dell'anno non c'e' nessun mese finito: nessun avviso.
  const g = computeProvinceMatrixData([rit('SA', 0)], 0);
  verifica('a gennaio nessuna provincia ha due mesi vuoti', g.province_with_zeros.length === 0);
}

console.log('I NOMI DEI RACCOGLITORI: SI TOLGONO GLI SPAZI, NON LE S');
{
  const src = readFileSync(new URL('../base44/functions/andamentoRaccoglitori/entry.ts', import.meta.url), 'utf8');
  const riga = src.split(/\r?\n/).find(l => l.includes('const pulisciNome ='));
  verifica('la funzione c\'e\'', !!riga);
  const corpo = riga && riga.slice(riga.indexOf('=') + 1).trim().replace(/;$/, '');
  const pulisciNome = corpo ? new Function(`return (${corpo});`)() : () => '';
  verifica('«Emmesse  Srl» resta Emmesse', pulisciNome('Emmesse  Srl') === 'Emmesse Srl', pulisciNome('Emmesse  Srl'));
  verifica('gli a capo e le tabulazioni diventano uno spazio', pulisciNome(' C.L.\tSERVICE\n S.R.L. ') === 'C.L. SERVICE S.R.L.', pulisciNome(' C.L.\tSERVICE\n S.R.L. '));
  verifica('due nomi diversi per una s restano diversi', pulisciNome('Grass Srl') !== pulisciNome('Gras Srl'));
}

console.log(`\n${ok} superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
