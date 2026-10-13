// LE PROVINCE DEL CONTRATTO NELLA MATRICE, ANCHE SENZA RITIRI (segnalazione alta
// del 20/09, corretta il 12/10/2026).
//
// La matrice delle province (computeProvinceMatrixData, primarieReteAnalytics.ts)
// nasceva solo dalle province con movimenti: una provincia del contratto mai
// servita non compariva, e non poteva avere «due mesi consecutivi a zero». Dal
// 10/10 a gennaio e febbraio si guardavano novembre e dicembre dell'anno prima;
// da marzo in poi quella provincia restava muta. Ora, con i contratti passati in
// opzioni.commesse, le province del contratto dell'anno entrano a zero.
// Le province si leggono dalla colonna «Province» del riparto per regione
// (provinceDelContratto). npm run prove
import { computeProvinceMatrixData, provinceDelContratto } from '../base44/shared/primarieReteAnalytics.ts';
import { oggiRoma } from '../base44/shared/giornoItaliano.ts';
import * as Q from '../base44/shared/quadroCommessa.ts';
import { build } from 'esbuild';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = JSON.stringify;

const anno = Number(oggiRoma().slice(0, 4));
// il riparto del contratto 2026 com'e' scritto nell'archivio (11/10/2026)
const REGIONI_2026 = '[{"regione":"Campania","province":"Tutte le provincie","target_t":4400},{"regione":"Puglia","province":"BA,BR,TA,LE","target_t":2500},{"regione":"Basilicata","province":"Tutte le provincie","target_t":500},{"regione":"Calabria","province":"Tutte le provincie","target_t":1650},{"regione":"Sicilia","province":"CT, SR, TP, AG, CL, EN, RG","target_t":2500}]';
const commessa = { id: 'c', anno, target_annuo_t: 11550, regioni_json: REGIONI_2026, updated_date: `${anno}-01-10T00:00:00Z` };

console.log('LE PROVINCE DEL CONTRATTO');
{
  const p = provinceDelContratto(commessa, anno);
  const sigle = p.map(x => x.provincia).sort();
  verifica('23 province: tutte quelle di Campania, Basilicata e Calabria, quattro della Puglia, sette della Sicilia', p.length === 23, J(sigle));
  verifica('«Tutte le provincie» non legge LE come Lecce in Campania', p.filter(x => x.regione === 'Campania').map(x => x.provincia).sort().join() === 'AV,BN,CE,NA,SA', J(p.filter(x => x.regione === 'Campania')));
  verifica('la Puglia del contratto e\' BA, BR, TA, LE: non FG ne\' BT', p.filter(x => x.regione === 'Puglia').map(x => x.provincia).sort().join() === 'BA,BR,LE,TA');
  verifica('la Sicilia e\' quella scritta, senza PA ne\' ME', p.filter(x => x.regione === 'Sicilia').length === 7 && !sigle.includes('PA') && !sigle.includes('ME'));
  verifica('senza contratto, il riparto di ripiego non inventa province', J(provinceDelContratto(null, 2026)) === '[]');
  const altro = { anno, regioni_json: [{ regione: 'molise', province: '', target_t: 10 }, { regione: 'Lazio', province: 'Roma e dintorni', target_t: 5 }] };
  const q = provinceDelContratto(altro, anno);
  verifica('colonna vuota: tutta la regione, col nome della regione', q.map(x => `${x.provincia} ${x.regione}`).join() === 'CB Molise,IS Molise', J(q));
  verifica('un testo senza sigle non da\' province', !q.some(x => x.regione === 'Lazio'));
}

const mov = (id, giorno, provincia = 'NA') => ({ id, id_ordine: id, stato: 'terminato', provincia, regione: 'Campania', numero_fir: 'F' + id, peso_effettivo: 3000,
  ordine_immesso_il: `${giorno}T08:00:00Z`, trasporto_iniziato_il: `${giorno}T00:00:00Z`, trasporto_finito_il: `${giorno}T00:00:00Z` });
