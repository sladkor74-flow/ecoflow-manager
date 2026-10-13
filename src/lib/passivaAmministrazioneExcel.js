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
const LARGHEZZE = [44, 22, 22, 18, 18, 16, 14, 17, 40];
const LARGHEZZA = LARGHEZZE.length;

// L'extra raccolta ha una tabella sua, di sedici colonne: quando il canale ha un
// foglio tutto suo si usano queste, che sono fatte per quelle colonne. Nel file
// con tutti i canali insieme le colonne sono le stesse per tutti e il compromesso
// e' inevitabile - e' cosi' anche nel foglio dell'amministrazione.
const LARGHEZZE_EXTRA = [20, 18, 34, 28, 28, 13, 13, 11, 15, 12, 15, 16, 17, 18, 15, 16, 40];

// IL SURPLUS SULLE TARIFFE (13/10/2026): la riga del Fuel Surcharge e di ogni
// altro surplus ha un colore solo, lo stesso nella pagina, nei fogli e nei PDF
// (indaco: l'ambra e il rosso qui vogliono dire «c'e' un problema», e il surplus
// non lo e'), una barra a sinistra, il nome in corsivo, e le tonnellate fra
// parentesi: sono le stesse del mese, si leggono ma non si sommano. Il numero
// resta un numero (il formato mette le parentesi), cosi' la formula t x €/t
// della riga si rifa' se l'amministrazione corregge il prezzo; le somme delle
// tonnellate del fornitore e del blocco non la prendono, quelle degli euro si'.
const SURPLUS = 'FF6366F1';
const SURPLUS_CHIARO = 'FFEEF2FF';
const SURPLUS_SCURO = 'FF3730A3';
const TONN_SURPLUS = '(#,##0.00)';
const TONN3_SURPLUS = '(#,##0.000)';
const eSurplus = (r) => !!r && r.tipo === 'surplus';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const n2 = (v) => Math.round(num(v) * 100) / 100;
const testo = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const elenco = (v) => (Array.isArray(v) ? v : []);
/**
 * I chili dentro una frase, all'italiana: «2.216 kg». Un peso che manca si scrive
 * «— kg», non 0 (11/10/2026); toLocaleString in italiano non separa le
 * migliaia dei numeri a quattro cifre, quindi il punto si mette a mano.
 */
const kgTesto = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v))
  ? '— kg'
  : `${String(Math.round(Number(v))).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} kg`);
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
// La riga del surplus: la barra di colore e' il bordo sinistro della prima cella.
const BARRA_SURPLUS = { ...GRIGLIA, left: { style: 'thick', color: { argb: SURPLUS } } };
/** Il formato delle tonnellate di una riga del surplus: fra parentesi, tre decimali solo se i chili non sono tondi. */
const fmtTSurplus = (v) => (Math.round(num(v) * 1000) % 10 === 0 ? TONN_SURPLUS : TONN3_SURPLUS);

/**
 * UNA RIGA DEL SURPLUS, in una tabella qualunque del foglio: il nome nella sua
 * colonna, le tonnellate fra parentesi, il prezzo a tonnellata nella colonna
 * giusta e il totale come formula t x €/t arrotondata al centesimo, che porta
 * dentro il numero del calcolo. `colonne`: { nome, tonn, prezzo, totale, note,
 * soggetto? } e `ultima` per lo sfondo.
 */
