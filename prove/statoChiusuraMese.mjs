// LA FUNZIONE statoChiusuraMese, INTERA, CON UN ARCHIVIO FINTO (migliorie
// dell'11/10/2026).
//
// La lista di controllo del mese e' un'altra richiesta della dashboard, e il
// limite di richieste vale per tutta l'app: si prova che la funzione legge
// poco - mai le primarie intere, solo le righe «eseguito» e le poche che dicono
// fin dove arrivano - che non scrive niente, che non lascia uscire nessun
// importo (il pannello lo vede anche chi non e' amministratore: totali del
// congelamento, importi dei consuntivi, righe della prefattura restano
// dentro), che una lettura che cade non da' un verde falso, e che a gennaio
// si chiude dicembre.
//
// Il banco e' quello di prove/dati/bancoFunzioni.mjs, con un SDK finto che sa
// anche $in, l'ordinamento e il numero di righe (li usano il registro dei
// caricamenti e il «dati fino al»), conta le letture, e un giorno di oggi
// fissato dalla prova (globalThis.__OGGI). npm run prove
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fotografiaDelGiorno } from '../base44/shared/indicatoriGiorno.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const SDK_FINTO = `
const tabella = (nome) => (globalThis.__DB[nome] = globalThis.__DB[nome] || []);
const vale = (v, f) => {
  if (f && typeof f === 'object' && !Array.isArray(f)) {
    return Object.entries(f).every(([op, x]) => op === '$in' ? x.includes(v) : op === '$gte' ? v != null && v >= x : op === '$gt' ? v != null && v > x : op === '$lte' ? v != null && v <= x : op === '$lt' ? v != null && v < x : false);
  }
  return v === f;
};
const uguale = (r, f) => Object.entries(f || {}).every(([k, v]) => vale(r[k], v));
const ordina = (righe, ord) => {
  const campo = String(ord || '').replace(/^-/, '');
  if (!campo || campo === 'id') return righe;
  const verso = String(ord).startsWith('-') ? -1 : 1;
  return righe.slice().sort((a, b) => String(a[campo] ?? '').localeCompare(String(b[campo] ?? '')) * verso);
};
const conta = (nome, op, q, ord, quanti, n) => globalThis.__LETTURE.push({ entita: nome, op, q, ord, quanti, n });
const rotta = (nome) => { if ((globalThis.__ROTTE || []).includes(nome)) throw new Error('lettura non riuscita: ' + nome); };
const entita = (nome) => ({
  list: async (ord, quanti = 5000, salta = 0) => { rotta(nome); const r = ordina(tabella(nome), ord).slice(salta, salta + quanti); conta(nome, 'list', null, ord, quanti, r.length); return r.map(x => ({ ...x })); },
  filter: async (f, ord, quanti = 5000, salta = 0) => { rotta(nome); const r = ordina(tabella(nome).filter(x => uguale(x, f)), ord).slice(salta, salta + quanti); conta(nome, 'filter', f, ord, quanti, r.length); return r.map(x => ({ ...x })); },
  get: async (id) => { rotta(nome); conta(nome, 'get', { id }, null, 1, 1); return { ...tabella(nome).find(x => x.id === id) }; },
  create: async (r) => { globalThis.__SCRITTE.push({ op: 'create', entita: nome }); return { id: 'nuovo', ...r }; },
  bulkCreate: async (rr) => { globalThis.__SCRITTE.push({ op: 'bulkCreate', entita: nome }); return rr; },
  update: async (id) => { globalThis.__SCRITTE.push({ op: 'update', entita: nome, id }); return {}; },
  delete: async (id) => { globalThis.__SCRITTE.push({ op: 'delete', entita: nome, id }); return {}; },
  deleteMany: async () => { globalThis.__SCRITTE.push({ op: 'deleteMany', entita: nome }); return {}; },
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
export function createClientFromRequest() {
  return {
    auth: { me: async () => (globalThis.__RUOLO ? { role: globalThis.__RUOLO, email: 'prova@prova' } : null) },
    asServiceRole: { entities, functions: { invoke: async () => ({ data: {} }) } },
    entities,
    functions: { invoke: async () => ({ data: {} }) },
  };
}`;

// Il giorno di oggi lo decide la prova: la funzione chiede oggiRoma().
const GIORNO = fileURLToPath(new URL('../base44/shared/giornoItaliano.ts', import.meta.url));
const VECCHIO_OGGI = 'export const oggiRoma = () => GIORNO_ROMA.format(new Date());';
const sorgenteGiorno = readFileSync(GIORNO, 'utf8').replace(/\r/g, '');
verifica('giornoItaliano.ts ha ancora oggiRoma come la prova la sostituisce', sorgenteGiorno.includes(VECCHIO_OGGI));

const pacchetto = await build({
  entryPoints: [fileURLToPath(new URL('../base44/functions/statoChiusuraMese/entry.ts', import.meta.url))],
  bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
  plugins: [{ name: 'banco', setup(b) {
    b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
    b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
    b.onLoad({ filter: /giornoItaliano\.ts$/ }, () => ({
      contents: sorgenteGiorno.replace(VECCHIO_OGGI, 'export const oggiRoma = () => globalThis.__OGGI || GIORNO_ROMA.format(new Date());'),
      loader: 'ts',
    }));
  } }],
});
const modulo = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));

async function chiama({ db, ruolo = 'admin', corpo = {}, oggi = '2026-10-20', rotte = [] }) {
  globalThis.__DB = JSON.parse(JSON.stringify(db));
  globalThis.__SCRITTE = [];
  globalThis.__LETTURE = [];
  globalThis.__RUOLO = ruolo;
  globalThis.__OGGI = oggi;
  globalThis.__ROTTE = rotte;
  const r = await modulo.default({ json: async () => corpo });
  return { stato: r.status, j: await r.json(), scritte: globalThis.__SCRITTE, letture: globalThis.__LETTURE };
}

// === L'archivio: settembre 2026 quasi chiuso, luglio con l'ACI ancora aperta ===
const doc = (mese, tipologia, stato, extra = {}) => ({ id: `${mese}-${tipologia}`, tipo: 'ATTIVA', tipologia, anno: 2026, mese, stato, numero_voci: 12, totale: 372976.5, data_elaborazione: '2026-10-05T08:00:00Z', ...extra });
const tre = (mese, stato) => ['RETE', 'ACI', 'EXTRA_RACCOLTA'].map(c => doc(mese, c, stato));
const sito = (p) => ({ sito: 'X', chiave: 'x', tipo_destinazione: 'imp', dichiara_rete: true, giacenza_portale_t: 0, giacenza_calcolata_t: 0, scarto_t: 0, quadra: true, giacenze_canale: [], flussi: [], ...p });
const FOTO = fotografiaDelGiorno([
  sito({ sito: 'GATIM SRL', giacenze_canale: [{ canale: 'RETE', giacenza_t: 122.17, entrato_t: 1400, dichiarato_caricato_t: 1277.83 }], flussi: [{ canale: 'RETE', resta_t: 122.17, uscito_t: 1277.83 }] }),
], { giorno: '2026-10-20', anno: 2026 });
const DB = {
  DocumentoFatturazione: [
    ...tre('Luglio', 'chiusa').map(d => (d.tipologia === 'ACI' ? { ...d, stato: 'esportata' } : d)),
    ...tre('Agosto', 'chiusa'),
    doc('Settembre', 'RETE', 'chiusa', { fattura_confermata_il: '2026-10-15' }),
    doc('Settembre', 'ACI', 'approvata', { data_approvazione: '2026-10-14T08:00:00Z' }),
    doc('Settembre', 'EXTRA_RACCOLTA', 'elaborata', { numero_voci: 0, totale: 0 }),
    { id: 'passiva-1', tipo: 'PASSIVA', anno: 2026, mese: 'Settembre', stato: 'elaborata', totale: 55555.55 },
  ],
  ChiusuraPassivaMese: [
    { id: 'c1', anno: 2026, mese: 9, canale: 'RETE', congelato_il: '2026-10-16T08:00:00Z', congelato_da: 'Antonio', totale_euro: 98765.43, passiva_json: '@parti:3' },
    ...['RETE', 'ACI', 'EXTRA_RACCOLTA'].map((c, i) => ({ id: `c8${i}`, anno: 2026, mese: 8, canale: c, congelato_il: '2026-09-29T08:00:00Z', totale_euro: 91919.19 })),
  ],
  EsportazioneFatturazione: [{ id: 'e1', tipologia: 'ACI', direzione: 'ATTIVA', anno: 2026, mese: 'Settembre', stato: 'completata', documento_ids: ['Settembre-ACI'], data_esportazione: '2026-10-15T08:00:00Z', nome_file: 'attiva.xlsx' }],
  PrefatturaEcotyre: [{ id: 'p1', anno: 2026, mese: 'Settembre', superata: false, caricata_il: '2026-10-12T08:00:00Z', nome_file: 'prefattura.xlsx', righe: [{ id_ordine: 'ET1', importo: 12345.67, kg: 1000 }], totale_euro_stampato: 12345.67 }],
  ConsuntivoFornitore: [
    { id: 'k1', fornitore: 'LOGISTICA & PNEUMATICI SRL', ruolo: 'raccoglitore', anno: 2026, mese: 9, canale: 'RETE', quadra: true, confrontato_il: '2026-10-10T08:00:00Z', importo_consuntivo: 4321.09, righe_json: '[{"importo":4321.09}]' },
    { id: 'k2', fornitore: 'LOGISTICA & PNEUMATICI SRL', ruolo: 'raccoglitore', anno: 2026, mese: 8, canale: 'RETE', quadra: true, importo_consuntivo: 3161.2 },
  ],
  QuadraturaFir: [36, 37, 38, 39, 40].map(s => ({ id: `q${s}`, anno: 2026, settimana: s, stato: 'completata', per_canale: [{ canale: 'RETE', conformita: 'piena' }], avviata_il: '2026-10-01T08:00:00Z' })),
  DichiarazioneSito: ['Luglio', 'Agosto'].map(m => ({ id: `ds-${m}`, sito: 'Gatim', canale: 'RETE', provenienza: '', anno: 2026, mese: m, quantita_kg: 150000, caricata_inviata: true })),
  PraticaIrigom: [],
  IndicatoreGiorno: [{ id: 'i1', ...FOTO }],
  Alert: [
    { id: 'a1', stato: 'aperto', regola_id: 'date_obbligatorie_rete', modulo: 'primarie_rete', quanti: 2, senza_fine: 0, severita: 'warning' },
    { id: 'a2', stato: 'aperto', regola_id: 'scostamento_target', severita: 'critico' },
    { id: 'a3', stato: 'chiuso', regola_id: 'date_obbligatorie_ACI', modulo: 'primarie_aci', quanti: 9 },
  ],
  PrimariaRete: [
    ...Array.from({ length: 40 }, (_, i) => ({ id: `pr${i}`, id_ordine: `ET2609${String(i).padStart(4, '0')}`, stato: 'terminato', trasporto_finito_il: `2026-${i < 30 ? '09' : '10'}-${String((i % 28) + 1).padStart(2, '0')}T08:00:00Z`, peso_effettivo: 3000 })),
    { id: 'pr-es', id_ordine: 'ET26152600', stato: 'eseguito', trasporto_finito_il: '2026-09-30T08:00:00Z', peso_effettivo: 3620 },
  ],
  PrimariaAci: [{ id: 'pa1', stato: 'terminato', trasporto_finito_il: '2026-10-12T08:00:00Z', peso_effettivo: 900 }],
  Secondaria: [{ id: 's1', stato: 'terminato', trasporto_finito_il: '2026-10-01T08:00:00Z', peso_effettivo: 20000 }],
  UploadLog: [
    { id: 'u1', tipo_file: 'primarie', esito: 'successo', created_date: '2026-10-13T08:00:00', nome_file: 'PRIMARIE.xlsx' },
    { id: 'u2', tipo_file: 'secondarie', esito: 'successo', created_date: '2026-10-13T08:05:00', nome_file: 'SECONDARIE.xlsx' },
  ],
};

console.log('IL MESE, I PASSI, NIENTE SCRITTO');
const admin = await chiama({ db: DB });
const passo = (r, chiave) => (r.j.passi || []).find(p => p.chiave === chiave) || {};
verifica('risponde 200 su settembre 2026, con dieci passi', admin.stato === 200 && admin.j.mese && admin.j.mese.etichetta === 'Settembre 2026' && admin.j.passi.length === 10, JSON.stringify(admin.j).slice(0, 300));
verifica('non scrive niente', admin.scritte.length === 0, JSON.stringify(admin.scritte));
verifica('dati completi: primarie e secondarie caricate il 13/10, dopo il termine del 12/10', passo(admin, 'dati').stato === 'fatto', JSON.stringify(passo(admin, 'dati')));
verifica('terminati: l\'alert delle date aperto e l\'eseguito del 30/09; non quello chiuso ne\' l\'altro alert', passo(admin, 'terminati').stato === 'da_fare' && passo(admin, 'terminati').voci.length === 2 && passo(admin, 'terminati').voci.some(v => /ET26152600/.test(v.testo)), JSON.stringify(passo(admin, 'terminati').voci));
verifica('dichiarazioni: GATIM ha caricato fino ad agosto, e restano 122,17 t', passo(admin, 'dichiarazioni').stato === 'da_fare' && passo(admin, 'dichiarazioni').voci[0].testo === 'GATIM SRL, rete: l\'ultima dichiarazione caricata a portale è di agosto; restano da dichiarare 122,17 t.', passo(admin, 'dichiarazioni').voci[0] && passo(admin, 'dichiarazioni').voci[0].testo);
verifica('attiva: rete chiusa, ACI esportata dopo l\'approvazione, extra senza righe', passo(admin, 'attiva_RETE').stato === 'fatto' && passo(admin, 'attiva_ACI').manca.cosa === 'la conferma della fattura' && passo(admin, 'attiva_EXTRA_RACCOLTA').stato === 'non_serve');
verifica('passiva: rete congelata e consuntivo che quadra; ACI da congelare', passo(admin, 'passiva_RETE').stato === 'fatto' && passo(admin, 'passiva_ACI').manca.cosa === 'il congelamento della passiva');
verifica('quadrature: le cinque settimane piene', passo(admin, 'quadrature_fir').stato === 'fatto');
verifica('la riga di sintesi: i passi che non servono (l\'extra raccolta senza righe) non contano', admin.j.sintesi === 'Settembre 2026: 4 di 8 fatti, mancano le date dei terminati e gli ordini «eseguito», le dichiarazioni di GATIM SRL, la conferma della fattura (ACI) e il congelamento della passiva (ACI).', admin.j.sintesi);
verifica('luglio, con l\'ACI esportata e mai chiusa, e\' fra i mesi aperti; agosto no', (admin.j.mesi_aperti || []).map(m => m.etichetta).join(',') === 'Luglio 2026', JSON.stringify(admin.j.mesi_aperti));

console.log('NESSUN IMPORTO ESCE');
{
  const testo = JSON.stringify(admin.j);
  verifica('ne\' il congelato (98.765,43) ne\' l\'importo del consuntivo (4.321,09) ne\' la prefattura (12.345,67) ne\' i totali dei documenti', !/98765|98\.765|4321|4\.321|12345|12\.345|372976|372\.976|55555|91919|€/.test(testo), (testo.match(/98765|4321|12345|372976|55555|91919|€/) || [])[0]);
  // Il solo «totale» che esce e' quello dei passi, nel conteggio.
  const senzaConteggio = JSON.stringify({ ...admin.j, conteggio: null });
  verifica('nessun campo di soldi o di righe del portale', !/totale_euro|importo|passiva_json|righe_json|"righe"|"totale"/.test(senzaConteggio), (senzaConteggio.match(/totale_euro|importo|passiva_json|righe_json|"righe"|"totale"/) || [])[0]);
  const utente = await chiama({ db: DB, ruolo: 'user' });
  verifica('chi non e\' amministratore vede la stessa lista (non ci sono costi da togliere)', utente.stato === 200 && JSON.stringify(utente.j) === testo);
  const nessuno = await chiama({ db: DB, ruolo: null });
  verifica('senza utente: 401', nessuno.stato === 401);
}

console.log('POCHE LETTURE');
{
  const l = admin.letture;
  console.log(`  ${l.length} letture: ${[...new Set(l.map(x => x.entita))].join(', ')}`);
  verifica(`al massimo venti letture (sono ${l.length})`, l.length <= 20, l.map(x => x.entita).join(','));
  const primarie = l.filter(x => ['PrimariaRete', 'PrimariaAci', 'Secondaria'].includes(x.entita));
  verifica('le primarie non si rileggono mai intere: solo «eseguito» o poche righe ordinate per il «fino al»', primarie.every(x => (x.q && x.q.stato === 'eseguito') || (x.q && x.q.stato === 'terminato' && x.quanti <= 50 && /trasporto_finito_il/.test(x.ord || ''))), JSON.stringify(primarie));
  verifica('e le righe lette delle primarie di rete sono poche (l\'eseguito e le ultime cinque)', l.filter(x => x.entita === 'PrimariaRete').reduce((s, x) => s + x.n, 0) <= 6, JSON.stringify(l.filter(x => x.entita === 'PrimariaRete')));
  verifica('le dichiarazioni si leggono dell\'anno del mese, la pratica del mese', l.some(x => x.entita === 'DichiarazioneSito' && x.q && x.q.anno === 2026) && l.some(x => x.entita === 'PraticaIrigom' && x.q && x.q.mese === 'Settembre'));
  verifica('della fotografia del guardiano una riga sola', l.filter(x => x.entita === 'IndicatoreGiorno').every(x => x.op === 'list' && x.quanti === 1));
}

console.log('UN MESE PRECISO, UN ANNO SENZA MESI, UN MESE NON FINITO');
{
  const luglio = await chiama({ db: DB, corpo: { anno: 2026, mese: 'Luglio' } });
  verifica('{ anno, mese } guarda quel mese', luglio.stato === 200 && luglio.j.mese.etichetta === 'Luglio 2026' && passo(luglio, 'attiva_ACI').voci.some(v => v.stato === 'fatto' && /Esportata/.test(v.testo)), JSON.stringify(passo(luglio, 'attiva_ACI')));
  verifica('all\'ACI esportata di luglio manca ancora la prefattura, come dice il cruscotto finche\' il canale non e\' chiuso', passo(luglio, 'attiva_ACI').manca.cosa === 'la prefattura Ecotyre');
  verifica('e luglio, prima del primo congelamento (agosto), non chiede la passiva congelata', passo(luglio, 'passiva_ACI').voci.some(v => v.stato === 'non_serve' && /non si congelava/.test(v.testo)));
  const ottobre = await chiama({ db: DB, corpo: { anno: 2026, mese: 'Ottobre' } });
  verifica('ottobre non e\' finito: 400 col motivo', ottobre.stato === 400 && /non è ancora finito/.test(ottobre.j.error));
  const dopo = await chiama({ db: DB, corpo: { anno: 2027 } });
  verifica('il 2027 non ha mesi finiti: lo dice, senza passi', dopo.stato === 200 && dopo.j.mese === null && /non ha ancora un mese finito/.test(dopo.j.perche) && dopo.j.passi.length === 0);
}

console.log('A GENNAIO SI CHIUDE DICEMBRE');
{
  const db = { ...DB, DocumentoFatturazione: [...DB.DocumentoFatturazione, doc('Dicembre', 'RETE', 'elaborata')] };
  const gen = await chiama({ db, oggi: '2027-01-15', corpo: { anno: 2027 } });
  verifica('il 15/01/2027, scegliendo il 2027, si guarda dicembre 2026', gen.stato === 200 && gen.j.mese && gen.j.mese.etichetta === 'Dicembre 2026', JSON.stringify(gen.j).slice(0, 200));
  verifica('e i mesi del 2026 ancora aperti restano in elenco', (gen.j.mesi_aperti || []).some(m => m.etichetta === 'Settembre 2026') && (gen.j.mesi_aperti || []).some(m => m.etichetta === 'Ottobre 2026'), JSON.stringify((gen.j.mesi_aperti || []).map(m => m.etichetta)));
  verifica('le dichiarazioni di dicembre si leggono del 2026', gen.letture.some(x => x.entita === 'DichiarazioneSito' && x.q && x.q.anno === 2026));
}

console.log('UNA LETTURA CHE CADE NON DA\' UN VERDE FALSO');
{
  const rotta = await chiama({ db: DB, rotte: ['QuadraturaFir', 'IndicatoreGiorno'] });
  verifica('la funzione risponde lo stesso', rotta.stato === 200);
  verifica('e dice quali letture non sono riuscite', (rotta.j.letture_non_riuscite || []).sort().join(',') === 'fotografia,quadrature', JSON.stringify(rotta.j.letture_non_riuscite));
  verifica('le quadrature, che erano tutte piene, non risultano fatte', passo(rotta, 'quadrature_fir').stato === 'da_fare' && passo(rotta, 'quadrature_fir').lettura_non_riuscita === true);
  verifica('gli altri passi restano com\'erano', passo(rotta, 'attiva_RETE').stato === 'fatto' && passo(rotta, 'dati').stato === 'fatto');
}

// === La revisione delle migliorie (11-12/10/2026): i rilievi, sulla funzione intera ===

console.log('L\'ESPORTAZIONE DI PROVA, COME LA REGISTRA L\'INTERFACCIA');
{
  // AttivaEsportazioni.jsx manda sempre documento_ids: [doc.id], e
  // registraEsportazione scrive la data anche sul documento «elaborata»: il
  // 05/10/2026 rete e ACI di settembre sono state esportate cosi', prima di
  // essere approvate. Approvata il 14/10, l'ACI e' «approvata», non esportata.
  const db = { ...DB,
    DocumentoFatturazione: DB.DocumentoFatturazione.map(d => (d.id === 'Settembre-ACI' ? { ...d, data_esportazione: '2026-10-05T07:25:06.300Z' } : d)),
    EsportazioneFatturazione: [{ id: 'e0', tipologia: 'ACI', direzione: 'ATTIVA', anno: 2026, mese: 'Settembre', stato: 'completata', documento_ids: ['Settembre-ACI'], data_esportazione: '2026-10-05T07:25:06.300Z', nome_file: 'attiva.xlsx' }] };
  const r = await chiama({ db });
  const aci = passo(r, 'attiva_ACI');
  verifica('esportata il 05/10 e approvata il 14/10: manca l\'esportazione', aci.manca && aci.manca?.cosa === "l'esportazione dell'attiva" && aci.voci.some(v => v.stato === 'da_fare' && /Da esportare dopo l'approvazione/.test(v.testo)), JSON.stringify(aci));
  const dopo = await chiama({ db: { ...db, EsportazioneFatturazione: [...db.EsportazioneFatturazione, ...DB.EsportazioneFatturazione] } });
  verifica('e quella del 15/10, dopo l\'approvazione, conta', passo(dopo, 'attiva_ACI').manca?.cosa === 'la conferma della fattura');
}

console.log('L\'EXTRA RACCOLTA ELABORATA PRIMA DEI SUOI MOVIMENTI');
{
  // Il documento di settembre e' a zero righe (05/10); poi si chiudono due
  // interventi di settembre. Il prezzo scritto sull'intervento resta dentro.
  const intervento = (id, fine, extra = {}) => ({ id, id_ordine: id, stato: 'terminato', tipo_movimento: 'primaria', trasporto_finito_il: fine, peso_effettivo: 400, prezzo_attivo: 987.65, sovracosto_trasporto: 432.1, ...extra });
  const db = { ...DB, ExtraRaccolta: [intervento('ER1', '2026-09-26T00:00:00.000Z'), intervento('ER2', '2026-09-27T00:00:00.000Z', { stato: 'Terminato' }),
    intervento('ER3', '2026-09-28T00:00:00.000Z', { tipo_movimento: 'secondaria' }), intervento('ER4', null, { stato: 'assegnato' })] };
  const r = await chiama({ db });
  const att = passo(r, 'attiva_EXTRA_RACCOLTA');
  verifica('attiva extra: da rielaborare, coi due interventi pesati (la secondaria e l\'assegnato no)', att.stato === 'da_fare' && att.manca?.cosa === "la rielaborazione dell'attiva" && /ci sono 2 movimenti di extra raccolta finiti: va rielaborata/.test(att.voci[0].testo), JSON.stringify(att));
  verifica('passiva extra: non e\' piu\' «non serve»', passo(r, 'passiva_EXTRA_RACCOLTA').stato === 'da_fare', JSON.stringify(passo(r, 'passiva_EXTRA_RACCOLTA')));
  verifica('l\'extra raccolta si legge intera, come la legge l\'attiva', r.letture.some(x => x.entita === 'ExtraRaccolta' && !x.q));
  verifica('e il prezzo dell\'intervento non esce', !/987|432|prezzo|sovracosto/.test(JSON.stringify(r.j)), (JSON.stringify(r.j).match(/987|432|prezzo|sovracosto/) || [])[0]);
  const senzaPeso = await chiama({ db: { ...DB, ExtraRaccolta: [intervento('ER1', '2026-09-26T00:00:00.000Z', { peso_effettivo: 0 })] } });
  verifica('un intervento senza peso: manca il peso, non la rielaborazione', passo(senzaPeso, 'attiva_EXTRA_RACCOLTA').manca?.cosa === 'il peso effettivo dei movimenti');
  const rotta = await chiama({ db, rotte: ['ExtraRaccolta'] });
  verifica('se la lettura dell\'extra cade, i suoi due passi dicono «non so», gli altri canali no', passo(rotta, 'attiva_EXTRA_RACCOLTA').lettura_non_riuscita === true && passo(rotta, 'passiva_EXTRA_RACCOLTA').lettura_non_riuscita === true && passo(rotta, 'attiva_RETE').stato === 'fatto' && (rotta.j.letture_non_riuscite || []).includes('movimenti_extra'));
}

console.log('UN ANNO PASSATO: DICEMBRE 2025 GUARDATO A OTTOBRE 2026');
{
  // La fotografia di stanotte e' del 2026 (GATIM 122,17 t da dichiarare): non
  // dice niente di dicembre 2025. E il gestionale fattura da luglio 2026,
  // congela da agosto 2026, quadra dalla settimana 36 del 2026 (che dal
  // 13/10/2026 non conta piu': le quadrature si chiedono dalla 37).
  const r = await chiama({ db: DB, corpo: { anno: 2025 } });
  verifica('risponde su dicembre 2025', r.stato === 200 && r.j.mese && r.j.mese.etichetta === 'Dicembre 2025', JSON.stringify(r.j).slice(0, 200));
  verifica('nessun numero della fotografia del 2026', !/122,17/.test(JSON.stringify(r.j)), JSON.stringify(passo(r, 'dichiarazioni')));
  verifica('le dichiarazioni non servono, e si dice perche\'', passo(r, 'dichiarazioni').stato === 'non_serve' && /fotografia del controllo notturno è del 2026/.test(passo(r, 'dichiarazioni').dettaglio));
  verifica('attiva, passiva e quadrature: passi che il gestionale non faceva ancora, non si chiedono', ['attiva_RETE', 'attiva_ACI', 'attiva_EXTRA_RACCOLTA', 'passiva_RETE', 'passiva_ACI', 'passiva_EXTRA_RACCOLTA', 'quadrature_fir'].every(k => passo(r, k).stato === 'non_serve'), JSON.stringify(r.j.passi.map(p => [p.chiave, p.stato])));
  verifica('i documenti dell\'attiva si leggono di tutti gli anni (il primo dice da quando)', r.letture.some(x => x.entita === 'DocumentoFatturazione' && x.q && x.q.tipo === 'ATTIVA' && !('anno' in x.q)));
}

console.log('SETTEMBRE 2026, IL PRIMO MESE CHIUSO NEL GESTIONALE, NON SCIVOLA');
{
  // L'ultimo giro (12/10/2026). Nessun congelamento, nessun consuntivo, nessuna
  // quadratura, come nella copia dei dati veri dell'11/10/2026: il primo mese da
  // chiedere era «quello che si chiude adesso», e il 15/11/2026 settembre
  // diventava «Prima di ottobre 2026 la passiva non si congelava». Ora il primo
  // mese e' fisso, settembre 2026, e l'elenco dei mesi aperti lo dice.
  const db = { ...DB, ChiusuraPassivaMese: [], ConsuntivoFornitore: [], QuadraturaFir: [],
    DocumentoFatturazione: [...DB.DocumentoFatturazione.filter(d => d.mese !== 'Settembre'), ...tre('Settembre', 'chiusa')] };
  const set = await chiama({ db, oggi: '2026-11-15', corpo: { anno: 2026, mese: 'Settembre' } });
  verifica('il 15/11/2026 settembre mai congelato: la passiva di rete e ACI e\' da fare', ['RETE', 'ACI'].every(c => passo(set, `passiva_${c}`).stato === 'da_fare' && passo(set, `passiva_${c}`).manca?.cosa === 'il congelamento della passiva'), JSON.stringify(['RETE', 'ACI'].map(c => passo(set, `passiva_${c}`).voci)));
  verifica('e nessuna voce dice «Prima di ottobre 2026»', !/Prima di ottobre 2026/.test(JSON.stringify(set.j)), (JSON.stringify(set.j).match(/.{0,60}Prima di ottobre 2026.{0,60}/) || [])[0]);
  // Dal 13/10/2026 le quadrature si chiedono dalla settimana 37 del 2026
  // (decisione dell'utente: «ciò che è vecchio non conta più»): di settembre
  // quattro settimane, non piu' cinque, e la 36 non serve col suo perche'.
  verifica('le quadrature delle quattro settimane di settembre dalla 37 si chiedono, la 36 no', passo(set, 'quadrature_fir').stato === 'da_fare'
    && passo(set, 'quadrature_fir').voci.filter(v => v.stato === 'da_fare').map(v => v.testo.slice(0, 12)).join() === 'Settimana 37,Settimana 38,Settimana 39,Settimana 40'
    && passo(set, 'quadrature_fir').voci.some(v => v.stato === 'non_serve' && /^Settimana 36 .*dalla settimana 37 del 2026/.test(v.testo)), JSON.stringify(passo(set, 'quadrature_fir').voci));
  const quattro = await chiama({ db: { ...db, QuadraturaFir: DB.QuadraturaFir.filter(q => q.settimana >= 37) }, oggi: '2026-11-15', corpo: { anno: 2026, mese: 'Settembre' } });
  verifica('con le quadrature dalla 37 alla 40 settembre ha il passo fatto', passo(quattro, 'quadrature_fir').stato === 'fatto' && passo(quattro, 'quadrature_fir').dettaglio === '4 settimane quadrate.', JSON.stringify(passo(quattro, 'quadrature_fir')));
  const nov = await chiama({ db, oggi: '2026-11-15' });
  const settembre = (nov.j.mesi_aperti || []).find(m => m.etichetta === 'Settembre 2026');
  verifica('e fra i mesi prima ancora aperti, settembre c\'e\' per il congelamento', settembre && settembre.mancano.join(' | ') === 'il congelamento della passiva (rete, ACI ed extra raccolta)', JSON.stringify(nov.j.mesi_aperti));
  verifica('luglio e agosto, chiusi fuori dal gestionale, non chiedono il congelamento', (nov.j.mesi_aperti || []).filter(m => m.numero < 9).every(m => !m.mancano.some(x => /congelamento/.test(x))), JSON.stringify(nov.j.mesi_aperti));
  // Giro K8 (12/10/2026): i mesi di prima di settembre 2026 si sono fatturati
  // fuori, e il pannello offre all'amministratore di segnarli chiusi. Lo dice
  // prima_del_gestionale; il primo mese chiuso nel gestionale arriva come
  // etichetta, perche' le pagine non scrivono anni.
  const prima = (nov.j.mesi_aperti || []).filter(m => m.prima_del_gestionale === true).map(m => m.etichetta);
  verifica('luglio ha prima_del_gestionale, settembre no', prima.join(',') === 'Luglio 2026' && settembre?.prima_del_gestionale === false, JSON.stringify(nov.j.mesi_aperti));
  verifica('la risposta dice qual e\' il primo mese chiuso nel gestionale', nov.j.primo_mese_del_gestionale === 'Settembre 2026', nov.j.primo_mese_del_gestionale);
  const ago = await chiama({ db, oggi: '2026-11-15', corpo: { anno: 2026, mese: 'Agosto' } });
  verifica('agosto: passiva e quadrature non servono, e il perche\' e\' il primo mese del gestionale', ['passiva_RETE', 'passiva_ACI', 'quadrature_fir'].every(k => passo(ago, k).stato === 'non_serve') && /Il gestionale chiude i mesi da settembre 2026: agosto 2026 si è chiuso fuori/.test(JSON.stringify(passo(ago, 'passiva_RETE').voci)), JSON.stringify(['passiva_RETE', 'quadrature_fir'].map(k => [passo(ago, k).stato, passo(ago, k).voci.map(v => v.testo)])));
}

console.log(`\n${ok} verifiche passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
