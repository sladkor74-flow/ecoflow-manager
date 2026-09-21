// Prova della pratica mensile di Irigom (src/lib/praticaIrigom.js) sul caso vero
// di agosto 2026: dagli stessi dati del registro devono uscire, al chilo, le
// dichiarazioni prodotte il 18/09/2026.
// npm run prove
import { readFileSync } from 'node:fs';
import { quotaEct, formulariFerro, scegliAllegati, componiMese, dividiExtra, ripartisciFerro } from '../src/lib/praticaIrigom.js';

const A = JSON.parse(readFileSync(new URL('./dati/irigom_agosto_2026.json', import.meta.url), 'utf8'));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

console.log('LA QUOTA ECT NELLE NOTE DI IRIGOM');
for (const [nota, atteso] of [
  ['ECP:10,72 ECT:6,62 LM: 10,62', 6620], ['ECT: 19,68 LM: 7,66', 19680], ['ECT 2,66', 2660], ['ect: 6,6', 6600],
  ['FECT:12.64', 12640], ['ECT: 11,68 TON', 11680], ['ECT:14,82 T', 14820], ['27,5 ECP 1,06 ECT', 1060],
  ['Angelo Palmisano:\nECT: 6,62', 6620], ['ecp: 24,2 lm:3,36', null], ['', null],
]) verifica(`"${nota}"`, quotaEct(nota) === atteso, `-> ${quotaEct(nota)}`);

console.log('I FORMULARI DEL FERRO DI AGOSTO');
const ff = formulariFerro(A.ferro);
verifica('quattro formulari nostri', ff.tabella.length === 4, String(ff.tabella.length));
verifica('stessi formulari e quote', JSON.stringify(ff.tabella.map(r => [r.formulario, r.kg, r.quota_kg])) === JSON.stringify(A.attese.ferro_tabella.map(r => [r.formulario, r.peso_kg, r.quota_kg])));
verifica('111.500 di peso, 82.500 di quota', ff.peso_kg === 111500 && ff.quota_kg === 82500, `${ff.peso_kg} ${ff.quota_kg}`);
verifica('MMF escluso anche se arancione', formulariFerro([{ destinatario: 'MMF', colore: 'FFC000', kg: 1000 }]).quota_kg === 0);

console.log('GLI ALLEGATI VII');
const sc = scegliAllegati(A.allegati, A.riga.uscite_cippato_kg);
verifica('i 17 allegati scelti', JSON.stringify(sc.scelti.map(a => a.numero)) === JSON.stringify(A.attese.allegati_scelti), JSON.stringify(sc.scelti.map(a => a.numero)));
verifica('coprono 463.800 kg', sc.coperto_kg === 463800, String(sc.coperto_kg));
verifica('prima SMOCO, poi TRANSAR', scegliAllegati([{ numero: 1, trasportatore: 'ALTRO', kg: 10 }, { numero: 2, trasportatore: 'TRANSAR', kg: 10 }, { numero: 3, trasportatore: 'SMOCO', kg: 10 }], 30).ordinati.map(a => a.numero).join() === '3,2,1');

console.log('LA PRATICA DI AGOSTO, COME E\' STATA FATTA (LETTURA DALLE USCITE)');
const m = componiMese({ riga: A.riga, ferro: A.ferro, allegati: A.allegati, ddt: [], lettura: 'uscite', extra: A.extra, terziarie: A.terziarie });
verifica('nessun blocco', m.blocchi.length === 0, JSON.stringify(m.blocchi));
verifica('17 terziarie da aprire', m.terziarie_da_aprire === 17);
const righe = m.terziarie.righe.map(r => ({ terziaria: r.terziaria, allegato: r.allegato, peso_allegato_kg: r.peso_allegato_kg, cippato_kg: r.cippato_kg, ferro_kg: r.ferro_kg, totale_kg: r.totale_kg }));
verifica('le 17 righe al chilo', JSON.stringify(righe) === JSON.stringify(A.attese.terziarie), JSON.stringify(righe.slice(-2)));
verifica('i totali della tabella', m.terziarie.peso_allegati_kg === A.attese.totali.peso_allegati_kg && m.terziarie.cippato_kg === A.attese.totali.cippato_kg
  && m.terziarie.ferro_kg === A.attese.totali.ferro_kg && m.terziarie.totale_kg === A.attese.totali.totale_kg, JSON.stringify(m.terziarie).slice(0, 200));
verifica('l\'extra raccolta sulla terziaria dell\'allegato 36', m.extra && m.extra.terziaria === A.attese.extra.terziaria && m.extra.allegato === 36
  && m.extra.cippato_kg === 340 && m.extra.ferro_kg === 120 && m.extra.totale_kg === 460, JSON.stringify(m.extra));
verifica('rete 534.140, extra 460 a parte', m.rete_kg === A.attese.rete_kg && m.extra_kg === 460, `${m.rete_kg} ${m.extra_kg}`);
verifica('nessuna dichiarazione oltre 38.000', m.terziarie.righe.every(r => r.totale_kg <= 38000));
verifica('rete + extra = uscite del registro', m.terziarie.cippato_kg + m.extra.cippato_kg === A.riga.uscite_cippato_kg && m.terziarie.ferro_kg + m.extra.ferro_kg === A.riga.uscite_ferro_kg);

