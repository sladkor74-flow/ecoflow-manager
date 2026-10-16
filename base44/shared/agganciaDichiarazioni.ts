// Le dichiarazioni caricate a portale, riconosciute dentro le nostre.
//
// Il portale non ragiona per mese: raccoglie le quantita' in caricamenti, uno per
// giorno, e le aggancia agli ordini piu' vecchi ancora aperti. Cosi' la
// dichiarazione che carichiamo a luglio puo' chiudere ordini di marzo, e un
// ordine puo' risultare dichiarato anche solo in parte.
//
// Le nostre righe mensili pero' hanno lo stesso peso, al chilo: e' da li' che si
// capisce quale nostro mese e' stato caricato e in che giorno. Un mese puo'
// essere stato caricato in piu' riprese ravvicinate - Irigom febbraio 2026: 547,26 t
// l'11 marzo e 174,40 t il 12 - percio' si provano anche i gruppi consecutivi.
//
// Quello che resta senza riscontro e' l'arretrato dell'anno prima, chiuso con le
// dichiarazioni dei primi mesi: e' giusto che non trovi un nostro mese.

import { MESI } from "./dichiarazioniImpianti.ts";
import { eAci } from "./canaleSecondaria.ts";
import { giornoRoma, giornoPortale } from "./giornoItaliano.ts";
import { fetchAll } from "./fetchAll.ts";
import { nostraRiga } from "./giacenzaPortale.ts";
import { formatoKg } from "./formato.ts";

/** Dal nome del campo del portale a quello della nostra dichiarazione. */
export const MATERIALI_PORTALE = [
  ['granulo_kg', 'granulo_kg'],
  ['fibre_kg', 'fibre_kg'],
  ['metallo_kg', 'metalli_kg'],
  ['cippato_kg', 'cippato_kg'],
  ['ciabattato_kg', 'ciabattato_kg'],
];

/** Due chili di tolleranza: i pesi coincidono, ma gli arrotondamenti no. */
export const TOLLERANZA_KG = 2;
/** Quante riprese consecutive si provano per un solo nostro mese. */
export const MAX_RIPRESE = 3;
/**
 * Quanti nostri mesi consecutivi si provano insieme contro un caricamento
 * (agganciaMesiInsieme): tutti quelli di un anno. La prova del cambio d'anno
 * parlava di due o tre; non serve fermarsi li', perche' si aggancia solo se i
 * mesi degli ordini chiusi coincidono con i nostri, e Gatim, che all'11/10/2026
 * aveva dichiarato la rete fino a maggio, l'arretrato lo carichera' tutto insieme.
 */
export const MAX_MESI_INSIEME = 12;

const num = (v) => Number(v) || 0;
// Il giorno italiano della fine trasporto: tagliare la stringa UTC spostava al
// giorno prima una data salvata a mezzanotte italiana. La fine e' un giorno
// senza ora, a mezzanotte Z. Il giorno del caricamento a portale
// (data_dichiarazione) ha invece l'ora del portale - l'ora italiana scritta con
// la Z - e si legge col giorno scritto nel file, giornoPortale (difetto 9,
// 16/10/2026): con giornoRoma un caricamento delle 23:30 passava al giorno dopo,
// e a capodanno all'anno dopo.
const giorno = (v) => giornoRoma(v);

/** Il canale di una riga del report delle dichiarazioni: l'ACI e' la classe 9 del prodotto. */
export const canaleRigaPortale = (r) => (eAci({ prodotto: r.prodotto }) ? 'ACI' : 'RETE');

/**
 * La provenienza di una riga del report: l'ordine e' arrivato all'impianto in
 * secondaria (da uno stoccaggio, e allora la destinazione secondaria e' chi
 * tratta) oppure direttamente in primaria. Serve all'ACI, le cui dichiarazioni
 * sono divise per provenienza.
 */
export const provenienzaRigaPortale = (r) => (String(r.destinazione_secondaria || '').trim() ? 'secondaria' : 'primaria');

/**
 * I caricamenti del portale, uno per impianto e per giorno.
 * `chi tratta` e' la destinazione secondaria quando c'e', altrimenti la
 * destinazione: la destinazione finale e' invece dove e' finito il prodotto -
 * le cementerie - e non e' chi dichiara.
 *
 * Con `canale` ('RETE' o 'ACI') si contano solo le righe di quel canale. Un
 * impianto puo' caricare lo stesso giorno la dichiarazione di rete e quella ACI:
 * sommate, il caricamento del giorno non tornava con nessun nostro mese di rete,
 * il mese restava "senza riscontro" e il caricamento finiva fra l'arretrato.
 * Con `provenienza` ('primaria' o 'secondaria') si contano solo le righe di
 * quella provenienza, per lo stesso motivo.
 */
