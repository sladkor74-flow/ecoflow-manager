// Prova dell'abbinamento delle richieste ECT (base44/shared/richiesteEct.ts):
// una richiesta si riconosce da produttore, classe e data di immissione, non dal
// numero di riga del foglio. Si lancia con: npm run prove
//
// Dalla prova del cambio d'anno (15/10/2026), in fondo:
//   - il foglio del 09/10/2026, con la colonna «numero d'ordine»: le colonne
//     dall'intestazione, l'ID del foglio come scritto a mano (difetto 10);
//   - ogni richiesta col suo anno e il termine senza anno letto dalla mail,
//     caricato il 21/12/2026 e ricaricato l'08/01/2027 (difetto 3);
//   - le richieste di dicembre ancora aperte a gennaio, e il loro ritiro
//     riconosciuto dopo le primarie (difetto 2).
import { abbinaRichieste, chiaveRichiesta, idOrdineDaSalvare, riconosciOrdine, ritiriTerminati, evasioneOrdini, listaOrdini, testoTerminatiSenzaFine, ordiniConDateDaSistemare, testoOrdiniDateDaSistemare } from '../base44/shared/richiesteEct.ts';
import * as R from '../base44/shared/richiesteEct.ts';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// L'elenco com'e' oggi: ogni richiesta porta la riga da cui fu letta e cio' che ha messo l'utente
const esistenti = [
  { id: 'A', riga_excel: 3, pdr_nome: 'Rossi Gomme', classe: 'P', ordine_immesso_il: '2026-08-01', mail_inviata_il: '2026-08-20', nota: 'entro settembre', evasione_confermata: true },
  { id: 'B', riga_excel: 4, pdr_nome: 'Bianchi Pneumatici S.r.l.', classe: '', ordine_immesso_il: '2026-08-05', mail_inviata_il: '2026-08-20', nota: '', id_ordine_manuale: 'ET26111111' },
  // due ordini dello stesso produttore lo stesso giorno, senza classe: nel foglio vero succede
  { id: 'C1', riga_excel: 5, pdr_nome: 'Perrone Elio', classe: '', ordine_immesso_il: '2026-05-25', mail_inviata_il: '2026-08-28', nota: 'P', trasportatore: 'NAPPI SUD' },
  { id: 'C2', riga_excel: 6, pdr_nome: 'Perrone Elio', classe: '', ordine_immesso_il: '2026-05-25', mail_inviata_il: '2026-08-28', nota: 'M', trasportatore: 'NAPPI SUD' },
  { id: 'D', riga_excel: 7, pdr_nome: 'Verdi Auto', classe: 'M', ordine_immesso_il: '2026-09-01', mail_inviata_il: null, nota: '' },
];
const riga = (e, n, altro = {}) => ({ riga_excel: n, pdr_nome: e.pdr_nome, classe: e.classe, ordine_immesso_il: e.ordine_immesso_il, mail_inviata_il: e.mail_inviata_il, nota: e.nota, trasportatore: e.trasportatore, ...altro });
const ids = (a) => a.map(e => (e ? e.id : null)).join(',');

console.log('FOGLIO INVARIATO');
verifica('ognuna ritrova se stessa', ids(abbinaRichieste(esistenti.map(e => riga(e, e.riga_excel)), esistenti)) === 'A,B,C1,C2,D');

console.log('UNA RIGA INSERITA IN CIMA (tutte scendono di uno)');
const nuova = { riga_excel: 3, pdr_nome: 'Nuovo Gommista', classe: 'G1', ordine_immesso_il: '2026-09-10', mail_inviata_il: '2026-09-15', nota: '' };
const scese = [nuova, ...esistenti.map(e => riga(e, e.riga_excel + 1))];
const a1 = abbinaRichieste(scese, esistenti);
verifica('la nuova non ruba la spunta di Rossi (che stava alla riga 3)', a1[0] === null);
verifica('le altre restano se stesse', ids(a1.slice(1)) === 'A,B,C1,C2,D', ids(a1));

console.log('FOGLIO ORDINATO AL CONTRARIO');
const rovescio = [...esistenti].reverse().map((e, i) => riga(e, 3 + i));
verifica('ognuna ritrova se stessa, gemelle comprese (le distingue la nota)', ids(abbinaRichieste(rovescio, esistenti)) === 'D,C2,C1,B,A', ids(abbinaRichieste(rovescio, esistenti)));

console.log('CORREZIONI NEL FOGLIO');
const conMail = esistenti.map(e => riga(e, e.riga_excel, e.id === 'D' ? { mail_inviata_il: '2026-09-12' } : {}));
verifica('aggiunta la data della mail: resta la stessa richiesta', ids(abbinaRichieste(conMail, esistenti)) === 'A,B,C1,C2,D');
const conData = esistenti.map(e => riga(e, e.riga_excel, e.id === 'B' ? { ordine_immesso_il: '2026-08-06' } : {}));
verifica('corretta la data di immissione sulla stessa riga: resta la stessa richiesta', ids(abbinaRichieste(conData, esistenti)) === 'A,B,C1,C2,D');
const nomeScritto = esistenti.map(e => riga(e, e.riga_excel, e.id === 'B' ? { pdr_nome: 'BIANCHI  PNEUMATICI SRL' } : {}));
verifica('maiuscole, spazi e punteggiatura del nome non contano', ids(abbinaRichieste(nomeScritto, esistenti)) === 'A,B,C1,C2,D');

console.log('RIGA TOLTA DAL FOGLIO');
const senzaB = esistenti.filter(e => e.id !== 'B').map((e, i) => riga(e, 3 + i));
const a2 = abbinaRichieste(senzaB, esistenti);
verifica('nessuna prende il posto di quella tolta', ids(a2) === 'A,C1,C2,D' && !a2.some(e => e && e.id === 'B'), ids(a2));
verifica('ogni richiesta esistente si abbina al massimo una volta', new Set(a1.filter(Boolean).map(e => e.id)).size === a1.filter(Boolean).length);
verifica('chiave: il giorno conta, l\'ora no', chiaveRichiesta({ pdr_nome: 'x', ordine_immesso_il: '2026-08-01T00:00:00.000Z' }) === chiaveRichiesta({ pdr_nome: 'X', ordine_immesso_il: '2026-08-01' }));

