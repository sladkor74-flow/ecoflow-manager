// IL FOGLIO DELLA PASSIVA PER L'AMMINISTRAZIONE: QUELLO CHE SI LEGGE E' QUELLO
// CHE EXCEL RIFA' (decisioni dell'utente del 13/10/2026).
//
// Nel foglio Excel ogni totale e' una formula che porta dentro il numero gia'
// calcolato: l'amministrazione lo apre, Excel ricalcola, e se la formula dice
// un'altra cosa il numero cambia sotto gli occhi di chi lo sta leggendo. Questa
// prova rifa' ogni formula del foglio come la rifarebbe Excel (SUM, ROUND,
// somme di celle) e pretende il numero che la cella porta dentro.
//
// Le sezioni:
//   1. la rete a due livelli, coi chili che nessuna voce prende: la riga del
//      fornitore dice 12 t (voci + senza voce) e la formula sommava solo le
//      voci, 10 t. Decisione: i chili senza voce stanno nel totale del fornitore
//      e quindi anche nella formula; gli euro no, perche' un prezzo non ce
//      l'hanno. Settembre senza surplus e ottobre col Fuel Surcharge, che mette
//      la riga del surplus fra la voce e i chili senza voce;
//   2. l'ACI piatta: la stessa cosa nel Totale complessivo del blocco;
//   3. l'extra raccolta costruita come la costruisce PassivaModulo (il calcolo
//      della passiva non c'e', il surplus lo conta il modulo Extra Raccolta): il
//      «di cui» della fascia dell'Excel e del riquadro del PDF dice il nome del
//      surplus, «Fuel Surcharge», come la rete e l'ACI, e non «surplus»;
//   4. sui dati veri (copia in ../dati-veri, se c'e'): ogni formula di ogni mese
//      del 2026, col modello e con le voci dell'archivio e col Fuel Surcharge
//      vero, torna col suo numero; settembre 2026 del modello resta al centesimo.
//
// node prove/passivaAmministrazioneRicalcolo.mjs
import { createRequire } from 'node:module';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { calcolaPassivaMese } from '../base44/shared/passivaCalcolo.ts';
import { caricaLibPagine } from './dati/libPagine.mjs';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
const ExcelJS = createRequire(import.meta.url)('exceljs');
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
const sezione = async (titolo, corpo) => {
  console.log(titolo);
  try { await corpo(); } catch (e) { ko++; console.log(`  FALLITA: ${titolo}: si ferma con un errore (${e && e.message})`); }
};

const AMM = await caricaLibPagine('lib/passivaAmministrazione');
const { foglioPassiva, fogliDa } = AMM;
const { cartellaPassivaUnFoglio, cartellaPassivaPerCanale } = await caricaLibPagine('lib/passivaAmministrazioneExcel');
const calc = await caricaLibPagine('lib/extraRaccoltaCalc');
const { bloccoExtraRaccolta } = await caricaLibPagine('lib/extraRaccoltaAmministrazione');
const subfornitori = await caricaLibPagine('lib/subfornitori');
const { modelloAmministrazione } = await caricaLibPagine('lib/modelloPassivaAmministrazione');

