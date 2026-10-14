// I MODELLI DEI CONTRATTI AI FORNITORI: dal format Word ai segnaposto, e dai
// segnaposto al contratto (giro K3 delle segnalazioni del 20/09, 12/10/2026).
//
// Richiesta dell'utente dell'11/10/2026, testuale: «crea un posto dove caricarti
// i vari format affinche' tu possa compilarli seguendo quello schema ed
// inserendo solo le cose che variano ovvero i dati del fornitore, le quantita'
// annue, il prezzo concordato, le date di validita', ecc...».
//
// Un format e' quasi sempre un contratto gia' compilato per un fornitore (il
// «Contratto Raccolta 2026_RETE MODIFICATO» e' quello di Gatim). Qui si legge
// il testo, si propongono i punti che cambiano - i dati del fornitore, le date
// di validita', la data della firma, l'anno, la quantita' annua, i prezzi, le
// condizioni di pagamento, il massimale della polizza - e, confermati
// dall'amministratore, si sostituiscono con i segnaposto {{...}}. Il contratto
// nuovo si compone cambiando SOLO quei punti: tutto il resto del documento resta
// byte per byte quello del format.
//
// Come si legge un .docx: lo zip ha il testo in word/document.xml (piu'
// intestazioni e piedi di pagina), spezzato in tanti <w:t> quanti sono i pezzi
// con formattazione diversa. Qui il testo di ogni paragrafo si ricompone dai suoi
// <w:t>, tenendo per ogni carattere il pezzo da cui viene: un valore spezzato fra
// due pezzi si sostituisce mettendo il segnaposto nel primo e togliendo il resto
// dal secondo, senza toccare la formattazione di nessuno dei due. Il testo
// cancellato con le revisioni (<w:delText>) e i codici dei campi (<w:instrText>)
// non sono testo visibile e restano fuori.
//
// Sta in src/lib e non in base44/shared: lavora solo nel browser (fflate), e la
// prova lo carica in node (prove/modelliContratto.mjs).
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { leggiModello, generaDocx } from './docxModello.js';
import {
  PUNTI_CONTRATTO, puntoDi, ePrezzo, stileDellaData, leggiData, scriviData, valoriPerIlDocumento, MESI_CONTRATTO,
  ALBO_SMOCO, alboSmocoScaduto,
} from './segnapostiContratto.js';

const PARTI = /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/;
const TIPO_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// ─── il testo, pezzo per pezzo ───

const ENTITA = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decodifica = (s) => String(s).replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  return ENTITA[e] ?? m;
});
const codifica = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// I pezzi che contano: il testo (<w:t>), i caratteri che non sono testo ma
// separano (tabulazione, a capo, trattino unificatore) e i confini di paragrafo.
// <w:tab/> senza attributi e' il carattere di tabulazione; quelli con attributi
// sono le tabulazioni del paragrafo (<w:tabs>) e non c'entrano.
// Le caselle di testo (<w:txbxContent>) e la loro copia di riserva per i
// programmi vecchi (<mc:Fallback>) si segnano: nel contratto di stoccaggio
// T-Cycle 2026, convertito da un PDF, il prezzo vecchio «55,00» sta in una
// casella barrata in rosso sopra la tabella, e c'e' due volte.
const PEZZI = /<w:t(\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br(?:\s[^>]*)?\/>|<w:cr\/>|<w:noBreakHyphen\/>|<w:p(?=[\s>])[^>]*>|<\/w:p>|<w:txbxContent\b[^>]*>|<\/w:txbxContent>|<mc:Fallback\b[^>]*>|<\/mc:Fallback>/g;

/**
 * Le righe di una parte XML: una per paragrafo (un paragrafo dentro una casella
 * di testo e' una riga a se'). Ogni riga ha il testo e i suoi pezzi:
 * { testo, casella, riserva, pezzi: [{ tipo: 't' | 'sep', da, a (nel testo della riga),
 *   tagDa, contDa, contA (nell'XML), attributi }] }.
 */
export function righeDi(xml) {
  const righe = [];
  let caselle = 0;
  let riserve = 0;
  let corrente = { testo: '', pezzi: [] };
  const chiudi = () => { if (corrente.pezzi.length) righe.push({ ...corrente, casella: caselle > 0, riserva: riserve > 0 }); corrente = { testo: '', pezzi: [] }; };
  PEZZI.lastIndex = 0;
  let m;
  while ((m = PEZZI.exec(xml)) !== null) {
    const intero = m[0];
    if (intero.startsWith('<w:txbxContent')) { chiudi(); caselle++; continue; }
    if (intero === '</w:txbxContent>') { chiudi(); caselle = Math.max(0, caselle - 1); continue; }
    if (intero.startsWith('<mc:Fallback')) { chiudi(); riserve++; continue; }
    if (intero === '</mc:Fallback>') { chiudi(); riserve = Math.max(0, riserve - 1); continue; }
    if (intero.startsWith('<w:t') && intero.endsWith('</w:t>')) {
      const testo = decodifica(m[2]);
      const contDa = m.index + intero.indexOf('>') + 1;
      const contA = contDa + m[2].length;
      corrente.pezzi.push({ tipo: 't', da: corrente.testo.length, a: corrente.testo.length + testo.length, tagDa: m.index, contDa, contA, attributi: m[1] || '' });
      corrente.testo += testo;
    } else if (intero === '<w:tab/>' || intero.startsWith('<w:br') || intero === '<w:cr/>' || intero === '<w:noBreakHyphen/>') {
      const c = intero === '<w:tab/>' ? '\t' : intero === '<w:noBreakHyphen/>' ? '\u2011' : '\n';
      corrente.pezzi.push({ tipo: 'sep', da: corrente.testo.length, a: corrente.testo.length + 1 });
      corrente.testo += c;
    } else {
      chiudi();
    }
  }
  chiudi();
  return righe;
}

/** Il testo visibile di un documento letto: tutte le righe di tutte le parti, nell'ordine. */
export function testoDelDocumento(parti) {
  const out = [];
  for (const nome of Object.keys(parti).sort((a, b) => (a === 'word/document.xml' ? -1 : b === 'word/document.xml' ? 1 : a.localeCompare(b)))) {
    for (const r of righeDi(parti[nome])) out.push(r.testo);
  }
  return out;
}

// ─── le revisioni ───

const TAG_REVISIONE = /<w:(?:ins|del|moveFrom|moveTo)\b/g;

/** Quante modifiche con le revisioni (inserimenti, cancellazioni, spostamenti) ha un XML. */
export const contaRevisioni = (xml) => (String(xml).match(TAG_REVISIONE) || []).length;

/**
 * Accetta le revisioni di una parte: il testo cancellato se ne va, quello inserito
 * resta senza il segno, le formattazioni cambiate restano quelle nuove. Il
 * contratto ACI di Tecnogum (il «[RIFERIMENTO GRETA]») ha le revisioni aperte:
 * senza accettarle il testo letto era «dal 2 Marzo 2021° aprile 20266», le due
 * versioni insieme, e il contratto generato le avrebbe mostrate tutte e due. Il
 * segno di un paragrafo cancellato si toglie e il paragrafo resta: Word li
 * unirebbe, il testo non cambia.
 */
export function accettaRevisioni(xml) {
  let s = String(xml);
  s = s.replace(/<w:(?:del|ins|moveFrom|moveTo)\b[^>]*\/>/g, '');
  s = s.replace(/<w:(del|moveFrom)\b[^>]*>[\s\S]*?<\/w:\1>/g, '');
  s = s.replace(/<w:(?:ins|moveTo)\b[^>]*>/g, '').replace(/<\/w:(?:ins|moveTo)>/g, '');
  const CAMBI = '(?:rPrChange|pPrChange|sectPrChange|tblPrChange|tblPrExChange|tblGridChange|trPrChange|tcPrChange|numberingChange)';
  s = s.replace(new RegExp(`<w:(${CAMBI})\\b[^>]*>[\\s\\S]*?<\\/w:\\1>`, 'g'), '');
  s = s.replace(new RegExp(`<w:${CAMBI}\\b[^>]*\\/>`, 'g'), '');
  s = s.replace(/<w:(?:moveFromRangeStart|moveFromRangeEnd|moveToRangeStart|moveToRangeEnd|cellIns|cellDel|cellMerge)\b[^>]*\/>/g, '');
  return s;
}

/**
 * Legge un format .docx: { voci, parti, segnaposti, testo, revisioni }. Con
 * accetta: true le revisioni aperte si accettano prima di tutto il resto.
 */
export async function leggiFormat(file, { accetta = true } = {}) {
  const voci = unzipSync(new Uint8Array(await file.arrayBuffer()));
  if (!voci['word/document.xml']) throw new Error('Questo non è un documento Word: dentro non c\'è word/document.xml.');
  let revisioni = 0;
  for (const nome of Object.keys(voci)) {
    if (!PARTI.test(nome)) continue;
    const xml = strFromU8(voci[nome]);
    const n = contaRevisioni(xml);
    revisioni += n;
    if (accetta && n) voci[nome] = strToU8(accettaRevisioni(xml));
  }
  const zip = zipSync(voci, { level: 0 });
  const letto = await leggiModello({ arrayBuffer: async () => zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) });
  return { ...letto, revisioni, revisioni_accettate: accetta && revisioni > 0 };
}

// ─── la ricerca nel testo ───

const MESI_RE = MESI_CONTRATTO.join('|');
const DATA = `(\\d{1,2}°?\\s*(?:${MESI_RE})\\s+\\d{4}|\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{4})`;
const FORME = '(?:S\\.?\\s?R\\.?\\s?L\\.?\\s?S\\.?|S\\.?\\s?R\\.?\\s?L\\.?|S\\.?\\s?P\\.?\\s?A\\.?|S\\.?\\s?A\\.?\\s?S\\.?|S\\.?\\s?N\\.?\\s?C\\.?|S\\.?\\s?C\\.?\\s?A\\.?\\s?R\\.?\\s?L\\.?|S\\.?\\s?C\\.?\\s?R\\.?\\s?L\\.?|SRLS|srls)(?:\\s+(?:a|con)\\s+socio\\s+unico)?';
const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Un numero all'italiana, intero: «1050» e «1.050» tutti e due (con \d{1,3} da
// solo, in «1050 ton/anno» si trovava «050»).
const CIFRE = '\\d+(?:\\.\\d{3})*(?:,\\d+)?';
const VUOTO = /^[\s_.]*_{3,}[\s_.]*$/;
// Il confine di un nome: prima e dopo non ci devono essere lettere o cifre, e il
// nome non deve stare dentro un indirizzo email o web (info@gatim.eu non e' la
// ragione sociale di Gatim). Il trattino basso invece fa da confine: nelle firme
// dei contratti di trasporto il nome sta fra le linee da firmare
// («_NunzioStefano Nappi_») e prima restava li' (revisione del 13/10/2026).
const cBordo = (c) => !c || !/[\p{L}\p{N}@]/u.test(c);
const prima = (t, i) => (i > 0 ? t[i - 1] : '');
const dopo = (t, i) => (i < t.length ? t[i] : '');
function inIndirizzoWeb(t, da, a) {
  let s = da;
  while (s > 0 && !/\s/.test(t[s - 1])) s--;
  let e = a;
  while (e < t.length && !/\s/.test(t[e])) e++;
  return /@|:\/\/|www\./i.test(t.slice(s, e));
}
const bordato = (t, da, a) => cBordo(prima(t, da)) && cBordo(dopo(t, a)) && !inIndirizzoWeb(t, da, a);

