// L'ELENCO «DA DICHIARARE» E LA GIACENZA A PORTALE: LO STESSO CONTO (chiusura
// dell'audit, 11/10/2026).
//
// Il pulsante «Ordini da dichiarare» della scheda Situazione conta le righe del
// file degli ordini non dichiarati PIU' i carichi che il gestionale conosce e il
// file non ha ancora; l'elenco che il pulsante apre aveva solo le righe del
// file, e il suo totale non aggiungeva quei carichi ne' toglieva le
// dichiarazioni caricate dopo la fotografia. Bastava un carico arrivato dopo
// l'ultimo file - cioe' quasi ogni settimana - perche' pulsante, elenco e
// giacenza dicessero tre numeri diversi, mentre la pagina scriveva che il
// pulsante e l'elenco «dicono lo stesso». L'utente l'elenco l'aveva chiesto
// proprio come riscontro della giacenza (09/10/2026).
//
// Sotto l'elenco ora c'e' la riga di riconciliazione:
//
//   righe del file + carichi non ancora nel file - dichiarato dopo = giacenza
//
// con le stesse regole delle Giacenze e delle Dichiarazioni
// (shared/giacenzaPortale.ts): che cosa il portale conosce lo dice il numero
// d'ordine, i carichi si cercano da inizioAggiunti in avanti, solo la rete,
// solo quello che arriva all'impianto, e chi la rete non la dichiara per
// accordo non ha carichi «in ritardo nel file». La regola dei carichi non
// ancora nel file sta qui una volta sola, e dalla revisione della chiusura
// dell'audit (11/10/2026) la chiedono qui anche calcolaGiacenze e il riepilogo
// delle dichiarazioni, che la scrivevano ciascuno a modo suo: tre copie con lo
// stesso esito finche' nessuno ne cambiava una. Le Giacenze tengono per conto
// loro solo le classi dei carichi aggiunti, che servono a loro sole: segna()
// dice a chi il carico e' stato aggiunto, o null. La prova del 2 gennaio
// (prove/provaDel2Gennaio.mjs) controlla che i numeri dei tre coincidano.
//
// DOVE ARRIVA UN CARICO LO DICE shared/ingressoMovimento.ts, COME NEGLI ALTRI
// DUE MODULI (revisione della chiusura dell'audit, 11/10/2026). Qui si
// escludeva il piazzale solo per le primarie: una secondaria arrivata al
// PIAZZALE di un sito che e' anche impianto finiva fra i carichi dell'impianto,
// mentre Giacenze e Dichiarazioni (C2) la tengono sul piazzale. Irigom con 12 t
// nel file e una secondaria di 8 t da Nappi al suo piazzale: le Giacenze 12 t e
// 1 ordine, la riga che dice «lo stesso numero delle Giacenze» 20.000 kg e 2.
import { giornoRoma } from "./giornoItaliano.ts";
import { eTerminato } from "./movimenti.ts";
import { eAci } from "./canaleSecondaria.ts";
import { inizioAggiunti } from "./giacenzaPortale.ts";
import { ingressoMovimento } from "./ingressoMovimento.ts";

/**
 * Raccoglie, per impianto, i carichi di rete che il gestionale conosce e il file
 * del portale non ha ancora.
 *
 *   const c = carichiNonNelFile({ foto, portaleConosce, chiaveDi: norm, nonDichiaraRete });
 *   for (const r of primarie) c.segna(r, 'primaria');
 *   for (const r of secondarie) c.segna(r, 'secondaria');
 *   c.di(ns) -> { n, kg, ordini: [{ tipo, id_ordine, numero_fir, fine_trasporto, kg, da }] }
 *   c.movimenti() -> [{ ns, tipo, giorno, r }] tutti quelli aggiunti, col formulario
 *
 * segna() restituisce la chiave dell'impianto a cui il carico si aggiunge, o
 * null se non si aggiunge: chi tiene altri conti (le classi, nelle Giacenze) li
 * tiene sulla stessa decisione, senza riscriverla.
 *
 * candidato() e' la stessa decisione senza la domanda al portale: la chiave
 * dell'impianto se il carico si aggiungerebbe nel caso che il portale non lo
 * conosca, null se no. Serve a chi deve ancora chiedere al report delle
 * dichiarazioni se il portale conosce quel numero d'ordine: lo chiede solo per
 * questi, e non per tutte le primarie dell'anno (l'elenco «Da dichiarare»,
 * 15/10/2026). E' segna() senza l'ultima domanda, non una seconda regola.
 *
 * @param {string} p.foto            il giorno della fotografia (giornoFotografia)
 * @param {object} p.portaleConosce  ordiniNotiAlPortale(), con file e report gia' segnati
 * @param {function} p.chiaveDi      il normalizzatore dei nomi
 * @param {Set} p.nonDichiaraRete    i siti che per accordo la rete non la dichiarano
 */
