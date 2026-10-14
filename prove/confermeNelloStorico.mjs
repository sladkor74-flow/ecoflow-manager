// LE CONFERME DI TARGET & STATUS LASCIANO LA RIGA NELLO STORICO (14/10/2026).
//
// Decisioni dell'utente del 13/10/2026, messe in opera nel giro delle migliorie
// del 14/10/2026. Confermare un valore copiato dall'anno prima toglie il segno
// «da confermare» e non cambia nessun campo tracciato: le tariffe confermate con
// «Prepara l'anno» lasciavano gia' la loro riga (preparaAnno), ma gli impianti,
// i target dei raccoglitori e il contratto confermati in Target & Status no, e
// «chi ha confermato il target del 2027, e quando» lo diceva solo lo
// storico_json della riga. Qui si prova che:
//   1. la regola e' una sola (righeDiConferma in campiTracciati, uguale nei due
//      specchi): che cosa dice la riga di ogni archivio, un valore che manca
//      resta mancante, i costi restano riservati, un archivio che non si
//      traccia non lascia righe;
//   2. le righe della conferma delle tariffe di preparaAnno, sul banco, sono
//      gia' quelle della regola, campo per campo;
//   3. il motore scrive le righe di tante conferme con una scrittura sola nel
//      registro, a blocchi di cento, senza leggere niente, e se il registro non
//      si scrive lo dice senza lanciare;
//   4. le pagine vere (prove/dati/paginaFinta.mjs), sui record copiati dalla
//      funzione vera copiaAnnoTarget sul banco: la conferma di un impianto
//      (Impianti e stoccaggi), di tutte le righe o di una riga dei raccoglitori,
//      del contratto (il pulsante nuovo della scheda Commessa Ecotyre), con le
//      richieste contate; e il salvataggio delle regole dell'anno, che non
//      conferma piu' il contratto di nascosto;
//   5. EcoTyna riceve le righe, e la nota non le smentisce.
//
// node prove/confermeNelloStorico.mjs
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { caricaPagina, clienteFinto, aspetta, trova, testo, nomeDi } from './dati/paginaFinta.mjs';
import { caricaFunzione, chiama } from './dati/bancoFunzioni.mjs';
import * as CT from '../base44/shared/campiTracciati.ts';
import * as TR from '../base44/shared/traccia.ts';
import * as SP from '../src/lib/campiTracciati.js';
import { eseguiStrumento } from '../base44/shared/strumentiAssistente.ts';
import { annoCorrenteRoma, daConfermare } from '../base44/shared/annoTarget.ts';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = JSON.stringify;
const ordinata = (o) => J(Object.fromEntries(Object.entries(o || {}).sort(([a], [b]) => a.localeCompare(b))));
const senzaId = (r) => { const { id: _id, ...resto } = r || {}; return resto; };
const conta = (lista, cond) => lista.filter(cond).length;

// L'anno nuovo, come la copia dell'anno lo vuole (non un anno chiuso).
const ANNO = annoCorrenteRoma() + 1;
const PRIMA = ANNO - 1;
const MOTIVO = `confermato il valore copiato dall'anno prima (${PRIMA}), sul contratto ${ANNO}`;
const IL = '2026-11-03T09:00:00.000Z';
// Senza la regola (il codice di prima) le prove falliscono, non si fermano.
const regola = typeof CT.righeDiConferma === 'function' ? CT.righeDiConferma : () => [];

// Un archivio in memoria: conta letture e scritture, e il registro puo' rifiutare.
function archivioFinto(dati = {}, { registroRotto = false } = {}) {
  const db = JSON.parse(J(dati));
  const conti = { get: 0, list: 0, filter: 0, update: 0, create: 0, delete: 0, bulkCreate: 0 };
  let n = 0;
  const tab = (e) => (db[e] = db[e] || []);
  const ent = (e) => ({
    get: async (id) => { conti.get++; const r = tab(e).find(x => x.id === id); if (!r) throw new Error('non trovato ' + id); return { ...r }; },
    update: async (id, p) => { conti.update++; const t = tab(e); const i = t.findIndex(x => x.id === id); t[i] = { ...t[i], ...p }; return { ...t[i] }; },
    create: async (r) => {
      if (e === 'ModificaDato' && registroRotto) throw new Error('Rate limit exceeded');
      conti.create++; const nuovo = { id: `${e}-${++n}`, ...r }; tab(e).push(nuovo); return { ...nuovo };
    },
    bulkCreate: async (rr) => {
      if (e === 'ModificaDato' && registroRotto) throw new Error('Rate limit exceeded');
      conti.bulkCreate++; return rr.map(r => { const nuovo = { id: `${e}-${++n}`, ...r }; tab(e).push(nuovo); return { ...nuovo }; });
    },
    delete: async (id) => { conti.delete++; const t = tab(e); const i = t.findIndex(x => x.id === id); t.splice(i, 1); return {}; },
    filter: async (f) => { conti.filter++; return tab(e).filter(r => Object.entries(f || {}).every(([k, v]) => r[k] === v)).map(r => ({ ...r })); },
    list: async () => { conti.list++; return tab(e).map(r => ({ ...r })); },
  });
  return { archivi: new Proxy({}, { get: (_t, nome) => ent(String(nome)) }), db, conti };
}

