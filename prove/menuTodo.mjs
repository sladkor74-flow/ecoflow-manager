// IL NUMERO DELLA TO-DO LIST NEL MENU (decisioni dell'utente del 13/10/2026,
// gruppo B).
//
// Nel menu accanto a «To-Do List» il numero delle attivita' da fare: il «Da
// fare» della pagina (conteggiAttivita, src/lib/todoSezioni.js), cioe' aperte e
// in corso. Il limite di richieste vale per tutta l'app, quindi il numero si
// legge come gli altri contatori del menu: una lettura leggera all'avvio e ogni
// cinque minuti, delle sole da fare, mai l'elenco intero (che coi completati
// cresce ogni mese), e mai a ogni cambio di pagina. In piu' una lettura quando
// si esce dalla To-Do List, dove le attivita' si chiudono e si aggiungono, e il
// numero che la pagina puo' mandare con l'evento EVENTO_TODO, senza leggere.
//
// Qui si prova:
//   1. contaDaFare: una lettura sola, filtrata sugli stati da fare, col
//      numero della pagina;
//   2. il menu vero (src/components/Layout.jsx) montato con React finto
//      (prove/dati/paginaFinta.mjs): il numero accanto alla To-Do List, le
//      letture all'avvio, nessuna lettura in piu' cambiando pagina, una sola
//      uscendo dalla To-Do List, l'evento, i cinque minuti, «99+», e niente
//      numero a zero.
// node prove/menuTodo.mjs
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { caricaPagina, clienteFinto, aspetta, trova, testo } from './dati/paginaFinta.mjs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
const qui = (p) => fileURLToPath(new URL(p, import.meta.url));

const S = await import('../src/lib/todoSezioni.js');
const TODOS = [
  { id: 'a', titolo: 'Sollecito', stato: 'aperto', created_date: '2026-10-10T08:00:00Z' },
  { id: 'b', titolo: 'Pratica', stato: 'in_corso', created_date: '2026-10-09T08:00:00Z' },
  { id: 'c', titolo: 'Ritiro', stato: 'completato', created_date: '2026-09-20T08:00:00Z' },
  { id: 'd', titolo: 'Fattura', stato: 'completato', completata_il: '2026-10-05', created_date: '2026-09-01T08:00:00Z' },
  { id: 'e', titolo: 'Riaperta', stato: 'aperto', chiusa_dal_gestionale: true, created_date: '2026-09-10T08:00:00Z' },
];

console.log('1. CONTADAFARE: UNA LETTURA, SOLO LE DA FARE');
{
  verifica('le funzioni ci sono', typeof S.contaDaFare === 'function' && Array.isArray(S.STATI_DA_FARE) && typeof S.EVENTO_TODO === 'string');
  if (typeof S.contaDaFare === 'function') {
    const f = clienteFinto({ archivi: { Todo: TODOS } });
    const n = await S.contaDaFare(f.cliente.entities.Todo);
    verifica('il numero e\' il «Da fare» della pagina', n === S.conteggiAttivita(TODOS).da_fare && n === 3, J({ n, pagina: S.conteggiAttivita(TODOS) }));
    const l = f.letture('Todo');
    verifica('una lettura sola, filtrata su aperte e in corso, mai l\'elenco intero', l.length === 1 && l[0].metodo === 'filter' && J(l[0].filtro) === J({ stato: { $in: ['aperto', 'in_corso'] } }), J(l));
    const vuoto = clienteFinto({ archivi: { Todo: [] } });
    verifica('nessuna attivita\': zero', await S.contaDaFare(vuoto.cliente.entities.Todo) === 0);
  }
}

