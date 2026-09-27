// Prova del gia' arrivato di rete della predittivita' delle secondarie
// (base44/shared/proiezioneSecondarie.ts): il conto unico di Dashboard,
// Proiezione a fine anno, suggerimento del lunedi' e agente (regola dell'utente
// del 22/09/2026), il doppio ruolo impianto + piazzale col piazzale al netto di
// quello che riparte per altri impianti, i trasbordi dell'impianto dal proprio
// piazzale nella disponibilita' degli altri, le date obbligatorie dei
// formulari, contati per ordine. Le tre funzioni insieme: prove/predittivitaFunzioni.mjs.
// npm run prove
import { giaArrivatoDiRete, residuoDiRete, noteGiaArrivato, dateDaSistemareDiRete } from '../base44/shared/proiezioneSecondarie.ts';
import { normalizzaRagioneSociale } from '../base44/shared/normalizzaRagioneSociale.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const k = normalizzaRagioneSociale;
const J = (x) => JSON.stringify(x);

// Un formulario completo, con le tre date obbligatorie, finito il giorno dato.
const date = (fine) => ({ ordine_immesso_il: '2026-06-01T08:00:00Z', trasporto_iniziato_il: fine, trasporto_finito_il: fine });
const prim = (id, trasportatore, destinazione, tipo, kg, fine = '2026-06-10T09:00:00Z', extra = {}) => ({ id_ordine: id, stato: 'terminato', classe: 'A', trasportatore, destinazione, tipo_destinazione: tipo, peso_effettivo: kg, ...date(fine), ...extra });
const sec = (id, stoccaggio, destinazione, kg, fine = '2026-06-12T09:00:00Z', extra = {}) => ({ id_ordine: id, stato: 'terminato', classe: 'A', stoccaggio, destinazione, tipo_destinazione: 'imp', peso_effettivo: kg, ...date(fine), ...extra });

const IMPIANTI = ['t-cycle', 'tecnogum'];
const primarie = [
  prim('P1', 'Logistica & Pneumatici Srl', 'T-CYCLE INDUSTRIES SRL', 'imp', 100000),
  prim('P2', 'C.L. Service', 'T-Cycle Srl', 'stoc', 50000),            // scaricata nel piazzale di T-Cycle
  prim('P3', 'Ecorecuperi', 'Tecnogum Srl', 'imp', 20000),
  prim('P4', 'Qualcuno', 'T-Cycle', 'imp', 7000, '2026-06-10T09:00:00Z', { classe: '9 - PFU Autodemolizione' }), // ACI
  prim('P5', 'Qualcuno', 'T-Cycle', 'imp', 8000, '2026-06-10T09:00:00Z', { stato: 'assegnato' }),
  prim('P6', 'Qualcuno', 'T-Cycle', 'imp', 9000, '2025-06-10T09:00:00Z'),                                        // un altro anno
  prim('P7', 'Qualcuno', 'T-Cycle', 'imp', 1000, '2025-12-31T23:30:00Z', { ordine_immesso_il: '2025-12-20T08:00:00Z' }), // capodanno italiano: 2026
  { id_ordine: 'P8', stato: 'terminato', classe: 'A', trasportatore: 'X', destinazione: 'T-Cycle', tipo_destinazione: 'imp', peso_effettivo: 5000, ordine_immesso_il: '2026-06-01T08:00:00Z', trasporto_iniziato_il: '2026-06-02T08:00:00Z', ordine_chiuso_il: '2026-06-05T08:00:00Z' }, // senza fine trasporto
  prim('P9', 'Nappi Sud', 'Nappi Sud Srl', 'stoc', 40000),              // uno stoccaggio che non e' un impianto seguito
];
const secondarie = [
  sec('S1', 'T-Cycle', 'T-Cycle', 50000),       // dal piazzale di T-Cycle all'impianto stesso: MAI contata
  sec('S2', 'Nappi Sud', 'T-Cycle', 30000),     // da un altro stoccaggio: si conta
  sec('S3', 'T-Cycle', 'Tecnogum', 40000),      // dal piazzale di T-Cycle a Tecnogum
  sec('S4', 'Nappi Sud', 'Tecnogum', 13500, '2026-06-12T09:00:00Z', { classe: '9 - PFU Autodemolizione' }), // ACI
];

