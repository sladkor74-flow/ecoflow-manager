// IL FOGLIO EXCEL DELLA PASSIVA (src/lib/passivaAmministrazioneExcel.js).
//
// Si esportano due canali - la rete con le voci rientrate, l'ACI piatto e con
// due colonne di prezzo - e si rilegge la cartella con exceljs, cella per
// cella. Non si controlla che sia bello: si controlla quello che si rompe senza
// farsi vedere, cioe' le FORMULE (il totale di una voce, la somma di un
// fornitore, il «Totale complessivo», il totale del canale) e la COLONNA in cui
// finisce un prezzo, perche' con due prezzi scriverlo nell'altra colonna vuol
// dire fatturare un trattamento come uno stoccaggio.
//
// I numeri sono quelli veri di settembre 2026 dove ci sono (le quattro voci di
// LOGISTICA & PNEUMATICI, i viaggi delle secondarie della rete); gli altri sono
// scelti perche' i conti tornino a mano. node prove/passivaAmministrazioneExcel.mjs
import { createRequire } from 'node:module';
import { caricaLibPagine } from './dati/libPagine.mjs';

// Il modulo importa il corredo comune dei fogli con l'alias @/, che lo sa
// risolvere solo Vite: nelle prove ci pensa caricaLibPagine.
const { cartellaPassivaUnFoglio, cartellaPassivaPerCanale } = await caricaLibPagine('lib/passivaAmministrazioneExcel');

const ExcelJS = createRequire(import.meta.url)('exceljs');
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const SCURO = 'FF0F4C5C';
const MEDIO = 'FF1A7F8E';
const TONN = '#,##0.00';
const TONN3 = '#,##0.000';
const EURO = '#,##0.00 "€"';

// --- I due canali, nella forma che costruisce foglioPassiva -----------------
const RETE = {
  canale: 'RETE', nome_canale: 'RETE', mese: 'Settembre', anno: 2026, stile: 'due_livelli',
  raccoglitori: {
    titolo: 'RACCOGLITORI',
    etichetta_prezzo: 'Costo di Raccolta [€\\t]',
    due_prezzi: false,
    righe: [
      { tipo: 'soggetto', soggetto: 'LOGISTICA & PNEUMATICI SRL (*)', tonnellate: 124.8, totale: 8628.88 },
      { tipo: 'voce', soggetto: 'LOGISTICA & PNEUMATICI SRL (*)', voce: 'Campania - NAPOLI', tonnellate: 89.18, viaggi: 0, prezzo: 68, unita_misura: 'euro_tonnellata', colonna_prezzo: '', totale: 6064.24, note: '' },
      // Salerno e Avellino non hanno avuto conferimenti: le righe ci devono
      // essere comunque, altrimenti il foglio cambia forma ogni mese.
      { tipo: 'voce', soggetto: 'LOGISTICA & PNEUMATICI SRL (*)', voce: 'Campania - SALERNO', tonnellate: 0, viaggi: 0, prezzo: 68, unita_misura: 'euro_tonnellata', colonna_prezzo: '', totale: 0, note: '' },
      { tipo: 'voce', soggetto: 'LOGISTICA & PNEUMATICI SRL (*)', voce: 'Campania - AVELLINO', tonnellate: 0, viaggi: 0, prezzo: 71, unita_misura: 'euro_tonnellata', colonna_prezzo: '', totale: 0, note: '' },
      { tipo: 'voce', soggetto: 'LOGISTICA & PNEUMATICI SRL (*)', voce: 'Campania - CASERTA', tonnellate: 35.62, viaggi: 0, prezzo: 72, unita_misura: 'euro_tonnellata', colonna_prezzo: '', totale: 2564.64, note: '' },
      { tipo: 'soggetto', soggetto: 'EMMESSE SRLS', tonnellate: 59.15, totale: 4258.8 },
      { tipo: 'voce', soggetto: 'EMMESSE SRLS', voce: '', tonnellate: 59.15, viaggi: 0, prezzo: 72, unita_misura: 'euro_tonnellata', colonna_prezzo: '', totale: 4258.8, note: '' },
      { tipo: 'senza_voce', soggetto: 'EMMESSE SRLS', tonnellate: 1.2, dettaglio: 'conferimenti a Irigom, 1,20 t' },
    ],
    totale_t: 183.95, totale_euro: 12887.68,
    non_previsti: [{ soggetto: 'GREEN TYRE PROJECT SRL', tonnellate: 255.78 }],
  },
  impianti: {
    titolo: 'IMPIANTI \\ STOCCAGGI',
    etichetta_prezzo: 'Costo [€\\t]',
    due_prezzi: false,
    righe: [
      { tipo: 'soggetto', soggetto: 'IRIGOM S.R.L.', tonnellate: 375.14, totale: 33762.6 },
      { tipo: 'voce', soggetto: 'IRIGOM S.R.L.', voce: '', tonnellate: 375.14, viaggi: 0, prezzo: 90, unita_misura: 'euro_tonnellata', colonna_prezzo: '', totale: 33762.6, note: '' },
      { tipo: 'soggetto', soggetto: 'NAPPI SUD SRL', tonnellate: 189.745, totale: 2276.94 },
      // I chili non sono tondi: le tonnellate vogliono il terzo decimale.
      { tipo: 'voce', soggetto: 'NAPPI SUD SRL', voce: 'stoccaggio', tonnellate: 189.745, viaggi: 0, prezzo: 12, unita_misura: 'euro_tonnellata', colonna_prezzo: '', totale: 2276.94, note: '' },
    ],
    totale_t: 564.885, totale_euro: 36039.54,
    // Lo stesso nome che sta fra i raccoglitori non previsti: qui e' un
    // impianto, e i due elenchi non si devono mescolare.
    non_previsti: [{ soggetto: 'GREEN TYRE PROJECT SRL', tonnellate: 255.78 }],
  },
  trasporti: {
    righe: [
      { produttore: 'NAPPI SUD SRL', trasportatore: 'Logistica Srl A Socio Unico', destinatario: 'TECNOGUM SRL', tonnellate: 101.6, unita_misura: 'euro_tonnellata', prezzo: 30, viaggi: 7, totale: 3048, note: '' },
      { produttore: 'NAPPI SUD SRL', trasportatore: 'Logistica Srl A Socio Unico', destinatario: 'Irigom S.r.l.', tonnellate: 15.44, unita_misura: 'euro_tonnellata', prezzo: 34, viaggi: 1, totale: 524.96, note: '' },
      { produttore: 'NAPPI SUD SRL', trasportatore: 'SMOCO S.R.L.', destinatario: 'Irigom S.r.l.', tonnellate: 56.06, unita_misura: 'euro_tonnellata', prezzo: 0, viaggi: 4, totale: 0, note: 'tariffa da confermare' },
      { produttore: 'Irigom S.r.l.', trasportatore: 'SMOCO S.R.L.', destinatario: 'Gatim', tonnellate: 12.82, unita_misura: 'euro_viaggio', prezzo: 150, viaggi: 2, totale: 300, note: '' },
    ],
    totale_t: 185.92, totale_euro: 3872.96,
  },
  totale_euro: 52800.18,
};

