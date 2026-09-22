// Esportazione in PDF del report settimanale della raccolta primaria RETE.
// A4 orizzontale: fascia di intestazione, riquadri di sintesi, tabella per regione
// e raccoglitore con le settimane del mese e l'avanzamento sul target, totali,
// legenda e numero di pagina. Con l'opzione impianti, sotto ogni raccoglitore gli
// impianti di destinazione del mese e in coda il riepilogo per impianto.

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

// Le date obbligatorie dei formulari (regola dell'utente del 22/09/2026), a
// parole: le stesse frasi nel PDF e a video (ReportSettimanale.jsx), che prima
// non le mostrava e chi guardava la tabella non sapeva dei terminati di rete
// esclusi. report.date_da_sistemare arriva da reportSettimanale: { senza_fine,
// nel_mese }, ciascuno { ordini, senza_fine, esempi } (riepilogoDate di
// reportSettimanali.ts) oppure null. [] se non c'e' niente da dire.
export const INTRO_DATE = 'Date obbligatorie dei formulari (immissione, inizio e fine trasporto) da inserire o correggere.';
export function frasiDateDaSistemare(report) {
  const d = report && report.date_da_sistemare;
  if (!d || (!d.senza_fine && !d.nel_mese)) return [];
  const elenco = (r) => r.esempi.map(v => `${v.id_ordine || 'senza ID'}${v.numero_fir ? ` (FIR ${v.numero_fir})` : ''}: ${v.date}`).join('; ')
    + (r.ordini > r.esempi.length ? `; e altri ${r.ordini - r.esempi.length}` : '');
  return [
    d.senza_fine ? `Senza data di fine trasporto, di qualunque periodo, e quindi non contati in nessuna settimana: ${d.senza_fine.ordini} ${d.senza_fine.ordini === 1 ? 'ordine' : 'ordini'} (${elenco(d.senza_fine)}).` : '',
    d.nel_mese ? `Di ${report.nome_mese}, contati ma con una data obbligatoria mancante o date incoerenti: ${d.nel_mese.ordini} ${d.nel_mese.ordini === 1 ? 'ordine' : 'ordini'} (${elenco(d.nel_mese)}).` : '',
  ].filter(Boolean);
}

