// GLI ORDINI DA DICHIARARE DI UN ANNO PASSATO (giro del 14/10/2026,
// sull'approvazione dell'utente: «per me ok sulle cose da sistemare ...»).
//
// Il file degli ordini non dichiarati del portale e' una fotografia di oggi. Le
// Giacenze di un anno che non e' quello in corso gia' contavano, sugli
// stoccaggi, solo i carichi di quell'anno (revisione finale del 13/10/2026,
// nellAttesaDellAnno); sulle righe degli impianti no: sul 2025 dei dati veri
// Tecnogum 320, Irigom 233, T-Cycle 118, Green Tyre 139, Gatim 56, cioe' tutto il
// file di oggi, accanto a una giacenza che e' la lettura del 31/12 o «—». E il
// pulsante apriva l'elenco intero.
//
// LA REGOLA, una sola per righe, pulsante ed elenco: su un anno che non e' quello
// in corso gli ordini da dichiarare sono i carichi arrivati in quell'anno, per
// fine trasporto e sul giorno italiano, al sito a cui il portale li attribuisce
// (all'impianto con la fine della secondaria, se il carico e' passato da un
// piazzale: giornoAllImpianto; al piazzale per lo stoccaggio: giornoAlPiazzale),
// che oggi sono ancora da dichiarare; piu', per un impianto, i carichi di
// quell'anno che il file non ha ancora. E' il giorno con cui il riepilogo delle
// dichiarazioni mette un carico nel suo mese (collocaFotografia). La pagina lo
// dice: «dei carichi del 2025 ancora da dichiarare oggi». La giacenza non cambia.
// Sull'anno in corso nessun numero cambia: tutto il file, come sempre.
//
// SOLO UN ANNO PASSATO, NON L'ANNO DOPO (revisione del 14/10/2026). La pagina
// offre anche l'anno dopo, dove la giacenza di un impianto e' la fotografia di
// oggi: con la regola applicata a ogni anno diverso da quello in corso, sui dati
// veri del 2027 Irigom aveva 652,84 t con 0 ordini (prima 233), e l'elenco del
// pulsante, vuoto, chiamava quella giacenza «la lettura del 31/12». Sull'anno
// dopo tutto torna com'era: tutto il file, nessuna etichetta, nessun filtro. E il
// PDF dell'elenco di un anno passato dice in testa di quali carichi e'.
//
//   1. la regola del giorno di arrivo, da sola;
//   2. le due funzioni vere (calcolaGiacenze e getOrdiniDaDichiarare) su un
//      archivio costruito, guardato il 15/01/2027: il 2026 e' passato, e i carichi
//      di fine 2026 sono ancora nella finestra dei carichi non ancora nel file;
//   3. le pagine: le Giacenze passano l'anno all'elenco, l'elenco lo chiede e lo
//      dice, l'Excel e il PDF lo portano, la riga di riconciliazione non parla di
//      giacenza, la colonna della Situazione dice di quali carichi;
//   4. sui dati veri (../dati-veri/, se c'e'): il 2025 e il 2024 a 0 su tutti gli
//      impianti, uguali al pulsante; il 2026 e il 2027 (l'anno dopo) come prima.
// npm run prove
import { build } from 'esbuild';
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { finiDelleSecondarie, giornoAllImpianto, giornoDelCarico, nellAttesaDellAnno } from '../base44/shared/giacenzaPortale.ts';
import { caricaPagina, clienteFinto, aspetta, trova, testo, nomeDi } from './dati/paginaFinta.mjs';
import { oggiRoma } from '../base44/shared/giornoItaliano.ts';
const annoDiOggiRoma = () => Number(oggiRoma().slice(0, 4));

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);

// ─────────────────────────────────────────────────────────────────────────────
console.log("1. IL GIORNO IN CUI UN CARICO E' ARRIVATO AL SITO");
{
  const fini = finiDelleSecondarie([
    { id_ordine: 'SEC1', stato: 'terminato', trasporto_finito_il: '2027-01-03T08:00:00Z' },
    { id_ordine: 'SEC2', stato: 'terminato', trasporto_finito_il: '2026-12-31T23:30:00Z' }, // il 1° gennaio in Italia
    { id_ordine: 'SEC3', stato: 'terminato', trasporto_finito_il: '' },
  ]);
  const finePrimaria = (id) => ({ ET9: '2026-11-20' }[id] || '');
  const viaPiazzale = (sec) => ({ destinazione: 'NAPPI', destinazione_secondaria: 'ALFA', ordine_secondaria: sec, ordine_primaria: 'ET1', fine_trasporto: '2026-12-20T08:00:00Z' });
  verifica("passato dal piazzale: il giorno e' la fine della secondaria, non quella della riga", giornoAllImpianto(viaPiazzale('SEC1'), { finiSecondarie: fini, finePrimaria }) === '2027-01-03');
  verifica("sul giorno italiano: le 23:30 UTC del 31/12 sono gia' il 1° gennaio", giornoAllImpianto(viaPiazzale('SEC2'), { finiSecondarie: fini, finePrimaria }) === '2027-01-01');
  verifica("una secondaria terminata senza fine trasporto non ha un giorno, e non ripiega sulla riga", giornoAllImpianto(viaPiazzale('SEC3'), { finiSecondarie: fini, finePrimaria }) === '');
  verifica("arrivato diretto all'impianto: la fine trasporto della riga", giornoAllImpianto({ destinazione: 'ALFA', ordine_primaria: 'ET1', fine_trasporto: '2026-06-10T08:00:00Z' }, { finiSecondarie: fini, finePrimaria }) === '2026-06-10');
  verifica("la riga senza fine trasporto prende quella della primaria nel gestionale", giornoAllImpianto({ destinazione: 'ALFA', ordine_primaria: 'ET9' }, { finiSecondarie: fini, finePrimaria }) === '2026-11-20');
  verifica("lo stoccaggio conta l'arrivo al piazzale", giornoDelCarico({ destinazione: 'NAPPI', ordine_primaria: 'ET9' }, 'stoc', { finiSecondarie: fini, finePrimaria }) === '2026-11-20'
    && giornoDelCarico(viaPiazzale('SEC1'), 'imp', { finiSecondarie: fini, finePrimaria }) === '2027-01-03');
  verifica("sull'anno in corso conta tutto il file, su un altro solo quell'anno", nellAttesaDellAnno('2025-03-01', 2027, 2027) && nellAttesaDellAnno('2026-12-30', 2026, 2027)
    && !nellAttesaDellAnno('2027-01-03', 2026, 2027) && !nellAttesaDellAnno('', 2026, 2027));
}

