// I documenti della pratica mensile di Irigom: i Word delle dichiarazioni, il
// riepilogo Excel col blocco del mese e la cartella da mettere nel repository.
//
// I Word nascono dai MODELLI: i documenti di agosto 2026 (luglio per il CSS-C)
// con i valori che cambiano sostituiti da {{SEGNAPOSTO}} e le tabelle a righe
// variabili da un paragrafo con il solo {{TABELLA_...}}. Carta intestata, firma
// e testo restano quelli del modello. Le tabelle si scrivono come le ho scritte
// ad agosto (Calibri 8, bordi sottili, intestazione verde, colonne evidenziate
// in giallo, totali in rosso grassetto), verificate byte per byte sui documenti
// consegnati.
//
// Il Word si converte in PDF da Word ("Salva con nome", PDF): nel browser non
// c'e' un modo di farlo che tenga carta intestata e firma cosi' come sono.

import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { MESI, MAX_PER_DICHIARAZIONE_KG, migliaia } from './praticaIrigom.js';

const kg = (v) => migliaia(v);
export const dataIt = (g) => (g ? String(g).slice(0, 10).split('-').reverse().join('/') : '');
const scappa = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const meseAnno = (mese, anno) => `${mese} ${anno}`;
export const meseAnnoMinuscolo = (mese, anno) => `${String(mese).toLowerCase()} ${anno}`;

// ---------------------------------------------------------------------------
// Le tabelle Word

/**
 * Una tabella Word. Una cella puo' essere un valore o { v, grassetto, colore }.
 * stile: { intestazione, testoIntestazione, evidenzia: [colonne], sfondoEvidenza }
 */
export function tabellaWord(intestazioni, righe, larghezze, stile = {}) {
  const bordo = (b) => `<w:${b} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`;
  const cella = (dato, i, capo) => {
    const o = dato && typeof dato === 'object' ? dato : { v: dato };
    const testo = o.v === null || o.v === undefined ? '' : String(o.v);
    const numero = /^-?[\d.,]+$/.test(testo);
    const grassetto = capo || o.grassetto;
    const colore = capo ? stile.testoIntestazione : o.colore;
    const sfondo = capo ? (stile.intestazione || '92D050') : ((stile.evidenzia || []).includes(i) ? (stile.sfondoEvidenza || 'FFFF00') : '');
    const rPr = `<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="16"/>${grassetto ? '<w:b/>' : ''}${colore ? `<w:color w:val="${colore}"/>` : ''}</w:rPr>`;
    return `<w:tc><w:tcPr><w:tcW w:w="${larghezze[i]}" w:type="dxa"/><w:tcBorders>${['top', 'left', 'bottom', 'right'].map(bordo).join('')}</w:tcBorders>`
      + `${sfondo ? `<w:shd w:val="clear" w:color="auto" w:fill="${sfondo}"/>` : ''}<w:vAlign w:val="center"/></w:tcPr>`
      + `<w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="${!capo && numero ? 'right' : 'center'}"/>${rPr}</w:pPr>`
      + `<w:r>${rPr}<w:t xml:space="preserve">${scappa(testo)}</w:t></w:r></w:p></w:tc>`;
  };
  const riga = (celle, capo) => `<w:tr>${capo ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${celle.map((c, i) => cella(c, i, capo)).join('')}</w:tr>`;
  return `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="${larghezze.reduce((a, b) => a + b, 0)}" w:type="dxa"/><w:jc w:val="center"/>`
    + `<w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(bordo).join('')}</w:tblBorders>`
    + `<w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${larghezze.map(x => `<w:gridCol w:w="${x}"/>`).join('')}</w:tblGrid>`
    + riga(intestazioni, true) + righe.map(r => riga(r, false)).join('') + '</w:tbl>';
}

const rosso = (v) => ({ v: kg(v), grassetto: true, colore: 'C00000' });
const TOT = { v: 'TOTALE', grassetto: true };

