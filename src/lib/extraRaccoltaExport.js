// Esportazione Excel e PDF per Extra Raccolta — formato amministrazione.
import { formattaPesi } from '@/lib/formatoExcel';
import { cifreItaliane } from '@/lib/formatoSoldi';
import { giornoRoma } from '@/lib/giornoItaliano';
import { calcExtraRaccolta, totaleRiga, aggregaPerProduttore, prezzoAttivoExtra, avvisoPesoMancante } from '@/lib/extraRaccoltaCalc';

// Il prezzo in colonna e' quello con cui la riga si fattura: il prezzo scritto
// sull'intervento o, se manca, la tariffa della tabella o la base dell'anno.
// Scritto zero, il report diceva un prezzo e la fattura un altro.
//
// IL CONTESTO E' QUELLO DELLA PAGINA (chiusura dell'audit, 11/10/2026). Il file
// chiamava prezzoAttivoExtra, totaleRiga e aggregaPerProduttore senza le tariffe
// che la pagina ha letto, e conosceva solo il prezzo scritto e la base dell'anno:
// con la Tariffa EXTRA_RACCOLTA a un valore diverso dalla base, o dal 2027, il
// file diceva un prezzo e la pagina e la fattura un altro. Ora la pagina passa
// il suo contesto (contestoPrezzi di extraRaccoltaCalc.js); senza, restano i
// due gradini che non hanno bisogno di letture.
const prezzoRiga = (r, contesto) => prezzoAttivoExtra(r, contesto).valore;

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

// Numeri e date nel PDF all'italiana: punto per le migliaia, virgola per i
// decimali, euro con due, il giorno italiano gg/mm/aaaa (11/10/2026). Prima il
// PDF scriveva String(numero): «404» per 404,00 euro e «3000» per 3.000 kg.
const euroPdf = (v) => cifreItaliane(v, 2, 2);
const prezzoPdf = (v) => cifreItaliane(v, 2, 4);
const kgPdf = (v) => (v === null || v === undefined ? '—' : cifreItaliane(v, 0, 0));
const giornoPdf = (v) => { const g = giornoRoma(v); return g ? g.split('-').reverse().join('/') : ''; };

/**
 * I NUMERI DEL FILE, CALCOLATI UNA VOLTA PER EXCEL E PDF (chiusura dell'audit,
 * 11/10/2026).
 *
 * Il «Totale imponibile» sommava i sovracosti del ricavo di TUTTI gli
 * interventi, anche di quelli che la fattura non conta: un terminato senza peso
 * effettivo e una secondaria restano fuori dalla fattura per intero, sovracosti
 * compresi. Un intervento da 2.000 kg a 202 €/t con 50 € di sovracosto e una
 * scheda vecchia senza peso con altri 50 €: il file diceva 504,00 di imponibile
 * e 454,00 di ricavi nell'analisi per produttore, la fattura 454,00. Ora i
 * sovracosti si sommano solo per chi entra in fattura (calcExtraRaccolta(r).fatturato)
 * e il totale imponibile e' la somma dei ricavi, gli stessi della fattura e
 * dell'analisi per produttore. Chi ha il peso che manca si elenca, con la frase
 * della fattura, e i suoi chili si scrivono «—», non 0.
 *
 * Torna { righe: [{ record, kg, prezzo, totale }], totale_kg, sovracosto_raccolta,
 * sovracosto_trasporto, sovracosto_trattamento, totale_imponibile, senza_peso,
 * per_produttore }.
 */
