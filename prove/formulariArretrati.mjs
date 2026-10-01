// Prova delle righe di settimane precedenti nei report settimanali, e del
// termine per registrare un formulario: dieci giorni dalla data di partenza,
// domeniche escluse (regola dell'ufficio registrazioni, 01/10/2026).
//
// Nasce da un fatto vero, raccontato dall'utente il 01/10/2026. Nappi Sud non
// aveva messo nel report della sua settimana una richiesta terminata del 14
// settembre: non ce l'aveva mandata e non l'aveva annotata, e il confronto di
// quella settimana usciva perfetto. La riga e' comparsa nel report della
// settimana dopo, dove il gestionale la scartava come "fuori dalla settimana
// verificata" senza dire niente. Quando se n'e' accorto l'ufficio, il termine era
// passato, e l'utente si e' preso un richiamo per non averlo segnalato.
//
// Qui si prova che non puo' piu' succedere: una riga di un'altra settimana si
// verifica, quella che nel gestionale non c'e' diventa un'anomalia col suo
// termine, e l'alert la porta dove si guarda ogni giorno. E si prova anche il
// contrario, che e' la ragione per cui prima si scartava: un report cumulativo
// del mese, con le sue righe vecchie tutte registrate, resta conforme.
// npm run prove
import { readFileSync } from 'node:fs';
import { caricaMovimenti, verificaReport, normalizzaRigheReport } from '../base44/shared/reportSettimanali.ts';
import { arretratiDaSegnalare, salvaEsito, REGOLA_ARRETRATI } from '../base44/shared/esitoVerifica.ts';
import {
  GIORNI_TERMINE_REGISTRAZIONE, scadenzaRegistrazione, giorniUtili, statoTermine,
  testoTermine, testoScadenza, termineDi, testoConteggio, eDaNonContare,
} from '../base44/shared/termineRegistrazione.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

console.log('IL TERMINE: DIECI GIORNI DALLA PARTENZA, DOMENICHE ESCLUSE');
// 14/09/2026 e' un lunedi': 15,16,17,18,19 (sabato) sono cinque, la domenica 20
// non si conta, 21,22,23,24,25 sono gli altri cinque. Il termine e' venerdi' 25.
verifica('dieci giorni da lunedi 14/09/2026: venerdi 25/09/2026', scadenzaRegistrazione('2026-09-14') === '2026-09-25', scadenzaRegistrazione('2026-09-14'));
// Da venerdi 18: il sabato 19 conta, la domenica 20 no, e con due domeniche di
// mezzo (20 e 27) il decimo giorno utile e' mercoledi 30.
verifica('il sabato si conta, la domenica no', scadenzaRegistrazione('2026-09-18') === '2026-09-30', scadenzaRegistrazione('2026-09-18'));
verifica('da una domenica si comincia a contare dal lunedi', scadenzaRegistrazione('2026-09-20') === '2026-10-01', scadenzaRegistrazione('2026-09-20'));
verifica('il termine non cade mai di domenica', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
  .every(g => !eDaNonContare(scadenzaRegistrazione(`2026-09-${String(g + 1).padStart(2, '0')}`))));
verifica('senza la data di partenza non c\'e\' termine', scadenzaRegistrazione('') === '' && scadenzaRegistrazione(null) === '' && termineDi('', 'report') === null);
verifica('il numero di giorni si puo\' cambiare in un posto solo', GIORNI_TERMINE_REGISTRAZIONE === 10 && scadenzaRegistrazione('2026-09-14', 1) === '2026-09-15');

verifica('i giorni utili saltano la domenica', giorniUtili('2026-09-25', '2026-09-30') === 4, String(giorniUtili('2026-09-25', '2026-09-30')));
verifica('all\'indietro vengono negativi', giorniUtili('2026-09-30', '2026-09-25') === -4, String(giorniUtili('2026-09-30', '2026-09-25')));
verifica('fra lo stesso giorno e se stesso sono zero', giorniUtili('2026-09-25', '2026-09-25') === 0);
verifica('senza una delle due date, null', giorniUtili('2026-09-25', '') === null && giorniUtili('', '2026-09-25') === null);

