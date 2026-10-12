// IL PANNELLO «CHIUSURA DEL MESE» DELLA DASHBOARD (src/components/dashboard/
// ChiusuraMese.jsx, migliorie dell'11/10/2026).
//
// Il pannello mostra soltanto: le regole stanno in base44/shared/chiusuraMese.ts
// e la lettura nella funzione statoChiusuraMese. Qui si disegnano i passi veri
// (chiusuraDelMese) con React lato server e si guarda che cosa esce: ogni passo
// col suo stato («da fare dal 12/10/2026», «non verificato» per una lettura
// caduta), il collegamento al modulo col periodo, nessun importo. E nel
// sorgente: il pannello chiede la funzione giusta, legge l'errore dal corpo
// della risposta e accetta l'anno come lo passano i filtri della dashboard,
// un elenco. npm run prove
import { build } from 'esbuild';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as C from '../base44/shared/chiusuraMese.ts';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const CLIENT_FINTO = `export const base44 = { functions: { invoke: async () => { globalThis.__CHIESTE = (globalThis.__CHIESTE || 0) + 1; return { data: {} }; } } };`;
const ESTENSIONI = ['', '.js', '.jsx', '.ts'];
const daAlias = (p) => { const base = qui('../src/' + p.slice(2)); return ESTENSIONI.map(e => base + e).find(existsSync) || base; };
const INGRESSO = `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import { MemoryRouter } from 'react-router-dom';
import ChiusuraMese, { Passi } from ${JSON.stringify(qui('../src/components/dashboard/ChiusuraMese.jsx'))};
export const disegnaPassi = (passi) => renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Passi, { passi })));
export const disegnaPannello = (props) => renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(ChiusuraMese, props)));
`;
const pacchetto = await build({
  stdin: { contents: INGRESSO, resolveDir: qui('.'), loader: 'js' },
  bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent',
  loader: { '.jsx': 'jsx', '.js': 'jsx' },
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'finti', setup(b) {
    b.onResolve({ filter: /^@\/api\/base44Client$/ }, () => ({ path: 'client', namespace: 'client-finto' }));
    b.onLoad({ filter: /.*/, namespace: 'client-finto' }, () => ({ contents: CLIENT_FINTO, loader: 'js' }));
    b.onResolve({ filter: /^@\// }, (args) => ({ path: daAlias(args.path) }));
  } }],
});
// Un errore di caricamento si dice in una riga: il pacchetto e' lungo.
let disegnaPassi = () => '', disegnaPannello = () => '';
try {
  ({ disegnaPassi, disegnaPannello } = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64')));
} catch (e) { verifica('il pannello si impacchetta e si carica', false, String(e && e.message).slice(0, 300)); }

console.log('I PASSI DISEGNATI');
{
  const SETTEMBRE = C.periodoDelMese(2026, 8);
  const docs = [
    { id: 'r', tipo: 'ATTIVA', tipologia: 'RETE', anno: 2026, mese: 'Settembre', stato: 'chiusa', numero_voci: 12, totale: 372976.5, fattura_confermata_il: '2026-10-15' },
    { id: 'a', tipo: 'ATTIVA', tipologia: 'ACI', anno: 2026, mese: 'Settembre', stato: 'approvata', numero_voci: 3, totale: 9876.54 },
    { id: 'e', tipo: 'ATTIVA', tipologia: 'EXTRA_RACCOLTA', anno: 2026, mese: 'Settembre', stato: 'elaborata', numero_voci: 0, totale: 0 },
  ];
  const r = C.chiusuraDelMese({
    periodo: SETTEMBRE, oggi: '2026-10-11', documenti: docs,
    chiusure: [{ anno: 2026, mese: 9, canale: 'RETE', congelato_il: '2026-10-10T08:00:00Z', totale_euro: 98765.43 }],
    consuntivi: [], quadrature: [], non_letti: ['quadrature'],
    freschezza: { archivi: [{ tipo_file: 'primarie', il: '2026-10-09', fino_al: '2026-10-08' }, { tipo_file: 'secondarie', il: '2026-10-09' }], in_corso: [] },
  });
  const html = disegnaPassi(r.passi);
  verifica('ci sono tutti e dieci i passi', (html.match(/<li class="border rounded-md/g) || []).length === 10, html.slice(0, 200));
  verifica('i dati caricati il 9/10 sono «da fare dal 12/10/2026»', html.includes('Dati del mese completi') && html.includes('da fare dal 12/10/2026'));
  verifica('la quadratura, la cui lettura e\' caduta, e\' «non verificato», non «fatto»', /Quadrature FIR delle settimane <span[^>]*>· non verificato/.test(html));
  verifica('l\'extra raccolta senza righe «non serve»', /Attiva Extra raccolta <span[^>]*>· non serve/.test(html));
  verifica('ogni passo porta al suo modulo col periodo e il canale', html.includes('href="/fatturazione?tab=attiva&amp;anno=2026&amp;mese=Settembre&amp;canale=ACI"') && html.includes('href="/caricamento-dati"'));
  verifica('il perche\' sta in un riquadro che si apre', (html.match(/<summary[^>]*>Perché serve<\/summary>/g) || []).length === 10);
  verifica('nessun importo a video: ne\' i totali dei documenti ne\' il congelato', !/372|9876|9\.876|98765|98\.765|€/.test(html), (html.match(/372|9876|98765|€/) || [])[0]);
}

console.log('IL PANNELLO PRIMA DELLA RISPOSTA');
{
  globalThis.__CHIESTE = 0;
  const html = disegnaPannello({ isAdmin: false, anno: [2026] });
  verifica('si apre con l\'attesa, senza rompersi', html.includes('Chiusura del mese') && html.includes('Controllo dei passi del mese'), html);
}

console.log('IL SORGENTE');
{
  const src = readFileSync(qui('../src/components/dashboard/ChiusuraMese.jsx'), 'utf8').replace(/\r/g, '');
  verifica('chiede statoChiusuraMese', /functions\.invoke\('statoChiusuraMese'/.test(src));
  verifica('l\'errore si legge dal corpo della risposta (11/10/2026)', src.includes('e?.response?.data?.error || e?.data?.error || e?.message'));
  verifica('l\'anno della dashboard e\' un elenco: con un anno solo si guarda quello', /Array\.isArray\(anno\) \? \(anno\.length === 1/.test(src));
  verifica('un mese prima ancora aperto si chiede da solo, con anno e mese', /chiedi\(\{ anno: m\.anno, mese: m\.mese \}\)/.test(src));
  verifica('nessun importo e nessun formato di soldi nel pannello', !/€|euro|toFixed|formatoSoldi|totale_euro|importo/i.test(src.replace(/^\s*\/\/.*$/gm, '')));
}

console.log(`\n${ok} verifiche passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
