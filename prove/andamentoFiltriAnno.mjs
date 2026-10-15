// TARGET & STATUS: I FILTRI DELL'ANDAMENTO NON TOCCANO I NUMERI DELL'ANNO
// (segnalazione alta del 20/09, corretta il 12/10/2026).
//
// La pagina passava i filtri della scheda (mese, regione, raccoglitore, impianto)
// a computeRaccolto, e lo stesso raccolto filtrato andava alle card dell'anno, alla
// tabella «Raccolta RETE per regione e contratto» e al Report generale: con il
// filtro Mese = Settembre «Raccolto RETE nell'anno» diceva il solo settembre e il
// «Residuo dell'anno» passava da 11.400 a 11.500. Ora la pagina legge il raccolto
// una volta, per anno e canale, e i filtri si applicano in memoria
// (filtraRaccolto, src/lib/raccoltoFiltrato.js) solo alle tabelle che li
// prevedono. Qui si prova che:
//   1. il filtro in memoria da' gli stessi numeri della funzione filtrata;
//   2. la pagina da' l'anno intero alle card, alla tabella per contratto e al
//      Report generale, e non richiama la funzione a ogni filtro;
//   3. le card dicono quando i filtri non valgono e con quali vale lo scarto.
// Prova generale del cambio d'anno (15/10/2026), i componenti veri disegnati:
//   4. la previsione e i corrispettivi ACI copiati dall'anno prima e non
//      confermati si dicono «copiati dal 2026, da confermare», in Target &
//      Status (CanaleAci) e in dashboard (SezioneAci, da quadro.aci.da_confermare);
//   5. l'Andamento mostra i target dei raccoglitori copiati e non confermati
//      come copiati: righeAndamento lo dice per target, TargetTable sulla riga e
//      sulle celle, Report generale e tabella con «N target su M copiati», la
//      card dello scarto del mese se l'atteso li conta. Frase e segno della
//      riga stanno in andamentoTarget, e la pagina passa il conto dell'anno
//      anche a PDF e presentazione (revisione del 15/10/2026).
// npm run prove
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { computeRaccoltoData } from '../base44/shared/raccoltoCalculator.ts';
import { caricaLibPagine } from './dati/libPagine.mjs';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = JSON.stringify;

let filtraRaccolto = null;
try { ({ filtraRaccolto } = await caricaLibPagine('lib/raccoltoFiltrato')); } catch (e) { verifica('src/lib/raccoltoFiltrato.js si carica', false, e.message); }

// Un archivio con tre raccoglitori, quattro province, tre impianti, ritiri in
// tre mesi, un ritiro dell'anno prima, un cancellato e uno senza fine trasporto.
const mov = (id, giorno, provincia, trasportatore, destinazione, kg, extra = {}) => ({
  id, id_ordine: id, stato: 'terminato', provincia, trasportatore, destinazione, peso_effettivo: kg, numero_fir: 'F' + id,
  ordine_immesso_il: `${giorno}T08:00:00Z`, trasporto_iniziato_il: `${giorno}T06:00:00Z`, trasporto_finito_il: `${giorno}T10:00:00Z`, ...extra,
});
const RETE = [
  mov('a1', '2026-08-10', 'NA', 'NAPPI SUD SRL', 'IRIGOM', 100000),
  mov('a2', '2026-09-10', 'NA', 'NAPPI SUD SRL', 'IRIGOM', 50000),
  mov('a3', '2026-09-12', 'SA', 'NAPPI SUD SRL', 'TECNOGUM', 20000),
  mov('a4', '2026-07-03', 'BA', 'PNEUSERVICE CONVERSANO SRL', 'IRIGOM', 33333),
  mov('a5', '2026-09-30', 'BA', 'PNEUSERVICE CONVERSANO SRL', 'GATIM', 12345),
  mov('a6', '2026-09-15', 'CT', ' SMOCO SRL ', 'GATIM', 7777),
  mov('a7', '2026-09-16', 'XX', 'SMOCO SRL', '', 1000),
  mov('a8', '2025-09-10', 'NA', 'NAPPI SUD SRL', 'IRIGOM', 99000),
  mov('a9', '2026-09-10', 'NA', 'NAPPI SUD SRL', 'IRIGOM', 88000, { stato: 'cancellato' }),
  mov('a10', '2026-09-10', 'NA', 'NAPPI SUD SRL', 'IRIGOM', 5000, { trasporto_finito_il: null }),
];
const archivio = { list: async () => RETE, filter: async () => RETE };
const base44 = { asServiceRole: { entities: { PrimariaRete: archivio, PrimariaAci: { list: async () => [], filter: async () => [] } } } };

