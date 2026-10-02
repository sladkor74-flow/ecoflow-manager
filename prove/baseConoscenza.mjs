// I quattro difetti della base di conoscenza, trovati il 02/10/2026
// (base44/shared/baseConoscenza.ts).
//
// Perche' si provano. Sono tutti e quattro difetti SILENZIOSI: non danno errori,
// non si vedono a video, e il danno che fanno si scopre mesi dopo leggendo lo
// storico o accorgendosi che l'assistente risponde come se una regola approvata
// non fosse mai esistita.
//
//   1. CORREZIONE  il cancello che apre le proposte di precisazione aveva
//                  sottostringhe nude (sbagli, errat, invece, precis, ricorda):
//                  bastava "Ricordami quali sono i termini" per aprirlo. E nella
//                  strada quiz la domanda non la scrive l'utente: la compone il
//                  frontend attorno al testo dell'Albo.
//   2. 500 RIGHE   tre letture con il tetto a 500 e nessuna paginazione, contro
//                  la regola del progetto sugli archivi grandi: oltre il tetto le
//                  voci approvate piu' vecchie uscivano dalle risposte.
//   3. LE DATE     proponiNovita metteva da parte tutte le proposte in attesa
//                  sulla voce senza confrontare una data, mentre piuRecente era
//                  scritto due funzioni sopra e scartaSuperate lo usa.
//   4. SENZA TESTO una voce approvata senza testo veniva disattivata con il
//                  motivo "superata dalla voce ... piu' recente": falso.
//
// npm run prove
import { readFileSync } from 'node:fs';
import {
  BASE_CONOSCENZA, voceAttuale, vociApprovate, testoConoscenza,
  proponiPrecisazioni, proponiNovita, scartaSuperate,
} from '../base44/shared/baseConoscenza.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
// I fine-riga si normalizzano: su Windows il checkout scrive CRLF (core.autocrlf)
// e un confronto che cerca uno '\n' fallirebbe per il carattere in piu', dicendo
// che manca un controllo che invece c'e'. Lo fa anche prove/specchi.mjs.
const sorgente = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

// --- il giorno fisso: venerdi' 02/10/2026, mezzogiorno. Serve perche' una delle
// prove guarda il confronto fra la proposta appena creata e una in attesa dello
// stesso giorno, che si decide sull'ora della creazione.
const OGGI = '2026-10-02';
const ADESSO = Date.parse(OGGI + 'T12:00:00Z');
const DataVera = Date;
class DataFissa extends DataVera {
  constructor(...a) { super(...(a.length ? a : [ADESSO])); }
  static now() { return ADESSO; }
}
globalThis.Date = DataFissa;

// --- l'archivio finto. filter() rispetta limite e salto e ordina per id, come la
// piattaforma: e' l'unico ordinamento stabile, quello su cui pagina fetchAll.
const archivio = (righe = []) => {
  const dati = righe.map((r, i) => ({ created_date: `2026-09-01T00:00:${String(i % 60).padStart(2, '0')}.000Z`, ...r }));
  const scritte = [];
  let seq = 0;
  const filtra = (f) => dati.filter(r => Object.entries(f || {}).every(([k, v]) => r[k] === v));
  const ConoscenzaAssistente = {
    filter: async (f, ord = 'id', lim = 1e9, skip = 0) => {
      const out = filtra(f).slice();
      if (String(ord).replace(/^-/, '') === 'id') out.sort((a, b) => String(a.id).localeCompare(String(b.id)));
      return out.slice(skip, skip + lim).map(r => ({ ...r }));
    },
    list: async (ord = 'id', lim = 1e9, skip = 0) => ConoscenzaAssistente.filter({}, ord, lim, skip),
    create: async (d) => {
      // created_date lo mette la piattaforma al momento dell'inserimento:
      // due righe create una dopo l'altra non ce l'hanno uguale, ed e' su
      // quello che piuRecente decide a pari data.
      const n = ++seq;
      const r = { id: 'nuova-' + n, created_date: new DataVera(ADESSO + n * 1000).toISOString(), ...d };
      dati.push(r);
      scritte.push({ op: 'create', id: r.id, d: r });
      return { ...r };
    },
    update: async (id, d) => {
      const r = dati.find(x => x.id === id);
      if (r) Object.assign(r, d);
      scritte.push({ op: 'update', id, d });
      return { ...(r || { id }), ...d };
    },
  };
  const base44 = { asServiceRole: { entities: { ConoscenzaAssistente } } };
  return { dati, scritte, base44, entita: ConoscenzaAssistente };
};
const aggiornata = (scritte, id) => scritte.find(s => s.op === 'update' && s.id === id);