const daGennaioASettembre = ['01', '02', '03', '04', '05', '06', '07', '08', '09'].map(m => mov('ET' + m, `${anno}-${m}-10`));

console.log('LA MATRICE');
{
  const m = computeProvinceMatrixData(daGennaioASettembre, 9, { commesse: [commessa] });
  const ba = m.province.find(p => p.provincia === 'BA');
  verifica('BA, del contratto e mai servita, ha la sua riga a zero', !!ba && ba.totale === 0 && ba.regione === 'Puglia' && ba.del_contratto && ba.senza_ritiri, J(ba));
  verifica('e a ottobre e\' fra le province con due mesi a zero', m.province_with_zeros.some(p => p.provincia === 'BA' && p.last_zero_pair && p.last_zero_pair.end === 'Settembre'), J(m.province_with_zeros.map(p => [p.provincia, p.last_zero_pair])));
  verifica('tutte e 23 le province del contratto sono nella matrice', m.province.filter(p => p.del_contratto).length === 23, String(m.province.filter(p => p.del_contratto).length));
  verifica('NA, che lavora, non e\' segnalata', !m.province_with_zeros.some(p => p.provincia === 'NA'));
  verifica('le province stanno con la loro regione', (m.by_regione.Puglia || []).some(p => p.provincia === 'BA'));
  verifica('una provincia fuori contratto con ritiri resta (e non e\' del contratto)', (() => {
    const x = computeProvinceMatrixData([...daGennaioASettembre, mov('FG1', `${anno}-09-05`, 'FG')], 9, { commesse: [commessa] }).province.find(p => p.provincia === 'FG');
    return !!x && x.totale === 1 && !x.del_contratto;
  })());
}
{
  // senza contratti la matrice e' quella dei movimenti, come prima
  const m = computeProvinceMatrixData(daGennaioASettembre, 9);
  verifica('senza opzioni.commesse: solo le province con movimenti', J(m.province.map(p => p.provincia)) === J(['NA']), J(m.province.map(p => p.provincia)));
  // un contratto di un altro anno non vale per questo
  const m2 = computeProvinceMatrixData(daGennaioASettembre, 9, { commesse: [{ ...commessa, anno: anno - 1 }] });
  verifica('il contratto dell\'anno prima non mette province in questo', J(m2.province.map(p => p.provincia)) === J(['NA']), J(m2.province.map(p => p.provincia)));
}
{
  // all'inizio dell'anno contano solo i mesi finiti: una provincia nuova del
  // contratto non si segnala a gennaio ne' a febbraio, si' a marzo
  const quando = (mi) => computeProvinceMatrixData([], mi, { commesse: [commessa] }).province_with_zeros.some(p => p.provincia === 'BA');
  verifica('gennaio e febbraio: nessun mese finito basta, BA non e\' segnalata', !quando(0) && !quando(1));
  verifica('marzo: gennaio e febbraio a zero, BA e\' segnalata', quando(2));
  // una provincia del contratto che l'anno prima lavorava fino a ottobre: a
  // gennaio novembre e dicembre a zero la segnalano gia' (la coppia a cavallo d'anno)
  const g = computeProvinceMatrixData([mov('X1', `${anno - 1}-10-10`, 'BA')], 0, { commesse: [commessa] });
  const ba = g.province_with_zeros.find(p => p.provincia === 'BA');
  verifica('a gennaio la coppia novembre-dicembre dell\'anno prima vale anche per lei', !!ba && ba.last_zero_pair && /Dicembre/.test(ba.last_zero_pair.end), J(ba && ba.last_zero_pair));
}

