// Le regole con cui si legge un movimento, in un punto solo.
//
// Ogni modulo rileggeva gli archivi e riapplicava a modo suo stato, periodo e
// canale: era la radice di quasi tutte le incongruenze trovate dall'audit del
// 20/09/2026 (periodo letto in quattro modi, regola ACI riscritta in 26 file, 21
// funzioni senza filtro sullo stato). Chi deve decidere "questo movimento conta?
// in che mese? in che canale?" lo chiede qui.
//
// - CONTA un movimento terminato. Cancellati e assegnati non sono raccolto.
// - Il PERIODO e' la fine del trasporto, letta sul giorno italiano. Mai il fuso
//   del server.
// - Anche i TEMPI di un ordine (giorni per evaderlo, esito rispetto alla
//   scadenza) si misurano fino alla fine del trasporto: tempiRaccolta().
// - La CHIUSURA A PORTALE non decide niente: ne' un periodo, ne' un tempo, ne' una
//   giacenza. Si puo' solo mostrare (regola dell'utente, 21/09/2026: "mai, dico
//   mai"). Un movimento senza fine trasporto si esclude e si segnala, non si
//   ripiega sulla chiusura ne' sull'immissione.
// - Il CANALE e' rete, ACI o extra raccolta, con la regola condivisa eAci().
//   I canali non si sommano mai.
//
// Questo file ha uno specchio per il browser: src/lib/movimenti.js. Una regola
// cambiata qui va cambiata la'.
import { giornoRoma } from "./giornoItaliano.ts";
import { eAci } from "./canaleSecondaria.ts";

export const MESI_MOVIMENTI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

export const eTerminato = (r) => String((r && r.stato) || '').toLowerCase().trim() === 'terminato';

/** Il giorno italiano in cui e' finito il trasporto, 'AAAA-MM-GG'. Stringa vuota se manca. */
export const giornoMovimento = (r) => giornoRoma(r && r.trasporto_finito_il);

/** Numero della settimana ISO di un giorno 'AAAA-MM-GG' (lunedi'-domenica), senza passare da nessun fuso. */
export function settimanaIso(giorno) {
  if (!giorno) return null;
  const d = new Date(Date.UTC(+giorno.slice(0, 4), +giorno.slice(5, 7) - 1, +giorno.slice(8, 10)));
  const g = (d.getUTCDay() + 6) % 7;            // lunedi' = 0
  d.setUTCDate(d.getUTCDate() - g + 3);         // il giovedi' della stessa settimana
  const capodanno = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - capodanno) / 86400000 + 1) / 7);
}

/** Il periodo di un movimento: { giorno, anno, mese_idx (0-11), mese, settimana } oppure null. */
export function periodoMovimento(r) {
  const giorno = giornoMovimento(r);
  if (!giorno) return null;
  const meseIdx = Number(giorno.slice(5, 7)) - 1;
  return { giorno, anno: Number(giorno.slice(0, 4)), mese_idx: meseIdx, mese: MESI_MOVIMENTI[meseIdx], settimana: settimanaIso(giorno) };
}

/**
 * Il giorno di un ordine: la fine del trasporto; per chi non l'ha (un ordine
 * cancellato prima del ritiro) la data di immissione. Mai la
 * chiusura a portale: i filtri per anno e per giorno delle pagine la usavano, e
 * un ritiro del 31 dicembre chiuso a gennaio finiva nell'anno dopo mentre il
 * filtro per mese, che legge la fine trasporto, lo teneva a dicembre.
 *
 * Attenzione: giornoOrdine ripiega sull'immissione anche per un TERMINATO
 * senza fine trasporto. Gli elenchi e i filtri delle pagine usano giornoElenco,
 * qui sotto. giornoOrdine e annoOrdine restano per chi attribuisce apposta
 * all'anno di immissione il solo conteggio dei senza fine trasporto
 * (analisiSettimanalePredittiva, calcolaPianificazioneSecondaria,
 * proiezioneSecondarie).
 */
