// GLI ORDINI RIMASTI «ESEGUITO» A PORTALE, SEGNALATI CON L'ID A OGNI CARICAMENTO
// (richiesta dell'utente del 14/10/2026).
//
// «ad ogni caricamento di primarie, secondarie o terziarie, qualora risultassero
// degli ordini in stato "eseguito" [...] devono essere sempre segnalati indicando
// l'id ordine affinche' vi si possa porre subito rimedio [...] nel modo [...]
// meno invasivo possibile».
//
// Prima: le primarie dicevano solo i conti (dal file), le secondarie e le
// terziarie al caricamento non dicevano niente, la dashboard niente, le pagine
// gli ID in una tendina con la loro regola. Ora la regola e' una
// (base44/shared/ordiniEseguiti.ts, specchio src/lib/ordiniEseguiti.js) e la
// usano l'esito del caricamento, la voce di «Da gestire» e l'avviso delle pagine.
//
// 1. la regola: gruppi per tipo e canale mai sommati, ID, giorni dalla fine
//    trasporto, che cosa manca, un archivio non letto che non diventa «nessuno»;
// 2. lo specchio identico;
// 3. il caricamento delle secondarie, delle terziarie (e delle primarie dalla
//    strada lato server) sul banco: l'esito li dice con gli ID, il registro li
//    scrive, il caricamento dopo li risolve e l'esito tace;
// 4. il registro delle primarie (importaBlocco, azione registra) rilegge
//    l'archivio e li restituisce; il browser li prende, o ripiega sul file;
// 5. la dashboard: una voce sola, con gli ID; sparisce quando l'archivio non ne
//    ha piu'; un archivio non letto non fa un verde falso; nascosta torna solo
//    per un ordine nuovo;
// 6. a video: l'esito sotto la scheda e l'avviso delle pagine dicono le stesse
//    cose; niente se non ce n'e' nessuno; il foglio da scaricare;
// 7. i dati veri dell'11/10/2026: quanti eseguiti ci sono e la voce.
//
// Dopo la revisione (14/10/2026): a un ordine immesso prima dell'anno da cui
// parte l'export la voce e l'esito promettevano che sarebbe sparito da solo al
// caricamento dopo, e non e' vero: serve un export che parte dal suo anno. Le
// frasi ora lo dicono (fraseFuoriExport, spiegazioneEseguiti), nelle sezioni 1,
// 3, 5 e 6. E la funzione e le pagine contano i giorni da oggi: le sezioni 5 e
// 6 fermano l'orologio al 14/10/2026 (alGiorno), altrimenti dal giorno dopo
// «26 giorni fa» diventava 27 e la prova cadeva.
// node prove/ordiniEseguiti.mjs
process.env.TZ = 'UTC';
import { build } from 'esbuild';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { caricaFunzione, chiama } from './dati/bancoFunzioni.mjs';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
const J = JSON.stringify;
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + (extra ? ' — ' + extra : '')); } };
const sezione = async (titolo, fn) => {
  console.log(titolo);
  try { await fn(); } catch (e) { ko++; console.log('  FALLITA: la sezione si e\' fermata: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' ') : e)); }
};
// Le attese fra un tentativo e l'altro sono secondi veri: qui non servono.
const setTimeoutVero = globalThis.setTimeout;
globalThis.setTimeout = (fn, ms, ...resto) => setTimeoutVero(fn, ms > 20 ? 1 : ms, ...resto);

const R = await import('../base44/shared/ordiniEseguiti.ts').catch(e => { verifica('la regola esiste (base44/shared/ordiniEseguiti.ts)', false, String(e && e.message)); return {}; });
const { nascondi, percheTorna } = await import('../src/lib/avvisiNascosti.js');
const OGGI = '2026-10-14';

// L'orologio fermo su un giorno, a mezza mattina, mentre gira fn (sincrona o
// no): cruscottoOperativo e l'avviso delle pagine chiedono oggi a oggiRoma(),
// e i giorni dalla fine trasporto non devono dipendere da quando si lancia la
// prova. Come in prove/attesaDellAnno.mjs.
const DateVera = globalThis.Date;
function alGiorno(giorno, fn) {
  const ms = DateVera.parse(`${giorno}T10:00:00Z`);
  globalThis.Date = class extends DateVera { constructor(...a) { if (a.length) super(...a); else super(ms); } static now() { return ms; } };
  let r;
  try { r = fn(); } catch (e) { globalThis.Date = DateVera; throw e; }
  if (r && typeof r.then === 'function') return r.finally(() => { globalThis.Date = DateVera; });
  globalThis.Date = DateVera;
  return r;
}

// ---------------------------------------------------------------------------
// Gli archivi di prova
// ---------------------------------------------------------------------------
const PRIMARIE_RETE = [
  // un ordine con due righe (due classi): un ordine solo, i chili sommati
  { id: 'p1', id_ordine: 'ET26152600', stato: 'eseguito', numero_fir: 'FIR A', trasportatore: 'YORK AUTO VUMBACA', punto_di_raccolta: 'Officina Uno', id_pdr: 123, provincia: 'RC', destinazione: 'GATIM', ordine_immesso_il: '2026-09-10T08:00:00Z', trasporto_finito_il: '2026-09-18T10:00:00Z', peso_effettivo: 3000, classe: 'A' },
  { id: 'p2', id_ordine: 'ET26152600', stato: 'eseguito', numero_fir: 'FIR A', trasportatore: 'YORK AUTO VUMBACA', punto_di_raccolta: 'Officina Uno', id_pdr: 123, provincia: 'RC', destinazione: 'GATIM', ordine_immesso_il: '2026-09-10T08:00:00Z', trasporto_finito_il: '2026-09-18T10:00:00Z', peso_effettivo: 620, classe: 'M' },
  { id: 'p3', id_ordine: 'ET26000001', stato: 'terminato', trasporto_finito_il: '2026-09-01T10:00:00Z', peso_effettivo: 9000 },
  // senza fine trasporto e senza peso: il peso che manca non e' zero
  { id: 'p4', id_ordine: 'ET26200000', stato: 'Eseguito ', trasportatore: 'ALFA SRL', ordine_immesso_il: '2026-10-01T08:00:00Z' },
  // immesso prima dell'anno da cui parte l'export
  { id: 'p5', id_ordine: 'ET24000009', stato: 'eseguito', trasportatore: 'BETA SRL', ordine_immesso_il: '2024-05-01T08:00:00Z', trasporto_finito_il: '2024-06-10T08:00:00Z', peso_effettivo: 1500 },
];
const PRIMARIE_ACI = [
  { id: 'a1', id_ordine: 'EA26000001', stato: 'eseguito', trasportatore: 'GAMMA SRL', ordine_immesso_il: '2026-10-01T08:00:00Z', trasporto_finito_il: '2026-10-13T09:00:00Z', peso_effettivo: 800, classe: 'PFU Autodemolizione' },
];
const SECONDARIE = [
  { id: 's1', id_ordine: 'ES26000010', stato: 'eseguito', prodotto: 'PFU Autodemolizione', codice_prodotto: '.class9', stoccaggio: 'NAPPI SUD', trasportatore: 'DELTA SRL', ordine_immesso_il: '2026-10-02T08:00:00Z', trasporto_finito_il: '2026-10-04T08:00:00Z', peso_effettivo: 20000 },
  { id: 's2', id_ordine: 'ES26000011', stato: 'eseguito', prodotto: 'P - PFU vettura', stoccaggio: 'NAPPI SUD', trasportatore: 'DELTA SRL', ordine_immesso_il: '2026-10-02T08:00:00Z', trasporto_finito_il: '2026-10-05T08:00:00Z', peso_effettivo: 24000 },
  { id: 's3', id_ordine: 'ES26000012', stato: 'terminato', prodotto: 'P - PFU vettura', trasporto_finito_il: '2026-10-05T08:00:00Z', peso_effettivo: 24000 },
];
const TERZIARIE = [
  { id: 't1', id_ordine: 'ET3T000001', stato: 'eseguito', unita_locale_origine: 'IRIGOM', trasportatore: 'EPSILON SRL', ordine_immesso_il: '2026-10-03T08:00:00Z', trasporto_finito_il: '2026-10-06T08:00:00Z', peso_effettivo: 28000 },
];
const TUTTI = { PrimariaRete: PRIMARIE_RETE, PrimariaAci: PRIMARIE_ACI, Secondaria: SECONDARIE, Terziaria: TERZIARIE };
// Negli archivi lo stato e' sempre minuscolo (lo scrivono cosi' tutte e due le
// strade di caricamento), e la lettura filtra per uguaglianza: sul banco si usa
// l'archivio com'e' davvero. La regola, da sola, riconosce anche «Eseguito ».
const ARCHIVIO_RETE = PRIMARIE_RETE.map(r => ({ ...r, stato: String(r.stato).trim().toLowerCase() }));

await sezione('1. LA REGOLA', async () => {
  const e = R.ordiniEseguiti(TUTTI, { oggi: OGGI });
  verifica('i gruppi, in ordine, un tipo e un canale per volta', J(e.gruppi.map(g => g.chiave)) === J(['primarie_rete', 'primarie_aci', 'secondarie_rete', 'secondarie_aci', 'terziarie_rete']), J(e.gruppi.map(g => g.chiave)));
  const rete = e.gruppi[0];
  verifica('si contano ordini, non righe; i terminati non ci entrano', rete.ordini === 3 && rete.righe === 4, J({ ordini: rete.ordini, righe: rete.righe }));
  verifica('chi aspetta di piu\' in testa, e chi non ha fine trasporto prima di tutti', J(rete.elenco.map(o => o.id_ordine)) === J(['ET26200000', 'ET24000009', 'ET26152600']), J(rete.elenco.map(o => o.id_ordine)));
  const york = rete.elenco.find(o => o.id_ordine === 'ET26152600');
  verifica('un ordine: ID, FIR, raccoglitore, punto di raccolta col PDR, provincia, destinazione', york.numero_fir === 'FIR A' && york.soggetto === 'YORK AUTO VUMBACA' && york.luogo === 'Officina Uno · PDR 123' && york.provincia === 'RC' && york.destinazione === 'GATIM', J(york));
  verifica('i chili delle sue righe sommati, interi', york.kg === 3620 && york.righe === 2, J(york));
  verifica('la fine trasporto sul giorno italiano e da quanti giorni (18/09 -> 14/10: 26)', york.fine_trasporto === '2026-09-18' && york.giorni === 26, J(york));
  verifica('che cosa manca, in parole semplici', york.manca === 'Manca il clic su Chiudi a portale', york.manca);
  const senzaFine = rete.elenco.find(o => o.id_ordine === 'ET26200000');
  verifica('lo stato si riconosce senza maiuscole e spazi; senza peso il peso e\' null, non zero', !!senzaFine && senzaFine.kg === null && senzaFine.fine_trasporto === null && senzaFine.giorni === null, J(senzaFine));
  verifica('senza fine trasporto manca anche quella', /mancano la fine del trasporto e il clic su Chiudi/.test(senzaFine.manca), senzaFine.manca);
  const vecchio = rete.elenco.find(o => o.id_ordine === 'ET24000009');
  verifica('immesso prima dell\'anno da cui parte l\'export: fuori dall\'export, e manca lo stato definitivo', vecchio.fuori_export === true && /stato definitivo/.test(vecchio.manca) && /immesso nel 2024/.test(vecchio.manca) && /parte dal 2025/.test(vecchio.manca), J(vecchio));
  verifica('i chili del gruppo: la somma dei pesi noti', rete.kg === 3620 + 1500, String(rete.kg));
  const aci = e.gruppi[1];
  verifica('ACI a parte: un ordine, fine trasporto ieri', aci.ordini === 1 && aci.elenco[0].giorni === 1 && aci.canale === 'ACI', J(aci.elenco));
  verifica('le secondarie ACI per materiale (classe 9), come la pagina', e.gruppi[3].elenco.map(o => o.id_ordine).join() === 'ES26000010' && e.gruppi[2].elenco.map(o => o.id_ordine).join() === 'ES26000011', J(e.gruppi.slice(2, 4).map(g => g.elenco.map(o => o.id_ordine))));
  verifica('le secondarie dicono lo stoccaggio, le terziarie l\'origine', e.gruppi[2].elenco[0].luogo === 'NAPPI SUD' && e.gruppi[4].elenco[0].luogo === 'IRIGOM', J([e.gruppi[2].elenco[0].luogo, e.gruppi[4].elenco[0].luogo]));
  verifica('tutti gli ID, in ordine', J(e.ids) === J(['ET26200000', 'ET24000009', 'ET26152600', 'EA26000001', 'ES26000011', 'ES26000010', 'ET3T000001']), J(e.ids));
  verifica('tutti letti: nessun archivio da dire', e.non_letti.length === 0);

  // QUELLI FUORI DALL'EXPORT (revisione del 14/10/2026): la spiegazione non
  // promette che spariscano da soli al caricamento dopo, e dice che serve un
  // export che parte dal loro anno.
  verifica('il gruppo sa quanti sono fuori dall\'export e da che anno', rete.fuori_export === 1 && rete.anno_fuori_export === 2024 && rete.anno_inizio === 2025 && aci.fuori_export === 0 && aci.anno_fuori_export === null, J({ rete: [rete.fuori_export, rete.anno_fuori_export, rete.anno_inizio], aci: [aci.fuori_export, aci.anno_fuori_export] }));
  verifica('nessuno fuori dall\'export: la spiegazione di sempre, che promette che spariscono da soli', typeof R.spiegazioneEseguiti === 'function' && R.spiegazioneEseguiti([aci]) === R.SPIEGAZIONE_ESEGUITI && R.fraseFuoriExport([aci]) === '' && /spariscono da soli\.$/.test(R.SPIEGAZIONE_ESEGUITI));
  const misto = typeof R.spiegazioneEseguiti === 'function' ? R.spiegazioneEseguiti(e.gruppi) : '';
  verifica('misti: gli altri spariscono da soli, quello fuori dall\'export vuole un export dal 2024', /spariscono da soli\./.test(misto) && /Fa eccezione quello fuori dall'export: è immesso prima del 2025, l'anno da cui parte l'export di sempre, che non lo riporta, quindi resta «eseguito» anche dopo il Chiudi, finché non si carica un export che parte dal 2024\.$/.test(misto), misto);
  const soloVecchio = R.ordiniEseguiti({ PrimariaRete: [PRIMARIE_RETE[4]] }, { oggi: OGGI });
  const tuttiFuori = typeof R.spiegazioneEseguiti === 'function' ? R.spiegazioneEseguiti(soloVecchio.gruppi) : '';
  verifica('tutti fuori dall\'export: nessuna promessa di sparire da soli, e l\'export che serve', !/spariscono da soli/.test(tuttiFuori) && /Si chiudono a portale\. È immesso prima del 2025, l'anno da cui parte l'export di sempre, che non lo riporta: qui resta «eseguito» anche dopo il Chiudi, finché non si carica un export che parte dal 2024\.$/.test(tuttiFuori), tuttiFuori);
  const tagliato = R.ordiniEseguiti(TUTTI, { oggi: OGGI, massimo: 1 });
  verifica('contati prima di tagliare l\'elenco: la frase c\'e\' anche se l\'ordine non si mostra', tagliato.gruppi[0].elenco.length === 1 && tagliato.gruppi[0].elenco[0].id_ordine === 'ET26200000' && tagliato.gruppi[0].fuori_export === 1 && /Fa eccezione quello fuori dall'export/.test(typeof R.spiegazioneEseguiti === 'function' ? R.spiegazioneEseguiti(tagliato.gruppi) : ''), J(tagliato.gruppi[0].elenco.map(o => o.id_ordine)));
  const terziariaDel2023 = { ...TERZIARIE[0], id: 't9', id_ordine: 'ET3T230001', ordine_immesso_il: '2023-11-02T08:00:00Z', trasporto_finito_il: '2023-11-10T08:00:00Z' };
  const due = R.ordiniEseguiti({ PrimariaRete: [PRIMARIE_RETE[4]], Secondaria: [SECONDARIE[1]], Terziaria: [terziariaDel2023] }, { oggi: OGGI });
  const fraseDue = typeof R.spiegazioneEseguiti === 'function' ? R.spiegazioneEseguiti(due.gruppi) : '';
  verifica('piu\' d\'uno, di anni diversi e in gruppi diversi: quanti, e l\'export dal piu\' vecchio', /spariscono da soli\./.test(fraseDue) && /Fanno eccezione i 2 fuori dall'export: sono immessi prima del 2025, l'anno da cui parte l'export di sempre, che non li riporta, quindi restano «eseguito» anche dopo il Chiudi, finché non si carica un export che parte dal 2023\.$/.test(fraseDue), fraseDue);
  const inBreve = R.ordineInBreve(soloVecchio.gruppi[0].elenco[0]);
  verifica('in breve, l\'ordine fuori dall\'export dice il suo anno di immissione', inBreve === "ET24000009 (fine trasporto 10/06/2024, 856 giorni fa, immesso nel 2024, fuori dall'export)", inBreve);

  const parziale = R.ordiniEseguiti({ PrimariaRete: PRIMARIE_RETE, PrimariaAci: null }, { oggi: OGGI });
  verifica('un archivio non letto non e\' «nessuno»: si dice', J(parziale.non_letti) === J(['Primarie ACI']) && parziale.gruppi.length === 1, J(parziale));
  verifica('un archivio che non si e\' chiesto non si dice', R.ordiniEseguiti({ Secondaria: [] }, { oggi: OGGI }).non_letti.length === 0);
  verifica('nessuno: nessun gruppo', R.ordiniEseguiti({ PrimariaRete: [PRIMARIE_RETE[2]] }, { oggi: OGGI }).gruppi.length === 0);

  // L'esito di UN caricamento: le quote di quel file, nella forma di settembre.
  const prim = R.ordiniEseguiti({ PrimariaRete: PRIMARIE_RETE, PrimariaAci: PRIMARIE_ACI }, { oggi: OGGI });
  const avv = R.avvisoDelCaricamento(prim);
  verifica('l\'avviso del caricamento: rete e ACI separati, coi chili interi e i gruppi', avv.rete.ordini === 3 && avv.aci.ordini === 1 && avv.rete.kg === 5120 && avv.aci.kg === 800 && avv.gruppi.length === 2, J({ rete: avv.rete.ordini, aci: avv.aci.ordini, kg: [avv.rete.kg, avv.aci.kg] }));
  verifica('niente da dire: null', R.avvisoDelCaricamento(R.ordiniEseguiti({ PrimariaRete: [] }, { oggi: OGGI })) === null);
  const reg = R.testoRegistro(prim);
  verifica('il registro: come a settembre, e gli ID in coda', reg.startsWith("rete 3, ACI 1: ordini con tutti i dati ma a portale non e' stato premuto Chiudi") && /primarie rete: ET26200000, ET24000009, ET26152600; primarie ACI: EA26000001/.test(reg), reg);
});

await sezione('2. LO SPECCHIO', async () => {
  const corpo = (p) => {
    const righe = readFileSync(qui('../' + p), 'utf8').replace(/\r\n/g, '\n').split('\n');
    let i = 0;
    while (i < righe.length && (righe[i].startsWith('//') || righe[i].trim() === '')) i++;
    return righe.slice(i).filter(r => !/^import .* from /.test(r)).join('\n').trim();
  };
  const a = corpo('base44/shared/ordiniEseguiti.ts');
  const b = existsSync(qui('../src/lib/ordiniEseguiti.js')) ? corpo('src/lib/ordiniEseguiti.js') : '';
  const dove = a.split('\n').findIndex((r, i) => r !== b.split('\n')[i]);
  verifica('base44/shared/ordiniEseguiti.ts e src/lib/ordiniEseguiti.js hanno lo stesso corpo', a === b, `dalla riga ${dove + 1}`);
});

// ---------------------------------------------------------------------------
// 3. Il caricamento lato server (importEcotyreFile), su un archivio in memoria
// ---------------------------------------------------------------------------
const XLSX = await import('xlsx');
const { SHEET_MAP } = await import('../base44/shared/excelSchemas.ts');
const SDK_SERVER = `
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => (v && typeof v === 'object' && Array.isArray(v.$in) ? v.$in.includes(r[k]) : r[k] === v));
const proietta = (righe, campi) => (Array.isArray(campi) && campi.length ? righe.map(r => Object.fromEntries([...new Set(['id', ...campi])].filter(c => c in r).map(c => [c, r[c]]))) : righe);
let progressivo = 0;
function entita(nome) {
  const righe = () => (globalThis.__DB[nome] ||= []);
  return {
    filter: async (f, _o, lim = 1e9, skip = 0) => { if ((globalThis.__ROTTI || []).includes(nome) && f && f.stato === 'eseguito') throw new Error('lettura non riuscita'); globalThis.__LETTE.push({ nome, f: JSON.stringify(f) }); return righe().filter(r => soddisfa(r, f)).slice(skip, skip + lim).map(r => ({ ...r })); },
    list: async (_o, lim = 1e9, skip = 0, campi = null) => proietta(righe().slice(skip, skip + lim), campi).map(r => ({ ...r })),
    create: async (d) => { const r = { id: nome + '-n' + (++progressivo), created_date: new Date().toISOString(), ...d }; righe().push(r); return { ...r }; },
    update: async (id, d) => { const r = righe().find(x => x.id === id); if (r) Object.assign(r, d); return { ...(r || { id }), ...d }; },
    deleteMany: async (f) => { globalThis.__DB[nome] = f && Object.keys(f).length ? righe().filter(r => !soddisfa(r, f)) : []; return {}; },
    delete: async (id) => { globalThis.__DB[nome] = righe().filter(r => r.id !== id); return {}; },
    bulkCreate: async (a) => { for (const d of a) righe().push({ id: nome + '-n' + (++progressivo), ...d }); return a; },
  };
}
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
const Core = { CreateFileSignedUrl: async ({ file_uri }) => ({ signed_url: 'prova://' + file_uri }) };
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: 'admin', email: 'prova', full_name: 'Prova' }) }, asServiceRole: { entities, integrations: { Core } }, entities, integrations: { Core } };
}`;
async function funzioneServer(nome) {
  const r = await build({
    entryPoints: [qui(`../base44/functions/${nome}/entry.ts`)], bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
    plugins: [{ name: 'finti', setup(b) {
      b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'finto' }));
      b.onLoad({ filter: /.*/, namespace: 'finto' }, () => ({ contents: SDK_SERVER, loader: 'js' }));
      b.onResolve({ filter: /^npm:xlsx/ }, () => ({ path: qui('../node_modules/xlsx/xlsx.mjs') }));
    } }],
  });
  const m = await import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
  return async (db, corpo) => {
    globalThis.__DB = db; globalThis.__LETTE = [];
    const res = await m.default({ json: async () => corpo });
    return { stato: res.status, j: await res.json(), db: globalThis.__DB, lette: globalThis.__LETTE };
  };
}
const FILE = {};
globalThis.fetch = async (url) => {
  const nome = String(url).replace('prova://', '');
  return FILE[nome] ? { ok: true, arrayBuffer: async () => FILE[nome] } : { ok: false, status: 404, statusText: 'non previsto' };
};
const foglio = (tipo, nomeFoglio, righe) => {
  const colonne = Object.keys(SHEET_MAP[tipo].columns);
  const aoa = [colonne, ...righe.map(r => colonne.map(c => (r[c] === undefined ? null : r[c])))];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), nomeFoglio);
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
};
const rigaFile = (id, stato, extra = {}) => ({
  ID: id, Stato: stato, Ordine_immesso_il: '02/10/2026 08:00', Provincia: 'NA', CER: '160103', Quantita_ritirata: 1,
  Peso_effettivo: 20000, Trasportatore: 'DELTA SRL', Tipo_Destinazione: 'imp', Destinazione: 'IRIGOM', Automezzo: 'AA000AA',
  Trasporto_iniziato_il: '04/10/2026 08:00', Trasporto_finito_il: '04/10/2026 12:00', Numero_FIR: 'FIR-' + id, Partner_Operativo: 'SMOCO SRL', ...extra,
});
const ultimoLog = (db, tipo) => [...(db.UploadLog || [])].reverse().find(l => l.tipo_file === tipo) || {};
const idDi = (avviso, chiave) => (((avviso && avviso.gruppi) || []).find(g => g.chiave === chiave) || { elenco: [] }).elenco.map(o => o.id_ordine).sort().join(',');

