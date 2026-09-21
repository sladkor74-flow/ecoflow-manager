// Il report della quadratura settimanale dei formulari, in PDF.
//
// Riporta, flusso per flusso, i numeri delle tre fonti - WINSINFO, portale
// Ecotyre e gestionale - le righe che quadrano, quelle che non quadrano e il
// perche'. Serve a controllare e sistemare prima di riaggiornare il gestionale,
// quindi le motivazioni sono scritte per intero e i formulari con il loro ID
// ordine, non riassunti.
//
// Rete, ACI ed extra raccolta stanno in sezioni separate e non esiste un totale
// che li somma: sono canali indipendenti. Anche l'esito e' uno per canale.

import { formatKg, formatTonnellate } from '@/lib/utils';
import { dataIt } from '@/lib/verifiche';
import { NOME_VERDETTO, TITOLO_FLUSSO } from '@/lib/quadraturaFir';

const C = {
  scuro: [15, 76, 92], medio: [26, 127, 142], zebra: [247, 250, 251],
  bordo: [214, 222, 226], testo: [30, 41, 59], grigio: [107, 114, 128], bianco: [255, 255, 255],
  verde: [22, 101, 52], verdeChiaro: [220, 243, 228], ambra: [146, 64, 14], ambraChiaro: [254, 243, 199],
  rosso: [153, 27, 27],
};

