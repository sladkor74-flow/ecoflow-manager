// Esportazione Excel e PDF per Extra Raccolta — formato amministrazione.
//
// I DUE FILE SI VESTONO E DICONO LA DATA DEI DATI (chiusura dell'audit,
// 11/10/2026). L'Excel usciva da SheetJS senza fascia ne' piede, e il PDF era
// una griglia scritta a mano, senza intestazioni in negativo ne' numero di
// pagina. Ora l'Excel passa dal corredo comune (fogliProfessionali.js) con le
// stesse righe di prima, cella per cella, e il PDF da esportaSezioniPdf, come la
// passiva: tutti e due col blocco di testa - canale, mese per fine trasporto,
// fino a che giorno arrivano le schede, generato il ... da ....
import { cifreItaliane } from '@/lib/formatoSoldi';
import { documentoDa, nuovaCartella, foglioDaRighe, scaricaCartella, FORMATI } from '@/lib/fogliProfessionali';
import { giornoRoma } from '@/lib/giornoItaliano';
import { calcExtraRaccolta, totaleRiga, aggregaPerProduttore, prezzoAttivoExtra, avvisoPesoMancante } from '@/lib/extraRaccoltaCalc';

// Il prezzo in colonna e' quello con cui la riga si fattura: il prezzo scritto
// sull'intervento o, se manca, la tariffa della tabella o la base dell'anno.
// Scritto zero, il report diceva un prezzo e la fattura un altro.
//
// IL CONTESTO E' QUELLO DELLA PAGINA (chiusura dell'audit, 11/10/2026). Il file
// chiamava prezzoAttivoExtra, totaleRiga e aggregaPerProduttore senza le tariffe
// che la pagina ha letto, e conosceva solo il prezzo scritto e la base dell'anno:
// con la Tariffa EXTRA_RACCOLTA a un valore diverso dalla base, o dal 2027, il
// file diceva un prezzo e la pagina e la fattura un altro. Ora la pagina passa
// il suo contesto (contestoPrezzi di extraRaccoltaCalc.js); senza, restano i
// due gradini che non hanno bisogno di letture.
const prezzoRiga = (r, contesto) => prezzoAttivoExtra(r, contesto).valore;

const MESI_UPPER = {
  'Gennaio': 'GENNAIO', 'Febbraio': 'FEBBRAIO', 'Marzo': 'MARZO',
  'Aprile': 'APRILE', 'Maggio': 'MAGGIO', 'Giugno': 'GIUGNO',
  'Luglio': 'LUGLIO', 'Agosto': 'AGOSTO', 'Settembre': 'SETTEMBRE',
  'Ottobre': 'OTTOBRE', 'Novembre': 'NOVEMBRE', 'Dicembre': 'DICEMBRE'
};

const r2 = (n) => Math.round(n * 100) / 100;

// La data nella cella e' il GIORNO ITALIANO, scritto come mezzanotte UTC: Excel
// mostra quel giorno qualunque sia il fuso del computer. Con l'istante nudo un
// trasporto finito alle 23:30 UTC del 30 giugno, in Italia il 1° luglio, usciva
// al 30 giugno (11/10/2026, la stessa regola di esportaTabella.js).
function toDate(v) {
  const g = giornoRoma(v);
  return g ? new Date(`${g}T00:00:00.000Z`) : null;
}

// Numeri all'italiana nel PDF: punto per le migliaia, virgola per i decimali.
// Un peso che manca resta «—», non 0.
const kgPdf = (v) => (v === null || v === undefined ? '—' : cifreItaliane(v, 0, 0));

