// Il foglio DICHIARAZIONI intero, esportato dal gestionale (22/09/2026).
//
// Il foglio vero sta nel file di gestione, sul computer dell'utente: in alto un
// riepilogo con una colonna per mese (righe IRIGOM ed EXTRA RACCOLTA), sotto i
// blocchi dei mesi uno in coda all'altro. Da fuori quel computer il file non
// c'e': qui il foglio si rifa' con quello che il gestionale sa, cioe' le
// PraticaIrigom registrate e le DichiarazioneSito del sito.
//
// Quello che il gestionale non ha non si inventa: i mesi preparati prima che il
// gestionale esistesse non hanno una pratica, e il secondo foglio li elenca uno
// per uno dicendo che il blocco manca. Un mese con la sola dichiarazione compare
// nel riepilogo col suo totale, senza blocco sotto, e la cella e' arancione
// perche' si veda a colpo d'occhio che non viene da righe.
//
// Le righe di un mese le fa righeBlocco (bloccoGestione.js): sono le stesse che
// si incollano nel file dell'utente. Qui prendono anche i colori e
// l'allineamento dei mesi gia' nel foglio - letti sul blocco di agosto 2026 -
// con exceljs, come excelDelMese in documentiIrigom.js.

import { MESI, migliaia } from './praticaIrigom.js';
import { datiFileGestione, dataIt } from './documentiIrigom.js';
import { righeBlocco } from './bloccoGestione.js';

const kg = (v) => migliaia(v);
const intero = (n) => Math.round(Number(n) || 0);
const elenco = (v) => (Array.isArray(v) ? v : []);
const somma = (righe, f) => righe.reduce((s, r) => s + f(r), 0);

// I colori del foglio dell'utente, letti sul blocco di agosto 2026.
const VERDE_TITOLO = 'FF00B050';
const VERDE_TESTA = 'FF92D050';
const VERDE_SCRITTO = 'FF70AF47'; // nel riepilogo: le celle della dichiarazione prodotta
const AZZURRO = 'FF99CCFF';
const GIALLO = 'FFFFFF00';
const ROSSO = 'FFFF0000';
const ARANCIO = 'FFFFC000'; // nel riepilogo: totale senza blocco sotto
const KG = '#,##0';
const TONN = '#,##0.00';

const riempi = (c, argb) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }; };
const bordi = (c) => { c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }; };
const centra = (c, wrap = false) => { c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: wrap }; };

// Il riepilogo sta in alto, i blocchi cominciano quattro righe piu' sotto.
const RIGA_EXTRA = 2;
const RIGA_IRIGOM = 3;
const PRIMA_RIGA_BLOCCO = 8;
const RIGHE_FRA_BLOCCHI = 4; // le quattro righe vuote fra un mese e l'altro
/** La colonna del mese nel riepilogo: C, E, G... accanto a ognuna la sua CARICATA\INVIATA. */
const colonnaMese = (i) => 3 + i * 2;
/** La lettera di una colonna, per le formule del riepilogo. */
const lettera = (n) => (n > 26 ? String.fromCharCode(64 + Math.floor((n - 1) / 26)) : '') + String.fromCharCode(65 + ((n - 1) % 26));

// Le formule di righeBlocco sono relative al blocco (=SUM(F6:F9), con le righe
// contate dal suo inizio) e non escono mai da li': quando il blocco finisce piu'
// in basso basta sommare lo scostamento a ogni numero di riga. I numeri che non
// hanno una colonna davanti (il 38000 del limite) restano quelli che sono.
const sposta = (f, delta) => String(f).replace(/(\$?[A-Z]{1,2}\$?)(\d+)/g, (t, col, r) => `${col}${Number(r) + delta}`);

/**
 * I dati del blocco di un mese da una PraticaIrigom salvata.
 * @param {object} pratica il record PraticaIrigom: dati_json porta la pratica composta
 * @returns {object|null} gli stessi dati di datiFileGestione, null se la pratica
 *          non porta la pratica composta (allora il mese si dice mancante)
 */
