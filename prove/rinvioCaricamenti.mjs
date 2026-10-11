// I CONTI CHE SI SALVANO NON SI SALVANO SU UN ARCHIVIO A META'
// (chiusura dell'audit, 11/10/2026).
//
// Verifiche, quadrature, alert e qualifica rinviavano gia' quando un
// caricamento delle primarie o delle secondarie era in corso, interrotto o
// finito a meta'. Cinque funzioni che SALVANO un conto fatto sugli stessi
// archivi no: il congelamento della passiva, l'elaborazione della fatturazione
// attiva, il salvataggio della chiusura dell'anno, il caricamento della
// prefattura e la fotografia del giorno del guardiano notturno. Salvavano sui
// numeri a meta', e il numero salvato restava li'.
//
// Ora rispondono 409 «rinviato» col motivo e non scrivono niente. Si provano le
// funzioni vere, impacchettate con un SDK finto che conta le scritture e
// risponde il registro dei caricamenti che si vuole. npm run prove
//
// OGNI FUNZIONE SOLO SUGLI ARCHIVI CHE LEGGE (revisione della chiusura,
// 11/10/2026). All'inizio i tipi erano gli stessi per tutte e cinque: l'attiva
// si fermava su secondarie e terziarie che non legge, la passiva sulle
// terziarie. Ora l'SDK finto annota anche quali archivi la funzione legge, e la
// prova controlla che rinvii per un caricamento a meta' di un archivio se e
// solo se quell'archivio lo legge.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// L'SDK finto: auth come amministratore, archivi vuoti, il registro dei
// caricamenti da globalThis.__REGISTRO(numero della lettura), e ogni scrittura
// annotata in globalThis.__SCRITTE.
const SDK_FINTO = `
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => (v && typeof v === 'object' && Array.isArray(v.$in)) ? v.$in.includes(r[k]) : r[k] === v);
const entita = (nome) => ({
  list: async () => { globalThis.__LETTI.add(nome); return [...(globalThis.__ARCHIVI[nome] || [])]; },
  filter: async (f, _s, lim) => {
    if (nome !== 'UploadLog') { globalThis.__LETTI.add(nome); return (globalThis.__ARCHIVI[nome] || []).filter(r => soddisfa(r, f)); }
    globalThis.__LETTURE_REGISTRO++;
    return globalThis.__REGISTRO(globalThis.__LETTURE_REGISTRO).filter(r => soddisfa(r, f)).slice(0, lim || 1e9);
  },
  create: async (r) => { globalThis.__SCRITTE.push('create ' + nome); return { id: 'n' + globalThis.__SCRITTE.length, ...r }; },
  bulkCreate: async (rr) => { globalThis.__SCRITTE.push('bulkCreate ' + nome); return rr; },
  update: async (id, r) => { globalThis.__SCRITTE.push('update ' + nome); return { id, ...r }; },
  delete: async () => { globalThis.__SCRITTE.push('delete ' + nome); return {}; },
  deleteMany: async () => { globalThis.__SCRITTE.push('deleteMany ' + nome); return {}; },
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
const integrations = { Core: new Proxy({}, { get: (_t, n) => async () => { globalThis.__SCRITTE.push('core ' + String(n)); return {}; } }) };
export function createClientFromRequest() {
  return {
    auth: { me: async () => ({ role: 'admin', email: 'prova@prova', full_name: 'Prova' }) },
    asServiceRole: { entities, integrations }, entities, integrations,
    functions: { invoke: async () => ({ data: {} }) },
  };
}`;

