// Il blocco del mese per il foglio DICHIARAZIONI del file di gestione,
// pronto da incollare (22/09/2026).
//
// Il file di gestione sta sul computer dell'utente, e l'utente non e' sempre a
// quel computer: il gestionale deve servire anche da fuori. Qui il blocco del
// mese si costruisce dentro il gestionale, nella stessa forma che ha nel foglio
// (titolo, ferro EER 19.12.02 con il suo totale, CSS-C, extra raccolta a parte,
// terziarie EER 19.12.04 con i totali), e si scarica come file Excel: basta
// copiarlo e incollarlo in coda al foglio.
//
// Le formule sono tutte relative e stanno dentro il blocco (=I5+J5,
// =SUM(F6:F9)...): incollando a qualunque riga Excel le sposta da sola. Le due
// celle del riepilogo in alto, invece, vanno scritte a mano: il foglio
// "Come si incolla" dice quali sono e che cosa scriverci.
//
// Le stesse righe le scrive, quando il computer e' acceso, lo script
// strumenti/irigom/scrivi_blocco_mese.ps1, che in piu' copia i formati dai mesi
// gia' presenti.
//
// Anche qui il blocco esce vestito come i mesi gia' nel foglio (colori, bordi,
// caratteri, formati dei numeri e delle date, larghezza delle colonne): i valori
// sono gli stessi di prima, cambia solo l'aspetto, cosi' incollandolo in coda
// sembra uno dei mesi che ci sono gia' e non serve piu' ricopiare i formati dal
// mese precedente. Gli stili sono quelli letti nel file di gestione sul blocco
// di agosto 2026 (foglio DICHIARAZIONI, righe 270-330) e sul CSS-C di luglio.

