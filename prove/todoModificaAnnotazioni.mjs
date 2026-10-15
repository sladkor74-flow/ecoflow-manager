// LA TO-DO LIST: LE ATTIVITA' E LE RICHIESTE ECT APERTE SI MODIFICANO E SI
// ANNOTANO (15/10/2026).
//
// Richiesta dell'utente, testuale: «nella to-do list permetti la modifica delle
// richieste aperte per successive integrazioni e\o annotazioni». Fino a quel
// giorno un'attivita' si scriveva col modulo «Nuovo To-Do» e poi si poteva solo
// spuntare, cambiare di stato, eliminare e correggere negli ordini; una
// richiesta ECT aveva solo l'ID ordine da correggere. Qui si prova:
//
// 1. le annotazioni (src/lib/annotazioni.js): si accodano senza toccare le
//    altre, col giorno e l'ora italiani e l'email di chi scrive; una correzione
//    lo dice e il testo di prima resta; le ultime due e «tutte (N)»; la scrittura
//    rilegge il record appena prima e non toglie mai una riga;
// 2. la modifica (src/lib/todoSezioni.js): il modulo si apre compilato, si
//    scrivono solo i campi cambiati, campo per campo; gli ordini cambiati con un
//    ordine gia' terminato o cancellato non chiudono niente e la riga lo dice
//    (la regola di base44/shared/todoOrdini.ts, come alla creazione); su
//    un'attivita' chiusa dal gestionale e riaperta, ordini DIVERSI si guardano
//    come su una nuova e la chiusura di prima resta in un'annotazione
//    (revisione del 15/10/2026);
// 3. il banco, con le funzioni vere: le annotazioni e la nota interna restano
//    quando l'attivita' si chiude da sola (controllaTodoOrdini: completata,
//    cancellata dal portale, evasa in parte), quando si ricarica il foglio
//    Richieste ECT (importaRichiesteEct) e al ricalcolo dei ritiri dopo le
//    primarie (importaBlocco, ritiri_ect). Una funzione cambiata apposta perche'
//    le perda fa fallire il controllo: la prova se ne accorgerebbe;
// 4. gli archivi: il campo `annotazioni` nello schema di Todo e RichiestaEct, e
//    la regola che lascia scrivere solo l'amministratore;
// 5. la pagina vera (src/pages/TodoPage.jsx) montata senza browser, per
//    l'amministratore e per chi non lo e', e la scheda delle richieste; una
//    rilettura non toglie l'elenco, ne' il modulo aperto (revisione del 15/10/2026);
// 6. i componenti nuovi usati come li usa chi lavora (aggiungi, correggi, nota
//    interna, modulo di modifica), e disegnati con React: le annotazioni anche
//    sulle completate, le cancellate e le richieste completate, a 375 px.
// L'orologio e' fermo al 15/10/2026. node prove/todoModificaAnnotazioni.mjs
import { build } from 'esbuild';
import { existsSync, readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { caricaPagina, clienteFinto, aspetta, trova, testo as testoAlbero, nomeDi } from './dati/paginaFinta.mjs';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
const require = createRequire(import.meta.url);

const ADESSO = Date.parse('2026-10-15T08:00:00Z');
const DataVera = Date;
class DataFissa extends DataVera {
  constructor(...a) { super(...(a.length ? a : [ADESSO])); }
  static now() { return ADESSO; }
}
globalThis.Date = DataFissa;

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
// Col codice di prima i moduli nuovi non ci sono: la prova lo dice, non si ferma.
const prova = async (nome, fn) => { try { await fn(); } catch (e) { verifica(nome, false, String(e && e.message).slice(0, 300)); } };
// I file sono CRLF: i \r si tolgono prima di cercare nel sorgente.
const sorgente = (p) => (existsSync(qui('../' + p)) ? readFileSync(qui('../' + p), 'utf8').replace(/\r/g, '') : '');

let A = null;
try { A = await import('../src/lib/annotazioni.js'); } catch (e) { verifica('il modulo delle annotazioni (src/lib/annotazioni.js) si carica', false, String(e && e.message).slice(0, 200)); }
const S = await import('../src/lib/todoSezioni.js');
const T = await import('../base44/shared/todoOrdini.ts');
const OGGI = '2026-10-15';
const ADMIN = 'admin@smoco.it';

// Gli ordini: 101 cancellato a portale, 102 cancellato, 103 terminato il 09/10
// (fine trasporto), 104 ancora assegnato.
const MOVIMENTI = [
  { id_ordine: 'ET26000101', stato: 'cancellato', motivo_cancellazione: 'altro: pdr doppio', ordine_immesso_il: '2026-09-01T07:00:00Z', punto_di_raccolta: 'ROSSI GOMME' },
  { id_ordine: 'ET26000102', stato: 'cancellato', motivo_cancellazione: 'Ordine doppio' },
  { id_ordine: 'ET26000103', stato: 'terminato', ordine_immesso_il: '2026-09-03T07:00:00Z', trasporto_iniziato_il: '2026-10-08T07:00:00Z', trasporto_finito_il: '2026-10-09T08:00:00Z', ordine_chiuso_il: '2026-10-14T08:00:00Z', punto_di_raccolta: 'VERDI AUTO' },
];
const ASSEGNATI = [
  { id_ordine: 'ET26000104', stato: 'assegnato', ordine_immesso_il: '2026-09-02T07:00:00Z', punto_di_raccolta: 'BIANCHI PNEUMATICI' },
];

// Tre annotazioni: la seconda corretta da un altro.
const NOTE = () => [
  { id: 'n1', testo: 'Chiamato il produttore', scritta_il: '2026-10-10T07:15:00Z', scritta_da: ADMIN },
  { id: 'n2', testo: 'Risponde entro venerdì', scritta_il: '2026-10-12T15:40:00Z', scritta_da: ADMIN, corretta_il: '2026-10-13T08:05:00Z', corretta_da: 'altro@smoco.it', testo_originale: 'Risponde entro giovedì' },
  { id: 'n3', testo: 'Sollecitato via mail', scritta_il: '2026-10-14T09:00:00Z', scritta_da: ADMIN },
];

// ---------------------------------------------------------------------------
console.log('1. LE ANNOTAZIONI (src/lib/annotazioni.js)');

await prova('accodare', () => {
  const t1 = new Date('2026-10-15T08:30:00Z'); // 10:30 italiane, ora legale
  const t2 = new Date('2026-12-01T23:30:00Z'); // 00:30 del 02/12, ora solare
  const prima = [{ id: 'x1', testo: 'Prima', scritta_il: '2026-10-14T07:00:00Z', scritta_da: ADMIN }];
  const dopo = A.accodaAnnotazione(prima, '  Sollecitato al telefono\r\nrisponde venerdì  ', ADMIN, t1);
  verifica('si accoda in fondo, e la riga di prima resta la stessa', dopo.length === 2 && dopo[0] === prima[0] && prima.length === 1, J(dopo));
  const n = dopo[1];
  verifica('la nuova porta il testo, l\'istante e l\'email di chi scrive', n.testo === 'Sollecitato al telefono\nrisponde venerdì' && n.scritta_il === '2026-10-15T08:30:00.000Z' && n.scritta_da === ADMIN && !!n.id, J(n));
  verifica('un testo vuoto non accoda niente', A.accodaAnnotazione(prima, '  \r\n ', ADMIN, t1) === null);
  verifica('due righe scritte nello stesso istante hanno due id diversi', A.nuovaAnnotazione('a', ADMIN, t1).id !== A.nuovaAnnotazione('b', ADMIN, t1).id);
  verifica('giorno e ora italiani, d\'estate e d\'inverno', A.quandoItaliano(t1.toISOString()) === '15/10/2026 alle 10:30' && A.quandoItaliano(t2.toISOString()) === '02/12/2026 alle 00:30',
    `${A.quandoItaliano(t1.toISOString())} | ${A.quandoItaliano(t2.toISOString())}`);
  verifica('un istante che non c\'e\' non diventa un giorno', A.quandoItaliano('') === '' && A.quandoItaliano('boh') === '' && A.vediAnnotazione({ testo: 'x' }).quando === 'giorno non registrato');
  verifica('un record senza annotazioni (scritto prima del 15/10/2026) ne ha zero', A.annotazioniSalvate({ id: 'v' }).length === 0 && A.annotazioniSalvate({ annotazioni: 'x' }).length === 0);
});

await prova('correggere', () => {
  const elenco = NOTE();
  const t3 = new Date('2026-10-15T09:00:00Z');
  const c1 = A.correggiAnnotazione(elenco, 'n3', 'Sollecitato via mail e al telefono', ADMIN, t3);
  verifica('si cambia solo la riga corretta: le altre sono le stesse', c1[0] === elenco[0] && c1[1] === elenco[1] && c1[2].testo === 'Sollecitato via mail e al telefono' && c1.length === 3);
  verifica('la correzione lo dice, e il testo di prima resta', c1[2].corretta_il === '2026-10-15T09:00:00.000Z' && c1[2].corretta_da === ADMIN && c1[2].testo_originale === 'Sollecitato via mail'
    && c1[2].scritta_il === elenco[2].scritta_il && c1[2].scritta_da === ADMIN, J(c1[2]));
  const c2 = A.correggiAnnotazione(c1, 'n3', 'Terza versione', 'altro@smoco.it', new Date('2026-10-15T10:10:00Z'));
  verifica('dopo due correzioni il testo originale e\' quello scritto la prima volta', c2[2].testo_originale === 'Sollecitato via mail' && c2[2].testo === 'Terza versione');
  const v = A.vediAnnotazione(c2[2]);
  verifica('a video «corretta il gg/mm/aaaa alle hh:mm», e da chi se non e\' chi l\'aveva scritta', v.correzione === 'corretta il 15/10/2026 alle 12:10 da altro@smoco.it' && v.prima === 'Sollecitato via mail', J(v));
  verifica('chi corregge la sua non si ripete', A.vediAnnotazione(c1[2]).correzione === 'corretta il 15/10/2026 alle 11:00', A.vediAnnotazione(c1[2]).correzione);
  verifica('una correzione vuota non cancella, una uguale non scrive, una riga che non c\'e\' niente',
    A.correggiAnnotazione(elenco, 'n1', '   ', ADMIN) === null && A.correggiAnnotazione(elenco, 'n1', 'Chiamato il produttore', ADMIN) === null && A.correggiAnnotazione(elenco, 'zz', 'x', ADMIN) === null);
  verifica('in una riga sola, per un riepilogo', A.testoAnnotazione(elenco[1]) === '12/10/2026 alle 17:40, admin@smoco.it: Risponde entro venerdì (corretta il 13/10/2026 alle 10:05 da altro@smoco.it)', A.testoAnnotazione(elenco[1]));
});

await prova('in ordine di tempo, le ultime due', () => {
  const [a, b, c] = NOTE();
  const ordinate = A.inOrdineDiTempo([c, a, b]).map(x => x.id).join(',');
  verifica('in ordine di tempo, la piu\' vecchia prima', ordinate === 'n1,n2,n3', ordinate);
  const u = A.ultime([c, a, b]);
  verifica('se ne mostrano le ultime due, e quante restano fuori', u.visibili.map(x => x.id).join(',') === 'n2,n3' && u.nascoste === 1 && u.tutte === 3, J(u));
  const senza = A.inOrdineDiTempo([{ id: 's1', testo: 'x' }, a, { id: 's2', testo: 'y' }]).map(x => x.id).join(',');
  verifica('senza istante vale l\'ordine in cui sono salvate', senza === 's1,n1,s2', senza);
});

await prova('la scrittura rilegge il record e non perde niente', async () => {
  const [a1, a2] = NOTE();
  const rec = { id: 'r', titolo: 'x', annotazioni: [a1] };
  const archivio = {
    letture: 0, scritte: [],
    get: async () => { archivio.letture++; return JSON.parse(J(rec)); },
    update: async (_id, d) => { archivio.scritte.push(JSON.parse(J(d))); Object.assign(rec, d); return rec; },
  };
  // La pagina aveva letto il record con una riga sola; un'altra scheda ne ha scritta una seconda.
  rec.annotazioni = [a1, a2];
  const e = await A.scriviAnnotazioni(archivio, 'r', (prima) => A.accodaAnnotazione(prima, 'Terza', ADMIN, new Date('2026-10-15T08:00:00Z')));
  verifica('una lettura e una scrittura, del solo campo delle annotazioni', archivio.letture === 1 && archivio.scritte.length === 1 && J(Object.keys(archivio.scritte[0])) === '["annotazioni"]', J(archivio.scritte));
  verifica('la riga scritta dall\'altra scheda resta, e la nuova va in fondo', e.scritto && rec.annotazioni.map(x => x.id).join(',').startsWith('n1,n2,') && rec.annotazioni.length === 3 && rec.annotazioni[2].testo === 'Terza', J(rec.annotazioni));
  let errore = '';
  try { await A.scriviAnnotazioni(archivio, 'r', (prima) => prima.slice(1)); } catch (x) { errore = x.message; }
  verifica('un elenco che perderebbe una riga non si scrive', /andrebbe persa/.test(errore) && archivio.scritte.length === 1, errore);
  const niente = await A.scriviAnnotazioni(archivio, 'r', () => null);
  verifica('niente da scrivere, nessuna scrittura', niente.scritto === false && archivio.scritte.length === 1);
  const vecchio = { id: 'v', titolo: 'senza' };
  const arch2 = { get: async () => ({ ...vecchio }), update: async (_id, d) => Object.assign(vecchio, d) };
  await A.scriviAnnotazioni(arch2, 'v', (prima) => A.accodaAnnotazione(prima, 'La prima', ADMIN));
  verifica('su un record di prima del 15/10/2026 la prima annotazione apre l\'elenco', Array.isArray(vecchio.annotazioni) && vecchio.annotazioni.length === 1, J(vecchio));
});

await prova('con altri campi, in una scrittura sola', async () => {
  // Gli ordini nuovi di un'attivita' riaperta e la riga che ricorda la chiusura
  // di prima (revisione del 15/10/2026): arrivano insieme, o non arriva niente.
  const [a1] = NOTE();
  const rec = { id: 'r', annotazioni: [a1], riferimento_ordine: 'ET26000101', chiusa_dal_gestionale: true };
  const scritte = [];
  const archivio = { get: async () => JSON.parse(J(rec)), update: async (_id, d) => { scritte.push(JSON.parse(J(d))); Object.assign(rec, d); return rec; } };
  const e = await A.scriviAnnotazioni(archivio, 'r', (prima) => A.accodaAnnotazione(prima, 'Ordini cambiati', ADMIN), { riferimento_ordine: 'ET26000200', chiusa_dal_gestionale: false });
  verifica('una scrittura sola, coi campi e con le annotazioni', e.scritto && scritte.length === 1 && J(Object.keys(scritte[0])) === J(['riferimento_ordine', 'chiusa_dal_gestionale', 'annotazioni'])
    && scritte[0].annotazioni.length === 2 && scritte[0].annotazioni[0].id === 'n1' && rec.chiusa_dal_gestionale === false, J(scritte));
  let errore = '';
  try { await A.scriviAnnotazioni(archivio, 'r', () => [], { titolo: 'non deve arrivare' }); } catch (x) { errore = x.message; }
  verifica('se un\'annotazione andrebbe persa non si scrivono nemmeno gli altri campi', /andrebbe persa/.test(errore) && scritte.length === 1 && !('titolo' in rec), errore);
  await A.scriviAnnotazioni(archivio, 'r', () => null, { priorita: 'alta' });
  verifica('niente da accodare: gli altri campi si scrivono da soli', scritte.length === 2 && J(scritte[1]) === J({ priorita: 'alta' }), J(scritte));
});

// ---------------------------------------------------------------------------
console.log('2. LA MODIFICA DI UN\'ATTIVITA\' APERTA (src/lib/todoSezioni.js)');

const BASE = {
  id: 't1', titolo: 'Sollecito Rossi', descrizione: 'Chiamare il\nproduttore', categoria: 'Sollecito', priorita: 'media', data_scadenza: '2026-10-20',
  riferimento_ordine: 'ET26000104', stato: 'in_corso', data_ricezione: '2026-10-01', annotazioni: NOTE(),
  ordini_attesi: 'ET26000104', ordini_da_attendere: 'ET26000104', ordini_totali: 1, ordini_terminati: 0,
};
const CAMPI_DEL_MODULO = ['titolo', 'descrizione', 'categoria', 'priorita', 'data_scadenza', 'riferimento_ordine'];
const modifica = (t, cambi) => S.campiModificaAttivita(t, { ...S.valoriDelModulo(t), ...cambi }, T.ordiniAttivita);

await prova('il modulo compilato e i campi cambiati', () => {
  const v0 = S.valoriDelModulo(BASE);
  verifica('il modulo si apre coi valori dell\'attivita\'', J(v0) === J({ titolo: 'Sollecito Rossi', descrizione: 'Chiamare il\nproduttore', categoria: 'Sollecito', priorita: 'media', data_scadenza: '2026-10-20', riferimento_ordine: 'ET26000104' }), J(v0));
  verifica('una scadenza salvata come istante si apre come giorno', S.valoriDelModulo({ data_scadenza: '2026-10-20T00:00:00.000Z' }).data_scadenza === '2026-10-20');
  verifica('aperto e salvato senza toccare niente non scrive niente', J(S.campiModificaAttivita(BASE, v0, T.ordiniAttivita)) === '{}');
  const casi = [
    ['il titolo', { titolo: '  Sollecito   Rossi, secondo giro ' }, { titolo: 'Sollecito Rossi, secondo giro' }],
    ['la descrizione, a capo compresi', { descrizione: 'Chiamare il\r\nproduttore e il trasportatore\r\n' }, { descrizione: 'Chiamare il\nproduttore e il trasportatore' }],
    ['la categoria', { categoria: 'Pratica' }, { categoria: 'Pratica' }],
    ['la priorita\'', { priorita: 'urgente' }, { priorita: 'urgente' }],
    ['la scadenza', { data_scadenza: '2026-10-31' }, { data_scadenza: '2026-10-31' }],
    ['la scadenza tolta (null, non un giorno vuoto)', { data_scadenza: '' }, { data_scadenza: null }],
    ['gli ordini: un elenco di ID si scrive in maiuscolo separato da virgole', { riferimento_ordine: 'et26000104 et26000103' }, { riferimento_ordine: 'ET26000104, ET26000103' }],
    ['gli ordini: una frase resta com\'e\' scritta', { riferimento_ordine: 'da chiedere a  Ecotyre' }, { riferimento_ordine: 'da chiedere a Ecotyre' }],
  ];
  for (const [nome, cambi, atteso] of casi) {
    const c = modifica(BASE, cambi);
    verifica(`si scrive ${nome}, e nient'altro`, J(c) === J(atteso), J(c));
  }
  verifica('solo spazi in piu\' non sono una modifica', J(modifica(BASE, { titolo: 'Sollecito Rossi ', categoria: ' Sollecito' })) === '{}');
  verifica('il titolo vuoto non si salva (e\' obbligatorio, come alla creazione)', modifica(BASE, { titolo: '   ' }) === null);
  const tutto = modifica(BASE, { titolo: 'A', descrizione: 'B', categoria: 'C', priorita: 'alta', data_scadenza: '2026-11-02', riferimento_ordine: 'ET26000103' });
  verifica('cambiando tutto si scrivono i sei campi del modulo e basta: mai lo stato, la chiusura, la spunta, gli ordini attesi o le annotazioni',
    J(Object.keys(tutto).sort()) === J([...CAMPI_DEL_MODULO].sort()), J(Object.keys(tutto)));
  const frase = { ...BASE, riferimento_ordine: 'da chiedere a Ecotyre' };
  verifica('una vecchia frase negli ordini, non toccata, non si riscrive come ID («DA, CHIEDERE, A, ECOTYRE»)', !('riferimento_ordine' in modifica(frase, { titolo: 'Nuovo' })));
});

await prova('gli ordini cambiati con un ordine gia\' terminato o cancellato', () => {
  const stato = T.statoOrdini(MOVIMENTI, ASSEGNATI);
  // L'attivita' guardava il 104, ancora assegnato. La modifica lo cambia col 103,
  // gia' terminato: il controllo ricomincia a guardare e non chiude niente.
  const t = { ...BASE, ...modifica(BASE, { riferimento_ordine: 'ET26000103' }) };
  const g = T.controlloAttivita(t, stato, OGGI);
  verifica('l\'ordine gia\' terminato non chiude l\'attivita\'', !g.chiusa && !('stato' in g.campi) && T.ordiniAttivita({ riferimento_ordine: g.campi.ordini_attesi }).join() === 'ET26000103' && String(g.campi.ordini_da_attendere) === '', J(g.campi));
  const dopo = { ...t, ...g.campi };
  verifica('e la riga lo dice: l\'ordine risultava gia\' terminato, la spunta la metti tu', /risultava già terminato/.test(T.notaOrdini(dopo)), T.notaOrdini(dopo));
  verifica('nemmeno al controllo dopo si chiude da sola', !T.controlloAttivita(dopo, stato, OGGI).chiusa);
  const tc = { ...BASE, ...modifica(BASE, { riferimento_ordine: 'ET26000102' }) };
  const gc = T.controlloAttivita(tc, stato, OGGI);
  verifica('un ordine gia\' cancellato non la manda fra le cancellate, e l\'avviso dice perche\'', !gc.chiusa && /non passa da sola fra le cancellate/.test(gc.campi.avviso_ordini || ''), J(gc.campi));
});

// La revisione del 15/10/2026: il modulo prometteva che, cambiati gli ordini, il
// gestionale li avrebbe guardati «come per un'attivita' nuova», ma su
// un'attivita' che il gestionale aveva chiuso e che era stata riaperta non era
// vero (chiusa_dal_gestionale restava, e il passaggio si consumava senza
// chiudere). Lo script del revisore (riapertaNonRiparte.mjs) e' la base.
const NOTA_CHIUSURA = 'cancellata dal gestionale il 14/10/2026: l\'ordine ET26000101 (Pdr doppio) risulta cancellato a portale';
await prova('la riaperta dopo una chiusura del gestionale, con ordini nuovi', () => {
  // Il portale cancella ET26000101 e il gestionale manda l'attivita' fra le
  // cancellate; l'amministratore la riapre (Riapri) e con Modifica scrive
  // l'ordine rifatto, ET26000200.
  const cancellata = { ...BASE, id: 'rc', stato: 'cancellato', riferimento_ordine: 'ET26000101', ordini_attesi: 'ET26000101', ordini_da_attendere: '', ordini_totali: 1, ordini_terminati: 0,
    chiusa_dal_gestionale: true, chiusa_dal_gestionale_il: '2026-10-14', chiusura_nota: NOTA_CHIUSURA };
  const riaperta = { ...cancellata, ...S.campiCambioStato(cancellata, 'aperto', OGGI) };
  verifica('Riapri lascia il segno della chiusura: con gli stessi ordini non si richiude', riaperta.stato === 'aperto' && riaperta.chiusa_dal_gestionale === true);
  const campi = modifica(riaperta, { riferimento_ordine: 'et26000200' });
  verifica('ordini diversi: si scrivono, e il segno della chiusura si toglie', J(campi) === J({ riferimento_ordine: 'ET26000200', chiusa_dal_gestionale: false }), J(campi));
  let t = { ...riaperta, ...campi };
  const assegnato = T.statoOrdini([], [{ id_ordine: 'ET26000200', stato: 'assegnato' }]);
  const g1 = T.controlloAttivita(t, assegnato, OGGI);
  t = { ...t, ...g1.campi };
  verifica('il primo controllo guarda il nuovo ordine e non chiude', !g1.chiusa && t.ordini_attesi === 'ET26000200' && t.ordini_da_attendere === 'ET26000200', J(g1.campi));
  const terminato = T.statoOrdini([{ id_ordine: 'ET26000200', stato: 'terminato', trasporto_iniziato_il: '2026-10-16T07:00:00Z', trasporto_finito_il: '2026-10-16T09:00:00Z' }], []);
  const g2 = T.controlloAttivita(t, terminato, '2026-10-17');
  verifica('al passaggio da assegnato a terminato si chiude da sola, come un\'attivita\' nuova', g2.chiusa && g2.come === 'completata' && g2.campi.stato === 'completato' && /ET26000200/.test(g2.campi.chiusura_nota || ''),
    `chiusa=${g2.chiusa}, ordini_da_attendere=${J(g2.campi.ordini_da_attendere)}`);
  const cancellatoAnche = T.statoOrdini([{ id_ordine: 'ET26000200', stato: 'cancellato', motivo_cancellazione: 'Ordine doppio' }], []);
  const g3 = T.controlloAttivita(t, cancellatoAnche, '2026-10-17');
  verifica('se il portale cancella anche l\'ordine rifatto, torna da sola fra le cancellate', g3.chiusa && g3.come === 'cancellata', J(g3.campi));
  verifica('la seconda chiusura riscrive la nota della prima: per questo la si copia in un\'annotazione', g2.campi.chiusura_nota !== NOTA_CHIUSURA);
  const testo = S.notaOrdiniNuovi(riaperta, campi.riferimento_ordine, T.ordiniAttivita);
  verifica('l\'annotazione dice gli ordini di prima e di adesso, e la chiusura di prima com\'era scritta', testo.startsWith('Ordini cambiati da ET26000101 a ET26000200.') && testo.includes(`(${NOTA_CHIUSURA})`), testo);
  verifica('senza la nota, col giorno della chiusura', S.notaOrdiniNuovi({ ...riaperta, chiusura_nota: '' }, 'ET26000200', T.ordiniAttivita).includes('chiusa una volta il 14/10/2026:'));
  // Un ordine gia' terminato scritto sulla riaperta: non chiude, e adesso la
  // riga lo dice (notaOrdini taceva col segno della chiusura).
  let tt = { ...riaperta, ...modifica(riaperta, { riferimento_ordine: 'ET26000103' }) };
  tt = { ...tt, ...T.controlloAttivita(tt, T.statoOrdini(MOVIMENTI, ASSEGNATI), OGGI).campi };
  verifica('un ordine gia\' terminato scritto su una riaperta non la chiude, e la riga lo dice', tt.stato === 'aperto' && /risultava già terminato/.test(T.notaOrdini(tt)), T.notaOrdini(tt));
  // Gli stessi ordini: la regola del 28/09 resta (chi riapre decide).
  const due = { ...riaperta, riferimento_ordine: 'ET26000101, ET26000102' };
  verifica('gli stessi ordini riscritti in un altro ordine: il segno resta', J(modifica(due, { riferimento_ordine: 'et26000102 et26000101' })) === J({ riferimento_ordine: 'ET26000102, ET26000101' }));
  verifica('ordini tolti, o una frase al posto degli ID: il segno resta', !('chiusa_dal_gestionale' in modifica(riaperta, { riferimento_ordine: '' })) && !('chiusa_dal_gestionale' in modifica(riaperta, { riferimento_ordine: 'da rifare a Ecotyre' })));
  verifica('cambiati gli altri campi e non gli ordini: il segno resta', J(modifica(riaperta, { titolo: 'Ritiro rifatto' })) === J({ titolo: 'Ritiro rifatto' }));
  verifica('mai su una completata o una cancellata (la casella degli ordini c\'e\' anche li\')', J(S.campiOrdiniNuovi(cancellata, 'ET26000200', T.ordiniAttivita)) === '{}'
    && J(S.campiOrdiniNuovi({ ...cancellata, stato: 'completato' }, 'ET26000200', T.ordiniAttivita)) === '{}');
  verifica('mai su un\'attivita\' che il gestionale non aveva chiuso', J(S.campiOrdiniNuovi(BASE, 'ET26000200', T.ordiniAttivita)) === '{}');
  verifica('la casella degli ordini sulla riga, con ordini diversi, fa lo stesso', J(S.campiOrdiniNuovi(riaperta, 'ET26000200', T.ordiniAttivita)) === J({ chiusa_dal_gestionale: false }));
});

// ---------------------------------------------------------------------------
console.log('3. IL BANCO: LE ANNOTAZIONI E LA NOTA INTERNA RESTANO');
const SDK_FINTO = `
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => (v && typeof v === 'object' && Array.isArray(v.$in) ? v.$in.includes(r[k]) : r[k] === v));
const ordina = (righe, ord) => {
  const campo = String(ord || 'id').replace(/^[-+]/, '') || 'id';
  const verso = String(ord || '').startsWith('-') ? -1 : 1;
  return [...righe].sort((a, b) => String(a[campo] ?? '').localeCompare(String(b[campo] ?? '')) * verso);
};
let progressivo = 0;
const copia = (x) => JSON.parse(JSON.stringify(x));
function entita(nome) {
  const righe = () => (globalThis.__ARCHIVI[nome] ||= []);
  return {
    filter: async (f, ord, quanti = 1e9, salta = 0) => ordina(righe().filter(r => soddisfa(r, f)), ord).slice(salta, salta + quanti).map(copia),
    list: async (ord, quanti = 1e9, salta = 0) => ordina(righe(), ord).slice(salta, salta + quanti).map(copia),
    get: async (id) => { const r = righe().find(x => x.id === id); if (!r) throw new Error('non trovato ' + id); return copia(r); },
    create: async (d) => { const r = { id: nome + '-' + (++progressivo), ...copia(d) }; righe().push(r); globalThis.__SCRITTI.push({ op: 'create', nome, d: copia(d) }); return copia(r); },
    bulkCreate: async (rr) => { for (const d of rr) righe().push({ id: nome + '-' + (++progressivo), ...copia(d) }); globalThis.__SCRITTI.push({ op: 'bulkCreate', nome, n: rr.length }); return rr; },
    update: async (id, d) => {
      const r = righe().find(x => x.id === id);
      if (!r) throw new Error('non trovato ' + id);
      Object.assign(r, copia(d));
      globalThis.__SCRITTI.push({ op: 'update', nome, id, d: copia(d) });
      return copia(r);
    },
    delete: async (id) => { const t = righe(); const i = t.findIndex(x => x.id === id); if (i >= 0) t.splice(i, 1); globalThis.__SCRITTI.push({ op: 'delete', nome, id }); return {}; },
  };
}
const entities = new Proxy({}, { get: (_t, nome) => entita(nome) });
const integrations = { Core: { CreateFileSignedUrl: async () => ({ signed_url: 'https://file.finto/richieste.xlsx' }) } };
const functions = { invoke: async () => ({ data: {} }) };
export function createClientFromRequest() {
  return { auth: { me: async () => globalThis.__UTENTE }, asServiceRole: { entities, integrations, functions }, entities, integrations, functions };
}`;
// La funzione vera; `cambia` (solo per la controprova qui sotto) ne cambia il
// sorgente prima di impacchettarla.
const impacchetta = async (nome, cambia = null) => {
  const file = qui(`../base44/functions/${nome}/entry.ts`);
  const ingresso = cambia
    ? { stdin: { contents: cambia(readFileSync(file, 'utf8')), resolveDir: dirname(file), loader: 'ts', sourcefile: 'entry.ts' } }
    : { entryPoints: [file] };
  const p = await build({
    ...ingresso,
    bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
    mainFields: ['module', 'main'],
    plugins: [{ name: 'finti', setup(b) {
      b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'finto' }));
      b.onLoad({ filter: /.*/, namespace: 'finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
      b.onResolve({ filter: /^npm:xlsx/ }, () => ({ path: qui('../node_modules/xlsx/xlsx.mjs') }));
    } }],
  });
  return import('data:text/javascript;base64,' + Buffer.from(p.outputFiles[0].text).toString('base64'));
};
const chiama = async (modulo, corpo = {}) => { const r = await modulo.default({ json: async () => corpo }); return { status: r.status, body: await r.json() }; };
const banco = (archivi) => {
  globalThis.__ARCHIVI = {
    Todo: [], RichiestaEct: [], PrimariaRete: [], PrimariaAci: [], ExtraRaccolta: [], Assegnato: [], AssegnatoAci: [], UploadLog: [], FileDaRimuovere: [], LivelloUtente: [],
    ...JSON.parse(J(archivi)),
  };
  globalThis.__SCRITTI = [];
  globalThis.__UTENTE = { role: 'admin', email: ADMIN, full_name: 'Amministratore' };
};
const record = (nome, id) => (globalThis.__ARCHIVI[nome] || []).find(x => x.id === id) || {};
// Le annotazioni e la nota interna come le aveva lasciate l'amministratore, e
// nessuna scrittura della funzione che le nomini.
const restano = (nome, attese) => Object.entries(attese).every(([id, a]) => J(record(nome, id).annotazioni) === J(a.annotazioni) && (a.note_interne === undefined || record(nome, id).note_interne === a.note_interne))
  && !globalThis.__SCRITTI.some(s => s.nome === nome && s.d && ('annotazioni' in s.d || 'note_interne' in s.d));
