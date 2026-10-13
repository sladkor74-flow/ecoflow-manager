// LA TO-DO LIST: CHE COSA RESTA DA FARE E CHE COSA E' FATTO (12/10/2026).
//
// Richiesta dell'utente del 12/10/2026, testuale: «gli ordini della 'to-do list'
// quando sono completati vanno spostati nella sezione completati e non solo
// evidenziati come tali». Fino a quel giorno un'attivita' completata restava
// nell'elenco barrata e sbiadita - nella vista «Tutti», l'unica che mostrava
// insieme le aperte e quelle in corso - e una richiesta ECT evasa stava nella
// stessa tabella delle aperte, con la targhetta verde. Adesso le due schede si
// dividono in due: l'elenco DA FARE, e la sezione dei COMPLETATI, chiusa
// all'apertura, col numero, coi piu' recenti in alto, e per ognuno il giorno e il
// perche' del completamento. Chi riapre torna fra i da fare.
//
// La regola che decide se una cosa e' fatta resta quella di sempre, e qui non si
// rifa': per le attivita' lo stato salvato (`completato`, messo a mano o dal
// controllo degli ordini, base44/shared/todoOrdini.ts), per le richieste ECT
// l'esito di statoRichiesta (richiesteEct), che la pagina passa come `esitoDi`.
// Questo file non importa niente apposta: si prova con node cosi' com'e', e la
// divisione non dipende da come si legge un movimento.
//
// I CONTEGGI DICONO SOLO I DA FARE. «Tutti (40)» con dentro trenta attivita'
// chiuse diceva un lavoro che non c'era.

/** 'AAAA-MM-GG' se il valore comincia con un giorno, altrimenti ''. */
const giorno = (v) => {
  const s = String(v ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : '';
};
/** Un giorno 'AAAA-MM-GG' all'italiana, senza passare da new Date. */
export const gg = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '');

// I piu' recenti in alto; chi non ha il giorno in fondo. A pari giorno decide
// `poi` (solo l'ordine: a video non si dice).
const piuRecenti = (giornoDi, poi) => (a, b) => {
  const ga = giornoDi(a) || '', gb = giornoDi(b) || '';
  if (ga !== gb) return ga ? (gb ? gb.localeCompare(ga) : -1) : 1;
  return poi(a, b);
};

// ---------------------------------------------------------------------------
// LE ATTIVITA'

/** Fatta: lo stato salvato e' `completato`. Aperte e in corso sono da fare. */
export const eCompletata = (t) => !!t && t.stato === 'completato';

// Il prefisso che il controllo degli ordini mette davanti al perche'
// (controlloAttivita: «chiusa dal gestionale il GG/MM/AAAA: ...»): a video il
// giorno si dice una volta sola.
const PREFISSO_NOTA = /^chiusa dal gestionale il \d{2}\/\d{2}\/\d{4}:\s*/i;

/**
 * Quando e perche' un'attivita' risulta completata: null se e' ancora da fare.
 * { giorno: 'AAAA-MM-GG' | null, come: 'gestionale' | 'a_mano', perche, prima }.
 *
 * Due strade, due campi. La chiusura del gestionale ha il suo giorno
 * (`chiusa_dal_gestionale_il`) e il suo perche' (`chiusura_nota`); la spunta a
 * mano scrive `completata_il` dal 12/10/2026, e lo toglie quando si riapre. Se ci
 * sono tutti e due vale il piu' recente, e a pari giorno la spunta a mano: il
 * gestionale non chiude mai un'attivita' gia' spuntata ne' una che ha gia'
 * chiuso una volta, quindi la spunta e' venuta dopo.
 *
 * Una spunta messa prima di quel giorno non ha la data: `giorno` e' null, e a
 * video si dice che non e' registrato. Non si prende la data dell'ultima
 * modifica: il controllo degli ordini riscrive anche le attivita' chiuse (gli
 * avvisi, i conteggi), e quel giorno non e' quello della spunta. Per lo stesso
 * motivo, un'attivita' chiusa dal gestionale, riaperta e rispuntata a mano prima
 * del 12/10/2026 risulta ancora chiusa dal gestionale: quella spunta non ha
 * lasciato traccia.
 */
