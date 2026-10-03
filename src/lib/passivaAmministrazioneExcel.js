// IL FOGLIO EXCEL DELLA PASSIVA: QUELLO CHE SI MANDA FUORI.
//
// L'utente, 03/10/2026: «quando dico professionale intendo quello che hai gia'
// fatto quando mi fai pubblicare il report con le settimane nel modulo report,
// quello si' che e' un modo professionale di inviare documenti». Il file che
// usciva prima lo scriveva SheetJS, che nella versione del progetto non sa fare
// ne' grassetti ne' colori: veniva fuori una griglia di numeri nudi, dove la
// riga di un fornitore e quella di una sua voce si somigliavano e il totale del
// canale si perdeva in mezzo. Qui si usa exceljs, che nel progetto c'e' gia'
// (foglioDichiarazioni.js, documentiIrigom.js) e sa fare tutto quello che un
// foglio da mandare all'amministrazione deve avere: fasce, colori, intestazioni
// ripetute in stampa, piede di pagina.
//
// LA PALETTE E' QUELLA DEL REPORT SETTIMANALE (reportSettimanaleExport.js), ed
// e' una scelta, non un caso: i documenti che escono dal gestionale si devono
// riconoscere come fratelli, perche' chi li riceve li vede uno dopo l'altro.
// Li' i colori sono terne RGB per jsPDF, qui sono ARGB perche' li vuole cosi'
// exceljs: lo stesso 0F4C5C diventa 'FF0F4C5C'.
//
// I TOTALI SONO FORMULE, NON NUMERI MORTI.
//
// Dentro questo foglio l'amministrazione ci LAVORA: corregge un prezzo che era
// cambiato e si aspetta che i totali si rifacciano. E' cosi' che e' fatto il
// loro file di settembre, ed e' il motivo per cui ci lavorano dentro invece di
// chiederne un altro. Percio' il totale di una voce e' peso per prezzo, il
// totale di un fornitore e' la somma delle sue voci, il «Totale complessivo» e'
// la somma dei fornitori e il numero nella fascia del canale e' la somma dei
// tre blocchi. Ogni formula porta con se' il risultato gia' calcolato, cosi' il
// numero si vede anche prima che Excel ricalcoli.
//
// LA FORMA DEI DATI la costruisce passivaAmministrazione.js (foglioPassiva): un
// foglio e' un canale di un mese, con i blocchi RACCOGLITORI e
// IMPIANTI \ STOCCAGGI e il TRASPORTO delle secondarie. Lo stile 'due_livelli'
// (la rete) scrive la riga del fornitore e sotto le sue voci rientrate; lo
// stile 'piatto' (l'ACI) non scrive la riga del fornitore e mette tutto su una
// riga per voce. Qui dentro non si calcola niente: i numeri arrivano fatti, e
// questo file decide soltanto come si vedono.
//
// Qui non si scrive su disco e non si scarica niente: chi chiama resta l'unico a
// sapere dove finisce il file.

import { COLORI, FORMATI, nuovaCartella, perLaStampa, bytesDi } from '@/lib/fogliProfessionali';

// I colori, i formati dei numeri, la cartella firmata e l'impostazione di
// stampa stanno nel corredo comune dei fogli che si mandano fuori: se un domani
// la palette cambia, cambia per tutti i documenti insieme e non si scoprono due
// verdi diversi su due allegati della stessa mail.
const { scuro: SCURO, medio: MEDIO, chiaro: CHIARO, zebra: ZEBRA, bordo: BORDO, bianco: BIANCO, testo: TESTO, grigio: TENUE } = COLORI;
const TONN = FORMATI.tonnellate;
const TONN3 = FORMATI.tonnellateTre;
const EURO = FORMATI.euro;
const INTERO = FORMATI.intero;
const COD = FORMATI.codice;

// L'EER dei PFU. Nel foglio dell'amministrazione sta sulla riga del fornitore
// quando le voci sono rientrate, e su ogni riga quando la tabella e' piatta.
const EER_PFU = 160103;