export function caricamentiPortale(righe, anno, canale = '', provenienza = '') {
  const per = new Map(); // impianto -> Map(data -> { kg, materiali, mesi, provenienze })
  for (const r of righe) {
    // SOLO LE RIGHE DI SMOCO (audit del 10/10/2026). Il report del portale porta
    // anche le dichiarazioni di altri partner operativi, a volte sulle nostre
    // stesse destinazioni: 1.605 righe di Baucina passano da Irigom fra il 2023 e
    // il 2025. Il riepilogo le toglieva prima di chiamare il confronto; l'allinea-
    // mento automatico, che gira a ogni caricamento ed e' l'unico che SCRIVE
    // «caricata» sulle nostre righe, no - una loro riga poteva pareggiare al chilo
    // un nostro mese e segnarlo caricato. E' una regola fissa dell'utente: si
    // filtra qui, cosi' vale per chiunque passi da questa funzione.
    if (!nostraRiga(r)) continue;
    if (canale && canaleRigaPortale(r) !== canale) continue;
    if (provenienza && provenienzaRigaPortale(r) !== provenienza) continue;
    const data = giornoPortale(r.data_dichiarazione);
    if (!data) continue;
    // DI CHE ANNO E' UNA RIGA: LO DICE LA FINE TRASPORTO, NON IL CARICAMENTO.
    //
    // E' la regola 1, e qui costava una dichiarazione intera. La dichiarazione di
    // dicembre si carica a portale nei primi giorni di gennaio: con l'anno preso
    // dal giorno del caricamento, chiedendo il 2026 quella riga veniva scartata
    // (data 2027) e chiedendo il 2027 non trovava nessuna nostra riga, perche' le
    // nostre dichiarazioni di quel mese sono dell'anno 2026. Non si agganciava
    // mai, in nessuno dei due anni, e dicembre restava «da dichiarare» per
    // sempre, senza un avviso da nessuna parte (audit del 03/10/2026).
    //
    // Una riga entra nell'anno che si sta guardando se ci sta col caricamento
    // OPPURE con gli ordini che chiude. Non solo con gli ordini: un caricamento
    // fatto quest'anno che chiude ordini dell'anno prima e' l'ARRETRATO, e deve
    // restare visibile qui per essere riconosciuto come tale. Non solo col
    // caricamento: e' il caso di dicembre.
    //
    // La riga di dicembre caricata a gennaio si vede quindi in tutti e due gli
    // anni, e in tutti e due e' giusta: nel 2026 aggancia il nostro dicembre, nel
    // 2027 risulta arretrato, perche' per il 2027 chiude ordini dell'anno prima.
    // Il giorno resta quello vero del caricamento: e' la data che si scrive in
    // caricata_il.
    const periodo = giorno(r.fine_trasporto);
    const suoAnno = Number(data.slice(0, 4)) === Number(anno)
      || (!!periodo && Number(periodo.slice(0, 4)) === Number(anno));
    if (!suoAnno) continue;
    const sito = String(r.destinazione_secondaria || '').trim() || String(r.destinazione || '').trim();
    if (!sito) continue;
    if (!per.has(sito)) per.set(sito, new Map());
    const perGiorno = per.get(sito);
    if (!perGiorno.has(data)) perGiorno.set(data, { data, kg: 0, materiali: {}, mesi: new Map(), materialiMesi: new Map(), provenienze: new Set() });
    const c = perGiorno.get(data);
    c.kg += num(r.peso_associato_kg);
    for (const [dal, al] of MATERIALI_PORTALE) c.materiali[al] = (c.materiali[al] || 0) + num(r[dal]);
    // DI CHE MESE SONO GLI ORDINI CHE QUESTO CARICAMENTO CHIUDE.
    //
    // Il portale aggancia le quantita' agli ordini piu' vecchi aperti, quindi un
    // caricamento di ottobre puo' chiudere ordini di agosto. Il mese e' quello
    // della FINE TRASPORTO (regola 1), e serve a capire che cosa e' stato
    // dichiarato quando nel gestionale quel mese non c'e': senza, un caricamento
    // che non trova un nostro mese finiva archiviato come arretrato dell'anno
    // prima, e nessuno lo vedeva (01/10/2026).
    const mese = giorno(r.fine_trasporto).slice(0, 7);
    if (mese) c.mesi.set(mese, (c.mesi.get(mese) || 0) + num(r.peso_associato_kg));
    // E i materiali di ogni mese, letti riga per riga: servono quando un
    // caricamento solo porta piu' nostri mesi (agganciaMesiInsieme), perche'
    // ciascuno prenda i suoi e non una parte in proporzione ai chili (seconda
    // revisione del 15/10/2026).
    if (mese) {
      if (!c.materialiMesi.has(mese)) c.materialiMesi.set(mese, {});
      const mm = c.materialiMesi.get(mese);
      for (const [dal, al] of MATERIALI_PORTALE) mm[al] = (mm[al] || 0) + num(r[dal]);
    }
    c.provenienze.add(provenienzaRigaPortale(r));
  }
  const esito = new Map();
  const tondi = (m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, Math.round(v)]));
  for (const [sito, perGiorno] of per) {
    esito.set(sito, [...perGiorno.values()]
      .map(c => ({
        data: c.data,
        kg: Math.round(c.kg),
        materiali: tondi(c.materiali),
        mesi: [...c.mesi.entries()].map(([mese, kg]) => ({ mese, kg: Math.round(kg) })).sort((a, b) => a.mese.localeCompare(b.mese)),
        materiali_mesi: Object.fromEntries([...c.materialiMesi.entries()].map(([mese, m]) => [mese, tondi(m)])),
        provenienze: [...c.provenienze].sort(),
      }))
      .sort((a, b) => a.data.localeCompare(b.data)));
  }
  return esito;
}

