// DOVE ENTRA UN MOVIMENTO: SITO, RUOLO E CANALE, DECISI IN UN PUNTO SOLO
// (chiusura dell'audit, 11/10/2026).
//
// Giacenze e Dichiarazioni Impianti leggono gli stessi formulari e devono dire
// gli stessi numeri su tutti e tre i canali (regola dell'utente, 03/10/2026).
// Ciascuno pero' decideva da se' dove un movimento entra, e le due risposte si
// erano separate (audit del 10/10/2026):
// - una secondaria arrivata al PIAZZALE di un sito che e' anche impianto stava
//   sul piazzale nelle Giacenze e sull'impianto nelle Dichiarazioni, che il tipo
//   di destinazione non lo guardavano: lo stesso viaggio cambiava l'entrato
//   della quadratura e la giacenza ACI dell'impianto (C2);
// - una secondaria di extra raccolta arrivata a un piazzale puro faceva di quel
//   piazzale, nelle Dichiarazioni, un impianto che deve dichiarare, e nelle
//   Giacenze entrava nel conferito del piazzale ma non nella sua giacenza (C9);
// - le terziarie erano rete in un modulo e un gruppo a parte nell'altro (C3).
// Qui la risposta e' una sola, e i due moduli la chiedono a questo file.
//
// LE REGOLE:
// - il RUOLO di chi riceve lo dice il tipo di destinazione del formulario:
//   'stoc' e' il piazzale, tutto il resto l'impianto. Un formulario senza tipo si
//   tratta da impianto e si dice (senza_tipo): meglio il numero giusto con un
//   avviso che un numero sbagliato in silenzio (audit del 03/10/2026);
// - il CANALE lo decide il materiale, non l'archivio (canaleMovimento): una
//   classe 9 fra le primarie di rete e' ACI, l'extra raccolta e' extra raccolta;
// - una SECONDARIA parte sempre da un piazzale - lo stoccaggio, che in quel
//   viaggio e' il produttore - e arriva dove dice il suo tipo di destinazione:
//   anche a un altro piazzale, anche quella di extra raccolta;
// - una TERZIARIA parte dall'impianto verso le cementerie e non arriva a nessuno
//   dei nostri: il suo gruppo e' TERZIARIE, mai un canale.
//
// Chi legge decide il resto - il periodo, lo stato, che cosa sommare - con le
// sue regole di sempre (shared/movimenti.ts): qui si dice solo DOVE.
import { canaleMovimento } from "./movimenti.ts";
import { GRUPPO_TERZIARIE } from "./giacenzaPortale.ts";

const pulito = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/** Vero se l'intervento di extra raccolta e' un trasferimento da un piazzale: senza il campo e' una primaria. */
export const eSecondariaExtra = (r) => String((r && r.tipo_movimento) || '').toLowerCase().trim() === 'secondaria';

/**
 * Dove entra e da dove parte un movimento.
 *
 * @param {object} r         il formulario (PrimariaRete, PrimariaAci, ExtraRaccolta, Secondaria o Terziaria)
 * @param {string} archivio  il nome dell'archivio da cui viene: 'PrimariaRete', 'PrimariaAci',
 *                           'ExtraRaccolta', 'Secondaria' o 'Terziaria'
 * @param {function} chiaveDi il normalizzatore dei nomi, lo stesso del chiamante
 * @returns {{ tipo, canale, arrivo, partenza, senza_tipo }}
 *   tipo        'primaria' | 'secondaria' | 'terziaria'
 *   canale      'RETE' | 'ACI' | 'EXTRA_RACCOLTA', o 'TERZIARIE' per una terziaria
 *   arrivo      { sito, chiave, ruolo } di chi riceve, null se non c'e' (o e' una terziaria)
 *   partenza    { sito, chiave, ruolo } di chi spedisce, per secondarie e terziarie; null per una primaria
 *   senza_tipo  vero se il formulario non dice il tipo di destinazione (e allora e' impianto)
 */
export function ingressoMovimento(r, archivio, chiaveDi = (s) => pulito(s).toLowerCase()) {
  const posto = (sito, ruolo) => {
    const s = pulito(sito);
    const chiave = s ? chiaveDi(s) : '';
    return chiave ? { sito: s, chiave, ruolo } : null;
  };
  if (archivio === 'Terziaria') {
    return {
      tipo: 'terziaria',
      canale: GRUPPO_TERZIARIE,
      arrivo: null,
      partenza: posto(r && (r.unita_locale_origine || r.ragione_sociale), 'imp'),
      senza_tipo: false,
    };
  }
  const tipoDestinazione = String((r && r.tipo_destinazione) || '').toLowerCase().trim();
  const secondaria = archivio === 'Secondaria' || (archivio === 'ExtraRaccolta' && eSecondariaExtra(r));
  return {
    tipo: secondaria ? 'secondaria' : 'primaria',
    canale: canaleMovimento(r, archivio),
    arrivo: posto(r && r.destinazione, tipoDestinazione === 'stoc' ? 'stoc' : 'imp'),
    partenza: secondaria ? posto(r && r.stoccaggio, 'stoc') : null,
    senza_tipo: !tipoDestinazione,
  };
}
