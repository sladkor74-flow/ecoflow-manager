// Prova della scorciatoia di EcoTyna (base44/shared/pianoAssistente.ts:
// pianoDiretto): la domanda canonica sul raccolto non chiama il modello per
// decidere il piano. Al minimo dubbio la scorciatoia si tira indietro, perche'
// un numero sbagliato che arriva in fretta e' peggio di uno giusto che aspetta.
// npm run prove
import { pianoDiretto } from '../base44/shared/pianoAssistente.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const OGGI = '2026-09-30';
const p = (d) => { const r = pianoDiretto(d, OGGI); return r ? r[0].parametri : null; };

console.log('LA DOMANDA CANONICA');
const a = p('quanto ha raccolto Nappi Sud ad agosto?');
verifica('riconosce la forma', !!a, JSON.stringify(a));
verifica('prende il soggetto', a && a.raccoglitore === 'nappi sud', JSON.stringify(a));
verifica('prende il mese', a && a.mese === 'Agosto');
verifica('anno di oggi se non e scritto', a && a.anno === 2026);
verifica('canale rete se non e detto', a && a.canale === 'RETE');
verifica('lo strumento e raccolto', pianoDiretto('quanto ha raccolto Nappi Sud ad agosto?', OGGI)[0].nome === 'raccolto');

console.log('LE VARIANTI CHE UN AMMINISTRATORE SCRIVE DAVVERO');
verifica('senza soggetto', JSON.stringify(p('quanto abbiamo raccolto ad agosto?')) === JSON.stringify({ canale: 'RETE', anno: 2026, mese: 'Agosto' }),
  JSON.stringify(p('quanto abbiamo raccolto ad agosto?')));
verifica('con l anno', p('quanto ha raccolto Emmesse a luglio 2025?').anno === 2025);
verifica('con il canale ACI', p('quante tonnellate abbiamo raccolto ad agosto sull ACI').canale === 'ACI');
verifica('con extra raccolta', p('quanto abbiamo raccolto in extra raccolta a marzo').canale === 'EXTRA_RACCOLTA');
verifica('due mesi', JSON.stringify(p('quanto ha raccolto Gatim a luglio e agosto?').mesi) === '["Luglio","Agosto"]',
  JSON.stringify(p('quanto ha raccolto Gatim a luglio e agosto?')));
verifica('un intervallo resta da aprire allo strumento', (p('quanto ha raccolto Gatim da marzo a maggio?').mesi || []).join().includes('marzo'),
  JSON.stringify(p('quanto ha raccolto Gatim da marzo a maggio?')));
verifica('il verbo conferire', !!p('quanto ha conferito Irigom ad agosto?'));
verifica('senza punto di domanda', !!p('quanto ha raccolto Nappi Sud ad agosto'));

console.log('QUANDO LA SCORCIATOIA SI TIRA INDIETRO');
const no = (d) => pianoDiretto(d, OGGI) === null;
verifica('un raggruppamento non e la forma canonica', no('quanto abbiamo raccolto ad agosto per provincia?'));
verifica('il target no', no('quanto ha raccolto Gatim rispetto al target?'));
verifica('la classe no', no('quanto abbiamo raccolto in classe 4 ad agosto?'));
verifica('una previsione no', no('quanto raccoglieremo ad agosto secondo la proiezione?'));
verifica('la fatturazione no', no('quanto abbiamo fatturato ad agosto?'));
verifica('due domande in una no', no('quanto ha raccolto Gatim ad agosto? e Irigom?'));
verifica('una domanda di norma no', no('posso trasportare PFU senza iscrizione all albo?'));
verifica('una domanda su altro no', no('quali omologhe scadono nei prossimi 90 giorni?'));
verifica('la giacenza no', no('quanto ha raccolto Nappi Sud e qual e la giacenza?'));
verifica('un soggetto lunghissimo insospettisce', no('quanto ha raccolto il raccoglitore che opera nella zona di Bari ad agosto?'));
verifica('senza niente da filtrare non serve', no('quanto abbiamo raccolto?'));

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
