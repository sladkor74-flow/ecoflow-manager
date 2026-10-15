// I CARICHI ARRIVATI DOPO IL FILE DEL PORTALE SONO RIGHE DELL'ELENCO «DA
// DICHIARARE», PER TUTTI GLI IMPIANTI (15/10/2026).
//
// La domanda dell'utente, testuale: «non capisco perche' ad ottobre in t-cycle
// sono entrati finora 49,04 t e nelle giacenze alla voce di ottobre risulta
// ancora 40,92 t». Sul sito: Giacenze › Da dichiarare, T-Cycle, «Ott 2026 16 ·
// 40.920 kg», mentre la Situazione diceva 372,92 t e il pulsante 122 ordini: i 4
// carichi del 12-13/10 (8.120 kg) il file del portale del 09/10 non li aveva
// ancora, e l'elenco, il suo totale e la fascia dei mesi avevano solo il file.
// La riga di riconciliazione li diceva in un «quali sono», e solo arrivando dal
// pulsante. E l'utente: «ovviamente questo discorso deve valere per tuti gli
// impianti, non solo t-cycle altrimenti non c'e' congruenza nei dati e nei
// fatti».
//
// Qui le funzioni vere - getOrdiniDaDichiarare, calcolaGiacenze,
// riepilogoDichiarazioni - girano insieme su archivi costruiti e, se c'e', sulla
// copia dei dati veri, e la scheda, il PDF e l'Excel si fanno coi loro numeri:
//   1. il caso T-Cycle, identico: file del 09/10 con 118 righe e 364.800 kg (16
//      di ottobre per 40.920 kg) e 4 primarie terminate il 12-13/10 per 8.120
//      kg: ottobre 20 · 49.040 kg, totale 122 · 372.920 kg, la riga di
//      riconciliazione uguale, le Giacenze e le Dichiarazioni uguali;
//   2. il sito scelto dal menu e i suoi due ruoli, impianto e stoccaggio;
//   3. una riga del file dichiarata dopo il file;
//   4. un carico senza fine trasporto: non entra, come nella giacenza, e la riga
//      lo dice;
//   5. i filtri dell'anno e della provincia;
//   6. il PDF e l'Excel della scheda;
//   7. piu' impianti insieme (Irigom, Green Tyre, T-Cycle, Gatim, T.R.S. con
//      carichi dopo il file, Tecnogum che la rete non la dichiara) e la vista
//      con tutti i siti; il menu dei siti e' lo stesso con un sito scelto;
//   8. la revisione del 15/10/2026: un carico terminato prima del file che il
//      file non ha si dice «non ancora nel file», non «arrivato dopo»; le note
//      dell'Excel sono quelle del PDF, coi filtri (anche dal pulsante di uno
//      stoccaggio); le colonne per l'Excel di tutta la pagina, e quel foglio
//      con le stesse righe della scheda (chiusura del giro);
//   9. i dati veri dell'11/10/2026: per ogni impianto il totale dell'elenco = la
//      giacenza a portale delle Giacenze = la riconciliazione = le Dichiarazioni,
//      al chilo e mese per mese; e le richieste che l'elenco costa.
// npm run prove
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { caricaPagina, clienteFinto, aspetta, testo, trova } from './dati/paginaFinta.mjs';
import { caricaLibPagine } from './dati/libPagine.mjs';
import { giornoMovimento, eTerminato } from '../base44/shared/movimenti.ts';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);

