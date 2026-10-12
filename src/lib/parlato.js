// IL PARLATO DI ECOTYNA: CON CHE VOCE, CHE COSA SI DICE, IN CHE PEZZI.
//
// L'utente, l'11/10/2026: «vorrei rendere EcoTyna piu' realistica e con una voce
// meno robotica». Misurando, quattro cose la facevano sembrare una macchina che
// legge, e nessuna dipendeva dalla sintesi del browser in se':
//
// 1) LEGGEVA IL TESTO SCRITTO. «412,30 t» finiva in «ti», «PFU» in una parola
//    sola, «GREEN TYRE PROJECT SRL» con la forma societaria e tutto maiuscolo,
//    «05/10/2026» cifra per cifra, il formulario RGYTR025688FF lettera per
//    lettera. Una persona dice «tonnellate», «pi effe u», «Green Tyre», «5
//    ottobre», e un codice non lo legge: dice «il formulario». testoParlato fa
//    questo passaggio, e scrive i numeri in parole: cosi' nessuna voce li legge a
//    modo suo, e la bocca dell'avatar (visemi.js) segue le sillabe vere invece di
//    tirare a indovinare sulle cifre.
// 2) DICEVA TUTTO IN UN FIATO. Un enunciato solo per tutta la risposta: niente
//    respiro fra una frase e l'altra, e Chrome un enunciato lungo lo tronca da
//    solo dopo una quindicina di secondi. Ora si dice frase per frase
//    (dividiInFrasi, leggiAVoce), con una pausa breve fra le frasi e una piu'
//    lunga fra i paragrafi.
// 3) LA VOCE. Si prendeva la prima voce italiana col nome da donna: di solito la
//    voce di base del sistema, la piu' metallica. ordinaVoci mette in fila per
//    qualita'. Le voci migliori pero' sono quasi sempre ONLINE (in Edge «Elsa
//    Online (Natural)», in Chrome «Google italiano»): il browser manda il testo
//    al servizio vocale di Microsoft o di Google. Per la regola di riservatezza
//    dell'utente (nessun dato che esce dal gestionale senza che lo sappia) una
//    voce online non si sceglie da sola: si propone, e decide lui (voceDaUsare).
// 4) LEGGEVA TUTTO. Una risposta con dieci righe di dettaglio si ascoltava per un
//    minuto. Ora la voce dice la versione parlata che il modello scrive a parte
//    (da_dire, in chiediAssistente), e il testo intero solo se glielo si chiede;
//    per le risposte che non ce l'hanno c'e' riassuntoParlato.
//
// Questo file non usa React e non tocca il browser se non con quello che gli si
// passa: si prova con node (prove/parlato.mjs). La voce sta in voce.js, la
// bocca in visemi.js, la modalita' conversazione in conversazione.js.

// ---------------------------------------------------------------------------
// I NUMERI IN PAROLE
// ---------------------------------------------------------------------------

const UNITA = ['zero', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove',
  'dieci', 'undici', 'dodici', 'tredici', 'quattordici', 'quindici', 'sedici', 'diciassette', 'diciotto', 'diciannove'];
const DECINE = ['', 'dieci', 'venti', 'trenta', 'quaranta', 'cinquanta', 'sessanta', 'settanta', 'ottanta', 'novanta'];

function finoA999(n) {
  const c = Math.floor(n / 100);
  const r = n % 100;
  let s = c === 0 ? '' : c === 1 ? 'cento' : UNITA[c] + 'cento';
  if (r === 0) return s;
  let t;
  if (r < 20) t = UNITA[r];
  else {
    const u = r % 10;
    t = DECINE[Math.floor(r / 10)];
    // venti + uno = ventuno, trenta + otto = trentotto
    if (u === 1 || u === 8) t = t.slice(0, -1);
    if (u) t += UNITA[u];
  }
  // cento + otto = centotto, duecento + ottanta = duecentottanta
  if (s && t.startsWith('o')) s = s.slice(0, -1);
  return s + t;
}

/** Un intero in parole, all'italiana: 1617 -> «milleseicentodiciassette». */
export function interoInParole(valore) {
  const n = Math.floor(Math.abs(Number(valore)));
  if (!Number.isFinite(n)) return '';
  if (n === 0) return 'zero';
  const miliardi = Math.floor(n / 1e9);
  const milioni = Math.floor(n / 1e6) % 1000;
  const migliaia = Math.floor(n / 1000) % 1000;
  const resto = n % 1000;
  const parti = [];
  if (miliardi) parti.push(miliardi === 1 ? 'un miliardo' : interoInParole(miliardi) + ' miliardi');
  if (milioni) parti.push(milioni === 1 ? 'un milione' : finoA999(milioni) + ' milioni');
  let coda = '';
  if (migliaia) coda += migliaia === 1 ? 'mille' : finoA999(migliaia) + 'mila';
  if (resto) coda += finoA999(resto);
  // Il tre in fondo a un numero composto si accenta: ventitré, centotré, milletré.
  // Da solo no, nemmeno dopo i milioni: «un milione tre».
  if (migliaia * 1000 + resto > 3 && coda.endsWith('tre')) coda = coda.slice(0, -3) + 'tré';
  if (coda) parti.push(coda);
  return parti.join(' ');
}

const cifraPerCifra = (cifre) => [...String(cifre)].map(c => UNITA[Number(c)]).join(' ');

/**
 * Un numero scritto all'italiana, in parole: «1.617,22» -> «milleseicentodiciassette
 * virgola ventidue», «0,05» -> «zero virgola zero cinque», «-3» -> «meno tre».
 * I decimali tutti a zero non si dicono (1.600,00 e' milleseicento). Un intero
 * con lo zero davanti (il 01 di un codice EER) si dice cifra per cifra.
 */
export function numeroInParole(testo) {
  const m = /^([+\-−]?)(\d{1,3}(?:\.\d{3})+|\d+)(?:[,.](\d+))?$/.exec(String(testo || '').trim());
  if (!m) return String(testo || '');
  const [, segno, interoScritto, decimali] = m;
  const cifre = interoScritto.replace(/\./g, '');
  let s = cifre.length > 1 && cifre.startsWith('0') && !decimali ? cifraPerCifra(cifre) : interoInParole(Number(cifre));
  if (decimali && /[1-9]/.test(decimali)) {
    const zeri = /^0*/.exec(decimali)[0];
    const dopo = decimali.slice(zeri.length);
    s += ' virgola ' + [...zeri].map(() => 'zero').concat(interoInParole(Number(dopo))).join(' ');
  }
  if (segno === '-' || segno === '−') s = 'meno ' + s;
  if (segno === '+') s = 'più ' + s;
  return s;
}

// ---------------------------------------------------------------------------
// IL TESTO DETTO
// ---------------------------------------------------------------------------

export const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

/** Al posto di una tabella, che letta ad alta voce e' una litania di numeri. */
export const AL_POSTO_DELLA_TABELLA = "Qui c'è una tabella: te la lascio da leggere.";

