// IL CONTROLLO AUTOMATICO SU GITHUB, A OGNI PUSH SU MAIN (14/10/2026).
//
// Le prove, eslint, gli specchi e la build giravano solo sul PC, prima di un
// commit; la piattaforma pero' fa commit da sola su main, e un errore entrato cosi'
// non lo provava nessuno. Ora .github/workflows/prove.yml li lancia su GitHub, e
// le prove con npm run prove:ci (prove/esegui.mjs --ci). Su GitHub c'e' il
// repository e basta: la copia dei dati veri e i documenti dell'utente restano
// sul PC, e una prova che li legge, senza, passerebbe a vuoto. Qui si guarda:
//   1. il flusso: push su main e a mano, un giro solo per volta, la storia intera,
//      Node 24, i quattro controlli, nessun segreto e niente che esca;
//   2. npm run prove resta quello di prima, npm run prove:ci e' il giro nuovo;
//   3. la modalita' CI su prove finte: chi legge fuori dichiarandolo e' «in
//      parte» e non conta come superata, chi lo fa senza dirlo fallisce (anche
//      quando dichiara la copia ma legge un documento del PC, o quando a leggere
//      e' un processo node che la prova lancia), la cartella accanto al
//      repository non si vede nemmeno se c'e', ne' con node:fs ne' con import, la
//      cartella temporanea si', le prove girano con l'ora e la lingua del PC, una
//      prova appesa si ferma, senza la storia di git il giro non parte. Poi le
//      vie della revisione del 14/10/2026 (un worker, git, un node con l'ambiente
//      ridotto, realpathSync.native): chi nomina la copia non e' mai superata,
//      chi la cerca per quelle vie senza nominarla fallisce, chi cambia il
//      registro ai processi che lancia fallisce, e l'elenco di chi nomina
//      soltanto non copre chi cerca;
//   4. senza --ci le stesse prove finte girano come prima: una per volta, senza
//      niente davanti, e l'esito e' quello di sempre;
//   5. la copia dei dati veri non e' dentro il repository.
// npm run prove
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// esegui.mjs lancia le prove finte con questo stesso Node: se una versione vecchia
// ignorasse PROVE_CARTELLA lancerebbe le prove vere, e fra quelle questa.
if (process.env.PROVE_SU_GITHUB_DENTRO) { console.log('lanciata da se stessa: salto'); process.exit(0); }

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
const testo = (p) => (existsSync(qui(p)) ? readFileSync(qui(p), 'utf8').replace(/\r/g, '') : '');

console.log('1. IL FLUSSO DI GITHUB');
const yml = testo('../.github/workflows/prove.yml');
verifica('il flusso c\'e\': .github/workflows/prove.yml', yml !== '');
let flusso = null;
try { flusso = (await import('js-yaml')).default.load(yml); } catch (e) { verifica('il flusso si legge come yaml', false, e.message); }
const passi = flusso?.jobs?.prove?.steps || [];
const lanci = passi.map(s => s.run).filter(Boolean);
const usa = (nome) => passi.find(s => String(s.uses || '').startsWith(nome + '@'));
verifica('parte a ogni push su main e a mano', JSON.stringify(flusso?.on?.push?.branches) === '["main"]' && flusso?.on && 'workflow_dispatch' in flusso.on, JSON.stringify(flusso?.on));
verifica('un giro solo per volta: il push nuovo ferma quello prima', flusso?.concurrency?.['cancel-in-progress'] === true && /github\.ref/.test(flusso?.concurrency?.group || ''), JSON.stringify(flusso?.concurrency));
verifica('legge il repository e basta', JSON.stringify(flusso?.permissions) === '{"contents":"read"}', JSON.stringify(flusso?.permissions));
verifica('su Linux, con un tetto di tempo', flusso?.jobs?.prove?.['runs-on'] === 'ubuntu-latest' && flusso?.jobs?.prove?.['timeout-minutes'] > 0 && flusso?.jobs?.prove?.['timeout-minutes'] <= 30);
verifica('la storia intera (le prove che leggono i commit vecchi con git show), senza lasciare credenziali',
  usa('actions/checkout')?.with?.['fetch-depth'] === 0 && usa('actions/checkout')?.with?.['persist-credentials'] === false, JSON.stringify(usa('actions/checkout')));
verifica('Node 24, come sul PC', String(usa('actions/setup-node')?.with?.['node-version']) === '24', JSON.stringify(usa('actions/setup-node')));
const ATTESI = ['npm ci --no-audit --no-fund', 'npx eslint --quiet .', 'node prove/specchi.mjs', 'npx vite build', 'npm run prove:ci'];
verifica('i controlli, in quest\'ordine: dipendenze, eslint, specchi, build, prove', JSON.stringify(lanci) === JSON.stringify(ATTESI), JSON.stringify(lanci));
verifica('dopo le dipendenze ogni controllo gira anche se quello prima e\' caduto',
  passi.filter(s => s.run && s.run !== ATTESI[0]).every(s => /!cancelled\(\)/.test(s.if || '') && /steps\.dipendenze\.outcome == 'success'/.test(s.if || '')) && passi.find(s => s.run === ATTESI[0])?.id === 'dipendenze');
