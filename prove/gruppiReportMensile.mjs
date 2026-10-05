// Le schede del Report Mensile sono scritte in due posti: in
// base44/shared/reportMensile.ts, che le calcola, e in src/pages/ReportMensile.jsx,
// che deve sapere quali pivot chiedere prima di chiederle (la pagina non puo'
// importare dal backend). Due elenchi della stessa cosa restano uguali solo se
// qualcosa lo controlla: qui.
//
// Il 05/10/2026 una pivot nuova e' stata aggiunta solo al backend ed e' rimasta
// invisibile: c'era, si poteva calcolare, ma nessuno la chiedeva. npm run prove
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PIVOT_DEFS, GRUPPI } from '../base44/shared/reportMensile.ts';

const radice = join(dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const pagina = readFileSync(join(radice, 'src/pages/ReportMensile.jsx'), 'utf8');

// L'elenco della pagina, letto dal testo: chiave della scheda -> pivot in ordine.
const dallaPagina = (() => {
  const blocco = pagina.match(/const GRUPPI = \[([\s\S]*?)\n\];/);
  if (!blocco) return null;
  const righe = [...blocco[1].matchAll(/chiave: '([^']+)'[\s\S]*?pivot: \[([^\]]*)\]/g)];
  return righe.map(([, chiave, lista]) => ({ chiave, pivot: [...lista.matchAll(/'([^']+)'/g)].map(m => m[1]) }));
})();

verifica("l'elenco delle schede si legge nella pagina", !!dallaPagina && dallaPagina.length > 0);

if (dallaPagina) {
  verifica('le schede sono le stesse, nello stesso ordine',
    JSON.stringify(dallaPagina.map(g => g.chiave)) === JSON.stringify(GRUPPI.map(g => g.chiave)),
    JSON.stringify([dallaPagina.map(g => g.chiave), GRUPPI.map(g => g.chiave)]));
  for (const g of GRUPPI) {
    const sua = dallaPagina.find(x => x.chiave === g.chiave);
    verifica(`la scheda ${g.chiave} chiede esattamente le pivot che il backend le da'`,
      !!sua && JSON.stringify(sua.pivot) === JSON.stringify(g.pivot),
      JSON.stringify([sua && sua.pivot, g.pivot]));
  }
}

// Nessuna pivot deve restare fuori da ogni scheda: esisterebbe senza che nessuno
// la veda, che e' il difetto del 05/10/2026 visto da un altro lato.
const nelleSchede = new Set(GRUPPI.flatMap(g => g.pivot));
const fuori = Object.keys(PIVOT_DEFS).filter(k => !nelleSchede.has(k));
verifica('ogni pivot definita sta in una scheda', fuori.length === 0, fuori.join(', '));
const inventate = [...nelleSchede].filter(k => !PIVOT_DEFS[k]);
verifica('e ogni pivot chiesta da una scheda esiste davvero', inventate.length === 0, inventate.join(', '));

// L'archivio di ogni pivot serve al riepilogo delle date da sistemare sotto la
// tabella: una pivot senza archivio perde quell'avviso in silenzio.
const archivio = pagina.match(/const ARCHIVIO_PIVOT = \{([\s\S]*?)\n\};/);
const conArchivio = archivio ? new Set([...archivio[1].matchAll(/(\w+):\s*'/g)].map(m => m[1])) : new Set();
verifica('ogni pivot ha il suo archivio nel riepilogo delle date',
  Object.keys(PIVOT_DEFS).every(k => conArchivio.has(k)),
  Object.keys(PIVOT_DEFS).filter(k => !conArchivio.has(k)).join(', '));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
