// LA FUNZIONE CHE CONTROLLA LE SEDI OPERATIVE, PROVATA INTERA.
//
// Il nocciolo (confronto degli indirizzi, chi si controlla, le fonti
// obbligatorie) sta in prove/sediOperative.mjs. Qui si prova quello che solo la
// funzione fa: chi puo' lanciarla, che cosa scrive e - soprattutto - che cosa
// NON scrive. Due regole della casa che qui si incrociano:
//   1) l'anagrafica dei punti di raccolta non si tocca: importPdrFile la
//      cancella e la riscrive a ogni caricamento, quindi una correzione messa li'
//      sparirebbe col file successivo;
//   2) quello che torna da una ricerca in rete senza una fonte consultabile non
//      diventa un indirizzo.
// La funzione si impacchetta con esbuild su un SDK finto, come in importDate.mjs.
// npm run prove
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const qui = (p) => join(dirname(fileURLToPath(import.meta.url)), p);
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const SDK_FINTO = `
const filtra = (righe, f) => righe.filter(r => Object.entries(f || {}).every(([k, v]) => r[k] === v));
function entita(nome) {
  const righe = () => (globalThis.__ARCHIVI[nome] ||= []);
  return {
    filter: async (f, _o, lim = 1e9, skip = 0) => filtra(righe(), f).slice(skip, skip + lim),
    list: async (_o, lim = 1e9, skip = 0) => righe().slice(skip, skip + lim),
    get: async (id) => righe().find(r => r.id === id) || null,
    create: async (d) => { const r = { id: 'n' + (righe().length + 1), ...d }; righe().push(r); return r; },
    update: async (id, d) => { const r = righe().find(x => x.id === id); if (r) Object.assign(r, d); return r || { id, ...d }; },
    deleteMany: async () => { globalThis.__ARCHIVI[nome] = []; },
    bulkCreate: async (a) => { righe().push(...a); return a; },
  };
}
const entities = new Proxy({}, { get: (_t, nome) => entita(nome) });
const Core = {
  InvokeLLM: async (p) => { globalThis.__PROMPT.push(p.prompt); const r = globalThis.__RISPOSTE.shift(); if (r instanceof Error) throw r; return r; },
};
export function createClientFromRequest() {
  const utente = { role: globalThis.__RUOLO || 'admin', email: 'prova@smoco' };
  return { auth: { me: async () => utente }, asServiceRole: { entities, integrations: { Core } }, entities, integrations: { Core } };
}`;

const finti = {
  name: 'moduli-finti',
  setup(b) {
    b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'finto' }));
    b.onLoad({ filter: /.*/, namespace: 'finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
  },
};

const r = await build({
  entryPoints: [qui('../base44/functions/verificaSediPdr/entry.ts')],
  bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent', plugins: [finti],
});
const modulo = await import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
const chiama = async (body = {}) => { const res = await modulo.default({ json: async () => body }); return { status: res.status, body: await res.json() }; };

const PDR = [
  // Il caso vero: l'indirizzo del punto e' la copia della sede legale.
  { id: 'p1', id_pdr: 18181, id_cliente: 17578, ragione_sociale: 'EUROGOMME SRL', descrizione_pdr: 'EUROGOMME SRL', partita_iva: '0123', sede_legale: 'Corso Vittorio Emanuele,138', indirizzo_pdr: 'Corso Vittorio Emanuele,138', cap_pdr: '85024', comune_pdr: 'Lavello', provincia_pdr: 'PZ' },
  // Qui la sede legale e' un'altra: l'avvertimento non deve uscire.
  { id: 'p2', id_pdr: 199, id_cliente: 199, ragione_sociale: 'Marciuliano Gomme snc', sede_legale: 'Via Roma 1', indirizzo_pdr: 'V.le Berlinguer, 34', cap_pdr: '75012', comune_pdr: 'Bernalda', provincia_pdr: 'MT' },
  // Senza ordini: non si controlla.
  { id: 'p3', id_pdr: 999, id_cliente: 999, ragione_sociale: 'MAI VISTO SRL', indirizzo_pdr: 'Via Lontana 1', comune_pdr: 'Milano', provincia_pdr: 'MI' },
];
const ORDINI = [
  { id: 'a1', id_pdr: 18181, anno: 2026 },
  { id: 'a2', id_pdr: 199, anno: 2026 },
  { id: 'a3', id_pdr: 18181, anno: 2026 },
];