verifica('il 30/09 un termine del 25/09 e\' scaduto da 4 giorni utili', JSON.stringify(statoTermine('2026-09-25', '2026-09-30')) === JSON.stringify({ stato: 'scaduto', giorni: 4 }), JSON.stringify(statoTermine('2026-09-25', '2026-09-30')));
verifica('il giorno della scadenza e\' l\'ultimo utile, non un ritardo', JSON.stringify(statoTermine('2026-09-25', '2026-09-25')) === JSON.stringify({ stato: 'in_scadenza', giorni: 0 }));
verifica('tre giorni prima si avvisa', statoTermine('2026-09-25', '2026-09-22').stato === 'in_scadenza');
verifica('quindici giorni prima no', statoTermine('2026-09-25', '2026-09-10').stato === 'nei_termini', JSON.stringify(statoTermine('2026-09-25', '2026-09-10')));
verifica('senza termine non si giudica', statoTermine('', '2026-09-30') === null && statoTermine('2026-09-25', '') === null);

verifica('il testo dice il giorno e da quanto', /scaduto il 25\/09\/2026, da 4 giorni utili/.test(testoTermine('2026-09-25', '2026-09-30')), testoTermine('2026-09-25', '2026-09-30'));
verifica('l\'ultimo giorno utile si dice che e\' oggi', /ultimo giorno utile per registrarlo: oggi/.test(testoTermine('2026-09-25', '2026-09-25')), testoTermine('2026-09-25', '2026-09-25'));
verifica('il testo che resta scritto non invecchia: solo la data', testoScadenza('2026-09-25') === 'termine di registrazione: 25/09/2026', testoScadenza('2026-09-25'));
const tArrivo = termineDi('2026-09-14', 'report_arrivo');
verifica('contando dall\'arrivo lo dice, perche\' il termine vero scade prima', /data dell'arrivo/.test(testoConteggio(tArrivo))
  && /10 giorni dalla partenza del 14\/09\/2026/.test(testoConteggio(tArrivo)) && /domeniche escluse/.test(testoConteggio(tArrivo)), testoConteggio(tArrivo));
verifica('contando dalla partenza vera non aggiunge niente', !/arrivo/.test(testoConteggio(termineDi('2026-09-14', 'report'))));

// === il caso di Nappi Sud ===
const archivio = (righe) => ({ list: async () => righe, filter: async () => righe });
const base44 = (dati) => ({ asServiceRole: { entities: {
  PrimariaRete: archivio(dati.rete || []), PrimariaAci: archivio(dati.aci || []), Secondaria: archivio(dati.secondarie || []),
  ExtraRaccolta: archivio(dati.extra || []), Fornitore: archivio([]),
} } });

const STOCCAGGIO = 'NAPPI SUD SRL';
const secondaria = (id, fir, kg, campi = {}) => ({
  id, id_ordine: id, numero_fir: fir, stato: 'terminato', peso_effettivo: kg, stoccaggio: STOCCAGGIO, destinazione: 'IRIGOM SRL',
  trasportatore: 'TRANSAR SRL', ordine_immesso_il: '2026-09-20T08:00:00Z',
  trasporto_iniziato_il: '2026-09-22T06:00:00Z', trasporto_finito_il: '2026-09-23T09:00:00Z', ...campi,
});

// Nel gestionale c'e' solo il carico della settimana 39. Quello del 14 settembre
// non e' mai stato caricato a portale: e' proprio il fatto da cui nasce tutto.
const dati = await caricaMovimenti(base44({ secondarie: [
  secondaria('SEC39', 'RGYTR000039AA', 12000),
  // un carico di luglio, lontanissimo dalla settimana verificata, ma registrato
  secondaria('SEC28', 'RGYTR000028AA', 9000, { trasporto_iniziato_il: '2026-07-09T06:00:00Z', trasporto_finito_il: '2026-07-10T09:00:00Z' }),
] }));
const settimana39 = { chiave: 'nappi sud', nome: STOCCAGGIO, inizio: '2026-09-21', fine: '2026-09-27', senzaFine: dati.senza_fine };

const { righe } = normalizzaRigheReport([
  { n: 2, fir: 'RGYTR000039AA', peso: 12000, data_fine: '23/09/2026' },
  // la riga comparsa in ritardo: del 14 settembre, e nel gestionale non c'e'
  { n: 3, fir: 'HTQKS004521ZT', peso: 7400, data_fine: '14/09/2026' },
], 'kg');
const esito = verificaReport(righe, dati.movimenti, settimana39);
const arretrata = esito.esiti.find(e => e.n === 3);

