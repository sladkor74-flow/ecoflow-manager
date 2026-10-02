import { base44 } from '@/api/base44Client';
import { eAci } from '@/lib/canaleSecondaria';
import { oggiRoma } from '@/lib/giornoItaliano';
import { testoTerminatiSenzaFine, testoOrdiniDateDaSistemare } from '@/lib/richiesteEct';
import { dataServer, formatIntero } from '@/lib/utils';
import { eLimiteRichieste } from '@/lib/limiteRichieste';
import { eEseguito, riepilogoEseguiti } from '@/lib/movimenti';

// Importazione dei report di grandi dimensioni del portale Ecotyre.
//
// Il report delle dichiarazioni di trattamento supera i 4 MB e contiene oltre un
// milione di celle: letto dentro una function esaurisce la memoria disponibile e
// il processo viene terminato dalla piattaforma. Qui il file viene letto nel
// browser, dove la memoria non e' un vincolo, e al backend arrivano solo blocchi
// di poche centinaia di righe gia' estratte.
//
// Lo stesso vale per il file delle primarie: importato tutto in una sola function
// puo' superare il tempo massimo concesso e venire interrotto dopo aver svuotato
// l'archivio, lasciandolo a meta'.
//
// La connessione al database ha un'attesa massima di venti secondi e ogni tanto
// la supera. Il ritentativo sta qui e non nella function: il browser non ha un
// tempo massimo di esecuzione, la function si'. Ogni blocco corrisponde a una
// sola scrittura, quindi o le righe entrano tutte o non ne entra nessuna: prima
// di ritentare si chiede al backend quanti record contiene l'archivio, cosi' un
// blocco arrivato a destinazione nonostante l'errore di rete non viene riscritto.
// Se nemmeno il conteggio riesce il blocco non si riscrive lo stesso: resta in
// sospeso, e a scioglierlo e' la verifica finale dell'archivio - su tutti e due
// i percorsi, primarie e no: se alla fine l'archivio ha esattamente le righe del
// file, quelle in sospeso sono entrate, non ne mancano e non ce ne sono in piu'.
//
// Per le primarie quella verifica e' un conteggio ESATTO, riga per riga, e si
// chiede sempre col DETTAGLIO, cioe' quante righe ha ciascun ordine. Il solo
// totale non basta: un blocco entrato due volte (+200 righe) e un altro mai
// arrivato (-200) si compensano, il totale torna esatto e il caricamento si
// chiudeva "successo" con 200 ordini contati doppi e 200 spariti. Il confronto
// giusto e' ordine per ordine con le righe che quell'ordine ha NEL FILE: quello
// che non si fa mai e' pretendere un id_ordine per riga, perche' lo stesso
// ordine sta in archivio con piu' righe, una per classe o per prodotto, ed e'
// normale. Il dettaglio non costa letture in piu': sono le stesse pagine.
//
// E quando l'archivio non quadra il gestionale SI RIPARA DA SOLO, invece di
// dire "ricarica il file" e fermarsi li' (incidente del 24/09/2026: 11.293
// righe nel file, 11.236 in archivio, 57 perse e tutto il caricamento da
// rifare). Nell'ordine: si aspetta e si riconta, perche' subito dopo una
// scrittura grossa l'archivio puo' rispondere con un numero ancora indietro;
// poi si rimettono a posto SOLO le righe degli ordini che non tornano; poi si
// riverifica. Si avvisa soltanto se anche la riparazione non basta.
//
// LA RIPARAZIONE DEVE ESSERE IDEMPOTENTE. E' la regola che governa tutto
// questo giro. Per ogni ordine da rimettere a posto si TOLGONO le sue righe e
// si RISCRIVONO quelle del file: comunque fosse messo l'archivio, e qualunque
// cosa dica una lettura in ritardo, quell'ordine finisce con esattamente le
// righe che ha nel file, e doppioni non se ne creano mai. NON ESISTE UNA
// SCRITTURA "AGGIUNGI" CIECA. Da qui discendono quattro cose:
//
//   - FRA PERDERE RIGHE E DUPLICARLE SI SCEGLIE SEMPRE LA PRIMA. Perdere e'
//     rumoroso: le righe mancanti si vedono, si dicono, l'esito resta parziale,
//     i ricalcoli non partono e il file e' ancora sul disco, quindi si rimedia
//     ricaricandolo. Duplicare e' silenzioso: spunta verde, esito "successo" e
//     tutti i ricalcoli che partono sopra i pesi contati doppi. C'era una
//     regola contraria - "prima si scrive, poi si toglie" - che riscriveva
//     senza cancellare gli ordini che la lettura dava per assenti: bastava una
//     lettura in ritardo di sei secondi per fabbricare cinquanta ordini con le
//     righe doppie e chiudere "successo". E' l'incidente del 14/09/2026 che
//     rientrava dalla finestra, e per questo quel passo non c'e' piu'.
//
//   - NESSUN VERDETTO SI COSTRUISCE SU UN CONTEGGIO PRECEDENTE a un'operazione
//     che ha toccato i dati. Una richiesta di cancellazione PARTITA e' gia'
//     "toccato", anche se la risposta non torna: una risposta persa non vuol
//     dire che non sia successo niente. Chi cancella dice sempre quanti ne ha
//     tolti (cancella_ordini risponde anche quando si interrompe) e chi decide
//     riconta prima di raccontare com'e' andata. Prima si usciva dal ciclo
//     senza ricontare: a video si leggevano "50 righe di troppo" con i nomi di
//     ordini che la riparazione aveva appena tolto.
//
//   - NESSUN VERDETTO SI COSTRUISCE SU UNA LETTURA CHE CONTRADDICE LE SCRITTURE
//     CONFERMATE. Il browser sa quali blocchi la function ha confermato di aver
//     scritto: se il conteggio dice che quelle righe non ci sono, non e'
//     "mancano delle righe", e' "questa lettura non e' affidabile". L'archivio
//     si dichiara NON CONTATO, il caricamento resta parziale e i ricalcoli non
//     partono, invece di riparare sopra numeri che non esistono.
//
// IL VERDETTO SI REGGE SU CIO' CHE LA PIATTAFORMA HA CONFERMATO DI AVER
// SCRITTO, NON SU CIO' CHE UNA LETTURA RACCONTA.
//
// E' la regola che ha sostituito sei giri di "leggiamo un'altra volta".
// Leggere di piu' non si vince mai: una piattaforma indietro di qualche secondo
// da' due, tre, sei letture uguali e tutte sbagliate, e "le righe non ci sono"
// e "la lettura e' indietro" sono lo stesso numero. Il conto si fa cosi':
//
//   l'archivio si porta alla BASE NOTA e si VERIFICA CHE SIA ESATTAMENTE
//   QUELLA prima di scrivere; poi ogni blocco del file si scrive AL MASSIMO UNA
//   VOLTA e non si riscrive mai. Se di ogni blocco la piattaforma ha CONFERMATO
//   la scrittura, allora l'archivio e' uguale a BASE + FILE, e non e' un'opinione:
//   e' quello che c'era piu' quello che e' stato scritto.
//
// LA BASE NOTA e' lo storico conservato: un numero e un elenco di ordini che la
// preparazione ha gia' calcolato (base44/shared/storicoConservato.ts, regola
// dell'utente del 25/09/2026) e che lo svuotamento lascia dov'erano. Sono i
// terminati degli anni prima che il file non contiene: il portale filtra
// l'export per data di immissione, che per un terminato non dice niente, quindi
// quegli ordini restano in archivio com'erano. Quando non c'e' niente da
// conservare la base e' ZERO e tutto quello che c'e' scritto qui torna la frase
// di prima, alla lettera: "si svuota e si verifica a zero".
//
// LA GARANZIA CONTRO I DOPPIONI NON SI PERDE, e il motivo e' questo: dopo lo
// svuotamento in archivio ci sono SOLO righe di ordini CONSERVATI, e le
// scritture aggiungono SOLO righe del FILE. I due insiemi sono DISGIUNTI PER
// COSTRUZIONE, perche' un ordine si conserva soltanto se il file non lo contiene
// (ordiniDaConservare). Quindi nessun ordine puo' avere insieme righe conservate
// e righe del file, l'archivio non puo' mai avere piu' righe di BASE + FILE - ne'
// in totale ne' per singolo ordine - e lo storico, che questo caricamento non
// scrive mai, non puo' duplicarsi.
//
// Da li' discende tutto:
//
//   - un blocco CONFERMATO e' una riga di conto chiusa. Finche' non interviene
//     la riparazione, l'archivio ha per ogni ordine AL PIU' le righe che
//     quell'ordine ha nel file, oppure quelle che la preparazione gli ha contato
//     nello storico conservato - mai le une piu' le altre, perche' per lo stesso
//     ordine uno dei due numeri e' sempre zero - e le righe possono solo
//     aggiungersi: quindi una lettura che dice "ci sono tutte" non puo' essere
//     una lettura in ritardo, perche' una lettura in ritardo mostrerebbe MENO.
//     Basta quella;
//   - un blocco NON CONFERMATO (la rete e' caduta, la scrittura non ha
//     risposto) lascia i suoi ordini in un dubbio che NESSUNA LETTURA
//     SCIOGLIE: in archivio possono esserci zero righe, quelle giuste, o il
//     doppio, e "quelle giuste" e' proprio cio' che direbbe una lettura in
//     ritardo. Quegli ordini si passano alla riparazione, che TOGLIE e
//     RISCRIVE: se tutte e due le operazioni sono confermate, l'ordine ha le
//     righe del file per costruzione, e il dubbio e' chiuso senza chiederlo a
//     nessuno. Finche' restano, il caricamento non si dichiara riuscito;
//   - una lettura che dice "ne mancano" puo' essere vera o puo' essere in
//     ritardo, e non si sa: si ripara lo stesso, perche' la riparazione toglie
//     e riscrive le righe del file di quegli ordini e in tutti e due i casi li
//     lascia esatti. RIPARARE NON PUO' PEGGIORARE NIENTE;
//   - una lettura che contraddice le scritture confermate non si usa per
//     niente: non si dichiara "successo" e non si elencano righe mancanti o di
//     troppo. Si dice CHE NON SI E' RIUSCITI A VERIFICARE, l'esito resta
//     parziale, i ricalcoli restano fermi, e si offre comunque la riparazione.
//
// La lettura serve a DUE cose soltanto: accorgersi che qualcosa non torna, e
// raccontare che cosa. Non decide.
//
// IL LIMITE CHE RESTA, detto per nome: se la piattaforma eseguisse DUE VOLTE
// una richiesta che ha gia' confermato - un ritentativo suo, sotto di noi - il
// conto delle scritture confermate non se ne accorgerebbe, e a vederlo
// resterebbe solo il conteggio. La verifica ordine per ordine lo prende
// (e' il caso (A1) delle prove), ma se ANCHE quella lettura fosse in ritardo
// non lo vedrebbe nessuno. Non e' mai stato osservato e non si puo' chiudere
// leggendo di piu': si scrive qui perche' chi legge domani lo sappia.
//
// Meglio dire "non sono riuscito, ecco che cosa ho toccato" che raccontare
// numeri vecchi.
//
// La mappatura delle colonne resta sul backend, nella function importaBlocco, che
// usa SHEET_MAP come unica fonte: qui le righe si spediscono cosi' come lette.

const RIGHE_PER_BLOCCO = 200;
const PAUSA_DOPO_LIMITE = 30000;
const ATTESE_RITENTATIVO = [2000, 5000, 10000, 20000];

// Quanto si aspetta prima di ricontare un archivio che non quadra: subito dopo
// una scrittura grossa la lettura puo' rispondere con un numero ancora indietro,
// e un allarme dato li' sarebbe un falso allarme.
const PAUSA_PRIMA_DI_RICONTARE = 3000;
// Quante letture al massimo si fanno, dopo aver toccato l'archivio, per vedere
// se il conteggio si ferma su un numero. Due letture di fila che dicono la
// stessa cosa bastano; se in tre non si assestano l'archivio si dichiara non
// contato, invece di dichiararlo a posto su un numero che sta ancora cambiando.
const LETTURE_PER_ESSERE_SICURI = 3;
// QUESTI DUE NUMERI SONO TARATI A OCCHIO, e va bene cosi': non decidono piu'
// niente. Prima erano loro a dire se il caricamento era riuscito, e sbagliarli
// voleva dire chiudere "successo" sopra delle righe doppie. Adesso il verdetto
// viene dalle scritture confermate (vedi il commento in testa), e queste due
// servono solo a non gridare per un falso allarme.
//
// Se fossero SBAGLIATI PER DIFETTO - pausa troppo corta, letture troppo poche -
// qualche archivio si dichiarerebbe "non si e' potuto verificare" piu' spesso
// del necessario: il caricamento resta parziale, i ricalcoli non partono e si
// ricarica il file. Fastidio, non danno: righe doppie non ne nascono.
// Se fossero sbagliati PER ECCESSO si aspetterebbe qualche secondo in piu' su
// un archivio che ha avuto guai. Nessuno dei due casi puo' far entrare una riga
// due volte, ne' farne sparire una.
// Quante volte si prova a rimettere a posto un archivio prima di arrendersi.
//
// SONO QUESTI I RITENTATIVI DELLA RIPARAZIONE, da quando un blocco non si
// riscrive piu' alla cieca. Prima un blocco della riparazione si riprovava
// cinque volte dentro la stessa scrittura, e quelle cinque volte potevano far
// entrare le stesse righe due volte; adesso ogni tentativo e' un giro intero,
// che COMINCIA TOGLIENDO le righe di quegli ordini e poi riscrive quelle del
// file. Cosi' ritentare non puo' duplicare niente, qualunque cosa dica una
// lettura. Quattro giri stanno vicini ai cinque tentativi di prima, e li paga
// solo un archivio che non torna: su un caricamento pulito il ciclo non gira
// nemmeno una volta.
const GIRI_RIPARAZIONE = 4;
// Oltre questo numero di ordini sbagliati non e' piu' una riparazione: conviene
// ricaricare il file, e si dice.
//
// Il conto: le righe si riscrivono a blocchi da 200, quindi riscriverne tremila
// costa una quindicina di richieste; toglierle costa quanto scriverle, perche'
// la function cancella a LOTTI con un filtro $in per lotto (cinquanta ordini a
// richiesta), cioe' altre sessanta. Prima era una richiesta per ordine:
// cinquecento ordini erano cinquecento richieste contro un limite di circa
// settanta al minuto per tutta l'app, si finiva in 429 e la riparazione si
// fermava proprio a meta', cioe' dopo aver cancellato e prima di riscrivere.
//
// La soglia si controlla in un punto solo, dove si decide se riparare: il
// controllo gemello dentro riparaArchivio non sarebbe mai potuto scattare, e
// portava con se' una frase che nessuno avrebbe letto.
const MAX_ORDINI_RIPARAZIONE = 3000;

// Quante volte al massimo si riprende uno svuotamento che dice di non aver
// finito. Una ripresa non e' un ritentativo - la function si e' fermata al
// dodicesimo secondo e riparte da dove era arrivata - ma senza un fondo il
// ciclo puo' girare per sempre se la piattaforma accetta le cancellazioni senza
// eseguirle. Trenta bastano con margine: si tolgono 200 ordini per blocco e piu'
// blocchi per invocazione, contro gli ~11.000 ordini di un archivio vero.
// Ogni ripresa rilegge l'archivio intero, e il limite di richieste al minuto
// vale per tutta l'app.
const MAX_RIPRESE_SVUOTAMENTO = 30;

// La nota che il registro porta quando i moduli collegati sono stati rifatti.
// Serve a riconoscere un caricamento riuscito i cui ricalcoli sono rimasti
// appesi - la scheda chiusa, la rete caduta - e a rifarli da soli (regola 2).
// Lo stesso testo sta in base44/functions/importaBlocco/entry.ts.
export const MODULI_AGGIORNATI = 'moduli collegati aggiornati';

// I tipi di file come li chiama chi lavora: nei messaggi non deve uscire la
// chiave interna, ne' la parola generica "archivio".
const NOMI_TIPO = {
  primarie: 'Primarie',
  secondarie: 'Secondarie',
  terziarie: 'Terziarie',
  dichiarazioni_trattamento: 'Dichiarazioni Trattamento',
  ordini_non_dichiarati: 'Ordini Non Dichiarati',
  extra_raccolta: 'Extra Raccolta',
};

const pausa = (ms) => new Promise(r => setTimeout(r, ms));

// Il client restituisce gli errori con stato e dati della risposta; le versioni
// precedenti li tenevano in response.
const statoErrore = (e) => (e && (e.status || (e.response && e.response.status))) || undefined;
const datiErrore = (e) => (e && (e.data || (e.response && e.response.data))) || null;

function messaggioErrore(e) {
  const dati = datiErrore(e);
  if (dati && dati.error) return dati.fase ? `${dati.error} (fase: ${dati.fase})` : dati.error;
  return e && e.message ? e.message : String(e);
}

// File rifiutato o caricamento bloccato: non si ritenta, la risposta va mostrata.
const nonRitentabile = (e) => [400, 401, 403, 409].includes(statoErrore(e));

// Legge la sola prima riga del foglio senza materializzare tutte le righe.
function leggiIntestazioni(XLSX, ws) {
  if (!ws || !ws['!ref']) return [];
  const range = XLSX.utils.decode_range(ws['!ref']);
  const headers = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: range.s.r, c })];
    headers.push(cell && cell.v != null ? String(cell.v) : '');
  }
  return headers;
}

// Legge il file: i report del portale hanno un unico foglio; in caso di piu' fogli
// si prende quello con piu' colonne nella prima riga, che e' quello dei dati.
async function leggiFile(file) {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  // cellDates disattivato: le date arrivano come seriali Excel e vengono convertite
  // dal backend, evitando di costruire un oggetto Date per ogni cella.
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
  if (!wb.SheetNames.length) throw new Error('Il file non contiene alcun foglio.');
  let nomeFoglio = wb.SheetNames[0];
  let intestazioni = leggiIntestazioni(XLSX, wb.Sheets[nomeFoglio]);
  for (const sn of wb.SheetNames.slice(1)) {
    const h = leggiIntestazioni(XLSX, wb.Sheets[sn]);
    if (h.length > intestazioni.length) { nomeFoglio = sn; intestazioni = h; }
  }
  const righe = XLSX.utils.sheet_to_json(wb.Sheets[nomeFoglio], { raw: true });
  if (righe.length === 0) throw new Error('Il foglio non contiene righe di dati.');
  return { nomeFoglio, intestazioni, righe };
}

// Chiama la function ritentando gli errori di rete, non i rifiuti.
async function invocaConRitentativi(parametri, avvisa, faseRitentativo) {
  for (let tentativo = 0; ; tentativo++) {
    try {
      const res = await base44.functions.invoke('importaBlocco', parametri);
      return res.data || res;
    } catch (e) {
      if (nonRitentabile(e) || tentativo >= ATTESE_RITENTATIVO.length) throw e;
      avvisa({ fase: faseRitentativo });
      await pausa(ATTESE_RITENTATIVO[tentativo]);
    }
  }
}

// Quanti record contiene ora l'archivio, oppure null se non si e' riusciti a
// contarlo. Si riprova una volta: il conteggio e' l'unica cosa che distingue un
// blocco arrivato a destinazione da uno perso, e senza di lui non si puo'
// decidere niente.
//
// null non vuol dire zero e non vuol dire "va bene": chi chiama lo deve
// dichiarare. Prima si ritentava lo stesso, e un blocco gia' entrato veniva
// scritto una seconda volta; poi il controllo finale saltava gli archivi non
// contati e il caricamento si chiudeva come riuscito con i doppioni dentro.
async function chiediConteggio(tipoFile, atteso, minimo, entita) {
  for (let tentativo = 0; ; tentativo++) {
    try {
      const res = await base44.functions.invoke('importaBlocco', {
        azione: 'conta', tipo_file: tipoFile, atteso, minimo, entita,
      });
      const dati = res.data || res;
      if (typeof dati.conteggio === 'number') return dati.conteggio;
    } catch (e) { /* si riprova una volta, poi si dichiara che non si e' contato */ }
    if (tentativo >= 1) return null;
    await pausa(ATTESE_RITENTATIVO[0]);
  }
}

// Un giro del conteggio esatto: quante righe si sono contate a partire da
// daRiga, e se l'archivio e' finito. null se non ha risposto.
async function unGiroDiConteggio(tipoFile, entita, daRiga, dettaglio, nome) {
  for (let tentativo = 0; ; tentativo++) {
    try {
      const res = await base44.functions.invoke('importaBlocco', {
        azione: 'conta_esatta', tipo_file: tipoFile, entita, da_riga: daRiga,
        dettaglio: dettaglio || undefined, nome,
      });
      const dati = res.data || res;
      if (dati && typeof dati.righe === 'number') return dati;
    } catch (e) { /* si riprova una volta, poi si dichiara che non si e' contato */ }
    if (tentativo >= 1) return null;
    await pausa(ATTESE_RITENTATIVO[0]);
  }
}

// Quante righe ha DAVVERO un archivio delle primarie, contate a pagine.
//
// Non si usa chiediConteggio, che pure da' un numero esatto: quello sonda le
// posizioni per raddoppi e bisezione, costa una trentina di letture in fila e
// quando il tempo finisce si arrende senza poter riprendere. Qui si legge a
// pagine, si sa sempre dove ci si e' fermati e si richiama da li'.
//
// E' il controllo con cui si chiude il caricamento: le righe dell'archivio
// devono essere quelle che il file gli porta.
//
// Il conteggio si fa a giri, perche' una sola invocazione ha dodici secondi e su
// un archivio grande possono non bastare: la function dice fin dove e' arrivata
// e da qui si richiama da quel punto. Prima si arrendeva, e un conteggio non
// riuscito bastava a chiudere il caricamento come parziale - cioe' a fermare
// report, alert, quadratura FIR, predittivita' e ritiri ECT finche' non si
// ricaricava tutto il file.
//
// Il dettaglio - quante righe ha ciascun ordine - si chiede SEMPRE nella
// verifica finale delle primarie, perche' il solo totale non vede il caso
// peggiore: un blocco entrato due volte e un altro mai arrivato si compensano.
// Serve anche alla riparazione, che deve sapere quali ordini rimettere a posto.
// Non costa nessuna lettura in piu' - sono le stesse pagine, con in piu' la
// colonna id_ordine - ma la risposta pesa: su Primarie RETE sono circa
// undicimila chiavi dentro una risposta HTTP. Si e' scelto di pagarlo, perche'
// e' l'unico metro che vede il caso peggiore.
//
// Restituisce { righe, conteggi } oppure null se non si e' riusciti a contare.
const MASSIMI_GIRI_CONTEGGIO = 200;

async function chiediConteggioEsatto(tipoFile, entita, { dettaglio = false, avvisa, nome } = {}) {
  let daRiga = 0;
  const conteggi = dettaglio ? new Map() : null;
  for (let giro = 0; giro < MASSIMI_GIRI_CONTEGGIO; giro++) {
    const dati = await unGiroDiConteggio(tipoFile, entita, daRiga, dettaglio, nome);
    if (!dati) return null;
    if (conteggi) for (const [ordine, quante] of Object.entries(dati.conteggi || {})) {
      conteggi.set(ordine, (conteggi.get(ordine) || 0) + quante);
    }
    if (dati.finito) return { righe: dati.righe, conteggi };
    // Un giro che non avanza e' un giro che si ripeterebbe all'infinito.
    if (!(dati.righe > daRiga)) return null;
    daRiga = dati.righe;
    if (avvisa) avvisa({ fase: `verifica dell'archivio ${nome || entita}: ${daRiga} righe contate`, archivio: nome });
  }
  return null;
}

/** Quante righe porta il file a ciascun ordine di un archivio: Map(id_ordine -> righe). */
function righePerOrdineNelFile(righeArchivio) {
  const nelFile = new Map();
  for (const r of righeArchivio) {
    const id = String(r.ID);
    nelFile.set(id, (nelFile.get(id) || 0) + 1);
  }
  return nelFile;
}

/**
 * Gli ordini che in archivio non hanno le righe che dovrebbero avere.
 *
 * E' IL METRO GIUSTO, e l'unico che prende il caso peggiore: un blocco entrato
 * due volte e uno mai arrivato lasciano il totale esatto (+200 e -200), ma qui
 * si vedono duecento ordini con una riga di troppo e duecento con una in meno.
 *
 * Non e' il criterio sbagliato "un id_ordine una volta sola": il confronto e'
 * con le righe che quell'ordine ha DAVVERO nel file, quindi un ordine con due
 * classi che in archivio ha due righe e' a posto.
 *
 * ATTESO PER ORDINE NON E' "QUANTE RIGHE PORTA IL FILE": e' quante righe
 * l'archivio deve avere per quell'ordine, cioe' le righe del FILE piu' quelle
 * dello STORICO CONSERVATO che la preparazione ha contato. Per lo stesso ordine
 * uno dei due numeri e' sempre zero (un ordine si conserva solo se il file non
 * lo contiene), quindi ogni ordine ha un solo padrone e il confronto resta
 * esattamente quello di prima. Passando qui il solo file, ogni ordine conservato
 * usciva come "righe di troppo" con nel_file: 0 - migliaia, sui dati veri - e la
 * riparazione cancellava proprio lo storico che si era deciso di tenere.
 */
function ordiniCheNonTornano(attesoPerOrdine, inArchivio) {
  const inPiu = [];
  const mancanti = [];
  for (const [ordine, attese] of attesoPerOrdine) {
    const volte = inArchivio.get(ordine) || 0;
    if (volte > attese) inPiu.push({ id_ordine: ordine, volte, nel_file: attese });
    else if (volte < attese) mancanti.push({ id_ordine: ordine, volte, nel_file: attese });
  }
  // Un ordine che in archivio c'e' e non lo aspetta nessuno - ne' il file ne' lo
  // storico conservato: le sue righe sono tutte di troppo.
  for (const [ordine, volte] of inArchivio) {
    if (!attesoPerOrdine.has(ordine)) inPiu.push({ id_ordine: ordine, volte, nel_file: 0 });
  }
  const perGravita = (x, y) => (y.volte - y.nel_file) - (x.volte - x.nel_file);
  inPiu.sort(perGravita);
  mancanti.sort((x, y) => (y.nel_file - y.volte) - (x.nel_file - x.volte));
  return { inPiu, mancanti };
}

/**
 * Le dimensioni che l'archivio puo' avere per colpa dei blocchi in sospeso: di
 * ognuno non si sa se sia entrato o no, quindi ogni combinazione e' possibile.
 * null quando le combinazioni sono troppe per ragionarci sopra.
 */
