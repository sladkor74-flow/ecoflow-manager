// IL SURPLUS E I FILE DELL'ATTIVA (il surplus sulle tariffe, 13/10/2026).
//
// Il documento del mese salva la riga del surplus (il Fuel Surcharge del
// consorzio) fra le sue voci, e la pagina delle esportazioni
// (src/components/fatturazione/AttivaEsportazioni.jsx) passa le voci del
// documento ai quattro file: il report dell'attiva in Excel e in PDF
// (fatturazioneExport.js) e il format dell'amministrazione in Excel e in PDF
// (formatAmministrazioneExport.js). Come mettere il surplus in quei file lo
// decide l'amministrazione (domanda D3 del progetto del surplus): fino ad allora
// escono come prima, con le sole righe dei formulari. Senza filtro la riga
// usciva come «Trasp.+Tratt.» con 0 kg e il TOTALE cambiava.
//
// Qui la pagina gira davvero, coi suoi pulsanti (React finto che tiene lo stato
// fra un disegno e l'altro, client finto, i quattro file sostituiti da
// registratori), e si guarda:
//   1. che ai file arrivino le sole righe dei formulari, con ogni pulsante;
//   2. che l'esito dell'esportazione dica che il surplus si fattura con la sua
//      riga a parte, e quanto; senza surplus l'esito e' quello di prima;
//   3. che la pagina lo dica gia' prima di esportare, canale per canale, e che
//      senza surplus non dica niente;
//   4. che due record dello stesso surplus (un importo cambiato a meta' mese) si
//      dicano una volta, col totale.
// La prova prima/dopo di prove/attivaReportSurplus.mjs (parte 7) guarda le
// stesse righe sui dati veri; questa guarda le parole a video.
//
// node prove/attivaEsportazioniSurplus.mjs
// ESPORTAZIONI=<file> prova un'altra versione della pagina (la controprova).
import { build } from 'esbuild';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { calcolaRigheAttiva, eRigaSurplus } from '../base44/shared/attivaCalcolo.ts';
import { nomiImportati } from './dati/paginaFinta.mjs';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// ─── la pagina, eseguita ───
// React piccolo: esegue la pagina e i suoi hook, non i figli. Lo stato resta fra
// un disegno e l'altro, cosi' dopo un clic si legge l'esito a video.
const REACT = `
let st = { valori: {}, indice: 0 };
export function useState(iniziale) {
  const i = st.indice++;
  if (!(i in st.valori)) st.valori[i] = typeof iniziale === 'function' ? iniziale() : iniziale;
  const s = st;
  return [s.valori[i], (v) => { s.valori[i] = typeof v === 'function' ? v(s.valori[i]) : v; }];
}
export const useEffect = () => {};
export const useMemo = (f) => f();
export const useCallback = (f) => f;
export const useRef = (v) => ({ current: v });
export const Fragment = 'Fragment';
export function createElement(type, props, ...figli) { return { type, props: { ...(props || {}), children: figli.length === 1 ? figli[0] : figli } }; }
export function jsx(type, props, key) { return { type, props: key === undefined ? { ...(props || {}) } : { ...(props || {}), key } }; }
export const jsxs = jsx;
export function rendi(C, props) { st.indice = 0; return C(props); }
export function azzera() { st = { valori: {}, indice: 0 }; }
export default { useState, useEffect, useMemo, useCallback, useRef, Fragment, createElement };
`;
const registratore = (voci) => `const r = (formato) => async (tipologia, righe) => { globalThis.__AI_FILE.push({ formato, tipologia, righe }); };\n${voci}`;
const MODULI = {
  '@/lib/fatturazioneExport': registratore("export const exportFatturazioneAttiva = r('excel');\nexport const exportFatturazioneAttivaPdf = r('pdf');\nexport const nomeFileAttiva = (t, a, m, e) => `attiva ${t}.${e}`;"),
  '@/lib/formatAmministrazioneExport': registratore("export const exportAmministrazioneAttiva = r('amm-excel');\nexport const exportAmministrazioneAttivaPdf = r('amm-pdf');"),
  '@/lib/formatAmministrazione': 'export const nomeFileAmministrazione = (t, a, m, e) => `amministrazione ${t}.${e}`;',
};
const CLIENT = 'export const base44 = { functions: { invoke: async () => ({ data: {} }) }, entities: new Proxy({}, { get: () => ({ list: async () => [], filter: async () => [] }) }), auth: { me: async () => ({}) } };';
const ESTENSIONI = ['', '.js', '.jsx', '.ts'];
const daAlias = (p) => { const base = qui('../src/' + p.slice(2)); return ESTENSIONI.map(e => base + e).find(f => existsSync(f) && /\.\w+$/.test(f)) || base; };

