// LA TO-DO LIST: UN ORDINE CANCELLATO A PORTALE PASSA DA SOLO FRA I CANCELLATI
// (14/10/2026).
//
// Richiesta dell'utente, testuale: «nella to-do list, qualora vi fossero degli
// ordini tra quelli aperti che venissero non eseguiti e quindi terminati bensi'
// cancellati a portale devono comparire automaticamente nei cancellati con data
// di cancellazione; a me non serve decidere sul gestionale cio' che e' gia'
// chiaro ed evidente sul portale». Fino a quel giorno un'attivita' col suo ordine
// cancellato restava aperta con l'avviso "che cosa farne lo decidi tu", e una
// richiesta ECT col suo ordine cancellato restava «in attesa del ritiro» per
// sempre. Qui si prova:
//
// 1. la regola (base44/shared/todoOrdini.ts): un'attivita' che aspettava un
//    ordine poi cancellato passa fra le cancellate; con un ordine terminato e uno
//    cancellato si chiude evasa in parte; un ordine ancora assegnato o "eseguito"
//    la tiene aperta; un ordine fra gli assegnati non e' cancellato; chi e' stato
//    riaperto a mano non si ricancella. Il passaggio si deve vedere anche per i
//    cancellati: un'attivita' scritta su ordini gia' chiusi resta aperta e dice
//    perche', tranne quelle a cui il gestionale di prima aveva chiesto «che cosa
//    farne lo decidi tu» (la risposta dell'utente vale una volta). Il giorno della
//    cancellazione non si prende da Ordine_chiuso_il (revisione del 14/10/2026);
// 2. le sezioni (src/lib/todoSezioni.js): le cancellate fuori dai da fare e dal
//    numero del menu, col giorno detto per quello che e', e l'elenco vuoto che
//    dice dove sono;
// 3. le richieste ECT (richiesteEct.ts): annullate da sole, o evase in parte,
//    con lo stato dei loro ordini salvato; riaperte se il portale riassegna
//    l'ordine; lo stato degli ordini scritto prima dell'esito che lo legge;
// 4. il banco: controllaTodoOrdini e importaRichiesteEct veri, con un SDK finto;
// 5. la pagina vera (src/pages/TodoPage.jsx) montata senza browser, e la sezione
//    delle cancellate e quella delle richieste completate disegnate con React.
// L'orologio e' fermo al 15/10/2026. node prove/todoCancellatiDalPortale.mjs
import { build } from 'esbuild';
import { existsSync, readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { caricaPagina, clienteFinto, aspetta, trova, testo as testoAlbero } from './dati/paginaFinta.mjs';

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
// Col codice di prima alcune funzioni non ci sono: la prova lo dice, non si ferma.
const prova = async (nome, fn) => { try { await fn(); } catch (e) { verifica(nome, false, String(e && e.message).slice(0, 300)); } };
const sorgente = (p) => (existsSync(qui('../' + p)) ? readFileSync(qui('../' + p), 'utf8').replace(/\r/g, '') : '');

const T = await import('../base44/shared/todoOrdini.ts');
const R = await import('../base44/shared/richiesteEct.ts');
const S = await import('../src/lib/todoSezioni.js');
const OGGI = '2026-10-15';

// Gli ordini: 101 cancellato, 102 cancellato con Ordine_chiuso_il alle 00:30
// italiane del 13/10 (22:30Z del 12: NON e' il giorno della cancellazione), 103
// terminato il 09/10, 104 ancora assegnato, 105 "eseguito", 106 con una riga
// cancellata rimasta ma di nuovo fra gli assegnati, 107 cancellato con
// Ordine_chiuso_il del 01/10, 108 terminato con la fine trasporto nel futuro.
const MOVIMENTI = [
  { id_ordine: 'ET26000101', stato: 'cancellato', motivo_cancellazione: 'altro: pdr doppio', ordine_immesso_il: '2026-09-01T07:00:00Z', punto_di_raccolta: 'ROSSI GOMME' },
  { id_ordine: 'ET26000102', stato: 'cancellato', motivo_cancellazione: 'Ordine doppio', ordine_chiuso_il: '2026-10-12T22:30:00Z' },
  { id_ordine: 'ET26000103', stato: 'terminato', ordine_immesso_il: '2026-09-03T07:00:00Z', trasporto_iniziato_il: '2026-10-08T07:00:00Z', trasporto_finito_il: '2026-10-09T08:00:00Z', ordine_chiuso_il: '2026-10-14T08:00:00Z', punto_di_raccolta: 'VERDI AUTO' },
  { id_ordine: 'ET26000105', stato: 'eseguito', ordine_immesso_il: '2026-09-05T07:00:00Z', trasporto_iniziato_il: '2026-10-10T07:00:00Z', trasporto_finito_il: '2026-10-10T09:00:00Z' },
  { id_ordine: 'ET26000106', stato: 'cancellato', motivo_cancellazione: 'cancellato per errore' },
  { id_ordine: 'ET26000107', stato: 'cancellato', motivo_cancellazione: 'Mancanza PFU', ordine_chiuso_il: '2026-10-01T10:00:00Z' },
  { id_ordine: 'ET26000108', stato: 'terminato', trasporto_finito_il: '2027-01-05T08:00:00Z' },
];
const ASSEGNATI = [
  { id_ordine: 'ET26000104', stato: 'assegnato', ordine_immesso_il: '2026-09-02T07:00:00Z', punto_di_raccolta: 'BIANCHI PNEUMATICI' },
  { id_ordine: 'ET26000106', stato: 'assegnato' },
];
const TUTTI = ['ET26000101', 'ET26000102', 'ET26000103', 'ET26000104', 'ET26000105', 'ET26000106', 'ET26000107', 'ET26000108'];
// Prima: tutti assegnati. Dopo: gli archivi di oggi.
const statoPrima = T.statoOrdini([], TUTTI.map(id => ({ id_ordine: id, stato: 'assegnato' })));
const statoDopo = T.statoOrdini(MOVIMENTI, ASSEGNATI);
const giro = (todo, s) => { const r = T.controlloAttivita(todo, s, OGGI); return { ...r, dopo: { ...todo, ...r.campi } }; };
// Un'attivita' guardata quando i suoi ordini erano aperti, e poi di nuovo oggi.
const dopoIlPassaggio = (todo) => giro(giro(todo, statoPrima).dopo, statoDopo);
// La domanda che il gestionale di prima scriveva sulle attivita' con un ordine cancellato.
const DOMANDA = "L'ordine ET26000107 (Mancanza PFU) risulta cancellato: l'attività resta aperta e quel ritiro non si farà, e che cosa farne lo decidi tu.";

// ---------------------------------------------------------------------------
console.log('1. LA REGOLA: UN ORDINE CANCELLATO A PORTALE MANDA L\'ATTIVITA\' FRA LE CANCELLATE');

await prova('lo stato degli ordini', () => {
  verifica('il motivo del portale, scritto come in Evasione Assegnati', statoDopo.cancellati.get('ET26000101') === 'Pdr doppio', statoDopo.cancellati.get('ET26000101'));
  verifica('il giorno della cancellazione non si prende da Ordine_chiuso_il (e\' il clic su Chiudi di un trasporto, non la cancellazione)',
    !('cancellatiIl' in statoDopo), J(Object.keys(statoDopo)));
  verifica('un ordine di nuovo fra gli assegnati non e\' cancellato, anche se una sua riga cancellata e\' rimasta', !statoDopo.cancellati.has('ET26000106'));
});

await prova('un ordine assegnato e poi cancellato', () => {
  const a = { titolo: 'Ritiro Rossi', riferimento_ordine: 'ET26000101', stato: 'aperto' };
  const g1 = giro(a, statoPrima);
  verifica('finche\' e\' assegnato resta aperta e si aspetta', g1.chiusa === false && g1.campi.stato === undefined && g1.campi.ordini_da_attendere === 'ET26000101', J(g1.campi));
  const g2 = giro(g1.dopo, statoDopo);
  verifica('cancellato a portale: passa da sola fra le cancellate', g2.chiusa === true && g2.come === 'cancellata' && g2.campi.stato === 'cancellato'
    && g2.campi.chiusa_dal_gestionale === true && g2.campi.chiusa_dal_gestionale_il === OGGI, J(g2.campi));
  verifica('nessun giorno della cancellazione inventato: si scrive solo il giorno in cui il gestionale l\'ha vista', !('cancellata_il' in g2.campi) && !/13\/10|2026-10-13/.test(J(g2.campi)), J(g2.campi));
  verifica('il perche\' col motivo del portale, senza chiedere decisioni', g2.campi.chiusura_nota === "cancellata dal gestionale il 15/10/2026: l'ordine ET26000101 (Pdr doppio) risulta cancellato a portale"
    && g2.campi.avviso_ordini === '' && !/decidi/.test(J(g2.campi)), J(g2.campi));
  const g3 = giro(g2.dopo, statoDopo);
  verifica('rifatto il controllo, non cambia piu\' niente', g3.chiusa === false && Object.keys(g3.campi).every(k => String(g2.dopo[k] ?? '') === String(g3.campi[k] ?? '')), J(g3.campi));
});

await prova('gia\' cancellato quando l\'attivita\' compare: il passaggio non c\'e\'', () => {
  // L'attivita' di chi deve contestare la cancellazione: se passasse fra le
  // cancellate sparirebbe appena salvata (la pagina la controlla subito).
  const sola = { titolo: 'Contestare la cancellazione di ET26000102', riferimento_ordine: 'ET26000102', stato: 'in_corso' };
  const g = giro(sola, statoDopo);
  verifica('scritta su un ordine gia\' cancellato: resta da fare', g.chiusa === false && g.come === null && g.campi.stato === undefined, J(g.campi));
  verifica('e l\'avviso dice perche\', senza chiedere di decidere', g.campi.avviso_ordini === "L'ordine ET26000102 (Ordine doppio) risulta cancellato a portale: quel ritiro non si farà. L'attività non passa da sola fra le cancellate perché il gestionale non ha visto l'ordine passare da assegnato a cancellato mentre lei era da fare: se non serve più, spuntala o eliminala tu.", g.campi.avviso_ordini);
  const g2 = giro(g.dopo, statoDopo);
  verifica('e al giro dopo resta cosi\'', g2.chiusa === false && g2.campi.stato === undefined, J(g2.campi));
  // Lo script della revisione: un terminato di giugno e un cancellato di maggio,
  // attivita' scritta oggi. «Solo allora» (28/09/2026) vale anche per l'«evasa in parte».
  const MOV = [
    { id_ordine: 'ET26000201', stato: 'terminato', ordine_immesso_il: '2026-06-01T07:00:00Z', trasporto_iniziato_il: '2026-06-10T07:00:00Z', trasporto_finito_il: '2026-06-10T09:00:00Z' },
    { id_ordine: 'ET26000202', stato: 'cancellato', motivo_cancellazione: 'Ritirato da altro operatore', ordine_immesso_il: '2026-05-01T07:00:00Z' },
  ];
  const nuova = T.controlloAttivita({ titolo: 'Contestare e fatturare', riferimento_ordine: 'ET26000201, ET26000202', stato: 'aperto' }, T.statoOrdini(MOV, []), OGGI);
  verifica('un terminato di giugno e un cancellato di maggio al primo controllo: non si completa «in parte»', nuova.chiusa === false && nuova.campi.stato === undefined, J(nuova.campi));
  verifica('e l\'avviso dice perche\'', nuova.campi.avviso_ordini.endsWith("L'attività non si chiude da sola perché il gestionale non ha visto i suoi ordini passare da assegnati a terminati o cancellati mentre lei era da fare: la spunta la metti tu."), nuova.campi.avviso_ordini);
});

await prova('la domanda del gestionale di prima ha avuto risposta', () => {
  // Il gestionale di prima aveva visto il passaggio (consumato) e chiesto che cosa farne.
  const vecchia = { titolo: 'Ritiro Gialli', riferimento_ordine: 'ET26000107', stato: 'aperto', ordini_attesi: 'ET26000107', ordini_da_attendere: '', ordini_totali: 1, ordini_terminati: 0, avviso_ordini: DOMANDA };
  const g = giro(vecchia, statoDopo);
  verifica('passa fra le cancellate, una volta, e la domanda sparisce', g.come === 'cancellata' && g.campi.stato === 'cancellato' && g.campi.avviso_ordini === ''
    && g.campi.chiusura_nota === "cancellata dal gestionale il 15/10/2026: l'ordine ET26000107 (Mancanza PFU) risulta cancellato a portale", J(g.campi));
  const altri = giro({ ...vecchia, riferimento_ordine: 'ET26000102' }, statoDopo);
  verifica('con ordini cambiati la domanda era su altri ordini: non vale', altri.chiusa === false && altri.campi.stato === undefined, J(altri.campi));
  const conAssegnato = giro({ ...vecchia, riferimento_ordine: 'ET26000107, ET26000104', ordini_attesi: 'ET26000107, ET26000104', ordini_da_attendere: 'ET26000104' }, statoDopo);
  verifica('con un ordine ancora assegnato resta aperta, e la domanda non c\'e\' piu\'', conAssegnato.chiusa === false && !/decidi/.test(conAssegnato.campi.avviso_ordini), conAssegnato.campi.avviso_ordini);
  const inParte = giro({ ...vecchia, riferimento_ordine: 'ET26000103, ET26000107', ordini_attesi: 'ET26000103, ET26000107' }, statoDopo);
  verifica('un terminato e un cancellato senza passaggio: la risposta vale per i cancellati, il terminato vuole il passaggio', inParte.chiusa === false && inParte.campi.stato === undefined, J(inParte.campi));
});

await prova('due ordini', () => {
  const tutte = dopoIlPassaggio({ titolo: 'Due cancellati', riferimento_ordine: 'ET26000102, ET26000107', stato: 'aperto' });
  verifica('tutti e due cancellati: cancellata', tutte.come === 'cancellata'
    && tutte.campi.chiusura_nota.includes('gli ordini ET26000102 (Ordine doppio) e ET26000107 (Mancanza PFU) risultano cancellati a portale'), J(tutte.campi));
  const m2 = dopoIlPassaggio({ titolo: 'Ritiri Verdi', riferimento_ordine: 'ET26000103, ET26000101', stato: 'aperto' });
  verifica('uno terminato e uno cancellato: fra i completati, evasa in parte, detta come tale', m2.come === 'in_parte' && m2.campi.stato === 'completato'
    && m2.campi.chiusura_nota === "chiusa dal gestionale il 15/10/2026: evasa in parte, l'ordine ET26000103 risulta terminato, trasporto finito il 09/10/2026, e l'ordine ET26000101 (Pdr doppio) risulta cancellato a portale", J(m2.campi));
  verifica('la data del ritiro e\' la fine trasporto (09/10), mai la chiusura a portale (14/10)', !m2.campi.chiusura_nota.includes('14/10'));
  const conAssegnato = dopoIlPassaggio({ titolo: 'Uno ancora assegnato', riferimento_ordine: 'ET26000104, ET26000101', stato: 'aperto' });
  verifica('uno ancora assegnato: resta aperta, e dice del cancellato senza chiedere niente', conAssegnato.chiusa === false && conAssegnato.campi.stato === undefined
    && conAssegnato.campi.avviso_ordini === "L'ordine ET26000101 (Pdr doppio) risulta cancellato a portale: quel ritiro non si farà, e l'attività resta aperta per l'altro ordine.", conAssegnato.campi.avviso_ordini);
  const conEseguito = dopoIlPassaggio({ titolo: 'Uno eseguito', riferimento_ordine: 'ET26000105, ET26000101', stato: 'aperto' });
  verifica('uno "eseguito": resta aperta, e l\'eseguito si dice', conEseguito.chiusa === false && conEseguito.campi.avviso_ordini.includes('“eseguito”'), conEseguito.campi.avviso_ordini);
  const futuro = dopoIlPassaggio({ titolo: 'Fine nel futuro', riferimento_ordine: 'ET26000108, ET26000101', stato: 'aperto' });
  verifica('una fine trasporto nel futuro non chiude niente, nemmeno in parte', futuro.chiusa === false && futuro.campi.stato === undefined, J(futuro.campi));
});

await prova('quello che resta com\'era', () => {
  const ancora = giro({ titolo: 'Assegnato', riferimento_ordine: 'ET26000104', stato: 'aperto' }, statoDopo);
  verifica('un ordine ancora assegnato: aperta', ancora.chiusa === false && ancora.campi.stato === undefined && ancora.campi.avviso_ordini === '', J(ancora.campi));
  const riaperto = dopoIlPassaggio({ titolo: 'Riaperto a portale', riferimento_ordine: 'ET26000106', stato: 'aperto' });
  verifica('cancellato per errore e di nuovo assegnato: aperta', riaperto.chiusa === false && riaperto.campi.stato === undefined, J(riaperto.campi));
  const aMano = giro({ titolo: 'Riaperta a mano', riferimento_ordine: 'ET26000101', stato: 'aperto', chiusa_dal_gestionale: true, chiusura_nota: 'cancellata dal gestionale il 14/10/2026: ...', ordini_attesi: 'ET26000101', ordini_da_attendere: '' }, statoDopo);
  verifica('riaperta a mano dopo la cancellazione: non si ricancella, e dice il fatto', aMano.chiusa === false && aMano.campi.stato === undefined
    && aMano.campi.avviso_ordini === "L'ordine ET26000101 (Pdr doppio) risulta cancellato a portale: quel ritiro non si farà.", J(aMano.campi));
  const tornato = giro({ titolo: 'Tornato assegnato', riferimento_ordine: 'ET26000106', stato: 'cancellato', chiusa_dal_gestionale: true, ordini_attesi: 'ET26000106', ordini_da_attendere: '' }, statoDopo);
  verifica('cancellata dal gestionale e l\'ordine di nuovo assegnato: non torna indietro da sola, lo dice', tornato.chiusa === false && tornato.campi.stato === undefined
    && tornato.campi.avviso_ordini.includes('di nuovo assegnato') && tornato.campi.avviso_ordini.includes('riaprila'), tornato.campi.avviso_ordini);
  const fatta = giro({ titolo: 'Spuntata', riferimento_ordine: 'ET26000101', stato: 'completato', completata_il: '2026-10-10' }, statoDopo);
  verifica('una completata a mano non si tocca, e non si dice che resta aperta', fatta.chiusa === false && fatta.campi.stato === undefined && fatta.campi.avviso_ordini === '', J(fatta.campi));
  const vecchia = giro({ titolo: 'Ordine correlato', riferimento_ordine: 'ET26000103', stato: 'aperto' }, statoDopo);
  verifica('i terminati vogliono ancora il passaggio: gia\' terminato al primo controllo, non si chiude', vecchia.chiusa === false && T.notaOrdini(vecchia.dopo).includes('già terminato'), J(vecchia.campi));
});

await prova('la riga dopo il caricamento', () => {
  verifica('dice le cancellate',
    T.testoControlloTodo([], [], [{ titolo: 'Ritiro Rossi', ordini: 'ET26000101' }]) === "Un'attività è passata da sola fra le cancellate, il suo ordine risulta cancellato a portale: Ritiro Rossi (ET26000101).",
    T.testoControlloTodo([], [], [{ titolo: 'Ritiro Rossi', ordini: 'ET26000101' }]));
  // Lo script della revisione: una cancellata il cui ordine il portale ha riassegnato.
  const avviso = "L'ordine ET26000106 risulta di nuovo assegnato a portale: l'attività era passata fra le cancellate, se serve ancora riaprila.";
  const una = T.testoControlloTodo([], [{ titolo: 'Ritiro Rossi', avviso, stato: 'cancellato' }]);
  verifica('di un\'attivita\' gia\' fra le cancellate non dice che «resta aperta»', !/resta aperta|restano aperte/.test(una)
    && una === `Fra le attività già chiuse della to-do list una ha qualcosa da guardare: Ritiro Rossi - ${avviso}`, una);
  const miste = T.testoControlloTodo([], [{ titolo: 'A', avviso: 'x', stato: 'aperto' }, { titolo: 'B', avviso: 'y', stato: 'cancellato' }, { titolo: 'C', avviso: 'z', stato: 'completato' }]);
  verifica('le aperte e le gia\' chiuse ognuna con la sua frase', miste === "Un'attività della to-do list resta aperta e va guardata: A - x Fra le attività già chiuse della to-do list 2 hanno qualcosa da guardare: B, C.", miste);
});

// ---------------------------------------------------------------------------
console.log('2. LE SEZIONI: LE CANCELLATE FUORI DAI DA FARE E DAL NUMERO DEL MENU');
const TODOS = [
  { id: 'a', titolo: 'Sollecito', stato: 'aperto', created_date: '2026-10-10T08:00:00Z' },
  { id: 'b', titolo: 'Pratica', stato: 'in_corso', created_date: '2026-10-09T08:00:00Z' },
  { id: 'c', titolo: 'Fattura', stato: 'completato', completata_il: '2026-10-05', created_date: '2026-09-01T08:00:00Z' },
  { id: 'd', titolo: 'Ritiro Rossi', stato: 'cancellato', riferimento_ordine: 'ET26000101', chiusa_dal_gestionale: true, chiusa_dal_gestionale_il: '2026-10-15', chiusura_nota: "cancellata dal gestionale il 15/10/2026: l'ordine ET26000101 (Pdr doppio) risulta cancellato a portale", created_date: '2026-09-20T08:00:00Z' },
  // cancellata_il e' un campo che il gestionale non scrive piu': se c'e' non vale
  { id: 'e', titolo: 'Ritiro doppio', stato: 'cancellato', riferimento_ordine: 'ET26000102', chiusa_dal_gestionale: true, chiusa_dal_gestionale_il: '2026-10-14', cancellata_il: '2026-10-13', chiusura_nota: "cancellata dal gestionale il 14/10/2026: l'ordine ET26000102 (Ordine doppio) risulta cancellato a portale", created_date: '2026-09-21T08:00:00Z' },
  { id: 'f', titolo: 'Ritiro vecchio', stato: 'cancellato', riferimento_ordine: 'ET26000107', chiusa_dal_gestionale: true, chiusa_dal_gestionale_il: '2026-10-10', chiusura_nota: "cancellata dal gestionale il 10/10/2026: l'ordine ET26000107 (Mancanza PFU) risulta cancellato a portale", created_date: '2026-09-22T08:00:00Z' },
];
const ids = (xs) => (xs || []).map(t => t.id).join('');
await prova('la divisione', () => {
  const { daFare, completati, cancellati } = S.dividiAttivita(TODOS);
  verifica('da fare: aperte e in corso, nessuna cancellata', ids(daFare) === 'ab', ids(daFare));
  verifica('completati: solo le completate', ids(completati) === 'c', ids(completati));
  verifica('cancellati: le cancellate, dalle piu\' recenti (15/10, 14/10, 10/10)', ids(cancellati) === 'def', ids(cancellati));
  verifica('i numeri: le cancellate non sono da fare', J(S.conteggiAttivita(TODOS)) === J({ da_fare: 2, aperto: 1, in_corso: 1, completati: 1, cancellati: 3 }), J(S.conteggiAttivita(TODOS)));
  const testoDi = (id) => S.testoCancellazione(S.cancellazioneAttivita(TODOS.find(t => t.id === id)));
  verifica('il giorno che si sa, detto per quello che e\'', testoDi('d') === "Passata fra le cancellate il 15/10/2026: l'ordine ET26000101 (Pdr doppio) risulta cancellato a portale.", testoDi('d'));
  verifica('un cancellata_il rimasto non diventa il giorno della cancellazione', testoDi('e') === "Passata fra le cancellate il 14/10/2026: l'ordine ET26000102 (Ordine doppio) risulta cancellato a portale.", testoDi('e'));
  verifica('riaprirla scrive solo lo stato', J(S.campiCambioStato(TODOS[3], 'aperto', OGGI)) === J({ stato: 'aperto' }));
});
await prova('l\'elenco vuoto dice dove sono', () => {
  const v = (t) => S.testoElencoVuoto('tutti', { daFare: 0, completati: 0, cancellati: 0, ...t }, true);
  verifica('solo cancellate: non «Nessuna attività. Crea la prima»', v({ cancellati: 2 }) === 'Niente da fare: le attività sono tutte fra le cancellate, le trovi qui sotto.', v({ cancellati: 2 }));
  verifica('completate e cancellate: non «tutte completate»', v({ completati: 1, cancellati: 1 }) === 'Niente da fare: le attività sono tutte completate o cancellate, le trovi qui sotto.', v({ completati: 1, cancellati: 1 }));
  verifica('come prima senza cancellate', v({}) === 'Nessuna attività. Crea la prima col pulsante «Nuovo To-Do».' && v({ completati: 3 }) === 'Niente da fare: le attività sono tutte completate, le trovi qui sotto.'
    && S.testoElencoVuoto('in_corso', { daFare: 2 }, true) === 'Nessuna attività in corso.' && S.testoElencoVuoto('tutti', {}, false) === 'Nessuna attività.');
});
await prova('il numero del menu', async () => {
  const f = clienteFinto({ archivi: { Todo: TODOS } });
  const n = await S.contaDaFare(f.cliente.entities.Todo);
  verifica('contaDaFare non conta le cancellate, ed e\' il «Da fare» della pagina', n === 2 && n === S.conteggiAttivita(TODOS).da_fare, J(n));
});

// ---------------------------------------------------------------------------
console.log('3. LE RICHIESTE ECT: QUELLO CHE IL PORTALE HA CHIUSO NON SI DECIDE A MANO');
await prova('lo stato salvato dei loro ordini', () => {
  const v = R.statoOrdiniRichiesta(['ET26000101', 'ET26000102', 'ET26000103'], statoDopo, null, OGGI);
  verifica('un cancellato porta il motivo e il giorno in cui si e\' visto, non Ordine_chiuso_il',
    J(v[0]) === J({ id_ordine: 'ET26000101', stato: 'cancellato', motivo: 'Pdr doppio', visto_il: OGGI })
    && J(v[1]) === J({ id_ordine: 'ET26000102', stato: 'cancellato', motivo: 'Ordine doppio', visto_il: OGGI }) && v[2].stato === 'terminato' && v[2].giorno === '2026-10-09', J(v));
  verifica('il cancellato non ha `giorno`: quello e\' il ritiro', !('giorno' in v[0]), J(v[0]));
  const dopo = R.statoOrdiniRichiesta(['ET26000101'], statoDopo, J([{ id_ordine: 'ET26000101', stato: 'cancellato', visto_il: '2026-10-11' }]), OGGI);
  verifica('il giorno in cui si e\' visto si porta avanti, non cambia a ogni ricalcolo', dopo[0].visto_il === '2026-10-11', J(dopo));
});
const json = (idsR, prec) => J(R.statoOrdiniRichiesta(idsR, statoDopo, prec || null, OGGI));
const RICH = {
  canc: { id: 'r1', pdr_nome: 'ROSSI GOMME', id_ordine: 'ET26000101', esito: 'aperta', mail_inviata_il: '2026-09-20', ordini_stato_json: json(['ET26000101']) },
  doppio: { id: 'r2', pdr_nome: 'NERI GOMME', id_ordine: 'ET26000102', esito: 'annullata', mail_inviata_il: '2026-09-21', ordini_stato_json: J([{ id_ordine: 'ET26000102', stato: 'cancellato', motivo: 'Ordine doppio', visto_il: '2026-10-12' }]) },
  parte: { id: 'r3', pdr_nome: 'VERDI AUTO', id_ordine_manuale: 'ET26000103, ET26000101', ordini_totali: 2, ordini_evasi: 1, esito: 'evasa', mail_inviata_il: '2026-09-22', ordini_stato_json: json(['ET26000103', 'ET26000101']) },
  aperta: { id: 'r4', pdr_nome: 'BIANCHI PNEUMATICI', id_ordine_manuale: 'ET26000104, ET26000101', esito: 'aperta', mail_inviata_il: '2026-09-23', ordini_stato_json: json(['ET26000104', 'ET26000101']) },
  foglio: { id: 'r5', pdr_nome: 'GIALLI', id_ordine: 'ET26000101', motivo_annullamento: 'il produttore ha gia\' conferito', esito: 'annullata', mail_inviata_il: '2026-09-24', ordini_stato_json: json(['ET26000101']) },
};
await prova('statoRichiesta', () => {
  verifica('i suoi ordini tutti cancellati a portale: annullata da sola', R.statoRichiesta(RICH.canc) === 'annullata');
  verifica('uno terminato e uno cancellato: evasa (in parte)', R.statoRichiesta(RICH.parte) === 'evasa' && R.evasaInParte(RICH.parte) && !R.evasaInParte(RICH.canc));
  verifica('uno ancora assegnato: aperta', R.statoRichiesta(RICH.aperta) === 'aperta');
  verifica('uno stato salvato che non copre gli ordini di adesso non decide niente', R.statoRichiesta({ ...RICH.canc, id_ordine_manuale: 'ET26000101, ET26000104' }) === 'aperta');
  verifica('senza stato salvato, come prima', R.statoRichiesta({ pdr_nome: 'X', id_ordine: 'ET26000101' }) === 'aperta');
  verifica('l\'esito della pagina rilegge un\'«aperta» rimasta indietro di un ricalcolo', S.esitoDellaPagina(RICH.canc, R.statoRichiesta) === 'annullata' && S.esitoDellaPagina(RICH.aperta, R.statoRichiesta) === 'aperta');
});

await prova('chi si ricalcola: le chiuse dal portale, che il portale puo\' riaprire', () => {
  const casi = {
    aperta: [{ esito: 'aperta' }, true],
    vecchia: [{ esito: 'da_confermare' }, true],
    senzaEsito: [{}, true],
    dalPortale: [{ esito: 'annullata' }, true],
    dalFoglio: [{ esito: 'annullata', motivo_annullamento: 'gia\' conferito' }, false],
    inParte: [{ esito: 'evasa' }, true],
    ritirata: [{ esito: 'evasa', evasione_rilevata_il: '2026-10-09' }, false],
    dalFoglioEvasa: [{ esito: 'evasa', evaso_il: '2026-10-09' }, false],
    spuntata: [{ esito: 'evasa', evasione_confermata: true }, false],
  };
  const sbagliati = Object.entries(casi).filter(([, [r, atteso]]) => R.daRicalcolare(r) !== atteso).map(([n]) => n);
  verifica('daRicalcolare', sbagliati.length === 0, J(sbagliati));
  // La pagina rilegge le stesse (esitoDellaPagina ripete chiusaDalPortale senza importarla).
  const finto = () => 'RILETTA';
  const diversi = Object.entries(casi).filter(([, [r]]) => (S.esitoDellaPagina(r, finto) === 'RILETTA') !== R.daRicalcolare(r)).map(([n]) => n);
  verifica('la pagina rilegge proprio quelle che il caricamento ricalcola', diversi.length === 0, J(diversi));
});

// Il ricalcolo dopo le primarie, come va fatto in importaBlocco (riconosciRitiriEct)
// con le funzioni di richiesteEct.ts: le richieste da ricalcolare, e per ognuna lo
// stato dei suoi ordini e l'esito insieme, nell'ordine giusto.
const ricalcolo = (r, movimenti, assegnati, oggi) => {
  if (!R.daRicalcolare(r)) return r;
  const stato = T.statoOrdini(movimenti, assegnati);
  const idsR = R.listaOrdini(r);
  const ev = R.evasioneOrdini(idsR, stato.terminati);
  const campi = { ordini_totali: ev.totali, ordini_evasi: ev.evasi, evasione_rilevata_il: ev.ultima || null };
  return { ...r, ...campi, ...R.ordiniEdEsitoRichiesta(r, campi, idsR, stato, oggi) };
};
await prova('un ordine cancellato per errore e riassegnato: la richiesta torna aperta', () => {
  // Lo script della revisione (riassegnato.mjs): quattro caricamenti delle primarie.
  const cancellato = [[{ id_ordine: 'ET26000106', stato: 'cancellato', motivo_cancellazione: 'altro: per errore' }], []];
  const riassegnato = [[], [{ id_ordine: 'ET26000106', stato: 'assegnato' }]];
  let r = { id: 'r1', pdr_nome: 'ROSSI GOMME', id_ordine_manuale: 'ET26000106', scadenza: '2026-11-30', esito: 'aperta' };
  const esiti = [];
  for (const [n, [mov, ass], giorno] of [[1, cancellato, '2026-10-13'], [2, riassegnato, '2026-10-14'], [3, riassegnato, OGGI], [4, riassegnato, OGGI]]) {
    r = ricalcolo(r, mov, ass, giorno);
    esiti.push(`${n}:${r.esito}/${S.esitoDellaPagina(r, R.statoRichiesta)}`);
  }
  verifica('cancellato: annullata gia\' al caricamento che lo vede; riassegnato: aperta dal caricamento dopo, salvata e a video', J(esiti) === J(['1:annullata/annullata', '2:aperta/aperta', '3:aperta/aperta', '4:aperta/aperta']), J(esiti));
  // Anche la pagina, se l'esito scritto e' rimasto indietro (com'era col calcolo al contrario).
  const indietro = { id: 'r1', pdr_nome: 'ROSSI GOMME', id_ordine_manuale: 'ET26000106', esito: 'annullata', ordini_stato_json: J([{ id_ordine: 'ET26000106', stato: 'assegnato', giorno: '' }]) };
  verifica('un\'annullata dal portale col suo ordine di nuovo assegnato: a video e\' aperta', S.esitoDellaPagina(indietro, R.statoRichiesta) === 'aperta');
  const dalFoglio = { ...indietro, motivo_annullamento: 'il produttore ha gia\' conferito' };
  verifica('un\'annullata dal foglio resta annullata', S.esitoDellaPagina(dalFoglio, R.statoRichiesta) === 'annullata' && ricalcolo(dalFoglio, [], [], OGGI) === dalFoglio);
  // Un'evasa in parte il cui ordine cancellato torna assegnato.
  const parte = ricalcolo(RICH.parte, MOVIMENTI.filter(m => m.id_ordine !== 'ET26000101'), [...ASSEGNATI, { id_ordine: 'ET26000101', stato: 'assegnato' }], OGGI);
  verifica('un\'evasa in parte col cancellato riassegnato torna aperta', parte.esito === 'aperta', J(parte));
});
await prova('l\'esito salvato e\' quello della pagina, col giorno', async () => {
  // Lo script della revisione (ritiriEct.mjs): richiesta scaduta il 01/10, ordine appena cancellato.
  const r0 = { id: 'r1', anno: 2026, pdr_nome: 'ROSSI GOMME', id_ordine: 'ET26000101', id_ordine_stato: 'trovato', ordine_immesso_il: '2026-09-01', scadenza: '2026-10-01', esito: 'aperta' };
  const r1 = ricalcolo(r0, MOVIMENTI, ASSEGNATI, OGGI);
  verifica('al primo caricamento l\'esito salvato e\' gia\' quello della pagina', r1.esito === 'annullata' && S.esitoDellaPagina(r1, R.statoRichiesta) === 'annullata', r1.esito);
  const testo1 = S.testoCompletamentoRichiesta(S.completamentoRichiesta(r1, S.esitoDellaPagina(r1, R.statoRichiesta)));
  verifica('e a video c\'e\' il giorno', testo1 === 'Annullata da sola il 15/10/2026: l’ordine ET26000101 (Pdr doppio) risulta cancellato a portale.', testo1);
  const visto = ricalcolo({ ...r0, ordini_stato_json: J([{ id_ordine: 'ET26000101', stato: 'cancellato', motivo: 'Pdr doppio', visto_il: '2026-10-12' }]) }, MOVIMENTI, ASSEGNATI, OGGI);
  verifica('il giorno in cui si era vista cancellata (12/10) resta', /"visto_il":"2026-10-12"/.test(visto.ordini_stato_json), visto.ordini_stato_json);
  // La dashboard legge l'esito salvato: una richiesta annullata dal portale non e' scaduta.
  const C = await import('../base44/shared/cruscotto.ts');
  const cr = C.cruscotto({ oggi: OGGI, anno: 2026, adessoMs: ADESSO, tipiFile: [], uploadLogs: [], alertAperti: [], assegnatiRete: [], assegnatiAci: [], documenti: [], prefatture: [], richiesteEct: [r1] });
  verifica('e la dashboard non la dice «oltre il termine»', !/oltre il termine/.test(J(cr)), (J(cr).match(/[^"]*oltre il termine[^"]*/g) || []).join(' | '));
});

await prova('la riga delle completate', () => {
  const C = (r) => S.completamentoRichiesta(r, S.esitoDellaPagina(r, R.statoRichiesta));
  const Tx = (r) => S.testoCompletamentoRichiesta(C(r));
  verifica('cancellata a portale: il giorno in cui si e\' annullata da sola', Tx(RICH.canc) === 'Annullata da sola il 15/10/2026: l’ordine ET26000101 (Pdr doppio) risulta cancellato a portale.', Tx(RICH.canc));
  verifica('il giorno e\' quello in cui il gestionale l\'ha vista, non Ordine_chiuso_il', Tx(RICH.doppio) === 'Annullata da sola il 12/10/2026: l’ordine ET26000102 (Ordine doppio) risulta cancellato a portale.', Tx(RICH.doppio));
  const senza = { ...RICH.canc, ordini_stato_json: J([{ id_ordine: 'ET26000101', stato: 'cancellato', motivo: 'Pdr doppio', visto_il: '' }]) };
  verifica('senza il giorno non se ne inventa uno', Tx(senza) === 'Annullata da sola: l’ordine ET26000101 (Pdr doppio) risulta cancellato a portale.', Tx(senza));
  verifica('resta un\'annullata per chi la disegna (niente spunta), e non aspetta risposta', C(RICH.canc).come === 'annullata' && C(RICH.canc).dal_portale === true && C(RICH.canc).da_rispondere === false);
  verifica('evasa in parte, col giorno del ritiro (fine trasporto), da rispondere al consorzio', Tx(RICH.parte) === 'Evasa in parte, da sola: l’ordine ET26000103 risulta terminato e l’ordine ET26000101 (Pdr doppio) risulta cancellato a portale; ritiro del 09/10/2026.'
    && C(RICH.parte).da_rispondere === true, Tx(RICH.parte));
  verifica('l\'annullata dal foglio resta come prima', Tx(RICH.foglio) === "Annullata: il produttore ha gia' conferito.", Tx(RICH.foglio));
  const { daFare, completate } = S.dividiRichieste(Object.values(RICH), (r) => S.esitoDellaPagina(r, R.statoRichiesta));
  verifica('da ritirare resta solo quella con un ordine assegnato', ids(daFare) === 'r4', ids(daFare));
  verifica('le altre fra le completate: l\'evasa in parte in alto, le annullate in fondo', completate[0] && completate[0].id === 'r3' && completate.length === 4, ids(completate));
});

// ---------------------------------------------------------------------------
console.log('4. IL BANCO: LE FUNZIONI VERE');
const SDK_FINTO = `
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => (v && typeof v === 'object' && Array.isArray(v.$in) ? v.$in.includes(r[k]) : r[k] === v));
const ordina = (righe, ord) => {
  const campo = String(ord || 'id').replace(/^[-+]/, '') || 'id';
  const verso = String(ord || '').startsWith('-') ? -1 : 1;
  return [...righe].sort((a, b) => String(a[campo] ?? '').localeCompare(String(b[campo] ?? '')) * verso);
};
let progressivo = 0;
function entita(nome) {
  const righe = () => (globalThis.__ARCHIVI[nome] ||= []);
  return {
    filter: async (f, ord, quanti = 1e9, salta = 0) => ordina(righe().filter(r => soddisfa(r, f)), ord).slice(salta, salta + quanti).map(r => ({ ...r })),
    list: async (ord, quanti = 1e9, salta = 0) => ordina(righe(), ord).slice(salta, salta + quanti).map(r => ({ ...r })),
    create: async (d) => { const r = { id: nome + '-' + (++progressivo), ...d }; righe().push(r); globalThis.__SCRITTI.push({ op: 'create', nome, d }); return { ...r }; },
    update: async (id, d) => {
      const r = righe().find(x => x.id === id);
      if (!r) throw new Error('non trovato ' + id);
      Object.assign(r, d);
      globalThis.__SCRITTI.push({ op: 'update', nome, id, d });
      return { ...r };
    },
  };
}
const entities = new Proxy({}, { get: (_t, nome) => entita(nome) });
const integrations = { Core: { CreateFileSignedUrl: async () => ({ signed_url: 'https://file.finto/richieste.xlsx' }) } };
export function createClientFromRequest() {
  return { auth: { me: async () => globalThis.__UTENTE }, asServiceRole: { entities, integrations }, entities, integrations };
}`;
const impacchetta = async (nome) => {
  const p = await build({
    entryPoints: [qui(`../base44/functions/${nome}/entry.ts`)],
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
const ATTIVITA = () => [
  // aspettava 101, che adesso e' cancellato
  { id: 't1', titolo: 'Ritiro Rossi', stato: 'aperto', riferimento_ordine: 'ET26000101', ordini_attesi: 'ET26000101', ordini_da_attendere: 'ET26000101' },
  // aspettava 103 e 101: uno terminato, uno cancellato
  { id: 't2', titolo: 'Ritiri Verdi', stato: 'aperto', riferimento_ordine: 'ET26000103, ET26000101', ordini_attesi: 'ET26000103, ET26000101', ordini_da_attendere: 'ET26000103, ET26000101' },
  { id: 't3', titolo: 'Ritiro Bianchi', stato: 'aperto', riferimento_ordine: 'ET26000104' },
  // mai controllata, il suo ordine era gia' cancellato: resta da fare
  { id: 't4', titolo: 'Contestare la cancellazione', stato: 'in_corso', riferimento_ordine: 'ET26000102' },
  { id: 't5', titolo: 'Fattura Gialli', stato: 'completato', completata_il: '2026-10-10', riferimento_ordine: 'ET26000101', ordini_attesi: 'ET26000101', ordini_da_attendere: '' },
  // il gestionale di prima aveva chiesto che cosa farne
  { id: 't6', titolo: 'Ritiro Gialli', stato: 'aperto', riferimento_ordine: 'ET26000107', ordini_attesi: 'ET26000107', ordini_da_attendere: '', ordini_totali: 1, ordini_terminati: 0, avviso_ordini: DOMANDA },
  // gia' fra le cancellate, e il portale ha riassegnato il suo ordine
  { id: 't7', titolo: 'Ritiro Neri', stato: 'cancellato', chiusa_dal_gestionale: true, chiusa_dal_gestionale_il: '2026-10-14', riferimento_ordine: 'ET26000106', ordini_attesi: 'ET26000106', ordini_da_attendere: '' },
];
const preparaBanco = (utente) => {
  globalThis.__ARCHIVI = {
    Todo: ATTIVITA(),
    PrimariaRete: MOVIMENTI.map((m, i) => ({ id: 'p' + i, ...m })),
    PrimariaAci: [], ExtraRaccolta: [],
    Assegnato: ASSEGNATI.map((a, i) => ({ id: 'a' + i, ...a })), AssegnatoAci: [],
    UploadLog: [], RichiestaEct: [], FileDaRimuovere: [],
  };
  globalThis.__SCRITTI = [];
  globalThis.__UTENTE = utente;
};
const attivita = (id) => globalThis.__ARCHIVI.Todo.find(t => t.id === id);

await prova('controllaTodoOrdini', async () => {
  const modulo = await impacchetta('controllaTodoOrdini');
  preparaBanco({ role: 'admin', full_name: 'Amministratore' });
  const r = await chiama(modulo);
  verifica('risponde 200', r.status === 200, `${r.status} ${J(r.body).slice(0, 300)}`);
  verifica('l\'ordine atteso e\' cancellato: l\'attivita\' e\' passata fra le cancellate, salvata col giorno in cui si e\' vista', attivita('t1').stato === 'cancellato'
    && attivita('t1').chiusa_dal_gestionale === true && attivita('t1').chiusa_dal_gestionale_il === OGGI && !('cancellata_il' in attivita('t1')), J(attivita('t1')));
  verifica('mai controllata e gia\' cancellata: resta da fare, e dice perche\'', attivita('t4').stato === 'in_corso' && /non passa da sola fra le cancellate/.test(attivita('t4').avviso_ordini), J(attivita('t4')));
  verifica('la domanda di prima ha avuto risposta: fra le cancellate', attivita('t6').stato === 'cancellato' && attivita('t6').avviso_ordini === '', J(attivita('t6')));
  verifica('uno terminato e uno cancellato: completata, evasa in parte', attivita('t2').stato === 'completato' && /evasa in parte/.test(attivita('t2').chiusura_nota), J(attivita('t2')));
  verifica('l\'ordine ancora assegnato la tiene aperta', attivita('t3').stato === 'aperto', J(attivita('t3')));
  verifica('una completata a mano non cambia stato', attivita('t5').stato === 'completato' && !globalThis.__SCRITTI.some(s => s.id === 't5' && 'stato' in s.d), J(globalThis.__SCRITTI.filter(s => s.id === 't5')));
  verifica('una cancellata col suo ordine riassegnato resta cancellata, e lo dice', attivita('t7').stato === 'cancellato' && /di nuovo assegnato/.test(attivita('t7').avviso_ordini), J(attivita('t7')));
  verifica('la risposta dice le cancellate e le chiuse a parte', J((r.body.cancellate || []).map(x => x.id)) === J(['t1', 't6']) && J(r.body.chiuse.map(x => x.id)) === J(['t2'])
    && r.body.chiuse[0].come === 'in_parte' && r.body.chiuse[0].ritiro === '2026-10-09', J({ c: r.body.cancellate, h: r.body.chiuse }));
  verifica('fra quelle da guardare ognuna con lo stato in cui resta', J((r.body.da_guardare || []).map(x => `${x.id}:${x.stato}`)) === J(['t4:in_corso', 't7:cancellato']), J(r.body.da_guardare));
  verifica('e la riga per chi ha caricato: le cancellate, e della cancellata riassegnata non dice che «resta aperta»',
    /2 attività sono passate da sole fra le cancellate/.test(r.body.avviso) && r.body.avviso.includes('Ritiro Rossi')
    && r.body.avviso.includes("Un'attività della to-do list resta aperta e va guardata: Contestare la cancellazione - ")
    && r.body.avviso.includes('Fra le attività già chiuse della to-do list una ha qualcosa da guardare: Ritiro Neri - ')
    && !/resta aperta e va guardata: Ritiro Neri/.test(r.body.avviso), r.body.avviso);
  globalThis.__SCRITTI = [];
  const r2 = await chiama(modulo);
  verifica('rifatto subito non scrive niente', r2.body.aggiornate === 0 && globalThis.__SCRITTI.length === 0, J(globalThis.__SCRITTI));

  preparaBanco({ role: 'user', full_name: 'Operatore' });
  const r3 = await chiama(modulo);
  verifica('chi non e\' amministratore non scrive: si dice che cosa si farebbe', r3.status === 200 && globalThis.__SCRITTI.length === 0 && r3.body.non_salvato === true
    && J((r3.body.da_chiudere || []).map(x => x.id).sort()) === J(['t1', 't2', 't6']) && attivita('t1').stato === 'aperto', J(r3.body).slice(0, 300));
});

await prova('importaRichiesteEct', async () => {
  const XLSX = require('../node_modules/xlsx');
  // Con l'orologio fermo Date e' DataFissa: le date del foglio si fanno con lei,
  // altrimenti la libreria non le riconosce come date.
  const d = (s) => new Date(s + 'T00:00:00');
  // Il foglio come lo legge leggiFoglio: due righe d'intestazione, poi le richieste.
  const righe = [
    ['RICHIESTA ECT', 'provincia', 'DATE', null, 'trasportatore', 'mail inviata il', null],
    [null, null, 'ordine immesso', 'ordine evaso', null, null, null],
    ['ROSSI GOMME', 'BA', d('2026-09-01'), null, 'smoco', d('2026-09-20'), 'entro ottobre'],
    ['BIANCHI PNEUMATICI', 'BA', d('2026-09-02'), null, 'smoco', d('2026-09-21'), ''],
    ['VERDI AUTO', 'BA', d('2026-09-03'), null, 'smoco', d('2026-09-22'), ''],
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(righe, { cellDates: true }), 'Richieste ECT');
  const file = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const fetchVero = globalThis.fetch;
  globalThis.fetch = async () => new Response(file);
  try {
    const modulo = await impacchetta('importaRichiesteEct');
    preparaBanco({ role: 'admin', full_name: 'Amministratore' });
    const r = await chiama(modulo, { file_uri: 'privato/richieste.xlsx' });
    const di = (nome) => globalThis.__ARCHIVI.RichiestaEct.find(x => x.pdr_nome === nome) || {};
    verifica('risponde 200 e crea le tre richieste', r.status === 200 && r.body.creati === 3, `${r.status} ${J(r.body).slice(0, 300)}`);
    verifica('quella col suo ordine cancellato a portale e\' annullata da sola', di('ROSSI GOMME').esito === 'annullata' && di('ROSSI GOMME').id_ordine === 'ET26000101', J(di('ROSSI GOMME')));
    let stati = [];
    try { stati = JSON.parse(di('ROSSI GOMME').ordini_stato_json || '[]'); } catch { stati = []; }
    verifica('e porta lo stato dei suoi ordini, col giorno in cui si e\' visto cancellato', stati.length === 1 && stati[0].stato === 'cancellato' && stati[0].visto_il === OGGI, J(stati));
    verifica('quella con l\'ordine ancora assegnato resta aperta', di('BIANCHI PNEUMATICI').esito === 'aperta', J(di('BIANCHI PNEUMATICI')));
    verifica('quella ritirata e\' evasa, e il caricamento dice che aspetta la spunta (l\'elenco usciva sempre vuoto)', di('VERDI AUTO').esito === 'evasa'
      && (r.body.da_confermare || []).length === 1 && r.body.da_confermare[0].pdr === 'VERDI AUTO' && r.body.da_confermare[0].evasa_il === '2026-10-09', J(r.body.da_confermare));
  } finally {
    globalThis.fetch = fetchVero;
  }
});

// ---------------------------------------------------------------------------
console.log('5. LA PAGINA VERA');
const IMPORT_PERMESSI = "import { usePermessi } from '@/lib/permessi';";
const SORGENTE = sorgente('src/pages/TodoPage.jsx');
const cartella = mkdtempSync(join(tmpdir(), 'todo-cancellati-'));
const eventi = [];
globalThis.window = {
  self: 1, top: 1, matchMedia: () => ({ matches: false, addListener() {}, removeListener() {} }), confirm: () => true, alert: () => {},
  addEventListener() {}, removeEventListener() {}, dispatchEvent: (e) => { eventi.push(e); return true; },
};
globalThis.confirm = () => true;
await prova('la pagina To-Do List', async () => {
  const copia = join(cartella, 'TodoPage-admin.jsx');
  writeFileSync(copia, SORGENTE.replace(IMPORT_PERMESSI, 'const usePermessi = () => ({ isAdmin: true, soloLettura: false });'));
  const p = await caricaPagina('pages/TodoPage', { file: copia });
  const c = clienteFinto({
    archivi: { Todo: TODOS },
    funzioni: { controllaTodoOrdini: async () => ({ controllate: 3, aggiornate: 0, chiuse: [], cancellate: [{ id: 'd', titolo: 'Ritiro Rossi', ordini: 'ET26000101' }], da_guardare: [], avviso: '' }) },
  });
  globalThis.__CLIENTE_FINTO = c.cliente;
  const r = p.monta(p.Componente, {});
  await aspetta(60);
  const sezione = trova(r.albero, el => el.type && el.type.__finto === 'AttivitaCancellate')[0];
  verifica('sotto l\'elenco c\'e\' la sezione delle cancellate, con le cancellate dalle piu\' recenti', !!sezione && ids(sezione.props.todos) === 'def', sezione ? ids(sezione.props.todos) : 'manca');
  const elenco = trova(r.albero, el => el.type && el.type.__finto === 'ElencoAttivita')[0];
  verifica('l\'elenco riceve le attivita\' come prima', !!elenco && elenco.props.todos.length === TODOS.length);
  const pulsanti = trova(r.albero, el => el.type === 'button').map(testoAlbero);
  verifica('il filtro «Da fare» non conta le cancellate', pulsanti.includes('Da fare (2)'), J(pulsanti));
  const ultimo = eventi[eventi.length - 1];
  verifica('e nemmeno il numero mandato al menu', !!ultimo && ultimo.detail && ultimo.detail.da_fare === 2, J(ultimo && ultimo.detail));
  const tutto = testoAlbero(r.albero);
  verifica('il riquadro dice che cosa e\' passato fra le cancellate, e dove trovarla', tutto.includes("Un'attività è passata da sola fra i cancellati, il portale dà i suoi ordini cancellati: Ritiro Rossi (ET26000101)."), tutto.slice(0, 400));
  verifica('la spiegazione non chiede piu\' di decidere sui cancellati, e dice del passaggio', !/la decisione è tua/.test(tutto) && /passa da sola fra i/.test(tutto) && /era già cancellato quando l.hai scritta, l.attività resta qui/.test(tutto), tutto.slice(0, 1500));
  c.azzera();
  if (sezione) { await sezione.props.onRiapri(TODOS[3]); await aspetta(20); }
  const scritte = c.chiamate.filter(x => x.tipo === 'scrittura');
  verifica('«Riapri» scrive solo l\'attivita\' riaperta, e la riporta fra i da fare', scritte.length === 1 && scritte[0].nome === 'Todo' && scritte[0].id === 'd', J(c.chiamate));
});

// La sezione disegnata con React vero, lato server, come in prove/todoCompletati.mjs.
const ESTENSIONI = ['', '.js', '.jsx', '.ts'];
const daAlias = (pp) => { const base = qui('../src/' + pp.slice(2)); return ESTENSIONI.map(e => base + e).find(x => existsSync(x) && /\.\w+$/.test(x)) || base; };
let L = null;
await prova('la sezione delle cancellate si impacchetta', async () => {
  const INGRESSO = `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import AttivitaCancellate from ${JSON.stringify(qui('../src/components/todo/AttivitaCancellate.jsx'))};
import RichiesteCompletate from ${JSON.stringify(qui('../src/components/todo/RichiesteCompletate.jsx'))};
const C = { AttivitaCancellate, RichiesteCompletate };
export const disegna = (nome, props) => renderToStaticMarkup(React.createElement(C[nome], props));
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
const leggi = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ');
await prova('la sezione disegnata', () => {
  if (!L) throw new Error('non impacchettata');
  const { cancellati } = S.dividiAttivita(TODOS);
  const html = L.disegna('AttivitaCancellate', { todos: cancellati, isAdmin: true });
  const t = leggi(html);
  verifica('chiusa all\'apertura, col numero', /<details(?![^>]*\bopen\b)[^>]*data-sezione="cancellati"/.test(html) && t.includes('Cancellati (3)'), t.slice(0, 200));
  const pos = ['Ritiro Rossi', 'Ritiro doppio', 'Ritiro vecchio'].map(x => html.indexOf(x));
  verifica('dalle piu\' recenti', pos.every(x => x >= 0) && pos[0] < pos[1] && pos[1] < pos[2], J(pos));
  verifica('col giorno e il motivo, e la sezione dice che il portale il giorno della cancellazione non lo porta',
    t.includes("Passata fra le cancellate il 14/10/2026: l'ordine ET26000102 (Ordine doppio) risulta cancellato a portale.")
    && t.includes('Il file del portale non porta il giorno della cancellazione') && !t.includes('13/10/2026'), t.slice(0, 900));
  verifica('l\'amministratore puo\' riaprire ed eliminare', (html.match(/>Riapri</g) || []).length === 3 && (html.match(/aria-label="Elimina"/g) || []).length === 3);
  const lettore = L.disegna('AttivitaCancellate', { todos: cancellati, isAdmin: false });
  verifica('chi non e\' amministratore legge e basta', !/>Riapri</.test(lettore) && !/aria-label="Elimina"/.test(lettore));
  const vuota = leggi(L.disegna('AttivitaCancellate', { todos: [], isAdmin: true }));
  verifica('senza cancellate la sezione c\'e\' lo stesso, col suo zero', vuota.includes('Cancellati (0)') && vuota.includes('Nessuna attività cancellata'), vuota);
  verifica('nessuna parola della piattaforma a video', ![t, leggi(lettore), vuota].some(x => /base44/i.test(x)));
  const esitoDi = (r) => S.esitoDellaPagina(r, R.statoRichiesta);
  const { completate } = S.dividiRichieste(Object.values(RICH), esitoDi);
  const hr = L.disegna('RichiesteCompletate', { tutte: completate, righe: completate, esitoDi, isAdmin: true, occupato: null, onSpunta: () => {} });
  const tr = leggi(hr);
  verifica('fra le richieste completate l\'annullata dal portale col suo giorno, in grigio e senza spunta',
    /class="text-xs text-muted-foreground">Annullata da sola il 12\/10\/2026: l’ordine ET26000102/.test(hr) && (hr.match(/>spunta</g) || []).length === 1, tr.slice(0, 600));
  verifica('e l\'evasa in parte aspetta la risposta al consorzio', /1 aspetta la risposta al consorzio/.test(tr) || /una aspetta la risposta al consorzio/.test(tr), tr.slice(0, 300));
});

console.log('6. NEL SORGENTE');
await prova('il sorgente', () => {
  // Nei commenti la regola di prima resta scritta, come storia: si guarda il
  // codice, e la domanda di prima ci resta solo per riconoscerla (DOMANDA_DI_PRIMA).
  const regola = sorgente('base44/shared/todoOrdini.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/^export const DOMANDA_DI_PRIMA = .*$/m, '');
  verifica('la regola non chiede piu\' di decidere su un ordine cancellato', !/decidi tu/.test(regola));
  verifica('e il giorno della cancellazione non viene da ordine_chiuso_il', !/ordine_chiuso_il/.test(regola));
  const pagina = sorgente('src/pages/TodoPage.jsx');
  verifica('«Riapri» porta allo stato aperto, mai alla spunta', /const riapri = \(todo\) => cambiaStato\(todo, 'aperto'\);/.test(pagina) && /onRiapri=\{riapri\}/.test(pagina));
  const nuovo = sorgente('src/components/todo/AttivitaCancellate.jsx');
  verifica('il componente nuovo c\'e\', senza larghezze fisse ne\' title= (375 px)', nuovo.length > 0 && !/\b(?:min-)?w-(?:\d{2,}|\[\d+px\])\b|min-w-\[/.test(nuovo) && !/\stitle=/.test(nuovo));
  const foglio = sorgente('base44/functions/importaRichiesteEct/entry.ts');
  verifica('la to-do list e le richieste dicono lo stesso stato dei cancellati (statoOrdini) anche nel caricamento del foglio ECT, e scrivono stato degli ordini ed esito con la stessa funzione',
    /statoOrdini\(\[\.\.\.rete, \.\.\.aci\], \[\.\.\.assRete, \.\.\.assAci\]\)/.test(foglio) && /ordiniEdEsitoRichiesta\(/.test(foglio));
});

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
