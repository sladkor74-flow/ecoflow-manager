// CHE COSA DI UN MESE E' DAVVERO USCITO, E CHE COSA C'E' ANCORA.
//
// Il fatto vero, 09/10/2026. L'utente apre il riepilogo delle dichiarazioni e su
// T-Cycle trova gennaio, febbraio, aprile e maggio in giallo - cioe' "ancora da
// dichiarare" - quando quei PFU non ci sono piu' da mesi: «nel mese della
// dichiarazione caricata al portale laddove c'e' stata effettivamente l'uscita in
// nave, il quantitativo dei mesi precedenti viene comunque decurtato e tenerlo in
// giallo potrebbe confondere... con la nave di marzo sono andati via i
// quantitativi di gennaio e febbraio e parte di quelli di marzo, analogamente con
// la nave di giugno».
//
// Aveva ragione al chilo. Il portale aggancia le quantita' agli ordini piu'
// vecchi ancora aperti, quindi una dichiarazione non appartiene al suo mese: lo
// svuota partendo da quelli di prima. Il conto che il gestionale faceva era
// invece mese per mese - ingressi del mese meno il dichiarato DI QUEL MESE - e
// cosi' sommando le caselle di T-Cycle usciva 532,68 t da dichiarare mentre la
// colonna del totale, che e' la giacenza, diceva 352,94 t. Due numeri diversi
// nella stessa riga.
//
// NON SI DEDUCE: SI LEGGE. Il report delle dichiarazioni di trattamento che il
// portale esporta ha una riga per ORDINE, con peso_associato_kg e la data del
// caricamento che l'ha chiuso. Dice quindi, senza inferenze, quanto di ogni mese
// di arrivo e' uscito e con quale caricamento. Su T-Cycle 2026 lo conferma
// esattamente: il caricamento del 03/04 ha chiuso gennaio (87.740), febbraio
// (36.420) e 22.700 kg di marzo; quello del 26/06 il resto di marzo (20.620),
// aprile (46.280), maggio (51.280) e 77.600 kg di giugno. Restano i 41.980 kg di
// giugno e i mesi da luglio in poi: 352,94 t, lo stesso numero della colonna e lo
// stesso del file degli ordini non dichiarati, mese per mese.
//
// Due accortezze, senza le quali i numeri non tornano:
// - solo le righe con partner operativo SMOCO (regola dell'utente, 08/10/2026):
//   il report porta anche le dichiarazioni di altri partner sulle nostre stesse
//   destinazioni;
// - il mese di un carico passato da uno stoccaggio e' quello in cui la
//   SECONDARIA e' arrivata all'impianto, non la fine trasporto della primaria che
//   il report scrive. E' la stessa regola di collocaFotografia, e non e' un
//   dettaglio: su Irigom, che riceve 747,30 t in secondaria, senza di essa tre
//   mesi uscivano negativi e il totale diceva 652,28 t invece di 637,44.
//
// Quello che il report non ha ancora - una dichiarazione caricata a portale dopo
// l'ultimo export - si ripartisce dai mesi piu' vecchi, perche' e' cosi' che il
// portale la aggancerebbe, e la casella dice che quella parte e' una stima
// (allineaAllaGiacenza, campo `stimato`). Il numero certo contro cui si chiude il
// conto e' la giacenza: apertura + entrato - dichiarato e caricato.
//
// Il canale e' solo la RETE: il report e' quello della rete, e per ACI ed extra
// raccolta il portale non pubblica nessun aggancio. Li' il mese resta col suo
// conto.
import { giornoRoma } from "./giornoItaliano.ts";
import { eAci } from "./canaleSecondaria.ts";
import { MESI } from "./dichiarazioniImpianti.ts";

/**
 * IL MESE IN CUI QUEL CARICO E' ARRIVATO ALL'IMPIANTO, per una riga del report
 * delle dichiarazioni. Se il carico e' passato da uno stoccaggio (il report
 * scrive la destinazione secondaria) vale la fine trasporto della SECONDARIA,
 * che e' il viaggio con cui e' arrivato dove si tratta; la fine trasporto che il
 * report scrive e' quella della primaria, cioe' l'arrivo al piazzale.
 * `fineSecondaria(id)` da' il giorno della secondaria nel gestionale.
 */
