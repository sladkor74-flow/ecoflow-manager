// LA GUIDA DENTRO IL GESTIONALE (14/10/2026).
//
// Proposta all'utente il 14/10/2026 e accettata lo stesso giorno: una pagina
// «Guida» per chi usa il gestionale - che cosa vede, che cosa puo' esportare,
// come apre una richiesta - con le parti per livello e, per l'amministratore,
// i passi del mese. I testi stanno in src/lib/guida.js, la pagina in
// src/pages/Guida.jsx.
//
// Una guida invecchia in silenzio: arriva un modulo nuovo nel menu e lei non
// lo nomina, cambia un indirizzo e il suo collegamento porta a una pagina
// bianca. Qui si prova:
//   1. ogni voce del menu (src/components/Layout.jsx) ha la sua parte nella
//      guida, con lo stesso nome e lo stesso percorso, e nessuna parte nomina
//      un modulo che il menu non ha;
//   2. ogni collegamento porta a una rotta di src/App.jsx, una scheda chiesta
//      con ?tab= esiste nella pagina, e la pagina legge l'indirizzo;
//   3. la pagina e' pigra e ha la sua rotta;
//   4. i testi per livello: chi legge vede il suo, l'amministratore tutti, e i
//      passi del mese sono solo suoi; un livello «admin» senza il ruolo non
//      apre niente;
//   5. la ricerca: senza accenti, alla radice, tutte le parole, nell'ordine
//      della guida, e l'evidenziazione che non perde una lettera del testo;
//   6. la pagina montata (React finto): nessuna richiesta al server, i moduli
//      e le sezioni giuste per livello, la ricerca e il «nessun risultato»;
//   7. nessun riferimento alla piattaforma, numeri all'italiana, niente che
//      sul telefono vada oltre i 375 px, e una ricerca che non si dice ferma
//      dove il Layout non la puo' tenere ferma;
//   8. le cose nuove dello stesso giro: la guida le nomina se le pagine le
//      hanno, e promette il promemoria della copia se e solo se il cruscotto
//      lo fa (dalla chiusura del 15/10/2026 lo fa, e la guida lo dice);
//   9. la pagina disegnata con React vero: per livello, le note di ognuno.
//
// Il menu si legge eseguendo l'elenco NAV_ITEMS (15/10/2026), cosi' una voce
// nuova si vede comunque sia scritta.
//
// node prove/guida.mjs
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  MODULI, SEZIONI, cercaNellaGuida, livelliDaMostrare, livelloDellaGuida, notePerLivello, sezioniVisibili,
  moduloApribile, normalizza, radice, paroleDellaRicerca, pezziEvidenziati, collegamentiDellaGuida, idDelModulo,
  testoDelModulo, testoDellaSezione, PERCORSO_GUIDA,
} from '../src/lib/guida.js';
import { LIVELLI } from '../src/lib/livelli.js';
import { caricaPagina, clienteFinto, aspetta, trova, testo } from './dati/paginaFinta.mjs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
// I sorgenti sono a CRLF o a LF secondo chi li ha toccati: si toglie il \r.
const leggi = (p) => readFileSync(qui('../' + p), 'utf8').replace(/\r/g, '');

// ---------------------------------------------------------------------------
console.log('1. OGNI VOCE DEL MENU HA LA SUA PARTE NELLA GUIDA');
// ---------------------------------------------------------------------------
const layout = leggi('src/components/Layout.jsx');

// Il menu si legge eseguendo l'elenco com'e' scritto, non con un'espressione
// regolare (15/10/2026): la regola di prima voleva il nome fra apici singoli,
// senza apostrofi e col percorso subito dopo, e una voce nuova scritta in un
// altro modo («Registro dell'anno» fra doppi apici, 'Qualita\' dei dati',
// l'icona prima del percorso) spariva dal confronto lasciando la prova verde.

/** Il testo fra le quadre di NAV_ITEMS: parentesi contate, stringhe e commenti saltati. */
function internoDelMenu(sorgente) {
  const inizio = sorgente.indexOf('const NAV_ITEMS = [');
  if (inizio < 0) return null;
  const da = sorgente.indexOf('[', inizio) + 1;
  let profondita = 1;
  for (let i = da; i < sorgente.length; i++) {
    const ch = sorgente[i];
    if (ch === '/' && sorgente[i + 1] === '/') { i = sorgente.indexOf('\n', i); if (i < 0) return null; continue; }
    if (ch === '/' && sorgente[i + 1] === '*') { i = sorgente.indexOf('*/', i + 2) + 1; if (i <= 0) return null; continue; }
    if (ch === "'" || ch === '"' || ch === '`') {
      for (i++; i < sorgente.length && sorgente[i] !== ch; i++) if (sorgente[i] === '\\') i++;
      continue;
    }
    if ('[{('.includes(ch)) profondita++;
    else if (']})'.includes(ch) && --profondita === 0) return sorgente.slice(da, i);
  }
  return null;
}

/**
 * Le voci del menu, dall'elenco eseguito: apici singoli o doppi, apostrofi,
 * proprieta' in qualsiasi ordine. Le icone, e ogni altro nome che l'elenco
 * usa, diventano un segnaposto che ricorda il suo nome.
 */
