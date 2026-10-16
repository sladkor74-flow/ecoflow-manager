// ECOTYNA E LE ORE DEI FILE DEL PORTALE (difetto 9, 16/10/2026).
//
// Il portale scrive l'ora ITALIANA, e il gestionale la salva com'e' scritta, con
// la Z per convenzione: «31/12/2026 23:30» e' '2026-12-31T23:30:00.000Z', cioe'
// le 23:30 italiane, non le 23:30 UTC. EcoTyna leggeva l'immissione e la
// chiusura degli ordini con giornoRoma, che le aggiungeva di nuovo l'ora
// italiana: un ordine immesso dopo le 22 d'estate o dopo le 23 d'inverno finiva
// al giorno dopo. Alla domanda «quando e' stato immesso ET26020377?» rispondeva
// 01/02/2026, e l'ordine e' stato immesso il 31/01/2026 alle 23:55.
//
// Qui si provano, sulle funzioni vere e con un banco costruito, gli strumenti di
// EcoTyna che leggono un'ora del portale (strumentiAssistente) e
// terminatiSenzaFine (assistente):
//   1. la coda degli ordini aperti (ordini_aperti, rete e ACI): il giorno di
//      immissione e i giorni di attesa; l'eta' dell'arretrato (etaArretrato del
//      cruscotto, la stessa della pagina); il filtro «da almeno N giorni»;
//   2. le secondarie e le terziarie aperte: immissione e giorni di attesa;
//   3. il dettaglio di un ordine (cerca_movimento): le quattro date;
//   4. i terminati senza fine trasporto, divisi per anno di immissione;
//   5. EcoTyna intera (chiediAssistente col banco prove/dati/bancoEcoTyna.mjs):
//      «quando e' stato immesso ET26020377?» arriva al modello col 31/01/2026.
// Il valore di prova e' quello delle 23:30 del 31/12, che col giorno sbagliato
// cambia anche mese e anno, e quello vero di ET26020377.
//
// LA PROVA GIRA DUE VOLTE, con TZ=UTC (il server) e con TZ=Europe/Rome (il
// browser): si rilancia da sola, pretende lo stesso esito e le stesse risposte,
// carattere per carattere. «Oggi» e' fissato (31/12/2026 e 31/01/2027), e niente
// dipende dalla velocita' della macchina.
//
// Controprova: col codice di prima (giornoRoma e soloData) l'ordine del 31/12
// alle 23:30 esce immesso il 01/01/2027, con -1 giorni di attesa, fra i
// terminati senza fine immessi nel 2027, e fuori dal filtro «da almeno 31
// giorni» al 31/01/2027; ET26020377 esce immesso il 01/02/2026.
//
// npm run prove
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const FUSI = ['UTC', 'Europe/Rome'];

if (!process.env.ORE_PORTALE_ECOTYNA_FUSO) {
  let fallite = 0;
  const risposte = {};
  for (const fuso of FUSI) {
    const r = spawnSync(process.execPath, ['--no-warnings', fileURLToPath(import.meta.url)], {
      env: { ...process.env, TZ: fuso, ORE_PORTALE_ECOTYNA_FUSO: fuso }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    });
    // Le righe si spezzano su tutti e due i fine-riga.
    const righe = (r.stdout || '').split(/\r?\n/);
    const riga = righe.find(l => l.startsWith('RISPOSTE '));
    risposte[fuso] = riga ? riga.slice('RISPOSTE '.length) : null;
    console.log(`\n===== con TZ=${fuso} =====`);
    console.log(righe.filter(l => !l.startsWith('RISPOSTE ')).join('\n').trim());
    if ((r.stderr || '').trim()) console.log(r.stderr.trim());
    if (r.status !== 0) fallite++;
  }
  console.log('\nLE STESSE RISPOSTE IN TUTTI E DUE I FUSI');
  const a = risposte.UTC, b = risposte['Europe/Rome'];
  if (a === null || b === null) {
    fallite++;
    console.log('  FALLITA: un fuso non ha restituito le risposte');
  } else if (a !== b) {
    fallite++;
    const ja = JSON.parse(a), jb = JSON.parse(b);
    const diverse = Object.keys({ ...ja, ...jb }).filter(k => JSON.stringify(ja[k]) !== JSON.stringify(jb[k]));
    console.log(`  FALLITA: ${diverse.length} risposte diverse fra UTC e Roma`);
    for (const k of diverse.slice(0, 15)) console.log(`    ${k}: UTC ${JSON.stringify(ja[k])} / Roma ${JSON.stringify(jb[k])}`);
  } else console.log(`  ${Object.keys(JSON.parse(a)).length} risposte, identiche`);
  console.log(fallite ? `\nFALLITA in ${fallite} punti` : '\ntutto superato, in UTC e in Roma');
  process.exit(fallite ? 1 : 0);
}

