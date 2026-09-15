// Esportazione in Excel e in PDF di una tabella di dettaglio (ordini, righe di
// fatturazione). Le colonne descrivono titolo, valore e tipo; i formati seguono
// le regole del gestionale: kg interi, tonnellate con 2-3 decimali, euro con 2
// decimali, prezzi unitari con 4.
//
// colonne: [{ titolo, valore: (riga) => any, tipo: 'testo'|'kg'|'t'|'euro'|'prezzo'|'data'|'intero', peso?: number }]
// totali:  { etichetta, valori: { [indiceColonna]: numero } }

import { formatNumber, formatKg, formatTonnellate, formatIntero } from '@/lib/utils';

const NUMERICI = new Set(['kg', 't', 'euro', 'prezzo', 'intero']);
const FORMATO_EXCEL = { kg: '#,##0', t: '#,##0.00#', euro: '#,##0.00', prezzo: '#,##0.0000', intero: '#,##0', data: 'dd/mm/yyyy' };

// Date del portale a mezzanotte UTC; quelle salvate a mezzanotte italiana (22 o 23
// UTC) si riportano al giorno giusto.
const comeData = (v) => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return null;
  const italiana = (d.getUTCHours() === 22 || d.getUTCHours() === 23) && !d.getUTCMinutes() && !d.getUTCSeconds();
  return italiana ? new Date(d.getTime() + 3 * 3600000) : d;
};