// --- L'SDK finto: uguaglianza, $in, $gte, $lte, null; conta le richieste ---
globalThis.__ARCHIVI_CARICHI_DOPO = {};
globalThis.__RICHIESTE_CARICHI_DOPO = [];
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
const ordina = (righe) => [...righe].sort((a, b) => String(a.id).localeCompare(String(b.id)));
const conta = (nome, f) => globalThis.__RICHIESTE_CARICHI_DOPO.push(nome + (f && Object.values(f).some(v => v && typeof v === 'object' && '$in' in v) ? ' per numero' : ''));
const entita = (nome) => ({
  list: async (_o, lim = 1e9, skip = 0) => { conta(nome); return ordina(globalThis.__ARCHIVI_CARICHI_DOPO[nome] || []).slice(skip, skip + lim); },
  filter: async (f, _o, lim = 1e9, skip = 0) => { conta(nome, f); return ordina((globalThis.__ARCHIVI_CARICHI_DOPO[nome] || []).filter(r => soddisfa(r, f))).slice(skip, skip + lim); },
  get: async (id) => (globalThis.__ARCHIVI_CARICHI_DOPO[nome] || []).find(r => r.id === id) || null,
  create: async (r) => r, update: async (_id, r) => r, delete: async () => ({}),
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: 'admin', email: 'prova' }) }, asServiceRole: { entities }, entities,
    functions: { invoke: async (n) => { throw new Error('nessuna altra funzione: ' + n); } } };
}`;
const funzione = async (nome) => {
  const pacchetto = await build({
    entryPoints: [qui(`../base44/functions/${nome}/entry.ts`)],
    bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
    plugins: [{ name: 'sdk-finto', setup(b) {
      b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
      b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
    } }],
  });
  const modulo = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
  return async (corpo) => { const r = await modulo.default({ json: async () => corpo }); return r.json(); };
};
// L'orologio fermo: il 15/10/2026, il giorno della domanda.
const OraVera = Date;
const conOra = async (iso, f) => {
  const ms = OraVera.parse(iso);
  globalThis.Date = class extends OraVera { constructor(...a) { if (a.length) super(...a); else super(ms); } static now() { return ms; } };
  try { return await f(); } finally { globalThis.Date = OraVera; }
};
const OGGI = '2026-10-15T09:00:00Z';
const F = {
  ordini: await funzione('getOrdiniDaDichiarare'),
  giacenze: await funzione('calcolaGiacenze'),
  riepilogo: await funzione('riepilogoDichiarazioni'),
};
const ordini = (corpo) => conOra(OGGI, () => F.ordini({ limite: 100, offset: 0, ...corpo }));
const giacenze = () => conOra(OGGI, () => F.giacenze({ anno: 2026 }));
const riepilogo = () => conOra(OGGI, () => F.riepilogo({ anno: 2026 }));

// --- Gli archivi ---
let seq = 0;
const ARCHIVI = () => globalThis.__ARCHIVI_CARICHI_DOPO;
const nuovo = () => {
  globalThis.__ARCHIVI_CARICHI_DOPO = {};
  for (const v of ['DichiarazioneTrattamento', 'Terziaria', 'ImpiantoTargetSecondaria', 'TargetRaccoglitore', 'TargetMensile', 'GiacenzaStoccaggio',
    'IndicatoreGiorno', 'PrimariaAci', 'ExtraRaccolta', 'Secondaria', 'OrdineNonDichiarato', 'DichiarazioneSito', 'GiacenzaSito', 'PrimariaRete', 'CommessaEcotyre']) ARCHIVI()[v] = [];
};
const metti = (nome, righe) => { for (const r of righe) ARCHIVI()[nome].push({ id: 'r' + String(++seq).padStart(6, '0'), ...r }); };
const g = (giorno) => `${giorno}T00:00:00.000Z`;
const FOTO = '2026-10-09T06:30:00.000Z';
const primaria = (id, dest, kg, giorno, extra = {}) => ({
  id_ordine: id, numero_fir: 'FIR' + id, classe: 'P - fino a 35 kg', prodotto: '.class1', cer: '160103', destinazione: dest,
  tipo_destinazione: 'Imp', stato: 'terminato', peso_effettivo: kg, trasportatore: 'RACCOLTA SRL', provincia: 'NA', comune: 'Napoli', punto_di_raccolta: 'GOMMISTA',
  partner_operativo: 'SMOCO S.r.l.', ordine_immesso_il: g(giorno), trasporto_iniziato_il: g(giorno), trasporto_finito_il: g(giorno), ordine_chiuso_il: g(giorno), ...extra,
});
const nelFile = (p, extra = {}) => ({
  ordine_primaria: p.id_ordine, numero_fir: p.numero_fir, destinazione: p.destinazione, prodotto: p.prodotto, peso_non_dichiarato_kg: p.peso_effettivo,
  fine_trasporto: p.trasporto_finito_il, provincia: p.provincia, comune: p.comune, punto_di_raccolta: p.punto_di_raccolta, partner_operativo: 'SMOCO S.r.l.',
  created_date: FOTO, ...extra,
});
/** n carichi in un mese che pesano in tutto `kg`, dal giorno `dal` al giorno `al`. */
const carichiDelMese = (prefisso, dest, mese, n, kg, { dal = 1, al = 28, extra = {} } = {}) => Array.from({ length: n }, (_, i) => {
  const peso = i < n - 1 ? Math.floor(kg / n) : kg - Math.floor(kg / n) * (n - 1);
  const giorno = `${mese}-${String(dal + Math.floor((i * (al - dal + 1)) / n)).padStart(2, '0')}`;
  return primaria(`${prefisso}${mese.replace('-', '')}${String(i).padStart(3, '0')}`, dest, peso, giorno, extra);
});

const TCY = 'T-CYCLE INDUSTRIES SRL', TEC = 'TECNOGUM SRL', IRI = 'Irigom S.r.l.', GTP = 'GREEN TYRE PROJECT SRL', GAT = 'Gatim', TRS = 'T.R.S.  SRL', NAPPI = 'NAPPI SUD SRL';
// I 4 carichi del 12-13/10/2026 che il file del 09/10 non ha, come sul sito.
const QUATTRO = [
  ['ET26166301', '2026-10-12', 3940], ['ET26113632', '2026-10-13', 1960], ['ET26164971', '2026-10-13', 520], ['ET26164992', '2026-10-13', 1700],
].map(([id, giorno, kg]) => primaria(id, TCY, kg, giorno, { trasportatore: 'LOGISTICA & PNEUMATICI SRL', provincia: 'CE', comune: 'Caserta' }));

/** Il caso T-Cycle del 15/10/2026. */
const casoTCycle = ({ dichiaratoDopo = 0 } = {}) => {
  nuovo();
  metti('GiacenzaSito', [
    { sito: TCY, tipo_destinazione: 'imp', anno: 2026, dichiara_rete: true },
    { sito: TCY, tipo_destinazione: 'stoc', anno: 2026 },
    { sito: TEC, tipo_destinazione: 'imp', anno: 2026, dichiara_rete: false },
  ]);
  // Le 118 righe del file di T-Cycle impianto, mese per mese come il 09/10.
  const file = [
    ...carichiDelMese('ET26', TCY, '2026-06', 16, 41980),
    ...carichiDelMese('ET26', TCY, '2026-07', 39, 108680),
    ...carichiDelMese('ET26', TCY, '2026-08', 13, 48420),
    ...carichiDelMese('ET26', TCY, '2026-09', 34, 124800),
    ...carichiDelMese('ET26', TCY, '2026-10', 16, 40920, { al: 8 }),
  ];
  // Le 72 righe dello stoccaggio di T-Cycle: passati dal piazzale fra gennaio e
  // maggio e gia' ripartiti, 181.299 kg «in attesa di dichiarazione».
  const stoc = carichiDelMese('ES26', TCY, '2026-02', 72, 181299, { extra: { tipo_destinazione: 'Stoc' } });
  // Cinque carichi di marzo gia' dichiarati (il report li conosce, con una data
  // dentro la finestra), e uno di gennaio il cui report ha una data piu' vecchia
  // della finestra: il portale lo conosce lo stesso, e non e' un carico aggiunto.
  const dichiarati = carichiDelMese('ED26', TCY, '2026-03', 5, 10000);
  const vecchio = primaria('ED26000001', TCY, 1000, '2026-01-05');
  // Un terminato di rete senza fine trasporto: il portale non lo conosce.
  const senzaFine = primaria('ET26170000', TCY, 2500, '2026-10-10', { trasporto_finito_il: null });
  metti('PrimariaRete', [...file, ...stoc, ...dichiarati, vecchio, senzaFine, ...QUATTRO]);
  metti('OrdineNonDichiarato', [...file.map(p => nelFile(p)), ...stoc.map(p => nelFile(p))]);
  metti('DichiarazioneTrattamento', [
    ...dichiarati.map(p => ({ ordine_primaria: p.id_ordine, prodotto: '.class1', partner_operativo: 'SMOCO S.r.l.', destinazione: TCY, data_dichiarazione: '2026-04-10T10:00:00.000Z', fine_trasporto: p.trasporto_finito_il, peso_associato_kg: p.peso_effettivo })),
    { ordine_primaria: vecchio.id_ordine, prodotto: '.class1', partner_operativo: 'SMOCO S.r.l.', destinazione: TCY, data_dichiarazione: '2025-12-20T10:00:00.000Z', fine_trasporto: vecchio.trasporto_finito_il, peso_associato_kg: 1000 },
  ]);
  metti('DichiarazioneSito', [
    { sito: TCY, anno: 2026, mese: 'Gennaio', canale: 'RETE', provenienza: '', quantita_kg: 1000, caricata_inviata: true, caricata_il: '2026-02-10' },
    { sito: TCY, anno: 2026, mese: 'Marzo', canale: 'RETE', provenienza: '', quantita_kg: 10000, caricata_inviata: true, caricata_il: '2026-04-10' },
    ...(dichiaratoDopo ? [{ sito: TCY, anno: 2026, mese: 'Giugno', canale: 'RETE', provenienza: '', quantita_kg: dichiaratoDopo, caricata_inviata: true, caricata_il: '2026-10-10' }] : []),
  ]);
};
const rigaG = (G, sito, td = 'imp') => (G.righe || []).find(r => r.sito === sito && r.tipo_destinazione === td) || {};
const sitoD = (D, sito) => (D.siti || []).find(s => s.sito === sito && s.tipo_destinazione !== 'stoc') || {};
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
/** Quanto resta da dichiarare nelle Dichiarazioni Impianti, mese per mese, sulla rete. */
const restaPerMese = (s, anno = 2026) => {
  const flussi = (s.flussi || []).filter(f => f.canale === 'RETE');
  const per = {};
  MESI.forEach((_, i) => { const kg = flussi.reduce((t, f) => t + (f.mesi[i].resta_kg || 0), 0); if (kg) per[`${anno}-${String(i + 1).padStart(2, '0')}`] = kg; });
  return per;
};
const elencoPerMese = (L, ruolo = 'imp') => Object.fromEntries((L.per_mese || []).filter(m => m.mese && m[ruolo].kg).map(m => [m.mese, m[ruolo].kg]));
const ott = (L) => (L.per_mese || []).find(m => m.mese === '2026-10') || {};
/** Le note sotto il TOTALE del foglio dell'elenco: dopo una riga vuota, una per riga. */
const noteExcel = (aoa) => { const i = aoa.findIndex(r => r[0] === 'TOTALE'); return i < 0 ? [] : aoa.slice(i + 2).map(r => r[0]); };

console.log('1. IL CASO T-CYCLE DEL 15/10/2026');
casoTCycle();
const G1 = await giacenze();
const D1 = await riepilogo();
const L1 = await ordini({ sito: TCY, ruolo: 'imp' });
{
  verifica('premessa: il file del 09/10 ha 118 righe e 364.800 kg di T-Cycle impianto, 16 di ottobre per 40.920 kg',
    ARCHIVI().OrdineNonDichiarato.filter(r => !r.ordine_primaria.startsWith('ES')).length === 118
      && ARCHIVI().OrdineNonDichiarato.filter(r => !r.ordine_primaria.startsWith('ES')).reduce((s, r) => s + r.peso_non_dichiarato_kg, 0) === 364800
      && ARCHIVI().OrdineNonDichiarato.filter(r => String(r.fine_trasporto).startsWith('2026-10')).reduce((s, r) => s + r.peso_non_dichiarato_kg, 0) === 40920);
  verifica('le Giacenze: T-Cycle impianto 372,92 t, pulsante 122', rigaG(G1, TCY).giacenza_rete_t === 372.92 && rigaG(G1, TCY).ordini_da_dichiarare === 122, J([rigaG(G1, TCY).giacenza_rete_t, rigaG(G1, TCY).ordini_da_dichiarare]));
  verifica('ottobre: 20 ordini, 49.040 kg, di cui 4 · 8.120 kg non ancora nel file del portale',
    ott(L1).ordini === 20 && ott(L1).kg === 49040 && ott(L1).dopo_il_file.ordini === 4 && ott(L1).dopo_il_file.kg === 8120, J(ott(L1)));
  verifica("il totale dell'elenco: 122 ordini, 372.920 kg = il pulsante e la giacenza della Situazione",
    L1.totale_righe === 122 && L1.totale_kg === 372920 && L1.totale_righe === rigaG(G1, TCY).ordini_da_dichiarare && L1.totale_kg / 1000 === rigaG(G1, TCY).giacenza_rete_t, J([L1.totale_righe, L1.totale_kg]));
  verifica('le parti: 118 nel file del 09/10/2026 (364.800 kg) + 4 arrivati dopo (8.120 kg), tutti e 4 dopo il giorno del file',
    L1.foto_del === '2026-10-09' && L1.parti.nel_file.ordini === 118 && L1.parti.nel_file.kg === 364800 && L1.parti.dopo_il_file.ordini === 4 && L1.parti.dopo_il_file.kg === 8120
      && L1.parti.dopo_il_file.arrivati_dopo === 4 && L1.parti.dichiarato_dopo.kg === 0, J(L1.parti));
  verifica('la fascia dei mesi fa il totale, ordini e chili', L1.per_mese.reduce((s, m) => s + m.kg, 0) === 372920 && L1.per_mese.reduce((s, m) => s + m.ordini, 0) === 122);
  const r = L1.riconciliazione || {};
  verifica('la riconciliazione: 118 · 364.800 + 4 · 8.120 - 0 = 372.920 kg, 122 ordini, i quattro carichi del sito',
    r.file_ordini === 118 && r.file_kg === 364800 && r.aggiunti_n === 4 && r.aggiunti_kg === 8120 && r.dichiarato_dopo_kg === 0 && r.giacenza_kg === 372920 && r.ordini_pulsante === 122
      && r.aggiunti.map(o => o.id_ordine).sort().join() === QUATTRO.map(p => p.id_ordine).sort().join(), J(r));
  const ultime = await ordini({ sito: TCY, ruolo: 'imp', offset: 100 });
  const dopo = ultime.righe.filter(x => x.nel_file === false);
  verifica('i 4 carichi sono righe, in fondo come le piu recenti, nella stessa paginazione (pagina 2: 22 righe)',
    ultime.righe.length === 22 && dopo.length === 4 && ultime.righe.slice(-4).every(x => x.nel_file === false) && dopo.every(x => x.trasportatore === 'LOGISTICA & PNEUMATICI SRL' && x.carico && x.carico.tipo === 'primaria'),
    J(ultime.righe.slice(-5).map(x => [x.ordine_primaria, x.fine_trasporto, x.nel_file])));
  verifica("ordinate per fine trasporto con le altre: l'ultima del file e' dell'08/10, poi il 12/10 e il 13/10",
    ultime.righe.slice(-5).map(x => x.fine_trasporto).join() === '2026-10-08,2026-10-12,2026-10-13,2026-10-13,2026-10-13', J(ultime.righe.slice(-5).map(x => x.fine_trasporto)));
  verifica('il carico di gennaio, che il report conosce con una data vecchia, e i dichiarati di marzo non sono carichi aggiunti',
    !L1.righe.concat(ultime.righe).some(x => /^ED26/.test(x.ordine_primaria)));
  // Le Dichiarazioni Impianti: lo stesso numero, e lo stesso ottobre.
  const d = sitoD(D1, TCY);
  const ottD = (d.flussi || []).filter(f => f.canale === 'RETE').reduce((t, f) => ({ conferito: t.conferito + f.mesi[9].conferito_kg, resta: t.resta + f.mesi[9].resta_kg }), { conferito: 0, resta: 0 });
  verifica('le Dichiarazioni: giacenza a portale 372,92 t, e quadra con la calcolata', d.giacenza_portale_t === 372.92 && d.quadra === true, J([d.giacenza_portale_t, d.giacenza_calcolata_t, d.quadra]));
  verifica('le Dichiarazioni, ottobre di T-Cycle: entrati 49.040 kg e da dichiarare 49.040 kg, come l\'elenco', ottD.conferito === 49040 && ottD.resta === 49040, J(ottD));
  verifica('le Dichiarazioni, mese per mese, dicono quello che dice l\'elenco', J(restaPerMese(d)) === J(elencoPerMese(L1)), `${J(restaPerMese(d))} / ${J(elencoPerMese(L1))}`);
  const fine = (d.portale_fine_mese || [])[9] || {};
  verifica('e la giacenza a portale a fine ottobre del riepilogo: file 364.800 + 8.120 aggiunti', fine.foto_kg === 364800 && fine.aggiunti_kg === 8120, J(fine));
  // Terminati Rete col filtro di T-Cycle e ottobre: le primarie terminate a
  // T-Cycle con fine trasporto di ottobre (giornoMovimento, come la pagina).
  const terminati = ARCHIVI().PrimariaRete.filter(p => p.destinazione === TCY && eTerminato(p) && String(giornoMovimento(p) || '').startsWith('2026-10'));
  verifica('i Terminati Rete di ottobre a T-Cycle: 20 ordini, 49.040 kg, lo stesso numero', terminati.length === 20 && terminati.reduce((s, p) => s + p.peso_effettivo, 0) === 49040, J([terminati.length, terminati.reduce((s, p) => s + p.peso_effettivo, 0)]));
}

console.log('2. IL SITO SCELTO DAL MENU, CON I SUOI DUE RUOLI');
{
  const M = await ordini({ sito: TCY });
  const r = M.riconciliazione || {};
  verifica('dal menu, senza ruolo: 122 come impianto (372.920 kg) e 72 come stoccaggio (181.299 kg), 194 righe',
    M.totale_righe === 194 && M.parti.imp.ordini === 122 && M.parti.imp.kg === 372920 && M.parti.stoc.ordini === 72 && M.parti.stoc.kg === 181299 && M.totale_kg === 372920 + 181299, J([M.totale_righe, M.totale_kg, M.parti.imp, M.parti.stoc]));
  verifica("la riga di riconciliazione c'e' anche dal menu, coi due ruoli separati: l'impianto arriva alla giacenza, lo stoccaggio a parte",
    r.giacenza_kg === 372920 && r.ordini_pulsante === 122 && r.stoccaggio && r.stoccaggio.ordini === 72 && r.stoccaggio.kg === 181299
      && r.stoccaggio.ordini === rigaG(G1, TCY, 'stoc').ordini_da_dichiarare && r.stoccaggio.kg / 1000 === rigaG(G1, TCY, 'stoc').in_attesa_dichiarazione_t, J([r, rigaG(G1, TCY, 'stoc').in_attesa_dichiarazione_t]));
  verifica('la fascia dei mesi divide i due ruoli: ottobre e\' tutto impianto, febbraio tutto stoccaggio',
    ott(M).imp.ordini === 20 && ott(M).imp.kg === 49040 && ott(M).stoc.ordini === 0 && (M.per_mese.find(m => m.mese === '2026-02') || {}).stoc.kg === 181299, J(M.per_mese));
  verifica('lo stoccaggio non ha carichi aggiunti: il materiale del piazzale non diventa carico dell\'impianto', M.righe.concat((await ordini({ sito: TCY, offset: 100 })).righe).filter(x => x.ruolo === 'stoc').every(x => x.nel_file === true));
  const S = await ordini({ sito: TCY, ruolo: 'stoc' });
  verifica('dal pulsante dello stoccaggio: 72 ordini, 181.299 kg, come prima, e nessuna riga di riconciliazione', S.totale_righe === 72 && S.totale_kg === 181299 && S.riconciliazione === null, J([S.totale_righe, S.totale_kg, S.riconciliazione]));
}

console.log('3. UNA RIGA DEL FILE DICHIARATA DOPO IL FILE');
{
  casoTCycle({ dichiaratoDopo: 5000 });
  const G = await giacenze();
  const D = await riepilogo();
  const L = await ordini({ sito: TCY, ruolo: 'imp' });
  verifica('le Giacenze: 372,92 - 5 = 367,92 t, e il pulsante resta 122', rigaG(G, TCY).giacenza_rete_t === 367.92 && rigaG(G, TCY).ordini_da_dichiarare === 122, J([rigaG(G, TCY).giacenza_rete_t, rigaG(G, TCY).ordini_da_dichiarare]));
  verifica("l'elenco: 122 righe e 367.920 kg, identico alla giacenza e al pulsante", L.totale_righe === 122 && L.totale_kg === 367920 && L.parti.dichiarato_dopo.kg === 5000, J([L.totale_righe, L.totale_kg, L.parti.dichiarato_dopo]));
  const prime = L.righe.filter(x => x.dichiarato_dopo_kg > 0);
  verifica('il dichiarato dopo si toglie dai carichi arrivati da piu\' tempo, e le righe lo dicono: giugno, la prima tutta e la seconda in parte',
    prime.length === 2 && prime[0].peso_non_dichiarato_kg === 0 && prime[0].peso_del_file_kg === 2623 && prime[0].dichiarato_dopo_kg === 2623 && prime[1].dichiarato_dopo_kg === 2377 && prime.every(x => x.fine_trasporto.startsWith('2026-06')),
    J(prime));
  const giugno = L.per_mese.find(m => m.mese === '2026-06') || {};
  verifica('giugno nella fascia: 16 ordini, 41.980 - 5.000 = 36.980 kg, e dice i 5.000 tolti', giugno.ordini === 16 && giugno.kg === 36980 && giugno.dichiarato_dopo_kg === 5000, J(giugno));
  verifica('la riconciliazione e le Dichiarazioni: 367.920 kg', L.riconciliazione.giacenza_kg === 367920 && L.riconciliazione.dichiarato_dopo_kg === 5000 && sitoD(D, TCY).giacenza_portale_t === 367.92, J([L.riconciliazione.giacenza_kg, sitoD(D, TCY).giacenza_portale_t]));
  verifica('e le Dichiarazioni, mese per mese, dicono quello che dice l\'elenco', J(restaPerMese(sitoD(D, TCY))) === J(elencoPerMese(L)), `${J(restaPerMese(sitoD(D, TCY)))} / ${J(elencoPerMese(L))}`);
}

console.log('4. UN CARICO SENZA FINE TRASPORTO: NON ENTRA, COME NELLA GIACENZA, E LA RIGA LO DICE');
let tabella;
{
  casoTCycle();
  verifica("non e' una riga dell'elenco, ne' nel totale", !(await ordini({ sito: TCY, ruolo: 'imp', ricerca: 'ET26170000' })).totale_righe);
  const gruppo = (rigaG(G1, TCY).date_da_sistemare || []).find(x => x.canale === 'RETE') || {};
  verifica('le Giacenze lo dicono: 1 arrivo senza fine trasporto che il portale non conosce, 2.500 kg', gruppo.senza_fine && gruppo.senza_fine.ignoti_al_portale_n === 1 && gruppo.senza_fine.ignoti_al_portale_kg === 2500, J(gruppo.senza_fine));
  tabella = await caricaPagina('components/giacenze/DaDichiarareTable');
  globalThis.__CLIENTE_FINTO = clienteFinto().cliente;
  const disegna = (Comp, props) => { const t = tabella.monta(Comp, props); const s = testo(t.albero).replace(/\s+/g, ' '); const e = t.errori.map(String); t.smonta(); return { s, e }; };
  const riga = disegna(tabella.modulo.Riconciliazione, { r: L1.riconciliazione, sito: TCY, righeGiacenze: G1.righe });
  verifica('la riga di riconciliazione lo dice, con i numeri della Situazione',
    /1 arrivo di rete senza fine trasporto \(2\.500 kg\), che il portale non conosce ancora: non entra in questo elenco né nella giacenza/.test(riga.s) && !riga.e.length, riga.s);
  verifica('e dice il conto, coi numeri all\'italiana',
    /file del portale del 09\/10\/2026 118 ordini, 364\.800 kg \+ 4 carichi non ancora nel file, 8\.120 kg − dichiarato a portale dopo la fotografia, 0 kg = giacenza a portale 372\.920 kg/.test(riga.s)
      && /Ordini: 118 nel file \+ 4 non ancora nel file = 122, il numero del pulsante della scheda Situazione\./.test(riga.s), riga.s);
  const M = await ordini({ sito: TCY });
  const dueRuoli = disegna(tabella.modulo.Riconciliazione, { r: M.riconciliazione, sito: TCY, righeGiacenze: G1.righe });
  verifica('dal menu dice anche lo stoccaggio, per quello che e\'', /Come stoccaggio, T-CYCLE INDUSTRIES SRL ha nel file 72 ordini, 181\.299 kg/.test(dueRuoli.s) && /Non sono giacenza dell.impianto/.test(dueRuoli.s), dueRuoli.s);
  const fascia = disegna(tabella.modulo.FasciaMesi, { mesi: L1.per_mese, titolo: 'Di quali mesi:' });
  verifica('la fascia: «Ott 2026 20 · 49.040 kg di cui 4 · 8.120 kg non ancora nel file del portale»', /Ott 2026 20 · 49\.040 kg\s*di cui 4 · 8\.120 kg non ancora nel file del portale/.test(fascia.s), fascia.s);
}

console.log("5. I FILTRI DELL'ANNO E DELLA PROVINCIA");
{
  const ce = await ordini({ sito: TCY, ruolo: 'imp', provincia: 'CE' });
  verifica('provincia CE: i 4 carichi arrivati dopo (sono di Caserta), 8.120 kg, e la riga resta di tutto il sito, coi filtri',
    ce.totale_righe === 4 && ce.totale_kg === 8120 && ce.righe.every(x => x.nel_file === false) && ce.riconciliazione.giacenza_kg === 372920 && ce.riconciliazione.filtri === true && ce.riconciliazione.elenco.kg === 8120,
    J([ce.totale_righe, ce.totale_kg, ce.riconciliazione && ce.riconciliazione.elenco]));
  const a26 = await ordini({ sito: TCY, ruolo: 'imp', anno: 2026 });
  const a25 = await ordini({ sito: TCY, ruolo: 'imp', anno: 2025 });
  verifica("l'anno 2026: tutti e 122, e il 2025 nessuno; la riga di riconciliazione c'e' sempre",
    a26.totale_righe === 122 && a26.totale_kg === 372920 && a25.totale_righe === 0 && a25.riconciliazione.giacenza_kg === 372920 && a25.riconciliazione.elenco.ordini === 0, J([a26.totale_righe, a25.totale_righe]));
  verifica("gli anni e le province del menu comprendono quelli dei carichi arrivati dopo", a26.province_distinte.includes('CE') && a26.anni_distinti.includes(2026));
}

console.log("6. IL PDF E L'EXCEL DELLA SCHEDA");
{
  const tutte = await ordini({ sito: TCY, ruolo: 'imp', tutte: true });
  const pdf = await caricaLibPagine('lib/giacenzePdf');
  const a = pdf.daDichiararePdf(2026, tutte, { sito: TCY, ruolo: 'imp' });
  const ordiniPdf = a.sezioni[1];
  const ultimaColonna = ordiniPdf.colonne.length - 1;
  verifica('il PDF: tutte le 122 righe e il totale 372.920 kg', ordiniPdf.righe.filter(r => !r.stile).length === 122 && ordiniPdf.righe.at(-1).stile === 'totale' && ordiniPdf.righe.at(-1).celle[8] === 372920 && a.riepilogo[0].valore === 122 && a.riepilogo[1].valore === 372920);
  verifica('il PDF: la colonna «Nel file del portale», con 4 righe «no, arrivato dopo il file del 09/10/2026»',
    ordiniPdf.colonne[ultimaColonna].titolo === 'Nel file del portale' && ordiniPdf.righe.filter(r => r.celle[ultimaColonna] === 'no, arrivato dopo il file del 09/10/2026').length === 4 && ordiniPdf.righe.filter(r => r.celle[ultimaColonna] === 'sì').length === 118);
  const ottPdf = a.sezioni[0].righe.find(r => r.celle[0] === 'Ott 2026');
  verifica('il PDF: ottobre 20 · 49.040 kg, di cui 4 · 8.120 kg non ancora nel file', ottPdf && J(ottPdf.celle) === J(['Ott 2026', 20, 49040, 4, 8120]), J(ottPdf && ottPdf.celle));
  verifica('il PDF: in testa quanti nel file del 09/10/2026 e quanti arrivati dopo', a.riepilogo.some(x => x.etichetta === 'Nel file del 09/10/2026' && x.valore === 118) && a.riepilogo.some(x => x.etichetta === 'Arrivati dopo il file' && x.valore === 4), J(a.riepilogo));
  verifica("il PDF: le note dicono che cos'e' l'elenco e la riconciliazione",
    a.note.some(n => /^L’elenco e’ il file degli ordini non dichiarati del portale del 09\/10\/2026 piu’ i carichi che il gestionale conosce e il file non ha ancora, di solito arrivati dopo/.test(n) && /l’etichetta sparisce/.test(n))
      && a.note.some(n => /= giacenza a portale 372\.920 kg, lo stesso numero delle Giacenze/.test(n)), J(a.note));
  // Il PDF scrive solo quello che i suoi caratteri hanno (AGENTS.md, «I
  // documenti che escono»): niente meno tipografico, niente fuori dal Latin-1
  // salvo i segni che la Helvetica standard ha.
  const fuori = (x) => /[^\u0000-ÿ€«»–—’•]/.test(String(x));
  const testi = [a.titolo, a.sottotitolo, ...a.note, ...a.riepilogo.map(x => x.etichetta), ...a.sezioni.flatMap(s => [s.titolo, ...s.colonne.map(c => c.titolo), ...s.righe.flatMap(r => r.celle.filter(c => typeof c === 'string'))])];
  verifica('il PDF: nessun carattere che i caratteri del PDF non hanno', !testi.some(fuori), J(testi.filter(fuori)));
  // L'Excel, con SheetJS finto come in prove/ordiniAnniPassatiEtichette.mjs.
  const scritti = [];
  globalThis.__XLSX_CARICHI_DOPO = {
    utils: {
      book_new: () => ({ fogli: [] }),
      aoa_to_sheet: (aoa) => ({ aoa }),
      book_append_sheet: (wb, ws, nome) => { wb.fogli.push({ nome, aoa: ws.aoa }); },
      decode_range: () => ({ s: { r: 0, c: 0 }, e: { r: 0, c: 0 } }), encode_cell: () => 'A1',
    },
    writeFile: (wb, nome) => { scritti.push({ nome, aoa: wb.fogli[0].aoa }); },
  };
  const xl = await caricaLibPagine('lib/giacenzeDaDichiarareExport', [["const XLSX = await import('xlsx');", 'const XLSX = globalThis.__XLSX_CARICHI_DOPO;']]);
  await xl.exportDaDichiarareExcel(tutte.righe, tutte.totale_righe, tutte.totale_kg, { carichi_del: null, dati: tutte, filtri: { sito: TCY, ruolo: 'imp' } });
  const aoa = (scritti[0] || {}).aoa || [];
  const iNel = aoa[0] ? aoa[0].indexOf('Nel file del portale') : -1;
  const totale = aoa.find(r => r[0] === 'TOTALE') || [];
  verifica("l'Excel: le intestazioni in prima riga, la colonna «Nel file del portale» e le stesse righe del PDF",
    aoa[0] && aoa[0][0] === 'Ordine' && iNel > 0 && aoa.filter(r => r[iNel] === 'no, arrivato dopo il file del 09/10/2026').length === 4 && aoa.filter(r => r[iNel] === 'sì').length === 118, J(aoa[0]));
  verifica("l'Excel: il TOTALE 372.920 kg, e sotto le stesse note del PDF, tutte e nello stesso ordine", totale[8] === 372920 && J(noteExcel(aoa)) === J(a.note) && aoa.some(r => /= giacenza a portale 372\.920 kg/.test(String(r[0]))), J([totale, noteExcel(aoa)]));
  // La scheda vera, coi numeri della funzione: il totale, le parti, la colonna.
  const c = clienteFinto({ funzioni: { getOrdiniDaDichiarare: async (p) => ordini(p) } });
  globalThis.__CLIENTE_FINTO = c.cliente;
  const m = tabella.monta(tabella.Componente, { filtroSitoEsterno: TCY, filtroRuoloEsterno: 'imp', onPulisciFiltroSito: () => {}, righeGiacenze: G1.righe });
  await aspetta(40);
  const s = testo(m.albero).replace(/\s+/g, ' ');
  verifica('la scheda: «122 ordini 372.920 kg totali», «118 nel file del 09/10/2026 + 4 arrivati dopo»',
    /122 ordini/.test(s) && /372\.920 kg totali/.test(s) && /118 nel file del 09\/10\/2026 \+ 4 arrivati dopo \(8\.120 kg\)/.test(s) && !m.errori.length, s.slice(0, 600));
  verifica('la scheda: le due frasi che dicono che cosa e\' l\'elenco', /L.elenco è il file degli ordini non dichiarati del portale del 09\/10\/2026 più i carichi che il gestionale conosce e il file non ha ancora, di solito arrivati dopo/.test(s) && /Caricando un file nuovo degli ordini non dichiarati quei carichi entrano nel file e l.etichetta sparisce\./.test(s), s.slice(0, 400));
  verifica('la scheda: una chiamata sola all\'apertura, senza riconcilia', c.funzioniChiamate('getOrdiniDaDichiarare').length === 1 && !('riconcilia' in c.funzioniChiamate('getOrdiniDaDichiarare')[0].payload), J(c.funzioniChiamate('getOrdiniDaDichiarare').map(x => x.payload)));
  const ric = trova(m.albero, 'Riconciliazione')[0];
  verifica('la scheda passa alla riga di riconciliazione quella della funzione e le righe della Situazione', ric && ric.props.r && ric.props.r.giacenza_kg === 372920 && ric.props.righeGiacenze === G1.righe);
  m.smonta();
}

console.log('7. PIU\' IMPIANTI INSIEME, E TUTTI I SITI');
{
  nuovo();
  metti('GiacenzaSito', [IRI, GTP, TCY, GAT, TRS].map(sito => ({ sito, tipo_destinazione: 'imp', anno: 2026, dichiara_rete: true }))
    .concat([{ sito: TEC, tipo_destinazione: 'imp', anno: 2026, dichiara_rete: false }, { sito: NAPPI, tipo_destinazione: 'stoc', anno: 2026 }]));
  // Il file del 09/10: i numeri della Situazione del 15/10/2026.
  const fileDi = {
    [IRI]: [...carichiDelMese('EI26', IRI, '2026-07', 1, 3480), ...carichiDelMese('EI26', IRI, '2026-08', 57, 157060), ...carichiDelMese('EI26', IRI, '2026-09', 131, 366020), ...carichiDelMese('EI26', IRI, '2026-10', 42, 120280, { al: 8 })],
    [GTP]: [...carichiDelMese('EG26', GTP, '2026-09', 107, 255780), ...carichiDelMese('EG26', GTP, '2026-10', 32, 82180, { al: 8 })],
    [TCY]: [...carichiDelMese('ET26', TCY, '2026-06', 16, 41980), ...carichiDelMese('ET26', TCY, '2026-07', 39, 108680), ...carichiDelMese('ET26', TCY, '2026-08', 13, 48420), ...carichiDelMese('ET26', TCY, '2026-09', 34, 124800), ...carichiDelMese('ET26', TCY, '2026-10', 16, 40920, { al: 8 })],
    [GAT]: [...carichiDelMese('EA26', GAT, '2026-06', 19, 112240), ...carichiDelMese('EA26', GAT, '2026-09', 31, 122170), ...carichiDelMese('EA26', GAT, '2026-10', 6, 27210, { al: 8 })],
  };
  // Irigom ha anche 6.000 kg passati da Nappi Sud: due primarie al piazzale a
  // fine settembre, ripartite con una secondaria arrivata il 02/10. Nel file
  // stanno sotto Irigom, e il loro mese e' quello della secondaria: ottobre.
  const viaNappi = [primaria('EN26000001', NAPPI, 2500, '2026-09-28', { tipo_destinazione: 'Stoc' }), primaria('EN26000002', NAPPI, 3500, '2026-09-29', { tipo_destinazione: 'Stoc' })];
  const secNappi = { ...primaria('SN26000001', IRI, 6000, '2026-10-02'), stoccaggio: NAPPI };
  // I carichi arrivati dopo il file, come il 15/10: Irigom 19 (56,12 t, uno e'
  // una secondaria da Nappi), Green Tyre 19 (54,74), T-Cycle 4 (8,12), Gatim 4
  // (19,25), T.R.S. 2 (12,56) che nel file non c'e' nemmeno. Tecnogum ne ha 3
  // ma la rete non la dichiara: non sono carichi «in ritardo nel file».
  const secDopo = { ...primaria('SN26000002', IRI, 3120, '2026-10-12'), stoccaggio: NAPPI };
  const dopoDi = {
    [IRI]: carichiDelMese('XI26', IRI, '2026-10', 18, 53000, { dal: 10, al: 14 }),
    [GTP]: carichiDelMese('XG26', GTP, '2026-10', 19, 54740, { dal: 10, al: 14 }),
    [TCY]: QUATTRO,
    [GAT]: carichiDelMese('XA26', GAT, '2026-10', 4, 19250, { dal: 10, al: 14 }),
    [TRS]: carichiDelMese('XT26', TRS, '2026-10', 2, 12560, { dal: 10, al: 14 }),
    [TEC]: carichiDelMese('XC26', TEC, '2026-10', 3, 30000, { dal: 10, al: 14 }),
  };
  metti('PrimariaRete', [...Object.values(fileDi).flat(), ...viaNappi, ...Object.values(dopoDi).flat()]);
  metti('Secondaria', [secNappi, secDopo]);
  metti('OrdineNonDichiarato', [
    ...Object.values(fileDi).flat().map(p => nelFile(p)),
    ...viaNappi.map(p => nelFile(p, { destinazione_secondaria: IRI, ordine_secondaria: 'SN26000001' })),
  ]);
  const G = await giacenze();
  const D = await riepilogo();
  const ATTESI = { [IRI]: [708960, 252, 19], [GTP]: [392700, 158, 19], [TCY]: [372920, 122, 4], [GAT]: [280870, 60, 4], [TRS]: [12560, 2, 2] };
  // Il menu dei siti con tutti i siti: anche T.R.S., che ha solo carichi arrivati
  // dopo il file; non Tecnogum, i cui carichi la rete non li dichiara.
  const menuDiTutti = (await ordini({})).siti_distinti;
  verifica('premessa: il menu di tutti i siti', J(menuDiTutti) === J([GAT, GTP, IRI, TCY, TRS].sort()), J(menuDiTutti));
  for (const [sito, [kg, n, dopo]] of Object.entries(ATTESI)) {
    const dalPulsante = await ordini({ sito, ruolo: 'imp' });
    const dalMenu = await ordini({ sito });
    // Revisione del 15/10/2026: la scheda rifa' il menu a ogni risposta, e scelto
    // T-Cycle il menu perdeva T.R.S. Con un sito scelto il menu e' lo stesso.
    verifica(`${sito}: scelto dal menu o dal pulsante, il menu dei siti e' quello di tutti i siti (T.R.S. compreso)`,
      J(dalMenu.siti_distinti) === J(menuDiTutti) && J(dalPulsante.siti_distinti) === J(menuDiTutti), J([dalMenu.siti_distinti, dalPulsante.siti_distinti]));
    const rg = rigaG(G, sito);
    const d = sitoD(D, sito);
    const r = dalPulsante.riconciliazione || {};
    verifica(`${sito}: Giacenze ${kg} kg e ${n} ordini; elenco dal pulsante e dal menu, riconciliazione e Dichiarazioni lo stesso numero, al chilo`,
      Math.round(rg.giacenza_rete_t * 1000) === kg && rg.ordini_da_dichiarare === n
        && dalPulsante.totale_kg === kg && dalPulsante.totale_righe === n && dalMenu.totale_kg === kg && dalMenu.totale_righe === n
        && r.giacenza_kg === kg && r.ordini_pulsante === n && r.aggiunti_n === dopo && dalMenu.riconciliazione.giacenza_kg === kg
        && Math.round(d.giacenza_portale_t * 1000) === kg && dalPulsante.per_mese.reduce((s, m) => s + m.kg, 0) === kg,
      J({ G: [rg.giacenza_rete_t, rg.ordini_da_dichiarare], L: [dalPulsante.totale_kg, dalPulsante.totale_righe], M: [dalMenu.totale_kg, dalMenu.totale_righe], r: [r.giacenza_kg, r.ordini_pulsante, r.aggiunti_n], D: d.giacenza_portale_t }));
    verifica(`${sito}: le Dichiarazioni, mese per mese, dicono quello che dice l'elenco`, J(restaPerMese(d)) === J(elencoPerMese(dalPulsante)), `${J(restaPerMese(d))} / ${J(elencoPerMese(dalPulsante))}`);
  }
  const iri = await ordini({ sito: IRI, ruolo: 'imp', tutte: true });
  const viaN = iri.righe.filter(x => x.destinazione_secondaria === IRI && x.nel_file);
  verifica('Irigom: le due righe passate da Nappi Sud stanno in ottobre, il mese della secondaria, e lo dicono',
    viaN.length === 2 && viaN.every(x => x.giorno_al_sito === '2026-10-02' && x.fine_trasporto.startsWith('2026-09')), J(viaN.map(x => [x.ordine_primaria, x.fine_trasporto, x.giorno_al_sito])));
  const secR = iri.righe.find(x => x.ordine_secondaria === 'SN26000002');
  verifica('Irigom: la secondaria arrivata dopo il file e\' una riga, scritta come quelle passate da uno stoccaggio',
    secR && secR.nel_file === false && secR.destinazione === NAPPI && secR.destinazione_secondaria === IRI && secR.carico.tipo === 'secondaria' && secR.carico.da === NAPPI, J(secR));
  verifica('Tecnogum: la rete non la dichiara, nessun carico aggiunto e la riga lo dice', (await ordini({ sito: TEC, ruolo: 'imp' })).riconciliazione.non_dovuta === true && !(await ordini({ sito: TEC })).totale_righe);
  const tutti = await ordini({});
  const sommaImpianti = (G.righe || []).filter(x => x.tipo_destinazione === 'imp' && x.giacenza_rete_t !== null).reduce((s, x) => s + Math.round(x.giacenza_rete_t * 1000), 0);
  const ordiniImpianti = (G.righe || []).filter(x => x.tipo_destinazione === 'imp').reduce((s, x) => s + x.ordini_da_dichiarare, 0);
  verifica('tutti i siti: gli impianti fanno 1.768.010 kg e 594 ordini, la somma delle giacenze e dei pulsanti degli impianti nelle Giacenze',
    tutti.parti.imp.kg === 1768010 && tutti.parti.imp.kg === sommaImpianti && tutti.parti.imp.ordini === 594 && tutti.parti.imp.ordini === ordiniImpianti, J([tutti.parti.imp, sommaImpianti, ordiniImpianti]));
  verifica('tutti i siti: la riga impianto per impianto arriva allo stesso totale, Tecnogum per accordo a parte',
    tutti.riconciliazione_siti && tutti.riconciliazione_siti.giacenza_kg === 1768010 && tutti.riconciliazione_siti.ordini_pulsante === 594
      && tutti.riconciliazione_siti.impianti.find(x => x.sito === TEC).non_dovuta === true && tutti.riconciliazione_siti.impianti.find(x => x.sito === TRS).giacenza_kg === 12560,
    J(tutti.riconciliazione_siti && tutti.riconciliazione_siti.impianti.map(x => [x.sito, x.giacenza_kg, x.ordini_pulsante, x.non_dovuta])));
  verifica('tutti i siti: i mesi comprendono i carichi di tutti gli impianti (ottobre: 48 arrivati dopo il file, 150.790 kg)',
    ott(tutti).dopo_il_file.ordini === 48 && ott(tutti).dopo_il_file.kg === 150790 && tutti.per_mese.reduce((s, m) => s + m.imp.kg, 0) === 1768010, J(ott(tutti)));
  verifica('T.R.S., che nel file non c\'e\', si sceglie dal menu', tutti.siti_distinti.includes(TRS), J(tutti.siti_distinti));
  const pdf = await caricaLibPagine('lib/giacenzePdf');
  const a = pdf.daDichiararePdf(2026, await ordini({ tutte: true }), {});
  verifica('il PDF di tutti i siti: nelle note la riga impianto per impianto, col totale degli impianti',
    a.note.some(n => /^Riconciliazione con le giacenze, impianto per impianto/.test(n) && /Impianti: 594 ordini, 1\.768\.010 kg/.test(n) && /TECNOGUM SRL: per accordo non ci dichiara la rete/.test(n)), J(a.note));
}

