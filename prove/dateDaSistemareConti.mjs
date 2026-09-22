// Prova dei conteggi delle date da sistemare nei conti dei movimenti (regola
// dell'utente del 22/09/2026: immissione, inizio e fine trasporto sono
// obbligatorie in ogni formulario terminato, e dove mancano o non tornano si
// segnala in ogni modulo). La regola e' in movimenti.ts; qui si prova chi la
// conta: riepilogoDate e riepilogoDateVista (raccoltoCalculator.ts), i tempi di
// raccolta e la matrice delle primarie (primarieReteAnalytics.ts), le pivot del
// Report Mensile (reportMensile.ts) e il raccolto di Target & Status. npm run prove
import { riepilogoDate, riepilogoDateVista, computeRaccoltoData } from '../base44/shared/raccoltoCalculator.ts';
import { computeSlaMetrics, computeProvinceMatrixData, computeRaccoglitoriMixData } from '../base44/shared/primarieReteAnalytics.ts';
import { calcolaPivot } from '../base44/shared/reportMensile.ts';
import { oggiRoma } from '../base44/shared/giornoItaliano.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const ANNO = Number(oggiRoma().slice(0, 4));
const g = (mm, dd, ora = '08:00:00') => `${ANNO}-${mm}-${dd}T${ora}Z`;
// un ritiro con le date a posto, di rete, in Campania, a giugno
const base = { stato: 'terminato', provincia: 'NA', regione: 'Campania', trasportatore: 'Raccoglitore Uno', destinazione: 'Impianto', classe: 'P', peso_effettivo: 1000, ordine_immesso_il: g('06', '01'), trasporto_iniziato_il: g('06', '05'), trasporto_finito_il: g('06', '05', '10:00:00') };
const completo = { ...base, id_ordine: 'OK1' };
const senzaFine = { ...base, id_ordine: 'SF1', trasporto_finito_il: null };
const senzaInizio = { ...base, id_ordine: 'SI1', trasporto_iniziato_il: null };
const fineDopoImmissioneMaPrimaDellInizio = { ...base, id_ordine: 'INC1', trasporto_iniziato_il: g('06', '10'), trasporto_finito_il: g('06', '08') };
const senzaImmissioneNeInizio = { ...base, id_ordine: 'SII1', ordine_immesso_il: null, trasporto_iniziato_il: null };
const aperto = { stato: 'assegnato', id_ordine: 'AP1' };

console.log('RIEPILOGO DELLE DATE');
const r = riepilogoDate([completo, senzaFine, senzaInizio, fineDopoImmissioneMaPrimaDellInizio, senzaImmissioneNeInizio, aperto]);
verifica('conta i terminati da sistemare, non gli ordini aperti', r.totale === 4, JSON.stringify(r));
verifica('ogni data mancante nella sua voce', r.mancanti['fine trasporto'] === 1 && r.mancanti['inizio trasporto'] === 2 && r.mancanti.immissione === 1 && r.senza_fine_trasporto === 1, JSON.stringify(r.mancanti));
verifica('le incoerenti a parte', r.incoerenti === 1);
verifica('il testo nell\'ordine delle date obbligatorie', r.testo === '1 senza immissione, 2 senza inizio trasporto, 1 senza fine trasporto, 1 con date incoerenti', r.testo);
verifica('gli esempi dicono cosa manca', r.esempi.length === 4 && r.esempi[0].id_ordine === 'SF1' && r.esempi[0].testo === 'manca la data di fine trasporto' && r.esempi[0].fine_trasporto === '', JSON.stringify(r.esempi[0]));
verifica('esempi limitati a richiesta', riepilogoDate([senzaFine, senzaInizio], 1).esempi.length === 1 && riepilogoDate([senzaFine], 0).esempi.length === 0);
verifica('niente da sistemare: tutto a zero', riepilogoDate([completo, aperto]).totale === 0 && riepilogoDate([]).testo === '' && riepilogoDate(null).totale === 0);

console.log('RIEPILOGO DI UNA VISTA');
const dellAnnoPrima = { ...base, id_ordine: 'VEC', trasporto_iniziato_il: `${ANNO - 1}-03-01T08:00:00Z`, trasporto_finito_il: `${ANNO - 1}-03-01T10:00:00Z`, ordine_immesso_il: `${ANNO - 1}-03-05T08:00:00Z` };
// tutti: l'archivio prima dei filtri di periodo; contati: il periodo (qui giugno dell'anno)
const vista = riepilogoDateVista([completo, senzaFine, senzaInizio, dellAnnoPrima], [completo, senzaInizio, senzaFine]);
verifica('senza fine trasporto da tutti, gli altri solo dai contati, senza doppioni', vista.totale === 2 && vista.senza_fine_trasporto === 1 && vista.mancanti['inizio trasporto'] === 1 && vista.incoerenti === 0, JSON.stringify(vista));