console.log('\nLA RIGA DI UNA SETTIMANA PRECEDENTE CHE NEL GESTIONALE NON C\'E\'');
verifica('non si scarta piu\': prima finiva fra le righe non considerate', esito.escluse.length === 0 && !!arretrata, JSON.stringify(esito.escluse));
verifica('e\' un\'anomalia, e dice che il formulario non e\' registrato', arretrata && arretrata.esito === 'non_trovata' && arretrata.anomalia === true
  && (arretrata.discrepanze || []).some(d => d.gravita === 'anomalia' && /non presente nel gestionale/.test(d.messaggio)), JSON.stringify(arretrata && arretrata.discrepanze));
verifica('dice a quale settimana appartiene, e che e\' precedente', arretrata && arretrata.fuori_settimana
  && arretrata.fuori_settimana.settimana === 38 && arretrata.fuori_settimana.anno === 2026 && arretrata.fuori_settimana.arretrata === true,
JSON.stringify(arretrata && arretrata.fuori_settimana));
verifica('porta il termine: entro il 25/09/2026, contato dal 14/09', arretrata && arretrata.termine && arretrata.termine.scadenza === '2026-09-25'
  && arretrata.termine.partenza === '2026-09-14' && arretrata.termine.partenza_da === 'report_arrivo', JSON.stringify(arretrata && arretrata.termine));
verifica('e lo scrive nel messaggio, con la settimana e il conteggio', arretrata
  && /settimana 38/.test(arretrata.discrepanze[0].messaggio)
  && /entro il 25\/09\/2026/.test(arretrata.discrepanze[0].messaggio)
  && /domeniche escluse/.test(arretrata.discrepanze[0].messaggio), arretrata && arretrata.discrepanze[0].messaggio);
verifica('il riepilogo la conta fra gli arretrati da registrare', esito.riepilogo.fuori_settimana === 1
  && esito.riepilogo.arretrati_da_registrare === 1 && esito.riepilogo.settimane_arretrate === '38', JSON.stringify({
  f: esito.riepilogo.fuori_settimana, a: esito.riepilogo.arretrati_da_registrare, s: esito.riepilogo.settimane_arretrate,
}));
verifica('la verifica NON esce conforme: e\' il punto di tutto', esito.riepilogo.conformita === 'parziale', esito.riepilogo.conformita);

// La quadratura della settimana resta quella della settimana: un movimento si
// colloca sulla fine del trasporto (regola 1). Se la riga arretrata entrasse
// qui, un report che quadra uscirebbe come se non quadrasse.
const q = esito.quadratura.find(x => x.chiave === 'secondaria-uscita-rete');
verifica('la quadratura della settimana 39 resta pulita: un formulario, i suoi chili', q && q.formulari_report === 1
  && q.formulari_gestionale === 1 && q.kg_report === 12000 && q.kg_gestionale === 12000, JSON.stringify(q));
const nonRegistrati = esito.quadratura.find(x => x.chiave === 'non_registrati');
verifica('e nemmeno fra i non registrati della settimana', nonRegistrati && nonRegistrati.formulari_report === 0, JSON.stringify(nonRegistrati));

console.log('\nUN FORMULARIO REGISTRATO LONTANO DALLA SETTIMANA SI TROVA');
const { righe: righeLuglio } = normalizzaRigheReport([
  { n: 2, fir: 'RGYTR000039AA', peso: 12000, data_fine: '23/09/2026' },
  { n: 4, fir: 'RGYTR000028AA', peso: 9000, data_fine: '10/07/2026' },
], 'kg');
const esitoLuglio = verificaReport(righeLuglio, dati.movimenti, settimana39);
const luglio = esitoLuglio.esiti.find(e => e.n === 4);
// Fuori dalla fascia di giorni intorno alla settimana il formulario non si
// cercava, e di un carico registrato si diceva "non presente nel gestionale":
// una bugia, e la piu' facile da credere.
verifica('non si dice che non c\'e\' un formulario che c\'e\'', luglio && luglio.esito !== 'non_trovata'
  && !!luglio.gestionale && luglio.gestionale.fir === 'RGYTR000028AA', JSON.stringify(luglio && { esito: luglio.esito, g: luglio.gestionale && luglio.gestionale.fir }));
verifica('si dice di che settimana e\', senza farne un\'anomalia', luglio && luglio.fuori_settimana && luglio.fuori_settimana.settimana === 28
  && luglio.fuori_settimana.arretrata === true && !luglio.anomalia
  && (luglio.discrepanze || []).some(d => d.gravita === 'osservazione' && /Carico della settimana 28/.test(d.messaggio)),
JSON.stringify(luglio && { f: luglio.fuori_settimana, a: luglio.anomalia, d: luglio.discrepanze }));
verifica('niente da registrare: e\' registrato', esitoLuglio.riepilogo.arretrati_da_registrare === 0
  && esitoLuglio.riepilogo.fuori_settimana === 1 && esitoLuglio.riepilogo.settimane_arretrate === '28', JSON.stringify(esitoLuglio.riepilogo.settimane_arretrate));
