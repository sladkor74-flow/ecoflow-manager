// LE ORE DEL PORTALE NELLE PAGINE, NELLE ESPORTAZIONI E NEGLI ASSEGNATI
// (difetto 9, 16/10/2026).
//
// Il portale scrive l'ora ITALIANA e il gestionale la salva com'e' scritta, con
// la Z per convenzione: '2026-12-31T23:30:00.000Z' e' il 31/12/2026 alle 23:30
// italiane. Qui si prova chi la mostra o ne ricava mese e anno:
//   - la matrice degli assegnati (computeAssegnatiMatrix) e il loro file Excel
//     (exportAssegnati): mese e anno si leggevano dai campi salvati, che
//     l'arricchimento scriveva col fuso italiano, e un ordine del 31/12 alle
//     23:30 era di gennaio dell'anno dopo. L'archivio finto ha apposta mese e
//     anno salvati male, come li scriveva l'arricchimento di prima;
//   - gli Excel delle secondarie (exportSecondarie) e delle terziarie
//     (exportTerziarie): gg/mm/aaaa, con gli zeri; le terziarie scrivevano la
//     stringa salvata, «2026-12-31T23:30:00.000Z»;
//   - le tabelle: AssegnatiTable, PrimarieReteTable, SecondarieTable,
//     TerziarieTable, il dettaglio di PrimarieAci, DrillDownModal, e il titolo
//     «chiuso a portale il» di DaDichiarareTable;
//   - la pagina Assegnati, coi filtri per anno e mese.
// La funzione che controlla le sedi dei punti di raccolta (verificaSediPdr) ha
// il suo caso in prove/verificaSediPdrFunzione.mjs.
//
// LA PROVA GIRA DUE VOLTE, con TZ=UTC (il server) e con TZ=Europe/Rome (il
// browser): si rilancia da sola e pretende in tutti e due i fusi lo stesso esito
// e le stesse cose a video, carattere per carattere.
//
// Le attese sono sulle condizioni, col tempo vero (performance.now), mai un
// numero fisso di giri: su una macchina lenta la prova aspetta di piu', non
// cade (la lezione della copia di sicurezza, 15/10/2026).
//
// npm run prove
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const FUSI = ['UTC', 'Europe/Rome'];

if (!process.env.ORE_PAGINE_FUSO) {
  let fallite = 0;
  const visti = {};
  for (const fuso of FUSI) {
    const r = spawnSync(process.execPath, ['--no-warnings', fileURLToPath(import.meta.url)], {
      env: { ...process.env, TZ: fuso, ORE_PAGINE_FUSO: fuso }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    });
    const righe = (r.stdout || '').split(/\r?\n/);
    const riga = righe.find(l => l.startsWith('VISTI '));
    visti[fuso] = riga ? riga.slice('VISTI '.length) : null;
    console.log(`\n===== con TZ=${fuso} =====`);
    console.log(righe.filter(l => !l.startsWith('VISTI ')).join('\n').trim());
    if ((r.stderr || '').trim()) console.log(r.stderr.trim());
    if (r.status !== 0) fallite++;
  }
  console.log('\nLE STESSE COSE A VIDEO IN TUTTI E DUE I FUSI');
  const a = visti.UTC, b = visti['Europe/Rome'];
  if (a === null || b === null) {
    fallite++;
    console.log('  FALLITA: un fuso non ha restituito quello che ha visto');
  } else if (a !== b) {
    fallite++;
    const ja = JSON.parse(a), jb = JSON.parse(b);
    const diverse = Object.keys({ ...ja, ...jb }).filter(k => JSON.stringify(ja[k]) !== JSON.stringify(jb[k]));
    console.log(`  FALLITA: ${diverse.length} valori diversi fra UTC e Roma`);
    for (const k of diverse.slice(0, 15)) console.log(`    ${k}: UTC ${JSON.stringify(ja[k])} / Roma ${JSON.stringify(jb[k])}`);
  } else console.log(`  ${Object.keys(JSON.parse(a)).length} valori, identici`);
  console.log(fallite ? `\nFALLITA in ${fallite} punti` : '\ntutto superato, in UTC e in Roma');
  process.exit(fallite ? 1 : 0);
}

