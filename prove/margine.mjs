// Prova del margine (base44/shared/margine.ts): ricavo meno costo, per canale,
// con gli stessi calcoli delle due fatturazioni. Si lancia con: npm run prove
// In fondo (prova del cambio d'anno, 15/10/2026): un margine con prezzi che
// mancano e' «—» col perche', nel calcolo, nell'extra raccolta della pagina e
// nella scheda di Fatturazione › Margine.
// Col nome del modulo: col codice di prima le funzioni nuove mancano, e la prova
// deve fallire nelle sue verifiche, non fermarsi all'import.
import * as MARGINE from '../base44/shared/margine.ts';
import { totaliExtraRaccolta, calcExtraRaccolta } from '../src/lib/extraRaccoltaCalc.js';

const { calcolaMargineAnno } = MARGINE;
const testoDaConfermare = (...a) => (MARGINE.testoDaConfermare ? MARGINE.testoDaConfermare(...a) : undefined);
const testoPrezziMancanti = (...a) => (MARGINE.testoPrezziMancanti ? MARGINE.testoPrezziMancanti(...a) : undefined);

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const base = { stato: 'terminato', cer: '160103', classe: 'A' };
const dati = {
  reteAll: [
    { ...base, id: '1', id_ordine: 'ET1', numero_fir: 'F1', peso_effettivo: 10000, trasporto_finito_il: '2026-02-10T00:00:00Z', trasportatore: 'ALFA SRL', destinazione: 'BETA IMPIANTI', provincia: 'BA', tipo_destinazione: 'imp', automezzo: 'AA111AA' },
    { ...base, id: '2', id_ordine: 'ET2', numero_fir: 'F2', peso_effettivo: 5000, trasporto_finito_il: '2026-03-05T00:00:00Z', trasportatore: 'ALFA SRL', destinazione: 'BETA IMPIANTI', provincia: 'BA', tipo_destinazione: 'imp', automezzo: 'AA111AA' },
  ],
  aciAll: [
    { ...base, id: '3', id_ordine: 'EA1', numero_fir: 'FA1', classe: 'C', regione: 'Puglia', peso_effettivo: 2000, peso_stimato: 2000, trasporto_finito_il: '2026-02-12T00:00:00Z', trasportatore: 'ALFA SRL', destinazione: 'BETA IMPIANTI', provincia: 'BA', tipo_destinazione: 'imp', automezzo: 'AA111AA' },
  ],
  extraAll: [], secondarieAll: [],
  fornitori: [{ ragione_sociale: 'ALFA SRL', stato: 'attivo' }, { ragione_sociale: 'BETA IMPIANTI', stato: 'attivo' }],
  tariffe: [
    { id: 'a1', direzione: 'ATTIVA', tipologia: 'RETE', cliente: 'ECOTYRE', valore: 202, unita_misura: '€/t', stato: 'attivo' },
    { id: 'a2', direzione: 'ATTIVA', tipologia: 'ACI', cliente: 'ECOTYRE', regione: 'Puglia', valore: 240, unita_misura: '€/t', stato: 'attivo' },
    { id: 'p1', direzione: 'PASSIVA', stato: 'attivo', prestazione: 'RACCOLTA', fornitore_nome: 'Alfa s.r.l.', tipologia: 'RETE', valore: 60, unita_misura: '€/t' },
    { id: 'p2', direzione: 'PASSIVA', stato: 'attivo', prestazione: 'TRATTAMENTO', fornitore_nome: 'Beta Impianti', tipologia: 'RETE', valore: 80, unita_misura: '€/t' },
    { id: 'p3', direzione: 'PASSIVA', stato: 'attivo', prestazione: 'RACCOLTA', fornitore_nome: 'Alfa s.r.l.', tipologia: 'ACI', valore: 90, unita_misura: '€/t' },
  ],
};
const m = calcolaMargineAnno(dati, 2026, 2);
const rete = m.canali.find(c => c.canale === 'RETE'), aci = m.canali.find(c => c.canale === 'ACI'), extra = m.canali.find(c => c.canale === 'EXTRA_RACCOLTA');
verifica('tre canali, tre mesi ciascuno', m.canali.length === 3 && rete.mesi.length === 3);
verifica('rete febbraio: 10 t, ricavo 2020, costo 600 + 800, margine 620', rete.mesi[1].ricavo === 2020 && rete.mesi[1].costo === 1400 && rete.mesi[1].margine === 620 && rete.mesi[1].costo_raccolta === 600 && rete.mesi[1].costo_impianti === 800, JSON.stringify(rete.mesi[1]));
verifica('rete anno: 15 t, ricavo 3030, costo 2100, margine 930 = 30,7%', rete.anno.tonnellate === 15 && rete.anno.ricavo === 3030 && rete.anno.costo === 2100 && rete.anno.margine === 930 && rete.anno.margine_pct === 30.7 && rete.anno.margine_t === 62, JSON.stringify(rete.anno));
verifica('aci: il canale ha il suo margine, separato (480 - 180 = 300)', aci.anno.ricavo === 480 && aci.anno.costo_raccolta === 180 && aci.anno.tonnellate === 2, JSON.stringify(aci.anno));
verifica('aci: il trattamento senza tariffa e\' un\'anomalia che si vede accanto al mese', aci.mesi[1].anomalie_passiva > 0);
verifica('extra vuota: zeri e percentuale assente, non NaN', extra.anno.ricavo === 0 && extra.anno.margine_pct === null && extra.anno.margine_t === null);
verifica('nessun totale che somma i canali', !('totale' in m) && !('totale_generale' in m));