function vociDelMenu(interno) {
  const ambito = new Proxy({}, {
    has: (_, k) => typeof k === 'string',
    get: (_, k) => (k === Symbol.unscopables ? undefined : { __nome: String(k) }),
  });
  const elenco = Array.from(new Function('ambito', `with (ambito) { return [${interno}\n]; }`)(ambito));
  return elenco.map(v => ({
    nome: v && typeof v.label === 'string' ? v.label : null,
    percorso: v && typeof v.path === 'string' ? v.path : null,
    soloAdmin: !!v && v.soloAdmin === true,
    icona: (v && v.icon && v.icon.__nome) || null,
  }));
}
/** Quante voci il sorgente scrive: le «label:» fuori dai commenti. */
const vociScritte = (interno) => (interno.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').match(/(^|[\s{,])label\s*:/gm) || []).length;
const interno = internoDelMenu(layout);
/** Il menu del Layout con una voce in piu' in coda, letto da capo: per le controprove. */
function menuCon(voce) {
  const altro = layout.replace(interno, () => `${interno.replace(/,?\s*$/, '')},\n${voce}`);
  const i = internoDelMenu(altro) || '';
  return { voci: vociDelMenu(i), scritte: vociScritte(i) };
}
verifica('l\'elenco del menu si trova nel Layout', typeof interno === 'string' && interno.length > 100);
const menu = vociDelMenu(interno || '');

/** Il confronto fra menu e guida: che cosa manca, che cosa e' in piu', che cosa non torna. */
function confronta(voci, moduli) {
  const delMenu = voci.filter(v => v.percorso !== PERCORSO_GUIDA);
  const perPercorso = new Map(moduli.map(m => [m.percorso, m]));
  const mancanti = delMenu.filter(v => !perPercorso.has(v.percorso)).map(v => v.nome);
  const inPiu = moduli.filter(m => !delMenu.some(v => v.percorso === m.percorso)).map(m => m.nome);
  const nomiDiversi = delMenu.filter(v => perPercorso.has(v.percorso) && perPercorso.get(v.percorso).nome !== v.nome)
    .map(v => `${v.nome} / ${perPercorso.get(v.percorso).nome}`);
  const soloAdminDiversi = delMenu.filter(v => perPercorso.has(v.percorso) && !!perPercorso.get(v.percorso).soloAdmin !== v.soloAdmin).map(v => v.nome);
  const ordine = delMenu.filter(v => perPercorso.has(v.percorso)).map(v => v.percorso).join('|') === moduli.filter(m => delMenu.some(v => v.percorso === m.percorso)).map(m => m.percorso).join('|');
  return { mancanti, inPiu, nomiDiversi, soloAdminDiversi, ordine };
}

verifica('il menu si legge (almeno 27 voci, la Guida compresa)', menu.length >= 27 && menu.some(v => v.percorso === PERCORSO_GUIDA), String(menu.length));
verifica('ogni voce scritta nel menu e\' letta', menu.length === vociScritte(interno || ''), `${menu.length} lette, ${vociScritte(interno || '')} scritte`);
verifica('ogni voce ha il suo nome e il suo percorso', menu.every(v => v.nome && v.percorso), JSON.stringify(menu.filter(v => !v.nome || !v.percorso)));
verifica('la voce della Guida e\' per tutti, non solo dell\'amministratore', menu.some(v => v.percorso === PERCORSO_GUIDA && v.nome === 'Guida' && !v.soloAdmin));
verifica('e ha la sua icona importata', menu.some(v => v.percorso === PERCORSO_GUIDA && v.icona === 'BookOpen') && /\bBookOpen\b[^;]*from\s*\n?'lucide-react'/.test(layout));
const c = confronta(menu, MODULI);
verifica('nessun modulo del menu senza guida', c.mancanti.length === 0, c.mancanti.join(', '));
verifica('nessuna parte della guida per un modulo che il menu non ha', c.inPiu.length === 0, c.inPiu.join(', '));
verifica('i nomi sono quelli del menu', c.nomiDiversi.length === 0, c.nomiDiversi.join('; '));
verifica('«solo amministratore» come nel menu (Utenti)', c.soloAdminDiversi.length === 0 && MODULI.find(m => m.percorso === '/utenti').soloAdmin === true, c.soloAdminDiversi.join(', '));
verifica('e nello stesso ordine del menu', c.ordine);
verifica('i moduli richiesti dal lavoro ci sono tutti', [
  'Dashboard', 'Caricamento Dati', 'Assegnati Rete', 'Assegnati ACI', 'PDR', 'Terminati Rete', 'Terminati ACI', 'Secondarie', 'Terziarie',
  'Giacenze', 'Extra Raccolta', 'Target & Status', 'Report', 'Report Mensile', 'Alert & Controllo', 'Fatturazione', 'Qualifica Fornitori',
  'Omologhe', 'Dichiarazioni RENTRI', 'Dichiarazioni Impianti', 'Verifiche', 'Verifiche Fornitori', 'EcoTyna', 'Predittività Secondarie',
  'To-Do List', 'Richieste', 'Utenti',
].every(n => MODULI.some(m => m.nome === n)));

// La controprova del confronto: un modulo nuovo nel menu senza la sua guida
// deve far cadere la prova, comunque sia scritto, e cosi' un nome cambiato.
{
  for (const [come, voce, nome] of [
    ['come le altre', "{ label: 'Registro errori', path: '/registro-errori', icon: Shield }", 'Registro errori'],
    ['fra doppi apici, con l\'apostrofo', "{ label: \"Registro dell'anno\", path: '/registro-anno', icon: Shield }", 'Registro dell\'anno'],
    ['con l\'apostrofo fra apici singoli', "{ label: 'Qualita\\' dei dati', path: '/qualita-dati', icon: Shield }", 'Qualita\' dei dati'],
    ['con l\'icona prima del percorso', "{ label: 'Errori del sito', icon: Bug, path: '/errori-sito' }", 'Errori del sito'],
    ['col percorso prima del nome', "{ path: '/anagrafiche', label: 'Anagrafiche', icon: Users }", 'Anagrafiche'],
    ['con «];» nel nome', "{ label: 'Prova ];', path: '/prova', icon: Shield }", 'Prova ];'],
  ]) {
    const { voci, scritte } = menuCon(voce);
    // Una mancante in piu' di quelle del menu di oggi, ed e' proprio lei.
    const mancanti = confronta(voci, MODULI).mancanti;
    verifica(`controprova: un modulo nuovo senza guida si vede, scritto ${come}`, mancanti.length === c.mancanti.length + 1 && mancanti.includes(nome) && voci.length === scritte && voci.length === menu.length + 1, JSON.stringify(mancanti));
  }
  const soloAdminInCoda = menuCon("{ soloAdmin: true, icon: Users, label: 'Permessi', path: '/permessi' }").voci;
  verifica('controprova: «solo amministratore» si legge in qualsiasi posto', soloAdminInCoda.some(v => v.percorso === '/permessi' && v.soloAdmin === true));
  const senzaPercorso = menuCon("{ label: 'Senza strada', icon: Shield }").voci;
  verifica('controprova: una voce senza percorso si vede', senzaPercorso.some(v => v.nome === 'Senza strada' && v.percorso === null));
  const rinominato = menu.map(v => (v.percorso === '/giacenze' ? { ...v, nome: 'Magazzino' } : v));
  verifica('controprova: un nome cambiato si vede', confronta(rinominato, MODULI).nomiDiversi.length === 1);
  verifica('controprova: una guida per un modulo tolto dal menu si vede', confronta(menu.filter(v => v.percorso !== '/report'), MODULI).inPiu.join() === 'Report');
}

// IL MODULO DI RICHIESTA HA TUTTE LE VOCI DEL MENU (chiusura del 15/10/2026).
// La guida dice «Scegli il modulo. Se non e' nell'elenco, scegli Altro»
// (sezione Richieste): l'elenco di src/pages/Richieste.jsx non aveva Dashboard,
// Omologhe, Dichiarazioni RENTRI, Dichiarazioni Impianti, Verifiche Fornitori,
// Richieste, Guida e Utenti, e chi chiedeva una correzione su quelle pagine
// doveva scegliere «Altro». Il valore salvato di EcoTyna resta 'Assistente'
// (ETICHETTE_MODULI): si confronta il nome a video.
{
  const sorgenteRichieste = leggi('src/pages/Richieste.jsx');
  const sceltaDelModulo = (src) => {
    const elenco = (src.match(/const MODULI = \[([\s\S]*?)\];/) || [])[1];
    const etichette = (src.match(/const ETICHETTE_MODULI = (\{[^}]*\});/) || [])[1];
    if (!elenco || !etichette) return null;
    const nomi = new Function(`return [${elenco}];`)();
    const aVideo = new Function(`return ${etichette};`)();
    return nomi.map(n => aVideo[n] || n);
  };
  const scelta = sceltaDelModulo(sorgenteRichieste) || [];
  const mancano = menu.filter(v => !scelta.includes(v.nome)).map(v => v.nome);
  verifica('ogni voce del menu si puo\' scegliere nel modulo di richiesta, e «Altro» sta in fondo', scelta.length > 0 && mancano.length === 0 && scelta[scelta.length - 1] === 'Altro', JSON.stringify(mancano));
  verifica('e nello stesso ordine del menu', JSON.stringify(scelta.filter(n => menu.some(v => v.nome === n))) === JSON.stringify(menu.map(v => v.nome)), JSON.stringify(scelta));
  const senzaOmologhe = sorgenteRichieste.replace("'Omologhe', ", '');
  verifica('controprova: una voce tolta dall\'elenco si vede', senzaOmologhe !== sorgenteRichieste && !menu.every(v => (sceltaDelModulo(senzaOmologhe) || []).includes(v.nome)));
}

