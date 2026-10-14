// I DOCUMENTI CHE ESCONO: STESSA VESTE E LA DATA DEI DATI (chiusura dell'audit,
// 11/10/2026).
//
// La veste «professionale» decisa il 03/10 (exceljs e il corredo
// src/lib/fogliProfessionali.js) la seguivano solo il format dell'amministrazione
// e il report settimanale. Gli altri file - i tre report dell'attiva, la passiva
// per canale, il report dei conferimenti, il confronto col consuntivo di un
// fornitore, giacenze, dichiarazioni, andamento raccoglitori, extra raccolta -
// uscivano da SheetJS senza fascia, intestazioni, piede ne' data, e il Report
// Mensile come CSV. Nessun file diceva fino a che giorno arrivano i dati: un
// foglio mandato il 10 con i dati al 7 non lo rivelava.
//
// Qui si producono i file veri, si riaprono con exceljs (o si rilegge il testo
// del PDF) e si controlla:
// 1. la funzione datiFinoAl: legge solo gli archivi chiesti, dice il giorno
//    dell'ultimo caricamento e i caricamenti aperti, e chi esporta;
// 2. il blocco di testa uguale per tutti (intestazioneDocumento): canale,
//    periodo per fine trasporto, dati fino al, generato il ... da ...;
// 3. i tre report dell'attiva: il primo foglio ha le colonne e le celle di prima,
//    identiche, e la testa sta in un foglio «Note»;
// 4. ogni export: il blocco di testa, la veste, e i totali del file uguali a
//    quelli a video;
// 5. il Report Mensile in Excel: tonnellate coi decimali giusti, e una cella
//    senza movimenti vuota, mai 0;
// 6. i PDF: la stessa testa, e «Pagina x di N»;
// 7. il prezzo da due a quattro decimali (tipo 'prezzoLibero' del corredo), lo
//    stesso nel PDF e nell'Excel, con 'euro' e 'prezzo' che scrivono come prima.
// npm run prove
import { build } from 'esbuild';
import { resolveObjectURL } from 'node:buffer';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { caricaLibPagine } from './dati/libPagine.mjs';
import { calcolaPassivaMese, indiceMesePassiva } from '../base44/shared/passivaCalcolo.ts';
import { calcolaPivot } from '../base44/shared/reportMensile.ts';
import { reportConferimenti } from '../base44/shared/reportConferimenti.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
// Una sezione che si ferma a meta' e' una prova fallita, non un crollo che
// nasconde le altre.
const sezione = async (titolo, fn) => {
  console.log(titolo);
  try { await fn(); } catch (e) { ko++; console.log('  FALLITA: la sezione si e\' fermata: ' + (e && e.stack ? e.stack.split('\n').slice(0, 2).join(' ') : e)); }
};

const modulo = await import('exceljs');
const ExcelJS = modulo.default || modulo;
const radice = new URL('../', import.meta.url);

// Lo stato dei dati come lo risponde il server: per le prove si passa gia' fatto.
const ARCHIVI = [
  { archivio: 'primarie di rete', entita: 'PrimariaRete', tipo_file: 'primarie', cosa: 'ultima fine trasporto dei terminati', dati_fino_al: '2026-10-06', caricato_il: '2026-10-09' },
  { archivio: 'primarie ACI', entita: 'PrimariaAci', tipo_file: 'primarie', cosa: 'ultima fine trasporto dei terminati', dati_fino_al: '2026-10-03', caricato_il: '2026-10-09' },
  { archivio: 'secondarie', entita: 'Secondaria', tipo_file: 'secondarie', cosa: 'ultima fine trasporto dei terminati', dati_fino_al: '2026-10-05', caricato_il: '2026-10-08' },
  { archivio: 'terziarie', entita: 'Terziaria', tipo_file: 'terziarie', cosa: 'ultima fine trasporto dei terminati', dati_fino_al: '2026-10-01', caricato_il: '2026-10-08' },
  { archivio: 'extra raccolta', entita: 'ExtraRaccolta', tipo_file: 'extra_raccolta', cosa: 'ultima fine trasporto dei terminati', dati_fino_al: '2026-10-02', caricato_il: null },
  { archivio: 'ordini non dichiarati (fotografia del portale)', entita: 'OrdineNonDichiarato', tipo_file: 'ordini_non_dichiarati', cosa: 'giorno della fotografia', dati_fino_al: '2026-10-09', caricato_il: '2026-10-09' },
  { archivio: 'report delle dichiarazioni di trattamento', entita: 'DichiarazioneTrattamento', tipo_file: 'dichiarazioni_trattamento', cosa: 'ultima dichiarazione del partner operativo SMOCO', dati_fino_al: '2026-10-08', caricato_il: '2026-10-09' },
];
const statoPer = (...entita) => ({ letto: true, utente: 'Mario Rossi', archivi: ARCHIVI.filter(a => entita.includes(a.entita)), caricamenti_aperti: [] });

// I file finiscono qui invece che nel browser: il link del download si intercetta
// e il file si rilegge dall'indirizzo del blob.
const scaricati = [];
const conDocumento = () => {
  globalThis.document = { body: { appendChild() {} }, createElement: () => ({ click() { scaricati.push({ nome: this.download, blob: resolveObjectURL(this.href) }); }, remove() {} }) };
};
const ultimoFile = async () => {
  const f = scaricati[scaricati.length - 1];
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await f.blob.arrayBuffer()));
  return { nome: f.nome, wb };
};
const valoreDi = (v) => (v && typeof v === 'object' && !(v instanceof Date) && 'result' in v ? v.result : v);
/** Le righe di un foglio come elenchi di valori (da 0), le vuote comprese. */
const righeDi = (ws) => {
  const out = [];
  for (let n = 1; n <= ws.rowCount; n++) out.push((ws.getRow(n).values || []).slice(1).map(valoreDi));
  return out;
};
const testoDi = (ws) => righeDi(ws).flat().filter(v => typeof v === 'string').join('\n');
const norma = (v) => (v === undefined || v === null || v === '' ? null : v);
const stesseRighe = (a, b) => {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) if (norma(a[i]) !== norma(b[i])) return `colonna ${i + 1}: ${JSON.stringify(a[i])} contro ${JSON.stringify(b[i])}`;
  return '';
};
const cellaDi = (ws, testo) => { let trovata = null; ws.eachRow(r => r.eachCell(c => { if (!trovata && c.value === testo) trovata = c; })); return trovata; };
const rigaCheInizia = (ws, testo) => { for (let n = 1; n <= ws.rowCount; n++) if (ws.getRow(n).getCell(1).value === testo) return ws.getRow(n); return null; };

