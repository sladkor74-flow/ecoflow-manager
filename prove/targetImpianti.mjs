// Prova del confronto fra i due target dell'impianto (base44/shared/targetImpianti.ts). npm run prove
import { divergenzeTargetImpianti, testoDivergenza, impiantiTargetDellAnno } from '../base44/shared/targetImpianti.ts';

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

// Un record vale un anno (26/09/2026): senza anno vale il 2026. I record degli
// anni chiusi restano attivi, e il target puo' cambiare da un anno all'altro.
const dueAnni = [
  { nome_impianto: 'Tecnogum', target: 2295000, stato: 'attivo' },
  { nome_impianto: 'Tecnogum', target: 2500000, stato: 'attivo', anno: 2027 },
];
const sitiDueAnni = [
  { sito: 'TECNOGUM SRL', anno: 2026, tipo_destinazione: 'imp', target_totale_t: 2295 },
  { sito: 'TECNOGUM SRL', anno: 2027, tipo_destinazione: 'imp', target_totale_t: 2500 },
];
verifica('due anni, ciascuno col suo target: nessuna divergenza nel 2026', divergenzeTargetImpianti(sitiDueAnni, dueAnni, 2026).length === 0, JSON.stringify(divergenzeTargetImpianti(sitiDueAnni, dueAnni, 2026)));
verifica('due anni, ciascuno col suo target: nessuna divergenza nel 2027', divergenzeTargetImpianti(sitiDueAnni, dueAnni, 2027).length === 0, JSON.stringify(divergenzeTargetImpianti(sitiDueAnni, dueAnni, 2027)));
const d27 = divergenzeTargetImpianti([{ ...sitiDueAnni[1], target_totale_t: 2600 }], dueAnni, 2027);
verifica('nel 2027 si confronta il record del 2027, non quello senza anno', d27.length === 1 && d27[0].target_status_t === 2500 && d27[0].differenza_t === 100, JSON.stringify(d27));
verifica('un anno senza record suoi non ha divergenze', divergenzeTargetImpianti([{ sito: 'TECNOGUM SRL', anno: 2028, tipo_destinazione: 'imp', target_totale_t: 1 }], dueAnni, 2028).length === 0);

// Il target che vale in un anno (contratti): quello dell'anno, o il piu' recente prima.
const tDi = (anno) => { const r = impiantiTargetDellAnno([...dueAnni, { nome_impianto: 'TECNOGUM SRL', target: 1, stato: 'non_attivo', anno: 2028 }], anno).get('tecnogum'); return r ? r.target : null; };
verifica('il target del 2026 e\' il record senza anno', tDi(2026) === 2295000, String(tDi(2026)));
verifica('il target del 2027 e\' il record del 2027', tDi(2027) === 2500000, String(tDi(2027)));
verifica('per il 2028, ancora senza record, vale l\'ultimo anno scritto (e non un record non attivo)', tDi(2028) === 2500000, String(tDi(2028)));
verifica('per un anno prima di tutti i record non c\'e\' target', tDi(2025) === null, String(tDi(2025)));
const stessoAnno = impiantiTargetDellAnno([
  { nome_impianto: 'Irigom', target: 1, anno: 2027, updated_date: '2027-01-02T10:00:00' },
  { nome_impianto: 'IRIGOM SRL', target: 2, anno: 2027, updated_date: '2027-02-02T10:00:00' },
], 2027);
verifica('due record dello stesso anno: vale il piu\' recente', stessoAnno.get('irigom').target === 2, JSON.stringify([...stessoAnno.entries()]));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
