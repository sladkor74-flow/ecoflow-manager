// Prova dell'esportazione del foglio DICHIARAZIONI intero
// (src/lib/foglioDichiarazioni.js): due mesi finti, uno dal caso vero di agosto
// 2026, si esportano e si rileggono con exceljs. Devono tornare l'ordine dei
// mesi, i totali del riepilogo contro le righe dei blocchi e l'elenco di quello
// che il gestionale non ha. npm run prove
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { componiMese } from '../src/lib/praticaIrigom.js';
import { bloccoDaPratica, esportaFoglioDichiarazioni } from '../src/lib/foglioDichiarazioni.js';

const ExcelJS = createRequire(import.meta.url)('exceljs');
const A = JSON.parse(readFileSync(new URL('./dati/irigom_agosto_2026.json', import.meta.url), 'utf8'));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// --- Le pratiche finte -------------------------------------------------------
const agosto = componiMese({ criterio: 'ordine', riga: A.riga, ferro: A.ferro, allegati: A.allegati, ddt: [], lettura: 'uscite', extra: A.extra, terziarie: A.terziarie });
// Giugno: una pratica scritta a mano, piccola e senza extra raccolta.
const giugno = {
  ferro: { tabella: [{ data: '2026-06-05', trasportatore: 'SMOCO', destinatario: 'TRS', formulario: 'GIU001', kg: 26000, quota_kg: 5000 }] },
  cssc: { righe: [{ ddt: '123', parte: '', data: '2026-06-10', cssc_kg: 20000, ferro_kg: 1000 }] },
  terziarie: {
    righe: [
      { terziaria: 'TER26100001', trasportatore: 'SMOCO', destinatario: 'AKCANSA', allegato: 1, peso_allegato_kg: 27000, data: '2026-06-20', cippato_kg: 27000, ferro_kg: 3000 },
      { terziaria: 'TER26100002', trasportatore: 'SMOCO', destinatario: 'AKCANSA', allegato: 2, peso_allegato_kg: 26000, data: '2026-06-20', cippato_kg: 26000, ferro_kg: 2000 },
    ],
  },
  // l'extra raccolta di giugno viene da un formulario di maggio: la nota deve dirlo
  extra: { totale_kg: 1000, cippato_kg: 800, ferro_kg: 200, terziaria: 'TER26100002', allegato: 2, chiusura_terziaria_kg: 29000, formulari: [{ formulario: 'MAG001', peso_kg: 1000, fine_trasporto: '2026-05-28' }] },
  portale_kg: 80000,
};
const GIUGNO_CSSC = 21000;
const GIUGNO_TER = 58000;

const pratica = (mese, composta, campi = {}) => ({
  anno: 2026, mese, stato: 'registrata', versione: 1,
  rete_kg: (composta.cssc.righe || []).reduce((s, r) => s + r.cssc_kg + r.ferro_kg, 0) + (composta.terziarie.righe || []).reduce((s, r) => s + r.cippato_kg + r.ferro_kg, 0),
  extra_kg: composta.extra ? composta.extra.totale_kg : 0,
  nave_json: JSON.stringify({ partenza: mese === 'Agosto' ? '2026-08-27' : '' }),
  dati_json: JSON.stringify(composta),
  registrata_il: `2026-0${mese === 'Agosto' ? 9 : 7}-10`,
  ...campi,
});
// Aprile: sono usciti solo metalli ferrosi, nessuna gomma. A portale non si
// carica nulla e il blocco non ha terziarie.
const aprile = {
  ferro: { tabella: [{ data: '2026-04-08', trasportatore: 'SMOCO', destinatario: 'TRS', formulario: 'APR001', kg: 27000, quota_kg: 3040 }] },
  cssc: { righe: [] }, terziarie: { righe: [] }, extra: null, portale_kg: 0,
};
const pratiche = [
  pratica('Aprile', aprile),
  pratica('Giugno', giugno),
  // La versione vecchia di agosto: sostituita, non deve entrare nel foglio.
  pratica('Agosto', { ...agosto, cssc: { righe: [] }, terziarie: { righe: [] } }, { stato: 'sostituita', versione: 1, motivo_sostituzione: 'rifatta' }),
  pratica('Agosto', agosto, { versione: 2 }),
  // Una pratica di un altro anno: non c'entra.
  pratica('Maggio', giugno, { anno: 2025 }),
];
const dichiarazioni = [
  { sito: 'Irigom', anno: 2026, mese: 'Giugno', canale: 'RETE', quantita_kg: 80000, caricata_inviata: true },
  { sito: 'Irigom', anno: 2026, mese: 'Agosto', canale: 'RETE', quantita_kg: 534600, caricata_inviata: true },
  { sito: 'Irigom', anno: 2026, mese: 'Agosto', canale: 'EXTRA_RACCOLTA', quantita_kg: 460, caricata_inviata: false },
  // Marzo: il portale ha la dichiarazione ma il gestionale non ha la pratica.
  { sito: 'Irigom', anno: 2026, mese: 'Marzo', canale: 'RETE', quantita_kg: 262720, caricata_inviata: true },
];