// ─────────────────────────────────────────────────────────────────────────────
await sezione('1. LA FUNZIONE datiFinoAl', async () => {
  const SDK = `
const ordina = (righe, sort) => {
  const campo = String(sort || 'id').replace(/^[-+]/, '');
  const giu = String(sort || '').startsWith('-');
  return [...righe].sort((a, b) => {
    const x = a[campo], y = b[campo];
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return giu ? String(y).localeCompare(String(x)) : String(x).localeCompare(String(y));
  });
};
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => (v && Array.isArray(v.$in) ? v.$in.includes(r[k]) : r[k] === v));
const entita = (nome) => ({
  list: async (sort, quanti = 5000, salta = 0) => { globalThis.__LETTE.push(nome); return ordina(globalThis.__DB[nome] || [], sort).slice(salta, salta + quanti); },
  filter: async (f, sort, quanti = 5000, salta = 0) => { globalThis.__LETTE.push(nome); return ordina((globalThis.__DB[nome] || []).filter(r => soddisfa(r, f)), sort).slice(salta, salta + quanti); },
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
export function createClientFromRequest() {
  return { auth: { me: async () => globalThis.__UTENTE }, asServiceRole: { entities }, entities };
}`;
  const pacchetto = await build({
    entryPoints: [fileURLToPath(new URL('base44/functions/datiFinoAl/entry.ts', radice))],
    bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
    plugins: [{ name: 'sdk-finto', setup(b) {
      b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
      b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: SDK, loader: 'js' }));
    } }],
  });
  const funzione = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
  const adesso = new Date().toISOString().replace('Z', '');
  const DB = {
    PrimariaRete: [
      { id: 'p1', stato: 'terminato', trasporto_finito_il: '2026-10-05T00:00:00.000Z' },
      { id: 'p2', stato: 'terminato', trasporto_finito_il: '2026-10-06T23:30:00.000Z' },   // a Roma e' gia' il 7
      { id: 'p3', stato: 'eseguito', trasporto_finito_il: '2026-10-09T10:00:00.000Z' },    // non terminato: non conta
    ],
    PrimariaAci: [{ id: 'a1', stato: 'terminato', trasporto_finito_il: '2026-09-30T08:00:00.000Z' }],
    Secondaria: [{ id: 's1', stato: 'terminato', trasporto_finito_il: '2026-10-04T08:00:00.000Z' }],
    UploadLog: [
      { id: 'u1', tipo_file: 'primarie', created_date: '2026-10-09T08:00:00', esito: 'successo', nome_file: 'primarie.xlsx' },
      { id: 'u2', tipo_file: 'secondarie', created_date: '2026-10-08T07:00:00', esito: 'successo', nome_file: 'secondarie.xlsx' },
      // una riscrittura delle secondarie partita adesso e non ancora finita
      { id: 'u3', tipo_file: 'secondarie', created_date: adesso, esito: 'in_corso', modalita: 'sostituzione', nome_file: 'secondarie2.xlsx', utente: 'Anna' },
    ],
  };
  const chiama = async (corpo, utente = { full_name: 'Mario Rossi', email: 'mario@esempio.it', role: 'user' }) => {
    globalThis.__DB = JSON.parse(JSON.stringify(DB));
    globalThis.__LETTE = [];
    globalThis.__UTENTE = utente;
    const r = await funzione.default({ json: async () => corpo });
    return { stato: r.status, j: await r.json(), lette: [...new Set(globalThis.__LETTE)] };
  };

  const senza = await chiama({ entita: ['PrimariaRete'] }, null);
  verifica('senza utente risponde 401', senza.stato === 401, String(senza.stato));

  const r = await chiama({ entita: ['PrimariaRete', 'Secondaria'] });
  verifica('risponde 200', r.stato === 200, JSON.stringify(r.j));
  const di = (e) => (r.j.archivi || []).find(a => a.entita === e) || {};
  verifica('solo gli archivi chiesti', (r.j.archivi || []).length === 2 && !r.lette.includes('PrimariaAci') && !r.lette.includes('Terziaria'), JSON.stringify(r.lette));
  verifica('le primarie di rete arrivano al 07/10: la fine trasporto delle 23:30 UTC del 6 e\' il 7 in Italia', di('PrimariaRete').dati_fino_al === '2026-10-07', String(di('PrimariaRete').dati_fino_al));
  verifica('e sono state caricate il 09/10', di('PrimariaRete').caricato_il === '2026-10-09', String(di('PrimariaRete').caricato_il));
  verifica('le secondarie: fino al 04/10, caricate l\'8 (il caricamento in corso non e\' ancora riuscito)', di('Secondaria').dati_fino_al === '2026-10-04' && di('Secondaria').caricato_il === '2026-10-08', JSON.stringify(di('Secondaria')));
  verifica('il caricamento delle secondarie in corso si dice', (r.j.caricamenti_aperti || []).some(a => a.tipo_file === 'secondarie' && /Secondarie/.test(a.titolo)), JSON.stringify(r.j.caricamenti_aperti));
  verifica('chi esporta: il nome, non l\'email', r.j.utente === 'Mario Rossi', String(r.j.utente));

  const misto = await chiama({ entita: ['PrimariaAci', 'Inventata'] });
  verifica('un archivio sconosciuto si scarta, gli altri si leggono', misto.stato === 200 && misto.j.archivi.length === 1 && misto.j.archivi[0].entita === 'PrimariaAci' && !misto.lette.includes('Inventata'), JSON.stringify(misto.j));
  const nessuno = await chiama({ entita: ['Inventata'] });
  verifica('nessun archivio riconosciuto: 400, non la lettura di tutto', nessuno.stato === 400 && !nessuno.lette.length, `${nessuno.stato} ${JSON.stringify(nessuno.lette)}`);
});

// ─────────────────────────────────────────────────────────────────────────────
const corredo = await import('../src/lib/fogliProfessionali.js');

await sezione('2. IL BLOCCO DI TESTA E\' UNO SOLO', async () => {
  const { intestazioneDocumento } = corredo;
  const quando = new Date('2026-10-11T08:32:00Z');
  const d = intestazioneDocumento({ titolo: 'Fatturazione passiva Rete — Settembre 2026', canale: 'RETE', periodo: 'Settembre 2026', stato: statoPer('PrimariaRete'), generatoIl: quando });
  verifica('canale e periodo per fine trasporto', d.righe[0] === 'Canale: Rete  ·  Periodo: Settembre 2026, per fine trasporto', d.righe[0]);
  verifica('dati fino al e giorno del caricamento, gg/mm/aaaa', d.dati === 'Dati fino al 06/10/2026  ·  caricati il 09/10/2026', d.dati);
  verifica('generato il ... alle ... (ora italiana) da ...', d.generato === 'Generato il 11/10/2026 alle 10:32 da Mario Rossi', d.generato);
  const due = intestazioneDocumento({ titolo: 'x', canale: 'RETE', periodo: 'Settembre 2026', stato: statoPer('PrimariaRete', 'Secondaria'), generatoIl: quando });
  verifica('due archivi a giorni diversi: uno per uno, mai una data sola', due.dati === 'Dati fino al: primarie di rete 06/10/2026 (caricamento del 09/10/2026)  ·  secondarie 05/10/2026 (caricamento del 08/10/2026)', due.dati);
  const nonLetto = intestazioneDocumento({ titolo: 'x', canale: 'ACI', periodo: 'Settembre 2026', stato: { letto: false, utente: '' }, generatoIl: quando });
  verifica('se la lettura non riesce lo dice, non inventa una data', /^Dati fino al: non disponibile/.test(nonLetto.dati) && !/da $/.test(nonLetto.generato), nonLetto.dati);
  const senzaArchivi = intestazioneDocumento({ titolo: 'x', stato: { utente: 'Mario Rossi' }, generatoIl: quando });
  verifica('chi non dice che archivi legge non ha la riga dei dati', senzaArchivi.dati === '' && senzaArchivi.righe.length === 1, JSON.stringify(senzaArchivi.righe));
  const vuoto = intestazioneDocumento({ titolo: 'x', stato: { letto: true, archivi: [{ archivio: 'secondarie', dati_fino_al: null, vuoto: true }, { archivio: 'terziarie', dati_fino_al: null, lettura_non_riuscita: true }] }, generatoIl: quando });
  verifica('un archivio senza giorno dice perche\', non scrive una data', /secondarie archivio vuoto/.test(vuoto.dati) && /terziarie lettura non riuscita/.test(vuoto.dati), vuoto.dati);
  const aperto = intestazioneDocumento({ titolo: 'x', stato: { ...statoPer('Secondaria'), caricamenti_aperti: [{ tipo_file: 'secondarie', titolo: 'Archivio in caricamento: Secondarie' }] }, generatoIl: quando });
  verifica('un caricamento aperto e\' un avviso del documento', aperto.avvisi.length === 1 && /Secondarie.*possono essere a metà/.test(aperto.avvisi[0]), JSON.stringify(aperto.avvisi));
});

// ─────────────────────────────────────────────────────────────────────────────
// I PDF: prima di fingere il browser, perche' jspdf guarda se c'e' un documento.
const jspdf = pathToFileURL(fileURLToPath(new URL('node_modules/jspdf/dist/jspdf.node.min.js', radice))).href;
const tabella = await caricaLibPagine('lib/esportaTabella', [
  [/await import\('jspdf'\)/g, `await import('${jspdf}').then(m => m.default || m)`],
  [/doc\.save\(`\$\{nomeSicuro\(nomeFile\)\}\.pdf`\);/g, 'globalThis.__PDF = doc.output();'],
]);
globalThis.__TABELLA = tabella;
const leggiPdf = (s) => [...new Set((String(s || '').match(/\((?:\\.|[^()\\])*\)\s*Tj/g) || [])
  .map(x => x.slice(1, x.lastIndexOf(')'))
    .replace(/\\(\d{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)))
    .replace(/\\([()\\])/g, '$1')))];
