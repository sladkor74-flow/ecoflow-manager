// Esportazione in Excel e in PDF di una tabella di dettaglio (ordini, righe di
// fatturazione). Le colonne descrivono titolo, valore e tipo; i formati seguono
// le regole del gestionale: kg interi, tonnellate con 2-3 decimali, euro con 2
// decimali, prezzi unitari con 4.
//
// colonne: [{ titolo, valore: (riga) => any, tipo: 'testo'|'kg'|'t'|'euro'|'prezzo'|'prezzoLibero'|'data'|'intero', peso?: number }]
// totali:  { etichetta, valori: { [indiceColonna]: numero } }
// subtotali (solo PDF): [{ dopo, etichetta, valori }] - righe di totale in mezzo
//   alla tabella, scritte dopo le prime `dopo` righe; il piede non le conta.
// documento: { canale, periodo, entita, perFineTrasporto, stato } - il blocco di
//   testa comune (intestazioneDocumento di fogliProfessionali.js): canale,
//   periodo per fine trasporto, dati fino al degli archivi in entita, generato
//   il ... da .... Senza, il file dice solo quando e da chi e' stato generato.
//
// LA STESSA TESTA PER EXCEL E PDF (chiusura dell'audit, 11/10/2026). L'Excel
// usciva da SheetJS, senza fascia ne' piede; il PDF diceva «Esportato il ...» e
// nessuno dei due diceva fino a che giorno arrivano i dati. Ora tutti e due
// prendono il blocco di testa da intestazioneDocumento, e il piede del PDF dice
// «Pagina x di N» su ogni pagina.

import { formatNumber, formatKg, formatTonnellate, formatIntero } from '@/lib/utils';
import { giornoRoma } from '@/lib/giornoItaliano';
import { documentoDa, nuovaCartella, foglioDaRighe, scaricaCartella, ENTE } from '@/lib/fogliProfessionali';

// IL PREZZO LIBERO: due decimali, fino a quattro se servono (revisione delle
// migliorie, 11/10/2026). Col tipo 'euro', fisso a due, un prezzo al chilo da
// 0,202 nel PDF dell'extra raccolta usciva «0,20 €», mentre l'Excel dello stesso
// mese, col formato '#,##0.00##', diceva 0,202: due prezzi per la stessa riga.
// 'prezzoLibero' ha il formato dell'Excel (FORMATI.prezzoLibero di
// fogliProfessionali.js) e nel PDF scrive come cifreItaliane(v, 2, 4). 'euro'
// resta a due decimali e 'prezzo' a quattro: gli altri export non cambiano.
const NUMERICI = new Set(['kg', 't', 'euro', 'prezzo', 'prezzoLibero', 'intero', 'percentuale']);
const FORMATO_EXCEL = { kg: '#,##0', t: '#,##0.00#', euro: '#,##0.00', prezzo: '#,##0.0000', prezzoLibero: '#,##0.00##', intero: '#,##0', percentuale: '#,##0.0"%"', data: 'dd/mm/yyyy' };

// IL GIORNO DI UNA DATA E' QUELLO ITALIANO, e lo dice giornoRoma (chiusura
// dell'audit, 11/10/2026). Qui c'era una correzione fatta a mano che riportava al
// giorno giusto solo le 22:00 e le 23:00 tonde: un trasporto finito alle 23:30 UTC
// del 30 giugno, in Italia gia' il 1° luglio, nel file usciva al 30 giugno mentre
// il resto del gestionale lo conta a luglio. Era la stessa trappola tolta dal
// report settimanale il 10/10. La data esce come mezzanotte UTC del giorno
// italiano: la cella dell'Excel e il testo del PDF, letto in UTC, dicono lo stesso
// giorno.
const comeData = (v) => {
  const g = giornoRoma(v);
  return g ? new Date(`${g}T00:00:00.000Z`) : null;
};

