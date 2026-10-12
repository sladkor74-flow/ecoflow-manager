// Prova del FORMATO E DELLA REGIONE DEL REPORT MENSILE (chiusura dell'audit,
// 11/10/2026).
//
// 1. Le pivot arrotondavano ogni valore a due decimali e la tabella li stampava
//    con due decimali fissi: 12.345 kg erano 12,35 t qui e 12,345 t in tutto il
//    resto del gestionale. La regola dei pesi vuole tre decimali quando i kg non
//    sono tondi, export compresi.
// 2. Il CSV scriveva 0 dove una cella non aveva movimenti e «12,3» per 12,30 t,
//    senza il punto delle migliaia. Dall'11/10/2026 la scheda esce in Excel
//    (src/lib/reportMensileExport.js): numeri veri col formato delle tonnellate,
//    e la cella senza movimenti vuota.
// 3. La regione si leggeva prima dal campo «Regioni» del file e poi dalla
//    provincia, mentre il resto del gestionale fa il contrario.
// npm run prove
import { readFileSync } from 'node:fs';
import { resolveObjectURL } from 'node:buffer';
import { transformSync } from 'esbuild';
import { calcolaPivot } from '../base44/shared/reportMensile.ts';
import { caricaLibPagine } from './dati/libPagine.mjs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// utils.js guarda window appena caricato (isIframe): nelle prove non c'e' un browser.
if (typeof globalThis.window === 'undefined') globalThis.window = { self: 1, top: 1 };
const { formatTonnellate, formatIntero, formatNumber } = await import('../src/lib/utils.js');
const sorgente = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\r/g, '');

let n = 0;
const riga = (trasportatore, kg, extra = {}) => ({
  id_ordine: 'O' + (++n), stato: 'terminato', trasporto_finito_il: '2026-05-10T08:00:00Z',
  trasportatore, destinazione: 'ALFA SRL', tipo_destinazione: 'imp', provincia: 'NA', regione: 'Campania',
  peso_effettivo: kg, prodotto: 'P - fino a 35 kg', classe: 'P', ...extra,
});

console.log('LE PIVOT SI TENGONO AI CHILI');
{
  const p = calcolaPivot('raccoltaAnno', [riga('RACC SRL', 12345)], 2026, '');
  verifica('12.345 kg sono 12,345 t, non 12,35', p.radice.totali.peso === 12.345, String(p.radice.totali.peso));
  const tre = calcolaPivot('raccoltaAnno', [riga('UNO SRL', 1234), riga('DUE SRL', 2345), riga('TRE SRL', 3456)], 2026, '');
  const somma = tre.radice.figli[0].figli.reduce((s, f) => s + f.totali.peso, 0);
  verifica('e la somma dei figli fa il totale', Math.round(somma * 1000) === Math.round(tre.radice.totali.peso * 1000) && tre.radice.totali.peso === 7.035,
    `${somma} contro ${tre.radice.totali.peso}`);
  const viaggi = calcolaPivot('viaggiRete', [riga('UNO SRL', 1234), riga('UNO SRL', 2345)], 2026, 'Maggio');
  verifica('i viaggi restano interi', viaggi.radice.totali.conteggio === 2, String(viaggi.radice.totali.conteggio));
}

console.log('LA TABELLA SCRIVE IL PESO COME IL RESTO DEL GESTIONALE');
{
  const src = sorgente('src/components/report-mensile/ReportPivotTable.jsx');
  const corpo = (src.match(/function Numero\([\s\S]*?\n\}\n/) || [''])[0];
  const js = transformSync(corpo, { loader: 'jsx', jsxFactory: 'h', jsxFragment: 'Frammento' }).code;
  const h = (tipo, props, ...figli) => ({ tipo, props, figli });
  const Numero = new Function('h', 'Frammento', 'formatNumber', 'formatTonnellate', 'formatIntero', js + '\nreturn Numero;')(h, 'F', formatNumber, formatTonnellate, formatIntero);
  const testo = (x) => (x && x.figli ? x.figli.map(testo).join('') : String(x ?? ''));
  verifica('12,345 t con tre decimali', testo(Numero({ valore: 12.345, misura: 'peso' })) === '12,345', testo(Numero({ valore: 12.345, misura: 'peso' })));
  verifica('12,30 t con due', testo(Numero({ valore: 12.3, misura: 'peso' })) === '12,30', testo(Numero({ valore: 12.3, misura: 'peso' })));
  verifica('il punto delle migliaia', testo(Numero({ valore: 1234.5, misura: 'peso' })) === '1.234,50');
  verifica('i viaggi senza decimali', testo(Numero({ valore: 14, misura: 'conteggio' })) === '14');
  verifica('una cella vuota resta il trattino', testo(Numero({ valore: null, misura: 'peso' })) === '—');
}