const conTabella = [["await import('@/lib/esportaTabella')", 'globalThis.__TABELLA']];
const fatt = await caricaLibPagine('lib/fatturazioneExport', conTabella);
const passiva = await caricaLibPagine('lib/passivaExport', conTabella);
const extra = await caricaLibPagine('lib/extraRaccoltaExport', [...conTabella, ["from './extraRaccoltaCalc'", "from './extraRaccoltaCalc.js'"]]);
// jspdf, se trova un window, lo prende per un browser: il finto di utils.js non serve piu'.
delete globalThis.window;

const base = { data_fine_trasporto: '2026-09-10T00:00:00.000Z', numero_fir: 'FIR1', classe: 'P', unita_misura: '€/t', fattore_conversione: 1000 };
const ATTIVA = {
  RETE: [
    { ...base, ordine: 'ET1', servizio_ecotyre: 'TRASP_TRATT', quantita: 2300, tariffa_valore: 202, totale: 464.6 },
    { ...base, ordine: 'ET2', servizio_ecotyre: 'TRASP', quantita: 3840, tariffa_valore: 202, totale: 775.68 },
    { ...base, ordine: 'ET3', servizio_ecotyre: 'TRASP_TRATT', quantita: 1000, tariffa_valore: 202, totale: 202, sospesa: true },
    // una riga a viaggio: senza prezzo a tonnellata, la cella resta vuota
    { ...base, ordine: 'ET4', unita_misura: '€/viaggio', unita_prezzo: '€/viaggio', quantita: 900, tariffa_valore: 300, totale: 300 },
  ],
  ACI: [{ ...base, ordine: 'EA1', regione: 'Puglia', ticket_n: '162399-21', servizio_ecotyre: 'TRASP_TRATT', classe: 'PFU Autodemolizione', quantita: 2640, tariffa_valore: 230, totale: 607.2, note: '' }],
  EXTRA_RACCOLTA: [
    { ...base, ordine: 'BSDCL002230PQ', quantita: 460, tariffa_valore: 202, totale: 92.92, note: "Prezzo scritto sull'intervento" },
    { ...base, ordine: 'BSDCL002230PQ', descrizione: 'Sovracosto raccolta', quantita: 0, tariffa_valore: 120, totale: 120, unita_misura: '€ a corpo', note: 'Sovracosto raccolta' },
  ],
};
const ENTITA_ATTIVA = { RETE: 'PrimariaRete', ACI: 'PrimariaAci', EXTRA_RACCOLTA: 'ExtraRaccolta' };

// La passiva di prova: le righe e i totali della prova passivaExport.mjs.
const baseP = { stato: 'terminato', cer: '160103', classe: 'A' };
const DATI_PASSIVA = {
  primarieRete: [
    { ...baseP, id: '1', id_ordine: 'ET1', numero_fir: 'F1', peso_effettivo: 10000, trasporto_finito_il: '2026-06-10T00:00:00Z', trasportatore: 'ALFA SRL', destinazione: 'BETA IMPIANTI', provincia: 'BA', tipo_destinazione: 'imp', automezzo: 'AA111AA' },
    { ...baseP, id: '2', id_ordine: 'ET2', numero_fir: 'F2', peso_effettivo: 2500, trasporto_finito_il: '2026-06-11T00:00:00Z', trasportatore: 'ALFA SRL', destinazione: 'BETA IMPIANTI', provincia: 'BA', tipo_destinazione: 'imp', automezzo: 'AA111AA' },
  ],
  primarieAci: [], secondarieAll: [], extraRaccoltaAll: [],
  tariffeAll: [{ id: 't1', direzione: 'PASSIVA', stato: 'attivo', prestazione: 'RACCOLTA', fornitore_nome: 'Alfa s.r.l.', tipologia: 'RETE', valore: 60, unita_misura: '€/t' }, { id: 't2', direzione: 'PASSIVA', stato: 'attivo', prestazione: 'TRATTAMENTO', fornitore_nome: 'Beta Impianti', tipologia: 'RETE', valore: 80, unita_misura: '€/t' }],
  fornitoriAll: [{ ragione_sociale: 'ALFA SRL', stato: 'attivo' }, { ragione_sociale: 'BETA IMPIANTI', stato: 'attivo' }],
};

await sezione('3. I PDF DICONO LA STESSA TESTA, E LE PAGINE', async () => {
  await fatt.exportFatturazioneAttivaPdf('RETE', ATTIVA.RETE, 2026, 'Settembre', { stato: statoPer('PrimariaRete') });
  const scritte = leggiPdf(globalThis.__PDF);
  const c_e = (t) => scritte.some(s => s.includes(t));
  verifica('il PDF dell\'attiva dice canale e periodo per fine trasporto', c_e('Canale: Rete') && c_e('Settembre 2026, per fine trasporto'), scritte.filter(s => /Canale|Periodo/.test(s)).join(' | '));
  verifica('e fino a che giorno arrivano i dati', c_e('Dati fino al 06/10/2026') && c_e('caricati il 09/10/2026'), scritte.filter(s => /Dati/.test(s)).join(' | '));
  verifica('il piede: chi l\'ha generato e «Pagina 1 di 1»', scritte.some(s => /Generato il \d\d\/\d\d\/\d{4} alle \d\d:\d\d da Mario Rossi .*Pagina 1 di 1/.test(s)), scritte.filter(s => /Pagina/.test(s)).join(' | '));
  verifica('niente piu\' «Esportato il»', !c_e('Esportato il'));

  // Tante righe: ogni pagina dice di quante e' il documento.
  const molte = Array.from({ length: 80 }, (_, i) => ({ ...base, ordine: 'ET' + i, quantita: 1000, tariffa_valore: 202, totale: 202 }));
  await fatt.exportFatturazioneAttivaPdf('RETE', molte, 2026, 'Settembre', { stato: statoPer('PrimariaRete') });
  const pagine = (String(globalThis.__PDF).match(/\/Type\s*\/Page[^s]/g) || []).length;
  const piedi = leggiPdf(globalThis.__PDF).filter(s => /Pagina \d+ di \d+/.test(s));
  verifica(`ottanta righe vanno su piu' pagine, e ognuna dice «di ${pagine}»`, pagine > 1 && piedi.length === pagine && piedi.every(s => s.endsWith(`di ${pagine}`)), piedi.join(' | '));

  // Senza lo stato gia' letto e senza server, il file esce lo stesso e lo dice.
  await fatt.exportFatturazioneAttivaPdf('ACI', ATTIVA.ACI, 2026, 'Settembre');
  verifica('se la lettura non riesce il PDF esce lo stesso, e lo dice', leggiPdf(globalThis.__PDF).some(s => /Dati fino al: non disponibile/.test(s)));

  // La passiva a sezioni: lo stesso blocco, dagli archivi del suo conto.
  const result = calcolaPassivaMese(DATI_PASSIVA, 2026, indiceMesePassiva('Giugno'), 'Giugno', 'RETE');
  await passiva.exportFatturazionePassivaPdf(result, { stato: statoPer('PrimariaRete', 'Secondaria') });
  const sp = leggiPdf(globalThis.__PDF);
  verifica('il PDF della passiva dice primarie e secondarie, ciascuna col suo giorno', sp.some(s => /primarie di rete 06\/10\/2026.*secondarie 05\/10\/2026/.test(s)), sp.filter(s => /Dati/.test(s)).join(' | '));
  verifica('e «Pagina 1 di 1»', sp.some(s => /Pagina 1 di 1$/.test(s)));
});

// ─────────────────────────────────────────────────────────────────────────────
conDocumento();

