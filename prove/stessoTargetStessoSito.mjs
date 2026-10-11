// Prova di STESSO TARGET, STESSO SITO: LE GIACENZE E LA PREDITTIVITA'
// (chiusura dell'audit, 11/10/2026).
//
// Il target di un raccoglitore senza impianto scritto lo ripartivano due motori:
// le Giacenze con ripartisciTargetPrimarie (a ogni sito quello che gli e'
// arrivato, mese per mese, il resto dove il raccoglitore porta oggi) e la
// predittivita' con un conto suo, in proporzione ai chili dell'anno e solo fra i
// siti seguiti. Sullo stesso caso Nappi Sud riceveva 30 t in un modulo e 150
// nell'altro; con un raccoglitore passato da Tecnogum a T-Cycle a luglio,
// Tecnogum si aspettava ancora 175,70 t di primarie da chi li' non va piu'. E il
// programma del mercoledi' si fissa proprio sullo scenario del target.
//
// Qui la stessa base dati va a calcolaGiacenze (la funzione intera, con un SDK
// finto) e a leggiDatiPredittivita, e per ogni sito che la predittivita' segue il
// target di ogni raccoglitore deve essere lo stesso; i siti che non segue non ce
// l'hanno, e non gonfiano gli altri.
// npm run prove
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { leggiDatiPredittivita } from '../base44/shared/predittivitaDati.ts';
import { normalizzaRagioneSociale as norm } from '../base44/shared/normalizzaRagioneSociale.ts';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// --- calcolaGiacenze intera, con un SDK finto che legge globalThis.__ARCHIVI_TARGET
const SDK_FINTO = `
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => r[k] === v);
const ordina = (righe) => [...righe].sort((a, b) => String(a.id).localeCompare(String(b.id)));
const entita = (nome) => ({
  list: async (_o, lim = 1e9, skip = 0) => ordina(globalThis.__ARCHIVI_TARGET[nome] || []).slice(skip, skip + lim),
  filter: async (f, _o, lim = 1e9, skip = 0) => ordina((globalThis.__ARCHIVI_TARGET[nome] || []).filter(r => soddisfa(r, f))).slice(skip, skip + lim),
  create: async (r) => r, update: async (_id, r) => r, delete: async () => ({}), bulkCreate: async (r) => r,
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: 'admin', email: 'prova' }) }, asServiceRole: { entities }, entities };
}`;
// `guasto`, se c'e', cambia il sorgente di shared/targetImpianti.ts prima di
// impacchettare: serve a vedere se le Giacenze usano davvero le sue righe.
const impacchetta = async (guasto = null) => {
  const pacchetto = await build({
    entryPoints: [qui('../base44/functions/calcolaGiacenze/entry.ts')],
    bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
    plugins: [{ name: 'sdk-finto', setup(b) {
      b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
      b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
      if (guasto) b.onLoad({ filter: /targetImpianti\.ts$/ }, (x) => {
        const prima = readFileSync(x.path, 'utf8').replace(/\r/g, '');
        const dopo = guasto(prima);
        if (dopo === prima) throw new Error('il guasto non ha trovato niente da cambiare');
        return { contents: dopo, loader: 'ts' };
      });
    } }],
  });
  const modulo = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
  return async (corpo) => (await modulo.default({ json: async () => corpo })).json();
};
const calcolaGiacenze = await impacchetta();

// --- la predittivita', con un SDK finto che capisce $gte e null
const corrisponde = (valore, atteso) => {
  if (atteso === null) return valore === null || valore === undefined;
  if (atteso && typeof atteso === 'object' && !Array.isArray(atteso)) {
    if ('$gte' in atteso && !(valore !== null && valore !== undefined && String(valore) >= String(atteso.$gte))) return false;
    if ('$in' in atteso && !atteso.$in.includes(valore)) return false;
    return true;
  }
  return valore === atteso;
};
const sdkPredittivita = (archivi) => {
  const entita = (nome) => ({
    filter: async (f, _o, quanti = 1e9, salta = 0) => (archivi[nome] || []).filter(r => Object.entries(f || {}).every(([k, v]) => corrisponde(r[k], v))).slice(salta, salta + quanti),
    list: async (_o, quanti = 1e9, salta = 0) => (archivi[nome] || []).slice(salta, salta + quanti),
  });
  const entities = new Proxy({}, { get: (_t, nome) => entita(nome) });
  return { asServiceRole: { entities }, entities };
};

