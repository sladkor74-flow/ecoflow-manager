// I RITOCCHI DELLA CHIUSURA DEL GIRO SUL CAMBIO D'ANNO (prova generale del
// 15/10/2026). I sei gruppi di correzione hanno lasciato, fuori dai loro file,
// alcuni punti dove la regola nuova non arrivava ancora a video, nei documenti o
// in una funzione vicina. Ognuno ha qui la sua sezione, che fallisce col codice di
// prima:
//   1. la pagina della qualifica a gennaio conta anche chi ha lavorato
//      nell'ultimo trimestre dell'anno prima, come il controllo delle 7:30, e non
//      riscrive il riepilogo salvato senza gli scaduti (qualificaFornitori); il
//      presidio dei documenti fa lo stesso;
//   2. EcoTyna, a gennaio senza ritiri del 2027, non dice «nessun ritiro RETE
//      terminato»: dice che l'atteso del 2027 non c'e' ancora (assistente.ts);
//   3. PDF, presentazione e file Excel dell'Andamento dicono «copiato, da
//      confermare» come la pagina (statusExports.js, exportStatusExcel);
//   4. il dettaglio dell'attiva dice «da confermare» le righe con la tariffa
//      copiata, e le conta fra le anomalie (AttivaDetail.jsx, decisione
//      dell'utente del 15/10/2026, D4);
//   5. l'anno del prezzo di una voce del foglio dell'amministrazione e' un numero
//      che fa i conti: lo storico delle modifiche lo registra (campiTracciati);
//   6. il PDF del quadro dice perche' il margine e' «—» (esportaQuadro.js);
//   7. fra le richieste ECT completate una dell'anno prima lo dice
//      (RichiesteCompletate.jsx);
//   8. la scheda dell'impianto delle Dichiarazioni senza l'apertura del 31/12
//      dice «—» col perche', non 0,00 (SezioneImpianto.jsx, Riepilogo.jsx), e un
//      sito portato dall'anno prima lo dice nelle Dichiarazioni, nelle Giacenze
//      e in «Da dichiarare» (decisione dell'utente del 15/10/2026, D3);
//   9. Giacenze › Siti non scrive uno zero dove l'apertura non c'era
//      (TargetManager.jsx).
// Altre due prove portano le loro parti: prove/anniDellePagine.mjs (la scheda
// Zone dei raccoglitori) e prove/passivaAmministrazioneRicalcolo.mjs, sezione 7
// (il PDF della passiva per l'amministrazione).
// node prove/cambioAnnoRitocchi.mjs
import { readFileSync, existsSync } from 'node:fs';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { disegnaComponente, testoDi } from './dati/disegnaComponente.mjs';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
const sorgente = (p) => readFileSync(qui('../' + p), 'utf8').replace(/\r/g, '');
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + String(extra).slice(0, 600)); } };
const J = (x) => JSON.stringify(x);
const sezione = async (titolo, corpo) => {
  console.log(titolo);
  try { await corpo(); } catch (e) { ko++; console.log(`  FALLITA: ${titolo}: si ferma con un errore (${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e})`); }
};
// Un modulo delle pagine con i suoi import veri: gli alias @/ si risolvono, il
// client della piattaforma e' finto (non serve: questi moduli non leggono niente).
const ESTENSIONI = ['', '.js', '.jsx', '.ts'];
const daAlias = (p) => { const base = qui('../src/' + p.slice(2)); return ESTENSIONI.map(e => base + e).find(x => existsSync(x) && /\.\w+$/.test(x)) || base; };
const impacchetta = async (percorso, finti = {}) => {
  const pacchetto = await build({
    entryPoints: [qui('../' + percorso)], bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent',
    loader: { '.js': 'jsx', '.jsx': 'jsx' }, jsx: 'automatic', external: ['pptxgenjs', 'jspdf', 'exceljs', 'xlsx'],
    plugins: [{ name: 'alias', setup(b) {
      b.onResolve({ filter: /^@\// }, (a) => (finti[a.path] ? { path: a.path, namespace: 'finto' } : { path: daAlias(a.path) }));
      b.onLoad({ filter: /.*/, namespace: 'finto' }, (a) => ({ contents: finti[a.path], loader: 'js' }));
    } }],
  });
  return import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
};
// L'orologio fermo: new Date() e Date.now() danno l'istante scelto.
const DataVera = Date;
const alle = async (iso, fn) => {
  const ms = DataVera.parse(iso);
  globalThis.Date = class extends DataVera { constructor(...a) { if (a.length) super(...a); else super(ms); } static now() { return ms; } };
  try { return await fn(); } finally { globalThis.Date = DataVera; }
};

await sezione('1. LA QUALIFICA A GENNAIO: LA PAGINA CONTA COME IL CONTROLLO DELLE 7:30', async () => {
  // Il 05/01/2027: C.L. SERVICE ha lavorato a marzo e a novembre 2026, ECO.GEA a
  // dicembre 2026; nel 2027 nessuno ha ancora un viaggio. I contratti 2026 sono
  // scaduti il 31/12. Da gennaio a marzo restano da qualificare (decisione
  // dell'utente del 13/10/2026 sui contratti, ripresa dalla prova generale del
  // 15/10/2026, difetto 25). Il controllo delle 7:30 lo faceva gia'; la funzione
  // della pagina (e della passiva, e del ricalcolo dopo un caricamento) no, e
  // riscriveva il riepilogo del 2027 senza gli scaduti.
  const { caricaFunzione, chiama } = await import('./dati/bancoFunzioni.mjs');
  const controllo = await caricaFunzione('controlloQualifiche');
  const pagina = await caricaFunzione('qualificaFornitori');
  const ritiro = (id, chi, giorno) => ({ id, id_ordine: id, stato: 'terminato', trasportatore: chi, destinazione: 'IRIGOM SRL', tipo_destinazione: 'imp', peso_effettivo: 5000,
    ordine_immesso_il: giorno + 'T07:00:00Z', trasporto_iniziato_il: giorno + 'T08:00:00Z', trasporto_finito_il: giorno + 'T10:00:00Z' });
  const CL = 'C.L. SERVICE S.R.L.', kCL = 'cl service';
  const db = {
    PrimariaRete: [ritiro('ET1', CL, '2026-03-10'), ritiro('ET2', CL, '2026-11-20'), ritiro('ET3', 'ECO.GEA SRL', '2026-12-10')],
    PrimariaAci: [], ExtraRaccolta: [], Secondaria: [], Fornitore: [], QualificaInclusione: [], UploadLog: [], AvvisoQualifica: [], RiepilogoQualifica: [], TargetRaccoglitore: [], TargetMensile: [],
    User: [{ id: 'u1', role: 'admin', email: 'prova@prova' }],
    TipoDocumentoQualifica: [
      { id: 'tq-contr', nome: 'Contratto di raccolta', categoria: 'contratto', si_applica_a: 'raccolta', tipo_scadenza: 'data', obbligatorio: true, preavviso_giorni: 30, attivo: true },
      { id: 'tq-cqc', nome: 'CQC degli autisti', si_applica_a: '', solo_per_soggetti: [{ chiave: kCL, nome: CL }], tipo_scadenza: 'data', obbligatorio: true, preavviso_giorni: 30, attivo: true },
    ],
    DocumentoQualifica: [
      { id: 'dq0', soggetto_chiave: kCL, soggetto_nome: CL, tipo_documento_id: 'tq-contr', stato: 'attivo', analisi_stato: 'completata', verificato_manualmente: true, data_emissione: '2026-01-02', data_scadenza: '2026-12-31', created_date: '2025-12-20T10:00:00' },
      { id: 'dq1', soggetto_chiave: 'ecogea', soggetto_nome: 'ECO.GEA SRL', tipo_documento_id: 'tq-contr', stato: 'attivo', analisi_stato: 'completata', verificato_manualmente: true, data_emissione: '2026-01-02', data_scadenza: '2026-12-31', created_date: '2025-12-20T10:00:00' },
      { id: 'dq-cqc', soggetto_chiave: kCL, soggetto_nome: CL, tipo_documento_id: 'tq-cqc', stato: 'attivo', analisi_stato: 'completata', verificato_manualmente: true, data_emissione: '2024-03-01', data_scadenza: '2029-03-01', created_date: '2024-03-02T10:00:00' },
    ],
  };
  const riepilogo = (archivio) => { const r = (archivio.RiepilogoQualifica || []).find(x => Number(x.anno) === 2027) || {}; return J([r.scaduti, r.anomalie_catalogo, (r.soggetti_critici || []).map(s => s.chiave)]); };
  const c = await alle('2027-01-05T06:30:00Z', () => chiama(controllo, { db, corpo: { invia_email: false } }));
  verifica('premessa: alle 7:30 il controllo vede i tre soggetti dell\'ultimo trimestre e i due contratti scaduti', c.stato === 200 && c.j.riepilogo && c.j.riepilogo.soggetti === 3 && c.j.riepilogo.scaduti === 2, J([c.stato, c.j.riepilogo || c.j]));
  const dopoControllo = riepilogo(c.db);
  const p = await alle('2027-01-05T08:00:00Z', () => chiama(pagina, { db: c.db, corpo: { anno: 2027 } }));
  verifica('alle 9 la pagina vede gli stessi soggetti, senza «errore del catalogo» sulla CQC', p.stato === 200 && (p.j.soggetti || []).length === 3 && !(p.j.anomalie || []).some(a => a.gravita === 'errore') && p.j.riepilogo && p.j.riepilogo.scaduti === 2,
    J([p.stato, (p.j.soggetti || []).length, p.j.anomalie, p.j.riepilogo]));
  verifica('e il riepilogo del 2027 salvato resta quello delle 7:30, con gli scaduti', riepilogo(p.db) === dopoControllo, `${riepilogo(p.db)} contro ${dopoControllo}`);
  const aprile = await alle('2027-04-01T08:00:00Z', () => chiama(pagina, { db: c.db, corpo: { anno: 2027 } }));
  verifica('controprova: dal 01/04/2027 la pagina conta solo i soggetti dell\'anno (nessuno), e la CQC torna anomalia', (aprile.j.soggetti || []).length === 0 && (aprile.j.anomalie || []).some(x => x.gravita === 'errore'), J([(aprile.j.soggetti || []).length, aprile.j.anomalie]));
  // Il presidio dei documenti prende i soggetti per il controllo dell'intestatario:
  // anche lui con oggi, cosi' a gennaio ha il contesto dei fornitori del 2026.
  verifica('il presidio della qualifica chiede i soggetti con oggi', /individuaSoggetti\(base44, anno, \{ oggi: oggiRoma\(\) \}\)/.test(sorgente('base44/functions/presidioQualifica/entry.ts')));
});

await sezione('2. ECOTYNA A GENNAIO: L\'ATTESO DEL 2027 NON C\'E\' ANCORA, NON E\' ZERO', async () => {
  // Il contesto generale di EcoTyna il 05/01/2027 sul 2027, con l'ultimo ritiro
  // RETE terminato il 22/12/2026. Prima diceva «nessun ritiro RETE terminato
  // con la fine trasporto», che e' falso: ce ne sono, del 2026.
  const { situazioneGestionale } = await import('../base44/shared/assistente.ts');
  const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => {
    const x = r[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if ('$in' in v && !v.$in.includes(x)) return false;
      if ('$gte' in v && !(x != null && String(x) >= String(v.$gte))) return false;
      if ('$lte' in v && !(x != null && String(x) <= String(v.$lte))) return false;
      return true;
    }
    if (v === null) return x === null || x === undefined || x === '';
    return x === v;
  });
  const ordina = (righe, sort) => { const campo = String(sort || 'id').replace(/^[-+]/, ''); const giu = String(sort || '').startsWith('-');
    return [...righe].sort((a, b) => { const x = a[campo], y = b[campo]; if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; const c = String(x).localeCompare(String(y)); return giu ? -c : c; }); };
  const DATI = {};
  const entita = (nome) => ({ list: async (sort, lim = 1e9, salta = 0) => ordina(DATI[nome] || [], sort).slice(salta, salta + lim),
    filter: async (f, sort, lim = 1e9, salta = 0) => ordina((DATI[nome] || []).filter(r => soddisfa(r, f)), sort).slice(salta, salta + lim), get: async () => null });
  const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
  const sdk = { auth: { me: async () => ({ role: 'admin', email: 'prova' }) }, asServiceRole: { entities }, entities, functions: { invoke: async (n) => { throw new Error('non nel banco: ' + n); } } };
  let n = 0;
  const ritiro = (prov, kg, giorno) => ({ id: 'p' + (++n), id_ordine: 'ET' + n, numero_fir: 'F' + n, stato: 'terminato', classe: 'P', provincia: prov, regione: '', trasportatore: 'ALFA SRL', destinazione: 'IRIGOM SRL', tipo_destinazione: 'imp', partner_operativo: 'SMOCO Srl',
    peso_effettivo: kg, ordine_immesso_il: giorno + 'T07:00:00Z', trasporto_iniziato_il: giorno + 'T08:00:00Z', trasporto_finito_il: giorno + 'T10:00:00Z' });
  Object.assign(DATI, {
    PrimariaRete: [ritiro('NA', 300000, '2026-10-15'), ritiro('BA', 21000, '2026-12-22')],
    CommessaEcotyre: [{ id: 'c27', anno: 2027, target_annuo_t: 11600, regioni_json: J([{ regione: 'Campania', target_t: 5000 }, { regione: 'Puglia', target_t: 6600 }]), updated_date: '2026-12-28T10:00:00' }],
    TargetRaccoglitore: [], TargetMensile: [],
  });
  const testo = await alle('2027-01-05T10:00:00Z', () => situazioneGestionale(sdk, '2027-01-05'));
  const t = Array.isArray(testo) ? testo.join('\n') : String(testo);
  verifica('dice che nessun ritiro del 2027 e\' ancora terminato, con l\'ultimo del 2026', /nessun ritiro RETE del 2027 e' ancora terminato \(l'ultimo e' del 22\/12\/2026\): l'atteso del 2027 non c'e' ancora, non e' zero/.test(t), t.split('\n').filter(r => /quota/.test(r)).join(' | '));
  verifica('e non dice piu\' «nessun ritiro RETE terminato con la fine trasporto»', !/nessun ritiro RETE terminato con la fine trasporto/.test(t));
});

await sezione('3. PDF, PRESENTAZIONE ED EXCEL DELL\'ANDAMENTO: I TARGET COPIATI SI DICONO', async () => {
  const { righeAndamento } = await import('../base44/shared/andamentoTarget.ts');
  const SE = await impacchetta('src/lib/statusExports.js', {
    '@/api/base44Client': 'export const base44 = {};',
    '@/lib/esportaTabella': 'export async function esportaSezioniPdf(x) { globalThis.__PDF_ANDAMENTO = x; }',
  });
  const copiato = J([{ il: '2026-12-28T10:00:00Z', nota: 'copiato dal 2026, da confermare' }]);
  const annui = [{ raccoglitore: 'ECOLOGICAL SYSTEMS SRL', regione: 'Basilicata', anno: 2027, target_tonnellate: 300, storico_json: copiato }];
  const mensili = [{ raccoglitore: 'ECOLOGICAL SYSTEMS SRL', regione: 'Basilicata', anno: 2027, mese: 'Gennaio', target: 25, storico_json: copiato }];
  const righe = righeAndamento({ mensili, annui, raccolto: [] });
  await SE.exportPDF([], righe, [], [], 2027);
  const pdf = globalThis.__PDF_ANDAMENTO;
  const riga = pdf && pdf.sezioni[0].righe[0];
  verifica('la riga del raccoglitore dice «copiato, da confermare»', !!riga && /ECOLOGICAL SYSTEMS SRL \(.*copiat.*da confermare\)/.test(riga.celle[1]), J(riga));
  verifica('e la prima nota lo dice con le parole della pagina', !!pdf && /copiat/.test(pdf.note[0] || '') && /2026/.test(pdf.note[0] || ''), J(pdf && pdf.note));
  delete globalThis.__PDF_ANDAMENTO;
  const scritti = righeAndamento({ mensili: mensili.map(m => ({ ...m, storico_json: '' })), annui: annui.map(a => ({ ...a, storico_json: '' })), raccolto: [] });
  await SE.exportPDF([], scritti, [], [], 2027);
  verifica('controprova: coi target scritti a mano nessuna nota e nessun segno', !/copiat|da confermare/.test(J(globalThis.__PDF_ANDAMENTO)), J(globalThis.__PDF_ANDAMENTO && globalThis.__PDF_ANDAMENTO.note));
  delete globalThis.__PDF_ANDAMENTO;
  // La presentazione si fa con pptxgenjs, che qui non si carica: le stesse due
  // funzioni, sulla riga e sopra la tabella.
  const se = sorgente('src/lib/statusExports.js');
  verifica('la presentazione: il segno sulla riga e la frase sopra la tabella', /const segno = segnoTargetCopiati\(r\);/.test(se) && /const fraseCopiati = notaCopiati\(mergedData, copiati, anno\);/.test(se));
  // Il file Excel dell'Andamento: la funzione intera, con un archivio e un XLSX finti.
  const ARCHIVI = { PrimariaRete: [], PrimariaAci: [], TargetRaccoglitore: annui, TargetMensile: mensili };
  globalThis.__ARCHIVI_ANDAMENTO_COPIATI = ARCHIVI;
  const SDK = `const entita = (nome) => ({ list: async (_o, l = 1e9, s = 0) => (globalThis.__ARCHIVI_ANDAMENTO_COPIATI[nome] || []).slice(s, s + l),
    filter: async (f, _o, l = 1e9, s = 0) => (globalThis.__ARCHIVI_ANDAMENTO_COPIATI[nome] || []).filter(r => Object.entries(f || {}).every(([k, v]) => r[k] === v)).slice(s, s + l) });
  const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
  export function createClientFromRequest() { return { auth: { me: async () => ({ role: 'user' }) }, asServiceRole: { entities }, entities }; }`;
  const XLSX = `export const utils = { book_new: () => ({ fogli: [] }), aoa_to_sheet: (righe) => ({ righe }), book_append_sheet: (wb, ws, nome) => { wb.fogli.push({ nome, righe: ws.righe }); } };
  export function write(wb) { return Buffer.from(JSON.stringify(wb)).toString('base64'); }`;
  const pacchetto = await build({ entryPoints: [qui('../base44/functions/exportStatusExcel/entry.ts')], bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
    plugins: [{ name: 'finti', setup(b) {
      b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'finto' }));
      b.onResolve({ filter: /^npm:xlsx/ }, () => ({ path: 'xlsx', namespace: 'finto' }));
      b.onLoad({ filter: /.*/, namespace: 'finto' }, (a) => ({ contents: a.path === 'sdk' ? SDK : XLSX, loader: 'js' }));
    } }] });
  const excel = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
  const risposta = await alle('2027-01-15T09:00:00Z', async () => (await excel.default({ json: async () => ({ anno: 2027 }) })).json());
  const libro = JSON.parse(Buffer.from(risposta.file_base64 || 'e30=', 'base64').toString());
  const racc = ((libro.fogli || []).find(f => f.nome === 'Raccoglitori') || { righe: [] }).righe;
  const ultima = racc[0] ? racc[0].length - 1 : -1;
  verifica('il file Excel: l\'ultima colonna dice «copiato, da confermare», le prime restano quelle di sempre', ultima > 0 && racc[0][ultima] === 'Target da confermare' && racc[0][1] === 'Raccoglitore' && racc[0][4] === "Residuo dell'anno (t)"
    && racc[1] && racc[1][ultima] === 'copiato, da confermare' && racc[1][2] === 300, J(racc.slice(0, 2)));
  delete globalThis.__ARCHIVI_ANDAMENTO_COPIATI;
});