const TERZIARIE = {
  intestazioni: ['ORDINE TERZIARIA', 'PRODUTTORE', 'TRASPORTATORE', 'DESTINATARIO', 'Nr. ALLEGATO VII', 'PESO [Kg]', 'DATA TRASPORTO', 'DATA CONFERIMENTO', 'CIPP / CIAB', 'EER 19.12.02', 'TOTALE'],
  larghezze: [1700, 1250, 1600, 1400, 1000, 1100, 1350, 1450, 1200, 1200, 1250],
  stile: { intestazione: '92D050', evidenzia: [8], sfondoEvidenza: 'FFFF00' },
};
const rigaTerziaria = (r, cippato, ferro, data) => [r.terziaria || '', 'IRIGOM', r.trasportatore || '', r.destinatario || '', String(r.allegato ?? ''), kg(r.peso_allegato_kg), data, data, kg(cippato), kg(ferro), kg(cippato + ferro)];

// ---------------------------------------------------------------------------
// I modelli

/** Il paragrafo che contiene un testo: da <w:p ...> a </w:p>. */
function paragrafoCon(xml, cosa) {
  const k = xml.indexOf(cosa);
  if (k < 0) return null;
  let inizio = k;
  for (;;) {
    inizio = xml.lastIndexOf('<w:p', inizio - 1);
    if (inizio < 0) return null;
    const dopo = xml[inizio + 4];
    if (dopo === '>' || dopo === ' ') break;
  }
  const fine = xml.indexOf('</w:p>', k);
  return fine < 0 ? null : { inizio, fine: fine + '</w:p>'.length };
}

/**
 * Compila un modello: toglie i blocchi facoltativi che non servono, mette le
 * tabelle al posto dei loro paragrafi e sostituisce i segnaposto. Restituisce i
 * byte del .docx e i segnaposto rimasti senza valore, che nel documento restano
 * visibili: meglio vedere cosa manca che un buco silenzioso.
 */
export function compilaModello(bytes, { valori = {}, tabelle = {}, togli = [] }) {
  const voci = unzipSync(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  if (!voci['word/document.xml']) throw new Error('Il modello non e\' un documento Word.');
  let xml = strFromU8(voci['word/document.xml']);
  for (const { da, a } of togli) {
    const p1 = paragrafoCon(xml, da);
    const p2 = paragrafoCon(xml, a);
    if (p1 && p2 && p2.fine > p1.inizio) xml = xml.slice(0, p1.inizio) + xml.slice(p2.fine);
  }
  for (const [nome, tbl] of Object.entries(tabelle)) {
    const p = paragrafoCon(xml, `{{${nome}}}`);
    if (p) xml = xml.slice(0, p.inizio) + tbl + xml.slice(p.fine);
  }
  const vuoti = new Set();
  xml = xml.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (intero, chiave) => {
    const v = valori[chiave];
    if (v === undefined || v === null || v === '') { vuoti.add(chiave); return intero; }
    return scappa(v);
  });
  voci['word/document.xml'] = strToU8(xml);
  return { bytes: zipSync(voci, { level: 6 }), vuoti: [...vuoti] };
}

// ---------------------------------------------------------------------------
// I documenti del mese

/**
 * Tutti i Word della pratica.
 * @param {object} p
 * @param {object} p.pratica   quello che torna da componiMese
 * @param {object} p.contesto  { anno, mese, data_lettera, nave: { nome, imo, porto, partenza, cementeria }, campagne }
 * @param {object} p.modelli   { ferro, nave, extra, cssc }: i byte dei modelli
 * @returns [{ percorso, bytes, vuoti }]
 */
