// Verifica dei report settimanali inviati da impianti e stoccaggi.
//
// Ogni settimana un impianto o uno stoccaggio invia l'elenco dei carichi ricevuti
// e spediti. Qui l'elenco viene confrontato riga per riga con il gestionale:
// gli ingressi con le primarie, rete, ACI ed extra raccolta, e con le secondarie
// che arrivano al sito; le uscite con le secondarie, dal portale o inserite in
// Extra Raccolta, che ne partono.
//
// Il confronto e' deterministico. L'agente interviene solo per capire come e'
// fatto il file che arriva, cioe' quale colonna contiene il formulario, il peso,
// le date. I valori vengono poi letti e confrontati dal codice: se fosse il
// modello a trascrivere i formulari potrebbe introdurre proprio gli errori di una
// lettera che la verifica deve scovare.
//
// La data di verifica di un formulario e' sempre quella di fine trasporto, e il
// perimetro di una settimana si stabilisce su quella, lunedi'-
// domenica secondo la numerazione ISO, la stessa del gestionale e del foglio
// Excel di SMOCO. La prima e l'ultima settimana si fermano ai confini dell'anno:
// nel 2026 la settimana 1 va dall'1 al 4 gennaio. Per abbinare le
// righe si guarda pero' una finestra piu' ampia, cosi' un ingresso registrato con
// una data sbagliata viene trovato e segnalato invece di risultare inesistente.

import { fetchAll } from "./fetchAll.ts";
import { formatoKg } from "./formato.ts";
import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";

export const GIORNI_CONSERVAZIONE = 40;
const FINESTRA_ABBINAMENTO_GIORNI = 21;

// === date ===

export function oggiRoma() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
}

function utc(ymd) {
  return new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)));
}

export function aggiungiGiorni(ymd, giorni) {
  const d = utc(ymd);
  d.setUTCDate(d.getUTCDate() + giorni);
  return d.toISOString().slice(0, 10);
}

export function giorniTra(da, a) {
  return Math.round((utc(a).getTime() - utc(da).getTime()) / 86400000);
}

export function settimanaIso(ymd) {
  const d = utc(ymd);
  const giorno = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - giorno);
  const anno = d.getUTCFullYear();
  const settimana = Math.ceil(((d.getTime() - Date.UTC(anno, 0, 1)) / 86400000 + 1) / 7);
  return { anno, settimana };
}

export function lunediSettimana(anno, settimana) {
  const gen4 = new Date(Date.UTC(anno, 0, 4));
  const giorno = gen4.getUTCDay() || 7;
  gen4.setUTCDate(gen4.getUTCDate() - giorno + 1 + (settimana - 1) * 7);
  return gen4.toISOString().slice(0, 10);
}

// Intervallo di una settimana, limitato all'anno solare.
export function intervalloSettimana(anno, settimana) {
  const lunedi = lunediSettimana(anno, settimana);
  const domenica = aggiungiGiorni(lunedi, 6);
  const primo = anno + '-01-01';
  const ultimo = anno + '-12-31';
  return { inizio: lunedi < primo ? primo : lunedi, fine: domenica > ultimo ? ultimo : domenica };
}

// Data di un movimento del gestionale. Le date importate conservano l'ora
// indicata dal portale espressa come UTC: la parte di data e' il giorno reale.
function ymd(v) {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s) ? s : null;
}

// Data scritta in un report: seriale Excel, gg/mm/aaaa con o senza ora,
// gg-mm-aa, aaaa-mm-gg.
export function dataDaValore(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') {
    if (v < 20000 || v > 80000) return null;
    return aggiungiGiorni('1899-12-30', Math.floor(v));
  }
  const s = String(v).trim();
  let m = s.match(/^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^([0-9]{1,2})[/.-]([0-9]{1,2})[/.-]([0-9]{2,4})/);
  if (m) {
    const anno = m[3].length === 2 ? '20' + m[3] : m[3];
    const mese = +m[2], giorno = +m[1];
    if (mese < 1 || mese > 12 || giorno < 1 || giorno > 31) return null;
    return `${anno}-${String(mese).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`;
  }
  if (/^[0-9]+(\.[0-9]+)?$/.test(s)) return dataDaValore(Number(s));
  return null;
}

