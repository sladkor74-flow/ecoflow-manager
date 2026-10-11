// LA PROVA DEL 2 GENNAIO 2027 (chiusura dell'audit, 11/10/2026).
//
// Quasi tutti i difetti trovati dall'audit sulle Dichiarazioni avevano la
// stessa forma: sui dati di ottobre non si vedono, e scattano al cambio d'anno.
// L'apertura non ancora dichiarata mancava dalla colonna «Da dichiarare» e
// accendeva un falso avviso; per ACI ed extra la colonna non era la giacenza;
// ogni piazzale andava «da verificare» per tutto l'anno; il 2026 guardato a
// gennaio - la vista con cui lo si chiude - si confrontava col portale di oggi;
// l'elenco degli ordini da dichiarare non tornava con il pulsante.
//
// Qui un archivio simulato a cavallo d'anno, con l'orologio fermo: la sera del
// 31/12/2026 e il pomeriggio del 02/01/2027, dopo la chiusura (aperture degli
// impianti e rilevazione del 31/12 dei piazzali), la fotografia del portale del
// 02/01 e i primi carichi di gennaio. Le funzioni VERE - calcolaGiacenze,
// riepilogoDichiarazioni, getOrdiniDaDichiarare - girano insieme su un SDK finto,
// e devono rispettare un invariante solo:
//   per ogni impianto e canale, somma della riga «Da dichiarare» = giacenza del
//   canale = numero delle Giacenze;
//   per ogni impianto, riconciliazione dell'elenco = giacenza delle Giacenze, e
//   ordini dell'elenco + carichi non ancora nel file = numero del pulsante;
//   il 2026 guardato il 02/01/2027 dice gli stessi numeri del 2026 guardato il
//   31/12/2026.
// La revisione della chiusura (11/10/2026) ha aggiunto i due casi che il 2
// gennaio non vede: le prime navi del 2027, che il portale aggancia ai carichi
// del 2026, e un anno chiuso guardato dopo la prima lettura dell'anno nuovo; e
// l'apertura dei piazzali, che deve essere la stessa nei due moduli.
// npm run prove
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const vicino = (a, b, tolleranza = 0.006) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= tolleranza;

// --- L'SDK finto: uguaglianza, $gte, $lte e $in, come la piattaforma ---
const ARCHIVI = {};
globalThis.__ARCHIVI_2_GENNAIO = ARCHIVI;
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
  list: async (_o, lim = 1e9, skip = 0) => ordina(globalThis.__ARCHIVI_2_GENNAIO[nome] || []).slice(skip, skip + lim),
  filter: async (f, _o, lim = 1e9, skip = 0) => ordina((globalThis.__ARCHIVI_2_GENNAIO[nome] || []).filter(r => soddisfa(r, f))).slice(skip, skip + lim),
  create: async (r) => r, update: async (_id, r) => r, delete: async () => ({}),
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: 'admin', email: 'prova' }) }, asServiceRole: { entities }, entities };
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
  return async (corpo) => (await modulo.default({ json: async () => corpo })).json();
};
const giacenze = await funzione('calcolaGiacenze');
const riepilogo = await funzione('riepilogoDichiarazioni');
const ordini = await funzione('getOrdiniDaDichiarare');

// --- L'orologio fermo, per tutta la durata di una chiamata ---
const OraVera = Date;
const conOra = async (iso, f) => {
  const ms = OraVera.parse(iso);
  globalThis.Date = class extends OraVera {
    constructor(...a) { if (a.length) super(...a); else super(ms); }
    static now() { return ms; }
  };
  try { return await f(); } finally { globalThis.Date = OraVera; }
};
const SERA_31 = '2026-12-31T20:00:00Z';   // le 21 a Roma
const POMERIGGIO_2 = '2027-01-02T16:00:00Z'; // le 17 a Roma

// --- L'archivio ---
let seq = 0;
const con = (nome, righe) => { ARCHIVI[nome] = righe.map(r => ({ id: 'r' + String(++seq).padStart(5, '0'), ...r })); };
const g = (giorno) => `${giorno}T08:00:00Z`;
const primaria = (id, dest, kg, giorno, extra = {}) => ({
  id_ordine: id, numero_fir: 'FIR' + id, classe: 'P - fino a 35 kg', prodotto: '.class1', destinazione: dest,
  tipo_destinazione: 'imp', stato: 'terminato', peso_effettivo: kg, trasportatore: 'RACCOLTA SRL', provincia: 'NA',
  ordine_immesso_il: g(giorno), trasporto_iniziato_il: g(giorno), trasporto_finito_il: g(giorno), ordine_chiuso_il: g(giorno), ...extra,
});
const riga = (ordine, dest, kg, fine, quando, extra = {}) => ({
  ordine_primaria: ordine, prodotto: '.class1', partner_operativo: 'SMOCO S.r.l.', destinazione: dest,
  fine_trasporto: fine, data_dichiarazione: quando, peso_associato_kg: kg, id_dichiarazione: 'D-' + ordine, ...extra,
});
const nelFile = (ordine, dest, kg, fine, foto, extra = {}) => ({
  ordine_primaria: ordine, destinazione: dest, prodotto: '.class1', peso_non_dichiarato_kg: kg, created_date: `${foto}T06:00:00Z`, fine_trasporto: fine, ...extra,
});
const dich = (sito, mese, canale, kg, caricata_il, extra = {}) => ({
  sito, anno: 2026, mese, canale, provenienza: '', operazione: 'R3', quantita_kg: kg,
  caricata_inviata: !!caricata_il, caricata_il: caricata_il || '', ...extra,
});

