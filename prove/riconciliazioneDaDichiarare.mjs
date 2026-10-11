// Prova dell'ELENCO «DA DICHIARARE» CONTRO IL PULSANTE E LA GIACENZA (chiusura
// dell'audit, 11/10/2026).
//
// Il pulsante «Ordini da dichiarare» della scheda Situazione conta le righe del
// file del portale piu' i carichi che il file non ha ancora; l'elenco che apre
// aveva solo le righe del file, e la pagina scriveva che i due «dicono lo
// stesso». Con un ordine nel file (12.000 kg) e uno arrivato dopo la fotografia
// (8.000 kg): pulsante 2 e giacenza 20 t nelle Giacenze, elenco 1 riga e 12.000
// kg. Adesso sotto l'elenco c'e' la riga di riconciliazione, calcolata con le
// regole delle Giacenze: file + carichi non ancora nel file - dichiarato dopo =
// giacenza, e righe + carichi = pulsante.
// npm run prove
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { carichiNonNelFile, riconciliazioneDaDichiarare } from '../base44/shared/riconciliazioneDaDichiarare.ts';
import { ordiniNotiAlPortale } from '../base44/shared/giacenzaPortale.ts';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const ARCHIVI = {};
globalThis.__ARCHIVI_RICONCILIA = ARCHIVI;
const SDK_FINTO = `
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    if ('$in' in v) return v.$in.includes(r[k]);
    if ('$gte' in v && !(r[k] != null && String(r[k]) >= String(v.$gte))) return false;
    if ('$lte' in v && !(r[k] != null && String(r[k]) <= String(v.$lte))) return false;
    return true;
  }
  return r[k] === v;
});
const ordina = (righe) => [...righe].sort((a, b) => String(a.id).localeCompare(String(b.id)));
const entita = (nome) => ({
  list: async (_o, lim = 1e9, skip = 0) => ordina(globalThis.__ARCHIVI_RICONCILIA[nome] || []).slice(skip, skip + lim),
  filter: async (f, _o, lim = 1e9, skip = 0) => ordina((globalThis.__ARCHIVI_RICONCILIA[nome] || []).filter(r => soddisfa(r, f))).slice(skip, skip + lim),
  create: async (r) => r, update: async (_id, r) => r, delete: async () => ({}),
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: 'user', email: 'prova' }) }, asServiceRole: { entities }, entities };
}`;
// `guasto`, se c'e', cambia il sorgente di shared/riconciliazioneDaDichiarare.ts
// prima di impacchettare: serve a vedere chi usa davvero quella regola.
const funzione = async (nome, guasto = null) => {
  const pacchetto = await build({
    entryPoints: [qui(`../base44/functions/${nome}/entry.ts`)],
    bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
    plugins: [{ name: 'sdk-finto', setup(b) {
      b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
      b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
      if (guasto) b.onLoad({ filter: /riconciliazioneDaDichiarare\.ts$/ }, (a) => {
        const prima = readFileSync(a.path, 'utf8').replace(/\r/g, '');
        const dopo = guasto(prima);
        if (dopo === prima) throw new Error('il guasto non ha trovato niente da cambiare');
        return { contents: dopo, loader: 'ts' };
      });
    } }],
  });
  const modulo = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
  return async (corpo) => (await modulo.default({ json: async () => corpo })).json();
};
const giacenze = await funzione('calcolaGiacenze');
const ordini = await funzione('getOrdiniDaDichiarare');
const riepilogo = await funzione('riepilogoDichiarazioni');