export const giornoOrdine = (r) => giornoMovimento(r) || giornoRoma(r && r.ordine_immesso_il);
export const annoOrdine = (r) => { const g = giornoOrdine(r); return g ? Number(g.slice(0, 4)) : null; };
export const meseOrdine = (r) => { const g = giornoOrdine(r); return g ? MESI_MOVIMENTI[Number(g.slice(5, 7)) - 1] : null; };

/**
 * Il giorno con cui un elenco colloca un ordine, per filtri e colonne di giorno,
 * mese e anno: un terminato solo sulla fine del trasporto; un ordine non
 * terminato, che non e' un movimento, come giornoOrdine (l'immissione, se non ha
 * la fine trasporto). Un terminato senza fine trasporto non ha giorno (stringa
 * vuota), mese ne' anno (null): nessun filtro di periodo lo prende, e chi lo
 * elenca lo conta a parte e lo segnala. Era riscritta a mano in quattro pagine.
 */
export const giornoElenco = (r) => (eTerminato(r) ? giornoMovimento(r) : giornoOrdine(r));
export const annoElenco = (r) => { const g = giornoElenco(r); return g ? Number(g.slice(0, 4)) : null; };
export const meseElenco = (r) => { const g = giornoElenco(r); return g ? MESI_MOVIMENTI[Number(g.slice(5, 7)) - 1] : null; };

/**
 * Le date che un formulario deve sempre avere (regola dell'utente, 22/09/2026):
 * l'immissione dell'ordine, l'inizio e la fine del trasporto. Un ordine
 * TERMINATO a cui ne manca una e' un dato incompleto e si segnala, in ogni modulo
 * dove compaiono ordini terminati - elenchi, conti, verifiche, alert, assistente -
 * non solo nei report settimanali. Chi conta continua a tenerlo fuori dai periodi
 * se manca la fine trasporto (giornoElenco), ma dice quali date mancano.
 * Anche le date nell'ordine sbagliato si segnalano: un inizio prima
 * dell'immissione o una fine prima dell'inizio sono dati sporchi, non ritiri
 * velocissimi.
 */
export const DATE_OBBLIGATORIE = [
  { campo: 'ordine_immesso_il', nome: 'immissione' },
  { campo: 'trasporto_iniziato_il', nome: 'inizio trasporto' },
  { campo: 'trasporto_finito_il', nome: 'fine trasporto' },
];

/** I nomi delle date obbligatorie che mancano a un ordine terminato; [] se ci sono tutte o se non e' terminato. */
export function dateMancanti(r) {
  if (!eTerminato(r)) return [];
  return DATE_OBBLIGATORIE.filter(d => !giornoRoma(r[d.campo])).map(d => d.nome);
}

/** Le incoerenze fra le date di un ordine terminato, a parole; [] se non ce ne sono. */
export function dateIncoerenti(r) {
  if (!eTerminato(r)) return [];
  const immesso = giornoRoma(r.ordine_immesso_il);
  const inizio = giornoRoma(r.trasporto_iniziato_il);
  const fine = giornoRoma(r.trasporto_finito_il);
  const esiti = [];
  if (immesso && inizio && inizio < immesso) esiti.push('inizio trasporto prima dell\'immissione');
  if (inizio && fine && fine < inizio) esiti.push('fine trasporto prima dell\'inizio');
  else if (!inizio && immesso && fine && fine < immesso) esiti.push('fine trasporto prima dell\'immissione');
  return esiti;
}

/** Un ordine terminato con le date da sistemare: ne manca una o sono incoerenti. */
export const dateDaSistemare = (r) => dateMancanti(r).length > 0 || dateIncoerenti(r).length > 0;