await sezione('4. I TRE REPORT DELL\'ATTIVA: LE COLONNE NON CAMBIANO, LA TESTA VA NELLE NOTE', async () => {
  for (const tipologia of ['RETE', 'ACI', 'EXTRA_RACCOLTA']) {
    const righe = ATTIVA[tipologia];
    const nome = await fatt.exportFatturazioneAttiva(tipologia, righe, 2026, 'Settembre', { stato: statoPer(ENTITA_ATTIVA[tipologia]) });
    const { nome: scaricato, wb } = await ultimoFile();
    verifica(`${tipologia}: il nome del file e' quello di prima`, scaricato === `Fatturazione_${tipologia}_Settembre_2026.xlsx` && nome === scaricato, scaricato);
    // Il foglio di prima, come lo scriveva SheetJS: intestazioni, righe, una
    // riga vuota e il TOTALE sotto il Prezzo Totale.
    const t = fatt.tabellaAttiva(tipologia, righe, 2026, 'Settembre');
    const ultima = new Array(t.colonne.length).fill('');
    ultima[t.iTotale - 1] = 'TOTALE';
    ultima[t.iTotale] = t.totale;
    const atteso = [t.colonne.map(c => c.titolo), ...t.righe, [], ultima];
    const ws = wb.worksheets[0];
    verifica(`${tipologia}: il primo foglio e' quello dei dati, col suo nome`, ws.name === t.foglio, ws.name);
    const letto = righeDi(ws);
    verifica(`${tipologia}: stesse righe di prima (${atteso.length})`, letto.length === atteso.length, `${letto.length} contro ${atteso.length}`);
    const diversa = atteso.map((r, i) => stesseRighe(letto[i] || [], r) && `riga ${i + 1}, ${stesseRighe(letto[i] || [], r)}`).find(Boolean);
    verifica(`${tipologia}: cella per cella identiche`, !diversa, diversa || '');
    // Il totale del file e' quello a video: la somma delle righe non sospese.
    const aVideo = Math.round(righe.filter(r => !r.sospesa).reduce((s, r) => s + r.totale, 0) * 100) / 100;
    verifica(`${tipologia}: il totale del file e' quello a video (${aVideo})`, letto[letto.length - 1][t.iTotale] === aVideo, String(letto[letto.length - 1][t.iTotale]));
    verifica(`${tipologia}: nessun blocco di testa nel foglio dei dati`, !/Dati fino al|Generato il/.test(testoDi(ws)));
    verifica(`${tipologia}: le intestazioni sono vestite`, ws.getRow(1).getCell(1).font.bold === true && ws.getRow(1).getCell(1).fill.fgColor.argb === 'FF1A7F8E');
    const note = wb.getWorksheet('Note');
    const testo = note ? testoDi(note) : '';
    verifica(`${tipologia}: il foglio «Note» c'e' e dice canale, periodo, dati fino al e chi l'ha generato`,
      note && /Settembre 2026, per fine trasporto/.test(testo) && /06\/10\/2026|03\/10\/2026|02\/10\/2026/.test(testo) && /da Mario Rossi/.test(testo), testo.slice(0, 300));
  }
  const { wb } = await ultimoFile();
  const ws = wb.worksheets[0];
  const iKg = 4, iPrezzo = 5;
  verifica('extra raccolta: i chili interi, il prezzo da due a quattro decimali', ws.getRow(2).getCell(iKg + 1).numFmt === '#,##0' && ws.getRow(2).getCell(iPrezzo + 1).numFmt === '#,##0.00##', `${ws.getRow(2).getCell(iKg + 1).numFmt} / ${ws.getRow(2).getCell(iPrezzo + 1).numFmt}`);
  // La riga a viaggio della rete: il prezzo a tonnellata non c'e', e resta vuoto.
  await fatt.exportFatturazioneAttiva('RETE', ATTIVA.RETE, 2026, 'Settembre', { stato: statoPer('PrimariaRete') });
  const rete = (await ultimoFile()).wb.worksheets[0];
  const et4 = righeDi(rete).find(r => r[2] === 'ET4') || [];
  verifica('una riga senza prezzo a tonnellata resta vuota, non 0', et4.length && norma(et4[7]) === null && et4[8] === 300, JSON.stringify(et4));
});

/** Le prime righe di un foglio: il blocco di testa del documento. */
const testaDi = (ws, n = 6) => righeDi(ws).slice(0, n).flat().filter(v => typeof v === 'string').join('\n');
const haLaTesta = (ws, { titolo, canale, periodo, dati }) => {
  const t = testaDi(ws, 8);
  const mancano = [titolo && !t.includes(titolo) && 'titolo', canale && !t.includes(`Canale: ${canale}`) && 'canale', periodo && !t.includes(`Periodo: ${periodo}, per fine trasporto`) && 'periodo',
    dati && !t.includes(dati) && 'dati fino al', !/Generato il \d\d\/\d\d\/\d{4} alle \d\d:\d\d da Mario Rossi/.test(t) && 'generato'].filter(Boolean);
  return mancano.length ? `manca: ${mancano.join(', ')} — ${t.replace(/\n/g, ' | ')}` : '';
};
const vestito = (ws) => ws.getRow(1).getCell(1).fill && ws.getRow(1).getCell(1).fill.fgColor.argb === 'FF0F4C5C' && /Pagina &P di &N/.test(ws.headerFooter.oddFooter || '');

await sezione('5. LA PASSIVA PER CANALE', async () => {
  const result = calcolaPassivaMese(DATI_PASSIVA, 2026, indiceMesePassiva('Giugno'), 'Giugno', 'RETE');
  await passiva.exportFatturazionePassiva(result, { stato: statoPer('PrimariaRete', 'Secondaria') });
  const { nome, wb } = await ultimoFile();
  const ws = wb.worksheets[0];
  verifica('il nome del file e del foglio', nome === 'Fatturazione_passiva_RETE_Giugno_2026.xlsx' && ws.name === 'RETE', `${nome} / ${ws.name}`);
  const manca = haLaTesta(ws, { titolo: 'Fatturazione passiva Rete — Giugno 2026', canale: 'Rete', periodo: 'Giugno 2026', dati: 'secondarie 05/10/2026' });
  verifica('il blocco di testa c\'e\'', !manca, manca);
  verifica('vestito: fascia scura e pagine nel piede', vestito(ws));
  // Le righe di prima, cella per cella, sotto il blocco di testa.
  const attese = passiva.righePassiva(result);
  const lette = righeDi(ws);
  const da = lette.findIndex(r => r[0] === 'RETE' && r[1] === 'Giugno 2026');
  const diversa = attese.map((r, i) => stesseRighe(lette[da + i] || [], r) && `riga ${i + 1}: ${stesseRighe(lette[da + i] || [], r)}`).find(Boolean);
  verifica('le righe del conto sono quelle di prima', da > 0 && !diversa, diversa || String(da));
  verifica('il totale del canale e\' quello a video: 1.750', lette[da][6] === 1750 && result.totali.totale_complessivo === 1750, String(lette[da][6]));
  const alfa = rigaCheInizia(ws, 'ALFA SRL');
  verifica('le tonnellate con due decimali e il terzo se serve', alfa && alfa.getCell(2).value === 12.5 && alfa.getCell(2).numFmt === '#,##0.00#', alfa ? alfa.getCell(2).numFmt : 'manca');
  verifica('la riga del fornitore e\' in grassetto', alfa && alfa.getCell(1).font.bold === true);
});

