// Prova delle due scritture che un utente NON amministratore deve poter fare.
//
// La regola dell'azienda: l'amministratore e' l'unico che modifica i dati, tutti
// gli altri consultano, esportano e APRONO RICHIESTE - piu' le esercitazioni del
// corso RT. Sono due entita' sole, elencate in src/lib/permessi.js come
// ENTITA_LIBERE, e il gestionale lo dice a chi non puo' scrivere: «per un
// caricamento o una correzione apri una richiesta dal modulo Richieste».
//
// Il 01/10/2026 la scansione automatica della piattaforma ha messo da sola
// "create": null su RichiestaUtente (commit 35f1b3d, autore base44-builder[bot]).
// Il form che crea una richiesta si disegna SOLO per chi non e' amministratore, e
// l'amministratore non ha nessun pulsante per crearla: con la create chiusa
// quella frase diventa un vicolo chiuso, e nessuno se ne accorge finche' un
// utente normale non prova a scrivere.
//
// Questa prova e' la guardia: se una scansione futura richiude quelle create, o
// riapre le letture, qui si rompe prima di arrivare in produzione. npm run prove
import { readFileSync, readdirSync } from 'node:fs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const ENTITA = (nome) => {
  const testo = readFileSync(new URL(`../base44/entities/${nome}.jsonc`, import.meta.url), 'utf8');
  // .jsonc: i commenti si tolgono prima di leggere. Solo le righe che cominciano
  // con // (quelle di questo progetto), per non toccare le stringhe con //.
  return JSON.parse(testo.split('\n').filter(r => !/^\s*\/\//.test(r)).join('\n'));
};

const LIBERE = ['RichiestaUtente', 'EsercitazioneRT'];

console.log('LE DUE ENTITA\' CHE UN UTENTE PUO\' SCRIVERE');
const permessi = readFileSync(new URL('../src/lib/permessi.js', import.meta.url), 'utf8');
const elenco = permessi.match(/ENTITA_LIBERE = new Set\(\[([^\]]*)\]\)/);
verifica('src/lib/permessi.js le elenca, e sono esattamente queste due',
  !!elenco && LIBERE.every(n => elenco[1].includes(n)) && (elenco[1].match(/'/g) || []).length === 4, elenco && elenco[1]);
// La stessa lista vive anche nella guardia del server: se una delle due si
// allontanasse, il browser e il server non direbbero piu' la stessa cosa.
const permessiServer = readFileSync(new URL('../base44/shared/permessi.ts', import.meta.url), 'utf8');
verifica('e il server dice la stessa frase a chi non puo\' scrivere',
  /apri una richiesta dal modulo Richieste/.test(permessiServer) && /apri una richiesta dal modulo Richieste/.test(permessi));

for (const nome of LIBERE) {
  const e = ENTITA(nome);
  const rls = e.rls || {};
  console.log(`\n${nome.toUpperCase()}`);
  // LA CREATE RESTA APERTA. Non "true perche' comodo": e' l'unica scrittura
  // prevista per un utente normale, e una condizione su created_by_id non
  // aggiunge difese - quel campo lo riempie la piattaforma, non il browser,
  // quindi nessuno puo' intestare un record a un altro - mentre rischia di far
  // fallire la creazione se il motore la valuta prima di riempirlo.
  verifica('un utente non amministratore puo\' creare', rls.create === true, JSON.stringify(rls.create));
  verifica('e la create non e\' mai null, che non vuol dire niente', rls.create !== null);
  // LA LETTURA RESTA FILTRATA. Con read: true il server mandava a ogni utente i
  // record di tutti, e il "vedo solo i miei" era soltanto un filtro nel browser.
  const read = rls.read;
  verifica('la lettura non e\' aperta a tutti', read !== true && !!read, JSON.stringify(read));
  const rami = (read && read.$or) || [];
  verifica('vede i propri record, riconosciuti da created_by_id',
    rami.some(r => r && r.created_by_id === '{{user.id}}'), JSON.stringify(rami));
  verifica('e l\'amministratore vede tutto', rami.some(r => r && r.user_condition && r.user_condition.role === 'admin'), JSON.stringify(rami));
  // Modificare e cancellare restano dell'amministratore: e' la prima delle tre
  // regole dei permessi.
  verifica('cancellare resta all\'amministratore', rls.delete && rls.delete.user_condition && rls.delete.user_condition.role === 'admin', JSON.stringify(rls.delete));
}

console.log('\nLE REGOLE RLS DI TUTTE LE ENTITA\'');
const file = readdirSync(new URL('../base44/entities/', import.meta.url)).filter(n => n.endsWith('.jsonc'));
verifica('ci sono tutte le entita\' (piu\' di cinquanta)', file.length > 50, String(file.length));
const nulli = [];
const conPrefisso = [];
for (const n of file) {
  const testo = readFileSync(new URL(`../base44/entities/${n}`, import.meta.url), 'utf8');
  const righe = testo.split('\n').filter(r => !/^\s*\/\//.test(r));
  // "create": null e simili: non esprimono ne' un permesso ne' un divieto. In
  // questo progetto un divieto si scrive user_condition role admin.
  for (const r of righe) if (/"(create|read|update|delete)"\s*:\s*null/.test(r)) nulli.push(`${n}: ${r.trim()}`);
  // Il prefisso "data." nelle condizioni: comparso una volta sola, scritto
  // dalla scansione automatica, e nello stesso commit lo stesso bot ha usato il
  // nome nudo su un'altra entita'. Almeno una delle due forme e' sbagliata, e
  // qual e' la giusta va chiesto al supporto, non indovinato. Finche' non si sa,
  // non ne vogliamo in archivio: una condizione che non corrisponde a niente
  // rende invisibili i propri record e il guasto non si vede dall'account
  // dell'amministratore.
  for (const r of righe) if (/"data\.[a-z_]+"\s*:/.test(r)) conPrefisso.push(`${n}: ${r.trim()}`);
}
verifica('nessuna regola e\' scritta come null', nulli.length === 0, nulli.join(' | '));
verifica('nessuna condizione usa il prefisso "data." non confermato', conPrefisso.length === 0, conPrefisso.join(' | '));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
