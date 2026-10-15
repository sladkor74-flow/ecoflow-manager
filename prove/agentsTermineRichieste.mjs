// LE NOTE DI AGENTS.md SUL TERMINE DELLE RICHIESTE ECT DICONO IL VERO (15/10/2026).
//
// Richiesta dell'utente, testuale: «nella to-do list permetti la modifica delle
// richieste aperte per successive integrazioni e\o annotazioni». Il primo giro
// del 15/10/2026 aveva lasciato fuori il TERMINE delle richieste ECT, e AGENTS.md
// lo scriveva: «Il TERMINE non si modifica ancora». Il secondo giro l'ha fatto
// (`scadenza_manuale`, la regola in base44/shared/richiesteEct.ts): una nota che
// dice ancora il contrario manda chi lavora dopo a rifare una cosa che c'e', o a
// leggere il termine da r.scadenza come prima. Qui si prova che le due sezioni di
// AGENTS.md (le richieste ECT e la to-do list) dicono come stanno le cose, e che
// i nomi che citano esistono davvero nel codice, nei due file dello specchio.
// Il comportamento lo prova prove/termineRichiesteEct.mjs, col banco.
//
// node prove/agentsTermineRichieste.mjs
import { existsSync, readFileSync } from 'node:fs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const titolo = (t) => console.log('\n' + t);
// I file sono CRLF: si tolgono i \r prima di cercare.
const sorgente = (p) => {
  const u = new URL('../' + p, import.meta.url);
  return existsSync(u) ? readFileSync(u, 'utf8').replace(/\r/g, '') : '';
};
// Una sezione di AGENTS.md: dal suo titolo al titolo dopo.
const sezione = (testo, inizio) => {
  const i = testo.indexOf(inizio);
  if (i < 0) return '';
  const j = testo.indexOf('\n### ', i + inizio.length);
  return testo.slice(i, j < 0 ? undefined : j);
};
const esporta = (testo, nome) => new RegExp(`export\\s+(?:async\\s+)?function\\s+${nome}\\s*\\(`).test(testo);

const agents = sorgente('AGENTS.md');
const todo = sezione(agents, '### La to-do list: modifica e annotazioni (15/10/2026)');
const richieste = sezione(agents, "### Le richieste ECT: il foglio del 09/10/2026 e il cambio d'anno (15/10/2026)");