function testoCella(valore, tipo) {
  if (valore === null || valore === undefined || valore === '') return tipo && NUMERICI.has(tipo) ? '' : '—';
  // Un testo in una colonna di numeri si scrive com'e': «—» per un peso che
  // manca, «12,34%» in fondo a una colonna di euro. Passato dal formato dei
  // numeri diventava «0» (11/10/2026).
  if (typeof valore === 'string' && NUMERICI.has(tipo) && !Number.isFinite(Number(valore))) return valore;
  switch (tipo) {
    case 'kg': return formatKg(valore);
    case 't': return formatTonnellate(valore);
    case 'euro': return `${formatNumber(valore, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
    case 'prezzo': return `${formatNumber(valore, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} €`;
    case 'prezzoLibero': return `${formatNumber(valore, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} €`;
    case 'intero': return formatIntero(valore);
    // Una percentuale non e' un euro: senza il suo tipo finiva in euro, come ogni
    // numero senza tipo (06/10/2026).
    case 'percentuale': return `${formatNumber(valore, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
    case 'data': { const d = comeData(valore); return d ? d.toLocaleDateString('it-IT', { timeZone: 'UTC' }) : '—'; }
    default: return String(valore);
  }
}

const nomeSicuro = (s) => String(s).replace(/[\\/:*?"<>|]+/g, '-').trim();

// Il font dei PDF (Helvetica) non ha frecce, puntini di sospensione e simili: lasciati
// cosi' diventano segni a caso e allargano la riga. Si scrivono con caratteri che ha.
const perPdf = (t) => String(t ?? '').replace(/[→➜➔]/g, '>').replace(/←/g, '<').replace(/…/g, '...').replace(/[≤]/g, '<=').replace(/[≥]/g, '>=').replace(/[⋮]/g, ':').replace(/[\u2028\u2029]/g, ' ');

/**
 * Foglio Excel col blocco di testa del documento, intestazioni, righe e totali
 * formattati: il corredo dei fogli che si mandano fuori (fogliProfessionali.js).
 * Le celle sono le stesse di prima: numeri veri, date vere, vuote dove manca.
 */
export async function esportaTabellaExcel({ nomeFile, foglio = 'Dettaglio', titolo, sottotitolo, colonne, righe, totali, documento }) {
  const intest = await documentoDa({ titolo, sottotitolo, ...(documento || {}) });
  const tabella = [colonne.map(c => c.titolo)];
  for (const r of righe) {
    tabella.push(colonne.map(c => {
      const v = c.valore(r);
      if (c.tipo === 'data') return comeData(v);
      if (NUMERICI.has(c.tipo)) return v === null || v === undefined || v === '' ? null : Number(v);
      return v ?? '';
    }));
  }
  const stili = {};
  if (totali) {
    tabella.push([]);
    tabella.push(colonne.map((c, i) => (i === 0 ? totali.etichetta : (totali.valori[i] ?? null))));
    stili[tabella.length - 1] = 'totale';
  }
  const { wb } = await nuovaCartella();
  const ws = foglioDaRighe(wb, foglio, {
    doc: intest, righe: tabella, testate: [0], stili,
    // il formato lo dice il tipo della colonna, non il titolo
    formati: Object.fromEntries(colonne.map((c, i) => [i, FORMATO_EXCEL[c.tipo] || null])),
    larghezze: colonne.map(c => Math.max(10, Math.min(45, Math.round((c.peso || 1) * 12)))),
  });
  const testata = ws.views && ws.views[0] ? ws.views[0].ySplit : 1;
  ws.autoFilter = { from: { row: testata, column: 1 }, to: { row: testata + righe.length, column: colonne.length } };
  return scaricaCartella(wb, `${nomeSicuro(nomeFile)}.xlsx`);
}

const C = {
  scuro: [15, 76, 92], medio: [26, 127, 142], chiaro: [226, 238, 241], zebra: [247, 250, 251],
  bordo: [214, 222, 226], testo: [30, 41, 59], grigio: [110, 120, 130], bianco: [255, 255, 255], ambra: [180, 83, 9], rosso: [185, 28, 28],
  // La riga del surplus sulle tariffe (il Fuel Surcharge, 13/10/2026): la forma
  // dei fogli della passiva (passivaAmministrazionePdf.js), il testo indaco
  // scuro in corsivo sul fondo indaco chiaro, con la barra a sinistra. Indaco e
  // non ambra o rosso, che qui vogliono dire «c'e' un problema».
  surplus: [55, 48, 163], surplusChiaro: [238, 242, 255], surplusBarra: [99, 102, 241],
};

/**
 * Le righe del documento sotto la fascia, su ogni pagina: canale e periodo per
 * fine trasporto, dati fino al, e gli avvisi sui caricamenti in ambra. Chi
 * genera e quando sta nel piede. Restituisce di quanto scendere (mm).
 */
function righeDelDocumento(doc, intest, { M, W, y }) {
  const contesto = intest.righe.filter(r => r !== intest.generato).join('  ·  ');
  let giu = 0;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  // Con piu' archivi la riga si allunga: va a capo invece di uscire dal foglio.
  const scrivi = (testo, colore) => {
    doc.setTextColor(...colore);
    for (const linea of doc.splitTextToSize(perPdf(testo), W - 2 * M)) {
      doc.text(linea, M, y + giu);
      giu += 3.6;
    }
  };
  if (contesto) scrivi(contesto, C.grigio);
  for (const a of intest.avvisi || []) scrivi(a, C.ambra);
  return giu;
}

/**
 * Il piede di ogni pagina, scritto alla fine, quando si sa quante sono: chi ha
 * generato il file e quando, e «Pagina x di N». Prima ogni pagina diceva solo il
 * suo numero, e chi ne riceveva tre non sapeva se ne mancava una.
 */
function piedi(doc, intest, { M, W, H, sinistra = '' }) {
  const n = doc.internal.getNumberOfPages();
  for (let p = 1; p <= n; p++) {
    doc.setPage(p);
    doc.setDrawColor(...C.bordo);
    doc.setLineWidth(0.2);
    doc.line(M, H - 9, W - M, H - 9);
    doc.setTextColor(...C.grigio);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    if (sinistra) doc.text(perPdf(sinistra), M, H - 5);
    doc.text(perPdf(`${intest.generato}  ·  Pagina ${p} di ${n}`), W - M, H - 5, { align: 'right' });
  }
}

/**
 * PDF A4 orizzontale: fascia di intestazione, tabella con intestazioni ripetute a
 * ogni pagina, righe alternate, totali e numero di pagina.
 * colore(riga) opzionale: 'ambra' o 'rosso' per evidenziare una riga, 'surplus'
 * per la riga di un surplus sulle tariffe.
 *
 * LE RIGHE DI TOTALE IN MEZZO ALLA TABELLA (subtotali, 14/10/2026). Il report
 * dell'attiva col surplus vuole sotto i formulari il «Totale formulari», poi le
 * righe dei surplus, poi il TOTALE, come il suo Excel. Con un solo `totali` il
 * «Totale formulari» poteva stare solo nel sottotitolo: messo fra le righe, il
 * piede l'avrebbe contato («382 righe» per 380 formulari e un surplus).
 * subtotali: [{ dopo, etichetta, valori: { [indiceColonna]: numero } }], ognuno
 * scritto dopo le prime `dopo` righe, in grassetto e nel colore dei totali, con
 * l'etichetta nella prima colonna come il TOTALE. Il piede conta solo le righe.
 */
export async function esportaTabellaPdf({ nomeFile, intestazione, titolo, sottotitolo, colonne, righe, totali, subtotali, colore, documento }) {
  const intest = await documentoDa({ titolo, sottotitolo, ...(documento || {}) });
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 10;
  const pesoTotale = colonne.reduce((s, c) => s + (c.peso || 1), 0);
  const larghezze = colonne.map(c => ((W - 2 * M) * (c.peso || 1)) / pesoTotale);
  let y = 0;

  const testata = () => {
    doc.setFillColor(...C.scuro);
    doc.rect(0, 0, W, 20, 'F');
    doc.setFillColor(...C.medio);
    doc.rect(0, 20, W, 1.2, 'F');
    doc.setTextColor(...C.bianco);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(intestazione || ENTE, M, 7.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(titolo, M, 15);
    if (sottotitolo) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(sottotitolo, W - M, 15, { align: 'right' });
    }
    y = 27 + righeDelDocumento(doc, intest, { M, W, y: 25.5 });
  };

  // L'intestazione va a capo invece di essere tagliata: "Prezzo Unitario (Euro/TON)"
  // deve arrivare intera, perche' l'unita' di misura fa parte del nome della colonna
  // e nell'Excel c'e'. I due formati devono dire le stesse cose.
  const intestazioni = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    const titoli = colonne.map((c, i) => doc.splitTextToSize(perPdf(c.titolo), larghezze[i] - 3).slice(0, 2));
    const alta = titoli.some(t => t.length > 1) ? 10.5 : 8;
    doc.setFillColor(...C.scuro);
    doc.roundedRect(M, y, W - 2 * M, alta, 1, 1, 'F');
    doc.setTextColor(...C.bianco);
    let x = M;
    colonne.forEach((c, i) => {
      const destra = NUMERICI.has(c.tipo);
      titoli[i].forEach((t, n) => doc.text(t, destra ? x + larghezze[i] - 2 : x + 2, y + (titoli[i].length > 1 ? 4.2 : alta / 2 + 1.2) + n * 3.3, { align: destra ? 'right' : 'left' }));
      x += larghezze[i];
    });
    y += alta;
  };

  const conteggio = `${formatIntero(righe.length)} ${righe.length === 1 ? 'riga' : 'righe'}`;

  // Anche le celle vanno a capo, fino a tre righe: una nota lunga non si perde.
  // `distesa`: la prima cella, un'etichetta di testo, si allarga sulle celle
  // vuote che la seguono invece di andare a capo. «Totale formulari» nella
  // colonna stretta della Regione del report ACI usciva su due righe.
  const vuota = (v) => v === null || v === undefined || v === '';
  const riga = (celle, { sfondo, grassetto, corsivo, barra, coloreTesto, distesa, altezza: minima = 6 } = {}) => {
    const stile = grassetto ? 'bold' : corsivo ? 'italic' : 'normal';
    doc.setFont('helvetica', stile);
    doc.setFontSize(7.4);
    let primaLarga = larghezze[0];
    if (distesa && !NUMERICI.has(colonne[0].tipo)) {
      for (let j = 1; j < colonne.length && vuota(celle[j]); j++) primaLarga += larghezze[j];
    }
    const testi = colonne.map((c, i) => {
      const v = celle[i];
      return vuota(v) ? [] : doc.splitTextToSize(perPdf(v), (i === 0 ? primaLarga : larghezze[i]) - 3).slice(0, 3);
    });
    const altezza = minima + (Math.max(1, ...testi.map(t => t.length)) - 1) * 3.3;
    if (y + altezza > H - 12) {
      doc.addPage();
      testata();
      intestazioni();
    }
    if (sfondo) {
      doc.setFillColor(...sfondo);
      doc.rect(M, y, W - 2 * M, altezza, 'F');
    }
    if (barra) {
      doc.setFillColor(...barra);
      doc.rect(M, y, 0.9, altezza, 'F');
    }
    doc.setFont('helvetica', stile);
    doc.setFontSize(7.4);
    doc.setTextColor(...(coloreTesto || C.testo));
    let x = M;
    colonne.forEach((c, i) => {
      const destra = NUMERICI.has(c.tipo);
      testi[i].forEach((t, k) => doc.text(t, destra ? x + larghezze[i] - 2 : x + 2, y + minima - 1.9 + k * 3.3, { align: destra ? 'right' : 'left' }));
      x += larghezze[i];
    });
    if (!sfondo || sfondo === C.zebra) {
      doc.setDrawColor(...C.bordo);
      doc.setLineWidth(0.1);
      doc.line(M, y + altezza, W - M, y + altezza);
    }
    y += altezza;
  };

  // Un subtotale si scrive prima della riga numero `dopo` (contata da zero), o
  // in fondo se `dopo` arriva alla fine; un numero fuori misura va in fondo.
  const posto = (s) => Math.min(Math.max(0, Math.trunc(Number(s.dopo) || 0)), righe.length);
  const subtotaliDopo = (n) => {
    for (const s of subtotali || []) {
      if (posto(s) !== n) continue;
      y += 1.5;
      riga(colonne.map((c, i) => (i === 0 ? s.etichetta : (s.valori && s.valori[i] !== undefined ? testoCella(s.valori[i], c.tipo) : ''))),
        { grassetto: true, coloreTesto: C.scuro, distesa: true });
    }
  };

  testata();
  intestazioni();
  if (!righe.length) {
    riga(colonne.map((c, i) => (i === 0 ? 'Nessuna riga' : '')), { coloreTesto: C.grigio });
  }
  righe.forEach((r, i) => {
    subtotaliDopo(i);
    const evidenza = colore ? colore(r) : null;
    const surplus = evidenza === 'surplus';
    riga(colonne.map(c => testoCella(c.valore(r), c.tipo)), {
      sfondo: surplus ? C.surplusChiaro : i % 2 ? C.zebra : null,
      corsivo: surplus,
      barra: surplus ? C.surplusBarra : null,
      coloreTesto: evidenza ? C[evidenza] : null,
    });
  });
  subtotaliDopo(righe.length);
  if (totali) {
    y += 1.5;
    riga(colonne.map((c, i) => (i === 0 ? totali.etichetta : (totali.valori[i] !== undefined ? testoCella(totali.valori[i], c.tipo) : ''))),
      { sfondo: C.chiaro, grassetto: true, coloreTesto: C.scuro, altezza: 7 });
  }
  piedi(doc, intest, { M, W, H, sinistra: conteggio });
  doc.save(`${nomeSicuro(nomeFile)}.pdf`);
}

/**
 * PDF A4 orizzontale a SEZIONI: piu' tabelle una sotto l'altra, ciascuna col suo
 * titolo e le sue colonne (la fatturazione passiva ne ha tre: raccoglitori,
 * impianti e stoccaggi, trasporto delle secondarie). Stessa grafica di
 * esportaTabellaPdf. Le intestazioni della sezione si ripetono a ogni cambio pagina.
 *
 * sezioni: [{ titolo, colonne: [{ titolo, tipo, peso }], righe: [{ celle: [...], stile?: 'gruppo'|'totale' }] }]
 * riepilogo: [{ etichetta, valore }] mostrato sotto la testata; note: [testo] in coda.
 *
 * titoloNote: il titolo del blocco in coda. Il default nasce dalla fatturazione
 * («Anomalie da guardare prima di pagare») e li' va bene; nelle schede di
 * Giacenze le note spiegano come si leggono i numeri e quel titolo diceva
 * un'altra cosa (09/10/2026).
 */
export async function esportaSezioniPdf({ nomeFile, intestazione, titolo, sottotitolo, sezioni, riepilogo, note, titoloNote = 'Anomalie da guardare prima di pagare', documento }) {
  const intest = await documentoDa({ titolo, sottotitolo, ...(documento || {}) });
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 10;
  let y = 0;

  const testata = () => {
    doc.setFillColor(...C.scuro); doc.rect(0, 0, W, 20, 'F');
    doc.setFillColor(...C.medio); doc.rect(0, 20, W, 1.2, 'F');
    doc.setTextColor(...C.bianco);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    doc.text(intestazione || ENTE, M, 7.5);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text(titolo, M, 15);
    if (sottotitolo) { doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.text(sottotitolo, W - M, 15, { align: 'right' }); }
    y = 27 + righeDelDocumento(doc, intest, { M, W, y: 25.5 });
  };
  const nuovaPagina = () => { doc.addPage(); testata(); };

  testata();
  if (riepilogo && riepilogo.length) {
    const larghezza = (W - 2 * M) / riepilogo.length;
    riepilogo.forEach((r, i) => {
      doc.setFillColor(...C.chiaro); doc.roundedRect(M + i * larghezza, y, larghezza - 2, 13, 1, 1, 'F');
      doc.setTextColor(...C.grigio); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2); doc.text(r.etichetta, M + i * larghezza + 3, y + 4.6);
      doc.setTextColor(...C.scuro); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(typeof r.valore === 'number' ? testoCella(r.valore, r.tipo || 'euro') : perPdf(r.valore), M + i * larghezza + 3, y + 10.4);
    });
    y += 17;
  }

  for (const s of sezioni) {
    const pesoTotale = s.colonne.reduce((t, c) => t + (c.peso || 1), 0);
    const larghezze = s.colonne.map(c => ((W - 2 * M) * (c.peso || 1)) / pesoTotale);
    const intestazioni = () => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.2);
      const titoli = s.colonne.map((c, i) => doc.splitTextToSize(perPdf(c.titolo), larghezze[i] - 3).slice(0, 2));
      const alta = titoli.some(t => t.length > 1) ? 10.5 : 8;
      doc.setFillColor(...C.scuro); doc.roundedRect(M, y, W - 2 * M, alta, 1, 1, 'F');
      doc.setTextColor(...C.bianco);
      let x = M;
      s.colonne.forEach((c, i) => {
        const destra = NUMERICI.has(c.tipo);
        titoli[i].forEach((t, n) => doc.text(t, destra ? x + larghezze[i] - 2 : x + 2, y + (titoli[i].length > 1 ? 4.2 : alta / 2 + 1.2) + n * 3.3, { align: destra ? 'right' : 'left' }));
        x += larghezze[i];
      });
      y += alta;
    };
    // il titolo della sezione non resta solo in fondo alla pagina
    if (y + 26 > H - 12) nuovaPagina();
    doc.setTextColor(...C.scuro); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text(s.titolo, M, y + 4); y += 7;
    intestazioni();
    if (!s.righe.length) s.righe = [{ celle: s.colonne.map((c, i) => (i === 0 ? 'Nessuna riga' : null)) }];
    s.righe.forEach((r, n) => {
      doc.setFont('helvetica', r.stile ? 'bold' : 'normal'); doc.setFontSize(7.4);
      const testi = s.colonne.map((c, i) => {
        const v = r.celle[i];
        return v === null || v === undefined || v === '' ? [] : doc.splitTextToSize(perPdf(testoCella(v, c.tipo)), larghezze[i] - 3).slice(0, 3);
      });
      const linee = Math.max(1, ...testi.map(t => t.length));
      const altezza = (r.stile === 'totale' ? 7 : 6) + (linee - 1) * 3.3;
      if (y + altezza > H - 12) { nuovaPagina(); doc.setTextColor(...C.scuro); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(`${s.titolo} (segue)`, M, y + 4); y += 7; intestazioni(); }
      const sfondo = r.stile === 'totale' ? C.chiaro : r.stile === 'gruppo' ? C.zebra : null;
      if (sfondo) { doc.setFillColor(...sfondo); doc.rect(M, y, W - 2 * M, altezza, 'F'); }
      doc.setFont('helvetica', r.stile ? 'bold' : 'normal'); doc.setFontSize(7.4);
      doc.setTextColor(...(r.stile === 'totale' ? C.scuro : C.testo));
      let x = M;
      s.colonne.forEach((c, i) => {
        const destra = NUMERICI.has(c.tipo);
        testi[i].forEach((t, k) => doc.text(t, destra ? x + larghezze[i] - 2 : x + 2, y + 4.1 + k * 3.3, { align: destra ? 'right' : 'left' }));
        x += larghezze[i];
      });
      doc.setDrawColor(...C.bordo); doc.setLineWidth(0.1); doc.line(M, y + altezza, W - M, y + altezza);
      y += altezza;
      void n;
    });
    y += 6;
  }

  if (note && note.length) {
    if (y + 12 > H - 12) nuovaPagina();
    doc.setTextColor(...C.ambra); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text(perPdf(titoloNote), M, y + 4); y += 8;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.6); doc.setTextColor(...C.testo);
    for (const n of note) {
      const righe = doc.splitTextToSize(`•  ${perPdf(n)}`, W - 2 * M);
      if (y + righe.length * 3.8 > H - 12) nuovaPagina();
      doc.text(righe, M, y + 3); y += righe.length * 3.8 + 1.2;
    }
  }
  piedi(doc, intest, { M, W, H });
  doc.save(`${nomeSicuro(nomeFile)}.pdf`);
}
