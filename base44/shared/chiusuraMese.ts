// LA CHIUSURA DEL MESE, PASSO PASSO, MISURATA SUI FATTI (migliorie dell'11/10/2026).
//
// Il lavoro di fine mese e' sparso in sette posti: Caricamento Dati, i
// Terminati, Dichiarazioni Impianti con la pratica di Irigom, la fatturazione
// attiva (prefattura ed esportazioni), la passiva (congelamento), i consuntivi
// in Verifiche Fornitori, la Quadratura FIR in Verifiche. Fino all'11/10/2026
// la dashboard ne seguiva un pezzo solo, i mesi dell'attiva, e in nessun punto
// si leggeva che un mese e' chiuso ne' che cosa gli manca.
//
// Qui c'e' la lista di controllo del mese, sul modello della scheda «Nuovo
// anno» (inizializzazioneAnno.ts): ogni passo ha il suo stato (fatto, da fare,
// non serve), perche' serve e dove si rimedia. Si misura sui fatti: ogni passo
// legge lo stato che il suo modulo scrive gia' - DocumentoFatturazione,
// EsportazioneFatturazione, PrefatturaEcotyre, ChiusuraPassivaMese,
// ConsuntivoFornitore, QuadraturaFir, DichiarazioneSito, PraticaIrigom, la
// fotografia del guardiano notturno, gli alert delle date - e non ricalcola
// nessun conto: un terzo posto che rifa' un conto da' una terza risposta.
//
// Funzioni pure: ricevono gli elenchi gia' letti (la funzione
// statoChiusuraMese). Rete, ACI ed extra raccolta hanno ciascuno il suo passo,
// mai sommati; e di qui non esce nessun importo, perche' il pannello lo vede
// anche chi non e' amministratore (i costi dei fornitori sono suoi).
import { giornoRoma } from "./giornoItaliano.ts";
import { scadenzaRegistrazione } from "./termineRegistrazione.ts";
import { giornoMovimento, settimanaIso, annoSettimanaIso, riepilogoEseguiti } from "./movimenti.ts";
import { eAci } from "./canaleSecondaria.ts";
import { leggiDichiarazioni, chiaveDichiarazione, statoDichiarazione } from "./dichiarazioniImpianti.ts";
import { formatoTonnellate, formatoKg } from "./formato.ts";
import { eAlertDate } from "./cruscotto.ts";
import { nomeArchivio } from "./registroCaricamenti.ts";
import { giorniFa } from "./indicatoriGiorno.ts";
import { filtraPeriodo } from "./filtroPeriodo.ts";
import { eSecondariaExtra } from "./ecotyreTariffe.ts";

export const MESI_CHIUSURA = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
export const CANALI_CHIUSURA = ['RETE', 'ACI', 'EXTRA_RACCOLTA'];
// I canali come si scrivono dentro una frase.
export const NOMI_CANALI_CHIUSURA = { RETE: 'rete', ACI: 'ACI', EXTRA_RACCOLTA: 'extra raccolta' };
const TITOLI_CANALI = { RETE: 'Rete', ACI: 'ACI', EXTRA_RACCOLTA: 'Extra raccolta' };
export const STATI_PASSO = ['fatto', 'da_fare', 'non_serve'];

const pad = (n) => String(n).padStart(2, '0');
const it = (g) => (g ? `${String(g).slice(8, 10)}/${String(g).slice(5, 7)}/${String(g).slice(0, 4)}` : '—');
// Un istante del server puo' arrivare senza la Z finale: e' UTC lo stesso.
const conZ = (v) => (v && /T\d/.test(String(v)) && !/(Z|[+-]\d{2}:?\d{2})$/i.test(String(v)) ? `${v}Z` : v);
const giornoDi = (v) => (v ? giornoRoma(conZ(v)) || String(v).slice(0, 10) : '');
const indiceMese = (anno, idx) => Number(anno) * 12 + Number(idx);
const minuscolo = (s) => String(s || '').toLowerCase();
// «a settembre», «ad agosto».
const aMese = (m) => (/^a/i.test(m) ? `ad ${minuscolo(m)}` : `a ${minuscolo(m)}`);

/** Un elenco come si dice: «a, b e c», «ACI ed extra raccolta». */
export function elenco(parti) {
  const v = (parti || []).filter(Boolean);
  if (v.length <= 1) return v.join('');
  const ultimo = v[v.length - 1];
  return `${v.slice(0, -1).join(', ')} ${/^[eE]/.test(ultimo) ? 'ed' : 'e'} ${ultimo}`;
}

/** Il mese come lo usano i passi: nome, numero 1-12, primo e ultimo giorno. */
export function periodoDelMese(anno, meseIdx) {
  const a = Number(anno);
  const i = Number(meseIdx);
  const giorni = new Date(Date.UTC(a, i + 1, 0)).getUTCDate();
  return {
    anno: a, mese_idx: i, mese: MESI_CHIUSURA[i], numero: i + 1,
    etichetta: `${MESI_CHIUSURA[i]} ${a}`,
    inizio: `${a}-${pad(i + 1)}-01`, fine: `${a}-${pad(i + 1)}-${pad(giorni)}`,
  };
}

/**
 * L'ULTIMO MESE FINITO, SUL GIORNO ITALIANO. A gennaio e' il dicembre
 * dell'anno prima: e' il mese che si chiude proprio allora, e statoMesiAttiva
 * (cruscotto.ts) fino all'11/10/2026 lo perdeva, perche' contava mese - 2
 * sull'anno in corso e il 15 gennaio restava senza mesi.
 */
export function ultimoMeseFinito(oggi) {
  const a = Number(String(oggi).slice(0, 4));
  const m = Number(String(oggi).slice(5, 7)) - 1;
  return m === 0 ? periodoDelMese(a - 1, 11) : periodoDelMese(a, m - 1);
}

// Il mese chiesto: il nome ('Settembre') o il numero (9). null se non chiesto,
// undefined se non si riconosce.
const meseDa = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (Number.isInteger(n) && n >= 1 && n <= 12) return n - 1;
  const i = MESI_CHIUSURA.findIndex(m => minuscolo(m) === minuscolo(String(v).trim()));
  return i >= 0 ? i : undefined;
};

/**
 * Quale mese guardare. Senza mese: l'ultimo finito dell'anno scelto (per l'anno
 * in corso quello di oggi, per un anno passato il suo dicembre). Un anno che non
 * ha ancora un mese finito non ha niente da chiudere; un mese non ancora finito
 * non si chiude. Risponde { periodo, ultimo } oppure { errore } o { perche }.
 */
export function meseDaChiudere({ oggi, anno = null, mese = null } = {}) {
  const ultimoFinito = ultimoMeseFinito(oggi);
  const annoOggi = Number(String(oggi).slice(0, 4));
  const annoChiesto = Number(anno) || null;
  if (annoChiesto && annoChiesto > annoOggi) return { periodo: null, ultimo: null, perche: `Il ${annoChiesto} non ha ancora un mese finito.` };
  const ultimo = !annoChiesto || annoChiesto === annoOggi ? ultimoFinito : periodoDelMese(annoChiesto, 11);
  const idx = meseDa(mese);
  if (idx === undefined) return { errore: `Mese non riconosciuto: ${mese}.` };
  if (idx === null) return { periodo: ultimo, ultimo };
  if (!annoChiesto) return { errore: "Per guardare un mese preciso serve anche l'anno." };
  const periodo = periodoDelMese(annoChiesto, idx);
  if (indiceMese(periodo.anno, periodo.mese_idx) > indiceMese(ultimoFinito.anno, ultimoFinito.mese_idx)) {
    return { errore: `${periodo.etichetta} non è ancora finito: si chiude dal 1° del mese dopo.` };
  }
  return { periodo, ultimo };
}

/**
 * LE SETTIMANE DI UN MESE, COME LE NUMERA LA QUADRATURA FIR: ISO, lunedi'-
 * domenica, e ferme ai confini dell'anno come intervalloSettimana
 * (reportSettimanali.ts). Una settimana a cavallo di due mesi sta in tutti e
 * due: ha giorni dell'uno e dell'altro. I giorni che la numerazione ISO da' a
 * un altro anno (il 29-31 dicembre 2025 sono la settimana 1 del 2026, l'1-3
 * gennaio 2027 la 53 del 2026) non stanno in nessuna quadratura, perche' la
 * settimana si ferma al 31/12 o parte dall'1/1: non si chiedono.
 */
export function settimaneDelMese(periodo) {
  const out = [];
  const giorni = Number(periodo.fine.slice(8, 10));
  for (let g = 1; g <= giorni; g++) {
    const giorno = `${periodo.anno}-${pad(periodo.numero)}-${pad(g)}`;
    if (annoSettimanaIso(giorno) !== periodo.anno) continue;
    const s = settimanaIso(giorno);
    const gia = out.find(x => x.settimana === s);
    if (gia) { gia.al = giorno; continue; }
    // Il lunedi' e la domenica della settimana, fermi all'anno.
    const d = new Date(Date.UTC(periodo.anno, periodo.mese_idx, g));
    const lun = new Date(d); lun.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    const dom = new Date(lun); dom.setUTCDate(lun.getUTCDate() + 6);
    const lunedi = lun.toISOString().slice(0, 10), domenica = dom.toISOString().slice(0, 10);
    out.push({
      anno: periodo.anno, settimana: s, dal: giorno, al: giorno,
      lunedi: lunedi < `${periodo.anno}-01-01` ? `${periodo.anno}-01-01` : lunedi,
      domenica: domenica > `${periodo.anno}-12-31` ? `${periodo.anno}-12-31` : domenica,
    });
  }
  return out;
}

// I collegamenti portano il periodo: le pagine leggono ?tab= dove c'e', e il
// resto (anno, mese, canale) quando lo sapranno leggere. Senza, si apre il modulo.
const conPeriodo = (base, tab, periodo, canale = '') => `${base}?tab=${tab}&anno=${periodo.anno}&mese=${periodo.mese}${canale ? `&canale=${canale}` : ''}`;

const nuovoPasso = (chiave, titolo, perche, link, canale = null) => ({
  chiave, titolo, canale, perche, link,
  stato: 'da_fare', dettaglio: '', voci: [], manca: null, dal: null,
});
const voce = (stato, testo, link = '') => ({ stato, testo, ...(link ? { link } : {}) });

// === 1. I dati del mese ===

// I file che leggono attiva e passiva del mese (TIPI_PASSIVA): le primarie,
// con rete e ACI, e le secondarie. Le terziarie no: settimane senza righe sono
// normali, e la passiva non le legge.
export const FILE_DEL_MESE = ['primarie', 'secondarie'];

/**
 * DATI DEL MESE COMPLETI. Due condizioni, e servono tutte e due.
 * - Il «dati fino al» delle primarie va oltre l'ultimo giorno del mese: il
 *   file ha il mese intero. Non si chiede che arrivi fino al termine di
 *   registrazione: anche le primarie hanno buchi (17 giorni a Natale, 11 a
 *   Ferragosto nel file vero) e il mese resterebbe aperto per niente.
 * - L'ultimo caricamento riuscito e' del giorno del termine di registrazione
 *   dei formulari partiti l'ultimo giorno del mese, o dopo (dieci giorni,
 *   domeniche escluse: termineRegistrazione.ts). Prima, un formulario di fine
 *   mese puo' ancora arrivare: per il 30/09/2026 il termine e' il 12/10.
 * Un caricamento interrotto o non riuscito rende l'archivio inaffidabile, come
 * per i motori (freschezzaArchivi, cruscotto.ts); un file con i dati fermi tre
 * settimane prima del caricamento e' vecchio anche se caricato ieri.
 */