export function datiExportExtra(records, contesto) {
  const elenco = records || [];
  const righe = [];
  const senzaPeso = [];
  let totKg = 0, sovraRaccolta = 0, sovraTrasporto = 0, sovraTrattamento = 0, imponibile = 0;
  for (const r of elenco) {
    const c = calcExtraRaccolta(r, contesto);
    if (!c.senza_peso) totKg += c.kg;
    if (c.fatturato) {
      sovraRaccolta += r2(Number(r.sovracosto_raccolta || 0));
      sovraTrasporto += r2(Number(r.sovracosto_trasporto || 0));
      sovraTrattamento += r2(Number(r.sovracosto_trattamento || 0));
      imponibile += c.ricavo;
    }
    if (c.senza_peso) senzaPeso.push({ numero_fir: r.numero_fir || r.id_ordine || '', avviso: avvisoPesoMancante(r) });
    righe.push({ record: r, kg: c.senza_peso ? null : c.kg, prezzo: prezzoRiga(r, contesto), totale: totaleRiga(r, contesto) });
  }
  return {
    righe,
    totale_kg: totKg,
    sovracosto_raccolta: r2(sovraRaccolta),
    sovracosto_trasporto: r2(sovraTrasporto),
    sovracosto_trattamento: r2(sovraTrattamento),
    totale_imponibile: r2(imponibile),
    senza_peso: senzaPeso,
    per_produttore: aggregaPerProduttore(elenco, contesto),
  };
}

const TITOLO_SENZA_PESO = 'DA SISTEMARE: interventi terminati senza peso effettivo, fuori dalla fattura e dal totale imponibile';

