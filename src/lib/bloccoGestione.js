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
 * @returns {{ righe: array, indice: object }} righe: matrice di celle (null = vuota),
 *          indice: dove stanno le righe che servono al riepilogo, 1 = prima riga del blocco
 */
export function righeBlocco(dati) {
  const righe = [];
  const vuota = () => { righe.push([]); };
  const metti = (r) => { righe.push(r); };
  const numero = () => righe.length; // la riga appena messa, 1-based
  const indice = {};

  metti([`${String(dati.mese || '').toUpperCase()} ${dati.anno || ''}`.trim()]);
  vuota();
  metti(['Dichiarazione CER191202']);
  vuota();
  metti(['DATA', 'PRODUTTORE', 'TRASPORTATORE', 'DESTINATARIO', 'FORMULARIO', 'PESO [KG]', 'PESO IN USCITA [KG]']);
  const primoFerro = numero() + 1;
  for (const f of dati.ferro || []) {
    metti([cellaData(f.data), 'IRIGOM', String(f.trasportatore || ''), String(f.destinatario || ''), String(f.formulario || ''), intero(f.peso_kg), intero(f.quota_kg)]);
  }
  const ultimoFerro = Math.max(primoFerro, numero());
  if (numero() < primoFerro) vuota(); // nessun formulario: una riga per la somma
  metti([null, null, null, null, null, formula(`SUM(F${primoFerro}:F${ultimoFerro})`), formula(`SUM(G${primoFerro}:G${ultimoFerro})`)]);
  indice.totale_ferro = numero();
  vuota(); vuota(); vuota();

  metti(['DDT', 'PESO', 'PESO USCITA', 'UNITà DI MISURA', 'DATA TRASPORTO', 'DATA CONFERIMENTO', '% CSS-C', '%FERRO', 'TOTALE (PFU)', 'TRATTAMENTO']);
  const primoCssc = numero() + 1;
  for (const c of dati.cssc || []) {
    const r = numero() + 1;
    const g = cellaData(c.data);
    metti([`DDT ${String(c.ddt || '').replace(/^DDT\s*/i, '')}${c.parte ? ` (parte ${c.parte})` : ''}`, intero(c.cssc_kg), intero(c.cssc_kg), 'KG', g, g,
      intero(c.cssc_kg), intero(c.ferro_kg), formula(`SUM(G${r}:H${r})`), 'DA PFU', null, formula(`H${r}/I${r}`, '0.00%')]);
  }
  const ultimoCssc = Math.max(primoCssc, numero());
  if (numero() < primoCssc) vuota();
  metti([null, null, null, null, null, null, formula(`SUM(G${primoCssc}:G${ultimoCssc})`), formula(`SUM(H${primoCssc}:H${ultimoCssc})`), formula(`SUM(I${primoCssc}:I${ultimoCssc})`)]);
  indice.totale_cssc = numero();
  vuota();

  const e = dati.extra;
  if (e && intero(e.totale_kg) > 0) {
    metti([`per il mese di ${String(dati.mese || '').toLowerCase()} dichiarare extraraccolta ${intero(e.totale_kg)} kg (pfu) = ${intero(e.cippato_kg)} Kg (cipp) + ${intero(e.ferro_kg)} Kg (fe)`]);
    const chiusura = e.terziaria
      ? ` - nella terziaria ${e.terziaria}${e.chiusura_terziaria_kg ? `, che si chiude a portale a ${intero(e.chiusura_terziaria_kg)} kg` : ''}`
      : '';
    metti([`EXTRA RACCOLTA DA DICHIARARE!!!${chiusura}`]);
    vuota();
    metti(['DDT', 'PESO', 'PESO USCITA', 'UNITà DI MISURA', 'DATA TRASPORTO', 'DATA CONFERIMENTO', '% CSS-C', '%FERRO', 'TOTALE (PFU)', 'TRATTAMENTO']);
    const r = numero() + 1;
    metti([String(e.terziaria || ''), intero(e.cippato_kg), intero(e.cippato_kg), 'KG', null, null, intero(e.cippato_kg), intero(e.ferro_kg), formula(`G${r}+H${r}`), 'DA PFU EXTRA RACCOLTA']);
    indice.extra = numero();
    vuota(); vuota(); vuota(); vuota(); vuota();
  } else {
    vuota(); vuota(); vuota();
  }

  if ((dati.terziarie || []).length) {
    metti(['Dichiarazione CER191204']);
    vuota(); vuota();
    metti(['ORDINE TERZIARIA', 'PRODUTTORE', 'TRASPORTATORE', 'DESTINATARIO', 'Nr. ALLEGATO VII', 'PESO [Kg]', 'DATA TRASPORTO', 'DATA CONFERIMENTO', 'CIPP / CIAB', 'EER 19.12.02', 'TOTALE']);
    const primaTer = numero() + 1;
    for (const t of dati.terziarie) {
      const r = numero() + 1;
      const g = cellaData(dati.partenza || t.data);
      metti([String(t.terziaria || ''), 'IRIGOM', String(t.trasportatore || ''), String(t.destinatario || ''), intero(t.allegato), intero(t.peso_allegato_kg), g, g,
        intero(t.cippato_kg), intero(t.ferro_kg), formula(`I${r}+J${r}`), formula(`38000-K${r}`), formula(`J${r}/K${r}`, '0.00%')]);
    }
    const ultimaTer = numero();
    metti([null, null, null, null, null, formula(`SUM(F${primaTer}:F${ultimaTer})`), null, null,
      formula(`SUM(I${primaTer}:I${ultimaTer})`), formula(`SUM(J${primaTer}:J${ultimaTer})`), formula(`SUM(K${primaTer}:K${ultimaTer})`)]);
    indice.totale_terziarie = numero();
  }
  return { righe, indice };
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
    ['5) Per avere gli stessi colori: prima di incollare, copia le righe del blocco del mese'],
    ['   precedente e incollale li\', poi incolla sopra questo blocco con Incolla speciale > Valori.'],
    ['   Se salti questo passo cambiano solo i colori, non i numeri.'],
    [],
    ['6) Nel riepilogo in alto, nella colonna del mese, scrivi:'],
  ];
  const r = (n) => (n ? `riga del blocco ${n}` : '—');
  righe.push([`   IRIGOM = totale CSS-C + totale terziarie, cioe' = I<${r(indice.totale_cssc)}> + K<${r(indice.totale_terziarie)}> (i numeri di riga sono quelli che vedi dopo aver incollato)`]);
  if (indice.extra) righe.push([`   EXTRA RACCOLTA = ${mig((dati.extra && dati.extra.totale_kg) || 0)}`]);
  righe.push(['   La colonna CARICATA/INVIATA ("SI") la metti quando carichi a portale.']);
  righe.push([]);
  righe.push([`7) Controllo: il totale delle terziarie piu' il CSS-C deve fare ${mig(totaleDaPortale(dati))} kg, il totale da caricare a portale${dati.extra && intero(dati.extra.totale_kg) ? ` (extra raccolta compresa: ${mig(dati.extra.totale_kg)} kg)` : ''}.`]);
  righe.push([`   ${colonna} e la riga IRIGOM devono restare quelle di sempre.`]);
  return righe;
}

