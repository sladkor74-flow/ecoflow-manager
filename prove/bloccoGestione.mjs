// Prova del blocco del mese da incollare nel foglio DICHIARAZIONI del file di
// gestione (src/lib/bloccoGestione.js), sul caso vero di agosto 2026: le righe
// devono venire come quelle scritte nel file, formule comprese. npm run prove
import { readFileSync } from 'node:fs';
import { componiMese } from '../src/lib/praticaIrigom.js';
import { datiFileGestione } from '../src/lib/documentiIrigom.js';
import { righeBlocco, istruzioni, serialeExcel, excelBlocco } from '../src/lib/bloccoGestione.js';

const A = JSON.parse(readFileSync(new URL('./dati/irigom_agosto_2026.json', import.meta.url), 'utf8'));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const pratica = componiMese({ criterio: 'ordine', riga: A.riga, ferro: A.ferro, allegati: A.allegati, ddt: [], lettura: 'uscite', extra: A.extra, terziarie: A.terziarie });
const dati = datiFileGestione({ pratica, contesto: { anno: 2026, mese: 'Agosto', nave: { partenza: '2026-08-27' } } });
const { righe, indice } = righeBlocco(dati);
const cella = (r, c) => (righe[r - 1] || [])[c];
const testo = (r, c) => { const v = cella(r, c); if (v === null || v === undefined) return ''; return typeof v === 'object' ? (v.f ? '=' + v.f : String(v.v)) : String(v); };

console.log('LA FORMA DEL BLOCCO');
verifica('il titolo del mese', testo(1, 0) === 'AGOSTO 2026');
verifica('la dichiarazione del ferro', testo(3, 0) === 'Dichiarazione CER191202' && testo(5, 4) === 'FORMULARIO');
verifica('i quattro formulari del ferro', righe.slice(5, 9).every(r => r[1] === 'IRIGOM') && testo(6, 4) === 'CNDJM000342KP' && testo(9, 4) === 'CNDJM000354XB');
verifica('peso e quota del primo formulario', cella(6, 5) === 28280 && cella(6, 6) === 28280 && cella(7, 6) === 6620);
verifica('la data e\' un numero di Excel col formato giusto', cella(6, 0).t === 'n' && cella(6, 0).z === 'dd/mm/yyyy' && cella(6, 0).v === serialeExcel('2026-08-03'));
verifica('il totale del ferro somma le sue righe', testo(indice.totale_ferro, 5) === '=SUM(F6:F9)' && testo(indice.totale_ferro, 6) === '=SUM(G6:G9)');
verifica('la quota del ferro fa 82.500', dati.ferro.reduce((s, f) => s + f.quota_kg, 0) === 82500);

console.log('\nL\'EXTRA RACCOLTA, A PARTE');
verifica('la nota dice quanto e come', /^per il mese di agosto dichiarare extraraccolta 460 kg \(pfu\) = 340 Kg \(cipp\) \+ 120 Kg \(fe\)$/.test(testo(indice.extra - 4, 0)), testo(indice.extra - 4, 0));
verifica('la seconda nota dice in quale terziaria si chiude', /^EXTRA RACCOLTA DA DICHIARARE!!! - nella terziaria TER26154141, che si chiude a portale a 20340 kg$/.test(testo(indice.extra - 3, 0)), testo(indice.extra - 3, 0));
verifica('la riga dell\'extra: cippato, ferro e totale', cella(indice.extra, 6) === 340 && cella(indice.extra, 7) === 120
  && testo(indice.extra, 8) === `=G${indice.extra}+H${indice.extra}` && testo(indice.extra, 9) === 'DA PFU EXTRA RACCOLTA');
verifica('la riga dell\'extra porta la sua terziaria', testo(indice.extra, 0) === 'TER26154141');

