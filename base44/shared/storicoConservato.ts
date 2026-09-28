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
// Un terminato fuori dal file resta com'era all'ultimo caricamento che lo
// conteneva. Non e' un limite reale (utente, 25/09/2026): a portale si puo'
// correggere al massimo un ordine del mese precedente, e l'export parte dal 1
// gennaio dell'anno scorso, piu' di un anno prima: nessun ordine ancora
// correggibile puo' restare fuori dal file.
//
// Non si conservano mai gli ordini aperti: un assegnato assente dal file e' un
// vero mancante, e il controllo di sempre lo dice. I cancellati hanno la loro
// regola, piu' sotto.
import { annoRoma, oggiRoma } from "./giornoItaliano.ts";
import { eTerminato, eEseguito, primoAnnoControllato } from "./movimenti.ts";

/**
 * Da quale anno si esporta dal portale: il 1 gennaio dell'anno scorso, come per
 * gli avvisi sulle date. Serve ai cancellati, che si giudicano per immissione.
 */
export const annoDelloStorico = (oggi = oggiRoma()) => primoAnnoControllato(oggi);

/**
 * Gli ordini dell'archivio da conservare: assenti dal file e terminati (o in
 * stato "eseguito", vedi sotto). Un ordine sta in archivio con piu' righe: si
 * conserva solo se lo sono tutte.
 *
 * LO STATO "ESEGUITO" SI CONSERVA COME UN TERMINATO, E SI SEGNALA (regola
 * dell'utente, 28/09/2026: "un ordine in stato eseguito va segnalato e
 * mantenuto, cosi' che al prossimo caricamento abbia un altro stato, terminato
 * o cancellato"). Un "eseguito" e' un ordine con tutti i dati inseriti ma senza
 * il Chiudi a portale: non e' terminato, quindi senza questa riga non si
 * conserverebbe, e non e' cancellato, quindi non si lascerebbe andare.
 *
 * IL MOTIVO: e' uno stato DI PASSAGGIO e si risolve da solo. Al caricamento
 * dopo, se l'ordine rientra nell'export, il portale gli ha dato lo stato
 * definitivo e il file lo riscrive com'e' diventato: terminato o cancellato. Se
 * invece e' immesso prima dell'anno scorso l'export non lo porta, la riga resta
 * "eseguito" e l'avviso continua a farlo vedere - che e' esattamente il
 * "segnalato e mantenuto" chiesto dall'utente, e l'unica cosa che si puo' fare
 * senza inventare uno stato che il portale non ha dato.
 * Trattarlo come un ordine mancante, invece, faceva chiedere la
 * forzatura e, forzando, CANCELLAVA proprio l'ordine che l'avviso sugli
 * eseguiti serve a far vedere: sparivano insieme il limbo e la riga, e nessuno
 * poteva piu' andare a portale a premere Chiudi.
 *
 * CONSERVARLO NON BASTA, VA DETTO. Un eseguito immesso prima dell'anno scorso
 * resta fuori dall'export, quindi non compare in avviso_eseguiti, che conta
 * solo gli eseguiti che il FILE contiene: senza dirlo resterebbe in archivio
 * senza comparire da nessuna parte. Per questo si restituisce anche quanti
 * sono, e il numero arriva alla finestra e al registro dei caricamenti.
 *
 * Vale anche per un ordine con righe miste (una terminata e una eseguita), che
 * prima non si conservava per intero.
 *
 * VALE PER TUTTI GLI ARCHIVI CHE CONSERVANO LO STORICO, non solo per le
 * primarie: anche l'importazione delle secondarie e delle terziarie
 * (base44/functions/importEcotyreFile) chiama questa funzione, e anche li' un
 * "eseguito" fuori dal file resta dov'e' invece di finire fra i mancanti. E' la
 * stessa regola, scritta una volta sola.
 *
 * @param {array}  archivio  i record in archivio (id_ordine, stato)
 * @param {Set}    idFile    gli ID degli ordini nel file, come stringhe
 * @returns {{ ordini: Set<string>, righe: number, righePerOrdine: Map<string, number>, eseguiti: { ordini: number, righe: number } }}
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
  // Quante righe ha ciascun ordine conservato. Serve al browser per il confronto
  // ordine per ordine di fine caricamento: un ordine conservato non e' ne' "di
  // troppo" (in archivio c'e' e nel file no: e' esattamente cio' che si vuole)
  // ne' "mancante", e con questo numero si vede anche se lo svuotamento gli
  // avesse tolto delle righe per sbaglio.
  const righePerOrdine = new Map();
  // E quanti di quelli conservati sono in stato "eseguito": si conservano come
  // i terminati, ma vanno detti (vedi sopra). Le righe si contano una per una,
  // perche' un ordine puo' averne una terminata e una eseguita.
  const ordiniEseguiti = new Set();
  let righeEseguite = 0;
  for (const [id, suoi] of perOrdine) {
    if (idFile.has(id)) continue;
    if (suoi.every(r => eTerminato(r) || eEseguito(r))) {
      ordini.add(id);
      righe += suoi.length;
      righePerOrdine.set(id, suoi.length);
      const quanteEseguite = suoi.filter(r => eEseguito(r)).length;
      if (quanteEseguite > 0) { ordiniEseguiti.add(id); righeEseguite += quanteEseguite; }
    }
  }
  return { ordini, righe, righePerOrdine, eseguiti: { ordini: ordiniEseguiti.size, righe: righeEseguite } };
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

const FILTRO_NON_AFFIDABILE = "Il filtro per ID non e' affidabile: l'archivio non e' stato toccato. Per ora serve un caricamento completo, dal primo anno.";

/**
 * Svuota un archivio tranne gli ordini da conservare. Senza niente da
 * conservare e' il deleteMany({}) di sempre. Altrimenti si cancellano gli
 * altri ordini a blocchi, per ID. Prima si prova il filtro, in sola lettura:
 * un ID conservato deve restituire solo le sue righe e un ID inesistente
 * nessuna. Se la piattaforma non capisse il filtro ci si ferma prima di
 * cancellare qualunque cosa.
 *
 * COME SI DICE CHE IL FILTRO NON REGGE. Di suo questa funzione LANCIA, e chi la
 * chiama si ferma: e' il comportamento di sempre e resta quello predefinito,
 * perche' l'importazione delle secondarie e delle terziarie ci conta - una
 * svuotaTranne che torna senza aver svuotato e senza lanciare la lascerebbe
 * scrivere il file sopra un archivio pieno, cioe' doppioni. Chi sa gestire un
 * esito - l'azione "svuota" di importaBlocco - passa senzaErrore: true e si
 * prende la risposta { non_fatta, motivo, dati_intatti }, la manda al browser
 * con un 200 e il browser la mostra tale e quale, invece di ritentare alla cieca
 * un 500 e chiudere con "svuotamento incompleto" perdendo per strada proprio la
 * frase che spiega che cosa fare.
 *
 * IL TEMPO. Con migliaia di ordini da togliere a blocchi di 200 l'invocazione
 * puo' essere tagliata a meta' dalla piattaforma, cioe' a cancellazione fatta a
 * meta' e senza che nessuno sappia dove. Con limiteMs si smette prima della
 * scadenza e si risponde { finito: false, cancellati_ordini }: chi chiama
 * richiama e si riprende da dove si era arrivati, perche' le righe gia' tolte
 * non ci sono piu' e il giro dopo le ricalcola su un archivio piu' piccolo.
 *
 * UN RAMO CHE ESISTE E NON HA UNA FRASE SUA: la sonda passa in LETTURA e la
 * piattaforma rifiuta lo stesso il filtro dentro deleteMany. Li' non si e'
 * toccato niente, ma l'errore risale come un guasto qualunque e chi carica legge
 * "svuotamento incompleto: restano N record. Ricarica il file" con i dati non
 * dichiarati intatti - mentre ricaricare lo stesso file dara' lo stesso esito.
 * Non e' mai capitato sulla piattaforma vera (il filtro a lotti e' lo stesso che
 * usa la cancellazione mirata della riparazione, provata dal vivo), e per dirlo
 * bene servirebbe distinguere qui il rifiuto del filtro da un errore di rete:
 * finche' non capita si lascia cosi', scritto.
 *
 * CANCELLATI_ORDINI NON VUOL DIRE "ORDINI TOLTI": sono gli ID che si sono
 * PASSATI a deleteMany, e una piattaforma che accetta il filtro senza togliere
 * niente risponde bene lo stesso. Serve a dire a che punto si e' arrivati nel
 * giro, non a dimostrare che l'archivio si sia rimpicciolito: chi riprende deve
 * misurare le righe rimaste, altrimenti il ciclo puo' non finire mai.
 *
 * @param {object} entita     base44.asServiceRole.entities[Nome]
 * @param {array}  archivio   i record in archivio (id_ordine)
 * @param {Set}    conservati gli ID degli ordini da conservare
 * @param {function} pausa    attesa fra un blocco e l'altro (ms)
 * @param {object} opzioni    { senzaErrore, limiteMs, t0 }
 * @returns {Promise<{ finito: boolean, cancellati_ordini: number|null, non_fatta?: boolean, motivo?: string, dati_intatti?: boolean }>}
 */