// ===========================================================================
// Da qui in giu' gira una volta per fuso.
// ===========================================================================
const FUSO = process.env.ORE_PAGINE_FUSO;
const { build } = await import('esbuild');
const { readFileSync } = await import('node:fs');
const { caricaPagina, clienteFinto, trova, testo } = await import('./dati/paginaFinta.mjs');

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + String(extra).slice(0, 600)); } };
const J = JSON.stringify;
// Quello che si vede, da confrontare fra i due fusi.
const VISTI = {};
const annota = (chiave, valore) => { VISTI[chiave] = valore === undefined ? null : valore; return valore; };

// Si aspetta che una condizione diventi vera, fino a 20 secondi veri: non un
// numero di giri, che su una macchina lenta non basta.
async function finoA(cond, ms = 20000) {
  const vera = () => { try { return !!cond(); } catch { return false; } };
  const fine = performance.now() + ms;
  while (!vera() && performance.now() < fine) await new Promise(r => setImmediate(r));
  return vera();
}

const scarto = new Date(2026, 0, 15).getTimezoneOffset();
verifica(`il processo gira davvero in ${FUSO}`, FUSO === 'UTC' ? scarto === 0 : scarto === -60, String(scarto));

// toLocaleDateString non mette sempre gli zeri: dipende dai dati della lingua
// del motore che gira. Il node di questo PC (ICU 78) scrive «04/09/2026», un
// motore con dati piu' vecchi «4/9/2026», ed e' quello che il progetto del
// difetto 9 ha visto lato server («1/1/2027»). Le date a video e nei file non
// devono dipendere da li': per tutta la prova toLocaleDateString scrive come il
// motore senza zeri, e una data che ci passa ancora si vede subito.
const toLocaleVero = Date.prototype.toLocaleDateString;
Date.prototype.toLocaleDateString = function (...a) { return toLocaleVero.apply(this, a).replace(/\b0(\d)\//g, '$1/'); };
verifica('toLocaleDateString scrive come un motore senza zeri', new Date(Date.UTC(2026, 8, 4, 12)).toLocaleDateString('it-IT') === '4/9/2026', new Date(Date.UTC(2026, 8, 4, 12)).toLocaleDateString('it-IT'));

// ---------------------------------------------------------------------------
// Il banco delle funzioni: l'SDK finto (archivi in globalThis.__DB) e una
// libreria dei fogli finta, che tiene le righe di ogni foglio scritto.
// ---------------------------------------------------------------------------
const SDK_FINTO = `
const tabella = (nome) => (globalThis.__DB[nome] = globalThis.__DB[nome] || []);
const uguale = (r, f) => Object.entries(f || {}).every(([k, v]) => r[k] === v);
const entita = (nome) => ({
  list: async (_o, quanti = 5000, salta = 0) => tabella(nome).slice(salta, salta + quanti).map(r => ({ ...r })),
  filter: async (f, _o, quanti = 5000, salta = 0) => tabella(nome).filter(r => uguale(r, f)).slice(salta, salta + quanti).map(r => ({ ...r })),
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: 'admin', email: 'prova@prova' }) }, asServiceRole: { entities }, entities };
}`;
const XLSX_FINTO = `
export const utils = {
  book_new: () => { const wb = { fogli: [] }; globalThis.__LIBRI.push(wb); return wb; },
  json_to_sheet: (righe) => ({ righe }),
  book_append_sheet: (wb, ws, nome) => { wb.fogli.push({ nome, righe: ws.righe }); },
};
export function write() { return 'ZmludG8='; }`;

async function caricaFunzione(nome) {
  const pacchetto = await build({
    entryPoints: [qui(`../base44/functions/${nome}/entry.ts`)],
    bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
    plugins: [{ name: 'finti', setup(b) {
      b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'finto' }));
      b.onResolve({ filter: /^npm:xlsx/ }, () => ({ path: 'xlsx', namespace: 'finto' }));
      b.onLoad({ filter: /.*/, namespace: 'finto' }, (a) => ({ contents: a.path === 'sdk' ? SDK_FINTO : XLSX_FINTO, loader: 'js' }));
    } }],
  });
  return import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
}
async function chiama(modulo, db, corpo) {
  globalThis.__DB = JSON.parse(JSON.stringify(db));
  globalThis.__LIBRI = [];
  const res = await modulo.default({ json: async () => corpo });
  return { stato: res.status, j: await res.json(), fogli: (globalThis.__LIBRI[0] || { fogli: [] }).fogli };
}
const foglio = (fogli, nome) => (fogli.find(f => f.nome === nome) || { righe: [] }).righe;