// Nove colonne: le cinque o sei dei due blocchi, le otto del trasporto, e in
// coda quella delle note. Le larghezze sono un compromesso, perche' nello
// stesso foglio convivono tabelle diverse: la prima colonna tiene i nomi dei
// fornitori, la seconda e la terza stanno larghe perche' nel trasporto portano
// trasportatore e destinatario.
const LARGHEZZE = [44, 22, 22, 15, 17, 15, 13, 17, 44];
const LARGHEZZA = LARGHEZZE.length;

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const n2 = (v) => Math.round(num(v) * 100) / 100;
const testo = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const elenco = (v) => (Array.isArray(v) ? v : []);
/** Il formato delle tonnellate: tre decimali solo se i chili non sono tondi. */
const fmtT = (v) => (Math.round(num(v) * 1000) % 10 === 0 ? TONN : TONN3);
/** La lettera di una colonna, per scrivere le formule. */
const lettera = (n) => String.fromCharCode(64 + n);

const linea = { style: 'thin', color: { argb: BORDO } };
const GRIGLIA = { top: linea, left: linea, bottom: linea, right: linea };
// Sopra la riga di un fornitore un filo piu' marcato, cosi' si vede dove
// comincia un fornitore nuovo anche senza badare al grassetto.
const APRE = { ...GRIGLIA, top: { style: 'medium', color: { argb: MEDIO } } };
// Sopra il totale il doppio filo, che in un foglio di conti vuol dire «qui si
// chiude».
const CHIUDE = { ...GRIGLIA, top: { style: 'double', color: { argb: SCURO } } };

/**
 * Scrive una cella con il suo stile. Tutto il foglio passa da qui: cosi' il
 * carattere, l'allineamento verticale e i colori sono gli stessi dappertutto e
 * non capita la cella che si dimentica il formato.
 */
function scrivi(ws, r, c, valore, st = {}) {
  const cel = ws.getCell(r, c);
  if (valore !== null && valore !== undefined && valore !== '') cel.value = valore;
  if (st.fmt) cel.numFmt = st.fmt;
  cel.font = {
    name: 'Calibri',
    size: st.corpo || 10,
    bold: !!st.grassetto,
    italic: !!st.corsivo,
    color: { argb: st.colore || TESTO },
  };
  if (st.sfondo) cel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: st.sfondo } };
  cel.alignment = {
    horizontal: st.allinea || 'left',
    vertical: 'middle',
    wrapText: !!st.capo,
    ...(st.rientro ? { indent: st.rientro } : {}),
  };
  if (st.bordo) cel.border = st.bordo;
  return cel;
}

/** Veste di uno stesso stile una riga intera, prima di scriverci sopra i valori. */
function stendi(ws, r, da, a, st) {
  for (let c = da; c <= a; c++) scrivi(ws, r, c, null, st);
}

/**
 * La somma di certe righe di una colonna. Un intervallo quando le righe sono
 * una di fila all'altra - com'e' quasi sempre - e l'elenco delle celle quando
 * in mezzo c'e' una riga che non va contata (quelle senza voce, per esempio).
 */
function somma(colonna, righe) {
  if (!righe.length) return null;
  const L = lettera(colonna);
  const difila = righe.every((r, i) => i === 0 || r === righe[i - 1] + 1);
  if (difila && righe.length > 1) return `SUM(${L}${righe[0]}:${L}${righe[righe.length - 1]})`;
  return `SUM(${righe.map(r => `${L}${r}`).join(',')})`;
}

/**
 * Un blocco del foglio - RACCOGLITORI oppure IMPIANTI \ STOCCAGGI - a partire
 * dalla riga r0. Torna dove e' arrivato e in che cella sta il suo totale, che
 * serve alla fascia del canale per sommare i tre blocchi.
 *
 * Le colonne non sono le stesse nei due casi, e non per capriccio: nel foglio
 * dell'amministrazione gli impianti dell'ACI hanno DUE prezzi - stoccaggio e
 * trattamento - e l'EER scivola a destra per fargli posto.
 */