export async function exportExtraRaccoltaExcel(records, mese, anno, contesto) {
  // xlsx pesa mezzo megabyte: si carica quando si esporta, non all'apertura.
  const XLSX = await import('xlsx');
  const sheetName = `${MESI_UPPER[mese] || String(mese).toUpperCase()} ${anno}`;
  const dati = datiExportExtra(records, contesto);
  const wsData = [];

  // === Area 1: righe intervento ===
  wsData.push([
    'Nr. FIR', 'PRODUTTORE', 'TRASPORTATORE', 'DESTINATARIO',
    'DATA INIZIO TRASPORTO', 'DATA FINE TRASPORTO',
    'CER', 'TIPOLOGIA TRASPORTO', "QUANTITA' (kg)", 'PREZZO (Euro/ton)', 'TOTALE (Euro)'
  ]);

  for (const x of dati.righe) {
    const r = x.record;
    wsData.push([
      r.numero_fir || '',
      r.produttore || '',
      r.trasportatore || '',
      r.destinazione || '',
      toDate(r.trasporto_iniziato_il) || '',
      toDate(r.trasporto_finito_il) || '',
      r.cer || '160103',
      r.tipologia_trasporto || '',
      // Un peso che manca non e' zero: «—», come nella pagina.
      x.kg === null ? '—' : x.kg,
      x.prezzo,
      x.totale,
    ]);
  }

  // === Area 2: riepilogo ===
  wsData.push([]);
  wsData.push(["TOTALE QUANTITA' (kg)", dati.totale_kg]);
  wsData.push(['Sovracosto Raccolta', dati.sovracosto_raccolta]);
  wsData.push(['Sovracosto Trasporto', dati.sovracosto_trasporto]);
  wsData.push(['Sovracosto Trattamento', dati.sovracosto_trattamento]);
  wsData.push(['Totale imponibile', dati.totale_imponibile]);
  if (dati.senza_peso.length) {
    wsData.push([]);
    wsData.push([TITOLO_SENZA_PESO]);
    for (const s of dati.senza_peso) wsData.push([s.numero_fir, s.avviso]);
  }

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

  const byProd = dati.per_produttore;
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
  wsData.push(['Margine % complessivo', `${cifreItaliane(margPercTot, 2, 2)}%`]);

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

export async function exportExtraRaccoltaPDF(records, mese, anno, contesto) {
  // jspdf si carica quando si stampa, non all'apertura della pagina.
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const dati = datiExportExtra(records, contesto);

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

  for (const riga of dati.righe) {
    if (y > 195) { doc.addPage(); y = 15; }
    const r = riga.record;
    x = 14;
    const row = [
      String(r.numero_fir || '').substring(0, 14),
      String(r.produttore || '').substring(0, 24),
      String(r.trasportatore || '').substring(0, 24),
      String(r.destinazione || '').substring(0, 24),
      giornoPdf(r.trasporto_iniziato_il), giornoPdf(r.trasporto_finito_il),
      String(r.cer || '160103').substring(0, 10),
      String(r.tipologia_trasporto || '').substring(0, 18),
      kgPdf(riga.kg),
      prezzoPdf(riga.prezzo),
      euroPdf(riga.totale),
    ];
    row.forEach((cell, i) => { doc.text(cell, x, y); x += W1[i]; });
    y += 4.5;
  }

  // === Area 2: riepilogo ===
  y += 3;
  doc.setFont(undefined, 'bold');
  doc.text('RIEPILOGO', 14, y); y += 5;
  doc.setFont(undefined, 'normal');
  doc.text(`Totale quantita' (kg): ${kgPdf(dati.totale_kg)}`, 14, y); y += 5;
  doc.text(`Sovracosto Raccolta: ${euroPdf(dati.sovracosto_raccolta)}`, 14, y); y += 5;
  doc.text(`Sovracosto Trasporto: ${euroPdf(dati.sovracosto_trasporto)}`, 14, y); y += 5;
  doc.text(`Sovracosto Trattamento: ${euroPdf(dati.sovracosto_trattamento)}`, 14, y); y += 5;
  doc.text(`Totale imponibile: ${euroPdf(dati.totale_imponibile)}`, 14, y); y += 8;
  if (dati.senza_peso.length) {
    if (y > 185) { doc.addPage(); y = 15; }
    doc.setFont(undefined, 'bold');
    doc.text(TITOLO_SENZA_PESO, 14, y); y += 5;
    doc.setFont(undefined, 'normal');
    for (const s of dati.senza_peso) {
      if (y > 195) { doc.addPage(); y = 15; }
      doc.text(s.avviso, 14, y, { maxWidth: 265 });
      y += 8;
    }
    y += 2;
  }

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

  const byProd = dati.per_produttore;
  let tCA = 0, tR = 0, tS = 0, tTr = 0, tP = 0, tTrasp = 0, tSRac = 0, tSImp = 0, tCT = 0, tRi = 0, tM = 0;

  for (const [p, v] of Object.entries(byProd)) {
    if (y > 195) { doc.addPage(); y = 15; }
    x = 14;
    const row = [
      String(p).substring(0, 20),
      euroPdf(v.costi_aggiuntivi), euroPdf(v.raccolta), euroPdf(v.stoccaggio), euroPdf(v.trattamento),
      euroPdf(v.pulizia), euroPdf(v.trasporto), euroPdf(v.sovracosto_raccoglitore), euroPdf(v.sovracosto_impianto),
      euroPdf(v.costo_totale), euroPdf(v.ricavi), euroPdf(v.margine),
    ];
    row.forEach((cell, i) => { doc.text(String(cell), x, y); x += W2[i]; });
    y += 4.5;
    tCA += v.costi_aggiuntivi; tR += v.raccolta; tS += v.stoccaggio; tTr += v.trattamento;
    tP += v.pulizia; tTrasp += v.trasporto; tSRac += v.sovracosto_raccoglitore; tSImp += v.sovracosto_impianto;
    tCT += v.costo_totale; tRi += v.ricavi; tM += v.margine;
  }

  x = 14;
  doc.setFont(undefined, 'bold');
  ['TOTALE', euroPdf(tCA), euroPdf(tR), euroPdf(tS), euroPdf(tTr), euroPdf(tP), euroPdf(tTrasp), euroPdf(tSRac), euroPdf(tSImp), euroPdf(tCT), euroPdf(tRi), euroPdf(tM)].forEach((cell, i) => {
    doc.text(String(cell), x, y); x += W2[i];
  });
  y += 6;
  const mPerc = tRi !== 0 ? r2((tM / tRi) * 100) : 0;
  doc.text(`Margine % complessivo: ${cifreItaliane(mPerc, 2, 2)}%`, 14, y);

  doc.save(`SMOCO-Fatturazione EXTRA RACCOLTA ${mese} ${anno}.pdf`);
}
