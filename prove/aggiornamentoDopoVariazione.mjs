// DOPO UNA VARIAZIONE DEL CONTRATTO SI AGGIORNANO ANCHE LE PAGINE GIA' APERTE
// (14/10/2026).
//
// Richiesta dell'utente del 14/10/2026, testuale: «falla tu la registrazione ed
// aggiorna tutto, ma fai in modo che quando si faccia una tale variazione i
// moduli collegati come la dashboard si aggiornino di conseguenza». Le funzioni
// leggono il contratto quando sono chiamate, ma le pagine lo chiedono quando si
// aprono: una dashboard aperta in un'altra scheda del browser restava a 11.550 t
// finche' non la si ricaricava, e la scheda Commessa aperta prima della
// variazione, salvata dopo, l'avrebbe tolta dai numeri senza dire niente.
//
// Ora chi scrive contratto e target lo annuncia (src/lib/eventiDati.js: evento
// della finestra per la stessa scheda, BroadcastChannel per le altre) e chi li
// mostra rilegge solo la parte toccata, una volta per raffica, a scheda visibile.
// Qui, con le pagine vere (prove/dati/paginaFinta.mjs) e le funzioni vere sul
// banco (getDashboardRaccolta e cruscottoOperativo, prove/dati/bancoFunzioni.mjs):
//  1. la regola delle riletture (eventiDati.js), con l'orologio finto;
//  2. la dashboard aperta in una scheda, la variazione registrata in un'altra
//     con la finestra vera (VariazioneContratto): il quadro si rilegge una
//     volta e dice 11.650 t, la voce «I raccoglitori della Puglia hanno 100,00 t
//     più del contratto» sparisce; nessuna rilettura senza variazione; una
//     raffica fa una rilettura; la scheda nascosta rilegge al ritorno; 2c. a
//     novembre la commessa dell'anno dopo salvata altrove toglie il contratto
//     dalle cose che mancano nella voce «Nuovo anno»;
//  3. l'Andamento di Target & Status aperto: rilegge solo il contratto;
//  4. la scheda Commessa aperta: si rimette il contratto nuovo; con modifiche
//     a video le tiene, rimette come salvate le parti non toccate e, se una
//     parte e' cambiata qui e li', avvisa che la variazione uscirebbe dai
//     numeri; 4b. aperta su un altro computer, dove l'annuncio non arriva: il
//     salvataggio rilegge il contratto e non toglie la variazione; 4c. la
//     scheda Impianti e stoccaggi aperta prima, salvata dopo, nemmeno; la copia
//     dell'anno si annuncia;
//  5. la scheda Target raccoglitori aperta: l'avviso della Puglia sparisce; le
//     sue celle annunciano i target scritti e non rileggono per se stesse;
//  6. le fotografie: nessuna funzione che salva un conto (guardiano, alert,
//     qualifica, report, evasione, predittivita') legge il target del contratto,
//     quindi una variazione non vi lascia un numero vecchio.
// npm run prove
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { caricaPagina, clienteFinto, aspetta, trova, testo, nomeDi, orologioFinto } from './dati/paginaFinta.mjs';
import { caricaLibPagine } from './dati/libPagine.mjs';
import { caricaFunzione, chiama } from './dati/bancoFunzioni.mjs';
import * as A from '../base44/shared/attesoContratto.ts';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));

// IL CALENDARIO FERMO AL GIORNO DELLA VARIAZIONE (revisione del 14/10/2026): la
// dashboard guarda l'anno di oggi, e col calendario vero dal 01/01/2027 la prova
// sarebbe diventata rossa senza che il codice cambiasse. Il 14/10/2026 alle
// 10:00 italiane; l'ora scorre solo con l'orologio finto (scorre, piu' sotto), e
// la sezione dell'anno nuovo sposta il giorno al 15/11/2026.
const OraVera = Date;
const GIORNO_PROVA = OraVera.parse('2026-10-14T08:00:00.000Z');
let oraBase = GIORNO_PROVA;
let scorre = () => 0;
globalThis.Date = class extends OraVera {
  constructor(...a) { if (a.length) super(...a); else super(oraBase + scorre()); }
  static now() { return oraBase + scorre(); }
};

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = JSON.stringify;

// === il browser finto: due schede (due finestre), un documento, il canale ===
const nuovaFinestra = () => Object.assign(new EventTarget(), {
  self: 1, top: 1, location: { pathname: '/' }, confirm: () => true, alert: () => {},
  matchMedia: () => ({ matches: false, addListener() {}, removeListener() {} }),
});
const finestraA = nuovaFinestra(); // la scheda che guarda (dashboard, Andamento, ...)
const finestraB = nuovaFinestra(); // la scheda di Target & Status dove si scrive
globalThis.window = finestraA;
const documento = Object.assign(new EventTarget(), { visibilityState: 'visible' });
globalThis.document = documento;
// Il BroadcastChannel del browser: consegna agli altri canali con lo stesso nome,
// mai a quello che spedisce. Ogni pagina impacchettata qui ha il suo
// eventiDati.js, quindi il suo canale: come una scheda a se'.
const canali = [];
const spediti = [];
// Spento, il canale non consegna: e' la scrittura fatta da un altro computer,
// dove l'annuncio fra le schede non arriva.
let altroComputer = false;
globalThis.BroadcastChannel = class extends EventTarget {
  constructor(nome) { super(); this.name = nome; canali.push(this); }
  postMessage(dato) {
    spediti.push(dato);
    if (altroComputer) return;
    const copia = structuredClone(dato);
    for (const c of canali) if (c !== this && c.name === this.name) queueMicrotask(() => c.dispatchEvent(new MessageEvent('message', { data: copia })));
  }
  close() {}
};
const canaleProva = new BroadcastChannel('target-cambiati'); // una terza scheda, per i messaggi a mano
const daUnAltraScheda = (m) => canaleProva.postMessage(m);

// === l'archivio: il contratto 2026 com'era l'11/10, i target dei raccoglitori col +100 di SMOCO ===
const ANNO = 2026;
const COMMESSA = {
  id: 'c26', anno: ANNO, target_annuo_t: 11550, updated_date: '2026-09-01T10:00:00.000000', storico_json: '[]',
  regioni_json: J([{ regione: 'Campania', province: 'NA, SA', target_t: 9050 }, { regione: 'Puglia', province: 'BA', target_t: 2500 }]),
  target_mensile_json: J([900, 900, 1000, 1000, 1000, 1000, 1000, 900, 1000, 1100, 900, 850]),
  destinazioni_json: J([{ destinazione: 'IRIGOM', target_t: 4450 }, { destinazione: 'GATIM', target_t: 7100 }]),
};
const DB0 = {
  CommessaEcotyre: [COMMESSA],
  TargetRaccoglitore: [
    { id: 'a1', anno: ANNO, raccoglitore: 'SMOCO SRL', regione: 'Puglia', impianto: 'IRIGOM', target_tonnellate: 2600, storico_json: '[]' },
    { id: 'a2', anno: ANNO, raccoglitore: 'NAPPI SUD SRL', regione: 'Campania', impianto: 'GATIM', target_tonnellate: 9050, storico_json: '[]' },
  ],
  TargetMensile: [{ id: 'm1', anno: ANNO, raccoglitore: 'SMOCO SRL', regione: 'Puglia', impianto: 'IRIGOM', mese: 'Ottobre', target: 270, storico_json: '[]' }],
  PrimariaRete: [{ id: 'p1', id_ordine: 'E1', stato: 'terminato', provincia: 'BA', regione: 'Puglia', trasportatore: 'SMOCO SRL', destinazione: 'IRIGOM', peso_effettivo: 10000,
    ordine_immesso_il: '2026-10-01T08:00:00Z', trasporto_iniziato_il: '2026-10-02T06:00:00Z', trasporto_finito_il: '2026-10-02T10:00:00Z' }],
};
const DB = {};
const azzeraArchivio = () => { for (const k of Object.keys(DB)) delete DB[k]; Object.assign(DB, structuredClone(DB0)); };
azzeraArchivio();

