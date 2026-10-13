// L'ATTESA DEL PORTALE DI UN ANNO CHE NON E' QUELLO IN CORSO (seconda revisione
// del 13/10/2026).
//
// L'«In attesa di dichiarazione» di uno stoccaggio viene dal file degli ordini
// non dichiarati del portale, che e' di oggi e non distingue l'anno dei carichi.
// Sul 2025 guardato oggi, sulla copia dei dati veri:
//   - la scheda Stoccaggi diceva sotto «NAPPI SUD SRL -> Irigom S.r.l.» 146,34 t
//     «che il portale aspetta ancora che Irigom S.r.l. dichiari»: 72 righe, tutte
//     carichi del 2026;
//   - la Quadratura, sullo stoccaggio di Nappi Sud, 860,099 t «gia' partite che il
//     portale attribuisce ancora allo stoccaggio»: tutte del 2026;
//   - le Giacenze del 2025 gli stessi 860,099 t, e 181,299 su T-Cycle.
// Decisione: in Giacenze e Dichiarazioni insieme, per l'anno in corso vale tutto
// il file, come prima; per un altro anno solo i carichi di quell'anno, per il
// giorno italiano di fine trasporto (nellAttesaDellAnno, shared/giacenzaPortale.ts).
// La scheda Stoccaggi, la Quadratura e il racconto seguono la stessa regola.
// Nessuna giacenza cambia: l'attesa si mostra e basta.
//
// E GLI ORDINI CON LE TONNELLATE (revisione finale del 13/10/2026): sul 2025
// la riga dello stoccaggio delle Giacenze diceva 0 t in attesa e accanto
// «Ordini da dichiarare 397» su Nappi Sud e 72 su T-Cycle, gli ordini del file
// di oggi (ordini_stoc_anno.mjs del revisore). Ora gli ordini dello stoccaggio
// si contano con la stessa regola, e su un anno chiuso la colonna dice «dei
// carichi del 2025» nella pagina, nel PDF e nel foglio Excel.
//
// 1. la regola, da sola; 2. le due funzioni vere su un archivio costruito, con
// carichi del 2025 e del 2026 (orologio fermo all'11/10/2026); 3. le due funzioni
// vere sulla copia dei dati veri, se c'e', coi conti degli script del revisore
// (attesa_coppia_anni, attesa_nappi_anni, g2025_attesa, ordini_stoc_anno);
// 4. le etichette della pagina, del PDF e del foglio. npm run prove
import { build } from 'esbuild';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as PORTALE from '../base44/shared/giacenzaPortale.ts';
import { stoccaggioDelSito } from '../base44/shared/storiaDichiarazioni.ts';
import { normalizzaRagioneSociale as norm } from '../base44/shared/normalizzaRagioneSociale.ts';
import { caricaLibPagine } from './dati/libPagine.mjs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
const dodici = (pezzi) => { const a = new Array(12).fill(0); for (const [i, v] of Object.entries(pezzi)) a[Number(i)] = v; return a; };
const manca = (nome) => () => { throw new Error(`${nome} non c'e'`); };
const prova = (f) => { try { return f(); } catch (e) { return { errore: String(e && e.message) }; } };
const nellAttesaDellAnno = PORTALE.nellAttesaDellAnno || manca('nellAttesaDellAnno');
const giornoAlPiazzale = PORTALE.giornoAlPiazzale || manca('giornoAlPiazzale');