console.log('2. IL MENU VERO');
{
  // Il menu si monta con React finto. Chi e' collegato e la pagina aperta
  // arrivano da due moduli finti, al posto del contesto dell'accesso e del
  // router: una copia del menu in una cartella temporanea li importa da li'.
  const dir = mkdtempSync(join(tmpdir(), 'menu-todo-'));
  const percorso = (n) => join(dir, n).replace(/\\/g, '/');
  writeFileSync(percorso('accesso.js'), 'export const useAuth = () => globalThis.__ACCESSO;\n');
  writeFileSync(percorso('router.js'), 'export const useLocation = () => globalThis.__POSIZIONE;\nexport function Link() { return null; }\nexport function Outlet() { return null; }\n');
  // I permessi passano dal contesto dell'accesso vero, che all'avvio legge la
  // configurazione dell'app: qui non servono, e si mettono da parte.
  writeFileSync(percorso('permessi.js'), 'export function caricaLivello() {}\nexport function proteggiScritture() {}\n');
  const sorgente = readFileSync(qui('../src/components/Layout.jsx'), 'utf8');
  const copia = sorgente
    .replace("from '@/lib/AuthContext'", `from ${J(percorso('accesso.js'))}`)
    .replace("from 'react-router-dom'", `from ${J(percorso('router.js'))}`)
    .replace("from '@/lib/permessi'", `from ${J(percorso('permessi.js'))}`);
  verifica('il menu importa accesso, router e permessi come si aspetta la prova', copia !== sorgente && copia.includes('accesso.js') && copia.includes('router.js') && copia.includes('permessi.js'));
  writeFileSync(percorso('Layout.jsx'), copia);

  // Il browser che serve al menu: gli eventi della finestra, l'osservatore
  // delle tabelle (src/lib/tabelleScorrevoli.js) e gli intervalli a comando.
  const ascolti = new Map();
  globalThis.window = {
    self: 1, top: 1, matchMedia: () => ({ matches: false, addListener() {}, removeListener() {} }), confirm: () => true, alert: () => {},
    location: { search: '', hash: '', pathname: '/', href: 'http://localhost/', origin: 'http://localhost' },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    addEventListener: (t, f) => { if (!ascolti.has(t)) ascolti.set(t, new Set()); ascolti.get(t).add(f); },
    removeEventListener: (t, f) => { if (ascolti.has(t)) ascolti.get(t).delete(f); },
  };
  const manda = (tipo, detail) => { for (const f of ascolti.get(tipo) || []) f({ type: tipo, detail }); };
  globalThis.document = { body: {}, querySelectorAll: () => [] };
  globalThis.MutationObserver = class { observe() {} disconnect() {} };
  const intervalli = new Map();
  let progressivo = 0;
  const veriIntervalli = { setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval };
  globalThis.setInterval = (fn, ms) => { const id = ++progressivo; intervalli.set(id, { fn, ms }); return id; };
  globalThis.clearInterval = (id) => { intervalli.delete(id); };

  let pagina = null;
  try { pagina = await caricaPagina('components/Layout', { file: percorso('Layout.jsx') }); } catch (e) { verifica('il menu si impacchetta', false, String(e && e.message).slice(0, 300)); }
  if (pagina && pagina.Componente) {
    const f = clienteFinto({ archivi: { Todo: TODOS, RichiestaUtente: [], RiepilogoQualifica: [] } });
    globalThis.__CLIENTE_FINTO = f.cliente;
    globalThis.__ACCESSO = { user: { role: 'admin', email: 'prova@prova', full_name: 'Prova' }, logout: async () => {} };
    globalThis.__POSIZIONE = { pathname: '/' };
    const r = pagina.monta(pagina.Componente, {});
    await aspetta();
    const voceTodo = () => trova(r.albero, el => el.props && el.props.to === '/todo')[0];
    const numero = () => { const v = voceTodo(); return v ? trova(v, el => el.type === 'span' && /rounded-full/.test(String(el.props.className || ''))).map(testo).join('|') : null; };
    verifica('accanto alla To-Do List c\'e\' il numero delle attivita\' da fare', numero() === '3', J(numero()));
    verifica('e dice che cosa conta, per chi legge con lo schermo', (() => { const v = voceTodo(); const s = v && trova(v, el => el.type === 'span' && el.props['aria-label'])[0]; return s && s.props['aria-label'] === '3 attività da fare'; })());
    const lettureTodo = () => f.letture('Todo');
    verifica('all\'avvio una lettura sola della To-Do, filtrata sulle da fare', lettureTodo().length === 1 && J(lettureTodo()[0].filtro) === J({ stato: { $in: ['aperto', 'in_corso'] } }), J(lettureTodo()));
    verifica('mai l\'elenco intero delle attivita\'', !f.chiamate.some(c => c.nome === 'Todo' && c.metodo === 'list'), J(f.chiamate));
    verifica('all\'avvio il menu fa le sue tre letture leggere (richieste, qualifica, to-do) e nessuna funzione', f.chiamate.filter(c => c.tipo === 'lettura').length === 3 && !f.funzioniChiamate().length, J(f.chiamate));
    const todoInterv = [...intervalli.values()].filter(x => x.ms === 5 * 60 * 1000);
    verifica('si rilegge ogni cinque minuti, come gli altri contatori', todoInterv.length === 3, J([...intervalli.values()].map(x => x.ms)));

    // Cambiare pagina non rilegge niente.
    f.azzera();
    globalThis.__POSIZIONE = { pathname: '/giacenze' }; r.programma(); await aspetta();
    globalThis.__POSIZIONE = { pathname: '/fatturazione' }; r.programma(); await aspetta();
    verifica('cambiando pagina nessuna lettura in piu\'', f.chiamate.length === 0, J(f.chiamate));
    // Uscire dalla To-Do List rilegge una volta: li' le attivita' si chiudono.
    globalThis.__POSIZIONE = { pathname: '/todo' }; r.programma(); await aspetta();
    verifica('entrando nella To-Do List il menu non legge (legge la pagina)', f.chiamate.length === 0, J(f.chiamate));
    TODOS.find(t => t.id === 'b').stato = 'completato';
    globalThis.__POSIZIONE = { pathname: '/' }; r.programma(); await aspetta();
    verifica('uscendo dalla To-Do List una lettura, e il numero nuovo', f.letture('Todo').length === 1 && numero() === '2', J({ l: f.chiamate, n: numero() }));

    // La pagina puo' dire il numero nuovo senza leggere niente.
    f.azzera();
    manda(S.EVENTO_TODO || 'nessun-evento', { da_fare: 7 }); await aspetta();
    verifica('con l\'evento della pagina il numero cambia, senza letture', numero() === '7' && f.chiamate.length === 0, J({ n: numero(), c: f.chiamate }));
    manda(S.EVENTO_TODO || 'nessun-evento', { da_fare: 120 }); await aspetta();
    verifica('oltre 99 si scrive «99+»', numero() === '99+', J(numero()));
    manda(S.EVENTO_TODO || 'nessun-evento', { da_fare: 'boh' }); await aspetta();
    verifica('un evento senza numero non cambia niente', numero() === '99+', J(numero()));
    manda(S.EVENTO_TODO || 'nessun-evento', { da_fare: 0 }); await aspetta();
    verifica('a zero il numero non si mostra', numero() === '', J(numero()));

    // Dopo cinque minuti si rilegge.
    for (const t of TODOS) t.stato = 'aperto';
    for (const x of [...intervalli.values()]) x.fn();
    await aspetta();
    verifica('dopo cinque minuti si rilegge, e il numero e\' quello dell\'archivio', numero() === '5' && f.letture('Todo').length === 1, J({ n: numero(), l: f.letture('Todo') }));

    // Una lettura che non riesce lascia il numero com'era e non rompe il menu.
    const rotto = { ...f.cliente, entities: new Proxy({}, { get: (_t, n) => (n === 'Todo' ? { filter: async () => { throw new Error('429'); } } : f.cliente.entities[n]) }) };
    globalThis.__CLIENTE_FINTO = rotto;
    for (const x of [...intervalli.values()]) x.fn();
    await aspetta();
    verifica('una lettura che non riesce lascia il numero com\'era', numero() === '5' && !r.errori.length, J({ n: numero(), e: r.errori.map(String) }));

    r.smonta();
    verifica('smontato, gli intervalli si fermano e l\'evento non si ascolta piu\'', intervalli.size === 0 && !(ascolti.get(S.EVENTO_TODO) || new Set()).size, J({ i: intervalli.size }));
  }
  globalThis.setInterval = veriIntervalli.setInterval;
  globalThis.clearInterval = veriIntervalli.clearInterval;
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* la cartella temporanea si pulisce da sola */ }
}