console.log('1. LA REGOLA: CHE COSA DICE LA RIGA DELLA CONFERMA');
let righeMeseFermo = [];
{
  verifica('la regola c\'e\', nei due specchi, col motore', typeof CT.righeDiConferma === 'function' && typeof SP.righeDiConferma === 'function' && typeof CT.registraConferme === 'function');
  const opz = { utente: 'Mario Rossi', origine: 'Target & Status, target dei raccoglitori', il: IL };
  const annuo = { id: 'r1', raccoglitore: 'C.L. SERVICE SRL', regione: 'Puglia', impianto: 'IRIGOM S.R.L.', anno: ANNO, target_tonnellate: 300, storico_json: '[]' };
  const r = regola('TargetRaccoglitore', [annuo], opz);
  verifica('il target annuo di un raccoglitore: una riga, il valore uguale prima e dopo, chi, quando, da dove, il motivo e l\'anno',
    r.length === 1 && ordinata(r[0]) === ordinata({
      entita: 'TargetRaccoglitore', record_id: 'r1', etichetta: `C.L. SERVICE SRL · Puglia · verso IRIGOM S.R.L. · ${ANNO}`, campo: 'target_tonnellate',
      prima: '300', dopo: '300', unita: 't', operazione: 'update', utente: 'Mario Rossi', il: IL, origine: opz.origine, motivo: MOTIVO, riservato: false, anno: ANNO,
    }), J(r));
  const mese = regola('TargetMensile', [{ id: 'm1', raccoglitore: 'C.L. SERVICE SRL', regione: 'Puglia', impianto: 'IRIGOM S.R.L.', mese: 'Gennaio', anno: ANNO, target: 25, non_raccoglie: false }], opz);
  verifica('un mese: il target del mese, senza «non raccoglie: no», col mese nell\'etichetta',
    mese.length === 1 && mese[0].campo === 'target' && mese[0].prima === '25' && mese[0].dopo === '25' && mese[0].etichetta === `C.L. SERVICE SRL · Puglia · verso IRIGOM S.R.L. · Gennaio ${ANNO}`, J(mese));
  righeMeseFermo = regola('TargetMensile', [{ id: 'm2', raccoglitore: 'C.L. SERVICE SRL', mese: 'Febbraio', anno: ANNO, non_raccoglie: true }], opz);
  verifica('un mese che non raccoglie: e\' quello il valore confermato', righeMeseFermo.length === 1 && righeMeseFermo[0].campo === 'non_raccoglie' && righeMeseFermo[0].dopo === 'true' && righeMeseFermo[0].unita === 'si_no', J(righeMeseFermo));
  // Sui dati veri dell'11/10/2026 i 22 mesi che non raccolgono hanno il target a
  // zero: una riga sola, che dice che non raccoglie, non due.
  const fermoAZero = regola('TargetMensile', [{ id: 'm5', raccoglitore: 'C.L. SERVICE SRL', mese: 'Agosto', anno: ANNO, target: 0, non_raccoglie: true }], opz);
  verifica('un mese che non raccoglie col target a zero: una riga sola, «non raccoglie»', fermoAZero.length === 1 && fermoAZero[0].campo === 'non_raccoglie' && fermoAZero[0].dopo === 'true', J(fermoAZero));
  const vuoto = regola('TargetMensile', [{ id: 'm3', raccoglitore: 'C.L. SERVICE SRL', mese: 'Marzo', anno: ANNO }], opz);
  verifica('un valore che manca resta mancante: la riga c\'e\', senza prima e dopo (non zero)', vuoto.length === 1 && vuoto[0].campo === 'target' && !('prima' in vuoto[0]) && !('dopo' in vuoto[0]), J(vuoto));
  const zero = regola('TargetMensile', [{ id: 'm4', raccoglitore: 'C.L. SERVICE SRL', mese: 'Aprile', anno: ANNO, target: 0 }], opz);
  verifica('uno zero invece e\' un valore', zero.length === 1 && zero[0].prima === '0' && zero[0].dopo === '0', J(zero));
  const imp = regola('ImpiantoTargetSecondaria', [{ id: 'i1', nome_impianto: 'IRIGOM S.R.L.', anno: ANNO, target: 1050000, stato: 'attivo', segue_predittivita: true }], opz);
  verifica('un impianto: il target di rete, in chili come e\' salvato', imp.length === 1 && imp[0].campo === 'target' && imp[0].dopo === '1050000' && imp[0].unita === 'kg' && imp[0].etichetta === `IRIGOM S.R.L. · ${ANNO}`, J(imp));
  const com = regola('CommessaEcotyre', [{ id: 'c1', anno: ANNO, target_annuo_t: 11550, regioni_json: '[]' }], opz);
  verifica('il contratto: il target annuo', com.length === 1 && com[0].campo === 'target_annuo_t' && com[0].dopo === '11550' && com[0].unita === 't' && com[0].etichetta === `Commessa Ecotyre ${ANNO}`, J(com));
  const siti = regola('GiacenzaSito', [
    { id: 's1', sito: 'TECNOGUM SRL', tipo_destinazione: 'imp', dichiara_rete: false, anno: ANNO },
    { id: 's2', sito: 'NAPPI SUD SRL', tipo_destinazione: 'stoc', anno: ANNO },
  ], opz);
  verifica('un sito di Giacenze: che non dichiara la rete, se non la dichiara; se no il suo ruolo (che e\' anche nell\'etichetta)',
    J(siti.map(x => [x.campo, x.dopo, x.etichetta])) === J([['dichiara_rete', 'false', `TECNOGUM SRL · impianto · ${ANNO}`], ['tipo_destinazione', 'stoc', `NAPPI SUD SRL · stoccaggio · ${ANNO}`]]), J(siti));
  const tar = regola('Tariffa', [
    { id: 't1', direzione: 'PASSIVA', fornitore_nome: 'EMMESSE SRL', prestazione: 'RACCOLTA', tipologia: 'RETE', valore: 72, unita_misura: '€/t', data_inizio_validita: `${ANNO}-01-01` },
    { id: 't2', direzione: 'ATTIVA', cliente: 'ECOTYRE', tipologia: 'RETE', valore: 202, unita_misura: '€/t', data_inizio_validita: `${ANNO}-01-01` },
  ], opz);
  verifica('una tariffa passiva e\' un costo: la sua riga e\' riservata; quella attiva no',
    tar.length === 2 && tar[0].riservato === true && tar[1].riservato === false && tar.every(x => x.campo === 'valore' && x.unita === '€/t' && x.anno === ANNO), J(tar));
  verifica('un archivio che non si traccia (i collegamenti agli impianti) non lascia righe', regola('FornitoreSecondaria', [{ id: 'f1', nome: 'NAPPI SUD SRL', anno: ANNO }], opz).length === 0);
  const motivo = regola('TargetRaccoglitore', [annuo], { ...opz, motivo: 'controllato sul contratto firmato' });
  verifica('chi conferma puo\' dire il suo motivo', motivo.length === 1 && motivo[0].motivo === 'controllato sul contratto firmato', J(motivo));
  const conAnno = regola('TargetRaccoglitore', [{ ...annuo, anno: undefined }], { ...opz, anno: ANNO });
  verifica('l\'anno del contratto si puo\' passare, per un record senza anno', conAnno.length === 1 && conAnno[0].motivo === MOTIVO && !('anno' in conAnno[0]), J(conAnno));
  verifica('le pagine hanno la stessa regola (specchio src/lib/campiTracciati.js)',
    typeof SP.righeDiConferma === 'function' && J(SP.righeDiConferma('TargetMensile', [{ id: 'm2', raccoglitore: 'C.L. SERVICE SRL', mese: 'Febbraio', anno: ANNO, non_raccoglie: true }], opz)) === J(righeMeseFermo));
}

