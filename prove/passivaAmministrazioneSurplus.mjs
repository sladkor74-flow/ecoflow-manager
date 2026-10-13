// IL SURPLUS SULLE TARIFFE NEL FOGLIO DELL'AMMINISTRAZIONE, NEI FILE E NELLA
// PAGINA DELLA PASSIVA (13/10/2026).
//
// Richiesta dell'utente del 12/10/2026: accanto alla tariffa un eventuale
// surplus in €/t con le sue date, e in fattura «una riga con l'importo standard
// ed una per il surplus (sempre riferito alle stesse tonnellate raccolte o
// trattate nel mese)». Il primo e' il Fuel Surcharge del consorzio Ecotyre, +5
// €/t a tutti i raccoglitori dal 01/10/2026 al 31/12/2026.
//
// Il rischio che questa prova guarda e' uno solo, in tutte le sue forme: LE
// TONNELLATE CONTATE DUE VOLTE. La riga del surplus sta sotto il soggetto, sulle
// stesse tonnellate: il totale del soggetto e del blocco in tonnellate non la
// prende, quello in euro si'. Nel foglio Excel vuol dire che le formule SUM delle
// tonnellate non prendono la riga del surplus e quelle degli euro si'; nel file
// del canale che le tonnellate del surplus sono testo; nella pagina che si
// leggono fra parentesi. E il foglio di settembre 2026 del modello, che non ha
// surplus, resta quello di prima al centesimo.
//
// Le sezioni:
//   1. un mese costruito, col calcolo vero: le righe del foglio (rete e ACI);
//   2. il foglio Excel rifatto come lo rifarebbe Excel: formule e formati;
//   3. il file del canale (Excel e PDF dello stesso modulo);
//   4. l'extra raccolta: il surplus in fondo agli interventi;
//   5. il PDF dell'amministrazione, con un jsPDF finto che tiene i testi;
//   6. la pagina: le tre tabelle e le fasce, disegnate davvero;
//   7. sui dati veri (copia in ../dati-veri, se c'e'): settembre senza surplus
//      come prima, settembre col Fuel Surcharge simulato coi numeri del progetto.
//
// node prove/passivaAmministrazioneSurplus.mjs
import { createRequire } from 'node:module';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { calcolaPassivaMese } from '../base44/shared/passivaCalcolo.ts';
import { caricaLibPagine } from './dati/libPagine.mjs';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
const ExcelJS = createRequire(import.meta.url)('exceljs');
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
// Una sezione che si ferma con un errore (il codice di prima non ha le funzioni
// del surplus) conta come fallita e si va avanti con la prossima.
const sezione = async (titolo, corpo) => {
  console.log(titolo);
  try { await corpo(); } catch (e) { ko++; console.log(`  FALLITA: ${titolo}: si ferma con un errore (${e && e.message})`); }
};

const AMM = await caricaLibPagine('lib/passivaAmministrazione');
const { foglioPassiva } = AMM;
const { cartellaPassivaUnFoglio, cartellaPassivaPerCanale } = await caricaLibPagine('lib/passivaAmministrazioneExcel');
const { righePassiva } = await caricaLibPagine('lib/passivaExport');
const { modelloAmministrazione } = await caricaLibPagine('lib/modelloPassivaAmministrazione');