// 3. LA PAGINA MANDA IL NUMERO AL MENU (chiusura del giro, 14/10/2026). La To-Do
// List, ogni volta che rilegge l'elenco (aperta, un'attivita' chiusa, aggiunta o
// eliminata), manda al menu il suo «Da fare» con EVENTO_TODO: il numero cambia
// subito, senza un'altra lettura. Solo con l'elenco intero: tagliato a 500, il
// suo conto potrebbe essere piu' basso di quello vero.
console.log('3. LA TO-DO LIST MANDA IL NUMERO AL MENU, SENZA LETTURE');
{
  const mandati = [];
  const finestraPrima = globalThis.window;
  globalThis.window = {
    self: 1, top: 1, matchMedia: () => ({ matches: false, addListener() {}, removeListener() {} }), confirm: () => true, alert: () => {},
    location: { search: '', hash: '', pathname: '/todo', href: 'http://localhost/todo', origin: 'http://localhost' },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    addEventListener() {}, removeEventListener() {},
    dispatchEvent: (e) => { mandati.push(e); return true; },
  };
  globalThis.confirm = () => true;
  // I permessi passano dall'accesso vero, che legge la configurazione dell'app:
  // in una copia della pagina, l'amministratore.
  const dirPagina = mkdtempSync(join(tmpdir(), 'todo-pagina-'));
  try {
    const IMPORT_PERMESSI = "import { usePermessi } from '@/lib/permessi';";
    const sorgentePagina = readFileSync(qui('../src/pages/TodoPage.jsx'), 'utf8');
    verifica('la pagina prende i permessi da usePermessi, come la copia si aspetta', sorgentePagina.includes(IMPORT_PERMESSI));
    const copiaPagina = join(dirPagina, 'TodoPage.jsx').replace(/\\/g, '/');
    writeFileSync(copiaPagina, sorgentePagina.replace(IMPORT_PERMESSI, 'const usePermessi = () => ({ isAdmin: true, soloLettura: false });'));
    const p = await caricaPagina('pages/TodoPage', { file: copiaPagina });
    const archivio = TODOS.map(t => ({ ...t }));
    const f = clienteFinto({ archivi: { Todo: archivio, RichiestaEct: [] }, funzioni: { controllaTodoOrdini: async () => ({ aggiornate: 0 }) } });
    globalThis.__CLIENTE_FINTO = f.cliente;
    const r = p.monta(p.Componente, {});
    await aspetta(80);
    const daFare = () => mandati.filter(e => e && e.type === S.EVENTO_TODO).map(e => e.detail && e.detail.da_fare);
    const atteso = () => S.conteggiAttivita(archivio).da_fare;
    const primo = atteso();
    verifica('aperta la pagina, il menu riceve il «Da fare» dell\'elenco letto', primo > 0 && daFare().length >= 1 && daFare()[daFare().length - 1] === primo && !daFare().includes(0), J([primo, daFare()]));
    const elenco = trova(r.albero, el => el.type && el.type.__finto === 'ElencoAttivita')[0];
    const letturePrima = f.letture('Todo').length;
    // il client finto non scrive: la chiusura la fa l'archivio, come il server
    const a = archivio.find(t => t.id === 'a');
    const primaDellaSpunta = { ...a };
    a.stato = 'completato';
    await elenco.props.onSpunta(primaDellaSpunta);
    await aspetta(80);
    verifica('chiusa un\'attivita\', il menu riceve subito un numero in meno', atteso() === primo - 1 && daFare()[daFare().length - 1] === primo - 1, J([primo, daFare()]));
    verifica('con le sole letture della pagina, nessuna per il menu', f.letture('Todo').length === letturePrima + 1 && f.letture('Todo').every(l => l.metodo === 'list'), J(f.letture('Todo')));
    verifica('nessun errore della pagina', r.errori.length === 0, String(r.errori[0] || ''));
    r.smonta();
    const molti = Array.from({ length: 500 }, (_, i) => ({ id: `m${i}`, titolo: `T${i}`, stato: i % 2 ? 'aperto' : 'completato', created_date: '2026-10-01T08:00:00Z' }));
    mandati.length = 0;
    globalThis.__CLIENTE_FINTO = clienteFinto({ archivi: { Todo: molti, RichiestaEct: [] }, funzioni: { controllaTodoOrdini: async () => ({ aggiornate: 0 }) } }).cliente;
    const r2 = p.monta(p.Componente, {});
    await aspetta(80);
    verifica('con l\'elenco tagliato a 500 la pagina non manda niente: il menu tiene il suo numero', daFare().length === 0, J(daFare()));
    r2.smonta();
  } finally {
    globalThis.window = finestraPrima;
    try { rmSync(dirPagina, { recursive: true, force: true }); } catch { /* la cartella temporanea si pulisce da sola */ }
  }
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
