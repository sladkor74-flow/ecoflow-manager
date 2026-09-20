// Prova del confronto fra i due target dell'impianto (base44/shared/targetImpianti.ts). npm run prove
import { divergenzeTargetImpianti, testoDivergenza } from '../base44/shared/targetImpianti.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const siti = [
  { sito: 'Irigom S.r.l.', anno: 2026, tipo_destinazione: 'imp', target_totale_t: 4445 },
  { sito: 'TECNOGUM SRL', anno: 2026, tipo_destinazione: 'imp', target_totale_t: 2305 },
  { sito: 'T-CYCLE INDUSTRIES SRL', anno: 2026, tipo_destinazione: 'stoc', target_totale_t: 999 },
  { sito: 'T-CYCLE INDUSTRIES SRL', anno: 2026, tipo_destinazione: 'imp', target_totale_t: 1050 },
  { sito: 'Irigom S.r.l.', anno: 2025, tipo_destinazione: 'imp', target_totale_t: 1 },
];
const impianti = [
  { nome_impianto: 'IRIGOM SRL', target: 4445000, stato: 'attivo' },
  { nome_impianto: 'tecnogum', target: 2300000, stato: 'attivo' },
  { nome_impianto: 'T-CYCLE INDUSTRIES SRL', target: 1050000, stato: 'attivo' },
  { nome_impianto: 'Impianto senza sito', target: 5, stato: 'attivo' },
];
const d = divergenzeTargetImpianti(siti, impianti, 2026);
verifica('nomi scritti diversi, stessi impianti: solo Tecnogum diverge (2.305 contro 2.300)', d.length === 1 && d[0].impianto === 'TECNOGUM SRL' && d[0].differenza_t === 5, JSON.stringify(d));
verifica('lo stoccaggio omonimo e l\'anno prima non c\'entrano', !d.some(x => /CYCLE|Irigom/i.test(x.impianto)));
verifica('il testo dice i due numeri e dove stanno', /Giacenze vale 2305 t/.test(testoDivergenza(d[0])) && /Target & Status 2300 t/.test(testoDivergenza(d[0])));
verifica('sotto la tonnellata non e\' una divergenza', divergenzeTargetImpianti([{ sito: 'X SRL', anno: 2026, tipo_destinazione: 'imp', target_totale_t: 100.5 }], [{ nome_impianto: 'X', target: 100000 }], 2026).length === 0);

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
