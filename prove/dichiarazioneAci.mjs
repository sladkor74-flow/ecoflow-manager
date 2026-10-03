// LE DICHIARAZIONI ACI LETTE DAL DOCUMENTO: I CONTROLLI CHE LE RENDONO GUARDABILI.
//
// Ogni mese gli impianti mandano via email la dichiarazione ACI di ogni
// conferimento e l'utente la gira al consorzio. Il gestionale le legge e PROPONE i
// quattro numeri della scheda del mese; non li salva. Perche' una proposta si
// possa guardare senza rifare il lavoro a mano servono due prove che il documento
// porta con se', e sono quelle che questa prova difende:
//
//   1. i tre materiali fanno la quantita' lavorata, AL CHILO;
//   2. i documenti di un impianto in un mese si sommano, e il totale torna col
//      conferito che il gestionale gia' conosce.
//
// I NUMERI QUI SOTTO SONO VERI, letti sui ventitre PDF del 2026 in
// ECOTYRE\2026\ACI\DICHIARAZIONI: quattro impianti e tre impaginazioni diverse. Se
// una di queste verifiche cade, la lettura automatica non e' piu' affidabile e
// l'utente deve tornare a trascrivere a mano.
//
// Niente rete: si prova la logica pura, mai il modello.
// npm run prove
import {
  controllaLettura, unisciLetture, riscontroConferito, periodoLettura, ticketAci, stessoImpianto, SCHEMA_LETTURA, numeroKg,
} from '../base44/shared/dichiarazioneAci.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// ---------------------------------------------------------------------------
// I DOCUMENTI VERI, come il modello li restituisce.

// GATIM, giugno 2026: tre documenti, modello "Attestazione di avvenuto Recupero".
const GATIM_1 = {
  file: '162529-54.pdf', impianto: 'GATIM SRL', mese: '', anno: null,
  quantita_kg: 3930, polverino_granulo_kg: 1970, fibre_kg: 590, metalli_kg: 1370, scarto_kg: 0,
  peso_fir_kg: 3930, ordine: '', formulario: 'HTQKS000856WL', ticket_aci: ['162529 - 54'],
  produttore: 'AUTOSERVICE DI F. CATALDO', cer: '160103',
  data_servizio: '2026-06-01', data_conferimento: '2026-06-01', data_trattamento: '2026-06-26',
  granulometria: 'da 0,0 a 4,0', note: '',
};
const GATIM_2 = {
  file: '162689-20.pdf', impianto: 'GATIM SRL',
  quantita_kg: 5490, polverino_granulo_kg: 2750, fibre_kg: 820, metalli_kg: 1920,
  peso_fir_kg: 5490, formulario: 'HTQKS000870ZH', ticket_aci: ['162689 - 20'],
  produttore: 'MUTO FERNANDO A.', cer: '160103',
  data_servizio: '2026-06-04', data_conferimento: '2026-06-04', data_trattamento: '2026-06-26',
};
const GATIM_3 = {
  file: '163170-16.pdf', impianto: 'GATIM SRL',
  quantita_kg: 1920, polverino_granulo_kg: 960, fibre_kg: 290, metalli_kg: 670,
  peso_fir_kg: 1920, formulario: 'HTQKS000932SN', ticket_aci: ['163170 - 16'],
  produttore: 'SA.LI ANT. SERVIZ', cer: '160103',
  data_servizio: '2026-06-26', data_conferimento: '2026-06-26', data_trattamento: '2026-06-26',
};
// GATIM, gennaio e aprile: un formulario solo e quattro (o tre) ticket ACI.
const GATIM_GENNAIO = {
  file: '158765-73;159165-85;159325-51;159349-75;.pdf', impianto: 'GATIM SRL',
  quantita_kg: 12280, polverino_granulo_kg: 7370, fibre_kg: 1840, metalli_kg: 3070,
  peso_fir_kg: 12280, ordine: 'SEC26019148', formulario: 'CNDJM000218LZ',
  ticket_aci: ['158765 - 73;159165 - 85; 159325 - 51;159349 - 75;'],
  produttore: 'IRIGOM SRL', cer: '160103',
  data_servizio: '2026-01-31', data_conferimento: '2026-01-31', data_trattamento: '2026-02-02',
};
const GATIM_APRILE = {
  file: '160278-34; 160620-85;.pdf', impianto: 'GATIM SRL',
  quantita_kg: 14340, polverino_granulo_kg: 8600, fibre_kg: 1720, metalli_kg: 4020,
  peso_fir_kg: 14340, formulario: 'CNDJM000260RQ',
  ticket_aci: ['160278 - 34; 160620 - 85 ; 161240 - 26;'],
  produttore: 'IRIGOM SRL', cer: '160103',
  data_servizio: '2026-04-01', data_conferimento: '2026-04-01', data_trattamento: '2026-05-04',
};