function testoCella(valore, tipo) {
  if (valore === null || valore === undefined || valore === '') return tipo && NUMERICI.has(tipo) ? '' : '—';
  switch (tipo) {
    case 'kg': return formatKg(valore);
    case 't': return formatTonnellate(valore);
    case 'euro': return `${formatNumber(valore, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
    case 'prezzo': return `${formatNumber(valore, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} €`;
    case 'intero': return formatIntero(valore);
    case 'data': { const d = comeData(valore); return d ? d.toLocaleDateString('it-IT', { timeZone: 'UTC' }) : '—'; }
    default: return String(valore);
  }
}

const nomeSicuro = (s) => String(s).replace(/[\\/:*?"<>|]+/g, '-').trim();

/** Foglio Excel con titolo, intestazioni, righe e totali formattati. */
export async function esportaTabellaExcel({ nomeFile, foglio = 'Dettaglio', titolo, sottotitolo, colonne, righe, totali }) {
  const XLSX = await import('xlsx');
  const aoa = [[titolo], [sottotitolo || ''], [], colonne.map(c => c.titolo)];
  for (const r of righe) {
    aoa.push(colonne.map(c => {
      const v = c.valore(r);
      if (c.tipo === 'data') return comeData(v);
      if (NUMERICI.has(c.tipo)) return v === null || v === undefined || v === '' ? null : Number(v);
      return v ?? '';
    }));
  }
  if (totali) {
    aoa.push([]);
    aoa.push(colonne.map((c, i) => (i === 0 ? totali.etichetta : (totali.valori[i] ?? null))));
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let R = 4; R <= range.e.r; R++) {
    colonne.forEach((c, C) => {
      const cella = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      if (cella && FORMATO_EXCEL[c.tipo] && (cella.t === 'n' || cella.t === 'd')) cella.z = FORMATO_EXCEL[c.tipo];
    });
  }
  ws['!cols'] = colonne.map(c => ({ wch: Math.max(10, Math.min(45, Math.round((c.peso || 1) * 12))) }));
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 3, c: 0 }, e: { r: 3 + righe.length, c: colonne.length - 1 } }) };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, foglio.slice(0, 31));
  XLSX.writeFile(wb, `${nomeSicuro(nomeFile)}.xlsx`);
}

const C = {
  scuro: [15, 76, 92], medio: [26, 127, 142], chiaro: [226, 238, 241], zebra: [247, 250, 251],
  bordo: [214, 222, 226], testo: [30, 41, 59], grigio: [110, 120, 130], bianco: [255, 255, 255], ambra: [180, 83, 9], rosso: [185, 28, 28],
};

/**
 * PDF A4 orizzontale: fascia di intestazione, tabella con intestazioni ripetute a
 * ogni pagina, righe alternate, totali e numero di pagina.
 * colore(riga) opzionale: 'ambra' o 'rosso' per evidenziare una riga.
 */
export async function esportaTabellaPdf({ nomeFile, intestazione, titolo, sottotitolo, colonne, righe, totali, colore }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 10;
  const pesoTotale = colonne.reduce((s, c) => s + (c.peso || 1), 0);
  const larghezze = colonne.map(c => ((W - 2 * M) * (c.peso || 1)) / pesoTotale);
  const esportato = new Date().toLocaleString('it-IT');
  let y = 0;
  let pagina = 1;

  const testata = () => {
    doc.setFillColor(...C.scuro);
    doc.rect(0, 0, W, 20, 'F');
    doc.setFillColor(...C.medio);
    doc.rect(0, 20, W, 1.2, 'F');
    doc.setTextColor(...C.bianco);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(intestazione || 'SMOCO S.r.l.  ·  COMMESSA ECOTYRE', M, 7.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(titolo, M, 15);
    if (sottotitolo) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(sottotitolo, W - M, 15, { align: 'right' });
    }
    y = 27;
  };

  const intestazioni = () => {
    doc.setFillColor(...C.scuro);
    doc.roundedRect(M, y, W - 2 * M, 8, 1, 1, 'F');
    doc.setTextColor(...C.bianco);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.4);
    let x = M;
    colonne.forEach((c, i) => {
      const destra = NUMERICI.has(c.tipo);
      doc.text(doc.splitTextToSize(c.titolo, larghezze[i] - 3)[0], destra ? x + larghezze[i] - 2 : x + 2, y + 5.2, { align: destra ? 'right' : 'left' });
      x += larghezze[i];
    });
    y += 8;
  };

  const piede = () => {
    doc.setDrawColor(...C.bordo);
    doc.setLineWidth(0.2);
    doc.line(M, H - 9, W - M, H - 9);
    doc.setTextColor(...C.grigio);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`${formatIntero(righe.length)} ${righe.length === 1 ? 'riga' : 'righe'}`, M, H - 5);
    doc.text(`Esportato il ${esportato}  ·  Pagina ${pagina}`, W - M, H - 5, { align: 'right' });
  };

  const riga = (celle, { sfondo, grassetto, coloreTesto, altezza = 6 } = {}) => {
    if (y + altezza > H - 12) {
      piede();
      doc.addPage();
      pagina++;
      testata();
      intestazioni();
    }
    if (sfondo) {
      doc.setFillColor(...sfondo);
      doc.rect(M, y, W - 2 * M, altezza, 'F');
    }
    doc.setFont('helvetica', grassetto ? 'bold' : 'normal');
    doc.setFontSize(7.4);
    doc.setTextColor(...(coloreTesto || C.testo));
    let x = M;
    colonne.forEach((c, i) => {
      const destra = NUMERICI.has(c.tipo);
      const t = doc.splitTextToSize(celle[i], larghezze[i] - 3)[0] || '';
      doc.text(t, destra ? x + larghezze[i] - 2 : x + 2, y + altezza - 1.9, { align: destra ? 'right' : 'left' });
      x += larghezze[i];
    });
    if (!sfondo || sfondo === C.zebra) {
      doc.setDrawColor(...C.bordo);
      doc.setLineWidth(0.1);
      doc.line(M, y + altezza, W - M, y + altezza);
    }
    y += altezza;
  };

  testata();
  intestazioni();
  if (!righe.length) {
    riga(colonne.map((c, i) => (i === 0 ? 'Nessuna riga' : '')), { coloreTesto: C.grigio });
  }
  righe.forEach((r, i) => {
    const evidenza = colore ? colore(r) : null;
    riga(colonne.map(c => testoCella(c.valore(r), c.tipo)), {
      sfondo: i % 2 ? C.zebra : null,
      coloreTesto: evidenza ? C[evidenza] : null,
    });
  });
  if (totali) {
    y += 1.5;
    riga(colonne.map((c, i) => (i === 0 ? totali.etichetta : (totali.valori[i] !== undefined ? testoCella(totali.valori[i], c.tipo) : ''))),
      { sfondo: C.chiaro, grassetto: true, coloreTesto: C.scuro, altezza: 7 });
  }
  piede();
  doc.save(`${nomeSicuro(nomeFile)}.pdf`);
}
