// I TARGET MENSILI DOPPI: VALE L'ULTIMO MODIFICATO, OVUNQUE (segnalazione alta
// del 20/09, corretta il 12/10/2026).
//
// Due TargetMensile con lo stesso raccoglitore, regione, impianto, ruolo e mese
// sono lo stesso target scritto due volte. La griglia di Target & Status ne
// tiene uno e scrive «vale l'ultimo modificato»; aggregaTargetMensili
// (targetRaccoglitori.ts), che usano gli alert, li sommava: la pagina diceva
// 50 t, gli altri 100. Target di impianti o ruoli diversi restano target
// diversi e si sommano (la regressione del 20/09 ha confermato che e' giusto).
//
// UNA REGOLA SOLA (revisione del 13/10/2026). Il 12/10 la scelta era entrata solo
// in aggregaTargetMensili: righeAndamento (pagina, Excel di Target & Status,
// dashboard) e calcolaReportGenerale sommavano ancora, e con 80 t e poi 50 t gli
// avvisi dicevano 50 e la pagina 130. Ora la regola e' targetMensiliValidi
// (andamentoTarget.ts e il suo specchio) e la seconda parte della prova chiede
// lo stesso numero a tutti quelli che leggono i target mensili.
//
// GLI ULTIMI LETTORI (ultimo giro della revisione del 13/10/2026). Quattro conti
// sommavano ancora le righe grezze: la tabella per regione della stessa pagina
// Andamento (regioneData in TargetStatus.jsx: 130 accanto al 50 della tabella
// per raccoglitore), il riepilogo dei dati di EcoTyna (situazioneGestionale,
// assistente.ts: da aggregaTargetMensili passava solo l'elenco dei nomi, il
// target del mese lo sommava sulle righe grezze), il report settimanale
// (calcolaReportSettimanale) e la ripartizione dei target fra gli impianti di
// Giacenze e predittivita' (ripartisciTargetPrimarie). La terza parte li prova
// sullo stesso scenario. npm run prove
import { aggregaTargetMensili, targetRaccoglitoreMese } from '../base44/shared/targetRaccoglitori.ts';
import * as condiviso from '../base44/shared/andamentoTarget.ts';
import { calcolaReportGenerale } from '../src/lib/reportGeneraleVista.js';
import { raccoglitoriRete } from '../base44/shared/quadroCommessa.ts';
import { normalizzaRagioneSociale } from '../base44/shared/normalizzaRagioneSociale.ts';
import { situazioneGestionale } from '../base44/shared/assistente.ts';
import { calcolaReportSettimanale } from '../base44/shared/reportSettimanale.ts';
import { ripartisciTargetPrimarie } from '../base44/shared/targetImpianti.ts';
import { MESI as MESI_PAGINA } from '../src/lib/pfuConstants.js';
import { readFileSync } from 'node:fs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = JSON.stringify;

// Lo specchio di andamentoTarget.ts deve caricarsi anche in node: dal 13/10/2026
// lo importa la vista del Report generale, che le prove caricano direttamente.
let specchio = { righeAndamento: () => [] };
try { specchio = await import('../src/lib/andamentoTarget.js'); ok++; } catch (e) { ko++; console.log('  FALLITA: lo specchio src/lib/andamentoTarget.js non si carica in node ' + e.message.slice(0, 90)); }

const riga = { raccoglitore: 'NAPPI SUD SRL', regione: 'Campania', impianto: 'IRIGOM', mese: 'Settembre', anno: 2026 };
const di = (lista, mese = 'Settembre', regione = 'Campania') => lista.filter(x => /^NAPPI SUD/i.test(x.raccoglitore) && x.mese === mese && x.regione === regione).map(x => x.target);