// --- bloccoDaPratica ---------------------------------------------------------
console.log('I DATI DEL BLOCCO DA UNA PRATICA SALVATA');
const dati = bloccoDaPratica(pratiche.find(p => p.mese === 'Agosto' && p.versione === 2));
verifica('mese e anno dalla pratica', dati.mese === 'Agosto' && dati.anno === 2026);
verifica('la partenza della nave arriva dal nave_json', dati.partenza === '2026-08-27');
verifica('diciassette terziarie e quattro formulari di ferro', dati.terziarie.length === 17 && dati.ferro.length === 4);
verifica('l\'extra raccolta e\' quella di agosto', dati.extra && dati.extra.totale_kg === 460 && dati.extra.terziaria === 'TER26154141');
verifica('il totale a portale e\' 534.600', dati.totale_portale_kg === 534600, String(dati.totale_portale_kg));
verifica('una pratica senza dati_json non da\' un blocco', bloccoDaPratica({ anno: 2026, mese: 'Luglio' }) === null);

// --- L'esportazione ----------------------------------------------------------
const bytes = await esportaFoglioDichiarazioni({ pratiche, dichiarazioni, anno: 2026 });
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(Buffer.from(bytes));
const ws = wb.getWorksheet('DICHIARAZIONI');
const val = (r, c) => {
  const v = ws.getCell(r, c).value;
  if (v && typeof v === 'object' && v.formula) return '=' + v.formula;
  if (v && typeof v === 'object' && 'result' in v) return v.result;
  return v;
};
const numero = (r, c) => { const v = val(r, c); return typeof v === 'number' ? v : 0; };
const riempimento = (r, c) => { const f = ws.getCell(r, c).fill; return f && f.fgColor ? f.fgColor.argb : ''; };

console.log('\nIL FOGLIO');
verifica('ci sono i due fogli', !!ws && !!wb.getWorksheet('Mesi'), wb.worksheets.map(w => w.name).join('|'));
verifica('il riepilogo ha una colonna per mese', val(1, 3) === 'Gennaio' && val(1, 17) === 'Agosto' && val(1, 25) === 'Dicembre');
verifica('accanto a ogni mese la colonna della dichiarazione caricata', val(1, 4) === 'CARICATA\\INVIATA' && val(1, 18) === 'CARICATA\\INVIATA');
verifica('le due righe del riepilogo', val(2, 2) === 'EXTRA RACCOLTA' && val(3, 2) === 'IRIGOM');

