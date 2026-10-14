// Prova dei PACCHETTI LEGGERI: che cosa scarica una pagina quando si apre
// (14/10/2026, migliorie approvate dall'utente: «per me ok sulle cose da
// sistemare, sulla velocità e su quanto da creare, procedi pure»).
//
// Le pagine si scaricano gia' una alla volta (prove/paginePigre.mjs) e xlsx e
// jspdf si prendono dentro le funzioni che li usano (prove/libreriePigre.mjs).
// Restavano due pesi aperti con la pagina, misurati con la build:
//   - Target & Status, 595 kB: 385 di pptxgenjs (col suo jszip), importato in
//     testa a src/lib/statusExports.js per il solo pulsante «PPT», e le cinque
//     schede che non sono l'Andamento (circa 280 kB coi loro pezzi);
//   - la Dashboard, 477 kB: quasi tutti della libreria dei grafici (recharts),
//     che serve al solo grafico mese per mese della rete, disegnato quando il
//     quadro e' arrivato dal server.
// Prima apertura (avvio + pagina, minificato): Dashboard da 998 a 574 kB, Target
// & Status da 1.221 a 556 kB; i grafici si scaricano mentre arrivano i dati, la
// presentazione quando si preme «PPT».
//
// Qui non c'e' un browser, ma il grafo si puo' guardare davvero: esbuild
// impacchetta l'app come la impacchetta la build, divisa in pezzi, e dice per
// ogni pezzo che cosa importa in testa e che cosa a richiesta. Una pagina scarica
// all'apertura il suo pezzo e tutto quello che lui importa in testa, a catena:
// li' dentro non devono esserci le librerie dei file, e la Dashboard non deve
// avere la libreria dei grafici. Poi la forma nei sorgenti, che dice dove si e'
// sbagliato quando la prima parte fallisce. I byte sono quelli di esbuild
// minificato, non quelli di Vite: servono come soglia, non come misura.
// npm run prove
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
const RADICE = qui('../');
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const sorgente = (p) => readFileSync(join(RADICE, p), 'utf8').replace(/\r/g, '');
const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

// Le librerie che servono solo a fare un file, quando si preme un pulsante: mai
// nel grafo d'apertura di una pagina, ne' in quello d'avvio. jszip arriva con
// pptxgenjs, canvg e html2canvas con jspdf.
const LIBRERIE_DEI_FILE = ['exceljs', 'jspdf', 'xlsx', 'pptxgenjs', 'jszip', 'pdf-lib', 'pdfjs-dist', 'html2canvas', 'canvg'];
// Le librerie dei grafici e delle mappe: mai all'avvio, e la Dashboard le
// scarica a parte.
const GRAFICI = ['recharts', 'three', 'leaflet'];

