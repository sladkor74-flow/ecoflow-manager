// Prova delle attivita' della to-do list che si chiudono da sole
// (base44/shared/todoOrdini.ts e base44/functions/controllaTodoOrdini).
//
// Sull'attivita' l'utente scrive l'ID ordine da completare; quando quell'ordine
// PASSA da assegnato a terminato l'attivita' si chiude da sola, e resta scritto
// perche' e quando. Qui si controllano le regole:
//   - il passaggio si deve VEDERE: il primo giro guarda e non chiude mai, e un
//     ordine gia' terminato quando l'attivita' e' comparsa non la chiude;
//   - vale la FINE TRASPORTO e mai la chiusura a portale (regola 1);
//   - un ordine CANCELLATO non chiude niente e si segnala;
//   - lo stato "eseguito" e' un limbo e si dice sempre;
//   - con piu' ordini si chiude quando sono terminati tutti;
//   - una chiusura si fa una volta sola (riaperta a mano, non si richiude).
//
// La funzione si impacchetta con esbuild e un SDK finto che tiene gli archivi in
// globalThis.__ARCHIVI, come in prove/copiaAnnoTarget.mjs. Il giorno e' fissato
// al 28/09/2026. npm run prove
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { ordiniAttivita, statoOrdini, esitoAttivita, controlloAttivita, notaOrdini, testoAvanzamento, testoControlloTodo } from '../base44/shared/todoOrdini.ts';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));

const ADESSO = Date.parse('2026-09-28T06:00:00Z');
const DataVera = Date;
class DataFissa extends DataVera {
  constructor(...a) { super(...(a.length ? a : [ADESSO])); }
  static now() { return ADESSO; }
}
globalThis.Date = DataFissa;

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);

// ---------------------------------------------------------------------------
console.log('GLI ID ORDINE SCRITTI SULL' + "'ATTIVITA'");

verifica('un ID solo', J(ordiniAttivita({ riferimento_ordine: 'ET26000001' })) === J(['ET26000001']));
verifica('piu' + "' di uno, separati come viene", J(ordiniAttivita({ riferimento_ordine: 'ET26000001, ET26000002; et26000003 ET26000004' }))
  === J(['ET26000001', 'ET26000002', 'ET26000003', 'ET26000004']), J(ordiniAttivita({ riferimento_ordine: 'ET26000001, ET26000002; et26000003 ET26000004' })));
verifica('le parole che non sono ID ordine si saltano', J(ordiniAttivita({ riferimento_ordine: 'sollecito ordine ET26000001 e ET26000002 entro il 30/09' }))
  === J(['ET26000001', 'ET26000002']), J(ordiniAttivita({ riferimento_ordine: 'sollecito ordine ET26000001 e ET26000002 entro il 30/09' })));
verifica('lo stesso ID due volte conta una', J(ordiniAttivita({ riferimento_ordine: 'ET26000001, ET26000001' })) === J(['ET26000001']));
verifica('senza ID ordine non c' + "'e' niente da controllare", J(ordiniAttivita({ riferimento_ordine: 'da chiedere al consorzio' })) === J([])
  && J(ordiniAttivita({})) === J([]));
verifica('anche gli ordini delle secondarie hanno la forma giusta', J(ordiniAttivita({ riferimento_ordine: 'SEC26154852' })) === J(['SEC26154852']));

// ---------------------------------------------------------------------------
console.log('IL PERIODO E' + "' LA FINE TRASPORTO, MAI LA CHIUSURA A PORTALE (regola 1)");