await sezione('4. IL DETTAGLIO DELL\'ATTIVA: LE RIGHE CON LA TARIFFA COPIATA SONO «DA CONFERMARE»', async () => {
  const nota = 'prezzo copiato dal 2026 con «Prepara le tariffe», da confermare in Target & Status › Nuovo anno';
  const copiata = { id: 'r1', ordine: 'ET27000001', numero_fir: 'FIR1', data_fine_trasporto: '2027-01-08', regione: 'Campania', classe: 'P', quantita: 6000, tariffa_valore: 202, totale: 1212, stato_validazione: 'da_controllare', note: nota };
  const buona = { id: 'r2', ordine: 'ET27000002', numero_fir: 'FIR2', data_fine_trasporto: '2027-01-09', regione: 'Campania', classe: 'P', quantita: 1000, tariffa_valore: 205, totale: 205, stato_validazione: 'verificato' };
  const tabella = await disegnaComponente('src/components/fatturazione/AttivaDetail.jsx', 'TabellaRighe');
  const t = testoDi(tabella({ righe: [copiata, buona] }));
  verifica('la riga copiata si legge «da confermare», quella verificata «ok»', /da confermare/.test(t) && /\bok\b/.test(t), t.slice(0, 400));
  const html = tabella({ righe: [copiata] });
  verifica('il segno «da confermare» porta la nota della copia al passaggio del mouse', html.includes('title="prezzo copiato dal 2026') && !/>ok</.test(html), html.slice(0, 300));
  const pagina = await disegnaComponente('src/components/fatturazione/AttivaDetail.jsx');
  const p = testoDi(pagina({ data: { RETE: { righe: [copiata, buona] }, ACI: { righe: [] }, EXTRA_RACCOLTA: { righe: [] } }, loading: false, periodo: { mese: 'Gennaio', anno: 2027 } }));
  verifica('la scheda «Anomalie & Sospesi» la conta: (1), non (0)', /Anomalie & Sospesi \(1\)/.test(p), p.slice(0, 300));
  // Le colonne e i colori dell'esportazione: le stesse parole della pagina.
  const src = sorgente('src/components/fatturazione/AttivaDetail.jsx');
  verifica('Excel e PDF del dettaglio: lo stato «da confermare» in ambra', /daConfermareRiga\(r\) \? 'da confermare'/.test(src) && /r\.sospesa \|\| daConfermareRiga\(r\) \? 'ambra'/.test(src));
  verifica('la scheda delle anomalie dice come si confermano', /Prestazioni con la tariffa da confermare/.test(src) && /Target & Status › Nuovo anno/.test(src));
});

