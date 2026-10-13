// I destinatari del surplus con l'articolo giusto (rilievo basso della revisione
// della passiva, 13/10/2026): la fascia diceva «a tutti i stoccaggi» e «ai
// impianti dell'elenco». E la fascia di un surplus senza interventi nomina la
// fattura o la passiva solo se il surplus ce l'ha.
// Si lancia con: node prove/surplusArticoli.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { aiDestinatari } from '../base44/shared/surplus.ts';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
const sorgente = (p) => readFileSync(qui('../' + p), 'utf8').replace(/\r/g, '');
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

console.log('1. GLI ARTICOLI');
verifica('raccolta', aiDestinatari('RACCOLTA', 'tutti') === 'a tutti i raccoglitori' && aiDestinatari('RACCOLTA', 'elenco') === "ai raccoglitori dell'elenco");
verifica('trattamento', aiDestinatari('TRATTAMENTO', 'tutti') === 'a tutti gli impianti' && aiDestinatari('TRATTAMENTO', 'elenco') === "agli impianti dell'elenco");
verifica('stoccaggio', aiDestinatari('CONFERIMENTO_STOCCAGGIO', 'tutti') === 'a tutti gli stoccaggi' && aiDestinatari('CONFERIMENTO_STOCCAGGIO', 'elenco') === "agli stoccaggi dell'elenco");
verifica('trasporto delle secondarie', aiDestinatari('TRASPORTO_SECONDARIA', 'tutti') === 'a tutti i trasportatori delle secondarie');
verifica('prestazione sconosciuta', aiDestinatari('X', 'tutti') === 'a tutti i fornitori');

console.log('2. LE PAGINE LO USANO');
const pagine = ['src/pages/ExtraRaccolta.jsx', 'src/components/fatturazione/PassivaSurplus.jsx', 'src/components/fatturazione/SurplusSezione.jsx'];
for (const p of pagine) {
  const s = sorgente(p);
  verifica(`${p.split('/').pop()}: nessun «a tutti i \${...}» o «ai \${...}» scritto a mano`, !/a tutti i \$\{/.test(s) && !/[`' ]ai \$\{/.test(s) && !/`Ai \$\{/.test(s), (s.match(/(a tutti i|[`' ]ai|`Ai) \$\{[^}]*\}/) || [''])[0]);
}
const e = sorgente('src/pages/ExtraRaccolta.jsx');
verifica('la fascia vuota nomina fattura e passiva solo se il surplus le ha', /\[attiva && 'in fattura', isAdmin && passiva && 'in passiva'\]/.test(e) && !/con una riga sua in fattura e in passiva\./.test(e));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