const OGGI = '2026-09-28';
// ET26000001 ha finito il trasporto a mezzanotte e mezza italiana del 12/09
// (22:30Z dell'11) ed e' stato chiuso a portale il 20: vale il 12.
const MOVIMENTI = [
  { id_ordine: 'ET26000001', stato: 'terminato', ordine_immesso_il: '2026-09-01T08:00:00Z', trasporto_iniziato_il: '2026-09-10T08:00:00Z', trasporto_finito_il: '2026-09-11T22:30:00Z', ordine_chiuso_il: '2026-09-20T08:00:00Z' },
  { id_ordine: 'ET26000002', stato: 'terminato', ordine_immesso_il: '2026-09-01T08:00:00Z', trasporto_iniziato_il: '2026-09-14T08:00:00Z', trasporto_finito_il: '2026-09-15T08:00:00Z' },
  { id_ordine: 'ET26000004', stato: 'cancellato', motivo_cancellazione: 'altro: mancanza di pfu' },
  { id_ordine: 'ET26000005', stato: 'terminato', trasporto_finito_il: null, ordine_chiuso_il: '2026-09-22T08:00:00Z' },
  // Il limbo del portale: tutti i dati, ma nessuno ha premuto Chiudi.
  { id_ordine: 'ET26000006', stato: 'eseguito', ordine_immesso_il: '2026-09-02T08:00:00Z', trasporto_iniziato_il: '2026-09-17T08:00:00Z', trasporto_finito_il: '2026-09-18T08:00:00Z' },
  // Una fine trasporto nel futuro: a portale l'ha battuta male qualcuno.
  { id_ordine: 'ET26000007', stato: 'terminato', trasporto_finito_il: '2027-01-05T08:00:00Z' },
];
const ASSEGNATI = [{ id_ordine: 'ET26000003', stato: 'assegnato', ordine_immesso_il: '2026-09-02T08:00:00Z' }];
const stato = statoOrdini(MOVIMENTI, ASSEGNATI);
// Gli stessi archivi, ma ET26000003 ha finito il trasporto il 20/09: e' il
// PASSAGGIO da assegnato a terminato.
const TERMINATO_DOPO = { id_ordine: 'ET26000003', stato: 'terminato', ordine_immesso_il: '2026-09-02T08:00:00Z', trasporto_iniziato_il: '2026-09-19T08:00:00Z', trasporto_finito_il: '2026-09-20T08:00:00Z' };
const statoDopo = statoOrdini([...MOVIMENTI, TERMINATO_DOPO], ASSEGNATI);

verifica('il ritiro e' + "' il giorno italiano della fine trasporto", stato.terminati.get('ET26000001') === '2026-09-12', stato.terminati.get('ET26000001'));
verifica('un terminato senza fine trasporto non e' + "' ritirato, e non ripiega sulla chiusura", !stato.terminati.has('ET26000005') && stato.senzaFine.has('ET26000005'));
verifica('un cancellato si riconosce col suo motivo, scritto come in Evasione Assegnati',
  stato.cancellati.get('ET26000004') === 'Mancanza di pfu', stato.cancellati.get('ET26000004'));
verifica("gli assegnati dicono soltanto che l'ordine esiste", stato.presenti.has('ET26000003') && !stato.terminati.has('ET26000003'));
verifica('un "eseguito" non e' + "' un terminato", stato.eseguiti.has('ET26000006') && !stato.terminati.has('ET26000006'));

// ---------------------------------------------------------------------------
console.log('IL PASSAGGIO SI DEVE VEDERE: IL PRIMO GIRO GUARDA, NON CHIUDE');

// Un giro dopo l'altro: i campi scritti dal gestionale tornano sull'attivita',
// com'e' nella realta' (li salva la function).
const giroDopo = (todo, campi) => ({ ...todo, ...campi });

const attesa = { titolo: 'Ritiro Bianchi', riferimento_ordine: 'ET26000003', stato: 'aperto' };
const primo = controlloAttivita(attesa, stato, OGGI);
verifica('il primo giro non chiude niente', primo.chiusa === false && primo.campi.stato === undefined, J(primo.campi));
verifica('e scrive che cosa sta guardando e che cosa aspetta',
  primo.campi.ordini_attesi === 'ET26000003' && primo.campi.ordini_da_attendere === 'ET26000003', J(primo.campi));
