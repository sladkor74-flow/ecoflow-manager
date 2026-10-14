// LE VARIAZIONI DEL CONTRATTO A PAROLE, E LE GIACENZE CHE NON SI SOMMANO A ZERO
// (giro del 14/10/2026, gruppo E-2).
//
// L'utente, il 14/10/2026: «come variano gli altri moduli e sezioni di
// conseguenza considerando che il target è passato a 11.650 t nell'anno 2026?».
// La variazione del consorzio registrata nel contratto (100 t di ottobre in
// Puglia, variazioneDelContratto di attesoContratto.ts) muove gia' da se' target,
// mesi, regioni e atteso; ma EcoTyna, la dashboard e la card dell'Andamento
// dicevano solo 11.650 t, senza dire che 100 sono l'assegnazione di ottobre.
// Qui:
// 1. le parole, su contratti costruiti: EcoTyna (testoVariazioni), il quadro
//    della dashboard (quadroRete, fraseVariazioni, sottoVariazioni) e la card
//    (variazioniPerLaCard, notaVariazioni); una e due variazioni, una superata;
// 2. sulla copia dei dati veri dell'11/10/2026 con la variazione registrata solo
//    nella prova (come prove/variazioneContratto.mjs): EcoTyna
//    (situazioneGestionale), il quadro della dashboard (getDashboardRaccolta
//    intera, la sezione Rete disegnata) e la card dell'Andamento dicono la
//    variazione; senza variazioni i testi sono quelli di prima; una variazione
//    superata da un salvataggio non si dice come in vigore;
// 3. le giacenze di EcoTyna (punto 7 del gruppo D-K): un totale che non si fa e'
//    «RETE: —» col perche', non 0,00; l'impianto senza il file si riconosce dal
//    suo perche', non da una fotografia senza giorno; lo strumento giacenze passa
//    l'attesa per noi chiusa (T-Cycle 181,299 t verso Tecnogum) e, su un anno
//    prima del gestionale, nessun numero di giacenza; il perche' dell'anno una
//    volta sola, cosi' l'elenco dei siti arriva a EcoTyna intero (revisione del
//    14/10/2026). E il target mensile rivisto si nomina solo per le variazioni
//    che ci sono scritte (nel_mese).
// Senza la copia dei dati veri le parti 2 e 3 si saltano e lo dicono.
// node prove/variazioniAParole.mjs
import { build } from 'esbuild';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as A from '../base44/shared/attesoContratto.ts';
import * as E from '../base44/shared/assistente.ts';
import * as Q from '../base44/shared/quadroCommessa.ts';
import { STRUMENTI } from '../base44/shared/strumentiAssistente.ts';
import { testoDati } from '../base44/shared/pianoAssistente.ts';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
const fn = (mod, nome) => (typeof mod[nome] === 'function' ? mod[nome] : null);
const sorgente = (p) => (existsSync(qui('../' + p)) ? readFileSync(qui('../' + p), 'utf8').replace(/\r/g, '') : '');
const testo = (html) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/&#x27;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ');

// Le pagine: la sezione Rete della dashboard, le cifre del quadro e la card del
// target, disegnate con React lato server (come prove/dashboardPagina.mjs).
const CLIENT_FINTO = 'export const base44 = { functions: { invoke: async () => ({ data: {} }) }, entities: new Proxy({}, { get: () => ({ filter: async () => [] }) }) };';
const AUTH_FINTO = 'export const useAuth = () => ({ user: null });';
const ESTENSIONI = ['', '.js', '.jsx', '.ts'];
const daAlias = (p) => { const base = qui('../src/' + p.slice(2)); return ESTENSIONI.map(e => base + e).find(f => existsSync(f) && /\.\w+$/.test(f)) || base; };
const INGRESSO = `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import { MemoryRouter } from 'react-router-dom';
import SezioneRete from ${JSON.stringify(qui('../src/components/dashboard/SezioneRete.jsx'))};
import KpiCards from ${JSON.stringify(qui('../src/components/target-status/KpiCards.jsx'))};
export * as card from ${JSON.stringify(qui('../src/components/target-status/KpiCards.jsx'))};
export * as righe from ${JSON.stringify(qui('../src/components/dashboard/righeQuadro.js'))};
export * as atteso from ${JSON.stringify(qui('../src/lib/attesoContratto.js'))};
export const sezioneRete = (props) => renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(SezioneRete, props)));
export const kpiCards = (props) => renderToStaticMarkup(React.createElement(KpiCards, props));
`;
let P = null;
try {
  const pacchetto = await build({
    stdin: { contents: INGRESSO, resolveDir: qui('.'), loader: 'js' },
    bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent',
    loader: { '.jsx': 'jsx', '.js': 'jsx' }, define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'finti', setup(b) {
      b.onResolve({ filter: /^@\/api\/base44Client$/ }, () => ({ path: 'client', namespace: 'finti' }));
      b.onResolve({ filter: /^@\/lib\/AuthContext$/ }, () => ({ path: 'auth', namespace: 'finti' }));
      b.onLoad({ filter: /.*/, namespace: 'finti' }, (a) => ({ contents: a.path === 'auth' ? AUTH_FINTO : CLIENT_FINTO, loader: 'js' }));
      b.onResolve({ filter: /^@\// }, (args) => ({ path: daAlias(args.path) }));
    } }],
  });
  if (typeof globalThis.window === 'undefined') globalThis.window = { self: 1, top: 1, matchMedia: () => ({ matches: false, addListener() {}, removeListener() {} }) };
  P = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
} catch (e) { verifica('le pagine si impacchettano', false, String(e && e.message).slice(0, 400)); }

// Le regole nuove: se non ci sono, la prova lo dice qui e salta quello che le chiama.
const testoVariazioni = fn(E, 'testoVariazioni');
const totaleGiacenze = fn(E, 'totaleGiacenze');
const senzaFileDelPortale = fn(E, 'senzaFileDelPortale');
const fraseVariazioni = P && fn(P.righe, 'fraseVariazioni');
const sottoVariazioni = P && fn(P.righe, 'sottoVariazioni');
const variazioniPerLaCard = P && fn(P.card, 'variazioniPerLaCard');
const notaVariazioni = P && fn(P.card, 'notaVariazioni');
verifica('EcoTyna ha le parole delle variazioni e il totale delle giacenze del modulo (testoVariazioni, totaleGiacenze, senzaFileDelPortale)', !!(testoVariazioni && totaleGiacenze && senzaFileDelPortale), Object.keys(E).join(', '));
verifica('la dashboard ha le parole delle variazioni (fraseVariazioni, sottoVariazioni)', !!(fraseVariazioni && sottoVariazioni), P ? Object.keys(P.righe).join(', ') : 'pagine non caricate');
verifica('la card del target ha le sue (variazioniPerLaCard, notaVariazioni)', !!(variazioniPerLaCard && notaVariazioni), P ? Object.keys(P.card).join(', ') : 'pagine non caricate');

