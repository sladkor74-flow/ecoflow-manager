// Prova della prefattura Ecotyre (base44/shared/prefattura.ts): lettura di un
// foglio senza tracciato garantito e confronto ordine per ordine col gestionale.
// Si lancia con: npm run prove
import { leggiTabellePrefattura, confrontaPrefattura, comeNumero } from '../base44/shared/prefattura.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

console.log('NUMERI');
verifica('italiano con migliaia', comeNumero('1.234,56') === 1234.56);
verifica('senza virgola, il punto con tre cifre sono le migliaia', comeNumero('12.345') === 12345 && comeNumero('1.5') === 1.5);
verifica('con simbolo', comeNumero('€ 202,00') === 202 && comeNumero(' 3.460 kg') !== null);
verifica('vuoto e testo', comeNumero('') === null && comeNumero('n.d.') === null);

console.log('LETTURA');
const foglio = {
  nome: 'Rete',
  celle: [
    ['PREFATTURA ECOTYRE', null, null, null, null],
    ['Periodo: giugno 2026', null, null, null, null],
    [],
    ['ID Ordine', 'N. Formulario', 'Peso (kg)', 'Tariffa €/t', 'Importo €'],
    ['ET26000001', 'fir001', 1000, 202, 202],
    ['ET26000002', 'FIR002', '2.500', '202,00', '505,00'],
    ['ET26000003', 'FIR003', 3000, 202, 606],
    ['Totale', null, 6500, null, 1313],
  ],
};
const senzaTesta = { nome: 'ACI', celle: [['EA26000001', 'x', 2.0, 1400], ['EA26000009', 'y', 1.5, 1050]] };
const l = leggiTabellePrefattura([foglio, senzaTesta, { nome: 'Note', celle: [['scritte libere']] }]);
verifica('3 righe dal foglio con intestazione, il totale non e\' un ordine', l.righe.filter(r => r.foglio === 'Rete').length === 3);
verifica('numeri scritti come testo', l.righe[1].kg === 2500 && l.righe[1].importo === 505 && l.righe[1].numero_fir === 'FIR002');
verifica('senza intestazione: gli ordini si riconoscono dalla forma', l.righe.filter(r => r.foglio === 'ACI').length === 2);
verifica('foglio senza ordini: saltato con una nota', l.note.some(n => /Note/.test(n)));
const tonn = leggiTabellePrefattura([{ nome: 'T', celle: [['Ordine', 'Peso t', 'Importo'], ['ET26000001', 1.0, 202], ['ET26000002', 2.5, 505]] }]);
verifica('pesi in tonnellate convertiti in kg, e detto', tonn.righe[1].kg === 2500 && tonn.note.some(n => /tonnellate/.test(n)));

const vero = leggiTabellePrefattura([{ nome: 'Worksheet', celle: [
  ['ID Prefattura', 'Fatturante', 'Periodo', 'KeyAccount', 'Tipo', 'Ordine', 'Data fine trasporto', 'Numero FIR', 'Prodotto', 'Quantità (kg)', 'Prezzo Unitario (Euro/Kg)', 'Prezzo Totale'],
  [3716, 'SMOCO Srl', 46204, 'Ecotyre Scrl', 'Trasp+Tratt', 'ET25047044', 46204, 'BSDCL002149HV', '.class1', 2300, 0.202, 464.6],
  [3716, 'SMOCO Srl', 46204, 'Ecotyre Scrl', 'Trasp', 'ET26130005', 46234, 'LQQDP001408LD', '.class1', 3840, 0.202, 775.68],
] }]);
verifica('il tracciato vero del portale: ordine, FIR, kg, importo e tipo di servizio', vero.righe.length === 2 && vero.note.length === 0
  && vero.righe[0].id_ordine === 'ET25047044' && vero.righe[0].numero_fir === 'BSDCL002149HV' && vero.righe[0].kg === 2300 && vero.righe[0].importo === 464.6 && vero.righe[1].servizio === 'Trasp', JSON.stringify(vero));