function scriviBlocco(ws, r0, blocco0, { titolo, etichetta, stile }) {
  const blocco = blocco0 && typeof blocco0 === 'object' ? blocco0 : {};
  const capo = testo(blocco.titolo) || titolo;
  const due = blocco.due_prezzi === true;
  const col = due
    ? { nome: 1, tonn: 2, stoccaggio: 3, trattamento: 4, totale: 5, eer: 6, note: 7 }
    : { nome: 1, tonn: 2, prezzo: 3, eer: 4, totale: 5, note: 6 };
  const ultima = col.note;
  const testa = { sfondo: MEDIO, colore: BIANCO, grassetto: true, bordo: GRIGLIA, capo: true };
  const centro = { ...testa, allinea: 'center' };

  let r = r0;
  stendi(ws, r, 1, ultima, testa);
  scrivi(ws, r, col.nome, capo, testa);
  scrivi(ws, r, col.tonn, 'Totale [t]', centro);
  if (due) {
    // Con due prezzi l'etichetta unica del blocco non serve: le colonne si
    // chiamano come nel foglio dell'amministrazione.
    scrivi(ws, r, col.stoccaggio, 'Costo di Stoccaggio [€\\t]', centro);
    scrivi(ws, r, col.trattamento, 'Costo di Trattamento [€\\t]', centro);
  } else {
    scrivi(ws, r, col.prezzo, testo(blocco.etichetta_prezzo) || etichetta, centro);
  }
  scrivi(ws, r, col.eer, 'EER', centro);
  scrivi(ws, r, col.totale, 'TOTALE', centro);
  scrivi(ws, r, col.note, 'Note', testa);
  ws.getRow(r).height = 30;
  r++;

  // Le righe che il «Totale complessivo» somma: i fornitori quando le voci sono
  // rientrate, le voci stesse quando la tabella e' piatta.
  const sommandi = [];
  let aperto = null; // il fornitore in corso, con le righe delle sue voci
  const chiudiFornitore = () => {
    if (!aperto) return;
    const t = somma(col.tonn, aperto.voci);
    const e = somma(col.totale, aperto.voci);
    // Un fornitore senza nemmeno una voce nel modello non ha niente da sommare:
    // si scrive il numero che arriva dai movimenti, perche' perderlo sarebbe
    // peggio che scriverlo senza formula.
    scrivi(ws, aperto.riga, col.tonn,
      t ? { formula: t, result: num(aperto.dati.tonnellate) } : num(aperto.dati.tonnellate),
      { ...aperto.st, allinea: 'right', fmt: fmtT(aperto.dati.tonnellate) });
    scrivi(ws, aperto.riga, col.totale,
      e ? { formula: e, result: n2(aperto.dati.totale) } : n2(aperto.dati.totale),
      { ...aperto.st, allinea: 'right', fmt: EURO });
    aperto = null;
  };
  let zebrata = false;

  for (const riga of elenco(blocco.righe)) {
    if (!riga) continue;

    if (riga.tipo === 'soggetto') {
      // Nello stile piatto la riga del fornitore non si scrive: il suo nome sta
      // sulla riga della voce.
      if (stile === 'piatto') continue;
      chiudiFornitore();
      const st = { grassetto: true, sfondo: CHIARO, bordo: APRE };
      stendi(ws, r, 1, ultima, st);
      scrivi(ws, r, col.nome, testo(riga.soggetto), st);
      scrivi(ws, r, col.eer, EER_PFU, { ...st, allinea: 'center', fmt: COD });
      aperto = { riga: r, voci: [], dati: riga, st };
      sommandi.push(r);
      zebrata = false;
      r++;
      continue;
    }

    if (riga.tipo === 'senza_voce') {
      // I chili che nessuna voce ha preso. Non si nascondono e non entrano in
      // nessun totale: sono il segnale che il modello va aggiornato, e dentro
      // un totale direbbero di aver pagato qualcosa che nessun accordo copre.
      const st = { sfondo: CHIARO, bordo: GRIGLIA };
      stendi(ws, r, 1, ultima, st);
      // Il nome porta appeso il motivo: senza, la riga si legge come un secondo
      // fornitore con lo stesso nome, e chi guarda il foglio pensa a un doppione
      // invece di andare a leggere la nota.
      scrivi(ws, r, col.nome, `${testo(riga.soggetto)} — senza voce nel modello`, { ...st, corsivo: true, rientro: 1 });
      scrivi(ws, r, col.tonn, num(riga.tonnellate), { ...st, allinea: 'right', fmt: fmtT(riga.tonnellate) });
      scrivi(ws, r, col.note, [
        'chili senza voce nel modello: aggiungi la voce o correggi il criterio',
        testo(riga.dettaglio),
      ].filter(Boolean).join(' — '), { ...st, corsivo: true });
      r++;
      continue;
    }

    // Una voce. Il prezzo va nella colonna che dice la voce stessa: con due
    // prezzi finire nell'altra colonna vorrebbe dire fatturare un trattamento
    // come uno stoccaggio.
    const colPrezzo = due
      ? (riga.colonna_prezzo === 'trattamento' ? col.trattamento : col.stoccaggio)
      : col.prezzo;
    const nome = stile === 'piatto'
      ? (testo(riga.voce) ? `${testo(riga.soggetto)} - (${testo(riga.voce)})` : testo(riga.soggetto))
      // Con le voci rientrate il fornitore e' nella riga sopra: la voce senza
      // nome e' quella del fornitore con un accordo solo, e resta vuota come
      // nel foglio dell'amministrazione.
      : testo(riga.voce);
    const aViaggio = riga.unita_misura === 'euro_viaggio';
    const viaggi = Math.round(num(riga.viaggi));
    const st = { bordo: GRIGLIA, ...(zebrata ? { sfondo: ZEBRA } : {}) };
    stendi(ws, r, 1, ultima, st);
    scrivi(ws, r, col.nome, nome, { ...st, rientro: stile === 'piatto' ? 0 : 2 });
    scrivi(ws, r, col.tonn, num(riga.tonnellate), { ...st, allinea: 'right', fmt: fmtT(riga.tonnellate) });
    // Un prezzo solo non sempre c'e': quando le righe della voce hanno tariffe
    // diverse fra loro, la cella del prezzo resta vuota e l'importo si scrive
    // come numero, non come formula - una formula su una cella vuota, appena
    // Excel ricalcola, azzererebbe la riga.
    const prezzoNoto = riga.prezzo !== null && riga.prezzo !== undefined;
    scrivi(ws, r, colPrezzo, prezzoNoto ? num(riga.prezzo) : '', { ...st, allinea: 'right', fmt: EURO });
    if (stile === 'piatto') scrivi(ws, r, col.eer, EER_PFU, { ...st, allinea: 'center', fmt: COD });
    // Il prezzo a viaggio non ha una colonna dei viaggi in questa tabella: la
    // formula si tiene dentro il numero dei viaggi e la nota lo dice, cosi'
    // correggere il prezzo rifa' il totale anche qui.
    scrivi(ws, r, col.totale, prezzoNoto ? {
      formula: aViaggio
        ? `${lettera(colPrezzo)}${r}*${viaggi}`
        : `${lettera(col.tonn)}${r}*${lettera(colPrezzo)}${r}`,
      result: n2(riga.totale),
    } : n2(riga.totale), { ...st, allinea: 'right', fmt: EURO });
    scrivi(ws, r, col.note, [
      aViaggio ? `prezzo a viaggio, ${viaggi} ${viaggi === 1 ? 'viaggio' : 'viaggi'}` : '',
      testo(riga.note),
    ].filter(Boolean).join(' — '), { ...st, corsivo: true, colore: TENUE });
    if (aperto) aperto.voci.push(r);
    else sommandi.push(r);
    zebrata = !zebrata;
    r++;
  }
  chiudiFornitore();

  const st = { grassetto: true, sfondo: CHIARO, bordo: CHIUDE };
  stendi(ws, r, 1, ultima, st);
  scrivi(ws, r, col.nome, 'Totale complessivo', st);
  const t = somma(col.tonn, sommandi);
  const e = somma(col.totale, sommandi);
  scrivi(ws, r, col.tonn, t ? { formula: t, result: num(blocco.totale_t) } : num(blocco.totale_t),
    { ...st, allinea: 'right', fmt: fmtT(blocco.totale_t) });
  scrivi(ws, r, col.totale, e ? { formula: e, result: n2(blocco.totale_euro) } : n2(blocco.totale_euro),
    { ...st, allinea: 'right', fmt: EURO });
  const cellaTotale = `${lettera(col.totale)}${r}`;
  r++;

  // Chi ha movimenti nel mese e nessuna voce nel modello. Sta in coda al SUO
  // blocco e la riga di spiegazione dice quale: prima raccoglitori e impianti
  // finivano in un elenco solo, e lo stesso nome - che davvero compare in tutti
  // e due, una volta come raccoglitore e una come impianto - sembrava scritto
  // due volte per sbaglio.
  const fuori = elenco(blocco.non_previsti);
  if (fuori.length) {
    r++;
    const sp = { grassetto: true, sfondo: CHIARO, colore: SCURO, capo: true };
    stendi(ws, r, 1, ultima, sp);
    scrivi(ws, r, 1, `NON PREVISTI DAL MODELLO — ${capo}: hanno movimenti nel mese e nessuna voce. Aggiungi la voce o correggi il criterio; qui non si inventa un prezzo.`, sp);
    ws.mergeCells(r, 1, r, ultima);
    ws.getRow(r).height = 28;
    r++;
    for (const x of fuori) {
      const sx = { bordo: GRIGLIA };
      stendi(ws, r, 1, ultima, sx);
      scrivi(ws, r, 1, testo(x.soggetto), sx);
      scrivi(ws, r, col.tonn, num(x.tonnellate), { ...sx, allinea: 'right', fmt: fmtT(x.tonnellate) });
      r++;
    }
  }
  return { prossima: r, cellaTotale };
}