// ===========================================================================
// Da qui in giu' gira una volta per fuso.
// ===========================================================================
const FUSO = process.env.ORE_PORTALE_ECOTYNA_FUSO;
const R = new URL('../base44/shared/', import.meta.url).href;
const S = await import(R + 'strumentiAssistente.ts');
const { terminatiSenzaFine } = await import(R + 'assistente.ts');
const { caricaEcoTyna, chiedi } = await import('./dati/bancoEcoTyna.mjs');
const EcoTyna = await caricaEcoTyna();

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + String(extra).slice(0, 600)); } };
const J = (v) => String(JSON.stringify(v)).slice(0, 600);
// Le risposte da confrontare fra i due fusi.
const RISPOSTE = {};
const annota = (chiave, valore) => { RISPOSTE[chiave] = valore === undefined ? null : valore; return valore; };

// «Oggi» fissato: oggiRoma() legge new Date() quando e' chiamata, quindi basta
// sostituire Date per il tempo della chiamata. A mezzogiorno UTC il giorno
// italiano e' lo stesso in tutti e due i fusi.
const DataVera = Date;
const conOggi = async (giorno, fn) => {
  const ms = DataVera.parse(`${giorno}T12:00:00.000Z`);
  globalThis.Date = class extends DataVera {
    constructor(...a) { if (a.length) super(...a); else super(ms); }
    static now() { return ms; }
  };
  try { return await fn(); } finally { globalThis.Date = DataVera; }
};