console.log('IL GIA\' ARRIVATO DI RETE');
const arrivati = giaArrivatoDiRete(IMPIANTI, primarie, secondarie, 2026, k);
const tc = arrivati.get('t-cycle');
const tg = arrivati.get('tecnogum');
verifica('primarie all\'impianto e nel piazzale dello stesso sito, con l\'alias del nome', tc.primaria_impianto_kg === 101000 && tc.primaria_piazzale_kg === 50000, JSON.stringify(tc));
// Il piazzale conta al netto: dei 50.000 kg entrati nel piazzale di T-Cycle,
// 40.000 ripartono per Tecnogum, che li conta lui. A T-Cycle ne restano 10.000.
verifica('il piazzale al netto di quello che riparte per Tecnogum', tc.piazzale_ripartito_kg === 40000 && tc.primaria_piazzale_netta_kg === 10000 && tc.primaria_kg === 111000 && tc.ripartito_non_tolto_kg === 0, JSON.stringify({ rip: tc.piazzale_ripartito_kg, netta: tc.primaria_piazzale_netta_kg, prim: tc.primaria_kg }));
verifica('doppio ruolo: la secondaria dal proprio piazzale a se stesso non si conta due volte', tc.secondaria_kg === 30000 && tc.totale_kg === 141000 && tc.da_se_stesso.viaggi === 1 && tc.da_se_stesso.kg === 50000, JSON.stringify({ sec: tc.secondaria_kg, tot: tc.totale_kg, se: tc.da_se_stesso }));
verifica('tutto quello che e\' arrivato al sito, ripartito compreso, per la capacita\'', tc.arrivato_al_sito_kg === 181000, JSON.stringify(tc.arrivato_al_sito_kg));
verifica('la somma dei movimenti e\' il gia\' arrivato, la ripartita in negativo', tc.movimenti.reduce((n, m) => n + m.kg, 0) === tc.totale_kg && tc.movimenti.some(m => m.flusso === 'ripartita' && m.kg === -40000 && m.a === 'tecnogum' && m.giorno === '2026-06-12'));
verifica('fuori: ACI, non terminati, un altro anno, i senza fine trasporto (anche se chiusi a portale)', !tc.movimenti.some(m => ['P4', 'P5', 'P6', 'P8'].includes(m.record.id_ordine)));
verifica('la fine trasporto alle 23:30Z del 31/12/2025 e\' il 2026 italiano', tc.movimenti.some(m => m.record.id_ordine === 'P7' && m.giorno === '2026-01-01' && m.mese_idx === 0));
verifica('mese per mese sulla fine trasporto, il ripartito sul mese della partenza', tc.primaria_per_mese[5] === 110000 && tc.primaria_per_mese[0] === 1000 && tc.secondaria_per_mese[5] === 30000, JSON.stringify(tc.primaria_per_mese));
verifica('Tecnogum conta la secondaria dal piazzale di T-Cycle, non quella ACI', tg.secondaria_kg === 40000 && tg.primaria_kg === 20000 && tg.totale_kg === 60000, JSON.stringify(tg));
verifica('T-Cycle sa cosa e\' partito dal suo piazzale verso un altro impianto seguito', tc.verso_altri.tecnogum && tc.verso_altri.tecnogum.kg === 40000 && tc.verso_altri.tecnogum.viaggi === 1 && tc.verso_altri.tecnogum.seguito === true);
// Gli stessi PFU in un residuo solo: i due gia' arrivati insieme sono i PFU
// distinti arrivati ai due siti (P1 + P7 + P2 + S2 per T-Cycle, P3 per Tecnogum).
verifica('i PFU partiti dal piazzale di T-Cycle per Tecnogum stanno in un gia\' arrivato solo', tc.totale_kg + tg.totale_kg === 100000 + 1000 + 50000 + 30000 + 20000, JSON.stringify({ tc: tc.totale_kg, tg: tg.totale_kg }));
verifica('uno stoccaggio che non e\' un impianto seguito non ha un gia\' arrivato', !arrivati.has('nappi sud'));