let seq = 0;
const con = (nome, righe) => { ARCHIVI[nome] = righe.map(r => ({ id: 'r' + String(++seq).padStart(4, '0'), ...r })); };
const g = (giorno) => `${giorno}T08:00:00Z`;
const primaria = (id, dest, kg, giorno, extra = {}) => ({
  id_ordine: id, numero_fir: 'FIR' + id, classe: 'P - fino a 35 kg', prodotto: '.class1', destinazione: dest,
  tipo_destinazione: 'imp', stato: 'terminato', peso_effettivo: kg, trasportatore: 'RACCOLTA SRL', provincia: 'NA',
  ordine_immesso_il: g(giorno), trasporto_iniziato_il: g(giorno), trasporto_finito_il: g(giorno), ordine_chiuso_il: g(giorno), ...extra,
});
const vuoti = () => {
  for (const v of ['DichiarazioneTrattamento', 'Terziaria', 'ImpiantoTargetSecondaria', 'TargetRaccoglitore', 'TargetMensile',
    'GiacenzaStoccaggio', 'IndicatoreGiorno', 'PrimariaAci', 'ExtraRaccolta', 'Secondaria', 'OrdineNonDichiarato',
    'DichiarazioneSito', 'GiacenzaSito', 'PrimariaRete', 'CommessaEcotyre']) con(v, []);
};
const anno = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric' }).format(new Date()));
const ALFA = 'ALFA RECYCLING SRL';
const TEC = 'TECNOGUM SRL';
const rigaG = (G, sito) => (G.righe || []).find(r => r.sito === sito && r.tipo_destinazione === 'imp') || {};

// Il caso dell'audit, con l'anno di oggi: fotografia del 01/10, un carico nel file
// e uno arrivato il 05/10; in piu' una secondaria dal piazzale arrivata dopo la
// fotografia, un ordine gia' dichiarato (che il file non ha, ma il report si') e
// una dichiarazione caricata dopo la fotografia.
const ilCaso = () => {
  vuoti();
  con('GiacenzaSito', [
    { sito: ALFA, tipo_destinazione: 'imp', anno, dichiara_rete: true },
    { sito: TEC, tipo_destinazione: 'imp', anno, dichiara_rete: false },
  ]);
  con('PrimariaRete', [
    primaria(`ET${anno}01`, ALFA, 12000, `${anno}-09-10`),
    primaria(`ET${anno}02`, ALFA, 8000, `${anno}-10-05`),
    primaria(`ET${anno}03`, ALFA, 6000, `${anno}-08-10`),   // gia' dichiarato: il report lo conosce
    primaria(`ET${anno}04`, TEC, 7000, `${anno}-10-06`),    // Tecnogum: la rete non la dichiara
  ]);
  con('Secondaria', [{ ...primaria(`SEC${anno}01`, ALFA, 4000, `${anno}-10-07`), stoccaggio: 'NAPPI SUD SRL' }]);
  con('DichiarazioneTrattamento', [{ ordine_primaria: `ET${anno}03`, prodotto: '.class1', partner_operativo: 'SMOCO S.r.l.', destinazione: ALFA, data_dichiarazione: `${anno}-09-05`, fine_trasporto: `${anno}-08-10`, peso_associato_kg: 6000 }]);
  con('DichiarazioneSito', [
    { sito: ALFA, anno, mese: 'Agosto', canale: 'RETE', provenienza: '', quantita_kg: 6000, caricata_inviata: true, caricata_il: `${anno}-09-05` },
    // Settembre caricato dopo la fotografia: il file conta ancora quei 3.000 kg, noi no.
    { sito: ALFA, anno, mese: 'Settembre', canale: 'RETE', provenienza: '', quantita_kg: 3000, caricata_inviata: true, caricata_il: `${anno}-10-03` },
  ]);
  con('OrdineNonDichiarato', [{ ordine_primaria: `ET${anno}01`, destinazione: ALFA, prodotto: '.class1', peso_non_dichiarato_kg: 12000, created_date: `${anno}-10-01T06:00:00Z`, fine_trasporto: `${anno}-09-10` }]);
};