console.log('   ogni modulo ha le sue parti');
for (const m of MODULI) {
  const dove = `(${m.nome})`;
  verifica(`a che cosa serve ${dove}`, typeof m.aCosaServe === 'string' && m.aCosaServe.length > 20);
  verifica(`che cosa vedi ${dove}`, Array.isArray(m.cosaVedi) && m.cosaVedi.length > 0);
  verifica(`che cosa esporti, o perche' niente ${dove}`, Array.isArray(m.esporti) && (m.esporti.length > 0 || (typeof m.senzaEsportazioni === 'string' && m.senzaEsportazioni.length > 10)));
  verifica(`che cosa e' dell'amministratore, o che non c'e' niente da modificare ${dove}`, Array.isArray(m.soloAmministratore) && (m.soloAmministratore.length > 0 || typeof m.nienteDaModificare === 'string' || !!m.perLivello));
  verifica(`le note per livello solo per livelli che esistono ${dove}`, Object.keys(m.perLivello || {}).every(k => LIVELLI[k]));
}
verifica('le ancore dei moduli sono tutte diverse', new Set(MODULI.map(idDelModulo)).size === MODULI.length);
verifica('l\'ancora di «Target & Status» e\' leggibile', idDelModulo(MODULI.find(m => m.nome === 'Target & Status')) === 'modulo-target-status');

// ---------------------------------------------------------------------------
console.log('2. OGNI COLLEGAMENTO PORTA A UNA PAGINA CHE ESISTE');
// ---------------------------------------------------------------------------
const app = leggi('src/App.jsx');
const pigre = new Map([...app.matchAll(/^const\s+([A-Za-z0-9_]+)\s+=\s+lazy\(\(\)\s+=>\s+import\('@\/pages\/([A-Za-z0-9_]+)'\)\);\s*$/gm)].map(m => [m[1], m[2]]));
const rotte = new Map();
for (const m of app.matchAll(/<Route\s+path="([^"]+)"\s+element=\{([^\n]*)\}\s*\/>/g)) {
  const pagina = (m[2].match(/<(?!PageErrorBoundary\b)([A-Z][A-Za-z0-9_]*)/) || [])[1] || null;
  rotte.set(m[1], { pagina, rimando: pagina === 'Navigate', file: pigre.has(pagina) ? `src/pages/${pigre.get(pagina)}.jsx` : null });
}
verifica('le rotte si leggono', rotte.size >= 28 && rotte.has('/') && rotte.has('/fatturazione'), String(rotte.size));

/** Che cosa non va in un collegamento: niente se porta dove deve. */
function problemaDel(percorso) {
  const [base, query = ''] = percorso.split('?');
  const r = rotte.get(base);
  if (!r) return `${base} non e' una rotta di App.jsx`;
  if (r.rimando) return `${base} e' solo un rimando: il collegamento deve portare alla pagina vera`;
  if (!r.file) return `${base}: la pagina ${r.pagina} non e' dichiarata pigra`;
  const src = leggi(r.file);
  const parametri = new URLSearchParams(query);
  const tab = parametri.get('tab');
  if (tab) {
    const leggeLaScheda = /leggiCollegamento\(location\.search/.test(src) || /params\.get\('tab'\)/.test(src);
    if (!leggeLaScheda) return `${r.file} non legge la scheda dall'indirizzo`;
    const nelleSchede = new RegExp(`'${tab}'`).test((src.match(/const SCHEDE = \[[^\]]*\]/) || [''])[0] + (src.match(/schedeDi = [^\n]*/) || [''])[0]);
    const aVideo = new RegExp(`TabsTrigger value="${tab}"`).test(src);
    if (!nelleSchede || !aVideo) return `${r.file} non ha la scheda «${tab}»`;
  }
  if (parametri.has('domanda') && !/params\.get\('domanda'\)/.test(src)) return `${r.file} non legge la domanda dall'indirizzo`;
  return null;
}
const tutti = collegamentiDellaGuida();
verifica('la guida ha i suoi collegamenti (moduli e sezioni)', tutti.length >= MODULI.length + 15, String(tutti.length));
for (const l of tutti) {
  const p = problemaDel(l.percorso);
  verifica(`${l.da} → ${l.percorso}`, p === null, p || '');
}
verifica('controprova: una pagina che non c\'e\' si vede', problemaDel('/pagina-che-non-c-e') !== null);
verifica('controprova: una scheda che non c\'e\' si vede', problemaDel('/fatturazione?tab=inventata') !== null);
verifica('controprova: un rimando non vale come pagina', problemaDel('/target-annuali') !== null);
verifica('controprova: la pagina giusta passa', problemaDel('/verifiche?tab=quadratura-fir') === null);
verifica('gli esempi per EcoTyna la aprono con la domanda gia\' scritta', SEZIONI.find(s => s.id === 'ecotyna').gruppi[0].elementi.every(e => e.link && e.link.percorso.startsWith('/assistente?domanda=') && decodeURIComponent(e.link.percorso.split('domanda=')[1]) === e.testo));

// ---------------------------------------------------------------------------
console.log('3. LA PAGINA E\' PIGRA E HA LA SUA ROTTA');
// ---------------------------------------------------------------------------
verifica('Guida e\' dichiarata pigra', pigre.get('Guida') === 'Guida');
verifica('e non e\' importata in testa', !/^import\s+Guida\s+from/m.test(app));
verifica('la rotta /guida apre la Guida, dentro il Layout', rotte.get(PERCORSO_GUIDA) && rotte.get(PERCORSO_GUIDA).pagina === 'Guida'
  && app.indexOf('path="/guida"') > app.indexOf('<Route element={<Layout />}>') && app.indexOf('path="/guida"') < app.indexOf('<Route path="*"'));
verifica('con la sua rete in caso d\'errore', /<Route path="\/guida" element=\{<PageErrorBoundary><Guida \/><\/PageErrorBoundary>\} \/>/.test(app));

// ---------------------------------------------------------------------------
console.log('4. I TESTI PER LIVELLO');
// ---------------------------------------------------------------------------
verifica('l\'amministratore e\' chi lo e\' per il ruolo', livelloDellaGuida('consultazione', true) === 'admin');
verifica('un livello «admin» senza il ruolo non apre niente', livelloDellaGuida('admin', false) === 'consultazione');
verifica('un livello non ancora letto vale consultazione', livelloDellaGuida(null, false) === 'consultazione' && livelloDellaGuida('boh', false) === 'consultazione');
verifica('l\'operatore base resta tale', livelloDellaGuida('operatore_base', false) === 'operatore_base');