const secondo = controlloAttivita(giroDopo(attesa, primo.campi), statoDopo, OGGI);
verifica("quando l'ordine passa a terminato l'attivita' si chiude", secondo.chiusa === true
  && secondo.campi.stato === 'completato' && secondo.campi.chiusa_dal_gestionale === true
  && secondo.campi.chiusa_dal_gestionale_il === OGGI, J(secondo.campi));
verifica('e resta scritto perche' + "' e quando", secondo.campi.chiusura_nota === "chiusa dal gestionale il 28/09/2026: l'ordine ET26000003 risulta terminato, trasporto finito il 20/09/2026", secondo.campi.chiusura_nota);
verifica('il passaggio si consuma: non resta niente da attendere', secondo.campi.ordini_da_attendere === '', J(secondo.campi));
verifica("niente da guardare su un'attivita' a posto", secondo.campi.avviso_ordini === '', secondo.campi.avviso_ordini);

console.log('UN ORDINE GIA' + "' TERMINATO NON CHIUDE L'ATTIVITA' (le attivita' vecchie)");
// Sulle attivita' scritte prima, riferimento_ordine voleva dire "ordine
// correlato": l'ordine c'e' ed e' terminato da tempo, ma il sollecito, la
// pratica o la fattura di cui parla l'attivita' nessuno li ha fatti.
const vecchia = { titolo: 'Sollecitare Ecotyre per il prezzo', riferimento_ordine: 'ET26000001', stato: 'aperto' };
const v1 = controlloAttivita(vecchia, stato, OGGI);
verifica('il primo giro non chiude e non ha niente da attendere', v1.chiusa === false && v1.campi.ordini_da_attendere === '', J(v1.campi));
const v2 = controlloAttivita(giroDopo(vecchia, v1.campi), stato, OGGI);
verifica('e nemmeno il giro dopo, per sempre', v2.chiusa === false && v2.campi.stato === undefined, J(v2.campi));
verifica('la nota dice perche' + "', senza allarmi", notaOrdini(giroDopo(vecchia, v1.campi)).includes('risultava già terminato')
  && giroDopo(vecchia, v1.campi).avviso_ordini === '', notaOrdini(giroDopo(vecchia, v1.campi)));
verifica('su una chiusa dal gestionale la nota non compare', notaOrdini({ ordini_attesi: 'ET1', ordini_da_attendere: '', ordini_totali: 1, ordini_terminati: 1, chiusa_dal_gestionale: true, stato: 'aperto' }) === '');
verifica('e nemmeno finche' + "' c'e' qualcosa da attendere", notaOrdini({ ordini_attesi: 'ET1', ordini_da_attendere: 'ET1', ordini_totali: 1, ordini_terminati: 0, stato: 'aperto' }) === '');

console.log('SE L' + "'UTENTE CAMBIA GLI ID, SI RICOMINCIA A GUARDARE");
const cambiata = controlloAttivita(giroDopo(attesa, { ...primo.campi, ordini_attesi: 'ET26000009' }), statoDopo, OGGI);
verifica('ID diversi: si riscrive che cosa si guarda e non si chiude', cambiata.chiusa === false
  && cambiata.campi.ordini_attesi === 'ET26000003' && cambiata.campi.ordini_da_attendere === '', J(cambiata.campi));

// Ma gli STESSI ID riscritti in un altro ordine NON sono ID cambiati: conta quali
// ordini sono, non come sono scritti. Difetto trovato il 02/10/2026: si
// confrontavano le stringhe, cosi' "ET26000003, ET26000002" sembrava diverso da
// "ET26000002, ET26000003", l'attivita' tornava al primo giro - che non chiude mai
// - e restava aperta per sempre anche con tutti i suoi ordini terminati.
const dueID = { titolo: 'Ritiri Verdi', riferimento_ordine: 'ET26000002, ET26000003', stato: 'aperto' };
const d1 = controlloAttivita(dueID, stato, OGGI);
const rovesciata = { ...dueID, ...d1.campi, riferimento_ordine: 'ET26000003, ET26000002' };
const d2 = controlloAttivita(rovesciata, stato, OGGI);
verifica('gli stessi ID in un altro ordine non riportano al primo giro',
  d2.chiusa === false && d2.campi.ordini_da_attendere === undefined, J(d2.campi));
