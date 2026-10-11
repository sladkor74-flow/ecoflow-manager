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
//
// CHIUSURA DELL'AUDIT, 11/10/2026: altre sei trappole (dalla 6 alla 11, in
// fondo) e un confronto generale, sito per sito e canale per canale, su tutti
// gli archivi della prova. E l'anno della prova e' l'anno in corso: con il 2026
// scritto nei dati, dal 1° gennaio 2027 il riepilogo avrebbe trattato l'anno
// come chiuso - confronto con la lettura del 31/12, non con la fotografia - e la
// prova sarebbe caduta per una data, non per un difetto.
// npm run prove
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { oggiRoma } from '../base44/shared/giornoItaliano.ts';
import { normalizzaRagioneSociale } from '../base44/shared/normalizzaRagioneSociale.ts';
// I due testi del perche' si leggono dai file che li scrivono: e' lo stesso testo per i due moduli.
import * as giacenzaPortale from '../base44/shared/giacenzaPortale.ts';
import * as giacenzaStoccaggi from '../base44/shared/giacenzaStoccaggi.ts';

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
// L'anno della prova e' quello in corso; `d('03-10')` e' il 10 marzo di quell'anno.
const ANNO = Number(oggiRoma().slice(0, 4));
const d = (meseGiorno) => `${ANNO}-${meseGiorno}`;
const ALFA = 'ALFA RECYCLING SRL';
const TECNO = 'TECNOGUM SRL';

const primaria = (id, dest, kg, giorno, extra = {}) => ({
  id_ordine: id, numero_fir: 'FIR' + id, classe: 'P - fino a 35 kg', prodotto: '.class1', destinazione: dest,
  tipo_destinazione: 'imp', stato: 'terminato', peso_effettivo: kg, trasporto_finito_il: g(giorno), ordine_chiuso_il: g(giorno), ...extra,
});

for (const vuoto of ['DichiarazioneTrattamento', 'Terziaria', 'ImpiantoTargetSecondaria', 'TargetRaccoglitore',
  'TargetMensile', 'GiacenzaStoccaggio', 'IndicatoreGiorno']) con(vuoto, []);

// TRAPPOLA 5: un piazzale che manda all'impianto. La stessa tonnellata arriva
// prima al piazzale (primaria) e poi all'impianto (secondaria): nel totale va
// contata una volta sola.
const BETA = 'BETA STOCCAGGI SRL';
con('GiacenzaSito', [
  { sito: ALFA, tipo_destinazione: 'imp', anno: ANNO, dichiara_rete: true, giacenza_riferimento_t: 10 },
  { sito: TECNO, tipo_destinazione: 'imp', anno: ANNO, dichiara_rete: false },
  { sito: BETA, tipo_destinazione: 'stoc', anno: ANNO },
]);
con('PrimariaRete', [
  primaria('ET26000001', ALFA, 12000, d('03-10')),
  primaria('ET26000002', ALFA, 8000, d('09-20')),
  primaria('ET26000003', TECNO, 5000, d('04-15')),
  primaria('ET26000004', BETA, 6000, d('02-10'), { tipo_destinazione: 'stoc' }),
]);
con('Secondaria', [
  { id_ordine: 'SEC26000001', numero_fir: 'FIRS1', classe: 'P - fino a 35 kg', prodotto: '.class1', stoccaggio: BETA, destinazione: ALFA,
    tipo_destinazione: 'imp', stato: 'terminato', peso_effettivo: 6000, trasporto_finito_il: g(d('02-25')) },
]);
con('PrimariaAci', [
  { ...primaria('ET26000010', ALFA, 2000, d('04-05')), classe: 'PFU Autodemolizione', prodotto: '.class9' },
]);
// TRAPPOLA 2: due campagne di extra raccolta nello stesso mese.
con('ExtraRaccolta', [
  { ...primaria('PHX0001', ALFA, 300, d('05-10')), tipo_movimento: 'primaria' },
  { ...primaria('PHX0002', ALFA, 200, d('05-22')), tipo_movimento: 'primaria' },
]);
// La fotografia del portale: un file degli ordini non dichiarati del 1° ottobre.
con('OrdineNonDichiarato', [
  { ordine_primaria: 'ET26000002', destinazione: ALFA, prodotto: '.class1', peso_non_dichiarato_kg: 8000, created_date: `${d('10-01')}T06:00:00Z`, fine_trasporto: d('09-20') },
]);
con('DichiarazioneSito', [
  { sito: ALFA, anno: ANNO, mese: 'Marzo', canale: 'RETE', provenienza: '', operazione: 'R3', quantita_kg: 12000, caricata_inviata: true, caricata_il: d('04-10') },
  { sito: ALFA, anno: ANNO, mese: 'Aprile', canale: 'ACI', provenienza: 'primaria', operazione: 'R3', quantita_kg: 2000, caricata_inviata: true, caricata_il: d('05-10') },
  // TRAPPOLA 2: le due campagne, una caricata e una no.
  { sito: ALFA, anno: ANNO, mese: 'Maggio', canale: 'EXTRA_RACCOLTA', provenienza: '', operazione: 'R3', quantita_kg: 300, caricata_inviata: true, caricata_il: d('06-10') },
  { sito: ALFA, anno: ANNO, mese: 'Maggio', canale: 'EXTRA_RACCOLTA', provenienza: '', operazione: 'R3', quantita_kg: 200, caricata_inviata: false },
  // TRAPPOLA 3: una dichiarazione di due anni prima caricata dopo la fotografia.
  { sito: ALFA, anno: ANNO - 2, mese: 'Dicembre', canale: 'RETE', provenienza: '', operazione: 'R3', quantita_kg: 1000, caricata_inviata: true, caricata_il: d('10-05') },
]);

