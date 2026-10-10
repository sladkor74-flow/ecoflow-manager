// Prova di GIACENZE E DICHIARAZIONI: GLI STESSI NUMERI, 10/10/2026.
//
// Regola dell'utente, 03/10/2026: «Giacenze e Dichiarazioni Impianti devono
// essere allineati e congruenti su tutti e tre i canali». Fino a oggi la regola
// era scritta nei commenti dei due moduli e controllata a occhio. L'audit del
// 10/10/2026 l'ha controllata sui dati veri - 53 confronti su 54 uguali al
// centesimo - e ha trovato quattro modi in cui poteva rompersi senza che
// nessuna prova se ne accorgesse:
//   1. un impianto che la rete non la dichiara (Tecnogum): 0 da una parte,
//      1.833,43 t dall'altra;
//   2. due campagne di extra raccolta nello stesso mese, una caricata e una no:
//      il campo dei chili caricati si perdeva fra un modulo e l'altro;
//   3. una dichiarazione di un anno vecchio caricata dopo la fotografia: un
//      modulo la leggeva, l'altro no;
//   4. una riga del portale di un altro partner operativo, che l'allineamento
//      leggeva senza il filtro SMOCO.
//
// Qui si fanno girare LE DUE FUNZIONI VERE (base44/functions/calcolaGiacenze e
// riepilogoDichiarazioni) sugli stessi archivi, con un SDK finto, e si
// confrontano canale per canale. E' la regola trasformata in un controllo: da
// oggi, un cambiamento che fa dire a uno dei due moduli un numero diverso
// dall'altro rompe questa prova.
// npm run prove
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// --- L'SDK finto: archivi in memoria ---
const ARCHIVI = {};
globalThis.__ARCHIVI = ARCHIVI;
const SDK_FINTO = `
const ordina = (righe, ord) => {
  const campo = String(ord || 'id').replace(/^[-+]/, '') || 'id';
  return [...righe].sort((a, b) => String(a[campo] ?? '').localeCompare(String(b[campo] ?? '')));
};
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => r[k] === v);
const entita = (nome) => ({
  list: async (ord = 'id', lim = 1e9, skip = 0) => ordina(globalThis.__ARCHIVI[nome] || [], ord).slice(skip, skip + lim),
  filter: async (f, ord = 'id', lim = 1e9, skip = 0) => ordina((globalThis.__ARCHIVI[nome] || []).filter(r => soddisfa(r, f)), ord).slice(skip, skip + lim),
  create: async (r) => r, update: async (id, r) => r, delete: async () => ({}),
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: 'admin', email: 'prova' }) }, asServiceRole: { entities }, entities };
}`;
const finti = {
  name: 'sdk-finto',
  setup(b) {
    b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
    b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
  },
};

/** Impacchetta una funzione vera. `guasta` riscrive un file prima di compilarlo: solo per le controprove. */
const funzione = async (nome, guasta = null) => {
  const plugins = [finti];
  if (guasta) {
    plugins.push({
      name: 'rimetti-il-difetto',
      setup(b) {
        b.onLoad({ filter: /\.ts$/ }, async (args) => {
          const sorgente = await readFile(args.path, 'utf8');
          const g = guasta(args.path, sorgente);
          return g === null ? null : { contents: g, loader: 'ts' };
        });
      },
    });
  }
  const pacchetto = await build({
    entryPoints: [qui(`../base44/functions/${nome}/entry.ts`)],
    bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent', plugins,
  });
  const modulo = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
  return async (corpo) => (await modulo.default({ json: async () => corpo })).json();
};

// --- Gli archivi: un impianto normale, Tecnogum, e le quattro trappole ---
let seq = 0;
const con = (nome, righe) => { ARCHIVI[nome] = righe.map(r => ({ id: 'r' + (++seq).toString().padStart(4, '0'), ...r })); };
const g = (giorno) => `${giorno}T08:00:00Z`;
const ALFA = 'ALFA RECYCLING SRL';
const TECNO = 'TECNOGUM SRL';

const primaria = (id, dest, kg, giorno, extra = {}) => ({
  id_ordine: id, numero_fir: 'FIR' + id, classe: 'P - fino a 35 kg', prodotto: '.class1', destinazione: dest,
  tipo_destinazione: 'imp', stato: 'terminato', peso_effettivo: kg, trasporto_finito_il: g(giorno), ordine_chiuso_il: g(giorno), ...extra,
});

for (const vuoto of ['DichiarazioneTrattamento', 'Secondaria', 'Terziaria', 'ImpiantoTargetSecondaria', 'TargetRaccoglitore',
  'TargetMensile', 'GiacenzaStoccaggio', 'IndicatoreGiorno']) con(vuoto, []);