export function meseArrivoDellaRiga(r, fineSecondaria = () => '') {
  const sec = String((r && r.destinazione_secondaria) || '').trim();
  const idSec = String((r && r.ordine_secondaria) || '').trim();
  const dalloStoccaggio = sec && idSec ? fineSecondaria(idSec) : '';
  return dalloStoccaggio || giornoRoma(r && r.fine_trasporto) || '';
}

/**
 * Raccoglie dal report, per impianto, quanto di ogni mese dell'anno e' uscito e
 * con quale caricamento. Le righe si passano una per una mentre si leggono, cosi'
 * il report non si rilegge due volte.
 *
 *   const u = raccoglitoreUscite({ chiaveDi: norm, fineSecondaria, anno: 2026 });
 *   for (const r of righe) u.segna(r);
 *   u.per(ns) -> { mesi: number[12], caricamenti: [{ giorno, kg, mesi: number[12] }] }
 *
 * Chi chiama ha gia' tenuto solo le righe nostre (nostraRiga): qui si scarta
 * l'ACI, perche' una giacenza di rete non la tocca.
 */
export function raccoglitoreUscite({ chiaveDi = (s) => String(s || '').trim().toLowerCase(), fineSecondaria = () => '', anno = null } = {}) {
  const per = new Map();
  return {
    segna(r) {
      if (!r || eAci({ prodotto: r.prodotto })) return;
      const sito = String(r.destinazione_secondaria || '').trim() || String(r.destinazione || '').trim();
      const ns = chiaveDi(sito);
      if (!ns) return;
      const giorno = meseArrivoDellaRiga(r, fineSecondaria);
      if (!giorno) return;
      if (anno !== null && Number(giorno.slice(0, 4)) !== Number(anno)) return;
      const i = Number(giorno.slice(5, 7)) - 1;
      if (!(i >= 0 && i < 12)) return;
      const kg = Number(r.peso_associato_kg) || 0;
      if (!per.has(ns)) per.set(ns, { mesi: new Array(12).fill(0), caricamenti: new Map() });
      const x = per.get(ns);
      x.mesi[i] += kg;
      // Il giorno del caricamento: serve a dire quali mesi quella dichiarazione
      // ha portato via, che e' il processo che l'utente vuole leggere.
      const quando = giornoRoma(r.data_dichiarazione);
      if (!quando) return;
      if (!x.caricamenti.has(quando)) x.caricamenti.set(quando, { giorno: quando, kg: 0, mesi: new Array(12).fill(0) });
      const c = x.caricamenti.get(quando);
      c.kg += kg;
      c.mesi[i] += kg;
    },
    per(ns) {
      const x = per.get(ns);
      if (!x) return null;
      return {
        mesi: x.mesi.map(v => Math.round(v)),
        caricamenti: [...x.caricamenti.values()]
          .map(c => ({ giorno: c.giorno, kg: Math.round(c.kg), mesi: c.mesi.map(v => Math.round(v)) }))
          .sort((a, b) => a.giorno.localeCompare(b.giorno)),
      };
    },
  };
}

/** Sposta `quanto` kg dai mesi piu' vecchi ancora aperti: e' l'ordine del portale. */
function scalaDaiPiuVecchi(uscito, resta, stimato, quanto) {
  let da = Math.round(quanto);
  for (let i = 0; i < resta.length && da > 0; i++) {
    const q = Math.min(resta[i], da);
    if (q <= 0) continue;
    resta[i] -= q;
    uscito[i] += q;
    stimato[i] = true;
    da -= q;
  }
  return da;
}