let importa = null;
await sezione('3. IL CARICAMENTO DELLE SECONDARIE E DELLE TERZIARIE (importEcotyreFile)', async () => {
  importa = await funzioneServer('importEcotyreFile');
  const sec = (id, stato, aci = false) => rigaFile(id, stato, {
    ID_Proprietario_Stoccaggio: 1, ID_Stoccaggio: 2, Stoccaggio: 'NAPPI SUD',
    Prodotto: aci ? 'PFU Autodemolizione' : 'P - PFU vettura', Codice_Prodotto: aci ? '.class9' : 'P',
  });
  // Nell'archivio prima: un «eseguito» degli anni prima che il file non porta.
  const vecchio = { id: 'old-1', id_ordine: 'ES24000001', stato: 'eseguito', prodotto: 'P - PFU vettura', stoccaggio: 'NAPPI SUD', trasportatore: 'DELTA SRL', ordine_immesso_il: '2024-03-01T08:00:00.000Z', trasporto_finito_il: '2024-03-05T08:00:00.000Z', peso_effettivo: 18000 };
  FILE['sec1.xlsx'] = foglio('secondarie', 'SECONDARIE', [sec('ES26000001', 'terminato'), sec('ES26000002', 'eseguito'), sec('ES26000003', 'eseguito', true)]);
  const a = await importa({ Secondaria: [vecchio] }, { file_uri: 'sec1.xlsx', tipo_file: 'secondarie', nome_file: 'SECONDARIE.xlsx' });
  verifica('il caricamento passa', a.stato === 200 && a.j.esito === 'successo', J(a.j).slice(0, 300));
  const av = a.j.avviso_eseguiti;
  verifica('l\'esito dice gli «eseguito» con gli ID: rete (quello del file e quello conservato) e ACI a parte', idDi(av, 'secondarie_rete') === 'ES24000001,ES26000002' && idDi(av, 'secondarie_aci') === 'ES26000003', J(av && av.gruppi && av.gruppi.map(g => [g.chiave, g.elenco.map(o => o.id_ordine)])));
  verifica('nella forma della finestra: rete 2, ACI 1, mai sommati', av && av.rete.ordini === 2 && av.aci.ordini === 1, J(av && { r: av.rete.ordini, a: av.aci.ordini }));
  const delFile = ((av && av.gruppi[0].elenco) || []).find(o => o.id_ordine === 'ES26000002') || {};
  verifica('con lo stoccaggio, il trasportatore, la fine trasporto e che cosa manca', delFile.luogo === 'NAPPI SUD' && delFile.soggetto === 'DELTA SRL' && delFile.fine_trasporto === '2026-10-04' && delFile.manca === 'Manca il clic su Chiudi a portale', J(delFile));
  const conservato = ((av && av.gruppi[0].elenco) || []).find(o => o.id_ordine === 'ES24000001') || {};
  verifica('quello conservato: fuori dall\'export, gli manca lo stato definitivo', conservato.fuori_export === true && /stato definitivo/.test(conservato.manca), J(conservato));
  // L'esito porta il conto di quelli fuori dall'export: sotto la scheda la
  // spiegazione non gli promette di sparire al caricamento dopo.
  const gSec = (av && av.gruppi[0]) || {};
  verifica('e il suo gruppo lo conta, cosi\' sotto la scheda la spiegazione dice l\'export che serve', gSec.fuori_export === 1 && gSec.anno_fuori_export === 2024 && /Fa eccezione quello fuori dall'export: .*export che parte dal 2024\.$/.test(typeof R.spiegazioneEseguiti === 'function' ? R.spiegazioneEseguiti(av.gruppi) : ''), J({ fuori_export: gSec.fuori_export, anno: gSec.anno_fuori_export }));
  verifica('una lettura sola in piu\', filtrata per stato', a.lette.filter(l => /eseguito/.test(l.f)).length === 1 && a.lette.filter(l => /eseguito/.test(l.f))[0].nome === 'Secondaria', J(a.lette));
  const log = ultimoLog(a.db, 'secondarie');
  verifica('il registro li scrive con gli ID', /rete 2, ACI 1: ordini con tutti i dati/.test(log.messaggio) && /ES26000002/.test(log.messaggio) && /ES26000003/.test(log.messaggio) && /ES24000001/.test(log.messaggio), log.messaggio);
  verifica('e restano «eseguito» in archivio, non diventano terminati', a.db.Secondaria.filter(r => r.stato === 'eseguito').length === 3, J(a.db.Secondaria.map(r => [r.id_ordine, r.stato])));

  // IL CARICAMENTO DOPO LI RISOLVE: il portale ha dato lo stato definitivo, e
  // l'export (dal 2024) riporta anche quello vecchio, terminato.
  FILE['sec2.xlsx'] = foglio('secondarie', 'SECONDARIE', [sec('ES26000001', 'terminato'), sec('ES26000002', 'terminato'), sec('ES26000003', 'cancellato', true), { ...sec('ES24000001', 'terminato'), Ordine_immesso_il: '01/03/2024 08:00' }]);
  const b = await importa(a.db, { file_uri: 'sec2.xlsx', tipo_file: 'secondarie', nome_file: 'SECONDARIE.xlsx' });
  verifica('il caricamento dopo li risolve: l\'esito non dice niente', b.stato === 200 && b.j.avviso_eseguiti === null, J(b.j.avviso_eseguiti));
  verifica('e il registro non li nomina piu\'', !/premuto Chiudi/.test(ultimoLog(b.db, 'secondarie').messaggio || ''), ultimoLog(b.db, 'secondarie').messaggio);

  // Senza «eseguito» non si dice niente, nemmeno al primo caricamento.
  FILE['sec3.xlsx'] = foglio('secondarie', 'SECONDARIE', [sec('ES26000001', 'terminato')]);
  const c = await importa({}, { file_uri: 'sec3.xlsx', tipo_file: 'secondarie', nome_file: 'SECONDARIE.xlsx' });
  verifica('nessun eseguito: avviso_eseguiti null', c.stato === 200 && c.j.avviso_eseguiti === null, J(c.j.avviso_eseguiti));

  // LA RILETTURA CHE NON RIESCE: vale il file, e si dice che i conservati non si sono visti.
  globalThis.__ROTTI = ['Secondaria'];
  const d = await importa({ Secondaria: [vecchio] }, { file_uri: 'sec1.xlsx', tipo_file: 'secondarie', nome_file: 'SECONDARIE.xlsx' });
  globalThis.__ROTTI = [];
  verifica('rilettura caduta: gli ID del file, e non_riletti lo dice', d.stato === 200 && idDi(d.j.avviso_eseguiti, 'secondarie_rete') === 'ES26000002' && J(d.j.avviso_eseguiti.non_riletti) === J(['Secondarie']), J(d.j.avviso_eseguiti));

  // LE TERZIARIE.
  const ter = (id, stato) => rigaFile(id, stato, { ID_Impianto: 5, ID_Unita_Locale_Origine: 6, Unita_Locale_Origine: 'IRIGOM', Destinazione: 'BUZZI' });
  FILE['ter1.xlsx'] = foglio('terziarie', 'TERZIARIE', [ter('ET3T000001', 'terminato'), ter('ET3T000002', 'eseguito')]);
  const t = await importa({}, { file_uri: 'ter1.xlsx', tipo_file: 'terziarie', nome_file: 'TERZIARIE.xlsx' });
  verifica('le terziarie: l\'esito dice l\'ID, con l\'origine', t.stato === 200 && idDi(t.j.avviso_eseguiti, 'terziarie_rete') === 'ET3T000002' && t.j.avviso_eseguiti.gruppi[0].elenco[0].luogo === 'IRIGOM', J(t.j.avviso_eseguiti));
  verifica('e il registro lo scrive', /ET3T000002/.test(ultimoLog(t.db, 'terziarie').messaggio || ''), ultimoLog(t.db, 'terziarie').messaggio);
  FILE['ter2.xlsx'] = foglio('terziarie', 'TERZIARIE', [ter('ET3T000001', 'terminato'), ter('ET3T000002', 'terminato')]);
  const t2 = await importa(t.db, { file_uri: 'ter2.xlsx', tipo_file: 'terziarie', nome_file: 'TERZIARIE.xlsx' });
  verifica('al caricamento dopo, chiuso a portale, non c\'e\' piu\'', t2.stato === 200 && t2.j.avviso_eseguiti === null, J(t2.j.avviso_eseguiti));

  // LE PRIMARIE DALLA STRADA LATO SERVER (resta per i file piccoli): rete e ACI.
  const pri = (id, stato, aci = false) => rigaFile(id, stato, { Prodotto: aci ? 'PFU Autodemolizione' : 'A - PFU vettura', Classe: aci ? 'PFU Autodemolizione' : 'A', Punto_di_Raccolta: 'Officina Uno', ID_PDR: 77 });
  FILE['pri1.xlsx'] = foglio('primarie', 'PRIMARIE', [pri('ET26000100', 'terminato'), pri('ET26000101', 'eseguito'), pri('EA26000102', 'eseguito', true)]);
  const p = await importa({}, { file_uri: 'pri1.xlsx', tipo_file: 'primarie', nome_file: 'PRIMARIE.xlsx' });
  verifica('le primarie lato server: rete e ACI nei loro gruppi, col punto di raccolta', p.stato === 200 && idDi(p.j.avviso_eseguiti, 'primarie_rete') === 'ET26000101' && idDi(p.j.avviso_eseguiti, 'primarie_aci') === 'EA26000102' && /Officina Uno · PDR 77/.test(p.j.avviso_eseguiti.gruppi[0].elenco[0].luogo), J(p.j.avviso_eseguiti));
});

// ---------------------------------------------------------------------------
// 4. Il registro delle primarie (importaBlocco, azione registra)
// ---------------------------------------------------------------------------
await sezione('4. IL REGISTRO DELLE PRIMARIE RILEGGE L\'ARCHIVIO (importaBlocco)', async () => {
  const blocco = await funzioneServer('importaBlocco');
  const archivi = Object.fromEntries(['PrimariaRete', 'PrimariaAci', 'Assegnato', 'AssegnatoAci'].map(a => [a, { nome: a, attese: 1, scritte: 1, fallite: 0, archivio: 1, ordini_sbagliati: 0, ordini_in_piu: 0, ordini_mancanti: 0, quadra: true }]));
  const corpo = { azione: 'registra', tipo_file: 'primarie', nome_file: 'PRIMARIE.xlsx', archivi, eseguiti: { rete_ordini: 1, aci_ordini: 0 } };
  const db = { PrimariaRete: ARCHIVIO_RETE.map(r => ({ ...r })), PrimariaAci: PRIMARIE_ACI.map(r => ({ ...r })) };
  const r = await blocco(db, corpo);
  verifica('il registro risponde con gli «eseguito» dell\'archivio', r.stato === 200 && r.j.eseguiti && idDi(r.j.eseguiti, 'primarie_rete') === 'ET24000009,ET26152600,ET26200000' && idDi(r.j.eseguiti, 'primarie_aci') === 'EA26000001', J(r.j).slice(0, 400));
  verifica('due letture, filtrate per stato', r.lette.filter(l => /eseguito/.test(l.f)).map(l => l.nome).sort().join() === 'PrimariaAci,PrimariaRete', J(r.lette));
  const log = ultimoLog(r.db, 'primarie');
  verifica('il messaggio del registro: le quote dell\'archivio e gli ID', /rete 3, ACI 1: ordini con tutti i dati/.test(log.messaggio) && /ET26152600/.test(log.messaggio) && /EA26000001/.test(log.messaggio), log.messaggio);
  // Una lettura che non riesce: vale il conto del browser sul file, come prima.
  globalThis.__ROTTI = ['PrimariaAci'];
  const rotta = await blocco({ PrimariaRete: ARCHIVIO_RETE.map(x => ({ ...x })), PrimariaAci: [] }, corpo);
  globalThis.__ROTTI = [];
  verifica('rilettura caduta: il registro scrive il conto del file', J(rotta.j.eseguiti.non_letti) === J(['Primarie ACI']) && /rete 1: ordini con tutti i dati/.test(ultimoLog(rotta.db, 'primarie').messaggio), ultimoLog(rotta.db, 'primarie').messaggio);
  const vuoto = await blocco({ PrimariaRete: [PRIMARIE_RETE[2]], PrimariaAci: [] }, { ...corpo, eseguiti: undefined });
  verifica('niente «eseguito»: il registro tace', vuoto.j.eseguiti && vuoto.j.eseguiti.gruppi.length === 0 && !/premuto Chiudi/.test(ultimoLog(vuoto.db, 'primarie').messaggio), ultimoLog(vuoto.db, 'primarie').messaggio);

  // Il browser prende quelli dell'archivio, o ripiega sul file.
  const daAlias = (p) => { const base = qui('../src/' + p.slice(2)); return ['', '.js', '.jsx', '.ts'].map(e => base + e).find(f => existsSync(f) && /\.\w+$/.test(f)) || base; };
  const pacchetto = await build({
    stdin: { contents: `export { eseguitiDopoIlCaricamento } from ${J(qui('../src/lib/importGrandeFile.js'))};`, resolveDir: qui('.'), loader: 'js' },
    bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
    plugins: [{ name: 'alias', setup(b) {
      b.onResolve({ filter: /^@\/api\/base44Client$/ }, () => ({ path: 'client', namespace: 'finto' }));
      b.onLoad({ filter: /.*/, namespace: 'finto' }, () => ({ contents: 'export const base44 = { functions: { invoke: async () => ({ data: {} }) }, entities: {} };', loader: 'js' }));
      b.onResolve({ filter: /^(npm:)?xlsx$/ }, () => ({ path: qui('../node_modules/xlsx/xlsx.mjs') }));
      b.onResolve({ filter: /^@\// }, (a) => ({ path: daAlias(a.path) }));
    } }],
  });
  if (typeof globalThis.window === 'undefined') globalThis.window = { self: 1, top: 1 };
  const L = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
  const dalFile = { rete: { ordini: 1, righe: 1, kg: 10, esempi: [{ id_ordine: 'X' }] }, aci: { ordini: 0, righe: 0, kg: 0, esempi: [] } };
  verifica('il browser: dall\'archivio quando e\' riletto tutto', typeof L.eseguitiDopoIlCaricamento === 'function' && idDi(L.eseguitiDopoIlCaricamento(r.j, dalFile), 'primarie_rete') === 'ET24000009,ET26152600,ET26200000');
  verifica('dal file quando la rilettura manca o non e\' completa', L.eseguitiDopoIlCaricamento({ registrato: true }, dalFile) === dalFile && L.eseguitiDopoIlCaricamento(rotta.j, dalFile) === dalFile);
  verifica('nessuno nell\'archivio: null, anche se il file ne contava', L.eseguitiDopoIlCaricamento(vuoto.j, dalFile) === null);
});

// ---------------------------------------------------------------------------
// 5. La dashboard
// ---------------------------------------------------------------------------
await sezione('5. LA VOCE DI «DA GESTIRE» (cruscottoOperativo)', async () => {
  const f = await caricaFunzione('cruscottoOperativo');
  const conEseguiti = { PrimariaRete: ARCHIVIO_RETE, PrimariaAci: PRIMARIE_ACI, Secondaria: SECONDARIE, Terziaria: TERZIARIE };
  const a = await alGiorno(OGGI, () => chiama(f, { db: conEseguiti, ruolo: 'user' }));
  const voci = (a.j.da_gestire || []).filter(v => String(v.chiave || '').startsWith('eseguiti'));
  verifica('una voce sola per tutti i tipi', a.stato === 200 && voci.length === 1, J(a.j.error || voci));
  const v = voci[0] || {};
  verifica('da guardare, non critica: niente allarmi rossi', v.gravita === 'attenzione', v.gravita);
  verifica('il titolo dice ogni gruppo col suo numero, mai la somma', v.titolo === 'Ordini in «eseguito» a portale: primarie rete 3 · primarie ACI 1 · secondarie rete 1 · secondarie ACI 1 · terziarie rete 1', v.titolo);
  verifica('il dettaglio ha gli ID, con la fine trasporto', ['ET26152600 (fine trasporto 18/09/2026, 26 giorni fa)', 'EA26000001', 'ES26000010', 'ES26000011', 'ET3T000001', 'ET26200000 (senza fine trasporto)'].every(x => String(v.dettaglio).includes(x)), v.dettaglio);
  verifica('e dice che cosa vuol dire e che cosa fare', /nessuno ha premuto Chiudi/.test(v.dettaglio) && /spariscono da soli/.test(v.dettaglio), v.dettaglio);
  verifica('e per quello fuori dall\'export l\'anno di immissione e l\'export che serve', String(v.dettaglio).includes("ET24000009 (fine trasporto 10/06/2024, 856 giorni fa, immesso nel 2024, fuori dall'export)") && /Fa eccezione quello fuori dall'export: .*finché non si carica un export che parte dal 2024\./.test(v.dettaglio), v.dettaglio);
  // Il caso della revisione (14/10/2026): solo un ordine fuori dall'export. Con
  // l'export di sempre non sparisce al caricamento dopo, e la voce non lo
  // promette: dice che serve un export che parte dal 2024.
  const fuori = await alGiorno(OGGI, () => chiama(f, { db: { PrimariaRete: [ARCHIVIO_RETE[4]] }, ruolo: 'user' }));
  const vf = (fuori.j.da_gestire || []).find(x => x.chiave === 'eseguiti') || {};
  verifica('solo fuori dall\'export: nessuna promessa di sparire da soli, e l\'export che serve', /^Primarie rete: ET24000009 \(fine trasporto 10\/06\/2024, 856 giorni fa, immesso nel 2024, fuori dall'export\)\. /.test(String(vf.dettaglio)) && !/spariscono da soli/.test(String(vf.dettaglio)) && /finché non si carica un export che parte dal 2024\./.test(String(vf.dettaglio)), vf.dettaglio);
  verifica('il collegamento al modulo', v.link === '/primarie-rete', v.link);
  verifica('chiave, sezione, e la firma che non cambia coi giorni', v.chiave === 'eseguiti' && v.sezione === 'generale' && v.firma === 'eseguiti' && J(v.misure) === '[]' && (v.elementi || []).length === 7, J(v));

  // Nascosta, torna solo per un ordine nuovo: i giorni che crescono non la fanno tornare.
  const domani = R.voceEseguiti(R.ordiniEseguiti(conEseguiti, { oggi: '2026-10-15' }));
  const riga = nascondi(v, OGGI, { giorni: 7 });
  verifica('nascosta: il giorno dopo resta nascosta (i giorni crescono da soli)', percheTorna(riga, domani, '2026-10-15') === null, J(percheTorna(riga, domani, '2026-10-15')));
  const conNuovo = R.voceEseguiti(R.ordiniEseguiti({ ...conEseguiti, Terziaria: [...TERZIARIE, { ...TERZIARIE[0], id: 't2', id_ordine: 'ET3T000009' }] }, { oggi: '2026-10-15' }));
  const torna = percheTorna(riga, conNuovo, '2026-10-15');
  verifica('torna per un ordine nuovo, e dice quale', torna && torna.motivo === 'nome_nuovo' && J(torna.nuovi) === J(['ET3T000009']), J(torna));

  // Il caricamento dopo li risolve: l'archivio non ne ha piu', la voce sparisce.
  const risolti = Object.fromEntries(Object.entries(conEseguiti).map(([k, righe]) => [k, righe.map(r => ({ ...r, stato: 'terminato' }))]));
  const b = await alGiorno(OGGI, () => chiama(f, { db: risolti, ruolo: 'user' }));
  verifica('risolti: la voce non c\'e\' piu\'', b.stato === 200 && !(b.j.da_gestire || []).some(x => String(x.chiave || '').startsWith('eseguiti')), J((b.j.da_gestire || []).map(x => x.chiave)));
  // Solo primarie di rete: la voce sta nella sezione della rete.
  const soloRete = await alGiorno(OGGI, () => chiama(f, { db: { PrimariaRete: ARCHIVIO_RETE }, ruolo: 'user' }));
  const vr = (soloRete.j.da_gestire || []).find(x => x.chiave === 'eseguiti') || {};
  verifica('solo primarie di rete: sezione rete', vr.sezione === 'rete' && vr.link === '/primarie-rete', J(vr));
  // La voce non porta le righe dell'archivio: niente prezzi, niente pesi in giro.
  verifica('la risposta non porta le righe dell\'archivio', !J(a.j).includes('fatturato_trasporto') && !('eseguiti' in a.j), Object.keys(a.j).join());

  // Un archivio che non si legge: niente verde falso.
  verifica('nessuno trovato e un archivio non letto: una voce da sapere che lo dice', (() => { const x = R.voceEseguiti(R.ordiniEseguiti({ PrimariaRete: [], PrimariaAci: null, Secondaria: [], Terziaria: [] }, { oggi: OGGI })); return x && x.gravita === 'info' && /non verificati/.test(x.titolo) && /Primarie ACI/.test(x.dettaglio); })());
  verifica('trovati e un archivio non letto: la voce li dice e nomina quello non letto', /Non letti: Terziarie/.test(R.voceEseguiti(R.ordiniEseguiti({ PrimariaRete: PRIMARIE_RETE, Terziaria: null }, { oggi: OGGI })).dettaglio));
  verifica('nessuno e tutti letti: nessuna voce', R.voceEseguiti(R.ordiniEseguiti({ PrimariaRete: [], PrimariaAci: [], Secondaria: [], Terziaria: [] }, { oggi: OGGI })) === null);
});

// ---------------------------------------------------------------------------
// 6. A video
// ---------------------------------------------------------------------------
await sezione('6. A VIDEO: L\'ESITO SOTTO LA SCHEDA E L\'AVVISO DELLE PAGINE', async () => {
  const daAlias = (p) => { const base = qui('../src/' + p.slice(2)); return ['', '.js', '.jsx', '.ts'].map(e => base + e).find(f => existsSync(f) && /\.\w+$/.test(f)) || base; };
  const INGRESSO = `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import EsitoEseguiti from ${J(qui('../src/components/shared/OrdiniInEseguito.jsx'))};
import AvvisoEseguiti from ${J(qui('../src/components/primarie-rete/AvvisoEseguiti.jsx'))};
export { ordiniEseguiti, avvisoDelCaricamento } from ${J(qui('../src/lib/ordiniEseguiti.js'))};
export { righeDelGruppo } from ${J(qui('../src/lib/ordiniEseguitiExcel.js'))};
export const esito = (avviso) => renderToStaticMarkup(React.createElement(EsitoEseguiti, { avviso }));
export const pagina = (props) => renderToStaticMarkup(React.createElement(AvvisoEseguiti, props));
`;
  const p = await build({
    stdin: { contents: INGRESSO, resolveDir: qui('.'), loader: 'js' }, bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent',
    loader: { '.jsx': 'jsx', '.js': 'jsx' }, define: { 'process.env.NODE_ENV': '"production"' }, external: ['exceljs'],
    plugins: [{ name: 'alias', setup(b) {
      b.onResolve({ filter: /^@\/api\/base44Client$/ }, () => ({ path: 'client', namespace: 'finto' }));
      b.onLoad({ filter: /.*/, namespace: 'finto' }, () => ({ contents: 'export const base44 = { functions: { invoke: async () => ({ data: {} }) } };', loader: 'js' }));
      b.onResolve({ filter: /^@\// }, (a) => ({ path: daAlias(a.path) }));
    } }],
  });
  if (typeof globalThis.window === 'undefined') globalThis.window = { self: 1, top: 1 };
  const L = await import('data:text/javascript;base64,' + Buffer.from(p.outputFiles[0].text).toString('base64'));
  // Le etichette diventano spazi; dentro le parentesi no, come si legge a video.
  const testo = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')').trim();

  const avviso = L.avvisoDelCaricamento(L.ordiniEseguiti({ PrimariaRete: PRIMARIE_RETE, PrimariaAci: PRIMARIE_ACI }, { oggi: OGGI }));
  const e = testo(L.esito(avviso));
  verifica('l\'esito: «N ordini in eseguito» per canale, mai sommati, con gli ID subito in testa', e.includes('Primarie rete: 3 ordini in «eseguito» (ET26200000, ET24000009, ET26152600) · Primarie ACI: 1 ordine in «eseguito» (EA26000001).') && !/4 ordini/.test(e), e.slice(0, 200));
  const tanti = L.avvisoDelCaricamento(L.ordiniEseguiti({ Terziaria: Array.from({ length: 8 }, (_, i) => ({ ...TERZIARIE[0], id: 'tt' + i, id_ordine: 'ET3T00010' + i })) }, { oggi: OGGI }));
  verifica('oltre cinque, in testa i primi cinque e quanti altri', testo(L.esito(tanti)).includes('Terziarie rete: 8 ordini in «eseguito» (ET3T000100, ET3T000101, ET3T000102, ET3T000103, ET3T000104 e altri 3)'), testo(L.esito(tanti)).slice(0, 200));
  verifica('con gli ID e che cosa manca', ['ET26152600', 'ET26200000', 'ET24000009', 'EA26000001', 'Manca il clic su Chiudi a portale', 'fine trasporto 18/09/2026, 26 giorni fa', '3.620 kg'].every(x => e.includes(x)), e);
  verifica('e i due pulsanti: copiare gli ID e scaricarli', e.includes('Copia gli ID') && e.includes('Scarica Excel'), e.slice(-200));
  verifica('niente «eseguito»: niente a video', L.esito(null) === '' && L.esito(L.avvisoDelCaricamento(L.ordiniEseguiti({ PrimariaRete: [] }, { oggi: OGGI }))) === '');
  const caduto = testo(L.esito({ rete: { ordini: 0, righe: 0, kg: 0, esempi: [] }, aci: { ordini: 0, righe: 0, kg: 0, esempi: [] }, gruppi: [], non_riletti: ['Secondarie'] }));
  verifica('rilettura caduta senza eseguiti nel file: lo dice in una riga', /non si è potuto rileggere l'archivio \(Secondarie\)/.test(caduto), caduto);
  const vecchiaForma = testo(L.esito({ rete: { ordini: 1, righe: 1, kg: 3620, esempi: [{ id_ordine: 'ET26152600', numero_fir: 'F', kg: 3620 }] }, aci: { ordini: 0, kg: 0, esempi: [] } }));
  verifica('la forma del file (senza gruppi) si mostra lo stesso, con gli ID', vecchiaForma.includes('Rete: 1 ordine in «eseguito»') && vecchiaForma.includes('ET26152600'), vecchiaForma);

  // Quelli fuori dall'export (revisione del 14/10/2026): in testa all'esito la
  // promessa vale per gli altri, e a lui si dice l'export che serve.
  verifica('l\'esito misto: gli altri spariscono da soli, quello fuori dall\'export no', /spariscono da soli\. Fa eccezione quello fuori dall'export: è immesso prima del 2025/.test(e), e.slice(0, 700));
  const soloVecchio = testo(L.esito(L.avvisoDelCaricamento(L.ordiniEseguiti({ PrimariaRete: [PRIMARIE_RETE[4]] }, { oggi: OGGI }))));
  verifica('l\'esito di un ordine fuori dall\'export: nessuna promessa di sparire da soli, e l\'export che serve', !/spariscono da soli/.test(soloVecchio) && /Primarie rete: 1 ordine in «eseguito» \(ET24000009\)\. Hanno tutti i dati .* Si chiudono a portale\. È immesso prima del 2025, .*finché non si carica un export che parte dal 2024\./.test(soloVecchio), soloVecchio.slice(0, 600));

  // La pagina: la stessa regola e le stesse cose sugli stessi ordini.
  // L'avviso conta i giorni da oggiRoma(): l'orologio sta fermo a OGGI.
  const pagina = (props) => alGiorno(OGGI, () => L.pagina(props));
  const pag = testo(pagina({ righe: PRIMARIE_RETE, canale: 'Rete' }));
  const voci = (h) => [...h.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map(m => testo(m[1]));
  const delleRete = voci(L.esito(avviso)).filter(t => /^ET2/.test(t));
  const dellaPagina = voci(pagina({ righe: PRIMARIE_RETE, canale: 'Rete' }));
  verifica('l\'avviso della pagina ha gli stessi ordini, con le stesse parole, riga per riga', delleRete.length === 3 && J(dellaPagina) === J(delleRete), J({ esito: delleRete, pagina: dellaPagina }));
  verifica('e il suo numero: 3 ordini, 5.120 kg', pag.includes('Rete · 3 ordini hanno tutti i dati') && pag.includes('5.120 kg'), pag.slice(0, 200));
  verifica('una pagina senza eseguiti non mostra niente', pagina({ righe: [PRIMARIE_RETE[2]], canale: 'Rete' }) === '');
  const sec = testo(pagina({ righe: SECONDARIE.filter(r => !/autodemoliz/i.test(r.prodotto || '')), canale: 'Rete', file: 'delle secondarie' }));
  verifica('le secondarie: lo stoccaggio e il file giusto da ricaricare', sec.includes('ES26000011') && sec.includes('NAPPI SUD') && sec.includes('il file delle secondarie') && !sec.includes('ES26000010'), sec);
  const terAci = pagina({ righe: [], canale: 'ACI', file: 'delle terziarie' });
  verifica('le terziarie ACI senza righe: niente', terAci === '');
  // Fuori dall'export, la pagina dice la stessa cosa della dashboard: il file
  // di sempre non basta.
  const pagVecchio = testo(pagina({ righe: [PRIMARIE_RETE[4]], canale: 'Rete' }));
  verifica('la pagina, per un ordine fuori dall\'export: ricaricare il file di sempre non basta, e l\'export che serve', /poi si ricarica il file delle primarie\. È immesso prima del 2025, l'anno da cui parte l'export di sempre, che non lo riporta: qui resta «eseguito» anche dopo il Chiudi, finché non si carica un export che parte dal 2024\./.test(pagVecchio), pagVecchio.slice(0, 500));
  verifica('e la frase c\'e\' anche fra gli altri; senza nessuno fuori dall\'export non si aggiunge niente', /Fa eccezione quello fuori dall'export/.test(pag) && !/export di sempre/.test(sec), pag.slice(0, 600));

  // Il foglio pulito: una riga per ordine, le colonne giuste.
  const g = avviso.gruppi[0];
  const righe = L.righeDelGruppo(g);
  const york = righe.find(r => r[0] === 'ET26152600') || [];
  verifica('il foglio: ID, FIR, raccoglitore, punto di raccolta, date come date, giorni, chili, che cosa manca', york[1] === 'FIR A' && york[2] === 'YORK AUTO VUMBACA' && york[3] === 'Officina Uno · PDR 123' && york[7] instanceof Date && york[7].toISOString().slice(0, 10) === '2026-09-18' && york[8] === 26 && york[9] === 3620 && york[10] === 'Manca il clic su Chiudi a portale', J(york));
  const senza = righe.find(r => r[0] === 'ET26200000') || [];
  verifica('un valore che manca resta vuoto, non zero', senza[7] === null && senza[8] === null && senza[9] === null, J(senza));

  // La pagina Caricamento Dati mostra l'esito a ogni scheda, non solo alle primarie.
  const s = readFileSync(qui('../src/pages/CaricamentoDati.jsx'), 'utf8').replace(/\r/g, '');
  const dentroLeSchede = s.slice(s.indexOf('{TIPI_FILE.map((tipo) => {'), s.indexOf('{/* Log upload */}'));
  verifica('Caricamento Dati: l\'esito degli eseguiti sotto ogni scheda, dalla risposta del caricamento', /<EsitoEseguiti avviso=\{res\.data\.avviso_eseguiti\} \/>/.test(dentroLeSchede) && !/tipo\.key === 'primarie'[^\n]*EsitoEseguiti/.test(dentroLeSchede), '');
});

await sezione('6b. IL FOGLIO DA SCARICARE', async () => {
  const { caricaLibPagine } = await import('./dati/libPagine.mjs');
  const { resolveObjectURL } = await import('node:buffer');
  const X = await caricaLibPagine('lib/ordiniEseguitiExcel');
  const scaricati = [];
  globalThis.document = { body: { appendChild() {} }, createElement: () => ({ click() { scaricati.push({ nome: this.download, blob: resolveObjectURL(this.href) }); }, remove() {} }) };
  try {
    const gruppi = R.ordiniEseguiti(TUTTI, { oggi: OGGI }).gruppi;
    const stato = { letto: true, utente: 'Mario Rossi', archivi: [{ archivio: 'primarie di rete', entita: 'PrimariaRete', dati_fino_al: '2026-10-13', caricato_il: '2026-10-14' }], caricamenti_aperti: [] };
    const nome = await X.scaricaExcelEseguiti(gruppi, { stato, adesso: new Date('2026-10-14T08:00:00Z') });
    verifica('il nome del file dice il giorno', nome === 'Ordini in eseguito 14-10-2026.xlsx' && scaricati.length === 1, nome);
    const modulo = await import('exceljs');
    const ExcelJS = modulo.default || modulo;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await scaricati[0].blob.arrayBuffer()));
    verifica('un foglio per gruppo: ogni canale a parte, mai sommati', J(wb.worksheets.map(w => w.name)) === J(gruppi.map(g => g.nome)), J(wb.worksheets.map(w => w.name)));
    const testoFoglio = (ws) => { const t = []; ws.eachRow(r => r.eachCell(c => t.push(String(c.value instanceof Date ? c.value.toISOString().slice(0, 10) : c.value)))); return t.join(' | '); };
    const rete = testoFoglio(wb.worksheets[0]);
    verifica('la testa del documento: titolo, canale, generato il ... da ...', /Ordini in «eseguito» a portale — Primarie rete/.test(rete) && /Canale: Rete/.test(rete) && /Generato il 14\/10\/2026 .* da Mario Rossi/.test(rete), rete.slice(0, 300));
    verifica('le righe: gli ID, la data di fine trasporto e che cosa manca', /ET26152600/.test(rete) && /2026-09-18/.test(rete) && /Manca il clic su Chiudi a portale/.test(rete) && /ET24000009/.test(rete), rete);
    verifica('il foglio ACI ha solo l\'ACI', /EA26000001/.test(testoFoglio(wb.worksheets[1])) && !/ET26152600/.test(testoFoglio(wb.worksheets[1])), testoFoglio(wb.worksheets[1]));
  } finally {
    delete globalThis.document;
  }
});

// ---------------------------------------------------------------------------
// 7. I dati veri
// ---------------------------------------------------------------------------
await sezione('7. I DATI VERI DELL\'11/10/2026', async () => {
  const CARTELLA = process.env.DATI_VERI || qui('../../dati-veri/');
  const copie = existsSync(CARTELLA) ? readdirSync(CARTELLA).filter(n => /^treadrider-dati-veri-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n)).sort() : [];
  if (!copie.length) { console.log('  (nessuna copia dei dati veri: sezione saltata)'); return; }
  const DATI = JSON.parse(gunzipSync(readFileSync(CARTELLA + copie[copie.length - 1])).toString('utf8'));
  const giorno = String(DATI.meta.letto_fino_al).slice(0, 10);
  const archivi = Object.fromEntries(R.ARCHIVI_CON_ESEGUITI.map(a => [a, DATI.archivi[a] || []]));
  const e = R.ordiniEseguiti(archivi, { oggi: giorno });
  const righe = R.ARCHIVI_CON_ESEGUITI.map(a => `${a} ${archivi[a].length}`).join(', ');
  console.log(`  copia ${copie[copie.length - 1]}: ${righe} righe; in «eseguito»: ${e.gruppi.length ? e.gruppi.map(g => `${g.nome} ${g.ordini} (${g.elenco.map(o => o.id_ordine).join(', ')})`).join(' · ') : 'nessuno'}`);
  verifica('sui dati veri la regola gira su tutti e quattro gli archivi', R.ARCHIVI_CON_ESEGUITI.every(a => Array.isArray(DATI.archivi[a])) && e.non_letti.length === 0);
  if (copie[copie.length - 1] === 'treadrider-dati-veri-2026-10-11.json.gz') {
    verifica('l\'11/10/2026 nessun ordine in «eseguito»: nessuna voce, nessun esito', e.gruppi.length === 0 && R.voceEseguiti(e) === null, J(e.gruppi.map(g => g.chiave)));
  }
});

console.log(`\n${ok} prove superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
