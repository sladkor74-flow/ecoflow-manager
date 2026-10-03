// IL PDF DELLA PASSIVA NEL «FORMAT AMMINISTRAZIONE».
//
// L'utente, il 03/10/2026, ha indicato il PDF del report settimanale come il modo
// professionale di mandare un documento - «quello si' che e' un modo
// professionale di inviare documenti, ti chiedo di fare la stessa cosa» - e
// questo file fa la stessa cosa per la fatturazione passiva. Finora la passiva in
// PDF usciva dal generatore di tabelle generico (src/lib/esportaTabella.js): va
// benissimo per un elenco da consultare, ma non per un foglio che si manda
// all'amministrazione, dove i blocchi, il totale di ogni canale e il segnale di
// quello che manca devono vedersi al primo sguardo.
//
// L'impostazione e' quella di src/lib/reportSettimanaleExport.js: A4 orizzontale
// in millimetri, fascia di intestazione scura, riquadri di sintesi arrotondati
// con la barretta di colore a sinistra, intestazioni di tabella scure che si
// ripetono dopo ogni salto pagina, righe a zebra col filo di bordo e piede con la
// legenda a sinistra e la data di esportazione a destra. La palette e le funzioni
// di appoggio sono RISCRITTE QUI perche' quelle del report non sono esportate: se
// un domani cambia il modo di impaginare i report, va cambiato anche questo file.
//
// Le righe arrivano gia' fatte da src/lib/passivaAmministrazione.js
// (foglioPassiva) e qui non si calcola nessun numero: cosi' il PDF, i fogli Excel
// e la pagina a video non possono dire cose diverse sullo stesso mese.

import { formatNumber, formatTonnellate, formatIntero } from '@/lib/utils';
import { nomeFilePassiva } from '@/lib/passivaAmministrazione';

const C = {
  scuro: [15, 76, 92],
  medio: [26, 127, 142],
  chiaro: [226, 238, 241],
  zebra: [248, 251, 252],
  bordo: [214, 222, 226],
  testo: [30, 41, 59],
  tenue: [150, 160, 168],
  grigio: [110, 120, 130],
  ambra: [217, 119, 6],
  ambraChiaro: [254, 243, 199],
  ambraScuro: [146, 64, 14],
  blu: [2, 132, 199],
  viola: [124, 58, 237],
  bianco: [255, 255, 255],
};

// L'EER dei pneumatici fuori uso. Nel foglio dell'amministrazione sta sulla riga
// del soggetto quando il canale e' a due livelli e su ogni riga quando e' piatto:
// e' un codice, non una quantita', quindi si scrive sempre identico.
const EER_PFU = '160103';