// I titoli dei blocchi, nell'ordine dei mesi
const titoli = [];
for (let r = 1; r <= ws.rowCount; r++) {
  const v = val(r, 1);
  if (typeof v === 'string' && /^[A-Z]+ 2026$/.test(v)) titoli.push({ testo: v, riga: r });
}
console.log('\nI BLOCCHI, IN ORDINE');
verifica('solo i tre mesi che il gestionale ha, in ordine', titoli.length === 3 && titoli.map(t => t.testo).join(' ') === 'APRILE 2026 GIUGNO 2026 AGOSTO 2026', titoli.map(t => `${t.testo}@${t.riga}`).join(' '));
verifica('il primo blocco sta sotto il riepilogo', titoli[0].riga >= 8);
verifica('fra un blocco e l\'altro quattro righe vuote', [1, 2].every(k => [1, 2, 3, 4].every(j => {
  const r = titoli[k].riga - j;
  return [...Array(13).keys()].every(c => val(r, c + 1) === null);
})), titoli.map(t => `${t.testo}@${t.riga}`).join(' '));
verifica('il titolo ha il verde dei mesi gia\' nel foglio', riempimento(titoli[2].riga, 1) === 'FF00B050', riempimento(titoli[2].riga, 1));
verifica('l\'intestazione delle terziarie e\' verde e centrata', (() => {
  for (let r = titoli[2].riga; r < titoli[2].riga + 80; r++) {
    if (val(r, 1) === 'ORDINE TERZIARIA') return riempimento(r, 1) === 'FF92D050' && ws.getCell(r, 1).alignment.horizontal === 'center';
  }
  return false;
})());

// --- I totali del riepilogo contro le righe dei blocchi ----------------------
console.log('\nI TOTALI DEL RIEPILOGO VENGONO DAI BLOCCHI');
// La formula del riepilogo dice quali righe guardare; quelle righe sommano le
// loro, e la somma si rifa' a mano dalle celle: se una delle due catene si
// rompe, il conto non torna.
const sommaIntervallo = (formula, quanto) => {
  const m = /^=SUM\([A-Z]+(\d+):[A-Z]+(\d+)\)$/.exec(formula);
  if (!m) return null;
  let totale = 0;
  for (let r = Number(m[1]); r <= Number(m[2]); r++) totale += quanto(r);
  return totale;
};
const controllaMese = (colonna, attesoCssc, attesoTer, nome) => {
  const f = String(val(3, colonna));
  // Il CSS-C c'e' solo se nel mese ne e' uscito: senza, la formula porta il solo
  // totale delle terziarie (regola del 22/09/2026).
  const m = /^=(?:I(\d+))?\+?(?:K(\d+))?$/.exec(f);
  if (!m || (!m[1] && !m[2])) { verifica(`${nome}: la formula IRIGOM punta ai totali del blocco`, false, f); return; }
  const [, rigaCssc, rigaTer] = m;
  // CSS-C: la riga del totale somma la colonna I delle sue righe, e ogni I e' G+H
  const cssc = rigaCssc ? sommaIntervallo(String(val(Number(rigaCssc), 9)), r => numero(r, 7) + numero(r, 8)) : 0;
  const ter = rigaTer ? sommaIntervallo(String(val(Number(rigaTer), 11)), r => numero(r, 9) + numero(r, 10)) : 0;
  verifica(`${nome}: il totale CSS-C somma le sue righe`, cssc === attesoCssc, `${cssc} invece di ${attesoCssc}`);
  verifica(`${nome}: il totale delle terziarie somma le sue righe`, ter === attesoTer, `${ter} invece di ${attesoTer}`);
  verifica(`${nome}: IRIGOM = CSS-C + terziarie`, cssc + ter === attesoCssc + attesoTer);
  verifica(`${nome}: la cella del riepilogo e' quella della dichiarazione prodotta`, riempimento(3, colonna) === 'FF70AF47', riempimento(3, colonna));
};
controllaMese(13, GIUGNO_CSSC, GIUGNO_TER, 'Giugno');
// agosto: CSS-C a zero (non ce n'era), terziarie 534.140 di sola rete
controllaMese(17, 0, 534140, 'Agosto');
verifica('l\'extra raccolta di agosto sta nella sua riga, a parte', numero(2, 17) === 460, String(val(2, 17)));
verifica('rete ed extra non si sommano nel riepilogo', numero(3, 17) === 0 || String(val(3, 17)).startsWith('='));
verifica('la dichiarazione caricata a portale e\' segnata', val(3, 18) === 'SI' && val(3, 14) === 'SI');
verifica('quella non ancora caricata no', val(2, 18) === null);