const IRI = 'IRIGOM SRL';            // R1: dichiara con la nave, svuota i mesi di prima
const ALFA = 'ALFA RECYCLING SRL';   // R3: dichiara mese per mese, due campagne di extra raccolta
const NAPPI = 'NAPPI SUD SRL';       // piazzale puro
const TEC = 'TECNOGUM SRL';          // la rete non la dichiara, per accordo

const VUOTI = ['DichiarazioneTrattamento', 'Terziaria', 'ImpiantoTargetSecondaria', 'TargetRaccoglitore', 'TargetMensile',
  'GiacenzaStoccaggio', 'IndicatoreGiorno', 'PrimariaAci', 'ExtraRaccolta', 'Secondaria', 'OrdineNonDichiarato',
  'DichiarazioneSito', 'GiacenzaSito', 'PrimariaRete', 'CommessaEcotyre'];

// LA SERA DEL 31/12/2026. Irigom: 100 t dal 2025, 1.100 t arrivate, due navi
// (marzo 300 t, settembre 300 t), 20 t di ACI; restano 600 t di rete. Alfa: 65 t
// arrivate (10 in secondaria dal piazzale) e 40 dichiarate, restano le 25 t di
// dicembre; maggio ha due campagne di extra raccolta, 300 kg caricati e 200 no.
// Nappi Sud: 40 t di rete e 3 di ACI al 31/12/2025, +25 t, -10 t in secondaria.
const archivioDel31 = () => {
  for (const v of VUOTI) con(v, []);
  con('GiacenzaSito', [
    { sito: IRI, tipo_destinazione: 'imp', anno: 2026, dichiara_rete: true, tipologia_trattamento: 'Frantumazione', giacenza_riferimento_t: 100 },
    { sito: ALFA, tipo_destinazione: 'imp', anno: 2026, dichiara_rete: true, tipologia_trattamento: 'EoW' },
    { sito: NAPPI, tipo_destinazione: 'stoc', anno: 2026 },
    { sito: TEC, tipo_destinazione: 'imp', anno: 2026, dichiara_rete: false },
  ]);
  con('PrimariaRete', [
    primaria('ET25000001', IRI, 100000, '2025-11-10'),
    primaria('ET26000001', IRI, 200000, '2026-01-20'),
    primaria('ET26000002', IRI, 300000, '2026-06-15'),
    primaria('ET26000003', IRI, 400000, '2026-11-12'),
    primaria('ET26000004', IRI, 200000, '2026-12-15'),
    primaria('ET26000020', ALFA, 30000, '2026-11-10'),
    primaria('ET26000021', ALFA, 25000, '2026-12-10'),
    primaria('ET26000030', NAPPI, 10000, '2026-06-10', { tipo_destinazione: 'stoc' }),
    primaria('ET26000031', NAPPI, 15000, '2026-11-20', { tipo_destinazione: 'stoc' }),
    primaria('ET26000040', TEC, 5000, '2026-12-05'),
  ]);
  con('PrimariaAci', [{ ...primaria('ET26000010', IRI, 20000, '2026-10-05'), classe: 'PFU Autodemolizione', prodotto: '.class9' }]);
  con('Secondaria', [{ ...primaria('SEC26000001', ALFA, 10000, '2026-07-10'), stoccaggio: NAPPI }]);
  con('ExtraRaccolta', [
    { ...primaria('PHX0001', ALFA, 300, '2026-05-10'), tipo_movimento: 'primaria' },
    { ...primaria('PHX0002', ALFA, 200, '2026-05-22'), tipo_movimento: 'primaria' },
  ]);
  con('DichiarazioneSito', [
    dich(IRI, 'Marzo', 'RETE', 300000, '2026-03-20', { operazione: 'R1' }),
    dich(IRI, 'Settembre', 'RETE', 300000, '2026-09-20', { operazione: 'R1' }),
    dich(ALFA, 'Luglio', 'RETE', 10000, '2026-08-05'),
    dich(ALFA, 'Novembre', 'RETE', 30000, '2026-12-05'),
    dich(ALFA, 'Maggio', 'EXTRA_RACCOLTA', 300, '2026-06-10'),
    dich(ALFA, 'Maggio', 'EXTRA_RACCOLTA', 200, ''),
  ]);
  con('DichiarazioneTrattamento', [
    riga('ET25000001', IRI, 100000, '2025-11-10', '2026-03-20'),
    riga('ET26000001', IRI, 200000, '2026-01-20', '2026-03-20'),
    riga('ET26000002', IRI, 300000, '2026-06-15', '2026-09-20'),
    riga('ET26000020', ALFA, 30000, '2026-11-10', '2026-12-05'),
    riga('ET26000030', NAPPI, 10000, '2026-06-10', '2026-08-05', { destinazione_secondaria: ALFA, ordine_secondaria: 'SEC26000001' }),
  ]);
  con('OrdineNonDichiarato', [
    nelFile('ET26000003', IRI, 400000, '2026-11-12', '2026-12-31'),
    nelFile('ET26000004', IRI, 200000, '2026-12-15', '2026-12-31'),
    nelFile('ET26000021', ALFA, 25000, '2026-12-10', '2026-12-31'),
    nelFile('ET26000031', NAPPI, 15000, '2026-11-20', '2026-12-31'),
  ]);
  con('GiacenzaStoccaggio', [
    { sito: NAPPI, data_rilevazione: '2025-12-31', class1_kg: 40000, class2_kg: 0, class3_kg: 0, class4_kg: 0, class9_kg: 3000, created_date: '2026-01-02T09:00:00Z' },
  ]);
};

