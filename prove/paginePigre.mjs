// Prova delle PAGINE CHE SI SCARICANO QUANDO SI APRONO, 10/10/2026.
//
// Fino a oggi App.jsx importava tutte e ventisette le pagine in testa: chi
// apriva la dashboard scaricava anche la fatturazione, le omologhe e la
// qualifica fornitori. Il pacchetto d'avvio era 3.268 kB; ora e' 454.
//
// Come la prova delle librerie pigre, questa guarda la FORMA e non il
// comportamento: un browser qui non c'e'. Ma la forma e' precisamente quello
// che si rompe per distrazione - si aggiunge una pagina con un `import` in
// testa, come si e' sempre fatto, e quella pagina torna nel pacchetto d'avvio
// portandosi dietro tutto cio' che importa. Nessun errore, nessuna prova di
// logica rotta: solo il pacchetto che ricresce.
// npm run prove
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const app = readFileSync(qui('../src/App.jsx'), 'utf8');
const layout = readFileSync(qui('../src/components/Layout.jsx'), 'utf8');

// Il taglio non si fa ingannare dai fine-riga misti: App.jsx ne aveva di
// entrambi i tipi, e un taglio sul solo CRLF aveva saltato due righe LF
// lasciandomi due pagine statiche senza accorgermene.
const righeDi = (t) => t.split(/\r?\n/);

const PAGINA_STATICA = /^import\s+([A-Za-z0-9_]+)\s+from\s+'(@\/pages\/[A-Za-z0-9_]+)';\s*$/;
const PAGINA_PIGRA = /^const\s+([A-Za-z0-9_]+)\s+=\s+lazy\(\(\)\s+=>\s+import\('(@\/pages\/[A-Za-z0-9_]+)'\)\);\s*$/;

const statiche = righeDi(app).map(r => r.match(PAGINA_STATICA)).filter(Boolean);
const pigre = righeDi(app).map(r => r.match(PAGINA_PIGRA)).filter(Boolean);

console.log('NESSUNA PAGINA IMPORTATA IN TESTA');
verifica('nessun import statico di pagina in App.jsx', statiche.length === 0,
  statiche.map(m => m[1]).join(', '));
verifica('e ce ne sono ventisette pigre', pigre.length === 27, String(pigre.length));
verifica('ogni pagina pigra ha un nome diverso', new Set(pigre.map(m => m[1])).size === pigre.length);
verifica('e un percorso diverso', new Set(pigre.map(m => m[2])).size === pigre.length);

console.log('IL RILEVATORE FUNZIONA');
// Una prova che cerca qualcosa e non lo trova mai non prova niente.
verifica('riconosce un import statico di pagina',
  "import Dashboard from '@/pages/Dashboard';".match(PAGINA_STATICA) !== null);
verifica('riconosce una pagina pigra',
  "const Dashboard = lazy(() => import('@/pages/Dashboard'));".match(PAGINA_PIGRA) !== null);
verifica('NON confonde la pigra con la statica',
  "const Dashboard = lazy(() => import('@/pages/Dashboard'));".match(PAGINA_STATICA) === null);
verifica('NON si fa ingannare dal guscio, che statico deve restare',
  "import Layout from '@/components/Layout';".match(PAGINA_STATICA) === null);

console.log('OGNI PAGINA USATA IN UNA ROTTA E\' DICHIARATA');
// Un nome usato in una rotta ma non dichiarato non darebbe un errore di build:
// darebbe una pagina bianca, e solo a chi apre quella rotta.
const nomiDichiarati = new Set([...pigre.map(m => m[1]), 'Navigate', 'Layout', 'ProtectedRoute', 'PageErrorBoundary', 'PageNotFound']);
const nelleRotte = [...app.matchAll(/<Route[^>]*element=\{(?:<PageErrorBoundary>)?<([A-Z][A-Za-z0-9_]*)/g)].map(m => m[1]);
const orfani = [...new Set(nelleRotte)].filter(n => !nomiDichiarati.has(n));
verifica('nessuna rotta nomina una pagina che non esiste', orfani.length === 0, orfani.join(', '));
verifica('e le rotte ci sono', nelleRotte.length >= 25, String(nelleRotte.length));

console.log('LAZY SENZA SUSPENSE E\' UNA PAGINA CHE SI SCHIANTA');
// Una pagina pigra dentro un albero senza Suspense fa cadere React: non e' un
// difetto estetico, e' la pagina che non si apre.
verifica('React.lazy e\' importato', /\blazy\b/.test(app) && /from 'react'/.test(app));
verifica('il Layout ha il Suspense', /<Suspense/.test(layout));
verifica('ed e\' importato', /import React, \{ Suspense/.test(layout) || /\bSuspense\b[^<]*from 'react'/.test(layout));

console.log('L\'ATTESA STA ATTORNO ALL\'OUTLET, NON ATTORNO A TUTTO');
// Il Suspense attorno alle Routes farebbe sparire barra laterale e
// intestazione a ogni cambio di pagina: peggio che aspettare.
const dentroSuspense = layout.slice(layout.indexOf('<Suspense'), layout.indexOf('</Suspense>'));
verifica('l\'Outlet sta dentro il Suspense', /<Outlet\s*\/>/.test(dentroSuspense), dentroSuspense.slice(0, 120));
verifica('il Suspense non e\' in App.jsx attorno alle Routes', !/<Suspense[\s\S]*<Routes/.test(app));
verifica('e c\'e\' qualcosa da guardare mentre si aspetta', /animate-spin/.test(dentroSuspense));

console.log(`\n${ok} verifiche passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
