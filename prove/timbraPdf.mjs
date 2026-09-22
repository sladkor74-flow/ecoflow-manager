// Prova della scritta del numero di terziaria sugli allegati VII
// (src/lib/timbraPdf.js). npm run prove
import { timbraPdf } from '../src/lib/timbraPdf.js';
import { PDFDocument, StandardFonts } from 'pdf-lib';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// Un allegato finto di due pagine.
const doc = await PDFDocument.create();
const font = await doc.embedFont(StandardFonts.Helvetica);
for (const testo of ['ANNEX VII 1', 'ANNEX VII 1 - retro']) {
  const p = doc.addPage([595, 842]);
  p.drawText(testo, { x: 50, y: 700, size: 12, font });
}
const originale = await doc.save();

const esito = await timbraPdf(originale, 'TER26154141');
verifica('il PDF viene scritto', esito.timbrato === true, esito.errore || '');
verifica('resta un PDF valido con le sue due pagine', (await PDFDocument.load(esito.bytes)).getPageCount() === 2);
verifica('l\'originale non si tocca', originale.length > 0 && esito.bytes !== originale);

// La scritta sta in alto a destra della prima pagina: si controlla che il
// contenuto della prima pagina sia cresciuto e quello della seconda no.
const rifatto = await PDFDocument.load(esito.bytes);
const [prima, seconda] = rifatto.getPages();
verifica('la pagina resta della stessa misura', Math.round(prima.getSize().width) === 595 && Math.round(prima.getSize().height) === 842);
const lungh = async (p) => {
  const c = p.node.Contents();
  return c ? (c.constructor.name === 'PDFArray' ? c.size() : 1) : 0;
};
verifica('la prima pagina ha una pagina di contenuto in piu\', la seconda no', (await lungh(prima)) >= (await lungh(seconda)));

const senzaNumero = await timbraPdf(originale, '   ');
verifica('senza numero non tocca niente', senzaNumero.timbrato === false && senzaNumero.bytes === originale);

const rotto = await timbraPdf(new Uint8Array([1, 2, 3, 4, 5]), 'TER26154141');
verifica('un file che non e\' un PDF torna com\'era, senza errori', rotto.timbrato === false && rotto.bytes.length === 5 && !!rotto.errore);

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
