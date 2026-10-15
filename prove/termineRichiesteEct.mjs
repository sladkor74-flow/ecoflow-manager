// IL TERMINE DI UNA RICHIESTA ECT SI CORREGGE A MANO, E IL CARICAMENTO LO
// RISPETTA (15/10/2026).
//
// Richiesta dell'utente, testuale: «nella to-do list permetti la modifica delle
// richieste aperte per successive integrazioni e\o annotazioni». Il primo giro
// del 15/10/2026 aveva fatto la nota interna e le annotazioni e lasciato fuori il
// TERMINE: il caricamento del foglio (importaRichiesteEct) lo ricalcola dalla
// nota a ogni giro (scadenzaDaNota), e corretto in `scadenza` tornava com'era.
// Adesso la correzione sta in un campo suo, `scadenza_manuale`, che il
// caricamento non nomina mai (come id_ordine_manuale), e chi legge il termine lo
// legge da una regola sola (termineRichiesta / scadenzaDi in
// base44/shared/richiesteEct.ts, specchio src/lib/richiesteEct.js). Qui si prova:
//
// 1. la regola: corretto a mano vale lui, svuotato torna il foglio; il testo a
//    video; i giorni al termine e «oltre il termine» col termine che vale;
// 2. nel sorgente: nessuno legge piu' il termine da r.scadenza (To-Do List,
//    completate, dashboard, EcoTyna), e il caricamento non nomina il campo nuovo;
// 3. il banco, con le funzioni vere: importaRichiesteEct caricata due volte con
//    la nota cambiata (scadenza_manuale resta, scadenza segue la nota nuova),
//    anche a cavallo dell'anno (ogni richiesta col suo anno, il termine senza
//    anno letto dalla mail); il ricalcolo dei ritiri (importaBlocco, ritiri_ect)
//    non lo tocca. Una funzione cambiata apposta perche' lo riscriva fa fallire
//    il controllo;
// 4. lo stato e «Da gestire» seguono il termine corretto: la dashboard
//    (cruscotto.ts) ed EcoTyna (richieste_ect), in ritardo e non piu' in ritardo;
// 5. la scheda vera delle richieste (RichiesteEct.jsx) montata senza browser:
//    per l'amministratore il campo, il salvataggio senza riletture, il ritorno al
//    foglio; per chi non lo e' niente campo;
// 6. il campo (NoteRichiesta.jsx) usato come lo usa chi lavora; aperto e salvato
//    senza toccare niente non scrive niente, e il giorno del foglio non e' una
//    correzione (rilievo della revisione del 15/10/2026: prima si scriveva come
//    correzione a mano e il termine restava bloccato anche col foglio ricaricato
//    dopo un sollecito);
// 7. disegnati con React, e a 375 px;
// 8. l'archivio, la regola che lascia scrivere solo l'amministratore, la Guida.
//
// L'orologio e' fermo al 15/10/2026. node prove/termineRichiesteEct.mjs
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { caricaPagina, clienteFinto, aspetta, trova, testo as testoAlbero } from './dati/paginaFinta.mjs';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
const XLSX = createRequire(import.meta.url)('xlsx');

const ADESSO = Date.parse('2026-10-15T08:00:00Z');
const DataVera = Date;
class DataFissa extends DataVera {
  constructor(...a) { super(...(a.length ? a : [ADESSO])); }
  static now() { return ADESSO; }
}
globalThis.Date = DataFissa;
// L'orologio fermo su un altro istante, anche per le funzioni asincrone.
const alle = async (iso, f) => {
  const ms = DataVera.parse(iso);
  const prima = globalThis.Date;
  globalThis.Date = class extends DataVera { constructor(...a) { if (a.length) super(...a); else super(ms); } static now() { return ms; } };
  try { return await f(); } finally { globalThis.Date = prima; }
};

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
// Col codice di prima le funzioni nuove non ci sono: la prova lo dice, non si ferma.
const prova = async (nome, fn) => { try { await fn(); } catch (e) { verifica(nome, false, String(e && e.message).slice(0, 300)); } };
// I file possono essere CRLF: i \r si tolgono prima di cercare nel sorgente.
const sorgente = (p) => (existsSync(qui('../' + p)) ? readFileSync(qui('../' + p), 'utf8').replace(/\r/g, '') : '');
const senzaCommenti = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');

const R = await import('../base44/shared/richiesteEct.ts');
const fn = (nome) => (typeof R[nome] === 'function' ? R[nome] : () => { throw new Error(`${nome} non c'e' in richiesteEct.ts`); });

// ---------------------------------------------------------------------------
console.log('1. LA REGOLA (base44/shared/richiesteEct.ts)');

await prova('la regola', () => {
  const termine = fn('termineRichiesta'), scadenzaDi = fn('scadenzaDi'), testo = fn('testoTermine'), oltre = fn('oltreIlTermine');
  verifica('senza correzione vale il termine del foglio', scadenzaDi({ scadenza: '2026-10-31' }) === '2026-10-31'
    && J(termine({ scadenza: '2026-10-31' })) === J({ termine: '2026-10-31', corretto_a_mano: false, dal_foglio: '2026-10-31' }), J(termine({ scadenza: '2026-10-31' })));
  verifica('corretto a mano vale lui, e quello del foglio resta accanto', scadenzaDi({ scadenza: '2026-10-31', scadenza_manuale: '2026-11-05' }) === '2026-11-05'
    && J(termine({ scadenza: '2026-10-31', scadenza_manuale: '2026-11-05' })) === J({ termine: '2026-11-05', corretto_a_mano: true, dal_foglio: '2026-10-31' }));
  verifica('anche quando il foglio non ne dice uno', J(termine({ scadenza: null, scadenza_manuale: '2026-11-05' })) === J({ termine: '2026-11-05', corretto_a_mano: true, dal_foglio: null }));
  verifica('svuotato (null o vuoto) torna quello del foglio', scadenzaDi({ scadenza: '2026-10-31', scadenza_manuale: null }) === '2026-10-31' && scadenzaDi({ scadenza: '2026-10-31', scadenza_manuale: '' }) === '2026-10-31');
  verifica('una data con l\'ora vale come giorno; senza niente, null', scadenzaDi({ scadenza_manuale: '2026-11-05T00:00:00.000Z' }) === '2026-11-05' && scadenzaDi({}) === null && scadenzaDi(null) === null);
  verifica('a video «entro il gg/mm/aaaa», e corretto a mano col foglio accanto', testo({ scadenza: '2026-10-31' }) === 'entro il 31/10/2026'
    && testo({ scadenza: '2026-10-31', scadenza_manuale: '2026-11-05' }) === 'entro il 05/11/2026 (corretto a mano; dal foglio: 31/10/2026)'
    && testo({ scadenza_manuale: '2026-11-05' }) === 'entro il 05/11/2026 (corretto a mano; il foglio non ne dice uno)' && testo({}) === '',
  J([testo({ scadenza: '2026-10-31', scadenza_manuale: '2026-11-05' }), testo({ scadenza_manuale: '2026-11-05' })]));
  verifica('i giorni al termine contano quello corretto (e col giorno, come prima)', R.giorniAllaScadenza({ scadenza: '2026-10-10', scadenza_manuale: '2026-10-25' }, '2026-10-15') === 10
    && R.giorniAllaScadenza('2026-10-31', '2026-10-15') === 16 && R.giorniAllaScadenza(null, '2026-10-15') === null,
  J([R.giorniAllaScadenza({ scadenza: '2026-10-10', scadenza_manuale: '2026-10-25' }, '2026-10-15'), R.giorniAllaScadenza('2026-10-31', '2026-10-15')]));
  verifica('oltre il termine col termine che vale: spostato avanti non lo e\' piu\', anticipato lo diventa', oltre({ scadenza: '2026-10-10' }, '2026-10-15')
    && !oltre({ scadenza: '2026-10-10', scadenza_manuale: '2026-10-25' }, '2026-10-15') && oltre({ scadenza: '2026-10-31', scadenza_manuale: '2026-10-12' }, '2026-10-15')
    && !oltre({ scadenza: '2026-10-15' }, '2026-10-15') && !oltre({}, '2026-10-15'));
  verifica('lo specchio delle pagine ha le stesse funzioni (il corpo lo confronta prove/specchi.mjs)',
    ['termineRichiesta', 'scadenzaDi', 'testoTermine', 'oltreIlTermine', 'correzioneDelTermine'].every(n => new RegExp(`export function ${n}\\(`).test(sorgente('src/lib/richiesteEct.js'))));
});