const d3 = controlloAttivita(rovesciata, statoDopo, OGGI);
verifica("e quando gli ordini sono terminati l'attivita' si chiude lo stesso",
  d3.chiusa === true && d3.campi.stato === 'completato' && d3.campi.ordini_da_attendere === '', J(d3.campi));
verifica("in ordini_attesi resta scritto l'ordine dell'utente", d3.campi.ordini_attesi === 'ET26000003, ET26000002', d3.campi.ordini_attesi);

// ---------------------------------------------------------------------------
console.log('PIU' + "' DI UN ORDINE: SI CHIUDE QUANDO SONO TERMINATI TUTTI");

const due = { titolo: 'Ritiri Bianchi', riferimento_ordine: 'ET26000002, ET26000003', stato: 'aperto' };
const aMeta = controlloAttivita(due, stato, OGGI);
verifica('con un ordine ancora aperto non si chiude', aMeta.chiusa === false && aMeta.campi.stato === undefined, J(aMeta.campi));
verifica('e intanto si vede a che punto e' + "'", aMeta.campi.ordini_totali === 2 && aMeta.campi.ordini_terminati === 1, J(aMeta.campi));
verifica("si attende solo quello aperto", aMeta.campi.ordini_da_attendere === 'ET26000003', J(aMeta.campi));
verifica('la riga a video lo dice, al singolare quando e' + "' uno",
  testoAvanzamento(1, 2) === '1 ordine su 2 terminato' && testoAvanzamento(2, 3) === '2 ordini su 3 terminati' && testoAvanzamento(1, 1) === '', testoAvanzamento(1, 2));
verifica("un ordine assegnato non e' un ordine sconosciuto", aMeta.campi.avviso_ordini === '', aMeta.campi.avviso_ordini);

const finita = controlloAttivita(giroDopo(due, aMeta.campi), statoDopo, OGGI);
verifica('terminati tutti, si chiude', finita.chiusa === true && finita.campi.stato === 'completato', J(finita.campi));
verifica("e la nota dice gli ordini e l'ultimo trasporto", finita.campi.chiusura_nota === 'chiusa dal gestionale il 28/09/2026: gli ordini ET26000002 e ET26000003 risultano terminati, l' + "'ultimo trasporto finito il 20/09/2026", finita.campi.chiusura_nota);

// ---------------------------------------------------------------------------
console.log('UN ORDINE CANCELLATO NON CHIUDE NIENTE, SI SEGNALA (regola dell' + "'utente)");

const daCancellare = { titolo: 'Ritiro Verdi', riferimento_ordine: 'ET26000004', stato: 'aperto' };
// Prima era assegnato: il passaggio c'e' stato, ma verso la cancellazione.
const c1 = controlloAttivita(daCancellare, statoOrdini([], [{ id_ordine: 'ET26000004', stato: 'assegnato' }]), OGGI);
const cancellata = controlloAttivita(giroDopo(daCancellare, c1.campi), stato, OGGI);
verifica('non si chiude', cancellata.chiusa === false && cancellata.campi.stato === undefined, J(cancellata.campi));
verifica('e si dice perche' + "', col motivo del portale", cancellata.campi.avviso_ordini.includes('ET26000004 (Mancanza di pfu)')
  && cancellata.campi.avviso_ordini.includes('cancellato') && cancellata.campi.avviso_ordini.includes('decidi tu'), cancellata.campi.avviso_ordini);