console.log('IL RESIDUO, LO STESSO OVUNQUE');
verifica('residuo = target - gia\' arrivato', residuoDiRete(1050000, tc) === 909000 && residuoDiRete('100000', tg) === 40000);
verifica('sotto zero se il target e\' superato, senza impianto il target intero', residuoDiRete(50000, tg) === -10000 && residuoDiRete(1000, undefined) === 1000);

console.log('LE NOTE');
const note = noteGiaArrivato(tc, (x) => ({ 't-cycle': 'T-Cycle', tecnogum: 'Tecnogum' }[x] || x), 2026);
verifica('dice la secondaria a se stesso lasciata fuori, quella partita per Tecnogum e il piazzale al netto', note.length === 3 && note[0].includes('1 secondaria') && note[0].includes('50,00 t') && note[1].includes('Tecnogum') && note[1].includes('40,00 t') && note[1].includes('che le conta') && note[2].includes('al netto') && note[2].includes('ne restano 10,00 t') && note[2].includes('due residui'), JSON.stringify(note));
verifica('nessuna nota se non c\'e\' niente da dire', noteGiaArrivato(tg, null, 2026).length === 0 && noteGiaArrivato(undefined).length === 0);

console.log('IL PIAZZALE AL NETTO: SOLO QUELLO ENTRATO NELL\'ANNO');
// Irigom spedisce a Gatim, che non e' un impianto seguito, il 5 gennaio (da una
// giacenza del 2025: nel piazzale non e' ancora entrato niente), il primo marzo,
// dopo i 15.000 kg entrati a febbraio, e il 3 aprile, lo stesso giorno di
// un'entrata. Della prima non si toglie niente.
const irigom = giaArrivatoDiRete(['irigom'], [
  prim('I1', 'SMOCO', 'Irigom Srl', 'stoc', 15000, '2026-02-01T09:00:00Z'),
  prim('I2', 'SMOCO', 'Irigom Srl', 'stoc', 5000, '2026-04-02T09:00:00Z'),
  prim('I3', 'SMOCO', 'Irigom Srl', 'stoc', 2000, '2026-04-03T09:00:00Z'),
], [
  sec('J1', 'Irigom', 'Gatim', 20000, '2026-01-05T09:00:00Z'),
  sec('J2', 'Irigom', 'Gatim', 10000, '2026-03-01T09:00:00Z'),
  sec('J3', 'Irigom', 'Gatim', 6000, '2026-04-03T08:00:00Z'), // stesso giorno di I3, prima nell'ora: vale il giorno, prima l'entrata
], 2026, k).get('irigom');
verifica('si toglie al massimo quello che nell\'anno e\' entrato nel piazzale fino a quel giorno', irigom.piazzale_ripartito_kg === 16000 && irigom.ripartito_non_tolto_kg === 20000 && irigom.primaria_piazzale_netta_kg === 6000 && irigom.totale_kg === 6000, JSON.stringify({ rip: irigom.piazzale_ripartito_kg, non: irigom.ripartito_non_tolto_kg, netta: irigom.primaria_piazzale_netta_kg }));
verifica('il ripartito sul mese della partenza, anche sotto zero in un mese', irigom.primaria_per_mese[1] === 15000 && irigom.primaria_per_mese[2] === -10000 && irigom.primaria_per_mese[3] === 1000 && !irigom.primaria_per_mese[0], JSON.stringify(irigom.primaria_per_mese));
verifica('anche verso un impianto non seguito', irigom.verso_altri.gatim && irigom.verso_altri.gatim.seguito === false && irigom.verso_altri.gatim.kg === 36000 && irigom.verso_altri.gatim.viaggi === 3);
const noteIrigom = noteGiaArrivato(irigom, null, 2026);
verifica('le note: niente "che le conta" per un impianto non seguito, e quello che non si toglie', noteIrigom.length === 3 && !noteIrigom[0].includes('che le conta') && !noteIrigom[1].includes('due residui') && noteIrigom[2].includes('20,00 t') && noteIrigom[2].includes('non si tolgono'), JSON.stringify(noteIrigom));

// I siti della predittivita' li decide il motore (predittivita.ts): qui quelli di prova.
const siti = { tutti: new Set(['t-cycle', 'tecnogum', 'ecorecuperi', 'nappi sud', 'piazzale storico']) };

