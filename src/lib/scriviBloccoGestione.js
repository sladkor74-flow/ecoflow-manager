// Il blocco del mese scritto DENTRO il file di gestione dell'utente (22/09/2026).
//
// Il file di gestione e' quello vero: quattro megabyte di formati, formule,
// tabelle pivot, commenti e altri venti fogli. Riscriverlo con una libreria
// vorrebbe dire perdere tutto cio' che la libreria non conosce, percio' qui si
// apre lo zip, si toccano solo il foglio DICHIARAZIONI e il calcolo, e si
// richiude: ogni altra voce torna nel file com'era.
//
// Le righe nuove sono le stesse di bloccoGestione.js - quelle che si scaricano
// per il copia/incolla - e prendono i formati dalle righe dei mesi gia'
// presenti: stile di ogni cella, altezza della riga, unioni. Cosi' il blocco
// nuovo e' uguale agli altri anche a guardarlo.
//
// Le formule si scrivono senza valore memorizzato e al file si chiede di
// ricalcolare all'apertura (fullCalcOnLoad, senza calcChain): il valore giusto
// lo mette Excel, che qui non c'e'. Le stesse righe, quando il computer di casa
// e' acceso, le scrive con Excel strumenti/irigom/scrivi_blocco_mese.ps1: da li'
// vengono le regole su dove va ogni riga e su come si aggiorna il riepilogo.

import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { righeBlocco, MESI_NOMI } from './bloccoGestione.js';

const FOGLIO = 'DICHIARAZIONI';
const PRIMA_RIGA = 14;      // sopra c'e' il riepilogo: i blocchi dei mesi cominciano dopo
const ULTIMA_RIEPILOGO = 14; // le righe IRIGOM ed EXTRA RACCOLTA stanno qui dentro
const DISTANZA = 5;         // quattro righe vuote fra un blocco e il successivo
const MESI_MAIUSCOLI = MESI_NOMI.map(m => m.toUpperCase());

const ULTIMA_RIGA_EXCEL = 1048576; // oltre questa riga il foglio non esiste piu'

