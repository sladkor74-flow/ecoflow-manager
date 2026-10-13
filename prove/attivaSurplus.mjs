// IL SURPLUS SULLE TARIFFE NELLA FATTURAZIONE ATTIVA (13/10/2026).
//
// Richiesta dell'utente del 12/10/2026: in attiva come in passiva «una riga con
// l'importo standard ed una per il surplus (sempre riferito alle stesse
// tonnellate raccolte o trattate nel mese)». Il primo caso e' il Fuel Surcharge
// del consorzio Ecotyre, +5 €/t dal 01/10/2026 al 31/12/2026, che SMOCO fattura a
// Ecotyre su rete, ACI ed extra raccolta, ognuno con la sua riga e mai sommati.
//
// Qui si prova la riga del surplus dell'attiva (base44/shared/attivaCalcolo.ts) e
// le due funzioni che la usano (getRiepilogoEcotyre, elaboraFatturazioneAttiva):
//   1. una riga per canale e per surplus, in fondo, con quantita 0, le tonnellate
//      in kg_riferimento, gli ordini in record_count e l'importo arrotondato UNA
//      volta sul mese (103 kg x 3 a 5 €/t: 1,55 sul mese, 1,56 riga per riga);
//   2. il periodo e' il giorno italiano della fine del trasporto: le 00:30 del
//      1° ottobre (22:30Z del 30/09) sono di ottobre, le 23:00 del 30/09 no;
//   3. le righe dei formulari non cambiano, e i chili non si contano due volte;
//   4. un canale non prende il surplus di un altro; solo passivo, disattivato e
//      fuori periodo non fanno righe; un elenco vale per i suoi fornitori (anche
//      attraverso chi fattura per loro), e un elenco che non prende niente si dice:
//      «nessun formulario» se i fornitori nel mese non hanno lavorato, i giorni
//      dei formulari se hanno lavorato fuori dal periodo del surplus (revisione
//      del 13/10/2026: prima diceva «nessun formulario» anche li');
//   5. la riconciliazione: un ordine arrivato dopo cambia la riga del surplus e lo
//      dice; un surplus scritto dopo l'elaborazione e' «nuovo»; uno tolto «sparito»;
//   6. le funzioni: il totale del canale comprende il surplus, ordini, regioni,
//      ripartizione e prezzi no; il documento salva la riga; un mese chiuso lo dice
//      come differenza da fatturare a parte; il riepilogo, che legge chiunque sia
//      collegato, non dice quanto si paga ai fornitori (revisione del 13/10/2026:
//      passava euro_t_passiva), e il calcolo dell'attiva non lo porta nemmeno;
//   7. sui dati veri dell'11/10/2026, settembre simulato col Fuel Surcharge: rete
//      5.601,20 € (non 5.601,21), ACI 94,45 €; senza surplus identico a oggi;
//   8. l'archivio VoceFatturazione accetta la riga.
//
// node prove/attivaSurplus.mjs
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import * as attiva from '../base44/shared/attivaCalcolo.ts';
import { caricaFunzione, chiama } from './dati/bancoFunzioni.mjs';

const { calcolaRigheAttiva, riconciliaAttiva } = attiva;
const eRigaSurplus = attiva.eRigaSurplus || (() => false);
const eRigaDiMovimento = attiva.eRigaDiMovimento || (() => true);

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const leggi = (p) => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r/g, '');
const uguali = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const somma = (righe, campo) => righe.reduce((s, r) => s + (Number(r[campo]) || 0), 0);