console.log('1. LA REGOLA');
{
  verifica("l'anno in corso conta tutto il file, anche i carichi dell'anno prima e quelli senza giorno",
    prova(() => nellAttesaDellAnno('2025-11-20', 2026, 2026)) === true && prova(() => nellAttesaDellAnno('', 2026, 2026)) === true);
  verifica("un anno passato conta solo i suoi carichi, per il giorno italiano: il 31/12 alle 23:30 italiane e' ancora quell'anno",
    prova(() => nellAttesaDellAnno('2026-03-20', 2025, 2026)) === false && prova(() => nellAttesaDellAnno('2025-03-20', 2025, 2026)) === true
      && prova(() => nellAttesaDellAnno('2025-12-31T22:30:00Z', 2025, 2026)) === true && prova(() => nellAttesaDellAnno('2025-12-31T23:30:00Z', 2025, 2026)) === false);
  verifica('un carico senza giorno non e\' di nessun anno passato', prova(() => nellAttesaDellAnno('', 2025, 2026)) === false);
  verifica('il giorno al piazzale: la fine trasporto della riga, se no quella della primaria nel gestionale',
    prova(() => giornoAlPiazzale({ fine_trasporto: '2025-06-10T00:00:00.000Z', ordine_primaria: 'X' }, () => '2026-01-01')) === '2025-06-10'
      && prova(() => giornoAlPiazzale({ fine_trasporto: null, ordine_primaria: ' ET1 ' }, (id) => (id === 'ET1' ? '2025-02-03' : ''))) === '2025-02-03'
      && prova(() => giornoAlPiazzale({ fine_trasporto: '', ordine_primaria: 'ET9' }, () => '')) === '');
  // collocaFotografia, il pezzo che usa riepilogoDichiarazioni.
  const righe = [
    { destinazione: 'NAPPI', ordine_primaria: 'P25', fine_trasporto: '2025-11-20', peso_non_dichiarato_kg: 3000, prodotto: '.class1' },
    { destinazione: 'NAPPI', ordine_primaria: 'P26', fine_trasporto: '2026-03-20', peso_non_dichiarato_kg: 5000, prodotto: '.class1' },
    { destinazione: 'NAPPI', destinazione_secondaria: 'ALFA', ordine_secondaria: 'S25', ordine_primaria: 'Q1', fine_trasporto: '2025-07-01', peso_non_dichiarato_kg: 2000, prodotto: '.class1' },
    { destinazione: 'NAPPI', destinazione_secondaria: 'ALFA', ordine_secondaria: 'S26', ordine_primaria: 'Q2', fine_trasporto: '2025-12-30', peso_non_dichiarato_kg: 4000, prodotto: '.class1' },
  ];
  const opz = { chiaveDi: (s) => String(s || '').toLowerCase(), ruoloPrimaria: (id) => (/^P/.test(id) ? 'stoc' : ''),
    secondarie: [{ id_ordine: 'S25', trasporto_finito_il: '2025-07-10T08:00:00Z', stato: 'terminato' }, { id_ordine: 'S26', trasporto_finito_il: '2026-01-05T08:00:00Z', stato: 'terminato' }] };
  const tutto = PORTALE.collocaFotografia(righe, opz);
  verifica('senza anno, collocaFotografia conta tutto il file come prima: 8 t sullo stoccaggio, 6 verso ALFA',
    tutto.inAttesa.get('nappi') === 8 && tutto.attesaCoppia.get('nappi|alfa') === 6, `${tutto.inAttesa.get('nappi')} / ${tutto.attesaCoppia.get('nappi|alfa')}`);
  const c25 = PORTALE.collocaFotografia(righe, { ...opz, anno: 2025, annoDiOggi: 2026 });
  verifica("sul 2025: 3 t sullo stoccaggio, e verso ALFA 2 t, perche' il carico partito il 30/12/2025 e' arrivato all'impianto nel 2026",
    c25.inAttesa.get('nappi') === 3 && c25.attesaCoppia.get('nappi|alfa') === 2, `${c25.inAttesa.get('nappi')} / ${c25.attesaCoppia.get('nappi|alfa')}`);
  const c26 = PORTALE.collocaFotografia(righe, { ...opz, anno: 2026, annoDiOggi: 2026 });
  verifica("sull'anno in corso tutto il file, come prima", c26.inAttesa.get('nappi') === 8 && c26.attesaCoppia.get('nappi|alfa') === 6);
  verifica('e la fotografia degli impianti non cambia con l\'anno', J([...c25.portale]) === J([...tutto.portale]) && J([...c25.perMese]) === J([...tutto.perMese]));
  // Il racconto: su un anno passato la frase dice di che anno sono i carichi,
  // perche' il file e' dell'anno dopo.
  const base = { sito: 'T-CYCLE INDUSTRIES SRL', canale: 'RETE', entrato: dodici({ 0: 1000 }), uscito: dodici({ 0: 1000 }), fotoIl: '2026-10-09' };
  const tecnogum = [{ impianto: 'TECNOGUM SRL', chiave: 'tecnogum', kg: 1000, dichiara: false, mesi_kg: dodici({ 0: 1000 }) }];
  const zero25 = stoccaggioDelSito({ ...base, verso: tecnogum, inAttesaT: 0, annoCarichi: 2025 });
  verifica('il racconto del 2025: «non attribuisce allo stoccaggio niente dei carichi del 2025», e l\'attesa e\' 0, un numero vero',
    zero25.in_attesa_t === 0 && zero25.frasi.includes('TECNOGUM SRL sulla rete non ci dichiara, per accordo: il portale, nel file del 09/10/2026, non attribuisce allo stoccaggio niente dei carichi del 2025 in attesa di dichiarazione.'), J(zero25.frasi));
  const due25 = stoccaggioDelSito({ ...base, verso: tecnogum, inAttesaT: 2, annoCarichi: 2025 });
  verifica('e con un numero dice «di carichi del 2025»', due25.frasi.some(f => f.includes('attribuisce ancora 2,00 t di carichi del 2025 allo stoccaggio di T-CYCLE INDUSTRIES SRL')), J(due25.frasi));
  const oggi = stoccaggioDelSito({ ...base, verso: tecnogum, inAttesaT: 181.299 });
  verifica("sull'anno in corso la frase e' quella di prima", oggi.frasi.some(f => f.includes('attribuisce ancora 181,299 t allo stoccaggio di T-CYCLE INDUSTRIES SRL, in attesa')) && !oggi.frasi.some(f => /carichi del/.test(f)), J(oggi.frasi));
  const sorgente = readFileSync(qui('../src/components/dichiarazioni/Quadratura.jsx'), 'utf8').replace(/\r/g, '');
  verifica('la Quadratura di un anno chiuso dice di che anno sono i carichi', /\{dati\.anno_chiuso \? ` di carichi del \$\{dati\.anno\}` : ''\} gia' partite che il portale attribuisce ancora allo stoccaggio/.test(sorgente));
}

// ─────────────────────────────────────────────────────────────────────────────
// Le due funzioni vere, con un SDK finto che legge da globalThis.__ARCHIVI_ATTESA.
const SDK_FINTO = `
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    if ('$in' in v) return v.$in.includes(r[k]);
    if ('$gte' in v && !(r[k] != null && String(r[k]) >= String(v.$gte))) return false;
    if ('$lte' in v && !(r[k] != null && String(r[k]) <= String(v.$lte))) return false;
    return true;
  }
  if (v === null) return r[k] === null || r[k] === undefined || r[k] === '';
  return r[k] === v;
});
const ordina = (righe) => [...righe].sort((a, b) => String(a.id).localeCompare(String(b.id)));
const entita = (nome) => ({
  list: async (_o, lim = 1e9, skip = 0) => ordina(globalThis.__ARCHIVI_ATTESA[nome] || []).slice(skip, skip + lim),
  filter: async (f, _o, lim = 1e9, skip = 0) => ordina((globalThis.__ARCHIVI_ATTESA[nome] || []).filter(r => soddisfa(r, f))).slice(skip, skip + lim),
  create: async (r) => r, update: async (_id, r) => r, delete: async () => ({}),
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: 'admin', email: 'prova' }) }, asServiceRole: { entities }, entities };
}`;
const funzione = async (nome, sdk = SDK_FINTO) => {
  const pacchetto = await build({
    entryPoints: [qui(`../base44/functions/${nome}/entry.ts`)],
    bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
    plugins: [{ name: 'sdk-finto', setup(b) {
      b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
      b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: sdk, loader: 'js' }));
    } }],
  });
  const modulo = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
  return async (corpo) => (await modulo.default({ json: async () => corpo })).json();
};
const OraVera = Date;
const conOra = async (iso, f) => {
  const ms = OraVera.parse(iso);
  globalThis.Date = class extends OraVera { constructor(...a) { if (a.length) super(...a); else super(ms); } static now() { return ms; } };
  try { return await f(); } finally { globalThis.Date = OraVera; }
};
// L'attesa di ogni stoccaggio nei due moduli, e quella verso ogni impianto. Gli
// stoccaggi si confrontano per ragione sociale normalizzata (`norm`).
const attese = (R, G) => {
  const g = {};
  for (const x of (G.righe || []).filter(x => x.tipo_destinazione === 'stoc')) g[x.sito] = x.in_attesa_dichiarazione_t;
  const r = {};
  for (const s of R.stoccaggi || []) r[s.sito] = s.in_attesa_portale_t;
  const coppie = (R.stoccaggi || []).map(s => {
    const gg = (G.righe || []).find(x => x.tipo_destinazione === 'stoc' && norm(x.sito) === s.chiave);
    return { sito: s.sito, dichiarazioni: s.in_attesa_portale_t, giacenze: gg ? gg.in_attesa_dichiarazione_t : null };
  });
  const q = {};
  for (const s of (R.siti || []).filter(x => x.tipo_destinazione === 'stoc' && x.canale === 'RETE')) q[s.sito] = s.in_attesa_dichiarazione_t;
  const verso = {};
  for (const s of R.stoccaggi || []) for (const c of s.canali.filter(c => c.canale === 'RETE')) for (const v of c.verso) verso[`${s.sito} -> ${v.impianto}`] = v.in_attesa_t;
  // Gli ordini da dichiarare della stessa riga delle Giacenze, accanto
  // all'attesa (revisione finale del 13/10/2026): stoccaggi e impianti.
  const ordini = {};
  for (const x of G.righe || []) ordini[`${x.sito}|${x.tipo_destinazione}`] = x.ordini_da_dichiarare;
  return { giacenze: g, stoccaggi: r, quadratura: q, verso, coppie, ordini, totale: G.totali ? G.totali.in_attesa_dichiarazione_t : null,
    attesaDel: G.totali ? G.totali.in_attesa_dei_carichi_del : undefined };
};