// Un contratto come quello del 2026 (prove/variazioneContratto.mjs).
const PROFILO = [851.29, 915.48, 868.47, 932.55, 1053.85, 1100, 1100, 550, 1050, 1100, 1100, 950];
const contratto = (extra = {}) => ({
  id: 'c26', anno: 2026, target_annuo_t: 11550,
  regioni_json: J([{ regione: 'Campania', target_t: 4400 }, { regione: 'Puglia', target_t: 2500 }, { regione: 'Sicilia', target_t: 4650 }]),
  target_mensile_json: J(PROFILO),
  destinazioni_json: J([{ destinazione: 'IRIGOM', target_t: 4450 }, { destinazione: 'T_CYCLE', target_t: 7100 }]),
  storico_json: J([{ il: '2026-09-14T17:35:58.203Z', da: 'Antonio', nota: 'importato dal foglio', prima: null }]),
  ...extra,
});
const OTTOBRE = { mese_idx: 9, regione: 'Puglia', t: 100, destinazione: 'IRIGOM', motivo: 'assegnazione del consorzio di ottobre', comunicata_il: '2026-10-14' };
const registra = (c, variazione, il) => {
  const v = A.variazioneDelContratto(c, variazione);
  return { ...c, ...v.patch, storico_json: A.storicoConVariazione(c.storico_json, { il, da: 'Antonio Castellano', voce: v.voce, prima: v.prima }) };
};
// Il foglio di inizio anno importato e salvato dopo la variazione: la riscrive (in_vigore falso).
const CAMPI = ['target_annuo_t', 'regioni_json', 'target_mensile_json', 'destinazioni_json'];
const riscritto = (dopo, prima, il = '2026-10-20T09:00:00.000Z') => ({
  ...dopo, ...Object.fromEntries(CAMPI.map(k => [k, prima[k]])),
  storico_json: J([...JSON.parse(dopo.storico_json), { il, da: 'Antonio Castellano', nota: 'importato da contratto-ecotyre.xlsx', prima: Object.fromEntries(CAMPI.map(k => [k, dopo[k]])) }]),
});
const LA_FRASE = 'ottobre, Puglia +100,00 t (assegnazione del consorzio di ottobre, comunicata il 14/10/2026)';

