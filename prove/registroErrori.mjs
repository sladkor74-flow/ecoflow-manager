// IL REGISTRO DEGLI ERRORI DEL SITO (migliorie del 14/10/2026, approvate
// dall'utente: «per me ok sulle cose da sistemare, sulla velocità e su quanto da
// creare, procedi pure»).
//
// Un errore di rete visto da un collega l'amministratore lo scopriva solo se il
// collega glielo diceva. Ora le pagine lo annotano da se' in ErroreSito
// (src/lib/registroErrori.js), l'amministratore lo legge in Alert & Controllo
// (src/components/alerts/ErroriSito.jsx) e la dashboard lo dice in «Da gestire»
// (vociErroriSito, prova in prove/cruscotto.mjs).
//
// Sezioni:
// 1. la pulizia del messaggio: niente token, email, indirizzi coi parametri,
//    contenuti di file, codici lunghi, nome della piattaforma;
// 2. la pagina: solo il percorso, mai la query string ne' l'hash;
// 3. che cosa e' una chiamata fallita: 429, rete, 5xx, 4xx, e le risposte che il
//    gestionale da' apposta (409 «rinviato», 403 di sola lettura, 401);
// 4. il freno: un errore uguale si conta, con attese che crescono (2, 10, 30
//    minuti...), al massimo 8 righe al giorno per errore e 20 per sessione (il
//    conto riparte col giorno), un errore nuovo non aspetta dietro a uno
//    ripetuto, la scheda che va in secondo piano scrive le volte in attesa,
//    niente scritture dopo un 429, una scrittura fallita non rompe niente;
// 5. l'aggancio al client vero (limite di richieste e guardia delle scritture di
//    permessi.js): la pagina riceve lo stesso errore, niente doppio
//    avvolgimento, ogni tentativo respinto dal limite ferma il registro, chi non
//    e' amministratore crea la sua riga e basta;
// 6. l'installazione nella pagina: errori non presi, promesse rifiutate, il
//    rumore del browser, la pagina che si chiude o va in secondo piano, la
//    memoria della sessione;
// 6B. la tempesta di 429: il registro non scrive finche' non si calma, e poi
//    con un tentativo solo;
// 7. la pagina che si rompe (PageErrorBoundary, quella vera);
// 8. la regola dell'archivio;
// 9. la scheda dell'amministratore, vera, e quella di chi non lo e';
// 10. la pagina Alert & Controllo: la scheda c'e' solo per l'amministratore;
// 11. nel sorgente: main.jsx installa il registro prima della prima pagina.
//
// node prove/registroErrori.mjs
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
const sorgente = (p) => readFileSync(qui('../' + p), 'utf8').replace(/\r/g, '');
const sezione = async (titolo, corpo) => {
  console.log(titolo);
  // Del punto in cui si ferma basta il messaggio e la prima riga, senza i
  // pacchetti impastati dal banco (indirizzi data: lunghi chilometri).
  try { await corpo(); } catch (e) { ko++; console.log(`  FALLITA: ${titolo}: si ferma con un errore (${e && e.message} | ${String((e && e.stack) || '').split('\n')[1] || ''})`.replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g, 'pacchetto').slice(0, 400)); }
};
const CHIAVE = Symbol.for('treadrider.registroErrori');
const R = await import('../src/lib/registroErrori.js');

await sezione('1. LA PULIZIA DEL MESSAGGIO', async () => {
  const p = R.pulisciMessaggio;
  verifica('un messaggio normale resta com\'e\'', p('Request failed with status code 500') === 'Request failed with status code 500');
  verifica('e anche un nome di file del gestionale', p('Il file PRIMARIE_RETE_2026_settembre.xlsx non si legge') === 'Il file PRIMARIE_RETE_2026_settembre.xlsx non si legge');
  const jwt = p('Token scaduto: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.abc123def456 per mario.rossi@smoco.it');
  verifica('un token JWT e un\'email spariscono', jwt === 'Token scaduto: [token] per [email]', jwt);
  verifica('Bearer', p('Authorization: Bearer abcdefghijklmnopqrstuvwxyz0123') === 'Authorization: Bearer [token]');
  const url = p('GET https://app.esempio.it/api/apps/68c1a2b3c4d5e6f7a8b9c0d1/entities/Assegnato?token=SEGRETO&q=1#x failed');
  verifica('di un indirizzo resta il percorso: niente dominio, query string, hash, e l\'identificativo dell\'app diventa [codice]', url === 'GET /api/apps/[codice]/entities/Assegnato failed', url);
  verifica('chiave=valore delle chiavi sensibili, anche fuori da un indirizzo', p('password=ciao123 e api_key: XyZ, access_token=abc') === 'password=[tolto] e api_key: [tolto], access_token=[tolto]', p('password=ciao123 e api_key: XyZ, access_token=abc'));
  // Revisione del 15/10/2026: la stessa cosa scritta in JSON, la forma in cui un
  // corpo di richiesta o di risposta finisce dentro un errore.
  const json = [p('{"password":"segreto1"}'), p('{"token":"tk_live_9f8e7d"}'), p("{'api_key': 'sk_live_AbC_123'}"), p('Invalid body: {"session_id":"s_1a2b3c4d","x":1}')];
  verifica('chiave e valore delle chiavi sensibili anche in JSON', J(json) === J(['{"password":[tolto]}', '{"token":[tolto]}', "{'api_key': [tolto]}", 'Invalid body: {"session_id":[tolto],"x":1}']), J(json));
  verifica('una query string rimasta attaccata a un percorso', p('non trovato /giacenze?anno=2026&token=x') === 'non trovato /giacenze', p('non trovato /giacenze?anno=2026&token=x'));
  verifica('il contenuto di un file (data:) e un file firmato o privato diventano [file]',
    p('data:application/pdf;base64,JVBERi0xLjQKJcOkw7zDtsOfCjIg') === '[file]'
    && p('Firma: https://storage.esempio.it/files/abc/DURC_Gatim.pdf?X-Amz-Signature=deadbeef1234') === 'Firma: [file]'
    && p('apri private://documenti/qualifica/abc.pdf') === 'apri [file]', p('Firma: https://storage.esempio.it/files/abc/DURC_Gatim.pdf?X-Amz-Signature=deadbeef1234'));
  const val = p("Error in field documento_ids: Input should be a valid dictionary [type=dict_type, input_value=['a', 'b'], input_type=list]");
  verifica('i dati dentro un errore di validazione', val === 'Error in field documento_ids: Input should be a valid dictionary [type=dict_type, input_value=[dato], input_type=list]', val);
  const lungo = p(`Valore non valido: "${'riga del file '.repeat(10)}"`);
  verifica('un testo lungo fra virgolette (una cella, un pezzo di file)', lungo === 'Valore non valido: "[testo]"', lungo);
  verifica('codici lunghi: uuid, esadecimali, chiavi a caso', p('sessione 3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b e codice AbCdEfGh1234567890IjKlMnOp') === 'sessione [codice] e codice [codice]');
  verifica('il nome della piattaforma non si mostra', p('[Base44 SDK Error] 404: Entity not found') === '404: Entity not found' && !/base44/i.test(p('Base44Error: x su base44.app')), p('Base44Error: x su base44.app'));
  verifica('caratteri di controllo e spazi', p('a\u0000b\n\n  c\t') === 'a b c');
  const enorme = p('x'.repeat(50) + ' ' + 'parola '.repeat(100));
  verifica('al piu\' 300 caratteri', enorme.length <= 300 && enorme.endsWith('…'), String(enorme.length));
  verifica('un oggetto senza messaggio non si trascrive (dentro ci possono essere dati)', p({ righe: [{ nome: 'Mario Rossi' }] }) === '' && p({ error: 'Rinviato' }) === 'Rinviato' && p(new Error('boom')) === 'boom');
  const e = new Error('boom');
  e.stack = 'Error: boom\n    at leggi (https://app.esempio.it/assets/index-AbC123.js:12:34)\n    at https://app.esempio.it/assets/Giacenze-xyz.js?v=2:1:2';
  verifica('la pila: solo i percorsi dei file del codice, con la riga', R.dovePila(e) === 'leggi /assets/index-AbC123.js:12:34 ← /assets/Giacenze-xyz.js:1:2', R.dovePila(e));
});

await sezione('2. LA PAGINA: SOLO IL PERCORSO', async () => {
  verifica('da un oggetto location: il pathname', R.paginaDi({ pathname: '/giacenze', search: '?access_token=abc', hash: '#riga' }) === '/giacenze');
  verifica('da una stringa: niente query string ne\' hash', R.paginaDi('/target-status?tab=raccoglitori&anno=2026#x') === '/target-status');
  verifica('senza niente, la radice', R.paginaDi(null) === '/');
});

