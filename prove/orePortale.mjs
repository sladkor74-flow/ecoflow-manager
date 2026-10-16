// LE ORE DEI FILE DEL PORTALE: LA REGOLA E CHI LE SCRIVE (difetto 9, 16/10/2026).
//
// Il portale scrive l'ora ITALIANA. Il gestionale la salva com'e' scritta, con
// la Z per convenzione: «31/12/2026 23:30» diventa '2026-12-31T23:30:00.000Z',
// che sono le 23:30 italiane e non le 23:30 UTC. Le pagine la leggevano con
// giornoRoma, che le aggiungeva di nuovo l'ora italiana: un ordine immesso dopo
// le 22 d'estate o dopo le 23 d'inverno finiva al giorno dopo, e ET26020377,
// immesso il 31/01/2026 alle 23:55, finiva a febbraio.
//
// Qui si prova la meta' che sta sotto a tutto il resto:
//   - le funzioni che leggono un'ora del portale (giornoPortale, annoPortale,
//     mesePortale, oraPortale, dataPortaleIt, in giornoItaliano e nel suo
//     specchio per il browser), su ogni forma che puo' arrivare: la Z, +00:00,
//     nessun fuso, i decimali di qualunque lunghezza, un altro fuso, i .999;
//   - lo scrittore unico (dataDelPortale in primarie.ts): seriale, Date della
//     libreria dei fogli, testo italiano, testo ISO, e i giorni di inizio e fine
//     trasporto sempre a mezzanotte Z;
//   - le due strade di caricamento, sul banco con le funzioni vere: a blocchi
//     (importaBlocco: primarie, assegnati e report delle dichiarazioni) e lato
//     server (importEcotyreFile, con un SECONDARIE finto e le celle formattate
//     come date).
//
// LA PROVA GIRA DUE VOLTE, con TZ=UTC (il server) e con TZ=Europe/Rome (il
// browser): si rilancia da sola e pretende in tutti e due i fusi lo stesso esito
// e le stesse stringhe scritte, carattere per carattere. Una stringa diversa fra
// i due fusi e' esattamente il difetto: la stessa cella salvata in due modi.
//
// npm run prove
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const FUSI = ['UTC', 'Europe/Rome'];

if (!process.env.ORE_PORTALE_FUSO) {
  let fallite = 0;
  const scritte = {};
  for (const fuso of FUSI) {
    const r = spawnSync(process.execPath, ['--no-warnings', fileURLToPath(import.meta.url)], {
      env: { ...process.env, TZ: fuso, ORE_PORTALE_FUSO: fuso }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    });
    const righe = (r.stdout || '').split(/\r?\n/);
    const riga = righe.find(l => l.startsWith('SCRITTE '));
    scritte[fuso] = riga ? riga.slice('SCRITTE '.length) : null;
    console.log(`\n===== con TZ=${fuso} =====`);
    console.log(righe.filter(l => !l.startsWith('SCRITTE ')).join('\n').trim());
    if ((r.stderr || '').trim()) console.log(r.stderr.trim());
    if (r.status !== 0) fallite++;
  }
  console.log('\nLE STESSE STRINGHE IN TUTTI E DUE I FUSI');
  const a = scritte.UTC, b = scritte['Europe/Rome'];
  if (a === null || b === null) {
    fallite++;
    console.log('  FALLITA: un fuso non ha restituito le stringhe scritte');
  } else if (a !== b) {
    fallite++;
    const ja = JSON.parse(a), jb = JSON.parse(b);
    const diverse = Object.keys({ ...ja, ...jb }).filter(k => JSON.stringify(ja[k]) !== JSON.stringify(jb[k]));
    console.log(`  FALLITA: ${diverse.length} valori diversi fra UTC e Roma`);
    for (const k of diverse.slice(0, 15)) console.log(`    ${k}: UTC ${JSON.stringify(ja[k])} / Roma ${JSON.stringify(jb[k])}`);
  } else console.log(`  ${Object.keys(JSON.parse(a)).length} valori, identici`);
  console.log(fallite ? `\nFALLITA in ${fallite} punti` : '\ntutto superato, in UTC e in Roma');
  process.exit(fallite ? 1 : 0);
}