await sezione('5. LO STORICO REGISTRA L\'ANNO DEL PREZZO DI UNA VOCE DEL FOGLIO DELL\'AMMINISTRAZIONE', async () => {
  // La casella «Prezzo del 2026, contratto scaduto: vale anche per il 2027?» di
  // VociPassivaDialog scrive lo stesso prezzo e prezzo_anno 2027: nel foglio di
  // gennaio 2027 la voce passa da «—» a 6 t x 70 = 420,00 €.
  const CT = await import('../base44/shared/campiTracciati.ts');
  const voce = { id: 'v1', canale: 'RETE', anno: 2027, soggetto: 'GATIM S.R.L.', voce: 'Calabria', prezzo: 70, prezzo_anno: 2026, unita_misura: 'euro_tonnellata' };
  const patch = { prezzo: 70, prezzo_anno: 2027 };
  const righe = CT.righeDiModifica('VocePassivaAmministrazione', { record_id: 'v1', prima: voce, dopo: { ...voce, ...patch }, patch, operazione: 'update' }, { utente: 'prova', origine: 'Fatturazione passiva', il: '2027-01-12T09:00:00Z' });
  verifica('la conferma del prezzo 2026 per il 2027 lascia una riga: anno del prezzo 2026 → 2027', righe.length === 1 && righe[0].campo === 'prezzo_anno' && righe[0].prima === '2026' && righe[0].dopo === '2027', J(righe));
  verifica('e la riga e\' riservata, come i prezzi delle voci', righe.length === 1 && righe[0].riservato === true, J(righe));
  verifica('lo stesso anno scritto come numero o come testo non e\' una modifica', CT.stessoValore('VocePassivaAmministrazione', 'prezzo_anno', 2027, '2027'));
  const pagina = await import('data:text/javascript;base64,' + Buffer.from(sorgente('src/lib/campiTracciati.js')).toString('base64'));
  verifica('lo specchio delle pagine ha lo stesso campo', !!pagina.campoTracciato('VocePassivaAmministrazione', 'prezzo_anno'));
});

