// IL SURPLUS SULLE TARIFFE NEL CONFRONTO CON LA PREFATTURA DI ECOTYRE (13/10/2026).
//
// Dal 01/10/2026 SMOCO fattura a Ecotyre il Fuel Surcharge del consorzio, +5 €/t,
// con una riga sua per canale (attivaCalcolo.ts). Come lo scrivera' il portale
// nella prefattura non si sa ancora (la prima e' quella di ottobre): le forme
// possibili sono quattro, e il confronto (base44/shared/prefattura.ts) deve
// riconoscerle tutte senza inventare differenze:
//   a. nel prezzo: ogni ordine a 0,207 €/kg invece di 0,202;
//   b. una riga per ordine col Tipo «Fuel Surcharge»;
//   c. una riga sola, senza ordine (per canale, o per tutti insieme);
//   d. niente: il surplus arriva con una comunicazione a parte.
// In tutte: nessun «peso diverso» o «importo diverso» inventato, nessun «solo nel
// gestionale» con l'ordine vuoto, un riquadro del surplus per canale che dice
// la forma e se torna; lo scarto di arrotondamento (per ordine contro sul mese)
// si dice e non ferma l'esportazione; una riga che non si sa di che canale sia
// si chiede. Le terziarie (Prodotto vuoto) e un produttore che si chiama
// «Carburanti» non sono surplus.
//
// LA TOLLERANZA (revisione del 13/10/2026). Era mezzo centesimo per ordine:
// sulla rete di luglio 2026 fino a 2,05 €, e ci passavano per «arrotondamento»
// una riga sola sbagliata di 2,00 €, un ordine senza la sua riga di surplus e un
// ordine con la riga due volte. Ora nelle forme a e b ogni ordine si controlla
// col suo surplus (entro un centesimo) e si dice quale non torna; nella forma c
// la riga torna se fa quello del gestionale o la somma arrotondata ordine per
// ordine, con un centesimo di margine. Un importo che la prefattura non ha non
// e' zero (esito 'senza_importo', «—»); nel PDF la riga «Totale Fuel Surcharge»
// non e' una riga di surplus in piu', come nell'Excel.
//
// Le quattro forme si costruiscono sulla prefattura vera di luglio 2026 (416
// righe, che coincide al centesimo col gestionale sui dati veri dell'11/10/2026),
// con un Fuel Surcharge simulato su luglio. Senza il file o senza la copia dei
// dati veri quella parte si salta, e lo dice.
//
// node prove/prefatturaSurplus.mjs
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { leggiTabellePrefattura, leggiLineePdfPrefattura, confrontaPrefattura } from '../base44/shared/prefattura.ts';
import { calcolaRigheAttiva } from '../base44/shared/attivaCalcolo.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const leggi = (p) => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r/g, '');
// il centesimo di Excel, come lo scrive il portale
const euro = (v) => Math.round(Number((v * 100).toPrecision(15))) / 100;

const TESTA = ['ID Prefattura', 'Fatturante', 'Periodo', 'KeyAccount', 'Tipo', 'Ordine', 'Data fine trasporto', 'Numero FIR', 'Prodotto', 'Quantità (kg)', 'Prezzo Unitario (Euro/Kg)', 'Prezzo Totale'];
const rigaPre = (ordine, kg, prezzo, altro = {}) => {
  const r = [3716, 'SMOCO Srl', 46204, 'Ecotyre Scrl', altro.tipo || 'Trasp+Tratt', ordine, 46204, altro.fir || 'F' + ordine, altro.prodotto ?? '.class1', kg, prezzo, altro.totale ?? euro(kg * prezzo)];
  return r;
};
const fs = (tipologia, altro = {}) => ({
  id: 'fs-' + tipologia, gruppo: 'g-fs', nome: 'Fuel Surcharge', origine: 'CONSORZIO', tipologia, prestazione: 'RACCOLTA', a_chi: 'tutti',
  euro_t_passiva: 5, euro_t_attiva: 5, data_inizio_validita: '2026-07-01', data_fine_validita: '2026-12-31', stato: 'attivo', ...altro,
});
const FUEL = ['RETE', 'ACI', 'EXTRA_RACCOLTA'].map(c => fs(c));

