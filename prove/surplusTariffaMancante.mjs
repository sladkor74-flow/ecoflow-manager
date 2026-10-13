// UN FORNITORE SENZA LA TARIFFA DEL MESE RICEVE LO STESSO IL SURPLUS, CON
// L'AVVISO (risposta dell'utente del 13/10/2026 alla prima domanda nuova del
// surplus sulle tariffe).
//
// La domanda era: un raccoglitore che nel mese non ha la tariffa (riga «senza
// tariffa», gia' fra le anomalie) riceve lo stesso il Fuel Surcharge sulle sue
// tonnellate? La risposta, accettata come proposta: si', ma con l'avviso che la
// tariffa manca. Il surplus si paga sulle tonnellate raccolte o trattate; la
// riga standard resta a zero, e un surplus senza la sua riga standard e' una
// fattura del fornitore che non torna, quindi va detto: «tariffa del mese
// mancante: il surplus c'è, la riga standard no».
//
// Qui si guarda che l'avviso ci sia, sempre lo stesso, dappertutto:
//   1. il calcolo (passivaCalcolo.ts): la riga del surplus resta e porta
//      `avviso` e `tonnellate_senza_tariffa`; il surplus del mese dice chi
//      (`senza_tariffa`) anche quando la tariffa manca su una parte sola; l'anomalia
//      della tariffa che manca dice che il surplus c'e' lo stesso, in un campo
//      suo (`avviso_surplus`), con la descrizione di sempre; un interno e il
//      prezzo unico della raccolta (Green Tyre) non hanno avvisi; senza surplus
//      niente cambia;
//   1c. l'anno di EcoTyna: la stessa tariffa che manca resta una voce sola anche
//      quando il surplus comincia a meta' anno (revisione del 13/10/2026: la
//      frase nella descrizione, che e' la chiave, la divideva in due), e il suo
//      avviso dice il surplus sulle tonnellate di tutti i mesi, coi nomi di
//      tutti (chiusura del giro, 13/10/2026: prima restava quello del primo
//      mese, e col surplus da febbraio l'anno non lo diceva);
//   2. il foglio dell'amministrazione: la nota della riga del surplus, che dice
//      quello che il foglio fa davvero. Se la riga standard del foglio e' a zero,
//      la frase del calcolo; se il foglio prezza lo stesso le tonnellate senza
//      tariffa (dal modello, dal tariffario per la voce, con la tariffa degli
//      altri movimenti della voce), lo dice e non dice «la riga standard no»
//      (revisione del 13/10/2026);
//   3. i file: il foglio Excel e il PDF dell'amministrazione, e il file del
//      canale: la riga del surplus con l'avviso in testa alla nota, e le
//      anomalie (in fondo all'Excel e nelle note del PDF) con la descrizione di
//      sempre seguita dall'avviso (chiusura del giro, 13/10/2026: prima il file
//      del canale non lo diceva da nessuna parte);
//   4. la pagina: la tabella dei raccoglitori, la fascia del mese e l'elenco
//      delle anomalie, che sotto la descrizione dice l'avviso (chiusura del
//      giro, 13/10/2026);
//   5. sui dati veri (copia in ../dati-veri, se c'e'): settembre 2026 col Fuel
//      Surcharge simulato e ottobre col Fuel Surcharge vero non hanno raccoglitori
//      pagati senza tariffa, e i numeri non cambiano.
//
// node prove/surplusTariffaMancante.mjs
import { createRequire } from 'node:module';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { calcolaPassivaMese } from '../base44/shared/passivaCalcolo.ts';
import { caricaLibPagine } from './dati/libPagine.mjs';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
const ExcelJS = createRequire(import.meta.url)('exceljs');
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
// Una sezione che si ferma con un errore conta come fallita e si va avanti.
const sezione = async (titolo, corpo) => {
  console.log(titolo);
  try { await corpo(); } catch (e) { ko++; console.log(`  FALLITA: ${titolo}: si ferma con un errore (${e && e.message})`); }
};

const AVVISO = "Tariffa del mese mancante: il surplus c'è, la riga standard no.";