// Gli assegnati del banco. A1 e' l'ordine dell'ultima sera dell'anno, con mese e
// anno salvati come li scriveva l'arricchimento di prima (gennaio 2027). A2 non
// ha l'immissione: vale il campo salvato, il ripiego. A3 ha giorno e mese di una
// cifra: la data deve uscire con gli zeri.
const ASSEGNATI = [
  { id: 'A1', id_ordine: 'ET26999001', stato: 'assegnato', ordine_immesso_il: '2026-12-31T23:30:00.000Z', mese: 'Gennaio', anno: 2027, regione: 'Campania', provincia: 'NA', classe: 'A', peso_stimato: 1000, quantita_richiesta: 10, partner_operativo: 'SMOCO' },
  { id: 'A2', id_ordine: 'ET26999002', stato: 'assegnato', mese: 'Marzo', anno: 2026, regione: 'Puglia', provincia: 'BA', classe: 'A', peso_stimato: 400, quantita_richiesta: 4, partner_operativo: 'SMOCO' },
  { id: 'A3', id_ordine: 'ET26999003', stato: 'assegnato', ordine_immesso_il: '2026-09-04T10:00:00.000Z', mese: 'Settembre', anno: 2026, regione: 'Campania', provincia: 'SA', classe: 'A', peso_stimato: 700, quantita_richiesta: 7, partner_operativo: 'SMOCO' },
];

// ---------------------------------------------------------------------------
console.log('LA MATRICE DEGLI ASSEGNATI (computeAssegnatiMatrix)');
{
  const { MESI } = await import('../base44/shared/raccoltoCalculator.ts');
  const { MESI_MOVIMENTI } = await import('../base44/shared/movimenti.ts');
  verifica('i mesi della matrice e quelli di meseElenco sono la stessa lista', J(MESI) === J(MESI_MOVIMENTI), `${J(MESI)} / ${J(MESI_MOVIMENTI)}`);

  const matrice = await caricaFunzione('computeAssegnatiMatrix');
  for (const entita of ['Assegnato', 'AssegnatoAci']) {
    const db = { [entita]: ASSEGNATI };
    const filtrata = await chiama(matrice, db, { entity: entita, filters: { anno: [2026], mese: ['Dicembre'], data: '2026-12-31' } });
    const ids = (filtrata.j.matrix || []).map(m => `${m.anno}|${m.semestre}|${m.provincia}|${m.ordini}`);
    verifica(`${entita}: anno 2026, Dicembre e giorno 31/12/2026 trovano l'ordine delle 23:30`,
      filtrata.stato === 200 && filtrata.j.filteredCount === 1 && J(ids) === J(['2026|2° Semestre|NA|1']), `${filtrata.j.filteredCount} ${J(ids)} ${filtrata.j.error || ''}`);
    annota(`matrice ${entita} filtrata`, ids);
    const gennaio = await chiama(matrice, db, { entity: entita, filters: { anno: [2027] } });
    verifica(`${entita}: sotto il 2027 non c'e' niente`, gennaio.j.filteredCount === 0, String(gennaio.j.filteredCount));
    const tutto = await chiama(matrice, db, { entity: entita, filters: {} });
    verifica(`${entita}: le scelte degli anni non hanno il 2027`, J(tutto.j.filterOptions.anni) === J([2026]), J(tutto.j.filterOptions.anni));
    verifica(`${entita}: le scelte dei mesi sono Marzo, Settembre e Dicembre, non Gennaio`, J(tutto.j.filterOptions.mesi) === J(['Marzo', 'Settembre', 'Dicembre']), J(tutto.j.filterOptions.mesi));
    const celle = (tutto.j.matrix || []).map(m => `${m.anno}|${m.semestre}|${m.provincia}`).sort();
    verifica(`${entita}: l'ordine delle 23:30 e' nel 2° semestre del 2026; quello senza immissione resta al 1° (marzo, il ripiego)`,
      J(celle) === J(['2026|1° Semestre|BA', '2026|2° Semestre|NA', '2026|2° Semestre|SA']), J(celle));
    verifica(`${entita}: i KPI dei semestri, in tonnellate`, tutto.j.kpi.sem1_ton === 0.4 && tutto.j.kpi.sem2_ton === 1.7, `${tutto.j.kpi.sem1_ton} ${tutto.j.kpi.sem2_ton}`);
    const marzo = await chiama(matrice, db, { entity: entita, filters: { anno: ['2026'], mese: ['Marzo'] } });
    verifica(`${entita}: l'assegnato senza immissione resta nel 2026 e a marzo, come salvato`, marzo.j.filteredCount === 1 && J((marzo.j.matrix || []).map(m => m.provincia)) === J(['BA']), J(marzo.j.matrix));
    const giorno = await chiama(matrice, db, { entity: entita, filters: { data: '2027-01-01' } });
    verifica(`${entita}: il filtro per giorno non lo mette al 01/01/2027`, giorno.j.filteredCount === 0, String(giorno.j.filteredCount));
    annota(`matrice ${entita}`, { celle, anni: tutto.j.filterOptions.anni, mesi: tutto.j.filterOptions.mesi });
  }
}