/**
 * Aggancia le nostre righe mensili ai caricamenti di quell'impianto.
 * `nostre` sono le dichiarazioni di un impianto, un canale, in ordine di mese.
 */
export function agganciaMesi(nostre, caricamenti) {
  const usati = new Set();
  const trovati = [];
  const senzaRiscontro = [];
  const ordinate = [...nostre].sort((a, b) => MESI.indexOf(a.mese) - MESI.indexOf(b.mese));
  for (const n of ordinate) {
    const quanto = Math.round(num(n.quantita_kg));
    if (quanto <= 0) continue;
    let gruppo = null;
    for (let quante = 1; quante <= MAX_RIPRESE && !gruppo; quante++) {
      for (let i = 0; i + quante <= caricamenti.length; i++) {
        const fetta = caricamenti.slice(i, i + quante);
        if (fetta.some((_, k) => usati.has(i + k))) continue;
        const somma = fetta.reduce((s, c) => s + c.kg, 0);
        if (Math.abs(somma - quanto) <= TOLLERANZA_KG) { gruppo = { fetta, da: i, quante }; break; }
      }
    }
    if (!gruppo) { senzaRiscontro.push(n); continue; }
    for (let k = 0; k < gruppo.quante; k++) usati.add(gruppo.da + k);
    const materiali = {};
    for (const c of gruppo.fetta) for (const [k, v] of Object.entries(c.materiali)) materiali[k] = (materiali[k] || 0) + v;
    trovati.push({
      dichiarazione: n,
      date: gruppo.fetta.map(c => c.data),
      caricata_il: gruppo.fetta[gruppo.fetta.length - 1].data,
      materiali,
    });
  }
  // Poi i mesi rimasti senza riscontro, provati insieme (agganciaMesiInsieme).
  const insieme = agganciaMesiInsieme(senzaRiscontro, caricamenti, usati);
  return { trovati: [...trovati, ...insieme.trovati], senzaRiscontro: insieme.senzaRiscontro, avanzi: caricamenti.filter((_, i) => !usati.has(i)) };
}

// 'AAAA-MM' di una nostra riga mensile, come i mesi degli ordini di un
// caricamento; '' se l'anno o il mese non si sanno. Le somme dell'ACI
// (agganciaAci) hanno l'anno nelle loro righe.
function meseDellaRiga(n) {
  const i = MESI.indexOf(n && n.mese);
  const anno = Number((n && n.anno) || (n && Array.isArray(n.righe) && n.righe[0] && n.righe[0].anno));
  return i >= 0 && anno ? `${anno}-${String(i + 1).padStart(2, '0')}` : '';
}