const mista = { titolo: 'Due ritiri', riferimento_ordine: 'ET26000003, ET26000004', stato: 'aperto' };
const m1 = controlloAttivita(mista, stato, OGGI);
const m2 = controlloAttivita(giroDopo(mista, m1.campi), statoDopo, OGGI);
verifica("un cancellato blocca la chiusura anche se l'altro e' terminato", m2.chiusa === false
  && m2.campi.ordini_terminati === 1 && m2.campi.avviso_ordini.includes('ET26000004'), J(m2.campi));

console.log('IL LIMBO "ESEGUITO" SI DICE SEMPRE');
const eseguita = { titolo: 'Ritiro Gialli', riferimento_ordine: 'ET26000006', stato: 'aperto' };
const e1 = controlloAttivita(eseguita, stato, OGGI);
verifica('non chiude niente', e1.chiusa === false && e1.campi.ordini_terminati === 0, J(e1.campi));
verifica('e lo spiega con le parole del portale', e1.campi.avviso_ordini.includes('eseguito')
  && e1.campi.avviso_ordini.includes('Chiudi') && e1.campi.avviso_ordini.includes('stato definitivo'), e1.campi.avviso_ordini);
verifica('non si dice due volte come "senza la data di fine trasporto"',
  !e1.campi.avviso_ordini.includes('senza la data di fine trasporto'), e1.campi.avviso_ordini);

console.log('TERMINATO SENZA LA DATA, NEL FUTURO, E ID CHE NON SI TROVA');
const senzaData = controlloAttivita({ titolo: 'Ritiro Neri', riferimento_ordine: 'ET26000005', stato: 'aperto' }, stato, OGGI);
verifica('terminato senza fine trasporto: resta aperta e si dice', senzaData.chiusa === false
  && senzaData.campi.avviso_ordini.includes('senza la data di fine trasporto'), senzaData.campi.avviso_ordini);
const futuro = { titolo: 'Ritiro Futuro', riferimento_ordine: 'ET26000007', stato: 'aperto' };
const f1 = controlloAttivita(futuro, statoOrdini([], [{ id_ordine: 'ET26000007', stato: 'assegnato' }]), OGGI);
const f2 = controlloAttivita(giroDopo(futuro, f1.campi), stato, OGGI);
verifica('una fine trasporto nel futuro non chiude niente', f2.chiusa === false && f2.campi.stato === undefined, J(f2.campi));
const sconosciuto = controlloAttivita({ titolo: 'ID sbagliato', riferimento_ordine: 'ET26999999', stato: 'aperto' }, stato, OGGI);
verifica('un ID che non si trova si dice, invece di sparire', sconosciuto.chiusa === false
  && sconosciuto.campi.avviso_ordini.includes('non si trova'), sconosciuto.campi.avviso_ordini);
verifica('e non manda a ricaricare un file come se fosse la sola causa',
  sconosciuto.campi.avviso_ordini.includes('non è un ID ordine') && sconosciuto.campi.avviso_ordini.includes('scritto male'), sconosciuto.campi.avviso_ordini);

const scrittoMale = controlloAttivita({ titolo: 'Ordine scritto male', riferimento_ordine: 'ordine 12345 di Rossi', stato: 'aperto' }, stato, OGGI);
verifica('un testo che non e' + "' un ID ordine non si ignora in silenzio", scrittoMale.chiusa === false
  && scrittoMale.campi.avviso_ordini.includes('non è un ID ordine'), scrittoMale.campi.avviso_ordini);
verifica('e il campo vuoto invece non ha niente da dire', controlloAttivita({ riferimento_ordine: '', stato: 'aperto' }, stato, OGGI).campi.avviso_ordini === '');

