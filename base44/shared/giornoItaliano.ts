// Di una data conta il GIORNO, non l'ora, e il giorno e' quello italiano.
// Regola della direzione, 19/09/2026: "non conta l'ora ma il giorno indicato,
// tutti i ragionamenti vanno fatti sul giorno, considera sempre l'ora italiana".
//
// Le date del gestionale sono di due tipi, e si leggono con due famiglie di
// funzioni diverse (difetto 9, 16/10/2026):
//
// - GLI ISTANTI: la creazione di un record, "oggi", le date dei documenti e dei
//   caricamenti scritte dal gestionale. Sono momenti veri, in UTC: giornoRoma li
//   porta nel fuso italiano e ne prende il giorno di calendario. Vale anche per
//   l'inizio e la fine del trasporto, che sono giorni senza ora: lo scrittore dei
//   file del portale (primarie.ts) li salva sempre a mezzanotte Z, e su quelli
//   giornoRoma e giornoPortale danno lo stesso giorno per costruzione.
//
// - LE ORE DEI FILE DEL PORTALE: l'immissione e la chiusura degli ordini e le
//   date con l'ora del report delle dichiarazioni (ORE_PORTALE in primarie.ts).
//   Il portale scrive l'ora ITALIANA, e il gestionale la salva com'e' scritta,
//   con la Z per convenzione: '2026-12-31T23:30:00.000Z' e' il 31/12/2026 alle
//   23:30 italiane, non le 23:30 UTC. Non e' un istante e non si converte: si
//   legge con giornoPortale, annoPortale, mesePortale, oraPortale e
//   dataPortaleIt. Letta con giornoRoma le si aggiungeva una seconda volta l'ora
//   italiana, e un ordine immesso dopo le 22 d'estate o dopo le 23 d'inverno
//   finiva al giorno dopo (sulla copia dell'11/10/2026: 19 immissioni di rete,
//   una delle quali cambiava mese, e 37 date del report delle dichiarazioni).
//
// Un'ora del portale non si taglia mai come stringa: le funzioni arrotondano al
// secondo, e in archivio restano valori che finiscono per .999 (righe del 2024
// di secondarie e terziarie), che tagliati darebbero l'ora di un secondo prima
// e, al primo 23:59:59.999, il giorno prima.
//
// Questo file non importa niente apposta: lo usano sia dataEnrichment sia
// raccoltoCalculator, che si importano a vicenda.

// Il formatter si crea una volta sola: viene chiamato su decine di migliaia di righe.
const GIORNO_ROMA = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Il giorno italiano di una data, come 'AAAA-MM-GG'. Stringa vuota se non e' una data. */
export function giornoRoma(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  return GIORNO_ROMA.format(d);
}

/** L'anno del giorno italiano, oppure null. */
export function annoRoma(v) {
  const g = giornoRoma(v);
  return g ? Number(g.slice(0, 4)) : null;
}

/** L'indice del mese (0-11) del giorno italiano, oppure -1. */
export function meseRoma(v) {
  const g = giornoRoma(v);
  return g ? Number(g.slice(5, 7)) - 1 : -1;
}