export function passoDati({ periodo, oggi, freschezza }) {
  const p = nuovoPasso('dati', 'Dati del mese completi',
    'Attiva, passiva e dichiarazioni si fanno sui movimenti caricati. Con un file che si ferma prima della fine del mese, o caricato prima che scada il termine per registrare i formulari partiti a fine mese, i conti escono più bassi del vero e nessun numero lo dice.',
    '/caricamento-dati');
  const scadenza = scadenzaRegistrazione(periodo.fine);
  p.scadenza = scadenza;
  const archivi = (freschezza && freschezza.archivi) || [];
  const aperti = (freschezza && freschezza.in_corso) || [];
  let mancaQualcosa = false;
  for (const tipo of FILE_DEL_MESE) {
    const nome = nomeArchivio(tipo);
    const a = archivi.find(x => x && x.tipo_file === tipo) || null;
    const aperto = aperti.find(x => x && x.tipo_file === tipo) || null;
    const no = (testo) => { mancaQualcosa = true; p.voci.push(voce('da_fare', `${nome}: ${testo}`)); };
    if (aperto) { no(`${(aperto.avviso && aperto.avviso.titolo) || 'caricamento da ripetere'}.`); continue; }
    if (!a || !a.il) { no('nel registro non c\'è nessun caricamento riuscito.'); continue; }
    const fino = a.fino_al ? `, dati fino al ${it(a.fino_al)}` : '';
    if (tipo === 'primarie') {
      if (!a.fino_al) { no(`caricate il ${it(a.il)}, ma non si sa fino a che giorno arrivano i dati${a.fino_al_perche ? ` (${a.fino_al_perche})` : ''}.`); continue; }
      if (a.fino_al <= periodo.fine) { no(`i dati arrivano fino al ${it(a.fino_al)}, non oltre la fine del mese: ${minuscolo(periodo.mese)} non c'è tutto. Carica un file scaricato dal ${it(scadenza)} in poi.`); continue; }
      if (a.vecchio && a.misurata_su === 'fino_al') { no(`caricate il ${it(a.il)}, ma i dati si fermano al ${it(a.fino_al)}: il file sembra scaricato dal portale molto prima.`); continue; }
    }
    if (scadenza && a.il < scadenza) {
      no(`caricate il ${it(a.il)}${fino}, prima del ${it(scadenza)}: fino a quel giorno si possono ancora registrare i formulari partiti il ${it(periodo.fine)}. Ricarica il file dal ${it(scadenza)} in poi.`);
      continue;
    }
    p.voci.push(voce('fatto', `${nome}: caricate il ${it(a.il)}${fino}.`));
  }
  if (!mancaQualcosa) {
    p.stato = 'fatto';
    p.dettaglio = `File caricati dal ${it(scadenza)} in poi, il termine di registrazione dei formulari partiti il ${it(periodo.fine)}.`;
  } else {
    if (scadenza && oggi < scadenza) p.dal = scadenza;
    p.dettaglio = p.dal
      ? `Il mese si può dare per completo dal ${it(scadenza)}: è il termine per registrare i formulari partiti il ${it(periodo.fine)}.`
      : `Il termine per registrare i formulari partiti il ${it(periodo.fine)} è scaduto il ${it(scadenza)}: serve un caricamento fatto da quel giorno in poi.`;
    p.manca = { cosa: 'i dati completi del mese', dal: p.dal };
  }
  return p;
}

// === 2. I terminati del mese ===

const NOME_MODULO_DATE = { primarie_rete: 'Primarie rete', primarie_aci: 'Primarie ACI', secondarie: 'Secondarie', terziarie: 'Terziarie', extra_raccolta: 'Extra raccolta' };
const LINK_MODULO_DATE = { primarie_rete: '/primarie-rete', primarie_aci: '/primarie-aci', secondarie: '/secondarie', terziarie: '/terziarie', extra_raccolta: '/extra-raccolta' };
const CANALE_ALERT = { rete: 'rete', ACI: 'ACI', extra: 'extra raccolta' };

/**
 * TERMINATI DEL MESE A POSTO. Due cose che tolgono un carico dal mese senza
 * dirlo: le date obbligatorie mancanti o incoerenti (regola del 22/09/2026:
 * senza fine trasporto un ordine non sta in nessun mese), e gli ordini rimasti
 * «eseguito» a portale, che il gestionale non conta finche' nessuno preme
 * Chiudi (movimenti.ts, eEseguito; il caso di Torres del 30/09/2026).
 *
 * Le date si leggono dagli alert che il motore apre a ogni caricamento, uno per
 * modulo e canale: valgono per tutti i mesi e non dicono di quale sono gli
 * ordini. Si dicono tutti, perche' quelli senza fine trasporto possono essere
 * proprio di questo mese, e leggerli dagli archivi voleva dire rileggere le
 * primarie a ogni apertura. Gli eseguiti invece sono pochi e si leggono:
 * contano quelli con la fine trasporto nel mese.
 *
 * alert: gli alert aperti (si tengono quelli delle date). eseguiti:
 * { primarieRete, primarieAci, secondarie } - le righe in stato «eseguito»
 * degli archivi, di qualunque mese.
 */
export function passoTerminati({ periodo, alert = [], eseguiti = {} }) {
  const p = nuovoPasso('terminati', 'Terminati del mese a posto',
    'Un terminato con le date da sistemare non sta nel mese giusto (senza fine trasporto non sta in nessun mese), e un ordine rimasto «eseguito» a portale non entra in nessun conto: raccolto, giacenze, attiva e passiva del mese escono senza di lui.',
    '/alert-engine');
  const date = (alert || []).filter(eAlertDate);
  let senzaFine = 0;
  for (const a of date) {
    const quanti = Number(a.quanti);
    const sf = Number(a.senza_fine) || 0;
    senzaFine += sf;
    const dove = `${NOME_MODULO_DATE[a.modulo] || a.modulo || 'Movimenti'}${a.modulo === 'secondarie' && a.canale ? ` ${CANALE_ALERT[a.canale] || a.canale}` : ''}`;
    const quantiTesto = Number.isFinite(quanti) && quanti > 0 ? `${quanti} ${quanti === 1 ? 'ordine terminato' : 'ordini terminati'}` : 'ordini terminati';
    p.voci.push(voce('da_fare', `${dove}: ${quantiTesto} con date obbligatorie mancanti o incoerenti${sf ? `, di cui ${sf} senza fine trasporto` : ''}.`, LINK_MODULO_DATE[a.modulo] || '/alert-engine'));
  }
  const sec = eseguiti.secondarie || [];
  const gruppi = [
    ['Primarie rete', '/primarie-rete', eseguiti.primarieRete || []],
    ['Primarie ACI', '/primarie-aci', eseguiti.primarieAci || []],
    ['Secondarie rete', '/secondarie', sec.filter(r => !eAci(r))],
    ['Secondarie ACI', '/secondarie', sec.filter(r => eAci(r))],
  ];
  const nelMese = (r) => { const g = giornoMovimento(r); return !!g && g >= periodo.inizio && g <= periodo.fine; };
  let altrove = 0;
  let delMeseTotale = 0;
  for (const [nome, link, righe] of gruppi) {
    const e = riepilogoEseguiti(righe.filter(nelMese));
    altrove += riepilogoEseguiti(righe.filter(r => !nelMese(r))).ordini;
    if (!e.ordini) continue;
    delMeseTotale += e.ordini;
    const quali = e.esempi.slice(0, 5).map(o => o.id_ordine || o.numero_fir).filter(Boolean).join(', ');
    p.voci.push(voce('da_fare', `${nome}: ${e.ordini} ${e.ordini === 1 ? 'ordine rimasto' : 'ordini rimasti'} «eseguito» a portale (${formatoKg(e.kg)} kg)${quali ? `: ${quali}${e.ordini > 5 ? ' e altri' : ''}` : ''}. Finché a portale nessuno preme «Chiudi» non entrano in nessun conto.`, link));
  }
  if (altrove) p.voci.push(voce('info', `${altrove} ${altrove === 1 ? 'altro ordine' : 'altri ordini'} «eseguito» con la fine trasporto in un altro mese, o senza: si vedono nei loro mesi.`));
  const daFare = p.voci.filter(v => v.stato === 'da_fare');
  if (!daFare.length) {
    p.stato = 'fatto';
    p.dettaglio = 'Nessun alert delle date obbligatorie aperto, e nessun ordine con la fine trasporto nel mese rimasto «eseguito» a portale.';
    return p;
  }
  p.link = daFare[0].link || p.link;
  p.dettaglio = [
    date.length ? `Gli alert delle date valgono per tutti i mesi e non dicono di quale sono gli ordini${senzaFine ? `: quelli senza fine trasporto non stanno in nessun mese, e possono essere proprio di ${minuscolo(periodo.mese)}` : ''}. Le date si correggono nel file del portale e si ricaricano (l'extra raccolta nella sua scheda).` : '',
    delMeseTotale ? 'Un ordine «eseguito» ha tutti i dati: gli manca solo la chiusura a portale.' : '',
  ].filter(Boolean).join(' ');
  p.manca = { cosa: date.length && delMeseTotale ? 'le date dei terminati e gli ordini «eseguito»' : date.length ? 'le date dei terminati da sistemare' : 'la chiusura a portale degli ordini «eseguito»' };
  return p;
}

// === 3. Le dichiarazioni ===

// Uno stato che toglie il mese dal «da dichiarare»: caricata a portale, solo
// metalli (il ferro va con la prossima gomma), non dovuta.
const CHIUDE_IL_MESE = new Set(['caricata', 'solo_metalli', 'non_dovuta']);
// Una dichiarazione scritta (o arrivata via email) e non ancora caricata.
const SCRITTA = new Set(['ricevuta', 'inserita']);
const NOME_IRIGOM = 'irigom';
// LE PROVENIENZE DI UN CANALE (revisione delle migliorie, 11/10/2026). L'ACI si
// dichiara divisa: la primaria arrivata all'impianto e la secondaria arrivata
// dallo stoccaggio hanno ciascuna la sua dichiarazione del mese, e la pagina le
// tiene su due flussi. Fino a questa revisione lo stato del mese era «il
// migliore fra le provenienze», e la primaria caricata copriva la secondaria
// mancante: un verde falso (Gatim ACI, settembre 2026).
const provenienzeDi = (canale) => (canale === 'ACI' ? ['primaria', 'secondaria', ''] : ['']);
// «la secondaria di settembre», «la primaria da luglio a settembre».
const conProvenienza = (prov, quali, intervallo) => (prov ? `la ${prov} ${intervallo ? '' : 'di '}${quali}` : quali);

// Mesi uno dopo l'altro con lo stesso stato si dicono «da luglio a settembre».
function mesiDetti(mesi) {
  const gruppi = [];
  for (const m of mesi) {
    const g = gruppi[gruppi.length - 1];
    if (g && m.idx >= 0 && g.stato === m.stato && g.prov === (m.prov || '') && g.ultimo === m.idx - 1) { g.ultimo = m.idx; g.n++; continue; }
    gruppi.push({ stato: m.stato, prov: m.prov || '', primo: m.idx, ultimo: m.idx, n: 1, nome: m.nome || '' });
  }
  return gruppi.map(g => {
    const quali = g.primo < 0 ? g.nome
      : g.n >= 3 ? `da ${minuscolo(MESI_CHIUSURA[g.primo])} a ${minuscolo(MESI_CHIUSURA[g.ultimo])}`
        : g.n === 2 ? `${minuscolo(MESI_CHIUSURA[g.primo])} e ${minuscolo(MESI_CHIUSURA[g.ultimo])}`
          : minuscolo(MESI_CHIUSURA[g.primo]);
    const come = g.stato === 'ricevuta' ? ' (ricevuta, da caricare)' : g.stato === 'inserita' ? ' (scritta, da caricare)' : '';
    return `${g.primo < 0 ? quali : conProvenienza(g.prov, quali, g.n >= 3)}${come}`;
  });
}

