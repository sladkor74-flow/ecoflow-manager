// Prova del DICHIARATO DI CHI TRATTA, 10/10/2026.
//
// Trovata dal guardiano notturno, la prima notte che ha scritto i numeri: la
// fotografia del giorno diceva «ACI dichiarato 154,22 t» e la Situazione delle
// giacenze diceva 275,08. Lo stesso per l'extra raccolta: 0,86 contro 1,72,
// esattamente il doppio.
//
// La causa: la mappa del dichiarato dei canali ACI ed extra raccolta e' per
// SOGGETTO E CANALE e non conosce il ruolo, perche' una dichiarazione e' del
// soggetto. Ma chi e' insieme impianto e piazzale - Gatim, Green Tyre, Irigom -
// ha DUE righe nelle giacenze, e la leggevano entrambe: il numero compariva
// anche sulla riga del piazzale, che non dichiara niente, e nel totale quelle
// tonnellate si contavano due volte.
//
// Perche' non si vedeva: la GIACENZA era giusta, perche' quel calcolo era gia'
// protetto dal ruolo (if td === 'imp'). Sbagliava solo il numero scritto
// accanto, e un numero sbagliato accanto a uno giusto e' il piu' difficile da
// vedere: il conto a occhio - apertura + entrato - dichiarato - non tornava, e
// chi guardava dava la colpa al conto.
//
// Qui si fa girare la funzione vera (base44/functions/calcolaGiacenze) con un
// SDK finto, e alla fine si rifa' girare la stessa cosa con la protezione del
// ruolo TOLTA, per vedere il doppio ricomparire: una prova che passa anche
// senza la correzione non prova niente.
// npm run prove
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// --- Gli archivi in memoria, letti dall'SDK finto ---
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

/**
 * Impacchetta la funzione vera. Con `guasta` si riscrive il sorgente prima di
 * compilarlo: serve solo alla controprova, per rimettere il difetto.
 */
const funzione = async (guasta) => {
  const plugins = [finti];
  if (guasta) {
    plugins.push({
      name: 'rimetti-il-difetto',
      setup(b) {
        b.onLoad({ filter: /entry\.ts$/ }, async (args) => {
          if (!/calcolaGiacenze/.test(args.path)) return null;
          const sorgente = await readFile(args.path, 'utf8');
          const guastato = guasta(sorgente);
          if (guastato === sorgente) throw new Error('la controprova non ha trovato niente da guastare');
          return { contents: guastato, loader: 'ts' };
        });
      },
    });
  }
  const pacchetto = await build({
    entryPoints: [qui('../base44/functions/calcolaGiacenze/entry.ts')],
    bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent', plugins,
  });
  const modulo = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
  return async (corpo) => (await modulo.default({ json: async () => corpo })).json();
};

// --- IL CASO VERO, quello del 10/10/2026 ---
//
// GATIM e' impianto e piazzale, e nei due archivi porta due nomi diversi: e'
// cosi' nei dati veri, ed e' una parte del caso, perche' i due nomi finiscono
// sulla stessa chiave e quindi sulla stessa dichiarazione.
// T.R.S. invece e' solo impianto: deve restare come prima.
let seq = 0;
const con = (nome, righe) => { ARCHIVI[nome] = righe.map(r => ({ id: 'r' + (++seq).toString().padStart(4, '0'), ...r })); };
const g = (giorno) => `${giorno}T08:00:00Z`;

const IMPIANTO = 'Gatim';
const PIAZZALE = 'GATIM S.R.L.';
const SOLO_IMPIANTO = 'T.R.S.  SRL';

const ACI_DICHIARATO_T = 115.54;
const EXTRA_DICHIARATO_T = 0.4;
const ACI_ALTRO_T = 13.64;

for (const vuoto of ['DichiarazioneTrattamento', 'OrdineNonDichiarato', 'Terziaria', 'Secondaria',
  'ImpiantoTargetSecondaria', 'TargetRaccoglitore', 'TargetMensile', 'GiacenzaStoccaggio', 'PrimariaRete']) con(vuoto, []);

con('GiacenzaSito', [
  { sito: IMPIANTO, tipo_destinazione: 'imp', anno: 2026 },
  { sito: PIAZZALE, tipo_destinazione: 'stoc', anno: 2026 },
  { sito: SOLO_IMPIANTO, tipo_destinazione: 'imp', anno: 2026 },
]);

