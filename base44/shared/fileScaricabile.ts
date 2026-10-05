// L'indirizzo da cui una funzione scarica un file caricato dall'app.
//
// PERCHE' ESISTE. Fino al 30/09/2026 i file dei caricamenti - elenco PDR,
// secondarie, richieste ECT e tutti gli export del portale del Caricamento Dati -
// salivano con UploadFile, cioe' in area PUBBLICA. L'assistenza della piattaforma
// ha confermato che cosa vuol dire: "il file_url funziona per chiunque abbia il
// link", per sempre, e non esiste nessun modo di cancellare un file caricato, ne'
// dall'SDK ne' dal pannello. Toglierlo dai nostri record lo nasconde dentro
// l'app, ma il link continua a funzionare.
//
// Quei file sono documenti aziendali: ragioni sociali, indirizzi dei punti di
// raccolta, pesi, prezzi, numeri di formulario. Regola dell'utente, 30/09/2026:
// "fai in modo che documenti aziendali non girino per il web, questa cosa della
// sicurezza e della privacy e' molto importante, anzi stringente".
//
// Quindi da qui in avanti si carica SOLO con UploadPrivateFile. Un file privato
// non ha un indirizzo suo: si apre soltanto con un link firmato che scade (fra i
// 60 e i 3600 secondi). Chi deve leggerlo se lo fa firmare al momento, lo legge e
// il link muore da solo. Non serve cancellare niente, ed e' esattamente per
// questo che e' la difesa giusta su una piattaforma che non sa cancellare.
//
// PRIVATO VUOL DIRE "FUORI DALL'APP", NON "AL SICURO DA TUTTI" (05/10/2026).
// L'assistenza della piattaforma ha precisato che la firma non e' controllata:
// «Any signed-in user of your app who holds a private file_uri can call
// CreateFileSignedUrl with it and get a working signed URL. Signing isn't checked
// against that user, or against the RLS of the record that holds the reference».
// Il file_uri e' quindi la chiave del documento per qualunque utente collegato, e
// non esiste un'impostazione per riservare la firma al server. La difesa verso
// l'esterno resta intera - un indirizzo non c'e' e non si puo' indovinare - ma
// dentro l'app il file vale quanto l'archivio che ne tiene il riferimento: per
// questo il file_uri non si manda al browser e i documenti riservati si aprono
// dalla funzione apriFile. La regola, archivio per archivio, sta in
// shared/fileRiservato.ts.
//
// I file caricati PRIMA di oggi restano pubblici e non si possono richiamare:
// vanno fatti rimuovere a mano dal team della piattaforma. Finche' ci sono, i
// loro record portano ancora un file_url, e questa funzione continua a
// accettarlo: un caricamento vecchio si deve poter ancora rileggere.

const testo = (v) => String(v ?? '').trim();

/** Vero se questo riferimento e' un file privato (si apre solo firmato). */
export const ePrivato = (rif) => !!testo(rif && rif.file_uri);

// === DA DOVE UNA FUNZIONE PUO' SCARICARE, E DA DOVE NO ===
//
// Trovato dalla scansione di sicurezza della piattaforma il 02/10/2026, gravita'
// alta: importEcotyreFile prendeva file_url dal CORPO della richiesta e lo
// passava a fetch senza guardarlo. Due danni, non uno.
//
// Il primo: il server scaricava qualunque indirizzo gli si dicesse, compresi
// quelli che dal browser non si raggiungono - servizi interni, indirizzi di
// metadati della macchina. E' una SSRF, e la poteva fare un utente di livello
// operatore_base, cioe' il livello di lavoro normale, non un amministratore.
//
// Il secondo e' peggio per noi: quella funzione scrive negli archivi con
// asServiceRole. Un operatore poteva ospitare lui un Excel con la firma giusta,
// passarne l'indirizzo con conferma_forzatura, e farsi riscrivere i TERMINATI
// RETE e ACI con le righe che voleva. Cioe' i dati su cui si fatturano i
// fornitori e si fanno le dichiarazioni al consorzio.
//
// Un indirizzo pubblico vero di questa app ha una forma sola, verificata su un
// elenco reale di file caricati:
//   https://media.base44.com/files/public/<idApplicazione>/<impronta>_<nome>
// Tutto il resto non e' un file nostro, e non si scarica.
//
// new URL() fa il lavoro difficile: normalizza i percorsi (quindi "..\.." non
// scappa da /files/public/) e legge l'host vero, non quello che sembra - cosi'
// "https://media.base44.com@altro.sito/x" risulta per quello che e', un
// indirizzo di altro.sito.
export const ORIGINE_FILE_PUBBLICI = 'https://media.base44.com';
const PERCORSO_FILE_PUBBLICI = '/files/public/';

