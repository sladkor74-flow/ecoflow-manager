// Esportazione Excel e PDF per Extra Raccolta — formato amministrazione.
//
// I DUE FILE SI VESTONO E DICONO LA DATA DEI DATI (chiusura dell'audit,
// 11/10/2026). L'Excel usciva da SheetJS senza fascia ne' piede, e il PDF era
// una griglia scritta a mano, senza intestazioni in negativo ne' numero di
// pagina. Ora l'Excel passa dal corredo comune (fogliProfessionali.js) con le
// stesse righe di prima, cella per cella, e il PDF da esportaSezioniPdf, come la
// passiva: tutti e due col blocco di testa - canale, mese per fine trasporto,
// fino a che giorno arrivano le schede, generato il ... da ....
//
// IL SURPLUS SULLE TARIFFE HA LA SUA RIGA ANCHE QUI (13/10/2026). Il Fuel
// Surcharge del consorzio Ecotyre, +5 €/t dal 01/10/2026 al 31/12/2026, vale
// anche sull'extra raccolta: SMOCO lo fattura a Ecotyre con una riga a parte,
// sulle stesse tonnellate degli interventi fatturati nel mese. Fino a oggi i due
// file ricevevano i soli prezzi e riportavano gli importi standard, e la pagina
// lo diceva accanto ai pulsanti; l'utente, il 13/10/2026 sera, ha accettato la
// proposta: la riga del Fuel Surcharge anche nei file Excel e PDF dell'elenco.
// - Nel riepilogo, dopo i sovracosti e prima del Totale imponibile, una riga
//   per surplus e per mese: il nome, l'importo da Ecotyre, e «t × €/t» col mese,
//   gli interventi fatturati, l'origine e il periodo. Il centesimo e' quello del
//   mese, come in fattura (surplusDelMese di extraRaccoltaCalc.js, arrotondato
//   una volta sui chili del mese), non la somma delle quote dei singoli
//   interventi; il Totale imponibile e' standard + surplus, cioe' la fattura.
// - I costi li vede solo l'amministratore (opzioni.isAdmin, e senza si nega):
//   l'analisi per produttore, coi costi e il margine, esce solo per lui. Li' il
//   surplus e' una riga sua sotto i produttori, col costo nella colonna della
//   sua prestazione (ai raccoglitori la raccolta) e il ricavo da Ecotyre; le
//   righe dei produttori restano lo standard di prima, e il TOTALE le somma
//   tutte: ricavi = Totale imponibile, costi = la passiva del mese. Prima del
//   13/10 l'analisi usciva a chiunque premesse il pulsante, mentre nella pagina
//   costi e margine li vede solo l'amministratore.
// - Senza surplus il file dell'amministratore e' quello di prima, cella per cella.
import { cifreItaliane } from '@/lib/formatoSoldi';
import { documentoDa, nuovaCartella, foglioDaRighe, scaricaCartella, FORMATI } from '@/lib/fogliProfessionali';
import { giornoRoma } from '@/lib/giornoItaliano';
import { calcExtraRaccolta, totaleRiga, aggregaPerProduttore, prezzoAttivoExtra, avvisoPesoMancante, surplusDelMese } from '@/lib/extraRaccoltaCalc';
import { baseSurplus, dettaglioSurplus, nomiSurplusDistinti } from '@/lib/surplusVista';

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

// Il mese di una riga del surplus, 'aaaa-mm', a parole: «Ottobre 2026».
const NOMI_MESI = Object.keys(MESI_UPPER);
const nomeDelMese = (mese) => `${NOMI_MESI[Number(String(mese).slice(5, 7)) - 1] || ''} ${String(mese).slice(0, 4)}`.trim();

// La colonna dei costi dell'analisi in cui va il surplus pagato, dalla sua
// prestazione: il Fuel Surcharge ai raccoglitori e' un costo di raccolta.
const COLONNA_DEL_SURPLUS = { RACCOLTA: 'raccolta', TRATTAMENTO: 'trattamento', CONFERIMENTO_STOCCAGGIO: 'stoccaggio', TRASPORTO_SECONDARIA: 'trasporto' };