const ACI = {
  canale: 'ACI', nome_canale: 'ACI', mese: 'Settembre', anno: 2026, stile: 'piatto',
  raccoglitori: {
    titolo: 'RACCOGLITORI',
    etichetta_prezzo: 'Costo di Raccolta [€\\t]',
    due_prezzi: false,
    righe: [
      // Le righe di soggetto ci sono anche nei dati dell'ACI: il foglio piatto
      // non le deve scrivere.
      { tipo: 'soggetto', soggetto: 'EMMESSE SRLS', tonnellate: 12.35, totale: 889.2 },
      { tipo: 'voce', soggetto: 'EMMESSE SRLS', voce: 'ACI', tonnellate: 12.35, viaggi: 0, prezzo: 72, unita_misura: 'euro_tonnellata', colonna_prezzo: '', totale: 889.2, note: '' },
      { tipo: 'soggetto', soggetto: 'SMOCO S.R.L.', tonnellate: 6.54, totale: 621.3 },
      { tipo: 'voce', soggetto: 'SMOCO S.R.L.', voce: '', tonnellate: 6.54, viaggi: 0, prezzo: 95, unita_misura: 'euro_tonnellata', colonna_prezzo: '', totale: 621.3, note: '' },
    ],
    totale_t: 18.89, totale_euro: 1510.5,
    non_previsti: [],
  },
  impianti: {
    titolo: 'IMPIANTI \\ STOCCAGGI',
    etichetta_prezzo: 'Costo [€\\t]',
    due_prezzi: true,
    righe: [
      { tipo: 'voce', soggetto: 'NAPPI SUD SRL', voce: 'stoccaggio', tonnellate: 20, viaggi: 0, prezzo: 18, unita_misura: 'euro_tonnellata', colonna_prezzo: 'stoccaggio', totale: 360, note: '' },
      { tipo: 'voce', soggetto: 'TECNOGUM SRL', voce: '', tonnellate: 13.35, viaggi: 0, prezzo: 95, unita_misura: 'euro_tonnellata', colonna_prezzo: 'trattamento', totale: 1268.25, note: '' },
    ],
    totale_t: 33.35, totale_euro: 1628.25,
    non_previsti: [],
  },
  trasporti: {
    righe: [
      { produttore: 'NAPPI SUD SRL', trasportatore: 'Logistica Srl A Socio Unico', destinatario: 'TECNOGUM SRL', tonnellate: 1.64, unita_misura: 'euro_tonnellata', prezzo: 30, viaggi: 1, totale: 49.2, note: '' },
    ],
    totale_t: 1.64, totale_euro: 49.2,
  },
  totale_euro: 3187.95,
};