const prepara = (verifiche = []) => {
  globalThis.__ARCHIVI = { Pdr: PDR.map(p => ({ ...p })), Assegnato: ORDINI.map(o => ({ ...o })), AssegnatoAci: [], VerificaSedePdr: verifiche.map(v => ({ ...v })) };
  globalThis.__PROMPT = [];
  globalThis.__RUOLO = 'admin';
};
const archivio = (nome) => globalThis.__ARCHIVI[nome] || [];

console.log('CHI PUO\' LANCIARLA');
prepara();
globalThis.__RUOLO = 'user';
globalThis.__RISPOSTE = [];
const negata = await chiama({ anno: 2026 });
verifica('chi non e\' amministratore non la lancia', negata.status === 403 && negata.body.sola_lettura === true, JSON.stringify(negata));
verifica('e non ha scritto niente', archivio('VerificaSedePdr').length === 0);

console.log('IL CONTROLLO SCRIVE UNA PROPOSTA, NON UN DATO');
prepara();
globalThis.__RISPOSTE = [
  { indirizzo: 'S.S. 93 km 56,400 - Zona PALS', cap: '85024', comune: 'Lavello', provincia: 'PZ', confidenza: 'alta', fonti: ['https://mappe.example/eurogomme', 'https://elenco.example/eurogomme'], spiegazione: 'Scheda dell\'attivita\'' },
  { indirizzo: 'Viale Berlinguer 34', cap: '75012', comune: 'Bernalda', provincia: 'MT', confidenza: 'media', fonti: ['https://elenco.example/marciuliano'] },
];
const giro = await chiama({ anno: 2026, limite: 4 });
verifica('risponde con i controllati e quanti ne restano',
  giro.status === 200 && giro.body.controllati === 2 && giro.body.restanti === 0, JSON.stringify(giro.body));
const scritte = archivio('VerificaSedePdr');
verifica('ha scritto una verifica per ciascuno', scritte.length === 2, JSON.stringify(scritte.map(s => s.id_pdr)));
const euro = scritte.find(s => s.id_pdr === 18181);
verifica('EUROGOMME: la rete dice un\'altra sede, e l\'esito lo dice',
  euro && euro.esito === 'diverso' && euro.indirizzo_trovato === 'S.S. 93 km 56,400 - Zona PALS' && euro.confidenza === 'alta', JSON.stringify(euro));
verifica('con la fotografia di quello che diceva il portale quel giorno',
  euro && euro.indirizzo_portale === 'Corso Vittorio Emanuele,138' && euro.comune_portale === 'Lavello');
verifica('e la decisione resta all\'amministratore', euro && euro.stato === 'da_decidere' && !euro.indirizzo_per_formulario);
verifica('chi ha l\'indirizzo confermato dalla rete esce «coincide»',
  scritte.find(s => s.id_pdr === 199).esito === 'coincide');
verifica('il punto senza ordini non e\' stato controllato', !scritte.some(s => s.id_pdr === 999));
// La regola che conta: l'anagrafica non si tocca.
verifica('L\'ANAGRAFICA NON E\' STATA TOCCATA',
  JSON.stringify(archivio('Pdr')) === JSON.stringify(PDR), JSON.stringify(archivio('Pdr')));
verifica('a chi cerca si dice che l\'indirizzo e\' anche la sede legale',
  /anche come sede legale/.test(globalThis.__PROMPT[0]), String(globalThis.__PROMPT[0]).slice(0, 200));
verifica('e non lo si dice quando non e\' vero',
  !/anche come sede legale/.test(globalThis.__PROMPT[1] || ''));