// ─── UN MESE COSTRUITO: OTTOBRE 2026 ───
// ALFA SRL raccoglie 12,50 t di rete a 60 €/t e 2,345 t di ACI a 110 (chili non
// tondi: le tonnellate vogliono il terzo decimale); SMOCO e' interno e raccoglie
// 3 t e 2,49 t, che il surplus non paga; GAMMA SRL e' nel modello e nel mese non
// porta niente: la sua riga del surplus c'e' lo stesso, a zero. BETA IMPIANTI
// tratta tutto: il Fuel Surcharge e' sulla raccolta e li' non c'e'.
const FORNITORI = [
  { id: 'f-al', ragione_sociale: 'ALFA SRL', stato: 'attivo' },
  { id: 'f-ga', ragione_sociale: 'GAMMA SRL', stato: 'attivo' },
  { id: 'f-sm', ragione_sociale: 'SMOCO S.R.L.', interno: true, stato: 'attivo' },
  { id: 'f-be', ragione_sociale: 'BETA IMPIANTI', stato: 'attivo' },
];
const tariffa = (id, fornitore, prestazione, valore, extra = {}) => ({ id, direzione: 'PASSIVA', prestazione, tipologia: 'RETE', fornitore_nome: fornitore, unita_misura: '€/t', valore, stato: 'attivo', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31', ...extra });
const TARIFFE = [
  tariffa('t-al', 'ALFA SRL', 'RACCOLTA', 60), tariffa('t-ga', 'GAMMA SRL', 'RACCOLTA', 70), tariffa('t-be', 'BETA IMPIANTI', 'TRATTAMENTO', 80),
  tariffa('t-al-aci', 'ALFA SRL', 'RACCOLTA', 110, { tipologia: 'ACI' }), tariffa('t-be-aci', 'BETA IMPIANTI', 'TRATTAMENTO', 95, { tipologia: 'ACI' }),
];
const primaria = (id, trasportatore, kg, quando, extra = {}) => ({
  id, stato: 'terminato', id_ordine: 'ET' + id, numero_fir: 'RGYTR' + id, trasportatore, provincia: 'NA', regione: 'Campania',
  destinazione: 'BETA IMPIANTI', tipo_destinazione: 'imp', classe: 'P', peso_effettivo: kg, automezzo: 'AB' + id, cer: '160103',
  ordine_immesso_il: '2026-10-01T08:00:00.000Z', trasporto_iniziato_il: quando, trasporto_finito_il: quando, ...extra,
});
const surplus = (id, tipologia, extra = {}) => ({
  id, gruppo: 'fs', nome: 'Fuel Surcharge', origine: 'CONSORZIO', riferimento: 'comunicazione Ecotyre', tipologia, prestazione: 'RACCOLTA',
  a_chi: 'tutti', euro_t_passiva: 5, euro_t_attiva: 5, data_inizio_validita: '2026-10-01', data_fine_validita: '2026-12-31', stato: 'attivo', ...extra,
});
const FS = [surplus('fs-rete', 'RETE'), surplus('fs-aci', 'ACI'), surplus('fs-extra', 'EXTRA_RACCOLTA')];
const ARCHIVI = {
  primarieRete: [
    primaria('1', 'ALFA SRL', 10000, '2026-10-05T08:00:00.000Z'),
    primaria('2', 'ALFA SRL', 2500, '2026-10-06T08:00:00.000Z'),
    primaria('3', 'SMOCO S.R.L.', 3000, '2026-10-07T08:00:00.000Z'),
  ],
  primarieAci: [
    primaria('4', 'ALFA SRL', 2345, '2026-10-08T08:00:00.000Z', { classe: 'C', codice_prodotto: '.class9' }),
    primaria('5', 'SMOCO S.R.L.', 2490, '2026-10-09T08:00:00.000Z', { classe: 'C' }),
  ],
  secondarieAll: [], extraRaccoltaAll: [], tariffeAll: TARIFFE, fornitoriAll: FORNITORI,
};
const voce = (canale, blocco, soggetto, nomeVoce, prezzo, ordine, extra = {}) => ({ anno: 2026, canale, blocco, soggetto, voce: nomeVoce, prezzo, unita_misura: 'euro_tonnellata', colonna_prezzo: '', ordine, criterio_json: '', attiva: true, note: '', ...extra });
const VOCI = [
  voce('RETE', 'raccoglitori', 'ALFA SRL', '', 60, 10),
  voce('RETE', 'raccoglitori', 'GAMMA SRL', '', 70, 20),
  voce('RETE', 'raccoglitori', 'SMOCO S.R.L.', '', 0, 30, { note: 'Interno: non fatturato.' }),
  voce('RETE', 'impianti', 'BETA IMPIANTI', '', 80, 10),
  voce('ACI', 'raccoglitori', 'ALFA SRL', 'ACI', 110, 10),
  voce('ACI', 'raccoglitori', 'SMOCO S.R.L.', '', 0, 20, { note: 'Interno: non fatturato.' }),
  voce('ACI', 'impianti', 'BETA IMPIANTI', '', 95, 10, { colonna_prezzo: 'trattamento' }),
];
const passiva = (canale, surplusAll) => calcolaPassivaMese({ ...ARCHIVI, surplusAll }, 2026, 9, 'Ottobre', canale);
const PR = passiva('RETE', FS);
const PR0 = passiva('RETE', []);
const PA = passiva('ACI', FS);
const PA0 = passiva('ACI', []);
const sue = (blocco, soggetto) => blocco.righe.filter(r => r.soggetto === soggetto);

let RETE = null, ACI = null, RETE0 = null, ACI0 = null;
await sezione('1. IL FOGLIO: LA RIGA DEL SURPLUS SOTTO IL SOGGETTO, LE TONNELLATE UNA VOLTA SOLA', async () => {
  RETE = foglioPassiva(VOCI, PR, 'RETE', 'Ottobre', 2026, TARIFFE);
  RETE0 = foglioPassiva(VOCI, PR0, 'RETE', 'Ottobre', 2026, TARIFFE);
  ACI = foglioPassiva(VOCI, PA, 'ACI', 'Ottobre', 2026, TARIFFE);
  ACI0 = foglioPassiva(VOCI, PA0, 'ACI', 'Ottobre', 2026, TARIFFE);
  const alfa = sue(RETE.raccoglitori, 'ALFA SRL');
  verifica('ALFA: soggetto, la sua voce, poi la riga del surplus', J(alfa.map(r => r.tipo)) === J(['soggetto', 'voce', 'surplus']), J(alfa.map(r => r.tipo)));
  const s = alfa.find(r => r.tipo === 'surplus') || {};
  verifica('la riga del surplus: Fuel Surcharge, 12,50 t, 5,00 €/t, 62,50 €', s.nome === 'Fuel Surcharge' && s.tonnellate === 12.5 && s.prezzo === 5 && s.totale === 62.5 && s.unita_misura === 'euro_tonnellata', J(s));
  verifica('e la nota dice da dove viene, quando vale e che le tonnellate non si sommano',
    /consorzio Ecotyre/.test(s.note) && /dal 01\/10\/2026 al 31\/12\/2026/.test(s.note) && /non si sommano/.test(s.note), s.note);
  const sog = alfa[0];
  verifica('il soggetto: 12,50 t (non 25), 812,50 € (750 + 62,50)', sog.tonnellate === 12.5 && sog.totale === 812.5 && sog.totale_standard === 750 && sog.totale_surplus === 62.5, J(sog));
  verifica('il blocco: tonnellate come senza surplus (15,50), euro con (812,50)',
    RETE.raccoglitori.totale_t === RETE0.raccoglitori.totale_t && RETE.raccoglitori.totale_t === 15.5
    && RETE.raccoglitori.totale_euro === 812.5 && RETE0.raccoglitori.totale_euro === 750
    && RETE.raccoglitori.totale_surplus === 62.5 && RETE.raccoglitori.totale_standard === 750, J([RETE.raccoglitori.totale_t, RETE.raccoglitori.totale_euro, RETE.raccoglitori.totale_surplus]));
  verifica('SMOCO e\' interno: nessuna riga del surplus', !sue(RETE.raccoglitori, 'SMOCO S.R.L.').some(r => r.tipo === 'surplus') && !sue(ACI.raccoglitori, 'SMOCO S.R.L.').some(r => r.tipo === 'surplus'));
  const gamma = sue(RETE.raccoglitori, 'GAMMA SRL');
  verifica('GAMMA nel mese non ha portato niente: la riga del surplus c\'e\', a zero, col prezzo',
    J(gamma.map(r => [r.tipo, r.tonnellate, r.totale])) === J([['soggetto', 0, 0], ['voce', 0, 0], ['surplus', 0, 0]]) && gamma[2].prezzo === 5, J(gamma));
  verifica('il Fuel Surcharge e\' sulla raccolta: negli impianti nessuna riga', !RETE.impianti.righe.some(r => r.tipo === 'surplus') && RETE.impianti.totale_surplus === 0);
  verifica('il canale: 2.052,50 € (1.990,00 + 62,50), di cui surplus 62,50', RETE.totale_euro === 2052.5 && RETE0.totale_euro === 1990 && RETE.totale_surplus === 62.5, J([RETE.totale_euro, RETE.totale_surplus]));
  verifica('il canale sa quali surplus ha nel mese', J(RETE.surplus.map(x => [x.nome, x.euro_t, x.prestazione])) === J([['Fuel Surcharge', 5, 'RACCOLTA']]), J(RETE.surplus));
  // L'ACI e' piatta: niente righe di soggetto stampate, ma i numeri sono gli stessi.
  const sa = ACI.raccoglitori.righe.find(r => r.tipo === 'surplus' && r.soggetto === 'ALFA SRL') || {};
  verifica('ACI: 2,345 t (i chili non tondi restano) a 5,00 = 11,73 € (il mezzo centesimo in su)', sa.tonnellate === 2.345 && sa.totale === 11.73, J(sa));
  verifica('ACI: il blocco in tonnellate come senza surplus, in euro 257,95 + 11,73', ACI.raccoglitori.totale_t === ACI0.raccoglitori.totale_t && ACI.raccoglitori.totale_euro === 269.68, J([ACI.raccoglitori.totale_t, ACI.raccoglitori.totale_euro]));
  // Senza surplus il foglio e' quello di prima: nessuna riga in piu', stessi numeri.
  const pulito = (f) => J({ ...f, surplus: undefined, totale_surplus: undefined, raccoglitori: { ...f.raccoglitori, totale_standard: undefined, totale_surplus: undefined, righe: f.raccoglitori.righe.map(r => ({ ...r, totale_standard: undefined, totale_surplus: undefined })) }, impianti: { ...f.impianti, totale_standard: undefined, totale_surplus: undefined, righe: f.impianti.righe.map(r => ({ ...r, totale_standard: undefined, totale_surplus: undefined })) }, trasporti: { ...f.trasporti, totale_standard: undefined, totale_surplus: undefined } });
  verifica('senza surplus: nessuna riga del surplus e il canale a 1.990,00', !RETE0.raccoglitori.righe.some(r => r.tipo === 'surplus') && RETE0.totale_surplus === 0);
  // Il surplus vero comincia il 01/10: a settembre il foglio e' identico a senza.
  const set = calcolaPassivaMese({ ...ARCHIVI, primarieRete: ARCHIVI.primarieRete.map(r => ({ ...r, trasporto_finito_il: r.trasporto_finito_il.replace('2026-10', '2026-09') })), surplusAll: FS }, 2026, 8, 'Settembre', 'RETE');
  const set0 = calcolaPassivaMese({ ...ARCHIVI, primarieRete: ARCHIVI.primarieRete.map(r => ({ ...r, trasporto_finito_il: r.trasporto_finito_il.replace('2026-10', '2026-09') })), surplusAll: [] }, 2026, 8, 'Settembre', 'RETE');
  verifica('il Fuel Surcharge dal 01/10 non tocca il foglio di settembre', pulito(foglioPassiva(VOCI, set, 'RETE', 'Settembre', 2026, TARIFFE)) === pulito(foglioPassiva(VOCI, set0, 'RETE', 'Settembre', 2026, TARIFFE)));
  // Un fornitore senza righe di dettaglio porta il suo totale: lo STANDARD,
  // perche' il surplus ha la sua riga. Col totale si pagherebbe due volte.
  const piatte = AMM.righePiatte([{ fornitore: 'ALFA SRL', interno: false, righe: [], totale_tonnellate: 12.5, totale_standard: 750, totale_surplus: 62.5, totale_euro: 812.5, surplus: PR.raccoglitori[0].surplus }]);
  verifica('un fornitore senza dettaglio porta lo standard, non il totale col surplus', piatte.length === 1 && piatte[0].importo === 750, J(piatte));
  const soloTotale = foglioPassiva(VOCI, { ...PR, raccoglitori: [{ ...PR.raccoglitori[0], righe: [] }] }, 'RETE', 'Ottobre', 2026, TARIFFE);
  verifica('e il suo soggetto nel foglio fa 812,50, non 875,00', sue(soloTotale.raccoglitori, 'ALFA SRL')[0].totale === 812.5, J(sue(soloTotale.raccoglitori, 'ALFA SRL')));
});

// ─── IL FOGLIO EXCEL ───
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
const lettera = (c) => String.fromCharCode(64 + c);
const colonna = (l) => l.charCodeAt(0) - 64;
/** Le celle di una formula SUM (intervalli e celle singole), come { riga, colonna }. */
const celleDi = (f) => {
  const m = /^SUM\((.*)\)$/.exec(f);
  const pezzi = m ? m[1].split(',') : f.split('+');
  const fuori = [];
  for (const p of pezzi) {
    const iv = /^([A-Z])(\d+):([A-Z])(\d+)$/.exec(p.trim());
    if (iv) { for (let r = Number(iv[2]); r <= Number(iv[4]); r++) fuori.push({ r, c: colonna(iv[1]) }); continue; }
    const una = /^([A-Z])(\d+)$/.exec(p.trim());
    if (una) fuori.push({ r: Number(una[2]), c: colonna(una[1]) });
  }
  return fuori;
};
const cent = (v) => Math.round(Number((Math.abs(v) * 100).toPrecision(15))) / 100 * Math.sign(v || 1);
const pulisci = (v) => Math.round(v * 1e6) / 1e6;
/** Gli addendi di una formula, separati dai + fuori dalle parentesi. */
const addendi = (f) => {
  const fuori = [];
  let livello = 0, da = 0;
  for (let i = 0; i < f.length; i++) {
    if (f[i] === '(') livello++;
    else if (f[i] === ')') livello--;
    else if (f[i] === '+' && !livello) { fuori.push(f.slice(da, i)); da = i + 1; }
  }
  fuori.push(f.slice(da));
  return fuori.map(x => x.trim()).filter(Boolean);
};
/**
 * Il valore di una cella come lo rifa' Excel, per le formule che il foglio
 * scrive: somme di addendi, ciascuno ROUND(X*Y;2), SUM(...), una cella o un
 * numero. Solo ROUND arrotonda al centesimo, come in Excel.
 */
const ricalcola = (ws, r, c, profondo = 0) => {
  const f = formula(ws, r, c);
  if (!f || profondo > 6) return Number(val(ws, r, c)) || 0;
  const cella = (l, n) => ricalcola(ws, Number(n), colonna(l), profondo + 1);
  return pulisci(addendi(f).reduce((s, a) => {
    const round = /^ROUND\(([A-Z])(\d+)\*([A-Z])(\d+),2\)$/.exec(a);
    if (round) return s + cent(cella(round[1], round[2]) * cella(round[3], round[4]));
    const una = /^([A-Z])(\d+)$/.exec(a);
    if (una) return s + cella(una[1], una[2]);
    if (/^SUM\(/.test(a)) return s + celleDi(a).reduce((x, y) => x + ricalcola(ws, y.r, y.c, profondo + 1), 0);
    return s + (Number(a) || 0);
  }, 0));
};
const apri = async (bytes) => { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(bytes)); return wb; };

await sezione('2. IL FOGLIO EXCEL: LE SOMME DELLE TONNELLATE NON PRENDONO IL SURPLUS, QUELLE DEGLI EURO SI\'', async () => {
  const wb = await apri(await cartellaPassivaUnFoglio([RETE, ACI]));
  const ws = wb.getWorksheet('PASSIVA');
  // RETE, a due livelli: la riga di ALFA, la sua voce, la riga del surplus.
  const [rAlfa] = righeCon(ws, 'ALFA SRL');
  const rS = righeCon(ws, 'Fuel Surcharge · consorzio Ecotyre')[0];
  verifica('la riga del surplus sta subito sotto la voce di ALFA', rS === rAlfa + 2, `${rAlfa} ${rS}`);
  verifica('le sue tonnellate sono un numero (12,5) col formato fra parentesi', val(ws, rS, 2) === 12.5 && ws.getCell(rS, 2).numFmt === '(#,##0.00)', `${val(ws, rS, 2)} ${ws.getCell(rS, 2).numFmt}`);
  verifica('il prezzo 5 nella colonna del costo, il totale e\' =ROUND(B*C;2) con dentro 62,50',
    val(ws, rS, 3) === 5 && formula(ws, rS, 5) === `ROUND(B${rS}*C${rS},2)` && val(ws, rS, 5) === 62.5, `${val(ws, rS, 3)} ${formula(ws, rS, 5)} ${val(ws, rS, 5)}`);
  verifica('e la barra indaco e\' il bordo sinistro della prima cella', ((ws.getCell(rS, 1).border || {}).left || {}).style === 'thick', J(ws.getCell(rS, 1).border));
  const fT = formula(ws, rAlfa, 2), fE = formula(ws, rAlfa, 5);
  const inT = celleDi(fT).map(x => x.r), inE = celleDi(fE).map(x => x.r);
  verifica('ALFA in tonnellate somma la voce e NON il surplus', inT.includes(rAlfa + 1) && !inT.includes(rS), fT);
  verifica('ALFA in euro somma la voce E il surplus', inE.includes(rAlfa + 1) && inE.includes(rS), fE);
  verifica('rifatto come Excel, ALFA fa 12,50 t e 812,50 €', ricalcola(ws, rAlfa, 2) === 12.5 && ricalcola(ws, rAlfa, 5) === 812.5, `${ricalcola(ws, rAlfa, 2)} ${ricalcola(ws, rAlfa, 5)}`);
  const [rTot] = righeCon(ws, 'Totale complessivo');
  verifica('il Totale complessivo dei raccoglitori, rifatto: 15,50 t e 812,50 €', ricalcola(ws, rTot, 2) === 15.5 && ricalcola(ws, rTot, 5) === 812.5 && val(ws, rTot, 2) === 15.5 && val(ws, rTot, 5) === 812.5,
    `${ricalcola(ws, rTot, 2)} ${ricalcola(ws, rTot, 5)} ${formula(ws, rTot, 2)} ${formula(ws, rTot, 5)}`);
  const rG = righeCon(ws, 'Fuel Surcharge · consorzio Ecotyre')[1];
  verifica('la riga a zero di GAMMA: 0 t, 5,00, =ROUND(...) a zero', rG && val(ws, rG, 2) === 0 && val(ws, rG, 3) === 5 && /^ROUND/.test(formula(ws, rG, 5)), String(rG));
  // La fascia del canale: il totale e accanto il «di cui».
  const [rFascia] = righeCon(ws, 'RETE ·');
  verifica('la fascia della rete: totale 2.052,50 e «di cui Fuel Surcharge» 62,50 come formula sulle righe del surplus',
    val(ws, rFascia, 5) === 2052.5 && testo(ws, rFascia, 6) === 'di cui Fuel Surcharge' && val(ws, rFascia, 7) === 62.5 && ricalcola(ws, rFascia, 7) === 62.5 && ricalcola(ws, rFascia, 5) === 2052.5,
    `${val(ws, rFascia, 5)} ${testo(ws, rFascia, 6)} ${formula(ws, rFascia, 7)} ${ricalcola(ws, rFascia, 5)}`);
  // ACI, piatta: la riga del surplus porta davanti il soggetto, e il totale del
  // blocco somma le voci e i surplus, ma le tonnellate solo delle voci.
  const [rSa] = righeCon(ws, 'ALFA SRL - (Fuel Surcharge)');
  verifica('ACI: «ALFA SRL - (Fuel Surcharge)», 2,345 t col formato a tre decimali fra parentesi', rSa && val(ws, rSa, 2) === 2.345 && ws.getCell(rSa, 2).numFmt === '(#,##0.000)', String(rSa));
  const rTotAci = righeCon(ws, 'Totale complessivo').find(r => r > rSa);
  const tAci = celleDi(formula(ws, rTotAci, 2)).map(x => x.r), eAci = celleDi(formula(ws, rTotAci, 5)).map(x => x.r);
  verifica('ACI: il Totale complessivo in tonnellate non prende la riga del surplus, in euro si\'', !tAci.includes(rSa) && eAci.includes(rSa), `${formula(ws, rTotAci, 2)} | ${formula(ws, rTotAci, 5)}`);
  verifica('ACI rifatto come Excel: 4,835 t e 269,68 €', ricalcola(ws, rTotAci, 2) === 4.835 && ricalcola(ws, rTotAci, 5) === 269.68, `${ricalcola(ws, rTotAci, 2)} ${ricalcola(ws, rTotAci, 5)}`);
  verifica('la nota in fondo spiega le righe del surplus', righeCon(ws, 'surplus sulle tariffe').length >= 1);
  // Senza surplus: nessuna riga, nessun «di cui», e la nota non ne parla.
  const ws0 = (await apri(await cartellaPassivaUnFoglio([RETE0, ACI0]))).getWorksheet('PASSIVA');
  verifica('senza surplus: niente righe, niente «di cui», niente nota', !righeCon(ws0, 'Fuel Surcharge').length && !testo(ws0, righeCon(ws0, 'RETE ·')[0], 6) && !righeCon(ws0, 'surplus sulle tariffe').length);
  const fascia0 = righeCon(ws0, 'RETE ·')[0];
  verifica('e le formule di prima: il totale della rete 1.990,00', val(ws0, fascia0, 5) === 1990 && ricalcola(ws0, fascia0, 5) === 1990);
  // Un foglio per canale: lo stesso.
  const wbC = await apri(await cartellaPassivaPerCanale([RETE, ACI]));
  const wr = wbC.getWorksheet('RETE');
  verifica('un foglio per canale: la riga del surplus e la fascia anche li\'', righeCon(wr, 'Fuel Surcharge · consorzio Ecotyre').length === 2 && val(wr, righeCon(wr, 'RETE ·')[0], 7) === 62.5);
});

await sezione('3. IL FILE DEL CANALE: LE TONNELLATE DEL SURPLUS SONO TESTO', async () => {
  const righe = righePassiva(PR);
  const i = righe.findIndex(r => r && /Fuel Surcharge \(consorzio Ecotyre\), dal 01\/10\/2026 al 31\/12\/2026/.test(String(r[0])));
  verifica('sotto le righe di ALFA la riga «Fuel Surcharge (consorzio Ecotyre), dal 01/10/2026 al 31/12/2026»', i > 0 && righe[i - 2][0] === 'ALFA SRL', J(righe.slice(i - 2, i + 1)));
  verifica('tonnellate «(12,50)» come testo, 5 €/t, 62,50 €', righe[i] && righe[i][1] === '(12,50)' && righe[i][2] === 5 && righe[i][3] === '€\\t' && righe[i][5] === 62.5, J(righe[i]));
  const gruppo = righe[i - 2];
  verifica('la riga di ALFA: 12,5 t, 812,50 €, e la nota dice come si compone', gruppo[1] === 12.5 && gruppo[5] === 812.5 && /standard 750,00 € \+ Fuel Surcharge 62,50 €/.test(gruppo[6]), J(gruppo));
  const numeri = righe.slice(0, righe.findIndex(r => r && r[0] === 'Totale complessivo')).filter(r => r && typeof r[1] === 'number' && String(r[0]).startsWith('   ')).reduce((s, r) => s + r[1], 0);
  verifica('chi somma la colonna delle tonnellate del dettaglio dei raccoglitori trova 15,5, non 28', numeri === 15.5, String(numeri));
  const tot = righe.find(r => r && r[0] === 'Totale complessivo');
  const diCui = righe.find(r => r && r[0] === '   di cui Fuel Surcharge');
  verifica('il Totale complessivo comprende il surplus e sotto c\'e\' il «di cui»', tot[1] === 15.5 && tot[5] === 812.5 && diCui && diCui[5] === 62.5, J([tot, diCui]));
  verifica('in testa il totale del canale e il suo «di cui»', righe[0][6] === 2052.5 && righe[1][5] === 'di cui Fuel Surcharge' && righe[1][6] === 62.5, J(righe.slice(0, 2)));
  const senza = righePassiva(PR0);
  verifica('senza surplus il file e\' quello di prima: nessuna riga del surplus e nessun «di cui»', !senza.some(r => r && /Fuel Surcharge|di cui/.test(String(r[0]) + String(r[5]))) && senza[0][6] === 1990);
});

await sezione('4. L\'EXTRA RACCOLTA: IL SURPLUS IN FONDO AGLI INTERVENTI, UNA VOLTA SOLA', async () => {
  // Due interventi primari di ottobre, uno di EMMESSE (esterno) e uno di SMOCO
  // (interno). Il blocco degli interventi e' quello del modulo, e del modulo e'
  // anche il surplus (bloccoExtraRaccolta col contesto della pagina): qui prima
  // il blocco senza surplus e il calcolo della passiva (la riserva), poi il
  // blocco col surplus del modulo, che deve vincere senza sommarsi.
  const intervento = (id, trasportatore, kg) => ({
    id, stato: 'terminato', tipo_movimento: 'primaria', numero_fir: 'FIR' + id, id_ordine: 'EX' + id, trasportatore, produttore: 'COMUNE DI PROVA',
    destinazione: 'BETA IMPIANTI', peso_effettivo: kg, costo_raccolta_t: 90, costo_trattamento_t: 95,
    ordine_immesso_il: '2026-10-02T08:00:00.000Z', trasporto_iniziato_il: '2026-10-10T08:00:00.000Z', trasporto_finito_il: '2026-10-10T08:00:00.000Z',
  });
  const EX = [intervento('1', 'EMMESSE SRLS', 2631), intervento('2', 'SMOCO S.R.L.', 460)];
  const pe = calcolaPassivaMese({ ...ARCHIVI, extraRaccoltaAll: EX, fornitoriAll: [...FORNITORI, { id: 'f-em', ragione_sociale: 'EMMESSE SRLS', stato: 'attivo' }], surplusAll: FS }, 2026, 9, 'Ottobre', 'EXTRA_RACCOLTA');
  const blocco = {
    righe: [
      { numero_fir: 'FIR1', ordine: 'EX1', produttore: 'COMUNE DI PROVA', trasportatore: 'EMMESSE SRLS', destinatario: 'BETA IMPIANTI', inizio: '2026-10-10', fine: '2026-10-10', cer: '160103', kg: 2631, tonnellate: 2.631, raccolta_t: 90, stoccaggio_t: 0, trattamento_t: 95, trasporto_viaggio: 0, oneri: 0, totale: 486.74, note: '' },
      { numero_fir: 'FIR2', ordine: 'EX2', produttore: 'COMUNE DI PROVA', trasportatore: 'SMOCO S.R.L.', destinatario: 'BETA IMPIANTI', inizio: '2026-10-10', fine: '2026-10-10', cer: '160103', kg: 460, tonnellate: 0.46, raccolta_t: 0, stoccaggio_t: 0, trattamento_t: 95, trasporto_viaggio: 0, oneri: 0, totale: 43.7, note: '' },
    ],
    totale_kg: 3091, totale_t: 3.091, totale_euro: 530.44, senza_costi: [], senza_peso: [], senza_data: [],
  };
  const f = foglioPassiva(VOCI, pe, 'EXTRA_RACCOLTA', 'Ottobre', 2026, TARIFFE, blocco);
  const righeS = (f.extra && f.extra.surplus) || [];
  verifica('una riga del surplus, di EMMESSE: 2,631 t a 5,00 = 13,16 €; SMOCO no', J(righeS.map(r => [r.soggetto, r.tonnellate, r.prezzo, r.totale, r.prestazione])) === J([['EMMESSE SRLS', 2.631, 5, 13.16, 'RACCOLTA']]), J(righeS));
  verifica('gli interventi restano quelli del modulo, e il blocco li somma col surplus', f.extra.righe.length === 2 && f.extra.totale_interventi === 530.44 && f.extra.totale_surplus === 13.16 && f.extra.totale_euro === 543.6 && f.totale_euro === 543.6, J([f.extra.totale_interventi, f.extra.totale_surplus, f.extra.totale_euro, f.totale_euro]));
  verifica('il peso del blocco resta quello degli interventi', f.extra.totale_t === 3.091 && f.extra.totale_kg === 3091);
  verifica('i blocchi di rete del foglio restano vuoti, come prima', !f.raccoglitori.righe.length && !f.impianti.righe.length && !f.trasporti.righe.length);
  const ws = (await apri(await cartellaPassivaPerCanale([f]))).getWorksheet('EXTRA RACCOLTA');
  const [rS] = righeCon(ws, 'Fuel Surcharge · consorzio Ecotyre', 3);
  verifica('nel foglio: la riga in fondo agli interventi, EMMESSE fra i trasportatori, 5,00 nella colonna della raccolta', rS && testo(ws, rS, 4) === 'EMMESSE SRLS' && val(ws, rS, 11) === 5 && val(ws, rS, 10) === 2.631 && formula(ws, rS, 16) === `ROUND(J${rS}*K${rS},2)`, `${rS} ${testo(ws, rS, 4)} ${formula(ws, rS, 16)}`);
  const [rTot] = righeCon(ws, 'Totale extra raccolta');
  const sT = celleDi(formula(ws, rTot, 10)).map(x => x.r), sE = celleDi(formula(ws, rTot, 16)).map(x => x.r), sKg = celleDi(formula(ws, rTot, 9)).map(x => x.r);
  verifica('il totale: chili e tonnellate senza la riga del surplus, euro con', !sT.includes(rS) && !sKg.includes(rS) && sE.includes(rS), `${formula(ws, rTot, 9)} ${formula(ws, rTot, 10)} ${formula(ws, rTot, 16)}`);
  verifica('rifatto come Excel: 3,091 t e 543,60 €', ricalcola(ws, rTot, 10) === 3.091 && ricalcola(ws, rTot, 16) === 543.6, `${ricalcola(ws, rTot, 10)} ${ricalcola(ws, rTot, 16)}`);
  // Senza il calcolo (come prima: un oggetto vuoto) il blocco e' identico.
  const f0 = foglioPassiva(VOCI, {}, 'EXTRA_RACCOLTA', 'Ottobre', 2026, TARIFFE, blocco);
  verifica('senza surplus il blocco dell\'extra raccolta e il totale sono quelli di prima', f0.totale_euro === 530.44 && f0.extra.totale_euro === 530.44 && !(f0.extra.surplus || []).length);

  // Il blocco del modulo col surplus gia' dentro, nella forma di
  // bloccoExtraRaccolta col contesto: righe per fornitore, totale_standard, e
  // totale_euro che li comprende. Il foglio le veste e non le somma una seconda
  // volta, nemmeno se chi chiama passa anche il calcolo.
  const rigaModulo = { fornitore: 'EMMESSE SRLS', surplus_id: 'fs-extra', nome: 'Fuel Surcharge', origine: 'consorzio Ecotyre', riferimento: 'comunicazione Ecotyre', prestazione: 'RACCOLTA', euro_t: 5, kg: 2631, tonnellate: 2.631, importo: 13.16, dal: '2026-10-01', al: '2026-12-31', etichetta: 'Fuel Surcharge (consorzio Ecotyre), dal 01/10/2026 al 31/12/2026', interventi: 1, note: 'consorzio Ecotyre, dal 01/10/2026 al 31/12/2026: sulle stesse tonnellate dell\'intervento del mese, già nelle righe qui sopra' };
  const bloccoModulo = { ...blocco, surplus: [rigaModulo], surplus_interni: [], totale_standard: 530.44, totale_surplus: 13.16, totale_euro: 543.6 };
  for (const [come, p] of [['dal modulo', {}], ['dal modulo, anche col calcolo passato', pe]]) {
    const fm = foglioPassiva(VOCI, p, 'EXTRA_RACCOLTA', 'Ottobre', 2026, TARIFFE, bloccoModulo);
    verifica(`${come}: una riga di EMMESSE, 13,16 €, con la nota del modulo, e il canale a 543,60 (non 556,76)`,
      J(fm.extra.surplus.map(r => [r.tipo, r.soggetto, r.tonnellate, r.prezzo, r.totale])) === J([['surplus', 'EMMESSE SRLS', 2.631, 5, 13.16]])
      && /dell'intervento del mese/.test(fm.extra.surplus[0].note) && fm.extra.totale_interventi === 530.44 && fm.extra.totale_euro === 543.6 && fm.totale_euro === 543.6 && fm.totale_surplus === 13.16,
      J([fm.extra.surplus, fm.extra.totale_euro, fm.totale_euro]));
  }
  // Il modulo vero, se c'e' gia' il suo surplus: lo stesso numero del calcolo.
  const subfornitori = await caricaLibPagine('lib/subfornitori');
  const calc = await caricaLibPagine('lib/extraRaccoltaCalc');
  const { bloccoExtraRaccolta } = await caricaLibPagine('lib/extraRaccoltaAmministrazione');
  const vero = typeof calc.contestoPrezzi === 'function'
    ? bloccoExtraRaccolta(EX, 2026, 'Ottobre', calc.contestoPrezzi([], [...FORNITORI, { id: 'f-em', ragione_sociale: 'EMMESSE SRLS', stato: 'attivo' }], FS, subfornitori))
    : null;
  if (vero && Array.isArray(vero.surplus) && vero.totale_standard !== undefined) {
    const fv = foglioPassiva(VOCI, {}, 'EXTRA_RACCOLTA', 'Ottobre', 2026, TARIFFE, vero);
    const dalCalcolo = (pe.raccoglitori || []).flatMap(g => (g.surplus || []).map(s => [g.fornitore, s.tonnellate, s.importo]));
    verifica('col blocco vero del modulo il foglio dice il numero del calcolo della passiva (EMMESSE 2,631 t, 13,16 €)',
      J(fv.extra.surplus.map(r => [r.soggetto, r.tonnellate, r.totale])) === J(dalCalcolo) && fv.totale_euro === n2(vero.totale_standard + 13.16),
      J([fv.extra.surplus.map(r => [r.soggetto, r.tonnellate, r.totale]), dalCalcolo, fv.totale_euro]));
  } else {
    console.log('  Il modulo dell\'extra raccolta non conta ancora il surplus: il confronto col calcolo si salta.');
  }
});
function n2(v) { return Math.round((Number(v) || 0) * 100) / 100; }

await sezione('5. IL PDF DELL\'AMMINISTRAZIONE', async () => {
  globalThis.__TESTI_SURPLUS = [];
  class PdfFinto {
    constructor() { this.internal = { pageSize: { getWidth: () => 297, getHeight: () => 210 } }; }
    setFont() {} setFontSize() {} setTextColor() {} setFillColor() {} setDrawColor() {} setLineWidth() {}
    rect() {} roundedRect() {} line() {}
    text(t) { globalThis.__TESTI_SURPLUS.push(Array.isArray(t) ? t.join(' ') : String(t)); }
    splitTextToSize(s) { return String(s).split('\n'); }
    addPage() {} save() {}
  }
  globalThis.__PDF_FINTO_SURPLUS = { jsPDF: PdfFinto };
  // Il PDF prende il nome del file dal foglio: il modulo gia' caricato si passa
  // al posto del suo import, che dentro un modulo caricato cosi' non si risolve.
  globalThis.__AMM_SURPLUS = AMM;
  const { esportaPassivaAmministrazionePdf } = await caricaLibPagine('lib/passivaAmministrazionePdf', [
    ["const { jsPDF } = await import('jspdf');", 'const { jsPDF } = globalThis.__PDF_FINTO_SURPLUS;'],
    [/import \{([^}]*)\} from '@\/lib\/passivaAmministrazione';/, 'const {$1} = globalThis.__AMM_SURPLUS;'],
  ]);
  await esportaPassivaAmministrazionePdf([RETE, ACI], { anno: 2026, mese: 'Ottobre' });
  const T = globalThis.__TESTI_SURPLUS;
  verifica('la riga del surplus: «Fuel Surcharge · consorzio Ecotyre», (12,50), 62,50 €', T.includes('Fuel Surcharge · consorzio Ecotyre') && T.includes('(12,50)') && T.includes('62,50 €'), T.filter(t => /Fuel|\(12/.test(t)).join(' | '));
  verifica('nell\'ACI piatta «ALFA SRL - (Fuel Surcharge)» e (2,345)', T.includes('ALFA SRL - (Fuel Surcharge)') && T.includes('(2,345)'));
  verifica('i riquadri dicono «di cui Fuel Surcharge 62,50 €»', T.filter(t => t === 'di cui Fuel Surcharge 62,50 €').length >= 2, T.filter(t => /di cui/.test(t)).join(' | '));
  verifica('i riquadri dei raccoglitori: 15,50 t raccolte, non 28', T.includes('15,50 t raccolte'));
  verifica('la legenda spiega le righe del surplus', T.some(t => /surplus sulle tariffe/.test(t)));
  globalThis.__TESTI_SURPLUS = [];
  await esportaPassivaAmministrazionePdf([RETE0, ACI0], { anno: 2026, mese: 'Ottobre' });
  verifica('senza surplus il PDF non ne parla', !globalThis.__TESTI_SURPLUS.some(t => /surplus|Fuel/i.test(t)));
});

await sezione('6. LA PAGINA: LE TRE TABELLE E LE FASCE, DISEGNATE', async () => {
  const ESTENSIONI = ['', '.js', '.jsx', '.ts'];
  const daAlias = (p) => { const base = qui('../src/' + p.slice(2)); return ESTENSIONI.map(e => base + e).find(x => existsSync(x) && /\.\w+$/.test(x)) || base; };
  const INGRESSO = `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import PassivaRaccoglitoriTable from ${J(qui('../src/components/fatturazione/PassivaRaccoglitoriTable.jsx'))};
import PassivaImpiantiTable from ${J(qui('../src/components/fatturazione/PassivaImpiantiTable.jsx'))};
import PassivaSecondariaTable from ${J(qui('../src/components/fatturazione/PassivaSecondariaTable.jsx'))};
import * as S from ${J(qui('../src/components/fatturazione/PassivaSurplus.jsx'))};
const C = { PassivaRaccoglitoriTable, PassivaImpiantiTable, PassivaSecondariaTable, FasceSurplus: S.FasceSurplus };
export const disegna = (nome, props) => renderToStaticMarkup(React.createElement(C[nome], props));
`;
  const pacchetto = await build({
    stdin: { contents: INGRESSO, resolveDir: qui('.'), loader: 'js' },
    bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent',
    loader: { '.jsx': 'jsx', '.js': 'jsx' },
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'alias', setup(b) { b.onResolve({ filter: /^@\// }, (args) => ({ path: daAlias(args.path) })); } }],
  });
  const L = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
  const piano = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ');
  const html = L.disegna('PassivaRaccoglitoriTable', { data: PR.raccoglitori });
  const t = piano(html);
  verifica('la tabella dei raccoglitori: la riga «Surplus Fuel Surcharge» con (12,50), 5,00 €/t e 62,50',
    /Surplus Fuel Surcharge consorzio Ecotyre · dal 01\/10\/2026 al 31\/12\/2026 \(12,50\) — 5,00 €\/t 62,50/.test(t), t.slice(0, 600));
  verifica('prima del totale di ALFA, che dice 812,50 e come si compone', /62,50 sulle stesse tonnellate del mese Totale ALFA SRL 12,50 812,50 standard 750,00 · surplus 62,50/.test(t), t.slice(0, 700));
  verifica('una sola riga del surplus: SMOCO e\' interno', (t.match(/Surplus Fuel Surcharge/g) || []).length === 1);
  verifica('la riga ha la barretta del colore del surplus (il token --eco-surplus) e le tonnellate in corsivo grigio',
    /bg-\[hsl\(var\(--eco-surplus\)\)\]/.test(html) && /italic text-muted-foreground tabular-nums[^>]*>\(12,50\)/.test(html.replace(/<!-- -->/g, '')), '');
  const html0 = L.disegna('PassivaRaccoglitoriTable', { data: PR0.raccoglitori });
  verifica('senza surplus la tabella e\' quella di prima: niente riga, niente «standard · surplus»', !/Surplus|standard/.test(piano(html0)));
  // Le altre due tabelle con un surplus sul trattamento e sul trasporto (costruito
  // nella forma del calcolo: le tabelle mostrano quello che arriva).
  const sTratt = { ...PR.raccoglitori[0].surplus[0], prestazione: 'TRATTAMENTO', tonnellate: 15.5, importo: 31, euro_t: 2 };
  const imp = PR.impianti_stoccaggi.map(f => ({ ...f, surplus: [sTratt], totale_standard: f.totale_euro, totale_surplus: 31, totale_euro: f.totale_euro + 31 }));
  const ti = piano(L.disegna('PassivaImpiantiTable', { data: imp }));
  verifica('gli impianti: la riga del surplus sul trattamento, (15,50), 2,00 €/t, 31,00', /Surplus Fuel Surcharge .*sul trattamento \(15,50\) 2,00 €\/t 31,00/.test(ti), ti.slice(0, 500));
  const tras = [{ fornitore: 'TRANSAR SRL', interno: false, righe: [{ stoccaggio: 'NAPPI SUD', destinazione: 'BETA IMPIANTI', tonnellate: 10, viaggi: 1, tariffa_valore: 400, unita_misura: '€/viaggio', importo: 400 }], totale_tonnellate: 10, totale_standard: 400, totale_surplus: 20, totale_euro: 420, surplus: [{ ...sTratt, prestazione: 'TRASPORTO_SECONDARIA', tonnellate: 10, importo: 20 }] }];
  const ts = piano(L.disegna('PassivaSecondariaTable', { data: tras, tipologia: 'RETE' }));
  verifica('i trasporti: la riga del surplus, (10,00), 20,00 e il totale 420,00 con «standard 400,00 · surplus 20,00»', /Surplus Fuel Surcharge .*\(10,00\) — 2,00 €\/t 20,00 Totale TRANSAR SRL 10,00 t 420,00 standard 400,00 · surplus 20,00/.test(ts), ts.slice(0, 600));
  const tf = piano(L.disegna('FasceSurplus', { surplus: PR.surplus_del_mese }));
  verifica('la fascia: che cosa vale, a chi e quando', /Surplus Fuel Surcharge · consorzio Ecotyre · \+5,00 €\/t a tutti i raccoglitori · dal 01\/10\/2026 al 31\/12\/2026/.test(tf), tf);
  verifica('quanto si paga e a quanti, e che SMOCO non lo riceve', /Si paga sulla raccolta, sulle stesse tonnellate del mese: 12,50 t a 1 raccoglitore, 62,50 € ?\./.test(tf) && /SMOCO S\.R\.L\. \(interno\) 3,00 t: non si paga/.test(tf), tf);
  verifica('senza surplus nel mese, nessuna fascia', L.disegna('FasceSurplus', { surplus: [] }) === '');
  // Il modulo: i riquadri, le fasce sopra le tabelle, e il foglio
  // dell'amministrazione che chiede il calcolo anche per l'extra raccolta.
  const modulo = readFileSync(qui('../src/components/fatturazione/PassivaModulo.jsx'), 'utf8').replace(/\r/g, '');
  verifica('il modulo mostra le fasce del mese e il «di cui» nei riquadri', /<FasceSurplus surplus=\{result\.surplus_del_mese\}/.test(modulo) && (modulo.match(/<DiCuiSurplus /g) || []).length === 3 && /standard \{formatNumber\(result\.totali\.standard/.test(modulo));
  verifica('il foglio dell\'amministrazione conta il surplus dell\'extra raccolta col modulo: i surplus letti una volta, il contesto della pagina',
    /fetchAllClient\(base44\.entities\.SurplusTariffa, null, '-created_date'\)/.test(modulo)
    && /bloccoExtraRaccolta\(interventi, periodo\.anno, periodo\.mese, contestoPrezzi\(\[\], fornitori, surplusAll, subfornitori\)\)/.test(modulo)
    && !/SurplusTariffa, \{ stato/.test(modulo));
  verifica('e l\'extra raccolta non chiede niente al calcolo, come prima: niente surplus contato due volte', /if \(canale === 'EXTRA_RACCOLTA'\) \{[^}]*per\[canale\] = \{\};/.test(modulo));
});

await sezione('7. SUI DATI VERI: SETTEMBRE 2026', async () => {
  const CARTELLA = process.env.DATI_VERI || qui('../../dati-veri/');
  const copie = existsSync(CARTELLA) ? readdirSync(CARTELLA).filter(n => /^treadrider-dati-veri-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n)).sort() : [];
  if (!copie.length) { console.log(`  Nessuna copia dei dati veri in ${CARTELLA}: questa parte si salta.`); return; }
  const copia = copie[copie.length - 1];
  if (copia !== 'treadrider-dati-veri-2026-10-11.json.gz') { console.log(`  La copia ${copia} non e' quella dell'11/10/2026: i numeri del progetto si saltano.`); return; }
  const A = JSON.parse(gunzipSync(readFileSync(CARTELLA + copia)).toString('utf8')).archivi;
  const veri = {
    primarieRete: A.PrimariaRete || [], primarieAci: A.PrimariaAci || [], secondarieAll: A.Secondaria || [], extraRaccoltaAll: A.ExtraRaccolta || [],
    tariffeAll: (A.Tariffa || []).filter(t => String(t.direzione || 'PASSIVA') === 'PASSIVA'),
    fornitoriAll: (A.Fornitore || []).filter(x => x.stato === 'attivo'),
  };
  // Le voci: quelle dell'archivio vero, e il modello dell'amministrazione.
  const vociVere = (A.VocePassivaAmministrazione || []).filter(v => Number(v.anno) === 2026);
  const modello = modelloAmministrazione(2026);
  const settembre = (canale, s) => calcolaPassivaMese({ ...veri, surplusAll: s }, 2026, 8, 'Settembre', canale);
  const fsSet = ['RETE', 'ACI', 'EXTRA_RACCOLTA'].map(t => surplus('fs-' + t, t, { data_inizio_validita: '2026-09-01', data_fine_validita: '2026-09-30' }));
  const fsVero = ['RETE', 'ACI', 'EXTRA_RACCOLTA'].map(t => surplus('fs-' + t, t));
  for (const [nome, voci] of [['voci dell\'archivio', vociVere], ['modello', modello]]) {
    const r0 = foglioPassiva(voci, settembre('RETE', []), 'RETE', 'Settembre', 2026, veri.tariffeAll);
    const a0 = foglioPassiva(voci, settembre('ACI', []), 'ACI', 'Settembre', 2026, veri.tariffeAll);
    verifica(`${nome}, settembre senza surplus: rete 65.351,38 / 87.888,39 / 3.572,96 / 156.812,73 come prima`,
      J([r0.raccoglitori.totale_t, r0.raccoglitori.totale_euro, r0.impianti.totale_euro, r0.trasporti.totale_euro, r0.totale_euro]) === J([1120.24, 65351.38, 87888.39, 3572.96, 156812.73]), J([r0.raccoglitori.totale_t, r0.raccoglitori.totale_euro, r0.impianti.totale_euro, r0.trasporti.totale_euro, r0.totale_euro]));
    verifica(`${nome}, settembre senza surplus: ACI 1.509,38 / 2.873,89 / 49,20 / 4.432,47`,
      J([a0.raccoglitori.totale_euro, a0.impianti.totale_euro, a0.trasporti.totale_euro, a0.totale_euro]) === J([1509.38, 2873.89, 49.2, 4432.47]), J([a0.raccoglitori.totale_euro, a0.impianti.totale_euro, a0.trasporti.totale_euro, a0.totale_euro]));
    verifica(`${nome}: nessuna riga del surplus a settembre, nemmeno col Fuel Surcharge vero (dal 01/10)`,
      ![r0, a0, foglioPassiva(voci, settembre('RETE', fsVero), 'RETE', 'Settembre', 2026, veri.tariffeAll)].some(f => [...f.raccoglitori.righe, ...f.impianti.righe, ...f.trasporti.righe].some(r => r.tipo === 'surplus')));
    const r = foglioPassiva(voci, settembre('RETE', fsSet), 'RETE', 'Settembre', 2026, veri.tariffeAll);
    verifica(`${nome}, col Fuel Surcharge su settembre: raccoglitori 1.120,24 t come prima, 69.684,18 €, di cui 4.332,80`,
      r.raccoglitori.totale_t === 1120.24 && r.raccoglitori.totale_euro === 69684.18 && r.raccoglitori.totale_surplus === 4332.8, J([r.raccoglitori.totale_t, r.raccoglitori.totale_euro, r.raccoglitori.totale_surplus]));
    const NOVE = [['C.L. SERVICE S.R.L.', 2.14, 10.7], ['ECOLOGICAL SYSTEMS SRL', 22.48, 112.4], ['Ecorecuperi Srl', 101.63, 508.15], ['EMMESSE SRLS', 59.15, 295.75], ['GATIM S.R.L.', 63.02, 315.1],
      ['GREEN TYRE PROJECT SRL', 255.78, 1278.9], ['LOGISTICA & PNEUMATICI SRL', 124.8, 624], ['Nappi Sud Srl A Socio Unico', 187.6, 938], ['PNEUSERVICE CONVERSANO SRL', 49.96, 249.8]];
    const pagati = r.raccoglitori.righe.filter(x => x.tipo === 'surplus' && x.tonnellate > 0).map(x => [x.soggetto, x.tonnellate, x.totale]).sort((a, b) => a[0].localeCompare(b[0], 'it'));
    verifica(`${nome}: i nove raccoglitori del progetto, uno per uno, e SMOCO no`, J(pagati) === J([...NOVE].sort((a, b) => a[0].localeCompare(b[0], 'it'))) && !r.raccoglitori.righe.some(x => x.tipo === 'surplus' && /SMOCO/.test(x.soggetto)), J(pagati));
    verifica(`${nome}: il canale 161.145,53 € (156.812,73 + 4.332,80)`, r.totale_euro === 161145.53 && r.totale_surplus === 4332.8, J([r.totale_euro, r.totale_surplus]));
    const a = foglioPassiva(voci, settembre('ACI', fsSet), 'ACI', 'Settembre', 2026, veri.tariffeAll);
    verifica(`${nome}, ACI: 69,95 € (EMMESSE 61,75, Nappi Sud 8,20), raccoglitori 1.579,33, canale 4.502,42`,
      a.raccoglitori.totale_surplus === 69.95 && a.raccoglitori.totale_euro === 1579.33 && a.totale_euro === 4502.42
      && J(a.raccoglitori.righe.filter(x => x.tipo === 'surplus' && x.totale > 0).map(x => [x.soggetto, x.totale])) === J([['Nappi Sud Srl A Socio Unico', 8.2], ['EMMESSE SRLS', 61.75]]),
      J(a.raccoglitori.righe.filter(x => x.tipo === 'surplus').map(x => [x.soggetto, x.tonnellate, x.totale])));
    if (nome === 'modello') {
      // Il foglio Excel di settembre col Fuel Surcharge, rifatto come Excel.
      const ws = (await apri(await cartellaPassivaUnFoglio([r, a]))).getWorksheet('PASSIVA');
      const tot = righeCon(ws, 'Totale complessivo');
      verifica('Excel, settembre col Fuel Surcharge: i raccoglitori della rete rifatti fanno 1.120,24 t e 69.684,18 €',
        ricalcola(ws, tot[0], 2) === 1120.24 && ricalcola(ws, tot[0], 5) === 69684.18, `${ricalcola(ws, tot[0], 2)} ${ricalcola(ws, tot[0], 5)}`);
      const fascia = righeCon(ws, 'RETE ·')[0];
      verifica('e la rete in cima 161.145,53, di cui Fuel Surcharge 4.332,80', ricalcola(ws, fascia, 5) === 161145.53 && ricalcola(ws, fascia, 7) === 4332.8, `${ricalcola(ws, fascia, 5)} ${ricalcola(ws, fascia, 7)}`);
      const totAci = tot.filter(x => x > righeCon(ws, 'ACI ·')[0]);
      verifica('i raccoglitori ACI rifatti: 18,89 t e 1.579,33 €', ricalcola(ws, totAci[0], 2) === 18.89 && ricalcola(ws, totAci[0], 5) === 1579.33, `${ricalcola(ws, totAci[0], 2)} ${ricalcola(ws, totAci[0], 5)}`);
    }
  }
});

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