/**
 * PIU' NOSTRI MESI IN UN CARICAMENTO SOLO (prova del cambio d'anno del
 * 15/10/2026, difetto 13). Il portale fa un caricamento per giorno e per
 * impianto: se un impianto carica due mesi lo stesso giorno, in due
 * dichiarazioni (Gatim novembre 2026, 20.000 kg alle 10:00, e dicembre 2026,
 * 15.000 kg alle 10:20, il 12/01/2027), il caricamento del giorno fa 35.000 kg e
 * nessuno dei due mesi, provato da solo, lo pareggia. Restavano tutti e due non
 * caricati, il riquadro diceva «nessun nostro mese ha questo peso: va inserita
 * nel mese giusto» spingendo a creare un doppione, e nel 2027 Gatim calcolava
 * 303,62 t contro 268,62 a portale. Raggruppare per dichiarazione del portale non
 * si puo': sui dati veri un mese e' spesso fatto di piu' dichiarazioni lo stesso
 * giorno (130 giorni-impianto su 183).
 *
 * Dopo il passo mese per mese, i nostri mesi consecutivi rimasti senza
 * riscontro si provano insieme contro UN caricamento, cioe' un giorno solo,
 * entro TOLLERANZA_KG. Si agganciano SOLO se i mesi degli ordini che quel
 * caricamento chiude (c.mesi, dalla fine trasporto) sono proprio i nostri mesi:
 * due mesi che fanno lo stesso peso per caso, ma con ordini di altri mesi,
 * restano senza riscontro. Le righe prendono il giorno di quel caricamento
 * (caricata_il) e il segno «insieme» (insieme_mesi). La storia della riga
 * racconta gia' «due dichiarazioni caricate lo stesso giorno hanno un caricamento
 * solo» (storiaDichiarazioni.ts).
 *
 * I MATERIALI DI OGNI MESE SONO I SUOI (seconda revisione del 15/10/2026). La
 * prima versione divideva granulo, fibre e metalli del caricamento in
 * proporzione ai chili, e l'allineamento li scriveva sulle righe di rete:
 * novembre (granulo 12.000, metalli 4.000 a portale) diventava granulo 12.857 e
 * metalli 3.429, dicembre (10.500 e 2.000) 9.643 e 2.571, diversi da quelli che il
 * portale ha riga per riga. Ora ogni mese prende i materiali delle righe del
 * portale con la fine trasporto in quel mese (materiali_mesi, come c.mesi),
 * quando i chili di ogni mese tornano col nostro mese entro TOLLERANZA_KG.
 * Altrimenti - il portale aggancia dal piu' vecchio, e i chili di un mese
 * possono finire sugli ordini di quello dopo - i materiali di un mese non si
 * possono leggere ma solo stimare, e una stima non si scrive al posto di un dato
 * (regola dell'utente: un valore che non si legge non si deduce): la riga si
 * segna caricata, i suoi materiali restano com'erano e l'esito lo dice
 * (materiali_non_letti).
 *
 * MAI CARICAMENTI DI GIORNI DIVERSI (revisione del 15/10/2026). La prima
 * versione provava anche gruppi di caricamenti consecutivi: novembre caricato il
 * 05/12/2026 (20.000 kg di ordini di novembre) e dicembre l'08/01/2027 (15.000
 * kg, di cui 1.000 del resto di novembre, perche' il portale aggancia dal piu'
 * vecchio), contro le nostre righe da 21.000 e 14.000 kg, facevano 35.000 kg di
 * novembre e dicembre e si agganciavano insieme: novembre prendeva caricata_il
 * 08/01/2027 invece del 05/12/2026, e la data sbagliata entrava nelle giacenze
 * (35.000 kg «dichiarati dopo la fotografia» del 31/12/2026 contro i 15.000 veri,
 * giacenzaPortale.ts), nella chiusura dell'anno e nelle uscite dichiarate per
 * giorno; e lo scarto di 1.000 kg per mese non si vedeva piu'. Due giorni
 * diversi restano come prima: ogni mese col suo caricamento, o senza riscontro.
 *
 * `usati` sono gli indici dei caricamenti gia' presi: si aggiornano qui.
 */