// Le risposte delle Giacenze sull'archivio costruito, per la sezione 4.
const GIACENZE_COSTRUITE = {};

console.log('2. LE DUE FUNZIONI VERE, SU UN ARCHIVIO COSTRUITO');
{
  const ARCHIVI = {};
  globalThis.__ARCHIVI_ATTESA = ARCHIVI;
  const VUOTI = ['DichiarazioneTrattamento', 'Terziaria', 'ImpiantoTargetSecondaria', 'TargetRaccoglitore', 'TargetMensile', 'GiacenzaStoccaggio', 'IndicatoreGiorno',
    'PrimariaAci', 'ExtraRaccolta', 'Secondaria', 'OrdineNonDichiarato', 'DichiarazioneSito', 'GiacenzaSito', 'PrimariaRete', 'CommessaEcotyre', 'UploadLog'];
  for (const v of VUOTI) ARCHIVI[v] = [];
  let seq = 0;
  const con = (nome, righe) => { ARCHIVI[nome] = righe.map(r => ({ id: 'r' + String(++seq).padStart(5, '0'), ...r })); };
  const g = (giorno) => `${giorno}T08:00:00Z`;
  const NAPPI = 'NAPPI SUD SRL', ALFA = 'ALFA SRL';
  const primaria = (id, dest, kg, giorno, extra = {}) => ({
    id_ordine: id, numero_fir: 'FIR' + id, classe: 'P - fino a 35 kg', prodotto: '.class1', destinazione: dest,
    tipo_destinazione: 'imp', stato: 'terminato', peso_effettivo: kg, trasportatore: 'RACCOLTA SRL', provincia: 'NA',
    ordine_immesso_il: g(giorno), trasporto_iniziato_il: g(giorno), trasporto_finito_il: g(giorno), ordine_chiuso_il: g(giorno), ...extra,
  });
  con('GiacenzaSito', [
    { sito: NAPPI, tipo_destinazione: 'stoc', anno: 2025 }, { sito: ALFA, tipo_destinazione: 'imp', anno: 2025, dichiara_rete: true },
    { sito: NAPPI, tipo_destinazione: 'stoc', anno: 2026 }, { sito: ALFA, tipo_destinazione: 'imp', anno: 2026, dichiara_rete: true },
  ]);
  con('PrimariaRete', [
    primaria('ET25000030', NAPPI, 10000, '2025-06-10', { tipo_destinazione: 'stoc' }),
    primaria('ET25000031', NAPPI, 15000, '2025-11-20', { tipo_destinazione: 'stoc' }),
    primaria('ET26000032', NAPPI, 5000, '2026-03-20', { tipo_destinazione: 'stoc' }),
  ]);
  con('Secondaria', [
    { ...primaria('SEC25000001', ALFA, 10000, '2025-07-10'), stoccaggio: NAPPI },
    { ...primaria('SEC26000002', ALFA, 8000, '2026-04-10'), stoccaggio: NAPPI },
  ]);
  con('GiacenzaStoccaggio', [{ sito: NAPPI, data_rilevazione: '2026-09-16', class1_kg: 20000, class2_kg: 0, class3_kg: 0, class4_kg: 0, class9_kg: 0, created_date: '2026-09-16T09:00:00Z' }]);
  const nd = (r) => ({ prodotto: '.class1', partner_operativo: 'SMOCO Srl', status: 'terminato', created_date: '2026-10-09T16:00:00Z', ...r });
  con('OrdineNonDichiarato', [
    // Sullo stoccaggio: due carichi del 2025 (uno senza fine trasporto nel file:
    // vale quella della primaria nel gestionale) e uno del 2026.
    nd({ destinazione: NAPPI, ordine_primaria: 'ET25000031', fine_trasporto: g('2025-11-20'), peso_non_dichiarato_kg: 3000 }),
    nd({ destinazione: NAPPI, ordine_primaria: 'ET25000030', fine_trasporto: null, peso_non_dichiarato_kg: 1000 }),
    nd({ destinazione: NAPPI, ordine_primaria: 'ET26000032', fine_trasporto: g('2026-03-20'), peso_non_dichiarato_kg: 5000 }),
    // Partiti verso ALFA: uno arrivato nel 2025, uno nel 2026.
    nd({ destinazione: NAPPI, destinazione_secondaria: ALFA, ordine_secondaria: 'SEC25000001', ordine_primaria: 'ET25000030', fine_trasporto: g('2025-06-10'), peso_non_dichiarato_kg: 2000 }),
    nd({ destinazione: NAPPI, destinazione_secondaria: ALFA, ordine_secondaria: 'SEC26000002', ordine_primaria: 'ET26000032', fine_trasporto: g('2026-03-20'), peso_non_dichiarato_kg: 4000 }),
  ]);
  const riepilogo = await funzione('riepilogoDichiarazioni');
  const giacenze = await funzione('calcolaGiacenze');
  const ORA = '2026-10-11T10:00:00Z';
  const A = {};
  for (const anno of [2025, 2026]) {
    const R = await conOra(ORA, () => riepilogo({ anno }));
    const G = await conOra(ORA, () => giacenze({ anno }));
    A[anno] = attese(R, G);
    GIACENZE_COSTRUITE[anno] = G;
  }
  verifica('il 2025: 4 t sullo stoccaggio di Nappi Sud (i soli carichi del 2025), nelle Giacenze, nella scheda Stoccaggi e nella Quadratura',
    A[2025].giacenze[NAPPI] === 4 && A[2025].stoccaggi[NAPPI] === 4 && A[2025].quadratura[NAPPI] === 4, J(A[2025]));
  verifica('e verso ALFA 2 t, il carico arrivato nel 2025: non le 6 del file', A[2025].verso[`${NAPPI} -> ${ALFA}`] === 2, J(A[2025].verso));
  verifica("il 2026, l'anno in corso: tutto il file, 9 t sullo stoccaggio e 6 verso ALFA, come prima",
    A[2026].giacenze[NAPPI] === 9 && A[2026].stoccaggi[NAPPI] === 9 && A[2026].quadratura[NAPPI] === 9 && A[2026].verso[`${NAPPI} -> ${ALFA}`] === 6, J(A[2026]));
  verifica('e il totale «In attesa di dichiarazione» delle Giacenze: 4 t nel 2025, 9 nel 2026', A[2025].totale === 4 && A[2026].totale === 9, `${A[2025].totale} / ${A[2026].totale}`);
  // GLI ORDINI CON LE TONNELLATE (revisione finale del 13/10/2026): accanto
  // all'attesa la riga dello stoccaggio dice «Ordini da dichiarare», e sono gli
  // stessi ordini. Sul 2025 erano tutti quelli del file di oggi.
  verifica('gli ordini da dichiarare di Nappi Sud nel 2025 sono i due carichi del 2025, non i tre del file',
    A[2025].ordini[`${NAPPI}|stoc`] === 2, J(A[2025].ordini));
  verifica("nel 2026, l'anno in corso, tutti e tre, come prima", A[2026].ordini[`${NAPPI}|stoc`] === 3, J(A[2026].ordini));
  verifica("e la riga dell'impianto non cambia con l'anno: la fotografia e' quella", A[2025].ordini[`${ALFA}|imp`] === A[2026].ordini[`${ALFA}|imp`] && A[2026].ordini[`${ALFA}|imp`] === 2, J([A[2025].ordini, A[2026].ordini]));
  verifica("le Giacenze dicono di quali carichi e' l'attesa: del 2025 sul 2025, tutto il file (null) sull'anno in corso",
    A[2025].attesaDel === 2025 && A[2026].attesaDel === null, `${A[2025].attesaDel} / ${A[2026].attesaDel}`);
}

