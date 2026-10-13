// LE PROVINCE DEL CONTRATTO NELLA MATRICE DI VERIFICHE, ANCHE SENZA RITIRI
// (revisione del 13/10/2026).
//
// La matrice delle Primarie (computeProvinceMatrix) mette a zero le province del
// contratto dell'anno senza ritiri dal 12/10, e dal 13/10 sul sito
// (prove/provinceDelContratto.mjs). Quella di Verifiche (matriceProvinceRete,
// sezioni 3 e 4) costruiva le righe solo dai movimenti: una provincia del
// contratto mai servita non compariva, e non poteva avere i suoi mesi di fila
// senza ritiri. Ora la funzione legge CommessaEcotyre insieme ai ritiri (una
// lettura in piu' per la pagina) e aggiunge le province di
// provinceDelContratto(commessaDellAnno(commesse, anno), anno) con kg e ritiri a
// zero; MatriceProvince.jsx le segna «del contratto, nessun ritiro nell'anno».
// La prova chiama la funzione vera sul banco (SDK finto) e disegna la vista vera
// con React lato server. npm run prove
import { build } from 'esbuild';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { oggiRoma } from '../base44/shared/giornoItaliano.ts';
import { caricaFunzione, chiama } from './dati/bancoFunzioni.mjs';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = JSON.stringify;

// Un anno finito, cosi' la vista conta tutti e dodici i mesi in qualunque giorno
// giri la prova: l'anno scorso di oggi.
const anno = Number(oggiRoma().slice(0, 4)) - 1;
// il riparto del contratto 2026 com'e' scritto nell'archivio (11/10/2026)
const REGIONI = '[{"regione":"Campania","province":"Tutte le provincie","target_t":4400},{"regione":"Puglia","province":"BA,BR,TA,LE","target_t":2500},{"regione":"Basilicata","province":"Tutte le provincie","target_t":500},{"regione":"Calabria","province":"Tutte le provincie","target_t":1650},{"regione":"Sicilia","province":"CT, SR, TP, AG, CL, EN, RG","target_t":2500}]';
const commessa = { id: 'c', anno, target_annuo_t: 11550, regioni_json: REGIONI, updated_date: `${anno}-01-10T00:00:00Z` };
const mov = (id, giorno, provincia = 'NA', regione = 'Campania') => ({ id, id_ordine: id, stato: 'terminato', provincia, regione, numero_fir: 'F' + id, peso_effettivo: 3000,
  ordine_immesso_il: `${giorno}T08:00:00Z`, trasporto_iniziato_il: `${giorno}T09:00:00Z`, trasporto_finito_il: `${giorno}T10:00:00Z` });
// ritiri solo a NA, uno al mese per tutto l'anno
const soloNapoli = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(m => mov('NA' + m, `${anno}-${m}-10`));

const f = await caricaFunzione('matriceProvinceRete');