/**
 * I NUMERI DEL FILE, CALCOLATI UNA VOLTA PER EXCEL E PDF (chiusura dell'audit,
 * 11/10/2026).
 *
 * Il «Totale imponibile» sommava i sovracosti del ricavo di TUTTI gli
 * interventi, anche di quelli che la fattura non conta: un terminato senza peso
 * effettivo e una secondaria restano fuori dalla fattura per intero, sovracosti
 * compresi. Un intervento da 2.000 kg a 202 €/t con 50 € di sovracosto e una
 * scheda vecchia senza peso con altri 50 €: il file diceva 504,00 di imponibile
 * e 454,00 di ricavi nell'analisi per produttore, la fattura 454,00. Ora i
 * sovracosti si sommano solo per chi entra in fattura (calcExtraRaccolta(r).fatturato)
 * e il totale imponibile e' la somma dei ricavi, gli stessi della fattura e
 * dell'analisi per produttore. Chi ha il peso che manca si elenca, con la frase
 * della fattura, e i suoi chili si scrivono «—», non 0.
 *
 * Torna { righe: [{ record, kg, prezzo, totale }], totale_kg, sovracosto_raccolta,
 * sovracosto_trasporto, sovracosto_trattamento, totale_imponibile, senza_peso,
 * per_produttore }.
 */
export function datiExportExtra(records, contesto) {
  const elenco = records || [];
  const righe = [];
  const senzaPeso = [];
  let totKg = 0, sovraRaccolta = 0, sovraTrasporto = 0, sovraTrattamento = 0, imponibile = 0;
  for (const r of elenco) {
    const c = calcExtraRaccolta(r, contesto);
    if (!c.senza_peso) totKg += c.kg;
    if (c.fatturato) {
      sovraRaccolta += r2(Number(r.sovracosto_raccolta || 0));
      sovraTrasporto += r2(Number(r.sovracosto_trasporto || 0));
      sovraTrattamento += r2(Number(r.sovracosto_trattamento || 0));
      imponibile += c.ricavo;
    }
    if (c.senza_peso) senzaPeso.push({ numero_fir: r.numero_fir || r.id_ordine || '', avviso: avvisoPesoMancante(r) });
    righe.push({ record: r, kg: c.senza_peso ? null : c.kg, prezzo: prezzoRiga(r, contesto), totale: totaleRiga(r, contesto) });
  }
  return {
    righe,
    totale_kg: totKg,
    sovracosto_raccolta: r2(sovraRaccolta),
    sovracosto_trasporto: r2(sovraTrasporto),
    sovracosto_trattamento: r2(sovraTrattamento),
    totale_imponibile: r2(imponibile),
    senza_peso: senzaPeso,
    per_produttore: aggregaPerProduttore(elenco, contesto),
  };
}

const TITOLO_SENZA_PESO = 'DA SISTEMARE: interventi terminati senza peso effettivo, fuori dalla fattura e dal totale imponibile';

// Il blocco di testa dei due file: canale, mese per fine trasporto, fino a che
// giorno arrivano le schede dell'extra raccolta. stato: quello gia' letto (le prove).
function documentoExtra(mese, anno, stato, comeDocumento = true) {
  const opzioni = {
    titolo: `Fatturazione extra raccolta — ${mese} ${anno}`,
    canale: 'EXTRA_RACCOLTA', periodo: `${mese} ${anno}`, entita: ['ExtraRaccolta'],
    ...(stato !== undefined ? { stato } : {}),
  };
  return comeDocumento ? documentoDa(opzioni) : opzioni;
}