/** Il totale che il blocco deve fare: quello che si carica a portale. */
export function totaleDaPortale(dati) {
  return intero(dati.totale_portale_kg);
}

/**
 * Il file Excel col blocco pronto da incollare: foglio BLOCCO e foglio
 * "Come si incolla".
 * @returns {Promise<Uint8Array>}
 */
export async function excelBlocco(dati) {
  const XLSX = await import('xlsx');
  const { righe, indice } = righeBlocco(dati);
  const ws = {};
  let ultimaColonna = 0;
  righe.forEach((riga, i) => {
    (riga || []).forEach((valore, c) => {
      if (valore === null || valore === undefined || valore === '') return;
      const ref = XLSX.utils.encode_cell({ r: i, c });
      ws[ref] = typeof valore === 'object' ? { ...valore } : (typeof valore === 'number' ? { t: 'n', v: valore } : { t: 's', v: String(valore) });
      if (c > ultimaColonna) ultimaColonna = c;
    });
  });
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, righe.length - 1), c: Math.max(ultimaColonna, 12) } });
  ws['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'BLOCCO');
  const guida = XLSX.utils.aoa_to_sheet(istruzioni(dati, indice));
  guida['!cols'] = [{ wch: 120 }];
  XLSX.utils.book_append_sheet(wb, guida, 'Come si incolla');
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellStyles: false }));
}

export { MESI_NOMI };