export function bloccoDaPratica(pratica) {
  if (!pratica) return null;
  let composta = null;
  let nave = {};
  try { composta = JSON.parse(pratica.dati_json || 'null'); } catch (e) { composta = null; }
  try { nave = JSON.parse(pratica.nave_json || '{}') || {}; } catch (e) { nave = {}; }
  if (!composta || typeof composta !== 'object') return null;
  // Una pratica vecchia puo' non avere tutti i pezzi: i vuoti si riempiono, cosi'
  // il blocco esce lo stesso con quello che c'e', invece di non uscire affatto.
  return datiFileGestione({
    pratica: {
      ferro: { tabella: elenco(composta.ferro && composta.ferro.tabella) },
      cssc: { righe: elenco(composta.cssc && composta.cssc.righe) },
      terziarie: { righe: elenco(composta.terziarie && composta.terziarie.righe) },
      extra: composta.extra || null,
      portale_kg: intero(composta.portale_kg),
    },
    contesto: { anno: pratica.anno, mese: pratica.mese, nave },
  });
}

/** La pratica che vale per un mese: l'ultima versione non sostituita. */
function praticaDelMese(pratiche, anno, mese) {
  return pratiche
    .filter(p => p && Number(p.anno) === anno && p.mese === mese && p.stato !== 'sostituita')
    .sort((a, b) => (b.versione || 1) - (a.versione || 1))[0] || null;
}

/** La dichiarazione che vale per un mese e un canale: prima quella caricata a portale. */
function dichiarazioneDelMese(dichiarazioni, anno, mese, canale) {
  const sue = dichiarazioni.filter(d => d && Number(d.anno) === anno && d.mese === mese && d.canale === canale);
  return {
    scelta: sue.sort((a, b) => (b.caricata_inviata ? 1 : 0) - (a.caricata_inviata ? 1 : 0) || intero(b.quantita_kg) - intero(a.quantita_kg))[0] || null,
    quante: sue.length,
  };
}

/** Quando la pratica e' stata fatta: la registrazione, o l'ultima modifica. */
const quando = (p) => dataIt(p && (p.registrata_il || p.updated_date || p.created_date));