console.log('IL CASO DELL\'AUDIT: UN ORDINE NEL FILE, UN CARICO ARRIVATO DOPO');
{
  ilCaso();
  const G = await giacenze({ anno });
  const L = await ordini({ sito: ALFA, ruolo: 'imp', riconcilia: true });
  const r = L.riconciliazione;
  const rg = rigaG(G, ALFA);
  verifica("l'elenco resta l'elenco del file: 1 ordine, 12.000 kg", L.totale_righe === 1 && L.totale_kg === 12000);
  verifica('le Giacenze: pulsante 3 (1 nel file + 2 non ancora), giacenza 12 + 8 + 4 - 3 = 21 t',
    rg.ordini_da_dichiarare === 3 && rg.giacenza_rete_t === 21, JSON.stringify({ pulsante: rg.ordini_da_dichiarare, giacenza: rg.giacenza_rete_t }));
  verifica('la riconciliazione: file 12.000 + 2 carichi 12.000 - dichiarato dopo 3.000 = 21.000 kg',
    r && r.file_ordini === 1 && r.file_kg === 12000 && r.aggiunti_n === 2 && r.aggiunti_kg === 12000 && r.dichiarato_dopo_kg === 3000 && r.giacenza_kg === 21000, JSON.stringify(r));
  verifica('lo stesso numero delle Giacenze, e lo stesso numero del pulsante',
    r && r.giacenza_kg / 1000 === rg.giacenza_rete_t && r.ordini_pulsante === rg.ordini_da_dichiarare);
  verifica('i carichi aggiunti si dicono uno per uno, dal piu vecchio, con la secondaria e da quale piazzale',
    r && r.aggiunti.map(o => o.id_ordine).join(',') === `ET${anno}02,SEC${anno}01` && r.aggiunti[1].tipo === 'secondaria' && r.aggiunti[1].da === 'NAPPI SUD SRL', JSON.stringify(r && r.aggiunti));
  verifica("l'ordine gia' dichiarato non e' un carico che manca al file: il report lo conosce", r && !r.aggiunti.some(o => o.id_ordine === `ET${anno}03`));
}

console.log('SOLO QUANDO SI CHIEDE, E SOLO PER UN IMPIANTO SENZA ALTRI FILTRI');
{
  ilCaso();
  verifica('senza riconcilia non si calcola', (await ordini({ sito: ALFA, ruolo: 'imp' })).riconciliazione === null);
  verifica('con un altro filtro l\'elenco non e\' tutto quello che il portale aspetta: non si calcola',
    (await ordini({ sito: ALFA, ruolo: 'imp', riconcilia: true, provincia: 'NA' })).riconciliazione === null
    && (await ordini({ sito: ALFA, ruolo: 'imp', riconcilia: true, ricerca: 'FIR' })).riconciliazione === null);
  verifica('per il piazzale non si calcola', (await ordini({ sito: ALFA, ruolo: 'stoc', riconcilia: true })).riconciliazione === null);
  const t = await ordini({ sito: TEC, ruolo: 'imp', riconcilia: true });
  verifica('Tecnogum, che la rete non la dichiara: niente da riconciliare, e si dice', t.riconciliazione && t.riconciliazione.non_dovuta === true, JSON.stringify(t.riconciliazione));
}