// Un viaggio di secondaria con rete e ACI, a prezzo per viaggio: pesa su tutti e
// due i margini, ciascuno per la sua quota dei chili (regola del 22/09/2026).
// Prima pesava tutto sulla rete e l'ACI aveva un margine piu' alto del vero.
const sec = (id, kg, aci) => ({ stato: 'terminato', cer: '160103', id, id_ordine: 'S' + id, numero_fir: 'FS' + id, peso_effettivo: kg,
  ordine_immesso_il: '2026-02-20T00:00:00Z', trasporto_iniziato_il: '2026-02-20T00:00:00Z', trasporto_finito_il: '2026-02-20T00:00:00Z',
  stoccaggio: 'NAPPI SUD', trasportatore: 'GAMMA TRASPORTI', destinazione: 'IRIGOM', tipo_destinazione: 'imp', automezzo: 'AA111AA',
  ...(aci ? { classe: 'C', codice_prodotto: '.class9' } : { classe: 'A' }) });
const conMisto = {
  ...dati,
  secondarieAll: [sec('s1', 6000, false), sec('s2', 4000, true)],
  fornitori: [...dati.fornitori, { ragione_sociale: 'GAMMA TRASPORTI', stato: 'attivo' }],
  tariffe: [...dati.tariffe, { id: 'ps', direzione: 'PASSIVA', stato: 'attivo', prestazione: 'TRASPORTO_SECONDARIA', fornitore_nome: 'Gamma Trasporti', produttore: 'Nappi Sud', destinatario: 'Irigom', tipologia: 'TUTTE', valore: 500, unita_misura: '€/viaggio' }],
};
const mm = calcolaMargineAnno(conMisto, 2026, 2);
const reteM = mm.canali.find(c => c.canale === 'RETE'), aciM = mm.canali.find(c => c.canale === 'ACI');
verifica('viaggio misto da 500 euro: 300 sul margine della rete e 200 su quello dell\'ACI', reteM.mesi[1].costo_trasporti === 300 && aciM.mesi[1].costo_trasporti === 200 && reteM.mesi[1].costo_trasporti + aciM.mesi[1].costo_trasporti === 500, `${reteM.mesi[1].costo_trasporti} + ${aciM.mesi[1].costo_trasporti}`);

// Un terminato senza fine trasporto non e' in nessun mese, quindi nemmeno nel
// margine: si dice una volta per l'anno, per canale, e non in ogni mese.
const conSenzaFine = { ...dati, reteAll: [...dati.reteAll, { ...dati.reteAll[0], id: '9', id_ordine: 'ET9', numero_fir: 'F9', ordine_immesso_il: '2026-01-15T00:00:00Z', trasporto_finito_il: null }] };
const ms = calcolaMargineAnno(conSenzaFine, 2026, 2);
const reteS = ms.canali.find(c => c.canale === 'RETE');
verifica('senza fine trasporto: fuori dal margine, detto una volta sulla rete', reteS.anno.ricavo === 3030 && reteS.senza_fine_trasporto && reteS.senza_fine_trasporto.quanti === 1 && reteS.senza_fine_trasporto.tonnellate === 10
  && !ms.canali.find(c => c.canale === 'ACI').senza_fine_trasporto, JSON.stringify(reteS.senza_fine_trasporto));
verifica('...e non conta fra le anomalie di ogni mese', reteS.mesi.every((x, i) => x.anomalie_passiva === rete.mesi[i].anomalie_passiva), JSON.stringify([reteS.mesi.map(x => x.anomalie_passiva), rete.mesi.map(x => x.anomalie_passiva)]));

