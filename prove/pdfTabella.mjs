// Prova del PDF di dettaglio (src/lib/esportaTabella.js): l'intestazione e il testo
// delle celle devono arrivare interi, non tagliati alla prima riga. Il PDF non si
// salva: si legge il documento in memoria. npm run prove
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const radice = new URL('../', import.meta.url);
const jspdf = pathToFileURL(new URL('node_modules/jspdf/dist/jspdf.node.min.js', radice).pathname.replace(/^\/([A-Za-z]:)/, '$1')).href;

// i formati numerici del gestionale, senza passare dall'alias @
const formati = `
const formatNumber = (num, o = {}) => { const max = o.maximumFractionDigits ?? 3, min = Math.min(o.minimumFractionDigits ?? 2, max); const n = Number(num); if (isNaN(n)) return '0'; const [i, d = ''] = Math.abs(n).toFixed(max).split('.'); let dec = d; while (dec.length > min && dec.endsWith('0')) dec = dec.slice(0, -1); return (n < 0 ? '-' : '') + i.replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.') + (dec ? ',' + dec : ''); };
const formatKg = (v) => formatNumber(Math.round(Number(v) || 0), { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const formatIntero = formatKg;
const formatTonnellate = (v) => formatNumber(v, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
`;
const sorgente = readFileSync(new URL('src/lib/esportaTabella.js', radice), 'utf8')
  .replace("import { formatNumber, formatKg, formatTonnellate, formatIntero } from '@/lib/utils';", formati)
  .replace(/await import\('jspdf'\)/g, `await import('${jspdf}').then(m => m.default || m)`)
  .replace(/await import\('xlsx'\)/g, 'null')
  // invece di scaricare il file si tiene il testo del documento
  .replace(/doc\.save\(`\$\{nomeSicuro\(nomeFile\)\}\.pdf`\);/g, 'globalThis.__pdf = doc.output();');
const { esportaTabellaPdf } = await import('data:text/javascript;base64,' + Buffer.from(sorgente).toString('base64'));

// le colonne vere del report della fatturazione attiva, con l'unita' di misura nel titolo
const colonne = [
  { titolo: 'Ordine', valore: r => r.ordine, tipo: 'testo', peso: 1.2 },
  { titolo: 'Data Fine Trasporto', valore: r => r.data, tipo: 'data', peso: 1 },
  { titolo: 'Numero FIR', valore: r => r.fir, tipo: 'testo', peso: 1 },
  { titolo: 'Quantità (kg)', valore: r => r.kg, tipo: 'kg', peso: 0.9 },
  { titolo: 'Prezzo Unitario (Euro/TON)', valore: r => r.prezzo, tipo: 'euro', peso: 1 },
  { titolo: 'Prezzo Totale', valore: r => r.totale, tipo: 'euro', peso: 1 },
  { titolo: 'Note', valore: r => r.note, tipo: 'testo', peso: 2.4 },
];
// una nota da due o tre righe: nell'Excel si legge tutta, nel PDF non deve sparire
const nota = 'Sovracosto di raccolta concordato con il consorzio per il ritiro fuori sede, con rientro a vuoto e attesa in impianto';
const righe = [
  { ordine: 'ET26123456', data: '2026-07-10T00:00:00.000Z', fir: 'FIR0001', kg: 23400, prezzo: 202, totale: 4726.8, note: nota },
  { ordine: 'ET26123457', data: '2026-07-11T00:00:00.000Z', fir: 'FIR0002', kg: 1250, prezzo: 202, totale: 252.5, note: '' },
];
await esportaTabellaPdf({
  nomeFile: 'prova', intestazione: 'SMOCO S.r.l.', titolo: 'Fatturazione Rete — Luglio 2026', sottotitolo: 'prova',
  colonne, righe, totali: { etichetta: 'Totale', valori: { 3: 24650, 5: 4979.3 } },
});
const pdf = globalThis.__pdf;
// Nel PDF il testo sta fra parentesi tonde: le parentesi del testo sono protette da
// una barra rovescia e le lettere accentate sono scritte in ottale (\340 per la à).
const leggi = (s) => [...new Set((s.match(/\((?:\\.|[^()\\])*\)\s*Tj/g) || [])
  .map(x => x.slice(1, x.lastIndexOf(')'))
    .replace(/\\(\d{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)))
    .replace(/\\([()\\])/g, '$1')))];
const scritte = leggi(pdf);
const c_e = (t) => scritte.some(s => s.includes(t));

verifica("l'unita' di misura resta nell'intestazione", c_e('Euro/TON'), `— scritte: ${scritte.filter(s => /Prezzo/.test(s)).join(' | ')}`);
verifica("l'intestazione lunga va a capo, non viene tagliata", c_e('Prezzo Unitario') && c_e('(Euro/TON)'));
verifica('le altre intestazioni ci sono tutte', ['Ordine', 'Numero FIR', 'Prezzo Totale', 'Note'].every(t => c_e(t)));
verifica('la nota lunga non si ferma alla prima riga', c_e('rientro a vuoto') && c_e('attesa in impianto'));
verifica('i numeri sono in formato italiano', c_e('23.400') && c_e('4.726,80'));
verifica('il totale viene scritto', c_e('Totale') && c_e('24.650') && c_e('4.979,30'));
verifica('una pagina sola per due righe', (pdf.match(/\/Type\s*\/Page[^s]/g) || []).length === 1);

// Il caso peggiore: l'ACI ha tredici colonne, quindi strette. Nessun titolo deve
// perdere pezzi per strada, nemmeno l'unita' di misura.
const colonneAci = [
  ['Regione', 0.9], ['Fatturante', 0.9], ['Periodo', 0.9], ['Tipo', 0.9], ['Ticket n°', 0.9], ['Ordine', 1],
  ['Data Fine Trasporto', 1], ['Numero FIR', 1.2], ['Classe', 1.1], ['Quantità (kg)', 0.8],
  ['Prezzo Unitario (Euro/TON)', 1.1], ['Prezzo Totale', 0.9], ['Note', 1.4],
].map(([titolo, peso]) => ({ titolo, peso, tipo: /Quantit/.test(titolo) ? 'kg' : /Prezzo/.test(titolo) ? 'euro' : 'testo', valore: () => '' }));
await esportaTabellaPdf({ nomeFile: 'prova', titolo: 'Fatturazione ACI — Luglio 2026', colonne: colonneAci, righe: [] });
const paroleAci = leggi(globalThis.__pdf);
const persi = colonneAci
  .map(c => c.titolo.split(/\s+/).filter(p => !paroleAci.some(s => s.includes(p))))
  .flat();
verifica('ACI a tredici colonne: nessun titolo perde pezzi', persi.length === 0, `— manca: ${persi.join(' ')}`);

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