/**
 * IL CONTO SI CHIUDE SULLA GIACENZA.
 *
 * `conferito` sono gli ingressi dei dodici mesi, `uscito` quello che il report
 * dice uscito di ciascuno, `giacenzaKg` la giacenza del canale (apertura +
 * entrato - dichiarato e caricato): il numero certo, quello che la colonna del
 * riepilogo mostra e che la quadratura confronta col portale.
 *
 * Tre aggiustamenti, in quest'ordine:
 * 1. un mese non puo' aver mandato via piu' di quanto gli e' arrivato: l'eccesso
 *    (un aggancio che cade in un mese diverso dal nostro) si sposta sui mesi
 *    piu' vecchi;
 * 2. se quello che resta e' piu' della giacenza, la differenza sono le
 *    dichiarazioni caricate dopo l'ultimo export del report: si scalano dai mesi
 *    piu' vecchi, come farebbe il portale, e quei mesi restano segnati `stimato`;
 * 3. se e' meno, il portale ha agganciato piu' di quanto risulti dalle nostre
 *    dichiarazioni: non si inventa niente, e la differenza si dice (`oltre_kg`).
 *    E' il caso noto delle dichiarazioni che il portale ha e il gestionale no.
 *
 * Senza `giacenzaKg` (null) si fa solo il punto 1: e' quello che serve ai canali
 * su cui il portale non pubblica nessun aggancio.
 */
export function allineaAllaGiacenza(conferito, uscito, giacenzaKg = null) {
  const u = [];
  const resta = [];
  const stimato = [];
  let fuoriMese = 0;
  for (let i = 0; i < 12; i++) {
    const c = Math.max(0, Math.round(Number((conferito || [])[i]) || 0));
    let q = Math.max(0, Math.round(Number((uscito || [])[i]) || 0));
    if (q > c) { fuoriMese += q - c; q = c; }
    u.push(q);
    resta.push(c - q);
    stimato.push(false);
  }
  const fuoriMeseResiduo = scalaDaiPiuVecchi(u, resta, stimato, fuoriMese);
  let oltre = 0;
  let nonAllocato = 0;
  if (giacenzaKg !== null && giacenzaKg !== undefined) {
    const somma = resta.reduce((s, x) => s + x, 0);
    const scarto = somma - Math.round(giacenzaKg);
    if (scarto > 0) nonAllocato = scalaDaiPiuVecchi(u, resta, stimato, scarto);
    else if (scarto < 0) oltre = -scarto;
  }
  return {
    uscito: u,
    resta,
    stimato,
    // Agganci che cadono in un mese in cui non e' arrivato tanto: quello che non
    // ha trovato posto nemmeno nei mesi prima.
    fuori_mese_kg: fuoriMeseResiduo,
    // Dichiarazioni nostre che nessun mese riesce ad assorbire: la giacenza dice
    // meno di quello che i mesi hanno in pancia, e il conto non si chiude.
    non_allocato_kg: nonAllocato,
    // Il portale ha agganciato piu' di quanto le nostre dichiarazioni dicano.
    oltre_kg: oltre,
  };
}

/**
 * QUALI MESI QUESTA DICHIARAZIONE HA PORTATO VIA.
 *
 * Si riconosce il caricamento dal giorno (`caricata_il`, che e' il giorno del
 * caricamento a portale: dove le dichiarazioni sono allineate dal portale
 * coincide sempre - 31 su 31 il 09/10/2026) e, se il giorno non si trova, dal
 * peso al chilo, con la tolleranza di 2 kg che tutto il modulo usa. Senza
 * riscontro non si dice niente: meglio tacere che raccontare una copertura
 * inventata.
 */
export function copertureDelCaricamento(caricamenti, dichiarazione, tolleranzaKg = 2) {
  const d = dichiarazione;
  if (!d || !d.caricata_inviata) return null;
  const elenco = caricamenti || [];
  const giorno = giornoRoma(d.caricata_il);
  let c = giorno ? elenco.find(x => x.giorno === giorno) : null;
  if (!c) {
    const q = Math.round(Number(d.quantita_kg) || 0);
    const pari = elenco.filter(x => Math.abs(x.kg - q) <= tolleranzaKg);
    if (pari.length === 1) c = pari[0];
  }
  if (!c) return null;
  return {
    giorno: c.giorno,
    kg: c.kg,
    mesi: c.mesi.map((kg, i) => ({ mese: MESI[i], kg })).filter(x => x.kg > 0),
  };
}