console.log('L\'EXCEL: NIENTE ZERI INVENTATI, TONNELLATE COI DECIMALI GIUSTI');
{
  // Il file finisce qui invece che nel browser: si intercetta il link del download.
  let scaricato = null;
  globalThis.document = { body: { appendChild() {} }, createElement: () => ({ click() { scaricato = resolveObjectURL(this.href); }, remove() {} }) };
  const { esportaReportMensileExcel } = await caricaLibPagine('lib/reportMensileExport');
  // La pivot Raccolta ha le classi in colonna: UNO raccoglie solo P, DUE solo M.
  const p = calcolaPivot('raccolta', [riga('UNO SRL', 1234500), riga('DUE SRL', 12300, { prodotto: 'M - da 35 a 100 kg', classe: 'M' })], 2026, 'Maggio');
  await esportaReportMensileExcel({ pivots: { raccolta: p }, gruppo: { chiave: 'rete', titolo: 'Rete', pivot: ['raccolta'] }, anno: 2026, mese: 'Maggio', periodoDi: () => 'Maggio 2026' },
    { stato: { letto: true, archivi: [] } });
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  if (scaricato) await wb.xlsx.load(Buffer.from(await scaricato.arrayBuffer()));
  const ws = wb.worksheets[0];
  const righe = [];
  for (let n = 1; ws && n <= ws.rowCount; n++) righe.push(ws.getRow(n));
  const intest = righe.find(r => (r.values || []).includes('P') && (r.values || []).includes('M'));
  const colP = intest ? intest.values.indexOf('P') : -1, colM = intest ? intest.values.indexOf('M') : -1;
  const uno = righe.find(r => String(r.getCell(1).value).trim() === 'UNO SRL');
  const due = righe.find(r => String(r.getCell(1).value).trim() === 'DUE SRL');
  const vuota = (c) => c.value === null || c.value === undefined || c.value === '';
  verifica('le colonne ci sono', colP > 0 && colM > 0, intest ? JSON.stringify(intest.values) : 'manca');
  verifica('una cella senza movimenti resta vuota, non 0', uno && due && vuota(uno.getCell(colM)) && vuota(due.getCell(colP)), uno && due ? `UNO: ${uno.getCell(colM).value} | DUE: ${due.getCell(colP).value}` : 'righe mancanti');
  verifica('le tonnellate sono numeri col punto delle migliaia e due decimali', uno && uno.getCell(colP).value === 1234.5 && uno.getCell(colP).numFmt === '#,##0.00#', uno ? `${uno.getCell(colP).value} ${uno.getCell(colP).numFmt}` : 'manca');
  verifica('12,30 t resta 12,3 nella cella e si legge 12,30', due && due.getCell(colM).value === 12.3 && due.getCell(colM).numFmt === '#,##0.00#', due ? `${due.getCell(colM).value} ${due.getCell(colM).numFmt}` : 'manca');
  verifica('la pagina non scrive piu\' un CSV', !/text\/csv/.test(sorgente('src/pages/ReportMensile.jsx')) && /esportaReportMensileExcel/.test(sorgente('src/pages/ReportMensile.jsx')));
}

console.log('LA REGIONE: PRIMA LA PROVINCIA, IL CAMPO DEL FILE PER ULTIMO');
{
  const p = calcolaPivot('raccoltaAnno', [
    riga('UNO SRL', 1000, { provincia: 'NA', regione: 'Campania', regioni: 'PUGLIA' }),
    riga('DUE SRL', 2000, { provincia: 'BA', regione: '', regioni: 'Campania' }),
    riga('TRE SRL', 3000, { provincia: '', regione: '', regioni: 'Basilicata' }),
  ], 2026, '');
  const regioni = Object.fromEntries((p.radice.figli || []).map(f => [f.etichetta, f.totali.peso]));
  verifica('la provincia di Napoli e\' Campania anche se il file dice PUGLIA', regioni.Campania === 1, JSON.stringify(regioni));
  verifica('la provincia di Bari e\' Puglia anche se il file dice Campania', regioni.Puglia === 2, JSON.stringify(regioni));
  verifica('senza provincia ne\' regione vale il campo del file', regioni.Basilicata === 3, JSON.stringify(regioni));
  verifica('e il modulo usa la regola unica', /regioneDi\(r\)/.test(sorgente('base44/shared/reportMensile.ts')));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
