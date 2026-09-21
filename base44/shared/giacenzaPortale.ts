// La giacenza di rete a portale di un impianto, aggiornata a ogni caricamento.
//
// Il portale la da' nel file degli ordini non dichiarati: e' una fotografia, del
// giorno in cui il file e' stato caricato. Ma a ogni caricamento dei movimenti la
// giacenza cambia, per entrate e per uscite, e i moduli la devono seguire
// (regola dell'utente, 21/09/2026). Percio':
//
//   giacenza a portale = fotografia
//                        + i carichi che il gestionale conosce e il file no
//                        - le dichiarazioni caricate a portale dopo la fotografia
//
// Che cosa il portale conosce si decide dal NUMERO D'ORDINE, cercato fra gli
// ordini non dichiarati e nel report delle dichiarazioni: mai dalla data di
// chiusura dell'ordine a portale, che in nessun modulo decide nulla. Tutte le
// date sono giorni italiani di fine trasporto.
//
// La usano Dichiarazioni Impianti e Giacenze, cosi' i due moduli non possono
// dare numeri diversi.
import { giornoRoma } from "./giornoItaliano.ts";

/** Il giorno della fotografia: quello dell'ultimo file degli ordini non dichiarati caricato. */
export function giornoFotografia(nonDichiarati) {
  let max = '';
  for (const r of nonDichiarati || []) {
    const g = giornoRoma(r.created_date);
    if (g > max) max = g;
  }
  return max;
}

/**
 * Gli ordini che il portale conosce. Si segnano le righe degli ordini non
 * dichiarati e del report delle dichiarazioni; poi si chiede di un movimento.
 */
export function ordiniNotiAlPortale() {
  const primarie = new Set();
  const secondarie = new Set();
  return {
    segna(r) {
      const p = String(r && r.ordine_primaria || '').trim();
      const s = String(r && r.ordine_secondaria || '').trim();
      if (p) primarie.add(p);
      if (s) secondarie.add(s);
    },
    /** Vero se il portale conosce il movimento: una primaria o una secondaria. */
    noto(movimento, tipo = 'primaria') {
      const id = String(movimento && movimento.id_ordine || '').trim();
      return !!id && (tipo === 'secondaria' ? secondarie.has(id) : primarie.has(id));
    },
  };
}

/**
 * Le dichiarazioni di rete caricate a portale dopo la fotografia, per sito: il
 * file del portale le conta ancora come giacenza, il gestionale no.
 * @param {array} dichiarazioniSito  record DichiarazioneSito
 * @param {string} foto              giorno della fotografia
 * @param {function} chiaveDi        normalizzazione della ragione sociale
 * @param {number} primaDelMese      facoltativo: solo i mesi prima di questo (0-11)
 */
export function dichiaratoDopoLaFotografia(dichiarazioniSito, foto, chiaveDi, primaDelMese = 12) {
  const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
  const per = new Map();
  if (!foto) return per;
  for (const d of dichiarazioniSito || []) {
    if ((d.canale || 'RETE') !== 'RETE' || d.provenienza) continue;
    if (!d.caricata_inviata || !(String(d.caricata_il || '').slice(0, 10) > foto)) continue;
    if (MESI.indexOf(d.mese) >= primaDelMese) continue;
    const ns = chiaveDi(d.sito);
    if (ns) per.set(ns, (per.get(ns) || 0) + (Number(d.quantita_kg) || 0));
  }
  return per;
}