console.log('1. LE PAROLE, SU CONTRATTI COSTRUITI');
{
  const c = contratto();
  const una = registra(c, OTTOBRE, '2026-10-14T10:00:00.000Z');
  const due = registra(una, { ...OTTOBRE, mese_idx: 10, t: -30, destinazione: '', motivo: 'riduzione di novembre', comunicata_il: '2026-11-02' }, '2026-11-02T10:00:00.000Z');
  const superata = riscritto(una, c);
  const vigenti = (x) => A.variazioniDelContratto(x).filter(v => v.in_vigore);
  verifica('il contratto costruito: una variazione in vigore, poi due, poi superata', vigenti(una).length === 1 && vigenti(due).length === 2 && vigenti(superata).length === 0 && A.variazioniDelContratto(superata).length === 1, J([vigenti(una), vigenti(superata)]));

  if (testoVariazioni) {
    const t1 = testoVariazioni(vigenti(una), 2026, 11650);
    verifica('EcoTyna, una variazione: il mese, la regione, le tonnellate, il motivo e il giorno, e il target senza', t1.startsWith('Il contratto 2026 comprende una variazione del consorzio, registrata nella scheda Commessa Ecotyre: ' + LA_FRASE + '.')
      && t1.includes("Per questo il target annuo e' 11.650,00 t: senza, sarebbe 11.550,00 t.") && t1.includes('nel suo mese e nella sua regione'), t1);
    const t2 = testoVariazioni(vigenti(due), 2026, 11620);
    verifica('EcoTyna, due variazioni: in tutto +70,00 t, la seconda in meno, senza sarebbe 11.550,00 t', t2.includes('comprende 2 variazioni del consorzio, registrate nella scheda Commessa Ecotyre, in tutto +70,00 t: ' + LA_FRASE + '; novembre, Puglia -30,00 t (riduzione di novembre, comunicata il 02/11/2026).')
      && t2.includes('senza, sarebbe 11.550,00 t'), t2);
    verifica('EcoTyna, nessuna variazione o solo superate: niente', testoVariazioni([], 2026, 11550) === '' && testoVariazioni(A.variazioniDelContratto(superata), 2026, 11550) === '');
    // Il target mensile rivisto si nomina solo se la variazione ci e' scritta
    // (nel_mese; revisione del 14/10/2026, provaSenzaProfilo.mjs del revisore). Un
    // contratto senza profilo, come il 2027 prima che lo si inserisca: la
    // variazione va solo nel target annuo e nella regione.
    verifica('EcoTyna, col profilo: la variazione e\' anche nel target mensile rivisto', t1.includes('Sono gia\' nei numeri del contratto (target annuo, regione e target mensile rivisto)'), t1);
    const senzaProfilo = contratto({ target_mensile_json: undefined });
    const unaSenza = registra(senzaProfilo, OTTOBRE, '2026-10-14T10:00:00.000Z');
    const t3 = testoVariazioni(vigenti(unaSenza), 2026, 11650);
    verifica('EcoTyna, senza profilo (premessa: la variazione non e\' scritta nel mese)', vigenti(unaSenza).length === 1 && vigenti(unaSenza)[0].nel_mese === false && !('target_mensile_json' in unaSenza && unaSenza.target_mensile_json), J(vigenti(unaSenza)));
    verifica('EcoTyna, senza profilo: target annuo e regione, nessun target mensile rivisto', !/target mensile rivisto/.test(t3) && t3.includes('Sono gia\' nei numeri del contratto (target annuo e regione), che dashboard') && t3.includes(LA_FRASE) && t3.includes('senza, sarebbe 11.550,00 t'), t3);
    // Il profilo inserito dopo la prima: la seconda ci va, la prima no.
    const conProfiloDopo = { ...unaSenza, target_mensile_json: J(PROFILO.map((x, i) => (i === 9 ? x + 100 : x))) };
    const miste = registra(conProfiloDopo, { ...OTTOBRE, mese_idx: 10, t: -30, destinazione: '', motivo: 'riduzione di novembre', comunicata_il: '2026-11-02' }, '2026-11-02T10:00:00.000Z');
    const t4 = testoVariazioni(vigenti(miste), 2026, 11620);
    verifica('EcoTyna, una nel mese e una no: il target mensile rivisto solo per quella che ci e\' scritta', J(vigenti(miste).map(v => v.nel_mese)) === '[false,true]'
      && t4.includes('Sono gia\' nei numeri del contratto (target annuo e regione, e per novembre, Puglia anche il target mensile rivisto)'), `${J(vigenti(miste).map(v => v.nel_mese))} ${t4}`);
  }

  // Il quadro della dashboard: le variazioni in vigore, senza chi le ha registrate.
  const kpi = (com) => ({ raccolto_rete_anno: 8818.55, raggiungimento_pct: 75, target: A.targetAnnuoDellAnno(com, 2026).t, atteso: null, target_ripiego: [], target_da_confermare: [] });
  const rete = (com) => Q.quadroRete({ anno: 2026, oggi: '2026-10-11', giornoDati: '2026-10-08', commessa: com, kpi: kpi(com), reteAnno: [], rete: [], mensili: [], annui: [] });
  verifica('il quadro della rete porta le variazioni in vigore', J(rete(una).variazioni) === J([{ mese_idx: 9, mese: 'Ottobre', regione: 'Puglia', t: 100, destinazione: 'IRIGOM', motivo: 'assegnazione del consorzio di ottobre', comunicata_il: '2026-10-14' }]), J(rete(una).variazioni));
  verifica('e nessuna senza variazioni, ne\' quella superata', J(rete(c).variazioni) === '[]' && J(rete(superata).variazioni) === '[]', J([rete(c).variazioni, rete(superata).variazioni]));
  verifica('chi l\'ha registrata non esce nel quadro, che vede chiunque', rete(una).variazioni && !J(rete(una).variazioni).includes('Antonio'));

  if (fraseVariazioni && sottoVariazioni && P) {
    const r1 = rete(una), r2 = rete(due);
    const f1 = fraseVariazioni(r1, 2026);
    verifica('la dashboard, una variazione: la frase del perche\'', f1.startsWith(`Il contratto 2026 comprende una variazione del consorzio: ${LA_FRASE}. Senza, il target sarebbe 11.550,00 t.`) && f1.includes('nel suo mese e nella sua regione'), f1);
    verifica('e la riga sotto il target', sottoVariazioni(r1) === 'compresa la variazione del consorzio di ottobre in Puglia (+100,00 t)', sottoVariazioni(r1));
    const f2 = fraseVariazioni(r2, 2026);
    verifica('la dashboard, due variazioni: in tutto +70,00 t, la seconda col segno meno', f2.includes('comprende 2 variazioni del consorzio, in tutto +70,00 t: ' + LA_FRASE + '; novembre, Puglia −30,00 t (riduzione di novembre, comunicata il 02/11/2026). Senza, il target sarebbe 11.550,00 t.')
      && sottoVariazioni(r2) === 'comprese 2 variazioni del consorzio (+70,00 t)', `${f2} | ${sottoVariazioni(r2)}`);
    verifica('senza variazioni niente frase, e la cifra del target e\' quella di prima', fraseVariazioni(rete(c), 2026) === '' && sottoVariazioni(rete(superata)) === ''
      && J(P.righe.cifreRete(rete(c))[0]) === J({ etichetta: 'Target annuo del contratto', valore: '11.550,00 t', sotto: 'il contratto Ecotyre in Target & Status' }), J(P.righe.cifreRete(rete(c))[0]));
    const cifra = P.righe.cifreRete(r1)[0];
    verifica('la cifra del target: la riga sotto (va anche nel PDF) e la frase nel perche\'', cifra.valore === '11.650,00 t' && cifra.sotto === 'il contratto Ecotyre in Target & Status, compresa la variazione del consorzio di ottobre in Puglia (+100,00 t)' && cifra.perche === fraseVariazioni(r1), J(cifra));
    verifica('un anno senza contratto non ha variazioni da dire', fraseVariazioni({ target_t: null, variazioni: r1.variazioni }) === '' && sottoVariazioni({ target_t: null, variazioni: r1.variazioni }) === '');
  }

  if (variazioniPerLaCard && notaVariazioni && P) {
    const daCard = (com) => variazioniPerLaCard(P.atteso.variazioniDelContratto(com).filter(v => v.in_vigore), P.atteso.targetAnnuoDellAnno(com, 2026).t);
    verifica('la card: le variazioni del contratto della pagina', J(daCard(una)) === J({ quante: 1, t: 100, senza_t: 11550, voci: [{ mese: 'Ottobre', regione: 'Puglia', t: 100 }] }) && daCard(c) === null && daCard(superata) === null, J([daCard(una), daCard(c), daCard(superata)]));
    verifica('la nota della card, una e due variazioni', notaVariazioni(daCard(una)) === 'Compresa la variazione del consorzio (+100,00 t di ottobre in Puglia): senza, sarebbe 11.550,00 t. Il dettaglio è sotto la tabella per regione.'
      && notaVariazioni(daCard(due)) === 'Comprese le 2 variazioni del consorzio (in tutto +70,00 t): senza, sarebbe 11.550,00 t. Il dettaglio è sotto la tabella per regione.' && notaVariazioni(null) === '', `${notaVariazioni(daCard(una))} | ${notaVariazioni(daCard(due))}`);
  }
}