export function esportaReportSettimanalePdf(report, gruppi, totale, { impianti = false } = {}) {
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

  // Intestazione da ripetere a ogni cambio pagina: la tabella principale o il riepilogo.
  let intestazioneRipetuta = () => intestazioneTabella();
  const spazio = (h) => {
    if (y + h <= H - 12) return;
    piede();
    doc.addPage();
    intestazionePagina();
    intestazioneRipetuta();
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

  // Impianti di destinazione del mese sotto la riga del raccoglitore.
  const FONT_IMPIANTI = 6.6;
  const ETICHETTA_IMPIANTI = 'Impianti di destinazione:';
  const lineeImpianti = (elenco) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FONT_IMPIANTI);
    const le = doc.getTextWidth(ETICHETTA_IMPIANTI) + 2;
    doc.setFont('helvetica', 'normal');
    const testo = elenco.map(i => `${i.impianto}  ${t(i.t)} t`).join('    ·    ');
    return { le, linee: doc.splitTextToSize(testo, W - 2 * M - 10 - le) };
  };
  const altezzaImpianti = (elenco) => (elenco.length ? 1.6 + lineeImpianti(elenco).linee.length * 3.1 : 0);
  const rigaImpianti = (elenco, sfondo) => {
    const { le, linee } = lineeImpianti(elenco);
    const h = altezzaImpianti(elenco);
    if (sfondo) {
      doc.setFillColor(...sfondo);
      doc.rect(M, y, W - 2 * M, h, 'F');
    }
    doc.setFillColor(...C.medio);
    doc.rect(M + 5, y + 0.4, 0.6, h - 1.8, 'F');
    doc.setFontSize(FONT_IMPIANTI);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.medio);
    doc.text(ETICHETTA_IMPIANTI, M + 7, y + 2.6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.grigio);
    linee.forEach((l, i) => doc.text(l, M + 7 + le, y + 2.6 + i * 3.1));
    doc.setDrawColor(...C.bordo);
    doc.setLineWidth(0.1);
    doc.line(M, y + h, W - M, y + h);
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
      const conImpianti = impianti && r.impianti.length > 0;
      const sfondo = i % 2 ? C.zebra : null;
      // Riga e impianti restano sulla stessa pagina.
      if (conImpianti) spazio(6 + altezzaImpianti(r.impianti));
      riga({
        nome: { testo: etichetta },
        target: r.non_raccoglie ? { testo: 'NR', colore: C.grigio } : numero(r.target_mese),
        w: r.settimane.map(v => numero(v)),
        residue: { testo: t(r.residuo_mese), colore: r.target_mese > 0 && r.residuo_mese > 0 ? C.rosso : r.residuo_mese < 0 ? C.verde : C.tenue },
        raccolte: { testo: t(r.raccolto_mese), grassetto: r.raccolto_mese > 0, colore: r.raccolto_mese === 0 ? C.tenue : C.testo },
        perc: perc(r.raccolto_mese, r.target_mese),
        residuoAnno: { testo: t(r.residuo_anno), colore: r.residuo_anno < 0 ? C.verde : C.testo },
        totaleAnno: numero(r.totale_anno),
      }, { sfondo, rientro: true, senzaBordo: conImpianti });
      if (conImpianti) rigaImpianti(r.impianti, sfondo);
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

  noteDate();
  if (impianti) riepilogoImpianti();
  piede();

  doc.save(`Report settimanale ${report.nome_mese} ${report.anno}${impianti ? ' con impianti' : ''}.pdf`);

  // Immissione, inizio e fine trasporto sono obbligatorie nei formulari (regola
  // dell'utente del 22/09/2026): sotto la tabella si dicono i terminati di rete
  // senza fine trasporto, che il report non conta in nessuna settimana, e quelli
  // del mese a cui manca un'altra data o con date incoerenti, che sono contati
  // ma vanno corretti. Il server li manda in date_da_sistemare.
  function noteDate() {
    const frasi = frasiDateDaSistemare(report);
    if (!frasi.length) return;
    const testo = `${INTRO_DATE} ${frasi.join(' ')}`;
    doc.setFontSize(7.2);
    const linee = doc.splitTextToSize(testo, W - 2 * M - 6);
    const h = linee.length * 3.2 + 5;
    // su una pagina nuova non si ripete l'intestazione della tabella
    intestazioneRipetuta = () => {};
    spazio(h + 4);
    y += 4;
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(...C.rosso);
    doc.setLineWidth(0.2);
    doc.roundedRect(M, y, W - 2 * M, h, 1.2, 1.2, 'FD');
    doc.setTextColor(...C.rosso);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    linee.forEach((l, k) => doc.text(l, M + 3, y + 4.2 + k * 3.2));
    doc.setTextColor(...C.testo);
    y += h;
  }

  // Riepilogo per impianto di destinazione: tonnellate del mese, quota sul raccolto
  // e raccoglitori che vi hanno conferito.
  function riepilogoImpianti() {
    const perImpianto = new Map();
    for (const r of report.righe) {
      for (const i of r.impianti) {
        if (!perImpianto.has(i.impianto)) perImpianto.set(i.impianto, { impianto: i.impianto, t: 0, raccoglitori: [] });
        const voce = perImpianto.get(i.impianto);
        voce.t += i.t;
        voce.raccoglitori.push({ nome: r.raccoglitore, regione: r.regione, t: i.t });
      }
    }
    const elenco = [...perImpianto.values()].sort((a, b) => b.t - a.t);
    const somma = elenco.reduce((s, v) => s + v.t, 0);
    const col = { impianto: 62, raccoglitori: W - 2 * M - 62 - 26 - 44, t: 26, quota: 44 };

    const titolo = () => {
      doc.setFillColor(...C.scuro);
      doc.roundedRect(M, y, W - 2 * M, 8, 1.2, 1.2, 'F');
      doc.setTextColor(...C.bianco);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.3);
      doc.text('Impianto di destinazione', M + 3, y + 5.2);
      doc.text('Raccoglitori che hanno conferito', M + col.impianto + 3, y + 5.2);
      doc.text(`Tonnellate ${mm}`, M + col.impianto + col.raccoglitori + col.t - 2.5, y + 5.2, { align: 'right' });
      doc.text('Quota sul raccolto', W - M - 2.5, y + 5.2, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      y += 8;
    };

    const hTitoloSezione = 9;
    spazio(hTitoloSezione + 8 + 7);
    y += 5;
    doc.setTextColor(...C.scuro);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`Impianti di destinazione — ${meseTesto}`, M, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.grigio);
    doc.text(elenco.length
      ? `${elenco.length} ${elenco.length === 1 ? 'impianto' : 'impianti'} · ${t(somma)} t conferite nel mese`
      : 'Nessun conferimento nel mese', W - M, y + 4, { align: 'right' });
    y += hTitoloSezione - 3;
    if (!elenco.length) return;

    intestazioneRipetuta = titolo;
    titolo();
    elenco.forEach((v, i) => {
      doc.setFontSize(7);
      // Lo stesso raccoglitore in piu' regioni si distingue con la regione.
      const ripetuti = new Set(v.raccoglitori.map(x => x.nome).filter((n, k, arr) => arr.indexOf(n) !== k));
      const nomi = v.raccoglitori.sort((a, b) => b.t - a.t).map(x => `${x.nome}${ripetuti.has(x.nome) ? ` (${x.regione})` : ''} ${t(x.t)} t`).join('  ·  ');
      const linee = doc.splitTextToSize(nomi, col.raccoglitori - 5);
      const h = Math.max(6.5, 2.6 + linee.length * 3.1);
      spazio(h);
      if (i % 2) {
        doc.setFillColor(...C.zebra);
        doc.rect(M, y, W - 2 * M, h, 'F');
      }
      doc.setDrawColor(...C.bordo);
      doc.setLineWidth(0.1);
      doc.line(M, y + h, W - M, y + h);
      doc.setTextColor(...C.testo);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.6);
      doc.text(doc.splitTextToSize(v.impianto, col.impianto - 5)[0], M + 3, y + 4.3);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...C.grigio);
      linee.forEach((l, k) => doc.text(l, M + col.impianto + 3, y + 4.3 + k * 3.1));
      doc.setTextColor(...C.testo);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.6);
      doc.text(t(v.t), M + col.impianto + col.raccoglitori + col.t - 2.5, y + 4.3, { align: 'right' });
      const quota = somma > 0 ? (v.t / somma) * 100 : 0;
      const bx = W - M - col.quota + 3, bw = col.quota - 17, by = y + 3.1;
      doc.setFillColor(...C.chiaro);
      doc.roundedRect(bx, by, bw, 1.8, 0.9, 0.9, 'F');
      if (quota > 0) {
        doc.setFillColor(...C.medio);
        doc.roundedRect(bx, by, Math.max(1.8, bw * quota / 100), 1.8, 0.9, 0.9, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(`${formatPercentuale(quota)}%`, W - M - 2.5, y + 4.3, { align: 'right' });
      y += h;
    });
  }
}
