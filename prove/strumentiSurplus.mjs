// EcoTyna E IL SURPLUS SULLE TARIFFE (13/10/2026).
//
// Richiesta dell'utente del 12/10/2026: accanto alle tariffe un surplus in €/t,
// con le sue date, che in attiva e in passiva fa «una riga con l'importo
// standard ed una per il surplus (sempre riferito alle stesse tonnellate
// raccolte o trattate nel mese)». Il primo e' il Fuel Surcharge del consorzio
// Ecotyre, +5 €/t dal 01/10 al 31/12/2026 su rete, ACI ed extra raccolta, ognuno
// con la sua riga e mai sommati: SMOCO lo fattura a Ecotyre e lo paga ai
// raccoglitori, ma non a se stessa.
//
// Gli strumenti di EcoTyna (base44/shared/strumentiAssistente.ts) devono dirlo
// come il modulo:
//   1. tariffe: in coda i surplus, un record per canale, in corso, in arrivo,
//      conclusi e disattivati; accanto a ogni tariffa quello che vale oggi su di
//      lei (la colonna «Surplus» della pagina); se i surplus non si leggono si
//      dice, non si tace;
//   2. fatturazione ATTIVA: il totale comprende il surplus, accanto lo standard e
//      la riga del surplus; la riga del surplus non e' un ordine e non porta
//      chili; un documento elaborato prima del surplus si spiega col surplus, e a
//      periodo chiuso con la fattura integrativa;
//   3. fatturazione PASSIVA: ogni fornitore con lo standard e il surplus, lo
//      stesso numero del modulo (senza il surplus EcoTyna diceva meno di quanto si
//      deve), le tonnellate di SMOCO (interno) che non lo prendono;
//   4. a chi non e' amministratore mai euro_t_passiva ne' la passiva: dei surplus
//      solo quelli che Ecotyre paga, col solo importo da Ecotyre;
//   5. sui dati veri dell'11/10/2026, con le tonnellate di settembre come un mese
//      di Fuel Surcharge: i numeri del progetto (rete 5.601,20 € da Ecotyre e
//      4.332,80 € ai raccoglitori, ACI 94,45 e 69,95), e senza surplus gli stessi
//      numeri del modulo.
//
// node prove/strumentiSurplus.mjs
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const R = new URL('../base44/shared/', import.meta.url).href;
const { STRUMENTI } = await import(R + 'strumentiAssistente.ts');
const { calcolaPassivaMese, indiceMesePassiva } = await import(R + 'passivaCalcolo.ts');
const { calcolaRigheAttiva } = await import(R + 'attivaCalcolo.ts');
const { importoSurplus } = await import(R + 'surplus.ts');
const { oggiRoma } = await import(R + 'giornoItaliano.ts');

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (v) => JSON.stringify(v);
const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
const strumento = (nome) => STRUMENTI.find(s => s.nome === nome);
const ADMIN = { amministratore: true };
const OPERATORE = { amministratore: false };

// Le date sono dell'anno di oggi, cosi' la prova vale anche l'anno prossimo.
const ANNO = Number(oggiRoma().slice(0, 4));
const mm = (n) => String(n).padStart(2, '0');
const it = (g) => g.split('-').reverse().join('/');

// L'SDK finto: uguaglianza e null nei filtri, pagine come la piattaforma, le
// letture contate. Un archivio in ROTTI risponde con un errore.
function sdk(archivi, { invoke = null, rotti = [] } = {}) {
  const letture = [];
  const prendi = (nome, f) => (archivi[nome] || []).filter(r => Object.entries(f || {}).every(([k, v]) => (v === null ? (r[k] === null || r[k] === undefined || r[k] === '') : r[k] === v)));
  const entita = (nome) => ({
    list: async (_s, lim = 5000, skip = 0) => { letture.push(nome); if (rotti.includes(nome)) throw new Error(`${nome} non risponde`); return prendi(nome, null).slice(skip, skip + lim); },
    filter: async (f, _s, lim = 5000, skip = 0) => { letture.push(nome); if (rotti.includes(nome)) throw new Error(`${nome} non risponde`); return prendi(nome, f).slice(skip, skip + lim); },
  });
  return {
    letture,
    asServiceRole: { entities: new Proxy({}, { get: (_t, n) => entita(String(n)) }) },
    functions: { invoke: async (nome, p) => { if (!invoke) throw new Error(`funzione ${nome} non prevista`); return invoke(nome, p); } },
  };
}