// T.R.S., luglio 2026: stesso modello di GATIM, quattro ticket scritti di fila con
// lo stesso trattino che separa le cifre.
const TRS_LUGLIO = {
  file: 'Dichiarazione ACI TRS - Luglio 2026.pdf', impianto: 'T .R.S. Tyres Recycling Sud srl',
  quantita_kg: 13640, polverino_granulo_kg: 9548, fibre_kg: 1364, metalli_kg: 2728,
  peso_fir_kg: 13640, ordine: 'SEC26125682', formulario: 'CNDJM000335YS',
  ticket_aci: ['162611 - 39 - 163144 - 87 - 163954 - 24 - 163516 - 71'],
  produttore: 'IRIGOM SRL', cer: '160103',
  data_servizio: '2026-07-23', data_conferimento: '2026-07-23', data_trattamento: '2026-07-27',
  granulometria: '0 - 0.8 /0.8 - 2.5/ 1 - 4',
};

// TECNOGUM, giugno 2026: tre documenti. La quantita' lavorata e' il peso
// riscontrato in ingresso (1.400), non il "Totale MPS prodotte" (1.260), che e' la
// sola gomma; il polverino e il granulo sono due caselle e si sommano.
const TECNOGUM_1 = {
  file: 'SEC26093023.pdf', impianto: 'TECNOGUM SRL',
  quantita_kg: 1400, polverino_granulo_kg: 1260, fibre_kg: 70, metalli_kg: 70,
  peso_fir_kg: 1400, ordine: 'SEC26093023', formulario: 'WTCVP001215XQ', ticket_aci: ['162399-21'],
  cer: '160103', data_conferimento: '2026-06-04', data_trattamento: '2026-06-23',
};
const TECNOGUM_2 = {
  file: 'SEC26098849.pdf', impianto: 'TECNOGUM SRL',
  quantita_kg: 2620, polverino_granulo_kg: 2360, fibre_kg: 130, metalli_kg: 130,
  peso_fir_kg: 2620, ordine: 'SEC26098849', formulario: 'WTCVP001323JD', ticket_aci: ['162832-66'],
  cer: '160103', data_conferimento: '2026-06-12', data_trattamento: '2026-06-25',
};
const TECNOGUM_3 = {
  file: 'SEC26104994.pdf', impianto: 'TECNOGUM SRL',
  quantita_kg: 3460, polverino_granulo_kg: 3120, fibre_kg: 170, metalli_kg: 170,
  peso_fir_kg: 3460, ordine: 'SEC26104994', formulario: 'WTCVP001415XL',
  ticket_aci: ['162684-15 , 163142-85'],
  cer: '160103', data_conferimento: '2026-06-22', data_trattamento: '2026-06-26',
};

// GREEN TYRE PROJECT: una lettera, che il mese lo scrive a parole.
const GTP_LUGLIO = {
  file: 'CERTIFICAZIONE ACI - LUGLIO 2026.pdf', impianto: 'GREEN TYRE PROJECT SRL',
  mese: 'LUGLIO', anno: 2026,
  quantita_kg: 2640, polverino_granulo_kg: 2140, fibre_kg: 200, metalli_kg: 300, scarto_kg: 0,
  peso_fir_kg: 2640, ordine: 'ET26116796', formulario: 'PHHYQ002515DW', ticket_aci: ['163676-37'],
  produttore: "D'ALIA SALVATORE", cer: '16.01.03',
  data_servizio: '13/07/26', data_conferimento: '13/07/26',
};
const GTP_MAGGIO = {
  file: 'CERTIFICAZIONE ACI - Maggio 2026.pdf', impianto: 'GREEN TYRE PROJECT SRL',
  mese: 'MAGGIO', anno: 2026,
  quantita_kg: 2680, polverino_granulo_kg: 1900, fibre_kg: 320, metalli_kg: 460, scarto_kg: 0,
  peso_fir_kg: 2680, ordine: 'ET26072199', formulario: 'PHHYQ002063ZW', ticket_aci: ['161959-66'],
  produttore: '3S Autodemolizione Srl', cer: '16.01.03',
  data_servizio: '04/05/26', data_conferimento: '04/05/26',
};