// Quello che e' arrivato: tanto quanto si e' dichiarato, cosi' la giacenza
// chiude a zero e un eventuale doppio conteggio si vedrebbe anche li'.
con('PrimariaAci', [
  {
    id_ordine: 'ET26ACI001', numero_fir: 'FIRACI1', numero_ordine_interno: '164000-11',
    classe: 'PFU Autodemolizione', prodotto: '.class9', destinazione: IMPIANTO, tipo_destinazione: 'imp',
    stato: 'terminato', peso_effettivo: ACI_DICHIARATO_T * 1000, trasporto_finito_il: g('2026-04-10'),
  },
  {
    id_ordine: 'ET26ACI002', numero_fir: 'FIRACI2', numero_ordine_interno: '164000-12',
    classe: 'PFU Autodemolizione', prodotto: '.class9', destinazione: SOLO_IMPIANTO, tipo_destinazione: 'imp',
    stato: 'terminato', peso_effettivo: ACI_ALTRO_T * 1000, trasporto_finito_il: g('2026-07-15'),
  },
]);
con('ExtraRaccolta', [
  {
    id_ordine: 'ET26EXT001', numero_fir: 'FIREXT1', numero_ordine_interno: '166000-01',
    classe: 'P - fino a 35 kg', prodotto: '.class1', destinazione: IMPIANTO, tipo_destinazione: 'imp',
    stato: 'terminato', peso_effettivo: EXTRA_DICHIARATO_T * 1000, trasporto_finito_il: g('2026-04-20'),
  },
]);

// Le dichiarazioni mensili trascritte dall'amministratore. Il soggetto e'
// l'impianto: una dichiarazione di trattamento la fa chi tratta.
con('DichiarazioneSito', [
  { sito: IMPIANTO, anno: 2026, mese: 'Aprile', canale: 'ACI', provenienza: 'primaria', quantita_kg: ACI_DICHIARATO_T * 1000, caricata_inviata: true },
  { sito: IMPIANTO, anno: 2026, mese: 'Aprile', canale: 'EXTRA_RACCOLTA', quantita_kg: EXTRA_DICHIARATO_T * 1000, caricata_inviata: true },
  { sito: SOLO_IMPIANTO, anno: 2026, mese: 'Luglio', canale: 'ACI', provenienza: 'secondaria', quantita_kg: ACI_ALTRO_T * 1000, caricata_inviata: true },
  // Non caricata a portale: non decurta niente e non si conta.
  { sito: IMPIANTO, anno: 2026, mese: 'Maggio', canale: 'ACI', provenienza: 'primaria', quantita_kg: 9999000, caricata_inviata: false },
  // Di un altro anno: fuori.
  { sito: IMPIANTO, anno: 2025, mese: 'Dicembre', canale: 'ACI', provenienza: 'primaria', quantita_kg: 7777000, caricata_inviata: true },
]);

const calcolaGiacenze = await funzione();
const esito = await calcolaGiacenze({ anno: 2026 });
verifica('la funzione risponde', !esito.error, JSON.stringify(esito.error));
const righe = esito.righe || [];
const rigaDi = (ns, ruolo) => righe.find(r => String(r.sito).toUpperCase().startsWith(ns) && r.tipo_destinazione === ruolo);
const imp = rigaDi('GATIM', 'imp');
const stoc = rigaDi('GATIM', 'stoc');
const trs = rigaDi('T.R.S', 'imp');
verifica('le due righe di Gatim ci sono, impianto e piazzale', !!imp && !!stoc,
  JSON.stringify(righe.map(r => r.sito + '|' + r.tipo_destinazione)));
verifica('e la riga di chi e\' solo impianto', !!trs);

console.log('IL DICHIARATO STA SULLA RIGA DI CHI TRATTA');
verifica('l\'impianto porta l\'ACI dichiarato: 115,54 t', !!imp && imp.dichiarato_aci_t === ACI_DICHIARATO_T, String(imp && imp.dichiarato_aci_t));
verifica('e l\'extra raccolta dichiarata: 0,40 t', !!imp && imp.dichiarato_extra_t === EXTRA_DICHIARATO_T, String(imp && imp.dichiarato_extra_t));
verifica('chi e\' solo impianto non cambia: 13,64 t', !!trs && trs.dichiarato_aci_t === ACI_ALTRO_T, String(trs && trs.dichiarato_aci_t));

console.log('UN PIAZZALE NON DICHIARA, E LA CELLA NON DICE ZERO');
// Zero si leggerebbe «non ha ancora dichiarato», che e' un'attesa. null fa
// scrivere il trattino, e il trattino ha la sua spiegazione.
verifica('sul piazzale l\'ACI dichiarato non e\' un numero', !!stoc && stoc.dichiarato_aci_t === null, JSON.stringify(stoc && stoc.dichiarato_aci_t));
verifica('e nemmeno l\'extra raccolta', !!stoc && stoc.dichiarato_extra_t === null, JSON.stringify(stoc && stoc.dichiarato_extra_t));
verifica('non e\' zero: zero sarebbe un\'altra cosa', !!stoc && stoc.dichiarato_aci_t !== 0 && stoc.dichiarato_extra_t !== 0);

