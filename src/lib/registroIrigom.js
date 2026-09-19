// Il registro di carico e scarico di Irigom, letto nel browser.
//
// Il file dell'impianto e' un registro di tutto l'anno. Al gestionale servono
// due cose.
//
// 1. Dal foglio "Cons." la riga del mese: quanto cippato, ferro e CSS-C sono
//    stati prodotti, quanto e' uscito, e la giacenza a fine mese divisa per
//    materiale. Le due giacenze che contano per le dichiarazioni sono il
//    cippato e i PFU interi: la loro somma e' la giacenza di PFU che deve
//    restare a portale dopo la dichiarazione del mese.
//
// 2. Dal foglio "Dettaglio" le uscite di CSS-C. Il CSS-C ha cessato la qualifica
//    di rifiuto - e' un end of waste - quindi viaggia con documento di trasporto
//    e non con formulario. Le righe della nostra commessa sono quelle che
//    l'impianto evidenzia in ARANCIONE: le altre sono di altri committenti e non
//    ci riguardano. Il riconoscimento e' sul riempimento della cella dei
//    chilogrammi, e i conteggi per colore tornano indietro insieme ai dati, cosi'
//    se un giorno l'impianto cambiasse colore lo si vede subito.
//
// Verificato sul file della settimana 37 del 2026: le uscite arancioni fanno,
// mese per mese, esattamente la colonna "Uscite CSS-C" del foglio Cons.

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

// L'arancione di Excel e le sue sfumature piu' comuni.
const ARANCIONI = new Set(['FFC000', 'FFA500', 'ED7D31', 'F79646', 'FFBF00', 'FF9900']);

// Le colonne della riga del mese nel foglio Cons., per lettera.
const COLONNE = {
  cippato_prodotto_kg: 'R',
  ferro_prodotto_kg: 'T',
  cssc_prodotto_kg: 'U',
  uscite_cippato_kg: 'V',
  uscite_corgom_kg: 'W',
  uscite_ferro_kg: 'X',
  uscite_cssc_kg: 'Y',
  giacenza_cssc_kg: 'Z',
  giacenza_cippato_kg: 'AA',
  giacenza_saci_kg: 'AB',
  giacenza_intero_kg: 'AC',
  giacenza_totale_kg: 'AD',
  giacenza_ferro_kg: 'AE',
};

const numero = (c) => (c && typeof c.v === 'number' && isFinite(c.v) ? Math.round(c.v) : 0);
const testo = (c) => String((c && c.v) ?? '').replace(/\s+/g, ' ').trim();

function foglio(wb, nome) {
  const trovato = wb.SheetNames.find(n => n.trim().toLowerCase() === nome.toLowerCase());
  return trovato ? wb.Sheets[trovato] : null;
}

/**
 * La riga del foglio Cons. dove comincia la sequenza dei dodici mesi della
 * tabella che ci interessa.
 *
 * Nel foglio ci sono sei tabelle con i mesi incolonnati nella O, quindi cercare
 * "Gennaio" non basta: si cerca prima la riga di intestazione di questa tabella,
 * quella che ha "Uscite CSS-C" con accanto le giacenze per materiale, e poi il
 * gennaio che viene subito sotto.
 */
function rigaDeiMesi(XLSX, ws) {
  const r = XLSX.utils.decode_range(ws['!ref']);
  const senzaSpazi = (c) => testo(c).replace(/\s+/g, '').toLowerCase();
  for (let R = r.s.r; R <= r.e.r; R++) {
    const intestazione = /uscitecss-?c/.test(senzaSpazi(ws['Y' + (R + 1)]))
      && senzaSpazi(ws['AA' + (R + 1)]) === 'cippato'
      && senzaSpazi(ws['AC' + (R + 1)]) === 'intero';
    if (!intestazione) continue;
    for (let G = R + 1; G < R + 6; G++) {
      if (testo(ws['O' + (G + 1)]).toLowerCase() !== 'gennaio') continue;
      const tutti = MESI.every((m, i) => testo(ws['O' + (G + 1 + i)]).toLowerCase() === m.toLowerCase());
      if (tutti) return G + 1;
    }
  }
  return 0;
}