// Numero scritto in un report, nei formati italiano e internazionale.
export function numeroDaValore(v, unita) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  let s = String(v).trim().replace(/[^0-9,.-]/g, '');
  if (!s || s === '-' ) return null;
  const virgola = s.includes(','), punto = s.includes('.');
  if (virgola && punto) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (virgola) {
    const parti = s.split(',');
    s = parti.length === 2 && parti[1].length !== 3 ? s.replace(',', '.') : s.replace(/,/g, '');
  } else if (punto) {
    const parti = s.split('.');
    // "2.860" in un report in chilogrammi e' un separatore delle migliaia.
    if (parti.length > 2 || (parti.length === 2 && parti[1].length === 3 && unita !== 't')) s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return isFinite(n) ? n : null;
}

// === formulari ===

export function normalizzaFir(v) {
  return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Distanza di Damerau-Levenshtein ristretta, con uscita anticipata oltre il limite.
function distanza(a, b, limite) {
  if (Math.abs(a.length - b.length) > limite) return limite + 1;
  const d = [];
  for (let i = 0; i <= a.length; i++) { d.push(new Array(b.length + 1).fill(0)); d[i][0] = i; }
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let minimoRiga = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + costo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      minimoRiga = Math.min(minimoRiga, d[i][j]);
    }
    if (minimoRiga > limite) return limite + 1;
  }
  return d[a.length][b.length];
}

// Numero dei formulari vidimati: 5 lettere, 6 cifre, 2 lettere (es. RGYTR027030CR).
const FORMATO_FIR = /^[A-Z]{5}\d{6}[A-Z]{2}$/;

const SOMIGLIANTI = { O: '0', '0': 'O', I: '1', '1': 'I', S: '5', '5': 'S', B: '8', '8': 'B', Z: '2', '2': 'Z' };

// Spiega in italiano in cosa differisce il formulario del report da quello del
// gestionale: e' il dettaglio da comunicare al fornitore.
export function descriviDifferenzaFir(report, gestionale) {
  const a = normalizzaFir(report), b = normalizzaFir(gestionale);
  const pos = (i) => `in posizione ${i + 1}`;
  if (a.length === b.length + 1) {
    let i = 0;
    while (i < b.length && a[i] === b[i]) i++;
    if (a.slice(i + 1) === b.slice(i)) return `carattere in piu' "${a[i]}" ${pos(i)}`;
  }
  if (a.length + 1 === b.length) {
    let i = 0;
    while (i < a.length && a[i] === b[i]) i++;
    if (a.slice(i) === b.slice(i + 1)) return `manca il carattere "${b[i]}" ${pos(i)}`;
  }
  if (a.length === b.length) {
    const diversi = [];
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diversi.push(i);
    if (diversi.length === 1) {
      const i = diversi[0];
      const nota = SOMIGLIANTI[a[i]] === b[i] ? ', probabile scambio fra caratteri simili' : '';
      return `"${a[i]}" al posto di "${b[i]}" ${pos(i)}${nota}`;
    }
    if (diversi.length === 2 && diversi[1] === diversi[0] + 1 && a[diversi[0]] === b[diversi[1]] && a[diversi[1]] === b[diversi[0]]) {
      return `caratteri "${a[diversi[0]]}${a[diversi[1]]}" invertiti ${pos(diversi[0])}`;
    }
  }
  const n = distanza(a, b, 5);
  return n <= 5 ? `${n} caratteri diversi` : 'numero diverso';
}

// === confronto dei campi ===

