// GLI ANNI PASSATI E I TOTALI SENZA RIGHE DICONO «—» COL PERCHE', IN TUTTE LE
// PAGINE E NEI FILE; E LA PARTE CHIUSA DELL'ATTESA SI VEDE ANCHE NEGLI EXPORT
// (giro del 14/10/2026 sulle decisioni dell'utente del 13/10/2026).
//
// Le risposte di calcolaGiacenze e riepilogoDichiarazioni dicono gia' null col
// perche' per un anno prima del gestionale (il 2025 e il 2024 dei dati veri),
// per un anno chiuso senza la lettura del 31/12 e per il totale di una colonna
// con righe senza numero. Ma le pagine e i file scrivevano ancora 0,00:
// - la testata delle Dichiarazioni, «Rete: giacenza degli impianti 0,00 t» e
//   «salvata dalla chiusura: 0,00 t»;
// - la scheda Impianti, «in giacenza 0,00 t» e «Giacenza di rete che ne
//   risulta: 0,00 t», «Giacenza al 31/12 dell'anno prima: 0,00 t»;
// - il Riepilogo, il totale di «resta in giacenza» 0,00, e sette righe «c'e' un
//   caricamento che qui non e' stato registrato» per un anno mai aperto qui;
// - il dialogo del mese, «restano in giacenza 0 kg»;
// - la KPI delle Giacenze, «aggiornata a ogni caricamento» sotto un «—»;
// - il PDF della Situazione, celle vuote senza un perche';
// - il foglio Excel, 0 nel TOTALE di ACI ed extra raccolta e nelle classi.
// E la parte dell'attesa che per noi e' chiusa (T-Cycle verso Tecnogum) la
// diceva solo la pagina: non il PDF, non il foglio, non l'elenco «Da dichiarare»
// aperto dal pulsante dello stoccaggio.
//
// Qui si prova, sulle funzioni vere e sulle pagine vere:
// 1. un archivio costruito: il 2025 prima del gestionale, il 2026 di oggi con
//    l'attesa di T-Cycle chiusa, il 2026 guardato il 05/01/2027;
// 2. ogni pagina e ogni file su quelle risposte: «—» e il perche', mai 0,00;
//    l'anno in corso come prima;
// 3. sui dati veri (../dati-veri/, se c'e'): il 2025 e il 2024 senza uno 0,00
//    dove la risposta dice null, il 2026 coi numeri di sempre.
// La base e' lo script del revisore del gruppo D-K (pagineNullZero.mjs), che
// valutava le espressioni delle pagine a mano: qui girano le pagine.
// npm run prove
import { build } from 'esbuild';
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { caricaPagina, clienteFinto, aspetta, trova, testo } from './dati/paginaFinta.mjs';
import { caricaLibPagine } from './dati/libPagine.mjs';
import { normalizzaRagioneSociale as norm } from '../base44/shared/normalizzaRagioneSociale.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
if (typeof globalThis.window === 'undefined') globalThis.window = { self: 1, top: 1, addEventListener() {}, removeEventListener() {} };

// --- Le funzioni vere, con un SDK finto: uguaglianza, $in, $gte, $lte, null ---
const ARCHIVI = {};
globalThis.__ARCHIVI_ANNI_PASSATI = ARCHIVI;
const SDK_FINTO = `
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    if ('$in' in v) return v.$in.includes(r[k]);
    if ('$nin' in v && v.$nin.includes(r[k])) return false;
    if ('$gte' in v && !(r[k] != null && String(r[k]) >= String(v.$gte))) return false;
    if ('$lte' in v && !(r[k] != null && String(r[k]) <= String(v.$lte))) return false;
    if ('$gt' in v && !(r[k] != null && String(r[k]) > String(v.$gt))) return false;
    if ('$lt' in v && !(r[k] != null && String(r[k]) < String(v.$lt))) return false;
    if ('$ne' in v && r[k] === v.$ne) return false;
    return true;
  }
  if (v === null) return r[k] === null || r[k] === undefined || r[k] === '';
  return r[k] === v;
});
const ordina = (righe, sort) => {
  const campo = String(sort || 'id').replace(/^[-+]/, '');
  const giu = String(sort || '').startsWith('-');
  return [...righe].sort((a, b) => {
    const x = a[campo], y = b[campo];
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
    return giu ? -c : c;
  });
};
const entita = (nome) => ({
  list: async (sort, lim = 1e9, skip = 0) => ordina(globalThis.__ARCHIVI_ANNI_PASSATI[nome] || [], sort).slice(skip, skip + lim),
  filter: async (f, sort, lim = 1e9, skip = 0) => ordina((globalThis.__ARCHIVI_ANNI_PASSATI[nome] || []).filter(r => soddisfa(r, f)), sort).slice(skip, skip + lim),
  get: async (id) => (globalThis.__ARCHIVI_ANNI_PASSATI[nome] || []).find(r => r.id === id) || null,
  create: async (r) => r, update: async (_id, r) => r, delete: async () => ({}),
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: 'admin', email: 'prova' }) }, asServiceRole: { entities }, entities,
    functions: { invoke: async (n) => { throw new Error('non chiama altre funzioni: ' + n); } } };
}`;
const funzione = async (nome) => {
  const pacchetto = await build({
    entryPoints: [qui(`../base44/functions/${nome}/entry.ts`)],
    bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
    plugins: [{ name: 'sdk-finto', setup(b) {
      b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
      b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
    } }],
  });
  const modulo = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
  return async (corpo) => (await modulo.default({ json: async () => corpo })).json();
};
const OraVera = Date;
const conOra = async (iso, f) => {
  const ms = OraVera.parse(iso);
  globalThis.Date = class extends OraVera { constructor(...a) { if (a.length) super(...a); else super(ms); } static now() { return ms; } };
  try { return await f(); } finally { globalThis.Date = OraVera; }
};
let seq = 0;
const VUOTI = ['DichiarazioneTrattamento', 'Terziaria', 'ImpiantoTargetSecondaria', 'TargetRaccoglitore', 'TargetMensile',
  'GiacenzaStoccaggio', 'IndicatoreGiorno', 'PrimariaAci', 'ExtraRaccolta', 'Secondaria', 'OrdineNonDichiarato',
  'DichiarazioneSito', 'GiacenzaSito', 'PrimariaRete', 'CommessaEcotyre', 'RegistroCaricamento', 'StatoArchivio', 'UploadLog'];
