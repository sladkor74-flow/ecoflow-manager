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
// un elenco.
//
// I mesi fatturati prima del gestionale (giro K8, 12/10/2026): sotto i mesi
// prima ancora aperti, solo per l'amministratore e solo per quelli di prima di
// settembre 2026, «Segna come già chiusi». Si disegnano il riquadro col
// pulsante e il piano della conferma (PianoMesi, coi mesi da spuntare); nel
// sorgente, che il piano si chieda senza conferma e si scriva solo con la
// conferma, e che il pannello si rilegga dopo. npm run prove
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
import ChiusuraMese, { Passi, MesiChiusiFuori, PianoMesi } from ${JSON.stringify(qui('../src/components/dashboard/ChiusuraMese.jsx'))};
export const disegnaPassi = (passi) => renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Passi, { passi })));
export const disegnaFuori = (props) => renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(MesiChiusiFuori, props)));
export const disegnaPiano = (props) => renderToStaticMarkup(React.createElement(PianoMesi, props));
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
let disegnaPassi = () => '', disegnaPannello = () => '', disegnaFuori = () => '', disegnaPiano = () => '';
// utils legge window a caricamento (isIframe), e la finestra di conferma dei
// mesi chiusi fuori lo porta nel pannello (12/10/2026): qui basta che esista.
globalThis.window = globalThis.window || { self: 1, top: 1 };
try {
  ({ disegnaPassi, disegnaPannello, disegnaFuori, disegnaPiano } = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64')));
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

console.log('I MESI FATTURATI PRIMA DEL GESTIONALE (giro K8, 12/10/2026)');
{
  const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto'];
  let n = 0;
  // Come nella copia dei dati veri, ma marzo senza il documento ACI.
  const docs = MESI.flatMap(m => ['RETE', 'ACI', 'EXTRA_RACCOLTA'].map(c => ({ id: `d${++n}`, tipo: 'ATTIVA', anno: 2026, mese: m, tipologia: c, stato: 'elaborata',
    numero_voci: c === 'EXTRA_RACCOLTA' ? 0 : 300, totale: 372976.5, data_elaborazione: '2026-10-06T11:21:06.047Z' })))
    .filter(d => !(d.mese === 'Marzo' && d.tipologia === 'ACI'));
  const aperti = C.mesiAncoraAperti({ ultimo: C.meseDaChiudere({ oggi: '2026-10-12' }).ultimo, documenti: docs, chiusure: [], movimentiExtra: [] });
  const fuori = disegnaFuori({ mesi: aperti.filter(m => m.prima_del_gestionale), totale: aperti.length, primoMese: 'Settembre 2026' });
  verifica('il riquadro dice quali mesi e perche\', col pulsante', fuori.includes('Questi 8 mesi vengono prima di settembre 2026, il primo mese chiuso nel gestionale: le loro fatture si sono fatte fuori, e puoi segnarli come già chiusi.')
    && /<button[^>]*>.*Segna come già chiusi<\/button>/.test(fuori), fuori);
  const uno = disegnaFuori({ mesi: aperti.slice(0, 1), totale: 3, primoMese: 'Settembre 2026' });
  verifica('con un mese solo lo nomina', uno.includes('Gennaio 2026 viene prima di settembre 2026') && uno.includes('puoi segnarlo come già chiuso'), uno);
  const piano = C.pianoMesiChiusiFuori({ mesi: aperti.map(m => ({ anno: m.anno, mese: m.mese })), oggi: '2026-10-12', documenti: docs, chiusure: [], movimentiExtra: [] });
  const scelti = new Set(piano.mesi.filter(m => m.canali.some(c => c.azione === 'chiude')).map(m => `${m.anno}-${m.numero}`));
  const html = disegnaPiano({ piano, scelti });
  verifica('la conferma elenca gli otto mesi, ognuno da spuntare', MESI.every(m => html.includes(`>${m} 2026<`)) && (html.match(/type="checkbox"/g) || []).length === 8 && (html.match(/checked=""/g) || []).length === 8, html.slice(0, 300));
  verifica('e per ogni mese che cosa succede a ogni canale', html.includes('Rete: elaborata il 06/10/2026, 300 righe; da «elaborata» a «chiusa».') && html.includes('Extra raccolta: elaborata il 06/10/2026, senza righe; da «elaborata» a «chiusa».'), html.slice(0, 600));
  verifica('marzo senza il documento ACI: si dice, e resta aperto', html.includes('ACI: nessun documento dell&#x27;attiva.') && html.includes('Resta aperto: manca l&#x27;elaborazione dell&#x27;attiva (ACI).') && (html.match(/Dopo è chiuso\./g) || []).length === 7, html);
  verifica('nessun importo nella conferma', !/372|€/.test(html + fuori));
}

console.log('IL SORGENTE');
{
  const src = readFileSync(qui('../src/components/dashboard/ChiusuraMese.jsx'), 'utf8').replace(/\r/g, '');
  verifica('chiede statoChiusuraMese', /functions\.invoke\('statoChiusuraMese'/.test(src));
  verifica('l\'errore si legge dal corpo della risposta (11/10/2026)', src.includes('e?.response?.data?.error || e?.data?.error || e?.message'));
  verifica('l\'anno della dashboard e\' un elenco: con un anno solo si guarda quello', /Array\.isArray\(anno\) \? \(anno\.length === 1/.test(src));
  verifica('un mese prima ancora aperto si chiede da solo, con anno e mese', /chiedi\(\{ anno: m\.anno, mese: m\.mese \}\)/.test(src));
  verifica('i mesi chiusi fuori: solo l\'amministratore, solo quelli di prima del gestionale', /\{isAdmin && dati\.mesi_aperti\.some\(m => m\.prima_del_gestionale\) && \(\s*<MesiChiusiFuori\s+mesi=\{dati\.mesi_aperti\.filter\(m => m\.prima_del_gestionale\)\}/.test(src));
  verifica('il piano si chiede senza conferma, la scrittura solo con la conferma, alla funzione che scrive', /functions\.invoke\('segnaMesiChiusiFuori'/.test(src) && /segnaFuori\(\{ mesi: elencoMesi \}\)/.test(src)
    && (src.match(/conferma: true/g) || []).length === 1 && /segnaFuori\(\{ mesi: daScrivere\.map\(m => \(\{ anno: m\.anno, mese: m\.mese \}\)\), conferma: true \}\)/.test(src));
  verifica('dopo la scrittura il pannello si rilegge e dice l\'esito', /onFatto=\{\(esito\) => \{ setSegnati\(esito\); setGiro\(g => g \+ 1\); \}\}/.test(src));
  verifica('nessun importo e nessun formato di soldi nel pannello',!/€|euro|toFixed|formatoSoldi|totale_euro|importo/i.test(src.replace(/^\s*\/\/.*$/gm, '')));
}

console.log(`\n${ok} verifiche passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