/**
 * LE DICHIARAZIONI DEGLI IMPIANTI. Non si legano al mese del calendario: si
 * fanno a consuntivo, e sulla RETE il portale le aggancia ai carichi dal mese
 * piu' vecchio (la nave di marzo di T-Cycle si e' portata gennaio, febbraio e
 * parte di marzo, 09/10/2026). Quindi qui non si chiede «settembre e'
 * dichiarato?», ma quali mesi di conferimento restano ancora senza
 * dichiarazione.
 *
 * Chi ha ancora qualcosa da dichiarare lo dice il conto della pagina
 * Dichiarazioni, che il guardiano notturno rifa' ogni notte e scrive nella
 * fotografia del giorno (indicatoriGiorno.ts): per ogni impianto e canale il
 * resto da dichiarare, la colonna «Da dichiarare». Qui non si ricalcola. Se la
 * fotografia porta anche i mesi ancora aperti (mesi_aperti), si dicono quelli,
 * come li dice la pagina. Altrimenti si dice quello che si sa per certo:
 * l'ultima dichiarazione caricata, i mesi fino a quello che si chiude con la
 * dichiarazione scritta e non ancora caricata (anche prima dell'ultima
 * caricata: la pagina li segna, revisione dell'11/10/2026), e quanto resta.
 *
 * SOLO LA RETE SI AGGANCIA (revisione delle migliorie, 11/10/2026). Su ACI ed
 * extra raccolta il portale non pubblica agganci: ogni conferimento si dichiara
 * col suo mese (l'ACI anche con la sua provenienza), e un resto e' sempre
 * qualcosa ancora senza dichiarazione. Li' non si dice «il portale aggancera'»,
 * e un resto non e' mai giacenza: il passo resta da fare, e quali mesi lo dice
 * la pagina (i conferimenti arrivati dopo il mese che si chiude stanno nel
 * resto anche loro, e si dichiarano col loro mese).
 *
 * LA FOTOGRAFIA E' DI UN ANNO (revisione delle migliorie, 11/10/2026). Il
 * guardiano la scrive sull'anno in corso: un mese di un anno passato non si
 * giudica col resto di oggi, che e' fatto dei conferimenti di quest'anno
 * (dicembre 2025 riceveva i 337,96 t di Green Tyre del 2026). Quello che resta
 * di un anno passato e' nella casella «dall'anno prima» dell'anno dopo, e si
 * controlla col mese che si chiude adesso. L'eccezione e' gennaio, quando si
 * chiude dicembre: la fotografia e' gia' dell'anno nuovo, e il suo resto e' la
 * giacenza di adesso, con la casella dell'anno appena finito.
 *
 * Irigom e' l'eccezione: la sua rete si dichiara con la pratica del mese, sulle
 * uscite dei prodotti, e la giacenza (385,36 t all'apertura del 2026) resta per
 * costruzione. Per lui il passo e' la pratica del mese: registrata e caricata,
 * o registrata di soli metalli, che a portale non si caricano.
 *
 * Gli stoccaggi non dichiarano; la rete di chi non la dichiara per accordo
 * (Tecnogum) non e' dovuta; i canali restano separati.
 */
export function passoDichiarazioni({ periodo, oggi, fotografia, dichiarazioni = [], pratiche = [], chiaveDi = (s) => String(s || '').trim().toLowerCase() }) {
  const p = nuovoPasso('dichiarazioni', 'Dichiarazioni degli impianti',
    'Il portale toglie dalla giacenza solo le dichiarazioni caricate, e sulla rete le aggancia ai carichi dal mese più vecchio: un conferimento non dichiarato resta in giacenza. Qui non si chiede se il mese ha «la sua» dichiarazione: si guarda che cosa resta da dichiarare, e fin dove le dichiarazioni sono caricate.',
    conPeriodo('/dichiarazioni-impianti', 'riepilogo', periodo));
  if (!fotografia || !Array.isArray(fotografia.siti)) {
    p.dettaglio = 'Il controllo notturno non ha ancora scritto la sua fotografia: senza, non so quali impianti hanno ancora qualcosa da dichiarare. I mesi si vedono in Dichiarazioni Impianti.';
    p.manca = { cosa: 'il controllo delle dichiarazioni' };
    return p;
  }
  const annoFoto = Number(fotografia.anno) || Number(String(fotografia.giorno || '').slice(0, 4)) || null;
  const riferimento = oggi ? ultimoMeseFinito(oggi) : null;
  const siChiudeOra = !!riferimento && riferimento.anno === periodo.anno && riferimento.mese_idx === periodo.mese_idx;
  // A gennaio si chiude dicembre, e la fotografia e' gia' dell'anno nuovo.
  const annoNuovo = !!annoFoto && annoFoto === periodo.anno + 1 && siChiudeOra;
  if (annoFoto && annoFoto > periodo.anno && !annoNuovo) {
    p.stato = 'non_serve';
    p.dettaglio = `La fotografia del controllo notturno è del ${annoFoto}: quello che restava da dichiarare del ${periodo.anno} è passato nella casella «dall'anno prima» dell'anno dopo, e si controlla col mese che si chiude adesso${riferimento ? ` (${minuscolo(riferimento.etichetta)})` : ''}. Il resto di oggi è fatto dei conferimenti del ${annoFoto}, e non dice niente di ${minuscolo(periodo.etichetta)}.`;
    return p;
  }
  if (annoFoto && annoFoto < periodo.anno) {
    p.dettaglio = `L'ultima fotografia del controllo notturno è del ${annoFoto}: del ${periodo.anno} non ce n'è ancora una, e senza non so quali impianti hanno ancora qualcosa da dichiarare. I mesi si vedono in Dichiarazioni Impianti.`;
    p.manca = { cosa: 'il controllo delle dichiarazioni' };
    return p;
  }
  const { perChiave } = leggiDichiarazioni(dichiarazioni, { anno: periodo.anno, chiaveDi });
  // Lo stato di un mese su una provenienza: mai il migliore fra le provenienze.
  const statoDi = (sito, canale, provenienza, idx, dichiaraRete) => statoDichiarazione(
    perChiave.get(chiaveDichiarazione({ sito, canale, provenienza, mese: MESI_CHIUSURA[idx] }, chiaveDi)) || null,
    { canale, dichiara_rete: dichiaraRete });
  const pratica = (pratiche || [])
    .filter(x => x && Number(x.anno) === periodo.anno && x.mese === periodo.mese && x.stato !== 'sostituita')
    .sort((a, b) => (Number(b.versione) || 0) - (Number(a.versione) || 0))[0] || null;
  const daFare = [];
  let senzaResto = 0;
  let conRipiego = false;
  let senzaAggancio = false;
  const detto = (idx) => minuscolo(MESI_CHIUSURA[idx]);
  for (const s of fotografia.siti) {
    if (!s || s.ruolo === 'stoc') continue;
    const ns = chiaveDi(s.sito);
    const dichiara = s.dichiara_rete !== false;
    for (const canale of CANALI_CHIUSURA) {
      const v = s.canali && s.canali[canale];
      if (!v || v.non_dovuta) continue;
      if (canale === 'RETE' && !dichiara) continue;
      // Senza un resto il canale non ha righe da dichiarare (nessun flusso).
      if (typeof v.resta_t !== 'number') continue;
      const resta = v.resta_t;
      const chi = `${s.sito}, ${NOMI_CANALI_CHIUSURA[canale]}`;
      const quanto = `${formatoTonnellate(resta)} t`;
      if (ns === NOME_IRIGOM && canale === 'RETE') {
        const linkIrigom = conPeriodo('/dichiarazioni-impianti', 'irigom', periodo);
        const st = statoDi(s.sito, 'RETE', '', periodo.mese_idx, true);
        const mese = minuscolo(periodo.mese);
        if (!pratica) { daFare.push(s.sito); p.voci.push(voce('da_fare', `${chi}: la pratica di ${mese} non c'è ancora.`, linkIrigom)); }
        else if (pratica.stato !== 'registrata') { daFare.push(s.sito); p.voci.push(voce('da_fare', `${chi}: la pratica di ${mese} è in preparazione, non ancora registrata.`, linkIrigom)); }
        else if (!CHIUDE_IL_MESE.has(st)) { daFare.push(s.sito); p.voci.push(voce('da_fare', `${chi}: pratica di ${mese} registrata, la dichiarazione è da caricare a portale.`, linkIrigom)); }
        else {
          // Un mese di soli metalli a portale non carica nulla (revisione,
          // 11/10/2026): la voce non dice «caricata», come non lo dice la nota
          // della pratica.
          const come = st === 'solo_metalli' ? 'registrata, di soli metalli ferrosi (a portale non si carica nulla)'
            : st === 'non_dovuta' ? 'registrata, dichiarazione non dovuta' : 'registrata e caricata';
          p.voci.push(voce('fatto', `${chi}: pratica di ${mese} ${come}${resta > 0 ? `; restano da dichiarare ${quanto}, la giacenza che il portale aggancerà con le prossime uscite` : ''}.`, linkIrigom));
        }
        continue;
      }
      if (!(resta > 0)) { senzaResto++; continue; }
      const conAggancio = canale === 'RETE';
      const provs = provenienzeDi(canale);
      // A gennaio i mesi della fotografia sono dell'anno nuovo, non di quello
      // che si chiude: si guarda solo che cosa e' caricato.
      if (Array.isArray(v.mesi_aperti) && !annoNuovo) {
        // LA FOTOGRAFIA PORTA I MESI ANCORA APERTI, dal piu' vecchio: e' il conto
        // della pagina mese per mese, e si dicono quelli. Sulla rete un mese
        // aperto con la sua dichiarazione caricata non manca di niente: il resto
        // e' giacenza, che il portale aggancera' con le prossime (come il
        // controllo «mancante» del modulo, che guarda i mesi senza
        // dichiarazione); lo stesso la casella dall'anno prima, che non e' un
        // mese a parte. Su ACI ed extra raccolta niente si aggancia: ogni mese
        // aperto manca di una dichiarazione, sulla sua provenienza se la
        // fotografia la dice.
        const aperti = v.mesi_aperti
          .filter(m => m && (Number(m.da_dichiarare_t) || 0) > 0)
          .map(m => {
            const idx = MESI_CHIUSURA.indexOf(m.mese);
            const prov = canale === 'ACI' ? String(m.provenienza || '') : '';
            if (idx < 0) return { idx: -1, nome: String(m.mese || ''), stato: 'giacenza', prov: '' };
            const stati = (prov ? [prov] : provs).map(x => statoDi(s.sito, canale, x, idx, dichiara));
            const stato = conAggancio || prov ? stati[0] : (stati.find(x => SCRITTA.has(x)) || 'nessuna');
            return { idx, stato, prov };
          })
          .filter(m => m.idx <= periodo.mese_idx);
        if (!conAggancio) {
          if (!aperti.length) {
            p.voci.push(voce('fatto', `${chi}: niente da dichiarare fino ${aMese(periodo.mese)}; restano ${quanto} dei conferimenti arrivati dopo.`));
            continue;
          }
          senzaAggancio = true;
          daFare.push(s.sito);
          const caselle = aperti.filter(m => m.idx < 0).map(m => `quelli ${m.nome}`);
          p.voci.push(voce('da_fare', `${chi}: restano da dichiarare ${quanto} senza una dichiarazione caricata: ${elenco([...caselle, ...mesiDetti(aperti.filter(m => m.idx >= 0))])}.`));
          continue;
        }
        const mesi = aperti.filter(m => m.idx >= 0 && !CHIUDE_IL_MESE.has(m.stato));
        const anche = aperti.filter(m => !mesi.includes(m));
        const ancheMesi = anche.filter(m => m.idx >= 0).map(m => detto(m.idx));
        const ancheDetto = anche.length ? `, anche ${elenco([...anche.filter(m => m.idx < 0).map(m => m.nome), ...(ancheMesi.length ? [`di ${elenco(ancheMesi)}`] : [])])}` : '';
        if (!mesi.length) {
          p.voci.push(voce('fatto', `${chi}: dichiarata fino ${aMese(periodo.mese)}; restano da dichiarare ${quanto}${ancheDetto}, la giacenza che il portale aggancerà con le prossime dichiarazioni.`));
          continue;
        }
        daFare.push(s.sito);
        p.voci.push(voce('da_fare', `${chi}: ${elenco(mesiDetti(mesi))} non ${mesi.length === 1 ? 'è' : 'sono'} ancora ${mesi.length === 1 ? 'dichiarato' : 'dichiarati'} a portale; restano da dichiarare ${quanto}${ancheDetto}.`));
        continue;
      }
      // SENZA I MESI APERTI NELLA FOTOGRAFIA si dice solo quello che si sa per
      // certo: l'ultima dichiarazione caricata, i mesi con la dichiarazione
      // scritta e non ancora caricata, e quanto resta. Non si elencano i mesi
      // dopo l'ultima dichiarazione come «senza»: quali abbiano avuto dei
      // conferimenti qui non si sa. Nel foglio vero del 09/10/2026 GATIM rete
      // ha luglio e agosto a zero (niente conferito), e dirli mancanti sarebbe
      // stato un avviso falso. Le scritte si cercano in tutti i mesi fino a
      // quello che si chiude, anche prima dell'ultima caricata: giugno scritto e
      // settembre caricato lasciano giugno da caricare (revisione, 11/10/2026).
      const perProv = provs.map(prov => {
        let ultimo = -1;
        let ha = false;
        const scritti = [];
        for (let i = 0; i < 12; i++) {
          const st = statoDi(s.sito, canale, prov, i, dichiara);
          if (st !== 'nessuna') ha = true;
          if (i > periodo.mese_idx) continue;
          if (CHIUDE_IL_MESE.has(st)) ultimo = i;
          if (SCRITTA.has(st)) scritti.push({ idx: i, prov });
        }
        return { prov, ultimo, ha, scritti };
      });
      const scritti = perProv.flatMap(x => x.scritti).sort((a, b) => a.idx - b.idx);
      const scrittiDetti = scritti.length
        ? `${elenco(scritti.map(x => conProvenienza(x.prov, detto(x.idx), false)))} ${scritti.length === 1 ? 'ha' : 'hanno'} la dichiarazione scritta, da caricare`
        : '';
      if (conAggancio) {
        conRipiego = true;
        const { ultimo } = perProv[0];
        if (ultimo === periodo.mese_idx && !scritti.length) {
          p.voci.push(voce('fatto', `${chi}: dichiarazioni caricate fino ${aMese(periodo.mese)}; restano da dichiarare ${quanto}, i conferimenti più recenti, che il portale aggancerà con le prossime.`));
          continue;
        }
        daFare.push(s.sito);
        p.voci.push(voce('da_fare', [
          ultimo >= 0 ? `${chi}: l'ultima dichiarazione caricata a portale è di ${detto(ultimo)}` : `${chi}: nel ${periodo.anno} nessuna dichiarazione caricata a portale`,
          scrittiDetti,
          `restano da dichiarare ${quanto}`,
        ].filter(Boolean).join('; ') + '.'));
        continue;
      }
      // ACI ED EXTRA RACCOLTA: il resto e' sempre qualcosa senza dichiarazione.
      // Si dice fin dove e' caricata ogni provenienza, una per una.
      senzaAggancio = true;
      daFare.push(s.sito);
      const conRighe = perProv.filter(x => x.ha);
      // Le provenienze caricate fino allo stesso mese si dicono insieme: «la
      // primaria e la secondaria sono caricate fino a settembre».
      const perUltimo = [];
      for (const x of conRighe) {
        const g = perUltimo.find(y => y.ultimo === x.ultimo);
        if (g) g.provs.push(x.prov); else perUltimo.push({ ultimo: x.ultimo, provs: [x.prov] });
      }
      const nomeProv = (x) => (x ? `la ${x}` : 'quelle senza provenienza');
      const finoA = (u) => (u >= 0 ? `fino ${aMese(MESI_CHIUSURA[u])}` : `in nessun mese fino ${aMese(periodo.mese)}`);
      const fin = !conRighe.length ? `nel ${periodo.anno} nessuna dichiarazione caricata`
        : canale === 'ACI'
          ? elenco(perUltimo.map(g => `${elenco(g.provs.map(nomeProv))} ${g.provs.length === 1 && g.provs[0] ? 'è caricata' : 'sono caricate'} ${finoA(g.ultimo)}`))
          : conRighe[0].ultimo >= 0 ? `l'ultima dichiarazione caricata è di ${detto(conRighe[0].ultimo)}` : `nessuna dichiarazione caricata fino ${aMese(periodo.mese)}`;
      p.voci.push(voce('da_fare', [`${chi}: restano da dichiarare ${quanto} senza una dichiarazione caricata`, fin, scrittiDetti].filter(Boolean).join('; ') + '.'));
    }
  }
  const eta = fotografia.giorno ? giorniFa(fotografia.giorno, oggi) : null;
  const quando = fotografia.giorno ? `Resto da dichiarare del controllo notturno del ${it(fotografia.giorno)}${eta !== null && eta > 2 ? `: il controllo non gira da ${eta} giorni, e i numeri sono di quel giorno` : ''}.` : '';
  const impianti = [...new Set(daFare)];
  if (!impianti.length) {
    p.stato = 'fatto';
    p.dettaglio = [`Dichiarazioni caricate fino ${aMese(periodo.mese)} per ogni impianto che ha ancora qualcosa da dichiarare: quello che resta è giacenza dei conferimenti più recenti${senzaResto ? ` (${senzaResto} ${senzaResto === 1 ? 'flusso non ha' : 'flussi non hanno'} niente da dichiarare)` : ''}.`, quando].filter(Boolean).join(' ');
    return p;
  }
  p.dettaglio = [
    quando,
    conRipiego ? 'Sulla rete il portale aggancia le dichiarazioni dal mese più vecchio: quello che resta è dei conferimenti più recenti. Quali mesi, e quanto per ciascuno, lo dice la pagina.' : '',
    senzaAggancio ? `Su ACI ed extra raccolta niente si aggancia: ogni conferimento si dichiara col suo mese (l'ACI anche con la sua provenienza), e un resto è sempre qualcosa ancora senza dichiarazione. Quali mesi lo dice la pagina; quelli arrivati dopo ${minuscolo(periodo.mese)} si dichiarano col loro mese.` : '',
  ].filter(Boolean).join(' ');
  p.link = (p.voci.find(v => v.stato === 'da_fare' && v.link) || {}).link || p.link;
  p.manca = { cosa: impianti.length === 1 ? `le dichiarazioni di ${impianti[0]}` : `le dichiarazioni di ${impianti.length} impianti` };
  return p;
}

