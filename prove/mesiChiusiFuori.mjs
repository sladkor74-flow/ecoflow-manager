// I MESI FATTURATI PRIMA DEL GESTIONALE SI SEGNANO CHIUSI, SUI DATI VERI (giro
// K8, 12/10/2026).
//
// La chiusura del mese elencava gennaio-agosto 2026 fra i mesi ancora aperti,
// tutti con «manca la chiusura dell'attiva»: i documenti di quei mesi sono
// stati elaborati a posteriori (18/09 e 06/10/2026), ma le fatture si sono
// fatte fuori. Decisione dell'utente dell'11/10/2026: «si chiudili nel
// gestionale come se fossero già stati fatti». Lo fa la funzione
// segnaMesiChiusiFuori: senza conferma risponde il piano, con la conferma
// porta i documenti ATTIVA di quei mesi a «chiusa», con la nota e una riga per
// documento nello storico delle modifiche.
//
// Qui le due funzioni vere, segnaMesiChiusiFuori e statoChiusuraMese, girano
// sulla copia dei dati veri dell'11/10/2026 (../dati-veri/, fuori dal
// repository) con un archivio finto in memoria che si puo' scrivere, e
// l'orologio fermo al 12/10/2026. Si prova: chi non e' amministratore non
// tocca niente; il piano non scrive e non dice importi; un mese da settembre
// in poi fa rifiutare tutto; la scrittura chiude i 24 documenti (tre canali per
// otto mesi), non scrive giorno ne' numero della fattura, lascia lo storico;
// dopo, statoChiusuraMese non elenca piu' gennaio-agosto, settembre resta
// com'era, la dashboard (statoMesiAttiva, «Da gestire») li dice chiusi; rifarlo
// non tocca niente; una scrittura che cade a meta' lo dice. Senza la copia la
// prova si salta e lo dice. npm run prove
import { build } from 'esbuild';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { cruscotto } from '../base44/shared/cruscotto.ts';
import { NOTA_CHIUSO_FUORI, ORIGINE_CHIUSO_FUORI } from '../base44/shared/chiusuraMese.ts';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// La funzione nuova si cerca prima: senza, la prova fallisce e lo dice, non salta.
const FUNZIONE = qui('../base44/functions/segnaMesiChiusiFuori/entry.ts');
verifica('c\'e\' la funzione segnaMesiChiusiFuori', existsSync(FUNZIONE));

const CARTELLA = process.env.DATI_VERI || qui('../../dati-veri/');
const copie = existsSync(CARTELLA) ? readdirSync(CARTELLA).filter(n => /^treadrider-dati-veri-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n)).sort() : [];
if (!copie.length || !existsSync(FUNZIONE)) {
  console.log(copie.length ? '' : `Nessuna copia dei dati veri in ${CARTELLA}: prova saltata.`);
  console.log(`\n${ok} verifiche passate, ${ko} fallite`);
  process.exit(ko ? 1 : 0);
}
const copia = copie[copie.length - 1];
if (!/2026-10-11/.test(copia)) {
  console.log('Gli scenari sono della copia dell\'11/10/2026: prova saltata.');
  process.exit(0);
}
const DATI = JSON.parse(gunzipSync(readFileSync(CARTELLA + copia)).toString('utf8'));
console.log(`Copia: ${copia}, letta il ${DATI.meta.letto_fino_al}`);

