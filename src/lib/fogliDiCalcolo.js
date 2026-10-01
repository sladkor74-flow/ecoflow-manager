import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';

// Aprire un foglio di calcolo nel browser, compresi gli .ods che si rifiutavano.
//
// Il 01/10/2026 l'utente ha chiesto perche' doveva convertire a mano in .xlsx il
// report .ods di Green Tyre Project. La risposta, guardando dentro il file: non
// e' il formato. Degli undici .ods che ci ha mandato quest'anno, otto si leggono
// cosi' come sono; i tre che non si aprivano - giugno, luglio e settembre -
// contengono celle con `office:value-type="error"`, e il lettore si ferma su
// quel tipo di cella rifiutando TUTTO il file.
//
// Quelle celle sono i suoi stessi controlli: formule come `=G29-N29` che
// confrontano il peso del fornitore con il nostro e che danno #VALORE! perche'
// puntano a un altro file (il file di gestione, via un collegamento a X:\SMOCO).
// Venticinque celle in una colonna che non c'entra niente coi dati, e per quelle
// il mese intero restava illeggibile.
//
// Qui il tipo "error" si legge come testo: la cella diventa la scritta
// "#VALORE!", che nessun lettore prende per un peso o per un formulario, e il
// resto del foglio si apre. Provato sul settembre vero: letto cosi', da' 107
// carichi per 415.620 kg, gli stessi numeri del file convertito a mano con
// Excel, con gli stessi formulari e le stesse date.
//
// Non si ripara per prevenzione: prima si prova ad aprire il file come arriva, e
// si ripara solo se si e' rotto su quel tipo di cella. E lo si dice, perche' un
// file aggiustato di nascosto e' un file di cui non si sa piu' niente.

const TIPO_ERRORE = /office:value-type="error"/g;

/**
 * Apre una cartella di lavoro con la libreria passata (il modulo xlsx, che le
 * pagine importano a richiesta). `dati` e' un Uint8Array o un ArrayBuffer.
 *
 * Torna { wb, nota }: la nota e' vuota quando il file si e' aperto da solo.
 */
export function leggiCartella(XLSX, dati, opzioni = {}) {
  const bytes = dati instanceof Uint8Array ? dati : new Uint8Array(dati);
  try {
    return { wb: XLSX.read(bytes, { type: 'array', ...opzioni }), nota: '' };
  } catch (e) {
    // Solo questo guasto si ripara. Qualunque altro errore e' un file che
    // davvero non si apre, e va detto come si e' sempre detto.
    if (!/unsupported value type/i.test(String((e && e.message) || e))) throw e;
    let dentro;
    try { dentro = unzipSync(bytes); } catch { throw e; }
    if (!dentro['content.xml']) throw e;
    const xml = strFromU8(dentro['content.xml']);
    const quante = (xml.match(TIPO_ERRORE) || []).length;
    if (!quante) throw e;
    const pulito = xml.replace(TIPO_ERRORE, 'office:value-type="string"');
    const wb = XLSX.read(zipSync({ ...dentro, 'content.xml': strToU8(pulito) }), { type: 'array', ...opzioni });
    return {
      wb,
      nota: `Il file conteneva ${quante === 1 ? 'una cella in errore' : `${quante} celle in errore`} (#VALORE!, #DIV/0! e simili: di solito formule che puntano a un altro file) e per ${quante === 1 ? 'quella' : 'quelle'} non si apriva affatto. ${quante === 1 ? 'L\'ho letta' : 'Le ho lette'} come testo e ho letto tutto il resto: ${quante === 1 ? 'quella cella non entra' : 'quelle celle non entrano'} nei conti.`,
    };
  }
}