// ===========================================================================
// Da qui in giu' gira una volta per fuso.
// ===========================================================================
const FUSO = process.env.ORE_PORTALE_FUSO;
const { build } = await import('esbuild');
const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
// xlsx fissa il suo riferimento delle date quando viene caricato: il fuso e' gia'
// quello del processo, perche' arriva dall'ambiente.
const XLSX = await import('xlsx');

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
// Le stringhe da confrontare fra i due fusi.
const SCRITTE = {};
const annota = (chiave, valore) => { SCRITTE[chiave] = valore === undefined ? null : valore; return valore; };

const scarto = new Date(2026, 0, 15).getTimezoneOffset();
verifica(`il processo gira davvero in ${FUSO}`, FUSO === 'UTC' ? scarto === 0 : scarto === -60, String(scarto));

// Sul codice di prima (la controprova) le funzioni nuove non c'erano: si prende
// quello che il codice di prima usava al loro posto, cosi' la prova cade sulle
// verifiche e non sull'import.
const gi = await import('../base44/shared/giornoItaliano.ts');
const giBrowser = await import('../src/lib/giornoItaliano.js');
const pr = await import('../base44/shared/primarie.ts');
const ORA_ROMA = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const lettori = (m) => ({
  giornoPortale: m.giornoPortale || m.giornoRoma,
  annoPortale: m.annoPortale || m.annoRoma,
  mesePortale: m.mesePortale || m.meseRoma,
  oraPortale: m.oraPortale || ((v) => { const d = new Date(v); return v && !isNaN(d.getTime()) ? ORA_ROMA.format(d) : ''; }),
  dataPortaleIt: m.dataPortaleIt || ((v) => { const g = m.giornoRoma(v); return g ? `${g.slice(8, 10)}/${g.slice(5, 7)}/${g.slice(0, 4)}` : ''; }),
});
const L = lettori(gi);
const ORE_PORTALE = pr.ORE_PORTALE || new Set(['ordine_immesso_il', 'ordine_chiuso_il']);
const GIORNI_PORTALE = pr.GIORNI_PORTALE || new Set(['trasporto_iniziato_il', 'trasporto_finito_il']);
const dataPrimaria = pr.dataPrimaria;
const giornoPrimaria = pr.giornoPrimaria || ((v) => pr.dataPrimaria(v));
const dataDelPortale = pr.dataDelPortale || ((v) => pr.dataPrimaria(v));

// Il seriale di Excel di un'ora scritta, senza fuso.
const seriale = (g, m, a, h = 0, mi = 0, s = 0) => (Date.UTC(a, m - 1, g, h, mi, s) - Date.UTC(1899, 11, 30)) / 86400000;