console.log("8. LA REVISIONE DEL 15/10/2026: UN CARICO TERMINATO PRIMA DEL FILE, LE NOTE DELL'EXCEL, LE COLONNE PER LA PAGINA");
{
  // a. Un carico terminato il 05/10 che il file del 09/10 non ha (un ordine
  //    chiuso a portale dopo il file): entra nell'elenco e nella giacenza come
  //    gli altri, ma non e' «arrivato dopo il file», e nessuna scritta lo dice.
  casoTCycle();
  metti('PrimariaRete', [primaria('ET26150000', TCY, 2000, '2026-10-05')]);
  const G = await giacenze();
  const L = await ordini({ sito: TCY, ruolo: 'imp', tutte: true });
  const del5 = L.righe.find(x => x.ordine_primaria === 'ET26150000');
  const quattro = L.righe.filter(x => QUATTRO.some(p => p.id_ordine === x.ordine_primaria));
  verifica('premessa: le Giacenze lo contano (374,92 t, 123 ordini) e l\'elenco dice lo stesso',
    rigaG(G, TCY).giacenza_rete_t === 374.92 && rigaG(G, TCY).ordini_da_dichiarare === 123 && L.totale_kg === 374920 && L.totale_righe === 123, J([rigaG(G, TCY).giacenza_rete_t, rigaG(G, TCY).ordini_da_dichiarare, L.totale_kg, L.totale_righe]));
  verifica('la riga del 05/10 non e\' arrivata dopo il file; i 4 del 12-13/10 si\'',
    del5 && del5.nel_file === false && del5.arrivato_dopo_il_file === false && quattro.length === 4 && quattro.every(x => x.nel_file === false && x.arrivato_dopo_il_file === true)
      && L.righe.filter(x => x.nel_file).every(x => x.arrivato_dopo_il_file === false), J(del5));
  verifica('le parti: 5 carichi che il file non ha, 10.120 kg, di cui 4 arrivati dopo il giorno del file', J(L.parti.dopo_il_file) === J({ ordini: 5, kg: 10120, arrivati_dopo: 4 }), J(L.parti.dopo_il_file));
  const pdf = await caricaLibPagine('lib/giacenzePdf');
  verifica('la colonna «Nel file del portale»: «no, non ancora nel file del 09/10/2026 (terminato il 05/10/2026)» per il 05/10, «no, arrivato dopo il file del 09/10/2026» per i 4',
    pdf.testoNelFile(del5, L.foto_del) === 'no, non ancora nel file del 09/10/2026 (terminato il 05/10/2026)' && quattro.every(x => pdf.testoNelFile(x, L.foto_del) === 'no, arrivato dopo il file del 09/10/2026'),
    J([pdf.testoNelFile(del5, L.foto_del), pdf.testoNelFile(quattro[0], L.foto_del)]));
  // Lo stesso giorno del file non si sa se prima o dopo la fotografia: «non ancora nel file».
  verifica('un carico del 09/10, il giorno del file, e\' «non ancora nel file»', pdf.fuoriDalFile({ nel_file: false, arrivato_dopo_il_file: false, fine_trasporto: '2026-10-09', giorno_al_sito: '2026-10-09' }, '2026-10-09') === 'non ancora nel file del 09/10/2026 (terminato il 09/10/2026)');
  const a = pdf.daDichiararePdf(2026, L, { sito: TCY, ruolo: 'imp' });
  const u = a.sezioni[1].colonne.length - 1;
  verifica('il PDF: in testa «Non ancora nel file» 5, mai «Arrivati dopo il file»; la nota del totale dice «5 carichi non ancora nel file»',
    a.riepilogo.some(x => x.etichetta === 'Non ancora nel file' && x.valore === 5) && !a.riepilogo.some(x => /Arrivati dopo/.test(x.etichetta))
      && a.note.includes('Il totale: 118 ordini nel file del 09/10/2026 (364.800 kg) + 5 carichi non ancora nel file (10.120 kg) = 123 ordini, 374.920 kg.'), J([a.riepilogo, a.note]));
  verifica('il PDF: una riga «non ancora nel file» e 4 «arrivato dopo il file»',
    a.sezioni[1].righe.filter(r => r.celle[u] === 'no, non ancora nel file del 09/10/2026 (terminato il 05/10/2026)').length === 1 && a.sezioni[1].righe.filter(r => r.celle[u] === 'no, arrivato dopo il file del 09/10/2026').length === 4);
  // La scheda vera. Ottobre sta nella seconda pagina: la funzione finta la da'
  // subito, come se si fosse girata pagina.
  const c = clienteFinto({ funzioni: { getOrdiniDaDichiarare: async (p) => ordini({ ...p, offset: (p.offset || 0) + 100 }) } });
  globalThis.__CLIENTE_FINTO = c.cliente;
  const m = tabella.monta(tabella.Componente, { filtroSitoEsterno: TCY, filtroRuoloEsterno: 'imp', onPulisciFiltroSito: () => {}, righeGiacenze: G.righe });
  await aspetta(40);
  const s = testo(m.albero).replace(/\s+/g, ' ');
  verifica('la scheda: «118 nel file del 09/10/2026 + 5 non ancora nel file (10.120 kg)», non «+ 5 arrivati dopo»',
    /123 ordini/.test(s) && /118 nel file del 09\/10\/2026 \+ 5 non ancora nel file \(10\.120 kg\)/.test(s) && !/\+ 5 arrivati dopo/.test(s) && !m.errori.length, s.slice(0, 700));
  verifica('la scheda: la riga del 05/10 dice «non ancora nel file del 09/10/2026 (terminato il 05/10/2026)», le 4 «arrivato dopo il file del 09/10/2026»',
    (s.match(/non ancora nel file del 09\/10\/2026 \(terminato il 05\/10\/2026\)/g) || []).length === 1 && (s.match(/arrivato dopo il file del 09\/10\/2026/g) || []).length === 4, s.slice(-2500));
  m.smonta();
  // Con i soli 4 la testa resta «+ 4 arrivati dopo» (sezione 6): la parola cambia
  // solo quando non e' vera per tutti.

  // b. Le note dell'Excel sono quelle del PDF, coi filtri della scheda. Prima
  //    l'Excel chiamava le note senza filtri: dal pulsante di uno stoccaggio
  //    diceva che l'elenco comprende i carichi arrivati dopo, e non diceva gli
  //    arrivi senza fine trasporto.
  const scritti = [];
  globalThis.__XLSX_CARICHI_DOPO = {
    utils: {
      book_new: () => ({ fogli: [] }), aoa_to_sheet: (aoa) => ({ aoa }),
      book_append_sheet: (wb, ws, nome) => { wb.fogli.push({ nome, aoa: ws.aoa }); },
      decode_range: () => ({ s: { r: 0, c: 0 }, e: { r: 0, c: 0 } }), encode_cell: () => 'A1',
    },
    writeFile: (wb, nome) => { scritti.push({ nome, aoa: wb.fogli[0].aoa }); },
  };
  const xl = await caricaLibPagine('lib/giacenzeDaDichiarareExport', [["const XLSX = await import('xlsx');", 'const XLSX = globalThis.__XLSX_CARICHI_DOPO;']]);
  const excel = async (dati, filtri) => { await xl.exportDaDichiarareExcel(dati.righe, dati.totale_righe, dati.totale_kg, { carichi_del: null, dati, ...(filtri ? { filtri } : {}) }); return scritti[scritti.length - 1].aoa; };
  casoTCycle();
  const imp = await ordini({ sito: TCY, ruolo: 'imp', tutte: true });
  const filtriImp = { sito: TCY, ruolo: 'imp', senza_fine_ignoti: { n: 1, kg: 2500 } };
  const notePdfImp = pdf.daDichiararePdf(2026, imp, filtriImp).note;
  const noteXlImp = noteExcel(await excel(imp, filtriImp));
  verifica("T-Cycle impianto: le note dell'Excel sono quelle del PDF, compresa quella dell'arrivo senza fine trasporto",
    J(noteXlImp) === J(notePdfImp) && noteXlImp.some(n => /^1 arrivo di rete senza fine trasporto \(2\.500 kg\)/.test(n)), J([noteXlImp, notePdfImp]));
  const stoc = await ordini({ sito: TCY, ruolo: 'stoc', tutte: true });
  const filtriStoc = { sito: TCY, ruolo: 'stoc', per_noi_chiusi: 'ripartiti a Tecnogum' };
  const notePdfStoc = pdf.daDichiararePdf(2026, stoc, filtriStoc).note;
  const noteXlStoc = noteExcel(await excel(stoc, filtriStoc));
  verifica("T-Cycle stoccaggio dal pulsante: le note dell'Excel sono quelle del PDF, e nessuna dice che l'elenco comprende i carichi arrivati dopo",
    J(noteXlStoc) === J(notePdfStoc) && !noteXlStoc.some(n => /di solito arrivati dopo|piu’ i carichi/.test(n)) && noteXlStoc.some(n => /^Per noi chiusi: ripartiti a Tecnogum\./.test(n)), J([noteXlStoc, notePdfStoc]));
  const noteSenzaFiltri = noteExcel(await excel(stoc));
  verifica("e anche chiamato senza filtri, l'Excel dello stoccaggio non lo dice: lo sa dalla risposta (i carichi non si sono cercati)",
    stoc.carichi_dopo_il_file.cercati === false && !noteSenzaFiltri.some(n => /piu’ i carichi/.test(n)), J(noteSenzaFiltri));
  // La scheda da' ai due documenti gli stessi filtri: una funzione sola.
  const sorgente = readFileSync(qui('../src/components/giacenze/DaDichiarareTable.jsx'), 'utf8').replace(/\r/g, '');
  verifica('la scheda passa al PDF e all\'Excel gli stessi filtri (filtriDocumento)',
    /daDichiararePdf\([^;]*res\.data, \{ \.\.\.filtriDocumento\(\) \}\)/.test(sorgente) && /exportDaDichiarareExcel\([^;]*filtri: filtriDocumento\(\) \}\)/.test(sorgente));

  // c. Le colonne sul file del portale, per ogni foglio con l'elenco: anche il
  //    foglio «Da dichiarare» dell'Excel di tutta la pagina Giacenze le scrive
  //    uguali (src/lib/giacenzeExportAll.js, dalla chiusura del giro: parte d).
  const aoa = await excel(imp, { sito: TCY, ruolo: 'imp' });
  //    Stanno in giacenzePdf.js, che non importa niente: le prove dell'Excel
  //    della pagina lo caricano cosi' com'e', e fingono invece l'import da
  //    giacenzeDaDichiarareExport.
  verifica('INTESTAZIONI_NEL_FILE e celleNelFile (giacenzePdf.js): le ultime tre colonne del foglio della scheda',
    J(pdf.INTESTAZIONI_NEL_FILE) === J(['Nel file del portale', "Arrivato all'impianto il", 'Dichiarato a portale dopo il file (kg)']) && J(aoa[0].slice(-3)) === J(pdf.INTESTAZIONI_NEL_FILE)
      && J(pdf.celleNelFile(del5, '2026-10-09')) === J(['no, non ancora nel file del 09/10/2026 (terminato il 05/10/2026)', '', ''])
      && J(pdf.celleNelFile({ nel_file: true, fine_trasporto: '2026-09-28', giorno_al_sito: '2026-10-02', dichiarato_dopo_kg: 1200 }, '2026-10-09')) === J(['sì', '02/10/2026', 1200]), J(aoa[0]));
  verifica("giacenzePdf.js resta senza import, perche' l'Excel della pagina lo possa usare nelle prove come e'",
    !/^import\s/m.test(readFileSync(qui('../src/lib/giacenzePdf.js'), 'utf8')));

  // d. L'Excel di tutta la pagina Giacenze (chiusura del giro del 15/10/2026).
  //    Il suo foglio «Da dichiarare» riceve da getOrdiniDaDichiarare({ tutte:
  //    true }) anche i carichi che il file non ha, e li scriveva come le altre
  //    righe: nessuna colonna diceva quali erano, e una secondaria arrivata dopo
  //    il file usciva con la colonna Ordine vuota. Ora, con le funzioni vere,
  //    le righe fino al TOTALE sono quelle del foglio della scheda, cella per
  //    cella (le due colonne del formulario sono le stesse funzioni della
  //    scheda), il TOTALE e' la somma delle giacenze degli impianti, e sotto ci
  //    sono le note dell'elenco, le prime del foglio della scheda.
  globalThis.__TESTI_SCHEDA_CARICHI_DOPO = xl;
  const paginaXl = await caricaLibPagine('lib/giacenzeExportAll', [
    ["import { documentoDa, nuovaCartella, foglioDaRighe, scaricaCartella, FORMATI } from '@/lib/fogliProfessionali';",
      'const documentoDa = async () => ({}); const nuovaCartella = async () => ({ wb: {} }); const foglioDaRighe = (_wb, nome, o) => { globalThis.__FOGLI_CARICHI_DOPO[nome] = o; }; const scaricaCartella = async () => {}; const FORMATI = {};'],
    ["import { testoFormulario, testoCollocato } from '@/lib/giacenzeDaDichiarareExport';", 'const { testoFormulario, testoCollocato } = globalThis.__TESTI_SCHEDA_CARICHI_DOPO;'],
    ["import { INTESTAZIONE_DATE, righeExcelDate } from '@/components/giacenze/DateDaSistemare';", "const INTESTAZIONE_DATE = ['Data']; const righeExcelDate = () => [];"],
  ]);
  const finoAlTotale = (righe) => righe.slice(0, righe.findIndex(r => r[0] === 'TOTALE') + 1);
  const scenarioPagina = async (dichiaratoDopo) => {
    nuovo();
    metti('GiacenzaSito', [IRI, TCY].map(sito => ({ sito, tipo_destinazione: 'imp', anno: 2026, dichiara_rete: true })).concat([{ sito: NAPPI, tipo_destinazione: 'stoc', anno: 2026 }]));
    const file = [...carichiDelMese('EI26', IRI, '2026-09', 5, 15000), ...carichiDelMese('ET26', TCY, '2026-09', 5, 15000)];
    metti('PrimariaRete', [...file, QUATTRO[0]]);
    metti('Secondaria', [{ ...primaria('SN26000002', IRI, 3120, '2026-10-12'), stoccaggio: NAPPI }]);
    metti('OrdineNonDichiarato', file.map(p => nelFile(p)));
    if (dichiaratoDopo) metti('DichiarazioneSito', [{ sito: TCY, anno: 2026, mese: 'Settembre', canale: 'RETE', provenienza: '', quantita_kg: dichiaratoDopo, caricata_inviata: true, caricata_il: '2026-10-10' }]);
    const G = await giacenze();
    const tutte = await ordini({ tutte: true });
    globalThis.__FOGLI_CARICHI_DOPO = {};
    await paginaXl.exportGiacenzeAllExcel(G, tutte, 2026);
    const foglio = globalThis.__FOGLI_CARICHI_DOPO['Da dichiarare'];
    const scheda = await excel(tutte, {});
    const giacenzaImpianti = (G.righe || []).filter(x => x.tipo_destinazione === 'imp' && x.giacenza_rete_t !== null).reduce((s, x) => s + Math.round(x.giacenza_rete_t * 1000), 0);
    return { tutte, foglio, righe: foglio.righe, scheda, giacenzaImpianti };
  };
  const P = await scenarioPagina(0);
  const rigaDi = (righe, ordine) => righe.find(r => r[0] === ordine);
  verifica("la pagina: il foglio «Da dichiarare» ha in fondo le tre colonne sul file del portale", J(P.righe[0].slice(-3)) === J(pdf.INTESTAZIONI_NEL_FILE), J(P.righe[0]));
  verifica("la pagina: la secondaria arrivata dopo il file ha il suo numero d'ordine e dice che non e' nel file del 09/10/2026, come la primaria di T-Cycle",
    (rigaDi(P.righe, 'SN26000002') || [])[14] === 'no, arrivato dopo il file del 09/10/2026' && (rigaDi(P.righe, 'ET26166301') || [])[14] === 'no, arrivato dopo il file del 09/10/2026'
      && P.righe.filter(r => r[14] === 'sì').length === 10, J([rigaDi(P.righe, 'SN26000002'), rigaDi(P.righe, 'ET26166301')]));
  verifica('la pagina: le righe fino al TOTALE sono quelle del foglio della scheda, cella per cella', J(finoAlTotale(P.righe)) === J(finoAlTotale(P.scheda)),
    J([finoAlTotale(P.righe).length, finoAlTotale(P.scheda).length]));
  verifica('la pagina: il TOTALE e\' la somma delle giacenze di rete degli impianti della Situazione (37.060 kg)',
    rigaDi(P.righe, 'TOTALE')[8] === P.tutte.totale_kg && P.tutte.totale_kg === P.giacenzaImpianti && P.giacenzaImpianti === 37060, J([rigaDi(P.righe, 'TOTALE'), P.giacenzaImpianti]));
  const noteP = noteExcel(P.righe);
  verifica("la pagina: sotto il TOTALE le note dell'elenco, le prime del foglio della scheda, con lo stile delle note",
    noteP.length > 0 && J(noteP) === J(pdf.noteElencoDaDichiarare(P.tutte, {})) && J(noteP) === J(noteExcel(P.scheda).slice(0, noteP.length))
      && noteP.some(n => /piu’ i carichi che il gestionale conosce/.test(n)) && noteP.some(n => /^Riconciliazione con le giacenze, impianto per impianto/.test(n))
      && Object.keys(P.foglio.stili || {}).length === noteP.length && Object.values(P.foglio.stili).every(v => v === 'nota'), J([noteP, P.foglio.stili]));
  const O = await scenarioPagina(20000);
  const rOltre = O.righe.find(r => /oltre i carichi/.test(String(r[0])));
  const somma = finoAlTotale(O.righe).slice(1, -1).reduce((s, r) => s + (Number(r[8]) || 0), 0);
  verifica("la pagina, col dichiarato oltre i carichi: una riga a parte, il TOTALE e' la somma delle righe e la giacenza degli impianti, come la scheda",
    O.tutte.parti.oltre_kg === 1060 && rOltre && rOltre[8] === -1060 && rigaDi(O.righe, 'TOTALE')[8] === somma && somma === O.giacenzaImpianti && J(finoAlTotale(O.righe)) === J(finoAlTotale(O.scheda)),
    J([O.tutte.parti, rOltre, rigaDi(O.righe, 'TOTALE'), somma, O.giacenzaImpianti]));
}