// ─── 1. IL GRAFO VERO, IMPACCHETTATO ───
const ESTENSIONI = ['', '.jsx', '.js', '.ts', '/index.jsx', '/index.js'];
const dalAlias = (p) => ESTENSIONI.map(e => join(RADICE, 'src', p.slice(2)) + e).find(f => existsSync(f) && statSync(f).isFile());
// esbuild scrive nel resoconto i percorsi relativi alla sua cartella di lavoro,
// e qui si cercano 'src/main.jsx' e 'src/pages/...': la cartella e' la radice
// del repository (absWorkingDir), qualunque sia quella da cui si lancia la prova.
// Senza, lanciata da prove/ o da fuori, dava 13 errori col codice giusto
// (revisione del 14/10/2026). Per questo la prova si mette apposta in prove/:
// ogni giro controlla anche che non dipenda dalla cartella da cui parte.
// esbuild si carica dopo, perche' prende la cartella di lavoro quando si carica:
// importato in testa terrebbe quella di partenza, e lo spostamento non direbbe
// niente.
process.chdir(join(RADICE, 'prove'));
const { build } = await import('esbuild');
let uscite = null;
try {
  const r = await build({
    absWorkingDir: RADICE,
    entryPoints: [join(RADICE, 'src/main.jsx')],
    bundle: true, splitting: true, format: 'esm', platform: 'browser', minify: true,
    write: false, outdir: join(RADICE, 'pacchetti-non-scritti'), metafile: true, logLevel: 'silent',
    loader: { '.js': 'jsx', '.jsx': 'jsx', '.css': 'empty', '.jpg': 'empty', '.jpeg': 'empty', '.png': 'empty', '.svg': 'empty', '.woff': 'empty', '.woff2': 'empty' },
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'alias', setup(b) { b.onResolve({ filter: /^@\// }, (a) => ({ path: dalAlias(a.path) })); } }],
  });
  uscite = r.metafile.outputs;
} catch (e) {
  verifica('l\'app si impacchetta', false, String(e && e.message).slice(0, 600));
}

const nomi = uscite ? Object.keys(uscite) : [];
const ingresso = (punto) => nomi.find(n => uscite[n].entryPoint === punto);
/** Il pezzo e quelli che importa in testa, a catena: cio' che si scarica per aprirlo. */
const inTesta = (n) => {
  const visti = new Set();
  const giro = (x) => { if (!x || visti.has(x)) return; visti.add(x); for (const i of uscite[x].imports) if (i.kind === 'import-statement' && !i.external) giro(i.path); };
  giro(n);
  return visti;
};
/** Anche quelli a richiesta: tutto cio' che la pagina puo' arrivare a scaricare. */
const tutto = (n) => {
  const visti = new Set();
  const giro = (x) => { if (!x || visti.has(x)) return; visti.add(x); for (const i of uscite[x].imports) if (!i.external && (i.kind === 'import-statement' || i.kind === 'dynamic-import')) giro(i.path); };
  giro(n);
  return visti;
};
/** I pacchetti di node_modules dentro un insieme di pezzi. */
const pacchetti = (insieme) => {
  const p = new Set();
  for (const n of insieme) for (const f of Object.keys(uscite[n].inputs)) { const m = f.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/); if (m) p.add(m[1]); }
  return p;
};
const kB = (insieme) => Math.round([...insieme].reduce((t, n) => t + uscite[n].bytes, 0) / 1000);
const fuori = (insieme, base) => new Set([...insieme].filter(n => !base.has(n)));

console.log('1. L\'AVVIO: NE\' LIBRERIE DEI FILE NE\' GRAFICI');
const avvio = ingresso('src/main.jsx');
verifica('c\'e\' il pezzo d\'avvio', !!avvio || !uscite);
const sAvvio = avvio ? inTesta(avvio) : new Set();
const pAvvio = pacchetti(sAvvio);
verifica('nel grafo d\'avvio nessuna libreria dei file ne\' dei grafici', avvio && ![...LIBRERIE_DEI_FILE, ...GRAFICI].some(l => pAvvio.has(l)),
  [...LIBRERIE_DEI_FILE, ...GRAFICI].filter(l => pAvvio.has(l)).join(', '));
verifica('e pesa meno di 600 kB (esbuild minificato)', avvio && kB(sAvvio) < 600, `${kB(sAvvio)} kB`);

console.log('2. NESSUNA PAGINA APRE UNA LIBRERIA DEI FILE');
const pagine = nomi.filter(n => /^src\/pages\/[^/]+\.jsx$/.test(uscite[n].entryPoint || ''));
verifica('le pagine sono pezzi a parte, tutte', pagine.length >= 27, String(pagine.length));
const colpevoli = [];
for (const n of pagine) {
  const p = pacchetti(fuori(inTesta(n), sAvvio));
  const pesanti = LIBRERIE_DEI_FILE.filter(l => p.has(l));
  if (pesanti.length) colpevoli.push(`${uscite[n].entryPoint.replace('src/pages/', '')}: ${pesanti.join(', ')}`);
}
verifica('nessuna pagina scarica all\'apertura exceljs, jspdf, xlsx, pptxgenjs, pdf-lib, pdf.js...', colpevoli.length === 0, colpevoli.join(' | '));

console.log('3. LA DASHBOARD: I GRAFICI ARRIVANO A PARTE');
const dash = ingresso('src/pages/Dashboard.jsx');
const sDash = dash ? fuori(inTesta(dash), sAvvio) : new Set();
const pDash = pacchetti(sDash);
verifica('all\'apertura niente libreria dei grafici', dash && !GRAFICI.some(l => pDash.has(l)), GRAFICI.filter(l => pDash.has(l)).join(', '));
verifica('il pezzo della pagina, oltre l\'avvio, sotto i 250 kB', dash && kB(sDash) < 250, `${kB(sDash)} kB`);
// Il rilevatore funziona: la libreria dei grafici la pagina la raggiunge, a richiesta.
verifica('ma i grafici la Dashboard li raggiunge, a richiesta (il rilevatore li vede)', dash && pacchetti(tutto(dash)).has('recharts'));
const sezioni = ['SezioneRete', 'SezioneAci', 'SezioneExtra'].map(s => ingresso(`src/components/dashboard/${s}.jsx`));
verifica('le tre sezioni dei canali sono pezzi a parte, chiesti a richiesta', sezioni.every(Boolean) && sezioni.every(s => !sDash.has(s)), JSON.stringify(sezioni));
verifica('e il modulo del PDF del quadro anche', !!ingresso('src/components/dashboard/esportaQuadro.js') && !sDash.has(ingresso('src/components/dashboard/esportaQuadro.js')));

console.log('4. TARGET & STATUS: LA PRESENTAZIONE E LE SCHEDE CHIUSE ARRIVANO A PARTE');
const ts = ingresso('src/pages/TargetStatus.jsx');
const sTs = ts ? fuori(inTesta(ts), sAvvio) : new Set();
const pTs = pacchetti(sTs);
verifica('all\'apertura niente pptxgenjs ne\' jszip', ts && !pTs.has('pptxgenjs') && !pTs.has('jszip'), [...pTs].filter(l => /pptx|zip/.test(l)).join(', '));
verifica('il pezzo della pagina, oltre l\'avvio, sotto i 250 kB', ts && kB(sTs) < 250, `${kB(sTs)} kB`);
verifica('ma la presentazione la pagina la raggiunge, a richiesta (il rilevatore la vede)', ts && pacchetti(tutto(ts)).has('pptxgenjs'));
const SCHEDE = ['TargetRaccoglitoriGrid', 'CommessaEcotyreForm', 'ConfigurazioneImpianti', 'ZoneRaccoglitori', 'NuovoAnno'];
const pezziSchede = SCHEDE.map(s => ingresso(`src/components/target-status/${s}.jsx`));
verifica('le cinque schede che non sono l\'Andamento sono pezzi a parte', pezziSchede.every(Boolean) && pezziSchede.every(s => !sTs.has(s)),
  SCHEDE.filter((s, i) => !pezziSchede[i] || sTs.has(pezziSchede[i])).join(', '));
console.log(`  (esbuild minificato, oltre l'avvio di ${kB(sAvvio)} kB: Dashboard ${kB(sDash)} kB, Target & Status ${kB(sTs)} kB)`);

console.log('5. LA FORMA NEI SORGENTI');
// Nessun file importa in testa una libreria dei file: libreriePigre.mjs lo
// controlla per xlsx e jspdf, qui per tutte.
const sorgenti = [];
const gira = (dir) => { for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) gira(p); else if (/\.(js|jsx)$/.test(n)) sorgenti.push(p); } };
gira(join(RADICE, 'src'));
const statico = (testo, modulo) => testo.split('\n').some(r => /^\s*import\b/.test(r) && new RegExp(`from\\s*['"]${modulo}(/[^'"]*)?['"]|^\\s*import\\s*['"]${modulo}(/[^'"]*)?['"]`).test(r));
const inTestaA = [];
for (const p of sorgenti) {
  const t = readFileSync(p, 'utf8').replace(/\r/g, '');
  for (const l of LIBRERIE_DEI_FILE) if (statico(t, l)) inTestaA.push(`${relative(RADICE, p).replace(/\\/g, '/')}: ${l}`);
}
verifica('nessun import in testa di una libreria dei file, in tutto src', inTestaA.length === 0, inTestaA.join(' | '));
verifica('il rilevatore riconosce un import in testa, anche di un sottopercorso', statico("import pptxgen from 'pptxgenjs';", 'pptxgenjs') && statico("import x from 'pdfjs-dist/build/pdf.mjs';", 'pdfjs-dist'));
verifica('e non confonde quello a richiesta', !statico("  const { default: pptxgen } = await import('pptxgenjs');", 'pptxgenjs'));