const perConsultazione = livelliDaMostrare('consultazione');
verifica('chi consulta vede solo il suo livello', perConsultazione.length === 1 && perConsultazione[0].chiave === 'consultazione' && perConsultazione[0].tuo);
verifica('con le stesse righe della pagina Utenti', JSON.stringify(perConsultazione[0].puo) === JSON.stringify(LIVELLI.consultazione.puo) && JSON.stringify(perConsultazione[0].nonPuo) === JSON.stringify(LIVELLI.consultazione.nonPuo));
const perOperatore = livelliDaMostrare('operatore_base');
verifica('l\'operatore base vede solo il suo', perOperatore.length === 1 && perOperatore[0].chiave === 'operatore_base' && perOperatore[0].puo.includes('Carica il file delle Primarie'));
const perAdmin = livelliDaMostrare('admin');
verifica('l\'amministratore li vede tutti e tre, il suo segnato', perAdmin.map(l => l.chiave).join() === 'consultazione,operatore_base,admin' && perAdmin.filter(l => l.tuo).map(l => l.chiave).join() === 'admin');
verifica('ogni livello ha la sua introduzione', perAdmin.every(l => typeof l.intro === 'string' && l.intro.length > 20));

verifica('i passi del mese solo all\'amministratore', !sezioniVisibili('consultazione').some(s => s.id === 'mese') && !sezioniVisibili('operatore_base').some(s => s.id === 'mese') && sezioniVisibili('admin').some(s => s.id === 'mese'));
verifica('le altre sezioni a tutti', ['richieste', 'parole', 'ecotyna'].every(id => sezioniVisibili('consultazione').some(s => s.id === id)));
const caricamento = MODULI.find(m => m.percorso === '/caricamento-dati');
verifica('la nota di Caricamento Dati: all\'operatore la sua', notePerLivello(caricamento, 'operatore_base').map(n => n.livello).join() === 'operatore_base' && notePerLivello(caricamento, 'operatore_base')[0].tuo);
verifica('a chi consulta la sua, che non promette caricamenti', notePerLivello(caricamento, 'consultazione').length === 1 && !/puoi caricare/i.test(notePerLivello(caricamento, 'consultazione')[0].testo));
verifica('all\'amministratore tutte e tre, la sua segnata', notePerLivello(caricamento, 'admin').map(n => n.livello).join() === 'consultazione,operatore_base,admin' && notePerLivello(caricamento, 'admin').filter(n => n.tuo).map(n => n.livello).join() === 'admin');
const utenti = MODULI.find(m => m.percorso === '/utenti');
verifica('Utenti si apre solo da amministratore', !moduloApribile(utenti, 'consultazione') && !moduloApribile(utenti, 'operatore_base') && moduloApribile(utenti, 'admin'));
verifica('gli altri moduli si aprono da tutti', MODULI.filter(m => !m.soloAdmin).every(m => moduloApribile(m, 'consultazione')));
verifica('la ricerca non trova i passi del mese a chi non e\' amministratore', !cercaNellaGuida('chiusura del mese', 'consultazione').sezioni.some(s => s.id === 'mese') && cercaNellaGuida('chiusura del mese', 'admin').sezioni.some(s => s.id === 'mese'));
// «si copiano» sta solo nella nota dell'amministratore (all'operatore: «copiali»).
verifica('ne\' la nota di un altro livello', !cercaNellaGuida('si copiano', 'operatore_base').moduli.some(m => m.percorso === '/caricamento-dati') && cercaNellaGuida('si copiano', 'admin').moduli.some(m => m.percorso === '/caricamento-dati'));
// Costi e margine sono dell'amministratore: la guida li nomina come cose sue, mai coi numeri.
verifica('costi e margine: la guida dice che sono dell\'amministratore', /costi e margine li vede solo l’amministratore/.test(JSON.stringify(MODULI.find(m => m.percorso === '/fatturazione').soloAmministratore)));
verifica('il modulo Richieste spiega le due parti', notePerLivello(MODULI.find(m => m.percorso === '/richieste'), 'admin').length === 3);

// ---------------------------------------------------------------------------
console.log('5. LA RICERCA');
// ---------------------------------------------------------------------------
verifica('senza accenti e senza maiuscole', normalizza('Predittività È Più') === 'predittivita e piu');
verifica('l\'apostrofo divide le parole', normalizza('dell’amministratore') === 'dell amministratore' && normalizza("l'ID") === 'l id');
verifica('le radici', radice('esportare') === 'esport' && radice('richieste') === 'richiest' && radice('richiesta') === 'richiest' && radice('dichiarazioni') === 'dichiar' && radice('pdr') === 'pdr' && radice('fir') === 'fir');
verifica('una radice non scende sotto le tre lettere', radice('ire') === 'ire' && radice('ato') === 'ato' && radice('casa').length >= 3);
verifica('le parole vuote non contano', JSON.stringify(paroleDellaRicerca('Come apro una richiesta?')) === JSON.stringify(['apr', 'richiest']));
verifica('una ricerca di sole parole vuote cerca quelle', paroleDellaRicerca('come').length === 1);
const vuota = cercaNellaGuida('   ', 'consultazione');
verifica('senza parole si vede tutta la guida', vuota.attiva === false && vuota.moduli.length === MODULI.length && vuota.livelli === true && vuota.sezioni.length === sezioniVisibili('consultazione').length);
const richiesta = cercaNellaGuida('come apro una richiesta', 'consultazione');
verifica('«come apro una richiesta» trova la sezione e il modulo', richiesta.sezioni.some(s => s.id === 'richieste') && richiesta.moduli.some(m => m.percorso === '/richieste'), JSON.stringify(richiesta.moduli.map(m => m.nome)));
verifica('con e senza accento lo stesso', JSON.stringify(cercaNellaGuida('predittività', 'consultazione').moduli.map(m => m.nome)) === JSON.stringify(cercaNellaGuida('PREDITTIVITA', 'consultazione').moduli.map(m => m.nome)) && cercaNellaGuida('predittivita', 'consultazione').moduli.length === 1);
const pdf = cercaNellaGuida('esportare in pdf', 'consultazione');
verifica('«esportare in pdf» trova chi esporta in PDF, anche col solo titolo', ['/', '/report', '/verifiche', '/giacenze', '/extra-raccolta'].every(p => pdf.moduli.some(m => m.percorso === p)), JSON.stringify(pdf.moduli.map(m => m.nome)));
verifica('e non chi non esporta niente', !pdf.moduli.some(m => m.percorso === '/alert-engine' || m.percorso === '/todo'));
verifica('tutte le parole devono esserci', cercaNellaGuida('eseguito zzzqqq', 'admin').quanti === 0 && cercaNellaGuida('eseguito', 'admin').quanti > 0);
verifica('«eseguito» trova le parole del portale', cercaNellaGuida('eseguito', 'consultazione').sezioni.some(s => s.id === 'parole'));
verifica('nell\'ordine della guida', (() => { const r = cercaNellaGuida('esportare', 'admin').moduli.map(m => MODULI.indexOf(m)); return r.length > 3 && r.every((x, i) => i === 0 || x > r[i - 1]); })());
const niente = cercaNellaGuida('zzzqqq', 'consultazione');
verifica('niente trovato: quanti 0, ricerca attiva', niente.attiva === true && niente.quanti === 0 && niente.moduli.length === 0 && niente.sezioni.length === 0 && !niente.livelli);
verifica('il conto dei risultati', richiesta.quanti === (richiesta.livelli ? 1 : 0) + richiesta.sezioni.length + richiesta.moduli.length);
verifica('una domanda lunghissima non si blocca', (() => { const t0 = Date.now(); cercaNellaGuida('esportare '.repeat(2000), 'admin'); return Date.now() - t0 < 2000; })());
const frase = 'Esporta il quadro (PDF): l’elenco «Da gestire» delle richieste.';
const pezzi = pezziEvidenziati(frase, paroleDellaRicerca('esportare richiesta pdf'));
verifica('l\'evidenziazione non perde una lettera', pezzi.map(p => p.testo).join('') === frase);
verifica('ed evidenzia le parole cercate, non le altre', pezzi.filter(p => p.evidenziato).map(p => p.testo).join('|') === 'Esporta|PDF|richieste', pezzi.filter(p => p.evidenziato).map(p => p.testo).join('|'));
verifica('senza ricerca un pezzo solo', pezziEvidenziati(frase, []).length === 1 && pezziEvidenziati(null, ['x'])[0].testo === '');
verifica('il testo cercato di un modulo e\' quello che si vede', testoDelModulo(caricamento, 'consultazione').includes(caricamento.aCosaServe) && !testoDelModulo(caricamento, 'consultazione').includes(caricamento.perLivello.admin));
verifica('e quello di una sezione comprende i suoi elementi', testoDellaSezione(SEZIONI.find(s => s.id === 'parole')).includes('Eseguito'));