console.log('2. UNA REGOLA SOLA: LE TARIFFE CONFERMATE CON «PREPARA L\'ANNO» SONO GIA\' COSI\'');
{
  // La funzione vera sul banco. Le sue righe (righeConferma in preparaAnno)
  // devono essere quelle della regola: chi la porta su righeDiConferma non
  // cambia niente.
  const pa = await caricaFunzione('preparaAnno');
  const nota = `copiato dal ${PRIMA}, da confermare`;
  const base = { tipologia: 'RETE', unita_misura: '€/t', stato: 'attivo', data_inizio_validita: `${ANNO}-01-01`, data_fine_validita: `${ANNO}-12-31`, note: nota };
  const attiva = { ...base, id: 'tA', direzione: 'ATTIVA', cliente: 'Ecotyre Scrl', valore: 202 };
  const passiva = { ...base, id: 'tP', direzione: 'PASSIVA', prestazione: 'RACCOLTA', fornitore_nome: 'EMMESSE SRL', valore: 72 };
  const senzaPrezzo = { ...base, id: 'tV', direzione: 'PASSIVA', prestazione: 'TRASPORTO', fornitore_nome: 'GATIM S.R.L.', valore: null };
  const db = { Tariffa: [attiva, passiva, senzaPrezzo] };
  const a = await chiama(pa, { db, corpo: { anno: ANNO, azione: 'conferma_tariffe', direzione: 'ATTIVA' } });
  const righeA = (a.db.ModificaDato || []).map(senzaId);
  const p = await chiama(pa, { db, corpo: { anno: ANNO, azione: 'conferma_tariffe', direzione: 'PASSIVA' } });
  const righeP = (p.db.ModificaDato || []).map(senzaId);
  const fatte = [...righeA, ...righeP];
  verifica('preparaAnno conferma e lascia una riga per tariffa', a.stato === 200 && p.stato === 200 && a.j.confermate === 1 && p.j.confermate === 2 && fatte.length === 3, J({ a: a.j.confermate, p: p.j.confermate, n: fatte.length }));
  const perId = { tA: attiva, tP: passiva, tV: senzaPrezzo };
  const diverse = fatte.filter(x => ordinata(x) !== ordinata(regola('Tariffa', [perId[x.record_id]], { utente: x.utente, origine: x.origine, il: x.il, anno: ANNO })[0]));
  verifica('e ognuna e\' la riga della regola, campo per campo (anche quella senza prezzo, senza prima e dopo)', fatte.length === 3 && diverse.length === 0, J(diverse));
}

console.log('3. IL MOTORE: UNA SCRITTURA SOLA NEL REGISTRO, NESSUNA LETTURA');
{
  const registra = typeof CT.registraConferme === 'function' ? CT.registraConferme : async () => ({ scritta: false, righe: 0 });
  const molti = [
    ...Array.from({ length: 75 }, (_, i) => ({ entita: 'TargetRaccoglitore', record: { id: `a${i}`, raccoglitore: `R${i}`, anno: ANNO, target_tonnellate: 10 + i } })),
    ...Array.from({ length: 75 }, (_, i) => ({ entita: 'TargetMensile', record: { id: `m${i}`, raccoglitore: `R${i}`, mese: 'Gennaio', anno: ANNO, target: i } })),
  ];
  const a = archivioFinto({});
  const t = await registra(a.archivi, molti, { utente: 'Mario Rossi', origine: 'prova' });
  verifica('150 conferme di due archivi: 150 righe in due blocchi (100 e 50)', t.scritta === true && t.righe === 150 && (a.db.ModificaDato || []).length === 150 && a.conti.bulkCreate === 2 && a.conti.create === 0, J({ t, conti: a.conti }));
  verifica('senza nessuna lettura', a.conti.get + a.conti.list + a.conti.filter === 0, J(a.conti));
  verifica('tutte con lo stesso istante, chi ha confermato e il motivo', new Set((a.db.ModificaDato || []).map(r => r.il)).size === 1
    && (a.db.ModificaDato || []).every(r => r.utente === 'Mario Rossi' && r.operazione === 'update' && r.motivo === MOTIVO));
  const b = archivioFinto({});
  const una = await registra(b.archivi, [molti[0]], {});
  verifica('una conferma sola: una riga', una.righe === 1 && b.conti.create + b.conti.bulkCreate === 1, J(b.conti));
  const c = archivioFinto({});
  const niente = await registra(c.archivi, [], {});
  const nonTracciato = await registra(c.archivi, [{ entita: 'FornitoreSecondaria', record: { id: 'f1' } }], {});
  verifica('niente da confermare, o un collegamento che non si traccia: nessuna scrittura', niente.scritta === true && niente.righe === 0 && nonTracciato.righe === 0 && c.conti.create + c.conti.bulkCreate === 0, J(c.conti));
  const rotto = archivioFinto({}, { registroRotto: true });
  let lanciato = false;
  let tr = null;
  try { tr = await registra(rotto.archivi, molti.slice(0, 3), {}); } catch { lanciato = true; }
  verifica('se il registro non si scrive non lancia, e lo dice col motivo', !lanciato && tr && tr.scritta === false && tr.righe === 3 && /Rate limit/.test(tr.motivo), J(tr));
  // Lato funzioni: lo stesso motore, con chi scrive dalla richiesta.
  const f = archivioFinto({});
  const lato = typeof TR.registraConferma === 'function'
    ? await TR.registraConferma(f.archivi, [molti[0]], { utente: TR.utenteDellaRichiesta({ full_name: 'Anna Bianchi' }), origine: 'Nuovo anno, tariffe' }) : null;
  verifica('lato funzioni (shared/traccia.ts): registraConferma, lo stesso motore', lato && lato.righe === 1 && f.db.ModificaDato[0].utente === 'Anna Bianchi' && f.db.ModificaDato[0].motivo === MOTIVO, J(f.db.ModificaDato));
}

// === le pagine vere ===

// Il browser finto: una finestra, un documento, il canale fra le schede (che
// qui raccoglie soltanto gli annunci).
globalThis.window = Object.assign(new EventTarget(), {
  self: 1, top: 1, location: { pathname: '/target-status' }, confirm: () => true, alert: () => {},
  matchMedia: () => ({ matches: false, addListener() {}, removeListener() {} }),
});
globalThis.document = Object.assign(new EventTarget(), { visibilityState: 'visible' });
const spediti = [];
globalThis.BroadcastChannel = class extends EventTarget {
  constructor(nome) { super(); this.name = nome; }
  postMessage(dato) { spediti.push(structuredClone(dato)); }
  close() {}
};

// I messaggi a video: le pagine li danno con useToast, qui si raccolgono.
const messaggi = [];
globalThis.__TOAST = messaggi;
const ultimo = () => messaggi[messaggi.length - 1] || {};
const STUB_TOAST = ["import { useToast } from '@/components/ui/use-toast';", 'const __toast = (t) => { globalThis.__TOAST.push(t); }; const useToast = () => ({ toast: __toast });'];
const cartella = mkdtempSync(join(tmpdir(), 'conferme-'));
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