const MESI_NOMI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const intero = (n) => Math.round(Number(n) || 0);
const mig = (v) => String(intero(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// Una data come Excel la tiene: giorni dal 30/12/1899. Le date del registro sono
// giorni italiani (AAAA-MM-GG): si contano i giorni, senza fusi orari.
export function serialeExcel(giorno) {
  const g = String(giorno || '').slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(g);
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Math.round(ms / 86400000) + 25569;
}

const cellaData = (giorno) => {
  const s = serialeExcel(giorno);
  return s === null ? null : { v: s, t: 'n', z: 'dd/mm/yyyy' };
};
const formula = (f, z) => ({ t: 'n', f, ...(z ? { z } : {}) });

/**
 * Le righe del blocco, come vanno nel foglio DICHIARAZIONI.
 * @param {object} dati  lo stesso oggetto di datiFileGestione (documentiIrigom.js)
 * @returns {{ righe: array, indice: object, tipi: string[] }} righe: matrice di celle
 *          (null = vuota); indice: dove stanno le righe che servono al riepilogo,
 *          1 = prima riga del blocco; tipi: che cos'e' ogni riga, per vestirla in Excel
 *          (una riga vuota ha tipo '').
 */
export function righeBlocco(dati) {
  const righe = [];
  const tipi = [];
  const vuota = () => { righe.push([]); tipi.push(''); };
  const metti = (r, tipo = '') => { righe.push(r); tipi.push(tipo); };
  const numero = () => righe.length; // la riga appena messa, 1-based
  const indice = {};

  metti([`${String(dati.mese || '').toUpperCase()} ${dati.anno || ''}`.trim()], 'titolo');
  vuota();
  metti(['Dichiarazione CER191202'], 'cer02');
  vuota();
  metti(['DATA', 'PRODUTTORE', 'TRASPORTATORE', 'DESTINATARIO', 'FORMULARIO', 'PESO [KG]', 'PESO IN USCITA [KG]'], 'testa_ferro');
  const primoFerro = numero() + 1;
  for (const f of dati.ferro || []) {
    metti([cellaData(f.data), 'IRIGOM', String(f.trasportatore || ''), String(f.destinatario || ''), String(f.formulario || ''), intero(f.peso_kg), intero(f.quota_kg)], 'ferro');
  }
  const ultimoFerro = Math.max(primoFerro, numero());
  if (numero() < primoFerro) vuota(); // nessun formulario: una riga per la somma
  metti([null, null, null, null, null, formula(`SUM(F${primoFerro}:F${ultimoFerro})`), formula(`SUM(G${primoFerro}:G${ultimoFerro})`)], 'tot_ferro');
  indice.totale_ferro = numero();
  vuota(); vuota(); vuota();

  // Il CSS-C c'e' solo se nel mese ne e' uscito: in un mese di soli metalli il
  // blocco non porta riquadri vuoti (regola dell'utente del 22/09/2026). La
  // percentuale di ferro va in K, dove la mettono i mesi gia' nel foglio.
  if ((dati.cssc || []).length) {
    metti(['DDT', 'PESO', 'PESO USCITA', 'UNITà DI MISURA', 'DATA TRASPORTO', 'DATA CONFERIMENTO', '% CSS-C', '%FERRO', 'TOTALE (PFU)', 'TRATTAMENTO'], 'testa_cssc');
    const primoCssc = numero() + 1;
    for (const c of dati.cssc) {
      const r = numero() + 1;
      const g = cellaData(c.data);
      metti([`DDT ${String(c.ddt || '').replace(/^DDT\s*/i, '')}${c.parte ? ` (parte ${c.parte})` : ''}`, intero(c.cssc_kg), intero(c.cssc_kg), 'KG', g, g,
        intero(c.cssc_kg), intero(c.ferro_kg), formula(`SUM(G${r}:H${r})`), 'DA PFU', formula(`H${r}/I${r}`, '0.00%')], 'cssc');
    }
    const ultimoCssc = numero();
    metti([null, null, null, null, null, null, formula(`SUM(G${primoCssc}:G${ultimoCssc})`), formula(`SUM(H${primoCssc}:H${ultimoCssc})`), formula(`SUM(I${primoCssc}:I${ultimoCssc})`)], 'tot_cssc');
    indice.totale_cssc = numero();
    vuota();
  }

  const e = dati.extra;
  if (e && intero(e.totale_kg) > 0) {
    metti([`per il mese di ${String(dati.mese || '').toLowerCase()} dichiarare extraraccolta ${intero(e.totale_kg)} kg (pfu) = ${intero(e.cippato_kg)} Kg (cipp) + ${intero(e.ferro_kg)} Kg (fe)`], 'nota_extra');
    const chiusura = e.terziaria
      ? ` - nella terziaria ${e.terziaria}${e.chiusura_terziaria_kg ? `, che si chiude a portale a ${intero(e.chiusura_terziaria_kg)} kg` : ''}`
      : '';
    metti([`EXTRA RACCOLTA DA DICHIARARE!!!${chiusura}`], 'avviso_extra');
    vuota();
    metti(['DDT', 'PESO', 'PESO USCITA', 'UNITà DI MISURA', 'DATA TRASPORTO', 'DATA CONFERIMENTO', '% CSS-C', '%FERRO', 'TOTALE (PFU)', 'TRATTAMENTO'], 'testa_cssc');
    const r = numero() + 1;
    metti([String(e.terziaria || ''), intero(e.cippato_kg), intero(e.cippato_kg), 'KG', null, null, intero(e.cippato_kg), intero(e.ferro_kg), formula(`G${r}+H${r}`), 'DA PFU EXTRA RACCOLTA'], 'extra');
    indice.extra = numero();
    vuota(); vuota(); vuota(); vuota(); vuota();
  } else {
    vuota(); vuota(); vuota();
  }

  if ((dati.terziarie || []).length) {
    metti(['Dichiarazione CER191204'], 'cer04');
    vuota(); vuota();
    metti(['ORDINE TERZIARIA', 'PRODUTTORE', 'TRASPORTATORE', 'DESTINATARIO', 'Nr. ALLEGATO VII', 'PESO [Kg]', 'DATA TRASPORTO', 'DATA CONFERIMENTO', 'CIPP / CIAB', 'EER 19.12.02', 'TOTALE'], 'testa_ter');
    const primaTer = numero() + 1;
    for (const t of dati.terziarie) {
      const r = numero() + 1;
      const g = cellaData(dati.partenza || t.data);
      metti([String(t.terziaria || ''), 'IRIGOM', String(t.trasportatore || ''), String(t.destinatario || ''), intero(t.allegato), intero(t.peso_allegato_kg), g, g,
        intero(t.cippato_kg), intero(t.ferro_kg), formula(`I${r}+J${r}`), formula(`38000-K${r}`), formula(`J${r}/K${r}`, '0.00%')], 'ter');
    }
    const ultimaTer = numero();
    metti([null, null, null, null, null, formula(`SUM(F${primaTer}:F${ultimaTer})`), null, null,
      formula(`SUM(I${primaTer}:I${ultimaTer})`), formula(`SUM(J${primaTer}:J${ultimaTer})`), formula(`SUM(K${primaTer}:K${ultimaTer})`)], 'tot_ter');
    indice.totale_terziarie = numero();
  }
  return { righe, indice, tipi };
}

/** Le istruzioni, riga per riga: che cosa incollare e che cosa scrivere in alto. */
export function istruzioni(dati, indice) {
  const mese = String(dati.mese || '');
  const colonna = 'la colonna del mese nel riepilogo in alto (quella con il nome del mese)';
  const righe = [
    [`Blocco di ${mese} ${dati.anno || ''} per il foglio DICHIARAZIONI del file di gestione`],
    [],
    ['1) Apri il file di gestione, foglio DICHIARAZIONI.'],
    ['2) Trova l\'ultima riga scritta in fondo al foglio (l\'ultimo blocco di un mese).'],
    ['3) Torna qui, nel foglio BLOCCO: seleziona tutto (Ctrl+A), copia (Ctrl+C).'],
    ['4) Nel file di gestione incolla in colonna A, quattro righe vuote sotto l\'ultima scritta.'],
    ['   Le formule del blocco si spostano da sole: dentro il blocco restano giuste.'],
    ['5) Incolla normalmente (Ctrl+V): colori, bordi e formati vengono con il blocco, gia\''],
    ['   come quelli dei mesi di prima. Non serve piu\' ricopiare le righe del mese precedente.'],
    [],
    ['6) Nel riepilogo in alto, nella colonna del mese, scrivi:'],
  ];
  // Un mese di soli metalli a portale non carica niente: il riepilogo in alto
  // non si tocca, e quel ferro se ne va con la dichiarazione del mese in cui
  // riparte la gomma (regola dell'utente del 22/09/2026).
  const parti = [];
  if (indice.totale_cssc) parti.push(`I<riga del blocco ${indice.totale_cssc}>`);
  if (indice.totale_terziarie) parti.push(`K<riga del blocco ${indice.totale_terziarie}>`);
  if (!parti.length) {
    righe.push(['   niente: in questo mese sono usciti solo metalli ferrosi e a portale non si carica nulla.']);
    righe.push([`   La colonna di ${mese.toLowerCase()} resta vuota: quel ferro si dichiara con il mese in cui riparte la gomma.`]);
  } else {
    righe.push([`   IRIGOM = ${parti.join(' + ')} (i numeri di riga sono quelli che vedi dopo aver incollato)`]);
    if (indice.extra) righe.push([`   EXTRA RACCOLTA = ${mig((dati.extra && dati.extra.totale_kg) || 0)}`]);
    righe.push(['   La colonna CARICATA/INVIATA ("SI") la metti quando carichi a portale.']);
  }
  righe.push([]);
  righe.push(parti.length
    ? [`7) Controllo: il blocco deve fare ${mig(totaleDaPortale(dati))} kg, il totale da caricare a portale${dati.extra && intero(dati.extra.totale_kg) ? ` (extra raccolta compresa: ${mig(dati.extra.totale_kg)} kg)` : ''}.`]
    : [`7) Controllo: il blocco porta solo la tabella del ferro, ${mig((dati.ferro || []).reduce((s, x) => s + intero(x.quota_kg), 0))} kg di quota nostra.`]);
  righe.push([`   ${colonna} e la riga IRIGOM devono restare quelle di sempre.`]);
  return righe;
}

/** Il totale che il blocco deve fare: quello che si carica a portale. */
export function totaleDaPortale(dati) {
  return intero(dati.totale_portale_kg);
}

// ---------------------------------------------------------------------------
// L'aspetto: quello dei mesi gia' nel foglio DICHIARAZIONI

const TITOLO_VERDE = 'FF00B050';   // la fascia col nome del mese
const ROSSO = 'FFFF0000';          // "Dichiarazione CER191202"
const AZZURRO = 'FF99CCFF';        // intestazione del ferro
const VERDE = 'FF92D050';          // intestazioni di CSS-C, extra e terziarie
const GIALLO = 'FFFFFF00';         // quote nostre, note dell'extra, CER191204
// le larghezze del foglio DICHIARAZIONI, colonne A-M
const LARGHEZZE = [45.3, 41, 23, 33.1, 23.9, 27.7, 23.9, 27.7, 18.1, 24.6, 28.1, 28.1, 14.9];

const carattere = (o) => ({ name: 'Calibri', family: 2, size: 11, ...o });
const CENTRO = { horizontal: 'center', vertical: 'middle' };
const CENTRO_A_CAPO = { ...CENTRO, wrapText: true };
const riempi = (c, argb) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }; };
const contorna = (c, stile = 'thin', lati = ['top', 'left', 'bottom', 'right']) => {
  const b = { ...(c.border || {}) };
  for (const l of lati) b[l] = { style: stile };
  c.border = b;
};

