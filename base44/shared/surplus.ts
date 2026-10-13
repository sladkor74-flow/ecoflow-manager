// IL SURPLUS SULLE TARIFFE: QUANDO VALE, A CHI, QUANTO (13/10/2026).
//
// Richiesta dell'utente del 12/10/2026: accanto alle tariffe un eventuale
// surplus, «inteso sempre come €/t», con le sue date di inizio e fine
// validita', da dare ai fornitori quando il consorzio o un accordo commerciale
// lo dicono; in attiva come in passiva «una riga con l'importo standard ed una
// per il surplus (sempre riferito alle stesse tonnellate raccolte o trattate nel
// mese)». Il primo caso e' il Fuel Surcharge del consorzio Ecotyre, +5 €/t a
// tutti i raccoglitori dal 01/10/2026 al 31/12/2026, su rete, ACI ed extra
// raccolta, ognuno con la sua riga e mai sommati: SMOCO lo fattura a Ecotyre e
// lo paga ai raccoglitori.
//
// Il surplus e' un archivio a parte (SurplusTariffa, un record per canale), non
// un campo della Tariffa: vedi il commento dell'entita'. Qui stanno le regole,
// uguali per le funzioni (passiva, attiva, margine, salvataggio, EcoTyna) e per
// le pagine (colonna «Surplus» delle tariffe, scheda dei surplus, extra
// raccolta): quando vale, per chi, quanto fa una riga, cosa si controlla al
// salvataggio, quando due surplus sono lo stesso. Funzioni pure, senza tipi:
// lo specchio src/lib/surplus.js deve restare identico salvo questa
// intestazione e gli import (prove/specchi.mjs). Prove: prove/surplus.mjs.
import { giornoRoma, oggiRoma } from "./giornoItaliano.ts";
import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";
import { arrotondaAlCentesimo } from "./ecotyreTariffe.ts";
import { tariffaValeIl, tariffaNonDisattivata } from "./validitaTariffa.ts";

/** I canali di un surplus: uno per record, mai TUTTE (i canali non si sommano). */
export const CANALI_SURPLUS = ['RETE', 'ACI', 'EXTRA_RACCOLTA'];
/** Le prestazioni dei fornitori su cui si paga, come Tariffa.prestazione. */
export const PRESTAZIONI_SURPLUS = ['RACCOLTA', 'TRATTAMENTO', 'CONFERIMENTO_STOCCAGGIO', 'TRASPORTO_SECONDARIA'];
export const NOMI_ORIGINE = { CONSORZIO: 'consorzio Ecotyre', ACCORDO_COMMERCIALE: 'accordo commerciale' };
export const NOMI_CANALE = { RETE: 'Rete', ACI: 'ACI', EXTRA_RACCOLTA: 'Extra raccolta' };
export const NOMI_PRESTAZIONE = { RACCOLTA: 'raccolta', TRATTAMENTO: 'trattamento', CONFERIMENTO_STOCCAGGIO: 'stoccaggio', TRASPORTO_SECONDARIA: 'trasporto delle secondarie' };
/** Chi riceve il surplus di una prestazione, al plurale: «a tutti i raccoglitori». */
export const DESTINATARI = { RACCOLTA: 'raccoglitori', TRATTAMENTO: 'impianti', CONFERIMENTO_STOCCAGGIO: 'stoccaggi', TRASPORTO_SECONDARIA: 'trasportatori delle secondarie' };
/**
 * I destinatari con l'articolo giusto: «a tutti i raccoglitori», «a tutti gli
 * stoccaggi», «ai raccoglitori dell'elenco», «agli impianti dell'elenco».
 * Davanti a vocale o a s seguita da consonante l'articolo e' «gli» (13/10/2026).
 */