console.log('3a. LE GIACENZE DI ECOTYNA, SU RIGHE COSTRUITE');
if (totaleGiacenze && senzaFileDelPortale) {
  const { PERCHE_SENZA_FOTOGRAFIA, PERCHE_ANNO_PRIMA_DEL_GESTIONALE, totaleDellaColonna } = await import('../base44/shared/giacenzaPortale.ts');
  const imp = (sito, t, extra = {}) => ({ sito, tipo_destinazione: 'imp', giacenza_portale_t: t, giacenza_rete_t: t, giacenza_aci_t: 0, giacenza_extra_t: 0, fotografia: { del: '2026-10-09' }, ...extra });
  const senzaFile = imp('ALFA SRL', null, { fotografia: { del: null }, perche_senza_giacenza: PERCHE_SENZA_FOTOGRAFIA });
  const prima = imp('BETA SRL', null, { fotografia: null, giacenza_aci_t: null, giacenza_extra_t: null, perche_senza_giacenza: PERCHE_ANNO_PRIMA_DEL_GESTIONALE(2025), perche_canali: { ACI: PERCHE_ANNO_PRIMA_DEL_GESTIONALE(2025), EXTRA_RACCOLTA: PERCHE_ANNO_PRIMA_DEL_GESTIONALE(2025) } });
  const chiuso = imp('GAMMA SRL', null, { fotografia: { del: null, lettura_del_trentuno: true }, perche_senza_giacenza: 'Il 2025 e\' chiuso: ...' });
  const accordo = imp('TECNOGUM SRL', null, { rete_non_dovuta: true, fotografia: { del: null } });
  const vecchia = imp('DELTA SRL', 0, { fotografia: { del: '' } });
  verifica('senza il file: solo chi ha il perche\' del file (o, in una risposta di prima, nessuna fotografia)', senzaFileDelPortale(senzaFile) && !senzaFileDelPortale(prima) && !senzaFileDelPortale(chiuso) && !senzaFileDelPortale(accordo) && senzaFileDelPortale(vecchia) && !senzaFileDelPortale(imp('X', 3)),
    J([senzaFile, prima, chiuso, accordo, vecchia].map(senzaFileDelPortale)));
  const righe = [imp('IRIGOM', 652.84), senzaFile, accordo, { sito: 'NAPPI SUD', tipo_destinazione: 'stoc', giacenza_portale_t: 25.88, giacenza_aci_t: 3, giacenza_extra_t: null }];
  const tr = totaleGiacenze(righe, 'RETE');
  verifica('il totale della rete con un impianto senza il file: «—» col perche\' del modulo, uguale a totaleDellaColonna', tr.t === null && tr.perche === totaleDellaColonna([{ sito: 'IRIGOM', t: 652.84 }, { sito: 'ALFA SRL', t: null, perche: PERCHE_SENZA_FOTOGRAFIA }, { sito: 'TECNOGUM SRL', t: null }, { sito: 'NAPPI SUD (piazzale)', t: 25.88 }]).perche, J(tr));
  verifica('senza buchi il totale c\'e\', e la rete per accordo non manca', totaleGiacenze([imp('IRIGOM', 652.84), accordo, { sito: 'NAPPI SUD', tipo_destinazione: 'stoc', giacenza_portale_t: 25.88 }], 'RETE').t === 678.72);
  verifica('l\'extra raccolta di un piazzale che non ne ha non manca; l\'ACI di un piazzale senza lettura si', totaleGiacenze(righe, 'EXTRA_RACCOLTA').t === 0
    && totaleGiacenze([{ sito: 'NAPPI SUD', tipo_destinazione: 'stoc', giacenza_portale_t: null, giacenza_aci_t: null, perche_senza_giacenza: 'Questo piazzale non ha nessuna rilevazione del portale.' }], 'ACI').t === null);

  // Il riepilogo della commessa con quelle righe: la funzione delle giacenze finta.
  const { PERCHE_TOTALE_SENZA_RIGHE } = await import('../base44/shared/giacenzaPortale.ts');
  const vuoto = { asServiceRole: { entities: new Proxy({}, { get: () => ({ filter: async () => [], list: async () => [] }) }) } };
  const conGiacenze = (risposta) => ({ ...vuoto, functions: { invoke: async (n) => { if (n !== 'calcolaGiacenze') throw new Error('non disponibile: ' + n); return { data: risposta }; } } });
  const rigaGiacenze = (t) => String(t).split('\n').find(r => r.startsWith('Giacenze per canale')) || '';
  const percheRete = PERCHE_TOTALE_SENZA_RIGHE(['ALFA SRL'], PERCHE_SENZA_FOTOGRAFIA);
  const t1 = await E.situazioneGestionale(conGiacenze({ righe, totali: { giacenza_portale_t: null, perche_totali: { RETE: percheRete } }, anomalie: [] }), '2026-10-11');
  verifica('EcoTyna: «RETE: —» col perche\' del modulo, mai «RETE 0,00 t»', rigaGiacenze(t1).startsWith(`Giacenze per canale, tre totali distinti: RETE: — (non e' zero: ${percheRete})`) && !/RETE 0,00 t/.test(t1), rigaGiacenze(t1));
  const prima25 = [prima, { ...prima, sito: 'IRIGOM' }, { sito: 'NAPPI SUD', tipo_destinazione: 'stoc', giacenza_portale_t: null, giacenza_rete_t: null, giacenza_aci_t: null, giacenza_extra_t: null, perche_senza_giacenza: 'Il 2025 e\' chiuso e questo piazzale non ha una lettura...', perche_canali: { ACI: 'Il 2025 e\' chiuso e questo piazzale non ha una lettura...' } }];
  const t2 = await E.situazioneGestionale(conGiacenze({ righe: prima25, totali: { giacenza_portale_t: null, giacenza_aci_t: null, prima_del_gestionale: true, perche_prima_del_gestionale: PERCHE_ANNO_PRIMA_DEL_GESTIONALE(2025) }, anomalie: [] }), '2026-10-11');
  verifica('un anno prima del gestionale: il perche\' dell\'anno, e nessuno «senza il file»', rigaGiacenze(t2).includes("RETE: — (non e' zero: Il 2025 e' prima del gestionale") && !/senza il file degli ordini non dichiarati:/.test(rigaGiacenze(t2))
    && /ACI: impianti —, stoccaggi — \(non e' zero: Il 2025 e' prima del gestionale/.test(rigaGiacenze(t2)), rigaGiacenze(t2));
  const t3 = await E.situazioneGestionale(conGiacenze({ righe: [imp('IRIGOM', 652.84), accordo], totali: { giacenza_portale_t: 652.84 }, anomalie: [] }), '2026-10-11');
  verifica('con il totale, come prima: «RETE 652,84 t; ACI: impianti 0,00 t, stoccaggi 0,00 t»', rigaGiacenze(t3).startsWith('Giacenze per canale, tre totali distinti: RETE 652,84 t; ACI: impianti 0,00 t, stoccaggi 0,00 t; EXTRA RACCOLTA: impianti 0,00 t (arrivata e non ancora dichiarata), stoccaggi 0,00 t (in piazzale).'), rigaGiacenze(t3));
}

const CARTELLA = process.env.DATI_VERI || qui('../../dati-veri/');
const copie = existsSync(CARTELLA) ? readdirSync(CARTELLA).filter(n => /^treadrider-dati-veri-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n)).sort() : [];
if (!copie.length) {
  console.log(`2. e 3b. Nessuna copia dei dati veri in ${CARTELLA}: parti saltate.`);
} else {
  const copia = copie[copie.length - 1];
  const DATI = JSON.parse(gunzipSync(readFileSync(CARTELLA + copia)).toString('utf8'));
  const ORA = DATI.meta.letto_fino_al;
  const OGGI = String(ORA).slice(0, 10);
  const ANNO = 2026;
  const DELL_11_10 = copia === 'treadrider-dati-veri-2026-10-11.json.gz';
  console.log(`  Copia: ${copia}, letta il ${ORA}`);
  globalThis.__DATI_VERI = { ...DATI.archivi };
  const SDK_FINTO = `
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => {
  const x = r[k];
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    if ('$in' in v && !v.$in.includes(x)) return false;
    if ('$nin' in v && v.$nin.includes(x)) return false;
    if ('$gte' in v && !(x != null && String(x) >= String(v.$gte))) return false;
    if ('$lte' in v && !(x != null && String(x) <= String(v.$lte))) return false;
    if ('$gt' in v && !(x != null && String(x) > String(v.$gt))) return false;
    if ('$lt' in v && !(x != null && String(x) < String(v.$lt))) return false;
    if ('$ne' in v && x === v.$ne) return false;
    return true;
  }
  if (v === null) return x === null || x === undefined || x === '';
  return x === v;
});
const ordina = (righe, sort) => { const campo = String(sort || 'id').replace(/^[-+]/, ''); const giu = String(sort || '').startsWith('-');
  return [...righe].sort((a, b) => { const x = a[campo], y = b[campo]; if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y)); return giu ? -c : c; }); };
const entita = (nome) => ({
  list: async (sort, lim = 1e9, skip = 0) => ordina(globalThis.__DATI_VERI[nome] || [], sort).slice(skip, skip + lim),
  filter: async (f, sort, lim = 1e9, skip = 0) => ordina((globalThis.__DATI_VERI[nome] || []).filter(r => soddisfa(r, f)), sort).slice(skip, skip + lim),
  get: async (id) => (globalThis.__DATI_VERI[nome] || []).find(r => r.id === id) || null,
  create: async (r) => r, update: async (_id, r) => r, bulkCreate: async (r) => r, delete: async () => ({}),
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
export const sdk = { auth: { me: async () => ({ role: 'admin', email: 'prova' }) }, asServiceRole: { entities }, entities,
  functions: { invoke: async (n, corpo) => ({ data: await globalThis.__FUNZIONI_VERE[n](corpo) }) } };
export function createClientFromRequest() { return sdk; }`;
  const plug = { name: 'sdk-finto', setup(b) {
    b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
    b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
  } };
  const modulo = async (opzioni) => import('data:text/javascript;base64,' + Buffer.from((await build({ bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent', plugins: [plug], ...opzioni })).outputFiles[0].text).toString('base64'));
  const dashboard = await modulo({ entryPoints: [qui('../base44/functions/getDashboardRaccolta/entry.ts')] });
  const giacenze = await modulo({ entryPoints: [qui('../base44/functions/calcolaGiacenze/entry.ts')] });
  const riepilogo = await modulo({ entryPoints: [qui('../base44/functions/riepilogoDichiarazioni/entry.ts')] });
  const { sdk } = await modulo({ stdin: { contents: SDK_FINTO, loader: 'js' } });
  // Il riepilogo e gli strumenti di EcoTyna: giacenze e dichiarazioni chiedono le funzioni vere.
  globalThis.__FUNZIONI_VERE = {
    calcolaGiacenze: async (corpo) => (await giacenze.default({ json: async () => corpo })).json(),
    riepilogoDichiarazioni: async (corpo) => (await riepilogo.default({ json: async () => corpo })).json(),
  };
  const OraVera = Date;
  const conOra = async (f) => {
    const ms = OraVera.parse(ORA);
    globalThis.Date = class extends OraVera { constructor(...a) { if (a.length) super(...a); else super(ms); } static now() { return ms; } };
    try { return await f(); } finally { globalThis.Date = OraVera; }
  };

  // I tre contratti: quello della copia, con la variazione di ottobre in Puglia
  // registrata come la registra la finestra, e poi riscritto dal foglio di
  // inizio anno salvato dopo (la variazione superata).
  const vero = (DATI.archivi.CommessaEcotyre || []).filter(c => Number(c.anno) === ANNO).sort((a, b) => String(b.updated_date).localeCompare(String(a.updated_date)))[0];
  const nuovo = { ...registra(vero, OTTOBRE, '2026-10-14T10:00:00.000Z'), updated_date: '2026-10-14T10:00:00.000000' };
  const superata = { ...riscritto(nuovo, vero), updated_date: '2026-10-20T09:00:00.000000' };
  console.log('2. SULLA COPIA DEI DATI VERI: ECOTYNA, LA DASHBOARD E LA CARD');
  verifica('il contratto della copia non ha variazioni; con quella di ottobre 11.650 t; riscritto torna a 11.550 e la variazione e\' superata',
    A.variazioniDelContratto(vero).length === 0 && Number(nuovo.target_annuo_t) === 11650 && A.variazioniDelContratto(nuovo)[0].in_vigore === true
    && Number(superata.target_annuo_t) === Number(vero.target_annuo_t) && A.variazioniDelContratto(superata)[0].in_vigore === false, J([vero.target_annuo_t, nuovo.target_annuo_t, superata.target_annuo_t]));
  const conContratto = async (commessa) => {
    globalThis.__DATI_VERI.CommessaEcotyre = [commessa];
    const d = await conOra(async () => (await dashboard.default({ json: async () => ({ anno: [ANNO] }) })).json());
    const eco = await conOra(() => E.situazioneGestionale(sdk, OGGI));
    return { d, eco };
  };
  const R = { vero: await conContratto(vero), nuovo: await conContratto(nuovo), superata: await conContratto(superata) };
  globalThis.__DATI_VERI.CommessaEcotyre = DATI.archivi.CommessaEcotyre;
  const righeDi = (t) => String(t).split('\n');
  const dopoContratto = (t) => { const r = righeDi(t); const i = r.findIndex(x => x.startsWith('Contratto Ecotyre')); return i < 0 ? '' : r[i + 1] || ''; };
  const riga = (t, inizio) => righeDi(t).find(r => r.startsWith(inizio)) || '';

  // ECOTYNA
  verifica('EcoTyna, il contratto della copia: nessuna parola di variazioni, e dopo il contratto le regioni come prima', !/variazion/i.test(R.vero.eco) && dopoContratto(R.vero.eco).startsWith('- ') && /^- Puglia: contratto 2\.500,00 t, raccolto /.test(riga(R.vero.eco, '- Puglia:')), dopoContratto(R.vero.eco));
  verifica('EcoTyna con la variazione: la riga sotto il contratto la dice, e dice il target senza',
    /target annuo 11\.650,00 t/.test(riga(R.nuovo.eco, 'Contratto Ecotyre')) && dopoContratto(R.nuovo.eco) === `  ${testoVariazioni ? testoVariazioni(A.variazioniDelContratto(nuovo), ANNO, 11650) : '?'}`
    && dopoContratto(R.nuovo.eco).includes(LA_FRASE) && dopoContratto(R.nuovo.eco).includes("senza, sarebbe 11.550,00 t"), dopoContratto(R.nuovo.eco));
  verifica('e la Puglia dice quanto del suo contratto e\' variazione; le altre regioni come prima', /^- Puglia: contratto 2\.600,00 t \(di cui \+100,00 t di variazioni del consorzio\), raccolto /.test(riga(R.nuovo.eco, '- Puglia:'))
    && ['Campania', 'Basilicata', 'Calabria', 'Sicilia'].every(r => riga(R.vero.eco, `- ${r}:`) && riga(R.vero.eco, `- ${r}:`) === riga(R.nuovo.eco, `- ${r}:`)), riga(R.nuovo.eco, '- Puglia:'));
  verifica('EcoTyna con la variazione superata: non la dice in vigore, dice che non e\' piu\' nel contratto',
    !/comprende una variazione/.test(R.superata.eco) && /target annuo 11\.550,00 t/.test(riga(R.superata.eco, 'Contratto Ecotyre'))
    && dopoContratto(R.superata.eco) === `  Una variazione registrata non e' piu' nel contratto: un salvataggio dopo ne ha riscritto i numeri, vale il contratto scritto e non conta (${LA_FRASE}).`
    && /^- Puglia: contratto 2\.500,00 t, raccolto /.test(riga(R.superata.eco, '- Puglia:')), dopoContratto(R.superata.eco));
  verifica('fuori dal contratto e dalla Puglia il riepilogo e\' lo stesso nei tre casi', (() => {
    const resto = (t) => righeDi(t).filter(r => !r.startsWith('Contratto Ecotyre') && !r.startsWith('  ') && !r.startsWith('- Puglia:')).join('\n');
    return resto(R.vero.eco) === resto(R.nuovo.eco) && resto(R.vero.eco) === resto(R.superata.eco);
  })());

  // LA DASHBOARD
  const rq = (x) => (x.d.quadro && x.d.quadro.rete) || {};
  verifica('la dashboard risponde nei tre casi', R.vero.d.quadro && R.nuovo.d.quadro && R.superata.d.quadro, J([R.vero.d.error, R.nuovo.d.error, R.superata.d.error]));
  verifica('il quadro: la variazione solo col contratto che la comprende', J(rq(R.nuovo).variazioni) === J([{ mese_idx: 9, mese: 'Ottobre', regione: 'Puglia', t: 100, destinazione: 'IRIGOM', motivo: 'assegnazione del consorzio di ottobre', comunicata_il: '2026-10-14' }])
    && J(rq(R.vero).variazioni) === '[]' && J(rq(R.superata).variazioni) === '[]', J([rq(R.vero).variazioni, rq(R.nuovo).variazioni, rq(R.superata).variazioni]));
  if (P) {
    const sezione = (x) => testo(P.sezioneRete({ quadro: x.d.quadro, arretrato: null, annoInCorso: true }));
    const sv = sezione(R.nuovo);
    verifica('la sezione Rete con la variazione: 11.650,00 t e, sotto, la variazione di ottobre in Puglia', sv.includes('Target annuo del contratto 11.650,00 t il contratto Ecotyre in Target & Status, compresa la variazione del consorzio di ottobre in Puglia (+100,00 t)'), (sv.match(/Target annuo del contratto.{0,160}/) || [''])[0]);
    verifica('senza variazioni, e con quella superata, la sezione Rete come prima', !/variazion/i.test(sezione(R.vero)) && !/variazion/i.test(sezione(R.superata)) && sezione(R.vero).includes('Target annuo del contratto 11.550,00 t il contratto Ecotyre in Target & Status Raccolto'),
      (sezione(R.vero).match(/Target annuo del contratto.{0,120}/) || [''])[0]);
    if (fraseVariazioni) {
      const f = fraseVariazioni(rq(R.nuovo), ANNO);
      verifica('il perche\' del target dice la variazione e il target senza', f.startsWith(`Il contratto 2026 comprende una variazione del consorzio: ${LA_FRASE}. Senza, il target sarebbe 11.550,00 t.`) && P.righe.cifreRete(rq(R.nuovo))[0].perche === fraseVariazioni(rq(R.nuovo)), f);
    }
    // LA CARD DELL'ANDAMENTO: le variazioni come le calcola la pagina (TargetStatus.jsx, kpis).
    const pagina = sorgente('src/pages/TargetStatus.jsx');
    verifica('Target & Status passa alla card le variazioni in vigore del contratto della pagina', /variazioni: contratto\.fonte === 'contratto' \? variazioniPerLaCard\(variazioniDelContratto\(commessa\)\.filter\(v => v\.in_vigore\), contratto\.t\) : null,/.test(pagina)
      && /import KpiCards, \{ variazioniPerLaCard \} from '@\/components\/target-status\/KpiCards';/.test(pagina));
    const card = (com) => {
      const ct = P.atteso.targetAnnuoDellAnno(com, ANNO);
      const variazioni = variazioniPerLaCard ? (ct.fonte === 'contratto' ? variazioniPerLaCard(P.atteso.variazioniDelContratto(com).filter(v => v.in_vigore), ct.t) : null) : undefined;
      const kpis = { targetAnnuoTotale: ct.t, fonteTarget: ct.fonte, targetDaConfermare: ct.da_confermare, variazioni, raccoltoTotale: 8818.55, residuoAnno: ct.t - 8818.55, scartoMese: 12, attesoMese: 100, mesiScarto: ['Ottobre'], filtriScarto: [], conFiltri: false, giornoDati: '2026-10-08' };
      return testo(P.kpiCards({ kpis, anno: ANNO }));
    };
    verifica('la card del target con la variazione', card(nuovo).includes('11.650,00 t Target annuo del contratto Dal contratto Ecotyre, canale RETE. Compresa la variazione del consorzio (+100,00 t di ottobre in Puglia): senza, sarebbe 11.550,00 t. Il dettaglio è sotto la tabella per regione.'), (card(nuovo).match(/.{0,30}Target annuo del contratto.{0,200}/) || [''])[0]);
    verifica('la card senza variazioni e con quella superata: come prima', card(vero).includes('11.550,00 t Target annuo del contratto Dal contratto Ecotyre, canale RETE. 8.818,55') && card(superata) === card(vero), (card(superata).match(/.{0,30}Target annuo del contratto.{0,120}/) || [''])[0]);
  }

  console.log('3b. LE GIACENZE DI ECOTYNA SUI DATI VERI');
  const strumento = STRUMENTI.find(s => s.nome === 'giacenze');
  const G26 = await conOra(() => globalThis.__FUNZIONI_VERE.calcolaGiacenze({ anno: ANNO }));
  const s26 = (await conOra(() => strumento.esegui(sdk, { anno: ANNO }))).dati;
  const tcStoc = s26.siti.righe.find(r => /t-cycle/i.test(r.sito) && r.tipo === 'stoccaggio') || {};
  const moduloTc = (G26.righe || []).find(r => /t-cycle/i.test(r.sito) && r.tipo_destinazione === 'stoc') || {};
  verifica('lo strumento: lo stoccaggio di T-Cycle porta l\'attesa per noi chiusa e il perche\' del modulo', moduloTc.in_attesa_chiusa_t > 0 && tcStoc.in_attesa_chiusa_t === moduloTc.in_attesa_chiusa_t && tcStoc.in_attesa_chiusa_perche === moduloTc.in_attesa_chiusa_perche && /TECNOGUM/.test(tcStoc.in_attesa_chiusa_perche || ''),
    J([moduloTc.in_attesa_chiusa_t, tcStoc.in_attesa_chiusa_t, tcStoc.in_attesa_chiusa_perche]));
  const rete26 = s26.totali.rete;
  verifica('e il totale: l\'attesa del portale resta, accanto la parte chiusa e quella da risolvere', rete26.in_attesa_chiusa_t === G26.totali.in_attesa_chiusa_t && Math.round((rete26.in_attesa_dichiarazione_t - rete26.in_attesa_chiusa_t) * 1000) / 1000 === rete26.in_attesa_da_risolvere_t
    && /non chiamarla un'attesa da risolvere/.test(s26.totali.nota_totali), J(rete26));
  verifica('la giacenza della rete dello strumento e\' quella del modulo', rete26.giacenza_t === G26.totali.giacenza_portale_t, `${rete26.giacenza_t} / ${G26.totali.giacenza_portale_t}`);
  if (DELL_11_10) {
    verifica('sulla copia dell\'11/10: T-Cycle 181,299 t chiuse, 860,099 da risolvere su 1.041,398, la rete 1.643,10 t', tcStoc.in_attesa_chiusa_t === 181.299 && rete26.in_attesa_chiusa_t === 181.299 && rete26.in_attesa_da_risolvere_t === 860.099 && rete26.in_attesa_dichiarazione_t === 1041.398 && rete26.giacenza_t === 1643.1, J(rete26));
    verifica('e il riepilogo della commessa dice la rete come prima: «RETE 1.643,10 t»', riga(R.vero.eco, 'Giacenze per canale').startsWith('Giacenze per canale, tre totali distinti: RETE 1.643,10 t; ACI: impianti 0,00 t, stoccaggi 0,00 t;'), riga(R.vero.eco, 'Giacenze per canale'));
  }
  for (const anno of [2025, 2024]) {
    const G = await conOra(() => globalThis.__FUNZIONI_VERE.calcolaGiacenze({ anno }));
    const s = (await conOra(() => strumento.esegui(sdk, { anno }))).dati;
    const t = s.totali;
    verifica(`${anno}, anno prima del gestionale: il modulo dice «—» (premessa)`, G.totali.prima_del_gestionale === true && G.totali.giacenza_portale_t === null, J(G.totali.giacenza_portale_t));
    verifica(`${anno}: lo strumento non da\' numeri di giacenza (rete, ACI, impianti), e dice perche'`, t.prima_del_gestionale === true && t.rete.giacenza_t === null && t.rete.di_cui_impianti_t === null && t.aci.giacenza_impianti_t === null && t.extra_raccolta.impianti_t === null
      && /prima del gestionale/.test(t.rete.perche_totale || '') && (s.avviso_anno || '').startsWith(G.totali.perche_prima_del_gestionale) && s.siti.righe.every(r => r.giacenza_rete_t === null), J(t.rete));
    verifica(`${anno}: nessun impianto «senza il file del portale», nessuna riga che dica di caricare il file`, !t.rete.impianti_senza_file_del_portale_esclusi && !J(s.siti.righe).includes('Va caricato il file')
      && s.siti.righe.filter(r => r.tipo === 'impianto').every(r => /prima del gestionale/.test((r.calcolo && r.calcolo.avviso) || '')), J(t.rete.impianti_senza_file_del_portale_esclusi));
    // IL PERCHE' DELL'ANNO DETTO UNA VOLTA (revisione del 14/10/2026,
    // provaElencoTagliato.mjs del revisore). Ripetuto per ACI ed extra raccolta su
    // ogni impianto, la risposta passava il limite del prompt (24.000 caratteri) e
    // l'elenco dei siti arrivava a EcoTyna tagliato a 8 righe: sparivano meta' dei
    // siti coi loro conferiti. L'elenco deve arrivare intero; il perche' dell'anno
    // sta in avviso_anno e le righe ci rimandano; un piazzale senza la lettura che
    // apra l'anno dice il suo perche' una volta, in calcolo.avviso.
    const percheAnno = G.totali.perche_prima_del_gestionale;
    const blocco = testoDati([{ strumento: 'giacenze', parametri: { anno }, fonte: 'Giacenze', periodo: `anno ${anno}`, dati_al: OGGI, dati: s }]);
    verifica(`${anno}: l'elenco dei siti arriva a EcoTyna intero (${s.siti.quanti} siti)`, !/ELENCO TAGLIATO/.test(blocco) && s.siti.righe.length === s.siti.quanti && s.siti.quanti === (G.righe || []).length,
      `${J(s).length} caratteri; ${(blocco.match(/qui ci sono \d+ righe delle \d+ totali/) || ['intero'])[0]}`);
    verifica(`${anno}: il perche' dell'anno una volta sola (avviso_anno), le righe ci rimandano`, J(s).split(percheAnno.slice(0, 60)).length - 1 === 1
      && s.siti.righe.filter(r => r.tipo === 'impianto').every(r => r.perche_canali && /\(il perche' e' in avviso_anno\)/.test(r.perche_canali.ACI) && /\(il perche' e' in avviso_anno\)/.test(r.perche_canali.EXTRA_RACCOLTA)),
      J(s.siti.righe.filter(r => r.tipo === 'impianto').map(r => r.perche_canali)).slice(0, 300));
    const piazzaliSenzaInizio = (G.righe || []).filter(r => r.tipo_destinazione === 'stoc' && r.perche_canali && r.perche_canali.ACI && r.perche_canali.ACI === r.perche_senza_giacenza);
    // Sulla copia dell'11/10 sono cinque per anno (Irigom, Nappi Sud, Green Tyre, Gatim, T-Cycle).
    verifica(`${anno}: un piazzale senza la lettura che apra l'anno dice il perche' in calcolo.avviso, e l'ACI ci rimanda`, (!DELL_11_10 || piazzaliSenzaInizio.length > 0) && piazzaliSenzaInizio.every(m => {
      const r = s.siti.righe.find(x => x.sito === m.sito && x.tipo === 'stoccaggio');
      return r && r.calcolo.avviso === m.perche_senza_giacenza && /e' in calcolo\.avviso/.test(r.perche_canali.ACI) && r.perche_canali.ACI.length < 120;
    }), `${piazzaliSenzaInizio.length} piazzali`);
    // E i totali restano quelli del modulo: il rimando e' solo nelle righe passate a EcoTyna.
    verifica(`${anno}: i totali dicono ancora «—» col rimando all'anno`, t.aci.giacenza_impianti_t === null && /avviso_anno/.test(t.aci.perche_totale || '') && /avviso_anno/.test(t.extra_raccolta.perche_totale || ''), J([t.aci, t.extra_raccolta]));
  }
  // Lo strumento delle dichiarazioni: sull'anno prima del gestionale il perche' della pagina, sull'anno in corso niente.
  const dichiarazioni = STRUMENTI.find(x => x.nome === 'riepilogo_dichiarazioni');
  const d25 = (await conOra(() => dichiarazioni.esegui(sdk, { anno: 2025 }))).dati;
  const d26 = (await conOra(() => dichiarazioni.esegui(sdk, { anno: ANNO }))).dati;
  verifica('riepilogo_dichiarazioni sul 2025: il perche\' dell\'anno prima del gestionale, e nessun resto', /^Il 2025 e' prima del gestionale/.test(d25.avviso_anno || '') && J(d25.resta_per_canale_t) === '{}' && !('avviso_anno' in d26),
    J([d25.avviso_anno, d25.resta_per_canale_t, d26.avviso_anno]));

  // Il file degli ordini non dichiarati che non c'e': il totale della rete non si fa.
  globalThis.__DATI_VERI.OrdineNonDichiarato = [];
  const Gsenza = await conOra(() => globalThis.__FUNZIONI_VERE.calcolaGiacenze({ anno: ANNO }));
  const sSenza = (await conOra(() => strumento.esegui(sdk, { anno: ANNO }))).dati;
  const ecoSenza = await conOra(() => E.situazioneGestionale(sdk, OGGI));
  globalThis.__DATI_VERI.OrdineNonDichiarato = DATI.archivi.OrdineNonDichiarato;
  const percheModulo = (Gsenza.totali.perche_totali || {}).RETE || '';
  verifica('senza il file del portale il modulo non fa il totale della rete (premessa)', Gsenza.totali.giacenza_portale_t === null && /non (ha|hanno) il numero/.test(percheModulo), J([Gsenza.totali.giacenza_portale_t, percheModulo]));
  verifica('EcoTyna: «RETE: —» col perche\' del modulo, mai «RETE 0,00 t»', riga(ecoSenza, 'Giacenze per canale').startsWith(`Giacenze per canale, tre totali distinti: RETE: — (non e' zero: ${percheModulo})`) && !/RETE 0,00 t/.test(ecoSenza), riga(ecoSenza, 'Giacenze per canale').slice(0, 300));
  const impiantiSenza = (Gsenza.righe || []).filter(r => r.tipo_destinazione !== 'stoc' && !r.rete_non_dovuta).map(r => r.sito).sort();
  verifica('lo strumento: la rete «—» col perche\' del modulo, e gli impianti senza il file sono quelli (Tecnogum no)', sSenza.totali.rete.giacenza_t === null && sSenza.totali.rete.perche_totale === percheModulo
    && J([...(sSenza.totali.rete.impianti_senza_file_del_portale_esclusi || [])].sort()) === J(impiantiSenza) && !(sSenza.totali.rete.impianti_senza_file_del_portale_esclusi || []).some(s => /tecnogum/i.test(s)), J(sSenza.totali.rete));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