// La stessa regola per il foglio ECT (importaRichiesteEct) e per il ricalcolo
// dopo le primarie (importaBlocco): un ID riconosciuto non si perde.
console.log('ID GIA\' RICONOSCIUTO');
const richiesta = { pdr_nome: 'Rossi Gomme', classe: '', ordine_immesso_il: '2026-09-01' };
const gia = { ...richiesta, id_ordine: 'ET26000001', id_ordine_stato: 'trovato', id_ordine_candidati: '' };
const unOrdine = [{ id_ordine: 'ET26000001', punto_di_raccolta: 'ROSSI GOMME', ordine_immesso_il: '2026-09-01T07:00:00Z', stato: 'terminato' }];
const dueOrdini = [...unOrdine, { id_ordine: 'ET26000002', punto_di_raccolta: 'ROSSI GOMME', ordine_immesso_il: '2026-09-01T09:00:00Z', stato: 'assegnato' }];
const ambiguo = riconosciOrdine(richiesta, dueOrdini);
verifica('un secondo ordine dello stesso giorno rende ambiguo il riconoscimento', ambiguo.id_ordine_stato === 'ambiguo' && ambiguo.id_ordine === '', JSON.stringify(ambiguo));
const tenuto = idOrdineDaSalvare(gia, ambiguo);
verifica('ma l\'ID gia\' riconosciuto resta, col suo stato', tenuto.id_ordine === 'ET26000001' && tenuto.id_ordine_stato === 'trovato', JSON.stringify(tenuto));
verifica('e resta anche se l\'ordine non si trova piu\'', idOrdineDaSalvare(gia, riconosciOrdine(richiesta, [])).id_ordine === 'ET26000001');
verifica('un altro ID lo sostituisce', idOrdineDaSalvare(gia, { id_ordine: 'ET26000009', id_ordine_stato: 'trovato', id_ordine_candidati: '' }).id_ordine === 'ET26000009');
const nuovo = idOrdineDaSalvare(null, ambiguo);
verifica('senza ID salvato vale il riconoscimento, ambiguo compreso', nuovo.id_ordine === '' && nuovo.id_ordine_stato === 'ambiguo' && nuovo.id_ordine_candidati === 'ET26000001, ET26000002' && idOrdineDaSalvare({ ...richiesta, id_ordine: '' }, ambiguo).id_ordine_stato === 'ambiguo', JSON.stringify(nuovo));
verifica('richiesta nuova: il riconoscimento', idOrdineDaSalvare(null, riconosciOrdine(richiesta, unOrdine)).id_ordine === 'ET26000001');

console.log('RITIRI SULLA FINE TRASPORTO');
const { terminati, senzaFine } = ritiriTerminati([
  { id_ordine: 'A', stato: 'terminato', trasporto_finito_il: '2026-09-30T22:30:00Z', ordine_chiuso_il: '2026-10-04T08:00:00Z' },
  { id_ordine: 'B', stato: 'Terminato', trasporto_finito_il: null, ordine_chiuso_il: '2026-09-20T08:00:00Z' },
  { id_ordine: 'C', stato: 'assegnato', trasporto_finito_il: null },
  { id_ordine: 'D', stato: 'terminato', trasporto_finito_il: null },
  { id_ordine: 'D', stato: 'terminato', trasporto_finito_il: '2026-09-12T08:00:00Z' },
]);
verifica('il giorno e\' quello italiano della fine trasporto, mai la chiusura', terminati.get('A') === '2026-10-01', terminati.get('A'));
verifica('un terminato senza fine trasporto non e\' ritirato, e non ripiega sulla chiusura', !terminati.has('B') && senzaFine.has('B'));
verifica('chi non e\' terminato non e\' in nessuno dei due', !terminati.has('C') && !senzaFine.has('C'));
verifica('basta una riga con la data perche\' l\'ordine sia ritirato', terminati.get('D') === '2026-09-12' && !senzaFine.has('D'));
const ev = evasioneOrdini(listaOrdini({ id_ordine_manuale: 'A, B' }), terminati);
verifica('una richiesta con un ordine senza data non e\' evasa', ev.totali === 2 && ev.evasi === 1 && ev.ultima === null, JSON.stringify(ev));
verifica('il testo dice quante e quali restano aperte', testoTerminatiSenzaFine([{ pdr: 'Rossi Gomme', id_ordine: 'B' }]).startsWith('Una richiesta') && testoTerminatiSenzaFine([{ pdr: 'X', id_ordine: 'B' }, { pdr: 'Y', id_ordine: 'E' }]).includes('2 richieste') && testoTerminatiSenzaFine([]) === '');

console.log('RITIRI CON LE DATE DA SISTEMARE (regola del 22/09/2026)');
const conDate = ritiriTerminati([
  { id_ordine: 'F', stato: 'terminato', ordine_immesso_il: '2026-09-01T08:00:00Z', trasporto_iniziato_il: null, trasporto_finito_il: '2026-09-10T08:00:00Z' },
  { id_ordine: 'G', stato: 'terminato', ordine_immesso_il: '2026-09-01T08:00:00Z', trasporto_iniziato_il: '2026-09-09T08:00:00Z', trasporto_finito_il: '2026-09-10T08:00:00Z' },
  { id_ordine: 'H', stato: 'terminato', ordine_immesso_il: '2026-09-01T08:00:00Z', trasporto_iniziato_il: '2026-09-09T08:00:00Z', trasporto_finito_il: null },
]);
verifica('senza inizio trasporto il ritiro conta, ma resta fra le date da sistemare', conDate.terminati.get('F') === '2026-09-10' && conDate.daSistemare.get('F') === 'manca la data di inizio trasporto');
verifica('le date a posto non ci sono, il senza fine resta fra i senza fine', !conDate.daSistemare.has('G') && !conDate.daSistemare.has('H') && conDate.senzaFine.has('H'));
const voci = ordiniConDateDaSistemare('Rossi Gomme', ['F', 'G', 'H'], conDate.terminati, conDate.daSistemare);
verifica('gli ordini di una richiesta con le date da sistemare, uno per ordine', voci.length === 1 && voci[0].pdr === 'Rossi Gomme' && voci[0].id_ordine === 'F' && voci[0].date === 'manca la data di inizio trasporto', JSON.stringify(voci));
verifica('il testo dice quali e che cosa manca', testoOrdiniDateDaSistemare(voci).startsWith('Un ordine') && testoOrdiniDateDaSistemare(voci).includes('Rossi Gomme (F: manca la data di inizio trasporto)') && testoOrdiniDateDaSistemare([...voci, { ...voci[0], id_ordine: 'Z' }]).startsWith('2 ordini') && testoOrdiniDateDaSistemare([]) === '');

