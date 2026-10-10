// Prova degli ANNI E DEL MESE DELLE PAGINE (verifica di chiusura dell'audit,
// 11/10/2026).
//
// Le pagine avevano l'anno scritto a mano: Dichiarazioni [2026, 2025] e aperta sul
// 2026, Giacenze sul 2026, la fatturazione aperta su «Luglio 2026», passiva,
// attiva, margine ed extra raccolta con [2024, 2025, 2026]. Dal 1° gennaio 2027 il
// 2027 non si sarebbe potuto scegliere. E Consuntivi, a gennaio, proponeva il
// dicembre dell'anno nuovo: un mese che deve ancora venire. Ora tutto parte dal
// giorno italiano (src/lib/periodoPagine.js), e la prova scorre il sorgente perche'
// un anno cablato non torni.
// npm run prove
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { anniDaScegliere, meseDiLavoro, annoDiOggi } from '../src/lib/periodoPagine.js';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const uguale = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('IL MESE SU CUI SI LAVORA');
verifica("l'11 ottobre e' settembre", uguale(meseDiLavoro('2026-10-11'), { anno: 2026, mese: 'Settembre' }), JSON.stringify(meseDiLavoro('2026-10-11')));
verifica("il 2 gennaio e' il dicembre dell'anno prima", uguale(meseDiLavoro('2027-01-02'), { anno: 2026, mese: 'Dicembre' }), JSON.stringify(meseDiLavoro('2027-01-02')));
verifica("il 1° marzo e' febbraio", uguale(meseDiLavoro('2027-03-01'), { anno: 2027, mese: 'Febbraio' }));
verifica("il 31 dicembre e' novembre", uguale(meseDiLavoro('2026-12-31'), { anno: 2026, mese: 'Novembre' }));

console.log('GLI ANNI DA SCEGLIERE');
verifica('oggi, dal 2024 al 2026', uguale(anniDaScegliere({ oggi: '2026-10-11' }), [2024, 2025, 2026]));
verifica('il 2 gennaio 2027 c\'e\' il 2027', uguale(anniDaScegliere({ oggi: '2027-01-02' }), [2024, 2025, 2026, 2027]));
verifica('le Giacenze arrivano all\'anno dopo', uguale(anniDaScegliere({ dopo: 1, oggi: '2027-01-02' }), [2024, 2025, 2026, 2027, 2028]));
verifica('le Dichiarazioni dal 2025, dal piu\' recente', uguale(anniDaScegliere({ dal: 2025, oggi: '2027-01-02' }).reverse(), [2027, 2026, 2025]));
verifica("l'anno di oggi, sul giorno italiano", annoDiOggi('2027-01-01') === 2027);

console.log("NESSUN ANNO CABLATO NELLE PAGINE");
{
  const radice = fileURLToPath(new URL('../src/', import.meta.url));
  const file = [];
  const scorri = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) scorri(p); else if (/\.(jsx|js)$/.test(n)) file.push(p); } };
  scorri(join(radice, 'pages')); scorri(join(radice, 'components'));
  const trappole = [
    [/useState\(\s*20\d\d\s*\)/, 'useState(anno scritto)'],
    [/\b(?:ANNI|anni)\s*=\s*\[\s*20\d\d\s*,/, 'elenco di anni scritto a mano'],
    [/\[\s*20\d\d\s*,\s*20\d\d\s*,\s*20\d\d[\s,\]]*\]\s*\.map/, 'elenco di anni scritto dentro la pagina'],
    [/useState\(\{\s*anno:\s*20\d\d/, 'periodo iniziale con l\'anno scritto'],
  ];
  const trovate = [];
  for (const p of file) {
    const righe = readFileSync(p, 'utf8').split(/\r?\n/);
    righe.forEach((r, i) => { if (/^\s*(\/\/|\*)/.test(r)) return; for (const [re, cosa] of trappole) if (re.test(r)) trovate.push(`${p.slice(radice.length)}:${i + 1} ${cosa}`); });
  }
  verifica('nessuna pagina con un anno scritto a mano', trovate.length === 0, '\n    ' + trovate.join('\n    '));
  const cons = readFileSync(join(radice, 'components/verifiche-fornitori/Consuntivi.jsx'), 'utf8');
  verifica('Consuntivi parte dal mese finito, non dal dicembre dell\'anno nuovo', /useState\(\(\) => meseDiLavoro\(\)\.anno\)/.test(cons) && !/oggi\.getMonth\(\) === 0 \? 12/.test(cons));
  const fatt = readFileSync(join(radice, 'pages/Fatturazione.jsx'), 'utf8') + readFileSync(join(radice, 'components/fatturazione/FatturazioneAttiva.jsx'), 'utf8');
  verifica('la fatturazione si apre sull\'ultimo mese finito', (fatt.match(/useState\(meseDiLavoro\)/g) || []).length === 2);
}

console.log(`\n${ok} superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