const elementiDi = (x, out = []) => {
  if (Array.isArray(x)) { x.forEach(y => elementiDi(y, out)); return out; }
  if (x && typeof x === 'object' && x.props) { out.push(x); elementiDi(x.props.children, out); }
  return out;
};
const testoDi = (x) => (Array.isArray(x) ? x.map(testoDi).join('') : typeof x === 'string' || typeof x === 'number' ? String(x) : x && x.props ? testoDi(x.props.children) : '');

const filePagina = process.env.ESPORTAZIONI || qui('../src/components/fatturazione/AttivaEsportazioni.jsx');
let M = null;
try {
  const pacchetto = await build({
    stdin: { contents: `export { default as Pagina } from ${JSON.stringify(filePagina)};\nexport { rendi, azzera } from 'react';\n`, resolveDir: qui('.'), loader: 'js' },
    bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent',
    loader: { '.jsx': 'jsx', '.js': 'jsx' }, define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'esportazioni', setup(b) {
      b.onResolve({ filter: /^react(\/jsx-runtime|\/jsx-dev-runtime)?$/ }, () => ({ path: 'react', namespace: 'piccolo' }));
      b.onResolve({ filter: /^@\/api\/base44Client$/ }, () => ({ path: 'client', namespace: 'piccolo' }));
      b.onResolve({ filter: /^@\/lib\/(fatturazioneExport|formatAmministrazioneExport|formatAmministrazione)$/ }, (a) => ({ path: a.path, namespace: 'piccolo' }));
      b.onResolve({ filter: /^(@\/components\/|lucide-react$)/ }, (a) => ({ path: `${a.path}|${a.importer}`, namespace: 'finto', pluginData: a }));
      b.onResolve({ filter: /^@\// }, (a) => ({ path: daAlias(a.path) }));
      b.onLoad({ filter: /.*/, namespace: 'piccolo' }, (a) => ({ contents: a.path === 'react' ? REACT : a.path === 'client' ? CLIENT : MODULI[a.path], loader: 'js' }));
      b.onLoad({ filter: /.*/, namespace: 'finto' }, (a) => {
        const { nomi } = nomiImportati(readFileSync(a.pluginData.importer, 'utf8'), a.pluginData.path);
        return { contents: `const F = () => null;\nexport default F;\n${nomi.map(n => `export const ${n} = F;`).join('\n')}`, loader: 'js' };
      });
    } }],
  });
  M = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
} catch (e) {
  verifica('la pagina delle esportazioni si carica', false, String(e && e.message).slice(0, 300));
}

globalThis.window = { ...(globalThis.window || {}), confirm: () => true };
const PERIODO = { anno: 2026, mese: 'Ottobre' };
/** Monta la pagina coi dati, preme i pulsanti [canale, testo] o quelli in fondo, e restituisce cosa e' arrivato ai file e cosa dice la pagina. */
async function usa(data, premi = []) {
  if (!M) return { prima: '', dopo: '', file: [], errore: 'pagina non caricata' };
  M.azzera();
  const props = { periodo: PERIODO, data, onReload: async () => {}, onVaiPrefattura: () => {} };
  const prima = M.rendi(M.Pagina, props);
  globalThis.__AI_FILE = [];
  let errore = null;
  for (const [canale, pulsante] of premi) {
    const albero = M.rendi(M.Pagina, props);
    const dove = canale ? elementiDi(albero).find(el => el.props.key === canale) : albero;
    const bottone = dove && elementiDi(dove).find(el => typeof el.props.onClick === 'function' && testoDi(el).trim() === pulsante);
    if (!bottone) { errore = `pulsante ${canale || ''} «${pulsante}» non trovato`; continue; }
    try { await bottone.props.onClick(); } catch (e) { errore = e.message; }
  }
  const dopo = M.rendi(M.Pagina, props);
  // le frasi una per una: ogni esito sta nel suo <span>
  const frasi = elementiDi(dopo).filter(el => el.type === 'span').map(el => testoDi(el).replace(/\s+/g, ' ').trim());
  return { prima: testoDi(prima).replace(/\s+/g, ' '), dopo: testoDi(dopo).replace(/\s+/g, ' '), frasi, file: globalThis.__AI_FILE, errore };
}