// IL 02/01/2027. La chiusura e' fatta: le aperture degli impianti dalla lettura
// del 31/12 (Irigom 600 t di rete e 20 di ACI, Alfa 25), la rilevazione del 31/12
// di Nappi Sud (55 t e 3), le righe dell'anno nuovo. E' arrivata la fotografia del
// 02/01 e i primi carichi di gennaio: 50 t a Irigom e 5 al piazzale, che il file
// non ha ancora, e una campagna di extra raccolta ad Alfa.
const chiusuraScritta = ({ aperture = true } = {}) => {
  ARCHIVI.GiacenzaSito.push(...[
    { sito: IRI, tipo_destinazione: 'imp', anno: 2027, dichiara_rete: true, tipologia_trattamento: 'Frantumazione', ...(aperture ? { giacenza_riferimento_t: 600, giacenza_riferimento_aci_t: 20, apertura_del: '2026-12-31' } : {}) },
    { sito: ALFA, tipo_destinazione: 'imp', anno: 2027, dichiara_rete: true, tipologia_trattamento: 'EoW', ...(aperture ? { giacenza_riferimento_t: 25, giacenza_riferimento_aci_t: 0, apertura_del: '2026-12-31' } : {}) },
    { sito: NAPPI, tipo_destinazione: 'stoc', anno: 2027 },
    { sito: TEC, tipo_destinazione: 'imp', anno: 2027, dichiara_rete: false },
  ].map(r => ({ id: 'r' + String(++seq).padStart(5, '0'), ...r })));
  if (aperture) {
    ARCHIVI.GiacenzaStoccaggio.push({ id: 'r' + String(++seq).padStart(5, '0'), sito: NAPPI, data_rilevazione: '2026-12-31', class1_kg: 55000, class2_kg: 0, class3_kg: 0, class4_kg: 0, class9_kg: 3000, created_date: '2027-01-02T09:00:00Z' });
  }
};
const gennaio = ({ fileSenza = [] } = {}) => {
  ARCHIVI.PrimariaRete.push(...[
    primaria('ET27000001', IRI, 50000, '2027-01-02'),
    primaria('ET27000030', NAPPI, 5000, '2027-01-02', { tipo_destinazione: 'stoc' }),
  ].map(r => ({ id: 'r' + String(++seq).padStart(5, '0'), ...r })));
  ARCHIVI.ExtraRaccolta.push({ id: 'r' + String(++seq).padStart(5, '0'), ...primaria('PHX2701', ALFA, 500, '2027-01-02'), tipo_movimento: 'primaria' });
  con('OrdineNonDichiarato', [
    nelFile('ET26000003', IRI, 400000, '2026-11-12', '2027-01-02'),
    nelFile('ET26000004', IRI, 200000, '2026-12-15', '2027-01-02'),
    nelFile('ET26000021', ALFA, 25000, '2026-12-10', '2027-01-02'),
    nelFile('ET26000031', NAPPI, 15000, '2026-11-20', '2027-01-02'),
  ].filter(r => !fileSenza.includes(r.ordine_primaria)));
};

// --- Le tre funzioni, alla stessa ora ---
const tutto = (ora, anno) => conOra(ora, async () => {
  const G = await giacenze({ anno });
  const D = await riepilogo({ anno });
  const L = {};
  for (const sito of [IRI, ALFA]) L[sito] = await ordini({ sito, ruolo: 'imp', riconcilia: true });
  return { G, D, L };
});
const rigaG = (G, sito, td = 'imp') => (G.righe || []).find(r => r.sito === sito && r.tipo_destinazione === td) || null;
const NUMERO_GIACENZE = { RETE: 'giacenza_rete_t', ACI: 'giacenza_aci_t', EXTRA_RACCOLTA: 'giacenza_extra_t' };

