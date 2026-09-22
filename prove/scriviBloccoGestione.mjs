// Prova del blocco scritto dentro il file di gestione
// (src/lib/scriviBloccoGestione.js). Il file vero dell'utente non si tocca:
// qui se ne costruisce uno finto con exceljs - un mese gia' scritto piu' il
// riepilogo in alto - ci si scrive il mese dopo e si rilegge il risultato, per
// controllare righe, formule, riepilogo, formati ereditati e i rifiuti.
// npm run prove
import { readFileSync } from 'node:fs';
import { componiMese } from '../src/lib/praticaIrigom.js';
import { datiFileGestione } from '../src/lib/documentiIrigom.js';
import { scriviBloccoNelFile } from '../src/lib/scriviBloccoGestione.js';

const A = JSON.parse(readFileSync(new URL('./dati/irigom_agosto_2026.json', import.meta.url), 'utf8'));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const rifiuta = (nome, azione, pezzo) => {
  let messaggio = '';
  return azione().then(() => { messaggio = '(non ha rifiutato)'; }, (e) => { messaggio = e.message; })
    .then(() => verifica(nome, messaggio.includes(pezzo), `-> ${messaggio}`));
};

// ---------------------------------------------------------------------------
// Il file di gestione finto: il riepilogo in alto e il blocco di luglio

const VERDE = 'FF00B050', GIALLO = 'FFFFFF00', ROSSO = 'FFFF0000', AZZURRO = 'FF99CCFF';
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