// ===========================================================================
// LA PROVA DEL CAMBIO D'ANNO (15/10/2026)
// ===========================================================================
const J = (x) => JSON.stringify(x);
const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
const XLSX = createRequire(import.meta.url)('xlsx');
// Il giorno come lo scrive Excel: la mezzanotte locale (la libreria lo riporta
// cosi' alla lettura, e soloData prende le cifre del calendario locale).
const d = (s) => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
// L'orologio fermo su un istante, anche per le funzioni asincrone.
const DataVera = Date;
const alle = async (iso, f) => {
  const ms = DataVera.parse(iso);
  globalThis.Date = class extends DataVera { constructor(...a) { if (a.length) super(...a); else super(ms); } static now() { return ms; } };
  try { return await f(); } finally { globalThis.Date = DataVera; }
};
// importaRichiesteEct vera, impacchettata con un SDK finto che legge e scrive
// globalThis.__ARCHIVI e apre il file con un link firmato finto (fetch e' finto
// anche lui: restituisce il foglio costruito qui).
const SDK_FINTO = `
const uguale = (r, f) => Object.entries(f || {}).every(([k, v]) => r[k] === v);
let progressivo = 0;
function entita(nome) {
  const righe = () => (globalThis.__ARCHIVI[nome] ||= []);
  return {
    filter: async (f, _o, quanti = 1e9, salta = 0) => { globalThis.__LETTURE.push({ nome, filtro: f }); return righe().filter(r => uguale(r, f)).slice(salta, salta + quanti).map(r => ({ ...r })); },
    list: async (_o, quanti = 1e9, salta = 0) => { globalThis.__LETTURE.push({ nome, filtro: null }); return righe().slice(salta, salta + quanti).map(r => ({ ...r })); },
    create: async (dati) => { const r = { id: nome + '-' + (++progressivo), ...dati }; righe().push(r); return { ...r }; },
    update: async (id, dati) => { const r = righe().find(x => x.id === id); if (!r) throw new Error('non trovato ' + id); Object.assign(r, dati); return { ...r }; },
  };
}
const entities = new Proxy({}, { get: (_t, nome) => entita(nome) });
const integrations = { Core: { CreateFileSignedUrl: async () => ({ signed_url: 'https://file.finto/richieste.xlsx' }) } };
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: 'admin', email: 'prova@prova' }) }, asServiceRole: { entities, integrations }, entities, integrations };
}`;
let importa = null;
try {
  const p = await build({
    entryPoints: [qui('../base44/functions/importaRichiesteEct/entry.ts')],
    bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent', mainFields: ['module', 'main'],
    plugins: [{ name: 'finti', setup(b) {
      b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'finto' }));
      b.onLoad({ filter: /.*/, namespace: 'finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
      b.onResolve({ filter: /^npm:xlsx/ }, () => ({ path: qui('../node_modules/xlsx/xlsx.mjs') }));
    } }],
  });
  importa = await import('data:text/javascript;base64,' + Buffer.from(p.outputFiles[0].text).toString('base64'));
} catch (e) { verifica('importaRichiesteEct si impacchetta', false, String(e && e.message).slice(0, 300)); }
const VUOTI = () => ({ Assegnato: [], AssegnatoAci: [], PrimariaRete: [], PrimariaAci: [], UploadLog: [], FileDaRimuovere: [] });
/** Il foglio come lo scrive Excel: dalla riga `riga` (il file vero parte dalla 2), con le celle unite dell'intestazione. */
const fileDi = (aoa, { riga = 1, unite = null } = {}) => {
  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true, origin: riga > 1 ? `A${riga}` : undefined });
  if (unite) ws['!merges'] = unite;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Richieste ECT');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
};
/** importaRichiesteEct sull'archivio `archivi` (che resta scritto), alle `iso`, col file `buf`. */
const caricaFoglio = async (buf, archivi, iso) => {
  if (!importa) return { status: 0, body: {} };
  globalThis.__ARCHIVI = archivi;
  globalThis.__LETTURE = [];
  const fetchVero = globalThis.fetch;
  globalThis.fetch = async () => new Response(buf);
  try {
    return await alle(iso, async () => { const r = await importa.default({ json: async () => ({ file_uri: 'privato/richieste.xlsx' }) }); return { status: r.status, body: await r.json() }; });
  } finally { globalThis.fetch = fetchVero; }
};