// La controprova: la stessa funzione, cambiata perche' scriva le annotazioni
// vuote insieme ai suoi campi. Il controllo deve accorgersene.
const perdeLeAnnotazioni = (riga, campi) => (src) => {
  if (!src.includes(riga)) throw new Error('riga non trovata: ' + riga);
  return src.replace(riga, riga.replace(campi, `{ ...${campi}, annotazioni: [], note_interne: '' }`));
};

const ATTIVITA = () => [
  // aspettava il 103, adesso terminato: completata
  { id: 'c1', titolo: 'Ritiro Verdi', stato: 'aperto', riferimento_ordine: 'ET26000103', ordini_attesi: 'ET26000103', ordini_da_attendere: 'ET26000103', annotazioni: NOTE() },
  // aspettava il 101, adesso cancellato a portale: fra le cancellate
  { id: 'c2', titolo: 'Ritiro Rossi', stato: 'in_corso', riferimento_ordine: 'ET26000101', ordini_attesi: 'ET26000101', ordini_da_attendere: 'ET26000101', annotazioni: NOTE().slice(0, 1) },
  // aspettava 103 e 101: evasa in parte
  { id: 'c3', titolo: 'Ritiri Verdi e Rossi', stato: 'aperto', riferimento_ordine: 'ET26000103, ET26000101', ordini_attesi: 'ET26000103, ET26000101', ordini_da_attendere: 'ET26000103, ET26000101', annotazioni: NOTE().slice(1) },
];
const ARCHIVI_ORDINI = { PrimariaRete: MOVIMENTI.map((m, i) => ({ id: 'p' + i, ...m })), Assegnato: ASSEGNATI.map((a, i) => ({ id: 'a' + i, ...a })) };