// ─── OTTOBRE 2026, RETE ───
// ALFA SRL raccoglie 10 t e nel mese non ha nessuna tariffa di raccolta.
// GAMMA SRL ha la tariffa per Napoli e non per Salerno: 4 t pagate, 2 t senza.
// SMOCO e' interno, senza tariffa: non riceve il surplus e non ha avvisi.
// BETA IMPIANTI tratta con la sua tariffa. DELTA STOCCAGGI riceve 3 t senza la
// tariffa dello stoccaggio, e c'e' un accordo di 2 €/t sullo stoccaggio.
// GREEN TYRE raccoglie e tratta a prezzo unico: il trattamento compreso nella
// raccolta non e' una tariffa che manca.
const FORNITORI = [
  { id: 'f-al', ragione_sociale: 'ALFA SRL', stato: 'attivo' },
  { id: 'f-ga', ragione_sociale: 'GAMMA SRL', stato: 'attivo' },
  { id: 'f-sm', ragione_sociale: 'SMOCO S.R.L.', interno: true, stato: 'attivo' },
  { id: 'f-be', ragione_sociale: 'BETA IMPIANTI', stato: 'attivo' },
  { id: 'f-de', ragione_sociale: 'DELTA STOCCAGGI', stato: 'attivo' },
  { id: 'f-gt', ragione_sociale: 'GREEN TYRE PROJECT SRL', stato: 'attivo' },
];
const tariffa = (id, fornitore, prestazione, valore, extra = {}) => ({ id, direzione: 'PASSIVA', prestazione, tipologia: 'RETE', fornitore_nome: fornitore, unita_misura: '€/t', valore, stato: 'attivo', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31', ...extra });
const TARIFFE = [
  tariffa('t-ga', 'GAMMA SRL', 'RACCOLTA', 70, { provincia: 'NA' }),
  tariffa('t-be', 'BETA IMPIANTI', 'TRATTAMENTO', 80),
  tariffa('t-gt', 'GREEN TYRE PROJECT SRL', 'RACCOLTA', 225, { comprensiva_trattamento: true }),
];
const primaria = (id, trasportatore, kg, giorno, extra = {}) => ({
  id, stato: 'terminato', id_ordine: 'ET' + id, numero_fir: 'RGYTR' + id, trasportatore, provincia: 'NA', regione: 'Campania',
  destinazione: 'BETA IMPIANTI', tipo_destinazione: 'imp', classe: 'P', peso_effettivo: kg, automezzo: 'AB' + id, cer: '160103',
  ordine_immesso_il: '2026-10-01T08:00:00.000Z', trasporto_iniziato_il: `2026-10-${giorno}T08:00:00.000Z`, trasporto_finito_il: `2026-10-${giorno}T08:00:00.000Z`, ...extra,
});
const PRIMARIE = [
  primaria('1', 'ALFA SRL', 6000, '05'),
  primaria('2', 'ALFA SRL', 4000, '20'),
  primaria('3', 'GAMMA SRL', 4000, '06'),
  primaria('4', 'GAMMA SRL', 2000, '07', { provincia: 'SA' }),
  primaria('5', 'SMOCO S.R.L.', 3000, '08'),
  primaria('6', 'ALFA SRL', 3000, '09', { destinazione: 'DELTA STOCCAGGI', tipo_destinazione: 'stoc' }),
  primaria('7', 'GREEN TYRE PROJECT SRL', 1000, '10', { destinazione: 'GREEN TYRE PROJECT SRL' }),
];
const surplus = (id, extra = {}) => ({
  id, gruppo: 'g-' + id, nome: 'Fuel Surcharge', origine: 'CONSORZIO', riferimento: 'comunicazione Ecotyre', tipologia: 'RETE', prestazione: 'RACCOLTA',
  a_chi: 'tutti', euro_t_passiva: 5, euro_t_attiva: 5, data_inizio_validita: '2026-10-01', data_fine_validita: '2026-12-31', stato: 'attivo', ...extra,
});
const FS = surplus('fs');
const STOCCAGGIO = surplus('st', { nome: 'Accordo stoccaggi', origine: 'ACCORDO_COMMERCIALE', prestazione: 'CONFERIMENTO_STOCCAGGIO', euro_t_attiva: null, euro_t_passiva: 2 });
const TRATTAMENTO = surplus('tr', { nome: 'Accordo trattamento', origine: 'ACCORDO_COMMERCIALE', prestazione: 'TRATTAMENTO', euro_t_attiva: null, euro_t_passiva: 1 });
const ARCHIVI = { primarieRete: PRIMARIE, primarieAci: [], secondarieAll: [], extraRaccoltaAll: [], tariffeAll: TARIFFE, fornitoriAll: FORNITORI };
const passiva = (surplusAll, archivi = ARCHIVI) => calcolaPassivaMese({ ...archivi, surplusAll }, 2026, 9, 'Ottobre', 'RETE');
const PR = passiva([FS, STOCCAGGIO, TRATTAMENTO]);
const PR0 = passiva([]);
const di = (blocco, nome) => (PR[blocco] || []).find(f => f.fornitore === nome) || {};

await sezione('1. IL CALCOLO: LA RIGA DEL SURPLUS RESTA, CON L\'AVVISO', async () => {
  const alfa = di('raccoglitori', 'ALFA SRL');
  verifica('ALFA, senza tariffa: le righe standard (verso BETA e verso DELTA) restano «senza tariffa» a zero', alfa.righe && alfa.righe.length === 2 && alfa.righe.every(r => r.importo === 0 && /senza tariffa/.test(r.note)) && alfa.totale_standard === 0, J(alfa.righe));
  const sa = (alfa.surplus || [])[0] || {};
  verifica('ALFA: la riga del Fuel Surcharge c\'e\' lo stesso, 13,00 t x 5,00 = 65,00 €, e il totale e\' 65,00', sa.nome === 'Fuel Surcharge' && sa.tonnellate === 13 && sa.importo === 65 && alfa.totale_euro === 65 && alfa.totale_surplus === 65, J(sa));
  verifica('...con l\'avviso: «Tariffa del mese mancante: il surplus c\'è, la riga standard no.» su tutte le sue 13,00 t', sa.avviso === AVVISO && sa.tonnellate_senza_tariffa === 13, J(sa));
  const ga = (di('raccoglitori', 'GAMMA SRL').surplus || [])[0] || {};
  verifica('GAMMA, tariffa per Napoli e non per Salerno: il surplus su tutte le 6,00 t (30,00 €), l\'avviso sulle 2,00 t senza tariffa',
    ga.tonnellate === 6 && ga.importo === 30 && ga.tonnellate_senza_tariffa === 2 && ga.avviso === "Tariffa del mese mancante su 2,00 t delle 6,00: il surplus c'è, la riga standard no.", J(ga));
  const sm = di('raccoglitori', 'SMOCO S.R.L.');
  verifica('SMOCO, interno: nessuna riga del surplus e nessun avviso', sm.interno === true && !(sm.surplus || []).length, J(sm));
  const gt = di('raccoglitori', 'GREEN TYRE PROJECT SRL');
  verifica('GREEN TYRE ha la tariffa (prezzo unico): il surplus senza avviso', ((gt.surplus || [])[0] || {}).importo === 5 && !((gt.surplus || [])[0] || {}).avviso, J(gt.surplus));
  // impianti e stoccaggi
  const de = di('impianti_stoccaggi', 'DELTA STOCCAGGI');
  const sd = (de.surplus || [])[0] || {};
  verifica('DELTA, stoccaggio senza tariffa: l\'accordo sullo stoccaggio (3,00 t x 2,00 = 6,00 €) con l\'avviso', sd.nome === 'Accordo stoccaggi' && sd.importo === 6 && sd.avviso === AVVISO, J(de));
  const be = (di('impianti_stoccaggi', 'BETA IMPIANTI').surplus || [])[0] || {};
  verifica('BETA, trattamento con la sua tariffa: il surplus senza avviso', be.nome === 'Accordo trattamento' && be.tonnellate === 19 && be.importo === 19 && !be.avviso, J(be));
  const gtImp = di('impianti_stoccaggi', 'GREEN TYRE PROJECT SRL');
  verifica('GREEN TYRE, trattamento compreso nel prezzo unico della raccolta: nessun avviso, nessuna anomalia', !((gtImp.surplus || [])[0] || {}).avviso
    && !PR.anomalie.some(a => /GREEN TYRE/.test(a.descrizione)), J([gtImp.surplus, PR.anomalie.filter(a => /GREEN/.test(a.descrizione))]));
  // le anomalie: la descrizione di sempre, e l'avviso in un campo suo
  const anAlfa = PR.anomalie.filter(a => /Raccoglitore senza tariffa RACCOLTA: ALFA SRL/.test(a.descrizione));
  verifica('le anomalie di ALFA (verso BETA 10,00 t, verso DELTA 3,00 t) hanno la descrizione di sempre',
    anAlfa.length === 2 && anAlfa.every(a => a.descrizione === 'Raccoglitore senza tariffa RACCOLTA: ALFA SRL')
    && J(anAlfa.map(a => a.tonnellate).sort((x, y) => x - y)) === J([3, 10]), J(anAlfa));
  verifica('...e dicono in avviso_surplus che il surplus c\'e\' lo stesso, col suo nome, su tutte le loro tonnellate',
    anAlfa.every(a => a.avviso_surplus === "Tariffa del mese mancante: il surplus c'è (Fuel Surcharge), la riga standard no." && a.tonnellate_surplus === a.tonnellate), J(anAlfa));
  const anDelta = PR.anomalie.find(a => a.descrizione === 'Impianto/stoccaggio senza tariffa CONFERIMENTO_STOCCAGGIO: DELTA STOCCAGGI') || {};
  verifica('...e quella di DELTA, dello stoccaggio', anDelta.avviso_surplus === "Tariffa del mese mancante: il surplus c'è (Accordo stoccaggi), la riga standard no." && anDelta.tonnellate_surplus === 3, J(anDelta));
  verifica('nessuna descrizione di anomalia parla del surplus: la descrizione e\' la chiave con cui la stessa anomalia si dice una volta', !PR.anomalie.some(a => /surplus/i.test(a.descrizione)), J(PR.anomalie.map(a => a.descrizione)));
  verifica('le anomalie col surplus sono quelle senza surplus, campo per campo, a parte l\'avviso',
    J(PR.anomalie.map(({ avviso_surplus: _a, tonnellate_surplus: _t, ...a }) => a)) === J(PR0.anomalie), J([PR.anomalie, PR0.anomalie]));
  // il surplus del mese
  const fs = PR.surplus_del_mese.find(s => s.nome === 'Fuel Surcharge') || {};
  verifica('il surplus del mese dice chi lo riceve senza tariffa: ALFA 13,00 t, GAMMA 2,00 t, SMOCO no',
    J((fs.senza_tariffa || []).map(f => [f.fornitore, f.tonnellate])) === J([['ALFA SRL', 13], ['GAMMA SRL', 2]]) && fs.importo === 100, J(fs));
  verifica('...e la nota del mese lo dice', /ALFA SRL, tariffa del mese mancante: il surplus c'è, la riga standard no\./.test(fs.nota) && /GAMMA SRL, tariffa del mese mancante su 2,00 t delle 6,00/.test(fs.nota), fs.nota);
  // i totali non cambiano per l'avviso: standard e surplus come sempre
  verifica('i raccoglitori: standard 280,00 (GAMMA 4 t x 70) + 225 (Green Tyre), surplus 100,00 (ALFA 65 + GAMMA 30 + GREEN TYRE 5)', PR.totali.standard.raccoglitori === 505 && PR.totali.surplus.raccoglitori === 100, J(PR.totali));
});

await sezione('1b. SENZA SURPLUS NIENTE CAMBIA; UN SURPLUS DA META\' MESE TOCCA SOLO I SUOI GIORNI', async () => {
  const campi = JSON.stringify(PR0);
  verifica('senza surplus: nessun avviso, nessun «senza_tariffa», nessuna riga del surplus', !/avviso|senza_tariffa|tonnellate_senza_tariffa/.test(campi) && PR0.surplus_del_mese.length === 0, '');
  verifica('...e l\'anomalia e\' quella di prima, parola per parola', PR0.anomalie.some(a => a.descrizione === 'Raccoglitore senza tariffa RACCOLTA: ALFA SRL') && !PR0.anomalie.some(a => /surplus/.test(a.descrizione)), J(PR0.anomalie.map(a => a.descrizione)));
  // gli stessi totali di prima, con e senza l'avviso: lo standard non si tocca
  verifica('lo standard col surplus e\' quello senza surplus', PR.totali.standard.totale === PR0.totali.totale_complessivo, J([PR.totali.standard, PR0.totali]));
  // dal 15/10: ALFA ha 6 t il 05/10 (fuori) e 4 t il 20/10 (dentro)
  const P15 = passiva([surplus('fs15', { data_inizio_validita: '2026-10-15' })]);
  const a15 = (P15.raccoglitori.find(f => f.fornitore === 'ALFA SRL') || {}).surplus || [];
  verifica('dal 15/10: ALFA prende il surplus sulle sole 4,00 t del 20/10, con l\'avviso su quelle', a15.length === 1 && a15[0].tonnellate === 4 && a15[0].tonnellate_senza_tariffa === 4 && a15[0].avviso === AVVISO, J(a15));
  const an15 = P15.anomalie.filter(a => /ALFA SRL/.test(a.descrizione) && /RACCOLTA/.test(a.descrizione));
  const versoBeta = an15.find(a => /BETA/.test(a.ambito)) || {};
  const versoDelta = an15.find(a => /DELTA/.test(a.ambito)) || {};
  verifica('...e l\'anomalia NON si divide (revisione del 13/10/2026): verso BETA una sola, 10,00 t (6 del 05/10 e 4 del 20/10), verso DELTA 3,00 t, come senza surplus',
    an15.length === 2 && an15.every(a => a.descrizione === 'Raccoglitore senza tariffa RACCOLTA: ALFA SRL') && versoBeta.tonnellate === 10 && versoBeta.occorrenze === 2 && versoDelta.tonnellate === 3, J(an15));
  verifica('...verso BETA l\'avviso dice su quante tonnellate c\'e\' il surplus: «su 4,00 t delle 10,00»',
    versoBeta.avviso_surplus === "Tariffa del mese mancante: il surplus c'è (Fuel Surcharge) su 4,00 t delle 10,00, la riga standard no." && versoBeta.tonnellate_surplus === 4, J(versoBeta));
  verifica('...verso DELTA (09/10, prima del 15) nessun avviso', !('avviso_surplus' in versoDelta) && !('tonnellate_surplus' in versoDelta), J(versoDelta));
  const gaAn = PR.anomalie.find(a => a.descrizione === 'Raccoglitore senza tariffa RACCOLTA: GAMMA SRL') || {};
  verifica('GAMMA, l\'anomalia di Salerno (2,00 t): il surplus su tutte e due', gaAn.tonnellate === 2 && gaAn.avviso_surplus === "Tariffa del mese mancante: il surplus c'è (Fuel Surcharge), la riga standard no.", J(gaAn));
});

await sezione('1c. L\'ANNO DI ECOTYNA: LA STESSA TARIFFA CHE MANCA RESTA UNA VOCE SOLA', async () => {
  // Lo scenario della revisione del 13/10/2026: GAMMA NOPREZZO senza tariffa di
  // raccolta, 1 t a gennaio e 1 t a febbraio, Fuel Surcharge da febbraio. La
  // regola del 10/10/2026: la stessa anomalia in piu' mesi si dice una volta,
  // coi mesi e le tonnellate di tutti.
  const { STRUMENTI } = await import('../base44/shared/strumentiAssistente.ts');
  const { oggiRoma } = await import('../base44/shared/giornoItaliano.ts');
  const ANNO = Number(oggiRoma().slice(0, 4));
  const g = (mese, giorno) => `${ANNO}-${String(mese).padStart(2, '0')}-${String(giorno).padStart(2, '0')}T08:00:00Z`;
  const prim = (id, kg, mese) => ({ stato: 'terminato', cer: '160103', classe: 'A', id, id_ordine: 'ET' + id, numero_fir: 'F' + id, peso_effettivo: kg,
    ordine_immesso_il: g(mese, 1), trasporto_iniziato_il: g(mese, 2), trasporto_finito_il: g(mese, 3),
    trasportatore: 'GAMMA NOPREZZO SRL', destinazione: 'BETA IMPIANTI', provincia: 'NA', tipo_destinazione: 'imp', automezzo: 'AA111AA' });
  const archivi = (surplusAll) => ({
    PrimariaRete: [prim('1', 1000, 1), prim('2', 1000, 2)], PrimariaAci: [], Secondaria: [], ExtraRaccolta: [],
    Fornitore: [{ ragione_sociale: 'GAMMA NOPREZZO SRL', stato: 'attivo' }, { ragione_sociale: 'BETA IMPIANTI', stato: 'attivo' }],
    Tariffa: [{ id: 'p3', direzione: 'PASSIVA', stato: 'attivo', prestazione: 'TRATTAMENTO', fornitore_nome: 'Beta Impianti', tipologia: 'RETE', valore: 80, unita_misura: '€/t' }],
    SurplusTariffa: surplusAll, VoceFatturazione: [],
  });
  const finto = (A) => ({ asServiceRole: { entities: new Proxy({}, { get: (_t, e) => ({
    filter: async (f = {}) => (A[e] || []).filter(r => Object.entries(f).every(([c, v]) => r[c] === v)),
    list: async () => A[String(e)] || [],
  }) }) }, functions: { invoke: async () => { throw new Error('no'); } } });
  const fatt = STRUMENTI.find(s => s.nome === 'fatturazione');
  const anomalieAnno = async (surplusAll) => {
    const d = (await fatt.esegui(finto(archivi(surplusAll)), { anno: ANNO, tipo: 'PASSIVA', tipologia: 'RETE' }, { amministratore: true })).dati;
    return d.canali[0].anomalie.righe.filter(a => a.fornitore === 'GAMMA NOPREZZO SRL');
  };
  const senza = await anomalieAnno([]);
  const con = await anomalieAnno([surplus('fs-feb', { data_inizio_validita: `${ANNO}-02-01`, data_fine_validita: `${ANNO}-12-31` })]);
  verifica('senza surplus: una voce, Gennaio e Febbraio, 2,00 t', senza.length === 1 && J(senza[0].mesi) === J(['Gennaio', 'Febbraio']) && senza[0].tonnellate === 2, J(senza));
  verifica('col Fuel Surcharge da febbraio: ancora una voce sola, con la descrizione di sempre, Gennaio e Febbraio, 2,00 t',
    con.length === 1 && con[0].descrizione === 'Raccoglitore senza tariffa RACCOLTA: GAMMA NOPREZZO SRL' && J(con[0].mesi) === J(['Gennaio', 'Febbraio']) && con[0].tonnellate === 2, J(con));
  // L'avviso dell'anno (chiusura del giro, 13/10/2026): la voce unita prendeva
  // i campi del primo mese, e gennaio l'avviso non l'aveva.
  verifica('...e l\'avviso dell\'anno dice il surplus sulle tonnellate di tutti i mesi: «su 1,00 t delle 2,00»',
    con.length === 1 && con[0].avviso_surplus === "Tariffa del mese mancante: il surplus c'è (Fuel Surcharge) su 1,00 t delle 2,00, la riga standard no." && con[0].tonnellate_surplus === 1, J(con));
  verifica('senza surplus nessun avviso nell\'anno', senza.length === 1 && !('avviso_surplus' in senza[0]) && !('tonnellate_surplus' in senza[0]), J(senza));
  const tutto = await anomalieAnno([surplus('fs-gen', { data_inizio_validita: `${ANNO}-01-01`, data_fine_validita: `${ANNO}-12-31` })]);
  verifica('col surplus da gennaio: l\'avviso su tutte le 2,00 t, senza «su»',
    tutto.length === 1 && tutto[0].avviso_surplus === "Tariffa del mese mancante: il surplus c'è (Fuel Surcharge), la riga standard no." && tutto[0].tonnellate_surplus === 2, J(tutto));
  const due = await anomalieAnno([
    surplus('acc-gen', { nome: 'Accordo gennaio', origine: 'ACCORDO_COMMERCIALE', euro_t_attiva: null, euro_t_passiva: 2, data_inizio_validita: `${ANNO}-01-01`, data_fine_validita: `${ANNO}-01-31` }),
    surplus('fs-feb2', { data_inizio_validita: `${ANNO}-02-01`, data_fine_validita: `${ANNO}-12-31` }),
  ]);
  verifica('un surplus a gennaio e un altro da febbraio: l\'avviso li nomina tutti e due, su tutte le 2,00 t',
    due.length === 1 && due[0].avviso_surplus === "Tariffa del mese mancante: il surplus c'è (Accordo gennaio e Fuel Surcharge), la riga standard no." && due[0].tonnellate_surplus === 2, J(due));
});

// ─── IL FOGLIO E I FILE ───
const AMM = await caricaLibPagine('lib/passivaAmministrazione');
const { foglioPassiva } = AMM;
const { cartellaPassivaUnFoglio } = await caricaLibPagine('lib/passivaAmministrazioneExcel');
const { righePassiva } = await caricaLibPagine('lib/passivaExport');
const voce = (blocco, soggetto, prezzo, ordine, extra = {}) => ({ anno: 2026, canale: 'RETE', blocco, soggetto, voce: '', prezzo, unita_misura: 'euro_tonnellata', colonna_prezzo: '', ordine, criterio_json: '', attiva: true, note: '', ...extra });
const VOCI = [
  voce('raccoglitori', 'ALFA SRL', 0, 10),
  voce('raccoglitori', 'GAMMA SRL', 70, 20),
  voce('raccoglitori', 'SMOCO S.R.L.', 0, 30, { note: 'Interno: non fatturato.' }),
  voce('impianti', 'BETA IMPIANTI', 80, 10),
  voce('impianti', 'DELTA STOCCAGGI', 0, 20),
];
let FOGLIO = null;

await sezione('2. IL FOGLIO DELL\'AMMINISTRAZIONE: L\'AVVISO IN TESTA ALLA NOTA, COM\'E\' NEL FOGLIO', async () => {
  FOGLIO = foglioPassiva(VOCI, PR, 'RETE', 'Ottobre', 2026, TARIFFE);
  const riga = (F, blocco, tipo, soggetto) => F[blocco].righe.find(r => r.tipo === tipo && r.soggetto === soggetto) || {};
  // ALFA con la voce a zero nel modello: la riga standard del foglio e' davvero a zero
  const vAlfa = riga(FOGLIO, 'raccoglitori', 'voce', 'ALFA SRL');
  const sAlfa = riga(FOGLIO, 'raccoglitori', 'surplus', 'ALFA SRL');
  verifica('ALFA, voce a zero nel modello: la riga standard del foglio vale 0,00 €', vAlfa.totale === 0 && vAlfa.tonnellate === 13, J(vAlfa));
  verifica('...la riga del surplus: 13,00 t, 65,00 €, e la nota comincia con l\'avviso del calcolo', sAlfa.totale === 65 && sAlfa.tonnellate === 13 && sAlfa.note.startsWith(AVVISO + ' Consorzio Ecotyre, dal 01/10/2026 al 31/12/2026'), J(sAlfa));
  verifica('...e lo porta anche nel suo campo', sAlfa.avviso === AVVISO && sAlfa.tonnellate_senza_tariffa === 13, J(sAlfa));
  // GAMMA, voce a 70: il foglio prende le 6,00 t intere con la tariffa di Napoli
  const vGamma = riga(FOGLIO, 'raccoglitori', 'voce', 'GAMMA SRL');
  const sGamma = riga(FOGLIO, 'raccoglitori', 'surplus', 'GAMMA SRL');
  verifica('GAMMA: nel foglio la riga standard prende tutte le 6,00 t a 70 (420,00 €, tariffa dei movimenti)', vGamma.tonnellate === 6 && vGamma.totale === 420 && vGamma.fonte_prezzo === 'movimenti', J(vGamma));
  verifica('...e la riga del surplus dice quello che il foglio fa: «Tariffa del mese mancante su 2,00 t delle 6,00: nel foglio la riga standard ha la tariffa degli altri movimenti della voce; il surplus c\'è lo stesso.»',
    sGamma.avviso === "Tariffa del mese mancante su 2,00 t delle 6,00: nel foglio la riga standard ha la tariffa degli altri movimenti della voce; il surplus c'è lo stesso."
    && sGamma.note.startsWith(sGamma.avviso + ' Consorzio Ecotyre') && !/la riga standard no/.test(sGamma.note), J(sGamma));
  const sDelta = riga(FOGLIO, 'impianti', 'surplus', 'DELTA STOCCAGGI');
  verifica('DELTA nello stoccaggio, voce a zero: l\'avviso del calcolo', (sDelta.note || '').startsWith(AVVISO), J(sDelta));
  // Lo scenario della revisione: ALFA con la sua voce nel modello a 70 €/t
  const VOCI70 = VOCI.map(v => (v.soggetto === 'ALFA SRL' ? { ...v, prezzo: 70 } : v));
  const F70 = foglioPassiva(VOCI70, PR, 'RETE', 'Ottobre', 2026, TARIFFE);
  const v70 = riga(F70, 'raccoglitori', 'voce', 'ALFA SRL');
  const s70 = riga(F70, 'raccoglitori', 'surplus', 'ALFA SRL');
  verifica('ALFA con la voce a 70 nel modello: la riga standard del foglio vale 13,00 t x 70 = 910,00 € (prezzo del modello)', v70.totale === 910 && v70.fonte_prezzo === 'modello', J(v70));
  verifica('...e la riga del surplus non dice «la riga standard no»: «Tariffa del mese mancante: nel foglio la riga standard ha il prezzo del modello; il surplus c\'è lo stesso.»',
    s70.avviso === "Tariffa del mese mancante: nel foglio la riga standard ha il prezzo del modello; il surplus c'è lo stesso." && !/la riga standard no/.test(s70.note) && s70.totale === 65, J(s70));
  // Una parte sola: la voce verso BETA a 70, quella verso DELTA a zero
  const criterio = (destinazione) => JSON.stringify({ destinazione });
  const VOCI_DUE = [...VOCI.filter(v => v.soggetto !== 'ALFA SRL'),
    voce('raccoglitori', 'ALFA SRL', 70, 10, { voce: 'verso Beta', criterio_json: criterio('BETA IMPIANTI') }),
    voce('raccoglitori', 'ALFA SRL', 0, 11, { voce: 'verso Delta', criterio_json: criterio('DELTA STOCCAGGI') })];
  const FD = foglioPassiva(VOCI_DUE, PR, 'RETE', 'Ottobre', 2026, TARIFFE);
  const vd = FD.raccoglitori.righe.filter(r => r.tipo === 'voce' && r.soggetto === 'ALFA SRL').map(r => [r.voce, r.tonnellate, r.totale]);
  const sd = riga(FD, 'raccoglitori', 'surplus', 'ALFA SRL');
  verifica('ALFA con due voci, verso BETA a 70 e verso DELTA a zero: 10,00 t a 700,00 € e 3,00 t a zero', J(vd) === J([['verso Beta', 10, 700], ['verso Delta', 3, 0]]), J(vd));
  verifica('...l\'avviso dice la parte: «nel foglio la riga standard ha il prezzo del modello su 10,00 t delle 13,00 senza tariffa, le altre no»',
    sd.avviso === "Tariffa del mese mancante: nel foglio la riga standard ha il prezzo del modello su 10,00 t delle 13,00 senza tariffa, le altre no; il surplus c'è lo stesso.", J(sd));
  // Il prezzo dal tariffario per la voce: la tariffa di ALFA comincia il 10/10,
  // il movimento del 05/10 resta senza tariffa nel calcolo, il foglio la legge il 15
  const TAR_DAL_10 = [...TARIFFE, tariffa('t-al', 'ALFA SRL', 'RACCOLTA', 60, { data_inizio_validita: '2026-10-10' })];
  const P_T = passiva([FS], { ...ARCHIVI, primarieRete: PRIMARIE.filter(p => p.id === '1'), tariffeAll: TAR_DAL_10 });
  const sP = ((P_T.raccoglitori.find(f => f.fornitore === 'ALFA SRL') || {}).surplus || [])[0] || {};
  const FT = foglioPassiva(VOCI, P_T, 'RETE', 'Ottobre', 2026, TAR_DAL_10);
  const vT = riga(FT, 'raccoglitori', 'voce', 'ALFA SRL');
  const sT = riga(FT, 'raccoglitori', 'surplus', 'ALFA SRL');
  verifica('ALFA col tariffario dal 10/10 e il viaggio del 05/10: nel calcolo senza tariffa (l\'avviso), nel foglio 6,00 t a 60 dal tariffario', sP.avviso === AVVISO && vT.fonte_prezzo === 'tariffario' && vT.totale === 360, J([sP, vT]));
  verifica('...e la riga del surplus lo dice: «nel foglio la riga standard ha il prezzo che il tariffario dà alla voce»',
    sT.avviso === "Tariffa del mese mancante: nel foglio la riga standard ha il prezzo che il tariffario dà alla voce; il surplus c'è lo stesso.", J(sT));
  const sBeta = FOGLIO.impianti.righe.find(r => r.tipo === 'surplus' && r.soggetto === 'BETA IMPIANTI') || {};
  verifica('BETA, con la tariffa: la nota di sempre, senza avviso', /^consorzio|^accordo|surplus sulle stesse tonnellate/i.test(sBeta.note || '') && !/mancante/.test(sBeta.note || '') && !sBeta.avviso, J(sBeta));
  const f0 = foglioPassiva(VOCI, PR0, 'RETE', 'Ottobre', 2026, TARIFFE);
  verifica('senza surplus il foglio non ha righe del surplus ne\' avvisi', ![...f0.raccoglitori.righe, ...f0.impianti.righe].some(r => r.tipo === 'surplus' || r.avviso), '');
});

await sezione('3. I FILE: L\'EXCEL E IL PDF DEL FOGLIO, E IL FILE DEL CANALE', async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await cartellaPassivaUnFoglio([FOGLIO])));
  const ws = wb.getWorksheet('PASSIVA');
  const testi = [];
  ws.eachRow((row) => row.eachCell((c) => { const v = c.value; testi.push(typeof v === 'string' ? v : v && v.richText ? v.richText.map(x => x.text).join('') : String(v ?? '')); }));
  verifica('nel foglio Excel la nota della riga del surplus di ALFA comincia con l\'avviso', testi.some(t => t.startsWith(AVVISO + ' Consorzio Ecotyre')), testi.filter(t => /mancante/.test(t)).join(' | '));
  verifica('...e quella di GAMMA dice le 2,00 t e la tariffa degli altri movimenti', testi.some(t => t.startsWith('Tariffa del mese mancante su 2,00 t delle 6,00: nel foglio la riga standard ha la tariffa degli altri movimenti della voce')), '');
  verifica('...e nessuna nota del foglio Excel dice «la riga standard no» per GAMMA, che nel foglio la riga standard ce l\'ha', !testi.some(t => /su 2,00 t delle 6,00: il surplus c'è, la riga standard no/.test(t)), '');
  // il PDF, con un jsPDF finto che tiene i testi
  globalThis.__TESTI_TM = [];
  class PdfFinto {
    constructor() { this.internal = { pageSize: { getWidth: () => 297, getHeight: () => 210 } }; }
    setFont() {} setFontSize() {} setTextColor() {} setFillColor() {} setDrawColor() {} setLineWidth() {}
    rect() {} roundedRect() {} line() {}
    text(t) { globalThis.__TESTI_TM.push(Array.isArray(t) ? t.join(' ') : String(t)); }
    splitTextToSize(s) { return String(s).split('\n'); }
    addPage() {} save() {}
  }
  globalThis.__PDF_FINTO_TM = { jsPDF: PdfFinto };
  globalThis.__AMM_TM = AMM;
  const { esportaPassivaAmministrazionePdf } = await caricaLibPagine('lib/passivaAmministrazionePdf', [
    ["const { jsPDF } = await import('jspdf');", 'const { jsPDF } = globalThis.__PDF_FINTO_TM;'],
    [/import \{([^}]*)\} from '@\/lib\/passivaAmministrazione';/, 'const {$1} = globalThis.__AMM_TM;'],
  ]);
  await esportaPassivaAmministrazionePdf([FOGLIO], { anno: 2026, mese: 'Ottobre' });
  const T = globalThis.__TESTI_TM.join(' ');
  verifica('nel PDF del foglio l\'avviso c\'e\'', T.includes("Tariffa del mese mancante: il surplus c'è, la riga standard no."), globalThis.__TESTI_TM.filter(t => /mancante|Fuel/.test(t)).slice(0, 6).join(' | '));
  // il file del canale: le anomalie in fondo, con la descrizione di sempre; il
  // calcolo gli passa l'avviso in avviso_surplus, che il file puo' aggiungere
  const righe = righePassiva(PR);
  const anomalie = righe.slice(righe.findIndex(r => r && r[0] === 'ANOMALIE DA GUARDARE PRIMA DI PAGARE'));
  verifica('nel file del canale, fra le anomalie: «Raccoglitore senza tariffa RACCOLTA: ALFA SRL», la descrizione di sempre in testa',
    anomalie.some(r => r && String(r[0]).startsWith('Raccoglitore senza tariffa RACCOLTA: ALFA SRL')), J(anomalie.map(r => r && r[0])));
  verifica('...e le anomalie che il file riceve portano l\'avviso nel loro campo', PR.anomalie.filter(a => a.avviso_surplus).length === 4, J(PR.anomalie.filter(a => a.avviso_surplus)));
  // Il file del canale lo scrive (chiusura del giro, 13/10/2026). Prima la riga
  // dell'anomalia era la sola descrizione e la riga del surplus la nota di
  // sempre: nel file del canale l'avviso non c'era da nessuna parte.
  const AN_ALFA = "Raccoglitore senza tariffa RACCOLTA: ALFA SRL. Tariffa del mese mancante: il surplus c'è (Fuel Surcharge), la riga standard no.";
  verifica('nel file del canale l\'anomalia di ALFA e\' la descrizione seguita dall\'avviso, una riga per ambito (verso BETA e verso DELTA)',
    anomalie.filter(r => r && r[0] === AN_ALFA).length === 2, J(anomalie.map(r => r && r[0])));
  verifica('...e quella di DELTA, dello stoccaggio, col nome del suo accordo',
    anomalie.some(r => r && r[0] === "Impianto/stoccaggio senza tariffa CONFERIMENTO_STOCCAGGIO: DELTA STOCCAGGI. Tariffa del mese mancante: il surplus c'è (Accordo stoccaggi), la riga standard no."), J(anomalie.map(r => r && r[0])));
  const righe0 = righePassiva(PR0);
  const anomalie0 = righe0.slice(righe0.findIndex(r => r && r[0] === 'ANOMALIE DA GUARDARE PRIMA DI PAGARE') + 1);
  verifica('senza surplus le anomalie del file sono le descrizioni di sempre, parola per parola',
    anomalie0.length === PR0.anomalie.length && anomalie0.every((r, i) => r[0] === PR0.anomalie[i].descrizione), J(anomalie0.map(r => r && r[0])));
  const NOTA = 'Surplus sulle stesse tonnellate del mese: non si sommano una seconda volta';
  const notaSurplusDopo = (rr, fornitore) => {
    const i = rr.findIndex(r => r && r[0] === fornitore);
    const j = rr.findIndex((r, k) => k > i && r && /^ {3}Fuel Surcharge/.test(String(r[0])));
    return j > i ? rr[j][6] : 'manca';
  };
  verifica('la riga del surplus di ALFA, nel file del canale: l\'avviso in testa alla nota',
    notaSurplusDopo(righe, 'ALFA SRL') === `${AVVISO} ${NOTA}`, notaSurplusDopo(righe, 'ALFA SRL'));
  verifica('...quella di GAMMA dice le 2,00 t delle 6,00 (nel calcolo la riga standard di Salerno e\' a zero)',
    notaSurplusDopo(righe, 'GAMMA SRL') === `Tariffa del mese mancante su 2,00 t delle 6,00: il surplus c'è, la riga standard no. ${NOTA}`, notaSurplusDopo(righe, 'GAMMA SRL'));
  verifica('...e quella di GREEN TYRE, che la tariffa ce l\'ha, la nota di sempre',
    notaSurplusDopo(righe, 'GREEN TYRE PROJECT SRL') === 'surplus sulle stesse tonnellate del mese: non si sommano una seconda volta', notaSurplusDopo(righe, 'GREEN TYRE PROJECT SRL'));
  // il PDF del canale: le anomalie nelle note, con l'avviso
  let opzioniPdf = null;
  globalThis.__PDF_PASSIVA_TM = { esportaSezioniPdf: async (o) => { opzioniPdf = o; } };
  const { exportFatturazionePassivaPdf } = await caricaLibPagine('lib/passivaExport', [
    ["const { esportaSezioniPdf } = await import('@/lib/esportaTabella');", 'const { esportaSezioniPdf } = globalThis.__PDF_PASSIVA_TM;'],
  ]);
  await exportFatturazionePassivaPdf(PR, { stato: null });
  verifica('nel PDF del canale le note dicono l\'anomalia di ALFA con l\'avviso', !!opzioniPdf && (opzioniPdf.note || []).filter(n => n === AN_ALFA).length === 2, J(opzioniPdf && opzioniPdf.note));
  await exportFatturazionePassivaPdf(PR0, { stato: null });
  verifica('...e senza surplus le note sono le descrizioni di sempre', !!opzioniPdf && J(opzioniPdf.note) === J(PR0.anomalie.map(a => a.descrizione)), J(opzioniPdf && opzioniPdf.note));
});

await sezione('4. LA PAGINA: LA TABELLA DEI RACCOGLITORI E LA FASCIA DEL MESE, DISEGNATE', async () => {
  const ESTENSIONI = ['', '.js', '.jsx', '.ts'];
  const daAlias = (p) => { const base = qui('../src/' + p.slice(2)); return ESTENSIONI.map(e => base + e).find(x => existsSync(x) && /\.\w+$/.test(x)) || base; };
  const INGRESSO = `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import PassivaRaccoglitoriTable from ${J(qui('../src/components/fatturazione/PassivaRaccoglitoriTable.jsx'))};
import * as S from ${J(qui('../src/components/fatturazione/PassivaSurplus.jsx'))};
const C = { PassivaRaccoglitoriTable, FasceSurplus: S.FasceSurplus, AvvisoSurplus: S.AvvisoSurplus };
export const disegna = (nome, props) => (C[nome] ? renderToStaticMarkup(React.createElement(C[nome], props)) : '');
`;
  const pacchetto = await build({
    stdin: { contents: INGRESSO, resolveDir: qui('.'), loader: 'js' },
    bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent',
    loader: { '.jsx': 'jsx', '.js': 'jsx' },
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'alias', setup(b) { b.onResolve({ filter: /^@\// }, (args) => ({ path: daAlias(args.path) })); } }],
  });
  const L = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
  const piano = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ');
  const html = L.disegna('PassivaRaccoglitoriTable', { data: PR.raccoglitori });
  const t = piano(html);
  verifica('la riga del surplus di ALFA: 65,00, «sulle stesse tonnellate del mese» e l\'avviso, prima del totale di ALFA',
    /\(13,00\) — 5,00 €\/t 65,00 sulle stesse tonnellate del mese Tariffa del mese mancante: il surplus c'è, la riga standard no\. Totale ALFA SRL/.test(t), t.slice(0, 900));
  verifica('...l\'avviso nel colore dei problemi della pagina, non nell\'indaco del surplus', /<span class="block text-xs font-medium text-destructive">Tariffa del mese mancante/.test(html), '');
  verifica('GAMMA: «su 2,00 t delle 6,00»', /Tariffa del mese mancante su 2,00 t delle 6,00: il surplus c'è, la riga standard no\. Totale GAMMA SRL/.test(t), t);
  verifica('GREEN TYRE, con la tariffa: la riga del surplus senza avviso', /\(1,00\) — 5,00 €\/t 5,00 sulle stesse tonnellate del mese Totale GREEN TYRE/.test(t), t);
  const t0 = piano(L.disegna('PassivaRaccoglitoriTable', { data: PR0.raccoglitori }));
  verifica('senza surplus la tabella non parla di surplus ne\' di avvisi', !/Surplus|mancante/.test(t0), t0.slice(0, 300));
  const tf = piano(L.disegna('FasceSurplus', { surplus: PR.surplus_del_mese }));
  verifica('la fascia del Fuel Surcharge: «ALFA SRL, tariffa del mese mancante: il surplus c\'è, la riga standard no.» e GAMMA',
    /ALFA SRL, tariffa del mese mancante: il surplus c'è, la riga standard no\./.test(tf) && /GAMMA SRL, tariffa del mese mancante su 2,00 t delle 6,00: il surplus c'è, la riga standard no\./.test(tf), tf);
  verifica('...e quella dell\'accordo sugli stoccaggi: DELTA', /DELTA STOCCAGGI, tariffa del mese mancante: il surplus c'è, la riga standard no\./.test(tf), tf);
  verifica('l\'avviso vuoto non disegna niente', L.disegna('AvvisoSurplus', { s: { nome: 'Fuel Surcharge' } }) === '');
  // L'elenco delle anomalie della pagina (chiusura del giro, 13/10/2026): sotto
  // la descrizione l'avviso del surplus, nel colore dei problemi. Prima la
  // pagina diceva la sola descrizione. L'elenco si apre col suo pulsante: qui
  // gira davvero, col React finto di prove/dati/paginaFinta.mjs.
  const { caricaPagina, aspetta, trova, testo } = await import('./dati/paginaFinta.mjs');
  const { Componente: Anomalie, monta } = await caricaPagina('components/fatturazione/PassivaAnomalie.jsx');
  const apriElenco = async (anomalie) => {
    const r = monta(Anomalie, { anomalie });
    const bottone = trova(r.albero, 'button')[0];
    if (bottone) bottone.props.onClick();
    await aspetta();
    return r.albero;
  };
  const elenco = await apriElenco(PR.anomalie);
  const voci = trova(elenco, el => el.type === 'div' && /rounded px-3/.test(String(el.props.className || ''))).map(el => testo(el).replace(/\s+/g, ' ').trim());
  verifica('l\'elenco delle anomalie: ALFA, la descrizione e sotto «Tariffa del mese mancante: il surplus c\'è (Fuel Surcharge), la riga standard no.»',
    voci.filter(v => v.includes('— Raccoglitore senza tariffa RACCOLTA: ALFA SRL') && v.includes("Tariffa del mese mancante: il surplus c'è (Fuel Surcharge), la riga standard no.")).length === 2, J(voci));
  const avvisi = trova(elenco, el => el.type === 'span' && /text-destructive/.test(String(el.props.className || '')));
  verifica('...l\'avviso nel colore dei problemi, su una riga sua, uno per anomalia col surplus (4)',
    avvisi.length === 4 && avvisi.every(el => /\bblock\b/.test(el.props.className) && /^Tariffa del mese mancante/.test(testo(el))), J(avvisi.map(el => [el.props.className, testo(el)])));
  const elenco0 = await apriElenco(PR0.anomalie);
  const voci0 = trova(elenco0, el => el.type === 'div' && /rounded px-3/.test(String(el.props.className || ''))).map(el => testo(el));
  verifica('senza surplus l\'elenco non dice avvisi', voci0.length === PR0.anomalie.length && !voci0.some(v => /mancante/.test(v)), J(voci0));
});

await sezione('5. SUI DATI VERI: NESSUN RACCOGLITORE PAGATO SENZA TARIFFA, I NUMERI DI SEMPRE', async () => {
  const CARTELLA = process.env.DATI_VERI || qui('../../dati-veri/');
  const copie = existsSync(CARTELLA) ? readdirSync(CARTELLA).filter(n => /^treadrider-dati-veri-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n)).sort() : [];
  if (!copie.length) { console.log(`  Nessuna copia dei dati veri in ${CARTELLA}: questa parte si salta.`); return; }
  const A = JSON.parse(gunzipSync(readFileSync(CARTELLA + copie[copie.length - 1])).toString('utf8')).archivi;
  const veri = {
    primarieRete: A.PrimariaRete || [], primarieAci: A.PrimariaAci || [], secondarieAll: A.Secondaria || [], extraRaccoltaAll: A.ExtraRaccolta || [],
    tariffeAll: (A.Tariffa || []).filter(t => String(t.direzione || 'PASSIVA') === 'PASSIVA'),
    fornitoriAll: (A.Fornitore || []).filter(x => x.stato === 'attivo'),
  };
  const tre = ['RETE', 'ACI', 'EXTRA_RACCOLTA'];
  const fsSet = tre.map(c => surplus('fs-set-' + c, { tipologia: c, data_inizio_validita: '2026-09-01', data_fine_validita: '2026-09-30' }));
  const fsVero = tre.map(c => surplus('fs-' + c, { tipologia: c }));
  for (const [mese, i, s] of [['Settembre', 8, fsSet], ['Ottobre', 9, fsVero]]) {
    for (const c of tre) {
      const con = calcolaPassivaMese({ ...veri, surplusAll: s }, 2026, i, mese, c);
      const senza = calcolaPassivaMese({ ...veri, surplusAll: [] }, 2026, i, mese, c);
      const avvisi = JSON.stringify(con).match(/"avviso"|"avviso_surplus"|"senza_tariffa"/g) || [];
      verifica(`${mese} ${c}: nessun fornitore pagato col surplus senza la tariffa del mese`, avvisi.length === 0, `${avvisi.length} avvisi`);
      verifica(`${mese} ${c}: le anomalie sono quelle senza surplus, parola per parola e campo per campo`, J(con.anomalie) === J(senza.anomalie), '');
      verifica(`${mese} ${c}: lo standard col surplus e\' il totale senza surplus`, con.totali.standard.totale === senza.totali.totale_complessivo, J([con.totali.standard, senza.totali.totale_complessivo]));
    }
  }
  const reteSet = calcolaPassivaMese({ ...veri, surplusAll: fsSet }, 2026, 8, 'Settembre', 'RETE');
  if (copie[copie.length - 1] === 'treadrider-dati-veri-2026-10-11.json.gz') {
    verifica('settembre, rete, col Fuel Surcharge simulato: 4.332,80 € ai raccoglitori, come nel progetto', reteSet.totali.surplus.raccoglitori === 4332.8, J(reteSet.totali.surplus));
  }
});

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