const ESEGUI = async (giacenze, riepilogo) => {
  const [gg, dd] = await Promise.all([giacenze({ anno: ANNO }), riepilogo({ anno: ANNO })]);
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
  // Il conferito e' raccolta, le secondarie a parte: l'entrato e' la somma dei due (11/10/2026).
  verifica('extra, entrato', t2((G.conferito_extra_t || 0) + (G.secondarie_extra_in_t || 0)) === t2(extra.entrato_t), `${G.conferito_extra_t} + ${G.secondarie_extra_in_t} / ${extra.entrato_t}`);
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

console.log('TRAPPOLA 5: IL CONFERITO DEL TOTALE CONTA OGNI CARICO UNA VOLTA');
{
  // Primarie: 12 + 8 + 5 + 6 = 31 t. La secondaria da BETA ad ALFA (6 t) sposta
  // PFU gia' contati: non e' raccolta in piu'.
  verifica('il totale delle Giacenze e\' la raccolta: 31 t, non 37', t2(r.g.totali.conferito_t) === 31, String(r.g.totali.conferito_t));
  verifica('ed e\' lo stesso numero del modulo Dichiarazioni, che porta lo stesso nome', t2(r.g.totali.conferito_t) === t2(r.d.totali.conferito_t), `${r.g.totali.conferito_t} / ${r.d.totali.conferito_t}`);
  verifica('mentre sulla riga dell\'impianto la secondaria c\'e\', e deve esserci', t2(rigaG(r, ALFA).conferito_t) === 26, String(rigaG(r, ALFA).conferito_t));
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

  // Trappola 5: il totale sommava le righe.
  const giacenzeTotaleVecchio = await funzione('calcolaGiacenze', (path, s) => {
    if (!/calcolaGiacenze/.test(path)) return null;
    return s.replace('    totali.conferito_t = totali.conferito_primarie_t;', '');
  });
  const prima5 = await ESEGUI(giacenzeTotaleVecchio, riepilogoDichiarazioni);
  verifica('prima il totale contava due volte la secondaria: 37 t contro 31', t2(prima5.g.totali.conferito_t) === 37 && t2(prima5.d.totali.conferito_t) === 31,
    `${prima5.g.totali.conferito_t} / ${prima5.d.totali.conferito_t}`);
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

// ---------------------------------------------------------------------------
// LE TRAPPOLE DELLA CHIUSURA DELL'AUDIT, 11/10/2026.
//
// Dove entra un movimento lo dice da quel giorno un file solo
// (shared/ingressoMovimento.ts), chiesto da tutti e due i moduli, e le
// dichiarazioni mensili si leggono con una funzione sola (leggiDichiarazioni).
// Queste sono le trappole che li separavano, o li facevano sbagliare insieme:
//   6. una secondaria arrivata al PIAZZALE di un sito che e' anche impianto: un
//      modulo la metteva sul piazzale, l'altro sull'impianto (C2);
//   7. una secondaria di extra raccolta arrivata a un piazzale puro: nelle
//      Dichiarazioni il piazzale diventava un impianto che deve dichiarare, nelle
//      Giacenze era nel conferito e non nella giacenza (C9);
//   8. il conferito extra raccolta che contava anche i trasferimenti: 3 t
//      raccolte e 4,5 nel riquadro, mentre la dashboard diceva 3 (R11);
//   9. due dichiarazioni ACI gemelle, tutte e due caricate: sommate in un modulo,
//      una sola nell'altro (C4);
//  10. una terziaria con le date da sistemare: un gruppo a parte nelle Giacenze,
//      rete nelle Dichiarazioni (C3, C11);
//  11. un piazzale senza nessuna rilevazione e un impianto senza il file del
//      portale: 0 in un modulo, un numero o «—» nell'altro (C15, C5b).
// E il confronto generale: ogni impianto e ogni piazzale, canale per canale.
// ---------------------------------------------------------------------------
const chiave = normalizzaRagioneSociale;
const { PERCHE_SENZA_FOTOGRAFIA } = giacenzaPortale;
const { PERCHE_PIAZZALE_SENZA_LETTURA } = giacenzaStoccaggi;
// Un perche' e' un testo vero: due campi che mancano tutti e due non sono lo stesso perche'.
const stessoPerche = (a, b) => typeof b === 'string' && b.length > 20 && a === b;
const vuoto = (v) => v === null || v === undefined;
const uguali = (a, b) => (vuoto(a) ? vuoto(b) : !vuoto(b) && t2(a) === t2(b));

/** I due moduli, sito per sito e canale per canale: gli stessi numeri, o nessun numero in tutti e due. */
const confrontaTutto = (r, etichetta) => {
  const impiantiD = new Map((r.d.siti || []).filter(s => s.tipo_destinazione !== 'stoc').map(s => [s.chiave, s]));
  const stoccaggiD = new Map((r.d.stoccaggi || []).map(s => [s.chiave, s]));
  let confronti = 0;
  for (const G of r.g.righe || []) {
    const k = chiave(G.sito);
    if (G.tipo_destinazione === 'imp') {
      const D = impiantiD.get(k);
      if (!D) continue;
      const c = (canale) => (D.giacenze_canale || []).find(x => x.canale === canale) || {};
      const voci = [
        ['rete, giacenza a portale', G.giacenza_portale_t, D.giacenza_portale_t],
        ['rete, entrato', (G.conferito_primarie_t || 0) + (G.secondarie_in_t || 0), c('RETE').entrato_t],
        ['ACI, entrato', (G.conferito_aci_t || 0) + (G.secondarie_aci_in_t || 0), c('ACI').entrato_t],
        ['ACI, dichiarato', G.dichiarato_aci_t, c('ACI').dichiarato_caricato_t],
        ['ACI, giacenza', G.giacenza_aci_t, c('ACI').giacenza_t],
        ['extra, entrato', (G.conferito_extra_t || 0) + (G.secondarie_extra_in_t || 0), c('EXTRA_RACCOLTA').entrato_t],
        ['extra, dichiarato', G.dichiarato_extra_t, c('EXTRA_RACCOLTA').dichiarato_caricato_t],
        ['extra, giacenza', G.giacenza_extra_t, c('EXTRA_RACCOLTA').giacenza_t],
      ];
      for (const [nome, a, b] of voci) { confronti++; verifica(`${etichetta}: ${G.sito}, ${nome}`, uguali(a, b), `${a} / ${b}`); }
    } else {
      const D = stoccaggiD.get(k);
      const c = (canale) => ((D && D.canali) || []).find(x => x.canale === canale) || null;
      for (const [nome, a, canale] of [['rete', G.giacenza_rete_t, 'RETE'], ['ACI', G.giacenza_aci_t, 'ACI'], ['extra', G.giacenza_extra_t, 'EXTRA_RACCOLTA']]) {
        const x = c(canale);
        // Un canale senza movimenti ne' giacenza il riepilogo non lo elenca: vale zero, o niente.
        const b = x ? x.in_piazzale_t : (vuoto(a) ? null : 0);
        confronti++;
        verifica(`${etichetta}: piazzale ${G.sito}, ${nome}`, uguali(a, b), `${a} / ${b}`);
      }
      // L'apertura di rete del piazzale: l'ancora portata al 31/12 se ha letture,
      // il campo scritto se non ne ha, la stessa nei due moduli (11/10/2026).
      if (c('RETE')) {
        confronti++;
        verifica(`${etichetta}: piazzale ${G.sito}, apertura di rete`, uguali(G.giacenza_riferimento_t, c('RETE').giacenza_iniziale_t), `${G.giacenza_riferimento_t} / ${c('RETE').giacenza_iniziale_t}`);
      }
    }
  }
  return confronti;
};

console.log('IL CONFRONTO GENERALE, SUGLI ARCHIVI DELLE TRAPPOLE 1-5');
{
  const n = confrontaTutto(r, 'trappole 1-5');
  verifica('il confronto generale ha confrontato qualcosa', n >= 16, String(n));
}

// Gli archivi delle trappole 6-11. Le date ci sono tutte - immissione, inizio e
// fine trasporto - tranne dove la trappola e' proprio la data che manca.
const IRI = 'IRIGOM SRL';
const NAP = 'NAPPI SUD SRL';
const GAMMA = 'GAMMA STOCCAGGI SRL';
const completa = (r) => ({ ordine_immesso_il: g(d('01-02')), trasporto_iniziato_il: r.trasporto_finito_il, ...r });
const secondaria = (id, da, a, td, kg, giorno, extra = {}) => completa({
  id_ordine: id, numero_fir: 'FIR' + id, classe: 'P - fino a 35 kg', prodotto: '.class1', stoccaggio: da, destinazione: a,
  tipo_destinazione: td, stato: 'terminato', peso_effettivo: kg, trasporto_finito_il: g(giorno), ...extra,
});
const ACI = { classe: 'PFU Autodemolizione', prodotto: '.class9' };
const archiviTrappole = ({ conFotografia = true } = {}) => {
  con('GiacenzaSito', [
    { sito: IRI, tipo_destinazione: 'imp', anno: ANNO, dichiara_rete: true },
    { sito: IRI, tipo_destinazione: 'stoc', anno: ANNO },
    { sito: NAP, tipo_destinazione: 'stoc', anno: ANNO },
    { sito: ALFA, tipo_destinazione: 'imp', anno: ANNO, dichiara_rete: true },
    { sito: BETA, tipo_destinazione: 'stoc', anno: ANNO },
    // TRAPPOLA 11: un piazzale con un'apertura scritta a mano e nessuna lettura.
    { sito: GAMMA, tipo_destinazione: 'stoc', anno: ANNO, giacenza_riferimento_t: 50 },
  ]);
  // Le ancore del 31/12 dell'anno prima: Irigom e BETA vuoti, Nappi con 20 t di rete e 5 di ACI.
  const ancora = (sito, rete, aci) => ({ sito, data_rilevazione: `${ANNO - 1}-12-31`, class1_kg: rete, class2_kg: 0, class3_kg: 0, class4_kg: 0, class9_kg: aci, created_date: `${d('01-02')}T08:00:00Z` });
  con('GiacenzaStoccaggio', [ancora(IRI, 0, 0), ancora(NAP, 20000, 5000), ancora(BETA, 0, 0)]);
  con('PrimariaRete', [
    completa(primaria('ET27000001', IRI, 10000, d('02-10'))),
    completa(primaria('ET27000002', NAP, 8000, d('02-12'), { tipo_destinazione: 'stoc' })),
    completa(primaria('ET27000003', GAMMA, 3000, d('02-14'), { tipo_destinazione: 'stoc' })),
  ]);
  con('Secondaria', [
    // TRAPPOLA 6: rete e ACI da Nappi al PIAZZALE di Irigom, che e' anche impianto.
    secondaria('SEC27000001', NAP, IRI, 'stoc', 5000, d('03-10')),
    secondaria('SEC27000002', NAP, IRI, 'stoc', 2000, d('03-12'), ACI),
    // E una di rete all'impianto, come sempre.
    secondaria('SEC27000003', NAP, IRI, 'imp', 4000, d('04-10')),
  ]);
  con('PrimariaAci', [{ ...completa(primaria('ET27000010', ALFA, 5000, d('04-05'))), ...ACI }]);
  con('ExtraRaccolta', [
    // TRAPPOLA 8: 3 t raccolte al piazzale di Nappi e 0,4 all'impianto: 3,4 t di raccolta.
    { ...completa(primaria('PHX7001', NAP, 3000, d('05-10'), { tipo_destinazione: 'stoc' })), tipo_movimento: 'primaria' },
    { ...completa(primaria('PHX7002', ALFA, 400, d('05-11'))), tipo_movimento: 'primaria' },
    // Poi 1 t da Nappi all'impianto ALFA, e (TRAPPOLA 7) 0,5 t al piazzale puro BETA.
    { ...secondaria('PHX7003', NAP, ALFA, 'imp', 1000, d('05-20')), tipo_movimento: 'secondaria' },
    { ...secondaria('PHX7004', NAP, BETA, 'stoc', 500, d('05-22')), tipo_movimento: 'secondaria' },
  ]);
  // TRAPPOLA 10: due terziarie partite da ALFA, una senza la data di inizio
  // trasporto e una senza nessuna data di trasporto.
  con('Terziaria', [
    { id_ordine: 'TER27000001', numero_fir: 'FT1', unita_locale_origine: ALFA, ragione_sociale: ALFA, destinazione: 'CEMENTERIA SPA',
      stato: 'terminato', peso_effettivo: 25000, ordine_immesso_il: g(d('03-01')), trasporto_iniziato_il: null, trasporto_finito_il: g(d('03-05')) },
    { id_ordine: 'TER27000002', numero_fir: 'FT2', unita_locale_origine: ALFA, ragione_sociale: ALFA, destinazione: 'CEMENTERIA SPA',
      stato: 'terminato', peso_effettivo: 24000, ordine_immesso_il: g(d('03-02')), trasporto_iniziato_il: null, trasporto_finito_il: null },
  ]);
  // La fotografia del 1° ottobre: 8 t dell'ET27000001 ancora da dichiarare.
  con('OrdineNonDichiarato', conFotografia ? [
    { ordine_primaria: 'ET27000001', destinazione: IRI, prodotto: '.class1', peso_non_dichiarato_kg: 8000, created_date: `${d('10-01')}T06:00:00Z`, fine_trasporto: d('02-10') },
  ] : []);
  con('DichiarazioneSito', [
    // TRAPPOLA 9: due ACI di aprile da 2 t, tutte e due caricate, col nome scritto in due modi.
    { sito: ALFA, anno: ANNO, mese: 'Aprile', canale: 'ACI', provenienza: 'primaria', operazione: 'R3', quantita_kg: 2000, caricata_inviata: true, caricata_il: d('05-10') },
    { sito: 'Alfa Recycling S.r.l.', anno: ANNO, mese: 'Aprile', canale: 'ACI', provenienza: 'primaria', operazione: 'R3', quantita_kg: 2000, caricata_inviata: true, caricata_il: d('05-11') },
  ]);
};
archiviTrappole();
const t6 = await ESEGUI(calcolaGiacenze, riepilogoDichiarazioni);
verifica('trappole 6-11: le Giacenze rispondono', !t6.g.error, JSON.stringify(t6.g.error));
verifica('trappole 6-11: le Dichiarazioni rispondono', !t6.d.error, JSON.stringify(t6.d.error));
const rigaR = (r, sito, td) => (r.g.righe || []).find(x => x.sito === sito && x.tipo_destinazione === td) || {};
const stocD = (r, sito, c) => (((r.d.stoccaggi || []).find(x => x.sito === sito) || {}).canali || []).find(x => x.canale === c) || {};

console.log('TRAPPOLA 6: UNA SECONDARIA AL PIAZZALE DI UN SITO CHE E\' ANCHE IMPIANTO');
{
  const Gi = rigaR(t6, IRI, 'imp'), Gs = rigaR(t6, IRI, 'stoc'), Di = sitoD(t6, IRI);
  verifica('Giacenze: l\'impianto riceve solo la secondaria arrivata all\'impianto, 4 t, e niente ACI', t2(Gi.secondarie_in_t) === 4 && t2(Gi.secondarie_aci_in_t) === 0, `${Gi.secondarie_in_t} / ${Gi.secondarie_aci_in_t}`);
  verifica('Dichiarazioni: lo stesso, non 9 t e 2 di ACI', t2(Di.secondarie_in_t) === 4 && t2(Di.secondarie_aci_in_t) === 0, `${Di.secondarie_in_t} / ${Di.secondarie_aci_in_t}`);
  verifica('quindi l\'entrato della quadratura e\' 14 t, non 19', t2(Di.entrato_confronto_t) === 14, String(Di.entrato_confronto_t));
  verifica('e la giacenza ACI dell\'impianto e\' 0 in tutti e due', t2(Gi.giacenza_aci_t) === 0 && t2(canaleD(t6, IRI, 'ACI').giacenza_t || 0) === 0, `${Gi.giacenza_aci_t} / ${canaleD(t6, IRI, 'ACI').giacenza_t}`);
  verifica('il piazzale di Irigom: 5 t di rete e 2 di ACI nelle Giacenze', t2(Gs.giacenza_rete_t) === 5 && t2(Gs.giacenza_aci_t) === 2, `${Gs.giacenza_rete_t} / ${Gs.giacenza_aci_t}`);
  verifica('e nelle Dichiarazioni, dove prima il piazzale non esisteva', t2(stocD(t6, IRI, 'RETE').in_piazzale_t) === 5 && t2(stocD(t6, IRI, 'ACI').in_piazzale_t) === 2,
    `${stocD(t6, IRI, 'RETE').in_piazzale_t} / ${stocD(t6, IRI, 'ACI').in_piazzale_t}`);
  // La giacenza a portale dell'impianto: la fotografia (8 t) piu' i carichi che il
  // file non ha. La secondaria all'impianto (4 t) si', quella al piazzale no.
  verifica('la giacenza a portale dell\'impianto non conta la secondaria finita al piazzale: 12 t, non 17', t2(Gi.giacenza_portale_t) === 12 && t2(Di.giacenza_portale_t) === 12, `${Gi.giacenza_portale_t} / ${Di.giacenza_portale_t}`);
  verifica('il piazzale che spedisce torna in tutti e due: 19 t di rete, 3 di ACI',
    t2(rigaR(t6, NAP, 'stoc').giacenza_rete_t) === 19 && t2(stocD(t6, NAP, 'RETE').in_piazzale_t) === 19 && t2(rigaR(t6, NAP, 'stoc').giacenza_aci_t) === 3 && t2(stocD(t6, NAP, 'ACI').in_piazzale_t) === 3,
    `${rigaR(t6, NAP, 'stoc').giacenza_rete_t} ${stocD(t6, NAP, 'RETE').in_piazzale_t} ${rigaR(t6, NAP, 'stoc').giacenza_aci_t} ${stocD(t6, NAP, 'ACI').in_piazzale_t}`);
}

console.log('TRAPPOLA 7: UNA SECONDARIA DI EXTRA RACCOLTA A UN PIAZZALE PURO');
{
  const Gb = rigaR(t6, BETA, 'stoc');
  verifica('nelle Dichiarazioni BETA non e\' un impianto che deve dichiarare', !(t6.d.siti || []).some(s => s.sito === BETA && s.tipo_destinazione !== 'stoc'));
  verifica('e il suo piazzale ha 0,5 t di extra raccolta', t2(stocD(t6, BETA, 'EXTRA_RACCOLTA').in_piazzale_t) === 0.5, JSON.stringify(stocD(t6, BETA, 'EXTRA_RACCOLTA').in_piazzale_t));
  verifica('nelle Giacenze le 0,5 t sono nella giacenza extra del piazzale, non nel suo conferito', t2(Gb.giacenza_extra_t) === 0.5 && t2(Gb.conferito_extra_t) === 0 && t2(Gb.secondarie_extra_in_t) === 0.5,
    `${Gb.giacenza_extra_t} / ${Gb.conferito_extra_t} / ${Gb.secondarie_extra_in_t}`);
  verifica('il piazzale che spedisce: 3 - 1 - 0,5 = 1,5 t in tutti e due', t2(rigaR(t6, NAP, 'stoc').giacenza_extra_t) === 1.5 && t2(stocD(t6, NAP, 'EXTRA_RACCOLTA').in_piazzale_t) === 1.5,
    `${rigaR(t6, NAP, 'stoc').giacenza_extra_t} / ${stocD(t6, NAP, 'EXTRA_RACCOLTA').in_piazzale_t}`);
}

console.log('TRAPPOLA 8: IL CONFERITO EXTRA E\' LA RACCOLTA, NON I TRASFERIMENTI');
{
  const Ga = rigaR(t6, ALFA, 'imp');
  verifica('il totale delle Giacenze e\' la raccolta extra: 3,4 t, non 4,9', t2(t6.g.totali.conferito_extra_t) === 3.4, String(t6.g.totali.conferito_extra_t));
  const dashboard = await funzione('getDashboardRaccolta');
  const dash = await dashboard({ anno: ANNO });
  verifica('lo stesso numero della dashboard', !dash.error && t2(dash.kpi && dash.kpi.raccolto_extra_anno) === t2(t6.g.totali.conferito_extra_t),
    `${dash.kpi && dash.kpi.raccolto_extra_anno} / ${t6.g.totali.conferito_extra_t}`);
  verifica('l\'impianto: 0,4 t raccolte e 1 t arrivata dal piazzale, a parte', t2(Ga.conferito_extra_t) === 0.4 && t2(Ga.secondarie_extra_in_t) === 1, `${Ga.conferito_extra_t} / ${Ga.secondarie_extra_in_t}`);
  verifica('la sua giacenza extra non cambia: 1,4 t, come nelle Dichiarazioni', t2(Ga.giacenza_extra_t) === 1.4 && t2(canaleD(t6, ALFA, 'EXTRA_RACCOLTA').giacenza_t) === 1.4,
    `${Ga.giacenza_extra_t} / ${canaleD(t6, ALFA, 'EXTRA_RACCOLTA').giacenza_t}`);
}

console.log('TRAPPOLA 9: DUE DICHIARAZIONI ACI GEMELLE, TUTTE E DUE CARICATE');
{
  const Ga = rigaR(t6, ALFA, 'imp'), aci = canaleD(t6, ALFA, 'ACI');
  verifica('le Giacenze leggono una dichiarazione sola: 2 t, non 4', t2(Ga.dichiarato_aci_t) === 2, String(Ga.dichiarato_aci_t));
  verifica('come le Dichiarazioni', t2(aci.dichiarato_caricato_t) === 2, String(aci.dichiarato_caricato_t));
  verifica('quindi la giacenza ACI e\' 3 t in tutti e due, non 1 da una parte', t2(Ga.giacenza_aci_t) === 3 && t2(aci.giacenza_t) === 3, `${Ga.giacenza_aci_t} / ${aci.giacenza_t}`);
  verifica('e la gemella non si nasconde: e\' fra i doppioni', (t6.d.doppioni || []).length === 1 && t6.d.doppioni[0].mese === 'Aprile' && t6.d.doppioni[0].canale === 'ACI', JSON.stringify(t6.d.doppioni));
}

console.log('TRAPPOLA 10: UNA TERZIARIA CON LE DATE DA SISTEMARE');
{
  const dg = t6.g.totali.date_da_sistemare || {}, dd = t6.d.totali.date_da_sistemare || {};
  const n = (x, c) => (x[c] ? x[c].n : 0);
  verifica('le Giacenze: nessun formulario di rete, due terziarie a parte', n(dg, 'RETE') === 0 && n(dg, 'TERZIARIE') === 2, JSON.stringify(dg));
  verifica('le Dichiarazioni lo stesso, non due partenze di rete', n(dd, 'RETE') === 0 && n(dd, 'TERZIARIE') === 2, JSON.stringify(dd));
  verifica('quella senza fine trasporto e\' una partenza senza fine, nel gruppo delle terziarie, in tutti e due',
    dg.TERZIARIE && dg.TERZIARIE.partenze_senza_fine === 1 && dg.TERZIARIE.partenze_senza_fine_kg === 24000 && dd.TERZIARIE && dd.TERZIARIE.partenze_senza_fine === 1 && dd.TERZIARIE.partenze_senza_fine_kg === 24000,
    JSON.stringify([dg.TERZIARIE, dd.TERZIARIE]));
  const gruppi = (sitoD(t6, ALFA).date_da_sistemare || []).map(x => x.canale);
  verifica('e sull\'impianto il gruppo e\' quello delle terziarie', gruppi.length === 1 && gruppi[0] === 'TERZIARIE', JSON.stringify(gruppi));
  verifica('le terziarie in uscita dell\'anno sono quelle con la fine trasporto: 25 t in tutti e due', t2(rigaR(t6, ALFA, 'imp').terziarie_t) === 25 && t2(sitoD(t6, ALFA).terziarie_out_t) === 25,
    `${rigaR(t6, ALFA, 'imp').terziarie_t} / ${sitoD(t6, ALFA).terziarie_out_t}`);
}

console.log('TRAPPOLA 11: SENZA LETTURA O SENZA FILE, NESSUN NUMERO');
{
  const Gg = rigaR(t6, GAMMA, 'stoc'), rete = stocD(t6, GAMMA, 'RETE');
  verifica('Giacenze: il piazzale senza rilevazione non ha una giacenza, non 0', Gg.giacenza_portale_t === null && Gg.giacenza_rete_t === null, `${Gg.giacenza_portale_t} / ${Gg.giacenza_rete_t}`);
  verifica('e dice perche\'', stessoPerche(Gg.perche_senza_giacenza, PERCHE_PIAZZALE_SENZA_LETTURA), String(Gg.perche_senza_giacenza));
  verifica('Dichiarazioni: nemmeno qui, non 53 t', rete.in_piazzale_t === null && stessoPerche(rete.in_piazzale_perche, PERCHE_PIAZZALE_SENZA_LETTURA), JSON.stringify([rete.in_piazzale_t, rete.in_piazzale_perche]));
  verifica('ma entrate e apertura scritta si vedono', t2(rete.entrato_t) === 3 && t2(rete.giacenza_iniziale_t) === 50, `${rete.entrato_t} / ${rete.giacenza_iniziale_t}`);
  verifica('l\'anomalia resta', (t6.g.anomalie || []).some(a => a.tipo === 'stoccaggio_senza_rilevazione' && a.sito === GAMMA));
  verifica('un impianto con la fotografia non ha un perche\'', rigaR(t6, IRI, 'imp').perche_senza_giacenza === null);
}
{
  archiviTrappole({ conFotografia: false });
  const s = await ESEGUI(calcolaGiacenze, riepilogoDichiarazioni);
  const Gi = rigaR(s, IRI, 'imp');
  verifica('senza il file del portale l\'impianto non ha una giacenza di rete: «—», non 0', Gi.giacenza_portale_t === null && Gi.giacenza_rete_t === null, `${Gi.giacenza_portale_t} / ${Gi.giacenza_rete_t}`);
  verifica('col perche\', lo stesso testo per i due moduli', stessoPerche(Gi.perche_senza_giacenza, PERCHE_SENZA_FOTOGRAFIA), String(Gi.perche_senza_giacenza));
  verifica('e le Dichiarazioni dicono «—» anche loro', sitoD(s, IRI).giacenza_portale_t === null, String(sitoD(s, IRI).giacenza_portale_t));
  confrontaTutto(s, 'senza fotografia');
}

console.log('LE PAGINE: DOVE IL NUMERO NON C\'E\', «—» COL PERCHE\'');
{
  // Un null che la pagina stampa come 0 e' lo stesso errore di prima, spostato
  // di un passo (la lezione di Tecnogum). Le pagine si leggono senza i ritorni a
  // capo di Windows: i file dell'albero di lavoro possono essere CRLF.
  const pagina = (p) => readFileSync(qui(p), 'utf8').replace(/\r/g, '');
  const situazione = pagina('../src/components/giacenze/SituazioneTable.jsx');
  verifica('Giacenze: la cella della rete usa il perche\' che manda il calcolo', /r\.perche_senza_giacenza/.test(situazione));
  const stoccaggi = pagina('../src/components/dichiarazioni/Stoccaggi.jsx');
  verifica('Dichiarazioni: il piazzale senza lettura mostra «—» col perche\', non 0', /c\.in_piazzale_t === null/.test(stoccaggi) && /c\.in_piazzale_perche/.test(stoccaggi));
  const esporta = pagina('../src/lib/giacenzeExportAll.js');
  verifica('l\'export delle Giacenze chiama le terziarie col loro nome, a parte', /TERZIARIE: 'terziarie, a parte'/.test(esporta));
}

console.log('IL CONFRONTO GENERALE, SUGLI ARCHIVI DELLE TRAPPOLE 6-11');
{
  const n = confrontaTutto(t6, 'trappole 6-11');
  verifica('il confronto generale ha confrontato qualcosa', n >= 20, String(n));
}

// LA COLONNA «DA DICHIARARE» E' LA GIACENZA DEL CANALE, SU TUTTI E TRE
// (revisione della chiusura dell'audit, 11/10/2026). La somma di una riga del
// riepilogo - la casella dall'anno prima piu' i dodici mesi, per ogni flusso
// del canale - e' il numero che la quadratura confronta col portale e che le
// Giacenze mostrano. Era scritto nei commenti e controllato solo dalla prova del
// 2 gennaio: prima dell'audit ALFA diceva 14 t di riga contro 24 di giacenza
// sulla rete, e 0,5 contro 0,2 sull'extra raccolta. Qui su tutti e due gli
// archivi, ogni impianto e ogni canale che una giacenza ce l'ha.
console.log("LA COLONNA «DA DICHIARARE» E' LA GIACENZA DEL CANALE, SU TUTTI E TRE");
for (const [nome, x] of [['trappole 1-5', r], ['trappole 6-11', t6]]) {
  let n = 0;
  for (const s of (x.d.siti || []).filter(y => y.tipo_destinazione !== 'stoc')) {
    for (const c of s.giacenze_canale || []) {
      if (c.giacenza_t === null || c.giacenza_t === undefined) continue;
      const somma = (s.flussi || []).filter(f => f.canale === c.canale).reduce((t, f) => t + f.resta_t, 0);
      verifica(`${nome} · ${s.sito} · ${c.canale}: la somma della riga «Da dichiarare» e' la giacenza del canale`, t2(somma) === t2(c.giacenza_t), `${somma} / ${c.giacenza_t}`);
      n++;
    }
  }
  verifica(`${nome}: la verifica ha confrontato qualcosa`, n >= 3, String(n));
}

console.log(`\n${ok} verifiche passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