/** "manca la data di fine trasporto", "mancano le date di immissione e inizio trasporto", "fine trasporto prima dell'inizio". */
export function testoDate(r) {
  const mancanti = dateMancanti(r);
  const parti = [];
  if (mancanti.length === 1) parti.push(`manca la data di ${mancanti[0]}`);
  else if (mancanti.length > 1) parti.push(`mancano le date di ${mancanti.slice(0, -1).join(', ')} e ${mancanti[mancanti.length - 1]}`);
  parti.push(...dateIncoerenti(r));
  return parti.join('; ');
}

export const GIORNI_SCADENZA_ORDINE = 30;
// i conti si fanno fra giorni di calendario a mezzanotte UTC: il cambio dell'ora
// legale non li sposta, come faceva setDate sull'istante di immissione
const istanteGiorno = (g) => Date.UTC(+g.slice(0, 4), +g.slice(5, 7) - 1, +g.slice(8, 10));

/**
 * I tempi di raccolta di un ordine: i giorni dall'immissione alla FINE DEL
 * TRASPORTO e l'esito rispetto alla scadenza (immissione + 30 giorni), sul giorno
 * italiano. Misurano il ritiro, che e' il lavoro del raccoglitore. Si misuravano
 * fino alla chiusura a portale, una pratica che arriva giorni dopo: un ritiro
 * fatto in 9 giorni e chiuso al 14esimo usciva "Critico" senza nessun ritardo.
 *
 * Restituisce { scadenza: 'AAAA-MM-GG', giorni, esito: 'OK' | 'DOPO SCADENZA' }.
 * Senza fine trasporto giorni ed esito sono null: non si misura e chi conta lo
 * segnala. Lo stesso con una fine trasporto anteriore all'immissione, che e' un
 * dato sporco e non un ritiro velocissimo: darebbe giorni negativi e un "OK" che
 * abbassa la media; allora c'e' anche incoerente: true. null se manca l'immissione.
 */
export function tempiRaccolta(r) {
  const immesso = giornoRoma(r && r.ordine_immesso_il);
  if (!immesso) return null;
  const scadenza = new Date(istanteGiorno(immesso) + GIORNI_SCADENZA_ORDINE * 86400000).toISOString().slice(0, 10);
  const fine = giornoMovimento(r);
  if (!fine) return { scadenza, giorni: null, esito: null };
  if (fine < immesso) return { scadenza, giorni: null, esito: null, incoerente: true };
  const giorni = Math.round((istanteGiorno(fine) - istanteGiorno(immesso)) / 86400000);
  return { scadenza, giorni, esito: fine <= scadenza ? 'OK' : 'DOPO SCADENZA' };
}

/** Il canale di una primaria o di una secondaria. L'archivio dell'extra raccolta si dichiara. */
export const canaleMovimento = (r, archivio = '') => (archivio === 'ExtraRaccolta' ? 'EXTRA_RACCOLTA' : archivio === 'PrimariaAci' || eAci(r) ? 'ACI' : 'RETE');

const comeLista = (v) => (v === undefined || v === null || v === '' ? [] : Array.isArray(v) ? v : [v]);

/**
 * I movimenti che contano per un periodo. filtro: { anno, mese, canale, archivio,
 * ancheNonTerminati }. anno e mese accettano un valore o un elenco; il mese e' il
 * nome italiano o l'indice 0-11. Senza filtro restano i terminati con una fine
 * trasporto leggibile.
 */
export function filtraMovimenti(records, filtro = {}) {
  const anni = comeLista(filtro.anno).map(Number);
  const mesi = comeLista(filtro.mese).map(m => (typeof m === 'number' ? m : MESI_MOVIMENTI.findIndex(x => x.toLowerCase() === String(m).toLowerCase().trim())));
  const canali = comeLista(filtro.canale);
  return (records || []).filter(r => {
    if (!filtro.ancheNonTerminati && !eTerminato(r)) return false;
    const p = periodoMovimento(r);
    if (!p) return false;
    if (anni.length && !anni.includes(p.anno)) return false;
    if (mesi.length && !mesi.includes(p.mese_idx)) return false;
    if (canali.length && !canali.includes(canaleMovimento(r, filtro.archivio))) return false;
    return true;
  });
}
