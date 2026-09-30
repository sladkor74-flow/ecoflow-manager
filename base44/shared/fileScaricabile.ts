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
// I file caricati PRIMA di oggi restano pubblici e non si possono richiamare:
// vanno fatti rimuovere a mano dal team della piattaforma. Finche' ci sono, i
// loro record portano ancora un file_url, e questa funzione continua a
// accettarlo: un caricamento vecchio si deve poter ancora rileggere.

const testo = (v) => String(v ?? '').trim();

/** Vero se questo riferimento e' un file privato (si apre solo firmato). */
export const ePrivato = (rif) => !!testo(rif && rif.file_uri);

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
  if (!uri) return testo(rif && rif.file_url);
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