console.log('IL DOPPIONE VERO');
{
  const a = aggregaTargetMensili([
    { ...riga, id: 'b', target: 50, updated_date: '2026-09-02T10:00:00Z' },
    { ...riga, id: 'a', target: 80, updated_date: '2026-09-01T10:00:00Z' },
  ]);
  verifica('vale l\'ultimo modificato (50), non la somma (130) ne\' il primo in elenco', J(di(a)) === J([50]), J(a));
}
{
  // a pari data vale quello che viene dopo, come nella griglia (ordinamento stabile)
  const a = aggregaTargetMensili([
    { ...riga, id: 'a', target: 80, updated_date: '2026-09-01T10:00:00Z' },
    { ...riga, id: 'b', target: 50, updated_date: '2026-09-01T10:00:00Z' },
  ]);
  verifica('a pari data vale quello che viene dopo', J(di(a)) === J([50]), J(a));
}
{
  // lo stesso nome scritto in due modi e lo stesso impianto scritto in due modi
  const a = aggregaTargetMensili([
    { ...riga, raccoglitore: 'Nappi Sud S.r.l.', impianto: 'Irigom s.r.l.', id: 'a', target: 80, updated_date: '2026-09-01' },
    { ...riga, raccoglitore: 'NAPPI SUD SRL', impianto: 'IRIGOM SRL', id: 'b', target: 50, updated_date: '2026-09-03' },
  ]);
  verifica('due grafie dello stesso nome e dello stesso impianto sono lo stesso target', J(di(a)) === J([50]), J(a));
}
{
  // l'ultimo modificato dice «non raccoglie»: vale zero
  const a = aggregaTargetMensili([
    { ...riga, id: 'a', target: 80, updated_date: '2026-09-01' },
    { ...riga, id: 'b', target: 80, non_raccoglie: true, updated_date: '2026-09-05' },
  ]);
  verifica('se l\'ultimo dice «non raccoglie», il mese vale zero', J(di(a)) === J([0]), J(a));
}

console.log('I TARGET DIVERSI SI SOMMANO ANCORA');
{
  const a = aggregaTargetMensili([
    { ...riga, id: 'a', target: 50, updated_date: '2026-09-01' },
    { ...riga, id: 'b', impianto: 'TECNOGUM', target: 30, updated_date: '2026-09-02' },
    { ...riga, id: 'c', impianto: 'IRIGOM', ruolo: 'stoccaggio', target: 20, updated_date: '2026-09-03' },
    { ...riga, id: 'd', mese: 'Ottobre', target: 40, updated_date: '2026-09-03' },
    { ...riga, id: 'e', regione: 'Puglia', target: 10, updated_date: '2026-09-03' },
  ]);
  verifica('impianti e ruoli diversi si sommano: 50 + 30 + 20', J(di(a)) === J([100]), J(a));
  verifica('un altro mese e un\'altra regione restano a se\'', a.length === 3 && J(di(a, 'Ottobre')) === J([40]) && a.some(x => x.regione === 'Puglia' && x.target === 10), J(a));
  verifica('l\'ordine e\' quello dell\'archivio', J(a.map(x => `${x.regione} ${x.mese}`)) === J(['Campania Settembre', 'Campania Ottobre', 'Puglia Settembre']), J(a.map(x => `${x.regione} ${x.mese}`)));
}