// ─────────────────────────────────────────────────────────────────────────────
const CARTELLA = process.env.DATI_VERI || qui('../../dati-veri/');
const copie = existsSync(CARTELLA) ? readdirSync(CARTELLA).filter(n => /^treadrider-dati-veri-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n)).sort() : [];
if (!copie.length) {
  console.log(`Nessuna copia dei dati veri in ${CARTELLA}: la sezione 3 si salta.`);
} else {
  console.log('3. SUI DATI VERI: IL 2025 E IL 2026');
  const DATI = JSON.parse(gunzipSync(readFileSync(CARTELLA + copie[copie.length - 1])).toString('utf8'));
  globalThis.__DATI_VERI = DATI.archivi;
  globalThis.__SCRITTE_DATI_VERI = [];
  const dv = readFileSync(qui('datiVeri.mjs'), 'utf8').replace(/\r/g, '');
  const SDK_VERO = dv.slice(dv.indexOf('const SDK_FINTO = `') + 'const SDK_FINTO = `'.length, dv.indexOf('}`;') + 1);
  const riepilogo = await funzione('riepilogoDichiarazioni', SDK_VERO);
  const giacenze = await funzione('calcolaGiacenze', SDK_VERO);
  const ORA = DATI.meta.letto_fino_al;
  const ANNO = Number(String(ORA).slice(0, 4));
  // I carichi in attesa, contati qui dagli archivi per anno di fine trasporto,
  // come negli script del revisore.
  const arch = DATI.archivi;
  const giorno = (x) => (x ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new OraVera(x)) : '');
  const prim = new Map(arch.PrimariaRete.map(r => [String(r.id_ordine || '').trim(), r]));
  const sec = new Map(arch.Secondaria.map(r => [String(r.id_ordine || '').trim(), r]));
  const kgPerAnno = (filtro, data) => { const a = {}; for (const r of arch.OrdineNonDichiarato.filter(filtro)) { const y = String(giorno(data(r))).slice(0, 4) || '?'; a[y] = (a[y] || 0) + (Number(r.peso_non_dichiarato_kg) || 0); } return a; };
  const finePrim = (r) => r.fine_trasporto || ((p) => (p && p.stato === 'terminato' ? p.trasporto_finito_il : ''))(prim.get(String(r.ordine_primaria || '').trim()));
  const nappiStoc = kgPerAnno(r => /nappi/i.test(r.destinazione || '') && !String(r.destinazione_secondaria || '').trim(), finePrim);
  const nappiIrigom = kgPerAnno(r => /nappi/i.test(r.destinazione || '') && /irigom/i.test(r.destinazione_secondaria || ''), (r) => (sec.get(String(r.ordine_secondaria || '').trim()) || {}).trasporto_finito_il || r.fine_trasporto);
  // E quanti ordini, per anno di arrivo al piazzale (revisione finale del 13/10/2026).
  const nappiOrdini = {};
  for (const r of arch.OrdineNonDichiarato.filter(r => /nappi/i.test(r.destinazione || '') && !String(r.destinazione_secondaria || '').trim())) {
    const y = String(giorno(finePrim(r))).slice(0, 4) || '?';
    nappiOrdini[y] = (nappiOrdini[y] || 0) + 1;
  }
  console.log(`  nel file del portale: Nappi Sud sullo stoccaggio ${J(nappiStoc)}, verso Irigom ${J(nappiIrigom)}`);
  const A = {};
  for (const anno of [ANNO - 1, ANNO]) {
    const R = await conOra(ORA, () => riepilogo({ anno }));
    const G = await conOra(ORA, () => giacenze({ anno }));
    A[anno] = attese(R, G);
  }
  const t3 = (kg) => Math.round(kg) / 1000;
  const nappi = (o) => Object.entries(o).find(([k]) => /nappi/i.test(k)) || [];
  const tcycle = (o) => Object.entries(o).find(([k]) => /t-cycle/i.test(k)) || [];
  const versoNI = (o) => Object.entries(o).find(([k]) => /nappi/i.test(k) && /irigom/i.test(k)) || [];
  const stocDi = (o, re) => (Object.entries(o).find(([k]) => re.test(k) && k.endsWith('|stoc')) || [])[1];
  const prec = A[ANNO - 1], ora = A[ANNO];
  verifica(`il ${ANNO - 1}: Nappi Sud in attesa sullo stoccaggio solo coi carichi del ${ANNO - 1} (${t3(nappiStoc[ANNO - 1] || 0)} t), nelle Giacenze e nella Quadratura`,
    nappi(prec.giacenze)[1] === t3(nappiStoc[ANNO - 1] || 0) && nappi(prec.quadratura)[1] === t3(nappiStoc[ANNO - 1] || 0), `${J(nappi(prec.giacenze))} ${J(nappi(prec.quadratura))}`);
  verifica(`il ${ANNO - 1}: verso Irigom solo i carichi arrivati nel ${ANNO - 1} (${t3(nappiIrigom[ANNO - 1] || 0)} t), non ${t3(Object.values(nappiIrigom).reduce((s, x) => s + x, 0))}`,
    versoNI(prec.verso)[1] === t3(nappiIrigom[ANNO - 1] || 0), J(versoNI(prec.verso)));
  if (ANNO === 2026) {
    verifica('il 2025 dei dati veri: Nappi Sud 0 (non 860,099), T-Cycle 0 (non 181,299), Nappi Sud -> Irigom 0 (non 146,34), il totale 0',
      nappi(prec.giacenze)[1] === 0 && tcycle(prec.giacenze)[1] === 0 && versoNI(prec.verso)[1] === 0 && prec.totale === 0, J(prec));
    verifica("il 2026, l'anno in corso, non cambia: 860,099, 181,299 e 146,34",
      nappi(ora.giacenze)[1] === 860.099 && nappi(ora.quadratura)[1] === 860.099 && tcycle(ora.giacenze)[1] === 181.299 && versoNI(ora.verso)[1] === 146.34, J(ora));
    // Gli ordini da dichiarare della stessa riga (revisione finale del
    // 13/10/2026): sul 2025 dicevano 397 su Nappi Sud e 72 su T-Cycle accanto a
    // 0 t in attesa, gli ordini del file di oggi.
    verifica('il 2025 dei dati veri: 0 ordini da dichiarare su Nappi Sud (non 397) e su T-Cycle (non 72), come le 0 t',
      stocDi(prec.ordini, /nappi/i) === 0 && stocDi(prec.ordini, /t-cycle/i) === 0, J(prec.ordini));
    verifica("il 2026, l'anno in corso, non cambia: 397 ordini su Nappi Sud e 72 su T-Cycle",
      stocDi(ora.ordini, /nappi/i) === 397 && stocDi(ora.ordini, /t-cycle/i) === 72, J(ora.ordini));
  }
  verifica(`il ${ANNO - 1}: gli ordini da dichiarare di Nappi Sud sono quelli dei carichi arrivati al piazzale nel ${ANNO - 1} (${nappiOrdini[ANNO - 1] || 0})`,
    stocDi(prec.ordini, /nappi/i) === (nappiOrdini[ANNO - 1] || 0), `${J(prec.ordini)} ${J(nappiOrdini)}`);
  // Su nessuno stoccaggio, in nessuno dei due anni, gli ordini dicono una cosa e
  // le tonnellate un'altra: 0 t in attesa con ordini da dichiarare non c'e'.
  for (const anno of [ANNO - 1, ANNO]) {
    const storti = Object.entries(A[anno].giacenze).filter(([sito, t]) => !(t > 0) && A[anno].ordini[`${sito}|stoc`] > 0);
    verifica(`il ${anno}: nessuno stoccaggio con 0 t in attesa e ordini da dichiarare`, !storti.length, J(storti.map(([s]) => [s, A[anno].ordini[`${s}|stoc`]])));
  }
  verifica(`le Giacenze dicono di quali carichi e' l'attesa: del ${ANNO - 1} sul ${ANNO - 1}, null sull'anno in corso`,
    prec.attesaDel === ANNO - 1 && ora.attesaDel === null, `${prec.attesaDel} / ${ora.attesaDel}`);
  // L'orologio svizzero, anche qui: ogni stoccaggio, la stessa attesa nei due moduli.
  for (const anno of [ANNO - 1, ANNO]) {
    const coppie = A[anno].coppie.filter(c => c.giacenze !== null);
    const diversi = coppie.filter(c => Math.abs(c.giacenze - c.dichiarazioni) > 0.0005);
    verifica(`il ${anno}: ogni stoccaggio ha la stessa attesa in Giacenze e Dichiarazioni (${coppie.length} stoccaggi)`, coppie.length >= 2 && !diversi.length, J(diversi));
  }
  verifica('niente scritto sugli archivi', globalThis.__SCRITTE_DATI_VERI.length === 0, globalThis.__SCRITTE_DATI_VERI.join());
}

