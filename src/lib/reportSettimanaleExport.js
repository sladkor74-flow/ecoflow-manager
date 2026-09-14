// Esportazione in PDF del report settimanale della raccolta primaria RETE.
// A4 orizzontale: fascia di intestazione, riquadri di sintesi, tabella per regione
// e raccoglitore con le settimane del mese e l'avanzamento sul target, totali,
// legenda e numero di pagina.

import { jsPDF } from 'jspdf';
import { formatTonnellate, formatPercentuale } from '@/lib/utils';

const C = {
  scuro: [15, 76, 92],
  medio: [26, 127, 142],
  chiaro: [226, 238, 241],
  zebra: [248, 251, 252],
  bordo: [214, 222, 226],
  testo: [30, 41, 59],
  tenue: [150, 160, 168],
  grigio: [110, 120, 130],
  rosso: [190, 40, 40],
  verde: [22, 128, 60],
  ambra: [217, 119, 6],
  blu: [2, 132, 199],
  viola: [124, 58, 237],
  bianco: [255, 255, 255],
};

const t = (v) => formatTonnellate(v);
const dataIt = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
const coloreAvanzamento = (p) => (p >= 100 ? C.verde : p >= 70 ? C.blu : p >= 40 ? C.ambra : C.rosso);

export function esportaReportSettimanalePdf(report, gruppi, totale) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 10;
  const meseTesto = `${report.nome_mese} ${report.anno}`;
  const mm = `${String(report.mese).padStart(2, '0')}/${report.anno}`;

  // Colonne: raccoglitore, target, settimane, residue, raccolte, % target, residuo anno, totale anno
  const nSett = report.settimane.length;
  const fisse = { nome: 50, target: 21, residue: 21, raccolte: 21, perc: 26, residuoAnno: 23, totaleAnno: 23 };
  const lSett = (W - 2 * M - Object.values(fisse).reduce((s, v) => s + v, 0)) / Math.max(1, nSett);
  const colonne = [
    { chiave: 'nome', w: fisse.nome, titolo: ['Raccoglitore'], sx: true },
    { chiave: 'target', w: fisse.target, titolo: ['Target', report.nome_mese] },
    ...report.settimane.map(s => ({ chiave: 'w', w: lSett, titolo: [`W${s.numero}`, `${dataIt(s.dal).slice(0, 5)}–${dataIt(s.al).slice(0, 5)}`] })),
    { chiave: 'residue', w: fisse.residue, titolo: ['Residue', mm], separatore: true },
    { chiave: 'raccolte', w: fisse.raccolte, titolo: ['Raccolte', mm] },
    { chiave: 'perc', w: fisse.perc, titolo: ['% target', 'del mese'] },
    { chiave: 'residuoAnno', w: fisse.residuoAnno, titolo: ['Residuo', 'annuo'], separatore: true },
    { chiave: 'totaleAnno', w: fisse.totaleAnno, titolo: ['Totale', String(report.anno)] },
  ];

  let y = 0;
  let pagina = 1;

  const intestazionePagina = () => {
    doc.setFillColor(...C.scuro);
    doc.rect(0, 0, W, 22, 'F');
    doc.setFillColor(...C.medio);
    doc.rect(0, 22, W, 1.4, 'F');
    doc.setTextColor(...C.bianco);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('SMOCO S.r.l.  ·  COMMESSA ECOTYRE  ·  REPORT SETTIMANALE', M, 8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(`Raccolta primaria rete — ${meseTesto}`, M, 16.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Formulari terminati per data di fine trasporto', W - M, 10, { align: 'right' });
    if (report.dati_fino_al) doc.text(`Dati fino al ${dataIt(report.dati_fino_al)}`, W - M, 15.5, { align: 'right' });
    y = 29;
  };

  const piede = () => {
    doc.setDrawColor(...C.bordo);
    doc.line(M, H - 9, W - M, H - 9);
    doc.setTextColor(...C.grigio);
    doc.setFontSize(6.8);
    doc.text('Settimane da lunedì a domenica: quelle a cavallo di due mesi contano solo i giorni del mese.  Residue = target del mese - raccolto del mese.  Residuo annuo = target annuo - raccolto dell\'anno.  Solo canale RETE.', M, H - 5);
    doc.text(`Esportato il ${new Date().toLocaleString('it-IT')}  ·  Pagina ${pagina}`, W - M, H - 5, { align: 'right' });
    pagina++;
  };

  const riquadri = () => {
    const perc = totale.target_mese > 0 ? (totale.raccolto_mese / totale.target_mese) * 100 : null;
    const oggi = report.oggi || '';
    const iCorr = report.settimane.findIndex(s => s.dal <= oggi && oggi <= s.al);
    const iSett = iCorr >= 0 ? iCorr : nSett - 1;
    const elenco = [
      { etichetta: `Target ${report.nome_mese}`, valore: `${t(totale.target_mese)} t`, colore: C.blu },
      { etichetta: `Raccolto ${report.nome_mese}`, valore: `${t(totale.raccolto_mese)} t`, colore: C.verde, barra: perc },
      { etichetta: 'Residuo del mese', valore: `${t(totale.residuo_mese)} t`, colore: C.ambra },
      { etichetta: iCorr >= 0 ? `Settimana in corso W${report.settimane[iSett].numero}` : `Ultima settimana W${report.settimane[iSett]?.numero ?? ''}`, valore: `${t(totale.settimane[iSett] || 0)} t`, colore: C.viola },
      { etichetta: `Totale raccolto ${report.anno}`, valore: `${t(totale.totale_anno)} t`, colore: C.scuro, sotto: `residuo annuo ${t(totale.residuo_anno)} t` },
    ];
    const gap = 4;
    const lw = (W - 2 * M - gap * (elenco.length - 1)) / elenco.length;
    const h = 17;
    elenco.forEach((r, i) => {
      const x = M + i * (lw + gap);
      doc.setFillColor(...C.zebra);
      doc.setDrawColor(...C.bordo);
      doc.roundedRect(x, y, lw, h, 1.8, 1.8, 'FD');
      doc.setFillColor(...r.colore);
      doc.rect(x, y + 1.5, 1.4, h - 3, 'F');
      doc.setTextColor(...C.grigio);
      doc.setFontSize(7);
      doc.text(r.etichetta, x + 4.5, y + 5);
      doc.setTextColor(...C.testo);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12.5);
      doc.text(r.valore, x + 4.5, y + 11.5);
      doc.setFont('helvetica', 'normal');
      if (r.barra !== undefined && r.barra !== null) {
        const bx = x + 4.5, bw = lw - 22, by = y + 13.6;
        doc.setFillColor(...C.chiaro);
        doc.roundedRect(bx, by, bw, 1.6, 0.8, 0.8, 'F');
        if (r.barra > 0) {
          doc.setFillColor(...coloreAvanzamento(r.barra));
          doc.roundedRect(bx, by, Math.max(1.6, bw * Math.min(r.barra, 100) / 100), 1.6, 0.8, 0.8, 'F');
        }
        doc.setTextColor(...C.grigio);
        doc.setFontSize(6.5);
        doc.text(`${formatPercentuale(r.barra)}%`, x + lw - 3, by + 1.4, { align: 'right' });
      } else if (r.sotto) {
        doc.setTextColor(...C.grigio);
        doc.setFontSize(6.5);
        doc.text(r.sotto, x + 4.5, y + 15);
      }
    });
    y += h + 5;
  };

  const intestazioneTabella = () => {
    const h = 10;
    doc.setFillColor(...C.scuro);
    doc.roundedRect(M, y, W - 2 * M, h, 1.2, 1.2, 'F');
    doc.setTextColor(...C.bianco);
    let x = M;
    for (const c of colonne) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.3);
      doc.text(c.titolo[0], c.sx ? x + 3 : x + c.w - 2.5, y + 4.3, { align: c.sx ? 'left' : 'right' });
      if (c.titolo[1]) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.3);
        doc.text(c.titolo[1], c.sx ? x + 3 : x + c.w - 2.5, y + 7.8, { align: c.sx ? 'left' : 'right' });
      }
      if (c.separatore) {
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.1);
        doc.line(x, y + 2, x, y + h - 2);
      }
      x += c.w;
    }
    doc.setFont('helvetica', 'normal');
    y += h;
  };

  const spazio = (h) => {
    if (y + h <= H - 12) return;
    piede();
    doc.addPage();
    intestazionePagina();
    intestazioneTabella();
  };

  // celle: { nome, target, w: [], residue, raccolte, perc, residuoAnno, totaleAnno } come oggetti { testo, colore, grassetto }
  const riga = (celle, stile) => {
    const h = stile.h || 6;
    spazio(h);
    if (stile.sfondo) {
      doc.setFillColor(...stile.sfondo);
      doc.rect(M, y, W - 2 * M, h, 'F');
    }
    if (stile.accento) {
      doc.setFillColor(...stile.accento);
      doc.rect(M, y, 1.2, h, 'F');
    }
    if (!stile.senzaBordo) {
      doc.setDrawColor(...C.bordo);
      doc.setLineWidth(0.1);
      doc.line(M, y + h, W - M, y + h);
    }
    let x = M;
    let iw = 0;
    for (const c of colonne) {
      const cella = c.chiave === 'w' ? celle.w[iw++] : celle[c.chiave];
      if (c.chiave === 'perc' && cella && cella.barra !== undefined) {
        if (cella.barra !== null) {
          const bw = c.w - 13, bx = x + 2, by = y + h / 2 - 0.8;
          doc.setFillColor(...(stile.sfondo && stile.sfondo !== C.zebra ? C.bianco : C.chiaro));
          doc.roundedRect(bx, by, bw, 1.6, 0.8, 0.8, 'F');
          if (cella.barra > 0) {
            doc.setFillColor(...coloreAvanzamento(cella.barra));
            doc.roundedRect(bx, by, Math.max(1.6, bw * Math.min(cella.barra, 100) / 100), 1.6, 0.8, 0.8, 'F');
          }
          doc.setTextColor(...(stile.colore || C.testo));
          doc.setFont('helvetica', stile.grassetto ? 'bold' : 'normal');
          doc.setFontSize(6.8);
          doc.text(`${Math.round(cella.barra)}%`, x + c.w - 2.5, y + h - 1.9, { align: 'right' });
        }
      } else if (cella && cella.testo !== undefined && cella.testo !== '') {
        doc.setTextColor(...(cella.colore || stile.colore || C.testo));
        doc.setFont('helvetica', cella.grassetto || stile.grassetto ? 'bold' : 'normal');
        doc.setFontSize(c.sx ? 7.6 : 7.4);
        const testo = c.sx ? doc.splitTextToSize(String(cella.testo), c.w - 5)[0] : String(cella.testo);
        doc.text(testo, c.sx ? x + (stile.rientro ? 5 : 3) : x + c.w - 2.5, y + h - 1.9, { align: c.sx ? 'left' : 'right' });
      }
      x += c.w;
    }
    doc.setFont('helvetica', 'normal');
    y += h;
  };

  const numero = (v, opz = {}) => ({ testo: t(v), colore: v === 0 && !opz.sempre ? C.tenue : opz.colore });
  const perc = (fatto, atteso) => ({ barra: atteso > 0 ? (fatto / atteso) * 100 : null });

  intestazionePagina();
  riquadri();
  intestazioneTabella();
  gruppi.forEach((g) => {
    spazio(12);
    riga({
      nome: { testo: g.regione.toUpperCase() },
      target: numero(g.totale.target_mese, { sempre: true }),
      w: g.totale.settimane.map(v => numero(v, { colore: C.scuro })),
      residue: numero(g.totale.residuo_mese, { sempre: true }),
      raccolte: numero(g.totale.raccolto_mese, { sempre: true }),
      perc: perc(g.totale.raccolto_mese, g.totale.target_mese),
      residuoAnno: numero(g.totale.residuo_anno, { sempre: true }),
      totaleAnno: numero(g.totale.totale_anno, { sempre: true }),
    }, { sfondo: C.chiaro, accento: C.medio, grassetto: true, colore: C.scuro, h: 6.5, senzaBordo: true });
    g.righe.forEach((r, i) => {
      const etichetta = `${r.raccoglitore}${r.non_raccoglie ? '  · non raccoglie' : ''}${r.senza_target ? '  · senza target' : ''}`;
      riga({
        nome: { testo: etichetta },
        target: r.non_raccoglie ? { testo: 'NR', colore: C.grigio } : numero(r.target_mese),
        w: r.settimane.map(v => numero(v)),
        residue: { testo: t(r.residuo_mese), colore: r.target_mese > 0 && r.residuo_mese > 0 ? C.rosso : r.residuo_mese < 0 ? C.verde : C.tenue },
        raccolte: { testo: t(r.raccolto_mese), grassetto: r.raccolto_mese > 0, colore: r.raccolto_mese === 0 ? C.tenue : C.testo },
        perc: perc(r.raccolto_mese, r.target_mese),
        residuoAnno: { testo: t(r.residuo_anno), colore: r.residuo_anno < 0 ? C.verde : C.testo },
        totaleAnno: numero(r.totale_anno),
      }, { sfondo: i % 2 ? C.zebra : null, rientro: true });
    });
  });
  y += 1.5;
  riga({
    nome: { testo: 'TOTALE' },
    target: { testo: t(totale.target_mese) },
    w: totale.settimane.map(v => ({ testo: t(v) })),
    residue: { testo: t(totale.residuo_mese) },
    raccolte: { testo: t(totale.raccolto_mese) },
    perc: perc(totale.raccolto_mese, totale.target_mese),
    residuoAnno: { testo: t(totale.residuo_anno) },
    totaleAnno: { testo: t(totale.totale_anno) },
  }, { sfondo: C.scuro, grassetto: true, colore: C.bianco, h: 7.5, senzaBordo: true });
  piede();

  doc.save(`Report settimanale ${report.nome_mese} ${report.anno}.pdf`);
}