// Come si dicono le sigle del mestiere. Quelle che in ufficio si dicono come una
// parola (fir, aci, rentri, cer, mud) si scrivono minuscole, cosi' la voce non le
// compita; le altre si scrivono lettera per lettera, come si pronunciano.
const SIGLE = [
  [/\bPFU\b/g, 'pi effe u'],
  [/\bFIR\b/g, 'fir'],
  [/\bACI\b/g, 'aci'],
  [/\bRENTRI\b/g, 'rentri'],
  [/\bE[oO][wW]\b/g, 'end of waste'],
  [/\bEER\b/g, 'e e erre'],
  [/\bCER\b/g, 'cer'],
  [/\bCSS-C\b/g, 'ci esse esse ci'],
  [/\bCSS\b/g, 'ci esse esse'],
  [/\bRT\b/g, 'erre ti'],
  [/\bPDR\b/g, 'pi di erre'],
  [/\bECT\b/g, 'e ci ti'],
  [/\bADR\b/g, 'a di erre'],
  [/\bMUD\b/g, 'mud'],
  [/\bPEC\b/g, 'pec'],
  [/\bIVA\b/g, 'iva'],
  [/\bDDT\b/g, 'di di ti'],
  [/\bPDF\b/g, 'pi di effe'],
  [/\bCSV\b/g, 'ci esse vu'],
  [/\bKPI\b/g, 'cappa pi i'],
  [/\bTUA\b/g, 'testo unico ambientale'],
  [/\bUE\b/g, 'u e'],
  [/\bID\b/g, 'i di'],
  [/\bRAEE\b/g, 'raee'],
  [/\bDURC\b/g, 'durc'],
  [/\bEco[Tt]yna\b|\bECOTYNA\b/g, 'Ecotina'],
];

// Parole brevi che in un testo tutto maiuscolo sono parole, non sigle.
const PAROLE_BREVI = new Set(['A', 'E', 'O', 'I', 'IL', 'LO', 'LA', 'LE', 'GLI', 'UN', 'UNA', 'DI', 'DA', 'IN', 'SU', 'PER', 'CON', 'TRA', 'FRA',
  'NON', 'SI', 'SÌ', 'NO', 'MA', 'SE', 'CHE', 'MAI', 'GIA', 'GIÀ', 'PIU', 'PIÙ', 'ED', 'AD', 'DEL', 'DAL', 'AL', 'NEL', 'SUL', 'DEI', 'DAI']);

const ROMANI = { I: 1, V: 5, X: 10, L: 50 };
const daRomano = (r) => {
  let n = 0;
  for (let i = 0; i < r.length; i++) {
    const v = ROMANI[r[i]], dopo = ROMANI[r[i + 1]] || 0;
    n += v < dopo ? -v : v;
  }
  return n;
};
const ORDINALI = ['', 'primo', 'secondo', 'terzo', 'quarto', 'quinto', 'sesto', 'settimo', 'ottavo', 'nono', 'decimo',
  'undicesimo', 'dodicesimo', 'tredicesimo', 'quattordicesimo', 'quindicesimo', 'sedicesimo', 'diciassettesimo', 'diciottesimo', 'diciannovesimo', 'ventesimo'];

const giornoDetto = (g) => (Number(g) === 1 ? 'primo' : String(Number(g)));
const dataDetta = (g, m, a) => `${giornoDetto(g)} ${MESI[Number(m) - 1]}${a ? ' ' + a : ''}`;
const dataValida = (g, m) => Number(m) >= 1 && Number(m) <= 12 && Number(g) >= 1 && Number(g) <= 31;

// Il segno che tiene il posto di un codice mentre si sistema la frase intorno.
const CODICE = '\u0001';

// Le sigle degli atti europei (2008/98/CE), come si dicono.
const ATTI_EUROPEI = { CE: 'ci e', CEE: 'ci e e', UE: 'u e', Euratom: 'euratom' };
// La preposizione davanti a un mese scritto 2026-09: «dal settembre» non si dice.
const PREPOSIZIONE_DEL_MESE = { dal: 'da', al: 'a', del: 'di', mese: 'mese di' };

// Un codice d'ordine o di formulario: lettere e cifre insieme, almeno sei
// caratteri e almeno tre cifre (ET26152600, RGYTR025688FF). Letto ad alta voce
// e' una filastrocca che nessuno ascolta: si salta, e resta «l'ordine».
const eUnCodice = (t) => t.length >= 6 && /[A-Za-z]/.test(t) && (t.match(/\d/g) || []).length >= 3;

/** Il testo di una riga di markdown, senza i segni che non si pronunciano. */
const rigaPulita = (r) => r
  .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/https?:\/\/\S+|www\.\S+/g, ' ')
  .replace(/`([^`]*)`/g, '$1')
  .replace(/(\*\*|__)(.+?)\1/g, '$2')
  .replace(/(^|[^\w*])[*_]([^*_\n]+)[*_](?=[^\w*]|$)/g, '$1$2')
  .replace(/[*#>`]/g, '')
  .replace(/\s{2,}/g, ' ')
  .trim();

const chiudiFrase = (r) => (/[.!?…:;]$/.test(r) ? r : r + '.');

/**
 * I paragrafi di un testo in markdown, come righe gia' pulite: le tabelle
 * diventano una riga sola (AL_POSTO_DELLA_TABELLA), i titoli e le voci di un
 * elenco frasi a se'. Serve a testoParlato e a riassuntoParlato.
 * Torna [{ righe: [..], titolo: bool, tabella: bool }].
 */
export function paragrafiDelTesto(markdown) {
  const righe = String(markdown || '').replace(/\r\n?/g, '\n').replace(/```[\s\S]*?```/g, '\n').split('\n');
  const paragrafi = [];
  let corrente = null;
  const chiudi = () => { if (corrente && corrente.righe.length) paragrafi.push(corrente); corrente = null; };
  const apri = (extra = {}) => { if (!corrente) corrente = { righe: [], titolo: false, tabella: false, ...extra }; return corrente; };
  for (const grezza of righe) {
    const r = grezza.trim();
    if (!r) { chiudi(); continue; }
    if (/^\|.*\|$/.test(r) || /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$/.test(r)) {
      // Una tabella si annuncia una volta sola, qualunque sia la sua lunghezza.
      if (!(corrente && corrente.tabella)) { chiudi(); apri({ tabella: true }).righe.push(AL_POSTO_DELLA_TABELLA); }
      continue;
    }
    if (corrente && corrente.tabella) chiudi();
    const titolo = /^#{1,6}\s+(.*)$/.exec(r);
    if (titolo) {
      chiudi();
      const t = rigaPulita(titolo[1]);
      if (t) paragrafi.push({ righe: [chiudiFrase(t)], titolo: true, tabella: false });
      continue;
    }
    const voce = /^(?:[-*+•]|\d{1,2}[.)])\s+(.*)$/.exec(r);
    const testo = rigaPulita(voce ? voce[1] : r.replace(/^>\s?/, ''));
    if (!testo) continue;
    // Una voce di elenco e' una frase: senza il punto si attaccherebbe alla dopo.
    apri().righe.push(voce ? chiudiFrase(testo) : testo);
  }
  chiudi();
  return paragrafi;
}