// ─────────────────────────────────────────────────────────────────────────────
// Revisione finale del 13/10/2026: sulle Giacenze di un anno chiuso la colonna
// «In attesa di dichiarazione» dice «dei carichi del 2025», nella pagina, nel
// PDF e nel foglio Excel, come la Quadratura delle Dichiarazioni. Sull'anno in
// corso resta l'etichetta di sempre. Sulle risposte dell'archivio costruito.
console.log("4. LE GIACENZE DI UN ANNO CHIUSO DICONO DI QUALI CARICHI E' L'ATTESA");
{
  const G25 = GIACENZE_COSTRUITE[2025], G26 = GIACENZE_COSTRUITE[2026];
  // La pagina, disegnata con react-dom/server.
  const ESTENSIONI = ['', '.js', '.jsx', '.ts'];
  const daAlias = (p) => { const base = qui('../src/' + p.slice(2)); return ESTENSIONI.map(e => base + e).find(f => existsSync(f) && /\.\w+$/.test(f)) || base; };
  let disegna = () => '';
  try {
    const pacchetto = await build({
      stdin: { contents: `import React from 'react'; import { renderToStaticMarkup } from 'react-dom/server.browser'; import SituazioneTable from ${J(qui('../src/components/giacenze/SituazioneTable.jsx'))}; export const disegna = (righe, totali) => renderToStaticMarkup(React.createElement(SituazioneTable, { righe, totali, onVaiDaDichiarare: () => {} }));`, resolveDir: qui('.'), loader: 'js' },
      bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent', loader: { '.jsx': 'jsx', '.js': 'jsx' }, define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [{ name: 'alias', setup(b) { b.onResolve({ filter: /^@\// }, (args) => ({ path: daAlias(args.path) })); } }],
    });
    ({ disegna } = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64')));
  } catch (e) { verifica('la tabella della Situazione si disegna', false, String(e && e.message).slice(0, 300)); }
  const colonna = (html) => (String(html).match(/<th[^>]*>In attesa di dichiarazione.*?<\/th>/) || [''])[0];
  const h25 = colonna(disegna(G25.righe, G25.totali)), h26 = colonna(disegna(G26.righe, G26.totali));
  verifica("la pagina, sul 2025: la colonna dice «dei carichi del 2025», e al passaggio del mouse il perche'",
    /dei carichi del (<!-- -->)?2025/.test(h25) && /title="[^"]*conta solo i carichi arrivati al piazzale nel 2025/.test(h25), h25);
  verifica("sul 2026, l'anno in corso, l'etichetta di sempre", h26 !== '' && !/carichi del/.test(h26) && !/title=/.test(h26), h26);

  // Il PDF della scheda: il riepilogo e la colonna.
  const pdf = await caricaLibPagine('lib/giacenzePdf');
  const attesaPdf = (p) => [(p.riepilogo.find(x => /^In attesa/.test(x.etichetta)) || {}).etichetta, (p.sezioni[0].colonne.find(c => /^In attesa/.test(c.titolo)) || {}).titolo];
  const p25 = attesaPdf(pdf.situazionePdf(2025, G25.righe, G25.totali)), p26 = attesaPdf(pdf.situazionePdf(2026, G26.righe, G26.totali));
  verifica('il PDF del 2025: «In attesa di dichiarazione, dei carichi del 2025» nel riepilogo e nella colonna',
    J(p25) === J(['In attesa di dichiarazione, dei carichi del 2025', 'In attesa dich., dei carichi del 2025']), J(p25));
  verifica('il PDF del 2026 com\'era', J(p26) === J(['In attesa di dichiarazione', 'In attesa dich.']), J(p26));

  // Il foglio Excel: le righe che arrivano al corredo comune dei fogli.
  const FOGLI = {};
  globalThis.__FOGLI_ATTESA = FOGLI;
  const xl = await caricaLibPagine('lib/giacenzeExportAll', [
    ["import { documentoDa, nuovaCartella, foglioDaRighe, scaricaCartella, FORMATI } from '@/lib/fogliProfessionali';",
      'const documentoDa = async () => ({}); const nuovaCartella = async () => ({ wb: {} }); const foglioDaRighe = (_wb, nome, o) => { globalThis.__FOGLI_ATTESA[nome] = o.righe; }; const scaricaCartella = (_wb, nome) => nome; const FORMATI = {};'],
    ["import { testoFormulario, testoCollocato } from '@/lib/giacenzeDaDichiarareExport';", "const testoFormulario = () => ''; const testoCollocato = () => '';"],
    ["import { INTESTAZIONE_DATE, righeExcelDate } from '@/components/giacenze/DateDaSistemare';", "const INTESTAZIONE_DATE = ['Data']; const righeExcelDate = () => [];"],
  ]);
  await xl.exportGiacenzeAllExcel(G25, { righe: [], totale_kg: 0 }, 2025);
  const x25 = FOGLI.Situazione;
  await xl.exportGiacenzeAllExcel(G26, { righe: [], totale_kg: 0 }, 2026);
  const x26 = FOGLI.Situazione;
  const iA = x25[0].findIndex(h => /^In attesa/.test(h));
  const nappi25 = x25.find(r => r[0] === 'NAPPI SUD SRL' && r[1] === 'Stoccaggio') || [];
  verifica("il foglio del 2025: l'intestazione dice «dei carichi del 2025», e accanto le 4 t gli ordini sono i 2 di quei carichi",
    x25[0][iA] === 'In attesa di dichiarazione, dei carichi del 2025 (t)' && x25[0][iA + 1] === 'Ordini da dichiarare' && nappi25[iA] === 4 && nappi25[iA + 1] === 2, `${J(x25[0])} ${J(nappi25)}`);
  verifica('il foglio del 2026 com\'era', x26[0].includes('In attesa di dichiarazione (t)') && !x26[0].some(h => /carichi del/.test(h)), J(x26[0]));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
