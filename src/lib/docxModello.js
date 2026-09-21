// Il documento Word di un contratto, letto e riscritto nel browser.
//
// Un .docx e' uno zip di file XML. Per generare il contratto dell'anno nuovo si
// parte dal modello - il contratto dell'anno prima con i valori sostituiti da
// segnaposto fra doppie graffe - si rimpiazzano i segnaposto e si richiude lo
// zip. Il documento che esce e' un Word vero, con la sua impaginazione, le sue
// intestazioni e i suoi articoli: nessuno deve riscriverlo.
//
// L'insidia e' che Word spezza il testo in "run": un {{SEGNAPOSTO}} scritto a
// mano puo' finire diviso in tre pezzi, e cercarlo cosi' com'e' non lo trova.
// Prima di toccare qualunque cosa si uniscono quindi i run consecutivi dello
// stesso paragrafo. Sul contratto di raccolta 2026 servono cinque passate e il
// documento passa da 604 a 459 mila caratteri, tutti pezzi ricomposti.

import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';

// I file dentro il .docx che possono contenere testo da sostituire.
const PARTI = /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/;

const SEGNAPOSTO = /\{\{\s*([A-Z0-9_]+)\s*\}\}/g;

/**
 * Unisce i run consecutivi che hanno la STESSA formattazione: il testo non
 * cambia e nemmeno l'aspetto. Unire run con formattazione diversa faceva
 * perdere al secondo il suo stile - il grassetto di un titolo, il carattere
 * della carta intestata - e i documenti uscivano diversi dal modello.
 */
function unisciRunStessoStile(xml) {
  const RUN = /(<w:r(?: [^>]*)?>)\s*(<w:rPr>[\s\S]*?<\/w:rPr>)?\s*<w:t( [^>]*)?>([^<]*)<\/w:t>\s*<\/w:r>/g;
  let out = '';
  let ultimo = 0;
  let prec = null;
  const chiudi = () => {
    if (!prec) return;
    out += xml.slice(ultimo, prec.inizio);
    if (prec.fusi) {
      const preserva = prec.preserva || /^\s|\s$/.test(prec.t) ? ' xml:space="preserve"' : '';
      out += `${prec.apri}${prec.rPr}<w:t${preserva}>${prec.t}</w:t></w:r>`;
    } else out += xml.slice(prec.inizio, prec.fine);
    ultimo = prec.fine;
    prec = null;
  };
  for (const m of xml.matchAll(RUN)) {
    const [intero, apri, rPr = '', attr = '', t] = m;
    const inizio = m.index;
    const fine = inizio + intero.length;
    const preserva = /xml:space="preserve"/.test(attr);
    if (prec && /^\s*$/.test(xml.slice(prec.fine, inizio)) && prec.rPr === rPr) {
      prec.t += t; prec.fine = fine; prec.fusi = true; prec.preserva = prec.preserva || preserva;
      continue;
    }
    chiudi();
    prec = { inizio, fine, apri, rPr, t, preserva, fusi: false };
  }
  chiudi();
  return out + xml.slice(ultimo);
}

/** Unisce tutti i run consecutivi, qualunque sia lo stile: solo dove serve. */
function unisciRunTutti(xml) {
  const unaPassata = (x) => x.replace(
    /(<w:t)(?: [^>]*)?(>)([^<]*)<\/w:t>\s*<\/w:r>\s*<w:r(?: [^>]*)?>\s*(?:<w:rPr>[\s\S]*?<\/w:rPr>)?\s*<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g,
    (m, apri, chiudiTag, a, b) => `${apri} xml:space="preserve"${chiudiTag}${a}${b}</w:t>`,
  );
  let testo = xml;
  for (let i = 0; i < 12; i++) {
    const nuovo = unaPassata(testo);
    if (nuovo === testo) break;
    testo = nuovo;
  }
  return testo;
}

/**
 * Ricompone i segnaposto che Word ha spezzato in piu' run. Prima si uniscono
 * solo i run con lo stesso stile; se in un paragrafo resta un segnaposto
 * spezzato - Word a volte ne mette un pezzo in un run con una proprieta' in
 * piu' - allora, e solo in quel paragrafo, si uniscono tutti i run.
 */