console.log('LA REGOLA DEI CARICHI NON ANCORA NEL FILE');
{
  const conosce = ordiniNotiAlPortale();
  conosce.segna({ ordine_primaria: 'NEL-FILE' });
  conosce.segna({ ordine_primaria: 'DICHIARATO' }, 'dichiarazioni');
  const c = carichiNonNelFile({ foto: '2027-01-02', portaleConosce: conosce, chiaveDi: (s) => String(s || '').toUpperCase(), nonDichiaraRete: new Set(['TEC']) });
  c.segna(primaria('NUOVO', 'ALFA', 1000, '2026-12-29'), 'primaria');        // 60 giorni prima della fotografia di gennaio: conta
  c.segna(primaria('VECCHIO', 'ALFA', 1000, '2026-10-01'), 'primaria');      // prima della finestra: no
  c.segna(primaria('NEL-FILE', 'ALFA', 1000, '2026-12-20'), 'primaria');     // il file lo ha
  c.segna(primaria('DICHIARATO', 'ALFA', 1000, '2026-12-21'), 'primaria');   // il report lo ha
  c.segna(primaria('PIAZZALE', 'ALFA', 1000, '2026-12-22', { tipo_destinazione: 'stoc' }), 'primaria'); // al piazzale
  c.segna({ ...primaria('ACI', 'ALFA', 1000, '2026-12-23'), prodotto: '.class9', classe: 'PFU Autodemolizione' }, 'primaria');
  c.segna(primaria('TECNOGUM', 'TEC', 1000, '2026-12-24'), 'primaria');
  c.segna({ ...primaria('SENZA-FINE', 'ALFA', 1000, '2026-12-25'), trasporto_finito_il: null }, 'primaria');
  c.segna({ ...primaria('ESEGUITO', 'ALFA', 1000, '2026-12-26'), stato: 'eseguito' }, 'primaria');
  // Una secondaria arrivata al piazzale di un sito che e' anche impianto (11/10/2026).
  c.segna({ ...primaria('SEC-PIAZZALE', 'ALFA', 1000, '2026-12-27', { tipo_destinazione: 'stoc' }), stoccaggio: 'NAPPI SUD SRL' }, 'secondaria');
  const a = c.di('ALFA');
  verifica('conta solo il carico di rete, all\'impianto, terminato, nella finestra, che il portale non conosce',
    a.n === 1 && a.ordini[0].id_ordine === 'NUOVO' && a.kg === 1000, JSON.stringify(a));
  verifica('e chi non dichiara la rete non ne ha', c.di('TEC').n === 0);
  const r = riconciliazioneDaDichiarare({ foto: '2027-01-02', fileOrdini: 3, fileKg: 9000, aggiunti: a, dichiaratoDopoKg: 2500 });
  verifica('il conto: 9.000 + 1.000 - 2.500 = 7.500 kg, 3 + 1 = 4 ordini', r.giacenza_kg === 7500 && r.ordini_pulsante === 4);
}

// LA SECONDARIA ARRIVATA AL PIAZZALE DI UN SITO CHE E' ANCHE IMPIANTO
// (revisione della chiusura dell'audit, 11/10/2026). Giacenze e Dichiarazioni
// la tengono sul piazzale (C2); la riga di riconciliazione la aggiungeva ai
// carichi dell'impianto, e diceva 20.000 kg e 2 ordini accanto alle 12 t e 1
// ordine delle Giacenze.
console.log("LA SECONDARIA ARRIVATA AL PIAZZALE DI UN SITO CHE E' ANCHE IMPIANTO");
{
  const IRI = 'IRIGOM SRL', NAPPI = 'NAPPI SUD SRL';
  vuoti();
  con('GiacenzaSito', [
    { sito: IRI, tipo_destinazione: 'imp', anno, dichiara_rete: true },
    { sito: IRI, tipo_destinazione: 'stoc', anno },
    { sito: NAPPI, tipo_destinazione: 'stoc', anno },
  ]);
  con('PrimariaRete', [
    primaria(`ET${anno}11`, IRI, 12000, `${anno}-09-10`),
    primaria(`ET${anno}12`, NAPPI, 8000, `${anno}-09-12`, { tipo_destinazione: 'stoc' }),
  ]);
  con('Secondaria', [{ ...primaria(`SEC${anno}11`, IRI, 8000, `${anno}-10-05`, { tipo_destinazione: 'stoc' }), stoccaggio: NAPPI }]);
  con('OrdineNonDichiarato', [
    { ordine_primaria: `ET${anno}11`, destinazione: IRI, prodotto: '.class1', peso_non_dichiarato_kg: 12000, created_date: `${anno}-10-01T06:00:00Z`, fine_trasporto: `${anno}-09-10` },
    { ordine_primaria: `ET${anno}12`, destinazione: NAPPI, prodotto: '.class1', peso_non_dichiarato_kg: 8000, created_date: `${anno}-10-01T06:00:00Z`, fine_trasporto: `${anno}-09-12` },
  ]);
  const G = await giacenze({ anno });
  const r = (await ordini({ sito: IRI, ruolo: 'imp', riconcilia: true })).riconciliazione;
  const rg = rigaG(G, IRI);
  verifica("le Giacenze: l'impianto ha le sue 12 t e 1 ordine, la secondaria sta sul piazzale",
    rg.giacenza_rete_t === 12 && rg.ordini_da_dichiarare === 1, JSON.stringify({ giacenza: rg.giacenza_rete_t, pulsante: rg.ordini_da_dichiarare }));
  verifica("la riconciliazione dice lo stesso: 12.000 kg, 1 ordine, nessun carico aggiunto",
    r && r.giacenza_kg === 12000 && r.ordini_pulsante === 1 && r.aggiunti_n === 0, JSON.stringify(r));
}