// === 4. La fatturazione attiva, un canale per volta ===

const documentiAttivaDelMese = (documenti, periodo) => (documenti || []).filter(d => d && d.tipo === 'ATTIVA'
  && Number(d.anno) === periodo.anno && d.mese === periodo.mese && !d.superato && d.stato !== 'bozza');

/**
 * Il documento dell'attiva di un canale. Un documento senza canale (di prima dei
 * documenti per canale) vale per tutto il mese, come vale per l'elaborazione e
 * per la chiusura; fra due dello stesso canale vale l'elaborato per ultimo.
 */
export function documentoDelCanale(docs, canale) {
  const suoi = (docs || []).filter(d => d.tipologia === canale);
  const scelti = suoi.length ? suoi : (docs || []).filter(d => !CANALI_CHIUSURA.includes(d.tipologia));
  return scelti.slice().sort((a, b) => String(b.data_elaborazione || '').localeCompare(String(a.data_elaborazione || '')))[0] || null;
}

// Un canale senza righe nel mese non ha niente da fatturare ne' da pagare. Solo
// quando il documento lo dice con un numero: un campo che manca non e' zero.
const senzaRighe = (d) => !!d && typeof d.numero_voci === 'number' && d.numero_voci === 0;

/**
 * I MOVIMENTI DELL'EXTRA RACCOLTA FINITI NEL MESE, contati come li conta
 * l'attiva (calcolaRigheAttiva): terminati, fine trasporto nel mese sul giorno
 * italiano (filtraPeriodo), senza le secondarie, che non si fatturano. Si
 * dicono a parte quelli col peso effettivo, che fanno una riga ciascuno, e
 * quelli senza, che l'attiva non fattura e segnala. null se l'archivio non e'
 * stato letto: allora non si sa, e vale il documento.
 *
 * Serve al «non serve» (revisione delle migliorie, 11/10/2026): numero_voci 0
 * e' vero il giorno in cui il documento si elabora. Il documento dell'extra
 * raccolta di settembre 2026 e' del 05/10 con 0 righe, e in archivio c'erano
 * cinque ordini di settembre ancora «assegnato»: chiusi quelli, il canale ha da
 * fatturare e da pagare, la Fatturazione lo dice, e la chiusura restava su «non
 * serve» per sempre. Un documento a zero righe con un movimento pesato nel mese
 * e' di prima di quel movimento, e va rielaborato; uno senza peso non si
 * risolve rielaborando: manca il peso (revisione, 12/10/2026). L'archivio e'
 * piccolo (sette righe l'11/10/2026) e si legge; per rete e ACI un mese senza
 * righe e' raro, e rileggere le primarie a ogni apertura non si fa.
 */
export function movimentiExtraNelMese(movimentiExtra, periodo) {
  if (!Array.isArray(movimentiExtra)) return null;
  const delMese = filtraPeriodo(movimentiExtra, periodo.anno, periodo.mese).filter(r => !eSecondariaExtra(r));
  const conPeso = delMese.filter(r => Number(r.peso_effettivo) > 0).length;
  return { con_peso: conPeso, senza_peso: delMese.length - conPeso };
}

const quantiExtra = (n) => (n ? n.con_peso + n.senza_peso : 0);
// Il canale e' davvero senza righe: il documento dice zero, e per l'extra
// raccolta nel mese non c'e' nessun movimento finito.
const vuotoDavvero = (d, canale, nuoviExtra) => senzaRighe(d) && !(canale === 'EXTRA_RACCOLTA' && quantiExtra(nuoviExtra) > 0);
const movimentiDetti = (n, come) => (n === 1 ? `c'è 1 movimento di extra raccolta finito${come}` : `ci sono ${n} movimenti di extra raccolta finiti${come}`);
// Che cosa manca a un documento a zero righe con dei movimenti nel mese.
const mancaAlVuoto = (n) => (n.con_peso > 0 ? "la rielaborazione dell'attiva" : "il peso effettivo dei movimenti");

/**
 * IL PRIMO MESE CHIUSO NEL GESTIONALE: SETTEMBRE 2026 (revisione delle
 * migliorie, 12/10/2026). Il gestionale e' nato a fine estate 2026: gennaio-
 * agosto 2026 sono stati fatturati fuori, e si chiudono come gia' fatti
 * (decisione dell'utente dell'11/10/2026, «il gestionale è nato solo due mesi
 * fa»); settembre 2026 e' il primo mese da chiudere davvero qui. E' scritto
 * una volta, qui, ed e' fisso: non dipende da oggi ne' da che cosa c'e' negli
 * archivi.
 *
 * I passi che prima non si facevano nel gestionale - l'attiva elaborata, la
 * passiva congelata, i consuntivi dei fornitori, le quadrature FIR - si
 * chiedono da qui, o dal primo fatto scritto se e' di prima (un mese gia'
 * trattato qui resta com'era). Mai da dopo: settembre si chiude nel gestionale
 * anche se il primo congelamento fosse quello di ottobre.
 *
 * Fino a questa revisione, senza nessun fatto scritto il primo mese era «quello
 * che si chiude adesso», e scivolava col calendario: sulla copia dei dati veri
 * dell'11/10/2026, senza nessun congelamento, dal 01/11/2026 settembre diventava
 * «non serve» con «Prima di ottobre 2026 la passiva non si congelava», e il suo
 * congelamento non lo chiedeva piu' nessuno.
 */
export const PRIMO_MESE_DEL_GESTIONALE = periodoDelMese(2026, 8);
const PARTENZA = indiceMese(PRIMO_MESE_DEL_GESTIONALE.anno, PRIMO_MESE_DEL_GESTIONALE.mese_idx);
/** Il primo mese da chiedere: il primo fatto scritto o settembre 2026, quale viene prima. */
const primoDaChiedere = (primo) => (primo === null ? PARTENZA : Math.min(primo, PARTENZA));
// Il perche' di un mese di prima, quando il confine e' settembre 2026 e non un fatto scritto.
const chiusoFuori = (periodo) => `Il gestionale chiude i mesi da ${minuscolo(PRIMO_MESE_DEL_GESTIONALE.etichetta)}: ${minuscolo(periodo.etichetta)} si è chiuso fuori`;
const primoMeseAttiva = (documenti) => primoDaChiedere(primoMese(
  (documenti || []).filter(d => d && d.tipo === 'ATTIVA' && !d.superato && d.stato !== 'bozza' && MESI_CHIUSURA.includes(d.mese)),
  (d) => indiceMese(d.anno, MESI_CHIUSURA.indexOf(d.mese))));