console.log('TEMPI DI RACCOLTA');
const sla = computeSlaMetrics([completo, senzaFine, senzaInizio, fineDopoImmissioneMaPrimaDellInizio, senzaImmissioneNeInizio], ANNO);
verifica('fine prima dell\'inizio: non si misura, anche se viene dopo l\'immissione', sla.non_misurati.date_incoerenti === 1 && sla.non_misurati.esempi.includes('INC1'), JSON.stringify(sla.non_misurati));
verifica('senza immissione e senza fine: non misurati, ciascuno col suo motivo', sla.non_misurati.senza_immissione === 1 && sla.non_misurati.senza_fine_trasporto === 1);
verifica('senza il solo inizio: si misura (i tempi non lo usano)', sla.totale_ordini === 2, String(sla.totale_ordini));
verifica('ma le date da sistemare dell\'anno lo dicono', sla.date_da_sistemare.totale === 4 && sla.date_da_sistemare.mancanti['inizio trasporto'] === 2, JSON.stringify(sla.date_da_sistemare));

console.log('MATRICE E MIX DELLE PRIMARIE');
const matrice = computeProvinceMatrixData([completo, senzaFine, senzaInizio, dellAnnoPrima, aperto]);
verifica('matrice: il senza fine di qualunque anno e il ritiro dell\'anno senza inizio', matrice.date_da_sistemare.totale === 2 && matrice.date_da_sistemare.senza_fine_trasporto === 1, JSON.stringify(matrice.date_da_sistemare));
const mix = computeRaccoglitoriMixData([completo, senzaFine, { ...senzaInizio, regione: 'Puglia', provincia: 'BA' }], {}, { anno: [ANNO], regione: ['Campania'] });
verifica('mix: i filtri che non sono di periodo valgono anche qui', mix.date_da_sistemare.totale === 1 && mix.date_da_sistemare.senza_fine_trasporto === 1, JSON.stringify(mix.date_da_sistemare));

console.log('PIVOT DEL REPORT MENSILE');
const secRete = { ...senzaInizio, id_ordine: 'SECR', stoccaggio: 'Stoccaggio', classe: 'P' };
const secAciSenzaFine = { ...senzaFine, id_ordine: 'SECA', stoccaggio: 'Stoccaggio', classe: '9 - PFU Autodemolizione' };
const pivotRete = calcolaPivot('secondarie', [secRete, secAciSenzaFine, { ...completo, stoccaggio: 'Stoccaggio' }], ANNO, 'Giugno');
verifica('la pivot di rete non conta le date dell\'ACI', pivotRete.date_da_sistemare.totale === 1 && pivotRete.date_da_sistemare.esempi[0].id_ordine === 'SECR', JSON.stringify(pivotRete.date_da_sistemare));
const pivotAci = calcolaPivot('secondarieAci', [secRete, secAciSenzaFine], ANNO, 'Giugno');
verifica('la pivot ACI conta il suo senza fine trasporto, fuori dalla pivot', pivotAci.date_da_sistemare.totale === 1 && pivotAci.date_da_sistemare.senza_fine_trasporto === 1 && pivotAci.righeLette === 0);
const pivotMese = calcolaPivot('raccolta', [senzaInizio, { ...senzaInizio, id_ordine: 'LUG', trasporto_iniziato_il: null, trasporto_finito_il: g('07', '03') }], ANNO, 'Giugno');
verifica('una pivot mensile conta le date del suo mese, non degli altri', pivotMese.date_da_sistemare.totale === 1 && pivotMese.date_da_sistemare.esempi[0].id_ordine === 'SI1');

console.log('RACCOLTO DI TARGET & STATUS');
const finto = (righe) => ({ asServiceRole: { entities: { PrimariaRete: { list: async () => righe, filter: async () => righe }, PrimariaAci: { list: async () => [], filter: async () => [] } } } });
const raccolto = await computeRaccoltoData(finto([completo, senzaFine, senzaInizio, { ...senzaFine, id_ordine: 'SF2', provincia: 'BA' }]), { anno: [ANNO], regione: ['Campania'], canale: 'rete' });
verifica('raccolto: senza fine trasporto fuori dal totale ma nel riepilogo, con la regione del filtro', raccolto.totale_raccolto === 2 && raccolto.date_da_sistemare.totale === 2 && raccolto.date_da_sistemare.senza_fine_trasporto === 1, JSON.stringify({ t: raccolto.totale_raccolto, d: raccolto.date_da_sistemare }));
const tutti = await computeRaccoltoData(finto(Array.from({ length: 15 }, (_, i) => ({ ...senzaFine, id_ordine: `X${i}` }))), { anno: [ANNO] }, { esempiDate: Infinity });
verifica('chi scrive un file li vuole tutti', tutti.date_da_sistemare.esempi.length === 15);

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