export async function exportExtraRaccoltaExcel(records, mese, anno, contesto, opzioni = {}) {
  const doc = await documentoExtra(mese, anno, opzioni.stato);
  const sheetName = `${MESI_UPPER[mese] || String(mese).toUpperCase()} ${anno}`;
  const dati = datiExportExtra(records, contesto);
  const wsData = [];

  // === Area 1: righe intervento ===
  wsData.push([
    'Nr. FIR', 'PRODUTTORE', 'TRASPORTATORE', 'DESTINATARIO',
    'DATA INIZIO TRASPORTO', 'DATA FINE TRASPORTO',
    'CER', 'TIPOLOGIA TRASPORTO', "QUANTITA' (kg)", 'PREZZO (Euro/ton)', 'TOTALE (Euro)'
  ]);

  for (const x of dati.righe) {
    const r = x.record;
    wsData.push([
      r.numero_fir || '',
      r.produttore || '',
      r.trasportatore || '',
      r.destinazione || '',
      toDate(r.trasporto_iniziato_il) || '',
      toDate(r.trasporto_finito_il) || '',
      r.cer || '160103',
      r.tipologia_trasporto || '',
      // Un peso che manca non e' zero: «—», come nella pagina.
      x.kg === null ? '—' : x.kg,
      x.prezzo,
      x.totale,
    ]);
  }

  // === Area 2: riepilogo ===
  wsData.push([]);
  const iRiepilogo = wsData.length;
  wsData.push(["TOTALE QUANTITA' (kg)", dati.totale_kg]);
  wsData.push(['Sovracosto Raccolta', dati.sovracosto_raccolta]);
  wsData.push(['Sovracosto Trasporto', dati.sovracosto_trasporto]);
  wsData.push(['Sovracosto Trattamento', dati.sovracosto_trattamento]);
  wsData.push(['Totale imponibile', dati.totale_imponibile]);
  const avvisi = [];
  if (dati.senza_peso.length) {
    wsData.push([]);
    avvisi.push(wsData.length);
    wsData.push([TITOLO_SENZA_PESO]);
    for (const s of dati.senza_peso) { avvisi.push(wsData.length); wsData.push([s.numero_fir, s.avviso]); }
  }

  // === Area 3: analisi margine per produttore ===
  // La voce «trasporto» e' il costo a viaggio degli interventi (campo
  // costo_trasporto_viaggio, nato il 03/10/2026): sta fra le voci di costo e non
  // nel riepilogo qui sopra, che somma i sovracosti del ricavo e finisce nel
  // totale imponibile. Si somma tale e quale, come la pulizia e i costi
  // aggiuntivi, perche' e' un importo fisso per intervento e non un prezzo a
  // tonnellata; senza questa colonna le voci non facevano piu' il costo totale,
  // che il trasporto lo comprende.
  // Le due voci «sovracosto raccoglitore» e «sovracosto impianto» (campi
  // sovracosto_pagato_raccoglitore e sovracosto_pagato_impianto, nati il
  // 03/10/2026 con la precisazione dell'utente) stanno qui per lo stesso motivo:
  // sono soldi che SMOCO PAGA, al raccoglitore per i costi imprevisti della
  // raccolta o all'impianto per quelli del trattamento, e il costo totale li
  // comprende. Si sommano tali e quali, come la pulizia e il trasporto, perche'
  // sono importi fissi per intervento e non prezzi a tonnellata. Nel riepilogo
  // dell'Area 2 non ci vanno mai: quello somma i tre sovracosti del RICAVO e
  // finisce nel totale imponibile della fatturazione attiva, e un costo che
  // paghiamo noi lo gonfierebbe.
  wsData.push([]);
  const iAnalisi = wsData.length;
  wsData.push(['PRODUTTORE', 'costi aggiuntivi', 'raccolta', 'stoccaggio', 'trattamento', 'pulizia', 'trasporto', 'sovracosto raccoglitore', 'sovracosto impianto', 'costo totale', 'ricavi', 'margine']);

  const byProd = dati.per_produttore;
  let totCostiAgg = 0, totRaccolta = 0, totStoccaggio = 0, totTrattamento = 0, totPulizia = 0, totTrasporto = 0;
  let totSovraRaccoglitore = 0, totSovraImpianto = 0, totCosto = 0, totRicavi = 0, totMargine = 0;

  for (const [p, v] of Object.entries(byProd)) {
    wsData.push([
      p,
      r2(v.costi_aggiuntivi), r2(v.raccolta), r2(v.stoccaggio), r2(v.trattamento),
      r2(v.pulizia), r2(v.trasporto), r2(v.sovracosto_raccoglitore), r2(v.sovracosto_impianto),
      r2(v.costo_totale), r2(v.ricavi), r2(v.margine),
    ]);
    totCostiAgg += v.costi_aggiuntivi; totRaccolta += v.raccolta; totStoccaggio += v.stoccaggio;
    totTrattamento += v.trattamento; totPulizia += v.pulizia; totTrasporto += v.trasporto;
    totSovraRaccoglitore += v.sovracosto_raccoglitore; totSovraImpianto += v.sovracosto_impianto;
    totCosto += v.costo_totale; totRicavi += v.ricavi; totMargine += v.margine;
  }

  wsData.push([
    'TOTALE',
    r2(totCostiAgg), r2(totRaccolta), r2(totStoccaggio), r2(totTrattamento),
    r2(totPulizia), r2(totTrasporto), r2(totSovraRaccoglitore), r2(totSovraImpianto),
    r2(totCosto), r2(totRicavi), r2(totMargine),
  ]);

  const margPercTot = totRicavi !== 0 ? r2((totMargine / totRicavi) * 100) : 0;
  wsData.push([]);
  wsData.push(['Margine % complessivo', `${cifreItaliane(margPercTot, 2, 2)}%`]);

  // I formati, area per area: negli interventi chili, prezzo a tonnellata e
  // importo; nel riepilogo i chili del totale e gli euro dei sovracosti; nell'analisi
  // tutti euro. Prima i formati si deducevano dai titoli della prima tabella e
  // valevano per tutto il foglio: nell'analisi il «sovracosto impianto» usciva
  // coi chili interi (12,50 € si leggeva 13).
  const formati = (c, riga, i) => {
    if (i < iRiepilogo) return { 8: FORMATI.kg, 9: FORMATI.prezzoLibero, 10: FORMATI.euro }[c] || null;
    if (i < iAnalisi) return c === 1 ? (/\(kg\)/.test(String(riga[0])) ? FORMATI.kg : FORMATI.euro) : null;
    return c >= 1 ? FORMATI.euro : null;
  };
  const { wb } = await nuovaCartella();
  foglioDaRighe(wb, sheetName, {
    doc, righe: wsData, testate: [0, iAnalisi], formati,
    stili: { ...Object.fromEntries(avvisi.map(i => [i, 'avviso'])), [wsData.length - 1]: 'gruppo' },
    larghezze: [24, 30, 28, 28, 14, 14, 14, 18, 14, 14, 14, 14],
  });
  return scaricaCartella(wb, `SMOCO-Fatturazione EXTRA RACCOLTA ${mese} ${anno}.xlsx`);
}