/** Scrive il blocco di un mese e dice dove sono finite le righe che servono al riepilogo. */
function scriviBlocco(ws, dati, riga0) {
  const { righe, indice } = righeBlocco(dati);
  const delta = riga0 - 1;
  let sezione = '';
  righe.forEach((riga, i) => {
    const r = i + 1; // la riga dentro al blocco, come la conta indice
    const rf = riga0 + i; // la riga nel foglio
    const primo = String((riga || [])[0] ?? '');
    const testa = primo === 'DATA' || (primo === 'DDT' && riga[9] === 'TRATTAMENTO') || primo === 'ORDINE TERZIARIA';
    // I titoli non portano bordi, le righe di dati si': come nel foglio dell'utente.
    const titolo = r === 1 || primo.startsWith('Dichiarazione CER') || primo.startsWith('per il mese di') || primo.startsWith('EXTRA RACCOLTA DA DICHIARARE');
    if (primo === 'DATA') sezione = 'ferro';
    else if (primo === 'DDT') sezione = sezione === 'nota_extra' ? 'extra' : 'cssc';
    else if (primo === 'ORDINE TERZIARIA') sezione = 'terziarie';
    else if (primo.startsWith('per il mese di')) sezione = 'nota_extra';

    (riga || []).forEach((valore, c) => {
      if (valore === null || valore === undefined || valore === '') return;
      const cella = ws.getCell(rf, c + 1);
      if (typeof valore === 'object') {
        if (valore.f) cella.value = { formula: sposta(valore.f, delta) };
        else cella.value = valore.v;
        // la data e' un numero di Excel: e' il formato a farla vedere come data
        if (valore.z) cella.numFmt = valore.z;
        else cella.numFmt = KG;
      } else if (typeof valore === 'number') {
        cella.value = valore;
        cella.numFmt = KG;
      } else {
        cella.value = valore;
      }
      centra(cella, testa);
      if (testa || (!titolo && ['ferro', 'cssc', 'extra', 'terziarie'].includes(sezione))) bordi(cella);
    });

    // I colori e i corpi del carattere sono quelli dei mesi gia' nel foglio.
    if (r === 1) {
      for (let c = 1; c <= 10; c++) {
        const cella = ws.getCell(rf, c);
        riempi(cella, VERDE_TITOLO);
        cella.font = { bold: true, size: c === 1 ? 24 : 16 };
        centra(cella);
      }
      ws.getRow(rf).height = 32;
    } else if (primo === 'Dichiarazione CER191202') {
      ws.mergeCells(rf, 1, rf, 2);
      const cella = ws.getCell(rf, 1);
      riempi(cella, ROSSO);
      cella.font = { bold: true };
      centra(cella);
    } else if (primo === 'Dichiarazione CER191204') {
      const cella = ws.getCell(rf, 1);
      riempi(cella, GIALLO);
      cella.font = { bold: true };
      centra(cella);
    } else if (primo.startsWith('per il mese di')) {
      ws.mergeCells(rf, 1, rf, 3);
      const cella = ws.getCell(rf, 1);
      riempi(cella, GIALLO);
      cella.font = { bold: true, size: 14 };
      centra(cella);
      bordi(cella);
    } else if (primo.startsWith('EXTRA RACCOLTA DA DICHIARARE')) {
      const cella = ws.getCell(rf, 1);
      riempi(cella, GIALLO);
      cella.font = { bold: true, color: { argb: ROSSO } };
      centra(cella);
      bordi(cella);
    } else if (testa) {
      const quante = primo === 'ORDINE TERZIARIA' ? 12 : riga.length;
      for (let c = 1; c <= quante; c++) {
        const cella = ws.getCell(rf, c);
        riempi(cella, primo === 'DATA' ? AZZURRO : VERDE_TESTA);
        cella.font = { bold: true, size: primo === 'DATA' ? 12 : 11 };
        centra(cella, true);
        bordi(cella);
      }
    } else if (r === indice.totale_ferro || r === indice.totale_cssc || r === indice.totale_terziarie) {
      // Nel file di agosto il totale delle terziarie non e' in grassetto: qui lo
      // e' come gli altri due, che un totale si veda e' meglio che sia uguale.
      const grande = r === indice.totale_ferro;
      for (let c = 1; c <= 13; c++) {
        const cella = ws.getCell(rf, c);
        if (cella.value === null || cella.value === undefined) continue;
        cella.font = { bold: true, size: grande ? 14 : 11, color: { argb: ROSSO } };
        centra(cella);
        bordi(cella);
      }
      if (grande) riempi(ws.getCell(rf, 7), GIALLO); // la quota del ferro, evidenziata
    } else if (sezione === 'terziarie' && riga[8] !== undefined && riga[8] !== null) {
      riempi(ws.getCell(rf, 9), GIALLO); // CIPP / CIAB, evidenziato come nel foglio
    }
  });
  return {
    prima: riga0,
    ultima: riga0 + righe.length - 1,
    totale_cssc: indice.totale_cssc ? indice.totale_cssc + delta : 0,
    totale_terziarie: indice.totale_terziarie ? indice.totale_terziarie + delta : 0,
  };
}