// === LE ORE DEI FILE DEL PORTALE (difetto 9, 16/10/2026) ===
//
// Si leggono le cifre scritte, senza convertirle. Si accettano:
// - 'AAAA-MM-GG', un giorno senza ora;
// - 'AAAA-MM-GG' con l'ora ('T' o spazio, coi secondi o senza), con i decimali
//   dei secondi di qualunque lunghezza - le date di sistema dei record ne hanno
//   sei - e con la Z, con +00:00 o -00:00, o senza fuso: e' la stessa cosa,
//   valgono le cifre scritte;
// - con un altro fuso esplicito: e' un istante vero, e si porta all'ora
//   italiana. Nessuno scrittore del gestionale lo produce;
// - un Date: le sue cifre UTC.
// Tutto si arrotonda al secondo: '...16:59:59.999Z' sono le 17:00, e
// '...23:59:59.999Z' e' il giorno dopo a mezzanotte, come nel file. Ogni altra
// cosa - un numero, un testo gg/mm/aaaa, una data impossibile - non e' una data
// salvata e da' '' (null per l'anno, -1 per il mese): un valore mancante non e'
// un giorno inventato.
const ISO_PORTALE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(\.\d+)?)?)?(Z|[+-]\d{2}:?\d{2})?$/;
// La via veloce, per la forma che salva lo scrittore: fuori dalle 23:59:59
// l'arrotondamento al secondo non puo' cambiare il giorno.
const SCRITTO_PORTALE = /^\d{4}-\d{2}-\d{2}T(?!23:59:59)(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{3}Z$/;
const FUSO_ZERO = /^(?:Z|[+-]00:?00)$/;
const ORA_ROMA = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const GIORNI_DEL_MESE = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const giornoEsiste = (a, m, g) => m >= 1 && m <= 12 && g >= 1
  && g <= (m === 2 && a % 4 === 0 && (a % 100 !== 0 || a % 400 === 0) ? 29 : GIORNI_DEL_MESE[m - 1]);
const alSecondo = (ms) => Math.round(ms / 1000) * 1000;

// Le cifre scritte, come millisecondi di un Date.UTC, arrotondate al secondo;
// null se non e' una data.
function cifrePortale(v) {
  if (v instanceof Date) {
    const t = v.getTime();
    return isNaN(t) ? null : alSecondo(t);
  }
  if (typeof v !== 'string') return null;
  const m = ISO_PORTALE.exec(v.trim());
  if (!m) return null;
  const a = Number(m[1]), me = Number(m[2]), g = Number(m[3]);
  const h = Number(m[4] || 0), mi = Number(m[5] || 0), se = Number(m[6] || 0);
  if (!giornoEsiste(a, me, g) || h > 23 || mi > 59 || se > 59) return null;
  const frazione = m[7] ? Math.round(Number('0' + m[7]) * 1000) : 0;
  const scritte = Date.UTC(a, me - 1, g, h, mi, se, frazione);
  const fuso = m[8];
  if (!fuso || FUSO_ZERO.test(fuso)) return alSecondo(scritte);
  // Un istante vero, con il suo fuso: lo si porta all'ora italiana.
  const f = fuso.replace(':', '');
  const scarto = (f[0] === '-' ? -1 : 1) * (Number(f.slice(1, 3)) * 60 + Number(f.slice(3, 5)));
  const p = {};
  for (const x of ORA_ROMA.formatToParts(new Date(alSecondo(scritte - scarto * 60000)))) p[x.type] = x.value;
  return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
}

/**
 * L'ora del portale nella forma che salva lo scrittore,
 * 'AAAA-MM-GGThh:mm:ss.000Z', arrotondata al secondo; '' se non e' una data.
 * La usa lo scrittore (primarie.ts) per il testo ISO: chi legge usa le funzioni
 * qui sotto.
 */
export function scrittaPortale(v) {
  const t = cifrePortale(v);
  return t === null ? '' : new Date(t).toISOString();
}

/** Il giorno scritto nel file del portale, come 'AAAA-MM-GG'. Stringa vuota se non e' una data. */
export function giornoPortale(v) {
  if (typeof v === 'string' && SCRITTO_PORTALE.test(v) && giornoEsiste(Number(v.slice(0, 4)), Number(v.slice(5, 7)), Number(v.slice(8, 10)))) return v.slice(0, 10);
  const t = cifrePortale(v);
  return t === null ? '' : new Date(t).toISOString().slice(0, 10);
}

/** L'anno del giorno scritto nel file del portale, oppure null. */
export function annoPortale(v) {
  const g = giornoPortale(v);
  return g ? Number(g.slice(0, 4)) : null;
}

/** L'indice del mese (0-11) del giorno scritto nel file del portale, oppure -1. */
export function mesePortale(v) {
  const g = giornoPortale(v);
  return g ? Number(g.slice(5, 7)) - 1 : -1;
}

/** L'ora scritta nel file del portale, 'hh:mm'; '' se il valore non ha ora (solo il giorno, o mezzanotte esatta). */
export function oraPortale(v) {
  const t = cifrePortale(v);
  if (t === null) return '';
  const s = new Date(t).toISOString();
  return s.slice(11, 19) === '00:00:00' ? '' : s.slice(11, 16);
}

/** Il giorno scritto nel file del portale, come 'gg/mm/aaaa' con gli zeri; '' se non e' una data. */
export function dataPortaleIt(v) {
  const g = giornoPortale(v);
  return g ? `${g.slice(8, 10)}/${g.slice(5, 7)}/${g.slice(0, 4)}` : '';
}

/** Oggi, in Italia. */
export const oggiRoma = () => GIORNO_ROMA.format(new Date());