console.log('QUELLO CHE IL GESTIONALE NON FA');
const completata = controlloAttivita(giroDopo({ riferimento_ordine: 'ET26000003', stato: 'completato' }, { ordini_attesi: 'ET26000003', ordini_da_attendere: 'ET26000003' }), statoDopo, OGGI);
verifica('una completata non si ritocca', completata.chiusa === false && completata.campi.stato === undefined, J(completata.campi));
verifica('ma il passaggio si consuma lo stesso', completata.campi.ordini_da_attendere === '', J(completata.campi));
verifica('percio' + "' una riaperta a mano dopo non si richiude",
  controlloAttivita({ riferimento_ordine: 'ET26000003', stato: 'aperto', ordini_attesi: 'ET26000003', ordini_da_attendere: '' }, statoDopo, OGGI).chiusa === false);
verifica('una riaperta dopo una chiusura del gestionale non si richiude',
  controlloAttivita({ riferimento_ordine: 'ET26000003', stato: 'aperto', chiusa_dal_gestionale: true, ordini_attesi: 'ET26000003', ordini_da_attendere: 'ET26000003' }, statoDopo, OGGI).chiusa === false);
verifica("senza ID ordine non chiude niente", controlloAttivita({ riferimento_ordine: '', stato: 'aperto' }, stato, OGGI).chiusa === false
  && esitoAttivita({ riferimento_ordine: '' }, stato).ultima === null);
verifica("su un'attivita' completata l'avviso non dice che resta aperta",
  !controlloAttivita({ riferimento_ordine: 'ET26000004', stato: 'completato' }, stato, OGGI).campi.avviso_ordini.includes('resta aperta'),
  controlloAttivita({ riferimento_ordine: 'ET26000004', stato: 'completato' }, stato, OGGI).campi.avviso_ordini);

console.log('LA RIGA DOPO IL CARICAMENTO');
verifica('dice che si e' + "' chiusa da sola", testoControlloTodo([{ titolo: 'Ritiro Rossi', ordini: 'ET26000001' }], []).includes('Ritiro Rossi (ET26000001)'));
verifica('e che cosa resta da guardare', testoControlloTodo([], [{ titolo: 'Ritiro Verdi', avviso: 'ordine cancellato' }]).includes('Ritiro Verdi'));
verifica('senza niente da dire resta muta', testoControlloTodo([], []) === '');

// ---------------------------------------------------------------------------
// La funzione vera, con gli archivi in memoria
// ---------------------------------------------------------------------------
const SDK_FINTO = `
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => (v && typeof v === 'object' && Array.isArray(v.$in) ? v.$in.includes(r[k]) : r[k] === v));
const ordina = (righe, ord) => {
  const campo = String(ord || 'id').replace(/^[-+]/, '') || 'id';
  const verso = String(ord || '').startsWith('-') ? -1 : 1;
  return [...righe].sort((a, b) => String(a[campo] ?? '').localeCompare(String(b[campo] ?? '')) * verso);
};
function entita(nome) {
  const righe = () => (globalThis.__ARCHIVI[nome] ||= []);
  return {
    filter: async (f, ord, quanti = 1e9, salta = 0) => {
      if (globalThis.__NIENTE_DA_IN && f && f.id_ordine && f.id_ordine.$in) return [];
      return ordina(righe().filter(r => soddisfa(r, f)), ord).slice(salta, salta + quanti).map(r => ({ ...r }));
    },
    list: async (ord, quanti = 1e9, salta = 0) => ordina(righe(), ord).slice(salta, salta + quanti).map(r => ({ ...r })),
    update: async (id, d) => {
      const r = righe().find(x => x.id === id);
      if (!r) throw new Error('non trovato ' + id);
      Object.assign(r, d);
      globalThis.__SCRITTI.push({ nome, id, d });
      return { ...r };
    },
  };
}
const entities = new Proxy({}, { get: (_t, nome) => entita(nome) });
export function createClientFromRequest() {
  return { auth: { me: async () => { if (!globalThis.__UTENTE) throw new Error('non autenticato'); return globalThis.__UTENTE; } }, asServiceRole: { entities }, entities };
}`;
const sdkFinto = {
  name: 'sdk-finto',
  setup(b) {
    b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'finto' }));
    b.onLoad({ filter: /.*/, namespace: 'finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
  },
};
const impacchettata = await build({
  entryPoints: [qui('../base44/functions/controllaTodoOrdini/entry.ts')],
  bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent', plugins: [sdkFinto],
});
const modulo = await import('data:text/javascript;base64,' + Buffer.from(impacchettata.outputFiles[0].text).toString('base64'));
const controlla = async (body = {}) => {
  const res = await modulo.default({ json: async () => body });
  return { status: res.status, body: await res.json() };
};

