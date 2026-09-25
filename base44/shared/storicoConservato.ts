// Lo storico che un caricamento conserva (richiesta dell'utente, 25/09/2026).
//
// Ogni caricamento di primarie, secondarie e terziarie sostituisce l'archivio
// con il file. L'utente pero' vuole mandare i file dal 1 gennaio 2025, perche'
// il portale si ancora al 31/12, e tenere lo stesso il 2024 nel gestionale.
// Cosi' un file che comincia da un anno conserva gli ordini TERMINATI con la
// fine del trasporto negli anni prima: non sono "mancanti", perche' il file non
// poteva contenerli, e non si cancellano.
//
// L'anno e' sempre quello della FINE DEL TRASPORTO, mai l'immissione (regola
// dell'utente). Da qui tre conseguenze, volute:
// - l'anno da cui comincia il file e' la prima fine trasporto dei suoi
//   terminati: gli assegnati, che non hanno fine, non lo spostano indietro;
// - un terminato senza fine trasporto non ha anno e non si conserva: se il file
//   non lo contiene resta "mancante", e il controllo di sempre lo dice;
// - un ordine ancora aperto (assegnato) non si conserva mai: e' il file di oggi
//   a dire se e' ancora aperto.
import { annoRoma } from "./giornoItaliano.ts";
import { eTerminato } from "./movimenti.ts";

/** L'anno della fine trasporto di un record, o null se non c'e'. */
export const annoFine = (r) => annoRoma(r && r.trasporto_finito_il);

/**
 * L'anno da cui comincia un file: la prima fine trasporto dei suoi terminati.
 * null se il file non ha terminati con la fine trasporto: allora non si
 * conserva niente, come prima.
 *
 * @param {array} righe  record gia' letti (stato, trasporto_finito_il)
 */
export function annoInizioFile(righe) {
  let primo = null;
  for (const r of righe || []) {
    if (!eTerminato(r)) continue;
    const a = annoFine(r);
    if (a !== null && (primo === null || a < primo)) primo = a;
  }
  return primo;
}

/**
 * Gli ordini dell'archivio da conservare: assenti dal file, terminati, con la
 * fine del trasporto in un anno prima di quello da cui comincia il file. Un
 * ordine sta in archivio con piu' righe: si conserva solo se lo sono tutte.
 *
 * @param {array}  archivio    i record in archivio (id_ordine, stato, trasporto_finito_il)
 * @param {number} annoInizio  l'anno da cui comincia il file (annoInizioFile)
 * @param {Set}    idFile      gli ID degli ordini nel file, come stringhe
 * @returns {{ ordini: Set<string>, righe: number }}
 */
export function ordiniDaConservare(archivio, annoInizio, idFile) {
  const ordini = new Set();
  if (!annoInizio) return { ordini, righe: 0 };
  const perOrdine = new Map(); // id -> righe
  for (const r of archivio || []) {
    const id = r && r.id_ordine ? String(r.id_ordine) : '';
    if (!id) continue;
    if (!perOrdine.has(id)) perOrdine.set(id, []);
    perOrdine.get(id).push(r);
  }
  let righe = 0;
  for (const [id, suoi] of perOrdine) {
    if (idFile.has(id)) continue;
    const vecchio = suoi.every(r => {
      const a = annoFine(r);
      return eTerminato(r) && a !== null && a < annoInizio;
    });
    if (vecchio) { ordini.add(id); righe += suoi.length; }
  }
  return { ordini, righe };
}

/**
 * I cancellati degli anni prima del file, assenti dal file: non servono piu'
 * (utente, 25/09/2026) e si lasciano andare. Non sono "mancanti" e non si
 * conservano: il caricamento li cancella senza chiedere conferma.
 *
 * Un cancellato non ha fine trasporto: l'unica data che ha e' l'immissione, ed
 * e' quella che dice di che anno e'. Vale solo qui, per i cancellati. Quelli
 * dell'anno del file in poi restano nel controllo: servono come statistica.
 * Un cancellato resta cancellato e inevaso; se viene riaperto perche'
 * cancellato per errore torna assegnato con lo stesso ID ordine, e il file lo
 * riscrive come tale (utente, 25/09/2026).
 *
 * @returns {Set<string>} gli ID degli ordini da lasciar andare
 */
export function cancellatiDaLasciare(archivio, annoInizio, idFile) {
  const esito = new Set();
  if (!annoInizio) return esito;
  const perOrdine = new Map();
  for (const r of archivio || []) {
    const id = r && r.id_ordine ? String(r.id_ordine) : '';
    if (!id) continue;
    if (!perOrdine.has(id)) perOrdine.set(id, []);
    perOrdine.get(id).push(r);
  }
  const cancellato = (r) => String((r && r.stato) || '').toLowerCase().trim() === 'cancellato';
  for (const [id, suoi] of perOrdine) {
    if (idFile.has(id)) continue;
    const vecchio = suoi.every(r => {
      const a = annoRoma(r.ordine_immesso_il);
      return cancellato(r) && a !== null && a < annoInizio;
    });
    if (vecchio) esito.add(id);
  }
  return esito;
}

/** Quanti ID per richiesta di cancellazione: abbastanza pochi da stare in una query. */
const ID_PER_CANCELLAZIONE = 200;

/**
 * Svuota un archivio tranne gli ordini da conservare. Senza niente da
 * conservare e' il deleteMany({}) di sempre. Altrimenti si cancellano gli
 * altri ordini a blocchi, per ID. Prima si prova il filtro, in sola lettura:
 * un ID conservato deve restituire solo le sue righe e un ID inesistente
 * nessuna. Se la piattaforma non capisse il filtro ci si ferma prima di
 * cancellare qualunque cosa.
 *
 * @param {object} entita     base44.asServiceRole.entities[Nome]
 * @param {array}  archivio   i record in archivio (id_ordine)
 * @param {Set}    conservati gli ID degli ordini da conservare
 * @param {function} pausa    attesa fra un blocco e l'altro (ms)
 * @returns {Promise<{ cancellati_ordini: number }>}
 */
export async function svuotaTranne(entita, archivio, conservati, pausa = async () => {}) {
  if (!conservati || conservati.size === 0) {
    await entita.deleteMany({});
    return { cancellati_ordini: null };
  }
  const daCancellare = [...new Set((archivio || [])
    .map(r => (r && r.id_ordine ? String(r.id_ordine) : ''))
    .filter(id => id && !conservati.has(id)))];
  const campione = conservati.values().next().value;
  const trovati = (await entita.filter({ id_ordine: { $in: [campione] } }, 'id', 50)) || [];
  const nessuno = (await entita.filter({ id_ordine: { $in: ['__sonda_storico_conservato__'] } }, 'id', 1)) || [];
  if (!trovati.length || trovati.some(r => String(r.id_ordine) !== campione) || nessuno.length) {
    throw new Error("Il filtro per ID non e' affidabile: l'archivio non e' stato toccato. Per ora serve un caricamento completo, dal primo anno.");
  }
  for (let i = 0; i < daCancellare.length; i += ID_PER_CANCELLAZIONE) {
    await entita.deleteMany({ id_ordine: { $in: daCancellare.slice(i, i + ID_PER_CANCELLAZIONE) } });
    if (i + ID_PER_CANCELLAZIONE < daCancellare.length) await pausa(100);
  }
  return { cancellati_ordini: daCancellare.length };
}