// ---------------------------------------------------------------------------
console.log('\nL\'EXCEL DEGLI ASSEGNATI (exportAssegnati)');
{
  const esporta = await caricaFunzione('exportAssegnati');
  const db = { Assegnato: ASSEGNATI };
  const dettaglio = await chiama(esporta, db, { entity: 'Assegnato', mode: 'detail', filters: {} });
  const righe = foglio(dettaglio.fogli, 'Dettaglio Assegnati');
  const di = (id) => righe.find(r => r['ID Ordine'] === id) || {};
  const vista = righe.map(r => [r['ID Ordine'], r['Ordine Immesso'], r['Mese Immissione'], r['Anno Immissione']]);
  annota('excel assegnati dettaglio', vista);
  verifica('l\'ordine delle 23:30 del 31/12: «31/12/2026», Dicembre, 2026',
    di('ET26999001')['Ordine Immesso'] === '31/12/2026' && di('ET26999001')['Mese Immissione'] === 'Dicembre' && di('ET26999001')['Anno Immissione'] === 2026, J(vista));
  verifica('la data con gli zeri: «04/09/2026», non «4/9/2026»', di('ET26999003')['Ordine Immesso'] === '04/09/2026', J(di('ET26999003')));
  verifica('senza immissione: data vuota, mese e anno salvati', di('ET26999002')['Ordine Immesso'] === '' && di('ET26999002')['Mese Immissione'] === 'Marzo' && di('ET26999002')['Anno Immissione'] === 2026, J(di('ET26999002')));
  const filtrato = await chiama(esporta, db, { entity: 'Assegnato', mode: 'detail', filters: { anno: ['2026'], mese: ['Dicembre'] } });
  verifica('coi filtri 2026 e Dicembre il file ha l\'ordine delle 23:30', filtrato.j.count === 1 && foglio(filtrato.fogli, 'Dettaglio Assegnati')[0]?.['ID Ordine'] === 'ET26999001', J(filtrato.j));
  const matrice = await chiama(esporta, db, { entity: 'Assegnato', mode: 'matrix', filters: {} });
  const celle = foglio(matrice.fogli, 'Matrice Aggregata').map(r => `${r.Anno}|${r.Semestre}|${r.Provincia}|${r['N. Ordini']}`).sort();
  annota('excel assegnati matrice', celle);
  verifica('la matrice del file: l\'ordine delle 23:30 nel 2° semestre del 2026, nessun 2027',
    J(celle) === J(['2026|1° Semestre|BA|1', '2026|2° Semestre|NA|1', '2026|2° Semestre|SA|1']), J(celle));
}

// ---------------------------------------------------------------------------
// Un movimento con tutte e quattro le date: immesso e chiuso tardi la sera,
// inizio e fine trasporto a mezzanotte, come le salva lo scrittore.
const MOVIMENTO = {
  ordine_immesso_il: '2026-12-31T23:30:00.000Z',
  trasporto_iniziato_il: '2027-01-10T00:00:00.000Z',
  trasporto_finito_il: '2027-01-15T00:00:00.000Z',
  ordine_chiuso_il: '2027-01-18T23:45:00.000Z',
};

