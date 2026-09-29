import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste, eLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { SHEET_MAP, NUMERIC_FIELDS } from "../../shared/excelSchemas.ts";
import { FILE_SIGNATURES, checkSignature, detectType, mappaColonne } from "../../shared/fileSignatures.ts";
import { enrichRecords } from "../../shared/dataEnrichment.ts";
import { ARCHIVI_PRIMARIE, DATE_PRIMARIE, archivioPrimaria, dataPrimaria, recordAssegnato } from "../../shared/primarie.ts";
import { livelloDi, puoCaricare, rispostaCaricamentoNegato } from "../../shared/livelli.ts";
import { fetchAll, RIGHE_PER_PAGINA, ultimaPagina } from "../../shared/fetchAll.ts";
import { allineaDalPortale } from "../../shared/agganciaDichiarazioni.ts";
import { evasioneOrdini, listaOrdini, statoRichiesta, riconosciOrdine, ritiriTerminati, idOrdineDaSalvare, ordiniConDateDaSistemare, statoOrdiniRichiesta } from "../../shared/richiesteEct.ts";
import { statoOrdini } from "../../shared/todoOrdini.ts";
import { annoRoma, oggiRoma } from "../../shared/giornoItaliano.ts";
import { statoCaricamenti, dataItaliana } from "../../shared/reportSettimanali.ts";
import { annoDelloStorico, ordiniDaConservare, cancellatiDaLasciare, svuotaTranne } from "../../shared/storicoConservato.ts";

// Le dichiarazioni riconosciute, un canale per volta: nel registro non si sommano.
const perCanale = (righe) => [['RETE', 'rete'], ['ACI', 'ACI'], ['EXTRA_RACCOLTA', 'extra raccolta']]
  .map(([c, nome]) => [nome, righe.filter(x => (x.canale || 'RETE') === c).length]).filter(([, n]) => n)
  .map(([nome, n]) => `${nome} ${n}`).join(', ') || '0';

// Importazione a blocchi per i report di grandi dimensioni del portale Ecotyre.
//
// Perche' esiste: il report delle dichiarazioni di trattamento pesa oltre 4 MB e
// contiene piu' di un milione di celle. Leggerlo dentro una function esaurisce la
// memoria disponibile e il processo viene terminato dalla piattaforma. La lettura
// avviene quindi nel browser e qui arrivano blocchi di poche centinaia di righe.
//
// Ogni invocazione fa una cosa sola e deve restare ampiamente sotto il timeout di
// venti secondi della connessione al database. Le azioni sono:
//   prepara  - verifica la firma del file, il controllo anti-regressione e svuota
//              l'archivio precedente
//   scrivi   - scrive un blocco con una sola chiamata a bulkCreate
//   conta    - restituisce quanti record contiene l'archivio. Il numero che da'
//              e' esatto (vedi contaRecord); costa pero' una trentina di letture
//              in fila e non si puo' riprendere, percio' la verifica finale
//              delle primarie usa conta_esatta
//   conta_esatta - conta le righe di un archivio delle primarie una per una,
//              a pagine; se il tempo non basta dice dove si e' fermata e il
//              browser la richiama da li'. Con dettaglio dice anche quante
//              righe ha ciascun ordine: e' il metro con cui si scopre un blocco
//              entrato due volte insieme a un altro mai arrivato, che sul solo
//              totale si compensano e non si vedrebbero
//   cancella_ordini - toglie le righe degli ordini indicati, per la riparazione
//              mirata di un archivio che non quadra (niente svuotamenti). Si
//              cancella a LOTTI, con un filtro solo per lotto: un ordine per
//              richiesta voleva dire duecento richieste in un'invocazione, e il
//              limite e' di circa settanta al minuto per tutta l'app. Dice
//              SEMPRE quanti ne ha tolti, anche quando si interrompe a meta'
//   registra - scrive il registro dei caricamenti a fine importazione
//
// Le primarie arrivano da un solo file ma vanno in quattro archivi (rete, ACI,
// assegnati rete, assegnati ACI): il browser indica l'archivio di ogni blocco e
// ogni archivio si svuota subito prima di essere riscritto, con l'azione
//   svuota   - svuota l'archivio indicato
// La preparazione delle primarie non cancella nulla: confronta gli ordini del
// file con quelli in archivio e blocca il caricamento se ne mancano.
//
// Dopo la registrazione, due azioni rifanno cio' che dipende dal file appena
// caricato (ogni caricamento aggiorna tutto, regola dell'utente del 21/09/2026).
// Stanno fuori da "registra" apposta: leggono archivi interi, e se non riescono
// il caricamento resta buono e il registro chiuso.
//   allinea    - report delle dichiarazioni: riconosce le nostre dichiarazioni
//                mensili caricate a portale (caricata_inviata, data, materiali)
//   ritiri_ect - primarie: riconosce fra assegnati e primarie l'ordine delle
//                richieste del consorzio, e fra i terminati il loro ritiro; con
//                un caricamento delle primarie aperto rinvia (409)
//
// Un blocco corrisponde a una sola scrittura: o la riga vanno tutte a buon fine o
// non ne va nessuna. Il browser puo' quindi ritentare un blocco fallito senza
// rischiare duplicati, e verificare con l'azione conta se la scrittura era invece
// arrivata a destinazione nonostante l'errore di rete.

// LA RIPARAZIONE DEVE ESSERE IDEMPOTENTE. E' la regola che governa
// cancella_ordini e tutto il giro della riparazione (src/lib/importGrandeFile.js):
// per ogni ordine da rimettere a posto si TOLGONO le sue righe e si RISCRIVONO
// quelle del file, cosi' comunque fosse messo l'archivio, e qualunque cosa dica
// una lettura in ritardo, quell'ordine finisce con esattamente le righe che ha
// nel file. Non esiste una scrittura "aggiungi" cieca. Da qui discendono:
//   - FRA PERDERE RIGHE E DUPLICARLE SI SCEGLIE SEMPRE LA PRIMA: perdere e'
//     rumoroso e si rimedia ricaricando lo stesso file, che e' ancora sul
//     disco; duplicare e' silenzioso, chiude "successo" e fa partire tutti i
//     ricalcoli sopra pesi contati doppi (incidente del 14/09/2026);
//   - NESSUN VERDETTO SI COSTRUISCE SU UN CONTEGGIO PRECEDENTE a un'operazione
//     che ha toccato i dati: chi cancella dice SEMPRE quanti ne ha tolti, anche
//     quando finisce male, e chi decide riconta prima di raccontare com'e'
//     andata;
//   - meglio dire "non sono riuscito, ecco che cosa ho toccato" che raccontare
//     numeri vecchi. Un archivio di cui non si sa piu' niente si dichiara non
//     contato: il caricamento resta "parziale" e i moduli non si ricalcolano.

const LIMITE_INVOCAZIONE_MS = 12000;

// Un caricamento svuota l'archivio e poi lo riscrive a blocchi dal browser. Se la
// scheda si chiude a meta', l'archivio resta vuoto o parziale: prima non restava
// scritto da nessuna parte. Ora la preparazione apre una riga "in_corso" nel
// registro, con chi l'ha avviata, e la registrazione finale la chiude. Una riga
// rimasta "in_corso" E' la traccia dell'interruzione. Serve anche da blocco:
// due persone non caricano lo stesso archivio nello stesso momento.
//
// Un caricamento che finisce senza nessuna riga scritta ha gia' svuotato
// l'archivio: la sua riga NON si chiude in "errore", resta "in_corso" e cambia
// solo il messaggio, che comincia con NON_RIUSCITO. Chiusa, nessuno vedeva piu'
// l'archivio vuoto: statoCaricamenti, il cruscotto e i ricalcoli dopo i
// caricamenti guardano le righe "in_corso", e rifacevano e salvavano esiti
// sull'archivio vuoto (regola 2). Cosi' la vedono aperta, e interrotta dopo
// dieci minuti. Si chiude in "errore" solo cio' che fallisce prima dello
// svuotamento, a dati intatti. Una riga NON_RIUSCITO non blocca un altro utente:
// nessuno sta piu' scrivendo.
const FINESTRA_IN_CORSO_MS = 10 * 60 * 1000;
const NON_RIUSCITO = 'Caricamento non riuscito';

// Quanti ordini si cancellano con una richiesta sola (filtro $in). Cinquanta
// tiene la richiesta corta e fa di duecento ordini quattro richieste.
const LOTTO_CANCELLAZIONE = 50;
// Se il filtro $in non fosse accettato da deleteMany si torna a un ordine per
// richiesta: sopra questo numero non si ripara affatto, perche' con settanta
// richieste al minuto per tutta l'app ci si fermerebbe a meta'.
const MAX_ORDINI_UNO_PER_VOLTA = 50;
// La nota che dice che i moduli collegati sono stati rifatti dopo quel
// caricamento. Lo stesso testo sta in src/lib/importGrandeFile.js.
const MODULI_AGGIORNATI = 'moduli collegati aggiornati';
const chi = (user) => (user && (user.full_name || user.email)) || '';
// "da 1 minuto", "da 3 minuti": scritto sempre al plurale usciva "da 1 minuti".
function daQuantoTempo(millisecondi) {
  const minuti = Math.max(1, Math.round(millisecondi / 60000));
  return minuti === 1 ? '1 minuto' : `${minuti} minuti`;
}

// Le conferme che l'utente ha dato, una per controllo. Prima conferma_forzatura
// era un flag unico: chi confermava "l'archivio si e' rimpicciolito" - che dopo
// un caricamento parziale capita a tutti - scavalcava nello stesso tentativo
// anche il controllo degli ordini che sparirebbero, cioe' la protezione contro
// un export rifiltrato. Adesso ogni 409 dice quale conferma chiede e il browser
// rimanda quella: confermarne una non spegne l'altra. Il vecchio "true" vale per
// i percorsi che hanno un controllo solo (dichiarazioni di trattamento).
const CONFERMA_ORDINI_MANCANTI = 'ordini_mancanti';
const CONFERMA_ARCHIVIO_RIMPICCIOLITO = 'archivio_rimpicciolito';
const conferme = (valore) => new Set(
  (Array.isArray(valore) ? valore : valore === undefined || valore === null || valore === false ? [] : [valore])
    .map(v => (v === true ? 'true' : String(v).trim())).filter(Boolean)
);

async function apriCaricamento(base44, user, tipo_file, nome_file, prima) {
  const Log = base44.asServiceRole.entities.UploadLog;
  const aperti = await Log.filter({ tipo_file, esito: 'in_corso' }, '-created_date', 20);
  const adesso = Date.now();
  // Quanti ordini c'erano l'ultima volta che l'archivio era a posto, non quanti
  // ce ne sono adesso. Scrivendo sempre il numero di adesso bastava un secondo
  // tentativo morto PRIMA di svuotare (fra prepara e il primo svuota c'e' tutto
  // il tempo che serve) perche' la riga nuova nascesse col numero gia'
  // rimpicciolito: da li' in poi "in archivio ce n'e' meno di prima" non era piu'
  // vero mai piu' e il controllo del file monco si spegneva da solo. Il numero
  // di partenza quindi non scende finche' un caricamento non chiude bene.
  let partenza = typeof prima === 'number' ? prima : null;
  for (const l of aperti) {
    if (typeof l.righe_archivio_prima === 'number' && (partenza === null || l.righe_archivio_prima > partenza)) {
      partenza = l.righe_archivio_prima;
    }
  }
  for (const l of aperti) {
    const eta = adesso - new Date(String(l.created_date).replace(/(Z|[+-]\d{2}:?\d{2})?$/, 'Z')).getTime();
    const fallito = String(l.messaggio || '').startsWith(NON_RIUSCITO);
    if (!fallito && eta < FINESTRA_IN_CORSO_MS && l.utente && l.utente !== chi(user)) {
      return { bloccato: `${l.utente} sta caricando lo stesso archivio da ${daQuantoTempo(eta)}: aspetta che finisca, altrimenti i due caricamenti si sovrascrivono.` };
    }
    // un caricamento precedente rimasto a meta': lo si dice, e se ne apre uno nuovo
    await Log.update(l.id, { esito: 'errore', messaggio: fallito ? `${l.messaggio} E' stato ricaricato dopo.` : `Caricamento interrotto: avviato da ${l.utente || 'sconosciuto'} e mai concluso. L'archivio poteva essere incompleto; e' stato ricaricato dopo.` });
  }
  const riga = await Log.create({
    tipo_file, nome_file: nome_file || 'N/D', esito: 'in_corso', utente: chi(user),
    righe_importate: 0, righe_fallite: 0, modalita: 'sostituzione',
    righe_archivio_prima: partenza === null ? undefined : partenza,
    messaggio: 'Caricamento in corso: archivio in riscrittura.',
  });
  return { id: riga.id, righe_archivio_prima: partenza };
}

