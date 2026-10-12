// LA CHIUSURA DEL MESE SUI DATI VERI (revisione delle migliorie, 11-12/10/2026).
//
// I revisori avversari hanno trovato sei difetti della lista di controllo del
// mese, tutti con uno scenario preso dalla copia degli archivi veri
// (../dati-veri/, fuori dal repository: vedi prove/datiVeri.mjs e AGENTS.md, «I
// quattro controlli»). Le prove costruite passavano: una usava documento_ids: [],
// che l'interfaccia non manda mai. Qui la funzione statoChiusuraMese intera gira
// sulla copia, in sola lettura, con l'orologio fermo, e ogni scenario parte dai
// dati veri cambiati solo quanto serve:
// 1. rete e ACI di settembre esportate il 05/10 da «elaborata» e approvate il
//    14/10: non sono «esportate dopo l'approvazione»;
// 2. Gatim ACI con la primaria di settembre caricata e la secondaria no: da
//    fare, e sull'ACI non si dice che il portale aggancera';
// 3. un anno passato (dicembre 2025) non si giudica col resto del 2026, e non
//    chiede passi che il gestionale non faceva;
// 4. i cinque interventi «PULIAMO IL MONDO» di settembre chiusi dopo il
//    documento a zero righe: l'extra raccolta non e' piu' «non serve»;
// 5. Gatim rete con giugno scritto e settembre caricato: giugno si nomina;
// 6. Irigom, settembre di soli metalli: fatto, ma non «caricata».
// 7. (12/10/2026) settembre 2026, il primo mese chiuso nel gestionale, non
//    scivola: la copia non ha nessun congelamento, e il 15/11/2026 settembre
//    diventava «Prima di ottobre 2026 la passiva non si congelava».
// E sul giorno di oggi, senza cambiare niente: i numeri da dichiarare sono
// quelli della colonna «Da dichiarare» delle Dichiarazioni (la fotografia).
// Gli orari scritti qui sono italiani: i campi della copia sono in UTC (07:25Z
// e' alle 09:25 in Italia), e la prova lo controlla.
// Senza la copia la prova si salta e lo dice. npm run prove
import { build } from 'esbuild';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
const CARTELLA = process.env.DATI_VERI || qui('../../dati-veri/');
const copie = existsSync(CARTELLA) ? readdirSync(CARTELLA).filter(n => /^treadrider-dati-veri-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n)).sort() : [];
if (!copie.length) {
  console.log(`Nessuna copia dei dati veri in ${CARTELLA}: prova saltata.`);
  process.exit(0);
}
const copia = copie[copie.length - 1];
const DATI = JSON.parse(gunzipSync(readFileSync(CARTELLA + copia)).toString('utf8'));
console.log(`Copia: ${copia}, letta il ${DATI.meta.letto_fino_al}`);
// Gli scenari sono scritti sulla copia dell'11/10/2026: su un'altra si saltano.
if (!/2026-10-11/.test(copia)) {
  console.log('Gli scenari sono della copia dell\'11/10/2026: prova saltata.');
  process.exit(0);
}

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const SDK_FINTO = `
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
  return [...righe].sort((a, b) => { const x = a[campo], y = b[campo]; if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y)); return giu ? -c : c; }); };
const scrive = (op, nome) => { globalThis.__SCRITTE.push(op + ' ' + nome); throw new Error('il controllo sui dati veri non scrive: ' + op + ' ' + nome); };
const entita = (nome) => ({
  list: async (sort, lim = 1e9, skip = 0) => ordina(globalThis.__ARCHIVI[nome] || [], sort).slice(skip, skip + lim),
  filter: async (f, sort, lim = 1e9, skip = 0) => ordina((globalThis.__ARCHIVI[nome] || []).filter(r => soddisfa(r, f)), sort).slice(skip, skip + lim),
  get: async (id) => (globalThis.__ARCHIVI[nome] || []).find(r => r.id === id) || null,
  create: async () => scrive('create', nome), update: async () => scrive('update', nome), bulkCreate: async () => scrive('bulkCreate', nome),
  delete: async () => scrive('delete', nome), deleteMany: async () => scrive('deleteMany', nome),
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: 'admin', email: 'controllo-dati-veri' }) }, asServiceRole: { entities }, entities,
    functions: { invoke: async (n) => { throw new Error('la chiusura del mese non chiama altre funzioni: ' + n); } } };
}`;
// Il giorno di oggi lo decide la prova: la funzione chiede oggiRoma().
const VECCHIO_OGGI = 'export const oggiRoma = () => GIORNO_ROMA.format(new Date());';
const sorgenteGiorno = readFileSync(qui('../base44/shared/giornoItaliano.ts'), 'utf8').replace(/\r/g, '');
verifica('giornoItaliano.ts ha ancora oggiRoma come la prova la sostituisce', sorgenteGiorno.includes(VECCHIO_OGGI));
const pacchetto = await build({
  entryPoints: [qui('../base44/functions/statoChiusuraMese/entry.ts')],
  bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
  plugins: [{ name: 'dati-veri', setup(b) {
    b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
    b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
    b.onLoad({ filter: /giornoItaliano\.ts$/ }, () => ({ contents: sorgenteGiorno.replace(VECCHIO_OGGI, 'export const oggiRoma = () => globalThis.__OGGI || GIORNO_ROMA.format(new Date());'), loader: 'ts' }));
  } }],
});
const modulo = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));

