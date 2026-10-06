// Alcune regole servono sia alle funzioni sia alle pagine, e le pagine non
// possono importare da base44/shared: ne esiste uno specchio in src/lib. Due
// copie della stessa regola restano uguali solo se qualcosa lo controlla: qui.
// Lo specchio puo' differire dall'originale solo per l'intestazione di commento e
// per le righe di import. Si lancia con: npm run prove
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const radice = join(dirname(fileURLToPath(import.meta.url)), '..');
const SPECCHI = [
  ['base44/shared/giornoItaliano.ts', 'src/lib/giornoItaliano.js'],
  ['base44/shared/movimenti.ts', 'src/lib/movimenti.js'],
  ['base44/shared/canaleSecondaria.ts', 'src/lib/canaleSecondaria.js'],
  ['base44/shared/richiesteEct.ts', 'src/lib/richiesteEct.js'],
  ['base44/shared/todoOrdini.ts', 'src/lib/todoOrdini.js'],
  ['base44/shared/dichiarazioniImpianti.ts', 'src/lib/dichiarazioniImpianti.js'],
  ['base44/shared/proiezioneSecondarie.ts', 'src/lib/proiezioneSecondarie.js'],
  ['base44/shared/simulazioneViaggi.ts', 'src/lib/simulazioneViaggi.js'],
  ['base44/shared/limiteRichieste.ts', 'src/lib/limiteRichieste.js'],
  ['base44/shared/annoTarget.ts', 'src/lib/annoTarget.js'],
  ['base44/shared/termineRegistrazione.ts', 'src/lib/termineRegistrazione.js'],
  ['base44/shared/fileDaRimuovere.ts', 'src/lib/fileDaRimuovere.js'],
  ['base44/shared/dichiarazioneAci.ts', 'src/lib/dichiarazioneAci.js'],
  ['base44/shared/ripartizioneTarget.ts', 'src/lib/ripartizioneTarget.js'],
  ['base44/shared/sediOperative.ts', 'src/lib/sediOperative.js'],
];

// il corpo: via i ritorni a capo di Windows, le righe di import e il commento di testa
const corpo = (percorso) => {
  const righe = readFileSync(join(radice, percorso), 'utf8').replace(/\r\n/g, '\n').split('\n');
  let i = 0;
  while (i < righe.length && (righe[i].startsWith('//') || righe[i].trim() === '')) i++;
  return righe.slice(i).filter(r => !/^import .* from /.test(r)).join('\n').trim();
};

let ok = 0, ko = 0;
for (const [originale, specchio] of SPECCHI) {
  const a = corpo(originale), b = corpo(specchio);
  if (a === b) { ok++; continue; }
  ko++;
  const ra = a.split('\n'), rb = b.split('\n');
  const dove = ra.findIndex((r, i) => r !== rb[i]);
  console.log(`  DIVERSI: ${originale} e ${specchio}, dalla riga ${dove + 1} del corpo:\n    originale: ${ra[dove]}\n    specchio:  ${rb[dove]}`);
}
console.log(`\n${ok} specchi identici, ${ko} diversi`);
process.exit(ko ? 1 : 0);
