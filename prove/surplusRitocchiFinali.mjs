// Due ritocchi del surplus rimasti fuori dai gruppi (13/10/2026, sera):
// - la riga del surplus di un impianto o di uno stoccaggio senza la tariffa del
//   mese dice l'avviso, come quella dei raccoglitori;
// - se i surplus non si leggono, i file dell'extra raccolta non escono: il loro
//   Totale imponibile non avrebbe il Fuel Surcharge e non tornerebbe con la
//   fattura, senza dirlo.
// Si lancia con: node prove/surplusRitocchiFinali.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
const sorgente = (p) => readFileSync(qui('../' + p), 'utf8').replace(/\r/g, '');
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

console.log('1. IMPIANTI E STOCCAGGI SENZA TARIFFA');
{
  const s = sorgente('src/components/fatturazione/PassivaImpiantiTable.jsx');
  verifica('la tabella degli impianti importa AvvisoSurplus', /import \{[^}]*\bAvvisoSurplus\b[^}]*\} from '\.\/PassivaSurplus'/.test(s));
  const riga = s.slice(s.indexOf('RIGA_SURPLUS}>'), s.indexOf('<TonnellateSurplus', s.indexOf('RIGA_SURPLUS}>')));
  verifica('e lo mette nella riga del surplus', /<AvvisoSurplus s=\{s\} \/>/.test(riga));
}

console.log('2. I FILE DELL\'EXTRA RACCOLTA COI SURPLUS NON LETTI');
{
  const e = sorgente('src/pages/ExtraRaccolta.jsx');
  verifica('Esporta Excel si ferma', /onClick=\{exportExcel\} disabled=\{terminati\.length === 0 \|\| surplusNonLetti\}/.test(e));
  verifica('Esporta PDF si ferma', /onClick=\{exportPDF\} disabled=\{terminati\.length === 0 \|\| surplusNonLetti\}/.test(e));
  verifica('e la pagina dice perche\'', /\{surplusNonLetti && <span[^>]*>I file si esportano quando i surplus sono letti/.test(e));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