function sommePossibili(sospesi) {
  let somme = new Set([0]);
  for (const s of sospesi) {
    const nuove = new Set(somme);
    for (const x of somme) nuove.add(x + s);
    somme = nuove;
    if (somme.size > 512) return null;
  }
  return somme;
}

/**
 * Un blocco che si sta per ritentare: il conteggio dell'archivio dice se il
 * tentativo di prima era passato lo stesso. Risponde 'scritto', 'non_scritto'
 * oppure null quando il conteggio non distingue i due casi.
 *
 * Con un blocco gia' in sospeso "conteggio maggiore di quante ne ho scritte" non
 * dimostra piu' niente, ed e' cosi' che un blocco mai arrivato veniva dato per
 * scritto. Ma il conteggio ESATTO distingue ancora: se il sospeso e' di 200
 * righe e il blocco in corso di 50, l'archivio vale S, S+200, S+50 o S+250, e
 * ognuno di quei numeri dice una cosa sola. Si rinuncia solo quando due casi
 * fanno lo stesso numero - blocchi della stessa dimensione - e allora il blocco
 * resta in sospeso come prima, senza riscriverlo alla cieca.
 */
function decidiDalConteggio(conteggio, scritte, sospesi, righeBlocco) {
  const somme = sommePossibili(sospesi);
  if (!somme) return null;
  const senzaIlBlocco = [...somme].some(s => scritte + s === conteggio);
  const conIlBlocco = [...somme].some(s => scritte + s + righeBlocco === conteggio);
  if (conIlBlocco && !senzaIlBlocco) return 'scritto';
  if (senzaIlBlocco && !conIlBlocco) return 'non_scritto';
  return null;
}

// Scrive le righe a blocchi con ritentativo e verifica del conteggio.
// avanzamento: { bloccoIniziale, totaleBlocchi, righeIniziali, totaleRighe, archivio }
//
// righeGiaInArchivio: quante righe l'archivio ha GIA' quando si comincia a
// scrivere. Sul percorso normale NON E' PIU' SEMPRE ZERO: lo svuotamento
// conserva i terminati degli anni prima, e quelle righe sono la BASE NOTA da cui
// si parte (conservatiDi in importaPrimarie). Dentro la riparazione e' il totale
// dell'archivio letto, che lo storico comprende gia'. Partendo da zero
// il conteggio con cui si decide se un blocco ritentato era passato non
// riconosceva nessuna delle due ipotesi - ne' "entrato" ne' "non entrato" -
// rispondeva sempre "non si sa" e il blocco restava in sospeso al primo colpo
// di rete. I cinque ritentativi dentro la riparazione non funzionavano affatto.
async function scriviBlocchi({ tipoFile, entita, righe, avvisa, avanzamento, righeGiaInArchivio = 0 }) {
  const totaleBlocchi = Math.ceil(righe.length / RIGHE_PER_BLOCCO);
  const gia = Math.max(0, Number(righeGiaInArchivio) || 0);
  let totaleScritte = 0;
  // Le righe che la FUNCTION HA CONFERMATO di aver scritto. Non e' lo stesso di
  // totaleScritte: li' dentro ci sono anche i blocchi dati per entrati leggendo
  // il conteggio, e un conteggio e' proprio cio' di cui qui si dubita. Queste
  // invece sono righe che qualcuno ha detto di aver scritto, e una lettura che
  // le nega e' una lettura da buttare, non un archivio a cui mancano righe.
  // Si tengono anche ORDINE PER ORDINE, perche' la riparazione toglie le righe
  // di certi ordini e solo di quelli: cosi' la soglia resta giusta anche dopo.
  let righeConfermate = 0;
  const confermatePerOrdine = new Map();
  // Le righe entrate ORDINE PER ORDINE, comprese quelle dei blocchi dati per
  // entrati leggendo il conteggio. Servono a chi ripara per dire quante righe
  // distinte ha rimesso a posto: sommando i totali di ogni giro si contavano
  // due volte le stesse righe.
  const scrittePerOrdine = new Map();
  const segnaOrdini = (mappa, fetta) => {
    for (const r of fetta) {
      const id = String(r.ID);
      mappa.set(id, (mappa.get(id) || 0) + 1);
    }
  };
  let righeIncerte = 0;
  let ultimoErrore = null;
  // Gli ordini di cui NON si sa, per scritture confermate, quante righe abbiano
  // in archivio: quelli dei blocchi che la function non ha confermato. Vedi
  // sotto, dove si riempie.
  const ordiniDubbi = new Set();
  // I blocchi la cui scrittura non ha risposto e che l'archivio ha dato per
  // entrati. Non sono "ritentati": un blocco non si riscrive mai, e questo
  // numero dice solo quante volte e' servito chiedere all'archivio.
  let blocchiDatiPerEntrati = 0;
  // E QUANTE RIGHE PORTAVANO. Sono righe che NESSUNO HA CONFERMATO: a darle per
  // entrate e' stato un conteggio, e un conteggio non distingue "ci sono una
  // volta sola" da una lettura in ritardo su un blocco entrato due volte. Chi
  // chiama le deve raccontare come righe in sospeso, non come righe entrate:
  // senza questo numero il percorso che non e' quello delle primarie le
  // perdeva di vista e chiudeva "successo" su un conteggio.
  let righeDatePerEntrate = 0;
  // Le dimensioni dei blocchi rimasti in sospeso: non si sa se siano entrati.
  const sospesi = [];
  const stato = (fase, blocco, extra = {}) => avvisa({
    fase,
    archivio: avanzamento.archivio,
    blocco: avanzamento.bloccoIniziale + blocco,
    totaleBlocchi: avanzamento.totaleBlocchi,
    righeScritte: avanzamento.righeIniziali + totaleScritte,
    totaleRighe: avanzamento.totaleRighe,
    ...extra,
  });

  for (let blocco = 0; blocco < totaleBlocchi; blocco++) {
    const fetta = righe.slice(blocco * RIGHE_PER_BLOCCO, (blocco + 1) * RIGHE_PER_BLOCCO);
    // Le due ipotesi si misurano sull'archivio intero, non sulle sole righe di
    // questo giro: dentro la riparazione le righe gia' presenti sono migliaia.
    const atteso = gia + totaleScritte + fetta.length;
    let scritto = false;
    let incerto = false;

    // UNA SOLA SCRITTURA PER BLOCCO, SEMPRE, E NESSUNA RISCRITTURA.
    //
    // Non e' un'economia di richieste: e' cio' che rende l'archivio
    // CONFRONTABILE con il file. Si parte da un archivio portato alla BASE NOTA
    // e verificato su quel numero - zero, oppure le righe dello storico
    // conservato, che la preparazione ha contato e che questo caricamento non
    // scrive mai - e ogni blocco si scrive al massimo una volta, quindi
    // l'archivio non puo' mai avere piu' righe di BASE + FILE - ne' in totale
    // ne' per singolo ordine, perche' un ordine conservato il file non lo
    // contiene e un ordine del file non e' conservato - e le righe possono solo
    // aggiungersi, mai sparire. Da qui viene il verdetto: una lettura che dice
    // "ci sono tutte" non puo' essere una lettura in ritardo, perche' una
    // lettura in ritardo mostra sempre MENO di quello che c'e'.
    try {
      const res = await base44.functions.invoke('importaBlocco', {
        azione: 'scrivi', tipo_file: tipoFile, entita, righe: fetta, blocco,
      });
      const dati = res.data || res;
      if (dati.scritte > 0) {
        totaleScritte += dati.scritte;
        righeConfermate += dati.scritte;
        segnaOrdini(confermatePerOrdine, fetta);
        segnaOrdini(scrittePerOrdine, fetta);
        scritto = true;
      } else if (dati.ultimo_errore) {
        ultimoErrore = dati.ultimo_errore;
      }
    } catch (e) {
      // Un blocco rifiutato (per esempio righe di un altro archivio) non si ritenta.
      if (nonRitentabile(e)) throw e;
      ultimoErrore = messaggioErrore(e);
    }

    if (!scritto) {
      // La scrittura non ha confermato niente, ma puo' essere arrivata lo
      // stesso: la rete cade dopo, oppure la scrittura lascia dentro meta'
      // delle righe e poi si lamenta. All'archivio si chiede l'unica cosa che
      // una lettura puo' PROVARE: "quelle righe ci sono".
      //
      // IL BLOCCO NON SI RISCRIVE MAI. Era l'ultima scrittura cieca rimasta, ed
      // e' quella che fabbricava i doppioni: il blocco entra, la rete cade, il
      // conteggio e' ancora indietro di qualche secondo - il guasto che il
      // commento in testa a questo file descrive - e quel numero indietro
      // diventava il permesso di riscrivere. Duecento righe entravano due volte,
      // l'archivio ne aveva 650 su 450, e siccome anche la verifica finale
      // leggeva quel numero indietro il caricamento si chiudeva "successo" coi
      // pesi contati doppi. RILEGGERE DI PIU' NON LO RISOLVE: "le righe non ci
      // sono" e "la lettura e' indietro" danno lo stesso identico numero, per
      // quante volte lo si legga e per quanto si aspetti. Il palo non si sposta:
      // si toglie la scrittura.
      //
      // Cosi' il blocco resta IN SOSPESO. Sulle primarie a scioglierlo e' la
      // verifica ordine per ordine: se quelle righe mancano davvero le rimette
      // la riparazione, che toglie e riscrive e non puo' duplicare niente. Sugli
      // altri file la riparazione non c'e' - non c'e' un id ordine comune - e
      // quelle righe si perdono: il caricamento resta "parziale", lo dice, e si
      // ricarica il file. Perdere e' rumoroso, duplicare e' silenzioso: fra i
      // due si sceglie sempre il primo.
      stato('controllo della scrittura', blocco + 1);
      await pausa(ATTESE_RITENTATIVO[0]);
      const conteggio = await chiediConteggio(tipoFile, atteso, gia + totaleScritte, entita);
      // Con dei blocchi gia' in sospeso il conteggio va letto tenendo conto di
      // loro: decidiDalConteggio lo fa e risponde null quando i numeri non
      // distinguono i due casi. Si accetta SOLO "scritto", che e' l'unica
      // risposta che una lettura in ritardo non puo' dare.
      const deciso = conteggio === null ? null : decidiDalConteggio(conteggio, gia + totaleScritte, sospesi, fetta.length);
      if (deciso === 'scritto') {
        totaleScritte += fetta.length;
        segnaOrdini(scrittePerOrdine, fetta);
        scritto = true;
        blocchiDatiPerEntrati++;
        righeDatePerEntrate += fetta.length;
      } else {
        incerto = true;
      }
      // GLI ORDINI DI QUESTO BLOCCO NON SONO PIU' CERTI, in tutti e due i casi.
      // Di un blocco che la function non ha confermato non si sa quante righe
      // abbia lasciato in archivio: zero, quelle giuste, oppure il doppio se la
      // piattaforma ha ripetuto la richiesta da sola. Il conteggio dice che ci
      // sono, non che ci sono UNA VOLTA SOLA, e una lettura in ritardo dice
      // proprio quello che si vorrebbe sentire. Questi ordini se li prende la
      // riparazione, che toglie e riscrive: dopo di lei sono certi per
      // costruzione, non per una lettura.
      for (const r of fetta) ordiniDubbi.add(String(r.ID));
    }

    if (incerto) { righeIncerte += fetta.length; sospesi.push(fetta.length); }
    stato('scrittura', blocco + 1);
  }

  return { totaleScritte, righeConfermate, confermatePerOrdine, scrittePerOrdine, righeIncerte, ultimoErrore, blocchiDatiPerEntrati, righeDatePerEntrate, totaleBlocchi, ordiniDubbi };
}

/**
 * Legge il file nel browser e lo invia al backend a blocchi.
 *
 * @param {File}     file               il file scelto dall'utente
 * @param {string}   tipoFile           chiave del tipo, es. dichiarazioni_trattamento
 * @param {function} onProgress         riceve { fase, blocco, totaleBlocchi, righeScritte, totaleRighe, tentativo }
 * @param {boolean}  confermaForzatura  prosegue nonostante il controllo anti-regressione
 * @returns {Promise<object>}           riepilogo finale
 */
export async function importaGrandeFile({ file, tipoFile, onProgress, confermaForzatura = false }) {
  const avvisa = (dati) => { if (onProgress) onProgress(dati); };

  avvisa({ fase: 'lettura del file nel browser' });
  const { nomeFoglio, intestazioni, righe } = await leggiFile(file);
  const totaleRighe = righe.length;

  // === Preparazione: firma del file, anti-regressione, svuotamento archivio ===
  // Un errore qui viene propagato come eccezione: il file e' da rifiutare e la
  // risposta porta con se' l'indicazione che nulla e' stato toccato.
  avvisa({ fase: 'verifica del file' });
  let datiPrep = null;
  for (let tentativo = 0; ; tentativo++) {
    try {
      const prep = await base44.functions.invoke('importaBlocco', {
        azione: 'prepara',
        tipo_file: tipoFile,
        nome_file: file.name,
        intestazioni,
        totale_righe: totaleRighe,
        conferma_forzatura: confermaForzatura || undefined,
      });
      datiPrep = prep.data || prep;
      // Lo svuotamento e' l'operazione piu' lunga dell'intera importazione ed e'
      // quella che piu' facilmente supera l'attesa massima del database. Si
      // procede solo dopo aver verificato che l'archivio sia davvero vuoto:
      // record superstiti diventerebbero duplicati invisibili.
      const rimasti = await chiediConteggio(tipoFile, 0, 0);
      if (rimasti === 0) break;
      if (tentativo >= ATTESE_RITENTATIVO.length) {
        throw new Error(`Svuotamento dell'archivio incompleto: restano ${rimasti} record. Riprova il caricamento.`);
      }
    } catch (e) {
      // Un file rifiutato o bloccato dal controllo anti-regressione non si
      // ritenta: la risposta va mostrata all'utente cosi' com'e'.
      if (nonRitentabile(e)) throw e;
      if (tentativo >= ATTESE_RITENTATIVO.length) throw e;
      avvisa({ fase: 'nuovo tentativo di preparazione' });
    }
    await pausa(ATTESE_RITENTATIVO[Math.min(tentativo, ATTESE_RITENTATIVO.length - 1)]);
  }
  const avvisoCalo = datiPrep && datiPrep.avviso_calo ? datiPrep.avviso_calo : null;
  const righeArchivioPrima = datiPrep ? datiPrep.righe_archivio_prima : undefined;

  // === Scrittura dei blocchi ===
  const { totaleScritte, righeConfermate, righeIncerte, ultimoErrore, blocchiDatiPerEntrati, righeDatePerEntrate, totaleBlocchi } = await scriviBlocchi({
    tipoFile, righe, avvisa,
    avanzamento: { bloccoIniziale: 0, totaleBlocchi: Math.ceil(totaleRighe / RIGHE_PER_BLOCCO), righeIniziali: 0, totaleRighe },
  });

  // === Verifica finale: quante righe contiene davvero l'archivio ===
  // Un archivio che non si e' riusciti a contare non e' un archivio verificato:
  // se un blocco fosse entrato due volte nessuno se ne accorgerebbe. Si dice, e
  // il caricamento non si chiude come riuscito.
  //
  // QUI UNA LETTURA SOLA BASTA, E NON PERCHE' CI SI FIDI DELLE LETTURE.
  // L'archivio e' stato svuotato e verificato a zero, e ogni blocco e' stato
  // scritto al massimo una volta: quindi contiene AL PIU' le righe del file, e
  // le righe possono solo aggiungersi. Una lettura che risponde col numero del
  // file non puo' essere in ritardo - una lettura in ritardo mostrerebbe meno -
  // e quindi e' una prova. Prima si rileggeva sperando che la seconda lettura
  // fosse migliore della prima: ma due letture in ritardo di fila sono
  // esattamente cio' che fa una piattaforma indietro di qualche secondo, e il
  // caricamento si chiudeva "successo" con duecento righe entrate due volte.
  avvisa({ fase: "verifica dell'archivio" });
  let conteggioFinale = await chiediConteggio(tipoFile, totaleScritte, totaleRighe);
  // Un numero piu' basso invece puo' essere una lettura in ritardo: prima di
  // gridare si aspetta e si riconta, altrimenti si spaventa la gente per un
  // falso allarme. Questa rilettura non decide niente, serve solo a non dare
  // una brutta notizia sbagliata.
  if (conteggioFinale !== null && conteggioFinale !== totaleRighe) {
    avvisa({ fase: "nuovo controllo dell'archivio" });
    await pausa(PAUSA_PRIMA_DI_RICONTARE);
    const seconda = await chiediConteggio(tipoFile, totaleRighe, totaleScritte);
    if (seconda !== null) conteggioFinale = seconda;
  }
  // LA LETTURA CHE CONTRADDICE LE SCRITTURE CONFERMATE NON SI USA. La function
  // ha detto di aver scritto righeConfermate righe e da allora nessuno ha tolto
  // niente: un conteggio piu' basso di quel numero non e' "mancano delle
  // righe", e' una lettura da buttare. Non si dichiara ne' "successo" ne'
  // quante righe manchino: si dice che non si e' potuto verificare.
  const letturaIncoerente = conteggioFinale !== null && conteggioFinale < righeConfermate;
  const contatoMale = conteggioFinale === null || letturaIncoerente;
  // UN BLOCCO CHE LA PIATTAFORMA NON HA CONFERMATO NON LO SCIOGLIE UN
  // CONTEGGIO. Di quel blocco non si sa se abbia lasciato in archivio zero
  // righe, quelle giuste, o il doppio (una richiesta puo' essere stata
  // eseguita due volte). Un conteggio uguale alle righe del file non distingue
  // "ci sono una volta sola" da "una lettura in ritardo", e su questo percorso
  // non c'e' la riparazione a scioglierlo, perche' non c'e' un id ordine comune
  // a tutti i tipi di file. Allora non si dichiara riuscito: si dice che quelle
  // righe sono rimaste in sospeso, il caricamento resta parziale e si ricarica
  // il file, che svuota l'archivio e lo riscrive.
  //
  // E' il prezzo di non raccontare un "successo" che nessuno puo' sostenere.
  // Prima bastava UNA lettura in ritardo e il caricamento si chiudeva riuscito
  // con duecento righe entrate due volte, e i pesi contati doppi da li' in poi.
  //
  // VALE ANCHE PER IL BLOCCO CHE UN CONTEGGIO HA DATO PER ENTRATO
  // (blocchiDatiPerEntrati): li' a rispondere "scritto" e' stato di nuovo un
  // conteggio, ed e' proprio cio' che direbbe una lettura in ritardo se il
  // blocco fosse entrato DUE volte. Sulle primarie quel dubbio lo raccoglie
  // ordiniDubbi e lo scioglie la riparazione; qui la riparazione non c'e', e
  // il dubbio si dice e basta. Senza questa riga il percorso restava indietro
  // di un giro rispetto alle primarie: un blocco non confermato veniva
  // sciolto da un conteggio e il caricamento chiudeva "successo" con
  // duecento righe entrate due volte.
  const nonConfermato = righeIncerte > 0 || righeDatePerEntrate > 0;
  const nonVerificato = contatoMale || nonConfermato;
  const disallineamento =
    !contatoMale && conteggioFinale !== totaleRighe
      ? { archivio: conteggioFinale, file: totaleRighe }
      : null;

  // Qui l'archivio lo svuota la preparazione e ci scrive solo questo
  // caricamento: se alla fine ha esattamente le righe del file, i blocchi
  // rimasti in sospeso sono entrati - non ne mancano e non ce ne sono di
  // troppo. Il dubbio e' sciolto, come gia' fanno le primarie. Prima restava
  // aperto: l'esito si chiudeva "parziale" su un archivio completo, il registro
  // diceva 250 righe importate su 450 davvero presenti, e bloccante in
  // reportSettimanali.ts rendeva l'archivio inaffidabile - report, alert,
  // quadratura FIR, predittivita' e ritiri ECT rispondevano 409 finche' non si
  // ricaricava un file gia' entrato tutto.
  const quadra = !nonVerificato && !disallineamento;
  // Quante righe del file sono in archivio adesso. Se il conteggio non ha
  // risposto, o ha risposto meno di quante ne sono state confermate, quel
  // numero non si usa: si scrive quello che si sa per certo, cioe' le righe che
  // la piattaforma ha confermato di aver scritto o dato per entrate.
  const righeImportate = quadra
    ? totaleRighe
    : (contatoMale ? totaleScritte : Math.min(totaleScritte, conteggioFinale));
  // LE RIGHE DI CUI NON SI SA. Sono quelle dei blocchi che la piattaforma non
  // ha confermato: sia quelle rimaste in sospeso, sia quelle che un conteggio
  // ha dato per entrate - un conteggio non e' una conferma, e se non si
  // contano qui spariscono dal racconto e nessuno legge piu' il dubbio.
  const incerteRimaste = quadra ? 0 : righeIncerte + righeDatePerEntrate;
  // Le righe del file che in archivio non ci sono ADESSO: si guarda com'e'
  // rimasto l'archivio, non quanti tentativi sono caduti. Quelle in sospeso
  // sono gia' contate a parte e non si sommano a queste: nella stessa riga di
  // registro si leggevano "430 entrate" e "100 non scritte" su 480.
  const falliteRimaste = quadra || contatoMale ? 0 : Math.max(0, totaleRighe - conteggioFinale - incerteRimaste);

  const esito = falliteRimaste === 0 && !disallineamento && !nonVerificato && incerteRimaste === 0
    ? 'successo'
    : (righeImportate > 0 ? 'parziale' : 'errore');

  await base44.functions.invoke('importaBlocco', {
    azione: 'registra',
    tipo_file: tipoFile,
    nome_file: file.name,
    righe_importate: righeImportate,
    righe_fallite: falliteRimaste,
    ultimo_errore: ultimoErrore,
    // Un conteggio che smentisce le scritture confermate non va nel registro:
    // scritto li' diventa "archivio contato dopo la scrittura: 250 record" e
    // resta per sempre, sopra un numero appena dichiarato inattendibile.
    conteggio_finale: letturaIncoerente ? null : conteggioFinale,
    // ...e si dice PERCHE' non c'e': "non ha risposto" e "ha risposto meno di
    // quante ne sono state scritte" sono due guasti diversi.
    lettura_incoerente: letturaIncoerente || undefined,
    // Le righe che il file porta: senza questo numero il registro non poteva
    // accorgersi di un archivio con 650 righe su 450, e chiudeva "successo"
    // scrivendo "archivio verificato: 650 record".
    totale_righe: totaleRighe,
    // Due cose diverse, due campi: il conteggio che non e' riuscito e le righe
    // rimaste in sospeso. Con un flag solo la riga del registro diceva
    // "archivio verificato: 450 record" e subito dopo "archivio non verificato".
    righe_incerte: incerteRimaste || undefined,
    righe_archivio_prima: righeArchivioPrima,
    conferma_forzatura: confermaForzatura || undefined,
  });

  // === Le dichiarazioni caricate a portale si riconoscono da sole ===
  // Dal report appena caricato si capisce quali nostre dichiarazioni mensili sono
  // state caricate e quando: senza questo passo restavano "non caricate" finche'
  // qualcuno non premeva "Allinea dal portale", e la quadratura con il portale
  // restava alta di un mese gia' dichiarato. Se non riesce il caricamento resta
  // buono: lo si dice, e il pulsante in Dichiarazioni Impianti lo rifa'.
  let allineamento = null;
  if (tipoFile === 'dichiarazioni_trattamento' && totaleScritte > 0) {
    avvisa({ fase: 'riconoscimento delle dichiarazioni caricate a portale' });
    try {
      const res = await base44.functions.invoke('importaBlocco', { azione: 'allinea', tipo_file: tipoFile });
      allineamento = (res.data || res).allineamento || null;
    } catch (e) {
      allineamento = { errore: messaggioErrore(e) };
    }
  }

  return {
    tipo_file: tipoFile,
    foglio: nomeFoglio,
    righe_lette: totaleRighe,
    righe_importate: righeImportate,
    righe_fallite: falliteRimaste,
    blocchi: totaleBlocchi,
    blocchi_confermati_dal_conteggio: blocchiDatiPerEntrati,
    conteggio_finale: letturaIncoerente ? null : conteggioFinale,
    avviso_calo: avvisoCalo,
    avviso_disallineamento: disallineamento,
    // Piu' righe di quelle del file: qualcosa e' entrato due volte e quei pesi
    // adesso si contano doppi. Il campo lo produceva solo il percorso delle
    // primarie, e su questo i ricalcoli dei moduli partivano lo stesso, sopra i
    // pesi doppi.
    avviso_doppioni: disallineamento && conteggioFinale > totaleRighe
      ? {
        righe_in_piu: conteggioFinale - totaleRighe,
        ordini: 0,
        // L'archivio si chiama come lo chiama chi lavora: prima usciva
        // "archivio: 650 righe invece delle 450 del file", con la parola
        // "archivio" al posto di un nome.
        archivi: [{ nome: NOMI_TIPO[tipoFile] || tipoFile, righe: conteggioFinale, attese: totaleRighe, ordini: 0, esempi: [] }],
      }
      : null,
    // "Non contato" e "ha risposto meno di quante ne sono state scritte" sono
    // due cose diverse e si dicono in due modi diversi: la seconda non e' un
    // archivio a cui mancano righe, e' una lettura da buttare.
    avviso_non_verificato: nonVerificato || incerteRimaste > 0
      ? {
        non_contato: conteggioFinale === null,
        archivi: conteggioFinale === null ? [NOMI_TIPO[tipoFile] || tipoFile] : [],
        incoerenti: letturaIncoerente ? [NOMI_TIPO[tipoFile] || tipoFile] : [],
        righe_incerte: incerteRimaste,
      }
      : null,
    ultimo_errore: ultimoErrore,
    allineamento,
    esito,
  };
}

// === Primarie ===
// Suddivisione in archivi: specchio di archivioPrimaria (base44/shared/primarie.ts),
// che il backend riapplica a ogni blocco e che rifiuta i blocchi non coerenti.
// "storico": gli archivi che CONSERVANO i terminati (e gli "eseguito") degli
// anni prima che il file non contiene. Sono gli stessi due di ARCHIVI_CON_STORICO
// in base44/functions/importaBlocco/entry.ts, e vanno tenuti uguali: gli archivi
// degli assegnati si riscrivono sempre da zero.
const ARCHIVI_PRIMARIE = [
  { entita: 'PrimariaRete', nome: 'Primarie RETE', chiave: 'primarie_rete', storico: true },
  { entita: 'PrimariaAci', nome: 'Primarie ACI', chiave: 'primarie_aci', storico: true },
  { entita: 'Assegnato', nome: 'Assegnati RETE', chiave: 'assegnati' },
  { entita: 'AssegnatoAci', nome: 'Assegnati ACI', chiave: 'assegnati_aci' },
];