// Il banco: un ordine per archivio immesso «31/12/2026 23:30», come lo salva lo
// scrittore unico, piu' la replica di ET26020377 (immesso il 31/01/2026 alle
// 23:55:47, fine trasporto il 06/02/2026, chiuso a portale il 09/02/2026 alle
// 10:45:14) e un terminato senza fine, chiuso il 18/01/2027 alle 23:45.
const IMMESSO = '2026-12-31T23:30:00.000Z';
const luogo = { provincia: 'SR', comune: 'SIRACUSA', id_pdr: 4242, punto_di_raccolta: 'GOMMISTA DI PROVA', ragione_sociale: 'GOMMISTA DI PROVA SRL', trasportatore: 'EMMESSE SRLS', classe: 'P', partner_operativo: 'SMOCO SRL' };
const ARCHIVI = {
  Assegnato: [{ id: 'a1', id_ordine: 'ET26999901', stato: 'assegnato', ordine_immesso_il: IMMESSO, peso_stimato: 1200, ...luogo }],
  AssegnatoAci: [{ id: 'a2', id_ordine: 'ET26999902', stato: 'assegnato', ordine_immesso_il: IMMESSO, peso_stimato: 2000, ...luogo, classe: 'PFU Autodemolizione' }],
  PrimariaRete: [
    { id: 'e1', id_ordine: 'ET26020377', numero_fir: 'RTXZV000988JZ', stato: 'terminato', provincia: 'CE', peso_effettivo: 3700,
      trasportatore: 'LOGISTICA & PNEUMATICI SRL', destinazione: 'T-CYCLE INDUSTRIES SRL',
      ordine_immesso_il: '2026-01-31T23:55:47.000Z', trasporto_iniziato_il: '2026-02-06T00:00:00.000Z',
      trasporto_finito_il: '2026-02-06T00:00:00.000Z', ordine_chiuso_il: '2026-02-09T10:45:14.000Z' },
    { id: 'e2', id_ordine: 'ET26999903', numero_fir: 'FIRSENZAFINE01', stato: 'terminato', peso_effettivo: 1000, destinazione: 'IRIGOM SRL',
      ordine_immesso_il: IMMESSO, trasporto_iniziato_il: '2027-01-15T00:00:00.000Z', ordine_chiuso_il: '2027-01-18T23:45:00.000Z', ...luogo },
  ],
  PrimariaAci: [],
  Secondaria: [
    { id: 's1', id_ordine: 'ET26999904', stato: 'assegnato', ordine_immesso_il: IMMESSO, stoccaggio: 'NAPPI SUD SRL', destinazione: 'IRIGOM SRL', trasportatore: 'SMOCO S.R.L.', classe: 'P', peso_stimato: 25000 },
    { id: 's2', id_ordine: 'ET26999906', numero_fir: 'FIRSEC0002', stato: 'terminato', ordine_immesso_il: IMMESSO, trasporto_iniziato_il: '2027-01-02T00:00:00.000Z',
      stoccaggio: 'NAPPI SUD SRL', destinazione: 'IRIGOM SRL', trasportatore: 'SMOCO S.R.L.', classe: 'P', peso_effettivo: 24000 },
  ],
  Terziaria: [{ id: 't1', id_ordine: 'ET26999905', stato: 'assegnato', ordine_immesso_il: IMMESSO, unita_locale_origine: 'IRIGOM SRL', destinazione: 'ACCIAIERIA DI PROVA SPA', trasportatore: 'SMOCO S.R.L.' }],
  ExtraRaccolta: [],
};
const uguale = (r, f) => Object.entries(f || {}).every(([k, v]) => (v === null ? (r[k] == null || r[k] === '') : r[k] === v));
const b44 = { asServiceRole: { entities: new Proxy({}, { get: (_t, n) => ({
  filter: async (f, _o, lim = 5000, skip = 0) => (ARCHIVI[n] || []).filter(r => uguale(r, f)).slice(skip, skip + lim).map(r => ({ ...r })),
  list: async (_o, lim = 5000, skip = 0) => (ARCHIVI[n] || []).slice(skip, skip + lim).map(r => ({ ...r })),
}) }) } };
const strumento = (nome) => S.STRUMENTI.find(s => s.nome === nome);
const esegui = async (nome, p) => { const s = strumento(nome); return s ? s.esegui(b44, p, null) : null; };
const prima = (x) => (x && x.righe && x.righe[0]) || null;

console.log(`1. LA CODA DEGLI ORDINI APERTI (TZ=${FUSO})`);
await conOggi('2026-12-31', async () => {
  for (const canale of ['RETE', 'ACI']) {
    const r = await esegui('ordini_aperti', { canale });
    const riga = r && prima(r.dati.ordini_elenco);
    annota(`ordini_aperti ${canale}: riga`, riga && { immesso_il: riga.immesso_il, giorni: riga.giorni_di_attesa });
    verifica(`${canale}: un ordine aperto`, !!r && r.dati.ordini === 1, J(r && r.dati.ordini));
    verifica(`${canale}: immesso il 31/12/2026 (prima: 01/01/2027)`, !!riga && riga.immesso_il === '2026-12-31', J(riga));
    verifica(`${canale}: 0 giorni di attesa al 31/12/2026 (prima: -1)`, !!riga && riga.giorni_di_attesa === 0, J(riga));
    // L'eta' dell'arretrato e' quella del cruscotto (etaArretrato), la stessa della pagina.
    const eta = r && r.dati.da_quanto_aspettano;
    const vecchio = eta && eta.il_piu_vecchio;
    annota(`ordini_aperti ${canale}: eta'`, eta);
    verifica(`${canale}: l'eta' dell'arretrato dice immesso il 31/12/2026, 0 giorni, entro 30`, !!vecchio && vecchio.immesso_il === '2026-12-31' && vecchio.giorni === 0 && eta.entro_30_giorni === 1, J(eta));
  }
});
await conOggi('2027-01-31', async () => {
  // Al 31/01/2027 l'ordine del 31/12 aspetta da 31 giorni: col giorno sbagliato 30.
  const r = await esegui('ordini_aperti', { canale: 'RETE', da_almeno_giorni: 31 });
  annota('ordini_aperti da almeno 31 giorni al 31/01/2027', r && { ordini: r.dati.ordini, riga: prima(r.dati.ordini_elenco) && prima(r.dati.ordini_elenco).giorni_di_attesa });
  verifica('da almeno 31 giorni, al 31/01/2027: l\'ordine c\'e\', con 31 giorni (prima: fuori, 30)', !!r && r.dati.ordini === 1 && prima(r.dati.ordini_elenco) && prima(r.dati.ordini_elenco).giorni_di_attesa === 31, J(r && [r.dati.ordini, r.dati.filtro_attesa]));
  const eta = r && r.dati.da_quanto_aspettano;
  verifica('...e nell\'eta\' dell\'arretrato e\' fra 31 e 60 giorni (prima: entro 30)', !!eta && eta.da_31_a_60_giorni === 1 && eta.entro_30_giorni === 0, J(eta));
});