export function classeNormalizzata(v) {
  const s = String(v || '').trim().toUpperCase();
  if (!s) return null;
  if (s.includes('AUTODEMOLIZIONE') || s === 'ACI' || s.includes('CLASS9')) return 'ACI';
  const m = s.match(/CLASS([1-4])/);
  if (m) return { 1: 'P', 2: 'M', 3: 'G1', 4: 'G2' }[m[1]];
  const primo = s.split('-')[0].trim().split(' ')[0];
  return ['P', 'M', 'G1', 'G2'].includes(primo) ? primo : null;
}

// true se i due nomi indicano lo stesso soggetto, false se diversi, null se non
// confrontabili perche' uno dei due manca.
export function nomiCoincidono(a, b) {
  const x = normalizzaRagioneSociale(a || ''), y = normalizzaRagioneSociale(b || '');
  if (!x || !y) return null;
  if (x === y) return true;
  if (Math.min(x.length, y.length) >= 4 && (x.includes(y) || y.includes(x))) return true;
  const tx = new Set(x.split(' ').filter(t => t.length > 2));
  const ty = new Set(y.split(' ').filter(t => t.length > 2));
  if (tx.size === 0 || ty.size === 0) return false;
  let comuni = 0;
  for (const t of tx) if (ty.has(t)) comuni++;
  return comuni / Math.min(tx.size, ty.size) >= 0.6;
}

const cifre = (v) => String(v ?? '').replace(/[^0-9]/g, '');
const it = (d) => (d ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : '');
const kgIt = (n) => formatoKg(n) + ' kg';

// === movimenti del gestionale ===

const FONTI = {
  PrimariaRete: 'Primaria rete',
  PrimariaAci: 'Primaria ACI',
  Secondaria: 'Secondaria',
};

// Le schede di Extra Raccolta sono compilate a mano e possono essere primarie o
// secondarie; quelle inserite prima che esistesse la distinzione sono primarie.
export function eSecondariaExtra(r) {
  return String(r.tipo_movimento || '').toLowerCase().trim() === 'secondaria';
}

function movimento(r, entita) {
  const secondaria = entita === 'Secondaria' || (entita === 'ExtraRaccolta' && eSecondariaExtra(r));
  const fonte = entita === 'ExtraRaccolta' ? (secondaria ? 'Extra raccolta secondaria' : 'Extra raccolta primaria') : FONTI[entita];
  return {
    id: entita + ':' + r.id,
    fonte,
    ordine: String(r.id_ordine || ''),
    fir: String(r.numero_fir || ''),
    firN: normalizzaFir(r.numero_fir),
    kg: Math.round(Number(r.peso_effettivo) || 0),
    inizio: ymd(r.trasporto_iniziato_il),
    fine: ymd(r.trasporto_finito_il),
    produttore: String((secondaria ? (r.stoccaggio || r.ragione_sociale) : (r.produttore || r.ragione_sociale)) || ''),
    punto_raccolta: secondaria ? '' : String(r.punto_di_raccolta || ''),
    codice_pdr: String((entita === 'Secondaria' ? r.id_stoccaggio : (secondaria ? '' : r.id_pdr)) ?? ''),
    destinatario: String(r.destinazione || ''),
    tipo_destinazione: String(r.tipo_destinazione || '').toLowerCase().trim(),
    trasportatore: String(r.trasportatore || ''),
    classe: classeNormalizzata(r.classe) || classeNormalizzata(r.prodotto),
    chiaveDest: normalizzaRagioneSociale(r.destinazione || ''),
    chiaveOrig: secondaria ? normalizzaRagioneSociale(r.stoccaggio || '') : '',
    secondaria,
  };
}