function classeDalProdotto(prodotto) {
  if (!prodotto) return null;
  const s = String(prodotto).trim();
  if (s.toLowerCase().includes('autodemolizione')) return 'PFU Autodemolizione';
  const idx = s.indexOf(' -');
  if (idx > 0 && s.substring(0, idx).trim()) return s.substring(0, idx).trim();
  const m = s.match(/^([A-Z0-9]{1,3})\s*-/i);
  return m ? m[1].toUpperCase() : null;
}

function archivioRiga(riga) {
  const classeFile = riga.Classe != null && riga.Classe !== '' ? String(riga.Classe).trim() : '';
  const c = (classeFile || classeDalProdotto(riga.Prodotto) || '').toLowerCase();
  // stessa regola di tutto il gestionale: vedi base44/shared/primarie.ts
  const aci = eAci({ classe: c, prodotto: riga.Prodotto, codice_prodotto: riga.Codice_Prodotto });
  const assegnato = String(riga.Stato || '').toLowerCase().trim() === 'assegnato';
  if (assegnato) return aci ? 'AssegnatoAci' : 'Assegnato';
  return aci ? 'PrimariaAci' : 'PrimariaRete';
}

/**
 * Gli ordini che a portale sono in stato "eseguito": hanno tutti i dati
 * inseriti ma nessuno ha premuto il pulsante "chiudi". E' un limbo, e il
 * gestionale conta solo i "terminato": finche' restano cosi' spariscono in
 * silenzio dal raccolto, dalle giacenze, dai report, dalla copertura del target
 * e dalla fatturazione. Sui dati veri ce n'era uno, ET26152600 da 3.620 kg, e
 * mancava dal raccolto senza che nessuno lo dicesse (24/09/2026).
 *
 * Si contano a parte e si dicono, rete e ACI separati (regola 3): non si sommano
 * ai terminati e non cambiano nessun conto.
 *
 * La regola di chi e' "eseguito" e di come si contano gli ordini e' UNA SOLA, e
 * sta in src/lib/movimenti.js (eEseguito, chiaveOrdine, riepilogoEseguiti): la
 * stessa che usa l'avviso in testa alle pagine Primarie. Qui le righe del file
 * si girano nella forma dell'archivio e si passano di li', altrimenti la
 * finestra del caricamento e la pagina potrebbero dire due numeri diversi
 * (il file dice "ID", l'archivio "id_ordine"; il ripiego sul formulario e il
 * confronto senza maiuscole li fa solo chiaveOrdine).
 */
function comeInArchivio(r) {
  return {
    stato: r.Stato,
    id_ordine: r.ID,
    numero_fir: r.Numero_FIR,
    peso_effettivo: Number(r.Peso_effettivo) || 0,
  };
}

function ordiniEseguitiDelFile(righe) {
  const perCanale = { rete: [], aci: [] };
  for (const r of righe) {
    if (!eEseguito(comeInArchivio(r))) continue;
    perCanale[archivioRiga(r) === 'PrimariaAci' ? 'aci' : 'rete'].push(comeInArchivio(r));
  }
  const quota = (elenco) => {
    const q = riepilogoEseguiti(elenco);
    return { ordini: q.ordini, righe: q.righe, kg: q.kg, esempi: q.esempi.slice(0, 10) };
  };
  const rete = quota(perCanale.rete);
  const aci = quota(perCanale.aci);
  return rete.ordini || aci.ordini ? { rete, aci } : null;
}

/**
 * Rimette a posto da solo un archivio che non quadra, senza svuotarlo.
 *
 * UN MODO SOLO, ED E' IDEMPOTENTE: per ogni ordine che non torna si TOLGONO le
 * sue righe e si RISCRIVONO quelle del file. Comunque fosse messo l'archivio -
 * e qualunque cosa dica una lettura in ritardo - quell'ordine finisce con
 * esattamente le righe che ha nel file, e doppioni non se ne creano mai.
 *
 * Ci passano anche gli ordini che in archivio risultano avere ZERO righe: per
 * loro la cancellazione e' a vuoto nel caso onesto, e toglie le righe che la
 * lettura non aveva visto nel caso della lettura in ritardo. Costa una
 * richiesta ogni cinquanta ordini, cioe' niente. C'era un secondo modo,
 * "aggiungi", che quegli ordini li riscriveva SENZA cancellare: bastava una
 * lettura di sei secondi indietro perche' fabbricasse righe doppie vere, e il
 * caricamento si chiudeva "successo" coi pesi contati doppi e i ricalcoli che
 * partivano sopra. Perdere righe e' rumoroso e si rimedia ricaricando;
 * duplicarle e' silenzioso: fra i due si sceglie sempre il primo.
 *
 * Cinquantasette righe sono un attimo, e nessuno deve rifare undicimila righe.
 *
 * Restituisce { riscritte, tolte, fallite, incerte, cancellato, incerta, toccato, non_fatta }:
 *  - riscritte: righe rimesse in archivio dal file;
 *  - tolte: righe di troppo per intero (ordini che nel file non ci sono) tolte
 *    e basta, che non si riscrivono e non vanno raccontate come "riscritte";
 *  - tolteDalGestionale: quante righe la cancellazione ha tolto DAVVERO. Non e'
 *    lo stesso di "quante ne mancano": in mezzo agli ordini da rimettere a
 *    posto ce ne sono quasi sempre di quelli che in archivio non avevano
 *    nessuna riga - le righe mai entrate - e quelle non le ha tolte nessuno.
 *    Serve a dire il numero giusto invece di prendersi tutto il buco;
 *  - tolteDavvero: le stesse righe, ma TUTTE, anche quelle che nel file non
 *    ci sono. E' il numero che chi chiama confronta col conteggio di dopo per
 *    sapere se la cancellazione ha tolto cio' che diceva di togliere;
 *  - toccato: se l'archivio PUO' ESSERE CAMBIATO. Chi chiama DEVE ricontare
 *    prima di costruire un verdetto: i numeri di prima non valgono piu'.
 *    Vale anche per una richiesta di cancellazione partita e mai risposta:
 *    una risposta persa non vuol dire che non sia successo niente;
 *  - incerte: righe che si e' provato a riscrivere senza sapere se siano
 *    entrate. Prima si buttavano via qui dentro, e il dubbio non arrivava a
 *    chi legge;
 *  - cancellato: se qualcosa e' stato tolto DAVVERO (la function l'ha detto).
 *    Serve a dire "ho tolto le righe sbagliate e non sono riuscito a
 *    riscriverle", che e' una cosa diversa da "non ci sono riuscito e non ho
 *    toccato niente";
 *  - incerta: una cancellazione e' partita e non si sa come sia finita. Non si
 *    puo' dire "ho tolto", ma nemmeno "non ho toccato niente";
 *  - non_fatta: perche' non si e' nemmeno provato, quando e' cosi'. Meglio
 *    dirlo che provarci e rompere a meta'.
 *
 * DUE REGOLE CHE QUESTA FUNZIONE NON PUO' VIOLARE:
 *
 *  1. SI TOCCANO SOLO GLI ORDINI PRESENTI NEL FILE. Un ordine che il file non
 *     porta non si tocca mai, perche' tutto questo giro si regge sul poter
 *     RISCRIVERE cio' che si toglie, e li' non c'e' niente da riscrivere:
 *     cancellarlo vorrebbe dire perderlo per sempre. E' il caso dello storico
 *     conservato - in archivio c'e', nel file no, e restare e' esattamente cio'
 *     che l'utente ha deciso - e senza il freno la riparazione lo cancellava e
 *     lo raccontava pure come merito ("righe di troppo tolte"). Il freno vero e'
 *     nel ciclo di importaPrimarie, che quegli ordini non li manda nemmeno; qui
 *     si manda alla function quante righe il file porta a ciascuno (nel_file) e
 *     la function rifiuta tutto se ne arriva uno a zero: e' l'ultima rete.
 *     Il prezzo: una riga rimasta in archivio di un ordine che il file non
 *     contiene - un residuo di un caricamento morto a meta' - adesso NON si
 *     toglie da sola. Si dice ("righe di troppo"), il caricamento resta
 *     parziale e si rimedia ricaricando lo stesso file, che svuota e riscrive.
 *     Fra perdere righe e tenerne una di troppo che si vede, si sceglie la
 *     seconda: la prima e' silenziosa e definitiva.
 *
 *  2. SE UN ORDINE CONSERVATO NON TORNA NON SI RIPARA: SI DICE. Se un ordine
 *     dello storico avesse meno righe di quante la preparazione ne aveva
 *     contate, il file non le contiene e nessuno puo' rimetterle: l'unico
 *     rimedio e' ricaricare il file completo dal primo anno. Lo conta
 *     importaPrimarie e finisce in avviso_storico_non_torna.
 */
async function riparaArchivio({ tipoFile, entita, nome, righeArchivio, ordini, righeGiaInArchivio, avvisa }) {
  const ids = new Set(ordini.map(o => o.id_ordine));
  const volteInArchivio = new Map(ordini.map(o => [o.id_ordine, Number(o.volte) || 0]));
  const nelFile = new Map(ordini.map(o => [o.id_ordine, Number(o.nel_file) || 0]));
  const niente = { riscritte: 0, tolte: 0, incerte: 0, cancellato: false, incerta: false, toccato: false, non_fatta: null, ritentabile: false, ordiniCerti: new Set() };
  let toccato = false;
  let cancellato = false;
  let incerta = false;
  let tolte = 0;
  // Quante righe la cancellazione ha tolto DAVVERO, in tutti i giri: e' il
  // numero con cui si dice "quel buco l'ha fatto il gestionale" senza
  // prendersi anche le righe che non erano mai entrate.
  const tolteDalGestionalePerOrdine = new Map();
  // QUANTE RIGHE LA CANCELLAZIONE HA DETTO DI TOGLIERE, tutte, non solo quelle
  // del file. Serve a chi chiama per un controllo solo, ma decisivo: se dopo il
  // giro quelle righe sono ANCORA li', il filtro a lotti non sta togliendo
  // niente e riscrivere un'altra volta ne aggiungerebbe altre. Se invece la
  // cancellazione non aveva niente da togliere (gli ordini in archivio erano
  // gia' vuoti) non c'e' niente da controllare e il giro dopo puo' andare.
  let tolteDavvero = 0;
  // Le righe tolte per intero, ORDINE PER ORDINE: chi chiama le somma una volta
  // sola anche se la riparazione fa due giri sugli stessi ordini. Sommando i
  // totali di ogni giro lo storico scriveva "100 righe rimesse a posto" dove gli
  // ordini toccati erano cinquanta, e quel numero resta scritto per sempre.
  const toltePerOrdine = new Map();
  // Gli ordini che la function ha CONFERMATO di aver tolto. Solo per loro la
  // riscrittura puo' rendere certo quante righe hanno: tolte e riscritte, tutte
  // e due confermate, l'ordine ha esattamente le righe del file, e non c'e'
  // lettura che possa dire il contrario.
  const tolti = new Set();
  // Quante righe ha l'archivio adesso: scende con quelle che si cancellano.
  // Serve a scriviBlocchi per riconoscere un blocco ritentato che era passato.
  let inArchivio = Math.max(0, Number(righeGiaInArchivio) || 0);
  const esitoQui = (extra) => ({ ...niente, tolte, toltePerOrdine, cancellato, incerta, toccato, tolteDalGestionalePerOrdine, tolteDavvero, ...extra });

  // Gli id si mandano gia' ripuliti e senza doppioni, cioe' esattamente come la
  // function li tratta: lei deduplica e toglie gli spazi per conto suo, e il
  // browser fa restano.slice(fatti) sulla SUA lista. Con due liste di lunghezza
  // diversa "quanti ne ho tolti" avrebbe fatto scivolare il taglio sugli ordini
  // sbagliati. Cosi' le due liste sono la stessa per costruzione.
  // Quanti ordini siano troppi per una riparazione lo decide chi chiama
  // (MAX_ORDINI_RIPARAZIONE), prima di arrivare qui.
  const daTogliere = [...new Set(ordini.map(o => String(o.id_ordine || '').trim()).filter(Boolean))];
  // Le cancellazioni si fanno a giri: un'invocazione ha dodici secondi e dice
  // dove si e' fermata, come il conteggio esatto.
  let restano = daTogliere;
  while (restano.length) {
    avvisa({ fase: `riparazione dell'archivio ${nome}: tolgo le righe sbagliate di ${formatIntero(restano.length)} ordini`, archivio: nome });
    let dati;
    // Da qui in poi l'archivio PUO' essere cambiato: la richiesta e' partita, e
    // una risposta che non torna non vuol dire che non sia successo niente.
    // Dichiararsi "non ho toccato niente" faceva uscire dal ciclo senza
    // ricontare, e il verdetto tornava ai numeri di prima: cinquanta ordini
    // spariti e a video scritto che erano di troppo, coi nomi di ordini che non
    // esistevano piu'. Nel dubbio si riconta.
    toccato = true;
    try {
      const res = await base44.functions.invoke('importaBlocco', {
        azione: 'cancella_ordini', tipo_file: tipoFile, entita, nome, ordini: restano,
        // Quante righe il file porta a ciascuno di questi ordini: la function
        // rifiuta la richiesta per intero, senza toccare niente, se ne arriva
        // uno che il file non contiene. Qui non deve arrivarcene nessuno: e'
        // l'ultima rete, non il freno.
        nel_file: Object.fromEntries(restano.map(id => [id, nelFile.get(id) || 0])),
      });
      dati = res.data || res;
    } catch (e) {
      if (nonRitentabile(e)) throw e;
      // "DATI INTATTI" SI CREDE SOLO SE VUOL DIRE "NON HO TENTATO NIENTE".
      //
      // La function lo dice adesso solo in quel caso, ma qui si controlla lo
      // stesso, perche' e' il campo accanto a dirlo: "ritentabile" vuol dire
      // interruzione, cioe' una richiesta PARTITA che il database puo' aver
      // eseguito comunque. Li' "dati intatti" e' un'opinione, non un fatto, e
      // fidarsene faceva uscire dal ciclo senza ricontare: cinquanta ordini del
      // file cancellati adesso e raccontati a video come righe "di troppo", coi
      // loro nomi.
      const risposta = datiErrore(e);
      if (risposta && risposta.dati_intatti === true && risposta.ritentabile !== true) {
        toccato = cancellato || incerta;
        // NON HA TOLTO NIENTE, MA NON CI E' NEMMENO RIUSCITO: si dice. Prima si
        // usciva di qui in silenzio, senza motivo e senza secondo tentativo, e
        // a chi legge sembrava che il gestionale non ci avesse nemmeno provato -
        // proprio la distinzione che questo file si e' dato per iscritto.
        // Il limite di richieste puo' arrivare da DENTRO la function: li' la
        // risposta e' 500 e il 429 sta nel corpo, perche' deleteMany e' avvolto
        // da conLimiteRichieste, si arrende e l'errore risale al catch finale.
        // Guardando il solo stato, il ritentativo dopo il limite non scattava
        // proprio nella forma in cui il limite arriva davvero. Stessa cosa fa
        // dopoCaricamento, tre funzioni piu' sotto.
        const perIlLimite = eLimiteRichieste(e) || eLimiteRichieste(messaggioErrore(e));
        return esitoQui({
          non_fatta: perIlLimite
            ? "la cancellazione e' stata respinta per il limite di richieste della piattaforma: riprova fra un minuto ricaricando lo stesso file"
            : `la cancellazione non e' riuscita (${messaggioErrore(e)}): ricarica lo stesso file`,
          // Una porta chiusa per il limite si riapre da sola: quello e' l'unico
          // motivo per cui rifare la stessa richiesta ha senso.
          ritentabile: perIlLimite,
        });
      }
      incerta = true;
      return esitoQui({});
    }
    const fatti = Number(dati.cancellati) || 0;
    // QUANTE RIGHE SONO USCITE DAVVERO, non quanti ordini sono passati al
    // filtro. Cancellare un ordine che in archivio ha ZERO righe non toglie
    // niente: e' il caso piu' comune di tutti - le righe che non sono mai
    // entrate, cioe' le 57 righe perse la notte del 24/09 - e raccontarlo come
    // "ho tolto le righe sbagliate, quel buco l'ha fatto adesso il gestionale"
    // manda a cercare un guasto del gestionale dove c'e' un guasto di rete, e
    // fa perdere la sola notizia utile: quelle righe non sono MAI entrate.
    let righeTolteDavvero = 0;
    for (const id of restano.slice(0, fatti)) {
      const quante = volteInArchivio.get(id) || 0;
      inArchivio -= quante;
      righeTolteDavvero += quante;
      // QUANTO DEL BUCO L'HA FATTO IL GESTIONALE. Delle righe tolte a
      // quest'ordine, solo quelle che il FILE gli porta sono un buco: le altre
      // erano di troppo e toglierle e' stato il rimedio, non il danno. Un
      // ordine con due righe di cui una sola nel file lascia un buco di una
      // riga, non di due, e dirlo di due manda a cercare un guasto piu' grosso
      // di quello che c'e'.
      tolti.add(id);
      const delFile = Math.min(quante, nelFile.get(id) || 0);
      if (delFile > 0) tolteDalGestionalePerOrdine.set(id, Math.max(tolteDalGestionalePerOrdine.get(id) || 0, delFile));
      // Gli ordini che nel file non ci sono non si riscrivono: le loro righe
      // erano di troppo per intero e adesso non ci sono piu'.
      if (!nelFile.get(id)) { tolte += quante; toltePerOrdine.set(id, quante); }
    }
    tolteDavvero += righeTolteDavvero;
    if (righeTolteDavvero > 0) cancellato = true;
    // La function ha risposto, quindi adesso si sa: se non ha tentato niente e
    // lo dichiara, l'archivio e' esattamente come prima e non c'e' nessun
    // conteggio da rifare. "Nel dubbio si riconta" vale finche' il dubbio c'e'.
    if (!fatti && dati.dati_intatti === true) toccato = cancellato || incerta;
    // La piattaforma non ha accettato il filtro a lotti (e gli ordini sono
    // troppi per toglierli uno per uno), oppure l'ha accettato senza togliere
    // niente: si dichiara NON FATTA invece di riscrivere sopra righe che
    // potrebbero esserci ancora. Il motivo vero lo manda la function, perche'
    // sono due guasti diversi; raccontare il meccanismo al posto della
    // situazione mandava fuori strada.
    if (dati.non_fatta) {
      return esitoQui({
        non_fatta: dati.motivo
          ? `${dati.motivo}: conviene ricaricare il file`
          : `non si e' potuto togliere le righe di ${formatIntero(restano.length)} ordini: conviene ricaricare il file`,
      });
    }
    // L'invocazione si e' interrotta: ha detto quanti ne ha tolti, e il resto lo
    // riprende il giro dopo, su un conteggio nuovo. Se non ne ha tolto nessuno
    // che lei sappia, la richiesta e' partita lo stesso e il database puo'
    // averla eseguita: non si dice "non ho toccato niente", si dice che non si sa.
    if (dati.interrotto) {
      if (!fatti && dati.dati_intatti !== true) incerta = true;
      return esitoQui({});
    }
    if (!fatti) return esitoQui({});
    restano = restano.slice(fatti);
  }

  const righeDaRiscrivere = righeArchivio.filter(r => ids.has(String(r.ID)));
  // Un ordine e' CERTO quando la piattaforma ha confermato di averne tolto le
  // righe e di averne riscritte esattamente quante ne porta il file. Da li' in
  // poi l'archivio, per quell'ordine, e' uguale al file per costruzione: e'
  // l'unico modo di chiudere un dubbio senza chiederlo a una lettura.
  const certi = (confermate) => new Set([...ids].filter(id =>
    tolti.has(id) && ((confermate && confermate.get(id)) || 0) === (nelFile.get(id) || 0)));
  if (!righeDaRiscrivere.length) return esitoQui({ ordiniCerti: certi(null) });
  avvisa({ fase: `riparazione dell'archivio ${nome}: riscrivo ${formatIntero(righeDaRiscrivere.length)} righe`, archivio: nome });
  const esito = await scriviBlocchi({
    tipoFile, entita, righe: righeDaRiscrivere, avvisa,
    righeGiaInArchivio: inArchivio,
    avanzamento: {
      bloccoIniziale: 0, totaleBlocchi: Math.ceil(righeDaRiscrivere.length / RIGHE_PER_BLOCCO),
      righeIniziali: 0, totaleRighe: righeDaRiscrivere.length, archivio: nome,
    },
  });
  return esitoQui({
    riscritte: esito.totaleScritte, incerte: esito.righeIncerte,
    confermatePerOrdine: esito.confermatePerOrdine,
    ordiniCerti: certi(esito.confermatePerOrdine),
    // Le righe rimesse in archivio ordine per ordine: chi chiama le conta una
    // volta sola anche quando la riparazione fa due giri sugli stessi ordini.
    riscrittePerOrdine: esito.scrittePerOrdine,
  });
}

/**
 * Importa il file unico delle primarie: controllo degli ordini rispetto all'archivio,
 * poi ogni archivio (rete, ACI, assegnati) viene svuotato e riscritto a blocchi,
 * e alla fine si contano le righe di ognuno: devono essere esattamente quelle
 * che il file gli porta, ordine per ordine. Se qualcosa non torna il gestionale
 * si ripara da solo e riverifica; si avvisa solo se nemmeno la riparazione basta.
 */
export async function importaPrimarie(opzioni) {
  // LA BANDIERINA DEL CARICAMENTO INTERO, E UNA PORTA SOLA PER USCIRE.
  //
  // "Nessun dato modificato" si dice del CARICAMENTO, non dell'invocazione. Il
  // server sa dire solo della propria: su un 401 (sessione scaduta - un
  // caricamento di primarie dura minuti), un 403 o un 409 risponde "io non ho
  // toccato niente", e ha ragione. Ma gli archivi si svuotano e si riscrivono
  // UNO PER VOLTA, e a caricamento avviato quella frase in verde e' una bugia:
  // chi la legge non ricarica e consulta un archivio mezzo nuovo e mezzo vecchio.
  //
  // La bandierina era consultata in un punto solo, il ramo "non fatta" dello
  // svuotamento, e tutte le altre porte restavano aperte: lo svuotamento che non
  // si ritenta, una scrittura rifiutata, la riparazione, e soprattutto la
  // REGISTRAZIONE FINALE, che si guasta a caricamento gia' completato e a
  // archivio interamente riscritto. Per questo l'errore esce da qui e da nessun
  // altro posto: cosi' non c'e' una porta da dimenticare.
  const bandierina = { toccato: false };
  try {
    return await caricaPrimarie(opzioni, bandierina);
  } catch (e) {
    // Si cambia SOLO la bandierina: messaggio, stato e fase del server restano
    // quelli, perche' sono l'unica cosa che dice che cosa e' andato storto.
    if (bandierina.toccato && e && typeof e === 'object') {
      e.data = { ...(datiErrore(e) || {}), dati_intatti: false };
    }
    throw e;
  }
}

