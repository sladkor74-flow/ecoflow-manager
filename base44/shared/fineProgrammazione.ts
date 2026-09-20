// Fino a quando si programmano le secondarie di un anno, quando l'impianto non ha
// una sua data di fine. Il 18 dicembre vale SOLO per il 2026 (direzione,
// 20/09/2026); per gli altri anni la data va comunicata e aggiunta qui. Finche'
// manca si ripiega sul 31 dicembre e lo si dice: meglio un avviso che una data
// inventata, o un modulo che si spegne da solo.
const FINE_PROGRAMMAZIONE = { 2026: '2026-12-18' };

export function fineProgrammazione(anno) {
  const a = Number(anno);
  return FINE_PROGRAMMAZIONE[a] ? { data: FINE_PROGRAMMAZIONE[a], definita: true } : { data: `${a}-12-31`, definita: false };
}

export const avvisoFineProgrammazione = (anno) => (fineProgrammazione(anno).definita ? '' : `La data di fine programmazione del ${anno} non e' ancora stata definita: si usa il 31 dicembre. Scrivila sull'impianto, in Target & Status.`);