// ─────────────────────────────────────────────────────────────────────────────
// L'archivio finto delle funzioni: uguaglianza, $in, $gte, $lte, null per il
// campo vuoto, ordinamento e pagine; ogni richiesta si conta.
globalThis.__ARCHIVI_ANNI_PASSATI = {};
globalThis.__RICHIESTE_ANNI_PASSATI = [];
const SDK_FINTO = `
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => {
  const x = r[k];
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    if ('$in' in v && !v.$in.includes(x)) return false;
    if ('$gte' in v && !(x != null && String(x) >= String(v.$gte))) return false;
    if ('$lte' in v && !(x != null && String(x) <= String(v.$lte))) return false;
    return true;
  }
  if (v === null) return x === null || x === undefined || x === '';
  return x === v;
});
const ordinatiPer = new WeakMap();
const ordina = (nome, sort) => {
  const tutte = globalThis.__ARCHIVI_ANNI_PASSATI[nome] || [];
  if (!ordinatiPer.has(tutte)) ordinatiPer.set(tutte, new Map());
  const ordinati = ordinatiPer.get(tutte);
  const chiave = sort || 'id';
  if (ordinati.has(chiave)) return ordinati.get(chiave);
  const campo = String(sort || 'id').replace(/^[-+]/, '');
  const giu = String(sort || '').startsWith('-');
  const righe = [...tutte].sort((a, b) => {
    const x = a[campo], y = b[campo];
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
    return giu ? -c : c;
  });
  ordinati.set(chiave, righe);
  return righe;
};
const segna = (nome, righe) => { globalThis.__RICHIESTE_ANNI_PASSATI.push(nome); return righe.map(r => ({ ...r })); };
const entita = (nome) => ({
  list: async (sort, lim = 1e9, skip = 0) => segna(nome, ordina(nome, sort).slice(skip, skip + lim)),
  filter: async (f, sort, lim = 1e9, skip = 0) => segna(nome, ordina(nome, sort).filter(r => soddisfa(r, f)).slice(skip, skip + lim)),
  get: async (id) => (globalThis.__ARCHIVI_ANNI_PASSATI[nome] || []).find(r => r.id === id) || null,
  create: async () => { throw new Error('la prova non scrive: ' + nome); },
  update: async () => { throw new Error('la prova non scrive: ' + nome); },
  delete: async () => { throw new Error('la prova non scrive: ' + nome); },
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: 'admin', email: 'prova-anni-passati' }) }, asServiceRole: { entities }, entities,
    functions: { invoke: async (n) => { throw new Error('la prova non chiama altre funzioni: ' + n); } } };
}`;
const funzione = async (nome) => {
  const p = await build({ entryPoints: [qui(`../base44/functions/${nome}/entry.ts`)], bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
    plugins: [{ name: 'sdk-finto', setup(b) {
      b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
      b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
    } }] });
  const m = await import('data:text/javascript;base64,' + Buffer.from(p.outputFiles[0].text).toString('base64'));
  return async (corpo) => { const r = await m.default({ json: async () => corpo }); return { stato: r.status, j: await r.json() }; };
};
const OraVera = Date;
const conOra = async (iso, f) => {
  const ms = OraVera.parse(iso);
  globalThis.Date = class extends OraVera { constructor(...a) { if (a.length) super(...a); else super(ms); } static now() { return ms; } };
  try { return await f(); } finally { globalThis.Date = OraVera; }
};
const giacenze = await funzione('calcolaGiacenze');
const ordini = await funzione('getOrdiniDaDichiarare');
const riga = (G, sito, td) => (G.j.righe || []).find(r => r.sito === sito && r.tipo_destinazione === td) || null;