const tariffe = [
  { id: 't-rete', direzione: 'ATTIVA', tipologia: 'RETE', cliente: 'ECOTYRE', valore: 202, unita_misura: '€/t', stato: 'attivo', data_inizio_validita: '2026-01-01' },
  { id: 't-aci', direzione: 'ATTIVA', tipologia: 'ACI', cliente: 'ECOTYRE', regione: 'Campania', valore: 240, unita_misura: '€/t', stato: 'attivo', data_inizio_validita: '2026-01-01' },
  { id: 't-extra', direzione: 'ATTIVA', tipologia: 'EXTRA_RACCOLTA', cliente: 'ECOTYRE', valore: 202, unita_misura: '€/t', stato: 'attivo', data_inizio_validita: '2026-01-01' },
];
// BETA fattura tramite ALFA (subraccoglitore): il surplus di un elenco con ALFA
// vale anche sulle sue righe, come la tariffa nella passiva.
const fornitori = [
  { id: 'f-alfa', ragione_sociale: 'ALFA SRL', stato: 'attivo' },
  { id: 'f-beta', ragione_sociale: 'BETA SUB SRL', fattura_tramite_nome: 'ALFA SRL', stato: 'attivo' },
  { id: 'f-smoco', ragione_sociale: 'SMOCO S.R.L.', stato: 'attivo' },
  { id: 'f-irigom', ragione_sociale: 'IRIGOM SRL', stato: 'attivo' },
];
const base = { stato: 'terminato', cer: '160103', classe: 'A', provincia: 'NA', destinazione: 'IRIGOM SRL' };
const mov = (id, trasportatore, kg, quando, altro = {}) => ({ ...base, id, id_ordine: 'ET' + id, numero_fir: 'F' + id, trasportatore, peso_effettivo: kg, trasporto_finito_il: quando, ...altro });
const reteAll = [
  mov('1', 'ALFA SRL', 103, '2026-10-05T08:00:00.000Z'),
  mov('2', 'BETA SUB SRL', 103, '2026-10-06T08:00:00.000Z'),
  mov('3', 'SMOCO S.R.L.', 103, '2026-10-07T08:00:00.000Z', { destinazione: 'TECNOGUM SRL' }),
  // le 00:30 italiane del 1° ottobre: e' ottobre, e prende il surplus
  mov('4', 'ALFA SRL', 2000, '2026-09-30T22:30:00.000Z'),
  // le 23:00 italiane del 30 settembre: e' settembre, e non lo prende
  mov('5', 'ALFA SRL', 1500, '2026-09-30T21:00:00.000Z'),
  mov('6', 'ALFA SRL', 0, '2026-10-08T08:00:00.000Z'),
];
const aciAll = [mov('A1', 'ALFA SRL', 1000, '2026-10-10T08:00:00.000Z', { regione: 'Campania', id_ordine: 'EA1' })];
const extraAll = [
  mov('X1', 'ALFA SRL', 460, '2026-10-12T08:00:00.000Z', { id_ordine: 'EX1', prezzo_attivo_t: 350, sovracosto_raccolta: 120 }),
  // la secondaria non si fattura, e il surplus nemmeno
  mov('X2', 'ALFA SRL', 400, '2026-10-13T08:00:00.000Z', { id_ordine: 'EX2', prezzo_attivo_t: 202, tipo_movimento: 'secondaria', stoccaggio: 'NAPPI SUD' }),
];
const fs = (tipologia, altro = {}) => ({
  id: 'fs-' + tipologia, gruppo: 'g-fs', nome: 'Fuel Surcharge', origine: 'CONSORZIO', riferimento: 'comunicazione Ecotyre',
  tipologia, prestazione: 'RACCOLTA', a_chi: 'tutti', euro_t_passiva: 5, euro_t_attiva: 5,
  data_inizio_validita: '2026-10-01', data_fine_validita: '2026-12-31', stato: 'attivo', ...altro,
});
const FUEL = [fs('RETE'), fs('ACI'), fs('EXTRA_RACCOLTA')];
const calcola = (mese, surplus, altro = {}) => calcolaRigheAttiva({ reteAll, aciAll, extraAll, fornitori, tariffe, anno: 2026, mese, surplus, ...altro });

console.log('1. UNA RIGA PER CANALE, IN FONDO, SULLE STESSE TONNELLATE');
const senza = calcola('Ottobre');
const con = calcola('Ottobre', FUEL);
const sR = con.righe.RETE.filter(eRigaSurplus);
verifica('rete: una riga sola di surplus, l\'ultima', sR.length === 1 && con.righe.RETE[con.righe.RETE.length - 1] === sR[0], JSON.stringify(con.righe.RETE.map(r => r.descrizione || r.ordine)));
const s = sR[0] || {};
verifica('la riga: Fuel Surcharge, origine SURPLUS, il suo id, 5 €/t',
  s.descrizione === 'Fuel Surcharge' && s.origine_dato === 'SURPLUS' && s.surplus_id === 'fs-RETE' && s.origine_record_id === 'fs-RETE'
  && s.tariffa_valore === 5 && s.unita_misura === '€/t' && s.unita_prezzo === '€/t' && s.fattore_conversione === 1000 && s.stato_validazione === 'verificato', JSON.stringify(s));
verifica('zero chili, le tonnellate in kg_riferimento (2.309 kg), quattro ordini',
  s.quantita === 0 && s.kg_riferimento === 2309 && s.record_count === 4, JSON.stringify({ q: s.quantita, kg: s.kg_riferimento, n: s.record_count }));