console.log('\nLE TERZIARIE');
const primaTer = indice.totale_terziarie - 17;
verifica('diciassette terziarie', righe.slice(primaTer - 1, indice.totale_terziarie - 1).length === 17);
verifica('la prima come nel file', testo(primaTer, 0) === 'TER26153987' && cella(primaTer, 4) === 1 && cella(primaTer, 5) === 25880 && cella(primaTer, 8) === 25880 && cella(primaTer, 9) === 4850);
verifica('le formule della prima riga', testo(primaTer, 10) === `=I${primaTer}+J${primaTer}` && testo(primaTer, 11) === `=38000-K${primaTer}` && testo(primaTer, 12) === `=J${primaTer}/K${primaTer}`);
verifica('l\'ultima terziaria e\' quella parziale con l\'extra', testo(indice.totale_terziarie - 1, 0) === 'TER26154141' && cella(indice.totale_terziarie - 1, 8) === 15100);
verifica('i totali delle terziarie sommano le loro righe', testo(indice.totale_terziarie, 10) === `=SUM(K${primaTer}:K${indice.totale_terziarie - 1})`);
const cippato = righe.slice(primaTer - 1, indice.totale_terziarie - 1).reduce((s, r) => s + r[8], 0);
const ferro = righe.slice(primaTer - 1, indice.totale_terziarie - 1).reduce((s, r) => s + r[9], 0);
// nelle terziarie c'e' la sola parte di rete: i 340 kg di cippato e i 120 di
// ferro dell'extra raccolta stanno nella sua riga, a parte
verifica('cippato e ferro delle terziarie fanno la rete del mese', cippato === 451760 && ferro === 82380 && cippato + ferro === 534140, `${cippato} ${ferro}`);
verifica('col l\'extra si arriva ai 534.600 da caricare a portale', cippato + ferro + dati.extra.totale_kg === dati.totale_portale_kg);

console.log('\nLE ISTRUZIONI');
const guida = istruzioni(dati, indice).map(r => r[0] || '').join('\n');
verifica('dicono dove incollare', /foglio DICHIARAZIONI/.test(guida) && /quattro righe vuote/.test(guida));
verifica('dicono le due celle del riepilogo', /IRIGOM = K<riga del blocco \d+>/.test(guida) && /EXTRA RACCOLTA = 460/.test(guida), guida.split('\n').find(r => /IRIGOM =/.test(r)));
verifica('dicono il totale di controllo', /534\.600 kg/.test(guida), guida.split('\n').pop());

console.log('\nLE SEZIONI CI SONO SOLO SE SERVONO');
verifica('ad agosto non ci sono DDT: del CSS-C non resta nessun riquadro', !indice.totale_cssc, String(indice.totale_cssc));
const conCssc = righeBlocco({ ...dati, cssc: [{ ddt: '311/2026', data: '2026-07-14', cssc_kg: 25000, ferro_kg: 10000 }] });
const nCssc = conCssc.indice.totale_cssc - 1;
const rigaCssc = conCssc.righe[nCssc - 1];
verifica('con un DDT la sezione c\'e\', e la percentuale sta in K come negli altri mesi',
  rigaCssc[0] === 'DDT 311/2026' && rigaCssc[10] && rigaCssc[10].f === `H${nCssc}/I${nCssc}` && rigaCssc[11] === undefined,
  JSON.stringify(rigaCssc));

console.log('\nUN MESE DI SOLI METALLI');
const soloFerro = righeBlocco({ anno: 2026, mese: 'Settembre', ferro: [{ data: '2026-09-01', trasportatore: 'SMOCO', destinatario: 'TRS', formulario: 'X1', peso_kg: 27500, quota_kg: 3040 }], cssc: [], terziarie: [], extra: null, totale_portale_kg: 0 });
verifica('niente terziarie, niente extra, niente CSS-C, ma il ferro c\'e\'', soloFerro.righe.some(r => r[4] === 'X1')
  && !soloFerro.indice.totale_terziarie && !soloFerro.indice.extra && !soloFerro.indice.totale_cssc);
verifica('il totale del ferro c\'e\' lo stesso', !!soloFerro.indice.totale_ferro);
const guidaFerro = istruzioni({ anno: 2026, mese: 'Settembre', ferro: [{ quota_kg: 3040 }], totale_portale_kg: 0 }, soloFerro.indice).map(r => r[0] || '').join('\n');
verifica('le istruzioni dicono di lasciare vuoto il riepilogo', /a portale non si carica nulla/.test(guidaFerro) && /resta vuota/.test(guidaFerro) && !/IRIGOM = /.test(guidaFerro));