/**
 * L'ATTIVA DI UN CANALE: elaborata, confrontata con la prefattura del portale
 * (solo rete e ACI: l'extra raccolta a portale non c'e'), approvata, esportata,
 * chiusa. Si chiude quando l'amministrazione conferma che la fattura e' stata
 * emessa (cambiaStatoFatturazione): e' il fatto che chiude il canale, e lo
 * stato del documento lo porta gia'.
 *
 * Il confronto con la prefattura non resta scritto: si rifa' a ogni apertura
 * della Fatturazione, perche' i dati cambiano a ogni caricamento. Qui si dice
 * che la prefattura c'e'; l'esito si guarda li', e rifarlo qui sarebbe
 * ricalcolare l'attiva.
 *
 * Esportata vuol dire esportata dopo l'approvazione: registraEsportazione porta
 * il documento a «esportata» solo da «approvata», e un'esportazione di prova
 * di un documento non approvato non conta. Anche quando il registro la lega al
 * documento: l'interfaccia manda sempre documento_ids: [doc.id], e
 * registraEsportazione registra anche le esportazioni di un documento
 * «elaborata» (il 05/10/2026 rete e ACI di settembre sono state esportate
 * cosi'). Senza guardare la data, approvato il documento la chiusura diceva
 * «esportata» e il modulo «approvata» (revisione, 11/10/2026).
 *
 * movimentiExtra (facoltativo): l'extra raccolta senza righe non e' «non
 * serve» se nel mese ci sono movimenti finiti (movimentiExtraNelMese). Un mese
 * senza documenti prima del primo documento dell'attiva, o prima di settembre
 * 2026 (PRIMO_MESE_DEL_GESTIONALE), non si chiede.
 */
export function passiAttiva({ periodo, documenti = [], prefatture = [], esportazioni = [], movimentiExtra = null }) {
  const docs = documentiAttivaDelMese(documenti, periodo);
  const primo = primoMeseAttiva(documenti);
  const primaDelGestionale = !docs.length && indiceMese(periodo.anno, periodo.mese_idx) < primo;
  const nuoviExtra = movimentiExtraNelMese(movimentiExtra, periodo);
  const pref = (prefatture || []).filter(x => x && Number(x.anno) === periodo.anno && x.mese === periodo.mese && !x.superata)
    .sort((a, b) => String(b.caricata_il || '').localeCompare(String(a.caricata_il || '')));
  const registro = (esportazioni || []).filter(e => e && Number(e.anno) === periodo.anno && e.mese === periodo.mese
    && (e.direzione || 'ATTIVA') === 'ATTIVA' && e.stato !== 'fallita');
  return CANALI_CHIUSURA.map(c => {
    const nome = NOMI_CANALI_CHIUSURA[c];
    const p = nuovoPasso(`attiva_${c}`, `Attiva ${TITOLI_CANALI[c]}`,
      'SMOCO fa a Ecotyre una fattura per canale. Il canale si chiude quando l\'amministrazione conferma che la fattura è stata emessa; prima si confronta con la prefattura del portale (rete e ACI), si approva e si esporta.',
      conPeriodo('/fatturazione', 'attiva', periodo, c), c);
    if (primaDelGestionale) {
      p.stato = 'non_serve';
      p.dettaglio = primo === PARTENZA
        ? `${chiusoFuori(periodo)}, e la sua fattura non passa di qui.`
        : `Prima di ${etichettaIndice(primo)} l'attiva non si elaborava nel gestionale: la fattura di ${minuscolo(periodo.etichetta)} non passa di qui.`;
      return p;
    }
    const d = documentoDelCanale(docs, c);
    const nuovi = c === 'EXTRA_RACCOLTA' ? nuoviExtra : null;
    if (vuotoDavvero(d, c, nuovi)) {
      p.stato = 'non_serve';
      p.dettaglio = `Nessuna riga di ${nome} nel mese: niente da fatturare.`;
      return p;
    }
    if (senzaRighe(d)) {
      // Elaborato senza righe, e nel mese ci sono movimenti finiti: se pesati,
      // il documento e' di prima che arrivassero; se senza peso, rielaborare
      // non basta, manca il peso.
      const elaborata = `Elaborata il ${it(giornoDi(d.data_elaborazione))} senza righe`;
      p.manca = { cosa: mancaAlVuoto(nuovi), canale: c };
      if (nuovi.con_peso > 0) {
        p.voci = [voce('da_fare', `${elaborata}, ma ora nel mese ${movimentiDetti(nuovi.con_peso, '')}: va rielaborata.`)];
        p.dettaglio = `Il documento dice che nel mese non c'era niente da fatturare, ma è di prima che arrivassero i movimenti del mese. Manca ${p.manca.cosa}.`;
      } else {
        p.voci = [voce('da_fare', `${elaborata}: nel mese ${movimentiDetti(nuovi.senza_peso, ' senza il peso effettivo')}, che non si ${nuovi.senza_peso === 1 ? 'fattura' : 'fatturano'} finché il peso non c'è.`)];
        p.dettaglio = `Un movimento senza peso effettivo non fa righe: il peso si scrive nell'Extra Raccolta, poi si rielabora. Manca ${p.manca.cosa}.`;
      }
      return p;
    }
    if (chiusoFuoriDalGestionale(d)) {
      // Fatturato fuori, prima dell'avvio (giro K8, 12/10/2026): prefattura,
      // approvazione ed esportazione qui non ci sono mai state, e non si dicono
      // fatte; si dice com'e' andata.
      p.stato = 'fatto';
      p.dettaglio = testoChiusoFuori(d);
      p.voci = [
        voce('fatto', `Elaborata il ${it(giornoDi(d.data_elaborazione))}${typeof d.numero_voci === 'number' ? `: ${d.numero_voci} ${d.numero_voci === 1 ? 'riga' : 'righe'}` : ''}.`),
        voce('fatto', p.dettaglio),
      ];
      return p;
    }
    const conPrefattura = c !== 'EXTRA_RACCOLTA';
    const approvata = !!d && ['approvata', 'esportata', 'chiusa'].includes(d.stato);
    const dopoApprovazione = (quando) => !!quando && (!d.data_approvazione || String(quando) >= String(d.data_approvazione));
    // Anche un'esportazione legata al documento conta solo se e' dopo l'approvazione.
    const esportata = !!d && (d.stato === 'esportata'
      || (['approvata', 'chiusa'].includes(d.stato) && (dopoApprovazione(d.data_esportazione)
        || registro.some(e => (e.tipologia === c || e.tipologia === 'TUTTO')
          && ((Array.isArray(e.documento_ids) && e.documento_ids.includes(d.id)) || !(e.documento_ids || []).length)
          && dopoApprovazione(e.data_esportazione)))));
    const chiusa = !!d && d.stato === 'chiusa';
    const sotto = [];
    sotto.push(d
      ? voce('fatto', `Elaborata il ${it(giornoDi(d.data_elaborazione))}${typeof d.numero_voci === 'number' ? `: ${d.numero_voci} ${d.numero_voci === 1 ? 'riga' : 'righe'}` : ''}.`)
      : voce('da_fare', 'Non ancora elaborata.'));
    if (conPrefattura) {
      sotto.push(pref.length
        ? voce('fatto', `Prefattura Ecotyre caricata${pref[0].caricata_il ? ` il ${it(giornoDi(pref[0].caricata_il))}` : ''}${pref[0].nome_file ? ` (${pref[0].nome_file})` : ''}: il confronto ordine per ordine si rifà a ogni apertura della Fatturazione.`)
        : voce(chiusa ? 'info' : 'da_fare', chiusa ? 'Prefattura Ecotyre non caricata, ma il canale è chiuso.' : 'Prefattura Ecotyre non caricata: il confronto con il portale si fa prima di esportare.'));
    }
    if (d) {
      const errori = Number(d.voci_errore) || 0;
      sotto.push(approvata ? voce('fatto', 'Approvata.') : voce('da_fare', `Da verificare e approvare${errori ? `: ${errori} ${errori === 1 ? 'riga' : 'righe'} in errore, da sistemare prima` : ''}.`));
      sotto.push(esportata ? voce('fatto', 'Esportata dopo l\'approvazione.') : voce(chiusa ? 'info' : 'da_fare', chiusa ? 'Nessuna esportazione registrata dopo l\'approvazione.' : 'Da esportare dopo l\'approvazione.'));
      sotto.push(chiusa
        ? voce('fatto', `Chiusa: fattura confermata${d.fattura_confermata_il ? ` il ${it(d.fattura_confermata_il)}` : ''}${d.fattura_numero ? ` (n. ${d.fattura_numero})` : ''}.`)
        : voce('da_fare', 'Da chiudere quando l\'amministrazione conferma la fattura.'));
    }
    p.voci = sotto;
    if (chiusa) {
      p.stato = 'fatto';
      p.dettaglio = sotto[sotto.length - 1].testo;
      return p;
    }
    const cosa = !d ? "l'elaborazione dell'attiva"
      : conPrefattura && !pref.length ? 'la prefattura Ecotyre'
        : !approvata ? "l'approvazione dell'attiva"
          : !esportata ? "l'esportazione dell'attiva"
            : 'la conferma della fattura';
    p.manca = { cosa, canale: c };
    p.dettaglio = `${d ? `In stato «${d.stato}».` : 'Il mese non è ancora stato elaborato per questo canale.'} Manca ${cosa}.`;
    return p;
  });
}

// === 5. La passiva, un canale per volta ===

const primoMese = (righe, idxDi) => {
  let primo = null;
  for (const r of righe || []) { const k = idxDi(r); if (k !== null && (primo === null || k < primo)) primo = k; }
  return primo;
};
const idxNumero = (r) => (r && Number(r.anno) && Number(r.mese) >= 1 && Number(r.mese) <= 12 ? indiceMese(r.anno, Number(r.mese) - 1) : null);
const etichettaIndice = (k) => `${minuscolo(MESI_CHIUSURA[k % 12])} ${Math.floor(k / 12)}`;

/**
 * LA PASSIVA DI UN CANALE: congelata e con i consuntivi dei fornitori
 * confrontati (decisioni dell'utente del 29/09/2026: il conto si congela alla
 * chiusura, e il consuntivo del fornitore si confronta con quello). Nessun
 * importo: il congelato e i consuntivi si dicono per stato, non per euro.
 *
 * I passi che un modulo non faceva ancora non si chiedono ai mesi di prima:
 * prima del primo mese congelato la passiva non si congelava, prima del primo
 * consuntivo caricato i consuntivi non arrivavano nel gestionale. Il confine
 * pero' non va mai oltre settembre 2026, il primo mese chiuso qui
 * (PRIMO_MESE_DEL_GESTIONALE): senza nessun fatto scritto, o col primo fatto di
 * ottobre, settembre si chiede (revisione, 12/10/2026).
 *
 * Quali consuntivi aspettarsi non lo dice nessun archivio: si confrontano coi
 * fornitori (nome normalizzato e ruolo) che li avevano mandati il mese prima,
 * dicendo che e' un confronto. Sulla rete il consuntivo c'e' sempre; ACI ed
 * extra raccolta possono non averne (utente, 01/10/2026).
 */