titolo('1. LA NOTA VECCHIA NON C\'E\' PIU\'');
verifica('le due sezioni ci sono', !!todo && !!richieste);
// L'indice in cima al file: la sezione della to-do list del 15/10/2026 non c'era,
// e chi cercava dove sta il termine corretto a mano non la trovava.
const indice = (agents.split('\n## ')[1] || '').startsWith('Indice') ? agents.split('\n## ')[1] : '';
verifica('l\'indice ha le due sezioni', /\n  - La to-do list: modifica e annotazioni \(15\/10\/2026\)\n/.test(indice)
  && /\n  - Le richieste ECT: il foglio del 09\/10\/2026 e il cambio d'anno \(15\/10\/2026\)\n/.test(indice));
verifica('nessuno scrive piu\' che il termine non si modifica ancora', !/non si modifica ancora/i.test(agents));
verifica('nessuno scrive piu\' che servira\' un scadenza_manuale', !/servira'? un `?scadenza_manuale/.test(agents));

titolo('2. LA SEZIONE DELLA TO-DO LIST DICE COME SI CORREGGE IL TERMINE');
const puntoTermine = (todo.split('\n').find(r => /^- \*\*Il termine delle richieste ECT si corregge a mano\*\*/.test(r))) || '';
verifica('c\'e\' il punto sul termine corretto a mano', !!puntoTermine);
verifica('nomina il campo, l\'archivio e il caricamento che lo lascia stare',
  /`scadenza_manuale`/.test(puntoTermine) && /RichiestaEct\.jsonc/.test(puntoTermine) && /importaRichiesteEct/.test(puntoTermine) && /importaBlocco/.test(puntoTermine) && /MAI/.test(puntoTermine));
verifica('dice di leggere il termine dalla regola e mai da r.scadenza', /mai da `r\.scadenza`/.test(puntoTermine));
verifica('dice chi lo scrive: solo l\'amministratore, una update, nessuna lettura',
  /solo amministratore/.test(puntoTermine) && /una update, nessuna lettura/.test(puntoTermine) && /salvaTermine/.test(puntoTermine));
verifica('dice com\'e\' a video, gg/mm/aaaa', /corretto a mano; dal foglio: gg\/mm\/aaaa/.test(puntoTermine));
const puntoGiorno = (todo.split('\n').find(r => /^- \*\*Il giorno del foglio non e' una correzione\*\*/.test(r))) || '';
verifica('c\'e\' il punto della revisione: il giorno del foglio non e\' una correzione',
  !!puntoGiorno && /correzioneDelTermine/.test(puntoGiorno) && /non scrive niente/.test(puntoGiorno));
verifica('il punto delle richieste ECT dice che resta anche scadenza_manuale',
  todo.split('\n').some(r => /^- \*\*Richieste ECT\.\*\*/.test(r) && /Resta anche `scadenza_manuale`/.test(r)));
verifica('le prove citano prove/termineRichiesteEct.mjs, e il file c\'e\'',
  /prove\/termineRichiesteEct\.mjs/.test(todo) && existsSync(new URL('./termineRichiesteEct.mjs', import.meta.url)));

titolo('3. LA SEZIONE DELLE RICHIESTE ECT RIMANDA AL TERMINE CORRETTO A MANO');
verifica('il termine letto dalla mail dice che quello corretto a mano vale sopra e nessun caricamento lo tocca',
  /`scadenza_manuale`, 15\/10\/2026\) vale sopra quello della nota/.test(richieste.replace(/\n\s*/g, ' ')) && /nessun caricamento lo tocca/.test(richieste.replace(/\n\s*/g, ' ')));

titolo('4. I NOMI CITATI ESISTONO NEL CODICE');
const ts = sorgente('base44/shared/richiesteEct.ts');
const js = sorgente('src/lib/richiesteEct.js');
for (const nome of ['termineRichiesta', 'scadenzaDi', 'testoTermine', 'oltreIlTermine', 'correzioneDelTermine', 'scadenzaDaNota']) {
  verifica(`${nome}: citata in AGENTS.md ed esportata dai due file dello specchio`,
    agents.includes('`' + nome) && esporta(ts, nome) && esporta(js, nome));
}
const schema = sorgente('base44/entities/RichiestaEct.jsonc');
verifica('scadenza_manuale e\' nell\'archivio, come giorno', /"scadenza_manuale":\s*\{\s*"type":\s*"string",\s*"format":\s*"date"/.test(schema));
verifica('il caricamento del foglio e il ricalcolo dei ritiri non lo nominano, come dice la nota',
  !!sorgente('base44/functions/importaRichiesteEct/entry.ts') && !!sorgente('base44/functions/importaBlocco/entry.ts')
  && !/scadenza_manuale/.test(sorgente('base44/functions/importaRichiesteEct/entry.ts'))
  && !/scadenza_manuale/.test(sorgente('base44/functions/importaBlocco/entry.ts')));
verifica('chi scrive e il campo hanno salvaTermine',
  /const salvaTermine = useCallback/.test(sorgente('src/components/todo/RichiesteEct.jsx')) && /const salvaTermine = async/.test(sorgente('src/components/todo/NoteRichiesta.jsx')));
const assistente = sorgente('base44/shared/strumentiAssistente.ts');
verifica('EcoTyna ha i campi che la nota cita',
  ['scadenza_corretta_a_mano', 'scadenza_dal_foglio', 'nota_termini_corretti'].every(c => assistente.includes(c) && puntoTermine.includes(c)));
verifica('la dashboard legge il termine con oltreIlTermine', /oltreIlTermine\(r, oggi\)/.test(sorgente('base44/shared/cruscotto.ts')));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
