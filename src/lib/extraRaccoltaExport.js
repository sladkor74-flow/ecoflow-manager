// Esportazione Excel e PDF per Extra Raccolta — formato amministrazione.
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { calcExtraRaccolta, totaleRiga, aggregaPerProduttore } from './extraRaccoltaCalc';

const MESI_UPPER = {
  'Gennaio': 'GENNAIO', 'Febbraio': 'FEBBRAIO', 'Marzo': 'MARZO',
  'Aprile': 'APRILE', 'Maggio': 'MAGGIO', 'Giugno': 'GIUGNO',
  'Luglio': 'LUGLIO', 'Agosto': 'AGOSTO', 'Settembre': 'SETTEMBRE',
  'Ottobre': 'OTTOBRE', 'Novembre': 'NOVEMBRE', 'Dicembre': 'DICEMBRE'
};

const r2 = (n) => Math.round(n * 100) / 100;

function toDate(v) {
  if (!v) return null;
  try { const d = new Date(v); return isNaN(d.getTime()) ? null : d; } catch { return null; }
}

export function exportExtraRaccoltaExcel(records, mese, anno) {
  const sheetName = `${MESI_UPPER[mese] || String(mese).toUpperCase()} ${anno}`;
  const wsData = [];

  // === Area 1: righe intervento ===
  wsData.push([
    'Nr. FIR', 'PRODUTTORE', 'TRASPORTATORE', 'DESTINATARIO',
    'DATA INIZIO TRASPORTO', 'DATA FINE TRASPORTO',
    'CER', 'TIPOLOGIA TRASPORTO', "QUANTITA' (kg)", 'PREZZO (Euro/ton)', 'TOTALE (Euro)'
  ]);

  let totKg = 0, totSovraRaccolta = 0, totSovraTrasporto = 0, totSovraTrattamento = 0, totImponibileRighe = 0;

  for (const r of records) {
    const tr = totaleRiga(r);
    totKg += Number(r.peso_effettivo || 0);
    totSovraRaccolta += Number(r.sovracosto_raccolta || 0);
    totSovraTrasporto += Number(r.sovracosto_trasporto || 0);
    totSovraTrattamento += Number(r.sovracosto_trattamento || 0);
    totImponibileRighe += tr;

    const dInizio = toDate(r.trasporto_iniziato_il);
    const dFine = toDate(r.trasporto_finito_il);

    wsData.push([
      r.numero_fir || '',
      r.produttore || '',
      r.trasportatore || '',
      r.destinazione || '',
      dInizio || '',
      dFine || '',
      r.cer || '160103',
      r.tipologia_trasporto || '',
      Number(r.peso_effettivo || 0),
      Number(r.prezzo_attivo_t || 0),
      tr,
    ]);
  }

  // === Area 2: riepilogo ===
  wsData.push([]);
  wsData.push(["TOTALE QUANTITA' (kg)", totKg]);
  wsData.push(['Sovracosto Raccolta', r2(totSovraRaccolta)]);
  wsData.push(['Sovracosto Trasporto', r2(totSovraTrasporto)]);
  wsData.push(['Sovracosto Trattamento', r2(totSovraTrattamento)]);
  wsData.push(['Totale imponibile', r2(totImponibileRighe + totSovraRaccolta + totSovraTrasporto + totSovraTrattamento)]);

  // === Area 3: analisi margine per produttore ===
  wsData.push([]);
  wsData.push(['PRODUTTORE', 'costi aggiuntivi', 'raccolta', 'stoccaggio', 'trattamento', 'pulizia', 'costo totale', 'ricavi', 'margine']);

  const byProd = aggregaPerProduttore(records);
  let totCostiAgg = 0, totRaccolta = 0, totStoccaggio = 0, totTrattamento = 0, totPulizia = 0, totCosto = 0, totRicavi = 0, totMargine = 0;

  for (const [p, v] of Object.entries(byProd)) {
    wsData.push([
      p,
      r2(v.costi_aggiuntivi), r2(v.raccolta), r2(v.stoccaggio), r2(v.trattamento),
      r2(v.pulizia), r2(v.costo_totale), r2(v.ricavi), r2(v.margine),
    ]);
    totCostiAgg += v.costi_aggiuntivi; totRaccolta += v.raccolta; totStoccaggio += v.stoccaggio;
    totTrattamento += v.trattamento; totPulizia += v.pulizia; totCosto += v.costo_totale;
    totRicavi += v.ricavi; totMargine += v.margine;
  }

  wsData.push([
    'TOTALE',
    r2(totCostiAgg), r2(totRaccolta), r2(totStoccaggio), r2(totTrattamento),
    r2(totPulizia), r2(totCosto), r2(totRicavi), r2(totMargine),
  ]);

  const margPercTot = totRicavi !== 0 ? r2((totMargine / totRicavi) * 100) : 0;
  wsData.push([]);
  wsData.push(['Margine % complessivo', `${margPercTot}%`]);

  const ws = XLSX.utils.aoa_to_sheet(wsData, { cellDates: true });

  // Formato date per colonne E (4) e F (5)
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let R = range.s.r + 1; R <= range.e.r; R++) {
    for (const C of [4, 5]) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      if (ws[addr] && ws[addr].t === 'd') ws[addr].z = 'dd/mm/yyyy';
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `SMOCO-Fatturazione EXTRA RACCOLTA ${mese} ${anno}.xlsx`);
}