export async function caricaMovimenti(base44) {
  const svc = base44.asServiceRole.entities;
  const nomi = ['PrimariaRete', 'PrimariaAci', 'Secondaria', 'ExtraRaccolta'];
  const [elenchi, fornitori] = await Promise.all([
    Promise.all(nomi.map(n => fetchAll(svc[n]))),
    fetchAll(svc.Fornitore),
  ]);
  const movimenti = [];
  elenchi.forEach((righe, i) => {
    for (const r of righe) {
      if (String(r.stato || '').toLowerCase().trim() !== 'terminato') continue;
      const m = movimento(r, nomi[i]);
      if (m.fine) movimenti.push(m);
    }
  });
  const interni = new Set(['smoco']);
  const anagrafica = new Map();
  for (const f of fornitori) {
    const k = normalizzaRagioneSociale(f.ragione_sociale);
    if (!k) continue;
    anagrafica.set(k, f);
    if (f.interno) interni.add(k);
  }
  return { movimenti, interni, anagrafica };
}

// Che cosa rappresenta un movimento per il sito verificato: un ingresso e' una
// primaria o una secondaria che vi arriva (un impianto riceve anche i carichi
// degli stoccaggi), un'uscita una secondaria che ne parte.
export function relazioneConSito(m, chiave) {
  if (m.chiaveDest === chiave) return 'ingresso';
  if (m.secondaria && m.chiaveOrig === chiave) return 'uscita';
  return null;
}

/**
 * Impianti e stoccaggi attivi nell'anno, con ingressi e uscite della settimana.
 */
export function soggettiDellaSettimana({ movimenti, interni, anagrafica }, anno, settimana) {
  const { inizio, fine } = intervalloSettimana(anno, settimana);
  const soggetti = new Map();
  const tocca = (nome, chiave, ruolo) => {
    if (!chiave || interni.has(chiave)) return;
    if (!soggetti.has(chiave)) soggetti.set(chiave, { chiave, nomi: new Map(), ruoli: new Set() });
    const s = soggetti.get(chiave);
    s.ruoli.add(ruolo);
    if (nome) s.nomi.set(nome, (s.nomi.get(nome) || 0) + 1);
  };

  for (const m of movimenti) {
    if (m.fine.slice(0, 4) !== String(anno)) continue;
    if (m.secondaria) {
      tocca(m.produttore.trim(), m.chiaveOrig, 'stoccaggio');
      tocca(m.destinatario.trim(), m.chiaveDest, 'trattamento');
    } else tocca(m.destinatario.trim(), m.chiaveDest, m.tipo_destinazione === 'stoc' ? 'stoccaggio' : 'trattamento');
  }

  const righe = [];
  for (const s of soggetti.values()) {
    const f = anagrafica.get(s.chiave);
    let nome = f && f.ragione_sociale ? f.ragione_sociale : '';
    if (!nome) for (const n of s.nomi.keys()) if (n.length > nome.length) nome = n;
    const settimanali = movimenti.filter(m => m.fine >= inizio && m.fine <= fine);
    const ingressi = settimanali.filter(m => relazioneConSito(m, s.chiave) === 'ingresso');
    const uscite = settimanali.filter(m => relazioneConSito(m, s.chiave) === 'uscita');
    righe.push({
      chiave: s.chiave,
      nome,
      ruoli: ['trattamento', 'stoccaggio'].filter(r => s.ruoli.has(r)),
      ingressi: ingressi.length,
      kg_ingressi: ingressi.reduce((t, m) => t + m.kg, 0),
      uscite: uscite.length,
      kg_uscite: uscite.reduce((t, m) => t + m.kg, 0),
    });
  }
  righe.sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
  return { inizio, fine, righe };
}

// === righe del report ===

export const CAMPI_REPORT = ['fir', 'peso', 'data_inizio', 'data_fine', 'data', 'produttore', 'codice_pdr', 'destinatario', 'trasportatore', 'intermediario', 'classe', 'targa'];

/**
 * Porta le righe lette dal file in una forma confrontabile.
 * Il peso viene sempre espresso in chilogrammi interi, come nei formulari e nel
 * portale Ecotyre. Se l'unita' non e' nota si deduce dall'ordine di grandezza:
 * un carico di PFU pesa tonnellate, mai decine di migliaia di tonnellate.
 */