async function fileDiProva({ senzaFoglio = false, soloTitolo = false } = {}) {
  const modulo = await import('exceljs');
  const ExcelJS = modulo.default || modulo;
  const wb = new ExcelJS.Workbook();
  if (senzaFoglio) {
    wb.addWorksheet('ALTRO').getCell('A1').value = 'niente dichiarazioni qui';
    return new Uint8Array(await wb.xlsx.writeBuffer());
  }
  const ws = wb.addWorksheet('DICHIARAZIONI');
  const metti = (rif, valore, stile = {}) => {
    const c = ws.getCell(rif);
    c.value = valore;
    if (stile.fill) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: stile.fill } };
    if (stile.numFmt) c.numFmt = stile.numFmt;
    if (stile.grassetto) c.font = { bold: true };
    return c;
  };
  const riga = (n, celle, stile = {}) => {
    celle.forEach((v, i) => { if (v !== null) metti(`${String.fromCharCode(65 + i)}${n}`, v, typeof stile === 'function' ? stile(i) : stile); });
  };

  // Il riepilogo: una colonna per mese (e in mezzo le CARICATA\INVIATA), la
  // riga EXTRA RACCOLTA e la riga IRIGOM.
  metti('B1', 'IMPIANTO');
  MESI.forEach((m, i) => { metti(`${String.fromCharCode(67 + i * 2)}1`, m); metti(`${String.fromCharCode(68 + i * 2)}1`, 'CARICATA\\INVIATA'); });
  metti('B11', 'EXTRA RACCOLTA');
  metti('B12', 'IRIGOM');
  // Giugno e luglio gia' fatti: da luglio (colonna O) si copia il verde.
  metti('M12', 4000, { fill: 'FF70AD47', numFmt: '#,##0' });
  metti('O12', { formula: 'I32+K49' }, { fill: 'FF70AD47', numFmt: '#,##0' });
  metti('M11', 100, { fill: 'FF70AD47', numFmt: '#,##0' });
  metti('O11', 460, { fill: 'FF70AD47', numFmt: '#,##0' });   // l'extra sul mese del formulario

  // Il blocco di luglio: e' la riga modello di ogni tipo.
  metti('A20', 'LUGLIO 2026', { fill: VERDE, grassetto: true });
  metti('B20', null, { fill: VERDE });
  ws.getRow(20).height = 31.5;
  if (soloTitolo) return new Uint8Array(await wb.xlsx.writeBuffer());
  metti('A22', 'Dichiarazione CER191202', { fill: ROSSO, grassetto: true });
  metti('B22', null, { fill: ROSSO });
  ws.mergeCells('A22:B22');
  riga(24, ['DATA', 'PRODUTTORE', 'TRASPORTATORE', 'DESTINATARIO', 'FORMULARIO', 'PESO [KG]', 'PESO IN USCITA [KG]'], { fill: AZZURRO, grassetto: true });
  riga(25, [new Date(Date.UTC(2026, 6, 3)), 'IRIGOM', 'SMOCO', 'TRS', 'CNDJM000320SD', 29260, 29260],
    (i) => ({ numFmt: i === 0 ? 'dd/mm/yyyy' : (i >= 5 ? '#,##0' : null), fill: i === 6 ? GIALLO : null }));
  ws.getRow(25).height = 15.75;
  riga(26, [null, null, null, null, null, { formula: 'SUM(F25:F25)' }, { formula: 'SUM(G25:G25)' }], { numFmt: '#,##0', grassetto: true });
  riga(30, ['DDT', 'PESO', 'PESO USCITA', 'UNITà DI MISURA', 'DATA TRASPORTO', 'DATA CONFERIMENTO', '% CSS-C', '%FERRO', 'TOTALE (PFU)', 'TRATTAMENTO'], { fill: 'FF92D050', grassetto: true });
  riga(31, ['DDT 311/2026', 25000, 25000, 'KG', new Date(Date.UTC(2026, 6, 7)), new Date(Date.UTC(2026, 6, 7)), 25000, 10000, { formula: 'SUM(G31:H31)' }, 'DA PFU', { formula: 'H31/I31' }],
    (i) => ({ numFmt: [4, 5].includes(i) ? 'dd/mm/yyyy' : (i === 10 ? '0.00%' : (i === 0 || i === 3 || i === 9 ? null : '#,##0')) }));
  riga(32, [null, null, null, null, null, null, { formula: 'SUM(G31:G31)' }, { formula: 'SUM(H31:H31)' }, { formula: 'SUM(I31:I31)' }], { numFmt: '#,##0' });
  metti('A34', 'per il mese di luglio dichiarare extraraccolta 100 kg (pfu) = 80 Kg (cipp) + 20 Kg (fe)', { fill: GIALLO });
  ws.mergeCells('A34:C34');
  metti('A35', 'EXTRA RACCOLTA DA DICHIARARE!!!', { grassetto: true });
  riga(37, ['DDT', 'PESO', 'PESO USCITA', 'UNITà DI MISURA', 'DATA TRASPORTO', 'DATA CONFERIMENTO', '% CSS-C', '%FERRO', 'TOTALE (PFU)', 'TRATTAMENTO'], { fill: 'FF92D050', grassetto: true });
  riga(38, ['TER26130000', 80, 80, 'KG', null, null, 80, 20, { formula: 'G38+H38' }, 'DA PFU EXTRA RACCOLTA'], { numFmt: '#,##0' });
  metti('A44', 'Dichiarazione CER191204', { fill: GIALLO, grassetto: true });
  riga(47, ['ORDINE TERZIARIA', 'PRODUTTORE', 'TRASPORTATORE', 'DESTINATARIO', 'Nr. ALLEGATO VII', 'PESO [Kg]', 'DATA TRASPORTO', 'DATA CONFERIMENTO', 'CIPP / CIAB', 'EER 19.12.02', 'TOTALE'], { fill: 'FF92D050', grassetto: true });
  riga(48, ['TER26134663', 'IRIGOM', 'SMOCO', 'AKCANSA', 1, 28180, new Date(Date.UTC(2026, 6, 23)), new Date(Date.UTC(2026, 6, 23)), 27040, 10960, { formula: 'I48+J48' }, { formula: '38000-K48' }, { formula: 'J48/K48' }],
    (i) => ({ numFmt: [6, 7].includes(i) ? 'dd/mm/yyyy' : (i === 12 ? '0.00%' : (i >= 4 ? '#,##0' : null)), fill: i === 8 ? GIALLO : null }));
  riga(49, [null, null, null, null, null, { formula: 'SUM(F48:F48)' }, null, null, { formula: 'SUM(I48:I48)' }, { formula: 'SUM(J48:J48)' }, { formula: 'SUM(K48:K48)' }], { numFmt: '#,##0' });
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