const VERI = [GATIM_1, GATIM_2, GATIM_3, GATIM_GENNAIO, GATIM_APRILE, TRS_LUGLIO, TECNOGUM_1, TECNOGUM_2, TECNOGUM_3, GTP_LUGLIO, GTP_MAGGIO];

// ---------------------------------------------------------------------------

console.log('I TRE MATERIALI FANNO LA QUANTITA\', SU TUTTI E QUATTRO GLI IMPIANTI');
for (const d of VERI) {
  const esito = controllaLettura(d);
  verifica(`${d.file} passa i controlli senza problemi`, esito.ok, JSON.stringify(esito.problemi));
  const somma = d.polverino_granulo_kg + d.fibre_kg + d.metalli_kg + (d.scarto_kg || 0);
  verifica(`${d.file}: ${d.polverino_granulo_kg} + ${d.fibre_kg} + ${d.metalli_kg} = ${d.quantita_kg}`, somma === d.quantita_kg, String(somma));
}
verifica('lo schema chiede i quattro pesi, il formulario e la data di conferimento',
  ['impianto', 'quantita_kg', 'polverino_granulo_kg', 'fibre_kg', 'metalli_kg', 'formulario', 'data_conferimento']
    .every(c => SCHEMA_LETTURA.required.includes(c)), JSON.stringify(SCHEMA_LETTURA.required));
// Il modello puo' rispondere col punto delle migliaia, com'e' stampato sul
// documento: "1.370" sono 1370 kg, non 1,37.
const conPunti = controllaLettura({ ...GATIM_1, quantita_kg: '3.930', polverino_granulo_kg: '1.970', fibre_kg: '590', metalli_kg: '1.370' });
verifica('i pesi scritti col punto delle migliaia si leggono in chili', conPunti.ok, JSON.stringify(conPunti.problemi));

// ---------------------------------------------------------------------------

console.log('UNA LETTURA STORTA SI RESPINGE, E DICE DOVE GUARDARE');
// La trappola vera: un 3 letto come 8 nei metalli di Gatim. La quantita' resta
// giusta, i materiali no, e senza questo controllo quei 500 kg in piu' sarebbero
// finiti nella scheda del mese senza che nulla lo facesse vedere.
const storta = controllaLettura({ ...GATIM_1, metalli_kg: 1870 });
verifica('i materiali che non fanno la quantita\' fermano la lettura', !storta.ok && storta.problemi.length === 1, JSON.stringify(storta.problemi));
verifica('e il problema e\' leggibile: dice la somma, la quantita\' e la differenza',
  /non fanno la quantità/.test(storta.problemi[0]) && /4\.430/.test(storta.problemi[0])
  && /3\.930/.test(storta.problemi[0]) && /500 kg di differenza/.test(storta.problemi[0]), storta.problemi[0]);
verifica('e dice che su queste dichiarazioni la somma torna sempre, quindi si rilegge',
  /al chilo/.test(storta.problemi[0]) && /letto male/.test(storta.problemi[0]), storta.problemi[0]);

const zero = controllaLettura({ ...GATIM_1, quantita_kg: 0 });
verifica('la quantita\' a zero si respinge', !zero.ok && zero.problemi.some(p => /risulta zero/.test(p)), JSON.stringify(zero.problemi));
const negativa = controllaLettura({ ...GATIM_1, metalli_kg: -1370 });
verifica('un peso negativo si respinge e si nomina',
  !negativa.ok && negativa.problemi.some(p => /negativo/.test(p) && /metalli ferrosi/.test(p)), JSON.stringify(negativa.problemi));
const senzaImpianto = controllaLettura({ ...GATIM_1, impianto: '  ' });
verifica('senza l\'impianto si respinge', !senzaImpianto.ok && senzaImpianto.problemi.some(p => /quale impianto/.test(p)), JSON.stringify(senzaImpianto.problemi));
const senzaMese = controllaLettura({ ...GATIM_1, data_conferimento: '', data_servizio: '' });
verifica('senza la data di conferimento non si sa il mese, e si respinge',
  !senzaMese.ok && senzaMese.problemi.some(p => /di che mese/.test(p)), JSON.stringify(senzaMese.problemi));
const vuota = controllaLettura(null);
verifica('una lettura che non e\' arrivata si dice', !vuota.ok && vuota.problemi.length === 1, JSON.stringify(vuota.problemi));

// ---------------------------------------------------------------------------