async function caricaPrimarie({ file, onProgress, confermaForzatura = false }, bandierina) {
  const tipoFile = 'primarie';
  const inizio = Date.now();
  const avvisa = (dati) => { if (onProgress) onProgress(dati); };

  avvisa({ fase: 'lettura del file nel browser' });
  const letto = await leggiFile(file);
  const righe = letto.righe
    .filter(r => r.ID != null && String(r.ID).trim() !== '')
    .map(r => ({ ...r, ID: String(r.ID).trim() }));
  const totaleRighe = righe.length;
  if (totaleRighe === 0) throw new Error('Il file non contiene ordini.');

  const perArchivio = Object.fromEntries(ARCHIVI_PRIMARIE.map(a => [a.entita, []]));
  let terminati = 0;
  let ultimaFine = null;
  for (const r of righe) {
    perArchivio[archivioRiga(r)].push(r);
    if (String(r.Stato || '').toLowerCase().trim() === 'terminato') terminati++;
    if (typeof r.Trasporto_finito_il === 'number' && (ultimaFine === null || r.Trasporto_finito_il > ultimaFine)) ultimaFine = r.Trasporto_finito_il;
  }
  // Gli ordini "eseguito": a portale non e' stato premuto Chiudi, e finche'
  // restano cosi' non entrano in nessun conto. Si contano dal file, senza
  // nessuna lettura in piu'.
  const eseguiti = ordiniEseguitiDelFile(righe);

  // === Verifica: firma, terminati, ordini in archivio assenti dal file. Nulla viene cancellato. ===
  avvisa({ fase: 'verifica del file e confronto con gli ordini in archivio' });
  const prep = await invocaConRitentativi({
    azione: 'prepara',
    tipo_file: tipoFile,
    nome_file: file.name,
    intestazioni: letto.intestazioni,
    totale_righe: totaleRighe,
    ids: righe.map(r => r.ID),
    terminati,
    ultima_fine_trasporto: ultimaFine,
    conferma_forzatura: confermaForzatura || undefined,
  }, avvisa, 'nuovo tentativo di verifica');
  // LA BASE NOTA: le righe che restano in archivio anche dopo lo svuotamento.
  // Sono i terminati degli anni prima che il file non contiene, contati dalla
  // preparazione (base44/shared/storicoConservato.ts). Da qui in giu' i confronti
  // sono con BASE + FILE, non col solo file. Senza storico vale zero e tutto
  // torna come prima, alla lettera.
  const conservatiDi = (entita) => (prep.conservati && prep.conservati[entita] ? Number(prep.conservati[entita].righe) || 0 : 0);
  // E quante righe ha CIASCUN ordine conservato: serve al confronto ordine per
  // ordine, che col solo file chiamerebbe "righe di troppo" tutto lo storico e
  // farebbe cancellare dalla riparazione proprio quello che si vuole tenere.
  // E quante di quelle righe sono di ordini in stato "eseguito". Si conservano
  // come i terminati - sono uno stato di passaggio, al caricamento dopo il
  // portale da' loro quello definitivo - ma vanno DETTI (regola dell'utente,
  // 28/09/2026): l'avviso sugli eseguiti guarda il FILE, e questi nel file non
  // ci sono, quindi senza questo numero resterebbero in archivio senza comparire
  // da nessuna parte.
  const eseguitiConservatiDi = (entita) => {
    const c = prep.conservati && prep.conservati[entita] ? prep.conservati[entita].eseguiti : null;
    return c && typeof c === 'object'
      ? { ordini: Number(c.ordini) || 0, righe: Number(c.righe) || 0 }
      : { ordini: 0, righe: 0 };
  };
  const conservatiPerOrdineDi = (entita) => {
    const per = prep.conservati && prep.conservati[entita] ? prep.conservati[entita].per_ordine : null;
    return per && typeof per === 'object'
      ? new Map(Object.entries(per).map(([id, quante]) => [String(id), Number(quante) || 0]))
      : new Map();
  };
  // Lo storico che non torna: gli ordini conservati che alla fine hanno meno
  // righe di quante la preparazione ne aveva contate. Non e' un caso da riparare
  // - il file non le contiene e nessuno puo' rimetterle - ma da DIRE.
  let storicoRigheInMeno = 0;
  let storicoOrdiniInMeno = 0;

  // SE IN QUESTO CARICAMENTO SI E' GIA' TOCCATO UN ARCHIVIO. Gli archivi si
  // svuotano e si riscrivono UNO PER VOLTA: quando qualcosa si ferma sul
  // secondo, il primo e' gia' stato svuotato e riscritto col file nuovo. Senza
  // questa bandierina la finestra chiudeva in verde con "questo tentativo non ha
  // modificato ne' cancellato nessun dato" sopra un archivio gia' riscritto, e
  // chi legge quella frase non ricarica: consulta un archivio mezzo nuovo e
  // mezzo vecchio. Il server sa dire solo della PROPRIA invocazione ("io non ho
  // toccato niente"), e ha ragione: e' il browser che deve tenere il conto del
  // caricamento intero.
  //
  // Sta FUORI da questa funzione (importaPrimarie, qui sopra) perche' un errore
  // puo' uscire da mille punti - lo svuotamento, una scrittura, la riparazione,
  // la registrazione finale - e la bandierina va guardata su tutti, non su uno.
  const qualcosaToccato = () => bandierina.toccato === true;

  const totaleBlocchi = ARCHIVI_PRIMARIE.reduce((s, a) => s + Math.ceil(perArchivio[a.entita].length / RIGHE_PER_BLOCCO), 0);
  const archivi = {};
  let bloccoIniziale = 0;
  let righeIniziali = 0;
  let ultimoErrore = null;
  let blocchiDatiPerEntrati = 0;
  const ordiniInArchivio = new Set();
  let ordiniContati = true;

  for (const a of ARCHIVI_PRIMARIE) {
    const righeArchivio = perArchivio[a.entita];
    // La BASE di questo archivio: le righe che ci restano dentro comunque.
    const base = conservatiDi(a.entita);
    const conservatiPerOrdine = conservatiPerOrdineDi(a.entita);

    // === Svuotamento dell'archivio, verificato prima di scrivere ===
    // NON SI VERIFICA PIU' A ZERO, SI VERIFICA SULLA BASE: lo svuotamento
    // conserva i terminati degli anni prima, quindi restano esattamente "base"
    // righe.
    avvisa({ fase: `svuotamento dell'archivio ${a.nome}`, archivio: a.nome });
    // GLI ID DEL FILE SI MANDANO SEMPRE, SU UN ARCHIVIO CHE HA UNO STORICO.
    //
    // Si mandavano solo quando la preparazione aveva contato qualcosa da
    // conservare, e li' c'era il guasto peggiore di tutti: se la preparazione non
    // risponde i conservati - campo assente, oppure a zero perche' una lettura
    // dell'archivio e' tornata vuota per un attimo, oppure una scheda vecchia
    // contro una function nuova - il browser non mandava gli ID, e senza ID la
    // svuota fa il deleteMany di TUTTO. Lo storico degli anni prima sparisce, il
    // caricamento chiude "successo", i ricalcoli partono e non c'e' una frase, da
    // nessuna parte, che lo dica: dati persi e spunta verde.
    //
    // Mandandoli sempre non puo' piu' succedere: la svuota RICALCOLA per conto
    // suo quali ordini conservare - e' la seconda lettura di sicurezza che
    // l'utente ha voluto tenere - quindi una preparazione muta diventa un
    // rumoroso "lo svuotamento non e' arrivato alla base attesa" invece di uno
    // svuotamento a zero. Il prezzo e' una lettura dell'archivio anche quando non
    // c'e' niente da conservare (senza ordini da tenere la svuota finisce comunque
    // nel deleteMany({}) di sempre): si paga.
    //
    // Gli ID sono uno per ORDINE, non uno per riga (sui dati veri ~11.300
    // stringhe), e ripartono a ogni ripresa: il server li mette comunque in un
    // insieme, quindi mandarli doppi e' solo peso in piu' a ogni giro.
    const idsDelFile = a.storico ? [...new Set(righe.map(r => String(r.ID)))] : undefined;
    // Quante righe erano rimaste al giro prima: e' l'unica prova che lo
    // svuotamento stia andando avanti davvero (vedi sotto).
    let rimastiPrima = null;
    let riprese = 0;
    for (let tentativo = 0; ; ) {
      let risposta = null;
      try {
        const res = await base44.functions.invoke('importaBlocco', {
          azione: 'svuota', tipo_file: tipoFile, entita: a.entita,
          ids: idsDelFile,
        });
        risposta = (res && res.data) || res || null;
      } catch (e) {
        if (nonRitentabile(e)) throw e;
      }
      // DA QUI IN POI L'ARCHIVIO PUO' ESSERE STATO TOCCATO. Una risposta che non
      // arriva non vuol dire che la cancellazione non sia avvenuta, e una
      // risposta arrivata senza "non_fatta" vuol dire che e' avvenuta davvero.
      // Solo "non_fatta" e' una dichiarazione di non aver toccato niente.
      if (!risposta || !risposta.non_fatta) bandierina.toccato = true;
      // IL FILTRO PER ID NON REGGE, E QUESTO ARCHIVIO NON E' STATO TOCCATO. Non
      // si ritenta: la stessa richiesta si sentirebbe rispondere lo stesso, e
      // ritentandola alla cieca si chiudeva con "svuotamento incompleto",
      // perdendo la sola frase che dice che cosa fare. "Nessun dato modificato"
      // pero' si dice solo se non e' stato toccato NIENTE, nemmeno un archivio
      // di prima.
      if (risposta && risposta.non_fatta) {
        const motivo = risposta.motivo || `Svuotamento dell'archivio ${a.nome} non fatto: l'archivio non e' stato toccato.`;
        throw Object.assign(new Error(qualcosaToccato()
          ? `${motivo} Gli archivi svuotati prima di ${a.nome} sono gia' stati riscritti con il file nuovo: ricarica il file.`
          : motivo), { data: { dati_intatti: !qualcosaToccato() } });
      }
      let rimasti = await chiediConteggio(tipoFile, base, 0, a.entita);
      // QUANTE RIGHE LA SVUOTA DICE DI AVER CONSERVATO. E' la sua lettura, fatta
      // per conto suo sull'archivio di adesso: la seconda delle due letture
      // dello storico, e serve proprio a non credere a una sola.
      const conservateDallaSvuota = risposta && typeof risposta.conservati === 'number' ? risposta.conservati : null;
      // UN ARCHIVIO CON LO STORICO NON PUO' RESTARE SENZA NESSUNA RIGA.
      //
      // Se una delle due letture dice che qualcosa doveva restare e in archivio
      // non e' rimasto niente, quello storico e' stato cancellato: e' un caso da
      // DICHIARARE, non da chiudere come riuscito. Senza questo controllo il caso
      // si chiudeva "successo" con la spunta verde sopra delle righe perse per
      // sempre - il peggio che possa fare un gestionale - e il rimedio (l'export
      // completo dal primo anno) lo puo' fare solo chi lavora, che non saprebbe
      // mai di doverlo fare.
      const dovevanoRestare = Math.max(base, conservateDallaSvuota || 0);
      if (a.storico && rimasti === 0 && dovevanoRestare > 0) {
        // MA NON SU UNA LETTURA SOLA. E' la regola di tutto questo file, e vale
        // anche - soprattutto - per l'allarme piu' grosso che sappia dare: qui
        // si sta per mandare qualcuno a rifare un export di piu' anni, che il
        // portale non da' facilmente. Un conteggio puo' tornare vuoto per un
        // attimo, ed e' proprio il guasto contro cui questo controllo esiste:
        // prima di dichiarare lo storico perduto si guarda una seconda volta,
        // dopo la pausa. Se la seconda lettura lo ritrova, non era perduto.
        await pausa(PAUSA_PRIMA_DI_RICONTARE);
        const ancora = await chiediConteggio(tipoFile, base, 0, a.entita);
        // E se la ritrova, da quel momento vale la lettura buona: tenere quella
        // vuota vorrebbe dire non dichiarare l'allarme e poi andare avanti con
        // uno zero in mano, cioe' continuare a svuotare un archivio gia' a
        // posto finche' i tentativi non finiscono.
        if (ancora !== 0) rimasti = ancora;
        if (ancora === 0) {
          throw Object.assign(new Error(`Svuotamento dell'archivio ${a.nome}: in archivio non e' rimasta nessuna riga, ma ${formatIntero(dovevanoRestare)} righe di ordini terminati o eseguiti degli anni prima dovevano restare. Lo storico conservato non c'e' piu': serve un caricamento completo, dal primo anno.`), { data: { dati_intatti: false } });
        }
      }
      // LE DUE LETTURE NON DICONO LA STESSA COSA. La svuota ha conservato piu'
      // righe di quante la preparazione ne avesse contate: quel numero (base) e'
      // il metro di TUTTO il resto del caricamento - le righe attese, il confronto
      // ordine per ordine, la riparazione - e andare avanti vorrebbe dire chiamare
      // "righe di troppo" lo storico e mandarci la riparazione, che lo cancella.
      // Si ferma qui, e in archivio non si e' perso niente: basta ricaricare.
      if (a.storico && conservateDallaSvuota !== null && conservateDallaSvuota > base && rimasti === conservateDallaSvuota) {
        throw Object.assign(new Error(`Svuotamento dell'archivio ${a.nome}: ha conservato ${formatIntero(conservateDallaSvuota)} righe di ordini terminati o eseguiti degli anni prima, mentre la verifica del file ne aveva contate ${formatIntero(base)}. Le due letture dell'archivio non tornano: ricarica il file.`), { data: { dati_intatti: false } });
      }
      if (rimasti === base) break;
      // LA RIPRESA NON E' UN RITENTATIVO, MA SOLO SE STA ANDANDO AVANTI DAVVERO.
      // Un'invocazione ha dodici secondi: con migliaia di ordini da togliere la
      // function si ferma prima e dice fin dove e' arrivata, e il giro dopo
      // riprende da li'. Finche' va avanti non consuma i tentativi.
      //
      // MA "cancellati_ordini" NON VUOL DIRE "ORDINI TOLTI": sono gli ID che la
      // function ha PASSATO a deleteMany, e una piattaforma che accetta il
      // filtro senza togliere niente risponde bene lo stesso. Con quel numero
      // come prova il ciclo non finiva mai - la barra scriveva "200 ordini
      // tolti, si continua" all'infinito e l'unica via d'uscita era chiudere la
      // scheda, cioe' proprio il gesto che lascia l'archivio svuotato a meta'.
      // L'unica prova buona e' che le righe rimaste siano SCESE. E comunque le
      // riprese hanno un tetto: ogni giro rilegge l'archivio intero, e il limite
      // di richieste al minuto vale per tutta l'app.
      const avanzato = typeof rimasti === 'number' && (rimastiPrima === null || rimasti < rimastiPrima);
      if (typeof rimasti === 'number') rimastiPrima = rimasti;
      if (risposta && risposta.ripartire && avanzato && riprese < MAX_RIPRESE_SVUOTAMENTO) {
        riprese++;
        avvisa({ fase: `svuotamento dell'archivio ${a.nome}: restano ${formatIntero(rimasti)} righe, si continua`, archivio: a.nome });
        continue;
      }
      if (risposta && risposta.ripartire && riprese >= MAX_RIPRESE_SVUOTAMENTO) {
        throw Object.assign(new Error(`Svuotamento dell'archivio ${a.nome} non finito dopo ${MAX_RIPRESE_SVUOTAMENTO} riprese${rimasti !== null ? `: restano ${formatIntero(rimasti)} record${base ? ` invece delle ${formatIntero(base)} dello storico conservato` : ''}` : ''}. Ricarica il file.`), { data: { dati_intatti: false } });
      }
      if (tentativo >= ATTESE_RITENTATIVO.length) {
        throw Object.assign(new Error(`Svuotamento dell'archivio ${a.nome} incompleto${rimasti !== null ? `: restano ${rimasti} record${base ? ` invece delle ${base} dello storico conservato` : ''}` : ''}. Ricarica il file.`), { data: { dati_intatti: false } });
      }
      avvisa({ fase: `nuovo tentativo di svuotamento dell'archivio ${a.nome}`, archivio: a.nome });
      await pausa(ATTESE_RITENTATIVO[tentativo]);
      tentativo++;
    }

    // === Scrittura a blocchi ===
    const esito = await scriviBlocchi({
      tipoFile, entita: a.entita, righe: righeArchivio, avvisa,
      // Le righe che l'archivio ha GIA': senza questo numero il conteggio con cui
      // si riconosce un blocco ritentato non torna mai - ne' "entrato" ne' "non
      // entrato" - e ogni blocco che perde la risposta resta in sospeso.
      righeGiaInArchivio: base,
      avanzamento: { bloccoIniziale, totaleBlocchi, righeIniziali, totaleRighe, archivio: a.nome },
    });
    bloccoIniziale += esito.totaleBlocchi;
    righeIniziali += righeArchivio.length;
    if (esito.ultimoErrore) ultimoErrore = esito.ultimoErrore;
    blocchiDatiPerEntrati += esito.blocchiDatiPerEntrati;

    // === Verifica dell'archivio: quante righe ha davvero, ordine per ordine ===
    // Il conteggio esatto col dettaglio, confrontato con le righe che il file
    // porta a questo archivio. Il solo totale non basta: un blocco entrato due
    // volte (+200) e uno mai arrivato (-200) si compensano e il totale torna.
    //
    // Non si contano gli id_ordine pretendendone uno per riga: il confronto e'
    // con le righe che quell'ordine ha DAVVERO nel file, perche' lo stesso
    // ordine sta legittimamente in archivio con piu' righe, una per classe o per
    // prodotto (vedi chiaveOrdine in movimenti.js).
    const nelFile = righePerOrdineNelFile(righeArchivio);
    // Quante righe l'archivio deve avere per ciascun ordine: quelle del FILE piu'
    // quelle dello STORICO CONSERVATO. nelFile resta il file e solo il file, e non
    // si mescolano: lo leggono entrateDavvero, nonEntrate e "righe entrate", che
    // dicono quanto del FILE e' entrato e con lo storico dentro si gonfierebbero
    // di migliaia di righe che il file non porta.
    const attesoPerOrdine = new Map(nelFile);
    for (const [id, quante] of conservatiPerOrdine) attesoPerOrdine.set(id, (attesoPerOrdine.get(id) || 0) + quante);

    // Sotto questo numero di righe una lettura sta smentendo cio' che la
    // function ha CONFERMATO di aver scritto. Su una lettura cosi' NON SI
    // COSTRUISCE UN VERDETTO: non si dice "quadra" - il caso peggiore e'
    // proprio l'archivio con le righe doppie che la lettura in ritardo mostra
    // ancora pulito - e non si dice "mancano N righe di questi ordini".
    // Guidare la riparazione invece si puo': la riparazione toglie e riscrive,
    // quindi qualunque cosa dica la lettura l'ordine finisce con le righe del
    // file, e nel caso in cui a mentire sia stata la scrittura (un blocco dato
    // per scritto che non era entrato) quelle righe tornano.
    //
    // La soglia regge anche dopo una riparazione perche' si tiene ORDINE PER
    // ORDINE: la riparazione toglie le righe di certi ordini e solo di quelli,
    // quindi per quegli ordini si riparte da zero e si risale con cio' che la
    // riscrittura conferma. Zero e' sempre un numero sotto cui non si scende.
    const sicurePerOrdine = esito.confermatePerOrdine;
    let righeSicure = esito.righeConfermate;
    const dimenticaOrdini = (ordini) => {
      for (const o of ordini) {
        righeSicure -= sicurePerOrdine.get(o.id_ordine) || 0;
        sicurePerOrdine.set(o.id_ordine, 0);
      }
    };
    const ricordaOrdini = (perOrdine) => {
      for (const [id, quante] of perOrdine || []) {
        righeSicure += quante - (sicurePerOrdine.get(id) || 0);
        sicurePerOrdine.set(id, quante);
      }
    };

    const controlla = async () => {
      avvisa({ fase: `verifica dell'archivio ${a.nome}`, archivio: a.nome });
      const v = await chiediConteggioEsatto(tipoFile, a.entita, { dettaglio: true, avvisa, nome: a.nome });
      if (!v) return { contato: false, righe: null, conteggi: null, inPiu: [], mancanti: [], quadra: false };
      const conteggi = v.conteggi || new Map();
      const { inPiu, mancanti } = ordiniCheNonTornano(attesoPerOrdine, conteggi);
      // La soglia misura TUTTO cio' che si sa essere in archivio: la base, che la
      // preparazione ha contato e lo svuotamento non ha toccato, piu' le
      // scritture confermate. Senza la base la soglia restava bassa di migliaia
      // di righe e una lettura in ritardo che mostrasse mezzo archivio passava
      // per buona, cioe' il controllo non scattava nel caso per cui e' scritto.
      const incoerente = v.righe < base + righeSicure;
      return {
        contato: true, righe: v.righe, conteggi, inPiu, mancanti, incoerente,
        quadra: !incoerente && v.righe === righeArchivio.length + base && !inPiu.length && !mancanti.length,
      };
    };

    // Due conteggi dicono la stessa cosa quando danno lo stesso totale e gli
    // stessi ordini fuori posto: e' il metro con cui si capisce se l'archivio
    // ha finito di assestarsi.
    const elencoOrdini = (elenco) => elenco.map(o => `${o.id_ordine}:${o.volte}/${o.nel_file}`).join('|');
    const stessaFotografia = (x, y) => x.contato && y.contato && x.righe === y.righe
      && elencoOrdini(x.inPiu) === elencoOrdini(y.inPiu)
      && elencoOrdini(x.mancanti) === elencoOrdini(y.mancanti);

    // Il conteggio DOPO che si e' toccato l'archivio. Non puo' essere una
    // lettura sola presa subito dopo aver scritto: subito dopo una scrittura o
    // una cancellazione grossa la lettura puo' rispondere col numero di prima,
    // e su quel numero si cancellava e si riscriveva sopra. Bastava che
    // restasse indietro per tre conteggi perche' il caricamento si chiudesse
    // "successo" con cinquanta ordini contati doppi dentro.
    //
    // Si riconta finche' due letture di fila non dicono la stessa cosa. Se non
    // si ferma su un numero l'archivio si dichiara NON CONTATO: il caricamento
    // resta parziale e i moduli non si ricalcolano. E' l'unica risposta onesta,
    // e costa un conteggio in piu' solo sugli archivi che sono stati riparati.
    const contaStabile = async () => {
      await pausa(PAUSA_PRIMA_DI_RICONTARE);
      let ultima = await controlla();
      for (let lettura = 1; lettura < LETTURE_PER_ESSERE_SICURI; lettura++) {
        if (!ultima.contato) return ultima;
        await pausa(PAUSA_PRIMA_DI_RICONTARE);
        const nuova = await controlla();
        if (stessaFotografia(ultima, nuova)) return nuova;
        ultima = nuova;
      }
      avvisa({ fase: `l'archivio ${a.nome} non si ferma su un numero`, archivio: a.nome });
      // Gli elenchi dell'ultima lettura NON si tengono: verrebbero da una
      // lettura appena dichiarata inaffidabile. Tenendoli, a video usciva
      // "Primarie RETE: 0 righe invece delle 450 del file, per esempio
      // ORD-00401 (0 righe invece di 1)" su un archivio che ne aveva 470, e
      // nella riga dopo "non si e' riusciti a contare": tre frasi che si
      // smentiscono a vicenda. Di un archivio non contato non si elenca niente.
      return { contato: false, righe: null, conteggi: null, inPiu: [], mancanti: [], quadra: false, instabile: true };
    };

    // GLI ORDINI CHE LE SCRITTURE CONFERMATE NON COPRONO.
    //
    // E' il cuore della regola nuova. Di questi ordini il gestionale NON SA
    // quante righe abbiano in archivio: il blocco che le portava non e' stato
    // confermato, quindi possono essercene zero, quelle giuste, o il doppio se
    // la piattaforma ha ripetuto la richiesta per conto suo. Nessuna lettura
    // scioglie il dubbio - una lettura in ritardo dice proprio "sono giuste",
    // ed e' cosi' che si chiudeva "successo" con duecento ordini dai pesi
    // doppi, per quante volte la si rileggesse.
    //
    // Si sciolgono in un modo solo: passandoli alla riparazione, che toglie le
    // loro righe e riscrive quelle del file. Se tutte e due le operazioni sono
    // confermate, quell'ordine ha le righe del file PER COSTRUZIONE. Finche'
    // restano, il caricamento non si puo' dichiarare riuscito - si dice che non
    // si e' potuto verificare - per quanto bene risponda il conteggio.
    const ordiniDubbi = new Set(esito.ordiniDubbi);
    // Una lettura in piu' non decide niente, ma serve ancora a non dare una
    // brutta notizia sbagliata: su un caricamento pulito resta una lettura per
    // archivio, come prima.
    const scritturaDubbia = esito.blocchiDatiPerEntrati > 0 || esito.righeIncerte > 0;
    let verifica = scritturaDubbia ? await contaStabile() : await controlla();
    let tolte = 0;
    let toccato = false;
    let cancellato = false;
    let cancellazioneIncerta = false;
    // Quante righe DEL FILE la riparazione ha tolto da questo archivio, ordine
    // per ordine: serve a dire il numero, invece di attribuire al gestionale
    // anche le righe che non erano mai entrate. Ordine per ordine, perche' con
    // piu' giri sugli stessi ordini la somma le contava due volte.
    const tolteGestionalePerOrdine = new Map();
    let riparazioneNonFatta = null;
    // Le righe rimesse a posto e quelle tolte si tengono ORDINE PER ORDINE, non
    // come somma dei giri: la riparazione fa due giri e sugli stessi ordini
    // riscrive le stesse righe, quindi sommando i totali lo storico diceva "100
    // righe rimesse a posto" su cinquanta ordini toccati, e quel numero resta li'
    // per sempre. Ogni giro SOSTITUISCE il conto di quell'ordine: l'ultimo giro
    // e' quello che dice come e' rimasto l'archivio.
    const riscrittePerOrdine = new Map();
    const tolteInTutto = new Map();

    // (a) Prima di gridare: subito dopo una scrittura grossa l'archivio puo'
    // rispondere con un numero ancora indietro, e sarebbe un falso allarme. Una
    // lettura che nega righe gia' confermate e' proprio quella: si riprova a
    // leggere, perche' una lettura in ritardo di solito si rimette in pari.
    //
    // Se il verdetto e' gia' venuto da contaStabile questo giro non serve: li'
    // si e' gia' aspettato e ricontato finche' due letture non si sono messe
    // d'accordo. Rileggere ancora vorrebbe dire solo dare un'altra occasione
    // alla lettura di non rispondere, e buttare via quella buona.
    for (let lettura = 1; !scritturaDubbia && lettura < LETTURE_PER_ESSERE_SICURI && !verifica.quadra; lettura++) {
      avvisa({ fase: `nuovo controllo dell'archivio ${a.nome}`, archivio: a.nome });
      await pausa(PAUSA_PRIMA_DI_RICONTARE);
      const nuova = await controlla();
      const eraIncoerente = verifica.incoerente === true;
      verifica = nuova;
      // Una lettura sola in piu' basta quando l'archivio ha risposto: e' il
      // falso allarme di sempre. Si insiste solo finche' la lettura continua a
      // smentire le scritture confermate.
      if (!eraIncoerente || !nuova.incoerente) break;
    }

    // La riparazione: per ogni ordine che non torna si tolgono le sue righe e
    // si riscrivono quelle del file, in un passo solo. Dopo ogni giro che ha
    // toccato i dati si riconta: il verdetto non si costruisce mai sui numeri
    // di prima.
    //
    // Si ripara anche sulla lettura che non sta in piedi, e non e' una
    // contraddizione: togliere e riscrivere porta l'ordine alle righe del file
    // qualunque cosa la lettura dica, quindi peggio non lo si puo' fare, e se a
    // mentire e' stata la scrittura (un blocco dato per scritto che non era
    // entrato, come la notte delle 57 righe) quelle righe tornano. Cio' che su
    // quella lettura non si fa e' il VERDETTO, qui sotto.
    // IL FRENO: QUANDO TOGLIERE NON STA FUNZIONANDO.
    //
    // Serve a un caso solo: una piattaforma che ACCETTA il filtro a lotti e non
    // toglie niente. Li' ogni giro riscriverebbe sopra righe ancora presenti e
    // ne aggiungerebbe altre duecento, all'infinito.
    //
    // La domanda giusta NON e' "l'archivio ha piu' righe di troppo di prima".
    // Quella si risponde "si'" anche quando la riscrittura e' andata a
    // destinazione due volte, e in quel caso il giro dopo - che COMINCIA
    // togliendo - avrebbe chiuso il caso: fermandosi li' si buttava via proprio
    // il giro che serviva. La domanda giusta e' LA CANCELLAZIONE HA TOLTO LE
    // RIGHE CHE DICEVA DI TOGLIERE: se ha dichiarato di togliere delle righe e
    // dopo il giro quegli ordini ne hanno ancora piu' di quante il file gliene
    // porta piu' quelle che non aveva toccato, quelle righe non sono uscite, e
    // continuare non puo' che moltiplicarle.
    //
    // Quando la cancellazione non aveva NIENTE da togliere (gli ordini in
    // archivio erano gia' vuoti: le righe mai entrate) non c'e' niente da
    // controllare, e il giro dopo la prova per davvero.
    //
    // E' l'unico modo onesto di usare una lettura: per ACCORGERSI che qualcosa
    // non torna, non per dichiarare un esito - e la cosa che si fa dopo
    // essersene accorti (fermarsi) non puo' rovinare niente.
    const righeDegliOrdini = (v, elenco) => elenco.reduce((s2, o) => s2 + ((v.conteggi && v.conteggi.get(o.id_ordine)) || 0), 0);
    // La riparazione gira anche quando la lettura dice che tutto torna, se
    // restano ordini che le scritture confermate non coprono: e' l'unico modo
    // di chiudere quel dubbio, e non puo' peggiorare niente.
    //
    // E proprio per questo va tenuto da parte com'era messo l'archivio PRIMA
    // che la riparazione lo toccasse. Quando al primo controllo tornava gia'
    // tutto, la riparazione non e' partita perche' mancavano delle righe: e'
    // partita perche' di quelle righe non si aveva la conferma. Dire dopo
    // "mancavano o avanzavano delle righe" sarebbe falso, e resterebbe scritto
    // nello storico per sempre: chi lo rilegge domani va a cercare un guasto
    // che non c'e' mai stato.
    const tornavaPrimaDellaRiparazione = !!verifica.quadra;
    for (let giro = 0; giro < GIRI_RIPARAZIONE && verifica.contato && (!verifica.quadra || ordiniDubbi.size); giro++) {
      // SI TOCCANO SOLO GLI ORDINI PRESENTI NEL FILE. Un ordine che il file non
      // porta non si tocca mai, perche' la riparazione si regge sul poter
      // RISCRIVERE cio' che toglie, e li' non c'e' niente da riscrivere:
      // toglierlo vorrebbe dire perderlo per sempre. E' il caso dello storico
      // conservato - in archivio c'e', nel file no, e restare e' esattamente cio'
      // che si vuole - e senza questo freno la riparazione lo cancellava e lo
      // raccontava come merito ("righe di troppo tolte") nella finestra e nello
      // storico dei caricamenti.
      //
      // E SE UN ORDINE CONSERVATO NON TORNA NON SI RIPARA: SI DICE. Se avesse
      // meno righe di quante la preparazione ne aveva contate, il file non le
      // contiene e nessuno puo' rimetterle: l'unico rimedio e' ricaricare il file
      // completo dal primo anno, e si scrive (storicoRigheInMeno, qui sotto).
      const delFile = (id) => (nelFile.get(id) || 0) > 0;
      const daRifare = [...verifica.inPiu, ...verifica.mancanti].filter(o => delFile(o.id_ordine));
      const visti = new Set(daRifare.map(o => o.id_ordine));
      for (const id of ordiniDubbi) {
        if (visti.has(id) || !delFile(id)) continue;
        visti.add(id);
        daRifare.push({ id_ordine: id, volte: (verifica.conteggi && verifica.conteggi.get(id)) || 0, nel_file: nelFile.get(id) || 0 });
      }
      if (!daRifare.length) break;
      // Com'erano messi, PRIMA del giro, gli ordini che si stanno per rimettere
      // a posto: quante righe avevano in archivio e quante ne porta loro il
      // file. Servono al freno, qui sotto.
      const righePrimaDegliOrdini = righeDegliOrdini(verifica, daRifare);
      const nelFileDegliOrdini = daRifare.reduce((s2, o) => s2 + (nelFile.get(o.id_ordine) || 0), 0);
      if (daRifare.length > MAX_ORDINI_RIPARAZIONE) {
        riparazioneNonFatta = `${formatIntero(daRifare.length)} ordini da rimettere a posto sono troppi: conviene ricaricare il file`;
        break;
      }

      // Di questi ordini si stanno per togliere le righe: qualunque cosa fosse
      // confermata per loro non vale piu', e si riparte da zero. Poi si risale
      // con quello che la riscrittura conferma. Se la cancellazione non parte
      // affatto si rimette com'era: quelle righe sono ancora li' dove erano, e
      // azzerarle abbassava la colonna "Righe entrate" dello storico senza che
      // fosse successo niente.
      const comErano = new Map(daRifare.map(o => [o.id_ordine, sicurePerOrdine.get(o.id_ordine) || 0]));
      dimenticaOrdini(daRifare);
      const rif = await riparaArchivio({
        tipoFile, entita: a.entita, nome: a.nome,
        righeArchivio, ordini: daRifare, righeGiaInArchivio: verifica.righe, avvisa,
      });
      if (!rif.toccato && !rif.cancellato && !rif.incerta) ricordaOrdini(comErano);
      ricordaOrdini(rif.confermatePerOrdine);
      // Le righe di QUESTO giro sostituiscono quelle dei giri di prima sugli
      // stessi ordini: la riparazione toglie e riscrive, quindi vale l'ultimo
      // giro, non la somma.
      for (const [id, quante] of rif.riscrittePerOrdine || []) riscrittePerOrdine.set(id, quante);
      for (const [id, quante] of rif.toltePerOrdine || []) tolteInTutto.set(id, quante);
      // Le righe che la riparazione non ha riscritto non si contano piu' qui.
      // Sommarle fra un giro e l'altro le contava due volte - sono sempre le
      // stesse righe riprovate - e tenere solo l'ultimo giro dimenticava quello
      // che i giri di prima sapevano, appena un giro si fermava senza scrivere.
      // Il conto giusto lo fa l'archivio, ordine per ordine, piu' in basso
      // (nonEntrate): su un archivio contato si sa che cosa c'e', e su uno non
      // contato e' in dubbio TUTTO cio' che le scritture confermate non coprono.
      for (const [id, quante] of rif.tolteDalGestionalePerOrdine || []) {
        tolteGestionalePerOrdine.set(id, Math.max(tolteGestionalePerOrdine.get(id) || 0, quante));
      }
      // Gli ordini che la riparazione ha tolto e riscritto, tutte e due le cose
      // confermate dalla piattaforma: quelli adesso hanno le righe del file per
      // costruzione, e il dubbio su di loro e' chiuso senza chiederlo a nessuna
      // lettura.
      for (const id of rif.ordiniCerti || []) ordiniDubbi.delete(id);
      // E TUTTI GLI ALTRI CHE HA TOCCATO RESTANO IN DUBBIO, ANCHE QUELLI CHE
      // ERANO CERTI PRIMA.
      //
      // E' la stessa regola della prima scrittura, applicata al momento in cui
      // le righe sono FUORI dall'archivio: la riparazione ha appena cancellato
      // quegli ordini: se non le ha viste riscrivere confermate, di quelle
      // righe non si sa piu' niente - zero, quelle giuste, o il doppio - ed e'
      // un dubbio che nessuna lettura scioglie, perche' una lettura in ritardo
      // mostra ancora l'archivio di prima della cancellazione. Senza questa
      // riga un ordine che la prima scrittura aveva confermato usciva
      // dall'elenco dei dubbi appena la riparazione lo toccava, e a decidere
      // tornava una lettura sola: il caricamento chiudeva "successo" con
      // l'archivio mutilato e i ricalcoli dei moduli partivano sopra.
      //
      // Se invece la riparazione non ha toccato niente - la cancellazione non
      // e' nemmeno partita - le righe sono ancora dov'erano e cio' che era
      // certo resta certo, come gia' fa ricordaOrdini(comErano) qui sopra.
      if (rif.toccato || rif.cancellato || rif.incerta) {
        const certi = rif.ordiniCerti || new Set();
        for (const o of daRifare) if (!certi.has(o.id_ordine)) ordiniDubbi.add(o.id_ordine);
      }
      if (rif.cancellato) cancellato = true;
      if (rif.incerta) cancellazioneIncerta = true;
      // Non si accumula: se il giro dopo ce la fa, non deve restare scritto che
      // non ci ha provato.
      riparazioneNonFatta = rif.non_fatta || null;
      // Si riconta SEMPRE quando l'archivio e' stato toccato - e una richiesta
      // di cancellazione partita conta come toccato, anche se la risposta si e'
      // persa. Le righe tolte non tornano indietro, e raccontare i numeri di
      // prima vuol dire dire il falso.
      if (rif.toccato) { toccato = true; verifica = await contaStabile(); }
      // TOGLIERE NON STA FUNZIONANDO: la cancellazione ha dichiarato di
      // togliere delle righe e dopo il giro quegli ordini ne hanno ancora piu'
      // di quante potrebbero averne se fossero uscite davvero (quelle che non
      // erano state dichiarate, piu' quelle che il file porta e la riscrittura
      // ha rimesso). Insistere le moltiplicherebbe a ogni giro. Ci si ferma qui
      // e si dice: il caricamento resta parziale, i ricalcoli non partono e si
      // ricarica il file, che svuota e riscrive.
      const restavano = Math.max(0, righePrimaDegliOrdini - (rif.tolteDavvero || 0));
      if (verifica.contato && (rif.tolteDavvero || 0) > 0
        && righeDegliOrdini(verifica, daRifare) > restavano + nelFileDegliOrdini) {
        riparazioneNonFatta = `il gestionale ha chiesto di togliere ${formatIntero(rif.tolteDavvero)} righe e dopo erano ancora li': la cancellazione non le sta togliendo, si e' fermato per non farne entrare altre, ricarica lo stesso file`;
        // E allora quel buco NON lo ha fatto il gestionale: si e' appena visto
        // che le righe di questi ordini non sono uscite. Tenendo il conto si
        // scriveva "ha tolto 200 righe e non e' riuscito a riscriverle" proprio
        // dove non ne aveva tolta nessuna e semmai ne aveva aggiunte.
        for (const o of daRifare) tolteGestionalePerOrdine.delete(o.id_ordine);
        break;
      }
      // Una riparazione che si e' dichiarata NON FATTA non si ritenta: il giro
      // dopo rifarebbe la stessa richiesta e si sentirebbe rispondere lo stesso.
      // L'eccezione e' la porta chiusa per il limite di richieste, che si riapre
      // da sola: li' si aspetta e si riprova una volta, altrimenti il rimedio
      // automatico non scatta proprio nel caso in cui basterebbe aspettare.
      if (rif.non_fatta && rif.ritentabile) {
        // Trenta secondi di attesa senza una parola: la barra restava ferma e
        // chi guardava non sapeva se il gestionale stesse facendo qualcosa.
        avvisa({ fase: `il limite di richieste della piattaforma ha respinto la riparazione di ${a.nome}: si aspetta un minuto e si riprova`, archivio: a.nome });
        await pausa(PAUSA_DOPO_LIMITE);
        continue;
      }
      if (rif.non_fatta || (!rif.toccato && !rif.riscritte)) break;
    }

    // NESSUN VERDETTO SU UNA LETTURA SOLA, NEMMENO QUANDO NON C'E' NIENTE DA
    // RIPARARE. Finche' la riparazione girava su tutto, un archivio che non
    // tornava veniva sempre ricontato dopo che lei lo aveva toccato. Adesso ci
    // sono casi in cui non c'e' niente da riparare - gli ordini di troppo non
    // stanno nel file, quindi non si toccano - e il verdetto nascerebbe da una
    // lettura sola, presa poco dopo la scrittura: e' proprio il numero che puo'
    // essere ancora indietro, o ancora avanti. Si riconta finche' due letture di
    // fila non dicono la stessa cosa, e se non si fermano l'archivio si dichiara
    // non contato invece di elencare righe di troppo prese da un numero che sta
    // ancora cambiando.
    if (!scritturaDubbia && !toccato && verifica.contato && !verifica.quadra && !verifica.incoerente) {
      verifica = await contaStabile();
    }

    // Se alla fine la lettura continua a smentire le scritture confermate, il
    // verdetto NON si costruisce su di lei: l'archivio si dichiara non contato,
    // il caricamento resta parziale e i ricalcoli non partono. Gli elenchi di
    // quella lettura si buttano: "mancano 50 righe su questi ordini" detto
    // sopra una lettura inaffidabile e' una frase che manda a cercare un guasto
    // che puo' non esserci, o che nasconde quello vero (le righe doppie che la
    // lettura in ritardo non mostra ancora).
    // E SE RESTANO ORDINI CHE LE SCRITTURE CONFERMATE NON COPRONO, il verdetto
    // non c'e'. La lettura puo' anche dire che tutto torna: di quegli ordini il
    // gestionale non sa se abbiano zero righe, quelle giuste o il doppio, e una
    // lettura in ritardo dice esattamente quello che si vorrebbe sentire. Non
    // si dichiara "successo" e non si elenca niente: si dice che NON SI E'
    // POTUTO VERIFICARE, il caricamento resta parziale e i ricalcoli non
    // partono. Ricaricare lo stesso file rimette tutto a posto.
    const ordiniSenzaConferma = ordiniDubbi.size;
    if (ordiniSenzaConferma && verifica.quadra) {
      verifica = { contato: false, righe: null, conteggi: null, inPiu: [], mancanti: [], quadra: false, nonConfermato: true };
    }
    if (verifica.incoerente) {
      verifica = { contato: false, righe: null, conteggi: null, inPiu: [], mancanti: [], quadra: false, incoerente: true };
    }

    // LO STORICO CONSERVATO CHE NON TORNA. Un ordine conservato che adesso ha
    // meno righe di quante la preparazione ne aveva contate ha perso delle righe
    // che nessuno puo' rimettere, perche' il file non le contiene. Non e' un
    // caso da riparare: e' un caso da dire, e il rimedio e' uno solo.
    //
    // SI GUARDA QUI, DOPO LE DUE SOSTITUZIONI QUI SOPRA, cioe' sull'ultima
    // lettura BUONA e non sull'ultima lettura e basta. Una lettura incoerente e'
    // per definizione una lettura che dice meno righe di quante ne sono state
    // confermate: e' proprio quella che fa sembrare corti gli ordini conservati.
    // Contandola, la finestra apriva in rosso con "lo storico conservato non
    // torna, l'unico rimedio e' ricaricare il file completo dal primo anno"
    // accanto a "la lettura non e' affidabile e su un conteggio cosi' non si
    // dichiara niente": due frasi dalla stessa lettura, e una era stata appena
    // buttata. Si mandava a esportare tutto lo storico dal portale per un guasto
    // che non esisteva.
    //
    // E una perdita vera non passa liscia: lo stesso ordine compare anche fra i
    // mancanti, quindi l'archivio non quadra, il caricamento resta parziale, i
    // ricalcoli non partono e si dice di ricaricare lo stesso file. Se la riga
    // si era persa davvero quel giro non la rimette, e il caricamento dopo non la
    // vedra' nemmeno mancare, perche' la preparazione riconta lo storico da
    // quello che c'e': ma fra le due frasi possibili si dice quella che non manda
    // a fare la cosa sbagliata, perche' su una lettura appena dichiarata
    // inaffidabile non si afferma una perdita di dati.
    let storicoPersoQui = 0;
    if (verifica.contato && verifica.conteggi) {
      for (const [id, quante] of conservatiPerOrdine) {
        const adesso = verifica.conteggi.get(id) || 0;
        if (adesso < quante) { storicoPersoQui += quante - adesso; storicoRigheInMeno += quante - adesso; storicoOrdiniInMeno++; }
      }
    }

    // Le righe distinte rimesse a posto, contate una volta sola anche se la
    // riparazione ha fatto due giri sugli stessi ordini. Le righe tolte per
    // intero non sono state "rimesse a posto" da nessuna parte e restano un
    // numero a parte, come gia' nelle frasi.
    const riscritte = [...riscrittePerOrdine.values()].reduce((s, x) => s + x, 0);
    tolte = [...tolteInTutto.values()].reduce((s, x) => s + x, 0);
    const riparate = riscritte + tolte;
    const righeInArchivio = verifica.righe;
    // Un blocco lasciato in sospeso (non si sapeva se fosse entrato, e non si e'
    // riscritto) lo scioglie questa verifica: se l'archivio ha esattamente le
    // righe attese, ordine per ordine, quelle righe sono entrate. Vale anche per
    // un blocco dato per non scritto: l'archivio lo svuota il caricamento e ci
    // scrive solo lui, quindi righe giuste vuol dire che l'ultimo tentativo era
    // passato e si e' persa solo la risposta. Dire "200 righe non scritte" su un
    // archivio completo lo lascerebbe "parziale", cioe' inaffidabile per tutti i
    // moduli.
    const quadra = verifica.quadra;

    // Gli ordini distinti che l'archivio contiene adesso: servono a sapere se al
    // prossimo caricamento verra' chiesta una conferma (il controllo scatta
    // quando in archivio restano meno ordini di quanti ce n'erano). Se anche un
    // solo archivio non si e' riusciti a contarlo, non si sa: e allora si dice
    // "potrebbe", non "verra'".
    if (verifica.contato && verifica.conteggi) for (const o of verifica.conteggi.keys()) ordiniInArchivio.add(o);
    else ordiniContati = false;

    // Quante righe DEL FILE sono davvero in archivio adesso: per ogni ordine,
    // quante ne ha, non piu' di quante ne porta il file. E' il numero onesto
    // quando l'archivio non quadra: "450 righe del file entrate in archivio" su
    // un archivio che ne ha 250 - perche' la riparazione le ha tolte e non e'
    // riuscita a rimetterle - e' falso, e resta scritto nello storico.
    //
    // Se l'archivio non si e' riusciti a contarlo si conta quello che si sa per
    // certo: le righe che la function ha CONFERMATO di aver scritto, ordine per
    // ordine e mai piu' di quante ne porta il file. Prima si teneva il numero
    // delle sole scritture iniziali, che DIMENTICA le righe rimesse a posto
    // dalla riparazione: su un archivio a posto da 450 righe lo storico diceva
    // 280, e quella colonna resta bassa per sempre.
    let entrateDavvero = null;
    if (verifica.contato && verifica.conteggi) {
      entrateDavvero = 0;
      for (const [ordine, attese] of nelFile) entrateDavvero += Math.min(verifica.conteggi.get(ordine) || 0, attese);
    } else {
      entrateDavvero = 0;
      for (const [ordine, attese] of nelFile) entrateDavvero += Math.min(sicurePerOrdine.get(ordine) || 0, attese);
    }

    // LE RIGHE DEL FILE CHE NON SONO IN ARCHIVIO ADESSO. Non la somma dei
    // tentativi caduti: la riparazione riprova LE STESSE righe della prima
    // scrittura, e sommando le due si leggeva "100 righe non scritte" dove a
    // mancarne erano cinquanta. Nella stessa riga di registro finivano "430
    // righe entrate su 480" e "100 non scritte": 430 + 100 = 530, un numero che
    // non esiste, e chi controlla i conti lo trova li' per sempre.
    //
    // Quando l'archivio si e' contato il dubbio non c'e' piu': le righe rimaste
    // in sospeso o ci sono, e allora non mancano, o non ci sono, e allora
    // mancano - non "non si sa". Il dubbio resta solo dove il conteggio non ha
    // risposto.
    const nonEntrate = Math.max(0, righeArchivio.length - entrateDavvero);
    // E SU UN ARCHIVIO CHE NON SI E' CONTATO NON SI AFFERMA NIENTE.
    //
    // "Non scritte" e' un'affermazione, "non si sa" e' un dubbio, e quando il
    // conteggio non ha risposto - o ha risposto una cosa che non sta in piedi,
    // o restano ordini che le scritture confermate non coprono - il gestionale
    // sa SOLO che cosa la piattaforma gli ha confermato di scrivere. Tutto il
    // resto e' in dubbio, comprese le righe che un conteggio aveva dato per
    // entrate e quelle che la riparazione ha tolto senza riuscire a
    // riscriverle: possono esserci eccome. Scrivendole come "non scritte" lo
    // storico affermava «200 righe non scritte» di righe che in archivio
    // c'erano tutte, e nella stessa riga aggiungeva «non si sa se le righe ci
    // siano»: due frasi che si smentiscono, e resta la prima.
    //
    // Quando invece l'archivio si e' contato il dubbio non c'e' piu': le righe
    // o ci sono, e allora non mancano, o non ci sono, e allora mancano.
    const incerteQui = verifica.contato ? 0 : nonEntrate;
    const falliteQui = verifica.contato ? nonEntrate : 0;

    // UN ORDINE CONSERVATO CHE HA PERSO DELLE RIGHE NON E' UN "ORDINE MANCANTE".
    // Il confronto ordine per ordine lo trova in meno (l'atteso e' file piu'
    // storico) e finiva fra i mancanti, dove la frase dice "ricarica lo stesso
    // file, senza rifiltrarlo": per quelle righe non serve a niente, perche' il
    // file non le contiene - ed e' lo stesso motivo per cui la riparazione non
    // le tocca. La stessa perdita usciva due volte con due rimedi diversi, e uno
    // dei due mandava a fare un giro inutile. Qui esce una volta sola, nel
    // riquadro rosso dello storico che non torna, con l'unico rimedio vero.
    const mancantiDelFile = verifica.mancanti.filter(o => (nelFile.get(o.id_ordine) || 0) > 0);

    archivi[a.entita] = {
      nome: a.nome,
      // Quante righe l'archivio deve avere: quelle del file PIU' lo storico
      // conservato. E' la misura con cui si dice se l'archivio e' allineato, e
      // col solo file nessun archivio con storico sarebbe tornato mai: esito
      // sempre parziale e i ricalcoli dei moduli fermi a ogni caricamento, cioe'
      // la seconda regola assoluta spenta da sola.
      attese: righeArchivio.length + base,
      // E quante di quelle righe erano gia' li': serve a chi legge il registro
      // fra sei mesi, che altrimenti trova un archivio piu' grande del file e non
      // capisce perche'.
      conservati: base,
      // E quante di quelle righe sono di ordini in stato "eseguito": vanno
      // segnalate, perche' l'avviso sugli eseguiti guarda il file e queste nel
      // file non ci sono.
      conservati_eseguiti: eseguitiConservatiDi(a.entita).righe,
      // Se questo archivio, alla fine, ha esattamente le righe che deve avere -
      // quelle del file PIU' lo storico conservato: su un archivio che torna non
      // si raccontano piu' i guai avuti per strada.
      quadra,
      scritte: quadra ? righeArchivio.length : entrateDavvero,
      // Le righe che non sono in archivio adesso, quelle della riparazione
      // comprese: si guarda come e' rimasto l'archivio, non quanti tentativi
      // sono caduti. Prima si sommavano le fallite della prima scrittura e
      // quelle della riparazione, che sono LE STESSE righe riprovate.
      fallite: quadra ? 0 : falliteQui,
      // Le righe rimaste in sospeso contano come le altre: prima si buttavano
      // via, e il dubbio non arrivava a chi legge. Mai piu' di quante ne
      // manchino davvero: una riga in sospeso che poi e' entrata non manca.
      incerte: quadra ? 0 : incerteQui,
      archivio: righeInArchivio,
      ordini_in_piu: quadra ? [] : verifica.inPiu,
      ordini_mancanti: quadra ? [] : mancantiDelFile,
      ordini_sbagliati: quadra ? 0 : verifica.inPiu.length + mancantiDelFile.length,
      // Le righe dello STORICO conservato che non ci sono piu' in questo
      // archivio. Stanno in un campo loro perche' hanno un rimedio loro: si
      // tolgono dal conto di "archivio non allineato col file" - col file
      // quell'archivio torna - e il registro le scrive con la frase giusta.
      storico_perso: storicoPersoQui,
      riparate,
      riscritte,
      tolte,
      // Se la riparazione ha rimesso a posto QUESTO archivio. Prima si guardava
      // l'esito di tutto il caricamento, e di un archivio riparato davvero si
      // leggeva "non torna ancora con il file" solo perche' un altro archivio
      // non era riuscito.
      riparato: riparate > 0 && quadra,
      // L'archivio e' stato toccato dalla riparazione: chi legge deve sapere
      // che i numeri di prima non valgono piu'.
      toccato,
      // La riparazione ha tolto delle righe davvero: e' un'altra cosa rispetto
      // a "ci ha provato e non ha toccato niente", e si dice in modo diverso.
      cancellato,
      // E QUANTE ne ha tolte davvero. Fra gli ordini da rimettere a posto ci
      // sono quasi sempre quelli con zero righe in archivio - le righe mai
      // entrate - e la frase "quel buco lo ha fatto il gestionale" se le
      // prendeva tutte: una riga tolta davvero su cinquantuno bastava.
      tolte_dal_gestionale: [...tolteGestionalePerOrdine.values()].reduce((s2, x) => s2 + x, 0),
      // Una cancellazione e' partita e non si sa come sia finita: non si puo'
      // dire "ho tolto", ma nemmeno "non ho toccato niente". Si dice cosi'.
      cancellazione_incerta: cancellazioneIncerta,
      // Il conteggio non si e' fermato su un numero: non e' un archivio a posto
      // e non e' nemmeno un archivio di cui si sappia qualcosa.
      instabile: verifica.instabile === true,
      // Restano ordini che le scritture confermate non coprono: non si sa se le
      // loro righe siano entrate una volta sola, e la lettura non lo puo' dire.
      non_confermato: verifica.nonConfermato === true,
      ordini_non_confermati: ordiniSenzaConferma,
      // Al primo controllo questo archivio tornava gia': se la riparazione e'
      // partita lo stesso, e' partita per sciogliere un dubbio, non perche'
      // mancasse qualcosa. Serve a raccontarla per quello che e'.
      riparato_solo_per_dubbio: tornavaPrimaDellaRiparazione,
      // La lettura nega righe che la function ha confermato di aver scritto:
      // non e' un archivio a cui mancano righe, e' una lettura da buttare.
      lettura_incoerente: verifica.incoerente === true,
      riparazione_non_fatta: riparazioneNonFatta,
    };
  }

  const durata = Math.round((Date.now() - inizio) / 1000);
  const fallite = Object.values(archivi).reduce((s, x) => s + x.fallite, 0);
  const incerte = Object.values(archivi).reduce((s, x) => s + x.incerte, 0);
  const riparate = Object.values(archivi).reduce((s, x) => s + x.riparate, 0);
  const nonVerificati = ARCHIVI_PRIMARIE.filter(a => typeof archivi[a.entita].archivio !== 'number');
  // "NON ALLINEATO" E' UNA FRASE SUL FILE, e il suo rimedio e' ricaricare lo
  // stesso file. Le righe dello storico conservato che non ci sono piu' non le
  // rimette quel giro - il file non le contiene - quindi si tolgono dal conto:
  // con il file quell'archivio torna. La perdita si dice una volta sola, nel
  // riquadro rosso dello storico che non torna, e resta scritta nel registro con
  // il rimedio vero (l'export completo dal primo anno). Il caricamento resta
  // parziale lo stesso: lo decide il registro, che guarda storico_perso.
  const disallineati = ARCHIVI_PRIMARIE.filter(a => typeof archivi[a.entita].archivio === 'number'
    && archivi[a.entita].archivio !== archivi[a.entita].attese - archivi[a.entita].storico_perso);
  // Piu' righe di quelle del file: qualcosa e' entrato due volte e quei pesi
  // adesso si contano doppi. E' il caso da fermare, non un semplice "manca".
  // Si guardano gli ORDINI, non il totale: un blocco doppio e uno perso si
  // compensano e il totale non direbbe niente.
  const conDoppioni = ARCHIVI_PRIMARIE.filter(a => archivi[a.entita].ordini_in_piu.length > 0);
  const conMancanti = ARCHIVI_PRIMARIE.filter(a => archivi[a.entita].ordini_mancanti.length > 0);
  const conOrdiniSbagliati = ARCHIVI_PRIMARIE.filter(a => archivi[a.entita].ordini_sbagliati > 0);
  const riparati = ARCHIVI_PRIMARIE.filter(a => archivi[a.entita].riparate > 0);
  // Gli archivi il cui conteggio non si e' fermato su un numero e quelli in cui
  // la riparazione non si e' nemmeno provata: due cose che vanno dette per nome,
  // altrimenti chi legge non distingue "ci ho provato e non e' bastato" da "non
  // ci ho nemmeno provato".
  const instabili = ARCHIVI_PRIMARIE.filter(a => archivi[a.entita].instabile);
  // Gli archivi la cui lettura smentisce le scritture confermate: sono non
  // contati anche loro, ma per un motivo diverso e si dicono diversamente.
  const incoerenti = ARCHIVI_PRIMARIE.filter(a => archivi[a.entita].lettura_incoerente);
  // E quelli in cui restano ordini che le scritture confermate non coprono: la
  // lettura diceva che tornava tutto, ma di quegli ordini non si sa niente.
  const nonConfermati = ARCHIVI_PRIMARIE.filter(a => archivi[a.entita].non_confermato);
  // Gli archivi a cui la riparazione ha TOLTO delle righe senza riuscire a
  // rimetterle: va detto, e' la parte di "non sono riuscito, ecco che cosa ho
  // toccato". Un tentativo che non ha cancellato niente non si racconta cosi':
  // sarebbe un'altra bugia, al contrario.
  const soloToccati = ARCHIVI_PRIMARIE
    .filter(a => archivi[a.entita].cancellato && archivi[a.entita].riparate === 0 && !archivi[a.entita].quadra)
    .map(a => ({ nome: a.nome, righe: archivi[a.entita].tolte_dal_gestionale }));
  // E quelli in cui una cancellazione e' partita senza che si sia saputo come
  // sia finita: non si dice "ho tolto le righe", si dice com'e'.
  const cancellazioniIncerte = ARCHIVI_PRIMARIE
    .filter(a => archivi[a.entita].cancellazione_incerta && !archivi[a.entita].quadra)
    .map(a => a.nome);
  const riparazioniNonFatte = ARCHIVI_PRIMARIE
    .filter(a => archivi[a.entita].riparazione_non_fatta)
    .map(a => ({
      nome: a.nome,
      motivo: archivi[a.entita].riparazione_non_fatta,
      // SE L'ARCHIVIO LO HA TOCCATO LO STESSO. Un motivo per cui la riparazione
      // non e' arrivata in fondo non dice se abbia cancellato e riscritto prima
      // di fermarsi: senza questo campo, di un archivio in cui aveva appena
      // tolto e rimesso duecento righe si leggeva "il gestionale non ha provato
      // a rimettere a posto", tre parole prima di "ha chiesto di togliere".
      toccato: archivi[a.entita].toccato || archivi[a.entita].cancellato || archivi[a.entita].cancellazione_incerta,
    }));
  // Tutte le righe del file che sono entrate, assegnati compresi: e' il numero
  // con cui si capisce se e' entrato tutto. Rete e ACI restano contati a parte.
  const scritteTotali = Object.values(archivi).reduce((s, x) => s + x.scritte, 0);
  // Un archivio a cui mancano delle righe dello storico conservato non e' un
  // caricamento riuscito, anche se col file torna: quelle righe non entrano
  // piu' in nessun conto degli anni prima. Non e' fra i "disallineati" perche'
  // il suo rimedio e' un altro, ma l'esito e' parziale lo stesso - come dice il
  // registro, che guarda storico_perso.
  const esito = fallite === 0 && disallineati.length === 0 && nonVerificati.length === 0
    && conOrdiniSbagliati.length === 0 && incerte === 0 && storicoRigheInMeno === 0
    ? 'successo' : (scritteTotali > 0 ? 'parziale' : 'errore');

  // Al registro vanno i numeri, non l'elenco degli ordini in piu': quello puo'
  // essere lungo migliaia di righe e viaggerebbe dentro la richiesta senza che
  // nessuno lo legga. L'elenco resta qui, per la riga sotto la scheda.
  //
  // Righe di troppo e righe mancanti vanno SEPARATE: per chi lavora "righe di
  // troppo" vuol dire pesi contati doppi, cioe' un guasto diverso e piu' grave.
  // Mandando la sola somma il registro diceva sempre "ci sono righe di troppo e
  // righe mancanti insieme", anche la notte delle 57 righe perse, dove di
  // troppo non ce n'era nemmeno una.
  const perIlRegistro = Object.fromEntries(Object.entries(archivi)
    .map(([e, x]) => [e, {
      nome: x.nome, attese: x.attese, scritte: x.scritte, fallite: x.fallite,
      // Quante di quelle righe erano gia' in archivio prima del caricamento: chi
      // rilegge lo storico fra sei mesi trova un archivio piu' grande del file e
      // senza questo numero non ha modo di capire perche'.
      conservati: x.conservati,
      // E quante di quelle righe sono di ordini in stato "eseguito": si
      // conservano come i terminati, ma "terminati" non sarebbe vero e l'utente
      // ha chiesto che vengano segnalati (28/09/2026).
      conservati_eseguiti: x.conservati_eseguiti,
      // Le righe dello storico che non ci sono piu': hanno un rimedio loro
      // (l'export completo dal primo anno), quindi non si scrivono come
      // "archivio non allineato col file".
      storico_perso: x.storico_perso,
      incerte: x.incerte, archivio: x.archivio, ordini_sbagliati: x.ordini_sbagliati,
      ordini_in_piu: x.ordini_in_piu.length, ordini_mancanti: x.ordini_mancanti.length,
      riparate: x.riparate, riscritte: x.riscritte, tolte: x.tolte,
      // Perche' la riparazione e' partita: se al primo controllo l'archivio
      // tornava gia', nello storico non si scrive che mancava qualcosa.
      riparato_solo_per_dubbio: x.riparato_solo_per_dubbio,
      // Un archivio non contato, uno che non si ferma su un numero e uno la cui
      // lettura smentisce le scritture confermate sono tre cose diverse: nel
      // registro si scrivevano tutte come "archivi non contati".
      instabile: x.instabile, lettura_incoerente: x.lettura_incoerente,
      non_confermato: x.non_confermato, ordini_non_confermati: x.ordini_non_confermati,
      // CHE COSA HA TOCCATO LA RIPARAZIONE resta scritto anche nello storico.
      // Prima viveva solo sullo schermo di chi aveva caricato, e alla chiusura
      // della scheda spariva: chi guarda il registro domani leggeva "in archivio
      // mancano delle righe" e andava a cercare un guasto del file.
      quadra: x.quadra, cancellato: x.cancellato, cancellazione_incerta: x.cancellazione_incerta,
      // Quante righe la riparazione ha tolto davvero: nello storico la frase
      // dice il numero, invece di prendersi tutto il buco.
      tolte_dal_gestionale: x.tolte_dal_gestionale,
    }]));
  await invocaConRitentativi({
    azione: 'registra', tipo_file: tipoFile, nome_file: file.name, archivi: perIlRegistro,
    ultimo_errore: ultimoErrore, righe_archivio_prima: prep.righe_archivio_prima,
    // Quanti ordini distinti restano in archivio: e' il numero con cui si sa se
    // al prossimo caricamento verra' chiesta una conferma. Senza, il registro lo
    // prometteva sempre, anche quando il caricamento dopo passava liscio.
    ordini_in_archivio: ordiniContati ? ordiniInArchivio.size : undefined,
    durata_secondi: durata, conferma_forzatura: confermaForzatura || undefined,
    eseguiti: eseguiti ? { rete_ordini: eseguiti.rete.ordini, aci_ordini: eseguiti.aci.ordini } : undefined,
  }, avvisa, 'nuovo tentativo di registrazione');

  // Quante righe ci sono in archivio adesso. Quando un archivio non si e'
  // potuto contare si ripiega su quello che si sa: le righe del file entrate
  // PIU' lo storico conservato, che nessuno ha toccato.
  const archivioTotale = Object.values(archivi).reduce((s, x) => s + (x.archivio ?? (x.scritte + (x.conservati || 0))), 0);
  return {
    tipo_file: tipoFile,
    foglio: letto.nomeFoglio,
    righe_lette: totaleRighe,
    righe_importate: scritteTotali,
    righe_fallite: fallite,
    primarie_rete_importati: archivi.PrimariaRete.scritte,
    primarie_aci_importati: archivi.PrimariaAci.scritte,
    assegnati_importati: archivi.Assegnato.scritte,
    assegnati_aci_importati: archivi.AssegnatoAci.scritte,
    blocchi: totaleBlocchi,
    blocchi_confermati_dal_conteggio: blocchiDatiPerEntrati,
    avviso_date: prep.avviso_date || null,
    // Lo storico conservato: i terminati degli anni prima che il file non
    // contiene e che restano in archivio. Non e' un problema, ma si dice.
    // Fra quelle righe si dicono a parte quelle degli ordini in stato
    // "eseguito": si conservano come i terminati, ma chiamarle "terminate"
    // sarebbe falso, e l'utente ha chiesto che un eseguito sia segnalato e
    // mantenuto (28/09/2026). Chi legge sa che quegli ordini aspettano il
    // Chiudi a portale e che al caricamento dopo avranno lo stato definitivo.
    storico_conservato: prep.anno_inizio && (conservatiDi('PrimariaRete') || conservatiDi('PrimariaAci'))
      ? {
        dal_anno: prep.anno_inizio,
        righe: conservatiDi('PrimariaRete') + conservatiDi('PrimariaAci'),
        eseguiti: {
          ordini: eseguitiConservatiDi('PrimariaRete').ordini + eseguitiConservatiDi('PrimariaAci').ordini,
          righe: eseguitiConservatiDi('PrimariaRete').righe + eseguitiConservatiDi('PrimariaAci').righe,
        },
      }
      : null,
    // Lo storico che NON torna: righe di ordini conservati che adesso non ci
    // sono piu'. Il file non le contiene, quindi non c'e' niente da riparare:
    // l'unico rimedio e' ricaricare il file completo dal primo anno.
    avviso_storico_non_torna: storicoOrdiniInMeno
      ? { righe: storicoRigheInMeno, ordini: storicoOrdiniInMeno }
      : null,
    // Il termine di paragone non e' piu' il solo file: in archivio ci sono anche
    // le righe conservate, e contandole come guasto si leggeva "il file contiene
    // 11.320 righe ma in archivio ne risultano 15.483", cioe' il numero giusto
    // raccontato come un danno. Il campo "storico" sta accanto perche' le frasi
    // possano dire i due numeri separati invece di chiamare "file" anche quello
    // che il file non porta.
    avviso_disallineamento: disallineati.length ? {
      archivio: archivioTotale,
      file: totaleRighe + conservatiDi('PrimariaRete') + conservatiDi('PrimariaAci'),
      storico: conservatiDi('PrimariaRete') + conservatiDi('PrimariaAci'),
    } : null,
    // Un archivio con piu' righe di quelle del file: qualcosa e' entrato due
    // volte. Il caricamento va rifatto con lo stesso file, che svuota e
    // riscrive. Gli ordini elencati sono quelli che in archivio hanno piu' righe
    // di quante ne abbiano nel file: il conto e' fatto sul file vero, non
    // sull'idea sbagliata che un ordine debba avere una riga sola.
    avviso_doppioni: conDoppioni.length ? {
      righe_in_piu: conDoppioni.reduce((s, a) => s + archivi[a.entita].ordini_in_piu.reduce((t, o) => t + (o.volte - o.nel_file), 0), 0),
      ordini: conDoppioni.reduce((s, a) => s + archivi[a.entita].ordini_in_piu.length, 0),
      archivi: conDoppioni.map(a => ({
        nome: a.nome,
        righe: archivi[a.entita].archivio,
        attese: archivi[a.entita].attese,
        conservati: archivi[a.entita].conservati,
        ordini: archivi[a.entita].ordini_in_piu.length,
        esempi: archivi[a.entita].ordini_in_piu.slice(0, 10),
      })),
    } : null,
    // Gli ordini a cui in archivio MANCANO delle righe: il caso di stanotte,
    // 57 righe perse su 11.293. Si dice quante e quali, anche quando la
    // riparazione non e' riuscita a rimetterle.
    avviso_mancanti: conMancanti.length ? {
      righe_mancanti: conMancanti.reduce((s, a) => s + archivi[a.entita].ordini_mancanti.reduce((t, o) => t + (o.nel_file - o.volte), 0), 0),
      ordini: conMancanti.reduce((s, a) => s + archivi[a.entita].ordini_mancanti.length, 0),
      archivi: conMancanti.map(a => ({
        nome: a.nome,
        righe: archivi[a.entita].archivio,
        attese: archivi[a.entita].attese,
        conservati: archivi[a.entita].conservati,
        ordini: archivi[a.entita].ordini_mancanti.length,
        esempi: archivi[a.entita].ordini_mancanti.slice(0, 10),
      })),
    } : null,
    // La riparazione riuscita: si dice, perche' e' successo qualcosa e chi ha
    // caricato deve saperlo, ma il caricamento resta riuscito. "risolto" e' per
    // archivio: uno rimesso a posto davvero non deve leggersi "non torna ancora
    // con il file" solo perche' un altro archivio non e' riuscito. Righe
    // riscritte e righe di troppo tolte si dicono separate: le tolte non sono
    // state riscritte da nessuna parte.
    avviso_riparazione: riparate ? {
      righe: riparate,
      riscritte: riparati.reduce((s, a) => s + archivi[a.entita].riscritte, 0),
      tolte: riparati.reduce((s, a) => s + archivi[a.entita].tolte, 0),
      archivi: riparati.map(a => ({
        nome: a.nome,
        righe: archivi[a.entita].riparate,
        riscritte: archivi[a.entita].riscritte,
        tolte: archivi[a.entita].tolte,
        risolto: archivi[a.entita].riparato,
        // Se alla fine l'archivio si e' potuto contare. Senza, "non torna
        // ancora con il file" sarebbe un'affermazione su un archivio di cui il
        // gestionale ha appena detto di non sapere niente.
        contato: typeof archivi[a.entita].archivio === 'number',
        // Perche' la riparazione e' partita: perche' mancava o avanzava
        // qualcosa, oppure solo perche' di quelle righe non si aveva la
        // conferma. Sono due notizie diverse per chi legge lo storico.
        solo_per_dubbio: archivi[a.entita].riparato_solo_per_dubbio === true,
      })),
      risolto: riparati.every(a => archivi[a.entita].riparato),
    } : null,
    // La riparazione che non si e' nemmeno provata, e perche'. Senza questo,
    // chi legge non distingue "ci ha provato e non e' bastato" da "non ci ha
    // nemmeno provato": sono due cose diverse e si rimediano in modo diverso.
    riparazione_non_fatta: riparazioniNonFatte.length ? riparazioniNonFatte : null,
    // La riparazione ha toccato l'archivio senza rimettere a posto niente: ha
    // tolto le righe sbagliate e non e' riuscita a riscriverle. Chi legge deve
    // sapere che quel buco l'ha fatto il gestionale adesso, non il caricamento.
    riparazione_tentata: soloToccati.length ? soloToccati : null,
    // La cancellazione e' partita e la risposta non e' tornata: l'archivio e'
    // stato ricontato e i numeri qui sopra sono quelli di adesso, ma chi legge
    // deve sapere che a togliere quelle righe puo' essere stato il gestionale.
    riparazione_incerta: cancellazioniIncerte.length ? cancellazioniIncerte : null,
    // Gli archivi che non si e' riusciti a contare: non si sa se le righe ci
    // siano tutte e una volta sola. Quelli "instabili" sono un caso a parte: si
    // e' riusciti a contarli, ma hanno dato due numeri diversi di fila, e su un
    // numero che sta ancora cambiando non si dichiara niente. Non c'entra la
    // riparazione: il conteggio si puo' fermare male anche prima che parta -
    // anzi, se non si ferma la riparazione non parte affatto.
    avviso_non_verificato: nonVerificati.length || incerte ? {
      non_contato: nonVerificati.length > 0,
      archivi: nonVerificati.map(a => a.nome),
      instabili: instabili.map(a => a.nome),
      // La lettura ha negato righe che la function aveva confermato di aver
      // scritto: non si ripara sopra una lettura cosi' e non si dichiara
      // niente. Si dice, ed e' un'altra cosa dal conteggio che non riesce.
      incoerenti: incoerenti.map(a => a.nome),
      // Gli archivi in cui restano ordini che le scritture confermate non
      // coprono: un caso a parte anche loro, con la sua frase.
      non_confermati: nonConfermati.map(a => ({ nome: a.nome, ordini: archivi[a.entita].ordini_non_confermati })),
      righe_incerte: incerte,
    } : null,
    // Se al prossimo caricamento verra' chiesta una conferma: succede solo se in
    // archivio restano meno ordini di quanti ce n'erano quando questo e'
    // partito. true, false, oppure null quando non si e' riusciti a contare gli
    // ordini e quindi non si sa.
    //
    // Puo' dire "si'" anche quando non e' successo niente di male: al primo
    // caricamento dopo il passaggio ai file dell'anno scorso l'archivio perde
    // per un motivo giusto i cancellati degli anni prima, che il gestionale
    // lascia andare da solo. La conferma e' innocua - si legge e si conferma -
    // e il caso e' stretto, perche' scatta solo su un caricamento non riuscito.
    // Scritto qui perche' chi lo legge domani non lo scambi per un guasto.
    conferma_al_prossimo: esito === 'successo' || typeof prep.righe_archivio_prima !== 'number'
      ? false
      : (ordiniContati ? ordiniInArchivio.size < prep.righe_archivio_prima : null),
    // Gli ordini in stato "eseguito" a portale: tutti i dati inseriti ma nessuno
    // ha premuto Chiudi. Non entrano in nessun conto e non si sommano ai
    // terminati: si dicono e basta, rete e ACI separati.
    avviso_eseguiti: eseguiti,
    ultimo_errore: ultimoErrore,
    forzato: !!confermaForzatura,
    durata_secondi: durata,
    esito,
  };
}

