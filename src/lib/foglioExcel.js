// Lettura di un foglio Excel nel browser, per i moduli che si aggiornano
// caricando un file (Omologhe, Dichiarazioni RENTRI).
//
// Il file resta sul computer di chi lo carica. Si legge un foglio solo, senza
// formule e senza testo formattato: i file di gestione pesano qualche megabyte
// e altrimenti la pagina si blocca.

export const testo = (v) => String(v ?? '').trim();

const due = (n) => String(n).padStart(2, '0');

/**
 * Converte una cella in data aaaa-mm-gg. Le date si leggono dal numero seriale
 * che Excel scrive davvero nel file, non da un oggetto Date: costruire una data
 * porta con se' il fuso orario del computer e fa slittare il giorno.
 */
export const daData = (XLSX) => (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    return d && d.y ? `${d.y}-${due(d.m)}-${due(d.d)}` : null;
  }
  if (v instanceof Date) return `${v.getFullYear()}-${due(v.getMonth() + 1)}-${due(v.getDate())}`;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) return `${m[3]}-${due(m[2])}-${due(m[1])}`;
  return null;
};

/** Vero/falso da una cella: caselle di spunta, "sì", "x", "vero". */
export const siNo = (v) => v === true || /^(si|sì|x|vero|true|ok|1)$/i.test(testo(v));

/** Apre il foglio il cui nome corrisponde a `cerca`; restituisce { XLSX, ws, nome }. */
export async function apriFoglio(file, cerca) {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const indice = XLSX.read(buffer, { type: 'array', bookSheets: true });
  const nome = (indice.SheetNames || []).find(n => cerca.test(n));
  if (!nome) throw new Error(`Nel file «${file.name}» non trovo il foglio cercato (${cerca}). Fogli presenti: ${(indice.SheetNames || []).join(', ')}.`);
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false, cellText: false, cellHTML: false, cellFormula: false, sheets: [nome] });
  return { XLSX, ws: wb.Sheets[nome], nome };
}

/** Il foglio come griglia di righe e colonne, celle vuote comprese. */
export const griglia = (XLSX, ws) => XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: true, defval: null });