// L'INVARIANTE UNICO.
const invariante = ({ G, D, L }, quando) => {
  for (const s of (D.siti || []).filter(x => x.tipo_destinazione !== 'stoc')) {
    const rg = rigaG(G, s.sito);
    for (const canale of ['RETE', 'ACI', 'EXTRA_RACCOLTA']) {
      const gc = (s.giacenze_canale || []).find(c => c.canale === canale);
      const flussi = (s.flussi || []).filter(f => f.canale === canale);
      const somma = Math.round(flussi.reduce((t, f) => t + f.resta_t, 0) * 1000) / 1000;
      const numG = rg ? rg[NUMERO_GIACENZE[canale]] : undefined;
      if (gc && gc.giacenza_t === null) {
        // La rete di chi non la dichiara: «—» in tutti e due i moduli, e la riga non dice un resto.
        verifica(`${quando} · ${s.sito} · ${canale}: non dovuta, «—» in tutti e due i moduli`, numG === null && flussi.every(f => f.non_dovuta), JSON.stringify({ numG }));
        continue;
      }
      verifica(`${quando} · ${s.sito} · ${canale}: somma della riga ${somma} = giacenza del canale ${gc && gc.giacenza_t} = Giacenze ${numG}`,
        !!gc && vicino(somma, gc.giacenza_t) && vicino(gc.giacenza_t, numG));
      for (const f of flussi) {
        verifica(`${quando} · ${s.sito} · ${canale} ${f.provenienza}: nessun falso avviso sopra la tabella`,
          !f.uscito_oltre_kg && !f.uscito_non_allocato_kg, JSON.stringify({ oltre: f.uscito_oltre_kg, fuori: f.uscito_non_allocato_kg }));
      }
    }
    // La quadratura della rete torna (i dati sono coerenti apposta).
    if (s.dichiara_rete !== false) verifica(`${quando} · ${s.sito}: la rete quadra col portale`, s.quadra === true, JSON.stringify({ calcolata: s.giacenza_calcolata_t, portale: s.giacenza_portale_t }));
  }
  // I piazzali: calcolata e numero a portale partono dalla stessa ancora, e sono
  // il numero delle Giacenze.
  for (const s of (D.siti || []).filter(x => x.tipo_destinazione === 'stoc')) {
    const rg = rigaG(G, s.sito, 'stoc');
    const numG = rg ? rg[NUMERO_GIACENZE[s.canale]] : undefined;
    verifica(`${quando} · piazzale ${s.sito} · ${s.canale}: calcolata ${s.giacenza_calcolata_t} = portale ${s.giacenza_portale_t} = Giacenze ${numG}`,
      s.quadra === true && vicino(s.giacenza_calcolata_t, numG));
    // E l'apertura di rete e' la stessa nei due moduli: l'ancora portata al 31/12 (11/10/2026).
    if (s.canale === 'RETE') verifica(`${quando} · piazzale ${s.sito}: apertura ${s.giacenza_iniziale_t} = Giacenze ${rg && rg.giacenza_riferimento_t}`, !!rg && vicino(s.giacenza_iniziale_t, rg.giacenza_riferimento_t));
  }
  // L'elenco da dichiarare: riconciliazione = giacenza delle Giacenze, ordini = pulsante.
  for (const [sito, risposta] of Object.entries(L || {})) {
    const r = risposta && risposta.riconciliazione;
    const rg = rigaG(G, sito);
    verifica(`${quando} · elenco di ${sito}: file + carichi non ancora nel file - dichiarato dopo = giacenza delle Giacenze`,
      !!r && !!rg && vicino(r.giacenza_kg / 1000, rg.giacenza_rete_t), JSON.stringify({ r, giacenza: rg && rg.giacenza_rete_t }));
    verifica(`${quando} · elenco di ${sito}: ordini del file + carichi aggiunti = numero del pulsante`,
      !!r && !!rg && r.ordini_pulsante === rg.ordini_da_dichiarare, JSON.stringify({ elenco: r && r.ordini_pulsante, pulsante: rg && rg.ordini_da_dichiarare }));
  }
};

// Quello che del 2026 si deve leggere uguale, il 31/12 e il 02/01.
const numeriDel2026 = (D) => ({
  impianti: (D.siti || []).filter(s => s.tipo_destinazione !== 'stoc').map(s => ({
    sito: s.sito, calcolata: s.giacenza_calcolata_t, portale: s.giacenza_portale_t, quadra: s.quadra,
    canali: (s.giacenze_canale || []).map(c => [c.canale, c.giacenza_t]),
    righe: ['RETE', 'ACI', 'EXTRA_RACCOLTA'].map(c => Math.round((s.flussi || []).filter(f => f.canale === c).reduce((t, f) => t + f.resta_t, 0) * 1000) / 1000),
  })).sort((a, b) => a.sito.localeCompare(b.sito)),
  piazzali: (D.siti || []).filter(s => s.tipo_destinazione === 'stoc').map(s => [s.sito, s.canale, s.giacenza_iniziale_t, s.giacenza_calcolata_t, s.giacenza_portale_t, s.quadra]).sort(),
  kpi: [D.totali.siti_che_quadrano, D.totali.siti_da_quadrare, D.totali.aci_che_quadrano, D.totali.aci_da_quadrare, D.totali.giacenza_calcolata_t],
});