await sezione('6. IL REPORT DEI CONFERIMENTI', async () => {
  const lib = await caricaLibPagine('lib/reportConferimentiExport');
  const mov = (id, kg, giorno, stoccaggio = 'NAPPI SUD SRL') => ({ id, id_ordine: 'S' + id, numero_fir: 'F' + id, stato: 'terminato', peso_effettivo: kg, trasporto_finito_il: giorno, ordine_immesso_il: giorno, trasporto_iniziato_il: giorno, stoccaggio, destinazione: 'IRIGOM SRL', trasportatore: 'GAMMA SRL', classe: 'A', cer: '160103', tipo_destinazione: 'imp' });
  const report = reportConferimenti([mov('1', 12000, '2026-09-03T08:00:00Z'), mov('2', 8000, '2026-09-17T08:00:00Z'), mov('3', 9000, '2026-10-01T08:00:00Z')], { anno: 2026, mese: 9, canale: 'RETE', archivio: 'Secondaria', tipo: 'secondaria' });
  await lib.scaricaExcelConferimenti(report, null, 'Conferimenti', { stato: statoPer('Secondaria') });
  const { nome, wb } = await ultimoFile();
  const ws = wb.getWorksheet('Per settimana');
  verifica('il nome del file e i fogli', nome === 'Conferimenti Rete Settembre 2026.xlsx' && ws && wb.getWorksheet('Per destinazione'), nome);
  const manca = haLaTesta(ws, { canale: 'Rete', periodo: 'Settembre 2026', dati: 'Dati fino al 05/10/2026' });
  verifica('il blocco di testa c\'e\'', !manca, manca);
  verifica('vestito', vestito(ws));
  const tot = rigaCheInizia(ws, 'TOTALE');
  const ultima = tot ? tot.cellCount : 0;
  verifica('il totale del mese e\' quello a video: 20.000 kg, il carico di ottobre fuori', tot && report.totale_kg === 20000 && tot.getCell(ultima - 1).value === 20000, tot ? JSON.stringify(tot.values) : 'manca');
  verifica('i chili col punto delle migliaia, i formulari interi', tot && tot.getCell(ultima - 1).numFmt === '#,##0' && tot.getCell(ultima).numFmt === '#,##0');
});

await sezione('7. IL CONFRONTO COL CONSUNTIVO DI UN FORNITORE', async () => {
  const lib = await caricaLibPagine('lib/consuntivoFornitoreFile', [["import { leggiFogliLista } from '@/lib/evasioneAssegnati';", 'const leggiFogliLista = null;']]);
  const consuntivo = { fornitore: 'ALFA SRL', ruolo: 'raccoglitore', mese: 9, anno: 2026, canale: 'RETE', file_nome: 'alfa.xlsx' };
  const confronto = { uguali: 3, peso_diverso: 1, solo_consuntivo: 0, kg_solo_consuntivo: 0, solo_gestionale: 1, kg_solo_gestionale: 2000, senza_chiave: 0, senza_chiave_kg: 0,
    totale_consuntivo_kg: 41250, totale_gestionale_kg: 43000, scarto_totale_kg: -1750,
    voci: [{ chiave: 'FIR:ABC1', esito: 'uguale', kg_consuntivo: 10000, kg_gestionale: 10000, scarto_kg: 0, id_ordine: 'ET1' }] };
  await lib.scaricaExcelConsuntivo(consuntivo, { confronto, costo: { trovato: true, importo: 2475 }, esito: { importo_consuntivo: 2500, scarto_importo: 25, scarto_passiva_kg: 0 }, congelato: null, testo: 'Da verificare' }, { stato: statoPer('PrimariaRete') });
  const { nome, wb } = await ultimoFile();
  const ws = wb.getWorksheet('Riepilogo');
  verifica('il nome del file', nome === 'Consuntivo ALFA SRL Rete Settembre 2026.xlsx', nome);
  const manca = haLaTesta(ws, { canale: 'Rete', periodo: 'Settembre 2026', dati: 'Dati fino al 06/10/2026' });
  verifica('il blocco di testa c\'e\', con le sole primarie per chi raccoglie', !manca && !/secondarie/.test(testaDi(ws, 8)), manca);
  const chili = rigaCheInizia(ws, 'Chili del consuntivo');
  verifica('i chili del consuntivo sono quelli a video, interi', chili && chili.getCell(2).value === 41250 && chili.getCell(2).numFmt === '#,##0', chili ? `${chili.getCell(2).value} ${chili.getCell(2).numFmt}` : 'manca');
  const importo = rigaCheInizia(ws, 'Importo scritto sul consuntivo');
  verifica('l\'importo in euro', importo && importo.getCell(2).value === 2500 && /€/.test(importo.getCell(2).numFmt), importo ? importo.getCell(2).numFmt : 'manca');
  verifica('il foglio riga per riga c\'e\'', !!wb.getWorksheet('Riga per riga') && cellaDi(wb.getWorksheet('Riga per riga'), 'ABC1'));
});

const DATE_FINTE = ["import { INTESTAZIONE_DATE, righeExcelDate } from '@/components/giacenze/DateDaSistemare';", "const INTESTAZIONE_DATE = ['Data']; const righeExcelDate = () => [];"];

await sezione('8. LE GIACENZE', async () => {
  const lib = await caricaLibPagine('lib/giacenzeExportAll', [DATE_FINTE, ["import { testoFormulario, testoCollocato } from '@/lib/giacenzeDaDichiarareExport';", "const testoFormulario = () => ''; const testoCollocato = () => '';"]]);
  const riga = (sito, tipo, extra) => ({ sito, tipo_destinazione: tipo, giacenza_classi_kg: null, in_attesa_dichiarazione_t: 0, dichiarato_t: 0, target_primarie_t: 0, conferito_primarie_t: 0, conferito_t: 0, ...extra });
  const data = {
    righe: [
      riga('IRIGOM SRL', 'imp', { giacenza_rete_t: 120.345, giacenza_aci_t: null, giacenza_extra_t: 2.5, fotografia: { del: '2026-10-09' }, dichiarato_t: 300 }),
      riga('NAPPI SUD SRL', 'stoc', { giacenza_rete_t: 44, giacenza_aci_t: 3.2, giacenza_extra_t: null }),
    ],
    totali: { giacenza_portale_t: 164.345, giacenza_aci_t: 3.2, giacenza_extra_t: 2.5, in_attesa_dichiarazione_t: 0, ordini_da_dichiarare: 0, dichiarato_t: 300, target_primarie_t: 0, target_totale_t: 0, conferito_primarie_t: 0, conferito_t: 0 },
    anomalie: [],
  };
  await lib.exportGiacenzeAllExcel(data, { righe: [{ ordine_primaria: 'ET1', fine_trasporto: '2026-09-30', peso_non_dichiarato_kg: 8000 }], totale_kg: 8000 }, 2026, { stato: statoPer(...ARCHIVI.map(a => a.entita)) });
  const { nome, wb } = await ultimoFile();
  const ws = wb.getWorksheet('Situazione');
  verifica('il nome del file e i fogli', nome === 'giacenze_2026.xlsx' && ['Situazione', 'Da dichiarare', 'Derivati', 'Target'].every(n => wb.getWorksheet(n)), nome);
  const manca = haLaTesta(ws, { titolo: 'Giacenze 2026', periodo: 'Anno 2026', dati: 'ordini non dichiarati (fotografia del portale) 09/10/2026' });
  verifica('il blocco di testa c\'e\', con tutti gli archivi che le giacenze leggono', !manca, manca);
  verifica('e dice che i canali stanno in colonne separate', /mai sommate/.test(testaDi(ws, 8)));
  const irigom = rigaCheInizia(ws, 'IRIGOM SRL');
  verifica('la giacenza di rete coi tre decimali: 120,345', irigom && irigom.getCell(3).value === 120.345 && irigom.getCell(3).numFmt === '#,##0.00#', irigom ? `${irigom.getCell(3).value} ${irigom.getCell(3).numFmt}` : 'manca');
  verifica('l\'ACI di un impianto non calcolata resta vuota, non 0', irigom && norma(irigom.getCell(4).value) === null, irigom ? String(irigom.getCell(4).value) : 'manca');
  const tot = rigaCheInizia(ws, 'TOTALE');
  verifica('i totali per canale sono quelli a video', tot && tot.getCell(3).value === 164.345 && tot.getCell(4).value === 3.2 && tot.getCell(5).value === 2.5, tot ? JSON.stringify(tot.values) : 'manca');
  const dd = rigaCheInizia(wb.getWorksheet('Da dichiarare'), 'TOTALE');
  verifica('il totale da dichiarare e\' quello a video: 8.000 kg', dd && dd.getCell(9).value === 8000 && dd.getCell(9).numFmt === '#,##0', dd ? JSON.stringify(dd.values) : 'manca');
});