// L'archivio: i record dell'anno nuovo li scrive la copia vera, sul banco.
const ca = await caricaFunzione('copiaAnnoTarget');
const annoPrima = {
  ImpiantoTargetSecondaria: [{ id: 'iI', nome_impianto: 'IRIGOM S.R.L.', anno: PRIMA, target: 1050000, stato: 'attivo' }],
  FornitoreSecondaria: [{ id: 'fN', nome: 'NAPPI SUD SRL', impianto_id: 'iI', impianto_nome: 'IRIGOM S.R.L.', ruolo: 'stoccaggio', tipo: 'stoccaggio', anno: PRIMA, stato: 'attivo', plafond_stoccaggio_kg: 250000 }],
  TargetRaccoglitore: [
    { id: 'r1', raccoglitore: 'C.L. SERVICE SRL', regione: 'Puglia', impianto: 'IRIGOM S.R.L.', anno: PRIMA, target_tonnellate: 300 },
    { id: 'r2', raccoglitore: 'NAPPI SUD SRL', regione: 'Campania', impianto: 'IRIGOM S.R.L.', anno: PRIMA, target_tonnellate: 1200 },
  ],
  TargetMensile: [
    { id: 'm1', raccoglitore: 'C.L. SERVICE SRL', regione: 'Puglia', impianto: 'IRIGOM S.R.L.', mese: 'Gennaio', anno: PRIMA, target: 25 },
    { id: 'm2', raccoglitore: 'C.L. SERVICE SRL', regione: 'Puglia', impianto: 'IRIGOM S.R.L.', mese: 'Febbraio', anno: PRIMA, non_raccoglie: true },
    { id: 'm3', raccoglitore: 'NAPPI SUD SRL', regione: 'Campania', impianto: 'IRIGOM S.R.L.', mese: 'Gennaio', anno: PRIMA, target: 100 },
  ],
  CommessaEcotyre: [{ id: 'c1', anno: PRIMA, target_annuo_t: 11550, regioni_json: J([{ regione: 'Campania', province: 'NA', target_t: 9050 }, { regione: 'Puglia', province: 'BA', target_t: 2500 }]) }],
};
const copiato = await chiama(ca, { db: annoPrima, corpo: { anno: ANNO } });
verifica('la copia dell\'anno, la funzione vera sul banco', copiato.stato === 200 && (copiato.db.ModificaDato || []).length > 0, J(copiato.j));
// Ogni sezione riparte dai record appena copiati, con lo storico vuoto.
const copiaDB = () => { const d = structuredClone(copiato.db); d.ModificaDato = []; return d; };

// Il client delle pagine: le scritture finiscono nell'archivio (le pagine lo
// rileggono), il registro scrive anche a blocchi, e si puo' rompere.
const DB = {};
const rimetti = (d) => { for (const k of Object.keys(DB)) delete DB[k]; Object.assign(DB, d); };
// trattieni: una promessa che ferma gli update finche' non si scioglie, per
// guardare la pagina mentre la conferma e' in volo.
const stato = { registroRotto: false, cadeAllUpdate: 0, update: 0, trattieni: null };
const C = clienteFinto({ funzioni: { computeRaccolto: async () => ({ by_raccoglitore: [], by_raccoglitore_impianto: [], by_regione: [], date_da_sistemare: null }) }, archivi: DB });
{
  const veri = C.cliente.entities;
  let n = 0;
  C.cliente.entities = new Proxy({}, {
    get: (_t, nome) => {
      const e = veri[nome];
      if (typeof nome !== 'string' || !e) return e;
      const tab = () => DB[nome] || (DB[nome] = []);
      return {
        ...e,
        // Come il client vero puo' fare, la risposta ha solo quello che si e'
        // scritto: il valore confermato viene dal record in mano alla pagina.
        update: async (id, r) => {
          await e.update(id, r);
          if (stato.trattieni) await stato.trattieni;
          if (stato.cadeAllUpdate && ++stato.update === stato.cadeAllUpdate) throw new Error('Rate limit exceeded');
          const t = tab();
          const i = t.findIndex(x => x.id === id);
          if (i < 0) throw new Error('non trovato ' + id);
          t[i] = { ...t[i], ...r, updated_date: '2026-11-03T10:00:00.000000' };
          return { id, ...r };
        },
        create: async (r) => {
          await e.create(r);
          if (nome === 'ModificaDato' && stato.registroRotto) throw new Error('Rate limit exceeded');
          const nuovo = { id: `${nome}-${++n}`, ...r };
          tab().push(nuovo);
          return { ...nuovo };
        },
        bulkCreate: async (rr) => {
          C.chiamate.push({ tipo: 'scrittura', nome, metodo: 'bulkCreate', quanti: rr.length });
          if (nome === 'ModificaDato' && stato.registroRotto) throw new Error('Rate limit exceeded');
          return rr.map(r => { const nuovo = { id: `${nome}-${++n}`, ...r }; tab().push(nuovo); return { ...nuovo }; });
        },
      };
    },
  });
  C.cliente.auth = { me: async () => ({ id: 'u1', email: 'admin@prova', full_name: 'Amministratore', role: 'admin' }) };
}
globalThis.__CLIENTE_FINTO = C.cliente;
const UTENTE = { id: 'u1', email: 'admin@prova', full_name: 'Amministratore', role: 'admin' };
const storicoScritto = () => DB.ModificaDato || [];
const descrivi = (lista) => J(lista.map(x => `${x.tipo} ${x.nome || ''} ${x.metodo || ''}`.trim()));

const schedaImpianti = await caricaPagina('components/target-status/ConfigurazioneImpianti', { file: copia('components/target-status/ConfigurazioneImpianti.jsx', [STUB_TOAST]) });
const schedaRaccoglitori = await caricaPagina('components/target-status/TargetRaccoglitoriGrid', { file: copia('components/target-status/TargetRaccoglitoriGrid.jsx', [STUB_TOAST]) });
const schedaCommessa = await caricaPagina('components/target-status/CommessaEcotyreForm', { file: copia('components/target-status/CommessaEcotyreForm.jsx', [STUB_TOAST]) });
// Le righe scritte dalle pagine, per EcoTyna (sezione 5).
const righeDellePagine = [];