console.log('\nL\'EXCEL DELLE SECONDARIE (exportSecondarie)');
{
  const esporta = await caricaFunzione('exportSecondarie');
  const SECONDARIE = [
    { id: 'S1', id_ordine: 'ET27000001', stato: 'Terminato', stoccaggio: 'NAPPI SUD', destinazione: 'IRIGOM SRL', classe: 'A', peso_effettivo: 20000, partner_operativo: 'SMOCO', numero_fir: 'FIR1', ...MOVIMENTO },
    // un terminato senza fine trasporto: va nel foglio delle date da sistemare
    { id: 'S2', id_ordine: 'ET27000002', stato: 'Terminato', stoccaggio: 'NAPPI SUD', destinazione: 'IRIGOM SRL', classe: 'A', peso_effettivo: 18000, partner_operativo: 'SMOCO', numero_fir: 'FIR2', ordine_immesso_il: '2026-12-31T23:30:00.000Z', trasporto_iniziato_il: '2027-01-10T00:00:00.000Z' },
  ];
  const dettaglio = await chiama(esporta, { Secondaria: SECONDARIE }, { mode: 'detail', filters: {} });
  const s1 = foglio(dettaglio.fogli, 'Dettaglio Secondarie').find(r => r['ID Ordine'] === 'ET27000001') || {};
  const vista = [s1['Ordine Immesso'], s1['Trasporto Finito'], s1['Ordine Chiuso']];
  annota('excel secondarie dettaglio', vista);
  verifica('«Ordine Immesso» 31/12/2026, «Trasporto Finito» 15/01/2027, «Ordine Chiuso» 18/01/2027',
    J(vista) === J(['31/12/2026', '15/01/2027', '18/01/2027']), J(vista));
  const sintesi = await chiama(esporta, { Secondaria: SECONDARIE }, { mode: 'matrix', filters: {} });
  const s2 = foglio(sintesi.fogli, 'Date da sistemare').find(r => r['ID Ordine'] === 'ET27000002') || {};
  const vista2 = [s2['Ordine Immesso'], s2['Trasporto Iniziato'], s2['Trasporto Finito']];
  annota('excel secondarie date da sistemare', vista2);
  verifica('il foglio delle date da sistemare: immesso 31/12/2026, iniziato 10/01/2027, fine vuota', J(vista2) === J(['31/12/2026', '10/01/2027', '']), J(vista2));
}

console.log('\nL\'EXCEL DELLE TERZIARIE (exportTerziarie)');
{
  const esporta = await caricaFunzione('exportTerziarie');
  const TERZIARIE = [
    { id: 'T1', id_ordine: 'ET27000011', stato: 'Terminato', unita_locale_origine: 'IRIGOM SRL', destinazione: 'CEMENTERIA', peso_effettivo: 25000, numero_fir: 'FIR11', ...MOVIMENTO },
    // date che mancano: celle vuote, non una data inventata
    { id: 'T2', id_ordine: 'ET27000012', stato: 'Assegnato', unita_locale_origine: 'IRIGOM SRL', destinazione: 'CEMENTERIA', ordine_immesso_il: '2026-09-04T10:00:00.000Z' },
  ];
  const r = await chiama(esporta, { Terziaria: TERZIARIE }, { filters: {} });
  const righe = foglio(r.fogli, 'Terziarie');
  const date = (id) => { const x = righe.find(y => y['ID Ordine'] === id) || {}; return [x['Ordine immesso il'], x['Trasporto iniziato il'], x['Trasporto finito il'], x['Ordine chiuso il']]; };
  annota('excel terziarie', [date('ET27000011'), date('ET27000012')]);
  verifica('le quattro date in gg/mm/aaaa, non la stringa salvata', J(date('ET27000011')) === J(['31/12/2026', '10/01/2027', '15/01/2027', '18/01/2027']), J(date('ET27000011')));
  verifica('con gli zeri, e vuote se mancano', J(date('ET27000012')) === J(['04/09/2026', '', '', '']), J(date('ET27000012')));
  verifica('nessuna data del file ha la forma salvata con la Z', !righe.some(x => Object.values(x).some(v => /\d{4}-\d{2}-\d{2}T/.test(String(v)))));
}

// ---------------------------------------------------------------------------
// Le tabelle, montate con React finto (prove/dati/paginaFinta.mjs).
// ---------------------------------------------------------------------------
const righeDi = (albero) => trova(albero, el => el.type === 'tr' && trova(el, 'td').length > 1);
// La cella di una colonna: il td con quella chiave, o il td dentro il frammento
// con quella chiave (AssegnatiTable mette le colonne in un frammento).
const cella = (riga, chiave) => {
  const el = trova(riga, x => x.key === chiave)[0];
  if (!el) return null;
  return el.type === 'td' ? el : trova(el, 'td')[0] || null;
};
const testoCella = (riga, chiave) => { const c = cella(riga, chiave); return c ? testo(c).trim() : null; };
globalThis.__CLIENTE_FINTO = clienteFinto({ archivi: {} }).cliente;