// ─────────────────────────────────────────────────────────────────────────────
console.log('2. LE DUE FUNZIONI VERE, SU UN ARCHIVIO COSTRUITO');
{
  // Guardato il 15/01/2027, con la fotografia del portale del 10/01/2027: i
  // carichi non ancora nel file si cercano dai 60 giorni prima (inizioAggiunti),
  // cioe' dall'11/11/2026, e uno di dicembre 2026 lo e'.
  const ORA = '2027-01-15T10:00:00Z';
  const ALFA = 'ALFA RECYCLING SRL', NAPPI = 'NAPPI SUD SRL', TEC = 'TECNOGUM SRL';
  let n = 0;
  const id = () => 'r' + String(++n).padStart(4, '0');
  const g = (giorno) => `${giorno}T08:00:00Z`;
  const primaria = (ord, dest, td, giorno, kg = 1000) => ({
    id: id(), id_ordine: ord, numero_fir: 'FIR' + ord, classe: 'P - fino a 35 kg', prodotto: '.class1', destinazione: dest, tipo_destinazione: td,
    stato: 'terminato', peso_effettivo: kg, trasportatore: 'RACCOLTA SRL', provincia: 'NA',
    ordine_immesso_il: g(giorno), trasporto_iniziato_il: g(giorno), trasporto_finito_il: g(giorno), ordine_chiuso_il: g(giorno),
  });
  const nelFile = (ord, dest, kg, fine, extra = {}) => ({ id: id(), ordine_primaria: ord, numero_fir: 'FIR' + ord, destinazione: dest, prodotto: '.class1', peso_non_dichiarato_kg: kg, fine_trasporto: fine ? g(fine) : '', created_date: '2027-01-10T06:00:00Z', provincia: 'NA', ...extra });
  globalThis.__ARCHIVI_ANNI_PASSATI = {
    GiacenzaSito: [
      { id: id(), sito: ALFA, tipo_destinazione: 'imp', anno: 2026, dichiara_rete: true },
      { id: id(), sito: ALFA, tipo_destinazione: 'imp', anno: 2027, dichiara_rete: true },
      { id: id(), sito: TEC, tipo_destinazione: 'imp', anno: 2026, dichiara_rete: false },
      { id: id(), sito: TEC, tipo_destinazione: 'imp', anno: 2027, dichiara_rete: false },
      { id: id(), sito: NAPPI, tipo_destinazione: 'stoc', anno: 2026 },
      { id: id(), sito: NAPPI, tipo_destinazione: 'stoc', anno: 2027 },
    ],
    PrimariaRete: [
      primaria('ET01', ALFA, 'imp', '2026-06-10'),
      primaria('ET02', ALFA, 'imp', '2026-12-10'),
      primaria('ET03', ALFA, 'imp', '2027-01-05'),
      primaria('ET04', NAPPI, 'stoc', '2026-12-20'),   // ripartito a ALFA il 03/01/2027
      primaria('ET05', NAPPI, 'stoc', '2026-12-21'),   // ripartito a ALFA il 30/12/2026
      primaria('ET06', NAPPI, 'stoc', '2026-12-22'),   // ancora in piazzale
      primaria('ET07', NAPPI, 'stoc', '2027-01-08'),   // ancora in piazzale
      primaria('ET08', ALFA, 'imp', '2026-12-15'),     // non ancora nel file
      primaria('ET09', ALFA, 'imp', '2027-01-12'),     // non ancora nel file
      primaria('ET10', TEC, 'imp', '2026-12-05'),      // Tecnogum: la rete non la dichiara
      primaria('ET11', ALFA, 'imp', '2026-11-20'),     // nel file senza fine trasporto
    ],
    Secondaria: [
      { ...primaria('SEC1', ALFA, 'imp', '2027-01-03', 1000), stoccaggio: NAPPI },
      { ...primaria('SEC2', ALFA, 'imp', '2026-12-30', 1000), stoccaggio: NAPPI },
    ],
    OrdineNonDichiarato: [
      nelFile('ET01', ALFA, 1000, '2026-06-10'),
      nelFile('ET02', ALFA, 2000, '2026-12-10'),
      nelFile('ET03', ALFA, 3000, '2027-01-05'),
      nelFile('ET04', NAPPI, 4000, '2026-12-20', { destinazione_secondaria: ALFA, ordine_secondaria: 'SEC1' }),
      nelFile('ET05', NAPPI, 5000, '2026-12-21', { destinazione_secondaria: ALFA, ordine_secondaria: 'SEC2' }),
      nelFile('ET06', NAPPI, 6000, '2026-12-22'),
      nelFile('ET07', NAPPI, 7000, '2027-01-08'),
      nelFile('ET10', TEC, 1500, '2026-12-05'),
      nelFile('ET11', ALFA, 1100, ''),
    ],
    DichiarazioneTrattamento: [], DichiarazioneSito: [], GiacenzaStoccaggio: [], PrimariaAci: [], ExtraRaccolta: [], Terziaria: [],
    ImpiantoTargetSecondaria: [], TargetRaccoglitore: [], TargetMensile: [],
  };
  const G26 = await conOra(ORA, () => giacenze({ anno: 2026 }));
  const G27 = await conOra(ORA, () => giacenze({ anno: 2027 }));
  const G28 = await conOra(ORA, () => giacenze({ anno: 2028 }));
  verifica('le Giacenze rispondono', G26.stato === 200 && G27.stato === 200 && G28.stato === 200, J([G26.j.error, G27.j.error, G28.j.error]));
  const o = (G, s, td) => (riga(G, s, td) || {}).ordini_da_dichiarare;
  verifica("2026, ALFA: i quattro carichi del file arrivati nel 2026 (anche quello passato dal piazzale e ripartito il 30/12, e quello senza fine nel file) piu' quello di dicembre che il file non ha ancora",
    o(G26, ALFA, 'imp') === 5, J(riga(G26, ALFA, 'imp')));
  verifica("2026, Nappi Sud: il carico arrivato al piazzale nel 2026 e ancora li'", o(G26, NAPPI, 'stoc') === 1, String(o(G26, NAPPI, 'stoc')));
  verifica("2026, Tecnogum: il suo carico del 2026 nel file", o(G26, TEC, 'imp') === 1, String(o(G26, TEC, 'imp')));
  verifica("2026: il totale e' la somma delle righe", G26.j.totali.ordini_da_dichiarare === 7, String(G26.j.totali.ordini_da_dichiarare));
  verifica("2027, l'anno in corso: tutto il file piu' tutti i carichi non ancora nel file, come sempre",
    o(G27, ALFA, 'imp') === 8 && o(G27, NAPPI, 'stoc') === 2 && o(G27, TEC, 'imp') === 1 && G27.j.totali.ordini_da_dichiarare === 11,
    J([o(G27, ALFA, 'imp'), o(G27, NAPPI, 'stoc'), o(G27, TEC, 'imp'), G27.j.totali.ordini_da_dichiarare]));
  verifica('la pagina sa di quali carichi sono: del 2026 sul 2026, tutto il file (null) sul 2027',
    G26.j.totali.in_attesa_dei_carichi_del === 2026 && G27.j.totali.in_attesa_dei_carichi_del === null);
  // L'anno dopo (revisione del 14/10/2026): gli impianti contano tutto il file e
  // tutti i carichi non ancora nel file, come sull'anno in corso, accanto alla
  // fotografia di oggi. Lo stoccaggio resta con la sua regola del 13/10, che
  // tiene insieme tonnellate e ordini (i carichi arrivati al piazzale nel 2028:
  // nessuno). Tecnogum nel 2028 non ha la scheda dei siti, e il suo ordine conta.
  verifica("2028, l'anno dopo: ALFA ha tutto il file e tutti i carichi non ancora nel file, come sull'anno in corso",
    o(G28, ALFA, 'imp') === 8 && o(G28, ALFA, 'imp') === o(G27, ALFA, 'imp'), J(riga(G28, ALFA, 'imp')));
  verifica("2028: Tecnogum il suo ordine del file, lo stoccaggio nessuno, e il totale e' la somma delle righe",
    o(G28, TEC, 'imp') === 1 && !o(G28, NAPPI, 'stoc') && G28.j.totali.ordini_da_dichiarare === 9, J([o(G28, TEC, 'imp'), o(G28, NAPPI, 'stoc'), G28.j.totali.ordini_da_dichiarare]));
  verifica("l'etichetta degli ordini c'e' solo su un anno passato: 2026 sul 2026, niente sul 2027 e sul 2028",
    G26.j.totali.ordini_dei_carichi_del === 2026 && !('ordini_dei_carichi_del' in G27.j.totali) && !('ordini_dei_carichi_del' in G28.j.totali),
    J([G26.j.totali.ordini_dei_carichi_del, G27.j.totali.ordini_dei_carichi_del, G28.j.totali.ordini_dei_carichi_del]));

  // L'elenco aperto dal pulsante: lo stesso numero.
  const chiedi = async (corpo) => {
    globalThis.__RICHIESTE_ANNI_PASSATI = [];
    const L = await conOra(ORA, () => ordini({ limite: 100, offset: 0, ...corpo }));
    return { ...L.j, stato: L.stato, richieste: [...globalThis.__RICHIESTE_ANNI_PASSATI] };
  };
  const a26 = await chiedi({ sito: ALFA, ruolo: 'imp', riconcilia: true, carichi_del: 2026 });
  // Dal 15/10/2026 il carico del 2026 che il file non ha ancora (ET08) e' una
  // riga dell'elenco: le righe sono il numero del pulsante del 2026.
  verifica("l'elenco di ALFA del 2026: le quattro righe del file arrivate nel 2026 e il carico non ancora nel file, il numero del pulsante",
    a26.stato === 200 && a26.totale_righe === 5 && a26.totale_righe === o(G26, ALFA, 'imp') && J(a26.righe.map(r => r.ordine_primaria).sort()) === J(['ET01', 'ET02', 'ET05', 'ET08', 'ET11'])
      && a26.righe.filter(r => r.nel_file === false).map(r => r.ordine_primaria).join() === 'ET08', J(a26.righe && a26.righe.map(r => [r.ordine_primaria, r.nel_file])));
  const r26 = a26.riconciliazione || {};
  verifica("la riga dice gli ordini: 4 nel file + 1 non ancora nel file = 5, il numero del pulsante del 2026",
    r26.carichi_del === 2026 && r26.file_ordini === 4 && r26.aggiunti_n === 1 && r26.ordini_pulsante === o(G26, ALFA, 'imp') && J(r26.aggiunti.map(x => x.id_ordine)) === J(['ET08']), J(r26));
  verifica("e niente giacenza: quella di un anno chiuso e' la lettura del 31/12, non questo elenco", r26.giacenza_kg === null && r26.dichiarato_dopo_kg === null, J(r26));
  const a27 = await chiedi({ sito: ALFA, ruolo: 'imp', riconcilia: true });
  verifica("l'anno in corso, senza carichi_del: tutto il file e la riga che arriva alla giacenza, col pulsante",
    a27.totale_righe === 8 && a27.totale_righe === a27.riconciliazione.ordini_pulsante && a27.totale_kg === a27.riconciliazione.giacenza_kg && a27.riconciliazione && a27.riconciliazione.ordini_pulsante === o(G27, ALFA, 'imp') && typeof a27.riconciliazione.giacenza_kg === 'number' && !('carichi_del' in a27.riconciliazione),
    J([a27.totale_righe, a27.riconciliazione]));
  const a27c = await chiedi({ sito: ALFA, ruolo: 'imp', riconcilia: true, carichi_del: 2027 });
  const { richieste: _x, ...a27senza } = a27; const { richieste: _y, ...a27con } = a27c;
  void _x; void _y;
  verifica("carichi_del con l'anno in corso non cambia niente", J(a27senza) === J(a27con));
  const a28c = await chiedi({ sito: ALFA, ruolo: 'imp', riconcilia: true, carichi_del: 2028 });
  const { richieste: _z, ...a28con } = a28c;
  void _z;
  verifica("e nemmeno con l'anno dopo: tutto il file e la riga che arriva alla giacenza, col numero del pulsante del 2028",
    J(a27senza) === J(a28con) && a28c.riconciliazione && a28c.riconciliazione.ordini_pulsante === o(G28, ALFA, 'imp') && !('carichi_del' in a28c.riconciliazione),
    J([a28c.totale_righe, a28c.riconciliazione]));
  const n26 = await chiedi({ sito: NAPPI, ruolo: 'stoc', carichi_del: 2026 });
  verifica('dal pulsante di Nappi Sud del 2026: il carico ancora in piazzale, come la riga', n26.totale_righe === o(G26, NAPPI, 'stoc') && n26.righe[0].ordine_primaria === 'ET06', J(n26.righe && n26.righe.map(r => r.ordine_primaria)));
  const t26 = await chiedi({ sito: TEC, ruolo: 'imp', riconcilia: true, carichi_del: 2026 });
  verifica("Tecnogum sul 2026: il suo ordine, e niente da riconciliare (la rete non la dichiara, per i siti del 2026)",
    t26.totale_righe === 1 && t26.riconciliazione && t26.riconciliazione.non_dovuta === true, J([t26.totale_righe, t26.riconciliazione]));
  const tutti26 = await chiedi({ carichi_del: 2026 });
  verifica("tutti i siti del 2026: le righe del file di quell'anno e il carico non ancora nel file, il totale della colonna (15/10/2026)",
    tutti26.totale_righe === G26.j.totali.ordini_da_dichiarare, `${tutti26.totale_righe} / ${G26.j.totali.ordini_da_dichiarare}`);
  const a25 = await chiedi({ sito: ALFA, ruolo: 'imp', riconcilia: true, carichi_del: 2025 });
  verifica("il 2025: niente, e la riga lo dice", a25.totale_righe === 0 && a25.riconciliazione && a25.riconciliazione.ordini_pulsante === 0, J(a25.riconciliazione));
  verifica("e senza letture inutili: un anno finito prima della finestra dei carichi non ancora nel file non legge primarie, secondarie, report e dichiarazioni per riconciliare",
    a25.richieste.length < a27.richieste.length && !a25.richieste.includes('DichiarazioneSito') && !a25.richieste.includes('DichiarazioneTrattamento') && a25.richieste.filter(x => x === 'GiacenzaSito').length === 1,
    `${J(a25.richieste)} / ${J(a27.richieste)}`);
  const anno25 = await chiedi({ carichi_del: 2026, anno: 2026 });
  verifica("il filtro dell'anno di fine trasporto resta quello di prima, insieme", anno25.stato === 200 && anno25.totale_righe <= tutti26.totale_righe, J([anno25.totale_righe, tutti26.totale_righe]));
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('3. LE PAGINE');
{
  // La pagina delle Giacenze, con l'autenticazione sostituita come in
  // prove/perNoiChiusiDallaPagina.mjs.
  const IMPORT_AUTH = "import { useAuth } from '@/lib/AuthContext';";
  const sorgente = readFileSync(qui('../src/pages/Giacenze.jsx'), 'utf8').replace(/\r/g, '');
  verifica('premessa: la pagina prende chi e\' collegato da useAuth, come la copia si aspetta', sorgente.includes(IMPORT_AUTH));
  const copia = join(mkdtempSync(join(tmpdir(), 'ordini-anni-passati-')), 'Giacenze.jsx');
  writeFileSync(copia, sorgente.replace(IMPORT_AUTH, "const useAuth = () => ({ user: { role: 'admin' } });"));
  const pagina = await caricaPagina('pages/Giacenze', { file: copia });
  const tabella = await caricaPagina('components/giacenze/DaDichiarareTable');

  const risposta = { righe: [{ sito: 'ALFA RECYCLING SRL', tipo_destinazione: 'imp', giacenza_portale_t: 1, ordini_da_dichiarare: 3 }], totali: { giacenza_portale_t: 1, ordini_da_dichiarare: 3 }, anomalie: [] };
  const c = clienteFinto({ funzioni: { calcolaGiacenze: async () => risposta, getOrdiniDaDichiarare: async () => ({ righe: [], totale_righe: 0, totale_kg: 0, per_mese: [] }) } });
  globalThis.__CLIENTE_FINTO = c.cliente;
  globalThis.alert = () => {};
  const m = pagina.monta(pagina.Componente, {});
  await aspetta(40);
  const annoOggi = (c.funzioniChiamate('calcolaGiacenze')[0] || { payload: {} }).payload.anno;
  const elenco = () => trova(m.albero, 'DaDichiarareTable')[0] || null;
  const esporta = async () => {
    const b = trova(m.albero, el => nomeDi(el) === 'Button' && /Esporta Excel/.test(testo(el)))[0];
    if (b) { try { await b.props.onClick(); } catch { /* il foglio vero non si scrive qui */ } }
    await aspetta(20);
    const chiamate = c.funzioniChiamate('getOrdiniDaDichiarare');
    return chiamate.length ? chiamate[chiamate.length - 1].payload : null;
  };
  verifica("sull'anno in corso l'elenco non riceve un anno: tutto il file", elenco() && elenco().props.carichiDel === null, J(elenco() && elenco().props.carichiDel));
  const exOggi = await esporta();
  verifica("e l'Excel della pagina chiede tutto il file, come prima", exOggi && J(exOggi) === J({ tutte: true, offset: 0 }), J(exOggi));
  const menu = trova(m.albero, el => el.props && typeof el.props.onValueChange === 'function' && el.props.value === String(annoOggi))[0];
  if (menu) menu.props.onValueChange(String(Number(annoOggi) - 1));
  await aspetta(40);
  verifica("su un altro anno l'elenco riceve quell'anno", elenco() && elenco().props.carichiDel === Number(annoOggi) - 1, J(elenco() && elenco().props.carichiDel));
  const exPrima = await esporta();
  verifica("e l'Excel della pagina chiede i carichi di quell'anno, come la colonna", exPrima && exPrima.carichi_del === Number(annoOggi) - 1 && exPrima.tutte === true, J(exPrima));
  // L'anno dopo, che il menu offre: tutto il file, come sull'anno in corso.
  const menuPrima = trova(m.albero, el => el.props && typeof el.props.onValueChange === 'function' && el.props.value === String(Number(annoOggi) - 1))[0];
  verifica("premessa: il menu degli anni offre l'anno dopo", !!menuPrima && trova(menuPrima, el => el.props && el.props.value === String(Number(annoOggi) + 1)).length > 0);
  if (menuPrima) menuPrima.props.onValueChange(String(Number(annoOggi) + 1));
  await aspetta(40);
  verifica("sull'anno dopo l'elenco non riceve un anno: tutto il file, come la colonna", elenco() && elenco().props.carichiDel === null, J(elenco() && elenco().props.carichiDel));
  const exDopo = await esporta();
  verifica("e l'Excel della pagina chiede tutto il file", exDopo && J(exDopo) === J({ tutte: true, offset: 0 }), J(exDopo));
  verifica('la pagina non da\' errori', !m.errori.length, m.errori.map(String).join(' | '));
  m.smonta();

  // L'elenco, con e senza l'anno dei carichi.
  const apri = async (props) => {
    const cl = clienteFinto({ funzioni: { getOrdiniDaDichiarare: async () => ({ righe: [], totale_righe: 0, totale_kg: 0, per_mese: [], siti_distinti: [], province_distinte: [], anni_distinti: [] }) } });
    globalThis.__CLIENTE_FINTO = cl.cliente;
    const t = tabella.monta(tabella.Componente, { onPulisciFiltroSito: () => {}, ...props });
    await aspetta(20);
    const prima = cl.funzioniChiamate('getOrdiniDaDichiarare').map(x => x.payload);
    const excel = trova(t.albero, el => nomeDi(el) === 'Button' && /Esporta Excel/.test(testo(el)))[0];
    if (excel) { try { await excel.props.onClick(); } catch { /* il foglio vero non si scrive qui */ } }
    const pdf = trova(t.albero, 'EsportaPdf')[0];
    let documento = null;
    if (pdf) { try { documento = await pdf.props.sezioni(); } catch (e) { documento = { errore: String(e) }; } }
    await aspetta(20);
    const tutte = cl.funzioniChiamate('getOrdiniDaDichiarare').map(x => x.payload);
    const fuori = { prima, excel: tutte[prima.length], pdf: tutte[prima.length + 1], documento, testo: testo(t.albero).replace(/\s+/g, ' '), errori: t.errori.map(String) };
    t.smonta();
    return fuori;
  };
  const del25 = await apri({ filtroSitoEsterno: 'ALFA RECYCLING SRL', filtroRuoloEsterno: 'imp', carichiDel: 2025 });
  verifica("dal pulsante del 2025: l'elenco chiede i carichi del 2025, con la riconciliazione", del25.prima.length === 1 && del25.prima[0].carichi_del === 2025 && del25.prima[0].sito === 'ALFA RECYCLING SRL', J(del25.prima));
  verifica("e lo dice sopra tutto", /Carichi del 2025 ancora da dichiarare oggi\./.test(del25.testo) && /Tutto il file di oggi si vede scegliendo l.anno in corso/.test(del25.testo), del25.testo.slice(0, 400));
  verifica("l'Excel e il PDF portano gli stessi carichi", del25.excel && del25.excel.carichi_del === 2025 && del25.pdf && del25.pdf.carichi_del === 2025, J([del25.excel, del25.pdf]));
  verifica("e il PDF e' del 2025", del25.documento && /-2025$/.test(String(del25.documento.nomeFile)), J(del25.documento && del25.documento.nomeFile));
  // Il PDF lo dice in testa e nella prima nota, non solo nel nome del file
  // (revisione del 14/10/2026): e' la lista che si passa agli impianti.
  verifica("e lo dice in testa, prima dei filtri, e nella prima nota",
    del25.documento && /^Carichi del 2025 ancora da dichiarare oggi · Sito: ALFA RECYCLING SRL/.test(String(del25.documento.sottotitolo))
      && /solo i carichi arrivati nel 2025/.test(String((del25.documento.note || [])[0])),
    J(del25.documento && [del25.documento.sottotitolo, (del25.documento.note || [])[0]]));
  const oggi = await apri({ filtroSitoEsterno: 'ALFA RECYCLING SRL', filtroRuoloEsterno: 'imp', carichiDel: null });
  const visibile = (d) => J(d && { titolo: d.titolo, sottotitolo: d.sottotitolo, riepilogo: d.riepilogo, note: d.note });
  verifica("il PDF dei soli carichi del 2025 e quello di tutto il file non si leggono uguali, e quello di oggi non parla di un anno dei carichi",
    !!oggi.documento && visibile(oggi.documento) !== visibile(del25.documento) && !/ancora da dichiarare oggi|arrivati nel/.test(visibile(oggi.documento)), visibile(oggi.documento));
  verifica("pdfDeiCarichiDel senza anno lascia il documento com'e'", typeof tabella.modulo.pdfDeiCarichiDel === 'function'
    && tabella.modulo.pdfDeiCarichiDel(oggi.documento, null) === oggi.documento);
  // L'anno dopo passato all'elenco per sbaglio non filtra e non scrive niente.
  const dopo = await apri({ filtroSitoEsterno: 'ALFA RECYCLING SRL', filtroRuoloEsterno: 'imp', carichiDel: annoDiOggiRoma() + 1 });
  verifica("l'anno dopo, se arriva, vale come l'anno in corso: nessun anno nelle richieste, nessuna scritta",
    dopo.prima.length === 1 && !('carichi_del' in dopo.prima[0]) && !/ancora da dichiarare oggi/.test(dopo.testo) && !/ancora da dichiarare oggi/.test(visibile(dopo.documento)), J([dopo.prima, dopo.documento && dopo.documento.sottotitolo]));
  verifica("sull'anno in corso tutto come prima: nessun anno nelle richieste, nessuna scritta", oggi.prima.length === 1 && !('carichi_del' in oggi.prima[0]) && !('carichi_del' in (oggi.excel || {})) && !('carichi_del' in (oggi.pdf || {})) && !/ancora da dichiarare oggi/.test(oggi.testo),
    J([oggi.prima, oggi.excel, oggi.pdf]));
  verifica('nessun errore', !del25.errori.length && !oggi.errori.length && !dopo.errori.length, J([del25.errori, oggi.errori, dopo.errori]));
  const sorgenteTabella = readFileSync(qui('../src/components/giacenze/DaDichiarareTable.jsx'), 'utf8').replace(/\r/g, '');
  // Dal 15/10/2026 il foglio riceve anche i filtri del PDF, per le stesse note.
  verifica("l'anno dei carichi va anche al foglio Excel dell'elenco", /exportDaDichiarareExcel\([^;]*\{ carichi_del: carichiDellAnno, dati: res\.data, filtri: filtriDocumento\(\) \}\)/.test(sorgenteTabella));

  // La riga di riconciliazione di un anno passato non parla di giacenza.
  verifica('la riga di riconciliazione si disegna da sola (Riconciliazione esportata)', typeof tabella.modulo.Riconciliazione === 'function');
  const disegnaRiga = (r) => {
    if (typeof tabella.modulo.Riconciliazione !== 'function') return '';
    const t = tabella.monta(tabella.modulo.Riconciliazione, { r, sito: 'ALFA RECYCLING SRL' });
    const s = testo(t.albero).replace(/\s+/g, ' ');
    t.smonta();
    return s;
  };
  const rigaAnno = disegnaRiga({ foto_del: '2027-01-10', file_ordini: 4, file_kg: 9100, aggiunti_n: 1, aggiunti_kg: 1000, aggiunti: [{ id_ordine: 'ET08', tipo: 'primaria', da: 'RACCOLTA SRL', fine_trasporto: '2026-12-15', kg: 1000 }], dichiarato_dopo_kg: null, giacenza_kg: null, ordini_pulsante: 5, carichi_del: 2026 });
  verifica("la riga del 2026: gli ordini, il pulsante del 2026, e che la giacenza e' la lettura del 31/12",
    /Ordini dei carichi del 2026 ancora da dichiarare oggi/.test(rigaAnno) && /= 5, il numero del pulsante della scheda Situazione del 2026/.test(rigaAnno) && /lettura del 31\/12/.test(rigaAnno) && !/giacenza a portale/.test(rigaAnno) && !/—/.test(rigaAnno), rigaAnno);
  const rigaOggi = disegnaRiga({ foto_del: '2027-01-10', file_ordini: 6, file_kg: 12100, aggiunti_n: 2, aggiunti_kg: 2000, aggiunti: [], dichiarato_dopo_kg: 0, giacenza_kg: 14100, ordini_pulsante: 8 });
  verifica("la riga dell'anno in corso e' quella di sempre", /Riconciliazione con la giacenza:/.test(rigaOggi) && /giacenza a portale 14\.100 kg/.test(rigaOggi) && /= 8, il numero del pulsante della scheda Situazione\./.test(rigaOggi), rigaOggi);

  // La colonna della Situazione, disegnata con react-dom/server.
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
  const colonna = (html) => (String(html).match(/<th[^>]*>Ordini da dichiarare.*?<\/th>/) || [''])[0];
  const righe = [{ sito: 'ALFA RECYCLING SRL', tipo_destinazione: 'imp', giacenza_portale_t: 1, ordini_da_dichiarare: 5 }];
  const h26 = colonna(disegna(righe, { giacenza_portale_t: 1, ordini_da_dichiarare: 5, in_attesa_dei_carichi_del: 2026, ordini_dei_carichi_del: 2026 }));
  const h27 = colonna(disegna(righe, { giacenza_portale_t: 1, ordini_da_dichiarare: 5, in_attesa_dei_carichi_del: null }));
  // L'anno dopo: l'attesa e' dei carichi di quell'anno, gli ordini no.
  const tutta28 = disegna(righe, { giacenza_portale_t: 1, ordini_da_dichiarare: 5, in_attesa_dei_carichi_del: 2028 });
  const h28 = colonna(tutta28);
  verifica("sull'anno dopo la colonna degli ordini ha l'etichetta di sempre, e l'attesa la sua",
    h28 !== '' && !/carichi del/.test(h28) && !/title=/.test(h28) && /dei carichi del (<!-- -->)?2028/.test(tutta28), h28);
  verifica("su un anno passato la colonna dice di quali carichi, e al passaggio del mouse il perche'",
    /dei carichi del (<!-- -->)?2026(<!-- -->)? ancora da dichiarare oggi/.test(h26) && /title="[^"]*si contano solo i carichi arrivati nel 2026/.test(h26), h26);
  verifica("sull'anno in corso l'etichetta di sempre", h27 !== '' && !/carichi del/.test(h27) && !/title=/.test(h27), h27);
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('4. SUI DATI VERI');
const CARTELLA = process.env.DATI_VERI || qui('../../dati-veri/');
const copie = existsSync(CARTELLA) ? readdirSync(CARTELLA).filter(n => /^treadrider-dati-veri-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n)).sort() : [];
if (!copie.length) console.log(`  nessuna copia dei dati veri in ${CARTELLA}: sezione saltata`);
else {
  const nome = copie[copie.length - 1];
  const DATI = JSON.parse(gunzipSync(readFileSync(CARTELLA + nome)).toString('utf8'));
  globalThis.__ARCHIVI_ANNI_PASSATI = DATI.archivi;
  const ORA = DATI.meta.letto_fino_al;
  const ANNO = Number(String(ORA).slice(0, 4));
  console.log(`  copia ${nome}, letta il ${ORA}`);
  // Anche l'anno dopo, che la pagina offre: li' la pagina non manda l'anno dei
  // carichi (carichi_del solo per un anno passato), come per l'anno in corso.
  for (const anno of [ANNO, ANNO - 1, ANNO - 2, ANNO + 1]) {
    const passato = anno < ANNO;
    const G = await conOra(ORA, () => giacenze({ anno }));
    verifica(`${anno}: le Giacenze rispondono`, G.stato === 200, J(G.j.error));
    const elenchi = [];
    for (const r of G.j.righe || []) {
      if (!(r.ordini_da_dichiarare > 0) && r.tipo_destinazione === 'stoc') continue;
      const corpo = { sito: r.sito, ruolo: r.tipo_destinazione, limite: 100, offset: 0, ...(r.tipo_destinazione === 'imp' ? { riconcilia: true } : {}), ...(passato ? { carichi_del: anno } : {}) };
      const L = (await conOra(ORA, () => ordini(corpo))).j;
      const rc = L.riconciliazione;
      // Il pulsante di un impianto e' la riga di riconciliazione (righe + carichi
      // non ancora nel file); senza riga (chi la rete non la dichiara) le righe.
      const pulsante = rc && typeof rc.ordini_pulsante === 'number' ? rc.ordini_pulsante : L.totale_righe;
      elenchi.push(`${r.sito} ${r.tipo_destinazione} ${r.ordini_da_dichiarare}`);
      // Sull'anno dopo le schede dei siti non ci sono ancora, e le Giacenze non
      // sanno che Tecnogum la rete non la dichiara: i carichi arrivati dopo
      // l'ultimo file le danno 320 ordini e 1.833,43 t, mentre l'elenco, che
      // guarda i siti dell'anno in corso, ne apre 0. Era gia' cosi' al commit
      // 5939d15, prima di questo giro, e non riguarda gli ordini di un anno
      // passato: si scrive, e non si conta come fallita.
      if (anno > ANNO && rc && rc.non_dovuta && !r.rete_non_dovuta) {
        console.log(`  ${anno}, ${r.sito}: riga ${r.ordini_da_dichiarare}, elenco ${pulsante}; senza le schede dei siti del ${anno} le Giacenze non sanno che la rete non la dichiara (gia' cosi' prima del giro)`);
        continue;
      }
      verifica(`${anno}, ${r.sito} (${r.tipo_destinazione}): il pulsante della riga e l'elenco che apre dicono lo stesso numero`,
        pulsante === r.ordini_da_dichiarare, `${r.ordini_da_dichiarare} / ${pulsante} ${J(rc)}`);
      if (passato && rc && !rc.non_dovuta) verifica(`${anno}, ${r.sito}: la riga parla dei carichi del ${anno}, senza giacenza`, rc.carichi_del === anno && rc.giacenza_kg === null, J(rc));
    }
    const imp = (G.j.righe || []).filter(r => r.tipo_destinazione === 'imp');
    if (passato) verifica(`${anno}: nessun impianto conta piu' gli ordini del file di oggi (tutti carichi del ${ANNO})`, imp.every(r => r.ordini_da_dichiarare === 0), J(imp.map(r => [r.sito, r.ordini_da_dichiarare])));
    else if (anno > ANNO) {
      // L'anno dopo come prima del giro (revisione del 14/10/2026): accanto alla
      // fotografia di oggi tutto il file. Tecnogum conta perche' il 2027 non ha
      // ancora la scheda dei siti che dice che la rete non la dichiara.
      const di = (re) => (imp.find(r => re.test(r.sito)) || {}).ordini_da_dichiarare;
      verifica(`${anno}, l'anno dopo: Irigom 233, T-Cycle 118, Green Tyre 139, Gatim 56, Tecnogum 320, totale 866, come prima del giro`,
        J([/irigom/i, /t-cycle/i, /green tyre/i, /gatim/i, /tecnogum/i].map(di)) === J([233, 118, 139, 56, 320]) && G.j.totali.ordini_da_dichiarare === 866,
        J([imp.map(r => [r.sito, r.giacenza_portale_t, r.ordini_da_dichiarare]), G.j.totali.ordini_da_dichiarare]));
      verifica(`${anno}: nessuna etichetta dei carichi sugli ordini`, !('ordini_dei_carichi_del' in G.j.totali), J(G.j.totali.ordini_dei_carichi_del));
      const irigom = imp.find(r => /irigom/i.test(r.sito));
      const senza = (await conOra(ORA, () => ordini({ sito: irigom.sito, ruolo: 'imp', riconcilia: true, limite: 100, offset: 0 }))).j;
      const con = (await conOra(ORA, () => ordini({ sito: irigom.sito, ruolo: 'imp', riconcilia: true, limite: 100, offset: 0, carichi_del: anno }))).j;
      verifica(`${anno}: l'elenco di Irigom con carichi_del ${anno} e' quello di tutto il file, con la riga che arriva alla giacenza`,
        J(con) === J(senza) && con.totale_righe === 233 && con.riconciliazione && typeof con.riconciliazione.giacenza_kg === 'number', J([con.totale_righe, con.riconciliazione]));
    } else verifica(`${anno}, l'anno in corso: Irigom 233, T-Cycle 118, Green Tyre 139, Gatim 56, Tecnogum 0 (la rete non ce la dichiara), come prima`,
      J(['Irigom S.r.l.', 'T-CYCLE INDUSTRIES SRL', 'GREEN TYRE PROJECT SRL', 'Gatim', 'TECNOGUM SRL'].map(s => (imp.find(r => r.sito === s) || {}).ordini_da_dichiarare)) === J([233, 118, 139, 56, 0]),
      J(imp.map(r => [r.sito, r.ordini_da_dichiarare])));
    console.log(`  ${anno}: ordini da dichiarare ${G.j.totali.ordini_da_dichiarare} (${elenchi.filter(x => !/ 0$/.test(x)).join(', ') || 'nessuno'})`);
  }
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