// ---------------------------------------------------------------------------
await prova('che cosa si scrive come correzione', () => {
  const correzione = fn('correzioneDelTermine');
  const foglio = { scadenza: '2026-10-31' };
  verifica('un giorno diverso da quello del foglio si scrive', correzione(foglio, '2026-11-05') === '2026-11-05' && correzione(foglio, '05/11/2026') === '2026-11-05', J([correzione(foglio, '2026-11-05'), correzione(foglio, '05/11/2026')]));
  verifica('lo stesso giorno del foglio non e\' una correzione: null', correzione(foglio, '2026-10-31') === null && correzione(foglio, '31/10/2026') === null
    && correzione({ ...foglio, scadenza_manuale: '2026-11-05' }, '2026-10-31') === null, J([correzione(foglio, '2026-10-31'), correzione({ ...foglio, scadenza_manuale: '2026-11-05' }, '2026-10-31')]));
  verifica('vuoto e\' null', correzione(foglio, '') === null && correzione(foglio, null) === null && correzione({ ...foglio, scadenza_manuale: '2026-11-05' }, '') === null);
  verifica('se il foglio non ne dice uno, ogni giorno e\' una correzione', correzione({}, '2026-11-05') === '2026-11-05' && correzione({ scadenza: null }, '2026-11-05') === '2026-11-05');
});

// ---------------------------------------------------------------------------
console.log('2. NEL SORGENTE: NESSUNO LEGGE IL TERMINE DA r.scadenza');