// ─── 1. LO STRUMENTO DELLE TARIFFE ───
console.log('1. TARIFFE: I SURPLUS IN CODA E ACCANTO A OGNI TARIFFA');
const annoIntero = { data_inizio_validita: `${ANNO}-01-01`, data_fine_validita: `${ANNO}-12-31` };
const TARIFFE_T = [
  { id: 't-emm', direzione: 'PASSIVA', prestazione: 'RACCOLTA', tipologia: 'RETE', fornitore_nome: 'EMMESSE SRLS', valore: 85, unita_misura: '€/t', stato: 'attivo', ...annoIntero },
  { id: 't-gat', direzione: 'PASSIVA', prestazione: 'RACCOLTA', tipologia: 'RETE', fornitore_nome: 'GATIM S.R.L.', valore: 72, unita_misura: '€/t', stato: 'attivo', ...annoIntero },
  { id: 't-iri', direzione: 'PASSIVA', prestazione: 'TRATTAMENTO', tipologia: 'RETE', fornitore_nome: 'IRIGOM SRL', valore: 80, unita_misura: '€/t', stato: 'attivo', ...annoIntero },
  { id: 't-at-rete', direzione: 'ATTIVA', prestazione: 'RACCOLTA', tipologia: 'RETE', cliente: 'ECOTYRE', valore: 202, unita_misura: '€/t', stato: 'attivo', ...annoIntero },
  { id: 't-at-aci', direzione: 'ATTIVA', prestazione: 'RACCOLTA', tipologia: 'ACI', cliente: 'ECOTYRE', regione: 'Campania', valore: 240, unita_misura: '€/t', stato: 'attivo', ...annoIntero },
];
// Il Fuel Surcharge dell'anno (in corso qualunque giorno si faccia la prova),
// con l'importo ai fornitori diverso da quello da Ecotyre: 4,25 non deve mai
// arrivare a chi non e' amministratore. Un accordo commerciale solo passivo con
// Gatim, che e' tutto un costo. Uno dell'anno dopo, uno dell'anno prima, uno spento.
const fuel = (id, tipologia, extra = {}) => ({
  id, gruppo: 'g-fuel', nome: 'Fuel Surcharge', origine: 'CONSORZIO', riferimento: 'comunicazione Ecotyre di prova', note: 'nota interna',
  tipologia, prestazione: 'RACCOLTA', a_chi: 'tutti', euro_t_passiva: 4.25, euro_t_attiva: 5, stato: 'attivo', ...annoIntero, ...extra,
});
const SURPLUS_T = [
  { id: 's-spento', nome: 'Surplus spento', origine: 'CONSORZIO', tipologia: 'RETE', prestazione: 'RACCOLTA', a_chi: 'tutti', euro_t_passiva: 3, euro_t_attiva: 3, stato: 'non_attivo', ...annoIntero },
  fuel('s-extra', 'EXTRA_RACCOLTA'), fuel('s-aci', 'ACI'), fuel('s-rete', 'RETE'),
  { id: 's-gatim', nome: 'Accordo Gatim', origine: 'ACCORDO_COMMERCIALE', riferimento: 'accordo del 01/01', tipologia: 'RETE', prestazione: 'RACCOLTA', a_chi: 'elenco',
    fornitori_json: J([{ id: 'f-gat', nome: 'GATIM S.R.L.' }]), euro_t_passiva: 2.5, euro_t_attiva: null, stato: 'attivo', ...annoIntero },
  fuel('s-futuro', 'RETE', { gruppo: 'g-futuro', euro_t_attiva: 6, data_inizio_validita: `${ANNO + 1}-01-01`, data_fine_validita: `${ANNO + 1}-03-31` }),
  fuel('s-vecchio', 'RETE', { gruppo: 'g-vecchio', euro_t_attiva: 4, data_inizio_validita: `${ANNO - 1}-10-01`, data_fine_validita: `${ANNO - 1}-12-31` }),
];
const tariffe = strumento('tariffe');
const chiediTariffe = async (p, ctx, opz = {}) => (await tariffe.esegui(sdk({ Tariffa: TARIFFE_T, SurplusTariffa: SURPLUS_T }, opz), p, ctx)).dati;
{
  const d = await chiediTariffe({}, ADMIN);
  const sur = (d.surplus && d.surplus.righe) || [];
  verifica('in coda ci sono i surplus, un record per canale: 7 in tutto', d.surplus && d.surplus.quanti === 7, J(d.surplus && d.surplus.quanti));
  verifica('in ordine: in corso, in arrivo, conclusi, il disattivato in fondo',
    J(sur.map(s => s.stato)) === J(['in corso', 'in corso', 'in corso', 'in corso', 'in arrivo', 'concluso', 'disattivato, non vale mai']), J(sur.map(s => s.stato)));
  verifica('in corso per nome e per canale: Accordo Gatim, poi il Fuel Surcharge su rete, ACI ed extra raccolta, ognuno col suo',
    J(sur.slice(0, 4).map(s => `${s.nome}|${s.canale}`)) === J(['Accordo Gatim|RETE', 'Fuel Surcharge|RETE', 'Fuel Surcharge|ACI', 'Fuel Surcharge|EXTRA_RACCOLTA']), J(sur.slice(0, 4).map(s => `${s.nome}|${s.canale}`)));
  const rete = sur.find(s => s.nome === 'Fuel Surcharge' && s.canale === 'RETE' && s.stato === 'in corso') || {};
  verifica("il Fuel Surcharge della rete: 4,25 €/t ai fornitori e 5 da Ecotyre, a tutti i raccoglitori, del consorzio, con le date all'italiana",
    rete.ai_fornitori_euro_t === 4.25 && rete.da_ecotyre_euro_t === 5 && rete.vale_per === 'tutti i raccoglitori' && rete.origine === 'consorzio Ecotyre'
      && rete.periodo === `dal 01/01/${ANNO} al 31/12/${ANNO}` && rete.prestazione === 'RACCOLTA' && rete.riferimento === 'comunicazione Ecotyre di prova', J(rete));
  const gat = sur.find(s => s.nome === 'Accordo Gatim') || {};
  verifica("l'accordo solo passivo: da Ecotyre vuoto (null, non zero), e lo dice; vale solo per Gatim",
    gat.da_ecotyre_euro_t === null && gat.ai_fornitori_euro_t === 2.5 && gat.solo === 'solo ai fornitori: Ecotyre non lo paga' && gat.vale_per === 'solo: GATIM S.R.L.' && gat.origine === 'accordo commerciale', J(gat));

  const righe = d.tariffe.righe;
  const di = (id) => righe.find(r => r.valore === TARIFFE_T.find(t => t.id === id).valore && r.fornitore === (TARIFFE_T.find(t => t.id === id).fornitore_nome || 'ECOTYRE')) || {};
  verifica('accanto alla raccolta di Emmesse: il Fuel Surcharge in corso, 4,25 €/t, e non l\'accordo di Gatim',
    J(di('t-emm').surplus) === J([{ nome: 'Fuel Surcharge', euro_t: 4.25, quando: 'in corso', periodo: `dal 01/01/${ANNO} al 31/12/${ANNO}` }]), J(di('t-emm')));
  verifica('accanto alla raccolta di Gatim: tutti e due, ognuno col suo importo',
    J((di('t-gat').surplus || []).map(s => `${s.nome} ${s.euro_t}`)) === J(['Accordo Gatim 2.5', 'Fuel Surcharge 4.25']), J(di('t-gat').surplus));
  verifica('il trattamento di Irigom non ha surplus (il Fuel Surcharge e\' sulla raccolta): niente campo, non un elenco vuoto', !('surplus' in di('t-iri')), J(di('t-iri')));
  verifica("accanto all'attiva della rete: 5 €/t, la parte da Ecotyre", J((di('t-at-rete').surplus || []).map(s => s.euro_t)) === J([5]), J(di('t-at-rete')));
  verifica('il valore della tariffa resta quello: il surplus si dice accanto, non si somma', di('t-emm').valore === 85 && di('t-at-rete').valore === 202);
  verifica('la nota dice cosa sono i due importi e che i canali non si sommano', /ai_fornitori_euro_t/.test(d.nota_surplus || '') && /non si sommano/.test(d.nota_surplus || ''), d.nota_surplus);

  const aci = await chiediTariffe({ tipologia: 'ACI' }, ADMIN);
  verifica("chiesto l'ACI: solo il surplus dell'ACI", aci.surplus?.quanti === 1 && aci.surplus.righe[0].canale === 'ACI', J(aci.surplus));
  const emm = await chiediTariffe({ fornitore: 'Emmesse' }, ADMIN);
  verifica("chiesta Emmesse: i Fuel Surcharge (a tutti) si', l'accordo di Gatim no", emm.surplus?.righe.every(s => s.nome !== 'Accordo Gatim') && emm.surplus.righe.some(s => s.nome === 'Fuel Surcharge'), J(emm.surplus?.righe.map(s => s.nome)));
  const gatim = await chiediTariffe({ fornitore: 'Gatim' }, ADMIN);
  verifica("chiesta Gatim: anche il suo accordo", gatim.surplus?.righe.some(s => s.nome === 'Accordo Gatim'), J(gatim.surplus?.righe.map(s => s.nome)));
  const solePassive = await chiediTariffe({ direzione: 'PASSIVA' }, ADMIN);
  verifica('chieste le passive: solo i surplus con un importo ai fornitori', solePassive.surplus?.righe.every(s => s.ai_fornitori_euro_t !== null), J(solePassive.surplus?.righe.map(s => s.nome)));

  const rotto = await chiediTariffe({}, ADMIN, { rotti: ['SurplusTariffa'] });
  verifica('se i surplus non si leggono le tariffe ci sono lo stesso, e il surplus mancante si dichiara (non «nessun surplus»)',
    rotto.tariffe.quanti === TARIFFE_T.length && !('surplus' in rotto) && /Non sono riuscita a leggere i surplus/.test(rotto.avviso_surplus || ''), J(Object.keys(rotto)));
}