// La registrazione finale chiude la riga aperta dalla preparazione; se non la trova ne scrive una nuova.
// Arriva sempre dopo lo svuotamento: con esito "errore" non e' entrata nessuna
// riga e l'archivio e' vuoto, quindi la riga resta "in_corso" col solo messaggio
// cambiato. Se la riga non c'e' piu', l'ha chiusa un caricamento partito dopo,
// che decide lui dell'archivio: questa resta nello storico.
async function chiudiCaricamento(base44, user, tipo_file, campi, archivioIgnoto = false) {
  const Log = base44.asServiceRole.entities.UploadLog;
  const aperti = await Log.filter({ tipo_file, esito: 'in_corso' }, '-created_date', 5);
  const mio = aperti.find(l => !l.utente || l.utente === chi(user)) || null;
  if (mio && campi.esito === 'errore') {
    // "L'ARCHIVIO E' VUOTO" SI DICE SOLO SE SI E' CONTATO. Le righe scritte non
    // sono quello che c'e' in archivio: sono quello che la piattaforma ha
    // CONFERMATO di aver scritto. Se ogni risposta si perde e nessun conteggio
    // risponde, quel numero e' zero e l'archivio puo' essere completo: lo
    // storico scriveva "nessuna riga scritta, l'archivio e' vuoto" e due parole
    // dopo "480 righe di cui non si sa se siano entrate", e quella riga resta
    // li' per sempre.
    await Log.update(mio.id, {
      messaggio: archivioIgnoto
        ? `${NON_RIUSCITO}: nessuna riga confermata dopo lo svuotamento dell'archivio (${campi.messaggio}). Non si e' potuto contare l'archivio: non si sa che cosa ci sia dentro, ricarica il file.`
        : `${NON_RIUSCITO}: nessuna riga scritta dopo lo svuotamento dell'archivio (${campi.messaggio}). L'archivio e' vuoto: ricarica il file.`,
    });
  } else if (mio) {
    const finali = { ...campi, utente: chi(user) };
    // Il numero di partenza non scende mai finche' la riga resta aperta: e' il
    // metro con cui il caricamento dopo si accorge che un archivio e' gia' stato
    // svuotato (vedi apriCaricamento).
    if (typeof mio.righe_archivio_prima === 'number'
      && (typeof finali.righe_archivio_prima !== 'number' || mio.righe_archivio_prima > finali.righe_archivio_prima)) {
      finali.righe_archivio_prima = mio.righe_archivio_prima;
    }
    await Log.update(mio.id, finali);
  } else await Log.create({ ...campi, utente: chi(user) });
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Campi che rappresentano una data: accettano seriale Excel o testo AAAA-MM-GG.
const DATE_FIELDS = new Set([
  'data_chiusura', 'data_immissione', 'inizio_trasporto', 'fine_trasporto',
  'data_esecuzione', 'data_dichiarazione',
]);

function serialeExcelInData(seriale) {
  return new Date(Date.UTC(1899, 11, 30) + Math.round(seriale * 86400000));
}

function convertiData(val) {
  if (val === undefined || val === null || val === '') return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val.toISOString();
  const n = typeof val === 'number' ? val : Number(String(val).trim());
  if (!isNaN(n) && n > 20000) {
    const d = serialeExcelInData(n);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(String(val).trim());
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// Trasforma una riga grezza del foglio nell'oggetto dell'entita'.
// Le date si riconoscono dal campo, non dal tipo di file: la conversione delle
// tre date obbligatorie era accesa solo per le primarie, e un nuovo slot che
// porta le stesse colonne sarebbe entrato con le date illeggibili.
function mappaRiga(row, colMap, primarie = false) {
  const obj = {};
  for (const [colonnaExcel, campo] of Object.entries(colMap)) {
    const val = row[colonnaExcel];
    if (DATE_FIELDS.has(campo)) { obj[campo] = convertiData(val); continue; }
    if (DATE_PRIMARIE.has(campo)) { obj[campo] = dataPrimaria(val); continue; }
    if (val === undefined || val === null || val === '') { obj[campo] = null; continue; }
    if (NUMERIC_FIELDS.has(campo)) {
      const n = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
      obj[campo] = isNaN(n) ? null : n;
    } else if (primarie && campo === 'stato') {
      obj[campo] = String(val).trim().toLowerCase();
    } else {
      obj[campo] = String(val).trim();
    }
  }
  return obj;
}

// LE PAGINE SI LEGGONO SEMPRE IN ORDINE DI id, L'UNICO ORDINAMENTO UNICO
// (shared/fetchAll.ts). Con un ordinamento che ha dei pari - id_ordine ce l'ha,
// lo stesso ordine sta in archivio con piu' righe - le righe pari si scambiano
// di posto fra una pagina e l'altra: alcune si leggono due volte e altre mai
// (15/09/2026: 44 doppioni e 44 mancanti su 10.543 primarie). E si deduplica
// per id, cosi' una riga servita due volte non si conta due volte.
//
// Non e' un dettaglio di prestazioni: da qui esce anche il conto delle righe di
// ciascun ordine conservato, che e' il METRO del confronto ordine per ordine di
// fine caricamento. Una riga letta due volte diventa un rosso "ci sono righe di
// troppo, quei pesi si contano doppi"; una saltata, un falso "lo storico
// conservato non torna" - e in tutti e due i casi i ricalcoli restano fermi.
async function pagineArchivio(base44, entita, campi) {
  const righe = [];
  const visti = new Set();
  for (let skip = 0; ; ) {
    const pagina = await base44.asServiceRole.entities[entita].list('id', RIGHE_PER_PAGINA, skip, campi);
    for (const r of pagina) {
      if (r && r.id) { if (visti.has(r.id)) continue; visti.add(r.id); }
      righe.push(r);
    }
    if (ultimaPagina(pagina.length, RIGHE_PER_PAGINA)) break;
    skip += pagina.length;
    await sleep(100);
  }
  return righe;
}

// Identificativi degli ordini di un archivio.
async function idArchivio(base44, entita) {
  const ids = new Set();
  for (const r of await pagineArchivio(base44, entita, ['id_ordine'])) {
    if (r.id_ordine) ids.add(String(r.id_ordine));
  }
  return ids;
}

// I record di un archivio con i soli campi che servono a decidere che cosa
// conservare dello storico (shared/storicoConservato.ts).
async function recordArchivio(base44, entita) {
  return pagineArchivio(base44, entita, ['id_ordine', 'stato', 'trasporto_finito_il', 'ordine_immesso_il']);
}

// Gli archivi che conservano lo storico: i terminati (e gli "eseguito", che
// sono un passaggio verso un terminato o un cancellato) degli anni prima che il
// file non contiene. Gli archivi degli assegnati si riscrivono sempre.
const ARCHIVI_CON_STORICO = ['PrimariaRete', 'PrimariaAci'];

// Da quale anno si carica: l'anno scorso, come per gli avvisi sulle date
// (annoDelloStorico in shared/storicoConservato.ts).
const annoInizioPrimarie = () => annoDelloStorico();

// Riconosce gli errori di rete o di attesa: non vanno ritentati qui dentro perche'
// ogni tentativo puo' bruciare venti secondi e far superare all'invocazione il
// tempo massimo concesso dalla piattaforma. Il ritentativo spetta al browser.
function eInterruzione(e) {
  const m = String(e && e.message ? e.message : e).toLowerCase();
  return m.indexOf('timed out') >= 0 || m.indexOf('timeout') >= 0
    || m.indexOf('econnreset') >= 0 || m.indexOf('socket hang up') >= 0
    || m.indexOf('connection') >= 0 || m.indexOf('network') >= 0;
}

// Conta i record dell'archivio. Il client non espone un conteggio e rileggere
// l'intero archivio costerebbe quanto l'importazione stessa: si interroga quindi
// la sola presenza di un record a una data posizione.
//
// Il browser conosce i due soli esiti possibili di un blocco: o e' entrato tutto
// o non e' entrato niente. Verificare le due ipotesi costa due interrogazioni
// ciascuna; solo se nessuna regge si procede per raddoppi e bisezione.
//
// I raddoppi e la bisezione sono una trentina di letture in fila, e dentro il
// tempo di una sola invocazione possono non starci: succede proprio quando i
// numeri non tornano, cioe' quando ci sarebbe qualcosa da segnalare. Scaduto il
// tempo si risponde null - non si e' riusciti a contare - invece di farsi
// interrompere a meta': un conteggio che non riesce e' un esito da dichiarare,
// e chi ha chiamato non deve mai scambiarlo per un archivio a posto.
async function contaRecord(base44, entita, ipotesi, t0) {
  const ent = base44.asServiceRole.entities[entita];
  const esiste = async (i) => (await ent.list('created_date', 1, i)).length > 0;
  const tempoFinito = () => typeof t0 === 'number' && Date.now() - t0 > LIMITE_INVOCAZIONE_MS;

  for (const n of ipotesi) {
    if (typeof n !== 'number' || n <= 0) continue;
    if ((await esiste(n - 1)) && !(await esiste(n))) return n;
  }

  if (!(await esiste(0))) return 0;
  // Le ipotesi sono quattro letture, ma su piattaforma lenta possono gia' aver
  // finito il tempo: raddoppi e bisezione sono un'altra trentina di letture e
  // conviene dichiararlo subito invece di farsi interrompere a meta'.
  if (tempoFinito()) return null;
  let basso = 0, alto = 1;
  while (await esiste(alto)) {
    basso = alto;
    alto *= 2;
    if (alto > 2000000) return alto;
    if (tempoFinito()) return null;
  }
  while (alto - basso > 1) {
    if (tempoFinito()) return null;
    const medio = Math.floor((basso + alto) / 2);
    if (await esiste(medio)) basso = medio; else alto = medio;
  }
  return basso + 1;
}

// Quante righe ha DAVVERO un archivio delle primarie: si leggono le pagine e si
// contano, una per una.
//
// Perche' non si usa contaRecord: non perche' sia impreciso - sonda le posizioni
// per raddoppi e bisezione e il numero che da' e' esatto - ma perche' costa una
// trentina di letture in fila invece di tre, e quando il tempo finisce si arrende
// senza poter riprendere. Qui si legge a pagine, si sa sempre dove ci si e'
// fermati e il browser richiama da li'.
//
// A che cosa serve: il browser sa quante righe di quell'archivio ha il file, e
// dopo la scrittura le righe in archivio devono essere quelle. Un blocco entrato
// due volte - un ritentativo dopo un errore di rete che in realta' era passato -
// ne fa 650 dove ne erano attese 450, e si vede benissimo. E' quello che manco'
// il 14/09/2026, quando l'archivio non contato veniva saltato e il caricamento
// si chiudeva come riuscito coi pesi doppi dentro.
//
// Il totale pero' DA SOLO NON BASTA, ed e' il difetto per cui il dettaglio e'
// diventato obbligatorio: un blocco entrato due volte (+200 righe) e un altro
// mai arrivato (-200) si compensano, il totale torna esatto e il caricamento si
// chiudeva "successo" con 200 ordini contati doppi e 200 spariti. Percio' la
// verifica finale chiede sempre dettaglio: quante righe ha CIASCUN ordine.
//
// Quello che NON si puo' fare e' contare gli id_ordine e pretenderne uno per
// riga. Lo stesso ordine sta legittimamente in archivio con piu' righe - una per
// classe o per prodotto, le quote di un formulario ripartito: lo dicono
// chiaveOrdine in shared/movimenti.ts, raccoltoCalculator, reportSettimanali ed
// evasioneAssegnati. Su un file di 100 ordini con 20 in due classi (120 righe) un
// controllo del genere dichiarerebbe 20 doppioni che non esistono, e l'archivio
// guasto per sempre. Il confronto giusto e' con le righe che quell'ordine ha nel
// file, e quelle il browser le sa gia'.
//
// Il dettaglio non costa nessuna lettura in piu': sono le stesse pagine, con in
// piu' la colonna id_ordine.
//
// Una sola invocazione ha dodici secondi: se non bastano si risponde dove si e'
// arrivati (da_riga) e il browser richiama da li'. Prima ci si arrendeva, e un
// archivio non contato bastava a chiudere il caricamento come parziale, cioe' a
// fermare report, alert, quadratura FIR, predittivita' e ritiri ECT.
const MAX_PAGINE_PER_GIRO = 100;

async function contaRigheArchivio(base44, entita, daRiga, dettaglio, t0) {
  const ent = base44.asServiceRole.entities[entita];
  const campi = dettaglio ? ['id', 'id_ordine'] : ['id'];
  const volte = dettaglio ? {} : null;
  // Le pagine si leggono in ordine di id, l'unico stabile: con created_date i
  // record scritti nello stesso istante si scambiano di posto fra una pagina e
  // l'altra, e alcuni si leggono due volte e altri mai (vedi fetchAll.ts).
  let riga = Math.max(0, Number(daRiga) || 0);
  for (let pagine = 0; pagine < MAX_PAGINE_PER_GIRO; pagine++) {
    const pagina = await ent.list('id', RIGHE_PER_PAGINA, riga, campi);
    if (volte) for (const r of pagina) {
      const ordine = String((r && r.id_ordine) || '').trim();
      if (ordine) volte[ordine] = (volte[ordine] || 0) + 1;
    }
    riga += pagina.length;
    // Gli ordini distinti non si contano qui: un giro vede solo le sue pagine, e
    // il totale lo mette insieme il browser sommando i conteggi di tutti i giri.
    if (ultimaPagina(pagina.length, RIGHE_PER_PAGINA)) return { righe: riga, finito: true, conteggi: volte };
    if (typeof t0 === 'number' && Date.now() - t0 > LIMITE_INVOCAZIONE_MS) break;
    await sleep(100);
  }
  // righe e' insieme quante se ne sono contate e da dove si riprende: il browser
  // lo rimanda come da_riga e il conto continua da li'.
  return { righe: riga, finito: false, conteggi: volte };
}

// La data del ritiro da salvare. Si riscrive a ogni ricalcolo: prima si scriveva
// solo quando c'era, e non si toglieva mai, cosi' una richiesta a cui si
// aggiungeva a mano un secondo ordine non ancora ritirato restava "da
// confermare" sulla data vecchia, con ordini_evasi minore di ordini_totali. Si
// toglie pero' solo quando l'archivio dice che un suo ordine non e' ritirato
// (c'e', ma non terminato con la fine trasporto); un ordine che nell'archivio
// non c'e' affatto - un caricamento parziale, un blocco non scritto - non basta
// a cancellare un ritiro gia' rilevato: si tiene la data salvata.
function dataRitiro(salvata, ids, ev, terminati, presenti) {
  if (ev.ultima) return ev.ultima;
  if (!salvata) return null;
  const mancanti = ids.filter(id => !terminati.has(id));
  return mancanti.every(id => presenti.has(id)) ? null : salvata;
}

// Le richieste del consorzio dicono "ritirato il" quando il loro ordine compare
// fra i terminati. Prima lo si calcolava solo ricaricando il file delle richieste
// (importaRichiesteEct): un ritiro arrivato con le primarie restava "in attesa" e
// in ritardo, e si rischiava di sollecitare un ritiro gia' fatto. Il giorno e'
// quello italiano della fine trasporto, mai la chiusura a portale.
//
// Anche l'ID ordine si ricerca: il file delle primarie riscrive gli assegnati, e
// una richiesta rimasta "non trovata" o "ambigua" perche' il suo ordine non era
// ancora fra gli assegnati quando si e' caricato il foglio ECT restava senza ID,
// quindi "in attesa", finche' qualcuno non ricaricava quel foglio. Vale per le
// richieste senza ID scritti a mano, che vincono sempre; un ID gia' riconosciuto
// si sostituisce solo con un altro ID, mai con "non trovato" o "ambiguo" (un
// secondo ordine dello stesso produttore e dello stesso giorno avrebbe tolto
// l'ordine, e con lui il ritiro, a una richiesta gia' evasa): la regola sta in
// idOrdineDaSalvare, la stessa del caricamento del foglio ECT. Spunte, ID
// scritti a mano e note non si toccano.
//
// Una richiesta ancora aperta che aspetta un ordine terminato senza fine
// trasporto si segnala (terminati_senza_fine): il ritiro non si conta senza la
// data (regola 1), ma c'e', e sollecitarlo sarebbe sbagliato. Una evasa (anche
// gia' spuntata), o in parte evasa, da un ordine con la fine trasporto ma con un'altra data
// obbligatoria che manca o non torna si dice anche lei
// (ordini_con_date_da_sistemare, regola dell'utente del 22/09/2026).
async function riconosciRitiriEct(base44) {
  const svc = base44.asServiceRole.entities;
  const anno = Number(oggiRoma().slice(0, 4));
  const tutte = await fetchAll(svc.RichiestaEct, { anno });
  const richieste = tutte.filter(r => r.esito !== 'evasa' && r.esito !== 'annullata');
  // Le evase gia' spuntate non si toccano: si guardano solo per le date.
  const evase = tutte.filter(r => r.esito === 'evasa');
  if (!richieste.length && !evase.length) return { controllate: 0, aggiornate: 0, da_confermare: [], terminati_senza_fine: [], ordini_con_date_da_sistemare: [] };

  // Gli stessi archivi del caricamento delle richieste: gli assegnati e tutte le
  // primarie, perche' l'ordine della richiesta puo' essere gia' terminato.
  const [assRete, assAci, rete, aci] = await Promise.all([
    fetchAll(svc.Assegnato),
    fetchAll(svc.AssegnatoAci),
    fetchAll(svc.PrimariaRete),
    fetchAll(svc.PrimariaAci),
  ]);
  const ordini = [...assRete, ...assAci, ...rete, ...aci];
  const { terminati, senzaFine, daSistemare } = ritiriTerminati([...rete, ...aci]);
  // Lo stato di ogni ordine - terminato, eseguito, cancellato, assegnato - con la
  // stessa funzione che usa la to-do list: due moduli non possono dire due cose
  // diverse sullo stesso ordine.
  const statoTuttiGliOrdini = statoOrdini([...rete, ...aci], [...assRete, ...assAci]);
  const presenti = new Set(ordini.map(o => String(o.id_ordine || '').trim()).filter(Boolean));

  let aggiornate = 0;
  const daConfermare = [];
  const terminatiSenzaFine = [];
  const conDate = [];
  for (const r of richieste) {
    const campi: any = {};
    if (!String(r.id_ordine_manuale || '').trim()) Object.assign(campi, idOrdineDaSalvare(r, riconosciOrdine(r, ordini)));
    const ids = listaOrdini({ ...r, ...campi });
    const ev = evasioneOrdini(ids, terminati);
    campi.ordini_totali = ev.totali;
    campi.ordini_evasi = ev.evasi;
    campi.evasione_rilevata_il = dataRitiro(r.evasione_rilevata_il, ids, ev, terminati, presenti);
    campi.esito = statoRichiesta({ ...r, ...campi });
    // A che punto sono i suoi ordini, uno per uno: con piu' ordini sulla stessa
    // richiesta, '2 su 3' dice quanti e non quali.
    campi.ordini_stato_json = JSON.stringify(statoOrdiniRichiesta(ids, statoTuttiGliOrdini));
    const senzaData = ids.filter(id => senzaFine.has(id));
    if (campi.esito === 'aperta' && senzaData.length) terminatiSenzaFine.push({ pdr: r.pdr_nome, id_ordine: senzaData.join(', ') });
    conDate.push(...ordiniConDateDaSistemare(r.pdr_nome, ids, terminati, daSistemare));
    if (!Object.keys(campi).some(k => String(r[k] ?? '') !== String(campi[k] ?? ''))) continue;
    // chi diventa "ritirata, da spuntare" adesso va detto: e' la riga su cui rispondere al consorzio
    // Chi si e' chiusa da sola adesso va detta: e' la riga su cui rispondere al consorzio.
    if (campi.esito === 'evasa' && r.esito !== 'evasa') daConfermare.push({ pdr: r.pdr_nome, id_ordine: ids.join(', '), evasa_il: campi.evasione_rilevata_il });
    await svc.RichiestaEct.update(r.id, campi);
    aggiornate++;
  }
  for (const r of evase) conDate.push(...ordiniConDateDaSistemare(r.pdr_nome, listaOrdini(r), terminati, daSistemare));
  return { controllate: richieste.length, aggiornate, da_confermare: daConfermare, terminati_senza_fine: terminatiSenzaFine, ordini_con_date_da_sistemare: conDate };
}

// Il caricamento delle primarie che tiene gli archivi in ballo: in corso adesso,
// oppure rimasto interrotto o finito male dopo lo svuotamento. Lo legge dal
// registro (statoCaricamenti). Serve a due punti diversi: ai ritiri delle
// richieste, che si rinviano, e alla preparazione di un nuovo caricamento, a cui
// dice che il controllo anti-regressione non ha piu' niente da confrontare.
async function caricamentoPrimarieAperto(base44) {
  const { in_corso } = await statoCaricamenti(base44, ['primarie']);
  return in_corso.length ? in_corso[0] : null;
}

/**
 * "del 21/09/2026 di Mario Rossi (primarie.xlsx)": di quale caricamento si sta
 * parlando, per i messaggi a video. La data si scrive all'italiana con
 * dataItaliana, come in tutto il resto del gestionale: c.data e' il giorno in
 * forma AAAA-MM-GG e scritto cosi' com'e' usciva "del 2026-09-23".
 *
 * Non si chiama descriviCaricamento perche' quel nome e' gia' preso in
 * reportSettimanali.ts, dove dice anche il tipo di file e com'e' finito: due
 * funzioni con lo stesso nome nello stesso gestionale si scambiano per sbaglio.
 */
function qualeCaricamento(c) {
  return `del ${dataItaliana(c.data)}${c.utente ? ` di ${c.utente}` : ''}${c.nome_file ? ` (${c.nome_file})` : ''}`;
}

/**
 * Il nome di un archivio come lo chiama chi lavora ("Primarie RETE"), non come
 * si chiama nel database ("PrimariaRete"). Il nome buono lo manda il browser;
 * senza, resta quello tecnico, che e' meglio di niente ma non si legge.
 */
const nomeArchivio = (body, entita) => String((body && body.nome) || entita || '');

// Gli ordini delle richieste si cercano fra primarie e assegnati: se il loro
// archivio si sta riscrivendo, o un caricamento l'ha lasciato a meta', ID e ritiri
// letti adesso sarebbero sbagliati e verrebbero salvati. Si rinvia (409) dicendo
// quale caricamento lo impedisce; si rifa' a caricamento concluso.
async function rinvioPerCaricamento(base44) {
  const c = await caricamentoPrimarieAperto(base44);
  if (!c) return null;
  return c.interrotto
    ? `Rinviato: il caricamento delle primarie ${qualeCaricamento(c)} e' rimasto interrotto e l'archivio puo' essere incompleto. Ricarica il file delle primarie.`
    : `Rinviato: caricamento delle primarie ${qualeCaricamento(c)} in corso. I ritiri si riconoscono quando finisce.`;
}

export default async function(req) {
  const t0 = Date.now();
  let fase = 'avvio';
  let archivioSvuotato = false;
  // "DATI INTATTI" SI PUO' DIRE SOLO SE NON SI E' TENTATO NIENTE.
  //
  // Prima questo dipendeva da un contatore: "non ho ancora contato nessuna
  // cancellazione riuscita, quindi i dati sono intatti". Ma un deleteMany che
  // va in timeout puo' essere stato eseguito lo stesso - e' proprio il caso che
  // eInterruzione riconosce - e allora la risposta 500 diceva "dati intatti" su
  // un archivio da cui erano appena sparite cinquanta righe. Il browser ci
  // credeva, usciva senza ricontare, e a video si leggeva che quelle righe
  // erano "di troppo" chiamandole per nome.
  //
  // Da qui in poi vale la regola semplice: appena una richiesta di
  // cancellazione e' PARTITA, i dati POSSONO essere cambiati e non si dichiara
  // piu' niente. L'unica eccezione e' il limite di richieste (429): quella e'
  // una porta chiusa PRIMA dell'esecuzione, la richiesta non e' mai arrivata al
  // database.
  let cancellazionePartita = false;

  try {
    fase = 'autenticazione';
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized', dati_intatti: true }, { status: 401 });

    fase = 'lettura della richiesta';
    const body = await req.json();
    const {
      azione, tipo_file, nome_file, intestazioni, righe, blocco,
      totale_righe, conferma_forzatura, atteso, minimo,
    } = body;

    // Il permesso dipende dal file: l'operatore base carica primarie, secondarie
    // e terziarie, l'amministratore tutto.
    const livello = await livelloDi(base44, user);
    if (!puoCaricare(livello, tipo_file)) return rispostaCaricamentoNegato(livello, tipo_file);

    const config = SHEET_MAP[tipo_file];
    if (!config) {
      return Response.json({ error: 'tipo_file non valido: ' + tipo_file, dati_intatti: true }, { status: 400 });
    }
    const primarie = tipo_file === 'primarie';

    // === ALLINEAMENTO delle dichiarazioni mensili al report appena caricato ===
    // Succedeva solo nell'importazione lato server (importEcotyreFile), che per
    // questo report non si usa piu' da quando si legge nel browser: le nostre
    // dichiarazioni restavano "non caricate" e la giacenza calcolata della
    // quadratura restava alta proprio del mese gia' dichiarato. Si allinea ogni
    // anno presente nel report, come fa il pulsante di Dichiarazioni Impianti.
    if (azione === 'allinea') {
      if (tipo_file !== 'dichiarazioni_trattamento') return Response.json({ error: 'Azione non prevista per ' + tipo_file, dati_intatti: true }, { status: 400 });
      fase = 'allineamento delle dichiarazioni mensili';
      const svc = base44.asServiceRole.entities;
      const righePortale = await fetchAll(svc.DichiarazioneTrattamento, null, 'id');
      // L'anno del giorno italiano, come lo legge allineaDalPortale: tagliando la
      // stringa UTC un caricamento del 1 gennaio a mezzanotte italiana cadeva
      // nell'anno prima, e il suo anno restava fuori.
      const anni = [...new Set(righePortale.map(r => annoRoma(r.data_dichiarazione)).filter(Boolean))].sort((x, y) => x - y);
      const aggiornate = [];
      const nonTrovate = [];
      for (const a of anni) {
        const esito = await allineaDalPortale(svc, a, righePortale);
        aggiornate.push(...esito.aggiornate.map(x => ({ ...x, anno: a })));
        // Con l'anno, chi le mostra distingue i mesi dell'ultimo anno, che possono
        // ancora comparire, da quelli degli anni chiusi.
        nonTrovate.push(...esito.non_trovate.map(x => ({ ...x, anno: a })));
      }
      // Nel registro, accanto al caricamento, come faceva l'importazione lato server.
      fase = 'nota nel registro caricamenti';
      const [ultimo] = await svc.UploadLog.filter({ tipo_file }, '-created_date', 1);
      if (ultimo && (ultimo.esito === 'successo' || ultimo.esito === 'parziale') && !String(ultimo.messaggio || '').includes('dichiarazioni riconosciute a portale')) {
        await svc.UploadLog.update(ultimo.id, { messaggio: `${ultimo.messaggio || ''} | dichiarazioni riconosciute a portale: ${perCanale(aggiornate)}` });
      }
      return Response.json({ allineamento: { anni: anni.map(Number), aggiornate, non_trovate: nonTrovate }, dati_intatti: true });
    }

    // === NOTA: i moduli collegati sono stati rifatti ===
    // Il registro e' l'unico posto che sopravvive alla scheda chiusa. Un
    // caricamento riuscito senza questa nota e' un caricamento i cui ricalcoli
    // sono rimasti appesi: chi apre la pagina li fa ripartire da solo
    // (ricalcoliDaRecuperare). E' la seconda regola: ogni caricamento aggiorna
    // tutto, anche quando la scheda si chiude a meta'.
    if (azione === 'moduli_aggiornati') {
      fase = 'nota dei moduli aggiornati nel registro';
      const svc = base44.asServiceRole.entities;
      // La stessa regola di ricalcoliDaRecuperare e di caricamentoAperto nel
      // browser: si scavalcano i rifiuti a dati intatti ("errore"), che il
      // codice stesso scrive a ogni 409 dei controlli anti-regressione.
      // Guardando solo la riga piu' recente bastava un tentativo rifiutato dopo
      // il caricamento riuscito perche' la nota non si attaccasse mai piu': i
      // ricalcoli di quel tipo ripartivano a ogni apertura della pagina, all'infinito.
      const righe = await svc.UploadLog.filter({ tipo_file }, '-created_date', 10);
      const ultimo = (righe || []).find(r => r.esito !== 'errore');
      if (ultimo && ultimo.esito === 'successo' && !String(ultimo.messaggio || '').includes(MODULI_AGGIORNATI)) {
        await svc.UploadLog.update(ultimo.id, { messaggio: `${ultimo.messaggio || ''} | ${MODULI_AGGIORNATI}` });
        return Response.json({ segnato: true, dati_intatti: true });
      }
      return Response.json({ segnato: false, dati_intatti: true });
    }

    // === RITIRI delle richieste del consorzio, fra i terminati appena caricati ===
    if (azione === 'ritiri_ect') {
      if (!primarie) return Response.json({ error: 'Azione non prevista per ' + tipo_file, dati_intatti: true }, { status: 400 });
      fase = 'controllo dei caricamenti in corso';
      const rinvio = await rinvioPerCaricamento(base44);
      if (rinvio) return Response.json({ error: rinvio, rinviato: true, dati_intatti: true }, { status: 409 });
      fase = 'riconoscimento dei ritiri delle richieste ECT';
      return Response.json({ ...(await riconosciRitiriEct(base44)), dati_intatti: true });
    }

    if (primarie && azione !== 'prepara' && azione !== 'registra' && !ARCHIVI_PRIMARIE.includes(body.entita)) {
      return Response.json({ error: 'Archivio delle primarie non valido: ' + body.entita, dati_intatti: true }, { status: 400 });
    }
    const entita = primarie ? body.entita : config.entity;

    // === CONTEGGIO: quante righe contiene ora l'archivio ===
    // conteggio null vuol dire "non si e' riusciti a contare", mai zero: il
    // browser lo deve dichiarare, non darlo per buono.
    if (azione === 'conta') {
      fase = 'conteggio archivio';
      const conteggio = await contaRecord(base44, entita, [atteso, minimo], t0);
      return Response.json({ conteggio, contato: conteggio !== null, dati_intatti: true });
    }

    // === CONTEGGIO ESATTO: le righe di un archivio delle primarie, contate ===
    // E' il controllo con cui si chiude un caricamento delle primarie: se un
    // blocco e' entrato due volte le righe sono di piu' di quelle del file, e si
    // vede da qui. Si riprende da da_riga: una sola invocazione puo' non bastare.
    if (azione === 'conta_esatta') {
      if (!primarie) return Response.json({ error: 'Azione non prevista per ' + tipo_file, dati_intatti: true }, { status: 400 });
      // Nei messaggi l'archivio si chiama come lo chiama chi lavora ("Primarie
      // RETE"), non col nome che ha nel database: il nome buono lo manda il
      // browser insieme alla richiesta.
      fase = "conteggio esatto dell'archivio " + nomeArchivio(body, entita);
      const conta = await contaRigheArchivio(base44, entita, body.da_riga, body.dettaglio === true, t0);
      return Response.json({ ...conta, entita, dati_intatti: true });
    }

    // === CANCELLAZIONE MIRATA: solo le righe di certi ordini ===
    // La riparazione di un archivio che non quadra: invece di svuotare tutto e
    // riscrivere undicimila righe, si tolgono le righe degli ordini sbagliati e
    // si riscrivono solo quelle. Cinquantasette righe sono un attimo.
    //
    // Si cancella A LOTTI, con un filtro $in per lotto. Un ordine per richiesta
    // voleva dire duecento richieste dentro una sola invocazione, contro un
    // limite di circa settanta al minuto PER TUTTA L'APP: si finiva in 429,
    // l'invocazione sfondava i dodici secondi e la riparazione si fermava a
    // meta', cioe' dopo aver cancellato e prima di riscrivere. Con i lotti da
    // cinquanta duecento ordini sono quattro richieste.
    //
    // Se la piattaforma non accettasse $in dentro deleteMany si ripiega su un
    // ordine per volta, ma solo fino a MAX_ORDINI_UNO_PER_VOLTA: oltre quella
    // soglia la riparazione si dichiara NON FATTA e non si tocca niente, invece
    // di provarci e rompere.
    if (azione === 'cancella_ordini') {
      if (!primarie) return Response.json({ error: 'Azione non prevista per ' + tipo_file, dati_intatti: true }, { status: 400 });
      const ordini = [...new Set((Array.isArray(body.ordini) ? body.ordini : []).map(o => String(o || '').trim()).filter(Boolean))];
      fase = `cancellazione di ${ordini.length} ordini dall'archivio ` + nomeArchivio(body, entita);
      // SI TOCCANO SOLO GLI ORDINI CHE IL FILE PORTA. E' l'ultima rete lato
      // server della regola che governa la riparazione: si puo' togliere solo
      // cio' che si e' in grado di riscrivere, e di un ordine che il file non
      // contiene non c'e' niente da riscrivere - cancellarlo vorrebbe dire
      // perderlo per sempre. E' proprio il caso dello storico conservato: quegli
      // ordini in archivio ci sono, nel file no, e restare e' esattamente cio'
      // che si vuole. Il freno vero sta nel browser, che non li manda affatto;
      // qui si rifiuta la richiesta per intero senza toccare niente, perche' se
      // arrivasse vorrebbe dire che il freno di la' si e' rotto.
      //
      // Il conto delle righe che il file porta a ciascun ordine lo manda il
      // browser (nel_file). Quando non arriva affatto il controllo si salta: e'
      // il patto con chi chiamava prima di questa rete, e non si rifiuta un
      // lavoro buono per un campo che non c'era.
      const nelFileDichiarate = (body && body.nel_file && typeof body.nel_file === 'object') ? body.nel_file : null;
      if (nelFileDichiarate) {
        const senzaFile = ordini.filter(id => !(Number(nelFileDichiarate[id]) > 0));
        if (senzaFile.length) {
          // Si risponde 200 con "non fatta", non un errore: un errore qui
          // arriverebbe al browser come non ritentabile e farebbe morire tutto il
          // caricamento dicendo "dati intatti" quando i blocchi del file sono
          // gia' stati scritti. La riparazione si dichiara non fatta, il
          // caricamento resta parziale, i ricalcoli non partono e si ricarica il
          // file: come per ogni altro motivo per cui non si e' potuto riparare.
          return Response.json({
            cancellati: 0, finito: false, entita, non_fatta: true,
            motivo: "il file non contiene le righe di " + senzaFile.length + " di questi ordini, e togliere cio' che non si puo' riscrivere lo perderebbe per sempre",
            esempi: senzaFile.slice(0, 10), ordini_senza_file: senzaFile.length,
            dati_intatti: true,
          });
        }
      }
      const ent = base44.asServiceRole.entities[entita];
      let fatti = 0;
      let aUnoPerVolta = false;
      // DOPO AVER CANCELLATO NON SI RILEGGE PER DECIDERE.
      //
      // Qui c'era un controllo: dopo il primo lotto si rileggevano gli ordini
      // toccati e, se le righe si leggevano ancora, si rispondeva "il filtro a
      // lotti e' stato ignorato, non ho tolto niente". Era l'unico punto di
      // tutto il caricamento in cui un verdetto nasceva da UNA LETTURA SOLA
      // presa a zero secondi da una scrittura - cioe' il punto piu' esposto che
      // esista - e su una lettura in ritardo buttava via cinquanta ordini del
      // file scrivendo a video che non aveva tolto niente: le righe sparivano
      // davvero, la riparazione si fermava li' e nemmeno lo storico conservava
      // chi avesse fatto il buco. Misurato dai revisori: otto caricamenti su
      // centoventi perdevano da 50 a 300 righe, e tutti per questo controllo.
      //
      // Il rischio da cui difendeva - una piattaforma che ACCETTA $in dentro
      // deleteMany e non toglie niente - non e' mai stato osservato, e $in in
      // lettura funziona (lo usano getOrdiniDaDichiarare, reportSettimanali e
      // testoLungo). Se davvero fosse ignorato, i doppioni che ne nascono li
      // prende il confronto ordine per ordine del giro dopo, che e' il posto
      // giusto: la riparazione toglie e riscrive, quindi converge, e il
      // caricamento resta "parziale" con le righe di troppo dette per nome.
      //
      // DA PROVARE UNA VOLTA SU UN ARCHIVIO DI SERVIZIO: che
      // deleteMany({ id_ordine: { $in: [...] } }) tolga esattamente quegli
      // ordini e nessun altro. E' l'unica verifica che vale, e va fatta a mano,
      // non dentro un caricamento vero.
      //
      // QUANTI NE HA TOLTI SI DICE SEMPRE, ANCHE QUANDO FINISCE MALE. Un lotto
      // passa e il secondo cade - la rete, i dodici secondi, il database -: se
      // qui si rilanciasse l'errore, il browser leggerebbe "non ho toccato
      // niente" e costruirebbe il verdetto sui numeri di prima. A video
      // uscivano cinquanta ordini "di troppo" con i nomi di ordini che la
      // riparazione aveva appena tolto. Con qualcosa di gia' cancellato si
      // risponde 200 dicendo quanti, "interrotto", e chi chiama riconta.
      // Solo a dati intatti (niente cancellato) l'errore si ripropone.
      let interrotto = null;
      for (let i = 0; i < ordini.length && !interrotto; i += LOTTO_CANCELLAZIONE) {
        const lotto = ordini.slice(i, i + LOTTO_CANCELLAZIONE);
        if (!aUnoPerVolta) {
          try {
            cancellazionePartita = true;
            await ent.deleteMany({ id_ordine: { $in: lotto } });
            fatti += lotto.length;
            if (Date.now() - t0 > LIMITE_INVOCAZIONE_MS) break;
            continue;
          } catch (e) {
            // Il limite di richieste e' una porta chiusa PRIMA dell'esecuzione:
            // quella richiesta non e' arrivata al database, quindi da sola non
            // toglie il diritto di dire "dati intatti".
            if (eLimiteRichieste(e)) cancellazionePartita = fatti > 0;
            // Una caduta di rete e un rifiuto per il limite di richieste NON
            // sono un rifiuto del filtro a lotti: ripiegare su un ordine per
            // volta vorrebbe dire sparare altre cinquanta richieste proprio
            // mentre l'app e' al limite (settanta al minuto per tutta l'app).
            // Si ripropone a chi chiama SOLO se la richiesta non e' nemmeno
            // partita, cioe' solo per il limite di richieste: un timeout puo'
            // essere stato eseguito lo stesso, e allora si risponde 200
            // dicendo che non si sa (dati_intatti: false), perche' il browser
            // deve ricontare invece di fidarsi dei numeri di prima.
            if (eInterruzione(e) || eLimiteRichieste(e)) {
              if (!fatti && !cancellazionePartita) throw e;
              interrotto = e && e.message ? e.message : String(e);
              break;
            }
            aUnoPerVolta = true;
            if (ordini.length > MAX_ORDINI_UNO_PER_VOLTA) {
              return Response.json({
                cancellati: fatti, finito: false, entita, a_uno_per_volta: true,
                non_fatta: fatti === 0, troppi_ordini: MAX_ORDINI_UNO_PER_VOLTA,
                motivo: `la cancellazione a lotti non e' stata accettata e ${ordini.length} ordini sono troppi da togliere uno per uno`,
                dati_intatti: fatti === 0 && !cancellazionePartita,
              });
            }
          }
        }
        for (const ordine of lotto) {
          try {
            cancellazionePartita = true;
            await ent.deleteMany({ id_ordine: ordine });
          } catch (e) {
            if (eLimiteRichieste(e)) cancellazionePartita = fatti > 0;
            if (!fatti && !cancellazionePartita) throw e;
            interrotto = e && e.message ? e.message : String(e);
            break;
          }
          fatti++;
          if (Date.now() - t0 > LIMITE_INVOCAZIONE_MS) break;
        }
        if (Date.now() - t0 > LIMITE_INVOCAZIONE_MS) break;
      }
      return Response.json({
        cancellati: fatti, finito: !interrotto && fatti >= ordini.length, entita,
        a_uno_per_volta: aUnoPerVolta || undefined,
        interrotto: interrotto || undefined,
        // Non "il mio contatore e' a zero": "non ho tentato niente". Un
        // deleteMany partito e finito male puo' essere stato eseguito lo stesso.
        dati_intatti: fatti === 0 && !cancellazionePartita,
      });
    }

    // === SVUOTAMENTO di un archivio delle primarie, subito prima di riscriverlo ===
    //
    // NON SI SVUOTA PIU' A ZERO: si porta l'archivio alla BASE NOTA. Un file che
    // comincia dall'anno scorso conserva i terminati degli anni prima
    // (shared/storicoConservato.ts, regola dell'utente del 25/09/2026): quelli
    // restano, tutto il resto si cancella. Senza niente da conservare
    // svuotaTranne fa esattamente il deleteMany({}) di sempre: la cancellazione
    // resta quella veloce, in piu' c'e' solo la lettura dell'archivio che serve a
    // sapere che cosa tenere.
    if (azione === 'svuota') {
      if (!primarie) return Response.json({ error: 'Azione non prevista per ' + tipo_file, dati_intatti: true }, { status: 400 });
      // Anche qui l'archivio si chiama come lo chiama chi lavora ("Primarie
      // RETE"): questa fase finisce nei messaggi d'errore come le altre.
      fase = "svuotamento dell'archivio " + nomeArchivio(body, entita);
      const annoInizio = annoInizioPrimarie();
      let conservati = { ordini: new Set(), righe: 0 };
      let archivio = [];
      // Senza gli ID del file non si sa che cosa manca, e non si conserva niente:
      // per questo il browser li manda SEMPRE su questi archivi, non solo quando
      // la preparazione ha contato qualcosa da conservare (era il varco da cui una
      // preparazione muta faceva cancellare lo storico in silenzio). Qui i
      // conservati si RICALCOLANO da zero: e' la seconda delle due letture dello
      // storico, e chi chiama confronta i due numeri prima di scrivere il file.
      if (annoInizio && ARCHIVI_CON_STORICO.includes(entita) && Array.isArray(body.ids) && body.ids.length) {
        archivio = await recordArchivio(base44, entita);
        conservati = ordiniDaConservare(archivio, new Set(body.ids.map(String)));
      }
      archivioSvuotato = true;
      // Il budget dei dodici secondi vale anche qui: togliere migliaia di ordini
      // a blocchi puo' non starci in un'invocazione, e farsi tagliare a meta'
      // vorrebbe dire una cancellazione fatta per meta' che nessuno sa dove sia
      // arrivata. Si dice dove si e' arrivati e il browser richiama.
      const esito = await svuotaTranne(base44.asServiceRole.entities[entita], archivio, conservati.ordini, sleep, {
        senzaErrore: true, limiteMs: LIMITE_INVOCAZIONE_MS, t0,
      });
      // IL FILTRO PER ID NON REGGE: non si e' toccato niente e il rimedio e' uno
      // solo, ricaricare l'export completo dal primo anno. Si risponde 200 con
      // il motivo invece di lanciare: un 500 il browser lo ritenta alla cieca e
      // poi chiude con "svuotamento incompleto", perdendo per strada proprio la
      // frase che spiega che cosa fare.
      if (esito.non_fatta) {
        return Response.json({
          svuotato: false, entita, non_fatta: true, motivo: esito.motivo, dati_intatti: true,
        });
      }
      return Response.json({
        svuotato: esito.finito !== false, entita, conservati: conservati.righe,
        // Non e' finita: si dice quanti ordini sono usciti e il browser richiama
        // per riprendere da li'.
        ripartire: esito.finito === false || undefined,
        cancellati_ordini: esito.cancellati_ordini,
      });
    }

    // === REGISTRAZIONE delle primarie: un riepilogo per archivio ===
    if (azione === 'registra' && primarie) {
      fase = 'scrittura registro caricamenti';
      const archivi = body.archivi || {};
      const n = (a, k) => Number(archivi[a] && archivi[a][k]) || 0;
      // Nel registro gli archivi si chiamano come li chiama chi lavora ("Primarie
      // RETE"), non col nome dell'archivio nel database: il nome buono lo manda
      // il browser insieme ai numeri.
      const nome = (a) => String((archivi[a] && archivi[a].nome) || a);
      const fallite = ARCHIVI_PRIMARIE.reduce((s, a) => s + n(a, 'fallite'), 0);
      // Le righe dello STORICO conservato che non ci sono piu'. Si tolgono dal
      // conto qui sotto - un archivio a cui manca solo quello col file torna, e
      // ricaricare lo stesso file non le rimette - ma il caricamento resta
      // parziale lo stesso, e la perdita si dice con la sua frase e il suo
      // rimedio (piu' avanti).
      const storicoPerso = ARCHIVI_PRIMARIE.reduce((s, a) => s + n(a, 'storico_perso'), 0);
      // Il giudizio sta tutto qui: le righe che l'archivio ha davvero contro le
      // righe che il file gli porta. Un blocco entrato due volte ne fa 200 di
      // troppo, un blocco perso 200 di meno, e in tutti e due i casi il
      // caricamento non e' riuscito. Gli id_ordine NON entrano nel giudizio: lo
      // stesso ordine sta in archivio con piu' righe, una per classe o per
      // prodotto, ed e' giusto cosi' (chiaveOrdine in shared/movimenti.ts).
      const disallineati = ARCHIVI_PRIMARIE.filter(a => archivi[a] && typeof archivi[a].archivio === 'number' && archivi[a].archivio !== n(a, 'attese') - n(a, 'storico_perso'));
      // Il totale delle righe non basta: un blocco entrato due volte (+200) e uno
      // mai arrivato (-200) si compensano e il conto torna. Il browser confronta
      // quindi ORDINE PER ORDINE le righe in archivio con quelle del file e manda
      // quanti ordini non tornano: se ce n'e' anche uno solo il caricamento non e'
      // riuscito, per quanto il totale quadri.
      const ordiniSbagliati = ARCHIVI_PRIMARIE.reduce((s, a) => s + n(a, 'ordini_sbagliati'), 0);
      const conOrdiniSbagliati = ARCHIVI_PRIMARIE.filter(a => n(a, 'ordini_sbagliati') > 0);
      // Righe di troppo e righe mancanti sono due guasti diversi, e per chi
      // lavora "righe di troppo" vuol dire pesi contati doppi. Il browser manda i
      // due numeri separati: con la sola somma il registro diceva sempre "ci sono
      // righe di troppo e righe mancanti insieme", anche la notte delle 57 righe
      // perse, dove di troppo non ce n'era nemmeno una.
      const ordiniInPiu = ARCHIVI_PRIMARIE.reduce((s, a) => s + n(a, 'ordini_in_piu'), 0);
      const ordiniMancanti = ARCHIVI_PRIMARIE.reduce((s, a) => s + n(a, 'ordini_mancanti'), 0);
      // Un archivio che non si e' riusciti a contare non e' un archivio a posto:
      // un blocco entrato due volte non si vedrebbe. Prima questi archivi si
      // saltavano e il caricamento si chiudeva come riuscito con i doppioni
      // dentro; adesso il caricamento resta "parziale" e lo dice.
      const nonContati = ARCHIVI_PRIMARIE.filter(a => !archivi[a] || typeof archivi[a].archivio !== 'number');
      // Non contato, non fermo su un numero e lettura che smentisce le
      // scritture confermate sono TRE COSE DIVERSE: scritte tutte come "archivi
      // non contati" il registro diceva una cosa e la riga sotto la scheda
      // un'altra, sullo stesso archivio e nello stesso momento.
      const instabili = nonContati.filter(a => archivi[a] && archivi[a].instabile);
      const incoerenti = nonContati.filter(a => archivi[a] && !archivi[a].instabile && archivi[a].lettura_incoerente);
      // E LA QUARTA: l'archivio ha risposto benissimo, ma restano ordini che le
      // scritture confermate non coprono. Il browser manda il campo e qui
      // finiva fra i "non letti", cosi' lo storico scriveva "archivi non
      // contati: Primarie RETE" di un archivio contato dieci volte - e il
      // motivo vero, che e' un altro, non si leggeva da nessuna parte.
      const nonConfermati = nonContati.filter(a => archivi[a] && !archivi[a].instabile && !archivi[a].lettura_incoerente && archivi[a].non_confermato);
      const nonLetti = nonContati.filter(a => !instabili.includes(a) && !incoerenti.includes(a) && !nonConfermati.includes(a));
      const incerte = ARCHIVI_PRIMARIE.reduce((s, a) => s + n(a, 'incerte'), 0);
      // Le righe entrate sono tutte quelle del file, assegnati compresi: contando
      // solo rete e ACI lo storico diceva 10.817 su un file di 11.293 righe, e
      // proprio quando si vuole capire se e' entrato tutto quel numero
      // confondeva. I quattro archivi restano distinti nel messaggio: qui si
      // conta quanto del FILE e' entrato, non si sommano canali.
      const scritte = ARCHIVI_PRIMARIE.reduce((s, a) => s + n(a, 'scritte'), 0);
      // "RIMESSE A POSTO" SI DICE SOLO DEGLI ARCHIVI CHE POI TORNANO COL FILE.
      //
      // Il numero da solo e' quante righe la riparazione ha cancellato e
      // riscritto, e non dice affatto che l'archivio sia a posto: quando la
      // cancellazione viene accettata senza togliere niente, quelle stesse
      // righe sono state AGGIUNTE, l'archivio e' passato da 650 a 850 righe su
      // 450 e lo storico scriveva lo stesso "200 righe rimesse a posto da
      // sole". La finestra, nello stesso momento, diceva la cosa giusta ("ci ha
      // provato, ma non e' arrivato in fondo"): resta il registro, e diceva il
      // contrario. Il campo per distinguerli - quadra - arriva gia' dal browser.
      const rimessi = ARCHIVI_PRIMARIE.filter(a => archivi[a] && archivi[a].quadra && n(a, 'riparate') > 0);
      const provatiSenzaRiuscire = ARCHIVI_PRIMARIE.filter(a => archivi[a] && !archivi[a].quadra && n(a, 'riparate') > 0);
      const riparate = rimessi.reduce((s, a) => s + n(a, 'riparate'), 0);
      const esito = fallite === 0 && disallineati.length === 0 && nonContati.length === 0
        && ordiniSbagliati === 0 && incerte === 0 && storicoPerso === 0 && scritte > 0
        ? 'successo' : (scritte > 0 ? 'parziale' : 'errore');
      let messaggio = `${scritte} righe del file entrate in archivio — Rete: ${n('PrimariaRete', 'scritte')} | ACI: ${n('PrimariaAci', 'scritte')} | Ass. Rete: ${n('Assegnato', 'scritte')} | Ass. ACI: ${n('AssegnatoAci', 'scritte')} (lettura nel browser)`;
      // Le righe TOLTE non sono state "rimesse a posto": erano di troppo per
      // intero e adesso non ci sono piu'. Si dicono separate da quelle
      // riscritte, come fa gia' la riga sotto la scheda.
      const tolte = rimessi.reduce((s, a) => s + n(a, 'tolte'), 0);
      // PERCHE' la riparazione e' partita. Da quando gira anche su un archivio
      // che torna - per sciogliere il dubbio di un blocco che la piattaforma non
      // ha confermato - "dopo il primo controllo" faceva credere che al primo
      // controllo mancasse qualcosa. Non mancava: mancava la conferma. E' la
      // notizia dell'incidente del 24/09 scritta per sbaglio, e resta nello
      // storico per sempre.
      const soloPerDubbio = rimessi.length > 0 && rimessi.every(a => archivi[a].riparato_solo_per_dubbio === true);
      const quando = soloPerDubbio
        ? "perche' la piattaforma non aveva confermato che fossero entrate una volta sola"
        : 'dopo il primo controllo';
      if (riparate > 0) {
        // Quando la riparazione ha solo tolto, "0 righe riscritte e 50 righe di
        // troppo tolte" e' vero e sciatto: il pezzo a zero non si stampa.
        const riscritte = riparate - tolte;
        messaggio += tolte > 0 && riscritte > 0
          ? ` — ${riscritte} righe riscritte e ${tolte} righe di troppo tolte da sole ${quando}`
          : (tolte > 0
            ? ` — ${tolte} righe di troppo tolte da sole ${quando}`
            : ` — ${riparate} righe ${soloPerDubbio ? 'tolte e riscritte' : 'rimesse a posto'} da sole ${quando}`);
      }
      // E dove ci ha provato senza riuscirci si scrive quello, non "rimesse a
      // posto": e' la stessa cosa che dice la finestra.
      if (provatiSenzaRiuscire.length) {
        messaggio += ' — il gestionale ha provato a rimettere a posto '
          + provatiSenzaRiuscire.map(a => `${n(a, 'riparate')} righe di ${nome(a)}`).join(', ')
          + " e non e' bastato";
      }
      // CHI HA FATTO IL BUCO RESTA SCRITTO. Se la riparazione ha tolto delle
      // righe e non e' riuscita a rimetterle, sullo schermo di chi ha caricato
      // c'era scritto; qui no, e la scheda si chiude. Chi guarda lo storico
      // domani leggeva soltanto "in archivio mancano delle righe" e andava a
      // cercare un guasto del file. Lo stesso per una cancellazione partita di
      // cui non si e' saputo come sia finita.
      // ...e solo se ne ha tolta almeno una: "Primarie RETE 0" scritto dopo
      // "righe tolte dalla riparazione e non rimesse" e' una frase che si
      // smentisce da sola. Succede quando la cancellazione viene accettata e
      // non toglie niente: li' il buco non lo ha fatto il gestionale.
      const tolteDaRiparazione = ARCHIVI_PRIMARIE.filter(a => archivi[a] && archivi[a].cancellato && !archivi[a].quadra && n(a, 'riparate') === 0 && n(a, 'tolte_dal_gestionale') > 0);
      const cancellazioniIncerte = ARCHIVI_PRIMARIE.filter(a => archivi[a] && archivi[a].cancellazione_incerta && !archivi[a].quadra);
      if (tolteDaRiparazione.length) {
        // QUANTE righe ha tolto davvero, non "il buco". Fra gli ordini rimessi a
        // posto ci sono quasi sempre quelli che in archivio non avevano nessuna
        // riga - le righe mai entrate - e questa frase, scritta intera, si
        // prendeva anche quelle: bastava una riga tolta su cinquantuno perche'
        // lo storico attribuisse al gestionale tutto il buco, per sempre.
        messaggio += ' — righe tolte dalla riparazione e non rimesse: '
          + tolteDaRiparazione.map(a => `${nome(a)} ${n(a, 'tolte_dal_gestionale')}`).join(', ')
          + ': quelle le ha tolte il gestionale, non il file; le altre che mancassero non erano mai entrate';
      }
      if (cancellazioniIncerte.length) {
        // "I numeri qui sopra sono quelli di dopo" si puo' dire solo degli
        // archivi che si sono potuti ricontare. Sugli altri il gestionale ha
        // appena scritto di non essere riuscito a contarli, e le due frasi si
        // smentivano nella stessa riga di storico.
        const conNumeri = cancellazioniIncerte.filter(a => !nonContati.includes(a));
        const senzaNumeri = cancellazioniIncerte.filter(a => nonContati.includes(a));
        if (conNumeri.length) {
          messaggio += ' — la riparazione ha chiesto di togliere righe da ' + conNumeri.map(nome).join(', ')
            + " senza sapere come sia andata: i numeri qui sopra sono quelli di dopo";
        }
        if (senzaNumeri.length) {
          messaggio += ' — la riparazione ha chiesto di togliere righe da ' + senzaNumeri.map(nome).join(', ')
            + " senza sapere come sia andata, e l'archivio non si e' potuto ricontare: non si sa quante righe ci siano adesso";
        }
      }
      if (fallite > 0) messaggio += ` — ${fallite} righe non scritte`;
      // LO STORICO CONSERVATO RESTA SCRITTO. Chi rilegge il registro fra sei
      // mesi trova un archivio piu' grande del file: senza questa riga non ha
      // modo di capire perche', e va a cercare un guasto che non c'e'.
      const conservate = ARCHIVI_PRIMARIE.reduce((s, a) => s + n(a, 'conservati'), 0);
      // E QUANTE DI QUELLE RIGHE SONO DI ORDINI "ESEGUITO". Si conservano come i
      // terminati perche' sono un passaggio - al caricamento dopo il portale da'
      // loro lo stato definitivo - ma "terminati" non sarebbe vero, e l'utente
      // ha chiesto che vengano segnalati: qui restano scritti per sempre.
      const eseguiteConservate = ARCHIVI_PRIMARIE.reduce((s, a) => s + n(a, 'conservati_eseguiti'), 0);
      if (conservate > 0) {
        messaggio += ` — storico conservato: ${conservate} righe di ordini ${eseguiteConservate > 0 ? 'terminati o eseguiti' : 'terminati'} che il file non contiene, rimaste in archivio`;
        if (eseguiteConservate > 0) {
          messaggio += ` (di cui ${eseguiteConservate} di ordini in stato "eseguito", da chiudere a portale)`;
        }
      }
      // LO STORICO CHE NON TORNA PIU'. Righe degli anni prima che non ci sono
      // piu': il file non le contiene, quindi ricaricare lo stesso file non le
      // rimette e l'archivio non risulta "non allineato". Senza questa riga la
      // perdita non resterebbe scritta da nessuna parte.
      if (storicoPerso > 0) {
        messaggio += ` — storico conservato non piu' completo: ${storicoPerso === 1 ? 'manca 1 riga' : `mancano ${storicoPerso} righe`} di ordini degli anni prima (`
          + ARCHIVI_PRIMARIE.filter(a => n(a, 'storico_perso') > 0).map(nome).join(', ')
          + "), che il file non contiene: serve un export completo dal primo anno";
      }
      // "SU N DEL FILE" SI DICE SOLO SE N E' DAVVERO DEL FILE: con lo storico
      // dentro, quel numero comprende righe che il file non porta.
      const attesePerScritto = (a) => (n(a, 'conservati') > 0
        ? `${n(a, 'attese')} fra il file e lo storico conservato`
        : `${n(a, 'attese')} del file`);
      if (disallineati.length) {
        messaggio += ' — archivio non allineato: ' + disallineati.map(a => `${nome(a)} ${n(a, 'archivio')} righe su ${attesePerScritto(a)}`).join(', ');
        // Piu' righe di quelle del file vuol dire che qualcosa e' entrato due
        // volte, e quei pesi adesso si contano doppi: va detto per nome.
        messaggio += disallineati.some(a => n(a, 'archivio') > n(a, 'attese'))
          ? ': ci sono righe di troppo, un blocco puo' + "' essere entrato due volte. Ricarica lo stesso file"
          : ': ricarica lo stesso file';
      }
      if (conOrdiniSbagliati.length) {
        // Tre frasi distinte: mancano soltanto, avanzano soltanto, tutte e due.
        const che = ordiniInPiu > 0 && ordiniMancanti > 0
          ? "ci sono righe di troppo e righe mancanti insieme"
          : (ordiniInPiu > 0
            ? "ci sono righe di troppo, quei pesi adesso si contano doppi"
            : 'in archivio mancano delle righe, e quelle righe non entrano in nessun conto');
        messaggio += ' — ordini con un numero di righe diverso da quello del file: '
          + conOrdiniSbagliati.map(a => `${nome(a)} ${n(a, 'ordini_sbagliati')}`).join(', ')
          + `: ${che}. Ricarica lo stesso file`;
      }
      if (nonLetti.length) messaggio += ' — archivi non contati: ' + nonLetti.map(nome).join(', ') + ": non si sa se le righe ci siano tutte e una volta sola, ricarica lo stesso file";
      // La stessa frase della riga sotto la scheda e della finestra: e' lo
      // stato nuovo, e su tutte e tre le superfici si dice allo stesso modo.
      if (nonConfermati.length) {
        messaggio += ' — ordini che la piattaforma non ha confermato: '
          + nonConfermati.map(a => `${nome(a)} ${n(a, 'ordini_non_confermati')}`).join(', ')
          + ": la scrittura non ha risposto e il gestionale non e' riuscito a rifarle da solo, il conteggio da solo non basta a dire che le righe siano entrate una volta sola: ricarica lo stesso file";
      }
      if (instabili.length) messaggio += ' — archivi che non si sono fermati su un numero: ' + instabili.map(nome).join(', ') + ": due conteggi di fila hanno dato numeri diversi, ricarica lo stesso file";
      if (incoerenti.length) messaggio += ' — archivi la cui lettura non e' + "' affidabile: " + incoerenti.map(nome).join(', ') + ': hanno risposto con meno righe di quante ne sono state scritte davvero, ricarica lo stesso file';
      if (incerte > 0) messaggio += ` — ${incerte} righe di cui non si sa se siano entrate`;
      // Gli ordini in stato "eseguito": a portale hanno tutti i dati ma nessuno
      // ha premuto Chiudi. Non sono terminati e non entrano in nessun conto: si
      // dicono, altrimenti spariscono in silenzio (regola dell'utente 24/09/2026).
      const eseguiti = body.eseguiti || null;
      if (eseguiti && (Number(eseguiti.rete_ordini) > 0 || Number(eseguiti.aci_ordini) > 0)) {
        const quote = [
          Number(eseguiti.rete_ordini) > 0 ? `rete ${eseguiti.rete_ordini}` : '',
          Number(eseguiti.aci_ordini) > 0 ? `ACI ${eseguiti.aci_ordini}` : '',
        ].filter(Boolean).join(', ');
        messaggio += ` — ${quote}: ordini con tutti i dati ma a portale non e' stato premuto Chiudi, non entrano in nessun conto`;
      }
      // La conferma al prossimo caricamento NON e' automatica: scatta solo se in
      // archivio restano meno ordini di quanti ce n'erano quando questo e'
      // partito. Promessa sempre, restava scritta nello storico anche quando il
      // caricamento dopo passava liscio. Il browser manda quanti ordini distinti
      // ci sono adesso in tutti e quattro gli archivi; se non e' riuscito a
      // contarli non si sa, e allora si dice "potrebbe".
      const ordiniAdesso = typeof body.ordini_in_archivio === 'number' ? body.ordini_in_archivio : null;
      const partenza = typeof body.righe_archivio_prima === 'number' ? body.righe_archivio_prima : null;
      if (esito !== 'successo' && partenza !== null) {
        if (ordiniAdesso === null) messaggio += ' — nota: al prossimo caricamento delle primarie potrebbe venire chiesta una conferma, perche' + "' questo ha gia' svuotato gli archivi";
        else if (ordiniAdesso < partenza) messaggio += ` — nota: al prossimo caricamento delle primarie verra' chiesta una conferma, perche' in archivio sono rimasti ${ordiniAdesso} ordini dei ${partenza} di prima`;
      }
      if (body.ultimo_errore) messaggio += ' — ultimo errore: ' + body.ultimo_errore;
      if (body.durata_secondi) messaggio += ` [durata: ${body.durata_secondi}s]`;
      await chiudiCaricamento(base44, user, tipo_file, {
        tipo_file, nome_file: nome_file || 'N/D',
        righe_importate: scritte, righe_fallite: fallite, esito, messaggio,
        righe_archivio_prima: typeof body.righe_archivio_prima === 'number' ? body.righe_archivio_prima : undefined,
        forzato: conferme(conferma_forzatura).size > 0 ? true : undefined,
        modalita: 'sostituzione',
      }, nonContati.length > 0 || incerte > 0);
      return Response.json({ registrato: true, esito });
    }

    // === REGISTRAZIONE: registro dei caricamenti a fine importazione ===
    if (azione === 'registra') {
      fase = 'scrittura registro caricamenti';
      const scritte = Number(body.righe_importate) || 0;
      const fallite = Number(body.righe_fallite) || 0;
      // Due cose diverse, due campi diversi, due frasi diverse. Prima un solo
      // flag "non_verificato" portava insieme "non si e' riusciti a contare
      // l'archivio" e "sono rimaste righe in sospeso", e la riga del registro si
      // contraddiceva da sola: "archivio verificato: 450 record — archivio non
      // verificato: non si e' riusciti a contarlo", tutto di seguito.
      const conteggioFinale = typeof body.conteggio_finale === 'number' ? body.conteggio_finale : null;
      const incerte = Number(body.righe_incerte) || 0;
      // Quante righe il file porta a quell'archivio. Senza questo confronto un
      // archivio con 650 righe su 450 del file chiudeva "successo" col messaggio
      // "archivio verificato: 650 record" - tre cose false nella stessa riga - e
      // nessun modulo si fermava: e' l'incidente del 14/09/2026 rimasto vivo sul
      // percorso che non e' quello delle primarie. Il numero il browser ce l'ha
      // gia' e lo manda insieme al resto.
      const attese = typeof body.totale_righe === 'number' ? body.totale_righe : null;
      const disallineato = conteggioFinale !== null && attese !== null && conteggioFinale !== attese;
      const esito = fallite === 0 && scritte > 0 && conteggioFinale !== null && !disallineato && incerte === 0
        ? 'successo' : (scritte > 0 ? 'parziale' : 'errore');
      const parti = [scritte + ' righe importate (lettura nel browser)'];
      if (fallite > 0) parti.push(fallite + ' righe non scritte');
      if (body.ultimo_errore) parti.push('ultimo errore: ' + body.ultimo_errore);
      if (disallineato) {
        parti.push(`archivio non allineato: ${conteggioFinale} righe su ${attese} del file`
          + (conteggioFinale > attese
            ? ": ci sono righe di troppo, un blocco puo' essere entrato due volte. Ricarica lo stesso file"
            : ': ricarica lo stesso file'));
      // "Verificato" era una parola piu' forte di quello che si e' fatto: qui
      // c'e' UN conteggio, preso subito dopo la scrittura, e subito dopo una
      // scrittura grossa la lettura puo' rispondere con un numero ancora
      // indietro. Si scrive che cosa ha risposto, non che e' stato verificato.
      } else if (conteggioFinale !== null) parti.push("archivio contato dopo la scrittura: " + conteggioFinale + ' record');
      // Due guasti diversi, due frasi diverse: il conteggio che non risponde e
      // il conteggio che risponde con meno righe di quante ne sono state
      // scritte davvero. Il secondo non e' un archivio a cui mancano righe, e'
      // una lettura da buttare, e scriverla nel registro la farebbe diventare
      // un numero vero per chi legge domani.
      else if (body.lettura_incoerente) parti.push("archivio non verificato: il conteggio ha risposto con meno righe di quante ne sono state scritte davvero, quindi non si e' usato: ricarica lo stesso file");
      else parti.push("archivio non verificato: non si e' riusciti a contarlo, non si sa se le righe ci siano tutte e una volta sola: ricarica lo stesso file");
      // Un blocco che la piattaforma non ha confermato puo' aver lasciato in
      // archivio zero righe, quelle giuste o il doppio: il conteggio non
      // distingue "ci sono una volta sola" da una lettura in ritardo, e qui non
      // c'e' la riparazione a scioglierlo. Si dice cosi', invece di chiudere
      // riuscito su un numero che non prova niente.
      if (incerte > 0) parti.push(incerte + " righe che la piattaforma non ha confermato: il conteggio da solo non dice se ci siano una volta sola, ricarica lo stesso file");
      await chiudiCaricamento(base44, user, tipo_file, {
        tipo_file, nome_file: nome_file || 'N/D',
        righe_importate: scritte, righe_fallite: fallite, esito,
        messaggio: parti.join(' — '),
        righe_archivio_prima: typeof body.righe_archivio_prima === 'number' ? body.righe_archivio_prima : undefined,
        forzato: conferme(conferma_forzatura).size > 0 ? true : undefined,
        modalita: 'sostituzione',
      }, conteggioFinale === null || incerte > 0);
      return Response.json({ registrato: true, esito });
    }

    // === PREPARAZIONE: validazione, anti-regressione, svuotamento ===
    if (azione === 'prepara') {
      fase = 'verifica della firma delle intestazioni';
      const sig = FILE_SIGNATURES[tipo_file];
      if (sig) {
        const headers = Array.isArray(intestazioni) ? intestazioni.map(h => String(h || '')) : [];
        const check = checkSignature(headers, sig);
        if (!check.match) {
          const rilevato = detectType(headers);
          const parti = [];
          if (check.chiave_mancanti.length > 0) parti.push('Colonne chiave mancanti: ' + check.chiave_mancanti.slice(0, 10).join(', '));
          if (check.vietate_trovate.length > 0) parti.push('Colonne vietate presenti: ' + check.vietate_trovate.join(', '));
          const risposta: any = {
            error: 'Formato file non valido',
            dettaglio: parti.join('. ') || 'Le intestazioni non corrispondono al tipo file richiesto',
            dati_intatti: true,
          };
          if (rilevato && rilevato !== tipo_file) {
            risposta.tipo_rilevato = `Il file caricato sembra di tipo ${rilevato.toUpperCase()} ma e' stato caricato nello slot ${tipo_file.toUpperCase()}`;
          }
          await base44.asServiceRole.entities.UploadLog.create({
            tipo_file, nome_file: nome_file || 'N/D', righe_importate: 0, righe_fallite: 0,
            esito: 'errore', messaggio: risposta.error + (risposta.tipo_rilevato ? ' - ' + risposta.tipo_rilevato : ''),
          });
          return Response.json(risposta, { status: 400 });
        }
      }

      if (!totale_righe || totale_righe === 0) {
        return Response.json({ error: 'Nessuna riga valida trovata nel file', dati_intatti: true }, { status: 400 });
      }

      if (primarie) {
        const erroreRegistrato = async (risposta, stato, messaggio, prima) => {
          await base44.asServiceRole.entities.UploadLog.create({
            tipo_file, nome_file: nome_file || 'N/D', righe_importate: 0, righe_fallite: 0,
            esito: 'errore', messaggio, righe_archivio_prima: prima, forzato: false,
          });
          return Response.json({ ...risposta, dati_intatti: true }, { status: stato });
        };

        if (!(Number(body.terminati) > 0)) {
          const error = "Il file non contiene alcun ordine terminato: sembra una selezione filtrata (es. soli assegnati), non l'export completo delle primarie.";
          return await erroreRegistrato({ error }, 400, error, undefined);
        }

        // Il caricamento precedente: serve subito dopo, per sapere se il
        // controllo anti-regressione ha ancora qualcosa da confrontare.
        fase = 'controllo del caricamento precedente';
        const precedente = await caricamentoPrimarieAperto(base44);
        const confermate = conferme(conferma_forzatura);

        // Un COLLEGA che sta caricando adesso non e' un tentativo morto: e'
        // qualcuno al lavoro. Prima si finiva nel 409 qui sotto, che gli diceva
        // che il caricamento di prima "si e' fermato" e gli offriva il pulsante
        // rosso; la verita' - "Mario sta caricando, aspetta" - la scopriva solo
        // dopo averlo premuto, perche' il blocco di concorrenza sta dentro
        // apriCaricamento, che gira dopo. Adesso glielo si dice subito, senza
        // chiedere nessuna conferma: non c'e' niente da forzare.
        if (precedente && precedente.utente && precedente.utente !== chi(user)
          && !precedente.interrotto && !precedente.non_riuscito && precedente.esito !== 'errore') {
          const da = daQuantoTempo(Date.now() - new Date(precedente.creato_il || precedente.data).getTime());
          const error = `${precedente.utente} sta caricando lo stesso archivio da ${da}: aspetta che finisca, altrimenti i due caricamenti si sovrascrivono.`;
          return Response.json({ error, caricamento_in_corso: precedente, dati_intatti: true }, { status: 409 });
        }

        // Ogni ordine in archivio deve essere anche nel file: un export filtrato per
        // data o per stato cancellerebbe gli ordini che non contiene.
        fase = 'controllo anti-regressione';
        const idFile = new Set((Array.isArray(body.ids) ? body.ids : []).map(String));
        const inArchivio = new Set();
        // CHI NON E' MANCANTE. Il portale filtra l'export per data di IMMISSIONE,
        // che per un terminato non dice niente: un terminato assente dal file
        // resta in archivio com'e' e non e' un ordine mancante
        // (shared/storicoConservato.ts, regola dell'utente del 25/09/2026). E i
        // cancellati immessi prima dell'anno del file non servono piu': si
        // lasciano andare senza chiedere niente. Senza questi due insiemi ogni
        // caricamento uscirebbe con migliaia di "ordini mancanti" e chiederebbe
        // la forzatura, e forzando cancellerebbe lo storico.
        const annoInizio = annoInizioPrimarie();
        const conservati = {};
        const daConservare = new Set();
        const daLasciare = new Set();
        for (const a of ARCHIVI_PRIMARIE) {
          if (annoInizio && ARCHIVI_CON_STORICO.includes(a)) {
            const archivio = await recordArchivio(base44, a);
            for (const r of archivio) if (r.id_ordine) inArchivio.add(String(r.id_ordine));
            const c = ordiniDaConservare(archivio, idFile);
            // Anche le righe di CIASCUN ordine conservato: al browser servono per
            // il confronto ordine per ordine di fine caricamento, che altrimenti
            // conterebbe lo storico come righe di troppo e la riparazione lo
            // cancellerebbe. Sono i soli ordini conservati, non tutto l'archivio.
            // Gli "eseguito" conservati si contano a parte perche' vanno DETTI
            // (regola dell'utente, 28/09/2026): immessi prima dell'anno scorso
            // restano fuori dall'export, quindi l'avviso sugli eseguiti - che
            // guarda il file - non li vede, e senza questo numero resterebbero
            // in archivio senza comparire da nessuna parte.
            conservati[a] = {
              ordini: c.ordini.size, righe: c.righe, eseguiti: c.eseguiti,
              per_ordine: Object.fromEntries(c.righePerOrdine),
            };
            for (const id of c.ordini) daConservare.add(id);
            // I cancellati degli anni prima non servono piu': non sono mancanti.
            for (const id of cancellatiDaLasciare(archivio, annoInizio, idFile)) daLasciare.add(id);
          } else {
            for (const id of await idArchivio(base44, a)) inArchivio.add(id);
          }
        }
        const mancanti = [...inArchivio].filter(id => !idFile.has(id) && !daConservare.has(id) && !daLasciare.has(id));
        if (mancanti.length > 0 && !confermate.has(CONFERMA_ORDINI_MANCANTI) && !confermate.has('true')) {
          const error = "Il file contiene meno dati di quelli gia' presenti in archivio";
          return await erroreRegistrato({
            error, righe_file: idFile.size, righe_archivio: inArchivio.size,
            mancanti: mancanti.length, esempi_mancanti: mancanti.slice(0, 10), richiede_conferma: true,
            conferma: CONFERMA_ORDINI_MANCANTI,
          }, 409, `${error} (${mancanti.length} ordini mancanti su ${inArchivio.size} in archivio)`, inArchivio.size);
        }

        // La rete di sicurezza qui sopra regge solo se l'archivio e' ancora
        // quello di prima. Lo svuotamento avviene dopo, un archivio per volta,
        // dentro il ciclo del browser: un tentativo morto a meta' puo' averne
        // gia' svuotato una parte, e allora nessun ordine risulta mancante
        // perche' in archivio non c'e' piu' niente da confrontare. Senza dirlo,
        // un file monco passerebbe al secondo tentativo senza che nessuno chieda
        // niente. Si chiede conferma, e si dice che cosa ricaricare.
        //
        // Il segnale e' UNO SOLO: in archivio ci sono meno ordini di quanti ce
        // n'erano quando e' partito il caricamento di prima (righe_archivio_prima
        // sta sulla sua riga del registro). Vuol dire che quello svuotamento e'
        // gia' avvenuto.
        //
        // Non si guarda "interrotto", che per una riga ancora in corso diventa
        // vero solo dopo dieci minuti: chi si vede morire la scheda ricarica
        // subito, cioe' quasi sempre dentro quei dieci minuti, e passava liscio.
        // Chi sta caricando davvero adesso l'abbiamo gia' mandato via sopra.
        //
        // E non si confronta con gli ordini del file: cosi' si fermava anche chi
        // il giorno dopo caricava un export piu' nuovo e giusto (ha piu' ordini,
        // quindi le due misure non coincidono), mandandolo a ripescare un export
        // vecchio.
        //
        // La frase NON dice piu' "si e' fermato": era falsa nel caso piu' comune
        // di tutti, cioe' ogni caricamento arrivato in fondo perdendo delle righe
        // (esito parziale), dopo il quale il gestionale stesso dice "ricarica lo
        // stesso file" e chi lo fa trovava scritto che quel caricamento si era
        // fermato. Si dice quello che si sa per certo: in archivio ci sono meno
        // ordini di quanti ce n'erano.
        // I CANCELLATI LASCIATI ANDARE FANNO RIMPICCIOLIRE L'ARCHIVIO PER UN
        // MOTIVO GIUSTO, e questo confronto non lo sa. Al primo caricamento dopo
        // il passaggio ai file dell'anno scorso l'archivio perde i cancellati
        // degli anni prima (410, sui dati veri del 25/09/2026): se quel
        // caricamento si interrompe, il tentativo dopo trova meno ordini e
        // chiede una conferma che non servirebbe. Si lascia cosi' e lo si scrive
        // qui: la conferma e' innocua - si conferma e si va avanti - e il caso
        // e' stretto, perche' scatta solo se il caricamento di prima e' rimasto
        // aperto. Per togliere anche questo falso allarme servirebbe scrivere
        // sulla riga del registro quanti ordini sono stati lasciati andare, e
        // scalarli da primaCerano. Chi legge domani non lo scambi per un guasto.
        const primaCerano = precedente && typeof precedente.righe_archivio_prima === 'number'
          ? precedente.righe_archivio_prima : null;
        const archivioRimpicciolito = primaCerano !== null && inArchivio.size < primaCerano;
        if (precedente && archivioRimpicciolito && !confermate.has(CONFERMA_ARCHIVIO_RIMPICCIOLITO)) {
          const error = "Il caricamento delle primarie di prima ha lasciato in archivio meno ordini di quanti ce n'erano: adesso il controllo non puo' accorgersi se il file e' incompleto";
          return await erroreRegistrato({
            error,
            dettaglio: `In archivio sono rimasti ${inArchivio.size} ordini dei ${primaCerano} che c'erano quando e' partito il caricamento ${qualeCaricamento(precedente)}: qualche archivio e' gia' stato svuotato, e il confronto con gli ordini gia' presenti non ha piu' abbastanza per accorgersi se questo file e' incompleto (nel file ci sono ${idFile.size} ordini). Se e' lo STESSO file di quel tentativo, conferma e prosegui. Se invece hai un export piu' nuovo va bene lo stesso, purche' sia l'export completo e non rifiltrato per data o per stato: guardalo e poi conferma. Confermando qui non si spegne l'altro controllo, quello degli ordini che sparirebbero.`,
            righe_file: idFile.size, righe_archivio: inArchivio.size, righe_archivio_prima: primaCerano,
            caricamento_interrotto: precedente, richiede_conferma: true,
            conferma: CONFERMA_ARCHIVIO_RIMPICCIOLITO,
          }, 409, `${error} (caricamento ${qualeCaricamento(precedente)}, ${inArchivio.size} ordini in archivio dei ${primaCerano} di prima)`, inArchivio.size);
        }

        // Ultima fine trasporto del file precedente a quella in archivio: file vecchio?
        fase = 'confronto delle date';
        let avviso_date = null;
        const fineFile = body.ultima_fine_trasporto != null ? dataPrimaria(body.ultima_fine_trasporto) : null;
        if (fineFile) {
          let fineArchivio = null;
          for (const a of ['PrimariaRete', 'PrimariaAci']) {
            const [ultimo] = await base44.asServiceRole.entities[a].list('-trasporto_finito_il', 1, 0, ['trasporto_finito_il']);
            if (ultimo && ultimo.trasporto_finito_il && (!fineArchivio || ultimo.trasporto_finito_il > fineArchivio)) fineArchivio = ultimo.trasporto_finito_il;
          }
          if (fineArchivio && new Date(fineFile).getTime() < new Date(fineArchivio).getTime()) {
            avviso_date = { data_file: fineFile, data_archivio: new Date(fineArchivio).toISOString() };
          }
        }

        fase = 'apertura del registro';
        const aperto = await apriCaricamento(base44, user, tipo_file, nome_file, inArchivio.size);
        if (aperto.bloccato) return Response.json({ error: aperto.bloccato, dati_intatti: true }, { status: 409 });
        // Il numero che torna e' quello scritto sulla riga, non quello di adesso:
        // se un tentativo morto aveva gia' svuotato qualcosa, resta il piu' alto.
        return Response.json({
          preparato: true,
          righe_archivio_prima: typeof aperto.righe_archivio_prima === 'number' ? aperto.righe_archivio_prima : inArchivio.size,
          // Da quale anno comincia il file e che cosa resta in archivio per ogni
          // archivio: il browser ci costruisce la BASE NOTA con cui verifica
          // tutto il resto. Se questi due campi non tornano, di la' vale zero
          // dappertutto e lo storico si perde in silenzio.
          anno_inizio: annoInizio, conservati,
          avviso_date, dati_intatti: true,
        });
      }

      // Controllo anti-regressione basato sul conteggio delle righe.
      // Per questi report non si confrontano gli identificativi uno a uno: sarebbe
      // necessario rileggere l'intero archivio, cioe' proprio il costo che questo
      // percorso vuole evitare. Il conteggio intercetta comunque il caso concreto
      // da cui proteggersi, ossia un export troncato o parziale.
      fase = 'controllo anti-regressione';
      const logs = await base44.asServiceRole.entities.UploadLog.filter(
        { tipo_file, esito: 'successo' }, '-created_date', 1
      );
      const precedenti = logs.length > 0 ? (logs[0].righe_importate || 0) : 0;

      if (tipo_file === 'dichiarazioni_trattamento' && precedenti > 0 && totale_righe < precedenti && !conferma_forzatura) {
        return Response.json({
          error: "Il file contiene meno dichiarazioni di quelle gia' presenti in archivio",
          righe_file: totale_righe, righe_archivio: precedenti,
          mancanti: precedenti - totale_righe,
          richiede_conferma: true,
          dati_intatti: true,
        }, { status: 409 });
      }

      let avviso_calo = null;
      if (tipo_file === 'ordini_non_dichiarati' && precedenti > 0 && totale_righe < precedenti / 2) {
        avviso_calo = { righe_precedenti: precedenti, righe_attuali: totale_righe };
      }

      fase = 'apertura del registro';
      const aperto = await apriCaricamento(base44, user, tipo_file, nome_file, precedenti);
      if (aperto.bloccato) return Response.json({ error: aperto.bloccato, dati_intatti: true }, { status: 409 });
      fase = "svuotamento dell'archivio precedente";
      await base44.asServiceRole.entities[entita].deleteMany({});
      archivioSvuotato = true;

      return Response.json({ preparato: true, avviso_calo, righe_archivio_prima: precedenti });
    }

    // === SCRITTURA DI UN BLOCCO ===
    if (!Array.isArray(righe) || righe.length === 0) {
      return Response.json({ error: 'Nessuna riga da scrivere in questo blocco', dati_intatti: true }, { status: 400 });
    }

    fase = 'scrittura del blocco ' + ((blocco || 0) + 1);
    // Le colonne del blocco sono le chiavi vere delle righe lette nel browser:
    // la firma del file le accetta normalizzate, cercarle col nome esatto di
    // SHEET_MAP lasciava fuori un'intestazione con uno spazio in coda
    // (fileSignatures.mappaColonne). Una riga puo' non portare le celle vuote,
    // quindi si guardano le intestazioni di tutto il blocco.
    const colonne = mappaColonne(config.columns, [...new Set(righe.flatMap(r => Object.keys(r || {})))]);
    let records = righe.map(r => mappaRiga(r, colonne, primarie));
    if (primarie) {
      // Stesso arricchimento e stessa suddivisione dell'importazione lato server.
      records = enrichRecords(records.filter(r => r.id_ordine), 'PrimariaRete');
      const fuori = records.filter(r => archivioPrimaria(r) !== entita);
      if (fuori.length > 0 || records.length !== righe.length) {
        return Response.json({
          error: `Blocco non coerente con l'archivio ${entita}: ${fuori.length} ordini appartengono a un altro archivio (es. ${fuori.slice(0, 3).map(r => r.id_ordine).join(', ')})`,
          dati_intatti: false,
        }, { status: 400 });
      }
      if (entita === 'Assegnato' || entita === 'AssegnatoAci') records = records.map(recordAssegnato);
    }
    let ultimoErrore = null;

    // UNA SOLA SCRITTURA, E BASTA. C'era un secondo tentativo qui dentro, e
    // rispondeva `scritte: records.length` anche al secondo giro: se il primo
    // bulkCreate fosse entrato IN PARTE prima di fallire, il blocco entrerebbe
    // due volte e il browser leggerebbe un successo pulito, cioe' righe doppie
    // senza nessuno che lo dica. E' esattamente la scrittura cieca che il
    // gestionale ha appena finito di togliere dalla riparazione: qui non si
    // puo' nemmeno cancellare prima, perche' il blocco non e' un elenco di
    // ordini interi.
    //
    // E il ritentativo non lo fa nemmeno il browser: UN BLOCCO NON SI RISCRIVE
    // MAI. Se la scrittura non risponde, i suoi ordini restano in dubbio e li
    // rimette a posto la riparazione, che TOGLIE e riscrive e quindi non puo'
    // duplicare niente. Fra perdere righe e duplicarle si sceglie sempre la
    // prima: perdere e' rumoroso e si rimedia ricaricando, duplicare e'
    // silenzioso.
    try {
      await base44.asServiceRole.entities[entita].bulkCreate(records);
      return Response.json({ blocco, scritte: records.length, fallite: 0 });
    } catch (e) {
      ultimoErrore = e && e.message ? e.message : String(e);
    }

    // Il blocco non e' passato, ma la risposta resta un successo HTTP: il browser
    // deve poter decidere se ritentare, non ricevere un'eccezione che interrompe
    // l'intera importazione.
    return Response.json({
      blocco, scritte: 0, fallite: records.length,
      ritentabile: true, ultimo_errore: ultimoErrore,
    });

  } catch (error) {
    return Response.json({
      error: error && error.message ? error.message : String(error),
      fase,
      // "Dati intatti" solo se non si e' tentato niente: ne' uno svuotamento ne'
      // una cancellazione mirata. Guardando il solo svuotamento, una
      // cancellazione andata in timeout DOPO aver tolto le righe rispondeva
      // "dati intatti: si'", e il browser usciva senza ricontare.
      dati_intatti: !archivioSvuotato && !cancellazionePartita,
      ritentabile: eInterruzione(error),
    }, { status: 500 });
  }
}