await sezione('9. LE DICHIARAZIONI DEGLI IMPIANTI', async () => {
  const lib = await caricaLibPagine('lib/dichiarazioniExport', [DATE_FINTE]);
  const PERCHE = 'Questo piazzale non ha nessuna rilevazione del portale.';
  const mesi = Array.from({ length: 12 }, (_, i) => ({ mese: i, conferito_kg: i === 8 ? 12345 : 0, uscito_kg: 0, resta_kg: i === 8 ? 12345 : 0, caricato_kg: 0 }));
  await lib.esportaDichiarazioni({
    anno: 2026,
    siti: [{ sito: 'IRIGOM SRL', tipo_destinazione: 'imp', operazione: 'R3', flussi: [{ canale: 'RETE', mesi, dichiarato_caricato_t: 0, uscito_t: 0, conferito_t: 12.345, resta_t: 12.345 }] }],
    stoccaggi: [
      { sito: 'GAMMA SRL', anche_impianto: false, canali: [{ canale: 'RETE', entrato_t: 3, uscito_t: 0, saldo_t: 3, verso: [], in_piazzale_t: null, in_piazzale_perche: PERCHE }] },
      { sito: 'NAPPI SUD SRL', anche_impianto: false, canali: [{ canale: 'RETE', entrato_t: 5, uscito_t: 1, saldo_t: 4, verso: [], in_piazzale_t: 44 }] },
    ],
  }, { stato: statoPer(...ARCHIVI.map(a => a.entita)) });
  const { nome, wb } = await ultimoFile();
  verifica('il nome del file', nome === 'Dichiarazioni impianti 2026.xlsx', nome);
  const ws = wb.getWorksheet('Stoccaggi');
  const manca = haLaTesta(ws, { titolo: 'Dichiarazioni impianti 2026', dati: 'report delle dichiarazioni di trattamento 08/10/2026' });
  verifica('il blocco di testa c\'e\'', !manca, manca);
  // Due orologi: il conferito per fine trasporto, il dichiarato nel mese del
  // caricamento a portale. «Anno 2026, per fine trasporto» direbbe il falso del secondo.
  const testa = testaDi(ws, 8);
  verifica('la testa dice tutti e due gli orologi, non solo la fine trasporto',
    testa.includes('Periodo: Anno 2026') && !testa.includes('Anno 2026, per fine trasporto') && testa.includes('conferito per fine trasporto, dichiarato nel mese del caricamento a portale'), testa.replace(/\n/g, ' | '));
  // Lo stesso controllo di prove/pagineDichiarazioniGiacenze.mjs, sul file vestito.
  const testata = cellaDi(ws, 'Perché manca la giacenza in piazzale');
  const colonna = testata ? Number(testata.col) : 0;
  const gamma = rigaCheInizia(ws, 'GAMMA SRL');
  const nappi = rigaCheInizia(ws, 'NAPPI SUD SRL');
  verifica('il foglio degli stoccaggi ha la colonna del perche\'', colonna > 1);
  verifica('il piazzale senza letture: cella vuota, e accanto il perche\'', gamma && norma(gamma.getCell(colonna - 1).value) === null && gamma.getCell(colonna).value === PERCHE, gamma ? JSON.stringify(gamma.values) : 'manca');
  verifica('il piazzale con la giacenza: il numero, e nessun perche\'', nappi && nappi.getCell(colonna - 1).value === 44 && !norma(nappi.getCell(colonna).value), nappi ? JSON.stringify(nappi.values) : 'manca');
  const riep = wb.getWorksheet('Riepilogo');
  const conferito = righeDi(riep).find(r => r[3] === 'Conferito nel mese') || [];
  verifica('il riepilogo: settembre 12.345 kg interi, il totale 12,345 t', conferito[13] === 12345 && conferito[17] === 12.345, JSON.stringify(conferito));
  const r = rigaCheInizia(riep, 'IRIGOM SRL');
  verifica('i mesi in chili interi', r && riep.getRow(r.number + 2).getCell(14).numFmt === '#,##0', r ? riep.getRow(r.number + 2).getCell(14).numFmt : 'manca');
});

await sezione('10. L\'ANDAMENTO DEI RACCOGLITORI', async () => {
  const lib = await caricaLibPagine('lib/andamentoRaccoglitoriExport');
  const mesiKg = Array.from({ length: 12 }, (_, i) => ({ kg: i === 8 ? 15400 : 0 }));
  await lib.scaricaExcelAndamento({
    anno: 2026, totali_mese: mesiKg.map(m => m.kg), totale_kg: 15400,
    righe: [{ nome: 'ALFA SRL', mesi: mesiKg, kg: 15400, target_anno_kg: null, scarto_anno_kg: null, province: [{ provincia: 'BA' }], zona_dichiarata: false, zona_province: [], fuori_zona: [] }],
  }, [], { stato: statoPer('PrimariaRete') });
  const { nome, wb } = await ultimoFile();
  const ws = wb.getWorksheet('Per raccoglitore');
  verifica('il nome del file', nome === 'Andamento raccolta rete 2026.xlsx', nome);
  const manca = haLaTesta(ws, { canale: 'Rete', periodo: 'Anno 2026', dati: 'Dati fino al 06/10/2026' });
  verifica('il blocco di testa c\'e\'', !manca, manca);
  const alfa = rigaCheInizia(ws, 'ALFA SRL');
  verifica('senza target lo scarto resta vuoto, non 0', alfa && norma(alfa.getCell(15).value) === null && norma(alfa.getCell(16).value) === null, alfa ? JSON.stringify(alfa.values) : 'manca');
  verifica('i mesi in chili col punto delle migliaia', alfa && alfa.getCell(10).value === 15400 && alfa.getCell(10).numFmt === '#,##0', alfa ? alfa.getCell(10).numFmt : 'manca');
  const tot = rigaCheInizia(ws, 'TOTALE');
  verifica('il totale dell\'anno e\' quello a video', tot && tot.getCell(14).value === 15400, tot ? JSON.stringify(tot.values) : 'manca');
});

