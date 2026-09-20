// Prova dei report della fatturazione attiva (src/lib/fatturazioneExport.js): la
// tabella da cui nascono sia l'Excel sia il PDF, un report per canale. npm run prove
import { readFileSync } from 'node:fs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// la libreria importa xlsx e gli alias @: qui si prova la sola costruzione della tabella
const sorgente = readFileSync(new URL('../src/lib/fatturazioneExport.js', import.meta.url), 'utf8')
  .replace("import * as XLSX from 'xlsx';", 'const XLSX = null;')
  .replace("import { formattaPesi } from '@/lib/formatoExcel';", 'const formattaPesi = null;')
  .replace("import { esportaTabellaPdf } from '@/lib/esportaTabella';", 'const esportaTabellaPdf = null;');
const { tabellaAttiva, nomeFileAttiva } = await import('data:text/javascript;base64,' + Buffer.from(sorgente).toString('base64'));

const base = { data_fine_trasporto: '2026-07-10T00:00:00.000Z', numero_fir: 'FIR1', classe: 'P', unita_misura: '€/t', fattore_conversione: 1000 };
const righeRete = [
  { ...base, ordine: 'ET1', servizio_ecotyre: 'TRASP_TRATT', quantita: 2300, tariffa_valore: 202, totale: 464.6 },
  { ...base, ordine: 'ET2', servizio_ecotyre: 'TRASP', quantita: 3840, tariffa_valore: 202, totale: 775.68 },
  { ...base, ordine: 'ET3', servizio_ecotyre: 'TRASP_TRATT', quantita: 1000, tariffa_valore: 202, totale: 202, sospesa: true },
];
const rete = tabellaAttiva('RETE', righeRete, 2026, 'Luglio');
const col = (t, nome) => t.colonne.findIndex(c => c.titolo === nome);
verifica('rete: nove colonne, le sospese restano fuori', rete.colonne.length === 9 && rete.righe.length === 2);
verifica('rete: il tipo di servizio e\' quello della riga, non fisso', rete.righe[0][col(rete, 'Tipo')] === 'Trasp.+Tratt.' && rete.righe[1][col(rete, 'Tipo')] === 'Trasp.');
verifica('rete: prezzo a tonnellata (202), quantita\' in chili', rete.righe[0][col(rete, 'Prezzo Unitario (Euro/TON)')] === 202 && rete.righe[0][col(rete, 'Quantità (kg)')] === 2300);
verifica('rete: il totale esclude le sospese e sta sotto "Prezzo Totale"', rete.totale === 1240.28 && rete.colonne[rete.iTotale].titolo === 'Prezzo Totale');

const aci = tabellaAttiva('ACI', [{ ...base, ordine: 'EA1', regione: 'Puglia', fatturante: 'ECOTYRE', ticket_n: '162399-21', servizio_ecotyre: 'TRASP_TRATT', classe: 'PFU Autodemolizione', quantita: 2640, tariffa_valore: 230, totale: 607.2, note: '' }], 2026, 'Luglio');
verifica('aci: tredici colonne col ticket, prezzo a tonnellata per regione', aci.colonne.length === 13 && aci.righe[0][col(aci, 'Ticket n°')] === '162399-21' && aci.righe[0][col(aci, 'Prezzo Unitario (Euro/TON)')] === 230);
verifica('aci: il totale sta sotto "Prezzo Totale", non sotto le Note', aci.colonne[aci.iTotale].titolo === 'Prezzo Totale' && aci.totale === 607.2);

const extra = tabellaAttiva('EXTRA_RACCOLTA', [
  { ...base, ordine: 'BSDCL002230PQ', quantita: 460, tariffa_valore: 202, totale: 92.92, note: "Prezzo scritto sull'intervento" },
  { ...base, ordine: 'BSDCL002230PQ', descrizione: 'Sovracosto raccolta', quantita: 0, tariffa_valore: 120, totale: 120, unita_misura: '€ a corpo', note: "Sovracosto raccolta scritto sull'intervento" },
], 2026, 'Luglio');
verifica('extra: intervento e sovracosto sono due righe, e il totale li somma (212,92)', extra.righe.length === 2 && extra.totale === 212.92 && /Sovracosto/.test(extra.righe[1][col(extra, 'Note')]) && extra.colonne[extra.iTotale].titolo === 'Prezzo Totale');
verifica('un file per canale e per formato', nomeFileAttiva('ACI', 2026, 'Luglio', 'pdf') === 'Fatturazione_ACI_Luglio_2026.pdf' && nomeFileAttiva('RETE', 2026, 'Luglio', 'xlsx') === 'Fatturazione_RETE_Luglio_2026.xlsx');
verifica('ogni colonna ha il suo tipo, per i formati del PDF', [rete, aci, extra].every(t => t.colonne.every(c => ['testo', 'kg', 'euro'].includes(c.tipo)) && t.righe.every(r => r.length === t.colonne.length)));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