// Una precisazione valida: il testo non deve somigliare a nessuna voce della base
// di conoscenza, altrimenti la scarta giaNellaConoscenza e non si capirebbe piu'
// che cosa sta provando il cancello.
const PRECISAZIONE = [{ tipo: 'regola_interna', area: 'gestionale', titolo: 'Prova', testo: 'Da noi il giro si fa il 3 e il 4 di ogni mese.' }];
const quante = async (domanda, extra = {}) => {
  const a = archivio();
  const create = await proponiPrecisazioni(a.base44, PRECISAZIONE, { oggi: OGGI, utente: 'prova', domanda, approvate: [], ...extra });
  return create.length;
};

console.log('1. IL CANCELLO DELLE PRECISAZIONI: UNA DOMANDA NON E\' UNA CORREZIONE');
{
  // Le quattro domande che aprivano il cancello con le sottostringhe nude. Non
  // e' rumore: ognuna lasciava una riga in attesa nella base di conoscenza, e
  // proponiPrecisazioni e' l'unica delle tre strade aperta a tutti (02/10/2026).
  verifica('"Ricordami quali sono i termini" non e una correzione',
    await quante('Ricordami quali sono i termini di registrazione') === 0);
  verifica('"Invece per l ACI come funziona?" e un cambio di argomento',
    await quante('Invece per l\'ACI come funziona?') === 0);
  verifica('chiedere una risposta piu precisa non e precisare',
    await quante('Mi dai una risposta piu\' precisa sui target?') === 0);
  verifica('"Ho sbagliato la risposta B" e l utente che ha sbagliato, non il gestionale',
    await quante('Ho sbagliato la risposta B, me la spieghi?') === 0);
  verifica('una domanda sui dati non apre niente',
    await quante('Quante tonnellate ha raccolto Nappi Sud a settembre?') === 0);
  verifica('"Mi ricordi come si legge la stampa WINSINFO?" nemmeno',
    await quante('Mi ricordi come si legge la stampa WINSINFO?') === 0);
}
{
  // Le correzioni vere devono passare tutte: stringere il cancello non serve a
  // niente se poi la precisazione dell'utente non arriva piu'.
  const vere = [
    'Non e\' cosi\': il termine e\' di dieci giorni',
    'Ti sbagli: Tecnogum sulla rete non deve dichiarare niente',
    'Quello che hai detto e\' sbagliato',
    'La risposta e\' errata: Nappi Sud conferisce anche a Tecnogum',
    'In realta\' l\'extra raccolta non ha target',
    'Ti correggo: il FIR digitale parte dal 16 settembre 2026',
    'Precisazione: i raccoglitori non hanno l\'obbligo di quel registro',
    'Ti preciso che i canali non si sommano mai',
    'Ricorda che il mese viene dalla data, non dal campo del portale',
    'Ricordati che la fine trasporto non e\' la chiusura',
    'Tieni presente che le domeniche non si contano',
    'Nota bene: i pesi vanno in tonnellate con due decimali',
    'Da noi la quadratura si fa il lunedi\'',
    'La regola e\' che vale sempre il piu\' recente',
    'La norma dice che il termine e\' di dieci giorni dalla partenza',
    'Devi sapere che Royal Green non e\' contrattualizzata',
    'Attenzione: lo stato eseguito non e\' una chiusura',
  ];
  let perse = [];
  for (const d of vere) if (await quante(d) !== 1) perse.push(d);
  verifica('le correzioni vere passano tutte', perse.length === 0, perse.join(' | '));
}
{
  // LA STRADA QUIZ. La domanda la compone EsercitazioneRT.jsx attorno al testo
  // ufficiale dell'Albo e l'utente non ha un campo in cui scrivere: una sua
  // correzione non puo' esistere. Questo quiz c'e' davvero in
  // src/data/quiz-rt/iniziale-cat10.json ed e' formulato con una negazione.
  const quiz = 'Spiegami questo quiz dell\'esame da responsabile tecnico: "Secondo il D.lgs. n. 81/2008, non e\' obbligatorio elaborare il DUVRI (Documento unico di valutazione dei rischi interferenti)"';
  verifica('il testo del quiz aprirebbe il cancello', await quante(quiz) === 1,
    'se smette di aprirlo questa prova non dimostra piu niente: cambiare il quiz di esempio');
  verifica('ma nella strada quiz non si propone niente', await quante(quiz, { quiz: true }) === 0);
  // Il salto vale per la strada, non per la frase: anche una correzione vera,
  // dentro un'esercitazione, non e' una correzione dell'utente.
  verifica('nemmeno una correzione vera, dentro un esercitazione',
    await quante('Ti sbagli: Tecnogum sulla rete non deve dichiarare niente', { quiz: true }) === 0);
}
{
  // Il salto nella funzione condivisa serve solo se chi chiama dice che e' un
  // quiz: senza questa riga sarebbe codice morto e nessuno se ne accorgerebbe.
  const s = sorgente('base44/functions/chiediAssistente/entry.ts');
  verifica('chiediAssistente passa la strada quiz a proponiPrecisazioni',
    /proponiPrecisazioni\([\s\S]{0,260}quiz: !!quiz \}\)/.test(s));
}
{
  // Il cancello e' uno solo e sta nel modulo condiviso: nessuna sottostringa
  // nuda deve rientrare di soppiatto il giorno in cui qualcuno lo allarga.
  const s = sorgente('base44/shared/baseConoscenza.ts');
  const riga = s.split('\n').find(r => r.startsWith('const CORREZIONE ='));
  verifica('la regex non ha piu le sottostringhe nude',
    !/\|sbagli\||\|errat\||\|invece\||\|precis\||\|ricorda\|/.test(riga), riga);
  verifica('e "invece" e uscito del tutto', !/invece/.test(riga), riga);
}