await sezione('6. IL PDF DEL QUADRO: IL MARGINE «—» DICE PERCHE\'', async () => {
  const Q = await impacchetta('src/components/dashboard/esportaQuadro.js');
  // Il 15/01/2027 senza le tariffe 2027: il margine della rete e' «—» col perche',
  // l'ACI ha una tariffa copiata e da confermare, l'extra raccolta e' intera.
  const anno = (x) => ({ ricavo: 0, costo: 0, margine: null, margine_pct: null, tonnellate: 7.1, ricavo_t: null, costo_t: null, ...x });
  const margine = { canali: [
    { canale: 'RETE', anno: anno({ parziale: true, prezzi_mancanti: 3, testo_prezzi_mancanti: '3 righe senza prezzo (1 dell\'attiva, 2 della passiva): margine non calcolabile' }) },
    { canale: 'ACI', anno: anno({ ricavo: 344, costo: 200, margine: 144, margine_pct: 41.86, tonnellate: 1.6, ricavo_t: 215, costo_t: 125, testo_da_confermare: '1 riga con una tariffa copiata dal 2026 e da confermare' }) },
    { canale: 'EXTRA_RACCOLTA', anno: anno({ ricavo: 262.6, costo: 150, margine: 112.6, margine_pct: 42.88, tonnellate: 1.3, ricavo_t: 202, costo_t: 115.38 }) },
  ] };
  const quadro = { anno: 2027, giorno_dati: '2027-01-14', rete: { raccolto_t: 7.1, target_t: null, atteso: null, mesi: [], regioni: [] }, aci: { raccolto_t: 1.6, mesi: [] }, extra: { raccolto_t: 1.3, mesi: [] } };
  const arg = Q.argomentiQuadroPdf({ quadro, annoInCorso: true, margine, conEconomia: true, isAdmin: true });
  const s = (arg.sezioni || []).find(x => /Economia/.test(x.titolo));
  const nota = s ? s.colonne.findIndex(c => c.titolo === 'Nota') : -1;
  verifica('la sezione Economia ha la colonna «Nota»', nota >= 0, J(s && s.colonne.map(c => c.titolo)));
  const celle = (canale) => (s && s.righe.find(r => r.celle[0] === canale) || { celle: [] }).celle;
  verifica('la rete: margine «—» e il perche\', con ricavo e costo parziali', celle('Rete')[3] === '—' && /3 righe senza prezzo .*margine non calcolabile; ricavo e costo parziali/.test(celle('Rete')[nota] || ''), J(celle('Rete')));
  verifica('l\'ACI: il margine c\'e\' e la nota dice la tariffa da confermare', celle('ACI')[3] === 144 && /copiata dal 2026 e da confermare/.test(celle('ACI')[nota] || ''), J(celle('ACI')));
  const extra = s && s.righe.find(r => /xtra/i.test(r.celle[0]));
  verifica('l\'extra raccolta intera non ha nota', !!extra && extra.celle[nota] === '', J(extra));
  const senza = Q.argomentiQuadroPdf({ quadro, annoInCorso: true, margine, conEconomia: true, isAdmin: false });
  verifica('per chi non e\' amministratore l\'economia non esce, come prima', !(senza.sezioni || []).some(x => /Economia/.test(x.titolo)));
});