await sezione('11. L\'EXTRA RACCOLTA', async () => {
  const base2 = { stato: 'terminato', tipo_movimento: 'primaria', cer: '160103', classe: 'P', produttore: 'COMUNE DI ESEMPIO', trasportatore: 'LOGISTICA', destinazione: 'Irigom S.r.l.', ordine_immesso_il: '2026-09-01T00:00:00.000Z', trasporto_iniziato_il: '2026-09-10T00:00:00.000Z' };
  const interventi = [
    { ...base2, id: 'A', id_ordine: 'ER-A', numero_fir: 'FIR-A', peso_effettivo: 2000, prezzo_attivo_t: 202, sovracosto_raccolta: 50, trasporto_finito_il: '2026-09-30T23:30:00.000Z' },
  ];
  // isAdmin: l'analisi per produttore, coi costi e il margine, il file la porta
  // solo all'amministratore (il surplus sulle tariffe, 13/10/2026); qui si
  // guardano anche i suoi formati.
  await extra.exportExtraRaccoltaExcel(interventi, 'Settembre', 2026, undefined, { stato: statoPer('ExtraRaccolta'), isAdmin: true });
  const { nome, wb } = await ultimoFile();
  const ws = wb.worksheets[0];
  verifica('il nome del file e del foglio', nome === 'SMOCO-Fatturazione EXTRA RACCOLTA Settembre 2026.xlsx' && ws.name === 'SETTEMBRE 2026', `${nome} / ${ws.name}`);
  const manca = haLaTesta(ws, { canale: 'Extra raccolta', periodo: 'Settembre 2026', dati: 'Dati fino al 02/10/2026' });
  verifica('il blocco di testa c\'e\'', !manca, manca);
  const a = rigaCheInizia(ws, 'FIR-A');
  verifica('la fine trasporto e\' il giorno italiano: le 23:30 UTC del 30/09 sono il 1° ottobre', a && a.getCell(6).value instanceof Date && a.getCell(6).value.toISOString().slice(0, 10) === '2026-10-01' && a.getCell(6).numFmt === 'dd/mm/yyyy',
    a ? String(a.getCell(6).value && a.getCell(6).value.toISOString && a.getCell(6).value.toISOString()) : 'manca');
  verifica('il prezzo non prende il formato delle tonnellate', a && a.getCell(10).numFmt === '#,##0.00##', a ? a.getCell(10).numFmt : 'manca');
  const tot = rigaCheInizia(ws, 'TOTALE');
  verifica('nell\'analisi gli euro restano euro (prima il sovracosto impianto usciva coi chili)', tot && /€/.test(tot.getCell(9).numFmt), tot ? tot.getCell(9).numFmt : 'manca');
  const imponibile = rigaCheInizia(ws, 'Totale imponibile');
  verifica('il totale imponibile e\' quello della pagina: 454,00', imponibile && imponibile.getCell(2).value === 454, imponibile ? String(imponibile.getCell(2).value) : 'manca');
  // LE DECISIONI DEL 13/10/2026 SERA, coi loro formati: il TOTALE QUANTITA'
  // sono i chili fatturati e le secondarie stanno a parte, in kg; il Fuel
  // Surcharge ha il blocco ai raccoglitori (tonnellate e euro) e il conto del
  // mese (euro), mai una riga fra i produttori.
  const { contestoPrezzi } = await import('../src/lib/extraRaccoltaCalc.js');
  const fs = { id: 'fs', nome: 'Fuel Surcharge', origine: 'CONSORZIO', tipologia: 'EXTRA_RACCOLTA', prestazione: 'RACCOLTA', a_chi: 'tutti', euro_t_passiva: 5, euro_t_attiva: 5, data_inizio_validita: '2026-10-01', data_fine_validita: '2026-12-31', stato: 'attivo' };
  const ottobre = [
    { ...base2, id: 'B', id_ordine: 'ER-B', numero_fir: 'FIR-B', peso_effettivo: 1234, prezzo_attivo_t: 202, costo_raccolta_t: 72, trasporto_finito_il: '2026-10-05T08:00:00.000Z' },
    { ...base2, id: 'S', id_ordine: 'ER-S', numero_fir: 'FIR-S', tipo_movimento: 'secondaria', stoccaggio: 'NAPPI SUD SRL', produttore: 'NAPPI SUD SRL', peso_effettivo: 3000, prezzo_attivo_t: 0, costo_trasporto_viaggio: 200, trasporto_finito_il: '2026-10-06T08:00:00.000Z' },
  ];
  await extra.exportExtraRaccoltaExcel(ottobre, 'Ottobre', 2026, contestoPrezzi([], [{ id: 'F-L', ragione_sociale: 'LOGISTICA', stato: 'attivo' }], [fs]), { stato: statoPer('ExtraRaccolta'), isAdmin: true });
  const ws2 = (await ultimoFile()).wb.worksheets[0];
  const kg = rigaCheInizia(ws2, "TOTALE QUANTITA' (kg)");
  const sec = rigaCheInizia(ws2, 'Trasporti di secondaria (non si fatturano a Ecotyre)');
  verifica('il TOTALE QUANTITA\' sono i chili fatturati, 1.234, in kg; la secondaria a parte, 3.000, in kg', kg && kg.getCell(2).value === 1234 && kg.getCell(2).numFmt === '#,##0'
    && sec && sec.getCell(2).value === 3000 && sec.getCell(2).numFmt === '#,##0', JSON.stringify([kg && kg.values, sec && sec.values]));
  const titolo = rigaCheInizia(ws2, 'FUEL SURCHARGE AI RACCOGLITORI');
  const log = titolo ? ws2.getRow(titolo.number + 3) : null;
  verifica('il blocco ai raccoglitori: LOGISTICA 1,234 t in tonnellate, 6,17 di costo e di ricavo in euro', log && log.getCell(1).value === 'LOGISTICA' && log.getCell(2).value === 1.234 && log.getCell(2).numFmt === '#,##0.00#'
    && log.getCell(3).value === 6.17 && /€/.test(log.getCell(3).numFmt) && log.getCell(4).value === 6.17 && /€/.test(log.getCell(4).numFmt), log ? JSON.stringify(log.values) : 'manca');
  const costi = rigaCheInizia(ws2, 'Costi');
  verifica('il conto del mese in euro', costi && [2, 3, 4].every(c => /€/.test(costi.getCell(c).numFmt)), costi ? JSON.stringify(costi.values) : 'manca');
  const produttori = [];
  for (let n = 1; n <= ws2.rowCount; n++) if (ws2.getRow(n).getCell(2).value === 'costi aggiuntivi') { for (let m = n + 1; m <= ws2.rowCount && ws2.getRow(m).getCell(1).value !== 'TOTALE'; m++) produttori.push(ws2.getRow(m).getCell(1).value); }
  verifica('fra i produttori nessuna riga del surplus', produttori.length === 2 && !produttori.some(p => /surplus|fuel/i.test(String(p))), JSON.stringify(produttori));
});

await sezione('12. IL REPORT MENSILE ESCE IN EXCEL', async () => {
  const lib = await caricaLibPagine('lib/reportMensileExport');
  let n = 0;
  const riga = (trasportatore, kg, extra2 = {}) => ({
    id_ordine: 'O' + (++n), stato: 'terminato', trasporto_finito_il: '2026-05-10T08:00:00Z',
    trasportatore, destinazione: 'ALFA SRL', tipo_destinazione: 'imp', provincia: 'NA', regione: 'Campania',
    peso_effettivo: kg, prodotto: 'P - fino a 35 kg', classe: 'P', ...extra2,
  });
  const raccolta = calcolaPivot('raccolta', [riga('UNO SRL', 1234500), riga('DUE SRL', 12345, { prodotto: 'M - da 35 a 100 kg', classe: 'M' })], 2026, 'Maggio');
  const viaggi = calcolaPivot('viaggiRete', [riga('UNO SRL', 1000), riga('UNO SRL', 2000)], 2026, 'Maggio');
  await lib.esportaReportMensileExcel({
    pivots: { raccolta, viaggiRete: viaggi },
    gruppo: { chiave: 'rete', titolo: 'Rete', pivot: ['raccoltaAnno', 'raccolta', 'viaggiRete'] },
    anno: 2026, mese: 'Maggio', periodoDi: (p) => (p.periodo === 'mese' ? 'Maggio 2026' : 'Anno 2026'),
  }, { stato: statoPer('PrimariaRete') });
  const { nome, wb } = await ultimoFile();
  verifica('un file Excel, non un CSV', nome === 'report-mensile-rete-2026-maggio.xlsx', nome);
  verifica('un foglio per pivot (quelle caricate)', wb.worksheets.length === 2, wb.worksheets.map(w => w.name).join(', '));
  const ws = wb.getWorksheet(raccolta.titolo);
  const manca = ws ? haLaTesta(ws, { titolo: raccolta.titolo, canale: 'Rete', periodo: 'Maggio 2026', dati: 'Dati fino al 06/10/2026' }) : 'foglio mancante';
  verifica('ogni foglio ha il suo blocco di testa, col suo periodo', !manca, manca);
  const testata = ws && righeDi(ws).find(r => r.includes('P') && r.includes('M'));
  const colP = testata ? testata.indexOf('P') + 1 : 0, colM = testata ? testata.indexOf('M') + 1 : 0;
  const trova = (etichetta) => { for (let r = 1; ws && r <= ws.rowCount; r++) if (String(ws.getRow(r).getCell(1).value).trim() === etichetta) return ws.getRow(r); return null; };
  const uno = trova('UNO SRL'), due = trova('DUE SRL');
  verifica('le colonne ci sono', colP > 1 && colM > 1, JSON.stringify(testata));
  verifica('una cella senza movimenti resta vuota, non 0', uno && due && norma(uno.getCell(colM).value) === null && norma(due.getCell(colP).value) === null, uno && due ? `${uno.getCell(colM).value} / ${due.getCell(colP).value}` : 'righe mancanti');
  verifica('le tonnellate sono numeri, col formato a due decimali e il terzo se serve', uno && uno.getCell(colP).value === 1234.5 && uno.getCell(colP).numFmt === '#,##0.00#', uno ? `${uno.getCell(colP).value} ${uno.getCell(colP).numFmt}` : 'manca');
  verifica('12.345 kg sono 12,345 t, non 12,35', due && due.getCell(colM).value === 12.345, due ? String(due.getCell(colM).value) : 'manca');
  const tot = trova('Totale complessivo');
  const ultima = testata ? testata.length : 0;
  verifica('il totale del file e\' quello della pivot a video', tot && tot.getCell(ultima).value === raccolta.radice.totali.peso && raccolta.radice.totali.peso === 1246.845, tot ? `${tot.getCell(ultima).value} / ${raccolta.radice.totali.peso}` : 'manca');
  const wv = wb.getWorksheet(viaggi.titolo);
  const totV = wv && (() => { for (let r = 1; r <= wv.rowCount; r++) if (wv.getRow(r).getCell(1).value === 'Totale complessivo') return wv.getRow(r); return null; })();
  // viaggi per destinazione: due misure, i viaggi e il peso, una colonna ciascuna
  const cV = totV ? totV.cellCount - 1 : 0;
  verifica('i viaggi sono interi, il peso in tonnellate', totV && totV.getCell(cV).value === 2 && totV.getCell(cV).numFmt === '#,##0' && totV.getCell(cV + 1).value === 3 && totV.getCell(cV + 1).numFmt === '#,##0.00#', totV ? `${totV.getCell(cV).value} ${totV.getCell(cV).numFmt} / ${totV.getCell(cV + 1).value} ${totV.getCell(cV + 1).numFmt}` : 'manca');
});

