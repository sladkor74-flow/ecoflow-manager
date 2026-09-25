// Lo storico che un caricamento conserva (richiesta dell'utente, 25/09/2026).
//
// Ogni caricamento di primarie, secondarie e terziarie sostituisce l'archivio
// con il file. L'utente pero' esporta dal portale solo dal 1 gennaio dell'anno
// scorso, perche' il portale si ancora al 31/12, e vuole che gli anni prima
// restino nella memoria storica del gestionale.
//
// Il portale filtra l'export per data di IMMISSIONE. La regola dell'utente e'
// che l'immissione conta solo per gli ordini aperti (assegnati); per i
// terminati comanda la fine del trasporto. Quindi il filtro del portale non dice
// niente sui terminati, e un terminato assente dal file resta com'e', qualunque
// sia la sua fine: nei file del 25/09/2026 mancavano 909 terminati finiti nel
// 2025-2026 ma immessi nel 2024 (fino a febbraio 2024), oltre ai 3.254 finiti
// nel 2024. Restano, e contano nel loro anno di fine trasporto.
//
// Il limite, detto all'utente: un terminato fuori dal file resta com'era
// all'ultimo caricamento che lo conteneva. Se il portale lo correggesse dopo,
// il gestionale non lo vedrebbe.
//
// Non si conservano mai gli ordini aperti: un assegnato assente dal file e' un
// vero mancante, e il controllo di sempre lo dice. I cancellati hanno la loro
// regola, piu' sotto.
import { annoRoma, oggiRoma } from "./giornoItaliano.ts";
import { eTerminato, primoAnnoControllato } from "./movimenti.ts";

/**
 * Da quale anno si esporta dal portale: il 1 gennaio dell'anno scorso, come per
 * gli avvisi sulle date. Serve ai cancellati, che si giudicano per immissione.
 */
export const annoDelloStorico = (oggi = oggiRoma()) => primoAnnoControllato(oggi);

/**
 * Gli ordini dell'archivio da conservare: terminati e assenti dal file. Un
 * ordine sta in archivio con piu' righe: si conserva solo se sono tutte di un
 * terminato.
 *
 * @param {array}  archivio  i record in archivio (id_ordine, stato)
 * @param {Set}    idFile    gli ID degli ordini nel file, come stringhe
 * @returns {{ ordini: Set<string>, righe: number }}
 */
export function ordiniDaConservare(archivio, idFile) {
  const ordini = new Set();
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
    if (suoi.every(eTerminato)) { ordini.add(id); righe += suoi.length; }
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
 * Un cancellato resta cancellato e inevaso: puo' tornare assegnato con lo
 * stesso ID ordine solo se viene riaperto perche' e' stato cancellato per
 * errore, e allora il file lo riscrive come tale (utente, 25/09/2026).
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