await sezione('7. FRA LE RICHIESTE ECT COMPLETATE, UNA DELL\'ANNO PRIMA LO DICE', async () => {
  // Il 12/01/2027: una richiesta di dicembre 2026 spuntata a gennaio resta fra le
  // completate (richiesteDellaTodo), e la scheda dice di che anno e'.
  const disegna = await disegnaComponente('src/components/todo/RichiesteCompletate.jsx');
  const dicembre = { id: 'q1', anno: 2026, pdr_nome: 'GOMME ROSSI', provincia: 'NA', mail_inviata_il: '2026-12-18', scadenza: '2027-01-10', esito: 'evasa', evasione_confermata: true, evasione_confermata_il: '2027-01-08', ritiro_rilevato_il: '2027-01-07' };
  const gennaio = { id: 'q2', anno: 2027, pdr_nome: 'GOMME BIANCHI', provincia: 'SA', mail_inviata_il: '2027-01-05', esito: 'evasa', evasione_confermata: true, evasione_confermata_il: '2027-01-09', ritiro_rilevato_il: '2027-01-08' };
  const html = await alle('2027-01-12T09:00:00Z', () => disegna({ tutte: [dicembre, gennaio] }));
  const scheda = (id) => { const i = html.indexOf(`data-completata="${id}"`); return i < 0 ? '' : testoDi(html.slice(i, html.indexOf('data-completata=', i + 20) > 0 ? html.indexOf('data-completata=', i + 20) : undefined)); };
  verifica('la richiesta del 2026 dice «richiesta del 2026»', /richiesta del 2026/.test(scheda('q1')), scheda('q1'));
  verifica('quella del 2027 no', scheda('q2') !== '' && !/richiesta del/.test(scheda('q2')), scheda('q2'));
  const senzaAnno = { ...dicembre, id: 'q3', anno: undefined };
  const html2 = await alle('2027-01-12T09:00:00Z', () => disegna({ tutte: [senzaAnno] }));
  verifica('senza l\'anno salvato vale quello della mail', /richiesta del 2026/.test(testoDi(html2)), testoDi(html2).slice(0, 300));
  const html3 = await alle('2026-12-20T09:00:00Z', () => disegna({ tutte: [dicembre] }));
  verifica('controprova: a dicembre 2026 la stessa richiesta non lo dice', !/richiesta del/.test(testoDi(html3)), testoDi(html3).slice(0, 300));
});