const OraVera = Date;
async function chiama(corpo = {}, { oggi = '2026-10-12', cambia = {} } = {}) {
  globalThis.__OGGI = oggi;
  globalThis.__ARCHIVI = { ...DATI.archivi, ...cambia };
  globalThis.__SCRITTE = [];
  // L'orologio della funzione (Date.now() per la freschezza) e' fermo al giorno scelto.
  const ms = OraVera.parse(`${oggi}T10:00:00Z`);
  globalThis.Date = class extends OraVera { constructor(...a) { if (a.length) super(...a); else super(ms); } static now() { return ms; } };
  try {
    const r = await modulo.default({ json: async () => corpo });
    return { stato: r.status, j: await r.json(), scritte: globalThis.__SCRITTE.slice() };
  } finally { globalThis.Date = OraVera; }
}
const passo = (r, chiave) => (r.j.passi || []).find(p => p.chiave === chiave) || {};
const voce = (p, re) => (p.voci || []).find(v => re.test(v.testo)) || null;
// La fotografia dell'11/10/2026 con un impianto cambiato su un canale.
const conFoto = (sito, canale, campi) => DATI.archivi.IndicatoreGiorno.map(r => {
  if (r.giorno !== '2026-10-11') return r;
  const siti = JSON.parse(r.siti_json).map(s => (s.sito === sito ? { ...s, canali: { ...s.canali, [canale]: { ...s.canali[canale], ...campi } } } : s));
  return { ...r, siti_json: JSON.stringify(siti) };
});