console.log('\nLA TABELLA DEGLI ASSEGNATI (AssegnatiTable)');
{
  const t = await caricaPagina('components/assegnati/AssegnatiTable');
  const m = t.monta(t.Componente, { records: ASSEGNATI, loading: false });
  await finoA(() => righeDi(m.albero).length === 3);
  const riga = (id) => righeDi(m.albero).find(rr => testoCella(rr, 'id_ordine') === id);
  const vista = ['ET26999001', 'ET26999002', 'ET26999003'].map(id => [testoCella(riga(id), 'ordine_immesso_il'), testoCella(riga(id), 'mese'), testoCella(riga(id), 'anno')]);
  annota('tabella assegnati', vista);
  verifica('l\'ordine delle 23:30 del 31/12: «31/12/2026», Dicembre, 2026', J(vista[0]) === J(['31/12/2026', 'Dicembre', '2026']), J(vista[0]));
  verifica('senza immissione: data vuota, mese e anno salvati (il ripiego)', J(vista[1]) === J(['', 'Marzo', '2026']), J(vista[1]));
  verifica('la data con gli zeri: «04/09/2026»', J(vista[2]) === J(['04/09/2026', 'Settembre', '2026']), J(vista[2]));
  verifica('a 375 px la data resta su una riga', /whitespace-nowrap/.test(cella(riga('ET26999001'), 'ordine_immesso_il')?.props.className || ''));
  verifica('nessun errore della tabella', m.errori.length === 0, String(m.errori[0] || ''));
  m.smonta();
}

