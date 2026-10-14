// L'ELENCO «DA DICHIARARE» APERTO DALLO STOCCAGGIO DI T-CYCLE DICE «PER NOI
// CHIUSI» ANCHE SUL SITO (chiusura del giro del 14/10/2026, sulle decisioni
// dell'utente del 13/10/2026).
//
// Il file degli ordini non dichiarati attribuisce ancora allo stoccaggio di
// T-Cycle 181,299 t partite tutte verso Tecnogum, che sulla rete non dichiara a
// SMOCO: per noi un giro chiuso. Il gruppo E-1 ha insegnato all'elenco
// (DaDichiarareTable, attesaTuttaChiusa) a intestarsi «Per noi chiusi» quando
// riceve le righe delle Giacenze (prop righeGiacenze), ma la pagina delle
// Giacenze quella prop non la passava: la scritta non compariva mai, e
// l'elenco continuava a dire che quei carichi «li dichiara lui».
// Qui gira la pagina vera (prove/dati/paginaFinta.mjs), con una copia del
// sorgente in cui solo l'autenticazione e' sostituita, e poi l'elenco vero coi
// props che la pagina gli da':
// 1. su righe costruite: sull'anno in corso la pagina passa le sue righe e
//    l'elenco aperto dal pulsante di T-Cycle dice «Per noi chiusi»; Nappi Sud,
//    che manda anche a chi dichiara, resta com'era; su un altro anno la pagina
//    non le passa (l'elenco e' il file di oggi, l'attesa della riga e' di
//    quell'anno) e l'elenco e' quello di prima; nessuna lettura in piu';
// 2. sui dati veri (../dati-veri/, se c'e'): calcolaGiacenze vera sul 2026,
//    T-Cycle 181,299 t per noi chiuse, attraverso la pagina fino all'elenco.
// npm run prove
import { build } from 'esbuild';
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { caricaPagina, clienteFinto, aspetta, trova, testo } from './dati/paginaFinta.mjs';
import { percheAttesaChiusa } from '../base44/shared/giacenzaPortale.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
const qui = (p) => fileURLToPath(new URL(p, import.meta.url));

// La pagina delle Giacenze, con l'autenticazione sostituita: il contesto la
// pagina finta non ce l'ha. L'amministratore, che vede tutto.
const IMPORT_AUTH = "import { useAuth } from '@/lib/AuthContext';";
const sorgente = readFileSync(qui('../src/pages/Giacenze.jsx'), 'utf8').replace(/\r/g, '');
verifica('premessa: la pagina prende chi e\' collegato da useAuth, come la copia si aspetta', sorgente.includes(IMPORT_AUTH));
const copia = join(mkdtempSync(join(tmpdir(), 'per-noi-chiusi-')), 'Giacenze.jsx');
writeFileSync(copia, sorgente.replace(IMPORT_AUTH, "const useAuth = () => ({ user: { role: 'admin' } });"));
const pagina = await caricaPagina('pages/Giacenze', { file: copia });
const tabella = await caricaPagina('components/giacenze/DaDichiarareTable');

/**
 * La pagina con quella risposta di calcolaGiacenze: i props dell'elenco
 * sull'anno di oggi, dopo il pulsante di uno stoccaggio, e su un altro anno.
 */
const dallaPagina = async (risposta, sito) => {
  const c = clienteFinto({ funzioni: { calcolaGiacenze: async () => risposta } });
  globalThis.__CLIENTE_FINTO = c.cliente;
  const m = pagina.monta(pagina.Componente, {});
  await aspetta(40);
  const elenco = () => trova(m.albero, 'DaDichiarareTable')[0] || null;
  const fuori = { errori: [], chiamate: [] };
  const annoOggi = (c.funzioniChiamate('calcolaGiacenze')[0] || { payload: {} }).payload.anno;
  fuori.annoOggi = annoOggi;
  fuori.oggi = elenco() && { ...elenco().props };
  // Il pulsante dello stoccaggio nella scheda Situazione.
  const situazione = trova(m.albero, 'SituazioneTable')[0];
  if (situazione && situazione.props.onVaiDaDichiarare) situazione.props.onVaiDaDichiarare(sito, 'stoc');
  await aspetta(20);
  fuori.dalPulsante = elenco() && { ...elenco().props };
  fuori.chiamate.push(...c.funzioniChiamate().map(x => `${x.nome} ${J(x.payload)}`));
  // Un altro anno, dal menu dell'anno.
  const menu = trova(m.albero, el => el.props && typeof el.props.onValueChange === 'function' && el.props.value === String(annoOggi))[0];
  if (menu) menu.props.onValueChange(String(Number(annoOggi) - 1));
  await aspetta(40);
  fuori.altroAnno = elenco() && { ...elenco().props };
  fuori.chiamateDopo = c.funzioniChiamate().map(x => `${x.nome} ${J(x.payload)}`);
  fuori.errori = m.errori.map(String);
  m.smonta();
  return fuori;
};

