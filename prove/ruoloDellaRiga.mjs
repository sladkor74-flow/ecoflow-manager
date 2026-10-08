// A CHE TITOLO UN CARICO STA SU QUEL SITO: DA DICHIARARE, OPPURE DI PASSAGGIO.
//
// Un'azienda puo' essere impianto e piazzale insieme - T-Cycle lo e' - e il
// portale scrive gli ordini non dichiarati sotto la destinazione dove il
// materiale e' arrivato, senza distinguere i due ruoli. Le due cose non si
// somigliano per niente:
//   'imp'  il carico e' li' e quell'impianto lo deve DICHIARARE;
//   'stoc' il carico e' passato dal piazzale ed e' ripartito in secondaria: sta
//          come giacenza su chi l'ha ricevuto, e a dichiararlo sara' lui.
//
// Senza questa distinzione, l'elenco «da dichiarare» di T-Cycle mostrava 186
// ordini mentre quelli davvero suoi erano 114: gli altri 72 (181,30 t) erano
// passati dal suo piazzale e gia' andati altrove. Regola dell'utente,
// 08/10/2026: «essendo usciti in secondaria stanno come giacenza sull'impianto
// di destino quindi non concorrono alla giacenza attuale in impianto».
//
// La regola sta in un posto solo (base44/shared/giacenzaPortale.ts) e la usano
// sia le giacenze sia l'elenco: se divergessero, il numero sul pulsante e le
// righe che apre direbbero due cose diverse - ed e' proprio quello che
// succedeva. npm run prove
import { ruoloDellaRiga, collocaFotografia } from '../base44/shared/giacenzaPortale.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// Nel gestionale: ET1 e' andato a T-Cycle come impianto, ET2 come piazzale.
const ruoloPrimaria = (id) => ({ ET1: 'imp', ET2: 'stoc' }[id] || '');

console.log('IL RUOLO DI UNA RIGA DEL FILE');
verifica('un carico arrivato all\'impianto si dichiara li\'',
  ruoloDellaRiga({ ordine_primaria: 'ET1', destinazione: 'T-CYCLE' }, ruoloPrimaria) === 'imp');
verifica('un carico passato dal piazzale no',
  ruoloDellaRiga({ ordine_primaria: 'ET2', destinazione: 'T-CYCLE' }, ruoloPrimaria) === 'stoc');
verifica('se il portale ha gia' + ' scritto la destinazione secondaria, il dubbio non c\'e\': e\' dell\'impianto che l\'ha ricevuta',
  ruoloDellaRiga({ ordine_primaria: 'ET2', destinazione: 'NAPPI SUD', destinazione_secondaria: 'Irigom' }, ruoloPrimaria) === 'imp');
verifica('e un ordine che il gestionale non conosce si tratta come impianto, non si butta',
  ruoloDellaRiga({ ordine_primaria: 'SCONOSCIUTO', destinazione: 'T-CYCLE' }, ruoloPrimaria) === 'imp');
verifica('senza niente in mano non si rompe', ruoloDellaRiga(null) === 'imp' && ruoloDellaRiga({}) === 'imp');

console.log('LA STESSA REGOLA DIVIDE LA FOTOGRAFIA');
// Due righe sullo stesso nome: una dell'impianto, una del piazzale.
const righe = [
  { ordine_primaria: 'ET1', destinazione: 'T-CYCLE', peso_non_dichiarato_kg: 352940, prodotto: '.class1', fine_trasporto: '2026-03-10' },
  { ordine_primaria: 'ET2', destinazione: 'T-CYCLE', peso_non_dichiarato_kg: 181300, prodotto: '.class1', fine_trasporto: '2026-03-11' },
];
const c = collocaFotografia(righe, { chiaveDi: (s) => String(s || '').toUpperCase().trim(), ruoloPrimaria });
verifica('nella fotografia dell\'impianto ci sono solo i suoi 352,94 t',
  Math.round((c.portale.get('T-CYCLE') || 0) * 100) / 100 === 352.94, String(c.portale.get('T-CYCLE')));
verifica('e le 181,30 t di passaggio stanno fra quelle in attesa, non nella giacenza',
  Math.round((c.inAttesa.get('T-CYCLE') || 0) * 100) / 100 === 181.3, String(c.inAttesa.get('T-CYCLE')));
verifica('i due numeri insieme fanno il totale del file, e nessuno si perde',
  Math.round(((c.portale.get('T-CYCLE') || 0) + (c.inAttesa.get('T-CYCLE') || 0)) * 100) / 100 === 534.24);

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
