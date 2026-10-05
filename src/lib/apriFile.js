// Aprire un file caricato: il link lo chiede il server, non il browser.
//
// Fino al 05/10/2026 ogni pagina firmava da sola, chiamando
// CreateFileSignedUrl col file_uri che si era letta dal record. L'assistenza
// della piattaforma ha spiegato perche' non va bene: «Any signed-in user of your
// app who holds a private file_uri can call CreateFileSignedUrl with it and get a
// working signed URL. Signing isn't checked against that user, or against the RLS
// of the record that holds the reference». Cioe' il file_uri e' la chiave del
// documento per chiunque sia collegato, e nasconderne il pulsante non serve a
// niente. Non c'e' nemmeno un'impostazione per riservare la firma al server, e i
// link firmati continuano a funzionare dal browser anche con la protezione delle
// integrazioni accesa.
//
// Quindi il file_uri non arriva piu' nel browser e il link si chiede alla funzione
// apriFile, che guarda il record, controlla chi sta chiedendo e firma con
// asServiceRole. Il permesso di ogni archivio sta scritto in un posto solo:
// base44/shared/fileRiservato.ts.
import { base44 } from '@/api/base44Client';

/**
 * L'indirizzo temporaneo da cui leggere il file di quel record (vale 300
 * secondi). Lancia un errore col messaggio della funzione se non si puo' aprire.
 */
export async function linkFile(entita, id) {
  const res = await base44.functions.invoke('apriFile', { entita, id });
  const url = res && res.data && res.data.url;
  if (!url) throw new Error((res && res.data && res.data.error) || 'La piattaforma non ha restituito un indirizzo per questo file.');
  return url;
}

/** Il motivo da mostrare a video quando l'apertura non riesce. */
export const motivoApertura = (e) =>
  (e && e.response && e.response.data && e.response.data.error) || (e && e.message) || String(e);