/** Il riepilogo in alto: una colonna per mese, righe IRIGOM ed EXTRA RACCOLTA. */
function scriviRiepilogo(ws, mesi) {
  const capo = (c, v, colore) => {
    const cella = ws.getCell(1, c);
    cella.value = v;
    cella.font = { bold: true };
    centra(cella, true);
    if (colore) riempi(cella, colore);
  };
  capo(1, 'TOTALE', null);
  capo(2, 'IMPIANTO', GIALLO);
  mesi.forEach((m, i) => {
    capo(colonnaMese(i), m.mese, GIALLO);
    capo(colonnaMese(i) + 1, 'CARICATA\\INVIATA', null);
  });
  for (const [riga, nome] of [[RIGA_EXTRA, 'EXTRA RACCOLTA'], [RIGA_IRIGOM, 'IRIGOM']]) {
    const cella = ws.getCell(riga, 2);
    cella.value = nome;
    cella.font = { bold: true };
    centra(cella);
  }

  mesi.forEach((m, i) => {
    const col = colonnaMese(i);
    const irigom = ws.getCell(RIGA_IRIGOM, col);
    // Come nel file dell'utente: IRIGOM = totale CSS-C + totale terziarie, letti
    // dalle righe del blocco di questo mese, qui sotto. Un mese di soli metalli
    // ferrosi non ha ne' l'uno ne' l'altro: a portale non si carica nulla e la
    // colonna resta vuota, quel ferro se ne va con la dichiarazione del mese in
    // cui riparte la gomma (regola dell'utente del 22/09/2026).
    const parti = [];
    if (m.blocco && m.posizioni.totale_cssc) parti.push(`I${m.posizioni.totale_cssc}`);
    if (m.blocco && m.posizioni.totale_terziarie) parti.push(`K${m.posizioni.totale_terziarie}`);
    if (parti.length) {
      irigom.value = { formula: parti.join('+'), result: m.irigom_kg };
      riempi(irigom, VERDE_SCRITTO);
    } else if (!m.blocco && m.rete && intero(m.rete.quantita_kg) > 0) {
      // Senza blocco resta il solo totale della dichiarazione: e' il totale a
      // portale, extra raccolta compresa, non la somma di righe che qui non ci sono.
      irigom.value = intero(m.rete.quantita_kg);
      riempi(irigom, ARANCIO);
    }
    irigom.numFmt = KG;
    centra(irigom);

    const extra = ws.getCell(RIGA_EXTRA, col);
    if (m.extra_kg) {
      extra.value = m.extra_kg;
      riempi(extra, VERDE_SCRITTO);
    } else if (m.extraDich && intero(m.extraDich.quantita_kg) > 0) {
      extra.value = intero(m.extraDich.quantita_kg);
      riempi(extra, ARANCIO);
    }
    extra.numFmt = KG;
    centra(extra);

    for (const [riga, dich] of [[RIGA_EXTRA, m.extraDich], [RIGA_IRIGOM, m.rete]]) {
      if (!dich || !dich.caricata_inviata) continue;
      const cella = ws.getCell(riga, col + 1);
      cella.value = 'SI';
      centra(cella);
    }
  });

  // Il totale dell'anno in tonnellate, come nel file: contano solo i mesi
  // caricati a portale, cioe' quelli con SI accanto.
  for (const riga of [RIGA_EXTRA, RIGA_IRIGOM]) {
    const parti = mesi.map((m, i) => `(IF(${lettera(colonnaMese(i) + 1)}${riga}="SI",${lettera(colonnaMese(i))}${riga},0))`);
    const cella = ws.getCell(riga, 1);
    cella.value = { formula: `SUM(${parti.join(',')})/1000` };
    cella.numFmt = TONN;
    cella.font = { bold: true };
    centra(cella);
  }
}