// Un canale senza niente dentro: capita, e non deve far saltare l'esportazione.
const VUOTO = {
  canale: 'EXTRA_RACCOLTA', nome_canale: 'EXTRA RACCOLTA', mese: 'Settembre', anno: 2026, stile: 'due_livelli',
  raccoglitori: { titolo: 'RACCOGLITORI', etichetta_prezzo: 'Costo di Raccolta [€\\t]', due_prezzi: false, righe: [], totale_t: 0, totale_euro: 0, non_previsti: [] },
  impianti: { titolo: 'IMPIANTI \\ STOCCAGGI', etichetta_prezzo: 'Costo [€\\t]', due_prezzi: false, righe: [], totale_t: 0, totale_euro: 0, non_previsti: [] },
  trasporti: { righe: [], totale_t: 0, totale_euro: 0 },
  totale_euro: 0,
};

// --- Le mani per rileggere il foglio ----------------------------------------
const grezzo = (ws, r, c) => ws.getCell(r, c).value;
/**
 * Il valore di una cella: il risultato, se e' una formula.
 *
 * Una formula che vale zero torna senza risultato: exceljs, quando riscrive il
 * file, non ci mette dentro il valore calcolato se e' zero, e rileggendolo
 * resta la sola formula. Excel lo ricalcola appena apre il file, qui si legge
 * zero: altrimenti un canale a zero sembrerebbe senza totale.
 */
const val = (ws, r, c) => {
  const v = grezzo(ws, r, c);
  if (v && typeof v === 'object' && 'result' in v) return v.result;
  if (v && typeof v === 'object' && v.formula) return 0;
  if (v && typeof v === 'object' && 'richText' in v) return v.richText.map(p => p.text).join('');
  return v;
};
const testo = (ws, r, c) => String(val(ws, r, c) ?? '');
const formula = (ws, r, c) => {
  const v = grezzo(ws, r, c);
  return v && typeof v === 'object' && v.formula ? String(v.formula) : '';
};
const numero = (ws, r, c) => { const v = val(ws, r, c); return typeof v === 'number' ? v : null; };
const fondo = (ws, r, c) => { const f = ws.getCell(r, c).fill; return f && f.fgColor ? f.fgColor.argb : ''; };
const fmt = (ws, r, c) => ws.getCell(r, c).numFmt || '';
/** Le righe la cui prima colonna dice esattamente questo. */
const righeCon = (ws, quale, da = 1, a = ws.rowCount) => {
  const fuori = [];
  for (let r = da; r <= a; r++) if (testo(ws, r, 1) === quale) fuori.push(r);
  return fuori;
};
const prima = (ws, quale, da = 1, a = ws.rowCount) => (righeCon(ws, quale, da, a)[0] || 0);
/** La prima riga, dentro un tratto, che comincia con questo testo. */
const primaChePorta = (ws, pezzo, da = 1, a = ws.rowCount) => {
  for (let r = da; r <= a; r++) if (testo(ws, r, 1).includes(pezzo)) return r;
  return 0;
};
/** Le righe che una formula SUM somma, anche quando sono scritte una per una. */
const righeSommate = (f) => {
  const dentro = /^SUM\((.*)\)$/.exec(f);
  if (!dentro) return null;
  const fuori = [];
  for (const pezzo of dentro[1].split(',')) {
    const intervallo = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(pezzo.trim());
    if (intervallo) {
      for (let r = Number(intervallo[2]); r <= Number(intervallo[4]); r++) fuori.push(r);
      continue;
    }
    const sola = /^([A-Z]+)(\d+)$/.exec(pezzo.trim());
    if (!sola) return null;
    fuori.push(Number(sola[2]));
  }
  return fuori;
};