await sezione('8. LE DICHIARAZIONI SENZA L\'APERTURA DEL 31/12: «—» COL PERCHE\', E I SITI PORTATI DALL\'ANNO PRIMA', async () => {
  // Il 10/01/2027, anno copiato e chiusura del 2026 non ancora salvata: il
  // riepilogo manda null la giacenza iniziale, la calcolata e quello che resta,
  // col perche' (difetto 6). La pagina conosceva solo l'anno prima del
  // gestionale e l'anno chiuso: scriveva «giacenza a portale non disponibile»,
  // «Giacenza al 31/12 dell'anno prima: 0,00 t», e la riga ACI senza mesi non
  // c'era.
  const { caricaPagina, trova, testo } = await import('./dati/paginaFinta.mjs');
  const PERCHE_RETE = "Manca l'apertura di rete del 31/12/2026: quanto resta dell'anno prima non si sa. Si scrive salvando la chiusura dell'anno nelle Giacenze.";
  const PERCHE_ACI = "Manca l'apertura ACI del 31/12/2026: quanto resta dell'anno prima non si sa.";
  const mese = (m, kg) => ({ mese: m, conferito_kg: kg, da_dichiarare_kg: null, resta_kg: null, uscito_kg: 0, non_dichiarato_kg: 0 });
  const sito = {
    sito: 'IRIGOM SRL', chiave: 'irigom', tipo_destinazione: 'imp', operazione: 'R13', dichiara_rete: true,
    quadra: null, scarto_t: null, giacenza_iniziale_t: null, giacenza_calcolata_t: null, giacenza_portale_t: 652.84,
    perche_senza_apertura: PERCHE_RETE, senza_apertura: ['RETE', 'ACI'], nota_portata: 'dal 2026, da confermare sul contratto 2027', portata_dal: 2026,
    conferito_t: 8, secondarie_in_t: 0, dichiarato_caricato_rete_t: 0, giacenze_canale: [], date_da_sistemare: [], eseguiti: [],
    flussi: [
      { canale: 'RETE', provenienza: '', mesi: [mese('Gennaio', 8000)], dall_anno_prima: null, senza_apertura: true, perche: PERCHE_RETE, resta_t: null, conferito_t: 8, dichiarato_caricato_t: 0, dichiarato_totale_t: 0, da_stoccaggi_t: 0, apertura_t: 0 },
      { canale: 'ACI', provenienza: '', mesi: [mese('Gennaio', 0)], dall_anno_prima: null, senza_apertura: true, perche: PERCHE_ACI, resta_t: null, conferito_t: 0, dichiarato_caricato_t: 0, dichiarato_totale_t: 0, da_stoccaggi_t: 0, apertura_t: 0 },
    ],
  };
  const S = await caricaPagina('components/dichiarazioni/SezioneImpianto.jsx');
  const r = S.monta(S.Componente, { sito, onApri() {}, soloLettura: true });
  const span = (frase) => trova(r.albero, el => el.type === 'span' && testo(el).includes(frase));
  const testa = span("manca l'apertura del 31/12");
  verifica('in testa: «manca l\'apertura del 31/12», col perche\', non «giacenza a portale non disponibile»', testa.length === 1 && testa[0].props.title === PERCHE_RETE && span('giacenza a portale non disponibile').length === 0, J(testa.map(x => testo(x))));
  const inizio = span("Giacenza al 31/12 dell'anno prima")[0];
  const manca = inizio ? trova(inizio, el => el.type && el.type.name === 'Manca') : [];
  verifica('«Giacenza al 31/12 dell\'anno prima»: «—» col perche\', non 0,00', !!inizio && !/0,00/.test(testo(inizio)) && manca.length === 1 && manca[0].props.perche === PERCHE_RETE, inizio ? testo(inizio) : 'nessuna');
  const aci = trova(r.albero, el => el.type === 'p' && testo(el) === PERCHE_ACI);
  verifica('il canale ACI senza mesi c\'e\', col suo perche\'', aci.length === 1, J(trova(r.albero, 'p').map(x => testo(x)).slice(0, 12)));
  const mancheRete = trova(r.albero, el => el.type && el.type.name === 'Manca' && el.props.perche === PERCHE_ACI);
  verifica('e la riga del canale ACI dice il perche\' dell\'ACI, non quello della rete', mancheRete.length >= 1);
  verifica('il sito portato dall\'anno prima lo dice', trova(r.albero, el => el.type === 'p' && /Portato dal 2026, da confermare sul contratto 2027/.test(testo(el))).length === 1);
  r.smonta();
  // Il riepilogo: la riga ACI senza mesi c'e', e il «—» porta il perche' del canale.
  const R = await caricaPagina('components/dichiarazioni/Riepilogo.jsx');
  const rr = R.monta(R.Componente, { dati: { anno: 2027, siti: [sito], totali: {} }, onApri() {}, soloLettura: true });
  const titoli = trova(rr.albero, el => el.type === 'span' && el.props && el.props.title === PERCHE_ACI);
  verifica('Riepilogo: la riga ACI senza mesi c\'e\' e il suo «—» dice il perche\' dell\'ACI', titoli.length >= 1, J(trova(rr.albero, el => el.type === 'span' && el.props && el.props.title).map(x => x.props.title).slice(0, 8)));
  rr.smonta();
  // Le Giacenze e l'elenco «Da dichiarare» dicono lo stesso del sito portato.
  verifica('Giacenze e «Da dichiarare» scrivono «portato dal ...» del sito', /r\.nota_portata && <span[^>]*>portato \{r\.nota_portata\}/.test(sorgente('src/components/giacenze/SituazioneTable.jsx'))
    && /Portato \{r\.nota_portata\}/.test(sorgente('src/components/giacenze/DaDichiarareTable.jsx')) && /x\.nota_portata && <span[^>]*>portato \{x\.nota_portata\}/.test(sorgente('src/components/giacenze/DaDichiarareTable.jsx'))
    && /dati\.nota_siti_portati &&/.test(sorgente('src/pages/DichiarazioniImpianti.jsx')));
});