// Le funzioni vere sul banco, che leggono lo stesso archivio delle pagine.
const funzioneDashboard = await caricaFunzione('getDashboardRaccolta');
const funzioneCruscotto = await caricaFunzione('cruscottoOperativo');
let quadroCade = false;
let copiaCade = false;
const RACCOLTO ={ totale_raccolto: 10, by_regione: [{ regione: 'Puglia', totale: 10, mesi: { Ottobre: 10 } }], by_raccoglitore: [], by_impianto: [], by_raccoglitore_impianto: [], filterOptions: { mesi: [], regioni: ['Puglia'], raccoglitori: [], impianti: [] }, date_da_sistemare: null };
const funzioni = {
  getDashboardRaccolta: async (corpo) => {
    if (quadroCade) { const e = new Error('limite di richieste'); e.status = 429; throw e; }
    const r = await chiama(funzioneDashboard, { db: DB, corpo });
    return r.j;
  },
  cruscottoOperativo: async (corpo) => (await chiama(funzioneCruscotto, { db: DB, corpo })).j,
  calcolaMargine: async () => ({}),
  computeRaccolto: async () => structuredClone(RACCOLTO),
  // la copia dell'anno di Impianti e stoccaggi: qui conta solo che cosa dice di aver scritto
  copiaAnnoTarget: async ({ simula }) => {
    if (!simula && copiaCade) { const e = new Error('limite di richieste'); e.status = 429; throw e; }
    return { ok: true, anno: ANNO, da: ANNO - 1, simulato: !!simula, conteggi: { impianti: 0, collegamenti: 0, raccoglitori: 2, mensili: 12, commessa: 0, siti: 0 }, saltati: {} };
  },
};
const c = clienteFinto({ funzioni, archivi: DB });
// Le scritture delle pagine finiscono davvero nell'archivio: le funzioni le rileggono.
const entitaFinte = c.cliente.entities;
c.cliente.entities = new Proxy({}, {
  get: (_t, nome) => {
    const e = entitaFinte[nome];
    if (typeof nome !== 'string' || !e) return e;
    return {
      ...e,
      update: async (id, r) => {
        const out = await e.update(id, r);
        const t = DB[nome] || (DB[nome] = []);
        const i = t.findIndex(x => x.id === id);
        if (i >= 0) t[i] = { ...t[i], ...r, updated_date: '2026-10-14T10:00:00.000000' };
        return i >= 0 ? { ...t[i] } : out;
      },
      create: async (r) => {
        const out = await e.create(r);
        const nuovo = { ...r, id: `${nome}-${(DB[nome] || []).length + 1}` };
        (DB[nome] || (DB[nome] = [])).push(nuovo);
        return { ...out, ...nuovo };
      },
    };
  },
});
globalThis.__CLIENTE_FINTO = c.cliente;
globalThis.__UTENTE = { id: 'u1', email: 'admin@prova', full_name: 'Amministratore', role: 'admin' };

// Le pagine con il contesto dell'autenticazione e l'indirizzo sostituiti: la
// pagina finta non ha ne' l'uno ne' l'altro. Il resto e' il sorgente vero.
const cartella = mkdtempSync(join(tmpdir(), 'dopo-variazione-'));
const STUB_AUTH = ["import { useAuth } from '@/lib/AuthContext';", 'const useAuth = () => ({ user: globalThis.__UTENTE || null });'];
const STUB_INDIRIZZO = ["import { useSearchParams } from 'react-router-dom';", "const useSearchParams = () => [new URLSearchParams(globalThis.__INDIRIZZO || ''), (p) => { globalThis.__INDIRIZZO = new URLSearchParams(p).toString(); }];"];
function copia(percorso, sostituzioni) {
  let s = readFileSync(qui('../src/' + percorso), 'utf8').replace(/\r/g, '');
  for (const [da, a] of sostituzioni) {
    verifica(`${percorso}: ${da.slice(0, 50)}`, s.includes(da));
    s = s.replace(da, a);
  }
  const f = join(cartella, percorso.split('/').pop());
  writeFileSync(f, s);
  return f;
}
const paginaDashboard = await caricaPagina('pages/Dashboard', { file: copia('pages/Dashboard.jsx', [STUB_AUTH, STUB_INDIRIZZO]), reali: ['@/components/dashboard/vociDashboard'] });
const paginaTarget = await caricaPagina('pages/TargetStatus', { file: copia('pages/TargetStatus.jsx', [STUB_AUTH, STUB_INDIRIZZO]) });
const finestraVariazione = await caricaPagina('components/target-status/VariazioneContratto');
const schedaCommessa = await caricaPagina('components/target-status/CommessaEcotyreForm', { reali: ['@/components/target-status/VariazioneContratto'] });
const schedaRaccoglitori = await caricaPagina('components/target-status/TargetRaccoglitoriGrid');
const schedaImpianti = await caricaPagina('components/target-status/ConfigurazioneImpianti');
// La libreria degli eventi, impacchettata come la usano le pagine (React finto);
// una seconda copia e' la stessa libreria in un'altra scheda, col suo canale.
const libreria = async (commento) => {
  const f = join(cartella, `eventiDati-${commento.replace(/\W+/g, '-')}.js`);
  writeFileSync(f, `// ${commento}\n${readFileSync(qui('../src/lib/eventiDati.js'), 'utf8')}`);
  return (await caricaPagina('lib/eventiDati', { file: f })).modulo;
};
const E = await libreria('questa scheda');
const E2 = await libreria('un\'altra scheda');
const E3 = await libreria('un browser senza canale');
// Le cifre della sezione Rete come le scrive la pagina (righeQuadro.js, la stessa del PDF).
const { cifreRete } = (await caricaPagina('components/dashboard/righeQuadro', { reali: ['@/components/dashboard/formato'] })).modulo;

// L'orologio finto dopo gli impacchettamenti; il calendario segue lui.
const orologio = orologioFinto().installa();
scorre = () => orologio.adesso;

const richieste = () => {
  const funzioniChiamate = {};
  for (const x of c.funzioniChiamate()) funzioniChiamate[x.nome] = (funzioniChiamate[x.nome] || 0) + 1;
  const letture = {};
  for (const x of c.letture()) letture[x.nome] = (letture[x.nome] || 0) + 1;
  return { funzioni: funzioniChiamate, letture };
};
const nessuna = (q) => !Object.keys(q.funzioni).length && !Object.keys(q.letture).length;

// La variazione registrata nella scheda B con la finestra vera: ottobre, Puglia,
// +100 t, IRIGOM, il motivo dell'utente.
// Con finestra e onSalvata di chi la monta e' la stessa finestra aperta nella
// stessa scheda (dalla scheda Commessa o dall'avviso dei raccoglitori).
async function registraNellAltraScheda({ origine = 'commessa#B.1', finestra = finestraB, onSalvata = async () => {} } = {}) {
  globalThis.window = finestra;
  const V = finestraVariazione.monta(finestraVariazione.Componente, {
    anno: ANNO, commessa: DB.CommessaEcotyre[0], user: globalThis.__UTENTE, aperta: true, onChiudi: () => {}, onSalvata, origine,
    iniziale: { regione: 'Puglia', verso: 'piu', t: '100', mese_idx: '9', destinazione: 'IRIGOM' },
  });
  await aspetta(10);
  const motivo = trova(V.albero, el => nomeDi(el) === 'Input' && String(el.props.placeholder || '').startsWith('per esempio'))[0];
  motivo.props.onChange({ target: { value: 'assegnazione del consorzio di ottobre (+100 t)' } });
  await aspetta(10);
  const pulsante = trova(V.albero, el => nomeDi(el) === 'Button' && testo(el).includes('Registra la variazione'))[0];
  await pulsante.props.onClick();
  await aspetta(20);
  verifica('la variazione si registra nell\'altra scheda', V.errori.length === 0 && Number(DB.CommessaEcotyre[0].target_annuo_t) === 11650, `${String(V.errori[0] || '')} ${DB.CommessaEcotyre[0].target_annuo_t}`);
  V.smonta();
  globalThis.window = finestraA;
  return V;
}