// ─── i dati: ottobre, due formulari sulla rete col Fuel Surcharge ───
const tariffe = [{ id: 't-rete', direzione: 'ATTIVA', tipologia: 'RETE', cliente: 'ECOTYRE', valore: 202, unita_misura: '€/t', stato: 'attivo' }];
const mov = (n, kg, giorno) => ({ id: 'r' + n, id_ordine: 'ET2600000' + n, numero_fir: 'F' + n, stato: 'terminato', cer: '160103', classe: '.class1', provincia: 'NA', trasportatore: 'ALFA SRL', destinazione: 'IRIGOM SRL', peso_effettivo: kg, trasporto_finito_il: `2026-10-${giorno}T08:00:00.000Z` });
const fs = (altro = {}) => ({ id: 'fs', gruppo: 'g', nome: 'Fuel Surcharge', origine: 'CONSORZIO', tipologia: 'RETE', prestazione: 'RACCOLTA', a_chi: 'tutti', euro_t_passiva: 5, euro_t_attiva: 5, data_inizio_validita: '2026-10-01', data_fine_validita: '2026-12-31', stato: 'attivo', ...altro });
const voci = (surplus) => calcolaRigheAttiva({ reteAll: [mov(1, 1000, '10'), mov(2, 2000, '20')], aciAll: [], extraAll: [], fornitori: [], tariffe, anno: 2026, mese: 'Ottobre', surplus }).righe.RETE.map(r => ({ ...r, documento_id: 'd-rete' }));
// l'ACI senza surplus: una riga gia' fatta basta, la pagina non la guarda dentro
const ACI = [{ id: 'a1', id_ordine: 'ET26000009', numero_fir: 'FA', tipologia: 'ACI', quantita: 500, totale: 115, documento_id: 'd-aci' }];
const dati = (rete) => ({
  RETE: { righe: rete, documento: { id: 'd-rete' } },
  ACI: { righe: ACI, documento: { id: 'd-aci' } },
  EXTRA_RACCOLTA: { righe: [], documento: null },
});
const CON = voci([fs()]);
const SENZA = voci([]);
// un importo cambiato a meta' mese: 5 €/t fino al 15/10 e 7 dal 16/10, due record
const DUE = voci([fs({ id: 'fs-a', data_fine_validita: '2026-10-15' }), fs({ id: 'fs-b', euro_t_attiva: 7, euro_t_passiva: 7, data_inizio_validita: '2026-10-16' })]);

verifica('i dati: col Fuel Surcharge il documento della rete ha due formulari e la riga del surplus (15,00 €)',
  CON.length === 3 && CON.filter(eRigaSurplus).length === 1 && CON.find(eRigaSurplus).totale === 15, JSON.stringify(CON.map(r => [r.origine_dato, r.totale])));
verifica('...senza surplus i soli due formulari, e con due importi due righe (5,00 € e 14,00 €)',
  SENZA.length === 2 && !SENZA.some(eRigaSurplus) && DUE.filter(eRigaSurplus).map(r => r.totale).sort((a, b) => a - b).join() === '5,14', JSON.stringify(DUE.filter(eRigaSurplus).map(r => r.totale)));

