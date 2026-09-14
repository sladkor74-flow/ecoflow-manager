import * as XLSX from 'xlsx';
import { formattaPesi } from '@/lib/formatoExcel';
import { jsPDF } from 'jspdf';

function fmt(n) {
  if (n === null || n === undefined || n === '') return '—';
  return Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
}

export function exportGiacenzeExcel(righe, totali, aciRighe, anno) {
  const wb = XLSX.utils.book_new();

  const mainHeaders = ['Sito', 'Ruolo', 'Target primarie (t)', 'Target totale (t)', 'Giacenza iniziale (t)', 'Conferito primarie (t)', 'Secondarie netto (t)', 'Terziarie (t)', 'Uscite CSS-C (t)', 'Uscite Ferro (t)', 'Dichiarato R3 (t)', 'Giacenza attuale (t)', 'Conferito (t)', 'Residuo (t)'];
  const mainRows = righe.map(r => [
    r.sito, r.tipo_destinazione === 'imp' ? 'Impianto' : 'Stoccaggio',
    r.target_primarie_t, r.target_totale_t || '', r.giacenza_iniziale_t,
    r.conferito_primarie_t, r.secondarie_nette_t, r.terziarie_t,
    r.uscite_css_t, r.uscite_ferro_t, r.dichiarato_r3_t,
    r.giacenza_attuale_t, r.conferito_t, r.residuo_t ?? '',
  ]);
  mainRows.push(['TOTALE', '', totali.target_primarie_t, totali.target_totale_t, totali.giacenza_iniziale_t,
    totali.conferito_primarie_t, totali.secondarie_nette_t, totali.terziarie_t,
    totali.uscite_css_t, totali.uscite_ferro_t, totali.dichiarato_r3_t,
    totali.giacenza_attuale_t, totali.conferito_t, '']);
  const ws1 = XLSX.utils.aoa_to_sheet([mainHeaders, ...mainRows]);
  XLSX.utils.book_append_sheet(wb, formattaPesi(XLSX, ws1), 'Giacenze');

  const aciHeaders = ['Sito', 'Ruolo', 'ACI in da primarie (t)', 'ACI in da secondarie (t)', 'ACI in uscita (t)', 'Dichiarato inviato (t)', 'Dichiarato da inviare (t)', 'Giacenza ACI reale (t)', 'Divergenza a portale (t)'];
  const aciRows = aciRighe.map(r => [
    r.sito, r.tipo_destinazione === 'imp' ? 'Impianto' : 'Stoccaggio',
    r.aci_in_primarie_t, r.aci_in_sec_t, r.aci_out_sec_t,
    r.aci_dichiarato_t, r.aci_predisposto_t, r.giacenza_aci_t, r.divergenza_portale_t,
  ]);
  const ws2 = XLSX.utils.aoa_to_sheet([aciHeaders, ...aciRows]);
  XLSX.utils.book_append_sheet(wb, formattaPesi(XLSX, ws2), 'Posizione ACI');

  XLSX.writeFile(wb, `Giacenze_${anno}.xlsx`);
}

function drawPdfTable(doc, x, y, headers, rows, colWidths, rowH) {
  doc.setFontSize(7);
  doc.setFont(undefined, 'bold');
  doc.setFillColor(220, 220, 220);
  let xPos = x;
  headers.forEach((h, i) => { doc.rect(xPos, y, colWidths[i], rowH, 'F'); doc.text(String(h), xPos + 1, y + rowH - 1.5); xPos += colWidths[i]; });
  y += rowH;
  doc.setFont(undefined, 'normal');
  for (const row of rows) {
    if (y > doc.internal.pageSize.getHeight() - 10) { doc.addPage(); y = 10; }
    xPos = x;
    row.forEach((cell, i) => { doc.rect(xPos, y, colWidths[i], rowH); doc.text(String(cell), xPos + 1, y + rowH - 1.5); xPos += colWidths[i]; });
    y += rowH;
  }
  return y;
}

export function exportGiacenzePDF(righe, totali, aciRighe, anno) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFontSize(14); doc.text(`Giacenze impianti e stoccaggi - ${anno}`, 10, 10);

  const mainHeaders = ['Sito', 'Ruolo', 'T.prim', 'T.tot', 'G.iniz', 'C.prim', 'Sec.net', 'Terz', 'CSS-C', 'Ferro', 'D.R3', 'G.att', 'Conf', 'Resid'];
  const mainCols = [40, 16, 15, 15, 15, 17, 15, 13, 14, 13, 15, 15, 15, 15];
  let y = drawPdfTable(doc, 10, 14, mainHeaders, righe.map(r => [
    r.sito.substring(0, 22), r.tipo_destinazione === 'imp' ? 'Imp' : 'Stoc',
    fmt(r.target_primarie_t), fmt(r.target_totale_t), fmt(r.giacenza_iniziale_t),
    fmt(r.conferito_primarie_t), fmt(r.secondarie_nette_t), fmt(r.terziarie_t),
    fmt(r.uscite_css_t), fmt(r.uscite_ferro_t), fmt(r.dichiarato_r3_t),
    fmt(r.giacenza_attuale_t), fmt(r.conferito_t), r.residuo_t != null ? fmt(r.residuo_t) : '—',
  ]), mainCols, 5.5);

  doc.setFont(undefined, 'bold'); doc.setFillColor(240, 240, 240);
  let xPos = 10;
  const totRow = ['TOTALE', '', fmt(totali.target_primarie_t), fmt(totali.target_totale_t), fmt(totali.giacenza_iniziale_t), fmt(totali.conferito_primarie_t), fmt(totali.secondarie_nette_t), fmt(totali.terziarie_t), fmt(totali.uscite_css_t), fmt(totali.uscite_ferro_t), fmt(totali.dichiarato_r3_t), fmt(totali.giacenza_attuale_t), fmt(totali.conferito_t), ''];
  totRow.forEach((cell, i) => { doc.rect(xPos, y, mainCols[i], 5.5, 'F'); doc.text(String(cell), xPos + 1, y + 4); xPos += mainCols[i]; });
  y += 10;

  doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.text('Posizione ACI - fuori portale', 10, y); y += 4;
  const aciHeaders = ['Sito', 'Ruolo', 'ACI prim', 'ACI sec.in', 'ACI sec.out', 'Dich.inv', 'Dich.da inv', 'G.AC reale', 'Diverg'];
  const aciCols = [40, 16, 20, 20, 20, 20, 22, 22, 20];
  drawPdfTable(doc, 10, y, aciHeaders, aciRighe.map(r => [
    r.sito.substring(0, 22), r.tipo_destinazione === 'imp' ? 'Imp' : 'Stoc',
    fmt(r.aci_in_primarie_t), fmt(r.aci_in_sec_t), fmt(r.aci_out_sec_t),
    fmt(r.aci_dichiarato_t), fmt(r.aci_predisposto_t), fmt(r.giacenza_aci_t), fmt(r.divergenza_portale_t),
  ]), aciCols, 5.5);

  doc.save(`Giacenze_${anno}.pdf`);
}