console.log('LA FUNZIONE DI VERIFICHE');
let dati = null;
{
  const { stato, j } = await chiama(f, { db: { PrimariaRete: soloNapoli, CommessaEcotyre: [commessa] }, ruolo: 'user', corpo: { anno } });
  dati = j;
  const righe = j.righe || [];
  const ba = righe.find(r => r.provincia === 'BA');
  verifica('BA, del contratto e mai servita, ha la sua riga con kg e ritiri a zero', stato === 200 && !!ba && ba.regione === 'Puglia' && ba.del_contratto === true && ba.senza_ritiri === true
    && ba.kg.length === 12 && ba.kg.every(v => v === 0) && ba.ritiri.every(v => v === 0) && ba.kg_totale === 0 && ba.ritiri_totale === 0, J(ba || righe.map(r => r.provincia)));
  verifica('ci sono tutte e 23 le province del contratto', righe.filter(r => r.del_contratto).length === 23 && righe.length === 23, J(righe.map(r => r.provincia)));
  const na = righe.find(r => r.provincia === 'NA');
  verifica('NA, che lavora, e\' del contratto e ha i suoi ritiri', !!na && na.del_contratto && !na.senza_ritiri && na.ritiri_totale === 12 && na.kg_totale === 36000, J(na));
  verifica('i totali sono quelli dei ritiri: le righe a zero non li toccano', j.totali && j.totali.kg_totale === 36000 && j.totali.ritiri_totale === 12, J(j.totali));
  verifica('le righe restano in ordine di regione e provincia', J(righe.map(r => r.regione + ' ' + r.provincia)) === J([...righe].sort((a, b) => a.regione.localeCompare(b.regione, 'it') || a.provincia.localeCompare(b.provincia, 'it')).map(r => r.regione + ' ' + r.provincia)));
  verifica('e la risposta dice di aver letto il contratto', j.contratto_letto === true, J(j.contratto_letto));
}
{
  // una provincia fuori contratto con ritiri resta, e non e' del contratto
  const { j } = await chiama(f, { db: { PrimariaRete: [...soloNapoli, mov('FG1', `${anno}-09-05`, 'FG', 'Puglia')], CommessaEcotyre: [commessa] }, corpo: { anno } });
  const fg = (j.righe || []).find(r => r.provincia === 'FG');
  verifica('FG, fuori contratto con un ritiro: c\'e\', e non e\' del contratto', !!fg && fg.ritiri_totale === 1 && fg.del_contratto === false && fg.senza_ritiri === false, J(fg));
}
{
  // il contratto di un altro anno non vale per questo
  const { j } = await chiama(f, { db: { PrimariaRete: soloNapoli, CommessaEcotyre: [{ ...commessa, anno: anno + 1 }] }, corpo: { anno } });
  verifica('il contratto dell\'anno dopo non mette province in questo', J((j.righe || []).map(r => r.provincia)) === J(['NA']) && j.contratto_letto === true, J((j.righe || []).map(r => r.provincia)));
  // senza contratti nell'archivio: la matrice dei movimenti
  const vuoto = await chiama(f, { db: { PrimariaRete: soloNapoli, CommessaEcotyre: [] }, corpo: { anno } });
  verifica('senza contratto: solo le province con ritiri', J((vuoto.j.righe || []).map(r => r.provincia)) === J(['NA']), J((vuoto.j.righe || []).map(r => r.provincia)));
}
let rotto = null;
{
  // l'archivio dei contratti che non si legge (un oggetto al posto dell'elenco)
  rotto = await chiama(f, { db: { PrimariaRete: soloNapoli, CommessaEcotyre: {} }, corpo: { anno } });
  verifica('se il contratto non si legge la pagina resta su: la matrice dei movimenti e contratto_letto false',
    rotto.stato === 200 && J((rotto.j.righe || []).map(r => r.provincia)) === J(['NA']) && rotto.j.contratto_letto === false, J([rotto.stato, rotto.j.error, rotto.j.contratto_letto]));
  const sorgente = readFileSync(qui('../base44/functions/matriceProvinceRete/entry.ts'), 'utf8').replace(/\r/g, '');
  verifica('i contratti si leggono una volta, insieme ai ritiri', (sorgente.match(/fetchAll\(/g) || []).length === 2 && /Promise\.all\(\[/.test(sorgente)
    && /provinceDelContratto\(commessaDellAnno\(commesse, anno\), anno\)/.test(sorgente), 'letture: ' + (sorgente.match(/fetchAll\(/g) || []).length);
}

console.log('LA VISTA DI VERIFICHE');
{
  // MatriceProvince carica i dati in un effetto, che lato server non gira: lo
  // stato iniziale (dati, anno, caricando) si passa da una coda letta da un
  // useState finto, che per il resto e' quello di React.
  const REACT = qui('../node_modules/react/index.js');
  const INGRESSO = `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import MatriceProvince from ${J(qui('../src/components/verifiche/MatriceProvince.jsx'))};
export const disegna = (props) => renderToStaticMarkup(React.createElement(MatriceProvince, props));
`;
  const REACT_CON_CODA = `
import * as R from ${J(REACT)};
export * from ${J(REACT)};
export default R.default || R;
export function useState(iniziale) {
  const coda = globalThis.__STATI_INIZIALI || [];
  return R.useState(coda.length ? coda.shift() : iniziale);
}`;
  const ESTENSIONI = ['', '.js', '.jsx', '.ts'];
  const daAlias = (p) => { const b = qui('../src/' + p.slice(2)); return ESTENSIONI.map(e => b + e).find(x => existsSync(x) && /\.\w+$/.test(x)) || b; };
  let L = null;
  try {
    const pacchetto = await build({
      stdin: { contents: INGRESSO, resolveDir: qui('.'), loader: 'js' },
      bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent',
      loader: { '.jsx': 'jsx', '.js': 'jsx' },
      define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [{ name: 'finti', setup(b) {
        // solo i file del gestionale prendono il React con la coda: react-dom
        // tiene il suo, che e' lo stesso
        b.onResolve({ filter: /^react$/ }, (a) => (/[\\/]src[\\/]/.test(a.importer) ? { path: 'react-con-coda', namespace: 'finti' } : undefined));
        b.onResolve({ filter: /^@\/api\/base44Client$/ }, () => ({ path: 'client', namespace: 'finti' }));
        b.onResolve({ filter: /^@\/components\/ui\/use-toast$/ }, () => ({ path: 'toast', namespace: 'finti' }));
        b.onLoad({ filter: /.*/, namespace: 'finti' }, (a) => ({
          contents: a.path === 'react-con-coda' ? REACT_CON_CODA
            : a.path === 'toast' ? 'export const useToast = () => ({ toast() {} });'
            : 'export const base44 = { functions: { invoke: async () => ({ data: {} }) } };',
          loader: 'js', resolveDir: qui('.'),
        }));
        b.onResolve({ filter: /^@\// }, (args) => ({ path: daAlias(args.path) }));
      } }],
    });
    if (typeof globalThis.window === 'undefined') globalThis.window = { self: 1, top: 1, matchMedia: () => ({ matches: false, addListener() {}, removeListener() {} }) };
    L = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
  } catch (e) { verifica('la vista si impacchetta', false, String(e && e.message).slice(0, 400)); }
  const testo = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
  // gli stati della vista, nell'ordine: dati, anno, caricando
  const disegna = (d, tipo) => {
    globalThis.__STATI_INIZIALI = [d, d && d.anno, false];
    try { return L ? testo(L.disegna({ tipo })) : ''; } catch (e) { verifica('la vista si disegna', false, String(e && e.message).slice(0, 300)); return ''; } finally { globalThis.__STATI_INIZIALI = []; }
  };

  const ritiri = disegna(dati, 'ritiri');
  verifica('la tabella segna la riga di BA: «del contratto, nessun ritiro nell\'anno»', /BA del contratto, nessun ritiro nell'anno/.test(ritiri), ritiri.slice(0, 600));
  verifica('NA, che ha ritiri, non ha il segno', !/NA del contratto, nessun ritiro/.test(ritiri));
  verifica('il riquadro dice di BA che e\' del contratto e mai servita, al posto dei mesi', /BA \(Puglia\): del contratto, nessun ritiro nell'anno — 12 mesi di fila senza ritiri, da recuperare subito/.test(ritiri), (ritiri.match(/province sono ferme.{0,300}/) || [''])[0]);
  verifica('«Province con ritiri» conta solo NA, non le righe a zero', /Province con ritiri 1 1 regioni/.test(ritiri), (ritiri.match(/Province con ritiri.{0,40}/) || [''])[0]);
  const peso = disegna(dati, 'peso');
  verifica('anche nella tabella dei chili', /BA del contratto, nessun ritiro nell'anno/.test(peso) && /Totale raccolto 36,00 t/.test(peso), (peso.match(/Totale raccolto.{0,40}/) || [''])[0]);
  const senza = disegna(rotto && rotto.j, 'ritiri');
  verifica('se il contratto non si e\' letto la vista lo dice', new RegExp(`Il contratto del ${anno} non si è potuto leggere: le sue province senza ritiri qui non ci sono\\.`).test(senza), senza.slice(-400));
  verifica('e non lo dice quando il contratto c\'e\'', !/non si è potuto leggere/.test(ritiri));
  const sorgente = readFileSync(qui('../src/components/verifiche/MatriceProvince.jsx'), 'utf8').replace(/\r/g, '');
  verifica('anche il file Excel e il PDF dicono perche\' ci sono le righe a zero', /maiServite\.length \? ` · \$\{maiServite\.join\(', '\)\}: \$\{MAI_SERVITA\}` : ''/.test(sorgente));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
