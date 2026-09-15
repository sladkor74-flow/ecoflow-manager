// Esito della verifica di un report settimanale in PDF, da inviare all'impianto:
// conformita' piena o parziale, quadratura di formulari e pesi, controlli eseguiti,
// anomalie da correggere, formulari mancanti o in piu', osservazioni e dettaglio
// completo delle righe verificate.

import { formatKg, formatIntero } from '@/lib/utils';
import { dataIt, sintesiVerifica, rigaReport, testoPerImpianto } from '@/lib/verifiche';

const C = {
  scuro: [15, 76, 92], medio: [26, 127, 142], chiaro: [226, 238, 241], zebra: [247, 250, 251],
  bordo: [214, 222, 226], testo: [30, 41, 59], grigio: [107, 114, 128], bianco: [255, 255, 255],
  verde: [22, 101, 52], verdeChiaro: [220, 243, 228], ambra: [146, 64, 14], ambraChiaro: [254, 243, 199],
  rosso: [153, 27, 27], rossoChiaro: [254, 226, 226], blu: [30, 64, 175], bluChiaro: [219, 234, 254],
};

const nomeSicuro = (s) => String(s).replace(/[\\/:*?"<>|]+/g, '-').trim();
const segno = (n) => (n > 0 ? '+' : '') + formatIntero(n);
const segnoKg = (n) => (n > 0 ? '+' : n < 0 ? '-' : '') + formatKg(Math.abs(n));
const NOME_TIPO = { ingresso: 'Ingressi', uscita: 'Uscite', totale: 'Totale' };
const CANALE = { rete: 'rete', aci: 'ACI', extra: 'extra raccolta' };
// 'Ingresso primaria · rete' dal movimento registrato.
const nomeCategoria = (m) => {
  const [mov, tipo, canale] = String(m.categoria || '').split('-');
  if (!mov) return m.tipo === 'uscita' ? 'Uscita' : 'Ingresso';
  return `${tipo === 'uscita' ? 'Uscita' : 'Ingresso'} ${mov} · ${CANALE[canale] || canale}`;
};

export async function esportaEsitoVerificaPdf(v) {
  const { jsPDF } = await import('jspdf');
  const esito = v.esito_json ? JSON.parse(v.esito_json) : { esiti: [], assenti: [] };
  const s = sintesiVerifica(v, esito);
  const piena = s.conformita === 'piena';

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const L = W - 2 * M;
  const periodo = `dal ${dataIt(v.data_inizio)} al ${dataIt(v.data_fine)}`;
  const riferimento = `VR-${v.anno}-S${String(v.settimana).padStart(2, '0')}-${String(v.soggetto_chiave || v.soggetto_nome).toUpperCase().replace(/[^A-Z0-9]+/g, '')}`;
  let y = 0;

  const testo = (t, x, yy, { dim = 8.5, grassetto = false, colore = C.testo, allinea = 'left', larghezza } = {}) => {
    doc.setFont('helvetica', grassetto ? 'bold' : 'normal');
    doc.setFontSize(dim);
    doc.setTextColor(...colore);
    const righe = Array.isArray(t) ? t : larghezza ? doc.splitTextToSize(String(t), larghezza) : String(t);
    doc.text(righe, x, yy, { align: allinea });
    return Array.isArray(righe) ? righe.length : 1;
  };

  const testata = (prima) => {
    doc.setFillColor(...C.scuro);
    doc.rect(0, 0, W, prima ? 30 : 18, 'F');
    doc.setFillColor(...C.medio);
    doc.rect(0, prima ? 30 : 18, W, 1.2, 'F');
    if (prima) {
      testo('SMOCO S.r.l.  ·  COMMESSA ECOTYRE', M, 9, { dim: 7.5, colore: C.bianco });
      testo('Verifica del report settimanale', M, 19, { dim: 17, grassetto: true, colore: C.bianco });
      testo(`Settimana ${v.settimana} · ${v.anno}`, W - M, 15, { dim: 11, grassetto: true, colore: C.bianco, allinea: 'right' });
      testo(periodo, W - M, 21, { dim: 8.5, colore: C.bianco, allinea: 'right' });
      y = 39;
    } else {
      testo(`Verifica del report settimanale · ${v.soggetto_nome}`, M, 11, { dim: 9, grassetto: true, colore: C.bianco });
      testo(`Settimana ${v.settimana} · ${periodo}`, W - M, 11, { dim: 8, colore: C.bianco, allinea: 'right' });
      y = 27;
    }
  };

  const nuovaPagina = () => { doc.addPage(); testata(false); };
  const spazio = (h) => { if (y + h > H - 16) nuovaPagina(); };

  const sezione = (titolo, nota) => {
    spazio(nota ? 22 : 16);
    y += 3;
    testo(titolo.toUpperCase(), M, y, { dim: 9, grassetto: true, colore: C.scuro });
    doc.setDrawColor(...C.medio);
    doc.setLineWidth(0.4);
    doc.line(M, y + 1.8, W - M, y + 1.8);
    y += 7;
    if (nota) {
      const n = testo(nota, M, y, { dim: 8, colore: C.grigio, larghezza: L });
      y += n * 3.6 + 1.5;
    }
  };

  // Tabella con testo a capo, intestazione ripetuta a ogni pagina.
  // colonne: [{ titolo, peso, allinea }]; righe: [{ celle, colori?, grassetti?, sfondo?, grassetto? }]
  const tabella = (colonne, righe) => {
    const totalePesi = colonne.reduce((t, c) => t + c.peso, 0);
    const larghezze = colonne.map(c => (L * c.peso) / totalePesi);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    const titoli = colonne.map((c, i) => doc.splitTextToSize(c.titolo, larghezze[i] - 3));
    const hTitoli = Math.max(...titoli.map(t => t.length)) * 3 + 4;
    const intestazione = () => {
      doc.setFillColor(...C.scuro);
      doc.rect(M, y, L, hTitoli, 'F');
      let x = M;
      colonne.forEach((c, i) => {
        const a = c.allinea || 'left';
        const px = a === 'right' ? x + larghezze[i] - 2 : a === 'center' ? x + larghezze[i] / 2 : x + 2;
        testo(titoli[i], px, y + 4.6, { dim: 7, grassetto: true, colore: C.bianco, allinea: a });
        x += larghezze[i];
      });
      y += hTitoli;
    };
    spazio(14);
    intestazione();
    righe.forEach((r, k) => {
      doc.setFontSize(7.6);
      const linee = r.celle.map((t, i) => {
        doc.setFont('helvetica', (r.grassetti && r.grassetti[i]) || r.grassetto ? 'bold' : 'normal');
        return doc.splitTextToSize(String(t ?? ''), larghezze[i] - 3.5);
      });
      const h = Math.max(...linee.map(l => l.length)) * 3.3 + 3;
      if (y + h > H - 16) { nuovaPagina(); intestazione(); }
      const sfondo = r.sfondo || (k % 2 ? C.zebra : null);
      if (sfondo) { doc.setFillColor(...sfondo); doc.rect(M, y, L, h, 'F'); }
      let x = M;
      colonne.forEach((c, i) => {
        const a = c.allinea || 'left';
        const px = a === 'right' ? x + larghezze[i] - 2 : a === 'center' ? x + larghezze[i] / 2 : x + 2;
        testo(linee[i], px, y + 4.3, { dim: 7.6, grassetto: (r.grassetti && r.grassetti[i]) || r.grassetto, colore: (r.colori && r.colori[i]) || C.testo, allinea: a });
        x += larghezze[i];
      });
      doc.setDrawColor(...C.bordo);
      doc.setLineWidth(0.1);
      doc.line(M, y + h, W - M, y + h);
      y += h;
    });
    y += 4;
  };

  // --- Prima pagina: intestazione, impianto, esito ---
  testata(true);
  testo('IMPIANTO / STOCCAGGIO', M, y, { dim: 7, colore: C.grigio });
  testo(v.soggetto_nome, M, y + 6, { dim: 14, grassetto: true, colore: C.testo, larghezza: L * 0.58 });
  const verificata = v.verificata_il ? new Date(/Z$|[+-]\d\d:\d\d$/.test(v.verificata_il) ? v.verificata_il : v.verificata_il + 'Z') : new Date();
  const dati = [
    ['Riferimento', riferimento],
    [s.dichiarazione ? 'Comunicazione' : 'Report ricevuto', s.dichiarazione ? (v.nota || 'Nessuna movimentazione dichiarata') : (v.file_nome || '')],
    ['Verifica eseguita il', `${verificata.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })} alle ${verificata.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`],
  ];
  dati.forEach(([k, val], i) => {
    testo(k, W - M - 62, y + i * 4.6, { dim: 7, colore: C.grigio });
    testo(doc.splitTextToSize(val, 40)[0], W - M, y + i * 4.6, { dim: 7.5, grassetto: true, allinea: 'right' });
  });
  y += 17;

  const [fondo, scritta] = piena ? [C.verdeChiaro, C.verde] : [C.ambraChiaro, C.ambra];
  const totaleRegistrato = `${formatIntero(s.totale.formulari_gestionale)} ${s.totale.formulari_gestionale === 1 ? 'formulario registrato' : 'formulari registrati'} per ${formatKg(s.totale.kg_gestionale)} kg`;
  const sottotitolo = s.dichiarazione
    ? (piena
      ? 'L\'impianto ha comunicato che nella settimana non ci sono state movimentazioni: nessun formulario risulta registrato. La comunicazione è confermata.'
      : `L'impianto ha comunicato che nella settimana non ci sono state movimentazioni, ma risultano ${totaleRegistrato}. Vi chiediamo di inviarci il report della settimana.`)
    : piena
    ? 'Il report corrisponde ai formulari registrati per la settimana: stesso numero di formulari, stessi numeri, stessi pesi effettivi e stesse date di fine trasporto.'
    : `Il report non corrisponde pienamente ai formulari registrati: ${s.numeroAnomalie} ${s.numeroAnomalie === 1 ? 'anomalia da verificare' : 'anomalie da verificare'}${s.mancanti.length ? `, di cui ${s.mancanti.length} ${s.mancanti.length === 1 ? 'formulario mancante' : 'formulari mancanti'}` : ''}${s.inPiu.length ? `${s.mancanti.length ? ' e' : ', di cui'} ${s.inPiu.length} ${s.inPiu.length === 1 ? 'formulario non registrato' : 'formulari non registrati'}` : ''}. Il dettaglio è riportato di seguito.`;
  doc.setFontSize(8.5);
  const lineeSotto = doc.splitTextToSize(sottotitolo, L - 16);
  const hEsito = 15 + lineeSotto.length * 3.8;
  doc.setFillColor(...fondo);
  doc.roundedRect(M, y, L, hEsito, 2, 2, 'F');
  doc.setFillColor(...scritta);
  doc.roundedRect(M, y, 3, hEsito, 1.5, 1.5, 'F');
  testo('ESITO DELLA VERIFICA', M + 8, y + 6, { dim: 7, grassetto: true, colore: scritta });
  testo(piena ? 'CONFORMITÀ PIENA' : 'CONFORMITÀ PARZIALE', M + 8, y + 12.5, { dim: 15, grassetto: true, colore: scritta });
  testo(lineeSotto, M + 8, y + 18, { dim: 8.5, colore: C.testo });
  y += hEsito + 6;

  // --- Quadratura ---
  sezione('Quadratura di formulari e pesi',
    `${s.dichiarazione ? 'Movimentazioni dichiarate confrontate' : 'Formulari del report confrontati'} con quelli registrati con fine trasporto ${periodo}, per ciascuna movimentazione e canale: ingressi in primaria e ingressi e uscite in secondaria, di rete, ACI ed extra raccolta.`);
  const rigaQ = (q, grassetto) => {
    const dF = q.formulari_report - q.formulari_gestionale;
    const dK = q.kg_report - q.kg_gestionale;
    const vuota = !grassetto && !q.formulari_report && !q.formulari_gestionale;
    const grigio = vuota ? C.grigio : null;
    return {
      celle: [q.nome || NOME_TIPO[q.tipo] || '', formatIntero(q.formulari_report), formatIntero(q.formulari_gestionale), dF ? segno(dF) : '0',
        formatKg(q.kg_report), formatKg(q.kg_gestionale), dK ? segnoKg(dK) : '0', vuota ? 'Nessuna' : q.quadra ? 'Quadra' : 'Non quadra'],
      colori: [grigio, grigio, grigio, vuota ? C.grigio : dF ? C.rosso : C.verde, grigio, grigio, vuota ? C.grigio : dK ? C.rosso : C.verde, vuota ? C.grigio : q.quadra ? C.verde : C.rosso],
      grassetti: [grassetto, grassetto, grassetto, !vuota, grassetto, grassetto, !vuota, !vuota],
      sfondo: grassetto ? C.chiaro : null,
    };
  };
  // Tutte le movimentazioni previste; i formulari non registrati solo se ce ne sono.
  const righeQ = s.categorie.filter(q => q.chiave !== 'non_registrati' || q.formulari_report);
  tabella([
    { titolo: 'Movimentazione', peso: 1.85 }, { titolo: 'Formulari nel report', peso: 0.95, allinea: 'right' }, { titolo: 'Formulari registrati', peso: 0.95, allinea: 'right' },
    { titolo: 'Differenza', peso: 0.8, allinea: 'right' }, { titolo: 'Peso nel report (kg)', peso: 1.05, allinea: 'right' },
    { titolo: 'Peso registrato (kg)', peso: 1.05, allinea: 'right' }, { titolo: 'Differenza (kg)', peso: 0.95, allinea: 'right' }, { titolo: 'Esito', peso: 1.05, allinea: 'center' },
  ], [...righeQ.map(q => rigaQ(q, false)), rigaQ(s.totale, true)]);

  // --- Controlli ---
  sezione('Controlli eseguiti');
  tabella([{ titolo: 'Controllo', peso: 2.4 }, { titolo: 'Esito', peso: 0.9, allinea: 'center' }, { titolo: 'Dettaglio', peso: 2.4 }],
    s.controlli.map(c => ({ celle: [c.nome, c.ok ? 'Conforme' : 'Non conforme', c.dettaglio], colori: [null, c.ok ? C.verde : C.rosso, c.ok ? C.grigio : C.rosso], grassetti: [false, true, false] })));

  // --- Anomalie riga per riga ---
  if (s.anomalie.length) {
    sezione('Anomalie da correggere', 'Errori o sviste nelle righe del report rispetto ai formulari registrati.');
    tabella([{ titolo: 'Riga del report', peso: 1.1 }, { titolo: 'Formulario', peso: 1.35 }, { titolo: 'Controllo', peso: 1.25 }, { titolo: 'Dettaglio', peso: 3.6 }],
      s.anomalie.map(a => ({ celle: [cap(rigaReport(a.esito)), a.esito.report.fir || 'senza formulario', a.etichetta, a.testo], colori: [C.grigio, null, C.rosso, null], grassetti: [false, true, true, false] })));
  }

  if (s.mancanti.length) {
    sezione(s.dichiarazione ? 'Formulari registrati nella settimana' : 'Formulari registrati ma assenti nel report', s.dichiarazione
      ? 'La comunicazione di nessuna movimentazione non trova riscontro: risultano registrati questi formulari. Vi chiediamo di inviarci il report della settimana.'
      : 'Report parziale: questi formulari risultano registrati per la settimana ma non compaiono nel report. Vi chiediamo di integrarli.');
    tabella([{ titolo: 'Formulario', peso: 1.3 }, { titolo: 'Movimentazione', peso: 1.35 }, { titolo: 'Fine trasporto', peso: 0.9 }, { titolo: 'Produttore / destinatario', peso: 1.75 }, { titolo: 'Trasportatore', peso: 1.3 }, { titolo: 'Peso (kg)', peso: 0.8, allinea: 'right' }],
      s.mancanti.map(m => ({
        celle: [m.fir, nomeCategoria(m), dataIt(m.fine), m.tipo === 'uscita' ? `verso ${m.destinatario || ''}` : (m.produttore || ''), m.trasportatore || '', formatKg(m.kg)],
        grassetti: [true, false, false, false, false, true], colori: [C.rosso],
      })));
  }

  if (s.inPiu.length) {
    sezione('Formulari del report non registrati', 'Questi formulari compaiono nel report ma non risultano registrati per la settimana: vi chiediamo di confermarne i dati e l\'appartenenza alla commessa Ecotyre.');
    tabella([{ titolo: 'Riga del report', peso: 1.35 }, { titolo: 'Formulario', peso: 1.35 }, { titolo: 'Data', peso: 0.9 }, { titolo: 'Produttore', peso: 2.0 }, { titolo: 'Destinatario', peso: 1.6 }, { titolo: 'Peso (kg)', peso: 0.9, allinea: 'right' }],
      s.inPiu.map(e => ({
        celle: [cap(rigaReport(e)), e.report.fir || 'senza formulario', dataIt(e.report.fine || e.report.data), e.report.produttore || '', e.report.destinatario || '', e.report.kg != null ? formatKg(e.report.kg) : ''],
        grassetti: [false, true, false, false, false, true], colori: [C.grigio, C.rosso],
      })));
  }

  if (s.osservazioni.length) {
    sezione('Osservazioni', 'Nomi scritti in modo diverso a parità di formulario e peso: non incidono sulla conformità.');
    tabella([{ titolo: 'Riga del report', peso: 1.1 }, { titolo: 'Formulario', peso: 1.35 }, { titolo: 'Dato', peso: 1.1 }, { titolo: 'Dettaglio', peso: 3.75 }],
      s.osservazioni.map(a => ({ celle: [cap(rigaReport(a.esito)), a.esito.report.fir, a.etichetta, a.testo], colori: [C.grigio, null, C.blu], grassetti: [false, true, true, false] })));
  }

  if (s.rettifiche.length) {
    sezione('Rettifiche a nostra cura', 'Differenze dovute ai dati registrati e non al report: nessuna azione richiesta all\'impianto.');
    tabella([{ titolo: 'Riga del report', peso: 1.1 }, { titolo: 'Formulario', peso: 1.35 }, { titolo: 'Dettaglio', peso: 4.85 }],
      s.rettifiche.map(a => ({ celle: [cap(rigaReport(a.esito)), a.esito.report.fir, a.testo], colori: [C.grigio], grassetti: [false, true, false] })));
  }

  // --- Dettaglio completo ---
  if (s.esiti.length) {
    sezione('Dettaglio dei formulari verificati', `${formatIntero(s.esiti.length)} ${s.esiti.length === 1 ? 'riga' : 'righe'} del report con fine trasporto nella settimana, in ordine di data.`);
    const ordinati = [...s.esiti].sort((a, b) => String(a.report.fine || a.report.data || '').localeCompare(String(b.report.fine || b.report.data || '')) || (a.n - b.n));
    const esitoRiga = (e) => {
      if (e.esito === 'non_trovata') return ['Non registrato', C.rosso];
      if (e.esito === 'duplicata') return ['Duplicata', C.rosso];
      const gr = (e.discrepanze || []).map(d => d.gravita || (/errato nel gestionale/i.test(d.messaggio) ? 'rettifica' : ['produttore', 'destinatario', 'trasportatore'].includes(d.campo) && !/non riguarda|codice/i.test(d.messaggio) ? 'osservazione' : 'anomalia'));
      if (gr.includes('anomalia')) return ['Anomalia', C.rosso];
      if (gr.length) return ['Conforme*', C.verde];
      return ['Conforme', C.verde];
    };
    tabella([
      { titolo: 'Fine trasporto', peso: 0.95 }, { titolo: 'Formulario', peso: 1.3 }, { titolo: 'Movimentazione', peso: 1.25 }, { titolo: 'Produttore / destinatario', peso: 1.65 },
      { titolo: 'Classe', peso: 0.55, allinea: 'center' }, { titolo: 'Peso report (kg)', peso: 0.95, allinea: 'right' }, { titolo: 'Peso registrato (kg)', peso: 1, allinea: 'right' }, { titolo: 'Esito', peso: 0.95, allinea: 'center' },
    ], ordinati.map(e => {
      const [etichetta, colore] = esitoRiga(e);
      const g = e.gestionale || {};
      const uscita = (e.tipo || e.tipo_presunto) === 'uscita';
      const pesoDiverso = e.gestionale && e.report.kg !== g.kg;
      return {
        celle: [dataIt(e.report.fine || e.report.data || g.fine), e.report.fir || 'senza formulario', e.gestionale && e.categoria && e.categoria !== 'non_registrati' ? nomeCategoria(e) : (uscita ? 'Uscita' : 'Ingresso'),
          uscita ? `verso ${e.report.destinatario || g.destinatario || ''}` : (e.report.produttore || g.produttore || ''), e.report.classe || g.classe || '',
          e.report.kg != null ? formatKg(e.report.kg) : '', e.gestionale ? formatKg(g.kg) : '—', etichetta],
        colori: [null, null, C.grigio, null, null, pesoDiverso ? C.rosso : null, pesoDiverso ? C.rosso : null, colore],
        grassetti: [false, true, false, false, false, false, false, true],
      };
    }));
    if (s.esiti.some(e => esitoRiga(e)[0] === 'Conforme*')) {
      spazio(6);
      testo('* Conforme con osservazioni o rettifiche a nostra cura.', M, y, { dim: 7, colore: C.grigio });
      y += 5;
    }
  }

  if (s.escluse.length) {
    sezione('Righe del report non considerate', 'Carichi di altre settimane, presenti nei report cumulativi, o di altri circuiti: saranno verificati con la loro settimana o non riguardano la commessa.');
    tabella([{ titolo: 'Riga del report', peso: 1.1 }, { titolo: 'Formulario', peso: 1.3 }, { titolo: 'Data', peso: 0.85 }, { titolo: 'Peso (kg)', peso: 0.85, allinea: 'right' }, { titolo: 'Motivo', peso: 3.2 }],
      s.escluse.map(e => ({ celle: [cap(rigaReport(e)), e.fir || '', dataIt(e.data), e.kg != null ? formatKg(e.kg) : '', testoPerImpianto(e.motivo)], colori: [C.grigio, C.grigio, C.grigio, C.grigio, C.grigio] })));
  }

  // --- Criteri e richiesta ---
  sezione('Criteri della verifica');
  const criteri = [
    'Il report settimanale deve riportare tutte le movimentazioni: ingressi in primaria e ingressi e uscite in secondaria, di rete, ACI ed extra raccolta. Se non ce ne sono, l\'impianto lo comunica e la comunicazione viene verificata sui formulari registrati.',
    `Ogni riga del report è confrontata con i formulari registrati con fine trasporto ${periodo}: numero di formulario, peso effettivo al chilogrammo, date di trasporto e classe dei PFU.`,
    'La quadratura richiede lo stesso numero di formulari e lo stesso peso complessivo, distinti fra ingressi e uscite.',
    piena
      ? `${s.dichiarazione ? 'La comunicazione risulta confermata' : 'Il report risulta pienamente conforme'}: non è richiesta alcuna azione. Grazie per la collaborazione.`
      : 'Vi chiediamo di verificare le anomalie indicate e di inviarci il report corretto o le vostre osservazioni. Per ogni chiarimento potete rispondere a questa comunicazione.',
  ];
  for (const p of criteri) {
    doc.setFontSize(8.3);
    const n = doc.splitTextToSize(p, L - 5).length;
    spazio(n * 3.8 + 2);
    doc.setFillColor(...C.medio);
    doc.circle(M + 1.2, y - 1, 0.7, 'F');
    testo(p, M + 4, y, { dim: 8.3, larghezza: L - 5 });
    y += n * 3.8 + 2;
  }

  // --- Piede con numero di pagina ---
  const pagine = doc.getNumberOfPages();
  for (let p = 1; p <= pagine; p++) {
    doc.setPage(p);
    doc.setDrawColor(...C.bordo);
    doc.setLineWidth(0.2);
    doc.line(M, H - 11, W - M, H - 11);
    testo(`SMOCO S.r.l. · Verifica report settimanale · ${riferimento}`, M, H - 6.5, { dim: 7, colore: C.grigio });
    testo(`Pagina ${p} di ${pagine}`, W - M, H - 6.5, { dim: 7, colore: C.grigio, allinea: 'right' });
  }

  doc.save(`${nomeSicuro(`Verifica report ${v.soggetto_nome} settimana ${v.settimana}-${v.anno}`)}.pdf`);
}

function cap(t) {
  const s = String(t || '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
