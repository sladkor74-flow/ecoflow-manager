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
 *
 * segna() restituisce la chiave dell'impianto a cui il carico si aggiunge, o
 * null se non si aggiunge: chi tiene altri conti (le classi, nelle Giacenze) li
 * tiene sulla stessa decisione, senza riscriverla.
 *
 * @param {string} p.foto            il giorno della fotografia (giornoFotografia)
 * @param {object} p.portaleConosce  ordiniNotiAlPortale(), con file e report gia' segnati
 * @param {function} p.chiaveDi      il normalizzatore dei nomi
 * @param {Set} p.nonDichiaraRete    i siti che per accordo la rete non la dichiarano
 */
export function carichiNonNelFile({ foto, portaleConosce, chiaveDi = (s) => String(s || '').trim().toLowerCase(), nonDichiaraRete = new Set() } = {}) {
  const inizio = inizioAggiunti(foto);
  const per = new Map();
  return {
    segna(r, tipo = 'primaria') {
      if (!foto || !r || !eTerminato(r) || eAci(r)) return null;
      // Un carico arrivato al piazzale non e' all'impianto, primaria o secondaria
      // che sia: la dichiara chi lo ricevera' dal piazzale.
      const dove = ingressoMovimento(r, tipo === 'secondaria' ? 'Secondaria' : 'PrimariaRete', chiaveDi);
      if (!dove.arrivo || dove.arrivo.ruolo !== 'imp' || dove.canale !== 'RETE') return null;
      const giorno = giornoRoma(r.trasporto_finito_il);
      if (!giorno || giorno < inizio || (portaleConosce && portaleConosce.noto(r, tipo))) return null;
      const ns = chiaveDi(r.destinazione);
      if (!ns || nonDichiaraRete.has(ns)) return null;
      if (!per.has(ns)) per.set(ns, []);
      per.get(ns).push({
        tipo, id_ordine: r.id_ordine || '', numero_fir: r.numero_fir || '',
        fine_trasporto: giorno, kg: Number(r.peso_effettivo) || 0,
        da: tipo === 'secondaria' ? (r.stoccaggio || '') : (r.trasportatore || ''),
      });
      return ns;
    },
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