const apri = async (bytes) => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(bytes));
  return wb;
};

// --- UN FOGLIO SOLO ---------------------------------------------------------
const unici = await cartellaPassivaUnFoglio([RETE, ACI, VUOTO]);
verifica('cartellaPassivaUnFoglio torna i byte del file', unici instanceof Uint8Array && unici.length > 5000, String(unici && unici.length));
const wb = await apri(unici);
const ws = wb.getWorksheet('PASSIVA');

console.log('IL TITOLO E LE FASCE DEI CANALI');
verifica('un foglio solo, e si chiama PASSIVA', wb.worksheets.length === 1 && !!ws, wb.worksheets.map(w => w.name).join('|'));
verifica('in cima chi manda il documento e di che mese parla',
  /SMOCO/.test(testo(ws, 1, 1)) && /Fatturazione passiva/.test(testo(ws, 1, 1)) && /Settembre 2026/.test(testo(ws, 1, 1)), testo(ws, 1, 1));
const fasciaRete = primaChePorta(ws, 'RETE ·');
const fasciaAci = primaChePorta(ws, 'ACI ·');
const fasciaExtra = primaChePorta(ws, 'EXTRA RACCOLTA ·');
verifica('i tre canali hanno la loro fascia, in ordine', fasciaRete > 1 && fasciaRete < fasciaAci && fasciaAci < fasciaExtra, `${fasciaRete} ${fasciaAci} ${fasciaExtra}`);
verifica('la fascia e\' scura col testo bianco in grassetto',
  fondo(ws, fasciaRete, 1) === SCURO && ws.getCell(fasciaRete, 1).font.color.argb === 'FFFFFFFF' && ws.getCell(fasciaRete, 1).font.bold === true,
  `${fondo(ws, fasciaRete, 1)} ${JSON.stringify(ws.getCell(fasciaRete, 1).font)}`);
verifica('la fascia dice il mese', /Settembre 2026/.test(testo(ws, fasciaRete, 1)), testo(ws, fasciaRete, 1));
verifica('la fascia porta il totale del canale in euro', numero(ws, fasciaRete, 5) === RETE.totale_euro && fmt(ws, fasciaRete, 5) === EURO,
  `${val(ws, fasciaRete, 5)} ${fmt(ws, fasciaRete, 5)}`);

// Il totale del canale e' la somma dei tre blocchi: si legge la formula e si
// guarda che cosa c'e' davvero in quelle tre celle.
const formulaCanale = formula(ws, fasciaRete, 5);
const treCelle = formulaCanale.split('+');
verifica('il totale del canale e\' la somma di tre celle, non un numero copiato', treCelle.length === 3, formulaCanale);
const valoreDi = (rif) => {
  const m = /^([A-Z]+)(\d+)$/.exec(rif.trim());
  return m ? numero(ws, Number(m[2]), m[1].charCodeAt(0) - 64) : null;
};
verifica('e le tre celle sono i totali dei tre blocchi',
  treCelle.length === 3 && valoreDi(treCelle[0]) === RETE.raccoglitori.totale_euro && valoreDi(treCelle[1]) === RETE.impianti.totale_euro && valoreDi(treCelle[2]) === RETE.trasporti.totale_euro,
  treCelle.map(c => `${c}=${valoreDi(c)}`).join(' '));

console.log('\nLE INTESTAZIONI DELLE TABELLE');
const testaRacc = prima(ws, 'RACCOGLITORI', fasciaRete, fasciaAci);
verifica('l\'intestazione dei raccoglitori c\'e\'', testaRacc > fasciaRete, String(testaRacc));
verifica('e dice le stesse colonne del foglio dell\'amministrazione',
  testo(ws, testaRacc, 2) === 'Totale [t]' && testo(ws, testaRacc, 3) === 'Costo di Raccolta [€\\t]' && testo(ws, testaRacc, 4) === 'EER' && testo(ws, testaRacc, 5) === 'TOTALE',
  [2, 3, 4, 5].map(c => testo(ws, testaRacc, c)).join('|'));
verifica('l\'intestazione e\' del colore medio, bianca, in grassetto, coi bordi e il testo a capo',
  fondo(ws, testaRacc, 1) === MEDIO && ws.getCell(testaRacc, 2).font.bold === true
  && ws.getCell(testaRacc, 2).font.color.argb === 'FFFFFFFF' && !!ws.getCell(testaRacc, 2).border.bottom
  && ws.getCell(testaRacc, 2).alignment.wrapText === true && ws.getCell(testaRacc, 2).alignment.horizontal === 'center',
  `${fondo(ws, testaRacc, 1)} ${JSON.stringify(ws.getCell(testaRacc, 2).alignment)}`);