// --- i dati
let n = 0;
const T = (g) => `${g}T10:00:00Z`;
const prim = (tr, dest, kg, g, x = {}) => ({ id: 'p' + String(++n).padStart(4, '0'), id_ordine: 'P' + n, numero_fir: 'F' + n, stato: 'terminato', classe: 'P - fino a 35 kg', prodotto: '.class1', provincia: 'NA', trasportatore: tr, destinazione: dest, tipo_destinazione: 'imp', peso_effettivo: kg, ordine_immesso_il: T(g), trasporto_iniziato_il: T(g), trasporto_finito_il: T(g), ...x });
const VUOTI = ['DichiarazioneTrattamento', 'Terziaria', 'GiacenzaStoccaggio', 'IndicatoreGiorno', 'PrimariaAci', 'ExtraRaccolta', 'Secondaria',
  'OrdineNonDichiarato', 'DichiarazioneSito', 'GiacenzaSito', 'PrimariaRete', 'TargetMensile', 'TargetRaccoglitore', 'CommessaEcotyre', 'PianificazioneSettimanale', 'UploadLog'];
const base = () => {
  const a = Object.fromEntries(VUOTI.map(v => [v, []]));
  a.ImpiantoTargetSecondaria = [
    { id: 'iTg', nome_impianto: 'TECNOGUM SRL', target: 2295000, anno: 2026, stato: 'attivo' },
    { id: 'iTc', nome_impianto: 'T-CYCLE INDUSTRIES SRL', target: 1050000, anno: 2026, stato: 'attivo' },
    { id: 'iGt', nome_impianto: 'GREEN TYRE PROJECT SRL', target: 2500000, anno: 2026, stato: 'attivo', segue_predittivita: false },
  ];
  a.FornitoreSecondaria = [
    { id: 'f1', nome: 'NAPPI SUD SRL', impianto_id: 'iTg', ruolo: 'stoccaggio', anno: 2026, stato: 'attivo' },
    { id: 'f3', nome: 'T-CYCLE INDUSTRIES SRL', impianto_id: 'iTg', ruolo: 'doppio_ruolo', plafond_stoccaggio_kg: 250000, anno: 2026, stato: 'attivo' },
  ];
  a.GiacenzaStoccaggio = [
    { id: 'g1', sito: 'NAPPI SUD SRL', data_rilevazione: '2025-12-31', class1_kg: 10000 },
    { id: 'g3', sito: 'T-CYCLE INDUSTRIES SRL', data_rilevazione: '2025-12-31', class1_kg: 0 },
  ];
  return a;
};

// Il target di ogni raccoglitore per sito, in tonnellate, nei due moduli.
async function confronta(titolo, archivi, oggi, attesi) {
  console.log(titolo);
  globalThis.__ARCHIVI_TARGET = archivi;
  const g = await calcolaGiacenze({ anno: 2026 });
  verifica('calcolaGiacenze risponde', Array.isArray(g.righe), JSON.stringify(g).slice(0, 300));
  const giacenze = new Map(); // 'sito|raccoglitore' -> t, sommando le due righe del sito
  for (const r of g.righe || []) {
    for (const q of r.target_primarie_ripartizione || []) {
      const k = `${norm(r.sito)}|${norm(q.raccoglitore)}`;
      giacenze.set(k, Math.round(((giacenze.get(k) || 0) + q.t) * 100) / 100);
    }
  }
  const dati = await leggiDatiPredittivita(sdkPredittivita(archivi), { anno: 2026, oggi });
  const predittivita = new Map();
  for (const r of dati.ingresso.raccoglitori.filter(x => x.diviso)) {
    const k = `${r.sito}|${norm(r.nome)}`;
    predittivita.set(k, Math.round(((predittivita.get(k) || 0) + r.target_kg / 1000) * 100) / 100);
  }
  const seguiti = new Set([...dati.ingresso.impianti.filter(i => i.target_kg > 0).map(i => i.chiave), ...dati.ingresso.stoccaggi.map(s => s.chiave)]);
  for (const [k, t] of giacenze) {
    const sito = k.split('|')[0];
    if (seguiti.has(sito)) verifica(`${k}: lo stesso target nei due moduli`, Math.abs((predittivita.get(k) || 0) - t) < 0.011, `Giacenze ${t} t, predittivita' ${predittivita.get(k) || 0} t`);
    else verifica(`${k}: un sito che la predittivita' non segue non ha target li'`, !predittivita.has(k), `predittivita' ${predittivita.get(k)} t`);
  }
  for (const k of predittivita.keys()) verifica(`${k}: la predittivita' non ha target che le Giacenze non hanno`, giacenze.has(k));
  for (const [k, t] of Object.entries(attesi)) {
    const seguito = seguiti.has(k.split('|')[0]);
    verifica(`${k}: ${t} t, come vuole la regola del 05/10/2026`, Math.abs((giacenze.get(k) || 0) - t) < 0.011 && (!seguito || Math.abs((predittivita.get(k) || 0) - t) < 0.011), `Giacenze ${giacenze.get(k)}, predittivita' ${predittivita.get(k)}`);
  }
}

