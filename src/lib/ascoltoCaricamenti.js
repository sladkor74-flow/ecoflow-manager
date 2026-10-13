// UNA PAGINA APERTA E I CARICAMENTI: CHE COSA VUOL DIRE OGNI EVENTO DEL REGISTRO
// (revisione del 13/10/2026, rilievi sulle segnalazioni alte A3 e A14).
//
// Le pagine che mostrano le primarie si iscrivono al registro dei caricamenti
// (UploadLog) per aggiornarsi da sole: regola 2, ogni caricamento aggiorna
// tutti i moduli. Un caricamento pero' non e' un evento solo. importaBlocco, per
// un caricamento delle primarie, scrive sul registro in quest'ordine:
//   1. apriCaricamento chiude in «errore» le righe rimaste «in_corso» da un
//      tentativo di prima («Caricamento interrotto: ... ricaricato dopo»);
//   2. apre la sua riga, «in_corso», e svuota l'archivio;
//   3. chiudiCaricamento la chiude con l'esito finale («successo» o «parziale»);
//   4. a ricalcoli finiti (dopoCaricamento in src/lib/importGrandeFile.js:
//      evasione degli assegnati, ritiri ECT, to-do, verifiche e qualifica) ci
//      attacca la nota «moduli collegati aggiornati», con un altro update della
//      stessa riga, sempre «successo».
// Chi rileggeva a ogni evento che non fosse «in_corso» rileggeva tre volte per
// un caricamento solo: al punto 1, proprio prima che l'archivio si svuotasse, al
// punto 3, e al punto 4 con l'archivio invariato. Terminati Rete sono tre
// pagine di primarie e quattro funzioni ogni volta.
//
// Qui la sequenza si legge una volta per riga del registro, ricordando le righe
// gia' viste:
// - concluso: la riga passa a un esito che ha riscritto l'archivio («successo»
//   o «parziale»), la prima volta. Un «errore» di norma non lo e': e' un
//   rifiuto a dati intatti (i controlli anti-regressione, un file sbagliato),
//   oppure la riga vecchia che un caricamento nuovo chiude mentre si apre
//   («... e' stato ricaricato dopo.»), e allora l'archivio si rilegge alla fine
//   di quello nuovo. Nemmeno la nota lo e': arriva su una riga gia' conclusa, e
//   una pagina aperta dopo la conclusione ha gia' letto l'archivio nuovo.
//   L'eccezione (revisione del 13/10/2026): un «errore» con la modalita'
//   «sostituzione» che non e' la riga vecchia chiusa da un caricamento nuovo e'
//   una riscrittura non riuscita, e l'archivio e' cambiato: e' l'anagrafica dei
//   PDR che importPdrFile non riesce a rimettere com'era. E' la stessa regola
//   del registro (eraRiscrittura in src/lib/registroCaricamenti.js). Le pagine
//   prima rileggevano a ogni «errore», quindi anche li': senza l'eccezione,
//   passando a questo ascolto, la pagina dei PDR avrebbe continuato a mostrare
//   l'anagrafica intera di prima (regola 2). Chi rilegge legge l'esito, per
//   dire che il caricamento non e' riuscito.
// - moduli_aggiornati: la nota compare sulla riga, la prima volta. E' il
//   momento in cui anche i conti salvati dai ricalcoli sono quelli nuovi: chi
//   li mostra (l'evasione degli assegnati, gli alert del motore) rilegge qui
//   quelli, e non prima, per non rifare i controlli insieme a
//   controllaEvasioneAssegnati.
// - in_corso: la riga e' aperta, l'archivio si sta riscrivendo.
// - id: la riga del registro, o null se l'evento non la porta.
// Le prove: prove/ascoltoCaricamenti.mjs, prove/terminatiReteUnaLettura.mjs,
// prove/evasioneAnnoInMemoria.mjs e prove/pagineUnaRilettura.mjs.
import { MODULI_AGGIORNATI } from '@/lib/importGrandeFile';

// Gli esiti con cui un caricamento ha riscritto l'archivio, per intero o in parte.
const ESITI_CHE_RISCRIVONO = ['successo', 'parziale'];
// La riga vecchia che apriCaricamento chiude in errore mentre se ne apre una
// nuova (importaBlocco e importEcotyreFile): «Caricamento interrotto: ... e'
// stato ricaricato dopo.», oppure il messaggio di prima con la stessa coda.
const CHIUSA_DA_UN_CARICAMENTO_NUOVO = /ricaricato dopo\.?\s*$/;
// Una riscrittura finita in errore: l'archivio e' cambiato, vuoto o a meta'.
const riscritturaNonRiuscita = (d) => d.esito === 'errore' && d.modalita === 'sostituzione'
  && !CHIUSA_DA_UN_CARICAMENTO_NUOVO.test(String(d.messaggio || ''));

/**
 * Un ascolto del registro per i tipi di caricamento dati. Restituisce una
 * funzione da chiamare con ogni evento di subscribe: null se l'evento non
 * riguarda quei tipi, altrimenti { id, tipo_file, esito, in_corso, concluso, moduli_aggiornati }.
 */
export function creaAscoltoCaricamenti(tipi) {
  const visti = new Map();
  return (evento) => {
    const d = evento && evento.data;
    if (!d || (evento.type !== 'create' && evento.type !== 'update') || !tipi.includes(d.tipo_file)) return null;
    // L'id sta sul record; qualche evento lo porta solo fuori (cosi' lo leggeva
    // PredittivitaSecondarie, che dal 13/10/2026 passa di qui). Senza id non si
    // ricorda niente: ogni esito finale vale come una conclusione, come prima.
    const id = d.id || evento.id || null;
    const prima = (id && visti.get(id)) || { concluso: false, nota: false };
    const nota = d.esito === 'successo' && String(d.messaggio || '').includes(MODULI_AGGIORNATI);
    const finale = ESITI_CHE_RISCRIVONO.includes(d.esito) || riscritturaNonRiuscita(d);
    if (id) visti.set(id, { concluso: prima.concluso || finale, nota: prima.nota || nota });
    return {
      id,
      tipo_file: d.tipo_file,
      esito: d.esito,
      in_corso: d.esito === 'in_corso',
      concluso: finale && !nota && !prima.concluso,
      moduli_aggiornati: nota && !prima.nota,
    };
  };
}