verifica('arrotondata una volta sul mese: 2,309 t x 5 = 11,55 (riga per riga sarebbe 11,56)', s.totale === 11.55, String(s.totale));
verifica('niente ordine, formulario, data, classe, regione, dicitura; fatturante SMOCO',
  s.ordine === '' && s.numero_fir === '' && s.data_fine_trasporto === null && s.classe === '' && s.regione === '' && s.servizio_ecotyre === '' && s.fatturante === 'SMOCO Srl' && s.tipo === 'ATTIVA' && s.tipologia === 'RETE' && s.anno === 2026 && s.mese === 'Ottobre', JSON.stringify(s));
verifica('la nota dice il surplus, il periodo e le tonnellate all\'italiana',
  s.note === 'Fuel Surcharge (consorzio Ecotyre), dal 01/10/2026 al 31/12/2026, sulle stesse 2,309 t del mese', s.note);
verifica('le righe dei formulari non cambiano', uguali(con.righe.RETE.filter(eRigaDiMovimento), senza.righe.RETE) && uguali(con.righe.ACI.filter(r => !eRigaSurplus(r)), senza.righe.ACI) && uguali(con.righe.EXTRA_RACCOLTA.filter(r => !eRigaSurplus(r)), senza.righe.EXTRA_RACCOLTA));
verifica('i chili del canale non si contano due volte', somma(con.righe.RETE, 'quantita') === 2309 && somma(senza.righe.RETE, 'quantita') === 2309);
verifica('le anomalie non cambiano', uguali(con.anomalie, senza.anomalie), JSON.stringify(con.anomalie.filter(a => !senza.anomalie.some(b => b.descrizione === a.descrizione))));
const sA = con.righe.ACI.filter(eRigaSurplus), sX = con.righe.EXTRA_RACCOLTA.filter(eRigaSurplus);
verifica('ACI: la sua riga, sui suoi chili (1 t, 5,00)', sA.length === 1 && sA[0].totale === 5 && sA[0].kg_riferimento === 1000 && sA[0].surplus_id === 'fs-ACI');
verifica('extra raccolta: solo la raccolta primaria (0,46 t, 2,30), dopo il sovracosto; la secondaria no',
  sX.length === 1 && sX[0].totale === 2.3 && sX[0].kg_riferimento === 460 && sX[0].record_count === 1
  && con.righe.EXTRA_RACCOLTA[con.righe.EXTRA_RACCOLTA.length - 1] === sX[0] && con.righe.EXTRA_RACCOLTA.some(r => r.descrizione === 'Sovracosto raccolta'), JSON.stringify(con.righe.EXTRA_RACCOLTA.map(r => [r.descrizione, r.totale])));
const dm = con.surplus_del_mese || {};
verifica('surplus_del_mese per canale, coi suoi ordini', (dm.RETE || []).length === 1 && dm.RETE[0].totale === 11.55 && dm.RETE[0].kg === 2309 && dm.RETE[0].ordini === 4
  && uguali([...dm.RETE[0].ordini_ids].sort(), ['ET1', 'ET2', 'ET3', 'ET4']) && dm.RETE[0].origine === 'consorzio Ecotyre' && dm.RETE[0].dal === '2026-10-01' && dm.RETE[0].al === '2026-12-31'
  && dm.ACI.length === 1 && dm.EXTRA_RACCOLTA.length === 1, JSON.stringify(dm.RETE));
verifica('senza surplus: nessuna riga e surplus_del_mese vuoto', !senza.righe.RETE.some(eRigaSurplus) && uguali(senza.surplus_del_mese, { RETE: [], ACI: [], EXTRA_RACCOLTA: [] }), JSON.stringify(senza.surplus_del_mese));
verifica('si accetta anche col nome della passiva (surplusAll)', uguali(calcola('Ottobre', null, { surplusAll: FUEL }).righe.RETE, con.righe.RETE));
verifica('eRigaSurplus ed eRigaDiMovimento: quattro ordini e una riga di surplus', con.righe.RETE.filter(eRigaDiMovimento).length === 4 && con.righe.RETE.filter(eRigaSurplus).length === 1
  && con.righe.EXTRA_RACCOLTA.filter(eRigaDiMovimento).length === 1);