console.log('1. UN MESE COSTRUITO: L\'ARROTONDAMENTO SI DICE E TORNA');
// Tre ordini da 103 kg: sul mese 0,309 t x 5 = 1,55; ordine per ordine 0,52 x 3 = 1,56
// (riga per ordine) oppure 21,32 - 20,81 = 0,51 x 3 = 1,53 (nel prezzo).
const tariffe = [{ id: 't-rete', direzione: 'ATTIVA', tipologia: 'RETE', cliente: 'ECOTYRE', valore: 202, unita_misura: '€/t', stato: 'attivo' }];
const movimento = (n) => ({ id: 'r' + n, id_ordine: 'ET2600000' + n, numero_fir: 'FET2600000' + n, stato: 'terminato', cer: '160103', classe: 'A', provincia: 'NA', trasportatore: 'ALFA SRL', destinazione: 'IRIGOM SRL', peso_effettivo: 103, trasporto_finito_il: `2026-07-1${n}T08:00:00.000Z` });
const piccolo = calcolaRigheAttiva({ reteAll: [1, 2, 3].map(movimento), aciAll: [], extraAll: [], fornitori: [], tariffe, anno: 2026, mese: 'Luglio', surplus: [fs('RETE')] });
const leggiCelle = (righe) => leggiTabellePrefattura([{ nome: 'Worksheet', celle: [TESTA, ...righe] }]).righe;
const ordini = [1, 2, 3].map(n => 'ET2600000' + n);
const cA = confrontaPrefattura(leggiCelle(ordini.map(o => rigaPre(o, 103, 0.207))), piccolo.righe, new Map(), piccolo.surplus_del_mese);
const rA = cA.canali.find(c => c.canale === 'RETE');
verifica('nel prezzo: nessun importo diverso, il surplus nel riquadro', rA.importo_diverso.length === 0 && rA.surplus?.prefattura.forme.join() === 'nel_prezzo' && rA.surplus?.prefattura.ordini_nel_prezzo === 3, JSON.stringify(rA.surplus));
verifica('nel prezzo: 1,53 contro 1,55, e\' l\'arrotondamento, detto, e non conta', rA.surplus?.esito === 'arrotondamento' && rA.surplus?.scarto === -0.02 && rA.surplus?.conta === false && /arrotondamento ordine per ordine/.test(rA.surplus?.testo || '') && cA.coincide === true, JSON.stringify(rA.surplus));
verifica('nel prezzo: l\'euro della prefattura e\' lo standard, come il gestionale', rA.prefattura.euro === rA.gestionale.euro && rA.gestionale.euro === 62.43, JSON.stringify({ p: rA.prefattura, g: rA.gestionale }));
const cB = confrontaPrefattura(leggiCelle(ordini.flatMap(o => [rigaPre(o, 103, 0.202), rigaPre(o, 103, 0.005, { tipo: 'Fuel Surcharge', prodotto: '' })])), piccolo.righe, new Map(), piccolo.surplus_del_mese);
const rB = cB.canali.find(c => c.canale === 'RETE');
verifica('una riga per ordine: i chili non si sommano all\'ordine', rB.peso_diverso.length === 0 && rB.importo_diverso.length === 0 && rB.prefattura.kg === 309, JSON.stringify(rB.prefattura));
verifica('una riga per ordine: 1,56 contro 1,55, arrotondamento, coincide', rB.surplus?.esito === 'arrotondamento' && rB.surplus?.scarto === 0.01 && rB.surplus?.prefattura.righe_per_ordine === 3 && cB.coincide === true, JSON.stringify(rB.surplus));
const cD = confrontaPrefattura(leggiCelle(ordini.map(o => rigaPre(o, 103, 0.202))), piccolo.righe, new Map(), piccolo.surplus_del_mese);
const rD = cD.canali.find(c => c.canale === 'RETE');
verifica('niente surplus nella prefattura: nessun «solo nel gestionale» con l\'ordine vuoto', rD.solo_gestionale.length === 0 && rD.gestionale.ordini === 3, JSON.stringify(rD.solo_gestionale));
verifica('niente surplus nella prefattura: il riquadro lo dice e conta una differenza', rD.surplus?.esito === 'assente' && rD.surplus?.conta === true && cD.differenze === 1 && /non lo porta/.test(rD.surplus?.testo || '') && /1,55 € nel gestionale \(0,309 t × 5,00 €\/t\)/.test(rD.surplus?.testo || ''), JSON.stringify(rD.surplus));
const cX = confrontaPrefattura(leggiCelle([...ordini.map(o => rigaPre(o, 103, 0.202)), [3716, 'SMOCO Srl', 46204, 'Ecotyre Scrl', 'Fuel Surcharge', null, null, null, '', 309, 0.005, 1.6]]), piccolo.righe, new Map(), piccolo.surplus_del_mese);
const rX = cX.canali.find(c => c.canale === 'RETE');
verifica('una riga sola con un importo sbagliato (1,60): non torna, si dice quanto', rX.surplus?.esito === 'non_torna' && rX.surplus?.scarto === 0.05 && rX.surplus?.conta === true && /0,05 € in più/.test(rX.surplus?.testo || ''), JSON.stringify(rX.surplus));
// senza surplus nel gestionale
const senzaGest = calcolaRigheAttiva({ reteAll: [1, 2, 3].map(movimento), aciAll: [], extraAll: [], fornitori: [], tariffe, anno: 2026, mese: 'Luglio' });
const cS = confrontaPrefattura(leggiCelle(ordini.flatMap(o => [rigaPre(o, 103, 0.202), rigaPre(o, 103, 0.005, { tipo: 'Fuel Surcharge', prodotto: '' })])), senzaGest.righe, new Map(), senzaGest.surplus_del_mese);
const rS = cS.canali.find(c => c.canale === 'RETE');
verifica('un surplus che il gestionale non ha: si dice e conta', rS.surplus?.esito === 'solo_prefattura' && rS.surplus?.conta === true && rS.peso_diverso.length === 0 && /scheda Surplus/.test(rS.surplus?.testo || ''), JSON.stringify(rS.surplus));
const senzaGestTon = calcolaRigheAttiva({ reteAll: [1, 2, 3].map(n => ({ ...movimento(n), peso_effettivo: 1000 + n * 10 })), aciAll: [], extraAll: [], fornitori: [], tariffe, anno: 2026, mese: 'Luglio' });
const cI = confrontaPrefattura(leggiCelle(ordini.map((o, i) => rigaPre(o, 1010 + i * 10, 0.207))), senzaGestTon.righe, new Map(), senzaGestTon.surplus_del_mese);
const rI = cI.canali.find(c => c.canale === 'RETE');
verifica('lo stesso €/t in piu\' su tutti gli ordini senza surplus nel gestionale: importi diversi, e l\'ipotesi detta', rI.importo_diverso.length === 3 && rI.surplus?.esito === 'ipotesi' && rI.surplus?.conta === false && cI.differenze === 3 && /5,00 €\/t in più/.test(rI.surplus?.testo || ''), JSON.stringify(rI.surplus));
verifica('senza surplus da nessuna parte: nessun riquadro, come prima', confrontaPrefattura(leggiCelle(ordini.map(o => rigaPre(o, 103, 0.202))), senzaGest.righe).canali.every(c => c.surplus === null));