/** Una cella di righeBlocco dentro una cella di exceljs: formule come formule. */
function scriviCella(cella, valore) {
  if (valore === null || valore === undefined || valore === '') return;
  if (typeof valore === 'object') {
    // Senza result: la calcola Excel all'apertura, cosi' non si porta dietro
    // numeri vecchi se qualcuno sposta il blocco.
    if (valore.f) { cella.value = { formula: valore.f }; cella.numFmt = valore.z || '#,##0'; return; }
    cella.value = valore.v;
    if (valore.z) cella.numFmt = valore.z;
    return;
  }
  cella.value = valore;
  if (typeof valore === 'number') cella.numFmt = '#,##0';
}

/** Veste una riga come le righe dello stesso tipo gia' nel foglio. */
function vestiRiga(ws, riga, tipo) {
  const r = riga.number;
  const cella = (k) => riga.getCell(k);
  const tutte = (da, a, f) => { for (let k = da; k <= a; k++) f(cella(k), k); };
  switch (tipo) {
    case 'titolo': {
      riga.height = 31.5;
      tutte(1, 10, (c) => { riempi(c, TITOLO_VERDE); c.alignment = CENTRO; });
      cella(1).font = carattere({ bold: true, size: 24 });
      cella(1).numFmt = '@';
      break;
    }
    case 'cer02': {
      tutte(1, 2, (c) => { riempi(c, ROSSO); c.font = carattere({ bold: true, underline: true }); c.alignment = CENTRO; });
      ws.mergeCells(r, 1, r, 2);
      break;
    }
    case 'cer04': {
      riempi(cella(1), GIALLO);
      cella(1).font = carattere({ bold: true, underline: true });
      cella(1).alignment = CENTRO;
      break;
    }
    case 'testa_ferro': {
      riga.height = 16.5;
      tutte(1, 7, (c) => { riempi(c, AZZURRO); c.font = carattere({ bold: true, size: 12 }); c.alignment = CENTRO_A_CAPO; contorna(c, 'medium'); });
      break;
    }
    case 'ferro': {
      riga.height = 15.75;
      tutte(1, 7, (c) => { c.font = carattere(); c.alignment = CENTRO_A_CAPO; contorna(c); });
      contorna(cella(1), 'medium', ['left']);   // il riquadro del ferro e' a bordo spesso
      contorna(cella(7), 'medium', ['right']);
      break;
    }
    case 'tot_ferro': {
      riga.height = 19.5;
      tutte(6, 7, (c) => { c.font = carattere({ bold: true, size: 14, color: { argb: ROSSO } }); c.alignment = CENTRO; contorna(c, 'medium', ['left', 'bottom']); });
      contorna(cella(7), 'medium', ['right']);
      riempi(cella(7), GIALLO);                 // la quota nostra, evidenziata come sempre
      break;
    }
    case 'testa_cssc': {
      tutte(1, 10, (c) => { riempi(c, VERDE); c.font = carattere({ bold: true }); c.alignment = CENTRO; contorna(c); });
      break;
    }
    case 'cssc':
    case 'extra': {
      riga.height = 15.75;
      tutte(1, 10, (c) => { c.font = carattere(); c.alignment = CENTRO; contorna(c); });
      // la percentuale di ferro sta fuori dal riquadro, e l'extra raccolta non ce l'ha
      if (cella(12).value !== null && cella(12).value !== undefined) { cella(12).font = carattere(); cella(12).alignment = CENTRO; }
      break;
    }
    case 'tot_cssc': {
      tutte(7, 9, (c) => { c.font = carattere({ bold: true, color: { argb: ROSSO } }); c.alignment = CENTRO; });
      break;
    }
    case 'nota_extra': {
      riga.height = 19.5;
      tutte(1, 3, (c) => { riempi(c, GIALLO); c.font = carattere({ bold: true, size: 14 }); c.alignment = CENTRO; contorna(c, 'medium'); });
      ws.mergeCells(r, 1, r, 3);
      break;
    }
    case 'avviso_extra': {
      const c = cella(1);
      riempi(c, GIALLO);
      c.font = carattere({ bold: true, color: { argb: ROSSO } });
      c.alignment = CENTRO;
      contorna(c, 'medium', ['left', 'right', 'bottom']);
      break;
    }
    case 'testa_ter': {
      tutte(1, 11, (c) => { riempi(c, VERDE); c.font = carattere({ bold: true }); c.alignment = CENTRO; contorna(c); });
      riempi(cella(12), VERDE);                 // la fascia verde arriva fino alla L, come nel foglio
      contorna(cella(12));
      break;
    }
    case 'ter': {
      tutte(1, 11, (c) => { c.font = carattere(); c.alignment = CENTRO; contorna(c); });
      riempi(cella(9), GIALLO);                 // il ciabattato, evidenziato
      tutte(12, 13, (c) => { c.font = carattere(); c.alignment = CENTRO; });
      break;
    }
    case 'tot_ter': {
      for (const k of [6, 9, 10, 11]) { cella(k).font = carattere(); cella(k).alignment = CENTRO; }
      break;
    }
    default: break;
  }
}

