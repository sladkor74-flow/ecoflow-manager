// Lancia tutte le prove della cartella, una per volta. Esce con errore se una fallisce.
//
// --ci (npm run prove:ci): IL GIRO DI GITHUB, a ogni push su main (14/10/2026).
// Le prove giravano solo sul PC, prima di un commit; la piattaforma pero' fa
// commit da sola sul repository, e un errore entrato cosi' non lo provava nessuno
// (.github/workflows/prove.yml). Su GitHub c'e' il repository e basta: la copia
// dei dati veri (../dati-veri) e i documenti dell'utente restano sul PC. Le prove
// che li leggono girano lo stesso, perche' quasi tutte hanno anche una parte
// costruita, ma senza quella parte; e non contano come superate. In modalita' CI:
//   - ogni prova gira con prove/dati/soloIlRepository.mjs davanti, che annota
//     ogni percorso cercato fuori dal repository e risponde che non c'e', anche
//     sul PC: lanciata in locale, la modalita' CI vede quello che vede GitHub.
//     Passa da NODE_OPTIONS (--require, che vale anche nei worker), cosi' lo hanno
//     davanti anche i processi node e i worker che una prova lancia: con --import
//     sulla riga di comando un figlio che leggeva la copia sfuggiva al registro,
//     e la prova risultava superata a vuoto;
//   - il riconoscimento e' certo perche' parte dal sorgente: una prova che nomina
//     la copia (dati-veri) o un documento del PC (un percorso C:/... scritto) non
//     e' mai superata, anche se il registro e' vuoto. E' «in parte»: si conta a
//     parte e si dice che cosa le e' mancato. Il registro da solo non bastava
//     (revisione del 14/10/2026): un worker, git o un node con l'ambiente ridotto
//     leggevano la copia senza lasciarci traccia, e la prova risultava superata;
//   - il registro fa il resto: una prova che ha cercato fuori una cosa che il
//     sorgente non nomina fallisce, perche' su GitHub passerebbe a vuoto. Ogni
//     cosa cercata va dichiarata per quello che e': chi nomina la copia ma legge
//     un documento del PC lo tace;
//   - SOLO_NOMINA elenca le prove che nominano la copia o i percorsi del PC solo
//     per parlarne (prove/proveSuGitHub.mjs, la prova di questo file): girano
//     intere e sono superate, ma se cercano fuori falliscono. Solo loro possono
//     cambiare il registro, la radice o le cartelle temporanee del controllo
//     (PROVE_CI_...) ai processi che lanciano; un'altra prova che li nomina
//     fallisce, perche' cosi' si toglierebbe il controllo di davanti;
//   - le prove girano con l'ora e la lingua del PC (Europe/Rome, italiano): sono
//     scritte e provate li', e il runner di GitHub e' in UTC e in inglese. Fra le
//     22 e mezzanotte UTC il giorno italiano e' gia' l'altro, e una prova verde
//     sul PC diventerebbe rossa a seconda dell'ora del push;
//   - alcune prove confrontano col codice di commit vecchi (git show): serve la
//     storia intera, e se e' tagliata il giro si ferma invece di saltarle;
//   - le prove girano in parallelo (tante quante i processori, PROVE_PARALLELE
//     per cambiarlo), ognuna col suo resoconto stampato tutto insieme, e una
//     prova che resta appesa si ferma dopo PROVE_CI_SECONDI (300);
//   - su GitHub il riepilogo va anche nella pagina del giro, sopra i resoconti.
// Senza --ci tutto e' come prima: una per volta, a video, stesso esito.
import { appendFileSync, readdirSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { availableParallelism, tmpdir } from 'node:os';

// PROVE_CARTELLA serve solo a prove/proveSuGitHub.mjs, per far girare questo
// file su prove finte: senza, la cartella e' quella di sempre.
const qui = process.env.PROVE_CARTELLA || dirname(fileURLToPath(import.meta.url));
if (!process.argv.includes('--ci')) {
  let fallite = 0;
  for (const f of readdirSync(qui).filter(n => n.endsWith('.mjs') && n !== 'esegui.mjs').sort()) {
    console.log(`\n=== ${f} ===`);
    const r = spawnSync(process.execPath, ['--no-warnings', join(qui, f)], { stdio: 'inherit' });
    if (r.status !== 0) fallite++;
  }
  process.exit(fallite ? 1 : 0);
}

// ─── modalita' CI ───
const radice = join(qui, '..');
const sopra = dirname(radice);
// Con le barre dritte: fra virgolette NODE_OPTIONS legge \ come carattere di escape.
const davanti = join(dirname(fileURLToPath(import.meta.url)), 'dati', 'soloIlRepository.mjs').replace(/\\/g, '/');
const suGitHub = process.env.GITHUB_ACTIONS === 'true';
const quante = Math.max(1, Number(process.env.PROVE_PARALLELE) || availableParallelism());
const limite = Math.max(1, Number(process.env.PROVE_CI_SECONDI) || 300) * 1000;
// Che cosa una prova ha cercato fuori dal repository, e come lo dichiara nel
// sorgente. Ogni genere cercato deve avere la sua dichiarazione: una prova che
// nomina la copia ma legge un documento del PC (14/10/2026) lo tace.
const COPIA = { cosa: 'la copia dei dati veri', dichiara: /dati-veri|DATI_VERI/ };
const PC = { cosa: 'documenti del PC', dichiara: /['"`][A-Za-z]:[\\/]/ };
const genere = (p) => (p.split(/[\\/]/).includes('dati-veri') ? COPIA : PC);
// Le prove che nominano la copia o i percorsi del PC solo per parlarne: questo
// file lo provano su prove finte. Un elenco scritto qui, non una variabile: una
// prova non puo' aggiungersi da sola.
const SOLO_NOMINA = new Set(['proveSuGitHub.mjs']);
// Il registro, la radice e le cartelle temporanee del controllo: una prova che li
// cambia ai processi che lancia li toglie dal controllo, e solo quelle di
// SOLO_NOMINA possono.
const CONTROLLO = /PROVE_CI_(REGISTRO|RADICE|TEMP)/;
// L'ora e la lingua del PC, dove le prove sono scritte e provate.
const COME_SUL_PC = 'it-IT Europe/Rome';
// Un percorso cercato fuori, come lo si legge: la cartella accanto al repository
// (../dati-veri), oppure l'inizio di un percorso del PC. Su Linux C:/... e'
// relativo, e relative() lo metterebbe dentro il repository.
const WINDOWS = /^[A-Za-z]:[\\/]/;
const comeSi = (p) => {
  const r = relative(sopra, p);
  if (!(WINDOWS.test(p) && process.platform !== 'win32') && r && !r.startsWith('..') && !isAbsolute(r)) return '../' + r.split(/[\\/]/)[0];
  const pezzi = p.replace(/\\/g, '/').split('/');
  return pezzi.length > 5 ? pezzi.slice(0, 5).join('/') + '/...' : pezzi.join('/');
};
const secondi = (ms) => (ms / 1000).toFixed(1).replace('.', ',') + ' s';
const durata = (ms) => { const s = Math.round(ms / 1000); return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`; };

const storia = spawnSync('git', ['rev-parse', '--is-shallow-repository'], { cwd: radice, encoding: 'utf8' });
if (storia.status !== 0 || storia.stdout.trim() !== 'false') {
  console.log(storia.status !== 0
    ? `Modalita' CI: ${radice} non e' un repository git leggibile. Le prove che confrontano col codice di commit vecchi (git show) salterebbero quel confronto a vuoto.`
    : 'Modalita\' CI: la storia di git e\' tagliata (checkout con fetch-depth 1). Le prove che confrontano col codice di commit vecchi (git show) salterebbero quel confronto a vuoto: serve fetch-depth: 0.');
  process.exit(1);
}

const prove = readdirSync(qui).filter(n => n.endsWith('.mjs') && n !== 'esegui.mjs').sort();
if (!prove.length) { console.log(`Modalita' CI: nessuna prova in ${qui}.`); process.exit(1); }
const registri = mkdtempSync(join(tmpdir(), 'prove-ci-'));
// TZ vale per node anche su Windows; la lingua predefinita node la prende da
// LC_ALL e LANG su Linux, mentre su Windows segue il sistema, che sul PC e' gia'
// l'italiano.
const ambiente = { ...process.env, PROVE_CI_RADICE: radice, TZ: 'Europe/Rome', LANG: 'it_IT.UTF-8', LC_ALL: 'it_IT.UTF-8' };
delete ambiente.DATI_VERI;
// La pagina del giro la scrive solo questo file: proveSuGitHub.mjs lancia
// esegui.mjs su prove finte, e i loro riepiloghi ci finivano dentro (14/10/2026).
delete ambiente.GITHUB_STEP_SUMMARY;
// --require e non --import: --import nei worker non vale, e un worker leggeva la
// copia (revisione del 14/10/2026). Una volta sola, anche quando esegui.mjs gira
// gia' col controllo davanti (proveSuGitHub.mjs in modalita' CI).
const giaDavanti = (process.platform === 'win32' ? (process.env.NODE_OPTIONS || '').toLowerCase() : process.env.NODE_OPTIONS || '')
  .includes(process.platform === 'win32' ? davanti.toLowerCase() : davanti);
const opzioniNode = [process.env.NODE_OPTIONS, giaDavanti ? '' : `--require="${davanti}"`].filter(Boolean).join(' ');
// L'ora e la lingua che le prove vedono davvero, chieste a un node con lo stesso ambiente.
const comeLeProve = (spawnSync(process.execPath, ['-p', "const o = Intl.DateTimeFormat().resolvedOptions(); o.locale + ' ' + o.timeZone"],
  { env: ambiente, encoding: 'utf8' }).stdout || '').trim() || '?';

const lancia = (f) => new Promise((fatto) => {
  const registro = join(registri, f + '.txt');
  const inizio = Date.now();
  const uscita = [];
  const figlio = spawn(process.execPath, ['--no-warnings', join(qui, f)],
    { cwd: process.cwd(), env: { ...ambiente, PROVE_CI_REGISTRO: registro, NODE_OPTIONS: opzioniNode }, stdio: ['ignore', 'pipe', 'pipe'] });
  let scaduta = false;
  const orologio = setTimeout(() => { scaduta = true; figlio.kill(); }, limite);
  figlio.stdout.on('data', (d) => uscita.push(d));
  figlio.stderr.on('data', (d) => uscita.push(d));
  figlio.on('close', (codice) => {
    clearTimeout(orologio);
    let cercati = [];
    try { cercati = [...new Set(readFileSync(registro, 'utf8').split('\n').filter(Boolean))]; } catch { /* nessun percorso fuori */ }
    const sorgente = readFileSync(join(qui, f), 'utf8').replace(/\r/g, '');
    const soloNomina = SOLO_NOMINA.has(f);
    // Quello che la prova nomina nel sorgente, e quello che il registro l'ha vista cercare.
    const dichiarati = soloNomina ? [] : [COPIA, PC].filter(g => g.dichiara.test(sorgente));
    const generi = [COPIA, PC].filter(g => cercati.some(p => genere(p) === g));
    const taciuti = generi.filter(g => !dichiarati.includes(g));
    const cartelle = [...new Set(cercati.map(comeSi))].join(', ');
    let esito, perche = '';
    if (scaduta) { esito = 'fallita'; perche = `ferma dopo ${durata(limite)}`; }
    else if (codice !== 0) { esito = 'fallita'; perche = cercati.length ? `ha cercato fuori dal repository: ${cartelle}` : ''; }
    else if (!soloNomina && CONTROLLO.test(sorgente)) { esito = 'fallita'; perche = 'cambia il registro, la radice o le cartelle temporanee del controllo (PROVE_CI_REGISTRO, PROVE_CI_RADICE, PROVE_CI_TEMP) ai processi che lancia, e cosi\' li toglie dal controllo: possono solo le prove di SOLO_NOMINA in prove/esegui.mjs'; }
    else if (taciuti.length) {
      esito = 'fallita';
      perche = soloNomina
        ? `e' fra quelle che nominano soltanto (SOLO_NOMINA in prove/esegui.mjs), ma ha cercato ${cartelle} fuori dal repository: su GitHub non c'e', e passerebbe a vuoto`
        : `ha cercato ${cartelle} fuori dal repository senza dichiararlo nel sorgente (${taciuti.map(g => g.cosa).join('; ')}): su GitHub non c'e', e passerebbe a vuoto`;
    }
    else if (cercati.length || dichiarati.length) {
      esito = 'in parte';
      perche = `${[COPIA, PC].filter(g => generi.includes(g) || dichiarati.includes(g)).map(g => g.cosa).join('; ')} (${cercati.length ? `cercati: ${cartelle}` : 'nel sorgente: su GitHub non c\'e\''})`;
    }
    else esito = 'superata';
    fatto({ f, esito, perche, ms: Date.now() - inizio, testo: Buffer.concat(uscita).toString('utf8') });
  });
});

const stampa = (r) => {
  const testa = `${r.f} - ${r.esito === 'superata' ? 'superata' : r.esito === 'in parte' ? 'in parte' : 'FALLITA'} (${secondi(r.ms)})`;
  if (suGitHub && r.esito !== 'fallita') console.log(`::group::${testa}\n${r.testo.trimEnd()}\n::endgroup::`);
  else console.log(`\n=== ${testa} ===\n${r.testo.trimEnd()}`);
  if (r.esito === 'fallita') console.log(`${suGitHub ? '::error title=Prova fallita::' : '  '}${r.f}${r.perche ? ': ' + r.perche : ''}`);
};

const inizio = Date.now();
const esiti = [];
let prossima = 0;
const operaio = async () => {
  while (prossima < prove.length) {
    const r = await lancia(prove[prossima++]);
    esiti.push(r);
    stampa(r);
  }
};
await Promise.all(Array.from({ length: Math.min(quante, prove.length) }, operaio));
try { rmSync(registri, { recursive: true, force: true }); } catch { /* la cartella temporanea si pulisce da sola */ }

const di = (e) => esiti.filter(r => r.esito === e).sort((a, b) => a.f.localeCompare(b.f));
const superate = di('superata'), inParte = di('in parte'), fallite = di('fallita');
const altroFuso = comeLeProve !== COME_SUL_PC
  ? `le prove hanno girato con ${comeLeProve} invece di ${COME_SUL_PC}: una prova sulle date o sui numeri puo' dire diverso dal PC` : '';
console.log(`\n=== MODALITA' CI: ${prove.length} prove, ${quante} alla volta, ${durata(Date.now() - inizio)} ===`);
console.log(`lingua e ora delle prove: ${comeLeProve}`);
if (altroFuso) console.log(`${suGitHub ? '::warning title=Lingua o ora diverse dal PC::' : '  ATTENZIONE: '}${altroFuso}`);
console.log(`superate: ${superate.length}`);
console.log(`in parte o saltate, senza quello che sta solo sul PC (non contano come superate): ${inParte.length}`);
for (const r of inParte) console.log(`  - ${r.f}: ${r.perche}`);
console.log(`fallite: ${fallite.length}`);
for (const r of fallite) console.log(`  - ${r.f}${r.perche ? ': ' + r.perche : ''}`);
console.log(`le piu' lente: ${[...esiti].sort((a, b) => b.ms - a.ms).slice(0, 5).map(r => `${r.f} ${secondi(r.ms)}`).join(', ')}`);
if (process.env.GITHUB_STEP_SUMMARY) {
  const voce = (r) => `- \`${r.f}\`${r.perche ? ': ' + r.perche : ''}`;
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, [
    `### Prove: ${fallite.length ? `${fallite.length} fallite` : 'nessuna fallita'}`,
    `${prove.length} prove in ${durata(Date.now() - inizio)}: ${superate.length} superate, ${inParte.length} in parte o saltate, ${fallite.length} fallite. Lingua e ora: ${comeLeProve}.`,
    ...(altroFuso ? ['', `**Attenzione**: ${altroFuso}.`] : []),
    ...(fallite.length ? ['', '**Fallite**', ...fallite.map(voce)] : []),
    ...(inParte.length ? ['', `**In parte o saltate**, senza quello che sta solo sul PC (non contano come superate; la loro parte sui dati veri si prova sul PC):`, ...inParte.map(voce)] : []),
    '',
  ].join('\n'));
}
process.exit(fallite.length ? 1 : 0);