const TODO = () => [
  { id: 't1', titolo: 'Sollecitare il prezzo', stato: 'aperto', riferimento_ordine: 'ET26000001' },
  { id: 't2', titolo: 'Ritiri Bianchi', stato: 'aperto', riferimento_ordine: 'ET26000002, ET26000003' },
  { id: 't3', titolo: 'Chiamare il consorzio', stato: 'aperto', riferimento_ordine: '' },
  { id: 't6', titolo: 'Ordine scritto male', stato: 'aperto', riferimento_ordine: 'ordine 12345' },
  { id: 't4', titolo: 'Ritiro Verdi', stato: 'aperto', riferimento_ordine: 'ET26000004' },
  { id: 't5', titolo: 'Ritiro Neri', stato: 'in_corso', riferimento_ordine: 'ET26000005' },
];
const prepara = (utente = { role: 'admin', full_name: 'Amministratore' }, log = []) => {
  globalThis.__ARCHIVI = {
    Todo: TODO(),
    PrimariaRete: MOVIMENTI.map((m, i) => ({ id: 'p' + i, ...m })),
    PrimariaAci: [],
    ExtraRaccolta: [],
    Assegnato: ASSEGNATI.map((a, i) => ({ id: 'a' + i, ...a })),
    AssegnatoAci: [],
    UploadLog: log,
  };
  globalThis.__SCRITTI = [];
  globalThis.__UTENTE = utente;
  globalThis.__NIENTE_DA_IN = false;
};
const todo = (id) => globalThis.__ARCHIVI.Todo.find(t => t.id === id);

console.log('LA FUNZIONE: PRIMA GUARDA, POI CHIUDE');
prepara(null);
verifica('senza utente non si controlla niente', (await controlla()).status === 401 && globalThis.__SCRITTI.length === 0);

prepara();
let r = await controlla();
verifica('risponde 200 e dice quante ha controllato', r.status === 200 && r.body.controllate === 5, `${r.status} ${J(r.body).slice(0, 200)}`);
verifica('il primo giro non chiude NESSUNA attivita' + "'", r.body.chiuse.length === 0
  && globalThis.__ARCHIVI.Todo.every(t => t.stato !== 'completato'), J(globalThis.__ARCHIVI.Todo.map(t => [t.id, t.stato])));
verifica("l'attivita' vecchia sull'ordine gia' terminato resta aperta", todo('t1').stato === 'aperto'
  && todo('t1').ordini_attesi === 'ET26000001' && todo('t1').ordini_da_attendere === '', J(todo('t1')));
verifica("l'ordine scritto male si segnala, non si ignora", todo('t6').avviso_ordini.includes('non è un ID ordine')
  && todo('t6').stato === 'aperto' && todo('t6').ordini_totali === 0, J(todo('t6')));
verifica("quella a meta' resta aperta, con l'avanzamento e l'attesa", todo('t2').stato === 'aperto'
  && todo('t2').ordini_totali === 2 && todo('t2').ordini_terminati === 1 && todo('t2').ordini_da_attendere === 'ET26000003', J(todo('t2')));
verifica("quella con l'ordine cancellato resta aperta e si segnala", todo('t4').stato === 'aperto'
  && todo('t4').avviso_ordini.includes('Mancanza di pfu') && r.body.da_guardare.some(x => x.id === 't4'), J(todo('t4')));
