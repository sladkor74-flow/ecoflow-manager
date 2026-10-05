// Le colonne della tabella delle rilevazioni (src/components/giacenze/StoccaggiManager.jsx)
// devono essere tante quante le intestazioni, su ogni riga.
//
// Il 06/10/2026, aggiungendo la giacenza di oggi accanto alla lettura, e' saltato
// fuori che la riga "Nessuna rilevazione" aveva un colSpan di 12 su una tabella
// che di colonne ne aveva 13: un difetto che c'era gia' e che nessuno vedeva,
// perche' si mostra solo quando la tabella e' vuota. Le colonne di questa tabella
// sono fisse, quindi si possono contare leggendo il sorgente. npm run prove
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const radice = join(dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const sorgente = readFileSync(join(radice, 'src/components/giacenze/StoccaggiManager.jsx'), 'utf8');

// Le celle di una riga, contando i colSpan. Una riga che costruisce celle dentro
// una mappa non si puo' contare leggendo il testo: qui non ce ne sono, e se un
// giorno ce ne fossero la prova lo dice invece di far finta di aver contato.
const celle = (riga, tag) => {
  let n = 0;
  for (const m of riga.matchAll(new RegExp('<' + tag + '\\b([^>]*)>', 'g'))) {
    const c = /colSpan=\{(\d+)\}/.exec(m[1]);
    n += c ? Number(c[1]) : 1;
  }
  return n;
};
// Una cella costruita in un ciclo non si conta leggendo il testo: qui nessuna lo
// e' (le mappe dentro le celle fanno paragrafi e bottoni, non colonne), e questa
// prova controlla che resti cosi'.
const generaCelle = (testo) => /=>\s*\(?\s*<td/.test(testo);

const pezzo = (da, a) => sorgente.slice(sorgente.indexOf(da), sorgente.indexOf(a));
const testa = pezzo('<thead', '</thead>').split('<tr').slice(1);
const corpo = pezzo('<tbody>', '</tbody>').split(/<tr\b/).slice(1);

verifica('la tabella ha due righe di intestazione: i gruppi e i nomi delle colonne', testa.length === 2, String(testa.length));
const larghezza = celle(testa[1], 'th');
verifica('le colonne sono quindici', larghezza === 15, String(larghezza));
verifica('la riga dei gruppi copre esattamente le stesse colonne',
  celle(testa[0], 'th') === larghezza, `${celle(testa[0], 'th')} contro ${larghezza}`);

verifica('nessuna cella e\' costruita in un ciclo: le colonne si possono contare', !generaCelle(sorgente));
for (const [i, r] of corpo.entries()) {
  verifica(`la riga ${i + 1} del corpo ha tutte le colonne`, celle(r, 'td') === larghezza,
    `${celle(r, 'td')} contro ${larghezza}`);
}

// La giacenza di oggi e la lettura sono due cose diverse e si devono distinguere.
verifica('l\'intestazione dice quali colonne sono la lettura e quali la giacenza di oggi',
  /Letto a portale quel giorno/.test(sorgente) && /Giacenza di oggi/.test(sorgente));
verifica('la giacenza di oggi arriva dal calcolo, non dalla rilevazione',
  /giacenzaPerSito/.test(sorgente) && /oggi\?\.giacenza_rete_t|oggi\.giacenza_rete_t/.test(sorgente));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
