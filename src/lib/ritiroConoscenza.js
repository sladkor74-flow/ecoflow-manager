// TORNA AL TESTO VERIFICATO: ritirare un aggiornamento normativo approvato per
// errore (segnalazione alta A75 del 20/09/2026, corretta il 12/10/2026).
//
// Un aggiornamento approvato prende il posto di una voce verificata della base di
// conoscenza, e da quel momento entra in ogni risposta di EcoTyna, nel controllo
// dei documenti di qualifica, nel controllo mensile e nel corso. Se lo si
// approvava per errore non c'era modo di toglierlo: nella pagina non sta fra le
// «Aggiunte», accanto al badge «Aggiornata il» non c'era nessun comando, e
// «Rimetti in uso» gli era negato. Si ritira come mettiDaParte
// (base44/shared/baseConoscenza.ts): non si cancella, va fra le messe da parte con
// attiva = false e il motivo, che e' obbligatorio perche' e' l'unica spiegazione
// che resta a chi rilegge lo storico mesi dopo. Un aggiornamento ritirato a mano
// si puo' rimettere in uso; uno superato da qualcosa di piu' recente no, perche'
// il controllo successivo (scartaSuperate) lo rimetterebbe da parte.
//
// Funzioni pure: la pagina (src/components/assistente/BaseConoscenza.jsx) scrive,
// prove/baseConoscenzaRitiro.mjs controlla.

export const RITIRATO = 'ritirato a mano';

/** true se la voce e' stata ritirata con «Torna al testo verificato». */
export const ritiratoAMano = (v) => String((v && v.motivo_scarto) || '').startsWith(RITIRATO);

/**
 * Gli aggiornamenti da ritirare per tornare al testo verificato di una voce del
 * codice, con i campi da scrivere e la nota dello storico. Tutti quelli attivi
 * della voce, non solo quello che si vede: se ne restasse attivo un altro
 * prenderebbe il suo posto, e il pulsante dice «torna al testo verificato».
 * Senza motivo non si ritira niente.
 */
export function ritiroAggiornamenti(voci, voceId, { motivo, utente, adesso }) {
  const m = String(motivo || '').trim();
  if (!m) throw new Error('Scrivi perché ritiri l\'aggiornamento: il motivo resta nello storico.');
  const perche = `${RITIRATO} da ${utente || 'un utente'}, si torna al testo verificato: ${m}`;
  return (Array.isArray(voci) ? voci : [])
    .filter(x => x && x.stato === 'approvata' && x.attiva !== false && x.tipo === 'aggiornamento_normativo' && x.voce_id === voceId)
    .map(x => ({ voce: x, campi: { attiva: false, motivo_scarto: perche, messa_da_parte_il: adesso }, nota: `messa da parte: ${perche}` }));
}

/**
 * Se una voce messa da parte si puo' rimettere in uso: le aggiunte (FAQ, regole
 * interne) si', gli aggiornamenti di una voce verificata solo se ritirati a mano.
 */
export const puoTornareInUso = (v) => !!v && v.stato === 'approvata' && (!(v.tipo === 'aggiornamento_normativo' && v.voce_id) || ritiratoAMano(v));
