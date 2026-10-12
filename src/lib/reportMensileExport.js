import {
  documentoDa, nuovaCartella, testaDocumento, intestazione, rigaDettaglio, rigaTotale, rigaAvviso,
  formatta, bloccaRighe, perLaStampa, scaricaCartella, leggiStatoDati, nomeFoglio, FORMATI, COLORI,
} from '@/lib/fogliProfessionali';

// L'EXCEL DEL REPORT MENSILE (chiusura dell'audit, 11/10/2026).
//
// La pagina esportava un CSV: numeri senza formato, nessuna intestazione, e le
// pivot di una scheda una sotto l'altra senza dire di che canale fossero. Ora
// esce un Excel col corredo dei fogli che si mandano fuori (fogliProfessionali.js):
// un foglio per pivot, ciascuno col suo blocco di testa - canale, periodo per
// fine trasporto (il mese per le pivot del mese, l'anno per quelle dell'anno),
// dati fino al dell'archivio da cui nasce, generato il ... da ... - e le righe
// dell'albero rientrate e raggruppate come a video.
//
// I NUMERI COME NEL RESTO DEL GESTIONALE: le tonnellate con due decimali, tre se
// i chili non sono tondi; i viaggi interi. Una cella senza movimenti resta
// VUOTA, come nella pivot a video: vuota non vuol dire zero. Nel file ci sono
// numeri veri, non testi, cosi' chi lo riceve li puo' sommare.

// Il canale e l'archivio di ogni pivot: rete, ACI ed extra raccolta stanno in
// fogli diversi e non si sommano; le terziarie non sono un canale.
const PIVOT = {
  raccoltaAnno: { canale: 'RETE', entita: 'PrimariaRete' },
  impiantiAnno: { canale: 'RETE', entita: 'PrimariaRete' },
  raccolta: { canale: 'RETE', entita: 'PrimariaRete' },
  impianti: { canale: 'RETE', entita: 'PrimariaRete' },
  viaggiRete: { canale: 'RETE', entita: 'PrimariaRete' },
  aci: { canale: 'ACI', entita: 'PrimariaAci' },
  secondarieAci: { canale: 'ACI', entita: 'Secondaria' },
  viaggiSecondarieAci: { canale: 'ACI', entita: 'Secondaria' },
  secondarie: { canale: 'RETE', entita: 'Secondaria' },
  viaggiSecondarie: { canale: 'RETE', entita: 'Secondaria' },
  terziarie: { canale: 'Terziarie, a parte dai canali', entita: 'Terziaria' },
  extra: { canale: 'EXTRA_RACCOLTA', entita: 'ExtraRaccolta' },
  extraSecondarie: { canale: 'EXTRA_RACCOLTA', entita: 'ExtraRaccolta' },
};

const formatoMisura = (m) => (m === 'conteggio' ? FORMATI.intero : FORMATI.tonnellateFini);
// Un valore che manca resta vuoto: null, non 0.
const valore = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

/**
 * Le righe di una pivot come stanno nel foglio: { testata, righe: [{ valori,
 * livello }], totale, misure }. Serve al foglio e alle prove, che confrontano i
 * totali del file con quelli della pivot a video.
 */
export function righePivot(p) {
  const colonne = p.senzaColonne ? [] : p.colonne;
  const unaMisura = p.misure.length === 1;
  const testata = [
    p.etichetteRiga.join(' > '),
    ...colonne.flatMap(c => p.misure.map((m, i) => (unaMisura ? c : c + ' ' + p.etichetteMisure[i]))),
    ...p.misure.map((m, i) => (p.senzaColonne ? p.etichetteMisure[i] : 'Totale ' + p.etichetteMisure[i])),
  ];
  const celle = (nodo) => [
    ...colonne.flatMap(c => p.misure.map(m => valore(nodo.valori && nodo.valori[c] ? nodo.valori[c][m] : null))),
    ...p.misure.map(m => valore(nodo.totali ? nodo.totali[m] : null)),
  ];
  const righe = [];
  const visita = (nodo, livello) => {
    for (const f of nodo.figli || []) {
      righe.push({ valori: [f.etichetta, ...celle(f)], livello });
      visita(f, livello + 1);
    }
  };
  visita(p.radice, 0);
  // La misura di ogni colonna numerica, nell'ordine delle colonne.
  const misure = [...colonne.flatMap(() => p.misure), ...p.misure];
  return { testata, righe, totale: ['Totale complessivo', ...celle(p.radice)], misure };
}

