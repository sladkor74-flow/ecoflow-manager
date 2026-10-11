// GLI IMPORTI DELLE PAGINE DEI SOLDI SONO ALL'ITALIANA (src/lib/formatoSoldi.js,
// chiusura dell'audit, 11/10/2026).
//
// Il fatto. Proprio dove si fattura i numeri non erano all'italiana: nella
// dashboard dell'attiva e nello storico «€ {(doc.totale || 0).toFixed(2)}»
// scriveva «€ 372976.50» - punto per i decimali, niente separatore delle
// migliaia - e zero se il totale mancava; il dettaglio di una riga «€ 0.2020».
// La regola: punto per le migliaia, virgola per i decimali, euro a due decimali,
// e «—» per un valore che manca. Questa prova tiene ferme le due funzioni e
// cade se una pagina dei soldi torna a mostrare un importo con .toFixed(.
// npm run prove
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const radice = fileURLToPath(new URL('..', import.meta.url));
const sorgente = (p) => readFileSync(join(radice, p), 'utf8').replace(/\r/g, '');

let soldi = {};
try { soldi = await import('../src/lib/formatoSoldi.js'); } catch (e) { verifica('src/lib/formatoSoldi.js si carica', false, e.message); }
const { euro = () => '', prezzoUnitario = () => '' } = soldi;

console.log('UN IMPORTO');
verifica('372.976,50: punto per le migliaia, virgola per i decimali', euro(372976.5) === '€ 372.976,50', euro(372976.5));
verifica('sempre due decimali', euro(202) === '€ 202,00' && euro(0.1 + 0.2) === '€ 0,30', `${euro(202)} ${euro(0.1 + 0.2)}`);
verifica('le migliaia anche a quattro cifre', euro(1234.5) === '€ 1.234,50', euro(1234.5));
verifica('un negativo resta negativo', euro(-1234.5) === '€ -1.234,50', euro(-1234.5));
verifica('zero e zero', euro(0) === '€ 0,00', euro(0));
verifica('ma un valore che manca e una lineetta, non zero', euro(null) === '—' && euro(undefined) === '—' && euro('') === '—' && euro('abc') === '—',
  JSON.stringify([euro(null), euro(undefined), euro(''), euro('abc')]));

console.log('UN PREZZO UNITARIO');
verifica('al chilo con i decimali che servono: 0,202', prezzoUnitario(0.202) === '€ 0,202', prezzoUnitario(0.202));
verifica('a tonnellata con due: 202,00', prezzoUnitario(202) === '€ 202,00', prezzoUnitario(202));
verifica('mai piu di quattro', prezzoUnitario(0.123456) === '€ 0,1235', prezzoUnitario(0.123456));
verifica('e la lineetta se manca', prezzoUnitario(null) === '—');

console.log('LE PAGINE DEI SOLDI NON USANO .toFixed( PER MOSTRARE UN IMPORTO');
{
  const pagine = [
    ...readdirSync(join(radice, 'src/components/fatturazione')).filter(f => f.endsWith('.jsx')).map(f => `src/components/fatturazione/${f}`),
    'src/pages/ExtraRaccolta.jsx',
  ];
  const conToFixed = pagine.filter(p => /\.toFixed\(/.test(sorgente(p)));
  verifica('nessuna pagina della fatturazione o dell extra raccolta usa .toFixed(', conToFixed.length === 0, conToFixed.join(', '));
  // E chi mostra i totali non trasforma un valore mancante in zero prima di
  // formattarlo: «—» e' compito di euro().
  for (const p of ['src/components/fatturazione/AttivaDashboard.jsx', 'src/components/fatturazione/StoricoFatturazione.jsx', 'src/components/fatturazione/RigaDetailModal.jsx', 'src/components/fatturazione/AttivaDetail.jsx']) {
    const t = sorgente(p);
    verifica(`${p.split('/').pop()} usa formatoSoldi`, t.includes("from '@/lib/formatoSoldi'"));
    verifica(`${p.split('/').pop()} non scrive zero per un importo che manca`, !/euro\([^)]*\|\|\s*0\)/.test(t) && !/formatNumber\([^,]*\|\|\s*0/.test(t), (t.match(/(euro|formatNumber)\([^)]*\|\|\s*0[^)]*\)/) || [''])[0]);
  }
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