console.log('1. IL FILTRO IN MEMORIA E LA FUNZIONE FILTRATA DICONO GLI STESSI NUMERI');
const anno = await computeRaccoltoData(base44, { anno: [2026], canale: 'rete' });
const tondo = (v) => Math.round(v * 1e6) / 1e6;
const mappa = (lista, chiave) => Object.fromEntries((lista || []).filter(e => e.totale > 0).map(e => [chiave(e), [tondo(e.totale), Object.entries(e.mesi).filter(([, v]) => v).map(([m, v]) => `${m}:${tondo(v)}`).join(',')]]).sort());
const vista = (r) => ({
  totale: tondo(r.totale_raccolto),
  raccoglitore: mappa(r.by_raccoglitore, e => `${e.raccoglitore}|${e.regione}`),
  regione: mappa(r.by_regione, e => e.regione),
  impianto: mappa(r.by_impianto, e => e.impianto),
  gruppo: mappa(r.by_raccoglitore_impianto, e => `${e.raccoglitore}|${e.regione}|${e.impianto}`),
});
const CASI = [
  { mese: ['Settembre'] },
  { mese: ['Agosto', 'Settembre'] },
  { regione: ['Campania'] },
  { raccoglitore: ['PNEUSERVICE CONVERSANO SRL'] },
  { impianto: ['GATIM'] },
  { mese: ['Settembre'], regione: ['Puglia', 'Sicilia'] },
  { regione: ['Altro'], impianto: ['N/D'] },
  { mese: ['Gennaio'] },
];
for (const filtri of CASI) {
  const funzione = await computeRaccoltoData(base44, { ...filtri, anno: [2026], canale: 'rete' });
  const memoria = filtraRaccolto ? filtraRaccolto(anno, filtri) : null;
  verifica(`stessi numeri con ${J(filtri)}`, memoria && J(vista(memoria)) === J(vista(funzione)), memoria ? `\n    funzione ${J(vista(funzione))}\n    memoria  ${J(vista(memoria))}` : '');
}
if (filtraRaccolto) {
  verifica('senza filtri il raccolto dell\'anno passa com\'e\'', filtraRaccolto(anno, { mese: [], regione: [], raccoglitore: [], impianto: [] }) === anno);
  const sett = filtraRaccolto(anno, { mese: ['Settembre'] });
  verifica('le voci dei filtri e le date da sistemare restano quelle dell\'anno', sett.filterOptions === anno.filterOptions && sett.date_da_sistemare === anno.date_da_sistemare);
  verifica('il raccolto dell\'anno non cambia filtrando', tondo(anno.totale_raccolto) === 224.455 && tondo(sett.totale_raccolto) === 91.122, `${anno.totale_raccolto} / ${sett.totale_raccolto}`);
}