export function carichiNonNelFile({ foto, portaleConosce, chiaveDi = (s) => String(s || '').trim().toLowerCase(), nonDichiaraRete = new Set() } = {}) {
  const inizio = inizioAggiunti(foto);
  const per = new Map();
  const tutti = [];
  const candidato = (r, tipo) => {
    if (!foto || !r || !eTerminato(r) || eAci(r)) return null;
    // Un carico arrivato al piazzale non e' all'impianto, primaria o secondaria
    // che sia: la dichiara chi lo ricevera' dal piazzale.
    const dove = ingressoMovimento(r, tipo === 'secondaria' ? 'Secondaria' : 'PrimariaRete', chiaveDi);
    if (!dove.arrivo || dove.arrivo.ruolo !== 'imp' || dove.canale !== 'RETE') return null;
    const giorno = giornoRoma(r.trasporto_finito_il);
    if (!giorno || giorno < inizio) return null;
    const ns = chiaveDi(r.destinazione);
    if (!ns || nonDichiaraRete.has(ns)) return null;
    return ns;
  };
  return {
    candidato(r, tipo = 'primaria') { return candidato(r, tipo); },
    segna(r, tipo = 'primaria') {
      const ns = candidato(r, tipo);
      if (!ns || (portaleConosce && portaleConosce.noto(r, tipo))) return null;
      const giorno = giornoRoma(r.trasporto_finito_il);
      if (!per.has(ns)) per.set(ns, []);
      per.get(ns).push({
        tipo, id_ordine: r.id_ordine || '', numero_fir: r.numero_fir || '',
        fine_trasporto: giorno, kg: Number(r.peso_effettivo) || 0,
        da: tipo === 'secondaria' ? (r.stoccaggio || '') : (r.trasportatore || ''),
      });
      tutti.push({ ns, tipo, giorno, r });
      return ns;
    },
    /** Tutti i carichi aggiunti, col loro formulario: l'elenco «Da dichiarare» ne fa righe. */
    movimenti() { return tutti.slice(); },
    di(ns) {
      const ordini = [...(per.get(ns) || [])].sort((a, b) => a.fine_trasporto.localeCompare(b.fine_trasporto));
      return {
        n: ordini.length,
        kg: Math.round(ordini.reduce((s, x) => s + x.kg, 0)),
        ordini: ordini.map(o => ({ ...o, kg: Math.round(o.kg) })),
      };
    },
  };
}

/**
 * La riga di riconciliazione di un impianto: quello che il file dice, quello che
 * il file non ha ancora, quello che si e' dichiarato dopo, e la giacenza che ne
 * viene. `ordini_pulsante` e' il numero del pulsante della scheda Situazione.
 */
export function riconciliazioneDaDichiarare({ foto = '', fileOrdini = 0, fileKg = 0, aggiunti = { n: 0, kg: 0, ordini: [] }, dichiaratoDopoKg = 0 } = {}) {
  const file = Math.round(Number(fileKg) || 0);
  const piu = Math.round(Number(aggiunti && aggiunti.kg) || 0);
  const meno = Math.round(Number(dichiaratoDopoKg) || 0);
  return {
    foto_del: foto || null,
    file_ordini: Number(fileOrdini) || 0,
    file_kg: file,
    aggiunti_n: (aggiunti && aggiunti.n) || 0,
    aggiunti_kg: piu,
    aggiunti: (aggiunti && aggiunti.ordini) || [],
    dichiarato_dopo_kg: meno,
    giacenza_kg: file + piu - meno,
    ordini_pulsante: (Number(fileOrdini) || 0) + ((aggiunti && aggiunti.n) || 0),
  };
}

// I CARICHI ARRIVATI DOPO IL FILE SONO RIGHE DELL'ELENCO (15/10/2026).
//
// La domanda dell'utente, testuale: «non capisco perche' ad ottobre in t-cycle
// sono entrati finora 49,04 t e nelle giacenze alla voce di ottobre risulta
// ancora 40,92 t». La giacenza della Situazione (372,92 t) e il pulsante (122)
// contavano i 4 carichi del 12 e 13/10 che il file del portale del 09/10 non ha
// ancora; l'elenco «Da dichiarare», il suo totale e la fascia dei mesi avevano
// solo le righe del file, e i carichi stavano nel «quali sono» della riga di
// riconciliazione, che si vedeva solo arrivando dal pulsante. Per l'utente e' un
// numero vecchio, e lo e': la regola e' che ogni caricamento aggiorna tutti i
// moduli, e Giacenze e Dichiarazioni quadrano come un orologio svizzero. E vale
// per tutti gli impianti, non solo per T-Cycle («altrimenti non c'e' congruenza
// nei dati e nei fatti»).
//
// Percio' l'elenco e' il file del portale PIU' i carichi che il gestionale
// conosce e il file non ha ancora (carichiNonNelFile, qui sopra: la stessa
// regola della giacenza e del riepilogo delle dichiarazioni), MENO quello che si
// e' dichiarato a portale dopo la fotografia. Le due funzioni qui sotto fanno le
// due cose che l'elenco aggiunge al file: tolgono il dichiarato dopo dalle righe
// a cui il portale lo aggancia, e dicono il conto per mese con le sue parti.