console.log('IL TOTALE CONTA UNA VOLTA SOLA');
verifica('ACI: 115,54 + 13,64 = 129,18 t, non 244,72',
  esito.totali.dichiarato_aci_t === 129.18, String(esito.totali.dichiarato_aci_t));
verifica('extra raccolta: 0,40 t, non 0,80',
  esito.totali.dichiarato_extra_t === EXTRA_DICHIARATO_T, String(esito.totali.dichiarato_extra_t));
verifica('ed e\' esattamente la somma delle righe dell\'archivio, come nel modulo Dichiarazioni',
  esito.totali.dichiarato_aci_t === ACI_DICHIARATO_T + ACI_ALTRO_T
  && esito.totali.dichiarato_extra_t === EXTRA_DICHIARATO_T);

console.log('LE DICHIARAZIONI CHE NON CONTANO, NON CONTANO');
verifica('una dichiarazione non caricata a portale resta fuori (9.999 t non ci sono)',
  esito.totali.dichiarato_aci_t < 1000, String(esito.totali.dichiarato_aci_t));
verifica('e una dell\'anno prima non entra nell\'anno scelto',
  !!imp && imp.dichiarato_aci_t === ACI_DICHIARATO_T);

console.log('LA GIACENZA RESTA QUELLA GIUSTA');
// Era giusta anche prima: e' il motivo per cui il difetto non si vedeva, e
// quindi va provato che la correzione non l'ha toccata.
verifica('l\'ACI dell\'impianto chiude a zero: entrato quanto dichiarato', !!imp && imp.giacenza_aci_t === 0, String(imp && imp.giacenza_aci_t));
verifica('e l\'extra raccolta anche', !!imp && imp.giacenza_extra_t === 0, String(imp && imp.giacenza_extra_t));
verifica('il piazzale non ha una giacenza di extra raccolta da mostrare', !!stoc && (stoc.giacenza_extra_t === null || stoc.giacenza_extra_t === undefined), String(stoc && stoc.giacenza_extra_t));
verifica('i canali non si sommano: l\'ACI non e\' finito nella rete',
  !!imp && !imp.giacenza_rete_t, String(imp && imp.giacenza_rete_t));

console.log('LA CONTROPROVA: SENZA LA PROTEZIONE DEL RUOLO IL DOPPIO TORNA');
const senzaRuolo = await funzione((s) => s
  .split("dichiarato_aci_t: td === 'imp' ? r2(dichiaratoCanaleMap.get(ns + '|ACI') || 0) : null,")
  .join("dichiarato_aci_t: r2(dichiaratoCanaleMap.get(ns + '|ACI') || 0),")
  .split("dichiarato_extra_t: td === 'imp' ? r2(dichiaratoCanaleMap.get(ns + '|EXTRA_RACCOLTA') || 0) : null,")
  .join("dichiarato_extra_t: r2(dichiaratoCanaleMap.get(ns + '|EXTRA_RACCOLTA') || 0),"));
const guasto = await senzaRuolo({ anno: 2026 });
const stocGuasto = (guasto.righe || []).find(r => String(r.sito).toUpperCase().startsWith('GATIM') && r.tipo_destinazione === 'stoc');
verifica('senza la protezione il piazzale si mette a dichiarare 115,54 t',
  !!stocGuasto && stocGuasto.dichiarato_aci_t === ACI_DICHIARATO_T, JSON.stringify(stocGuasto && stocGuasto.dichiarato_aci_t));
verifica('e il totale ACI raddoppia la parte di chi ha due ruoli: 244,72 t',
  guasto.totali.dichiarato_aci_t === 244.72, String(guasto.totali.dichiarato_aci_t));
verifica('e l\'extra raccolta diventa il doppio esatto: 0,80 t',
  guasto.totali.dichiarato_extra_t === 0.8, String(guasto.totali.dichiarato_extra_t));
verifica('mentre chi e\' solo impianto non cambiava ne\' prima ne\' adesso: e\' per questo che lo scarto sembrava casuale',
  (guasto.righe || []).find(r => String(r.sito).toUpperCase().startsWith('T.R.S')).dichiarato_aci_t === ACI_ALTRO_T);
verifica('la giacenza invece era giusta anche col difetto: l\'errore era solo nel numero accanto',
  (guasto.righe || []).find(r => String(r.sito).toUpperCase().startsWith('GATIM') && r.tipo_destinazione === 'imp').giacenza_aci_t === 0);

console.log(`\n${ok} verifiche passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
