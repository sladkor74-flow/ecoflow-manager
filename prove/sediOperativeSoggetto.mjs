// Prova della FUNZIONE DELLE SEDI OPERATIVE QUANDO ARRIVA LA PARTITA IVA
// (chiusura dell'audit, 11/10/2026).
//
// Il gommista controllato quando il file dei PDR non portava la partita IVA, e
// ricaricato poi con la partita IVA, risultava «passato a un altro soggetto»:
// verificaSediPdr lo rimetteva in coda e non riportava la decisione gia' presa
// (la sede corretta da mettere sul formulario), anche con l'indirizzo del portale
// e quello trovato in rete identici. La regola sta in stessoSoggetto
// (base44/shared/sediOperative.ts): la partita IVA decide solo quando c'e' da
// tutti e due i lati. Qui la funzione intera, con un SDK finto.
// npm run prove
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const SDK_FINTO = `
const filtra = (righe, f) => righe.filter(r => Object.entries(f || {}).every(([k, v]) => r[k] === v));
function entita(nome) {
  const righe = () => (globalThis.__ARCHIVI_SOGGETTO[nome] ||= []);
  return {
    filter: async (f, _o, lim = 1e9, skip = 0) => filtra(righe(), f).slice(skip, skip + lim),
    list: async (_o, lim = 1e9, skip = 0) => righe().slice(skip, skip + lim),
    get: async (id) => righe().find(r => r.id === id) || null,
    create: async (d) => { const r = { id: 'n' + (righe().length + 1), ...d }; righe().push(r); return r; },
    update: async (id, d) => { const r = righe().find(x => x.id === id); if (r) Object.assign(r, d); return r || { id, ...d }; },
  };
}
const entities = new Proxy({}, { get: (_t, nome) => entita(nome) });
const Core = { InvokeLLM: async () => globalThis.__RISPOSTE_SOGGETTO.shift() };
export function createClientFromRequest() {
  const utente = { role: 'admin', email: 'prova@smoco' };
  return { auth: { me: async () => utente }, asServiceRole: { entities, integrations: { Core } }, entities, integrations: { Core } };
}`;
const r = await build({
  entryPoints: [qui('../base44/functions/verificaSediPdr/entry.ts')],
  bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
  plugins: [{ name: 'finti', setup(b) {
    b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'finto' }));
    b.onLoad({ filter: /.*/, namespace: 'finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
  } }],
});
const modulo = await import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
const chiama = async (body = {}) => { const res = await modulo.default({ json: async () => body }); return { status: res.status, body: await res.json() }; };

// Il controllo di una settimana fa, quando il file non portava la partita IVA:
// la sede del portale era la vecchia sede legale, e l'amministratore ha scritto
// quella giusta per il formulario.
const controllo = {
  id: 'v1', id_pdr: 18181, ragione_sociale: 'EUROGOMME SRL', partita_iva: '', indirizzo_portale: 'Corso Vittorio Emanuele,138',
  comune_portale: 'Lavello', indirizzo_trovato: 'S.S. 93 km 56,400 - Zona PALS', comune_trovato: 'Lavello',
  verificato_il: '2026-10-04', esito: 'diverso', stato: 'corretto', indirizzo_per_formulario: 'S.S. 93 km 56,400 - Zona PALS',
  comune_per_formulario: 'Lavello', deciso_il: '2026-10-04', deciso_da: 'admin', superata: false,
};
// Il file dei PDR ricaricato oggi: stesso gommista, stesso indirizzo, ma ora con la partita IVA.
const ricaricato = { id: 'p1', id_pdr: 18181, id_cliente: 17578, ragione_sociale: 'EUROGOMME SRL', descrizione_pdr: 'EUROGOMME SRL', partita_iva: '01234567890',
  sede_legale: 'Corso Vittorio Emanuele,138', indirizzo_pdr: 'Corso Vittorio Emanuele,138', cap_pdr: '85024', comune_pdr: 'Lavello', provincia_pdr: 'PZ' };
const risposta = { indirizzo: 'S.S. 93 km 56,400 - Zona PALS', cap: '85024', comune: 'Lavello', provincia: 'PZ', confidenza: 'alta', fonti: ['https://mappe.example/eurogomme'] };
const prepara = () => {
  globalThis.__ARCHIVI_SOGGETTO = { Pdr: [{ ...ricaricato }], Assegnato: [{ id: 'a1', id_pdr: 18181, anno: 2026 }], AssegnatoAci: [], VerificaSedePdr: [{ ...controllo }] };
  globalThis.__RISPOSTE_SOGGETTO = [{ ...risposta }];
};

console.log('LA PARTITA IVA ARRIVATA COL FILE NUOVO NON FA UN ALTRO SOGGETTO');
prepara();
const giro = await chiama({ anno: 2026, limite: 4 });
verifica('il giro automatico non lo rimette in coda «per un altro soggetto»', giro.status === 200 && giro.body.controllati === 0, JSON.stringify(giro.body));

prepara();
const aMano = await chiama({ ids: [18181], limite: 4, motivo: 'chiesto dalla scheda' });
const nuova = (globalThis.__ARCHIVI_SOGGETTO.VerificaSedePdr || []).find(v => v.id !== 'v1');
verifica('chiesto a mano si rifa\'', aMano.status === 200 && aMano.body.controllati === 1 && !!nuova, JSON.stringify(aMano.body));
verifica('e la decisione gia\' presa si riporta: nessun dato e\' cambiato',
  nuova && nuova.stato === 'corretto' && nuova.indirizzo_per_formulario === 'S.S. 93 km 56,400 - Zona PALS' && nuova.deciso_da === 'admin', JSON.stringify(nuova));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
