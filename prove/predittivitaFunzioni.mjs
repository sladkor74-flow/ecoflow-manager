// Prova delle tre funzioni della predittivita' delle secondarie insieme, sugli
// stessi archivi: la Dashboard (calcolaPianificazioneSecondaria), la Proiezione
// a fine anno (proiezioneSecondarie) e il suggerimento del lunedi'
// (analisiSettimanalePredittiva). Devono dare lo stesso gia' arrivato di rete e
// lo stesso residuo (regola dell'utente del 22/09/2026), col piazzale di T-Cycle
// al netto di quello che riparte per Tecnogum, e:
//   - il plafond del piazzale di T-Cycle si consuma solo con le partenze per
//     gli altri impianti, non con i trasbordi a se stesso;
//   - la disponibilita' di Tecnogum dal piazzale di T-Cycle non comprende quello
//     che T-Cycle trasborda a se stesso;
//   - il target di raccolta di T-Cycle non compare intero sotto Tecnogum.
//
// Le funzioni importano l'SDK da npm: qui si impacchettano con esbuild (quello
// di vite, gia' fra i pacchetti) e un SDK finto che legge gli archivi da
// globalThis.__ARCHIVI. Il giorno e' fissato al 22/09/2026, altrimenti l'anno
// di riferimento cambierebbe col calendario. npm run prove
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));

// --- il giorno fisso: martedi' 22/09/2026, la settimana conclusa e' 14-20/09
const ADESSO = Date.parse('2026-09-22T10:00:00Z');
const DataVera = Date;
class DataFissa extends DataVera {
  constructor(...a) { super(...(a.length ? a : [ADESSO])); }
  static now() { return ADESSO; }
}
globalThis.Date = DataFissa;

// --- l'SDK finto
const SDK_FINTO = `
const filtra = (righe, f) => righe.filter(r => Object.entries(f || {}).every(([k, v]) => r[k] === v));
function entita(nome) {
  const righe = () => (globalThis.__ARCHIVI[nome] || []);
  const scrivi = (x) => { (globalThis.__SCRITTI ||= []).push({ nome, ...x }); };
  return {
    filter: async (f, _o, lim = 1e9, skip = 0) => filtra(righe(), f).slice(skip, skip + lim),
    list: async (_o, lim = 1e9, skip = 0) => righe().slice(skip, skip + lim),
    create: async (d) => { scrivi({ op: 'create', d }); return { id: 'n' + Math.random(), ...d }; },
    update: async (id, d) => { scrivi({ op: 'update', id, d }); return { id, ...d }; },
    bulkCreate: async (a) => { scrivi({ op: 'bulkCreate', n: a.length }); return a; },
    bulkUpdate: async (a) => { scrivi({ op: 'bulkUpdate', n: a.length }); return a; },
  };
}
const entities = new Proxy({}, { get: (_t, nome) => entita(nome) });
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: 'admin', email: 'prova' }) }, asServiceRole: { entities }, entities };
}`;
const sdkFinto = {
  name: 'sdk-finto',
  setup(b) {
    b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'finto' }));
    b.onLoad({ filter: /.*/, namespace: 'finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
  },
};
async function funzione(nome) {
  const r = await build({
    entryPoints: [qui(`../base44/functions/${nome}/entry.ts`)],
    bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent', plugins: [sdkFinto],
  });
  const m = await import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
  return async (body = {}) => { const res = await m.default({ json: async () => body }); return { status: res.status, body: await res.json() }; };
}