// ─── EXCEL RIFATTO COME LO RIFA' EXCEL ───
// Le formule che il foglio scrive: somme e differenze di celle e numeri,
// prodotti, SUM di celle e intervalli, ROUND(...;2). ROUND arrotonda come Excel
// (il mezzo centesimo in su, sul numero scritto a quindici cifre).
const colonna = (l) => [...l].reduce((s, c) => s * 26 + c.charCodeAt(0) - 64, 0);
const cent = (v) => Math.round(Number((Math.abs(v) * 100).toPrecision(15))) / 100 * Math.sign(v || 1);
function valuta(ws, testoF, prof) {
  if (prof > 12) throw new Error('formule troppo annidate: ' + testoF);
  const s = testoF.replace(/\s+/g, '');
  let i = 0;
  const cella = (l, n) => ricalcola(ws, Number(n), colonna(l), prof + 1);
  function espr() {
    let v = termine();
    while (s[i] === '+' || s[i] === '-') { const op = s[i++]; const w = termine(); v = op === '+' ? v + w : v - w; }
    return v;
  }
  function termine() { let v = fattore(); while (s[i] === '*') { i++; v *= fattore(); } return v; }
  function argomento() {
    const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)/.exec(s.slice(i));
    if (!m) return espr();
    i += m[0].length;
    let t = 0;
    for (let r = Number(m[2]); r <= Number(m[4]); r++) for (let c = colonna(m[1]); c <= colonna(m[3]); c++) t += ricalcola(ws, r, c, prof + 1);
    return t;
  }
  function fattore() {
    if (s[i] === '(') { i++; const v = espr(); i++; return v; }
    let m = /^(SUM|ROUND)\(/.exec(s.slice(i));
    if (m) {
      i += m[0].length;
      const a = [];
      while (s[i] !== ')') { a.push(argomento()); if (s[i] === ',') i++; }
      i++;
      if (m[1] === 'SUM') return a.reduce((x, y) => x + y, 0);
      if (a[1] !== 2) throw new Error('ROUND non al centesimo: ' + testoF);
      return cent(a[0]);
    }
    m = /^([A-Z]+)(\d+)/.exec(s.slice(i));
    if (m) { i += m[0].length; return cella(m[1], m[2]); }
    m = /^\d+(\.\d+)?/.exec(s.slice(i));
    if (m) { i += m[0].length; return Number(m[0]); }
    throw new Error('formula non capita: ' + testoF);
  }
  const v = espr();
  if (i !== s.length) throw new Error('formula non capita: ' + testoF);
  return v;
}
/** Il valore di una cella come lo rifa' Excel: una formula si rifa', un numero e' quello. */
function ricalcola(ws, r, c, prof = 0) {
  const v = ws.getCell(r, c).value;
  if (v && typeof v === 'object' && v.formula) return Math.round(valuta(ws, v.formula, prof) * 1e9) / 1e9;
  return typeof v === 'number' ? v : 0;
}
/**
 * Le formule del foglio che, rifatte, non tornano col numero che portano
 * dentro. Una formula che vale zero exceljs la rilegge senza risultato: vale
 * zero, come per Excel appena la ricalcola.
 */
function formuleStorte(ws) {
  const fuori = [];
  let quante = 0;
  ws.eachRow((row, r) => row.eachCell((cel, c) => {
    const v = cel.value;
    if (!(v && typeof v === 'object' && v.formula)) return;
    quante++;
    const porta = typeof v.result === 'number' ? v.result : 0;
    const rifatto = ricalcola(ws, r, c);
    if (Math.abs(rifatto - porta) > 1e-6) fuori.push({ cella: `${String.fromCharCode(64 + c)}${r}`, riga: String(ws.getCell(r, 1).value || ''), formula: v.formula, porta, rifatto });
  }));
  return { quante, storte: fuori };
}

const grezzo = (ws, r, c) => ws.getCell(r, c).value;
const val = (ws, r, c) => {
  const v = grezzo(ws, r, c);
  if (v && typeof v === 'object' && 'result' in v) return v.result;
  if (v && typeof v === 'object' && v.formula) return 0;
  return v;
};
const testo = (ws, r, c) => String(val(ws, r, c) ?? '');
const formula = (ws, r, c) => { const v = grezzo(ws, r, c); return v && typeof v === 'object' && v.formula ? String(v.formula) : ''; };
const righeCon = (ws, pezzo, c = 1) => { const fuori = []; for (let r = 1; r <= ws.rowCount; r++) if (testo(ws, r, c).includes(pezzo)) fuori.push(r); return fuori; };
/** Le righe di una formula SUM, intervalli compresi. */
const righeDi = (f) => {
  const m = /^SUM\((.*)\)$/.exec(f);
  if (!m) return [];
  const fuori = [];
  for (const p of m[1].split(',')) {
    const iv = /^[A-Z]+(\d+):[A-Z]+(\d+)$/.exec(p.trim());
    if (iv) { for (let r = Number(iv[1]); r <= Number(iv[2]); r++) fuori.push(r); continue; }
    const una = /^[A-Z]+(\d+)$/.exec(p.trim());
    if (una) fuori.push(Number(una[1]));
  }
  return fuori;
};
const apri = async (bytes) => { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(bytes)); return wb; };