console.log('SENZA FONTE NON SI SCRIVE UN INDIRIZZO');
prepara();
globalThis.__RISPOSTE = [
  { indirizzo: 'Via Inventata 10', comune: 'Lavello', confidenza: 'alta', fonti: [] },
  { indirizzo: 'Viale Berlinguer 34', comune: 'Bernalda', confidenza: 'media', fonti: ['https://elenco.example/marciuliano'] },
];
await chiama({ anno: 2026, limite: 4 });
const senzaFonte = archivio('VerificaSedePdr').find(s => s.id_pdr === 18181);
verifica('l\'indirizzo senza fonte non entra nell\'archivio',
  senzaFonte.esito === 'non_trovato' && senzaFonte.indirizzo_trovato === '', JSON.stringify(senzaFonte));

console.log('QUANDO LA RICERCA NON RIESCE');
prepara();
globalThis.__RISPOSTE = [new Error('rete non raggiungibile'), { indirizzo: '', fonti: [], confidenza: 'bassa' }];
const conErrore = await chiama({ anno: 2026, limite: 4 });
verifica('la riga resta, con l\'errore scritto, e il giro va avanti',
  conErrore.status === 200 && archivio('VerificaSedePdr').find(s => s.id_pdr === 18181).esito === 'errore'
  && archivio('VerificaSedePdr').length === 2, JSON.stringify(conErrore.body));

console.log('IL SECONDO GIRO');
// Un controllo di ieri su un indirizzo che non e' cambiato non si rifa'.
prepara([{ id: 'v1', id_pdr: 199, indirizzo_portale: 'V.le Berlinguer, 34', verificato_il: '2026-10-05', esito: 'coincide', stato: 'confermato_portale', deciso_il: '2026-10-05', deciso_da: 'admin' }]);
globalThis.__RISPOSTE = [{ indirizzo: 'S.S. 93 km 56,400', comune: 'Lavello', confidenza: 'alta', fonti: ['https://mappe.example/eurogomme'] }];
const secondo = await chiama({ anno: 2026, limite: 4 });
verifica('si ricontrolla solo chi non e\' stato controllato', secondo.body.controllati === 1 && secondo.body.verifiche[0].id_pdr === 18181, JSON.stringify(secondo.body.verifiche.map(v => v.id_pdr)));

// Un controllo chiesto a mano si rifa' anche se e' recente, e la decisione gia'
// presa su dati immutati si riporta sulla verifica nuova.
prepara([{ id: 'v1', id_pdr: 199, indirizzo_portale: 'V.le Berlinguer, 34', indirizzo_trovato: 'Viale Berlinguer 34', verificato_il: '2026-10-05', esito: 'coincide', stato: 'confermato_portale', deciso_il: '2026-10-05', deciso_da: 'admin', superata: false }]);
globalThis.__RISPOSTE = [{ indirizzo: 'Viale Berlinguer, 34', comune: 'Bernalda', confidenza: 'media', fonti: ['https://elenco.example/marciuliano'] }];
const aMano = await chiama({ ids: [199], limite: 4, motivo: 'chiesto dalla scheda' });
const righeM = archivio('VerificaSedePdr');
verifica('chiesto a mano si rifa\'', aMano.body.controllati === 1 && righeM.length === 2, JSON.stringify(aMano.body));
verifica('la verifica precedente resta nello storico, marcata superata', righeM.find(v => v.id === 'v1').superata === true);
const nuovaM = righeM.find(v => v.id !== 'v1');
verifica('e la decisione gia\' presa si riporta, perche\' non e\' cambiato niente',
  nuovaM.stato === 'confermato_portale' && nuovaM.deciso_da === 'admin' && nuovaM.motivo_controllo === 'chiesto dalla scheda', JSON.stringify(nuovaM));