const nomeSicuro = (s) => String(s).replace(/[\\/:*?"<>|]+/g, '-').trim();
const tonn = (kg) => formatTonnellate((Number(kg) || 0) / 1000);
const cifre = (v) => (v ? `${v.n} · ${formatKg(v.kg)}` : '—');
const descrizione = (v) => (v ? `${v.n} FIR · ${formatKg(v.kg)} kg` : 'non presente');

const CANALI = ['RETE', 'ACI', 'EXTRA RACCOLTA'];

/**
 * La conformita' canale per canale. Di norma arriva con l'esito (per_canale);
 * per un esito salvato prima si ricava qui dai flussi, con le stesse regole del
 * server: piena solo se nel canale tutte le righe quadrano, la trascrizione torna
 * con i totali stampati, la settimana e' quella giusta e non manca nessuna tabella.
 */
function conformitaPerCanale(esito) {
  if (esito && Array.isArray(esito.per_canale) && esito.per_canale.length) return esito.per_canale;
  const out = [];
  for (const canale of CANALI) {
    const flussi = ((esito && esito.flussi) || []).filter(f => f.canale === canale);
    if (!flussi.length) continue;
    let congruenti = 0, incongruenti = 0, mancanti = 0;
    for (const f of flussi) {
      mancanti += (f.tabelle_mancanti || []).length;
      for (const c of f.celle || []) { if (c.verdetto === 'congruente') congruenti++; else incongruenti++; }
    }
    const letturaVerificata = !!esito.lettura_verificata;
    const piena = incongruenti === 0 && letturaVerificata && !esito.settimana_discorde && mancanti === 0;
    out.push({ canale, congruenti, incongruenti, lettura_verificata: letturaVerificata, conformita: piena ? 'piena' : 'parziale' });
  }
  return out;
}

export async function esportaQuadraturaFirPdf(q, esito, lettura) {
  const { jsPDF } = await import('jspdf');
  const flussi = (esito && esito.flussi) || [];
  // Rete, ACI ed extra raccolta hanno ciascuno il suo verdetto: una riga
  // dell'extra raccolta non rende "parziale" la rete sul documento consegnato.
  const perCanale = conformitaPerCanale(esito);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const L = W - 2 * M;
  const periodo = `dal ${dataIt(q.data_inizio)} al ${dataIt(q.data_fine)}`;
  const riferimento = `QF-${q.anno}-S${String(q.settimana).padStart(2, '0')}`;
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
      testo('Quadratura settimanale dei formulari', M, 19, { dim: 16, grassetto: true, colore: C.bianco });
      testo(`Settimana ${q.settimana} · ${q.anno}`, W - M, 15, { dim: 11, grassetto: true, colore: C.bianco, allinea: 'right' });
      testo(periodo, W - M, 21, { dim: 8.5, colore: C.bianco, allinea: 'right' });
      y = 39;
    } else {
      testo(`Quadratura dei formulari · settimana ${q.settimana}`, M, 11, { dim: 9, grassetto: true, colore: C.bianco });
      testo(periodo, W - M, 11, { dim: 8, colore: C.bianco, allinea: 'right' });
      y = 27;
    }
  };

  const nuovaPagina = () => { doc.addPage(); testata(false); };
  const spazio = (h) => { if (y + h > H - 16) nuovaPagina(); };

  const sezione = (titolo, nota) => {
    spazio(nota ? 24 : 16);
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
      // Una riga "unica" e' la motivazione dello scostamento: occupa tutta la larghezza.
      if (r.unica) {
        doc.setFontSize(7.4);
        const linee = doc.splitTextToSize(String(r.celle[0] ?? ''), L - 8);
        const h = linee.length * 3.3 + 3;
        if (y + h > H - 16) { nuovaPagina(); intestazione(); }
        doc.setFillColor(...(r.sfondo || C.zebra));
        doc.rect(M, y, L, h, 'F');
        testo(linee, M + 4, y + 4.2, { dim: 7.4, colore: C.testo });
        doc.setDrawColor(...C.bordo);
        doc.setLineWidth(0.1);
        doc.line(M, y + h, W - M, y + h);
        y += h;
        return;
      }
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

  // --- prima pagina ---
  testata(true);
  testo('CONTEGGIO E SOMMA DEI FIR', M, y, { dim: 7, colore: C.grigio });
  testo('WINSINFO · portale Ecotyre · gestionale', M, y + 6, { dim: 13, grassetto: true, larghezza: L * 0.6 });
  // L'istante arriva dal server anche senza la Z; l'ora si scrive su quella italiana.
  const quando = q.verificata_il ? new Date(/Z$|[+-]\d\d:?\d\d$/.test(q.verificata_il) ? q.verificata_il : q.verificata_il + 'Z') : new Date();
  const ROMA = { timeZone: 'Europe/Rome' };
  [
    ['Riferimento', riferimento],
    ['File esaminato', q.file_nome || ''],
    ['Confronto eseguito il', `${quando.toLocaleDateString('it-IT', { ...ROMA, day: '2-digit', month: '2-digit', year: 'numeric' })} alle ${quando.toLocaleTimeString('it-IT', { ...ROMA, hour: '2-digit', minute: '2-digit' })}`],
  ].forEach(([k, val], i) => {
    testo(k, W - M - 68, y + i * 4.6, { dim: 7, colore: C.grigio });
    testo(doc.splitTextToSize(String(val), 46)[0], W - M, y + i * 4.6, { dim: 7.5, grassetto: true, allinea: 'right' });
  });
  y += 17;

  // --- esito, un riquadro per canale ---
  spazio(10);
  testo('ESITO DELLA QUADRATURA, CANALE PER CANALE', M, y, { dim: 7, grassetto: true, colore: C.scuro });
  y += 4;
  if (!perCanale.length) {
    testo('Nel file e nel gestionale non c\'è nessun flusso da confrontare in questa settimana.', M, y + 3, { dim: 8.5, colore: C.grigio });
    y += 9;
  }
  for (const c of perCanale) {
    const piena = c.conformita === 'piena';
    const [fondo, scritta] = piena ? [C.verdeChiaro, C.verde] : [C.ambraChiaro, C.ambra];
    const sottotitolo = piena
      ? `Su tutti i flussi del canale WINSINFO, il portale Ecotyre e il gestionale danno lo stesso numero di formulari e lo stesso peso, impianto per impianto e trasportatore per trasportatore (${c.congruenti} ${c.congruenti === 1 ? 'riga' : 'righe'}). La somma delle righe lette coincide con i totali stampati sul file.`
      : c.incongruenti > 0
        ? `${c.incongruenti} ${c.incongruenti === 1 ? 'riga non quadra' : 'righe non quadrano'} fra le tre fonti, ${c.congruenti} ${c.congruenti === 1 ? 'quadra' : 'quadrano'}${c.lettura_verificata ? '' : '; la somma delle righe lette non torna con i totali stampati sul file'}. Il dettaglio e la motivazione di ogni scostamento sono riportati di seguito, con i formulari e il loro ID ordine.`
        : !c.lettura_verificata
          ? `Le ${c.congruenti} righe quadrano, ma la somma delle righe lette non torna con i totali stampati sul file: la trascrizione va controllata sull'originale.`
          : `Le ${c.congruenti} righe quadrano, ma il confronto è incompleto: manca una tabella nel file o la settimana scritta sul file non è quella verificata. Vedi le note del flusso e le osservazioni.`;
    doc.setFontSize(8.5);
    const lineeSotto = doc.splitTextToSize(sottotitolo, L - 16);
    const hEsito = 13 + lineeSotto.length * 3.8;
    spazio(hEsito + 3);
    doc.setFillColor(...fondo);
    doc.roundedRect(M, y, L, hEsito, 2, 2, 'F');
    doc.setFillColor(...scritta);
    doc.roundedRect(M, y, 3, hEsito, 1.5, 1.5, 'F');
    testo(`${c.canale} · ${piena ? 'QUADRATURA PIENA' : 'QUADRATURA PARZIALE'}`, M + 8, y + 7, { dim: 12, grassetto: true, colore: scritta });
    testo(lineeSotto, M + 8, y + 12.5, { dim: 8.5, colore: C.testo });
    y += hEsito + 3;
  }
  y += 3;

  // --- totali per flusso ---
  sezione('Totali per flusso',
    'Ogni canale per conto suo: rete, ACI ed extra raccolta hanno contratti, tariffe e obiettivi diversi e non si sommano fra loro. Il gestionale conta i formulari terminati con la fine trasporto dentro la settimana e il peso effettivo.');
  tabella([
    { titolo: 'Flusso', peso: 26 }, { titolo: 'Canale', peso: 14 },
    { titolo: 'WINSINFO\nFIR · kg', peso: 15, allinea: 'right' },
    { titolo: 'Portale Ecotyre\nFIR · kg', peso: 15, allinea: 'right' },
    { titolo: 'Gestionale\nFIR · kg', peso: 15, allinea: 'right' },
    { titolo: 'Quadra', peso: 15 },
  ], flussi.map(f => {
    const q1 = f.quadra.winsinfo_ecotyre, q2 = f.quadra.ecotyre_gestionale;
    const stato = !f.nel_file ? 'tabelle assenti nel file'
      : (f.tabelle_mancanti || []).length ? 'manca la tabella di ' + f.tabelle_mancanti.join(' e di ')
      : q1 === false && q2 === false ? 'no, su entrambi i confronti'
      : q1 === false ? 'no fra WINSINFO e portale'
      : q2 === false ? 'no fra portale e gestionale'
      : !f.confrontabile ? 'sì, ma solo fra WINSINFO e portale'
      : 'sì';
    return {
      celle: [f.titolo, f.canale, cifre(f.totali.winsinfo), cifre(f.totali.ecotyre), cifre(f.totali.gestionale), stato],
      colori: [null, null, null, null, null, stato.startsWith('sì') ? C.verde : stato.startsWith('no') ? C.rosso : C.ambra],
      grassetti: [true, false, false, false, false, true],
    };
  }));

  // --- ogni flusso nel dettaglio ---
  for (const f of flussi) {
    const daGuardare = f.celle.filter(c => c.verdetto !== 'congruente' || c.osservazione);
    sezione(`${f.titolo} · ${f.canale}`,
      [
        `WINSINFO: ${descrizione(f.totali.winsinfo)}.  Portale Ecotyre: ${descrizione(f.totali.ecotyre)}.  Gestionale: ${descrizione(f.totali.gestionale)}${f.totali.gestionale ? ', cioè ' + tonn(f.totali.gestionale.kg) + ' t' : ''}.`,
        ...f.note,
      ].filter(Boolean).join('  '));

    if (!daGuardare.length) {
      testo(f.celle.length === 1
        ? 'L\'unica riga di questo flusso quadra su tutte le fonti del file.'
        : `Tutte le ${f.celle.length} righe di questo flusso quadrano su tutte le fonti del file.`, M, y, { dim: 8, colore: C.verde });
      y += 7;
      continue;
    }

    const righe = [];
    for (const c of daGuardare) {
      righe.push({
        celle: [c.impianto || '—', c.trasportatore || '—', cifre(c.winsinfo), cifre(c.ecotyre), cifre(c.gestionale), NOME_VERDETTO[c.verdetto] || c.verdetto],
        grassetti: [true, false, false, false, false, true],
        colori: [null, null, null, null, null, c.verdetto === 'congruente' ? C.ambra : C.rosso],
      });
      const motivi = [...(c.osservazione ? [c.osservazione] : []), ...(c.motivi || [])];
      if (motivi.length) {
        righe.push({ celle: [motivi.map(m => '· ' + m).join('\n')], sfondo: C.zebra, unica: true });
      }
    }

    tabella([
      { titolo: 'Impianto', peso: 24 }, { titolo: 'Trasportatore', peso: 24 },
      { titolo: 'WINSINFO\nFIR · kg', peso: 13, allinea: 'right' },
      { titolo: 'Portale\nFIR · kg', peso: 13, allinea: 'right' },
      { titolo: 'Gestionale\nFIR · kg', peso: 13, allinea: 'right' },
      { titolo: 'Esito', peso: 13 },
    ], righe);

    const quadrano = f.celle.length - daGuardare.length;
    if (quadrano > 0) {
      testo(quadrano === 1 ? 'L\'altra riga di questo flusso quadra.' : `Le altre ${quadrano} righe di questo flusso quadrano.`,
        M, y, { dim: 8, colore: C.verde });
      y += 6;
    }
  }

  // --- come e' stato letto il file ---
  if (lettura && Array.isArray(lettura.tabelle) && lettura.tabelle.length) {
    sezione('Come è stato letto il file',
      'La stampa porta i propri totali, per impianto e complessivi: la somma delle righe lette deve farli. È il controllo che rende affidabile la trascrizione.');
    tabella([
      { titolo: 'Sezione del file', peso: 27 }, { titolo: 'Fonte', peso: 12 }, { titolo: 'Flusso', peso: 16 },
      { titolo: 'Righe', peso: 7, allinea: 'right' },
      { titolo: 'Somma delle righe\nFIR · kg', peso: 14, allinea: 'right' },
      { titolo: 'Totale stampato\nFIR · kg', peso: 14, allinea: 'right' },
      { titolo: 'Controllo', peso: 14 },
    ], lettura.tabelle.map(t => {
      const totali = t.quadra_totali !== false;
      const controllo = t.quadra ? 'torna' : totali ? 'un subtotale non torna' : 'il totale non torna';
      return {
        celle: [t.titolo || '—', t.fonte === 'winsinfo' ? 'WINSINFO' : t.fonte === 'ecotyre' ? 'Portale' : '?',
          TITOLO_FLUSSO[t.flusso] || t.flusso || '?', t.righe,
          cifre(t.somma), t.stampato && t.stampato.n ? cifre(t.stampato) : 'non letto', controllo],
        colori: [null, null, null, null, totali ? null : C.rosso, totali ? null : C.rosso, t.quadra ? C.verde : C.rosso],
        grassetti: [false, false, false, false, false, false, true],
      };
    }));
  }

  // --- osservazioni ---
  const osservazioni = (esito && esito.osservazioni) || [];
  if (osservazioni.length) {
    sezione('Osservazioni', 'Cose da guardare che non sono scostamenti di numeri.');
    for (const o of osservazioni) {
      spazio(8);
      const n = testo('· ' + o, M, y, { dim: 8, larghezza: L });
      y += n * 3.6 + 1.5;
    }
  }

  // --- piede ---
  const pagine = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pagine; p++) {
    doc.setPage(p);
    testo('SMOCO S.r.l. · quadratura dei formulari · documento interno di controllo', M, H - 8, { dim: 7, colore: C.grigio });
    testo(`${p} / ${pagine}`, W - M, H - 8, { dim: 7, colore: C.grigio, allinea: 'right' });
  }

  doc.save(nomeSicuro(`Quadratura FIR ${q.anno} settimana ${String(q.settimana).padStart(2, '0')}`) + '.pdf');
}