function scriviRigaSurplus(ws, r, riga, { nome, soggetto, tonn, prezzo, totale, note }, ultima, etichetta) {
  const st = { bordo: GRIGLIA, sfondo: SURPLUS_CHIARO };
  stendi(ws, r, 1, ultima, st);
  scrivi(ws, r, 1, null, { ...st, bordo: BARRA_SURPLUS });
  scrivi(ws, r, nome, etichetta, { ...st, bordo: nome === 1 ? BARRA_SURPLUS : GRIGLIA, corsivo: true, colore: SURPLUS_SCURO, rientro: nome === 1 ? 2 : 0 });
  if (soggetto) scrivi(ws, r, soggetto, testo(riga.soggetto), st);
  scrivi(ws, r, tonn, num(riga.tonnellate), { ...st, corsivo: true, colore: TENUE, allinea: 'right', fmt: fmtTSurplus(riga.tonnellate) });
  if (prezzo) {
    scrivi(ws, r, prezzo, num(riga.prezzo), { ...st, allinea: 'right', fmt: EURO });
    scrivi(ws, r, totale, { formula: `ROUND(${lettera(tonn)}${r}*${lettera(prezzo)}${r},2)`, result: n2(riga.totale) }, { ...st, allinea: 'right', fmt: EURO });
  } else {
    // Un prezzo senza colonna (il trasporto delle secondarie nell'extra
    // raccolta, che li' si paga a viaggio): l'importo si scrive com'e'.
    scrivi(ws, r, totale, n2(riga.totale), { ...st, allinea: 'right', fmt: EURO });
  }
  scrivi(ws, r, note, testo(riga.note), { ...st, corsivo: true, colore: TENUE });
  return `${lettera(totale)}${r}`;
}

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
  // rientrate, le voci stesse quando la tabella e' piatta. Due elenchi
  // (13/10/2026): le tonnellate non prendono le righe del surplus, che sono le
  // stesse del mese; gli euro si'. Senza surplus i due elenchi sono uguali e le
  // formule quelle di prima.
  const sommandiT = [];
  const sommandiE = [];
  const celleSurplus = [];
  let aperto = null; // il fornitore in corso, con le righe delle sue voci e dei suoi surplus
  const chiudiFornitore = () => {
    if (!aperto) return;
    const t = somma(col.tonn, aperto.voci);
    const e = somma(col.totale, [...aperto.voci, ...aperto.surplus].sort((a, b) => a - b));
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
      aperto = { riga: r, voci: [], surplus: [], dati: riga, st };
      sommandiT.push(r);
      sommandiE.push(r);
      zebrata = false;
      r++;
      continue;
    }

    if (eSurplus(riga)) {
      // Il surplus sotto le voci del fornitore: nello stile piatto porta davanti
      // il soggetto, come le voci («NAPPI SUD - (Fuel Surcharge)»); a due livelli
      // il nome e da dove viene. Il prezzo va nella colonna della prestazione.
      const colPrezzo = due
        ? (riga.colonna_prezzo === 'trattamento' ? col.trattamento : col.stoccaggio)
        : col.prezzo;
      const etichetta = stile === 'piatto'
        ? `${testo(riga.soggetto)} - (${testo(riga.nome)})`
        : [testo(riga.nome), testo(riga.origine)].filter(Boolean).join(' · ');
      celleSurplus.push(scriviRigaSurplus(ws, r, riga, { nome: col.nome, tonn: col.tonn, prezzo: colPrezzo, totale: col.totale, note: col.note }, ultima, etichetta));
      if (aperto) aperto.surplus.push(r);
      else sommandiE.push(r);
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
    // E se nell'importo c'e' un sovracosto - costi imprevisti che si pagano al
    // raccoglitore o all'impianto, fuori dalla moltiplicazione - la formula se lo
    // porta dietro come addendo: cosi' il conto si legge per intero, e correggere
    // il prezzo rifa' il totale senza perdere quei soldi.
    //
    // IL PRODOTTO SI ARROTONDA AL CENTESIMO NELLA FORMULA (chiusura dell'audit,
    // 11/10/2026): il foglio, e quindi il PDF, arrotonda ogni voce, mentre una
    // formula nuda teneva i millesimi e la somma del fornitore, al primo
    // ricalcolo, poteva uscire di un centesimo diversa dal PDF (due voci da
    // 1,003 t a 68 €/t: 68,20 + 68,20 nel PDF, 136,41 nell'Excel).
    const oltre = n2(riga.oltre_tariffa);
    const coda = oltre > 0 ? `+${oltre}` : '';
    scrivi(ws, r, col.totale, prezzoNoto ? {
      formula: aViaggio
        ? `ROUND(${lettera(colPrezzo)}${r}*${viaggi},2)${coda}`
        : `ROUND(${lettera(col.tonn)}${r}*${lettera(colPrezzo)}${r},2)${coda}`,
      result: n2(riga.totale),
    } : n2(riga.totale), { ...st, allinea: 'right', fmt: EURO });
    scrivi(ws, r, col.note, [
      aViaggio ? `prezzo a viaggio, ${viaggi} ${viaggi === 1 ? 'viaggio' : 'viaggi'}` : '',
      testo(riga.note),
    ].filter(Boolean).join(' — '), { ...st, corsivo: true, colore: TENUE });
    if (aperto) aperto.voci.push(r);
    else { sommandiT.push(r); sommandiE.push(r); }
    zebrata = !zebrata;
    r++;
  }
  chiudiFornitore();

  const st = { grassetto: true, sfondo: CHIARO, bordo: CHIUDE };
  stendi(ws, r, 1, ultima, st);
  scrivi(ws, r, col.nome, 'Totale complessivo', st);
  const t = somma(col.tonn, sommandiT);
  const e = somma(col.totale, sommandiE);
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
  return { prossima: r, cellaTotale, celleSurplus };
}