// Tipi che usano la lettura nel browser invece dell'import lato server.
export const TIPI_LETTURA_BROWSER = ['dichiarazioni_trattamento', 'ordini_non_dichiarati'];

// === Dopo un caricamento ===
// Regola dell'utente (21/09/2026): ogni caricamento aggiorna tutto. Qui c'e'
// l'elenco unico di cio' che si ricalcola dopo ciascun tipo di dato, usato da
// tutti i punti da cui i dati entrano: Caricamento Dati, la pagina Secondarie e
// le schede dell'Extra Raccolta. Prima ognuno lanciava la sua parte - o niente -
// e il resto restava fermo al caricamento precedente.
//
// Non stanno qui gli alert, che partono dal registro dei caricamenti a
// caricamento concluso (workflow AlertEngineAutoRun), e l'allineamento delle
// dichiarazioni mensili, che fa parte di importaGrandeFile perche' il suo esito
// si mostra subito. I moduli che calcolano all'apertura (giacenze, dichiarazioni,
// fatturazione, predittivita' delle secondarie) non hanno niente da ricalcolare.
// La predittivita' qui c'era fino al 26/09/2026: il piano settimanale e il
// suggerimento del lunedi' erano esiti salvati e si rifacevano a ogni
// caricamento. Ora la pagina si ricalcola da sola a ogni apertura senza scrivere
// niente, e il programma della settimana dopo si fissa il mercoledi' alle 8
// (analisiSettimanalePredittiva): rifarlo a ogni caricamento lo cambierebbe,
// mentre il programmato deve restare quello deciso per confrontarlo col fatto.
//
// Le terziarie non compaiono: nessuno dei ricalcoli le legge (i soggetti della
// qualifica vengono da primarie, secondarie ed extra raccolta).
//
// Le verifiche dei report e le quadrature FIR le riconfronta ricontrollaDichiarazioni
// anche dopo una scheda di extra raccolta: tutte le verifiche concluse e le
// quadrature delle ultime settimane, scrivendo solo cio' che cambia. Per l'extra
// raccolta c'era un secondo giro che rifaceva le stesse verifiche con
// elaboraReportSettimanale ed elaboraQuadraturaFir, in parallelo e sugli stessi
// record: al primo errore metteva in "errore" una verifica conclusa, e una
// quadratura senza righe salvate diventava "La lettura del file non e' riuscita".
const RICALCOLI = {
  primarie: ['evasioneAssegnati', 'ritiriEct', 'todoOrdini', 'verifiche', 'qualifica'],
  secondarie: ['verifiche', 'qualifica'],
  extra_raccolta: ['verifiche', 'qualifica'],
  // REGOLA 2: ogni caricamento aggiorna tutti i moduli. Il report delle
  // dichiarazioni di trattamento dice quali mesi il portale ha davvero accettato,
  // ed e' la sola cosa che segna una dichiarazione come caricata: finche' non si
  // allineava da se', il modulo mostrava come arretrato un mese gia' dichiarato e
  // bisognava ricordarsi di premere un pulsante. L'utente l'ha chiesto il
  // 02/10/2026: «dovrebbe farlo in automatico quando carico quei due file».
  dichiarazioni_trattamento: ['allineaDichiarazioni'],
};