console.log('1. AI FILE ARRIVANO LE SOLE RIGHE DEI FORMULARI');
for (const pulsante of ['Excel', 'PDF', 'Format amm.', 'Format amm. PDF']) {
  const u = await usa(dati(CON), [['RETE', pulsante]]);
  const f = u.file[0];
  verifica(`rete, «${pulsante}»: al file arrivano i due formulari, senza la riga del surplus`,
    !u.errore && u.file.length === 1 && f.righe.length === 2 && !f.righe.some(eRigaSurplus), u.errore || JSON.stringify(u.file.map(x => [x.formato, x.righe.length])));
}
{
  const u = await usa(dati(CON), [[null, 'Tutti e tre in Excel']]);
  verifica('«Tutti e tre in Excel»: la rete coi due formulari, l\'ACI con la sua riga, l\'extra raccolta senza file',
    !u.errore && u.file.length === 2 && u.file[0].tipologia === 'RETE' && u.file[0].righe.length === 2 && u.file[1].tipologia === 'ACI' && u.file[1].righe.length === 1, u.errore || JSON.stringify(u.file.map(x => [x.tipologia, x.righe.length])));
}
{
  const u = await usa(dati(SENZA), [['RETE', 'Excel']]);
  verifica('senza surplus al file arrivano tutte le righe, come prima', !u.errore && u.file.length === 1 && u.file[0].righe.length === 2, u.errore || '');
}

console.log('2. L\'ESITO DICE CHE IL SURPLUS SI FATTURA A PARTE');
{
  const u = await usa(dati(CON), [['RETE', 'Excel']]);
  verifica('dopo l\'Excel della rete: «Il file ha le sole righe dei formulari: Fuel Surcharge € 15,00 si fattura con la sua riga a parte.»',
    u.dopo.includes('attiva RETE.xlsx scaricato e registrato nello storico. Il file ha le sole righe dei formulari: Fuel Surcharge € 15,00 si fattura con la sua riga a parte.'), u.dopo.slice(u.dopo.indexOf('attiva RETE'), u.dopo.indexOf('attiva RETE') + 200));
  const t = await usa(dati(CON), [[null, 'Tutti e tre in Excel']]);
  verifica('con tutti e tre: la frase sulla rete e non sull\'ACI, che non ha surplus',
    t.frasi.includes('attiva RETE.xlsx scaricato e registrato nello storico. Il file ha le sole righe dei formulari: Fuel Surcharge € 15,00 si fattura con la sua riga a parte.')
      && t.frasi.includes('attiva ACI.xlsx scaricato e registrato nello storico.') && t.frasi.includes('Extra Raccolta: nessuna riga da esportare.'),
    JSON.stringify(t.frasi.filter(x => /^(attiva|Extra)/.test(x))));
}
{
  const u = await usa(dati(SENZA), [['RETE', 'Excel']]);
  verifica('senza surplus l\'esito e\' quello di prima, senza la frase', u.dopo.includes('attiva RETE.xlsx scaricato e registrato nello storico.') && !u.dopo.includes('sole righe dei formulari'), u.dopo.slice(u.dopo.indexOf('attiva RETE'), u.dopo.indexOf('attiva RETE') + 200));
}

console.log('3. LA PAGINA LO DICE PRIMA DI ESPORTARE');
{
  const u = await usa(dati(CON));
  verifica('col surplus, sopra i pulsanti: «I file hanno le sole righe dei formulari, come prima: il surplus si fattura con la sua riga a parte.» e l\'importo del canale',
    u.prima.includes('Surplus') && u.prima.includes('I file hanno le sole righe dei formulari, come prima: il surplus si fattura con la sua riga a parte.') && u.prima.includes('Rete: Fuel Surcharge € 15,00') && !u.prima.includes('ACI: Fuel'),
    u.prima.slice(0, 400));
  const s = await usa(dati(SENZA));
  verifica('...e senza surplus la pagina di prima, senza la fascia', !s.prima.includes('sole righe dei formulari') && !s.prima.includes('Fuel Surcharge'), s.prima.slice(0, 300));
}

console.log('4. DUE RECORD DELLO STESSO SURPLUS SI DICONO UNA VOLTA');
{
  const u = await usa(dati(DUE), [['RETE', 'PDF']]);
  verifica('due importi a meta\' mese: ai file i due formulari, e la frase dice «Fuel Surcharge € 19,00» una volta',
    u.file.length === 1 && u.file[0].righe.length === 2 && u.dopo.includes('Il file ha le sole righe dei formulari: Fuel Surcharge € 19,00 si fattura con la sua riga a parte.') && u.prima.includes('Rete: Fuel Surcharge € 19,00'),
    `${JSON.stringify(u.file.map(x => x.righe.length))} ${u.dopo.slice(u.dopo.indexOf('attiva RETE'), u.dopo.indexOf('attiva RETE') + 200)}`);
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