const testaImp = prima(ws, 'IMPIANTI \\ STOCCAGGI', fasciaRete, fasciaAci);
verifica('e c\'e\' anche quella degli impianti', testaImp > testaRacc, String(testaImp));
verifica('il trasporto ha il suo titolo e le sue otto colonne', (() => {
  const t = primaChePorta(ws, 'TRASPORTO (secondarie RETE)', fasciaRete, fasciaAci);
  return t > testaImp && testo(ws, t + 1, 1) === 'PRODUTTORE' && testo(ws, t + 1, 4) === 'PESO [t]' && testo(ws, t + 1, 7) === 'nr. di viaggi' && testo(ws, t + 1, 8) === 'TOTALE';
})());

console.log('\nUN FORNITORE CON QUATTRO VOCI (rete: la riga del totale e le voci rientrate)');
const rLog = prima(ws, 'LOGISTICA & PNEUMATICI SRL (*)', fasciaRete, fasciaAci);
verifica('la riga del fornitore c\'e\', in grassetto e col bordo sopra',
  rLog === testaRacc + 1 && ws.getCell(rLog, 1).font.bold === true && !!ws.getCell(rLog, 1).border.top, `${rLog} ${testaRacc}`);
verifica('sulla riga del fornitore c\'e\' l\'EER dei PFU', numero(ws, rLog, 4) === 160103 && fmt(ws, rLog, 4) === '0', `${val(ws, rLog, 4)} ${fmt(ws, rLog, 4)}`);
verifica('le sue quattro voci stanno sotto, rientrate',
  [1, 2, 3, 4].every(i => ws.getCell(rLog + i, 1).alignment.indent === 2)
  && testo(ws, rLog + 1, 1) === 'Campania - NAPOLI' && testo(ws, rLog + 4, 1) === 'Campania - CASERTA',
  [1, 2, 3, 4].map(i => `${testo(ws, rLog + i, 1)}/${ws.getCell(rLog + i, 1).alignment.indent}`).join(' '));
verifica('le voci senza conferimenti sono scritte comunque, a zero',
  numero(ws, rLog + 2, 2) === 0 && numero(ws, rLog + 2, 3) === 68 && numero(ws, rLog + 3, 3) === 71,
  [2, 3].map(i => `${testo(ws, rLog + i, 1)}=${val(ws, rLog + i, 2)}`).join(' '));
verifica('il totale di una voce e\' peso per prezzo',
  formula(ws, rLog + 1, 5) === `B${rLog + 1}*C${rLog + 1}` && numero(ws, rLog + 1, 5) === 6064.24,
  `${formula(ws, rLog + 1, 5)} = ${val(ws, rLog + 1, 5)}`);
verifica('il totale del fornitore e\' la somma delle sue quattro voci',
  (righeSommate(formula(ws, rLog, 5)) || []).join(',') === [rLog + 1, rLog + 2, rLog + 3, rLog + 4].join(',') && numero(ws, rLog, 5) === 8628.88,
  `${formula(ws, rLog, 5)} = ${val(ws, rLog, 5)}`);
verifica('e le sue tonnellate sono la somma delle stesse righe',
  (righeSommate(formula(ws, rLog, 2)) || []).join(',') === [rLog + 1, rLog + 2, rLog + 3, rLog + 4].join(',') && numero(ws, rLog, 2) === 124.8,
  `${formula(ws, rLog, 2)} = ${val(ws, rLog, 2)}`);

console.log('\nI FORMATI DEI NUMERI');
verifica('tonnellate con due decimali', fmt(ws, rLog + 1, 2) === TONN, fmt(ws, rLog + 1, 2));
verifica('prezzi e totali in euro', fmt(ws, rLog + 1, 3) === EURO && fmt(ws, rLog + 1, 5) === EURO, `${fmt(ws, rLog + 1, 3)} ${fmt(ws, rLog + 1, 5)}`);
verifica('l\'EER e\' un codice, non un numero da formattare', fmt(ws, rLog, 4) === '0', fmt(ws, rLog, 4));
{
  // Quando i chili non sono tondi le tonnellate vogliono il terzo decimale,
  // altrimenti 189,745 t si legge 189,75 e il conto non torna piu'.
  const rNappi = prima(ws, 'NAPPI SUD SRL', testaImp, fasciaAci);
  verifica('tonnellate con tre decimali quando i chili non sono tondi',
    numero(ws, rNappi + 1, 2) === 189.745 && fmt(ws, rNappi + 1, 2) === TONN3, `${val(ws, rNappi + 1, 2)} ${fmt(ws, rNappi + 1, 2)}`);
}