const con = (nome, righe) => { ARCHIVI[nome] = righe.map(r => ({ id: 'r' + String(++seq).padStart(5, '0'), ...r })); };
const g = (giorno) => `${giorno}T08:00:00Z`;
const movimento = (id, dest, kg, giorno, extra = {}) => ({
  id_ordine: id, numero_fir: 'FIR' + id, classe: 'P - fino a 35 kg', prodotto: '.class1', destinazione: dest,
  tipo_destinazione: 'imp', stato: 'terminato', peso_effettivo: kg, trasportatore: 'RACCOLTA SRL', provincia: 'NA',
  ordine_immesso_il: g(giorno), trasporto_iniziato_il: g(giorno), trasporto_finito_il: g(giorno), ordine_chiuso_il: g(giorno), ...extra,
});
const nelFile = (ordine, dest, kg, fine) => ({ ordine_primaria: ordine, destinazione: dest, prodotto: '.class1', peso_non_dichiarato_kg: kg, created_date: '2026-10-05T06:00:00Z', fine_trasporto: fine });
const IRI = 'IRIGOM SRL', ALFA = 'ALFA RECYCLING SRL', TEC = 'TECNOGUM SRL', TCY = 'T-CYCLE INDUSTRIES SRL', NAP = 'NAPPI SUD SRL';
const OGGI = '2026-10-11T10:00:00Z';
const GENNAIO = '2027-01-05T10:00:00Z';
// L'archivio: il gestionale nasce nel 2026 (nessuna GiacenzaSito del 2025), quindi
// il 2025 e' prima del gestionale. Nel 2026 Irigom e Alfa dichiarano la rete,
// Tecnogum no; T-Cycle e' impianto e stoccaggio, e lo stoccaggio manda tutto a
// Tecnogum: le sue 20 t in attesa sono per noi chiuse. Nappi Sud e' un piazzale
// con la lettura del 31/12/2025.
const archivio = () => {
  for (const k of Object.keys(ARCHIVI)) delete ARCHIVI[k];
  for (const v of VUOTI) ARCHIVI[v] = [];
  con('GiacenzaSito', [
    { sito: IRI, tipo_destinazione: 'imp', anno: 2026, dichiara_rete: true },
    { sito: ALFA, tipo_destinazione: 'imp', anno: 2026, dichiara_rete: true },
    { sito: TEC, tipo_destinazione: 'imp', anno: 2026, dichiara_rete: false },
    { sito: TCY, tipo_destinazione: 'imp', anno: 2026, dichiara_rete: true },
    { sito: TCY, tipo_destinazione: 'stoc', anno: 2026 },
    { sito: NAP, tipo_destinazione: 'stoc', anno: 2026 },
  ]);
  const lettura = (sito, kg) => ({ sito, data_rilevazione: '2025-12-31', class1_kg: kg, class2_kg: 0, class3_kg: 0, class4_kg: 0, class9_kg: 0, created_date: '2026-01-02T09:00:00Z' });
  con('GiacenzaStoccaggio', [lettura(NAP, 20000), lettura(TCY, 0)]);
  con('PrimariaRete', [
    movimento('ET25IRI03', IRI, 40000, '2025-03-10'),
    movimento('ET25ALFA05', ALFA, 10000, '2025-05-10'),
    movimento('ET26IRI03', IRI, 30000, '2026-03-10'),
    movimento('ET26ALFA04', ALFA, 10000, '2026-04-10'),
    movimento('ET26TEC05', TEC, 15000, '2026-05-10'),
    movimento('ET26NAP06', NAP, 5000, '2026-06-10', { tipo_destinazione: 'stoc' }),
    movimento('ET26TCYS01', TCY, 10000, '2026-01-10', { tipo_destinazione: 'stoc' }),
    movimento('ET26TCYS02', TCY, 10000, '2026-02-10', { tipo_destinazione: 'stoc' }),
  ]);
  con('Secondaria', [movimento('SEC26TCY02', TEC, 20000, '2026-02-15', { stoccaggio: TCY })]);
  // Il report del portale: il carico di Irigom del 2025 dichiarato a giugno 2025.
  // E' un dato anche prima del gestionale: la riga del Riepilogo c'e', in verde.
  con('DichiarazioneTrattamento', [{ ordine_primaria: 'ET25IRI03', prodotto: '.class1', partner_operativo: 'SMOCO S.r.l.', destinazione: IRI, data_dichiarazione: '2025-06-10', fine_trasporto: '2025-03-10', peso_associato_kg: 40000, id_dichiarazione: 'D1' }]);
  con('OrdineNonDichiarato', [
    nelFile('ET26IRI03', IRI, 30000, '2026-03-10'), nelFile('ET26ALFA04', ALFA, 10000, '2026-04-10'), nelFile('ET26NAP06', NAP, 5000, '2026-06-10'),
    nelFile('ET26TCYS01', TCY, 10000, '2026-01-10'), nelFile('ET26TCYS02', TCY, 10000, '2026-02-10'),
  ]);
};
const giacenze = await funzione('calcolaGiacenze');
const riepilogo = await funzione('riepilogoDichiarazioni');
const due = async (anno, ora) => ({ G: await conOra(ora, () => giacenze({ anno })), R: await conOra(ora, () => riepilogo({ anno })) });

