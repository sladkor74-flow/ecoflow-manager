// IL PIANIFICATORE DI ECOTYNA SCEGLIE IL CONTRATTO PER LE DOMANDE SUL CONTRATTO
// (chiusura del giro della variazione del contratto, 14/10/2026).
//
// Registrata la variazione di ottobre (Puglia +100 t, contratto 11.650 t), a
// EcoTyna e' stato chiesto «Qual è oggi il target annuo 2026 del contratto
// Ecotyre sulla rete, e com'è messa la Puglia rispetto all'atteso?». Il
// pianificatore ha scelto target_raccoglitori, che il contratto non lo legge: la
// risposta ha dato la somma dei target dei raccoglitori come target del
// contratto, e sulla Puglia ha detto che il dato non era filtrato per regione.
// Il gruppo F-1 ha aggiunto lo strumento contratto_ecotyre e le descrizioni del
// catalogo; qui si controlla che fra le REGOLE del pianificatore (non solo nel
// catalogo) ci sia quella esplicita: per il contratto, il target annuo,
// l'atteso, lo scarto, una regione rispetto al contratto o «come stiamo» si usa
// contratto_ecotyre; target_raccoglitori solo per i singoli raccoglitori.
// La scelta la fa il modello e non e' deterministica: si prova il testo che gli
// arriva. L'etichetta dello strumento nella chat la controlla
// prove/assistentePagina.mjs (ogni strumento ha la sua).
// node prove/pianoContrattoEcotyre.mjs
import { catalogoStrumenti } from '../base44/shared/strumentiAssistente.ts';
import { istruzioniPiano } from '../base44/shared/pianoAssistente.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + String(extra).slice(0, 700)); } };

const DOMANDA = "Qual è oggi il target annuo 2026 del contratto Ecotyre sulla rete, e com'è messa la Puglia rispetto all'atteso?";
const testo = istruzioniPiano(catalogoStrumenti(), DOMANDA, '2026-10-14').replace(/\r/g, '');
const righe = testo.split('\n');
const inizioRegole = righe.indexOf('Regole:');
const inizioCatalogo = righe.indexOf('Strumenti disponibili:');

console.log('1. LA REGOLA DEL CONTRATTO FRA LE REGOLE DEL PIANIFICATORE');
verifica('le istruzioni hanno le regole e poi il catalogo', inizioRegole >= 0 && inizioCatalogo > inizioRegole, `${inizioRegole} / ${inizioCatalogo}`);
const regole = righe.slice(inizioRegole + 1, inizioCatalogo);
const regola = regole.find(r => r.includes('contratto_ecotyre')) || '';
verifica('c\'e\' una regola (non solo la voce del catalogo) che nomina contratto_ecotyre', !!regola, regole.join('\n').slice(0, 700));
verifica('la regola manda a contratto_ecotyre il target annuo, l\'atteso, lo scarto e una regione rispetto al contratto',
  /usa contratto_ecotyre/.test(regola) && ['target annuo', 'atteso alla data', 'scarto', 'una regione rispetto al contratto', 'come stiamo'].every(x => regola.includes(x)), regola);
verifica('con la regione, se la domanda ne nomina una', /con regione se la domanda ne nomina una/.test(regola), regola);
verifica('target_raccoglitori solo per i singoli raccoglitori, e la loro somma non e\' il contratto',
  /target_raccoglitori solo per i singoli raccoglitori/.test(regola) && /la somma dei loro target non e' il contratto/.test(regola), regola);
verifica('la regola sta subito dopo quella dei target solo della rete', regole.indexOf(regola) === regole.findIndex(r => r.startsWith('- I target sono solo della rete')) + 1, regole.indexOf(regola));

console.log('2. IL CATALOGO RESTA QUELLO DEL GRUPPO F-1');
const voce = (nome) => righe.findIndex(r => r.startsWith(`- ${nome}: `));
verifica('contratto_ecotyre e target_raccoglitori sono nel catalogo, il contratto prima', voce('contratto_ecotyre') > inizioCatalogo && voce('contratto_ecotyre') < voce('target_raccoglitori'), `${voce('contratto_ecotyre')} / ${voce('target_raccoglitori')}`);

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