console.log('2. LA PAGINA DA\' L\'ANNO INTERO DOVE SI PARLA DELL\'ANNO');
const senzaCommenti = (s) => s.replace(/\r/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const pagina = senzaCommenti(readFileSync(qui('../src/pages/TargetStatus.jsx'), 'utf8'));
const chiamateRete = pagina.match(/invoke\('computeRaccolto', \{ filters: \{[^}]*canale: 'rete'[^}]*\} \}\)/g) || [];
verifica('una sola lettura della rete, per anno e canale, senza i filtri della scheda', chiamateRete.length === 1 && chiamateRete[0] === "invoke('computeRaccolto', { filters: { anno: [anno], canale: 'rete' } })", J(chiamateRete));
verifica('cambiare un filtro non rilegge: la lettura dipende solo dall\'anno', /\}, \[anno\]\);/.test(pagina) && !/\}, \[filters, anno\]\);/.test(pagina));
verifica('i filtri si applicano in memoria', /const raccolto = useMemo\(\(\) => filtraRaccolto\(raccoltoAnno, filters\), \[raccoltoAnno, filters\]\);/.test(pagina));
verifica('le card dell\'anno leggono il raccolto senza filtri', /const raccoltoTotale = raccoltoAnno\?\.totale_raccolto \|\| 0;/.test(pagina) && /residuoAnno: contratto\.t === null \? null : contratto\.t - raccoltoTotale/.test(pagina));
verifica('la tabella per regione e contratto riceve l\'anno intero', /<AndamentoRegioni raccolto=\{raccoltoAnno\}/.test(pagina));
verifica('e cosi\' il Report generale', /<ReportGenerale [^>]*raccolto=\{raccoltoAnno\}/.test(pagina));
verifica('le tabelle coi filtri ricevono il raccolto filtrato', /righeAndamento\(\{ mensili: targets, annui, raccolto: raccolto\.by_raccoglitore, filtri: filters \}\)/.test(pagina) && /raccolto\.by_impianto/.test(pagina) && /for \(const r of raccolto\.by_regione\)/.test(pagina));
verifica('il riepilogo del PDF chiama il raccolto come la card', pagina.includes(`{ etichetta: "Raccolto RETE nell'anno", valore: kpis.raccoltoTotale, tipo: 't' }`));