export function passiPassiva({ periodo, chiusure = [], consuntivi = [], documenti = [], chiaveDi = (s) => String(s || '').trim().toLowerCase(), movimentiExtra = null }) {
  const idx = indiceMese(periodo.anno, periodo.mese_idx);
  // Dal primo congelamento o consuntivo, o da settembre 2026 se viene prima:
  // ai mesi di prima non si chiedono (revisione, 11-12/10/2026).
  const primoCongelato = primoDaChiedere(primoMese(chiusure, idxNumero));
  const primoConsuntivo = primoDaChiedere(primoMese(consuntivi, idxNumero));
  const nuoviExtra = movimentiExtraNelMese(movimentiExtra, periodo);
  const prec = periodo.mese_idx === 0 ? { anno: periodo.anno - 1, numero: 12, mese: MESI_CHIUSURA[11] } : { anno: periodo.anno, numero: periodo.numero - 1, mese: MESI_CHIUSURA[periodo.mese_idx - 1] };
  const docs = documentiAttivaDelMese(documenti, periodo);
  const chiave = (x) => `${chiaveDi(x.fornitore)}|${x.ruolo || ''}`;
  return CANALI_CHIUSURA.map(c => {
    const nome = NOMI_CANALI_CHIUSURA[c];
    const linkPassiva = conPeriodo('/fatturazione', 'passiva', periodo, c);
    const linkConsuntivi = conPeriodo('/verifiche-fornitori', 'consuntivi', periodo, c);
    const p = nuovoPasso(`passiva_${c}`, `Passiva ${TITOLI_CANALI[c]}`,
      'Il conto della passiva cambia a ogni caricamento: si congela alla chiusura, così il consuntivo che un fornitore manda il mese dopo si confronta col mese di allora. Il giudizio sul consuntivo è quello che autorizza la sua fattura.',
      linkPassiva, c);
    if (vuotoDavvero(documentoDelCanale(docs, c), c, c === 'EXTRA_RACCOLTA' ? nuoviExtra : null)) {
      p.stato = 'non_serve';
      p.dettaglio = `Nessun movimento di ${nome} nel mese (l'attiva non ha righe): niente da pagare ai fornitori.`;
      return p;
    }
    const congelato = (chiusure || []).filter(x => x && Number(x.anno) === periodo.anno && Number(x.mese) === periodo.numero && x.canale === c)
      .sort((a, b) => String(b.congelato_il || '').localeCompare(String(a.congelato_il || '')))[0] || null;
    let vCong;
    if (congelato) vCong = voce('fatto', `Congelata${congelato.congelato_il ? ` il ${it(giornoDi(congelato.congelato_il))}` : ''}${congelato.congelato_da ? ` da ${congelato.congelato_da}` : ''}.`, linkPassiva);
    else if (idx < primoCongelato) vCong = voce('non_serve', primoCongelato === PARTENZA ? `${chiusoFuori(periodo)}, e la passiva non si congelava.` : `Prima di ${etichettaIndice(primoCongelato)} la passiva non si congelava.`, linkPassiva);
    else vCong = voce('da_fare', 'Non congelata: senza, un consuntivo che arriva fra due mesi si confronta con il ricalcolo di quel giorno, non con il conto del mese.', linkPassiva);

    const delMese = (consuntivi || []).filter(x => x && Number(x.anno) === periodo.anno && Number(x.mese) === periodo.numero && x.canale === c);
    const delPrima = (consuntivi || []).filter(x => x && Number(x.anno) === prec.anno && Number(x.mese) === prec.numero && x.canale === c);
    const presenti = new Set(delMese.map(chiave));
    const mancanti = [...new Map(delPrima.filter(x => !presenti.has(chiave(x))).map(x => [chiave(x), `${x.fornitore} (${x.ruolo || 'ruolo non scritto'})`])).values()];
    const nonQuadrano = delMese.filter(x => x.quadra === false);
    const daConfrontare = delMese.filter(x => x.quadra !== true && x.quadra !== false);
    let vCons;
    if (idx < primoConsuntivo) {
      vCons = voce('non_serve', primoConsuntivo === PARTENZA ? `${chiusoFuori(periodo)}, e i consuntivi dei fornitori non si caricavano qui.` : `Prima di ${etichettaIndice(primoConsuntivo)} i consuntivi dei fornitori non si caricavano nel gestionale.`, linkConsuntivi);
    } else if (!delMese.length && !delPrima.length && c !== 'RETE') {
      vCons = voce('non_serve', `Nessun consuntivo di ${nome}, né questo mese né ${aMese(prec.mese)}: per questo canale non se ne aspettano.`, linkConsuntivi);
    } else if (!delMese.length) {
      vCons = voce('da_fare', `Nessun consuntivo dei fornitori caricato${mancanti.length ? `: ${aMese(prec.mese)} li avevano mandati ${elenco(mancanti)}` : ''}.`, linkConsuntivi);
    } else {
      const parti = [`${delMese.length} ${delMese.length === 1 ? 'consuntivo caricato' : 'consuntivi caricati'}`];
      if (nonQuadrano.length) parti.push(`${nonQuadrano.length === 1 ? 'non quadra' : 'non quadrano'}: ${elenco(nonQuadrano.map(x => x.fornitore))}`);
      if (daConfrontare.length) parti.push(`da confrontare: ${elenco(daConfrontare.map(x => x.fornitore))}`);
      if (mancanti.length) parti.push(`${aMese(prec.mese)} li avevano mandati anche ${elenco(mancanti)}: se hanno lavorato ${aMese(periodo.mese)}, il loro manca`);
      const ok = !nonQuadrano.length && !daConfrontare.length && !mancanti.length;
      vCons = voce(ok ? 'fatto' : 'da_fare', `${parti.join('; ')}${ok ? ', e quadrano tutti' : ''}.`, linkConsuntivi);
    }
    p.voci = [vCong, vCons];
    if (p.voci.every(v => v.stato === 'non_serve')) {
      p.stato = 'non_serve';
      p.dettaglio = '';
      return p;
    }
    if (p.voci.every(v => v.stato !== 'da_fare')) {
      p.stato = 'fatto';
      p.dettaglio = '';
      return p;
    }
    const primo = p.voci.find(v => v.stato === 'da_fare');
    p.link = primo.link;
    p.manca = { cosa: primo === vCong ? 'il congelamento della passiva' : 'i consuntivi dei fornitori', canale: c };
    p.dettaglio = `Manca ${p.manca.cosa}.`;
    return p;
  });
}

// === 6. Le quadrature FIR ===

const NOME_CANALE_QUADRATURA = { RETE: 'rete', ACI: 'ACI', 'EXTRA RACCOLTA': 'extra raccolta' };

/**
 * LE QUADRATURE FIR DELLE SETTIMANE DEL MESE: la stampa dei formulari contro
 * portale e gestionale, una settimana per volta (QuadraturaFir). Fatta vuol dire
 * completata e piena su ogni canale; parziale e' da chiarire. Da settembre
 * 2026, il primo mese chiuso nel gestionale (PRIMO_MESE_DEL_GESTIONALE), si
 * chiedono tutte le settimane del mese; nei mesi di prima solo quelle dalla
 * prima quadratura caricata in poi, se ce n'e' una. Una settimana con la sua
 * quadratura si guarda sempre. Fino al 12/10/2026, senza nessuna quadratura il
 * confine era il mese che si chiude adesso, e scivolava col calendario.
 */
export function passoQuadrature({ periodo, quadrature = [] }) {
  const p = nuovoPasso('quadrature_fir', 'Quadrature FIR delle settimane',
    'La quadratura confronta, settimana per settimana, la stampa dei formulari con il portale e con il gestionale: dice che i carichi del mese ci sono tutti, e una volta sola, prima di fatturarli e di pagarli.',
    '/verifiche?tab=quadratura-fir');
  const settimane = settimaneDelMese(periodo);
  const chiaveSett = (anno, s) => Number(anno) * 100 + Number(s);
  const prima = primoMese(quadrature, (q) => (q && Number(q.anno) && Number(q.settimana) ? chiaveSett(q.anno, q.settimana) : null));
  // Un mese da settembre 2026 in poi chiede tutte le sue settimane.
  const dalGestionale = indiceMese(periodo.anno, periodo.mese_idx) >= PARTENZA;
  // Il confine di un mese di prima: la prima quadratura, se e' di prima di
  // settembre 2026; altrimenti settembre 2026, e il mese si e' chiuso fuori.
  const w0 = settimaneDelMese(PRIMO_MESE_DEL_GESTIONALE)[0];
  const confineFatto = prima !== null && prima < chiaveSett(w0.anno, w0.settimana);
  const quando = (q) => String((q && (q.verificata_il || q.avviata_il || q.created_date)) || '');
  const canaleDetto = (x) => NOME_CANALE_QUADRATURA[x.canale] || minuscolo(x.canale);
  let daFare = 0, nonServe = 0;
  const settimaneDaFare = [];
  for (const w of settimane) {
    const nome = `Settimana ${w.settimana} (${it(w.lunedi).slice(0, 5)}–${it(w.domenica).slice(0, 5)})`;
    const q = (quadrature || []).filter(x => x && Number(x.anno) === w.anno && Number(x.settimana) === w.settimana)
      .sort((a, b) => quando(b).localeCompare(quando(a)))[0] || null;
    const no = (testo) => { daFare++; settimaneDaFare.push(w.settimana); p.voci.push(voce('da_fare', `${nome}: ${testo}`)); };
    if (!q) {
      if (!dalGestionale && (prima === null || chiaveSett(w.anno, w.settimana) < prima)) { nonServe++; p.voci.push(voce('non_serve', `${nome}: ${confineFatto ? 'prima della prima quadratura caricata' : `le quadrature si chiedono da ${minuscolo(PRIMO_MESE_DEL_GESTIONALE.etichetta)}, il primo mese chiuso nel gestionale`}.`)); continue; }
      no('non ancora fatta.');
      continue;
    }
    if (q.stato === 'in_lettura') { no('la stampa è ancora in lettura.'); continue; }
    if (q.stato === 'errore') { no(`la lettura non è riuscita${q.errore ? ` (${q.errore})` : ''}: va ricaricata.`); continue; }
    const canali = (q.per_canale || []).filter(Boolean);
    const parziali = canali.filter(x => x.conformita !== 'piena');
    if (parziali.length) {
      no(`fatta, da chiarire su ${elenco(parziali.map(x => `${canaleDetto(x)}${Number(x.incongruenti) ? ` (${x.incongruenti} ${Number(x.incongruenti) === 1 ? 'riga non torna' : 'righe non tornano'})` : ''}`))}.`);
      continue;
    }
    p.voci.push(voce('fatto', canali.length ? `${nome}: quadra su ${elenco(canali.map(canaleDetto))}.` : `${nome}: fatta (l'esito per canale non è scritto).`));
  }
  if (!settimane.length || nonServe === settimane.length) {
    p.stato = 'non_serve';
    p.dettaglio = confineFatto ? 'Nessuna settimana del mese da quadrare: le quadrature sono cominciate dopo.' : `Nessuna settimana del mese da quadrare. ${chiusoFuori(periodo)}.`;
    return p;
  }
  const contano = settimane.length - nonServe;
  if (!daFare) {
    p.stato = 'fatto';
    p.dettaglio = `${contano} ${contano === 1 ? 'settimana quadrata' : 'settimane quadrate'}.`;
    return p;
  }
  p.dettaglio = `${daFare} ${daFare === 1 ? 'settimana' : 'settimane'} su ${contano} da fare o da chiarire.`;
  p.manca = { cosa: daFare === 1 ? `la quadratura FIR della settimana ${settimaneDaFare[0]}` : `le quadrature FIR di ${daFare} settimane` };
  return p;
}

// === Il mese intero ===

// Le letture da cui dipende ogni passo: se una non riesce, il passo non si da'
// per fatto. Meglio un «non so» che un verde falso.
const LETTURE_DEI_PASSI = {
  dati: ['registro', 'fino_al'],
  terminati: ['alert', 'eseguiti'],
  dichiarazioni: ['fotografia', 'dichiarazioni', 'pratiche'],
  attiva: ['documenti', 'prefatture', 'esportazioni'],
  passiva: ['documenti', 'chiusure', 'consuntivi'],
  quadrature_fir: ['quadrature'],
};
// L'extra raccolta guarda anche i suoi movimenti del mese (movimentiExtraNelMese).
const LETTURE_DELL_EXTRA = ['movimenti_extra'];