// Le voci dell'analisi per produttore, nell'ordine delle colonne.
const VOCI_ANALISI = ['costi_aggiuntivi', 'raccolta', 'stoccaggio', 'trattamento', 'pulizia', 'trasporto', 'sovracosto_raccoglitore', 'sovracosto_impianto', 'costo_totale', 'ricavi', 'margine'];

// La forma della riga del surplus nel foglio, la stessa della passiva
// (passivaAmministrazioneExcel.js): fondo indaco chiaro, testo indaco scuro in
// corsivo, barra indaco a sinistra. Indaco e non ambra o rosso, che qui vogliono
// dire «c'e' un problema»: il surplus non lo e'.
const SURPLUS = 'FF6366F1';
const SURPLUS_CHIARO = 'FFEEF2FF';
const SURPLUS_SCURO = 'FF3730A3';

/**
 * LE RIGHE DEL SURPLUS DEL FILE, dal conto del mese (surplusDelMese).
 * - fattura: una per mese e per surplus con l'importo da Ecotyre, gia' al
 *   centesimo del mese: { mese, nome, euro_t, kg, importo, descrizione };
 * - analisi: una per mese e per surplus, attivo e passivo insieme, per l'analisi
 *   dell'amministratore: { nome, colonna, costo, ricavo }. Il costo e' la somma
 *   delle righe dei fornitori, ognuna al suo centesimo come in passiva; un
 *   fornitore interno non lo riceve. Un surplus senza la parte ai fornitori ha
 *   il costo null, non zero.
 * Due surplus con lo stesso nome nello stesso mese (un importo che cambia a
 * meta' mese) si distinguono con nomiSurplusDistinti; con piu' mesi nel file il
 * nome dell'analisi dice anche il mese (nel riepilogo lo dice la descrizione).
 */
function righeDelSurplus(conto) {
  const mesi = [...new Set([...conto.attivo, ...conto.passivo, ...conto.interni].map(v => v.mese))];
  const distinti = (voci) => {
    const nomi = new Map();
    for (const m of mesi) {
      const delMese = voci.filter(v => v.mese === m);
      nomiSurplusDistinti(delMese).forEach((n, i) => nomi.set(delMese[i], n));
    }
    return (v) => nomi.get(v) || v.nome;
  };

  // La descrizione dice su quali interventi vale: quelli fatturati del mese. Il
  // TOTALE QUANTITA' del riepilogo conta anche le secondarie, che non si
  // fatturano, e i mesi del file: «sulle stesse tonnellate degli interventi»,
  // scritto tre righe sotto un totale di 6.465 kg per un surplus su 4,465 t,
  // diceva una cosa che il foglio smentiva (revisione del 13/10/2026).
  const nomeFattura = distinti(conto.attivo);
  const fattura = conto.attivo.map(v => {
    const dettaglio = dettaglioSurplus(v);
    const quali = v.interventi === 1 ? "dell'intervento fatturato" : `dei ${cifreItaliane(v.interventi, 0, 0)} interventi fatturati`;
    return {
      mese: v.mese, nome: nomeFattura(v), nome_surplus: v.nome, euro_t: v.euro_t, kg: v.kg, importo: v.importo, dettaglio,
      descrizione: `Surplus di ${nomeDelMese(v.mese).toLowerCase()}: ${baseSurplus(v.kg, v.euro_t)}, sulle stesse tonnellate ${quali}${dettaglio ? ` · ${dettaglio}` : ''}`,
    };
  });

  const perRiga = new Map();
  const di = (v) => {
    const k = `${v.mese}|${v.surplus_id || v.chiave}`;
    if (!perRiga.has(k)) {
      perRiga.set(k, {
        mese: v.mese, nome: v.nome, euro_t_attiva: v.euro_t_attiva, euro_t_passiva: v.euro_t_passiva, dal: v.dal, al: v.al,
        colonna: COLONNA_DEL_SURPLUS[v.prestazione] || 'raccolta', ricavo: 0, costo: 0,
      });
    }
    return perRiga.get(k);
  };
  for (const v of conto.attivo) di(v).ricavo += v.importo;
  for (const v of conto.passivo) di(v).costo += v.importo;
  for (const v of conto.interni) di(v);
  // Le righe vanno per mese, poi per nome e per data d'inizio, come quelle della
  // fattura (l'ordine di surplusDelMese). Prese come venivano, prima tutti i
  // surplus con la parte da Ecotyre e poi quelli pagati solo ai fornitori, in un
  // file di ottobre e novembre un accordo solo passivo di ottobre finiva dopo il
  // Fuel Surcharge di novembre (revisione del 13/10/2026).
  const voci = [...perRiga.values()]
    .map(v => ({ ...v, ricavo: r2(v.ricavo), costo: v.euro_t_passiva === null || v.euro_t_passiva === undefined ? null : r2(v.costo) }))
    .filter(v => v.ricavo || v.costo)
    .sort((x, y) => x.mese.localeCompare(y.mese) || String(x.nome || '').localeCompare(String(y.nome || ''), 'it')
      || String(x.dal || '').localeCompare(String(y.dal || '')) || x.colonna.localeCompare(y.colonna));
  const nomeAnalisi = distinti(voci);
  const analisi = voci.map(v => ({
    nome: `Surplus · ${nomeAnalisi(v)}${mesi.length > 1 ? `, ${nomeDelMese(v.mese).toLowerCase()}` : ''}`,
    colonna: v.colonna, costo: v.costo, ricavo: v.ricavo,
  }));
  return { fattura, analisi };
}

