// Fino a quando si programmano le secondarie di un anno, quando l'impianto non ha
// una sua data di fine. Il 18 dicembre vale SOLO per il 2026 (direzione,
// 20/09/2026); per gli altri anni la data va comunicata e aggiunta qui. Finche'
// manca si ripiega sul 31 dicembre e lo si dice: meglio un avviso che una data
// inventata, o un modulo che si spegne da solo.
//
// Dal 27/09/2026 la data dell'anno si scrive in Target & Status, sul contratto
// Ecotyre dell'anno (CommessaEcotyre.fine_programmazione): quando c'e' vale lei.
// Una data che non e' di quell'anno, o il contratto di un altro anno, non conta.
const FINE_PROGRAMMAZIONE = { 2026: '2026-12-18' };

const dataDelContratto = (a, commessa) => {
  if (!commessa || (commessa.anno && Number(commessa.anno) !== a)) return '';
  const d = String(commessa.fine_programmazione || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && Number(d.slice(0, 4)) === a ? d : '';
};

/** La fine della programmazione dell'anno: { data, definita }. commessa e' il CommessaEcotyre dell'anno, se c'e'. */
export function fineProgrammazione(anno, commessa = null) {
  const a = Number(anno);
  const dalContratto = dataDelContratto(a, commessa);
  if (dalContratto) return { data: dalContratto, definita: true };
  return FINE_PROGRAMMAZIONE[a] ? { data: FINE_PROGRAMMAZIONE[a], definita: true } : { data: `${a}-12-31`, definita: false };
}

export const avvisoFineProgrammazione = (anno, commessa = null) => (fineProgrammazione(anno, commessa).definita ? '' : `La data di fine programmazione del ${anno} non e' ancora stata definita: si usa il 31 dicembre. Scrivila in Target & Status, scheda Impianti e stoccaggi, nel riquadro del contratto Ecotyre dell'anno.`);