con('GiacenzaSito', [
  { sito: ALFA, tipo_destinazione: 'imp', anno: 2026, dichiara_rete: true, giacenza_riferimento_t: 10 },
  { sito: TECNO, tipo_destinazione: 'imp', anno: 2026, dichiara_rete: false },
]);
con('PrimariaRete', [
  primaria('ET26000001', ALFA, 12000, '2026-03-10'),
  primaria('ET26000002', ALFA, 8000, '2026-09-20'),
  primaria('ET26000003', TECNO, 5000, '2026-04-15'),
]);
con('PrimariaAci', [
  { ...primaria('ET26000010', ALFA, 2000, '2026-04-05'), classe: 'PFU Autodemolizione', prodotto: '.class9' },
]);
// TRAPPOLA 2: due campagne di extra raccolta nello stesso mese.
con('ExtraRaccolta', [
  { ...primaria('PHX0001', ALFA, 300, '2026-05-10'), tipo_movimento: 'primaria' },
  { ...primaria('PHX0002', ALFA, 200, '2026-05-22'), tipo_movimento: 'primaria' },
]);
// La fotografia del portale: un file degli ordini non dichiarati del 1° ottobre.
con('OrdineNonDichiarato', [
  { ordine_primaria: 'ET26000002', destinazione: ALFA, prodotto: '.class1', peso_non_dichiarato_kg: 8000, created_date: '2026-10-01T06:00:00Z', fine_trasporto: '2026-09-20' },
]);
con('DichiarazioneSito', [
  { sito: ALFA, anno: 2026, mese: 'Marzo', canale: 'RETE', provenienza: '', operazione: 'R3', quantita_kg: 12000, caricata_inviata: true, caricata_il: '2026-04-10' },
  { sito: ALFA, anno: 2026, mese: 'Aprile', canale: 'ACI', provenienza: 'primaria', operazione: 'R3', quantita_kg: 2000, caricata_inviata: true, caricata_il: '2026-05-10' },
  // TRAPPOLA 2: le due campagne, una caricata e una no.
  { sito: ALFA, anno: 2026, mese: 'Maggio', canale: 'EXTRA_RACCOLTA', provenienza: '', operazione: 'R3', quantita_kg: 300, caricata_inviata: true, caricata_il: '2026-06-10' },
  { sito: ALFA, anno: 2026, mese: 'Maggio', canale: 'EXTRA_RACCOLTA', provenienza: '', operazione: 'R3', quantita_kg: 200, caricata_inviata: false },
  // TRAPPOLA 3: una dichiarazione del 2024 caricata dopo la fotografia del 2026.
  { sito: ALFA, anno: 2024, mese: 'Dicembre', canale: 'RETE', provenienza: '', operazione: 'R3', quantita_kg: 1000, caricata_inviata: true, caricata_il: '2026-10-05' },
]);

const ESEGUI = async (giacenze, riepilogo) => {
  const [gg, dd] = await Promise.all([giacenze({ anno: 2026 }), riepilogo({ anno: 2026 })]);
  return { g: gg, d: dd };
};
const rigaG = (r, sito) => (r.g.righe || []).find(x => x.sito === sito && x.tipo_destinazione === 'imp') || {};
const sitoD = (r, sito) => (r.d.siti || []).find(x => x.sito === sito) || {};
const canaleD = (r, sito, c) => (sitoD(r, sito).giacenze_canale || []).find(x => x.canale === c) || {};
const t2 = (v) => (v === null || v === undefined ? v : Math.round(Number(v) * 100) / 100);

const calcolaGiacenze = await funzione('calcolaGiacenze');
const riepilogoDichiarazioni = await funzione('riepilogoDichiarazioni');
const r = await ESEGUI(calcolaGiacenze, riepilogoDichiarazioni);
verifica('le Giacenze rispondono', !r.g.error, JSON.stringify(r.g.error));
verifica('le Dichiarazioni rispondono', !r.d.error, JSON.stringify(r.d.error));

console.log('UN IMPIANTO NORMALE: TRE CANALI, GLI STESSI NUMERI');
{
  const G = rigaG(r, ALFA);
  const rete = canaleD(r, ALFA, 'RETE'), aci = canaleD(r, ALFA, 'ACI'), extra = canaleD(r, ALFA, 'EXTRA_RACCOLTA');
  verifica('rete, entrato', t2((G.conferito_primarie_t || 0) + (G.secondarie_in_t || 0)) === t2(rete.entrato_t), `${G.conferito_primarie_t} / ${rete.entrato_t}`);
  verifica('ACI, entrato', t2((G.conferito_aci_t || 0) + (G.secondarie_aci_in_t || 0)) === t2(aci.entrato_t), `${G.conferito_aci_t} / ${aci.entrato_t}`);
  verifica('ACI, dichiarato', t2(G.dichiarato_aci_t) === t2(aci.dichiarato_caricato_t), `${G.dichiarato_aci_t} / ${aci.dichiarato_caricato_t}`);
  verifica('ACI, giacenza', t2(G.giacenza_aci_t) === t2(aci.giacenza_t), `${G.giacenza_aci_t} / ${aci.giacenza_t}`);
  verifica('extra, entrato', t2(G.conferito_extra_t) === t2(extra.entrato_t), `${G.conferito_extra_t} / ${extra.entrato_t}`);
}