const senzaCommenti = yml.split('\n').filter(r => !/^\s*#/.test(r)).join('\n');
verifica('nessun segreto e nessun token', !/secrets\.|GITHUB_TOKEN|token/i.test(senzaCommenti));
verifica('niente esce dal giro: nessun file caricato, nessuna cache oltre quella di npm', !/upload-artifact|actions\/cache/.test(senzaCommenti) && passi.every(s => !s.uses || /^actions\/(checkout|setup-node)@/.test(s.uses)), JSON.stringify(passi.map(s => s.uses).filter(Boolean)));
verifica('i dati veri non si nominano fuori dai commenti', !/dati-veri|DATI_VERI/.test(senzaCommenti));

console.log('2. NPM RUN PROVE COME PRIMA, NPM RUN PROVE:CI NUOVO');
const pacchetto = JSON.parse(testo('../package.json') || '{}');
verifica('npm run prove: node prove/esegui.mjs, come prima', pacchetto.scripts?.prove === 'node prove/esegui.mjs', pacchetto.scripts?.prove);
verifica('npm run prove:ci: node prove/esegui.mjs --ci', pacchetto.scripts?.['prove:ci'] === 'node prove/esegui.mjs --ci', pacchetto.scripts?.['prove:ci']);
const esegui = testo('esegui.mjs');
const pronta = /PROVE_CARTELLA/.test(esegui) && /--ci/.test(esegui) && existsSync(qui('dati/soloIlRepository.mjs'));
verifica('esegui.mjs conosce --ci e lancia le prove con soloIlRepository.mjs davanti', pronta);
verifica('senza --ci esegui.mjs lancia ogni prova come prima, senza niente davanti',
  /if \(!process\.argv\.includes\('--ci'\)\) \{\n\s*let fallite = 0;\n\s*for \(const f of readdirSync\(qui\)\.filter\(n => n\.endsWith\('\.mjs'\) && n !== 'esegui\.mjs'\)\.sort\(\)\) \{\n\s*console\.log\(`\\n=== \$\{f\} ===`\);\n\s*const r = spawnSync\(process\.execPath, \['--no-warnings', join\(qui, f\)\], \{ stdio: 'inherit' \}\);\n\s*if \(r\.status !== 0\) fallite\+\+;\n\s*\}\n\s*process\.exit\(fallite \? 1 : 0\);\n\}/.test(esegui));

// ─── prove finte, in un repository finto dentro la cartella temporanea ───
// casa/repo/prove/*.mjs, e accanto casa/dati-veri/ con dentro un file: come sul PC.
const base = mkdtempSync(join(tmpdir(), 'prove-su-github-'));
const PROVE = {
  // la pagina del giro su GitHub non e' sua: la scrive solo esegui.mjs
  'a_pulita.mjs': "console.log('pulita', process.env.GITHUB_STEP_SUMMARY ? 'VEDE LA PAGINA DEL GIRO' : '');",
  // dichiara la copia (dati-veri nel sorgente) e la salta se non c'e'
  'b_dichiarata.mjs': `import { existsSync } from 'node:fs';
const C = new URL('../../dati-veri/', import.meta.url);
if (!existsSync(C)) { console.log('copia assente: salto'); process.exit(0); }
console.log('COPIA VISTA'); process.exit(3);`,
  // la stessa cartella col nome spezzato: il sorgente non lo dice
  'c_nascosta.mjs': `import { existsSync } from 'node:fs';
const nome = ['dati', 'veri'].join('-');
console.log(existsSync(new URL('../../' + nome + '/', import.meta.url)) ? 'vista' : 'assente: salto');`,
  'd_rotta.mjs': "console.log('rotta'); process.exit(1);",
  // le promesse di node:fs/promises, sulla copia
  'e_promesse.mjs': `import { readFile } from 'node:fs/promises';
try { await readFile(new URL('../../dati-veri/copia.txt', import.meta.url)); console.log('COPIA LETTA'); process.exit(3); }
catch (e) { console.log('copia: ' + e.code + ', salto'); }`,
  // un documento del PC: su Linux il percorso sarebbe relativo, e resta fuori lo stesso
  'f_windows.mjs': `import { existsSync } from 'node:fs';
console.log(existsSync('C:/Users/nessuno/ECOTYRE/prefattura.xlsx') ? 'vista' : 'assente: salto');`,
  // la cartella temporanea si usa: le prove ci scrivono le copie delle pagine
  'g_temp.mjs': `import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os'; import { join } from 'node:path';
const d = mkdtempSync(join(tmpdir(), 'finta-')); writeFileSync(join(d, 'x.txt'), 'si');
const letto = readFileSync(join(d, 'x.txt'), 'utf8'); rmSync(d, { recursive: true, force: true });
if (letto !== 'si') process.exit(2); console.log('temporanea ok');`,
  // un flusso sulla copia: l'errore arriva dopo, come su un file che non c'e'
  'j_flusso.mjs': `import { createReadStream } from 'node:fs';
const s = createReadStream(new URL('../../dati-veri/copia.txt', import.meta.url));
s.on('data', () => { console.log('FLUSSO LETTO'); process.exit(3); });
s.on('error', (e) => console.log('flusso: ' + e.code + ', salto'));`,
  // nomina la copia senza cercarla: gira intera
  'i_nomina.mjs': "// la copia in ../dati-veri qui si nomina soltanto\nconsole.log('nomina');",
  // dichiara la copia ma cerca un documento del PC, senza scriverne il percorso
  'k_mista.mjs': `// la copia in ../dati-veri qui non serve
import { existsSync } from 'node:fs'; import { homedir } from 'node:os'; import { join } from 'node:path';
console.log(existsSync(join(homedir(), 'Desktop', 'ECOTYRE', 'prova-finta.xlsx')) ? 'vista' : 'documento assente: salto');`,
  // a cercare la copia e' un processo node lanciato dalla prova, e il sorgente non lo dice
  'l_figlio.mjs': `import { spawnSync } from 'node:child_process';
const codice = "const fs = require('fs'); const p = require('path'); console.log(fs.existsSync(p.join(process.cwd(), '..', ['dati', 'veri'].join('-'))) ? 'FIGLIO VEDE' : 'figlio: assente, salto')";
console.log(spawnSync(process.execPath, ['-e', codice], { encoding: 'utf8' }).stdout.trim());`,
  // un modulo della copia caricato con import: non passa da node:fs
  'm_import.mjs': `try { await import(new URL('../../dati-veri/modulo.mjs', import.meta.url).href); console.log('IMPORT VISTO'); process.exit(3); }
catch (e) { console.log('import: ' + e.code + ', salto'); }`,
  // un file della copia letto con require
  'o_require.mjs': `// la copia in ../dati-veri, letta con require
import { createRequire } from 'node:module';
const richiedi = createRequire(import.meta.url);
try { richiedi('../../dati-veri/dati.json'); console.log('REQUIRE VISTO'); process.exit(3); }
catch (e) { console.log('require: ' + e.code + ', salto'); }`,
  // openAsBlob e statfs, che non sono le solite letture
  'p_altre.mjs': `// la copia in ../dati-veri, con openAsBlob e statfsSync
import { openAsBlob, statfsSync } from 'node:fs';
const copia = new URL('../../dati-veri/copia.txt', import.meta.url);
try { await openAsBlob(copia); console.log('BLOB LETTO'); process.exit(3); } catch (e) { console.log('blob: ' + e.code + ', salto'); }
try { statfsSync(new URL('../../dati-veri/', import.meta.url)); console.log('STATFS VISTO'); process.exit(3); } catch (e) { console.log('statfs: ' + e.code + ', salto'); }`,
  // l'ora e la lingua che una prova vede
  'n_ora.mjs': "console.log('ora ' + Intl.DateTimeFormat().resolvedOptions().timeZone + ' ' + process.env.LANG + ' ' + process.env.LC_ALL);",
  // col nome di questa prova, che esegui.mjs mette fra quelle che nominano soltanto
  'proveSuGitHub.mjs': "// nomina la copia in ../dati-veri e 'C:/Users/nessuno/ECOTYRE' soltanto, senza cercarli\nconsole.log('solo nomina');",
};
// Le vie per arrivare alla copia che il registro non vedeva (revisione del
// 14/10/2026). Le prime quattro nominano la copia e saltano se non la trovano;
// le altre quattro fanno lo stesso senza nominarla (il nome e' spezzato).
const RIDOTTO = "const env = { PATH: process.env.PATH }; if (process.env.SystemRoot) env.SystemRoot = process.env.SystemRoot;";
const VIE = {
  'q_worker.mjs': `// la copia in ../dati-veri, cercata da un worker: col codice e col file
import { Worker } from 'node:worker_threads'; import { fileURLToPath } from 'node:url';
const copia = fileURLToPath(new URL('../../dati-veri/copia.txt', import.meta.url));
const col = await new Promise((ok) => { const w = new Worker("const { workerData, parentPort } = require('node:worker_threads'); parentPort.postMessage(require('node:fs').existsSync(workerData))", { eval: true, workerData: copia }); w.on('message', ok); w.on('error', () => ok(false)); });
console.log(col ? 'WORKER VEDE LA COPIA' : 'worker: assente, salto');
const dal = await new Promise((ok) => { const w = new Worker(new URL('../../dati-veri/modulo.mjs', import.meta.url)); w.on('error', (e) => ok('worker dal file: ' + e.code + ', salto')); w.on('exit', () => ok('WORKER DAL FILE VEDE LA COPIA')); });
console.log(dal);`,
  'r_git.mjs': `// la copia in ../dati-veri, letta da git: per percorso assoluto e relativo, come cartella, dalla shell; e da node --env-file=
import { spawnSync, execSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
const copia = fileURLToPath(new URL('../../dati-veri/copia.txt', import.meta.url));
const prova = (nome, fai) => { let si = false; try { si = fai(); } catch { /* non c'e' */ } console.log(si ? 'VEDE LA COPIA (' + nome + ')' : nome + ': assente, salto'); };
prova('git assoluto', () => spawnSync('git', ['hash-object', copia]).status === 0);
prova('git relativo', () => spawnSync('git', ['hash-object', '../dati-veri/copia.txt']).status === 0);
prova('git cartella', () => spawnSync('git', ['hash-object', 'copia.txt'], { cwd: '../dati-veri' }).status === 0);
prova('git shell', () => { execSync('git hash-object "../dati-veri/copia.txt"', { stdio: 'ignore' }); return true; });
prova('node opzione', () => spawnSync(process.execPath, ['--env-file=../dati-veri/copia.txt', '-e', '0']).status === 0);`,
  's_ridotto.mjs': `// la copia in ../dati-veri, cercata da un node lanciato con l'ambiente ridotto
import { spawnSync } from 'node:child_process';
${RIDOTTO}
const r = spawnSync(process.execPath, ['-e', "process.exit(require('node:fs').existsSync(require('node:path').join(process.cwd(), '..', 'dati-veri', 'copia.txt')) ? 0 : 1)"], { env });
console.log(r.status === 0 ? 'RIDOTTO VEDE LA COPIA' : 'ridotto: assente, salto');`,
  't_native.mjs': `// la copia in ../dati-veri, con realpathSync.native e realpath.native
import { realpathSync, realpath } from 'node:fs'; import { fileURLToPath } from 'node:url';
const copia = fileURLToPath(new URL('../../dati-veri/copia.txt', import.meta.url));
let si = false; try { realpathSync.native(copia); si = true; } catch { /* non c'e' */ }
console.log(si ? 'NATIVE VEDE LA COPIA' : 'native: assente, salto');
const cb = await new Promise((ok) => realpath.native(copia, (e) => ok(!e)));
console.log(cb ? 'NATIVE CB VEDE LA COPIA' : 'native cb: assente, salto');`,
  'v_worker.mjs': `import { Worker } from 'node:worker_threads'; import { join } from 'node:path';
const copia = join(process.cwd(), '..', ['dati', 'veri'].join('-'), 'copia.txt');
const si = await new Promise((ok) => { const w = new Worker("const { workerData, parentPort } = require('node:worker_threads'); parentPort.postMessage(require('node:fs').existsSync(workerData))", { eval: true, workerData: copia, env: {}, execArgv: [] }); w.on('message', ok); w.on('error', () => ok(false)); });
console.log(si ? 'WORKER TACIUTO VEDE LA COPIA' : 'worker taciuto: assente, salto');`,
  'w_git.mjs': `import { spawnSync } from 'node:child_process'; import { join } from 'node:path';
const r = spawnSync('git', ['hash-object', join(process.cwd(), '..', ['dati', 'veri'].join('-'), 'copia.txt')]);
console.log(r.status === 0 ? 'GIT TACIUTO VEDE LA COPIA' : 'git taciuto: assente, salto');`,
  'x_ridotto.mjs': `import { spawnSync } from 'node:child_process';
${RIDOTTO}
const r = spawnSync(process.execPath, ['-e', "process.exit(require('node:fs').existsSync(require('node:path').join(process.cwd(), '..', ['dati', 'veri'].join('-'), 'copia.txt')) ? 0 : 1)"], { env });
console.log(r.status === 0 ? 'RIDOTTO TACIUTO VEDE LA COPIA' : 'ridotto taciuto: assente, salto');`,
  'y_native.mjs': `import { realpathSync } from 'node:fs'; import { join } from 'node:path';
let si = false; try { realpathSync.native(join(process.cwd(), '..', ['dati', 'veri'].join('-'), 'copia.txt')); si = true; } catch { /* non c'e' */ }
console.log(si ? 'NATIVE TACIUTO VEDE LA COPIA' : 'native taciuto: assente, salto');`,
  // un registro suo per il node che lancia: quello che cerca non lo vedrebbe nessuno
  'u_registro.mjs': `import { spawnSync } from 'node:child_process'; import { rmSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path';
const suo = join(tmpdir(), 'registro-suo-' + process.pid + '.txt');
const r = spawnSync(process.execPath, ['-e', "process.exit(require('node:fs').existsSync(require('node:path').join(process.cwd(), '..', ['dati', 'veri'].join('-'))) ? 0 : 1)"], { env: { ...process.env, PROVE_CI_REGISTRO: suo } });
rmSync(suo, { force: true });
console.log(r.status === 0 ? 'REGISTRO SUO VEDE LA COPIA' : 'registro suo: assente, salto');`,
  // un node o un worker con l'ambiente ridotto possono avere un'altra cartella
  // temporanea (il worker con env {} non ha TEMP), ma leggono quella che la prova
  // gli ha preparato: e' sua, non e' fuori
  'z_temp.mjs': `import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'; import { spawnSync } from 'node:child_process'; import { Worker } from 'node:worker_threads'; import { tmpdir } from 'node:os'; import { join } from 'node:path';
const d = mkdtempSync(join(tmpdir(), 'finta-')); const f = join(d, 'x.txt'); writeFileSync(f, 'si');
${RIDOTTO}
const r = spawnSync(process.execPath, ['-e', 'process.exit(require("node:fs").readFileSync(process.argv[1], "utf8") === "si" ? 0 : 1)', f], { env });
const w = await new Promise((ok) => { const t = new Worker("const { workerData, parentPort } = require('node:worker_threads'); parentPort.postMessage(require('node:fs').readFileSync(workerData, 'utf8'))", { eval: true, workerData: f, env: {} }); t.on('message', ok); t.on('error', (e) => ok(e.code)); });
rmSync(d, { recursive: true, force: true });
if (r.status !== 0 || w !== 'si') { console.log('temporanea ridotta: non la legge', r.status, w); process.exit(1); }
console.log('temporanea ridotta ok');`,
  // col nome di questa prova, ma la copia la cerca: l'elenco non la copre
  'proveSuGitHub.mjs': `// nomina la copia in ../dati-veri, e la cerca
import { existsSync } from 'node:fs';
console.log(existsSync(new URL('../../dati-veri/copia.txt', import.meta.url)) ? 'ELENCO VEDE LA COPIA' : 'elenco: assente, salto');`,
};
const casa = (nome, prove, git = true) => {
  const dir = join(base, nome);
  mkdirSync(join(dir, 'repo', 'prove', 'dati'), { recursive: true });
  mkdirSync(join(dir, 'dati-veri'), { recursive: true });
  writeFileSync(join(dir, 'dati-veri', 'copia.txt'), 'dati veri finti');
  writeFileSync(join(dir, 'dati-veri', 'modulo.mjs'), 'export default 1;');
  writeFileSync(join(dir, 'dati-veri', 'dati.json'), '{"finto": true}');
  // un modulo in prove/dati non e' una prova
  writeFileSync(join(dir, 'repo', 'prove', 'dati', 'aiuto.mjs'), 'process.exit(9);');
  for (const [f, s] of Object.entries(prove)) writeFileSync(join(dir, 'repo', 'prove', f), s);
  if (git) spawnSync('git', ['init', '-q'], { cwd: join(dir, 'repo') });
  return join(dir, 'repo', 'prove');
};
const ambiente = { ...process.env, PROVE_SU_GITHUB_DENTRO: '1', PROVE_PARALLELE: '2' };
// In modalita' CI questa prova ha davanti soloIlRepository.mjs, anche in
// NODE_OPTIONS: le prove finte hanno il loro esegui.mjs, e il loro mondo.
for (const k of ['PROVE_CI_RADICE', 'PROVE_CI_REGISTRO', 'GITHUB_ACTIONS', 'GITHUB_STEP_SUMMARY', 'DATI_VERI', 'PROVE_CI_SECONDI', 'NODE_OPTIONS']) delete ambiente[k];
// Il controllo si rimette davanti ai processi che questa prova lancia, anche se
// l'ambiente non ce l'ha: quello che cercano le prove finte (i percorsi del PC
// di f_windows e k_mista) va in un registro loro, non in quello di questa prova,
// che nomina la copia e i percorsi del PC ma non li cerca (SOLO_NOMINA in esegui.mjs).
const registroFinte = join(base, 'registro-delle-prove-finte.txt');
const gira = (cartella, ci, extra = {}) => {
  const r = spawnSync(process.execPath, ['--no-warnings', qui('esegui.mjs'), ...(ci ? ['--ci'] : [])],
    { cwd: join(cartella, '..'), env: { ...ambiente, PROVE_CARTELLA: cartella, PROVE_CI_REGISTRO: registroFinte, ...extra }, encoding: 'utf8', timeout: 120000 });
  return { esito: r.status, out: (r.stdout || '') + (r.stderr || '') };
};
const riga = (out, inizio) => (out.split('\n').find(r => r.startsWith(inizio)) || '');
const blocco = (out, f) => { const i = out.indexOf(`=== ${f} - `); return i < 0 ? '' : out.slice(i, out.indexOf('\n===', i + 1) < 0 ? undefined : out.indexOf('\n===', i + 1)); };

try {
  if (!pronta) {
    verifica('la modalita\' CI non c\'e\': le prove finte non si lanciano (girerebbero le prove vere)', false);
  } else {
    console.log('3. LA MODALITA\' CI SU PROVE FINTE');
    const tutte = casa('tutte', PROVE);
    // fuori l'ora e la lingua del runner di GitHub: le prove devono vedere quelle del PC
    const ci = gira(tutte, true, { TZ: 'UTC', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' });
    verifica('esce con errore: quattro prove sono cadute', ci.esito === 1, String(ci.esito));
    verifica('superate 4: la pulita, quella che usa la cartella temporanea, quella dell\'ora e quella dell\'elenco di chi nomina soltanto', riga(ci.out, 'superate:') === 'superate: 4' && /=== proveSuGitHub\.mjs - superata/.test(ci.out) && /=== n_ora\.mjs - superata/.test(ci.out) && /solo nomina/.test(ci.out), riga(ci.out, 'superate:'));
    verifica('in parte o saltate 8, e non contano come superate', /^in parte o saltate, .*non contano come superate.*: 8$/.test(riga(ci.out, 'in parte o saltate,')), riga(ci.out, 'in parte o saltate,'));
    verifica('fallite 4', riga(ci.out, 'fallite:') === 'fallite: 4', riga(ci.out, 'fallite:'));
    verifica('le 16 prove della cartella e non il modulo in prove/dati', /=== MODALITA' CI: 16 prove, 2 alla volta/.test(ci.out) && !/aiuto\.mjs/.test(ci.out), riga(ci.out, '=== MODALITA'));
    verifica('chi nomina la copia senza che il registro la veda cercare non e\' superata: su GitHub la copia non c\'e\' (revisione del 14/10/2026)',
      /=== i_nomina\.mjs - in parte/.test(ci.out) && ci.out.includes('  - i_nomina.mjs: la copia dei dati veri (nel sorgente: su GitHub non c\'e\')'), riga(ci.out, '  - i_nomina'));
    verifica('la dichiarata: in parte, col perche\' e la cartella cercata', ci.out.includes('  - b_dichiarata.mjs: la copia dei dati veri (cercati: ../dati-veri)'), riga(ci.out, '  - b_dichiarata'));
    verifica('la dichiarata non vede la copia, anche se accanto al repository c\'e\'', /copia assente: salto/.test(blocco(ci.out, 'b_dichiarata.mjs')) && !/COPIA VISTA/.test(ci.out));
    verifica('la nascosta fallisce: ha cercato fuori senza dirlo', /  - c_nascosta\.mjs: ha cercato \.\.\/dati-veri fuori dal repository senza dichiararlo nel sorgente/.test(ci.out), riga(ci.out, '  - c_nascosta'));
    verifica('la rotta fallisce', /^  - d_rotta\.mjs$/m.test(ci.out));
    verifica('anche node:fs/promises non legge la copia', /copia: ENOENT, salto/.test(ci.out) && !/COPIA LETTA/.test(ci.out) && ci.out.includes('  - e_promesse.mjs: la copia dei dati veri (cercati: ../dati-veri)'));
    verifica('anche un flusso sulla copia non legge niente: l\'errore arriva dopo, come su un file che non c\'e\'',/flusso: ENOENT, salto/.test(ci.out) && !/FLUSSO LETTO/.test(ci.out) && ci.out.includes('  - j_flusso.mjs: la copia dei dati veri (cercati: ../dati-veri)'), riga(ci.out, '  - j_flusso'));
    verifica('un percorso C:/ e\' fuori anche su Linux, e si dice', ci.out.includes('  - f_windows.mjs: documenti del PC (cercati: C:/Users/nessuno/ECOTYRE/prefattura.xlsx)'), riga(ci.out, '  - f_windows'));
    verifica('la cartella temporanea si usa: superata', /=== g_temp\.mjs - superata/.test(ci.out) && /temporanea ok/.test(ci.out));
    verifica('chi dichiara la copia ma cerca un documento del PC senza scriverne il percorso fallisce: ogni cosa cercata va dichiarata',
      /  - k_mista\.mjs: ha cercato \S*ECOTYRE\S* fuori dal repository senza dichiararlo nel sorgente \(documenti del PC\)/.test(ci.out) && /documento assente: salto/.test(ci.out), riga(ci.out, '  - k_mista'));
    verifica('un processo node lanciato dalla prova ha davanti lo stesso controllo: non vede la copia, e la prova che non lo dice fallisce',
      /figlio: assente, salto/.test(ci.out) && !/FIGLIO VEDE/.test(ci.out) && /  - l_figlio\.mjs: ha cercato \.\.\/dati-veri fuori dal repository senza dichiararlo nel sorgente \(la copia dei dati veri\)/.test(ci.out), riga(ci.out, '  - l_figlio'));
    verifica('un modulo della copia caricato con import non si carica, e la prova che lo dichiara e\' in parte',
      /import: ERR_MODULE_NOT_FOUND, salto/.test(ci.out) && !/IMPORT VISTO/.test(ci.out) && ci.out.includes('  - m_import.mjs: la copia dei dati veri (cercati: ../dati-veri)'), riga(ci.out, '  - m_import'));
    verifica('anche require non carica un file della copia, con l\'errore che darebbe GitHub',
      /require: MODULE_NOT_FOUND, salto/.test(ci.out) && !/REQUIRE VISTO/.test(ci.out) && ci.out.includes('  - o_require.mjs: la copia dei dati veri (cercati: ../dati-veri)'), blocco(ci.out, 'o_require.mjs').slice(0, 200));
    verifica('openAsBlob e statfs non arrivano alla copia',
      /blob: ENOENT, salto/.test(ci.out) && /statfs: ENOENT, salto/.test(ci.out) && !/BLOB LETTO|STATFS VISTO/.test(ci.out) && ci.out.includes('  - p_altre.mjs: la copia dei dati veri (cercati: ../dati-veri)'), blocco(ci.out, 'p_altre.mjs').slice(0, 200));
    verifica('con l\'ora UTC e la lingua inglese fuori, le prove girano con l\'ora e la lingua del PC',
      /^ora Europe\/Rome it_IT\.UTF-8 it_IT\.UTF-8$/m.test(blocco(ci.out, 'n_ora.mjs')), blocco(ci.out, 'n_ora.mjs').slice(0, 200));
    // La lingua predefinita node la prende da LC_ALL su Linux, ma su Windows dal
    // sistema: qui si pretende l'ora; la lingua sul PC e' gia' l'italiano.
    verifica('il riepilogo dice con che ora e lingua hanno girato',
      /^lingua e ora delle prove: [a-z]{2}(-[A-Z]{2})? Europe\/Rome$/.test(riga(ci.out, 'lingua e ora delle prove:')) && (process.platform !== 'win32' || riga(ci.out, 'lingua e ora delle prove:') === 'lingua e ora delle prove: it-IT Europe/Rome'), riga(ci.out, 'lingua e ora delle prove:'));
    verifica('ogni prova ha il suo resoconto tutto insieme, col tempo', Object.keys(PROVE).every(f => new RegExp(`=== ${f.replace('.', '\\.')} - (superata|in parte|FALLITA) \\(\\d+,\\d s\\) ===`).test(ci.out)));
    const pagina = join(base, 'riepilogo.md');
    const suGitHub = gira(tutte, true, { GITHUB_ACTIONS: 'true', GITHUB_STEP_SUMMARY: pagina });
    verifica('su GitHub: le superate chiuse in un gruppo, le cadute segnate come errore', suGitHub.esito === 1 && /::group::a_pulita\.mjs - superata/.test(suGitHub.out) && /::error title=Prova fallita::d_rotta\.mjs/.test(suGitHub.out) && /::error title=Prova fallita::c_nascosta\.mjs/.test(suGitHub.out));
    const riepilogo = existsSync(pagina) ? readFileSync(pagina, 'utf8') : '';
    verifica('su GitHub il riepilogo va nella pagina del giro: i numeri, le fallite e le in parte col perche\'',
      /### Prove: 4 fallite/.test(riepilogo) && /16 prove in \d+ s: 4 superate, 8 in parte o saltate, 4 fallite\. Lingua e ora: \S+ Europe\/Rome\./.test(riepilogo)
      && /- `c_nascosta\.mjs`: ha cercato \.\.\/dati-veri fuori dal repository senza dichiararlo/.test(riepilogo) && riepilogo.includes('- `b_dichiarata.mjs`: la copia dei dati veri (cercati: ../dati-veri)'), riepilogo.slice(0, 600));
    verifica('la pagina del giro la scrive solo esegui.mjs: una prova non la vede, e il riepilogo e\' uno',
      !/VEDE LA PAGINA DEL GIRO/.test(suGitHub.out) && /pulita/.test(suGitHub.out) && (riepilogo.match(/^### Prove/gm) || []).length === 1, riepilogo.slice(0, 200));
    verifica('sul PC il riepilogo resta a video e basta', !existsSync(join(base, 'tutte', 'riepilogo.md')) && !/::group::|::error/.test(ci.out));

    // Le vie che il registro non vedeva: un worker, git, un node con l'ambiente
    // ridotto, realpathSync.native. Prima risultavano superate e, sul PC,
    // leggevano la copia (revisione del 14/10/2026).
    const vie = casa('vie', VIE);
    const ciVie = gira(vie, true);
    const lista = (f) => riga(ciVie.out, `  - ${f}:`);
    verifica('le vie: 11 prove, 1 superata (quella che usa la cartella temporanea), 4 in parte, 6 fallite',
      ciVie.esito === 1 && /=== MODALITA' CI: 11 prove/.test(ciVie.out) && riga(ciVie.out, 'superate:') === 'superate: 1' && /=== z_temp\.mjs - superata/.test(ciVie.out) && /: 4$/.test(riga(ciVie.out, 'in parte o saltate,')) && riga(ciVie.out, 'fallite:') === 'fallite: 6',
      [riga(ciVie.out, '=== MODALITA'), riga(ciVie.out, 'superate:'), riga(ciVie.out, 'in parte o saltate,'), riga(ciVie.out, 'fallite:')].join(' | '));
    verifica('nessuna via arriva alla copia accanto al repository', !/VEDE LA COPIA/.test(ciVie.out), (ciVie.out.match(/.*VEDE LA COPIA.*/g) || []).join(' | '));
    verifica('un worker, col codice o col file, non vede la copia, e la prova che la nomina e\' in parte',
      /worker: assente, salto/.test(ciVie.out) && /worker dal file: \S+, salto/.test(ciVie.out) && lista('q_worker.mjs') === '  - q_worker.mjs: la copia dei dati veri (cercati: ../dati-veri)', lista('q_worker.mjs') || blocco(ciVie.out, 'q_worker.mjs').slice(0, 300));
    verifica('git non vede la copia: per percorso assoluto e relativo, come cartella, dalla shell; ne\' node con --env-file=',
      ['git assoluto', 'git relativo', 'git cartella', 'git shell', 'node opzione'].every(n => ciVie.out.includes(`${n}: assente, salto`)) && lista('r_git.mjs') === '  - r_git.mjs: la copia dei dati veri (cercati: ../dati-veri)', lista('r_git.mjs') || blocco(ciVie.out, 'r_git.mjs').slice(0, 400));
    verifica('un node con l\'ambiente ridotto ha davanti lo stesso controllo', /ridotto: assente, salto/.test(ciVie.out) && lista('s_ridotto.mjs') === '  - s_ridotto.mjs: la copia dei dati veri (cercati: ../dati-veri)', lista('s_ridotto.mjs') || blocco(ciVie.out, 's_ridotto.mjs').slice(0, 300));
    verifica('e legge la cartella temporanea che la prova gli prepara, anche se la sua e\' un\'altra', /temporanea ridotta ok/.test(ciVie.out), blocco(ciVie.out, 'z_temp.mjs').slice(0, 300));
    verifica('realpathSync.native e realpath.native non arrivano alla copia', /native: assente, salto/.test(ciVie.out) && /native cb: assente, salto/.test(ciVie.out) && lista('t_native.mjs') === '  - t_native.mjs: la copia dei dati veri (cercati: ../dati-veri)', lista('t_native.mjs') || blocco(ciVie.out, 't_native.mjs').slice(0, 300));
    verifica('per le stesse vie, chi cerca la copia senza nominarla fallisce: il registro la vede (il worker anche con env {} ed execArgv [])',
      ['v_worker.mjs', 'w_git.mjs', 'x_ridotto.mjs', 'y_native.mjs'].every(f => lista(f).startsWith(`  - ${f}: ha cercato ../dati-veri fuori dal repository senza dichiararlo nel sorgente (la copia dei dati veri)`)),
      ['v_worker.mjs', 'w_git.mjs', 'x_ridotto.mjs', 'y_native.mjs'].map(lista).join(' | '));
    verifica('chi cambia il registro ai processi che lancia fallisce: cosi\' se li toglierebbe dal controllo',
      /registro suo: assente, salto/.test(ciVie.out) && lista('u_registro.mjs').startsWith('  - u_registro.mjs: cambia il registro, la radice o le cartelle temporanee del controllo (PROVE_CI_REGISTRO, PROVE_CI_RADICE, PROVE_CI_TEMP)'), lista('u_registro.mjs'));
    verifica('l\'elenco di chi nomina soltanto non copre chi cerca la copia',
      lista('proveSuGitHub.mjs').startsWith('  - proveSuGitHub.mjs: e\' fra quelle che nominano soltanto (SOLO_NOMINA in prove/esegui.mjs), ma ha cercato ../dati-veri'), lista('proveSuGitHub.mjs'));

    const buone = casa('buone', { 'a_pulita.mjs': PROVE['a_pulita.mjs'], 'b_dichiarata.mjs': PROVE['b_dichiarata.mjs'] });
    const ciBuone = gira(buone, true);
    verifica('una prova in parte non fa cadere il giro, ma non e\' superata', ciBuone.esito === 0 && riga(ciBuone.out, 'superate:') === 'superate: 1' && /: 1$/.test(riga(ciBuone.out, 'in parte o saltate,')), ciBuone.out.slice(-400));

    const appesa = casa('appesa', { 'h_appesa.mjs': 'setInterval(() => {}, 1000);' });
    const ciAppesa = gira(appesa, true, { PROVE_CI_SECONDI: '2' });
    verifica('una prova appesa si ferma e cade', ciAppesa.esito === 1 && /  - h_appesa\.mjs: ferma dopo 2 s/.test(ciAppesa.out), ciAppesa.out.slice(-300));

    const senzaGit = casa('senza-git', { 'a_pulita.mjs': PROVE['a_pulita.mjs'] }, false);
    const ciSenzaGit = gira(senzaGit, true);
    verifica('senza la storia di git il giro non parte (git show salterebbe a vuoto)', ciSenzaGit.esito === 1 && /non e' un repository git/.test(ciSenzaGit.out) && !/pulita/.test(ciSenzaGit.out), ciSenzaGit.out.slice(-300));

    console.log('4. SENZA --ci, COME PRIMA');
    const normale = gira(tutte, false);
    const titoli = normale.out.split('\n').filter(r => r.startsWith('=== '));
    verifica('una per volta, in ordine, col titolo di sempre', JSON.stringify(titoli) === JSON.stringify(Object.keys(PROVE).sort().map(f => `=== ${f} ===`)), JSON.stringify(titoli));
    verifica('esce con errore se una cade', normale.esito === 1);
    verifica('niente davanti: la copia accanto al repository si vede, come prima', /COPIA VISTA/.test(normale.out) && /COPIA LETTA/.test(normale.out) && /FLUSSO LETTO/.test(normale.out) && /FIGLIO VEDE/.test(normale.out) && /IMPORT VISTO/.test(normale.out) && /REQUIRE VISTO/.test(normale.out) && /BLOB LETTO/.test(normale.out) && /vista/.test(normale.out));
    verifica('nessun riepilogo della modalita\' CI', !/MODALITA' CI|superate:|::group::/.test(normale.out));
    // Le vie sono vere: senza --ci arrivano alla copia accanto al repository.
    const normaleVie = gira(vie, false);
    const VISTE = ['WORKER VEDE LA COPIA', 'WORKER DAL FILE VEDE LA COPIA', 'VEDE LA COPIA (git assoluto)', 'VEDE LA COPIA (git relativo)', 'VEDE LA COPIA (git cartella)',
      'VEDE LA COPIA (git shell)', 'VEDE LA COPIA (node opzione)', 'RIDOTTO VEDE LA COPIA', 'NATIVE VEDE LA COPIA', 'NATIVE CB VEDE LA COPIA', 'WORKER TACIUTO VEDE LA COPIA',
      'GIT TACIUTO VEDE LA COPIA', 'RIDOTTO TACIUTO VEDE LA COPIA', 'NATIVE TACIUTO VEDE LA COPIA', 'REGISTRO SUO VEDE LA COPIA', 'ELENCO VEDE LA COPIA', 'temporanea ridotta ok'];
    verifica('senza --ci le stesse vie arrivano alla copia: in modalita\' CI e\' il controllo a fermarle', normaleVie.esito === 0 && VISTE.every(v => normaleVie.out.includes(v)),
      VISTE.filter(v => !normaleVie.out.includes(v)).join(', ') + ' | ' + normaleVie.out.slice(-300));
    const normaleBuone = gira(casa('normale-buone', { 'a_pulita.mjs': PROVE['a_pulita.mjs'], 'g_temp.mjs': PROVE['g_temp.mjs'] }), false);
    verifica('e se passano tutte esce pulito', normaleBuone.esito === 0, normaleBuone.out.slice(-200));
  }
} finally {
  try { rmSync(base, { recursive: true, force: true }); } catch { /* la cartella temporanea si pulisce da sola */ }
}

console.log('5. LA COPIA DEI DATI VERI NON E\' NEL REPOSITORY');
const radice = qui('../');
const trovate = [];
const giro = (dir) => {
  for (const n of readdirSync(dir)) {
    if (['node_modules', '.git', 'dist'].includes(n)) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) giro(p);
    else if (/^treadrider-dati-veri-.*\.json(\.gz)?$/i.test(n)) trovate.push(p);
  }
};
giro(radice);
verifica('nessun file treadrider-dati-veri-*.json.gz dentro il repository', trovate.length === 0, trovate.join(', '));

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