// LA REGOLA DEI CARICHI NON ANCORA NEL FILE E' UNA SOLA (revisione della
// chiusura dell'audit, 11/10/2026). calcolaGiacenze e il riepilogo delle
// dichiarazioni la riscrivevano ciascuno a modo suo: tre copie con lo stesso
// esito, finche' nessuno ne cambiava una. Ora la chiedono tutti e tre a
// shared/riconciliazioneDaDichiarare.ts, e la prova lo fa vedere cambiandola li':
// se le secondarie non contassero piu', tutti e tre i numeri scenderebbero
// delle 4 t della secondaria. Con le copie, solo l'elenco.
console.log('LA REGOLA DEI CARICHI NON ANCORA NEL FILE E\' UNA SOLA, PER I TRE');
{
  ilCaso();
  const sitoD = (D) => (D.siti || []).find(s => s.sito === ALFA && s.tipo_destinazione !== 'stoc') || {};
  const tre = async (g, d, o) => ({
    giacenze: rigaG(await g({ anno }), ALFA).giacenza_rete_t,
    dichiarazioni: sitoD(await d({ anno })).giacenza_portale_t,
    elenco: ((await o({ sito: ALFA, ruolo: 'imp', riconcilia: true })).riconciliazione || {}).giacenza_kg / 1000,
  });
  const giusti = await tre(giacenze, riepilogo, ordini);
  verifica('i tre dicono 21 t: file 12 + 8 + la secondaria di 4 - 3 dichiarati dopo', giusti.giacenze === 21 && giusti.dichiarazioni === 21 && giusti.elenco === 21, JSON.stringify(giusti));
  const senzaSecondarie = (s) => s.replace("if (!dove.arrivo || dove.arrivo.ruolo !== 'imp' || dove.canale !== 'RETE') return null;",
    "if (!dove.arrivo || dove.arrivo.ruolo !== 'imp' || dove.canale !== 'RETE') return null;\n      if (tipo === 'secondaria') return null;");
  const guasti = await tre(await funzione('calcolaGiacenze', senzaSecondarie), await funzione('riepilogoDichiarazioni', senzaSecondarie), await funzione('getOrdiniDaDichiarare', senzaSecondarie));
  verifica('cambiata la regola nel modulo condiviso, cambiano tutti e tre: 17 t', guasti.giacenze === 17 && guasti.dichiarazioni === 17 && guasti.elenco === 17, JSON.stringify(guasti));
  const s = (p) => readFileSync(qui('../' + p), 'utf8').replace(/\r/g, '');
  verifica('le Giacenze e il riepilogo non riscrivono la finestra dei carichi: non chiamano inizioAggiunti',
    !s('base44/functions/calcolaGiacenze/entry.ts').includes('inizioAggiunti(') && !s('base44/functions/riepilogoDichiarazioni/entry.ts').includes('inizioAggiunti('));
}

console.log('LA PAGINA');
{
  const t = readFileSync(qui('../src/components/giacenze/DaDichiarareTable.jsx'), 'utf8').replace(/\r/g, '');
  verifica('la scheda chiede la riconciliazione arrivando dal pulsante di un impianto, senza altri filtri',
    t.includes("const daRiconciliare = !!sito && ruolo === 'imp' && !provincia && !annoChiusura && !ricerca && !soloDate;") && t.includes('payload.riconcilia = true'));
  verifica('e la mostra sotto l\'elenco', t.includes('<Riconciliazione r={riconciliazione} sito={sito} />'));
  verifica('il commento che diceva «dicono lo stesso» senza dimostrarlo non c\'e\' piu\'',
    !t.includes('col ruolo scelto, il numero del pulsante nella\n          scheda Situazione e questo elenco dicono lo stesso.'));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