console.log('4a. IMPIANTI E STOCCAGGI: LA CONFERMA DI UN IMPIANTO COPIATO');
{
  rimetti(copiaDB());
  messaggi.length = 0;
  const daMontare = C.chiamate.length;
  const CI = schedaImpianti.monta(schedaImpianti.Componente, { anno: ANNO, solaLettura: false, user: UTENTE });
  await aspetta(60);
  const lettureDellaScheda = conta(C.chiamate.slice(daMontare), x => x.tipo === 'lettura');
  verifica('la scheda si apre', CI.errori.length === 0 && lettureDellaScheda > 0, String(CI.errori[0] || ''));
  const impianto = (DB.ImpiantoTargetSecondaria || []).find(x => x.anno === ANNO);
  verifica('l\'impianto copiato e\' da confermare', impianto && daConfermare(impianto), J(impianto));
  const segno = trova(CI.albero, x => nomeDi(x) === 'DaConfermare' && x.props.entita === 'ImpiantoTargetSecondaria')[0];
  const D = segno ? schedaImpianti.monta(segno.type, segno.props) : null;
  const pulsante = D ? trova(D.albero, x => x.type === 'button' && testo(x).includes('Conferma'))[0] : null;
  verifica('il segno «da confermare» ha il suo pulsante', !!pulsante);
  const da = C.chiamate.length;
  if (pulsante) { await pulsante.props.onClick(); await aspetta(40); }
  const fatte = C.chiamate.slice(da);
  const dopo = impianto && (DB.ImpiantoTargetSecondaria || []).find(x => x.id === impianto.id);
  verifica('confermato: la nota della copia non c\'e\' piu\'', dopo && !daConfermare(dopo), J(dopo && dopo.note));
  const reg = storicoScritto();
  verifica('e lo storico ha la riga della conferma: il target di rete uguale prima e dopo, chi, da dove e il motivo',
    reg.length === 1 && ordinata(senzaId(reg[0])) === ordinata({
      entita: 'ImpiantoTargetSecondaria', record_id: impianto.id, etichetta: `IRIGOM S.R.L. · ${ANNO}`, campo: 'target', prima: '1050000', dopo: '1050000', unita: 'kg',
      operazione: 'update', utente: 'Amministratore', il: reg[0].il, origine: 'Target & Status, impianti e stoccaggi', motivo: MOTIVO, riservato: false, anno: ANNO,
    }), J(reg));
  righeDellePagine.push(...reg);
  verifica('due scritture (la nota e il registro) e nessuna lettura in piu\': solo la rilettura della scheda, come prima',
    conta(fatte, x => x.tipo === 'scrittura') === 2 && conta(fatte, x => x.metodo === 'get') === 0 && conta(fatte, x => x.tipo === 'lettura') === lettureDellaScheda, descrivi(fatte));
  verifica('il messaggio: «Confermato»', ultimo().title === 'Confermato', J(messaggi));
  if (D) D.smonta();

  // Il collegamento di uno stoccaggio all'impianto: non si traccia, e la sua
  // conferma resta la sola nota, senza righe e senza avvisi.
  const fornitore = trova(CI.albero, x => nomeDi(x) === 'Fornitore')[0];
  const F = fornitore ? schedaImpianti.monta(fornitore.type, fornitore.props) : null;
  const segnoF = F ? trova(F.albero, x => nomeDi(x) === 'DaConfermare')[0] : null;
  const DF = segnoF ? schedaImpianti.monta(segnoF.type, segnoF.props) : null;
  const pulsanteF = DF ? trova(DF.albero, x => x.type === 'button' && testo(x).includes('Conferma'))[0] : null;
  if (pulsanteF) { await pulsanteF.props.onClick(); await aspetta(40); }
  const collegamento = (DB.FornitoreSecondaria || []).find(x => x.anno === ANNO);
  verifica('il collegamento si conferma senza righe e senza avvisi', !!pulsanteF && collegamento && !daConfermare(collegamento) && storicoScritto().length === 1 && ultimo().title === 'Confermato', J({ note: collegamento && collegamento.note, n: storicoScritto().length, m: ultimo() }));
  if (DF) DF.smonta();
  if (F) F.smonta();
  CI.smonta();

  // Il registro che non si scrive: la conferma resta, e la pagina lo dice.
  rimetti(copiaDB());
  messaggi.length = 0;
  stato.registroRotto = true;
  const CI2 = schedaImpianti.monta(schedaImpianti.Componente, { anno: ANNO, solaLettura: false, user: UTENTE });
  await aspetta(60);
  const segno2 = trova(CI2.albero, x => nomeDi(x) === 'DaConfermare' && x.props.entita === 'ImpiantoTargetSecondaria')[0];
  const D2 = segno2 ? schedaImpianti.monta(segno2.type, segno2.props) : null;
  const pulsante2 = D2 ? trova(D2.albero, x => x.type === 'button' && testo(x).includes('Conferma'))[0] : null;
  if (pulsante2) { await pulsante2.props.onClick(); await aspetta(40); }
  stato.registroRotto = false;
  const imp2 = (DB.ImpiantoTargetSecondaria || []).find(x => x.anno === ANNO);
  verifica('registro non scritto: l\'impianto resta confermato, e il messaggio lo dice col motivo',
    imp2 && !daConfermare(imp2) && ultimo().title === 'Confermato, ma fuori dallo storico' && /non è finita nello storico delle modifiche: Rate limit exceeded/.test(ultimo().description || ''), J(messaggi));
  if (D2) D2.smonta();
  CI2.smonta();

  // Il doppio clic (rilievo della revisione del 14/10/2026). Il registro non si
  // corregge: un secondo clic sullo stesso impianto, mentre la conferma e' in
  // volo o prima che la scheda si rilegga, lasciava una seconda riga di
  // conferma. Il segno e' montato da solo, con le props di quando la scheda si
  // e' aperta: e' la scheda che non si e' ancora riletta, o non ci e' riuscita.
  rimetti(copiaDB());
  messaggi.length = 0;
  const CI3 = schedaImpianti.monta(schedaImpianti.Componente, { anno: ANNO, solaLettura: false, user: UTENTE });
  await aspetta(60);
  const segno3 = trova(CI3.albero, x => nomeDi(x) === 'DaConfermare' && x.props.entita === 'ImpiantoTargetSecondaria')[0];
  const D3 = segno3 ? schedaImpianti.monta(segno3.type, segno3.props) : null;
  const pulsanteDi = (M) => (M ? trova(M.albero, x => x.type === 'button' && testo(x).includes('Conferma'))[0] : null);
  const p3 = pulsanteDi(D3);
  const imp3 = (DB.ImpiantoTargetSecondaria || []).find(x => x.anno === ANNO);
  const righeDi = (id) => storicoScritto().filter(r => r.record_id === id);
  let libera = () => {};
  stato.trattieni = new Promise(r => { libera = r; });
  const da3 = C.chiamate.length;
  // I due clic di un doppio clic: il secondo arriva sullo stesso pulsante,
  // prima che la pagina si ridisegni.
  const clic = p3 ? [p3.props.onClick(), p3.props.onClick()] : [];
  await aspetta(5);
  const inVolo = pulsanteDi(D3);
  verifica('mentre la conferma e\' in volo il pulsante e\' spento', !!inVolo && inVolo.props.disabled === true, J(inVolo && inVolo.props.disabled));
  // Un terzo clic sul pulsante spento (il browser non lo manderebbe): niente.
  if (inVolo) clic.push(inVolo.props.onClick());
  stato.trattieni = null;
  libera();
  await Promise.all(clic);
  await aspetta(40);
  const fatte3 = C.chiamate.slice(da3);
  verifica('doppio clic: una riga sola di conferma per l\'impianto', !!p3 && imp3 && righeDi(imp3.id).length === 1, J(imp3 && righeDi(imp3.id).map(r => [r.campo, r.dopo, r.il])));
  verifica('e una scrittura sola della nota, un solo registro, un solo «Confermato»',
    conta(fatte3, x => x.metodo === 'update') === 1 && conta(fatte3, x => x.tipo === 'scrittura' && x.nome === 'ModificaDato') === 1 && conta(messaggi, m => m.title === 'Confermato') === 1, descrivi(fatte3) + ' ' + J(messaggi));
  // La scheda non si e' riletta (il segno ha ancora il record di prima): il
  // pulsante resta spento, e un altro clic non scrive niente.
  const dopo3 = pulsanteDi(D3);
  verifica('confermato, ma il segno ha ancora il record di prima: il pulsante resta spento', !!dopo3 && dopo3.props.disabled === true, J(dopo3 && dopo3.props.disabled));
  if (dopo3) { await dopo3.props.onClick(); await aspetta(20); }
  verifica('e un altro clic non lascia un\'altra riga', imp3 && righeDi(imp3.id).length === 1, J(imp3 && righeDi(imp3.id).length));
  // Quando la scheda mostra il record confermato il segno sparisce; se lo
  // stesso record torna da confermare (una copia rifatta) il pulsante si
  // riaccende: lo spegnimento non e' per sempre.
  if (D3) {
    D3.props = { ...segno3.props, record: { ...(DB.ImpiantoTargetSecondaria || []).find(x => x.id === imp3.id) } };
    D3.rendi();
    await aspetta(5);
    const sparito = D3.albero === null;
    D3.props = { ...segno3.props, record: { ...imp3 } };
    D3.rendi();
    await aspetta(5);
    const riacceso = pulsanteDi(D3);
    verifica('il record confermato toglie il segno, e una nuova copia da confermare riaccende il pulsante', sparito && !!riacceso && !riacceso.props.disabled, J({ sparito, spento: riacceso && riacceso.props.disabled }));
    D3.smonta();
  }
  CI3.smonta();

  // La conferma che non riesce (la nota non si scrive, e quindi nemmeno la
  // riga): il pulsante si riaccende, e riprovando la riga e' una sola.
  rimetti(copiaDB());
  messaggi.length = 0;
  const CI4 = schedaImpianti.monta(schedaImpianti.Componente, { anno: ANNO, solaLettura: false, user: UTENTE });
  await aspetta(60);
  const segno4 = trova(CI4.albero, x => nomeDi(x) === 'DaConfermare' && x.props.entita === 'ImpiantoTargetSecondaria')[0];
  const D4 = segno4 ? schedaImpianti.monta(segno4.type, segno4.props) : null;
  const imp4 = (DB.ImpiantoTargetSecondaria || []).find(x => x.anno === ANNO);
  stato.update = 0;
  stato.cadeAllUpdate = 1;
  const p4 = pulsanteDi(D4);
  if (p4) { await p4.props.onClick(); await aspetta(20); }
  stato.cadeAllUpdate = 0;
  const riprova = pulsanteDi(D4);
  verifica('la conferma non riuscita: nessuna riga, «Non salvato», e il pulsante si riaccende',
    imp4 && righeDi(imp4.id).length === 0 && ultimo().title === 'Non salvato' && !!riprova && !riprova.props.disabled, J({ righe: imp4 && righeDi(imp4.id).length, m: ultimo(), spento: riprova && riprova.props.disabled }));
  if (riprova) { await riprova.props.onClick(); await aspetta(40); }
  verifica('riprovando, la conferma riesce con una riga sola', imp4 && righeDi(imp4.id).length === 1 && ultimo().title === 'Confermato', J({ righe: imp4 && righeDi(imp4.id).length, m: ultimo() }));
  if (D4) D4.smonta();
  CI4.smonta();
}

