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
//
// LE CANCELLATE NELLA LORO SEZIONE (14/10/2026). Richiesta dell'utente,
// testuale: «qualora vi fossero degli ordini tra quelli aperti che venissero non
// eseguiti e quindi terminati bensi' cancellati a portale devono comparire
// automaticamente nei cancellati con data di cancellazione; a me non serve
// decidere sul gestionale cio' che e' gia' chiaro ed evidente sul portale».
// Un'attivita' i cui ordini il portale da' tutti cancellati la passa il controllo
// degli ordini allo stato `cancellato` (todoOrdini.ts), e qui va nella terza
// parte, i CANCELLATI: non e' da fare e non e' fatta. Una richiesta ECT coi suoi
// ordini tutti cancellati diventa annullata (statoRichiesta) e sta fra le
// completate come le annullate dal foglio. Il giorno della cancellazione il file
// del portale non lo porta: per tutte e due si dice il giorno in cui il
// gestionale l'ha trovata cancellata, e per quello che e' (revisione del
// 14/10/2026: prima si prendeva Ordine_chiuso_il, che e' un'altra cosa).

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

/** Cancellata: lo stato salvato e' `cancellato` (i suoi ordini cancellati a portale). */
export const eCancellata = (t) => !!t && t.stato === 'cancellato';

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

// Il prefisso che il controllo degli ordini mette davanti al perche' di una
// cancellata (controlloAttivita: «cancellata dal gestionale il GG/MM/AAAA: ...»).
const PREFISSO_CANCELLATA = /^cancellata dal gestionale il \d{2}\/\d{2}\/\d{4}:\s*/i;

/**
 * Quando e perche' un'attivita' risulta cancellata: null se non lo e'.
 * { giorno: 'AAAA-MM-GG' | null, perche }.
 *
 * `giorno` e' quello in cui il gestionale l'ha trovata cancellata e l'ha passata
 * qui (chiusa_dal_gestionale_il). Il giorno della cancellazione a portale il file
 * non lo porta, e non si inventa: la riga dice il giorno che si sa, per quello
 * che e', e la sezione spiega perche' (AttivitaCancellate.jsx).
 */
export function cancellazioneAttivita(t) {
  if (!eCancellata(t)) return null;
  const nota = String(t.chiusura_nota || '').trim();
  return {
    giorno: giorno(t.chiusa_dal_gestionale_il) || null,
    perche: nota.replace(PREFISSO_CANCELLATA, '') || 'i suoi ordini risultano cancellati a portale',
  };
}

/** La riga che dice quando e perche' un'attivita' e' cancellata, col giorno detto una volta. */
export function testoCancellazione(c) {
  if (!c) return '';
  return c.giorno ? `Passata fra le cancellate il ${gg(c.giorno)}: ${c.perche}.` : `Passata fra le cancellate: ${c.perche}.`;
}

/**
 * Le attivita' divise: { daFare, completati, cancellati }. I da fare restano
 * nell'ordine in cui arrivano (la pagina le legge dalle piu' nuove); i completati
 * vanno dai piu' recenti, col giorno del completamento, e le cancellate dalle
 * piu' recenti, col giorno in cui il gestionale le ha passate li'. A pari giorno
 * l'ultima modifica, poi la creazione.
 */
export function dividiAttivita(todos) {
  const daFare = [];
  const completati = [];
  const cancellati = [];
  for (const t of todos || []) (eCompletata(t) ? completati : eCancellata(t) ? cancellati : daFare).push(t);
  const poi = (a, b) => String(b.updated_date || '').localeCompare(String(a.updated_date || ''))
    || String(b.created_date || '').localeCompare(String(a.created_date || ''));
  completati.sort(piuRecenti(t => (completamentoAttivita(t) || {}).giorno, poi));
  cancellati.sort(piuRecenti(t => (cancellazioneAttivita(t) || {}).giorno, poi));
  return { daFare, completati, cancellati };
}

/**
 * Il testo dell'elenco dei da fare quando nel filtro non c'e' niente. `quanti`
 * sono i numeri delle tre parti ({ daFare, completati, cancellati }). Con le sole
 * cancellate, o con completate e cancellate, l'elenco non diceva «Nessuna
 * attività. Crea la prima» o «sono tutte completate» mentre poco sotto c'erano i
 * Cancellati (revisione del 14/10/2026): si dice dove sono.
 */
