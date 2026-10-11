// Prova del NOME DELL'ASSISTENTE A VIDEO (revisione W5, chiusura dell'audit
// 11/10/2026). L'assistente si chiama EcoTyna, ma due testi a video dicevano
// ancora «l'Assistente»: la scheda dei livelli («Usa l'Assistente e le
// esercitazioni del corso», in src/lib/livelli.js e nella sua copia per le
// funzioni) e l'elenco dei moduli di una richiesta. Nella richiesta 'Assistente'
// e' il valore che si salva, e le richieste gia' aperte lo portano: resta quello,
// cambia solo l'etichetta.
// Le prove leggono il sorgente, tolti i \r (i file sono CRLF nell'albero di lavoro).
// npm run prove
import { readFileSync } from 'node:fs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const leggi = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r/g, '');

console.log('I LIVELLI');
const { LIVELLI } = await import('../src/lib/livelli.js').catch(() => ({}));
for (const file of ['src/lib/livelli.js', 'base44/shared/livelli.ts']) {
  const src = leggi(file);
  verifica(`${file}: «Usa EcoTyna e le esercitazioni del corso»`, src.includes('Usa EcoTyna e le esercitazioni del corso'));
  verifica(`${file}: niente piu' «Usa l'Assistente»`, !/Usa l\\?'Assistente/.test(src));
}
if (LIVELLI && LIVELLI.consultazione) {
  verifica('e la scheda di consultazione lo dice', LIVELLI.consultazione.puo.includes('Usa EcoTyna e le esercitazioni del corso'), JSON.stringify(LIVELLI.consultazione.puo));
}

console.log('LE RICHIESTE');
{
  const src = leggi('src/pages/Richieste.jsx');
  const moduli = (src.match(/const MODULI = \[([\s\S]*?)\];/) || [])[1] || '';
  verifica("il valore che si salva resta 'Assistente'", /'Assistente'/.test(moduli), moduli);
  verifica("a video l'etichetta e' EcoTyna", /ETICHETTE_MODULI = \{ Assistente: 'EcoTyna' \}/.test(src));
  verifica("nella scelta del modulo si vede l'etichetta, il valore resta quello", /<SelectItem key=\{m\} value=\{m\}>\{etichettaModulo\(m\)\}<\/SelectItem>/.test(src));
  verifica("e nell'elenco delle richieste", /\[etichettaModulo\(r\.modulo\),/.test(src));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