console.log('1. LA REGOLA DELLE RILETTURE (src/lib/eventiDati.js)');
{
  verifica('il messaggio si ripulisce: anno intero, solo le parti note, nell\'ordine', J(E.messaggioTarget({ anno: '2026', parti: ['mensili', 'altro', 'contratto'], origine: 7 })) === J({ anno: 2026, parti: ['contratto', 'mensili'], origine: '' }));
  verifica('senza anno o senza parti non e\' un messaggio', E.messaggioTarget({ parti: ['contratto'] }) === null && E.messaggioTarget({ anno: 2026, parti: [] }) === null && E.messaggioTarget(null) === null);

  // la coda, con l'orologio finto
  const lanciate = [];
  let nascosta = false;
  let lenta = null;
  const coda = E.codaRiletture({ rileggi: async (cosa) => { lanciate.push(cosa.sort()); if (lenta) await lenta; }, nascosta: () => nascosta });
  coda.aggiungi(['a']); coda.aggiungi(['b']); coda.aggiungi(['a']);
  await orologio.avanza(E.ATTESA_RILETTURA_MS - 1);
  verifica('una raffica aspetta la sua attesa', lanciate.length === 0);
  await orologio.avanza(1);
  verifica('e fa una rilettura sola, con tutto quello che e\' arrivato', J(lanciate) === J([['a', 'b']]), J(lanciate));
  coda.aggiungi(['c']);
  await orologio.avanza(E.ATTESA_RILETTURA_MS + 1000);
  verifica('subito dopo una rilettura la prossima aspetta l\'intervallo', lanciate.length === 1, J(lanciate));
  await orologio.avanza(E.INTERVALLO_RILETTURE_MS);
  verifica('e parte allo scadere', J(lanciate) === J([['a', 'b'], ['c']]), J(lanciate));
  nascosta = true;
  coda.aggiungi(['d']);
  await orologio.avanza(5 * E.INTERVALLO_RILETTURE_MS);
  verifica('a scheda nascosta non si rilegge', lanciate.length === 2, J(lanciate));
  nascosta = false;
  coda.visibile();
  await orologio.avanza(E.ATTESA_AL_RITORNO_MS);
  verifica('si rilegge una volta al ritorno', J(lanciate.slice(2)) === J([['d']]), J(lanciate));
  let finisci;
  lenta = new Promise(r => { finisci = r; });
  coda.aggiungi(['e']);
  await orologio.avanza(E.INTERVALLO_RILETTURE_MS + E.ATTESA_RILETTURA_MS);
  coda.aggiungi(['f']); coda.aggiungi(['g']);
  await orologio.avanza(E.INTERVALLO_RILETTURE_MS * 2);
  verifica('durante una rilettura non ne parte un\'altra', lanciate.length === 4, J(lanciate));
  lenta = null;
  finisci();
  await aspetta(5);
  await orologio.avanza(E.INTERVALLO_RILETTURE_MS + E.ATTESA_RILETTURA_MS);
  verifica('quella dopo parte una volta, con tutto quello che aspettava', J(lanciate.slice(4)) === J([['f', 'g']]), J(lanciate));
  coda.ferma();

  // l'annuncio: la stessa scheda dall'evento della finestra, le altre dal canale, una volta
  const qui1 = [], qui2 = [];
  const smetti1 = E.ascoltaTarget(m => qui1.push(m));
  globalThis.window = finestraB;
  const smetti2 = E2.ascoltaTarget(m => qui2.push(m));
  globalThis.window = finestraA;
  E.annunciaTarget({ anno: 2026, parti: ['contratto'], origine: 'prova' });
  await aspetta(5);
  verifica('la scheda che scrive lo riceve una volta (dalla finestra), non due', qui1.length === 1, J(qui1));
  verifica('l\'altra scheda lo riceve dal canale, una volta', qui2.length === 1 && qui2[0].origine === 'prova', J(qui2));
  smetti1(); smetti2();
  const vecchioCanale = globalThis.BroadcastChannel;
  globalThis.BroadcastChannel = undefined;
  let rotto = null;
  try { E3.annunciaTarget({ anno: 2026, parti: ['annui'] }); E3.ascoltaTarget(() => {})(); } catch (e) { rotto = e; }
  globalThis.BroadcastChannel = vecchioCanale;
  verifica('un browser senza canale non si rompe', rotto === null, String(rotto));

  verifica('la riga della dashboard dopo la rilettura',
    E.testoRilettura({ parti: ['contratto'], anno: 2026, esiti: [{ nome: 'quadro', motivo: '' }, { nome: 'elenco «Da gestire»', motivo: '' }], ora: '10:42' })
      === 'Il contratto Ecotyre del 2026 è cambiato in Target & Status: quadro ed elenco «Da gestire» riletti alle 10:42.');
  verifica('una rilettura caduta si dice, coi numeri di prima a video',
    E.testoRilettura({ parti: ['annui', 'mensili'], anno: 2026, esiti: [{ nome: 'quadro', motivo: 'limite di richieste' }], ora: '10:42' })
      === 'I target dei raccoglitori del 2026 sono cambiati in Target & Status: quadro non si è riletto (limite di richieste): quello a video è di prima, ricarica la pagina.');
}