verifica('il terminato senza data non chiude niente e si dice', todo('t5').stato === 'in_corso'
  && todo('t5').avviso_ordini.includes('senza la data di fine trasporto'), J(todo('t5')));
verifica("l'attivita' senza ID ordine non si tocca", !globalThis.__SCRITTI.some(s => s.id === 't3') && todo('t3').ordini_totali === undefined);

globalThis.__SCRITTI = [];
r = await controlla();
verifica('rifatto subito non riscrive niente', r.body.aggiornate === 0 && globalThis.__SCRITTI.length === 0, J(globalThis.__SCRITTI));
verifica("ma continua a dire che cosa c'e' da guardare", J(r.body.da_guardare.map(x => x.id)) === J(['t4', 't5', 't6']) && r.body.chiuse.length === 0, J(r.body.da_guardare.map(x => x.id)));

console.log('QUANDO L' + "'ORDINE ATTESO PASSA A TERMINATO");
globalThis.__ARCHIVI.PrimariaRete.push({ id: 'p9', ...TERMINATO_DOPO });
globalThis.__SCRITTI = [];
r = await controlla();
verifica('adesso si chiude', todo('t2').stato === 'completato' && todo('t2').ordini_terminati === 2
  && todo('t2').chiusura_nota.includes('20/09/2026'), J(todo('t2')));
verifica('e lo racconta a chi ha caricato', r.body.chiuse.length === 1 && r.body.chiuse[0].id === 't2'
  && r.body.chiuse[0].ritiro === '2026-09-20' && r.body.avviso.includes('Ritiri Bianchi'), J(r.body.chiuse) + ' ' + r.body.avviso);
verifica("l'attivita' vecchia non si e' chiusa nemmeno adesso", todo('t1').stato === 'aperto', J(todo('t1')));

console.log('UNA RIAPERTA A MANO NON SI RICHIUDE');
todo('t2').stato = 'aperto';
globalThis.__SCRITTI = [];
await controlla();
verifica('resta aperta come l' + "'ha lasciata l'utente", todo('t2').stato === 'aperto' && !globalThis.__SCRITTI.some(s => s.id === 't2'), J(todo('t2')));

console.log('SE LA DOMANDA PER NUMERO D' + "'ORDINE NON TORNA NIENTE, NON SI DECIDE");
prepara();
globalThis.__NIENTE_DA_IN = true;
r = await controlla();
verifica('si rinvia invece di dire che gli ordini non si trovano', r.status === 200 && r.body.rinviato === true
  && globalThis.__SCRITTI.length === 0, `${r.status} ${J(r.body).slice(0, 220)}`);
verifica('e non scrive "non si trova" su nessuna attivita' + "'",
  globalThis.__ARCHIVI.Todo.every(t => !String(t.avviso_ordini || '').includes('non si trova')), J(globalThis.__ARCHIVI.Todo.map(t => t.avviso_ordini)));

console.log('CON UN CARICAMENTO DELLE PRIMARIE APERTO NON SI DECIDE NIENTE (regola 2)');
prepara({ role: 'admin' }, [{
  id: 'l1', tipo_file: 'primarie', nome_file: 'primarie.xlsx', esito: 'in_corso', modalita: 'sostituzione',
  utente: 'Amministratore', created_date: new Date(ADESSO - 2 * 60 * 1000).toISOString(),
}]);
r = await controlla();
verifica('si rinvia, e non scrive niente', r.status === 200 && r.body.rinviato === true && globalThis.__SCRITTI.length === 0
  && todo('t1').stato === 'aperto', `${r.status} ${J(r.body).slice(0, 200)}`);
verifica('dicendo quale caricamento lo impedisce', String(r.body.avviso).includes('primarie') && r.body.caricamenti_in_corso.length === 1, r.body.avviso);

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