console.log('3. LE CARD DICONO CHE COSA GUARDANO');
{
  const FINTI = {
    react: `const h = (t, p, ...c) => ({ t, p: p || {}, c }); export default { createElement: h, Fragment: 'F' }; export const createElement = h;`,
    jsxrt: `export const Fragment = 'F'; export const jsx = (t, p) => ({ t, p: p || {}, c: [p && p.children] }); export const jsxs = jsx;`,
    lucide: `export const Target = 'i', TrendingUp = 'i', AlertTriangle = 'i', CalendarClock = 'i';`,
  };
  const plug = { name: 'finti', setup(b) {
    b.onResolve({ filter: /^react$/ }, () => ({ path: 'react', namespace: 'finto' }));
    b.onResolve({ filter: /^react\/jsx-runtime$/ }, () => ({ path: 'jsxrt', namespace: 'finto' }));
    b.onResolve({ filter: /^lucide-react$/ }, () => ({ path: 'lucide', namespace: 'finto' }));
    b.onResolve({ filter: /^@\// }, (a) => ({ path: qui('../src/' + a.path.slice(2) + '.js') }));
    b.onLoad({ filter: /.*/, namespace: 'finto' }, (a) => ({ contents: FINTI[a.path], loader: 'js' }));
  } };
  const r = await build({ entryPoints: [qui('../src/components/target-status/KpiCards.jsx')], bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent', jsx: 'automatic', loader: { '.jsx': 'jsx', '.js': 'jsx' }, plugins: [plug] });
  const { default: KpiCards } = await import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
  const stringhe = (n) => (n == null || typeof n === 'boolean' ? [] : typeof n !== 'object' ? [String(n)] : Array.isArray(n) ? n.flatMap(stringhe) : [...stringhe(n.c), ...(typeof n.t === 'function' ? stringhe(n.t(n.p)) : [])]);
  const kpis = { targetAnnuoTotale: 11550, fonteTarget: 'contratto', raccoltoTotale: 150, residuoAnno: 11400, scartoMese: -5, attesoMese: 55, mesiScarto: ['Settembre'], giornoDati: '2026-10-07' };
  const con = stringhe(KpiCards({ kpis: { ...kpis, conFiltri: true, filtriScarto: ['regione Campania'] }, anno: 2026 })).join(' | ');
  const senza = stringhe(KpiCards({ kpis, anno: 2026 })).join(' | ');
  verifica('con un filtro, raccolto e residuo dicono che sono dell\'anno intero', (con.match(/Tutto l'anno: i filtri non valgono qui\./g) || []).length === 2, con);
  verifica('e lo scarto dice con quali filtri vale', /Con i filtri: regione Campania\./.test(con), con);
  verifica('senza filtri non si dice niente in piu\'', !/Tutto l'anno|Con i filtri/.test(senza), senza);
}

// PROVA GENERALE DEL CAMBIO D'ANNO (15/10/2026): due cose copiate dall'anno
// prima e non confermate che la pagina mostrava come decise. I componenti veri,
// disegnati (prove/dati/disegnaComponente.mjs).
const { disegnaComponente, testoDi } = await import('./dati/disegnaComponente.mjs');
const storicoCopia = J([{ il: '2026-12-28T10:00:00Z', nota: 'copiato dal 2026, da confermare' }]);
const storicoConfermato = J([{ il: '2026-12-28T10:00:00Z', nota: 'copiato dal 2026, da confermare' }, { il: '2027-01-08T10:00:00Z', nota: 'confermato' }]);

console.log('4. LA PREVISIONE ACI COPIATA DICE «DA CONFERMARE»');
{
  // Il 15/01/2027: contratto 2027 copiato il 28/12/2026, previsione e
  // corrispettivi ACI del 2026 (annuali, senza tacito rinnovo), i primi ritiri ACI.
  const PREVISIONE = J([{ regione: 'Basilicata', target_t: 20, prezzo: 230 }, { regione: 'Calabria', target_t: 100, prezzo: 230 }, { regione: 'Campania', target_t: 30, prezzo: 240 }, { regione: 'Puglia', target_t: 400, prezzo: 240 }, { regione: 'Sicilia', target_t: 100, prezzo: 230 }]);
  const copiato = { anno: 2027, target_annuo_t: 11550, target_prezzo_regioni_json: PREVISIONE, budget_aci_json: J(Array(12).fill(15)), storico_json: storicoCopia };
  const confermato = { ...copiato, storico_json: storicoConfermato };
  const canale = await disegnaComponente('src/components/target-status/CanaleAci.jsx');
  const raccoltoAci = { by_regione: [{ regione: 'Puglia', totale: 4.2 }, { regione: 'Calabria', totale: 2.1 }] };
  const t1 = testoDi(canale({ raccoltoAci, commessa: copiato, anno: 2027 }));
  verifica('Target & Status, Canale ACI: previsione e corrispettivi «copiati dal 2026, da confermare»', /Previsione ACI \(t\) copiata dal 2026, da confermare/.test(t1) && /Corrispettivo \(€\/t\) copiato dal 2026, da confermare/.test(t1), t1.slice(0, 500));
  verifica('e il valore del raccolto «calcolato col prezzo del 2026», con la nota sotto', /Valore del raccolto calcolato col prezzo del 2026/.test(t1) && /Il contratto del 2027 è copiato dal 2026 e non è ancora confermato/.test(t1) && /Puglia 400,00 4,20 1,1% 240,00 € 1\.008,00 €/.test(t1), t1.slice(0, 900));
  const t2 = testoDi(canale({ raccoltoAci, commessa: confermato, anno: 2027 }));
  verifica('controprova: confermato, niente «copiat» ne\' «da confermare»', !/copiat|da confermare/i.test(t2) && /Puglia 400,00 4,20 1,1% 240,00 € 1\.008,00 €/.test(t2), t2.slice(0, 600));
  // La dashboard legge quadro.aci.da_confermare (quadroAci, quadroCommessa.ts).
  const { quadroAci } = await import('../base44/shared/quadroCommessa.ts');
  const sezione = await disegnaComponente('src/components/dashboard/SezioneAci.jsx');
  const aciDi = (commessa) => quadroAci({ anno: 2027, oggi: '2027-01-15', giornoDati: '2027-01-14', commessa, kpi: { raccolto_aci_anno: 6.3, previsione_aci: 650 }, aciAnno: [] });
  const d1 = testoDi(sezione({ quadro: { anno: 2027, aci: aciDi(copiato) }, arretrato: null, annoInCorso: false }));
  verifica('dashboard, sezione ACI: «Previsione indicativa 650,00 t copiata dal 2026, da confermare» e il budget', /Previsione indicativa 650,00 t copiata dal 2026, da confermare/.test(d1) && /Budget SMOCO dell'anno 180,00 t copiato dal 2026, da confermare/.test(d1), d1.slice(0, 700));
  const d2 = testoDi(sezione({ quadro: { anno: 2027, aci: aciDi(confermato) }, arretrato: null, annoInCorso: false }));
  verifica('controprova: confermato, «dal contratto ACI» come prima', /Previsione indicativa 650,00 t dal contratto ACI/.test(d2) && !/copiat|da confermare/i.test(d2), d2.slice(0, 700));
}

console.log("5. L'ANDAMENTO MOSTRA I TARGET COPIATI COME COPIATI");
{
  // Il 15/01/2027: contratto 2027 confermato l'08/01, i target dei raccoglitori
  // ancora copiati, tranne quelli di BETA confermati in Target raccoglitori.
  let andamento = null;
  try { andamento = await caricaLibPagine('lib/andamentoTarget'); } catch (e) { verifica('src/lib/andamentoTarget.js si carica', false, e.message); }
  const MENSILI = [
    { id: 'm1', raccoglitore: 'ALFA SRL', regione: 'Campania', mese: 'Gennaio', anno: 2027, target: 100, storico_json: storicoCopia },
    { id: 'm2', raccoglitore: 'ALFA SRL', regione: 'Campania', mese: 'Febbraio', anno: 2027, target: 120, storico_json: storicoCopia },
    { id: 'm3', raccoglitore: 'BETA SRL', regione: 'Puglia', mese: 'Gennaio', anno: 2027, target: 50, storico_json: storicoConfermato },
    // copiato anche un «non raccoglie» a zero: nell'Andamento non ha una riga
    { id: 'm4', raccoglitore: 'GAMMA SRL', regione: 'Sicilia', mese: 'Gennaio', anno: 2027, target: 0, non_raccoglie: true, storico_json: storicoCopia },
  ];
  const ANNUI = [
    { id: 'a1', raccoglitore: 'ALFA SRL', regione: 'Campania', anno: 2027, target_tonnellate: 1200, storico_json: storicoCopia },
    { id: 'a2', raccoglitore: 'BETA SRL', regione: 'Puglia', anno: 2027, target_tonnellate: 600, storico_json: storicoConfermato },
  ];
  const RACCOLTO = [
    { raccoglitore: 'ALFA SRL', regione: 'Campania', totale: 30, mesi: { Gennaio: 30 } },
    { raccoglitore: 'BETA SRL', regione: 'Puglia', totale: 20, mesi: { Gennaio: 20 } },
  ];
  const filtri = { mese: [], regione: [], raccoglitore: [], impianto: [] };
  const righe = andamento ? andamento.righeAndamento({ mensili: MENSILI, annui: ANNUI, raccolto: RACCOLTO, filtri }) : [];
  const alfa = righe.find(r => r.raccoglitore === 'ALFA SRL') || { mesi: [] };
  const beta = righe.find(r => r.raccoglitore === 'BETA SRL') || { mesi: [] };
  verifica('righeAndamento dice quali target sono copiati: la riga, l\'annuo e il mese', alfa.annuoDaConfermare === true && alfa.mesi[0].daConfermare === true && alfa.mesi[1].daConfermare === true && alfa.mesi[2].daConfermare === false && alfa.targetCopiati === 3 && alfa.targetScritti === 3, J(alfa));
  verifica('i target confermati non hanno il segno', beta.annuoDaConfermare === false && beta.mesi.every(m => !m.daConfermare) && beta.targetCopiati === 0 && beta.targetScritti === 2, J(beta));
  verifica('i numeri restano quelli scritti: target, residuo e Δ', alfa.targetAnnuo === 1200 && alfa.leftover === 1170 && alfa.mesi[0].target === 100 && alfa.mesi[0].delta === 70, J(alfa));
  const contoCopiati = andamento && typeof andamento.targetCopiatiDelleRighe === 'function' ? andamento.targetCopiatiDelleRighe(righe) : null;
  verifica('il conto sulle righe dell\'Andamento: 3 su 5 (GAMMA, a zero, non ha una riga)', J(contoCopiati) === J({ copiati: 3, scritti: 5, righe: 1 }), J(contoCopiati));
  const dellAnno = andamento && typeof andamento.targetCopiatiDellAnno === 'function' ? andamento.targetCopiatiDellAnno({ mensili: MENSILI, annui: ANNUI }) : null;
  verifica('il conto dell\'anno, sui record come la scheda Target raccoglitori: 4 su 6', J(dellAnno) === J({ copiati: 4, scritti: 6 }), J(dellAnno));
  // La frase e il segno della riga stanno in andamentoTarget (revisione del
  // 15/10/2026), perche' la tabella, il Report generale e i file dell'Andamento
  // (PDF e presentazione) li dicano con le stesse parole; e le due copie, quella
  // delle funzioni e quella delle pagine, dicono lo stesso.
  {
    const condiviso = await import('../base44/shared/andamentoTarget.ts');
    const misto = { targetCopiati: 1, targetScritti: 3 };
    const segni = (m) => (m && typeof m.segnoTargetCopiati === 'function' ? [alfa, beta, misto, { ...misto, targetCopiati: 2 }].map(m.segnoTargetCopiati) : null);
    verifica('il segno della riga: tutti copiati, nessuno, uno, alcuni', J(segni(andamento)) === J(['copiato, da confermare', '', '1 target copiato, da confermare', '2 target copiati, da confermare']), J(segni(andamento)));
    const frasi = (m) => (m && typeof m.fraseTargetCopiati === 'function' ? [m.fraseTargetCopiati(dellAnno, 2027), m.fraseTargetCopiati({ copiati: 1, scritti: 6 }), m.fraseTargetCopiati({ copiati: 0, scritti: 6 }, 2027)] : null);
    verifica('la frase sopra le tabelle, con l\'anno calcolato; senza copiati niente', J(frasi(andamento)) === J(['4 target su 6 copiati dal 2026, da confermare in Target raccoglitori: si vedono, ma non sono ancora decisi.', "1 target su 6 copiato dall'anno prima, da confermare in Target raccoglitori: si vedono, ma non sono ancora decisi.", '']), J(frasi(andamento)));
    verifica('e la copia delle funzioni dice lo stesso', J(segni(condiviso)) === J(segni(andamento)) && J(frasi(condiviso)) === J(frasi(andamento)));
    // la pagina passa ai file dell'Andamento lo stesso conto della frase sopra la tabella
    verifica('la pagina passa a PDF e presentazione il conto dei target copiati dell\'anno', /exportPDF\(riepilogoPdf, mergedData, regioneData, impiantiData, anno, copiatiDellAnno\)/.test(pagina) && /exportPPT\(kpis, mergedData, regioneData, impiantiData, anno, copiatiDellAnno\)/.test(pagina));
  }

  // un disegno che non riesce (col codice di prima) si dice nella verifica, non ferma la prova
  const prova = (f) => (props) => { try { return f(props); } catch (e) { return 'non si disegna: ' + e.message; } };
  const tabella = prova(await disegnaComponente('src/components/target-status/TargetTable.jsx'));
  const tt = testoDi(tabella({ data: righe, anno: 2027, copiati: dellAnno }));
  verifica('«Target e raccolto per raccoglitore»: sopra, «4 target su 6 copiati dal 2026, da confermare in Target raccoglitori»', /4 target su 6 copiati dal 2026, da confermare in Target raccoglitori/.test(tt), tt.slice(0, 400));
  verifica('senza il conto dell\'anno la tabella conta le sue righe', /3 target su 5 copiati dal 2026/.test(testoDi(tabella({ data: righe, anno: 2027 }))));
  verifica('sulla riga di ALFA «copiato, da confermare», su quella di BETA no', /Campania ALFA SRL copiato, da confermare 1\.200,00/.test(tt) && /Puglia BETA SRL 600,00/.test(tt), tt.slice(0, 900));
  const html = tabella({ data: righe, anno: 2027 });
  verifica('le celle copiate in corsivo arancio, e il loro Δ senza il rosso di un obiettivo mancato', (html.match(/italic text-amber-700/g) || []).length === 3 && (html.match(/text-red-600 bg-red-50/g) || []).length === 1, J([(html.match(/italic text-amber-700/g) || []).length, (html.match(/text-red-600 bg-red-50/g) || []).length]));
  const tutteConfermate = andamento ? andamento.righeAndamento({ mensili: MENSILI.map(m => ({ ...m, storico_json: storicoConfermato })), annui: ANNUI.map(a => ({ ...a, storico_json: storicoConfermato })), raccolto: RACCOLTO, filtri }) : [];
  const tc = tabella({ data: tutteConfermate, anno: 2027 });
  verifica('controprova: target confermati, nessun segno', !/copiat|da confermare/i.test(testoDi(tc)) && !/italic text-amber-700/.test(tc), testoDi(tc).slice(0, 400));

  const report = prova(await disegnaComponente('src/components/target-status/ReportGenerale.jsx'));
  const perImpianto = RACCOLTO.map(r => ({ ...r, impianto: 'IRIGOM SRL' }));
  const commessa = { anno: 2027, target_annuo_t: 11600, target_mensile_json: J(Array(12).fill(1000)) };
  const tr = testoDi(report({ anno: 2027, mensili: MENSILI, annui: ANNUI, raccolto: { by_raccoglitore_impianto: perImpianto }, commessa }));
  verifica('Report generale: la stessa frase della tabella per raccoglitore, sopra la tabella dell\'anno', /4 target su 6 copiati dal 2026, da confermare in Target raccoglitori/.test(tr), tr.slice(0, 500));
  const trc = testoDi(report({ anno: 2027, mensili: MENSILI.map(m => ({ ...m, storico_json: storicoConfermato })), annui: ANNUI.map(a => ({ ...a, storico_json: storicoConfermato })), raccolto: { by_raccoglitore_impianto: perImpianto }, commessa }));
  verifica('controprova: confermati, il Report generale non dice niente', !/copiat|da confermare/i.test(trc), trc.slice(0, 500));

  const carte = prova(await disegnaComponente('src/components/target-status/KpiCards.jsx'));
  const kpis = { targetAnnuoTotale: 11600, fonteTarget: 'contratto', targetDaConfermare: false, raccoltoTotale: 50, residuoAnno: 11550, scartoMese: -40, attesoMese: 90, mesiScarto: ['Gennaio'], filtriScarto: [], conFiltri: false, giornoDati: '2027-01-14', ultimoRitiro: '2027-01-14' };
  const tk = testoDi(carte({ kpis: { ...kpis, targetCopiatiMese: 1 }, anno: 2027 }));
  verifica('la card dello scarto di gennaio dice il target copiato che l\'atteso conta', /Un target dei raccoglitori è copiato dal 2026, da confermare in Target raccoglitori: l'atteso lo conta\./.test(tk), tk.slice(-500));
  verifica('controprova: senza target copiati la card non lo dice', !/copiat/.test(testoDi(carte({ kpis: { ...kpis, targetCopiatiMese: 0 }, anno: 2027 }))));
  // la pagina: l'anno alla tabella, e i target copiati dei mesi scelti alla card
  verifica('la pagina passa alla tabella l\'anno e il conto dell\'anno, e conta i target copiati dei mesi scelti', /<TargetTable data=\{mergedData\} anno=\{anno\} copiati=\{copiatiDellAnno\} \/>/.test(pagina) && /targetCopiatiDellAnno\(\{ mensili: targets, annui \}\)/.test(pagina)
    && /if \(m\.daConfermare\) copiatiMese\+\+;/.test(pagina) && /targetCopiatiMese: copiatiMese,/.test(pagina));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
