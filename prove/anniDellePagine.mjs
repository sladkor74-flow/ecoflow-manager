// Prova degli ANNI E DEL MESE DELLE PAGINE (verifica di chiusura dell'audit,
// 11/10/2026).
//
// Le pagine avevano l'anno scritto a mano: Dichiarazioni [2026, 2025] e aperta sul
// 2026, Giacenze sul 2026, la fatturazione aperta su «Luglio 2026», passiva,
// attiva, margine ed extra raccolta con [2024, 2025, 2026]. Dal 1° gennaio 2027 il
// 2027 non si sarebbe potuto scegliere. E Consuntivi, a gennaio, proponeva il
// dicembre dell'anno nuovo: un mese che deve ancora venire. Ora tutto parte dal
// giorno italiano (src/lib/periodoPagine.js), e la prova scorre il sorgente perche'
// un anno cablato non torni. Dalla prova del cambio d'anno (15/10/2026) gli anni
// si contano quando la pagina si disegna: cinque pagine vere e la scheda Zone dei
// raccoglitori, caricate il 31/12 e montate il 04/01 nella stessa scheda, offrono
// il 2027, e nessuna pagina li conta in una costante del modulo.
// npm run prove
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { anniDaScegliere, meseDiLavoro, annoDiOggi } from '../src/lib/periodoPagine.js';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const uguale = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('IL MESE SU CUI SI LAVORA');
verifica("l'11 ottobre e' settembre", uguale(meseDiLavoro('2026-10-11'), { anno: 2026, mese: 'Settembre' }), JSON.stringify(meseDiLavoro('2026-10-11')));
verifica("il 2 gennaio e' il dicembre dell'anno prima", uguale(meseDiLavoro('2027-01-02'), { anno: 2026, mese: 'Dicembre' }), JSON.stringify(meseDiLavoro('2027-01-02')));
verifica("il 1° marzo e' febbraio", uguale(meseDiLavoro('2027-03-01'), { anno: 2027, mese: 'Febbraio' }));
verifica("il 31 dicembre e' novembre", uguale(meseDiLavoro('2026-12-31'), { anno: 2026, mese: 'Novembre' }));

console.log('GLI ANNI DA SCEGLIERE');
verifica('oggi, dal 2024 al 2026', uguale(anniDaScegliere({ oggi: '2026-10-11' }), [2024, 2025, 2026]));
verifica('il 2 gennaio 2027 c\'e\' il 2027', uguale(anniDaScegliere({ oggi: '2027-01-02' }), [2024, 2025, 2026, 2027]));
verifica('le Giacenze arrivano all\'anno dopo', uguale(anniDaScegliere({ dopo: 1, oggi: '2027-01-02' }), [2024, 2025, 2026, 2027, 2028]));
verifica('le Dichiarazioni dal 2025, dal piu\' recente', uguale(anniDaScegliere({ dal: 2025, oggi: '2027-01-02' }).reverse(), [2027, 2026, 2025]));
verifica("l'anno di oggi, sul giorno italiano", annoDiOggi('2027-01-01') === 2027);