// Le cariche del legale rappresentante, al maschile e al femminile. Fino al
// 13/10/2026 c'erano solo quelle al maschile: «rappresentato dall'Amministratrice
// Sig.ra Bonavita Tiziana» dava come nome tutto «Amministratrice Sig.ra Bonavita
// Tiziana», che non compariva da nessun'altra parte, e nel contratto nuovo
// restavano il nome sotto la firma, la carica e il referente della privacy.
const CARICA = '(?:Amministrat(?:ore|rice)\\s+(?:Unic[oa]|Delegat[oa])|Amministrat(?:ore|rice)|Legale\\s+Rappresentante|Rappresentante\\s+Legale|Presidente(?:\\s+del\\s+C\\.?\\s?d\\.?\\s?A\\.?)?|Titolare|Soci[oa]\\s+Amministrat(?:ore|rice)|Procurat(?:ore|rice)(?:\\s+speciale)?|Delegat[oa])';
const SOLO_CARICA = new RegExp(`^${CARICA}$`, 'iu');
// I titoli davanti al nome. «Sig.re Nunziostefano Nappi» si leggeva «re
// Nunziostefano Nappi» (revisione del 13/10/2026).
const TITOLO = '(?:Sig\\.ra|Sig\\.re|Sig\\.na|Sig\\.|Sig(?=\\s)|Signora|Signor|Dott\\.ssa|Dott\\.|Dr\\.|Avv\\.|Ing\\.|Rag\\.|Geom\\.)';
// Un nome di persona scritto per esteso: da due a quattro parole con la maiuscola.
const NOME = "[A-ZÀ-Ý][\\p{L}'’]+(?:\\s+[A-ZÀ-Ý][\\p{L}'’]+){1,3}";
const NOME_PERSONA = new RegExp(`^${NOME}`, 'u');
// La camera di commercio: «Registro Imprese di Catanzaro 02015210798», «della
// Basilicata», «di Toscana Nord-Ovest», «di Catanzaro, Crotone e Vibo Valentia»
// seguito dal codice fiscale.
const CCIAA = "Registro\\s+(?:delle\\s+)?Imprese\\s+((?:di|della|del|dell['’])\\s*[A-ZÀ-Ü][\\p{L}'’ ,.-]*?)\\s*,?\\s+(?:n\\.?\\s*)?(?=\\d|[A-Z]{6}\\d{2}[A-Z])";
const DOPO_REGISTRO = /(?:Registro\s+(?:delle\s+)?Imprese|C\.?\s?C\.?\s?I\.?\s?A\.?\s?A\.?|Camera\s+di\s+Commercio(?:[\s,]+Industria,?\s+Artigianato\s+e\s+Agricoltura)?)\s*$/i;

/** Il nome senza la forma societaria finale: «GATIM S.R.L.» -> «GATIM», «T-Cycle Industries srl» -> «T-Cycle Industries». */
export function nucleoDelNome(nome) {
  return String(nome || '').replace(new RegExp(`[\\s,]+${FORME}\\.?\\s*$`, 'i'), '').replace(/[\s,.]+$/, '').trim();
}

/** Le varianti di un nome di persona: «Azzarito Domenico» e «Domenico Azzarito», in qualunque maiuscola. */
function regexPersona(nome) {
  const parti = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (!parti.length) return null;
  const ordini = [parti];
  if (parti.length >= 2) ordini.push([parti[parti.length - 1], ...parti.slice(0, -1)], [...parti.slice(1), parti[0]]);
  const alt = [...new Set(ordini.map(o => o.map(escapeRe).join('\\s+')))];
  return new RegExp(`(?:${alt.join('|')})`, 'giu');
}

/** Due modi di scrivere la stessa persona: le stesse parole, in qualunque ordine e maiuscola. */
const parolePersona = (nome) => String(nome || '').toLowerCase().split(/\s+/).filter(Boolean).sort().join(' ');
const stessaPersona = (a, b) => !!a && !!b && parolePersona(a) === parolePersona(b);

/** Le colonne di una riga (i pezzi fra le tabulazioni), senza quelle vuote. */
const segmenti = (testo) => {
  const out = [];
  let da = 0;
  for (const s of testo.split('\t')) {
    if (s.trim()) out.push({ da, a: da + s.length, s });
    da += s.length + 1;
  }
  return out;
};