// ---------------------------------------------------------------------------
console.log('LE FUNZIONI CHE LEGGONO UN\'ORA DEL PORTALE');
// [valore, giorno, ora, gg/mm/aaaa]
const CASI = [
  ['2026-12-31T23:30:00.000Z', '2026-12-31', '23:30', '31/12/2026', "l'ultima sera dell'anno resta nell'anno"],
  ['2026-10-14T00:00:00.000Z', '2026-10-14', '', '14/10/2026', 'mezzanotte esatta: il giorno, senza ora'],
  ['2024-11-22T16:59:59.999Z', '2024-11-22', '17:00', '22/11/2024', 'un .999 rimasto in archivio si arrotonda al secondo'],
  ['2026-12-31T23:59:59.999Z', '2027-01-01', '', '01/01/2027', 'un .999 alle 23:59:59 e\' la mezzanotte del giorno dopo, come nel file'],
  ['2026-12-31T23:30:00+01:00', '2026-12-31', '23:30', '31/12/2026', 'un istante vero col fuso italiano d\'inverno'],
  ['2026-07-01T00:30:00+05:00', '2026-06-30', '21:30', '30/06/2026', 'un istante vero con un altro fuso si porta all\'ora italiana'],
  ['2026-01-31T23:55:47+00:00', '2026-01-31', '23:55', '31/01/2026', '+00:00 vale come la Z'],
  ['2026-12-31T22:30:00.000-00:00', '2026-12-31', '22:30', '31/12/2026', '-00:00 vale come la Z'],
  ['2026-09-25T21:14:15.473000', '2026-09-25', '21:14', '25/09/2026', 'sei cifre di decimali e nessun fuso: le cifre scritte'],
  ['2026-03-29T02:30:00.000Z', '2026-03-29', '02:30', '29/03/2026', "l'ora che in Italia non esiste resta com'e' scritta"],
  ['2026-12-31', '2026-12-31', '', '31/12/2026', 'un giorno senza ora'],
  ['2026-02-30T10:00:00.000Z', '', '', '', 'una data impossibile non e\' un giorno'],
  ['', '', '', '', 'vuoto'],
  [null, '', '', '', 'null'],
  ['x', '', '', '', 'testo che non e\' una data'],
];
for (const [modulo, nome] of [[gi, 'giornoItaliano.ts'], [giBrowser, 'lo specchio del browser']]) {
  const f = lettori(modulo);
  for (const [v, giorno, ora, it, perche] of CASI) {
    const visto = [f.giornoPortale(v), f.oraPortale(v), f.dataPortaleIt(v)];
    verifica(`${nome}: ${JSON.stringify(v)}, ${perche}`, JSON.stringify(visto) === JSON.stringify([giorno, ora, it]), `${JSON.stringify(visto)} invece di ${JSON.stringify([giorno, ora, it])}`);
  }
}
verifica('anno e mese dell\'ultima sera dell\'anno: 2026, dicembre', L.annoPortale('2026-12-31T23:30:00.000Z') === 2026 && L.mesePortale('2026-12-31T23:30:00.000Z') === 11,
  `${L.annoPortale('2026-12-31T23:30:00.000Z')} ${L.mesePortale('2026-12-31T23:30:00.000Z')}`);
verifica('ET26020377, immesso il 31/01/2026 alle 23:55: gennaio', L.mesePortale('2026-01-31T23:55:47.000Z') === 0 && L.giornoPortale('2026-01-31T23:55:47.000Z') === '2026-01-31');
verifica('un valore mancante: anno null e mese -1, non zero', L.annoPortale('') === null && L.annoPortale(null) === null && L.mesePortale(undefined) === -1);
verifica('un Date: le sue cifre UTC', L.giornoPortale(new Date(Date.UTC(2026, 11, 31, 23, 30))) === '2026-12-31' && L.oraPortale(new Date(Date.UTC(2026, 11, 31, 23, 30))) === '23:30');
verifica('un seriale non e\' una data salvata', L.giornoPortale(46387.979166667) === '' && L.annoPortale(46387.979166667) === null);
for (const [v] of CASI) annota('lettura ' + JSON.stringify(v), [L.giornoPortale(v), L.oraPortale(v), L.dataPortaleIt(v), L.annoPortale(v), L.mesePortale(v)]);

// ---------------------------------------------------------------------------
console.log('\nLO SCRITTORE UNICO');
verifica('i sei campi con l\'ora', JSON.stringify([...ORE_PORTALE]) === JSON.stringify(['ordine_immesso_il', 'ordine_chiuso_il', 'data_immissione', 'data_chiusura', 'data_dichiarazione', 'data_esecuzione']), JSON.stringify([...ORE_PORTALE]));
verifica('i quattro campi di solo giorno', JSON.stringify([...GIORNI_PORTALE]) === JSON.stringify(['trasporto_iniziato_il', 'trasporto_finito_il', 'inizio_trasporto', 'fine_trasporto']), JSON.stringify([...GIORNI_PORTALE]));

