// Il numero della terziaria scritto in alto sull'allegato VII (22/09/2026).
//
// A portale ogni allegato VII si carica dentro la sua terziaria: il file si
// rinomina col numero (TERxxxxxxxx.pdf) e il numero si scrive anche sulla prima
// pagina, in alto a destra, cosi' si riconosce anche stampato. Il PDF originale
// non si tocca: la scritta va su una copia.
//
// Se il PDF non si lascia aprire (protetto, danneggiato, pagine strane) la copia
// resta quella senza scritta: meglio la cartella completa che un file mancante.
// Chi chiama lo viene a sapere dal campo "timbrato".

const MARGINE = 18;

/**
 * @param {Uint8Array} bytes  il PDF originale
 * @param {string} testo      quello da scrivere, per esempio "TER26154141"
 * @returns {{ bytes: Uint8Array, timbrato: boolean, errore?: string }}
 */
export async function timbraPdf(bytes, testo) {
  const scritta = String(testo || '').trim();
  if (!scritta) return { bytes, timbrato: false, errore: 'nessun numero da scrivere' };
  try {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pagine = doc.getPages();
    if (!pagine.length) return { bytes, timbrato: false, errore: 'il PDF non ha pagine' };
    const carattere = await doc.embedFont(StandardFonts.HelveticaBold);
    const corpo = 14;
    const pagina = pagine[0];
    const { width, height } = pagina.getSize();
    const larghezza = carattere.widthOfTextAtSize(scritta, corpo);
    const alto = carattere.heightAtSize(corpo);
    const x = Math.max(MARGINE, width - MARGINE - larghezza);
    const y = Math.max(MARGINE, height - MARGINE - alto);
    // un riquadro bianco sotto la scritta: gli allegati sono scansioni e il nero
    // su nero non si leggerebbe
    pagina.drawRectangle({
      x: x - 4, y: y - 3, width: larghezza + 8, height: alto + 6,
      color: rgb(1, 1, 1), borderColor: rgb(0, 0, 0), borderWidth: 0.5,
    });
    pagina.drawText(scritta, { x, y, size: corpo, font: carattere, color: rgb(0, 0, 0) });
    return { bytes: await doc.save({ useObjectStreams: false }), timbrato: true };
  } catch (e) {
    return { bytes, timbrato: false, errore: e && e.message ? e.message : String(e) };
  }
}
