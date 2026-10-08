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
import { notaDichiaratoPortale } from '../src/lib/notaQuadratura.js';

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

console.log('I CASI STORTI NON FANNO SCRIVERE SCIOCCHEZZE');
verifica('senza i numeri non si rompe', typeof notaDichiaratoPortale({}, fmt) === 'string' && typeof notaDichiaratoPortale(null, fmt) === 'string');

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