console.log('UNA REGOLA SOLA: AVVISI, ANDAMENTO, EXCEL, DASHBOARD, REPORT GENERALE');
{
  // lo scenario della revisione: due grafie dello stesso raccoglitore, stesso
  // impianto e mese; 80 t scritte il 01/09, poi 50 t il 01/10
  const mensili = [
    { id: 'm1', raccoglitore: 'Ecorecuperi S.r.l.', regione: 'Campania', impianto: 'IRIGOM', ruolo: '', mese: 'Ottobre', anno: 2026, target: 80, updated_date: '2026-09-01T10:00:00Z' },
    { id: 'm2', raccoglitore: 'ECORECUPERI SRL', regione: 'Campania', impianto: 'IRIGOM', ruolo: '', mese: 'Ottobre', anno: 2026, target: 50, updated_date: '2026-10-01T10:00:00Z' },
  ];
  const chiave = (n) => normalizzaRagioneSociale(n || '');
  const ottobre = (righe) => righe.map(r => r.mesi.find(m => m.mese === 'Ottobre').target);
  const avvisi = aggregaTargetMensili(mensili).map(x => x.target);
  verifica('avvisi (aggregaTargetMensili): 50', J(avvisi) === J([50]), J(avvisi));
  const andamento = ottobre(condiviso.righeAndamento({ mensili }));
  verifica('Andamento, Excel di Target & Status e dashboard (righeAndamento): 50, non 130', J(andamento) === J([50]), J(andamento));
  const pagina = ottobre(specchio.righeAndamento({ mensili }));
  verifica('la pagina (lo specchio di righeAndamento): 50', J(pagina) === J([50]), J(pagina));
  const rg = calcolaReportGenerale({ mensili, chiave });
  const report = rg.map(r => r.mesi[9].target);
  verifica('Report generale (calcolaReportGenerale): 50, non 130', J(report) === J([50]), J(report));
  const scritti = rg.flatMap(r => [...r.scritti.values()].map(x => x.mesi[9]));
  verifica('e l\'impianto scritto sulla riga porta 50, non 130', J(scritti) === J([50]), J(scritti));
  const evasione = targetRaccoglitoreMese(mensili, 'ECORECUPERI SRL', 'Ottobre');
  verifica('evasione degli assegnati (targetRaccoglitoreMese): 50.000 kg, una riga', !!evasione && evasione.target_kg === 50000 && evasione.regioni.length === 1, J(evasione));
  const quadro = raccoglitoriRete({ righe: [], anno: 2026, giornoDati: '2026-12-31', oggi: '2026-12-31', mensili });
  const dash = quadro.indietro.map(r => r.target_mesi_t);
  verifica('dashboard, raccoglitori indietro (raccoglitoriRete): 50', J(dash) === J([50]), J(quadro));

  // un impianto diverso e' un altro target: tutti sommano, e dicono 80
  const due = [...mensili, { ...mensili[0], id: 'm3', impianto: 'TECNOGUM', target: 30 }];
  const tutti = [
    aggregaTargetMensili(due)[0].target,
    ottobre(condiviso.righeAndamento({ mensili: due }))[0],
    ottobre(specchio.righeAndamento({ mensili: due }))[0],
    calcolaReportGenerale({ mensili: due, chiave })[0].mesi[9].target,
    targetRaccoglitoreMese(due, 'Ecorecuperi', 'Ottobre').target_kg / 1000,
  ];
  verifica('con un impianto diverso tutti dicono 80 (50 + 30)', J(tutti) === J([80, 80, 80, 80, 80]), J(tutti));
}
{
  // il codice della regola c'e' una volta: targetRaccoglitori.ts la importa, la
  // vista del Report generale la prende dallo specchio
  const testo = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\r/g, '');
  const senzaCommenti = (t) => t.replace(/^\s*(\/\/|\*|\/\*).*$/gm, '');
  verifica('targetMensiliValidi c\'e\' nei due specchi', typeof condiviso.targetMensiliValidi === 'function' && typeof specchio.targetMensiliValidi === 'function');
  const tr = testo('base44/shared/targetRaccoglitori.ts');
  verifica('targetRaccoglitori.ts la importa e non ne ha una copia sua', /import \{ targetMensiliValidi \} from "\.\/andamentoTarget\.ts"/.test(tr) && !/updated_date/.test(senzaCommenti(tr)));
  verifica('reportGeneraleVista.js la prende dallo specchio', /import \{ targetMensiliValidi \} from '\.\/andamentoTarget\.js'/.test(testo('src/lib/reportGeneraleVista.js')));
}