/** Le cose che mancano, raggruppate: «la prefattura Ecotyre (rete e ACI)». */
export function raggruppaMancanze(mancanze) {
  const gruppi = [];
  for (const m of mancanze || []) {
    if (!m || !m.cosa) continue;
    let g = gruppi.find(x => x.cosa === m.cosa);
    if (!g) { g = { cosa: m.cosa, canali: [], dal: m.dal || null }; gruppi.push(g); }
    if (m.canale && !g.canali.includes(m.canale)) g.canali.push(m.canale);
  }
  return gruppi.map(g => {
    const canali = CANALI_CHIUSURA.filter(c => g.canali.includes(c)).map(c => NOMI_CANALI_CHIUSURA[c]);
    return `${g.cosa}${canali.length ? ` (${elenco(canali)})` : ''}${g.dal ? ` (dal ${it(g.dal)})` : ''}`;
  });
}

const plurale = (frase) => /^(i|gli|le) /.test(frase);

/** La riga della dashboard: «Settembre 2026: 6 di 9 fatti, mancano ...». */
export function sintesiDelMese(periodo, passi) {
  const fatti = passi.filter(p => p.stato === 'fatto').length;
  const contano = passi.filter(p => p.stato !== 'non_serve').length;
  const mancano = raggruppaMancanze(passi.filter(p => p.stato === 'da_fare').map(p => p.manca));
  if (fatti === contano) return `${periodo.etichetta}: ${fatti} di ${contano} fatti, il mese è chiuso.`;
  // Un passo da fare senza la sua frase non fa dire «chiuso» al mese.
  if (!mancano.length) return `${periodo.etichetta}: ${fatti} di ${contano} fatti.`;
  const primi = mancano.slice(0, 4);
  const altri = mancano.length - primi.length;
  const parti = [...primi, ...(altri ? [(altri === 1 ? "un'altra cosa" : `altre ${altri} cose`)] : [])];
  const verbo = parti.length > 1 || plurale(parti[0]) ? 'mancano' : 'manca';
  return `${periodo.etichetta}: ${fatti} di ${contano} fatti, ${verbo} ${elenco(parti)}.`;
}

/**
 * LA LISTA DI CONTROLLO DEL MESE. dati: { periodo, oggi, freschezza, alert,
 * eseguiti, fotografia, dichiarazioni, pratiche, documenti, prefatture,
 * esportazioni, chiusure, consuntivi, quadrature, movimenti_extra, chiaveDi,
 * non_letti }. documenti: quelli dell'attiva di tutti gli anni (il primo mese
 * del gestionale). movimenti_extra: i terminati dell'extra raccolta, o null.
 * non_letti: le letture che non sono riuscite (vedi LETTURE_DEI_PASSI).
 */
export function chiusuraDelMese(dati) {
  const { periodo, oggi } = dati;
  const chiaveDi = dati.chiaveDi || ((s) => String(s || '').trim().toLowerCase());
  const movimentiExtra = Array.isArray(dati.movimenti_extra) ? dati.movimenti_extra : null;
  const passi = [
    passoDati({ periodo, oggi, freschezza: dati.freschezza }),
    passoTerminati({ periodo, alert: dati.alert, eseguiti: dati.eseguiti }),
    passoDichiarazioni({ periodo, oggi, fotografia: dati.fotografia, dichiarazioni: dati.dichiarazioni, pratiche: dati.pratiche, chiaveDi }),
    ...passiAttiva({ periodo, documenti: dati.documenti, prefatture: dati.prefatture, esportazioni: dati.esportazioni, movimentiExtra }),
    ...passiPassiva({ periodo, chiusure: dati.chiusure, consuntivi: dati.consuntivi, documenti: dati.documenti, chiaveDi, movimentiExtra }),
    passoQuadrature({ periodo, quadrature: dati.quadrature }),
  ];
  const nonLetti = new Set(dati.non_letti || []);
  if (nonLetti.size) {
    for (const p of passi) {
      const gruppo = p.chiave.startsWith('attiva_') ? 'attiva' : p.chiave.startsWith('passiva_') ? 'passiva' : p.chiave;
      const letture = [...(LETTURE_DEI_PASSI[gruppo] || []), ...(p.canale === 'EXTRA_RACCOLTA' ? LETTURE_DELL_EXTRA : [])];
      if (!letture.some(k => nonLetti.has(k))) continue;
      p.stato = 'da_fare';
      p.lettura_non_riuscita = true;
      p.voci = [];
      p.dettaglio = 'Una lettura non è riuscita: non so dire se questo passo è fatto. Riprova fra poco.';
      p.manca = { cosa: 'le verifiche non riuscite' };
    }
  }
  const conteggio = {
    fatti: passi.filter(p => p.stato === 'fatto').length,
    da_fare: passi.filter(p => p.stato === 'da_fare').length,
    non_serve: passi.filter(p => p.stato === 'non_serve').length,
  };
  conteggio.totale = conteggio.fatti + conteggio.da_fare;
  return { mese: periodo, passi, conteggio, sintesi: sintesiDelMese(periodo, passi) };
}

// CHE COSA MANCA A UN MESE PER DIRSI CHIUSO: l'attiva di ogni canale, e la
// passiva dal primo mese da chiedere in poi. Un elenco vuoto se non manca
// niente. Sta a parte (giro K8, 12/10/2026) perche' la usa anche il piano dei
// mesi chiusi fuori, per dire prima di scrivere se il mese dopo resta aperto:
// una regola sola, non una seconda che puo' dire un'altra cosa.
function mancanzeDelMese(periodo, { docs, chiusure, primoCongelato, movimentiExtra }) {
  const k = indiceMese(periodo.anno, periodo.mese_idx);
  const delMese = documentiAttivaDelMese(docs, periodo);
  // Prima l'attiva, poi la passiva, come nella lista del mese.
  const attiva = [];
  const passiva = [];
  const nuoviExtra = movimentiExtraNelMese(movimentiExtra, periodo);
  for (const c of CANALI_CHIUSURA) {
    const d = documentoDelCanale(delMese, c);
    if (vuotoDavvero(d, c, c === 'EXTRA_RACCOLTA' ? nuoviExtra : null)) continue;
    if (senzaRighe(d)) attiva.push({ cosa: mancaAlVuoto(nuoviExtra), canale: c });
    else if (!d) attiva.push({ cosa: "l'elaborazione dell'attiva", canale: c });
    else if (d.stato !== 'chiusa') attiva.push({ cosa: "la chiusura dell'attiva", canale: c });
    // chiusure null = la lettura non e' riuscita: la passiva non si giudica.
    if (chiusure !== null && k >= primoCongelato
      && !(chiusure || []).some(x => x && Number(x.anno) === periodo.anno && Number(x.mese) === periodo.numero && x.canale === c)) {
      passiva.push({ cosa: 'il congelamento della passiva', canale: c });
    }
  }
  return [...attiva, ...passiva];
}

/**
 * I MESI PRIMA DELL'ULTIMO FINITO ANCORA APERTI, anche dell'anno prima: un
 * dicembre mai chiuso non diventa a posto perche' e' cominciato marzo (la
 * lezione di statoMesiAttiva, cruscotto.ts). Si guardano dal primo mese che ha
 * un documento dell'attiva, nell'anno dell'ultimo mese finito e in quello
 * prima: un mese fatturato prima che il gestionale esistesse non si e' mai
 * chiuso qui. Aperto vuol dire che manca la chiusura dell'attiva di un canale,
 * o il congelamento della passiva dal primo mese congelato in poi, o da
 * settembre 2026 se viene prima (PRIMO_MESE_DEL_GESTIONALE, revisione del
 * 12/10/2026: senza nessun congelamento la passiva non entrava mai in elenco, e
 * settembre mai congelato non lo diceva nessuno): sono gli archivi piccoli che
 * la dashboard legge gia'. Il dettaglio di ogni mese si chiede a parte, quando
 * lo si apre. L'extra raccolta di un documento senza righe resta aperta se nel
 * mese ci sono movimenti finiti (movimentiExtra, revisione dell'11/10/2026).
 */
export function mesiAncoraAperti({ ultimo, documenti = [], chiusure = [], movimentiExtra = null }) {
  if (!ultimo) return [];
  const fineFinestra = indiceMese(ultimo.anno, ultimo.mese_idx);
  const docs = (documenti || []).filter(d => d && d.tipo === 'ATTIVA' && !d.superato && d.stato !== 'bozza' && MESI_CHIUSURA.includes(d.mese));
  const primo = primoMese(docs.filter(d => Number(d.anno) >= ultimo.anno - 1), (d) => indiceMese(d.anno, MESI_CHIUSURA.indexOf(d.mese)));
  if (primo === null || primo >= fineFinestra) return [];
  const primoCongelato = primoDaChiedere(primoMese(chiusure, idxNumero));
  const out = [];
  for (let k = primo; k < fineFinestra; k++) {
    const periodo = periodoDelMese(Math.floor(k / 12), k % 12);
    const mancano = mancanzeDelMese(periodo, { docs, chiusure, primoCongelato, movimentiExtra });
    if (!mancano.length) continue;
    const testi = raggruppaMancanze(mancano);
    out.push({
      anno: periodo.anno, mese: periodo.mese, numero: periodo.numero, etichetta: periodo.etichetta,
      // Un mese di prima di settembre 2026 si e' chiuso fuori: il pannello offre
      // all'amministratore di segnarlo chiuso (pianoMesiChiusiFuori).
      prima_del_gestionale: k < PARTENZA,
      mancano: testi,
      sintesi: `${periodo.etichetta}: ${testi.length > 1 || plurale(testi[0]) ? 'mancano' : 'manca'} ${elenco(testi)}.`,
    });
  }
  return out;
}

// === I mesi fatturati prima del gestionale ===

/**
 * I MESI FATTURATI PRIMA DEL GESTIONALE SI SEGNANO CHIUSI (giro K8, 12/10/2026).
 *
 * L'attiva di gennaio-agosto 2026 e' stata elaborata a posteriori (gennaio il
 * 18/09, febbraio-agosto il 06/10/2026), ma le fatture di quei mesi si sono
 * fatte fuori: il gestionale e' nato a fine estate. La chiusura del mese li
 * elencava tutti e otto fra i mesi ancora aperti, con «manca la chiusura
 * dell'attiva». Decisione dell'utente dell'11/10/2026, testuale: «si chiudili
 * nel gestionale come se fossero già stati fatti (è ovvio perchè il gestionale
 * è nato solo due mesi fa)».
 *
 * Non con una regola speciale qui: i documenti dell'attiva di quei mesi vanno
 * nello stato che tutti i moduli leggono gia', «chiusa» - Fatturazione attiva,
 * dashboard, «Da gestire», chiusura del mese, EcoTyna - con la nota che dice
 * com'e' andata e una riga nello storico delle modifiche. Si scrivono i campi
 * della chiusura vera (cambiaStatoFatturazione) che hanno senso: stato,
 * data_chiusura (quando si e' segnato qui) e chi l'ha registrato. Il giorno e
 * il numero della fattura no: non si sanno, e non si inventano. Si riapre col
 * «Riapri» di sempre.
 *
 * Tutti i documenti del mese, anche l'extra raccolta senza righe: la griglia
 * della dashboard dice chiuso un mese solo se sono chiusi tutti e tre i canali
 * (statoMesiAttiva). Un canale senza documento invece non si chiude: un
 * documento creato apposta, senza righe ne' totale, la pagina e EcoTyna lo
 * leggerebbero come zero euro fatturati. Si dice, e il mese resta aperto su
 * quel canale finche' non si elabora. Nemmeno l'extra raccolta a zero righe con
 * dei movimenti finiti nel mese: il documento e' di prima, e chiuso non si
 * rielabora piu'. Sulla copia dei dati veri dell'11/10/2026 nessuno dei due
 * casi: ognuno degli otto mesi ha i suoi tre documenti, e l'extra raccolta di
 * aprile e di luglio ha la sua riga.
 *
 * Solo i mesi prima di settembre 2026 (PRIMO_MESE_DEL_GESTIONALE): da li' un
 * mese si chiude in Fatturazione attiva, con la conferma della fattura. Nei
 * mesi ancora aperti quelli di prima portano prima_del_gestionale, e il
 * pannello offre all'amministratore di segnarli. Scrive la funzione
 * segnaMesiChiusiFuori; qui le regole, pure.
 */
