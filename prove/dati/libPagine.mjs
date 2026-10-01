// Caricare una libreria delle pagine (src/lib) dentro una prova.
//
// Le pagine importano con l'alias `@/`, che lo sa risolvere solo Vite: nelle
// prove si riscrivono gli import in indirizzi di file veri. Prima ogni prova lo
// faceva a mano, sostituendo una riga per volta, e ogni import nuovo in
// src/lib/verifiche.js rompeva due prove che non c'entravano niente (e' capitato
// tre volte in due giorni: termineRegistrazione, poi fogliDiCalcolo). Qui la
// riscrittura e' una sola e vale per qualunque import.
//
// Sta in prove/dati perche' non e' una prova: esegui.mjs guarda solo i .mjs in
// cima alla cartella.
import { readFileSync } from 'node:fs';

const ALIAS = /from\s+'@\/([A-Za-z0-9_/-]+)'/g;

// Qualche libreria delle pagine guarda il browser appena viene caricata
// (src/lib/utils.js: isIframe legge window.self). Nelle prove non c'e' un
// browser: si da' un window finto, invece di stubare mezza libreria.
if (typeof globalThis.window === 'undefined') globalThis.window = { self: 1, top: 1 };

/**
 * Importa `src/<percorso>.js` con gli alias `@/` risolti. Il modulo caricato
 * resta un modulo vero, quindi i suoi import (clsx, xlsx, fflate...) si
 * risolvono da soli: si stuba solo quello che serve davvero.
 */
export function caricaLibPagine(percorso, sostituzioni = []) {
  const file = new URL(`../../src/${percorso}.js`, import.meta.url);
  let sorgente = readFileSync(file, 'utf8');
  for (const [da, a] of sostituzioni) sorgente = sorgente.replace(da, a);
  sorgente = sorgente.replace(ALIAS, (_m, nome) => `from ${JSON.stringify(new URL(`../../src/${nome}.js`, import.meta.url).href)}`);
  return import('data:text/javascript;base64,' + Buffer.from(sorgente).toString('base64'));
}