export async function svuotaTranne(entita, archivio, conservati, pausa = async () => {}, opzioni = {}) {
  const senzaErrore = opzioni.senzaErrore === true;
  const limiteMs = Number(opzioni.limiteMs) || 0;
  const t0 = typeof opzioni.t0 === 'number' ? opzioni.t0 : Date.now();
  const tempoFinito = () => limiteMs > 0 && Date.now() - t0 > limiteMs;
  if (!conservati || conservati.size === 0) {
    await entita.deleteMany({});
    return { finito: true, cancellati_ordini: null };
  }
  const daCancellare = [...new Set((archivio || [])
    .map(r => (r && r.id_ordine ? String(r.id_ordine) : ''))
    .filter(id => id && !conservati.has(id)))];
  const campione = conservati.values().next().value;
  const trovati = (await entita.filter({ id_ordine: { $in: [campione] } }, 'id', 50)) || [];
  const nessuno = (await entita.filter({ id_ordine: { $in: ['__sonda_storico_conservato__'] } }, 'id', 1)) || [];
  if (!trovati.length || trovati.some(r => String(r.id_ordine) !== campione) || nessuno.length) {
    if (senzaErrore) return { finito: false, non_fatta: true, motivo: FILTRO_NON_AFFIDABILE, dati_intatti: true, cancellati_ordini: 0 };
    throw new Error(FILTRO_NON_AFFIDABILE);
  }
  // Gli ID gia' passati a deleteMany, non le righe uscite: vedi sopra.
  let chiesti = 0;
  for (let i = 0; i < daCancellare.length; i += ID_PER_CANCELLAZIONE) {
    await entita.deleteMany({ id_ordine: { $in: daCancellare.slice(i, i + ID_PER_CANCELLAZIONE) } });
    chiesti += Math.min(ID_PER_CANCELLAZIONE, daCancellare.length - i);
    if (i + ID_PER_CANCELLAZIONE < daCancellare.length) {
      if (tempoFinito()) return { finito: false, cancellati_ordini: chiesti, da_cancellare: daCancellare.length };
      await pausa(100);
    }
  }
  return { finito: true, cancellati_ordini: chiesti };
}