const CAPODANNO = 46387.979166667; // 31/12/2026 23:30
verifica('il seriale delle 23:30 del 31/12', annota('seriale capodanno', dataPrimaria(CAPODANNO)) === '2026-12-31T23:30:00.000Z', dataPrimaria(CAPODANNO));
// Lo stesso valore come Date costruito dalla libreria dei fogli, in questo fuso.
const dateDaFoglio = (valori) => {
  const ws = XLSX.utils.aoa_to_sheet([valori.map((_, i) => 'c' + i), valori]);
  for (const k of Object.keys(ws)) if (k[0] !== '!' && typeof ws[k].v === 'number') ws[k].z = 'dd/mm/yyyy hh:mm:ss';
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'S');
  const letto = XLSX.read(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), { type: 'array', cellDates: true });
  const riga = XLSX.utils.sheet_to_json(letto.Sheets.S, { raw: true })[0];
  return valori.map((_, i) => riga['c' + i]);
};
const [dCapodanno, dOttobre, dMarzo, d999] = dateDaFoglio([CAPODANNO, seriale(25, 10, 2026, 2, 30), seriale(29, 3, 2026, 2, 30), 45001.85]);
verifica('lo stesso valore come Date della libreria dei fogli: identico', dCapodanno instanceof Date && annota('Date capodanno', dataPrimaria(dCapodanno)) === '2026-12-31T23:30:00.000Z', `${dCapodanno && dCapodanno.toISOString()} -> ${dataPrimaria(dCapodanno)}`);
verifica('un Date che ha perso un millesimo torna al secondo: nessun .999', d999 instanceof Date && annota('Date 999', dataPrimaria(d999)) === '2023-03-16T20:24:00.000Z', `${d999 && d999.toISOString()} -> ${dataPrimaria(d999)}`);
verifica('il giorno del seriale delle 23:30: mezzanotte Z dello stesso giorno', annota('giorno capodanno', giornoPrimaria(CAPODANNO)) === '2026-12-31T00:00:00.000Z', giornoPrimaria(CAPODANNO));
verifica('«01/04/2026» e\' il 1 aprile', annota('testo 01/04', dataDelPortale('01/04/2026', 'data_chiusura')) === '2026-04-01T00:00:00.000Z', dataDelPortale('01/04/2026', 'data_chiusura'));
verifica('un testo senza fuso tiene le sue cifre: le 10:23', annota('testo senza fuso', dataDelPortale('2026-09-08 10:23', 'data_immissione')) === '2026-09-08T10:23:00.000Z', dataDelPortale('2026-09-08 10:23', 'data_immissione'));
verifica('+00:00 vale come la Z', annota('testo +00:00', dataPrimaria('2026-01-31T23:55:47+00:00')) === '2026-01-31T23:55:47.000Z', dataPrimaria('2026-01-31T23:55:47+00:00'));
verifica('sei cifre di decimali: al secondo', annota('testo 6 cifre', dataPrimaria('2026-09-25T21:14:15.473000')) === '2026-09-25T21:14:15.000Z', dataPrimaria('2026-09-25T21:14:15.473000'));
verifica('un istante vero si porta all\'ora italiana', annota('testo +05:00', dataPrimaria('2026-07-01T00:30:00+05:00')) === '2026-06-30T21:30:00.000Z', dataPrimaria('2026-07-01T00:30:00+05:00'));
verifica('un testo che non e\' una data: nessuna data', dataPrimaria('Sep 13 2026') === null && dataPrimaria('non una data') === null, String(dataPrimaria('Sep 13 2026')));
// Le due ore del cambio d'ora, come seriale: com'erano scritte.
verifica('29/03/2026 02:30 come seriale resta le 02:30', annota('seriale marzo', dataPrimaria(seriale(29, 3, 2026, 2, 30))) === '2026-03-29T02:30:00.000Z', dataPrimaria(seriale(29, 3, 2026, 2, 30)));
verifica('25/10/2026 02:30 come seriale resta le 02:30', annota('seriale ottobre', dataPrimaria(seriale(25, 10, 2026, 2, 30))) === '2026-10-25T02:30:00.000Z', dataPrimaria(seriale(25, 10, 2026, 2, 30)));
verifica('25/10/2026 02:30 come Date della libreria: le 02:30', annota('Date ottobre', dataPrimaria(dOttobre)) === '2026-10-25T02:30:00.000Z', dataPrimaria(dOttobre));
// Il limite scritto nello scrittore: in un processo in Italia un Date delle
// 02:30 del 29/03 e' gia' diventato le 03:30 quando la libreria lo costruisce.
// Si prova solo in UTC; in Italia lo si stampa e basta.
if (FUSO === 'UTC') verifica('29/03/2026 02:30 come Date della libreria, in UTC: le 02:30', dataPrimaria(dMarzo) === '2026-03-29T02:30:00.000Z', dataPrimaria(dMarzo));
else console.log(`  (il limite noto: in Italia il Date delle 02:30 del 29/03 arriva come ${dataPrimaria(dMarzo)})`);
// I giorni di inizio e fine trasporto, e chi conta quelli con l'ora.
const conta = { giorni_con_ora: 0 };
const fineConOra = dataDelPortale(CAPODANNO, 'trasporto_finito_il', conta);
const fineSenzaOra = dataDelPortale(seriale(15, 1, 2027), 'fine_trasporto', conta);
verifica('una fine con l\'ora si salva col solo giorno', annota('fine con ora', fineConOra) === '2026-12-31T00:00:00.000Z', fineConOra);
verifica('una fine senza ora resta a mezzanotte', annota('fine senza ora', fineSenzaOra) === '2027-01-15T00:00:00.000Z', fineSenzaOra);
verifica('e si conta solo quella con l\'ora', conta.giorni_con_ora === 1, String(conta.giorni_con_ora));
verifica('l\'immissione tiene la sua ora', annota('immissione', dataDelPortale(CAPODANNO, 'ordine_immesso_il')) === '2026-12-31T23:30:00.000Z');