// SUL SITO (revisione del 13/10/2026). Il 12/10 la regola stava solo nella
// libreria: la funzione della pagina Terminati Rete chiamava la matrice senza i
// contratti, e con ritiri solo a NA restituiva la sola NA. Ora la funzione legge
// anche CommessaEcotyre (una lettura, insieme ai ritiri); il riquadro «Province
// ferme» della dashboard dice «mai servita» e la tabella segna la riga.
console.log('SUL SITO: LA FUNZIONE DI TERMINATI RETE');
{
  const { caricaFunzione, chiama } = await import('./dati/bancoFunzioni.mjs');
  const f = await caricaFunzione('computeProvinceMatrix');
  const { stato, j } = await chiama(f, { db: { PrimariaRete: daGennaioASettembre, CommessaEcotyre: [commessa] } });
  const ba = (j.province || []).find(p => p.provincia === 'BA');
  verifica('la funzione vera mette BA, del contratto e mai servita, nella matrice', stato === 200 && !!ba && ba.del_contratto && ba.senza_ritiri && ba.totale === 0, J((j.province || []).map(p => p.provincia)));
  verifica('con tutte e 23 le province del contratto, e dice di aver letto il contratto', (j.province || []).filter(p => p.del_contratto).length === 23 && j.contratto_letto === true, J([(j.province || []).length, j.contratto_letto]));
  // l'archivio dei contratti che non si legge (un oggetto al posto dell'elenco)
  const rotto = await chiama(f, { db: { PrimariaRete: daGennaioASettembre, CommessaEcotyre: {} } });
  verifica('se il contratto non si legge la pagina resta su: la matrice dei movimenti e contratto_letto false', rotto.stato === 200 && J((rotto.j.province || []).map(p => p.provincia)) === J(['NA']) && rotto.j.contratto_letto === false, J([rotto.stato, rotto.j.error, rotto.j.contratto_letto]));
  const sorgente = readFileSync(new URL('../base44/functions/computeProvinceMatrix/entry.ts', import.meta.url), 'utf8').replace(/\r/g, '');
  verifica('i contratti si leggono una volta, insieme ai ritiri', (sorgente.match(/fetchAll\(/g) || []).length === 2 && /Promise\.all\(\[/.test(sorgente) && /computeProvinceMatrixData\(records, null, commesse \? \{ commesse \} : \{\}\)/.test(sorgente));
}

console.log('SUL SITO: IL RIQUADRO DELLA DASHBOARD E LA TABELLA');
{
  // Le due viste vere, impacchettate con React lato server (come
  // prove/dashboardPagina.mjs): il riquadro con una provincia mai servita, la
  // tabella con la riga a zero e la nota quando il contratto non si legge.
  const ESTENSIONI = ['', '.js', '.jsx', '.ts'];
  const daAlias = (p) => { const b = qui('../src/' + p.slice(2)); return ESTENSIONI.map(e => b + e).find(x => existsSync(x) && /\.\w+$/.test(x)) || b; };
  const INGRESSO = `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import { MemoryRouter } from 'react-router-dom';
import SezioneRete from ${J(qui('../src/components/dashboard/SezioneRete.jsx'))};
import ProvinceMatrix from ${J(qui('../src/components/primarie-rete/ProvinceMatrix.jsx'))};
const C = { SezioneRete, ProvinceMatrix };
export const disegna = (nome, props) => renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(C[nome], props)));
`;
  const CLIENT_FINTO = 'export const base44 = { functions: { invoke: async () => ({ data: {} }) } };';
  let L = null;
  try {
    const pacchetto = await build({
      stdin: { contents: INGRESSO, resolveDir: qui('.'), loader: 'js' },
      bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent',
      loader: { '.jsx': 'jsx', '.js': 'jsx' },
      define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [{ name: 'finti', setup(b) {
        b.onResolve({ filter: /^@\/api\/base44Client$/ }, () => ({ path: 'client', namespace: 'client-finto' }));
        b.onResolve({ filter: /^@\/lib\/AuthContext$/ }, () => ({ path: 'auth', namespace: 'client-finto' }));
        b.onLoad({ filter: /.*/, namespace: 'client-finto' }, (a) => ({ contents: a.path === 'auth' ? 'export const useAuth = () => ({ user: null });' : CLIENT_FINTO, loader: 'js' }));
        b.onResolve({ filter: /^@\// }, (args) => ({ path: daAlias(args.path) }));
      } }],
    });
    if (typeof globalThis.window === 'undefined') globalThis.window = { self: 1, top: 1, matchMedia: () => ({ matches: false, addListener() {}, removeListener() {} }) };
    L = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
  } catch (e) { verifica('le due viste si impacchettano', false, String(e && e.message).slice(0, 300)); }
  const testo = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
  const disegna = (nome, props) => { try { return L ? testo(L.disegna(nome, props)) : ''; } catch (e) { verifica(`${nome} si disegna`, false, String(e && e.message).slice(0, 300)); return ''; } };

  // il quadro della rete del 2026 con il contratto vero: ritiri solo a NA
  const T = (g) => `${g}T10:00:00Z`;
  const righe = [{ id: 'q1', id_ordine: 'Q1', stato: 'terminato', provincia: 'NA', trasportatore: 'SMOCO SRL', peso_effettivo: 10000, ordine_immesso_il: T('2026-09-20'), trasporto_iniziato_il: T('2026-09-20'), trasporto_finito_il: T('2026-09-20') }];
  const contratto26 = { ...commessa, anno: 2026 };
  const kpi = { raccolto_rete_anno: 10, raccolto_aci_anno: 0, raccolto_extra_anno: 0, previsione_aci: 0, target: 11550, raggiungimento_pct: 0.09, atteso: null, target_ripiego: [], target_da_confermare: [] };
  const quadro = Q.quadroCommessa({ anno: 2026, oggi: '2026-10-11', giornoDati: '2026-10-08', commessa: contratto26, kpi, fonteTarget: 'contratto', rete: righe, reteAnno: righe, aciAnno: [], extraAnno: [], targetVsRaccolto: [], conRiparto: false, raccoltoPerRegione: {}, mensili: [], annui: [], senzaFine: 0 });
  const riquadro = (disegna('SezioneRete', { quadro, arretrato: null, annoInCorso: true }).match(/Province ferme.*?Terminati Rete/) || [''])[0];
  verifica('il riquadro dice «BA (Puglia), del contratto, mai servita nel 2026»', riquadro.includes('BA (Puglia), del contratto, mai servita nel 2026'), riquadro);
  verifica('e non scrive un ultimo ritiro vuoto', !/l'ultimo ritiro il\s*(,|$|e altre)/.test(riquadro) && !/l'ultimo ritiro il —/.test(riquadro), riquadro);

  const matrice = computeProvinceMatrixData(daGennaioASettembre, 9, { commesse: [commessa] });
  const tabella = disegna('ProvinceMatrix', { data: { ...matrice, contratto_letto: true } });
  verifica('la tabella segna la riga di BA: «del contratto, nessun ritiro nell\'anno»', /BA del contratto, nessun ritiro nell'anno/.test(tabella), tabella.slice(0, 400));
  verifica('NA, che ha ritiri, non ha il segno', !/NA del contratto, nessun ritiro/.test(tabella));
  const senza = disegna('ProvinceMatrix', { data: { ...computeProvinceMatrixData(daGennaioASettembre, 9), contratto_letto: false } });
  verifica('se il contratto non si e\' letto la tabella lo dice', /Il contratto dell'anno non si è potuto leggere/.test(senza), senza.slice(0, 300));
  const mo = readFileSync(new URL('../src/components/primarie-rete/ProvinceMatrix.jsx', import.meta.url), 'utf8');
  verifica('il mese in corso resta senza colore (la regola del 10/10)', mo.includes('mv.count === 0 && mv.passed && mv.mese !== current_month'));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