export function completamentoAttivita(t) {
  if (!eCompletata(t)) return null;
  const aMano = giorno(t.completata_il);
  const dalGestionale = t.chiusa_dal_gestionale === true ? giorno(t.chiusa_dal_gestionale_il) : '';
  const nota = String(t.chiusura_nota || '').trim();
  if (t.chiusa_dal_gestionale === true && (!aMano || (dalGestionale && dalGestionale > aMano))) {
    return {
      giorno: dalGestionale || null,
      come: 'gestionale',
      perche: nota.replace(PREFISSO_NOTA, '') || 'i suoi ordini risultano terminati',
      prima: '',
    };
  }
  return {
    giorno: aMano || null,
    come: 'a_mano',
    perche: 'spuntata a mano',
    // Il gestionale l'aveva chiusa una prima volta: resta scritto, non si cancella.
    prima: t.chiusa_dal_gestionale === true ? nota : '',
  };
}

/** La riga che dice quando e perche', come si legge sotto il titolo. */
export function testoCompletamento(c) {
  if (!c) return '';
  if (c.come === 'gestionale') {
    return `${c.giorno ? `Completata il ${gg(c.giorno)}` : 'Completata (giorno non registrato)'} dal gestionale: ${c.perche}.`;
  }
  const base = c.giorno
    ? `Completata il ${gg(c.giorno)}, spuntata a mano.`
    : 'Completata, spuntata a mano: il giorno non è registrato perché la spunta è di prima che il gestionale lo scrivesse.';
  return c.prima ? `${base} Il gestionale l’aveva chiusa una prima volta (${c.prima}).` : base;
}

/**
 * Le attivita' divise: { daFare, completati }. I da fare restano nell'ordine in
 * cui arrivano (la pagina le legge dalle piu' nuove); i completati vanno dai piu'
 * recenti, col giorno del completamento. A pari giorno l'ultima modifica, poi la
 * creazione.
 */
export function dividiAttivita(todos) {
  const daFare = [];
  const completati = [];
  for (const t of todos || []) (eCompletata(t) ? completati : daFare).push(t);
  completati.sort(piuRecenti(
    t => (completamentoAttivita(t) || {}).giorno,
    (a, b) => String(b.updated_date || '').localeCompare(String(a.updated_date || ''))
      || String(b.created_date || '').localeCompare(String(a.created_date || '')),
  ));
  return { daFare, completati };
}

/** I numeri della pagina: da fare (aperte + in corso), aperte, in corso, completate. */
export function conteggiAttivita(todos) {
  const { daFare, completati } = dividiAttivita(todos);
  const inCorso = daFare.filter(t => t.stato === 'in_corso').length;
  return { da_fare: daFare.length, aperto: daFare.length - inCorso, in_corso: inCorso, completati: completati.length };
}

/** I da fare di un filtro della pagina: 'tutti' (aperte + in corso), 'aperto', 'in_corso'. */
export function daFareDelFiltro(daFare, filtro) {
  if (filtro === 'in_corso') return daFare.filter(t => t.stato === 'in_corso');
  if (filtro === 'aperto') return daFare.filter(t => t.stato !== 'in_corso');
  return daFare;
}

/**
 * I campi da salvare quando l'amministratore cambia lo stato a mano. Si scrive
 * il giorno italiano della spunta quando l'attivita' DIVENTA completata, e si
 * toglie (null: un giorno che non c'e' non e' un giorno vuoto) quando ne esce:
 * e' quello che la sezione dei completati mostra e su cui ordina. Fra aperta e in
 * corso cambia solo lo stato. Gli altri campi - il segno e la nota di una
 * chiusura del gestionale - non si toccano: non si cancella niente, e una
 * riaperta a mano non viene richiusa.
 */
export function campiCambioStato(t, nuovo, oggi) {
  const campi = { stato: nuovo };
  const era = eCompletata(t);
  if (nuovo === 'completato' && !era) campi.completata_il = giorno(oggi) || null;
  else if (nuovo !== 'completato' && era) campi.completata_il = null;
  return campi;
}

// ---------------------------------------------------------------------------
// LE RICHIESTE ECT

/** Una richiesta chiusa: evasa (il ritiro c'e' stato) o annullata (non si fara'). */
export const eChiusaRichiesta = (esito) => esito === 'evasa' || esito === 'annullata';