const intero = (n) => Math.round(Number(n) || 0);
const mig = (v) => String(intero(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
// I caratteri di controllo (tranne tabulazione e a capo) nell'XML non ci possono
// stare: uno solo, arrivato da un nome importato male, renderebbe il file
// illeggibile. Si tolgono prima di scrivere.
const scappa = (s) => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const disScappa = (s) => String(s ?? '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/** Il nome della colonna: 1 = A, 27 = AA. */
export function lettereColonna(c) {
  let nome = '';
  for (let n = c; n > 0; n = Math.floor((n - 1) / 26)) nome = String.fromCharCode(65 + ((n - 1) % 26)) + nome;
  return nome;
}
const numeroColonna = (rif) => {
  const m = /^([A-Z]+)/.exec(String(rif || ''));
  return m ? [...m[1]].reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0) : 0;
};

// ---------------------------------------------------------------------------
// Leggere il foglio

const testoDiXml = (frammento) => disScappa([...String(frammento || '').matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join(''));

/** Le stringhe condivise, nell'ordine: le celle t="s" ci puntano per indice. */
function stringheCondivise(voci) {
  const xml = voci['xl/sharedStrings.xml'] ? strFromU8(voci['xl/sharedStrings.xml']) : '';
  const elenco = [];
  for (const m of xml.matchAll(/<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g)) elenco.push(testoDiXml(m[1]));
  return elenco;
}

function leggiCelle(interno) {
  const celle = new Map();
  for (const m of String(interno || '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const attr = m[1];
    const rif = (/\br="([^"]+)"/.exec(attr) || [])[1] || '';
    const corpo = m[2] || '';
    const f = /<f\b[^>]*?(?:\/>|>([\s\S]*?)<\/f>)/.exec(corpo);
    celle.set(numeroColonna(rif), {
      col: numeroColonna(rif), rif, xml: m[0], corpo,
      s: (/\bs="(\d+)"/.exec(attr) || [])[1],
      t: (/\bt="([^"]+)"/.exec(attr) || [])[1],
      f: f ? (f[1] || '') : null,
      v: (/<v>([\s\S]*?)<\/v>/.exec(corpo) || [])[1],
    });
  }
  return celle;
}

/** Il foglio spezzato in tre: quello che sta prima delle righe, le righe, il resto. */
function leggiFoglio(xml) {
  const apre = /<sheetData\b[^>]*>/.exec(xml);
  const chiude = apre ? xml.indexOf('</sheetData>', apre.index) : -1;
  if (!apre || chiude < 0) throw new Error(`Il foglio ${FOGLIO} non si legge: manca l'elenco delle righe.`);
  const da = apre.index + apre[0].length;
  const righe = [];
  for (const m of xml.slice(da, chiude).matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const attr = m[1];
    righe.push({ n: Number((/\br="(\d+)"/.exec(attr) || [])[1] || 0), attr, xml: m[0], celle: leggiCelle(m[2]) });
  }
  return { testa: xml.slice(0, da), righe, coda: xml.slice(chiude) };
}

const testoCella = (cella, stringhe) => {
  if (!cella) return '';
  if (cella.t === 's') return stringhe[Number(cella.v)] ?? '';
  if (cella.t === 'inlineStr') return testoDiXml(cella.corpo);
  return disScappa(cella.v ?? '');
};

// ---------------------------------------------------------------------------
// Le righe modello: l'ultima di ogni tipo gia' scritta nel foglio

/**
 * Riconosce nel foglio le righe dei mesi precedenti dai loro testi, come fa lo
 * script PowerShell. Vale l'ultima trovata: e' il mese piu' recente, quello con
 * i formati buoni.
 */
function righeModello(righe, stringhe) {
  const mod = {};
  const dopo = (riga) => righe.find(r => r.n === riga.n + 1) || null;
  const T = (riga, col) => testoCella(riga.celle.get(col), stringhe).trim();
  const reMese = new RegExp(`^(${MESI_MAIUSCOLI.join('|')}) \\d{4}$`);
  for (const riga of righe) {
    if (riga.n < PRIMA_RIGA) continue;
    const a = T(riga, 1);
    if (reMese.test(a.toUpperCase())) mod.titolo = riga;
    if (a.startsWith('Dichiarazione CER191202')) mod.cer02 = riga;
    if (a.startsWith('Dichiarazione CER191204')) mod.cer04 = riga;
    if (a === 'DATA' && T(riga, 5) === 'FORMULARIO') { mod.ferroTesta = riga; mod.ferroRiga = dopo(riga); }
    if (a === 'DDT' && T(riga, 10) === 'TRATTAMENTO') {
      const sotto = dopo(riga);
      if (sotto && T(sotto, 10).startsWith('DA PFU EXTRA')) { mod.extraTesta = riga; mod.extraRiga = sotto; }
      else mod.csscTesta = riga;
    }
    if (a.startsWith('DDT ') && T(riga, 10) === 'DA PFU') mod.csscRiga = riga;
    if (a.startsWith('per il mese di')) { mod.extraNota = riga; mod.extraNota2 = dopo(riga); }
    if (a === 'ORDINE TERZIARIA') { mod.terTesta = riga; mod.terRiga = dopo(riga); }
  }
  // I totali: la prima riga sotto l'intestazione con una somma nella sua colonna.
  for (const [testa, totale, col] of [['ferroTesta', 'ferroTot', 6], ['csscTesta', 'csscTot', 7], ['terTesta', 'terTot', 11]]) {
    if (!mod[testa]) continue;
    const trovata = righe.find(r => r.n > mod[testa].n && /^SUM\(/i.test((r.celle.get(col) || {}).f || ''));
    if (trovata) mod[totale] = trovata;
  }
  return mod;
}

/**
 * Che cos'e' ogni riga del blocco appena costruito, con gli stessi nomi delle
 * righe modello: serve a sapere da dove copiare i formati. Le righe si
 * riconoscono dai testi, come quelle gia' nel foglio: le due letture usano gli
 * stessi criteri, cosi' non possono dire cose diverse.
 */
function tipiDelBlocco(righe, indice) {
  const tipi = new Array(righe.length).fill(null);
  const testo = (n, c) => { const v = (righe[n - 1] || [])[c]; return typeof v === 'string' ? v : ''; };
  let ferroTesta = 0, csscTesta = 0, terTesta = 0;
  for (let n = 1; n <= righe.length; n++) {
    const a = testo(n, 0);
    if (n === 1) { tipi[n - 1] = 'titolo'; continue; }
    if (n === indice.totale_ferro) { tipi[n - 1] = 'ferroTot'; continue; }
    if (n === indice.totale_cssc) { tipi[n - 1] = 'csscTot'; continue; }
    if (n === indice.totale_terziarie) { tipi[n - 1] = 'terTot'; continue; }
    if (n === indice.extra) { tipi[n - 1] = 'extraRiga'; continue; }
    if (a.startsWith('Dichiarazione CER191202')) { tipi[n - 1] = 'cer02'; continue; }
    if (a.startsWith('Dichiarazione CER191204')) { tipi[n - 1] = 'cer04'; continue; }
    if (a === 'DATA' && testo(n, 4) === 'FORMULARIO') { tipi[n - 1] = 'ferroTesta'; ferroTesta = n; continue; }
    if (a === 'DDT' && testo(n, 9) === 'TRATTAMENTO') {
      if (indice.extra && n + 1 === indice.extra) tipi[n - 1] = 'extraTesta';
      else { tipi[n - 1] = 'csscTesta'; csscTesta = n; }
      continue;
    }
    if (a === 'ORDINE TERZIARIA') { tipi[n - 1] = 'terTesta'; terTesta = n; continue; }
    if (a.startsWith('per il mese di')) { tipi[n - 1] = 'extraNota'; continue; }
    if (a.startsWith('EXTRA RACCOLTA DA DICHIARARE')) { tipi[n - 1] = 'extraNota2'; continue; }
    if (ferroTesta && n > ferroTesta && n < indice.totale_ferro) { tipi[n - 1] = 'ferroRiga'; continue; }
    if (csscTesta && n > csscTesta && n < indice.totale_cssc) { tipi[n - 1] = 'csscRiga'; continue; }
    if (terTesta && n > terTesta && n < indice.totale_terziarie) tipi[n - 1] = 'terRiga';
  }
  return tipi;
}

// ---------------------------------------------------------------------------
// Scrivere le righe

// Le formule del blocco sono relative e numerate da 1: incollandole piu' in
// basso vanno spostate di altrettante righe, come farebbe Excel.
const spostaFormula = (f, spostamento) => String(f).replace(/(\$?)([A-Z]{1,3})(\$?)(\d+)/g,
  (tutto, d1, col, d2, riga) => (d2 ? tutto : `${d1}${col}${d2}${Number(riga) + spostamento}`));

function cellaXml(rif, stile, valore) {
  const s = stile === undefined || stile === null ? '' : ` s="${stile}"`;
  if (valore === null || valore === undefined || valore === '') return `<c r="${rif}"${s}/>`;
  if (typeof valore === 'object') {
    if (valore.f) return `<c r="${rif}"${s}><f>${scappa(valore.f)}</f></c>`;
    return `<c r="${rif}"${s}><v>${Number(valore.v)}</v></c>`;
  }
  if (typeof valore === 'number') return `<c r="${rif}"${s}><v>${valore}</v></c>`;
  return `<c r="${rif}"${s} t="inlineStr"><is><t xml:space="preserve">${scappa(valore)}</t></is></c>`;
}

// Lo stile della cella modello nella stessa colonna; se li' il modello non ha
// nulla vale quello della cella a sinistra, che e' il formato della fascia
// (per esempio la percentuale del CSS-C, che nel foglio sta una colonna prima).
function stileModello(celle, col) {
  for (let c = col; c >= 1; c--) {
    const cella = celle.get(c);
    if (cella) return cella.s;
  }
  return undefined;
}

function rigaXml(n, contenuto, modello, spostamento) {
  const celleModello = modello ? modello.celle : new Map();
  const colonne = new Set(celleModello.keys());
  contenuto.forEach((v, i) => { if (v !== null && v !== undefined && v !== '') colonne.add(i + 1); });
  const ordinate = [...colonne].sort((a, b) => a - b);
  const celle = ordinate.map(c => {
    const v = contenuto[c - 1];
    const valore = v && typeof v === 'object' && v.f ? { f: spostaFormula(v.f, spostamento) } : v;
    return cellaXml(`${lettereColonna(c)}${n}`, stileModello(celleModello, c), valore);
  });
  const attr = String(modello ? modello.attr : '').replace(/\s*\br="\d+"/, '').replace(/\s*\bspans="[^"]*"/, '');
  const spans = ordinate.length ? ` spans="${ordinate[0]}:${ordinate[ordinate.length - 1]}"` : '';
  return `<row r="${n}"${spans}${attr}>${celle.join('')}</row>`;
}

/** Rimette al posto di una cella quello che dice `produci` (null = la toglie). */
function cambiaCella(riga, col, produci) {
  const celle = [...riga.celle.values()].filter(c => c.col !== col);
  const nuova = produci(riga.celle.get(col));
  if (nuova) celle.push({ col, xml: nuova });
  celle.sort((a, b) => a.col - b.col);
  const attr = String(riga.attr).replace(/\s*\bspans="[^"]*"/, '');
  const spans = celle.length ? ` spans="${celle[0].col}:${celle[celle.length - 1].col}"` : '';
  riga.xml = `<row${attr}${spans}>${celle.map(c => c.xml).join('')}</row>`;
  riga.celle = leggiCelle(celle.map(c => c.xml).join(''));
}

// Le unioni del mese precedente (la fascia rossa della dichiarazione, la nota
// dell'extra) si rifanno sulle righe nuove: senza, il titolo resta in una cella.
function copiaUnioni(xml, coppie) {
  const blocco = /<mergeCells\b[^>]*>([\s\S]*?)<\/mergeCells>/.exec(xml);
  if (!blocco) return xml;
  const dentro = blocco[1];
  const nuove = [];
  for (const [daRiga, aRiga] of coppie) {
    for (const m of dentro.matchAll(/<mergeCell ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/g)) {
      if (Number(m[2]) !== daRiga || Number(m[4]) !== daRiga) continue;
      nuove.push(`<mergeCell ref="${m[1]}${aRiga}:${m[3]}${aRiga}"/>`);
    }
  }
  if (!nuove.length) return xml;
  const conta = (dentro.match(/<mergeCell /g) || []).length + nuove.length;
  return xml.slice(0, blocco.index) + `<mergeCells count="${conta}">${dentro}${nuove.join('')}</mergeCells>` + xml.slice(blocco.index + blocco[0].length);
}

// ---------------------------------------------------------------------------
// Il riepilogo in alto

/** Le colonne dei mesi (dalla prima riga) e le righe IRIGOM ed EXTRA RACCOLTA. */
function postiRiepilogo(righe, stringhe, mese) {
  const prima = righe.find(r => r.n === 1);
  const posti = { mesi: new Map(), colonna: 0, irigom: null, extra: null };
  for (const cella of (prima ? prima.celle.values() : [])) {
    if (cella.col < 3) continue;
    const testo = testoCella(cella, stringhe).trim().toUpperCase();
    if (MESI_MAIUSCOLI.includes(testo)) posti.mesi.set(testo, cella.col);
  }
  posti.colonna = posti.mesi.get(mese) || 0;
  for (const riga of righe) {
    if (riga.n < 2 || riga.n > ULTIMA_RIEPILOGO) continue;
    const b = testoCella(riga.celle.get(2), stringhe).trim().toUpperCase();
    if (b === 'IRIGOM') posti.irigom = riga;
    if (b === 'EXTRA RACCOLTA') posti.extra = riga;
  }
  return posti;
}

// Il verde della dichiarazione prodotta: quello dell'ultimo mese gia' compilato
// sulla stessa riga. Si guardano solo le colonne dei mesi, perche' quelle in
// mezzo sono le CARICATA\INVIATA e hanno un formato loro.
function stileMeseCompilato(riga, colonneMesi, colMese) {
  for (const c of [...colonneMesi].filter(c => c < colMese).sort((a, b) => b - a)) {
    const cella = riga.celle.get(c);
    if (cella && (cella.f || cella.v !== undefined) && cella.s !== undefined) return cella.s;
  }
  const propria = riga.celle.get(colMese);
  return propria ? propria.s : undefined;
}

// ---------------------------------------------------------------------------

/**
 * Scrive il blocco del mese nel foglio DICHIARAZIONI del file di gestione e
 * restituisce il file da riscaricare. Il file caricato non si riscrive: si
 * tocca solo quello che serve.
 *
 * @param {Uint8Array} bytes  il .xlsx di gestione caricato dall'utente
 * @param {object} dati       quello che torna da datiFileGestione (documentiIrigom.js)
 * @returns {Promise<{ bytes: Uint8Array, riga_inizio: number, riga_fine: number,
 *   riepilogo: { colonna: string, riga_irigom: number, riga_extra: number|null }, avvisi: string[] }>}
 */
export async function scriviBloccoNelFile(bytes, dati) {
  const mese = String((dati || {}).mese || '').trim();
  const anno = intero((dati || {}).anno);
  const iMese = MESI_MAIUSCOLI.indexOf(mese.toUpperCase());
  if (iMese < 0 || !anno) throw new Error(`Non riconosco il mese da scrivere: "${mese} ${(dati || {}).anno ?? ''}".`);
  const MESE = MESI_MAIUSCOLI[iMese];
  const titolo = `${MESE} ${anno}`;

  let voci;
  try { voci = unzipSync(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)); }
  catch { throw new Error('Il file caricato non e\' un file Excel (.xlsx) leggibile.'); }
  if (!voci['xl/workbook.xml']) throw new Error('Il file caricato non e\' una cartella di lavoro Excel (.xlsx).');

  const percorso = percorsoFoglio(voci, strFromU8(voci['xl/workbook.xml']));
  if (!percorso || !voci[percorso]) throw new Error(`Nel file caricato non c'e' il foglio ${FOGLIO}: non e' il file di gestione.`);

  const stringhe = stringheCondivise(voci);
  const foglioXml = strFromU8(voci[percorso]);
  const foglio = leggiFoglio(foglioXml);

  // Il mese c'e' gia'? Allora non si tocca niente: rifarlo e' una decisione.
  const gia = foglio.righe.find(r => r.n >= PRIMA_RIGA && testoCella(r.celle.get(1), stringhe).trim().toUpperCase() === titolo);
  if (gia) throw new Error(`Nel foglio ${FOGLIO} c'e' gia' il blocco ${titolo} (riga ${gia.n}): non lo riscrivo. Se va rifatto, va tolto prima a mano.`);

  const { righe, indice } = righeBlocco(dati);
  const tipi = tipiDelBlocco(righe, indice);
  const modello = righeModello(foglio.righe, stringhe);
  const pieno = (n) => (righe[n - 1] || []).some(v => v !== null && v !== undefined && v !== '');
  const servono = [...new Set(tipi.filter((t, i) => t && pieno(i + 1)))];
  const mancano = servono.filter(t => !modello[t]);
  if (mancano.length) throw new Error(`Nel foglio ${FOGLIO} non trovo le righe da cui copiare i formati (${mancano.join(', ')}): il foglio non ha i blocchi dei mesi precedenti.`);

  const posti = postiRiepilogo(foglio.righe, stringhe, MESE);
  if (!posti.colonna || !posti.irigom) throw new Error(`Nel riepilogo in alto del foglio ${FOGLIO} non trovo la colonna di ${MESE} o la riga IRIGOM.`);
  controllaTotali(righe, tipi, dati);

  // --- Le righe nuove, in coda al foglio ---
  const ultima = foglio.righe.reduce((m, r) => Math.max(m, r.n), 0);
  const inizio = ultima + DISTANZA;
  // Sotto l'ultima riga di Excel non c'e' niente: se in fondo al foglio e'
  // rimasta una riga di scarto (una formattazione, un incollato andato male) il
  // blocco finirebbe fuori dal foglio e il file non si aprirebbe piu'.
  if (inizio + righe.length - 1 > ULTIMA_RIGA_EXCEL) {
    throw new Error(`Nel foglio ${FOGLIO} l'ultima riga scritta e' la ${ultima}: il blocco finirebbe oltre l'ultima riga di Excel (${mig(ULTIMA_RIGA_EXCEL)}). Non scrivo niente: va prima ripulito il fondo del foglio.`);
  }
  const spostamento = inizio - 1;
  const nuove = [];
  const unioni = [];
  let fine = inizio;
  for (let n = 1; n <= righe.length; n++) {
    const tipo = tipi[n - 1];
    const mod = tipo ? modello[tipo] : null;
    if (!pieno(n) && !mod) continue;
    const assoluta = inizio + n - 1;
    nuove.push(rigaXml(assoluta, righe[n - 1] || [], mod, spostamento));
    if (mod) unioni.push([mod.n, assoluta]);
    if (pieno(n)) fine = assoluta;
  }

  // --- Il riepilogo in alto: la riga IRIGOM e, se c'e', l'extra raccolta ---
  const avvisi = [];
  const colonne = [...posti.mesi.values()];
  // Un mese di soli metalli ferrosi a portale non carica niente: la colonna del
  // mese nel riepilogo resta com'era, e quel ferro se ne va con la dichiarazione
  // del mese in cui riparte la gomma (regola dell'utente del 22/09/2026).
  const parti = [];
  if (indice.totale_cssc) parti.push(`I${spostamento + indice.totale_cssc}`);
  if (indice.totale_terziarie) parti.push(`K${spostamento + indice.totale_terziarie}`);
  if (parti.length) {
    const stileIrigom = stileMeseCompilato(posti.irigom, colonne, posti.colonna);
    cambiaCella(posti.irigom, posti.colonna, () => cellaXml(`${lettereColonna(posti.colonna)}${posti.irigom.n}`, stileIrigom, { f: parti.join('+') }));
  } else {
    avvisi.push(`Nel mese sono usciti solo metalli ferrosi: a portale non si carica nulla, quindi nel riepilogo la colonna di ${MESE.toLowerCase()} resta com'era. Quel ferro si dichiara con il mese in cui riparte la gomma.`);
  }

  const extra = dati.extra && intero(dati.extra.totale_kg) > 0 ? dati.extra : null;
  if (extra && !posti.extra) avvisi.push(`Nel riepilogo non c'e' la riga EXTRA RACCOLTA: i ${mig(extra.totale_kg)} kg vanno scritti a mano.`);
  if (extra && posti.extra) {
    const stileExtra = stileMeseCompilato(posti.extra, colonne, posti.colonna);
    cambiaCella(posti.extra, posti.colonna, () => cellaXml(`${lettereColonna(posti.colonna)}${posti.extra.n}`, stileExtra, intero(extra.totale_kg)));
    // L'extra raccolta si conta una volta sola, nel mese in cui si dichiara: se
    // il mese del formulario la contava gia', si svuota; se li' c'e' dell'altro
    // non si tocca e si dice, perche' e' roba dell'utente.
    for (const [altroAnno, altroMese, kg] of perMeseDelFormulario(extra)) {
      // Le colonne del foglio sono i mesi dell'anno che si sta scrivendo: un
      // formulario di un altro anno (l'extra di dicembre che parte con la nave di
      // gennaio) non c'entra con la colonna di quel mese qui, e non si tocca.
      if (altroAnno !== anno) {
        avvisi.push(`${mig(kg)} kg di questa extra raccolta vengono da formulari di ${altroMese.toLowerCase()} ${altroAnno}: la colonna di ${altroMese.toLowerCase()} di questo foglio e' del ${anno} e non l'ho toccata. Se quei chili erano gia' scritti nel file del ${altroAnno}, vanno tolti li'.`);
        continue;
      }
      if (altroMese === MESE) continue;
      const col = posti.mesi.get(altroMese) || 0;
      if (!col) continue;
      const cella = posti.extra.celle.get(col);
      const valore = Number((cella || {}).v);
      if (!cella || !Number.isFinite(valore) || valore === 0) continue;
      if (intero(valore) === intero(kg)) {
        cambiaCella(posti.extra, col, (vecchia) => cellaXml(cella.rif, (vecchia || {}).s, null));
        avvisi.push(`EXTRA RACCOLTA di ${altroMese} svuotata (${mig(valore)} kg): la stessa raccolta ora sta in ${MESE}.${cella.f ? ' In quella cella c\'era una formula, ed e\' stata tolta con il numero.' : ''}`);
      } else {
        avvisi.push(`ATTENZIONE: EXTRA RACCOLTA di ${altroMese} vale ${mig(valore)} kg e comprende altro oltre a questi ${mig(kg)} kg: non l'ho toccata, va vista a mano.`);
      }
    }
  }

  // --- Il foglio rimesso insieme ---
  let nuovoXml = foglio.testa + foglio.righe.map(r => r.xml).join('') + nuove.join('') + foglio.coda;
  nuovoXml = copiaUnioni(nuovoXml, unioni);
  nuovoXml = aggiornaDimensione(nuovoXml, fine);
  voci[percorso] = strToU8(nuovoXml);
  voci['xl/workbook.xml'] = strToU8(ricalcoloAllApertura(strFromU8(voci['xl/workbook.xml'])));
  togliCalcChain(voci);

  return {
    bytes: zipSync(voci, { level: 6 }),
    riga_inizio: inizio,
    riga_fine: fine,
    riepilogo: { colonna: lettereColonna(posti.colonna), riga_irigom: posti.irigom.n, riga_extra: posti.extra ? posti.extra.n : null },
    avvisi,
  };
}

/**
 * Quanti chili di extra raccolta per mese del formulario (la fine trasporto),
 * con l'anno: il foglio ha una colonna per mese di UN anno solo, e l'extra di
 * dicembre parte con la nave di gennaio dell'anno dopo.
 * @returns [[anno, MESE, kg]]
 */
function perMeseDelFormulario(extra) {
  const per = new Map();
  for (const f of extra.formulari || []) {
    const g = String((f || {}).fine_trasporto || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(g)) continue;
    const m = MESI_MAIUSCOLI[Number(g.slice(5, 7)) - 1];
    if (m) per.set(`${g.slice(0, 4)}|${m}`, (per.get(`${g.slice(0, 4)}|${m}`) || 0) + intero(f.peso_kg));
  }
  return [...per.entries()].map(([k, kg]) => [Number(k.slice(0, 4)), k.slice(5), kg]);
}

/**
 * I totali che il blocco scrive devono tornare con i dati della pratica: si
 * sommano i numeri finiti davvero nelle celle, non quelli di partenza.
 */
function controllaTotali(righe, tipi, dati) {
  const somma = (tipo, col) => righe.reduce((t, riga, i) => (tipi[i] === tipo && typeof (riga || [])[col] === 'number' ? t + riga[col] : t), 0);
  const guai = [];
  const confronta = (cosa, scritto, atteso) => { if (intero(scritto) !== intero(atteso)) guai.push(`${cosa}: nel foglio ${mig(scritto)} kg, nella pratica ${mig(atteso)} kg`); };
  confronta('quota del ferro', somma('ferroRiga', 6), (dati.ferro || []).reduce((s, f) => s + intero(f.quota_kg), 0));
  const cssc = somma('csscRiga', 6) + somma('csscRiga', 7);
  confronta('CSS-C', cssc, (dati.cssc || []).reduce((s, c) => s + intero(c.cssc_kg) + intero(c.ferro_kg), 0));
  const terziarie = somma('terRiga', 8) + somma('terRiga', 9);
  confronta('terziarie', terziarie, (dati.terziarie || []).reduce((s, t) => s + intero(t.cippato_kg) + intero(t.ferro_kg), 0));
  const portale = intero(dati.totale_portale_kg);
  const extra = dati.extra ? intero(dati.extra.totale_kg) : 0;
  if (portale && cssc + terziarie + extra !== portale) {
    guai.push(`totale da caricare a portale: il blocco fa ${mig(cssc + terziarie + extra)} kg (CSS-C + terziarie + extra raccolta), la pratica dice ${mig(portale)} kg`);
  }
  if (guai.length) throw new Error(`I totali del blocco non tornano con i dati della pratica: ${guai.join('; ')}. Non scrivo niente.`);
}

// ---------------------------------------------------------------------------
// Le altre parti del file

function percorsoFoglio(voci, wbXml) {
  const rels = voci['xl/_rels/workbook.xml.rels'] ? strFromU8(voci['xl/_rels/workbook.xml.rels']) : '';
  for (const m of wbXml.matchAll(/<sheet\b([^>]*?)\/?>/g)) {
    const nome = (/\bname="([^"]*)"/.exec(m[1]) || [])[1];
    if (!nome || disScappa(nome).trim().toUpperCase() !== FOGLIO) continue;
    const id = (/\br:id="([^"]*)"/.exec(m[1]) || [])[1];
    const rel = id ? new RegExp(`<Relationship\\b[^>]*\\bId="${id}"[^>]*>`).exec(rels) : null;
    const target = rel ? (/\bTarget="([^"]*)"/.exec(rel[0]) || [])[1] : '';
    if (!target) return null;
    return target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
  }
  return null;
}

