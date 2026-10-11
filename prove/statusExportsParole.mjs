// Prova del PDF E DELLA PRESENTAZIONE DELL'ANDAMENTO DI TARGET & STATUS
// (src/lib/statusExports.js, chiusura dell'audit, 11/10/2026).
//
// La pagina e l'Excel dicono «Residuo», «Scarto del mese sull'atteso» e
// «Primarie RETE ricevute dagli impianti» (la tabella conta le sole primarie: non
// e' il «Conferito RETE» delle Giacenze, che comprende anche le secondarie in
// arrivo). PDF e presentazione dicevano ancora «Leftover», «Leftover
// Complessivo Annuo», «Delta Mese In Corso» (target meno raccolto, il segno
// opposto dello scarto delle card), «Conferito RETE» e «Totale Conferito [t]».
// E nella presentazione un anno senza contratto, che ora ha il target null,
// usciva «0,00»: un valore che manca diventato zero, dove la card dice «—».
// Qui si impacchetta statusExports.js con jsPDF e pptxgenjs finti e si guarda
// che cosa scrivono davvero. npm run prove
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { oggiRoma } from '../base44/shared/giornoItaliano.ts';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// src/lib/utils.js guarda window appena caricato
if (typeof globalThis.window === 'undefined') globalThis.window = { self: 1, top: 1 };
const FINTI = {
  pptx: `export default class { constructor() { this.slides = []; globalThis.__PPT = this; }
    defineLayout() {} addSlide() { const s = { testi: [], tabelle: [], addText(t) { this.testi.push(String(t)); }, addTable(r) { this.tabelle.push(r); } }; this.slides.push(s); return s; }
    async writeFile(o) { this.fileName = o.fileName; } }`,
  client: 'export const base44 = { functions: { invoke: async () => ({ data: {} }) } };',
  pdf: 'export async function esportaSezioniPdf(a) { globalThis.__PDF = a; }',
};
const pacco = await build({
  entryPoints: [qui('../src/lib/statusExports.js')], bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
  plugins: [{ name: 'finti', setup(b) {
    b.onResolve({ filter: /^pptxgenjs$/ }, () => ({ path: 'pptx', namespace: 'finto' }));
    b.onResolve({ filter: /^@\/api\/base44Client$/ }, () => ({ path: 'client', namespace: 'finto' }));
    b.onResolve({ filter: /^@\/lib\/esportaTabella$/ }, () => ({ path: 'pdf', namespace: 'finto' }));
    b.onResolve({ filter: /^@\// }, (a) => ({ path: qui(`../src/${a.path.slice(2)}.js`) }));
    b.onLoad({ filter: /.*/, namespace: 'finto' }, (a) => ({ contents: FINTI[a.path], loader: 'js' }));
  } }],
});
const lib = await import('data:text/javascript;base64,' + Buffer.from(pacco.outputFiles[0].text).toString('base64'));

const righe = [{ regione: 'Campania', raccoglitore: 'EMMESSE SRL', targetAnnuo: 1200, raccoltoTotale: 1000.5, leftover: 199.5 }];
const regioni = [{ regione: 'Campania', totale: 1000.5 }];
const impianti = [{ impianto: 'IRIGOM SRL', totale: 1000.5 }];
const testiPpt = () => globalThis.__PPT.slides.flatMap(s => [...s.testi, ...s.tabelle.flat(2).map(c => (c && typeof c === 'object' ? c.text : String(c)))]);
const cellaPpt = (etichetta) => { for (const s of globalThis.__PPT.slides) for (const t of s.tabelle) for (const r of t) if (r[0] === etichetta) return r[1]; return undefined; };

console.log('IL PDF');
// il riepilogo come lo costruisce TargetStatus.jsx (riepilogoPdf), per il 2027 senza contratto
await lib.exportPDF([
  { etichetta: 'Target annuo del contratto', valore: null, tipo: 't' },
  { etichetta: 'Raccolto RETE', valore: 1000.5, tipo: 't' },
  { etichetta: "Residuo dell'anno", valore: null, tipo: 't' },
  { etichetta: "Scarto del mese sull'atteso", valore: -12.25, tipo: 't' },
], righe, regioni, impianti, 2027);
const pdf = globalThis.__PDF;
const colonne = pdf.sezioni.flatMap(s => s.colonne.map(c => c.titolo));
const titoli = pdf.sezioni.map(s => s.titolo);
verifica('la tabella degli impianti si chiama come nella pagina', titoli.includes('Primarie RETE ricevute dagli impianti') && colonne.includes('Primarie RETE ricevute'), titoli.join(' | '));
verifica('niente «Conferito RETE» ne\' «Leftover»: «Residuo»', !colonne.some(c => /Conferito|Leftover/.test(c)) && colonne.includes('Residuo'), colonne.join(' | '));
verifica('il PDF spiega che non e\' il Conferito RETE delle Giacenze', pdf.note.some(n => /Non è il «Conferito RETE» delle Giacenze/.test(n)), pdf.note.join(' | '));
verifica('un valore che manca nel riepilogo esce «—», i numeri restano numeri', pdf.riepilogo[0].valore === '—' && pdf.riepilogo[2].valore === '—' && pdf.riepilogo[1].valore === 1000.5 && pdf.riepilogo[3].valore === -12.25, JSON.stringify(pdf.riepilogo));
verifica('il file porta l\'anno scelto', pdf.nomeFile === 'target-status-2027', pdf.nomeFile);
await lib.exportPDF([], [], [], []);
verifica('senza anno, l\'anno italiano di oggi', globalThis.__PDF.nomeFile === `target-status-${oggiRoma().slice(0, 4)}`, globalThis.__PDF.nomeFile);

console.log('LA PRESENTAZIONE');
// le card come le costruisce TargetStatus.jsx per il 2027 senza contratto e senza dati
const kpis2027 = { targetAnnuoTotale: null, fonteTarget: null, targetDaConfermare: false, raccoltoTotale: 0, residuoAnno: null, scartoMese: null, attesoMese: null, giornoDati: '', leftoverTotale: null, deltaMeseCorrente: 0 };
await lib.exportPPT(kpis2027, righe, regioni, impianti, 2027);
verifica('anno senza contratto: target e residuo «—», non 0,00', cellaPpt('Target annuo del contratto') === '—' && cellaPpt("Residuo dell'anno") === '—', `${cellaPpt('Target annuo del contratto')} / ${cellaPpt("Residuo dell'anno")}`);
verifica('senza dati lo scarto del mese e\' «—», non il vecchio delta a zero', cellaPpt("Scarto del mese sull'atteso") === '—', cellaPpt("Scarto del mese sull'atteso"));
verifica('e la presentazione dice perche\' manca il target', testiPpt().some(t => /non è inserito: il target non c'è/.test(t)));
// e con i numeri: residuo e scarto sono quelli delle card, col segno delle card
const kpis2026 = { targetAnnuoTotale: 11550, fonteTarget: 'contratto', targetDaConfermare: false, raccoltoTotale: 8000, residuoAnno: 3550, scartoMese: -120.5, attesoMese: 900, giornoDati: '2026-10-07', leftoverTotale: 3550, deltaMeseCorrente: 777 };
await lib.exportPPT(kpis2026, righe, regioni, impianti, 2026);
verifica('target, raccolto e residuo come le card', cellaPpt('Target annuo del contratto') === '11.550,00' && cellaPpt("Raccolto RETE nell'anno") === '8.000,00' && cellaPpt("Residuo dell'anno") === '3.550,00');
verifica('lo scarto e\' raccolto meno atteso (-120,50), non il delta di prima (777)', cellaPpt("Scarto del mese sull'atteso") === '-120,50', cellaPpt("Scarto del mese sull'atteso"));
verifica('dice fin dove arrivano i dati, all\'italiana', testiPpt().some(t => /dati fino al 07\/10\/2026/.test(t)));
const tutto = testiPpt().join(' | ');
verifica('nessuna parola vecchia nelle slide', !/Leftover|Delta Mese|Totale Conferito|Conferito RETE \[|T\.Annuo|Totale Progressivo/.test(tutto), tutto.slice(0, 300));
verifica('le tabelle degli impianti e dei raccoglitori con le intestazioni della pagina', tutto.includes('Primarie RETE ricevute [t]') && tutto.includes('Residuo [t]') && tutto.includes('Primarie RETE ricevute dagli impianti'));
verifica('il nome del file con l\'anno e il giorno italiano', globalThis.__PPT.fileName === `Target_Status_2026_${oggiRoma()}.pptx`, globalThis.__PPT.fileName);
// una pagina che passasse ancora i nomi di prima: il residuo si legge, lo scarto no
await lib.exportPPT({ targetAnnuoTotale: 11550, raccoltoTotale: 8000, leftoverTotale: 3550, deltaMeseCorrente: 777 }, [], [], []);
verifica('con i nomi di prima: residuo dal leftover (stesso segno), scarto «—» invece del segno sbagliato', cellaPpt("Residuo dell'anno") === '3.550,00' && cellaPpt("Scarto del mese sull'atteso") === '—');

console.log('IL SORGENTE');
const sorgente = readFileSync(qui('../src/lib/statusExports.js'), 'utf8').replace(/\r/g, '').split('\n').filter(r => !r.trim().startsWith('//')).join('\n');
verifica('nessun giorno del dispositivo', !/new Date\(/.test(sorgente), (sorgente.match(/.*new Date\(.*/g) || []).join('\n'));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
