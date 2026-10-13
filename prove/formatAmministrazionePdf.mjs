// IL PREZZO NEL PDF DEL FORMAT AMMINISTRAZIONE, CON I SUOI DECIMALI (verifica del
// 12/10/2026 sul PDF dell'extra raccolta).
//
// Il PDF del «format amministrazione» dell'attiva scriveva il prezzo unitario col
// tipo 'euro', fisso a due decimali: la tariffa di rete al chilo, 0,202 euro,
// usciva «0,20 €», mentre l'Excel dello stesso foglio dice 0,2020. Il prezzo ora
// esce con i suoi decimali, da due a quattro (il tipo 'prezzoLibero' del corredo,
// come cifreItaliane(v, 2, 4)); colonne, valori, totali e l'Excel non cambiano.
// La tabella (src/lib/formatAmministrazione.js) dichiara il tipo del PDF accanto a
// quello dell'Excel; chi scrive il PDF (formatAmministrazioneExport.js) lo usa.
// Qui si fa il PDF vero, con jspdf, e se ne leggono le celle. npm run prove
import { fileURLToPath, pathToFileURL } from 'node:url';
import { caricaLibPagine } from './dati/libPagine.mjs';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = JSON.stringify;

const { tabellaAmministrazione } = await caricaLibPagine('lib/formatAmministrazione');

console.log('LA TABELLA: IL TIPO DEL PDF ACCANTO A QUELLO DELL\'EXCEL');
for (const tipologia of ['RETE', 'ACI']) {
  const t = tabellaAmministrazione(tipologia, [], 2026, 'Settembre');
  const prezzo = t.colonne.find(c => /^Prezzo Unitario/.test(c.titolo));
  verifica(`${tipologia}: il prezzo unitario resta 'euro' per l'Excel`, prezzo && prezzo.tipo === 'euro', J(prezzo));
  verifica(`${tipologia}: e nel PDF si scrive coi suoi decimali`, prezzo && prezzo.tipoPdf === 'prezzoLibero', J(prezzo));
  verifica(`${tipologia}: il totale resta in euro a due decimali`, t.colonne[t.iTotale].tipo === 'euro' && !t.colonne[t.iTotale].tipoPdf, J(t.colonne[t.iTotale]));
}

console.log('IL PDF VERO');
const jspdf = pathToFileURL(qui('../node_modules/jspdf/dist/jspdf.node.min.js')).href;
globalThis.__TABELLA = await caricaLibPagine('lib/esportaTabella', [
  [/await import\('jspdf'\)/g, `await import('${jspdf}').then(m => m.default || m)`],
  [/doc\.save\(`\$\{nomeSicuro\(nomeFile\)\}\.pdf`\);/g, 'globalThis.__PDF = doc.output();'],
]);
const lib = await caricaLibPagine('lib/formatAmministrazioneExport', [["await import('@/lib/esportaTabella')", 'globalThis.__TABELLA']]);
const finestra = globalThis.window;
delete globalThis.window;
const celle = () => [...new Set((String(globalThis.__PDF).match(/\((?:\\.|[^()\\])*\)\s*Tj/g) || [])
  .map(x => x.slice(1, x.lastIndexOf(')')).replace(/\\(\d{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8))).replace(/\x80/g, '€')))];
try {
  const rete = { data_fine_trasporto: '2026-09-10T00:00:00.000Z', numero_fir: 'FIR1', classe: 'P', unita_misura: '€/t', fattore_conversione: 1000, ordine: 'ET1', servizio_ecotyre: 'TRASP_TRATT', quantita: 2300, tariffa_valore: 202, totale: 464.6, regione: 'Campania' };
  await lib.exportAmministrazioneAttivaPdf('RETE', [rete], 2026, 'Settembre');
  const r = celle();
  verifica('rete: 202 €/t si scrivono 0,202 € al chilo, non 0,20 €', r.includes('0,202 €') && !r.includes('0,20 €'), J(r.filter(t => /^0,2/.test(t))));
  verifica('rete: la riga e il totale restano 464,60 €', r.includes('464,60 €'), J(r.filter(t => /^464/.test(t))));
  verifica('rete: i chili restano 2.300', r.includes('2.300'), J(r.filter(t => /2\.300/.test(t))));

  const aci = [
    { regione: 'Puglia', ordine: 'ET26126228', data_fine_trasporto: '2026-09-01T00:00:00Z', numero_fir: 'BSDCL002361RK', classe: 'PFU Autodemolizione', quantita: 2140, tariffa_valore: 240, unita_misura: '€/t', totale: 513.6 },
    { regione: 'Calabria', ordine: 'ET9', data_fine_trasporto: '2026-09-02T00:00:00Z', numero_fir: 'X9', classe: 'PFU Autodemolizione', quantita: 1000, tariffa_valore: 237.125, unita_misura: '€/t', totale: 237.13 },
  ];
  await lib.exportAmministrazioneAttivaPdf('ACI', aci, 2026, 'Settembre');
  const a = celle();
  verifica('aci: un prezzo tondo a tonnellata resta 240,00 €', a.includes('240,00 €'), J(a.filter(t => /^2[34]\d,/.test(t))));
  verifica('aci: un prezzo con tre decimali non si arrotonda: 237,125 €', a.includes('237,125 €'), J(a.filter(t => /^237,/.test(t))));
  verifica('aci: il totale resta 750,73 €', a.includes('750,73 €'), J(a.filter(t => /^750/.test(t))));
} finally {
  globalThis.window = finestra;
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
