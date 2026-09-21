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
import { giornoRoma } from "./giornoItaliano.ts";
import { fetchAll } from "./fetchAll.ts";

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

const num = (v) => Number(v) || 0;
// Il giorno italiano: tagliare la stringa UTC spostava al giorno prima una data
// salvata a mezzanotte italiana.
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
  const per = new Map(); // impianto -> Map(data -> { kg, materiali })
  for (const r of righe) {
    if (canale && canaleRigaPortale(r) !== canale) continue;
    if (provenienza && provenienzaRigaPortale(r) !== provenienza) continue;
    const data = giorno(r.data_dichiarazione);
    if (!data || Number(data.slice(0, 4)) !== Number(anno)) continue;
    const sito = String(r.destinazione_secondaria || '').trim() || String(r.destinazione || '').trim();
    if (!sito) continue;
    if (!per.has(sito)) per.set(sito, new Map());
    const perGiorno = per.get(sito);
    if (!perGiorno.has(data)) perGiorno.set(data, { data, kg: 0, materiali: {} });
    const c = perGiorno.get(data);
    c.kg += num(r.peso_associato_kg);
    for (const [dal, al] of MATERIALI_PORTALE) c.materiali[al] = (c.materiali[al] || 0) + num(r[dal]);
  }
  const esito = new Map();
  for (const [sito, perGiorno] of per) {
    esito.set(sito, [...perGiorno.values()]
      .map(c => ({ data: c.data, kg: Math.round(c.kg), materiali: Object.fromEntries(Object.entries(c.materiali).map(([k, v]) => [k, Math.round(v)])) }))
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
  const avanzi = caricamenti.filter((_, i) => !usati.has(i));
  return { trovati, senzaRiscontro, avanzi };
}

/** Piu' elenchi di caricamenti dello stesso impianto, sommati giorno per giorno. */
function unisciPerGiorno(...liste) {
  const per = new Map();
  for (const c of liste.flat()) {
    if (!per.has(c.data)) per.set(c.data, { data: c.data, kg: 0, materiali: {} });
    const t = per.get(c.data);
    t.kg += c.kg;
    for (const [k, v] of Object.entries(c.materiali || {})) t.materiali[k] = (t.materiali[k] || 0) + v;
  }
  return [...per.values()].sort((a, b) => a.data.localeCompare(b.data));
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
    t.dichiarazione.righe.forEach((d, i) => trovati.push({ dichiarazione: d, date: t.date, caricata_il: t.caricata_il, materiali: quote[i], insieme: true }));
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
export async function allineaDalPortale(svc, anno, righePortale = null, nostreRighe = null) {
  const annoNum = Number(anno);
  const righe = righePortale || await fetchAll(svc.DichiarazioneTrattamento, null, 'id');
  // Tutte le pagine: una lettura da 500 righe, con quindici impianti, dodici mesi
  // e fino a quattro flussi ciascuno, poteva lasciare fuori dichiarazioni vere.
  const nostre = nostreRighe || await fetchAll(svc.DichiarazioneSito, { anno: annoNum }, 'id');

  const aggiornate = [];
  const nonTrovate = [];
  const arretrato = [];
  for (const canale of ['RETE', 'ACI']) {
    const perSito = perChiave(caricamentiPortale(righe, annoNum, canale));
    const perProvenienza = canale === 'ACI'
      ? Object.fromEntries(PROVENIENZE_ACI.map(p => [p, perChiave(caricamentiPortale(righe, annoNum, 'ACI', p))]))
      : null;

    for (const [k, { nome, lista }] of perSito) {
      const mie = nostre.filter(d => chiave(d.sito) === k && (d.canale || 'RETE') === canale);
      if (!mie.length) { arretrato.push({ sito: nome, canale, caricamenti: lista.length, kg: lista.reduce((s, c) => s + c.kg, 0), motivo: `nessuna nostra dichiarazione ${canale === 'ACI' ? 'ACI' : 'di rete'} per questo impianto` }); continue; }
      const { trovati, senzaRiscontro, avanzi } = perProvenienza
        ? agganciaAci(mie, perProvenienza.primaria.get(k)?.lista, perProvenienza.secondaria.get(k)?.lista)
        : agganciaMesi(mie, lista);
      for (const t of trovati) {
        const d = t.dichiarazione;
        const campi = { caricata_inviata: true, caricata_il: t.caricata_il, ...t.materiali };
        const cambia = Object.entries(campi).some(([c, v]) => (c === 'caricata_inviata' ? !d[c] : Math.round(num(d[c])) !== Math.round(num(v))));
        if (!cambia) continue;
        await svc.DichiarazioneSito.update(d.id, campi);
        aggiornate.push({ sito: nome, canale, provenienza: d.provenienza || '', mese: d.mese, kg: Math.round(num(d.quantita_kg)), caricata_il: t.caricata_il, riprese: t.date.length, gia_segnata: !!d.caricata_inviata, ...(t.insieme ? { insieme_all_altra_provenienza: true } : {}) });
      }
      for (const n of senzaRiscontro) nonTrovate.push({ sito: nome, canale, provenienza: n.provenienza || '', mese: n.mese, kg: Math.round(num(n.quantita_kg)), era_segnata: !!n.caricata_inviata });
      if (avanzi.length) arretrato.push({ sito: nome, canale, caricamenti: avanzi.length, kg: avanzi.reduce((s, c) => s + c.kg, 0), motivo: 'caricamenti senza un nostro mese: arretrato dell\'anno prima' });
    }
  }
  return { anno: annoNum, aggiornate, non_trovate: nonTrovate, arretrato };
}