// ─── UN MESE COSTRUITO ───
// ALFA SRL raccoglie 10 t da Napoli e 2 t da Caserta, a 60 €/t. Nel modello ha
// una voce sola, «Napoli» (provincia NA): le 2 t di Caserta non le prende
// nessuna voce e finiscono nella riga «senza voce». Il foglio da' ad ALFA 12 t e
// 600 € (le 2 t senza voce non hanno un prezzo nel foglio). A ottobre il Fuel
// Surcharge del consorzio, +5 €/t sulla raccolta, sulle 12 t: 60,00 €.
const FORNITORI = [{ id: 'f-al', ragione_sociale: 'ALFA SRL', stato: 'attivo' }, { id: 'f-be', ragione_sociale: 'BETA IMPIANTI', stato: 'attivo' }];
const tariffa = (id, prestazione, tipologia, valore, fornitore = 'ALFA SRL') => ({ id, direzione: 'PASSIVA', prestazione, tipologia, fornitore_nome: fornitore, unita_misura: '€/t', valore, stato: 'attivo', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31' });
const TARIFFE = [tariffa('t-r', 'RACCOLTA', 'RETE', 60), tariffa('t-a', 'RACCOLTA', 'ACI', 60), tariffa('t-b', 'TRATTAMENTO', 'TUTTE', 80, 'BETA IMPIANTI')];
const surplus = (id, tipologia, extra = {}) => ({
  id, gruppo: 'fs', nome: 'Fuel Surcharge', origine: 'CONSORZIO', riferimento: 'comunicazione Ecotyre', tipologia, prestazione: 'RACCOLTA',
  a_chi: 'tutti', euro_t_passiva: 5, euro_t_attiva: 5, data_inizio_validita: '2026-10-01', data_fine_validita: '2026-12-31', stato: 'attivo', ...extra,
});
const FS = ['RETE', 'ACI', 'EXTRA_RACCOLTA'].map(t => surplus('fs-' + t, t));
const primaria = (id, provincia, kg, mese) => ({
  id, stato: 'terminato', id_ordine: 'ET' + id, numero_fir: 'RGYTR' + id, trasportatore: 'ALFA SRL', provincia, regione: 'Campania',
  destinazione: 'BETA IMPIANTI', tipo_destinazione: 'imp', classe: 'P', peso_effettivo: kg, automezzo: 'AB' + id, cer: '160103',
  ordine_immesso_il: `2026-${mese}-01T08:00:00.000Z`, trasporto_iniziato_il: `2026-${mese}-05T08:00:00.000Z`, trasporto_finito_il: `2026-${mese}-05T08:00:00.000Z`,
});
const archivi = (mese) => ({
  primarieRete: [primaria('1', 'NA', 10000, mese), primaria('2', 'CE', 2000, mese)],
  primarieAci: [primaria('3', 'NA', 10000, mese), primaria('4', 'CE', 2000, mese)],
  secondarieAll: [], extraRaccoltaAll: [], tariffeAll: TARIFFE, fornitoriAll: FORNITORI, surplusAll: FS,
});
const voce = (canale, blocco, soggetto, nome, prezzo, ordine, criterio = '', extra = {}) => ({ anno: 2026, canale, blocco, soggetto, voce: nome, prezzo, unita_misura: 'euro_tonnellata', colonna_prezzo: '', ordine, criterio_json: criterio, attiva: true, note: '', ...extra });
const VOCI = [
  voce('RETE', 'raccoglitori', 'ALFA SRL', 'Napoli', 60, 10, J({ provincia: 'NA' })),
  voce('RETE', 'impianti', 'BETA IMPIANTI', '', 80, 10),
  voce('ACI', 'raccoglitori', 'ALFA SRL', 'Napoli', 60, 10, J({ provincia: 'NA' })),
  voce('ACI', 'impianti', 'BETA IMPIANTI', '', 80, 10, '', { colonna_prezzo: 'trattamento' }),
];
const fogliDelMese = (mese, indice, nomeMese) => ['RETE', 'ACI'].map(c => foglioPassiva(VOCI, calcolaPassivaMese(archivi(mese), 2026, indice, nomeMese, c), c, nomeMese, 2026, TARIFFE));

await sezione('1. LA RETE A DUE LIVELLI: I CHILI SENZA VOCE NEL TOTALE DEL FORNITORE, ANCHE NELLA FORMULA', async () => {
  for (const [mese, indice, nomeMese, euro, conSurplus] of [['09', 8, 'Settembre', 600, false], ['10', 9, 'Ottobre', 660, true]]) {
    const [rete] = fogliDelMese(mese, indice, nomeMese);
    const sue = rete.raccoglitori.righe.filter(r => r.soggetto === 'ALFA SRL');
    verifica(`${nomeMese}, il foglio: ALFA 12 t (10 della voce + 2 senza voce), ${euro} €`,
      J(sue.map(r => [r.tipo, r.tonnellate])) === J([['soggetto', 12], ['voce', 10], ...(conSurplus ? [['surplus', 12]] : []), ['senza_voce', 2]]) && sue[0].totale === euro && rete.raccoglitori.totale_t === 12,
      J(sue.map(r => [r.tipo, r.tonnellate, r.totale])));
    const ws = (await apri(await cartellaPassivaUnFoglio([rete]))).getWorksheet('PASSIVA');
    const [rAlfa] = righeCon(ws, 'ALFA SRL');
    const [rSenza] = righeCon(ws, 'senza voce nel modello');
    const [rTot] = righeCon(ws, 'Totale complessivo');
    const rS = righeCon(ws, 'Fuel Surcharge')[0];
    const fT = formula(ws, rAlfa, 2), fE = formula(ws, rAlfa, 5);
    verifica(`${nomeMese}, Excel: le tonnellate di ALFA sommano la voce e i chili senza voce${conSurplus ? ', non la riga del surplus' : ''}`,
      righeDi(fT).includes(rAlfa + 1) && righeDi(fT).includes(rSenza) && (!rS || !righeDi(fT).includes(rS)), `${fT} (senza voce alla riga ${rSenza})`);
    verifica(`${nomeMese}, Excel: gli euro di ALFA non prendono i chili senza voce`, !righeDi(fE).includes(rSenza) && righeDi(fE).includes(rAlfa + 1) && (!rS || righeDi(fE).includes(rS)), fE);
    verifica(`${nomeMese}, Excel: ALFA porta dentro 12 t e rifatta fa 12 t, non 10`, val(ws, rAlfa, 2) === 12 && ricalcola(ws, rAlfa, 2) === 12, `${val(ws, rAlfa, 2)} → ${ricalcola(ws, rAlfa, 2)} (${fT})`);
    verifica(`${nomeMese}, Excel: e in euro ${euro}, prima e dopo il ricalcolo`, val(ws, rAlfa, 5) === euro && ricalcola(ws, rAlfa, 5) === euro, `${val(ws, rAlfa, 5)} → ${ricalcola(ws, rAlfa, 5)}`);
    verifica(`${nomeMese}, Excel: il Totale complessivo dei raccoglitori rifatto fa 12 t e ${euro} €`,
      ricalcola(ws, rTot, 2) === 12 && val(ws, rTot, 2) === 12 && ricalcola(ws, rTot, 5) === euro, `${ricalcola(ws, rTot, 2)} ${ricalcola(ws, rTot, 5)}`);
    const { quante, storte } = formuleStorte(ws);
    verifica(`${nomeMese}, Excel: tutte le ${quante} formule del foglio tornano col numero che portano dentro`, quante > 5 && !storte.length, J(storte));
    // Un foglio per canale: lo stesso.
    const wc = (await apri(await cartellaPassivaPerCanale([rete]))).getWorksheet('RETE');
    verifica(`${nomeMese}, un foglio per canale: lo stesso`, !formuleStorte(wc).storte.length, J(formuleStorte(wc).storte));
  }
});

await sezione('2. L\'ACI PIATTA: I CHILI SENZA VOCE NEL TOTALE COMPLESSIVO DEL BLOCCO', async () => {
  for (const [mese, indice, nomeMese, euro] of [['09', 8, 'Settembre', 600], ['10', 9, 'Ottobre', 660]]) {
    const [, aci] = fogliDelMese(mese, indice, nomeMese);
    verifica(`${nomeMese}, il foglio dell'ACI: raccoglitori 12 t, ${euro} €`, aci.raccoglitori.totale_t === 12 && aci.raccoglitori.totale_euro === euro, J([aci.raccoglitori.totale_t, aci.raccoglitori.totale_euro]));
    const ws = (await apri(await cartellaPassivaUnFoglio([aci]))).getWorksheet('PASSIVA');
    const [rSenza] = righeCon(ws, 'senza voce nel modello');
    const [rTot] = righeCon(ws, 'Totale complessivo');
    verifica(`${nomeMese}, Excel: nel piatto il Totale complessivo in tonnellate somma anche i chili senza voce, in euro no`,
      righeDi(formula(ws, rTot, 2)).includes(rSenza) && !righeDi(formula(ws, rTot, 5)).includes(rSenza), `${formula(ws, rTot, 2)} | ${formula(ws, rTot, 5)}`);
    verifica(`${nomeMese}, Excel: rifatto fa 12 t e ${euro} €, il numero che porta dentro`,
      val(ws, rTot, 2) === 12 && ricalcola(ws, rTot, 2) === 12 && ricalcola(ws, rTot, 5) === euro, `${val(ws, rTot, 2)} → ${ricalcola(ws, rTot, 2)}`);
    const { quante, storte } = formuleStorte(ws);
    verifica(`${nomeMese}, Excel: tutte le ${quante} formule tornano`, !storte.length, J(storte));
  }
  // Senza chili senza voce le formule sono quelle di prima: tutte le righe a
  // Napoli, la voce prende tutto e nessuna riga in piu' entra nelle somme.
  const tutteNapoli = { ...archivi('09'), primarieRete: [primaria('1', 'NA', 12000, '09')] };
  const rete = foglioPassiva(VOCI, calcolaPassivaMese(tutteNapoli, 2026, 8, 'Settembre', 'RETE'), 'RETE', 'Settembre', 2026, TARIFFE);
  const ws = (await apri(await cartellaPassivaUnFoglio([rete]))).getWorksheet('PASSIVA');
  const [rAlfa] = righeCon(ws, 'ALFA SRL');
  verifica('senza chili senza voce la formula del fornitore e\' quella di prima: la sola voce', formula(ws, rAlfa, 2) === `SUM(B${rAlfa + 1})` && !righeCon(ws, 'senza voce').length, formula(ws, rAlfa, 2));
});

await sezione('3. L\'EXTRA RACCOLTA COME LA FA PASSIVAMODULO: IL «DI CUI» DICE «FUEL SURCHARGE»', async () => {
  // Come PassivaModulo.esportaAmministrazione: la rete dal calcolo, l'extra
  // raccolta con un oggetto vuoto e il blocco del modulo col contesto della
  // pagina (i surplus, l'anagrafica, i subfornitori). Un intervento di EMMESSE
  // di 2,631 t a ottobre: Fuel Surcharge 13,16 €.
  const fornitori = [...FORNITORI, { id: 'f-em', ragione_sociale: 'EMMESSE SRLS', stato: 'attivo' }];
  const EX = [{ id: 'x1', stato: 'terminato', tipo_movimento: 'primaria', numero_fir: 'FIRX', id_ordine: 'EX1', trasportatore: 'EMMESSE SRLS', produttore: 'COMUNE DI PROVA', destinazione: 'BETA IMPIANTI', peso_effettivo: 2631, costo_raccolta_t: 90, costo_trattamento_t: 95, ordine_immesso_il: '2026-10-02T08:00:00.000Z', trasporto_iniziato_il: '2026-10-10T08:00:00.000Z', trasporto_finito_il: '2026-10-10T08:00:00.000Z' }];
  const per = { RETE: calcolaPassivaMese(archivi('10'), 2026, 9, 'Ottobre', 'RETE'), EXTRA_RACCOLTA: {} };
  const extra = bloccoExtraRaccolta(EX, 2026, 'Ottobre', calc.contestoPrezzi([], fornitori, FS, subfornitori));
  const fogli = fogliDa(VOCI, per, 'Ottobre', 2026, TARIFFE, extra);
  const ex = fogli.find(f => f.canale === 'EXTRA_RACCOLTA');
  verifica('il blocco del modulo porta il Fuel Surcharge di EMMESSE: 13,16 €', ex.extra.surplus.length === 1 && ex.extra.surplus[0].totale === 13.16 && ex.totale_surplus === 13.16, J(ex.extra.surplus));
  verifica('il canale extra raccolta sa che il suo surplus e\' il Fuel Surcharge (foglio.surplus), come la rete',
    J(ex.surplus.map(s => [s.nome, s.euro_t, s.prestazione, s.dal, s.al])) === J([['Fuel Surcharge', 5, 'RACCOLTA', '2026-10-01', '2026-12-31']])
    && J(fogli[0].surplus.map(s => s.nome)) === J(['Fuel Surcharge']), J(ex.surplus));
  // Excel: la fascia di ogni canale.
  for (const [come, cartella] of [['un foglio solo', async () => (await apri(await cartellaPassivaUnFoglio(fogli))).getWorksheet('PASSIVA')], ['un foglio per canale', async () => (await apri(await cartellaPassivaPerCanale(fogli))).getWorksheet('EXTRA RACCOLTA')]]) {
    const ws = await cartella();
    const [rFascia] = righeCon(ws, 'EXTRA RACCOLTA · Ottobre 2026');
    verifica(`Excel, ${come}: la fascia dell'extra raccolta dice «di cui Fuel Surcharge» 13,16, come formula sulla riga del surplus`,
      testo(ws, rFascia, 6) === 'di cui Fuel Surcharge' && val(ws, rFascia, 7) === 13.16 && ricalcola(ws, rFascia, 7) === 13.16, `${testo(ws, rFascia, 6)} ${formula(ws, rFascia, 7)}`);
    verifica(`Excel, ${come}: tutte le formule tornano`, !formuleStorte(ws).storte.length, J(formuleStorte(ws).storte));
  }
  // PDF: un jsPDF finto che tiene i testi.
  globalThis.__TESTI_RICALCOLO = [];
  globalThis.__AMM_RICALCOLO = AMM;
  globalThis.__PDF_FINTO_RICALCOLO = { jsPDF: class {
    constructor() { this.internal = { pageSize: { getWidth: () => 297, getHeight: () => 210 } }; }
    setFont() {} setFontSize() {} setTextColor() {} setFillColor() {} setDrawColor() {} setLineWidth() {} rect() {} roundedRect() {} line() {}
    text(t) { globalThis.__TESTI_RICALCOLO.push(Array.isArray(t) ? t.join(' ') : String(t)); }
    splitTextToSize(s) { return String(s).split('\n'); }
    addPage() {} save() {}
  } };
  const { esportaPassivaAmministrazionePdf } = await caricaLibPagine('lib/passivaAmministrazionePdf', [
    ["const { jsPDF } = await import('jspdf');", 'const { jsPDF } = globalThis.__PDF_FINTO_RICALCOLO;'],
    [/import \{([^}]*)\} from '@\/lib\/passivaAmministrazione';/, 'const {$1} = globalThis.__AMM_RICALCOLO;'],
  ]);
  await esportaPassivaAmministrazionePdf(fogli, { anno: 2026, mese: 'Ottobre' });
  const diCui = globalThis.__TESTI_RICALCOLO.filter(t => /^di cui /.test(t));
  verifica('PDF: il riquadro dell\'extra raccolta dice «di cui Fuel Surcharge 13,16 €», e nessun riquadro dice «di cui surplus»',
    diCui.includes('di cui Fuel Surcharge 13,16 €') && !diCui.some(t => /^di cui surplus/.test(t)), J(diCui));
  // Senza surplus nel mese: nessun nome e nessun «di cui».
  const extra0 = bloccoExtraRaccolta(EX, 2026, 'Ottobre', calc.contestoPrezzi([], fornitori, [], subfornitori));
  const ex0 = foglioPassiva(VOCI, {}, 'EXTRA_RACCOLTA', 'Ottobre', 2026, TARIFFE, extra0);
  const ws0 = (await apri(await cartellaPassivaUnFoglio([ex0]))).getWorksheet('PASSIVA');
  verifica('senza surplus: foglio.surplus vuoto e nessun «di cui» nella fascia', !ex0.surplus.length && !testo(ws0, righeCon(ws0, 'EXTRA RACCOLTA ·')[0], 6), J(ex0.surplus));
  // Due fornitori con lo stesso Fuel Surcharge: un surplus solo, non due.
  const EX2 = [...EX, { ...EX[0], id: 'x2', numero_fir: 'FIRY', id_ordine: 'EX2', trasportatore: 'ALFA SRL', peso_effettivo: 1000 }];
  const ex2 = foglioPassiva(VOCI, {}, 'EXTRA_RACCOLTA', 'Ottobre', 2026, TARIFFE, bloccoExtraRaccolta(EX2, 2026, 'Ottobre', calc.contestoPrezzi([], fornitori, FS, subfornitori)));
  verifica('due raccoglitori con lo stesso Fuel Surcharge: due righe, un surplus solo nell\'elenco del canale', ex2.extra.surplus.length === 2 && ex2.surplus.length === 1 && ex2.surplus[0].nome === 'Fuel Surcharge', J([ex2.extra.surplus.map(r => r.soggetto), ex2.surplus]));
  // Se chi chiama passa il calcolo dell'extra raccolta, vale l'elenco del calcolo.
  const pe = calcolaPassivaMese({ ...archivi('10'), primarieRete: [], primarieAci: [], extraRaccoltaAll: EX, fornitoriAll: fornitori }, 2026, 9, 'Ottobre', 'EXTRA_RACCOLTA');
  const exC = foglioPassiva(VOCI, pe, 'EXTRA_RACCOLTA', 'Ottobre', 2026, TARIFFE, extra);
  verifica('col calcolo passato l\'elenco e\' quello del calcolo, lo stesso nome', J(exC.surplus.map(s => s.nome)) === J((pe.surplus_del_mese || []).map(s => s.nome)) && exC.surplus.length >= 1, J(exC.surplus));
});

await sezione('4. SUI DATI VERI: OGNI FORMULA DI OGNI MESE DEL 2026 TORNA', async () => {
  const CARTELLA = process.env.DATI_VERI || qui('../../dati-veri/');
  const copie = existsSync(CARTELLA) ? readdirSync(CARTELLA).filter(n => /^treadrider-dati-veri-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n)).sort() : [];
  if (!copie.length) { console.log(`  Nessuna copia dei dati veri in ${CARTELLA}: questa parte si salta.`); return; }
  const copia = copie[copie.length - 1];
  const A = JSON.parse(gunzipSync(readFileSync(CARTELLA + copia)).toString('utf8')).archivi;
  const veri = {
    primarieRete: A.PrimariaRete || [], primarieAci: A.PrimariaAci || [], secondarieAll: A.Secondaria || [], extraRaccoltaAll: A.ExtraRaccolta || [],
    tariffeAll: (A.Tariffa || []).filter(t => String(t.direzione || 'PASSIVA') === 'PASSIVA'),
    fornitoriAll: (A.Fornitore || []).filter(x => x.stato === 'attivo'), surplusAll: FS,
  };
  const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre'];
  const vociVere = (A.VocePassivaAmministrazione || []).filter(v => Number(v.anno) === 2026);
  for (const [nome, voci] of [['voci dell\'archivio', vociVere], ['modello', modelloAmministrazione(2026)]]) {
    const storte = [];
    let quante = 0;
    for (const [i, mese] of MESI.entries()) {
      // Come PassivaModulo: l'extra raccolta col blocco del modulo e il suo contesto.
      const per = { RETE: calcolaPassivaMese(veri, 2026, i, mese, 'RETE'), ACI: calcolaPassivaMese(veri, 2026, i, mese, 'ACI'), EXTRA_RACCOLTA: {} };
      const extra = bloccoExtraRaccolta(A.ExtraRaccolta || [], 2026, mese, calc.contestoPrezzi([], A.Fornitore || [], FS, subfornitori));
      const fogli = fogliDa(voci, per, mese, 2026, veri.tariffeAll, extra);
      const ws = (await apri(await cartellaPassivaUnFoglio(fogli))).getWorksheet('PASSIVA');
      const esito = formuleStorte(ws);
      quante += esito.quante;
      storte.push(...esito.storte.map(x => ({ mese, ...x })));
      if (nome === 'modello' && mese === 'Settembre') {
        const [r, a] = fogli;
        verifica('settembre 2026 del modello al centesimo: rete 156.812,73, ACI 4.432,47, raccoglitori della rete 1.120,24 t',
          r.totale_euro === 156812.73 && a.totale_euro === 4432.47 && r.raccoglitori.totale_t === 1120.24 && r.totale_surplus === 0, J([r.totale_euro, a.totale_euro, r.raccoglitori.totale_t]));
        const [fR] = righeCon(ws, 'RETE · Settembre 2026');
        const [fA] = righeCon(ws, 'ACI · Settembre 2026');
        verifica('e nell\'Excel rifatto: 156.812,73 e 4.432,47', ricalcola(ws, fR, 5) === 156812.73 && ricalcola(ws, fA, 5) === 4432.47, `${ricalcola(ws, fR, 5)} ${ricalcola(ws, fA, 5)}`);
      }
    }
    verifica(`${nome}: le ${quante} formule dei fogli da gennaio a ottobre 2026 tornano tutte col numero che portano dentro`, quante > 1000 && !storte.length, J(storte.slice(0, 5)));
  }
});

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