console.log('2. IL PERIODO E\' IL GIORNO ITALIANO DELLA FINE DEL TRASPORTO');
const set = calcola('Settembre', FUEL);
verifica('settembre: la riga delle 23:00 del 30/09 c\'e\', il surplus (dal 01/10) no', set.righe.RETE.length === 1 && set.righe.RETE[0].ordine === 'ET5' && !set.righe.RETE.some(eRigaSurplus), JSON.stringify(set.righe.RETE.map(r => r.ordine)));
verifica('ottobre: le 00:30 del 1° ottobre prendono il surplus', (((dm.RETE || [])[0] || {}).ordini_ids || []).includes('ET4'));
const finoAl15 = calcola('Ottobre', [fs('RETE', { data_fine_validita: '2026-10-05' })]);
verifica('un surplus che finisce il 05/10 vale sugli ordini fino al 05/10 compreso (ET4, ET1)', finoAl15.righe.RETE.filter(eRigaSurplus)[0]?.kg_riferimento === 2103, JSON.stringify((finoAl15.surplus_del_mese || {}).RETE));
// d'inverno l'Italia e' UTC+1: le 22:30Z del 31/12 sono le 23:30 italiane del 31/12
// (dicembre, col surplus), le 23:30Z sono le 00:30 del 1° gennaio (niente)
const fineAnno = [mov('D1', 'ALFA SRL', 1000, '2026-12-31T22:30:00.000Z'), mov('D2', 'ALFA SRL', 1000, '2026-12-31T23:30:00.000Z')];
const dicembre = calcolaRigheAttiva({ reteAll: fineAnno, aciAll: [], extraAll: [], fornitori, tariffe, anno: 2026, mese: 'Dicembre', surplus: FUEL });
const gennaio = calcolaRigheAttiva({ reteAll: fineAnno, aciAll: [], extraAll: [], fornitori, tariffe, anno: 2027, mese: 'Gennaio', surplus: FUEL });
verifica('le 23:30 italiane del 31/12 sono di dicembre e prendono il surplus', dicembre.righe.RETE.filter(eRigaSurplus)[0]?.kg_riferimento === 1000 && dicembre.righe.RETE.filter(eRigaDiMovimento).length === 1, JSON.stringify(dicembre.righe.RETE.map(r => r.ordine || r.descrizione)));
verifica('le 00:30 italiane del 1° gennaio no: il surplus del 2026 e\' finito', gennaio.righe.RETE.length === 1 && !gennaio.righe.RETE.some(eRigaSurplus), JSON.stringify(gennaio.righe.RETE.map(r => r.ordine || r.descrizione)));

console.log('3. CHI LO PRENDE E CHI NO');
const soloAci = calcola('Ottobre', [fs('ACI')]);
verifica('un surplus ACI non tocca la rete', !soloAci.righe.RETE.some(eRigaSurplus) && soloAci.righe.ACI.some(eRigaSurplus));
verifica('solo passivo (niente importo da Ecotyre): nessuna riga in attiva', !calcola('Ottobre', [fs('RETE', { euro_t_attiva: null })]).righe.RETE.some(eRigaSurplus));
verifica('disattivato: nessuna riga', !calcola('Ottobre', [fs('RETE', { stato: 'non_attivo' })]).righe.RETE.some(eRigaSurplus));
verifica('il trasporto delle secondarie non ha parte attiva', !calcola('Ottobre', [fs('RETE', { prestazione: 'TRASPORTO_SECONDARIA' })]).righe.RETE.some(eRigaSurplus));
const accordo = { ...fs('RETE'), id: 'acc-alfa', gruppo: 'g-acc', nome: 'Accordo Alfa', origine: 'ACCORDO_COMMERCIALE', a_chi: 'elenco', fornitori_json: JSON.stringify([{ id: '', nome: 'ALFA S.R.L.' }]), euro_t_attiva: 2, euro_t_passiva: 2 };
const dueSurplus = calcola('Ottobre', [fs('RETE'), accordo]);
const righeDue = dueSurplus.righe.RETE.filter(eRigaSurplus);
verifica('due surplus, due righe, per nome: l\'accordo e poi il Fuel Surcharge', righeDue.length === 2 && righeDue[0].descrizione === 'Accordo Alfa' && righeDue[1].descrizione === 'Fuel Surcharge', JSON.stringify(righeDue.map(r => r.descrizione)));
verifica('l\'elenco con ALFA vale su ALFA e su BETA, che fattura tramite ALFA (2,206 t x 2 = 4,41), non su SMOCO',
  righeDue[0]?.kg_riferimento === 2206 && righeDue[0]?.totale === 4.41 && righeDue[0]?.record_count === 3, JSON.stringify(righeDue[0]));