/** Il secondo foglio: che cosa c'e', da quale pratica, e che cosa manca. */
function scriviMesi(ws, mesi, anno) {
  ws.columns = [{ width: 14 }, { width: 12 }, { width: 16 }, { width: 10 }, { width: 16 }, { width: 14 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 15 }, { width: 15 }, { width: 11 }, { width: 90 }];
  ws.addRow([`Dichiarazioni Irigom ${anno}: che cosa c'e' in questo foglio`]).font = { bold: true, size: 14 };
  ws.addRow(['Il riepilogo e i blocchi vengono dalle pratiche registrate nel gestionale. I mesi preparati prima che il gestionale esistesse non ci sono: sotto sono elencati, e il loro blocco sta solo nel file di gestione.']);
  ws.addRow([]);
  const testa = ws.addRow(['Mese', 'Blocco', 'Righe', 'Versione', 'Stato', 'Preparata il', 'CSS-C (kg)', 'Terziarie (kg)', 'IRIGOM (kg)', 'Extra (kg)', 'A portale (kg)', 'Dichiarata (kg)', 'Caricata', 'Nota']);
  testa.eachCell((c) => { c.font = { bold: true }; riempi(c, VERDE_TESTA); centra(c, true); bordi(c); });
  for (const m of mesi) {
    const riga = ws.addRow([
      m.mese,
      m.blocco ? 'si' : 'no',
      m.blocco ? `${m.posizioni.prima}-${m.posizioni.ultima}` : '',
      m.pratica ? (m.pratica.versione || 1) : '',
      m.pratica ? (m.pratica.stato || '') : '',
      m.pratica ? quando(m.pratica) : '',
      m.blocco ? m.cssc_kg : '',
      m.blocco ? m.terziarie_kg : '',
      m.blocco ? m.irigom_kg : '',
      m.extra_kg || '',
      m.blocco ? m.portale_kg : '',
      m.rete ? intero(m.rete.quantita_kg) : '',
      m.rete && m.rete.caricata_inviata ? 'si' : '',
      m.note.join(' '),
    ]);
    [7, 8, 9, 10, 11, 12].forEach(c => { riga.getCell(c).numFmt = KG; });
    riga.getCell(14).alignment = { wrapText: true, vertical: 'top' };
    if (!m.blocco) riempi(riga.getCell(2), m.rete || m.extraDich ? ARANCIO : GIALLO);
  }
}

/**
 * Il foglio DICHIARAZIONI di un anno, come file .xlsx: il riepilogo in alto, i
 * blocchi dei mesi sotto separati da quattro righe vuote, e un secondo foglio
 * con quello che c'e' e quello che manca.
 * @param {object} p
 * @param {array} p.pratiche      le PraticaIrigom (tutte: qui si scelgono l'anno e l'ultima versione)
 * @param {array} p.dichiarazioni le DichiarazioneSito del sito Irigom
 * @param {number} p.anno
 * @returns {Promise<Uint8Array>}
 */