await prova('controllaTodoOrdini: le attivita\' che si chiudono da sole', async () => {
  const attese = Object.fromEntries(ATTIVITA().map(t => [t.id, { annotazioni: t.annotazioni }]));
  const modulo = await impacchetta('controllaTodoOrdini');
  banco({ Todo: ATTIVITA(), ...ARCHIVI_ORDINI });
  const r = await chiama(modulo);
  verifica('risponde 200', r.status === 200, `${r.status} ${J(r.body).slice(0, 300)}`);
  verifica('si chiudono davvero: completata, cancellata dal portale, evasa in parte',
    record('Todo', 'c1').stato === 'completato' && record('Todo', 'c2').stato === 'cancellato' && record('Todo', 'c3').stato === 'completato' && /evasa in parte/.test(record('Todo', 'c3').chiusura_nota || ''),
    J(globalThis.__ARCHIVI.Todo.map(t => [t.id, t.stato, t.chiusura_nota])));
  verifica('e le annotazioni restano tutte, come le aveva scritte l\'amministratore', restano('Todo', attese), J(globalThis.__SCRITTI));
  const mutante = await impacchetta('controllaTodoOrdini', perdeLeAnnotazioni('await svc.Todo.update(t.id, campi);', 'campi'));
  banco({ Todo: ATTIVITA(), ...ARCHIVI_ORDINI });
  await chiama(mutante);
  verifica('controprova: una chiusura che le riscrivesse vuote non passerebbe', !restano('Todo', attese));
});