const perId = calcola('Ottobre', [{ ...accordo, fornitori_json: JSON.stringify([{ id: 'f-alfa', nome: '' }]) }]).righe.RETE.filter(eRigaSurplus);
verifica('...anche se l\'elenco ha solo l\'id di ALFA', perId.length === 1 && perId[0].kg_riferimento === 2206, JSON.stringify(perId));
const impianto = { ...accordo, id: 'acc-irigom', nome: 'Accordo Irigom', prestazione: 'TRATTAMENTO', fornitori_json: JSON.stringify([{ id: '', nome: 'Irigom s.r.l.' }]), euro_t_attiva: 3 };
const sullImpianto = calcola('Ottobre', [impianto]).righe.RETE.filter(eRigaSurplus);
verifica('trattamento con l\'elenco: le righe con destinazione Irigom (non quella verso Tecnogum)', sullImpianto.length === 1 && sullImpianto[0].kg_riferimento === 2206, JSON.stringify(sullImpianto));
const nessuno = calcola('Ottobre', [{ ...accordo, fornitori_json: JSON.stringify([{ id: '', nome: 'GAMMA SRL' }]) }]);
const info = nessuno.anomalie.find(a => a.tipo === 'informazione' && a.tipologia === 'RETE' && /GAMMA SRL/.test(a.descrizione));
verifica('un elenco che non prende niente non tace: un\'informazione, nessuna riga', !nessuno.righe.RETE.some(eRigaSurplus) && !!info && /ottobre/.test(info.descrizione) && /2,00 €\/t/.test(info.descrizione), JSON.stringify(info || nessuno.anomalie));
verifica('...se il fornitore nel mese non ha formulari: «nessun formulario», e si controllano i nomi', !!info && /nessun formulario del canale è di questo fornitore/.test(info.descrizione) && /controlla i nomi dell'elenco/.test(info.descrizione), info && info.descrizione);
// ALFA (e BETA, che fattura tramite lei) hanno lavorato il 01/10, il 05/10 e il
// 06/10; l'accordo comincia il 20/10: i nomi sono giusti, e' il periodo
const tardi = calcola('Ottobre', [{ ...accordo, data_inizio_validita: '2026-10-20' }]);
const infoTardi = tardi.anomalie.find(a => a.tipo === 'informazione' && /Accordo Alfa/.test(a.descrizione));
verifica('un surplus che comincia a meta\' mese, dopo i formulari del fornitore: dice i giorni, non «nessun formulario»', !tardi.righe.RETE.some(eRigaSurplus) && !!infoTardi
  && /i 3 formulari del canale di questo fornitore finiscono il trasporto il 01\/10\/2026, il 05\/10\/2026 e il 06\/10\/2026, fuori dal periodo del surplus/.test(infoTardi.descrizione)
  && !/nessun formulario/.test(infoTardi.descrizione) && !/controlla i nomi/.test(infoTardi.descrizione), infoTardi && infoTardi.descrizione);
const dimezzato = calcola('Ottobre', [{ ...accordo, data_inizio_validita: '2026-10-06' }]);
verifica('...e se almeno un formulario cade nel periodo, la riga c\'e\' e l\'informazione no', dimezzato.righe.RETE.filter(eRigaSurplus).length === 1 && !dimezzato.anomalie.some(a => a.tipo === 'informazione' && /Accordo Alfa/.test(a.descrizione)));
verifica('un surplus a tutti senza formulari nel canale non e\' un\'informazione', !calcolaRigheAttiva({ reteAll: [], aciAll: [], extraAll: [], fornitori, tariffe, anno: 2026, mese: 'Ottobre', surplus: FUEL }).anomalie.some(a => a.tipo === 'informazione'));

console.log('4. LA RICONCILIAZIONE');
const salvate = con.righe.RETE.map(r => ({ ...r, documento_id: 'd1' }));
verifica('appena elaborato: allineato', riconciliaAttiva(con.righe.RETE, salvate).allineato === true);
const dopo = calcolaRigheAttiva({ reteAll: [...reteAll, mov('8', 'ALFA SRL', 1000, '2026-10-20T08:00:00.000Z')], aciAll, extraAll, fornitori, tariffe, anno: 2026, mese: 'Ottobre', surplus: FUEL });
const ric = riconciliaAttiva(dopo.righe.RETE, salvate);
const cambS = ric.cambiati.find(x => x.surplus);
verifica('un ordine arrivato dopo: nuovo, e la riga del surplus cambiata con la frase', ric.nuovi.length === 1 && ric.nuovi[0].ordine === 'ET8' && !!cambS
  && cambS.kg_riferimento_documento === 2309 && cambS.kg_riferimento_oggi === 3309 && cambS.spiegazione === 'Fuel Surcharge: +5,00 € sulle 1,00 t arrivate dopo.', JSON.stringify(cambS));
verifica('...i chili non contano due volte: delta 1.000 kg, 207,00 €', ric.delta_kg === 1000 && ric.delta_euro === 207, JSON.stringify({ kg: ric.delta_kg, euro: ric.delta_euro }));
const senzaRiga = riconciliaAttiva(con.righe.RETE, senza.righe.RETE);
verifica('un surplus scritto dopo l\'elaborazione: nuovo, con la frase', senzaRiga.nuovi.length === 1 && senzaRiga.nuovi[0].surplus === true && /^Fuel Surcharge: \+11,55 € sulle 2,309 t del mese, che il documento non ha/.test(senzaRiga.nuovi[0].spiegazione || '') && senzaRiga.delta_kg === 0, JSON.stringify(senzaRiga.nuovi));
const tolto = riconciliaAttiva(senza.righe.RETE, salvate);
verifica('un surplus tolto: sparito, con la frase', tolto.spariti.length === 1 && /non ha più/.test(tolto.spariti[0].spiegazione || ''), JSON.stringify(tolto.spariti));
const seiEuro = riconciliaAttiva(calcola('Ottobre', [fs('RETE', { euro_t_attiva: 6 })]).righe.RETE, salvate).cambiati.find(x => x.surplus);
verifica('l\'importo cambiato si dice', !!seiEuro && seiEuro.spiegazione === 'Fuel Surcharge: +2,30 € l\'importo è passato da 5,00 €/t a 6,00 €/t.', JSON.stringify(seiEuro));

console.log('5. LE FUNZIONI');
const db = {
  PrimariaRete: reteAll, PrimariaAci: aciAll, ExtraRaccolta: extraAll, Fornitore: fornitori, Tariffa: tariffe, SurplusTariffa: FUEL,
  DocumentoFatturazione: [], VoceFatturazione: [],
};
const riep = await caricaFunzione('getRiepilogoEcotyre');
const R = await chiama(riep, { db, ruolo: 'user', corpo: { anno: 2026, mese: 'Ottobre' } });
const rete = (R.j.tipologie || []).find(t => t.tipologia === 'RETE') || {};
verifica('riepilogo: risponde', R.stato === 200, JSON.stringify(R.j).slice(0, 300));
verifica('riepilogo rete: il totale comprende il surplus, e si dice lo standard', rete.totale === 477.98 && rete.totale_standard === 466.43 && rete.totale_surplus === 11.55, JSON.stringify({ t: rete.totale, s: rete.totale_standard, x: rete.totale_surplus }));
verifica('riepilogo rete: la riga del surplus coi suoi dati, senza gli ordini', (rete.surplus || []).length === 1 && rete.surplus[0].nome === 'Fuel Surcharge' && rete.surplus[0].totale === 11.55 && rete.surplus[0].origine === 'consorzio Ecotyre' && !('ordini_ids' in rete.surplus[0]), JSON.stringify(rete.surplus));
// Il riepilogo risponde a chiunque sia collegato: quanto SMOCO paga ai fornitori
// (un costo) non ci deve essere. Un accordo con 5 €/t da Ecotyre e 3,70 ai
// raccoglitori, letto con un utente che non e' l'amministratore.
const accordoCosti = { ...fs('RETE'), id: 'acc-costi', nome: 'Accordo carburante', origine: 'ACCORDO_COMMERCIALE', euro_t_attiva: 5, euro_t_passiva: 3.7 };
const RU = await chiama(riep, { db: { ...db, SurplusTariffa: [accordoCosti] }, ruolo: 'user', corpo: { anno: 2026, mese: 'Ottobre' } });
const reteU = (RU.j.tipologie || []).find(t => t.tipologia === 'RETE') || {};
verifica('riepilogo letto da un utente: la parte attiva c\'e\', quanto si paga ai fornitori no', RU.stato === 200 && reteU.surplus?.[0]?.euro_t === 5 && !/euro_t_passiva|3\.7\b/.test(JSON.stringify(RU.j)), JSON.stringify(reteU.surplus));
verifica('riepilogo: solo i campi dell\'attiva, elencati', JSON.stringify(Object.keys(reteU.surplus?.[0] || {}).sort()) === JSON.stringify(['al', 'dal', 'euro_t', 'gruppo', 'kg', 'nome', 'ordini', 'origine', 'prestazione', 'riferimento', 'surplus_id', 'ton', 'totale']), JSON.stringify(Object.keys(reteU.surplus?.[0] || {})));
verifica('il calcolo dell\'attiva non porta quanto si paga ai fornitori', ['RETE', 'ACI', 'EXTRA_RACCOLTA'].every(c => (con.surplus_del_mese[c] || []).every(x => !('euro_t_passiva' in x)))
  && !('euro_t_passiva' in ((calcola('Ottobre', [accordoCosti]).surplus_del_mese.RETE || [])[0] || { euro_t_passiva: 1 })), JSON.stringify(con.surplus_del_mese.RETE));
verifica('riepilogo rete: ordini, chili, regioni, dicitura e prezzi senza il surplus', rete.ordini === 4 && rete.volume_kg === 2309
  && !rete.by_regione.some(x => x.regione === 'N/D') && rete.by_regione.reduce((x, r) => x + r.ordini, 0) === 4 && Math.abs(rete.by_regione.reduce((x, r) => x + r.totale, 0) - 466.43) < 0.005
  && rete.ripartizione_servizio.TRASP_TRATT.ordini + rete.ripartizione_servizio.TRASP.ordini === 4 && rete.badge.tipo === 'uniforme', JSON.stringify({ o: rete.ordini, r: rete.by_regione, b: rete.badge, rip: rete.ripartizione_servizio }));
// un mese chiuso senza la riga del surplus: la differenza si fattura a parte
const dbChiuso = { ...db, DocumentoFatturazione: [{ id: 'd1', tipo: 'ATTIVA', tipologia: 'RETE', anno: 2026, mese: 'Ottobre', stato: 'chiusa', totale: 466.43, data_elaborazione: '2026-11-03T10:00:00.000Z' }],
  VoceFatturazione: senza.righe.RETE.map(r => ({ ...r, documento_id: 'd1' })) };
const C = await chiama(riep, { db: dbChiuso, ruolo: 'user', corpo: { anno: 2026, mese: 'Ottobre' } });
const ricC = ((C.j.tipologie || []).find(t => t.tipologia === 'RETE') || {}).riconciliazione || {};
verifica('mese chiuso: il surplus nuovo si fattura a parte, e non si riapre niente', ricC.surplus_a_parte?.euro === 11.55 && /è chiuso/.test(ricC.surplus_a_parte?.testo || '') && /11,55 € in più, va fatturato a parte/.test(ricC.surplus_a_parte?.testo || '') && !C.scritte.length, JSON.stringify(ricC.surplus_a_parte));
const elab = await caricaFunzione('elaboraFatturazioneAttiva');
const E = await chiama(elab, { db, ruolo: 'admin', corpo: { anno: 2026, mese: 'Ottobre' } });
const vociSurplus = (E.db.VoceFatturazione || []).filter(v => v.origine_dato === 'SURPLUS');
const docRete = (E.db.DocumentoFatturazione || []).find(d => d.tipologia === 'RETE') || {};
const dRete = (E.j.documenti || []).find(d => d.tipologia === 'RETE') || {};
verifica('documento: tre righe di surplus salvate, una per canale', E.stato === 200 && vociSurplus.length === 3 && vociSurplus.every(v => v.quantita === 0 && v.kg_riferimento > 0 && v.documento_id), JSON.stringify(E.j).slice(0, 300));
verifica('documento rete: il totale comprende il surplus, le voci anche', docRete.totale === 477.98 && docRete.numero_voci === 5 && dRete.totale_standard === 466.43 && dRete.totale_surplus === 11.55 && (dRete.surplus || [])[0]?.totale === 11.55, JSON.stringify({ doc: docRete.totale, n: docRete.numero_voci, d: dRete }));
const rip = (E.j.ripartizione_servizio_per_tipologia || {}).RETE || {};
verifica('documento rete: la ripartizione per dicitura non prende il surplus', rip.TRASP_TRATT.ordini + rip.TRASP.ordini === 4 && Math.abs(rip.TRASP_TRATT.totale + rip.TRASP.totale - 466.43) < 0.005, JSON.stringify(rip));
const E0 = await chiama(elab, { db: { ...db, SurplusTariffa: [] }, ruolo: 'admin', corpo: { anno: 2026, mese: 'Ottobre' } });
verifica('documento senza surplus: come prima', !(E0.db.VoceFatturazione || []).some(v => v.origine_dato === 'SURPLUS') && (E0.db.DocumentoFatturazione || []).find(d => d.tipologia === 'RETE')?.totale === 466.43);

console.log('6. LE LETTURE E L\'ARCHIVIO');
for (const f of ['getRiepilogoEcotyre', 'elaboraFatturazioneAttiva', 'prefatturaEcotyre']) {
  const src = leggi(`../base44/functions/${f}/entry.ts`);
  verifica(`${f} legge SurplusTariffa, tutto, e lo passa al calcolo`, /fetchAll\([^)]*\.SurplusTariffa\)/.test(src) && /calcolaRigheAttiva\(\{[^}]*\bsurplus\b[^}]*\}\)/.test(src) && !/SurplusTariffa[^\n]*stato:\s*'attivo'/.test(src));
}
const voce = JSON.parse(leggi('../base44/entities/VoceFatturazione.jsonc'));
verifica('VoceFatturazione: l\'origine SURPLUS, surplus_id e kg_riferimento', voce.properties.origine_dato.enum.includes('SURPLUS') && voce.properties.surplus_id?.type === 'string' && voce.properties.kg_riferimento?.type === 'number');