const aggiornaDimensione = (xml, ultimaRiga) => xml.replace(/<dimension ref="([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?"\/>/,
  (tutto, c1, r1, c2, r2) => `<dimension ref="${c1}${r1}:${c2 || c1}${Math.max(Number(r2 || r1), ultimaRiga)}"/>`);

// Le formule le scriviamo senza risultato: Excel deve ricalcolare all'apertura.
function ricalcoloAllApertura(wbXml) {
  if (/<calcPr\b/.test(wbXml)) {
    // Anche quando il calcPr e' scritto per esteso (<calcPr ...></calcPr>): la
    // chiusura va mangiata con l'apertura, altrimenti resta orfana e il file non
    // si apre piu'.
    return wbXml.replace(/<calcPr\b([^>]*?)\/?>(?:<\/calcPr>)?/, (tutto, attr) => `<calcPr${attr.replace(/\s*\bfullCalcOnLoad="[^"]*"/, '')} fullCalcOnLoad="1"/>`);
  }
  const dopo = ['<pivotCaches', '<oleSize', '<customWorkbookViews', '<extLst', '</workbook>'].map(t => wbXml.indexOf(t)).filter(i => i >= 0);
  const dove = Math.min(...dopo);
  return wbXml.slice(0, dove) + '<calcPr calcId="191029" fullCalcOnLoad="1"/>' + wbXml.slice(dove);
}

// La catena di calcolo memorizzata non varrebbe piu': Excel la rifa' da solo.
function togliCalcChain(voci) {
  if (!voci['xl/calcChain.xml']) return;
  delete voci['xl/calcChain.xml'];
  if (voci['[Content_Types].xml']) {
    voci['[Content_Types].xml'] = strToU8(strFromU8(voci['[Content_Types].xml']).replace(/<Override[^>]*PartName="\/xl\/calcChain\.xml"[^>]*\/>/, ''));
  }
  if (voci['xl/_rels/workbook.xml.rels']) {
    voci['xl/_rels/workbook.xml.rels'] = strToU8(strFromU8(voci['xl/_rels/workbook.xml.rels']).replace(/<Relationship\b[^>]*calcChain\.xml"[^>]*\/>/, ''));
  }
}
