// Le pivot della quadratura FIR dentro un foglio di calcolo.
//
// Sta qui, in un modulo senza nessuna dipendenza dal browser, perche' le prove
// lo possano chiamare: prove/pivotQuadratura.mjs. src/lib/quadraturaFir.js lo usa
// per leggere un file Excel caricato dalla pagina.
//
// DUE COSE CHE IL LETTORE NON DEVE PIU' FARE (viste sul file vero dell'utente il
// 30/09/2026, foglio "REPORT MENSILE" di Gestione Ecotyre 2026):
//
// 1. PRENDERE OGNI PIVOT CHE TROVA. Il foglio di lavoro ne contiene undici, su
//    sei fogli: raccolta per regione e classe, impianti, terziarie, giacenze,
//    richieste da evadere. Venivano lette tutte e trattate come conteggi di
//    formulari, e una pivot di chili per classe usciva come "12920 formulari per
//    262.880 kg". Una pivot della quadratura ha SEMPRE due misure, un conteggio e
//    un peso: se le due colonne non sono quelle, la tabella non e' nostra.
//
// 2. RUBARE IL TITOLO AL VICINO. Le pivot settimanali dell'utente non hanno un
//    titolo sopra, hanno "Nr. Settimana | 39". Non trovandolo, il lettore
//    allargava la ricerca a tutta la riga e pescava la parola "RACCOLTA" della
//    pivot mensile che sta a fianco, in un'altra colonna: lo stesso titolo finiva
//    sulle primarie E sulle secondarie della settimana, che cosi' si scontravano
//    sullo stesso flusso e una delle due spariva. Adesso il titolo si cerca solo
//    sopra le colonne della tabella; se non c'e', non c'e', e lo sceglie l'utente.

const INTESTAZIONE = /etichette\s+di\s+riga|row\s+labels/i;
const TOTALE = /totale\s+complessivo|grand\s+total/i;

// Le due misure di una pivot della quadratura: quanti formulari e quanti chili.
const MISURA_CONTEGGIO = /conteggio|conta\b|count|numero|\bnr\b|\bn\.|quantit|\bqta\b/i;
const MISURA_PESO = /somma|peso|\bkg\b|weight/i;

// Il titolo: una delle parole che dicono il flusso, oppure l'etichetta di una
// fonte. Qualunque altra scritta sopra la tabella non e' un titolo.
const TITOLO = /RACCOLTA|SECOND|\bSEC\b|\bSEC[-\s]|\bACI\b|AUTODEMOLIZ|EXTRA|PRIMARI|\bRETE\b|WIN\s*SINFO|WINSINFO|PORTALE|ECOTYRE|\bECT\b|GESTIONALE/i;
const SETTIMANA = /settiman|\bW\s*\d{1,2}\b/i;

export const testo = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

export function numero(v) {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const s = testo(v).replace(/\s/g, '');
  if (!s || !/[0-9]/.test(s)) return null;
  const n = Number(s.replace(/\./g, '').replace(',', '.'));
  return isFinite(n) ? n : null;
}

/**
 * Le due colonne delle misure, se sono quelle giuste: la prima deve essere un
 * conteggio e la seconda un peso. null se la tabella non e' una pivot della
 * quadratura (e allora non la si legge affatto).
 */
export function colonneMisure(intestazioni, c0) {
  const trovate = [];
  for (let c = c0 + 1; c < c0 + 6 && trovate.length < 2; c++) {
    const v = testo(intestazioni[c]);
    if (v) trovate.push({ c, v });
  }
  if (trovate.length < 2) return null;
  if (!MISURA_CONTEGGIO.test(trovate[0].v) || !MISURA_PESO.test(trovate[1].v)) return null;
  return [trovate[0].c, trovate[1].c];
}

/** La tabella che comincia dalla cella "Etichette di riga" in (r0, c0). */
export function leggiTabella(griglia, r0, c0) {
  const colonne = colonneMisure(griglia[r0] || [], c0);
  if (!colonne) return null;

  const grezze = [];
  let totale = null;
  for (let r = r0 + 1; r < griglia.length; r++) {
    const etichetta = testo((griglia[r] || [])[c0]);
    if (!etichetta) break;
    const n = numero((griglia[r] || [])[colonne[0]]);
    const kg = numero((griglia[r] || [])[colonne[1]]);
    if (TOTALE.test(etichetta)) { totale = { n: Math.round(n || 0), kg: kg || 0 }; break; }
    if (n === null && kg === null) break;
    grezze.push({ etichetta, n: Math.round(n || 0), kg: kg || 0 });
  }
  if (!grezze.length) return null;

  // Impianti e trasportatori: una riga e' un impianto se le successive la sommano.
  const righe = [];
  const subtotali = [];
  let i = 0;
  while (i < grezze.length) {
    const capo = grezze[i];
    let sommaN = 0, sommaKg = 0, fine = -1;
    for (let j = i + 1; j < grezze.length; j++) {
      sommaN += grezze[j].n;
      sommaKg += grezze[j].kg;
      if (sommaN === capo.n && Math.abs(sommaKg - capo.kg) <= 1) { fine = j; break; }
      if (sommaN > capo.n) break;
    }
    if (fine > i) {
      subtotali.push({ impianto: capo.etichetta, conteggio: capo.n, kg: capo.kg });
      for (let j = i + 1; j <= fine; j++) {
        righe.push({ impianto: capo.etichetta, trasportatore: grezze[j].etichetta, conteggio: grezze[j].n, kg: grezze[j].kg });
      }
      i = fine + 1;
    } else {
      // Nessun sottolivello: l'impianto e' anche la riga di dettaglio.
      righe.push({ impianto: capo.etichetta, trasportatore: capo.etichetta, conteggio: capo.n, kg: capo.kg });
      i++;
    }
  }

  // Titolo e settimana, cercati SOLO sopra le colonne di questa tabella: il
  // titolo di una pivot che sta a fianco non e' il nostro (vedi in cima).
  let titolo = '', settimana = '';
  const daSinistra = Math.max(0, c0 - 1);
  const aDestra = colonne[1] + 1;
  for (let r = r0 - 1; r >= Math.max(0, r0 - 6) && (!titolo || !settimana); r--) {
    for (let c = daSinistra; c <= aDestra; c++) {
      const v = testo((griglia[r] || [])[c]);
      if (!v) continue;
      if (!titolo && TITOLO.test(v)) titolo = v;
      if (!settimana && SETTIMANA.test(v)) {
        // "Nr. Settimana" sta a sinistra e il numero nella cella accanto.
        const n = numero(v) ?? numero((griglia[r] || [])[c + 1]);
        if (n !== null && n >= 1 && n <= 53) settimana = String(Math.round(n));
      }
    }
  }

  return {
    titolo, settimana: settimana ? Number(settimana) : null, righe, subtotali,
    totale_conteggio: totale ? totale.n : righe.reduce((s, x) => s + x.conteggio, 0),
    totale_kg: totale ? totale.kg : righe.reduce((s, x) => s + x.kg, 0),
  };
}

/** Tutte le pivot della quadratura dentro una griglia di celle. */
export function leggiPivotDaGriglia(griglia, foglio = '') {
  const out = [];
  for (let r = 0; r < griglia.length; r++) {
    const riga = griglia[r] || [];
    for (let c = 0; c < riga.length; c++) {
      if (!INTESTAZIONE.test(testo(riga[c]))) continue;
      const t = leggiTabella(griglia, r, c);
      if (t && t.righe.length) out.push({ ...t, foglio });
    }
  }
  return out;
}