console.log('LE DATE OBBLIGATORIE (regola del 22/09/2026)');
const conDate = [
  ...primarie,
  prim('D1', 'Ecorecuperi', 'Tecnogum', 'imp', 1000, '2026-07-01T09:00:00Z', { trasporto_iniziato_il: null }),               // manca l'inizio: contata e segnalata
  prim('D2', 'Ecorecuperi', 'Tecnogum', 'imp', 1000, '2026-07-01T09:00:00Z', { trasporto_iniziato_il: '2026-07-03T09:00:00Z' }), // fine prima dell'inizio
  prim('D3', 'Ecorecuperi', 'Tecnogum', 'imp', 1000, '2025-07-01T09:00:00Z', { trasporto_iniziato_il: null }),               // un altro anno: non si guarda
  prim('D4', 'Qualcuno', 'Green Tyre Project', 'imp', 1000, '2026-07-01T09:00:00Z', { trasporto_iniziato_il: null }),        // un sito che la predittivita' non guarda
  prim('D5', 'Qualcuno', 'T-Cycle', 'imp', 1000, '2026-07-01T09:00:00Z', { trasporto_iniziato_il: null, stato: 'assegnato' }), // non terminato: non si giudica
];
const secConDate = [...secondarie, { id_ordine: 'D6', stato: 'terminato', classe: 'A', stoccaggio: 'Nappi Sud', destinazione: 'Tecnogum', peso_effettivo: 13000 }];
const esito = dateDaSistemareDiRete(conDate, secConDate, siti.tutti, 2026, k);
const idsP = esito.primarie.map(x => x.id_ordine).sort().join(',');
verifica('primarie: il senza fine trasporto, l\'inizio mancante, le date in ordine sbagliato', idsP === 'D1,D2,P8', idsP);
verifica('secondarie: quella senza nessuna data', esito.secondarie.length === 1 && esito.secondarie[0].id_ordine === 'D6' && esito.secondarie[0].testo === 'mancano le date di immissione, inizio trasporto e fine trasporto');
verifica('fuori dai conti solo chi non ha la fine trasporto', esito.senza_fine.primarie === 1 && esito.senza_fine.secondarie === 1 && esito.primarie.find(x => x.id_ordine === 'D1').fuori_dai_conti === false && esito.primarie.find(x => x.id_ordine === 'P8').fuori_dai_conti === true);
verifica('l\'avviso dice quali date mancano e quali ordini', esito.avviso.includes('manca la data di inizio trasporto, 1 ordine (D1)') && esito.avviso.includes("fine trasporto prima dell'inizio, 1 ordine (D2)") && esito.avviso.includes('manca la data di fine trasporto, 1 ordine (P8)') && esito.avviso.includes('Gli ordini senza fine trasporto (primarie: 1, secondarie: 1)') && esito.avviso.includes('Primarie, 3 ordini:') && esito.avviso.includes('Secondarie, 1 ordine:') && esito.avviso.includes('Gli altri sono contati'), esito.avviso);
const arrivatiConDate = giaArrivatoDiRete(IMPIANTI, conDate, secConDate, 2026, k);
verifica('chi ha la fine trasporto resta nel gia\' arrivato anche con un\'altra data da sistemare', arrivatiConDate.get('tecnogum').primaria_kg === 22000);
verifica('niente da segnalare, nessun avviso', dateDaSistemareDiRete(primarie.filter(r => r.id_ordine !== 'P8'), secondarie, siti.tutti, 2026, k).avviso === '');

