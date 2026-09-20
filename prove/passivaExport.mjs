// Prova dell'export della fatturazione passiva (src/lib/passivaExport.js): i
// totali del foglio sono quelli del calcolo, un blocco per prestazione. npm run prove
import { calcolaPassivaMese, indiceMesePassiva } from '../base44/shared/passivaCalcolo.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// la libreria importa xlsx e l'alias @: qui si prova la sola costruzione delle righe
const sorgente = (await import('node:fs')).readFileSync(new URL('../src/lib/passivaExport.js', import.meta.url), 'utf8')
  .replace("import * as XLSX from 'xlsx';", 'const XLSX = null;');
const { righePassiva } = await import('data:text/javascript;base64,' + Buffer.from(sorgente).toString('base64'));

const base = { stato: 'terminato', cer: '160103', classe: 'A' };
const dati = {
  primarieRete: [
    { ...base, id: '1', id_ordine: 'ET1', numero_fir: 'F1', peso_effettivo: 10000, trasporto_finito_il: '2026-06-10T00:00:00Z', trasportatore: 'ALFA SRL', destinazione: 'BETA IMPIANTI', provincia: 'BA', tipo_destinazione: 'imp', automezzo: 'AA111AA' },
    { ...base, id: '2', id_ordine: 'ET2', numero_fir: 'F2', peso_effettivo: 2500, trasporto_finito_il: '2026-06-11T00:00:00Z', trasportatore: 'ALFA SRL', destinazione: 'BETA IMPIANTI', provincia: 'BA', tipo_destinazione: 'imp', automezzo: 'AA111AA' },
  ],
  primarieAci: [], secondarieAll: [], extraRaccoltaAll: [],
  tariffeAll: [{ id: 't1', direzione: 'PASSIVA', stato: 'attivo', prestazione: 'RACCOLTA', fornitore_nome: 'Alfa s.r.l.', tipologia: 'RETE', valore: 60, unita_misura: '€/t' }, { id: 't2', direzione: 'PASSIVA', stato: 'attivo', prestazione: 'TRATTAMENTO', fornitore_nome: 'Beta Impianti', tipologia: 'RETE', valore: 80, unita_misura: '€/t' }],
  fornitoriAll: [{ ragione_sociale: 'ALFA SRL', stato: 'attivo' }, { ragione_sociale: 'BETA IMPIANTI', stato: 'attivo' }],
};
const result = calcolaPassivaMese(dati, 2026, indiceMesePassiva('Giugno'), 'Giugno', 'RETE');
const tipi = [];
const righe = righePassiva(result, tipi);
const testo = righe.map(r => (r || []).join('|'));
verifica('in testa il canale, il mese e il totale del calcolo (750 + 1000)', righe[0][0] === 'RETE' && righe[0][1] === 'Giugno 2026' && righe[0][6] === 1750, JSON.stringify(righe[0]));
verifica('i tre blocchi del modello dell\'amministrazione', testo.some(t => t.startsWith('RACCOGLITORI|Totale [t]')) && testo.some(t => t.startsWith('IMPIANTI \\ STOCCAGGI')) && testo.some(t => t.startsWith('PRODUTTORE|TRASPORTATORE|DESTINATARIO')));
const iAlfa = righe.findIndex(r => r && r[0] === 'ALFA SRL');
verifica('fornitore col totale, poi il dettaglio con prezzo e importo', righe[iAlfa][1] === 12.5 && righe[iAlfa][5] === 750 && righe[iAlfa + 1][2] === 60 && righe[iAlfa + 1][3] === '€\\t' && righe[iAlfa + 1][5] === 750, JSON.stringify(righe.slice(iAlfa, iAlfa + 2)));
const totali = righe.filter(r => r && r[0] === 'Totale complessivo');
verifica('i totali dei blocchi sommano il totale in testa', totali.length === 3 && totali[0][5] === 750 && totali[1][5] === 1000 && totali[2][7] === 0 && totali[0][5] + totali[1][5] + totali[2][7] === righe[0][6]);
verifica('ogni riga sa in che blocco sta, per i formati', tipi.length === righe.length && tipi[0] === 'testa' && tipi[iAlfa] === 'blocco' && tipi[righe.findIndex(r => r && r[0] === 'PRODUTTORE')] === 'secondarie');

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