/**
 * Il file Excel col blocco pronto da incollare: foglio BLOCCO, vestito come i
 * mesi gia' nel foglio DICHIARAZIONI, e foglio "Come si incolla".
 * @returns {Promise<Uint8Array>}
 */
export async function excelBlocco(dati) {
  const modulo = await import('exceljs');
  const ExcelJS = modulo.default || modulo;
  const { righe, indice, tipi } = righeBlocco(dati);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Gestionale PFU';
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true; // le formule sono senza valore: le fa Excel

  // griglia e zoom come nel foglio DICHIARAZIONI, cosi' il blocco si vede come sara'
  const ws = wb.addWorksheet('BLOCCO', { views: [{ showGridLines: true, zoomScale: 80 }] });
  ws.columns = LARGHEZZE.map(width => ({ width }));
  righe.forEach((valori, i) => {
    const riga = ws.getRow(i + 1);
    (valori || []).forEach((valore, c) => scriviCella(riga.getCell(c + 1), valore));
    vestiRiga(ws, riga, tipi[i]);
  });

  const guida = wb.addWorksheet('Come si incolla', { views: [{ showGridLines: false }] });
  guida.columns = [{ width: 120 }];
  for (const r of istruzioni(dati, indice)) {
    const riga = guida.addRow(r);
    riga.getCell(1).alignment = { vertical: 'top', wrapText: true };
  }
  guida.getRow(1).font = { name: 'Calibri', size: 14, bold: true };

  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

export { MESI_NOMI };