console.log('\nLE TABELLE DEI MOVIMENTI: «CHIUSO IL» E LE DATE');
{
  const tab = await caricaPagina('components/primarie-rete/PrimarieReteTable', { reali: ['@/hooks/useTableSort'] });
  const rete = { id: 'R1', id_ordine: 'ET26999101', stato: 'Terminato', ordine_immesso_il: '2026-12-20T10:00:00.000Z', trasporto_iniziato_il: '2026-12-28T00:00:00.000Z', trasporto_finito_il: '2026-12-30T00:00:00.000Z', ordine_chiuso_il: '2026-12-31T23:30:00.000Z', peso_effettivo: 1000 };
  const m = tab.monta(tab.Componente, { records: [rete], loading: false });
  await finoA(() => righeDi(m.albero).length === 1);
  const r1 = righeDi(m.albero)[0];
  const vista = [testoCella(r1, 'fine_trasporto'), testoCella(r1, 'ordine_chiuso_il')];
  annota('PrimarieReteTable', vista);
  verifica('PrimarieReteTable: fine 30/12/2026, «Chiuso il» 31/12/2026', J(vista) === J(['30/12/2026', '31/12/2026']), J(vista));
  verifica('PrimarieReteTable: nessun errore', m.errori.length === 0, String(m.errori[0] || ''));
  m.smonta();
}
{
  const tab = await caricaPagina('components/secondarie/SecondarieTable', { reali: ['@/hooks/useTableSort'] });
  // come la prepara Secondarie.jsx: fine_trasporto e' il valore salvato
  const sec = { id: 'S9', id_ordine: 'ET26999201', stato: 'Terminato', fine_trasporto: '2026-12-30T00:00:00.000Z', giorno_ordine: '2026-12-30', ordine_chiuso_il: '2026-12-31T23:30:00.000Z', peso_effettivo: 1000 };
  const m = tab.monta(tab.Componente, { records: [sec], loading: false });
  await finoA(() => righeDi(m.albero).length === 1);
  const r1 = righeDi(m.albero)[0];
  const vista = [testoCella(r1, 'fine_trasporto'), testoCella(r1, 'ordine_chiuso_il')];
  annota('SecondarieTable', vista);
  verifica('SecondarieTable: fine 30/12/2026, «Chiuso il» 31/12/2026', J(vista) === J(['30/12/2026', '31/12/2026']), J(vista));
  verifica('SecondarieTable: nessun errore', m.errori.length === 0, String(m.errori[0] || ''));
  m.smonta();
}
{
  const tab = await caricaPagina('components/terziarie/TerziarieTable', { reali: ['@/hooks/useTableSort'] });
  const terz = [
    { id: 'T8', id_ordine: 'ET26999301', trasporto_finito_il: '2026-10-14T00:00:00.000Z' },
    { id: 'T9', id_ordine: 'ET26999302', trasporto_finito_il: '2026-09-04T00:00:00.000Z' },
  ];
  const m = tab.monta(tab.Componente, { records: terz, loading: false });
  await finoA(() => righeDi(m.albero).length === 2);
  const vista = righeDi(m.albero).map(rr => testoCella(rr, 'trasporto_finito_il'));
  annota('TerziarieTable', vista);
  verifica('TerziarieTable: «14/10/2026» e «04/09/2026», con gli zeri', J(vista) === J(['14/10/2026', '04/09/2026']), J(vista));
  verifica('TerziarieTable: nessun errore', m.errori.length === 0, String(m.errori[0] || ''));
  m.smonta();
}
{
  const t = await caricaPagina('components/report-pivot/DrillDownModal');
  const m = t.monta(t.Componente, { open: true, onClose: () => {}, title: 'Dettaglio', loading: false, total: 1, records: [{ id_ordine: 'ET26999401', stato: 'Terminato', ...MOVIMENTO, ordine_chiuso_il: '2026-12-31T23:30:00.000Z' }] });
  await finoA(() => righeDi(m.albero).length === 1);
  const tds = trova(righeDi(m.albero)[0], 'td').map(x => testo(x).trim());
  const vista = [tds[2], tds[9]];
  annota('DrillDownModal', vista);
  verifica('DrillDownModal: fine 15/01/2027, «Chiuso il» 31/12/2026', J(vista) === J(['15/01/2027', '31/12/2026']), J(tds));
  verifica('DrillDownModal: nessun errore', m.errori.length === 0, String(m.errori[0] || ''));
  m.smonta();
}
{
  // Il dettaglio della pagina PrimarieAci: la pagina vera, col client finto.
  const p = await caricaPagina('pages/PrimarieAci', { reali: ['@/components/shared/CercaIdOrdine', '@/hooks/useTableSort'] });
  const aci = { id: 'C1', id_ordine: 'ET26999501', stato: 'Terminato', numero_fir: 'FIRACI1', ordine_immesso_il: '2026-12-20T10:00:00.000Z', trasporto_iniziato_il: '2026-12-28T00:00:00.000Z', trasporto_finito_il: '2026-12-30T00:00:00.000Z', ordine_chiuso_il: '2026-12-31T23:30:00.000Z', peso_stimato: 2000, peso_effettivo: 1900 };
  globalThis.__CLIENTE_FINTO = clienteFinto({ archivi: { PrimariaAci: [aci] } }).cliente;
  const m = p.monta(p.Componente, {});
  const rigaAci = () => righeDi(m.albero).find(rr => cella(rr, 'ordine_chiuso_il'));
  await finoA(() => rigaAci());
  const vista = rigaAci() ? [testoCella(rigaAci(), 'fine_trasporto'), testoCella(rigaAci(), 'ordine_chiuso_il')] : null;
  annota('PrimarieAci', vista);
  verifica('PrimarieAci, dettaglio: fine 30/12/2026, «Chiuso il» 31/12/2026', J(vista) === J(['30/12/2026', '31/12/2026']), J(vista));
  verifica('PrimarieAci: nessun errore', m.errori.length === 0, String(m.errori[0] || ''));
  m.smonta();
  globalThis.__CLIENTE_FINTO = clienteFinto({ archivi: {} }).cliente;
}

console.log('\n«DA DICHIARARE»: LA CHIUSURA A PORTALE (DaDichiarareTable)');
{
  // Come prove/daDichiarareRicercaAttesa.mjs: la tabella vera, con la funzione
  // finta. La chiusura delle 23:30 dell'11/10 e' dell'11/10, non del 12.
  const RIGA = { ordine_primaria: 'ET26999601', numero_fir: 'FIR601', fine_trasporto: '2026-10-09', data_chiusura: '2026-10-11T23:30:00.000Z', punto_di_raccolta: 'P', peso_non_dichiarato_kg: 1200 };
  const c = clienteFinto({ funzioni: { getOrdiniDaDichiarare: async () => ({ righe: [RIGA], totale_righe: 1, totale_kg: 1200, per_mese: [], siti_distinti: ['IRIGOM SRL'], province_distinte: ['NA'], anni_distinti: [2026] }) } });
  globalThis.__CLIENTE_FINTO = c.cliente;
  const t = await caricaPagina('components/giacenze/DaDichiarareTable');
  const m = t.monta(t.Componente, { onPulisciFiltroSito: () => {} });
  const cellaChiusura = () => trova(m.albero, el => el.type === 'td' && /^chiuso a portale il /.test(el.props.title || ''))[0];
  await finoA(() => cellaChiusura());
  const titolo = cellaChiusura()?.props.title || null;
  annota('DaDichiarareTable', titolo);
  verifica('il titolo dice «chiuso a portale il 11/10/2026»', titolo === 'chiuso a portale il 11/10/2026', titolo);
  verifica('e la fine trasporto resta 09/10/2026', /^09\/10\/2026/.test(testo(cellaChiusura() || '').trim()), testo(cellaChiusura() || ''));
  verifica('DaDichiarareTable: nessun errore', m.errori.length === 0, String(m.errori[0] || ''));
  m.smonta();
  globalThis.__CLIENTE_FINTO = clienteFinto({ archivi: {} }).cliente;
}