export function aiDestinatari(prestazione, aChi) {
  const chi = DESTINATARI[prestazione] || 'fornitori';
  const gli = /^([aeiou]|s[^aeiou]|z|gn|ps)/i.test(chi);
  return aChi === 'elenco' ? `${gli ? 'agli' : 'ai'} ${chi} dell'elenco` : `a tutti ${gli ? 'gli' : 'i'} ${chi}`;
}
// Le due soglie dei controlli. Sotto il centesimo non e' un importo; sopra 50 €/t
// e' piu' di un quarto di una tariffa (la raccolta va da 68 a 92 €/t, l'attiva
// 202): un avviso, perche' potrebbe essere il prezzo intero scritto nel posto
// sbagliato, ma non un errore.
export const MINIMO_EURO_T = 0.01;
export const SOGLIA_AVVISO_EURO_T = 50;

// Il canale e la prestazione scritti in un modo solo: «EXTRA RACCOLTA»,
// «extra_raccolta» ed «Extra-raccolta» sono lo stesso canale.
const codice = (v) => String(v || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
// Il nome del surplus come chiave: maiuscole, accenti, spazi e punteggiatura non
// contano («Fuel Surcharge» e «fuel  surcharge» sono lo stesso surplus).
const chiaveNome = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const giornoValido = (v) => {
  const g = String(v || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(g)) return '';
  const d = new Date(`${g}T12:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === g ? g : '';
};
// Il giorno di «oggi» passato da chi chiama: un giorno 'aaaa-mm-gg' resta
// quello, un istante si legge sul giorno italiano.
const giornoDi = (v) => giornoValido(/^\d{4}-\d{2}-\d{2}$/.test(String(v || '').trim()) ? v : '') || giornoRoma(v);
const dataIt = (v) => { const g = giornoValido(v); return g ? g.split('-').reverse().join('/') : ''; };
const aChi = (s) => (String((s && s.a_chi) || 'tutti').trim().toLowerCase() === 'elenco' ? 'elenco' : 'tutti');
const perNome = (a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'it')
  || String(a.data_inizio_validita || '').localeCompare(String(b.data_inizio_validita || ''))
  || String(a.id || '').localeCompare(String(b.id || ''));

/** Un importo in €/t all'italiana: «5,00 €/t», «2,125 €/t». Vuoto se non e' un numero. */
export function testoEuroT(v) {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  const [intero, decimali] = Math.abs(n).toFixed(3).split('.');
  const dec = decimali.endsWith('0') ? decimali.slice(0, 2) : decimali;
  return `${n < 0 ? '-' : ''}${intero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec} €/t`;
}

/** Vale quel giorno: la regola delle tariffe (non_attivo mai, estremi compresi, giorno italiano). */
export const surplusValeIl = (s, quando) => tariffaValeIl(s, quando);

/** I surplus che possono valere in almeno un giorno: tutti tranne i disattivati. */
export const surplusNonDisattivati = (surplusAll) => (surplusAll || []).filter(tariffaNonDisattivata);

/**
 * L'importo in €/t di un surplus in una direzione: 'PASSIVA' (quanto SMOCO paga
 * al fornitore, euro_t_passiva) o 'ATTIVA' (quanto fattura a Ecotyre,
 * euro_t_attiva). null se non c'e': un importo vuoto vuol dire che in quella
 * direzione il surplus non si paga, e uno zero o un negativo non e' un surplus.
 */
export function euroTDi(s, direzione = 'PASSIVA') {
  const attiva = String(direzione || '').trim().toUpperCase() === 'ATTIVA';
  const v = s ? (attiva ? s.euro_t_attiva : s.euro_t_passiva) : null;
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// L'elenco dei fornitori com'e' scritto, qualunque sia a_chi: [{ id, nome }], o
// null se il JSON non si legge.
function leggiElenco(json) {
  let elenco = json;
  if (elenco === null || elenco === undefined || elenco === '') return [];
  if (typeof elenco === 'string') {
    try { elenco = JSON.parse(elenco); } catch { return null; }
  }
  if (!Array.isArray(elenco)) return null;
  return elenco
    .map(f => (typeof f === 'string' ? { id: '', nome: f.trim() } : { id: String((f && f.id) || '').trim(), nome: String((f && f.nome) || '').trim() }))
    .filter(f => f.id || f.nome);
}

/** [{ id, nome }] dell'elenco; [] con a_chi 'tutti' o JSON illeggibile. */
export function fornitoriDelSurplus(s) {
  if (!s || aChi(s) !== 'elenco') return [];
  return leggiElenco(s.fornitori_json) || [];
}

/**
 * Vero se il surplus vale per quel fornitore: tutti, oppure id o nome
 * normalizzato di uno qualunque dei nomi dati (fatturante, raccoglitore del
 * movimento). Come per le tariffe, «GATIM» e «GATIM S.R.L.» sono lo stesso
 * fornitore. Un elenco vuoto non vale per nessuno: «solo questi» senza nomi non
 * e' «tutti», e il salvataggio lo rifiuta.
 */
export function valePerFornitore(s, fornitore = {}) {
  const { id = '', nomi = [] } = fornitore || {};
  if (!s) return false;
  if (aChi(s) !== 'elenco') return true;
  const elenco = fornitoriDelSurplus(s);
  if (!elenco.length) return false;
  const suo = String(id || '').trim();
  const chiavi = [].concat(nomi || []).map(n => normalizzaRagioneSociale(String(n || ''))).filter(Boolean);
  return elenco.some(f => (suo && f.id && f.id === suo) || (!!f.nome && chiavi.includes(normalizzaRagioneSociale(f.nome))));
}

/**
 * I surplus che valgono per un movimento, in una direzione.
 *
 * dove: { tipologia, prestazione, quando, fornitore: { id, nomi } }
 * - tipologia: il canale del movimento (RETE, ACI, EXTRA_RACCOLTA);
 * - quando: trasporto_finito_il, letto sul giorno italiano (la prima regola
 *   assoluta: mai ordine_chiuso_il);
 * - prestazione: nella PASSIVA e' obbligatoria (quella del blocco: un surplus di
 *   raccolta non si paga sullo stoccaggio). Nell'ATTIVA si puo' lasciare vuota:
 *   la parte attiva vale sulle tonnellate fatturate del canale qualunque sia la
 *   prestazione, tranne il trasporto delle secondarie, che a Ecotyre non si
 *   fattura;
 * - fornitore: chi fattura la riga (dopo la catena dei subfornitori) e i nomi con
 *   cui il movimento lo porta. Nell'ATTIVA con un surplus «solo questi» il
 *   fornitore dipende dalla prestazione del surplus (il raccoglitore per la
 *   raccolta, la destinazione per trattamento e stoccaggio): chi chiama puo'
 *   passare anche fornitori: { RACCOLTA: {...}, TRATTAMENTO: {...},
 *   CONFERIMENTO_STOCCAGGIO: {...} }, che vale prima di fornitore.
 *
 * Un fornitore interno (SMOCO) non riceve il surplus passivo: lo decide chi
 * calcola, che sa chi e' interno.
 *
 * direzione: 'PASSIVA' (euro_t_passiva) o 'ATTIVA' (euro_t_attiva).
 * -> [{ surplus, euro_t }] ordinati per nome, poi per data di inizio
 */
export function surplusDelMovimento(surplusAll, dove, direzione = 'PASSIVA') {
  const d = dove || {};
  const attiva = String(direzione || '').trim().toUpperCase() === 'ATTIVA';
  const canale = codice(d.tipologia);
  const prestazione = codice(d.prestazione);
  if (!canale || (!attiva && !prestazione)) return [];
  const trovati = [];
  for (const s of surplusAll || []) {
    if (!s || codice(s.tipologia) !== canale) continue;
    const sua = codice(s.prestazione);
    if (prestazione && sua !== prestazione) continue;
    if (attiva && sua === 'TRASPORTO_SECONDARIA') continue;
    const euro_t = euroTDi(s, attiva ? 'ATTIVA' : 'PASSIVA');
    if (euro_t === null) continue;
    if (!surplusValeIl(s, d.quando)) continue;
    const chi = (d.fornitori && d.fornitori[sua]) || d.fornitore || {};
    if (!valePerFornitore(s, chi)) continue;
    trovati.push({ surplus: s, euro_t });
  }
  return trovati.sort((a, b) => perNome(a.surplus, b.surplus));
}

/**
 * L'importo di una riga di surplus: chili per €/t, diviso mille, al centesimo
 * come lo fa Excel (arrotondaAlCentesimo). E' la riga che il fornitore scrive in
 * fattura (t x €/t), e che il foglio rifa' con =ROUND(t*p;2): 103 kg a 85 €/t
 * fanno 8,76, non 8,75. Si arrotonda una volta sola, sui chili del fornitore (o
 * del canale) nel mese: arrotondare formulario per formulario sbaglia il
 * centesimo (sui dati veri di settembre 2026 la rete farebbe 5.601,21 invece di
 * 5.601,20).
 */
export const importoSurplus = (kg, euroT) => arrotondaAlCentesimo((Number(kg) || 0) * (Number(euroT) || 0) / 1000);

/**
 * I controlli al salvataggio di un surplus (un record, un canale).
 * -> [{ gravita: 'errore'|'avviso', campo, messaggio }]: campo e' il campo che
 * li causa, perche' la pagina li mostri sotto quello; i messaggi sono a video.
 *
 * Le regole: un canale per record; la prestazione dei fornitori; «solo questi»
 * con almeno un fornitore, «tutti» senza elenco; almeno un importo, ciascuno
 * almeno di un centesimo (sopra 50 €/t un avviso); il trasporto delle secondarie
 * senza parte attiva, perche' a Ecotyre non si fattura; le due date, la fine non
 * prima dell'inizio e non oltre il 31/12 dell'anno di inizio (i contratti, con
 * Ecotyre e coi fornitori, sono annuali senza tacito rinnovo: un surplus che
 * continua l'anno dopo si riscrive col contratto nuovo).
 */
export function controlliSurplus(nuovo) {
  const s = nuovo || {};
  const esiti = [];
  const errore = (campo, messaggio) => esiti.push({ gravita: 'errore', campo, messaggio });
  const avviso = (campo, messaggio) => esiti.push({ gravita: 'avviso', campo, messaggio });

  if (!String(s.nome || '').trim()) errore('nome', 'Manca il nome: è la descrizione della riga in fattura, per esempio «Fuel Surcharge».');
  if (!NOMI_ORIGINE[codice(s.origine)]) errore('origine', 'Scegli da dove viene il surplus: consorzio Ecotyre o accordo commerciale.');

  const canale = codice(s.tipologia);
  if (canale === 'TUTTE') errore('tipologia', 'Un surplus vale per un canale solo: scegli Rete, ACI o Extra raccolta. Per più canali si salva un surplus per canale, con lo stesso nome.');
  else if (!CANALI_SURPLUS.includes(canale)) errore('tipologia', 'Scegli il canale: Rete, ACI o Extra raccolta.');

  const prestazione = codice(s.prestazione);
  if (!PRESTAZIONI_SURPLUS.includes(prestazione)) errore('prestazione', 'Scegli la prestazione su cui si paga: raccolta, trattamento, stoccaggio o trasporto delle secondarie.');

  const chi = String(s.a_chi || 'tutti').trim().toLowerCase();
  const elenco = leggiElenco(s.fornitori_json);
  if (chi !== 'tutti' && chi !== 'elenco') errore('a_chi', 'Scegli a chi vale: a tutti i fornitori della prestazione o solo a quelli dell\'elenco.');
  else if (chi === 'elenco' && elenco === null) errore('fornitori_json', 'L\'elenco dei fornitori non si legge: scegli di nuovo i fornitori.');
  else if (chi === 'elenco' && !elenco.length) errore('fornitori_json', 'Hai scelto «solo questi fornitori» ma l\'elenco è vuoto: aggiungi almeno un fornitore, o scegli «tutti».');
  else if (chi === 'tutti' && elenco && elenco.length) errore('fornitori_json', 'Hai scelto «tutti» ma c\'è un elenco di fornitori: scegli «solo questi fornitori», o togli l\'elenco.');

  const IMPORTI = [
    ['euro_t_passiva', 'Il surplus ai fornitori', 'se SMOCO non paga niente ai fornitori, lascia vuoto'],
    ['euro_t_attiva', 'Il surplus da Ecotyre', 'se Ecotyre non lo paga, lascia vuoto'],
  ];
  let importi = 0;
  for (const [campo, nome, vuoto] of IMPORTI) {
    const v = s[campo];
    if (v === null || v === undefined || v === '') continue;
    importi++;
    const n = Number(v);
    if (!Number.isFinite(n)) errore(campo, `${nome} («${String(v)}») non è un numero: scrivilo in €/t, per esempio 5,00.`);
    else if (n < MINIMO_EURO_T) errore(campo, `${nome} dev'essere almeno 0,01 €/t: ${vuoto}.`);
    else if (n > SOGLIA_AVVISO_EURO_T) avviso(campo, `${nome} è ${testoEuroT(n)}: è più di un quarto di una tariffa. Controlla che sia il surplus e non il prezzo intero.`);
  }
  if (!importi) errore('euro_t_passiva', 'Scrivi almeno un importo: quanto si paga in più ai fornitori, quanto si fattura in più a Ecotyre, o tutti e due.');
  const attivo = s.euro_t_attiva !== null && s.euro_t_attiva !== undefined && s.euro_t_attiva !== '';
  if (prestazione === 'TRASPORTO_SECONDARIA' && attivo) {
    errore('euro_t_attiva', 'Il trasporto delle secondarie non si fattura a Ecotyre: questo surplus ha solo la parte ai fornitori. Lascia vuoto l\'importo da Ecotyre.');
  }

  const inizio = giornoValido(s.data_inizio_validita);
  const fine = giornoValido(s.data_fine_validita);
  const anno = inizio ? inizio.slice(0, 4) : '';
  if (!String(s.data_inizio_validita || '').trim()) errore('data_inizio_validita', 'Manca la data di inizio validità.');
  else if (!inizio) errore('data_inizio_validita', 'La data di inizio validità non è una data.');
  if (!String(s.data_fine_validita || '').trim()) {
    errore('data_fine_validita', `Manca la data di fine validità: un surplus vale dentro un anno di contratto${anno ? `, al più fino al 31/12/${anno}` : ''}.`);
  } else if (!fine) errore('data_fine_validita', 'La data di fine validità non è una data.');
  else if (inizio && fine < inizio) errore('data_fine_validita', `La fine validità (${dataIt(fine)}) viene prima dell'inizio (${dataIt(inizio)}).`);
  else if (inizio && fine.slice(0, 4) !== anno) {
    errore('data_fine_validita', `Il surplus comincia nel ${anno} e finirebbe il ${dataIt(fine)}: i contratti sono annuali, quindi al più fino al 31/12/${anno}. Per l'anno dopo si scrive un surplus nuovo, col contratto nuovo.`);
  }
  return esiti;
}

// Due periodi si sovrappongono, sui giorni ('aaaa-mm-gg'); un estremo che manca
// e' aperto.
const sovrapposti = (i1, f1, i2, f2) => (!i1 || !f2 || i1 <= f2) && (!i2 || !f1 || i2 <= f1);

// Due surplus hanno almeno un fornitore in comune: «tutti» si sovrappone con
// tutto, due elenchi se hanno un fornitore con lo stesso id o lo stesso nome
// normalizzato.
function fornitoriInComune(a, b) {
  if (aChi(a) !== 'elenco' || aChi(b) !== 'elenco') return true;
  const eb = fornitoriDelSurplus(b);
  return fornitoriDelSurplus(a).some(f => eb.some(g => (f.id && f.id === g.id)
    || (!!f.nome && normalizzaRagioneSociale(f.nome) === normalizzaRagioneSociale(g.nome))));
}

// Il nuovo copre tutti i fornitori di quello che c'e': e' «tutti», oppure ogni
// fornitore dell'elenco vecchio sta anche nel nuovo. Solo allora chiudere il
// vecchio non toglie il surplus a nessuno.
function copreIFornitori(nuovo, vecchio) {
  if (aChi(nuovo) !== 'elenco') return true;
  if (aChi(vecchio) !== 'elenco') return false;
  const suoi = fornitoriDelSurplus(nuovo);
  return fornitoriDelSurplus(vecchio).every(f => suoi.some(g => (f.id && f.id === g.id)
    || (!!f.nome && normalizzaRagioneSociale(f.nome) === normalizzaRagioneSociale(g.nome))));
}

// Si pagano sulle stesse tonnellate: nella passiva se hanno la stessa
// prestazione, l'importo ai fornitori tutti e due e un fornitore in comune;
// nell'attiva se hanno tutti e due l'importo da Ecotyre e un fornitore in comune
// (con «tutti» la parte attiva e' su tutto il canale, qualunque sia la
// prestazione).
const sulleStesseTonnellate = (a, b) => fornitoriInComune(a, b) && (
  (codice(a.prestazione) === codice(b.prestazione) && euroTDi(a, 'PASSIVA') !== null && euroTDi(b, 'PASSIVA') !== null)
  || (euroTDi(a, 'ATTIVA') !== null && euroTDi(b, 'ATTIVA') !== null));

/**
 * I surplus esistenti con cui uno nuovo (o modificato) si scontra, come
 * conflittiTariffa: { conflitti, chiudibili, avvisi }.
 *
 * Considera solo i surplus dello stesso canale, non disattivati, con giorni in
 * comune. Fra questi:
 * - LO STESSO SURPLUS DUE VOLTE (stesso nome normalizzato, stessa prestazione e
 *   un fornitore in comune; oppure stesso nome e la parte attiva tutti e due)
 *   si pagherebbe due volte: e' un conflitto, e il salvataggio risponde 409.
 *   Se pero' quello esistente comincia prima del nuovo, non finisce dopo, ha la
 *   stessa prestazione e il nuovo copre tutti i suoi fornitori, e' chiudibile:
 *   e' il cambio d'importo da una certa data, come per le tariffe, e chi salva
 *   lo chiude il giorno prima dell'inizio del nuovo (giornoPrimaDi). Altrimenti
 *   resta un conflitto: chiuderlo toglierebbe il surplus ai giorni dopo il nuovo,
 *   o ai fornitori che il nuovo non ha.
 * - DUE SURPLUS DIVERSI (nomi diversi) sulle stesse tonnellate si pagano tutti e
 *   due, ognuno con la sua riga (il Fuel Surcharge e un accordo commerciale con
 *   un fornitore): e' ammesso, ma si dice. avvisi: [{ gravita: 'avviso', campo,
 *   messaggio, surplus }], nella forma di controlliSurplus.
 * @param idEscluso l'id del surplus che si sta modificando, da non confrontare con se stesso
 */
export function conflittiSurplus(nuovo, esistenti, idEscluso = null) {
  const conflitti = [];
  const chiudibili = [];
  const avvisi = [];
  if (!nuovo) return { conflitti, chiudibili, avvisi };
  const canale = codice(nuovo.tipologia);
  const nome = chiaveNome(nuovo.nome);
  const inizio = giornoValido(nuovo.data_inizio_validita);
  const fine = giornoValido(nuovo.data_fine_validita);
  for (const t of esistenti || []) {
    if (!t || (idEscluso && t.id === idEscluso)) continue;
    if (!tariffaNonDisattivata(t)) continue;
    if (codice(t.tipologia) !== canale) continue;
    const suoInizio = giornoValido(t.data_inizio_validita);
    const suaFine = giornoValido(t.data_fine_validita);
    if (!sovrapposti(inizio, fine, suoInizio, suaFine)) continue;
    if (nome && chiaveNome(t.nome) === nome) {
      const stessaPrestazione = codice(t.prestazione) === codice(nuovo.prestazione) && fornitoriInComune(nuovo, t);
      const dueVolteAttivo = euroTDi(t, 'ATTIVA') !== null && euroTDi(nuovo, 'ATTIVA') !== null && fornitoriInComune(nuovo, t);
      if (!stessaPrestazione && !dueVolteAttivo) continue;
      const dopo = inizio && suoInizio && suoInizio < inizio && (!suaFine || (fine && suaFine <= fine));
      if (dopo && codice(t.prestazione) === codice(nuovo.prestazione) && copreIFornitori(nuovo, t)) chiudibili.push(t);
      else conflitti.push(t);
      continue;
    }
    if (!sulleStesseTonnellate(nuovo, t)) continue;
    avvisi.push({
      gravita: 'avviso',
      campo: 'nome',
      messaggio: `Negli stessi giorni vale anche ${etichettaSurplus(t)}: si applicano tutti e due, ognuno con la sua riga.`,
      surplus: t,
    });
  }
  return { conflitti, chiudibili, avvisi };
}

/** Il giorno prima di un giorno 'aaaa-mm-gg' (la fine di un surplus chiudibile); vuoto se non e' un giorno. */
export function giornoPrimaDi(giorno) {
  const g = giornoValido(giorno);
  if (!g) return '';
  const d = new Date(`${g}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Un giorno come lo confrontano le tariffe (validitaTariffa.ts, tariffaValeIl):
// i primi dieci caratteri, come testo; vuoto solo se manca davvero. Chi calcola
// un mese ne scrive la fine '${anno}-${mm}-31' anche nei mesi di 30 giorni
// (passivaCalcolo e attivaCalcolo per disattivateNelPeriodo): come testo
// '2026-09-31' resta la fine di settembre. Letto come data di calendario non e'
// un giorno, diventava un estremo aperto, e a settembre risultava gia' in corso
// il Fuel Surcharge che comincia il 01/10 (revisione del surplus, 13/10/2026).
const giornoTesto = (v) => String(v || '').trim().slice(0, 10);

/**
 * Vero se il surplus (non disattivato) ha almeno un giorno fra dal e al
 * ('aaaa-mm-gg', compresi). I giorni si confrontano come testo, come per le
 * tariffe: '2026-09-31' vale come l'ultimo giorno di settembre, e solo un
 * estremo vuoto e' aperto.
 */
export const surplusTocca = (s, dal, al) => tariffaNonDisattivata(s)
  && sovrapposti(giornoTesto(s.data_inizio_validita), giornoTesto(s.data_fine_validita), giornoTesto(dal), giornoTesto(al));

/** I surplus non disattivati che hanno almeno un giorno nel periodo: un mese, per chi lo calcola (la fine '-31' vale per ogni mese). */
export const surplusNelPeriodo = (surplusAll, dal, al) => (surplusAll || []).filter(s => !!s && surplusTocca(s, dal, al)).sort(perNome);

/**
 * I mesi che il periodo di un surplus tocca, [{ anno, mese }] con mese da 1 a
 * 12: servono a dire, al salvataggio, quali mesi gia' chiusi (attiva fatturata,
 * passiva congelata) il surplus riguarda. [] se mancano le date.
 */
export function mesiDelSurplus(s) {
  const dal = giornoValido(s && s.data_inizio_validita);
  const al = giornoValido(s && s.data_fine_validita);
  if (!dal || !al || al < dal) return [];
  const mesi = [];
  let anno = Number(dal.slice(0, 4));
  let mese = Number(dal.slice(5, 7));
  const ultimo = Number(al.slice(0, 4)) * 12 + Number(al.slice(5, 7));
  while (anno * 12 + mese <= ultimo) {
    mesi.push({ anno, mese });
    mese++;
    if (mese > 12) { mese = 1; anno++; }
  }
  return mesi;
}

/**
 * La colonna «Surplus» della pagina delle tariffe: che cosa vale oggi su quella
 * tariffa e che cosa arriva.
 *
 * Passiva: stesso canale (una tariffa TUTTE guarda rete e ACI), stessa
 * prestazione, fornitore della tariffa in elenco o «tutti», importo ai
 * fornitori. Attiva: stesso canale, importo da Ecotyre, qualunque prestazione
 * tranne il trasporto delle secondarie. Contano solo i surplus con giorni in
 * comune con la validita' della tariffa (una tariffa del 2026 non mostra un
 * surplus del 2027), e niente su una tariffa disattivata. I record dello stesso
 * surplus su piu' canali con lo stesso importo si dicono una volta (tipologie).
 *
 * -> { oggi: [{ id, gruppo, nome, origine, riferimento, euro_t, dal, al, a_chi, tipologie }],
 *      in_arrivo: [ ...stessa forma ] }
 *    origine e' gia' a parole («consorzio Ecotyre»); dal e al 'aaaa-mm-gg'.
 */
export function surplusDellaTariffa(tariffa, surplusAll, oggi = null) {
  const risposta = { oggi: [], in_arrivo: [] };
  if (!tariffa || !tariffaNonDisattivata(tariffa)) return risposta;
  const giorno = (oggi && giornoDi(oggi)) || oggiRoma();
  const attiva = String(tariffa.direzione || 'PASSIVA').trim().toUpperCase() === 'ATTIVA';
  const suo = codice(tariffa.tipologia);
  const canali = suo === 'TUTTE' ? ['RETE', 'ACI'] : [suo];
  const tInizio = giornoValido(tariffa.data_inizio_validita);
  const tFine = giornoValido(tariffa.data_fine_validita);
  const voci = new Map();
  for (const s of surplusAll || []) {
    if (!s || !tariffaNonDisattivata(s)) continue;
    const canale = codice(s.tipologia);
    if (!canali.includes(canale)) continue;
    const euro_t = euroTDi(s, attiva ? 'ATTIVA' : 'PASSIVA');
    if (euro_t === null) continue;
    const prestazione = codice(s.prestazione);
    if (attiva && prestazione === 'TRASPORTO_SECONDARIA') continue;
    if (!attiva && (prestazione !== codice(tariffa.prestazione)
      || !valePerFornitore(s, { id: tariffa.fornitore_id, nomi: [tariffa.fornitore_nome] }))) continue;
    const dal = giornoValido(s.data_inizio_validita);
    const al = giornoValido(s.data_fine_validita);
    if (!sovrapposti(dal, al, tInizio, tFine)) continue;
    if (al && al < giorno) continue;
    const quando = dal && dal > giorno ? 'in_arrivo' : 'oggi';
    const chiave = [quando, s.gruppo || chiaveNome(s.nome), euro_t, dal, al].join('|');
    const gia = voci.get(chiave);
    if (gia) { if (!gia.voce.tipologie.includes(canale)) gia.voce.tipologie.push(canale); continue; }
    voci.set(chiave, {
      quando,
      voce: {
        id: s.id || '', gruppo: s.gruppo || '', nome: String(s.nome || '').trim(),
        origine: NOMI_ORIGINE[codice(s.origine)] || '', riferimento: String(s.riferimento || '').trim(),
        euro_t, dal, al, a_chi: aChi(s), tipologie: [canale],
      },
    });
  }
  for (const { quando, voce } of voci.values()) risposta[quando].push(voce);
  risposta.oggi.sort((a, b) => a.nome.localeCompare(b.nome, 'it') || a.dal.localeCompare(b.dal));
  risposta.in_arrivo.sort((a, b) => a.dal.localeCompare(b.dal) || a.nome.localeCompare(b.nome, 'it'));
  return risposta;
}

/** 'in_corso' | 'in_arrivo' | 'concluso' | 'disattivato', sul giorno italiano. */
export function statoSurplus(s, oggi = null) {
  if (!s || !tariffaNonDisattivata(s)) return 'disattivato';
  const giorno = (oggi && giornoDi(oggi)) || oggiRoma();
  const dal = giornoValido(s.data_inizio_validita);
  const al = giornoValido(s.data_fine_validita);
  if (dal && dal > giorno) return 'in_arrivo';
  if (al && al < giorno) return 'concluso';
  return 'in_corso';
}

/** Il periodo a parole, all'italiana: «dal 01/10/2026 al 31/12/2026». */
export function periodoSurplus(s) {
  const dal = dataIt(s && s.data_inizio_validita);
  const al = dataIt(s && s.data_fine_validita);
  if (dal && al) return `dal ${dal} al ${al}`;
  if (dal) return `dal ${dal}`;
  if (al) return `fino al ${al}`;
  return '';
}

/** «Fuel Surcharge (consorzio Ecotyre), dal 01/10/2026 al 31/12/2026»: per note e fogli, all'italiana. */
export function etichettaSurplus(s) {
  if (!s) return '';
  const nome = String(s.nome || '').trim() || 'Surplus';
  const origine = NOMI_ORIGINE[codice(s.origine)] || '';
  const periodo = periodoSurplus(s);
  return `${nome}${origine ? ` (${origine})` : ''}${periodo ? `, ${periodo}` : ''}`;
}