console.log('IL MESE VIENE DALLA DATA DI CONFERIMENTO, NON DA QUELLA DELLA LETTERA');
// Tecnogum firma il 18/07 un conferimento del 04/06: il mese e' giugno, cioe' la
// fine del trasporto. E' la prima delle tre regole del gestionale.
verifica('Tecnogum: il conferimento del 04/06 e\' di giugno, anche se la lettera e\' del 18/07',
  periodoLettura(TECNOGUM_1).mese === 'Giugno' && periodoLettura(TECNOGUM_1).anno === 2026
  && periodoLettura(TECNOGUM_1).da === 'conferimento', JSON.stringify(periodoLettura(TECNOGUM_1)));
verifica('Green Tyre scrive il mese a parole e la data lo conferma',
  periodoLettura(GTP_LUGLIO).mese === 'Luglio' && periodoLettura(GTP_LUGLIO).da === 'conferimento'
  && periodoLettura(GTP_LUGLIO).contrasto === false, JSON.stringify(periodoLettura(GTP_LUGLIO)));
// Se il mese scritto e la data si contraddicono, una delle due letture e'
// sbagliata: non si sceglie, si rilegge.
const contrasto = controllaLettura({ ...GTP_LUGLIO, data_conferimento: '13/06/26', data_servizio: '13/06/26' });
verifica('un mese scritto che contraddice la data di conferimento fa rileggere',
  !contrasto.ok && contrasto.problemi.some(p => /non è quello della data di conferimento/.test(p) && /Luglio 2026/.test(p) && /Giugno/.test(p)),
  JSON.stringify(contrasto.problemi));
verifica('senza la data vale il mese scritto, ed e\' l\'ultimo ripiego',
  periodoLettura({ mese: 'LUGLIO', anno: 2026 }).mese === 'Luglio'
  && periodoLettura({ mese: 'LUGLIO', anno: 2026 }).da === 'scritto', JSON.stringify(periodoLettura({ mese: 'LUGLIO', anno: 2026 })));

// ---------------------------------------------------------------------------

console.log('I TICKET ACI: UNO, DUE O QUATTRO SU UN SOLO DOCUMENTO');
verifica('T.R.S. scrive quattro ticket di fila con lo stesso trattino delle cifre',
  ticketAci(TRS_LUGLIO.ticket_aci).join(' ') === '162611-39 163144-87 163954-24 163516-71', JSON.stringify(ticketAci(TRS_LUGLIO.ticket_aci)));
verifica('Gatim li separa con i punti e virgola',
  ticketAci(GATIM_GENNAIO.ticket_aci).join(' ') === '158765-73 159165-85 159325-51 159349-75', JSON.stringify(ticketAci(GATIM_GENNAIO.ticket_aci)));
verifica('Tecnogum ne scrive due separati da una virgola',
  ticketAci(TECNOGUM_3.ticket_aci).join(' ') === '162684-15 163142-85', JSON.stringify(ticketAci(TECNOGUM_3.ticket_aci)));
verifica('gli spazi intorno al trattino non contano', ticketAci('162529 - 54').join() === '162529-54');
// Il CER e' sei cifre come un ticket: senza il guardiano sulle cifre ai lati
// finirebbe fra i ticket, e con lui no.
verifica('il CER 160103 non e\' un ticket', ticketAci('160103 3.930 162529 - 54').join() === '162529-54', JSON.stringify(ticketAci('160103 3.930 162529 - 54')));
verifica('una partita IVA non e\' un ticket', ticketAci('02015210798').length === 0);
verifica('un ticket ripetuto si elenca una volta sola', ticketAci(['162399-21', '162399 - 21']).join() === '162399-21');

// ---------------------------------------------------------------------------

console.log('I TRE DOCUMENTI DI GATIM DI GIUGNO FANNO IL MESE');
const giugnoGatim = unisciLetture([GATIM_1, GATIM_2, GATIM_3]);
verifica('3.930 + 5.490 + 1.920 = 11.340 kg', giugnoGatim.quantita_kg === 11340, String(giugnoGatim.quantita_kg));
verifica('e i materiali si sommano per voce: 5.680 polverino, 1.700 fibre, 3.960 metalli',
  giugnoGatim.polverino_granulo_kg === 5680 && giugnoGatim.fibre_kg === 1700 && giugnoGatim.metalli_kg === 3960, JSON.stringify(giugnoGatim));
verifica('anche nel totale i materiali fanno la quantita\'', giugnoGatim.somma_materiali_kg === giugnoGatim.quantita_kg, String(giugnoGatim.somma_materiali_kg));
verifica('il mese e l\'impianto escono dai documenti, senza che nessuno li scriva',
  giugnoGatim.mese === 'Giugno' && giugnoGatim.anno === 2026 && giugnoGatim.impianto === 'GATIM SRL', JSON.stringify([giugnoGatim.mese, giugnoGatim.anno, giugnoGatim.impianto]));