function unisciRun(xml) {
  return unisciRunStessoStile(xml).replace(/<w:p(?: [^>]*)?>[\s\S]*?<\/w:p>/g, (p) => {
    const testo = p.replace(/<[^>]+>/g, '');
    const nelTesto = (testo.match(/\{\{\s*[A-Z0-9_]+\s*\}\}/g) || []).length;
    const interi = (p.match(/\{\{\s*[A-Z0-9_]+\s*\}\}/g) || []).length;
    return nelTesto > interi ? unisciRunTutti(p) : p;
  });
}

const scappa = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Il testo leggibile di una parte XML, per mostrare l'anteprima. */
export function testoDi(xml) {
  return xml
    .replace(/<w:p[ >]/g, '\n<w:p ')
    .replace(/<w:br[^>]*\/>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .split('\n').map(r => r.trim()).filter(Boolean).join('\n');
}

/**
 * Apre un modello .docx e dice che segnaposto contiene.
 * @returns { voci, parti, segnaposti, testo }
 */
export async function leggiModello(file) {
  const voci = unzipSync(new Uint8Array(await file.arrayBuffer()));
  if (!voci['word/document.xml']) {
    throw new Error('Questo non è un documento Word: dentro non c̀è word/document.xml.');
  }
  const parti = {};
  for (const nome of Object.keys(voci)) {
    if (!PARTI.test(nome)) continue;
    parti[nome] = unisciRun(strFromU8(voci[nome]));
  }
  const trovati = [];
  for (const xml of Object.values(parti)) {
    let m;
    SEGNAPOSTO.lastIndex = 0;
    while ((m = SEGNAPOSTO.exec(xml)) !== null) if (!trovati.includes(m[1])) trovati.push(m[1]);
  }
  return { voci, parti, segnaposti: trovati, testo: testoDi(parti['word/document.xml'] || '') };
}

/**
 * Genera il documento sostituendo i segnaposto e restituisce un Blob .docx.
 *
 * I segnaposto senza valore restano nel testo com'erano: meglio un documento in
 * cui si vede cosa manca che uno con dei buchi silenziosi. Chi chiama riceve
 * anche l'elenco di quelli rimasti vuoti.
 */
export function generaDocx(modello, valori) {
  const rimasti = new Set();
  const usati = new Set();
  const voci = { ...modello.voci };
  for (const [nome, xml] of Object.entries(modello.parti)) {
    const sostituito = xml.replace(SEGNAPOSTO, (intero, chiave) => {
      const v = valori[chiave];
      if (v === undefined || v === null || v === '') { rimasti.add(chiave); return intero; }
      usati.add(chiave);
      return scappa(v);
    });
    voci[nome] = strToU8(sostituito);
  }
  const zip = zipSync(voci, { level: 6 });
  return {
    blob: new Blob([zip], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
    segnaposti_vuoti: [...rimasti],
    segnaposti_usati: [...usati],
  };
}

/** Scarica un Blob con il nome dato. */
export function scarica(blob, nomeFile) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeFile;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Prepara un modello a partire da un contratto gia' scritto: sostituisce i
 * valori indicati con i loro segnaposto. Serve a trasformare il contratto
 * dell'anno scorso in un modello senza riscriverlo a mano in Word.
 *
 * @param {object} modello  quello che torna da leggiModello
 * @param {array}  regole   [{ testo, segnaposto }] il valore da cercare e il nome del segnaposto
 */
export function preparaModello(modello, regole) {
  const parti = {};
  const conteggi = {};
  for (const [nome, xml] of Object.entries(modello.parti)) {
    let testo = xml;
    for (const r of regole) {
      const cerca = String(r.testo || '').trim();
      if (!cerca) continue;
      const scappato = scappa(cerca).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const prima = testo;
      testo = testo.replace(new RegExp(scappato, 'g'), `{{${r.segnaposto}}}`);
      if (testo !== prima) conteggi[r.segnaposto] = (conteggi[r.segnaposto] || 0) + 1;
    }
    parti[nome] = testo;
  }
  const voci = { ...modello.voci };
  for (const [nome, xml] of Object.entries(parti)) voci[nome] = strToU8(xml);
  return {
    voci, parti, conteggi,
    blob: new Blob([zipSync(voci, { level: 6 })], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
  };
}
