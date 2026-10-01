// I DOCUMENTI AZIENDALI NON SALGONO IN AREA PUBBLICA. MAI.
//
// Regola dell'utente, 30/09/2026: "fai in modo che documenti aziendali non girino
// per il web, questa cosa della sicurezza e della privacy e' molto importante,
// anzi stringente".
//
// Il perche' e' tecnico e viene dall'assistenza della piattaforma: un file
// caricato con UploadFile ha un indirizzo che "funziona per chiunque abbia il
// link", per sempre, e NON esiste nessun modo di cancellare un file caricato -
// ne' dall'SDK ne' dal pannello. Un file pubblico e' quindi una porta che si apre
// una volta e non si richiude piu'. Con UploadPrivateFile, invece, il file si
// apre solo con un link firmato che scade in pochi minuti: la porta si chiude da
// sola, e non serve nessuna cancellazione.
//
// Questa prova e' una guardia: se qualcuno rimette UploadFile, fallisce. Non
// controlla che il codice funzioni, controlla che una decisione presa resti presa.
//
// npm run prove
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { eIndirizzoDiArchivio, riferimentoDalCorpo } from '../base44/shared/fileScaricabile.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const radice = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

function tuttiIFile(cartella, out = []) {
  for (const voce of readdirSync(cartella)) {
    if (voce === 'node_modules' || voce === '.git' || voce === 'dist') continue;
    const percorso = join(cartella, voce);
    if (statSync(percorso).isDirectory()) tuttiIFile(percorso, out);
    else if (/\.(js|jsx|ts|tsx)$/.test(voce)) out.push(percorso);
  }
  return out;
}

const file = [...tuttiIFile(join(radice, 'src')), ...tuttiIFile(join(radice, 'base44'))];

