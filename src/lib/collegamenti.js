// I COLLEGAMENTI CHE PORTANO LA SCHEDA E IL PERIODO (11/10/2026).
//
// La chiusura del mese e la dashboard portano al punto dove si lavora, non
// all'ingresso del modulo: /fatturazione?tab=passiva&anno=2026&mese=Settembre&canale=ACI
// apre la passiva ACI di settembre 2026. Prima i parametri si perdevano e il
// modulo si apriva sulla scheda e sul mese di sempre.
//
// Un parametro che non si capisce si ignora: la pagina si apre come sempre, mai
// su un anno o un mese inventato. Il mese si accetta col nome (come lo scrivono
// le pagine, «Settembre») o col numero 1-12.
import { MESI_PAGINE } from './periodoPagine.js';

const CANALI = ['RETE', 'ACI', 'EXTRA_RACCOLTA'];

/** Il mese col nome delle pagine, da un nome o da un numero 1-12; null se non e' un mese. */
export function meseDaParametro(valore) {
  const m = String(valore ?? '').trim();
  if (/^\d{1,2}$/.test(m)) {
    const n = Number(m);
    return n >= 1 && n <= 12 ? MESI_PAGINE[n - 1] : null;
  }
  const i = MESI_PAGINE.findIndex(x => x.toLowerCase() === m.toLowerCase());
  return i >= 0 ? MESI_PAGINE[i] : null;
}

/**
 * Scheda, anno, mese e canale dall'indirizzo. `schede` sono le schede che la
 * pagina ha davvero (per chi la guarda): una scheda che non c'e' vale null.
 */
export function leggiCollegamento(search, schede = []) {
  const p = new URLSearchParams(search || '');
  const tab = p.get('tab');
  const n = Number(p.get('anno'));
  const anno = p.get('anno') && Number.isInteger(n) && n >= 2000 && n <= 2100 ? n : null;
  const c = String(p.get('canale') || '').trim().toUpperCase();
  return {
    tab: tab && schede.includes(tab) ? tab : null,
    anno,
    mese: meseDaParametro(p.get('mese')),
    canale: CANALI.includes(c) ? c : null,
  };
}

/** Il periodo { anno, mese } del collegamento, o quello di riserva se non c'e' tutto. */
export function periodoDelCollegamento(collegamento, riserva) {
  return collegamento && collegamento.anno && collegamento.mese
    ? { anno: collegamento.anno, mese: collegamento.mese }
    : riserva;
}