// ---------------------------------------------------------------------------
console.log('6. LA PAGINA, MONTATA');
// ---------------------------------------------------------------------------
const IMPORT_PERMESSI = "import { usePermessi } from '@/lib/permessi';";
const sorgentePagina = leggi('src/pages/Guida.jsx');
verifica('la pagina prende chi legge da usePermessi, come la copia si aspetta', sorgentePagina.includes(IMPORT_PERMESSI));
const cartella = mkdtempSync(join(tmpdir(), 'guida-'));
// La cartella delle copie delle pagine si toglie alla fine, anche se la prova
// cade a meta' (l'evento exit arriva anche dopo un errore non preso): prima
// ne restava una nella cartella temporanea a ogni giro (chiusura del 15/10/2026).
const togliCartella = () => rmSync(cartella, { recursive: true, force: true });
process.on('exit', togliCartella);
const pagine = {};
for (const [nome, permessi] of [
  ['consultazione', "{ isAdmin: false, livello: 'consultazione' }"],
  ['operatore', "{ isAdmin: false, livello: 'operatore_base' }"],
  ['admin', "{ isAdmin: true, livello: 'admin' }"],
  ['nonLetto', '{ isAdmin: false, livello: null }'],
  ['adminSenzaRuolo', "{ isAdmin: false, livello: 'admin' }"],
]) {
  const file = join(cartella, `Guida-${nome}.jsx`);
  writeFileSync(file, sorgentePagina.replace(IMPORT_PERMESSI, `const usePermessi = () => (${permessi});`));
  pagine[nome] = await caricaPagina('pages/Guida', { file, reali: [] });
}
const nomeDi = (el) => (el.type && (el.type.__finto || el.type.name)) || el.type;
const di = (albero, nome) => trova(albero, el => nomeDi(el) === nome);
async function apri(nome) {
  const cl = clienteFinto();
  globalThis.__CLIENTE_FINTO = cl.cliente;
  const p = pagine[nome];
  const m = p.monta(p.Componente);
  await aspetta();
  return { m, cl };
}
const cerca = async (m, valore) => {
  const input = trova(m.albero, el => el.type === 'input' && el.props.type === 'search')[0];
  input.props.onChange({ target: { value: valore } });
  await aspetta();
};

{
  const { m, cl } = await apri('consultazione');
  verifica('la pagina si disegna senza errori', m.errori.length === 0 && !!m.albero, m.errori.map(String).join(' '));
  verifica('e non chiede niente al server', cl.chiamate.length === 0, JSON.stringify(cl.chiamate));
  const tutto = testo(m.albero).replace(/\s+/g, ' ');
  verifica('dice per quale livello e\' la guida', /Stai leggendo la guida per il livello Consultazione\./.test(tutto), tutto.slice(0, 300));
  verifica('tutti i moduli, ciascuno con chi legge', di(m.albero, 'ModuloGuida').length === MODULI.length && di(m.albero, 'ModuloGuida').every(el => el.props.chi === 'consultazione' && el.props.aperto === false));
  verifica('il suo livello soltanto', di(m.albero, 'LivelliGuida').length === 1 && di(m.albero, 'LivelliGuida')[0].props.livelli.length === 1);
  verifica('le sezioni di tutti, senza i passi del mese', di(m.albero, 'SezioneGuida').map(el => el.props.sezione.id).join() === 'richieste,parole,ecotyna');
  verifica('l\'indice c\'e\', senza i passi del mese', trova(m.albero, el => el.type === 'nav').length === 1 && !/I passi del mese/.test(testo(trova(m.albero, el => el.type === 'nav')[0])));
  verifica('«Come chiedere» prima delle pagine del menu', (() => { const t = [...trova(m.albero, el => nomeDi(el) === 'SezioneGuida' || el.type === 'section')]; return t.length > 1 && nomeDi(t[0]) === 'SezioneGuida' && t[0].props.sezione.id === 'richieste'; })());

  await cerca(m, 'eseguito');
  const moduli = di(m.albero, 'ModuloGuida');
  const atteso = cercaNellaGuida('eseguito', 'consultazione');
  verifica('la ricerca filtra i moduli come la regola', moduli.map(el => el.props.modulo.nome).join() === atteso.moduli.map(x => x.nome).join(), moduli.map(el => el.props.modulo.nome).join());
  verifica('e li apre, con le parole da evidenziare', moduli.every(el => el.props.aperto === true && el.props.radici.join() === atteso.radici.join()));
  verifica('le sezioni trovate', di(m.albero, 'SezioneGuida').map(el => el.props.sezione.id).join() === atteso.sezioni.map(s => s.id).join());
  verifica('dice quanti risultati', new RegExp(`${atteso.quanti} risultat. per «eseguito»`).test(testo(m.albero)));
  verifica('durante la ricerca l\'indice si toglie', trova(m.albero, el => el.type === 'nav').length === 0);

  await cerca(m, 'zzzqqq');
  const t = testo(m.albero);
  verifica('niente trovato: lo dice', /Nessun risultato per «zzzqqq»/.test(t));
  const collegamenti = di(m.albero, 'Collegamento').map(el => el.props.percorso);
  verifica('e propone EcoTyna con la domanda, e una richiesta', collegamenti.includes('/assistente?domanda=zzzqqq') && collegamenti.includes('/richieste'), collegamenti.join(' '));
  verifica('niente moduli ne\' sezioni', di(m.albero, 'ModuloGuida').length === 0 && di(m.albero, 'SezioneGuida').length === 0 && di(m.albero, 'LivelliGuida').length === 0);

  await cerca(m, '');
  verifica('cancellata la ricerca torna tutto', di(m.albero, 'ModuloGuida').length === MODULI.length && trova(m.albero, el => el.type === 'nav').length === 1);
  verifica('e nessuna richiesta al server nemmeno cercando', cl.chiamate.length === 0);
}
{
  const { m } = await apri('admin');
  verifica('l\'amministratore: i tre livelli', di(m.albero, 'LivelliGuida')[0].props.livelli.length === 3);
  verifica('e i passi del mese', di(m.albero, 'SezioneGuida').map(el => el.props.sezione.id).join() === 'richieste,parole,ecotyna,mese');
  verifica('e i moduli per lui', di(m.albero, 'ModuloGuida').every(el => el.props.chi === 'admin'));
  verifica('il titolo lo dice', /Vedi anche le parti degli altri livelli/.test(testo(m.albero)));
}
{
  const { m } = await apri('operatore');
  verifica('l\'operatore base: il suo livello', /livello Operatore base/.test(testo(m.albero)) && di(m.albero, 'ModuloGuida').every(el => el.props.chi === 'operatore_base'));
}
{
  const { m } = await apri('nonLetto');
  verifica('un livello non ancora letto: consultazione', di(m.albero, 'ModuloGuida').every(el => el.props.chi === 'consultazione') && di(m.albero, 'SezioneGuida').length === 3);
}
{
  // Il livello «admin» scritto in un archivio non fa amministratore chi non lo
  // e' per il ruolo: la pagina passa da livelloDellaGuida, mai dal livello letto.
  const { m } = await apri('adminSenzaRuolo');
  verifica('un livello «admin» senza il ruolo: la guida di chi consulta', di(m.albero, 'ModuloGuida').every(el => el.props.chi === 'consultazione') && !di(m.albero, 'SezioneGuida').some(el => el.props.sezione.id === 'mese') && di(m.albero, 'LivelliGuida')[0].props.livelli.length === 1);
}
{
  // Il modulo da solo: chi consulta non trova un collegamento a Utenti, e
  // la parte dell'amministratore porta a una richiesta.
  const { ModuloGuida } = pagine.consultazione.modulo;
  const p = pagine.consultazione;
  const mu = p.monta(ModuloGuida, { modulo: utenti, chi: 'consultazione', radici: [], aperto: false });
  const percorsi = di(mu.albero, 'Collegamento').map(el => el.props.percorso);
  verifica('Utenti a chi consulta: niente collegamento alla pagina', !percorsi.includes('/utenti') && /la vede solo l’amministratore/.test(testo(mu.albero)));
  const ma = p.monta(ModuloGuida, { modulo: utenti, chi: 'admin', radici: [], aperto: false });
  verifica('all\'amministratore si', di(ma.albero, 'Collegamento').some(el => el.props.percorso === '/utenti'));
  const fatt = MODULI.find(m => m.percorso === '/fatturazione');
  const mc = p.monta(ModuloGuida, { modulo: fatt, chi: 'consultazione', radici: [], aperto: false });
  verifica('a chi consulta la parte dell\'amministratore si chiama cosi\'', di(mc.albero, 'Blocco').some(el => el.props.titolo === 'Lo fa solo l’amministratore') && di(mc.albero, 'Collegamento').some(el => el.props.percorso === '/richieste'));
  const mad = p.monta(ModuloGuida, { modulo: fatt, chi: 'admin', radici: [], aperto: false });
  verifica('all\'amministratore «Solo tu», senza mandarlo alle richieste', di(mad.albero, 'Blocco').some(el => el.props.titolo === 'Solo tu, come amministratore') && !di(mad.albero, 'Collegamento').some(el => el.props.percorso === '/richieste'));
  verifica('il modulo chiuso finche\' non si cerca', trova(mc.albero, el => el.type === 'details')[0].props.open === undefined && trova(p.monta(ModuloGuida, { modulo: fatt, chi: 'admin', radici: [], aperto: true }).albero, el => el.type === 'details')[0].props.open === true);
  verifica('con l\'ancora per l\'indice', trova(mc.albero, el => el.type === 'details')[0].props.id === 'modulo-fatturazione');
}