console.log('IL FOGLIO DEL 09/10/2026: LE COLONNE DALL\'INTESTAZIONE (difetto 10)');
{
  // Il foglio fino al 09/10/2026 e quello di adesso, con «numero d'ordine» dopo
  // la provincia: le stesse richieste, una colonna piu' in la'.
  const DI_PRIMA = [
    ['RICHIESTA ECT', 'provincia', 'DATE', null, 'trasportatore', 'mail inviata il', null],
    [null, null, 'ordine immesso', 'ordine evaso', null, null, null],
    ['ROSSI GOMME P', 'BA', d('2026-09-01'), null, 'smoco', d('2026-09-20'), 'entro ottobre'],
    ['BIANCHI PNEUMATICI', 'LE', d('2026-08-01'), d('2026-09-10'), 'gatim', d('2026-08-27'), 'entro settembre'],
    ['VERDI AUTO', 'TA', d('2026-08-02'), 'cancellato per mancanza di pfu', 'smoco', d('2026-08-27'), 'entro settembre'],
  ];
  const DI_ADESSO = [
    ['RICHIESTA ECT', 'provincia', 'numero d\'ordine ', 'DATE', null, 'trasportatore', 'mail inviata il', null],
    [null, null, null, 'ordine immesso', 'ordine evaso', null, null, null],
    ['ROSSI GOMME P', 'BA', 'ET26086547', d('2026-09-01'), null, 'smoco', d('2026-09-20'), 'entro ottobre'],
    ['BIANCHI PNEUMATICI', 'LE', null, d('2026-08-01'), d('2026-09-10'), 'gatim', d('2026-08-27'), 'entro settembre'],
    ['VERDI AUTO', 'TA', null, d('2026-08-02'), 'cancellato per mancanza di pfu', 'smoco', d('2026-08-27'), 'entro settembre'],
    // un ID scritto senza la data di immissione: e' una richiesta lo stesso
    ['NERI GOMME M', 'CS', 'et26000003', null, null, 'smoco', d('2026-10-05'), 'entro ottobre'],
  ];
  const campi = (x) => ({ riga: x.riga_excel, pdr: x.pdr_nome, classe: x.classe, prov: x.provincia, imm: x.ordine_immesso_il, tr: x.trasportatore, mail: x.mail_inviata_il, nota: x.nota, evaso: x.evaso_il, motivo: x.motivo_annullamento });
  const prima = R.leggiFoglio(DI_PRIMA, 2);
  const adesso = R.leggiFoglio(DI_ADESSO, 2);
  verifica('il foglio di adesso si legge: quattro richieste, l\'ultima senza immissione ma con l\'ID', adesso.length === 4, J(adesso));
  verifica('trasportatore, mail e nota dalla loro colonna, non da quella prima', adesso[0] && adesso[0].trasportatore === 'smoco' && adesso[0].mail_inviata_il === '2026-09-20' && adesso[0].nota === 'entro ottobre' && adesso[0].ordine_immesso_il === '2026-09-01', J(adesso[0]));
  verifica('le richieste lette dai due fogli sono le stesse', J(adesso.slice(0, 3).map(campi)) === J(prima.map(campi)), J({ prima: prima.map(campi), adesso: adesso.slice(0, 3).map(campi) }));
  verifica('l\'ID del foglio, in maiuscolo; dove manca, vuoto', adesso.map(x => x.id_ordine_foglio).join('|') === 'ET26086547|||ET26000003', adesso.map(x => x.id_ordine_foglio).join('|'));
  verifica('il foglio di prima si legge come prima: tre richieste, nessun ID', prima.length === 3 && prima.every(x => !x.id_ordine_foglio) && prima[1].evaso_il === '2026-09-10' && prima[2].motivo_annullamento === 'cancellato per mancanza di pfu', J(prima));
  const senzaTesta = R.leggiFoglio(DI_PRIMA.slice(2), 4);
  verifica('senza intestazione vale l\'ordine di prima', J(senzaTesta.map(campi)) === J(prima.map(campi)), J(senzaTesta.map(campi)));
  verifica('una scritta che non e\' un ID non vale', typeof R.idOrdiniDelFoglio === 'function' && R.idOrdiniDelFoglio('da chiedere') === '' && R.idOrdiniDelFoglio('et26000001; ET26000002') === 'ET26000001, ET26000002');

  // La funzione vera, col foglio impaginato come il file del 09/10/2026: parte
  // dalla riga 2, «DATE» unita sulle due colonne delle date.
  const UNITE = [{ s: { c: 0, r: 1 }, e: { c: 0, r: 2 } }, { s: { c: 1, r: 1 }, e: { c: 1, r: 2 } }, { s: { c: 3, r: 1 }, e: { c: 4, r: 1 } }, { s: { c: 5, r: 1 }, e: { c: 5, r: 2 } }, { s: { c: 6, r: 1 }, e: { c: 6, r: 2 } }, { s: { c: 2, r: 1 }, e: { c: 2, r: 2 } }];
  // Gli ordini del foglio sono fra gli assegnati: l'ID del foglio si prende solo
  // cosi' (revisione del 15/10/2026, piu' sotto).
  const ASSEGNATI_DEL_FOGLIO = [
    { id: 'as1', id_ordine: 'ET26086547', stato: 'assegnato', punto_di_raccolta: 'ROSSI GOMME', classe: 'P', ordine_immesso_il: '2026-09-01T08:00:00Z' },
    { id: 'as2', id_ordine: 'ET26000003', stato: 'assegnato', punto_di_raccolta: 'NERI GOMME', classe: 'M', ordine_immesso_il: '2026-09-30T08:00:00Z' },
  ];
  const archivio = { ...VUOTI(), Assegnato: ASSEGNATI_DEL_FOGLIO.map(x => ({ ...x })), RichiestaEct: [] };
  const r1 = await caricaFoglio(fileDi(DI_ADESSO, { riga: 2, unite: UNITE }), archivio, '2026-10-15T09:00:00Z');
  verifica('15/10/2026: il foglio di adesso si carica, quattro richieste nuove', r1.status === 200 && r1.body.creati === 4 && archivio.RichiestaEct.length === 4, `${r1.status} ${J(r1.body).slice(0, 300)}`);
  const di = (nome) => archivio.RichiestaEct.find(x => x.pdr_nome === nome) || {};
  verifica('l\'ID del foglio vale come scritto a mano (vince sul riconoscimento)', di('ROSSI GOMME').id_ordine_manuale === 'ET26086547' && di('NERI GOMME').id_ordine_manuale === 'ET26000003' && !di('BIANCHI PNEUMATICI').id_ordine_manuale && r1.body.id_dal_foglio === 2, J(archivio.RichiestaEct.map(x => [x.pdr_nome, x.id_ordine_manuale])));
  verifica('riga del foglio, trasportatore e mail giusti', di('ROSSI GOMME').riga_excel === 4 && di('ROSSI GOMME').trasportatore === 'smoco' && di('ROSSI GOMME').mail_inviata_il === '2026-09-20' && di('ROSSI GOMME').scadenza === '2026-10-31', J(di('ROSSI GOMME')));
  // Un ID scritto a mano nel gestionale resta il suo: il foglio non lo cambia, e si dice.
  const rossi = archivio.RichiestaEct.find(x => x.pdr_nome === 'ROSSI GOMME');
  if (rossi) rossi.id_ordine_manuale = 'ET26099999';
  const r2 = await caricaFoglio(fileDi(DI_ADESSO, { riga: 2, unite: UNITE }), archivio, '2026-10-16T09:00:00Z');
  verifica('ricaricato: nessuna nuova, e l\'ID scritto a mano nel gestionale resta', r2.status === 200 && r2.body.creati === 0 && archivio.RichiestaEct.length === 4 && di('ROSSI GOMME').id_ordine_manuale === 'ET26099999', `${r2.status} ${J(r2.body).slice(0, 200)}`);
  verifica('e la risposta dice che il foglio ne dice un altro, e che quello del gestionale non c\'e\' fra gli ordini', J(r2.body.id_diversi_dal_foglio) === J([{ pdr: 'ROSSI GOMME', foglio: 'ET26086547', gestionale: 'ET26099999', gestionale_trovato: false, foglio_trovato: true }]), J(r2.body.id_diversi_dal_foglio));
  // Controprova: il foglio di prima si carica come prima.
  const vecchio = { ...VUOTI(), RichiestaEct: [] };
  const r3 = await caricaFoglio(fileDi(DI_PRIMA), vecchio, '2026-10-15T09:00:00Z');
  verifica('il foglio di prima si carica come prima: tre richieste, nessun ID dal foglio', r3.status === 200 && r3.body.creati === 3 && r3.body.id_dal_foglio === 0 && vecchio.RichiestaEct.every(x => !x.id_ordine_manuale), `${r3.status} ${J(r3.body).slice(0, 200)}`);

  // Il file vero, se c'e' su questo computer (sola lettura): si carica tutto.
  const VERO = 'C:/Users/HOME/Desktop/ECOTYRE/Gestione Ecotyre 2026 NEW (1).xlsx';
  if (existsSync(VERO)) {
    const buf = readFileSync(VERO);
    const ws = XLSX.read(buf, { type: 'buffer', cellDates: true, sheets: ['Richieste ECT'] }).Sheets['Richieste ECT'];
    const griglia = ws ? XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, cellDates: true }) : [];
    const lette = R.leggiFoglio(griglia, 1);
    const conId = lette.filter(x => x.id_ordine_foglio).length;
    // Le righe col nome del produttore sotto le due d'intestazione: ognuna e' una
    // richiesta. Il file del 09/10/2026 ne ha 56, 13 con l'ID scritto (l'area del
    // foglio arriva alla riga 67, ma le ultime otto sono vuote); il file si
    // aggiorna, percio' almeno quelle.
    const conNome = griglia.slice(2).filter(r => r && String(r[0] ?? '').trim()).length;
    // Gli ordini del foglio fra gli assegnati, come sul sito: tutti gli ID si prendono.
    const suoiOrdini = lette.flatMap(x => listaOrdini({ id_ordine_manuale: x.id_ordine_foglio }).map(id => ({ id: 'as-' + id, id_ordine: id, stato: 'assegnato', punto_di_raccolta: x.pdr_nome })));
    const archivioVero = { ...VUOTI(), Assegnato: suoiOrdini, RichiestaEct: [] };
    const rv = await caricaFoglio(buf, archivioVero, '2026-10-15T09:00:00Z');
    verifica(`il file vero si carica: ${lette.length} richieste, ${conId} con l'ID dal foglio`, rv.status === 200 && lette.length === conNome && lette.length >= 56 && conId >= 13 && rv.body.creati === lette.length && rv.body.id_dal_foglio === conId, `${rv.status} ${J(rv.body).slice(0, 200)}`);
    // Con gli archivi vuoti si carica lo stesso, ma nessun ID del foglio si prende: si dicono tutti.
    const vuoto = { ...VUOTI(), RichiestaEct: [] };
    const rz = await caricaFoglio(buf, vuoto, '2026-10-15T09:00:00Z');
    verifica('il file vero con gli archivi vuoti: tutte caricate, nessun ID preso, tutti detti', rz.status === 200 && rz.body.creati === lette.length && rz.body.id_dal_foglio === 0 && (rz.body.id_del_foglio_non_trovati || []).length === conId && vuoto.RichiestaEct.every(x => !x.id_ordine_manuale), `${rz.status} ${J(rz.body).slice(0, 200)}`);
  } else console.log('  (il file di gestione vero non c\'e\' su questo computer: quella verifica si salta)');
}