/**
 * L'ANALISI PER PRODUTTORE, la stessa nell'Excel e nel PDF: le righe dei
 * produttori (lo standard), quelle del surplus e il TOTALE, ognuna come elenco
 * di celle nell'ordine di VOCI_ANALISI. Il totale somma i valori dei produttori
 * non arrotondati, come prima, e quelli del surplus, gia' al centesimo.
 */
function analisiPerProduttore(dati) {
  const tot = Object.fromEntries(VOCI_ANALISI.map(k => [k, 0]));
  const produttori = Object.entries(dati.per_produttore).map(([p, v]) => {
    for (const k of VOCI_ANALISI) tot[k] += v[k];
    return [p, ...VOCI_ANALISI.map(k => r2(v[k]))];
  });
  const surplus = dati.surplus_analisi.map(s => {
    const valori = Object.fromEntries(VOCI_ANALISI.map(k => [k, null]));
    valori[s.colonna] = s.costo;
    valori.costo_totale = s.costo || 0;
    valori.ricavi = s.ricavo;
    valori.margine = r2(s.ricavo - (s.costo || 0));
    for (const k of VOCI_ANALISI) tot[k] += valori[k] || 0;
    return [s.nome, ...VOCI_ANALISI.map(k => valori[k])];
  });
  return {
    produttori, surplus,
    totale: ['TOTALE', ...VOCI_ANALISI.map(k => r2(tot[k]))],
    margine_perc: tot.ricavi !== 0 ? r2((tot.margine / tot.ricavi) * 100) : 0,
  };
}

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
 * IL SURPLUS (13/10/2026). Col contesto della pagina arrivano anche i surplus
 * dell'extra raccolta. Il ricavo che si somma qui e' lo standard
 * (ricavo_standard), e il surplus si aggiunge col centesimo del mese
 * (surplusDelMese), una riga per mese e per surplus, come in fattura: sommando
 * le quote dei singoli interventi il Fuel Surcharge di ottobre farebbe 22,34
 * invece dei 22,33 della fattura. L'analisi per produttore resta sullo standard
 * (il contesto senza surplus) e il surplus ci entra con le sue righe.
 *
 * Torna { righe: [{ record, kg, prezzo, totale }], totale_kg, sovracosto_raccolta,
 * sovracosto_trasporto, sovracosto_trattamento, surplus: [{ mese, nome, euro_t,
 * kg, importo, descrizione }], totale_standard, totale_surplus, totale_imponibile,
 * senza_peso, per_produttore, surplus_analisi: [{ nome, colonna, costo, ricavo }] }.
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
      imponibile += c.ricavo_standard;
    }
    if (c.senza_peso) senzaPeso.push({ numero_fir: r.numero_fir || r.id_ordine || '', avviso: avvisoPesoMancante(r) });
    righe.push({ record: r, kg: c.senza_peso ? null : c.kg, prezzo: prezzoRiga(r, contesto), totale: totaleRiga(r, contesto) });
  }
  // I prezzi della pagina senza i surplus: le righe dei produttori sono lo standard.
  const soloPrezzi = contesto ? { ...contesto, surplus: [] } : contesto;
  const { fattura, analisi } = righeDelSurplus(surplusDelMese(elenco, contesto));
  const totaleStandard = r2(imponibile);
  const totaleSurplus = r2(fattura.reduce((s, v) => s + v.importo, 0));
  return {
    righe,
    totale_kg: totKg,
    sovracosto_raccolta: r2(sovraRaccolta),
    sovracosto_trasporto: r2(sovraTrasporto),
    sovracosto_trattamento: r2(sovraTrattamento),
    surplus: fattura,
    totale_standard: totaleStandard,
    totale_surplus: totaleSurplus,
    totale_imponibile: totaleSurplus ? r2(totaleStandard + totaleSurplus) : totaleStandard,
    senza_peso: senzaPeso,
    per_produttore: aggregaPerProduttore(elenco, soloPrezzi),
    surplus_analisi: analisi,
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
  // Il surplus da Ecotyre (13/10/2026): una riga per mese e per surplus, prima
  // del Totale imponibile che la comprende. La descrizione sta nella terza
  // colonna, che nel riepilogo e' vuota.
  const iSurplus = [];
  for (const s of dati.surplus) { iSurplus.push(wsData.length); wsData.push([s.nome, s.importo, s.descrizione]); }
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
  // L'analisi ha i costi e il margine: solo all'amministratore (13/10/2026). Il
  // surplus ci sta con le sue righe, sotto i produttori (analisiPerProduttore).
  const conCosti = opzioni.isAdmin === true;
  let iAnalisi = Infinity;
  const iSurplusAnalisi = [];
  if (conCosti) {
    wsData.push([]);
    iAnalisi = wsData.length;
    wsData.push(['PRODUTTORE', 'costi aggiuntivi', 'raccolta', 'stoccaggio', 'trattamento', 'pulizia', 'trasporto', 'sovracosto raccoglitore', 'sovracosto impianto', 'costo totale', 'ricavi', 'margine']);
    const analisi = analisiPerProduttore(dati);
    for (const r of analisi.produttori) wsData.push(r);
    for (const r of analisi.surplus) { iSurplusAnalisi.push(wsData.length); wsData.push(r); }
    wsData.push(analisi.totale);
    wsData.push([]);
    wsData.push(['Margine % complessivo', `${cifreItaliane(analisi.margine_perc, 2, 2)}%`]);
  }

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
  const ws = foglioDaRighe(wb, sheetName, {
    doc, righe: wsData, testate: conCosti ? [0, iAnalisi] : [0], formati,
    stili: { ...Object.fromEntries(avvisi.map(i => [i, 'avviso'])), ...(conCosti ? { [wsData.length - 1]: 'gruppo' } : {}) },
    larghezze: [24, 30, 28, 28, 14, 14, 14, 18, 14, 14, 14, 14],
  });
  // Le righe del surplus si vestono dopo: foglioDaRighe scrive una riga del
  // foglio per ogni riga dell'elenco, sotto il blocco di testa.
  const testa = ws.rowCount - wsData.length;
  const quante = Math.max(1, ...wsData.map(r => r.length));
  for (const i of [...iSurplus, ...iSurplusAnalisi]) vestiRigaSurplus(ws.getRow(testa + i + 1), quante);
  return scaricaCartella(wb, `SMOCO-Fatturazione EXTRA RACCOLTA ${mese} ${anno}.xlsx`);
}