console.log('2. LA DASHBOARD APERTA IN UN\'ALTRA SCHEDA');
const targetDellaDashboard = (R) => { const el = trova(R.albero, x => nomeDi(x) === 'SezioneRete')[0]; return el ? el.props.quadro.rete.target_t : undefined; };
const cifraDellaDashboard = (R) => { const el = trova(R.albero, x => nomeDi(x) === 'SezioneRete')[0]; return el ? cifreRete(el.props.quadro.rete, { annoInCorso: true })[0].valore : ''; };
const vociDellaDashboard = (R) => ((trova(R.albero, x => nomeDi(x) === 'DaGestire')[0] || { props: {} }).props.visibili || []).map(x => x.voce.chiave);
const rigaRiletta = (R) => trova(R.albero, x => x.type === 'p' && x.props.role === 'status').map(testo).join(' ');
{
  azzeraArchivio();
  globalThis.__INDIRIZZO = '';
  c.azzera();
  const R = paginaDashboard.monta(paginaDashboard.Componente, {});
  await aspetta(80);
  const apertura = richieste();
  verifica('la dashboard si apre senza errori', R.errori.length === 0, String(R.errori[0] || ''));
  verifica('all\'apertura: cruscotto, quadro e margine, una volta ciascuno', J(apertura.funzioni) === J({ cruscottoOperativo: 1, getDashboardRaccolta: 1, calcolaMargine: 1 }), J(apertura));
  verifica('prima della variazione: 11.550 t e la voce dei raccoglitori della Puglia', targetDellaDashboard(R) === 11550 && cifraDellaDashboard(R) === '11.550,00 t' && vociDellaDashboard(R).includes(`contratto-raccoglitori:${ANNO}`),
    J([targetDellaDashboard(R), cifraDellaDashboard(R), vociDellaDashboard(R)]));

  c.azzera();
  await orologio.avanza(5 * 60 * 1000);
  verifica('senza variazioni, in cinque minuti nessuna rilettura', nessuna(richieste()), J(richieste()));
  daUnAltraScheda({ anno: 2025, parti: ['contratto', 'annui', 'mensili'], origine: 'x' });
  daUnAltraScheda({ anno: 2027, parti: ['mensili'], origine: 'x' });
  await aspetta(5);
  await orologio.avanza(60 * 1000);
  verifica('un cambio del 2025, o dei mensili del 2027, non tocca la dashboard del 2026', nessuna(richieste()), J(richieste()));
  // il contratto del 2027 conta nella voce «Nuovo anno» di «Da gestire»: si rilegge
  // quella, il quadro del 2026 no (revisione del 14/10/2026)
  daUnAltraScheda({ anno: 2027, parti: ['contratto'], origine: 'x' });
  await aspetta(5);
  await orologio.avanza(60 * 1000);
  verifica('un cambio del contratto 2027 rilegge solo «Da gestire», non il quadro del 2026', J(richieste().funzioni) === J({ cruscottoOperativo: 1 }), J(richieste()));

  // LA VARIAZIONE, nell'altra scheda, con la finestra vera
  c.azzera();
  await registraNellAltraScheda();
  const scrittura = richieste();
  verifica('la variazione si scrive nel contratto (11.650 t, Puglia 2.600, ottobre 1.200)', DB.CommessaEcotyre[0].target_annuo_t === 11650
    && JSON.parse(DB.CommessaEcotyre[0].regioni_json).find(r => r.regione === 'Puglia').target_t === 2600 && JSON.parse(DB.CommessaEcotyre[0].target_mensile_json)[9] === 1200, J(DB.CommessaEcotyre[0]));
  verifica('e si annuncia: anno, contratto, chi l\'ha scritta', spediti.some(m => m.anno === ANNO && J(m.parti) === J(['contratto']) && m.origine === 'commessa#B.1'), J(spediti.slice(-2)));
  verifica('la dashboard non rilegge di colpo (aspetta la raffica)', !scrittura.funzioni.getDashboardRaccolta && !scrittura.funzioni.cruscottoOperativo, J(scrittura));
  c.azzera();
  await orologio.avanza(E.ATTESA_RILETTURA_MS);
  const dopo = richieste();
  verifica('poi rilegge il quadro una volta e «Da gestire» una volta, e il margine no', J(dopo.funzioni) === J({ getDashboardRaccolta: 1, cruscottoOperativo: 1 }), J(dopo));
  verifica('il quadro dice 11.650 t', targetDellaDashboard(R) === 11650 && cifraDellaDashboard(R) === '11.650,00 t', J([targetDellaDashboard(R), cifraDellaDashboard(R)]));
  const rete = trova(R.albero, x => nomeDi(x) === 'SezioneRete')[0].props.quadro.rete;
  const pugliaPrima = A.attesoDellaRegione(COMMESSA, ANNO, rete.atteso && rete.atteso.giorno, 'Puglia').atteso_t;
  const puglia = (rete.regioni || []).find(r => r.regione === 'Puglia') || {};
  verifica('la Puglia ha il contratto nuovo e il suo atteso cresce solo della parte di ottobre passata', puglia.target_t === 2600
    && Math.abs(puglia.atteso_t - (pugliaPrima + 100 * A.frazioneDelMese(ANNO, 9, rete.atteso.giorno))) < 0.002, J([puglia, pugliaPrima]));
  verifica('e il quadro dice da dove vengono le 100 t', (rete.variazioni || []).length === 1 && rete.variazioni[0].regione === 'Puglia' && rete.variazioni[0].t === 100, J(rete.variazioni));
  verifica('la voce «I raccoglitori della Puglia hanno 100,00 t più del contratto» sparisce', !vociDellaDashboard(R).includes(`contratto-raccoglitori:${ANNO}`), J(vociDellaDashboard(R)));
  verifica('la pagina dice che cosa ha riletto e quando', /^Il contratto Ecotyre del 2026 è cambiato in Target & Status: quadro ed elenco «Da gestire» riletti alle \d\d:\d\d\.$/.test(rigaRiletta(R)), rigaRiletta(R));
  verifica('niente errori nel frattempo', R.errori.length === 0, String(R.errori[0] || ''));

  // una raffica di celle, subito dopo: aspetta l'intervallo, poi una rilettura del quadro soltanto
  c.azzera();
  for (let i = 0; i < 5; i++) { daUnAltraScheda({ anno: ANNO, parti: ['mensili'], origine: 'raccoglitori#B.2' }); await orologio.avanza(200); }
  await aspetta(5);
  await orologio.avanza(E.ATTESA_RILETTURA_MS);
  verifica('cinque celle scritte subito dopo: nessuna rilettura prima dell\'intervallo', nessuna(richieste()), J(richieste()));
  await orologio.avanza(E.INTERVALLO_RILETTURE_MS);
  verifica('poi una rilettura sola, del quadro: i target mensili non cambiano «Da gestire»', J(richieste().funzioni) === J({ getDashboardRaccolta: 1 }), J(richieste()));

  // la scheda nascosta
  c.azzera();
  documento.visibilityState = 'hidden';
  daUnAltraScheda({ anno: ANNO, parti: ['contratto'], origine: 'commessa#B.3' });
  await aspetta(5);
  await orologio.avanza(10 * 60 * 1000);
  verifica('a scheda nascosta, in dieci minuti, nessuna rilettura', nessuna(richieste()), J(richieste()));
  documento.visibilityState = 'visible';
  documento.dispatchEvent(new Event('visibilitychange'));
  await orologio.avanza(E.ATTESA_AL_RITORNO_MS);
  verifica('al ritorno una rilettura, di quello che serve', J(richieste().funzioni) === J({ getDashboardRaccolta: 1, cruscottoOperativo: 1 }), J(richieste()));

  // una rilettura che cade: restano i numeri di prima, e lo si dice
  c.azzera();
  quadroCade = true;
  daUnAltraScheda({ anno: ANNO, parti: ['annui'], origine: 'raccoglitori#B.4' });
  await aspetta(5);
  await orologio.avanza(E.INTERVALLO_RILETTURE_MS + E.ATTESA_RILETTURA_MS);
  quadroCade = false;
  verifica('una rilettura caduta lascia il quadro di prima a video', targetDellaDashboard(R) === 11650, J(targetDellaDashboard(R)));
  verifica('e lo dice', /quadro non si è riletto \(.*\): quello a video è di prima, ricarica la pagina/.test(rigaRiletta(R)), rigaRiletta(R));
  R.smonta();
  c.azzera();
  daUnAltraScheda({ anno: ANNO, parti: ['contratto'], origine: 'x' });
  await aspetta(5);
  await orologio.avanza(10 * 60 * 1000);
  verifica('chiusa la pagina, nessuno rilegge piu\'', nessuna(richieste()), J(richieste()));
}
{
  // la dashboard del 2025: il contratto del 2026 cambia solo «Da gestire», che e' di oggi
  azzeraArchivio();
  globalThis.__INDIRIZZO = 'anno=2025';
  const R = paginaDashboard.monta(paginaDashboard.Componente, {});
  await aspetta(60);
  await orologio.avanza(E.INTERVALLO_RILETTURE_MS);
  c.azzera();
  daUnAltraScheda({ anno: ANNO, parti: ['contratto'], origine: 'x' });
  await aspetta(5);
  await orologio.avanza(E.ATTESA_RILETTURA_MS);
  verifica('guardando il 2025, un cambio del contratto 2026 rilegge solo «Da gestire»', J(richieste().funzioni) === J({ cruscottoOperativo: 1 }), J(richieste()));
  R.smonta();
  globalThis.__INDIRIZZO = '';
}
{
  // 2c. L'ANNO NUOVO (revisione del 14/10/2026). Il 15/11/2026 «Da gestire» ha la
  // voce «Nuovo anno», che conta il contratto Ecotyre e i target dei raccoglitori
  // del 2027: salvata la commessa 2027 in un'altra scheda, la dashboard aperta
  // diceva ancora che mancava.
  azzeraArchivio();
  oraBase = OraVera.parse('2026-11-15T09:00:00.000Z') - orologio.adesso;
  const R = paginaDashboard.monta(paginaDashboard.Componente, {});
  await aspetta(80);
  const voceAnnoNuovo = () => {
    const el = trova(R.albero, x => nomeDi(x) === 'DaGestire')[0];
    const v = ((el && el.props.visibili) || []).map(x => x.voce).find(x => String(x.chiave) === 'anno-nuovo:2027');
    return v ? `${v.titolo || ''} | ${v.descrizione || v.dettaglio || ''}` : '';
  };
  verifica('il 15/11/2026 la voce «Nuovo anno» dice che manca il contratto Ecotyre del 2027', /Contratto Ecotyre/.test(voceAnnoNuovo()), voceAnnoNuovo());
  await orologio.avanza(E.INTERVALLO_RILETTURE_MS);
  DB.CommessaEcotyre.push({ ...structuredClone(COMMESSA), id: 'c27', anno: 2027, storico_json: '[]' });
  c.azzera();
  daUnAltraScheda({ anno: 2027, parti: ['contratto'], origine: 'commessa#B.9' });
  await aspetta(5);
  await orologio.avanza(E.ATTESA_RILETTURA_MS);
  verifica('salvata la commessa 2027 altrove, la dashboard rilegge «Da gestire» una volta, e il quadro del 2026 no', J(richieste().funzioni) === J({ cruscottoOperativo: 1 }), J(richieste()));
  verifica('e la voce «Nuovo anno» non conta piu\' il contratto fra le cose che mancano', voceAnnoNuovo() !== '' && !/Contratto Ecotyre/.test(voceAnnoNuovo()), voceAnnoNuovo());
  verifica('la pagina dice che cosa ha riletto', /^Il contratto Ecotyre del 2027 è cambiato in Target & Status: elenco «Da gestire» riletto alle \d\d:\d\d\.$/.test(rigaRiletta(R)), rigaRiletta(R));
  R.smonta();
  oraBase = GIORNO_PROVA;
}