// ---------------------------------------------------------------------------
console.log('7. NIENTE PIATTAFORMA, NUMERI ALL\'ITALIANA, LEGGIBILE A 375 PX');
// ---------------------------------------------------------------------------
const visibile = JSON.stringify({ MODULI, SEZIONI, livelli: livelliDaMostrare('admin') });
verifica('nessun nome della piattaforma nei testi', !/base\s*44/i.test(visibile));
verifica('nemmeno la parola «piattaforma»', !/piattaforma/i.test(visibile));
verifica('nessun riferimento nel sorgente della pagina e della guida, commenti compresi', !/base\s*44/i.test(sorgentePagina) && !/base\s*44/i.test(leggi('src/lib/guida.js')));
verifica('i numeri all\'italiana: niente migliaia senza punto', !/\b\d{4,}\s*(kg|t|€)/.test(visibile) && /1\.500 kg/.test(visibile));
verifica('nessuna data all\'americana o ISO nei testi', !/\b\d{4}-\d{2}-\d{2}\b/.test(visibile) && !/\b\d{1,2}\/\d{1,2}\/\d{2}\b(?!\d)/.test(visibile));
verifica('si da\' del tu', /\b(puoi|vedi|scrivi|apri)\b/i.test(visibile) && !/\b(Lei può|potete|vedete)\b/.test(visibile));
const senzaCommenti = sorgentePagina.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
verifica('nessuna tabella nella pagina', !/<table/.test(senzaCommenti));
verifica('nessuna larghezza fissa oltre il telefono', !/\b(min-)?w-\[\d{3,}px\]/.test(senzaCommenti) && !/\b(min-)?w-(9[6-9]|[1-9]\d{2,})\b/.test(senzaCommenti));
verifica('i testi lunghi vanno a capo', (senzaCommenti.match(/break-words/g) || []).length >= 6);
verifica('indice e collegamenti vanno a capo', /aria-label="Indice della guida" className="flex flex-wrap/.test(senzaCommenti));
verifica('la ricerca e\' larga quanto lo schermo', /type="search"[\s\S]{0,200}className="[^"]*w-full/.test(senzaCommenti));
// La ricerca non si dice ferma dove non puo' restarlo (15/10/2026). Un
// elemento sticky si ferma rispetto al primo antenato con un suo scorrimento
// (overflow diverso da visible), anche se quello non scorre mai. Nel Layout e'
// <main className="flex-1 overflow-y-auto">, in un contenitore che cresce col
// contenuto (min-h-screen, nessuna altezza fissa): a scorrere e' la finestra e
// uno sticky nella pagina se ne va col resto. La Guida aveva lg:sticky e
// prometteva una ricerca «ferma in alto da 1024 px» che non c'era.
const mainDelLayout = (layout.match(/<main className="([^"]*)"/) || [])[1];
const radiceDelLayout = (layout.match(/\breturn \(\s*<div className="([^"]*)"/) || [])[1];
verifica('il <main> e il contenitore del Layout si leggono', typeof mainDelLayout === 'string' && typeof radiceDelLayout === 'string');
const mainHaScorrimento = /(^|\s)overflow-(x-|y-)?(auto|scroll|hidden|clip)(\s|$)/.test(mainDelLayout || '');
const altezzaFissa = /(^|\s)(h-screen|h-dvh|h-\[100d?vh\]|overflow-hidden)(\s|$)/.test(radiceDelLayout || '');
const stickyPuoFermarsi = !mainHaScorrimento || altezzaFissa;
const stickyNellaPagina = /(^|[\s"'`])([a-z0-9]+:)?sticky(?=[\s"'`])/.test(senzaCommenti);
verifica('la ricerca non e\' sticky finche\' il Layout non la puo\' tenere ferma', stickyPuoFermarsi || !stickyNellaPagina, `main: «${mainDelLayout}», contenitore: «${radiceDelLayout}»`);
verifica('e il commento non lo promette', stickyPuoFermarsi || !/resta ferma in alto/.test(sorgentePagina));
verifica('sul telefono niente sticky in cima, sotto la barra ferma del gestionale', !/className="([^"]*\s)?sticky top-0/.test(senzaCommenti));
verifica('in fondo «Torna alla ricerca» riporta alla casella', /Torna alla ricerca/.test(senzaCommenti) && /id=\{ID_RICERCA\}/.test(senzaCommenti) && /getElementById\(ID_RICERCA\)[\s\S]{0,200}\.focus\(/.test(senzaCommenti));
verifica('nessun componente definito dentro un altro', !/export default function Guida\(\)[\s\S]*\n\s+function [A-Z]/.test(senzaCommenti) && !/export default function Guida\(\)[\s\S]*const [A-Z][A-Za-z]+ = \(\{/.test(senzaCommenti));

// ---------------------------------------------------------------------------
console.log('8. LE COSE NUOVE DELLO STESSO GIRO: LA GUIDA LE NOMINA SE LE PAGINE LE HANNO');
// ---------------------------------------------------------------------------
// Il 14/10/2026, insieme alla guida, sono nati la copia di sicurezza, il
// riepilogo della settimana e il registro degli errori del sito. La guida li
// nomina; se una di queste cose esce dalla sua pagina, la guida deve smettere
// di prometterla, e se cambia nome la frase della guida va riscritta.
{
  const nominata = (frase) => visibile.includes(frase);
  const legame = [
    ['src/pages/Dashboard.jsx', /<RiepilogoSettimanale\b/, '«Riepilogo della settimana (PDF)»',
      () => /etichetta="Riepilogo della settimana \(PDF\)"/.test(leggi('src/components/dashboard/RiepilogoSettimanale.jsx'))],
    ['src/pages/CaricamentoDati.jsx', /<CopiaSicurezza\b/, 'copia di sicurezza di tutti gli archivi',
      () => /Copia di sicurezza/.test(leggi('src/components/caricamento/CopiaSicurezza.jsx'))],
    ['src/pages/AlertEngine.jsx', /TabsTrigger value="errori"/, 'La scheda Errori del sito',
      () => /Errori del sito/.test(leggi('src/pages/AlertEngine.jsx'))],
  ];
  for (const [file, segno, frase, nome] of legame) {
    const presente = segno.test(leggi(file));
    verifica(`${file}: ${presente ? 'c\'e\', e la guida lo dice' : 'non c\'e\', e la guida non lo promette'} (${frase})`, presente === nominata(frase));
    if (presente) verifica(`${file}: col nome che la guida usa`, nome());
  }
}
{
  // Il promemoria della copia (15/10/2026). La regola c'e'
  // (base44/shared/promemoriaCopia.ts, vociPromemoriaCopia), ma finche' nessun
  // file del gestionale la chiama «Da gestire» non avverte mai: la guida non
  // puo' dire all'amministratore «dopo sette giorni la Dashboard te lo
  // ricorda», altrimenti lui si fida e la copia non la fa piu'. Chi la chiama
  // si cerca in src e base44, prove escluse, fuori dai commenti.
  const { readdirSync, statSync } = await import('node:fs');
  const fileDi = (cartella) => readdirSync(qui('../' + cartella)).flatMap((f) => {
    const p = `${cartella}/${f}`;
    if (f === 'node_modules') return [];
    return statSync(qui('../' + p)).isDirectory() ? fileDi(p) : (/\.(jsx?|tsx?|mjs)$/.test(f) ? [p] : []);
  });
  const chiamaIlPromemoria = (sorgente) => {
    const codice = sorgente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
    return /\bvociPromemoriaCopia\s*\(/.test(codice) && !/\bfunction\s+vociPromemoriaCopia\b/.test(codice);
  };
  const chiamano = [...fileDi('src'), ...fileDi('base44')].filter(p => chiamaIlPromemoria(leggi(p)));
  const stringhe = (x) => (typeof x === 'string' ? [x] : Array.isArray(x) ? x.flatMap(stringhe) : x && typeof x === 'object' ? Object.values(x).flatMap(stringhe) : []);
  const promette = (moduli, sezioni) => stringhe({ moduli, sezioni }).filter(t => /copia di sicurezza/i.test(t) && /(ricord|promemoria|sette giorni|7 giorni|da gestire)/i.test(t));
  const promesse = promette(MODULI, SEZIONI);
  verifica(`la guida promette il promemoria della copia solo se il gestionale lo fa (chi lo chiama: ${chiamano.join(', ') || 'nessuno'})`, promesse.length === 0 || chiamano.length > 0, JSON.stringify(promesse));
  // Dalla chiusura del 15/10/2026 il cruscotto la chiama (cruscotto.ts, con la
  // riga letta da cruscottoOperativo): allora la guida lo deve dire nei passi
  // del mese, dove l'amministratore cerca che cosa fare e quando, e nella parte
  // della Dashboard che e' solo sua. Prima qui c'era una nota stampata, che una
  // prova verde non fa leggere a nessuno.
  const neiPassi = promette([], SEZIONI.filter(s => s.id === 'mese'));
  verifica('se il gestionale ricorda la copia, la guida lo dice nei passi del mese', chiamano.length === 0 || neiPassi.length > 0, JSON.stringify(chiamano));
  // La stessa promessa la fa la sezione della copia in Caricamento Dati («dopo
  // sette giorni la dashboard te lo ricorda»): vale lo stesso patto.
  const sezioneCopia = leggi('src/components/caricamento/CopiaSicurezza.jsx').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  verifica('anche Caricamento Dati promette il promemoria della copia solo se il gestionale lo fa', !/dashboard te lo ricorda|continuer[àa] a ricordarla/i.test(sezioneCopia) || chiamano.length > 0, JSON.stringify(chiamano));
  const dashboard = MODULI.find(m => m.percorso === '/');
  const soloSuo = stringhe(dashboard && dashboard.soloAmministratore).join(' ');
  const cruscottoTs = leggi('base44/shared/cruscotto.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  const chiamaErrori = /\bvociErroriSito\s*\(\s*dati\.erroriSito/.test(cruscottoTs);
  verifica('la parte della Dashboard solo dell\'amministratore nomina gli errori del sito e la copia quando «Da gestire» li dice, e solo allora',
    /errori del sito/i.test(soloSuo) === chiamaErrori && /copia di sicurezza/i.test(soloSuo) === (chiamano.length > 0), JSON.stringify([soloSuo, chiamaErrori, chiamano]));
  verifica('la guida dice dove si vede l\'ultima copia, e la sezione lo mostra', stringhe(SEZIONI).some(t => /giorno dell’ultima copia/.test(t)) && /Ultima copia: /.test(leggi('src/components/caricamento/CopiaSicurezza.jsx')));
  // Le controprove della regola: la frase di prima si vede, e una chiamata vera la permette.
  verifica('controprova: la frase di prima e\' una promessa', promette([], [{ testo: 'Una volta alla settimana, la copia di sicurezza in Caricamento Dati: dopo sette giorni la Dashboard te lo ricorda.' }]).length === 1);
  verifica('controprova: una chiamata vera conta, un commento o la definizione no', chiamaIlPromemoria("import { vociPromemoriaCopia } from './promemoriaCopia.ts';\nvoci.push(...vociPromemoriaCopia({ righe, oggi, amministratore }));")
    && !chiamaIlPromemoria('// qui un giorno vociPromemoriaCopia(...)\nconst x = 1;') && !chiamaIlPromemoria('export function vociPromemoriaCopia({ righe }) { return []; }'));
}

// ---------------------------------------------------------------------------
console.log('9. LA PAGINA DISEGNATA DAVVERO (React vero, lato server)');
// ---------------------------------------------------------------------------
// Il React finto non esegue i componenti figli: qui la pagina si disegna
// intera, coi moduli, le sezioni e le parole evidenziate, come la vede chi la
// apre. Il livello arriva da un usePermessi finto; tutto il resto e' vero.
{
  const { build } = await import('esbuild');
  const { existsSync } = await import('node:fs');
  const ESTENSIONI = ['', '.js', '.jsx', '.ts'];
  const daAlias = (p) => { const base = qui('../src/' + p.slice(2)); return ESTENSIONI.map(e => base + e).find(existsSync) || base; };
  const INGRESSO = `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import { MemoryRouter } from 'react-router-dom';
import Guida, { ModuloGuida } from ${JSON.stringify(qui('../src/pages/Guida.jsx'))};
export const disegna = () => renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Guida)));
export const disegnaModulo = (props) => renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(ModuloGuida, props)));
`;
  const PERMESSI_FINTI = 'export const usePermessi = () => globalThis.__PERMESSI_GUIDA;';
  let disegna = () => '', disegnaModulo = () => '';
  try {
    const pacchetto = await build({
      stdin: { contents: INGRESSO, resolveDir: qui('.'), loader: 'js' },
      bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent',
      loader: { '.jsx': 'jsx', '.js': 'jsx' },
      define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [{ name: 'finti', setup(b) {
        b.onResolve({ filter: /^@\/lib\/permessi$/ }, () => ({ path: 'permessi', namespace: 'permessi-finti' }));
        b.onLoad({ filter: /.*/, namespace: 'permessi-finti' }, () => ({ contents: PERMESSI_FINTI, loader: 'js' }));
        b.onResolve({ filter: /^@\// }, (a) => ({ path: daAlias(a.path) }));
      } }],
    });
    globalThis.window = globalThis.window || { self: 1, top: 1 };
    ({ disegna, disegnaModulo } = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64')));
  } catch (e) { verifica('la pagina si impacchetta con React vero', false, String(e && e.message).slice(0, 300)); }

  globalThis.__PERMESSI_GUIDA = { isAdmin: false, livello: 'consultazione' };
  const html = disegna();
  verifica('si disegna', html.length > 10000, String(html.length));
  verifica('un riquadro apribile per ogni modulo', (html.match(/<details /g) || []).length === MODULI.length);
  verifica('ogni modulo col suo nome e «Apri»', MODULI.filter(m => !m.soloAdmin).every(m => html.includes(`href="${m.percorso}"`) && html.includes(`Apri ${m.nome.replace('&', '&amp;')}`)));
  verifica('chi consulta non ha il collegamento a Utenti', !html.includes('href="/utenti"') && html.includes('Questa pagina la vede solo l’amministratore.'));
  verifica('«Il tuo livello», Consultazione', html.includes('Il tuo livello') && html.includes('Consultazione') && !html.includes('I passi del mese'));
  verifica('le tre sezioni di tutti', ['id="richieste"', 'id="parole"', 'id="ecotyna"', 'id="livello"', 'id="moduli"'].every(x => html.includes(x)) && !html.includes('id="mese"'));
  verifica('gli esempi aprono EcoTyna con la domanda', html.includes('href="/assistente?domanda=Quanti%20ordini%20aperti'));
  verifica('niente evidenziato senza ricerca', !html.includes('<mark'));
  verifica('nessun nome della piattaforma a video', !/base\s*44/i.test(html));
  // Le note per livello (15/10/2026): a chi non e' amministratore solo la sua.
  // Una pagina che le mostrasse tutte direbbe a chi consulta «Per chi è
  // Operatore base: Puoi caricare tre file...» e un falso «Per il tuo
  // livello: Amministratore».
  const noteDi = (h) => [...h.matchAll(/(Per il tuo livello: [^<]+|Per chi è [^<]+|Per te, amministratore)/g)].map(m => m[1]);
  const noteConsultazione = noteDi(html);
  verifica('chi consulta vede le note del suo livello', noteConsultazione.length > 0 && noteConsultazione.every(n => n === 'Per il tuo livello: Consultazione'), JSON.stringify([...new Set(noteConsultazione)]));
  verifica('e quante ne prevede la regola', noteConsultazione.length === MODULI.filter(m => notePerLivello(m, 'consultazione').length).length);
  const aVideo = (h) => h.replace(/<[^>]+>/g, '').replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const testoConsultazione = aVideo(html);
  // Le note degli altri livelli, tranne quelle scritte uguali alla sua (Richieste).
  const noteDAltri = MODULI.flatMap(m => ['operatore_base', 'admin'].map(k => m.perLivello && m.perLivello[k]).filter(t => t && t !== m.perLivello.consultazione));
  verifica('e nessuna nota d\'altri, nemmeno nel testo', noteDAltri.length > 0 && !html.includes('Per chi è') && !html.includes('Per te, amministratore') && !noteDAltri.some(t => testoConsultazione.includes(t)));
  verifica('mentre la sua c\'e\', a video', MODULI.filter(m => m.perLivello && m.perLivello.consultazione).every(m => testoConsultazione.includes(m.perLivello.consultazione)));
  verifica('in fondo «Torna alla ricerca»', html.includes('Torna alla ricerca') && html.includes('id="cerca-guida"'));
  globalThis.__PERMESSI_GUIDA = { isAdmin: false, livello: 'operatore_base' };
  const noteOperatore = noteDi(disegna());
  verifica('l\'operatore base vede solo le note del suo livello', noteOperatore.length > 0 && noteOperatore.every(n => n === 'Per il tuo livello: Operatore base'), JSON.stringify([...new Set(noteOperatore)]));
  globalThis.__PERMESSI_GUIDA = { isAdmin: false, livello: 'admin' };
  const noteFalsoAdmin = noteDi(disegna());
  verifica('un livello «admin» senza il ruolo: le note di chi consulta', noteFalsoAdmin.every(n => n === 'Per il tuo livello: Consultazione') && noteFalsoAdmin.length === noteConsultazione.length);
  globalThis.__PERMESSI_GUIDA = { isAdmin: true, livello: 'admin' };
  const admin = disegna();
  verifica('l\'amministratore: i livelli, i passi del mese, Utenti', admin.includes('I livelli') && admin.includes('id="mese"') && admin.includes('href="/utenti"') && admin.includes('(il tuo)'));
  verifica('e le note per livello col nome di chi le riguarda', admin.includes('Per chi è Operatore base') && admin.includes('Per te, amministratore'));
  const fatt = MODULI.find(m => m.percorso === '/fatturazione');
  const conRicerca = disegnaModulo({ modulo: fatt, chi: 'consultazione', radici: paroleDellaRicerca('passiva'), aperto: true });
  verifica('una ricerca evidenzia le parole e apre il modulo', /<details[^>]* open=""/.test(conRicerca) && /<mark[^>]*>Passiva<\/mark>/.test(conRicerca), conRicerca.slice(0, 200));
}

togliCartella();
verifica('la cartella temporanea delle copie delle pagine non resta', !existsSync(cartella), cartella);

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