const funzione = async (nome) => {
  const pacchetto = await build({
    entryPoints: [qui(`../base44/functions/${nome}/entry.ts`)],
    bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
    external: ['npm:xlsx@*'],
    plugins: [{ name: 'sdk-finto', setup(b) {
      b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
      b.onResolve({ filter: /^npm:xlsx/ }, () => ({ path: 'xlsx', namespace: 'xlsx-finto' }));
      b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
      b.onLoad({ filter: /.*/, namespace: 'xlsx-finto' }, () => ({ contents: 'export const read = () => ({ SheetNames: [] }); export const utils = { sheet_to_json: () => [] };', loader: 'js' }));
    } }],
  });
  return (await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'))).default;
};

// Le righe del registro: created_date in UTC senza la Z, come le scrive la piattaforma.
const fa = (minuti) => new Date(Date.now() - minuti * 60000).toISOString().replace('Z', '');
const RIUSCITO = { id: 'ok1', tipo_file: 'primarie', esito: 'successo', modalita: 'sostituzione', created_date: fa(3 * 24 * 60), nome_file: 'PRIMARIE.xlsx' };
const RIUSCITE_SEC = { id: 'ok2', tipo_file: 'secondarie', esito: 'successo', modalita: 'sostituzione', created_date: fa(3 * 24 * 60) };
const RIUSCITE_TER = { id: 'ok3', tipo_file: 'terziarie', esito: 'successo', modalita: 'sostituzione', created_date: fa(3 * 24 * 60) };
const PULITO = [RIUSCITO, RIUSCITE_SEC, RIUSCITE_TER];
// Una riga UploadLog in_corso: le primarie si stanno riscrivendo adesso.
const IN_CORSO = { id: 'u9', tipo_file: 'primarie', esito: 'in_corso', modalita: 'sostituzione', created_date: fa(2), nome_file: 'PRIMARIE.xlsx', utente: 'Antonio' };
// Una riscrittura delle secondarie finita «parziale»: l'archivio e' a meta'.
const PARZIALE = { id: 'u8', tipo_file: 'secondarie', esito: 'parziale', modalita: 'sostituzione', created_date: fa(60), nome_file: 'SECONDARIE.xlsx', messaggio: '200 righe non scritte' };
// Le terziarie rimaste aperte da ieri: interrotte.
const TERZIARIE_INTERROTTE = { id: 'u7', tipo_file: 'terziarie', esito: 'in_corso', modalita: 'sostituzione', created_date: fa(24 * 60), nome_file: 'TERZIARIE.xlsx' };
// La fotografia del portale che si sta riscrivendo: conta solo per il guardiano.
const FOTO_IN_CORSO = { id: 'u6', tipo_file: 'ordini_non_dichiarati', esito: 'in_corso', modalita: 'sostituzione', created_date: fa(1) };

const chiama = async (f, corpo, registro, archivi = {}) => {
  globalThis.__SCRITTE = []; globalThis.__LETTURE_REGISTRO = 0; globalThis.__LETTI = new Set(); globalThis.__ARCHIVI = archivi;
  globalThis.__REGISTRO = typeof registro === 'function' ? registro : () => registro;
  const r = await f({ json: async () => corpo });
  return { stato: r.status, j: await r.json(), scritte: [...globalThis.__SCRITTE], letture: globalThis.__LETTURE_REGISTRO, letti: [...globalThis.__LETTI] };
};
// Gli archivi che un file del Caricamento Dati riscrive.
const TIPO_DELL_ARCHIVIO = {
  PrimariaRete: 'primarie', PrimariaAci: 'primarie', Secondaria: 'secondarie', Terziaria: 'terziarie',
  OrdineNonDichiarato: 'ordini_non_dichiarati', DichiarazioneTrattamento: 'dichiarazioni_trattamento',
};
const TIPI_DEI_FILE = [...new Set(Object.values(TIPO_DELL_ARCHIVIO))];
const tipiLetti = (letti) => [...new Set(letti.map(n => TIPO_DELL_ARCHIVIO[n]).filter(Boolean))].sort();
// Un caricamento rimasto aperto da ieri, per ciascun file.
const interrotto = (tipo) => ({ id: 'i-' + tipo, tipo_file: tipo, esito: 'in_corso', modalita: 'sostituzione', created_date: fa(24 * 60), nome_file: tipo.toUpperCase() + '.xlsx' });
// Il caricamento che parte mentre la funzione legge gli archivi: la prima lettura
// del registro e' pulita, la seconda no.
const partitoDurante = (n) => (n === 1 ? PULITO : [IN_CORSO, ...PULITO]);

const rinviata = (x, chi) => x.stato === 409 && x.j.rinviato === true && /non è stato salvato niente/.test(x.j.error || '')
  && new RegExp(chi).test(x.j.error || '') && Array.isArray(x.j.caricamenti_in_corso) && x.j.caricamenti_in_corso.length > 0;

// legge: i file i cui archivi la funzione legge, come ci si aspetta che siano.
// La prova li misura anche (le letture dell'SDK finto) e controlla che
// coincidano. La prefattura legge gli archivi nel confronto, che si misura con
// una prefattura gia' caricata.
const PREFATTURA_CARICATA = { PrefatturaEcotyre: [{ id: 'p1', anno: 2026, mese: 'Settembre', righe: [], caricata_il: '2026-10-01T08:00:00Z' }] };
const CASI = [
  { nome: 'congelaPassivaMese', corpo: { anno: 2026, mese: 9, canale: 'RETE' }, scrive: /ChiusuraPassivaMese/, legge: ['primarie', 'secondarie'] },
  { nome: 'elaboraFatturazioneAttiva', corpo: { anno: 2026, mese: 'Settembre' }, scrive: /DocumentoFatturazione/, legge: ['primarie'] },
  { nome: 'chiusuraAnno', corpo: { anno: 2025, azione: 'salva' }, scrive: null, legge: ['primarie', 'secondarie', 'terziarie'] },
  { nome: 'prefatturaEcotyre', corpo: { azione: 'carica', anno: 2026, mese: 'Settembre', nome_file: 'prefattura.xlsx', file_uri: 'privato/prefattura.xlsx' }, scrive: null, soloPrima: true, legge: ['primarie', 'terziarie'],
    misura: { corpo: { azione: 'confronta', anno: 2026, mese: 'Settembre' }, archivi: PREFATTURA_CARICATA } },
  { nome: 'riepilogoDichiarazioni', corpo: { registra: true }, scrive: /IndicatoreGiorno/, legge: ['dichiarazioni_trattamento', 'ordini_non_dichiarati', 'primarie', 'secondarie', 'terziarie'] },
];

for (const caso of CASI) {
  console.log(caso.nome.toUpperCase());
  const f = await funzione(caso.nome);

  const a = await chiama(f, caso.corpo, [IN_CORSO, ...PULITO]);
  verifica(`${caso.nome}: con una riga in_corso delle primarie risponde 409 «rinviato», col motivo`, rinviata(a, 'primarie'), `${a.stato} ${JSON.stringify(a.j).slice(0, 220)}`);
  const scritte = a.scritte.filter(w => !/FileDaRimuovere/.test(w));
  verifica(`${caso.nome}: e non scrive niente`, scritte.length === 0, scritte.join(','));
  verifica(`${caso.nome}: il motivo dice di aspettare, non di ricaricare`, /Riprova a caricamento concluso/.test(a.j.error || ''), a.j.error);

  const p = await chiama(f, caso.corpo, PULITO);
  const b = await chiama(f, caso.corpo, [PARZIALE, ...PULITO]);
  if (caso.legge.includes('secondarie')) {
    verifica(`${caso.nome}: dopo una riscrittura delle secondarie finita parziale, rinvia anche`, rinviata(b, 'secondarie') && /Ricarica il file/.test(b.j.error || ''), `${b.stato} ${(b.j.error || '').slice(0, 200)}`);
    verifica(`${caso.nome}: senza scrivere`, b.scritte.filter(w => !/FileDaRimuovere/.test(w)).length === 0, b.scritte.join(','));
  } else {
    verifica(`${caso.nome}: le secondarie non le legge, e una loro riscrittura parziale non lo ferma`, b.stato === p.stato && !b.j.rinviato, `${b.stato} ${(b.j.error || '').slice(0, 200)}`);
    if (caso.scrive) verifica(`${caso.nome}: e salva come con il registro pulito`, b.scritte.some(w => caso.scrive.test(w)), b.scritte.join(','));
  }

  const t = await chiama(f, caso.corpo, [TERZIARIE_INTERROTTE, ...PULITO]);
  if (caso.legge.includes('terziarie')) {
    verifica(`${caso.nome}: con le terziarie interrotte, rinvia anche`, rinviata(t, 'terziarie'), `${t.stato} ${(t.j.error || '').slice(0, 200)}`);
  } else {
    verifica(`${caso.nome}: le terziarie non le legge, e un loro caricamento interrotto non lo ferma`, t.stato === p.stato && !t.j.rinviato, `${t.stato} ${(t.j.error || '').slice(0, 200)}`);
    if (caso.scrive) verifica(`${caso.nome}: e salva come con il registro pulito`, t.scritte.some(w => caso.scrive.test(w)), t.scritte.join(','));
  }

  // La regola generale, misurata: per ogni file, rinvia se e solo se la
  // funzione ne legge gli archivi.
  const misura = caso.misura ? await chiama(f, caso.misura.corpo, PULITO, caso.misura.archivi) : p;
  const letti = tipiLetti(misura.letti);
  verifica(`${caso.nome}: gli archivi che legge sono quelli attesi (${caso.legge.join(', ')})`, JSON.stringify(letti) === JSON.stringify([...caso.legge].sort()), JSON.stringify(letti));
  for (const tipo of TIPI_DEI_FILE) {
    const x = await chiama(f, caso.corpo, [interrotto(tipo), ...PULITO]);
    const atteso = letti.includes(tipo);
    verifica(`${caso.nome}: un caricamento ${tipo} interrotto ${atteso ? 'lo rinvia: quell archivio lo legge' : 'non lo ferma: non lo legge'}`,
      atteso ? rinviata(x, tipo.replace(/_/g, ' ')) : (x.stato === p.stato && !x.j.rinviato), `${x.stato} ${(x.j.error || '').slice(0, 160)}`);
  }

  if (!caso.soloPrima) {
    const d = await chiama(f, caso.corpo, partitoDurante);
    verifica(`${caso.nome}: un caricamento partito mentre si leggevano gli archivi si vede (stato letto prima e dopo)`, rinviata(d, 'primarie') && d.letture >= 2, `${d.stato} letture ${d.letture} ${(d.j.error || '').slice(0, 160)}`);
    verifica(`${caso.nome}: e non si scrive niente`, d.scritte.length === 0, d.scritte.join(','));
  }

  verifica(`${caso.nome}: con il registro pulito non rinvia`, p.stato !== 409 && !p.j.rinviato, `${p.stato} ${JSON.stringify(p.j).slice(0, 200)}`);
  if (caso.scrive) verifica(`${caso.nome}: e salva`, p.scritte.some(w => caso.scrive.test(w)), p.scritte.join(','));
}

console.log('LA PREFATTURA RINVIATA NON LASCIA UN FILE ORFANO');
{
  const f = await funzione('prefatturaEcotyre');
  const a = await chiama(f, CASI[3].corpo, [IN_CORSO, ...PULITO]);
  verifica('il foglio gia\' caricato dal browser si annota fra i file da rimuovere', a.scritte.includes('create FileDaRimuovere'), a.scritte.join(','));
  const c = await chiama(f, { azione: 'confronta', anno: 2026, mese: 'Settembre' }, [IN_CORSO, ...PULITO]);
  verifica('il confronto, che non salva niente, non legge nemmeno il registro', c.stato === 200 && c.letture === 0, `${c.stato} ${c.letture}`);
}

console.log('LA CHIUSURA SI PREPARA SEMPRE, SI SALVA SOLO SU ARCHIVI INTERI');
{
  const f = await funzione('chiusuraAnno');
  const a = await chiama(f, { anno: 2025, azione: 'prepara' }, [IN_CORSO, ...PULITO]);
  verifica('preparare il dossier non scrive, e non si rinvia', a.stato === 200 && !a.j.rinviato && a.letture === 0, `${a.stato} ${a.letture}`);
}

console.log('IL GUARDIANO NOTTURNO');
{
  // La descrizione del workflow dice che puo' rinviare, e che cosa succede
  // allora: chi la legge non scambia un 409 per un guasto (11/10/2026).
  const { readFileSync } = await import('node:fs');
  const workflow = JSON.parse(readFileSync(qui('../base44/workflows/GuardianoNotturno.jsonc'), 'utf8'));
  verifica('la descrizione del workflow cita il rinvio e la riga del giorno che manca', /«rinviato»/.test(workflow.description || '') && /la riga del giorno manca/.test(workflow.description || ''), workflow.description);
  const f = await funzione('riepilogoDichiarazioni');
  const a = await chiama(f, { registra: true }, [IN_CORSO, ...PULITO]);
  verifica('scrive nella risposta che ha rinviato e perche\'', a.j.fotografia && a.j.fotografia.scritta === false && a.j.fotografia.rinviata === true
    && /primarie/.test(a.j.fotografia.motivo || ''), JSON.stringify(a.j.fotografia));
  const foto = await chiama(f, { registra: true }, [FOTO_IN_CORSO, ...PULITO]);
  verifica('per la fotografia conta anche il file degli ordini non dichiarati', rinviata(foto, 'ordini non dichiarati') && foto.scritte.length === 0, `${foto.stato} ${(foto.j.error || '').slice(0, 160)}`);
  const pagina = await chiama(f, { anno: Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric' }).format(new Date())) }, [IN_CORSO, ...PULITO]);
  verifica('la pagina (senza registra) legge come prima: niente 409 e niente letture del registro', pagina.stato === 200 && pagina.letture === 0 && pagina.j.fotografia === null, `${pagina.stato} ${pagina.letture}`);
  const altroAnno = await chiama(f, { registra: true, anno: 2020 }, [IN_CORSO, ...PULITO]);
  verifica('con un altro anno la fotografia non si scrive comunque, e non serve leggere il registro', altroAnno.stato === 200 && altroAnno.letture === 0, `${altroAnno.stato} ${altroAnno.letture}`);
  const congela = await funzione('congelaPassivaMese');
  const nonConta = await chiama(congela, CASI[0].corpo, [FOTO_IN_CORSO, ...PULITO]);
  verifica('per la passiva la fotografia del portale non conta: si congela', nonConta.stato === 200 && nonConta.scritte.some(w => /ChiusuraPassivaMese/.test(w)), `${nonConta.stato} ${nonConta.scritte.join(',')}`);
  // Il solo canale dell'extra raccolta usa solo le schede del suo modulo: le
  // primarie a meta' non lo fermano (revisione finale, 11/10/2026).
  const extraCongela = await chiama(congela, { anno: 2026, mese: 9, canale: 'EXTRA_RACCOLTA' }, [IN_CORSO, ...PULITO]);
  verifica("congelare la passiva dell'extra raccolta non si rinvia per le primarie a meta', e non legge il registro", extraCongela.stato === 200 && !extraCongela.j.rinviato && extraCongela.letture === 0 && extraCongela.scritte.some(w => /ChiusuraPassivaMese/.test(w)), `${extraCongela.stato} ${(extraCongela.j.error || '').slice(0, 160)} letture ${extraCongela.letture}`);
  const reteCongela = await chiama(congela, { anno: 2026, mese: 9, canale: 'RETE' }, [IN_CORSO, ...PULITO]);
  verifica('la rete invece si rinvia', rinviata(reteCongela, 'primarie'), `${reteCongela.stato}`);
  const attiva = await funzione('elaboraFatturazioneAttiva');
  const extraAttiva = await chiama(attiva, { anno: 2026, mese: 'Settembre', tipologie: ['EXTRA_RACCOLTA'] }, [IN_CORSO, ...PULITO]);
  verifica("elaborare l'attiva della sola extra raccolta non si rinvia per le primarie a meta'", extraAttiva.stato !== 409 && !extraAttiva.j.rinviato && extraAttiva.letture === 0, `${extraAttiva.stato} ${(extraAttiva.j.error || '').slice(0, 160)}`);
  const tutteAttiva = await chiama(attiva, { anno: 2026, mese: 'Settembre', tipologie: ['EXTRA_RACCOLTA', 'RETE'] }, [IN_CORSO, ...PULITO]);
  verifica('con la rete fra i canali chiesti si rinvia', rinviata(tutteAttiva, 'primarie'), `${tutteAttiva.stato}`);
}

console.log(`\n${ok} superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