export function agganciaMesiInsieme(senzaRiscontro, caricamenti, usati = new Set()) {
  const trovati = [];
  const conMese = senzaRiscontro.filter(n => meseDellaRiga(n) && Math.round(num(n.quantita_kg)) > 0);
  const presi = new Set();
  // I mesi distinti, in ordine: l'ACI puo' avere due righe nello stesso mese.
  const mesi = [...new Set(conMese.map(meseDellaRiga))].sort();
  const consecutivi = (a, b) => {
    const [ya, ma] = a.split('-').map(Number);
    const [yb, mb] = b.split('-').map(Number);
    return yb * 12 + mb === ya * 12 + ma + 1;
  };
  for (let quanti = 2; quanti <= Math.min(MAX_MESI_INSIEME, mesi.length); quanti++) {
    for (let da = 0; da + quanti <= mesi.length; da++) {
      const fila = mesi.slice(da, da + quanti);
      if (fila.some((m, k) => k > 0 && !consecutivi(fila[k - 1], m))) continue;
      const righe = conMese.filter(n => fila.includes(meseDellaRiga(n)) && !presi.has(n));
      // Un mese gia' agganciato in un'altra fila non si riprende.
      if (new Set(righe.map(meseDellaRiga)).size !== fila.length) continue;
      const quanto = righe.reduce((s, n) => s + Math.round(num(n.quantita_kg)), 0);
      // Un caricamento solo, cioe' un giorno solo (revisione del 15/10/2026, qui sopra).
      const i = caricamenti.findIndex((c, k) => {
        if (usati.has(k) || Math.abs(c.kg - quanto) > TOLLERANZA_KG) return false;
        const loro = [...new Set((c.mesi || []).filter(m => Math.round(num(m.kg)) > 0).map(m => m.mese))].sort();
        return loro.join() === fila.join();
      });
      if (i < 0) continue;
      usati.add(i);
      const c = caricamenti[i];
      const nomi = MESI.filter(m => righe.some(n => n.mese === m));
      // I materiali di ogni mese, letti dal portale per fine trasporto, solo se
      // ogni nostro mese e' una riga sola e i suoi chili tornano con quelli del
      // portale per quel mese (qui sopra).
      const kgDelMese = (m) => Math.round(num(((c.mesi || []).find(x => x.mese === m) || {}).kg));
      const letti = fila.every(m => {
        const sue = righe.filter(n => meseDellaRiga(n) === m);
        return sue.length === 1 && Math.abs(kgDelMese(m) - Math.round(num(sue[0].quantita_kg))) <= TOLLERANZA_KG
          && !!(c.materiali_mesi && c.materiali_mesi[m]);
      });
      const perMese = (fila.map(m => `${MESI[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)} ${formatoKg(kgDelMese(m))} kg`)).join(', ');
      righe.forEach((n) => {
        presi.add(n);
        trovati.push({
          dichiarazione: n,
          date: [c.data],
          caricata_il: c.data,
          materiali: letti ? { ...c.materiali_mesi[meseDellaRiga(n)] } : {},
          insieme_mesi: nomi,
          ...(letti ? {} : { materiali_non_letti: `i chili per mese degli ordini chiusi dal caricamento (${perMese}) non tornano con i nostri mesi: i materiali di ogni mese si potrebbero solo stimare, e restano quelli scritti` }),
        });
      });
    }
  }
  return { trovati, senzaRiscontro: senzaRiscontro.filter(n => !presi.has(n)) };
}

/** Piu' elenchi di caricamenti dello stesso impianto, sommati giorno per giorno. */
function unisciPerGiorno(...liste) {
  const per = new Map();
  const mesi = new Map();       // data -> Map(mese -> kg)
  const materialiMesi = new Map(); // data -> Map(mese -> materiali)
  const provenienze = new Map(); // data -> Set
  for (const c of liste.flat()) {
    if (!per.has(c.data)) { per.set(c.data, { data: c.data, kg: 0, materiali: {} }); mesi.set(c.data, new Map()); materialiMesi.set(c.data, new Map()); provenienze.set(c.data, new Set()); }
    const t = per.get(c.data);
    t.kg += c.kg;
    for (const [k, v] of Object.entries(c.materiali || {})) t.materiali[k] = (t.materiali[k] || 0) + v;
    // I mesi degli ordini chiusi e la provenienza non si perdono unendo: sono
    // quello che permette di dire di che mese e' una dichiarazione che il
    // gestionale non ha. Nemmeno i materiali di ogni mese (15/10/2026).
    for (const m of c.mesi || []) mesi.get(c.data).set(m.mese, (mesi.get(c.data).get(m.mese) || 0) + m.kg);
    for (const [mese, mm] of Object.entries(c.materiali_mesi || {})) {
      const dove = materialiMesi.get(c.data);
      if (!dove.has(mese)) dove.set(mese, {});
      const somma = dove.get(mese);
      for (const [k, v] of Object.entries(mm || {})) somma[k] = (somma[k] || 0) + v;
    }
    for (const p of c.provenienze || []) provenienze.get(c.data).add(p);
  }
  return [...per.values()]
    .map(t => ({
      ...t,
      mesi: [...mesi.get(t.data).entries()].map(([mese, kg]) => ({ mese, kg })).sort((a, b) => a.mese.localeCompare(b.mese)),
      materiali_mesi: Object.fromEntries(materialiMesi.get(t.data)),
      provenienze: [...provenienze.get(t.data)].sort(),
    }))
    .sort((a, b) => a.data.localeCompare(b.data));
}

/** I materiali di un caricamento divisi fra piu' nostre righe, in proporzione ai chili; l'ultima prende il resto. */
function ripartisciMateriali(materiali, righe) {
  const kg = righe.map(d => Math.round(num(d.quantita_kg)));
  const totale = kg.reduce((s, v) => s + v, 0) || 1;
  const quote = righe.map(() => ({}));
  for (const [k, v] of Object.entries(materiali)) {
    let resto = v;
    righe.forEach((_, i) => {
      const q = i === righe.length - 1 ? resto : Math.round(v * kg[i] / totale);
      quote[i][k] = q;
      resto -= q;
    });
  }
  return quote;
}