console.log('9. SUI DATI VERI');
const CARTELLA = process.env.DATI_VERI || qui('../../dati-veri/');
const copie = existsSync(CARTELLA) ? readdirSync(CARTELLA).filter(n => /^treadrider-dati-veri-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n)).sort() : [];
if (!copie.length) console.log(`  nessuna copia dei dati veri in ${CARTELLA}: sezione saltata`);
else {
  const nome = copie[copie.length - 1];
  const DATI = JSON.parse(gunzipSync(readFileSync(CARTELLA + nome)).toString('utf8'));
  globalThis.__ARCHIVI_CARICHI_DOPO = DATI.archivi;
  const ORA = DATI.meta.letto_fino_al;
  const ANNO = Number(String(ORA).slice(0, 4));
  console.log(`  copia ${nome}, letta il ${ORA}`);
  const G = await conOra(ORA, () => F.giacenze({ anno: ANNO }));
  const D = await conOra(ORA, () => F.riepilogo({ anno: ANNO }));
  const elenco = async (corpo) => {
    globalThis.__RICHIESTE_CARICHI_DOPO = [];
    const L = await conOra(ORA, () => F.ordini({ limite: 100, offset: 0, ...corpo }));
    return { ...L, richieste: [...globalThis.__RICHIESTE_CARICHI_DOPO] };
  };
  const impianti = (G.righe || []).filter(x => x.tipo_destinazione === 'imp');
  const misure = [];
  for (const rg of impianti) {
    const L = await elenco({ sito: rg.sito, ruolo: 'imp' });
    const M = await elenco({ sito: rg.sito });
    const d = sitoD(D, rg.sito);
    misure.push(`${rg.sito} ${L.richieste.length} richieste`);
    if (rg.giacenza_rete_t === null) {
      verifica(`${rg.sito}: la rete non la dichiara, e l'elenco lo dice`, L.riconciliazione && L.riconciliazione.non_dovuta === true, J(L.riconciliazione));
      continue;
    }
    const kg = Math.round(rg.giacenza_rete_t * 1000);
    verifica(`${rg.sito}: elenco (pulsante e menu) = giacenza a portale delle Giacenze = riconciliazione = Dichiarazioni, ${kg} kg e ${rg.ordini_da_dichiarare} ordini`,
      L.totale_kg === kg && L.totale_righe === rg.ordini_da_dichiarare && M.parti.imp.kg === kg && M.parti.imp.ordini === rg.ordini_da_dichiarare
        && L.riconciliazione.giacenza_kg === kg && L.riconciliazione.ordini_pulsante === rg.ordini_da_dichiarare && Math.round(d.giacenza_portale_t * 1000) === kg
        && L.per_mese.reduce((s, m) => s + m.kg, 0) === kg,
      J({ G: [rg.giacenza_rete_t, rg.ordini_da_dichiarare], L: [L.totale_kg, L.totale_righe], M: M.parti && M.parti.imp, r: L.riconciliazione && [L.riconciliazione.giacenza_kg, L.riconciliazione.ordini_pulsante], D: d.giacenza_portale_t }));
    verifica(`${rg.sito}: le Dichiarazioni Impianti, mese per mese, dicono quello che dice l'elenco`, J(restaPerMese(d, ANNO)) === J(elencoPerMese(L)), `${J(restaPerMese(d, ANNO))} / ${J(elencoPerMese(L))}`);
    verifica(`${rg.sito}: nessuna lettura per riga (al piu' 8 richieste)`, L.richieste.length <= 8, J(L.richieste));
  }
  const T = await elenco({});
  const somma = impianti.filter(x => x.giacenza_rete_t !== null).reduce((s, x) => s + Math.round(x.giacenza_rete_t * 1000), 0);
  verifica('tutti i siti: gli impianti dell\'elenco sono la somma delle giacenze di rete degli impianti, e la riga impianto per impianto lo stesso',
    T.parti.imp.kg === somma && T.riconciliazione_siti && T.riconciliazione_siti.giacenza_kg === somma, J([T.parti.imp, somma, T.riconciliazione_siti && T.riconciliazione_siti.giacenza_kg]));
  verifica('tutti i siti: non piu\' richieste di prima (erano 9)', T.richieste.length <= 9, J(T.richieste));
  // Il menu dei siti, scelto un impianto, e' quello di tutti i siti (revisione
  // del 15/10/2026), senza letture in piu': le richieste restano quelle sopra.
  const menuDiversi = [];
  for (const rg of impianti) {
    const M = await elenco({ sito: rg.sito });
    if (J(M.siti_distinti) !== J(T.siti_distinti)) menuDiversi.push([rg.sito, M.siti_distinti]);
  }
  verifica('scelto ogni impianto, il menu dei siti e\' quello di tutti i siti', !menuDiversi.length, J(menuDiversi));
  console.log(`  carichi che il file non ha: ${T.parti.dopo_il_file.ordini} (${T.parti.dopo_il_file.kg} kg), di cui arrivati dopo il giorno del file ${T.parti.dopo_il_file.arrivati_dopo}`);
  // L'ottobre di T-Cycle sulla copia dell'11/10: i carichi del 12-13/10 non ci
  // sono ancora, e i quattro moduli dicono 40.920 kg.
  const tc = impianti.find(x => /T-CYCLE/i.test(x.sito));
  if (tc) {
    const L = await elenco({ sito: tc.sito, ruolo: 'imp' });
    const d = sitoD(D, tc.sito);
    const ottD = (d.flussi || []).filter(f => f.canale === 'RETE').reduce((t, f) => ({ conferito: t.conferito + f.mesi[9].conferito_kg, resta: t.resta + f.mesi[9].resta_kg }), { conferito: 0, resta: 0 });
    const term = (DATI.archivi.PrimariaRete || []).filter(p => p.destinazione === tc.sito && eTerminato(p) && String(giornoMovimento(p) || '').startsWith(`${ANNO}-10`) && String(p.tipo_destinazione || '').toLowerCase().startsWith('imp'));
    const termKg = term.reduce((s, p) => s + (Number(p.peso_effettivo) || 0), 0);
    verifica(`T-Cycle, ottobre sulla copia: elenco ${ott(L).kg} kg = Dichiarazioni entrati e da dichiarare = Terminati Rete`, ott(L).kg === ottD.conferito && ott(L).kg === ottD.resta && ott(L).kg === termKg, J([ott(L), ottD, termKg]));
    console.log(`  T-Cycle, ottobre: ${ott(L).ordini} ordini, ${ott(L).kg} kg in tutti e quattro`);
  }
  console.log(`  richieste: tutti i siti ${T.richieste.length} (${T.richieste.join(', ')}); ${misure.join('; ')}`);
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