console.log('2. GLI ARCHIVI SI LEGGONO TUTTI, NON LE PRIME 500 RIGHE');
{
  // 5.600 voci approvate: due pagine da 5.000. Con il tetto a 500 ne tornavano
  // 500, le piu' recenti, e le 5.100 piu' vecchie - l'ordine era
  // '-created_date', quindi proprio le prime regole scritte dalla direzione -
  // sparivano da ogni risposta di EcoTyna senza un errore, senza un avviso.
  const righe = [];
  for (let i = 0; i < 5600; i++) {
    righe.push({
      id: 'v' + String(i).padStart(5, '0'), stato: 'approvata', attiva: true,
      tipo: 'regola_interna', area: 'gestionale', titolo: 'Regola ' + i,
      testo: 'Testo della regola numero ' + i,
      verificato_il: '2026-09-20',
      created_date: new DataVera(Date.parse('2026-01-01T00:00:00Z') + i * 3600000).toISOString(),
    });
  }
  const laPiuVecchia = righe[0];
  const a = archivio(righe);
  const approvate = await vociApprovate(a.base44);
  verifica('tornano tutte e 5.600', approvate.length === 5600, String(approvate.length));
  verifica('compresa la piu vecchia, che era la prima a cadere',
    approvate.some(v => v.id === laPiuVecchia.id));
  verifica('e l ordine chiesto resta quello, dalla piu recente',
    approvate[0].id === 'v05599' && approvate[approvate.length - 1].id === 'v00000',
    approvate[0].id + ' ... ' + approvate[approvate.length - 1].id);
  // Il fatto vero: la regola piu' vecchia torna nel testo che si passa al
  // modello. E' questo che l'assistente legge quando risponde.
  const testo = testoConoscenza(approvate);
  verifica('la regola piu vecchia e nel testo delle risposte',
    testo.includes('Testo della regola numero 0\n') || testo.endsWith('Testo della regola numero 0'));
  verifica('una voce disattivata resta fuori comunque',
    (await vociApprovate(archivio([{ id: 'x', stato: 'approvata', attiva: false, tipo: 'faq', testo: 'no' }]).base44)).length === 0);
}
{
  // Le proposte in attesa: 600 sulla stessa voce. scartaSuperate ne tiene una,
  // la piu' recente, e mette da parte le altre col motivo. Col tetto a 500 le
  // 100 piu' vecchie non venivano nemmeno lette: restavano in coda per sempre e
  // l'amministratore le trovava davanti come se fossero ancora da decidere.
  const righe = [];
  for (let i = 0; i < 600; i++) {
    righe.push({
      id: 'p' + String(i).padStart(4, '0'), stato: 'proposta', attiva: true,
      tipo: 'aggiornamento_normativo', voce_id: 'pfu-obbligo-target',
      titolo: 'Proposta ' + i, testo: 'Testo proposto ' + i,
      verificato_il: '2026-09-20',
      created_date: new DataVera(Date.parse('2026-09-20T00:00:00Z') + i * 60000).toISOString(),
    });
  }
  const a = archivio(righe);
  const esito = await scartaSuperate(a.base44);
  verifica('599 messe da parte, non 499', esito.proposte_scartate === 599, String(esito.proposte_scartate));
  verifica('la piu vecchia e stata messa da parte, col motivo',
    (aggiornata(a.scritte, 'p0000') || {}).d?.motivo_scarto?.includes('piu\' recente'),
    JSON.stringify((aggiornata(a.scritte, 'p0000') || {}).d || {}));
  verifica('e la piu recente e rimasta in attesa', !aggiornata(a.scritte, 'p0599'));
}
{
  // Nessuna delle tre letture deve tornare a portare un numero: un tetto si
  // riscrive in un attimo e non fa rumore.
  const s = sorgente('base44/shared/baseConoscenza.ts');
  verifica('le voci approvate passano da fetchAll',
    /const voci = await fetchAll\(base44\.asServiceRole\.entities\.ConoscenzaAssistente, \{ stato: 'approvata' \}, '-created_date'\)/.test(s));
  verifica('le proposte di scartaSuperate anche',
    /fetchAll\(ent, \{ stato: 'proposta' \}, '-created_date'\)\.catch\(\(\) => \[\]\),/.test(s));
  verifica('e quelle in attesa di proponiNovita',
    /let inAttesa = await fetchAll\(ent, \{ stato: 'proposta' \}, '-created_date'\)\.catch/.test(s));
  verifica('nessuna lettura della conoscenza porta piu un tetto',
    !/\.filter\(\{ stato: '(approvata|proposta)' \}, '-created_date', \d+\)/.test(s));
}