/** L'elenco vero, coi props che gli ha dato la pagina. */
const apriElenco = async (props) => {
  const c = clienteFinto({ funzioni: { getOrdiniDaDichiarare: async () => ({ righe: [], totale_righe: 2, totale_kg: 20000, per_mese: [], siti_distinti: [], province_distinte: [], anni_distinti: [] }) } });
  globalThis.__CLIENTE_FINTO = c.cliente;
  const m = tabella.monta(tabella.Componente, props);
  await aspetta(20);
  const fuori = { testo: testo(m.albero).replace(/\s+/g, ' '), chiamate: c.funzioniChiamate().length, errori: m.errori.map(String) };
  m.smonta();
  return fuori;
};

const TCY = 'T-CYCLE INDUSTRIES SRL', NAP = 'NAPPI SUD SRL', TEC = 'TECNOGUM SRL';
const CHIUSI = 'Per noi chiusi: TECNOGUM SRL sulla rete non dichiara a SMOCO.';

console.log('1. SU RIGHE COSTRUITE');
{
  const righe = [
    { sito: 'IRIGOM SRL', tipo_destinazione: 'imp', giacenza_portale_t: 652.84, giacenza_rete_t: 652.84, giacenza_aci_t: 0, giacenza_extra_t: 0 },
    { sito: TCY, tipo_destinazione: 'stoc', giacenza_portale_t: 0, giacenza_aci_t: 0, in_attesa_dichiarazione_t: 181.299, ordini_da_dichiarare: 72, in_attesa_chiusa_t: 181.299, in_attesa_chiusa_perche: percheAttesaChiusa([TEC]) },
    { sito: NAP, tipo_destinazione: 'stoc', giacenza_portale_t: 25.88, giacenza_aci_t: 0, in_attesa_dichiarazione_t: 860.099, ordini_da_dichiarare: 397 },
  ];
  const risposta = { righe, totali: { giacenza_portale_t: 678.72, giacenza_aci_t: 0, giacenza_extra_t: 0, in_attesa_dichiarazione_t: 1041.398, in_attesa_chiusa_t: 181.299 }, anomalie: [] };
  const p = await dallaPagina(risposta, TCY);
  verifica('la pagina gira, e l\'elenco e\' nella scheda Da dichiarare', !p.errori.length && p.oggi && p.dalPulsante && p.altroAnno, J(p.errori));
  verifica('sull\'anno in corso la pagina passa all\'elenco le righe che ha gia\'', p.oggi && J(p.oggi.righeGiacenze) === J(righe), J(p.oggi && p.oggi.righeGiacenze));
  verifica('dal pulsante di T-Cycle: il sito, il ruolo e le righe', p.dalPulsante && p.dalPulsante.filtroSitoEsterno === TCY && p.dalPulsante.filtroRuoloEsterno === 'stoc' && J(p.dalPulsante.righeGiacenze) === J(righe),
    J(p.dalPulsante && [p.dalPulsante.filtroSitoEsterno, p.dalPulsante.filtroRuoloEsterno, !!p.dalPulsante.righeGiacenze]));
  verifica('su un altro anno la pagina non le passa: l\'elenco e\' il file di oggi, e l\'attesa della riga e\' di quell\'anno', p.altroAnno && p.altroAnno.righeGiacenze === null, J(p.altroAnno && p.altroAnno.righeGiacenze));
  verifica('nessuna lettura in piu\': una chiamata di calcolaGiacenze per anno, e nient\'altro', J(p.chiamateDopo) === J([`calcolaGiacenze {"anno":${p.annoOggi}}`, `calcolaGiacenze {"anno":${Number(p.annoOggi) - 1}}`]), J(p.chiamateDopo));

  // L'elenco vero, coi props della pagina.
  const tcy = await apriElenco(p.dalPulsante);
  verifica('l\'elenco aperto dallo stoccaggio di T-Cycle dice «Per noi chiusi» e non «li dichiara lui»', tcy.testo.includes(CHIUSI) && !/li dichiara lui/.test(tcy.testo) && !tcy.errori.length, tcy.testo.slice(0, 300));
  verifica('e senza letture in piu\': una chiamata, come prima', tcy.chiamate === 1, String(tcy.chiamate));
  const nap = await apriElenco({ ...p.dalPulsante, filtroSitoEsterno: NAP });
  verifica('da Nappi Sud, che manda anche a chi dichiara: l\'elenco di prima', !/Per noi chiusi/.test(nap.testo) && /li dichiara lui/.test(nap.testo), nap.testo.slice(0, 300));
  const altro = await apriElenco({ ...p.altroAnno, filtroSitoEsterno: TCY, filtroRuoloEsterno: 'stoc' });
  verifica('su un altro anno, da T-Cycle: l\'elenco di prima', !/Per noi chiusi/.test(altro.testo) && /li dichiara lui/.test(altro.testo), altro.testo.slice(0, 300));
}