async function rileggi(bytes) {
  const modulo = await import('exceljs');
  const ExcelJS = modulo.default || modulo;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes);
  return wb.getWorksheet('DICHIARAZIONI');
}
const testo = (ws, rif) => { const v = ws.getCell(rif).value; return v === null || v === undefined ? '' : (typeof v === 'object' ? (v.formula ? `=${v.formula}` : (v.text ?? String(v))) : String(v)); };
const numero = (ws, rif) => { const v = ws.getCell(rif).value; return typeof v === 'number' ? v : (v instanceof Date ? Math.round(v.getTime() / 86400000) + 25569 : null); };
const sfondo = (ws, rif) => { const f = ws.getCell(rif).fill; return f && f.fgColor ? f.fgColor.argb : ''; };

// ---------------------------------------------------------------------------
// Il mese da scrivere: agosto 2026, il caso vero

const pratica = componiMese({ criterio: 'ordine', riga: A.riga, ferro: A.ferro, allegati: A.allegati, ddt: [], lettura: 'uscite', extra: A.extra, terziarie: A.terziarie });
const dati = datiFileGestione({ pratica, contesto: { anno: 2026, mese: 'Agosto', nave: { partenza: '2026-08-27' } } });
// Il formulario dell'extra e' finito a luglio: nel riepilogo quei 460 kg stanno
// ancora sulla colonna di luglio e vanno tolti, perche' si dichiarano ad agosto.
dati.extra.formulari = [{ formulario: 'BSDCL002230PQ', peso_kg: 460, fine_trasporto: '2026-07-30' }];

const esito = await scriviBloccoNelFile(await fileDiProva(), dati);
const ws = await rileggi(esito.bytes);
const r = esito.riga_inizio;

console.log('DOVE FINISCE IL BLOCCO');
verifica('comincia quattro righe sotto l\'ultima scritta', r === 54, `riga ${r}`);
verifica('il titolo del mese', testo(ws, `A${r}`) === 'AGOSTO 2026');
verifica('finisce sul totale delle terziarie', esito.riga_fine === r + 44 && testo(ws, `K${esito.riga_fine}`).startsWith('=SUM(K'), `${esito.riga_fine}: ${testo(ws, `K${esito.riga_fine}`)}`);
verifica('il blocco di luglio e\' rimasto dov\'era', testo(ws, 'A20') === 'LUGLIO 2026' && testo(ws, 'A48') === 'TER26134663');

console.log('\nIL FERRO');
verifica('i quattro formulari', testo(ws, `E${r + 5}`) === 'CNDJM000342KP' && testo(ws, `E${r + 8}`) === 'CNDJM000354XB');
verifica('peso e quota', numero(ws, `F${r + 5}`) === 28280 && numero(ws, `G${r + 6}`) === 6620);
verifica('la data e\' una data di Excel', numero(ws, `A${r + 5}`) === 46237, String(numero(ws, `A${r + 5}`)));
verifica('il totale somma le righe del mese, non quelle di luglio', testo(ws, `G${r + 9}`) === `=SUM(G${r + 5}:G${r + 8})`, testo(ws, `G${r + 9}`));
verifica('la formula e\' senza risultato memorizzato: lo rifa\' Excel', ws.getCell(`G${r + 9}`).value.result === undefined);

console.log('\nIL CSS-C E L\'EXTRA RACCOLTA');
// Agosto non ha DDT di CSS-C: quel riquadro non c'e' proprio (regola del 22/09/2026).
const rigaChe = (inizio) => { for (let n = r; n <= esito.riga_fine; n++) if (String(testo(ws, `A${n}`) || '').startsWith(inizio)) return n; return 0; };
// l'unica intestazione "DDT" rimasta e' quella dell'extra raccolta, che la usa uguale
verifica('del CSS-C non resta nessun riquadro', !rigaChe('DDT ') && testo(ws, `J${rigaChe('DDT') + 1}`) === 'DA PFU EXTRA RACCOLTA',
  `${rigaChe('DDT ')} / ${testo(ws, `J${rigaChe('DDT') + 1}`)}`);
const rNota = rigaChe('per il mese di');
verifica('la nota dell\'extra', /^per il mese di agosto dichiarare extraraccolta 460 kg/.test(testo(ws, `A${rNota}`)), testo(ws, `A${rNota}`));
verifica('la seconda nota dice la terziaria', /nella terziaria TER26154141, che si chiude a portale a 20340 kg$/.test(testo(ws, `A${rNota + 1}`)), testo(ws, `A${rNota + 1}`));
const rExtra = rNota + 4;
verifica('la riga dell\'extra: terziaria, cippato, ferro e totale', testo(ws, `A${rExtra}`) === 'TER26154141' && numero(ws, `G${rExtra}`) === 340
  && numero(ws, `H${rExtra}`) === 120 && testo(ws, `I${rExtra}`) === `=G${rExtra}+H${rExtra}` && testo(ws, `J${rExtra}`) === 'DA PFU EXTRA RACCOLTA');