// Immesso il 20/12/2025 e senza fine trasporto: la passiva lo segnala nei primi
// mesi del 2026 (revisione del 22/09/2026). Il margine dell'anno lo dice anche
// quando l'ultimo mese calcolato e' settembre, dove non si segnala piu'.
const conDicembre = { ...dati, reteAll: [...dati.reteAll, { ...dati.reteAll[0], id: '10', id_ordine: 'ET10', numero_fir: 'F10', peso_effettivo: 3000, ordine_immesso_il: '2025-12-20T00:00:00Z', trasporto_iniziato_il: '2025-12-28T00:00:00Z', trasporto_finito_il: null }] };
const md = calcolaMargineAnno(conDicembre, 2026, 8).canali.find(c => c.canale === 'RETE');
verifica('immesso a dicembre dell\'anno prima: nel margine 2026 fino a settembre, una volta', md.senza_fine_trasporto && md.senza_fine_trasporto.quanti === 1 && md.senza_fine_trasporto.tonnellate === 3 && /ET10/.test(md.senza_fine_trasporto.descrizione) && /fino a settembre/.test(md.senza_fine_trasporto.descrizione), JSON.stringify(md.senza_fine_trasporto));
const md27 = calcolaMargineAnno(conDicembre, 2027, 11).canali.find(c => c.canale === 'RETE');
verifica('...e non nel 2027', md27.senza_fine_trasporto === null, JSON.stringify(md27.senza_fine_trasporto));