export async function esportaFoglioDichiarazioni({ pratiche = [], dichiarazioni = [], anno }) {
  const modulo = await import('exceljs');
  const ExcelJS = modulo.default || modulo;
  const quale = Number(anno);

  const mesi = MESI.map((mese) => {
    const pratica = praticaDelMese(pratiche, quale, mese);
    const blocco = bloccoDaPratica(pratica);
    const rete = dichiarazioneDelMese(dichiarazioni, quale, mese, 'RETE');
    const extraDich = dichiarazioneDelMese(dichiarazioni, quale, mese, 'EXTRA_RACCOLTA');
    const cssc_kg = blocco ? somma(elenco(blocco.cssc), r => intero(r.cssc_kg) + intero(r.ferro_kg)) : 0;
    const terziarie_kg = blocco ? somma(elenco(blocco.terziarie), r => intero(r.cippato_kg) + intero(r.ferro_kg)) : 0;
    return {
      mese, pratica, blocco,
      rete: rete.scelta, extraDich: extraDich.scelta, quante_rete: rete.quante, quante_extra: extraDich.quante,
      cssc_kg, terziarie_kg,
      irigom_kg: cssc_kg + terziarie_kg,
      extra_kg: blocco && blocco.extra ? intero(blocco.extra.totale_kg) : 0,
      portale_kg: blocco ? intero(blocco.totale_portale_kg) : 0,
      posizioni: null,
      note: [],
    };
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Gestionale PFU';
  wb.created = new Date();
  const ws = wb.addWorksheet('DICHIARAZIONI');
  // Le larghezze del foglio dell'utente: A e B per i nomi, poi le coppie
  // mese / CARICATA\INVIATA, che sono anche le colonne dei blocchi.
  ws.columns = [{ width: 45 }, { width: 41 }].concat(MESI.flatMap(() => [{ width: 24 }, { width: 28 }]));

  let riga = PRIMA_RIGA_BLOCCO;
  for (const m of mesi) {
    if (!m.blocco) continue;
    m.posizioni = scriviBlocco(ws, m.blocco, riga);
    riga = m.posizioni.ultima + 1 + RIGHE_FRA_BLOCCHI;
  }
  scriviRiepilogo(ws, mesi);

  // Le note: che cosa c'e', che cosa manca e che cosa va guardato a mano.
  for (const m of mesi) {
    if (m.blocco) {
      m.note.push(`Blocco alle righe ${m.posizioni.prima}-${m.posizioni.ultima} del foglio DICHIARAZIONI.`);
      if (m.pratica && typeof m.pratica.rete_kg === 'number' && intero(m.pratica.rete_kg) !== m.irigom_kg) {
        m.note.push(`La pratica dice ${kg(m.pratica.rete_kg)} kg di rete, il blocco ne somma ${kg(m.irigom_kg)}: la differenza va guardata a mano.`);
      }
      if (m.extra_kg) {
        const dei = [...new Set(elenco(m.blocco.extra && m.blocco.extra.formulari).map(f => MESI[Number(String(f.fine_trasporto || '').slice(5, 7)) - 1]).filter(Boolean))];
        m.note.push(`Extra raccolta ${kg(m.extra_kg)} kg${m.blocco.extra.terziaria ? ` nella terziaria ${m.blocco.extra.terziaria}` : ''}: qui sta nella colonna di ${m.mese}, il mese in cui si dichiara${dei.length ? `, e i formulari sono di ${dei.join(' e ')}` : ''}. Va contata una volta sola.`);
      }
      if (m.rete && intero(m.rete.quantita_kg) && intero(m.rete.quantita_kg) !== m.portale_kg) {
        m.note.push(`La dichiarazione a portale dice ${kg(m.rete.quantita_kg)} kg, la pratica ${kg(m.portale_kg)}.`);
      }
    } else if (m.rete || m.extraDich) {
      m.note.push(`Il gestionale non ha la pratica di ${m.mese}: nel riepilogo c'e' il solo totale della dichiarazione (${kg((m.rete && m.rete.quantita_kg) || 0)} kg a portale, extra raccolta compresa), il blocco con le righe manca e sta solo nel file di gestione.`);
    } else {
      m.note.push(`Di ${m.mese} il gestionale non ha ne' la pratica ne' la dichiarazione: se il mese e' stato preparato, il blocco sta solo nel file di gestione.`);
    }
    if (m.pratica && m.pratica.stato === 'in_preparazione') m.note.push('La pratica e\' ancora in preparazione: non e\' stata registrata.');
    if (m.pratica && !m.blocco) m.note.push('La pratica c\'e\' ma non porta i dati per rifare le righe: e\' di una versione vecchia del gestionale.');
    if (m.quante_rete > 1) m.note.push(`Ci sono ${m.quante_rete} dichiarazioni di rete per questo mese: qui vale quella caricata a portale.`);
    if (m.quante_extra > 1) m.note.push(`Ci sono ${m.quante_extra} dichiarazioni di extra raccolta per questo mese: qui vale quella caricata a portale.`);
    if (m.rete && m.rete.motivo_assenza) m.note.push(`Mese senza dichiarazione, ed e' a posto: ${m.rete.motivo_assenza === 'solo_metalli' ? 'sono usciti solo metalli ferrosi' : 'il trattamento non e\' a nostro carico'}.`);
  }
  scriviMesi(wb.addWorksheet('Mesi', { views: [{ showGridLines: false }] }), mesi, quale);

  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