// ---------------------------------------------------------------------------
console.log('\nLA PAGINA ASSEGNATI: I FILTRI PER ANNO E MESE (Assegnati.jsx)');
{
  const p = await caricaPagina('pages/Assegnati', { reali: ['@/components/shared/CercaIdOrdine'] });
  const c = clienteFinto({ funzioni: { computeAssegnatiMatrix: async () => ({ kpi: {}, matrix: [], filterOptions: {} }) }, archivi: { Assegnato: ASSEGNATI } });
  globalThis.__CLIENTE_FINTO = c.cliente;
  const m = p.monta(p.Componente, { entity: 'Assegnato' });
  const tabs = () => trova(m.albero, el => el.type && el.type.__finto === 'Tabs' && ['matrix', 'detail'].includes(el.props.value))[0];
  const tabella = () => trova(m.albero, el => el.type && el.type.__finto === 'AssegnatiTable')[0];
  const filtro = (breve) => trova(m.albero, el => el.type && el.type.__finto === 'MultiSelect' && el.props.breve === breve)[0];
  await finoA(() => tabs());
  tabs().props.onValueChange('detail');
  await finoA(() => tabella() && tabella().props.loading === false && (tabella().props.records || []).length === 3);
  const ids = () => (tabella()?.props.records || []).map(r => r.id_ordine).sort();
  // Si sceglie un filtro e si aspetta che la pagina rifaccia l'elenco.
  const scegli = async (breve, valori) => {
    const prima = tabella()?.props.records;
    filtro(breve).props.onChange(valori);
    await finoA(() => tabella()?.props.records !== prima);
    return ids();
  };
  const anno2026 = await scegli('Anni', ['2026']);
  annota('Assegnati 2026', anno2026);
  verifica('anno 2026: tutti e tre, compreso l\'ordine delle 23:30 del 31/12', J(anno2026) === J(['ET26999001', 'ET26999002', 'ET26999003']), J(anno2026));
  const anno2027 = await scegli('Anni', ['2027']);
  annota('Assegnati 2027', anno2027);
  verifica('anno 2027: nessuno', J(anno2027) === J([]), J(anno2027));
  await scegli('Anni', []);
  const dicembre = await scegli('Mesi', ['Dicembre']);
  annota('Assegnati Dicembre', dicembre);
  verifica('Dicembre: l\'ordine delle 23:30 del 31/12', J(dicembre) === J(['ET26999001']), J(dicembre));
  const gennaio = await scegli('Mesi', ['Gennaio']);
  verifica('Gennaio: nessuno', J(gennaio) === J([]), J(gennaio));
  const marzo = await scegli('Mesi', ['Marzo']);
  verifica('Marzo: l\'assegnato senza immissione, col mese salvato', J(marzo) === J(['ET26999002']), J(marzo));
  verifica('la pagina non ha letto gli ordini piu\' di una volta', c.letture('Assegnato').length === 1, String(c.letture('Assegnato').length));
  verifica('nessun errore della pagina', m.errori.length === 0, String(m.errori[0] || ''));
  m.smonta();
  // Il filtro per giorno non ha un campo a video (lo usa solo chi chiama la
  // pagina con i filtri gia' pronti): lo si guarda nel sorgente.
  const sorgente = readFileSync(qui('../src/pages/Assegnati.jsx'), 'utf8').replace(/\r/g, '');
  verifica('il filtro per giorno legge il giorno scritto nel file (giornoPortale)', /filters\.data && giornoPortale\(r\.ordine_immesso_il\) !== filters\.data/.test(sorgente));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite (TZ=${FUSO})`);
console.log('VISTI ' + J(VISTI));
process.exit(ko ? 1 : 0);