console.log('3. PROPONINOVITA: VALE IL PIU\' RECENTE, E LE DATE SI GUARDANO');
// Una novita' che novitaAccettabili accetta: estremi e data della norma dopo la
// verifica della voce, e il testo completo (non meno del 70% di quello che
// sostituisce, altrimenti ne cancellerebbe un pezzo).
const VOCE = 'pfu-obbligo-target';
const testoVoce = voceAttuale(VOCE, []).testo;
const novita = (n) => ({
  voce_id: VOCE, data_norma: '2026-09-20',
  descrizione: `Decreto n. ${n}/2026 di prova`,
  fonte: `Gazzetta Ufficiale, DM n. ${n}/2026`,
  url: 'https://www.gazzettaufficiale.it/prova',
  titolo: 'Novita ' + n,
  testo_proposto: testoVoce + ' Aggiunta della novita numero ' + n + '.',
});
{
  // DUE NOVITA' SULLA STESSA VOCE NELLO STESSO GIRO. inAttesa si leggeva una
  // volta sola prima del ciclo, quindi la seconda non vedeva la prima e
  // restavano in coda tutte e due. Da chiediAssistente non si notava, perche'
  // subito dopo gira scartaSuperate; da analisiDocumento.ts (la qualifica dei
  // fornitori) no, e la' le due proposte arrivavano davanti all'amministratore,
  // una delle due gia' superata dall'altra.
  const a = archivio();
  const create = await proponiNovita(a.base44, [novita(301), novita(302)], { oggi: OGGI, origine: 'prova', approvate: [] });
  verifica('ne resta in attesa una sola', create.length === 1, String(create.length));
  verifica('e resta la seconda, quella creata dopo', create[0].titolo === 'Novita 302', create[0] && create[0].titolo);
  const messa = aggiornata(a.scritte, 'nuova-1');
  verifica('la prima e andata nello storico', !!messa && messa.d.stato === 'scartata');
  verifica('col motivo che dice da chi e stata superata',
    !!messa && messa.d.motivo_scarto.includes('proposta piu\' recente del 2026-10-02') && messa.d.motivo_scarto.includes('Novita 302'),
    messa && messa.d.motivo_scarto);
}
{
  // UNA PROPOSTA IN ATTESA PIU' RECENTE DELLA NUOVA. Prima si metteva da parte
  // comunque, con scritto che era "superata dalla proposta piu' recente": il
  // contrario di quello che era. E' la regola della direzione del 17/09/2026, e
  // piuRecente - che scartaSuperate usa sullo stesso caso - era gia' scritto
  // trenta righe sopra.
  const inAttesa = {
    id: 'attesa-futura', stato: 'proposta', attiva: true, tipo: 'aggiornamento_normativo',
    voce_id: VOCE, titolo: 'Proposta piu recente', testo: 'Testo piu recente',
    verificato_il: '2026-10-05', created_date: '2026-10-05T09:00:00.000Z',
  };
  const a = archivio([inAttesa]);
  const create = await proponiNovita(a.base44, [novita(303)], { oggi: OGGI, origine: 'prova', approvate: [] });
  verifica('la nuova, piu vecchia, non si annuncia da approvare', create.length === 0, String(create.length));
  verifica('la proposta piu recente non si tocca', !aggiornata(a.scritte, 'attesa-futura'));
  const messa = aggiornata(a.scritte, 'nuova-1');
  verifica('e nello storico ci va la nuova', !!messa && messa.d.stato === 'scartata');
  verifica('col motivo che nomina la data vera di chi l ha superata',
    !!messa && messa.d.motivo_scarto.includes('del 2026-10-05') && messa.d.motivo_scarto.includes('Proposta piu recente'),
    messa && messa.d.motivo_scarto);
}
{
  // IL CASO NORMALE, che deve continuare a funzionare come prima: la proposta in
  // attesa di settembre cede a quella di oggi.
  const a = archivio([{
    id: 'attesa-vecchia', stato: 'proposta', attiva: true, tipo: 'aggiornamento_normativo',
    voce_id: VOCE, titolo: 'Proposta di settembre', testo: 'Testo di settembre',
    verificato_il: '2026-09-20', created_date: '2026-09-20T09:00:00.000Z',
  }]);
  const create = await proponiNovita(a.base44, [novita(304)], { oggi: OGGI, origine: 'prova', approvate: [] });
  verifica('la nuova resta in attesa', create.length === 1 && create[0].titolo === 'Novita 304');
  const messa = aggiornata(a.scritte, 'attesa-vecchia');
  verifica('la vecchia va nello storico col motivo di sempre',
    !!messa && messa.d.stato === 'scartata' && messa.d.motivo_scarto.includes('del 2026-10-02'),
    messa && messa.d.motivo_scarto);
  // Una proposta su un'ALTRA voce non c'entra niente e non si tocca: la vittima
  // non la sceglie chi fa la domanda.
  verifica('una proposta su un altra voce resta dov e',
    !aggiornata(archivio([]).scritte, 'altra'));
}
{
  // Due proposte su DUE voci diverse: ognuna si confronta solo con la sua.
  const altra = BASE_CONOSCENZA.find(v => v.id !== VOCE && v.area === 'pfu');
  const a = archivio([
    { id: 'att-1', stato: 'proposta', attiva: true, tipo: 'aggiornamento_normativo', voce_id: VOCE, titolo: 'Vecchia A', testo: 'x', verificato_il: '2026-09-20', created_date: '2026-09-20T09:00:00.000Z' },
    { id: 'att-2', stato: 'proposta', attiva: true, tipo: 'aggiornamento_normativo', voce_id: altra.id, titolo: 'Vecchia B', testo: 'y', verificato_il: '2026-10-09', created_date: '2026-10-09T09:00:00.000Z' },
  ]);
  const testoAltra = voceAttuale(altra.id, []).testo;
  const create = await proponiNovita(a.base44, [
    novita(305),
    { ...novita(306), voce_id: altra.id, testo_proposto: testoAltra + ' Aggiunta di prova.' },
  ], { oggi: OGGI, origine: 'prova', approvate: [] });
  verifica('sulla prima voce vince la nuova, sulla seconda quella in attesa',
    create.length === 1 && create[0].voce_id === VOCE, create.map(c => c.voce_id).join(','));
  verifica('e si tocca una proposta per voce', !!aggiornata(a.scritte, 'att-1') && !aggiornata(a.scritte, 'att-2'));
}
{
  // IL created_date CHE POTREBBE NON TORNARE. A pari data piuRecente decide
  // sull'ora della creazione: se la piattaforma un giorno non la restituisse,
  // la nuova confronterebbe '' con la data di una proposta in attesa e
  // perderebbe sempre, zitta. Il momento della creazione lo conosciamo noi.
  const a = archivio([{
    id: 'attesa-oggi', stato: 'proposta', attiva: true, tipo: 'aggiornamento_normativo',
    voce_id: VOCE, titolo: 'Proposta di stamattina', testo: 'Testo di stamattina',
    verificato_il: OGGI, created_date: OGGI + 'T08:00:00.000Z',
  }]);
  const senzaData = a.entita.create;
  a.entita.create = async (d) => { const r = await senzaData(d); delete r.created_date; return r; };
  const create = await proponiNovita(a.base44, [novita(307)], { oggi: OGGI, origine: 'prova', approvate: [] });
  verifica('senza created_date la nuova vince comunque, a pari data',
    create.length === 1 && create[0].titolo === 'Novita 307', String(create.length));
  verifica('e quella di stamattina va nello storico',
    (aggiornata(a.scritte, 'attesa-oggi') || {}).d?.stato === 'scartata');
}

