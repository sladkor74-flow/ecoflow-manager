// Prova delle due funzioni del passaggio a Target & Status (27/09/2026):
//   - copiaAnnoTarget: un anno nuovo nasce come copia del precedente; solo
//     l'amministratore, mai su un anno chiuso ne' da un anno vuoto; con simula
//     conta soltanto; i collegamenti puntano ai nuovi impianti; ripetuta non
//     crea doppioni;
//   - portaTargetInTargetStatus: gli impianti che hanno il target solo nelle
//     Giacenze lo ricevono in Target & Status, senza entrare nella predittivita'.
//
// Le funzioni si impacchettano con esbuild e un SDK finto che legge e scrive gli
// archivi di globalThis.__ARCHIVI (come in predittivitaFunzioni.mjs). Il giorno
// e' fissato al 23/09/2026. npm run prove
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));

const ADESSO = Date.parse('2026-09-23T06:00:00Z');
const DataVera = Date;
class DataFissa extends DataVera {
  constructor(...a) { super(...(a.length ? a : [ADESSO])); }
  static now() { return ADESSO; }
}
globalThis.Date = DataFissa;

const SDK_FINTO = `
let orologio = 0;
const istante = () => new Date(Date.now() + (++orologio) * 1000).toISOString();
function entita(nome) {
  const righe = () => (globalThis.__ARCHIVI[nome] ||= []);
  const crea = (d) => { const r = { id: nome + '-' + (righe().length + 1), created_date: istante(), ...d }; righe().push(r); globalThis.__SCRITTI.push({ nome, op: 'create', d }); return { ...r }; };
  return {
    filter: async (f, _o, quanti = 1e9, salta = 0) => righe().filter(r => Object.entries(f || {}).every(([k, v]) => r[k] === v)).slice(salta, salta + quanti).map(r => ({ ...r })),
    list: async (_o, quanti = 1e9, salta = 0) => righe().slice(salta, salta + quanti).map(r => ({ ...r })),
    create: async (d) => crea(d),
    bulkCreate: async (ds) => ds.map(crea),
    update: async (id, d) => { const r = righe().find(x => x.id === id); if (!r) throw new Error('non trovato ' + id); Object.assign(r, d); globalThis.__SCRITTI.push({ nome, op: 'update', id, d }); return { ...r }; },
  };
}
const entities = new Proxy({}, { get: (_t, nome) => entita(nome) });
export function createClientFromRequest() {
  return { auth: { me: async () => { if (!globalThis.__UTENTE) throw new Error('non autenticato'); return globalThis.__UTENTE; } }, asServiceRole: { entities }, entities };
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

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
const ADMIN = { role: 'admin', full_name: 'Amministratore' };

const ARCHIVI = () => ({
  ImpiantoTargetSecondaria: [
    { id: 'iT', nome_impianto: 'T-CYCLE INDUSTRIES SRL', target: 1050000, totale_capacity_kg: 1300000, data_fine: '2026-12-18', stato: 'attivo' },
    { id: 'iG', nome_impianto: 'Tecnogum Srl', target: 500000, stato: 'attivo', anno: 2026 },
    { id: 'iI', nome_impianto: 'Irigom Srl', target: 800000, stato: 'attivo' },
  ],
  FornitoreSecondaria: [
    { id: 'fN1', nome: 'Nappi Sud', impianto_id: 'iG', impianto_nome: 'Tecnogum Srl', ruolo: 'stoccaggio', plafond_stoccaggio_kg: 400000, stato: 'attivo' },
    { id: 'fN2', nome: 'Nappi Sud', impianto_id: 'iI', impianto_nome: 'Irigom Srl', ruolo: 'stoccaggio', plafond_stoccaggio_kg: 400000, stato: 'attivo' },
    { id: 'fT', nome: 'T-Cycle', impianto_id: 'iG', impianto_nome: 'Tecnogum Srl', ruolo: 'doppio_ruolo', plafond_stoccaggio_kg: 250000, stato: 'attivo' },
    { id: 'fO', nome: 'Orfano', impianto_id: 'sparito', ruolo: 'stoccaggio', stato: 'attivo' },
  ],
  TargetRaccoglitore: [
    { id: 'r1', raccoglitore: 'C.L. Service', impianto: 'Irigom Srl', anno: 2026, target_tonnellate: 300 },
    { id: 'r2', raccoglitore: 'Ecorecuperi', impianto: 'Tecnogum', anno: 2026, target_tonnellate: 200 },
  ],
  TargetMensile: [
    { id: 'm1', raccoglitore: 'C.L. Service', regione: 'Puglia', impianto: 'Irigom Srl', mese: 'Gennaio', anno: 2026, target: 25 },
    { id: 'm2', raccoglitore: 'C.L. Service', regione: 'Puglia', impianto: 'Irigom Srl', mese: 'Febbraio', target: 25 },
  ],
  CommessaEcotyre: [{ id: 'c1', anno: 2026, target_annuo_t: 30000 }],
  GiacenzaSito: [
    { id: 's1', sito: 'TECNOGUM SRL', tipo_destinazione: 'imp', anno: 2026, dichiara_rete: false, target_totale_t: 2305 },
    { id: 's2', sito: 'GREEN TYRE PROJECT SRL', tipo_destinazione: 'imp', anno: 2026, target_totale_t: 2500 },
    { id: 's3', sito: 'T.R.S. SRL', tipo_destinazione: 'imp', anno: 2026, target_totale_t: 300 },
    { id: 's4', sito: 'NAPPI SUD SRL', tipo_destinazione: 'stoc', anno: 2026, target_totale_t: 0 },
    { id: 's5', sito: 'Gatim Srl', tipo_destinazione: 'imp', anno: 2026, target_totale_t: 950 },
  ],
});
const prepara = (utente = ADMIN) => { globalThis.__ARCHIVI = ARCHIVI(); globalThis.__SCRITTI = []; globalThis.__UTENTE = utente; };

// --- copiaAnnoTarget
const copia = await funzione('copiaAnnoTarget');

prepara(null);
verifica('senza utente: 401', (await copia({ anno: 2027 })).status === 401);
prepara({ role: 'user' });
let r = await copia({ anno: 2027 });
verifica('chi non e\' amministratore non copia', r.status === 403 && globalThis.__SCRITTI.length === 0, J(r));
prepara();
r = await copia({ anno: 2025 });
verifica('un anno chiuso si rifiuta', r.status === 400 && r.body.anno_chiuso === true && globalThis.__SCRITTI.length === 0, J(r));
r = await copia({});
verifica('senza anno si rifiuta', r.status === 400);
r = await copia({ anno: 2028 });
verifica('un anno oltre il prossimo si rifiuta', r.status === 400, J(r));
globalThis.__ARCHIVI = {};
r = await copia({ anno: 2027 });
verifica('da un anno vuoto non si copia', r.status === 400 && r.body.anno_precedente_vuoto === true, J(r));

prepara();
r = await copia({ anno: 2027, simula: true });
verifica('simula: conta e non scrive', r.status === 200 && r.body.simulato === true && r.body.da === 2026 && globalThis.__SCRITTI.length === 0
  && J(r.body.conteggi) === J({ impianti: 6, collegamenti: 3, raccoglitori: 2, mensili: 2, commessa: 1, siti: 5 }) && r.body.impianti_da_giacenze === 3, J(r.body));
verifica('simula: dice gli orfani saltati', r.body.saltati.collegamenti_orfani === 1, J(r.body.saltati));

r = await copia({ anno: 2027 });
const A = globalThis.__ARCHIVI;
verifica('copia: risponde coi conteggi', r.status === 200 && r.body.ok === true && r.body.simulato === false && J(r.body.conteggi) === J({ impianti: 6, collegamenti: 3, raccoglitori: 2, mensili: 2, commessa: 1, siti: 5 }), J(r.body));
const nuovi = A.ImpiantoTargetSecondaria.filter(i => i.anno === 2027);
verifica('copia: sei impianti del 2027, senza data di fine, da confermare', nuovi.length === 6 && nuovi.every(i => !i.data_fine && i.stato === 'attivo' && /copiato dal 2026, da confermare/.test(i.note)), J(nuovi));
verifica('copia: Green Tyre, T.R.S. e Gatim, che avevano il target solo in Giacenze, non lo perdono', ['GREEN', 'T\\.R\\.S', 'Gatim'].every(n => { const i = nuovi.find(x => new RegExp(n).test(x.nome_impianto)); return i && i.segue_predittivita === false && i.target > 0; }) && nuovi.find(x => /Gatim/.test(x.nome_impianto)).target === 950000, J(nuovi));
const idNuovi = new Set(nuovi.map(i => i.id));
const colNuovi = A.FornitoreSecondaria.filter(f => f.anno === 2027);
verifica('copia: i collegamenti puntano agli impianti nuovi', colNuovi.length === 3 && colNuovi.every(f => idNuovi.has(f.impianto_id) && !('impianto_chiave' in f)), J(colNuovi));
const tecnogum27 = nuovi.find(i => /Tecnogum/.test(i.nome_impianto));
const nappi = colNuovi.filter(f => f.nome === 'Nappi Sud');
verifica('copia: la priorita\' di Nappi Sud e\' scritta (Tecnogum 1, Irigom 2)', nappi.find(f => f.impianto_id === tecnogum27.id)?.priorita === 1 && nappi.find(f => f.impianto_id !== tecnogum27.id)?.priorita === 2, J(nappi));
verifica('copia: raccoglitori e mesi del 2027 con lo storico "copiato"', A.TargetRaccoglitore.filter(t => t.anno === 2027).length === 2 && A.TargetMensile.filter(t => t.anno === 2027).length === 2
  && A.TargetRaccoglitore.filter(t => t.anno === 2027).every(t => /copiato dal 2026, da confermare/.test(t.storico_json) && /Amministratore/.test(t.storico_json)));
verifica('copia: il contratto del 2027', A.CommessaEcotyre.filter(c => c.anno === 2027).length === 1 && A.CommessaEcotyre.find(c => c.anno === 2027).target_annuo_t === 30000);
const siti27 = A.GiacenzaSito.filter(s => s.anno === 2027);
verifica('copia: i siti del 2027 senza target', siti27.length === 5 && siti27.every(s => !s.target_totale_t) && siti27.find(s => /TECNOGUM/.test(s.sito)).dichiara_rete === false);
verifica('copia: niente di vecchio e\' cambiato', A.ImpiantoTargetSecondaria.filter(i => i.anno !== 2027).length === 3 && A.FornitoreSecondaria.length === 7);

const scrittiPrima = globalThis.__SCRITTI.length;
r = await copia({ anno: 2027 });
verifica('ripetuta: non crea niente', r.status === 200 && globalThis.__SCRITTI.length === scrittiPrima && Object.values(r.body.conteggi).every(n => n === 0), J(r.body));

// una copia interrotta dopo gli impianti: la seconda completa i collegamenti
prepara();
globalThis.__ARCHIVI.ImpiantoTargetSecondaria.push({ id: 'giaT', nome_impianto: 'Tecnogum', target: 600000, anno: 2027, stato: 'attivo', note: 'copiato dal 2026, da confermare' });
r = await copia({ anno: 2027 });
const colT = globalThis.__ARCHIVI.FornitoreSecondaria.filter(f => f.anno === 2027 && f.impianto_id === 'giaT');
verifica('un impianto che l\'anno ha gia\' non si copia, e i collegamenti vanno a lui', r.body.conteggi.impianti === 5 && r.body.saltati.impianti_esistenti === 1 && colT.length === 2 && colT.every(f => f.impianto_nome === 'Tecnogum'), J(r.body));

// l'anno in corso, gia' compilato: la copia dal 2025 non lo inquina
prepara();
globalThis.__ARCHIVI.TargetRaccoglitore.push({ id: 'v', raccoglitore: 'Raccoglitore sparito', impianto: 'Irigom', anno: 2025, target_tonnellate: 50 });
globalThis.__ARCHIVI.TargetMensile.push({ id: 'vm', raccoglitore: 'Raccoglitore sparito', impianto: 'Irigom', mese: 'Gennaio', anno: 2025, target: 4 });
globalThis.__ARCHIVI.GiacenzaSito.push({ id: 'vs', sito: 'Sito del 2025', tipo_destinazione: 'stoc', anno: 2025 });
globalThis.__ARCHIVI.ImpiantoTargetSecondaria.push({ id: 'v25', nome_impianto: 'Impianto del 2025', target: 1000, anno: 2025, stato: 'attivo' });
r = await copia({ anno: 2026 });
verifica('anno in corso compilato: dal 2025 non entra niente, e lo si dice', r.status === 200 && Object.values(r.body.conteggi).every(n => n === 0) && globalThis.__SCRITTI.length === 0
  && r.body.saltati.raccoglitori_gia_compilati === 1 && r.body.saltati.mensili_gia_compilati === 1 && r.body.saltati.siti_gia_compilati === 1 && r.body.saltati.impianti_gia_compilati === 1, J(r.body));

// --- portaTargetInTargetStatus
const porta = await funzione('portaTargetInTargetStatus');
prepara({ role: 'user' });
verifica('porta: chi non e\' amministratore no', (await porta({ anno: 2026 })).status === 403);
prepara();
verifica('porta: un anno chiuso no', (await porta({ anno: 2025 })).status === 400 && globalThis.__SCRITTI.length === 0);
r = await porta({ anno: 2026, simula: true });
verifica('porta simula: gli impianti col target solo nelle Giacenze, senza scrivere', r.status === 200 && globalThis.__SCRITTI.length === 0
  && J(r.body.creati.map(c => c.sito).sort()) === J(['GREEN TYRE PROJECT SRL', 'Gatim Srl', 'T.R.S. SRL']), J(r.body));
r = await porta({ anno: 2026 });
const portati = globalThis.__ARCHIVI.ImpiantoTargetSecondaria.filter(i => i.segue_predittivita === false);
verifica('porta: creati in kg, per quell\'anno, attivi, fuori dalla predittivita\'', portati.length === 3 && portati.every(i => i.anno === 2026 && i.stato === 'attivo')
  && portati.find(i => /GREEN/.test(i.nome_impianto)).target === 2500000 && portati.find(i => /T\.R\.S/.test(i.nome_impianto)).target === 300000, J(portati));
verifica('porta: Tecnogum ha gia\' il suo target e non si tocca', !r.body.creati.some(c => /TECNOGUM/i.test(c.sito)) && globalThis.__ARCHIVI.ImpiantoTargetSecondaria.filter(i => /tecnogum/i.test(i.nome_impianto)).length === 1);
const n = globalThis.__SCRITTI.length;
r = await porta({ anno: 2026 });
verifica('porta ripetuta: niente di nuovo', r.body.creati.length === 0 && globalThis.__SCRITTI.length === n);
prepara();
globalThis.__ARCHIVI.ImpiantoTargetSecondaria.push({ id: 'spento', nome_impianto: 'Gatim', target: 1, stato: 'non_attivo', anno: 2026 });
r = await porta({ anno: 2026 });
verifica('porta: un impianto spento di quell\'anno non si riaccende, e si dice di farlo a mano', !r.body.creati.some(c => /Gatim/.test(c.sito)) && r.body.saltati.some(s => /Gatim/.test(s.sito) && /riattivalo a mano/.test(s.motivo)) && globalThis.__ARCHIVI.ImpiantoTargetSecondaria.find(i => i.id === 'spento').stato === 'non_attivo', J(r.body));
prepara();
globalThis.__ARCHIVI.ImpiantoTargetSecondaria.push({ id: 'zero', nome_impianto: 'T.R.S. S.r.l.', target: 0, stato: 'attivo', anno: 2026 });
r = await porta({ anno: 2026, simula: true });
verifica('porta simula: un impianto attivo con target zero si propone di aggiornarlo, senza scrivere', r.body.aggiornati.length === 1 && r.body.aggiornati[0].target_kg === 300000 && !r.body.creati.some(c => /T\.R\.S/.test(c.sito)) && globalThis.__SCRITTI.length === 0, J(r.body));
r = await porta({ anno: 2026 });
const zero = globalThis.__ARCHIVI.ImpiantoTargetSecondaria.find(i => i.id === 'zero');
verifica('porta: il target zero diventa quello di Giacenze, sullo stesso record, fuori dalla predittivita\'', zero.target === 300000 && zero.segue_predittivita === false && globalThis.__ARCHIVI.ImpiantoTargetSecondaria.filter(i => /t\.?r\.?s/i.test(i.nome_impianto)).length === 1, J(zero));
r = await porta({ anno: 2026 });
verifica('porta: ripetuta, niente da aggiornare', r.body.aggiornati.length === 0 && r.body.creati.length === 0);

console.log(`\n${ok} verifiche riuscite, ${ko} fallite`);
process.exit(ko ? 1 : 0);