verifica('e la verifica resta conforme: un report cumulativo non diventa parziale', esitoLuglio.riepilogo.conformita === 'piena', esitoLuglio.riepilogo.conformita);

console.log('\nIL TERMINE VALE ANCHE NELLA SETTIMANA VERIFICATA');
const { righe: righeSettimana } = normalizzaRigheReport([
  { n: 2, fir: 'HTQKS004999ZT', peso: 5000, data_inizio: '22/09/2026', data_fine: '23/09/2026' },
], 'kg');
const esitoSettimana = verificaReport(righeSettimana, dati.movimenti, settimana39);
const dentro = esitoSettimana.esiti[0];
// Un formulario non registrato della settimana in corso non e' arretrato, ma il
// termine corre uguale: con due colonne di data si conta dalla partenza vera.
verifica('un non registrato della settimana ha il termine ma non e\' arretrato', dentro && dentro.esito === 'non_trovata'
  && !dentro.fuori_settimana && dentro.termine && dentro.termine.partenza === '2026-09-22' && dentro.termine.partenza_da === 'report'
  && dentro.termine.scadenza === '2026-10-03', JSON.stringify(dentro && { f: dentro.fuori_settimana, t: dentro.termine }));
verifica('e il riepilogo non lo conta fra gli arretrati', esitoSettimana.riepilogo.fuori_settimana === 0
  && esitoSettimana.riepilogo.arretrati_da_registrare === 0, JSON.stringify(esitoSettimana.riepilogo.arretrati_da_registrare));

console.log('\nL\'ALERT: PERCHE\' NON RESTI SCRITTO IN FONDO A UNA SCHEDA');
verifica('l\'arretrato non registrato si segnala sempre', arretratiDaSegnalare(esito, '2026-09-29').length === 1, String(arretratiDaSegnalare(esito, '2026-09-29').length));
verifica('anche il giorno dopo la partenza, perche\' la sua settimana e\' passata', arretratiDaSegnalare(esito, '2026-09-15').length === 1);
verifica('un non registrato della settimana, col termine lontano, non si segnala', arretratiDaSegnalare(esitoSettimana, '2026-09-24').length === 0,
  JSON.stringify(arretratiDaSegnalare(esitoSettimana, '2026-09-24')));
verifica('ma si segnala quando il termine sta scadendo', arretratiDaSegnalare(esitoSettimana, '2026-10-01').length === 1);
verifica('un carico registrato non si segnala mai', arretratiDaSegnalare(esitoLuglio, '2026-09-29').length === 0);

// L'alert vero: si crea, e si chiude da solo quando non c'e' piu' niente da registrare.
const alertScritti = [];
const alertFinti = (aperti) => ({ asServiceRole: { entities: {
  Alert: {
    filter: async () => aperti,
    create: async (d) => { alertScritti.push({ azione: 'create', ...d }); },
    update: async (id, d) => { alertScritti.push({ azione: 'update', id, ...d }); },
  },
  VerificaReport: { update: async () => {} },
  ContenutoEsteso: { deleteMany: async () => {}, filter: async () => [], bulkCreate: async () => {} },
} } });
const finto = alertFinti([]);
const scheda = { id: 'V1', soggetto_nome: STOCCAGGIO, soggetto_chiave: 'nappi sud', anno: 2026, settimana: 39, data_inizio: '2026-09-21', data_fine: '2026-09-27' };
await salvaEsito(finto, scheda, esito);
const creato = alertScritti.find(a => a.regola_id === REGOLA_ARRETRATI);
verifica('l\'alert si crea, critico, nel modulo verifiche', creato && creato.azione === 'create' && creato.severita === 'critico'
  && creato.modulo === 'verifiche' && creato.quanti === 1, JSON.stringify(creato && { s: creato.severita, m: creato.modulo, q: creato.quanti }));
verifica('il titolo dice il fornitore e la settimana del report', creato && /NAPPI SUD SRL/.test(creato.titolo) && /settimana 39/.test(creato.titolo), creato && creato.titolo);
verifica('la descrizione dice che il report della settimana 38 non lo conteneva', creato
  && /settimana precedente \(la 38\)/.test(creato.descrizione) && /HTQKS004521ZT/.test(creato.descrizione)
  && /termine di registrazione: 25\/09\/2026/.test(creato.descrizione), creato && creato.descrizione);