verifica('nessun problema, e un gruppo solo', giugnoGatim.problemi.length === 0 && giugnoGatim.gruppi.length === 1, JSON.stringify(giugnoGatim.problemi));
verifica('i tre documenti restano in elenco, ognuno col suo formulario e il suo peso',
  giugnoGatim.documenti.length === 3 && giugnoGatim.documenti.every(d => d.quadra)
  && giugnoGatim.documenti.map(d => d.formulario).join() === 'HTQKS000856WL,HTQKS000870ZH,HTQKS000932SN', JSON.stringify(giugnoGatim.documenti.map(d => [d.file, d.formulario, d.quantita_kg])));
verifica('e i ticket dei tre stanno insieme, senza doppioni',
  giugnoGatim.ticket_aci.join(' ') === '162529-54 162689-20 163170-16', JSON.stringify(giugnoGatim.ticket_aci));

const giugnoTecnogum = unisciLetture([TECNOGUM_1, TECNOGUM_2, TECNOGUM_3]);
verifica('Tecnogum giugno: 1.400 + 2.620 + 3.460 = 7.480 kg',
  giugnoTecnogum.quantita_kg === 7480 && giugnoTecnogum.mese === 'Giugno' && giugnoTecnogum.problemi.length === 0, JSON.stringify(giugnoTecnogum.problemi));
verifica('e i quattro ticket dei suoi tre documenti stanno tutti nell\'elenco',
  giugnoTecnogum.ticket_aci.join(' ') === '162399-21 162832-66 162684-15 163142-85', JSON.stringify(giugnoTecnogum.ticket_aci));

const luglioTrs = unisciLetture([TRS_LUGLIO]);
verifica('un documento solo fa il mese da se\': T.R.S. luglio 13.640 kg',
  luglioTrs.quantita_kg === 13640 && luglioTrs.mese === 'Luglio' && luglioTrs.problemi.length === 0, JSON.stringify(luglioTrs.problemi));

// ---------------------------------------------------------------------------

console.log('MESI O IMPIANTI DIVERSI NON SI SOMMANO, E LO DICONO');
// Un totale che mescola due mesi sarebbe plausibile e falso, e finirebbe nella
// scheda di uno dei due: meglio zero e una frase che dice come sono divisi.
const dueMesi = unisciLetture([GTP_LUGLIO, GTP_MAGGIO]);
verifica('due mesi dello stesso impianto non si sommano', dueMesi.quantita_kg === 0 && dueMesi.gruppi.length === 2, JSON.stringify([dueMesi.quantita_kg, dueMesi.gruppi.length]));
verifica('e si dice quali sono i gruppi, coi nomi dei file',
  dueMesi.problemi.some(p => /non sono stati sommati/.test(p) && /Luglio 2026/.test(p) && /Maggio 2026/.test(p)
    && p.includes('CERTIFICAZIONE ACI - LUGLIO 2026.pdf')), JSON.stringify(dueMesi.problemi));
verifica('i documenti restano comunque in elenco, ognuno col suo mese',
  dueMesi.documenti.length === 2 && dueMesi.documenti.map(d => d.mese).join() === 'Luglio,Maggio', JSON.stringify(dueMesi.documenti.map(d => d.mese)));
const dueImpianti = unisciLetture([GATIM_1, TECNOGUM_1]);
verifica('due impianti nello stesso mese non si sommano',
  dueImpianti.quantita_kg === 0 && dueImpianti.gruppi.length === 2
  && dueImpianti.problemi.some(p => /GATIM/.test(p) && /TECNOGUM/.test(p)), JSON.stringify(dueImpianti.problemi));
// La stessa ditta si scrive in dieci modi, e un nome diverso non e' di per se' una
// difformita': "T .R.S. Tyres Recycling Sud srl" e "TRS SRL" sono lo stesso impianto.
verifica('lo stesso impianto scritto in due modi resta lo stesso impianto',
  stessoImpianto('T .R.S. Tyres Recycling Sud srl', 'TRS SRL') && stessoImpianto('GATIM SRL', 'Gatim')
  && stessoImpianto('GREEN TYRE PROJECT SRL', 'Green Tyre Project') && stessoImpianto('TECNOGUM SRL', 'Tecnogum'));
verifica('due impianti diversi restano due', !stessoImpianto('GATIM SRL', 'TECNOGUM SRL') && !stessoImpianto('Irigom', 'Gatim'));

// ---------------------------------------------------------------------------