// L'archivio finto: legge come quello di prove/chiusuraMeseDatiVeri.mjs ($in,
// $gte, $lte, ordinamento, pagine) e in piu' scrive, in memoria. Ogni
// scrittura finisce in __SCRITTE. __ROMPI_DOPO fa cadere l'aggiornamento dei
// documenti dopo n scritture; __REGISTRO_ROTTO fa cadere lo storico.
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
const tabella = (nome) => (globalThis.__ARCHIVI[nome] = globalThis.__ARCHIVI[nome] || []);
let progressivo = 0;
const entita = (nome) => ({
  list: async (sort, lim = 1e9, skip = 0) => ordina(tabella(nome), sort).slice(skip, skip + lim).map(r => ({ ...r })),
  filter: async (f, sort, lim = 1e9, skip = 0) => ordina(tabella(nome).filter(r => soddisfa(r, f)), sort).slice(skip, skip + lim).map(r => ({ ...r })),
  get: async (id) => { const r = tabella(nome).find(r => r.id === id); return r ? { ...r } : null; },
  update: async (id, campi) => {
    if (nome === 'DocumentoFatturazione' && globalThis.__ROMPI_DOPO !== undefined && globalThis.__SCRITTE.filter(s => s.op === 'update').length >= globalThis.__ROMPI_DOPO) throw new Error('rete caduta');
    const t = tabella(nome); const i = t.findIndex(r => r.id === id); if (i < 0) throw new Error('non trovato ' + id);
    t[i] = { ...t[i], ...campi }; globalThis.__SCRITTE.push({ op: 'update', entita: nome, id, campi }); return { ...t[i] };
  },
  create: async (r) => { if (nome === 'ModificaDato' && globalThis.__REGISTRO_ROTTO) throw new Error('registro non disponibile');
    const nuovo = { id: nome + '-' + (++progressivo), ...r }; tabella(nome).push(nuovo); globalThis.__SCRITTE.push({ op: 'create', entita: nome, righe: [r] }); return { ...nuovo }; },
  bulkCreate: async (rr) => { if (nome === 'ModificaDato' && globalThis.__REGISTRO_ROTTO) throw new Error('registro non disponibile');
    for (const r of rr) tabella(nome).push({ id: nome + '-' + (++progressivo), ...r }); globalThis.__SCRITTE.push({ op: 'bulkCreate', entita: nome, righe: rr }); return rr; },
  delete: async (id) => { globalThis.__SCRITTE.push({ op: 'delete', entita: nome, id }); throw new Error('qui non si cancella'); },
  deleteMany: async () => { globalThis.__SCRITTE.push({ op: 'deleteMany', entita: nome }); throw new Error('qui non si cancella'); },
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
export function createClientFromRequest() {
  return { auth: { me: async () => (globalThis.__RUOLO ? { role: globalThis.__RUOLO, full_name: 'Amministratore Prova', email: 'prova@prova' } : null) },
    asServiceRole: { entities, functions: { invoke: async (n) => { throw new Error('non chiama altre funzioni: ' + n); } } }, entities,
    functions: { invoke: async (n) => { throw new Error('non chiama altre funzioni: ' + n); } } };
}`;
// Il giorno di oggi lo decide la prova: le funzioni chiedono oggiRoma().
const VECCHIO_OGGI = 'export const oggiRoma = () => GIORNO_ROMA.format(new Date());';
const sorgenteGiorno = readFileSync(qui('../base44/shared/giornoItaliano.ts'), 'utf8').replace(/\r/g, '');
verifica('giornoItaliano.ts ha ancora oggiRoma come la prova la sostituisce', sorgenteGiorno.includes(VECCHIO_OGGI));
const carica = async (nome) => {
  const pacchetto = await build({
    entryPoints: [qui(`../base44/functions/${nome}/entry.ts`)],
    bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
    plugins: [{ name: 'banco', setup(b) {
      b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
      b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
      b.onLoad({ filter: /giornoItaliano\.ts$/ }, () => ({ contents: sorgenteGiorno.replace(VECCHIO_OGGI, 'export const oggiRoma = () => globalThis.__OGGI || GIORNO_ROMA.format(new Date());'), loader: 'ts' }));
    } }],
  });
  return import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
};
const segna = await carica('segnaMesiChiusiFuori');
const stato = await carica('statoChiusuraMese');

const OraVera = Date;
const OGGI = '2026-10-12';
const ADESSO = `${OGGI}T10:00:00.000Z`;
// L'archivio si copia una volta e resta fra le chiamate: la scrittura di una
// chiamata la legge la successiva, come sul sito.
const nuovoArchivio = () => JSON.parse(JSON.stringify(DATI.archivi));
async function chiama(modulo, corpo = {}, { ruolo = 'admin', archivio } = {}) {
  globalThis.__OGGI = OGGI;
  globalThis.__ARCHIVI = archivio;
  globalThis.__SCRITTE = [];
  globalThis.__RUOLO = ruolo;
  const ms = OraVera.parse(ADESSO);
  globalThis.Date = class extends OraVera { constructor(...a) { if (a.length) super(...a); else super(ms); } static now() { return ms; } };
  try {
    const r = await modulo.default({ json: async () => corpo });
    return { stato: r.status, j: await r.json(), scritte: globalThis.__SCRITTE.slice() };
  } finally { globalThis.Date = OraVera; }
}
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto'];
const OTTO = MESI.map(mese => ({ anno: 2026, mese }));
const attivaDi = (archivio, mesi) => archivio.DocumentoFatturazione.filter(d => d.tipo === 'ATTIVA' && Number(d.anno) === 2026 && mesi.includes(d.mese));
const settembre = (r) => JSON.stringify({ mese: r.j.mese, passi: r.j.passi, conteggio: r.j.conteggio, sintesi: r.j.sintesi });
// I totali dei documenti veri di gennaio-agosto: nessuno deve uscire.
const TOTALI = attivaDi(DATI.archivi, MESI).map(d => Number(d.totale)).filter(x => x > 0);

console.log('PRIMA: GENNAIO-AGOSTO APERTI');
const archivio = nuovoArchivio();
const prima = await chiama(stato, {}, { archivio });
verifica('la copia ha i 24 documenti di gennaio-agosto, tre canali per mese, tutti «elaborata»', attivaDi(archivio, MESI).length === 24
  && MESI.every(m => ['RETE', 'ACI', 'EXTRA_RACCOLTA'].every(c => attivaDi(archivio, [m]).filter(d => d.tipologia === c && !d.superato).length === 1))
  && attivaDi(archivio, MESI).every(d => d.stato === 'elaborata'));
verifica('statoChiusuraMese: settembre 2026, e gennaio-agosto fra i mesi prima ancora aperti', prima.stato === 200 && prima.j.mese?.etichetta === 'Settembre 2026'
  && (prima.j.mesi_aperti || []).map(m => m.mese).join(',') === MESI.join(','), JSON.stringify(prima.j.mesi_aperti));
verifica('ognuno con prima_del_gestionale, e il primo mese chiuso nel gestionale e\' settembre 2026', prima.j.mesi_aperti.every(m => m.prima_del_gestionale === true) && prima.j.primo_mese_del_gestionale === 'Settembre 2026');
const mesiAttivaPrima = cruscotto({ oggi: OGGI, anno: 2026, adessoMs: OraVera.parse(ADESSO), documenti: archivio.DocumentoFatturazione, prefatture: [] });
verifica('la dashboard: gennaio-settembre elaborati e non chiusi', mesiAttivaPrima.mesi_attiva.map(m => `${m.mese}:${m.chiuso}`).join(',') === [...MESI, 'Settembre'].map(m => `${m}:false`).join(','));

console.log('SOLO L\'AMMINISTRATORE, E PRIMA IL PIANO');
{
  const utente = await chiama(segna, { mesi: OTTO, conferma: true }, { ruolo: 'user', archivio });
  verifica('chi non e\' amministratore: rifiutato, e niente scritto', utente.stato === 403 && utente.j.sola_lettura === true && !utente.scritte.length, JSON.stringify(utente.j));
  const vuoto = await chiama(segna, {}, { archivio });
  verifica('senza mesi: rifiutato', vuoto.stato === 400 && /Indica i mesi/.test(vuoto.j.error) && !vuoto.scritte.length);
  const piano = await chiama(segna, { mesi: OTTO }, { archivio });
  verifica('il piano: 24 documenti in 8 mesi, e non scrive', piano.stato === 200 && piano.j.simulato === true && piano.j.documenti.length === 24 && !piano.scritte.length
    && piano.j.sintesi === "Da segnare chiusi: 24 documenti dell'attiva in 8 mesi. Dopo, nessuno di questi mesi resta aperto.", JSON.stringify(piano.j.sintesi));
  verifica('mese per mese e canale per canale', piano.j.mesi.length === 8 && piano.j.mesi.every(m => m.canali.length === 3 && m.canali.every(c => c.azione === 'chiude') && m.frase === `${m.etichetta}: chiuso.` && m.prima.aperto));
  const gen = piano.j.mesi[0].canali.map(c => c.testo);
  verifica('gennaio come sulla copia: elaborato il 18/09/2026', gen[0] === 'Rete: elaborata il 18/09/2026, 316 righe; da «elaborata» a «chiusa».' && gen[1] === 'ACI: elaborata il 18/09/2026, 7 righe; da «elaborata» a «chiusa».', JSON.stringify(gen));
  const testo = JSON.stringify(piano.j);
  verifica('nel piano nessun importo: ne\' il totale ne\' i suoi numeri', !/"totale"/.test(testo) && TOTALI.every(t => !testo.includes(String(t))), testo.slice(0, 300));
  const conSettembre = await chiama(segna, { mesi: [...OTTO, { anno: 2026, mese: 'Settembre' }], conferma: true }, { archivio });
  verifica('con settembre dentro e la conferma: rifiutato tutto, niente scritto', conSettembre.stato === 400 && /Settembre 2026 è il primo mese chiuso nel gestionale/.test(conSettembre.j.error) && !conSettembre.scritte.length, JSON.stringify(conSettembre.j.error));
  verifica('e l\'archivio e\' quello di prima', attivaDi(archivio, MESI).every(d => d.stato === 'elaborata'));
}

console.log('LA SCRITTURA, CON LA CONFERMA');
const fatto = await chiama(segna, { mesi: OTTO, conferma: true }, { archivio });
{
  const agg = fatto.scritte.filter(s => s.op === 'update');
  const storico = fatto.scritte.filter(s => s.entita === 'ModificaDato').flatMap(s => s.righe);
  verifica('24 documenti aggiornati, tutti DocumentoFatturazione, e niente altro scritto oltre lo storico', fatto.stato === 200 && fatto.j.ok === true && fatto.j.simulato === false && fatto.j.scritti === 24
    && agg.length === 24 && agg.every(s => s.entita === 'DocumentoFatturazione') && fatto.scritte.every(s => s.op === 'update' || s.entita === 'ModificaDato'), JSON.stringify(fatto.j).slice(0, 300));
  const ids = new Set(attivaDi(DATI.archivi, MESI).map(d => d.id));
  verifica('sono proprio i documenti ATTIVA di gennaio-agosto', agg.every(s => ids.has(s.id)) && new Set(agg.map(s => s.id)).size === 24);
  verifica('si scrivono stato, data_chiusura, chi e la nota: mai giorno, numero della fattura o totale', agg.every(s => Object.keys(s.campi).sort().join(',') === 'data_chiusura,fattura_confermata_da,note,stato'
    && s.campi.stato === 'chiusa' && s.campi.data_chiusura === ADESSO && s.campi.fattura_confermata_da === 'Amministratore Prova'), JSON.stringify(agg[0]));
  verifica('la nota: com\'e\' andata, quando, chi e da che stato', agg.every(s => s.campi.note === `${NOTA_CHIUSO_FUORI}. Segnato chiuso il 12/10/2026 da Amministratore Prova: era «elaborata».`), agg[0].campi.note);
  verifica('lo storico: una riga per documento, stato da «elaborata» a «chiusa», col perche\'', fatto.j.traccia?.scritta === true && storico.length === 24
    && storico.every(r => r.entita === 'DocumentoFatturazione' && ids.has(r.record_id) && r.campo === 'stato' && r.prima === 'elaborata' && r.dopo === 'chiusa'
      && r.utente === 'Amministratore Prova' && r.il === ADESSO && r.motivo === NOTA_CHIUSO_FUORI && r.origine === ORIGINE_CHIUSO_FUORI && r.riservato === false), JSON.stringify(storico[0]));
  verifica('nella risposta nessun importo', !/"totale"/.test(JSON.stringify(fatto.j)) && TOTALI.every(t => !JSON.stringify(fatto.j).includes(String(t))));
  const sett = archivio.DocumentoFatturazione.filter(d => d.mese === 'Settembre');
  const settPrima = DATI.archivi.DocumentoFatturazione.filter(d => d.mese === 'Settembre');
  verifica('settembre e la passiva non si toccano', JSON.stringify(sett) === JSON.stringify(settPrima)
    && JSON.stringify(archivio.DocumentoFatturazione.filter(d => d.tipo === 'PASSIVA')) === JSON.stringify(DATI.archivi.DocumentoFatturazione.filter(d => d.tipo === 'PASSIVA')));
  verifica('i documenti chiusi tengono numeri, righe e date di prima', attivaDi(archivio, MESI).every(d => {
    const v = DATI.archivi.DocumentoFatturazione.find(x => x.id === d.id);
    return d.totale === v.totale && d.numero_voci === v.numero_voci && d.data_elaborazione === v.data_elaborazione && d.data_esportazione === v.data_esportazione && !d.fattura_confermata_il && !d.fattura_numero;
  }));
}

console.log('DOPO: TUTTI I MODULI DICONO «CHIUSO»');
{
  const dopo = await chiama(stato, {}, { archivio });
  verifica('statoChiusuraMese non elenca piu\' gennaio-agosto', dopo.stato === 200 && (dopo.j.mesi_aperti || []).length === 0, JSON.stringify(dopo.j.mesi_aperti));
  verifica('e settembre resta com\'era, passo per passo', settembre(dopo) === settembre(prima), `${prima.j.sintesi} / ${dopo.j.sintesi}`);
  const gennaio = await chiama(stato, { anno: 2026, mese: 'Gennaio' }, { archivio });
  const att = (c) => (gennaio.j.passi || []).find(p => p.chiave === `attiva_${c}`) || {};
  verifica('gennaio: l\'attiva di rete e ACI fatta, «fatturata fuori dal gestionale»', ['RETE', 'ACI'].every(c => att(c).stato === 'fatto'
    && att(c).dettaglio === "Fatturata fuori dal gestionale, prima dell'avvio: segnata chiusa il 12/10/2026 (decisione dell'utente dell'11/10/2026)."), JSON.stringify(att('RETE')));
  verifica('e l\'extra raccolta, senza righe, non serve', att('EXTRA_RACCOLTA').stato === 'non_serve');
  const dash = cruscotto({ oggi: OGGI, anno: 2026, adessoMs: OraVera.parse(ADESSO), documenti: archivio.DocumentoFatturazione, prefatture: [] });
  verifica('la dashboard: gennaio-agosto chiusi, settembre no', dash.mesi_attiva.map(m => `${m.mese}:${m.chiuso}`).join(',') === [...MESI.map(m => `${m}:true`), 'Settembre:false'].join(','));
  const pref = (c) => (c.da_gestire || []).find(v => v.chiave === 'attiva:prefattura');
  verifica('«Da gestire»: la prefattura si chiede solo a settembre (la copia non ha prefatture)', pref(mesiAttivaPrima)?.titolo === 'Prefattura Ecotyre non caricata: Gennaio, Febbraio, Marzo, Aprile, Maggio, Giugno, Luglio, Agosto, Settembre'
    && pref(dash)?.titolo === 'Prefattura Ecotyre non caricata: Settembre', `${pref(mesiAttivaPrima)?.titolo} / ${pref(dash)?.titolo}`);
  const ancora = await chiama(segna, { mesi: OTTO, conferma: true }, { archivio });
  verifica('rifarlo non tocca niente', ancora.stato === 200 && ancora.j.scritti === 0 && !ancora.scritte.length && /^Niente da segnare chiuso\./.test(ancora.j.sintesi), JSON.stringify(ancora.j).slice(0, 300));
}

console.log('UNA SCRITTURA CHE CADE A META\'');
{
  const a = nuovoArchivio();
  globalThis.__ROMPI_DOPO = 5;
  const r = await chiama(segna, { mesi: OTTO, conferma: true }, { archivio: a });
  delete globalThis.__ROMPI_DOPO;
  const storico = r.scritte.filter(s => s.entita === 'ModificaDato').flatMap(s => s.righe);
  verifica('si ferma e lo dice: 5 di 24, quelli segnati restano chiusi', r.stato === 500 && r.j.ok === false && r.j.scritti === 5 && /Mi sono fermato dopo 5 di 24 documenti: rete caduta/.test(r.j.error), JSON.stringify(r.j.error));
  verifica('e lo storico ha le 5 righe dei documenti chiusi davvero', storico.length === 5 && attivaDi(a, MESI).filter(d => d.stato === 'chiusa').length === 5);
  const ripresa = await chiama(segna, { mesi: OTTO, conferma: true }, { archivio: a });
  verifica('rilanciata, chiude gli altri 19', ripresa.stato === 200 && ripresa.j.scritti === 19 && attivaDi(a, MESI).every(d => d.stato === 'chiusa'));
  const b = nuovoArchivio();
  globalThis.__REGISTRO_ROTTO = true;
  const senzaStorico = await chiama(segna, { mesi: OTTO, conferma: true }, { archivio: b });
  delete globalThis.__REGISTRO_ROTTO;
  verifica('lo storico che non si scrive non annulla la chiusura: si dice', senzaStorico.stato === 200 && senzaStorico.j.scritti === 24 && senzaStorico.j.traccia?.scritta === false
    && /non è finita nello storico delle modifiche/.test(senzaStorico.j.nota_traccia || ''), JSON.stringify(senzaStorico.j.traccia));
}

console.log('LA SCHEDA DELL\'ATTIVA DICE CHE IL MESE E\' STATO FATTURATO FUORI');
{
  // La scheda del documento in Fatturazione attiva non importa da base44/shared:
  // riconosce la nota dal suo inizio, che deve restare quello di NOTA_CHIUSO_FUORI.
  const pagina = readFileSync(qui('../src/components/fatturazione/AttivaDashboard.jsx'), 'utf8').replace(/\r/g, '');
  const segno = (pagina.match(/String\(doc\.note \|\| ''\)\.includes\('([^']+)'\)/) || [])[1];
  verifica('la scheda riconosce la nota dei mesi chiusi fuori', !!segno && NOTA_CHIUSO_FUORI.startsWith(segno), String(segno));
  verifica('e lo dice, solo senza la conferma della fattura', /doc\.stato === 'chiusa' && !doc\.fattura_confermata_il && String\(doc\.note/.test(pagina) && /Fatturata fuori dal gestionale, prima dell'avvio/.test(pagina));
  verifica('col giorno italiano della chiusura', /giornoRoma\(doc\.data_chiusura\)/.test(pagina));
}

console.log(`\n${ok} verifiche passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