/**
 * Il TRASPORTO delle secondarie: un viaggio per riga, come nel foglio
 * dell'amministrazione. Le righe non vengono da un modello di voci - sono i
 * viaggi che il mese ha avuto - percio' qui una tabella vuota si dice a parole,
 * invece di restare una cornice senza niente dentro.
 */
function scriviTrasporto(ws, r0, trasporti0, nomeCanale) {
  const trasporti = trasporti0 && typeof trasporti0 === 'object' ? trasporti0 : {};
  const righe = elenco(trasporti.righe);
  const ultima = 9;
  let r = r0;
  const sp = { grassetto: true, sfondo: CHIARO, colore: SCURO, bordo: { top: { style: 'medium', color: { argb: MEDIO } } } };
  stendi(ws, r, 1, ultima, sp);
  scrivi(ws, r, 1, `TRASPORTO (secondarie ${nomeCanale})`, sp);
  ws.mergeCells(r, 1, r, ultima);
  r++;

  const testa = { sfondo: MEDIO, colore: BIANCO, grassetto: true, bordo: GRIGLIA, capo: true };
  const centro = { ...testa, allinea: 'center' };
  stendi(ws, r, 1, ultima, testa);
  scrivi(ws, r, 1, 'PRODUTTORE', testa);
  scrivi(ws, r, 2, 'TRASPORTATORE', testa);
  scrivi(ws, r, 3, 'DESTINATARIO', testa);
  scrivi(ws, r, 4, 'PESO [t]', centro);
  scrivi(ws, r, 5, "UNITA' DI MISURA", centro);
  scrivi(ws, r, 6, 'COSTO', centro);
  scrivi(ws, r, 7, 'nr. di viaggi', centro);
  scrivi(ws, r, 8, 'TOTALE', centro);
  scrivi(ws, r, 9, 'Note', testa);
  ws.getRow(r).height = 30;
  r++;

  const sommandi = [];
  let zebrata = false;
  for (const t of righe) {
    if (!t) continue;
    const aViaggio = t.unita_misura === 'euro_viaggio';
    const st = { bordo: GRIGLIA, ...(zebrata ? { sfondo: ZEBRA } : {}) };
    stendi(ws, r, 1, ultima, st);
    scrivi(ws, r, 1, testo(t.produttore), st);
    scrivi(ws, r, 2, testo(t.trasportatore), st);
    scrivi(ws, r, 3, testo(t.destinatario), st);
    scrivi(ws, r, 4, num(t.tonnellate), { ...st, allinea: 'right', fmt: fmtT(t.tonnellate) });
    scrivi(ws, r, 5, aViaggio ? '€\\vg' : '€\\t', { ...st, allinea: 'center' });
    scrivi(ws, r, 6, num(t.prezzo), { ...st, allinea: 'right', fmt: EURO });
    scrivi(ws, r, 7, Math.round(num(t.viaggi)) || null, { ...st, allinea: 'center', fmt: INTERO });
    // A tonnellata e' peso per costo, a viaggio e' costo per numero di viaggi:
    // la formula segue l'unita' di misura scritta sulla riga accanto.
    scrivi(ws, r, 8, { formula: aViaggio ? `F${r}*G${r}` : `D${r}*F${r}`, result: n2(t.totale) },
      { ...st, allinea: 'right', fmt: EURO });
    scrivi(ws, r, 9, testo(t.note), { ...st, corsivo: true, colore: TENUE });
    sommandi.push(r);
    zebrata = !zebrata;
    r++;
  }
  if (!sommandi.length) {
    const st = { corsivo: true, colore: TENUE, bordo: GRIGLIA };
    stendi(ws, r, 1, ultima, st);
    scrivi(ws, r, 1, 'Nessun viaggio di secondaria in questo mese.', st);
    r++;
  }

  const st = { grassetto: true, sfondo: CHIARO, bordo: CHIUDE };
  stendi(ws, r, 1, ultima, st);
  scrivi(ws, r, 1, 'Totale trasporto', st);
  const t = somma(4, sommandi);
  const e = somma(8, sommandi);
  scrivi(ws, r, 4, t ? { formula: t, result: num(trasporti.totale_t) } : num(trasporti.totale_t),
    { ...st, allinea: 'right', fmt: fmtT(trasporti.totale_t) });
  scrivi(ws, r, 8, e ? { formula: e, result: n2(trasporti.totale_euro) } : n2(trasporti.totale_euro),
    { ...st, allinea: 'right', fmt: EURO });
  return { prossima: r + 1, cellaTotale: `H${r}` };
}

