/**
 * VALE SOLO L'ULTIMA RICHIESTA PARTITA.
 *
 * Una tabella con i filtri puo' avere due letture in volo nello stesso momento:
 * una senza filtro, partita appena la tabella e' comparsa, e una col filtro,
 * partita un istante dopo. Quella col filtro e' piu' leggera e torna per prima;
 * quella senza filtro torna dopo e si prende lo schermo. Il filtro resta scritto
 * nel menu a tendina e i dati sotto sono di tutti.
 *
 * Successo davvero (08/10/2026): in Giacenze, aprendo «da dichiarare» dal
 * pulsante di T-Cycle nella scheda Situazione, l'elenco mostrava 998 ordini di
 * tutti gli impianti sotto il filtro «T-CYCLE INDUSTRIES SRL». Su quell'elenco
 * si decide che cosa dichiarare: dichiarare a un impianto dei carichi finiti
 * altrove e' un errore grosso, e non si vedeva.
 *
 * Uso:
 *   const seq = useRef(creaSequenza()).current;
 *   const mia = seq.inizia();
 *   const res = await ...;
 *   if (!seq.valida(mia)) return;   // ne e' partita una piu' recente
 */
export function creaSequenza() {
  let ultima = 0;
  return {
    /** Segna una richiesta nuova e restituisce il suo numero. */
    inizia: () => ++ultima,
    /** Vero se quella richiesta e' ancora l'ultima partita. */
    valida: (numero) => numero === ultima,
  };
}