console.log('LA SERA DEL 31/12/2026: IL 2026 E\' L\'ANNO IN CORSO');
archivioDel31();
const sera = await tutto(SERA_31, 2026);
invariante(sera, '31/12/2026, il 2026');
{
  const iri = sera.D.siti.find(s => s.sito === IRI);
  const rete = iri.flussi.find(f => f.canale === 'RETE');
  verifica("Irigom 2026: la casella dall'anno prima porta le 100 t del 2025, uscite con la nave di marzo (dal report)",
    rete.dall_anno_prima && rete.dall_anno_prima.conferito_kg === 100000 && rete.dall_anno_prima.uscito_kg === 100000 && !rete.dall_anno_prima.uscito_stimato,
    JSON.stringify(rete.dall_anno_prima));
  const alfa = sera.D.siti.find(s => s.sito === ALFA);
  const extra = alfa.flussi.find(f => f.canale === 'EXTRA_RACCOLTA');
  const maggio = extra.mesi.find(m => m.mese === 'Maggio');
  verifica('Alfa, due campagne di extra a maggio, una caricata: il mese dice 300 kg caricati, e restano i 200 dell\'altra',
    maggio.caricato_kg === 300 && maggio.resta_kg === 200 && extra.resta_t === 0.2, JSON.stringify({ caricato: maggio.caricato_kg, resta: maggio.resta_kg, riga: extra.resta_t }));
}

console.log('IL 02/01/2027: LA CHIUSURA SCRITTA, LA FOTOGRAFIA DEL 2 GENNAIO, I PRIMI CARICHI');
archivioDel31();
chiusuraScritta();
gennaio();
const due = await tutto(POMERIGGIO_2, 2027);
invariante(due, '02/01/2027, il 2027');
{
  const iri = due.D.siti.find(s => s.sito === IRI);
  const rete = iri.flussi.find(f => f.canale === 'RETE');
  verifica("Irigom 2027: la riga fa 650 t, 600 dall'anno prima e 50 di gennaio, e non grida «dichiarati 600.000 kg in piu'»",
    rete.resta_t === 650 && rete.dall_anno_prima.resta_kg === 600000 && rete.uscito_oltre_kg === 0, JSON.stringify({ resta: rete.resta_t, prima: rete.dall_anno_prima, oltre: rete.uscito_oltre_kg }));
  const aci = iri.flussi.filter(f => f.canale === 'ACI');
  verifica("Irigom 2027: l'ACI dall'anno prima ha la sua riga anche senza arrivi, e fa le 20 t della giacenza",
    aci.length === 1 && aci[0].resta_t === 20 && aci[0].dall_anno_prima.conferito_kg === 20000, JSON.stringify(aci));
  const nappi = due.D.siti.find(s => s.tipo_destinazione === 'stoc' && s.canale === 'RETE');
  verifica('Nappi Sud 2027: a inizio anno 55 t, dalla stessa ancora del numero a portale; 60 con gennaio, e quadra',
    nappi && nappi.giacenza_iniziale_t === 55 && nappi.giacenza_calcolata_t === 60 && nappi.giacenza_portale_t === 60 && nappi.quadra === true, JSON.stringify(nappi && [nappi.giacenza_iniziale_t, nappi.giacenza_calcolata_t, nappi.giacenza_portale_t]));
  verifica('i KPI della quadratura: rete tutti in linea, ACI dei piazzali in linea',
    due.D.totali.siti_da_quadrare === 0 && due.D.totali.aci_da_quadrare === 0 && due.D.totali.aci_che_quadrano === 1, JSON.stringify(due.D.totali));
  const r = due.L[IRI].riconciliazione;
  verifica("l'elenco di Irigom: 2 ordini nel file (600 t) + 1 carico di gennaio non ancora nel file (50 t) = 650 t, 3 ordini",
    r && r.file_ordini === 2 && r.file_kg === 600000 && r.aggiunti_n === 1 && r.aggiunti_kg === 50000 && r.giacenza_kg === 650000 && r.aggiunti[0].id_ordine === 'ET27000001', JSON.stringify(r));
}

console.log('IL 2026 GUARDATO IL 02/01/2027 DICE GLI STESSI NUMERI DEL 31/12/2026');
{
  const prima = numeriDel2026(sera.D);
  const dopo = numeriDel2026(await conOra(POMERIGGIO_2, () => riepilogo({ anno: 2026 })));
  verifica('gli impianti: calcolata, portale, quadratura, giacenza e riga di ogni canale',
    JSON.stringify(dopo.impianti) === JSON.stringify(prima.impianti), `\n    31/12: ${JSON.stringify(prima.impianti)}\n    02/01: ${JSON.stringify(dopo.impianti)}`);
  verifica('i piazzali', JSON.stringify(dopo.piazzali) === JSON.stringify(prima.piazzali), `\n    31/12: ${JSON.stringify(prima.piazzali)}\n    02/01: ${JSON.stringify(dopo.piazzali)}`);
  verifica('e i numeri in testa alla pagina', JSON.stringify(dopo.kpi) === JSON.stringify(prima.kpi), `${JSON.stringify(prima.kpi)} / ${JSON.stringify(dopo.kpi)}`);
  const D = await conOra(POMERIGGIO_2, () => riepilogo({ anno: 2026 }));
  const iri = D.siti.find(s => s.sito === IRI);
  verifica("il 2026 e' chiuso, e Irigom si confronta con la lettura del 31/12, non col portale di oggi (che con gennaio fa 650)",
    D.anno_chiuso === true && iri.portale_al === '2026-12-31' && iri.giacenza_portale_t === 600 && iri.quadratura_anno_chiuso && iri.quadratura_anno_chiuso.lettura === true,
    JSON.stringify({ chiuso: D.anno_chiuso, al: iri.portale_al, portale: iri.giacenza_portale_t }));
}