// --- gli archivi
const D = (fine, extra = {}) => ({ ordine_immesso_il: '2026-05-01T08:00:00Z', trasporto_iniziato_il: fine, trasporto_finito_il: fine, ...extra });
let n = 0;
const prim = (trasp, dest, tipo, kg, fine, extra = {}) => ({ id: 'p' + (++n), id_ordine: 'P' + n, stato: 'terminato', classe: 'A', trasportatore: trasp, destinazione: dest, tipo_destinazione: tipo, peso_effettivo: kg, ...D(fine), ...extra });
const sec = (sto, dest, kg, fine, extra = {}) => ({ id: 's' + (++n), id_ordine: 'S' + n, stato: 'terminato', classe: 'A', stoccaggio: sto, destinazione: dest, tipo_destinazione: 'imp', peso_effettivo: kg, ...D(fine), ...extra });
globalThis.__ARCHIVI = {
  ImpiantoTargetSecondaria: [
    { id: 'iT', nome_impianto: 'T-CYCLE INDUSTRIES SRL', target: 1050000, totale_capacity_kg: 1300000, stato: 'attivo' },
    { id: 'iG', nome_impianto: 'Tecnogum Srl', target: 500000, stato: 'attivo' },
    { id: 'iI', nome_impianto: 'Irigom Srl', target: 800000, stato: 'attivo' },
  ],
  FornitoreSecondaria: [
    { id: 'fT', nome: 'T-Cycle', impianto_id: 'iG', impianto_nome: 'Tecnogum Srl', ruolo: 'doppio_ruolo', plafond_stoccaggio_kg: 250000, stato: 'attivo' },
    { id: 'fT2', nome: 'T-Cycle', impianto_id: 'iT', impianto_nome: 'T-CYCLE INDUSTRIES SRL', ruolo: 'raccoglitore', stato: 'attivo' },
    { id: 'fN1', nome: 'Nappi Sud', impianto_id: 'iG', impianto_nome: 'Tecnogum Srl', ruolo: 'stoccaggio', stato: 'attivo' },
    { id: 'fN2', nome: 'Nappi Sud', impianto_id: 'iI', impianto_nome: 'Irigom Srl', ruolo: 'stoccaggio', stato: 'attivo' },
    { id: 'fC', nome: 'C.L. Service', impianto_id: 'iI', impianto_nome: 'Irigom Srl', ruolo: 'raccoglitore', stato: 'attivo' },
    { id: 'fI', nome: 'Irigom', impianto_id: 'iI', impianto_nome: 'Irigom Srl', ruolo: 'stoccaggio', stato: 'attivo' },
  ],
  PrimariaRete: [
    prim('C.L. Service', 'IRIGOM SRL', 'stoc', 50000, '2026-09-15T09:00:00Z'),       // nel piazzale di Irigom, la settimana conclusa
    prim('Logistica & Pneumatici', 'T-Cycle Srl', 'imp', 100000, '2026-06-10T09:00:00Z'),
    prim('C.L. Service', 'T-Cycle Srl', 'stoc', 50000, '2026-06-10T09:00:00Z'),       // nel piazzale di T-Cycle
    prim('C.L. Service', 'T-Cycle Srl', 'stoc', 100000, '2026-07-10T09:00:00Z'),
    prim('C.L. Service', 'T-Cycle Srl', 'stoc', 100000, '2026-08-10T09:00:00Z'),
    prim('Ecorecuperi', 'Tecnogum', 'imp', 20000, '2026-09-16T09:00:00Z'),
    prim('Ecorecuperi', 'Tecnogum', 'imp', 1000, '2026-07-01T09:00:00Z', { trasporto_iniziato_il: null }), // manca l'inizio: contata e segnalata
    { id: 'px', id_ordine: 'PX', stato: 'terminato', classe: 'A', trasportatore: 'X', destinazione: 'Irigom', tipo_destinazione: 'imp', peso_effettivo: 5000, ordine_immesso_il: '2026-09-01T08:00:00Z', trasporto_iniziato_il: '2026-09-02T08:00:00Z', ordine_chiuso_il: '2026-09-05T08:00:00Z' }, // senza fine: fuori e segnalata
    prim('X', 'Irigom', 'imp', 7000, '2026-09-15T09:00:00Z', { classe: '9 - PFU Autodemolizione' }), // ACI: fuori
  ],
  Secondaria: [
    sec('Irigom', 'Irigom', 40000, '2026-09-17T09:00:00Z'),         // dal piazzale di Irigom a se stesso: mai
    sec('Nappi Sud', 'Irigom', 27000, '2026-09-18T09:00:00Z'),
    sec('T-Cycle', 'T-Cycle', 50000, '2026-06-12T09:00:00Z'),       // dal piazzale di T-Cycle a se stesso: mai
    sec('T-Cycle', 'T-Cycle', 60000, '2026-07-12T09:00:00Z'),
    sec('T-Cycle', 'T-Cycle', 60000, '2026-08-12T09:00:00Z'),
    sec('T-Cycle', 'Tecnogum', 40000, '2026-06-12T09:00:00Z'),      // dal piazzale di T-Cycle a Tecnogum: lo conta Tecnogum
    sec('Nappi Sud', 'Tecnogum', 13500, '2026-06-12T09:00:00Z'),
  ],
  TargetRaccoglitore: [
    { raccoglitore: 'C.L. Service', target_tonnellate: 200, anno: 2026 },
    { raccoglitore: 'Nappi Sud', target_tonnellate: 2100, anno: 2026 },
    { raccoglitore: 'T-Cycle', target_tonnellate: 300, anno: 2026 },
  ],
  GiacenzaStoccaggio: [
    { id: 'g1', sito: 'T-Cycle', data_rilevazione: '2026-08-31', class1_kg: 20000, created_date: '2026-09-01T08:00:00Z' },
    { id: 'g2', sito: 'Nappi Sud', data_rilevazione: '2026-08-31', class1_kg: 0, created_date: '2026-09-01T08:00:00Z' },
  ],
  PianificazioneSettimanale: [], UploadLog: [], IpotesiMensileSecondarie: [], GiacenzaSito: [], Alert: [],
};