/**
 * IL DICHIARATO A PORTALE DOPO IL FILE, SULLE RIGHE DELL'IMPIANTO.
 *
 * Il file del portale conta ancora come da dichiarare le dichiarazioni caricate
 * dopo la sua fotografia (dichiaratoDopoLaFotografia, shared/giacenzaPortale.ts):
 * la giacenza le toglie. Il portale aggancia una dichiarazione agli ordini piu'
 * vecchi ancora aperti, dal carico arrivato da piu' tempo (regola verificata al
 * chilo dall'utente il 09/10/2026, la stessa che usa il riepilogo delle
 * dichiarazioni per quello che il report non ha ancora): qui si tolgono le
 * stesse righe, nello stesso ordine. Una riga tolta del tutto resta nell'elenco
 * con 0 kg da dichiarare e lo dice, perche' il numero del pulsante la conta
 * ancora; quello che avanza dopo l'ultima riga e' una giacenza sotto zero, e si
 * dice a parte (oltre), non si nasconde.
 *
 * @param {Array<{ chiave, ruolo, giorno, kg }>} righe  tutte le righe dell'elenco, file e carichi dopo
 * @param {Map<string, number>} dopoPerSito             chiave dell'impianto -> kg dichiarati dopo la fotografia
 * @returns {{ tolto: Map<object, number>, oltre: Map<string, number> }}
 */
export function scalaDichiaratoDopo(righe, dopoPerSito) {
  const tolto = new Map();
  const oltre = new Map();
  for (const [ns, kg] of dopoPerSito || []) {
    let resta = Number(kg) || 0;
    if (!(resta > 0)) continue;
    // Dal carico arrivato da piu' tempo; quelli senza giorno per ultimi.
    const sue = (righe || []).filter(x => x.chiave === ns && x.ruolo === 'imp')
      .sort((a, b) => (a.giorno || '9999').localeCompare(b.giorno || '9999'));
    for (const x of sue) {
      if (!(resta > 0)) break;
      const via = Math.min(resta, Math.max(0, Number(x.kg) || 0));
      if (via > 0) { tolto.set(x, via); resta -= via; }
    }
    if (resta > 0) oltre.set(ns, resta);
  }
  return { tolto, oltre };
}

/**
 * DI QUALI MESI SONO, CON LE LORO PARTI. Il mese e' quello del giorno in cui il
 * carico e' arrivato al sito a cui il portale lo attribuisce (giornoDelCarico):
 * per una riga passata da uno stoccaggio, la fine trasporto della secondaria,
 * come nel riepilogo delle dichiarazioni. Senza giorno, la chiave vuota.
 *
 * @param {Array<{ giorno, kg, nel_file, ruolo, dichiarato_dopo_kg }>} righe  kg e' quello ancora da dichiarare
 * @returns {Array<{ mese, ordini, kg, dopo_il_file: { ordini, kg }, dichiarato_dopo_kg, imp: { ordini, kg }, stoc: { ordini, kg } }>}
 */
export function contoPerMese(righe) {
  const per = new Map();
  for (const x of righe || []) {
    const chiave = x.giorno ? String(x.giorno).slice(0, 7) : '';
    if (!per.has(chiave)) per.set(chiave, { mese: chiave, ordini: 0, kg: 0, dopo_il_file: { ordini: 0, kg: 0 }, dichiarato_dopo_kg: 0, imp: { ordini: 0, kg: 0 }, stoc: { ordini: 0, kg: 0 } });
    const m = per.get(chiave);
    const kg = Number(x.kg) || 0;
    m.ordini++;
    m.kg += kg;
    if (x.nel_file === false) { m.dopo_il_file.ordini++; m.dopo_il_file.kg += kg; }
    m.dichiarato_dopo_kg += Number(x.dichiarato_dopo_kg) || 0;
    const ruolo = x.ruolo === 'stoc' ? 'stoc' : 'imp';
    m[ruolo].ordini++;
    m[ruolo].kg += kg;
  }
  const tondo = (v) => Math.round(v);
  return [...per.values()]
    .sort((a, b) => (a.mese || '9999-99').localeCompare(b.mese || '9999-99'))
    .map(m => ({
      ...m, kg: tondo(m.kg),
      dopo_il_file: { ordini: m.dopo_il_file.ordini, kg: tondo(m.dopo_il_file.kg) },
      dichiarato_dopo_kg: tondo(m.dichiarato_dopo_kg),
      imp: { ordini: m.imp.ordini, kg: tondo(m.imp.kg) },
      stoc: { ordini: m.stoc.ordini, kg: tondo(m.stoc.kg) },
    }));
}