console.log('1. LE RISPOSTE, SU UN ARCHIVIO COSTRUITO');
archivio();
const P = await due(2025, OGGI);   // prima del gestionale
const C = await due(2026, OGGI);   // l'anno in corso
const Gen = await due(2026, GENNAIO); // il 2026 chiuso, senza la lettura del 31/12
const PERCHE_ANNO = P.R.perche_prima_del_gestionale;
const impR = (R, sito) => (R.siti || []).find(s => s.tipo_destinazione !== 'stoc' && norm(s.sito) === norm(sito));
const stocG = (G, sito) => (G.righe || []).find(r => r.tipo_destinazione === 'stoc' && norm(r.sito) === norm(sito)) || {};
{
  verifica('il 2025 e\' prima del gestionale, nei due moduli, col perche\'', P.R.prima_del_gestionale === true && P.G.totali.prima_del_gestionale === true && /^Il 2025 e' prima del gestionale/.test(PERCHE_ANNO || ''), J([P.R.prima_del_gestionale, P.G.totali.prima_del_gestionale]));
  const iri = impR(P.R, IRI);
  verifica('e la risposta dice null, non 0: totale, giacenza di Irigom, quello che resta', P.R.totali.giacenza_calcolata_t === null && iri && iri.giacenza_calcolata_t === null && iri.flussi.some(f => f.resta_t === null), J([P.R.totali.giacenza_calcolata_t, iri && iri.giacenza_calcolata_t]));
  verifica('il 2026 guardato il 05/01/2027: il totale a portale e\' null, col perche\'', Gen.R.anno_chiuso === true && Gen.R.totali.giacenza_portale_t === null && !!(Gen.R.totali.perche_totali && Gen.R.totali.perche_totali.RETE) && Gen.G.totali.giacenza_portale_t === null, J(Gen.R.totali.perche_totali));
  const tcy = stocG(C.G, TCY);
  verifica('il 2026 di oggi: lo stoccaggio di T-Cycle ha 20 t in attesa, tutte per noi chiuse', tcy.in_attesa_dichiarazione_t === 20 && tcy.in_attesa_chiusa_t === 20 && /TECNOGUM SRL sulla rete non dichiara a SMOCO/.test(tcy.in_attesa_chiusa_perche || ''), J([tcy.in_attesa_dichiarazione_t, tcy.in_attesa_chiusa_t]));
  verifica('e i totali dell\'anno in corso sono numeri', typeof C.R.totali.giacenza_calcolata_t === 'number' && typeof C.R.totali.giacenza_portale_t === 'number' && typeof C.G.totali.giacenza_portale_t === 'number');
}

// --- Le pagine: react-dom/server coi componenti veri e gli alias di Vite ---
const ESTENSIONI = ['', '.js', '.jsx', '.ts'];
const daAlias = (p) => { const base = qui('../src/' + p.slice(2)); return ESTENSIONI.map(e => base + e).find(f => existsSync(f) && /\.\w+$/.test(f)) || base; };
const pacchetti = {};
const html = async (componente, props) => {
  try {
    if (!pacchetti[componente]) {
      const pacchetto = await build({
        stdin: { contents: `import React from 'react'; import { renderToStaticMarkup } from 'react-dom/server.browser'; import M from ${J(qui('../src/components/' + componente))}; export const disegna = (p) => renderToStaticMarkup(React.createElement(M, p));`, resolveDir: qui('.'), loader: 'js' },
        bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent', loader: { '.jsx': 'jsx', '.js': 'jsx' }, define: { 'process.env.NODE_ENV': '"production"' },
        plugins: [{ name: 'alias', setup(b) { b.onResolve({ filter: /^@\// }, (args) => ({ path: daAlias(args.path) })); } }],
      });
      pacchetti[componente] = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
    }
    return pacchetti[componente].disegna(props).replace(/&#x27;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"');
  } catch (e) { return `ERRORE ${String(e && e.message).slice(0, 300)}`; }
};
const leggibile = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const titoli = (h) => [...h.matchAll(/title="([^"]*)"/g)].map(x => x[1]);

// La pagina delle Dichiarazioni gira davvero (prove/dati/paginaFinta.mjs), con
// una copia del sorgente in cui solo i permessi sono sostituiti: il contesto
// dell'autenticazione la pagina finta non ce l'ha.
const IMPORT_PERMESSI = "import { usePermessi } from '@/lib/permessi';";
const sorgentePagina = readFileSync(qui('../src/pages/DichiarazioniImpianti.jsx'), 'utf8').replace(/\r/g, '');
verifica('la pagina prende i permessi da usePermessi, come la copia si aspetta', sorgentePagina.includes(IMPORT_PERMESSI));
const copiaPagina = join(mkdtempSync(join(tmpdir(), 'anni-passati-')), 'DichiarazioniImpianti.jsx');
writeFileSync(copiaPagina, sorgentePagina.replace(IMPORT_PERMESSI, "const usePermessi = () => ({ isAdmin: true, soloLettura: false });"));
const paginaDichiarazioni = await caricaPagina('pages/DichiarazioniImpianti', { file: copiaPagina });
const testata = async (R) => {
  const c = clienteFinto({ funzioni: { riepilogoDichiarazioni: async () => R } });
  globalThis.__CLIENTE_FINTO = c.cliente;
  const m = paginaDichiarazioni.monta(paginaDichiarazioni.Componente, {});
  await aspetta(40);
  const kpi = Object.fromEntries(trova(m.albero, el => el.type && el.type.name === 'Kpi').map(el => [el.props.titolo.replace(/ con .*$/, ''), el.props]));
  const riquadri = trova(m.albero, el => el.type === 'p' && /bg-muted\/40/.test(el.props.className || '')).map(el => testo(el));
  const errori = m.errori.map(String);
  m.smonta();
  return { kpi, riquadri, errori };
};
const dialogo = await caricaPagina('components/dichiarazioni/DialogoMese');
const descrizioneDelMese = async (sito, flusso, mese, anno) => {
  globalThis.__CLIENTE_FINTO = clienteFinto({}).cliente;
  const m = dialogo.monta(dialogo.Componente, { sito, flusso, mese, anno, onChiudi: () => {}, onSalvato: () => {} });
  await aspetta(20);
  const d = trova(m.albero, el => el.type && el.type.__finto === 'DialogDescription')[0];
  const fuori = { testo: testo(d).replace(/\s+/g, ' '), titoli: trova(d, el => el.props && el.props.title).map(el => el.props.title), errori: m.errori.map(String) };
  m.smonta();
  return fuori;
};
const pdf = await caricaLibPagine('lib/giacenzePdf');
const FOGLI = {};
globalThis.__FOGLI_ANNI_PASSATI = FOGLI;
const excel = await caricaLibPagine('lib/giacenzeExportAll', [
  ["import { documentoDa, nuovaCartella, foglioDaRighe, scaricaCartella, FORMATI } from '@/lib/fogliProfessionali';",
    "const documentoDa = async () => ({}); const nuovaCartella = async () => ({ wb: {} }); const foglioDaRighe = (_wb, nome, o) => { globalThis.__FOGLI_ANNI_PASSATI[nome] = { righe: o.righe, stili: o.stili || {} }; }; const scaricaCartella = (_wb, nome) => nome; const FORMATI = {};"],
  ["import { testoFormulario, testoCollocato } from '@/lib/giacenzeDaDichiarareExport';", "const testoFormulario = () => ''; const testoCollocato = () => '';"],
  ["import { INTESTAZIONE_DATE, righeExcelDate } from '@/components/giacenze/DateDaSistemare';", "const INTESTAZIONE_DATE = ['Data']; const righeExcelDate = () => [];"],
]);
const situazioneExcel = async (G) => {
  await excel.exportGiacenzeAllExcel(G, { righe: [], totale_kg: 0 }, G.anno);
  const { righe, stili } = FOGLI.Situazione;
  const testa = righe[0];
  const iTot = righe.findIndex(r => r[0] === 'TOTALE');
  const note = righe.map((r, i) => (stili[i] === 'nota' ? r[0] : null)).filter(Boolean);
  return { testa, righe, totale: righe[iTot] || [], note, col: (nome) => testa.findIndex(h => h === nome || (nome instanceof RegExp && nome.test(h))) };
};
// Dove si scrive la giacenza, nella scheda Impianti: le righe che non devono mai dire 0,00 se la risposta dice null.
const RIGHE_GIACENZA_SEZIONE = /in giacenza [^,—]*0,00 t|Giacenza di rete che ne risulta: 0,00 t|Giacenza al 31\/12 dell'anno prima: 0,00 t/;

console.log('2. LE PAGINE E I FILE: UN ANNO PRIMA DEL GESTIONALE');
{
  const iri = impR(P.R, IRI);
  const sez = await html('dichiarazioni/SezioneImpianto.jsx', { sito: iri, onApri: () => {}, soloLettura: true });
  const t = leggibile(sez);
  verifica('scheda Impianti: nessuna giacenza 0,00 dove la risposta dice null', !RIGHE_GIACENZA_SEZIONE.test(t) && !/^ERRORE/.test(sez), (t.match(RIGHE_GIACENZA_SEZIONE) || [sez.slice(0, 200)])[0]);
  verifica('«in giacenza —», «Giacenza di rete che ne risulta: —», «Giacenza al 31/12 dell\'anno prima: —»',
    /in giacenza —/.test(t) && /Giacenza di rete che ne risulta: — /.test(t) && /Giacenza al 31\/12 dell'anno prima: — /.test(t), t.slice(0, 600));
  verifica('e al passaggio del mouse il perche\' dell\'anno', titoli(sez).filter(x => x === PERCHE_ANNO).length >= 3, String(titoli(sez).filter(x => x === PERCHE_ANNO).length));
  verifica('a portale: «— (prima del gestionale)», non «non salvata dalla chiusura»', /lettura del 31\/12: — \(prima del gestionale\)/.test(t) && !/non salvata dalla chiusura/.test(t), (t.match(/lettura del 31\/12:.{0,40}/) || [])[0]);
  verifica('i mesi senza una dichiarazione scritta qui non sono «da chiedere», e il dichiarato non e\' 0,00', /prima del gestionale/.test(t) && !/da chiedere/.test(t) && !/dichiarati e caricati 0,00 t/.test(t) && !/Dichiarato e caricato, rete: 0,00 t/.test(t), (t.match(/dichiarati e caricati.{0,30}/) || [])[0]);

  const rp = await html('dichiarazioni/Riepilogo.jsx', { dati: P.R, onApri: () => {}, soloLettura: true });
  const tr = leggibile(rp);
  const resta = (tr.match(/resta in giacenza (.*?) giacenza a fine mese/) || [])[1] || '';
  verifica('Riepilogo: la riga «resta in giacenza» non somma a 0,00', resta !== '' && !/0,00/.test(resta) && /—/.test(resta), resta);
  verifica('Riepilogo: niente «c\'e\' un caricamento che qui non e\' stato registrato» per un anno mai aperto qui, e il perche\' una volta',
    !/caricamento che qui non è stato registrato/.test(tr) && /Il 2025 è prima del gestionale: le sue dichiarazioni non sono scritte qui/.test(tr), (tr.match(/.{0,80}caricamento che qui.{0,20}/) || [])[0]);
  verifica('Riepilogo: le caselle «Caricato» e «Da dichiarare» sono «—» col perche\'', titoli(rp).filter(x => x === PERCHE_ANNO).length >= 3 && !/Caricato \(t\) Da dichiarare \(t\).{0,400}0,00/.test(tr.replace(/conferito nel mese.*$/, '')), String(titoli(rp).filter(x => x === PERCHE_ANNO).length));

  const f = iri.flussi.find(x => x.canale === 'RETE');
  const mese = f.mesi.find(m => m.conferito_kg > 0);
  const d = await descrizioneDelMese(iri, f, mese, 2025);
  verifica('il dialogo del mese: «restano in giacenza —», non «0 kg», col perche\'', /restano in giacenza —/.test(d.testo) && !/restano in giacenza 0 kg/.test(d.testo) && d.titoli.includes(PERCHE_ANNO) && !d.errori.length, d.testo.slice(-200));

  const p = await testata(P.R);
  const giac = p.kpi['Rete: giacenza degli impianti'] || {};
  verifica('testata: «Rete: giacenza degli impianti» dice «—», non «0,00 t», col perche\'', giac.valore === '—' && giac.perche === PERCHE_ANNO && !/0,00/.test(giac.nota || '') && !p.errori.length, J([giac.valore, giac.nota, p.errori]));
  const quad = p.kpi['Rete: quadratura'] || {};
  verifica('testata: la quadratura non dice «0 su 0» in verde', quad.valore === '—' && quad.tono === undefined && quad.perche === PERCHE_ANNO, J([quad.valore, quad.tono]));
  const dich = p.kpi['Rete: dichiarato e caricato a portale'] || {};
  verifica('testata: il dichiarato non e\' «0,00 t caricate»: «—», e quanto ne riporta il report', dich.valore === '—' && /il report del portale ne riporta/.test(dich.nota || ''), J([dich.valore, dich.nota]));
  verifica('sopra le schede, il perche\' dell\'anno', p.riquadri.includes(PERCHE_ANNO), J(p.riquadri));

  const kpi = await html('giacenze/GiacenzeKpi.jsx', { totali: P.G.totali });
  verifica('Giacenze, KPI: sotto il «—» non c\'e\' piu\' «aggiornata a ogni caricamento», e c\'e\' il perche\'',
    !/aggiornata a ogni caricamento/.test(leggibile(kpi)) && /prima del gestionale/.test(leggibile(kpi)) && titoli(kpi).includes(P.G.totali.perche_prima_del_gestionale), leggibile(kpi).slice(0, 200));

  const sp = pdf.situazionePdf(2025, P.G.righe, P.G.totali);
  const rie = Object.fromEntries(sp.riepilogo.map(r => [r.etichetta, r.valore]));
  verifica('PDF: nel riepilogo «—», non una cella vuota', rie['Giacenza rete a portale'] === '—' && rie['Giacenza ACI'] === '—', J(sp.riepilogo));
  const rigaIri = (sp.sezioni[0].righe.find(r => norm(r.celle[0]) === norm(IRI) && r.celle[1] === 'Impianto') || {}).celle || [];
  verifica('PDF: la riga di Irigom «—» nella giacenza e nelle classi', rigaIri[2] === '—' && rigaIri.slice(3, 8).every(x => x === '—'), J(rigaIri));
  verifica('PDF: in testa «prima del gestionale», e il perche\' intero e\' la prima nota', /prima del gestionale/.test(sp.sottotitolo) && sp.note[0].includes(PERCHE_ANNO), J([sp.sottotitolo, sp.note[0]]));

  const x = await situazioneExcel(P.G);
  const iAci = x.col('Giacenza ACI (t)'), iExtra = x.col('Extra raccolta in piazzale, fuori portale (t)'), iRete = x.col('Giacenza rete a portale (t)');
  verifica('Excel: il TOTALE di ACI ed extra raccolta non e\' 0 dove le Giacenze dicono null', x.totale[iAci] !== 0 && x.totale[iExtra] !== 0 && (x.totale[iAci] === '' || x.totale[iAci] === null), J([x.totale[iRete], x.totale[iAci], x.totale[iExtra]]));
  verifica('Excel: e nemmeno le classi del TOTALE (P, M, G1, G2, ACI in kg)', x.totale.slice(iExtra + 1, iExtra + 6).every(v => v === null || v === ''), J(x.totale.slice(iExtra + 1, iExtra + 6)));
  verifica('Excel: sotto la tabella le note dicono perche\'', x.note.length >= 2 && x.note[0].includes(PERCHE_ANNO) && x.note.some(n => n.includes(IRI)), J(x.note.map(n => n.slice(0, 60))));
}

console.log('3. IL 2026 GUARDATO IL 05/01/2027, PRIMA DELLA CHIUSURA');
{
  const perche = Gen.R.totali.perche_totali.RETE;
  const p = await testata(Gen.R);
  const giac = p.kpi['Rete: giacenza degli impianti'] || {};
  verifica('testata: la calcolata c\'e\', «a portale ... : —» e non «0,00 t», col perche\' del totale', typeof Gen.R.totali.giacenza_calcolata_t === 'number' && /salvata dalla chiusura: —$/.test(giac.nota || '') && giac.percheNota === perche, J([giac.valore, giac.nota]));
  verifica('sopra le schede, «Totale Rete a portale: —.» con le parole della Quadratura', p.riquadri.some(x => x === `Totale Rete a portale: —. ${perche}`), J(p.riquadri));
  const kpi = await html('giacenze/GiacenzeKpi.jsx', { totali: Gen.G.totali });
  verifica('Giacenze, KPI: «il totale non si fa», col perche\' del totale al passaggio del mouse', /il totale non si fa/.test(leggibile(kpi)) && titoli(kpi).includes(Gen.G.totali.perche_totali.RETE), leggibile(kpi).slice(0, 200));
  // L'ACI che c'e' non sparisce quando la rete non c'e' (revisione del
  // 14/10/2026): qui l'archivio non ha ACI, quindi la si mette nei totali con
  // il numero del 04/10/2026 (26,81 t, Gatim e Tecnogum). Prima del ritocco la
  // casella diceva solo «il totale non si fa»; prima del giro, solo l'ACI.
  const casellaRete = (h) => (leggibile(h).match(/Giacenza rete a portale .*?(?= Ordini da dichiarare)/) || [''])[0];
  const conAci = await html('giacenze/GiacenzeKpi.jsx', { totali: { ...Gen.G.totali, giacenza_aci_t: 26.81 } });
  verifica('Giacenze, KPI: rete «—» col perche\' e l\'ACI che c\'e\' ancora in testa, a parte', /il totale non si fa: una riga senza numero non vale zero · ACI 26,81 t, a parte/.test(casellaRete(conAci)) && titoli(conAci).includes(Gen.G.totali.perche_totali.RETE), J(casellaRete(conAci)));
  // E se manca anche il totale ACI, col suo perche': «ACI —», e al passaggio
  // del mouse tutti e due i perche', ognuno col suo canale.
  const senzaAci = await html('giacenze/GiacenzeKpi.jsx', { totali: { ...Gen.G.totali, giacenza_aci_t: null, perche_totali: { ...Gen.G.totali.perche_totali, ACI: 'Manca la giacenza ACI di GATIM SRL.' } } });
  verifica('Giacenze, KPI: rete e ACI senza totale, «· ACI —, a parte» e i due perche\'', /il totale non si fa: una riga senza numero non vale zero · ACI —, a parte/.test(casellaRete(senzaAci)) && titoli(senzaAci).includes(`${Gen.G.totali.perche_totali.RETE} ACI: Manca la giacenza ACI di GATIM SRL.`), J([casellaRete(senzaAci), titoli(senzaAci)]));
  const sp = pdf.situazionePdf(2026, Gen.G.righe, Gen.G.totali);
  verifica('PDF: la rete del riepilogo e\' «—», e la nota dice il totale e il perche\'', sp.riepilogo[0].valore === '—' && sp.note.some(n => n === `Totale rete: —. ${Gen.G.totali.perche_totali.RETE}`), J(sp.note.map(n => n.slice(0, 50))));
  const x = await situazioneExcel(Gen.G);
  verifica('Excel: il TOTALE della rete resta vuoto, e la nota lo dice', (x.totale[x.col('Giacenza rete a portale (t)')] === '' || x.totale[x.col('Giacenza rete a portale (t)')] === null) && x.note.some(n => n === `Totale rete: —. ${Gen.G.totali.perche_totali.RETE}`), J(x.note.map(n => n.slice(0, 50))));
  // Ogni classe segue il totale del suo canale: senza il totale di rete le
  // classi P, M, G1, G2 sommate sulle sole righe col numero non sono un totale;
  // la classe ACI segue l'ACI, che qui il totale ce l'ha.
  const iP = x.col('P (kg)'), iAciKg = x.col('ACI (kg)');
  verifica('Excel: le classi di rete del TOTALE vuote, la classe ACI col totale ACI',
    typeof Gen.G.totali.giacenza_aci_t === 'number' && x.totale.slice(iP, iAciKg).every(v => v === null || v === '') && x.totale[iAciKg] === (Gen.G.totali.giacenza_classi_kg.ACI || 0),
    J([Gen.G.totali.giacenza_aci_t, x.totale.slice(iP, iAciKg + 1)]));
}

console.log("4. L'ANNO IN CORSO: I NUMERI DI PRIMA, E L'ATTESA PER NOI CHIUSA ANCHE NEI FILE");
{
  const p = await testata(C.R);
  const giac = p.kpi['Rete: giacenza degli impianti'] || {};
  // Il formato delle pagine, impacchettato com'e' (utils.js importa clsx).
  const u = await build({ entryPoints: [qui('../src/lib/utils.js')], bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent' });
  const { formatTonnellate } = await import('data:text/javascript;base64,' + Buffer.from(u.outputFiles[0].text).toString('base64'));
  const atteso = (v) => `${formatTonnellate(v)} t`;
  verifica('testata: la giacenza col numero, «a portale, aggiornata ai caricamenti», senza perche\'', giac.valore === atteso(C.R.totali.giacenza_calcolata_t) && /^a portale, aggiornata ai caricamenti: /.test(giac.nota) && !giac.perche && !giac.percheNota, J([giac.valore, giac.nota, giac.perche, giac.percheNota]));
  const quad = p.kpi['Rete: quadratura'] || {};
  verifica('testata: la quadratura «X su Y» come prima, e nessun riquadro sopra le schede', / su /.test(quad.valore) && !quad.perche && p.riquadri.length === 0, J([quad.valore, p.riquadri]));
  for (const s of C.R.siti.filter(x => x.tipo_destinazione !== 'stoc')) {
    const t = leggibile(await html('dichiarazioni/SezioneImpianto.jsx', { sito: s, onApri: () => {}, soloLettura: true }));
    verifica(`scheda Impianti, ${s.sito}: nessuna parola nuova sull'anno in corso`, !/prima del gestionale|non si ricostruisce/.test(t), t.slice(0, 200));
  }
  const kpi = await html('giacenze/GiacenzeKpi.jsx', { totali: C.G.totali });
  verifica('Giacenze, KPI: «aggiornata a ogni caricamento», senza perche\'', /aggiornata a ogni caricamento/.test(leggibile(kpi)) && !/cursor-help/.test(kpi), leggibile(kpi).slice(0, 120));

  const sp = pdf.situazionePdf(2026, C.G.righe, C.G.totali);
  const chiusaBox = sp.riepilogo.find(r => r.etichetta === 'di cui per noi chiuse');
  const iAttesa = sp.riepilogo.findIndex(r => /^In attesa/.test(r.etichetta));
  verifica('PDF: «di cui per noi chiuse» accanto all\'attesa, 20 t', chiusaBox && chiusaBox.valore === 20 && sp.riepilogo[iAttesa + 1] === chiusaBox, J(sp.riepilogo));
  const iCol = sp.sezioni[0].colonne.findIndex(c => c.titolo === 'Attesa per noi chiusa');
  const rigaTcy = (sp.sezioni[0].righe.find(r => norm(r.celle[0]) === norm(TCY) && r.celle[1] === 'Stoccaggio') || {}).celle || [];
  verifica('PDF: la colonna «Attesa per noi chiusa», 20 t sulla riga dello stoccaggio di T-Cycle', iCol > 0 && rigaTcy[iCol] === 20, J([iCol, rigaTcy]));
  verifica('PDF: la nota dice perche\' sono chiuse', sp.note.some(n => /T-CYCLE INDUSTRIES SRL \(piazzale\).*TECNOGUM SRL sulla rete non dichiara a SMOCO/.test(n)), J(sp.note.map(n => n.slice(0, 70))));
  verifica('PDF: nessuna nota sui «—» sull\'anno in corso coi numeri', !sp.note.some(n => /«—»|: —\./.test(n)), J(sp.note.map(n => n.slice(0, 50))));
  verifica('PDF: le giacenze delle righe sono i numeri della risposta', sp.sezioni[0].righe.every((r, i) => r.celle[2] === C.G.righe[i].giacenza_portale_t || (r.celle[2] == null && C.G.righe[i].giacenza_portale_t == null)));

  const x = await situazioneExcel(C.G);
  const iChiusa = x.col('Attesa per noi chiusa (t)'), iAtt = x.col(/^In attesa di dichiarazione/);
  const tcy = x.righe.find(r => norm(r[0]) === norm(TCY) && r[1] === 'Stoccaggio') || [];
  verifica('Excel: la colonna «Attesa per noi chiusa (t)», dopo gli ordini da dichiarare che seguono l\'attesa', iChiusa === iAtt + 2 && x.testa[iAtt + 1] === 'Ordini da dichiarare', J(x.testa));
  verifica('Excel: 20 t sullo stoccaggio di T-Cycle e nel TOTALE', tcy[iChiusa] === 20 && x.totale[iChiusa] === 20, J([tcy[iChiusa], x.totale[iChiusa]]));
  verifica('Excel: il TOTALE delle giacenze e\' quello della risposta, coi tre canali a parte', x.totale[x.col('Giacenza rete a portale (t)')] === C.G.totali.giacenza_portale_t && x.totale[x.col('Giacenza ACI (t)')] === C.G.totali.giacenza_aci_t && x.totale[x.col('Extra raccolta in piazzale, fuori portale (t)')] === C.G.totali.giacenza_extra_t, J(x.totale));
  verifica('Excel: una nota sola, quella dell\'attesa chiusa', x.note.length === 1 && /TECNOGUM SRL sulla rete non dichiara a SMOCO/.test(x.note[0]), J(x.note));
}

console.log("5. L'ELENCO «DA DICHIARARE» DAL PULSANTE DELLO STOCCAGGIO");
{
  const tabella = await caricaPagina('components/giacenze/DaDichiarareTable');
  const c = clienteFinto({ funzioni: { getOrdiniDaDichiarare: async () => ({ righe: [], totale_righe: 2, totale_kg: 20000, per_mese: [], siti_distinti: [], province_distinte: [], anni_distinti: [] }) } });
  globalThis.__CLIENTE_FINTO = c.cliente;
  const apri = async (props) => {
    c.azzera();
    const m = tabella.monta(tabella.Componente, { onPulisciFiltroSito: () => {}, ...props });
    await aspetta(20);
    const fuori = { testo: testo(m.albero).replace(/\s+/g, ' '), chiamate: c.funzioniChiamate().length, errori: m.errori.map(String) };
    m.smonta();
    return fuori;
  };
  const tcy = await apri({ filtroSitoEsterno: stocG(C.G, TCY).sito, filtroRuoloEsterno: 'stoc', righeGiacenze: C.G.righe });
  verifica('dallo stoccaggio di T-Cycle: «Per noi chiusi: TECNOGUM SRL sulla rete non dichiara a SMOCO»', tcy.testo.includes('Per noi chiusi: TECNOGUM SRL sulla rete non dichiara a SMOCO.') && !/li dichiara lui/.test(tcy.testo) && !tcy.errori.length, tcy.testo.slice(0, 400));
  verifica('senza letture in piu\': una chiamata, come prima', tcy.chiamate === 1, String(tcy.chiamate));
  const nap = await apri({ filtroSitoEsterno: stocG(C.G, NAP).sito, filtroRuoloEsterno: 'stoc', righeGiacenze: C.G.righe });
  verifica('da Nappi Sud, che non e\' chiuso: l\'elenco di prima', !/Per noi chiusi/.test(nap.testo) && /li dichiara lui/.test(nap.testo), nap.testo.slice(0, 300));
  const senza = await apri({ filtroSitoEsterno: stocG(C.G, TCY).sito, filtroRuoloEsterno: 'stoc' });
  verifica('senza le righe delle Giacenze: l\'elenco di prima', !/Per noi chiusi/.test(senza.testo) && /li dichiara lui/.test(senza.testo), senza.testo.slice(0, 300));
  const dp = pdf.daDichiararePdf(2026, { righe: [], totale_kg: 20000, per_mese: [] }, { sito: TCY, ruolo: 'stoc', per_noi_chiusi: 'TECNOGUM SRL sulla rete non dichiara a SMOCO' });
  verifica('e il PDF dell\'elenco lo dice nelle note', dp.note.some(n => /^Per noi chiusi: TECNOGUM SRL sulla rete non dichiara a SMOCO\./.test(n)), J(dp.note));
  const s = pdf.stoccaggiPdf(2026, [
    { sito: NAP, data_rilevazione: '2026-10-05', class1_kg: 1000, giacenza_rete_t: 4, giacenza_aci_t: 0 },
    { sito: TCY, data_rilevazione: '2026-09-13', class1_kg: 0, giacenza_rete_t: null, giacenza_aci_t: null },
  ]);
  const oggiRete = s.riepilogo.find(r => r.etichetta === 'Giacenza di oggi, rete');
  verifica('il PDF degli stoccaggi: il totale di oggi con un piazzale senza numero e\' «—», e la nota dice quale', oggiRete.valore === '—' && s.note.some(n => n.startsWith(`Giacenza di oggi, rete: —. Il totale non si fa: la riga di ${TCY} non ha il numero`)), J([oggiRete, s.note[0]]));
}

console.log('6. LE PAGINE A 375 PX');
{
  // I riquadri nuovi sono paragrafi che vanno a capo: niente larghezze fisse,
  // niente righe che non si spezzano.
  const nuovi = [
    [sorgentePagina, 'IL PERCHE\' DEL «—», SOPRA LE SCHEDE'],
    [readFileSync(qui('../src/components/giacenze/DaDichiarareTable.jsx'), 'utf8').replace(/\r/g, ''), '{chiusi && ('],
    [readFileSync(qui('../src/components/dichiarazioni/Riepilogo.jsx'), 'utf8').replace(/\r/g, ''), '{primaDelGestionale ? ('],
  ];
  for (const [s, segno] of nuovi) {
    const i = s.indexOf(segno);
    const pezzo = i < 0 ? '' : s.slice(i, i + 700);
    verifica(`il riquadro nuovo (${segno.slice(0, 30)}) va a capo a 375 px`, i >= 0 && /<p className="text-(xs|sm)[^"]*"/.test(pezzo) && !/whitespace-nowrap|min-w-\[|w-\[\d/.test(pezzo.split('</p>')[0]), pezzo.slice(0, 120));
  }
}

console.log('7. SUI DATI VERI');
const CARTELLA = process.env.DATI_VERI || qui('../../dati-veri/');
const copie = existsSync(CARTELLA) ? readdirSync(CARTELLA).filter(n => /^treadrider-dati-veri-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n)).sort() : [];
if (!copie.length) console.log(`  nessuna copia dei dati veri in ${CARTELLA}: sezione saltata`);
else {
  const DATI = JSON.parse(gunzipSync(readFileSync(CARTELLA + copie[copie.length - 1])).toString('utf8'));
  for (const k of Object.keys(ARCHIVI)) delete ARCHIVI[k];
  Object.assign(ARCHIVI, DATI.archivi);
  const ORA = DATI.meta.letto_fino_al;
  const ANNO = Number(String(ORA).slice(0, 4));
  for (const anno of [ANNO - 1, ANNO - 2]) {
    const { G, R } = await due(anno, ORA);
    if (!R.prima_del_gestionale) { console.log(`  il ${anno} non e' prima del gestionale su questa copia: saltato`); continue; }
    let zeri = [];
    for (const s of R.siti.filter(x => x.tipo_destinazione !== 'stoc')) {
      const t = leggibile(await html('dichiarazioni/SezioneImpianto.jsx', { sito: s, onApri: () => {}, soloLettura: true }));
      if (RIGHE_GIACENZA_SEZIONE.test(t)) zeri.push(s.sito);
    }
    verifica(`${anno}: la scheda Impianti non scrive una giacenza 0,00 (${R.siti.filter(x => x.tipo_destinazione !== 'stoc').length} impianti)`, zeri.length === 0, J(zeri));
    const rp = leggibile(await html('dichiarazioni/Riepilogo.jsx', { dati: R, onApri: () => {}, soloLettura: true }));
    const restanti = [...rp.matchAll(/resta in giacenza (.*?) giacenza a fine mese/g)].map(m => m[1]);
    verifica(`${anno}: il Riepilogo non somma «resta in giacenza» a 0,00, e non chiede di registrare caricamenti`, restanti.length > 0 && restanti.every(x => !/0,00/.test(x)) && !/caricamento che qui non è stato registrato/.test(rp), J(restanti.filter(x => /0,00/.test(x)).slice(0, 2)));
    const p = await testata(R);
    verifica(`${anno}: la testata dice «—» col perche', e lo dice sopra le schede`, p.kpi['Rete: giacenza degli impianti'].valore === '—' && p.riquadri.includes(R.perche_prima_del_gestionale) && !p.errori.length, J(p.kpi['Rete: giacenza degli impianti'].valore));
    const x = await situazioneExcel(G);
    verifica(`${anno}: il foglio non scrive 0 nel TOTALE di ACI ed extra raccolta, e lo spiega`, x.totale[x.col('Giacenza ACI (t)')] !== 0 && x.totale[x.col('Extra raccolta in piazzale, fuori portale (t)')] !== 0 && x.note[0].includes(G.totali.perche_prima_del_gestionale), J(x.totale.slice(0, 6)));
    const sp = pdf.situazionePdf(anno, G.righe, G.totali);
    verifica(`${anno}: il PDF scrive «—» nel riepilogo e il perche' nella prima nota`, sp.riepilogo[0].valore === '—' && sp.note[0].includes(G.totali.perche_prima_del_gestionale));
  }
  {
    const { G, R } = await due(ANNO, ORA);
    const p = await testata(R);
    const giac = p.kpi['Rete: giacenza degli impianti'];
    verifica(`${ANNO}, l'anno in corso: la testata senza «—» e senza riquadro`, giac.valore !== '—' && !giac.perche && !giac.percheNota && p.riquadri.length === 0, J([giac.valore, giac.nota]));
    const x = await situazioneExcel(G);
    const chiuse = G.righe.filter(r => Number(r.in_attesa_chiusa_t) > 0);
    verifica(`${ANNO}: il foglio ha l'attesa per noi chiusa riga per riga e nel totale, e solo le sue note`,
      x.totale[x.col('Attesa per noi chiusa (t)')] === (G.totali.in_attesa_chiusa_t || '') && x.note.length === chiuse.length && x.note.every(n => /per noi chiuse/.test(n)), J([x.totale[x.col('Attesa per noi chiusa (t)')], x.note.length]));
    if (ANNO === 2026 && String(ORA).startsWith('2026-10-11')) {
      verifica("sulla copia dell'11/10/2026: la testata dice 1.617,22 t come prima", giac.valore === '1.617,22 t' && giac.nota === 'a portale, aggiornata ai caricamenti: 1.617,22 t', J([giac.valore, giac.nota]));
      verifica("sulla copia dell'11/10/2026: il TOTALE del foglio 1.643,10 t, ACI 0, extra 0, e 181,299 t per noi chiuse su T-Cycle",
        x.totale[2] === 1643.1 && x.totale[3] === 0 && x.totale[4] === 0 && x.totale[x.col('Attesa per noi chiusa (t)')] === 181.299 && chiuse.length === 1 && /T-CYCLE/.test(chiuse[0].sito), J(x.totale));
    }
    const gennaio = `${ANNO + 1}-01-05T10:00:00Z`;
    const J27 = await due(ANNO, gennaio);
    const pg = await testata(J27.R);
    verifica(`il ${ANNO} guardato il 05/01/${ANNO + 1}: «a portale ... : —» col perche' del totale, non 0,00`, /: —$/.test(pg.kpi['Rete: giacenza degli impianti'].nota) && pg.kpi['Rete: giacenza degli impianti'].percheNota === J27.R.totali.perche_totali.RETE, pg.kpi['Rete: giacenza degli impianti'].nota);
    // La casella delle Giacenze, sui totali veri di quel giorno con l'ACI del
    // 04/10/2026 (26,81 t): la rete «—» col perche', e l'ACI ancora in testa
    // (revisione del 14/10/2026, lo script del revisore kpiAciSparita.mjs).
    const kpiGen = leggibile(await html('giacenze/GiacenzeKpi.jsx', { totali: { ...J27.G.totali, giacenza_aci_t: 26.81 } }));
    verifica(`il ${ANNO} guardato il 05/01/${ANNO + 1}, le Giacenze: «il totale non si fa» e «ACI 26,81 t, a parte» nella stessa casella`,
      /Giacenza rete a portale — il totale non si fa: una riga senza numero non vale zero · ACI 26,81 t, a parte Ordini da dichiarare/.test(kpiGen), kpiGen.slice(0, 160));
    const xg = await situazioneExcel(J27.G);
    const iP = xg.col('P (kg)'), iAciKg = xg.col('ACI (kg)');
    verifica(`il ${ANNO} guardato il 05/01/${ANNO + 1}, il foglio: il TOTALE di rete vuoto e le sue classi pure (non la somma delle sole righe col numero), la nota col perche'`,
      xg.totale[xg.col('Giacenza rete a portale (t)')] === '' && xg.totale.slice(iP, iAciKg).every(v => v === null) && xg.note.some(n => n === `Totale rete: —. ${J27.G.totali.perche_totali.RETE}`),
      J([xg.totale.slice(iP, iAciKg + 1), xg.note.map(n => n.slice(0, 40))]));
  }
}

console.log(`\n${ok} superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