/** I numeri, con l'accordo dell'unita' quando e' uno solo: una tonnellata, un chilo. */
const SINGOLARE = { tonnellate: 'una tonnellata', chili: 'un chilo', chilometri: 'un chilometro', giorni: 'un giorno', euro: 'un euro' };
const NUMERO = '([+\\-−]?)(\\d{1,3}(?:\\.\\d{3})+|\\d+)(?:,(\\d+))?';

function numeriDetti(s) {
  // Gli euro coi centesimi: «49.947,30 euro» si dice «... euro e trenta centesimi».
  s = s.replace(new RegExp(`(?<![\\p{L}\\d.,])${NUMERO}\\s+euro\\b`, 'gu'), (m, segno, intero, dec) => {
    const centesimi = dec && dec.length <= 2 && /[1-9]/.test(dec) ? Number(dec.padEnd(2, '0')) : 0;
    if (dec && dec.length > 2 && /[1-9]/.test(dec)) return `${numeroInParole(`${segno}${intero},${dec}`)} euro`;
    const cifre = intero.replace(/\./g, '');
    const parteIntera = Number(cifre) === 1 && !segno ? 'un euro' : `${numeroInParole(segno + intero)} euro`;
    if (!centesimi) return parteIntera;
    if (Number(cifre) === 0) return `${interoInParole(centesimi)} centesimi`;
    return `${parteIntera} e ${interoInParole(centesimi)} centesimi`;
  });
  // Le unita' col loro numero: «1 t» e' «una tonnellata», «1,5 t» no.
  s = s.replace(new RegExp(`(?<![\\p{L}\\d.,])${NUMERO}\\s+(tonnellate|chili|chilometri|giorni)\\b`, 'gu'), (m, segno, intero, dec, unita) => {
    const uno = !segno && intero === '1' && !(dec && /[1-9]/.test(dec));
    return uno ? SINGOLARE[unita] : `${numeroInParole(`${segno}${intero}${dec ? ',' + dec : ''}`)} ${unita}`;
  });
  // Tutti gli altri numeri.
  s = s.replace(new RegExp(`(?<![\\p{L}\\d.,])${NUMERO}(?![\\d\\p{L}])`, 'gu'), (m, segno, intero, dec) =>
    numeroInParole(`${segno}${intero}${dec ? ',' + dec : ''}`));
  return s;
}