// Tonnellate con due decimali (la terza, i chili, solo se non e' tonda) ed euro
// sempre con due decimali: sono i formati del loro foglio, "#,##0.00" per i pesi
// e '#,##0.00 "€"' per gli importi.
const t = (v) => formatTonnellate(v);
const euro = (v) => `${formatNumber(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const prezzo = (v) => formatNumber(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Le intestazioni delle colonne del prezzo arrivano come le scrive
// l'amministrazione, per esempio «Costo di Raccolta [€\t]»: l'unita' di misura va
// sulla seconda riga dell'intestazione, cosi' il titolo resta leggibile anche
// quando la colonna e' stretta.
const dueRighe = (etichetta) => {
  const m = /^(.*?)\s*(\[[^\]]*\])$/.exec(String(etichetta || ''));
  return m ? [m[1], m[2]] : [String(etichetta || '')];
};

// L'unita' di misura di una riga di trasporto, scritta come nel loro foglio.
const unitaMisura = (u) => (u === 'euro_viaggio' ? '€\\vg' : '€\\t');

export async function esportaPassivaAmministrazionePdf(fogli, { anno, mese } = {}) {
  // jsPDF si carica solo quando si esporta davvero: la pagina della passiva si
  // apre molte volte al giorno per guardare i numeri e quasi mai per stampare, e
  // la libreria pesa piu' di tutto il resto del modulo.
  const { jsPDF } = await import('jspdf');

  const elenco = Array.isArray(fogli) ? fogli : [];
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 10;
  const L = W - 2 * M;
  const periodo = [mese, anno].filter(Boolean).join(' ');

  let y = 0;
  let pagina = 1;
  // Dove siamo rimasti: serve all'intestazione delle pagine dopo la prima.
  let dove = '';

  const intestazionePagina = () => {
    doc.setFillColor(...C.scuro);
    doc.rect(0, 0, W, 22, 'F');
    doc.setFillColor(...C.medio);
    doc.rect(0, 22, W, 1.4, 'F');
    doc.setTextColor(...C.bianco);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('SMOCO S.r.l.  ·  COMMESSA ECOTYRE  ·  FORMAT AMMINISTRAZIONE', M, 8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(`Fatturazione passiva — ${periodo}`, M, 16.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Costi dei fornitori del mese, canale per canale', W - M, 10, { align: 'right' });
    // Chi sfoglia il documento stampato deve capire di che canale e di che
    // tabella sono le righe che ha davanti senza tornare alla pagina prima.
    if (pagina > 1 && dove) doc.text(`segue: ${dove}`, W - M, 15.5, { align: 'right' });
    y = 29;
  };

  const piede = () => {
    doc.setDrawColor(...C.bordo);
    doc.setLineWidth(0.1);
    doc.line(M, H - 9, W - M, H - 9);
    doc.setTextColor(...C.grigio);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.text('Le voci di ogni fornitore sono un modello fisso e restano scritte anche quando il mese è a zero.  ·  RETE, ACI ed extra raccolta non si sommano mai fra loro: non esiste un totale generale.  ·  Tonnellate sui pesi effettivi del mese.', M, H - 5);
    doc.text(`Esportato il ${new Date().toLocaleString('it-IT')}  ·  Pagina ${pagina}`, W - M, H - 5, { align: 'right' });
    pagina++;
  };

  // L'intestazione da ridisegnare dopo un salto pagina: quella della tabella in
  // corso, oppure niente quando si sta stampando un riquadro a se' stante.
  let intestazioneRipetuta = () => {};
  const spazio = (h) => {
    if (y + h <= H - 12) return;
    piede();
    doc.addPage();
    intestazionePagina();
    intestazioneRipetuta();
  };

  // I RIQUADRI DI SINTESI, uno per blocco piu' il totale del canale.
  //
  // Si ripetono per ogni canale e non esiste un riquadro che somma i canali: la
  // regola del gestionale e' che RETE, ACI ed extra raccolta sono indipendenti, e
  // un totale generale su un documento che va all'amministrazione sarebbe un
  // numero che nessuno deve usare.
  const riquadri = (f) => {
    const viaggi = f.trasporti.righe.length;
    const voci = [
      { etichetta: 'Raccoglitori', valore: euro(f.raccoglitori.totale_euro), sotto: `${t(f.raccoglitori.totale_t)} t raccolte`, colore: C.blu },
      { etichetta: 'Impianti \\ stoccaggi', valore: euro(f.impianti.totale_euro), sotto: `${t(f.impianti.totale_t)} t trattate o stoccate`, colore: C.viola },
      { etichetta: 'Trasporto secondarie', valore: euro(f.trasporti.totale_euro), sotto: `${t(f.trasporti.totale_t)} t · ${formatIntero(viaggi)} ${viaggi === 1 ? 'viaggio' : 'viaggi'}`, colore: C.medio },
      { etichetta: `TOTALE ${f.nome_canale}`, valore: euro(f.totale_euro), sotto: 'solo questo canale: non si somma agli altri', colore: C.scuro },
    ];
    const gap = 4;
    const lw = (L - gap * (voci.length - 1)) / voci.length;
    const h = 17;
    spazio(h + 2);
    voci.forEach((r, i) => {
      const x = M + i * (lw + gap);
      doc.setFillColor(...C.zebra);
      doc.setDrawColor(...C.bordo);
      doc.setLineWidth(0.1);
      doc.roundedRect(x, y, lw, h, 1.8, 1.8, 'FD');
      doc.setFillColor(...r.colore);
      doc.rect(x, y + 1.5, 1.4, h - 3, 'F');
      doc.setTextColor(...C.grigio);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(r.etichetta, x + 4.5, y + 5);
      doc.setTextColor(...C.testo);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12.5);
      doc.text(doc.splitTextToSize(r.valore, lw - 7)[0], x + 4.5, y + 11.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.grigio);
      doc.setFontSize(6.5);
      doc.text(doc.splitTextToSize(r.sotto, lw - 7)[0], x + 4.5, y + 15);
    });
    y += h + 5;
  };

  // LE COLONNE DI UN BLOCCO.
  //
  // Sono quelle del loro foglio - soggetto, tonnellate, prezzo, EER, totale - con
  // due aggiunte che compaiono solo quando servono: i viaggi, senza i quali una
  // riga pagata a viaggio e non a tonnellata non si puo' ricontrollare, e le note
  // scritte sulla voce. Tenerle sempre vorrebbe dire rubare quaranta millimetri
  // alla colonna dei nomi, che sono lunghi e non si devono tagliare.
  const colonneBlocco = (blocco) => {
    const righe = blocco.righe || [];
    const etichette = blocco.due_prezzi
      ? (blocco.etichette_prezzo || [blocco.etichetta_prezzo || 'Costo di Stoccaggio [€\\t]', 'Costo di Trattamento [€\\t]'])
      : [blocco.etichetta_prezzo || 'Costo [€\\t]'];
    const conViaggi = righe.some(r => r.tipo === 'voce' && r.unita_misura === 'euro_viaggio');
    const conNote = righe.some(r => r.tipo === 'voce' && r.note);
    const prezzi = etichette.slice(0, 2).map((e, i) => ({ chiave: i === 0 ? 'prezzo1' : 'prezzo2', w: 34, titolo: dueRighe(e) }));
    const code = [
      ...(conViaggi ? [{ chiave: 'viaggi', w: 18, titolo: ['Viaggi'] }] : []),
      { chiave: 'eer', w: 18, titolo: ['EER'] },
      { chiave: 'totale', w: 32, titolo: ['TOTALE'] },
      ...(conNote ? [{ chiave: 'note', w: 48, titolo: ['Note'], sx: true }] : []),
    ];
    const fisse = 24 + prezzi.reduce((s, c) => s + c.w, 0) + code.reduce((s, c) => s + c.w, 0);
    return [
      { chiave: 'etichetta', w: L - fisse, titolo: [blocco.titolo || ''], sx: true },
      { chiave: 'tonnellate', w: 24, titolo: ['Totale [t]'] },
      ...prezzi,
      ...code,
    ];
  };

  // L'intestazione scura e arrotondata di una tabella: la prima cella porta il
  // titolo del blocco, esattamente come nel loro foglio, dove «RACCOGLITORI» sta
  // nella stessa riga di «Totale [t]» e «TOTALE».
  const intestazioneTabella = (colonne) => {
    const h = 10;
    doc.setFillColor(...C.scuro);
    doc.roundedRect(M, y, L, h, 1.2, 1.2, 'F');
    doc.setTextColor(...C.bianco);
    let x = M;
    for (const c of colonne) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.3);
      doc.text(doc.splitTextToSize(c.titolo[0], c.w - 4)[0], c.sx ? x + 3 : x + c.w - 2.5, y + 4.3, { align: c.sx ? 'left' : 'right' });
      if (c.titolo[1]) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.3);
        doc.text(c.titolo[1], c.sx ? x + 3 : x + c.w - 2.5, y + 7.8, { align: c.sx ? 'left' : 'right' });
      }
      x += c.w;
    }
    doc.setFont('helvetica', 'normal');
    y += h;
  };

  // Una riga di tabella: le celle sono { testo, colore, grassetto } messe sotto la
  // chiave della loro colonna, cosi' la stessa funzione serve tutte le tabelle.
  //
  // Le celle allineate a sinistra vanno a capo, fino a due righe, e la riga si
  // alza di conseguenza: su un documento che si manda all'amministrazione un nome
  // di fornitore tagliato a meta' non va bene, e nella tabella del trasporto le
  // tre colonne dei nomi sono per forza strette.
  const riga = (colonne, celle, stile = {}) => {
    const spezzate = {};
    let quante = 1;
    for (const c of colonne) {
      const cella = celle[c.chiave];
      if (!c.sx || !cella || cella.testo === undefined || cella.testo === null || cella.testo === '') continue;
      doc.setFont('helvetica', cella.grassetto || stile.grassetto ? 'bold' : 'normal');
      doc.setFontSize(7.6);
      const linee = doc.splitTextToSize(String(cella.testo), c.w - (stile.rientro ? 5.5 : 3) - 2).slice(0, 2);
      spezzate[c.chiave] = linee;
      quante = Math.max(quante, linee.length);
    }
    const h = (stile.h || 6) + (quante - 1) * 3.2;
    spazio(h);
    if (stile.sfondo) {
      doc.setFillColor(...stile.sfondo);
      doc.rect(M, y, L, h, 'F');
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
    for (const c of colonne) {
      const cella = celle[c.chiave];
      if (cella && cella.testo !== undefined && cella.testo !== null && cella.testo !== '') {
        doc.setTextColor(...(cella.colore || stile.colore || C.testo));
        doc.setFont('helvetica', cella.grassetto || stile.grassetto ? 'bold' : 'normal');
        doc.setFontSize(c.sx ? 7.6 : 7.4);
        const linee = spezzate[c.chiave] || [String(cella.testo)];
        linee.forEach((l, i) => doc.text(
          l,
          c.sx ? x + (stile.rientro ? 5.5 : 3) : x + c.w - 2.5,
          y + h - 1.9 - (linee.length - 1 - i) * 3.2,
          { align: c.sx ? 'left' : 'right' },
        ));
      }
      x += c.w;
    }
    doc.setFont('helvetica', 'normal');
    y += h;
  };

  // Il prezzo di una voce finisce nella colonna che la voce stessa indica: negli
  // impianti dell'ACI il loro foglio tiene stoccaggio e trattamento separati,
  // perche' lo stesso impianto puo' fare l'uno o l'altro a prezzi diversi e la
  // fattura li distingue.
  const cellePrezzo = (blocco, r) => {
    const cella = { testo: prezzo(r.prezzo), colore: r.prezzo ? C.testo : C.tenue };
    if (!blocco.due_prezzi) return { prezzo1: cella };
    return r.colonna_prezzo === 'trattamento' ? { prezzo2: cella } : { prezzo1: cella };
  };

  // UNA TABELLA DI BLOCCO, raccoglitori oppure impianti \ stoccaggi.
  //
  // A due livelli (RETE) il soggetto ha la sua riga di totale in grassetto e sotto
  // le voci rientrate; piatto (ACI) le righe del soggetto non si scrivono e ogni
  // voce porta davanti il nome del soggetto. Le voci a zero si stampano comunque:
  // il modello e' fisso, e una voce a zero dice che quel mese su quella provincia
  // non e' arrivato niente, che e' un'informazione e non una riga da nascondere.
  const tabellaBlocco = (f, blocco) => {
    const colonne = colonneBlocco(blocco);
    const piatto = f.stile === 'piatto';
    dove = `${f.nome_canale} · ${blocco.titolo}`;
    spazio(26);
    intestazioneRipetuta = () => intestazioneTabella(colonne);
    intestazioneTabella(colonne);
    // Le righe 'senza_voce' non stanno in tabella: non hanno ne' prezzo ne'
    // importo, e vanno lette tutte insieme in coda al blocco.
    const righe = (blocco.righe || []).filter(r => r.tipo !== 'senza_voce');
    if (!righe.length) {
      riga(colonne, { etichetta: { testo: 'Nessuna voce nel modello per questo blocco.', colore: C.grigio } }, { h: 6.5 });
    }
    let zebra = 0;
    for (const r of righe) {
      if (r.tipo === 'soggetto') {
        if (piatto) continue;
        // Il soggetto e le sue prime voci restano sulla stessa pagina: una riga di
        // totale in fondo al foglio, con le voci voltata pagina, non si legge.
        spazio(19);
        zebra = 0;
        riga(colonne, {
          etichetta: { testo: r.soggetto },
          tonnellate: { testo: t(r.tonnellate) },
          eer: { testo: EER_PFU },
          totale: { testo: euro(r.totale) },
        }, { sfondo: C.chiaro, accento: C.medio, grassetto: true, colore: C.scuro, h: 6.5, senzaBordo: true });
        continue;
      }
      // Nel foglio piatto l'etichetta porta il soggetto e, fra parentesi, la voce;
      // a due livelli la voce senza nome e' il fornitore con una voce sola, e un
      // trattino dice che quella riga vale tutto il suo mese.
      const etichetta = piatto
        ? (r.voce ? `${r.soggetto} - (${r.voce})` : r.soggetto)
        : (r.voce || '—');
      riga(colonne, {
        etichetta: { testo: etichetta, colore: !piatto && !r.voce ? C.grigio : C.testo },
        tonnellate: { testo: t(r.tonnellate), colore: r.tonnellate ? C.testo : C.tenue, grassetto: r.tonnellate > 0 },
        ...cellePrezzo(blocco, r),
        viaggi: { testo: r.viaggi ? formatIntero(r.viaggi) : '', colore: C.grigio },
        eer: piatto ? { testo: EER_PFU, colore: C.grigio } : {},
        totale: { testo: euro(r.totale), colore: r.totale ? C.testo : C.tenue },
        note: { testo: r.note || '', colore: C.grigio },
      }, { sfondo: zebra++ % 2 ? C.zebra : null, rientro: !piatto });
    }
    riga(colonne, {
      etichetta: { testo: 'Totale complessivo' },
      tonnellate: { testo: t(blocco.totale_t) },
      totale: { testo: euro(blocco.totale_euro) },
    }, { sfondo: C.scuro, grassetto: true, colore: C.bianco, h: 7.5, senzaBordo: true });
    y += 1;
    codaBlocco(blocco);
    y += 3;
  };

  // IL TRASPORTO DELLE SECONDARIE: un viaggio per riga.
  //
  // Qui non c'e' nessun modello fisso, perche' le righe sono i viaggi che il mese
  // ha avuto, e le colonne sono quelle del loro foglio, produttore, trasportatore
  // e destinatario compresi: una tratta si controlla sapendo da dove parte e dove
  // arriva, non solo quanto e' costata.
  const tabellaTrasporto = (f) => {
    const righe = f.trasporti.righe || [];
    const conNote = righe.some(r => r.note);
    const fisse = 24 + 24 + 26 + 18 + 32 + (conNote ? 36 : 0);
    const nome = (L - fisse) / 3;
    const colonne = [
      { chiave: 'produttore', w: nome, titolo: ['PRODUTTORE'], sx: true },
      { chiave: 'trasportatore', w: nome, titolo: ['TRASPORTATORE'], sx: true },
      { chiave: 'destinatario', w: nome, titolo: ['DESTINATARIO'], sx: true },
      { chiave: 'tonnellate', w: 24, titolo: ['PESO [t]'] },
      // «UNITÀ DI MISURA» e «nr. di viaggi» stanno su due righe come nel report
      // settimanale: su una riga sola, in colonne strette come queste, la seconda
      // parola veniva tagliata via.
      { chiave: 'unita', w: 24, titolo: ['UNITÀ DI', 'MISURA'] },
      { chiave: 'prezzo', w: 26, titolo: ['COSTO'] },
      { chiave: 'viaggi', w: 18, titolo: ['nr. di', 'viaggi'] },
      { chiave: 'totale', w: 32, titolo: ['TOTALE'] },
      ...(conNote ? [{ chiave: 'note', w: 36, titolo: ['Note'], sx: true }] : []),
    ];
    dove = `${f.nome_canale} · TRASPORTO`;
    spazio(32);
    // Il titolo sta su una riga sua, come nel loro foglio, e non dentro la prima
    // cella dell'intestazione: le tre colonne dei nomi sono strette e «TRASPORTO
    // (secondarie RETE)» ci veniva tagliato a meta'.
    doc.setTextColor(...C.scuro);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.6);
    doc.text(`TRASPORTO (secondarie ${f.nome_canale})`, M, y + 3.4);
    doc.setFont('helvetica', 'normal');
    y += 6;
    intestazioneRipetuta = () => intestazioneTabella(colonne);
    intestazioneTabella(colonne);
    if (!righe.length) {
      riga(colonne, { produttore: { testo: 'Nessun viaggio delle secondarie in questo mese.', colore: C.grigio } }, { h: 6.5 });
    }
    righe.forEach((r, i) => {
      riga(colonne, {
        produttore: { testo: r.produttore },
        trasportatore: { testo: r.trasportatore },
        destinatario: { testo: r.destinatario },
        tonnellate: { testo: t(r.tonnellate), grassetto: r.tonnellate > 0 },
        unita: { testo: unitaMisura(r.unita_misura), colore: C.grigio },
        prezzo: { testo: prezzo(r.prezzo), colore: r.prezzo ? C.testo : C.tenue },
        viaggi: { testo: r.viaggi ? formatIntero(r.viaggi) : '', colore: C.grigio },
        totale: { testo: euro(r.totale), colore: r.totale ? C.testo : C.tenue },
        note: { testo: r.note || '', colore: C.grigio },
      }, { sfondo: i % 2 ? C.zebra : null });
    });
    riga(colonne, {
      produttore: { testo: 'Totale trasporto' },
      tonnellate: { testo: t(f.trasporti.totale_t) },
      totale: { testo: euro(f.trasporti.totale_euro) },
    }, { sfondo: C.scuro, grassetto: true, colore: C.bianco, h: 7.5, senzaBordo: true });
    y += 4;
  };

  // QUELLO CHE AL MODELLO MANCA, in coda al suo blocco e in ambra.
  //
  // Le righe 'senza_voce' sono chili che il mese ha davvero avuto e che nessuna
  // voce ha preso: nessuna riga del foglio li sta fatturando. I 'non_previsti'
  // sono fornitori con movimenti e nessuna voce, e il gestionale non gli inventa
  // un prezzo. Si scrivono in fondo al loro blocco, in ambra, dicendo cosa fare,
  // perche' sono il segnale che il modello delle voci va aggiornato: finche'
  // restano li', il foglio non sta fatturando tutto il mese.
  function codaBlocco(blocco) {
    const senza = (blocco.righe || []).filter(r => r.tipo === 'senza_voce');
    const fuori = blocco.non_previsti || [];
    if (!senza.length && !fuori.length) return;
    const frasi = [];
    if (senza.length) {
      frasi.push(`Chili del mese che nessuna voce del modello ha preso, e che quindi nessuna riga qui sopra sta fatturando: ${
        senza.map(r => `${r.soggetto} ${t(r.tonnellate)} t${r.dettaglio ? ` (${r.dettaglio})` : ''}`).join('; ')
      }. Aggiungi la voce che manca, oppure allarga il criterio di una voce che c'è già.`);
    }
    if (fuori.length) {
      frasi.push(`Fornitori con movimenti nel mese e nessuna voce nel modello: ${
        fuori.map(x => `${x.soggetto} ${t(x.tonnellate)} t`).join('; ')
      }. Il gestionale non inventa un prezzo: vanno aggiunti al modello delle voci di questo blocco.`);
    }
    riquadroNota(frasi, { colore: C.ambra, sfondo: C.ambraChiaro, inchiostro: C.ambraScuro, titolo: 'Da sistemare nel modello delle voci' });
  }

  // Un riquadro di testo a se' stante: dopo un salto pagina non si ripete nessuna
  // intestazione di tabella, perche' la tabella e' finita.
  function riquadroNota(frasi, stile) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    const linee = frasi.flatMap(f => doc.splitTextToSize(f, L - 9));
    const h = linee.length * 3.3 + (stile.titolo ? 8.6 : 5);
    intestazioneRipetuta = () => {};
    spazio(h + 3);
    y += 2;
    doc.setFillColor(...stile.sfondo);
    doc.setDrawColor(...stile.colore);
    doc.setLineWidth(0.2);
    doc.roundedRect(M, y, L, h, 1.4, 1.4, 'FD');
    doc.setFillColor(...stile.colore);
    doc.rect(M, y + 1.5, 1.4, h - 3, 'F');
    let yy = y + 4.8;
    if (stile.titolo) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.6);
      doc.setTextColor(...stile.inchiostro);
      doc.text(stile.titolo, M + 4.5, yy);
      yy += 4.4;
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(...stile.inchiostro);
    linee.forEach((l, i) => doc.text(l, M + 4.5, yy + i * 3.3));
    y += h;
  }

  // Il titolo di un canale: il nome, il mese e a destra il totale del canale, come
  // nella prima riga di ogni blocco del loro foglio.
  const titoloCanale = (f) => {
    intestazioneRipetuta = () => {};
    spazio(16);
    y += 3;
    doc.setTextColor(...C.scuro);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`${f.nome_canale} — ${[f.mese || mese, f.anno || anno].filter(Boolean).join(' ')}`, M, y + 4);
    doc.setFontSize(10.5);
    doc.text(`Totale ${f.nome_canale}  ${euro(f.totale_euro)}`, W - M, y + 4, { align: 'right' });
    doc.setDrawColor(...C.medio);
    doc.setLineWidth(0.4);
    doc.line(M, y + 6.2, W - M, y + 6.2);
    doc.setFont('helvetica', 'normal');
    y += 10;
  };

  // LA LEGENDA, in fondo al documento.
  //
  // Chi riceve il PDF non ha sotto gli occhi il gestionale: le cose che fanno
  // leggere male questo foglio - le voci a zero, il trattino al posto del nome
  // della voce, i canali che non si sommano - vanno scritte una volta per tutte,
  // non spiegate a voce ogni mese.
  const legenda = () => {
    dove = '';
    riquadroNota([
      'Le voci di ogni fornitore sono un modello fisso, che l\'amministrazione corregge quando cambia un accordo: restano scritte anche quando il mese è a zero, così il foglio è identico ogni mese e un conferimento comparso dove prima non arrivava niente si vede a colpo d\'occhio.',
      'Un trattino al posto del nome della voce vuol dire che quel fornitore ha una voce sola e la riga vale tutto il suo mese. Il costo è in euro per tonnellata, tranne le righe pagate a viaggio, dove la colonna dei viaggi dice quanti ne sono stati contati.',
      'L\'EER 160103 è quello dei pneumatici fuori uso ed è lo stesso su tutte le righe. Le tonnellate sono i pesi effettivi del mese, con due decimali.',
      'RETE, ACI ed extra raccolta sono canali indipendenti e non si sommano mai fra loro: per questo ogni canale ha il suo totale e in fondo al documento non c\'è nessun totale generale.',
      'Le righe in ambra sono quello che al modello manca: finché restano, il foglio non sta fatturando tutto il mese.',
    ], { colore: C.medio, sfondo: C.zebra, inchiostro: C.testo, titolo: 'Come si legge questo documento' });
  };

  intestazionePagina();
  if (!elenco.length) {
    doc.setTextColor(...C.grigio);
    doc.setFontSize(9);
    doc.text('Nessun canale da stampare per questo mese.', M, y + 4);
    y += 10;
  }
  for (const f of elenco) {
    titoloCanale(f);
    riquadri(f);
    tabellaBlocco(f, f.raccoglitori);
    tabellaBlocco(f, f.impianti);
    tabellaTrasporto(f);
  }
  legenda();
  piede();

  // Il nome del file e' lo stesso dei fogli Excel della passiva, e lo decide un
  // punto solo: chi archivia il mese trova il PDF e il foglio uno accanto
  // all'altro, e se lo schema cambia cambia in entrambi.
  doc.save(nomeFilePassiva(anno, mese, 'unico', 'pdf'));
}