// ─── i dati di SMOCO: non si toccano mai ───
//
// Fino al 13/10/2026 il lettore non sapeva dove fossero i dati di SMOCO: col
// contratto di trasporto di Logistica srl il nome «LOGISTICA», cercato senza
// distinguere le maiuscole, prendeva il «Responsabile della Logistica» di
// SMOCO, e il telefono del suo referente diventava quello del fornitore
// (revisione del 13/10/2026). Ora sono di SMOCO, e nessun punto ci mette un
// segnaposto: le righe col suo codice fiscale, i suoi recapiti («quanto a
// SMOCO», «per il Committente», un indirizzo @smoco), la sua parte della riga
// della privacy («per SMOCO ... per il FORNITORE ...»), le sue persone dovunque
// compaiano e il suo riquadro delle firme. SMOCO e' l'unico partner operativo:
// il suo codice fiscale e' fisso.
const CF_SMOCO = '02971520735';
const RIGA_COMUNICAZIONI = /quanto\s+al(?:l['’])?\s*(?:FORNITORE|VETTORE|OPERATORE)/i;
const RIGA_REFERENTE = /^\W*per\s+(?:il|l['’])\s*(?:FORNITORE|VETTORE|OPERATORE)\s*:/i;
const rigaDiSmoco = (t) => t.includes(CF_SMOCO)
  || /^\W*quanto\s+a(?:l(?:la)?)?\s+(?:SMOCO|Committente)\b/i.test(t)
  || /^\W*per\s+(?:il|la)\s+Committente\b/i.test(t)
  || (/@(?:pec\.)?smoco\./i.test(t) && !RIGA_COMUNICAZIONI.test(t) && !RIGA_REFERENTE.test(t));
const FIRMA_SMOCO = /^\s*SMOCO\s+S\.?\s?R\.?\s?L\.?[\s._]*$/i;
const PERSONA_DI_SMOCO = new RegExp(`\\b(?:[Aa]vv|[Ss]ig(?:\\.ra|\\.re|\\.na)?|[Dd]ott(?:\\.ssa)?|[Dd]r|[Ii]ng|[Rr]ag|[Gg]eom)\\.?\\s+(${NOME})|\\b[Dd]elegat[oa]\\s+(${NOME})|\\b[Aa]ttenzione\\s+di\\s+(${NOME})`, 'gu');

/**
 * Dove sono i dati di SMOCO: { zone: "parte|riga" -> [[da, a]], persone }.
 * rappresentante e' quello del fornitore: se e' anche una persona che compare
 * per SMOCO (Irigom ha lo stesso amministratore), resta del fornitore.
 */
function zoneDiSmoco(righe, blocco, rappresentante) {
  const zone = new Map();
  const chiave = (r) => `${r.parte}|${r.indice}`;
  const metti = (r, da, a) => {
    if (a <= da) return;
    if (!zone.has(chiave(r))) zone.set(chiave(r), []);
    zone.get(chiave(r)).push([da, a]);
  };
  const delBlocco = (r) => !!blocco && blocco.righe.includes(r);
  for (const r of righe) {
    if (delBlocco(r)) continue;
    if (rigaDiSmoco(r.testo)) { metti(r, 0, r.testo.length); continue; }
    const s = r.testo.search(/\bper\s+(?:SMOCO|(?:il|la)\s+Committente)\b/i);
    const f = r.testo.search(/\bper\s+(?:il|la|l['’])\s*(?:FORNITORE|Vettore|OPERATORE)\b/i);
    if (s >= 0 && f >= 0) metti(r, s, f > s ? f : r.testo.length);
  }
  const persone = [];
  for (const r of righe) {
    for (const [x, y] of zone.get(chiave(r)) || []) {
      for (const m of r.testo.slice(x, y).matchAll(PERSONA_DI_SMOCO)) {
        const nome = (m[1] || m[2] || m[3]).trim();
        if (stessaPersona(nome, rappresentante)) continue;
        if (!persone.some(p => stessaPersona(p, nome))) persone.push(nome);
      }
    }
  }
  const rePersone = persone.map(regexPersona).filter(Boolean);
  for (const r of righe) {
    for (const re of rePersone) {
      for (const m of r.testo.matchAll(re)) if (bordato(r.testo, m.index, m.index + m[0].length)) metti(r, m.index, m.index + m[0].length);
    }
  }
  // Il riquadro delle firme: sotto «SMOCO S.r.l.» la linea, la carica e il nome,
  // finche' le righe sono solo questo; con le firme affiancate, la colonna di
  // SMOCO; con le firme in una tabella letta cella per cella (EMMESSE: SMOCO,
  // fornitore, il nome di SMOCO, quello del fornitore, la carica di SMOCO,
  // quella del fornitore) una riga si' e una no.
  const soloFirma = (t) => {
    let s = t;
    for (const re of rePersone) s = s.replace(re, ' ');
    return /^[\s_]*$/.test(s.replace(new RegExp(CARICA, 'giu'), ' '));
  };
  const stessaParte = (r, j) => j < righe.length && righe[j].parte === r.parte;
  righe.forEach((r, k) => {
    const segs = segmenti(r.testo);
    const col = segs.findIndex(x => FIRMA_SMOCO.test(x.s));
    if (col < 0) return;
    metti(r, segs[col].da, segs[col].a);
    if (segs.length > 1) {
      for (let j = k + 1; j <= k + 4 && stessaParte(r, j); j++) {
        const s2 = segmenti(righe[j].testo);
        if (s2.length === segs.length) metti(righe[j], s2[col].da, s2[col].a);
      }
      return;
    }
    let j = k + 1;
    for (; j <= k + 4 && stessaParte(r, j) && soloFirma(righe[j].testo); j++) metti(righe[j], 0, righe[j].testo.length);
    if (j === k + 1 && stessaParte(r, k + 2) && soloFirma(righe[k + 2].testo)) {
      for (let h = k + 2; h <= k + 6 && stessaParte(r, h) && soloFirma(righe[h].testo); h += 2) metti(righe[h], 0, righe[h].testo.length);
    }
  });
  return { zone, persone };
}

// ─── l'iscrizione di SMOCO all'Albo: una data sola ───
//
// Decisione dell'utente del 13/10/2026: l'iscrizione di SMOCO all'Albo (cat. 8
// BA-11513) e' del 16/05/2025, valida fino al rinnovo del 2030 (ALBO_SMOCO in
// segnapostiContratto). E' l'unico dato di SMOCO che il lettore cambia. Nei
// format la riga dell'Albo ha date diverse: «Contratto Raccolta 2026_RETE
// MODIFICATO» dice «del 15/05/2020», l'iscrizione di prima; altri contratti del
// 2026 «16/05/2026» (l'anno cambiato come se fosse quello del contratto) o
// «15/05/2025». Nel modello e nel contratto generato diventa 16/05/2025, nello
// stile del format («16/05/2025», «16.05.2025»), e il resto della riga resta
// com'e'. Lo stesso numero con la categoria 4 (Eco Faso: «n. BA11513 del
// 01.04.2022 per raccolta e trasporto … categoria 4») e' un'altra iscrizione e
// non si tocca; senza la categoria scritta il lettore non sceglie, e lo dice. Le
// date dell'Albo di SMOCO non sono mai un punto: nemmeno l'anno del contratto.
const [, SIGLA_ALBO, CIFRE_ALBO] = ALBO_SMOCO.numero.match(/^([A-Z]+)[\s-]?(\d+)$/);
const NUMERO_ALBO = new RegExp(`(?<![A-Za-z0-9])${SIGLA_ALBO}[\\s-]?${CIFRE_ALBO}(?!\\d)`, 'gi');
const categoriaAlbo = (n) => new RegExp(`\\bcat(?:egoria|\\.)?\\s*${n}(?!\\d)`, 'i');
const contestoDi = (testo, da, a) => `${da > 40 ? '…' : ''}${testo.slice(Math.max(0, da - 40), da)}«${testo.slice(da, a)}»${testo.slice(a, a + 40)}${a + 40 < testo.length ? '…' : ''}`;

/**
 * Le date dell'iscrizione di SMOCO all'Albo nelle righe di un documento
 * ([{ parte, indice, testo }]): il numero BA-11513 seguito da «del <data>». Per
 * ognuna: { parte, riga, da, a, testo, data (aaaa-mm-gg), categoria ('8', '4' o
 * null se il testo non la dice), correggi, nuovo (la data giusta nello stile del
 * format, solo se va corretta), contesto }.
 */
export function alboSmocoNelleRighe(righe) {
  const out = [];
  const reData = new RegExp(`^\\s*,?\\s*(?:del|in\\s+data)\\s+${DATA}`, 'i');
  for (const r of righe || []) {
    const numeri = [...String(r.testo || '').matchAll(NUMERO_ALBO)];
    numeri.forEach((m, k) => {
      const fineNumero = m.index + m[0].length;
      const d = r.testo.slice(fineNumero).match(reData);
      if (!d) return;
      const da = fineNumero + d[0].length - d[1].length;
      const a = da + d[1].length;
      // La categoria si legge nella sua parte di riga: dopo la data fino al
      // numero seguente, e subito prima del numero («Iscrizione Albo cat.8 BA-11513»).
      const dopo = r.testo.slice(a, k + 1 < numeri.length ? numeri[k + 1].index : r.testo.length);
      const inizio = k > 0 ? numeri[k - 1].index + numeri[k - 1][0].length : 0;
      const prima = r.testo.slice(Math.max(inizio, m.index - 40), m.index);
      const categoria = categoriaAlbo(4).test(dopo) || /raccolta\s+e\s+trasporto/i.test(dopo) ? '4'
        : (categoriaAlbo(8).test(dopo) || categoriaAlbo(8).test(prima) || /intermediazion/i.test(dopo)) ? '8' : null;
      const data = leggiData(d[1]);
      const correggi = categoria === ALBO_SMOCO.categoria && data !== ALBO_SMOCO.data;
      out.push({
        parte: r.parte, riga: r.indice, da, a, testo: d[1], data, categoria, correggi,
        nuovo: correggi ? scriviData(ALBO_SMOCO.data, stileDellaData(d[1])) : null,
        contesto: contestoDi(r.testo, da, a),
      });
    });
  }
  return out;
}

/**
 * Corregge nelle parti di un documento la data dell'iscrizione di SMOCO all'Albo
 * in categoria 8, dove e' diversa dal 16/05/2025. Cambia solo il testo della
 * data, con la sua formattazione. @returns { parti, correzioni, saltate }
 */
export function correggiAlboSmoco(parti) {
  const righe = [];
  for (const parte of Object.keys(parti || {})) righeDi(parti[parte]).forEach((r, i) => righe.push({ parte, indice: i, testo: r.testo }));
  const correzioni = alboSmocoNelleRighe(righe).filter(o => o.correggi);
  if (!correzioni.length) return { parti, correzioni, saltate: [] };
  const occorrenze = correzioni.map(o => ({ parte: o.parte, riga: o.riga, da: o.da, a: o.a, testo: o.testo, attiva: true, con: o.nuovo }));
  const { parti: corrette, saltate } = applicaPunti(parti, [{ segnaposto: 'ALBO_SMOCO', attivo: true, occorrenze }]);
  return { parti: corrette, correzioni, saltate };
}

// ─── il paragrafo del fornitore ───

const PARTE_FORNITORE = /di\s+seguito\s+(?:anche\s+)?(?:indicat[oa]\s+come\s+)?(?:(?:il|la|lo|l['’])\s*)?["“”'«]?\s*(FORNITORE|VETTORE|OPERATORE|SUBFORNITORE|APPALTATORE)/i;

/**
 * Il paragrafo con «(di seguito il "FORNITORE")». Di solito e' una riga; nel
 * contratto di stoccaggio di Nappi Sud 2026, convertito da un PDF, e' spezzato
 * in tre righe e non si trovava: restavano tutti i dati del fornitore
 * (revisione del 13/10/2026). Allora si provano anche due o tre righe di fila.
 * @returns { righe, testo, posizione(da, lunghezza) -> { r, da } | null } o null
 */
function trovaBlocco(righe) {
  const buono = (t) => PARTE_FORNITORE.test(t) && /sede|partita\s+iva|p\.\s?iva/i.test(t);
  const ammessa = (r) => !rigaDiSmoco(r.testo) && !/^\s*[•·-]?\s*quanto\s+al/i.test(r.testo);
  const crea = (gruppo) => {
    const inizi = [];
    let n = 0;
    for (const r of gruppo) { inizi.push(n); n += r.testo.length + 1; }
    return {
      righe: gruppo,
      testo: gruppo.map(r => r.testo).join(' '),
      posizione(da, lunghezza) {
        for (let k = gruppo.length - 1; k >= 0; k--) {
          if (da < inizi[k]) continue;
          const locale = da - inizi[k];
          return locale + lunghezza <= gruppo[k].testo.length ? { r: gruppo[k], da: locale } : null;
        }
        return null;
      },
    };
  };
  const una = righe.find(r => buono(r.testo) && ammessa(r));
  if (una) return crea([una]);
  for (let i = 0; i < righe.length; i++) {
    if (!/con\s+sede/i.test(righe[i].testo) || !ammessa(righe[i])) continue;
    for (let n = 2; n <= 3; n++) {
      const g = righe.slice(i, i + n);
      if (g.length < n || g.some(x => x.parte !== righe[i].parte || !ammessa(x))) break;
      if (buono(g.map(x => x.testo).join(' '))) return crea(g);
    }
  }
  return null;
}

/** I dati scritti nel paragrafo del fornitore, con la loro posizione nel testo del paragrafo. */
function leggiBlocco(t) {
  const d = { dubbi: [] };
  // La ragione sociale: quello che viene prima di «con sede». «e GATIM S.R.L.,
  // con sede…» e anche «E GATIM…»: la congiunzione fra le parti non fa parte del nome.
  const mSede = t.match(/^(.*?)[,]?\s*con\s+sede/i);
  d.ragione = mSede ? mSede[1].replace(/^\s*(?:e\s+)?["“]?/i, '').replace(/["”]?\s*$/, '').trim() : '';
  // La sede legale: fino alla provincia fra parentesi, o fino al codice fiscale.
  const dopoSede = t.match(/con\s+sede(?:\s+legale)?(?:\s+in)?\s+/i);
  if (dopoSede) {
    const inizio = dopoSede.index + dopoSede[0].length;
    const resto = t.slice(inizio);
    const conProv = resto.match(/^(.{3,160}?\(\s*[A-Z_]{2,4}\s*\))/);
    const finoCf = resto.match(/^(.{3,200}?)(?=,?\s*(?:e\s+sede\s+operativa|Codice\s+Fiscale|C\.\s?F\.|Partita\s+IVA|P\.\s?IVA|Iscrizion|rappresentat))/i);
    let sede = (conProv && conProv[1]) || (finoCf && finoCf[1]) || '';
    // «__________ (____), Via _____________ n. __» nel format vuoto del trasporto
    // e' tutto la sede: si prende fino al codice fiscale.
    if (finoCf && /_{3,}/.test(finoCf[1])) sede = finoCf[1];
    sede = sede.replace(/[,\s]+$/, '');
    if (sede) d.sede = { testo: sede, da: inizio, vuota: /_{3,}/.test(sede) };
  }
  const operativa = t.match(/e\s+sede\s+operativa\s+(?:in\s+)?(.{3,160}?\(\s*[A-Z]{2}\s*\))/i);
  if (operativa) d.operativa = operativa[1];
  // La partita IVA: le undici cifre, ovunque compaiano (anche come codice fiscale).
  const piva = t.match(/(?:Partita\s+IVA|P\.\s?IVA)[^0-9_]{0,80}?(\d{11}|_{3,})/i) || t.match(/\b(\d{11})\b/);
  if (piva) d.piva = piva[1];
  const cf = t.match(/\b([A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z])\b/);
  if (cf) d.cf = cf[1];
  // Un codice fiscale di undici cifre diverso dalla partita IVA (Ecoservice:
  // «Codice Fiscale e Iscrizione al Registro Imprese … 01652240647, Partita
  // IVA 00656800455»): restava nel contratto nuovo (revisione del 13/10/2026).
  if (!d.cf) {
    const altro = [...t.matchAll(/(?<!\d)(\d{11})(?!\d)/g)].map(m => m[1]).find(n => n !== d.piva && n !== CF_SMOCO);
    if (altro) d.cf = altro;
  }
  const cciaa = t.match(new RegExp(CCIAA, 'iu'));
  if (cciaa) d.cciaa = cciaa[1];
  const rea = t.match(/(CCIAA\s+[A-Z]{2}\s*n\.?\s*[\d.]+|REA\s+(?:n\.?\s*)?[A-Z]{2}[\s-]*\d+)/);
  if (rea) d.rea = rea[1];
  // Il legale rappresentante e la sua carica: «rappresentato dall'Amministratore
  // Unico Sig. Azzarito Domenico», «dall'Amministratrice la Sig.ra Di Pisa
  // Valentina», «da Guido Costanzo in qualità di Legale Rappresentante», e anche
  // «…, Legale rappresentante Sig.ra Caterina Bianco (di seguito…» (Nappi Sud).
  const rapp = t.match(/rappresentat[oa]\s+(?:legalmente\s+)?(?:nel\s+presente\s+contratto\s+)?(?:da(?:ll['’]\s*|lla\s+|l\s+|\s+))(.*?)\s*\(\s*di\s+seguito/i)
    || t.match(new RegExp(`[,;]\\s*((?:${CARICA})\\s+.*?)\\s*\\(\\s*di\\s+seguito`, 'iu'));
  if (rapp) {
    let dentro = rapp[1];
    let pos = t.indexOf(rapp[1], rapp.index);
    const togli = (m) => { pos += m[0].length; dentro = dentro.slice(m[0].length); };
    const q = dentro.match(new RegExp(`^(${CARICA})\\s+`, 'iu'));
    if (q) { d.qualifica = { testo: q[1], da: pos }; togli(q); }
    const articolo = dentro.match(/^(?:il|la|lo)\s+/i);
    if (articolo) togli(articolo);
    const titolo = dentro.match(new RegExp(`^${TITOLO}\\s*`, 'iu'));
    if (titolo) { d.titolo = titolo[0].trim(); togli(titolo); }
    const qDopo = dentro.match(/\s+in\s+qualit[àa]\s+di\s+(.+)$/i);
    if (qDopo) {
      const q2 = qDopo[1].trim();
      d.qualifica = { testo: q2, da: pos + qDopo.index + qDopo[0].indexOf(q2) };
      dentro = dentro.slice(0, qDopo.index);
    }
    const nome = dentro.replace(/[,\s]+$/, '').trim();
    if (nome) {
      d.rappresentante = { testo: nome, da: pos + dentro.indexOf(nome), vuoto: /_{3,}/.test(nome) };
      const strano = !/^[A-ZÀ-Ý]/.test(nome) || nome.split(/\s+/).length < 2
        || nome.split(/\s+/).some(w => /^(?:sig|dott|avv|amministrat|legale|rappresentant|delegat|titolare|procurat)/i.test(w));
      if (!d.rappresentante.vuoto && strano) d.dubbi.push(`il nome del rappresentante letto nel format è «${nome}»: controlla che sia solo il nome, senza carica né titolo`);
    }
  }
  return d;
}

// ─── la proposta ───

/**
 * Propone i punti che cambiano in un format letto con leggiFormat.
 *
 * opzioni: { tipo, canale } del modello (decidono il nome del segnaposto della
 * quantita' e dei prezzi), fornitori (l'anagrafica, per dire di chi e' il
 * contratto compilato).
 *
 * oggi (aaaa-mm-gg, di norma il giorno italiano di oggi): per dire quando
 * l'iscrizione di SMOCO all'Albo e' scaduta e va rinnovata (13/10/2026).
 *
 * Restituisce { punti, fornitore, anno, avvisi, da_controllare, albo_smoco }. Ogni punto:
 * { segnaposto, nome, categoria, tipo, originale, stile, attivo, da_controllare,
 *   occorrenze: [{ parte, riga, da, a, testo, contesto, attiva, motivo, dubbia }] }.
 * Le occorrenze attive sono quelle che diventano segnaposto; le altre si
 * mostrano, spente, col motivo, perche' l'amministratore possa accenderle.
 *
 * da_controllare (revisione del 13/10/2026): i motivi per cui il lettore non e'
 * sicuro di aver preso tutto il punto (un pezzo del nome del rappresentante
 * rimasto fuori, un anno che non sa se e' quello del contratto, un numero di
 * telefono scritto in un altro modo...), o null. Prima un punto con un dato del
 * fornitore di partenza rimasto nel documento risultava acceso e completo, e
 * l'amministratore non aveva nessun avviso.
 */
export function proponiPunti(letto, { tipo = 'raccolta', fornitori = [], oggi = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' }) } = {}) {
  const parti = Object.keys(letto.parti).sort((a, b) => (a === 'word/document.xml' ? -1 : b === 'word/document.xml' ? 1 : a.localeCompare(b)));
  const righe = [];
  for (const parte of parti) righeDi(letto.parti[parte]).forEach((r, i) => righe.push({ parte, indice: i, testo: r.testo, casella: r.casella, riserva: r.riserva }));
  const chiave = (r) => `${r.parte}|${r.indice}`;
  const posto = new Map(righe.map((r, k) => [chiave(r), k]));
  const occupato = new Map(); // "parte|riga" -> [[da, a]]
  const punti = new Map();
  const avvisi = [];

  // Prima di tutto: il paragrafo del fornitore, i suoi dati, e dove sono quelli di SMOCO.
  const blocco = trovaBlocco(righe);
  const dati = blocco ? leggiBlocco(blocco.testo) : null;
  const rappresentante = dati && dati.rappresentante && !dati.rappresentante.vuoto ? dati.rappresentante.testo : '';
  const { zone } = zoneDiSmoco(righe, blocco, rappresentante);
  const inSmoco = (r, da, a) => (zone.get(chiave(r)) || []).some(([x, y]) => da < y && a > x);

  const libero = (r, da, a) => !(occupato.get(chiave(r)) || []).some(([x, y]) => da < y && a > x);
  const contesto = (r, da, a) => contestoDi(r.testo, da, a);

  // L'iscrizione di SMOCO all'Albo (decisione dell'utente del 13/10/2026): le sue
  // date non diventano mai un punto, nemmeno l'anno del contratto («16/05/2026»
  // in un contratto del 2026), e quella della categoria 8 si corregge da se' nel
  // modello e nel contratto (correggiAlboSmoco). Qui si dice.
  const alboSmoco = alboSmocoNelleRighe(righe);
  for (const o of alboSmoco) {
    const k = `${o.parte}|${o.riga}`;
    if (!occupato.has(k)) occupato.set(k, []);
    occupato.get(k).push([o.da, o.a]);
  }
  const giorno = (iso) => scriviData(iso);
  const daCorreggere = alboSmoco.filter(o => o.correggi);
  if (daCorreggere.length) {
    avvisi.push(`La data dell'iscrizione di SMOCO all'Albo (cat. ${ALBO_SMOCO.categoria} ${ALBO_SMOCO.numero}) nel format è ${[...new Set(daCorreggere.map(o => `«${o.testo}»`))].join(', ')}: quella in vigore è del ${giorno(ALBO_SMOCO.data)}, valida fino al ${giorno(ALBO_SMOCO.scadenza)}. Nel modello e nei contratti generati la scrivo così; gli altri dati di SMOCO restano come nel format.`);
  }
  const senzaCategoria = alboSmoco.filter(o => !o.categoria && o.data !== ALBO_SMOCO.data);
  if (senzaCategoria.length) {
    avvisi.push(`Nel format c'è il numero dell'Albo di SMOCO (${ALBO_SMOCO.numero}) con la data ${[...new Set(senzaCategoria.map(o => `«${o.testo}»`))].join(', ')}, ma la riga non dice la categoria: non so se è l'iscrizione in categoria ${ALBO_SMOCO.categoria} (del ${giorno(ALBO_SMOCO.data)}) e la lascio com'è. Controllala nel Word.`);
  }
  if (alboSmoco.some(o => o.categoria === ALBO_SMOCO.categoria) && alboSmocoScaduto(oggi)) {
    avvisi.push(`L'iscrizione di SMOCO all'Albo del ${giorno(ALBO_SMOCO.data)} valeva fino al ${giorno(ALBO_SMOCO.scadenza)}: la data del rinnovo va aggiornata nel gestionale prima di generare i contratti.`);
  }
  const punto = (segnaposto, extra = {}) => {
    if (!punti.has(segnaposto)) {
      const p = puntoDi(segnaposto);
      punti.set(segnaposto, { segnaposto, nome: p.nome, categoria: p.categoria, tipo: p.tipo, originale: '', stile: null, attivo: true, occorrenze: [], ...extra });
    }
    return punti.get(segnaposto);
  };
  // Un'occorrenza: torna true se e' attiva. Una che cade su un dato di SMOCO si
  // mostra spenta, col motivo, e non diventa mai segnaposto.
  const occorrenza = (segnaposto, r, da, a, { attiva = true, motivo = '', dubbia = false, extra = {} } = {}) => {
    if (a <= da || /[\t\n]/.test(r.testo.slice(da, a))) return false;
    if (attiva && inSmoco(r, da, a)) { attiva = false; motivo = 'è un dato di SMOCO: non si tocca'; }
    if (attiva && !libero(r, da, a)) return false;
    const p = punto(segnaposto, extra);
    if (!p.originale && attiva) p.originale = r.testo.slice(da, a);
    p.occorrenze.push({ parte: r.parte, riga: r.indice, da, a, testo: r.testo.slice(da, a), contesto: contesto(r, da, a), attiva, motivo, ...(dubbia ? { dubbia: true } : {}) });
    if (attiva) {
      const k = chiave(r);
      if (!occupato.has(k)) occupato.set(k, []);
      occupato.get(k).push([da, a]);
    }
    return attiva;
  };
  // Un pezzo di un dato del fornitore rimasto fuori: si mostra spento e il
  // punto diventa «da controllare». Mai sopra un punto gia' preso o un dato di SMOCO.
  const residuo = (segnaposto, r, da, a, motivo, extra = {}) => {
    if (a <= da || !libero(r, da, a) || inSmoco(r, da, a)) return;
    const p = punti.get(segnaposto);
    if (p && p.occorrenze.some(o => o.parte === r.parte && o.riga === r.indice && o.da < a && o.a > da)) return;
    occorrenza(segnaposto, r, da, a, { attiva: false, motivo, dubbia: true, extra });
  };
  // Tutte le volte che un testo esatto compare, in tutto il documento.
  const ovunque = (segnaposto, valore, filtro = null, opzioni = {}) => {
    const v = String(valore || '');
    if (v.trim().length < 2) return 0;
    let n = 0;
    for (const r of righe) {
      let i = r.testo.indexOf(v);
      while (i >= 0) {
        if (!filtro || filtro(r, i, i + v.length)) if (occorrenza(segnaposto, r, i, i + v.length, opzioni)) n++;
        i = r.testo.indexOf(v, i + v.length);
      }
    }
    return n;
  };
  const conRegex = (segnaposto, re, filtro = null, opzioni = {}) => {
    let n = 0;
    for (const r of righe) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(r.testo)) !== null) {
        if (!m[0]) { re.lastIndex++; continue; }
        if (!filtro || filtro(r, m.index, m.index + m[0].length)) if (occorrenza(segnaposto, r, m.index, m.index + m[0].length, opzioni)) n++;
      }
    }
    return n;
  };
  const nelBlocco = (segnaposto, da, lunghezza) => {
    const p = blocco && blocco.posizione(da, lunghezza);
    return p ? occorrenza(segnaposto, p.r, p.da, p.da + lunghezza) : false;
  };
  const soloQui = (segnaposto, valore) => { const i = blocco.testo.indexOf(valore); if (i >= 0) nelBlocco(segnaposto, i, valore.length); };
  // Un dato che si ripete con valori diversi (due telefoni, due email): il
  // secondo ha il suo segnaposto (FORNITORE_TEL_2), non prende il valore del primo.
  const visti = new Map(); // segnaposto -> [valori]
  const numerato = (base, valore) => {
    const v = visti.get(base) || [];
    let i = v.indexOf(valore);
    if (i < 0) { v.push(valore); i = v.length - 1; }
    visti.set(base, v);
    return i === 0 ? base : `${base}_${i + 1}`;
  };
  // Nome e categoria dei punti del fornitore che il lettore crea da se' (il
  // referente, i numeri, la data, la provincia e la classe dell'iscrizione): fra
  // i dati del fornitore, non fra gli «altri». Dall'ultimo giro della revisione
  // del 13/10/2026 sono tutti anche nel catalogo, con lo stesso nome
  // (prove/modelliContratto.mjs lo controlla): qui restano per un punto nuovo
  // che il catalogo non ha ancora.
  const libera = (base, nome, segnaposto) => {
    const n = segnaposto.match(/_(\d+)$/);
    return { nome: n && segnaposto !== base ? `${nome} (${n[1]}°)` : nome, categoria: 'fornitore', tipo: 'testo' };
  };

  // 0. I segnaposto gia' scritti nel format si tengono come sono.
  for (const r of righe) {
    for (const m of r.testo.matchAll(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g)) {
      const p = punto(m[1], { gia_segnaposto: true });
      p.gia_segnaposto = true;
      p.occorrenze.push({ parte: r.parte, riga: r.indice, da: m.index, a: m.index + m[0].length, testo: m[0], contesto: contesto(r, m.index, m.index + m[0].length), attiva: false, motivo: 'è già un segnaposto' });
    }
  }

  // 1. I dati del fornitore: dal suo paragrafo, e ovunque si ripetano (firme,
  //    comunicazioni, privacy, intestazioni).
  let fornitore = null;
  if (!blocco) avvisi.push('Non trovo il paragrafo con i dati del fornitore («… (di seguito il "FORNITORE")»): i suoi dati vanno indicati a mano, con «Aggiungi un punto».');
  else {
    const vuoto = (v) => VUOTO.test(v);
    const ragione = dati.ragione;
    if (ragione && vuoto(ragione)) soloQui('FORNITORE_RAGIONE_SOCIALE', ragione);
    else if (ragione) {
      fornitore = { ragione_sociale: ragione };
      const nucleo = nucleoDelNome(ragione);
      const primaParola = nucleo.split(/\s+/)[0];
      const confine = (r, da, a) => bordato(r.testo, da, a) && !/^\.[a-z]/.test(r.testo.slice(a, a + 2)) && prima(r.testo, da) !== '.';
      // Il punto finale di una sigla («R.P.N. S.R.L.», «M.G.M. S.r.l.»): il nucleo
      // lo perde, e fra il nucleo e la forma societaria si salta. Fino all'ultimo
      // giro della revisione del 13/10/2026 il nome preso era «R.P.N», la coda
      // «. S.R.L.» restava nel documento e il contratto nuovo diceva «ALTRO
      // FORNITORE S.R.L.. S.R.L.».
      if (primaParola === nucleo) {
        // Un nome di una parola sola («LOGISTICA», «GATIM») senza distinguere le
        // maiuscole vale solo con la forma societaria; da solo, solo scritto
        // com'e' nel paragrafo del fornitore. «Responsabile della Logistica» e'
        // un reparto di SMOCO, non il fornitore (revisione del 13/10/2026).
        conRegex('FORNITORE_RAGIONE_SOCIALE', new RegExp(`${escapeRe(nucleo)}\\.?\\s*,?\\s*${FORME}\\.?`, 'giu'), confine);
        conRegex('FORNITORE_RAGIONE_SOCIALE', new RegExp(escapeRe(nucleo), 'gu'), confine);
      } else {
        conRegex('FORNITORE_RAGIONE_SOCIALE', new RegExp(`${escapeRe(nucleo)}(?:\\.?\\s*,?\\s*${FORME}\\.?)?`, 'giu'), confine);
        // «T-CYCLE S.R.L.» nel blocco delle firme per «T-Cycle Industries srl»: la
        // prima parola del nome vale solo se ha dietro la forma societaria.
        if (primaParola.length >= 4) conRegex('FORNITORE_RAGIONE_SOCIALE', new RegExp(`${escapeRe(primaParola)}\\s*,?\\s*${FORME}\\.?`, 'giu'), confine);
      }
    }
    if (dati.sede) {
      if (dati.sede.vuota) nelBlocco('FORNITORE_SEDE_LEGALE', dati.sede.da, dati.sede.testo.length);
      else {
        ovunque('FORNITORE_SEDE_LEGALE', dati.sede.testo);
        if (fornitore) fornitore.sede = dati.sede.testo;
      }
    }
    if (dati.operativa) ovunque('FORNITORE_SEDE_OPERATIVA', dati.operativa);
    if (dati.piva) {
      if (/^_+$/.test(dati.piva)) soloQui('FORNITORE_PIVA', dati.piva);
      else {
        ovunque('FORNITORE_PIVA', dati.piva, (r, da, a) => !/\d/.test(prima(r.testo, da)) && !/\d/.test(dopo(r.testo, a)));
        if (fornitore) fornitore.piva = dati.piva;
      }
    }
    if (dati.cf) ovunque('FORNITORE_CF', dati.cf, (r, da, a) => !/\d/.test(prima(r.testo, da)) && !/\d/.test(dopo(r.testo, a)));
    // La camera di commercio ovunque sia scritta come registro delle imprese,
    // come la sede: prima si cambiava solo nel paragrafo del fornitore, e in
    // sette contratti del 2026 restava quella vecchia nelle comunicazioni,
    // accanto alla partita IVA nuova (revisione del 13/10/2026). «di Taranto»
    // nella «Camera Arbitrale di Taranto» o nella riga di SMOCO non si tocca.
    if (dati.cciaa) ovunque('FORNITORE_CCIAA', dati.cciaa, (r, da) => DOPO_REGISTRO.test(r.testo.slice(Math.max(0, da - 80), da)));
    if (dati.rea) ovunque('FORNITORE_REA', dati.rea);
    const rapp = dati.rappresentante;
    if (rapp && rapp.vuoto) nelBlocco('FORNITORE_RAPPRESENTANTE', rapp.da, rapp.testo.length);
    else if (rapp) {
      const re = regexPersona(rapp.testo);
      if (re) conRegex('FORNITORE_RAPPRESENTANTE', re, (r, da, a) => bordato(r.testo, da, a));
      if (fornitore) fornitore.rappresentante = rapp.testo;
      const p = punti.get('FORNITORE_RAPPRESENTANTE');
      if (p && dati.dubbi.length) p.dubbi = [...dati.dubbi];
      if (p && dati.titolo) p.nota = `Nel format il nome ha davanti «${dati.titolo}»: titoli e articoli intorno al nome restano quelli del format, e se cambiano col rappresentante nuovo vanno corretti nel Word.`;
      if (!p) avvisi.push(`Il rappresentante «${rapp.testo}» non si ritrova nel documento: va indicato a mano, con «Aggiungi un punto».`);
    } else if (fornitore) avvisi.push('Nel paragrafo del fornitore non trovo il legale rappresentante: se c\'è, aggiungilo con «Aggiungi un punto».');
    // La carica: nel paragrafo del fornitore, davanti al suo nome dovunque
    // («all'attenzione dell'Amministratore Unico Sig. Raffaele Landi») e sotto
    // o sopra la sua firma. Solo la SUA: quella di SMOCO («Amministratore
    // Delegato») puo' essere nella colonna accanto, e non si tocca. Si guarda
    // la colonna (i pezzi fra le tabulazioni) della riga in cui c'e' il nome.
    if (dati.qualifica) nelBlocco('FORNITORE_QUALIFICA', dati.qualifica.da, dati.qualifica.testo.length);
    const nomi = (punti.get('FORNITORE_RAPPRESENTANTE')?.occorrenze || []).filter(o => o.attiva);
    const caricaPrima = new RegExp(`(${CARICA})\\s+(?:(?:il|la|lo)\\s+)?(?:${TITOLO}\\s*)?$`, 'iu');
    // E subito dopo il nome: «Guido Costanzo Amministratore Unico» sotto la
    // firma, «da Guido Costanzo in qualità di Legale Rappresentante» nelle
    // comunicazioni (T-Cycle 2026). Restavano nel contratto nuovo accanto al
    // nome del rappresentante nuovo (revisione del 13/10/2026). Attaccata al
    // nome, al piu' tre spazi o una virgola: piu' in la' puo' essere la colonna
    // dell'altra parte, fatta con gli spazi.
    const caricaDopo = new RegExp(`^(?:[ \\u00a0]{1,3}(?:[-–,][ \\u00a0]*)?|,[ \\u00a0]*|\\s+in\\s+qualit[àa]\\s+di\\s+)(${CARICA})(?![\\p{L}])`, 'iu');
    for (const o of nomi) {
      const k = posto.get(`${o.parte}|${o.riga}`);
      const rr = righe[k];
      const m = rr.testo.slice(0, o.da).match(caricaPrima);
      if (m) occorrenza('FORNITORE_QUALIFICA', rr, m.index, m.index + m[1].length);
      const md = rr.testo.slice(o.a).match(caricaDopo);
      if (md) {
        const da = o.a + md[0].length - md[1].length;
        occorrenza('FORNITORE_QUALIFICA', rr, da, da + md[1].length);
      }
      const colonne = segmenti(rr.testo);
      const sua = colonne.findIndex(c => o.da >= c.da && o.a <= c.a);
      // Sotto il nome (fino a tre righe) o subito sopra: «Amministratrice Unica» /
      // «Rosa RINALDO» nei contratti di trasporto.
      for (const d of [-1, 1, 2, 3]) {
        const r = righe[k + d];
        if (!r || r.parte !== rr.parte) continue;
        const segs = segmenti(r.testo);
        segs.forEach((seg, colonna) => {
          if (colonne.length > 1 && segs.length > 1 && colonna !== sua) return;
          const c = seg.s.replace(/^[\s_]+|[\s_]+$/g, '');
          if (!c || !SOLO_CARICA.test(c)) return;
          const da = seg.da + seg.s.indexOf(c);
          occorrenza('FORNITORE_QUALIFICA', r, da, da + c.length);
        });
      }
    }
  }

  // 2. I recapiti del fornitore: email, telefoni e referenti, nelle righe che
  //    sono sue (il suo paragrafo, «quanto al FORNITORE», «per il Vettore:», una
  //    riga col suo nome e un recapito). Mai in una riga di SMOCO: il telefono del
  //    responsabile della logistica di SMOCO diventava quello del fornitore.
  //    Tutti i telefoni (anche il cellulare) e tutte le email, ognuno col suo
  //    segnaposto (revisione del 13/10/2026).
  //    Una riga col nome del fornitore che parla anche di SMOCO («il referente
  //    SMOCO per i ritiri presso GATIM e' il sig. …, Tel. …») non e' sua: i
  //    numeri che ha si mostrano spenti, da controllare. E in una riga sua un
  //    recapito scritto dopo SMOCO («…; per conoscenza al referente SMOCO, Tel.
  //    099…», un indirizzo @smoco) e' di SMOCO: non si prende.
  const conNome = new Set((punti.get('FORNITORE_RAGIONE_SOCIALE')?.occorrenze || []).filter(o => o.attiva).map(o => `${o.parte}|${o.riga}`));
  const RECAPITO = /e-?mail|\bpec\b|\btel\b|telefono|\bcell/i;
  const parlaDiSmoco = (t) => /\bSMOCO\b|\bCommittente\b/i.test(t);
  const righeFornitore = righe.filter(r => !rigaDiSmoco(r.testo) && ((blocco && blocco.righe.includes(r)) || RIGA_COMUNICAZIONI.test(r.testo)
    || RIGA_REFERENTE.test(r.testo) || (conNome.has(chiave(r)) && RECAPITO.test(r.testo) && !parlaDiSmoco(r.testo))));
  const righeMiste = righe.filter(r => !rigaDiSmoco(r.testo) && !righeFornitore.includes(r) && conNome.has(chiave(r)) && RECAPITO.test(r.testo));
  const nomeNellaRiga = (r) => (punti.get('FORNITORE_RAGIONE_SOCIALE')?.occorrenze || []).filter(o => o.attiva && o.parte === r.parte && o.riga === r.indice).map(o => o.da);
  const ultima = (t, re) => { let k = -1; for (const m of t.matchAll(re)) k = m.index; return k; };
  const diSmocoQui = (r, i) => {
    if (inSmoco(r, i, i + 1)) return true;
    const davanti = r.testo.slice(0, i);
    const s = ultima(davanti, /\bSMOCO\b|\bCommittente\b/gi);
    const f = Math.max(ultima(davanti, /\b(?:FORNITORE|Vettore|OPERATORE|SUBFORNITORE|APPALTATORE)\b/gi), ...nomeNellaRiga(r).filter(d => d < i));
    return s > f;
  };
  const TELEFONO = /(?:Tel\.?(?:\s*\/\s*Fax)?|Telefono|Cell(?:ulare|\.)?|Fax|Mob(?:ile|\.)?)\s*[:.]?\s*(\+?\d[\d\s/.-]{5,}\d)/gi;
  const referenti = [];
  for (const r of righeFornitore) {
    for (const m of r.testo.matchAll(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g)) {
      if (/@(?:pec\.)?(?:smoco|ecotyre|pneumaticifuoriuso)\./i.test(m[0]) || diSmocoQui(r, m.index)) continue;
      ovunque(numerato('FORNITORE_EMAIL', m[0]), m[0]);
    }
    for (const m of r.testo.matchAll(TELEFONO)) if (!diSmocoQui(r, m.index)) ovunque(numerato('FORNITORE_TEL', m[1].trim()), m[1].trim());
    // Il referente: «per il Vettore: sig. Alberto Pingaro», o la persona
    // «all'attenzione» nelle comunicazioni, quando non e' il rappresentante.
    const candidati = [];
    const ref = r.testo.match(RIGA_REFERENTE);
    if (ref) candidati.push(r.testo.slice(ref.index + ref[0].length));
    const att = r.testo.search(/all['’]\s*attenzione\s/i);
    if (att >= 0 && RIGA_COMUNICAZIONI.test(r.testo) && !diSmocoQui(r, att)) candidati.push(r.testo.slice(att).replace(/^all['’]\s*attenzione\s+/i, ''));
    for (const c of candidati) {
      const resto = c.replace(new RegExp(`^\\s*(?:(?:del(?:la|lo|l['’])?|di)\\s*)?(?:${CARICA}\\s+)?(?:${TITOLO}\\s*)?`, 'iu'), '');
      const m = resto.match(NOME_PERSONA);
      if (!m || stessaPersona(m[0], rappresentante) || referenti.some(x => stessaPersona(x.nome, m[0]))) continue;
      const segnaposto = numerato('FORNITORE_REFERENTE', m[0]);
      referenti.push({ nome: m[0], segnaposto });
      conRegex(segnaposto, regexPersona(m[0]), (rr, da, a) => bordato(rr.testo, da, a), { extra: libera('FORNITORE_REFERENTE', 'Referente del fornitore', segnaposto) });
    }
  }

  // 3. Le date di validita'.
  // «produce i suoi effetti 2 Gennaio 2026», senza «dal», nel trattamento di T-Cycle.
  const reInizio = new RegExp(`\\b(?:dal|dall['’]|a\\s+decorrere\\s+dal|con\\s+decorrenza\\s+dal|a\\s+partire\\s+dal|effetti)\\s+${DATA}`, 'gi');
  const reFine = new RegExp(`\\b(?:sino|fino)\\s+al\\s+${DATA}|\\bal\\s+${DATA}`, 'gi');
  let annoFormat = null;
  for (const r of righe) {
    if (!/(efficac|effett|vigore|durata|valid[ao]|decorr|scadenza\s+del\s+contratto)/i.test(r.testo)) continue;
    if (/fattur|conferimenti\s+dal|ritiri\s+avvenuti/i.test(r.testo)) continue;
    reInizio.lastIndex = 0;
    const mi = reInizio.exec(r.testo);
    if (!mi) continue;
    const di = mi.index + mi[0].length - mi[1].length;
    if (occorrenza('DATA_INIZIO', r, di, di + mi[1].length)) {
      const p = punto('DATA_INIZIO');
      if (!p.stile) p.stile = stileDellaData(mi[1]);
      annoFormat = annoFormat || Number(leggiData(mi[1]).slice(0, 4)) || null;
    }
    reFine.lastIndex = di + mi[1].length;
    const mf = reFine.exec(r.testo);
    if (mf) {
      const data = mf[1] || mf[2];
      const df = mf.index + mf[0].length - data.length;
      if (occorrenza('DATA_FINE', r, df, df + data.length)) {
        const p = punto('DATA_FINE');
        if (!p.stile) p.stile = stileDellaData(data);
      }
    }
  }

  // 4. La data della firma: «Massafra, 02 Gennaio 2026», «Massafra lì, 02 Marzo 2026»,
  //    «sottoscritto tra le Parti il 02/01/2026».
  const reFirma = new RegExp(`^\\s*[A-ZÀ-Ü][\\p{L}'’]+(?:\\s+[A-ZÀ-Ü][\\p{L}'’]+)?\\s*(?:l[ìi]\\s*)?,?\\s*(?:l[ìi]\\s*,?\\s*)?${DATA}\\s*\\.?\\s*$`, 'iu');
  const reSottoscritto = new RegExp(`(?:sottoscritt[oa]|firmat[oa])[^.]{0,60}?\\bil\\s+${DATA}`, 'i');
  for (const r of righe) {
    const m = r.testo.match(reFirma) || r.testo.match(reSottoscritto);
    if (!m) continue;
    const data = m[1];
    const d = m.index + m[0].lastIndexOf(data);
    if (occorrenza('DATA_FIRMA', r, d, d + data.length)) {
      const p = punto('DATA_FIRMA');
      if (!p.stile) p.stile = stileDellaData(data);
      annoFormat = annoFormat || Number(leggiData(data).slice(0, 4)) || null;
    }
  }

  // 5. La quantita' annua: «pari a circa 300 ton/anno», e la stessa cifra
  //    ripetuta poco sotto («FRANTUMAZIONE (circa 1050 t)»). Non «non inferiori a
  //    100 t/anno», che e' una regola del disciplinare ACI.
  const segnaQuantita = tipo === 'raccolta' ? 'TARGET_TON' : 'QUOTA_TON';
  const reQuantita = new RegExp(`(${CIFRE})\\s*(?:ton(?:nellate)?\\.?|t)\\s*\\/\\s*anno|(${CIFRE})\\s*tonnellate\\s+annue`, 'gi');
  const quantitaTrovate = new Set();
  for (const r of righe) {
    if (!/(target|quota|quantit|previst|assegnat|indicativ)/i.test(r.testo) || /non\s+inferior/i.test(r.testo)) continue;
    reQuantita.lastIndex = 0;
    let m;
    while ((m = reQuantita.exec(r.testo)) !== null) {
      const n = m[1] || m[2];
      if (occorrenza(segnaQuantita, r, m.index, m.index + n.length)) quantitaTrovate.add(n);
    }
  }
  if (quantitaTrovate.size) {
    const reCirca = new RegExp(`\\bcirca\\s+(${CIFRE})\\s*(?:ton(?:nellate)?|t)\\b(?!\\s*\\/)`, 'gi');
    for (const r of righe) {
      for (const m of r.testo.matchAll(reCirca)) {
        if (!quantitaTrovate.has(m[1])) continue;
        const d = m.index + m[0].indexOf(m[1], 5);
        occorrenza(segnaQuantita, r, d, d + m[1].length);
      }
    }
  }
  righe.forEach((r, i) => {
    if (!/target[^()]*\(\s*ton\s*\)/i.test(r.testo)) return;
    for (let j = i + 1; j <= i + 4 && j < righe.length; j++) {
      const m = righe[j].testo.match(new RegExp(`^\\s*(${CIFRE})\\s*(?:t|ton)?\\s*$`, 'i'));
      if (m) { const d = righe[j].testo.indexOf(m[1]); occorrenza(segnaQuantita, righe[j], d, d + m[1].length); break; }
    }
  });

  // 6. I prezzi, nell'allegato delle condizioni economiche: dopo il titolo
  //    «Allegato N» seguito da «CORRISPETTIVI» o «CONDIZIONI ECONOMICHE», fino
  //    all'allegato dopo. Le penali e le sanzioni no: sono del modello.
  const inizioEconomico = (() => {
    for (let i = righe.length - 1; i >= 0; i--) {
      const t = righe[i].testo;
      const titolo = /^\s*allegato\s*\d*\s*$/i.test(t) && righe.slice(i + 1, i + 3).some(x => /corrispettiv|condizioni\s+economiche/i.test(x.testo));
      const unaRiga = /^\s*(?:allegato\s*\d+\s*[-–:]?\s*)?(?:condizioni\s+economiche|corrispettivi\s+e\s+modalit)/i.test(t);
      if (titolo || unaRiga) return i;
    }
    return -1;
  })();
  const fineEconomico = (() => {
    if (inizioEconomico < 0) return -1;
    for (let i = inizioEconomico + 2; i < righe.length; i++) if (/^\s*allegato\s*\d+\s*$/i.test(righe[i].testo) && righe[i].parte === righe[inizioEconomico].parte) return i;
    return righe.length;
  })();
  if (inizioEconomico < 0) avvisi.push('Non trovo l\'allegato delle condizioni economiche: i prezzi vanno indicati a mano, con «Aggiungi un punto».');
  else {
    const NO = /(giorn|penal|sanzion|polizz|massimal|responsabilit|soglia|addebit|minim|fattur)/i;
    const ETICHETTA_NO = /^(?:\s*|attivit[àa]|corrispettivo|euro\s*\/\s*ton|\(iva esclusa\)|\(prezzi iva esclusa\)|prezzo.*|servizio|tipologia.*|incluso|v\.\s*all.*|.*\(\s*ton\s*\))$/i;
    const usati = new Map();
    const nomePrezzo = (etichetta) => {
      const e = etichetta || '';
      if (/\bG2\b/.test(e)) return 'CORRISPETTIVO_G2';
      if (/\bP\s*[-,/+]?\s*M\s*[-,/+]?\s*G1\b/.test(e)) return 'CORRISPETTIVO_PMG1';
      if (/\bG1\b/.test(e)) return 'CORRISPETTIVO_G1';
      if (/stoccagg|messa\s+in\s+riserva/i.test(e)) return 'CORRISPETTIVO_STOCCAGGIO';
      if (/trattament|granulaz|frantumaz|recuper/i.test(e)) return tipo === 'raccolta' ? 'CORRISPETTIVO_RACCOLTA' : 'CORRISPETTIVO_TRATTAMENTO';
      if (/raccolt|ritir/i.test(e)) return 'CORRISPETTIVO_RACCOLTA';
      if (/trasport/i.test(e)) return tipo === 'trasporto_secondaria' ? 'CORRISPETTIVO_TRASPORTO' : 'CORRISPETTIVO_RACCOLTA';
      return ({ raccolta: 'CORRISPETTIVO_RACCOLTA', stoccaggio: 'CORRISPETTIVO_STOCCAGGIO', trattamento: 'CORRISPETTIVO_TRATTAMENTO', trasporto_secondaria: 'CORRISPETTIVO_TRASPORTO' })[tipo] || 'CORRISPETTIVO_RACCOLTA';
    };
    // «70,00 €», «€ 105,00 + IVA», «25 €»; una cella con solo «70,00» sotto l'intestazione «Euro/Ton».
    const reEuro = new RegExp(`€\\s*(${CIFRE})|(${CIFRE})\\s*(?:€|euro\\b)`, 'gi');
    const reCella = new RegExp(`^\\s*(\\d+(?:\\.\\d{3})*,\\d{2})\\s*$`);
    const prezziDi = (i) => {
      const r = righe[i];
      if (NO.test(r.testo)) return [];
      const trovati = [];
      reEuro.lastIndex = 0;
      let m;
      while ((m = reEuro.exec(r.testo)) !== null) {
        const n = m[1] || m[2];
        trovati.push({ da: m.index + m[0].indexOf(n), n });
      }
      if (!trovati.length) {
        const c = r.testo.match(reCella);
        const sottoIntestazione = righe.slice(Math.max(inizioEconomico, i - 8), i).some(x => /(euro|€)\s*\/\s*t/i.test(x.testo));
        if (c && sottoIntestazione) trovati.push({ da: r.testo.indexOf(c[1]), n: c[1] });
      }
      return trovati;
    };
    // Una tabella scritta per colonne: prima le etichette una sotto l'altra
    // («Frantumazione (P+M+G1)», «Frantumazione (G2)»), poi i prezzi nello
    // stesso ordine. La prima etichetta va col primo prezzo, non con l'ultima
    // riga letta (il trattamento di T-Cycle usciva con G2 a 70,00).
    const conPrezzo = new Set();
    for (let i = inizioEconomico; i < fineEconomico; i++) if (prezziDi(i).length && !righe[i].testo.replace(/[\d.,€\s+IVAiva]/g, '').trim()) conPrezzo.add(i);
    const etichettaDi = (i, testoPrima) => {
      if (testoPrima) return testoPrima;
      let s = i;
      while (s - 1 >= inizioEconomico && conPrezzo.has(s - 1)) s--;
      const posto = i - s;
      const etichette = [];
      for (let j = s - 1; j >= Math.max(inizioEconomico, s - 8) && etichette.length < 8; j--) {
        const t = righe[j].testo.trim();
        if (!t || reCella.test(t)) continue;
        if (ETICHETTA_NO.test(t)) { if (etichette.length) break; continue; }
        etichette.unshift(t);
      }
      let e = s;
      while (conPrezzo.has(e)) e++;
      const quanti = e - s;
      if (etichette.length >= quanti && quanti > 1) return etichette[etichette.length - quanti + posto] || '';
      return etichette[etichette.length - 1] || '';
    };
    const nomeDellaRiga = new Map(); // testo di una riga -> nome, per la copia di riserva
    // Prima i prezzi nel testo, poi quelli nelle caselle disegnate sopra: il
    // prezzo della tabella e' quello che conta e prende il nome principale; la
    // casella resta un punto a parte, spento, da guardare.
    const ordineRighe = [];
    for (let i = inizioEconomico; i < fineEconomico; i++) if (!righe[i].casella) ordineRighe.push(i);
    for (let i = inizioEconomico; i < fineEconomico; i++) if (righe[i].casella) ordineRighe.push(i);
    for (const i of ordineRighe) {
      const r = righe[i];
      for (const { da, n } of prezziDi(i)) {
        const etichetta = etichettaDi(i, r.testo.slice(0, da).replace(/[€\s]+$/, '').trim());
        let nome = nomePrezzo(etichetta);
        // La copia di riserva di una casella di testo (mc:Fallback) e' lo stesso
        // prezzo della casella: stesso segnaposto, non un secondo prezzo.
        if (r.riserva && nomeDellaRiga.has(`${r.testo}|${da}`)) nome = nomeDellaRiga.get(`${r.testo}|${da}`);
        else {
          const volte = (usati.get(nome) || 0) + 1;
          usati.set(nome, volte);
          if (volte > 1) nome = `${nome}_${volte}`;
          nomeDellaRiga.set(`${r.testo}|${da}`, nome);
        }
        if (occorrenza(nome, r, da, da + n.length, { extra: { etichetta } })) {
          const p = punto(nome);
          p.etichetta = p.etichetta || etichetta;
          if (r.casella && !p.nota) { p.nota = 'Questo prezzo sta in una casella di testo disegnata sopra il documento: spesso è un valore vecchio corretto a mano. Resta com\'è, a meno che tu non lo accenda.'; p.in_casella = true; }
        }
      }
    }
  }

  // 7. Le condizioni di pagamento e la polizza.
  const rePagamento = /(?:saranno|verranno|sar[àa])\s+pagat[ie]\s+(?:a\s+|entro\s+)(.+?)(?:\s+mediante\s+(.+?))?\s*\.?\s*$/i;
  for (const r of righe) {
    const m = r.testo.match(rePagamento);
    if (!m || /Fondo/.test(r.testo)) continue;
    const d1 = r.testo.indexOf(m[1], m.index);
    occorrenza('PAGAMENTO', r, d1, d1 + m[1].length);
    if (m[2]) { const d2 = r.testo.indexOf(m[2], d1 + m[1].length); occorrenza('MODALITA_PAGAMENTO', r, d2, d2 + m[2].length); }
  }
  const rePolizza = new RegExp(`responsabilit[àa]\\s+civile\\s+pari\\s+ad?\\s+(?:almeno\\s+)?(${CIFRE}\\s*(?:Euro|€)(?:\\s*\\([^)]*\\))?)`, 'i');
  for (const r of righe) {
    const m = r.testo.match(rePolizza);
    if (!m) continue;
    const d = r.testo.indexOf(m[1], m.index);
    occorrenza('POLIZZA_RC', r, d, d + m[1].length);
  }

  // 8. L'anno, dove e' l'anno del contratto: «per l'anno 2026», «CONDIZIONI
  //    ECONOMICHE 2026», «mese di gennaio 2026», «dal 01.01.2026 al 31.01.2026»,
  //    «Rete PFU Demolitori ACI - 2026», «mese di ________2026». Non le date di
  //    altri atti («Albo ... del 16/05/2026», un decreto): quelle si mostrano spente.
  //    L'anno si cerca fra due «non cifre», non fra due confini di parola: fra un
  //    trattino basso e una cifra il confine non c'e', e «________2026» del modulo
  //    della dichiarazione mensile restava nei contratti del 2027 (revisione del
  //    13/10/2026).
  if (!annoFormat) {
    const conti = new Map();
    for (const r of righe) for (const m of r.testo.matchAll(/(?<!\d)(20\d{2})(?!\d)/g)) conti.set(m[1], (conti.get(m[1]) || 0) + 1);
    const piu = [...conti.entries()].sort((a, b) => b[1] - a[1])[0];
    annoFormat = piu ? Number(piu[0]) : null;
  }
  if (annoFormat) {
    const Y = String(annoFormat);
    const reMese = new RegExp(`(?:${MESI_RE})\\s+$`, 'i');
    for (const r of righe) {
      for (const m of r.testo.matchAll(new RegExp(`(?<!\\d)${Y}(?!\\d)`, 'g'))) {
        const da = m.index;
        const a = da + Y.length;
        if (!libero(r, da, a)) continue;
        const prima30 = r.testo.slice(Math.max(0, da - 30), da);
        // «dal 01.01.2026», e anche «dal XX/XX/2026» nei moduli da compilare.
        const numerica = prima30.match(/(\b(?:dal|al|del|l['’]|il)\s+)?[\dX]{1,2}[./-][\dX]{1,2}[./-]$/i);
        // «… mese di (mese di competenza)» a fine riga e «2026”» a capo.
        const aCapo = da === 0 && /^[”"»]/.test(r.testo.slice(a));
        let attiva = false;
        let motivo = '';
        let dubbia = false;
        if (numerica) {
          attiva = !numerica[1] || !/^del\s/i.test(numerica[1]);
          if (!attiva) motivo = 'è la data di un altro atto';
        } else if (aCapo || /(?:\banno|economiche|annualit[àa])\s*$/i.test(prima30) || reMese.test(prima30) || /\(\s*[^)]*mese[^)]*\)\s*$/i.test(prima30)
          || /target\s+smoco\s+$/i.test(prima30) || (/[-–]\s*$/.test(prima30) && !r.testo.slice(a).trim()) || /_{2,}\s*$/.test(prima30)) {
          attiva = true;
        } else { motivo = 'non so se è l\'anno del contratto'; dubbia = true; }
        if (/(?:d\.?\s?m\.?|decreto|legge|l\.|d\.?\s?lgs\.?|regolamento|n\.)\s*[\d/ ]*$/i.test(prima30)) { attiva = false; dubbia = false; motivo = 'è il numero o l\'anno di una norma'; }
        occorrenza('ANNO', r, da, a, { attiva, motivo, dubbia });
      }
    }
  }

  // 9. Quello che il lettore non e' sicuro di aver preso (revisione del
  //    13/10/2026): i pezzi dei dati del fornitore rimasti fuori dai punti si
  //    mostrano spenti, e il loro punto diventa «da controllare».
  if (fornitore) {
    // a. Il nome di una parola sola scritto in un altro modo e senza forma
    //    societaria: puo' essere il fornitore o una parola comune.
    const nucleo = nucleoDelNome(fornitore.ragione_sociale);
    if (!/\s/.test(nucleo) && nucleo.length >= 3) {
      for (const r of righe) {
        for (const m of r.testo.matchAll(new RegExp(escapeRe(nucleo), 'giu'))) {
          if (bordato(r.testo, m.index, m.index + m[0].length)) residuo('FORNITORE_RAGIONE_SOCIALE', r, m.index, m.index + m[0].length, 'il nome del fornitore scritto in un altro modo e senza forma societaria: può essere una parola comune, accendilo se è il fornitore');
        }
      }
    }
    // b. Un pezzo del nome del rappresentante o di un referente («Sig. Basile»).
    const persone = [...(rappresentante ? [{ nome: rappresentante, segnaposto: 'FORNITORE_RAPPRESENTANTE' }] : []), ...referenti];
    for (const { nome, segnaposto } of persone) {
      if (!punti.has(segnaposto)) continue;
      for (const w of nome.split(/\s+/)) {
        if (w.length < 3 || /^(?:del|della|dei|degli|van|von)$/i.test(w)) continue;
        for (const r of righe) {
          for (const m of r.testo.matchAll(new RegExp(escapeRe(w), 'giu'))) {
            if (bordato(r.testo, m.index, m.index + m[0].length)) residuo(segnaposto, r, m.index, m.index + m[0].length, `un pezzo del nome «${nome}»: controlla se è lui`);
          }
        }
      }
    }
    // c. Lo stesso telefono scritto in un altro modo, o un numero lungo nella
    //    riga del fornitore. Undici cifre dopo «Registro Imprese», «Partita IVA» o
    //    «Codice Fiscale» sono un numero fiscale: nel contratto ACI di Nappi Sud
    //    2026 le comunicazioni hanno ancora quello di Gatim, copiato da un altro contratto.
    const cifre = (s) => String(s).replace(/\D/g, '');
    const telefoni = (visti.get('FORNITORE_TEL') || []).map(cifre).filter(c => c.length >= 6);
    const FISCALE = /(?:Registro\s+(?:delle\s+)?Imprese[^,;]{0,60}|Partita\s+IVA|P\.\s?IVA|C\.\s?F\.|Codice\s+Fiscale)[\s:n.°]*$/i;
    for (const r of righe) {
      for (const m of r.testo.matchAll(/\+?\d[\d\s/.-]{6,}\d/g)) {
        const c = cifre(m[0]);
        if (/^\d{1,2}[/.-]\d{1,2}[/.-]\d{4}$/.test(m[0].trim()) || (fornitore.piva && c.includes(fornitore.piva))) continue;
        if (c.length === 11 && FISCALE.test(r.testo.slice(Math.max(0, m.index - 90), m.index))) {
          if (righeFornitore.includes(r)) residuo('FORNITORE_PIVA', r, m.index, m.index + m[0].length, 'una partita IVA o un codice fiscale diverso da quello del fornitore, nella sua riga: controlla');
          continue;
        }
        const uguale = telefoni.some(t => c === t || (c.length > t.length && c.endsWith(t)) || (t.length > c.length && t.endsWith(c) && c.length >= 6));
        // Nelle righe che parlano anche di SMOCO il numero puo' essere suo: si
        // mostra spento, e si accende solo se e' del fornitore (revisione del 13/10/2026).
        const misto = righeMiste.includes(r) || (righeFornitore.includes(r) && diSmocoQui(r, m.index));
        const suo = (righeFornitore.includes(r) || righeMiste.includes(r)) && c.length >= 8 && c.length <= 13;
        if (uguale || suo) {
          residuo('FORNITORE_TEL', r, m.index, m.index + m[0].length, uguale ? 'lo stesso numero di telefono scritto in un altro modo'
            : misto ? 'un numero in una riga che parla anche di SMOCO: può essere di SMOCO, accendilo solo se è del fornitore'
              : 'un numero nella riga del fornitore: se è un suo telefono accendilo');
        }
      }
    }
    // d. La camera di commercio scritta in un altro modo nelle righe del fornitore.
    for (const r of righeFornitore) {
      for (const m of r.testo.matchAll(new RegExp(CCIAA, 'giu'))) {
        const da = m.index + m[0].indexOf(m[1]);
        residuo('FORNITORE_CCIAA', r, da, da + m[1].length, 'la camera di commercio del fornitore scritta in un altro modo');
      }
    }
    // e. Un indirizzo del fornitore scritto in un altro modo dalla sede. Si
    //    cerca dove comincia un indirizzo: nelle comunicazioni dopo «quanto al
    //    FORNITORE» (e dopo il suo nome, se c'e'), dopo «presso», e dovunque dopo
    //    il nome del fornitore seguito da «con sede in» o «presso». L'indirizzo
    //    finisce con la provincia fra parentesi o, se non c'e', prima di un
    //    recapito («indirizzo pec», «Tel.», «e-mail»…), del codice fiscale o del
    //    punto e virgola. Fino alla seconda revisione del 13/10/2026 si cercava
    //    solo subito dopo «quanto al Vettore» e solo con la provincia fra
    //    parentesi: nei contratti di trasporto di Ecoservice («- quanto al
    //    Vettore ECOSERVICE S.r.l. presso Carrara (MS) indirizzo pec …») il pezzo
    //    cominciava col nome, gia' preso, e in quello di Logistica srl («…
    //    Logistica srl presso Via delle Industrie 78, indirizzo pec …») la
    //    provincia non c'era: il domicilio eletto del vettore di partenza restava
    //    nel contratto nuovo e la sede non risultava da controllare.
    //    Se l'indirizzo e' proprio la sede, e' gia' un punto acceso e qui non si tocca.
    const FERMA = "\\b(?:indirizzo|pec|e-?mail|tel|telefono|cell|cellulare|fax|partita\\s+iva|codice\\s+fiscale|rappresentat[oa]|legale\\s+rappresentante|iscrizione|iscritt[oa])\\b|\\b(?:c\\.\\s?f\\.|p\\.\\s?iva\\b)|\\ball['’]\\s*attenzione|\\(\\s*di\\s+seguito";
    const reFerma = new RegExp(`^\\s*[,;:]?\\s*(?:${FERMA})`, 'i');
    const reFermaDentro = new RegExp(FERMA, 'i');
    const reFinoFerma = new RegExp(`^(.{2,160}?)(?=\\s*[,;]?\\s*(?:${FERMA})|\\s*;|\\s*$)`, 'i');
    const reIntroduce = /^[\s,:]*(?:(?:con\s+)?sede(?:\s+legale)?(?:\s+in)?|domiciliat[oa]\s+(?:in|presso)|presso)\s+/i;
    // Le stesse parole dopo un pezzo senza cifre ne' chiocciole (la coda di un nome).
    const reDopoCoda = /^([^@\d]*?)\b(?:con\s+sede(?:\s+legale)?(?:\s+in)?|sede\s+legale(?:\s+in)?|domiciliat[oa]\s+(?:in|presso)|presso)\s+/i;
    const MOTIVO_SEDE = 'un indirizzo del fornitore scritto in un altro modo dalla sede: controlla, e se va cambiato accendilo';
    const indirizzoDa = (r, inizio) => {
      const i = inizio + r.testo.slice(inizio).match(/^\s*/)[0].length;
      const resto = r.testo.slice(i);
      if (reFerma.test(resto)) return;
      const conProv = resto.match(/^(.{3,160}?\(\s*[A-Z]{2}\s*\))/);
      const fino = resto.match(reFinoFerma);
      let s = conProv && (!fino || conProv[1].length <= fino[1].length) ? conProv[1] : fino ? fino[1] : '';
      s = s.replace(/[\s,;:]+$/, '');
      // Le linee da compilare del format vuoto («presso ________») non sono un
      // dato del fornitore di partenza; un'email non e' un indirizzo.
      if (!/[\p{L}\d]/u.test(s.replace(/_/g, '')) || /@/.test(s)) return;
      residuo('FORNITORE_SEDE_LEGALE', r, i, i + s.length, MOTIVO_SEDE);
    };
    const nomiQui = (r) => (punti.get('FORNITORE_RAGIONE_SOCIALE')?.occorrenze || []).filter(o => o.attiva && o.parte === r.parte && o.riga === r.indice);
    for (const r of righeFornitore) {
      const q = r.testo.match(RIGA_COMUNICAZIONI);
      if (!q) continue;
      let i = q.index + q[0].length;
      i += r.testo.slice(i).match(/^[\s,:]*/)[0].length;
      // Il nome subito dopo, anche con davanti «Spett.le» o simili.
      const nome = nomiQui(r).filter(o => o.da >= i && o.da <= i + 30 && !reFermaDentro.test(r.testo.slice(i, o.da))).sort((x, y) => x.da - y.da)[0];
      if (nome) i = nome.a;
      const intro = r.testo.slice(i).match(reIntroduce) || r.testo.slice(i).match(/^[\s,:]*in\s+/i) || r.testo.slice(i).match(/^[\s,:]*/);
      i += intro[0].length;
      // Un nome, o la coda di un nome, che il lettore non ha preso, prima di
      // «presso», «con sede in», «sede legale in» o «domiciliato in»: il
      // domicilio comincia dopo. Se davanti c'e' una cifra e' gia' un indirizzo
      // («Via Roma 5 presso …») e si parte da li'. Fino all'ultimo giro della
      // revisione del 13/10/2026 valeva solo «presso»: nei contratti di RPN («•
      // quanto al FORNITORE, R.P.N. S.R.L. con sede in Località Fosse Imperatore,
      // …», col nome preso «R.P.N») l'occorrenza della sede cominciava con «.
      // S.R.L. con sede in», e accesa la riga diventava «ALTRO FORNITORE
      // S.R.L.Via Dante 9, …».
      const pr = r.testo.slice(i).match(reDopoCoda);
      if (pr && !reFermaDentro.test(pr[1])) {
        // La coda subito dopo il nome preso resta nel contratto nuovo: il nome si
        // segna da controllare. Oggi il nome si prende con la forma societaria
        // (anche dopo il punto di una sigla), quindi qui non dovrebbe restare niente.
        const coda = (intro[0] + pr[1]).replace(/^[\s,;:]+|[\s,;:]+$/g, '');
        if (nome && !/\p{L}/u.test(intro[0]) && /[\p{L}\d]/u.test(coda)) {
          const p = punti.get('FORNITORE_RAGIONE_SOCIALE');
          p.dubbi = [...(p.dubbi || []), `nelle comunicazioni dopo il nome «${nome.testo}» resta «${coda}», che il lettore non ha preso: nel contratto nuovo rimane com'è, controlla e se serve correggilo a mano nel Word`];
        }
        i += pr[0].length;
      }
      indirizzoDa(r, i);
    }
    for (const r of righe) {
      for (const o of nomiQui(r)) {
        const intro = r.testo.slice(o.a).match(reIntroduce);
        if (intro) indirizzoDa(r, o.a + intro[0].length);
      }
    }
    // f. I dati d'iscrizione del fornitore nei contratti di trasporto
    //    compilati: i numeri (albo dei trasportatori, albo gestori ambientali,
    //    REN), e con loro la provincia dell'albo dei trasportatori («della
    //    Provincia di SALERNO»), la classe dell'albo gestori («categoria 4
    //    classe A») e la data o gli estremi dell'iscrizione scritti dopo il
    //    numero («n. NA00784 del 14/12/2022», «n. FI00330 (decr. Prot. … del
    //    22/11/2021, validità …)»). Fino alla seconda revisione del 13/10/2026 si
    //    segnava solo il numero, e provincia, classe e data del vettore di
    //    partenza restavano nel contratto nuovo senza avviso. Nel format vuoto
    //    del trasporto sono proprio le righe da compilare: «della Provincia di
    //    ________», «classe __ con n.______ del ______».
    const reDopoNumero = new RegExp(`^\\s*(?:del\\s+${DATA}|\\(([^()]{4,200})\\))`, 'i');
    const PROVINCIA = "[A-ZÀ-Ý][\\p{L}'’-]*(?:\\s+(?:(?:e|di|del|della|dell['’]|nell['’])\\s*)?[A-ZÀ-Ý][\\p{L}'’-]*)*";
    const reProvincia = new RegExp(`\\b[Pp]rovincia\\s+(?:di|della|del|dell['’])\\s*(${PROVINCIA})`, 'gu');
    const reClasse = /\b[Cc]lasse\s+[“"«]?([A-F])(?![\p{L}\d])/gu;
    for (const r of righe) {
      if (!/^\W*Il\s+(?:Vettore|FORNITORE|OPERATORE)\b[^.]{0,80}?\biscritt[oa]\b/i.test(r.testo)) continue;
      for (const m of r.testo.matchAll(/\bn\.\s*([A-Z]{0,3}[\s/]?\d[\w/.-]*\w)/gi)) {
        const da = m.index + m[0].indexOf(m[1]);
        const segnaposto = numerato('FORNITORE_ISCRIZIONE', m[1]);
        residuo(segnaposto, r, da, da + m[1].length, 'un numero d\'iscrizione del fornitore di partenza (albo, REN): accendilo per farne un punto da scrivere, o correggilo a mano nel Word',
          libera('FORNITORE_ISCRIZIONE', 'Numero d\'iscrizione del fornitore', segnaposto));
        const fine = da + m[1].length;
        const dn = r.testo.slice(fine).match(reDopoNumero);
        if (dn) {
          const v = dn[1] || dn[2];
          const d2 = fine + dn[0].indexOf(v);
          const s2 = numerato('FORNITORE_ISCRIZIONE_DATA', v);
          residuo(s2, r, d2, d2 + v.length, 'la data o gli estremi dell\'iscrizione del fornitore di partenza, scritti dopo il numero: accendili per farne un punto da scrivere, o correggili a mano nel Word',
            libera('FORNITORE_ISCRIZIONE_DATA', 'Data ed estremi dell\'iscrizione del fornitore', s2));
        }
      }
      for (const m of r.testo.matchAll(reProvincia)) {
        const da = m.index + m[0].length - m[1].length;
        const segnaposto = numerato('FORNITORE_ALBO_PROVINCIA', m[1]);
        residuo(segnaposto, r, da, da + m[1].length, 'la provincia dell\'albo del fornitore di partenza, che va col numero d\'iscrizione: accendila per farne un punto da scrivere, o correggila a mano nel Word',
          libera('FORNITORE_ALBO_PROVINCIA', 'Provincia dell\'albo degli autotrasportatori del fornitore', segnaposto));
      }
      for (const m of r.testo.matchAll(reClasse)) {
        const da = m.index + m[0].length - m[1].length;
        const segnaposto = numerato('FORNITORE_ALBO_CLASSE', m[1]);
        residuo(segnaposto, r, da, da + m[1].length, 'la classe d\'iscrizione all\'albo del fornitore di partenza, che va col numero d\'iscrizione: accendila per farne un punto da scrivere, o correggila a mano nel Word',
          libera('FORNITORE_ALBO_CLASSE', 'Classe d\'iscrizione del fornitore all\'albo gestori ambientali', segnaposto));
      }
    }
  }

  // Chi e' il fornitore del contratto compilato, se e' in anagrafica.
  if (fornitore && fornitori && fornitori.length) {
    const piva = fornitore.piva;
    const n = nucleoDelNome(fornitore.ragione_sociale).toLowerCase();
    const trovato = fornitori.find(f => piva && String(f.piva || '').trim() === piva)
      || fornitori.find(f => nucleoDelNome(f.ragione_sociale).toLowerCase() === n);
    if (trovato) fornitore.anagrafica = { id: trovato.id, ragione_sociale: trovato.ragione_sociale };
  }

  const ordine = (s) => { const i = PUNTI_CONTRATTO.findIndex(p => p.segnaposto === s.replace(/_\d+$/, '')); return i < 0 ? 999 : i; };
  const elenco = [...punti.values()].sort((a, b) => ordine(a.segnaposto) - ordine(b.segnaposto) || a.segnaposto.localeCompare(b.segnaposto));
  for (const p of elenco) {
    if (!p.originale && p.occorrenze.length) p.originale = p.occorrenze[0].testo;
    if (p.etichetta && p.tipo === 'prezzo') p.nome = `${p.nome}: «${p.etichetta.slice(0, 60)}»`;
    p.attivo = !p.gia_segnaposto && !p.in_casella && p.occorrenze.some(o => o.attiva);
    const motivi = [...new Set([...(p.dubbi || []), ...p.occorrenze.filter(o => o.dubbia && !o.attiva).map(o => o.motivo)])];
    p.da_controllare = motivi.length ? motivi : null;
    delete p.dubbi;
  }
  for (const p of elenco) if (p.categoria === 'fornitore' && p.occorrenze.length && !p.occorrenze.some(o => o.attiva)) p.attivo = false;
  // albo_smoco: le date dell'iscrizione di SMOCO all'Albo trovate nel format, con
  // quelle da correggere (correggi, nuovo); non sono punti (13/10/2026).
  return { punti: elenco, fornitore, anno: annoFormat, avvisi, da_controllare: elenco.filter(p => p.da_controllare).map(p => p.segnaposto), albo_smoco: alboSmoco };
}

/**
 * Le occorrenze di un testo scritto dall'amministratore: per correggere un
 * punto proposto male o aggiungerne uno. Cerca il testo esatto in tutto il documento.
 */
export function cercaNelFormat(letto, testo) {
  const v = String(testo || '');
  const out = [];
  if (v.trim().length < 2) return out;
  for (const parte of Object.keys(letto.parti)) {
    righeDi(letto.parti[parte]).forEach((r, indice) => {
      let i = r.testo.indexOf(v);
      while (i >= 0) {
        out.push({ parte, riga: indice, da: i, a: i + v.length, testo: v, contesto: `${r.testo.slice(Math.max(0, i - 40), i)}«${v}»${r.testo.slice(i + v.length, i + v.length + 40)}`, attiva: true, motivo: '' });
        i = r.testo.indexOf(v, i + v.length);
      }
    });
  }
  return out;
}

// ─── il modello: i punti diventano segnaposto ───

/**
 * Sostituisce nelle parti le occorrenze attive dei punti attivi con i loro
 * segnaposto. Un valore spezzato fra piu' pezzi di testo: il segnaposto va nel
 * primo, il resto si toglie dagli altri, e la formattazione di ciascuno resta.
 * Un'occorrenza che attraversa una tabulazione o un a capo non si tocca e si dice.
 * Un'occorrenza con con (un testo) prende quel testo invece del segnaposto: e'
 * la data dell'Albo di SMOCO corretta (correggiAlboSmoco, 13/10/2026).
 * @returns { parti, saltate: [{ segnaposto, testo, motivo }] }
 */
export function applicaPunti(parti, punti) {
  const out = { ...parti };
  const saltate = [];
  const perParte = new Map();
  for (const p of punti || []) {
    if (!p.attivo) continue;
    for (const o of p.occorrenze || []) {
      if (!o.attiva) continue;
      if (!perParte.has(o.parte)) perParte.set(o.parte, []);
      perParte.get(o.parte).push({ ...o, segnaposto: p.segnaposto });
    }
  }
  for (const [parte, occorrenze] of perParte) {
    const xml = parti[parte];
    if (xml === undefined) continue;
    const righe = righeDi(xml);
    // Le modifiche, pezzo per pezzo: { pezzo -> [{ da, a, con }] } nel testo del pezzo.
    const modifiche = new Map();
    const prese = new Map(); // riga -> [[da, a]] per non sovrapporre
    for (const o of occorrenze) {
      const r = righe[o.riga];
      if (!r || r.testo.slice(o.da, o.a) !== o.testo) { saltate.push({ segnaposto: o.segnaposto, testo: o.testo, motivo: 'il testo non è più dove era stato trovato' }); continue; }
      const coperti = r.pezzi.filter(z => z.da < o.a && z.a > o.da);
      if (coperti.some(z => z.tipo !== 't')) { saltate.push({ segnaposto: o.segnaposto, testo: o.testo, motivo: 'attraversa una tabulazione o un a capo' }); continue; }
      const giaPrese = prese.get(o.riga) || [];
      if (giaPrese.some(([x, y]) => o.da < y && o.a > x)) { saltate.push({ segnaposto: o.segnaposto, testo: o.testo, motivo: 'si sovrappone a un altro punto' }); continue; }
      giaPrese.push([o.da, o.a]);
      prese.set(o.riga, giaPrese);
      coperti.forEach((z, k) => {
        const da = Math.max(o.da, z.da) - z.da;
        const a = Math.min(o.a, z.a) - z.da;
        if (!modifiche.has(z)) modifiche.set(z, []);
        modifiche.get(z).push({ da, a, con: k === 0 ? (typeof o.con === 'string' ? o.con : `{{${o.segnaposto}}}`) : '' });
      });
    }
    // Si riscrive dal fondo, cosi' le posizioni prima restano buone.
    const pezzi = [...modifiche.keys()].sort((x, y) => y.tagDa - x.tagDa);
    let s = xml;
    for (const z of pezzi) {
      let testo = decodifica(s.slice(z.contDa, z.contA));
      for (const m of modifiche.get(z).sort((x, y) => y.da - x.da)) testo = testo.slice(0, m.da) + m.con + testo.slice(m.a);
      const preserva = /xml:space="preserve"/.test(z.attributi) || /^\s|\s$/.test(testo);
      const attributi = preserva && !/xml:space="preserve"/.test(z.attributi) ? `${z.attributi} xml:space="preserve"` : z.attributi;
      s = `${s.slice(0, z.tagDa)}<w:t${attributi}>${codifica(testo)}</w:t>${s.slice(z.contA + '</w:t>'.length)}`;
    }
    out[parte] = s;
  }
  return { parti: out, saltate };
}

/**
 * Il modello pronto da salvare: il .docx coi segnaposto e i punti da scrivere in
 * ModelloContratto.punti_json. Il valore di partenza dei prezzi non si conserva:
 * e' un costo dei fornitori e resta solo nel contratto (dal 13/10/2026 anche il
 * modello lo legge solo l'amministratore, ma i suoi punti arrivano a chi apre la
 * scheda Contratti, da contrattiAnno).
 * La data dell'iscrizione di SMOCO all'Albo si corregge gia' nel modello
 * (albo_smoco: le correzioni fatte, 13/10/2026).
 */
export function costruisciModello(letto, punti) {
  const conPunti = applicaPunti(letto.parti, punti);
  const albo = correggiAlboSmoco(conPunti.parti);
  const parti = albo.parti;
  const saltate = [...conPunti.saltate, ...albo.saltate];
  const voci = { ...letto.voci };
  for (const [nome, xml] of Object.entries(parti)) voci[nome] = strToU8(xml);
  const zip = zipSync(voci, { level: 6 });
  const attivi = (punti || []).filter(p => p.attivo || p.gia_segnaposto);
  const daSalvare = attivi.map(p => ({
    segnaposto: p.segnaposto, nome: p.nome, categoria: p.categoria, tipo: p.tipo, stile: p.stile || null,
    originale: ePrezzo(p.segnaposto.replace(/_\d+$/, '')) || p.tipo === 'prezzo' ? null : (p.originale || null),
    occorrenze: (p.occorrenze || []).filter(o => o.attiva).length,
  }));
  const segnaposti = [];
  for (const xml of Object.values(parti)) for (const m of xml.matchAll(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g)) if (!segnaposti.includes(m[1])) segnaposti.push(m[1]);
  return { voci, parti, saltate, albo_smoco: albo.correzioni, punti: daSalvare, segnaposti, blob: new Blob([zip], { type: TIPO_DOCX }) };
}

// ─── il contratto: i segnaposto diventano valori ───

/**
 * Compone il contratto dal modello letto (leggiModello) e dai valori grezzi
 * (date aaaa-mm-gg, numeri, testi): ogni valore si scrive come vuole il modello
 * (lo stile delle date, i prezzi con due decimali). Un segnaposto senza valore
 * resta visibile nel documento e torna in segnaposti_vuoti.
 * La data dell'iscrizione di SMOCO all'Albo si corregge anche qui, per i modelli
 * salvati prima del 13/10/2026 che hanno ancora quella del format: albo_smoco
 * dice le correzioni fatte, per la nota del contratto.
 */
export function compilaContratto(modelloLetto, valori, punti = []) {
  const perIlDocumento = valoriPerIlDocumento(valori, (punti || []).map(p => ({ ...p, tipo: p.tipo || puntoDi(p.segnaposto).tipo })));
  const albo = correggiAlboSmoco(modelloLetto.parti);
  return { ...generaDocx({ ...modelloLetto, parti: albo.parti }, perIlDocumento), albo_smoco: albo.correzioni };
}

/** I punti salvati in un modello (punti_json), o un elenco vuoto per i modelli di prima. */
export function puntiDelModello(modello) {
  try {
    const v = JSON.parse((modello && modello.punti_json) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