await sezione('3. CHE COSA E\' UNA CHIAMATA FALLITA', async () => {
  const c = R.classificaErroreChiamata;
  const axios = (stato, data, msg = `Request failed with status code ${stato}`) => Object.assign(new Error(msg), { response: { status: stato, data } });
  const sdk = (stato, data, msg) => Object.assign(new Error(msg), { name: 'Base44Error', status: stato, data });
  verifica('429 (dopo i ritentativi): limite', J(c(axios(429, { error: 'Rate limit exceeded' }))) === J({ tipo: 'limite', stato_http: 429, messaggio: 'Rate limit exceeded' }));
  verifica('rete: nessuna risposta', c(Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' })).tipo === 'rete'
    && c(Object.assign(new Error('Network Error'), { name: 'Base44Error', originalError: { code: 'ERR_NETWORK' } })).tipo === 'rete');
  verifica('5xx: server, col messaggio della funzione (non «Request failed...»)', J(c(axios(500, { error: 'Cannot read properties of undefined' }))) === J({ tipo: 'server', stato_http: 500, messaggio: 'Cannot read properties of undefined' }));
  verifica('una pagina html di chi sta in mezzo non e\' un messaggio', c(axios(502, '<html><body>Bad gateway</body></html>')).messaggio === 'Request failed with status code 502');
  verifica('4xx: richiesta, anche da un archivio', J(c(sdk(404, { message: 'Entity not found' }, 'Entity not found'))) === J({ tipo: 'richiesta', stato_http: 404, messaggio: 'Entity not found' }));
  verifica('il 409 «rinviato» e il 403 di sola lettura sono risposte del gestionale, non errori',
    c(axios(409, { error: 'Rinviato, non è stato salvato niente', rinviato: true })) === null && c(axios(403, { error: "Questa operazione e' riservata all'amministratore", sola_lettura: true })) === null);
  // Revisione del 15/10/2026: le due risposte apposta di apriFile.
  verifica('apriFile: il 404 «senza_file» (un documento oltre i 40 giorni) e il 403 «riservato» (un file dell\'amministratore) non sono errori del sito',
    c(sdk(404, { error: "Questo record non ha piu' un file: il dettaglio dei documenti si conserva quaranta giorni.", senza_file: true }, 'x')) === null
    && c(axios(403, { error: "Il file e' dell'amministratore", riservato: true })) === null
    && c(sdk(404, { error: "Il record non esiste piu'." }, 'x')).tipo === 'richiesta');
  verifica('la guardia del browser (permessi.js) nemmeno', c(new Error("Questa operazione è riservata all'amministratore. Puoi consultare ed esportare tutto")) === null);
  verifica('401 (sessione scaduta) e una richiesta annullata: niente', c(axios(401, { error: 'Unauthorized' })) === null && c(Object.assign(new Error('canceled'), { code: 'ERR_CANCELED' })) === null);
  verifica('il messaggio di una chiamata e\' gia\' ripulito', c(axios(500, { error: 'errore per anna@smoco.it' })).messaggio === 'errore per [email]');
});

// Un orologio finto per il motore: adesso e pianifica a comando.
function orologio(inizio = Date.parse('2026-10-14T08:00:00Z')) {
  let t = inizio;
  const attese = [];
  const o = {
    adesso: () => t,
    pianifica: (fn, ms) => { const a = { quando: t + ms, fn }; attese.push(a); return a; },
    async avanza(ms) {
      const fine = t + ms;
      for (;;) {
        attese.sort((a, b) => a.quando - b.quando);
        const a = attese[0];
        if (!a || a.quando > fine) break;
        attese.shift();
        t = a.quando;
        await a.fn();
        for (let i = 0; i < 5; i++) await new Promise(r => setImmediate(r));
      }
      t = fine;
      for (let i = 0; i < 5; i++) await new Promise(r => setImmediate(r));
    },
  };
  return o;
}
const ERRORE_500 = { tipo: 'server', messaggio: 'Request failed with status code 500', pagina: '/giacenze', coinvolto_tipo: 'funzione', coinvolto: 'calcolaGiacenze', stato_http: 500 };

await sezione('4. IL FRENO', async () => {
  {
    const o = orologio();
    const scritte = [];
    const reg = R.creaRegistro({ scrivi: async (r) => { scritte.push(r); }, adesso: o.adesso, pianifica: o.pianifica, versione: 'AbC123' });
    for (let i = 0; i < 10; i++) reg.annota(ERRORE_500);
    verifica('subito non si scrive niente: si aspetta un attimo per contare', scritte.length === 0);
    await o.avanza(2000);
    verifica('lo stesso errore 10 volte: una riga sola, con volte 10', scritte.length === 1 && scritte[0].volte === 10, J(scritte));
    const r = scritte[0] || {};
    verifica('la riga: giorno italiano, percorso, tipo, chiamata, stato, versione, sessione, impronta, non vista',
      r.giorno === '2026-10-14' && r.pagina === '/giacenze' && r.tipo === 'server' && r.coinvolto === 'calcolaGiacenze' && r.coinvolto_tipo === 'funzione'
      && r.stato_http === 500 && r.versione === 'AbC123' && !!r.sessione && !!r.impronta && r.visto === false && !('_primo' in r) && !('dove' in r), J(r));
    for (let i = 0; i < 5; i++) reg.annota(ERRORE_500);
    await o.avanza(60000);
    verifica('lo stesso errore dopo un minuto: ancora nessuna riga nuova (la seconda dopo 2 minuti)', scritte.length === 1, String(scritte.length));
    await o.avanza(61000);
    verifica('passati i 2 minuti, una riga sola con le 5 volte di intanto', scritte.length === 2 && scritte[1].volte === 5, J(scritte.map(s => s.volte)));
    reg.annota(ERRORE_500);
    await o.avanza(9 * 60000);
    verifica('la terza aspetta 10 minuti dalla seconda', scritte.length === 2, String(scritte.length));
    await o.avanza(61000);
    verifica('e poi arriva', scritte.length === 3 && scritte[2].volte === 1, J(scritte.map(s => s.volte)));
  }
  {
    // Revisione del 15/10/2026: il timer e' uno. Un errore di rete scritto,
    // poi ripetuto (aspetta il suo turno), poi una pagina che si rompe: la
    // pagina non aspetta dietro all'errore ripetuto.
    const o = orologio();
    const scritte = [];
    const reg = R.creaRegistro({ scrivi: async (r) => { scritte.push({ ...r, al: o.adesso() }); }, adesso: o.adesso, pianifica: o.pianifica });
    const inizio = o.adesso();
    const RETE = { tipo: 'rete', messaggio: 'Network Error', pagina: '/assegnati', coinvolto_tipo: 'archivio', coinvolto: 'Assegnato.filter' };
    reg.annota(RETE);
    await o.avanza(10000);
    reg.annota(RETE);
    await o.avanza(50000);
    reg.annota({ tipo: 'pagina', messaggio: "Cannot read properties of undefined (reading 'mesi')", pagina: '/giacenze' });
    await o.avanza(5000);
    const pagina = scritte.find(s => s.tipo === 'pagina');
    verifica('una pagina rotta dietro a un errore ripetuto: scritta dopo un secondo e mezzo, non dopo il turno dell\'altro', !!pagina && pagina.al - inizio === 61500, J(scritte.map(s => [s.tipo, (s.al - inizio) / 1000])));
    await o.avanza(2 * 60000);
    verifica('e l\'errore ripetuto arriva al suo turno', scritte.length === 3 && scritte[2].tipo === 'rete' && scritte[2].volte === 1, J(scritte.map(s => [s.tipo, s.volte])));
    // Un timer che si sposta non lascia indietro un timer vecchio che scatta.
    const o2 = orologio();
    const annullati = [];
    const scritte2 = [];
    const reg2 = R.creaRegistro({ scrivi: async (r) => { scritte2.push(r); }, adesso: o2.adesso, pianifica: o2.pianifica, annulla: (h) => annullati.push(h) });
    reg2.annota(RETE);
    await o2.avanza(2000);
    reg2.annota(RETE);
    reg2.annota({ ...RETE, coinvolto: 'altra' });
    verifica('il timer lungo si annulla quando ne serve uno piu\' vicino', annullati.length === 1, String(annullati.length));
    await o2.avanza(3 * 60000);
    verifica('e ogni riga si scrive una volta', scritte2.length === 3 && new Set(scritte2.map(s => `${s.coinvolto}|${s.volte}|${s.il}`)).size === 3, J(scritte2.map(s => [s.coinvolto, s.volte])));
  }
  {
    // Le attese crescono: un errore al minuto per 11 ore fa 7 righe, che
    // insieme dicono tutte le volte (meno quelle ancora in attesa).
    const o = orologio(Date.parse('2026-10-12T07:00:00Z'));
    const scritte = [];
    const reg = R.creaRegistro({ scrivi: async (r) => { scritte.push({ ...r, al: o.adesso() }); }, adesso: o.adesso, pianifica: o.pianifica });
    const RETE = { tipo: 'rete', messaggio: 'Network Error', pagina: '/', coinvolto_tipo: 'funzione', coinvolto: 'cruscottoOperativo' };
    for (let m = 0; m < 11 * 60; m++) { reg.annota(RETE); await o.avanza(60000); }
    const minuti = scritte.map(s => Math.round((s.al - Date.parse('2026-10-12T07:00:00Z')) / 60000));
    verifica('un errore al minuto per 11 ore: righe a 0, 2, 12, 42, 102, 222 e 462 minuti', J(minuti) === J([0, 2, 12, 42, 102, 222, 462]), J(minuti));
    verifica('le volte: 463 scritte, le altre 197 in attesa', scritte.reduce((s, r) => s + r.volte, 0) === 463 && reg.stato().in_attesa === 1, J([scritte.map(s => s.volte), reg.stato().in_attesa]));
    await o.avanza(60 * 60000);
    verifica('e l\'ottava riga, quattro ore dopo la settima, le porta: in tutto 660', scritte.length === 8 && scritte.reduce((s, r) => s + r.volte, 0) === 660, J(scritte.map(s => s.volte)));
  }
  {
    // Il massimo e' del giorno (revisione del 15/10/2026): il gestionale
    // installato come applicazione resta aperto per giorni nella stessa
    // finestra, e il conto della sessione non ripartiva mai.
    const o = orologio(Date.parse('2026-10-12T07:00:00Z'));
    const scritte = [];
    const reg = R.creaRegistro({ scrivi: async (r) => { scritte.push(r); }, adesso: o.adesso, pianifica: o.pianifica });
    for (let i = 0; i < R.MASSIMO_RIGHE_PER_SESSIONE; i++) { reg.annota({ ...ERRORE_500, coinvolto: `funzione${i}` }); await o.avanza(10 * 60000); }
    const lunedi = scritte.length;
    verifica('lunedi\': il massimo del giorno, poi niente', lunedi === R.MASSIMO_RIGHE_PER_SESSIONE && reg.annota({ ...ERRORE_500, coinvolto: 'oltre' }) === false, String(lunedi));
    await o.avanza(20 * 3600000);
    const accettata = reg.annota({ tipo: 'pagina', messaggio: "Cannot read properties of undefined (reading 'mesi')", pagina: '/giacenze' });
    await o.avanza(60000);
    verifica('martedi\', nella stessa finestra, una pagina rotta si scrive', accettata === true && scritte.length === lunedi + 1 && scritte[lunedi].tipo === 'pagina' && scritte[lunedi].giorno === '2026-10-13'
      && reg.stato().giorno === '2026-10-13', J([accettata, scritte.length, reg.stato()]));
    // Anche dopo «Ricarica app»: il giorno dei conti sta nella memoria.
    let salvato = null;
    const memoria = { leggi: () => salvato, salva: (x) => { salvato = JSON.parse(JSON.stringify(x)); } };
    const o2 = orologio(Date.parse('2026-10-12T20:00:00Z'));
    const prima = R.creaRegistro({ scrivi: async () => {}, adesso: o2.adesso, pianifica: o2.pianifica, memoria, massimo: 1 });
    prima.annota(ERRORE_500);
    await o2.avanza(5000);
    verifica('ricaricata la pagina lo stesso giorno, il conto resta', R.creaRegistro({ scrivi: async () => {}, adesso: o2.adesso, pianifica: o2.pianifica, memoria, massimo: 1 }).annota({ ...ERRORE_500, coinvolto: 'x' }) === false);
    await o2.avanza(3 * 3600000);
    verifica('ricaricata il giorno dopo, riparte', R.creaRegistro({ scrivi: async () => {}, adesso: o2.adesso, pianifica: o2.pianifica, memoria, massimo: 1 }).annota({ ...ERRORE_500, coinvolto: 'y' }) === true);
  }
  {
    // Al piu' MASSIMO_RIGHE_PER_ERRORE righe al giorno per lo stesso errore,
    // anche quando la scheda va e viene dal secondo piano.
    const o = orologio();
    const scritte = [];
    const reg = R.creaRegistro({ scrivi: async (r) => { scritte.push(r); }, adesso: o.adesso, pianifica: o.pianifica });
    for (let i = 0; i < 40; i++) { reg.annota(ERRORE_500); reg.inUscita(); await o.avanza(3 * 60000); reg.rientro(); }
    verifica(`la scheda nascosta ogni 3 minuti, con lo stesso errore: ${R.MASSIMO_RIGHE_PER_ERRORE} righe, non 40`, scritte.length === R.MASSIMO_RIGHE_PER_ERRORE, String(scritte.length));
    reg.annota({ ...ERRORE_500, coinvolto: 'altra' });
    await o.avanza(5000);
    verifica('e gli altri errori hanno ancora posto', scritte.length === R.MASSIMO_RIGHE_PER_ERRORE + 1 && scritte[scritte.length - 1].coinvolto === 'altra', String(scritte.length));
  }
  {
    // La scheda che va in secondo piano o si chiude: le volte in attesa si
    // scrivono adesso (revisione del 15/10/2026: un 500 ogni 30 secondi per
    // 20 minuti arrivava all'amministratore come «una volta»).
    const o = orologio();
    const scritte = [];
    const reg = R.creaRegistro({ scrivi: async (r) => { scritte.push(r); }, adesso: o.adesso, pianifica: o.pianifica });
    for (let i = 0; i < 40; i++) { reg.annota(ERRORE_500); await o.avanza(30000); }
    const primaDiUscire = scritte.reduce((s, r) => s + r.volte, 0);
    reg.inUscita();
    await o.avanza(0);
    verifica('40 errori in 20 minuti, poi la scheda si chiude: le righe dicono 40 volte', scritte.reduce((s, r) => s + r.volte, 0) === 40 && primaDiUscire < 40 && reg.stato().in_attesa === 0,
      J([primaDiUscire, scritte.map(s => s.volte)]));
    // Uscendo si scrive SUBITO, dentro l'evento: senza aspettare un timer.
    const o2 = orologio();
    const partite = [];
    const reg2 = R.creaRegistro({ scrivi: (r) => { partite.push(r); return new Promise(() => {}); }, adesso: o2.adesso, pianifica: o2.pianifica });
    reg2.annota(ERRORE_500);
    reg2.annota({ ...ERRORE_500, coinvolto: 'altra' });
    reg2.inUscita();
    verifica('uscendo le righe partono insieme e subito, senza il secondo e mezzo d\'attesa', partite.length === 2, String(partite.length));
    // Uscendo, ma dopo un 429: niente.
    const o3 = orologio();
    const scritte3 = [];
    const reg3 = R.creaRegistro({ scrivi: async (r) => { scritte3.push(r); }, adesso: o3.adesso, pianifica: o3.pianifica });
    reg3.annota(ERRORE_500);
    reg3.limite();
    await o3.avanza(30000);
    reg3.inUscita();
    await o3.avanza(0);
    verifica('uscendo entro due minuti da un 429 non si scrive niente', scritte3.length === 0, String(scritte3.length));
    // Uscendo, ma la riga uguale e' di meno di due minuti fa: niente.
    const o4 = orologio();
    const scritte4 = [];
    const reg4 = R.creaRegistro({ scrivi: async (r) => { scritte4.push(r); }, adesso: o4.adesso, pianifica: o4.pianifica });
    reg4.annota(ERRORE_500);
    await o4.avanza(2000);
    reg4.annota(ERRORE_500);
    reg4.inUscita();
    await o4.avanza(60000);
    verifica('uscendo, due righe uguali restano ad almeno due minuti', scritte4.length === 1, String(scritte4.length));
    reg4.rientro();
    await o4.avanza(2 * 60000);
    verifica('e tornati sulla scheda, la seconda arriva al suo turno', scritte4.length === 2 && scritte4[1].volte === 1, String(scritte4.length));
    // L'uscita vale una volta: una scheda lasciata in secondo piano per un'ora,
    // con un errore al minuto, segue le attese di sempre.
    const o5 = orologio();
    const scritte5 = [];
    const reg5 = R.creaRegistro({ scrivi: async (r) => { scritte5.push({ ...r, al: o5.adesso() }); }, adesso: o5.adesso, pianifica: o5.pianifica });
    const inizio5 = o5.adesso();
    reg5.annota(ERRORE_500);
    await o5.avanza(500);
    reg5.inUscita();
    for (let m = 1; m <= 60; m++) { await o5.avanza(60000 - (m === 1 ? 500 : 0)); reg5.annota(ERRORE_500); }
    await o5.avanza(1000);
    const secondi5 = scritte5.map(s => (s.al - inizio5) / 1000);
    verifica('in secondo piano per un\'ora: una riga all\'uscita, poi a 2, 10 e 30 minuti, non una ogni due minuti', J(secondi5) === J([0.5, 120.5, 720.5, 2520.5]), J(secondi5));
  }
  {
    const o = orologio();
    const scritte = [];
    const reg = R.creaRegistro({ scrivi: async (r) => { scritte.push(r); }, adesso: o.adesso, pianifica: o.pianifica });
    for (let i = 0; i < 30; i++) reg.annota({ ...ERRORE_500, coinvolto: `funzione${i}` });
    await o.avanza(10 * 60000);
    verifica('30 errori diversi in una sessione: al massimo 20 righe', scritte.length === R.MASSIMO_RIGHE_PER_SESSIONE, String(scritte.length));
    reg.annota({ ...ERRORE_500, coinvolto: 'altra' });
    await o.avanza(60 * 60000);
    verifica('oltre il massimo non si annota piu\' niente', scritte.length === R.MASSIMO_RIGHE_PER_SESSIONE && reg.stato().in_attesa === 0, J(reg.stato()));
  }
  {
    const o = orologio();
    const scritte = [];
    const istanti = [];
    const reg = R.creaRegistro({ scrivi: async (r) => { scritte.push(r); istanti.push(o.adesso()); }, adesso: o.adesso, pianifica: o.pianifica });
    reg.annota(ERRORE_500);
    reg.annota({ ...ERRORE_500, coinvolto: 'altra' });
    reg.annota({ ...ERRORE_500, coinvolto: 'terza' });
    await o.avanza(30000);
    verifica('tre errori diversi: tre righe, una ogni 3 secondi', scritte.length === 3 && istanti[1] - istanti[0] >= R.SPAZIO_FRA_SCRITTURE_MS && istanti[2] - istanti[1] >= R.SPAZIO_FRA_SCRITTURE_MS, J(istanti.map(t => t - istanti[0])));
  }
  {
    // Il limite di richieste: un ciclo che fallisce per il 429 ogni 30 secondi.
    const o = orologio();
    const scritte = [];
    const reg = R.creaRegistro({ scrivi: async (r) => { scritte.push(r); }, adesso: o.adesso, pianifica: o.pianifica });
    const limite = { tipo: 'limite', messaggio: 'Rate limit exceeded', pagina: '/primarie-rete', coinvolto_tipo: 'archivio', coinvolto: 'PrimariaRete.filter', stato_http: 429 };
    for (let i = 0; i < 10; i++) { reg.annota(limite); await o.avanza(30000); }
    verifica('con un 429 ogni 30 secondi per 5 minuti: nessuna scrittura', scritte.length === 0, String(scritte.length));
    reg.annota(ERRORE_500);
    await o.avanza(60000);
    verifica('nemmeno di un altro errore, finche\' il limite non si calma', scritte.length === 0, String(scritte.length));
    await o.avanza(2 * 60000);
    verifica('due minuti dopo l\'ultimo 429: si scrive, col conto delle volte', scritte.length === 2 && scritte.find(s => s.tipo === 'limite').volte === 10, J(scritte.map(s => [s.tipo, s.volte])));
  }
  {
    // La scrittura dell'errore che fallisce.
    const o = orologio();
    let tentativi = 0;
    const reg = R.creaRegistro({ scrivi: async () => { tentativi++; throw Object.assign(new Error('Request failed with status code 500'), { response: { status: 500 } }); }, adesso: o.adesso, pianifica: o.pianifica });
    let rotto = null;
    try { reg.annota(ERRORE_500); await o.avanza(5000); } catch (e) { rotto = e; }
    verifica('una scrittura che fallisce non rompe niente e non riprova', rotto === null && tentativi === 1 && reg.stato().rifiutate === 1, J([tentativi, reg.stato()]));
    reg.annota(ERRORE_500);
    await o.avanza(60000);
    verifica('lo stesso errore non riprova prima del suo turno (2 minuti dalla riga persa)', tentativi === 1, String(tentativi));
    const o2 = orologio();
    let t2 = 0;
    const spento = R.creaRegistro({ scrivi: async () => { t2++; throw Object.assign(new Error('Forbidden'), { status: 403 }); }, adesso: o2.adesso, pianifica: o2.pianifica });
    spento.annota(ERRORE_500);
    await o2.avanza(5000);
    spento.annota({ ...ERRORE_500, coinvolto: 'altra' });
    await o2.avanza(60 * 60000);
    verifica('un rifiuto (403: l\'archivio non lascia scrivere) spegne il registro per la sessione', t2 === 1 && spento.stato().spento === true, J([t2, spento.stato()]));
    const o3 = orologio();
    let t3 = 0;
    const lento = R.creaRegistro({ scrivi: async () => { t3++; throw Object.assign(new Error('Rate limit exceeded'), { status: 429 }); }, adesso: o3.adesso, pianifica: o3.pianifica });
    lento.annota(ERRORE_500);
    await o3.avanza(5000);
    lento.annota({ ...ERRORE_500, coinvolto: 'altra' });
    await o3.avanza(60000);
    verifica('se la scrittura prende un 429, la prossima aspetta oltre la finestra', t3 === 1, String(t3));
    await o3.avanza(2 * 60000);
    verifica('e poi riparte', t3 === 2, String(t3));
  }
  {
    // La memoria della sessione: una pagina rotta e poi «Ricarica app».
    const o = orologio();
    let salvato = null;
    const memoria = { leggi: () => salvato, salva: (x) => { salvato = JSON.parse(JSON.stringify(x)); } };
    const scritte = [];
    const prima = R.creaRegistro({ scrivi: async (r) => { scritte.push(r); }, adesso: o.adesso, pianifica: () => null, memoria });
    prima.annota({ tipo: 'pagina', messaggio: 'x is undefined', pagina: '/giacenze' });
    verifica('la riga in attesa resta nella memoria della scheda', scritte.length === 0 && salvato && salvato.in_attesa.length === 1, J(salvato));
    const dopo = R.creaRegistro({ scrivi: async (r) => { scritte.push(r); }, adesso: o.adesso, pianifica: o.pianifica, memoria });
    await o.avanza(5000);
    verifica('ricaricata la pagina, si scrive: stessa sessione', scritte.length === 1 && scritte[0].tipo === 'pagina' && scritte[0].sessione === salvato.sessione && dopo.stato().scritte === 1, J(scritte));
    const memoriaRotta = { leggi: () => { throw new Error('vietato'); }, salva: () => { throw new Error('vietato'); } };
    const senza = R.creaRegistro({ scrivi: async (r) => { scritte.push(r); }, adesso: o.adesso, pianifica: o.pianifica, memoria: memoriaRotta });
    verifica('senza memoria (navigazione privata) si va avanti lo stesso', senza.annota(ERRORE_500) === true);
    verifica('un tipo che non esiste non si annota', senza.annota({ tipo: 'boh', messaggio: 'x' }) === false);
  }
});

// Il client delle prove: archivi e funzioni finti, con quello che si vuole far
// rispondere, e ogni richiesta contata.
function clientFinto() {
  const richieste = [];
  const risposte = {};
  const iscritti = [];
  const archivio = (nome) => {
    const metodo = (m) => async (...a) => {
      richieste.push({ nome, m, a });
      const r = risposte[`${nome}.${m}`];
      if (typeof r === 'function') return r(...a);
      if (r instanceof Error) throw r;
      return r !== undefined ? r : (m === 'create' ? { id: 'nuovo', ...a[0] } : []);
    };
    return { list: metodo('list'), filter: metodo('filter'), get: metodo('get'), create: metodo('create'), update: metodo('update'), delete: metodo('delete'),
      bulkUpdate: metodo('bulkUpdate'), deleteMany: metodo('deleteMany'), subscribe: (cb) => { iscritti.push(cb); return () => 'disiscritto'; } };
  };
  const raw = {
    entities: new Proxy({}, { get: (_t, nome) => (typeof nome === 'string' && nome !== 'then' ? archivio(nome) : undefined) }),
    // Una risposta scritta come funzione da' un errore nuovo a ogni chiamata, come il client vero.
    functions: { invoke: async (nome, corpo) => { richieste.push({ nome, m: 'invoke', a: [corpo] }); const x = risposte[`f:${nome}`]; const r = typeof x === 'function' ? x() : x; if (r instanceof Error) throw r; return { data: r !== undefined ? r : { ok: true } }; } },
    auth: { me: async () => ({ role: 'user', email: 'utente@smoco.it' }) },
  };
  return { raw, richieste, risposte, iscritti };
}
const { conLimiteRichieste } = await import('../src/lib/limiteRichieste.js');
const ATTESE = [1, 1];
const cartella = mkdtempSync(join(tmpdir(), 'registro-errori-'));
// La cartella delle copie delle pagine si toglie alla fine, anche se la prova
// cade a meta' (l'evento exit arriva anche dopo un errore non preso): prima
// ne restava una nella cartella temporanea a ogni giro (chiusura del 15/10/2026).
const togliCartella = () => rmSync(cartella, { recursive: true, force: true });
process.on('exit', togliCartella);

// La guardia vera delle scritture (src/lib/permessi.js), caricata con il client
// della prova al posto di quello del sito: cambia solo da dove prende il client
// e il contesto dell'accesso, che in node non c'e'.
const { caricaPagina, aspetta, trova, testo } = await import('./dati/paginaFinta.mjs');
async function caricaPermessi() {
  const IMPORT_CLIENTE = "import { base44 } from '@/api/base44Client';";
  const IMPORT_AUTH = "import { useAuth } from '@/lib/AuthContext';";
  const s = sorgente('src/lib/permessi.js');
  verifica('permessi.js prende client e accesso come la prova si aspetta', s.includes(IMPORT_CLIENTE) && s.includes(IMPORT_AUTH));
  const f = join(cartella, `permessi-${Math.random().toString(36).slice(2)}.js`);
  writeFileSync(f, s.replace(IMPORT_CLIENTE, 'const base44 = globalThis.__CLIENTE_PROVA;').replace(IMPORT_AUTH, 'const useAuth = () => ({});'));
  return (await caricaPagina('lib/permessi', { file: f })).modulo;
}

await sezione('5. L\'AGGANCIO AL CLIENT VERO: LIMITE DI RICHIESTE E GUARDIA DELLE SCRITTURE', async () => {
  const { raw, richieste, risposte, iscritti } = clientFinto();
  const client = conLimiteRichieste(raw, { attese: ATTESE });
  const annotati = [];
  let limiti = 0;
  R.agganciaChiamate(client, (ev) => { annotati.push(ev); return true; }, { pagina: () => '/assegnati', suLimite: () => { limiti++; } });
  globalThis.__CLIENTE_PROVA = client;
  const permessi = await caricaPermessi();
  permessi.ricordaRuolo({ role: 'user' });
  permessi.proteggiScritture();

  risposte['Assegnato.filter'] = [{ id: 'a1' }];
  const letti = await client.entities.Assegnato.filter({ stato: 'aperto' });
  verifica('una chiamata che riesce risponde come prima, e non si annota niente', J(letti) === J([{ id: 'a1' }]) && annotati.length === 0);

  const e500 = Object.assign(new Error('Server Error'), { name: 'Base44Error', status: 500, data: { message: 'Internal' } });
  risposte['Assegnato.filter'] = e500;
  let preso = null;
  try { await client.entities.Assegnato.filter({}); } catch (e) { preso = e; }
  verifica('una lettura che fallisce: la pagina riceve LO STESSO errore', preso === e500);
  verifica('e il registro la annota una volta: server, archivio Assegnato.filter, pagina', annotati.length === 1 && annotati[0].tipo === 'server' && annotati[0].coinvolto === 'Assegnato.filter'
    && annotati[0].coinvolto_tipo === 'archivio' && annotati[0].pagina === '/assegnati' && annotati[0].stato_http === 500, J(annotati));

  annotati.length = 0;
  richieste.length = 0;
  risposte['PrimariaRete.list'] = Object.assign(new Error('Rate limit exceeded'), { status: 429 });
  preso = null;
  try { await client.entities.PrimariaRete.list('id', 1, 0); } catch (e) { preso = e; }
  const partite = richieste.filter(r => r.nome === 'PrimariaRete').length;
  verifica('una richiesta sempre respinta dal limite parte 1 + attese volte, non al quadrato: il registro non avvolge due volte', partite === ATTESE.length + 1, `partite=${partite}`);
  verifica('e si annota una volta sola, dopo i ritentativi, come limite', annotati.length === 1 && annotati[0].tipo === 'limite', J(annotati));
  // Revisione del 15/10/2026: il registro sa del 429 a ogni tentativo, non solo
  // quando i ritentativi sono finiti.
  verifica('ogni tentativo respinto dal limite lo dice subito al registro (suLimite), anche quelli che poi si ripetono', limiti === ATTESE.length + 1, `limiti=${limiti}`);
  const nuovo = clientFinto().raw;
  verifica('il modulo crudo degli archivi si trova anche sotto il limite di richieste', R.moduloCrudo(conLimiteRichieste(nuovo, { attese: ATTESE }), 'entities') === nuovo.entities
    && R.moduloCrudo(conLimiteRichieste(nuovo, { attese: ATTESE }), 'functions') === nuovo.functions && R.moduloCrudo({}, 'entities') === null && R.moduloCrudo(null, 'entities') === null);

  annotati.length = 0;
  risposte['f:calcolaGiacenze'] = Object.assign(new Error('Request failed with status code 502'), { response: { status: 502, data: { error: 'Tempo scaduto' } } });
  preso = null;
  try { await client.functions.invoke('calcolaGiacenze', { anno: 2026 }); } catch (e) { preso = e; }
  verifica('una funzione che fallisce: stesso errore alla pagina, annotata col nome della funzione e il messaggio della risposta',
    preso === risposte['f:calcolaGiacenze'] && annotati.length === 1 && annotati[0].coinvolto === 'calcolaGiacenze' && annotati[0].coinvolto_tipo === 'funzione' && annotati[0].messaggio === 'Tempo scaduto', J(annotati));
  risposte['f:congelaPassiva'] = Object.assign(new Error('Request failed with status code 409'), { response: { status: 409, data: { error: 'Rinviato', rinviato: true } } });
  try { await client.functions.invoke('congelaPassiva', {}); } catch (_e) { /* la pagina lo spiega */ }
  verifica('il 409 «rinviato» non si annota', annotati.length === 1);
  risposte['f:cruscottoOperativo'] = { da_gestire: [] };
  const r = await client.functions.invoke('cruscottoOperativo', {});
  verifica('una funzione che riesce risponde come prima', J(r) === J({ data: { da_gestire: [] } }));

  const stacca = client.entities.UploadLog.subscribe(() => {});
  verifica('subscribe passa com\'e\': restituisce subito la funzione per staccarsi', typeof stacca === 'function' && stacca() === 'disiscritto' && iscritti.length === 1);

  annotati.length = 0;
  richieste.length = 0;
  const creata = await client.entities.ErroreSito.create({ tipo: 'server', messaggio: 'x' });
  verifica('chi non e\' amministratore CREA la riga del suo errore (permessi.js, SOLO_CREAZIONE)', creata && creata.id === 'nuovo' && richieste.some(q => q.nome === 'ErroreSito' && q.m === 'create'), J(richieste));
  let vietata = null;
  try { await client.entities.ErroreSito.update('nuovo', { visto: true }); } catch (e) { vietata = e; }
  verifica('ma non la modifica ne\' la cancella: resta dell\'amministratore', vietata && /riservata all'amministratore/.test(vietata.message) && !richieste.some(q => q.nome === 'ErroreSito' && q.m === 'update'));
  let altra = null;
  try { await client.entities.Assegnato.create({}); } catch (e) { altra = e; }
  verifica('e le altre scritture restano chiuse, come prima; il rifiuto della guardia non e\' un errore del sito', altra && /riservata all'amministratore/.test(altra.message) && annotati.length === 0, J(annotati));
  risposte['ErroreSito.create'] = Object.assign(new Error('Server Error'), { status: 500 });
  try { await client.entities.ErroreSito.create({ tipo: 'server', messaggio: 'x' }); } catch (_e) { /* il registro la prende da se' */ }
  verifica('una scrittura del registro che fallisce non diventa un altro errore del registro', annotati.length === 0, J(annotati));
  permessi.ricordaRuolo({ role: 'admin' });
  await client.entities.ErroreSito.update('nuovo', { visto: true });
  verifica('l\'amministratore la segna vista', richieste.some(q => q.nome === 'ErroreSito' && q.m === 'update'));
});

// Una finestra finta: eventi, sessionStorage, location, gli script della pagina.
function finestraFinta({ pathname = '/giacenze', search = '?access_token=SEGRETO', hash = '#riga' } = {}) {
  const ascolti = {};
  const ascoltiDoc = {};
  const memoria = new Map();
  const document = {
    visibilityState: 'visible',
    querySelectorAll: () => [{ getAttribute: () => '/assets/index-AbC123.js' }],
    addEventListener: (tipo, f) => { (ascoltiDoc[tipo] = ascoltiDoc[tipo] || []).push(f); },
  };
  return {
    ascolti,
    ascoltiDoc,
    location: { pathname, search, hash, href: `https://app.esempio.it${pathname}${search}${hash}` },
    sessionStorage: { getItem: (k) => (memoria.has(k) ? memoria.get(k) : null), setItem: (k, v) => memoria.set(k, String(v)) },
    document,
    addEventListener: (tipo, f) => { (ascolti[tipo] = ascolti[tipo] || []).push(f); },
    emetti: (tipo, ev) => { for (const f of ascolti[tipo] || []) f(ev); },
    // La scheda che va in secondo piano (hidden) o torna davanti (visible).
    visibilita: (stato) => { document.visibilityState = stato; for (const f of ascoltiDoc.visibilitychange || []) f({}); },
  };
}

await sezione('6. L\'INSTALLAZIONE NELLA PAGINA', async () => {
  delete globalThis[CHIAVE];
  const o = orologio();
  const { raw, richieste, risposte } = clientFinto();
  const client = conLimiteRichieste(raw, { attese: ATTESE });
  const finestra = finestraFinta();
  const installato = R.installaRegistroErrori(client, { finestra, adesso: o.adesso, pianifica: o.pianifica });
  verifica('si installa una volta sola, e ascolta errori, promesse rifiutate e pagina che si chiude', !!installato && R.installaRegistroErrori(client, { finestra }) === installato
    && ['error', 'unhandledrejection', 'pagehide', 'pageshow'].every(t => (finestra.ascolti[t] || []).length === 1) && (finestra.ascoltiDoc.visibilitychange || []).length === 1);
  const scritte = () => richieste.filter(q => q.nome === 'ErroreSito' && q.m === 'create').map(q => q.a[0]);

  const err = new Error("Cannot read properties of undefined (reading 'mesi')");
  err.stack = `TypeError: ${err.message}\n    at Riga (https://app.esempio.it/assets/Giacenze-xyz.js:3:44)`;
  finestra.emetti('error', { error: err, message: err.message, filename: 'https://app.esempio.it/assets/Giacenze-xyz.js' });
  await o.avanza(2000);
  const prima = scritte()[0] || {};
  verifica('un errore non preso: una riga «non_preso», col percorso della pagina e la versione del codice', scritte().length === 1 && prima.tipo === 'non_preso' && prima.pagina === '/giacenze'
    && prima.versione === 'AbC123' && prima.dove === 'Riga /assets/Giacenze-xyz.js:3:44', J(prima));
  verifica('nella riga niente query string, hash, token', !/SEGRETO|access_token|#riga|\?/.test(J(prima)), J(prima));

  // Una chiamata fallita che nessuno prende: una volta sola.
  risposte['f:riepilogoDichiarazioni'] = Object.assign(new Error('Request failed with status code 500'), { response: { status: 500, data: { error: 'Boom' } } });
  let rifiuto = null;
  try { await client.functions.invoke('riepilogoDichiarazioni', {}); } catch (e) { rifiuto = e; }
  finestra.emetti('unhandledrejection', { reason: rifiuto });
  await o.avanza(10000);
  verifica('una chiamata fallita che nessuno prende si conta una volta, come chiamata', scritte().length === 2 && scritte()[1].tipo === 'server' && scritte()[1].coinvolto === 'riepilogoDichiarazioni', J(scritte().map(s => [s.tipo, s.coinvolto])));
  finestra.emetti('unhandledrejection', { reason: new Error('Failed to fetch dynamically imported module: https://app.esempio.it/assets/Giacenze-nuovo.js') });
  await o.avanza(10000);
  verifica('una promessa rifiutata (una pagina che non si scarica dopo una pubblicazione)', scritte().length === 3 && scritte()[2].tipo === 'non_preso' && scritte()[2].messaggio === 'Failed to fetch dynamically imported module: /assets/Giacenze-nuovo.js', J(scritte()[2]));
  finestra.emetti('error', { message: 'ResizeObserver loop completed with undelivered notifications.' });
  finestra.emetti('error', { message: 'Script error.' });
  finestra.emetti('error', { error: new Error('estensione'), message: 'estensione', filename: 'chrome-extension://abc/contenuto.js' });
  finestra.emetti('unhandledrejection', { reason: new Error("Questa operazione è riservata all'amministratore. Puoi consultare ed esportare tutto") });
  await o.avanza(10000);
  verifica('il rumore del browser, le estensioni e la guardia della sola lettura non sono errori del sito', scritte().length === 3, J(scritte().slice(3)));
  finestra.emetti('pagehide', {});
  risposte['f:altra'] = () => Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' });
  try { await client.functions.invoke('altra', {}); } catch (_e) { /* niente */ }
  await o.avanza(10000);
  verifica('le richieste interrotte da una pagina che si chiude non si annotano', scritte().length === 3);
  finestra.emetti('pageshow', {});
  try { await client.functions.invoke('altra', {}); } catch (_e) { /* niente */ }
  await o.avanza(10000);
  verifica('tornati sulla pagina, si', scritte().length === 4 && scritte()[3].tipo === 'rete');

  // Revisione del 15/10/2026: la scheda che va in secondo piano scrive subito
  // quello che ha in attesa, col conto delle volte.
  const rotto = new Error('Boom di prova');
  finestra.emetti('error', { error: rotto, message: rotto.message });
  finestra.emetti('error', { error: new Error('Boom di prova'), message: 'Boom di prova' });
  verifica('un errore appena successo aspetta un attimo', scritte().length === 4);
  finestra.visibilita('hidden');
  verifica('la scheda va in secondo piano: la riga parte adesso, nell\'evento stesso, con le volte', scritte().length === 5 && scritte()[4].messaggio === 'Boom di prova' && scritte()[4].volte === 2, J(scritte().slice(4)));
  finestra.visibilita('visible');
  verifica('tornata davanti, il registro riprende i suoi tempi', R.registroAttivo().registro.stato().uscita === false);

  // Un errore dentro il registro non rompe la pagina.
  verifica('un evento senza niente non rompe niente', (() => { try { finestra.emetti('error', null); finestra.emetti('unhandledrejection', null); return true; } catch (_e) { return false; } })());
  verifica('senza client o senza finestra non installa niente, senza errori', (() => { const k = globalThis[CHIAVE]; delete globalThis[CHIAVE]; const x = R.installaRegistroErrori(null, { finestra }); const y = R.installaRegistroErrori(client, { finestra: null }); globalThis[CHIAVE] = k; return x === null && y === null; })());
});

// Revisione del 15/10/2026: «mai una scrittura dentro un ciclo che fallisce».
// La piattaforma respinge tutto per il limite; la pagina sta ritentando la sua
// lettura col limite di richieste vero, e intanto si annota un errore. Prima il
// registro lo sapeva solo a ritentativi finiti, e scriveva in piena tempesta con
// una create che il limite di richieste ripeteva a sua volta.
await sezione('6B. LA TEMPESTA DI 429: IL REGISTRO ASPETTA E SCRIVE UNA VOLTA', async () => {
  delete globalThis[CHIAVE];
  const o = orologio();
  const { raw, richieste, risposte } = clientFinto();
  const limite = () => Object.assign(new Error('Rate limit exceeded'), { status: 429 });
  risposte['Assegnato.filter'] = () => { throw limite(); };
  risposte['ErroreSito.create'] = () => { throw limite(); };
  const client = conLimiteRichieste(raw, { attese: ATTESE });
  const finestra = finestraFinta();
  R.installaRegistroErrori(client, { finestra, adesso: o.adesso, pianifica: o.pianifica });
  const delRegistro = () => richieste.filter(q => q.nome === 'ErroreSito');
  const pagina = client.entities.Assegnato.filter({}).catch(e => e);
  finestra.emetti('error', { error: new TypeError("Cannot read properties of undefined (reading 'mesi')"), message: 'x' });
  for (let i = 0; i < 5; i++) await new Promise(r => setImmediate(r));
  verifica('il primo tentativo respinto ferma subito il registro', R.registroAttivo().registro.stato().ultimo_limite > 0, J(R.registroAttivo().registro.stato()));
  await o.avanza(5000);
  verifica('passato il secondo e mezzo, durante la tempesta, il registro non scrive', delRegistro().length === 0, J(delRegistro()));
  finestra.visibilita('hidden');
  verifica('nemmeno con la scheda in secondo piano', delRegistro().length === 0, J(delRegistro()));
  finestra.visibilita('visible');
  const presa = await pagina;
  verifica('la pagina riceve il suo 429 dopo i ritentativi di sempre', presa && presa.status === 429 && richieste.filter(q => q.nome === 'Assegnato').length === ATTESE.length + 1);
  await o.avanza(60000);
  verifica('un minuto dopo l\'ultimo 429: ancora niente', delRegistro().length === 0, J(delRegistro()));
  await o.avanza(70000);
  verifica('passati i due minuti, una scrittura: UN tentativo solo, senza i ritentativi del limite di richieste', delRegistro().length === 1 && delRegistro()[0].m === 'create', J(delRegistro().map(q => q.m)));
  verifica('la riga respinta si perde e il registro aspetta di nuovo', R.registroAttivo().registro.stato().rifiutate === 1 && R.registroAttivo().registro.stato().in_attesa === 1, J(R.registroAttivo().registro.stato()));
  risposte['ErroreSito.create'] = undefined;
  await o.avanza(3 * 60000);
  verifica('calmato il limite, l\'altra riga si scrive: il 429 della pagina, annotato una volta', delRegistro().length === 2 && delRegistro()[1].a[0].tipo === 'limite' && delRegistro()[1].a[0].coinvolto === 'Assegnato.filter', J(delRegistro().map(q => q.a[0] && q.a[0].tipo)));
});

await sezione('7. LA PAGINA CHE SI ROMPE (PageErrorBoundary)', async () => {
  delete globalThis[CHIAVE];
  const o = orologio();
  const { raw, richieste } = clientFinto();
  const client = conLimiteRichieste(raw, { attese: ATTESE });
  const finestra = finestraFinta({ pathname: '/target-status', search: '?tab=raccoglitori&anno=2026' });
  R.installaRegistroErrori(client, { finestra, adesso: o.adesso, pianifica: o.pianifica });
  const { Componente: Bordo } = await caricaPagina('components/PageErrorBoundary');
  const b = new Bordo({ children: null });
  const errore = new Error('Cannot convert undefined or null to object');
  errore.stack = `TypeError: ${errore.message}\n    at SchedaRaccoglitori (https://app.esempio.it/assets/TargetStatus-abc.js:9:10)`;
  const consoleVera = console.error;
  console.error = () => {};
  try { b.componentDidCatch(errore, { componentStack: '\n    at SchedaRaccoglitori (https://app.esempio.it/assets/TargetStatus-abc.js:9:10)' }); } finally { console.error = consoleVera; }
  await o.avanza(5000);
  const scritte = richieste.filter(q => q.nome === 'ErroreSito' && q.m === 'create').map(q => q.a[0]);
  verifica('la pagina che si rompe: una riga «pagina», col solo percorso', scritte.length === 1 && scritte[0].tipo === 'pagina' && scritte[0].pagina === '/target-status'
    && scritte[0].messaggio === 'Cannot convert undefined or null to object' && scritte[0].dove === 'SchedaRaccoglitori /assets/TargetStatus-abc.js:9:10', J(scritte));
  delete globalThis[CHIAVE];
  let rotto = false;
  console.error = () => {};
  try { new Bordo({}).componentDidCatch(new Error('x'), {}); } catch (_e) { rotto = true; } finally { console.error = consoleVera; }
  verifica('senza registro il bordo fa quello che faceva', !rotto);
});

await sezione('8. LA REGOLA DELL\'ARCHIVIO', async () => {
  const testoEntita = sorgente('base44/entities/ErroreSito.jsonc');
  const e = JSON.parse(testoEntita.split('\n').filter(r => !/^\s*\/\//.test(r)).join('\n'));
  const soloAdmin = (x) => !!x && typeof x === 'object' && J(x) === J({ user_condition: { role: 'admin' } });
  verifica('ognuno crea la riga del suo errore (create: true, come RichiestaUtente)', e.rls && e.rls.create === true, J(e.rls));
  verifica('la legge solo l\'amministratore, e solo lui la modifica e la cancella', soloAdmin(e.rls.read) && soloAdmin(e.rls.update) && soloAdmin(e.rls.delete), J(e.rls));
  verifica('nessuna regola null, nessuna condizione su un campo nostro', !/"(create|read|update|delete)"\s*:\s*null/.test(testoEntita) && !/"data\.[a-z_]+"\s*:/.test(testoEntita));
  const campi = Object.keys(e.properties || {});
  verifica('i campi: giorno, ora, pagina, tipo, messaggio, chiamata, stato, versione, sessione, volte, visto',
    ['giorno', 'il', 'pagina', 'tipo', 'messaggio', 'coinvolto', 'coinvolto_tipo', 'stato_http', 'versione', 'sessione', 'volte', 'impronta', 'visto', 'visto_da', 'visto_il'].every(c => campi.includes(c)), J(campi));
  verifica('e nessun campo per l\'indirizzo intero o per chi (lo dice created_by, che riempie la piattaforma)', !campi.some(c => /url|indirizzo|query|email|utente/.test(c)), J(campi));
  verifica('i tipi sono quelli del registro', J(e.properties.tipo.enum) === J(Object.keys(R.NOMI_TIPI)));
});

// L'orologio di sistema fermo al 14/10/2026: la scheda chiede oggi a oggiRoma.
const DataVera = Date;
const fermaIlGiorno = (iso) => {
  const ms = DataVera.parse(iso);
  globalThis.Date = class extends DataVera { constructor(...a) { if (a.length) super(...a); else super(ms); } static now() { return ms; } };
};
const ripristinaIlGiorno = () => { globalThis.Date = DataVera; };

await sezione('9. LA SCHEDA DELL\'AMMINISTRATORE', async () => {
  fermaIlGiorno('2026-10-14T10:00:00Z');
  try {
    const riga = (id, giorno, altro = {}) => ({ id, giorno, il: `${giorno}T08:00:00.000Z`, ultimo_il: `${giorno}T08:30:00.000Z`, tipo: 'server', messaggio: 'Request failed with status code 500',
      pagina: '/giacenze', coinvolto_tipo: 'funzione', coinvolto: 'calcolaGiacenze', stato_http: 500, volte: 2, visto: false, sessione: 's-' + id, created_by: 'anna@smoco.it', ...altro });
    const RIGHE = [
      riga('a', '2026-10-14'),
      riga('b', '2026-10-13', { created_by: 'luca@smoco.it', volte: 3 }),
      riga('c', '2026-10-12', { tipo: 'pagina', messaggio: 'x is undefined', pagina: '/target-status', coinvolto_tipo: '', coinvolto: '', stato_http: null, volte: 1 }),
      riga('d', '2026-09-20', { tipo: 'rete', messaggio: 'Network Error', stato_http: null }),
      riga('e', '2026-09-03', { tipo: 'rete', messaggio: 'Network Error', stato_http: null }),
      riga('f', '2026-09-01', { tipo: 'rete', messaggio: 'Network Error', stato_http: null }),
      riga('g', '2026-09-01', { tipo: 'limite', messaggio: 'Rate limit exceeded', stato_http: 429, visto: true }),
    ].map(r => ({ ...r, impronta: R.improntaDi(r) }));
    const chiamate = [];
    let archivio = RIGHE.map(r => ({ ...r }));
    const errori = {
      list: async (ord, lim = 5000, salta = 0) => { chiamate.push({ m: 'list', ord }); return archivio.slice(salta, salta + lim).map(r => ({ ...r })); },
      filter: async (f) => { chiamate.push({ m: 'filter', f }); return archivio.filter(r => Object.entries(f || {}).every(([k, v]) => r[k] === v)).map(r => ({ ...r })); },
      bulkUpdate: async (rr) => { chiamate.push({ m: 'bulkUpdate', rr }); for (const x of rr) { const i = archivio.findIndex(r => r.id === x.id); if (i >= 0) archivio[i] = { ...archivio[i], ...x }; } return rr; },
      deleteMany: async (f) => { chiamate.push({ m: 'deleteMany', f }); const prima = archivio.length; archivio = archivio.filter(r => !Object.entries(f).every(([k, v]) => r[k] === v)); return { deleted: prima - archivio.length }; },
      create: async () => { chiamate.push({ m: 'create' }); return {}; },
      update: async () => { chiamate.push({ m: 'update' }); return {}; },
      delete: async () => { chiamate.push({ m: 'delete' }); return {}; },
    };
    const altre = [];
    globalThis.__CLIENTE_FINTO = { entities: new Proxy({}, { get: (_t, n) => (n === 'ErroreSito' ? errori : { list: async () => { altre.push(n); return []; }, filter: async () => { altre.push(n); return []; } }) }), functions: { invoke: async (n) => { altre.push(n); return { data: {} }; } } };
    const { Componente: Scheda, monta } = await caricaPagina('components/alerts/ErroriSito');

    const utente = monta(Scheda, { isAdmin: false, utente: { email: 'utente@smoco.it', role: 'user' } });
    await aspetta();
    verifica('chi non e\' amministratore: niente a video e nessuna lettura', utente.albero === null && chiamate.length === 0 && altre.length === 0, J(chiamate));
    utente.smonta();

    const admin = monta(Scheda, { isAdmin: true, utente: { email: 'admin@smoco.it', role: 'admin' } });
    await aspetta();
    verifica('l\'amministratore: una lettura sola dell\'archivio, e nient\'altro', chiamate.length === 1 && chiamate[0].m === 'list' && altre.length === 0, J(chiamate));
    const gruppi = () => trova(admin.albero, el => el.props && el.props['data-gruppo'] !== undefined);
    const g7 = gruppi();
    verifica('ultimi 7 giorni: due errori diversi (la 500 di calcolaGiacenze di due giorni e la pagina rotta)', g7.length === 2, J(g7.map(g => g.props['data-gruppo'])));
    const primo = g7[0];
    verifica('il gruppo dice chi e quante volte: 5 volte, anna e luca', primo && testo(primo).includes('5 volte') && testo(primo).includes('luca@smoco.it (3)') && testo(primo).includes('anna@smoco.it (2)') && testo(primo).includes('calcolaGiacenze'), primo && testo(primo));
    const riepilogo = trova(admin.albero, el => el.props && el.props['data-riepilogo'] === 'periodo')[0];
    verifica('il riepilogo del periodo all\'italiana', riepilogo && testo(riepilogo) === 'Negli ultimi 7 giorni: 6 errori di 2 generi, da 2 utenti; 2 da vedere.', riepilogo && testo(riepilogo));
    const bottone30 = trova(admin.albero, el => el.type === 'button' && el.props['data-periodo'] === 30)[0];
    bottone30.props.onClick();
    await aspetta();
    verifica('ultimi 30 giorni: entra anche la rete del 20/09, senza rileggere', gruppi().length === 3 && chiamate.length === 1, J([gruppi().length, chiamate.length]));

    const segna = trova(admin.albero, el => el.type === 'button' && el.props['data-azione'] === 'segna-visti' && el.props['data-per'] === primo.props['data-gruppo'])[0];
    await segna.props.onClick();
    await aspetta();
    const bu = chiamate.filter(c => c.m === 'bulkUpdate');
    verifica('«Segna visto»: una scrittura sola, le righe del gruppo, con chi e quando', bu.length === 1 && J(bu[0].rr.map(x => x.id).sort()) === J(['a', 'b'])
      && bu[0].rr.every(x => x.visto === true && x.visto_da === 'admin@smoco.it' && /^2026-10-14T10:00:00/.test(x.visto_il)), J(bu));
    verifica('e la pagina non rilegge: il gruppo diventa visto', chiamate.filter(c => c.m === 'list').length === 1
      && !trova(admin.albero, el => el.props && el.props['data-per'] === primo.props['data-gruppo']).length, J(chiamate.map(c => c.m)));

    const togli = trova(admin.albero, el => el.type === 'button' && el.props['data-azione'] === 'togli-vecchie')[0];
    verifica('«Togli quelli più vecchi di 40 giorni» dice quante righe: le tre di settembre prima del 04/09', togli && testo(togli).includes('Togli quelli più vecchi di 40 giorni (3)'), togli && testo(togli));
    togli.props.onClick();
    await aspetta();
    verifica('prima chiede conferma sulla pagina, e intanto non cancella niente', !chiamate.some(c => c.m === 'deleteMany')
      && trova(admin.albero, el => el.props && el.props['data-conferma'] !== undefined).length === 1);
    const conferma = trova(admin.albero, el => el.type === 'button' && el.props['data-azione'] === 'conferma-pulizia')[0];
    await conferma.props.onClick();
    await aspetta();
    const dm = chiamate.filter(c => c.m === 'deleteMany');
    verifica('confermato: un giorno per volta, filtro di uguaglianza sul giorno, solo i giorni prima del 04/09/2026', J(dm.map(c => c.f)) === J([{ giorno: '2026-09-01' }, { giorno: '2026-09-03' }]), J(dm));
    verifica('poi rilegge una volta, e restano le righe dal 04/09 in poi', chiamate.filter(c => c.m === 'list').length === 2 && J(archivio.map(r => r.id)) === J(['a', 'b', 'c', 'd']), J(archivio.map(r => r.id)));
    const esito = trova(admin.albero, el => el.props && el.props['data-esito'] !== undefined)[0];
    verifica('e dice che cosa ha tolto, all\'italiana', esito && testo(esito) === 'Tolte le righe di 2 giorni, fino al 03/09/2026.', esito && testo(esito));
    verifica('nessuna create, update o delete una per una', !chiamate.some(c => ['create', 'update', 'delete'].includes(c.m)));
    admin.smonta();

    // Revisione del 15/10/2026: le righe come le restituisce la piattaforma
    // (la copia dei dati veri dell'11/10: 31.923 righe con created_by_id,
    // nessuna con created_by). Chi si risale con UNA lettura degli utenti.
    const senzaEmail = RIGHE.slice(0, 3).map(({ created_by, ...r }) => ({ ...r, created_by_id: created_by === 'luca@smoco.it' ? 'u-luca' : (r.id === 'c' ? 'u-tolto' : 'u-anna') }));
    archivio = senzaEmail.map(r => ({ ...r }));
    chiamate.length = 0;
    altre.length = 0;
    const utentiLetti = [];
    globalThis.__CLIENTE_FINTO = { entities: new Proxy({}, { get: (_t, n) => (n === 'ErroreSito' ? errori : n === 'User'
      ? { list: async (...a) => { utentiLetti.push(a); return [{ id: 'u-anna', email: 'anna@smoco.it', role: 'user' }, { id: 'u-luca', email: 'luca@smoco.it', role: 'user' }, { id: 'u-admin', email: 'admin@smoco.it', role: 'admin' }]; } }
      : { list: async () => { altre.push(n); return []; }, filter: async () => { altre.push(n); return []; } }) }), functions: { invoke: async (n) => { altre.push(n); return { data: {} }; } } };
    const conId = monta(Scheda, { isAdmin: true, utente: { email: 'admin@smoco.it', role: 'admin' } });
    await aspetta();
    verifica('righe senza email: una lettura del registro e UNA degli utenti, nient\'altro', chiamate.filter(c => c.m === 'list').length === 1 && utentiLetti.length === 1 && altre.length === 0, J([chiamate, utentiLetti, altre]));
    const gConId = trova(conId.albero, el => el.props && el.props['data-gruppo'] !== undefined);
    const chiPrimo = gConId[0] && trova(gConId[0], el => el.props && el.props['data-chi'] !== undefined)[0];
    verifica('chi si legge per email, risalita da created_by_id', chiPrimo && testo(chiPrimo).startsWith('luca@smoco.it (3) · anna@smoco.it (2)'), chiPrimo && testo(chiPrimo));
    const chiTolto = gConId[1] && trova(gConId[1], el => el.props && el.props['data-chi'] !== undefined)[0];
    verifica('un utente che non c\'e\' piu\': «utente non riconosciuto»', chiTolto && testo(chiTolto).startsWith('utente non riconosciuto (1)'), chiTolto && testo(chiTolto));
    const riepConId = trova(conId.albero, el => el.props && el.props['data-riepilogo'] === 'periodo')[0];
    verifica('e il riepilogo conta 3 utenti (anna, luca e quello che non c\'e\' piu\')', riepConId && testo(riepConId) === 'Negli ultimi 7 giorni: 6 errori di 2 generi, da 3 utenti; 2 da vedere.', riepConId && testo(riepConId));
    const rileggi = trova(conId.albero, el => el.type === 'button' && el.props['data-azione'] === 'rileggi')[0];
    await rileggi.props.onClick();
    await aspetta();
    verifica('«Rileggi» rilegge il registro ma non gli utenti (gli id sono gia\' cercati)', chiamate.filter(c => c.m === 'list').length === 2 && utentiLetti.length === 1, J([chiamate.length, utentiLetti.length]));
    conId.smonta();
    const utenteCon = monta(Scheda, { isAdmin: false, utente: { email: 'utente@smoco.it', role: 'user' } });
    await aspetta();
    verifica('chi non e\' amministratore non legge nemmeno gli utenti', utentiLetti.length === 1 && utenteCon.albero === null);
    utenteCon.smonta();

    // Una lettura che cade non riparte da sola.
    let letture = 0;
    errori.list = async () => { letture++; throw Object.assign(new Error('Request failed with status code 500'), { response: { status: 500, data: { error: 'Database occupato' } } }); };
    const caduta = monta(Scheda, { isAdmin: true, utente: { email: 'admin@smoco.it' } });
    await aspetta(60);
    verifica('una lettura che cade non riparte da sola, e lo dice col motivo', letture === 1 && testo(caduta.albero).includes('Gli errori del sito non si sono letti (Database occupato).'), testo(caduta.albero).slice(0, 200));
    caduta.smonta();
  } finally {
    ripristinaIlGiorno();
  }
});

await sezione('10. LA PAGINA ALERT & CONTROLLO', async () => {
  const IMPORT_PERMESSI = "import { usePermessi } from '@/lib/permessi';";
  const s = sorgente('src/pages/AlertEngine.jsx');
  verifica('la pagina prende i permessi da usePermessi, come la copia si aspetta', s.includes(IMPORT_PERMESSI));
  const f = join(cartella, 'AlertEngine.jsx');
  writeFileSync(f, s.replace(IMPORT_PERMESSI, 'const usePermessi = () => globalThis.__PERMESSI_PROVA;'));
  globalThis.__CLIENTE_FINTO = { entities: new Proxy({}, { get: () => ({ list: async () => [], filter: async () => [] }) }), functions: { invoke: async () => ({ data: {} }) } };
  const { Componente: Pagina, monta } = await caricaPagina('pages/AlertEngine', { file: f });
  const apri = async (isAdmin, search = '') => {
    globalThis.window.location = { search, pathname: '/alert-engine' };
    globalThis.__PERMESSI_PROVA = { isAdmin, soloLettura: !isAdmin, user: { email: isAdmin ? 'admin@smoco.it' : 'utente@smoco.it' } };
    const p = monta(Pagina, {});
    await aspetta();
    const linguette = trova(p.albero, 'TabsTrigger').map(t => t.props.value);
    const scheda = trova(p.albero, 'ErroriSito')[0];
    const tabs = trova(p.albero, 'Tabs')[0];
    const barra = trova(p.albero, 'TabsList')[0];
    p.smonta();
    return { linguette, scheda, valore: tabs && tabs.props.value, barra: barra && barra.props.className };
  };
  const a = await apri(true);
  // Revisione del 15/10/2026: con la terza linguetta la barra a 375 px non sta
  // su una riga (misurata: 395 px contro 343 utili). Va a capo, come in
  // Fatturazione.
  verifica('la barra delle linguette va a capo sul telefono (flex-wrap h-auto)', /\bflex-wrap\b/.test(String(a.barra)) && /\bh-auto\b/.test(String(a.barra)), String(a.barra));
  verifica('l\'amministratore ha la scheda «Errori del sito», con i suoi permessi', J(a.linguette) === J(['alerts', 'regole', 'errori']) && a.scheda && a.scheda.props.isAdmin === true && a.scheda.props.utente.email === 'admin@smoco.it', J(a.linguette));
  const u = await apri(false);
  verifica('chi non e\' amministratore non la vede', J(u.linguette) === J(['alerts', 'regole']) && !u.scheda, J(u.linguette));
  const daVoce = await apri(true, '?tab=errori');
  verifica('dalla voce di «Da gestire» (?tab=errori) si apre sugli errori', daVoce.valore === 'errori', String(daVoce.valore));
  const daVoceUtente = await apri(false, '?tab=errori');
  verifica('chi non e\' amministratore, con lo stesso indirizzo, vede gli alert', daVoceUtente.valore === 'alerts', String(daVoceUtente.valore));
  verifica('senza indirizzo, gli alert come prima', a.valore === 'alerts', String(a.valore));
  delete globalThis.window.location;
});

await sezione('11. NEL SORGENTE: IL REGISTRO SI INSTALLA PRIMA DELLA PRIMA PAGINA', async () => {
  const main = sorgente('src/main.jsx');
  const iInstalla = main.indexOf('installaRegistroErrori(base44)');
  verifica('main.jsx installa il registro sul client delle pagine, prima di disegnare l\'app', iInstalla > 0 && iInstalla < main.indexOf('ReactDOM.createRoot') && /import \{ base44 \} from '@\/api\/base44Client'/.test(main));
  const bordo = sorgente('src/components/PageErrorBoundary.jsx');
  verifica('PageErrorBoundary manda la pagina rotta al registro', /componentDidCatch\(error, errorInfo\) \{[\s\S]*?segnalaErrorePagina\(error, errorInfo\);[\s\S]*?\}/.test(bordo));
  const lib = sorgente('src/lib/registroErrori.js');
  verifica('la libreria non importa librerie pesanti ne\' il client (resta nel pacchetto d\'avvio, piccola)', !/from ['"](exceljs|jspdf|xlsx|recharts|@\/api\/base44Client)/.test(lib) && !/^import .* from '@\//m.test(lib));
});

togliCartella();
verifica('la cartella temporanea delle copie delle pagine non resta', !existsSync(cartella), cartella);

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
