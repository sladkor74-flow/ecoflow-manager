// Strumenti della sezione Quadratura FIR del modulo Verifiche.
//
// Il confronto fra le tre fonti sta nel backend (base44/shared/quadraturaFir.ts):
// qui ci sono solo le etichette da mostrare e la lettura di un file Excel, per
// chi preferisce caricare il foglio da cui ha stampato le pivot invece del PDF.

import { formatKg, formatTonnellate } from '@/lib/utils';

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
// In una pivot compatta le due righe - impianto e trasportatore - stanno nella
// stessa colonna, e la riga dell'impianto porta il proprio subtotale. Si
// riconoscono guardando i numeri: una riga e' un subtotale di gruppo quando le
// righe che la seguono, sommate, fanno esattamente i suoi valori.

const INTESTAZIONE = /etichette\s+di\s+riga|row\s+labels/i;
const TOTALE = /totale\s+complessivo|grand\s+total/i;
const TITOLO = /RACCOLTA|SECOND|\bACI\b|EXTRA/i;
const FONTE = /^\s*(winsinfo|ecotyre)\s*$/i;

const testo = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

function numero(v) {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const s = testo(v).replace(/\s/g, '');
  if (!s || !/[0-9]/.test(s)) return null;
  const n = Number(s.replace(/\./g, '').replace(',', '.'));
  return isFinite(n) ? n : null;
}

/** La tabella che comincia dalla cella "Etichette di riga" in (r0, c0). */
function leggiTabella(griglia, r0, c0) {
  const intestazioni = griglia[r0] || [];
  // Le due misure sono le prime due colonne con un'intestazione a destra dell'etichetta.
  const colonne = [];
  for (let c = c0 + 1; c < c0 + 6 && colonne.length < 2; c++) if (testo(intestazioni[c])) colonne.push(c);
  if (colonne.length < 2) return null;

  const grezze = [];
  let totale = null;
  for (let r = r0 + 1; r < griglia.length; r++) {
    const etichetta = testo((griglia[r] || [])[c0]);
    if (!etichetta) break;
    const n = numero((griglia[r] || [])[colonne[0]]);
    const kg = numero((griglia[r] || [])[colonne[1]]);
    if (TOTALE.test(etichetta)) { totale = { n: Math.round(n || 0), kg: kg || 0 }; break; }
    if (n === null && kg === null) break;
    grezze.push({ etichetta, n: Math.round(n || 0), kg: kg || 0 });
  }
  if (!grezze.length) return null;

  // Impianti e trasportatori: una riga e' un impianto se le successive la sommano.
  const righe = [];
  const subtotali = [];
  let i = 0;
  while (i < grezze.length) {
    const capo = grezze[i];
    let sommaN = 0, sommaKg = 0, fine = -1;
    for (let j = i + 1; j < grezze.length; j++) {
      sommaN += grezze[j].n;
      sommaKg += grezze[j].kg;
      if (sommaN === capo.n && Math.abs(sommaKg - capo.kg) <= 1) { fine = j; break; }
      if (sommaN > capo.n) break;
    }
    if (fine > i) {
      subtotali.push({ impianto: capo.etichetta, conteggio: capo.n, kg: capo.kg });
      for (let j = i + 1; j <= fine; j++) {
        righe.push({ impianto: capo.etichetta, trasportatore: grezze[j].etichetta, conteggio: grezze[j].n, kg: grezze[j].kg });
      }
      i = fine + 1;
    } else {
      // Nessun sottolivello: l'impianto e' anche la riga di dettaglio.
      righe.push({ impianto: capo.etichetta, trasportatore: capo.etichetta, conteggio: capo.n, kg: capo.kg });
      i++;
    }
  }

  // Etichetta della fonte e titolo della sezione, cercati sopra la tabella.
  let fonte = '', titolo = '';
  for (let r = r0 - 1; r >= Math.max(0, r0 - 6) && (!fonte || !titolo); r--) {
    for (let c = Math.max(0, c0 - 3); c < c0 + 4; c++) {
      const v = testo((griglia[r] || [])[c]);
      if (!v) continue;
      if (!fonte && FONTE.test(v)) fonte = v.toLowerCase();
      else if (!titolo && TITOLO.test(v) && !FONTE.test(v)) titolo = v;
    }
  }
  if (!titolo) {
    for (let r = r0 - 1; r >= 0 && !titolo; r--) {
      for (const v of (griglia[r] || []).map(testo)) if (v && TITOLO.test(v) && !FONTE.test(v)) { titolo = v; break; }
    }
  }

  return {
    titolo, fonte, righe, subtotali,
    totale_conteggio: totale ? totale.n : righe.reduce((s, x) => s + x.conteggio, 0),
    totale_kg: totale ? totale.kg : righe.reduce((s, x) => s + x.kg, 0),
  };
}

/** Tutte le pivot trovate in un file Excel, nel formato che il backend confronta. */
export async function leggiPivotDaExcel(file) {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
  const tabelle = [];
  for (const nome of wb.SheetNames) {
    const ws = wb.Sheets[nome];
    if (!ws || !ws['!ref']) continue;
    const griglia = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });
    for (let r = 0; r < griglia.length; r++) {
      const riga = griglia[r] || [];
      for (let c = 0; c < riga.length; c++) {
        if (!INTESTAZIONE.test(testo(riga[c]))) continue;
        const t = leggiTabella(griglia, r, c);
        if (t && t.righe.length) tabelle.push({ ...t, foglio: nome });
      }
    }
  }
  if (!tabelle.length) {
    throw new Error('Nel file non ho trovato nessuna pivot con le etichette di riga e le due colonne di conteggio e somma. Carica il PDF della stampa.');
  }
  return tabelle;
}
