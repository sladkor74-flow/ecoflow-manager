// Il canale di una secondaria.
//
// Il portale esporta le secondarie in un unico file: dentro ci sono sia quelle
// della rete sia quelle ACI, e a distinguerle c'e' solo la classe del materiale.
// L'autodemolizione e' la classe 9 - "PFU Autodemolizione", codice prodotto
// ".class9" - e tutto il resto (P, M, G1, G2) e' rete.
//
// Rete e ACI sono canali indipendenti: contratti, tariffe e obiettivi diversi.
// Non vanno sommati in nessun conteggio, in nessuna pivot e in nessuna fattura,
// nemmeno quando lo stesso viaggio porta formulari dei due canali - il portale
// emette comunque un ordine e un formulario per ciascuno.
//
// Specchio nel frontend: src/lib/canaleSecondaria.js.

const ACI = /autodemoliz|class ?9|\baci\b/i;

/** Vero se la secondaria (o la primaria, o l'extra) e' del canale ACI. */
export function eAci(r) {
  if (!r) return false;
  return ACI.test(`${r.classe || ''} ${r.prodotto || ''} ${r.codice_prodotto || ''}`);
}

/** 'ACI' oppure 'RETE'. */
export const canaleDi = (r) => (eAci(r) ? 'ACI' : 'RETE');

/** Le righe di un solo canale: soloCanale(righe, 'ACI'). */
export function soloCanale(righe, canale) {
  const aci = String(canale).toUpperCase() === 'ACI';
  return (righe || []).filter(r => eAci(r) === aci);
}