console.log('NESSUN CARICAMENTO IN AREA PUBBLICA');
const colpevoli = [];
for (const f of file) {
  const testo = readFileSync(f, 'utf8');
  // UploadFile da solo, non UploadPrivateFile: il confine di parola prima di
  // "UploadFile" esclude il nome lungo.
  const righe = testo.split(/\r?\n/);
  righe.forEach((riga, i) => {
    if (/(?<!Private)\bUploadFile\s*\(/.test(riga) && !/UploadPrivateFile/.test(riga)) {
      colpevoli.push(`${f.slice(radice.length)}:${i + 1}`);
    }
  });
}
verifica('nessuna chiamata a UploadFile in tutto il repo', colpevoli.length === 0, colpevoli.join(', '));

console.log('E I CARICAMENTI CHE CI SONO USANO QUELLO PRIVATO');
const privati = [];
for (const f of file) {
  if (/UploadPrivateFile\s*\(/.test(readFileSync(f, 'utf8'))) privati.push(f.slice(radice.length));
}
verifica('i punti di caricamento esistono ancora', privati.length >= 8, `${privati.length} trovati`);
// I quattro che sono stati convertiti il 30/09/2026: se uno sparisce, qualcuno
// ha cambiato strada e va guardato.
for (const atteso of ['PdrUpload.jsx', 'SecondarieUpload.jsx', 'RichiesteEct.jsx', 'CaricamentoDati.jsx']) {
  verifica(`${atteso} carica in privato`, privati.some(p => p.endsWith(atteso)), privati.join(' '));
}

console.log('CHI SCARICA PASSA DAL LINK FIRMATO');
{
  const scaricabile = readFileSync(join(radice, 'base44/shared/fileScaricabile.ts'), 'utf8');
  verifica('un file privato si fa firmare', /CreateFileSignedUrl/.test(scaricabile));
  // Un indirizzo pubblico vecchio si legge ancora, ma solo se e' davvero uno
  // dei nostri: la scansione di sicurezza del 02/10/2026 ha trovato che qui
  // passava qualunque indirizzo, e il server lo scaricava.
  verifica('un indirizzo pubblico si controlla prima di scaricarlo', /eIndirizzoDiArchivio\(url\) \? url : ''/.test(scaricabile), 'il ramo file_url non controlla l\'origine');
}

// IL SERVER NON VA DOVE GLI SI DICE DI ANDARE (02/10/2026).
//
// Il controllo dell'origine, provato sul serio: non basta leggere il codice,
// perche' le forme che somigliano a un indirizzo buono sono tante.
console.log('\nL\'INDIRIZZO DI UN FILE NOSTRO, E TUTTO QUELLO CHE GLI SOMIGLIA');
{
  const nostro = 'https://media.base44.com/files/public/6a7a47eec65778e3fc82175b/7845fd513_GESTIONEECOTYRE2026.xlsx';
  verifica('un indirizzo vero dell\'area pubblica passa', eIndirizzoDiArchivio(nostro));
  const rifiutati = [
    ['un indirizzo interno', 'http://169.254.169.254/latest/meta-data/'],
    ['lo stesso host ma senza cifratura', 'http://media.base44.com/files/public/x/y.xlsx'],
    ['un host che comincia come il nostro', 'https://media.base44.com.altro.sito/files/public/x/y.xlsx'],
    ['il nostro host messo come utente', 'https://media.base44.com@altro.sito/files/public/x/y.xlsx'],
    ['un altro percorso dello stesso host', 'https://media.base44.com/api/interno'],
    ['un percorso che prova a risalire', 'https://media.base44.com/files/public/../../api/interno'],
    ['un indirizzo di rete locale', 'http://127.0.0.1:8080/x.xlsx'],
    ['un file del computer', 'file:///C:/Windows/win.ini'],
    ['uno schema inventato', 'prova://primarie.xlsx'],
    ['niente', ''],
  ];
  for (const [come, url] of rifiutati) verifica(`si rifiuta ${come}`, !eIndirizzoDiArchivio(url), url);
}

console.log('\nIL FILE DI UNA RICHIESTA SI PRENDE SOLO COME file_uri');
{
  verifica('un file_uri passa', riferimentoDalCorpo({ file_uri: 'abc' }).rif.file_uri === 'abc');
  const conUrl = riferimentoDalCorpo({ file_url: 'https://media.base44.com/files/public/x/y.xlsx' });
  verifica('un indirizzo nel corpo si rifiuta, anche se e\' dei nostri', !conUrl.rif && /non si scarica/.test(conUrl.errore), JSON.stringify(conUrl));
  const vuoto = riferimentoDalCorpo({});
  verifica('senza niente non e\' un errore di sicurezza, e\' un file che manca', !vuoto.rif && vuoto.errore === '');
}

for (const fn of ['importPdrFile', 'importEcotyreFile', 'importaRichiesteEct', 'seedTargetMensile']) {
  const testo = readFileSync(join(radice, 'base44/functions', fn, 'entry.ts'), 'utf8');
  // seedTargetMensile e' il caso a parte: non ha nessun chiamante nel repo, non
  // passa dal nocciolo condiviso ed e' per questo che era sfuggita a questa
  // guardia, che prima non la guardava nemmeno. Lei il fetch dell'indirizzo lo
  // fa ancora, ma solo dopo aver controllato che sia dell'area pubblica
  // dell'applicazione: quello che conta e' che il controllo ci sia.
  if (fn === 'seedTargetMensile') {
    verifica(`${fn} controlla l'origine prima di scaricare`, /eIndirizzoDiArchivio\(file_url\)/.test(testo), 'manca il controllo sull\'origine');
    const prima = testo.indexOf('eIndirizzoDiArchivio(file_url)');
    verifica(`${fn} lo controlla PRIMA del fetch`, prima > 0 && prima < testo.indexOf('fetch(file_url)'), 'il controllo viene dopo il fetch');
    continue;
  }
  verifica(`${fn} non scarica piu' un indirizzo pubblico a mano`, !/fetch\(file_url\)/.test(testo), 'fetch(file_url) e ancora li');
  verifica(`${fn} non prende un indirizzo dal corpo`, /riferimentoDalCorpo\(/.test(testo), 'manca il controllo sull\'indirizzo');
  verifica(`${fn} accetta un file privato`, /file_uri/.test(testo));
}

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
