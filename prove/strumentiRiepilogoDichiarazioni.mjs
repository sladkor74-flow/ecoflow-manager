// Prova dello strumento RIEPILOGO_DICHIARAZIONI di EcoTyna (chiusura dell'audit,
// 11/10/2026).
//
// Nessuno strumento chiamava riepilogoDichiarazioni: alla domanda «quanto resta da
// dichiarare a T-Cycle?» EcoTyna rispondeva con la giacenza a portale delle
// Giacenze, e non vedeva i mesi ancora aperti, la quadratura col portale, i
// doppioni ne' le dichiarazioni che il portale ha e noi no. Ora c'e' lo
// strumento, chiama la funzione della pagina e il pianificatore lo sceglie.
//
// 1. Sulla funzione vera (SDK finto): resta_t del flusso di rete e' la giacenza
//    di rete dello strumento giacenze, con i mesi aperti e la quadratura.
// 2. Su una risposta costruita: filtro per sito, canali mai sommati, Tecnogum
//    senza un resto (non zero), doppioni e dichiarazioni da inserire del sito.
// 3. Il pianificatore lo trova e non lo chiama tre volte.
// npm run prove
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const ARCHIVI = {};
globalThis.__ARCHIVI_RIEPILOGO_ECOTYNA = ARCHIVI;
const SDK_FINTO = `
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => r[k] === v);
const ordina = (righe) => [...righe].sort((a, b) => String(a.id).localeCompare(String(b.id)));
const entita = (nome) => ({
  list: async (_o, lim = 1e9, skip = 0) => ordina(globalThis.__ARCHIVI_RIEPILOGO_ECOTYNA[nome] || []).slice(skip, skip + lim),
  filter: async (f, _o, lim = 1e9, skip = 0) => ordina((globalThis.__ARCHIVI_RIEPILOGO_ECOTYNA[nome] || []).filter(r => soddisfa(r, f))).slice(skip, skip + lim),
  create: async (r) => r, update: async (_id, r) => r, delete: async () => ({}),
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: 'user', email: 'prova' }) }, asServiceRole: { entities }, entities };
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
const FUNZIONI = { calcolaGiacenze: await funzione('calcolaGiacenze'), riepilogoDichiarazioni: await funzione('riepilogoDichiarazioni') };
const chiamate = [];
let rispostaFinta = null;
const base44 = {
  asServiceRole: { entities: {} },
  functions: {
    invoke: async (nome, corpo) => {
      chiamate.push(nome);
      if (rispostaFinta && nome === 'riepilogoDichiarazioni') return { data: rispostaFinta };
      return { data: await FUNZIONI[nome](corpo) };
    },
  },
};

const { STRUMENTI, catalogoStrumenti } = await import('../base44/shared/strumentiAssistente.ts');
const { istruzioniPiano, strumentiDalPiano } = await import('../base44/shared/pianoAssistente.ts');
const { nuovaCache } = await import('../base44/shared/cacheLetture.ts');
const riepilogo = STRUMENTI.find(s => s.nome === 'riepilogo_dichiarazioni');
const giacenze = STRUMENTI.find(s => s.nome === 'giacenze');

console.log('LO STRUMENTO ESISTE E STA NEL CATALOGO');
verifica('c\'e\' lo strumento riepilogo_dichiarazioni', !!riepilogo);
const voce = catalogoStrumenti().find(s => s.nome === 'riepilogo_dichiarazioni');
verifica('e il pianificatore lo vede nel catalogo, coi canali gia\' divisi', voce && voce.impliciti && voce.impliciti.canale === '*' && /resta da dichiarare/.test(voce.descrizione), JSON.stringify(voce));
if (!riepilogo) { console.log(`\n${ok} verifiche superate, ${ko + 1} fallite`); process.exit(1); }

console.log('1. SULLA FUNZIONE VERA: IL RESTO E\' LA GIACENZA');
let seq = 0;
const con = (nome, righe) => { ARCHIVI[nome] = righe.map(r => ({ id: 'r' + String(++seq).padStart(4, '0'), ...r })); };
const g = (giorno) => `${giorno}T08:00:00Z`;
for (const v of ['DichiarazioneTrattamento', 'Terziaria', 'ImpiantoTargetSecondaria', 'TargetRaccoglitore', 'TargetMensile',
  'GiacenzaStoccaggio', 'IndicatoreGiorno', 'PrimariaAci', 'ExtraRaccolta', 'Secondaria', 'OrdineNonDichiarato',
  'DichiarazioneSito', 'GiacenzaSito', 'PrimariaRete']) con(v, []);
const ALFA = 'ALFA RECYCLING SRL';
const primaria = (id, kg, giorno) => ({
  id_ordine: id, numero_fir: 'FIR' + id, classe: 'P - fino a 35 kg', prodotto: '.class1', destinazione: ALFA, tipo_destinazione: 'imp',
  stato: 'terminato', peso_effettivo: kg, trasportatore: 'RACC SRL', provincia: 'NA',
  ordine_immesso_il: g('2026-01-02'), trasporto_iniziato_il: g(giorno), trasporto_finito_il: g(giorno),
});
con('GiacenzaSito', [{ sito: ALFA, tipo_destinazione: 'imp', anno: 2026, dichiara_rete: true }]);
con('PrimariaRete', [primaria('ET26000001', 8000, '2026-04-10'), primaria('ET26000002', 5000, '2026-05-12')]);
con('DichiarazioneSito', [{ sito: ALFA, anno: 2026, mese: 'Aprile', canale: 'RETE', quantita_kg: 8000, caricata_inviata: true, caricata_il: '2026-05-05' }]);
// La fotografia del portale: aprile e' dichiarato (il report lo dice), maggio no.
con('OrdineNonDichiarato', [{ ordine_primaria: 'ET26000002', destinazione: ALFA, prodotto: '.class1', peso_non_dichiarato_kg: 5000, created_date: '2026-10-01T06:00:00Z', fine_trasporto: '2026-05-12' }]);
con('DichiarazioneTrattamento', [{ ordine_primaria: 'ET26000001', destinazione: ALFA, prodotto: '.class1', peso_associato_kg: 8000, data_dichiarazione: '2026-05-05', fine_trasporto: '2026-04-10', partner_operativo: 'SMOCO SRL' }]);
{
  chiamate.length = 0;
  const r = (await riepilogo.esegui(base44, { anno: 2026, sito: 'Alfa Recycling' })).dati;
  const sito = (r.siti.righe || [])[0] || {};
  const rete = (sito.flussi || []).find(f => f.canale === 'RETE') || {};
  verifica('chiama la funzione della pagina', chiamate.includes('riepilogoDichiarazioni'), chiamate.join(','));
  verifica('resta da dichiarare: 5 t di rete', rete.resta_t === 5, JSON.stringify(rete));
  verifica('il mese aperto e\' maggio, 5 t', rete.mesi_aperti && rete.mesi_aperti.length === 1 && rete.mesi_aperti[0].mese === 'Maggio' && rete.mesi_aperti[0].da_dichiarare_t === 5, JSON.stringify(rete.mesi_aperti));
  verifica('la quadratura col portale torna', sito.quadratura_rete && sito.quadratura_rete.quadra === true && sito.quadratura_rete.scarto_t === 0, JSON.stringify(sito.quadratura_rete));
  verifica('e il resto per canale lo dice', r.resta_per_canale_t && r.resta_per_canale_t.RETE === 5, JSON.stringify(r.resta_per_canale_t));
  const gia = (await giacenze.esegui(base44, { anno: 2026, sito: 'Alfa Recycling' })).dati;
  verifica('lo stesso numero della giacenza di rete delle Giacenze', gia.siti.righe[0].giacenza_rete_t === rete.resta_t, `${gia.siti.righe[0].giacenza_rete_t} contro ${rete.resta_t}`);
  verifica('la data della fotografia viaggia con i numeri', r.fotografia_del_portale_del === '2026-10-01', String(r.fotografia_del_portale_del));
}

console.log('2. SU UNA RISPOSTA COSTRUITA: SITO, CANALI, TECNOGUM, DOPPIONI');
const mese = (nome, da, conferito = da, caricato = 0) => ({ mese: nome, conferito_kg: conferito, caricato_kg: caricato, da_dichiarare_kg: da, resta_kg: da, dichiarato_non_caricato_kg: 0 });
rispostaFinta = {
  anno: 2026, foto_portale_il: '2026-10-09', movimenti_fino_al: '2026-10-07',
  siti: [
    { sito: 'GATIM SRL', tipo_destinazione: 'imp', canale: 'RETE', dichiara_rete: true, giacenza_calcolata_t: 122.17, giacenza_portale_t: 122.17, scarto_t: 0, quadra: true,
      flussi: [
        { canale: 'RETE', provenienza: '', non_dovuta: false, resta_t: 122.17, da_dichiarare_t: 122.17, conferito_t: 900, dichiarato_caricato_t: 777.83, mesi: [mese('Agosto', 0, 100000, 100000), mese('Settembre', 122170)] },
        { canale: 'ACI', provenienza: '', non_dovuta: false, resta_t: 7.5, da_dichiarare_t: 7.5, conferito_t: 30, dichiarato_caricato_t: 22.5, mesi: [mese('Settembre', 7500)] },
      ] },
    { sito: 'TECNOGUM SRL', tipo_destinazione: 'imp', canale: 'RETE', dichiara_rete: false, giacenza_calcolata_t: 1833.43, giacenza_portale_t: null, scarto_t: null, quadra: null,
      flussi: [{ canale: 'RETE', provenienza: '', non_dovuta: true, resta_t: 1833.43, da_dichiarare_t: 0, conferito_t: 1833.43, dichiarato_caricato_t: 0, mesi: [mese('Settembre', 0, 200000)] }] },
    { sito: 'NAPPI SUD SRL', tipo_destinazione: 'stoc', canale: 'ACI', giacenza_calcolata_t: 3, giacenza_portale_t: 3.2, scarto_t: -0.2, quadra: false, rilevazione_il: '2026-09-30', flussi: [] },
  ],
  totali: { siti_che_quadrano: 1, siti_da_quadrare: 0, aci_che_quadrano: 0, aci_da_quadrare: 1 },
  doppioni: [
    { sito: 'GATIM SRL', canale: 'RETE', provenienza: '', mese: 'Luglio', quante: 2, kg: 20000, kg_in_piu: 10000, caricate: 1, ids: ['a', 'b'] },
    { sito: 'IRIGOM SRL', canale: 'RETE', provenienza: '', mese: 'Giugno', quante: 2, kg: 4000, kg_in_piu: 2000, caricate: 0, ids: ['c', 'd'] },
  ],
  dichiarazioni_da_inserire: [
    { sito: 'Gatim S.r.l.', canale: 'ACI', motivo: 'caricata a portale, nel gestionale non c\'e\'', quanti: 1, kg: 5000, mesi: [{ mese: '2026-08', kg: 5000 }], caricamenti: [] },
    { sito: 'IRIGOM SRL', canale: 'RETE', motivo: 'x', quanti: 1, kg: 1000, mesi: [], caricamenti: [] },
  ],
};
{
  chiamate.length = 0;
  const cache = nuovaCache();
  const r = (await riepilogo.esegui(base44, { anno: 2026, sito: 'Gatim' }, cache)).dati;
  await riepilogo.esegui(base44, { anno: 2026 }, cache);
  verifica('due domande nella stessa risposta: la funzione si chiama una volta', chiamate.filter(c => c === 'riepilogoDichiarazioni').length === 1, chiamate.join(','));
  const righe = r.siti.righe || [];
  verifica('chiedendo "Gatim" esce solo GATIM SRL', righe.length === 1 && righe[0].sito === 'GATIM SRL', JSON.stringify(righe.map(x => x.sito)));
  const flussi = righe[0].flussi || [];
  verifica('rete e ACI su due flussi, mai sommati', flussi.length === 2 && flussi.find(f => f.canale === 'RETE').resta_t === 122.17 && flussi.find(f => f.canale === 'ACI').resta_t === 7.5
    && !JSON.stringify(r).includes('129,67') && !JSON.stringify(r).includes('129.67'), JSON.stringify(flussi.map(f => [f.canale, f.resta_t])));
  verifica('i mesi aperti sono solo quelli con qualcosa da dichiarare', flussi.find(f => f.canale === 'RETE').mesi_aperti.map(m => m.mese).join() === 'Settembre');
  verifica('il resto per canale: tre numeri separati', r.resta_per_canale_t.RETE === 122.17 && r.resta_per_canale_t.ACI === 7.5 && !('totale' in r.resta_per_canale_t), JSON.stringify(r.resta_per_canale_t));
  verifica('i doppioni sono quelli del sito', r.doppioni.quanti === 1 && r.doppioni.righe[0].mese === 'Luglio' && r.doppioni.righe[0].in_piu_t === 10, JSON.stringify(r.doppioni));
  verifica('e non portano gli identificativi dei record', !JSON.stringify(r.doppioni).includes('"ids"'));
  verifica('le dichiarazioni da inserire sono del sito, scritto in un altro modo', r.dichiarazioni_da_inserire.quanti === 1 && r.dichiarazioni_da_inserire.righe[0].canale === 'ACI' && r.dichiarazioni_da_inserire.righe[0].t === 5, JSON.stringify(r.dichiarazioni_da_inserire));
  verifica('la nota dice che i canali non si sommano', /Tre canali, mai sommati/.test(r.nota) && /quadratura/.test(r.nota));

  const t = (await riepilogo.esegui(base44, { anno: 2026, sito: 'Tecnogum' })).dati.siti.righe[0];
  const reteT = t.flussi[0];
  verifica('Tecnogum: la rete non dovuta non ha un resto, e non e\' zero', reteT.resta_t === null && /accordo/.test(reteT.non_dovuta || '') && reteT.mesi_aperti.length === 0, JSON.stringify(reteT));
  verifica('e la sua quadratura non si fa, col perche\'', t.quadratura_rete.confrontabile === false && /accordo/.test(t.quadratura_rete.perche), JSON.stringify(t.quadratura_rete));
  const tutti = (await riepilogo.esegui(base44, { anno: 2026 })).dati;
  verifica('nel resto per canale Tecnogum non entra', tutti.resta_per_canale_t.RETE === 122.17, JSON.stringify(tutti.resta_per_canale_t));
  const n = tutti.siti.righe.find(x => x.sito === 'NAPPI SUD SRL');
  verifica('lo stoccaggio porta la sua quadratura di canale', n && n.tipo === 'stoccaggio' && n.canale === 'ACI' && n.quadratura.quadra === false && n.quadratura.scarto_t === -0.2, JSON.stringify(n));
  verifica('senza sito, i conteggi della quadratura', tutti.quadratura && tutti.quadratura.rete_che_quadrano === 1 && tutti.quadratura.aci_da_quadrare === 1, JSON.stringify(tutti.quadratura));
  const solo = (await riepilogo.esegui(base44, { anno: 2026, canale: 'ACI' })).dati;
  verifica('chiamato da se\' con un canale, tiene solo quello', solo.siti.righe.every(x => (x.flussi || [{ canale: x.canale }]).every(f => f.canale === 'ACI')), JSON.stringify(solo.siti.righe.map(x => x.sito)));
  const ignoto = (await riepilogo.esegui(base44, { anno: 2026, sito: 'Pinco Pallino' })).dati;
  verifica('un sito che non c\'e\' si dice, non diventa zero', ignoto.siti.quanti === 0 && /non risulta/.test(ignoto.avviso_sito || ''), JSON.stringify(ignoto).slice(0, 200));
  rispostaFinta = null;
}

console.log('3. IL PIANIFICATORE LO SCEGLIE, UNA VOLTA SOLA');
{
  const catalogo = catalogoStrumenti();
  const istr = istruzioniPiano(catalogo, 'Quanto resta da dichiarare a Gatim?', '2026-10-11');
  verifica('le istruzioni dicono quando usarlo', /"quanto resta da dichiarare"[^\n]*riepilogo_dichiarazioni/.test(istr));
  verifica('e lo strumento e\' nell\'elenco', /- riepilogo_dichiarazioni: /.test(istr));
  const scelti = strumentiDalPiano(
    { canali: ['RETE', 'ACI', 'EXTRA_RACCOLTA'], strumenti: [{ nome: 'riepilogo_dichiarazioni', parametri: { sito: 'Gatim', canale: 'ACI' } }] },
    catalogo, '2026-10-11', 'Quanto resta da dichiarare ACI a Gatim?');
  verifica('una chiamata sola anche con tre canali nel piano', scelti.length === 1 && scelti[0].nome === 'riepilogo_dichiarazioni', JSON.stringify(scelti));
  verifica('col sito e l\'anno', scelti[0] && scelti[0].parametri.sito === 'Gatim' && scelti[0].parametri.anno === 2026, JSON.stringify(scelti[0] && scelti[0].parametri));
  verifica('e il canale non e\' un filtro ignorato', scelti[0] && scelti[0].ignorati.length === 0, JSON.stringify(scelti[0] && scelti[0].ignorati));
  verifica('non e\' uno strumento sconosciuto', !scelti.sconosciuti);
  // E chi risponde sa che un resto vuoto non e' zero (Tecnogum).
  const prompt = readFileSync(new URL('../base44/functions/chiediAssistente/entry.ts', import.meta.url), 'utf8').replace(/\r/g, '');
  verifica('le regole della risposta: resta_t vuoto con non_dovuta si scrive «—», non zero',
    /'3-quaterdecies\. Quanto resta da dichiarare lo dice riepilogo_dichiarazioni[^\n]*non_dovuta non e\\' zero: scrivi «—»/.test(prompt));
  // E sa che la prima voce dei mesi aperti puo' essere la giacenza dell'anno prima,
  // e che un anno chiuso si confronta col 31/12 (revisione W5, 11/10/2026).
  verifica('le regole della risposta: la voce «dall\'anno prima» e l\'anno chiuso',
    /'3-quaterdecies\.[^\n]*«dall\\'anno prima» \(dall_anno_prima vero\)[^\n]*gia\\' dentro resta_t[^\n]*anno_chiuso[^\n]*portale_al/.test(prompt));
}

// 4. LA CASELLA «DALL'ANNO PRIMA» (revisione W5, chiusura dell'audit 11/10/2026).
// ALFA ha 30 t di rete in giacenza al 31/12/2025; nel 2026 arrivano 8 t ad aprile
// e 5 a maggio, e aprile e' dichiarato e caricato. La pagina: Da dichiarare 35 t,
// di cui 30 nella casella dall'anno prima e 5 a maggio. Lo strumento diceva resta
// 35, arrivato 13, dichiarato 8 e un solo mese aperto da 5 t: le 30 t piu' vecchie,
// le prime che il portale aggancia, non comparivano da nessuna parte.
console.log("4. LA CASELLA «DALL'ANNO PRIMA» STA IN TESTA AI MESI APERTI");
for (const v of ['OrdineNonDichiarato', 'DichiarazioneTrattamento', 'GiacenzaSito', 'PrimariaRete', 'DichiarazioneSito']) con(v, []);
con('GiacenzaSito', [{ sito: ALFA, tipo_destinazione: 'imp', anno: 2026, dichiara_rete: true, giacenza_riferimento_t: 30 }]);
con('PrimariaRete', [primaria('ET26000001', 8000, '2026-04-10'), primaria('ET26000002', 5000, '2026-05-12')]);
con('DichiarazioneSito', [{ sito: ALFA, anno: 2026, mese: 'Aprile', canale: 'RETE', quantita_kg: 8000, caricata_inviata: true, caricata_il: '2026-05-05' }]);
{
  const pagina = await FUNZIONI.riepilogoDichiarazioni({ anno: 2026 });
  const fp = pagina.siti.find(s => s.sito === ALFA).flussi.find(f => f.canale === 'RETE');
  verifica('la pagina: 35 t da dichiarare, 30 nella casella dall\'anno prima', fp.resta_t === 35 && fp.dall_anno_prima && fp.dall_anno_prima.resta_kg === 30000, JSON.stringify({ resta: fp.resta_t, prima: fp.dall_anno_prima }));
  const r = (await riepilogo.esegui(base44, { anno: 2026, sito: 'Alfa Recycling' })).dati;
  const rete = r.siti.righe[0].flussi.find(f => f.canale === 'RETE');
  const aperti = rete.mesi_aperti || [];
  const somma = Math.round(aperti.reduce((s, m) => s + m.da_dichiarare_t, 0) * 1000) / 1000;
  verifica('lo strumento: resta 35 t', rete.resta_t === 35, JSON.stringify(rete));
  verifica('in testa ai mesi aperti la voce dall\'anno prima, 30 t, con la data della giacenza', aperti[0] && aperti[0].dall_anno_prima === true && aperti[0].da_dichiarare_t === 30 && aperti[0].apertura_t === 30 && aperti[0].giacenza_al === '2025-12-31', JSON.stringify(aperti[0]));
  verifica('poi maggio, 5 t', aperti.length === 2 && aperti[1].mese === 'Maggio' && aperti[1].da_dichiarare_t === 5, JSON.stringify(aperti));
  verifica('la somma dei mesi aperti fa il resto', somma === rete.resta_t, `${somma} contro ${rete.resta_t}`);
  verifica('apertura + arrivato - dichiarato e caricato = resto', rete.apertura_t === 30 && Math.round((rete.apertura_t + rete.arrivato_t - rete.dichiarato_e_caricato_t) * 1000) / 1000 === rete.resta_t,
    `${rete.apertura_t} + ${rete.arrivato_t} - ${rete.dichiarato_e_caricato_t} contro ${rete.resta_t}`);
  verifica('la nota dice che il conto si chiude sul canale e che la voce dall\'anno prima e\' dentro il resto',
    /si chiude sul canale/i.test(r.nota) && /dall'anno prima/.test(r.nota) && /somma dei da_dichiarare_t di mesi_aperti fa resta_t/.test(r.nota), r.nota);
  // Una risposta costruita: l'ACI con due righe, la casella solo sulla prima. Lo
  // strumento passa l'apertura di ogni riga, e un flusso senza apertura non la
  // inventa a zero.
  rispostaFinta = {
    anno: 2026, foto_portale_il: '2026-10-09', siti: [{ sito: 'GATIM SRL', tipo_destinazione: 'imp', canale: 'RETE', dichiara_rete: true, giacenza_portale_t: null,
      flussi: [
        { canale: 'ACI', provenienza: 'primaria', non_dovuta: false, apertura_t: 4, resta_t: 0, conferito_t: 10, dichiarato_caricato_t: 12, mesi: [],
          dall_anno_prima: { conferito_kg: 4000, uscito_kg: 4000, resta_kg: 0, da_dichiarare_kg: 0, letta_kg: 4000, dichiarato_dopo_kg: 0, al: '2025-12-31' } },
        { canale: 'ACI', provenienza: 'secondaria', non_dovuta: false, apertura_t: 0, resta_t: 7, conferito_t: 5, dichiarato_caricato_t: 0, mesi: [mese('Settembre', 7000, 5000)] },
        { canale: 'RETE', provenienza: '', non_dovuta: false, resta_t: 1, conferito_t: 1, dichiarato_caricato_t: 0, mesi: [mese('Settembre', 1000)] },
      ] }], totali: {}, doppioni: [], dichiarazioni_da_inserire: [],
  };
  const fin = (await riepilogo.esegui(base44, { anno: 2026, sito: 'Gatim' })).dati.siti.righe[0].flussi;
  const aci = fin.filter(f => f.canale === 'ACI');
  verifica('ACI su due righe: ogni riga porta la sua apertura', aci.length === 2 && aci[0].apertura_t === 4 && aci[1].apertura_t === 0, JSON.stringify(aci));
  verifica('una casella dall\'anno prima gia\' tutta uscita non e\' un mese aperto', aci[0].mesi_aperti.length === 0, JSON.stringify(aci[0].mesi_aperti));
  verifica('e il canale torna sommando le righe: 4 + 15 - 12 = 7', Math.round(aci.reduce((s, f) => s + f.apertura_t + f.arrivato_t - f.dichiarato_e_caricato_t, 0) * 1000) / 1000 === aci.reduce((s, f) => s + f.resta_t, 0));
  verifica('un flusso senza apertura nella risposta la lascia vuota, non zero', fin.find(f => f.canale === 'RETE').apertura_t === null, JSON.stringify(fin.find(f => f.canale === 'RETE')));
  rispostaFinta = null;
}

// 5. UN ANNO CHIUSO (revisione W5). Per il 2025 la pagina confronta con la lettura
// del portale al 31/12/2025 e, se la chiusura non l'ha salvata, dice che non e' un
// errore da verificare. Lo strumento diceva «senza la fotografia del portale», cioe'
// un file da caricare, e attaccava ai numeri la data della fotografia di oggi.
console.log('5. UN ANNO CHIUSO: LA LETTURA DEL 31/12, NON LA FOTOGRAFIA DI OGGI');
for (const v of ['OrdineNonDichiarato', 'DichiarazioneTrattamento', 'GiacenzaSito', 'PrimariaRete', 'DichiarazioneSito']) con(v, []);
con('PrimariaRete', [{ ...primaria('ET25000001', 8000, '2025-05-12'), ordine_immesso_il: g('2025-05-02') }]);
con('OrdineNonDichiarato', [{ ordine_primaria: 'ET25000001', destinazione: ALFA, prodotto: '.class1', peso_non_dichiarato_kg: 8000, created_date: '2026-10-01T06:00:00Z', fine_trasporto: '2025-05-12' }]);
{
  con('GiacenzaSito', [{ sito: ALFA, tipo_destinazione: 'imp', anno: 2025, dichiara_rete: true }]);
  const pagina = await FUNZIONI.riepilogoDichiarazioni({ anno: 2025 });
  const sp = pagina.siti.find(s => s.sito === ALFA);
  verifica('la pagina: anno chiuso, nessun numero a portale, col suo perche\'', pagina.anno_chiuso === true && sp.giacenza_portale_t === null && /chiuso/.test(sp.quadratura_anno_chiuso && sp.quadratura_anno_chiuso.perche), JSON.stringify(sp.quadratura_anno_chiuso));
  const r = (await riepilogo.esegui(base44, { anno: 2025, sito: 'Alfa Recycling' })).dati;
  const q = r.siti.righe[0].quadratura_rete;
  verifica('senza la lettura del 31/12: il perche\' e\' quello della pagina, non un file che manca',
    q.confrontabile === false && q.anno_chiuso === true && q.perche === sp.quadratura_anno_chiuso.perche && !/senza la fotografia del portale/.test(q.perche), JSON.stringify(q));
  verifica('la fotografia di oggi non viaggia con un anno chiuso', !('fotografia_del_portale_del' in r) && r.anno_chiuso === true && r.portale_al === '2025-12-31' && /31\/12\/2025/.test(r.nota_anno_chiuso || ''),
    JSON.stringify({ foto: r.fotografia_del_portale_del, anno_chiuso: r.anno_chiuso, portale_al: r.portale_al }));

  // Con la lettura salvata dalla chiusura (l'apertura del 2026 col suo giorno) la
  // quadratura si fa, e il numero porta il 31/12.
  con('GiacenzaSito', [
    { sito: ALFA, tipo_destinazione: 'imp', anno: 2025, dichiara_rete: true },
    { sito: ALFA, tipo_destinazione: 'imp', anno: 2026, dichiara_rete: true, giacenza_riferimento_t: 8, apertura_del: '2025-12-31' },
  ]);
  const r2 = (await riepilogo.esegui(base44, { anno: 2025, sito: 'Alfa Recycling' })).dati;
  const q2 = r2.siti.righe[0].quadratura_rete;
  verifica('con la lettura del 31/12: confronta, quadra, e dice di che giorno e\' il numero a portale',
    q2.confrontabile === true && q2.quadra === true && q2.giacenza_portale_t === 8 && q2.portale_al === '2025-12-31' && q2.anno_chiuso === true && /lettura del portale di quel giorno/.test(q2.perche), JSON.stringify(q2));

  // L'anno in corso resta com'era: la data della fotografia, senza segni di anno chiuso.
  const r3 = (await riepilogo.esegui(base44, { anno: 2026, sito: 'Alfa Recycling' })).dati;
  verifica('l\'anno in corso porta ancora la data della fotografia', r3.fotografia_del_portale_del === '2026-10-01' && !r3.anno_chiuso, JSON.stringify({ foto: r3.fotografia_del_portale_del, chiuso: r3.anno_chiuso }));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