/**
 * L'esito con cui la pagina divide una richiesta: quello salvato, che ogni
 * caricamento delle primarie e ogni apertura della pagina dell'amministratore
 * riscrivono con statoRichiesta. Quando manca, o e' il «da_confermare» delle
 * richieste salvate prima del 29/09/2026 (ritiro fatto, spunta da mettere), vale
 * statoRichiesta di adesso, passato da chi chiama: la stessa regola che scrive
 * l'esito, senza scrivere niente. Per quella regola una richiesta col ritiro
 * fatto e' evasa, con o senza la spunta.
 */
export function esitoDellaPagina(r, statoRichiesta) {
  const salvato = r && r.esito;
  return !salvato || salvato === 'da_confermare' ? statoRichiesta(r || {}) : salvato;
}

/**
 * Quando e perche' una richiesta e' chiusa: null se e' ancora da fare.
 * { giorno, ritiro, come: 'terminati' | 'foglio' | 'a_mano' | 'annullata', perche, da_rispondere }.
 *
 * Il giorno e' quello del RITIRO, come nella colonna Ritiro: dal foglio del
 * consorzio o dalla fine trasporto dei nostri terminati (regola 1). Se manca e
 * la richiesta e' stata spuntata a mano, il giorno della spunta. Un'annullata
 * non ha giorno: si dice il motivo.
 *
 * `da_rispondere`: la richiesta e' evasa ma la spunta non c'e' ancora, cioe' al
 * consorzio non si e' risposto. E' la stessa voce della dashboard (cruscotto.ts,
 * «aspettano la risposta al consorzio»): la sezione la conta sulla sua
 * intestazione, cosi' chiusa non la nasconde.
 */
export function completamentoRichiesta(r, esito) {
  if (!r || !eChiusaRichiesta(esito)) return null;
  if (esito === 'annullata') {
    return { giorno: null, ritiro: null, come: 'annullata', perche: String(r.motivo_annullamento || '').trim(), da_rispondere: false };
  }
  const dalFoglio = giorno(r.evaso_il);
  const daiTerminati = giorno(r.evasione_rilevata_il);
  const spunta = r.evasione_confermata ? giorno(r.evasione_confermata_il) : '';
  const piu = Number(r.ordini_totali) > 1;
  const come = daiTerminati ? 'terminati' : dalFoglio ? 'foglio' : 'a_mano';
  const perche = come === 'terminati' ? (piu ? 'gli ordini risultano terminati' : 'l’ordine risulta terminato')
    : come === 'foglio' ? 'evasa secondo il foglio delle richieste'
      : 'spuntata a mano';
  return {
    // Il giorno che ordina la sezione e' quello che la scheda scrive: il ritiro
    // (dai terminati e' la fine trasporto, regola 1), altrimenti la spunta.
    giorno: (come === 'terminati' ? daiTerminati : dalFoglio) || spunta || null,
    ritiro: (come === 'terminati' ? daiTerminati : dalFoglio) || null,
    come,
    perche,
    da_rispondere: !r.evasione_confermata,
  };
}

/** La riga che dice quando e perche' una richiesta e' chiusa, col giorno una volta sola. */
export function testoCompletamentoRichiesta(c) {
  if (!c) return '';
  if (c.come === 'annullata') return c.perche ? `Annullata: ${c.perche}.` : 'Annullata.';
  if (c.come === 'terminati') return `Completata da sola: ${c.perche}, ritiro del ${gg(c.ritiro)}.`;
  if (c.come === 'foglio') return `Completata: ${c.perche}, ritiro del ${gg(c.ritiro)}.`;
  return c.giorno ? `Completata il ${gg(c.giorno)}, spuntata a mano.` : 'Completata, spuntata a mano.';
}

/**
 * Le richieste divise: { daFare, completate }. `esitoDi` e' la regola della
 * pagina (esitoDellaPagina). Le completate vanno dai ritiri piu' recenti; a
 * pari giorno la mail piu' recente; le annullate, senza giorno, in fondo.
 */
export function dividiRichieste(righe, esitoDi = (r) => r.esito) {
  const daFare = [];
  const completate = [];
  for (const r of righe || []) (eChiusaRichiesta(esitoDi(r)) ? completate : daFare).push(r);
  completate.sort(piuRecenti(
    r => (completamentoRichiesta(r, esitoDi(r)) || {}).giorno,
    (a, b) => String(b.mail_inviata_il || '').localeCompare(String(a.mail_inviata_il || '')),
  ));
  return { daFare, completate };
}
