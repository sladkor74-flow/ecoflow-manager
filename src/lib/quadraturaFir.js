// Strumenti della sezione Quadratura FIR del modulo Verifiche.
//
// Il confronto fra le tre fonti sta nel backend (base44/shared/quadraturaFir.ts):
// qui ci sono solo le etichette da mostrare e la lettura di un file Excel, per
// chi preferisce caricare il foglio da cui ha stampato le pivot invece del PDF.

import { formatKg, formatTonnellate } from '@/lib/utils';
import { leggiPivotDaGriglia } from '@/lib/pivotQuadratura';

export const NOME_FONTE = { winsinfo: 'WINSINFO', ecotyre: 'Portale Ecotyre', gestionale: 'Gestionale' };

// Gli stessi nomi dei flussi del backend, per le etichette del report.
export const TITOLO_FLUSSO = {
  rete_primarie: 'Raccolta rete',
  rete_secondarie: 'Secondarie rete',
  aci_primarie: 'Raccolta ACI',
  aci_secondarie: 'Secondarie ACI',
  extra_primarie: 'Extra raccolta',
  extra_secondarie: 'Secondarie di extra raccolta',
};

export const NOME_VERDETTO = {
  congruente: 'Congruente',
  scostamento: 'Scostamento',
  solo_report: 'Manca nel gestionale',
  solo_gestionale: 'Manca nel file',
  vuota: 'Senza dati',
};

export const COLORE_VERDETTO = {
  congruente: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  scostamento: 'border-red-200 bg-red-50 text-red-800',
  solo_report: 'border-amber-200 bg-amber-50 text-amber-800',
  solo_gestionale: 'border-amber-200 bg-amber-50 text-amber-800',
  vuota: 'border-muted bg-muted/40 text-muted-foreground',
};

/** "24 FIR · 76.220 kg" oppure il trattino quando la fonte non ha la cella. */
export function misura(v) {
  if (!v) return null;
  return `${v.n} · ${formatKg(v.kg)} kg`;
}

export const tonnellate = (kg) => formatTonnellate((Number(kg) || 0) / 1000);

/**
 * I formulari con le date obbligatorie da sistemare, uno per numero di FIR:
 * stessa regola di formulariConDate in base44/shared/quadraturaFirDati.ts (lo
 * controlla prove/quadraturaFir.mjs). Il backend li salva gia' raggruppati; qui
 * si ripassano per gli esiti salvati prima del 22/09/2026, che avevano una voce
 * per quota: gli esempi e "e altri" si contano sui formulari, non sulle quote.
 */
export function formulariConDate(voci) {
  const gruppi = [];
  const perFir = new Map();
  for (const x of voci || []) {
    const k = x && x.fir ? String(x.fir).toUpperCase() : '';
    if (k && perFir.has(k)) { perFir.get(k).push(x); continue; }
    const quote = [x];
    if (k) perFir.set(k, quote);
    gruppi.push(quote);
  }
  return gruppi.map((quote) => {
    if (quote.length === 1) return quote[0];
    const ordini = [...new Set(quote.map(q => q.ordine).filter(Boolean))];
    const testi = [...new Set(quote.map(q => q.date).filter(Boolean))];
    // stesse date che mancano a tutte le quote: una volta; se no, ordine per ordine
    const date = testi.length <= 1 ? (testi[0] || '')
      : testi.map(t => `${t} (${[...new Set(quote.filter(q => q.date === t).map(q => q.ordine).filter(Boolean))].join(' + ') || 'ordine senza numero'})`).join(' · ');
    const kg = quote.some(q => typeof q.kg === 'number') ? quote.reduce((t, q) => t + (Number(q.kg) || 0), 0) : undefined;
    return { ...quote[0], ordine: ordini.join(' + '), date, ...(kg !== undefined ? { kg } : {}) };
  });
}

/** "FIR RGYTR000001AA, ordine ET26000001: manca la data di inizio trasporto"; "ordini ET0 + ET1" per un formulario ripartito. */
export const descriviConDate = (x) => `${x.fir ? `FIR ${x.fir}` : 'formulario senza numero'}${x.ordine ? `, ${/ \+ /.test(x.ordine) ? 'ordini' : 'ordine'} ${x.ordine}` : ''}${x.date ? `: ${x.date}` : ''}`;

/**
 * Il giorno di un istante, letto sull'orologio italiano.
 *
 * Gli istanti sono salvati in UTC: tagliare la stringa mostrerebbe il giorno
 * prima per tutto quello che si fa dopo le due di notte d'estate.
 */
export function giornoRoma(istante) {
  if (!istante) return '';
  const d = new Date(/Z$|[+-]\d\d:?\d\d$/.test(String(istante)) ? istante : istante + 'Z');
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric' });
}

export const FORMATI = [
  '.pdf', '.png', '.jpg', '.jpeg', '.webp', '.xlsx', '.xls', '.xlsm', '.ods',
  'application/pdf', 'image/png', 'image/jpeg', 'image/webp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel', 'application/vnd.oasis.opendocument.spreadsheet',
].join(',');

export function tipoDiFile(file) {
  const nome = String(file.name || '').toLowerCase();
  if (/\.(xlsx|xlsm|xls|ods)$/.test(nome)) return 'excel';
  if (/\.pdf$/.test(nome) || file.type === 'application/pdf') return 'pdf';
  if (/\.(png|jpe?g|webp)$/.test(nome) || /^image\//.test(file.type || '')) return 'immagine';
  return null;
}

// === lettura di un file Excel con le pivot ===
//
// La lettura vera sta in src/lib/pivotQuadratura.js, che non tocca il browser e
// quindi si puo' provare (prove/pivotQuadratura.mjs). Qui resta solo l'apertura
// del file.

export async function leggiPivotDaExcel(file) {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
  const tabelle = [];
  for (const nome of wb.SheetNames) {
    const ws = wb.Sheets[nome];
    if (!ws || !ws['!ref']) continue;
    const griglia = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });
    tabelle.push(...leggiPivotDaGriglia(griglia, nome));
  }
  if (!tabelle.length) {
    throw new Error('Nel file non ho trovato nessuna pivot con le etichette di riga e le due colonne del conteggio dei formulari e della somma dei chili. Se le pivot ci sono, controlla le intestazioni delle due colonne; altrimenti carica il PDF della stampa.');
  }
  return tabelle;
}