// ---------------------------------------------------------------------------
// Il banco: le funzioni vere impacchettate con un archivio finto in memoria.
// ---------------------------------------------------------------------------
const SDK_FINTO = `
const filtra = (righe, f) => righe.filter(r => Object.entries(f || {}).every(([k, v]) => r[k] === v));
let progressivo = 0;
function entita(nome) {
  const righe = () => (globalThis.__ARCHIVI[nome] ||= []);
  return {
    filter: async (f, _o, lim = 1e9, skip = 0) => filtra(righe(), f).slice(skip, skip + lim),
    list: async (_o, lim = 1e9, skip = 0) => righe().slice(skip, skip + lim),
    create: async (d) => { const r = { id: nome + '-' + (++progressivo), ...d }; righe().push(r); return r; },
    update: async (id, d) => { const t = righe(); const i = t.findIndex(x => x.id === id); if (i >= 0) t[i] = { ...t[i], ...d }; return { id, ...d }; },
    delete: async () => ({}),
    deleteMany: async () => { globalThis.__ARCHIVI[nome] = []; },
    bulkCreate: async (a) => { righe().push(...a.map(r => ({ id: nome + '-' + (++progressivo), ...r }))); return a; },
  };
}
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
const Core = { CreateFileSignedUrl: async ({ file_uri }) => ({ signed_url: 'prova://' + file_uri }) };
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: 'admin', email: 'prova', full_name: 'Prova' }) }, asServiceRole: { entities, integrations: { Core } }, entities, integrations: { Core } };
}`;
const finti = {
  name: 'moduli-finti',
  setup(b) {
    b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'finto' }));
    b.onLoad({ filter: /.*/, namespace: 'finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
    b.onResolve({ filter: /^npm:xlsx/ }, () => ({ path: qui('../node_modules/xlsx/xlsx.mjs') }));
  },
};
async function funzione(nome) {
  const r = await build({
    entryPoints: [qui(`../base44/functions/${nome}/entry.ts`)],
    bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent', plugins: [finti],
  });
  const m = await import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
  return async (body = {}) => { const res = await m.default({ json: async () => body }); return { status: res.status, body: await res.json() }; };
}
const archivio = (nome) => globalThis.__ARCHIVI[nome] || [];
const perId = (nome, id, campo = 'id_ordine') => archivio(nome).find(r => r[campo] === id);