const PROVENIENZE_ACI = ['primaria', 'secondaria'];

/**
 * L'aggancio dell'ACI, che noi dichiariamo per provenienza: Gatim aprile 2026
 * ha una riga primaria da 8.200 kg e una secondaria da 14.340 kg. Provate una
 * per una contro il caricamento del giorno (22.540 kg) non tornavano nessuna
 * delle due: il mese risultava non caricato e il caricamento finiva fra
 * l'arretrato dell'anno prima, che e' falso.
 *
 * Prima ciascuna provenienza contro i caricamenti della stessa provenienza.
 * Quello che resta si prova contro i caricamenti rimasti, sommati per giorno:
 * prima le due provenienze dello stesso mese insieme (se il portale le ha
 * classificate diversamente da noi), divise poi fra le due righe in proporzione
 * ai chili; poi le righe rimaste da sole e quelle senza provenienza.
 */
export function agganciaAci(mie, caricamentiPrimaria, caricamentiSecondaria) {
  const trovati = [];
  const senzaDivise = [];
  const avanziDivisi = [];
  for (const [p, lista] of [['primaria', caricamentiPrimaria || []], ['secondaria', caricamentiSecondaria || []]]) {
    const e = agganciaMesi(mie.filter(d => d.provenienza === p), lista);
    trovati.push(...e.trovati);
    senzaDivise.push(...e.senzaRiscontro);
    avanziDivisi.push(...e.avanzi);
  }
  const senzaProvenienza = mie.filter(d => !PROVENIENZE_ACI.includes(d.provenienza));

  // Le due provenienze dello stesso mese rimaste entrambe senza riscontro, sommate
  const perMese = new Map();
  for (const d of senzaDivise) perMese.set(d.mese, [...(perMese.get(d.mese) || []), d]);
  const somme = [...perMese.entries()].filter(([, ds]) => ds.length > 1)
    .map(([mese, righe]) => ({ mese, quantita_kg: righe.reduce((s, d) => s + Math.round(num(d.quantita_kg)), 0), righe }));
  const conSomma = unisciPerGiorno(avanziDivisi);
  const insieme = agganciaMesi(somme, conSomma);
  for (const t of insieme.trovati) {
    const quote = ripartisciMateriali(t.materiali, t.dichiarazione.righe);
    t.dichiarazione.righe.forEach((d, i) => trovati.push({ dichiarazione: d, date: t.date, caricata_il: t.caricata_il, materiali: quote[i], insieme: true, ...(t.insieme_mesi ? { insieme_mesi: t.insieme_mesi } : {}), ...(t.materiali_non_letti ? { materiali_non_letti: t.materiali_non_letti } : {}) }));
  }
  const ancora = [
    ...insieme.senzaRiscontro.flatMap(s => s.righe),
    ...senzaDivise.filter(d => perMese.get(d.mese).length === 1),
    ...senzaProvenienza,
  ];
  const sole = agganciaMesi(ancora, insieme.avanzi);
  trovati.push(...sole.trovati);
  return { trovati, senzaRiscontro: sole.senzaRiscontro, avanzi: sole.avanzi };
}

/** Le stesse ragioni sociali scritte in modo diverso non devono separarsi. */
const chiave = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** I caricamenti per impianto sotto la chiave normalizzata: due grafie dello stesso impianto si sommano invece di sovrascriversi. */
function perChiave(caricamenti) {
  const per = new Map();
  for (const [sito, lista] of caricamenti) {
    const k = chiave(sito);
    const gia = per.get(k);
    per.set(k, gia ? { nome: gia.nome, lista: unisciPerGiorno(gia.lista, lista) } : { nome: sito, lista });
  }
  return per;
}

/**
 * Allinea le nostre dichiarazioni a quelle caricate a portale, canale per
 * canale: segna quali sono caricate, con che data, e scrive i materiali che ne
 * sono usciti. Le righe ACI del report si agganciano solo alle nostre
 * dichiarazioni ACI e quelle di rete solo alle nostre di rete; l'extra raccolta
 * a portale non c'e'. L'ACI si aggancia anche per provenienza (agganciaAci).
 * Non toglie mai una spunta messa a mano: se un nostro mese non si ritrova, lo
 * dice e basta. Ogni voce dell'esito porta canale e provenienza, cosi' "Gatim
 * Aprile" due volte si legge come le due righe ACI che e'.
 */