console.log('7. SUI DATI VERI: SETTEMBRE 2026 COL FUEL SURCHARGE');
const CARTELLA = process.env.DATI_VERI || fileURLToPath(new URL('../../dati-veri/', import.meta.url));
const copie = existsSync(CARTELLA) ? readdirSync(CARTELLA).filter(n => /^treadrider-dati-veri-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n)).sort() : [];
if (!copie.length) console.log('  copia dei dati veri assente: parte saltata');
else {
  const A = JSON.parse(gunzipSync(readFileSync(join(CARTELLA, copie[copie.length - 1]))).toString('utf8')).archivi;
  const veri = (mese, surplus) => calcolaRigheAttiva({ reteAll: A.PrimariaRete, aciAll: A.PrimariaAci, extraAll: A.ExtraRaccolta, fornitori: A.Fornitore, tariffe: A.Tariffa.filter(t => t.direzione === 'ATTIVA'), anno: 2026, mese, surplus });
  // settembre come esempio di un mese del Fuel Surcharge: lo si fa partire il 01/09
  const FUEL_SET = FUEL.map(x => ({ ...x, data_inizio_validita: '2026-09-01' }));
  const v0 = veri('Settembre');
  const v1 = veri('Settembre', FUEL_SET);
  const r0 = v0.righe.RETE, a0 = v0.righe.ACI;
  verifica('senza surplus: settembre come oggi (380 ordini, 1.120.240 kg, 226.288,48 €; ACI 6, 4.410,10 €)',
    r0.length === 380 && somma(r0, 'quantita') === 1120240 && Math.round(somma(r0, 'totale') * 100) === 22628848 && a0.length === 6 && Math.round(somma(a0, 'totale') * 100) === 441010 && !r0.some(eRigaSurplus),
    JSON.stringify({ n: r0.length, kg: somma(r0, 'quantita'), e: somma(r0, 'totale'), aci: somma(a0, 'totale') }));
  const fsR = v1.righe.RETE.filter(eRigaSurplus), fsA = v1.righe.ACI.filter(eRigaSurplus);
  verifica('rete: 5.601,20 € sulle 1.120,24 t, 380 ordini', fsR.length === 1 && fsR[0].totale === 5601.2 && fsR[0].kg_riferimento === 1120240 && fsR[0].record_count === 380, JSON.stringify(fsR));
  // Formulario per formulario il centesimo cambia: 5.601,22 col mezzo centesimo
  // per eccesso di Excel, 5.601,21 col Math.round del numero binario (la stima
  // del progetto del 12/10/2026). Sul mese, una volta sola: 5.601,20.
  const perRigaExcel = r0.reduce((x, r) => x + Math.round(r.quantita * 5 / 10), 0) / 100;
  const perRigaBinario = r0.reduce((x, r) => x + Math.round((r.quantita / 1000 * 5 + Number.EPSILON) * 100), 0) / 100;
  verifica('...non 5.601,21 ne\' 5.601,22, gli arrotondamenti formulario per formulario', perRigaExcel === 5601.22 && perRigaBinario === 5601.21 && fsR[0]?.totale === 5601.2, JSON.stringify({ perRigaExcel, perRigaBinario }));
  verifica('ACI: 94,45 € sulle 18,89 t', fsA.length === 1 && fsA[0].totale === 94.45 && fsA[0].kg_riferimento === 18890, JSON.stringify(fsA));
  verifica('extra raccolta: nessun intervento a settembre, nessuna riga', !v1.righe.EXTRA_RACCOLTA.some(eRigaSurplus));
  verifica('le righe dei formulari e le anomalie di settembre non cambiano', uguali(v1.righe.RETE.filter(r => !eRigaSurplus(r)), r0) && uguali(v1.righe.ACI.filter(r => !eRigaSurplus(r)), a0) && uguali(v1.anomalie, v0.anomalie));
  let identici = true, primaDelSurplus = true;
  for (const mese of ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Ottobre']) {
    const x0 = veri(mese), x1 = veri(mese, FUEL_SET);
    for (const c of ['RETE', 'ACI', 'EXTRA_RACCOLTA']) {
      if (!uguali(x1.righe[c].filter(r => !eRigaSurplus(r)), x0.righe[c])) identici = false;
      if (x0.righe[c].some(eRigaSurplus)) identici = false;
      if (['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto'].includes(mese) && x1.righe[c].some(eRigaSurplus)) primaDelSurplus = false;
    }
  }
  verifica('ogni mese del 2026: le righe dei formulari col surplus sono quelle senza', identici);
  verifica('prima del 01/09 nessuna riga di surplus', primaDelSurplus);
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