// ---------------------------------------------------------------------------
console.log('\nIL CARICAMENTO A BLOCCHI (importaBlocco)');
const importaBlocco = await funzione('importaBlocco');
globalThis.__ARCHIVI = {};
// Le righe come le legge il browser: il foglio senza cellDates, le date come seriali.
const base = { Prodotto: 'A - PFU', Classe: 'A', Provincia: 'NA', Trasportatore: 'Raccoglitore Uno', Partner_Operativo: 'SMOCO Srl' };
const ass = await importaBlocco({
  azione: 'scrivi', tipo_file: 'primarie', entita: 'Assegnato', blocco: 0,
  righe: [{ ...base, ID: 'ET26999001', Stato: 'assegnato', Peso_stimato: 9000, Ordine_immesso_il: CAPODANNO }],
});
verifica('il blocco degli assegnati entra', ass.status === 200 && ass.body.scritte === 1, JSON.stringify(ass.body).slice(0, 300));
const a1 = perId('Assegnato', 'ET26999001');
verifica('l\'assegnato immesso il 31/12/2026 alle 23:30 si salva com\'e\' scritto', !!a1 && annota('blocco assegnato immesso', a1.ordine_immesso_il) === '2026-12-31T23:30:00.000Z', a1 && a1.ordine_immesso_il);
verifica('e si legge il 31/12, a dicembre del 2026', !!a1 && L.giornoPortale(a1.ordine_immesso_il) === '2026-12-31' && L.mesePortale(a1.ordine_immesso_il) === 11 && L.annoPortale(a1.ordine_immesso_il) === 2026, a1 && L.giornoPortale(a1.ordine_immesso_il));

const ter = await importaBlocco({
  azione: 'scrivi', tipo_file: 'primarie', entita: 'PrimariaRete', blocco: 1,
  righe: [
    // la fine trasporto con l'ora: si tiene il giorno, e si conta
    { ...base, ID: 'ET26999002', Stato: 'terminato', Peso_effettivo: 8000, Destinazione: 'Irigom Srl',
      Ordine_immesso_il: seriale(20, 12, 2026, 9, 15), Trasporto_iniziato_il: seriale(31, 12, 2026), Trasporto_finito_il: CAPODANNO, Ordine_chiuso_il: seriale(2, 1, 2027, 9, 15) },
    // la replica di ET26020377: immesso il 31/01/2026 alle 23:55:47, finito il 06/02/2026
    { ...base, ID: 'ET26020377', Stato: 'terminato', Peso_effettivo: 4000, Destinazione: 'Irigom Srl',
      Ordine_immesso_il: seriale(31, 1, 2026, 23, 55, 47), Trasporto_iniziato_il: seriale(6, 2, 2026), Trasporto_finito_il: seriale(6, 2, 2026), Ordine_chiuso_il: seriale(9, 2, 2026, 18, 44, 46) },
  ],
});
verifica('il blocco dei terminati entra', ter.status === 200 && ter.body.scritte === 2, JSON.stringify(ter.body).slice(0, 300));
const t1 = perId('PrimariaRete', 'ET26999002');
verifica('la fine «31/12/2026 23:30» si salva come giorno: 2026-12-31T00:00:00.000Z', !!t1 && annota('blocco fine con ora', t1.trasporto_finito_il) === '2026-12-31T00:00:00.000Z', t1 && t1.trasporto_finito_il);
verifica('la risposta del blocco conta quella fine: giorni_con_ora 1', ter.body.giorni_con_ora === 1, String(ter.body.giorni_con_ora));
verifica('la chiusura tiene la sua ora', !!t1 && annota('blocco chiusura', t1.ordine_chiuso_il) === '2027-01-02T09:15:00.000Z', t1 && t1.ordine_chiuso_il);
const et = perId('PrimariaRete', 'ET26020377');
verifica('ET26020377: l\'immissione delle 23:55:47 del 31/01 salvata com\'e\' scritta', !!et && annota('blocco ET26020377 immesso', et.ordine_immesso_il) === '2026-01-31T23:55:47.000Z', et && et.ordine_immesso_il);
verifica('e si legge a gennaio', !!et && L.mesePortale(et.ordine_immesso_il) === 0, et && String(L.mesePortale(et.ordine_immesso_il)));
annota('blocco ET26020377 fine', et && et.trasporto_finito_il);