/**
 * IL CONFRONTO COL PORTALE, senza scrivere niente: serve sia all'allineamento
 * sia alla pagina, che deve poter mostrare quello che manca anche prima che
 * qualcuno prema «Allinea».
 *
 * Torna { trovati, non_trovate, da_inserire, arretrato }.
 *
 * DA_INSERIRE E' LA NOVITA' DEL 01/10/2026. Un caricamento del portale che non
 * trova un nostro mese finiva tutto fra l'arretrato dell'anno prima, con una
 * motivazione che spesso era falsa, e la pagina non mostrava l'arretrato: il
 * 01/10/2026 l'utente ha dichiarato a portale il quantitativo di agosto di un
 * impianto e il gestionale non se n'e' accorto. Adesso si guarda DI CHE MESE
 * sono gli ordini che il caricamento chiude: se sono dell'anno verificato, non
 * e' arretrato, e' una dichiarazione che nel gestionale non c'e' e va inserita -
 * con il mese scritto accanto, per non doverlo indovinare.
 */
export function confrontaConIlPortale(righe, anno, nostre, canali = ['RETE', 'ACI']) {
  const annoNum = Number(anno);
  const trovati = [];
  const nonTrovate = [];
  const daInserire = [];
  const arretrato = [];

  const voce = (sito, canale, caricamenti, motivo) => {
    const mesi = new Map();
    for (const c of caricamenti) for (const m of c.mesi || []) mesi.set(m.mese, (mesi.get(m.mese) || 0) + m.kg);
    return {
      sito, canale, motivo,
      quanti: caricamenti.length,
      caricamenti: caricamenti.map(c => ({ data: c.data, kg: Math.round(c.kg), mesi: c.mesi || [], provenienze: c.provenienze || [] })),
      kg: Math.round(caricamenti.reduce((s, c) => s + c.kg, 0)),
      mesi: [...mesi.entries()].map(([mese, kg]) => ({ mese, kg: Math.round(kg) })).sort((a, b) => a.mese.localeCompare(b.mese)),
    };
  };
  // Un caricamento che chiude ordini dell'anno verificato (o di cui non si sa
  // il mese, perche' tacere e' peggio) e' una dichiarazione da inserire; quello
  // che chiude solo ordini degli anni prima e' l'arretrato, e li' e' giusto che
  // non trovi niente.
  const classifica = (sito, canale, caricamenti, motivo) => {
    const diQuestAnno = caricamenti.filter(c => !(c.mesi || []).length || (c.mesi || []).some(m => m.mese.startsWith(String(annoNum))));
    const diPrima = caricamenti.filter(c => !diQuestAnno.includes(c));
    if (diQuestAnno.length) daInserire.push(voce(sito, canale, diQuestAnno, motivo));
    if (diPrima.length) arretrato.push(voce(sito, canale, diPrima, 'chiude ordini degli anni precedenti: e\' l\'arretrato, ed e\' giusto che non trovi un nostro mese'));
  };

  for (const canale of canali) {
    const perSito = perChiave(caricamentiPortale(righe, annoNum, canale));
    const perProvenienza = canale === 'ACI'
      ? Object.fromEntries(PROVENIENZE_ACI.map(p => [p, perChiave(caricamentiPortale(righe, annoNum, 'ACI', p))]))
      : null;

    for (const [k, { nome, lista }] of perSito) {
      const mie = (nostre || []).filter(d => chiave(d.sito) === k && (d.canale || 'RETE') === canale);
      if (!mie.length) {
        classifica(nome, canale, lista, `nel gestionale non c'e' nessuna dichiarazione ${canale === 'ACI' ? 'ACI' : 'di rete'} di questo impianto`);
        continue;
      }
      const esito = perProvenienza
        ? agganciaAci(mie, perProvenienza.primaria.get(k)?.lista, perProvenienza.secondaria.get(k)?.lista)
        : agganciaMesi(mie, lista);
      for (const t of esito.trovati) trovati.push({ ...t, sito: nome, canale });
      for (const n of esito.senzaRiscontro) nonTrovate.push({ sito: nome, canale, provenienza: n.provenienza || '', mese: n.mese, kg: Math.round(num(n.quantita_kg)), era_segnata: !!n.caricata_inviata });
      if (esito.avanzi.length) classifica(nome, canale, esito.avanzi, 'nessun nostro mese ha questo peso');
    }
  }
  return { trovati, non_trovate: nonTrovate, da_inserire: daInserire, arretrato };
}

