// Prova della scheda di un intervento di extra raccolta
// (src/components/fatturazione/ExtraRaccoltaForm.jsx), dall'audit del 20/09/2026,
// alte A39 e A40, corrette il 12/10/2026.
//
// A39: il campo numerico era un componente definito DENTRO la scheda. A ogni
// carattere la scheda si ridisegna, React vedeva un componente nuovo e montava
// un input nuovo: il cursore usciva dal campo dopo ogni cifra (sovracosti,
// pulizia, costi aggiuntivi). Sta fuori, e la prova lo guarda nel sorgente.
//
// A40: un formulario riscritto a mano su due interventi passava senza una
// parola. Al salvataggio si cerca il numero normalizzato fra gli altri
// interventi e si chiede conferma. npm run prove
import { readFileSync } from 'node:fs';
import { caricaLibPagine } from './dati/libPagine.mjs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const leggi = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\r/g, '');

console.log('A39: IL CAMPO NUMERICO NON SI RIMONTA A OGNI CARATTERE');
const scheda = leggi('src/components/fatturazione/ExtraRaccoltaForm.jsx');
const inizioScheda = scheda.indexOf('export default function ExtraRaccoltaForm');
const corpoScheda = scheda.slice(inizioScheda);
verifica('NumField e\' definito fuori dalla scheda, prima di lei',
  /\nfunction NumField\(\{ label, value, onChange \}\)/.test(scheda.slice(0, inizioScheda)), '');
verifica('e dentro la scheda non si ridefinisce', !/(const|let|function)\s+NumField\b/.test(corpoScheda));
const usi = [...corpoScheda.matchAll(/<NumField [\s\S]*?\/>/g)].map(m => m[0]);
verifica('i cinque campi (tre sovracosti, pulizia, costi aggiuntivi) passano valore e scrittura',
  usi.length === 5 && usi.every(u => /value=\{form\.[a-z_]+\}/.test(u) && /onChange=\{v => set\('[a-z_]+', v\)\}/.test(u)), JSON.stringify(usi));
verifica('nessun componente definito come costante dentro la scheda', !/\n {2}const [A-Z][A-Za-z]+ = \(\{/.test(corpoScheda));

console.log('A40: LO STESSO FORMULARIO SU UN ALTRO INTERVENTO');
const { interventiConStessoFir, domandaFirGiaPresente, chiaveFir } = await caricaLibPagine('lib/formularioGiaPresente');
const interventi = [
  { id: 'a', id_ordine: 'ER-1', numero_fir: 'RGYTR027030CR', produttore: 'GOMME ROSSI SRL', stato: 'terminato', trasporto_finito_il: '2026-09-08T22:30:00.000Z' },
  { id: 'b', id_ordine: 'ER-2', numero_fir: 'XFRTA000111BB', produttore: 'PNEUS BIANCHI', stato: 'assegnato' },
  { id: 'c', id_ordine: 'ER-3', numero_fir: '', produttore: 'SENZA FIR', stato: 'assegnato' },
];
verifica('il numero si confronta normalizzato, come nelle verifiche', chiaveFir(' rgytr 027030-cr ') === 'RGYTR027030CR');
const trovati = interventiConStessoFir(interventi, 'rgytr 027030-cr', null);
verifica('un intervento nuovo con un FIR gia\' registrato lo trova', trovati.length === 1 && trovati[0].id === 'a', JSON.stringify(trovati));
verifica('l\'intervento stesso, riaperto e salvato, non e\' un doppione', interventiConStessoFir(interventi, 'RGYTR027030CR', 'a').length === 0);
verifica('un FIR vuoto non si confronta con le schede senza FIR', interventiConStessoFir(interventi, '', null).length === 0 && interventiConStessoFir(interventi, '  ', 'b').length === 0);
verifica('un FIR nuovo non trova niente', interventiConStessoFir(interventi, 'RGYTR027031CR', null).length === 0);
const domanda = domandaFirGiaPresente('RGYTR027030CR', trovati);
// il giorno e' quello italiano: le 22:30 UTC dell'8 settembre sono gia' il 9
verifica('la domanda dice dove il numero c\'e\' gia\', con la data all\'italiana',
  /già registrato su un altro intervento/.test(domanda) && /ordine ER-1/.test(domanda) && /GOMME ROSSI SRL/.test(domanda) && /fine trasporto 09\/09\/2026/.test(domanda) && /Salvare comunque\?$/.test(domanda), domanda);

console.log('A40: LA SCHEDA LO CHIEDE PRIMA DI SALVARE');
const save = corpoScheda.slice(corpoScheda.indexOf('const save = () => {'), corpoScheda.indexOf('onSave(p);'));
verifica('al salvataggio cerca il FIR fra gli altri interventi, escludendo se stesso',
  /interventiConStessoFir\(interventi, form\.numero_fir, initial\?\.id\)/.test(save), '');
verifica('e senza conferma non salva', /if \(stessoFir\.length && !window\.confirm\(domandaFirGiaPresente\(form\.numero_fir, stessoFir\)\)\) return;/.test(save));
verifica('la scheda riceve gli interventi dalla pagina', /export default function ExtraRaccoltaForm\(\{[^}]*interventi = \[\][^}]*\}\)/.test(scheda));
const pagina = leggi('src/pages/ExtraRaccolta.jsx');
verifica('la pagina passa l\'elenco che rilegge dopo ogni salvataggio', /<ExtraRaccoltaForm[\s\S]*?interventi=\{records\}[\s\S]*?\/>/.test(pagina));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