await sezione('9. GIACENZE › SITI: SALVARE UNA RIGA SENZA APERTURA NON SCRIVE UNO ZERO', async () => {
  // Il 10/01/2027 la riga di Irigom 2027 l'ha creata la copia d'anno senza
  // l'apertura (la chiusura del 2026 non e' ancora salvata). Si corregge solo la
  // tipologia: prima il salvataggio scriveva giacenza_riferimento_t 0, e la
  // casella mostrava 0 dove il numero non c'era.
  const { caricaPagina, clienteFinto, aspetta, trova } = await import('./dati/paginaFinta.mjs');
  const finestra = globalThis.window;
  globalThis.window = { ...(finestra || {}), self: 1, top: 1, confirm: () => true, alert: () => {}, localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
  try {
    const riga = { id: 'g27', sito: 'IRIGOM SRL', tipo_destinazione: 'imp', anno: 2027, tipologia_trattamento: 'EoW', note: 'copiato dal 2026, da confermare' };
    const base = clienteFinto({ archivi: { GiacenzaSito: [riga] } });
    const scritte = [];
    globalThis.__CLIENTE_FINTO = { ...base.cliente, entities: new Proxy({}, { get: (_t, nome) => {
      const e = base.cliente.entities[nome];
      return { ...e, update: async (id, r) => { scritte.push({ nome, id, r }); return e.update(id, r); }, create: async (r) => { scritte.push({ nome, r }); return e.create(r); } };
    } }) };
    const P = await caricaPagina('components/giacenze/TargetManager.jsx');
    const m = await alle('2027-01-10T09:00:00Z', async () => { const x = P.monta(P.Componente, { open: true, onClose() {}, anno: 2027, destinazioni: [], righe: [], onSaved() {} }); await aspetta(30); return x; });
    const modifica = trova(m.albero, el => el.type === 'button' && el.props['aria-label'] === 'Modifica IRIGOM SRL')[0];
    verifica('premessa: la riga del 2027 e\' in elenco', !!modifica);
    if (modifica) {
      await alle('2027-01-10T09:01:00Z', async () => { modifica.props.onClick(); await aspetta(10); });
      const casella = trova(m.albero, el => el.props && el.props.type === 'number' && el.props.step === '0.01')[0];
      verifica('la casella dell\'apertura e\' vuota («—»), non 0', !!casella && casella.props.value === '' && casella.props.placeholder === '—', J(casella && { value: casella.props.value, placeholder: casella.props.placeholder }));
      const salva = trova(m.albero, el => el.props && typeof el.props.onClick === 'function' && el.props.children === 'Salva')[0];
      verifica('premessa: c\'e\' il pulsante Salva', !!salva);
      if (salva) await alle('2027-01-10T09:02:00Z', async () => { await salva.props.onClick(); await aspetta(20); });
      const aggiornata = scritte.find(w => w.nome === 'GiacenzaSito' && w.id === 'g27');
      verifica('il salvataggio non scrive la giacenza di riferimento che non c\'era', !!aggiornata && !('giacenza_riferimento_t' in aggiornata.r) && aggiornata.r.tipologia_trattamento === 'EoW', J(scritte));
    }
    m.smonta();
  } finally { globalThis.window = finestra; delete globalThis.__CLIENTE_FINTO; }
});

console.log(`\n${ok} superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