console.log('LA REGOLA DEL 19/09: LASCIARE A PORTALE LA GIACENZA DEL REGISTRO');
// Giacenza di rete a portale a fine agosto, per fine trasporto (le secondarie con
// la fine trasporto della secondaria): 679.380 kg.
const g = componiMese({ riga: A.riga, ferro: A.ferro, allegati: A.allegati, lettura: 'giacenza', portaleFineMeseKg: A.portale_fine_mese_kg, extra: A.extra, terziarie: A.terziarie });
verifica('da dichiarare = 679.380 - (70.000 + 74.780) = 534.600', g.rete_kg === 534600, String(g.rete_kg));
// Luglio e' stato dichiarato con la giacenza, e i 460 kg di extra raccolta erano
// gia' fuori: calcolato dalle uscite agosto li toglieva una seconda volta.
verifica('lo scarto con le uscite sono i 460 kg di extra tolti due volte', g.letture.scarto_kg === 460, String(g.letture.scarto_kg));
verifica('il ciabattato non cambia, cambia il ferro', g.terziarie.cippato_kg === 451760 && g.terziarie.ferro_kg + g.extra.ferro_kg === 534600 + 460 - 452100);
verifica('e lo dice, perche\' supera il ferro uscito', g.avvisi.some(a => /supera quello uscito/.test(a)));

console.log('I MESI SENZA NAVE');
const soloCssc = componiMese({ riga: { uscite_cssc_kg: 50000, uscite_ferro_kg: 84100, giacenza_cippato_kg: 1, giacenza_intero_kg: 0 }, ferro: [{ destinatario: 'TRS', colore: 'FFC000', kg: 84100 }], ddt: [{ ddt: '15', data: '2026-01-08', kg: 25000 }, { ddt: '22', data: '2026-01-13', kg: 25000 }], lettura: 'uscite' });
verifica('il ferro che non entra nei DDT resta in giacenza: nessuna dichiarazione di soli metalli', soloCssc.solo_ferro.length === 0 && soloCssc.rete_kg === 50000 + 26000, `${soloCssc.solo_ferro.length} ${soloCssc.rete_kg}`);
verifica('e lo dice', soloCssc.avvisi.some(a => /restano in giacenza/.test(a)));
const soloFerro = componiMese({ riga: { uscite_ferro_kg: 89780, giacenza_cippato_kg: 5000, giacenza_intero_kg: 1000 }, ferro: [{ destinatario: 'TRS', colore: 'FFC000', kg: 89780 }], lettura: 'uscite' });
verifica('aprile: solo metalli, a portale non si carica nulla', soloFerro.rete_kg === 0 && soloFerro.avvisi.some(a => /solo metalli/.test(a)), String(soloFerro.rete_kg));

console.log('IL FERRO IN ECCESSO SI DIVIDE');
// Due terziarie piene e due con posto: i 4.000 kg di ferro che le prime non
// reggono vanno meta' e meta' alle altre due, non tutti sull'ultima.
const piene = componiMese({ riga: { uscite_cippato_kg: 100000, uscite_ferro_kg: 40000, giacenza_cippato_kg: 1, giacenza_intero_kg: 0 }, ferro: [{ destinatario: 'TRS', colore: 'FFC000', kg: 40000 }],
  allegati: [{ numero: 1, trasportatore: 'SMOCO', kg: 30000 }, { numero: 2, trasportatore: 'SMOCO', kg: 30000 }, { numero: 3, trasportatore: 'SMOCO', kg: 20000 }, { numero: 4, trasportatore: 'SMOCO', kg: 20000 }], lettura: 'uscite' });
verifica("l'eccesso si divide fra chi ha posto", JSON.stringify(piene.terziarie.righe.map(r => r.ferro_kg)) === JSON.stringify([8000, 8000, 12000, 12000]) && piene.terziarie.righe.every(r => r.totale_kg <= 38000), JSON.stringify(piene.terziarie.righe.map(r => [r.cippato_kg, r.ferro_kg])));

console.log('I CASI DI CONFINE');
verifica('extra divisa come ad agosto', JSON.stringify(dividiExtra(460)) === JSON.stringify({ pfu_kg: 460, cippato_kg: 340, ferro_kg: 120 }));
const r = ripartisciFerro([{ base_kg: 30000 }, { base_kg: 20000 }], 20000);
verifica('chi supererebbe 38.000 cede il ferro agli altri', r.ferro[0] === 8000 && r.ferro[1] === 12000 && r.avanza_kg === 0, JSON.stringify(r));
const vuoto = componiMese({ riga: {}, ferro: [], allegati: [] });
verifica('un mese non compilato non si dichiara', vuoto.vuoto && vuoto.blocchi.length === 1);
const cssc = componiMese({ riga: { uscite_cssc_kg: 50000, uscite_ferro_kg: 20000, giacenza_cippato_kg: 0, giacenza_intero_kg: 0 }, ferro: [{ destinatario: 'TRS', colore: 'FFC000', kg: 20000 }], ddt: [{ ddt: '1', data: '2026-09-01', kg: 25000 }, { ddt: '2', data: '2026-09-02', kg: 25000 }], lettura: 'uscite' });
verifica('solo CSS-C: il ferro si divide fra i DDT', cssc.cssc.righe.map(x => x.ferro_kg).join() === '10000,10000' && cssc.rete_kg === 70000, JSON.stringify(cssc.cssc.righe.map(x => x.ferro_kg)));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
