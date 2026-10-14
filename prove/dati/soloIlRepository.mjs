// IN MODALITA' CI OGNI PROVA GIRA COL SOLO REPOSITORY (14/10/2026).
//
// Su GitHub c'e' il repository e basta: la copia dei dati veri (../dati-veri) e i
// documenti dell'utente (C:/Users/HOME/Desktop/ECOTYRE/...) stanno solo sul PC e
// non devono mai uscirne. Le prove che li leggono, senza, saltano la loro parte
// e passano lo stesso: su GitHub sarebbero verdi a vuoto. Questo modulo si carica
// davanti a ogni prova (--require in NODE_OPTIONS) quando esegui.mjs gira con
// --ci, e fa due cose su ogni percorso fuori dal repository:
//   1. lo scrive nel registro (PROVE_CI_REGISTRO), cosi' esegui.mjs sa chi ha
//      cercato qualcosa fuori, e lo dice;
//   2. risponde come se non ci fosse, anche quando sul PC c'e': la modalita' CI
//      lanciata in locale vede quello che vede GitHub, non i dati veri.
// Le vie che guarda: node:fs (anche realpathSync.native e realpath.native),
// import e require, i worker e i processi che la prova lancia. Un worker o un
// processo node hanno davanti questo stesso modulo anche quando la prova gli da'
// un ambiente ridotto: NODE_OPTIONS e il registro si rimettono (revisione del
// 14/10/2026: un worker, un node con l'ambiente ridotto e realpathSync.native
// arrivavano alla copia, e la prova risultava superata). Di un processo che non
// e' node (git, per esempio) si guardano la cartella e gli argomenti che sono
// percorsi: uno fuori si annota e si cambia con un percorso che non esiste.
// Quello che un programma legge da se' non si vede: per questo esegui.mjs non da'
// mai per superata una prova che nomina la copia o un percorso del PC.
// Restano dentro: il repository, le dipendenze installate (node_modules) e la
// cartella temporanea del sistema, dove le prove scrivono le copie delle pagine.
// Mai pero' la cartella che contiene il repository: li' stanno i dati veri, anche
// quando il repository e' una copia dentro la cartella temporanea.
// Un percorso di Windows (C:/...) e' fuori anche su Linux, dove sarebbe relativo.
//
// Sta in prove/dati perche' non e' una prova: esegui.mjs guarda solo i .mjs in
// cima alla cartella. Senza --ci non si carica, e npm run prove e' quello di prima.
import fs from 'node:fs';
import moduli, { syncBuiltinESMExports } from 'node:module';
import processi from 'node:child_process';
import thread from 'node:worker_threads';
import { promisify } from 'node:util';
import { basename, delimiter, dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { homedir, tmpdir } from 'node:os';

const RADICE = process.env.PROVE_CI_RADICE;
const REGISTRO = process.env.PROVE_CI_REGISTRO;
if (!RADICE || !REGISTRO) throw new Error('soloIlRepository.mjs: si carica solo da esegui.mjs --ci (PROVE_CI_RADICE e PROVE_CI_REGISTRO)');
const SOPRA = dirname(RADICE);
// La cartella temporanea di questo processo e quelle dei processi che l'hanno
// lanciato (PROVE_CI_TEMP): un node o un worker con l'ambiente ridotto, senza
// TEMP, ne vede un'altra, e le cartelle che la prova gli prepara sarebbero fuori.
const TEMPI = [...new Set([tmpdir(), ...(process.env.PROVE_CI_TEMP || '').split(delimiter)].filter(Boolean).map(t => resolve(t)))];
// Il registro e' del controllo, non e' mai fuori: appendFileSync passa da
// writeFileSync, e con un'altra cartella temporanea annotarlo girava all'infinito.
const IL_REGISTRO = resolve(REGISTRO);
const scrivi = fs.appendFileSync;
const WINDOWS = /^[A-Za-z]:[\\/]/;
// Un percorso che non c'e', col nome di quello fuori, per i flussi, i processi e i worker.
const nonEsiste = (p) => resolve(TEMPI[0], `prove-ci-non-esiste-${process.pid}`, basename(p) || 'x');
// Questo modulo come lo scrive esegui.mjs in NODE_OPTIONS: con le barre dritte,
// perche' fra virgolette NODE_OPTIONS legge \ come carattere di escape.
const QUESTO = fileURLToPath(import.meta.url).replace(/\\/g, '/');
const confronta = (s) => (process.platform === 'win32' ? s.toLowerCase() : s);

const dentro = (p, base) => { const r = relative(base, p); return r === '' || (!r.startsWith('..') && !isAbsolute(r)); };
const percorso = (x) => {
  if (x instanceof URL) return x.protocol === 'file:' ? fileURLToPath(x) : null;
  if (Buffer.isBuffer(x)) x = x.toString();
  if (typeof x !== 'string') return null;
  if (!x.startsWith('file:')) return x;
  // un indirizzo file: storto lo rifiuta la funzione vera, non questa
  try { return fileURLToPath(x); } catch { return null; }
};
// Il percorso assoluto se e' fuori, altrimenti null.
const fuori = (x) => {
  const s = percorso(x);
  if (s == null || s === '') return null;
  if (WINDOWS.test(s) && process.platform !== 'win32') return s;
  const p = resolve(s);
  if (dentro(p, RADICE)) return null;
  if (p.split(/[\\/]/).includes('node_modules')) return null;
  if (p === IL_REGISTRO) return null;
  if (TEMPI.some(t => dentro(p, t)) && !dentro(p, SOPRA)) return null;
  return p;
};
const manca = (syscall, p) => Object.assign(new Error(`ENOENT: no such file or directory, ${syscall} '${p}' (fuori dal repository: in modalita' CI non c'e')`),
  { code: 'ENOENT', errno: process.platform === 'win32' ? -4058 : -2, syscall, path: p });
const annota = (p) => { scrivi(REGISTRO, p + '\n'); };
// Il primo percorso fuori fra gli argomenti che sono percorsi (copie e rinomine ne hanno due).
const primoFuori = (args, quanti) => { for (let i = 0; i < quanti; i++) { const p = fuori(args[i]); if (p) return p; } return null; };

const SYNC = { existsSync: 1, statSync: 1, lstatSync: 1, accessSync: 1, readFileSync: 1, readdirSync: 1, openSync: 1, opendirSync: 1,
  realpathSync: 1, readlinkSync: 1, statfsSync: 1, createReadStream: 1, writeFileSync: 1, appendFileSync: 1, mkdirSync: 1, rmSync: 1, rmdirSync: 1,
  unlinkSync: 1, createWriteStream: 1, truncateSync: 1, copyFileSync: 2, cpSync: 2, renameSync: 2 };
const CALLBACK = { exists: 1, stat: 1, lstat: 1, access: 1, readFile: 1, readdir: 1, open: 1, opendir: 1, realpath: 1, readlink: 1, statfs: 1,
  writeFile: 1, appendFile: 1, mkdir: 1, rm: 1, rmdir: 1, unlink: 1, truncate: 1, copyFile: 2, cp: 2, rename: 2 };
const PROMESSE = { stat: 1, lstat: 1, access: 1, readFile: 1, readdir: 1, open: 1, opendir: 1, realpath: 1, readlink: 1, statfs: 1,
  writeFile: 1, appendFile: 1, mkdir: 1, rm: 1, rmdir: 1, unlink: 1, truncate: 1, copyFile: 2, cp: 2, rename: 2 };

const sincrona = (vero, nome, quanti) => function (...args) {
  const p = primoFuori(args, quanti);
  if (!p) return vero.apply(this, args);
  annota(p);
  if (nome === 'existsSync') return false;
  if ((nome === 'statSync' || nome === 'lstatSync') && args[1] && args[1].throwIfNoEntry === false) return undefined;
  // Un flusso non lancia: segnala l'errore dopo, come quello vero su un file che
  // non c'e'. Lo si apre su una cartella temporanea che non esiste.
  if (nome === 'createReadStream' || nome === 'createWriteStream') return vero.call(this, nonEsiste(p), ...args.slice(1));
  throw manca(nome.replace(/Sync$/, '').toLowerCase(), p);
};
const conRisposta = (vero, nome, quanti) => function (...args) {
  const p = primoFuori(args, quanti);
  if (!p) return vero.apply(this, args);
  annota(p);
  const cb = args[args.length - 1];
  if (typeof cb === 'function') process.nextTick(() => (nome === 'exists' ? cb(false) : cb(manca(nome.toLowerCase(), p))));
};
for (const [nome, quanti] of Object.entries(SYNC)) {
  const vero = fs[nome];
  if (typeof vero !== 'function') continue;
  const finto = sincrona(vero, nome, quanti);
  for (const k of Object.keys(vero)) finto[k] = vero[k];
  fs[nome] = finto;
}
for (const [nome, quanti] of Object.entries(CALLBACK)) {
  const vero = fs[nome];
  if (typeof vero !== 'function') continue;
  const finto = conRisposta(vero, nome, quanti);
  for (const k of Object.keys(vero)) finto[k] = vero[k];
  fs[nome] = finto;
}
// realpathSync.native e realpath.native sono altre funzioni, appese a quelle:
// copiate cosi' com'erano, arrivavano alla copia (revisione del 14/10/2026).
if (typeof fs.realpathSync.native === 'function') fs.realpathSync.native = sincrona(fs.realpathSync.native, 'realpathSync', 1);
if (typeof fs.realpath.native === 'function') fs.realpath.native = conRisposta(fs.realpath.native, 'realpath', 1);
for (const [nome, quanti] of Object.entries(PROMESSE)) {
  const vero = fs.promises[nome];
  if (typeof vero !== 'function') continue;
  fs.promises[nome] = function (...args) {
    const p = primoFuori(args, quanti);
    if (!p) return vero.apply(this, args);
    annota(p);
    return Promise.reject(manca(nome.toLowerCase(), p));
  };
}
// openAsBlob sta su node:fs ma risponde con una promessa.
if (typeof fs.openAsBlob === 'function') {
  const vero = fs.openAsBlob;
  fs.openAsBlob = function (...args) {
    const p = fuori(args[0]);
    if (!p) return vero.apply(this, args);
    annota(p);
    return Promise.reject(manca('open', p));
  };
}

// ─── i processi e i worker che la prova lancia ───
// Il controllo in un ambiente: questo modulo in NODE_OPTIONS, la radice, il
// registro e le cartelle temporanee, se l'ambiente non li ha. Un ambiente ridotto
// ({ PATH } e basta) li perdeva, e il node lanciato cosi' leggeva la copia senza
// che nessuno lo annotasse. Quelli che l'ambiente ha gia' si tengono: sono di
// esegui.mjs lanciato da prove/proveSuGitHub.mjs sulle sue prove finte, e una
// prova che li cambia esegui.mjs la fa cadere.
const controllo = (env) => {
  const opzioni = env.NODE_OPTIONS || '';
  return {
    NODE_OPTIONS: confronta(opzioni).includes(confronta(QUESTO)) ? opzioni : [opzioni, `--require="${QUESTO}"`].filter(Boolean).join(' '),
    PROVE_CI_RADICE: env.PROVE_CI_RADICE || RADICE,
    PROVE_CI_REGISTRO: env.PROVE_CI_REGISTRO || REGISTRO,
    PROVE_CI_TEMP: env.PROVE_CI_TEMP || TEMPI.join(delimiter),
  };
};
const conIlControllo = (env) => ({ ...(env || process.env), ...controllo(env || process.env) });
// Un argomento che e' un percorso: assoluto, che parte da . o ~, che sale (..),
// oppure file:. Il codice passato a node -e non lo e' (ha virgolette, ; o {).
const SEMBRA = /^(\.{1,2}([\\/]|$)|[\\/]|[A-Za-z]:[\\/]|~([\\/]|$)|file:)|(^|[\\/])\.\.([\\/]|$)/;
const CODICE = /[\r\n;{}`"']/;
const LIBERI = new Set(['/dev/null', '/dev/stdin', '/dev/stdout', '/dev/stderr', 'NUL']);
const NODE = dirname(process.execPath);
const argomentoFuori = (cwd, a) => {
  const s = a instanceof URL ? a.href : a;
  if (typeof s !== 'string' || !SEMBRA.test(s) || CODICE.test(s) || LIBERI.has(s)) return null;
  // /c, /d, /s: le opzioni di cmd su Windows, non percorsi
  if (process.platform === 'win32' && /^\/[A-Za-z?]$/.test(s)) return null;
  const t = /^~([\\/]|$)/.test(s) ? homedir() + s.slice(1) : s;
  const p = fuori(t.startsWith('file:') || WINDOWS.test(t) || isAbsolute(t) ? t : resolve(cwd, t));
  return p && !dentro(p, NODE) ? p : null;
};
// L'argomento com'e', o col percorso fuori cambiato (anche dopo un =, come in --file=...).
const sostituisci = (cwd, a) => {
  const p = argomentoFuori(cwd, a);
  if (p) { annota(p); return nonEsiste(p); }
  const i = typeof a === 'string' ? a.indexOf('=') : -1;
  if (i > 0) {
    const q = argomentoFuori(cwd, a.slice(i + 1));
    if (q) { annota(q); return a.slice(0, i + 1) + nonEsiste(q); }
  }
  return a;
};
// Una riga per la shell: ogni parola dopo il programma, fra virgolette o no.
const nellaRiga = (cwd, riga) => {
  let n = 0;
  return riga.replace(/"([^"]*)"|'([^']*)'|(\S+)/g, (tutto, doppie, singole, nuda) => {
    if (n++ === 0) return tutto;
    const valore = doppie ?? singole ?? nuda;
    const nuovo = sostituisci(cwd, valore);
    return nuovo === valore ? tutto : `"${nuovo.replace(/\\/g, '/')}"`;
  });
};
// La cartella del processo; fuori dal repository diventa una che non c'e', come su GitHub.
const preparaOpzioni = (opzioni) => {
  const o = opzioni || {};
  const cwd = resolve(o.cwd == null ? process.cwd() : (percorso(o.cwd) ?? process.cwd()));
  const nuove = { ...o, env: conIlControllo(o.env) };
  const p = fuori(cwd);
  if (p) { annota(p); nuove.cwd = nonEsiste(p); }
  return { cwd, nuove };
};
const copiaProprieta = (finto, vero) => { for (const k of Object.keys(vero)) finto[k] = vero[k]; return finto; };
// spawn, spawnSync, execFile, execFileSync, fork: (comando, [argomenti], [opzioni], [risposta])
for (const nome of ['spawn', 'spawnSync', 'execFile', 'execFileSync', 'fork']) {
  const vero = processi[nome];
  if (typeof vero !== 'function') continue;
  processi[nome] = copiaProprieta(function (comando, ...resto) {
    let i = 0;
    let lista = [];
    if (Array.isArray(resto[0])) { lista = resto[0]; i = 1; } else if (resto[0] == null && resto.length > 1) i = 1;
    let opzioni;
    if (resto[i] != null && typeof resto[i] === 'object') { opzioni = resto[i]; i++; } else if (resto[i] == null && i < resto.length) i++;
    const { cwd, nuove } = preparaOpzioni(opzioni);
    let c = comando;
    if (nome === 'fork') c = sostituisci(cwd, comando);
    else if (nuove.shell && typeof comando === 'string') c = nellaRiga(cwd, comando);
    if (nome === 'fork' && Array.isArray(nuove.execArgv)) nuove.execArgv = nuove.execArgv.map(a => sostituisci(cwd, a));
    return vero.call(this, c, lista.map(a => sostituisci(cwd, a)), nuove, ...resto.slice(i));
  }, vero);
}
// exec, execSync: (riga per la shell, [opzioni], [risposta])
for (const nome of ['exec', 'execSync']) {
  const vero = processi[nome];
  if (typeof vero !== 'function') continue;
  processi[nome] = copiaProprieta(function (riga, ...resto) {
    let i = 0;
    let opzioni;
    if (resto[0] != null && typeof resto[0] === 'object') { opzioni = resto[0]; i = 1; } else if (resto[0] == null && resto.length > 1) i = 1;
    const { cwd, nuove } = preparaOpzioni(opzioni);
    return vero.call(this, typeof riga === 'string' ? nellaRiga(cwd, riga) : riga, nuove, ...resto.slice(i));
  }, vero);
}
// promisify(exec) e promisify(execFile) passano dalle funzioni sostituite, con
// la stessa risposta di quelle vere: { stdout, stderr }, e .child sulla promessa.
for (const nome of ['exec', 'execFile']) {
  const finto = processi[nome];
  if (typeof finto !== 'function') continue;
  finto[promisify.custom] = (...args) => {
    let child;
    const promessa = new Promise((ok, ko) => {
      child = finto(...args, (errore, stdout, stderr) => (errore ? ko(Object.assign(errore, { stdout, stderr })) : ok({ stdout, stderr })));
    });
    promessa.child = child;
    return promessa;
  };
}
// Un worker ha il suo node:fs: senza questo modulo davanti leggeva la copia.
// Con NODE_OPTIONS nell'ambiente il worker lo carica (--require; --import nei
// worker non vale); un file del worker fuori dal repository non si trova.
if (typeof thread.Worker === 'function') {
  const Vero = thread.Worker;
  thread.Worker = class Worker extends Vero {
    constructor(file, opzioni) {
      const o = opzioni || {};
      let f = file;
      if (!o.eval) { const p = fuori(file); if (p) { annota(p); f = nonEsiste(p); } }
      if (o.env === thread.SHARE_ENV) { Object.assign(process.env, controllo(process.env)); super(f, o); return; }
      super(f, { ...o, env: conIlControllo(o.env) });
    }
  };
}
// Gli import { existsSync } from 'node:fs' (e da node:child_process e
// node:worker_threads) vedono le funzioni sostituite.
syncBuiltinESMExports();

// Un modulo fuori dal repository, caricato con import() o require(), non passa da
// node:fs: senza questo, una prova che prova a importarlo e salta se manca
// risulterebbe superata a vuoto (14/10/2026). Si guardano solo i percorsi
// (relativi, assoluti, file:); i pacchetti per nome stanno in node_modules.
if (typeof moduli.registerHooks === 'function') {
  moduli.registerHooks({
    resolve(specifier, context, nextResolve) {
      let dove = null;
      if (WINDOWS.test(specifier)) dove = specifier;
      else if (/^(\.{1,2}[\\/]|[\\/]|file:)/.test(specifier)) {
        try { dove = new URL(specifier, context.parentURL || pathToFileURL(RADICE + '/').href); } catch { /* lo dice la risoluzione vera */ }
      }
      const p = dove && (typeof dove === 'string' || dove.protocol === 'file:') ? fuori(dove) : null;
      if (!p) return nextResolve(specifier, context);
      annota(p);
      // lo stesso codice d'errore che darebbe GitHub, dove il file non c'e'
      const codice = (context.conditions || []).includes('require') ? 'MODULE_NOT_FOUND' : 'ERR_MODULE_NOT_FOUND';
      throw Object.assign(new Error(`Cannot find module '${p}' (fuori dal repository: in modalita' CI non c'e')`), { code: codice });
    },
  });
}