/** La riga del surplus nel foglio: fondo indaco chiaro, testo indaco scuro in corsivo, barra a sinistra. */
function vestiRigaSurplus(riga, quante) {
  for (let c = 1; c <= quante; c++) {
    const cella = riga.getCell(c);
    cella.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SURPLUS_CHIARO } };
    cella.font = { ...(cella.font || {}), italic: true, color: { argb: SURPLUS_SCURO } };
  }
  const prima = riga.getCell(1);
  prima.border = { ...(prima.border || {}), left: { style: 'thick', color: { argb: SURPLUS } } };
}


export async function exportExtraRaccoltaPDF(records, mese, anno, contesto, opzioni = {}) {
  const dati = datiExportExtra(records, contesto);
  // Le stesse tre aree dell'Excel, con la veste del PDF della passiva: il
  // riepilogo nei riquadri in alto, gli interventi, l'analisi per produttore e,
  // in coda, le schede senza peso da sistemare.
  // Il surplus (13/10/2026): nei riquadri, prima del Totale imponibile, il suo
  // importo da Ecotyre; sotto gli interventi, la tabella delle sue righe (mese,
  // origine e periodo, tonnellate, €/t, importo), le stesse del riepilogo
  // dell'Excel. L'analisi per produttore, coi costi e il margine, solo
  // all'amministratore, col surplus nelle sue righe.
  const conCosti = opzioni.isAdmin === true;
  const sezioneAnalisi = () => {
    const a = analisiPerProduttore(dati);
    const voci = VOCI_ANALISI;
    return {
      titolo: 'ANALISI MARGINE PER PRODUTTORE',
      colonne: [
        { titolo: 'PRODUTTORE', tipo: 'testo', peso: 2 },
        ...['costi agg.', 'raccolta', 'stoccaggio', 'trattamento', 'pulizia', 'trasporto', 'sovr. raccogl.', 'sovr. impianto', 'costo tot.', 'ricavi', 'margine'].map(t => ({ titolo: t, tipo: 'euro', peso: 1 })),
      ],
      righe: [
        ...a.produttori.map(celle => ({ celle })),
        ...a.surplus.map(celle => ({ celle })),
        { stile: 'totale', celle: a.totale },
        { stile: 'gruppo', celle: ['Margine % complessivo', ...voci.map(() => null).slice(1), `${cifreItaliane(a.margine_perc, 2, 2)}%`] },
      ],
    };
  };
  // Un riquadro solo per il surplus, col totale: le righe (piu' mesi, un importo
  // che cambia a meta' mese, piu' surplus) stanno nella tabella qui sotto. Il
  // riquadro dice il nome se e' uno e ci sta (l'etichetta non va a capo, e un
  // nome lungo finirebbe sopra il riquadro accanto).
  const nomiSurplus = [...new Set(dati.surplus.map(s => s.nome_surplus))];
  const etichettaSurplus = nomiSurplus.length === 1 && `Surplus · ${nomiSurplus[0]}`.length <= 32 ? `Surplus · ${nomiSurplus[0]}` : 'Surplus sulle tariffe';
  // Le tonnellate sono le stesse degli interventi fatturati qui sopra (non le
  // secondarie, che il riquadro dei chili conta): si leggono, non si sommano (nel
  // totale del surplus restano vuote).
  const sezioneSurplus = {
    titolo: 'SURPLUS SULLE TARIFFE: RIGA A PARTE IN FATTURA, SULLE STESSE TONNELLATE FATTURATE',
    colonne: [
      { titolo: 'VOCE', tipo: 'testo', peso: 1.6 }, { titolo: 'MESE', tipo: 'testo', peso: 0.9 }, { titolo: 'ORIGINE E PERIODO', tipo: 'testo', peso: 2.6 },
      { titolo: 'TONNELLATE', tipo: 't', peso: 0.9 }, { titolo: 'PREZZO (Euro/ton)', tipo: 'prezzoLibero', peso: 0.9 }, { titolo: 'IMPORTO (Euro)', tipo: 'euro', peso: 0.9 },
    ],
    righe: [
      ...dati.surplus.map(s => ({ celle: [`Surplus · ${s.nome}`, nomeDelMese(s.mese), s.dettaglio || null, s.kg / 1000, s.euro_t, s.importo] })),
      ...(dati.surplus.length > 1 ? [{ stile: 'totale', celle: ['Totale surplus', null, null, null, null, dati.totale_surplus] }] : []),
    ],
  };

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
      ...(dati.surplus.length ? [{ etichetta: etichettaSurplus, valore: dati.totale_surplus, tipo: 'euro' }] : []),
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
      ...(dati.surplus.length ? [sezioneSurplus] : []),
      ...(conCosti ? [sezioneAnalisi()] : []),
    ],
    note: dati.senza_peso.map(x => x.avviso),
    titoloNote: TITOLO_SENZA_PESO,
  });
}