/**
 * Il file della scheda: un foglio per pivot.
 * { pivots, gruppo: { chiave, titolo, pivot: [...] }, anno, mese, periodoDi(p) }
 * opzioni.stato: lo stato dei dati gia' letto (le prove); senza, una lettura
 * sola per tutti gli archivi della scheda.
 */
export async function esportaReportMensileExcel({ pivots, gruppo, anno, mese, periodoDi }, opzioni = {}) {
  const chiavi = gruppo.pivot.filter(k => pivots[k]);
  const entita = [...new Set(chiavi.map(k => PIVOT[k] && PIVOT[k].entita).filter(Boolean))];
  const stato = opzioni.stato !== undefined ? opzioni.stato : await leggiStatoDati(entita);
  const { wb } = await nuovaCartella();

  for (const k of chiavi) {
    const p = pivots[k];
    const def = PIVOT[k] || {};
    // Ogni foglio dice la data del SUO archivio: le secondarie e le primarie
    // della stessa scheda possono essere arrivate a giorni diversi.
    const statoPivot = stato && stato.archivi ? { ...stato, archivi: stato.archivi.filter(a => a.entita === def.entita) } : stato;
    const doc = await documentoDa({
      titolo: p.titolo, sottotitolo: `Report mensile · ${gruppo.titolo}`,
      canale: def.canale || '', periodo: periodoDi(p), stato: statoPivot,
    });
    const t = righePivot(p);
    const quante = t.testata.length;
    const ws = wb.addWorksheet(nomeFoglio(p.titolo, wb));
    testaDocumento(ws, doc, quante);
    const formati = Object.fromEntries(t.misure.map((m, i) => [i + 2, formatoMisura(m)]));
    const testata = intestazione(ws, t.testata, Object.keys(formati).map(Number));
    t.righe.forEach((r, i) => {
      const riga = formatta(rigaDettaglio(ws, r.valori, { grassetto: r.livello === 0 && t.righe.some(x => x.livello > 0), sfondo: i % 2 ? COLORI.zebra : null, quante }), formati);
      // L'albero come a video: i figli rientrati e raggruppati sotto il padre,
      // cosi' in Excel si aprono e si chiudono col segno a margine.
      if (r.livello) {
        riga.getCell(1).alignment = { indent: Math.min(r.livello * 2, 15) };
        riga.outlineLevel = Math.min(r.livello, 7);
      }
    });
    if (!t.righe.length) rigaDettaglio(ws, ['Nessun movimento nel periodo'], { quante, colore: COLORI.grigio });
    formatta(rigaTotale(ws, t.totale, quante), formati);
    const d = p.date_da_sistemare;
    if (d && d.totale > 0) {
      const sf = d.senza_fine_trasporto || 0;
      const effetto = [sf ? `${sf} fuori da ogni periodo perché senza fine trasporto` : '', d.totale - sf ? `${d.totale - sf} nella pivot, nel mese della fine trasporto` : ''].filter(Boolean).join(', ');
      ws.addRow([]);
      rigaAvviso(ws, [`Date da sistemare: ${d.totale} terminati (${d.testo}): ${effetto}`], quante);
    }
    ws.getColumn(1).width = 40;
    for (let c = 2; c <= quante; c++) ws.getColumn(c).width = Math.max(11, Math.min(18, String(t.testata[c - 1]).length + 2));
    ws.properties.outlineProperties = { summaryBelow: false };
    bloccaRighe(ws, testata.number);
    perLaStampa(ws, { ripeti: testata.number, doc });
  }

  return scaricaCartella(wb, `report-mensile-${gruppo.chiave}-${anno}-${String(mese).toLowerCase()}.xlsx`);
}