console.log('2. LE SECONDARIE E LE TERZIARIE APERTE');
await conOggi('2026-12-31', async () => {
  const sec = await esegui('secondarie', { stato: 'aperte', anno: 2026 });
  const rete = sec && (sec.dati.canali || []).find(c => c.canale === 'RETE');
  const riga = rete && rete.aperte && prima(rete.aperte.elenco);
  annota('secondarie aperte', riga && { immesso_il: riga.immesso_il, giorni: riga.giorni_di_attesa });
  verifica('secondarie: immessa il 31/12/2026, 0 giorni di attesa (prima: 01/01/2027, -1)', !!riga && riga.immesso_il === '2026-12-31' && riga.giorni_di_attesa === 0, J(rete));
  const ter = await esegui('terziarie', { stato: 'aperte', anno: 2026 });
  const rigaT = ter && ter.dati.aperte && prima(ter.dati.aperte.elenco);
  annota('terziarie aperte', rigaT && { immesso_il: rigaT.immesso_il, giorni: rigaT.giorni_di_attesa });
  verifica('terziarie: immessa il 31/12/2026, 0 giorni di attesa (prima: 01/01/2027, -1)', !!rigaT && rigaT.immesso_il === '2026-12-31' && rigaT.giorni_di_attesa === 0, J(ter && ter.dati));
});

console.log('3. IL DETTAGLIO DI UN ORDINE (cerca_movimento)');
{
  const date = (x) => x && { immesso: x.ordine_immesso_il, iniziato: x.trasporto_iniziato_il, finito: x.trasporto_finito_il, chiuso: x.ordine_chiuso_il };
  const et = await esegui('cerca_movimento', { testo: 'ET26020377' });
  const e1 = et && prima(et.dati.trovati);
  annota('cerca_movimento ET26020377', date(e1));
  verifica('ET26020377: immesso il 31/01/2026 (prima: 01/02/2026)', !!e1 && e1.ordine_immesso_il === '2026-01-31', J(e1));
  verifica('ET26020377: inizio e fine trasporto il 06/02/2026, chiuso il 09/02/2026', !!e1 && e1.trasporto_iniziato_il === '2026-02-06' && e1.trasporto_finito_il === '2026-02-06' && e1.ordine_chiuso_il === '2026-02-09', J(date(e1)));
  const sf = await esegui('cerca_movimento', { testo: 'ET26999903' });
  const e2 = sf && prima(sf.dati.trovati);
  annota('cerca_movimento ET26999903', date(e2));
  verifica('un terminato immesso il 31/12/2026 alle 23:30 e chiuso il 18/01/2027 alle 23:45: 31/12/2026 e 18/01/2027 (prima: 01/01 e 19/01/2027)',
    !!e2 && e2.ordine_immesso_il === '2026-12-31' && e2.ordine_chiuso_il === '2027-01-18' && e2.trasporto_finito_il === '', J(date(e2)));
  const ap = await esegui('cerca_movimento', { testo: 'ET26999901' });
  const a1 = ap && prima(ap.dati.trovati);
  annota('cerca_movimento ET26999901', a1 && { archivio: a1.archivio, ...date(a1) });
  verifica('un assegnato immesso il 31/12/2026 alle 23:30: 31/12/2026 (prima: 01/01/2027)', !!a1 && a1.archivio === 'Assegnato' && a1.ordine_immesso_il === '2026-12-31', J(a1));
}