console.log('4b. LE REGOLE DELL\'ANNO NON CONFERMANO IL CONTRATTO DI NASCOSTO');
{
  // Fine della programmazione e chili per viaggio stanno sulla commessa, e il
  // loro salvataggio aggiunge una voce allo storico_json: copriva la voce della
  // copia, e il contratto copiato risultava confermato senza che nessuno lo
  // avesse guardato, e senza la riga della conferma.
  const contratto = () => (DB.CommessaEcotyre || []).find(x => Number(x.anno) === ANNO);
  const salvaChili = async (chili) => {
    const CI = schedaImpianti.monta(schedaImpianti.Componente, { anno: ANNO, solaLettura: false, user: UTENTE });
    await aspetta(60);
    const regole = trova(CI.albero, x => nomeDi(x) === 'RegoleAnno')[0];
    const R = regole ? schedaImpianti.monta(regole.type, regole.props) : null;
    if (R) {
      await aspetta(5);
      const campo = trova(R.albero, x => nomeDi(x) === 'Input' && x.props.inputMode === 'numeric')[0];
      if (campo) campo.props.onChange({ target: { value: chili } });
      await aspetta(5);
      const salva = trova(R.albero, x => nomeDi(x) === 'Button' && testo(x).includes('Salva'))[0];
      if (salva) await salva.props.onClick();
      await aspetta(40);
      R.smonta();
    }
    CI.smonta();
  };
  rimetti(copiaDB());
  verifica('il contratto copiato e\' da confermare', contratto() && daConfermare(contratto()), J(contratto()));
  await salvaChili('13000');
  const c = contratto();
  const storico = JSON.parse((c && c.storico_json) || '[]');
  verifica('i chili per viaggio sono scritti, con la loro riga nello storico delle modifiche',
    c && c.kg_per_viaggio === 13000 && storicoScritto().some(x => x.campo === 'kg_per_viaggio' && x.dopo === '13000' && x.motivo === 'fine della programmazione e chili per viaggio'), J({ kg: c && c.kg_per_viaggio, reg: storicoScritto() }));
  verifica('ma il contratto resta da confermare: nessuno l\'ha guardato', c && daConfermare(c), J(storico.map(v => v.nota)));
  verifica('e la voce dello storico della commessa dice anche che cosa si e\' salvato', storico.length === 2 && /fine della programmazione e chili per viaggio$/.test(storico[1].nota || ''), J(storico.map(v => v.nota)));
  // Un contratto gia' confermato: la voce resta quella di sempre.
  rimetti(copiaDB());
  const confermato = contratto();
  confermato.storico_json = J([...JSON.parse(confermato.storico_json), { il: IL, da: 'Amministratore', nota: 'confermato', prima: { target_annuo_t: 11550 } }]);
  await salvaChili('14000');
  const s2 = JSON.parse((contratto() && contratto().storico_json) || '[]');
  verifica('su un contratto confermato la voce dice solo che cosa si e\' salvato', s2.length === 3 && s2[2].nota === 'fine della programmazione e chili per viaggio' && contratto().kg_per_viaggio === 14000, J(s2.map(v => v.nota)));
}