console.log('LE DATE DA SISTEMARE SI CONTANO PER ORDINE');
// Lo stesso ordine sta in archivio con piu' righe (una per classe, o le quote di
// un formulario ripartito): contato riga per riga, l'avviso diceva "2 ordini
// (O1, O1)". Si contano ORDINI distinti, con chiaveOrdine di movimenti.ts: l'ID
// dell'ordine, il formulario se l'ID manca, la riga se mancano tutti e due.
const perOrdine = dateDaSistemareDiRete([
  prim('O1', 'Ecorecuperi', 'Tecnogum', 'imp', 1000, '2026-07-01T09:00:00Z', { classe: 'P', trasporto_iniziato_il: null }),
  prim('O1', 'Ecorecuperi', 'Tecnogum', 'imp', 2000, '2026-07-01T09:00:00Z', { classe: 'M', trasporto_iniziato_il: null }),
  prim('o1 ', 'Ecorecuperi', 'Tecnogum', 'imp', 500, '2026-07-01T09:00:00Z', { classe: 'G1', trasporto_iniziato_il: null }),        // lo stesso ID, scritto diverso
  prim('O2', 'Ecorecuperi', 'Tecnogum', 'imp', 1000, '2026-07-02T09:00:00Z', { trasporto_iniziato_il: null }),
  prim('O2', 'Ecorecuperi', 'Tecnogum', 'imp', 1000, '2026-07-02T09:00:00Z', { trasporto_finito_il: null }),                        // un'altra riga dello stesso ordine, senza fine
  prim('O3', 'Ecorecuperi', 'Tecnogum', 'imp', 1000, '2026-07-03T09:00:00Z'),                                                      // una riga a posto: non si segnala
  prim('', 'Ecorecuperi', 'Tecnogum', 'imp', 1000, '2026-07-04T09:00:00Z', { numero_fir: 'FIR-A', trasporto_iniziato_il: null }),
  prim('', 'Ecorecuperi', 'Tecnogum', 'imp', 1000, '2026-07-04T09:00:00Z', { numero_fir: 'FIR-A', trasporto_iniziato_il: null }),  // senza ID vale il formulario
  prim('', 'Ecorecuperi', 'Tecnogum', 'imp', 1000, '2026-07-05T09:00:00Z', { trasporto_iniziato_il: null }),
  prim('', 'Ecorecuperi', 'Tecnogum', 'imp', 1000, '2026-07-05T09:00:00Z', { trasporto_iniziato_il: null }),                       // senza niente: ogni riga per se'
  prim('O4', 'Ecorecuperi', 'Tecnogum', 'imp', 1000, '2025-07-05T09:00:00Z', { trasporto_iniziato_il: null }),                      // un altro anno: fuori
], [
  sec('S9', 'Nappi Sud', 'Tecnogum', 6000, '2026-07-06T09:00:00Z', { classe: 'P', ordine_immesso_il: null }),
  sec('S9', 'Nappi Sud', 'Tecnogum', 7000, '2026-07-06T09:00:00Z', { classe: 'M', ordine_immesso_il: null }),
], siti.tutti, 2026, k);
const o = (id) => perOrdine.primarie.find(x => x.id_ordine === id);
verifica('un ordine in piu\' righe e\' un ordine, e dice quante righe ha', o('O1') && o('O1').righe === 3 && perOrdine.primarie.filter(x => x.id_ordine.trim().toUpperCase() === 'O1').length === 1, J(perOrdine.primarie));
verifica('le date da sistemare di tutte le sue righe, e fuori dai conti se a una manca la fine', o('O2').testo === 'manca la data di inizio trasporto; manca la data di fine trasporto' && o('O2').fuori_dai_conti === true && o('O1').fuori_dai_conti === false && perOrdine.senza_fine.primarie === 1, J(o('O2')));
verifica('senza ID vale il formulario; senza nessuno dei due ogni riga conta per se\'', perOrdine.primarie.length === 5 && o('FIR-A') && o('FIR-A').righe === 2 && perOrdine.primarie.filter(x => x.id_ordine === '').length === 2, J(perOrdine.primarie.map(x => x.id_ordine)));
verifica('anche le secondarie si contano per ordine', perOrdine.secondarie.length === 1 && perOrdine.secondarie[0].righe === 2 && perOrdine.secondarie[0].testo === 'manca la data di immissione', J(perOrdine.secondarie));
verifica('l\'avviso conta ordini: ogni ID una volta', perOrdine.avviso.includes('Primarie, 5 ordini:') && perOrdine.avviso.includes('Secondarie, 1 ordine:') && perOrdine.avviso.includes('manca la data di inizio trasporto, 4 ordini (O1, FIR-A, senza numero, senza numero)') && !/O1, O1|FIR-A, FIR-A/.test(perOrdine.avviso) && perOrdine.avviso.includes('Ogni ordine si conta una volta'), perOrdine.avviso);

console.log(`\n${ok} verifiche passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