export function testoElencoVuoto(filtro, quanti, isAdmin) {
  const { daFare = 0, completati = 0, cancellati = 0 } = quanti || {};
  if (!daFare && !completati && !cancellati) return `Nessuna attività.${isAdmin ? ' Crea la prima col pulsante «Nuovo To-Do».' : ''}`;
  if (!daFare && completati && cancellati) return 'Niente da fare: le attività sono tutte completate o cancellate, le trovi qui sotto.';
  if (!daFare && cancellati) return 'Niente da fare: le attività sono tutte fra le cancellate, le trovi qui sotto.';
  if (!daFare) return 'Niente da fare: le attività sono tutte completate, le trovi qui sotto.';
  if (filtro === 'in_corso') return 'Nessuna attività in corso.';
  if (filtro === 'aperto') return 'Nessuna attività aperta.';
  return 'Niente da fare.';
}

/** I numeri della pagina: da fare (aperte + in corso), aperte, in corso, completate, cancellate. */
export function conteggiAttivita(todos) {
  const { daFare, completati, cancellati } = dividiAttivita(todos);
  const inCorso = daFare.filter(t => t.stato === 'in_corso').length;
  return { da_fare: daFare.length, aperto: daFare.length - inCorso, in_corso: inCorso, completati: completati.length, cancellati: cancellati.length };
}

// IL NUMERO ACCANTO ALLA TO-DO LIST NEL MENU (decisioni dell'utente del
// 13/10/2026, gruppo B). E' il «Da fare» della pagina (conteggiAttivita), letto
// come gli altri contatori del menu: una lettura leggera all'avvio e ogni
// cinque minuti, delle sole attivita' da fare - aperte e in corso, lo stato che
// l'archivio scrive per difetto - e mai l'elenco intero, che coi completati
// cresce ogni mese. La pagina puo' dire il numero nuovo con l'evento
// EVENTO_TODO ({ detail: { da_fare } }), senza un'altra lettura. Un'attivita'
// passata fra le cancellate (stato `cancellato`, 14/10/2026) non e' da fare:
// resta fuori dalla lettura e dal numero, come una completata.
export const STATI_DA_FARE = ['aperto', 'in_corso'];
export const EVENTO_TODO = 'todo-aggiornata';
const MASSIMO_DA_FARE = 500;