/** Le uscite di CSS-C del foglio Dettaglio, con il colore di ciascuna. */
function usciteCssc(XLSX, ws, anno) {
  const r = XLSX.utils.decode_range(ws['!ref']);
  const righe = [];
  const perColore = {};
  for (let R = r.s.r; R <= r.e.r; R++) {
    const kg = ws['AU' + (R + 1)];
    if (!kg || typeof kg.v !== 'number' || !kg.v) continue;
    const data = ws['A' + (R + 1)];
    const d = data && data.v instanceof Date && !isNaN(data.v.getTime()) ? data.v : null;
    if (!d || d.getFullYear() !== anno) continue;
    const colore = (kg.s && kg.s.fgColor && kg.s.fgColor.rgb ? String(kg.s.fgColor.rgb) : '').toUpperCase().slice(-6);
    perColore[colore || 'nessuno'] = (perColore[colore || 'nessuno'] || 0) + Math.round(kg.v);
    righe.push({
      riga: R + 1,
      data: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      mese: MESI[d.getMonth()],
      ddt: testo(ws['AV' + (R + 1)]),
      lotto: testo(ws['AW' + (R + 1)]),
      kg: Math.round(kg.v),
      colore: colore || 'nessuno',
      nostra: ARANCIONI.has(colore),
    });
  }
  return { righe, per_colore: perColore };
}

/**
 * Legge il registro e restituisce quello che serve alle dichiarazioni.
 * @returns { anno, mesi: [...], cssc: { righe, per_colore }, controlli: [...] }
 */
export async function leggiRegistroIrigom(file, anno) {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true, cellStyles: true });

  const cons = foglio(wb, 'cons.');
  const dettaglio = foglio(wb, 'dettaglio');
  if (!cons) throw new Error('Nel file non c\'è il foglio "Cons.": non è il registro di carico e scarico di Irigom.');
  if (!dettaglio) throw new Error('Nel file non c\'è il foglio "Dettaglio".');

  const prima = rigaDeiMesi(XLSX, cons);
  if (!prima) throw new Error('Nel foglio "Cons." non ho trovato la sequenza dei dodici mesi nella colonna O: il registro ha una forma che non conosco.');

  const mesi = MESI.map((nome, i) => {
    const riga = prima + i;
    const m = { mese: nome, indice: i, riga };
    for (const [campo, col] of Object.entries(COLONNE)) m[campo] = numero(cons[col + riga]);
    // La giacenza di PFU che deve restare a portale: cippato piu' interi.
    m.giacenza_pfu_kg = m.giacenza_cippato_kg + m.giacenza_intero_kg;
    return m;
  });

  const cssc = usciteCssc(XLSX, dettaglio, anno);

  // Controllo: le uscite arancioni di ogni mese devono fare la colonna Y del
  // foglio Cons. Se non tornano, o il colore e' cambiato o il registro e' in
  // corso di aggiornamento: in ogni caso va guardato prima di dichiarare.
  const controlli = [];
  for (const m of mesi) {
    const nostre = cssc.righe.filter(r => r.mese === m.mese && r.nostra);
    const somma = nostre.reduce((s, r) => s + r.kg, 0);
    m.cssc_nostre_kg = somma;
    m.cssc_nostre_ddt = nostre.length;
    if (somma !== m.uscite_cssc_kg) {
      controlli.push(`${m.mese}: le uscite di CSS-C arancioni nel foglio Dettaglio fanno ${somma} kg in ${nostre.length} DDT, mentre il foglio Cons. ne segna ${m.uscite_cssc_kg}. Controlla il registro prima di dichiarare.`);
    }
  }

  return { anno, mesi, cssc, controlli, file_nome: file.name };
}

export { MESI, ARANCIONI };