await sezione('13. SENZA SERVER IL FILE ESCE LO STESSO, E LO DICE', async () => {
  // Nessuno stato gia' letto e nessun server (la funzione non ancora pubblicata,
  // la rete che manca): il file si scarica e la testa dice che il «fino al» non c'e'.
  const lib = await caricaLibPagine('lib/andamentoRaccoglitoriExport');
  const prima = scaricati.length;
  await lib.scaricaExcelAndamento({ anno: 2026, totali_mese: new Array(12).fill(0), totale_kg: 0, righe: [] }, []);
  const { wb } = await ultimoFile();
  verifica('il file c\'e\'', scaricati.length === prima + 1);
  verifica('e dice che il «dati fino al» non e\' disponibile', /Dati fino al: non disponibile/.test(testaDi(wb.worksheets[0], 8)), testaDi(wb.worksheets[0], 8));
});

await sezione('14. LA LETTURA DAL SERVER NON FERMA MAI IL FILE', async () => {
  // Le due domande al server stanno in statoDeiDati.js, che il corredo carica solo
  // quando si esporta: qui si sostituisce con uno finto.
  const fogli = await caricaLibPagine('lib/fogliProfessionali', [[/await import\('@\/lib\/statoDeiDati'\)/g, 'globalThis.__SERVER']]);
  globalThis.__SERVER = { chiediStatoDati: async (entita) => ({ utente: 'Mario Rossi', archivi: ARCHIVI.filter(a => entita.includes(a.entita)), caricamenti_aperti: [] }), chiediUtente: async () => 'Mario Rossi' };
  const letto = await fogli.leggiStatoDati(['Secondaria']);
  verifica('la risposta del server e\' lo stato del documento', letto.letto === true && letto.archivi.length === 1 && letto.archivi[0].dati_fino_al === '2026-10-05', JSON.stringify(letto));
  globalThis.__SERVER = { chiediStatoDati: async () => ({ error: 'qualcosa' }), chiediUtente: async () => 'Mario Rossi' };
  const storto = await fogli.leggiStatoDati(['Secondaria']);
  verifica('una risposta senza archivi non e\' uno stato: «non letto», col nome di chi esporta', storto.letto === false && storto.utente === 'Mario Rossi', JSON.stringify(storto));
  globalThis.__SERVER = { chiediStatoDati: () => new Promise(() => {}), chiediUtente: async () => '' };
  const inizio = Date.now();
  const appeso = await fogli.leggiStatoDati(['Secondaria'], { attesaMs: 50 });
  verifica('un server che non risponde non tiene appesa l\'esportazione', appeso.letto === false && Date.now() - inizio < 2000, `${Date.now() - inizio} ms`);
  // la funzione non ancora pubblicata: il server risponde 404
  globalThis.__SERVER = { chiediStatoDati: async () => { throw new Error('Request failed with status code 404'); }, chiediUtente: async () => 'Mario Rossi' };
  const doc = await fogli.documentoDa({ titolo: 'x', canale: 'RETE', periodo: 'Settembre 2026', entita: ['Secondaria'] });
  verifica('e il documento lo dice', /^Dati fino al: non disponibile/.test(doc.dati), doc.dati);

  const { readFileSync, readdirSync, statSync } = await import('node:fs');
  const { join } = await import('node:path');
  const sorgente = (p) => readFileSync(new URL(p, radice), 'utf8').replace(/\r/g, '');
  verifica('il corredo dei fogli non importa il client: lo carica statoDeiDati.js, pigro',
    !/from '@\/api\/base44Client'/.test(sorgente('src/lib/fogliProfessionali.js')) && /await import\('@\/lib\/statoDeiDati'\)/.test(sorgente('src/lib/fogliProfessionali.js')));
  // Un import in testa di statoDeiDati lo porterebbe nel pacchetto di chi lo
  // importa, e il client con lui: lo si carica solo da fogliProfessionali.js.
  const statici = [];
  const gira = (dir) => { for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) gira(p); else if (/\.(js|jsx)$/.test(n) && /^import .*from '@\/lib\/statoDeiDati'/m.test(readFileSync(p, 'utf8'))) statici.push(p); } };
  gira(fileURLToPath(new URL('src', radice)));
  verifica('nessuno importa statoDeiDati in testa', statici.length === 0, statici.join(', '));
});

await sezione('15. IL PREZZO DA DUE A QUATTRO DECIMALI, NEL PDF COME NELL\'EXCEL', async () => {
  // Revisione delle migliorie (11/10/2026): il PDF dell'extra raccolta dava al
  // prezzo il tipo 'euro', due decimali fissi, e una tariffa al chilo da 0,202
  // usciva «0,20 €» mentre l'Excel diceva 0,202. Il corredo ha il tipo
  // 'prezzoLibero'; 'euro' e 'prezzo' scrivono come prima: gli altri export non
  // cambiano.
  const valori = [0.202, 202.125, 202.0625, 202];
  const attesi = {
    prezzoLibero: { pdf: ['0,202 €', '202,125 €', '202,0625 €', '202,00 €'], excel: '#,##0.00##' },
    euro: { pdf: ['0,20 €', '202,13 €', '202,06 €', '202,00 €'], excel: '#,##0.00' },
    prezzo: { pdf: ['0,2020 €', '202,1250 €', '202,0625 €', '202,0000 €'], excel: '#,##0.0000' },
  };
  const documento = { canale: 'EXTRA_RACCOLTA', periodo: 'Settembre 2026', entita: ['ExtraRaccolta'], stato: statoPer('ExtraRaccolta') };
  const righe = valori.map((v, i) => ({ n: 'R' + i, v }));
  for (const [tipo, a] of Object.entries(attesi)) {
    await tabella.esportaTabellaPdf({ nomeFile: 'prezzi', titolo: 'Prezzi', colonne: [{ titolo: 'Riga', valore: r => r.n, tipo: 'testo' }, { titolo: 'Prezzo', valore: r => r.v, tipo }], righe, documento });
    // € nei font standard e' il byte 0x80
    const scritte = leggiPdf(globalThis.__PDF).map(s => s.replace(/\x80/g, '€'));
    const mancano = a.pdf.filter(t => !scritte.includes(t));
    verifica(`PDF, tipo ${tipo}: ${a.pdf.join(' · ')}`, !mancano.length, `mancano ${mancano.join(', ')}; scritte: ${scritte.filter(s => /€|^\d/.test(s)).join(' | ')}`);
  }
  await tabella.esportaTabellaExcel({ nomeFile: 'prezzi', titolo: 'Prezzi', colonne: Object.keys(attesi).map(tipo => ({ titolo: tipo, valore: r => r.v, tipo })), righe, documento });
  const ws = (await ultimoFile()).wb.worksheets[0];
  for (const [tipo, a] of Object.entries(attesi)) {
    const titolo = cellaDi(ws, tipo);
    const prima = titolo ? ws.getRow(titolo.row + 1).getCell(titolo.col) : null;
    verifica(`Excel, tipo ${tipo}: il numero vero col formato ${a.excel}`, prima && prima.value === 0.202 && prima.numFmt === a.excel, prima ? `${prima.value} / ${prima.numFmt}` : 'colonna mancante');
  }
});

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
