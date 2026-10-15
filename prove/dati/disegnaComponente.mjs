// DISEGNARE UN COMPONENTE VERO DELLE PAGINE DENTRO UNA PROVA (prova generale del
// cambio d'anno, 15/10/2026).
//
// Le parole che l'utente legge stanno nei componenti: «Atteso al 31/12», «copiato,
// da confermare», «copiata dal 2026». Cercarle nel sorgente dice che ci sono, non
// che escono quando devono. Qui il componente si impacchetta con esbuild e si
// disegna con React lato server (renderToStaticMarkup), con i suoi import veri:
// solo il client della piattaforma e l'accesso sono finti, come in
// prove/copiaSenzaVariazioni.mjs (sezione 4). Il risultato e' l'HTML, e
// testoDi lo riduce alle parole a video.
//
// Sta in prove/dati perche' non e' una prova: esegui.mjs guarda solo i .mjs in
// cima alla cartella.
import { build } from 'esbuild';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
// src/lib/utils.js guarda window appena caricato (isIframe): un window finto,
// come in prove/dati/libPagine.mjs.
if (typeof globalThis.window === 'undefined') globalThis.window = { self: 1, top: 1 };

const ESTENSIONI = ['', '.js', '.jsx', '.ts', '/index.js', '/index.jsx'];
const daAlias = (p) => { const base = qui('../../src/' + p.slice(2)); return ESTENSIONI.map(e => base + e).find(existsSync) || base; };
const FINTI = {
  client: 'export const base44 = { functions: { invoke: async () => ({ data: {} }) }, entities: new Proxy({}, { get: () => ({ filter: async () => [], list: async () => [] }) }), auth: { me: async () => ({}) } };',
  accesso: 'export const useAuth = () => ({ user: { role: "admin" }, isLoadingAuth: false }); export const AuthProvider = ({ children }) => children;',
};

/**
 * Il componente `nome` (default: quello predefinito) del file `percorso` (dalla
 * radice del repository, per esempio 'src/components/target-status/TargetTable.jsx'):
 * restituisce (props) => HTML, dentro un MemoryRouter.
 */
export async function disegnaComponente(percorso, nome = 'default') {
  const INGRESSO = [
    "import React from 'react';",
    "import { renderToStaticMarkup } from 'react-dom/server.browser';",
    "import { MemoryRouter } from 'react-router-dom';",
    `import * as M from ${JSON.stringify(qui('../../' + percorso))};`,
    `export const disegna = (props) => renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(M[${JSON.stringify(nome)}], props)));`,
  ].join('\n');
  const pacchetto = await build({
    stdin: { contents: INGRESSO, resolveDir: qui('.'), loader: 'js' },
    bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent',
    loader: { '.jsx': 'jsx', '.js': 'jsx' }, jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'finti', setup(b) {
      b.onResolve({ filter: /^@\/api\/base44Client$/ }, () => ({ path: 'client', namespace: 'finto' }));
      b.onResolve({ filter: /^@\/lib\/AuthContext$/ }, () => ({ path: 'accesso', namespace: 'finto' }));
      b.onLoad({ filter: /.*/, namespace: 'finto' }, (a) => ({ contents: FINTI[a.path], loader: 'js', resolveDir: qui('.') }));
      b.onResolve({ filter: /^@\// }, (a) => ({ path: daAlias(a.path) }));
    } }],
  });
  return (await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'))).disegna;
}

/** Le parole a video di un pezzo di HTML, con gli spazi ridotti a uno. */
export const testoDi = (html) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