console.log('OGNI RICHIESTA COL SUO ANNO, IL TERMINE DALLA MAIL (difetto 3)');
{
  const S = (nota, rif) => { try { return R.scadenzaDaNota(nota, rif); } catch (e) { return 'errore: ' + (e && e.message); } };
  verifica('mail del 18/12/2026, «DA FARE ENTRO IL 10/01» = 10/01/2027', S('DA FARE ENTRO IL 10/01', '2026-12-18') === '2027-01-10', S('DA FARE ENTRO IL 10/01', '2026-12-18'));
  verifica('mail del 18/12/2026, «entro gennaio» = 31/01/2027', S('entro gennaio', '2026-12-18') === '2027-01-31', S('entro gennaio', '2026-12-18'));
  verifica('mail del 22/12/2026, «entro metà gennaio» = 15/01/2027', S('entro metà gennaio', '2026-12-22') === '2027-01-15', S('entro metà gennaio', '2026-12-22'));
  verifica('mail del 10/12/2026, «entro il 20/12» = 20/12/2026', S('DA FARE ENTRO IL 20/12', '2026-12-10') === '2026-12-20', S('DA FARE ENTRO IL 20/12', '2026-12-10'));
  verifica('con l\'anno scritto vale quello: «DA FARE ENTRO IL 08/01/2027» resta 08/01/2027', S('DA FARE ENTRO IL 08/01/2027', '2026-12-22') === '2027-01-08' && S('DA FARE ENTRO IL 08/01/27', '2026-12-22') === '2027-01-08');
  verifica('con piu\' mesi il piu\' lontano, anche oltre l\'anno: «dicembre/gennaio» del 05/12/2026 = 31/01/2027', S('entro dicembre/gennaio', '2026-12-05') === '2027-01-31' && S('settembre/ottobre', '2026-08-27') === '2026-10-31');
  verifica('i termini del foglio di oggi restano quelli: «entro settembre» del 27/08, «L\'11/09» del 30/08, «PROGRAMMATO PER 01/10» del 22/09',
    S('entro settembre', '2026-08-27') === '2026-09-30' && S('DA FARE ENTRO L\'11/09', '2026-08-30') === '2026-09-11' && S('entro la settimana 40 (PROGRAMMATO PER 01/10)', '2026-09-22') === '2026-10-01' && S('entro metà ottobre', '2026-09-15') === '2026-10-15');
  // Un termine gia' passato quando parte la mail resta nel suo anno: l'anno dopo
  // vale solo entro sei mesi dalla mail (il passaggio di dicembre).
  verifica('un termine gia\' passato alla mail resta nell\'anno: «entro l\'11/09» del 12/09/2026 = 11/09/2026, «entro settembre» del 05/10/2026 = 30/09/2026',
    S('DA FARE ENTRO L\'11/09', '2026-09-12') === '2026-09-11' && S('entro settembre', '2026-10-05') === '2026-09-30' && S('entro maggio', '2026-12-18') === '2027-05-31' && S('entro luglio', '2026-12-18') === '2026-07-31',
    J([S('DA FARE ENTRO L\'11/09', '2026-09-12'), S('entro settembre', '2026-10-05'), S('entro maggio', '2026-12-18'), S('entro luglio', '2026-12-18')]));
  verifica('con un anno al posto della mail, la regola di prima', S('entro settembre', 2026) === '2026-09-30' && S('DA FARE ENTRO IL 10/01', 2026) === '2026-01-10' && S('', '2026-12-18') === null && S('nessun termine', '2026-12-18') === null);
  verifica('l\'anno di una richiesta: la mail, o l\'immissione se la mail manca', typeof R.annoRichiesta === 'function' && R.annoRichiesta({ mail_inviata_il: '2026-12-18', ordine_immesso_il: '2025-10-01' }) === 2026 && R.annoRichiesta({ ordine_immesso_il: '2025-10-01' }) === 2025 && R.annoRichiesta({}) === null);

  // Il foglio con le richieste di dicembre, caricato il 21/12/2026 e ricaricato
  // l'08/01/2027 con la prima richiesta di gennaio. Impaginato come prima del
  // 09/10/2026, senza il numero d'ordine: l'anno non dipende dalle colonne, e
  // cosi' la controprova sul codice di prima arriva fino ai doppioni.
  const TESTA = [['RICHIESTA ECT', 'provincia', 'DATE', null, 'trasportatore', 'mail inviata il', null], [null, null, 'ordine immesso', 'ordine evaso', null, null, null]];
  const DIC = [
    ['ROSSI GOMME', 'BA', d('2026-12-18'), null, 'smoco', d('2026-12-18'), 'DA FARE ENTRO IL 10/01'],
    ['BIANCHI PNEUMATICI', 'BA', d('2026-12-18'), null, 'smoco', d('2026-12-18'), 'entro gennaio'],
    ['VERDI AUTO', 'BA', d('2026-12-10'), d('2026-12-19'), 'smoco', d('2026-12-10'), 'DA FARE ENTRO IL 20/12'],
  ];
  const GEN = [['NERI AUTO', 'BA', d('2027-01-05'), null, 'smoco', d('2027-01-05'), 'entro il 25/01']];
  const archivio = { ...VUOTI(), RichiestaEct: [] };
  const a = await caricaFoglio(fileDi([...TESTA, ...DIC]), archivio, '2026-12-21T09:00:00Z');
  const di = (nome) => archivio.RichiestaEct.filter(x => x.pdr_nome === nome);
  verifica('21/12/2026: tre richieste del 2026', a.status === 200 && a.body.creati === 3 && archivio.RichiestaEct.every(x => x.anno === 2026), `${a.status} ${J(a.body).slice(0, 200)}`);
  verifica('«entro il 10/01» e\' fra 20 giorni, non in ritardo di 345', di('ROSSI GOMME')[0] && di('ROSSI GOMME')[0].scadenza === '2027-01-10' && R.giorniAllaScadenza(di('ROSSI GOMME')[0].scadenza, '2026-12-21') === 20, J(di('ROSSI GOMME')));
  verifica('«entro gennaio» e\' il 31/01/2027, «entro il 20/12» il 20/12/2026', di('BIANCHI PNEUMATICI')[0] && di('BIANCHI PNEUMATICI')[0].scadenza === '2027-01-31' && di('VERDI AUTO')[0] && di('VERDI AUTO')[0].scadenza === '2026-12-20');
  // Il 28/12 l'utente risponde al consorzio per quella evasa e la spunta.
  const verdi = archivio.RichiestaEct.find(x => x.pdr_nome === 'VERDI AUTO');
  if (verdi) Object.assign(verdi, { evasione_confermata: true, evasione_confermata_il: '2026-12-28' });
  const primaDi = (nome) => di(nome)[0] || {};
  const b = await caricaFoglio(fileDi([...TESTA, ...DIC, ...GEN]), archivio, '2027-01-08T09:00:00Z');
  verifica('08/01/2027: una sola richiesta nuova, nessun doppione di dicembre', b.status === 200 && b.body.creati === 1 && archivio.RichiestaEct.length === 4 && ['ROSSI GOMME', 'BIANCHI PNEUMATICI', 'VERDI AUTO', 'NERI AUTO'].every(n => di(n).length === 1), `${b.status} ${J(b.body).slice(0, 200)} ${J(archivio.RichiestaEct.map(x => [x.pdr_nome, x.anno]))}`);
  verifica('ognuna col suo anno: dicembre resta 2026, gennaio e\' 2027', J(archivio.RichiestaEct.map(x => `${x.pdr_nome}:${x.anno}`)) === J(['ROSSI GOMME:2026', 'BIANCHI PNEUMATICI:2026', 'VERDI AUTO:2026', 'NERI AUTO:2027']), J(archivio.RichiestaEct.map(x => `${x.pdr_nome}:${x.anno}`)));
  verifica('i termini restano quelli: «entro il 20/12» non diventa il 20/12/2027', primaDi('VERDI AUTO').scadenza === '2026-12-20' && primaDi('ROSSI GOMME').scadenza === '2027-01-10' && primaDi('NERI AUTO').scadenza === '2027-01-25', J(archivio.RichiestaEct.map(x => [x.pdr_nome, x.scadenza])));
  verifica('la spunta resta: la richiesta risposta resta evasa e spuntata', di('VERDI AUTO').length > 0 && di('VERDI AUTO').every(x => x.evasione_confermata === true && x.esito === 'evasa'), J(di('VERDI AUTO')));
  verifica('le richieste salvate si leggono con una lettura sola, senza filtro sull\'anno', J(globalThis.__LETTURE.filter(l => l.nome === 'RichiestaEct')) === J([{ nome: 'RichiestaEct', filtro: null }]), J(globalThis.__LETTURE.filter(l => l.nome === 'RichiestaEct')));
  // Controprova: un foglio di un anno solo, ricaricato, si comporta come prima.
  const c = await caricaFoglio(fileDi([...TESTA, ...DIC]), archivio, '2027-01-09T09:00:00Z');
  verifica('il foglio di dicembre ricaricato: niente di nuovo, e quella di gennaio non si tocca', c.status === 200 && c.body.creati === 0 && c.body.orfane === 0 && archivio.RichiestaEct.length === 4, `${c.status} ${J(c.body).slice(0, 200)}`);
}