const NOMI_RICALCOLI = {
  evasioneAssegnati: 'evasione delle liste di assegnati',
  ritiriEct: 'ritiri delle richieste del consorzio',
  todoOrdini: 'ordini da completare della to-do list',
  verifiche: 'verifiche dei report e quadrature FIR (anche nessuna movimentazione)',
  qualifica: 'qualifica fornitori',
  allineaDichiarazioni: 'dichiarazioni degli impianti caricate a portale',
  alertExtra: "alert delle date obbligatorie dell'extra raccolta",
};

// Gli archivi che i ricalcoli leggono, per tipo di caricamento: l'extra raccolta
// non ha un caricamento da file.
const TIPI_LETTI_DAI_RICALCOLI = ['primarie', 'secondarie'];
const FINESTRA_IN_CORSO_MS = 10 * 60 * 1000;

// Un ricalcolo che parte mentre primarie o secondarie si stanno riscrivendo -
// oppure dopo un caricamento interrotto, che le ha lasciate a meta' - salva esiti
// letti su un archivio a meta' (regola 2). Non si parte, e si dice quale
// caricamento lo impedisce. ricontrollaDichiarazioni lo controlla anche per conto
// suo (risponde 409); qui vale per tutti i ricalcoli, qualifica compresa. Se il
// registro non si riesce a leggere si prosegue: meglio un ricalcolo in piu' che
// uno perso, e il controllo lato server resta.
//
// Un caricamento fallito dopo lo svuotamento lascia la sua riga "in_corso", col
// messaggio che comincia con NON_RIUSCITO (importEcotyreFile, importaBlocco); in
// "errore" si chiude solo chi fallisce prima di svuotare, a dati intatti. Percio'
// le righe in errore si saltano: un file sbagliato caricato dopo non deve
// nascondere l'archivio rimasto vuoto.
const NON_RIUSCITO = 'Caricamento non riuscito';
async function caricamentoAperto() {
  try {
    for (const tipo of TIPI_LETTI_DAI_RICALCOLI) {
      const righe = await base44.entities.UploadLog.filter({ tipo_file: tipo }, '-created_date', 10);
      const ultimo = (righe || []).find(r => r.esito !== 'errore');
      if (!ultimo || ultimo.esito !== 'in_corso') continue;
      const inizio = dataServer(ultimo.created_date);
      const chi = ultimo.utente ? ` di ${ultimo.utente}` : '';
      const file = ultimo.nome_file && ultimo.nome_file !== 'N/D' ? ` (${ultimo.nome_file})` : '';
      if (String(ultimo.messaggio || '').startsWith(NON_RIUSCITO)) {
        return `rinviato: il caricamento ${tipo}${chi}${file} non e' riuscito e l'archivio puo' essere vuoto o incompleto; ricarica il file`;
      }
      if (inizio && Date.now() - inizio.getTime() > FINESTRA_IN_CORSO_MS) {
        return `rinviato: il caricamento ${tipo}${chi}${file} e' rimasto interrotto e l'archivio puo' essere incompleto; ricarica il file`;
      }
      return `rinviato: caricamento ${tipo}${chi}${file} in corso; si rifa' quando finisce`;
    }
  } catch (e) {
    return null;
  }
  return null;
}

// I primi errori di un elenco, per la riga sotto il caricamento.
function testoErrori(errori) {
  const primi = errori.slice(0, 3).map(x => (typeof x === 'string' ? x : (x && (x.errore || x.error)) || JSON.stringify(x)));
  return primi.join('; ') + (errori.length > primi.length ? ` (e altri ${errori.length - primi.length})` : '');
}

// Contratto con le funzioni dei ricalcoli: riuscito vuol dire risposta 200, e
// basta. Un 409 (caricamento aperto) o un 500 (con i primi errori) arrivano come
// eccezione. Una risposta 2xx diversa da 200, o un 200 che dice "rinviato" o porta
// errori - come rispondeva ricontrollaDichiarazioni prima - non e' un ricalcolo
// fatto e non si mostra in verde. Restituisce il motivo, o null se e' riuscito.
function problemaRisposta(res) {
  const stato = res && typeof res.status === 'number' ? res.status : null;
  if (stato !== null && stato !== 200) return `risposta ${stato} invece di 200`;
  const dati = (res && res.data !== undefined ? res.data : res) || {};
  if (dati.rinviato) {
    const aperti = Array.isArray(dati.caricamenti_in_corso) ? dati.caricamenti_in_corso : [];
    return aperti.length
      ? `rinviato: caricamento ${aperti.map(c => `${c.tipo_file}${c.utente ? ` di ${c.utente}` : ''}`).join(', ')} in corso`
      : 'rinviato: caricamento in corso';
  }
  if (Array.isArray(dati.errori) && dati.errori.length) return `${dati.errori.length} non riusciti: ${testoErrori(dati.errori)}`;
  if (dati.error) return String(dati.error);
  return null;
}