console.log('LO STESSO DOCUMENTO ALLEGATO DUE VOLTE SI CONTA UNA VOLTA SOLA');
// Fra perdere un peso e duplicarlo si sceglie sempre perderlo: duplicare e'
// silenzioso e si porta dietro ogni conto a valle, mancare e' rumoroso e si
// rimedia riallegando il file.
const doppio = unisciLetture([GATIM_1, { ...GATIM_1, file: '162529-54 (1).pdf' }]);
verifica('un documento allegato due volte non raddoppia il peso', doppio.quantita_kg === 3930, String(doppio.quantita_kg));
verifica('il doppione si segna sul documento e si spiega col ticket',
  doppio.documenti[1].doppione === true && doppio.documenti[0].doppione === false
  && doppio.problemi.some(p => /162529-54/.test(p) && /una volta sola/.test(p)), JSON.stringify(doppio.problemi));
// IL TICKET E' LA CHIAVE, NON IL FORMULARIO. Lo stesso PDF letto due volte puo'
// dare l'ordine o il formulario scritti in due modi - basta un carattere - e con
// la chiave sul formulario il mese raddoppiava senza un problema: 24.560 kg al
// posto di 12.280.
const storto = unisciLetture([GATIM_1, { ...GATIM_1, file: '162529-54 (1).pdf', ordine: '003 ' + (GATIM_1.ordine || ''), formulario: 'HTQK5000856WL' }]);
verifica('un doppione con ordine o formulario letti diversamente si prende lo stesso',
  storto.quantita_kg === 3930 && storto.documenti[1].doppione === true, JSON.stringify([storto.quantita_kg, storto.problemi]));
// E un ticket che compare su due documenti che NON sono lo stesso documento si
// dice: o uno e' letto male, o non e' di questo mese.
const ticketMisto = unisciLetture([GATIM_1, { ...GATIM_1, file: 'altro.pdf', formulario: 'ALTRO000001XX', ticket_aci: [...(GATIM_1.ticket_aci || []), '999999-99'] }]);
verifica('un ticket condiviso fra documenti diversi si segnala',
  ticketMisto.problemi.some(p => /compare sia su/.test(p) && /letto male/.test(p)), JSON.stringify(ticketMisto.problemi));
// LO STESSO FORMULARIO SU DUE ORDINI DIVERSI NON E' UN DOPPIONE: e' il carico che
// ha sforato il 10% del peso stimato del primo ticket e che il portale ha
// ripartito su un secondo ordine. I pesi, li', si sommano per davvero. Il caso e'
// quello documentato in AGENTS.md: il formulario RGYTR022620TW del 9 giugno 2026,
// 1.960 kg sull'ordine ET26091175 (ticket 162684-15) e 1.500 su ET26102183 (ticket
// 163142-85), 3.460 kg in tutto. La ripartizione dei materiali qui e' costruita a
// mano sulle proporzioni di Tecnogum: i pesi dei PFU sono quelli veri.
const quota = (kg, ordine, ticket) => ({
  file: `quota ${ordine}.pdf`, impianto: 'TECNOGUM SRL', formulario: 'RGYTR022620TW', ordine,
  quantita_kg: kg, polverino_granulo_kg: Math.round(kg * 0.9), fibre_kg: kg * 0.05, metalli_kg: kg * 0.05,
  ticket_aci: [ticket], data_conferimento: '2026-06-09',
});
const dueQuote = unisciLetture([quota(1960, 'ET26091175', '162684-15'), quota(1500, 'ET26102183', '163142-85')]);
verifica('lo stesso formulario su due ordini diversi si somma: 1.960 + 1.500 = 3.460',
  dueQuote.quantita_kg === 3460 && dueQuote.documenti.every(d => !d.doppione) && dueQuote.problemi.length === 0, JSON.stringify([dueQuote.quantita_kg, dueQuote.problemi]));
verifica('e i due ticket che distinguono le quote si vedono entrambi',
  dueQuote.ticket_aci.join(' ') === '162684-15 163142-85', JSON.stringify(dueQuote.ticket_aci));

// ---------------------------------------------------------------------------