export function wordDelMese({ pratica, contesto, modelli }) {
  const { anno, mese } = contesto;
  const MESE = String(mese).toUpperCase();
  const lettera = contesto.data_lettera;
  const nave = contesto.nave || {};
  const esce = [];
  const aggiungi = (percorso, esito) => esce.push({ percorso: `${MESE}/${percorso}`, bytes: esito.bytes, vuoti: esito.vuoti });

  // Ferro EER 19.12.02: i formulari nostri, con la quota.
  if (modelli.ferro && pratica.ferro.tabella.length) {
    const righe = pratica.ferro.tabella.map(r => [dataIt(r.data), 'IRIGOM', r.trasportatore, r.destinatario, r.formulario, kg(r.kg), kg(r.quota_kg)]);
    righe.push(['', '', '', '', TOT, rosso(pratica.ferro.peso_kg), rosso(pratica.ferro.quota_kg)]);
    aggiungi(`FERRO/Dichiarazione EER191202 ${meseAnnoMinuscolo(mese, anno)}.docx`, compilaModello(modelli.ferro, {
      valori: { DATA_LETTERA: lettera, MESE_ANNO: meseAnno(mese, anno), FERRO_KG: kg(pratica.ferro.quota_kg) },
      tabelle: {
        TABELLA_FORMULARI_FERRO: tabellaWord(['DATA', 'PRODUTTORE', 'TRASPORTATORE', 'DESTINATARIO', 'FORMULARIO', 'PESO [KG]', 'PESO IN USCITA [KG]'],
          righe, [1100, 1150, 1450, 1250, 2050, 1150, 1488], { intestazione: '92D050', evidenzia: [6], sfondoEvidenza: 'FFFF00' }),
      },
    }));
  }

  // Nave: le terziarie della rete, e l'extra raccolta in una tabella sua.
  const t = pratica.terziarie;
  const extra = pratica.extra;
  if (modelli.nave && t.righe.length) {
    const partenza = nave.partenza || '';
    const righe = t.righe.map(r => rigaTerziaria(r, r.cippato_kg, r.ferro_kg, partenza || dataIt(r.data)));
    righe.push([TOT, '', '', '', '', rosso(t.peso_allegati_kg), '', '', rosso(t.cippato_kg), rosso(t.ferro_kg), rosso(t.totale_kg)]);
    const cippato = t.cippato_kg + (extra ? extra.cippato_kg : 0);
    const ferro = t.ferro_kg + (extra ? extra.ferro_kg : 0);
    const tabelle = { TABELLA_TERZIARIE: tabellaWord(TERZIARIE.intestazioni, righe, TERZIARIE.larghezze, TERZIARIE.stile) };
    if (extra) tabelle.TABELLA_TERZIARIE_EXTRA = tabellaWord(TERZIARIE.intestazioni, [rigaTerziaria(extra, extra.cippato_kg, extra.ferro_kg, partenza || dataIt(extra.data))], TERZIARIE.larghezze, TERZIARIE.stile);
    aggiungi(`EXPORT/Dich. ciab IRIGOM (nave ${nave.porto || ''} ${meseAnnoMinuscolo(mese, anno)}).docx`, compilaModello(modelli.nave, {
      valori: {
        DATA_LETTERA: lettera, CIABATTATO_KG: kg(cippato), FERRO_KG: kg(ferro), PFU_KG: kg(cippato + ferro),
        CEMENTERIA: nave.cementeria, NAVE: nave.nome, IMO: nave.imo, PORTO: nave.porto, DATA_PARTENZA: partenza,
        EXTRA_ALLEGATO_VII: extra ? String(extra.allegato) : '', EXTRA_TERZIARIA: extra ? extra.terziaria : '', EXTRA_PFU_KG: extra ? kg(extra.totale_kg) : '',
      },
      tabelle,
      // Senza extra raccolta il blocco che la riguarda si toglie tutto.
      togli: extra ? [] : [{ da: '{{EXTRA_ALLEGATO_VII}}', a: '{{PFU_KG}}' }],
    }));
  }

  // Extra raccolta: i suoi formulari e la sua porzione di terziaria.
  if (modelli.extra && extra) {
    const formulari = (extra.formulari || []).map(f => [dataIt(f.inizio_trasporto), dataIt(f.fine_trasporto), f.campagna || '', f.produttore || '', f.trasportatore || '', f.destinatario || 'IRIGOM SRL', f.formulario || '', kg(f.peso_kg)]);
    if (formulari.length > 1) formulari.push(['', '', '', '', '', '', TOT, rosso(extra.formulari.reduce((s, f) => s + (Number(f.peso_kg) || 0), 0))]);
    const campagne = [...new Set((extra.formulari || []).map(f => String(f.campagna || '').toUpperCase()).filter(Boolean))];
    aggiungi(`EXPORT/dich. allegato EXTRA RACCOLTA (${meseAnnoMinuscolo(mese, anno)}).docx`, compilaModello(modelli.extra, {
      valori: {
        DATA_LETTERA: lettera, EXTRA_PFU_KG: kg(extra.totale_kg),
        CAMPAGNA: campagne.length > 1 ? `${campagne.slice(0, -1).join(', ')} e ${campagne[campagne.length - 1]}` : campagne[0],
        MESE_ANNO: meseAnno(mese, anno), MESE_ANNO_MINUSCOLO: meseAnnoMinuscolo(mese, anno), CEMENTERIA: nave.cementeria,
        EXTRA_ALLEGATO_VII: String(extra.allegato), EXTRA_TERZIARIA: extra.terziaria,
      },
      tabelle: {
        // Intestazione blu scuro come nel modello, col testo bianco: nero su blu non si leggeva.
        TABELLA_FORMULARI_EXTRA: tabellaWord(['DATA I.T.', 'DATA F.T.', 'ORDINE ECOTYRE', 'PRODUTTORE', 'TRASPORTATORE', 'DESTINATARIO', 'FORMULARIO', 'PESO [Kg]'],
          formulari, [1250, 1250, 2200, 3600, 1700, 1500, 1900, 1100], { intestazione: '1F4E79', testoIntestazione: 'FFFFFF' }),
        TABELLA_TERZIARIE_EXTRA: tabellaWord(TERZIARIE.intestazioni, [rigaTerziaria(extra, extra.cippato_kg, extra.ferro_kg, nave.partenza || dataIt(extra.data))], TERZIARIE.larghezze, TERZIARIE.stile),
      },
    }));
  }

  // CSS-C: una dichiarazione per DDT (per ogni parte, se il DDT e' spezzato).
  if (modelli.cssc) {
    for (const r of pratica.cssc.righe) {
      const numero = String(r.ddt || '').replace(/^DDT\s*/i, '').split('/')[0].trim();
      aggiungi(`CSS-C/DICH/dich. DDT ${numero}${r.parte ? ` (parte ${r.parte.replace(' di ', ' di ')})` : ''} - ${anno}.docx`, compilaModello(modelli.cssc, {
        valori: {
          DATA_LETTERA: lettera, MESE_ANNO: meseAnno(r.mese_lavorazione || mese, anno), TOTALE_KG: kg(r.totale_kg), CSS_KG: kg(r.cssc_kg), METALLI_KG: kg(r.ferro_kg),
          DDT_NUMERO: numero, DDT_ANNO: String(anno), DATA_TRASPORTO: dataIt(r.data), DATA_CONFERIMENTO: dataIt(r.data),
        },
      }));
    }
  }
  return esce;
}