// Il file vero: si rilegge con exceljs, perche' il blocco deve arrivare nel
// foglio DICHIARAZIONI gia' vestito come i mesi che ci sono gia'.
console.log('\nIL FILE EXCEL, RILETTO');
const modulo = await import('exceljs');
const ExcelJS = modulo.default || modulo;
const riletto = new ExcelJS.Workbook();
await riletto.xlsx.load(Buffer.from(await excelBlocco(dati)));
const bl = riletto.getWorksheet('BLOCCO');
const cel = (rif) => bl.getCell(rif);
const sfondo = (rif) => { const f = cel(rif).fill; return f && f.type === 'pattern' && f.fgColor ? f.fgColor.argb : ''; };

verifica('i due fogli ci sono', !!bl && !!riletto.getWorksheet('Come si incolla'));
verifica('le colonne sono larghe come nel foglio DICHIARAZIONI', Math.round(bl.getColumn(1).width) === 45 && Math.round(bl.getColumn(13).width) === 15);
verifica('il titolo del mese e\' nella fascia verde', sfondo('A1') === 'FF00B050' && sfondo('J1') === 'FF00B050' && cel('A1').font.size === 24 && cel('A1').font.bold === true);
verifica('"Dichiarazione CER191202" e\' sul rosso', sfondo('A3') === 'FFFF0000' && cel('A3').font.underline === true);
verifica('l\'intestazione del ferro e\' azzurra e bordata', sfondo('A5') === 'FF99CCFF' && cel('G5').border.top.style === 'medium');
verifica('l\'intestazione delle terziarie e\' verde', sfondo(`A${primaTer - 1}`) === 'FF92D050');
verifica('la nota dell\'extra raccolta e\' gialla e unita su A:C', sfondo(`A${indice.extra - 4}`) === 'FFFFFF00' && cel(`A${indice.extra - 4}`).isMerged);
verifica('la quota del ferro e il ciabattato sono evidenziati in giallo', sfondo(`G${indice.totale_ferro}`) === 'FFFFFF00' && sfondo(`I${primaTer}`) === 'FFFFFF00');
verifica('il totale del ferro e\' in rosso grassetto', cel(`F${indice.totale_ferro}`).font.bold === true && cel(`F${indice.totale_ferro}`).font.color.argb === 'FFFF0000');

const formulaDi = (rif) => { const v = cel(rif).value; return v && typeof v === 'object' && v.formula ? v.formula : null; };
verifica('le somme sono salvate come formule, senza valore', formulaDi(`F${indice.totale_ferro}`) === 'SUM(F6:F9)' && cel(`F${indice.totale_ferro}`).value.result === undefined);
verifica('le formule della prima terziaria restano formule', formulaDi(`K${primaTer}`) === `I${primaTer}+J${primaTer}` && formulaDi(`L${primaTer}`) === `38000-K${primaTer}`);
verifica('la formula dell\'extra raccolta resta formula', formulaDi(`I${indice.extra}`) === `G${indice.extra}+H${indice.extra}`);
verifica('le percentuali hanno il loro formato', cel(`M${primaTer}`).numFmt === '0.00%');
verifica('i pesi hanno il formato migliaia', cel('F6').numFmt === '#,##0' && cel(`F${indice.totale_ferro}`).numFmt === '#,##0');

const dataDi = (rif) => { const v = cel(rif).value; return v instanceof Date ? v.toISOString().slice(0, 10) : String(v); };
verifica('le date sono date, col formato gg/mm/aaaa', cel('A6').numFmt === 'dd/mm/yyyy' && dataDi('A6') === '2026-08-03', dataDi('A6'));
verifica('le terziarie portano la data di partenza della nave', dataDi(`G${primaTer}`) === '2026-08-27' && cel(`H${primaTer}`).numFmt === 'dd/mm/yyyy');

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