console.log("LA DICHIARAZIONE DI DICEMBRE CARICATA IL 02/01: L'APERTURA NETTA, E IL 2026 CHE QUADRA ANCORA");
{
  archivioDel31();
  chiusuraScritta();
  ARCHIVI.DichiarazioneSito.push({ id: 'r' + String(++seq).padStart(5, '0'), ...dich(ALFA, 'Dicembre', 'RETE', 25000, '2027-01-02') });
  ARCHIVI.DichiarazioneTrattamento.push({ id: 'r' + String(++seq).padStart(5, '0'), ...riga('ET26000021', ALFA, 25000, '2026-12-10', '2027-01-02') });
  gennaio({ fileSenza: ['ET26000021'] });
  const x = await tutto(POMERIGGIO_2, 2027);
  invariante(x, '02/01/2027 con dicembre caricato, il 2027');
  const alfa = x.D.siti.find(s => s.sito === ALFA);
  verifica("Alfa 2027: letti 25 t al 31/12, dichiarati dopo 25: apertura netta 0, e la riga non inventa niente",
    alfa.giacenze_canale.find(c => c.canale === 'RETE').apertura_t === 0 && alfa.flussi.filter(f => f.canale === 'RETE').every(f => !f.resta_t),
    JSON.stringify(alfa.flussi.map(f => [f.canale, f.resta_t, f.dall_anno_prima])));
  const D = await conOra(POMERIGGIO_2, () => riepilogo({ anno: 2026 }));
  const alfa26 = D.siti.find(s => s.sito === ALFA);
  verifica('il 2026 di Alfa: calcolata 0, lettura del 31/12 al netto di dicembre 0, quadra',
    alfa26.giacenza_calcolata_t === 0 && alfa26.giacenza_portale_t === 0 && alfa26.quadra === true, JSON.stringify([alfa26.giacenza_calcolata_t, alfa26.giacenza_portale_t, alfa26.quadra]));
}

// LE PRIME NAVI DEL 2027 (revisione della chiusura dell'audit, 11/10/2026). Il
// portale aggancia una nave ai carichi piu' vecchi: le prime del 2027 di Irigom
// vanno tutte su novembre e dicembre 2026, e il report conosce l'impianto solo
// con righe dell'anno prima. La riga ripartiva allora dal dichiarato del mese, e
// la stessa nave usciva due volte, dalla casella e dal suo mese: con la nave a
// febbraio 600 t di riga contro 900 di giacenza, e «dichiarati 300.000 kg in
// piu'». Il 02/01 non si vede, perche' dichiarazioni del 2027 non ce ne sono.
console.log("LE PRIME NAVI DEL 2027: IL PORTALE LE AGGANCIA AI CARICHI DEL 2026, E LA RIGA E' ANCORA LA GIACENZA");
for (const nave of [
  { mese: 'Gennaio', caricata: '2027-01-20', foto: '2027-01-22', ora: '2027-01-25T15:00:00Z', febbraio: false, giacenza: 350 },
  { mese: 'Febbraio', caricata: '2027-02-20', foto: '2027-02-22', ora: '2027-02-25T15:00:00Z', febbraio: true, giacenza: 750 },
]) {
  archivioDel31();
  chiusuraScritta();
  gennaio();
  const nuovo = (r) => ({ id: 'r' + String(++seq).padStart(5, '0'), ...r });
  if (nave.febbraio) ARCHIVI.PrimariaRete.push(nuovo(primaria('ET27000002', IRI, 400000, '2027-02-05')));
  // La nave da 300 t, caricata; il report la aggancia tutta al carico di novembre 2026.
  ARCHIVI.DichiarazioneSito.push(nuovo(dich(IRI, nave.mese, 'RETE', 300000, nave.caricata, { anno: 2027, operazione: 'R1' })));
  ARCHIVI.DichiarazioneTrattamento.push(nuovo(riga('ET26000003', IRI, 300000, '2026-11-12', nave.caricata)));
  con('OrdineNonDichiarato', [
    nelFile('ET26000003', IRI, 100000, '2026-11-12', nave.foto),
    nelFile('ET26000004', IRI, 200000, '2026-12-15', nave.foto),
    nelFile('ET27000001', IRI, 50000, '2027-01-02', nave.foto),
    ...(nave.febbraio ? [nelFile('ET27000002', IRI, 400000, '2027-02-05', nave.foto)] : []),
    nelFile('ET26000021', ALFA, 25000, '2026-12-10', nave.foto),
    nelFile('ET26000031', NAPPI, 15000, '2026-11-20', nave.foto),
    nelFile('ET27000030', NAPPI, 5000, '2027-01-02', nave.foto),
  ]);
  const x = await tutto(nave.ora, 2027);
  invariante(x, `la nave di ${nave.mese.toLowerCase()} 2027`);
  const iri = x.D.siti.find(s => s.sito === IRI);
  const rete = iri.flussi.find(f => f.canale === 'RETE');
  const gennaioRiga = rete.mesi.find(m => m.mese === 'Gennaio');
  verifica(`la nave di ${nave.mese.toLowerCase()}: esce dalla casella dall'anno prima (300 t dal report, non stimate), e gennaio non perde niente`,
    rete.dall_anno_prima && rete.dall_anno_prima.uscito_kg === 300000 && !rete.dall_anno_prima.uscito_stimato && rete.dall_anno_prima.resta_kg === 300000
      && gennaioRiga.uscito_kg === 0 && gennaioRiga.resta_kg === 50000,
    JSON.stringify({ prima: rete.dall_anno_prima, gennaio: [gennaioRiga.uscito_kg, gennaioRiga.resta_kg] }));
  verifica(`la nave di ${nave.mese.toLowerCase()}: la riga fa ${nave.giacenza} t, la giacenza del canale, e la nave conta una volta (uscite 300 t)`,
    rete.resta_t === nave.giacenza && rete.uscito_t === 300 && rete.uscito_oltre_kg === 0,
    JSON.stringify({ resta: rete.resta_t, uscito: rete.uscito_t, oltre: rete.uscito_oltre_kg }));
}

