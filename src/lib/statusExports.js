// Utility per esportazione Excel, PDF e PPT del modulo Status & Target.
import { jsPDF } from 'jspdf';
import pptxgen from 'pptxgenjs';
import { base44 } from '@/api/base44Client';
import { MESI } from './pfuConstants';

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function base64ToBlob(base64, mime) {
  const res = await fetch(`data:${mime};base64,${base64}`);
  return res.blob();
}

export async function exportExcel() {
  const res = await base44.functions.invoke('exportStatusExcel', {});
  const blob = await base64ToBlob(res.data.file_base64, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  downloadBlob(blob, res.data.filename);
}

export function exportPDF(kpis, mergedData, regioneData, impiantiData) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const dateStr = new Date().toLocaleDateString('it-IT');

  doc.setFontSize(16);
  doc.text('Status & Target Management - PFU Ecotyre', 14, 15);
  doc.setFontSize(9);
  doc.text(`Data: ${dateStr}`, 14, 21);

  // KPI
  doc.setFontSize(11);
  doc.text('KPI Riepilogativi', 14, 32);
  doc.setFontSize(9);
  const kpiLines = [
    `Target Annuo Complessivo: ${kpis.targetAnnuoTotale.toFixed(1)} t`,
    `Totale Progressivo Raccolto: ${kpis.raccoltoTotale.toFixed(1)} t`,
    `Leftover Complessivo Annuo: ${kpis.leftoverTotale.toFixed(1)} t`,
    `Delta Mese In Corso: ${kpis.deltaMeseCorrente.toFixed(1)} t`,
  ];
  kpiLines.forEach((line, i) => doc.text(line, 14, 39 + i * 5));

  // Tabella Raccoglitori
  doc.setFontSize(11);
  doc.text('Target & Performance Raccoglitori', 14, 65);
  doc.setFontSize(8);
  doc.text('Regione', 14, 71);
  doc.text('Raccoglitore', 50, 71);
  doc.text('T.Annuo', 115, 71);
  doc.text('Raccolto', 140, 71);
  doc.text('Leftover', 165, 71);
  let y = 76;
  for (const r of mergedData) {
    if (y > 200) { doc.addPage(); y = 15; }
    doc.text(String(r.regione).substring(0, 22), 14, y);
    doc.text(String(r.raccoglitore).substring(0, 28), 50, y);
    doc.text(r.targetAnnuo.toFixed(1), 115, y);
    doc.text(r.raccoltoTotale.toFixed(1), 140, y);
    doc.text(r.leftover.toFixed(1), 165, y);
    y += 5;
  }

  // Tabella Regioni
  doc.addPage();
  doc.setFontSize(11);
  doc.text('Target e Scostamento per Regione', 14, 15);
  doc.setFontSize(8);
  doc.text('Regione', 14, 21);
  doc.text('Raccolto Totale [t]', 60, 21);
  y = 26;
  for (const r of regioneData) {
    doc.text(String(r.regione).substring(0, 22), 14, y);
    doc.text(r.totale.toFixed(1), 60, y);
    y += 5;
  }

  // Tabella Impianti
  doc.setFontSize(11);
  doc.text('Progressivo e Avanzamento Impianti', 14, 60);
  doc.setFontSize(8);
  doc.text('Impianto', 14, 66);
  doc.text('Totale Conferito [t]', 80, 66);
  y = 71;
  for (const i of impiantiData) {
    if (y > 200) break;
    doc.text(String(i.impianto).substring(0, 30), 14, y);
    doc.text(i.totale.toFixed(1), 80, y);
    y += 5;
  }

  doc.save(`Status_Target_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export async function exportPPT(kpis, mergedData, regioneData, impiantiData) {
  const pptx = new pptxgen();
  pptx.defineLayout({ name: 'Wide', width: 13.33, height: 7.5 });
  pptx.layout = 'Wide';
  const dateStr = new Date().toLocaleDateString('it-IT');

  // Slide 1: Titolo + KPI
  const s1 = pptx.addSlide();
  s1.addText('Status & Target Management - PFU Ecotyre', { x: 0.5, y: 0.3, fontSize: 28, bold: true, color: '1A1A2E' });
  s1.addText(`Data: ${dateStr}`, { x: 0.5, y: 1, fontSize: 14, color: '666666' });
  const kpiRows = [
    [{ text: 'KPI', options: { bold: true, fill: '36C5F0', color: 'FFFFFF' } }, { text: 'Valore [t]', options: { bold: true, fill: '36C5F0', color: 'FFFFFF' } }],
    ['Target Annuo Complessivo', kpis.targetAnnuoTotale.toFixed(1)],
    ['Totale Progressivo Raccolto', kpis.raccoltoTotale.toFixed(1)],
    ['Leftover Complessivo Annuo', kpis.leftoverTotale.toFixed(1)],
    ['Delta Mese In Corso', kpis.deltaMeseCorrente.toFixed(1)],
  ];
  s1.addTable(kpiRows, { x: 0.5, y: 1.8, w: 6, fontSize: 12, border: { type: 'solid', pt: 1 } });

  // Slide 2: Raccoglitori
  const s2 = pptx.addSlide();
  s2.addText('Target & Performance Raccoglitori', { x: 0.5, y: 0.3, fontSize: 24, bold: true, color: '1A1A2E' });
  const raccRows = [['Regione', 'Raccoglitore', 'T.Annuo', 'Raccolto', 'Leftover']];
  for (const r of mergedData) {
    raccRows.push([String(r.regione).substring(0, 15), String(r.raccoglitore).substring(0, 20), r.targetAnnuo.toFixed(1), r.raccoltoTotale.toFixed(1), r.leftover.toFixed(1)]);
  }
  s2.addTable(raccRows, { x: 0.5, y: 1, w: 12, fontSize: 9, border: { type: 'solid', pt: 1 }, colW: [2, 4, 2, 2, 2] });

  // Slide 3: Regioni
  const s3 = pptx.addSlide();
  s3.addText('Target e Scostamento per Regione', { x: 0.5, y: 0.3, fontSize: 24, bold: true, color: '1A1A2E' });
  const regRows = [['Regione', 'Raccolto Totale [t]']];
  for (const r of regioneData) regRows.push([r.regione, r.totale.toFixed(1)]);
  s3.addTable(regRows, { x: 0.5, y: 1, w: 6, fontSize: 11, border: { type: 'solid', pt: 1 } });

  // Slide 4: Impianti
  const s4 = pptx.addSlide();
  s4.addText('Progressivo e Avanzamento Impianti', { x: 0.5, y: 0.3, fontSize: 24, bold: true, color: '1A1A2E' });
  const impRows = [['Impianto', 'Totale Conferito [t]']];
  for (const i of impiantiData) impRows.push([String(i.impianto).substring(0, 30), i.totale.toFixed(1)]);
  s4.addTable(impRows, { x: 0.5, y: 1, w: 8, fontSize: 11, border: { type: 'solid', pt: 1 } });

  await pptx.writeFile({ fileName: `Status_Target_${new Date().toISOString().slice(0, 10)}.pptx` });
}