/** Il periodo come si scrive nei titoli: «Settembre 2026». */
const periodoDi = (f) => [testo(f && f.mese), f && f.anno ? String(f.anno) : ''].filter(Boolean).join(' ');

/** Lo stile del foglio: quello scritto nei dati, o quello del canale. */
const stileDi = (f) => (f.stile === 'piatto' || f.stile === 'due_livelli'
  ? f.stile
  : (testo(f.canale).toUpperCase() === 'ACI' ? 'piatto' : 'due_livelli'));

/**
 * Un canale intero: la fascia col suo totale, i due blocchi e il trasporto.
 * Torna la prima riga libera sotto.
 *
 * Il totale della fascia si scrive per ultimo, anche se sta in cima: prima
 * bisogna sapere in quali celle sono finiti i totali dei tre blocchi, perche'
 * quel numero e' la loro somma e non una copia.
 */
function scriviCanale(ws, r0, f) {
  const nome = testo(f.nome_canale) || testo(f.canale) || 'CANALE';
  const periodo = periodoDi(f);
  const stile = stileDi(f);
  const st = { sfondo: SCURO, colore: BIANCO, grassetto: true, corpo: 13 };
  stendi(ws, r0, 1, LARGHEZZA, st);
  scrivi(ws, r0, 1, periodo ? `${nome} · ${periodo}` : nome, st);
  ws.getRow(r0).height = 26;
  ws.mergeCells(r0, 1, r0, 4);

  let r = r0 + 2;
  const racc = scriviBlocco(ws, r, f.raccoglitori, { titolo: 'RACCOGLITORI', etichetta: 'Costo di Raccolta [€\\t]', stile });
  r = racc.prossima + 1;
  const imp = scriviBlocco(ws, r, f.impianti, { titolo: 'IMPIANTI \\ STOCCAGGI', etichetta: 'Costo [€\\t]', stile });
  r = imp.prossima + 1;
  const tra = scriviTrasporto(ws, r, f.trasporti, nome);

  scrivi(ws, r0, 5, { formula: `${racc.cellaTotale}+${imp.cellaTotale}+${tra.cellaTotale}`, result: n2(f.totale_euro) },
    { ...st, allinea: 'right', fmt: EURO });
  return tra.prossima;
}