// Il report delle dichiarazioni: le date con l'ora, un testo italiano e un testo con l'ora.
const dich = await importaBlocco({
  azione: 'scrivi', tipo_file: 'dichiarazioni_trattamento', blocco: 0,
  righe: [
    { Ordine_primaria: 'ET26999002', ID_Dichiarazione: 'D-1', Partner_Operativo: 'SMOCO Srl', Destinazione: 'Irigom Srl', Peso_effettivo_Kg: 8000,
      Data_immissione: seriale(31, 1, 2026, 23, 55, 47), Data_chiusura: '01/04/2026', Data_esecuzione: '15/01/2026 10:30',
      Inizio_trasporto: seriale(30, 12, 2026), Fine_trasporto: seriale(31, 12, 2026), Data_dichiarazione: seriale(31, 12, 2026, 23, 55) },
  ],
});
verifica('il blocco del report entra', dich.status === 200 && dich.body.scritte === 1, JSON.stringify(dich.body).slice(0, 300));
const d1 = archivio('DichiarazioneTrattamento')[0] || {};
verifica('la dichiarazione delle 23:55 del 31/12/2026 salvata com\'e\' scritta', annota('report data_dichiarazione', d1.data_dichiarazione) === '2026-12-31T23:55:00.000Z', d1.data_dichiarazione);
verifica('l\'immissione delle 23:55:47 anche', annota('report data_immissione', d1.data_immissione) === '2026-01-31T23:55:47.000Z', d1.data_immissione);
verifica('il testo «01/04/2026» e\' il 1 aprile, non il 4 gennaio', annota('report data_chiusura', d1.data_chiusura) === '2026-04-01T00:00:00.000Z', d1.data_chiusura);
verifica('un testo con l\'ora non si perde: 15/01/2026 10:30', annota('report data_esecuzione', d1.data_esecuzione) === '2026-01-15T10:30:00.000Z', String(d1.data_esecuzione));
verifica('inizio e fine a mezzanotte Z', annota('report fine', d1.fine_trasporto) === '2026-12-31T00:00:00.000Z' && annota('report inizio', d1.inizio_trasporto) === '2026-12-30T00:00:00.000Z', `${d1.inizio_trasporto} ${d1.fine_trasporto}`);

const allinea = await importaBlocco({ azione: 'allinea', tipo_file: 'dichiarazioni_trattamento' });
const anni = allinea.body && allinea.body.allineamento && allinea.body.allineamento.anni;
verifica('gli anni da allineare sono quelli scritti nel report: [2026]', allinea.status === 200 && JSON.stringify(anni) === '[2026]', JSON.stringify(allinea.body).slice(0, 300));
annota('allinea anni', anni);