console.log('\nLE TERZIARIE');
const rPrimaTer = rigaChe('ORDINE TERZIARIA') + 1;
const rTotTer = esito.riga_fine;
verifica('diciassette terziarie', rTotTer - rPrimaTer === 17, `da ${rPrimaTer} a ${rTotTer - 1}`);
verifica('la prima come nella pratica', testo(ws, `A${rPrimaTer}`) === 'TER26153987' && numero(ws, `F${rPrimaTer}`) === 25880 && numero(ws, `I${rPrimaTer}`) === 25880);
verifica('le formule della riga si spostano col blocco', testo(ws, `K${rPrimaTer}`) === `=I${rPrimaTer}+J${rPrimaTer}`
  && testo(ws, `L${rPrimaTer}`) === `=38000-K${rPrimaTer}` && testo(ws, `M${rPrimaTer}`) === `=J${rPrimaTer}/K${rPrimaTer}`);
verifica('l\'ultima terziaria e\' quella con dentro l\'extra', testo(ws, `A${rTotTer - 1}`) === 'TER26154141' && numero(ws, `I${rTotTer - 1}`) === 15100);
verifica('i totali sommano le sole terziarie', testo(ws, `I${rTotTer}`) === `=SUM(I${rPrimaTer}:I${rTotTer - 1})` && testo(ws, `K${rTotTer}`) === `=SUM(K${rPrimaTer}:K${rTotTer - 1})`);

console.log('\nI FORMATI PRESI DAL MESE PRIMA');
verifica('il verde del titolo', sfondo(ws, `A${r}`) === VERDE, sfondo(ws, `A${r}`));
verifica('l\'altezza della riga del titolo', ws.getRow(r).height === 31.5, String(ws.getRow(r).height));
verifica('il rosso della dichiarazione CER191202', sfondo(ws, `A${r + 2}`) === ROSSO && testo(ws, `A${r + 2}`) === 'Dichiarazione CER191202');
verifica('l\'azzurro dell\'intestazione del ferro', sfondo(ws, `A${r + 4}`) === AZZURRO);
verifica('la data del ferro ha il formato data', ws.getCell(`A${r + 5}`).numFmt === 'dd/mm/yyyy', ws.getCell(`A${r + 5}`).numFmt);
verifica('i pesi del ferro hanno le migliaia', ws.getCell(`F${r + 5}`).numFmt === '#,##0');
verifica('il giallo della quota del ferro', sfondo(ws, `G${r + 5}`) === GIALLO);
verifica('il giallo del cippato delle terziarie', sfondo(ws, `I${rPrimaTer}`) === GIALLO);
verifica('la percentuale delle terziarie resta una percentuale', ws.getCell(`M${rPrimaTer}`).numFmt === '0.00%', ws.getCell(`M${rPrimaTer}`).numFmt);
verifica('le unioni rifatte sulle righe nuove', (ws.model.merges || []).includes(`A${r + 2}:B${r + 2}`) && (ws.model.merges || []).includes(`A${rNota}:C${rNota}`), (ws.model.merges || []).join(' '));

console.log('\nIL RIEPILOGO IN ALTO');
verifica('la colonna del mese e le righe', esito.riepilogo.colonna === 'Q' && esito.riepilogo.riga_irigom === 12 && esito.riepilogo.riga_extra === 11, JSON.stringify(esito.riepilogo));
// senza CSS-C nel mese, la formula del riepilogo porta il solo totale delle terziarie
verifica('IRIGOM = totale delle terziarie', testo(ws, 'Q12') === `=K${rTotTer}`, testo(ws, 'Q12'));
verifica('EXTRA RACCOLTA col suo valore', numero(ws, 'Q11') === 460);
verifica('il verde lo prende da luglio', sfondo(ws, 'Q12') === 'FF70AD47' && sfondo(ws, 'Q11') === 'FF70AD47');
verifica('luglio non e\' stato toccato', testo(ws, 'O12') === '=I32+K49');
verifica('l\'extra del mese del formulario e\' stata svuotata', testo(ws, 'O11') === '', testo(ws, 'O11'));
verifica('e lo dice', esito.avvisi.some(a => /EXTRA RACCOLTA di LUGLIO svuotata \(460 kg\)/.test(a)), esito.avvisi.join(' | '));