await prova('le letture del termine', () => {
  const legge = (s) => (senzaCommenti(s).match(/\.scadenza\b(?!_)|\[\s*['"]scadenza['"]\s*\]/g) || []).length;
  // lo strumento di EcoTyna: il suo blocco, non le scadenze dei documenti piu' sotto
  const assistente = sorgente('base44/shared/strumentiAssistente.ts');
  const inizio = assistente.indexOf("nome: 'richieste_ect'");
  const blocco = inizio >= 0 ? assistente.slice(inizio, assistente.indexOf("nome: '", inizio + 10)) : '';
  verifica('lo strumento richieste_ect si trova', blocco.length > 1000);
  const chi = {
    'src/components/todo/RichiesteEct.jsx': sorgente('src/components/todo/RichiesteEct.jsx'),
    'src/components/todo/RichiesteCompletate.jsx': sorgente('src/components/todo/RichiesteCompletate.jsx'),
    'src/components/todo/NoteRichiesta.jsx': sorgente('src/components/todo/NoteRichiesta.jsx'),
    'base44/shared/cruscotto.ts': sorgente('base44/shared/cruscotto.ts'),
    'base44/functions/cruscottoOperativo/entry.ts': sorgente('base44/functions/cruscottoOperativo/entry.ts'),
    'base44/functions/importaBlocco/entry.ts': sorgente('base44/functions/importaBlocco/entry.ts'),
    'base44/shared/todoOrdini.ts': sorgente('base44/shared/todoOrdini.ts'),
    'src/lib/todoSezioni.js': sorgente('src/lib/todoSezioni.js'),
    'strumentiAssistente.ts, richieste_ect': blocco,
  };
  for (const [nome, s] of Object.entries(chi)) verifica(`${nome}: nessuna lettura di .scadenza`, legge(s) === 0, String(legge(s)));
  // nel modulo della regola, una sola: quella di termineRichiesta
  for (const p of ['base44/shared/richiesteEct.ts', 'src/lib/richiesteEct.js']) {
    const s = senzaCommenti(sorgente(p));
    const dove = s.indexOf('export function termineRichiesta(');
    verifica(`${p}: r.scadenza si legge solo in termineRichiesta`, legge(s) === 1 && dove >= 0 && s.indexOf('r.scadenza)', dove) > dove && s.indexOf('r.scadenza)', dove) < s.indexOf('\n}', dove), String(legge(s)));
  }
  verifica('le pagine usano la regola', /termineRichiesta\(|scadenzaDi\(/.test(chi['src/components/todo/RichiesteEct.jsx']) && /oltreIlTermine\(/.test(chi['src/components/todo/RichiesteEct.jsx'])
    && /testoTermine\(/.test(chi['src/components/todo/RichiesteCompletate.jsx']) && /oltreIlTermine\(/.test(chi['base44/shared/cruscotto.ts']) && /termineRichiesta\(/.test(blocco));
  verifica('il caricamento del foglio e il ricalcolo dei ritiri non nominano mai scadenza_manuale',
    !/scadenza_manuale/.test(sorgente('base44/functions/importaRichiesteEct/entry.ts')) && !/scadenza_manuale/.test(sorgente('base44/functions/importaBlocco/entry.ts'))
    && sorgente('base44/functions/importaRichiesteEct/entry.ts').length > 1000);
});

// ---------------------------------------------------------------------------
console.log('3. IL BANCO: IL CARICAMENTO DEL FOGLIO LO RISPETTA');

// importaRichiesteEct vera, impacchettata con un SDK finto che legge e scrive
// globalThis.__ARCHIVI e registra ogni scrittura in globalThis.__SCRITTE; il
// file arriva da un fetch finto. `cambia` (solo per la controprova) ne cambia il
// sorgente prima di impacchettarla.
const SDK_FINTO = `
const uguale = (r, f) => Object.entries(f || {}).every(([k, v]) => r[k] === v);
let progressivo = 0;
function entita(nome) {
  const righe = () => (globalThis.__ARCHIVI[nome] ||= []);
  return {
    filter: async (f, _o, quanti = 1e9, salta = 0) => righe().filter(r => uguale(r, f)).slice(salta, salta + quanti).map(r => ({ ...r })),
    list: async (_o, quanti = 1e9, salta = 0) => righe().slice(salta, salta + quanti).map(r => ({ ...r })),
    create: async (dati) => { const r = { id: nome + '-' + (++progressivo), ...dati }; righe().push(r); globalThis.__SCRITTE.push({ nome, op: 'create', d: { ...dati } }); return { ...r }; },
    update: async (id, dati) => { const r = righe().find(x => x.id === id); if (!r) throw new Error('non trovato ' + id); Object.assign(r, dati); globalThis.__SCRITTE.push({ nome, op: 'update', id, d: { ...dati } }); return { ...r }; },
  };
}
const entities = new Proxy({}, { get: (_t, nome) => entita(nome) });
const integrations = { Core: { CreateFileSignedUrl: async () => ({ signed_url: 'https://file.finto/richieste.xlsx' }) } };
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: 'admin', email: 'prova@prova' }) }, asServiceRole: { entities, integrations }, entities, integrations };
}`;
const impacchetta = async (cambia = null) => {
  const file = qui('../base44/functions/importaRichiesteEct/entry.ts');
  const ingresso = cambia
    ? { stdin: { contents: cambia(readFileSync(file, 'utf8')), resolveDir: qui('../base44/functions/importaRichiesteEct/'), loader: 'ts', sourcefile: 'entry.ts' } }
    : { entryPoints: [file] };
  const p = await build({
    ...ingresso,
    bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent', mainFields: ['module', 'main'],
    plugins: [{ name: 'finti', setup(b) {
      b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'finto' }));
      b.onLoad({ filter: /.*/, namespace: 'finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
      b.onResolve({ filter: /^npm:xlsx/ }, () => ({ path: qui('../node_modules/xlsx/xlsx.mjs') }));
    } }],
  });
  return import('data:text/javascript;base64,' + Buffer.from(p.outputFiles[0].text).toString('base64'));
};
// Il giorno come lo scrive Excel: la mezzanotte locale.
const d = (s) => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const fileDi = (aoa) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa, { cellDates: true }), 'Richieste ECT');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
};
const TESTA = [['RICHIESTA ECT', 'provincia', 'DATE', null, 'trasportatore', 'mail inviata il', null], [null, null, 'ordine immesso', 'ordine evaso', null, null, null]];
const VUOTI = () => ({ Assegnato: [], AssegnatoAci: [], PrimariaRete: [], PrimariaAci: [], UploadLog: [], FileDaRimuovere: [], RichiestaEct: [] });
/** importaRichiesteEct sull'archivio `archivi` (che resta scritto), alle `iso`, col file `buf`. */
const caricaFoglio = async (modulo, buf, archivi, iso) => {
  globalThis.__ARCHIVI = archivi;
  globalThis.__SCRITTE = [];
  const fetchVero = globalThis.fetch;
  globalThis.fetch = async () => new Response(buf);
  try {
    return await alle(iso, async () => { const r = await modulo.default({ json: async () => ({ file_uri: 'privato/richieste.xlsx' }) }); return { status: r.status, body: await r.json() }; });
  } finally { globalThis.fetch = fetchVero; }
};
const di = (archivi, nome) => archivi.RichiestaEct.find(x => x.pdr_nome === nome) || {};
const nominano = () => globalThis.__SCRITTE.filter(s => s.nome === 'RichiestaEct' && s.d && 'scadenza_manuale' in s.d);

let IMPORTA = null;
await prova('importaRichiesteEct si impacchetta', async () => { IMPORTA = await impacchetta(); });

await prova('il foglio ricaricato con la nota cambiata', async () => {
  if (!IMPORTA) throw new Error('non impacchettata');
  const primo = fileDi([...TESTA,
    ['ROSSI GOMME', 'BA', d('2026-09-01'), null, 'smoco', d('2026-09-20'), 'entro ottobre'],
    ['BIANCHI PNEUMATICI', 'BA', d('2026-09-02'), null, 'smoco', d('2026-09-21'), ''],
  ]);
  // Il secondo: la nota di Rossi anticipa il termine al 12/10, Bianchi ne ha uno.
  const secondo = fileDi([...TESTA,
    ['ROSSI GOMME', 'BA', d('2026-09-01'), null, 'smoco', d('2026-09-20'), 'urgente, entro il 12/10'],
    ['BIANCHI PNEUMATICI', 'BA', d('2026-09-02'), null, 'smoco', d('2026-09-21'), 'entro il 30/10'],
  ]);
  const archivi = VUOTI();
  const a = await caricaFoglio(IMPORTA, primo, archivi, '2026-10-01T08:00:00Z');
  verifica('01/10/2026: due richieste; il termine di Rossi dal foglio e\' il 31/10/2026, Bianchi non ne ha', a.status === 200 && a.body.creati === 2
    && di(archivi, 'ROSSI GOMME').scadenza === '2026-10-31' && !di(archivi, 'BIANCHI PNEUMATICI').scadenza, `${a.status} ${J(a.body).slice(0, 200)}`);
  // L'amministratore corregge i due termini dalla To-Do List (scrive solo quel campo).
  di(archivi, 'ROSSI GOMME').scadenza_manuale = '2026-11-05';
  di(archivi, 'BIANCHI PNEUMATICI').scadenza_manuale = '2026-10-20';
  const istantanea = J(archivi);
  const b = await caricaFoglio(IMPORTA, secondo, archivi, '2026-10-15T08:00:00Z');
  const rossi = di(archivi, 'ROSSI GOMME'), bianchi = di(archivi, 'BIANCHI PNEUMATICI');
  verifica('15/10/2026: il foglio ricaricato aggiorna le due richieste, senza doppioni', b.status === 200 && b.body.creati === 0 && b.body.aggiornati === 2 && archivi.RichiestaEct.length === 2, `${b.status} ${J(b.body).slice(0, 200)}`);
  verifica('il termine del foglio segue la nota nuova', rossi.scadenza === '2026-10-12' && bianchi.scadenza === '2026-10-30', J([rossi.scadenza, bianchi.scadenza]));
  verifica('il termine corretto a mano resta, e nessuna scrittura lo nomina', rossi.scadenza_manuale === '2026-11-05' && bianchi.scadenza_manuale === '2026-10-20' && nominano().length === 0, J(nominano()));
  verifica('e vale lui: Rossi entro il 05/11/2026, non oltre il termine il 15/10/2026 (dal foglio lo sarebbe)', fn('scadenzaDi')(rossi) === '2026-11-05' && !fn('oltreIlTermine')(rossi, '2026-10-15')
    && fn('oltreIlTermine')({ ...rossi, scadenza_manuale: null }, '2026-10-15'));
  verifica('a video lo dice col termine del foglio', fn('testoTermine')(rossi) === 'entro il 05/11/2026 (corretto a mano; dal foglio: 12/10/2026)', fn('testoTermine')(rossi));
  // Un terzo caricamento identico non riscrive niente.
  const c = await caricaFoglio(IMPORTA, secondo, archivi, '2026-10-16T08:00:00Z');
  verifica('ricaricato uguale: niente da aggiornare, la correzione resta', c.status === 200 && c.body.aggiornati === 0 && c.body.invariati === 2 && di(archivi, 'ROSSI GOMME').scadenza_manuale === '2026-11-05', J(c.body).slice(0, 200));
  // La controprova: lo stesso caricamento, cambiato perche' rimetta il termine a
  // null insieme ai suoi campi. Il controllo deve accorgersene.
  const riga = 'await svc.RichiestaEct.update(gia.id, campi);';
  const mutante = await impacchetta((src) => { if (!src.includes(riga)) throw new Error('riga non trovata: ' + riga); return src.replace(riga, 'await svc.RichiestaEct.update(gia.id, { ...campi, scadenza_manuale: null });'); });
  const archivi2 = JSON.parse(istantanea);
  await caricaFoglio(mutante, secondo, archivi2, '2026-10-15T08:00:00Z');
  verifica('controprova: un caricamento che riscrivesse il termine a mano non passerebbe', !(di(archivi2, 'ROSSI GOMME').scadenza_manuale === '2026-11-05' && nominano().length === 0));
});

await prova('a cavallo dell\'anno', async () => {
  if (!IMPORTA) throw new Error('non impacchettata');
  // La mail del 18/12/2026 chiede il ritiro «entro il 10/01»: 10/01/2027 (il
  // termine senza anno si legge dalla mail). L'amministratore lo sposta al 20/01.
  const DIC = [['ROSSI GOMME', 'BA', d('2026-12-18'), null, 'smoco', d('2026-12-18'), 'DA FARE ENTRO IL 10/01']];
  const GEN = [['NERI AUTO', 'BA', d('2027-01-05'), null, 'smoco', d('2027-01-05'), 'entro il 25/01']];
  const archivi = VUOTI();
  const a = await caricaFoglio(IMPORTA, fileDi([...TESTA, ...DIC]), archivi, '2026-12-21T09:00:00Z');
  verifica('21/12/2026: la richiesta e\' del 2026, entro il 10/01/2027', a.status === 200 && di(archivi, 'ROSSI GOMME').anno === 2026 && di(archivi, 'ROSSI GOMME').scadenza === '2027-01-10', J(archivi.RichiestaEct));
  di(archivi, 'ROSSI GOMME').scadenza_manuale = '2027-01-20';
  const b = await caricaFoglio(IMPORTA, fileDi([...TESTA, ...DIC, ...GEN]), archivi, '2027-01-12T09:00:00Z');
  const rossi = di(archivi, 'ROSSI GOMME');
  verifica('12/01/2027: una sola nuova, nessun doppione; ognuna col suo anno', b.status === 200 && b.body.creati === 1 && archivi.RichiestaEct.length === 2 && rossi.anno === 2026 && di(archivi, 'NERI AUTO').anno === 2027,
    `${b.status} ${J(b.body).slice(0, 200)}`);
  verifica('il termine del foglio resta il 10/01/2027, quello a mano il 20/01/2027', rossi.scadenza === '2027-01-10' && rossi.scadenza_manuale === '2027-01-20' && nominano().length === 0, J(rossi));
  const daSeguire = fn('richiesteDaSeguire')(archivi.RichiestaEct, 2027);
  verifica('a gennaio la richiesta di dicembre e\' ancora da seguire', daSeguire.some(x => x.pdr_nome === 'ROSSI GOMME'));
  const { cruscotto } = await import('../base44/shared/cruscotto.ts');
  const base = { oggi: '2027-01-12', anno: 2027, adessoMs: Date.parse('2027-01-12T09:00:00Z'), tipiFile: [], uploadLogs: [], alertAperti: [], assegnatiRete: [], assegnatiAci: [], documenti: [], prefatture: [] };
  const oltre = (lista) => (cruscotto({ ...base, richiesteEct: lista }).da_gestire || []).filter(v => v.area === 'Richieste ECT' && v.gravita === 'critico').map(v => v.titolo);
  verifica('il 12/01/2027 la dashboard non la dice oltre il termine (vale il 20/01)', oltre(daSeguire).length === 0, J(oltre(daSeguire)));
  verifica('controprova: col solo termine del foglio (10/01) lo sarebbe', J(oltre(daSeguire.map(x => ({ ...x, scadenza_manuale: null })))) === J(['1 richieste del consorzio oltre il termine']), J(oltre(daSeguire.map(x => ({ ...x, scadenza_manuale: null })))));
});

await prova('il ricalcolo dei ritiri dopo le primarie', async () => {
  const { caricaFunzione, chiama } = await import('./dati/bancoFunzioni.mjs');
  const F = await caricaFunzione('importaBlocco');
  const corpo = { azione: 'ritiri_ect', tipo_file: 'primarie' };
  const RICHIESTE = () => [
    // il suo ordine e' ancora assegnato: resta aperta
    { id: 'e1', anno: 2026, pdr_nome: 'ROSSI GOMME', id_ordine_manuale: 'ET26000201', ordine_immesso_il: '2026-09-01', mail_inviata_il: '2026-09-20', scadenza: '2026-10-12', scadenza_manuale: '2026-11-05', esito: 'aperta' },
    // il suo ordine e' terminato: si chiude da sola
    { id: 'e2', anno: 2026, pdr_nome: 'VERDI AUTO', id_ordine_manuale: 'ET26000202', ordine_immesso_il: '2026-09-03', mail_inviata_il: '2026-09-22', scadenza: '2026-10-31', scadenza_manuale: '2026-10-20', esito: 'aperta' },
  ];
  const db = {
    RichiestaEct: RICHIESTE(), PrimariaAci: [], AssegnatoAci: [], UploadLog: [],
    Assegnato: [{ id: 'a1', id_ordine: 'ET26000201', stato: 'assegnato', punto_di_raccolta: 'ROSSI GOMME', ordine_immesso_il: '2026-09-01T07:00:00Z' }],
    PrimariaRete: [{ id: 'p2', id_ordine: 'ET26000202', stato: 'terminato', punto_di_raccolta: 'VERDI AUTO', ordine_immesso_il: '2026-09-03T07:00:00Z', trasporto_iniziato_il: '2026-10-09T07:00:00Z', trasporto_finito_il: '2026-10-09T09:00:00Z' }],
  };
  const r = await chiama(F, { db, corpo });
  const e1 = r.db.RichiestaEct.find(x => x.id === 'e1'), e2 = r.db.RichiestaEct.find(x => x.id === 'e2');
  verifica('risponde, e la richiesta ritirata si chiude da sola', r.stato === 200 && e2.esito === 'evasa' && e1.esito === 'aperta', `${r.stato} ${J(r.j).slice(0, 200)}`);
  verifica('i termini corretti a mano restano, e nessuna scrittura li nomina', e1.scadenza_manuale === '2026-11-05' && e2.scadenza_manuale === '2026-10-20'
    && !r.scritte.some(s => s.entita === 'RichiestaEct' && s.dati && 'scadenza_manuale' in s.dati), J(r.scritte));
});

// ---------------------------------------------------------------------------
console.log('4. LO STATO E «DA GESTIRE» SEGUONO IL TERMINE CORRETTO');

// A: dal foglio era il 10/10 (passato), corretto al 25/10: non piu' in ritardo.
// B: dal foglio il 31/10, anticipato a mano al 12/10: in ritardo.
const A = () => ({ id: 'rA', anno: 2026, pdr_nome: 'ROSSI GOMME', provincia: 'BA', mail_inviata_il: '2026-09-20', ordine_immesso_il: '2026-09-01', nota: 'entro il 10/10', scadenza: '2026-10-10', scadenza_manuale: '2026-10-25', esito: 'aperta' });
const B = () => ({ id: 'rB', anno: 2026, pdr_nome: 'BIANCHI PNEUMATICI', provincia: 'NA', mail_inviata_il: '2026-09-21', ordine_immesso_il: '2026-09-02', nota: 'entro ottobre', scadenza: '2026-10-31', scadenza_manuale: '2026-10-12', esito: 'aperta' });

await prova('la dashboard', async () => {
  const { cruscotto } = await import('../base44/shared/cruscotto.ts');
  const base = { oggi: '2026-10-15', anno: 2026, adessoMs: ADESSO, tipiFile: [], uploadLogs: [], alertAperti: [], assegnatiRete: [], assegnatiAci: [], documenti: [], prefatture: [] };
  const oltre = (lista) => (cruscotto({ ...base, richiesteEct: lista }).da_gestire || []).filter(v => v.area === 'Richieste ECT' && v.gravita === 'critico').map(v => v.titolo);
  verifica('spostata avanti a mano non e\' piu\' oltre il termine', oltre([A()]).length === 0, J(oltre([A()])));
  verifica('anticipata a mano lo diventa', J(oltre([B()])) === J(['1 richieste del consorzio oltre il termine']), J(oltre([B()])));
  verifica('insieme: una sola, quella anticipata', J(oltre([A(), B()])) === J(['1 richieste del consorzio oltre il termine']), J(oltre([A(), B()])));
  verifica('controprova: senza correzioni conta il foglio (A in ritardo, B no)', J(oltre([{ ...A(), scadenza_manuale: null }, { ...B(), scadenza_manuale: null }])) === J(['1 richieste del consorzio oltre il termine'])
    && oltre([{ ...B(), scadenza_manuale: null }]).length === 0);
});

await prova('EcoTyna (richieste_ect)', async () => {
  const { eseguiStrumento } = await import('../base44/shared/strumentiAssistente.ts');
  const RICHIESTE = [A(), B(), { id: 'rC', anno: 2026, pdr_nome: 'VERDI AUTO', provincia: 'SA', mail_inviata_il: '2026-09-22', scadenza: '2026-10-31', esito: 'aperta' }];
  const uguale = (r, f) => Object.entries(f || {}).every(([k, v]) => r[k] === v);
  const sdk = { asServiceRole: { entities: new Proxy({}, { get: (_t, n) => ({
    filter: async (f, _o, lim = 5000, skip = 0) => (n === 'RichiestaEct' ? RICHIESTE : []).filter(r => uguale(r, f)).slice(skip, skip + lim).map(r => ({ ...r })),
    list: async (_o, lim = 5000, skip = 0) => (n === 'RichiestaEct' ? RICHIESTE : []).slice(skip, skip + lim).map(r => ({ ...r })),
  }) }) } };
  const tutte = await eseguiStrumento(sdk, 'richieste_ect', {}, null);
  const righe = ((tutte.dati || {}).richieste || {}).righe || [];
  const riga = (pdr) => righe.find(x => x.pdr === pdr) || {};
  verifica('la spostata avanti: scadenza 25/10, non scaduta, e dice che e\' corretta a mano col termine del foglio',
    riga('ROSSI GOMME').scadenza === '2026-10-25' && riga('ROSSI GOMME').scaduta === false && riga('ROSSI GOMME').giorni_alla_scadenza === 10
    && riga('ROSSI GOMME').scadenza_corretta_a_mano === true && riga('ROSSI GOMME').scadenza_dal_foglio === '2026-10-10', J(riga('ROSSI GOMME')));
  verifica('l\'anticipata: scaduta da tre giorni', riga('BIANCHI PNEUMATICI').scaduta === true && riga('BIANCHI PNEUMATICI').giorni_alla_scadenza === -3, J(riga('BIANCHI PNEUMATICI')));
  verifica('quella non corretta resta com\'era, senza campi in piu\'', riga('VERDI AUTO').scadenza === '2026-10-31' && riga('VERDI AUTO').scaduta === false && !('scadenza_corretta_a_mano' in riga('VERDI AUTO')), J(riga('VERDI AUTO')));
  verifica('il conto delle scadute e la nota sui termini corretti', tutte.dati.scadute === 1 && /2 richieste hanno il termine corretto a mano/.test(tutte.dati.nota_termini_corretti || ''), J({ scadute: tutte.dati.scadute, nota: tutte.dati.nota_termini_corretti }));
  const scadute = await eseguiStrumento(sdk, 'richieste_ect', { stato: 'scaduta' }, null);
  verifica('«quali sono scadute?»: solo l\'anticipata', (((scadute.dati || {}).richieste || {}).righe || []).map(x => x.pdr).join(',') === 'BIANCHI PNEUMATICI');
});

// ---------------------------------------------------------------------------
console.log('5. LA SCHEDA VERA DELLE RICHIESTE (RichiesteEct.jsx)');

globalThis.window = globalThis.window || { self: 1, top: 1, matchMedia: () => ({ matches: false, addListener() {}, removeListener() {} }), confirm: () => true, alert: () => {} };
// Il client finto non registra che cosa si scrive: lo si guarda qui.
const conScritte = (f) => {
  const scritte = [];
  const entita = f.cliente.entities;
  f.cliente.entities = new Proxy({}, { get: (_t, n) => {
    const e = entita[n];
    return { ...e, update: async (id, dati) => { scritte.push({ nome: n, id, d: JSON.parse(J(dati)) }); return e.update(id, dati); } };
  } });
  return scritte;
};

await prova('la scheda, per l\'amministratore e per chi non lo e\'', async () => {
  for (const isAdmin of [true, false]) {
    const chi = isAdmin ? 'amministratore' : 'chi non lo e\'';
    const p = await caricaPagina('components/todo/RichiesteEct');
    const f = clienteFinto({ archivi: { RichiestaEct: [A(), B()] }, funzioni: { importaBlocco: async () => ({ aggiornate: 0 }) } });
    const scritte = conScritte(f);
    globalThis.__CLIENTE_FINTO = f.cliente;
    const r = p.monta(p.Componente, { isAdmin });
    await aspetta(60);
    const note = () => trova(r.albero, el => el.type && el.type.__finto === 'NoteRichiesta');
    const nota = (id) => note().find(n => n.props.richiesta && n.props.richiesta.id === id);
    const entro = (id) => {
      const el = trova(r.albero, x => typeof x.type === 'function' && x.type.name === 'Scadenza' && x.props.r && x.props.r.id === id)[0];
      return el ? testoAlbero(el.type(el.props)) : '';
    };
    const leggi = () => testoAlbero(r.albero);
    verifica(`${chi}: il termine si dice sulla riga (termine), e si corregge solo da amministratore`, note().length === 2 && note().every(n => n.props.termine === true && n.props.modificabile === isAdmin
      && (isAdmin ? typeof n.props.onTermine === 'function' : n.props.onTermine === null)), J(note().map(n => [n.props.richiesta.id, n.props.termine, n.props.modificabile, typeof n.props.onTermine])));
    verifica(`${chi}: «Entro» col termine che vale: A fra 10 giorni, corretto a mano; B in ritardo di 3`, /^25\/10\/2026 \(fra 10 giorni\)corretto a mano$/.test(entro('rA')) && /^12\/10\/2026 \(in ritardo di 3 giorni\)corretto a mano$/.test(entro('rB')), J([entro('rA'), entro('rB')]));
    verifica(`${chi}: in ritardo una sola, da sollecitare`, /1 richiesta ha superato il\s*termine/.test(leggi()), leggi().slice(0, 600));
    verifica(`${chi}: in ordine di termine, quello che vale (B il 12/10 prima di A il 25/10)`, note().map(n => n.props.richiesta.id).join() === 'rB,rA', note().map(n => n.props.richiesta.id).join());
    verifica(`${chi}: le richieste si leggono una volta, nessuna lettura per riga`, f.letture('RichiestaEct').length === 1 && !f.letture().some(l => l.metodo === 'get'), J(f.letture()));
    if (isAdmin) {
      // B spostata al 20/10: non piu' in ritardo. Una scrittura, nessuna lettura.
      await nota('rB').props.onTermine(nota('rB').props.richiesta, '2026-10-20');
      await aspetta(20);
      verifica('salvato: si scrive solo scadenza_manuale, su quella richiesta', J(scritte) === J([{ nome: 'RichiestaEct', id: 'rB', d: { scadenza_manuale: '2026-10-20' } }]), J(scritte));
      verifica('e la riga si aggiorna subito: B fra 5 giorni, nessuna in ritardo', /^20\/10\/2026 \(fra 5 giorni\)corretto a mano$/.test(entro('rB')) && !/superato il\s*termine/.test(leggi()) && nota('rB').props.richiesta.scadenza_manuale === '2026-10-20', entro('rB'));
      verifica('senza rileggere l\'elenco', f.letture('RichiestaEct').length === 1, J(f.letture()));
      // A torna al termine del foglio (10/10): di nuovo in ritardo.
      await nota('rA').props.onTermine(nota('rA').props.richiesta, null);
      await aspetta(20);
      verifica('svuotato: si scrive null e torna il termine del foglio, di nuovo in ritardo', J(scritte[1]) === J({ nome: 'RichiestaEct', id: 'rA', d: { scadenza_manuale: null } })
        && /^10\/10\/2026 \(in ritardo di 5 giorni\)$/.test(entro('rA')) && /1 richiesta ha superato il\s*termine/.test(leggi()), `${J(scritte[1])} ${entro('rA')}`);
      verifica('niente rilettura neanche qui, e nessun errore', f.letture('RichiestaEct').length === 1 && r.errori.length === 0, String(r.errori[0] || ''));
      // B col giorno del foglio (31/10): non e' una correzione, si scrive null.
      await nota('rB').props.onTermine(nota('rB').props.richiesta, '2026-10-31');
      await aspetta(20);
      verifica('il giorno del foglio la scheda lo scrive come null, e la riga non dice «corretto a mano»', J(scritte[2]) === J({ nome: 'RichiestaEct', id: 'rB', d: { scadenza_manuale: null } })
        && /^31\/10\/2026 \(fra 16 giorni\)$/.test(entro('rB')), `${J(scritte[2])} ${entro('rB')}`);
    } else {
      verifica('chi non e\' amministratore non scrive niente', scritte.length === 0 && !f.funzioniChiamate('importaBlocco').length);
    }
    r.smonta();
  }
});

// ---------------------------------------------------------------------------
console.log('6. IL CAMPO, USATO (NoteRichiesta.jsx)');

await prova('il termine corretto a mano, usato', async () => {
  const p = await caricaPagina('components/todo/NoteRichiesta');
  const chiamate = [];
  let rompi = false;
  const onTermine = async (richiesta, giorno) => { if (rompi) throw new Error('rete caduta'); chiamate.push([richiesta.id, giorno]); };
  const scrittore = { notaInterna: async () => {}, annota: async () => ({ scritto: false, elenco: [] }) };
  const rec = { id: 'r1', scadenza: '2026-10-31', annotazioni: [] };
  const r = p.monta(p.Componente, { richiesta: rec, modificabile: true, scrittore, termine: true, onTermine });
  const leggi = () => testoAlbero(r.albero);
  const accanto = () => (trova(r.albero, el => el.type && el.type.__finto === 'Annotazioni')[0] || { props: {} }).props.accanto;
  const bottoneIn = (albero, re) => trova(albero, el => el.type === 'button' && re.test(testoAlbero(el)))[0];
  const campo = () => trova(r.albero, el => el.type === 'input' && el.props.type === 'date')[0];
  const apri = async () => { bottoneIn(accanto(), /Correggi il termine/).props.onClick(); await aspetta(5); };
  const scrivi = async (v) => { campo().props.onChange({ target: { value: v } }); await aspetta(5); };
  const salva = async () => { await bottoneIn(r.albero, /Salva il termine/).props.onClick(); await aspetta(10); };
  verifica('accanto ad «Aggiungi un\'annotazione», «Nota interna» e «Correggi il termine»', !!bottoneIn(accanto(), /Correggi il termine/) && !!bottoneIn(accanto(), /Nota interna/), testoAlbero(accanto()));
  verifica('senza correzione non si dice niente in piu\'', !/corretto a mano/.test(leggi()));
  await apri();
  verifica('si apre il campo «Termine corretto a mano», col termine che vale, e il foglio accanto', !!campo() && campo().props['aria-label'] === 'Termine corretto a mano' && campo().props.value === '2026-10-31'
    && leggi().includes('Dal foglio: entro il 31/10/2026.') && leggi().includes('svuotato o col giorno del foglio, torna quello del foglio'), leggi());
  await scrivi('2026-11-05');
  await salva();
  verifica('salvato: la scrittura col giorno', J(chiamate) === J([['r1', '2026-11-05']]), J(chiamate));
  verifica('e si legge subito «entro il 05/11/2026 (corretto a mano; dal foglio: 31/10/2026)»', leggi().includes('Termine: entro il 05/11/2026 (corretto a mano; dal foglio: 31/10/2026)') && !campo(), leggi());
  await apri();
  verifica('riaperto, col giorno corretto e «Torna al termine del foglio»', campo().props.value === '2026-11-05' && !!bottoneIn(r.albero, /Torna al termine del foglio/));
  await scrivi('2026-11-05');
  await salva();
  verifica('lo stesso giorno non si riscrive', chiamate.length === 1 && !campo());
  await apri();
  await bottoneIn(r.albero, /Torna al termine del foglio/).props.onClick();
  await aspetta(10);
  verifica('«Torna al termine del foglio» scrive null, e la riga non dice piu\' «corretto a mano»', J(chiamate[1]) === J(['r1', null]) && !/corretto a mano/.test(leggi()), J(chiamate));
  await apri();
  verifica('senza correzione «Torna al termine del foglio» non c\'e\'', !bottoneIn(r.albero, /Torna al termine del foglio/));
  await scrivi('2026-11-07');
  await salva();
  await apri();
  await scrivi('');
  await salva();
  verifica('svuotato e salvato vale come «torna al foglio»: null', J(chiamate.slice(2)) === J([['r1', '2026-11-07'], ['r1', null]]), J(chiamate));
  await apri();
  await scrivi('31/02/2026');
  await salva();
  verifica('un giorno che non esiste non si scrive, e lo si dice', chiamate.length === 4 && /Il termine non è un giorno: scrivilo come gg\/mm\/aaaa/.test(leggi()) && !!campo(), leggi().slice(-200));
  await scrivi('05/12/2026');
  rompi = true;
  await salva();
  verifica('un salvataggio che non riesce si dice, e il campo resta aperto', /Il termine non è stato salvato: rete caduta/.test(leggi()) && !!campo() && chiamate.length === 4, leggi().slice(-200));
  rompi = false;
  await salva();
  verifica('scritto come gg/mm/aaaa vale anche cosi\'', J(chiamate[4]) === J(['r1', '2026-12-05']), J(chiamate));
  r.smonta();

  // Aperto e salvato senza toccare niente: il campo si apre col termine che
  // vale, e salvarlo cosi' non scrive niente. Prima scriveva il giorno del
  // foglio come correzione a mano, e col foglio ricaricato dopo un sollecito
  // («entro il 12/10») il 15/10 la richiesta non risultava in ritardo.
  {
    const { cruscotto } = await import('../base44/shared/cruscotto.ts');
    const base = { oggi: '2026-10-15', anno: 2026, adessoMs: ADESSO, tipiFile: [], uploadLogs: [], alertAperti: [], assegnatiRete: [], assegnatiAci: [], documenti: [], prefatture: [] };
    const oltre = (lista) => (cruscotto({ ...base, richiesteEct: lista }).da_gestire || []).filter(v => v.area === 'Richieste ECT' && v.gravita === 'critico').map(v => v.titolo);
    const usa = async (richiesta, scrivi) => {
      const scritte = [];
      const m = p.monta(p.Componente, { richiesta: { annotazioni: [], ...richiesta }, modificabile: true, scrittore, termine: true, onTermine: async (x, g) => { scritte.push([x.id, g]); } });
      const acc = (trova(m.albero, el => el.type && el.type.__finto === 'Annotazioni')[0] || { props: {} }).props.accanto;
      bottoneIn(acc, /Correggi il termine/).props.onClick(); await aspetta(5);
      const prima = (trova(m.albero, el => el.type === 'input' && el.props.type === 'date')[0] || { props: {} }).props.value;
      if (scrivi !== undefined) { trova(m.albero, el => el.type === 'input' && el.props.type === 'date')[0].props.onChange({ target: { value: scrivi } }); await aspetta(5); }
      await bottoneIn(m.albero, /Salva il termine/).props.onClick(); await aspetta(10);
      const esito = { scritte, prima, testo: testoAlbero(m.albero), aperto: !!trova(m.albero, el => el.type === 'input' && el.props.type === 'date')[0] };
      m.smonta();
      return esito;
    };
    const intatto = await usa({ id: 'r6', anno: 2026, pdr_nome: 'ROSSI GOMME', esito: 'aperta', scadenza: '2026-10-31' });
    verifica('aperto col termine del foglio e salvato senza toccare niente: nessuna scrittura, e non dice «corretto a mano»', intatto.prima === '2026-10-31' && intatto.scritte.length === 0
      && !/corretto a mano/.test(intatto.testo) && !intatto.aperto, `scritture ${J(intatto.scritte)} | ${intatto.testo}`);
    // Le conseguenze: il foglio ricaricato col sollecito riscrive scadenza
    // (sezione 3: scadenza_manuale resta com'e').
    const dopo = { id: 'r6', anno: 2026, pdr_nome: 'ROSSI GOMME', esito: 'aperta', scadenza: '2026-10-12', scadenza_manuale: intatto.scritte.length ? intatto.scritte[0][1] : null };
    verifica('ricaricato il foglio col sollecito «entro il 12/10», il 15/10 e\' in ritardo nella pagina e nella dashboard', R.oltreIlTermine(dopo, '2026-10-15')
      && J(oltre([dopo])) === J(['1 richieste del consorzio oltre il termine']), `termine che vale ${R.scadenzaDi(dopo)} ${J(oltre([dopo]))}`);
    const alFoglio = await usa({ id: 'r7', scadenza: '2026-10-31', scadenza_manuale: '2026-11-05' }, '2026-10-31');
    verifica('corretto al 05/11, rimesso il giorno del foglio: si scrive null, non il 31/10', J(alFoglio.scritte) === J([['r7', null]]) && !/corretto a mano/.test(alFoglio.testo), `scritture ${J(alFoglio.scritte)} | ${alFoglio.testo}`);
    const comeGg = await usa({ id: 'r8', scadenza: '2026-10-31', scadenza_manuale: '2026-11-05' }, '31/10/2026');
    verifica('anche scritto come gg/mm/aaaa', J(comeGg.scritte) === J([['r8', null]]), J(comeGg.scritte));
    const raggiunto = await usa({ id: 'r9', scadenza: '2026-11-05', scadenza_manuale: '2026-11-05' });
    verifica('il foglio arrivato al giorno corretto: aperto e salvato senza toccare niente non toglie la correzione', raggiunto.scritte.length === 0
      && /corretto a mano; dal foglio: 05\/11\/2026/.test(raggiunto.testo), `scritture ${J(raggiunto.scritte)} | ${raggiunto.testo}`);
    const senzaTermine = await usa({ id: 'r10' });
    verifica('il foglio senza termine, campo vuoto e salvato: nessuna scrittura', senzaTermine.prima === '' && senzaTermine.scritte.length === 0, J(senzaTermine.scritte));
    const nuovo = await usa({ id: 'r11', scadenza: '2026-10-31' }, '2026-11-02');
    verifica('e un giorno diverso dal foglio si scrive ancora', J(nuovo.scritte) === J([['r11', '2026-11-02']]), J(nuovo.scritte));
  }

  const lettore = p.monta(p.Componente, { richiesta: { id: 'r2', scadenza: '2026-10-31', scadenza_manuale: '2026-11-05', annotazioni: [] }, modificabile: false, scrittore, termine: true, onTermine });
  verifica('chi non e\' amministratore legge il termine corretto, senza pulsante ne\' campo', testoAlbero(lettore.albero).includes('entro il 05/11/2026 (corretto a mano; dal foglio: 31/10/2026)')
    && !trova(lettore.albero, el => el.type === 'button' && /Correggi il termine/.test(testoAlbero(el))).length && !trova(lettore.albero, el => el.type === 'input').length
    && (trova(lettore.albero, el => el.type && el.type.__finto === 'Annotazioni')[0] || { props: {} }).props.accanto === null, testoAlbero(lettore.albero));
  lettore.smonta();
  const senzaFoglio = p.monta(p.Componente, { richiesta: { id: 'r3', scadenza_manuale: '2026-11-05' }, modificabile: false, termine: true });
  verifica('il foglio senza termine: «(corretto a mano; il foglio non ne dice uno)»', testoAlbero(senzaFoglio.albero).includes('entro il 05/11/2026 (corretto a mano; il foglio non ne dice uno)'), testoAlbero(senzaFoglio.albero));
  senzaFoglio.smonta();
  const senzaScrittore = p.monta(p.Componente, { richiesta: { id: 'r4', scadenza: '2026-10-31' }, modificabile: false, scrittore });
  verifica('senza chi scrive il termine (le completate) niente pulsante', !trova(senzaScrittore.albero, el => el.type === 'button' && /Correggi il termine/.test(testoAlbero(el))).length);
  senzaScrittore.smonta();
  const soloTermine = p.monta(p.Componente, { richiesta: { id: 'r5', scadenza: '2026-10-31' }, modificabile: true, termine: true, onTermine });
  verifica('senza chi scrive le annotazioni il pulsante sta su una riga sua', !!trova(soloTermine.albero, el => el.type === 'button' && /Correggi il termine/.test(testoAlbero(el)))[0]);
  soloTermine.smonta();
});

// ---------------------------------------------------------------------------
console.log('7. DISEGNATI CON REACT, E A 375 PX');

const ESTENSIONI = ['', '.js', '.jsx', '.ts'];
const daAlias = (pp) => { const base = qui('../src/' + pp.slice(2)); return ESTENSIONI.map(e => base + e).find(x => existsSync(x) && /\.\w+$/.test(x)) || base; };
let L = null;
await prova('i componenti si impacchettano con React', async () => {
  const comp = (n) => JSON.stringify(qui(`../src/components/todo/${n}`));
  const INGRESSO = `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import RichiesteCompletate from ${comp('RichiesteCompletate.jsx')};
import NoteRichiesta from ${comp('NoteRichiesta.jsx')};
import { ScrittureTodo } from ${comp('scrittureTodo.js')};
const C = { RichiesteCompletate, NoteRichiesta };
export const disegna = (nome, props, scritture = null) => renderToStaticMarkup(React.createElement(ScrittureTodo.Provider, { value: scritture }, React.createElement(C[nome], props)));
`;
  const pacchetto = await build({
    stdin: { contents: INGRESSO, resolveDir: qui('.'), loader: 'js' },
    bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent',
    loader: { '.jsx': 'jsx', '.js': 'jsx' },
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'alias', setup(b) { b.onResolve({ filter: /^@\// }, (a) => ({ path: daAlias(a.path) })); } }],
  });
  L = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
});
const leggiHtml = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ');
await prova('disegnati', () => {
  if (!L) throw new Error('non impacchettati');
  const SCRITTURE = { annota: async () => ({ scritto: false, elenco: [] }), notaInterna: async () => {} };
  const aperta = { id: 'r1', scadenza: '2026-10-31', scadenza_manuale: '2026-11-05', note_interne: 'Chiude il sabato', annotazioni: [] };
  const admin = L.disegna('NoteRichiesta', { richiesta: aperta, modificabile: true, termine: true, onTermine: async () => {} }, SCRITTURE);
  verifica('amministratore, su una richiesta aperta: il termine corretto, «Correggi il termine», la nota e «Aggiungi»', leggiHtml(admin).includes('Termine: entro il 05/11/2026 (corretto a mano; dal foglio: 31/10/2026)')
    && /Correggi il termine/.test(admin) && /Correggi la nota interna/.test(admin) && /Aggiungi un’annotazione/.test(admin), leggiHtml(admin));
  const lettore = L.disegna('NoteRichiesta', { richiesta: aperta, modificabile: false, termine: true }, null);
  verifica('chi legge: il termine corretto e la nota, senza pulsanti', leggiHtml(lettore).includes('entro il 05/11/2026 (corretto a mano; dal foglio: 31/10/2026)') && !/<button/.test(lettore), leggiHtml(lettore));
  const completate = [{ id: 'r2', pdr_nome: 'VERDI AUTO', esito: 'evasa', evasione_rilevata_il: '2026-10-09', ordini_totali: 1, ordini_evasi: 1, mail_inviata_il: '2026-09-22', scadenza: '2026-10-31', scadenza_manuale: '2026-10-20', trasportatore: 'smoco' },
    { id: 'r3', pdr_nome: 'NERI AUTO', esito: 'evasa', evasione_rilevata_il: '2026-10-08', ordini_totali: 1, ordini_evasi: 1, mail_inviata_il: '2026-09-23', scadenza: '2026-10-15' }];
  const rc = L.disegna('RichiesteCompletate', { tutte: completate, righe: completate, esitoDi: (r) => r.esito, isAdmin: true, occupato: null, onSpunta: () => {} }, SCRITTURE);
  verifica('fra le completate il termine che valeva, e corretto a mano lo dice; non si corregge', leggiHtml(rc).includes('Mail del 22/09/2026, entro il 20/10/2026 (corretto a mano; dal foglio: 31/10/2026) · smoco')
    && leggiHtml(rc).includes('Mail del 23/09/2026, entro il 15/10/2026') && !/Correggi il termine/.test(rc), leggiHtml(rc).slice(0, 600));
  verifica('nessuna parola della piattaforma a video', ![admin, lettore, rc].some(x => /base44/i.test(leggiHtml(x))));
});

await prova('a 375 px', () => {
  const s = sorgente('src/components/todo/NoteRichiesta.jsx');
  verifica('NoteRichiesta.jsx: senza larghezze fisse ne\' title= (si legge senza scorrere)', s.length > 0 && !/\b(?:min-)?w-(?:\d{2,}|\[\d+px\])\b|min-w-\[/.test(s) && !/\stitle=/.test(s));
  verifica('NoteRichiesta.jsx: i testi lunghi vanno a capo, anche la riga del termine', /data-termine-a-mano[^>]*>|className="mt-1 break-words[^"]*" data-termine-a-mano/.test(s) && (s.match(/break-words/g) || []).length >= 3);
  const ect = sorgente('src/components/todo/RichiesteEct.jsx');
  verifica('RichiesteEct.jsx: il campo sta nella colonna del produttore, ferma a sinistra a 375 px', /<td className="px-3 py-2 sticky left-0 bg-card">[\s\S]*?<NoteRichiesta richiesta=\{r\} modificabile=\{isAdmin\} termine onTermine=\{isAdmin \? salvaTermine : null\} \/>[\s\S]*?<\/td>/.test(ect));
});

// ---------------------------------------------------------------------------
console.log('8. L\'ARCHIVIO, CHI SCRIVE, LA GUIDA');

await prova('lo schema di RichiestaEct', () => {
  const e = JSON.parse(sorgente('base44/entities/RichiestaEct.jsonc').split('\n').filter(r => !/^\s*\/\//.test(r)).join('\n'));
  const c = e.properties && e.properties.scadenza_manuale;
  verifica('il campo scadenza_manuale c\'e\', ed e\' un giorno', !!c && c.type === 'string' && c.format === 'date', J(c));
  verifica('la descrizione dice che il caricamento non lo tocca e che svuotato torna il foglio', !!c && /importaRichiesteEct/.test(c.description) && /null/.test(c.description) && /15\/10\/2026/.test(c.description));
  verifica('lo scrive solo l\'amministratore (rls)', J(e.rls && e.rls.update) === J({ user_condition: { role: 'admin' } }) && J(e.rls && e.rls.create) === J({ user_condition: { role: 'admin' } }));
  verifica('e la scheda scrive solo per l\'amministratore', /const salvaTermine = useCallback\(async \(r, giorno\) => \{\n\s*if \(!isAdmin \|\| !r\) return;/.test(sorgente('src/components/todo/RichiesteEct.jsx')));
});

await prova('la Guida', async () => {
  const G = await import('../src/lib/guida.js');
  const todo = (G.MODULI || []).find(m => m.percorso === '/todo');
  verifica('nella To-Do List, fra le cose dell\'amministratore: il termine si corregge a mano e il caricamento lo rispetta',
    !!todo && todo.soloAmministratore.some(t => /termine/.test(t) && /a mano/.test(t) && /ricaricando il file di gestione resta/.test(t) && /giorno del foglio/.test(t)), J(todo && todo.soloAmministratore));
  verifica('e fra le cose che si vedono', !!todo && todo.cosaVedi.some(t => /termine/.test(t) && /corretto a mano/.test(t)));
  verifica('senza parole della piattaforma', !!todo && !/base44/i.test(J(todo)));
});

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
