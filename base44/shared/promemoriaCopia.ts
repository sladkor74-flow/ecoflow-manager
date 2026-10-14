// IL PROMEMORIA DELLA COPIA DI SICUREZZA (14/10/2026).
//
// Migliorie approvate dall'utente il 14/10/2026 («per me ok ... su quanto da
// creare, procedi pure»): una copia di sicurezza di tutti gli archivi, per
// esempio ogni settimana, scaricata dall'amministratore da Caricamento Dati
// (src/lib/copiaSicurezza.js). Una copia che nessuno si ricorda di fare non
// serve: se negli ultimi sette giorni non ce n'e' nessuna, «Da gestire» lo dice.
//
// La regola e' qui, pura e senza letture; la riga del registro (CopiaSicurezza,
// la piu' recente) la legge chi chiama, con una lettura sola di una riga.
// Tre cose da non sbagliare:
// - una lettura che non c'e' stata o non e' riuscita non e' «mai fatta»: un
//   valore mancante non e' zero, e la voce non si dice (righe null o undefined);
// - la copia la scarica solo l'amministratore, quindi la voce e' solo sua: a
//   chi non lo e' non si chiede una cosa che non puo' fare;
// - i giorni sono quelli italiani: la copia del lunedi' sera alle 23:30 e' del
//   lunedi', anche se in UTC e' gia' martedi'.
// Prova: prove/copiaSicurezza.mjs (0, 6, 7 e 8 giorni, mai fatta, non letta).
import { giornoRoma } from "./giornoItaliano.ts";

/** Dopo quanti giorni dall'ultima copia la dashboard la ricorda. */
export const GIORNI_COPIA = 7;
/** Da quanti giorni il promemoria passa da «info» ad «attenzione». */
export const GIORNI_COPIA_ATTENZIONE = 14;
export const AREA_COPIA = 'Copia di sicurezza';
export const LINK_COPIA = '/caricamento-dati#copia-sicurezza';
export const CHIAVE_COPIA = 'copia-sicurezza';

const GIORNO = /^\d{4}-\d{2}-\d{2}$/;
// created_date arriva in UTC senza la Z finale: si rimette, poi si prende il giorno italiano.
const conZ = (v) => String(v).replace(/(Z|[+-]\d{2}:?\d{2})?$/, 'Z');
const it = (g) => String(g).split('-').reverse().join('/');
const giorniFra = (dal, al) => Math.round((Date.parse(`${al}T12:00:00Z`) - Date.parse(`${dal}T12:00:00Z`)) / 86400000);

/** Il giorno italiano di una riga del registro: il suo campo giorno, o quello della fine lettura o della creazione. */
export function giornoDellaCopia(riga) {
  if (!riga) return '';
  if (GIORNO.test(String(riga.giorno || ''))) return String(riga.giorno);
  const istante = riga.il || riga.created_date;
  return istante ? giornoRoma(conZ(istante)) : '';
}

const DETTAGLIO = 'La copia raccoglie in un file tutti gli archivi del gestionale e resta sul tuo PC: '
  + 'si scarica da Caricamento Dati, nella sezione «Copia di sicurezza», e ci vogliono pochi minuti. Conviene farla una volta alla settimana.';

/**
 * La voce di «Da gestire» per la copia di sicurezza: nessuna, o una.
 * righe: l'esito della lettura del registro (la riga piu' recente, o nessuna);
 * null o undefined se la lettura non c'e' stata o non e' riuscita.
 * oggi: il giorno italiano 'aaaa-mm-gg'. amministratore: chi guarda lo e'.
 */
export function vociPromemoriaCopia({ righe, oggi, amministratore }) {
  if (!amministratore || !Array.isArray(righe) || !GIORNO.test(String(oggi || ''))) return [];
  // La piu' recente, anche se chi chiama ne passa piu' d'una o non in ordine.
  const ultima = righe.filter(Boolean)
    .map(r => ({ r, g: giornoDellaCopia(r), t: String(r.il || r.created_date || '') }))
    .sort((a, b) => (a.g === b.g ? (a.t < b.t ? 1 : a.t > b.t ? -1 : 0) : a.g < b.g ? 1 : -1))[0] || null;
  const voce = (gravita, titolo, dettaglio, firma) => ({
    area: AREA_COPIA, gravita, titolo, dettaglio, link: LINK_COPIA, chiave: CHIAVE_COPIA, sezione: 'dati',
    // Nascosta, torna con una copia nuova o quando cambia la gravita', non
    // perche' i giorni crescono ogni mattina.
    firma, misure: [],
  });
  if (!ultima) {
    return [voce('attenzione', 'Non è mai stata scaricata una copia di sicurezza: scaricane una', DETTAGLIO, 'mai')];
  }
  if (!ultima.g) {
    return [voce('attenzione', 'Non si legge il giorno dell\'ultima copia di sicurezza: scaricane una', DETTAGLIO, 'senza-giorno')];
  }
  const nonLetti = Number(ultima.r.non_letti) || 0;
  if (nonLetti > 0) {
    // Quali, quando il registro lo sa (archivi_non_letti, revisione del 15/10/2026).
    const quali = String(ultima.r.archivi_non_letti || '').trim();
    return [voce('attenzione', `L'ultima copia di sicurezza, del ${it(ultima.g)}, è senza ${nonLetti === 1 ? 'un archivio' : `${nonLetti} archivi`}: scaricane una completa`,
      `Quando è stata fatta ${nonLetti === 1 ? 'un archivio non si è letto' : `${nonLetti} archivi non si sono letti`}${quali ? ` (${quali})` : ''}, e il file non ${nonLetti === 1 ? 'lo contiene' : 'li contiene'}. ${DETTAGLIO}`, `incompleta:${ultima.g}`)];
  }
  const giorni = giorniFra(ultima.g, oggi);
  // Una copia con un giorno dopo oggi (un orologio avanti) non e' vecchia.
  if (!(giorni >= GIORNI_COPIA)) return [];
  return [voce(giorni >= GIORNI_COPIA_ATTENZIONE ? 'attenzione' : 'info', `L'ultima copia di sicurezza è del ${it(ultima.g)}: scaricane una`,
    `Sono passati ${giorni} giorni. ${DETTAGLIO}`, ultima.g)];
}