console.log('\nUN MESE DIVERSO: CSS-C SI\', EXTRA NO');
const settembre = {
  versione: 1, anno: 2026, mese: 'Settembre', partenza: '2026-09-28',
  ferro: [{ data: '2026-09-02', trasportatore: 'SMOCO', destinatario: 'TRS', formulario: 'X1', peso_kg: 27500, quota_kg: 3040 }],
  cssc: [{ ddt: '412/2026', parte: '', data: '2026-09-10', cssc_kg: 24000, ferro_kg: 9000 }],
  terziarie: [{ terziaria: 'TER26160001', trasportatore: 'SMOCO', destinatario: 'AKCANSA', allegato: 2, peso_allegato_kg: 28000, data: '2026-09-28', cippato_kg: 27000, ferro_kg: 4800 }],
  extra: null, totale_portale_kg: 33000 + 31800,
};
const esito2 = await scriviBloccoNelFile(await fileDiProva(), settembre);
const ws2 = await rileggi(esito2.bytes);
const r2 = esito2.riga_inizio;
const rDdt = r2 + 11;
verifica('il DDT del CSS-C', testo(ws2, `A${rDdt}`) === 'DDT 412/2026' && numero(ws2, `G${rDdt}`) === 24000 && numero(ws2, `H${rDdt}`) === 9000, testo(ws2, `A${rDdt}`));
verifica('il totale del DDT', testo(ws2, `I${rDdt}`) === `=SUM(G${rDdt}:H${rDdt})` && testo(ws2, `J${rDdt}`) === 'DA PFU');
verifica('le date del DDT', numero(ws2, `E${rDdt}`) === numero(ws2, `F${rDdt}`) && ws2.getCell(`E${rDdt}`).numFmt === 'dd/mm/yyyy');
// La percentuale del CSS-C sta in K, dove la mettono i mesi gia' nel foglio.
verifica('la percentuale di ferro del DDT', testo(ws2, `K${rDdt}`) === `=H${rDdt}/I${rDdt}` && ws2.getCell(`K${rDdt}`).numFmt === '0.00%', `${testo(ws2, `K${rDdt}`)} ${ws2.getCell(`K${rDdt}`).numFmt}`);
verifica('il totale del CSS-C somma la sua riga', testo(ws2, `I${rDdt + 1}`) === `=SUM(I${rDdt}:I${rDdt})`, testo(ws2, `I${rDdt + 1}`));
verifica('senza extra raccolta il riepilogo non la tocca', numero(ws2, 'S11') === null && testo(ws2, 'S12') === `=I${rDdt + 1}+K${esito2.riga_fine}`, testo(ws2, 'S12'));
verifica('la colonna del mese e\' quella di settembre', esito2.riepilogo.colonna === 'S' && !esito2.avvisi.length);

console.log('\nQUANDO NON SI PUO\' SCRIVERE');
await rifiuta('un mese che non esiste', async () => scriviBloccoNelFile(await fileDiProva(), { ...dati, mese: 'Pioggia' }), 'Non riconosco il mese');
await rifiuta('un file senza il foglio DICHIARAZIONI', async () => scriviBloccoNelFile(await fileDiProva({ senzaFoglio: true }), dati), 'non c\'e\' il foglio DICHIARAZIONI');
await rifiuta('un foglio senza i blocchi dei mesi prima', async () => scriviBloccoNelFile(await fileDiProva({ soloTitolo: true }), dati), 'non trovo le righe da cui copiare i formati');
await rifiuta('lo stesso mese due volte', () => scriviBloccoNelFile(esito.bytes, dati), 'c\'e\' gia\' il blocco AGOSTO 2026');
await rifiuta('i totali che non tornano', async () => scriviBloccoNelFile(await fileDiProva(), { ...dati, totale_portale_kg: 999999 }), 'non tornano con i dati della pratica');
await rifiuta('un file che non e\' un Excel', async () => scriviBloccoNelFile(new Uint8Array([1, 2, 3, 4]), dati), 'non e\' un file Excel');

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