console.log('LE RICHIESTE DI DICEMBRE A GENNAIO (difetto 2)');
{
  const lista = [
    { id: 'a26', anno: 2026, esito: 'aperta' },
    { id: 'r26', anno: 2026, esito: 'evasa', evasione_rilevata_il: '2026-12-22' },
    { id: 's26', anno: 2026, esito: 'evasa', evasione_rilevata_il: '2026-12-22', evasione_confermata: true },
    { id: 'n26', anno: 2026, esito: 'annullata', motivo_annullamento: 'cancellato per mancanza di pfu' },
    { id: 'v26', anno: 2026, esito: 'da_confermare' },
    { id: 'x25', anno: 2025, esito: 'aperta' },
    { id: 'c27', anno: 2027, esito: 'evasa', evasione_confermata: true },
    { id: 'a28', anno: 2028, esito: 'aperta' },
    { id: 'senza', mail_inviata_il: '2026-11-03', esito: 'aperta' },
  ];
  const ids2 = (a) => (a || []).map(x => x.id).join(',');
  verifica('le funzioni ci sono', typeof R.richiesteDaSeguire === 'function' && typeof R.ancoraDaSeguire === 'function');
  if (typeof R.richiesteDaSeguire === 'function') {
    verifica('nel 2027: quelle del 2027 e, degli anni prima, le aperte e le evase non ancora risposte', ids2(R.richiesteDaSeguire(lista, 2027)) === 'a26,r26,v26,x25,c27,senza', ids2(R.richiesteDaSeguire(lista, 2027)));
    verifica('nel 2026: tutte quelle del 2026, anche chiuse; niente del 2027 e del 2028', ids2(R.richiesteDaSeguire(lista, 2026)) === 'a26,r26,s26,n26,v26,x25,senza', ids2(R.richiesteDaSeguire(lista, 2026)));
  }

  // Il ricalcolo dopo le primarie (importaBlocco, ritiri_ect) vero, sul banco: il
  // 15/01/2027 riconosce il ritiro dell'08/01/2027 di una richiesta del 2026.
  const { caricaFunzione, chiama } = await import('./dati/bancoFunzioni.mjs');
  let F = null;
  try { F = await caricaFunzione('importaBlocco'); } catch (e) { verifica('importaBlocco si impacchetta', false, String(e && e.message).slice(0, 200)); }
  if (F) {
    const richieste = [
      { id: 'ect1', anno: 2026, pdr_nome: 'GOMMISTA ALFA', classe: 'P', id_ordine: 'ET26990001', id_ordine_stato: 'trovato', ordine_immesso_il: '2026-12-01', mail_inviata_il: '2026-12-14', scadenza: '2026-12-30', esito: 'aperta', ordini_totali: 1, ordini_evasi: 0 },
      // evasa a dicembre e gia' risposta: e' chiusa, e resta nel 2026
      { id: 'ect2', anno: 2026, pdr_nome: 'GOMMISTA BETA', id_ordine_manuale: 'ET26990002', ordine_immesso_il: '2026-12-02', mail_inviata_il: '2026-12-15', esito: 'evasa', evasione_rilevata_il: '2026-12-22', evasione_confermata: true, ordini_totali: 1, ordini_evasi: 1 },
    ];
    const assegnato = { id: 'a1', id_ordine: 'ET26990001', stato: 'assegnato', punto_di_raccolta: 'GOMMISTA ALFA', classe: 'P', ordine_immesso_il: '2026-12-01T09:00:00Z' };
    const terminato = { id: 'p1', id_ordine: 'ET26990001', stato: 'terminato', punto_di_raccolta: 'GOMMISTA ALFA', classe: 'P', ordine_immesso_il: '2026-12-01T09:00:00Z', trasporto_iniziato_il: '2027-01-08T07:00:00Z', trasporto_finito_il: '2027-01-08T09:00:00Z' };
    const ritiro2 = { id: 'p2', id_ordine: 'ET26990002', stato: 'terminato', punto_di_raccolta: 'GOMMISTA BETA', ordine_immesso_il: '2026-12-02T09:00:00Z', trasporto_iniziato_il: '2026-12-22T07:00:00Z', trasporto_finito_il: '2026-12-22T09:00:00Z' };
    const corpo = { azione: 'ritiri_ect', tipo_file: 'primarie' };
    const db = (extra) => ({ PrimariaAci: [], AssegnatoAci: [], UploadLog: [], RichiestaEct: richieste.map(x => ({ ...x })), ...extra });
    const gen = await alle('2027-01-15T09:00:00Z', () => chiama(F, { db: db({ PrimariaRete: [terminato, ritiro2], Assegnato: [] }), corpo }));
    const e1 = gen.db.RichiestaEct.find(x => x.id === 'ect1');
    verifica('15/01/2027: la richiesta di dicembre si controlla, e il ritiro dell\'08/01 la chiude', gen.stato === 200 && gen.j.controllate === 1 && e1.esito === 'evasa' && e1.evasione_rilevata_il === '2027-01-08', `${gen.stato} ${J(gen.j).slice(0, 200)} ${J(e1)}`);
    verifica('e si dice: aspetta la risposta al consorzio', J(gen.j.da_confermare) === J([{ pdr: 'GOMMISTA ALFA', id_ordine: 'ET26990001', evasa_il: '2027-01-08' }]), J(gen.j.da_confermare));
    verifica('la evasa e risposta del 2026 non si tocca', !gen.scritte.some(s => s.entita === 'RichiestaEct' && s.id === 'ect2'), J(gen.scritte));
    // Controprova: il 31/12/2026, ancora assegnato, tutto come prima.
    const dic = await alle('2026-12-31T22:30:00Z', () => chiama(F, { db: db({ PrimariaRete: [ritiro2], Assegnato: [assegnato] }), corpo }));
    verifica('31/12/2026 alle 23:30: la richiesta e\' ancora aperta, come prima', dic.stato === 200 && dic.j.controllate === 1 && dic.db.RichiestaEct.find(x => x.id === 'ect1').esito === 'aperta', `${dic.stato} ${J(dic.j).slice(0, 200)}`);
  }
}