// UN MARGINE CON PREZZI MANCANTI NON E' UN NUMERO (prova del cambio d'anno,
// 15/10/2026, difetto 18). Il 15/01/2027, senza le tariffe 2027, la rete faceva
// ricavo 0, costo 0 e margine «€ 0,00 · nessun ricavo», e l'extra raccolta, con un
// intervento senza prezzo, «€ -113,50 · -77,2% del ricavo». Ora mese e anno
// portano prezzi_mancanti e, quando ce ne sono, margine, % ed €/t sono null con la
// frase del perche'; ricavo e costo restano, detti parziali. «Nessun ricavo» resta
// per un periodo senza tonnellate. Le pagine e il PDF lo dicono (prove/margine
// qui sotto per la scheda di Fatturazione › Margine, prove/dashboardPagina.mjs e
// prove/riepilogoSettimanale.mjs per la dashboard e il PDF della settimana).
const SOLO_2026 = { data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31' };
const riga27 = (id, kg, giorno) => ({ ...base, id, id_ordine: 'ET' + id, numero_fir: 'F' + id, peso_effettivo: kg, ordine_immesso_il: giorno, trasporto_iniziato_il: giorno, trasporto_finito_il: giorno,
  trasportatore: 'ALFA SRL', destinazione: 'BETA IMPIANTI', provincia: 'BA', tipo_destinazione: 'imp', automezzo: 'AA111AA' });
const datiCambio = {
  reteAll: [riga27('D1', 10000, '2026-12-10T09:00:00Z'), riga27('G1', 7100, '2027-01-12T09:00:00Z')],
  aciAll: [], extraAll: [], secondarieAll: [],
  fornitori: dati.fornitori,
  // le tariffe del 2026, chiuse al 31/12/2026: i contratti sono annuali (06/10/2026)
  tariffe: dati.tariffe.filter(t => t.tipologia === 'RETE').map(t => ({ ...t, ...SOLO_2026 })),
};
const m27 = calcolaMargineAnno(datiCambio, 2027, 0);
const rete27 = m27.canali.find(c => c.canale === 'RETE');
const gen27 = rete27.mesi[0];
verifica('gennaio 2027 senza le tariffe dell\'anno: 7,10 t, ricavo e costo 0 detti parziali, 3 prezzi che mancano (1 dell\'attiva, 2 della passiva)',
  gen27.tonnellate === 7.1 && gen27.ricavo === 0 && gen27.costo === 0 && gen27.parziale === true && gen27.prezzi_mancanti === 3 && gen27.righe_senza_prezzo === 1 && gen27.passive_senza_tariffa === 2, JSON.stringify(gen27));
verifica('...il margine non e\' un numero: margine, % ed €/t null', gen27.margine === null && gen27.margine_pct === null && gen27.margine_t === null && gen27.ricavo_t === null && gen27.costo_t === null, JSON.stringify(gen27));
verifica('...e la frase dice perche\'', gen27.testo_prezzi_mancanti === '3 righe senza prezzo (1 dell\'attiva, 2 della passiva): margine non calcolabile', gen27.testo_prezzi_mancanti);
verifica('...anche l\'anno: un mese con prezzi mancanti fa l\'anno senza margine', rete27.anno.margine === null && rete27.anno.parziale === true && rete27.anno.prezzi_mancanti === 3 && rete27.anno.tonnellate === 7.1, JSON.stringify(rete27.anno));
const extra27 = m27.canali.find(c => c.canale === 'EXTRA_RACCOLTA');
verifica('un canale senza tonnellate non ha prezzi che mancano: margine 0 e % assente, nessun avviso', extra27.anno.tonnellate === 0 && extra27.anno.prezzi_mancanti === 0 && extra27.anno.margine === 0 && extra27.anno.margine_pct === null && extra27.anno.testo_prezzi_mancanti === '', JSON.stringify(extra27.anno));
// La controprova: dicembre 2026, con tutti i prezzi, ha il margine di sempre.
const dic26 = calcolaMargineAnno(datiCambio, 2026, 11).canali.find(c => c.canale === 'RETE').mesi[11];
verifica('controprova: dicembre 2026 con tutti i prezzi, 10 t: 2.020 - 1.400 = 620,00, 30,7%, 62 €/t', dic26.margine === 620 && dic26.margine_pct === 30.7 && dic26.margine_t === 62 && dic26.prezzi_mancanti === 0 && dic26.parziale === false && dic26.testo_prezzi_mancanti === '', JSON.stringify(dic26));
// Le righe con una tariffa copiata e non ancora confermata (CA3-1): si contano e
// si dicono, ma il prezzo c'e' e il margine resta un numero (D4: la conferma e'
// in Target & Status › Nuovo anno). Finche' i calcoli non le segnano, zero.
verifica('righe_da_confermare: zero senza tariffe copiate, e la frase vuota', gen27.righe_da_confermare === 0 && gen27.testo_da_confermare === '' && rete27.anno.righe_da_confermare === 0);
verifica('la frase delle tariffe copiate dice l\'anno della copia e dove si conferma', testoDaConfermare({ righe_da_confermare: 3 }, 2027) === '3 righe con la tariffa copiata dal 2026, da confermare in Target & Status › Nuovo anno'
  && testoDaConfermare({ righe_da_confermare: 1 }, 2027) === '1 riga con la tariffa copiata dal 2026, da confermare in Target & Status › Nuovo anno', testoDaConfermare({ righe_da_confermare: 3 }, 2027));
verifica('la frase dei prezzi che mancano al singolare, e vuota senza', testoPrezziMancanti({ prezzi_mancanti: 1, righe_senza_prezzo: 0, passive_senza_tariffa: 1 }) === '1 riga senza prezzo (1 della passiva): margine non calcolabile' && testoPrezziMancanti({ prezzi_mancanti: 0 }) === '');

// L'EXTRA RACCOLTA DELLA PAGINA (totaliExtraRaccolta, src/lib/extraRaccoltaCalc.js):
// due interventi del 2027, uno senza prezzo (0,6 t: la base del 2026 non vale nel
// 2027 e sull'intervento il prezzo non c'e') e uno a 210 €/t. Prima: ricavi
// 147,00, costi 260,50, margine -113,50 (-77,21%).
const intervento = (id, kg, prezzo, costoRaccolta, costoTrattamento) => ({ id, stato: 'terminato', tipo_movimento: 'primaria', id_ordine: 'ER' + id, numero_fir: 'FIR ' + id,
  produttore: 'COMUNE DI PROVA', trasportatore: 'EMMESSE SRLS', destinazione: 'GATIM S.R.L.', tipo_destinazione: 'imp', provincia: 'NA', classe: 'P', cer: '160103',
  ordine_immesso_il: '2027-01-05T08:00:00.000Z', trasporto_iniziato_il: '2027-01-10T08:00:00.000Z', trasporto_finito_il: '2027-01-10T08:00:00.000Z',
  peso_effettivo: kg, prezzo_attivo_t: prezzo, costo_raccolta_t: costoRaccolta, costo_trattamento_t: costoTrattamento });
const SENZA = intervento('E1', 600, 0, 105, 90);
const A210 = intervento('E2', 700, 210, 115, 90);
const kpiExtra = totaliExtraRaccolta([SENZA, A210]);
verifica('extra raccolta con un intervento senza prezzo: margine e % null, la frase, ricavi e costi restano', kpiExtra.margine === null && kpiExtra.margine_perc === null && kpiExtra.senza_prezzo === 1
  && kpiExtra.testo_senza_prezzo === 'un intervento da fatturare senza prezzo: margine non calcolabile, ricavi e costi parziali' && kpiExtra.ricavi === 147 && kpiExtra.costi > 0, JSON.stringify(kpiExtra));
verifica('...e l\'intervento lo dice di se\'', calcExtraRaccolta(SENZA).senza_prezzo === true && calcExtraRaccolta(A210).senza_prezzo === false);
const soloA210 = totaliExtraRaccolta([A210]);
verifica('controprova: con tutti i prezzi il margine e\' un numero (147,00 - 143,50 = 3,50)', soloA210.margine === 3.5 && soloA210.senza_prezzo === 0 && soloA210.testo_senza_prezzo === '', JSON.stringify(soloA210));

// LA SCHEDA E LA TABELLA DI FATTURAZIONE › MARGINE (MargineCommessa.jsx),
// disegnate con React lato server.
async function pagineMargine() {
  const { build } = await import('esbuild');
  const { existsSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
  const daAlias = (p) => { const b = qui('../src/' + p.slice(2)); return ['', '.js', '.jsx', '.ts'].map(e => b + e).find(x => existsSync(x) && /\.\w+$/.test(x)) || b; };
  const pacchetto = await build({
    stdin: { contents: `import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import * as M from ${JSON.stringify(qui('../src/components/fatturazione/MargineCommessa.jsx'))};
export const sottoIlMargine = M.sottoIlMargine;
export const disegna = (nome, props) => renderToStaticMarkup(React.createElement(M[nome], props));`, resolveDir: qui('.'), loader: 'js' },
    bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent',
    loader: { '.jsx': 'jsx', '.js': 'jsx' }, define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'finti', setup(b) {
      b.onResolve({ filter: /^@\/api\/base44Client$/ }, () => ({ path: 'client', namespace: 'client-finto' }));
      b.onLoad({ filter: /.*/, namespace: 'client-finto' }, () => ({ contents: 'export const base44 = { functions: { invoke: async () => ({ data: {} }) }, entities: {} };', loader: 'js' }));
      b.onResolve({ filter: /^@\// }, (a) => ({ path: daAlias(a.path) }));
    } }],
  });
  if (typeof globalThis.window === 'undefined') globalThis.window = { self: 1, top: 1, matchMedia: () => ({ matches: false, addListener() {}, removeListener() {} }) };
  return import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
}
try {
  const P = await pagineMargine();
  const testo = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ');
  const scheda = testo(P.disegna('SchedaMargine', { c: rete27, anno: 2027 }));
  verifica('Margine, la scheda della rete 2027: «—» e il perche\', ricavo e costo parziali, niente € 0,00 di margine ne\' «nessun ricavo»', scheda.includes('Rete — 2027 — margine · 3 righe senza prezzo (1 dell\'attiva, 2 della passiva): margine non calcolabile')
    && scheda.includes('Ricavo (parziale)') && scheda.includes('Costo (parziale)') && !/nessun ricavo/.test(scheda) && !/€ 0,00 margine/.test(scheda), scheda);
  const schedaDic = testo(P.disegna('SchedaMargine', { c: calcolaMargineAnno(datiCambio, 2026, 11).canali.find(c => c.canale === 'RETE'), anno: 2026 }));
  verifica('controprova: la scheda del 2026 con tutti i prezzi dice il margine e la percentuale', /€ 620,00 margine · 30,7% del ricavo/.test(schedaDic) && !/parziale/.test(schedaDic), schedaDic);
  verifica('«nessun ricavo» solo con 0 t, «— del ricavo» con tonnellate senza ricavo',
    P.sottoIlMargine({ tonnellate: 0, margine_pct: null }) === 'nessun ricavo' && P.sottoIlMargine({ tonnellate: 7.1, margine_pct: null }) === '— del ricavo'
    && P.sottoIlMargine(gen27) === gen27.testo_prezzi_mancanti);
  const tabella = P.disegna('TabellaMargine', { c: rete27 });
  const rigaGen = (tabella.match(/<tr[^>]*>(?:(?!<\/tr>)[\s\S])*?Gennaio[\s\S]*?<\/tr>/) || [''])[0];
  verifica('la tabella non ingrigisce come «vuoto» un mese con tonnellate e prezzi mancanti, e lo dice', !!rigaGen && !/<tr[^>]*text-muted-foreground/.test(rigaGen.slice(0, rigaGen.indexOf('>') + 1))
    && testo(rigaGen).includes('3 righe senza prezzo (1 dell\'attiva, 2 della passiva): margine non calcolabile; ricavo e costo parziali'), rigaGen.slice(0, 300));
} catch (e) { verifica('le pagine del margine si disegnano', false, String(e && e.message).slice(0, 300)); }

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