console.log('\nI CHILI CHE NESSUNA VOCE HA PRESO');
const rEmmesse = prima(ws, 'EMMESSE SRLS', fasciaRete, fasciaAci);
const rSenza = primaChePorta(ws, 'senza voce nel modello', fasciaRete, fasciaAci);
verifica('la riga senza voce c\'e\', sotto il fornitore, e dice perche\'',
  rSenza === rEmmesse + 2 && testo(ws, rSenza, 1) === 'EMMESSE SRLS — senza voce nel modello', `${rEmmesse} ${rSenza} ${testo(ws, rSenza, 1)}`);
verifica('e dice che cosa fare', /senza voce nel modello/.test(testo(ws, rSenza, 6)) && /aggiungi la voce o correggi il criterio/.test(testo(ws, rSenza, 6)) && /1,20 t/.test(testo(ws, rSenza, 6)), testo(ws, rSenza, 6));
verifica('quei chili non entrano nel totale del fornitore',
  !(righeSommate(formula(ws, rEmmesse, 2)) || []).includes(rSenza) && numero(ws, rEmmesse, 2) === 59.15,
  `${formula(ws, rEmmesse, 2)} = ${val(ws, rEmmesse, 2)}`);

console.log('\nIL TOTALE COMPLESSIVO');
const rTotRacc = prima(ws, 'Totale complessivo', testaRacc, fasciaAci);
verifica('c\'e\', in grassetto e col doppio bordo sopra',
  rTotRacc > rEmmesse && ws.getCell(rTotRacc, 1).font.bold === true && ws.getCell(rTotRacc, 1).border.top.style === 'double',
  JSON.stringify(ws.getCell(rTotRacc, 1).border.top));
verifica('e\' una formula, non un numero scritto a mano', formula(ws, rTotRacc, 5).startsWith('SUM('), formula(ws, rTotRacc, 5));
verifica('somma le righe dei fornitori, non le voci',
  (righeSommate(formula(ws, rTotRacc, 5)) || []).join(',') === [rLog, rEmmesse].join(',') && numero(ws, rTotRacc, 5) === RETE.raccoglitori.totale_euro,
  `${formula(ws, rTotRacc, 5)} = ${val(ws, rTotRacc, 5)}`);
verifica('e le tonnellate del blocco tornano', numero(ws, rTotRacc, 2) === RETE.raccoglitori.totale_t, String(val(ws, rTotRacc, 2)));

console.log('\nCHI NON STA NEL MODELLO, BLOCCO PER BLOCCO');
const spiegazioni = [];
for (let r = fasciaRete; r < fasciaAci; r++) if (testo(ws, r, 1).startsWith('NON PREVISTI DAL MODELLO')) spiegazioni.push(r);
verifica('due elenchi, uno per tabella', spiegazioni.length === 2, spiegazioni.join(','));
verifica('e si capisce di quale tabella parlano',
  /RACCOGLITORI/.test(testo(ws, spiegazioni[0], 1)) && /IMPIANTI/.test(testo(ws, spiegazioni[1], 1)),
  spiegazioni.map(r => testo(ws, r, 1)).join(' // '));
verifica('lo stesso nome compare una volta per tabella, non due volte di fila',
  testo(ws, spiegazioni[0] + 1, 1) === 'GREEN TYRE PROJECT SRL' && numero(ws, spiegazioni[0] + 1, 2) === 255.78
  && testo(ws, spiegazioni[1] + 1, 1) === 'GREEN TYRE PROJECT SRL' && numero(ws, spiegazioni[1] + 1, 2) === 255.78,
  `${testo(ws, spiegazioni[0] + 1, 1)} / ${testo(ws, spiegazioni[1] + 1, 1)}`);