console.log('IL TOTALE DI UN MESE SI RISCONTRA COL CONFERITO DEL GESTIONALE');
// Sull'ACI il dichiarato e' uguale al conferito AL CHILO, in tutte le
// dichiarazioni del 2026: luglio 2026 lo conferma su due impianti.
const trsLuglio = riscontroConferito(13640, 13640);
verifica('T.R.S. luglio: 13.640 dichiarati, 13.640 conferiti', trsLuglio.torna === true && trsLuglio.scarto_kg === 0, JSON.stringify(trsLuglio));
verifica('e il testo lo dice in italiano', /coincidono al chilo/.test(trsLuglio.testo) && /13\.640/.test(trsLuglio.testo), trsLuglio.testo);
const gtpLuglio = riscontroConferito(2640, 2640);
verifica('Green Tyre luglio: 2.640 dichiarati, 2.640 conferiti', gtpLuglio.torna === true, JSON.stringify(gtpLuglio));
verifica('Gatim giugno: i tre documenti fanno il conferito del mese', riscontroConferito(giugnoGatim.quantita_kg, 11340).torna === true);

// IL CASO CHE SERVE DAVVERO: un documento che l'impianto non ha mandato. Lo scarto
// e' esattamente il peso del documento che manca, e il testo manda a cercarlo.
const senzaUno = unisciLetture([GATIM_1, GATIM_3]);
const manca = riscontroConferito(senzaUno.quantita_kg, 11340);
verifica('con due documenti su tre mancano 5.490 kg, cioe\' il terzo',
  senzaUno.quantita_kg === 5850 && manca.torna === false && manca.scarto_kg === -5490, JSON.stringify(manca));
verifica('e il testo dice quanto manca e dove cercarlo',
  /mancano 5\.490 kg/.test(manca.testo) && /non ha ancora mandato|non è stato allegato/.test(manca.testo), manca.testo);
const troppo = riscontroConferito(15270, 11340);
verifica('3.930 kg in piu\' del conferito mandano a cercare un documento contato due volte',
  troppo.torna === false && troppo.scarto_kg === 3930 && /3\.930 kg in più/.test(troppo.testo) && /due volte/.test(troppo.testo), JSON.stringify(troppo));
// Un chilo di scarto e' uno scarto: su questi documenti la tolleranza e' zero.
verifica('un solo chilo di differenza non torna', riscontroConferito(13641, 13640).torna === false);
const senzaConferito = riscontroConferito(13640, null);
verifica('senza il conferito non si inventa un verdetto',
  senzaConferito.torna === null && senzaConferito.scarto_kg === null && /non è stato fatto/.test(senzaConferito.testo), JSON.stringify(senzaConferito));

// ---------------------------------------------------------------------------

console.log('UN DOCUMENTO CHE NON QUADRA NON SPARISCE NEL TOTALE');
// Se una lettura storta arrivasse comunque al totale (il documento e' stato letto
// due volte e nessuna delle due torna), il totale lo dice: altrimenti quei 500 kg
// in piu' sarebbero indistinguibili da un numero buono.
const conStorta = unisciLetture([{ ...GATIM_1, metalli_kg: 1870 }, GATIM_2]);
verifica('il totale avverte che i materiali non fanno la quantita\'',
  conStorta.quantita_kg === 9420 && conStorta.somma_materiali_kg === 9920
  && conStorta.problemi.some(p => /i materiali non fanno la quantità/.test(p)), JSON.stringify(conStorta.problemi));
verifica('e si vede quale documento non quadra',
  conStorta.documenti[0].quadra === false && conStorta.documenti[1].quadra === true, JSON.stringify(conStorta.documenti.map(d => [d.file, d.quadra])));
const senzaNiente = unisciLetture([]);
verifica('nessun documento non e\' un totale a zero da salvare: e\' un problema',
  senzaNiente.quantita_kg === 0 && senzaNiente.problemi.length === 1, JSON.stringify(senzaNiente.problemi));

console.log('I MODI IN CUI UN NUMERO SBAGLIATO PASSAVA I CONTROLLI');
// LA TOLLERANZA E' ZERO, e va difesa: con 20 kg di tolleranza - quella che usa il
// controllo della scheda - un 7 letto 9 (1.370 -> 1.390) sarebbe stato accettato,
// verificato e scritto in una dichiarazione.
const unChilo = controllaLettura({ ...GATIM_1, metalli_kg: 1371 });
verifica('uno scarto di 1 kg nella somma dei materiali si respinge', unChilo.ok === false && unChilo.problemi.length > 0, JSON.stringify(unChilo.problemi));
const venti = controllaLettura({ ...GATIM_1, metalli_kg: 1390 });
verifica('e anche uno di 20 kg, che e\' un 7 letto 9', venti.ok === false, JSON.stringify(venti.problemi));
// LA VIRGOLA DELLE MIGLIAIA: letta come decimale divideva per mille tutti e quattro
// i numeri insieme, quindi la somma tornava lo stesso e la lettura passava.
// T.R.S. di luglio: 13.640 kg diventavano 14.
const inglese = controllaLettura({ ...TRS_LUGLIO, quantita_kg: '13,640', polverino_granulo_kg: '9,548', fibre_kg: '1,364', metalli_kg: '2,728' });
const ingleseUnito = unisciLetture([{ ...TRS_LUGLIO, quantita_kg: '13,640', polverino_granulo_kg: '9,548', fibre_kg: '1,364', metalli_kg: '2,728' }]);
verifica('un peso con la virgola delle migliaia vale i chili veri, non mille volte meno',
  inglese.ok === true && ingleseUnito.quantita_kg === 13640 && ingleseUnito.polverino_granulo_kg === 9548, JSON.stringify([ingleseUnito.quantita_kg, ingleseUnito.polverino_granulo_kg]));
