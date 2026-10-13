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
// Il report e' solo della RETE: per ACI ed extra raccolta il portale non pubblica
// nessun aggancio, e li' il mese parte dal suo dichiarato.
//
// LA CASELLA «DALL'ANNO PRIMA» (chiusura dell'audit, 11/10/2026). La giacenza
// del canale comprende l'apertura - quello che il 31/12 restava da dichiarare -
// ma l'apertura non sta in nessuno dei dodici mesi: le righe del report con
// arrivo negli anni prima si buttavano, e la somma dei mesi era piu' bassa della
// giacenza. Finche' l'apertura non era consumata - per Irigom fino alla prima
// nave dell'anno - la colonna «Da dichiarare» diceva solo gli arrivi dell'anno e
// la pagina scriveva «a portale risultano dichiarati 600.000 kg in piu'», che era
// falso. Adesso in testa alla riga c'e' una tredicesima casella: entra
// l'apertura netta, esce quello che il report aggancia a carichi degli anni
// prima dopo la lettura del 31/12. Il portale aggancia dal piu' vecchio, quindi
// e' la prima a svuotarsi; e la somma della riga e' la giacenza per
// costruzione, su tutti e tre i canali. Il conto si chiude sulla giacenza anche
// per ACI ed extra raccolta: senza report la parte di una dichiarazione che
// supera il suo mese va sui carichi piu' vecchi, ed e' segnata come stimata.
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
 *   u.per(ns) -> { mesi: number[12], ha_anno, caricamenti: [{ giorno, kg, mesi: number[12], prima_kg }] }
 *   u.primaDopo(ns, '2025-12-31') -> kg dei carichi degli anni prima agganciati dopo quel giorno
 *
 * Chi chiama ha gia' tenuto solo le righe nostre (nostraRiga): qui si scarta
 * l'ACI, perche' una giacenza di rete non la tocca.
 *
 * LE RIGHE DEGLI ANNI PRIMA NON SI BUTTANO PIU' (11/10/2026). Un carico arrivato
 * prima dell'anno guardato e agganciato quest'anno e' l'apertura che esce: si
 * tiene a parte, col giorno del caricamento, e va nella casella «dall'anno
 * prima» (allineaAllaGiacenza). `ha_anno` dice se l'impianto ha anche agganci
 * dell'anno. Non serve a scegliere da dove vengono i mesi: se il report conosce
 * l'impianto, anche con le sole righe degli anni prima, i mesi sono i suoi
 * (zero, se di quest'anno non e' uscito niente). Ripartire allora dal
 * dichiarato del mese faceva uscire la stessa nave due volte, dalla casella e
 * dal suo mese (revisione della chiusura dell'audit, 11/10/2026: le prime navi
 * del 2027 di Irigom). Le righe degli anni dopo restano fuori.
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
      const annoArrivo = Number(giorno.slice(0, 4));
      if (anno !== null && annoArrivo > Number(anno)) return;
      const prima = anno !== null && annoArrivo < Number(anno);
      const i = Number(giorno.slice(5, 7)) - 1;
      if (!prima && !(i >= 0 && i < 12)) return;
      const kg = Number(r.peso_associato_kg) || 0;
      if (!per.has(ns)) per.set(ns, { mesi: new Array(12).fill(0), ha_anno: false, prima: new Map(), caricamenti: new Map() });
      const x = per.get(ns);
      // Il giorno del caricamento: serve a dire quali mesi quella dichiarazione
      // ha portato via, che e' il processo che l'utente vuole leggere, e per i
      // carichi degli anni prima se l'aggancio e' venuto dopo la lettura del 31/12.
      const quando = giornoRoma(r.data_dichiarazione);
      if (prima) x.prima.set(quando, (x.prima.get(quando) || 0) + kg);
      else { x.mesi[i] += kg; x.ha_anno = true; }
      if (!quando) return;
      if (!x.caricamenti.has(quando)) x.caricamenti.set(quando, { giorno: quando, kg: 0, mesi: new Array(12).fill(0), prima_kg: 0 });
      const c = x.caricamenti.get(quando);
      c.kg += kg;
      if (prima) c.prima_kg += kg;
      else c.mesi[i] += kg;
    },
    per(ns) {
      const x = per.get(ns);
      if (!x) return null;
      return {
        mesi: x.mesi.map(v => Math.round(v)),
        ha_anno: x.ha_anno,
        caricamenti: [...x.caricamenti.values()]
          .map(c => ({ giorno: c.giorno, kg: Math.round(c.kg), mesi: c.mesi.map(v => Math.round(v)), prima_kg: Math.round(c.prima_kg) }))
          .sort((a, b) => a.giorno.localeCompare(b.giorno)),
      };
    },
    /**
     * Quanto dei carichi arrivati negli anni prima il report dice agganciato con
     * caricamenti successivi a `dopo` ('AAAA-MM-GG', il giorno della lettura del
     * 31/12): e' l'apertura che esce. Una riga senza giorno di caricamento non si
     * sa se viene prima o dopo la lettura, e non si conta.
     */
    primaDopo(ns, dopo) {
      const x = per.get(ns);
      if (!x) return 0;
      let kg = 0;
      for (const [quando, v] of x.prima) if (quando && quando > String(dopo || '')) kg += v;
      return Math.round(kg);
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
 * Senza `giacenzaKg` (null) si fa solo il punto 1.
 *
 * `dallAnnoPrima` ({ conferito, uscito }, 11/10/2026) e' la casella in testa alla
 * riga: l'apertura netta e quanto il report ne dice uscito. Sta prima di gennaio
 * in tutti e tre gli aggiustamenti, perche' e' il carico piu' vecchio e il
 * portale la svuota per prima. Senza, la casella vale zero e i dodici mesi
 * fanno esattamente quello che facevano.
 */
export function allineaAllaGiacenza(conferito, uscito, giacenzaKg = null, dallAnnoPrima = null) {
  const u = [];
  const resta = [];
  const stimato = [];
  let fuoriMese = 0;
  // L'ECCESSO DELLA CASELLA DELL'ANNO PRIMA NON ENTRA NEI MESI (11/10/2026, visto
  // in produzione). Il report di Irigom aggancia alle dichiarazioni del 2026 circa
  // 1.729 t arrivate nel 2025, contro un'apertura di 385,36 t: l'eccesso, trattato
  // come un aggancio caduto nel mese sbagliato, si spostava su gennaio, febbraio e
  // avanti, tutti i mesi del 2026 risultavano dichiarati e la colonna faceva 0
  // con un falso «652.840 kg dichiarati in piu'». Quegli agganci sono di carichi
  // degli anni prima: oltre l'apertura non hanno niente da portare via in questo
  // anno. Restano fuori e si dicono (prima.oltre_kg).
  let oltrePrima = 0;
  // Posizione 0: dall'anno prima; posizioni 1-12: i mesi.
  const entra = [(dallAnnoPrima && dallAnnoPrima.conferito) || 0, ...Array.from({ length: 12 }, (_, i) => (conferito || [])[i])];
  const esce = [(dallAnnoPrima && dallAnnoPrima.uscito) || 0, ...Array.from({ length: 12 }, (_, i) => (uscito || [])[i])];
  for (let i = 0; i < 13; i++) {
    const c = Math.max(0, Math.round(Number(entra[i]) || 0));
    let q = Math.max(0, Math.round(Number(esce[i]) || 0));
    if (q > c) { if (i === 0) oltrePrima += q - c; else fuoriMese += q - c; q = c; }
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
    uscito: u.slice(1),
    resta: resta.slice(1),
    stimato: stimato.slice(1),
    // La casella dall'anno prima: entrata, uscita, quello che ne resta.
    prima: { conferito: Math.max(0, Math.round(Number(entra[0]) || 0)), uscito: u[0], resta: resta[0], stimato: stimato[0], oltre_kg: oltrePrima },
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
 * UN CANALE CON PIU' RIGHE SI CHIUDE SUL CANALE (11/10/2026).
 *
 * L'ACI di un impianto ha due righe, primaria e secondaria, e ognuna si chiude
 * sulla sua parte di giacenza. Ma la giacenza e' del canale: se la dichiarazione
 * scritta su una riga supera quello che quella riga ha in pancia, l'eccesso
 * (`non_allocato_kg`) esce dalle altre righe dello stesso canale, dal carico
 * piu' vecchio - prima la casella dall'anno prima, poi gennaio di ogni riga, poi
 * febbraio - ed e' segnato come stimato. Senza, la somma delle righe del canale
 * restava sopra la giacenza del canale. Quello che nemmeno le altre righe
 * assorbono resta non allocato, sulle righe che l'avevano, e si dice.
 *
 * Riceve gli esiti di allineaAllaGiacenza delle righe di un canale, in ordine, e
 * ne restituisce delle copie.
 */
export function chiudiFraIFlussi(allineati) {
  const elenco = (allineati || []).map(a => a && ({ ...a, uscito: [...a.uscito], resta: [...a.resta], stimato: [...a.stimato], prima: { ...a.prima } }));
  const prima = elenco.map(a => (a ? a.non_allocato_kg : 0));
  let da = prima.reduce((s, x) => s + x, 0);
  if (!(da > 0) || elenco.filter(Boolean).length < 2) return elenco;
  for (let p = -1; p < 12 && da > 0; p++) {
    for (const a of elenco) {
      if (!a || da <= 0) continue;
      const q = Math.min(p < 0 ? a.prima.resta : a.resta[p], da);
      if (q <= 0) continue;
      if (p < 0) { a.prima.resta -= q; a.prima.uscito += q; a.prima.stimato = true; }
      else { a.resta[p] -= q; a.uscito[p] += q; a.stimato[p] = true; }
      da -= q;
    }
  }
  elenco.forEach((a, i) => {
    if (!a) return;
    const x = Math.min(prima[i], da);
    a.non_allocato_kg = x;
    da -= x;
  });
  return elenco;
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
 *
 * Dal 13/10/2026 il riepilogo non la usa piu': guarda un giorno solo, e la
 * dichiarazione di febbraio di Irigom, presa dal portale in due giorni, la
 * vedeva per un quarto. La copertura di una casella viene da abbinaCaricamenti
 * e copreDellaColonna (shared/storiaDichiarazioni.ts), la stessa della «i»; qui
 * resta per la sua prova (prove/usciteDichiarate.mjs).
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
  // I carichi degli anni prima che lo stesso caricamento ha chiuso vengono per
  // primi, perche' sono i piu' vecchi (11/10/2026).
  const prima = Math.round(Number(c.prima_kg) || 0);
  return {
    giorno: c.giorno,
    kg: c.kg,
    prima_kg: prima,
    mesi: [
      ...(prima > 0 ? [{ mese: "dall'anno prima", kg: prima }] : []),
      ...c.mesi.map((kg, i) => ({ mese: MESI[i], kg })).filter(x => x.kg > 0),
    ],
  };
}
