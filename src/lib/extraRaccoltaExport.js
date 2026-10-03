// Esportazione Excel e PDF per Extra Raccolta — formato amministrazione.
import * as XLSX from 'xlsx';
import { formattaPesi } from '@/lib/formatoExcel';
import { jsPDF } from 'jspdf';
import { totaleRiga, aggregaPerProduttore, prezzoAttivoExtra } from './extraRaccoltaCalc';

// Il prezzo in colonna e' quello con cui la riga si fattura: il prezzo scritto
// sull'intervento o, se manca, la tariffa base dell'anno (202 €/t nel 2026).
// Scritto zero, il report diceva un prezzo e la fattura un altro.
const prezzoRiga = (r) => prezzoAttivoExtra(r).valore;

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
      prezzoRiga(r),
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
  // La voce «trasporto» e' il costo a viaggio degli interventi (campo
  // costo_trasporto_viaggio, nato il 03/10/2026): sta fra le voci di costo e non
  // nel riepilogo qui sopra, che somma i sovracosti del ricavo e finisce nel
  // totale imponibile. Si somma tale e quale, come la pulizia e i costi
  // aggiuntivi, perche' e' un importo fisso per intervento e non un prezzo a
  // tonnellata; senza questa colonna le voci non facevano piu' il costo totale,
  // che il trasporto lo comprende.
  // Le due voci «sovracosto raccoglitore» e «sovracosto impianto» (campi
  // sovracosto_pagato_raccoglitore e sovracosto_pagato_impianto, nati il
  // 03/10/2026 con la precisazione dell'utente) stanno qui per lo stesso motivo:
  // sono soldi che SMOCO PAGA, al raccoglitore per i costi imprevisti della
  // raccolta o all'impianto per quelli del trattamento, e il costo totale li
  // comprende. Si sommano tali e quali, come la pulizia e il trasporto, perche'
  // sono importi fissi per intervento e non prezzi a tonnellata. Nel riepilogo
  // dell'Area 2 non ci vanno mai: quello somma i tre sovracosti del RICAVO e
  // finisce nel totale imponibile della fatturazione attiva, e un costo che
  // paghiamo noi lo gonfierebbe.
  wsData.push([]);
  wsData.push(['PRODUTTORE', 'costi aggiuntivi', 'raccolta', 'stoccaggio', 'trattamento', 'pulizia', 'trasporto', 'sovracosto raccoglitore', 'sovracosto impianto', 'costo totale', 'ricavi', 'margine']);

  const byProd = aggregaPerProduttore(records);
  let totCostiAgg = 0, totRaccolta = 0, totStoccaggio = 0, totTrattamento = 0, totPulizia = 0, totTrasporto = 0;
  let totSovraRaccoglitore = 0, totSovraImpianto = 0, totCosto = 0, totRicavi = 0, totMargine = 0;

  for (const [p, v] of Object.entries(byProd)) {
    wsData.push([
      p,
      r2(v.costi_aggiuntivi), r2(v.raccolta), r2(v.stoccaggio), r2(v.trattamento),
      r2(v.pulizia), r2(v.trasporto), r2(v.sovracosto_raccoglitore), r2(v.sovracosto_impianto),
      r2(v.costo_totale), r2(v.ricavi), r2(v.margine),
    ]);
    totCostiAgg += v.costi_aggiuntivi; totRaccolta += v.raccolta; totStoccaggio += v.stoccaggio;
    totTrattamento += v.trattamento; totPulizia += v.pulizia; totTrasporto += v.trasporto;
    totSovraRaccoglitore += v.sovracosto_raccoglitore; totSovraImpianto += v.sovracosto_impianto;
    totCosto += v.costo_totale; totRicavi += v.ricavi; totMargine += v.margine;
  }

  wsData.push([
    'TOTALE',
    r2(totCostiAgg), r2(totRaccolta), r2(totStoccaggio), r2(totTrattamento),
    r2(totPulizia), r2(totTrasporto), r2(totSovraRaccoglitore), r2(totSovraImpianto),
    r2(totCosto), r2(totRicavi), r2(totMargine),
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
  XLSX.utils.book_append_sheet(wb, formattaPesi(XLSX, ws), sheetName);
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
      String(prezzoRiga(r)),
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

  // Le stesse voci del foglio Excel: il trasporto a viaggio e i due sovracosti
  // pagati, al raccoglitore e all'impianto, entrano tutti nel costo totale e
  // quindi vanno mostrati anche qui. Le larghezze sono state strette per far
  // posto alle due colonne nuove, come si e' fatto per il trasporto: le
  // intestazioni sono abbreviate ma dicono chi incassa il sovracosto, perche'
  // «sovr. raccogl.» e «sovr. impianto» non si confondano con i sovracosti del
  // ricavo, che qui non ci sono.
  const H2 = ['PRODUTTORE', 'costi agg.', 'raccolta', 'stoccaggio', 'trattamento', 'pulizia', 'trasporto', 'sovr. raccogl.', 'sovr. impianto', 'costo tot.', 'ricavi', 'margine'];
  const W2 = [32, 19, 19, 19, 21, 17, 19, 23, 23, 20, 19, 19];
  x = 14;
  H2.forEach((h, i) => { doc.text(h, x, y); x += W2[i]; });
  y += 4.5;

  const byProd = aggregaPerProduttore(records);
  let tCA = 0, tR = 0, tS = 0, tTr = 0, tP = 0, tTrasp = 0, tSRac = 0, tSImp = 0, tCT = 0, tRi = 0, tM = 0;

  for (const [p, v] of Object.entries(byProd)) {
    if (y > 195) { doc.addPage(); y = 15; }
    x = 14;
    const row = [
      String(p).substring(0, 20),
      r2(v.costi_aggiuntivi), r2(v.raccolta), r2(v.stoccaggio), r2(v.trattamento),
      r2(v.pulizia), r2(v.trasporto), r2(v.sovracosto_raccoglitore), r2(v.sovracosto_impianto),
      r2(v.costo_totale), r2(v.ricavi), r2(v.margine),
    ];
    row.forEach((cell, i) => { doc.text(String(cell), x, y); x += W2[i]; });
    y += 4.5;
    tCA += v.costi_aggiuntivi; tR += v.raccolta; tS += v.stoccaggio; tTr += v.trattamento;
    tP += v.pulizia; tTrasp += v.trasporto; tSRac += v.sovracosto_raccoglitore; tSImp += v.sovracosto_impianto;
    tCT += v.costo_totale; tRi += v.ricavi; tM += v.margine;
  }

  x = 14;
  doc.setFont(undefined, 'bold');
  ['TOTALE', r2(tCA), r2(tR), r2(tS), r2(tTr), r2(tP), r2(tTrasp), r2(tSRac), r2(tSImp), r2(tCT), r2(tRi), r2(tM)].forEach((cell, i) => {
    doc.text(String(cell), x, y); x += W2[i];
  });
  y += 6;
  const mPerc = tRi !== 0 ? r2((tM / tRi) * 100) : 0;
  doc.text(`Margine % complessivo: ${mPerc}%`, 14, y);

  doc.save(`SMOCO-Fatturazione EXTRA RACCOLTA ${mese} ${anno}.pdf`);
}