verifica('e i decimali veri restano decimali', unisciLetture([{ ...GATIM_1, quantita_kg: '3.930', polverino_granulo_kg: '1970', fibre_kg: '590', metalli_kg: '1370' }]).quantita_kg === 3930);
// SENZA FORMULARIO O SENZA DATA DI CONFERIMENTO la lettura non e' guardabile: col
// formulario non si riconosce un doppione, e senza la data di conferimento il mese
// verrebbe dalla data di servizio, che e' un'altra colonna - il periodo di un
// movimento e' la fine del trasporto, mai altro.
verifica('una lettura senza formulario si respinge', controllaLettura({ ...GATIM_1, formulario: '' }).ok === false);
verifica('una lettura senza data di conferimento si respinge',
  controllaLettura({ ...GATIM_1, data_conferimento: '' }).ok === false
  && controllaLettura({ ...GATIM_1, data_conferimento: '' }).problemi.some(p => /data di servizio/.test(p)));
// Con documenti di mesi diversi il totale non vale: chi lo usa deve saperlo, perche'
// un riscontro calcolato su quello zero direbbe che mancano chili che invece ci sono.
const mesiDiversi = unisciLetture([GATIM_1, { ...GATIM_1, file: 'altro.pdf', formulario: 'ALTRO000002XX', ticket_aci: ['111111-11'], data_conferimento: '2026-07-02' }]);
verifica('con mesi diversi il totale si dichiara non sommato',
  mesiDiversi.sommato === false && mesiDiversi.quantita_kg === 0, JSON.stringify([mesiDiversi.sommato, mesiDiversi.gruppi.length]));
verifica('con un mese solo il totale e\' sommato', unisciLetture([GATIM_1]).sommato === true);

// LA STESSA REGOLA VALE PER I CHILI SCRITTI A MANO.
//
// numeroKg adesso e' esportata perche' la usa anche la casella del dialogo del
// mese (src/components/dichiarazioni/DialogoMese.jsx), che fino al 04/10/2026
// aveva una regola tutta sua: via i punti, la virgola a decimale. Cosi' «13.640»
// faceva 13.640 kg e «13,640» faceva 13,64 - mille volte meno - sulla stessa
// casella, a seconda di come il numero era scritto sulla dichiarazione da cui lo
// si copia. Una dichiarazione da 13.640 kg risultava dichiarata per 14.
console.log('I CHILI, COMUNQUE SIANO SCRITTI');
verifica('il punto delle migliaia', numeroKg('13.640') === 13640 && numeroKg('1.234.567') === 1234567);
verifica('e la virgola delle migliaia, che e\' il caso che costava mille volte',
  numeroKg('13,640') === 13640, String(numeroKg('13,640')));
verifica('un decimale vero resta un decimale, e i chili sono interi',
  numeroKg('13,5') === 14 && numeroKg('13.5') === 14 && numeroKg('12,4') === 12,
  JSON.stringify([numeroKg('13,5'), numeroKg('13.5'), numeroKg('12,4')]));
verifica('un numero senza separatori non cambia', numeroKg('13640') === 13640 && numeroKg(13640) === 13640);
verifica('i chili scritti con l\'unita\' o con gli spazi si leggono lo stesso',
  numeroKg('13.640 kg') === 13640 && numeroKg(' 13.640 ') === 13640, String(numeroKg('13.640 kg')));
verifica('il vuoto e le parole valgono zero, non NaN',
  numeroKg('') === 0 && numeroKg(null) === 0 && numeroKg(undefined) === 0 && numeroKg('abc') === 0);
verifica('tre cifre dopo la virgola in mezzo al numero sono migliaia, non decimali',
  numeroKg('1,234,567') === 1234567 && numeroKg('1.234,56') === 1235,
  JSON.stringify([numeroKg('1,234,567'), numeroKg('1.234,56')]));

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