console.log('4c. TARGET RACCOGLITORI: «CONFERMA TUTTE» E LA CONFERMA DI UNA RIGA');
{
  const annui = () => (DB.TargetRaccoglitore || []).filter(x => x.anno === ANNO);
  const mensili = () => (DB.TargetMensile || []).filter(x => x.anno === ANNO);
  const apri = async () => {
    const S = schedaRaccoglitori.monta(schedaRaccoglitori.Componente, { anno: ANNO, isAdmin: true, user: UTENTE });
    await aspetta(60);
    return S;
  };
  const premi = async (S, cond) => {
    const el = trova(S.albero, cond)[0];
    const da = C.chiamate.length;
    if (el) { await el.props.onClick(); await aspetta(40); }
    return { trovato: !!el, fatte: C.chiamate.slice(da) };
  };
  const tutte = (x) => nomeDi(x) === 'Button' && testo(x).includes('Conferma tutte');

  rimetti(copiaDB());
  messaggi.length = 0;
  spediti.length = 0;
  const S = await apri();
  verifica('la scheda si apre, coi target copiati da confermare', S.errori.length === 0 && annui().length === 2 && mensili().length === 3 && [...annui(), ...mensili()].every(daConfermare), String(S.errori[0] || J(annui())));
  const { trovato, fatte } = await premi(S, tutte);
  verifica('«Conferma tutte» c\'e\' e conferma tutto', trovato && [...annui(), ...mensili()].every(x => !daConfermare(x)), J([...annui(), ...mensili()].map(x => x.storico_json)));
  const reg = storicoScritto();
  const attese = [
    ['TargetRaccoglitore', `C.L. SERVICE SRL · Puglia · verso IRIGOM S.R.L. · ${ANNO}`, 'target_tonnellate', '300'],
    ['TargetRaccoglitore', `NAPPI SUD SRL · Campania · verso IRIGOM S.R.L. · ${ANNO}`, 'target_tonnellate', '1200'],
    ['TargetMensile', `C.L. SERVICE SRL · Puglia · verso IRIGOM S.R.L. · Gennaio ${ANNO}`, 'target', '25'],
    ['TargetMensile', `C.L. SERVICE SRL · Puglia · verso IRIGOM S.R.L. · Febbraio ${ANNO}`, 'non_raccoglie', 'true'],
    ['TargetMensile', `NAPPI SUD SRL · Campania · verso IRIGOM S.R.L. · Gennaio ${ANNO}`, 'target', '100'],
  ];
  verifica('una riga per record confermato: i due annui e i tre mesi, anche quello che non raccoglie, col raccoglitore, la regione, l\'impianto e il mese',
    reg.length === 5 && attese.every(([e, etichetta, campo, v]) => reg.some(x => x.entita === e && x.etichetta === etichetta && x.campo === campo && x.prima === v && x.dopo === v)),
    J(reg.map(x => [x.entita, x.etichetta, x.campo, x.dopo])));
  verifica('chi, da dove, il motivo e l\'anno; lo stesso istante per tutte',
    reg.length > 0 && reg.every(x => x.utente === 'Amministratore' && x.origine === 'Target & Status, target dei raccoglitori' && x.motivo === MOTIVO && x.operazione === 'update' && x.anno === ANNO && x.riservato === false)
    && new Set(reg.map(x => x.il)).size === 1, J(reg[0]));
  verifica('il registro con una scrittura sola', conta(fatte, x => x.nome === 'ModificaDato' && x.metodo === 'bulkCreate') === 1 && conta(fatte, x => x.nome === 'ModificaDato' && x.metodo === 'create') === 0, descrivi(fatte));
  verifica('e nessuna lettura: cinque scritture dei record e una del registro', conta(fatte, x => x.tipo === 'lettura') === 0 && conta(fatte, x => x.tipo === 'scrittura') === 6, descrivi(fatte));
  verifica('il messaggio: «2 righe confermate»', ultimo().title === '2 righe confermate', J(messaggi));
  verifica('e le pagine aperte lo sanno (annuncio dei target annui e mensili)', spediti.some(m => m.anno === ANNO && m.parti.includes('annui') && m.parti.includes('mensili')), J(spediti));
  righeDellePagine.push(...reg);
  S.smonta();

  // Una riga sola, dal suo segno: i suoi record, e nient'altro.
  rimetti(copiaDB());
  messaggi.length = 0;
  const S1 = await apri();
  const una = await premi(S1, x => x.type === 'button' && x.props.title === 'Conferma i valori copiati');
  const r1 = storicoScritto();
  const confermati = [...annui(), ...mensili()].filter(x => !daConfermare(x));
  const chi = new Set(confermati.map(x => x.raccoglitore));
  verifica('una riga sola: le righe dei suoi record, quelli di un raccoglitore, e gli altri restano da confermare',
    una.trovato && confermati.length > 0 && chi.size === 1 && r1.length === confermati.length && r1.every(x => confermati.some(c => c.id === x.record_id))
    && [...annui(), ...mensili()].filter(daConfermare).every(x => !chi.has(x.raccoglitore)), J(r1.map(x => x.etichetta)));
  verifica('il messaggio: «Riga confermata»', ultimo().title === 'Riga confermata', J(messaggi));
  S1.smonta();

  // La conferma che si ferma a meta' (il limite di richieste alla terza
  // scrittura): quelle fatte sono confermate davvero, e hanno la loro riga.
  rimetti(copiaDB());
  messaggi.length = 0;
  stato.update = 0;
  stato.cadeAllUpdate = 3;
  const S2 = await apri();
  await premi(S2, tutte);
  stato.cadeAllUpdate = 0;
  const r2 = storicoScritto();
  const fatti2 = [...annui(), ...mensili()].filter(x => !daConfermare(x));
  verifica('fermata a meta\': le due confermate hanno la loro riga, le altre no', fatti2.length === 2 && r2.length === 2 && r2.every(x => fatti2.some(c => c.id === x.record_id)), J({ fatti: fatti2.map(x => x.id), reg: r2.map(x => x.record_id) }));
  verifica('e il messaggio dice che la conferma non e\' riuscita', ultimo().title === 'Conferma non riuscita' && ultimo().variant === 'destructive', J(messaggi));
  S2.smonta();

  // Il registro che non si scrive: le righe sono confermate, e la pagina lo dice.
  rimetti(copiaDB());
  messaggi.length = 0;
  stato.registroRotto = true;
  const S3 = await apri();
  await premi(S3, tutte);
  stato.registroRotto = false;
  verifica('registro non scritto: confermate lo stesso, e il messaggio lo dice col motivo',
    [...annui(), ...mensili()].every(x => !daConfermare(x)) && ultimo().title === '2 righe confermate, ma fuori dallo storico' && /Rate limit exceeded/.test(ultimo().description || ''), J(messaggi));
  S3.smonta();
}