export function normalizzaRigheReport(grezze, unitaIndicata) {
  let unita = unitaIndicata === 'kg' || unitaIndicata === 't' ? unitaIndicata : null;
  if (!unita) {
    const valori = grezze.map(g => numeroDaValore(g.peso)).filter(n => n !== null && n > 0).sort((a, b) => a - b);
    const mediana = valori.length ? valori[Math.floor(valori.length / 2)] : 0;
    unita = mediana > 0 && mediana < 100 ? 't' : 'kg';
  }
  const righe = [];
  for (const g of grezze) {
    const fir = String(g.fir ?? '').trim();
    const firN = normalizzaFir(fir);
    const peso = numeroDaValore(g.peso, unita);
    if (!firN && peso === null) continue;
    // Righe dei totali o dei subtotali: "TOT.", "TOTALE", "TOT. 32.780".
    if (!firN && /(^|[^A-Z])TOT(ALE|ALI)?([^A-Z]|$)/i.test(CAMPI_REPORT.map(c => g[c] ?? '').join(' '))) continue;
    // Intestazione ripetuta a meta' foglio (per esempio prima delle uscite): il formulario non ha cifre.
    if (peso === null && !/\d/.test(fir)) continue;
    // Una riga con il solo peso, senza formulario, date e soggetti, e' la riga dei totali.
    const testo = (v) => String(v ?? '').trim();
    if (!firN && !testo(g.data_inizio) && !testo(g.data_fine) && !testo(g.data) && !testo(g.produttore) && !testo(g.trasportatore) && !testo(g.destinatario)) continue;
    righe.push({
      n: g.n,
      ...(g.foglio ? { foglio: String(g.foglio) } : {}),
      fir,
      firN,
      kg: peso === null ? null : Math.round(unita === 't' ? peso * 1000 : peso),
      inizio: dataDaValore(g.data_inizio),
      fine: dataDaValore(g.data_fine),
      data: dataDaValore(g.data),
      produttore: String(g.produttore ?? '').trim(),
      codice_pdr: String(g.codice_pdr ?? '').trim(),
      destinatario: String(g.destinatario ?? '').trim(),
      trasportatore: String(g.trasportatore ?? '').trim(),
      intermediario: String(g.intermediario ?? '').trim(),
      classe_testo: String(g.classe ?? '').trim(),
      classe: classeNormalizzata(g.classe),
      targa: String(g.targa ?? '').trim(),
    });
  }
  return { righe, unita };
}

// === verifica ===

// Un carico che il report attribuisce a un altro consorzio (SMOCO lavora anche per
// Ecopneus) non e' nel gestionale per scelta, non per errore.
const altroCircuito = (intermediario) => !!intermediario && !/ecotyre/i.test(intermediario) && /ecopneus|cobat|green ?tire/i.test(intermediario);

/**
 * Confronta le righe del report con i movimenti del gestionale.
 *
 * Il report di un sito puo' contenere ingressi, cioe' primarie che arrivano, e
 * uscite, cioe' secondarie che partono. Il tipo di ogni riga si ricava dal
 * movimento a cui viene abbinata.
 *
 * Abbinamento di ogni riga, in ordine di affidabilita':
 *   1. stesso formulario;
 *   2. formulario che differisce di uno o due caratteri, segnalato come errato;
 *   3. formulario assente o irriconoscibile: stesso peso al chilogrammo e stessa
 *      data di fine trasporto, con un giorno di margine per ritrovare la riga.
 * Una volta abbinata una riga, ogni campo presente nel report viene confrontato:
 * il peso al chilogrammo, la data di verifica e' quella di fine trasporto.
 *
 * Alla fine, gli ingressi della settimana che nessuna riga ha reclamato sono
 * assenti nel report. Le uscite si controllano allo stesso modo, ma solo se il
 * report ne contiene: un sito che invia i soli ingressi non va segnalato per
 * tutte le secondarie della settimana.
 *
 * Non si considerano, e si elencano a parte, le righe con una data di un'altra
 * settimana (molti report sono cumulativi del mese) quando anche il gestionale
 * le colloca fuori dalla settimana o non le conosce, e le righe non trovate che
 * il report attribuisce a un altro consorzio.
 */
