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
  verifica('e un file pubblico vecchio si legge ancora', /return testo\(rif && rif\.file_url\)/.test(scaricabile));
}
for (const fn of ['importPdrFile', 'importEcotyreFile', 'importaRichiesteEct']) {
  const testo = readFileSync(join(radice, 'base44/functions', fn, 'entry.ts'), 'utf8');
  verifica(`${fn} accetta un file privato`, /file_uri/.test(testo));
  verifica(`${fn} non scarica piu' un indirizzo pubblico a mano`, !/fetch\(file_url\)/.test(testo), 'fetch(file_url) e ancora li');
}

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