console.log('4. I TERMINATI SENZA FINE TRASPORTO, PER ANNO DI IMMISSIONE');
{
  const t = terminatiSenzaFine(ARCHIVI.PrimariaRete);
  const anni = t.per_anno.map(g => ({ anno: g.anno, ordini: g.righe.map(r => r.id_ordine) }));
  annota('terminatiSenzaFine', anni);
  verifica('il terminato senza fine immesso il 31/12/2026 alle 23:30 e\' fra gli immessi nel 2026 (prima: 2027)', t.esclusi.length === 1 && anni.length === 1 && anni[0].anno === 2026, J(anni));
  // Lo stesso conto arriva a EcoTyna con le date obbligatorie degli strumenti.
  await conOggi('2026-12-31', async () => {
    const sec = await esegui('secondarie', { anno: 2026 });
    const rete = sec && (sec.dati.canali || []).find(c => c.canale === 'RETE');
    const sf = rete && rete.date_obbligatorie_da_sistemare && rete.date_obbligatorie_da_sistemare.senza_fine_trasporto;
    annota('secondarie: senza fine per anno di immissione', sf && sf.per_anno_immissione);
    verifica('secondarie: la senza fine trasporto e\' fra le immesse nel 2026 (prima: 2027)', !!sf && sf.per_anno_immissione.length === 1 && sf.per_anno_immissione[0].anno_immissione === 2026, J(rete && rete.date_obbligatorie_da_sistemare));
  });
}

console.log('5. ECOTYNA INTERA: «QUANDO E\' STATO IMMESSO ET26020377?»');
{
  const PIANO = { strumenti: [{ nome: 'cerca_movimento', parametri: { testo: 'ET26020377' } }] };
  const e = await chiedi(EcoTyna, {
    domanda: 'Quando e\' stato immesso ET26020377?', piano: PIANO, db: { PrimariaRete: ARCHIVI.PrimariaRete },
    risposta: { risposta: 'L\'ordine ET26020377 e\' stato immesso il 31/01/2026.', certezza: 'alta', fonti: [] },
  });
  const usati = JSON.parse((e.salvata && e.salvata.strumenti_json) || '{}').strumenti || [];
  verifica('la domanda risponde e usa cerca_movimento', e.stato === 200 && usati.some(s => s.strumento === 'cerca_movimento' && !s.errore), J(usati));
  // Il blocco dei dati che arriva al modello: l'ordine col suo giorno di immissione.
  const blocco = e.prompt.slice(e.prompt.indexOf('--- strumento: cerca_movimento'));
  const immesso = (blocco.match(/"id_ordine":"ET26020377"[^}]*?"ordine_immesso_il":"([^"]*)"/) || [])[1] || null;
  annota('EcoTyna: immissione di ET26020377 nei dati', immesso);
  verifica('al modello arriva immesso il 2026-01-31 (prima: 2026-02-01)', immesso === '2026-01-31', blocco.slice(0, 600));
  verifica('...e nessun 2026-02-01 fra i dati dell\'ordine', !/2026-02-01/.test(blocco), blocco.slice(0, 600));
  // Il modello scrive le date all'italiana (regola 3-terdecies): il giorno che
  // dira' e' quello dei dati, convertito.
  verifica('la regola delle date all\'italiana e\' nel prompt', /Le date si scrivono all'italiana, giorno\/mese\/anno/.test(e.prompt));
  const detto = immesso ? immesso.split('-').reverse().join('/') : '';
  annota('EcoTyna: giorno detto', detto);
  verifica('...quindi EcoTyna dice 31/01/2026', detto === '31/01/2026', detto);
}

console.log(`\n${ok} verifiche superate, ${ko} fallite (TZ=${FUSO})`);
console.log('RISPOSTE ' + JSON.stringify(RISPOSTE));
process.exit(ko ? 1 : 0);