export function verificaReport(righeReport, movimenti, { chiave, nome, inizio, fine }) {
  const relazione = (m) => relazioneConSito(m, chiave);
  const da = aggiungiGiorni(inizio, -FINESTRA_ABBINAMENTO_GIORNI);
  const a = aggiungiGiorni(fine, FINESTRA_ABBINAMENTO_GIORNI);
  const bacino = movimenti.filter(m => m.fine >= da && m.fine <= a);
  const perFir = new Map();
  for (const m of bacino) {
    if (!m.firN) continue;
    if (!perFir.has(m.firN)) perFir.set(m.firN, []);
    perFir.get(m.firN).push(m);
  }
  const nellaSettimana = (m) => m.fine >= inizio && m.fine <= fine;
  const ingressi = bacino.filter(m => nellaSettimana(m) && relazione(m) === 'ingresso');
  const uscite = bacino.filter(m => nellaSettimana(m) && relazione(m) === 'uscita');
  const usati = new Map();

  const dataRiga = (r) => r.fine || r.data;
  const punteggio = (r, m) => {
    let p = 0;
    if (r.kg !== null) p += Math.min(Math.abs(r.kg - m.kg), 5000) / 10;
    const d = dataRiga(r);
    if (d) p += Math.min(Math.abs(giorniTra(d, m.fine)), 30) * 5;
    if (!relazione(m)) p += 200;
    if (usati.has(m.id)) p += 1000;
    return p;
  };
  const migliore = (r, lista) => lista.reduce((best, m) => (best === null || punteggio(r, m) < punteggio(r, best) ? m : best), null);

  const esiti = [];
  // Righe che non riguardano la verifica: carichi di altre settimane nei report
  // cumulativi del mese e carichi di altri circuiti (per esempio Ecopneus).
  const escluse = [];
  const rif = (r) => (r.foglio ? `${String(r.foglio).trim()}, riga ${r.n}` : `riga ${r.n}`);
  const escludi = (r, motivo) => escluse.push({ n: r.n, foglio: r.foglio || '', fir: r.fir, kg: r.kg, data: dataRiga(r), produttore: r.produttore, destinatario: r.destinatario, motivo });
  for (const r of righeReport) {
    let m = null;
    let modo = null;

    if (r.firN && perFir.has(r.firN)) {
      m = migliore(r, perFir.get(r.firN));
      modo = 'fir';
    }

    if (!m && r.firN.length >= 5) {
      let scelto = null, sceltoDist = 3, sceltoPunti = Infinity;
      for (const c of bacino) {
        if (!c.firN) continue;
        const dist = distanza(r.firN, c.firN, 2);
        if (dist > 2) continue;
        const punti = punteggio(r, c);
        if (dist < sceltoDist || (dist === sceltoDist && punti < sceltoPunti)) { scelto = c; sceltoDist = dist; sceltoPunti = punti; }
      }
      if (scelto && (sceltoDist === 1 || (r.kg === scelto.kg && relazione(scelto)))) {
        m = scelto;
        modo = 'fir_simile';
      }
    }

    if (!m && r.kg !== null) {
      const d = dataRiga(r);
      const candidati = bacino.filter(c => relazione(c) && !usati.has(c.id) && c.kg === r.kg
        && (!d || Math.abs(giorniTra(d, c.fine)) <= 1));
      // Senza data, un peso da solo non basta a riconoscere un carico se ce n'e'
      // piu' d'uno uguale.
      if (candidati.length > 0 && (d || candidati.length === 1)) {
        m = migliore(r, candidati);
        modo = 'attributi';
      }
    }

    const report = {
      fir: r.fir, kg: r.kg, inizio: r.inizio, fine: r.fine, data: r.data, produttore: r.produttore,
      codice_pdr: r.codice_pdr, destinatario: r.destinatario, trasportatore: r.trasportatore, classe: r.classe || r.classe_testo,
    };

    const dataReport = dataRiga(r);
    const fuoriSettimana = !!dataReport && (dataReport < inizio || dataReport > fine);
    const foglio = r.foglio ? { foglio: String(r.foglio).trim() } : {};

    if (!m) {
      if (altroCircuito(r.intermediario)) { escludi(r, `Carico di un altro circuito: intermediario ${r.intermediario}`); continue; }
      if (fuoriSettimana) { escludi(r, `Data ${it(dataReport)}, fuori dalla settimana verificata`); continue; }
      esiti.push({ n: r.n, ...foglio, tipo: null, esito: 'non_trovata', report, gestionale: null, discrepanze: [{ campo: 'fir', messaggio: r.firN ? 'Formulario non presente nel gestionale' : 'Riga senza formulario, non abbinabile a nessun movimento' }] });
      continue;
    }
    // Report e gestionale concordano su un'altra settimana: la riga sara' verificata con quella.
    if (fuoriSettimana && !nellaSettimana(m)) {
      escludi(r, `Carico della settimana ${settimanaIso(m.fine).settimana}: nel gestionale il trasporto si conclude il ${it(m.fine)}`);
      continue;
    }

    const tipo = relazione(m);
    const discrepanze = [];
    const aggiungi = (campo, messaggio) => discrepanze.push({ campo, messaggio });

    if (modo === 'fir_simile') {
      // Se solo il numero del report ha il formato dei formulari, l'errore e' nel gestionale.
      if (FORMATO_FIR.test(r.firN) && !FORMATO_FIR.test(m.firN)) aggiungi('fir', `Formulario errato nel gestionale: ${descriviDifferenzaFir(m.fir, r.fir)}. Nel report e' ${r.fir}, con il formato regolare di 5 lettere, 6 cifre e 2 lettere: da correggere sul portale`);
      else aggiungi('fir', `Formulario errato: ${descriviDifferenzaFir(r.fir, m.fir)}. Nel gestionale e' ${m.fir}`);
    }
    if (modo === 'attributi') aggiungi('fir', r.firN ? `Formulario non corrispondente: nel gestionale e' ${m.fir}` : `Formulario assente nel report: nel gestionale e' ${m.fir}`);

    if (r.kg === null) aggiungi('kg', 'Peso assente nel report');
    else if (r.kg !== m.kg) aggiungi('kg', `Peso diverso: report ${kgIt(r.kg)}, gestionale ${kgIt(m.kg)}, differenza ${kgIt(r.kg - m.kg)}`);

    if (r.fine && r.fine !== m.fine) aggiungi('fine', `Data fine trasporto diversa: report ${it(r.fine)}, gestionale ${it(m.fine)}`);
    else if (!r.fine && r.data && r.data !== m.fine) aggiungi('fine', `Data diversa dalla fine trasporto: report ${it(r.data)}, gestionale ${it(m.fine)}`);
    else if (!r.fine && !r.data) aggiungi('fine', 'Data di fine trasporto assente nel report');
    if (r.inizio && m.inizio && r.inizio !== m.inizio) aggiungi('inizio', `Data inizio trasporto diversa: report ${it(r.inizio)}, gestionale ${it(m.inizio)}`);
    if (tipo && !nellaSettimana(m)) {
      aggiungi('fine', `Nel gestionale il trasporto si conclude il ${it(m.fine)}, nella settimana ${settimanaIso(m.fine).settimana} e non in quella verificata`);
    }

    if (r.codice_pdr && cifre(r.codice_pdr) && m.codice_pdr && cifre(r.codice_pdr) !== cifre(m.codice_pdr)) {
      aggiungi('produttore', `Codice produttore diverso: report ${r.codice_pdr}, gestionale ${m.codice_pdr}`);
    } else if (r.produttore) {
      const esito = nomiCoincidono(r.produttore, m.produttore);
      const esitoPunto = nomiCoincidono(r.produttore, m.punto_raccolta);
      if (esito === false && esitoPunto !== true) aggiungi('produttore', `Produttore diverso: report "${r.produttore}", gestionale "${m.produttore}"`);
    }

    if (r.destinatario && nomiCoincidono(r.destinatario, m.destinatario) === false) {
      aggiungi('destinatario', `Destinatario diverso: report "${r.destinatario}", gestionale "${m.destinatario}"`);
    }
    if (!tipo) {
      aggiungi('destinatario', `Nel gestionale questo formulario non riguarda ${nome}: va da ${m.produttore || 'produttore non indicato'} a ${m.destinatario}`);
    }

    if (r.trasportatore && nomiCoincidono(r.trasportatore, m.trasportatore) === false) {
      aggiungi('trasportatore', `Trasportatore diverso: report "${r.trasportatore}", gestionale "${m.trasportatore}"`);
    }

    if (r.classe && m.classe && r.classe !== m.classe) aggiungi('classe', `Classe diversa: report ${r.classe}, gestionale ${m.classe}`);

    const gestionale = {
      fonte: m.fonte, ordine: m.ordine, fir: m.fir, kg: m.kg, inizio: m.inizio, fine: m.fine, produttore: m.produttore,
      punto_raccolta: m.punto_raccolta, codice_pdr: m.codice_pdr, destinatario: m.destinatario, trasportatore: m.trasportatore, classe: m.classe,
    };

    if (usati.has(m.id)) {
      esiti.push({ n: r.n, ...foglio, tipo, esito: 'duplicata', report, gestionale, discrepanze: [{ campo: 'fir', messaggio: `Riga duplicata: lo stesso movimento e' gia' riportato alla ${usati.get(m.id)}` }, ...discrepanze] });
      continue;
    }
    usati.set(m.id, rif(r));
    esiti.push({ n: r.n, ...foglio, tipo, esito: discrepanze.length ? 'discrepanze' : 'conforme', report, gestionale, discrepanze });
  }

  const usciteVerificate = esiti.some(e => e.tipo === 'uscita');
  const assente = (tipo) => (m) => ({
    tipo, fonte: m.fonte, ordine: m.ordine, fir: m.fir, kg: m.kg, inizio: m.inizio, fine: m.fine, produttore: m.produttore,
    destinatario: m.destinatario, trasportatore: m.trasportatore, classe: m.classe,
  });
  const assenti = [
    ...ingressi.filter(m => !usati.has(m.id)).map(assente('ingresso')),
    ...(usciteVerificate ? uscite.filter(m => !usati.has(m.id)).map(assente('uscita')) : []),
  ].sort((x, y) => x.tipo.localeCompare(y.tipo) || String(x.fine).localeCompare(String(y.fine)) || x.fir.localeCompare(y.fir));

  const conta = (e) => esiti.filter(x => x.esito === e).length;
  return {
    esiti,
    assenti,
    escluse,
    riepilogo: {
      righe_report: esiti.length,
      conformi: conta('conforme'),
      con_discrepanze: conta('discrepanze'),
      non_trovate: conta('non_trovata'),
      duplicate: conta('duplicata'),
      assenti_nel_report: assenti.length,
      ingressi_gestionale: ingressi.length,
      peso_ingressi_kg: ingressi.reduce((t, m) => t + m.kg, 0),
      uscite_gestionale: uscite.length,
      peso_uscite_kg: uscite.reduce((t, m) => t + m.kg, 0),
      uscite_verificate: usciteVerificate,
      peso_report_kg: esiti.reduce((t, e) => t + (e.report.kg || 0), 0),
      righe_escluse: escluse.length,
      peso_escluse_kg: escluse.reduce((t, e) => t + (e.kg || 0), 0),
    },
  };
}