verifica('e avverte che il termine e\' contato dall\'arrivo', creato && /quello vero scade prima/.test(creato.descrizione));
verifica('nel testo non c\'e\' niente che invecchi: nessun "da N giorni"', creato && !/da \d+ giorni utili/.test(creato.descrizione), creato && creato.descrizione);

alertScritti.length = 0;
const conAperto = alertFinti([{ id: 'A1' }]);
await salvaEsito(conAperto, scheda, esitoLuglio);
// Il finto archivio restituisce lo stesso alert aperto a tutte le regole, quindi
// qui si cerca la chiusura di questa: l'altra e' quella della dichiarazione.
const chiuso = alertScritti.find(a => a.id === 'A1' && /non restano formulari da registrare/.test(a.risolto_note || ''));
verifica('quando non resta niente da registrare l\'alert si chiude da solo', !!chiuso && chiuso.stato === 'risolto',
  JSON.stringify(alertScritti.map(a => a.risolto_note || a.titolo)));

// Lo specchio delle pagine: la scheda, il PDF e l'Excel leggono da qui, e se la
// sintesi non vedesse gli arretrati il gestionale li saprebbe senza dirli.
console.log('\nLA SINTESI CHE LEGGONO LA SCHEDA, IL PDF E L\'EXCEL');
const sorgente = readFileSync(new URL('../src/lib/verifiche.js', import.meta.url), 'utf8')
  .replace("import { formatTonnellate, formatKg, formatIntero, dataServer } from '@/lib/utils';",
    'const formatTonnellate = (x) => String(x); const formatKg = (x) => String(x); const formatIntero = (x) => String(x); const dataServer = (x) => x;')
  .replace("import { statoTermine, testoTermine } from '@/lib/termineRegistrazione';",
    `import { statoTermine, testoTermine } from ${JSON.stringify(new URL('../src/lib/termineRegistrazione.js', import.meta.url).href)};`);
const pagine = await import('data:text/javascript;base64,' + Buffer.from(sorgente).toString('base64'));
const s = pagine.sintesiVerifica({ file_tipo: 'excel' }, esito);
verifica('la sintesi tira fuori la riga arretrata da registrare', s.fuoriSettimana.length === 1 && s.arretratiDaRegistrare.length === 1
  && s.arretratiDaRegistrare[0].settimana === 38 && s.arretratiDaRegistrare[0].arretrata === true,
JSON.stringify({ f: s.fuoriSettimana.length, a: s.arretratiDaRegistrare.length }));
verifica('e dice in parole come sta il termine, calcolato oggi', /termine/.test(s.arretratiDaRegistrare[0].testoTermine)
  && !!s.arretratiDaRegistrare[0].stato, s.arretratiDaRegistrare[0].testoTermine);
verifica('la verifica non e\' "tutto a posto"', s.piena === false, JSON.stringify({ piena: s.piena, perCanale: s.perCanale }));
const controllo = s.controlli.find(c => /settimane precedenti/.test(c.nome));
verifica('fra i controlli eseguiti ce n\'e\' uno per gli arretrati, non superato', controllo && controllo.ok === false && controllo.n === 1, JSON.stringify(controllo));
verifica('e uno per i termini superati', s.controlli.some(c => /Termini di registrazione superati/.test(c.nome)));
const sLuglio = pagine.sintesiVerifica({ file_tipo: 'excel' }, esitoLuglio);
verifica('un carico di luglio registrato non diventa un arretrato da registrare', sLuglio.fuoriSettimana.length === 1
  && sLuglio.arretratiDaRegistrare.length === 0 && sLuglio.oltreIlTermine.length === 0, JSON.stringify(sLuglio.arretratiDaRegistrare));
verifica('le settimane si dicono in italiano', pagine.settimaneDi([{ settimana: 38 }]) === 'alla settimana 38'
  && pagine.settimaneDi([{ settimana: 37 }, { settimana: 38 }, { settimana: 28 }]) === 'alle settimane 28, 37 e 38',
pagine.settimaneDi([{ settimana: 37 }, { settimana: 38 }, { settimana: 28 }]));
verifica('dal registro di carico e scarico si prendono anche i trenta giorni prima', pagine.GIORNI_ARRETRATI_DAL_REGISTRO === 30);

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