// ---------------------------------------------------------------------------
// Il riepilogo Excel: il blocco del mese come nel foglio DICHIARAZIONI

const verde = 'FF92D050';
const giallo = 'FFFFFF00';
const riempi = (c, argb) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }; };
const bordi = (c) => { c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }; };
const comeData = (g) => (g ? new Date(Date.UTC(+g.slice(0, 4), +g.slice(5, 7) - 1, +g.slice(8, 10))) : null);
const daIt = (s) => (s && /^\d{2}\/\d{2}\/\d{4}$/.test(s) ? `${s.slice(6)}-${s.slice(3, 5)}-${s.slice(0, 2)}` : s);

/**
 * Il riepilogo Excel del mese, com'e' il blocco di agosto nel foglio
 * DICHIARAZIONI: ferro, CSS-C, extra raccolta, terziarie, con le stesse formule
 * e gli stessi colori, piu' un foglio con i controlli e i valori da riportare
 * nel riepilogo in alto.
 * @returns Uint8Array del file .xlsx
 */
export async function excelDelMese({ pratica, contesto }) {
  const modulo = await import('exceljs');
  const ExcelJS = modulo.default || modulo;
  const { anno, mese } = contesto;
  const partenza = contesto.nave && contesto.nave.partenza ? daIt(contesto.nave.partenza) : '';
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Gestionale PFU';
  wb.created = new Date();
  const ws = wb.addWorksheet(`${mese} ${anno}`.slice(0, 31));
  ws.columns = [16, 12, 16, 16, 18, 12, 16, 18, 12, 14, 12, 10, 10].map(width => ({ width }));
  let r = 1;
  const intestazione = (voci, colore = verde) => {
    const riga = ws.getRow(r);
    voci.forEach((v, i) => { const c = riga.getCell(i + 1); c.value = v; c.font = { bold: true }; c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; riempi(c, colore); bordi(c); });
    r++;
  };
  const numeri = (riga, colonne, formato = '#,##0') => colonne.forEach(k => { riga.getCell(k).numFmt = formato; });

  // Intestazione del mese
  const titolo = ws.getCell(r, 1);
  titolo.value = `${String(mese).toUpperCase()} ${anno}`;
  titolo.font = { bold: true };
  for (let k = 1; k <= 10; k++) riempi(ws.getCell(r, k), 'FF00B050');
  r += 2;

  // 1. Ferro EER 19.12.02
  ws.mergeCells(r, 1, r, 2);
  ws.getCell(r, 1).value = 'Dichiarazione CER191202';
  riempi(ws.getCell(r, 1), 'FFFF0000');
  ws.getCell(r, 1).font = { bold: true };
  r += 2;
  intestazione(['DATA', 'PRODUTTORE', 'TRASPORTATORE', 'DESTINATARIO', 'FORMULARIO', 'PESO [KG]', 'PESO IN USCITA [KG]'], 'FF99CCFF');
  const primaFerro = r;
  for (const f of pratica.ferro.tabella) {
    const riga = ws.getRow(r++);
    riga.values = [comeData(f.data), 'IRIGOM', f.trasportatore, f.destinatario, f.formulario, f.kg, f.quota_kg];
    riga.getCell(1).numFmt = 'dd/mm/yyyy';
    numeri(riga, [6, 7]);
  }
  const totFerro = ws.getRow(r++);
  totFerro.getCell(6).value = { formula: `SUM(F${primaFerro}:F${Math.max(primaFerro, r - 2)})`, result: pratica.ferro.peso_kg };
  totFerro.getCell(7).value = { formula: `SUM(G${primaFerro}:G${Math.max(primaFerro, r - 2)})`, result: pratica.ferro.quota_kg };
  riempi(totFerro.getCell(7), giallo);
  numeri(totFerro, [6, 7]);
  totFerro.font = { bold: true };
  r += 3;

  // 2. CSS-C
  const CSSC = ['DDT', 'PESO', 'PESO USCITA', 'UNITÀ DI MISURA', 'DATA TRASPORTO', 'DATA CONFERIMENTO', '% CSS-C', '%FERRO', 'TOTALE (PFU)', 'TRATTAMENTO'];
  intestazione(CSSC);
  const primoCssc = r;
  for (const d of pratica.cssc.righe) {
    const riga = ws.getRow(r);
    riga.values = [`DDT ${String(d.ddt || '').replace(/^DDT\s*/i, '')}${d.parte ? ` (parte ${d.parte})` : ''}`, d.cssc_kg, d.cssc_kg, 'KG', comeData(d.data), comeData(d.data), d.cssc_kg, d.ferro_kg];
    riga.getCell(9).value = { formula: `SUM(G${r}:H${r})`, result: d.totale_kg };
    riga.getCell(10).value = 'DA PFU';
    riga.getCell(11).value = { formula: `H${r}/I${r}`, result: d.totale_kg ? d.ferro_kg / d.totale_kg : 0 };
    riga.getCell(11).numFmt = '0.00%';
    riga.getCell(5).numFmt = 'dd/mm/yyyy';
    riga.getCell(6).numFmt = 'dd/mm/yyyy';
    numeri(riga, [2, 3, 7, 8, 9]);
    r++;
  }
  const totCssc = ws.getRow(r++);
  // Il totale somma tutte le righe: nel foglio di agosto sommava solo l'ultima.
  const ultimoCssc = Math.max(primoCssc, r - 2);
  ['G', 'H', 'I'].forEach((col, i) => { totCssc.getCell(7 + i).value = { formula: `SUM(${col}${primoCssc}:${col}${ultimoCssc})`, result: [pratica.cssc.cssc_kg, pratica.cssc.ferro_kg, pratica.cssc.totale_kg][i] }; });
  numeri(totCssc, [7, 8, 9]);
  totCssc.font = { bold: true };
  const rigaTotCssc = r - 1;
  r += 1;

  // 3. Extra raccolta, a parte
  const extra = pratica.extra;
  if (extra) {
    ws.mergeCells(r, 1, r, 3);
    ws.getCell(r, 1).value = `per il mese di ${String(mese).toLowerCase()} dichiarare extraraccolta ${kg(extra.totale_kg)} kg (pfu) = ${kg(extra.cippato_kg)} Kg (cipp) + ${kg(extra.ferro_kg)} Kg (fe)`;
    riempi(ws.getCell(r, 1), giallo);
    r++;
    ws.getCell(r, 1).value = `formulari: ${(extra.formulari || []).map(f => `${f.formulario} (${kg(f.peso_kg)} kg, fine trasporto ${dataIt(f.fine_trasporto)})`).join(', ')}; terziaria ${extra.terziaria || '—'}, allegato VII ${extra.allegato}`;
    r += 2;
    intestazione(CSSC);
    const riga = ws.getRow(r);
    riga.values = ['', extra.cippato_kg, extra.cippato_kg, 'KG', null, null, extra.cippato_kg, extra.ferro_kg];
    riga.getCell(9).value = { formula: `G${r}+H${r}`, result: extra.totale_kg };
    riga.getCell(10).value = 'DA PFU EXTRA RACCOLTA';
    numeri(riga, [2, 3, 7, 8, 9]);
    r += 2;
  }
  r += 4;

  // 4. Terziarie: la rete
  ws.getCell(r, 1).value = 'Dichiarazione CER191204';
  riempi(ws.getCell(r, 1), giallo);
  ws.getCell(r, 1).font = { bold: true };
  r += 3;
  intestazione([...TERZIARIE.intestazioni, '']);
  const primaTer = r;
  for (const t of pratica.terziarie.righe) {
    const riga = ws.getRow(r);
    const data = comeData(partenza || t.data);
    riga.values = [t.terziaria || '', 'IRIGOM', t.trasportatore, t.destinatario, t.allegato, t.peso_allegato_kg, data, data, t.cippato_kg, t.ferro_kg];
    riga.getCell(11).value = { formula: `I${r}+J${r}`, result: t.totale_kg };
    riga.getCell(12).value = { formula: `${MAX_PER_DICHIARAZIONE_KG}-K${r}`, result: MAX_PER_DICHIARAZIONE_KG - t.totale_kg };
    riga.getCell(13).value = { formula: `J${r}/K${r}`, result: t.totale_kg ? t.ferro_kg / t.totale_kg : 0 };
    riga.getCell(13).numFmt = '0.00%';
    riga.getCell(7).numFmt = 'dd/mm/yyyy';
    riga.getCell(8).numFmt = 'dd/mm/yyyy';
    riempi(riga.getCell(9), giallo);
    numeri(riga, [6, 9, 10, 11, 12]);
    r++;
  }
  const totTer = ws.getRow(r++);
  const ultimaTer = Math.max(primaTer, r - 2);
  [['F', 6, pratica.terziarie.peso_allegati_kg], ['I', 9, pratica.terziarie.cippato_kg], ['J', 10, pratica.terziarie.ferro_kg], ['K', 11, pratica.terziarie.totale_kg]]
    .forEach(([col, k, v]) => { totTer.getCell(k).value = { formula: `SUM(${col}${primaTer}:${col}${ultimaTer})`, result: v }; });
  numeri(totTer, [6, 9, 10, 11]);
  totTer.font = { bold: true };
  const rigaTotTer = r - 1;

  // Il valore da riportare nel riepilogo in alto: CSS-C + terziarie, la sola rete.
  r += 2;
  ws.getCell(r, 1).value = `Riepilogo, riga IRIGOM, ${mese}:`;
  ws.getCell(r, 1).font = { bold: true };
  ws.getCell(r, 5).value = { formula: `I${rigaTotCssc}+K${rigaTotTer}`, result: pratica.cssc.totale_kg + pratica.terziarie.totale_kg };
  ws.getCell(r, 5).numFmt = '#,##0';
  riempi(ws.getCell(r, 5), 'FF70AD47');
  if (extra) {
    r++;
    ws.getCell(r, 1).value = `Riepilogo, riga EXTRA RACCOLTA, ${mese}:`;
    ws.getCell(r, 1).font = { bold: true };
    ws.getCell(r, 5).value = extra.totale_kg;
    ws.getCell(r, 5).numFmt = '#,##0';
    riempi(ws.getCell(r, 5), 'FF70AD47');
  }

  // Secondo foglio: le letture, le scelte e i controlli, cosi' il perche' resta scritto.
  const c = wb.addWorksheet('Controlli', { views: [{ showGridLines: false }] });
  c.columns = [{ width: 46 }, { width: 22 }, { width: 70 }];
  const voce = (a, b, nota = '') => { const riga = c.addRow([a, b, nota]); if (typeof b === 'number') riga.getCell(2).numFmt = '#,##0'; return riga; };
  c.addRow([`Dichiarazioni Irigom · ${mese} ${anno}`]).font = { bold: true, size: 14 };
  c.addRow([]);
  const l = pratica.letture;
  voce('Lettura usata', l.usata === 'giacenza' ? 'giacenza a portale' : 'uscite del registro');
  voce('Uscite del registro: ciabattato + ferro + CSS-C', l.uscite.totale_kg, 'foglio Cons., riga del mese, colonne V + X + Y (extra raccolta compresa)');
  voce('Uscite del registro, sola rete', l.uscite.rete_kg);
  if (l.giacenza) {
    voce('Giacenza di rete a portale a fine mese', l.giacenza.portale_kg, 'per fine trasporto, aggiornata ai caricamenti');
    voce('Deve restare a portale (cippato + interi)', l.giacenza.resta_kg, 'foglio Cons., colonne AA + AC');
    voce('Da dichiarare secondo la giacenza', l.giacenza.rete_kg);
    voce('Scarto fra le due letture', l.scarto_kg, 'se non e\' zero va capito prima di caricare a portale');
  }
  voce('Dichiarato di rete (CSS-C + terziarie)', pratica.rete_kg);
  voce('Extra raccolta, a parte', pratica.extra_kg);
  voce('Terziarie da aprire a portale', pratica.terziarie_da_aprire);
  voce('Allegati VII scelti', pratica.allegati.scelti.map(a => a.numero).join(', '));
  c.addRow([]);
  for (const a of [...pratica.blocchi, ...pratica.avvisi]) c.addRow(['Da guardare', '', a]).getCell(3).alignment = { wrapText: true };
  c.addRow([]);
  c.addRow(['Formulari del ferro del mese', 'Quota nostra (kg)', 'Perche\'']).font = { bold: true };
  for (const f of pratica.ferro.esiti) voce(`${f.formulario} · ${dataIt(f.data)} · ${f.destinatario} · ${kg(f.kg)} kg`, f.quota_kg, f.motivo);

  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

// ---------------------------------------------------------------------------
// La cartella

/**
 * La cartella del mese, come sta nel repository sotto IRIGOM/<MESE>: i Word,
 * il riepilogo Excel e i PDF forniti, rinominati come vuole il portale (gli
 * allegati VII col numero della terziaria).
 * @param {array} file [{ percorso, bytes }]
 */
export function cartellaZip(file) {
  const voci = {};
  for (const f of file) voci[f.percorso] = [f.bytes instanceof Uint8Array ? f.bytes : new Uint8Array(f.bytes), { level: /\.(pdf|docx|xlsx)$/i.test(f.percorso) ? 0 : 6 }];
  return new Blob([zipSync(voci)], { type: 'application/zip' });
}

export { MESI };