console.log('TRAPPOLA 2: DUE CAMPAGNE DI EXTRA RACCOLTA, UNA SOLA CARICATA');
{
  const G = rigaG(r, ALFA);
  const extra = canaleD(r, ALFA, 'EXTRA_RACCOLTA');
  verifica('le Giacenze contano la sola caricata: 0,30 t', t2(G.dichiarato_extra_t) === 0.3, String(G.dichiarato_extra_t));
  verifica('e le Dichiarazioni anche', t2(extra.dichiarato_caricato_t) === 0.3, String(extra.dichiarato_caricato_t));
  verifica('quindi la giacenza extra e\' la stessa: 0,20 t', t2(G.giacenza_extra_t) === 0.2 && t2(extra.giacenza_t) === 0.2, `${G.giacenza_extra_t} / ${extra.giacenza_t}`);
}

console.log('TRAPPOLA 1: CHI LA RETE NON LA DICHIARA');
{
  const G = rigaG(r, TECNO);
  const rete = canaleD(r, TECNO, 'RETE');
  verifica('Giacenze: nessuna giacenza di rete, non zero', G.giacenza_rete_t === null && G.giacenza_portale_t === null, `${G.giacenza_rete_t} / ${G.giacenza_portale_t}`);
  verifica('e lo dice', G.rete_non_dovuta === true);
  verifica('Dichiarazioni: nessuna giacenza di rete, non 5 t', rete.giacenza_t === null && rete.non_dovuta === true, JSON.stringify(rete));
  verifica('con il perche\' scritto', /non ci dichiara la rete/.test(rete.perche || ''), rete.perche);
  verifica('ma quello che e\' arrivato si vede, in tutti e due', t2(G.conferito_primarie_t) === 5 && t2(rete.entrato_t) === 5, `${G.conferito_primarie_t} / ${rete.entrato_t}`);
  const f = (sitoD(r, TECNO).flussi || []).find(x => x.canale === 'RETE') || {};
  verifica('il flusso di rete e\' non dovuto, e niente resta da dichiarare', f.non_dovuta === true && t2(f.da_dichiarare_t) === 0, JSON.stringify([f.non_dovuta, f.da_dichiarare_t]));
  verifica('ogni mese non dovuto, non solo quelli segnati a mano', (f.mesi || []).every(m => m.non_dovuta === true));
}

console.log('TRAPPOLA 3: UNA DICHIARAZIONE DI DUE ANNI FA CARICATA DOPO LA FOTOGRAFIA');
{
  const G = rigaG(r, ALFA);
  const D = sitoD(r, ALFA);
  verifica('le Giacenze la scalano dalla fotografia: 1 t', G.fotografia && t2(G.fotografia.dichiarato_dopo_t) === 1, JSON.stringify(G.fotografia));
  verifica('e le Dichiarazioni anche, adesso', t2(D.dichiarato_dopo_foto_t) === 1, String(D.dichiarato_dopo_foto_t));
  verifica('quindi la giacenza a portale e\' la stessa', t2(G.giacenza_portale_t) === t2(D.giacenza_portale_t), `${G.giacenza_portale_t} / ${D.giacenza_portale_t}`);
}