// (a) C.L. Service, 200 t senza impianto: 30 t al piazzale di Nappi Sud a marzo,
// 10 t a T-Cycle e 5 t a Green Tyre (che la predittivita' non segue) ad aprile.
const a = base();
a.TargetRaccoglitore = [{ id: 't1', raccoglitore: 'C.L. SERVICE SRL', regione: 'Campania', target_tonnellate: 200, anno: 2026 }];
a.PrimariaRete = [
  prim('C.L. SERVICE SRL', 'NAPPI SUD SRL', 30000, '2026-03-10', { tipo_destinazione: 'stoc' }),
  prim('C.L. SERVICE SRL', 'T-CYCLE INDUSTRIES SRL', 10000, '2026-04-10'),
  prim('C.L. SERVICE SRL', 'GREEN TYRE PROJECT SRL', 5000, '2026-04-11'),
];
await confronta('UN SITO NON SEGUITO NELLO STORICO DEL RACCOGLITORE', a, '2026-10-09', {
  'nappi sud|cl service': 30, 't-cycle|cl service': 165, 'green tyre project|cl service': 5,
});

// (b) Mensili da 100 t: gennaio-giugno a Tecnogum, luglio-settembre a T-Cycle,
// ottobre-dicembre senza storico, quindi dove porta oggi.
const b = base();
b.TargetRaccoglitore = [{ id: 't2', raccoglitore: 'RACC X SRL', regione: 'Campania', target_tonnellate: 1200, anno: 2026 }];
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
b.TargetMensile = MESI.map((m, i) => ({ id: 'm' + i, raccoglitore: 'RACC X SRL', regione: 'Campania', mese: m, anno: 2026, target: 100 }));
for (let i = 1; i <= 9; i++) b.PrimariaRete.push(prim('RACC X SRL', i <= 6 ? 'TECNOGUM SRL' : 'T-CYCLE INDUSTRIES SRL', 100000, `2026-${String(i).padStart(2, '0')}-15`));
await confronta('UN RACCOGLITORE CHE CAMBIA SITO A META ANNO', b, '2026-10-09', {
  'tecnogum|racc x': 600, 't-cycle|racc x': 600,
});

// (c) Un target scritto abbreviato: «PNEUSERVICE SRL» e' di «PNEUSERVICE
// CONVERSANO SRL», che a portale porta a Tecnogum.
const c = base();
c.TargetRaccoglitore = [{ id: 't3', raccoglitore: 'PNEUSERVICE SRL', regione: 'Puglia', target_tonnellate: 300, anno: 2026 }];
c.PrimariaRete = [prim('PNEUSERVICE CONVERSANO SRL', 'TECNOGUM SRL', 50000, '2026-05-10', { provincia: 'BA' })];
await confronta('UN TARGET SCRITTO ABBREVIATO', c, '2026-10-09', { 'tecnogum|pneuservice': 300 });

// LE RIGHE SU CUI SI RIPARTISCE SONO UNA LISTA SOLA (revisione della chiusura
// dell'audit, 11/10/2026). calcolaGiacenze le costruiva con un suo ciclo, uguale
// a conferitiPerRipartizione di shared/targetImpianti.ts finche' nessuno ne
// cambiava uno. Ora le chiede li': se quella lista lasciasse fuori i piazzali,
// Nappi Sud perderebbe le sue 30 t anche nelle Giacenze. Con il ciclo suo, no.
console.log('LE RIGHE DELLA RIPARTIZIONE VENGONO DA UNA LISTA SOLA');
{
  // Si guasta solo la firma, che e' l'unica cosa che le Giacenze chiamano.
  const senzaPiazzali = (s) => s.replace('export function conferitiPerRipartizione(primarie, anno) {',
    "export function conferitiPerRipartizione(tutte, anno) {\n  const primarie = (tutte || []).filter(r => String(r.tipo_destinazione || '').toLowerCase().trim() !== 'stoc');");
  const guasta = await impacchetta(senzaPiazzali);
  globalThis.__ARCHIVI_TARGET = a;
  const nappi = (g) => (g.righe || []).filter(r => norm(r.sito) === 'nappi sud')
    .flatMap(r => r.target_primarie_ripartizione || []).filter(q => norm(q.raccoglitore) === 'cl service').reduce((s, q) => s + q.t, 0);
  const giusto = nappi(await calcolaGiacenze({ anno: 2026 }));
  const guasto = nappi(await guasta({ anno: 2026 }));
  verifica('con la lista vera Nappi Sud ha le sue 30 t di C.L. Service', Math.abs(giusto - 30) < 0.011, String(giusto));
  verifica('cambiata la lista nel modulo condiviso, cambiano anche le Giacenze', Math.abs(guasto - 30) > 1, String(guasto));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