console.log('3. L\'ANDAMENTO DI TARGET & STATUS APERTO IN UN\'ALTRA SCHEDA');
const kpiDellAndamento = (T) => (trova(T.albero, x => nomeDi(x) === 'KpiCards')[0] || { props: {} }).props.kpis || {};
const commessaA = (T, nome) => { const el = trova(T.albero, x => nomeDi(x) === nome)[0]; return el && el.props.commessa ? Number(el.props.commessa.target_annuo_t) : undefined; };
{
  azzeraArchivio();
  globalThis.__INDIRIZZO = `tab=andamento&anno=${ANNO}`;
  c.azzera();
  const T = paginaTarget.monta(paginaTarget.Componente, {});
  await aspetta(80);
  verifica('l\'Andamento si apre senza errori', T.errori.length === 0, String(T.errori[0] || ''));
  verifica('prima: card, regioni, Report generale e Canale ACI col contratto di 11.550 t', kpiDellAndamento(T).targetAnnuoTotale === 11550
    && commessaA(T, 'AndamentoRegioni') === 11550 && commessaA(T, 'ReportGenerale') === 11550 && commessaA(T, 'CanaleAci') === 11550,
    J([kpiDellAndamento(T).targetAnnuoTotale, commessaA(T, 'AndamentoRegioni'), commessaA(T, 'ReportGenerale'), commessaA(T, 'CanaleAci')]));
  await orologio.avanza(E.INTERVALLO_RILETTURE_MS);
  c.azzera();
  await registraNellAltraScheda();
  c.azzera(); // le letture della finestra della variazione sono dell'altra scheda
  await orologio.avanza(E.ATTESA_RILETTURA_MS);
  const q = richieste();
  verifica('dopo la variazione rilegge il solo contratto: niente raccolto, niente target dei raccoglitori', J(q.funzioni) === J({}) && J(q.letture) === J({ CommessaEcotyre: 1 }), J(q));
  verifica('card, regioni, Report generale e Canale ACI dicono 11.650 t', kpiDellAndamento(T).targetAnnuoTotale === 11650
    && commessaA(T, 'AndamentoRegioni') === 11650 && commessaA(T, 'ReportGenerale') === 11650 && commessaA(T, 'CanaleAci') === 11650,
    J([kpiDellAndamento(T).targetAnnuoTotale, commessaA(T, 'AndamentoRegioni'), commessaA(T, 'ReportGenerale'), commessaA(T, 'CanaleAci')]));
  verifica('e la card dice la variazione', kpiDellAndamento(T).fonteTarget === 'contratto', J(kpiDellAndamento(T)));
  verifica('la pagina dice che l\'Andamento si e\' riletto', /^Il contratto Ecotyre del 2026 è cambiato in un'altra scheda: Andamento riletto alle \d\d:\d\d\.$/.test(rigaRiletta(T)), rigaRiletta(T));
  c.azzera();
  await orologio.avanza(E.INTERVALLO_RILETTURE_MS);
  daUnAltraScheda({ anno: ANNO, parti: ['mensili'], origine: 'raccoglitori#B.5' });
  await aspetta(5);
  await orologio.avanza(E.ATTESA_RILETTURA_MS);
  verifica('un target mensile cambiato: si rileggono i soli target mensili', J(richieste()) === J({ funzioni: {}, letture: { TargetMensile: 1 } }), J(richieste()));
  T.smonta();

  // sulla scheda Commessa la pagina non rilegge l'Andamento: tornandoci lo rilegge tutto
  globalThis.__INDIRIZZO = `tab=commessa&anno=${ANNO}`;
  const T2 = paginaTarget.monta(paginaTarget.Componente, {});
  await aspetta(40);
  await orologio.avanza(E.INTERVALLO_RILETTURE_MS);
  c.azzera();
  daUnAltraScheda({ anno: ANNO, parti: ['contratto'], origine: 'x' });
  await aspetta(5);
  await orologio.avanza(E.ATTESA_RILETTURA_MS);
  verifica('su un\'altra scheda della pagina l\'Andamento non si rilegge', nessuna(richieste()), J(richieste()));
  T2.smonta();
  globalThis.__INDIRIZZO = '';
}

console.log('4. LA SCHEDA COMMESSA APERTA IN UN\'ALTRA SCHEDA');
const valoreAnnuo = (F) => (trova(F.albero, x => nomeDi(x) === 'Input' && x.props.placeholder === '0')[0] || { props: {} }).props.value;
const tabellaCon = (F, campo) => trova(F.albero, x => nomeDi(x) === 'Tabella' && x.props.nuovaRiga && campo in x.props.nuovaRiga)[0];
const tabellaClassi = (F) => tabellaCon(F, 'classe');
const pugliaAVideo = (F) => { const t = tabellaCon(F, 'province'); const r = t && t.props.righe.find(x => x.regione === 'Puglia'); return r ? r.target : undefined; };
const cambiaPuglia = (F, v) => { const t = tabellaCon(F, 'province'); t.props.onChange(t.props.righe.map(r => (r.regione === 'Puglia' ? { ...r, target: v } : r))); };
// le letture del contratto dell'anno fatte prima di scriverlo (il salvataggio che
// rilegge); quella dopo e' la pagina che si rimette i dati, la get e' della traccia
const rilettureDellAnno = () => {
  const primaScrittura = c.chiamate.findIndex(x => x.tipo === 'scrittura' && x.nome === 'CommessaEcotyre');
  return c.chiamate.slice(0, primaScrittura < 0 ? undefined : primaScrittura)
    .filter(x => x.tipo === 'lettura' && x.nome === 'CommessaEcotyre' && x.metodo === 'filter' && x.filtro && Number(x.filtro.anno) === ANNO).length;
};
// il quadro della Puglia come lo dice la dashboard, dalla funzione vera
const quadroPuglia = async () => {
  const rete = (await chiama(funzioneDashboard, { db: DB, corpo: { anno: [ANNO] } })).j.quadro.rete;
  const p = (rete.regioni || []).find(x => x.regione === 'Puglia') || {};
  return { target: rete.target_t, puglia_t: p.target_t, puglia_atteso: p.atteso_t, variazioni: (rete.variazioni || []).length };
};
{
  azzeraArchivio();
  c.azzera();
  const F = schedaCommessa.monta(schedaCommessa.Componente, { anno: ANNO, isAdmin: true, user: globalThis.__UTENTE, onModificato: () => {} });
  await aspetta(60);
  verifica('la scheda si apre col contratto di 11.550 t', F.errori.length === 0 && valoreAnnuo(F) === '11550', `${String(F.errori[0] || '')} ${valoreAnnuo(F)}`);
  await orologio.avanza(E.INTERVALLO_RILETTURE_MS);
  c.azzera();
  await registraNellAltraScheda();
  c.azzera(); // le letture della finestra della variazione sono dell'altra scheda
  await orologio.avanza(E.ATTESA_RILETTURA_MS);
  const q = richieste();
  verifica('dopo la variazione rilegge il contratto, non il consuntivo', J(q) === J({ funzioni: {}, letture: { CommessaEcotyre: 1 } }), J(q));
  const elenco = trova(F.albero, x => nomeDi(x) === 'ElencoVariazioni')[0];
  verifica('senza modifiche a video: il contratto nuovo e la variazione in elenco', valoreAnnuo(F) === '11650' && elenco && elenco.props.variazioni.length === 1 && elenco.props.variazioni[0].in_vigore,
    J([valoreAnnuo(F), elenco && elenco.props.variazioni]));
  F.smonta();

  // con modifiche a video
  azzeraArchivio();
  const G = schedaCommessa.monta(schedaCommessa.Componente, { anno: ANNO, isAdmin: true, user: globalThis.__UTENTE, onModificato: () => {} });
  await aspetta(60);
  trova(G.albero, x => nomeDi(x) === 'Input' && x.props.placeholder === '0')[0].props.onChange({ target: { value: '11600' } });
  await aspetta(10);
  await orologio.avanza(E.INTERVALLO_RILETTURE_MS);
  await registraNellAltraScheda();
  c.azzera(); // le letture della finestra della variazione sono dell'altra scheda
  await orologio.avanza(E.ATTESA_RILETTURA_MS);
  const scritto = testo(G.albero);
  verifica('con modifiche a video restano le modifiche', valoreAnnuo(G) === '11600', valoreAnnuo(G));
  verifica('e la scheda dice che il contratto e\' cambiato altrove', scritto.includes('Mentre modificavi, il contratto del 2026 è stato salvato in un\'altra scheda'), scritto.slice(0, 400));
  // Le parti che a video non erano state toccate prendono i numeri salvati
  // (revisione del 14/10/2026): la Puglia e ottobre della variazione restano, e
  // la variazione non esce dai numeri. Prima la scheda teneva tutto quello letto
  // all'apertura, e salvare per il solo target annuo l'avrebbe tolta.
  verifica('le parti non toccate sono quelle salvate: la Puglia a 2.600 t', pugliaAVideo(G) === '2600', pugliaAVideo(G));
  verifica('e la scheda lo dice, col target annuo cambiato da tutte e due le parti', scritto.includes('per le regioni, il target mensile rivisto e le quantità per destinazione ora a video c\'è quello salvato, che non avevi toccato')
    && scritto.includes('Avevi cambiato anche tu il target annuo: lì a video restano i tuoi numeri'), scritto.slice(0, 700));
  verifica('e la variazione non esce dai numeri', !/esce dai numeri/.test(scritto), scritto.slice(0, 700));
  G.smonta();

  // con la regione della variazione cambiata anche a video: resta quella a
  // video, e salvando la variazione uscirebbe dai numeri, e lo si dice
  azzeraArchivio();
  const H = schedaCommessa.monta(schedaCommessa.Componente, { anno: ANNO, isAdmin: true, user: globalThis.__UTENTE, onModificato: () => {} });
  await aspetta(60);
  cambiaPuglia(H, '2550');
  await aspetta(10);
  await orologio.avanza(E.INTERVALLO_RILETTURE_MS);
  await registraNellAltraScheda();
  c.azzera();
  await orologio.avanza(E.ATTESA_RILETTURA_MS);
  const scrittoH = testo(H.albero);
  verifica('la Puglia cambiata a video resta, il target annuo prende quello salvato', pugliaAVideo(H) === '2550' && valoreAnnuo(H) === '11650', J([pugliaAVideo(H), valoreAnnuo(H)]));
  verifica('e la scheda dice che salvando la variazione di ottobre uscirebbe dai numeri', /la variazione di ottobre in Puglia \(\+100,00 t\) esce dai numeri del contratto/.test(scrittoH)
    && scrittoH.includes('Avevi cambiato anche tu le regioni'), scrittoH.slice(0, 700));
  H.smonta();
}

console.log('4b. LA SCHEDA COMMESSA APERTA SU UN ALTRO COMPUTER');
// L'annuncio fra le schede non arriva da un altro computer: il salvataggio
// rilegge il contratto subito prima di scrivere (revisione del 14/10/2026).
// Prima scriveva tutti i campi e lo storico letti all'apertura: contratto a
// 11.550 t, variazione sparita, nessun avviso.
{
  // una correzione che non tocca la variazione: si scrive l'unione
  azzeraArchivio();
  const F = schedaCommessa.monta(schedaCommessa.Componente, { anno: ANNO, isAdmin: true, user: globalThis.__UTENTE, onModificato: () => {} });
  await aspetta(60);
  await orologio.avanza(E.INTERVALLO_RILETTURE_MS);
  altroComputer = true;
  await registraNellAltraScheda();
  await orologio.avanza(60 * 1000);
  verifica('dall\'altro computer non arriva niente: a video ancora 11.550 t', valoreAnnuo(F) === '11550', valoreAnnuo(F));
  trova(F.albero, x => nomeDi(x) === 'Input' && String(x.props.placeholder || '').startsWith('Motivo'))[0].props.onChange({ target: { value: 'ripartizione per classe' } });
  tabellaClassi(F).props.onChange([{ classe: 'A', descrizione: 'autovetture', peso: 'fino a 7 kg', percentuale: '60' }]);
  await aspetta(10);
  c.azzera();
  await trova(F.albero, x => nomeDi(x) === 'Button' && testo(x).includes('Salva commessa'))[0].props.onClick();
  await aspetta(30);
  const dopo = DB.CommessaEcotyre[0];
  const storico = JSON.parse(dopo.storico_json);
  verifica('il salvataggio rilegge il contratto dell\'anno prima di scrivere', rilettureDellAnno() === 1, J(c.letture('CommessaEcotyre')));
  verifica('la variazione resta nei numeri: 11.650 t, Puglia 2.600, in vigore', dopo.target_annuo_t === 11650 && JSON.parse(dopo.regioni_json).find(r => r.regione === 'Puglia').target_t === 2600
    && A.variazioniDelContratto(dopo).length === 1 && A.variazioniDelContratto(dopo)[0].in_vigore === true, J([dopo.target_annuo_t, A.variazioniDelContratto(dopo)]));
  verifica('la modifica fatta qui e\' scritta', JSON.parse(dopo.classi_json || '[]').length === 1 && JSON.parse(dopo.classi_json)[0].percentuale === 0.6, dopo.classi_json);
  verifica('lo storico tiene la variazione e scrive il «prima» vero (11.650 t)', storico.some(s => s.variazione) && storico[storico.length - 1].prima.target_annuo_t === 11650 && storico[storico.length - 1].nota === 'ripartizione per classe', J(storico.map(s => [s.nota, s.prima && s.prima.target_annuo_t])));
  verifica('niente avviso sulla pagina: non c\'era niente da decidere', !/Mentre modificavi/.test(testo(F.albero)), testo(F.albero).slice(0, 300));
  F.smonta();

  // la stessa parte cambiata qui e li': non si scrive niente, si dice, si salva premendo di nuovo
  azzeraArchivio();
  const G = schedaCommessa.monta(schedaCommessa.Componente, { anno: ANNO, isAdmin: true, user: globalThis.__UTENTE, onModificato: () => {} });
  await aspetta(60);
  await registraNellAltraScheda();
  await orologio.avanza(60 * 1000);
  cambiaPuglia(G, '2550');
  await aspetta(10);
  const salvataPrima = structuredClone(DB.CommessaEcotyre[0]);
  c.azzera();
  await trova(G.albero, x => nomeDi(x) === 'Button' && testo(x).includes('Salva commessa'))[0].props.onClick();
  await aspetta(30);
  const scritto = testo(G.albero);
  verifica('la Puglia cambiata qui e nella variazione: non si scrive niente', J(DB.CommessaEcotyre[0]) === J(salvataPrima) && !c.chiamate.some(x => x.tipo === 'scrittura'), J(c.chiamate.map(x => `${x.tipo} ${x.nome || ''}`)));
  verifica('e la scheda lo dice, con la variazione che uscirebbe dai numeri', scritto.includes('Mentre modificavi, il contratto del 2026 è stato salvato altrove (in un\'altra scheda o su un altro computer)')
    && scritto.includes('Avevi cambiato anche tu le regioni') && scritto.includes('Non ho salvato niente: controlla e premi di nuovo «Salva commessa 2026»')
    && /la variazione di ottobre in Puglia \(\+100,00 t\) esce dai numeri del contratto/.test(scritto), scritto.slice(0, 900));
  verifica('a video le parti non toccate sono quelle salvate', valoreAnnuo(G) === '11650' && pugliaAVideo(G) === '2550', J([valoreAnnuo(G), pugliaAVideo(G)]));
  await trova(G.albero, x => nomeDi(x) === 'Button' && testo(x).includes('Salva commessa'))[0].props.onClick();
  await aspetta(30);
  const dopoG = DB.CommessaEcotyre[0];
  const storicoG = JSON.parse(dopoG.storico_json);
  verifica('premuto di nuovo si scrive: la Puglia a 2.550, la variazione barrata, il «prima» vero', JSON.parse(dopoG.regioni_json).find(r => r.regione === 'Puglia').target_t === 2550 && dopoG.target_annuo_t === 11650
    && A.variazioniDelContratto(dopoG).length === 1 && A.variazioniDelContratto(dopoG)[0].in_vigore === false && storicoG[storicoG.length - 1].prima.target_annuo_t === 11650,
    J([dopoG.target_annuo_t, A.variazioniDelContratto(dopoG), storicoG.map(s => s.prima && s.prima.target_annuo_t)]));
  G.smonta();

  // il contratto creato altrove mentre qui si scriveva il primo: si aggiorna quello, niente doppione
  azzeraArchivio();
  DB.CommessaEcotyre = [];
  const N = schedaCommessa.monta(schedaCommessa.Componente, { anno: ANNO, isAdmin: true, user: globalThis.__UTENTE, onModificato: () => {} });
  await aspetta(60);
  DB.CommessaEcotyre.push(structuredClone(COMMESSA));
  tabellaClassi(N).props.onChange([{ classe: 'A', descrizione: 'autovetture', peso: 'fino a 7 kg', percentuale: '60' }]);
  await aspetta(10);
  await trova(N.albero, x => nomeDi(x) === 'Button' && testo(x).includes('Salva commessa'))[0].props.onClick();
  await aspetta(30);
  verifica('il contratto creato altrove nel frattempo si aggiorna, non se ne crea un secondo', DB.CommessaEcotyre.length === 1 && DB.CommessaEcotyre[0].target_annuo_t === 11550 && JSON.parse(DB.CommessaEcotyre[0].classi_json || '[]').length === 1,
    J(DB.CommessaEcotyre.map(x => [x.id, x.target_annuo_t, x.classi_json])));
  N.smonta();
  altroComputer = false;
}

console.log('4c. IMPIANTI E STOCCAGGI APERTA PRIMA DELLA VARIAZIONE');
// La scheda scrive sulla commessa fine della programmazione e chili per viaggio,
// e lo storico della commessa con loro (revisione del 14/10/2026): partiva da
// quello letto all'apertura, e una variazione registrata nel frattempo spariva
// dai numeri. Ora rilegge la commessa subito prima di scrivere.
{
  azzeraArchivio();
  DB.ImpiantoTargetSecondaria = [];
  DB.FornitoreSecondaria = [];
  const CI = schedaImpianti.monta(schedaImpianti.Componente, { anno: ANNO, solaLettura: false, user: globalThis.__UTENTE });
  await aspetta(60);
  verifica('Impianti e stoccaggi si apre', CI.errori.length === 0, String(CI.errori[0] || ''));
  await registraNellAltraScheda();
  await orologio.avanza(60 * 1000);
  const quadroPrima = await quadroPuglia();
  const regole = trova(CI.albero, x => nomeDi(x) === 'RegoleAnno')[0];
  verifica('la scheda ha ancora la commessa letta all\'apertura (11.550 t)', regole && regole.props.commessa.target_annuo_t === 11550, J(regole && regole.props.commessa.target_annuo_t));
  const R = schedaImpianti.monta(regole.type, regole.props);
  await aspetta(5);
  trova(R.albero, x => nomeDi(x) === 'Input' && x.props.inputMode === 'numeric')[0].props.onChange({ target: { value: '13000' } });
  await aspetta(5);
  c.azzera();
  await trova(R.albero, x => nomeDi(x) === 'Button' && testo(x).includes('Salva'))[0].props.onClick();
  await aspetta(30);
  const dopo = DB.CommessaEcotyre[0];
  const storico = JSON.parse(dopo.storico_json);
  verifica('il salvataggio rilegge la commessa dell\'anno prima di scrivere', rilettureDellAnno() === 1, J(c.letture('CommessaEcotyre')));
  verifica('i chili per viaggio sono scritti', dopo.kg_per_viaggio === 13000, J(dopo.kg_per_viaggio));
  verifica('la variazione resta nello storico e nei numeri', storico.some(s => s.variazione) && A.variazioniDelContratto(dopo).length === 1 && A.variazioniDelContratto(dopo)[0].in_vigore === true, J(storico.map(s => s.nota)));
  verifica('il «prima» e\' quello vero (11.650 t)', storico[storico.length - 1].prima.target_annuo_t === 11650, J(storico[storico.length - 1].prima));
  const quadroDopo = await quadroPuglia();
  verifica('il quadro della dashboard non cambia per i chili per viaggio', J(quadroDopo) === J(quadroPrima), `${J(quadroPrima)} -> ${J(quadroDopo)}`);
  R.smonta();

  // la copia dell'anno scrive target e contratto: lo annuncia alle pagine aperte
  await orologio.avanza(E.INTERVALLO_RILETTURE_MS);
  const primaDellaCopia = spediti.length;
  await trova(CI.albero, x => nomeDi(x) === 'Button' && testo(x).includes('Copia dal'))[0].props.onClick();
  await aspetta(20);
  await trova(CI.albero, x => nomeDi(x) === 'DialogoAzione')[0].props.onConferma();
  await aspetta(20);
  const annuncio = spediti.slice(primaDellaCopia);
  verifica('la copia dell\'anno annuncia le parti che ha scritto', annuncio.length === 1 && annuncio[0].anno === ANNO && J(annuncio[0].parti) === J(['annui', 'mensili']), J(annuncio));
  copiaCade = true;
  const primaDellaCaduta = spediti.length;
  await trova(CI.albero, x => nomeDi(x) === 'Button' && testo(x).includes('Copia dal'))[0].props.onClick();
  await aspetta(20);
  await trova(CI.albero, x => nomeDi(x) === 'DialogoAzione')[0].props.onConferma();
  await aspetta(20);
  copiaCade = false;
  const annuncioCaduta = spediti.slice(primaDellaCaduta);
  verifica('anche fermata a meta\': annuncia quello che voleva scrivere', annuncioCaduta.length === 1 && J(annuncioCaduta[0].parti) === J(['annui', 'mensili']), J(annuncioCaduta));
  CI.smonta();
  delete DB.ImpiantoTargetSecondaria;
  delete DB.FornitoreSecondaria;
}

console.log('5. LA SCHEDA TARGET RACCOGLITORI');
const scartiDellaScheda = (S) => ((trova(S.albero, x => nomeDi(x) === 'AvvisiScarti')[0] || { props: {} }).props.scarti || []).map(s => `${s.regione}${s.differenza_t > 0 ? '+' : ''}${s.differenza_t}`);
{
  azzeraArchivio();
  c.azzera();
  const S = schedaRaccoglitori.monta(schedaRaccoglitori.Componente, { anno: ANNO, isAdmin: true, user: globalThis.__UTENTE });
  await aspetta(80);
  verifica('aperta prima della variazione: l\'avviso della Puglia, +100 t', S.errori.length === 0 && J(scartiDellaScheda(S)) === J(['Puglia+100']), `${String(S.errori[0] || '')} ${J(scartiDellaScheda(S))}`);
  await orologio.avanza(E.INTERVALLO_RILETTURE_MS);
  c.azzera();
  await registraNellAltraScheda();
  c.azzera(); // le letture della finestra della variazione sono dell'altra scheda
  await orologio.avanza(E.ATTESA_RILETTURA_MS);
  const q = richieste();
  verifica('dopo la variazione rilegge il solo contratto', J(q) === J({ funzioni: {}, letture: { CommessaEcotyre: 1 } }), J(q));
  verifica('e l\'avviso della Puglia sparisce', scartiDellaScheda(S).length === 0, J(scartiDellaScheda(S)));

  // una cella scritta qui si annuncia, e la scheda non rilegge per se stessa
  await orologio.avanza(E.INTERVALLO_RILETTURE_MS);
  const cella = trova(S.albero, x => nomeDi(x) === 'CellaMese' && x.props.mese === 'Ottobre' && x.props.riga && x.props.riga.nome === 'SMOCO SRL')[0];
  const primaDiScrivere = spediti.length;
  c.azzera();
  await cella.props.onSalva(cella.props.riga, 'Ottobre', { target: 280, non_raccoglie: false, nota: 'prova' });
  await aspetta(10);
  const annuncio = spediti.slice(primaDiScrivere);
  verifica('il target mensile scritto si annuncia una volta, con l\'anno e la parte', annuncio.length === 1 && annuncio[0].anno === ANNO && J(annuncio[0].parti) === J(['mensili']), J(annuncio));
  c.azzera();
  await orologio.avanza(E.INTERVALLO_RILETTURE_MS + E.ATTESA_RILETTURA_MS);
  verifica('la scheda che l\'ha scritto non rilegge', nessuna(richieste()), J(richieste()));
  const finestra = trova(S.albero, x => nomeDi(x) === 'VariazioneContratto')[0];
  verifica('la variazione aperta dall\'avviso porta l\'origine della scheda', finestra && annuncio[0] && finestra.props.origine === annuncio[0].origine, J([finestra && finestra.props.origine, annuncio[0] && annuncio[0].origine]));
  S.smonta();
}

console.log('5b. NELLA STESSA SCHEDA: LA PAGINA MOSTRA SUBITO I NUMERI NUOVI');
// La variazione registrata dall'avviso della scheda Target raccoglitori e dalla
// scheda Commessa, nella stessa scheda del browser: chi la registra si rimette
// da se' il contratto scritto, e non rilegge una seconda volta per il suo annuncio.
{
  azzeraArchivio();
  const S = schedaRaccoglitori.monta(schedaRaccoglitori.Componente, { anno: ANNO, isAdmin: true, user: globalThis.__UTENTE });
  await aspetta(80);
  await orologio.avanza(E.INTERVALLO_RILETTURE_MS);
  const dallAvviso = trova(S.albero, x => nomeDi(x) === 'VariazioneContratto')[0];
  verifica('l\'avviso della Puglia c\'e\' e la finestra della variazione e\' montata', J(scartiDellaScheda(S)) === J(['Puglia+100']) && !!dallAvviso, J(scartiDellaScheda(S)));
  await registraNellAltraScheda({ finestra: finestraA, origine: dallAvviso.props.origine, onSalvata: dallAvviso.props.onSalvata });
  verifica('Target raccoglitori: registrata dall\'avviso, l\'avviso sparisce subito', scartiDellaScheda(S).length === 0, J(scartiDellaScheda(S)));
  c.azzera();
  await orologio.avanza(E.INTERVALLO_RILETTURE_MS + E.ATTESA_RILETTURA_MS);
  verifica('e la scheda non rilegge per il suo annuncio', nessuna(richieste()), J(richieste()));
  S.smonta();

  azzeraArchivio();
  const F = schedaCommessa.monta(schedaCommessa.Componente, { anno: ANNO, isAdmin: true, user: globalThis.__UTENTE, onModificato: () => {} });
  await aspetta(60);
  await orologio.avanza(E.INTERVALLO_RILETTURE_MS);
  const dallaScheda = trova(F.albero, x => nomeDi(x) === 'VariazioneContratto')[0];
  await registraNellAltraScheda({ finestra: finestraA, origine: dallaScheda.props.origine, onSalvata: dallaScheda.props.onSalvata });
  await aspetta(20);
  const elenco = trova(F.albero, x => nomeDi(x) === 'ElencoVariazioni')[0];
  verifica('Commessa Ecotyre: registrata dalla scheda, il contratto nuovo e la variazione in elenco subito', valoreAnnuo(F) === '11650' && elenco && elenco.props.variazioni.length === 1, J([valoreAnnuo(F), elenco && elenco.props.variazioni.length]));
  c.azzera();
  await orologio.avanza(E.INTERVALLO_RILETTURE_MS + E.ATTESA_RILETTURA_MS);
  verifica('e la scheda non rilegge per il suo annuncio', nessuna(richieste()), J(richieste()));
  F.smonta();

  // Andamento e Report generale: tornando all'Andamento la pagina rilegge tutto
  // (l'effetto sulla scheda), contratto compreso.
  const pagina = readFileSync(qui('../src/pages/TargetStatus.jsx'), 'utf8').replace(/\r/g, '');
  verifica('Andamento e Report generale: tornandoci, la pagina rilegge tutto, contratto compreso', /useEffect\(\(\) => \{ if \(scheda === 'andamento'\) loadData\(\); \}, \[scheda, loadData\]\);/.test(pagina)
    && /base44\.entities\.CommessaEcotyre\.filter\(\{ anno \}\)/.test(pagina) && /<ReportGenerale anno=\{anno\} mensili=\{targets\} annui=\{annui\} raccolto=\{raccoltoAnno\} commessa=\{commessa\} \/>/.test(pagina));
}

console.log('6. LE FOTOGRAFIE NON PORTANO IL TARGET DEL CONTRATTO');
// Le funzioni che salvano un conto per leggerlo dopo: se una leggesse il target
// del contratto, dopo una variazione terrebbe il numero vecchio fino al suo
// prossimo giro. Oggi nessuna lo legge (inventario del 14/10/2026). Chi ne
// aggiunge uno qui deve decidere se ricalcolarla alla variazione o dire nella
// fotografia di che giorno e': la prova lo segnala.
{
  const FOTOGRAFIE = {
    controllaInvarianti: 'la fotografia della notte (IndicatoreGiorno)',
    checkTargetAlerts: 'gli alert dei target mensili dei raccoglitori',
    runAlertEngine: 'gli alert del motore (delle province del contratto legge solo le province)',
    qualificaFornitori: 'il riepilogo della qualifica (classe dell\'Albo contro i target dei raccoglitori)',
    controlloQualifiche: 'gli avvisi della qualifica',
    elaboraReportSettimanale: 'i report settimanali dei fornitori',
    controllaEvasioneAssegnati: 'l\'evasione degli assegnati (si rifa\' da se\' quando cambia il target del mese)',
    analisiSettimanalePredittiva: 'gli alert della predittivita\' (del contratto legge fine programmazione e chili per viaggio)',
  };
  const CAMPI_DEL_TARGET = /\b(target_annuo_t|target_mensile_json|destinazioni_json|targetAnnuoDellAnno|attesoAllaData|attesoDellaRegione|quotaAttesa|variazioniDelContratto|profiloMensile)\b/;
  // dove le regole si definiscono o si elencano i campi: non sono letture
  const DEFINIZIONI = /(attesoContratto|annoTarget|campiTracciati|storicoModifiche)\.ts$/;
  const senzaCommenti = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  const radice = qui('..');
  // I file che la funzione impacchetta (la sua entry e i moduli condivisi) che leggono il target.
  const leggonoIlTarget = async (nome) => {
    const r = await build({
      entryPoints: [join(radice, `base44/functions/${nome}/entry.ts`)], absWorkingDir: radice,
      bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent', metafile: true,
      plugins: [{ name: 'esterni', setup(b) { b.onResolve({ filter: /^(npm|jsr|node):/ }, (a) => ({ path: a.path, external: true })); } }],
    });
    return Object.keys(r.metafile.inputs)
      .filter(f => /\.ts$/.test(f) && !DEFINIZIONI.test(f))
      .filter(f => CAMPI_DEL_TARGET.test(senzaCommenti(readFileSync(join(radice, f), 'utf8'))))
      .map(f => relative(radice, join(radice, f)).replace(/\\/g, '/'));
  };
  // la controprova della ricerca: la dashboard il target lo legge, e si vede
  const dashboard = await leggonoIlTarget('getDashboardRaccolta');
  verifica('la ricerca trova chi legge il target (getDashboardRaccolta, per quadroCommessa.ts)', dashboard.includes('base44/shared/quadroCommessa.ts'), J(dashboard));
  for (const [nome, che] of Object.entries(FOTOGRAFIE)) {
    const conTarget = await leggonoIlTarget(nome);
    verifica(`${nome} (${che}) non legge il target del contratto`, conTarget.length === 0, J(conTarget));
  }
}

orologio.ripristina();
globalThis.Date = OraVera;
console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