let ok = 0, ko = 0;
const verifica = (nome, c, extra = '') => { if (c) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const fmt = (x) => x.toLocaleString('it-IT');

const dash = await (await funzione('calcolaPianificazioneSecondaria'))();
const pro = await (await funzione('proiezioneSecondarie'))();
const lun = await (await funzione('analisiSettimanalePredittiva'))();
verifica('le tre funzioni rispondono', dash.status === 200 && pro.status === 200 && lun.status === 200, JSON.stringify([dash.body.error, pro.body.error, lun.body.error]));

console.log('LO STESSO GIA\' ARRIVATO E LO STESSO RESIDUO');
// T-Cycle: 100.000 all'impianto + 250.000 nel piazzale - 40.000 ripartiti per
// Tecnogum; le secondarie a se stesso fuori. Tecnogum: 21.000 in primaria, i
// 40.000 da T-Cycle e 13.500 da Nappi Sud. Irigom: 50.000 nel piazzale e 27.000
// da Nappi Sud, non la secondaria a se stesso.
const ATTESO = { 'T-CYCLE INDUSTRIES SRL': [310000, 740000], 'Tecnogum Srl': [74500, 425500], 'Irigom Srl': [77000, 723000] };
for (const [nome, [arr, res]] of Object.entries(ATTESO)) {
  const d = dash.body.impianti.find(x => x.impianto.nome === nome);
  const p = pro.body.impianti.find(x => x.impianto_registrato === nome);
  verifica(`${nome}: dashboard ${arr}/${res}`, d.consuntivo === arr && d.residuo === res, JSON.stringify({ c: d.consuntivo, r: d.residuo }));
  verifica(`${nome}: proiezione ${arr}/${res}`, p.conferito_kg === arr && p.residuo_kg === res, JSON.stringify({ c: p.conferito_kg, r: p.residuo_kg }));
  verifica(`${nome}: suggerimento ${arr}/${res}`, lun.body.suggestion.includes(`Già arrivato di rete nel 2026: ${fmt(arr)} kg`) && lun.body.suggestion.includes(`Residuo: ${fmt(res)} kg`), lun.body.suggestion.split('\n\n').find(x => x.startsWith(nome.split(' ')[0])));
}
const tcD = dash.body.impianti.find(x => x.impianto.nome === 'T-CYCLE INDUSTRIES SRL');
verifica('dashboard: il piazzale di T-Cycle al netto, e il sito sulla capacita\' contato una volta', tcD.consuntivo_primarie_piazzale === 250000 && tcD.consuntivo_piazzale_ripartito === 40000 && tcD.consuntivo_primarie_piazzale_netta === 210000 && tcD.gia_arrivato_al_sito === 350000, JSON.stringify(tcD).slice(0, 400));
const tcP = pro.body.impianti.find(x => x.impianto_registrato === 'T-CYCLE INDUSTRIES SRL');
verifica('proiezione: gli stessi numeri del piazzale', tcP.conferito_primaria_piazzale_kg === 250000 && tcP.conferito_piazzale_ripartito_kg === 40000 && tcP.conferito_primaria_piazzale_netta_kg === 210000 && tcP.arrivato_al_sito_kg === 350000);
verifica('suggerimento: la composizione col piazzale al netto', lun.body.suggestion.includes('di cui 210.000 kg nel piazzale dell\'impianto, al netto di 40.000 kg ripartiti per altri impianti'), lun.body.suggestion.split('\n\n').find(x => x.startsWith('T-CYCLE')));
verifica('le note di T-Cycle, in Dashboard e in Proiezione: a se stesso, per Tecnogum, il netto', [tcD.note, tcP.note].every(note => note.length === 3 && note[0].includes('170,00 t') && note[1].includes('40,00 t') && note[2].includes('ne restano 210,00 t')), JSON.stringify([tcD.note, tcP.note]));

console.log('IL PLAFOND DEL PIAZZALE DI T-CYCLE');
const plafond = dash.body.stoccaggi.find(s => s.nome_normalizzato === 't-cycle');
verifica('i trasbordi a se stesso non consumano il plafond', plafond.kg_partiti === 40000 && plafond.kg_trasbordati_a_se === 170000 && plafond.residuo_plafond === 210000, JSON.stringify(plafond));

console.log('IL TARGET DI RACCOLTA DI T-CYCLE');
// 170.000 kg trasbordati a se stesso, 40.000 a Tecnogum: dei 300.000 di target a
// Tecnogum ne tocca il 19%, a T-Cycle l'81%. Prima Tecnogum mostrava tutti i
// 300.000, e sotto T-Cycle compariva di nuovo lo stesso target intero.
const tg = dash.body.impianti.find(x => x.impianto.nome === 'Tecnogum Srl');
const tcPerTg = tg.fornitori.find(f => f.nome === 'T-Cycle');
const tcPerTc = tcD.fornitori.find(f => f.nome === 'T-Cycle');
verifica('sotto Tecnogum solo la quota di T-Cycle, con la nota', tcPerTg.target_raccoglitore_kg === 57143 && tcPerTg.target_raccoglitore_intero_kg === 300000 && /compresi i trasbordi/.test(tcPerTg.nota_quota || '') && tcPerTg.nota_quota.includes('300,00 t'), JSON.stringify({ t: tcPerTg.target_raccoglitore_kg, n: tcPerTg.nota_quota }));
verifica('le due quote fanno il target una volta sola', tcPerTg.target_raccoglitore_kg + tcPerTc.target_raccoglitore_kg === 300000, JSON.stringify([tcPerTg.target_raccoglitore_kg, tcPerTc.target_raccoglitore_kg]));
verifica('il piano di T-Cycle per Tecnogum viene dal plafond che resta', tcPerTg.quota_plafond_impianto === 210000 && tcPerTg.kg_per_settimana > 0, JSON.stringify({ q: tcPerTg.quota_plafond_impianto, k: tcPerTg.kg_per_settimana }));
const nappiIrigom = dash.body.impianti.find(x => x.impianto.nome === 'Irigom Srl').fornitori.find(f => f.nome === 'Nappi Sud');
const nappiTecnogum = tg.fornitori.find(f => f.nome === 'Nappi Sud');
verifica('Nappi Sud diviso come prima fra Irigom e Tecnogum', nappiIrigom.target_raccoglitore_kg + nappiTecnogum.target_raccoglitore_kg === 2100000 && nappiIrigom.consuntivo === 27000, JSON.stringify([nappiIrigom.target_raccoglitore_kg, nappiTecnogum.target_raccoglitore_kg]));

console.log('LA DISPONIBILITA\' DI TECNOGUM DAL PIAZZALE DI T-CYCLE');
const tgP = pro.body.impianti.find(x => x.impianto_registrato === 'Tecnogum Srl');
const fonte = tgP.stoccaggi.find(s => s.nome && s.nome.toLowerCase().startsWith('t-cycle'));
verifica('la fonte T-Cycle porta i trasbordi di T-Cycle a se stesso', fonte && Math.round(fonte.media_prelievi_propri_kg) === 56667 && Math.round(fonte.media_ingressi_kg) === 83333 && fonte.giacenza_kg === 20000, JSON.stringify(fonte));
// giacenza 20.000 + 83.333 in arrivo - 56.667 trasbordati = 46.667: 3 viaggi, non 7
verifica('a settembre Tecnogum puo\' contare su 3 viaggi, non sui 7 di tutto il piazzale', tgP.mesi[0].mese === 'Settembre' && tgP.mesi[0].viaggi_disponibili === 3, JSON.stringify(tgP.mesi[0]));
const regSett = pro.body.registro_piazzali.find(r => r.mese === 'Settembre');
const pzTc = regSett && regSett.piazzali.find(p => p.nome.toLowerCase().startsWith('t-cycle'));
verifica('il registro dei piazzali dice i trasbordi del mese', pzTc && pzTc.prelievi_propri_kg === 56667, JSON.stringify(pzTc));
verifica('il piazzale di T-Cycle non e\' fonte di T-Cycle', !tcP.stoccaggi.some(s => s.chiave === 't-cycle'));

console.log('IL RESTO DEL BANCO DEL 22/09/2026');
const irigom = dash.body.impianti.find(x => x.impianto.nome === 'Irigom Srl');
verifica('il raccoglitore conta le primarie scaricate nel piazzale', irigom.fornitori.find(f => f.nome === 'C.L. Service').consuntivo === 50000);
const self = irigom.fornitori.find(f => f.nome === 'Irigom');
verifica('il piazzale proprio: nessun piano, e si segnala', self.kg_per_settimana === 0 && self.piano_settimanale.every(w => w.prev === 0) && dash.body.anomalie.some(a => a.tipo === 'piazzale_proprio' && a.fornitore === 'Irigom'));
verifica('le date da sistemare nelle tre funzioni', dash.body.anomalie.some(a => a.tipo === 'date_da_sistemare' && a.testo.includes('manca la data di inizio trasporto') && a.testo.includes('manca la data di fine trasporto, 1 ordine (PX)')) && pro.body.avvisi_generali.some(a => a.includes('PX')) && lun.body.suggestion.includes('manca la data di fine trasporto, 1 ordine (PX)'));
const settIrigom = lun.body.suggestion.split('\n\n').find(x => x.startsWith('Irigom'));
verifica('la settimana di Irigom: la primaria nel piazzale e Nappi Sud, non la secondaria a se stesso', settIrigom.includes('77.000 kg arrivati (primaria 50.000 kg, secondaria da altri stoccaggi 27.000 kg in 1 viaggio)'), settIrigom);
verifica('solo l\'amministratore salva, e qui ha salvato il piano', dash.body.piano_salvato === true);

console.log(`\n${ok} verifiche passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