/**
 * LA FORMULA DEL TOTALE DI UNA RIGA DEL TRASPORTO, nella riga `r` del foglio
 * (D peso, F costo, G viaggi pagati). A tonnellata e' peso per costo, a viaggio
 * costo per viaggi, arrotondati al centesimo come la passiva. A viaggio G sono
 * i viaggi PAGATI, importo diviso prezzo (viaggiPagatiTrasporto,
 * 11/10/2026): cosi' anche la riga ACI di un viaggio misto, che la passiva paga
 * per differenza, al mezzo centesimo torna al centesimo quando Excel ricalcola.
 */
export function formulaTotaleTrasporto(t, r) {
  return t && t.unita_misura === 'euro_viaggio' ? `ROUND(F${r}*G${r},2)` : `ROUND(D${r}*F${r},2)`;
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

  // Le tonnellate sommano i viaggi, gli euro anche le righe del surplus
  // (13/10/2026): le tonnellate del surplus sono quelle dei viaggi sopra.
  const sommandi = [];
  const sommandiE = [];
  const celleSurplus = [];
  let zebrata = false;
  for (const t of righe) {
    if (!t) continue;
    if (eSurplus(t)) {
      celleSurplus.push(scriviRigaSurplus(ws, r, { ...t, soggetto: t.trasportatore }, { nome: 1, soggetto: 2, tonn: 4, prezzo: 6, totale: 8, note: 9 }, ultima,
        [testo(t.nome), testo(t.origine)].filter(Boolean).join(' · ')));
      scrivi(ws, r, 5, '€\\t', { bordo: GRIGLIA, sfondo: SURPLUS_CHIARO, allinea: 'center' });
      sommandiE.push(r);
      r++;
      continue;
    }
    const aViaggio = t.unita_misura === 'euro_viaggio';
    const st = { bordo: GRIGLIA, ...(zebrata ? { sfondo: ZEBRA } : {}) };
    stendi(ws, r, 1, ultima, st);
    scrivi(ws, r, 1, testo(t.produttore), st);
    scrivi(ws, r, 2, testo(t.trasportatore), st);
    scrivi(ws, r, 3, testo(t.destinatario), st);
    scrivi(ws, r, 4, num(t.tonnellate), { ...st, allinea: 'right', fmt: fmtT(t.tonnellate) });
    scrivi(ws, r, 5, aViaggio ? '€\\vg' : '€\\t', { ...st, allinea: 'center' });
    scrivi(ws, r, 6, num(t.prezzo), { ...st, allinea: 'right', fmt: EURO });
    // I VIAGGI CHE SI PAGANO, NON QUELLI CONTATI. Un viaggio misto porta
    // formulari di tutti e due i canali e ognuno ne paga la sua quota di chili:
    // due viaggi interi piu' un misto al 60% sono tre viaggi contati e 2,6
    // pagati. Qui c'era il numero contato, moltiplicato per il prezzo: lo stesso
    // camion si pagava intero di qua e intero di la' (audit del 03/10/2026).
    // La nota della riga, che viene dalla passiva, dice gia' com'e' fatto il
    // conto («2 viaggi interi a 300 € e 1 viaggio misto... 2,6 viaggi»).
    //
    // LA QUOTA SI SCRIVE INTERA, NON ARROTONDATA (chiusura dell'audit,
    // 11/10/2026): il formato la mostra con due decimali, ma la cella tiene il
    // numero vero. Prima la cella teneva 1,77 e la formula faceva 400 x 1,77 =
    // 708,00, dove la passiva paga 707,69 (un viaggio di sola rete e uno misto
    // con 10.000 kg di rete e 3.000 di ACI): appena Excel ricalcolava, PDF ed
    // Excel dello stesso foglio dicevano due numeri. E sono i viaggi PAGATI,
    // importo diviso prezzo (viaggiPagatiTrasporto), non la quota dei chili: sulla
    // riga ACI di un viaggio misto, al mezzo centesimo, la quota faceva 328,13
    // dove la passiva paga 328,12.
    const vgPagati = t.viaggi_pagati === undefined || t.viaggi_pagati === null ? num(t.viaggi) : num(t.viaggi_pagati);
    const vgInteri = Math.abs(vgPagati - Math.round(vgPagati)) < 1e-9;
    scrivi(ws, r, 7, vgPagati || null, { ...st, allinea: 'center', fmt: vgInteri ? INTERO : FORMATI.decimale2 });
    // A tonnellata e' peso per costo, a viaggio e' costo per numero di viaggi:
    // la formula segue l'unita' di misura scritta sulla riga accanto, e
    // arrotonda al centesimo come la passiva (=ROUND(F*G;2)).
    //
    // Su un trasporto interno no: li' il totale e' zero perche' non si fattura, e
    // una formula prezzo per viaggi col risultato zero in memoria lo rimetterebbe
    // a prezzo pieno al primo ricalcolo. Si scrive lo zero, e la nota della riga
    // dice perche'.
    scrivi(ws, r, 8, t.interno
      ? 0
      : { formula: formulaTotaleTrasporto(t, r), result: n2(t.totale) },
    { ...st, allinea: 'right', fmt: EURO });
    scrivi(ws, r, 9, testo(t.note), { ...st, corsivo: true, colore: TENUE });
    sommandi.push(r);
    sommandiE.push(r);
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
  const e = somma(8, sommandiE.sort((a, b) => a - b));
  scrivi(ws, r, 4, t ? { formula: t, result: num(trasporti.totale_t) } : num(trasporti.totale_t),
    { ...st, allinea: 'right', fmt: fmtT(trasporti.totale_t) });
  scrivi(ws, r, 8, e ? { formula: e, result: n2(trasporti.totale_euro) } : n2(trasporti.totale_euro),
    { ...st, allinea: 'right', fmt: EURO });
  return { prossima: r + 1, cellaTotale: `H${r}`, celleSurplus };
}

// L'EXTRA RACCOLTA: il dettaglio degli interventi chiusi nel mese.
//
// Qui non c'e' un modello di voci e non ci deve essere: ogni intervento fa storia
// a se', coi suoi prezzi scritti sull'intervento prima di passarlo a terminato
// (richiesta dell'utente, 03/10/2026: «le info vanno riprese dal modulo extra
// raccolta, compresi i prezzi»). Le colonne sono quelle del foglio
// dell'amministrazione, con l'ordine Ecotyre in piu' perche' li' manca e serve a
// ritrovare l'intervento.
const COLONNE_EXTRA = [
  { chiave: 'numero_fir', titolo: 'Nr. FIR' },
  { chiave: 'ordine', titolo: 'ORDINE ECOTYRE' },
  { chiave: 'produttore', titolo: 'PRODUTTORE' },
  { chiave: 'trasportatore', titolo: 'TRASPORTATORE' },
  { chiave: 'destinatario', titolo: 'DESTINATARIO' },
  { chiave: 'inizio', titolo: 'DATA I.T.', centro: true },
  { chiave: 'fine', titolo: 'DATA F.T.', centro: true },
  { chiave: 'cer', titolo: 'CER', centro: true },
  { chiave: 'kg', titolo: "QUANTITA' (kg)", numero: INTERO },
  { chiave: 'tonnellate', titolo: 'PESO [t]', numero: 'T' },
  { chiave: 'raccolta_t', titolo: 'RACCOLTA [€\\t]', numero: EURO },
  { chiave: 'stoccaggio_t', titolo: 'STOCCAGGIO [€\\t]', numero: EURO },
  { chiave: 'trattamento_t', titolo: 'TRATTAMENTO [€\\t]', numero: EURO },
  // Il trasporto si paga a VIAGGIO: nel loro foglio e' la colonna «PREZZO
  // (Euro/viaggio)» e sta accanto ai prezzi a tonnellata, ma non si moltiplica
  // per il peso - entra nel totale com'e'.
  { chiave: 'trasporto_viaggio', titolo: 'TRASPORTO [€\\viaggio]', numero: EURO },
  // Nel loro foglio questa colonna si chiama SOVRACOSTO: si tiene il loro nome,
  // perche' e' il foglio che riconoscono. Dentro ci sono la pulizia e i costi
  // aggiuntivi dell'intervento, cioe' gli oneri che si PAGANO; i tre
  // «sovracosto» della scheda (raccolta, trasporto, trattamento) sono un'altra
  // cosa: si aggiungono a quello che si fattura a Ecotyre e stanno nel ricavo.
  { chiave: 'oneri', titolo: 'SOVRACOSTO [€]', numero: EURO },
  { chiave: 'totale', titolo: 'TOTALE (Euro)', numero: EURO },
  { chiave: 'note', titolo: 'Note' },
];
const LARGO_EXTRA = COLONNE_EXTRA.length;
/** La colonna (da 1) di una chiave della tabella dell'extra raccolta. */
const COLONNA_EXTRA_INDICE = (chiave) => COLONNE_EXTRA.findIndex(c => c.chiave === chiave) + 1;
/** La data come si legge: 10/09/2026. Testo, non data, per non rimettere in ballo i fusi. */
const giornoIt = (v) => (/^\d{4}-\d{2}-\d{2}/.test(String(v || '')) ? String(v).slice(0, 10).split('-').reverse().join('/') : testo(v));

/**
 * LA FORMULA DEL TOTALE DI UN INTERVENTO DI EXTRA RACCOLTA, nella riga `r`, con
 * le lettere delle colonne (t, raccolta, stoccaggio, trattamento, viaggio, oneri).
 *
 * Ogni costo a tonnellata si arrotonda al centesimo per conto suo, poi si somma
 * (chiusura dell'audit, 11/10/2026): e' la grana della passiva, che paga la
 * raccolta al raccoglitore e il trattamento all'impianto, ciascuno al centesimo,
 * e della pagina dell'extra raccolta. La formula di prima moltiplicava la somma
 * dei prezzi per il peso senza arrotondare: 2,631 t a 90 + 95 €/t facevano
 * 486,735, e il totale del blocco ricalcolato da Excel non era piu' quello della
 * passiva (236,79 + 249,95 = 486,74).
 */
export function formulaTotaleExtra(r, c) {
  const perPeso = (col) => `ROUND(${col}${r}*${c.t}${r},2)`;
  return `${perPeso(c.raccolta)}+${perPeso(c.stoccaggio)}+${perPeso(c.trattamento)}+${c.viaggio}${r}+${c.oneri}${r}`;
}

function scriviExtra(ws, r0, extra0) {
  const extra = extra0 && typeof extra0 === 'object' ? extra0 : {};
  const righe = elenco(extra.righe);
  let r = r0;
  const sp = { grassetto: true, sfondo: CHIARO, colore: SCURO, bordo: { top: { style: 'medium', color: { argb: MEDIO } } } };
  stendi(ws, r, 1, LARGO_EXTRA, sp);
  scrivi(ws, r, 1, 'EXTRA RACCOLTA — interventi chiusi nel mese', sp);
  ws.mergeCells(r, 1, r, LARGO_EXTRA);
  r++;

  const testa = { sfondo: MEDIO, colore: BIANCO, grassetto: true, bordo: GRIGLIA, capo: true };
  stendi(ws, r, 1, LARGO_EXTRA, testa);
  COLONNE_EXTRA.forEach((c, i) => scrivi(ws, r, i + 1, c.titolo, { ...testa, allinea: c.numero ? 'right' : (c.centro ? 'center' : 'left') }));
  ws.getRow(r).height = 30;
  r++;

  const sommandi = [];
  let zebrata = false;
  const iT = COLONNE_EXTRA.findIndex(c => c.chiave === 'tonnellate') + 1;
  const iRac = COLONNE_EXTRA.findIndex(c => c.chiave === 'raccolta_t') + 1;
  const iSto = COLONNE_EXTRA.findIndex(c => c.chiave === 'stoccaggio_t') + 1;
  const iTra = COLONNE_EXTRA.findIndex(c => c.chiave === 'trattamento_t') + 1;
  const iVg = COLONNE_EXTRA.findIndex(c => c.chiave === 'trasporto_viaggio') + 1;
  const iOn = COLONNE_EXTRA.findIndex(c => c.chiave === 'oneri') + 1;
  const iKg = COLONNE_EXTRA.findIndex(c => c.chiave === 'kg') + 1;
  const iTot = COLONNE_EXTRA.findIndex(c => c.chiave === 'totale') + 1;
  for (const x of righe) {
    if (!x) continue;
    const st = { bordo: GRIGLIA, ...(zebrata ? { sfondo: ZEBRA } : {}) };
    stendi(ws, r, 1, LARGO_EXTRA, st);
    COLONNE_EXTRA.forEach((c, i) => {
      if (c.chiave === 'totale') return;
      const v = x[c.chiave];
      const stile = { ...st, allinea: c.numero ? 'right' : (c.centro ? 'center' : 'left') };
      // UN PESO CHE MANCA NON E' ZERO (chiusura dell'audit, 11/10/2026): un
      // terminato senza peso effettivo ha i chili a null, e num(null) li scriveva
      // 0. Si scrive «—», come nella pagina. La cella delle tonnellate resta
      // vuota e non «—», perche' la formula del totale la moltiplica: vuota vale
      // zero, e i costi a tonnellata valgono zero finche' il peso non si scrive,
      // come in passiva.
      if (c.chiave === 'kg' && (v === null || v === undefined)) scrivi(ws, r, i + 1, '—', { ...stile, allinea: 'right' });
      else if (c.numero === 'T' && x.senza_peso) scrivi(ws, r, i + 1, null, stile);
      else if (c.chiave === 'note') scrivi(ws, r, i + 1, testo(v), { ...stile, corsivo: true, colore: TENUE });
      else if (c.numero === 'T') scrivi(ws, r, i + 1, num(v), { ...stile, fmt: fmtT(v) });
      else if (c.numero) scrivi(ws, r, i + 1, num(v), { ...stile, fmt: c.numero });
      else if (c.centro) scrivi(ws, r, i + 1, giornoIt(v), stile);
      else scrivi(ws, r, i + 1, testo(v), stile);
    });
    // Il totale com'e' nel loro foglio: i tre costi a tonnellata per il peso,
    // piu' il trasporto a viaggio e gli oneri fissi, che sono importi e non
    // prezzi. Scritto come formula, cosi' correggere un prezzo rifa' il conto; il
    // numero che porta dentro e' quello del modulo Extra Raccolta.
    scrivi(ws, r, iTot, {
      formula: formulaTotaleExtra(r, { t: lettera(iT), raccolta: lettera(iRac), stoccaggio: lettera(iSto), trattamento: lettera(iTra), viaggio: lettera(iVg), oneri: lettera(iOn) }),
      result: n2(x.totale),
    }, { ...st, allinea: 'right', fmt: EURO, grassetto: true });
    sommandi.push(r);
    zebrata = !zebrata;
    r++;
  }
  if (!sommandi.length) {
    const st = { corsivo: true, colore: TENUE, bordo: GRIGLIA };
    stendi(ws, r, 1, LARGO_EXTRA, st);
    scrivi(ws, r, 1, 'Nessun intervento di extra raccolta chiuso in questo mese.', st);
    r++;
  }
  // IL SURPLUS SULLE TARIFFE in fondo agli interventi (13/10/2026): una riga per
  // fornitore e per surplus, col centesimo del mese, contato dal modulo Extra
  // Raccolta come lo conta la passiva (extraConSurplus). Il fornitore
  // sta nella colonna del suo ruolo - il raccoglitore fra i trasportatori,
  // l'impianto fra i destinatari - e il prezzo in quella della prestazione. Le
  // tonnellate sono quelle degli interventi sopra: si leggono, non si sommano.
  const sommandiE = [...sommandi];
  const COLONNA_PREZZO_EXTRA = { RACCOLTA: iRac, CONFERIMENTO_STOCCAGGIO: iSto, TRATTAMENTO: iTra };
  const iTras = COLONNA_EXTRA_INDICE('trasportatore');
  const iDest = COLONNA_EXTRA_INDICE('destinatario');
  const celleSurplus = [];
  for (const s of elenco(extra.surplus).filter(eSurplus)) {
    const ruolo = ['TRATTAMENTO', 'CONFERIMENTO_STOCCAGGIO'].includes(s.prestazione) ? iDest : iTras;
    celleSurplus.push(scriviRigaSurplus(ws, r, s, {
      nome: COLONNA_EXTRA_INDICE('produttore'), soggetto: ruolo, tonn: iT,
      prezzo: COLONNA_PREZZO_EXTRA[s.prestazione] || 0, totale: iTot, note: LARGO_EXTRA,
    }, LARGO_EXTRA, [testo(s.nome), testo(s.origine)].filter(Boolean).join(' · ')));
    sommandiE.push(r);
    r++;
  }

  const stT = { grassetto: true, sfondo: CHIARO, bordo: CHIUDE };
  stendi(ws, r, 1, LARGO_EXTRA, stT);
  scrivi(ws, r, 1, 'Totale extra raccolta', stT);
  const sKg = somma(iKg, sommandi);
  const sT = somma(iT, sommandi);
  const sE = somma(iTot, sommandiE);
  scrivi(ws, r, iKg, sKg ? { formula: sKg, result: Math.round(num(extra.totale_kg)) } : Math.round(num(extra.totale_kg)), { ...stT, allinea: 'right', fmt: INTERO });
  scrivi(ws, r, iT, sT ? { formula: sT, result: num(extra.totale_t) } : num(extra.totale_t), { ...stT, allinea: 'right', fmt: fmtT(extra.totale_t) });
  scrivi(ws, r, iTot, sE ? { formula: sE, result: n2(extra.totale_euro) } : n2(extra.totale_euro), { ...stT, allinea: 'right', fmt: EURO });
  const cellaTotale = `${lettera(iTot)}${r}`;
  r++;

  // Quello che va sistemato prima di fatturare: un intervento chiuso senza
  // nessun costo scritto non si paga, e quasi sempre e' una dimenticanza; un
  // terminato senza fine trasporto non sta in nessun mese.
  const avvisa = (titolo, elenco2, come) => {
    if (!elenco2.length) return;
    r++;
    const sa = { grassetto: true, colore: 'FFD97806', sfondo: 'FFFEF3C7', bordo: GRIGLIA };
    stendi(ws, r, 1, LARGO_EXTRA, sa);
    scrivi(ws, r, 1, titolo, sa);
    ws.mergeCells(r, 1, r, LARGO_EXTRA);
    r++;
    for (const x of elenco2) {
      const st = { bordo: GRIGLIA, colore: 'FF92400E' };
      stendi(ws, r, 1, LARGO_EXTRA, st);
      scrivi(ws, r, 1, come(x), st);
      ws.mergeCells(r, 1, r, LARGO_EXTRA);
      r++;
    }
  };
  avvisa('DA SISTEMARE: interventi chiusi senza nessun costo scritto. La passiva non paga niente: scrivi i costi sull\'intervento.',
    elenco(extra.senza_costi), (x) => `${x.numero_fir} · ${x.produttore} → ${x.destinatario} · ${kgTesto(x.kg)}`);
  // I terminati del mese senza peso effettivo (chiusura dell'audit, 11/10/2026):
  // stanno nel blocco senza chili, e qui si dicono con la frase che dicono anche
  // la fattura, la passiva e la pagina.
  avvisa('DA SISTEMARE: interventi terminati senza peso effettivo. Non entrano nella fattura a Ecotyre e i costi a tonnellata valgono zero: scrivi il peso sull\'intervento.',
    elenco(extra.senza_peso), (x) => `${x.numero_fir} · ordine ${x.ordine} · ${x.produttore} · ${testo(x.avviso)}`);
  avvisa('DA SISTEMARE: interventi terminati senza data di fine trasporto. Non stanno in nessun mese e non si fatturano.',
    elenco(extra.senza_data), (x) => `${x.numero_fir} · ordine ${x.ordine} · ${x.produttore} · ${kgTesto(x.kg)}`);

  return { prossima: r + 1, cellaTotale, celleSurplus };
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

  // L'EXTRA RACCOLTA ha un blocco solo, il dettaglio degli interventi: non ha
  // voci fisse ne' trasporto delle secondarie, e scriverne le cornici vuote
  // vorrebbe dire far cercare numeri dove non ce ne sono.
  if (f.extra) {
    const ex = scriviExtra(ws, r0 + 2, f.extra);
    scrivi(ws, r0, 5, { formula: ex.cellaTotale, result: n2(f.totale_euro) }, { ...st, allinea: 'right', fmt: EURO });
    diCuiSurplus(ws, r0, ex.celleSurplus, f, st);
    return ex.prossima;
  }

  let r = r0 + 2;
  const racc = scriviBlocco(ws, r, f.raccoglitori, { titolo: 'RACCOGLITORI', etichetta: 'Costo di Raccolta [€\\t]', stile });
  r = racc.prossima + 1;
  const imp = scriviBlocco(ws, r, f.impianti, { titolo: 'IMPIANTI \\ STOCCAGGI', etichetta: 'Costo [€\\t]', stile });
  r = imp.prossima + 1;
  const tra = scriviTrasporto(ws, r, f.trasporti, nome);

  scrivi(ws, r0, 5, { formula: `${racc.cellaTotale}+${imp.cellaTotale}+${tra.cellaTotale}`, result: n2(f.totale_euro) },
    { ...st, allinea: 'right', fmt: EURO });
  diCuiSurplus(ws, r0, [...racc.celleSurplus, ...imp.celleSurplus, ...tra.celleSurplus], f, st);
  return tra.prossima;
}

/**
 * IL «DI CUI» DEL SURPLUS NELLA FASCIA DEL CANALE (13/10/2026): accanto al
 * totale, quanto ne e' surplus, come somma delle righe del surplus (una formula,
 * come il totale: se l'amministrazione corregge un prezzo si rifa'). Il nome e'
 * quello del surplus quando nel mese ce n'e' uno solo.
 */
function diCuiSurplus(ws, r0, celle, f, st) {
  if (!celle.length) return;
  const nomi = [...new Set(elenco(f.surplus).map(s => testo(s && s.nome)).filter(Boolean))];
  scrivi(ws, r0, 6, `di cui ${nomi.length === 1 ? nomi[0] : 'surplus'}`, { ...st, corpo: 9, grassetto: false, allinea: 'right', capo: true });
  scrivi(ws, r0, 7, { formula: celle.length === 1 ? celle[0] : `SUM(${celle.join(',')})`, result: n2(f.totale_surplus) },
    { ...st, corpo: 11, allinea: 'right', fmt: EURO });
}

/** Il titolo in cima al foglio: chi manda il documento e di che mese parla. */
function titoloFoglio(ws, periodo, largo) {
  const quante = largo || LARGHEZZA;
  const st = { grassetto: true, corpo: 14, colore: SCURO };
  stendi(ws, 1, 1, quante, st);
  scrivi(ws, 1, 1, `SMOCO S.r.l. · Commessa Ecotyre · Fatturazione passiva${periodo ? ` — ${periodo}` : ''}`, st);
  ws.getRow(1).height = 22;
  ws.mergeCells(1, 1, 1, quante);
}

/**
 * La nota in fondo. Le due cose che chi riceve il foglio deve sapere: che le
 * voci a zero ci sono di proposito, e che i totali sono formule - cosi' nessuno
 * ricalcola a mano una colonna che si rifa' da se'.
 */
function notaFinale(ws, r, fogli) {
  const quali = elenco(fogli);
  // Il foglio della sola extra raccolta non ha voci a modello: la nota che parla
  // di righe a zero li' non vuol dire niente, e una spiegazione che non c'entra
  // fa dubitare anche di quelle giuste.
  const soloExtra = quali.length > 0 && quali.every(f => f && f.extra);
  const largo = soloExtra ? LARGHEZZE_EXTRA.length : LARGHEZZA;
  const st = { corsivo: true, colore: TENUE, capo: true };
  stendi(ws, r, 1, largo, st);
  // Il surplus si spiega solo dove c'e' (13/10/2026): una frase su un foglio che
  // non lo porta farebbe cercare righe che non ci sono.
  const surplus = conSurplus(quali)
    ? ' Le righe con la barra indaco sono il surplus sulle tariffe (per esempio il Fuel Surcharge): stanno sotto il fornitore, sulle stesse tonnellate del mese, scritte fra parentesi e fuori dalle somme delle tonnellate; il loro importo e\' nel totale del fornitore e del canale.'
    : '';
  if (soloExtra) {
    scrivi(ws, r, 1, `L'extra raccolta non ha voci a modello: ogni intervento fa storia a se', coi suoi prezzi di raccolta, stoccaggio e trattamento scritti sull'intervento, piu' il sovracosto, che si paga al raccoglitore o all'impianto e la nota dice a chi (la pulizia e i costi aggiuntivi degli interventi di prima non hanno un padrone e non si fatturano a nessuno). Entra nel mese in cui e' stata chiusa la fine trasporto. I totali sono formule: correggi un prezzo e si rifanno da soli. Tonnellate con due decimali (tre quando i chili non sono tondi), importi in euro, EER 160103 dei PFU. I canali non si sommano fra loro.${surplus}`, st);
    ws.mergeCells(r, 1, r, largo);
    ws.getRow(r).height = surplus ? 42 : 30;
    return;
  }
  scrivi(ws, r, 1, `Le voci del modello restano nel foglio anche a zero: il foglio e' lo stesso ogni mese e un conferimento comparso dove prima non ce n'erano si vede subito. I totali sono formule: correggi un prezzo e i totali si rifanno da soli. Tonnellate con due decimali (tre quando i chili non sono tondi), importi in euro, EER 160103 dei PFU. I canali non si sommano fra loro.${surplus}`, st);
  ws.mergeCells(r, 1, r, LARGHEZZA);
  ws.getRow(r).height = surplus ? 42 : 30;
}

/** Vero se almeno un canale ha una riga del surplus, in un blocco qualunque. */
function conSurplus(fogli) {
  return elenco(fogli).some(f => f && [
    ...elenco(f.raccoglitori && f.raccoglitori.righe),
    ...elenco(f.impianti && f.impianti.righe),
    ...elenco(f.trasporti && f.trasporti.righe),
    ...elenco(f.extra && f.extra.surplus),
  ].some(eSurplus));
}

/**
 * Larghezze, stampa e piede di pagina. Questo foglio finisce allegato a una
 * mail oppure stampato dentro una pratica: orizzontale e stretto in larghezza
 * su una pagina, col numero di pagina in fondo, perche' un allegato di tre
 * fogli senza numeri non si rimette in ordine.
 */
function impagina(ws, larghezze) {
  ws.columns = (larghezze || LARGHEZZE).map(width => ({ width }));
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
  notaFinale(ws, r, quali);
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
    impagina(ws, f.extra ? LARGHEZZE_EXTRA : null);
    titoloFoglio(ws, periodo, f.extra ? LARGHEZZE_EXTRA.length : LARGHEZZA);
    notaFinale(ws, scriviCanale(ws, 3, f) + 1, [f]);
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