// Cio' che un ricalcolo riuscito deve comunque far sapere, o null. I ritiri delle
// richieste del consorzio dicono quali richieste restano aperte su un ordine
// terminato senza fine trasporto: non si contano come ritirate (regola 1), ma
// sollecitarle sarebbe sbagliato. E quali sono evase da ordini con un'altra data
// obbligatoria da sistemare (regola dell'utente del 22/09/2026).
//
// Un ricalcolo che manda un avviso gia' scritto (campo "avviso") lo fa vedere
// com'e': lo usa il controllo degli ordini della to-do list, che dice quali
// attivita' si sono chiuse da sole e quali restano aperte perche' il loro ordine
// risulta cancellato.
function avvisoRisposta(res) {
  const dati = (res && res.data !== undefined ? res.data : res) || {};
  const lista = (campo) => (Array.isArray(dati[campo]) ? dati[campo] : []);
  return [
    testoTerminatiSenzaFine(lista('terminati_senza_fine')),
    testoOrdiniDateDaSistemare(lista('ordini_con_date_da_sistemare')),
    String(dati.avviso || '').trim(),
  ].filter(Boolean).join(' ') || null;
}

// Il messaggio di un ricalcolo rifiutato: quello della funzione, o i suoi primi errori.
function messaggioRicalcolo(e) {
  const dati = datiErrore(e);
  if (dati && !dati.error && Array.isArray(dati.errori) && dati.errori.length) return testoErrori(dati.errori);
  return messaggioErrore(e);
}

/**
 * Lancia i ricalcoli che dipendono da un tipo di dato appena caricato o scritto.
 * Non blocca chi chiama: restituisce una promessa con l'esito di ciascun
 * ricalcolo, { nome, ok, errore }, nell'ordine dell'elenco, da mostrare a chi ha
 * caricato. Un ricalcolo non riuscito si dice per nome, non si perde.
 *
 * I ricalcoli si fanno uno alla volta: ognuno rilegge archivi interi, e nello
 * stesso momento il workflow degli alert lancia i suoi. In parallelo la
 * piattaforma rifiuta le richieste troppo ravvicinate, e gli errori che ne
 * nascevano risultavano "Non aggiornati".
 *
 * @param {string} tipoFile  primarie, secondarie, extra_raccolta, ...
 * @param {object} opzioni   { giorni: giorni italiani di fine trasporto toccati (extra raccolta) }
 */
export async function dopoCaricamento(tipoFile, { giorni = [] } = {}) {
  const elenco = RICALCOLI[tipoFile] || [];
  if (!elenco.length) return [];
  const giorniValidi = [...new Set(giorni.filter(Boolean))];
  // La qualifica si rifa' sull'anno dei dati toccati; per un file, l'anno in corso.
  const anni = [...new Set(giorniValidi.map(g => Number(g.slice(0, 4))))];
  if (!anni.length) anni.push(Number(oggiRoma().slice(0, 4)));

  const aperto = await caricamentoAperto();
  if (aperto) return elenco.map(k => ({ nome: NOMI_RICALCOLI[k], ok: false, errore: aperto }));

  // Le schede di extra raccolta non passano da un file: la modifica si scrive nel
  // registro dei caricamenti come le altre, cosi' lo storico delle quadrature e
  // delle verifiche sa che gli esiti di prima vanno rifatti (regola 2). La stessa
  // riga avvia il motore degli alert (AlertEngineAutoRun, dal 22/09/2026), che
  // rivaluta le date obbligatorie dell'extra raccolta.
  let registrata = false;
  if (tipoFile === 'extra_raccolta' && giorniValidi.length) {
    try {
      const utente = await base44.auth.me().catch(() => null);
      const ordinati = [...giorniValidi].sort();
      await base44.entities.UploadLog.create({
        tipo_file: 'extra_raccolta', nome_file: 'Schede di extra raccolta', esito: 'successo',
        righe_importate: ordinati.length, utente: (utente && (utente.full_name || utente.email)) || '',
        messaggio: `Schede modificate con fine trasporto dal ${ordinati[0]} al ${ordinati[ordinati.length - 1]}`,
      });
      registrata = true;
    } catch (e) { /* il ricalcolo parte lo stesso */ }
  }

  const compiti = {
    evasioneAssegnati: () => base44.functions.invoke('controllaEvasioneAssegnati', {}),
    ritiriEct: () => base44.functions.invoke('importaBlocco', { azione: 'ritiri_ect', tipo_file: 'primarie' }),
    // Le attivita' della to-do list con un ID ordine scritto sopra: quando
    // quell'ordine risulta terminato l'attivita' si chiude da sola, e resta
    // scritto perche' e quando (base44/shared/todoOrdini.ts).
    todoOrdini: () => base44.functions.invoke('controllaTodoOrdini', {}),
    // Con i giorni toccati si rifanno anche le quadrature piu' vecchie di quelle settimane.
    verifiche: () => base44.functions.invoke('ricontrollaDichiarazioni', { giorni: giorniValidi }),
    // un anno alla volta anche qui, per la stessa ragione
    qualifica: async () => {
      const risposte = [];
      for (const anno of anni) risposte.push(await base44.functions.invoke('qualificaFornitori', { anno }));
      return risposte;
    },
    // Una scheda senza fine trasporto la riga del registro non la scrive, e se
    // la scrittura non riesce il workflow non parte: senza, l'alert delle date
    // obbligatorie dell'extra raccolta restava vecchio proprio per chi la data non
    // ce l'ha (22/09/2026). In quei casi il motore si lancia da qui, una volta.
    // Un anno per volta, come la qualifica: il report puo' portare mesi di piu'
    // anni e l'allineamento lavora sull'anno che gli si dice.
    allineaDichiarazioni: async () => {
      const risposte = [];
      for (const anno of anni) risposte.push(await base44.functions.invoke('allineaDichiarazioni', { anno }));
      return risposte;
    },
    alertExtra: () => base44.functions.invoke('runAlertEngine', { modulo: 'extra_raccolta' }),
  };
  const daFare = tipoFile === 'extra_raccolta' && !registrata ? [...elenco, 'alertExtra'] : elenco;
  const esiti = [];
  for (const k of daFare) {
    // Ogni richiesta respinta per il limite della piattaforma si ripete gia' da
    // sola (limiteRichieste). Se un ricalcolo si arrende lo stesso, lo si rifa'
    // una volta dopo mezzo minuto: i ricalcoli rileggono e riscrivono i loro
    // esiti, ripeterli non crea doppioni.
    for (let tentativo = 0; ; tentativo++) {
      try {
        const risposte = [].concat(await compiti[k]());
        const problema = risposte.map(problemaRisposta).find(Boolean);
        const avviso = risposte.map(avvisoRisposta).find(Boolean);
        if (problema && tentativo === 0 && eLimiteRichieste(problema)) { await pausa(PAUSA_DOPO_LIMITE); continue; }
        esiti.push(problema ? { nome: NOMI_RICALCOLI[k], ok: false, errore: problema } : { nome: NOMI_RICALCOLI[k], ok: true, ...(avviso ? { avviso } : {}) });
      } catch (e) {
        const messaggio = messaggioRicalcolo(e);
        if (tentativo === 0 && (eLimiteRichieste(e) || eLimiteRichieste(messaggio))) { await pausa(PAUSA_DOPO_LIMITE); continue; }
        esiti.push({ nome: NOMI_RICALCOLI[k], ok: false, errore: messaggio });
      }
      break;
    }
  }
  // Se sono andati tutti, lo si scrive accanto al caricamento: cosi' un
  // caricamento riuscito i cui ricalcoli sono rimasti appesi - la scheda chiusa,
  // la rete caduta - si riconosce e si rifa' da solo (ricalcoliDaRecuperare).
  if (esiti.length && esiti.every(e => e.ok) && TIPI_LETTI_DAI_RICALCOLI.includes(tipoFile)) {
    try {
      await base44.functions.invoke('importaBlocco', { azione: 'moduli_aggiornati', tipo_file: tipoFile });
    } catch (e) { /* la nota e' un di piu': i ricalcoli sono fatti */ }
  }
  return esiti;
}

/**
 * Se dopo questo caricamento i moduli collegati si possono ricalcolare.
 *
 * Solo su un caricamento RIUSCITO. Un archivio vuoto, a meta', con righe di
 * troppo, con righe mancanti o non contato non e' una base su cui rifare i
 * conti: prima ci si fermava solo sull'errore e sulle righe di troppo, cosi' la
 * qualifica salvava il suo riepilogo su un archivio dichiarato inaffidabile e
 * gli altri quattro ricalcoli tornavano indietro con un 409 a testa. Dopo una
 * riparazione riuscita l'esito e' "successo" e i ricalcoli partono da soli.
 *
 * Chi non porta un esito (le importazioni lato server piu' vecchie) parte come
 * prima.
 */
export const moduliDaRicalcolare = (dati) => {
  const esito = dati && dati.esito;
  return !esito || esito === 'successo';
};

/**
 * Che cosa si mostra QUANDO I RICALCOLI NON PARTONO, ed e' giusto che non
 * partano: l'archivio e' a meta' e rifare i conti sopra sarebbe peggio.
 *
 * Non partire in silenzio pero' e' un'altra cosa. Una secondaria chiusa
 * "parziale" - basta una riga non entrata - lasciava verifiche dei report,
 * quadrature FIR e qualifica fornitori fermi al
 * caricamento di prima, e l'unico segno era la spunta ambra coi numeri: nessuna
 * riga, nessuna finestra, e nessuno che li recuperasse. Si dice per nome quali
 * moduli sono rimasti indietro e perche'.
 *
 * null quando i ricalcoli sono partiti o quando per quel tipo di file non ce
 * n'e' nessuno.
 */
export function ricalcoliFermi(tipoFile, dati) {
  if (moduliDaRicalcolare(dati)) return null;
  const elenco = RICALCOLI[tipoFile] || [];
  if (!elenco.length) return null;
  const motivo = "il caricamento non e' riuscito del tutto: restano quelli di prima e si rifanno quando l'archivio torna a posto";
  return elenco.map(k => ({ nome: NOMI_RICALCOLI[k], ok: false, errore: motivo }));
}

/**
 * I tipi di dato il cui ultimo caricamento e' andato bene ma i cui ricalcoli
 * non risultano fatti: la scheda chiusa a meta', la rete caduta, oppure - come
 * la notte del 24/09/2026 - un caricamento finito male e poi rimesso a posto.
 * Chi apre la pagina dei caricamenti li fa ripartire da solo, senza che nessuno
 * debba accorgersene leggendo il testo rosso (regola 2: ogni caricamento
 * aggiorna tutto).
 *
 * Si guarda solo l'ULTIMO caricamento di ogni tipo, e solo se e' riuscito: su un
 * archivio lasciato a meta' i ricalcoli non devono partire affatto.
 */
export async function ricalcoliDaRecuperare() {
  const daFare = [];
  try {
    for (const tipo of TIPI_LETTI_DAI_RICALCOLI) {
      if (!RICALCOLI[tipo]) continue;
      const righe = await base44.entities.UploadLog.filter({ tipo_file: tipo }, '-created_date', 10);
      const ultimo = (righe || []).find(r => r.esito !== 'errore');
      if (!ultimo || ultimo.esito !== 'successo') continue;
      if (String(ultimo.messaggio || '').includes(MODULI_AGGIORNATI)) continue;
      daFare.push(tipo);
    }
  } catch (e) {
    return [];
  }
  return daFare;
}

/**
 * Quali recuperi si fanno DAVVERO, fra quelli che il registro segnala.
 *
 * Sta qui e non dentro la pagina perche' e' una regola, non grafica, e le prove
 * la controllano. Due freni, che prima non c'erano:
 *
 *  - LI FA SOLO CHI PUO' CARICARE. I ricalcoli (cinque per le primarie, due per
 *    le secondarie: vedi RICALCOLI) rileggono archivi interi e
 *    ci SCRIVONO (riepilogo della qualifica, verifiche dei report e quadrature
 *    FIR, ritiri ECT, evasione assegnati, chiusura delle attivita' della to-do
 *    list), e nessuna di quelle funzioni guarda il
 *    livello. La pagina dei caricamenti si apre a tutti: bastava che un collega
 *    in sola consultazione la aprisse per far riscrivere tutto, contro la regola
 *    dei permessi (gli altri consultano, esportano e aprono richieste). Senza un
 *    modo di sapere chi e', non si fa niente: si nega, non si concede.
 *  - UNA VOLTA PER SESSIONE. Se un ricalcolo fallisce per un motivo stabile la
 *    nota "moduli collegati aggiornati" non si scrive mai, e senza freno la
 *    raffica si ripeteva a ogni apertura della pagina, per ogni utente, contro
 *    un limite di circa settanta richieste al minuto per tutta l'app.
 */
export function recuperiDaFare(tipi, { puoFare, giaTentati } = {}) {
  if (typeof puoFare !== 'function') return [];
  return (tipi || []).filter(t => puoFare(t) && !(giaTentati && giaTentati.has(t)));
}

// Gli anni per cui la qualifica ha gia' risposto "rinviato" dopo un certo
// caricamento: in questa sessione non si richiama piu'. La chiave tiene dentro
// anche il caricamento, cosi' un caricamento nuovo fa ridare una possibilita'.
// Sta fuori dalla funzione apposta: deve sopravvivere a un rimontaggio della
// pagina, non a un ricaricamento del browser.
//
// Si tiene anche LA FRASE, non solo il segno. Con un semplice insieme, alla
// seconda apertura della pagina il segno c'era e l'avviso no: la scheda usciva
// muta e i numeri vecchi tornavano a sembrare freschi. Bastava cambiare pagina
// e tornare indietro.
const qualificheRinviate = new Map();
const chiaveQualifica = (anno, ultimoCaricamento) => `${Number(anno)}|${ultimoCaricamento || 0}`;

/**
 * Se conviene richiamare qualificaFornitori per aggiornare il RIEPILOGO SALVATO
 * (quello che leggono il cruscotto, il menu e la fatturazione passiva).
 *
 * Si richiama quando il riepilogo salvato e' piu' vecchio dell'ultimo
 * caricamento che porta soggetti nuovi. Ma con un caricamento aperto, o
 * lasciato a meta', la function CALCOLA e NON SALVA (risponde "rinviato"): il
 * riepilogo resta vecchio, la condizione resta vera e la pagina rifaceva il
 * calcolo completo - tutte le primarie, le secondarie e l'extra raccolta - a
 * ogni apertura, per sempre, proprio quando l'app e' gia' affaticata. Dopo un
 * "rinviato" non si insiste: si mostra l'avviso e si aspetta il caricamento
 * concluso, che salva da solo (regola 2).
 *
 * Sta qui e non dentro la pagina perche' e' una regola, non grafica, e le prove
 * la controllano.
 */
export function qualificaDaRifare(anno, { aggiornatoIl = 0, ultimoCaricamento = 0 } = {}) {
  if (!(ultimoCaricamento > aggiornatoIl)) return false;
  return !qualificheRinviate.has(chiaveQualifica(anno, ultimoCaricamento));
}

/**
 * La qualifica ha risposto "rinviato": non si richiama piu' fino al prossimo
 * caricamento. Si tiene anche la frase da mostrare, perche' alla riapertura
 * della pagina non si richiama piu' e senza la frase non resterebbe niente da
 * dire: numeri vecchi presentati come freschi.
 */
export function segnaQualificaRinviata(anno, { ultimoCaricamento = 0, avviso = null } = {}) {
  qualificheRinviate.set(chiaveQualifica(anno, ultimoCaricamento), avviso || '');
}

/**
 * La frase da mostrare quando la qualifica era gia' stata rinviata: si legge al
 * posto della chiamata che non si fa piu'.
 */
export function avvisoQualificaRinviata(anno, { ultimoCaricamento = 0 } = {}) {
  return qualificheRinviate.get(chiaveQualifica(anno, ultimoCaricamento)) || null;
}

/**
 * Una riga da mostrare sotto il caricamento: com'e' finito il controllo
 * dell'archivio. Due cose, e nessuna delle due si tace.
 *
 * Le righe di troppo: l'archivio ne ha piu' di quante gliene porta il file,
 * quindi qualcosa e' entrato due volte e i pesi di quelle righe adesso si
 * contano doppi. Il rimedio e' uno solo, ricaricare lo stesso file, perche' il
 * caricamento svuota gli archivi e li riscrive: un export rifiltrato ne
 * toglierebbe altri. Gli ordini si nominano solo se si e' riusciti a sapere
 * quali sono, e sono quelli che in archivio hanno piu' righe che nel file: un
 * ordine con due classi ha due righe ed e' giusto cosi'.
 *
 * L'archivio che non si e' riusciti a contare: nessuno puo' dire se le righe ci
 * siano tutte e una volta sola. Si dice com'e', invece di chiudere in silenzio
 * come se fosse andato tutto bene (e' cosi' che il file e' stato caricato due
 * volte senza che nessuno se ne accorgesse).
 */
/**
 * Gli archivi da nominare dentro "Non si e' riusciti a contare": SOLO quelli
 * che non hanno risposto.
 *
 * Quello che non si e' fermato su un numero e quello la cui lettura smentisce
 * le scritture confermate hanno risposto eccome, e hanno la loro frase, che
 * dice una cosa diversa. Nominandoli anche qui, della stessa Primarie RETE si
 * leggevano due notizie diverse in due righe una sotto l'altra.
 *
 * Sta qui e non nel componente perche' e' una regola, non grafica, e le prove
 * la controllano: la riga sotto la scheda la rispettava e la finestra no.
 */
export function archiviSenzaConteggio(avviso) {
  return (avviso && avviso.archivi ? avviso.archivi : []).filter(n => !archiviConFraseLoro(avviso).includes(n));
}

/**
 * Gli archivi che hanno gia' una frase loro, che dice un'altra cosa: quello che
 * non si e' fermato su un numero, quello che smentisce le scritture confermate
 * e quello con degli ordini che le scritture confermate non coprono.
 *
 * Finche' ce n'e' uno solo, la frase generica "Non si e' riusciti a contare
 * l'archivio" NON si dice: e' proprio l'archivio che ha risposto dieci volte.
 * La regola sta qui, una volta sola, perche' la usano tutte e due le superfici -
 * la riga sotto la scheda e la finestra - e quando ognuna se la calcolava per
 * conto suo la finestra scriveva "non si e' riusciti a contare l'archivio" e la
 * riga, due centimetri sotto, il motivo vero.
 */
export function archiviConFraseLoro(avviso) {
  if (!avviso) return [];
  return [
    ...(avviso.instabili || []),
    ...(avviso.incoerenti || []),
    ...(avviso.non_confermati || []).map(x => x.nome),
  ];
}

/**
 * Un archivio che non torna con il file, a parole.
 *
 * QUANDO LE RIGHE SONO LE STESSE NON SI SCRIVE «450 righe invece delle 450 del
 * file»: succede proprio nel caso per cui tutto questo giro esiste - un blocco
 * entrato due volte e uno mai arrivato, +200 e -200, il totale che torna e gli
 * ordini che non tornano - e chi lo legge pensa a un errore di stampa e smette
 * di fidarsi anche del resto. Il totale non e' la notizia: la notizia sono gli
 * ordini.
 */
function descriviArchivioSbagliato(a) {
  const esempi = (a.esempi || []).map(e => `${e.id_ordine} (${formatIntero(e.volte)} righe invece di ${formatIntero(e.nel_file)})`);
  const altri = (a.ordini || 0) - esempi.length;
  // Quante righe quell'archivio dovrebbe avere: quelle del file, piu' lo storico
  // conservato quando ce n'e'. Chiamare "del file" anche le righe conservate
  // sarebbe falso proprio nella frase che spiega un guasto.
  const conservati = Number(a.conservati) || 0;
  const daDove = conservati > 0 ? 'fra il file e lo storico conservato' : 'del file';
  const quante = a.righe === a.attese
    ? `le righe sono ${formatIntero(a.righe)} come ${conservati > 0 ? 'fra il file e lo storico conservato' : 'nel file'}, ma non sono quelle degli ordini giusti`
    : `${formatIntero(a.righe)} righe invece delle ${formatIntero(a.attese)} ${daDove}`;
  return `${a.nome}: ${quante}`
    + (esempi.length ? `, per esempio ${esempi.join(', ')}${altri > 0 ? ` e altri ${formatIntero(altri)} ordini` : ''}` : '');
}

/** Che cosa ha rimesso a posto la riparazione su un archivio, a parole. */
export const contoRiparazione = (a) => [
  a.riscritte ? `${formatIntero(a.riscritte)} riscritte` : '',
  a.tolte ? `${formatIntero(a.tolte)} di troppo tolte` : '',
].filter(Boolean).join(' e ');

/**
 * L'archivio e, se c'e', che cosa ci ha rimesso a posto la riparazione.
 *
 * Il conto puo' essere VUOTO, ed e' il caso piu' importante: la riparazione ha
 * cancellato e riscritto e la piattaforma non le ha confermato niente. Li'
 * uscivano parentesi vuote - "Primarie RETE: " - dove invece va detto il nome e
 * basta, perche' il "che cosa" lo dice il motivo subito dopo.
 */
export const dettaglioRiparazione = (a) => {
  const conto = contoRiparazione(a);
  return conto ? `${a.nome}: ${conto}` : a.nome;
};

/**
 * Che cosa ha fatto la riparazione, archivio per archivio, in una forma sola.
 *
 * A raccontarlo sono due posti - la riga sotto la scheda e la finestra - e
 * finche' ognuno se l'e' calcolato per conto suo hanno detto due cose OPPOSTE
 * sullo stesso archivio nello stesso momento: la riga scriveva «il gestionale
 * ha provato a rimettere a posto Primarie RETE (50 riscritte)» e la finestra,
 * due centimetri sopra, «il gestionale NON HA PROVATO a rimettere a posto le
 * righe da solo: Primarie RETE». La regola sta qui, una volta sola, e le prove
 * la controllano.
 */
export function riparazioniDaDire(dati) {
  const vuoto = { risolti: [], restati: [], nonContati: [], aMeta: [], nonFatta: [], tentata: [], incertaConNumeri: [], incertaSenzaNumeri: [] };
  if (!dati) return vuoto;
  const riparazione = dati.avviso_riparazione || null;
  const nonFatta = dati.riparazione_non_fatta || [];
  const nonVerificato = dati.avviso_non_verificato || null;
  // Gli archivi di cui il gestionale ha appena detto di NON sapere quante righe
  // abbiano: li' «i numeri qui sotto sono quelli di adesso» sarebbe falso, e lo
  // era - si leggeva insieme a «non si e' riusciti a contare questo archivio».
  const senzaNumeri = new Set(nonVerificato
    ? [...(nonVerificato.archivi || []), ...(nonVerificato.instabili || []), ...(nonVerificato.incoerenti || []),
      ...(nonVerificato.non_confermati || []).map(x => x.nome)]
    : []);
  const motivoNonFatta = new Map(nonFatta.map(x => [x.nome, x.motivo]));
  const tutti = riparazione ? (riparazione.archivi || []) : [];
  const incerta = dati.riparazione_incerta || [];
  // GLI ARCHIVI CHE LA RIPARAZIONE HA TOCCATO SENZA CHE LE VENISSE CONFERMATO
  // NIENTE. Sono quelli in cui ha cancellato, riscritto, e nessuna delle due
  // cose ha risposto: avviso_riparazione non li nomina - li' ci vanno solo le
  // righe che la piattaforma ha confermato - e finivano quindi fra quelli di
  // cui si scriveva "il gestionale NON HA PROVATO a rimettere a posto", tre
  // parole prima di "ha chiesto di togliere le righe". "Non ha confermato
  // niente" non vuol dire "non ha toccato niente": e' proprio il caso della
  // rete che cade, cioe' quello per cui tutto questo esiste.
  const toccatiSenzaConferme = nonFatta.filter(x => x.toccato && !tutti.some(a => a.nome === x.nome));
  return {
    risolti: tutti.filter(a => a.risolto),
    // Gli archivi rimessi a posto si dividono in due, perche' sono due notizie
    // diverse: quelli a cui mancava o avanzava qualcosa, e quelli che al primo
    // controllo tornavano gia' e sono passati dalla riparazione solo per
    // sciogliere un dubbio. Dire "mancavano delle righe" del secondo caso e'
    // falso, e resta scritto nello storico.
    risoltiPerMancanza: tutti.filter(a => a.risolto && !a.solo_per_dubbio),
    risoltiPerDubbio: tutti.filter(a => a.risolto && a.solo_per_dubbio),
    // Un archivio riparato ma non contato non si racconta come "non torna
    // ancora con il file": e' un'affermazione su un archivio di cui il
    // gestionale ha appena detto di non sapere niente.
    nonContati: tutti.filter(a => !a.risolto && a.contato === false),
    restati: tutti.filter(a => !a.risolto && a.contato !== false && !motivoNonFatta.has(a.nome)),
    // CI HA PROVATO MA NON E' ARRIVATO IN FONDO: una frase sola. Erano due campi
    // indipendenti e uscivano in fila, "ci ha provato" e "non ci ha provato".
    aMeta: [
      ...tutti.filter(a => !a.risolto && a.contato !== false && motivoNonFatta.has(a.nome))
        .map(a => ({ ...a, motivo: motivoNonFatta.get(a.nome) })),
      // Ci ha provato eccome, solo che non gli e' stato confermato niente: la
      // frase e' la stessa, e il conto delle righe resta vuoto perche' non c'e'
      // nessun numero da promettere.
      ...toccatiSenzaConferme.map(x => ({ nome: x.nome, riscritte: 0, tolte: 0, risolto: false, motivo: x.motivo })),
    ],
    // Non ci ha NEMMENO provato: solo gli archivi di cui la riparazione non
    // parla affatto E che non ha toccato.
    nonFatta: nonFatta.filter(x => !x.toccato && !tutti.some(a => a.nome === x.nome)),
    // Ha tolto delle righe e non e' riuscito a rimetterle: si dice QUANTE, che
    // e' l'unico modo di non prendersi anche le righe mai entrate.
    tentata: (dati.riparazione_tentata || []).map(x => (typeof x === 'string' ? { nome: x, righe: 0 } : x)),
    incertaConNumeri: incerta.filter(n => !senzaNumeri.has(n)),
    incertaSenzaNumeri: incerta.filter(n => senzaNumeri.has(n)),
  };
}