console.log('1b. ORDINE PER ORDINE: QUELLO CHE L\'ARROTONDAMENTO NON COPRE');
const rete = (c) => c.canali.find(x => x.canale === 'RETE');
const fsRiga = (o) => rigaPre(o, 103, 0.005, { tipo: 'Fuel Surcharge', prodotto: '' });
const conta = (righe, g = piccolo) => confrontaPrefattura(leggiCelle(righe), g.righe, new Map(), g.surplus_del_mese);
// a. due ordini col surplus nel prezzo, il terzo al prezzo di sempre
const aManca = rete(conta([rigaPre(ordini[0], 103, 0.207), rigaPre(ordini[1], 103, 0.207), rigaPre(ordini[2], 103, 0.202)]));
verifica('a. un ordine senza il surplus nel prezzo: non torna, e si dice quale', aManca.surplus?.esito === 'non_torna' && aManca.surplus?.conta === true
  && JSON.stringify(aManca.surplus?.ordini?.senza.map(x => x.id_ordine)) === JSON.stringify([ordini[2]]) && /manca su un ordine \(ET26000003\)/.test(aManca.surplus?.testo || ''), JSON.stringify(aManca.surplus));
// b. la riga di surplus di un ordine manca, o c'e' due volte
const bManca = rete(conta([...ordini.map(o => rigaPre(o, 103, 0.202)), fsRiga(ordini[0]), fsRiga(ordini[1])]));
verifica('b. un ordine senza la sua riga di surplus: non torna (prima passava per arrotondamento)', bManca.surplus?.esito === 'non_torna' && bManca.surplus?.ordini?.senza.length === 1 && bManca.surplus?.ordini?.senza[0].id_ordine === ordini[2] && bManca.surplus?.ordini?.senza[0].atteso === 0.52, JSON.stringify(bManca.surplus));
const bDoppio = rete(conta([...ordini.map(o => rigaPre(o, 103, 0.202)), ...ordini.map(fsRiga), fsRiga(ordini[1])]));
verifica('b. un ordine con la riga di surplus due volte: diverso, con l\'importo', bDoppio.surplus?.esito === 'non_torna' && bDoppio.surplus?.ordini?.diversi.length === 1
  && /ET26000002: 1,04 € invece di 0,52 €/.test(bDoppio.surplus?.testo || ''), JSON.stringify(bDoppio.surplus));