export async function exportExtraRaccoltaPDF(records, mese, anno, contesto, opzioni = {}) {
  const dati = datiExportExtra(records, contesto);
  // Le stesse tre aree dell'Excel, con la veste del PDF della passiva: il
  // riepilogo nei riquadri in alto, gli interventi, l'analisi per produttore e,
  // in coda, le schede senza peso da sistemare.
  const byProd = dati.per_produttore;
  const tot = { costi_aggiuntivi: 0, raccolta: 0, stoccaggio: 0, trattamento: 0, pulizia: 0, trasporto: 0, sovracosto_raccoglitore: 0, sovracosto_impianto: 0, costo_totale: 0, ricavi: 0, margine: 0 };
  const voci = Object.keys(tot);
  const analisi = Object.entries(byProd).map(([p, v]) => {
    for (const k of voci) tot[k] += v[k];
    return { celle: [p, ...voci.map(k => r2(v[k]))] };
  });
  analisi.push({ stile: 'totale', celle: ['TOTALE', ...voci.map(k => r2(tot[k]))] });
  const margPercTot = tot.ricavi !== 0 ? r2((tot.margine / tot.ricavi) * 100) : 0;
  analisi.push({ stile: 'gruppo', celle: ['Margine % complessivo', ...voci.map(() => null).slice(1), `${cifreItaliane(margPercTot, 2, 2)}%`] });

  const { esportaSezioniPdf } = await import('@/lib/esportaTabella');
  await esportaSezioniPdf({
    nomeFile: `SMOCO-Fatturazione EXTRA RACCOLTA ${mese} ${anno}`,
    intestazione: 'SMOCO S.r.l.  ·  COMMESSA ECOTYRE  ·  EXTRA RACCOLTA',
    titolo: `Fatturazione extra raccolta — ${mese} ${anno}`,
    sottotitolo: `${dati.righe.length} ${dati.righe.length === 1 ? 'intervento' : 'interventi'}`,
    documento: documentoExtra(mese, anno, opzioni.stato, false),
    riepilogo: [
      { etichetta: "Totale quantita' (kg)", valore: kgPdf(dati.totale_kg) },
      { etichetta: 'Sovracosto raccolta', valore: dati.sovracosto_raccolta, tipo: 'euro' },
      { etichetta: 'Sovracosto trasporto', valore: dati.sovracosto_trasporto, tipo: 'euro' },
      { etichetta: 'Sovracosto trattamento', valore: dati.sovracosto_trattamento, tipo: 'euro' },
      { etichetta: 'Totale imponibile', valore: dati.totale_imponibile, tipo: 'euro' },
    ],
    sezioni: [
      {
        titolo: 'INTERVENTI',
        // Il prezzo tiene da due a quattro decimali, come l'Excel (prezzoLibero):
        // col tipo 'euro' un prezzo al chilo da 0,202 usciva «0,20 €» e il PDF e
        // l'Excel dello stesso mese dicevano due prezzi (revisione delle
        // migliorie, 11/10/2026).
        colonne: [
          { titolo: 'Nr. FIR', tipo: 'testo', peso: 1.2 }, { titolo: 'PRODUTTORE', tipo: 'testo', peso: 1.8 }, { titolo: 'TRASPORTATORE', tipo: 'testo', peso: 1.6 },
          { titolo: 'DESTINATARIO', tipo: 'testo', peso: 1.6 }, { titolo: 'DATA INIZIO TRASPORTO', tipo: 'data', peso: 0.9 }, { titolo: 'DATA FINE TRASPORTO', tipo: 'data', peso: 0.9 },
          { titolo: 'CER', tipo: 'testo', peso: 0.6 }, { titolo: 'TIPOLOGIA TRASPORTO', tipo: 'testo', peso: 1.1 }, { titolo: "QUANTITA' (kg)", tipo: 'kg', peso: 0.8 },
          { titolo: 'PREZZO (Euro/ton)', tipo: 'prezzoLibero', peso: 0.8 }, { titolo: 'TOTALE (Euro)', tipo: 'euro', peso: 0.9 },
        ],
        righe: dati.righe.map(x => {
          const r = x.record;
          // Un peso che manca non e' zero: «—», come nella pagina e nell'Excel.
          return { celle: [r.numero_fir || '', r.produttore || '', r.trasportatore || '', r.destinazione || '', r.trasporto_iniziato_il || null, r.trasporto_finito_il || null, r.cer || '160103', r.tipologia_trasporto || '', x.kg === null ? '—' : x.kg, x.prezzo, x.totale] };
        }),
      },
      {
        titolo: 'ANALISI MARGINE PER PRODUTTORE',
        colonne: [
          { titolo: 'PRODUTTORE', tipo: 'testo', peso: 2 },
          ...['costi agg.', 'raccolta', 'stoccaggio', 'trattamento', 'pulizia', 'trasporto', 'sovr. raccogl.', 'sovr. impianto', 'costo tot.', 'ricavi', 'margine'].map(t => ({ titolo: t, tipo: 'euro', peso: 1 })),
        ],
        righe: analisi,
      },
    ],
    note: dati.senza_peso.map(x => x.avviso),
    titoloNote: TITOLO_SENZA_PESO,
  });
}