console.log("NESSUN ANNO CABLATO NELLE PAGINE");
{
  const radice = fileURLToPath(new URL('../src/', import.meta.url));
  const file = [];
  const scorri = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) scorri(p); else if (/\.(jsx|js)$/.test(n)) file.push(p); } };
  scorri(join(radice, 'pages')); scorri(join(radice, 'components'));
  const trappole = [
    [/useState\(\s*20\d\d\s*\)/, 'useState(anno scritto)'],
    [/\b(?:ANNI|anni)\s*=\s*\[\s*20\d\d\s*,/, 'elenco di anni scritto a mano'],
    [/\[\s*20\d\d\s*,\s*20\d\d\s*,\s*20\d\d[\s,\]]*\]\s*\.map/, 'elenco di anni scritto dentro la pagina'],
    [/useState\(\{\s*anno:\s*20\d\d/, 'periodo iniziale con l\'anno scritto'],
  ];
  const trovate = [];
  for (const p of file) {
    const righe = readFileSync(p, 'utf8').split(/\r?\n/);
    righe.forEach((r, i) => { if (/^\s*(\/\/|\*)/.test(r)) return; for (const [re, cosa] of trappole) if (re.test(r)) trovate.push(`${p.slice(radice.length)}:${i + 1} ${cosa}`); });
  }
  verifica('nessuna pagina con un anno scritto a mano', trovate.length === 0, '\n    ' + trovate.join('\n    '));
  const cons = readFileSync(join(radice, 'components/verifiche-fornitori/Consuntivi.jsx'), 'utf8');
  // Dall'11/10/2026 il mese puo' arrivare da un collegamento (src/lib/collegamenti.js):
  // senza, si parte sempre dall'ultimo mese finito.
  verifica('Consuntivi parte dal mese finito, non dal dicembre dell\'anno nuovo', /useState\(\(\) => \(periodoIniziale \|\| meseDiLavoro\(\)\)\.anno\)/.test(cons) && !/oggi\.getMonth\(\) === 0 \? 12/.test(cons));
  const fatt = readFileSync(join(radice, 'pages/Fatturazione.jsx'), 'utf8') + readFileSync(join(radice, 'components/fatturazione/FatturazioneAttiva.jsx'), 'utf8');
  verifica('la fatturazione si apre sull\'ultimo mese finito', /useState\(\(\) => periodoDelCollegamento\(arrivo, meseDiLavoro\(\)\)\)/.test(fatt) && /useState\(\(\) => periodoIniziale \|\| meseDiLavoro\(\)\)/.test(fatt));
}

// CON LA SCHEDA APERTA DAL 31/12, IL 04/01 LE PAGINE OFFRONO IL 2027 (prova del
// cambio d'anno, 15/10/2026, difetto 35). Le pagine si caricano alla prima
// visita (src/App.jsx) e restano in memoria finche' la scheda - o il gestionale
// installato come applicazione - non si ricarica: gli anni contati quando il
// modulo si carica (const ANNI fuori dal componente) restavano quelli del 31/12.
// Dichiarazioni Impianti si apriva sul 2027 offrendo [2026, 2025], e chi
// sceglieva il 2026 non tornava al 2027. Qui le cinque pagine vere, col banco
// delle pagine (prove/dati/paginaFinta.mjs): modulo caricato il 31/12/2026 alle
// 23:30 e montato il 04/01/2027 alle 09:00. I permessi si sostituiscono nella
// copia del sorgente, come in prove/extraRaccoltaSurplus.mjs; nella passiva le
// voci del foglio (un dialogo che legge i permessi) restano fuori.
console.log('GLI ANNI CONTATI QUANDO LA PAGINA SI DISEGNA');
{
  const { caricaPagina, clienteFinto, aspetta, trova } = await import('./dati/paginaFinta.mjs');
  const { writeFileSync, mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const finestra = globalThis.window;
  globalThis.window = { self: 1, top: 1, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, location: { search: '', pathname: '/', hash: '' },
    matchMedia: () => ({ matches: false, addListener() {}, removeListener() {} }), confirm: () => true, alert: () => {}, addEventListener() {}, removeEventListener() {} };
  const DateVera = globalThis.Date;
  const ferma = (iso) => { const ms = DateVera.parse(iso); globalThis.Date = class extends DateVera { constructor(...a) { if (a.length) super(...a); else super(ms); } static now() { return ms; } }; };
  const radice = fileURLToPath(new URL('../src/', import.meta.url)).replace(/\\/g, '/');
  const cartella = mkdtempSync(join(tmpdir(), 'anni-pagine-'));
  // La copia del sorgente: i permessi finti; gli import relativi diventano
  // assoluti (la copia sta in un'altra cartella), e un dialogo si toglie.
  const copia = (rel, togli = []) => {
    let s = readFileSync(join(radice, rel + '.jsx'), 'utf8').replace(/\r/g, '')
      .replace(/import \{ usePermessi[^}]*\} from '@\/lib\/permessi';/, 'const usePermessi = () => ({ isAdmin: true, soloLettura: false });');
    for (const nome of togli) s = s.replace(new RegExp(`import ${nome} from '\\./${nome}';`), `const ${nome} = () => null;`);
    s = s.replace(/from '\.\/([A-Za-z]+)'/g, (_m, n) => `from '${radice}${rel.replace(/[^/]+$/, '')}${n}'`);
    const f = join(cartella, rel.replace(/\//g, '_') + '.jsx');
    writeFileSync(f, s);
    return f;
  };
  const PAGINE = [
    ['Extra Raccolta', 'pages/ExtraRaccolta', () => ({ file: copia('pages/ExtraRaccolta') }), {}],
    ['Dichiarazioni Impianti', 'pages/DichiarazioniImpianti', () => ({ file: copia('pages/DichiarazioniImpianti') }), {}],
    ['Fatturazione passiva', 'components/fatturazione/PassivaModulo', () => ({ file: copia('components/fatturazione/PassivaModulo', ['VociPassivaDialog']) }), { tipologia: 'RETE', periodo: { anno: 2027, mese: 'Gennaio' }, setPeriodo() {} }],
    ['Fatturazione attiva', 'components/fatturazione/AttivaDashboard', () => ({}), { periodo: { anno: 2027, mese: 'Gennaio' }, setPeriodo() {}, data: {}, loading: false, elaborating: false, onElabora() {}, onReload() {}, isAdmin: true, anomalie: [], onVaiTariffe() {} }],
    ['Margine', 'components/fatturazione/MargineCommessa', () => ({}), {}],
  ];
  const voci = (el) => trova(el, 'SelectItem').map(x => String(x.props.value)).filter(v => /^20\d\d$/.test(v));
  const anniA = async (p, props, iso) => {
    ferma(iso);
    try {
      globalThis.__CLIENTE_FINTO = clienteFinto({ archivi: {}, funzioni: {} }).cliente;
      const r = p.monta(p.Componente, props);
      await aspetta(30);
      const sel = trova(r.albero, el => el.type && el.type.__finto === 'Select').find(s => voci(s).length);
      r.smonta();
      return sel ? voci(sel).sort() : null;
    } finally { globalThis.Date = DateVera; }
  };
  for (const [nome, percorso, opzioni, props] of PAGINE) {
    let p = null;
    ferma('2026-12-31T22:30:00Z');
    try { p = await caricaPagina(percorso, opzioni()); } catch (e) { verifica(`${nome}: la pagina si carica sul banco`, false, String(e && e.message).slice(0, 200)); } finally { globalThis.Date = DateVera; }
    if (!p) continue;
    const allora = await anniA(p, props, '2026-12-31T22:30:00Z');
    const dopo = await anniA(p, props, '2027-01-04T08:00:00Z');
    verifica(`${nome}: aperta il 31/12/2026 offre fino al 2026, e il 04/01/2027 nella stessa scheda anche il 2027`,
      !!allora && allora[allora.length - 1] === '2026' && !!dopo && dopo[dopo.length - 1] === '2027' && dopo.includes('2026'), JSON.stringify([allora, dopo]));
  }
  // Target & Status › Zone dei raccoglitori (chiusura del giro, 15/10/2026): lo
  // stesso difetto, con una tendina del browser invece della Select.
  {
    let p = null;
    ferma('2026-12-31T22:30:00Z');
    try { p = await caricaPagina('components/target-status/ZoneRaccoglitori'); } catch (e) { verifica('Zone dei raccoglitori: la scheda si carica sul banco', false, String(e && e.message).slice(0, 200)); } finally { globalThis.Date = DateVera; }
    const opzioniA = async (iso) => {
      ferma(iso);
      try {
        globalThis.__CLIENTE_FINTO = clienteFinto({ archivi: {}, funzioni: {} }).cliente;
        const r = p.monta(p.Componente, { isAdmin: true });
        await aspetta(30);
        const anni = trova(r.albero, 'option').map(o => String(o.props.value)).filter(v => /^20\d\d$/.test(v)).sort();
        r.smonta();
        return anni;
      } finally { globalThis.Date = DateVera; }
    };
    if (p) {
      const allora = await opzioniA('2026-12-31T22:30:00Z');
      const dopo = await opzioniA('2027-01-04T08:00:00Z');
      verifica('Zone dei raccoglitori: aperta il 31/12/2026 offre 2025 e 2026, e il 04/01/2027 nella stessa scheda 2026 e 2027',
        JSON.stringify(allora) === JSON.stringify(['2025', '2026']) && JSON.stringify(dopo) === JSON.stringify(['2026', '2027']), JSON.stringify([allora, dopo]));
    }
  }
  globalThis.window = finestra;
}

// E NESSUNA PAGINA CONTA GLI ANNI QUANDO IL SUO MODULO SI CARICA (chiusura del
// giro, 15/10/2026): una costante del modulo calcolata da oggi resta quella del
// giorno in cui la scheda si e' aperta. Una funzione del modulo va bene: si
// calcola quando la si chiama.
{
  const radice = fileURLToPath(new URL('../src/', import.meta.url));
  const file = [];
  const scorri = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) scorri(p); else if (/\.(jsx|js)$/.test(n)) file.push(p); } };
  scorri(join(radice, 'pages')); scorri(join(radice, 'components'));
  const costante = /^(?:export\s+)?(?:const|let|var)\s+\w+\s*=\s*(?!.*=>).*\b(?:annoDiOggi|anniDaScegliere|meseDiLavoro|oggiRoma)\(/;
  const trovate = [];
  for (const p of file) readFileSync(p, 'utf8').split(/\r?\n/).forEach((r, i) => { if (costante.test(r)) trovate.push(`${p.slice(radice.length)}:${i + 1}`); });
  verifica('nessuna pagina con gli anni o il giorno di oggi in una costante del modulo', trovate.length === 0, '\n    ' + trovate.join('\n    '));
}

console.log(`\n${ok} superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
