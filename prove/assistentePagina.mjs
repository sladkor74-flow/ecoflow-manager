// Prova della PAGINA DI ECOTYNA (chiusura dell'audit, 11/10/2026).
//
// 1. /assistente?domanda=... scrive la domanda nella casella e NON la invia: la
//    manda l'utente. Poi la domanda esce dall'indirizzo.
// 2. Un nome solo, EcoTyna: nel menu era «Assistente», nel titolo «Assistente»,
//    nella casella «Chiedi all'Assistente», nelle risposte «EcoTyna».
// 3. Gli esempi fissi senza quello superato sul FIR digitale «dal 16 settembre».
// 4. Ogni strumento ha il suo nome in italiano sotto «Dove ho guardato»: uno
//    strumento nuovo senza etichetta compariva col nome tecnico.
// Le pagine non girano senza un browser: si leggono i sorgenti, senza i \r.
// npm run prove
import { readFileSync } from 'node:fs';
import { STRUMENTI } from '../base44/shared/strumentiAssistente.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const sorgente = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\r/g, '');
// Il testo che si vede: senza i commenti e senza i nomi delle entita' e delle funzioni.
const aVideo = (s) => s.split('\n').filter(r => !/^\s*(\/\/|\*|\/\*)/.test(r)).join('\n')
  .replace(/\b(DomandaAssistente|ConoscenzaAssistente|chiediAssistente|ChatAssistente)\b/g, '');

const pagina = sorgente('src/pages/Assistente.jsx');
const chat = sorgente('src/components/assistente/ChatAssistente.jsx');

console.log('1. LA DOMANDA DA UN\'ALTRA PAGINA SI SCRIVE, NON SI INVIA');
verifica('la pagina legge ?domanda=', /params\.get\('domanda'\)/.test(pagina));
verifica('e la passa alla chat', /<ChatAssistente domandaIniziale=\{domanda\} \/>/.test(pagina));
verifica('con una domanda si apre la scheda delle domande', /const scheda = domanda \? 'domande'/.test(pagina));
verifica('poi la toglie dall\'indirizzo, cosi\' non torna a ogni ricarica', /resto\.delete\('domanda'\)/.test(pagina) && /setParams\(resto, \{ replace: true \}\)/.test(pagina));
verifica('la chat accetta la domanda iniziale', /export default function ChatAssistente\(\{ domandaIniziale = '' \} = \{\}\)/.test(chat));
const effetto = (chat.match(/useEffect\(\(\) => \{\n\s*const q = String\(domandaIniziale[\s\S]*?\}, \[domandaIniziale\]\);/) || [''])[0];
verifica('la scrive nella casella di una domanda nuova', /setTesto\(q\.slice\(0, 4000\)\)/.test(effetto) && /setAttiva\(null\)/.test(effetto), effetto);
verifica('e non la invia', effetto && !/invia\(/.test(effetto), effetto);

console.log('2. UN NOME SOLO: ECOTYNA');
const menu = sorgente('src/components/Layout.jsx');
verifica('la voce del menu si chiama EcoTyna', /\{ label: 'EcoTyna', path: '\/assistente'/.test(menu));
verifica('il titolo della pagina e\' EcoTyna', /<h1[^>]*>.*EcoTyna<\/h1>/.test(pagina) && !/> Assistente<\/h1>/.test(pagina));
verifica('la casella dice «Chiedi a EcoTyna»', chat.includes('Chiedi a EcoTyna') && !chat.includes("Chiedi all'Assistente"));
for (const f of ['ChatAssistente', 'BaseConoscenza', 'CorsoRT', 'EsercitazioneRT', 'EcoTyna', 'EcoTynaAngolo', 'EcoTynaFoto']) {
  const testo = aVideo(sorgente(`src/components/assistente/${f}.jsx`));
  verifica(`${f}: a video non c'e' piu' «l'Assistente»`, !/[Ll](?:'|\\')Assistente|dell(?:'|\\')Assistente|all(?:'|\\')Assistente/.test(testo),
    (testo.match(/.{0,40}Assistente.{0,40}/) || [''])[0]);
}

console.log('3. GLI ESEMPI');
const esempi = (chat.match(/const ESEMPI = \[([\s\S]*?)\];/) || ['', ''])[1];
verifica('niente piu\' l\'esempio superato sul FIR digitale «dal 16 settembre»', esempi && !/16 settembre/.test(esempi) && !/FIR digitale/.test(esempi), esempi);
verifica('e restano cinque esempi', (esempi.match(/^\s*'/gm) || []).length === 5, esempi);

console.log('4. OGNI STRUMENTO HA IL SUO NOME IN ITALIANO');
const etichette = (chat.match(/const ETICHETTE_STRUMENTO = \{([\s\S]*?)\n\};/) || ['', ''])[1];
for (const s of STRUMENTI) {
  verifica(`etichetta per ${s.nome}`, new RegExp(`\\b${s.nome}: '`).test(etichette));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