// ===========================================================================
// LA REVISIONE DEL 15/10/2026: TRE CASI VICINI
// ===========================================================================
console.log('UNA RICHIESTA CHIUSA DAL PORTALE A DICEMBRE, RIAPERTA A GENNAIO');
{
  // Annullata perche' il suo ordine risultava cancellato (statoRichiesta, regola
  // del 14/10/2026); a gennaio il portale lo riassegna con lo stesso ID e il
  // ritiro si fa. Dentro l'anno si riapriva gia'; a cavallo dell'anno no.
  const { caricaFunzione, chiama } = await import('./dati/bancoFunzioni.mjs');
  let F = null;
  try { F = await caricaFunzione('importaBlocco'); } catch (e) { verifica('importaBlocco si impacchetta', false, String(e && e.message).slice(0, 200)); }
  const corpo = { azione: 'ritiri_ect', tipo_file: 'primarie' };
  const annullata = (id, ordine, mail, visto, extra = {}) => ({
    id, anno: Number(mail.slice(0, 4)), pdr_nome: 'GOMMISTA GAMMA', classe: '', id_ordine: ordine, id_ordine_stato: 'trovato',
    ordine_immesso_il: mail, mail_inviata_il: mail, esito: 'annullata', motivo_annullamento: '', ordini_totali: 1, ordini_evasi: 0,
    ordini_stato_json: J([{ id_ordine: ordine, stato: 'cancellato', motivo: 'Mancanza PFU', visto_il: visto }]), ...extra,
  });
  const terminato = (ordine, mail, fine) => ({ id: 'p-' + ordine, id_ordine: ordine, stato: 'terminato', punto_di_raccolta: 'GOMMISTA GAMMA', ordine_immesso_il: mail + 'T09:00:00Z', trasporto_iniziato_il: fine + 'T07:00:00Z', trasporto_finito_il: fine + 'T09:00:00Z' });
  const giro = (quando, richieste, primarie, assegnati = []) => alle(quando, () => chiama(F, { db: { PrimariaAci: [], AssegnatoAci: [], UploadLog: [], Assegnato: assegnati, PrimariaRete: primarie, RichiestaEct: richieste }, corpo }));
  if (F) {
    const dentro = await giro('2026-12-15T09:00:00Z', [annullata('e1', 'ET26990009', '2026-11-10', '2026-11-20')], [terminato('ET26990009', '2026-11-10', '2026-12-10')]);
    verifica('dentro l\'anno (come prima): il ritiro del 10/12/2026 la riapre e la chiude evasa', dentro.stato === 200 && dentro.db.RichiestaEct[0].esito === 'evasa' && dentro.db.RichiestaEct[0].evasione_rilevata_il === '2026-12-10', `${dentro.stato} ${J(dentro.j).slice(0, 200)}`);
    const cavallo = await giro('2027-01-15T09:00:00Z', [annullata('e2', 'ET26990009', '2026-12-10', '2026-12-20')], [terminato('ET26990009', '2026-12-10', '2027-01-12')]);
    const e2 = cavallo.db.RichiestaEct[0];
    verifica('15/01/2027: la richiesta del 2026 annullata dal portale si riguarda, e il ritiro del 12/01/2027 la chiude evasa', cavallo.stato === 200 && cavallo.j.controllate === 1 && e2.esito === 'evasa' && e2.evasione_rilevata_il === '2027-01-12', `${cavallo.stato} ${J(cavallo.j).slice(0, 200)} ${J(e2)}`);
    verifica('e si dice: aspetta la risposta al consorzio', J(cavallo.j.da_confermare) === J([{ pdr: 'GOMMISTA GAMMA', id_ordine: 'ET26990009', evasa_il: '2027-01-12' }]), J(cavallo.j.da_confermare));
    // Riassegnato e non ancora ritirato: torna aperta, e la dashboard la vede.
    const riassegnato = await giro('2027-01-15T09:00:00Z', [annullata('e3', 'ET26990009', '2026-12-10', '2026-12-20')], [], [{ id: 'a9', id_ordine: 'ET26990009', stato: 'assegnato', punto_di_raccolta: 'GOMMISTA GAMMA', ordine_immesso_il: '2026-12-10T09:00:00Z' }]);
    verifica('riassegnato a gennaio e non ancora ritirato: torna aperta', riassegnato.stato === 200 && riassegnato.db.RichiestaEct[0].esito === 'aperta', J(riassegnato.db.RichiestaEct[0]));
    // Controprove: degli anni prima non si riapre niente senza una prova in positivo.
    const ancoraCancellato = { ...terminato('ET26990009', '2026-12-10', '2027-01-12'), stato: 'cancellato', motivo_cancellazione: 'Mancanza PFU', trasporto_iniziato_il: null, trasporto_finito_il: null };
    const fermo = await giro('2027-01-15T09:00:00Z', [annullata('e4', 'ET26990009', '2026-12-10', '2026-12-20')], [ancoraCancellato]);
    verifica('ancora cancellato a portale: resta annullata, nessuna scrittura', fermo.stato === 200 && fermo.db.RichiestaEct[0].esito === 'annullata' && !fermo.scritte.some(s => s.entita === 'RichiestaEct'), J(fermo.scritte));
    const uscito = await giro('2028-03-15T09:00:00Z', [annullata('e5', 'ET26990009', '2026-12-10', '2026-12-20')], []);
    verifica('l\'ordine cancellato e\' uscito dal file del portale: la richiesta di due anni prima resta annullata, non torna «aperta»', uscito.stato === 200 && uscito.j.controllate === 0 && uscito.db.RichiestaEct[0].esito === 'annullata' && !uscito.scritte.some(s => s.entita === 'RichiestaEct'), `${J(uscito.j).slice(0, 200)} ${J(uscito.scritte)}`);
    const dalFoglio = await giro('2027-01-15T09:00:00Z', [annullata('e6', 'ET26990009', '2026-12-10', '2026-12-20', { motivo_annullamento: 'cancellato per mancanza di pfu' })], [terminato('ET26990009', '2026-12-10', '2027-01-12')]);
    verifica('annullata dal foglio del consorzio: resta annullata anche col ritiro (come dentro l\'anno)', dalFoglio.stato === 200 && dalFoglio.db.RichiestaEct[0].esito === 'annullata' && !dalFoglio.scritte.some(s => s.entita === 'RichiestaEct'), J(dalFoglio.scritte));
  }
  verifica('la regola: riaperta solo con un ordine cancellato di nuovo nell\'archivio e non cancellato', typeof R.riapertaDalPortale === 'function'
    && R.riapertaDalPortale(annullata('x', 'ET1000001', '2026-12-10', '2026-12-20'), { presenti: new Set(['ET1000001']), cancellati: new Map() })
    && !R.riapertaDalPortale(annullata('x', 'ET1000001', '2026-12-10', '2026-12-20'), { presenti: new Set(['ET1000001']), cancellati: new Map([['ET1000001', 'x']]) })
    && !R.riapertaDalPortale(annullata('x', 'ET1000001', '2026-12-10', '2026-12-20'), { presenti: new Set(), cancellati: new Map() })
    && !R.riapertaDalPortale(annullata('x', 'ET1000001', '2026-12-10', '2026-12-20', { motivo_annullamento: 'dal foglio' }), { presenti: new Set(['ET1000001']), cancellati: new Map() }));
}