console.log('OGGI, COSI\' COM\'E\'');
{
  const r = await chiama();
  verifica('risponde 200 su settembre 2026, e non scrive', r.stato === 200 && r.j.mese && r.j.mese.etichetta === 'Settembre 2026' && !r.scritte.length, JSON.stringify(r.j).slice(0, 200));
  const d = passo(r, 'dichiarazioni');
  // La colonna «Da dichiarare» delle Dichiarazioni dell'11/10/2026, impianto per impianto.
  const attesi = { 'GREEN TYRE PROJECT SRL': '337,96', 'T-CYCLE INDUSTRIES SRL': '364,80', Gatim: '261,62' };
  for (const [sito, t] of Object.entries(attesi)) {
    const v = voce(d, new RegExp(`^${sito}, rete`));
    verifica(`${sito}, rete: restano da dichiarare ${t} t, come nelle Dichiarazioni`, v && v.stato === 'da_fare' && v.testo.includes(`restano da dichiarare ${t} t`), v && v.testo);
  }
  verifica('Irigom, rete: la pratica di settembre non c\'e\' ancora', !!voce(d, /^Irigom S\.r\.l\., rete: la pratica di settembre non c'è ancora\.$/));
  verifica('nessuna voce ACI ne\' extra: sulla copia il loro resto e\' zero', !voce(d, /, (ACI|extra raccolta):/), JSON.stringify(d.voci));
  verifica('extra raccolta di settembre: nessun intervento finito, non serve', passo(r, 'attiva_EXTRA_RACCOLTA').stato === 'non_serve' && passo(r, 'passiva_EXTRA_RACCOLTA').stato === 'non_serve');
  verifica('rete e ACI di settembre, esportate il 05/10 da «elaborata»: da approvare, poi da esportare', ['RETE', 'ACI'].every(c => voce(passo(r, `attiva_${c}`), /^Da esportare dopo l'approvazione\.$/)));
  // La domanda aperta all'utente (12/10/2026): i mesi fatturati prima del
  // gestionale, elaborati a posteriori il 18/09 e il 06/10, risultano aperti.
  verifica('mesi prima ancora aperti: gennaio-agosto 2026, per la chiusura dell\'attiva', (r.j.mesi_aperti || []).map(m => m.mese).join(',') === 'Gennaio,Febbraio,Marzo,Aprile,Maggio,Giugno,Luglio,Agosto'
    && r.j.mesi_aperti.every(m => m.mancano.length === 1 && /^la chiusura dell'attiva \(rete(, ACI ed extra raccolta| e ACI)\)$/.test(m.mancano[0])), JSON.stringify(r.j.mesi_aperti));
}

console.log('1. L\'ESPORTAZIONE DI PRIMA DELL\'APPROVAZIONE');
{
  // Il registro come lo scrive registraEsportazione: documento_ids pieni, la
  // data dell'esportazione dei documenti veri (05/10/2026 alle 09:25 in Italia;
  // il campo e' in UTC, 07:25Z).
  const docs = DATI.archivi.DocumentoFatturazione.map(d => (d.tipo === 'ATTIVA' && d.mese === 'Settembre' && d.tipologia !== 'EXTRA_RACCOLTA'
    ? { ...d, stato: 'approvata', data_approvazione: '2026-10-14T08:00:00.000Z' } : d));
  const registro = DATI.archivi.DocumentoFatturazione.filter(d => d.tipo === 'ATTIVA' && d.data_esportazione)
    .map((d, i) => ({ id: `e${i}`, tipologia: d.tipologia, direzione: 'ATTIVA', anno: d.anno, mese: d.mese, documento_ids: [d.id], data_esportazione: d.data_esportazione, stato: 'completata', nome_file: 'attiva.xlsx' }));
  verifica('la copia ha davvero le esportazioni di settembre del 05/10, da «elaborata»', registro.filter(e => e.mese === 'Settembre' && /^2026-10-05/.test(e.data_esportazione)).length === 2);
  // L'ora scritta nei commenti e' quella italiana del campo (revisione del
  // 12/10/2026: c'era scritto 07:25, l'ora UTC).
  const oraItaliana = (iso) => new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  const ore = registro.filter(e => e.mese === 'Settembre').map(e => oraItaliana(e.data_esportazione));
  const questo = readFileSync(fileURLToPath(import.meta.url), 'utf8').replace(/\r/g, '');
  // Le ore che i commenti di questa prova scrivono accanto al 05/10/2026.
  const dette = questo.split('\n').filter(l => /^\s*\/\//.test(l)).flatMap(l => [...l.matchAll(/05\/10\/2026 alle (\d{2}:\d{2})/g)].map(m => m[1]));
  verifica('le esportazioni di settembre sono delle 09:25 italiane, e i commenti dicono quell\'ora', ore.length === 2 && ore.every(o => o === '09:25') && dette.length > 0 && dette.every(o => ore.includes(o)), JSON.stringify([ore, dette]));
  const prefattura = [{ id: 'p9', anno: 2026, mese: 'Settembre', superata: false, caricata_il: '2026-10-13T08:00:00Z' }];
  const r = await chiama({}, { oggi: '2026-10-15', cambia: { DocumentoFatturazione: docs, EsportazioneFatturazione: registro, PrefatturaEcotyre: prefattura } });
  for (const c of ['RETE', 'ACI']) {
    const p = passo(r, `attiva_${c}`);
    verifica(`attiva ${c}, approvata il 14/10: manca l'esportazione, come dice il modulo («approvata»)`, p.manca && p.manca?.cosa === "l'esportazione dell'attiva" && !voce(p, /^Esportata dopo/), JSON.stringify(p.voci));
  }
  const dopo = await chiama({}, { oggi: '2026-10-15', cambia: { DocumentoFatturazione: docs, PrefatturaEcotyre: prefattura,
    EsportazioneFatturazione: [...registro, ...docs.filter(d => d.tipo === 'ATTIVA' && d.mese === 'Settembre' && d.tipologia === 'ACI').map(d => ({ id: 'e-dopo', tipologia: 'ACI', direzione: 'ATTIVA', anno: 2026, mese: 'Settembre', documento_ids: [d.id], data_esportazione: '2026-10-14T09:00:00.000Z', stato: 'completata' }))] } });
  verifica('riesportata il 14/10 dopo l\'approvazione: manca solo la conferma della fattura', passo(dopo, 'attiva_ACI').manca?.cosa === 'la conferma della fattura' && passo(dopo, 'attiva_RETE').manca?.cosa === "l'esportazione dell'attiva");
}

console.log('2. L\'ACI: UNA PROVENIENZA NON COPRE L\'ALTRA, E NON SI AGGANCIA');
{
  // Gatim ACI di settembre: primaria 12.350 kg e secondaria 12.820 kg,
  // dichiarate a parte. Com'era prima che arrivasse la secondaria.
  const foto = conFoto('Gatim', 'ACI', { giacenza_t: 12.82, dichiarato_t: 102.72, resta_t: 12.82, uscito_t: 102.72 });
  const dich = DATI.archivi.DichiarazioneSito.filter(d => !(d.sito === 'Gatim' && d.canale === 'ACI' && d.provenienza === 'secondaria' && d.mese === 'Settembre'));
  const r = await chiama({}, { cambia: { IndicatoreGiorno: foto, DichiarazioneSito: dich } });
  const v = voce(passo(r, 'dichiarazioni'), /^Gatim, ACI/);
  verifica('Gatim ACI con la secondaria di settembre non dichiarata e\' da fare', v && v.stato === 'da_fare', v && v.testo);
  verifica('e dice fin dove e\' caricata ogni provenienza, senza agganci', v && v.testo === 'Gatim, ACI: restano da dichiarare 12,82 t senza una dichiarazione caricata; la primaria è caricata fino a settembre e la secondaria è caricata fino a maggio.' && !/aggancer/.test(v.testo), v && v.testo);
  verifica('il dettaglio dice che su ACI ed extra raccolta niente si aggancia', /Su ACI ed extra raccolta niente si aggancia/.test(passo(r, 'dichiarazioni').dettaglio));
}

console.log('3. UN ANNO PASSATO: DICEMBRE 2025');
{
  const r = await chiama({ anno: 2025 });
  verifica('risponde su dicembre 2025', r.stato === 200 && r.j.mese && r.j.mese.etichetta === 'Dicembre 2025');
  const d = passo(r, 'dichiarazioni');
  verifica('nessun numero della fotografia del 2026 (337,96, 364,80, 261,62, 652,84)', !/337,96|364,80|261,62|652,84/.test(JSON.stringify(r.j)) && d.stato === 'non_serve', JSON.stringify(d));
  verifica('attiva, passiva e quadrature non si chiedono a un mese che il gestionale non ha mai trattato', ['attiva_RETE', 'attiva_ACI', 'attiva_EXTRA_RACCOLTA', 'passiva_RETE', 'passiva_ACI', 'passiva_EXTRA_RACCOLTA', 'quadrature_fir'].every(k => passo(r, k).stato === 'non_serve'), JSON.stringify(r.j.passi.map(p => [p.chiave, p.stato])));
  verifica('e l\'attiva dice da quando si elabora qui: gennaio 2026', /Prima di gennaio 2026 l'attiva non si elaborava nel gestionale/.test(passo(r, 'attiva_RETE').dettaglio), passo(r, 'attiva_RETE').dettaglio);
}

console.log('4. L\'EXTRA RACCOLTA CHIUSA DOPO IL DOCUMENTO A ZERO RIGHE');
{
  // I cinque «PULIAMO IL MONDO» di settembre, ancora «assegnato» nella copia,
  // chiusi a fine settembre col loro peso. Il documento resta quello del 05/10.
  const extra = DATI.archivi.ExtraRaccolta.map((r, i) => (r.stato === 'assegnato' && r.mese === 'Settembre'
    ? { ...r, stato: 'terminato', trasporto_iniziato_il: '2026-09-26T00:00:00.000Z', trasporto_finito_il: '2026-09-27T00:00:00.000Z', peso_effettivo: 300 + i * 10 } : r));
  verifica('nella copia sono cinque', extra.filter(r => r.stato === 'terminato' && /^2026-09/.test(String(r.trasporto_finito_il))).length === 5);
  const r = await chiama({}, { oggi: '2026-10-15', cambia: { ExtraRaccolta: extra } });
  const att = passo(r, 'attiva_EXTRA_RACCOLTA');
  verifica('attiva extra: da rielaborare, non «non serve»', att.stato === 'da_fare' && att.manca?.cosa === "la rielaborazione dell'attiva" && /Elaborata il 05\/10\/2026 senza righe, ma ora nel mese ci sono 5 movimenti di extra raccolta finiti: va rielaborata\./.test(att.voci[0].testo), JSON.stringify(att));
  verifica('passiva extra: da fare anche lei', passo(r, 'passiva_EXTRA_RACCOLTA').stato === 'da_fare');
}

console.log('5. GIUGNO SCRITTO, SETTEMBRE CARICATO');
{
  const foto = conFoto('Gatim', 'RETE', { giacenza_t: 161.62, dichiarato_t: 465.4, resta_t: 161.62, uscito_t: 465.4 });
  const dich = [...DATI.archivi.DichiarazioneSito,
    { id: 'g6', sito: 'Gatim', canale: 'RETE', provenienza: '', anno: 2026, mese: 'Giugno', quantita_kg: 61000, caricata_inviata: false, ricevuta_email: false },
    { id: 'g9', sito: 'Gatim', canale: 'RETE', provenienza: '', anno: 2026, mese: 'Settembre', quantita_kg: 100000, caricata_inviata: true, ricevuta_email: false }];
  const r = await chiama({}, { cambia: { IndicatoreGiorno: foto, DichiarazioneSito: dich } });
  const v = voce(passo(r, 'dichiarazioni'), /^Gatim, rete/);
  verifica('Gatim rete: da fare, e giugno si nomina', v && v.stato === 'da_fare' && v.testo === 'Gatim, rete: l\'ultima dichiarazione caricata a portale è di settembre; giugno ha la dichiarazione scritta, da caricare; restano da dichiarare 161,62 t.', v && v.testo);
}

console.log('6. IRIGOM, SETTEMBRE DI SOLI METALLI');
{
  verifica('nella copia settembre di Irigom e\' di soli metalli (99.300 kg di ferro)', DATI.archivi.DichiarazioneSito.some(d => /irigom/i.test(d.sito) && d.canale === 'RETE' && d.mese === 'Settembre' && d.motivo_assenza === 'solo_metalli' && Number(d.metalli_kg) === 99300));
  const r = await chiama({}, { cambia: { PraticaIrigom: [{ id: 'pi9', anno: 2026, mese: 'Settembre', stato: 'registrata', versione: 1 }] } });
  const v = voce(passo(r, 'dichiarazioni'), /^Irigom S\.r\.l\., rete/);
  verifica('fatto, senza dire «caricata»', v && v.stato === 'fatto' && v.testo === 'Irigom S.r.l., rete: pratica di settembre registrata, di soli metalli ferrosi (a portale non si carica nulla); restano da dichiarare 652,84 t, la giacenza che il portale aggancerà con le prossime uscite.', v && v.testo);
}

console.log('7. SETTEMBRE 2026, IL PRIMO MESE CHIUSO NEL GESTIONALE, NON SCIVOLA');
{
  // La copia non ha nessun congelamento (ChiusuraPassivaMese vuoto). Il
  // 15/11/2026 si apre settembre 2026 dall'elenco dei mesi ancora aperti: la
  // passiva di rete e ACI resta da congelare, e l'elenco lo dice.
  verifica('nella copia non c\'e\' nessun congelamento', (DATI.archivi.ChiusuraPassivaMese || []).length === 0);
  const r = await chiama({ anno: 2026, mese: 9 }, { oggi: '2026-11-15' });
  for (const c of ['RETE', 'ACI']) {
    const p = passo(r, `passiva_${c}`);
    verifica(`settembre 2026 aperto il 15/11: passiva ${c} da congelare`, p.stato === 'da_fare' && p.manca?.cosa === 'il congelamento della passiva' && !/Prima di ottobre/.test(JSON.stringify(p)), `${p.stato}: ${(p.voci || []).map(v => v.testo).join(' | ')}`);
  }
  const elenco = await chiama({}, { oggi: '2026-11-15' });
  const set = (elenco.j.mesi_aperti || []).find(m => m.etichetta === 'Settembre 2026');
  verifica('fra i mesi prima ancora aperti, settembre dice anche il congelamento', set && set.mancano.includes('il congelamento della passiva (rete e ACI)'), JSON.stringify(set));
  verifica('gennaio-agosto 2026 no: chiusi fuori dal gestionale', (elenco.j.mesi_aperti || []).filter(m => m.anno === 2026 && m.numero < 9).every(m => !m.mancano.some(x => /congelamento/.test(x))), JSON.stringify(elenco.j.mesi_aperti));
  // Oggi (12/10/2026) non cambia niente: settembre era gia' da congelare.
  const oggi = await chiama();
  verifica('il 12/10/2026 settembre e\' da congelare come prima, e i mesi aperti sono gli stessi', ['RETE', 'ACI'].every(c => passo(oggi, `passiva_${c}`).manca?.cosa === 'il congelamento della passiva') && (oggi.j.mesi_aperti || []).every(m => m.mancano.length === 1), JSON.stringify(oggi.j.mesi_aperti));
}

console.log(`\n${ok} verifiche passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
