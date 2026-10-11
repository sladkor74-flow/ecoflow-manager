// Prova della PRATICA DI IRIGOM SULL'EXTRA RACCOLTA: SCRIVE SOLO SULLA RIGA SUA
// (chiusura dell'audit, 11/10/2026).
//
// Per la rete la pratica rifiuta quando trova due gemelle sullo stesso mese. Per
// l'extra raccolta prendeva con un find la prima riga EXTRA di Irigom del mese,
// nell'ordine in cui la piattaforma la restituisce. Ma sull'extra due campagne
// nello stesso mese sono legittime: luglio con A = 200 kg scritti a mano e B =
// 300 kg scritti dalla pratica di luglio; la pratica di agosto porta 100 kg di
// luglio. Se il find tornava A, A diventava 400 e B restava 300: luglio 700 kg
// invece di 600, e la campagna di A spariva dalla nota. Se tornava B il conto
// era giusto: l'esito dipendeva dall'ordine.
// npm run prove
import { readFileSync } from 'node:fs';
import { rigaExtraDellaPratica, rigaScrittaDallaPratica, SEGNO_PRATICA_EXTRA } from '../src/lib/praticaIrigom.js';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const sorgente = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\r/g, '');

const IRIGOM = 'Irigom S.r.l.';
const suIrigom = (d) => /irigom/i.test(d.sito || '');
const A = { id: 'A', sito: IRIGOM, canale: 'EXTRA_RACCOLTA', mese: 'Luglio', anno: 2026, quantita_kg: 200, note: 'Campagna del comune, scritta a mano' };
const B = { id: 'B', sito: IRIGOM, canale: 'EXTRA_RACCOLTA', mese: 'Luglio', anno: 2026, quantita_kg: 300, note: 'Dichiarata con la pratica di Luglio 2026, terziaria TER26000001 (allegato VII 12): 300 kg.' };
const RETE = { id: 'R', sito: IRIGOM, canale: 'RETE', mese: 'Luglio', anno: 2026, quantita_kg: 500000, note: '' };
const ALTRO = { id: 'X', sito: 'GATIM SRL', canale: 'EXTRA_RACCOLTA', mese: 'Luglio', anno: 2026, quantita_kg: 900, note: '' };

console.log('IL SEGNO DELLA PRATICA');
{
  verifica('la pratica lo mette nelle sue note da sempre: «Dichiarata con la pratica di»', SEGNO_PRATICA_EXTRA === 'Dichiarata con la pratica di ');
  verifica('B porta il segno, A no', rigaScrittaDallaPratica(B) && !rigaScrittaDallaPratica(A));
  const c = sorgente('src/components/dichiarazioni/PraticaIrigom.jsx');
  verifica('e la pratica scrive il segno dalla costante, non da una frase copiata', c.includes('`${SEGNO_PRATICA_EXTRA}${mese} ${anno}, terziaria'));
}

console.log('IL CASO DELL\'AUDIT: A SCRITTA A MANO, B DALLA PRATICA');
{
  // Nei due ordini in cui la piattaforma le puo' restituire, la risposta e' la stessa.
  for (const righe of [[A, B, RETE, ALTRO], [B, A, ALTRO, RETE]]) {
    const e = rigaExtraDellaPratica(righe, { suIrigom, anno: 2026, mese: 'Luglio' });
    verifica(`la pratica aggiorna B, la sua, comunque siano ordinate (${righe.map(r => r.id).join('')})`, e.azione === 'aggiorna' && e.esistente && e.esistente.id === 'B', JSON.stringify(e));
  }
  // La CONTROPROVA, cioe' il codice di prima: il find prende la prima riga EXTRA
  // di Irigom, e con A in testa scrive su A.
  const vecchio = (righe) => righe.find(d => suIrigom(d) && d.canale === 'EXTRA_RACCOLTA');
  verifica('controprova: il find di prima, con A in testa, scriveva su A', vecchio([A, B]).id === 'A');
  // I conti: con la riga giusta luglio fa 600, con quella sbagliata 700.
  const nuovo = 300 + 100; // B, la parte delle altre pratiche (300) piu' quella di agosto (100)
  verifica('con la riga giusta luglio fa 200 + 400 = 600 kg', A.quantita_kg + nuovo === 600);
  verifica('con quella sbagliata faceva 400 + 300 = 700 kg', nuovo + B.quantita_kg === 700);
}

console.log('SENZA UNA RIGA SUA');
{
  const vuoto = rigaExtraDellaPratica([RETE, ALTRO], { suIrigom, anno: 2026, mese: 'Luglio' });
  verifica('nel mese non c\'e\' niente: crea', vuoto.azione === 'crea' && vuoto.esistente === null);
  // Una riga sola, senza segno: e' quella del mese, come la pratica ha sempre
  // fatto; da quel momento porta il segno.
  const una = rigaExtraDellaPratica([A, RETE], { suIrigom, anno: 2026, mese: 'Luglio' });
  verifica('una riga sola senza segno: la aggiorna, come prima', una.azione === 'aggiorna' && una.esistente.id === 'A');
  // Due righe senza segno: quale aggiornare non lo sa nessuno. Si rifiuta e si
  // dice quali, come per la rete.
  const A2 = { ...A, id: 'A2', quantita_kg: 150, note: 'Seconda campagna, scritta a mano' };
  const due = rigaExtraDellaPratica([A, A2, RETE], { suIrigom, anno: 2026, mese: 'Luglio' });
  verifica('due righe senza segno: rifiuta', due.azione === 'rifiuta' && due.esistente === null && due.pari.length === 2);
  verifica('e il motivo dice il mese e quali sono, coi chili all\'italiana',
    /Luglio 2026/.test(due.motivo) && due.motivo.includes('200 kg') && due.motivo.includes('150 kg') && due.motivo.includes('Seconda campagna'), due.motivo);
  // Due righe col segno: un doppione della pratica stessa.
  const B2 = { ...B, id: 'B2', quantita_kg: 1300 };
  const doppio = rigaExtraDellaPratica([B, B2, A], { suIrigom, anno: 2026, mese: 'Luglio' });
  verifica('due righe col segno: rifiuta e le nomina', doppio.azione === 'rifiuta' && doppio.pari.length === 2 && doppio.motivo.includes('1.300 kg'), doppio.motivo);
  verifica('le righe degli altri siti e degli altri canali non contano',
    rigaExtraDellaPratica([ALTRO, RETE], { suIrigom, anno: 2026, mese: 'Luglio' }).azione === 'crea');
}

console.log('LA PRATICA CHIEDE PRIMA DI SCRIVERE');
{
  const c = sorgente('src/components/dichiarazioni/PraticaIrigom.jsx');
  verifica('il find sulla prima riga EXTRA non c\'e\' piu\'',
    !c.includes(".find(d => suIrigom(d) && d.canale === 'EXTRA_RACCOLTA')"));
  const piano = c.indexOf('const pianoExtra = [];');
  const rete = c.indexOf('const rete = reteEsistente');
  verifica('le righe dell\'extra si scelgono prima di scrivere la rete: una pratica non resta registrata a meta\'',
    piano > 0 && rete > piano && c.slice(piano, rete).includes("if (esitoExtra.azione === 'rifiuta') throw new Error(esitoExtra.motivo);"));
  verifica('e si scrive solo sulla riga scelta', c.includes('for (const { x, giaExtra } of pianoExtra) {'));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