console.log('\nUN MESE DI SOLI METALLI FERROSI');
verifica('aprile ha il suo blocco', titoli[0].testo === 'APRILE 2026');
// Aprile: solo metalli ferrosi. A portale non si carica nulla, quindi la colonna
// resta vuota e quel ferro se ne va con la dichiarazione del mese dopo.
verifica('un mese di soli metalli lascia vuota la sua colonna nel riepilogo', val(3, 9) === null || String(val(3, 9)) === '', String(val(3, 9)));
verifica('nel blocco di aprile non c\'e\' nessuna terziaria', (() => {
  for (let r = titoli[0].riga; r < titoli[1].riga; r++) if (val(r, 1) === 'ORDINE TERZIARIA') return false;
  return true;
})());

console.log('\nI MESI CHE IL GESTIONALE NON HA');
verifica('marzo compare col solo totale della dichiarazione', numero(3, 7) === 262720 && riempimento(3, 7) === 'FFFFC000', String(val(3, 7)));
verifica('e senza blocco sotto', !titoli.some(t => t.testo === 'MARZO 2026'));
verifica('gennaio non ha ne\' totale ne\' blocco', val(3, 3) === null);

const mesi = wb.getWorksheet('Mesi');
const righeMesi = {};
const NOMI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
for (let r = 1; r <= mesi.rowCount; r++) {
  const nome = mesi.getCell(r, 1).value;
  if (NOMI.includes(nome)) righeMesi[nome] = r;
}
const nota = (mese) => String(mesi.getCell(righeMesi[mese], 14).value || '');
verifica('il secondo foglio elenca tutti e dodici i mesi', Object.keys(righeMesi).length === 12, Object.keys(righeMesi).join(','));
verifica('agosto dice da quale pratica e con che data', mesi.getCell(righeMesi.Agosto, 2).value === 'si' && mesi.getCell(righeMesi.Agosto, 4).value === 2 && mesi.getCell(righeMesi.Agosto, 6).value === '10/09/2026',
  JSON.stringify([mesi.getCell(righeMesi.Agosto, 4).value, mesi.getCell(righeMesi.Agosto, 6).value]));
verifica('agosto dice dove sta il suo blocco', /^\d+-\d+$/.test(String(mesi.getCell(righeMesi.Agosto, 3).value)) && /righe \d+-\d+/.test(nota('Agosto')), nota('Agosto'));
verifica('agosto dice dov\'e\' finita l\'extra raccolta', /Extra raccolta 460 kg nella terziaria TER26154141/.test(nota('Agosto')) && /una volta sola/.test(nota('Agosto')), nota('Agosto'));
verifica('marzo dice che il blocco manca', mesi.getCell(righeMesi.Marzo, 2).value === 'no' && /non ha la pratica di Marzo/.test(nota('Marzo')) && /262\.720 kg/.test(nota('Marzo')), nota('Marzo'));
verifica('gennaio dice che il gestionale non lo ha', /non ha ne' la pratica ne' la dichiarazione/.test(nota('Gennaio')), nota('Gennaio'));
verifica('giugno quadra con la dichiarazione a portale', !/dichiarazione a portale dice/.test(nota('Giugno')), nota('Giugno'));
verifica('giugno dice che l\'extra viene da un formulario di maggio', /i formulari sono di Maggio/.test(nota('Giugno')) && numero(2, 13) === 1000, nota('Giugno'));
verifica('i totali del secondo foglio sono quelli dei blocchi', mesi.getCell(righeMesi.Giugno, 9).value === GIUGNO_CSSC + GIUGNO_TER && mesi.getCell(righeMesi.Agosto, 9).value === 534140,
  `${mesi.getCell(righeMesi.Giugno, 9).value} ${mesi.getCell(righeMesi.Agosto, 9).value}`);

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