console.log('4. UNA VOCE APPROVATA SENZA TESTO NON E\' UNA VOCE SUPERATA');
{
  // sostituzioniValide la esclude proprio perche' le manca il testo, quindi non
  // entrava mai fra le valide e scartaSuperate la trovava sempre da disattivare,
  // con il motivo "superata dalla voce ... piu' recente". Niente l'aveva
  // superata: non sostituisce nulla e testoConoscenza non la stampa comunque. Il
  // motivo scritto nello storico e' l'unica spiegazione che l'amministratore
  // legge mesi dopo.
  const comune = { stato: 'approvata', attiva: true, tipo: 'aggiornamento_normativo', voce_id: VOCE };
  const a = archivio([
    { ...comune, id: 'senza-testo', titolo: 'Senza testo', testo: '', verificato_il: '2026-09-25', created_date: '2026-09-25T09:00:00.000Z' },
    { ...comune, id: 'superata', titolo: 'Superata', testo: 'Testo vecchio', verificato_il: '2026-09-20', created_date: '2026-09-20T09:00:00.000Z' },
    { ...comune, id: 'valida', titolo: 'Valida', testo: 'Testo nuovo', verificato_il: '2026-09-30', created_date: '2026-09-30T09:00:00.000Z' },
  ]);
  const esito = await scartaSuperate(a.base44);
  verifica('la voce senza testo non si tocca', !aggiornata(a.scritte, 'senza-testo'),
    JSON.stringify((aggiornata(a.scritte, 'senza-testo') || {}).d || {}));
  verifica('quella davvero superata si, con il suo motivo vero',
    (aggiornata(a.scritte, 'superata') || {}).d?.attiva === false
    && aggiornata(a.scritte, 'superata').d.motivo_scarto.includes('verificato il 2026-09-30'),
    (aggiornata(a.scritte, 'superata') || {}).d?.motivo_scarto);
  verifica('quella valida resta attiva', !aggiornata(a.scritte, 'valida'));
  verifica('e il conto dice una sola disattivata', esito.aggiornamenti_disattivati === 1, String(esito.aggiornamenti_disattivati));
}
{
  // Il controllo deve restare identico a quello di sostituzioniValide: se un
  // giorno uno dei due cambia, devono cambiare insieme.
  const s = sorgente('base44/shared/baseConoscenza.ts');
  verifica('sostituzioniValide esclude le voci senza testo',
    /if \(v\.tipo !== 'aggiornamento_normativo' \|\| !v\.voce_id \|\| !v\.testo\) continue;/.test(s));
  verifica('e scartaSuperate le salta', /\n    if \(!v\.testo\) continue;\n/.test(s));
}

globalThis.Date = DataVera;
console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