console.log('\nIL TRASPORTO DELLE SECONDARIE');
{
  const t = primaChePorta(ws, 'TRASPORTO (secondarie RETE)', fasciaRete, fasciaAci);
  const primaRiga = t + 2;
  verifica('a tonnellata il totale e\' peso per costo',
    formula(ws, primaRiga, 8) === `D${primaRiga}*F${primaRiga}` && numero(ws, primaRiga, 8) === 3048 && testo(ws, primaRiga, 5) === '€\\t',
    `${formula(ws, primaRiga, 8)} = ${val(ws, primaRiga, 8)}`);
  const rViaggio = primaRiga + 3;
  verifica('a viaggio il totale e\' costo per numero di viaggi',
    formula(ws, rViaggio, 8) === `F${rViaggio}*G${rViaggio}` && numero(ws, rViaggio, 8) === 300 && testo(ws, rViaggio, 5) === '€\\vg',
    `${formula(ws, rViaggio, 8)} = ${val(ws, rViaggio, 8)}`);
  const rTot = prima(ws, 'Totale trasporto', t, fasciaAci);
  verifica('il totale del trasporto somma i viaggi scritti sopra',
    (righeSommate(formula(ws, rTot, 8)) || []).join(',') === [primaRiga, primaRiga + 1, primaRiga + 2, rViaggio].join(',')
    && numero(ws, rTot, 8) === RETE.trasporti.totale_euro && numero(ws, rTot, 4) === RETE.trasporti.totale_t,
    `${formula(ws, rTot, 8)} = ${val(ws, rTot, 8)}`);
  verifica('la nota della riga senza tariffa si legge', testo(ws, primaRiga + 2, 9) === 'tariffa da confermare', testo(ws, primaRiga + 2, 9));
}

console.log('\nL\'ACI: TABELLE PIATTE, SENZA LE RIGHE DEI FORNITORI');
const testaRaccAci = prima(ws, 'RACCOGLITORI', fasciaAci, fasciaExtra);
const testaImpAci = prima(ws, 'IMPIANTI \\ STOCCAGGI', fasciaAci, fasciaExtra);
verifica('nessuna riga col solo nome del fornitore che ha una voce',
  righeCon(ws, 'EMMESSE SRLS', fasciaAci, fasciaExtra).length === 0, String(righeCon(ws, 'EMMESSE SRLS', fasciaAci, fasciaExtra).length));
verifica('la voce porta l\'etichetta SOGGETTO - (voce)',
  testo(ws, testaRaccAci + 1, 1) === 'EMMESSE SRLS - (ACI)', testo(ws, testaRaccAci + 1, 1));
verifica('la voce senza nome porta il solo nome del fornitore',
  testo(ws, testaRaccAci + 2, 1) === 'SMOCO S.R.L.', testo(ws, testaRaccAci + 2, 1));
verifica('nel piatto l\'EER sta su ogni riga',
  numero(ws, testaRaccAci + 1, 4) === 160103 && numero(ws, testaRaccAci + 2, 4) === 160103,
  `${val(ws, testaRaccAci + 1, 4)} ${val(ws, testaRaccAci + 2, 4)}`);
verifica('il Totale complessivo dell\'ACI somma le voci, perche\' non ci sono righe di fornitore', (() => {
  const rTot = prima(ws, 'Totale complessivo', testaRaccAci, testaImpAci);
  return (righeSommate(formula(ws, rTot, 5)) || []).join(',') === [testaRaccAci + 1, testaRaccAci + 2].join(',') && numero(ws, rTot, 5) === ACI.raccoglitori.totale_euro;
})(), formula(ws, prima(ws, 'Totale complessivo', testaRaccAci, testaImpAci), 5));

console.log('\nGLI IMPIANTI DELL\'ACI HANNO DUE COLONNE DI PREZZO');
verifica('le colonne si chiamano come nel foglio dell\'amministrazione',
  testo(ws, testaImpAci, 3) === 'Costo di Stoccaggio [€\\t]' && testo(ws, testaImpAci, 4) === 'Costo di Trattamento [€\\t]'
  && testo(ws, testaImpAci, 5) === 'TOTALE' && testo(ws, testaImpAci, 6) === 'EER',
  [3, 4, 5, 6].map(c => testo(ws, testaImpAci, c)).join('|'));
const rStocc = testaImpAci + 1;
const rTratt = testaImpAci + 2;
verifica('lo stoccaggio scrive il prezzo nella sua colonna e lascia vuota l\'altra',
  numero(ws, rStocc, 3) === 18 && val(ws, rStocc, 4) === null, `${val(ws, rStocc, 3)} / ${val(ws, rStocc, 4)}`);
verifica('e il suo totale moltiplica quella colonna',
  formula(ws, rStocc, 5) === `B${rStocc}*C${rStocc}` && numero(ws, rStocc, 5) === 360, `${formula(ws, rStocc, 5)} = ${val(ws, rStocc, 5)}`);
