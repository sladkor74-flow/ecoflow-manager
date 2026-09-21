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
 * I caricamenti del portale, uno per impianto e per giorno.
 * `chi tratta` e' la destinazione secondaria quando c'e', altrimenti la
 * destinazione: la destinazione finale e' invece dove e' finito il prodotto -
 * le cementerie - e non e' chi dichiara.
 *
 * Con `canale` ('RETE' o 'ACI') si contano solo le righe di quel canale. Un
 * impianto puo' caricare lo stesso giorno la dichiarazione di rete e quella ACI:
 * sommate, il caricamento del giorno non tornava con nessun nostro mese di rete,
 * il mese restava "senza riscontro" e il caricamento finiva fra l'arretrato.
 */
export function caricamentiPortale(righe, anno, canale = '') {
  const per = new Map(); // impianto -> Map(data -> { kg, materiali })
  for (const r of righe) {
    if (canale && canaleRigaPortale(r) !== canale) continue;
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

/** Le stesse ragioni sociali scritte in modo diverso non devono separarsi. */
const chiave = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * Allinea le nostre dichiarazioni a quelle caricate a portale, canale per
 * canale: segna quali sono caricate, con che data, e scrive i materiali che ne
 * sono usciti. Le righe ACI del report si agganciano solo alle nostre
 * dichiarazioni ACI e quelle di rete solo alle nostre di rete; l'extra raccolta
 * a portale non c'e'. Non toglie mai una spunta messa a mano: se un nostro mese
 * non si ritrova, lo dice e basta.
 */
export async function allineaDalPortale(svc, anno, righePortale = null, nostreRighe = null) {
  const annoNum = Number(anno);
  const righe = righePortale || await leggiTutto(svc.DichiarazioneTrattamento);
  const nostre = nostreRighe || await svc.DichiarazioneSito.filter({ anno: annoNum }, 'id', 500, 0);

  const aggiornate = [];
  const nonTrovate = [];
  const arretrato = [];
  for (const canale of ['RETE', 'ACI']) {
    const perSito = new Map(); // chiave -> { nome, caricamenti }
    for (const [sito, lista] of caricamentiPortale(righe, annoNum, canale)) perSito.set(chiave(sito), { nome: sito, lista });

    for (const [k, { nome, lista }] of perSito) {
      const mie = nostre.filter(d => chiave(d.sito) === k && (d.canale || 'RETE') === canale);
      if (!mie.length) { arretrato.push({ sito: nome, canale, caricamenti: lista.length, kg: lista.reduce((s, c) => s + c.kg, 0), motivo: `nessuna nostra dichiarazione ${canale === 'ACI' ? 'ACI' : 'di rete'} per questo impianto` }); continue; }
      const { trovati, senzaRiscontro, avanzi } = agganciaMesi(mie, lista);
      for (const t of trovati) {
        const d = t.dichiarazione;
        const campi = { caricata_inviata: true, caricata_il: t.caricata_il, ...t.materiali };
        const cambia = Object.entries(campi).some(([c, v]) => (c === 'caricata_inviata' ? !d[c] : Math.round(num(d[c])) !== Math.round(num(v))));
        if (!cambia) continue;
        await svc.DichiarazioneSito.update(d.id, campi);
        aggiornate.push({ sito: nome, canale, mese: d.mese, kg: Math.round(num(d.quantita_kg)), caricata_il: t.caricata_il, riprese: t.date.length, gia_segnata: !!d.caricata_inviata });
      }
      for (const n of senzaRiscontro) nonTrovate.push({ sito: nome, canale, mese: n.mese, kg: Math.round(num(n.quantita_kg)), era_segnata: !!n.caricata_inviata });
      if (avanzi.length) arretrato.push({ sito: nome, canale, caricamenti: avanzi.length, kg: avanzi.reduce((s, c) => s + c.kg, 0), motivo: 'caricamenti senza un nostro mese: arretrato dell\'anno prima' });
    }
  }
  return { anno: annoNum, aggiornate, non_trovate: nonTrovate, arretrato };
}

async function leggiTutto(entita) {
  const PAGINA = 1000;
  let skip = 0;
  let tutto = [];
  for (let p = 0; p < 100; p++) {
    const blocco = await entita.list('id', PAGINA, skip);
    tutto = tutto.concat(blocco);
    if (blocco.length < PAGINA) break;
    skip += PAGINA;
  }
  return tutto;
}