const se = senzaCommenti(sorgente('src/lib/statusExports.js'));
verifica('statusExports.js: pptxgenjs si prende dentro exportPPT, che resta asincrona',
  /export async function exportPPT\(/.test(se) && /await import\('pptxgenjs'\)/.test(se.slice(se.indexOf('export async function exportPPT('))));
verifica('...e il pulsante aspetta la funzione (ExportButtons)', /await fn\(\)/.test(sorgente('src/components/target-status/ExportButtons.jsx')));

const d = senzaCommenti(sorgente('src/pages/Dashboard.jsx'));
for (const s of ['SezioneRete', 'SezioneAci', 'SezioneExtra']) {
  verifica(`Dashboard.jsx: ${s} pigra, non in testa`, new RegExp(`const ${s} = lazy\\(\\(\\) => import\\('@/components/dashboard/${s}'\\)\\);`).test(d) && !new RegExp(`^import ${s}\\b`, 'm').test(d));
}
verifica('Dashboard.jsx: le tre sezioni dentro un Suspense', /<Suspense fallback=\{[\s\S]*?\}>\s*<SezioneRete [\s\S]*?<SezioneAci [\s\S]*?<SezioneExtra [\s\S]*?<\/Suspense>/.test(d));
verifica('Dashboard.jsx: e si chiedono al primo disegno, mentre arrivano i dati', /useEffect\(\(\) => \{ preparaSezioni\(\)\.catch\(\(\) => \{\}\); \}, \[\]\);/.test(d));
verifica('Dashboard.jsx: il modulo del PDF del quadro si prende al clic', !/^import .*esportaQuadro/m.test(d) && /await import\('@\/components\/dashboard\/esportaQuadro'\)/.test(d));

const t = senzaCommenti(sorgente('src/pages/TargetStatus.jsx'));
for (const s of SCHEDE) {
  verifica(`TargetStatus.jsx: ${s} pigra, dentro il suo Suspense`,
    new RegExp(`const ${s} = lazy\\(\\(\\) => import\\('@/components/target-status/${s}'\\)\\);`).test(t) && !new RegExp(`^import ${s}\\b`, 'm').test(t)
    && new RegExp(`<Suspense fallback=\\{<AttesaScheda />\\}><${s}\\b`).test(t));
}
verifica('TargetStatus.jsx: React.lazy e Suspense importati', /import React, \{[^}]*\blazy\b[^}]*\bSuspense\b[^}]*\} from 'react';/.test(t));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