console.log('GLI ULTIMI LETTORI: TABELLA PER REGIONE, ECOTYNA, REPORT SETTIMANALE, RIPARTIZIONE FRA GLI IMPIANTI');
{
  // lo stesso scenario della revisione: 80 t il 01/09, poi 50 t il 01/10
  const mensili = [
    { id: 'm1', raccoglitore: 'Ecorecuperi S.r.l.', regione: 'Campania', impianto: 'IRIGOM', ruolo: '', mese: 'Ottobre', anno: 2026, target: 80, non_raccoglie: false, created_date: '2026-08-01T10:00:00Z', updated_date: '2026-09-01T10:00:00Z' },
    { id: 'm2', raccoglitore: 'ECORECUPERI SRL', regione: 'Campania', impianto: 'IRIGOM', ruolo: '', mese: 'Ottobre', anno: 2026, target: 50, non_raccoglie: false, created_date: '2026-08-02T10:00:00Z', updated_date: '2026-10-01T10:00:00Z' },
  ];
  // con un impianto diverso e' un altro target, e tutti devono dire 80
  const due = [...mensili, { ...mensili[0], id: 'm3', impianto: 'TECNOGUM', target: 30 }];
  const testo = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\r/g, '');

  // 1. La tabella per regione della pagina Andamento: il blocco di regioneData
  // preso dal sorgente ed eseguito com'e' (lo script del revisore), con la
  // regola dello specchio a disposizione.
  const pagina = testo('src/pages/TargetStatus.jsx');
  const blocco = pagina.match(/const regioneData = useMemo\(\(\) => \{\n([\s\S]*?)\n {2}\}, \[raccolto, targets, filters\]\);/);
  verifica('il blocco di regioneData si trova nel sorgente della pagina', !!blocco);
  const filtri = { regione: [], raccoglitore: [], impianto: [], mese: [] };
  const perRegione = (targets) => {
    if (!blocco) return null;
    try {
      const f = new Function('raccolto', 'targets', 'filters', 'MESI', 'targetMensiliValidi', blocco[1]);
      const c = f({ by_regione: [], by_raccoglitore: [] }, targets, filtri, MESI_PAGINA, specchio.targetMensiliValidi).find(r => r.regione === 'Campania');
      return c ? c.mesi.find(m => m.mese === 'Ottobre').target : null;
    } catch (e) { return 'errore: ' + e.message; }
  };
  const perRaccoglitore = (targets) => specchio.righeAndamento({ mensili: targets, filtri }).filter(r => r.regione === 'Campania').reduce((s, r) => s + r.mesi.find(m => m.mese === 'Ottobre').target, 0);
  verifica('Andamento, tabella per regione (regioneData): 50, come la tabella per raccoglitore', perRegione(mensili) === 50 && perRaccoglitore(mensili) === 50, J([perRegione(mensili), perRaccoglitore(mensili)]));
  verifica('la pagina prende la regola dallo specchio, insieme a righeAndamento', /import \{ righeAndamento, targetMensiliValidi \} from '@\/lib\/andamentoTarget';/.test(pagina) && /for \(const t of targetMensiliValidi\(targets\)\)/.test(blocco ? blocco[1] : ''));

  // 2. EcoTyna: il riepilogo dei dati (situazioneGestionale) con un archivio
  // finto vuoto salvo i target; la terza colonna della riga e' «target Ottobre».
  const ecotyna = async (righe) => {
    const archivi = { TargetMensile: righe };
    const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => (v === null ? r[k] == null : (typeof v === 'object' ? true : r[k] === v)));
    const entita = (nome) => ({
      filter: async (f, _s, _l, skip = 0) => (skip ? [] : (archivi[nome] || []).filter(r => soddisfa(r, f))),
      list: async (_s, _l, skip = 0) => (skip ? [] : (archivi[nome] || [])),
      get: async () => null,
    });
    const svc = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
    const base44 = { asServiceRole: { entities: svc }, entities: svc, functions: { invoke: async () => ({ data: null }) } };
    const t = String(await situazioneGestionale(base44, '2026-10-13'));
    const intestazione = t.split('\n').find(l => l.startsWith('Raccoglitori, solo RETE')) || '';
    const riga = t.split('\n').find(l => l.startsWith('- ') && /ecorecuperi/i.test(l)) || '';
    return { intestazione, colonna: (riga.split('|')[2] || '').trim(), righe: t.split('\n').filter(l => l.startsWith('- ') && /ecorecuperi/i.test(l)).length };
  };
  const e1 = await ecotyna(mensili);
  verifica('EcoTyna, la colonna e\' il target di ottobre', /\| target Ottobre \|/.test(e1.intestazione), e1.intestazione);
  verifica('EcoTyna (situazioneGestionale): target di ottobre 50,00, non 130,00', e1.colonna === '50,00' && e1.righe === 1, J(e1));
  const e2 = await ecotyna(due);
  verifica('EcoTyna con un impianto diverso: 80,00', e2.colonna === '80,00', J(e2));

  // 3. Il report settimanale: il target del mese della riga
  const settimanale = (righe) => calcolaReportSettimanale({ rete: [], mensili: righe, annui: [], anno: 2026, mese: 10 }).righe.filter(r => r.regione === 'Campania').map(r => r.target_mese);
  verifica('report settimanale (calcolaReportSettimanale): una riga, 50 di target del mese', J(settimanale(mensili)) === J([50]), J(settimanale(mensili)));
  verifica('report settimanale con un impianto diverso: 80', J(settimanale(due)) === J([80]), J(settimanale(due)));

  // 4. La ripartizione dei target fra gli impianti (Giacenze e predittivita'):
  // 1.000 t di target annuo, settembre scritto su TECNOGUM (200 t), ottobre su
  // IRIGOM, 100 t arrivate a GATIM. Ogni mese scritto va al suo sito, l'arrivato
  // al suo, e quello che resta dell'anno al sito scritto per piu' tonnellate
  // (TECNOGUM). Col doppione sommato IRIGOM prendeva 130 t e TECNOGUM 80 in meno.
  const annui = [{ raccoglitore: 'Ecorecuperi Srl', regione: 'Campania', anno: 2026, target_tonnellate: 1000 }];
  const settembre = { ...mensili[0], id: 'm9', impianto: 'TECNOGUM', mese: 'Settembre', target: 200 };
  const conferiti = [{ raccoglitore: 'ECORECUPERI SRL', regione: 'Campania', sito: 'GATIM SRL', ruolo: 'imp', mese: 9, kg: 100000 }];
  const quote = (righe, arrivati = conferiti) => {
    const r = ripartisciTargetPrimarie({ raccoglitori: annui, mensili: [settembre, ...righe], conferiti: arrivati, anno: 2026 });
    const q = (sito) => r.per.get(normalizzaRagioneSociale(sito) + '|imp') || 0;
    return { irigom: q('IRIGOM'), tecnogum: q('TECNOGUM'), gatim: q('GATIM SRL'), somma: Math.round([...r.per.values()].reduce((s, v) => s + v, 0) * 1000) / 1000 };
  };
  const q1 = quote(mensili);
  verifica('ripartizione fra gli impianti (ripartisciTargetPrimarie): IRIGOM 50, non 130; TECNOGUM 850, GATIM 100, in tutto 1.000', J(q1) === J({ irigom: 50, tecnogum: 850, gatim: 100, somma: 1000 }), J(q1));
  // Il secondo impianto di ottobre su un sito che non e' quello di riferimento
  // (GATIM, senza arrivati): impianti diversi restano target diversi, e i suoi
  // 30 t restano suoi. Fino all'ultimo giro della revisione del 13/10/2026 lo
  // scenario metteva i 30 t su TECNOGUM, il sito di riferimento: se la
  // ripartizione li buttava via rientravano nel resto dell'anno, che va li', e
  // la verifica passava lo stesso (lo script del revisore q2_a_vuoto.mjs).
  const dueSiti = [...mensili, { ...mensili[0], id: 'm3', impianto: 'GATIM SRL', target: 30 }];
  const q2 = quote(dueSiti, []);
  verifica('ripartizione con un impianto diverso a ottobre, non di riferimento: GATIM 30, IRIGOM 50, TECNOGUM 200 + il resto (920)', J(q2) === J({ irigom: 50, tecnogum: 920, gatim: 30, somma: 1000 }), J(q2));

  // il codice della regola non si ricopia: i lettori nuovi la importano
  verifica('assistente.ts, reportSettimanale.ts e targetImpianti.ts importano la regola',
    /targetMensiliValidi \} from "\.\/targetRaccoglitori\.ts"/.test(testo('base44/shared/assistente.ts'))
    && /import \{ targetMensiliValidi \} from "\.\/andamentoTarget\.ts"/.test(testo('base44/shared/reportSettimanale.ts'))
    && /targetMensiliValidi \} from "\.\/targetRaccoglitori\.ts"/.test(testo('base44/shared/targetImpianti.ts')));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