export function exportExtraRaccoltaPDF(records, mese, anno) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  doc.setFontSize(13);
  doc.text(`SMOCO - Fatturazione EXTRA RACCOLTA ${mese} ${anno}`, 14, 12);

  // === Area 1: interventi ===
  doc.setFontSize(7);
  const H1 = ['Nr. FIR', 'PRODUTTORE', 'TRASPORTATORE', 'DESTINATARIO', 'DT INIZIO', 'DT FINE', 'CER', 'TIPOLOGIA', 'Q.TA (kg)', 'PREZZO', 'TOTALE'];
  const W1 = [24, 38, 38, 38, 20, 20, 16, 28, 20, 18, 20];
  let y = 20;

  doc.setFont(undefined, 'bold');
  let x = 14;
  H1.forEach((h, i) => { doc.text(h, x, y); x += W1[i]; });
  doc.setFont(undefined, 'normal');
  y += 4.5;

  let totKg = 0, totSovraR = 0, totSovraT = 0, totSovraTr = 0, totImpRighe = 0;

  for (const r of records) {
    if (y > 195) { doc.addPage(); y = 15; }
    const tr = totaleRiga(r);
    totKg += Number(r.peso_effettivo || 0);
    totSovraR += Number(r.sovracosto_raccolta || 0);
    totSovraT += Number(r.sovracosto_trasporto || 0);
    totSovraTr += Number(r.sovracosto_trattamento || 0);
    totImpRighe += tr;

    x = 14;
    const dInizio = r.trasporto_iniziato_il ? new Date(r.trasporto_iniziato_il).toLocaleDateString('it-IT') : '';
    const dFine = r.trasporto_finito_il ? new Date(r.trasporto_finito_il).toLocaleDateString('it-IT') : '';
    const row = [
      String(r.numero_fir || '').substring(0, 14),
      String(r.produttore || '').substring(0, 24),
      String(r.trasportatore || '').substring(0, 24),
      String(r.destinazione || '').substring(0, 24),
      dInizio, dFine,
      String(r.cer || '160103').substring(0, 10),
      String(r.tipologia_trasporto || '').substring(0, 18),
      String(r.peso_effettivo || 0),
      String(r.prezzo_attivo_t || 0),
      String(tr),
    ];
    row.forEach((cell, i) => { doc.text(cell, x, y); x += W1[i]; });
    y += 4.5;
  }

  // === Area 2: riepilogo ===
  y += 3;
  doc.setFont(undefined, 'bold');
  doc.text('RIEPILOGO', 14, y); y += 5;
  doc.setFont(undefined, 'normal');
  doc.text(`Totale quantita' (kg): ${totKg}`, 14, y); y += 5;
  doc.text(`Sovracosto Raccolta: ${r2(totSovraR)}`, 14, y); y += 5;
  doc.text(`Sovracosto Trasporto: ${r2(totSovraT)}`, 14, y); y += 5;
  doc.text(`Sovracosto Trattamento: ${r2(totSovraTr)}`, 14, y); y += 5;
  doc.text(`Totale imponibile: ${r2(totImpRighe + totSovraR + totSovraT + totSovraTr)}`, 14, y); y += 8;

  // === Area 3: analisi margine ===
  if (y > 170) { doc.addPage(); y = 15; }
  doc.setFont(undefined, 'bold');
  doc.text('ANALISI MARGINE', 14, y); y += 5;
  doc.setFont(undefined, 'normal');

  const H2 = ['PRODUTTORE', 'costi agg.', 'raccolta', 'stoccaggio', 'trattamento', 'pulizia', 'costo tot.', 'ricavi', 'margine'];
  const W2 = [40, 24, 24, 24, 26, 20, 24, 24, 24];
  x = 14;
  H2.forEach((h, i) => { doc.text(h, x, y); x += W2[i]; });
  y += 4.5;

  const byProd = aggregaPerProduttore(records);
  let tCA = 0, tR = 0, tS = 0, tTr = 0, tP = 0, tCT = 0, tRi = 0, tM = 0;

  for (const [p, v] of Object.entries(byProd)) {
    if (y > 195) { doc.addPage(); y = 15; }
    x = 14;
    const row = [
      String(p).substring(0, 24),
      r2(v.costi_aggiuntivi), r2(v.raccolta), r2(v.stoccaggio), r2(v.trattamento),
      r2(v.pulizia), r2(v.costo_totale), r2(v.ricavi), r2(v.margine),
    ];
    row.forEach((cell, i) => { doc.text(String(cell), x, y); x += W2[i]; });
    y += 4.5;
    tCA += v.costi_aggiuntivi; tR += v.raccolta; tS += v.stoccaggio; tTr += v.trattamento;
    tP += v.pulizia; tCT += v.costo_totale; tRi += v.ricavi; tM += v.margine;
  }

  x = 14;
  doc.setFont(undefined, 'bold');
  ['TOTALE', r2(tCA), r2(tR), r2(tS), r2(tTr), r2(tP), r2(tCT), r2(tRi), r2(tM)].forEach((cell, i) => {
    doc.text(String(cell), x, y); x += W2[i];
  });
  y += 6;
  const mPerc = tRi !== 0 ? r2((tM / tRi) * 100) : 0;
  doc.text(`Margine % complessivo: ${mPerc}%`, 14, y);

  doc.save(`SMOCO-Fatturazione EXTRA RACCOLTA ${mese} ${anno}.pdf`);
}