/** Il titolo in cima al foglio: chi manda il documento e di che mese parla. */
function titoloFoglio(ws, periodo) {
  const st = { grassetto: true, corpo: 14, colore: SCURO };
  stendi(ws, 1, 1, LARGHEZZA, st);
  scrivi(ws, 1, 1, `SMOCO S.r.l. · Commessa Ecotyre · Fatturazione passiva${periodo ? ` — ${periodo}` : ''}`, st);
  ws.getRow(1).height = 22;
  ws.mergeCells(1, 1, 1, LARGHEZZA);
}

/**
 * La nota in fondo. Le due cose che chi riceve il foglio deve sapere: che le
 * voci a zero ci sono di proposito, e che i totali sono formule - cosi' nessuno
 * ricalcola a mano una colonna che si rifa' da se'.
 */
function notaFinale(ws, r) {
  const st = { corsivo: true, colore: TENUE, capo: true };
  stendi(ws, r, 1, LARGHEZZA, st);
  scrivi(ws, r, 1, 'Le voci del modello restano nel foglio anche a zero: il foglio e\' lo stesso ogni mese e un conferimento comparso dove prima non ce n\'erano si vede subito. I totali sono formule: correggi un prezzo e i totali si rifanno da soli. Tonnellate con due decimali (tre quando i chili non sono tondi), importi in euro, EER 160103 dei PFU. I canali non si sommano fra loro.', st);
  ws.mergeCells(r, 1, r, LARGHEZZA);
  ws.getRow(r).height = 30;
}