await prova('importaRichiesteEct: il foglio ricaricato', async () => {
  const XLSX = require('../node_modules/xlsx');
  const d = (s) => new Date(s + 'T00:00:00');
  const foglio = (righe) => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(righe, { cellDates: true }), 'Richieste ECT');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  };
  const INTESTAZIONE = [['RICHIESTA ECT', 'provincia', 'DATE', null, 'trasportatore', 'mail inviata il', null], [null, null, 'ordine immesso', 'ordine evaso', null, null, null]];
  const primo = foglio([...INTESTAZIONE,
    ['ROSSI GOMME', 'BA', d('2026-09-01'), null, 'smoco', d('2026-09-20'), 'entro ottobre'],
    ['BIANCHI PNEUMATICI', 'BA', d('2026-09-02'), null, 'smoco', d('2026-09-21'), ''],
    ['VERDI AUTO', 'BA', d('2026-09-03'), null, 'smoco', d('2026-09-22'), ''],
  ]);
  // Il secondo foglio: una riga vuota in cima (le richieste cambiano riga) e una
  // nota nuova su Bianchi, che cambia il termine.
  const secondo = foglio([...INTESTAZIONE, [],
    ['ROSSI GOMME', 'BA', d('2026-09-01'), null, 'smoco', d('2026-09-20'), 'entro ottobre'],
    ['BIANCHI PNEUMATICI', 'BA', d('2026-09-02'), null, 'smoco', d('2026-09-21'), 'urgente, entro il 30/10/2026'],
    ['VERDI AUTO', 'BA', d('2026-09-03'), null, 'smoco', d('2026-09-22'), ''],
  ]);
  const fetchVero = globalThis.fetch;
  let file = primo;
  globalThis.fetch = async () => new Response(file);
  try {
    const modulo = await impacchetta('importaRichiesteEct');
    banco({ ...ARCHIVI_ORDINI });
    const r1 = await chiama(modulo, { file_uri: 'privato/richieste.xlsx' });
    verifica('il primo caricamento crea le tre richieste', r1.status === 200 && r1.body.creati === 3, `${r1.status} ${J(r1.body).slice(0, 300)}`);
    // L'amministratore scrive la nota interna, le annotazioni e un ID a mano.
    const attese = {};
    for (const [i, r] of globalThis.__ARCHIVI.RichiestaEct.entries()) {
      r.annotazioni = NOTE().slice(i);
      r.note_interne = `Nota interna di ${r.pdr_nome}`;
      attese[r.id] = { annotazioni: r.annotazioni, note_interne: r.note_interne };
    }
    const bianchi = globalThis.__ARCHIVI.RichiestaEct.find(x => x.pdr_nome === 'BIANCHI PNEUMATICI');
    bianchi.id_ordine_manuale = 'ET26000104';
    const istantanea = J(globalThis.__ARCHIVI);
    globalThis.__SCRITTI = [];
    file = secondo;
    const r2 = await chiama(modulo, { file_uri: 'privato/richieste.xlsx' });
    verifica('il secondo caricamento ritrova le tre richieste e le aggiorna (cambiano riga, e Bianchi la nota)', r2.status === 200 && r2.body.creati === 0 && r2.body.aggiornati === 3 && r2.body.spostate === 3,
      `${r2.status} ${J(r2.body).slice(0, 300)}`);
    verifica('la nota del foglio e\' quella nuova', bianchi && record('RichiestaEct', bianchi.id).nota === 'urgente, entro il 30/10/2026', J(record('RichiestaEct', bianchi && bianchi.id)));
    verifica('le annotazioni e la nota interna restano tutte, e nessuna scrittura le nomina', restano('RichiestaEct', attese), J(globalThis.__SCRITTI.map(s => s.d && Object.keys(s.d))));
    verifica('e l\'ID scritto a mano resta', record('RichiestaEct', bianchi.id).id_ordine_manuale === 'ET26000104');
    const mutante = await impacchetta('importaRichiesteEct', perdeLeAnnotazioni('await svc.RichiestaEct.update(gia.id, campi);', 'campi'));
    globalThis.__ARCHIVI = JSON.parse(istantanea);
    globalThis.__SCRITTI = [];
    await chiama(mutante, { file_uri: 'privato/richieste.xlsx' });
    verifica('controprova: un caricamento che le riscrivesse vuote non passerebbe', !restano('RichiestaEct', attese));
  } finally {
    globalThis.fetch = fetchVero;
  }
});

await prova('importaBlocco: il ricalcolo dei ritiri dopo le primarie', async () => {
  const RICHIESTA = () => ({ id: 'e1', anno: 2026, pdr_nome: 'BIANCHI PNEUMATICI', id_ordine_manuale: 'ET26000104', ordine_immesso_il: '2026-09-02', scadenza: '2026-10-30', esito: 'aperta',
    annotazioni: NOTE(), note_interne: 'Il produttore chiude il sabato' });
  // Il 104 adesso e' terminato: la richiesta diventa evasa.
  const ritirato = { PrimariaRete: [{ id: 'p4', id_ordine: 'ET26000104', stato: 'terminato', ordine_immesso_il: '2026-09-02T07:00:00Z', trasporto_iniziato_il: '2026-10-10T07:00:00Z', trasporto_finito_il: '2026-10-10T09:00:00Z' }] };
  const attese = { e1: { annotazioni: NOTE(), note_interne: 'Il produttore chiude il sabato' } };
  const corpo = { azione: 'ritiri_ect', tipo_file: 'primarie' };
  const modulo = await impacchetta('importaBlocco');
  banco({ RichiestaEct: [RICHIESTA()], ...ritirato });
  const r = await chiama(modulo, corpo);
  verifica('risponde, e la richiesta si chiude da sola', r.status === 200 && record('RichiestaEct', 'e1').esito === 'evasa' && globalThis.__SCRITTI.some(s => s.nome === 'RichiestaEct' && s.op === 'update'),
    `${r.status} ${J(r.body).slice(0, 200)} ${J(record('RichiestaEct', 'e1'))}`);
  verifica('e le annotazioni e la nota interna restano', restano('RichiestaEct', attese), J(globalThis.__SCRITTI));
  const mutante = await impacchetta('importaBlocco', perdeLeAnnotazioni('await svc.RichiestaEct.update(r.id, campi);', 'campi'));
  banco({ RichiestaEct: [RICHIESTA()], ...ritirato });
  await chiama(mutante, corpo);
  verifica('controprova: un ricalcolo che le riscrivesse vuote non passerebbe', !restano('RichiestaEct', attese));
});