console.log('UN ID SCRITTO MALE NEL FOGLIO, POI CORRETTO');
{
  // Il foglio porta l'ID con una cifra in meno; il giorno dopo e' corretto.
  // Prima l'ID sbagliato finiva in id_ordine_manuale e da li' valeva come scritto
  // a mano: la correzione del foglio non passava piu' e la richiesta aspettava
  // per sempre un ordine che non esiste.
  const TESTA = [['RICHIESTA ECT', 'provincia', 'numero d\'ordine ', 'DATE', null, 'trasportatore', 'mail inviata il', null], [null, null, null, 'ordine immesso', 'ordine evaso', null, null, null]];
  const foglio = (id, altre = []) => fileDi([...TESTA, ['PIUGOMME SRL M', 'BA', id, d('2026-06-03'), null, 'smoco', d('2026-10-05'), 'entro ottobre'], ...altre], { riga: 2 });
  const ritirato = { id: 'p1', id_ordine: 'ET26092556', stato: 'terminato', punto_di_raccolta: 'PIUGOMME SRL', classe: 'M', ordine_immesso_il: '2026-06-03T08:00:00Z', trasporto_iniziato_il: '2026-10-12T07:00:00Z', trasporto_finito_il: '2026-10-12T09:00:00Z' };
  const archivio = { ...VUOTI(), PrimariaRete: [ritirato], RichiestaEct: [] };
  const a = await caricaFoglio(foglio('ET2609256'), archivio, '2026-10-15T09:00:00Z');
  const r0 = archivio.RichiestaEct[0] || {};
  verifica('15/10: l\'ID del foglio non c\'e\' fra gli ordini e non si prende', a.status === 200 && !r0.id_ordine_manuale && a.body.id_dal_foglio === 0, `${a.status} ${J(r0)}`);
  verifica('e si dice quale', J(a.body.id_del_foglio_non_trovati) === J([{ pdr: 'PIUGOMME SRL', foglio: 'ET2609256', non_trovati: 'ET2609256' }]), J(a.body.id_del_foglio_non_trovati));
  verifica('intanto vale il riconoscimento: l\'ordine del 03/06 ritirato il 12/10 chiude la richiesta', r0.id_ordine === 'ET26092556' && r0.esito === 'evasa' && r0.evasione_rilevata_il === '2026-10-12', J(r0));
  const b = await caricaFoglio(foglio('ET26092556'), archivio, '2026-10-16T09:00:00Z');
  const r1 = archivio.RichiestaEct[0] || {};
  verifica('16/10, corretto nel foglio: l\'ID si prende, nessun conflitto', b.status === 200 && archivio.RichiestaEct.length === 1 && r1.id_ordine_manuale === 'ET26092556' && b.body.id_dal_foglio === 1 && (b.body.id_diversi_dal_foglio || []).length === 0 && (b.body.id_del_foglio_non_trovati || []).length === 0, `${b.status} ${J(b.body).slice(0, 300)}`);
  // Due ordini nel foglio, uno solo caricato: non se ne prende nessuno, se no la
  // richiesta si chiuderebbe col ritiro di uno solo.
  const due = { ...VUOTI(), PrimariaRete: [ritirato], RichiestaEct: [] };
  const c = await caricaFoglio(foglio('ET26092556, ET26092541'), due, '2026-10-15T09:00:00Z');
  verifica('due ordini nel foglio, uno solo caricato: nessuno si prende, si dice quello che manca', c.status === 200 && !due.RichiestaEct[0].id_ordine_manuale && J(c.body.id_del_foglio_non_trovati) === J([{ pdr: 'PIUGOMME SRL', foglio: 'ET26092556, ET26092541', non_trovati: 'ET26092541' }]), J(c.body.id_del_foglio_non_trovati));
  verifica('la forma dell\'ID: due-quattro lettere e almeno sei cifre, come nella to-do list', typeof R.idOrdiniDelFoglio === 'function' && R.idOrdiniDelFoglio('ET260925') === 'ET260925' && R.idOrdiniDelFoglio('ET26092') === '' && R.idOrdiniDelFoglio('E26092556') === '' && R.idOrdiniDelFoglio('SEC26154852') === 'SEC26154852');
}

console.log('UNA RICHIESTA DI DICEMBRE SPUNTATA A GENNAIO');
{
  // La pagina rilegge dopo la spunta: quella del 2026 spuntata il 05/01/2027
  // spariva, e la spunta non si poteva piu' togliere.
  const archivio = [
    { id: 'dic', anno: 2026, pdr_nome: 'GOMMISTA DICEMBRE', mail_inviata_il: '2026-12-14', id_ordine: 'ET26990001', esito: 'evasa', evasione_rilevata_il: '2026-12-30', evasione_confermata: false },
    { id: 'gen', anno: 2027, pdr_nome: 'GOMMISTA GENNAIO', mail_inviata_il: '2027-01-02', id_ordine: 'ET27000001', esito: 'evasa', evasione_rilevata_il: '2027-01-04', evasione_confermata: false },
    // spuntata a dicembre: resta nel 2026
    { id: 'vec', anno: 2026, pdr_nome: 'GOMMISTA VECCHIO', mail_inviata_il: '2026-11-14', id_ordine: 'ET26990003', esito: 'evasa', evasione_rilevata_il: '2026-11-30', evasione_confermata: true, evasione_confermata_il: '2026-12-02' },
    // annullata dal portale: a gennaio (visto il 03/01/2027) e a dicembre
    { id: 'can', anno: 2026, pdr_nome: 'GOMMISTA CANCELLATO', mail_inviata_il: '2026-12-10', id_ordine: 'ET26990004', esito: 'annullata', ordini_stato_json: J([{ id_ordine: 'ET26990004', stato: 'cancellato', motivo: 'x', visto_il: '2027-01-03' }]) },
    { id: 'cad', anno: 2026, pdr_nome: 'GOMMISTA CANCELLATO PRIMA', mail_inviata_il: '2026-12-01', id_ordine: 'ET26990005', esito: 'annullata', ordini_stato_json: J([{ id_ordine: 'ET26990005', stato: 'cancellato', motivo: 'x', visto_il: '2026-12-20' }]) },
  ];
  const ok2 = typeof R.richiesteDellaTodo === 'function';
  verifica('la regola della pagina c\'e\'', ok2);
  const aVideo = () => (ok2 ? R.richiesteDellaTodo(archivio, 2027) : typeof R.richiesteDaSeguire === 'function' ? R.richiesteDaSeguire(archivio, 2027) : []).map(r => r.id).join(',');
  verifica('05/01/2027 prima della spunta: le due da rispondere, e quella annullata dal portale a gennaio', aVideo() === 'dic,gen,can', aVideo());
  // la spunta della pagina (spunta(r)), per tutte e due
  for (const r of archivio.filter(x => x.id === 'dic' || x.id === 'gen')) {
    const campi = { evasione_confermata: true, evasione_confermata_il: '2027-01-05' };
    campi.esito = R.statoRichiesta({ ...r, ...campi });
    Object.assign(r, campi);
  }
  verifica('dopo la spunta restano tutte e due fra le completate: la spunta si puo\' togliere', aVideo() === 'dic,gen,can', aVideo());
  verifica('la dashboard e il ricalcolo no: per loro una spuntata e\' chiusa', typeof R.richiesteDaSeguire === 'function' && R.richiesteDaSeguire(archivio, 2027).map(r => r.id).join(',') === 'gen');
  verifica('nel 2028 quella del 2026 spuntata nel 2027 non c\'e\' piu\'', ok2 && R.richiesteDellaTodo(archivio, 2028).length === 0, ok2 ? R.richiesteDellaTodo(archivio, 2028).map(r => r.id).join(',') : '');
  // La pagina usa questa regola.
  const pagina = readFileSync(qui('../src/components/todo/RichiesteEct.jsx'), 'utf8').replace(/\r/g, '');
  verifica('la To-Do List legge con richiesteDellaTodo', /setRighe\(richiesteDellaTodo\(tutte, anno\)\)/.test(pagina));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