/**
 * Larghezze, stampa e piede di pagina. Questo foglio finisce allegato a una
 * mail oppure stampato dentro una pratica: orizzontale e stretto in larghezza
 * su una pagina, col numero di pagina in fondo, perche' un allegato di tre
 * fogli senza numeri non si rimette in ordine.
 */
function impagina(ws) {
  ws.columns = LARGHEZZE.map(width => ({ width }));
  perLaStampa(ws, { ripeti: 1 });
}

const bytes = async (wb) => new Uint8Array(await bytesDi(wb));

/** Un nome di foglio che Excel accetta: niente caratteri proibiti, al piu' 31. */
const nomeFoglio = (nome) => (testo(nome).replace(/[:\\/?*[\]]/g, ' ').slice(0, 31) || 'CANALE');

/**
 * UN FOGLIO SOLO, i canali uno sotto l'altro: e' la copia del file che
 * l'amministrazione ha sul suo computer, e serve a chi vuole guardare tutto
 * insieme.
 * @param {array} fogli i canali, come li costruisce foglioPassiva
 * @returns {Promise<Uint8Array>} il contenuto del file .xlsx
 */
export async function cartellaPassivaUnFoglio(fogli) {
  const quali = elenco(fogli).filter(Boolean);
  const periodo = periodoDi(quali[0] || {});
  const { wb } = await nuovaCartella();
  const ws = wb.addWorksheet('PASSIVA', { views: [{ showGridLines: false }] });
  impagina(ws);
  titoloFoglio(ws, periodo);
  // Due righe vuote fra un canale e l'altro: i canali non si sommano mai, e
  // nemmeno a vedersi devono sembrare la continuazione uno dell'altro.
  let r = 3;
  for (const f of quali) r = scriviCanale(ws, r, f) + 2;
  notaFinale(ws, r);
  return bytes(wb);
}

/**
 * UN FOGLIO DI LAVORO PER CANALE: piu' comodo da leggere e da stampare, e la
 * prima riga resta ferma mentre si scorre.
 * @param {array} fogli i canali, come li costruisce foglioPassiva
 * @returns {Promise<Uint8Array>} il contenuto del file .xlsx
 */
export async function cartellaPassivaPerCanale(fogli) {
  const quali = elenco(fogli).filter(Boolean);
  const { wb } = await nuovaCartella();
  for (const f of quali) {
    const periodo = periodoDi(f);
    const ws = wb.addWorksheet(nomeFoglio(f.nome_canale || f.canale), {
      views: [{ state: 'frozen', ySplit: 1, showGridLines: false }],
    });
    impagina(ws);
    titoloFoglio(ws, periodo);
    notaFinale(ws, scriviCanale(ws, 3, f) + 1);
  }
  // Una cartella senza nemmeno un foglio di lavoro non si apre: se non c'e'
  // nessun canale si scrive un foglio che lo dice.
  if (!quali.length) {
    const ws = wb.addWorksheet('PASSIVA', { views: [{ showGridLines: false }] });
    impagina(ws);
    titoloFoglio(ws, '');
    scrivi(ws, 3, 1, 'Nessun canale da esportare.', { corsivo: true, colore: TENUE });
  }
  return bytes(wb);
}