/** Quante attivita' sono da fare, con una lettura sola dell'archivio Todo (l'entita' del client). */
export async function contaDaFare(Todo) {
  const righe = await Todo.filter({ stato: { $in: STATI_DA_FARE } }, '-created_date', MASSIMO_DA_FARE);
  return conteggiAttivita(righe || []).da_fare;
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

// LA MODIFICA DI UN'ATTIVITA' DA FARE (15/10/2026). Richiesta dell'utente,
// testuale: «nella to-do list permetti la modifica delle richieste aperte per
// successive integrazioni e\o annotazioni». Il modulo e' quello del «Nuovo
// To-Do», gia' compilato con i valori dell'attivita'; si salvano SOLO i campi
// che l'utente ha cambiato davvero. Una completata o una cancellata si modifica
// dopo averla riaperta, come prima. Le annotazioni non passano da qui: si
// accodano sotto l'attivita' (src/lib/annotazioni.js).

/** I valori con cui il modulo si apre su un'attivita' che c'e' gia'. */
export function valoriDelModulo(t) {
  const x = t || {};
  return {
    titolo: String(x.titolo ?? ''),
    descrizione: String(x.descrizione ?? ''),
    categoria: String(x.categoria ?? ''),
    priorita: x.priorita || 'media',
    data_scadenza: giorno(x.data_scadenza),
    riferimento_ordine: String(x.riferimento_ordine ?? ''),
  };
}

/**
 * I campi da salvare dal modulo di modifica: {} se non e' cambiato niente, null
 * se manca il titolo (e' obbligatorio, come alla creazione).
 *
 * Un campo si riscrive solo se il testo nel modulo e' diverso da quello salvato:
 * aprire e salvare senza toccare niente non scrive niente. La scadenza tolta si
 * scrive null (un giorno che non c'e' non e' un giorno vuoto).
 *
 * Gli ID ORDINE hanno la regola della riga dell'attivita' (OrdiniAttivita.jsx,
 * AGENTS.md «Le attivita' della to-do list che si chiudono da sole»): un elenco
 * di soli ID si riscrive in maiuscolo separato da virgole, una frase si salva
 * com'e' scritta, e il campo non toccato non si riscrive mai - un vecchio «da
 * chiedere a Ecotyre» diventava «DA, CHIEDERE, A, ECOTYRE». `ordiniDi` e' la
 * regola che riconosce un ID ordine (ordiniAttivita di todoOrdini): questo file
 * non importa niente. Cambiati gli ordini, la pagina rifa' subito il controllo
 * degli ordini, come alla creazione: un ordine gia' terminato o cancellato
 * quando lo aggiungi non chiude niente, e la riga lo dice. Su un'attivita' che
 * il gestionale aveva gia' chiuso e che e' stata riaperta, ordini DIVERSI
 * tolgono anche il segno di quella chiusura (campiOrdiniNuovi, qui sotto).
 */
export function campiModificaAttivita(t, valori, ordiniDi) {
  const prima = t || {};
  const v = valori || {};
  if (!String(v.titolo ?? '').trim()) return null;
  const campi = {};
  // I testi: si confronta quello scritto con quello salvato, poi si pulisce.
  for (const k of ['titolo', 'descrizione', 'categoria']) {
    const scritto = String(v[k] ?? '');
    const salvato = String(prima[k] ?? '');
    if (scritto === salvato) continue;
    const pulito = k === 'descrizione' ? scritto.replace(/\r\n?/g, '\n').trim() : scritto.replace(/\s+/g, ' ').trim();
    if (pulito !== salvato.trim()) campi[k] = pulito;
  }
  const priorita = v.priorita || 'media';
  if (priorita !== (prima.priorita || 'media')) campi.priorita = priorita;
  const scadenza = giorno(v.data_scadenza);
  if (scadenza !== giorno(prima.data_scadenza)) campi.data_scadenza = scadenza || null;
  const originale = String(prima.riferimento_ordine ?? '');
  const ordini = String(v.riferimento_ordine ?? '');
  if (ordini !== originale) {
    const pezzi = ordini.split(/[,;\s]+/).filter(Boolean);
    const soloId = pezzi.length > 0 && typeof ordiniDi === 'function' && pezzi.every(p => ordiniDi({ riferimento_ordine: p }).length === 1);
    const pulito = soloId ? pezzi.map(x => x.toUpperCase()).join(', ') : ordini.replace(/\s+/g, ' ').trim();
    if (pulito !== originale.trim()) {
      campi.riferimento_ordine = pulito;
      Object.assign(campi, campiOrdiniNuovi(prima, pulito, ordiniDi));
    }
  }
  return campi;
}

// GLI ORDINI NUOVI SU UN'ATTIVITA' RIAPERTA (revisione del 15/10/2026). Il
// gestionale chiude un'attivita' una volta sola: chi l'ha riaperta l'ha fatto
// apposta, e con gli STESSI ordini non la richiude (`chiusa_dal_gestionale`,
// AGENTS.md «Le attivita' della to-do list che si chiudono da sole»). Ma se chi
// lavora la riapre e ci scrive ordini DIVERSI - il portale ha cancellato
// l'ordine e l'ordine e' stato rifatto, la strada che la pagina stessa indica -
// sta chiedendo di guardare quelli: prima il passaggio si consumava senza
// chiudere niente, l'attivita' restava aperta per sempre e la riga non lo
// diceva, mentre il modulo di modifica prometteva il contrario. Adesso gli
// ordini diversi tolgono il segno (chiusa_dal_gestionale: false) e si guardano
// come su un'attivita' nuova: il primo controllo guarda e non chiude, il
// passaggio da assegnato a terminato (o a cancellato) la chiude.
// La chiusura di prima NON si cancella: la sua nota resta nell'attivita' e, dato
// che una seconda chiusura la riscriverebbe, la pagina la copia in
// un'annotazione con la stessa scrittura (notaOrdiniNuovi, TodoPage.jsx).

/**
 * { chiusa_dal_gestionale: false } se `riferimento` porta ordini diversi da
 * quelli dell'attivita' (lo stesso elenco riscritto in un altro ordine o in
 * minuscolo non conta) e l'attivita', da fare, era stata chiusa dal gestionale;
 * altrimenti {}. Senza ID ordine non c'e' niente da guardare: il segno resta.
 */
export function campiOrdiniNuovi(t, riferimento, ordiniDi) {
  if (!t || t.chiusa_dal_gestionale !== true || eCompletata(t) || eCancellata(t) || typeof ordiniDi !== 'function') return {};
  const nuovi = ordiniDi({ riferimento_ordine: riferimento });
  if (!nuovi.length) return {};
  const chiave = (ids) => [...ids].sort().join(',');
  return chiave(nuovi) === chiave(ordiniDi(t)) ? {} : { chiusa_dal_gestionale: false };
}

/**
 * Il testo dell'annotazione che accompagna gli ordini nuovi su un'attivita' che
 * il gestionale aveva chiuso: che ordini c'erano, quali ci sono adesso, e la
 * chiusura di prima con la sua nota, cosi' come era scritta.
 */
export function notaOrdiniNuovi(t, riferimento, ordiniDi) {
  const x = t || {};
  const ids = (r) => (typeof ordiniDi === 'function' ? ordiniDi({ riferimento_ordine: r }) : []);
  const prima = ids(x.riferimento_ordine).join(', ') || String(x.riferimento_ordine || '').trim() || 'nessuno';
  const ora = ids(riferimento).join(', ') || String(riferimento || '').trim();
  const nota = String(x.chiusura_nota || '').trim();
  const quando = giorno(x.chiusa_dal_gestionale_il);
  const chiusura = nota ? ` (${nota})` : quando ? ` il ${gg(quando)}` : '';
  return `Ordini cambiati da ${prima} a ${ora}. Il gestionale l’aveva già chiusa una volta${chiusura}: riaperta, gli ordini nuovi li guarda da adesso come su un’attività nuova: la chiude da sola quando passano da assegnati a terminati, o la passa fra le cancellate se il portale li cancella.`;
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
 *
 * Dal 14/10/2026 si rileggono con statoRichiesta anche un'«aperta» salvata e una
 * richiesta CHIUSA DAL PORTALE (annullata senza il motivo del foglio, evasa senza
 * spunta, senza la data del foglio e senza il ritiro rilevato: chiusaDalPortale
 * in richiesteEct.ts, che qui si ripete perche' questo file non importa niente;
 * la prova controlla che dicano lo stesso). Quella regola guarda lo stato dei suoi
 * ordini salvato con lei (ordini_stato_json): se il portale li da' tutti
 * cancellati la richiesta e' annullata, se ne ha riassegnato uno e' di nuovo
 * aperta, anche quando l'esito scritto e' rimasto indietro. Su tutte le altre
 * statoRichiesta dice lo stesso dell'esito salvato: legge i campi che l'hanno
 * scritto.
 */
export function esitoDellaPagina(r, statoRichiesta) {
  const salvato = r && r.esito;
  const dalPortale = !!r && ((salvato === 'annullata' && !r.motivo_annullamento)
    || (salvato === 'evasa' && !r.evasione_confermata && !r.evaso_il && !r.evasione_rilevata_il));
  return !salvato || salvato === 'da_confermare' || salvato === 'aperta' || dalPortale ? statoRichiesta(r || {}) : salvato;
}

/** Le voci salvate dello stato degli ordini di una richiesta (ordini_stato_json), o []. */
const vociOrdini = (r) => {
  try {
    const v = r && r.ordini_stato_json ? JSON.parse(r.ordini_stato_json) : [];
    return Array.isArray(v) ? v.filter(x => x && x.id_ordine) : [];
  } catch { return []; }
};
/** "ET1, ET2 e ET3". */
const elencoIds = (ids) => (ids.length <= 1 ? (ids[0] || '') : ids.slice(0, -1).join(', ') + ' e ' + ids[ids.length - 1]);
/** "l’ordine ET1 (Mancanza PFU) risulta cancellato a portale", al plurale se sono piu' di uno. */
const testoCancellatiRichiesta = (voci) => {
  const quali = voci.map(v => (v.motivo ? `${v.id_ordine} (${v.motivo})` : v.id_ordine));
  return quali.length === 1 ? `l’ordine ${quali[0]} risulta cancellato a portale` : `gli ordini ${elencoIds(quali)} risultano cancellati a portale`;
};

/**
 * Quando e perche' una richiesta e' chiusa: null se e' ancora da fare.
 * { giorno, ritiro, come: 'terminati' | 'foglio' | 'in_parte' | 'a_mano' | 'annullata', perche, da_rispondere }.
 *
 * Il giorno e' quello del RITIRO, come nella colonna Ritiro: dal foglio del
 * consorzio o dalla fine trasporto dei nostri terminati (regola 1). Se manca e
 * la richiesta e' stata spuntata a mano, il giorno della spunta. Un'annullata
 * non ha giorno: si dice il motivo, e sta in fondo.
 *
 * DAL 14/10/2026 il portale chiude da solo anche quello che cancella
 * (statoRichiesta). Un'annullata senza motivo dal foglio coi suoi ordini tutti
 * cancellati a portale ha `dal_portale` e `visto_il`, il giorno in cui il
 * gestionale ha visto cancellato l'ultimo dei suoi ordini, cioe' quello in cui si
 * e' annullata da sola (il giorno della cancellazione il portale non lo scrive):
 * resta 'annullata', cosi' chi la disegna la tratta come le altre annullate.
 * 'in_parte' e' un'evasa con alcuni ordini terminati e gli altri cancellati, col
 * giorno dell'ultimo ritiro.
 *
 * `da_rispondere`: la richiesta e' evasa ma la spunta non c'e' ancora, cioe' al
 * consorzio non si e' risposto. E' la stessa voce della dashboard (cruscotto.ts,
 * «aspettano la risposta al consorzio»): la sezione la conta sulla sua
 * intestazione, cosi' chiusa non la nasconde.
 */
export function completamentoRichiesta(r, esito) {
  if (!r || !eChiusaRichiesta(esito)) return null;
  const voci = vociOrdini(r);
  const cancellati = voci.filter(v => v.stato === 'cancellato');
  const terminati = voci.filter(v => v.stato === 'terminato');
  if (esito === 'annullata') {
    const motivo = String(r.motivo_annullamento || '').trim();
    if (!motivo && cancellati.length && cancellati.length === voci.length) {
      const visti = cancellati.map(v => giorno(v.visto_il));
      return {
        giorno: null,
        ritiro: null,
        come: 'annullata',
        dal_portale: true,
        perche: testoCancellatiRichiesta(cancellati),
        // il piu' recente, e solo se c'e' per tutti: con un giorno che manca non
        // si sa quando si e' visto l'ultimo
        visto_il: visti.every(Boolean) ? [...visti].sort()[visti.length - 1] : null,
        da_rispondere: false,
      };
    }
    return { giorno: null, ritiro: null, come: 'annullata', perche: motivo, da_rispondere: false };
  }
  const dalFoglio = giorno(r.evaso_il);
  const daiTerminati = giorno(r.evasione_rilevata_il);
  const spunta = r.evasione_confermata ? giorno(r.evasione_confermata_il) : '';
  const piu = Number(r.ordini_totali) > 1;
  const inParte = cancellati.length > 0 && terminati.length > 0 && cancellati.length + terminati.length === voci.length;
  const ultimoRitiro = terminati.map(v => giorno(v.giorno)).filter(Boolean).sort().pop() || '';
  const come = daiTerminati ? 'terminati' : dalFoglio ? 'foglio' : inParte ? 'in_parte' : 'a_mano';
  const quali = (vv) => vv.map(v => v.id_ordine);
  const perche = come === 'terminati' ? (piu ? 'gli ordini risultano terminati' : 'l’ordine risulta terminato')
    : come === 'foglio' ? 'evasa secondo il foglio delle richieste'
      : come === 'in_parte' ? `${terminati.length === 1 ? `l’ordine ${quali(terminati)[0]} risulta terminato` : `gli ordini ${elencoIds(quali(terminati))} risultano terminati`} e ${testoCancellatiRichiesta(cancellati)}`
        : 'spuntata a mano';
  const ritiro = (come === 'terminati' ? daiTerminati : come === 'foglio' ? dalFoglio : come === 'in_parte' ? ultimoRitiro : '') || null;
  return {
    // Il giorno che ordina la sezione e' quello che la scheda scrive: il ritiro
    // (dai terminati e' la fine trasporto, regola 1), altrimenti la spunta.
    giorno: ritiro || spunta || null,
    ritiro,
    come,
    perche,
    da_rispondere: !r.evasione_confermata,
  };
}

/** La riga che dice quando e perche' una richiesta e' chiusa, col giorno una volta sola. */
export function testoCompletamentoRichiesta(c) {
  if (!c) return '';
  if (c.come === 'annullata' && c.dal_portale) return c.visto_il ? `Annullata da sola il ${gg(c.visto_il)}: ${c.perche}.` : `Annullata da sola: ${c.perche}.`;
  if (c.come === 'annullata') return c.perche ? `Annullata: ${c.perche}.` : 'Annullata.';
  if (c.come === 'terminati') return `Completata da sola: ${c.perche}, ritiro del ${gg(c.ritiro)}.`;
  if (c.come === 'in_parte') return `Evasa in parte, da sola: ${c.perche}${c.ritiro ? `; ritiro del ${gg(c.ritiro)}` : ''}.`;
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