// UN ANNO CHIUSO PARTE DALLA SUA ANCORA (revisione della chiusura dell'audit,
// 11/10/2026). La giacenza di inizio anno di un piazzale partiva dall'ancora di
// oggi portata indietro: appena il 2027 ha una lettura, l'ancora diventa la
// rilevazione del 31/12/2026, e il 2026 tornava con quella per costruzione. Qui
// la rilevazione del 31/12/2026 dice 60 t contro le 55 dei movimenti: il 2026
// non deve quadrare, ne' il 05/01 ne' dopo la lettura del 15/01, e deve partire
// sempre dalle 40 t del 31/12/2025. L'anno in corso invece resta sull'ancora
// del numero a portale e delle Giacenze: il 2027 guardato il 05/01, prima di ogni
// sua lettura, quadra e dice il numero delle Giacenze.
console.log("UN ANNO CHIUSO PARTE DALLA SUA ANCORA, ANCHE DOPO LA PRIMA LETTURA DELL'ANNO NUOVO");
{
  archivioDel31();
  chiusuraScritta();
  gennaio();
  const r31 = ARCHIVI.GiacenzaStoccaggio.find(r => r.data_rilevazione === '2026-12-31');
  r31.class1_kg = 60000;
  const pz = (D, canale = 'RETE') => (D.siti || []).find(s => s.sito === NAPPI && s.tipo_destinazione === 'stoc' && s.canale === canale) || {};
  const numeri = (D, canale) => { const p = pz(D, canale); return [p.giacenza_iniziale_t, p.giacenza_calcolata_t, p.giacenza_portale_t, p.quadra]; };
  const il5 = await conOra('2027-01-05T10:00:00Z', () => riepilogo({ anno: 2026 }));
  const in2027 = await tutto('2027-01-05T10:00:00Z', 2027);
  invariante(in2027, "05/01/2027, il 2027 con la rilevazione del 31/12 che non torna");
  ARCHIVI.GiacenzaStoccaggio.push({ id: 'r' + String(++seq).padStart(5, '0'), sito: NAPPI, data_rilevazione: '2027-01-15', class1_kg: 65000, class2_kg: 0, class3_kg: 0, class4_kg: 0, class9_kg: 3000, created_date: '2027-01-15T09:00:00Z' });
  const il20 = await conOra('2027-01-20T16:00:00Z', () => riepilogo({ anno: 2026 }));
  verifica('il 2026 di Nappi Sud il 05/01: parte da 40 t, calcolata 55 contro le 60 lette al 31/12, da verificare',
    JSON.stringify(numeri(il5, 'RETE')) === JSON.stringify([40, 55, 60, false]), JSON.stringify(numeri(il5, 'RETE')));
  verifica('il 2026 di Nappi Sud il 20/01, dopo la lettura del 15/01: gli stessi numeri, le 5 t non spariscono',
    JSON.stringify(numeri(il20, 'RETE')) === JSON.stringify(numeri(il5, 'RETE')), `${JSON.stringify(numeri(il5, 'RETE'))} / ${JSON.stringify(numeri(il20, 'RETE'))}`);
  verifica("e l'ACI del piazzale: 3 t al 31/12/2025, 3 lette, quadra in tutti e due i giorni",
    JSON.stringify(numeri(il20, 'ACI')) === JSON.stringify([3, 3, 3, true]) && JSON.stringify(numeri(il5, 'ACI')) === JSON.stringify([3, 3, 3, true]),
    `${JSON.stringify(numeri(il5, 'ACI'))} / ${JSON.stringify(numeri(il20, 'ACI'))}`);
  const g26 = await conOra('2027-01-20T16:00:00Z', () => giacenze({ anno: 2026 }));
  const rg26 = rigaG(g26, NAPPI, 'stoc');
  verifica("e le Giacenze del 2026, guardate il 20/01: la stessa apertura, 40 t",
    rg26 && rg26.giacenza_riferimento_t === 40, JSON.stringify(rg26 && rg26.giacenza_riferimento_t));
  const s27 = (in2027.D.stoccaggi || []).find(s => s.sito === NAPPI);
  verifica("il 2027 il 05/01: la giacenza di inizio anno resta quella del numero a portale (55 t), non la lettura del 31/12",
    s27 && s27.canali.find(c => c.canale === 'RETE').giacenza_iniziale_t === 55, JSON.stringify(s27 && s27.canali.map(c => [c.canale, c.giacenza_iniziale_t])));
}
{
  // Lo stesso sul 2025 guardato oggi: 25 t al 31/12/2024, +20 e -10 nel 2025, 40
  // lette al 31/12/2025, e una lettura del 2026 che sposta l'ancora di oggi.
  archivioDel31();
  const nuovo = (r) => ({ id: 'r' + String(++seq).padStart(5, '0'), ...r });
  ARCHIVI.GiacenzaSito.push(nuovo({ sito: NAPPI, tipo_destinazione: 'stoc', anno: 2025 }), nuovo({ sito: ALFA, tipo_destinazione: 'imp', anno: 2025, dichiara_rete: true }));
  ARCHIVI.PrimariaRete.push(nuovo(primaria('ET25000030', NAPPI, 20000, '2025-06-10', { tipo_destinazione: 'stoc' })));
  ARCHIVI.Secondaria.push(nuovo({ ...primaria('SEC25000001', ALFA, 10000, '2025-07-10'), stoccaggio: NAPPI }));
  ARCHIVI.GiacenzaStoccaggio.push(
    nuovo({ sito: NAPPI, data_rilevazione: '2024-12-31', class1_kg: 25000, class2_kg: 0, class3_kg: 0, class4_kg: 0, class9_kg: 3000, created_date: '2025-01-02T09:00:00Z' }),
    nuovo({ sito: NAPPI, data_rilevazione: '2026-09-16', class1_kg: 40000, class2_kg: 0, class3_kg: 0, class4_kg: 0, class9_kg: 3000, created_date: '2026-09-16T09:00:00Z' }),
  );
  const D = await conOra('2026-10-11T10:00:00Z', () => riepilogo({ anno: 2025 }));
  const p = (D.siti || []).find(s => s.sito === NAPPI && s.tipo_destinazione === 'stoc' && s.canale === 'RETE') || {};
  verifica('il 2025 di Nappi Sud guardato oggi: parte dalle 25 t del 31/12/2024, calcolata 35 contro 40, da verificare',
    p.giacenza_iniziale_t === 25 && p.giacenza_calcolata_t === 35 && p.giacenza_portale_t === 40 && p.quadra === false,
    JSON.stringify([p.giacenza_iniziale_t, p.giacenza_calcolata_t, p.giacenza_portale_t, p.quadra]));
}