verifica('il trattamento scrive il prezzo nella colonna del trattamento',
  numero(ws, rTratt, 4) === 95 && val(ws, rTratt, 3) === null, `${val(ws, rTratt, 3)} / ${val(ws, rTratt, 4)}`);
verifica('e il suo totale moltiplica la colonna del trattamento',
  formula(ws, rTratt, 5) === `B${rTratt}*D${rTratt}` && numero(ws, rTratt, 5) === 1268.25, `${formula(ws, rTratt, 5)} = ${val(ws, rTratt, 5)}`);
verifica('con due prezzi l\'EER scivola nella sesta colonna',
  numero(ws, rStocc, 6) === 160103 && numero(ws, rTratt, 6) === 160103, `${val(ws, rStocc, 6)} ${val(ws, rTratt, 6)}`);

console.log('\nUN CANALE SENZA NIENTE DENTRO');
verifica('la fascia c\'e\' comunque, col totale a zero', numero(ws, fasciaExtra, 5) === 0, String(val(ws, fasciaExtra, 5)));
verifica('e il trasporto vuoto lo dice a parole',
  primaChePorta(ws, 'Nessun viaggio di secondaria', fasciaExtra) > fasciaExtra, String(primaChePorta(ws, 'Nessun viaggio di secondaria', fasciaExtra)));
verifica('in fondo la nota che spiega le voci a zero e le formule',
  primaChePorta(ws, 'I totali sono formule', fasciaExtra) > fasciaExtra, String(primaChePorta(ws, 'I totali sono formule', fasciaExtra)));

console.log('\nLE LARGHEZZE E LA STAMPA');
// Le larghezze sono un compromesso fra tabelle diverse nello stesso foglio: qui
// si controlla solo che ci siano e che la prima colonna, quella dei nomi dei
// fornitori, sia larga davvero.
verifica('le colonne hanno una larghezza', ws.getColumn(1).width === 44 && ws.columns.slice(0, 9).every(c => c.width >= 14),
  ws.columns.slice(0, 9).map(c => c.width).join('|'));
verifica('si stampa orizzontale, stretta in larghezza su una pagina',
  ws.pageSetup.orientation === 'landscape' && ws.pageSetup.fitToWidth === 1 && ws.pageSetup.fitToHeight === 0, JSON.stringify(ws.pageSetup));
verifica('in fondo alla pagina stampata c\'e\' il numero di pagina',
  /&P/.test(String(ws.headerFooter && ws.headerFooter.oddFooter)), String(ws.headerFooter && ws.headerFooter.oddFooter));

// --- UN FOGLIO PER CANALE ---------------------------------------------------
console.log('\nUN FOGLIO DI LAVORO PER CANALE');
const perCanale = await cartellaPassivaPerCanale([RETE, ACI, VUOTO]);
verifica('cartellaPassivaPerCanale torna i byte del file', perCanale instanceof Uint8Array && perCanale.length > 5000, String(perCanale && perCanale.length));
const wb2 = await apri(perCanale);
verifica('un foglio per canale, col nome del canale', wb2.worksheets.map(w => w.name).join('|') === 'RETE|ACI|EXTRA RACCOLTA', wb2.worksheets.map(w => w.name).join('|'));
const rete = wb2.getWorksheet('RETE');
verifica('la prima riga resta ferma mentre si scorre',
  rete.views[0].state === 'frozen' && rete.views[0].ySplit === 1, JSON.stringify(rete.views));
verifica('il canale comincia subito sotto il titolo', /^RETE · Settembre 2026$/.test(testo(rete, 3, 1)), testo(rete, 3, 1));
verifica('i numeri sono gli stessi del foglio unico', (() => {
  const r = prima(rete, 'LOGISTICA & PNEUMATICI SRL (*)');
  return numero(rete, r, 5) === 8628.88 && numero(rete, 3, 5) === RETE.totale_euro;
})(), String(numero(rete, 3, 5)));
verifica('anche qui si stampa orizzontale col numero di pagina',
  rete.pageSetup.orientation === 'landscape' && /&P/.test(String(rete.headerFooter.oddFooter)), JSON.stringify(rete.pageSetup.orientation));
verifica('il foglio dell\'ACI e\' piatto come nell\'altro file', (() => {
  const aci = wb2.getWorksheet('ACI');
  return righeCon(aci, 'EMMESSE SRLS').length === 0 && prima(aci, 'EMMESSE SRLS - (ACI)') > 0;
})());

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
