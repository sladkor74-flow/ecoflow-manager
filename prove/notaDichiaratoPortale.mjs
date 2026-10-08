// LA NOTA CHE SPIEGA LA DIFFERENZA FRA IL NOSTRO DICHIARATO E QUELLO DEL REPORT.
//
// Il report del portale conta per ANNO DEL CARICO, noi per mese di
// dichiarazione: una dichiarazione di quest'anno che ha smaltito materiale
// arrivato l'anno scorso, il portale la mette nell'anno scorso. Su Irigom erano
// 400,20 t - la giacenza che l'impianto si portava dietro dal 31/12/2025 - e la
// riga, che diceva solo «nel report risultano 2.877,48 t dichiarate», sembrava
// denunciare un ammanco: ci e' costata mezza giornata di verifiche (08/10/2026).
//
// Nell'altro verso il discorso cambia del tutto: se il portale ne conta PIU' di
// noi non e' una questione di anni, e' una dichiarazione che non abbiamo
// registrato. La nota deve dire due cose diverse. npm run prove
import { notaDichiaratoPortale, esitoQuadratura } from '../src/lib/notaQuadratura.js';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const fmt = (v) => Number(v).toFixed(2).replace('.', ',');

console.log('QUANDO NOI ABBIAMO DICHIARATO PIU\' DI QUANTO IL REPORT ATTRIBUISCE ALL\'ANNO');
const irigom = notaDichiaratoPortale({ dichiarato_caricato_rete_t: 3277.68, dichiarato_portale_t: 2877.48 }, fmt);
verifica('dice i due numeri e la differenza', /2877,48/.test(irigom) && /400,20/.test(irigom), irigom);
verifica('e spiega che quelle hanno smaltito carichi dell\'anno prima',
  /anno prima/.test(irigom) && !/manca una dichiarazione/.test(irigom), irigom);

console.log('QUANDO E\' IL PORTALE A CONTARNE DI PIU\'');
const mancante = notaDichiaratoPortale({ dichiarato_caricato_rete_t: 1000, dichiarato_portale_t: 1150 }, fmt);
verifica('non parla di anni: dice che manca una dichiarazione',
  /manca una dichiarazione/.test(mancante) && !/anno prima/.test(mancante), mancante);
verifica('e la differenza la dice positiva, non con il meno davanti',
  /150,00/.test(mancante) && !/-150/.test(mancante), mancante);

console.log('«NESSUN DATO A PORTALE» NASCONDEVA DUE SITUAZIONI IN ORDINE');
// Tecnogum: non ci fattura il trattamento e dichiara in proprio, quindi quelle
// tonnellate NON sono da dichiarare. Finche' l'accordo e' questo non e' un
// ammanco, e la riga deve dirlo.
const tecnogum = esitoQuadratura({ quadra: null, dichiara_rete: false, giacenza_calcolata_t: 1833.43, dichiarato_caricato_rete_t: 0, dichiarato_portale_t: 0 });
verifica('chi non dichiara la rete per accordo lo dice, e dice che non sono da dichiarare',
  tecnogum.stato === 'fuori' && /non da dichiarare/.test(tecnogum.testo) && /non sono da dichiarare/.test(tecnogum.spiega), JSON.stringify(tecnogum));
verifica('e non e\' un allarme: non dice ne\' «quadra» ne\' «da verificare»',
  tecnogum.stato !== 'quadra' && tecnogum.stato !== 'verifica');
// L'accordo vale SOLO per la rete: l'ACI Tecnogum lo dichiara e noi lo paghiamo
// (precisazione dell'utente, 08/10/2026).
verifica('la riga della rete lo dice anche quando il canale e\' scritto',
  esitoQuadratura({ ...tecnogum, quadra: null, dichiara_rete: false, canale: 'RETE' }).stato === 'fuori');
verifica('ma su una riga ACI quella scritta non esce: l\'accordo non riguarda l\'ACI',
  esitoQuadratura({ quadra: null, dichiara_rete: false, canale: 'ACI', giacenza_calcolata_t: 10 }).stato === 'ignoto',
  JSON.stringify(esitoQuadratura({ quadra: null, dichiara_rete: false, canale: 'ACI', giacenza_calcolata_t: 10 })));
verifica('e la spiegazione dice esplicitamente che l\'ACI non c\'entra', /ACI non c'entra/.test(tecnogum.spiega), tecnogum.spiega);
// T.R.S.: non compare fra i non dichiarati proprio perche' ha dichiarato tutto.
const trs = esitoQuadratura({ quadra: null, dichiara_rete: true, giacenza_calcolata_t: 0, dichiarato_caricato_rete_t: 227.18, dichiarato_portale_t: 227.18 });
verifica('chi ha dichiarato tutto quadra, e si legge',
  trs.stato === 'quadra' && trs.testo === 'quadra: dichiarato tutto, niente in giacenza', JSON.stringify(trs));
// Ma se il portale dice un numero diverso dal nostro, non si dichiara vittoria.
const diverso = esitoQuadratura({ quadra: null, dichiara_rete: true, giacenza_calcolata_t: 0, dichiarato_caricato_rete_t: 227.18, dichiarato_portale_t: 180 });
verifica('se il report non conferma le stesse tonnellate, resta «nessun dato a portale»',
  diverso.stato === 'ignoto', JSON.stringify(diverso));
// E con una giacenza ancora aperta non e' «tutto dichiarato».
const conGiacenza = esitoQuadratura({ quadra: null, dichiara_rete: true, giacenza_calcolata_t: 120, dichiarato_caricato_rete_t: 227.18, dichiarato_portale_t: 227.18 });
verifica('e nemmeno se in giacenza e\' rimasto qualcosa', conGiacenza.stato === 'ignoto', JSON.stringify(conGiacenza));
verifica('chi quadra davvero continua a dire solo «quadra»',
  esitoQuadratura({ quadra: true }).testo === 'quadra' && esitoQuadratura({ quadra: false }).testo === 'da verificare');

console.log('I CASI STORTI NON FANNO SCRIVERE SCIOCCHEZZE');
verifica('senza i numeri non si rompe', typeof notaDichiaratoPortale({}, fmt) === 'string' && typeof notaDichiaratoPortale(null, fmt) === 'string');

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