console.log('LE CONTROPROVE: COM\'ERA PRIMA');
{
  // Trappola 3: il riepilogo leggeva solo l'anno e l'anno prima.
  const riepilogoVecchio = await funzione('riepilogoDichiarazioni', (path, s) => {
    if (!/riepilogoDichiarazioni/.test(path)) return null;
    return s.replace('fetchAll(svc.DichiarazioneSito),', 'fetchAll(svc.DichiarazioneSito, { anno: annoNum - 1 }),')
      .replace('dichiaratoDopoLaFotografia(dichiarazioniTutte,', 'dichiaratoDopoLaFotografia([...dichiarazioni, ...dichiarazioniTutte],');
  });
  const prima3 = await ESEGUI(calcolaGiacenze, riepilogoVecchio);
  verifica('prima la dichiarazione del 2024 entrava solo nelle Giacenze', t2(sitoD(prima3, ALFA).dichiarato_dopo_foto_t) === 0 && t2(rigaG(prima3, ALFA).fotografia.dichiarato_dopo_t) === 1,
    `${sitoD(prima3, ALFA).dichiarato_dopo_foto_t} / ${rigaG(prima3, ALFA).fotografia.dichiarato_dopo_t}`);

  // Trappola 2: il campo dei chili caricati non arrivava alla pagina.
  const riepilogoSenzaCampo = await funzione('riepilogoDichiarazioni', (path, s) => {
    if (!/riepilogoDichiarazioni/.test(path)) return null;
    return s.replace("...(typeof d.caricato_kg === 'number' ? { caricato_kg: d.caricato_kg } : {}),", '');
  });
  const prima2 = await ESEGUI(calcolaGiacenze, riepilogoSenzaCampo);
  verifica('prima le due campagne davano 0 caricato nelle Dichiarazioni e 0,30 nelle Giacenze',
    t2(canaleD(prima2, ALFA, 'EXTRA_RACCOLTA').dichiarato_caricato_t) === 0 && t2(rigaG(prima2, ALFA).dichiarato_extra_t) === 0.3,
    `${canaleD(prima2, ALFA, 'EXTRA_RACCOLTA').dichiarato_caricato_t} / ${rigaG(prima2, ALFA).dichiarato_extra_t}`);

  // Trappola 1: Tecnogum.
  const giacenzeVecchie = await funzione('calcolaGiacenze', (path, s) => {
    if (!/calcolaGiacenze/.test(path)) return null;
    return s.replace('if (nonDichiaraRete.has(ns)) { giacenza_portale_t = null; giacenza_rete_t = null; giacenza_classi_kg = null; }', '');
  });
  const prima1 = await ESEGUI(giacenzeVecchie, riepilogoDichiarazioni);
  verifica('prima Tecnogum aveva 0 di giacenza nelle Giacenze: «vuoto»', rigaG(prima1, TECNO).giacenza_portale_t === 0, String(rigaG(prima1, TECNO).giacenza_portale_t));
}

console.log('TRAPPOLA 4: UNA RIGA DEL PORTALE DI UN ALTRO PARTNER');
{
  // Il caso vero: 1.605 righe di Baucina Recycling Tyres hanno come destinazione
  // secondaria Irigom (2023-2025). Il portale le attribuisce al sito della
  // destinazione secondaria, quindi a Irigom. L'allineamento, che SCRIVE
  // «caricata» sulle nostre righe, le leggeva senza il filtro SMOCO: una loro
  // riga che pareggiava al chilo un nostro mese lo segnava caricato.
  const { caricamentiPortale, confrontaConIlPortale } = await import('../base44/shared/agganciaDichiarazioni.ts');
  const riga = (extra) => ({ prodotto: '.class1', data_dichiarazione: '2025-06-12', fine_trasporto: '2025-05-20', destinazione: 'Irigom S.r.l.', peso_associato_kg: 7300, ...extra });
  const portale = [
    riga({ partner_operativo: 'SMOCO S.r.l.', id_dichiarazione: 'D1' }),
    riga({ partner_operativo: 'Baucina Recycling Tyres Srl', destinazione: 'BAUCINA RECYCLING TYRES SRL', destinazione_secondaria: 'Irigom S.r.l.', data_dichiarazione: '2025-07-03', peso_associato_kg: 4100, id_dichiarazione: 'D2' }),
  ];
  const car = caricamentiPortale(portale, 2025, 'RETE');
  const sulSito = [...car.values()].flatMap(m => [...m.values()]);
  verifica('dei caricamenti del portale resta solo quello di SMOCO', sulSito.length === 1 && Math.round(sulSito[0].kg) === 7300, JSON.stringify(sulSito.map(c => [c.data, Math.round(c.kg)])));
  // Un nostro luglio di 4.100 kg: senza il filtro avrebbe pareggiato la riga di Baucina.
  const nostre = [
    { sito: 'Irigom S.r.l.', anno: 2025, mese: 'Maggio', canale: 'RETE', quantita_kg: 7300 },
    { sito: 'Irigom S.r.l.', anno: 2025, mese: 'Luglio', canale: 'RETE', quantita_kg: 4100 },
  ];
  const esito = confrontaConIlPortale(portale, 2025, nostre, ['RETE']);
  const agganciati = (esito.trovati || []).map(x => x.mese || (x.dichiarazione && x.dichiarazione.mese)).filter(Boolean);
  verifica('il nostro luglio NON si aggancia alla riga di un altro partner', !agganciati.includes('Luglio'), JSON.stringify(esito.trovati));
  verifica('e il maggio di SMOCO si', (esito.trovati || []).length >= 1, JSON.stringify(esito.trovati));
}

console.log(`\n${ok} verifiche passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