console.log('2. SUI DATI VERI');
const CARTELLA = process.env.DATI_VERI || qui('../../dati-veri/');
const copie = existsSync(CARTELLA) ? readdirSync(CARTELLA).filter(n => /^treadrider-dati-veri-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n)).sort() : [];
if (!copie.length) console.log(`  nessuna copia dei dati veri in ${CARTELLA}: sezione saltata`);
else {
  const nome = copie[copie.length - 1];
  const DATI = JSON.parse(gunzipSync(readFileSync(CARTELLA + nome)).toString('utf8'));
  globalThis.__ARCHIVI_PER_NOI_CHIUSI = DATI.archivi;
  const ORA = DATI.meta.letto_fino_al;
  const ANNO = Number(String(ORA).slice(0, 4));
  const SDK_FINTO = `
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => {
  const x = r[k];
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    if ('$in' in v && !v.$in.includes(x)) return false;
    if ('$nin' in v && v.$nin.includes(x)) return false;
    if ('$gte' in v && !(x != null && String(x) >= String(v.$gte))) return false;
    if ('$lte' in v && !(x != null && String(x) <= String(v.$lte))) return false;
    if ('$gt' in v && !(x != null && String(x) > String(v.$gt))) return false;
    if ('$lt' in v && !(x != null && String(x) < String(v.$lt))) return false;
    if ('$ne' in v && x === v.$ne) return false;
    return true;
  }
  if (v === null) return x === null || x === undefined || x === '';
  return x === v;
});
const ordina = (righe, sort) => { const campo = String(sort || 'id').replace(/^[-+]/, ''); const giu = String(sort || '').startsWith('-');
  return [...righe].sort((a, b) => { const x = a[campo], y = b[campo]; if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y)); return giu ? -c : c; }); };
const entita = (nome) => ({
  list: async (sort, lim = 1e9, skip = 0) => ordina(globalThis.__ARCHIVI_PER_NOI_CHIUSI[nome] || [], sort).slice(skip, skip + lim),
  filter: async (f, sort, lim = 1e9, skip = 0) => ordina((globalThis.__ARCHIVI_PER_NOI_CHIUSI[nome] || []).filter(r => soddisfa(r, f)), sort).slice(skip, skip + lim),
  get: async (id) => (globalThis.__ARCHIVI_PER_NOI_CHIUSI[nome] || []).find(r => r.id === id) || null,
  create: async (r) => r, update: async (_id, r) => r, delete: async () => ({}),
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: 'admin', email: 'prova' }) }, asServiceRole: { entities }, entities,
    functions: { invoke: async (n) => { throw new Error('non chiama altre funzioni: ' + n); } } };
}`;
  const pacchetto = await build({
    entryPoints: [qui('../base44/functions/calcolaGiacenze/entry.ts')],
    bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
    plugins: [{ name: 'sdk-finto', setup(b) {
      b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
      b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
    } }],
  });
  const giacenze = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
  const OraVera = Date;
  const ms = OraVera.parse(ORA);
  globalThis.Date = class extends OraVera { constructor(...a) { if (a.length) super(...a); else super(ms); } static now() { return ms; } };
  let G;
  try { G = await (await giacenze.default({ json: async () => ({ anno: ANNO }) })).json(); } finally { globalThis.Date = OraVera; }
  console.log(`  Copia: ${nome}, letta il ${ORA}`);
  const chiuse = (G.righe || []).filter(r => r.tipo_destinazione === 'stoc' && Number(r.in_attesa_chiusa_t) > 0);
  const tc = chiuse.find(r => /T-CYCLE/.test(r.sito));
  verifica(`${ANNO}: calcolaGiacenze vera, uno stoccaggio con l'attesa per noi chiusa (T-Cycle)`, chiuse.length === 1 && !!tc, J(chiuse.map(r => [r.sito, r.in_attesa_chiusa_t])));
  if (tc) {
    if (nome === 'treadrider-dati-veri-2026-10-11.json.gz') {
      verifica("sulla copia dell'11/10/2026: 181,299 t per noi chiuse, tutta l'attesa di T-Cycle", tc.in_attesa_chiusa_t === 181.299 && tc.in_attesa_dichiarazione_t === 181.299, J([tc.in_attesa_chiusa_t, tc.in_attesa_dichiarazione_t]));
    }
    const p = await dallaPagina(G, tc.sito);
    verifica(`${ANNO}: la pagina passa all'elenco le righe vere dal pulsante di T-Cycle`, !p.errori.length && p.dalPulsante && p.dalPulsante.filtroSitoEsterno === tc.sito && J(p.dalPulsante.righeGiacenze) === J(G.righe), J(p.errori));
    const e = await apriElenco(p.dalPulsante);
    verifica(`${ANNO}: l'elenco aperto dallo stoccaggio di T-Cycle dice «Per noi chiusi»`, e.testo.includes(CHIUSI) && !/li dichiara lui/.test(e.testo) && !e.errori.length, e.testo.slice(0, 300));
    const nap = (G.righe || []).find(r => r.tipo_destinazione === 'stoc' && /NAPPI/.test(r.sito));
    if (nap) {
      const n = await apriElenco({ ...p.dalPulsante, filtroSitoEsterno: nap.sito });
      verifica(`${ANNO}: da Nappi Sud, che non e' chiuso, l'elenco di prima`, !/Per noi chiusi/.test(n.testo) && /li dichiara lui/.test(n.testo), n.testo.slice(0, 300));
    }
  }
}

console.log(`\n${ok} superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