export const NOTA_CHIUSO_FUORI = "Chiuso fuori dal gestionale: fatturato prima dell'avvio, decisione dell'utente dell'11/10/2026";
export const ORIGINE_CHIUSO_FUORI = 'Chiusura del mese: mesi fatturati prima del gestionale';

/**
 * Vero per un documento chiuso da quest'azione: chiuso, con la nota, e senza la
 * conferma della fattura. Riaperto e richiuso davvero non lo e' piu': Riapri
 * lascia la nota, ma la chiusura vera scrive il giorno della conferma.
 */
export function chiusoFuoriDalGestionale(d) {
  return !!d && d.stato === 'chiusa' && !d.fattura_confermata_il && String(d.note || '').includes(NOTA_CHIUSO_FUORI);
}

/** La frase di un documento chiuso fuori, come la dice la chiusura del mese. */
export function testoChiusoFuori(d) {
  const quando = d && d.data_chiusura ? ` il ${it(giornoDi(d.data_chiusura))}` : '';
  return `Fatturata fuori dal gestionale, prima dell'avvio: segnata chiusa${quando} (decisione dell'utente dell'11/10/2026).`;
}

/**
 * Che cosa si scrive su un documento: stato, data_chiusura, chi l'ha
 * registrato e la riga della nota, in coda alle note che c'erano, come fa
 * Riapri. giorno e' il giorno italiano, quando l'istante.
 */
export function patchChiusoFuori(d, { utente = '', quando, giorno }) {
  const riga = `${NOTA_CHIUSO_FUORI}. Segnato chiuso il ${it(giorno)}${utente ? ` da ${utente}` : ''}: era «${d.stato}».`;
  return {
    stato: 'chiusa',
    data_chiusura: quando,
    ...(utente ? { fattura_confermata_da: utente } : {}),
    note: [d.note, riga].filter(x => String(x || '').trim()).join('\n'),
  };
}

const CANALE_ETICHETTA = { RETE: 'RETE', ACI: 'ACI', EXTRA_RACCOLTA: 'EXTRA RACCOLTA' };

/**
 * La riga dello storico delle modifiche di un documento segnato chiuso, nella
 * forma di ModificaDato. Lo stato di un documento non e' fra i campi tracciati
 * (CAMPI_TRACCIATI): la riga si scrive a parte, col registro di sempre.
 */
export function rigaStoricoChiusoFuori(d, { utente = '', il }) {
  return {
    entita: 'DocumentoFatturazione', record_id: String(d.id || ''),
    etichetta: `Fatturazione attiva · ${CANALE_ETICHETTA[d.tipologia] || 'tutti i canali'} · ${minuscolo(d.mese)} ${d.anno}`,
    campo: 'stato', ...(d.stato ? { prima: String(d.stato) } : {}), dopo: 'chiusa', unita: 'testo', operazione: 'update',
    utente, il, origine: ORIGINE_CHIUSO_FUORI, motivo: NOTA_CHIUSO_FUORI, riservato: false,
    ...(Number(d.anno) ? { anno: Number(d.anno) } : {}),
  };
}

// Com'e' un documento, in una riga del piano: «elaborata il 06/10/2026, 316 righe».
const comeDocumento = (d) => {
  const righe = typeof d.numero_voci === 'number' ? (d.numero_voci === 0 ? 'senza righe' : `${d.numero_voci} ${d.numero_voci === 1 ? 'riga' : 'righe'}`) : '';
  const errori = Number(d.voci_errore) || 0;
  return [
    d.data_elaborazione ? `elaborata il ${it(giornoDi(d.data_elaborazione))}` : '',
    righe,
    errori ? `${errori} ${errori === 1 ? 'riga' : 'righe'} in errore, che restano come sono` : '',
  ].filter(Boolean).join(', ');
};

/**
 * IL PIANO: che cosa cambierebbe, mese per mese e canale per canale, prima di
 * scrivere. mesi: [{ anno, mese }] (mese col nome o col numero). documenti:
 * quelli dell'attiva di tutti gli anni, come li legge statoChiusuraMese.
 * chiusure e movimentiExtra servono a dire, con la regola dei mesi ancora
 * aperti (mancanzeDelMese), se il mese dopo resta aperto e per che cosa: la
 * passiva prima di settembre 2026 non si chiede, e un'extra raccolta a zero
 * righe con dei movimenti finiti nel mese non si chiude, va prima rielaborata.
 *
 * Risponde { mesi, rifiutati, documenti_da_chiudere, sintesi }. Per ogni mese i
 * canali (azione 'chiude', 'gia_chiusa', 'senza_documento' o 'da_rielaborare',
 * col testo), lo stato prima e dopo ({ aperto, mancano }) e come resta, detto
 * col nome del mese (frase) e senza (esito, accanto al nome nella conferma); i
 * mesi che non si segnano, col perche'; i documenti da chiudere, ognuno una
 * volta.
 */
export function pianoMesiChiusiFuori({ mesi = [], oggi, documenti = [], chiusure = [], movimentiExtra = null }) {
  const ultimo = ultimoMeseFinito(oggi);
  const ultimoFinito = indiceMese(ultimo.anno, ultimo.mese_idx);
  const rifiutati = [];
  const scelti = new Map();
  for (const m of Array.isArray(mesi) ? mesi : []) {
    const anno = Number(m && m.anno);
    const idx = meseDa(m && m.mese);
    if (!Number.isInteger(anno) || anno < 2000 || idx === null || idx === undefined) {
      rifiutati.push({ anno: (m && m.anno) ?? null, mese: (m && m.mese) ?? null, perche: 'Mese non riconosciuto: servono l\'anno e il mese.' });
      continue;
    }
    const periodo = periodoDelMese(anno, idx);
    const k = indiceMese(anno, idx);
    if (k >= PARTENZA) {
      rifiutati.push({ anno, mese: periodo.mese, perche: k === PARTENZA
        ? `${periodo.etichetta} è il primo mese chiuso nel gestionale: si chiude in Fatturazione attiva, con la conferma della fattura.`
        : `${periodo.etichetta} si chiude nel gestionale, come ogni mese da ${minuscolo(PRIMO_MESE_DEL_GESTIONALE.etichetta)}: in Fatturazione attiva, con la conferma della fattura.` });
      continue;
    }
    if (k > ultimoFinito) {
      rifiutati.push({ anno, mese: periodo.mese, perche: `${periodo.etichetta} non è ancora finito.` });
      continue;
    }
    scelti.set(k, periodo);
  }
  const daChiudere = [];
  const presi = new Set();
  const perMese = [...scelti.entries()].sort((a, b) => a[0] - b[0]).map(([, periodo]) => {
    const delMese = documentiAttivaDelMese(documenti, periodo);
    // Un documento senza canale (di prima dei documenti per canale) vale per
    // tutto il mese, come in documentoDelCanale: si chiude una volta.
    const senzaCanale = delMese.filter(d => !CANALI_CHIUSURA.includes(d.tipologia));
    const canali = CANALI_CHIUSURA.map(c => {
      const suoi = delMese.filter(d => d.tipologia === c);
      const docs = suoi.length ? suoi : senzaCanale;
      const titolo = TITOLI_CANALI[c];
      if (!docs.length) {
        return { canale: c, azione: 'senza_documento', documenti: [],
          testo: `${titolo}: nessun documento dell'attiva. Non si chiude da qui: un documento creato apposta direbbe zero euro fatturati. Si elabora in Fatturazione attiva, poi si segna chiuso.` };
      }
      const aperti = docs.filter(d => d.stato !== 'chiusa');
      if (!aperti.length) return { canale: c, azione: 'gia_chiusa', documenti: [], testo: `${titolo}: già chiusa.` };
      // L'extra raccolta elaborata a zero righe con dei movimenti finiti nel
      // mese e' di prima di quei movimenti (movimentiExtraNelMese): chiusa,
      // restava «da rielaborare» e non si poteva piu' rielaborare senza
      // riaprirla. Non si chiude: si rielabora (o si scrive il peso), poi si
      // segna. Sulla copia dei dati veri dell'11/10/2026 non succede: aprile e
      // luglio, i due mesi con un intervento, hanno la loro riga.
      const nuovi = c === 'EXTRA_RACCOLTA' && suoi.length ? movimentiExtraNelMese(movimentiExtra, periodo) : null;
      const letto = documentoDelCanale(delMese, c);
      if (nuovi && letto && letto.stato !== 'chiusa' && senzaRighe(letto) && quantiExtra(nuovi) > 0) {
        const n = nuovi.con_peso > 0 ? nuovi.con_peso : nuovi.senza_peso;
        return { canale: c, azione: 'da_rielaborare', documenti: [],
          testo: `${titolo}: ${comeDocumento(letto)}, ma nel mese ${movimentiDetti(n, nuovi.con_peso > 0 ? '' : ' senza il peso effettivo')}. Non si chiude da qui: manca ${mancaAlVuoto(nuovi)}, poi si segna chiuso.` };
      }
      for (const d of aperti) if (!presi.has(d)) { presi.add(d); daChiudere.push(d); }
      const come = aperti.length === 1 ? comeDocumento(aperti[0]) : '';
      return {
        canale: c, azione: 'chiude',
        documenti: aperti.map(d => ({ id: d.id || null, stato_prima: d.stato, numero_voci: typeof d.numero_voci === 'number' ? d.numero_voci : null })),
        testo: aperti.length === 1
          ? `${titolo}: ${come ? `${come}; ` : ''}da «${aperti[0].stato}» a «chiusa».`
          : `${titolo}: ${aperti.length} documenti, da ${elenco([...new Set(aperti.map(d => `«${d.stato}»`))])} a «chiusa».`,
      };
    });
    return { periodo, canali };
  });
  // Prima e dopo con la regola dei mesi ancora aperti, sui documenti di adesso
  // e su quelli che si avrebbero dopo la scrittura.
  const primoCongelato = chiusure === null ? null : primoDaChiedere(primoMese(chiusure, idxNumero));
  const dopoDocs = (documenti || []).map(d => (presi.has(d) ? { ...d, stato: 'chiusa' } : d));
  const statoDi = (docs, periodo) => {
    const m = mancanzeDelMese(periodo, { docs, chiusure, primoCongelato, movimentiExtra });
    return { aperto: m.length > 0, mancano: raggruppaMancanze(m) };
  };
  const out = perMese.map(({ periodo, canali }) => {
    const prima = statoDi(documenti, periodo);
    const dopo = statoDi(dopoDocs, periodo);
    const verbo = dopo.mancano.length > 1 || plurale(dopo.mancano[0] || '') ? 'mancano' : 'manca';
    const esito = dopo.aperto ? `Resta aperto: ${verbo} ${elenco(dopo.mancano)}.` : 'Dopo è chiuso.';
    return {
      anno: periodo.anno, mese: periodo.mese, numero: periodo.numero, etichetta: periodo.etichetta,
      canali, prima, dopo,
      // esito accanto al nome del mese, nella conferma; frase da sola.
      esito,
      frase: dopo.aperto ? `${periodo.etichetta}: resta aperto, ${verbo} ${elenco(dopo.mancano)}.` : `${periodo.etichetta}: chiuso.`,
    };
  });
  const quanti = daChiudere.length;
  const mesiToccati = out.filter(m => m.canali.some(c => c.azione === 'chiude')).length;
  const restano = out.filter(m => m.dopo.aperto).map(m => minuscolo(m.etichetta));
  const sintesi = [
    quanti ? `Da segnare chiusi: ${quanti} ${quanti === 1 ? 'documento' : 'documenti'} dell'attiva in ${mesiToccati} ${mesiToccati === 1 ? 'mese' : 'mesi'}.` : 'Niente da segnare chiuso.',
    restano.length ? `Dopo, ${restano.length === 1 ? 'resta aperto' : 'restano aperti'} ${elenco(restano)}.` : (out.length ? 'Dopo, nessuno di questi mesi resta aperto.' : ''),
  ].filter(Boolean).join(' ');
  return { mesi: out, rifiutati, documenti_da_chiudere: daChiudere, sintesi };
}