console.log('4d. COMMESSA ECOTYRE: IL CONTRATTO COPIATO SI CONFERMA');
{
  const contratto = () => (DB.CommessaEcotyre || []).find(x => Number(x.anno) === ANNO);
  const apri = async (isAdmin = true) => {
    const F = schedaCommessa.monta(schedaCommessa.Componente, { anno: ANNO, isAdmin, user: isAdmin ? UTENTE : { ...UTENTE, role: 'user' }, onModificato: () => {} });
    await aspetta(60);
    return F;
  };
  const pulsante = (F) => trova(F.albero, x => nomeDi(x) === 'Button' && testo(x).includes('Conferma il contratto'))[0];
  const segno = (F) => trova(F.albero, x => x.type === 'span' && testo(x).includes('non è ancora confermato'))[0];

  rimetti(copiaDB());
  messaggi.length = 0;
  spediti.length = 0;
  verifica('il contratto copiato e\' da confermare', contratto() && daConfermare(contratto()), J(contratto()));
  const F = await apri();
  verifica('la scheda dice che il contratto e\' copiato e da confermare, col pulsante', F.errori.length === 0 && !!segno(F) && !!pulsante(F), String(F.errori[0] || ''));
  // Nel frattempo, in un'altra scheda, si salvano le regole dell'anno: la loro
  // voce va in fondo allo storico, e la conferma non la deve perdere.
  const voceAltrove = { il: '2026-11-03T08:00:00.000Z', da: 'Amministratore', nota: `copiato dal ${PRIMA}, da confermare · fine della programmazione e chili per viaggio`, prima: null };
  const altrove = contratto();
  altrove.storico_json = J([...JSON.parse(altrove.storico_json), voceAltrove]);
  const da = C.chiamate.length;
  if (pulsante(F)) { await pulsante(F).props.onClick(); await aspetta(40); }
  const fatte = C.chiamate.slice(da);
  const c = contratto();
  const storico = JSON.parse((c && c.storico_json) || '[]');
  verifica('confermato: in fondo allo storico della commessa la voce «confermato», con chi', c && !daConfermare(c) && storico.length > 0 && storico[storico.length - 1].nota === 'confermato' && storico[storico.length - 1].da === 'Amministratore', J(storico));
  verifica('la voce scritta altrove nel frattempo resta: si scrive sul contratto riletto', storico.some(v => v.nota === voceAltrove.nota), J(storico.map(v => v.nota)));
  const reg = storicoScritto();
  verifica('e la riga della conferma: il target annuo, uguale prima e dopo, chi, da dove e il motivo',
    reg.length === 1 && ordinata(senzaId(reg[0])) === ordinata({
      entita: 'CommessaEcotyre', record_id: c.id, etichetta: `Commessa Ecotyre ${ANNO}`, campo: 'target_annuo_t', prima: '11550', dopo: '11550', unita: 't',
      operazione: 'update', utente: 'Amministratore', il: reg[0].il, origine: 'Target & Status, commessa Ecotyre', motivo: MOTIVO, riservato: false, anno: ANNO,
    }), J(reg));
  righeDellePagine.push(...reg);
  verifica('una lettura del contratto prima di scrivere e la rilettura della scheda; nessuna get; due scritture (contratto e registro)',
    conta(fatte, x => x.tipo === 'lettura' && x.nome === 'CommessaEcotyre') === 2 && conta(fatte, x => x.metodo === 'get') === 0 && conta(fatte, x => x.tipo === 'scrittura') === 2, descrivi(fatte));
  verifica('le pagine aperte lo sanno (annuncio del contratto)', spediti.some(m => m.anno === ANNO && m.parti.includes('contratto')), J(spediti));
  verifica('il messaggio, e il segno sparisce', ultimo().title === `Contratto ${ANNO} confermato` && !segno(F) && !pulsante(F), J(messaggi));
  F.smonta();

  // Confermato altrove mentre la scheda era aperta: non si scrive niente.
  rimetti(copiaDB());
  messaggi.length = 0;
  const G = await apri();
  const giaFatto = contratto();
  giaFatto.storico_json = J([...JSON.parse(giaFatto.storico_json), { il: IL, da: 'Amministratore', nota: 'confermato', prima: { target_annuo_t: 11550 } }]);
  const daG = C.chiamate.length;
  if (pulsante(G)) { await pulsante(G).props.onClick(); await aspetta(40); }
  const fatteG = C.chiamate.slice(daG);
  verifica('confermato altrove mentre la scheda era aperta: nessuna scrittura e nessuna riga, e lo dice',
    conta(fatteG, x => x.tipo === 'scrittura') === 0 && storicoScritto().length === 0 && ultimo().title === `Il contratto del ${ANNO} è già confermato`, J({ fatte: descrivi(fatteG), m: messaggi }));
  G.smonta();

  // Chi non e' amministratore vede il segno, non il pulsante; un contratto
  // scritto a mano non ha ne' l'uno ne' l'altro.
  rimetti(copiaDB());
  const L = await apri(false);
  verifica('chi non e\' amministratore: il segno si\', il pulsante no', !!segno(L) && !pulsante(L));
  L.smonta();
  rimetti(copiaDB());
  contratto().storico_json = J([{ il: IL, da: 'Amministratore', nota: 'revisione Ecotyre', prima: null }]);
  const M = await apri();
  verifica('un contratto non copiato: niente segno e niente pulsante', !segno(M) && !pulsante(M));
  M.smonta();
}

console.log('5. ECOTYNA: CHI HA CONFERMATO, E QUANDO');
{
  const tutte = [...(copiato.db.ModificaDato || []), ...righeDellePagine].map((r, i) => ({ ...senzaId(r), id: `x${i}` }));
  const finto = { asServiceRole: { entities: archivioFinto({ ModificaDato: tutte }).archivi } };
  const t = await eseguiStrumento(finto, 'storico_modifiche', { cosa: 'target', soggetto: 'C.L. SERVICE', anno: ANNO }, { amministratore: false });
  const righe = (t.dati && t.dati.modifiche && t.dati.modifiche.righe) || [];
  verifica('«chi ha confermato il target di C.L. Service?»: la riga della conferma accanto a quella della copia, in tonnellate',
    righe.some(x => x.motivo === MOTIVO && x.chi === 'Amministratore' && x.campo === 'target annuo' && x.operazione === 'modificato' && x.prima === 300 && x.dopo === 300 && x.unita === 't')
    && righe.some(x => /^copia dal/.test(x.motivo || '')), J(righe));
  verifica('anche il mese che non raccoglie', righe.some(x => x.motivo === MOTIVO && x.campo === 'non raccoglie nel mese' && x.dopo === true), J(righe));
  const imp = await eseguiStrumento(finto, 'storico_modifiche', { cosa: 'target', soggetto: 'Irigom', anno: ANNO }, { amministratore: false });
  verifica('il target dell\'impianto confermato, in tonnellate come nella pagina', imp.dati.modifiche.righe.some(x => x.motivo === MOTIVO && x.campo === 'target di rete' && x.prima === 1050 && x.dopo === 1050 && x.unita === 't'), J(imp.dati.modifiche.righe));
  const c = await eseguiStrumento(finto, 'storico_modifiche', { cosa: 'contratto', anno: ANNO }, { amministratore: false });
  verifica('«chi ha confermato il contratto?»: la riga del target annuo', c.dati.modifiche.righe.some(x => x.archivio === 'commessa Ecotyre' && x.motivo === MOTIVO && x.prima === 11550 && x.dopo === 11550 && x.chi === 'Amministratore'), J(c.dati.modifiche.righe));
  verifica('e la nota dice che le conferme di Target & Status lasciano la riga, senza smentirla',
    !/non lasciano righe qui/.test(c.dati.nota) && /confermati in Target & Status/.test(c.dati.nota) && /Anche la conferma di un valore copiato lascia la sua riga/.test(c.dati.nota), c.dati.nota);
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