console.log('SENZA LA CHIUSURA SCRITTA, IL 2026 NON E\' «DA VERIFICARE»: LA PAGINA DICE PERCHE\'');
{
  archivioDel31();
  chiusuraScritta({ aperture: false });
  gennaio();
  const D = await conOra(POMERIGGIO_2, () => riepilogo({ anno: 2026 }));
  const iri = D.siti.find(s => s.sito === IRI);
  verifica('nessun impianto e nessun piazzale «da verificare»', D.totali.siti_da_quadrare === 0 && D.totali.aci_da_quadrare === 0 && !D.siti.some(s => s.quadra === false), JSON.stringify(D.totali));
  verifica("Irigom: niente quadratura, e il perche' scritto", iri.quadra === null && iri.quadratura_anno_chiuso && iri.quadratura_anno_chiuso.lettura === false && /anno in corso/.test(iri.quadratura_anno_chiuso.perche),
    JSON.stringify(iri.quadratura_anno_chiuso));
  verifica('la calcolata resta quella del 31/12', iri.giacenza_calcolata_t === 600);
}

console.log('LE PAGINE DICONO QUELLO CHE LA FUNZIONE CALCOLA');
{
  const { readFileSync } = await import('node:fs');
  const s = (p) => readFileSync(qui('../' + p), 'utf8').replace(/\r/g, '');
  const riepilogoJsx = s('src/components/dichiarazioni/Riepilogo.jsx');
  verifica("il riepilogo ha la casella dall'anno prima in testa alla riga", riepilogoJsx.includes('<CasellaAnnoPrima prima={flusso.dall_anno_prima}'));
  verifica("la scheda dell'impianto ha la riga dall'anno prima, anche quando e' l'unica",
    s('src/components/dichiarazioni/SezioneImpianto.jsx').includes('if (!mesiConDati.length && !prima) return null;'));
  verifica("il foglio Excel ha la colonna dall'anno prima", s('src/lib/dichiarazioniExport.js').includes(`'Voce', "Dall'anno prima", ...MESI`));
  verifica("la quadratura di un anno chiuso senza lettura dice perche', invece di «da verificare»",
    s('src/components/dichiarazioni/Quadratura.jsx').includes("anno chiuso: vale per l&apos;anno in corso"));
  verifica('e in testa alla pagina il confronto e\' con la lettura del 31/12', s('src/pages/DichiarazioniImpianti.jsx').includes("'Rete: quadratura con la lettura del 31/12'"));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