console.log('IL GOMMISTA CHE RINASCE CON UN\'ALTRA ANAGRAFICA');
// Il punto 199 e' adesso di un'altra azienda: il controllo vecchio non vale, e
// la sua decisione non deve passare a chi non c'entra niente.
globalThis.__ARCHIVI = {
  Pdr: [{ id: 'p9', id_pdr: 199, id_cliente: 900, ragione_sociale: 'NUOVA GOMME SRL', partita_iva: '09999999999', sede_legale: 'Via Nuova 7', indirizzo_pdr: 'Via Nuova 7', cap_pdr: '75012', comune_pdr: 'Bernalda', provincia_pdr: 'MT' }],
  Assegnato: [{ id: 'a9', id_pdr: 199, anno: 2026 }], AssegnatoAci: [],
  VerificaSedePdr: [{ id: 'v9', id_pdr: 199, ragione_sociale: 'Marciuliano Gomme snc', partita_iva: '01111111111', indirizzo_portale: 'V.le Berlinguer, 34', comune_portale: 'Bernalda', indirizzo_trovato: 'Viale Berlinguer 34', verificato_il: '2026-10-05', esito: 'coincide', stato: 'corretto', indirizzo_per_formulario: 'Viale Berlinguer 34', deciso_il: '2026-10-05', deciso_da: 'admin' }],
};
globalThis.__PROMPT = []; globalThis.__RUOLO = 'admin';
globalThis.__RISPOSTE = [{ indirizzo: 'Via Nuova 7', comune: 'Bernalda', confidenza: 'media', fonti: ['https://elenco.example/nuova'] }];
const rinato = await chiama({ anno: 2026, limite: 4 });
const nuovaRiga = archivio('VerificaSedePdr').find(v => v.id !== 'v9');
verifica('il punto passato a un altro soggetto si ricontrolla subito',
  rinato.body.controllati === 1 && /altro soggetto/.test(rinato.body.verifiche[0].motivo), JSON.stringify(rinato.body.verifiche));
verifica('e la decisione del soggetto di prima NON gli viene addosso',
  nuovaRiga && nuovaRiga.stato === 'da_decidere' && !nuovaRiga.indirizzo_per_formulario, JSON.stringify(nuovaRiga));

// Stesso soggetto, numero nuovo: la vecchia decisione si ritrova scritta accanto,
// ma non si applica da sola.
globalThis.__ARCHIVI = {
  Pdr: [{ id: 'p10', id_pdr: 39180, id_cliente: 901, ragione_sociale: 'Longo Pneumatici Snc', partita_iva: '03171111111', indirizzo_pdr: 'Via Nuova 7', cap_pdr: '88100', comune_pdr: 'Catanzaro', provincia_pdr: 'CZ' }],
  Assegnato: [{ id: 'a10', id_pdr: 39180, anno: 2026 }], AssegnatoAci: [],
  VerificaSedePdr: [{ id: 'v10', id_pdr: 308, ragione_sociale: 'LONGO FRANCESCO & FIGLI SNC', partita_iva: '03171111111', indirizzo_portale: 'Via Vecchia 1', comune_portale: 'Lamezia Terme', verificato_il: '2026-04-01', esito: 'diverso', stato: 'corretto', indirizzo_per_formulario: 'Zona Industriale 9', comune_per_formulario: 'Lamezia Terme', deciso_il: '2026-04-02', deciso_da: 'admin' }],
};
globalThis.__PROMPT = []; globalThis.__RUOLO = 'admin';
globalThis.__RISPOSTE = [{ indirizzo: 'Via Nuova 7', comune: 'Catanzaro', confidenza: 'media', fonti: ['https://elenco.example/longo'] }];
await chiama({ anno: 2026, limite: 4 });
const reiscritto = archivio('VerificaSedePdr').find(v => v.id_pdr === 39180);
verifica('al punto nuovo dello stesso soggetto si ricorda la decisione vecchia, senza applicarla',
  reiscritto && reiscritto.stato === 'da_decidere' && /punto di raccolta 308/.test(reiscritto.nota) && /Zona Industriale 9/.test(reiscritto.nota), JSON.stringify(reiscritto));
verifica('e la verifica dell\'altro punto resta com\'era, non viene superata',
  archivio('VerificaSedePdr').find(v => v.id === 'v10').superata !== true);

console.log('IL GIRO SI FA A SCAGLIONI');
prepara();
globalThis.__RISPOSTE = [{ indirizzo: '', fonti: [], confidenza: 'bassa' }];
const scaglione = await chiama({ anno: 2026, limite: 1 });
verifica('con limite 1 ne controlla uno e dice che ne resta un altro',
  scaglione.body.controllati === 1 && scaglione.body.restanti === 1, JSON.stringify(scaglione.body));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