// ─── gli archivi di un anno piccolo, per la fatturazione ───
// Rete: gennaio senza surplus; febbraio col Fuel Surcharge, che comincia il 01/02.
// Un trasporto finito alle 22:30Z del 31/01 e' ancora gennaio (23:30 italiane),
// uno finito alle 23:30Z e' gia' febbraio (00:30 del 01/02): il surplus lo prende.
// SMOCO e' interno: Ecotyre paga il surplus anche sulle sue tonnellate, SMOCO non
// lo paga a se stessa.
const g = (m, gg, ora = '10:00:00') => `${ANNO}-${mm(m)}-${mm(gg)}T${ora}Z`;
const mov = (id, kg, finito, campi = {}) => ({
  stato: 'terminato', cer: '160103', classe: 'A', id, id_ordine: 'ET' + id, numero_fir: 'F' + id, peso_effettivo: kg,
  ordine_immesso_il: g(1, 2), trasporto_iniziato_il: g(1, 3), trasporto_finito_il: finito,
  trasportatore: 'GREEN TYRE SRL', destinazione: 'BETA IMPIANTI', provincia: 'PA', tipo_destinazione: 'imp', automezzo: 'AA111AA', ...campi,
});
const FUEL = (id, tipologia) => ({
  id, gruppo: 'g-fuel', nome: 'Fuel Surcharge', origine: 'CONSORZIO', tipologia, prestazione: 'RACCOLTA', a_chi: 'tutti',
  euro_t_passiva: 4.25, euro_t_attiva: 5, stato: 'attivo', data_inizio_validita: `${ANNO}-02-01`, data_fine_validita: `${ANNO}-12-31`,
});
const tutto = { data_inizio_validita: `${ANNO}-01-01`, data_fine_validita: `${ANNO}-12-31`, stato: 'attivo' };
const ARCHIVI = {
  PrimariaRete: [
    mov('1', 5000, g(1, 15)),
    mov('2', 1000, `${ANNO}-01-31T22:30:00Z`),
    mov('3', 10000, g(2, 10), { ordine_immesso_il: g(2, 1), trasporto_iniziato_il: g(2, 9) }),
    mov('4', 4000, g(2, 12), { trasportatore: 'SMOCO S.R.L.', ordine_immesso_il: g(2, 1), trasporto_iniziato_il: g(2, 11) }),
    mov('5', 2000, `${ANNO}-01-31T23:30:00Z`, { trasportatore: 'ALFA SRL', ordine_immesso_il: g(1, 30), trasporto_iniziato_il: g(1, 31, '08:00:00') }),
  ],
  PrimariaAci: [mov('A1', 2000, g(2, 15), { classe: 'C', regione: 'Campania', provincia: 'NA', peso_stimato: 2000, ordine_immesso_il: g(2, 1), trasporto_iniziato_il: g(2, 14) })],
  Secondaria: [], ExtraRaccolta: [],
  Fornitore: [
    { id: 'f-green', ragione_sociale: 'GREEN TYRE SRL', stato: 'attivo' }, { id: 'f-alfa', ragione_sociale: 'ALFA SRL', stato: 'attivo' },
    { id: 'f-beta', ragione_sociale: 'BETA IMPIANTI', stato: 'attivo' }, { id: 'f-smoco', ragione_sociale: 'SMOCO S.R.L.', stato: 'attivo', interno: true },
  ],
  Tariffa: [
    { id: 'p1', direzione: 'PASSIVA', prestazione: 'RACCOLTA', fornitore_nome: 'Green Tyre', tipologia: 'RETE', valore: 85, unita_misura: '€/t', ...tutto },
    { id: 'p2', direzione: 'PASSIVA', prestazione: 'RACCOLTA', fornitore_nome: 'Alfa s.r.l.', tipologia: 'RETE', valore: 70, unita_misura: '€/t', ...tutto },
    { id: 'p3', direzione: 'PASSIVA', prestazione: 'TRATTAMENTO', fornitore_nome: 'Beta Impianti', tipologia: 'RETE', valore: 80, unita_misura: '€/t', ...tutto },
    { id: 'p4', direzione: 'PASSIVA', prestazione: 'RACCOLTA', fornitore_nome: 'Green Tyre', tipologia: 'ACI', valore: 90, unita_misura: '€/t', ...tutto },
    { id: 'p5', direzione: 'PASSIVA', prestazione: 'TRATTAMENTO', fornitore_nome: 'Beta Impianti', tipologia: 'ACI', valore: 80, unita_misura: '€/t', ...tutto },
    { id: 'a1', direzione: 'ATTIVA', tipologia: 'RETE', cliente: 'ECOTYRE', valore: 202, unita_misura: '€/t', ...tutto },
    { id: 'a2', direzione: 'ATTIVA', tipologia: 'ACI', cliente: 'ECOTYRE', regione: 'Campania', valore: 240, unita_misura: '€/t', ...tutto },
  ],
  SurplusTariffa: [FUEL('s-rete', 'RETE'), FUEL('s-aci', 'ACI'), FUEL('s-extra', 'EXTRA_RACCOLTA')],
  // Febbraio della rete fatturato e chiuso PRIMA che il surplus fosse scritto:
  // il documento ha le tre righe dei formulari, senza il Fuel Surcharge.
  DocumentoFatturazione: [{ id: 'd-feb', tipo: 'ATTIVA', anno: ANNO, mese: 'Febbraio', tipologia: 'RETE', stato: 'chiusa', totale: 3232, numero_voci: 3, data_elaborazione: g(3, 5) }],
  VoceFatturazione: [],
};
ARCHIVI.VoceFatturazione = calcolaRigheAttiva({ reteAll: ARCHIVI.PrimariaRete, aciAll: [], extraAll: [], fornitori: ARCHIVI.Fornitore, tariffe: ARCHIVI.Tariffa, anno: ANNO, mese: 'Febbraio' })
  .righe.RETE.map((r, i) => ({ ...r, id: `v${i}`, documento_id: 'd-feb' }));