/** Una riga di testo scritto, detta: date, codici, sigle, unita', numeri e nomi. */
function rigaDetta(riga) {
  let s = ` ${riga} `;

  // Gli accenti scritti con l'apostrofo (e', piu', perche'): la voce li legge come
  // vocali senza accento, e sposta l'accento della parola. «po'» resta com'e'.
  s = s.replace(/(?<!\p{L})([Ee])'(?=[\s,.;:!?)]|$)/gu, (m, e) => (e === 'E' ? 'È' : 'è'));
  s = s.replace(/(?<!\p{L})(\p{L}{2,})([aeiouAEIOU])'(?=[\s,.;:!?)]|$)/gu, (m, radice, v) => {
    const acuta = /^e$/i.test(v) && /ch$/i.test(radice);
    const accentata = { a: 'à', e: acuta ? 'é' : 'è', i: 'ì', o: 'ò', u: 'ù' }[v.toLowerCase()];
    return radice + (v === v.toUpperCase() ? accentata.toUpperCase() : accentata);
  });

  // Date. Prima le date intere (05/10/2026, 2026-10-05), poi giorno e mese dopo
  // una preposizione (al 31/12). Il primo del mese si dice «primo».
  s = s.replace(/(?<![\w/.-])(\d{4})-(\d{2})-(\d{2})(?:T[\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?(?![\w/-])/g,
    (m, a, mm, g) => (dataValida(g, mm) ? dataDetta(g, mm, a) : m));
  s = s.replace(/(?<![\w/.-])(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})(?![\w/])/g,
    (m, g, mm, a) => (dataValida(g, mm) ? dataDetta(g, mm, a.length === 2 ? '20' + a : a) : m));
  s = s.replace(/\b(il|al|dal|del|nel|sul|entro il|fino al|dopo il|prima del)\s+(\d{1,2})\/(\d{1,2})(?![\w/])/gi,
    (m, prep, g, mm) => (dataValida(g, mm) ? `${prep} ${dataDetta(g, mm)}` : m));
  s = s.replace(/\b(dall|all|l|dell|nell|sull)'\s?primo\b/gi, (m, prep) => ({ dall: 'dal', all: 'al', l: 'il', dell: 'del', nell: 'nel', sull: 'sul' }[prep.toLowerCase()] + ' primo'));
  // Un mese scritto come lo portano gli strumenti, «2026-09», e' settembre 2026:
  // la regola degli intervalli, piu' sotto, lo diceva «da duemilaventisei a zero
  // nove» (revisione delle migliorie, 11/10/2026). Davanti a un mese si dice
  // «da», «a», «di» e «il mese di», non «dal», «al», «del» e «il mese».
  s = s.replace(/(?:\b(dal|al|del|mese)\s+)?(?<![\w/.-])((?:19|20)\d{2})-(0[1-9]|1[0-2])(?![\w/-]|[.,]\d)/gi, (m, prima, a, mm) => {
    let p = prima ? PREPOSIZIONE_DEL_MESE[prima.toLowerCase()] : '';
    if (p && prima[0] !== prima[0].toLowerCase()) p = p[0].toUpperCase() + p.slice(1);
    return `${p ? p + ' ' : ''}${MESI[Number(mm) - 1]} ${a}`;
  });

  // Ore: «alle 10.30», «10:30».
  s = s.replace(/\b(ore|alle|dalle|entro le|verso le)\s+(\d{1,2})[.:](\d{2})\b/gi, (m, prep, h, mi) => `${prep} ${Number(h)}${mi === '00' ? '' : ' e ' + Number(mi)}`);
  s = s.replace(/(?<![\d.,:])(\d{1,2}):(\d{2})(?![\d:])/g, (m, h, mi) => `${Number(h)}${mi === '00' ? '' : ' e ' + Number(mi)}`);

  // Le norme che hanno la forma di un codice. «184-ter», «188-bis» e gli atti
  // europei «2008/98/CE», «2000/532/CE» hanno lettere e almeno tre cifre come un
  // codice d'ordine: sparivano, e si sentiva «l'articolo» senza numero proprio
  // negli articoli piu' citati del mestiere (end of waste, sottoprodotto,
  // tracciabilita'). Si dicono come in ufficio, prima che i codici si saltino:
  // «centottantaquattro ter», «duemilaotto novantotto ci e» (revisione delle
  // migliorie, 11/10/2026).
  s = s.replace(/(?<![\p{L}\d])(\d{1,4})(?:-|\s?)(bis|ter|quater|quinquies|sexies|septies|octies|novies|decies)(?![\p{L}\d])/giu,
    (m, n, suffisso) => `${n} ${suffisso.toLowerCase()}`);
  s = s.replace(/(?<![\p{L}\d/])(\d{2,4})\/(\d{1,4})\/(CEE|CE|UE|Euratom)(?![\p{L}\d])/gu,
    (m, primo, secondo, sigla) => `${primo} ${secondo} ${ATTI_EUROPEI[sigla]}`);

  // Nomi di file e codici non si leggono.
  s = s.replace(/[^\s()]+\.(?:xlsx|xls|csv|pdf|docx?|txt|jpe?g|png)\b/gi, ' ');
  s = s.replace(/(?<![\w-])[A-Za-z0-9]+(?:[-/][A-Za-z0-9]+)*(?![\w-])/g, (t) => (eUnCodice(t) ? CODICE : t));
  if (s.includes(CODICE)) {
    s = s.replace(new RegExp(`${CODICE}(?:\\s*(?:,|;|\\be\\b|\\bed\\b|\\bo\\b)\\s*${CODICE})*(?:,?\\s*(?:ecc\\.?|eccetera|…|\\.\\.\\.))?`, 'g'), CODICE);
    s = s.replace(new RegExp(`\\s*\\(\\s*(?:(?:es\\.|ad es\\.|per es\\.|ad esempio|per esempio|tra cui|fra cui|ID(?: ordine| ordini)?|n\\.|numero|codice)\\s*:?\\s*)?${CODICE}\\s*\\)`, 'gi'), '');
    s = s.replace(new RegExp(`,?\\s*(?:per esempio|ad esempio|tra cui|fra cui|come|cioè|ovvero|es\\.)\\s*:?\\s*${CODICE}`, 'gi'), '');
    s = s.replace(new RegExp(`\\bID\\s+(ordine|ordini|formulario|formulari)\\s*:?\\s*${CODICE}`, 'g'), '$1');
    s = s.replace(new RegExp(`\\b(?:ID|n\\.|nr\\.|numero|codice)\\s*:?\\s*${CODICE}`, 'gi'), '');
    s = s.split(CODICE).join('');
  }

  // Ragioni sociali: senza la forma societaria. «S.r.l.» in fondo a una frase si
  // porta via il punto, che invece serve: lo si rimette.
  s = s.replace(/(?<=[\p{L}\d.)'])\s*,?\s+(?:s\.?\s?r\.?\s?l\.?(?:\s?s\.?)?|s\.?\s?p\.?\s?a\.?|s\.?\s?n\.?\s?c\.?|s\.?\s?a\.?\s?s\.?|soc\.?\s?coop\.?(?:\s?a\s?r\.?\s?l\.?)?|s\.?\s?c\.?\s?a\.?\s?r\.?\s?l\.?)(?=$|[\s,.;:)!?»"'])/giu,
    (m, pos, tutto) => (m.endsWith('.') && /^\s+[A-ZÀ-Ý]|^\s*$/.test(tutto.slice(pos + m.length)) ? '.' : ''));
  s = s.replace(/\s*&\s*C\.?(?=$|[\s,;.)])/g, '');

  // Riferimenti di legge e abbreviazioni.
  s = s.replace(/\bD\.\s?[Ll]gs\.?|\bd\.\s?lgs\.?|\bD[Ll]gs\.?(?=\s)/g, 'decreto legislativo');
  s = s.replace(/\bD\.\s?M\.(?=\s)|\bDM\b/g, 'decreto ministeriale');
  s = s.replace(/\bD\.\s?P\.\s?R\.?(?=\s)|\bDPR\b/g, 'decreto del presidente della repubblica');
  s = s.replace(/\bartt\.\s?/g, 'articoli ').replace(/\b[Aa]rt\.\s?/g, 'articolo ');
  s = s.replace(/\blett\.\s?/g, 'lettera ').replace(/\bc\.\s?(?=\d)/g, 'comma ');
  s = s.replace(/\b[Aa]ll\.\s?(?=[IVXL\d])/g, 'allegato ');
  s = s.replace(/\b(?:n|nr|num)\.\s?(?=\d)/gi, 'numero ');
  s = s.replace(/\bpag\.\s?(?=\d)/g, 'pagina ').replace(/\bsett\.\s?(?=\d)/g, 'settimana ');
  s = s.replace(/\b(ad|per)\s+es\.\s?/gi, '$1 esempio ').replace(/\bp\.\s?es\.\s?/gi, 'per esempio ').replace(/\(\s?es\.\s?/g, '(per esempio ');
  s = s.replace(/\becc\.(\s+(?=[A-ZÀ-Ý])|\s*$)?/g, (m, dopo) => (dopo !== undefined ? 'eccetera.' + (dopo || '') : 'eccetera'));
  s = s.replace(/\bvs\.?(?=\s)/gi, 'contro').replace(/\bn\/d\b/gi, 'non disponibile').replace(/\be\/o\b/g, 'e o');
  s = s.replace(/\bca\.\s?(?=\d)/g, 'circa ').replace(/~\s?(?=\d)/g, 'circa ');
  s = s.replace(/\b(allegat[oi]|parte|titolo|capo|sezione)\s+([IVXL]{1,6})\b/g, (m, nome, r) => {
    const n = daRomano(r);
    if (!n || n > 20) return m;
    if (/^allegat/.test(nome)) return `${nome} ${n}`;
    // parte quarta, sezione seconda; titolo terzo, capo primo
    return `${nome} ${/^(parte|sezione)$/.test(nome) ? ORDINALI[n].replace(/o$/, 'a') : ORDINALI[n]}`;
  });
  // Numero e anno di una norma: «182/2019» e' «182 del 2019».
  s = s.replace(/(?<![\d/.,])(\d{1,4})\/((?:19|20)\d{2})(?![\d/])/g, '$1 del $2');
  // Un intervallo: «classi 1-4» e' «da 1 a 4».
  s = s.replace(/(?<![\w/-]|\d[.,])(\d{1,4})\s?[-–]\s?(\d{1,4})(?![\w/-]|[.,]\d)/g, 'da $1 a $2');
  s = s.replace(/\b1[°º]/g, 'primo').replace(/(\d)[°º]/g, '$1');

  // Unita' e valute per esteso.
  s = s.replace(/(?:€|\beuro\b|\bEUR\b)\s*\/\s*(?:t|ton|tonn|tonnellat[ae])\b\.?/gi, ' euro a tonnellata ');
  s = s.replace(/(?:€|\beuro\b|\bEUR\b)\s*\/\s*kg\b/gi, ' euro al chilo ');
  s = s.replace(/€\s?([+\-−]?\d[\d.]*(?:,\d+)?)/g, '$1 euro');
  s = s.replace(/(\d)\s?(?:€|\bEUR\b)/g, '$1 euro');
  s = s.replace(/€/g, ' euro ');
  s = s.replace(/(\d)\s?%/g, '$1 per cento').replace(/%/g, ' per cento');
  s = s.replace(/(\d)\s?(?:t|ton|tonn\.?)(?![\p{L}\d/])/gu, '$1 tonnellate');
  s = s.replace(/(\d)\s?kg(?![\p{L}\d])/giu, '$1 chili');
  s = s.replace(/(\d)\s?km(?![\p{L}\d])/gu, '$1 chilometri');
  s = s.replace(/(\d)\s?gg(?![\p{L}\d])/gu, '$1 giorni');

  // Un decimale all'inglese sfuggito alla conversione (3.38 senza unita'): una o
  // due cifre dopo il punto non sono un gruppo di migliaia.
  s = s.replace(/(?<![\d.,])(\d+)\.(\d{1,2})(?![\d.])/g, '$1,$2');
  s = numeriDetti(s);

  for (const [re, detto] of SIGLE) s = s.replace(re, detto);

  // Le ragioni sociali tutte maiuscole si dicono come nomi: GREEN TYRE PROJECT ->
  // Green Tyre Project, ECO.GEA -> Ecogea. Una parola corta da sola resta com'e'
  // (puo' essere una sigla che la voce sa compitare), tranne le parole italiane.
  const maiuscola = (t) => /\p{Lu}/u.test(t) && !/\p{Ll}/u.test(t);
  const comeNome = (t) => t.replace(/(?<=\p{L})\.(?=\p{L})/gu, '').toLowerCase().replace(/(^|[-'’])(\p{L})/gu, (m, p, l) => p + l.toUpperCase());
  s = s.replace(/[\p{L}\d][\p{L}\d.'’&-]*(?:\s+[\p{L}\d][\p{L}\d.'’&-]*)*/gu, (frase) => {
    const parole = frase.split(/(\s+)/);
    const out = [];
    for (let i = 0; i < parole.length; i++) {
      const p = parole[i];
      if (/^\s+$/.test(p) || !maiuscola(p)) { out.push(p); continue; }
      // la corsa di parole maiuscole a cui appartiene
      let j = i;
      const corsa = [];
      while (j < parole.length && (maiuscola(parole[j]) || (/^\s+$/.test(parole[j]) && maiuscola(parole[j + 1] || '')))) { corsa.push(parole[j]); j++; }
      const vere = corsa.filter(x => !/^\s+$/.test(x));
      if (vere.length >= 2 || (vere[0] || '').replace(/[^\p{L}]/gu, '').length >= 4) out.push(...corsa.map(x => (/^\s+$/.test(x) ? x : comeNome(x))));
      else out.push(...corsa.map(x => (PAROLE_BREVI.has(x.replace(/[^\p{L}]/gu, '')) ? x.toLowerCase() : x)));
      i = j - 1;
    }
    return out.join('');
  });

  // Simboli e punteggiatura che la voce leggerebbe o su cui inciamperebbe.
  s = s.replace(/:\s*[—–]\s*(?=$|[\s.,;)])/g, ': nessun valore ');
  s = s.replace(/\s[—–-]\s/g, ', ').replace(/[—–]/g, ', ');
  s = s.replace(/\s*(?:→|->|=>|⇒)\s*/g, ', ').replace(/&/g, ' e ').replace(/\s\+\s/g, ' più ').replace(/\s=\s/g, ', ');
  s = s.replace(/[«»"“”„]/g, '').replace(/[[\]{}]/g, '').replace(/[|·•]/g, ', ').replace(/_/g, ' ');
  s = s.replace(/\s*\(\s*/g, ', ').replace(/\s*\)\s*/g, ', ');
  s = s.replace(/(?<=\p{L})\s*\/\s*(?=\p{L})/gu, ', ');
  s = s.replace(/\.{3}|…/g, '.');
  s = s.replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,;:])(?:\s*[,;:])+/g, '$1')
    .replace(/[,;:]\s*([.!?])/g, '$1')
    .replace(/^[\s,;:.]+/, '')
    .replace(/[\s,]+$/, '');
  return s.trim();
}

/**
 * Il testo scritto, come lo si dice. Accetta il markdown delle risposte: i
 * paragrafi restano separati da una riga vuota, che per dividiInFrasi e' la
 * pausa lunga.
 */
export function testoParlato(testo) {
  return paragrafiDelTesto(testo)
    .map(p => p.righe.map(rigaDetta).filter(r => /[\p{L}\d]/u.test(r)).join(' '))
    .filter(Boolean)
    .map(chiudiFrase)
    .join('\n\n');
}

// ---------------------------------------------------------------------------
// FRASE PER FRASE
// ---------------------------------------------------------------------------

/**
 * Le pause, in millesimi, dopo la fine di un enunciato. La sintesi ci mette gia'
 * del suo fra un enunciato e l'altro: queste sono in piu'. Un pezzo di frase
 * tagliato a una virgola non ne aggiunge.
 */
export const PAUSE = { frase: 200, paragrafo: 600, virgola: 0 };

/**
 * Quanti caratteri al massimo in un enunciato: a velocita' normale una decina di
 * secondi, sotto la soglia oltre la quale Chrome tronca un enunciato da solo.
 */
export const MASSIMO_FRASE = 160;

function spezza(frase, massimo) {
  const pezzi = [];
  let f = frase;
  while (f.length > massimo) {
    const testa = f.slice(0, massimo);
    let taglio = Math.max(testa.lastIndexOf(';'), testa.lastIndexOf(':'), testa.lastIndexOf(','));
    if (taglio < massimo * 0.35) taglio = testa.lastIndexOf(' ');
    if (taglio <= 0) taglio = massimo - 1;
    pezzi.push(f.slice(0, taglio + 1).trim());
    f = f.slice(taglio + 1).trim();
  }
  if (f) pezzi.push(f);
  return pezzi;
}

/**
 * Il testo detto (testoParlato), diviso negli enunciati da dire uno alla volta.
 * Torna [{ testo, pausa }]: la pausa e' quella da fare DOPO quell'enunciato.
 */
export function dividiInFrasi(testo, { massimo = MASSIMO_FRASE } = {}) {
  const paragrafi = String(testo || '').split(/\n\s*\n/).map(p => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  const fuori = [];
  paragrafi.forEach((p, ip) => {
    const frasi = p.split(/(?<=[.!?…])\s+(?=\S)/).map(f => f.trim()).filter(f => /[\p{L}\d]/u.test(f));
    frasi.forEach((f, iff) => {
      const pezzi = spezza(f, massimo);
      pezzi.forEach((pezzo, k) => {
        const ultimoPezzo = k === pezzi.length - 1;
        const ultimaFrase = iff === frasi.length - 1;
        const pausa = !ultimoPezzo ? PAUSE.virgola : !ultimaFrase ? PAUSE.frase : ip < paragrafi.length - 1 ? PAUSE.paragrafo : 0;
        fuori.push({ testo: pezzo, pausa });
      });
    });
  });
  return fuori;
}

/** Dal testo scritto agli enunciati da dire. */
export const frasiDaDire = (testo, opzioni) => dividiInFrasi(testoParlato(testo), opzioni);

/**
 * Che cosa dire di una risposta che non porta la versione parlata (le risposte
 * scritte prima dell'11/10/2026, o un modello che non l'ha compilata): le prime
 * due frasi, che per le regole del prompt sono la risposta, e se c'e' altro lo si
 * dice invece di leggerlo.
 */
export function riassuntoParlato(risposta, { frasi = 2 } = {}) {
  const paragrafi = paragrafiDelTesto(risposta).filter(p => !p.titolo && !p.tabella);
  if (!paragrafi.length) return '';
  const pezzi = paragrafi[0].righe.join(' ').split(/(?<=[.!?…])\s+(?=[A-ZÀ-Ý«"(])/).filter(Boolean);
  const detto = pezzi.slice(0, frasi).join(' ');
  const resta = pezzi.length > frasi || paragrafi.length > 1 || paragrafiDelTesto(risposta).some(p => p.tabella);
  return resta ? `${detto} Gli altri dettagli te li ho scritti qui sotto.` : detto;
}

/** Che cosa dice la voce di una domanda: la versione parlata, se c'e'. */
export function daDireDi(domanda, parlata = '') {
  const scritta = String(parlata || (domanda && domanda.da_dire) || '').trim();
  return scritta || riassuntoParlato(domanda && domanda.risposta);
}

// ---------------------------------------------------------------------------
// LA VOCE MIGLIORE
// ---------------------------------------------------------------------------

const FEMMINILI = /elsa|isabella|alice|federica|carla|paola|giulia|emma|chiara|silvia|bianca|elena|palmira|google italiano|female|donna|femminile/i;

/**
 * Quanto e' naturale una voce, dal nome che le da' il sistema, e se e' online:
 * una voce online riceve il testo da dire (localService falso, o «Online» nel
 * nome come in Edge).
 */
export function qualitaVoce(v) {
  const nome = String((v && v.name) || '');
  const online = !!v && (v.localService === false || /\bonline\b/i.test(nome));
  if (/natural|neural/i.test(nome)) return { livello: 5, etichetta: 'naturale', online };
  if (/premium/i.test(nome)) return { livello: 4, etichetta: 'premium', online };
  if (/enhanced|migliorat|avanzat/i.test(nome)) return { livello: 3, etichetta: 'migliorata', online };
  if (/google/i.test(nome)) return { livello: 3, etichetta: 'buona', online };
  if (online) return { livello: 2, etichetta: 'buona', online };
  return { livello: 1, etichetta: 'di base', online };
}

/** Le voci italiane, dalla piu' naturale: a parita', l'italiano d'Italia e poi una voce da donna (EcoTyna e' una donna). */
export function ordinaVoci(voci) {
  const italiana = (v) => /^it([-_]|$)/i.test(String((v && v.lang) || ''));
  const daItalia = (v) => (/^it[-_]it$/i.test(String(v.lang || '')) ? 1 : 0);
  const donna = (v) => (FEMMINILI.test(String(v.name || '')) ? 1 : 0);
  return [...(voci || [])]
    .filter(italiana)
    .map((v, i) => ({ v, i, q: qualitaVoce(v) }))
    .sort((a, b) => b.q.livello - a.q.livello || daItalia(b.v) - daItalia(a.v) || donna(b.v) - donna(a.v) || a.i - b.i)
    .map(x => x.v);
}

/**
 * La voce da usare. Quella scelta dall'utente, se c'e' ancora. Altrimenti la
 * migliore che resta sul computer, e una online solo se l'utente l'ha accettata
 * (online: true) o se di voci sul computer non ce ne sono.
 */
export function voceDaUsare(ordinate, { nome = '', online = false } = {}) {
  const elenco = ordinate || [];
  if (nome) {
    const scelta = elenco.find(v => v.name === nome);
    if (scelta) return scelta;
  }
  if (online) return elenco[0] || null;
  return elenco.find(v => !qualitaVoce(v).online) || elenco[0] || null;
}

/** Una voce online piu' naturale di quella in uso, da proporre: null se non c'e'. */
export function voceDaProporre(ordinate, inUso) {
  const migliore = (ordinate || [])[0];
  if (!migliore || !inUso || migliore === inUso) return null;
  const q = qualitaVoce(migliore);
  return q.online && q.livello > qualitaVoce(inUso).livello ? migliore : null;
}

/** Il nome della voce senza il superfluo: «Microsoft Elsa Online (Natural) - Italian (Italy)» e' «Elsa». */
export function nomeBreveVoce(v) {
  const nome = String((v && v.name) || '');
  const breve = nome
    .replace(/^Microsoft\s+/i, '')
    .replace(/\s*[-–]\s*Ital(?:ian|iano).*$/i, '')
    .replace(/\s*\((?:Natural|Neural|Premium|Enhanced|Migliorata)\)/gi, '')
    .replace(/\s+Online\b/i, '')
    .trim();
  return breve || nome;
}

/** Come la voce compare nel selettore: il nome, la qualita' e se e' online. */
export function etichettaVoce(v) {
  const q = qualitaVoce(v);
  return `${nomeBreveVoce(v)} · ${q.etichetta}${q.online ? ', online' : ''}`;
}

/**
 * Il tono. Una voce naturale ha gia' il suo: alzarlo la rende piu' artificiale.
 * Alle voci di base si lascia il ritocco di prima (1,05), che le schiarisce.
 */
export function tonoDellaVoce(v) {
  return v && qualitaVoce(v).livello >= 3 ? 1 : 1.05;
}

// ---------------------------------------------------------------------------
// LEGGERE FRASE PER FRASE
// ---------------------------------------------------------------------------

/**
 * Dice gli enunciati uno dopo l'altra, con le pause. Non sa niente di React: si
 * passa il motore della sintesi (window.speechSynthesis), il costruttore degli
 * enunciati e i timer, cosi' si prova con node e un motore finto.
 *
 * Tre cose che la sintesi del browser fa e di cui qui si tiene conto:
 * - fermarla (cancel) chiude l'enunciato in corso con un errore o con la fine:
 *   dopo ferma() nessun avviso deve piu' far partire la frase dopo;
 * - a volte un enunciato non parte, o non avvisa mai che e' finito: una guardia
 *   lo riprova una volta, e se la sintesi tace passa alla frase dopo, cosi' la
 *   lettura non resta appesa (e la conversazione non aspetta per sempre);
 * - una voce online senza rete da' errore: si ripete la frase con la voce del
 *   computer (ripiego), e si resta su quella.
 *
 * Callback: alInizio(k, frase), alConfine(k, carattere), allaFineFrase(k),
 * allaFine(motivo) con motivo 'finito' | 'fermata'.
 * Ritorna { ferma() }.
 */
export function leggiAVoce({
  sintesi, Enunciato, frasi, voce = null, ripiego = null, velocita = 1, timer = globalThis,
  alInizio = null, alConfine = null, allaFineFrase = null, allaFine = null,
}) {
  let finita = false;
  let attesa = null;
  let guardia = null;
  let voceUsata = voce;

  const chiudi = (motivo) => {
    if (finita) return;
    finita = true;
    timer.clearTimeout(attesa);
    timer.clearTimeout(guardia);
    if (allaFine) allaFine(motivo);
  };

  const dici = (k, tentativo = 0) => {
    if (finita) return;
    if (k >= frasi.length) { chiudi('finito'); return; }
    const f = frasi[k];
    const u = new Enunciato(f.testo);
    u.lang = (voceUsata && voceUsata.lang) || 'it-IT';
    if (voceUsata) u.voice = voceUsata;
    u.rate = velocita;
    u.pitch = tonoDellaVoce(voceUsata);
    let chiusa = false;
    let partita = false;

    const avanti = () => {
      if (finita || chiusa) return;
      chiusa = true;
      timer.clearTimeout(guardia);
      if (allaFineFrase) allaFineFrase(k);
      if (k + 1 >= frasi.length) { chiudi('finito'); return; }
      attesa = timer.setTimeout(() => dici(k + 1), f.pausa || 0);
    };
    const daCapo = (conVoce) => {
      chiusa = true;
      timer.clearTimeout(guardia);
      voceUsata = conVoce;
      dici(k, tentativo + 1);
    };
    // Se finisce prima di quanto si possa dire, la sintesi l'ha ignorata.
    const controllaFine = () => {
      if (finita || chiusa) return;
      if (!sintesi.speaking && !sintesi.pending) avanti();
      else guardia = timer.setTimeout(controllaFine, 1500);
    };
    const controllaPartenza = () => {
      if (finita || chiusa || partita) return;
      if (sintesi.speaking || sintesi.pending) { guardia = timer.setTimeout(controllaPartenza, 1000); return; }
      if (tentativo < 1) daCapo(voceUsata);
      else avanti();
    };

    u.onstart = () => {
      if (finita || chiusa) return;
      partita = true;
      timer.clearTimeout(guardia);
      guardia = timer.setTimeout(controllaFine, f.testo.length * 110 + 3000);
      if (alInizio) alInizio(k, f);
    };
    u.onboundary = (e) => {
      if (finita || chiusa || !alConfine || !e || typeof e.charIndex !== 'number') return;
      alConfine(k, e.charIndex);
    };
    u.onend = avanti;
    u.onerror = (e) => {
      if (finita || chiusa) return;
      const motivo = e && e.error;
      if (motivo === 'interrupted' || motivo === 'canceled') return;
      if (ripiego && voceUsata !== ripiego && qualitaVoce(voceUsata).online && tentativo < 2) { daCapo(ripiego); return; }
      avanti();
    };
    sintesi.speak(u);
    guardia = timer.setTimeout(controllaPartenza, 1200);
  };

  sintesi.cancel();
  dici(0);
  return {
    ferma() {
      if (finita) return;
      chiudi('fermata');
      try { sintesi.cancel(); } catch { /* gia' ferma */ }
    },
  };
}

// ---------------------------------------------------------------------------
// LA SUA VOCE NEL MICROFONO
// ---------------------------------------------------------------------------

/** Le parole con cui si interrompe chi parla. */
export const PAROLE_STOP = ['ferma', 'fermati', 'basta', 'stop', 'zitta', 'aspetta', 'silenzio'];

/**
 * Le parole di chi fa una domanda o chiede qualcosa a lei. Quando non le sta
 * dicendo lei, nel microfono le dice l'utente.
 */
export const PAROLE_DOMANDA = ['quanto', 'quanta', 'quanti', 'quante', 'quale', 'quali', 'qual', 'dove', 'quando', 'perche', 'come', 'chi', 'cosa', 'cos',
  'dimmi', 'dammi', 'fammi', 'mostrami', 'spiegami', 'ripeti', 'ripetimi', 'puoi', 'potresti', 'scusa', 'senti'];

const paroleDi = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/(\d)\.(?=\d{3}\b)/g, '$1')
  .split(/[^a-z0-9]+/)
  .filter(p => p.length > 1);

/**
 * Vero se le due parole differiscono di una lettera sola: una cambiata, una in
 * piu' o una in meno («quando» e «quanto», «poi» e «puoi», «cos» e «cosa»).
 */
const unaLetteraDiversa = (a, b) => {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
};

// Le parole che accompagnano un comando senza farne una domanda: «ok basta»,
// «basta grazie», «basta cosi'», «aspetta un attimo». Un comando e' fatto solo
// di parole di stop e di queste. Prima bastava «due parole, una di stop», e
// cosi' «aspetta, perche'?» o «basta, e Gatim?» si perdevano: sono domande, e
// partono (verifica della rifinitura, 12/10/2026).
const RIEMPITIVI = ['ok', 'okay', 'grazie', 'cosi', 'ora', 'adesso', 'dai', 'ehi', 'va', 'bene', 'per', 'favore', 'un', 'attimo', 'momento'];

/**
 * Mentre EcoTyna parla il microfono sente anche lei, dalle casse. Una frase
 * sentita e' dell'utente solo se ha almeno due parole che lei non sta dicendo, e
 * sono almeno la meta' oppure fra loro c'e' una parola da domanda («quanto»,
 * «dimmi»): altrimenti e' la sua eco. Una frase di una o due parole con una
 * parola di stop («basta», «ferma», «ok basta») interrompe, ma non se e' tutta
 * sua.
 * `detto` e' tutto quello che lei sta dicendo, scritto e parlato: il microfono
 * trascrive i numeri in cifre, la voce li dice in parole.
 *
 * Le due correzioni della revisione delle migliorie (11/10/2026):
 * - le parole di stop si guardavano prima di chiedersi se erano sue. Le sue frasi
 *   si dicono una per volta, e per il riconoscimento ogni frase apre un pezzo
 *   nuovo: il primo risultato di «Basta ricaricare il file» e' «basta», e lei si
 *   fermava da sola. Ora una parola di stop che sta nella sua risposta e' eco;
 *   per fermarla restano le altre (se dice «basta», «ferma» la ferma ancora),
 *   il pulsante Ferma e il microfono;
 * - una domanda vera che riprende le sue parole («quanto ha raccolto Emmesse
 *   sulla rete a settembre», mentre lei dice di Emmesse sulla rete ad agosto) ha
 *   solo due parole nuove su sette, sotto la meta': non la fermava e andava
 *   persa. La sua eco non porta parole da domanda che lei non dice, l'utente si':
 *   con almeno due parole nuove e una di queste, e' lui.
 *
 * La verifica di quelle correzioni (12/10/2026):
 * - il riconoscimento capisce male anche lei, e spesso una sua parola diventa
 *   una parola da domanda che le somiglia: «quando» diventa «quanto», «poi»
 *   «puoi», «deve» «dove», il suo «cos'e'» si scrive «cosa e'». Con un'altra
 *   parola storpiata (il nome di un fornitore) erano due parole nuove, una da
 *   domanda: si fermava da sola e la sua frase partiva come domanda al modello.
 *   Ora una parola da domanda che differisce di una lettera da una parola che lei
 *   sta dicendo, e sta accanto a una delle parole che lei ha vicino a quella
 *   («quanto Irigom» per il suo «Quando Irigom»), non conta: e' la sua, capita
 *   male. Una domanda vera arriva lo stesso, con le altre parole nuove o con la
 *   meta';
 * - con «basta» nella sua risposta non la fermavano nemmeno «ok basta», «basta
 *   grazie», «basta cosi'»: la parola di stop era sua e la parola nuova una sola.
 *   Ora una frase di una o due parole con una parola di stop la ferma se c'e'
 *   almeno una parola che lei non dice; resta eco solo se e' tutta sua («basta»,
 *   «basta ricaricare»).
 */
export function eInterruzione(sentito, detto) {
  const p = paroleDi(sentito);
  if (!p.length) return false;
  // Le sue parole, ciascuna con quelle che le stanno accanto nella sua frase.
  const sue = paroleDi(detto);
  const vicine = new Map();
  sue.forEach((w, k) => {
    const v = vicine.get(w) || new Set();
    if (k > 0) v.add(sue[k - 1]);
    if (k + 1 < sue.length) v.add(sue[k + 1]);
    vicine.set(w, v);
  });
  const sua = (w) => vicine.has(w);
  // Un comando con una parola che lei non sta dicendo la ferma («ok basta»,
  // «basta grazie»); una parola di stop sua, con accanto una parola non finita o
  // capita male (il provvisorio «basta ricarica» della sua «Basta ricaricare»),
  // no: la ferma solo una parola di stop che lei non dice.
  if (p.some(w => PAROLE_STOP.includes(w)) && p.every(w => PAROLE_STOP.includes(w) || RIEMPITIVI.includes(w))
    && p.some(w => !sua(w))) return true;
  if (p.length <= 2 && p.some(w => PAROLE_STOP.includes(w) && !sua(w))) return true;
  const nuove = p.filter(w => !sua(w));
  if (nuove.length < 2) return false;
  if (nuove.length / p.length >= 0.5) return true;
  // Una sua parola capita male sta dove la dice lei: accanto alle parole che ha
  // vicino nella sua frase. «chi» pero' non si prende mai per il suo «che»: lei
  // dice «che ha raccolto» in quasi ogni risposta, e «chi ha raccolto di piu'»
  // e' la domanda piu' comune che le si fa sopra (verifica, 12/10/2026). Il
  // prezzo e' un'eco «chi» con un'altra parola storpiata, piu' rara.
  const capitaMale = (k) => p[k] !== 'chi' && [...vicine.keys()].some(s => unaLetteraDiversa(s, p[k])
    && (vicine.get(s).has(p[k - 1]) || vicine.get(s).has(p[k + 1])));
  return p.some((w, k) => !sua(w) && PAROLE_DOMANDA.includes(w) && !capitaMale(k));
}

const eCifra = (w) => /^\d+$/.test(w);

/**
 * La domanda sentita, senza la sua eco in testa e senza le parole di stop.
 *
 * La sua eco sono pezzi della frase che lei stava dicendo, nell'ordine in cui li
 * dice: si tolgono dalla testa solo pezzi di almeno due parole che lei dice una
 * dopo l'altra, almeno tre parole in tutto, oppure le sue parole subito prima di
 * un «basta» (sono quelle che il «basta» ha interrotto). Le sue parole sparse
 * restano, perche' sono la domanda che le riprende: prima si toglievano una per
 * una, e «Emmesse sulla rete a settembre quanto ha raccolto», detta mentre lei
 * diceva di Emmesse sulla rete ad agosto, partiva come «settembre quanto ha
 * raccolto», senza il fornitore e senza il canale (verifica, 12/10/2026). Anche
 * due parole sue di fila in testa restano («sulla rete quanto ha fatto Gatim»):
 * perdere il canale costa piu' che lasciare un pezzetto di eco.
 * Le cifre: il microfono le scrive in cifre e lei le dice in parole, quindi una
 * cifra sua si attacca alle sue parole vicine («412,30 tonnellate»). Una sua
 * parola di stop dentro la sua frase («la giacenza resta ferma») e' eco come le
 * altre; quella che non segue le sue parole e' il «basta» di chi la interrompe.
 */
export function togliEco(sentito, detto) {
  const sue = paroleDi(detto);
  const sua = new Set(sue);
  const coppie = new Set(sue.slice(1).map((w, k) => `${sue[k]} ${w}`));
  const eStop = (w) => PAROLE_STOP.includes(w);
  const diFila = (a, b) => coppie.has(`${a} ${b}`)
    || (sua.has(a) && sua.has(b) && (eCifra(a) || eCifra(b)) && !eStop(a) && !eStop(b));
  const pezzi = String(sentito || '').trim().split(/\s+/).filter(Boolean);
  // Le parole sentite, ciascuna col pezzo da cui viene («412,30» ne fa due).
  const p = [];
  const da = [];
  pezzi.forEach((t, k) => { for (const w of paroleDi(t)) { p.push(w); da.push(k); } });
  let i = 0;
  let tolte = 0;
  let fila = 0;
  while (i < p.length) {
    if (eStop(p[i])) { i++; tolte = i; fila = 0; continue; }
    if (!sua.has(p[i])) break;
    let j = i + 1;
    while (j < p.length && diFila(p[j - 1], p[j])) j++;
    if (j < p.length && eStop(p[j])) { i = j; tolte = i; fila = 0; continue; }
    if (j - i < 2) break;
    fila += j - i;
    i = j;
    if (fila >= 3) tolte = i;
  }
  if (tolte >= p.length) return '';
  if (!tolte) return pezzi.join(' ');
  // Si taglia fra un pezzo e l'altro; un pezzo con dentro una parola tolta e una
  // tenuta resta intero.
  const taglio = da[tolte] === da[tolte - 1] ? da[tolte - 1] : da[tolte - 1] + 1;
  return pezzi.slice(taglio).join(' ');
}

/** Vero se nella frase sentita ci sono solo parole di stop: non e' una domanda. */
export function soloStop(sentito) {
  const p = paroleDi(sentito);
  return p.length > 0 && p.every(w => PAROLE_STOP.includes(w));
}

/**
 * Vero se la frase sentita e' un comando per fermarla, non una domanda: solo
 * parole di stop, o una o due parole fra cui una di stop («ok basta», «basta
 * grazie», «basta cosi'»). Ora che queste la fermano anche quando lei dice
 * «basta» (verifica, 12/10/2026), non devono partire come domanda al modello.
 */
export function soloComando(sentito) {
  const p = paroleDi(sentito);
  return p.length > 0 && p.some(w => PAROLE_STOP.includes(w)) && p.every(w => PAROLE_STOP.includes(w) || RIEMPITIVI.includes(w));
}