// ---------------------------------------------------------------------------
console.log('\nIL CARICAMENTO LATO SERVER (importEcotyreFile), UN SECONDARIE FINTO');
const colonne = Object.keys((await import('../base44/shared/excelSchemas.ts')).SHEET_MAP.secondarie.columns);
const righeSec = [
  { ID: 'ET26999101', Stato: 'terminato', Stoccaggio: 'Nappi Sud', Prodotto: 'A - PFU', Provincia: 'NA', Peso_effettivo: 12000, Partner_Operativo: 'SMOCO Srl',
    Trasportatore: 'Raccoglitore Uno', Destinazione: 'Irigom Srl', Tipo_Destinazione: 'Impianto', Numero_FIR: 'FIR1',
    Ordine_immesso_il: CAPODANNO, Trasporto_iniziato_il: seriale(14, 1, 2027), Trasporto_finito_il: seriale(15, 1, 2027), Ordine_chiuso_il: seriale(18, 1, 2027, 23, 45) },
  // seriali che la libreria, con cellDates, trasforma in un Date che finisce per .999
  { ID: 'ET26999102', Stato: 'terminato', Stoccaggio: 'Nappi Sud', Prodotto: 'A - PFU', Provincia: 'NA', Peso_effettivo: 9000, Partner_Operativo: 'SMOCO Srl',
    Trasportatore: 'Raccoglitore Uno', Destinazione: 'Irigom Srl', Tipo_Destinazione: 'Impianto', Numero_FIR: 'FIR2',
    Ordine_immesso_il: 45001.85, Trasporto_iniziato_il: 45002, Trasporto_finito_il: 45002, Ordine_chiuso_il: 45002.59 },
];
const foglioSec = XLSX.utils.aoa_to_sheet([colonne, ...righeSec.map(r => colonne.map(c => (r[c] === undefined ? null : r[c])))]);
// Le celle delle date formattate come date: e' cosi' che arrivano dal portale.
for (const k of Object.keys(foglioSec)) {
  if (k[0] === '!') continue;
  const col = XLSX.utils.decode_cell(k).c;
  if (/_il$/.test(colonne[col]) && typeof foglioSec[k].v === 'number') foglioSec[k].z = 'dd/mm/yyyy hh:mm:ss';
}
const cartellaSec = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(cartellaSec, foglioSec, 'SECONDARIE');
const bufferSec = XLSX.write(cartellaSec, { type: 'array', bookType: 'xlsx' });
globalThis.fetch = async (url) => (String(url) === 'prova://uri-secondarie.xlsx'
  ? { ok: true, arrayBuffer: async () => bufferSec }
  : { ok: false, status: 404, statusText: 'non previsto' });
globalThis.__ARCHIVI = {};
const importaFile = await funzione('importEcotyreFile');
const sec = await importaFile({ file_uri: 'uri-secondarie.xlsx', tipo_file: 'secondarie', nome_file: 'SECONDARIE.xlsx' });
verifica('il file entra', sec.status === 200 && sec.body.righe_importate === 2, JSON.stringify(sec.body).slice(0, 400));
const s1 = perId('Secondaria', 'ET26999101') || {};
const s2 = perId('Secondaria', 'ET26999102') || {};
verifica('l\'immissione delle 23:30 del 31/12/2026, com\'e\' scritta (prima, in Italia, le 22:30Z)', annota('sec immesso', s1.ordine_immesso_il) === '2026-12-31T23:30:00.000Z', s1.ordine_immesso_il);
verifica('la chiusura delle 23:45 del 18/01/2027', annota('sec chiuso', s1.ordine_chiuso_il) === '2027-01-18T23:45:00.000Z', s1.ordine_chiuso_il);
verifica('la fine a mezzanotte Z del 15/01/2027', annota('sec fine', s1.trasporto_finito_il) === '2027-01-15T00:00:00.000Z', s1.trasporto_finito_il);
verifica('il seriale che dava .999 si salva al secondo', annota('sec immesso 2', s2.ordine_immesso_il) === '2023-03-16T20:24:00.000Z' && annota('sec chiuso 2', s2.ordine_chiuso_il) === '2023-03-17T14:09:36.000Z', `${s2.ordine_immesso_il} ${s2.ordine_chiuso_il}`);
const tutteLeDate = archivio('Secondaria').flatMap(r => [...ORE_PORTALE, ...GIORNI_PORTALE].map(c => r[c]).filter(Boolean));
verifica('nessun .999 fra le date scritte', tutteLeDate.length >= 8 && !tutteLeDate.some(v => /\.999Z$/.test(v)), JSON.stringify(tutteLeDate));
verifica('nessuna fine con l\'ora: giorni_con_ora 0 nella risposta', sec.body.giorni_con_ora === 0, String(sec.body.giorni_con_ora));
annota('sec giorni_con_ora', sec.body.giorni_con_ora);

console.log(`\n${ok} verifiche superate, ${ko} fallite (TZ=${FUSO})`);
console.log('SCRITTE ' + JSON.stringify(SCRITTE));
process.exit(ko ? 1 : 0);