// ---------------------------------------------------------------------------
console.log('4. GLI ARCHIVI');
const ENTITA = (nome) => JSON.parse(sorgente(`base44/entities/${nome}.jsonc`).split('\n').filter(r => !/^\s*\/\//.test(r)).join('\n'));
for (const nome of ['Todo', 'RichiestaEct']) {
  await prova(`lo schema di ${nome}`, () => {
    const e = ENTITA(nome);
    const a = e.properties && e.properties.annotazioni;
    verifica(`${nome}: il campo annotazioni e' un elenco, con lo schema di ogni riga`, !!a && a.type === 'array' && a.items && a.items.type === 'object'
      && ['id', 'testo', 'scritta_il', 'scritta_da', 'corretta_il', 'corretta_da', 'testo_originale'].every(k => a.items.properties && a.items.properties[k]), J(a).slice(0, 300));
    verifica(`${nome}: gli istanti sono date-time`, a && a.items.properties.scritta_il.format === 'date-time' && a.items.properties.corretta_il.format === 'date-time');
    verifica(`${nome}: le annotazioni non sono obbligatorie (i record di prima non le hanno)`, !(e.required || []).includes('annotazioni'));
    const rls = e.rls || {};
    verifica(`${nome}: lo legge chiunque, lo scrive solo l'amministratore`, rls.read === true && ['create', 'update', 'delete'].every(k => rls[k] && rls[k].user_condition && rls[k].user_condition.role === 'admin'), J(rls));
    verifica(`${nome}: nessuna parola della piattaforma nella descrizione`, !/base44/i.test(J(a)));
  });
}
await prova('il segno della chiusura del gestionale, nello schema', () => {
  const c = ENTITA('Todo').properties.chiusa_dal_gestionale;
  verifica('chiusa_dal_gestionale dice quando torna falso: ordini diversi scritti da chi l\'ha riaperta (revisione del 15/10/2026)', !!c && c.type === 'boolean' && /ordini diversi/.test(c.description || ''), J(c));
});
await prova('la nota interna delle richieste', () => {
  const n = ENTITA('RichiestaEct').properties.note_interne;
  verifica('note_interne c\'e\' ed e\' un testo, e dice che il caricamento non la tocca', !!n && n.type === 'string' && /non la toccano/.test(n.description || ''), J(n));
});
await prova('chi non e\' amministratore non scrive nemmeno dal browser', () => {
  const permessi = sorgente('src/lib/permessi.js');
  const libere = (permessi.match(/ENTITA_LIBERE = new Set\(\[([^\]]*)\]\)/) || [])[1] || '';
  verifica('Todo e RichiestaEct non sono fra gli archivi che un utente scrive', !/Todo|RichiestaEct/.test(libere), libere);
  const tracciati = sorgente('base44/shared/campiTracciati.ts');
  verifica('Todo e RichiestaEct non sono archivi dei numeri che fanno i conti: niente storico delle modifiche, la storia e\' l\'elenco stesso', !/^\s{2}(Todo|RichiestaEct):/m.test(tracciati));
});

// ---------------------------------------------------------------------------
console.log('5. LA PAGINA VERA');
const IMPORT_PERMESSI = "import { usePermessi } from '@/lib/permessi';";
const PAGINA = sorgente('src/pages/TodoPage.jsx');
const cartella = mkdtempSync(join(tmpdir(), 'todo-modifica-'));
const finestraPrima = globalThis.window;
globalThis.window = {
  self: 1, top: 1, matchMedia: () => ({ matches: false, addListener() {}, removeListener() {} }), confirm: () => true, alert: () => {},
  location: { search: '', hash: '', pathname: '/todo', href: 'http://localhost/todo', origin: 'http://localhost' },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true,
};
globalThis.confirm = () => true;
const TODOS = () => [
  { id: 'a', titolo: 'Sollecito Rossi', descrizione: 'Chiamare', categoria: 'Sollecito', priorita: 'media', data_scadenza: '2026-10-20', riferimento_ordine: 'ET26000104', stato: 'aperto', created_date: '2026-10-01T08:00:00Z', annotazioni: NOTE().slice(0, 1) },
  { id: 'b', titolo: 'Pratica Bianchi', stato: 'in_corso', created_date: '2026-10-02T08:00:00Z' },
  { id: 'c', titolo: 'Fattura Verdi', stato: 'completato', completata_il: '2026-10-10', created_date: '2026-09-01T08:00:00Z', annotazioni: NOTE() },
  { id: 'd', titolo: 'Ritiro Neri', stato: 'cancellato', chiusa_dal_gestionale: true, chiusa_dal_gestionale_il: '2026-10-14', created_date: '2026-09-02T08:00:00Z' },
  // un'attivita' vecchia senza lo stato salvato: la riga la mostra aperta
  { id: 'e', titolo: 'Vecchia senza stato', created_date: '2026-08-01T08:00:00Z' },
];
// Il client finto non registra che cosa si scrive: lo si guarda qui, e
// l'archivio cambia come cambierebbe quello vero.
const conScritte = (f, archivi) => {
  const scritte = [];
  const entita = f.cliente.entities;
  f.cliente.entities = new Proxy({}, { get: (_t, n) => {
    const e = entita[n];
    return { ...e,
      update: async (id, d) => {
        scritte.push({ nome: n, id, d: JSON.parse(J(d)) });
        const r = (archivi[n] || []).find(x => x.id === id);
        if (r) Object.assign(r, JSON.parse(J(d)));
        return e.update(id, d);
      },
      create: async (d) => { scritte.push({ nome: n, metodo: 'create', d: JSON.parse(J(d)) }); return e.create(d); },
    };
  } });
  return scritte;
};
const montaPagina = async (permessi) => {
  const copia = join(cartella, `TodoPage-${permessi.isAdmin ? 'admin' : 'lettore'}.jsx`);
  writeFileSync(copia, PAGINA.replace(IMPORT_PERMESSI, `const usePermessi = () => (${J(permessi)});`));
  return caricaPagina('pages/TodoPage', { file: copia, reali: ['@/components/todo/scrittureTodo', '@/components/todo/ModuloAttivita'] });
};
const elencoDi = (r) => trova(r.albero, el => el.type && el.type.__finto === 'ElencoAttivita')[0];
const scrittoriDi = (r) => trova(r.albero, el => nomeDi(el) === 'Provider' && el.props && 'value' in el.props)[0];

await prova('la pagina, per l\'amministratore', async () => {
  verifica('la pagina prende i permessi da usePermessi, come la copia si aspetta', PAGINA.includes(IMPORT_PERMESSI));
  const p = await montaPagina({ isAdmin: true, soloLettura: false, user: { email: ADMIN, role: 'admin' } });
  const archivi = { Todo: TODOS(), RichiestaEct: [{ id: 'r1', anno: 2026, pdr_nome: 'BIANCHI PNEUMATICI', esito: 'aperta', annotazioni: NOTE().slice(0, 1) }] };
  const f = clienteFinto({ archivi, funzioni: { controllaTodoOrdini: async () => ({ controllate: 1, aggiornate: 0, chiuse: [], cancellate: [], da_guardare: [] }) } });
  const scritte = conScritte(f, archivi);
  globalThis.__CLIENTE_FINTO = f.cliente;
  const r = p.monta(p.Componente, {});
  await aspetta(60);
  const tuttoLetto = f.letture();
  verifica('aperta la pagina, una sola lettura delle attivita\' e nessuna per le annotazioni', tuttoLetto.length === 1 && tuttoLetto[0].nome === 'Todo' && tuttoLetto[0].metodo === 'list', J(tuttoLetto));
  let elenco = elencoDi(r);
  verifica('l\'elenco riceve chi apre la modifica e chi la disegna', !!elenco && typeof elenco.props.onModifica === 'function' && typeof elenco.props.modificaDi === 'function' && elenco.props.isAdmin === true);
  const di = (id) => archivi.Todo.find(t => t.id === id);
  verifica('all\'apertura nessuna riga e\' in modifica', ['a', 'b', 'e'].every(id => elenco.props.modificaDi(di(id)) === null));
  elenco.props.onModifica(di('c'));
  elenco.props.onModifica(di('d'));
  await aspetta(20);
  elenco = elencoDi(r);
  verifica('una completata o una cancellata non si modificano: si riaprono prima', elenco.props.modificaDi(di('c')) === null && elenco.props.modificaDi(di('d')) === null);
  elenco.props.onModifica(di('e'));
  await aspetta(20);
  verifica('una vecchia senza stato, che la riga mostra aperta, si modifica', !!elencoDi(r).props.modificaDi(di('e')));
  elencoDi(r).props.onModifica(di('a'));
  await aspetta(20);
  elenco = elencoDi(r);
  let modulo = elenco.props.modificaDi(di('a'));
  verifica('«Modifica» apre lo stesso modulo del «Nuovo To-Do», gia\' compilato, al posto della riga', !!modulo && nomeDi(modulo) === 'ModuloAttivita' && modulo.props.modifica === true
    && J(modulo.props.iniziale) === J(S.valoriDelModulo(di('a'))), modulo ? J(modulo.props.iniziale) : 'manca');
  verifica('una riga sola alla volta', elenco.props.modificaDi(di('e')) === null && elenco.props.modificaDi(di('b')) === null);

  // Il titolo e la priorita': si scrivono solo quelli, e il controllo degli ordini non riparte.
  f.azzera(); scritte.length = 0;
  await modulo.props.onSalva({ ...modulo.props.iniziale, titolo: 'Sollecito Rossi, secondo giro', priorita: 'alta' });
  await aspetta(30);
  verifica('si scrivono solo i campi cambiati', scritte.length === 1 && scritte[0].nome === 'Todo' && scritte[0].id === 'a' && J(scritte[0].d) === J({ titolo: 'Sollecito Rossi, secondo giro', priorita: 'alta' }), J(scritte));
  verifica('le annotazioni dell\'attivita\' restano', J(di('a').annotazioni) === J(NOTE().slice(0, 1)));
  verifica('salvato, il modulo si chiude e l\'elenco si rilegge; il controllo degli ordini non riparte', elencoDi(r).props.modificaDi(di('a')) === null
    && f.letture('Todo').length === 1 && f.funzioniChiamate('controllaTodoOrdini').length === 0, J(f.chiamate));

  // Gli ordini: dopo la scrittura riparte subito il controllo, come alla creazione.
  elencoDi(r).props.onModifica(di('a'));
  await aspetta(20);
  modulo = elencoDi(r).props.modificaDi(di('a'));
  f.azzera(); scritte.length = 0;
  await modulo.props.onSalva({ ...modulo.props.iniziale, riferimento_ordine: 'et26000103' });
  await aspetta(30);
  const ordineChiamate = f.chiamate.map(c => `${c.tipo}:${c.nome}`);
  verifica('cambiati gli ordini si scrivono, e subito dopo riparte il controllo degli ordini', J(scritte.map(s => s.d)) === J([{ riferimento_ordine: 'ET26000103' }])
    && ordineChiamate.indexOf('funzione:controllaTodoOrdini') > ordineChiamate.indexOf('scrittura:Todo') && ordineChiamate.indexOf('scrittura:Todo') >= 0, J(ordineChiamate));

  // Niente di cambiato: niente da scrivere. Il titolo vuoto: il modulo lo dice.
  elencoDi(r).props.onModifica(di('a'));
  await aspetta(20);
  modulo = elencoDi(r).props.modificaDi(di('a'));
  f.azzera(); scritte.length = 0;
  await modulo.props.onSalva({ ...modulo.props.iniziale });
  await aspetta(20);
  verifica('salvato senza cambiare niente non scrive e non rilegge', scritte.length === 0 && f.chiamate.length === 0 && elencoDi(r).props.modificaDi(di('a')) === null, J(f.chiamate));
  elencoDi(r).props.onModifica(di('a'));
  await aspetta(20);
  modulo = elencoDi(r).props.modificaDi(di('a'));
  let errore = '';
  try { await modulo.props.onSalva({ ...modulo.props.iniziale, titolo: '  ' }); } catch (e) { errore = e.message; }
  verifica('il titolo vuoto non si salva, e il modulo lo dice (resta aperto)', /il titolo è obbligatorio/.test(errore) && scritte.length === 0 && !!elencoDi(r).props.modificaDi(di('a')), errore);

  // «Nuovo To-Do» chiude la modifica e apre il modulo vuoto, che crea come prima.
  const nuovo = trova(r.albero, el => el.type === 'button' && /Nuovo To-Do/.test(testoAlbero(el)))[0];
  nuovo.props.onClick();
  await aspetta(20);
  const moduloNuovo = trova(r.albero, el => nomeDi(el) === 'ModuloAttivita' && !el.props.modifica)[0];
  verifica('«Nuovo To-Do» chiude la modifica e apre il modulo vuoto', elencoDi(r).props.modificaDi(di('a')) === null && !!moduloNuovo && moduloNuovo.props.iniziale.titolo === '' && moduloNuovo.props.iniziale.priorita === 'media');
  scritte.length = 0;
  await moduloNuovo.props.onSalva({ ...moduloNuovo.props.iniziale, titolo: 'Chiamare Ecotyre' });
  await aspetta(20);
  verifica('e crea come prima: aperta, col giorno italiano', scritte.length === 1 && scritte[0].metodo === 'create' && scritte[0].d.stato === 'aperto' && scritte[0].d.data_ricezione === OGGI && scritte[0].d.titolo === 'Chiamare Ecotyre', J(scritte));

  // Chi scrive le annotazioni e la nota interna, per le righe delle due schede.
  const scrittori = scrittoriDi(r);
  const sc = scrittori && scrittori.props.value;
  verifica('la pagina mette chi scrive le annotazioni e la nota interna', !!sc && typeof sc.annota === 'function' && typeof sc.notaInterna === 'function');
  // Un'altra scheda ha scritto un'annotazione dopo che la pagina ha letto.
  di('a').annotazioni = [...di('a').annotazioni, { id: 'altra', testo: 'Scritta da un\'altra scheda', scritta_il: '2026-10-15T07:00:00Z', scritta_da: ADMIN }];
  f.azzera(); scritte.length = 0;
  const esito = await sc.annota('Todo', 'a', (prima, chi) => A.accodaAnnotazione(prima, 'Risposto: ritiro venerdì', chi, new Date('2026-10-15T08:00:00Z')));
  const letture = f.letture();
  verifica('un\'annotazione: rilegge l\'attivita\' una volta e scrive solo le annotazioni', letture.length === 1 && letture[0].metodo === 'get' && letture[0].nome === 'Todo'
    && scritte.length === 1 && J(Object.keys(scritte[0].d)) === '["annotazioni"]', J(f.chiamate));
  const scritto = scritte[0] ? scritte[0].d.annotazioni : [];
  verifica('in fondo, con l\'email di chi e\' collegato, e le altre (anche quella dell\'altra scheda) restano', scritto.length === 3 && scritto[0].id === 'n1' && scritto[1].id === 'altra'
    && scritto[2].testo === 'Risposto: ritiro venerdì' && scritto[2].scritta_da === ADMIN && esito.scritto === true, J(scritto));
  scritte.length = 0;
  await sc.annota('RichiestaEct', 'r1', (prima, chi) => A.accodaAnnotazione(prima, 'Il consorzio sollecita', chi));
  verifica('sulle richieste ECT la stessa cosa, nel loro archivio', scritte.length === 1 && scritte[0].nome === 'RichiestaEct' && scritte[0].d.annotazioni.length === 2, J(scritte));
  scritte.length = 0;
  await sc.notaInterna('r1', 'Chiamato il trasportatore');
  verifica('la nota interna di una richiesta si scrive da sola', J(scritte) === J([{ nome: 'RichiestaEct', id: 'r1', d: { note_interne: 'Chiamato il trasportatore' } }]), J(scritte));
  verifica('nessun errore della pagina', r.errori.length === 0, String(r.errori[0] || ''));
  r.smonta();
});

await prova('la pagina, per chi non e\' amministratore', async () => {
  const p = await montaPagina({ isAdmin: false, soloLettura: true, user: { email: 'operatore@smoco.it', role: 'user' } });
  const archivi = { Todo: TODOS(), RichiestaEct: [] };
  const f = clienteFinto({ archivi, funzioni: { controllaTodoOrdini: async () => ({ aggiornate: 0 }) } });
  const scritte = conScritte(f, archivi);
  globalThis.__CLIENTE_FINTO = f.cliente;
  const r = p.monta(p.Componente, {});
  await aspetta(60);
  const elenco = elencoDi(r);
  verifica('l\'elenco sa che non e\' amministratore', !!elenco && elenco.props.isAdmin === false);
  verifica('nessuno scrive per lui: le righe non hanno i pulsanti delle annotazioni', !!scrittoriDi(r) && scrittoriDi(r).props.value === null);
  verifica('niente «Nuovo To-Do»', !trova(r.albero, el => el.type === 'button' && /Nuovo To-Do/.test(testoAlbero(el))).length);
  elenco.props.onModifica(archivi.Todo[0]);
  await aspetta(20);
  verifica('la modifica non si apre', elencoDi(r).props.modificaDi(archivi.Todo[0]) === null);
  verifica('nessuna scrittura, e il controllo degli ordini non parte', scritte.length === 0 && f.funzioniChiamate().length === 0 && !f.chiamate.some(c => c.tipo === 'scrittura'), J(f.chiamate));
  r.smonta();
});

// Revisione del 15/10/2026: gli ordini nuovi su un'attivita' che il gestionale
// aveva chiuso e che e' stata riaperta, dalla modifica e dalla casella della riga.
await prova('la pagina: ordini nuovi su un\'attivita\' riaperta', async () => {
  const p = await montaPagina({ isAdmin: true, soloLettura: false, user: { email: ADMIN, role: 'admin' } });
  const riaperta = (id, ordini) => ({ id, titolo: `Ritiro ${id}`, stato: 'aperto', riferimento_ordine: ordini, ordini_attesi: ordini, ordini_da_attendere: '', chiusa_dal_gestionale: true,
    chiusa_dal_gestionale_il: '2026-10-14', chiusura_nota: NOTA_CHIUSURA, created_date: '2026-10-01T08:00:00Z', annotazioni: NOTE().slice(0, 1) });
  const archivi = { Todo: [riaperta('r', 'ET26000101'), riaperta('s', 'ET26000101'), riaperta('u', 'ET26000101, ET26000102'), { id: 'a', titolo: 'Sollecito', stato: 'aperto', created_date: '2026-10-02T08:00:00Z' }] };
  const f = clienteFinto({ archivi, funzioni: { controllaTodoOrdini: async () => ({ aggiornate: 0 }) } });
  const scritte = conScritte(f, archivi);
  globalThis.__CLIENTE_FINTO = f.cliente;
  const r = p.monta(p.Componente, {});
  await aspetta(60);
  const di = (id) => archivi.Todo.find(t => t.id === id);
  elencoDi(r).props.onModifica(di('a'));
  await aspetta(20);
  verifica('su un\'attivita\' che il gestionale non aveva chiuso il modulo non parla di chiusure', elencoDi(r).props.modificaDi(di('a')).props.chiusaDalGestionale === false);
  elencoDi(r).props.onModifica(di('r'));
  await aspetta(20);
  const modulo = elencoDi(r).props.modificaDi(di('r'));
  verifica('sulla riaperta il modulo sa che il gestionale l\'aveva chiusa (e lo dice)', !!modulo && modulo.props.chiusaDalGestionale === true);
  f.azzera(); scritte.length = 0;
  await modulo.props.onSalva({ ...modulo.props.iniziale, riferimento_ordine: 'ET26000200' });
  await aspetta(30);
  const ch = f.chiamate.map(c => `${c.tipo}:${c.nome}:${c.metodo || ''}`);
  verifica('rilegge l\'attivita\' e scrive in una volta sola gli ordini, il segno tolto e l\'annotazione', scritte.length === 1 && scritte[0].id === 'r'
    && J(Object.keys(scritte[0].d)) === J(['riferimento_ordine', 'chiusa_dal_gestionale', 'annotazioni']) && scritte[0].d.riferimento_ordine === 'ET26000200' && scritte[0].d.chiusa_dal_gestionale === false
    && ch.indexOf('lettura:Todo:get') >= 0 && ch.indexOf('lettura:Todo:get') < ch.indexOf('scrittura:Todo:update'), `${J(ch)} ${J(scritte)}`);
  const ann = scritte[0] ? scritte[0].d.annotazioni || [] : [];
  verifica('l\'annotazione si accoda alle altre, con l\'email dell\'amministratore e la chiusura di prima', ann.length === 2 && ann[0].id === 'n1' && ann[1].scritta_da === ADMIN
    && /^Ordini cambiati da ET26000101 a ET26000200\./.test(ann[1].testo || '') && (ann[1].testo || '').includes(NOTA_CHIUSURA), J(ann));
  verifica('dopo la scrittura riparte il controllo degli ordini, come alla creazione', ch.indexOf('funzione:controllaTodoOrdini:') > ch.indexOf('scrittura:Todo:update'), J(ch));
  f.azzera(); scritte.length = 0;
  await elencoDi(r).props.onSalvaOrdine(di('s'), 'ET26000300');
  await aspetta(30);
  verifica('la casella degli ordini sulla riga fa lo stesso', scritte.length === 1 && scritte[0].id === 's' && scritte[0].d.chiusa_dal_gestionale === false && scritte[0].d.riferimento_ordine === 'ET26000300'
    && (scritte[0].d.annotazioni || []).length === 2 && f.letture('Todo').some(l => l.metodo === 'get'), J(scritte));
  f.azzera(); scritte.length = 0;
  await elencoDi(r).props.onSalvaOrdine(di('u'), 'ET26000102, ET26000101');
  await aspetta(30);
  verifica('gli stessi ordini in un altro ordine: una scrittura come prima, nessuna rilettura, il segno resta', J(scritte.map(s => s.d)) === J([{ riferimento_ordine: 'ET26000102, ET26000101' }])
    && !f.letture('Todo').some(l => l.metodo === 'get'), J(f.chiamate));
  verifica('nessun errore della pagina', r.errori.length === 0, String(r.errori[0] || ''));
  r.smonta();
});

// Revisione del 15/10/2026: la pagina toglieva l'elenco a ogni rilettura, e con
// lui il modulo di una modifica e i campi delle annotazioni, con quello che
// l'amministratore stava scrivendo. Lo script del revisore
// (modificaPersaAlRicarico.mjs) e' la base.
await prova('la pagina: una rilettura non toglie l\'elenco', async () => {
  const p = await montaPagina({ isAdmin: true, soloLettura: false, user: { email: ADMIN, role: 'admin' } });
  const archivi = { Todo: TODOS() };
  const f = clienteFinto({ archivi, funzioni: { controllaTodoOrdini: async () => ({ aggiornate: 0 }) } });
  // Ogni lettura dell'elenco resta in sospeso finche' la prova non la lascia andare.
  const sospese = [];
  const entita = f.cliente.entities;
  f.cliente.entities = new Proxy({}, { get: (_t, n) => { const e = entita[n]; return { ...e, list: async (...a) => { if (n === 'Todo') await new Promise(via => sospese.push(via)); return e.list(...a); } }; } });
  globalThis.__CLIENTE_FINTO = f.cliente;
  const r = p.monta(p.Componente, {});
  await aspetta(30);
  const caricamento = () => trova(r.albero, el => el.type === 'div' && /^\s*Caricamento/.test(testoAlbero(el))).length > 0;
  const aggiorno = () => /Aggiorno l'elenco/.test(testoAlbero(r.albero));
  verifica('alla prima lettura «Caricamento...» al posto dell\'elenco, come prima', sospese.length === 1 && caricamento() && !elencoDi(r));
  sospese.shift()();
  await aspetta(30);
  verifica('letto, l\'elenco', !!elencoDi(r) && !caricamento() && !aggiorno());
  const di = (id) => archivi.Todo.find(t => t.id === id);
  elencoDi(r).props.onModifica(di('a'));
  await aspetta(20);
  const aperto = elencoDi(r).props.modificaDi(di('a'));
  // Mentre si scrive nel modulo di «a», si spunta «b»: la pagina rilegge.
  elencoDi(r).props.onSpunta(di('b'));
  await aspetta(30);
  const durante = elencoDi(r) && elencoDi(r).props.modificaDi(di('a'));
  verifica('mentre la pagina rilegge, l\'elenco resta al suo posto col modulo aperto: stesso componente, stessa chiave, e React non lo rifa\' da capo (il testo scritto resta)',
    sospese.length === 1 && !caricamento() && !!durante && nomeDi(durante) === 'ModuloAttivita' && !!aperto && durante.key === aperto.key,
    `nell'albero: ${caricamento() ? '«Caricamento...» al posto dell\'elenco' : 'elenco'}; sospese=${sospese.length}`);
  verifica('e la pagina dice che sta aggiornando', aggiorno());
  if (sospese.length) sospese.shift()();
  await aspetta(30);
  verifica('riletto, il modulo e\' ancora aperto e l\'avviso se ne va', !!elencoDi(r) && !!elencoDi(r).props.modificaDi(di('a')) && !aggiorno() && !caricamento());
  verifica('nessun errore della pagina', r.errori.length === 0, String(r.errori[0] || ''));
  r.smonta();
});

await prova('la scheda delle richieste ECT', async () => {
  const RICHIESTE = [
    { id: 'r1', anno: 2026, pdr_nome: 'BIANCHI PNEUMATICI', esito: 'aperta', id_ordine_manuale: 'ET26000104', mail_inviata_il: '2026-09-21', note_interne: 'Chiude il sabato', annotazioni: NOTE() },
    { id: 'r2', anno: 2026, pdr_nome: 'VERDI AUTO', esito: 'evasa', evasione_rilevata_il: '2026-10-09', ordini_totali: 1, ordini_evasi: 1, mail_inviata_il: '2026-09-22', annotazioni: NOTE().slice(0, 1) },
  ];
  for (const isAdmin of [true, false]) {
    const p = await caricaPagina('components/todo/RichiesteEct');
    const f = clienteFinto({ archivi: { RichiestaEct: RICHIESTE.map(x => ({ ...x })) }, funzioni: { importaBlocco: async () => ({ aggiornate: 0 }) } });
    globalThis.__CLIENTE_FINTO = f.cliente;
    const r = p.monta(p.Componente, { isAdmin });
    await aspetta(60);
    const note = trova(r.albero, el => el.type && el.type.__finto === 'NoteRichiesta');
    verifica(`${isAdmin ? 'amministratore' : 'chi non lo e\''}: sulla richiesta da ritirare la nota interna e le annotazioni, ${isAdmin ? '' : 'non '}modificabili`,
      note.length === 1 && note[0].props.richiesta.id === 'r1' && note[0].props.modificabile === isAdmin, J(note.map(n => [n.props.richiesta && n.props.richiesta.id, n.props.modificabile])));
    const ferma = trova(r.albero, el => el.type === 'td' && /sticky left-0/.test(el.props.className || '') && trova(el.props.children, x => x.type && x.type.__finto === 'NoteRichiesta').length > 0);
    verifica('stanno nella colonna del produttore, che a 375 px resta ferma a sinistra', ferma.length === 1);
    const completate = trova(r.albero, el => el.type && el.type.__finto === 'RichiesteCompletate')[0];
    verifica('l\'evasa va fra le completate, con le sue annotazioni', !!completate && completate.props.tutte.length === 1 && completate.props.tutte[0].annotazioni.length === 1);
    verifica('nessuna lettura per riga: le richieste si leggono una volta', f.letture('RichiestaEct').length === 1 && !f.letture().some(l => l.metodo === 'get'), J(f.letture()));
    r.smonta();
  }
});

// ---------------------------------------------------------------------------
console.log('6. I COMPONENTI NUOVI, USATI E DISEGNATI');

await prova('le annotazioni, usate', async () => {
  const p = await caricaPagina('components/todo/Annotazioni');
  const chiamate = [];
  let rompi = false;
  const scrittore = { annota: async (archivio, id, cambia) => {
    if (rompi) throw new Error('rete caduta');
    const salvate = A.annotazioniSalvate(rec);
    const elenco = cambia(salvate, ADMIN);
    chiamate.push({ archivio, id, elenco });
    // come l'archivio vero: la riga salvata resta salvata
    rec.annotazioni = elenco;
    return { scritto: true, elenco };
  } };
  const rec = { id: 't9', annotazioni: NOTE() };
  const r = p.monta(p.Componente, { archivio: 'Todo', record: rec, modificabile: true, scrittore });
  const leggi = () => testoAlbero(r.albero);
  const bottone = (re) => trova(r.albero, el => el.type === 'button' && re.test(testoAlbero(el)))[0];
  const editor = () => trova(r.albero, el => /^Editor/.test(nomeDi(el)))[0];
  verifica('se ne vedono le ultime due, col giorno e l\'ora italiani e chi le ha scritte', !leggi().includes('Chiamato il produttore') && leggi().includes('Sollecitato via mail')
    && leggi().includes('14/10/2026 alle 11:00') && leggi().includes(ADMIN), leggi());
  verifica('la correzione si legge, col testo di prima', leggi().includes('corretta il 13/10/2026 alle 10:05 da altro@smoco.it') && leggi().includes('prima diceva: «Risponde entro giovedì»'), leggi());
  bottone(/tutte \(3\)/).props.onClick();
  await aspetta(5);
  verifica('«tutte (3)» le apre tutte, in ordine di tempo', leggi().includes('Chiamato il produttore') && leggi().indexOf('Chiamato il produttore') < leggi().indexOf('Sollecitato via mail') && !!bottone(/solo le ultime due/), leggi());
  bottone(/Aggiungi un’annotazione/).props.onClick();
  await aspetta(5);
  verifica('«Aggiungi un\'annotazione» apre il campo vuoto', !!editor() && editor().props.valore === '');
  editor().props.onCambia('Risposto al consorzio');
  await aspetta(5);
  await editor().props.onSalva();
  await aspetta(10);
  verifica('salvata, si accoda in fondo senza toccare le altre', chiamate.length === 1 && chiamate[0].archivio === 'Todo' && chiamate[0].id === 't9' && chiamate[0].elenco.length === 4
    && J(chiamate[0].elenco.slice(0, 3)) === J(NOTE()) && chiamate[0].elenco[3].testo === 'Risposto al consorzio' && chiamate[0].elenco[3].scritta_da === ADMIN, J(chiamate));
  verifica('e si vede subito, senza rileggere la pagina', leggi().includes('Risposto al consorzio') && !editor(), leggi().slice(-300));
  const correggi = trova(r.albero, el => el.type === 'button' && /correggi/.test(testoAlbero(el)));
  verifica('ogni riga si puo\' correggere', correggi.length === 4, String(correggi.length));
  correggi[0].props.onClick();
  await aspetta(5);
  verifica('«correggi» apre il campo col testo della riga', !!editor() && editor().props.valore === 'Chiamato il produttore');
  editor().props.onCambia('Chiamato il produttore, non risponde');
  await aspetta(5);
  await editor().props.onSalva();
  await aspetta(10);
  const corretta = chiamate[1] && chiamate[1].elenco[0];
  verifica('la correzione cambia solo quella riga, e lo dice', !!corretta && corretta.testo === 'Chiamato il produttore, non risponde' && corretta.testo_originale === 'Chiamato il produttore' && !!corretta.corretta_il
    && chiamate[1].elenco.length === 4 && J(chiamate[1].elenco.slice(1, 3)) === J(NOTE().slice(1)), J(chiamate[1]));
  verifica('a video «corretta il 15/10/2026 ...»', /corretta il 15\/10\/2026 alle \d\d:\d\d/.test(leggi()), leggi());
  rompi = true;
  bottone(/Aggiungi un’annotazione/).props.onClick();
  await aspetta(5);
  editor().props.onCambia('Questa non arriva');
  await aspetta(5);
  await editor().props.onSalva();
  await aspetta(10);
  verifica('un salvataggio che non riesce si dice, e il testo resta da salvare', /L’annotazione non è stata salvata: rete caduta/.test(leggi()) && !!editor() && editor().props.valore === 'Questa non arriva', leggi().slice(-200));
  r.smonta();
  const sola = p.monta(p.Componente, { archivio: 'Todo', record: rec, modificabile: false, scrittore });
  verifica('da leggere e basta: niente «Aggiungi», niente «correggi»', !trova(sola.albero, el => el.type === 'button' && /Aggiungi|correggi/.test(testoAlbero(el))).length && testoAlbero(sola.albero).includes('Sollecitato via mail'));
  sola.smonta();
  const senzaScrittore = p.monta(p.Componente, { archivio: 'Todo', record: rec, modificabile: true });
  verifica('senza la pagina che scrive i pulsanti non ci sono', !trova(senzaScrittore.albero, el => el.type === 'button' && /Aggiungi|correggi/.test(testoAlbero(el))).length);
  senzaScrittore.smonta();
  const vuoto = p.monta(p.Componente, { archivio: 'Todo', record: { id: 'v' }, modificabile: false });
  verifica('a chi legge, senza annotazioni, non si disegna niente', vuoto.albero === null);
  vuoto.smonta();
});

await prova('la nota interna, usata', async () => {
  const p = await caricaPagina('components/todo/NoteRichiesta');
  const note = [];
  const scrittore = { notaInterna: async (id, testo) => { note.push([id, testo]); }, annota: async () => ({ scritto: false, elenco: [] }) };
  const r = p.monta(p.Componente, { richiesta: { id: 'r1', note_interne: '', annotazioni: [] }, modificabile: true, scrittore });
  const ann = () => trova(r.albero, el => el.type && el.type.__finto === 'Annotazioni')[0];
  verifica('le annotazioni della richiesta si scrivono nel suo archivio', !!ann() && ann().props.archivio === 'RichiestaEct' && ann().props.modificabile === true && ann().props.scrittore === scrittore);
  const pulsante = ann().props.accanto;
  verifica('accanto ad «Aggiungi un\'annotazione», la nota interna', !!pulsante && pulsante.type === 'button' && /Nota interna/.test(testoAlbero(pulsante)), J(pulsante && testoAlbero(pulsante)));
  pulsante.props.onClick();
  await aspetta(5);
  const area = trova(r.albero, el => el.type === 'textarea')[0];
  verifica('si apre il campo', !!area && area.props['aria-label'] === 'Nota interna');
  area.props.onChange({ target: { value: '  Chiamato il trasportatore\r\n' } });
  await aspetta(5);
  await trova(r.albero, el => el.type === 'button' && /Salva la nota/.test(testoAlbero(el)))[0].props.onClick();
  await aspetta(10);
  verifica('si salva pulita, e si legge subito', J(note) === J([['r1', 'Chiamato il trasportatore']]) && testoAlbero(r.albero).includes('Nota interna: Chiamato il trasportatore'), J(note));
  const ancora = trova(r.albero, el => el.type && el.type.__finto === 'Annotazioni')[0].props.accanto;
  verifica('poi si corregge', /Correggi la nota interna/.test(testoAlbero(ancora)));
  r.smonta();
  const lettore = p.monta(p.Componente, { richiesta: { id: 'r1', note_interne: 'Chiude il sabato', annotazioni: NOTE() }, modificabile: false, scrittore });
  const annL = trova(lettore.albero, el => el.type && el.type.__finto === 'Annotazioni')[0];
  verifica('chi legge vede la nota e le annotazioni, senza pulsanti', testoAlbero(lettore.albero).includes('Nota interna: Chiude il sabato') && !!annL && annL.props.modificabile === false && annL.props.accanto === null
    && !trova(lettore.albero, el => el.type === 'textarea').length);
  lettore.smonta();
  const niente = p.monta(p.Componente, { richiesta: { id: 'r2' }, modificabile: false });
  verifica('senza niente da leggere non si disegna niente', niente.albero === null);
  niente.smonta();
});

await prova('il modulo di modifica, usato', async () => {
  const p = await caricaPagina('components/todo/ModuloAttivita');
  const r = p.monta(p.Componente, { modifica: true, iniziale: S.valoriDelModulo(BASE), onSalva: async () => { throw new Error('rete caduta'); }, onAnnulla: () => {} });
  const t = testoAlbero(r.albero);
  verifica('dice che e\' una modifica, e salva le modifiche', t.includes('Modifica l’attività') && t.includes('Salva le modifiche') && t.includes('Si salvano solo i campi che cambi'), t.slice(0, 200));
  const valori = trova(r.albero, el => el.type === 'input' || el.type === 'textarea' || el.type === 'select').map(el => el.props.value);
  verifica('i sei campi compilati coi valori dell\'attivita\'', J(valori) === J(['Sollecito Rossi', 'Chiamare il\nproduttore', 'Sollecito', 'media', '2026-10-20', 'ET26000104']), J(valori));
  await trova(r.albero, el => el.type === 'button' && /Salva le modifiche/.test(testoAlbero(el)))[0].props.onClick();
  await aspetta(10);
  verifica('un salvataggio che non riesce si dice, e il modulo resta compilato', /Le modifiche non sono state salvate: rete caduta/.test(testoAlbero(r.albero))
    && trova(r.albero, el => el.type === 'input')[0].props.value === 'Sollecito Rossi');
  r.smonta();
  const nuovo = p.monta(p.Componente, { onSalva: async () => {}, onAnnulla: () => {} });
  verifica('senza `modifica` e\' il «Nuovo To-Do» di prima', testoAlbero(nuovo.albero).includes('Nuovo To-Do') && testoAlbero(nuovo.albero).includes('Aggiungi') && !testoAlbero(nuovo.albero).includes('Salva le modifiche'));
  nuovo.smonta();
});

await prova('il modulo di modifica dice il vero sugli ordini (revisione del 15/10/2026)', async () => {
  const p = await caricaPagina('components/todo/ModuloAttivita');
  const leggiModulo = (props) => { const r = p.monta(p.Componente, { onSalva: async () => {}, onAnnulla: () => {}, ...props }); const s = testoAlbero(r.albero); r.smonta(); return s; };
  const riaperta = leggiModulo({ modifica: true, chiusaDalGestionale: true, iniziale: S.valoriDelModulo(BASE) });
  const normale = leggiModulo({ modifica: true, iniziale: S.valoriDelModulo(BASE) });
  const nuovo = leggiModulo({});
  verifica('in modifica: ordini diversi si guardano da quando salvi, e uno gia\' terminato o cancellato non chiude', /Se scrivi ordini diversi il gestionale li guarda da quando salvi/.test(normale) && !/Se scrivi ordini diversi/.test(nuovo), normale.slice(-500));
  verifica('su una riaperta dopo una chiusura del gestionale: con gli stessi ordini non si richiude, con ordini diversi si', /con gli stessi ordini non la richiude, la spunta la metti tu/.test(riaperta)
    && /con ordini diversi torna a chiuderla da sé/.test(riaperta) && /resta scritta fra le annotazioni/.test(riaperta) && !/stessi ordini non la richiude/.test(normale), riaperta.slice(-600));
  verifica('niente piu\' la promessa senza condizioni «come per un\'attivita\' nuova»', !/ricomincia a guardarli da adesso, come per un’attività nuova/.test(riaperta + normale));
  verifica('la pagina lo spiega anche sopra l\'elenco', /con gli stessi ordini non si richiude/.test(PAGINA.replace(/\s+/g, ' ')) && /la chiusura di prima resta scritta fra le annotazioni/.test(PAGINA.replace(/\s+/g, ' ')));
});

// Disegnati con React vero, lato server, come in prove/todoCompletati.mjs.
const ESTENSIONI = ['', '.js', '.jsx', '.ts'];
const daAlias = (pp) => { const base = qui('../src/' + pp.slice(2)); return ESTENSIONI.map(e => base + e).find(x => existsSync(x) && /\.\w+$/.test(x)) || base; };
let L = null;
await prova('i componenti si impacchettano con React', async () => {
  const comp = (n) => JSON.stringify(qui(`../src/components/todo/${n}`));
  const INGRESSO = `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import ElencoAttivita from ${comp('ElencoAttivita.jsx')};
import AttivitaCancellate from ${comp('AttivitaCancellate.jsx')};
import RichiesteCompletate from ${comp('RichiesteCompletate.jsx')};
import NoteRichiesta from ${comp('NoteRichiesta.jsx')};
import ModuloAttivita from ${comp('ModuloAttivita.jsx')};
import { ScrittureTodo } from ${comp('scrittureTodo.js')};
const C = { ElencoAttivita, AttivitaCancellate, RichiesteCompletate, NoteRichiesta, ModuloAttivita };
export const disegna = (nome, props, scritture = null) => renderToStaticMarkup(React.createElement(ScrittureTodo.Provider, { value: scritture }, React.createElement(C[nome], props)));
`;
  const pacchetto = await build({
    stdin: { contents: INGRESSO, resolveDir: qui('.'), loader: 'js' },
    bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent',
    loader: { '.jsx': 'jsx', '.js': 'jsx' },
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'alias', setup(b) { b.onResolve({ filter: /^@\// }, (a) => ({ path: daAlias(a.path) })); } }],
  });
  L = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
});
const leggi = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ');
const conta = (html, re) => (html.match(re) || []).length;
await prova('disegnati', () => {
  if (!L) throw new Error('non impacchettati');
  const niente = () => {};
  const SCRITTURE = { annota: async () => ({ scritto: false, elenco: [] }), notaInterna: async () => {} };
  const todos = TODOS().map(t => (t.id === 'd' ? { ...t, annotazioni: [NOTE()[2]] } : t));
  const azioni = { onSpunta: niente, onCiclo: niente, onElimina: niente, onSalvaOrdine: niente, onModifica: niente };
  const html = L.disegna('ElencoAttivita', { todos, filtro: 'tutti', isAdmin: true, ...azioni }, SCRITTURE);
  const [sopra = '', sotto = ''] = html.split(/<details/);
  verifica('amministratore: «Modifica» su ogni attivita\' da fare, e solo li\'', conta(sopra, /Modifica</g) === 3 && !/Modifica</.test(sotto), `${conta(sopra, /Modifica</g)} ${conta(sotto, /Modifica</g)}`);
  verifica('«Aggiungi un\'annotazione» su ogni attivita\' da fare, non sulle completate', conta(sopra, /Aggiungi un’annotazione/g) === 3 && conta(sotto, /Aggiungi un’annotazione/g) === 0);
  verifica('le annotazioni si leggono sulla da fare e sulla completata (le ultime due, e «tutte (3)»)', leggi(sopra).includes('Chiamato il produttore') && leggi(sotto).includes('Sollecitato via mail')
    && leggi(sotto).includes('tutte (3)') && !leggi(sotto).includes('Chiamato il produttore'), leggi(sotto).slice(0, 600));
  const lettore = L.disegna('ElencoAttivita', { todos, filtro: 'tutti', isAdmin: false, ...azioni }, null);
  verifica('chi non e\' amministratore legge le annotazioni, senza «Modifica», «Aggiungi» o «correggi»', !/Modifica</.test(lettore) && !/Aggiungi un’annotazione|correggi/.test(lettore)
    && leggi(lettore).includes('Chiamato il produttore') && leggi(lettore).includes('Sollecitato via mail'));
  const canc = L.disegna('AttivitaCancellate', { todos: todos.filter(t => t.stato === 'cancellato'), isAdmin: true, onRiapri: niente, onElimina: niente }, SCRITTURE);
  verifica('fra le cancellate le annotazioni restano, da leggere', leggi(canc).includes('Sollecitato via mail') && leggi(canc).includes('14/10/2026 alle 11:00') && !/Aggiungi un’annotazione|correggi/.test(canc), leggi(canc).slice(0, 400));
  const completate = [{ id: 'r2', pdr_nome: 'VERDI AUTO', esito: 'evasa', evasione_rilevata_il: '2026-10-09', ordini_totali: 1, ordini_evasi: 1, mail_inviata_il: '2026-09-22', note_interne: 'Risposto il 10/10', annotazioni: NOTE().slice(0, 1) }];
  const rc = L.disegna('RichiesteCompletate', { tutte: completate, righe: completate, esitoDi: (r) => r.esito, isAdmin: true, occupato: null, onSpunta: niente }, SCRITTURE);
  verifica('fra le richieste completate la nota interna e le annotazioni, da leggere', leggi(rc).includes('Nota interna: Risposto il 10/10') && leggi(rc).includes('Chiamato il produttore')
    && !/Aggiungi un’annotazione|Correggi la nota interna|>\s*Nota interna\s*</.test(rc), leggi(rc).slice(0, 500));
  const nr = L.disegna('NoteRichiesta', { richiesta: { id: 'r1', note_interne: 'Chiude il sabato', annotazioni: NOTE() }, modificabile: true }, SCRITTURE);
  verifica('su una richiesta da ritirare, per l\'amministratore: la nota, «Correggi la nota interna» e «Aggiungi»', leggi(nr).includes('Nota interna: Chiude il sabato') && /Correggi la nota interna/.test(nr) && /Aggiungi un’annotazione/.test(nr));
  const modulo = L.disegna('ModuloAttivita', { modifica: true, iniziale: S.valoriDelModulo(BASE), onSalva: niente, onAnnulla: niente });
  verifica('il modulo di modifica disegnato, gia\' compilato', /value="Sollecito Rossi"/.test(modulo) && /value="2026-10-20"/.test(modulo) && /<option value="media" selected="">/.test(modulo) && leggi(modulo).includes('Salva le modifiche'), leggi(modulo).slice(0, 300));
  verifica('nessuna parola della piattaforma a video', ![html, lettore, canc, rc, nr, modulo].some(x => /base44/i.test(leggi(x))));
});

await prova('a 375 px', () => {
  for (const f of ['Annotazioni.jsx', 'NoteRichiesta.jsx', 'ModuloAttivita.jsx']) {
    const s = sorgente(`src/components/todo/${f}`);
    verifica(`${f}: c'e', senza larghezze fisse ne' title= (si legge senza scorrere)`, s.length > 0 && !/\b(?:min-)?w-(?:\d{2,}|\[\d+px\])\b|min-w-\[/.test(s) && !/\stitle=/.test(s));
    verifica(`${f}: i testi lunghi vanno a capo`, /break-words|break-all|grid-cols-1/.test(s));
  }
});

globalThis.window = finestraPrima;
try { rmSync(cartella, { recursive: true, force: true }); } catch { /* la cartella temporanea si pulisce da sola */ }

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