const archiviModulo = (surplusAll) => ({
  primarieRete: ARCHIVI.PrimariaRete, primarieAci: ARCHIVI.PrimariaAci, secondarieAll: [], extraRaccoltaAll: [],
  tariffeAll: ARCHIVI.Tariffa.filter(t => t.direzione === 'PASSIVA'), fornitoriAll: ARCHIVI.Fornitore, surplusAll,
});
// La funzione calcolaPassiva del modulo, che legge anche i surplus.
const invokeModulo = async (_nome, p) => ({ data: calcolaPassivaMese(archiviModulo(ARCHIVI.SurplusTariffa), p.anno, indiceMesePassiva(p.mese), p.mese, p.tipologia) });
const fatt = strumento('fatturazione');
const chiedi = async (p, ctx = ADMIN, archivi = ARCHIVI) => { const b = sdk(archivi, { invoke: invokeModulo }); const d = (await fatt.esegui(b, p, ctx)).dati; return { d, letture: b.letture }; };

// ─── 2. L'ATTIVA ───
console.log("2. ATTIVA: IL TOTALE COMPRENDE IL SURPLUS, ACCANTO LO STANDARD E LA SUA RIGA");
{
  const { d, letture } = await chiedi({ anno: ANNO, tipo: 'ATTIVA', mesi: ['Gennaio', 'Febbraio'] }, OPERATORE);
  verifica("l'attiva legge i surplus", letture.includes('SurplusTariffa'), J([...new Set(letture)]));
  const rete = d.canali.find(c => c.canale === 'RETE');
  const gen = rete.mesi.find(m => m.mese === 'Gennaio');
  const feb = rete.mesi.find(m => m.mese === 'Febbraio');
  // 16 t a 202 = 3.232,00; il surplus su tutte e 16 (anche le 4 di SMOCO): 80,00.
  verifica('febbraio della rete: 3.232,00 standard + 80,00 di Fuel Surcharge = 3.312,00', feb && feb.euro === 3312 && feb.euro_standard === 3232 && feb.euro_surplus === 80, J(feb));
  verifica('le tonnellate restano 16 e gli ordini 3: la riga del surplus non porta chili e non e\' un ordine', feb && feb.tonnellate === 16 && feb.ordini === 3, J(feb && { t: feb.tonnellate, o: feb.ordini }));
  const riga = feb && feb.surplus && feb.surplus[0];
  verifica('la riga del surplus: Fuel Surcharge del consorzio, 16 t a 5 €/t, 80 €, su 3 ordini, col suo periodo',
    feb && feb.surplus?.length === 1 && riga.nome === 'Fuel Surcharge' && riga.origine === 'consorzio Ecotyre' && riga.tonnellate === 16 && riga.euro_t === 5 && riga.euro === 80 && riga.ordini === 3
      && riga.periodo === `dal 01/02/${ANNO} al 31/12/${ANNO}` && !('tonnellate_interni_non_pagate' in riga), J(riga));
  verifica('e la frase, gia\' all\'italiana', feb && feb.nota_surplus === 'Il totale di 3.312,00 € comprende la riga «Fuel Surcharge» (consorzio Ecotyre) di 80,00 € (16,00 t a 5,00 €/t): in fattura e\' una riga a parte, accanto a quella standard di 3.232,00 €, sulle stesse tonnellate del mese, che non si contano due volte.', feb && feb.nota_surplus);
  verifica('gennaio, prima del surplus: 6 t a 202 = 1.212,00, e nessun campo del surplus (non uno zero)',
    gen && gen.euro === 1212 && gen.ordini === 2 && !('euro_surplus' in gen) && !('surplus' in gen) && !('euro_standard' in gen), J(gen));
  verifica("l'anno: 4.524,00 di cui 80,00 di surplus, 22 t, 5 ordini",
    rete.euro === 4524 && rete.euro_standard === 4444 && rete.euro_surplus === 80 && rete.tonnellate === 22 && rete.ordini === 5 && rete.surplus?.length === 1 && /stesse tonnellate dei mesi/.test(rete.nota_surplus || ''), J({ ...rete, mesi: undefined }));
  const aci = d.canali.find(c => c.canale === 'ACI');
  verifica("l'ACI col suo: 2 t a 240 = 480 + 10 di surplus, mai sommato alla rete", aci.euro === 490 && aci.euro_surplus === 10 && aci.surplus?.[0].tonnellate === 2, J({ ...aci, mesi: undefined }));
  verifica('nessun totale che somma i canali', !('euro' in d) && !('euro_surplus' in d) && !('surplus' in d));
  verifica('la nota dice che il surplus e\' gia\' negli euro e che le tonnellate non si sommano', /gia' negli euro/.test(d.nota) && /non si sommano una seconda volta/.test(d.nota), d.nota.slice(-400));
  // Il documento di febbraio e' stato chiuso prima del surplus: la differenza e' il surplus.
  verifica('il documento chiuso prima del surplus: la differenza (80 €) e\' il surplus, e si fattura a parte senza riaprire',
    feb.documento.differenza_euro === 80 && feb.documento.differenza_del_surplus_euro === 80 && /tutta il surplus/.test(feb.documento.avviso_surplus || '') && /fattura integrativa del solo surplus/.test(feb.documento.avviso_surplus || '')
      // e non dice anche «va riaperto», che e' il contrario
      && !('avviso' in feb.documento), J(feb.documento));
}
{
  const { d } = await chiedi({ anno: ANNO, tipo: 'ATTIVA', mese: 'Febbraio', tipologia: 'RETE' }, OPERATORE);
  const feb = d.canali[0].mesi[0];
  verifica('col mese, riga per riga: la riga arrivata dopo e\' il surplus, 80 €', feb.documento.differenza_del_surplus_euro === 80 && feb.documento.arrivati_dopo?.quanti === 1 && /integrativa/.test(feb.documento.avviso_surplus || ''), J(feb.documento));
}

// ─── 3. LA PASSIVA ───
console.log('3. PASSIVA: STANDARD E SURPLUS PER FORNITORE, LO STESSO NUMERO DEL MODULO');
{
  const { d, letture } = await chiedi({ anno: ANNO, tipo: 'PASSIVA', tipologia: 'RETE', mesi: ['Gennaio', 'Febbraio'] });
  verifica('la passiva legge i surplus', letture.includes('SurplusTariffa'), J([...new Set(letture)]));
  const rete = d.canali[0];
  // Gennaio: Green 6 t a 85 + Beta 6 t a 80 = 990. Febbraio: Green 10 a 85 + 42,50; Alfa 2 a 70 + 8,50;
  // SMOCO 4 t interno; Beta 16 t a 80 = 1.280 (il Fuel Surcharge e' sulla raccolta).
  const delModulo = ['Gennaio', 'Febbraio'].reduce((s, m) => s + calcolaPassivaMese(archiviModulo(ARCHIVI.SurplusTariffa), ANNO, indiceMesePassiva(m), m, 'RETE').totali.totale_complessivo, 0);
  verifica('il totale della rete: 990 + 2.321 = 3.311,00, lo stesso del modulo col surplus', rete.euro === 3311 && Math.abs(rete.euro - delModulo) < 0.005, `${rete.euro} / ${delModulo}`);
  verifica('di cui 51,00 di Fuel Surcharge (12 t a 4,25 €/t), e le 4 t di SMOCO che non lo prendono',
    rete.euro_standard === 3260 && rete.euro_surplus === 51 && rete.surplus?.length === 1 && rete.surplus[0].tonnellate === 12 && rete.surplus[0].euro === 51 && rete.surplus[0].euro_t === 4.25 && rete.surplus[0].tonnellate_interni_non_pagate === 4, J(rete.surplus));
  verifica('la frase della passiva: ogni fornitore fattura la riga del surplus',
    rete.nota_surplus === 'Il totale di 3.311,00 € comprende la riga «Fuel Surcharge» (consorzio Ecotyre) di 51,00 € (12,00 t a 4,25 €/t): ogni fornitore la fattura come riga a parte, accanto a quella standard (in tutto 3.260,00 €), sulle stesse tonnellate dei mesi, che non si contano due volte.', rete.nota_surplus);
  const green = rete.fornitori.righe.find(f => f.fornitore === 'GREEN TYRE SRL');
  verifica('Green Tyre: 1.402,50 di cui 42,50 di surplus sulle 10 t di febbraio; le sue tonnellate restano 16',
    green && green.euro === 1402.5 && green.euro_standard === 1360 && green.euro_surplus === 42.5 && green.tonnellate === 16 && green.surplus[0].tonnellate === 10, J(green));
  const smoco = rete.fornitori.righe.find(f => f.fornitore === 'SMOCO S.R.L.');
  verifica('SMOCO, interno: niente surplus', smoco && smoco.interno && !('surplus' in smoco) && smoco.euro === 0, J(smoco));
  const beta = rete.fornitori.righe.find(f => f.fornitore === 'BETA IMPIANTI');
  verifica('Beta, impianto: il Fuel Surcharge di raccolta non lo tocca', beta && !('surplus' in beta) && beta.euro === 1760, J(beta));
  const feb = rete.mesi.find(m => m.mese === 'Febbraio');
  const gen = rete.mesi.find(m => m.mese === 'Gennaio');
  verifica('febbraio: 2.321 di cui 51 di surplus; gennaio senza campi del surplus', feb.euro === 2321 && feb.euro_surplus === 51 && feb.euro_standard === 2270 && gen.euro === 990 && !('euro_surplus' in gen), J({ feb, gen }));
  verifica('le tonnellate raccolte restano 22: il surplus non le conta una seconda volta', rete.tonnellate_raccolte === 22, String(rete.tonnellate_raccolte));
  verifica('la nota del surplus nella passiva dice di SMOCO', /interno \(SMOCO\) non lo riceve/.test(d.nota_surplus || ''), d.nota_surplus);

  const solo = await chiedi({ anno: ANNO, tipo: 'PASSIVA', tipologia: 'RETE', mesi: ['Gennaio', 'Febbraio'], fornitore: 'Green Tyre' });
  verifica('un fornitore solo: i suoi 1.402,50, di cui 42,50 di surplus', solo.d.canali[0].euro === 1402.5 && solo.d.canali[0].euro_surplus === 42.5, J({ ...solo.d.canali[0], fornitori: undefined, mesi: undefined }));
  const aci = await chiedi({ anno: ANNO, tipo: 'PASSIVA', tipologia: 'ACI', mesi: ['Gennaio', 'Febbraio'] });
  verifica("l'ACI col suo surplus: 2 t a 4,25 = 8,50, separato dalla rete", aci.d.canali[0].euro_surplus === 8.5 && aci.d.canali[0].euro === 180 + 8.5 + 160, J({ ...aci.d.canali[0], fornitori: undefined, mesi: undefined }));
}
{
  // Col mese la passiva viene dalla funzione del modulo (calcolaPassiva): qui la
  // si legge con le due righe.
  const { d } = await chiedi({ anno: ANNO, tipo: 'PASSIVA', tipologia: 'RETE', mese: 'Febbraio' });
  const green = d.fornitori.righe.find(f => f.fornitore === 'GREEN TYRE SRL');
  verifica('col mese: Green Tyre 892,50 = 850 standard + 42,50 di surplus', green && green.euro === 892.5 && green.euro_standard === 850 && green.euro_surplus === 42.5 && green.surplus[0].euro_t === 4.25, J(green));
  const sdm = (d.surplus_del_mese || [])[0] || {};
  verifica('e il surplus del mese: 12 t pagate, 51 €, le 4 t di SMOCO non pagate',
    sdm.nome === 'Fuel Surcharge' && sdm.tonnellate_pagate === 12 && sdm.euro === 51 && sdm.tonnellate_interni_non_pagate === 4 && sdm.origine === 'consorzio Ecotyre', J(sdm));
  const solo = await chiedi({ anno: ANNO, tipo: 'PASSIVA', tipologia: 'RETE', mese: 'Febbraio', fornitore: 'Green Tyre' });
  verifica('col mese e il fornitore: 892,50 di cui 42,50 di surplus', solo.d.totale_del_fornitore_euro === 892.5 && solo.d.di_cui_surplus_euro === 42.5, J({ t: solo.d.totale_del_fornitore_euro, s: solo.d.di_cui_surplus_euro }));
}

// ─── 4. A CHI NON E' AMMINISTRATORE ───
console.log("4. A CHI NON E' AMMINISTRATORE: MAI euro_t_passiva NE' LA PASSIVA");
{
  const VIETATI = ['euro_t_passiva', 'ai_fornitori', '4.25', '4,25', 'Accordo Gatim', 'GATIM', 'solo ai fornitori', 'SMOCO non lo paga', 'nota interna', 'EMMESSE'];
  const pulito = (nome, dati) => { const s = J(dati); const trovati = VIETATI.filter(v => s.includes(v)); verifica(`${nome}: niente costi dei fornitori`, !trovati.length, trovati.join(', ')); };
  const t = await chiediTariffe({}, OPERATORE);
  pulito('tariffe', t);
  verifica('dei surplus vede quelli che Ecotyre paga, col solo importo da Ecotyre', t.surplus?.quanti === 6 && t.surplus.righe.every(s => s.da_ecotyre_euro_t > 0 && !('ai_fornitori_euro_t' in s) && !('riferimento' in s) && !('note' in s) && !('solo' in s)), J(t.surplus?.righe));
  verifica("accanto all'attiva della rete il surplus da Ecotyre, 5 €/t", J((t.tariffe.righe.find(r => r.valore === 202) || {}).surplus) === J([{ nome: 'Fuel Surcharge', euro_t: 5, quando: 'in corso', periodo: `dal 01/01/${ANNO} al 31/12/${ANNO}` }]), J(t.tariffe.righe));
  pulito('tariffe con le sole passive', await chiediTariffe({ direzione: 'PASSIVA' }, OPERATORE));
  pulito('tariffe di Gatim', await chiediTariffe({ fornitore: 'Gatim' }, OPERATORE));
  const ARCH_COSTI = { ...ARCHIVI, SurplusTariffa: [...ARCHIVI.SurplusTariffa, { ...SURPLUS_T.find(s => s.id === 's-gatim'), ...{ data_inizio_validita: `${ANNO}-01-01` } }] };
  for (const p of [{ tipo: 'PASSIVA', mesi: ['Gennaio', 'Febbraio'] }, { tipo: 'PASSIVA', mese: 'Febbraio' }, { tipo: 'PASSIVA', tipologia: 'RETE', fornitore: 'Green Tyre' }]) {
    const { d } = await chiedi({ anno: ANNO, ...p }, OPERATORE, ARCH_COSTI);
    verifica(`fatturazione ${J(p)}: riservata`, d.riservato === true && !('canali' in d) && !('fornitori' in d), J(d).slice(0, 200));
    pulito(`fatturazione ${J(p)}`, d);
  }
  const att = await chiedi({ anno: ANNO, tipo: 'ATTIVA', mese: 'Febbraio' }, OPERATORE, ARCH_COSTI);
  pulito("l'attiva", att.d);
  // Lo storico delle modifiche: l'importo ai fornitori e' una riga riservata
  // (campiTracciati.ts); qui si guarda che lo strumento la tenga fuori.
  const MODIFICHE = [
    { id: 'm1', entita: 'SurplusTariffa', campo: 'euro_t_passiva', unita: '€/t', prima: '5', dopo: '4.25', riservato: true, etichetta: `Fuel Surcharge · RETE · RACCOLTA · dal 01/02/${ANNO}`, anno: ANNO, il: g(2, 1), utente: 'Mario', operazione: 'update' },
    { id: 'm2', entita: 'SurplusTariffa', campo: 'euro_t_attiva', unita: '€/t', prima: '4', dopo: '5', riservato: false, etichetta: `Fuel Surcharge · RETE · RACCOLTA · dal 01/02/${ANNO}`, anno: ANNO, il: g(2, 1), utente: 'Mario', operazione: 'update' },
  ];
  const storico = (await strumento('storico_modifiche').esegui(sdk({ ModificaDato: MODIFICHE }), {}, OPERATORE)).dati;
  verifica('storico: la modifica da Ecotyre si vede, quella ai fornitori no', storico.modifiche.quanti === 1 && storico.riservate_non_dette === 1, J(storico.modifiche));
  pulito('storico delle modifiche', storico.modifiche);
}

// ─── 5. SUI DATI VERI ───
console.log('5. SUI DATI VERI: SETTEMBRE 2026 COME UN MESE DI FUEL SURCHARGE');
{
  const CARTELLA = process.env.DATI_VERI || qui('../../dati-veri/');
  const copie = existsSync(CARTELLA) ? readdirSync(CARTELLA).filter(n => /^treadrider-dati-veri-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n)).sort() : [];
  if (!copie.length) {
    console.log(`  nessuna copia dei dati veri in ${CARTELLA}: parte saltata`);
  } else {
    const DATI = JSON.parse(gunzipSync(readFileSync(CARTELLA + copie[copie.length - 1])).toString('utf8')).archivi;
    // Il Fuel Surcharge del consorzio spostato su settembre: le tonnellate di
    // settembre fanno da esempio di un mese di ottobre (il progetto, § 7).
    const simulato = ['RETE', 'ACI', 'EXTRA_RACCOLTA'].map(c => ({
      id: `fuel-${c}`, gruppo: 'fuel', nome: 'Fuel Surcharge', origine: 'CONSORZIO', tipologia: c, prestazione: 'RACCOLTA', a_chi: 'tutti',
      euro_t_passiva: 5, euro_t_attiva: 5, stato: 'attivo', data_inizio_validita: '2026-09-01', data_fine_validita: '2026-12-31',
    }));
    const conta = async (tipo, tipologia, surplus) => (await fatt.esegui(sdk({ ...DATI, SurplusTariffa: surplus }), { anno: 2026, tipo, tipologia, mesi: ['Agosto', 'Settembre'] }, ADMIN)).dati.canali[0];
    const settembre = (c) => c.mesi.find(m => m.mese === 'Settembre');
    const attRete = await conta('ATTIVA', 'RETE', simulato);
    const attAci = await conta('ATTIVA', 'ACI', simulato);
    const pasRete = await conta('PASSIVA', 'RETE', simulato);
    const pasAci = await conta('PASSIVA', 'ACI', simulato);
    const senzaRete = await conta('ATTIVA', 'RETE', []);
    const senzaPas = await conta('PASSIVA', 'RETE', []);
    // Lo stesso conto del modulo, senza surplus: EcoTyna non deve cambiare niente.
    const moduloAtt = calcolaRigheAttiva({ reteAll: DATI.PrimariaRete, aciAll: DATI.PrimariaAci, extraAll: DATI.ExtraRaccolta, fornitori: DATI.Fornitore, tariffe: DATI.Tariffa.filter(t => t.direzione === 'ATTIVA'), anno: 2026, mese: 'Settembre' })
      .righe.RETE.reduce((s, r) => s + (Number(r.totale) || 0), 0);
    const moduloPas = calcolaPassivaMese({ primarieRete: DATI.PrimariaRete, primarieAci: DATI.PrimariaAci, secondarieAll: DATI.Secondaria, extraRaccoltaAll: DATI.ExtraRaccolta, tariffeAll: DATI.Tariffa.filter(t => t.direzione === 'PASSIVA'), fornitoriAll: DATI.Fornitore.filter(f => f.stato === 'attivo') }, 2026, indiceMesePassiva('Settembre'), 'Settembre', 'RETE').totali.totale_complessivo;
    verifica('senza surplus: l\'attiva di settembre della rete e\' quella del modulo, e nessun campo del surplus', Math.abs(settembre(senzaRete).euro - Math.round(moduloAtt * 100) / 100) < 0.005 && !('euro_surplus' in settembre(senzaRete)) && !('surplus' in senzaRete), `${settembre(senzaRete).euro} / ${moduloAtt}`);
    verifica('senza surplus: la passiva di settembre della rete e\' quella del modulo', Math.abs(settembre(senzaPas).euro - moduloPas) < 0.005 && !('euro_surplus' in settembre(senzaPas)), `${settembre(senzaPas).euro} / ${moduloPas}`);
    const sAtt = settembre(attRete);
    verifica('attiva della rete: 5.601,20 € di Fuel Surcharge (1.120,24 t a 5 €/t, arrotondato una volta sul mese), su 380 ordini',
      sAtt.euro_surplus === 5601.2 && sAtt.surplus[0].tonnellate === 1120.24 && sAtt.surplus[0].ordini === 380 && Math.abs(sAtt.euro - settembre(senzaRete).euro - 5601.2) < 0.005 && sAtt.ordini === settembre(senzaRete).ordini && sAtt.tonnellate === settembre(senzaRete).tonnellate, J({ ...sAtt, documento: undefined }));
    verifica("attiva dell'ACI: 94,45 €", settembre(attAci).euro_surplus === 94.45, J(settembre(attAci).surplus));
    const sPas = settembre(pasRete);
    verifica('passiva della rete: 4.332,80 € ai raccoglitori, e il totale sale proprio di quelli', sPas.euro_surplus === 4332.8 && Math.abs(sPas.euro - settembre(senzaPas).euro - 4332.8) < 0.005, J(sPas));
    const fuelRete = (pasRete.surplus || []).find(s => s.nome === 'Fuel Surcharge') || {};
    verifica('le tonnellate di SMOCO che non lo prendono: 253,68 a settembre (piu\' quelle di agosto, che non ha surplus: nessuna)', fuelRete.tonnellate_interni_non_pagate === 253.68 && fuelRete.tonnellate === 866.56, J(fuelRete));
    // Green Tyre e' anche trasportatore di secondarie: qui conta la sua raccolta.
    const green = pasRete.fornitori.righe.find(f => f.fornitore === 'GREEN TYRE PROJECT SRL' && f.sezione === 'raccolta') || {};
    verifica('Green Tyre: 1.278,90 € di surplus (255,78 t)', green.euro_surplus === 1278.9, J(green.surplus));
    verifica("passiva dell'ACI: 69,95 €", settembre(pasAci).euro_surplus === 69.95, J(settembre(pasAci)));
    verifica("l'importo si arrotonda una volta: 1.120.240 kg a 5 €/t", importoSurplus(1120240, 5) === 5601.2);
    console.log(`  rete: attiva +${sAtt.euro_surplus} €, passiva +${sPas.euro_surplus} €; ACI: attiva +${settembre(attAci).euro_surplus} €, passiva +${settembre(pasAci).euro_surplus} €`);
  }
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