console.log('CONFRONTO');
const riga = (ordine, quantita, totale, altro = {}) => ({ ordine, numero_fir: 'F-' + ordine, quantita, totale, tariffa_valore: 202, ...altro });
const vive = {
  RETE: [riga('ET26000001', 1000, 202), riga('ET26000002', 2500, 505), riga('ET26000004', 4000, 808)],
  ACI: [riga('EA26000001', 2000, 1400, { tariffa_valore: 700 })],
  EXTRA_RACCOLTA: [riga('EX26000001', 460, 161, { tariffa_valore: 350 }), riga('EX26000001', 0, 120, { unita_misura: '€ a corpo', descrizione: 'Sovracosto raccolta' })],
};
const altrove = new Map([['ET26000003', { canale: 'RETE', stato: 'terminato', giorno: '2026-07-01' }], ['EA26000009', { canale: 'ACI', stato: 'cancellato', giorno: '' }]]);
const pre = [
  { id_ordine: 'ET26000001', kg: 1000, importo: 202 },
  { id_ordine: 'ET26000002', kg: 2600, importo: 525.2 },      // peso diverso
  { id_ordine: 'ET26000003', kg: 3000, importo: 606 },        // nel gestionale sta a luglio
  { id_ordine: 'EA26000001', kg: 2000, importo: 1500 },       // stesso peso, prezzo diverso
  { id_ordine: 'EA26000009', kg: 1500, importo: 1050 },       // cancellato nel gestionale
  { id_ordine: 'EX26000001', kg: 460, importo: 161 },         // due righe nella prefattura...
  { id_ordine: 'EX26000001', kg: null, importo: 120 },        // ...come le due del gestionale
  { id_ordine: 'ZZ26999999', kg: 100, importo: 20 },          // sconosciuto
];
const c = confrontaPrefattura(pre, vive, altrove);
const rete = c.canali.find(x => x.canale === 'RETE'), aci = c.canali.find(x => x.canale === 'ACI'), extra = c.canali.find(x => x.canale === 'EXTRA_RACCOLTA');
verifica('rete: ET4 solo nel gestionale, ET2 col peso diverso', rete.solo_gestionale.length === 1 && rete.solo_gestionale[0].id_ordine === 'ET26000004' && rete.peso_diverso.length === 1 && rete.peso_diverso[0].kg_prefattura === 2600);
verifica('aci: stesso peso, importo diverso, col prezzo ricavato 750 contro 700', aci.importo_diverso.length === 1 && aci.importo_diverso[0].prezzo_prefattura_t === 750 && aci.importo_diverso[0].prezzo_gestionale_t === 700);
verifica('extra: intervento + sovracosto sommati su entrambi i lati, nessuna differenza', extra.peso_diverso.length === 0 && extra.importo_diverso.length === 0 && extra.solo_gestionale.length === 0 && extra.gestionale.euro === 281);
verifica('solo in prefattura: tre, ciascuno con la sua ragione', c.solo_prefattura.length === 3
  && /01\/07\/2026/.test(c.solo_prefattura.find(x => x.id_ordine === 'ET26000003').spiegazione)
  && /cancellato/.test(c.solo_prefattura.find(x => x.id_ordine === 'EA26000009').spiegazione)
  && /sconosciuto/.test(c.solo_prefattura.find(x => x.id_ordine === 'ZZ26999999').spiegazione), JSON.stringify(c.solo_prefattura));
verifica('il canale dell\'ordine viene dal gestionale, nessun totale fra canali', c.canali.length === 3 && !('totale' in c) && c.differenze === 6 && c.coincide === false, String(c.differenze));
const uguale = confrontaPrefattura([{ id_ordine: 'ET26000001', kg: 1000, importo: 202 }], { RETE: [riga('ET26000001', 1000, 202)], ACI: [], EXTRA_RACCOLTA: [] });
verifica('tutto uguale: coincide', uguale.coincide === true && uguale.differenze === 0);
const serv = confrontaPrefattura([{ id_ordine: 'ET26000001', kg: 1000, importo: 202, servizio: 'Trasp', numero_fir: 'fir-x' }], { RETE: [riga('ET26000001', 1000, 202, { servizio_ecotyre: 'TRASP_TRATT', numero_fir: 'FIR-Y' })], ACI: [], EXTRA_RACCOLTA: [] });
verifica('tipo di servizio e formulario diversi: due differenze', serv.differenze === 2 && serv.canali[0].servizio_diverso[0].servizio_prefattura === 'TRASP' && serv.canali[0].fir_diverso[0].fir_gestionale === 'FIR-Y');
const conExtra = confrontaPrefattura([{ id_ordine: 'ET26000001', kg: 1000, importo: 202 }], { RETE: [riga('ET26000001', 1000, 202)], ACI: [], EXTRA_RACCOLTA: [riga('BSDCL002230PQ', 460, 92.92)] });
verifica('l\'extra raccolta non passa dalla prefattura: non e\' una differenza', conExtra.coincide === true && conExtra.canali[2].fuori_prefattura === true && conExtra.canali[2].solo_gestionale.length === 1);
const conTer = confrontaPrefattura([{ id_ordine: 'ET26000001', kg: 1000, importo: 202 }, { id_ordine: 'TER26018323', kg: 27160, importo: 217.28, numero_fir: 'ALL700091/26' }, { id_ordine: 'TER26002903', kg: 27680, importo: 276.8 }],
  { RETE: [riga('ET26000001', 1000, 202)], ACI: [], EXTRA_RACCOLTA: [] }, new Map([['TER26002903', { canale: 'TERZIARIE', stato: 'terminato', giorno: '2026-01-10' }]]));
verifica('terziarie: un gruppo a parte col totale e il prezzo ricavato, non ordini sconosciuti', conTer.terziarie.ordini === 2 && conTer.terziarie.euro === 494.08 && conTer.terziarie.righe[0].prezzo_t === 8 && conTer.terziarie.righe[1].prezzo_t === 10
  && conTer.terziarie.non_in_archivio === 1 && conTer.solo_prefattura.length === 0 && conTer.differenze === 1 && conTer.coincide === false, JSON.stringify(conTer.terziarie));
verifica('prefattura vuota: non "coincide"', confrontaPrefattura([], { RETE: [], ACI: [], EXTRA_RACCOLTA: [] }).coincide === false);
const soloOrdini = confrontaPrefattura([{ id_ordine: 'ET26000001', kg: null, importo: null }], { RETE: [riga('ET26000001', 1000, 202)], ACI: [], EXTRA_RACCOLTA: [] });
verifica('prefattura con i soli ordini: si confronta quel che c\'e\'', soloOrdini.coincide === true && soloOrdini.con_importi === false && soloOrdini.canali[0].prefattura.euro === null);

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