/**
 * Vero se questo indirizzo e' un file dell'area pubblica della piattaforma, cioe'
 * uno dei nostri caricamenti vecchi. Falso per tutto il resto, compreso quello
 * che gli somiglia.
 */
export function eIndirizzoDiArchivio(url) {
  const s = testo(url);
  if (!s) return false;
  let u;
  try { u = new URL(s); } catch { return false; }
  if (u.protocol !== 'https:') return false;
  if (u.origin !== ORIGINE_FILE_PUBBLICI) return false;
  return u.pathname.startsWith(PERCORSO_FILE_PUBBLICI);
}

/** Perche' quell'indirizzo non si scarica, da scrivere nella risposta. */
export const MOTIVO_INDIRIZZO = 'L\'indirizzo del file non e\' quello di un file caricato in questa applicazione.'
  + ' Un caricamento nuovo passa per il file privato (file_uri) e si apre con un link firmato:'
  + ' un indirizzo qualunque non si scarica, perche\' il server non deve andare dove gli si dice di andare.';

/**
 * IL FILE DI UNA RICHIESTA SI PRENDE SOLO COME file_uri.
 *
 * Un indirizzo non si accetta da chi chiama: e' la falla che la scansione ha
 * trovato il 02/10/2026, e la strada per chiuderla e' libera, perche' TUTTI i
 * punti di caricamento del gestionale mandano gia' soltanto file_uri - il
 * Caricamento Dati, le secondarie, i PDR e le richieste ECT (verificato uno per
 * uno). Un file_url nel corpo oggi non arriva da nessuna parte: se arriva, non
 * viene da noi.
 *
 * Torna { rif, errore }: se errore non e' null, chi chiama risponde e si ferma.
 */
export function riferimentoDalCorpo(body) {
  const uri = testo(body && body.file_uri);
  if (uri) return { rif: { file_uri: uri, file_url: '' }, errore: null };
  const url = testo(body && body.file_url);
  if (url) return { rif: null, errore: MOTIVO_INDIRIZZO };
  return { rif: null, errore: '' };
}

/**
 * L'indirizzo da cui scaricare, a partire da { file_uri } (privato, si firma) o
 * da { file_url } (pubblico, storico). Stringa vuota se non c'e' ne' l'uno ne'
 * l'altro: chi chiama lo tratta come "file mancante", non come errore di rete.
 *
 * secondi e' quanto vale il link firmato. Si tiene largo perche' i file degli
 * export sono grossi e lo scaricamento si ritenta: un link scaduto a meta' di un
 * ritentativo farebbe fallire un caricamento che sarebbe andato bene.
 */
export async function urlScaricabile(base44, rif, secondi = 3600) {
  const uri = testo(rif && rif.file_uri);
  if (!uri) {
    // Un file_url si accetta solo se e' davvero un file della nostra area
    // pubblica. Vale per i caricamenti vecchi, che si devono poter ancora
    // rileggere; qualunque altro indirizzo torna vuoto, e chi chiama lo tratta
    // come "file mancante" (02/10/2026).
    const url = testo(rif && rif.file_url);
    return eIndirizzoDiArchivio(url) ? url : '';
  }
  const core = base44.asServiceRole.integrations.Core;
  const { signed_url } = await core.CreateFileSignedUrl({ file_uri: uri, expires_in: secondi });
  return testo(signed_url);
}

/**
 * Il riferimento da salvare sul record del caricamento. Un file privato si
 * ricorda con il suo file_uri; il campo file_url resta vuoto, cosi' guardando un
 * record si vede subito se quel file e' pubblico (vecchio) o privato (nuovo).
 */
export function riferimentoDaSalvare(rif) {
  const uri = testo(rif && rif.file_uri);
  return uri ? { file_uri: uri, file_url: '' } : { file_uri: '', file_url: testo(rif && rif.file_url) };
}