export function testoVerificaArchivio(dati) {
  if (!dati) return null;
  const doppioni = dati.avviso_doppioni;
  const nonVerificato = dati.avviso_non_verificato;
  const mancanti = dati.avviso_mancanti;
  const riparazione = dati.avviso_riparazione;
  const nonFatta = dati.riparazione_non_fatta;
  const tentata = dati.riparazione_tentata;
  const incerta = dati.riparazione_incerta;
  // Lo storico conservato che ha perso delle righe: non c'e' niente da riparare,
  // perche' il file non le contiene. Si dice, e si dice il rimedio.
  const storicoNonTorna = dati.avviso_storico_non_torna;
  // L'archivio che non torna col file sul percorso che NON e' quello delle
  // primarie: li' righe di troppo e righe mancanti non si sanno per ordine, e
  // questo e' l'unico segnale che arriva. Senza, chi chiudeva la finestra non
  // aveva piu' niente da leggere sotto la scheda.
  const disallineamento = dati.avviso_disallineamento;
  if (!doppioni && !nonVerificato && !mancanti && !riparazione && !nonFatta && !tentata && !incerta && !disallineamento && !storicoNonTorna) return null;
  // Per ordini non dichiarati e dichiarazioni di trattamento non c'e' nessun
  // modulo collegato da far ripartire: dirgli che "i ricalcoli non sono partiti"
  // lo manderebbe a cercare qualcosa che non esiste.
  const conRicalcoli = !dati.tipo_file || !!RICALCOLI[dati.tipo_file];
  const eIRicalcoli = conRicalcoli ? ' I ricalcoli dei moduli collegati non sono partiti.' : '';

  const parti = [];
  // La riparazione si dice per prima, archivio per archivio: uno rimesso a
  // posto davvero non deve leggersi "non torna ancora" solo perche' un altro
  // archivio non e' riuscito. E le righe TOLTE non si raccontano come
  // "riscritte": erano di troppo per intero e adesso non ci sono piu'.
  //
  // Perche' su un archivio non si e' nemmeno provato a togliere le righe di
  // troppo si tiene a portata di mano: serve a NON dire due frasi opposte una
  // dietro l'altra sullo stesso archivio. "Ci ha provato" e "non ci ha
  // provato" arrivavano da due campi indipendenti e si stampavano in fila.
  const r = riparazioniDaDire(dati);
  const dove = (elenco) => elenco.map(dettaglioRiparazione).join(', ');
  if (r.risoltiPerMancanza.length) {
    parti.push(`Dopo il primo controllo mancavano o avanzavano delle righe: il gestionale le ha rimesse a posto da solo (${dove(r.risoltiPerMancanza)}) e adesso ${r.risoltiPerMancanza.length === 1 ? "l'archivio torna" : 'quegli archivi tornano'} con il file. Li' non c'e' niente da rifare.`);
  }
  // Qui non mancava niente: il primo controllo tornava. Mancava la CONFERMA che
  // quelle righe fossero entrate una volta sola, e il gestionale le ha tolte e
  // riscritte per esserne sicuro. Detta con l'altra frase sembrava l'incidente
  // del 24/09 - duecento righe perse - e mandava a cercare un guasto che non
  // c'era.
  if (r.risoltiPerDubbio.length) {
    parti.push(`Il gestionale non aveva la conferma che alcune righe fossero entrate una volta sola: le ha tolte e riscritte (${dove(r.risoltiPerDubbio)}) e adesso ${r.risoltiPerDubbio.length === 1 ? "l'archivio torna" : 'quegli archivi tornano'} con il file. Non mancava niente: li' non c'e' niente da rifare.`);
  }
  if (r.restati.length) {
    parti.push(`Il gestionale ha provato a rimettere a posto da solo delle righe (${dove(r.restati)}), ma ${r.restati.length === 1 ? "quell'archivio non torna" : 'quegli archivi non tornano'} ancora con il file.`);
  }
  if (r.nonContati.length) {
    parti.push(`Il gestionale ha provato a rimettere a posto da solo delle righe (${dove(r.nonContati)}), ma poi non si e' potuto contare ${r.nonContati.length === 1 ? "quell'archivio" : 'quegli archivi'}: non si sa se adesso torni con il file.`);
  }
  // Una frase sola: ci ha provato, ma non e' arrivato in fondo. Non si dice
  // "non ha potuto togliere quelle di troppo" subito dopo aver scritto quante
  // ne ha tolte: sullo stesso archivio erano due frasi che si smentivano.
  for (const a of r.aMeta) {
    parti.push(`Il gestionale ha provato a rimettere a posto da solo delle righe (${dettaglioRiparazione(a)}), ma non e' arrivato in fondo: ${a.motivo}.`);
  }
  // Ci ha provato e ha toccato l'archivio senza rimettere a posto niente: il
  // buco l'ha fatto il gestionale adesso, e va detto per non far credere che
  // fosse gia' cosi'. Si dice QUANTE righe ha tolto: fra gli ordini rimessi a
  // posto ci sono quasi sempre quelli che in archivio non avevano nessuna riga,
  // e la frase intera se le prendeva tutte.
  for (const a of r.tentata) {
    parti.push(a.righe > 0
      ? `Il gestionale ha provato a rimettere a posto da solo ${a.nome}: ha tolto ${formatIntero(a.righe)} ${a.righe === 1 ? 'riga' : 'righe'} e non e' riuscito a riscriverle. Quelle le ha tolte il gestionale adesso; le altre che mancassero non erano mai entrate.`
      : `Il gestionale ha provato a rimettere a posto da solo ${a.nome}: ha chiesto di togliere delle righe e non e' riuscito a riscriverle.`);
  }
  // La cancellazione e' partita e la risposta non e' tornata: non si dice "ho
  // tolto" e non si dice "non ho toccato niente". Si dice com'e'. E i numeri si
  // promettono solo dove ci sono: su un archivio che il gestionale dichiara di
  // non aver contato, "i numeri qui sotto sono quelli di adesso" e' falso, e si
  // leggeva nella stessa riga di "non si e' riusciti a contare questo archivio".
  if (r.incertaConNumeri.length) {
    parti.push(`Il gestionale ha chiesto di togliere delle righe da ${r.incertaConNumeri.join(', ')} e non ha saputo come sia andata: ha ricontato l'archivio, i numeri qui sotto sono quelli di adesso.`);
  }
  if (r.incertaSenzaNumeri.length) {
    parti.push(`Il gestionale ha chiesto di togliere delle righe da ${r.incertaSenzaNumeri.join(', ')} e non ha saputo come sia andata: ha provato a ricontare l'archivio e non ci e' riuscito, quindi non si sa nemmeno quante righe ci siano adesso.`);
  }
  // Non ci ha nemmeno provato, ed e' un'altra cosa: si dice, altrimenti chi
  // legge crede che il gestionale abbia fatto tutto il possibile. Gli archivi
  // di cui si e' gia' detto qui sopra ("ci ha provato ma non e' arrivato in
  // fondo") non si ripetono.
  if (r.nonFatta.length) {
    parti.push(`Il gestionale non ha provato a rimettere a posto ${r.nonFatta.length === 1 ? "l'archivio" : 'gli archivi'} ${r.nonFatta.map(x => `${x.nome} (${x.motivo})`).join(', ')}.`);
  }
  if (mancanti) {
    const quali = (mancanti.archivi || []).map(descriviArchivioSbagliato);
    parti.push(`Attenzione: in archivio mancano ${formatIntero(mancanti.righe_mancanti)} righe su ${formatIntero(mancanti.ordini)} ordini. ${quali.join('. ')}.`);
    parti.push(`Quelle righe non entrano in nessun conto. Ricarica lo stesso file, senza rifiltrarlo: il caricamento svuota gli archivi e li riscrive.${eIRicalcoli}`);
  }
  if (doppioni) {
    const quali = (doppioni.archivi || []).map(descriviArchivioSbagliato);
    parti.push(`Attenzione: in archivio ci sono ${formatIntero(doppioni.righe_in_piu)} righe di troppo, entrate due volte. ${quali.join('. ')}.`);
    parti.push(`I pesi di quelle righe adesso vengono contati doppi. Ricarica lo stesso file, senza rifiltrarlo: il caricamento svuota gli archivi e li riscrive, e le righe di troppo spariscono.${eIRicalcoli}`);
  }
  // Il percorso che NON e' quello delle primarie: non ci sono gli ordini, c'e'
  // solo il totale. Prima la finestra lo diceva e questa riga restava vuota:
  // chi chiudeva la finestra non aveva piu' niente da leggere.
  if (disallineamento && !doppioni && !mancanti) {
    const dentro = formatIntero(disallineamento.archivio);
    const nelFile = formatIntero(disallineamento.file);
    // "IL FILE NE PORTA N" SI DICE SOLO SE N E' DAVVERO DEL FILE. Con lo storico
    // conservato dentro, quel numero comprende righe che il file non contiene, e
    // la frase che spiega il guasto diventava lei stessa sbagliata. Quando c'e'
    // dello storico si dicono i due numeri separati.
    const quante = disallineamento.storico > 0
      ? `il file piu' lo storico conservato ne fanno ${nelFile} (di cui ${formatIntero(disallineamento.storico)} di storico)`
      : `il file ne porta ${nelFile}`;
    parti.push(disallineamento.archivio > disallineamento.file
      ? `Attenzione: in archivio ci sono ${dentro} righe e ${quante}: qualcosa e' entrato due volte e quei pesi adesso si contano doppi.`
      : `Attenzione: in archivio ci sono ${dentro} righe e ${quante}: quelle che mancano non entrano in nessun conto.`);
    parti.push(`Ricarica lo stesso file, senza rifiltrarlo: il caricamento svuota l'archivio e lo riscrive.${eIRicalcoli}`);
  }
  if (storicoNonTorna) {
    // Non e' una riga da riparare e non e' una riga da ricaricare con lo stesso
    // file: quelle righe il file non le ha. Si dice il rimedio vero, che e' uno
    // solo e lo puo' fare solo chi esporta dal portale.
    // Non si dice "ordini terminati": lo storico conserva anche gli ordini in
    // stato "eseguito", e qui si parla di righe che non ci sono piu' - chiamarle
    // di un ordine terminato manda a cercare la riga sbagliata. E singolare e
    // plurale si dicono come si parla: "manca 1 riga su 1 ordine".
    const quanteRighe = `${formatIntero(storicoNonTorna.righe)} ${storicoNonTorna.righe === 1 ? 'riga' : 'righe'}`;
    const quantiOrdini = `${formatIntero(storicoNonTorna.ordini)} ${storicoNonTorna.ordini === 1 ? 'ordine' : 'ordini'}`;
    parti.push(`Attenzione: lo storico conservato non torna. ${storicoNonTorna.righe === 1 ? 'Manca' : 'Mancano'} ${quanteRighe} su ${quantiOrdini} degli anni prima, che il file non contiene: il gestionale non puo' rimetterle da solo. L'unico rimedio e' ricaricare il file completo dal primo anno.`);
  }
  if (nonVerificato) {
    const instabili = nonVerificato.instabili || [];
    const incoerenti = nonVerificato.incoerenti || [];
    const nonConfermati = nonVerificato.non_confermati || [];
    const soloNonContati = archiviSenzaConteggio(nonVerificato);
    // Quattro cose diverse, e nessuna si dice al posto di un'altra: il
    // conteggio che non e' riuscito, quello che non si e' fermato su un numero,
    // quello che smentisce le scritture confermate e le righe in sospeso.
    if (nonVerificato.non_contato && soloNonContati.length) {
      parti.push(`Non si e' riusciti a contare ${soloNonContati.join(', ')} dopo la scrittura: non si sa se le righe ci siano tutte e una volta sola.`);
    } else if (nonVerificato.non_contato && !archiviConFraseLoro(nonVerificato).length) {
      parti.push("Non si e' riusciti a contare l'archivio dopo la scrittura: non si sa se le righe ci siano tutte e una volta sola.");
    }
    if (incoerenti.length) {
      parti.push(`${incoerenti.join(', ')} ${incoerenti.length === 1 ? 'ha risposto' : 'hanno risposto'} con meno righe di quante il gestionale ne ha scritte davvero: la lettura non e' affidabile, e su un conteggio cosi' non si dichiara niente, ne' che l'archivio e' a posto ne' quante righe manchino.`);
    }
    if (nonConfermati.length) {
      // NON E' "MANCANO DELLE RIGHE" E NON E' "E' TUTTO A POSTO": di quegli
      // ordini il gestionale non sa quante righe siano entrate, perche' la
      // scrittura che le portava non e' stata confermata e la riparazione non
      // e' riuscita a rifarle. Una lettura che dice "tornano" non lo puo'
      // smentire ne' confermare: e' proprio cio' che direbbe una lettura in
      // ritardo, ed e' cosi' che si chiudeva "successo" sopra i pesi doppi.
      parti.push(`Di ${nonConfermati.map(x => `${formatIntero(x.ordini)} ordini di ${x.nome}`).join(', ')} non si e' potuto confermare che le righe siano entrate una volta sola: la scrittura non ha risposto e il gestionale non e' riuscito a rifarle da solo. Il conteggio da solo non basta a dirlo.`);
    }
    if (instabili.length) {
      // Senza "dopo la riparazione": il conteggio si puo' fermare male anche
      // PRIMA che la riparazione parta - anzi, se non si ferma la riparazione
      // non parte affatto - e chi leggeva quella frase andava a cercare che
      // cosa avesse toccato il gestionale, che non aveva toccato niente.
      parti.push(`${instabili.join(', ')} ${instabili.length === 1 ? 'ha dato' : 'hanno dato'} due numeri diversi uno dopo l'altro: finche' il conteggio non si ferma su un numero non si puo' dire che l'archivio sia a posto, e non lo si dice.`);
    }
    if (nonVerificato.righe_incerte > 0) {
      parti.push(`${formatIntero(nonVerificato.righe_incerte)} righe sono rimaste in sospeso: non si sapeva se fossero entrate e non sono state riscritte, per non farne entrare due volte le stesse.`);
    }
    if (!doppioni && parti.length) parti.push('Ricarica lo stesso file, senza rifiltrarlo, e controlla che questa riga non ricompaia.');
  }
  if (!parti.length) return null;
  // Chi ricarica trova una finestra rossa che chiede una conferma: e' il
  // controllo che si accorge quando un archivio e' gia' stato svuotato. Non
  // dirlo qui voleva dire mandare la gente a ricaricare e farle trovare
  // "Caricamento bloccato" senza nessun preavviso. Si dice solo quando sara'
  // vero: se non si e' riusciti a contare gli ordini si dice "potrebbe".
  if (dati.conferma_al_prossimo === true) {
    parti.push("Quando lo ricarichi si aprira' una finestra che chiede una conferma prima di partire: e' normale dopo un caricamento come questo, leggila e conferma.");
  } else if (dati.conferma_al_prossimo === null) {
    parti.push("Quando lo ricarichi potrebbe aprirsi una finestra che chiede una conferma prima di partire: e' normale dopo un caricamento come questo, leggila e conferma.");
  }
  // Lo stesso colore della finestra: "in archivio mancano 250 righe" era rosso
  // nella finestra e ambra sotto la scheda, due colori per la stessa notizia.
  return { classe: doppioni || mancanti || disallineamento || storicoNonTorna ? 'text-red-700' : 'text-amber-700', testo: parti.join(' ') };
}

/**
 * Gli avvisi di un caricamento riuscito che meritano la finestra, non la sola
 * riga piccola sotto la scheda. Sta qui e non nel componente perche' e' una
 * regola, non un pezzo di grafica: UploadResultDialog la richiama e le prove la
 * controllano.
 *
 * Ci sono dentro anche le righe di troppo, le righe mancanti e l'archivio non
 * contato: mancavano, e un caricamento che ferma tutto il gestionale finche' non
 * si ricarica si annunciava con otto parole in ambra sotto la scheda.
 */
export function avvisiDaMostrare(data) {
  if (!data) return null;
  const avvisi = {
    avviso_colonne: data.avviso_colonne && data.avviso_colonne.length ? data.avviso_colonne : null,
    avviso_date: data.avviso_date || null,
    avviso_calo: data.avviso_calo || null,
    avviso_disallineamento: data.avviso_disallineamento || null,
    avviso_doppioni: data.avviso_doppioni || null,
    avviso_mancanti: data.avviso_mancanti || null,
    avviso_non_verificato: data.avviso_non_verificato || null,
    // Lo storico conservato che non torna APRE la finestra, al contrario dello
    // storico conservato e basta: qui delle righe degli anni prima non ci sono
    // piu', il file non le contiene e la riparazione non puo' rimetterle. E'
    // l'unico avviso a cui non c'e' rimedio automatico, e il rimedio - ricaricare
    // il file completo dal primo anno - lo puo' fare solo chi lavora.
    avviso_storico_non_torna: data.avviso_storico_non_torna || null,
    // Una riparazione che non si e' nemmeno provata va detta: e' il caso in cui
    // il rimedio e' solo ricaricare il file, e chi legge deve saperlo.
    riparazione_non_fatta: data.riparazione_non_fatta || null,
  };
  if (!Object.values(avvisi).some(Boolean)) return null;
  return {
    type: 'warning', ...avvisi,
    // Gli ordini "eseguito" NON aprono la finestra da soli: non c'e' niente da
    // fare e non c'e' niente da rifare, sono ordini che a portale aspettano che
    // qualcuno prema Chiudi. Sui dati veri ce n'e' quasi sempre almeno uno,
    // quindi un caricamento perfettamente riuscito apriva comunque una finestra
    // intitolata "Caricamento completato con avvisi", e la stessa notizia usciva
    // in tre posti. Quando la finestra si apre per altro si leggono anche qui.
    avviso_eseguiti: data.avviso_eseguiti || null,
    // Lo storico conservato e' nella stessa identica situazione: dalle primarie
    // in poi c'e' a OGNI caricamento, e da solo aprirebbe ogni volta una finestra
    // intitolata "Caricamento completato con avvisi" su un caricamento perfetto.
    // Non e' un problema, e' una notizia: si legge quando la finestra si apre per
    // altro. (L'utente lo aveva pubblicato fra quelli che la aprono: se preferisce
    // rivederlo sempre, basta spostare questa riga sopra, dentro "avvisi".)
    storico_conservato: data.storico_conservato || null,
    // Questi tre NON aprono la finestra da soli - una riparazione riuscita non
    // ha niente da far fare a nessuno - ma quando la finestra si apre per altro
    // devono esserci, e la finestra li DISEGNA (riparazioniDaDire). Senza
    // avviso_riparazione la finestra scriveva "il gestionale non ha provato a
    // rimettere a posto le righe da solo" di un archivio che aveva appena
    // riparato e rimesso a 450 righe su 450: la riga sotto la scheda diceva una
    // cosa e la finestra, due centimetri sopra, quella opposta. Stessa cosa per
    // "ha tolto le righe sbagliate e non e' riuscito a riscriverle", che dice a
    // chi legge che il buco l'ha fatto il gestionale adesso.
    avviso_riparazione: data.avviso_riparazione || null,
    riparazione_tentata: data.riparazione_tentata || null,
    riparazione_incerta: data.riparazione_incerta || null,
    // Se dopo questo tipo di caricamento c'e' qualcosa da ricalcolare: per
    // ordini non dichiarati e dichiarazioni di trattamento non c'e' nessun
    // modulo collegato, e dirgli che "non sono stati ricalcolati" lo manderebbe
    // a cercare qualcosa che non esiste.
    con_ricalcoli: !data.tipo_file || !!RICALCOLI[data.tipo_file],
    ultimo_errore: data.ultimo_errore,
  };
}

/**
 * Il titolo della finestra che si apre a fine caricamento.
 *
 * Sta qui, con le altre frasi, perche' e' una regola e le prove la controllano.
 * Un collega che sta caricando adesso NON e' un rischio di perdita dati: non
 * c'e' niente da forzare e non c'e' niente da temere, si aspetta e basta. Il
 * titolo dipendeva dal solo 409, quindi la prima cosa che leggeva chi doveva
 * solo aspettare il turno era "Caricamento bloccato: rischio perdita dati".
 */
export function titoloAvviso(stato) {
  if (!stato) return null;
  if (stato.type !== 'error') {
    // Un caricamento con righe di troppo, righe mancanti o un archivio che non
    // torna con il file NON e' "completato": ferma i moduli collegati finche'
    // non si ricarica. Il titolo diceva il contrario del riquadro rosso che
    // stava due righe sotto, ed e' la prima cosa che si legge.
    //
    // avviso_disallineamento e' l'unico segnale che arriva dal percorso che non
    // e' quello delle primarie: li' un caricamento che aveva perso duecento
    // righe su 450 apriva una finestra intitolata "Caricamento completato".
    if (stato.avviso_doppioni || stato.avviso_mancanti || stato.avviso_disallineamento) {
      return "Caricamento da rifare: l'archivio non torna con il file";
    }
    // "Non torna con il file" e' un'affermazione, e qui non si puo' fare: il
    // conteggio non e' riuscito, oppure non si e' fermato su un numero, oppure
    // ha smentito le scritture confermate. In tutti e tre i casi il gestionale
    // ha appena detto di NON SAPERE com'e' messo l'archivio, e nelle prove
    // l'archivio era a posto. Il titolo e' la prima riga che si legge: dica la
    // stessa cosa che dice la riga sotto.
    if (stato.avviso_non_verificato) return "Caricamento da rifare: l'archivio non si e' potuto verificare";
    // LO STORICO CONSERVATO CHE NON TORNA NON SI RIFA' COL FILE: quelle righe il
    // file non le porta, e "da rifare" manderebbe a ricaricare per niente. Il
    // titolo dice che cosa e' successo; il rimedio vero - l'export completo dal
    // primo anno - lo dice il riquadro rosso. Prima questo caso apriva una
    // finestra intitolata "Caricamento completato con avvisi" sopra un riquadro
    // rosso che diceva di aver perso delle righe.
    if (stato.avviso_storico_non_torna) return 'Lo storico conservato non torna: mancano righe degli anni prima';
    return 'Caricamento completato con avvisi';
  }
  // Senza lettere accentate, come in tutti i file .js: qui il titolo si scrive
  // una volta sola e lo mostra il JSX cosi' com'e'.
  if (stato.caricamento_in_corso) return 'Aspetta: un altro caricamento in corso';
  if (stato.status === 409) return 'Caricamento bloccato: rischio perdita dati';
  return stato.error === 'Formato file non valido' ? 'Formato file non valido' : 'Caricamento non riuscito';
}

/**
 * Se quella finestra e' un allarme rosso o solo un avviso da leggere.
 * Righe di troppo o righe mancanti sono un allarme anche quando la risposta e'
 * arrivata bene: i pesi si contano doppi o non si contano affatto. Vale anche
 * per l'archivio che non torna col file sul percorso che non e' quello delle
 * primarie (avviso_disallineamento), dove righe di troppo e righe mancanti non
 * si sanno per ordine e quello e' l'unico segnale che arriva.
 *
 * L'archivio che non si e' potuto contare resta ambra: li' non si sa se un
 * guasto ci sia, e il rosso direbbe piu' di quello che si sa.
 */
export const avvisoRosso = (stato) => !!stato
  && ((stato.type === 'error' && !stato.caricamento_in_corso)
    || !!(stato.avviso_doppioni || stato.avviso_mancanti || stato.avviso_disallineamento
      || stato.avviso_storico_non_torna));

/**
 * Gli ordini in stato "eseguito" a parole, per la finestra e per le pagine.
 * Rete e ACI separati, MAI sommati (regola 3): prima si apriva con un numero
 * solo - "3 ordini hanno tutti i dati" - e solo dopo si elencavano i canali,
 * cioe' si dava proprio la somma che in questo gestionale non si fa mai.
 * Niente se non ce ne sono.
 */
export function testoEseguiti(eseguiti) {
  if (!eseguiti) return null;
  const quote = [['Rete', eseguiti.rete], ['ACI', eseguiti.aci]]
    .filter(([, q]) => q && q.ordini > 0)
    .map(([nome, q]) => `${nome}: ${formatIntero(q.ordini)} ${q.ordini === 1 ? 'ordine' : 'ordini'}${q.kg ? ` (${formatIntero(q.kg)} kg)` : ''}`);
  if (!quote.length) return null;
  return `Ci sono ordini che hanno tutti i dati ma a portale non e' stato premuto Chiudi: finche' resta cosi' non entrano in nessun conto (raccolto, giacenze, report, copertura del target, fatturazione). ${quote.join(' · ')}.`;
}

/**
 * Le conferme gia' date per un tipo di file, piu' quella che il server sta
 * chiedendo adesso.
 *
 * Sta qui e non dentro la pagina perche' e' una regola, non grafica, e perche'
 * le prove devono poter guidare il giro COME LO GUIDA LA PAGINA. I controlli
 * anti-regressione sono due e possono scattare insieme: mandando una conferma
 * sola, l'ultima, ognuna spegneva un controllo e riaccendeva l'altro, e il
 * pulsante "Forza caricamento" non arrivava mai a destinazione - si girava in
 * tondo all'infinito proprio nel caso per cui quel pulsante esiste. Si tengono
 * tutte e si mandano tutte insieme; il server (conferme in
 * importaBlocco/entry.ts) accetta l'elenco. Il vecchio "true" vale per i
 * percorsi che hanno un controllo solo.
 *
 * Le conferme date valgono per QUEL file: scegliendone uno nuovo si azzerano,
 * altrimenti una conferma data ieri varrebbe domani.
 */
export function confermeAccumulate(giaDate, chiesta) {
  const elenco = Array.isArray(giaDate)
    ? giaDate
    : (giaDate === undefined || giaDate === null || giaDate === false ? [] : [giaDate]);
  return [...new Set([...elenco, chiesta || true])];
}

/** Una riga da mostrare sotto il caricamento: cosa si e' aggiornato e cosa no. */
export function testoRicalcoli(esiti) {
  if (!esiti) return null;
  if (esiti.in_corso) return { classe: 'text-muted-foreground', testo: 'Aggiornamento dei moduli collegati in corso…' };
  if (!esiti.length) return null;
  const falliti = esiti.filter(e => !e.ok);
  // gli avvisi dei ricalcoli riusciti, in coda: si leggono anche quando e' tutto aggiornato
  const avvisi = esiti.filter(e => e.ok && e.avviso).map(e => ` ${e.avviso}`).join('');
  if (!falliti.length) return { classe: avvisi ? 'text-amber-700' : 'text-green-700', testo: `Aggiornati: ${esiti.map(e => e.nome).join(', ')}.${avvisi}` };
  // Lo stesso motivo per tutti (un caricamento aperto) si dice una volta sola.
  const motivi = [...new Set(falliti.map(e => e.errore))];
  const riusciti = esiti.filter(e => e.ok).map(e => e.nome);
  const testo = motivi.length === 1 && falliti.length > 1
    ? `Non aggiornati: ${falliti.map(e => e.nome).join(', ')} (${motivi[0]}).`
    : `Non aggiornati: ${falliti.map(e => `${e.nome} (${e.errore})`).join('; ')}.`;
  return {
    classe: 'text-amber-700',
    testo: `${testo}${riusciti.length ? ` Aggiornati: ${riusciti.join(', ')}.` : ''} Si rifanno al prossimo caricamento o dal modulo.${avvisi}`,
  };
}