/**
 * CANALI: SOLO LA RETE, e non e' una precauzione ma una regola dell'utente.
 *
 * 02/10/2026: «gli ACI non sono gestiti a portale e pertanto non si possono
 * automatizzare, quindi tocchera' a me farlo a mano». E il giorno dopo il
 * perche', che e' la parte che conta: le caselle ACI verdi le ha chiuse lui a
 * mano, inserendo fibre tessili, metalli ferrosi e granulo letti dalle
 * DICHIARAZIONI CARTACEE che gli impianti mandano via email.
 *
 * Qui sotto si vede perche' allora l'ACI non puo' passare di qui: fra i campi
 * che si scrivono ci sono i MATERIALI (...t.materiali), quindi un allineamento
 * sull'ACI sovrascriverebbe con i numeri del portale proprio quelli che lui ha
 * trascritto dalla carta. Non e' un doppione: e' una perdita.
 *
 * L'extra raccolta non entra qui in nessun caso: a portale non c'e' affatto.
 *
 * Il parametro resta, cosi' chi un domani volesse l'ACI deve chiederlo per
 * nome, e si vede nel codice chi lo fa.
 */
/**
 * Quali canali si possono SCRIVERE, dato quello che ha chiesto chi chiama.
 *
 * Sta qui, e non dentro la funzione che riceve la richiesta, per un motivo
 * preciso: la funzione aveva il valore di partenza opposto a questo - rete E
 * ACI - e il caricamento dei dati la chiamava senza dire niente. Risultato: ogni
 * caricamento riscriveva l'ACI coi numeri del portale e cancellava i materiali
 * che l'amministratore aveva trascritto a mano dalle dichiarazioni cartacee.
 * Il commento diceva «e' la strada del pulsante», ma quel pulsante non c'e' piu'
 * dal 03/10/2026 («Via il pulsante Allinea dal portale: lo fa gia' da solo»), e
 * la regola resta quella del 02/10/2026: l'ACI si riconosce e non si scrive.
 *
 * Adesso la decisione e' una sola, qui, e la prova la guarda.
 */
export function canaliDaScrivere(canali) {
  const chiesti = Array.isArray(canali) ? canali.filter(c => c === 'RETE' || c === 'ACI') : [];
  return chiesti.length ? chiesti : ['RETE'];
}

export async function allineaDalPortale(svc, anno, righePortale = null, nostreRighe = null, canaliDaScrivere = ['RETE']) {
  const annoNum = Number(anno);
  const righe = righePortale || await fetchAll(svc.DichiarazioneTrattamento, null, 'id');
  // Tutte le pagine: una lettura da 500 righe, con quindici impianti, dodici mesi
  // e fino a quattro flussi ciascuno, poteva lasciare fuori dichiarazioni vere.
  const nostre = nostreRighe || await fetchAll(svc.DichiarazioneSito, { anno: annoNum }, 'id');

  const esito = confrontaConIlPortale(righe, annoNum, nostre);
  const aggiornate = [];
  // SI CONFRONTA TUTTO, SI SCRIVE SOLO DOVE E' LECITO. Il confronto sull'ACI
  // serve e resta: dice quali mesi il portale conosce e quali no. Ma la
  // SCRITTURA no, e il perche' si legge due righe sotto: fra i campi che si
  // salvano ci sono i MATERIALI, e sull'ACI quelli li trascrive l'amministratore
  // dalle dichiarazioni cartacee che gli impianti mandano via email. Riscriverli
  // coi numeri del portale non e' un doppione, e' una perdita.
  const scrivibile = (canale) => canaliDaScrivere.includes(canale);
  for (const t of esito.trovati) {
    if (!scrivibile(t.canale)) continue;
    const d = t.dichiarazione;
    const campi = { caricata_inviata: true, caricata_il: t.caricata_il, ...t.materiali };
    const cambia = Object.entries(campi).some(([c, v]) => (c === 'caricata_inviata' ? !d[c] : Math.round(num(d[c])) !== Math.round(num(v))));
    if (!cambia) continue;
    await svc.DichiarazioneSito.update(d.id, campi);
    // Piu' mesi caricati insieme lo dicono, coi loro nomi (difetto 13 della prova
    // del cambio d'anno, 15/10/2026), e se i materiali non si sono potuti leggere
    // mese per mese lo dicono anche (seconda revisione del 15/10/2026).
    aggiornate.push({ sito: t.sito, canale: t.canale, provenienza: d.provenienza || '', mese: d.mese, kg: Math.round(num(d.quantita_kg)), caricata_il: t.caricata_il, riprese: t.date.length, gia_segnata: !!d.caricata_inviata, ...(t.insieme ? { insieme_all_altra_provenienza: true } : {}), ...(t.insieme_mesi ? { insieme_ad_altri_mesi: t.insieme_mesi } : {}), ...(t.materiali_non_letti ? { materiali_non_scritti: t.materiali_non_letti } : {}) });
  }
  return { anno: annoNum, aggiornate, non_trovate: esito.non_trovate, arretrato: esito.arretrato, da_inserire: esito.da_inserire };
}
