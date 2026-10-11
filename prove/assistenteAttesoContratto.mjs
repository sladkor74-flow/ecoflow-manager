// Prova del RIEPILOGO DELLA COMMESSA DI ECOTYNA CONTRO LA DASHBOARD (chiusura
// dell'audit, 11/10/2026).
//
// Dashboard, Target & Status e alert contano l'atteso alla data sui giorni
// coperti dai dati (attesoAllaData, giornoDeiDati di attesoContratto.ts) e
// scelgono il contratto modificato per ultimo (commessaDellAnno). Il riepilogo
// che EcoTyna passa al modello (situazioneGestionale, base44/shared/assistente.ts)
// prendeva il primo contratto restituito e contava l'atteso sul giorno di
// calendario: con due contratti del 2026 e i dati fermi al 07/10, oggi l'11,
// diceva 11.000 t e 80,8% dove la Dashboard diceva 11.550 t e 79,7%.
// Qui la Dashboard vera (getDashboardRaccolta, impacchettata con un archivio
// finto che sa ordinare) e il riepilogo leggono gli stessi dati, e devono dire
// gli stessi numeri. npm run prove
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { situazioneGestionale } from '../base44/shared/assistente.ts';
import { quotaAttesa } from '../base44/shared/attesoContratto.ts';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// L'archivio finto ORDINA come la piattaforma ('-campo' decrescente, i vuoti in
// fondo): fin dove arrivano i dati si legge con una lettura breve e ordinata
// (datiFinoAl), e un archivio che non ordina la farebbe sembrare giusta per caso.
const SDK = `
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => v === null ? (r[k] === null || r[k] === undefined) : r[k] === v);
const ordina = (righe, o) => {
  if (!o || typeof o !== 'string') return righe;
  const campo = o.replace(/^[-+]/, ''); const giu = o.startsWith('-');
  const vuoto = (v) => v === null || v === undefined || v === '';
  return [...righe].sort((a, b) => {
    const x = a[campo], y = b[campo];
    if (vuoto(x) && vuoto(y)) return 0;
    if (vuoto(x)) return giu ? 1 : -1;
    if (vuoto(y)) return giu ? -1 : 1;
    return giu ? String(y).localeCompare(String(x)) : String(x).localeCompare(String(y));
  });
};
const ent = (nome) => ({
  list: async (o, l = 1e9, s = 0) => ordina(globalThis.__A[nome] || [], o).slice(s, s + l),
  filter: async (f, o, l = 1e9, s = 0) => {
    if (globalThis.__GUASTO && globalThis.__GUASTO(nome, o)) throw new Error('archivio non raggiungibile');
    return ordina((globalThis.__A[nome] || []).filter(r => soddisfa(r, f)), o).slice(s, s + l);
  },
});
const entities = new Proxy({}, { get: (_t, nome) => ent(String(nome)) });
export const sdk = { auth: { me: async () => ({ role: 'admin' }) }, asServiceRole: { entities }, entities, functions: { invoke: async () => { throw new Error('non disponibile'); } } };
export function createClientFromRequest() { return sdk; }`;
const plug = { name: 's', setup(b) { b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 's' })); b.onLoad({ filter: /.*/, namespace: 's' }, () => ({ contents: SDK, loader: 'js' })); } };
const modulo = async (opzioni) => import('data:text/javascript;base64,' + Buffer.from((await build({ ...opzioni, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent' })).outputFiles[0].text).toString('base64'));
const dashboard = await modulo({ entryPoints: [qui('../base44/functions/getDashboardRaccolta/entry.ts')], bundle: true, plugins: [plug] });
const { sdk } = await modulo({ stdin: { contents: SDK, loader: 'js' } });

const OGGI = '2026-10-11';
const PROFILO = [...Array(11).fill(1000), 571.64];
let n = 0;
const prim = (prov, kg, g) => ({ id: 'p' + String(++n).padStart(3, '0'), id_ordine: 'P' + n, stato: 'terminato', classe: 'P', prodotto: '.class1', provincia: prov, trasportatore: 'SMOCO S.R.L.', destinazione: 'IRIGOM SRL', tipo_destinazione: 'imp', peso_effettivo: kg, ordine_immesso_il: g + 'T08:00:00Z', trasporto_iniziato_il: g + 'T08:00:00Z', trasporto_finito_il: g + 'T10:00:00Z' });
const contratto = (id, t, creato, modificato) => ({ id, anno: 2026, target_annuo_t: t, target_mensile_json: JSON.stringify(PROFILO), regioni_json: JSON.stringify([{ regione: 'Campania', target_t: 5000 }, { regione: 'Puglia', target_t: t - 5000 }]), created_date: creato, updated_date: modificato });
// Il primo restituito e' il creato per ultimo (11.000 t); il modificato per
// ultimo, quello che vale, e' 11.550 t. I dati arrivano al 07/10: le fini
// trasporto sono in ordine sparso e sono piu' di cinque, perche' la lettura
// ordinata ne prende cinque.
const RETE = [
  prim('NA', 4000000, '2026-03-10'), prim('BA', 3000000, '2026-10-07'), prim('NA', 1000, '2026-05-02'),
  prim('BA', 1000, '2026-06-03'), prim('NA', 1000, '2026-07-04'), prim('BA', 1000, '2026-08-05'), prim('NA', 1000, '2026-09-06'),
];
const DUE_CONTRATTI = [contratto('c-b', 11000, '2026-02-01T10:00:00', '2026-02-01T10:00:00'), contratto('c-a', 11550, '2026-01-05T10:00:00', '2026-06-01T10:00:00')];
const prepara = (archivi, guasto = null) => { globalThis.__A = archivi; globalThis.__GUASTO = guasto; };
const righeContratto = (testo) => String(testo).split('\n').filter(r => /Contratto Ecotyre|^- (Campania|Puglia):|riparto|ripiego/.test(r));
const t1 = (v) => { const x = Math.round(v * 1000) / 1000; const [i, d] = Math.abs(x).toFixed(3).split('.'); return i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + (d.endsWith('0') ? d.slice(0, 2) : d); };
const p1 = (v) => (Math.round(v * 10) / 10).toLocaleString('it-IT');

console.log('IL CONTRATTO E L\'ATTESO ALLA DATA, COME LA DASHBOARD');
prepara({ PrimariaRete: RETE, CommessaEcotyre: DUE_CONTRATTI });
const d = await (await dashboard.default({ json: async () => ({ anno: [2026] }) })).json();
const testo = await situazioneGestionale(sdk, OGGI);
const righe = righeContratto(testo);
const testa = righe.find(r => r.startsWith('Contratto Ecotyre')) || '';
const pctEco = Number((/quota attesa a oggi ([\d.,]+)%/.exec(testa) || [])[1]?.replace('.', '').replace(',', '.'));
const tEco = Number((/target annuo ([\d.,]+) t/.exec(testa) || [])[1]?.replace(/\./g, '').replace(',', '.'));
verifica('la Dashboard conta al 07/10 col contratto modificato per ultimo', d.kpi.target === 11550 && d.kpi.atteso && d.kpi.atteso.giorno === '2026-10-07', JSON.stringify(d.kpi.atteso));
verifica('EcoTyna dice lo stesso target annuo della Dashboard (11.550 t, non il primo restituito)', tEco === d.kpi.target, testa);
verifica('e la stessa quota attesa, contata al giorno dei dati e non al calendario', Math.abs(pctEco - d.kpi.atteso.pct) < 0.05 && Math.abs(pctEco - quotaAttesa(DUE_CONTRATTI[1], 2026, '2026-10-07') * 100) < 0.05, `${pctEco} contro ${d.kpi.atteso.pct}`);
verifica('e dice fin dove arrivano i dati, all\'italiana', /fino al 07\/10\/2026/.test(testa), testa);
for (const reg of ['Campania', 'Puglia']) {
  const dash = (d.target_vs_raccolto || []).find(r => r.regione === reg) || {};
  const riga = righe.find(r => r.startsWith(`- ${reg}:`)) || '';
  verifica(`${reg}: contratto e atteso come nel grafico della Dashboard`, riga.includes(`contratto ${t1(dash.target)} t`) && riga.includes(`atteso a oggi ${t1(dash.atteso)} t`), `${riga} | Dashboard ${dash.target} ${dash.atteso}`);
}

console.log('L\'ORDINE IN CUI ARRIVANO I CONTRATTI NON CONTA');
prepara({ PrimariaRete: RETE, CommessaEcotyre: [...DUE_CONTRATTI].reverse() });
const testa2 = righeContratto(await situazioneGestionale(sdk, OGGI)).find(r => r.startsWith('Contratto Ecotyre')) || '';
verifica('al contrario, sempre 11.550 t e la stessa quota', testa2.includes('target annuo 11.550,00 t') && testa2.includes(`quota attesa a oggi ${p1(pctEco)}%`), testa2);

console.log('SENZA DATI L\'ATTESO NON SI INVENTA');
prepara({ PrimariaRete: [], CommessaEcotyre: DUE_CONTRATTI });
const vuoto = righeContratto(await situazioneGestionale(sdk, OGGI));
verifica('nessun ritiro terminato: la quota non si calcola e lo si dice', /quota attesa non calcolabile: nessun ritiro RETE terminato/.test(vuoto[0] || ''), vuoto[0]);
const regioniVuoto = vuoto.filter(r => r.startsWith('- '));
verifica('e l\'atteso per regione e\' n/d, non zero', regioniVuoto.length === 2 && regioniVuoto.every(r => /atteso a oggi n\/d/.test(r)), vuoto.join(' | '));
prepara({ PrimariaRete: RETE, CommessaEcotyre: DUE_CONTRATTI }, (nome, o) => nome === 'PrimariaRete' && o === '-trasporto_finito_il');
const guasto = await situazioneGestionale(sdk, OGGI);
verifica('una lettura non riuscita va fra i guasti in cima, e la quota non si dice', /LETTURE NON RIUSCITE: [^\n]*fin dove arrivano i dati della rete/.test(guasto) && /quota attesa non calcolabile: non si e' potuto leggere/.test(guasto), guasto.split('\n').slice(0, 4).join(' | '));
prepara({ PrimariaRete: [prim('NA', 1000, '2026-12-30'), ...RETE], CommessaEcotyre: DUE_CONTRATTI });
const futuro = righeContratto(await situazioneGestionale(sdk, OGGI)).find(r => r.startsWith('Contratto Ecotyre')) || '';
verifica('una fine trasporto nel futuro non copre i giorni dopo oggi', /fino al 11\/10\/2026/.test(futuro) && futuro.includes(`quota attesa a oggi ${p1(quotaAttesa(DUE_CONTRATTI[1], 2026, OGGI) * 100)}%`), futuro);

console.log('SENZA CONTRATTO');
prepara({ PrimariaRete: RETE, CommessaEcotyre: [] });
const senza = righeContratto(await situazioneGestionale(sdk, OGGI))[0] || '';
verifica('nel 2026 si dice che manca, e che la Dashboard mostra il ripiego come tale', /non inserito in Target & Status/.test(senza) && /ripiego il target di 11\.550,00 t/.test(senza) && !/quota attesa a oggi/.test(senza), senza);
prepara({ PrimariaRete: [], CommessaEcotyre: [] });
const senza27 = righeContratto(await situazioneGestionale(sdk, '2027-02-11'))[0] || '';
verifica('nel 2027 nessun ripiego: solo che manca', /non inserito in Target & Status\.$/.test(senza27), senza27);

console.log('IL SORGENTE');
const sorgente = readFileSync(qui('../base44/shared/assistente.ts'), 'utf8').replace(/\r/g, '').split('\n').filter(r => !r.trim().startsWith('//')).join('\n');
verifica('niente commesse[0] ne\' quota sul giorno di calendario', !/commesse\[0\]/.test(sorgente) && !/oggi\.slice\(8, 10\)/.test(sorgente) && /commessaDellAnno\(commesse, anno\)/.test(sorgente) && /attesoAllaData\(/.test(sorgente));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