const bCompensa = rete(conta([...ordini.map(o => rigaPre(o, 103, 0.202)), fsRiga(ordini[0]), fsRiga(ordini[0]), fsRiga(ordini[1])]));
verifica('b. un ordine in piu\' e uno in meno che si compensano: non torna lo stesso', bCompensa.surplus?.esito === 'non_torna' && bCompensa.surplus?.ordini?.senza.length === 1 && bCompensa.surplus?.ordini?.diversi.length === 1 && /si compensano/.test(bCompensa.surplus?.testo || ''), JSON.stringify(bCompensa.surplus));
// un surplus solo per ALFA: la riga di surplus sull'ordine di BETA e' in piu'
const soloAlfa = calcolaRigheAttiva({ reteAll: [1, 2, 3].map(n => ({ ...movimento(n), trasportatore: n === 3 ? 'BETA SRL' : 'ALFA SRL' })), aciAll: [], extraAll: [], fornitori: [], tariffe, anno: 2026, mese: 'Luglio', surplus: [fs('RETE', { a_chi: 'elenco', fornitori_json: JSON.stringify([{ id: '', nome: 'ALFA SRL' }]) })] });
const bInPiu = rete(conta([...ordini.map(o => rigaPre(o, 103, 0.202)), ...ordini.map(fsRiga)], soloAlfa));
verifica('b. una riga di surplus su un ordine che nel gestionale non l\'ha: in piu\'', bInPiu.surplus?.esito === 'non_torna' && JSON.stringify(bInPiu.surplus?.ordini?.in_piu.map(x => x.id_ordine)) === JSON.stringify([ordini[2]]) && /che nel gestionale non l'ha \(ET26000003\)/.test(bInPiu.surplus?.testo || ''), JSON.stringify(bInPiu.surplus));
// un ordine che manca del tutto nella prefattura e' gia' una differenza: il riquadro lo dice
const bGia = conta([rigaPre(ordini[0], 103, 0.202), rigaPre(ordini[1], 103, 0.202), fsRiga(ordini[0]), fsRiga(ordini[1])]);
verifica('b. l\'ordine che manca nella prefattura: il suo surplus si chiarisce con quella differenza, e lo si dice', rete(bGia).solo_gestionale.length === 1 && rete(bGia).surplus?.esito === 'non_torna'
  && JSON.stringify(rete(bGia).surplus?.ordini?.gia_fra_le_differenze) === JSON.stringify([ordini[2]]) && /l'ordine ET26000003, che è già fra le differenze qui sopra/.test(rete(bGia).surplus?.testo || ''), JSON.stringify(rete(bGia).surplus));
// c. una riga sola: un arrotondamento solo. 1,55 sul mese, 1,56 ordine per ordine
const sola1 = (importo) => [3716, 'SMOCO Srl', 46204, 'Ecotyre Scrl', 'Fuel Surcharge', null, null, null, '', 309, 0.005, importo];
const c156 = rete(conta([...ordini.map(o => rigaPre(o, 103, 0.202)), sola1(1.56)]));
verifica('c. una riga sola da 1,56 (la somma ordine per ordine): arrotondamento, e dice i due conti', c156.surplus?.esito === 'arrotondamento' && c156.surplus?.arrotondamento === 0.01
  && /ordine per ordine fa 1,56 €, sul mese 1,55 €/.test(c156.surplus?.testo || ''), JSON.stringify(c156.surplus));
const c158 = rete(conta([...ordini.map(o => rigaPre(o, 103, 0.202)), sola1(1.58)]));
verifica('c. una riga sola da 1,58: tre centesimi non sono un arrotondamento', c158.surplus?.esito === 'non_torna' && c158.surplus?.conta === true, JSON.stringify(c158.surplus));
// un importo che manca non e' zero
const senzaImporto = leggiTabellePrefattura([{ nome: 'W', celle: [['Tipo', 'Ordine', 'Numero FIR', 'Prodotto', 'Quantità (kg)'], ...ordini.flatMap(o => [['Trasp+Tratt', o, 'F' + o, '.class1', 103], ['Fuel Surcharge', o, 'F' + o, '', 103]])] }]);
const sI = rete(confrontaPrefattura(senzaImporto.righe, piccolo.righe, new Map(), piccolo.surplus_del_mese));
verifica('senza la colonna dell\'importo: il surplus c\'e\' ma senza importo, «—», e non e\' 0,00', sI.surplus?.esito === 'senza_importo' && sI.surplus?.prefattura.euro === null && sI.surplus?.scarto === null
  && sI.surplus?.conta === false && /senza importo \(—\)/.test(sI.surplus?.testo || '') && !/ 0,00 €/.test(sI.surplus?.testo || ''), JSON.stringify(sI.surplus));
const unoSenza = rete(conta([...ordini.map(o => rigaPre(o, 103, 0.202)), fsRiga(ordini[0]), fsRiga(ordini[1]), rigaPre(ordini[2], 103, 0.005, { tipo: 'Fuel Surcharge', prodotto: '', totale: '' })]));
verifica('una riga di surplus senza importo in un file che li ha: non torna, e si dice quale', unoSenza.surplus?.esito === 'non_torna' && unoSenza.surplus?.ordini?.senza_importo.length === 1 && /è senza importo su un ordine \(ET26000003\)/.test(unoSenza.surplus?.testo || ''), JSON.stringify(unoSenza.surplus));

console.log('2. CHE COSA E\' UNA RIGA DI SURPLUS, E CHE COSA NO');
const conProduttore = leggiTabellePrefattura([{ nome: 'W', celle: [[...TESTA, 'Produttore'], [...rigaPre('ET26000001', 1000, 0.202), 'DISTRIBUZIONE CARBURANTI SRL'], rigaPre('TER26000001', 27000, 0.008, { tipo: 'Trasp', prodotto: '' }), ['Totale Fuel Surcharge', null, null, null, null, null, null, null, null, null, null, 5], ['Fuel Surcharge incluso nei prezzi', null, null, null, null, null, null, null, null, null, null, null]] }]);
verifica('un produttore «Carburanti», una terziaria col Prodotto vuoto, la riga dei totali e una nota senza importo non sono surplus', conProduttore.righe.length === 2 && conProduttore.righe.every(r => !r.surplus), JSON.stringify(conProduttore.righe));
const lettaB = leggiCelle([rigaPre('ET26000001', 1000, 0.202), rigaPre('ET26000001', 1000, 0.005, { tipo: 'Fuel Surcharge', prodotto: '' }), rigaPre('ET26000002', 1000, 0.005, { tipo: 'Trasp+Tratt', prodotto: 'Fuel surcharge' })]);
verifica('la riga si riconosce dal Tipo o dal Prodotto, e lo dice', lettaB.filter(r => r.surplus).length === 2 && lettaB[1].testo === 'Fuel Surcharge' && lettaB[2].testo === 'Fuel surcharge');
const lettaC = leggiTabellePrefattura([{ nome: 'W', celle: [TESTA, rigaPre('ET26000001', 1000, 0.202), [3716, 'SMOCO Srl', 46204, 'Ecotyre Scrl', 'Fuel Surcharge', null, null, null, 'Rete', 1000, 5, 5]] }]);
verifica('una riga senza ordine e col surplus si legge, senza ordine', lettaC.righe.length === 2 && lettaC.righe[1].surplus === true && lettaC.righe[1].id_ordine === '' && lettaC.righe[1].importo === 5 && lettaC.note.some(n => /surplus/.test(n)), JSON.stringify(lettaC));
// il PDF: una riga di surplus, e un produttore «Carburanti» che resta un formulario
const pdf = leggiLineePdfPrefattura([
  ['Riepilogo servizi prestati nel mese: 07/2026'],
  ['Totale', '2', '3 000 Kg', '606,00 Euro'],
  ['ET26000001', 'Eco', 'DISTRIBUZIONE CARBURANTI SRL', '.class1', '10-07-2026', 'FIR1', 'Trasp+Tratt', '1 000', '0,2020', '202,00'],
  ['ET26000002', 'Eco', 'OFFICINA ALFA', '.class1', '11-07-2026', 'FIR2', 'Trasp+Tratt', '2 000', '0,2020', '404,00'],
  ['Fuel Surcharge', '3 000', '0,0050', '15,00'],
]);
verifica('PDF: il produttore «Carburanti» resta un formulario, la riga del surplus si legge a parte, la lettura e\' completa', pdf.righe.length === 3 && pdf.righe.filter(r => r.surplus).length === 1 && pdf.righe[2].importo === 15 && pdf.righe[2].id_ordine === '' && pdf.completa === true && pdf.note.some(n => /15,00 euro/.test(n)), JSON.stringify(pdf));
// la riga «Totale Fuel Surcharge» del PDF e' la somma, non una riga in piu': come nell'Excel
const pdfTotale = leggiLineePdfPrefattura([
  ['Riepilogo servizi prestati nel mese: 07/2026'],
  ['Totale', '2', '3 000 Kg', '606,00 Euro'],
  ['ET26000001', 'Eco', 'OFFICINA BETA', '.class1', '10-07-2026', 'FIR1', 'Trasp+Tratt', '1 000', '0,2020', '202,00'],
  ['ET26000001', 'Fuel Surcharge', '1 000', '0,0050', '5,00'],
  ['ET26000002', 'Eco', 'OFFICINA ALFA', '.class1', '11-07-2026', 'FIR2', 'Trasp+Tratt', '2 000', '0,2020', '404,00'],
  ['ET26000002', 'Fuel Surcharge', '2 000', '0,0050', '10,00'],
  ['Totale Fuel Surcharge', '15,00'],
]);
const xlTotale = leggiTabellePrefattura([{ nome: 'W', celle: [TESTA, rigaPre('ET26000001', 1000, 0.202), rigaPre('ET26000001', 1000, 0.005, { tipo: 'Fuel Surcharge', prodotto: '' }), rigaPre('ET26000002', 2000, 0.202), rigaPre('ET26000002', 2000, 0.005, { tipo: 'Fuel Surcharge', prodotto: '' }), ['Totale Fuel Surcharge', null, null, null, null, null, null, null, null, null, null, 15]] }]);
const euroSurplus = (righe) => righe.filter(r => r.surplus).reduce((x, r) => x + r.importo, 0);
verifica('PDF: la riga «Totale Fuel Surcharge» non e\' un surplus in piu\', e il PDF dice quello che dice l\'Excel (2 righe, 15,00)', pdfTotale.righe.filter(r => r.surplus).length === 2 && euroSurplus(pdfTotale.righe) === 15 && euroSurplus(xlTotale.righe) === 15, JSON.stringify(pdfTotale.righe.filter(r => r.surplus)));

console.log('3. LA PREFATTURA VERA DI LUGLIO 2026, NELLE QUATTRO FORME');
const FILE = 'C:/Users/HOME/Desktop/ECOTYRE/PREFATTURE/luglio 2026.xlsx';
const CARTELLA = process.env.DATI_VERI || fileURLToPath(new URL('../../dati-veri/', import.meta.url));
const copie = existsSync(CARTELLA) ? readdirSync(CARTELLA).filter(n => /^treadrider-dati-veri-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n)).sort() : [];
if (!existsSync(FILE) || !copie.length) console.log('  prefattura di luglio o copia dei dati veri assente: parte saltata');
else {
  const XLSX = (await import('xlsx')).default;
  const wb = XLSX.read(readFileSync(FILE), { type: 'buffer' });
  const foglio = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null });
  const [testa, ...corpo] = foglio;
  const A = JSON.parse(gunzipSync(readFileSync(join(CARTELLA, copie[copie.length - 1]))).toString('utf8')).archivi;
  const calcola = (surplus) => calcolaRigheAttiva({ reteAll: A.PrimariaRete, aciAll: A.PrimariaAci, extraAll: A.ExtraRaccolta, fornitori: A.Fornitore, tariffe: A.Tariffa.filter(t => t.direzione === 'ATTIVA'), anno: 2026, mese: 'Luglio', surplus });
  const g0 = calcola(), g1 = calcola(FUEL);
  const confronta = (righe, g = g1) => confrontaPrefattura(leggiTabellePrefattura([{ nome: 'Worksheet', celle: [testa, ...righe] }]).righe, g.righe, new Map(), g.surplus_del_mese);
  const canale = (c, nome) => c.canali.find(x => x.canale === nome);
  const oggi = confronta(corpo, g0);
  verifica('oggi, senza surplus: 416 righe, coincide al centesimo', corpo.length === 416 && oggi.coincide === true && oggi.differenze === 0 && oggi.canali.every(x => x.surplus === null), JSON.stringify({ n: corpo.length, d: oggi.differenze }));
  const gR = (((g1.surplus_del_mese || {}).RETE || [])[0] || {}).totale, gA = (((g1.surplus_del_mese || {}).ACI || [])[0] || {}).totale;
  verifica('il gestionale col Fuel Surcharge di luglio: rete 5.611,20 (1.122,24 t), ACI 96,60 (19,32 t)', gR === 5611.2 && gA === 96.6, JSON.stringify({ gR, gA }));
  // a. nel prezzo: 0,207 sulla rete, 0,245 o 0,235 sull'ACI
  const nelPrezzo = corpo.map(r => { const p = Number(r[10]) + 0.005; const x = [...r]; x[10] = Math.round(p * 1e6) / 1e6; x[11] = euro(Number(r[9]) * x[10]); return x; });
  const a = confronta(nelPrezzo);
  verifica('a. nel prezzo: nessun importo diverso, coincide', a.coincide === true && a.differenze === 0 && a.canali.every(x => x.importo_diverso.length === 0 && x.peso_diverso.length === 0), JSON.stringify({ d: a.differenze, i: a.canali.map(x => x.importo_diverso.length) }));
  verifica('a. il riquadro: rete nel prezzo di 410 ordini, ACI di 6, e torna', canale(a, 'RETE').surplus?.prefattura.ordini_nel_prezzo === 410 && ['torna', 'arrotondamento'].includes(canale(a, 'RETE').surplus?.esito)
    && canale(a, 'ACI').surplus?.prefattura.ordini_nel_prezzo === 6 && ['torna', 'arrotondamento'].includes(canale(a, 'ACI').surplus?.esito), JSON.stringify([canale(a, 'RETE').surplus, canale(a, 'ACI').surplus]));
  verifica('a. l\'euro della prefattura resta lo standard, uguale al gestionale', canale(a, 'RETE').prefattura.euro === canale(a, 'RETE').gestionale.euro && canale(a, 'RETE').gestionale.euro === 226692.49, JSON.stringify([canale(a, 'RETE').prefattura, canale(a, 'RETE').gestionale]));
  verifica('a. l\'extra raccolta non passa dalla prefattura: il suo surplus non conta', canale(a, 'EXTRA_RACCOLTA').surplus?.esito === 'fuori_prefattura' && canale(a, 'EXTRA_RACCOLTA').surplus?.conta === false);
  // b. una riga per ordine
  const perOrdine = corpo.flatMap(r => [r, (() => { const x = [...r]; x[4] = 'Fuel Surcharge'; x[8] = ''; x[10] = 0.005; x[11] = euro(Number(r[9]) * 0.005); return x; })()]);
  const b = confronta(perOrdine);
  verifica('b. una riga per ordine: nessun peso diverso, coincide', b.coincide === true && b.canali.every(x => x.peso_diverso.length === 0 && x.importo_diverso.length === 0) && canale(b, 'RETE').prefattura.kg === 1122240, JSON.stringify({ d: b.differenze, p: b.canali.map(x => x.peso_diverso.length) }));
  verifica('b. il riquadro: 410 righe sulla rete, 6 sull\'ACI, e torna', canale(b, 'RETE').surplus?.prefattura.righe_per_ordine === 410 && ['torna', 'arrotondamento'].includes(canale(b, 'RETE').surplus?.esito) && canale(b, 'ACI').surplus?.prefattura.righe_per_ordine === 6, JSON.stringify(canale(b, 'RETE').surplus));
  verifica('b. l\'arrotondamento vero ordine per ordine e\' di un centesimo (5.611,21 contro 5.611,20), e ogni ordine torna', canale(b, 'RETE').surplus?.scarto === 0.01 && canale(b, 'RETE').surplus?.arrotondamento === 0.01
    && canale(b, 'RETE').surplus?.ordini?.senza.length === 0 && canale(b, 'RETE').surplus?.ordini?.diversi.length === 0 && /ogni ordine torna col suo surplus entro il centesimo/.test(canale(b, 'RETE').surplus?.testo || ''), JSON.stringify(canale(b, 'RETE').surplus));
  // le differenze vere che prima passavano per arrotondamento (revisione del 13/10/2026)
  const rigaFS = (r) => { const x = [...r]; x[4] = 'Fuel Surcharge'; x[8] = ''; x[10] = 0.005; x[11] = euro(Number(r[9]) * 0.005); return x; };
  const ordiniRete = new Set(g1.righe.RETE.filter(r => r.ordine).map(r => r.ordine));
  const daTogliere = corpo.filter(r => ordiniRete.has(String(r[5]))).sort((x, y) => Math.abs(Number(x[9]) - 400) - Math.abs(Number(y[9]) - 400))[0];
  const bManca = confronta(corpo.flatMap(r => (r === daTogliere ? [r] : [r, rigaFS(r)])));
  verifica(`b. un ordine senza la sua riga di surplus (${daTogliere[5]}, ${daTogliere[9]} kg, -1,99 €): non torna, conta, e dice l'ordine`, canale(bManca, 'RETE').surplus?.esito === 'non_torna' && bManca.coincide === false
    && JSON.stringify(canale(bManca, 'RETE').surplus?.ordini?.senza.map(x => x.id_ordine)) === JSON.stringify([String(daTogliere[5])]), JSON.stringify(canale(bManca, 'RETE').surplus));
  const bDoppio = confronta(corpo.flatMap(r => (r === daTogliere ? [r, rigaFS(r), rigaFS(r)] : [r, rigaFS(r)])));
  verifica('b. lo stesso ordine con la riga di surplus due volte (+2,01 €): non torna, e dice l\'ordine', canale(bDoppio, 'RETE').surplus?.esito === 'non_torna' && bDoppio.coincide === false
    && canale(bDoppio, 'RETE').surplus?.ordini?.diversi[0]?.id_ordine === String(daTogliere[5]), JSON.stringify(canale(bDoppio, 'RETE').surplus));
  // c. una riga sola per canale, e una sola per tutti
  const sola = (importo, prodotto = '') => [3716, 'SMOCO Srl', 46204, 'Ecotyre Scrl', 'Fuel Surcharge', null, null, null, prodotto, null, null, importo];
  const c = confronta([...corpo, sola(5611.2), sola(96.6)]);
  verifica('c. una riga sola per canale: riconosciute dall\'importo, coincide', c.coincide === true && canale(c, 'RETE').surplus?.esito === 'torna' && canale(c, 'ACI').surplus?.esito === 'torna' && canale(c, 'RETE').surplus?.prefattura.righe_sole === 1, JSON.stringify([canale(c, 'RETE').surplus, canale(c, 'ACI').surplus]));
  const cPerOrdine = confronta([...corpo, sola(5611.21), sola(96.6)]);
  verifica('c. una riga sola con la somma arrotondata ordine per ordine (5.611,21): arrotondamento, coincide', cPerOrdine.coincide === true && canale(cPerOrdine, 'RETE').surplus?.esito === 'arrotondamento', JSON.stringify(canale(cPerOrdine, 'RETE').surplus));
  const cDue = confronta([...corpo, sola(5609.2, 'Rete'), sola(96.6, 'ACI')]);
  verifica('c. una riga sola della rete con 2,00 € in meno: non torna (prima passava per arrotondamento)', canale(cDue, 'RETE').surplus?.esito === 'non_torna' && canale(cDue, 'RETE').surplus?.conta === true && cDue.coincide === false && /2,00 € in meno del gestionale/.test(canale(cDue, 'RETE').surplus?.testo || ''), JSON.stringify(canale(cDue, 'RETE').surplus));
  const cAci = confronta([...corpo, sola(5611.2, 'Rete'), sola(90, 'ACI')]);
  verifica('c. una riga che dice «ACI» va all\'ACI anche se l\'importo non torna, e lo dice', canale(cAci, 'ACI').surplus?.esito === 'non_torna' && canale(cAci, 'RETE').surplus?.esito === 'torna' && cAci.differenze === 1, JSON.stringify(canale(cAci, 'ACI').surplus));
  const insieme = confronta([...corpo, sola(5707.8)]);
  verifica('c. una riga sola per rete e ACI insieme: si dice, e torna per ciascuno', insieme.coincide === true && canale(insieme, 'RETE').surplus?.prefattura.forme.includes('insieme') && /insieme a ACI/.test(canale(insieme, 'RETE').surplus?.testo || ''), JSON.stringify(canale(insieme, 'RETE').surplus));
  const boh = confronta([...corpo, sola(1000)]);
  verifica('c. una riga sola che non si sa di chi sia: si chiede, e conta', (boh.surplus_da_attribuire || []).length === 1 && /non si capisce di quale canale/.test(boh.surplus_da_attribuire[0].spiegazione) && boh.differenze === 3, JSON.stringify({ d: boh.differenze, x: boh.surplus_da_attribuire }));
  // d. niente
  const d = confronta(corpo);
  verifica('d. la prefattura non lo porta: niente «solo nel gestionale» con l\'ordine vuoto, il riquadro lo dice per rete e ACI', d.canali.every(x => !x.solo_gestionale.some(s => !s.id_ordine)) && canale(d, 'RETE').surplus?.esito === 'assente' && canale(d, 'ACI').surplus?.esito === 'assente' && d.differenze === 2
    && /5\.611,20 € nel gestionale \(1\.122,24 t × 5,00 €\/t\)/.test(canale(d, 'RETE').surplus?.testo || ''), JSON.stringify(canale(d, 'RETE').surplus));
  verifica('d. gli ordini restano quelli di oggi', canale(d, 'RETE').gestionale.ordini === 410 && canale(d, 'RETE').gestionale.euro === canale(oggi, 'RETE').gestionale.euro && canale(d, 'RETE').prefattura.euro === canale(oggi, 'RETE').prefattura.euro);
}

console.log('4. LA FUNZIONE');
const src = leggi('../base44/functions/prefatturaEcotyre/entry.ts');
verifica('prefatturaEcotyre passa al confronto il surplus del mese', /confrontaPrefattura\([^)]*surplus_del_mese\)/.test(src) && /surplus_del_mese \} = calcolaRigheAttiva\(\{[^}]*\bsurplus\b/.test(src));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
