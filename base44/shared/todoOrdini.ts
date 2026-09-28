// Le attivita' della to-do list che si chiudono da sole.
//
// Su un'attivita' l'utente scrive l'ID dell'ordine da completare. Quando quell'
// ordine PASSA da assegnato a terminato l'attivita' e' fatta, e il gestionale la
// chiude da solo, senza che nessuno glielo chieda: resta scritto PERCHE' e
// QUANDO, cosi' una chiusura del gestionale si distingue sempre da una spunta
// messa a mano e niente si perde. L'avviso sulla scadenza non c'entra: quello
// resta come l'ha impostato l'utente.
//
// IL PASSAGGIO SI DEVE VEDERE, non basta lo stato di adesso. Parole dell'utente
// (28/09/2026): "verifica quando essi passano dallo stato assegnato a quello di
// terminato e SOLO ALLORA indicarli come completati". Percio' il gestionale prima
// GUARDA e poi chiude: al primo controllo di un'attivita' scrive quali dei suoi
// ordini sono ancora aperti (ordini_da_attendere) e non chiude niente; chiude
// quando quegli ordini risultano terminati. Se invece l'ordine era GIA' terminato
// quando l'attivita' e' comparsa, nessun passaggio e' avvenuto sotto i nostri
// occhi e l'attivita' non si chiude da sola: lo dice e la spunta la mette chi
// lavora.
//
// Serviva davvero. Il campo riferimento_ordine esisteva da prima e voleva dire
// "ordine correlato": sulle attivita' vecchie c'e' scritto l'ordine di cui si
// parla, non un ordine da aspettare, e quasi tutti quegli ordini sono terminati
// da tempo. Senza il passaggio, al primo controllo si sarebbero chiuse in blocco
// - uscendo anche dalla vista, che parte dalle aperte - con accanto un motivo
// vero in se' ("l'ordine risulta terminato") ma falso come spiegazione: il
// sollecito, la pratica o la fattura di cui parlava l'attivita' nessuno li ha
// fatti.
//
// Tre regole decise con l'utente (28/09/2026):
//
//  - un ordine CANCELLATO non chiude niente. Cancellato vuol dire che quel
//    ritiro non si fara' piu': l'attivita' resta aperta e si segnala, perche' che
//    cosa farne lo decide lui, e archiviarla di nascosto gliela nasconderebbe;
//  - un'attivita' puo' portare PIU' DI UN ordine (si leggono come nel modulo
//    delle richieste del consorzio): si chiude quando sono terminati TUTTI, e
//    intanto si mostra a che punto e';
//  - la chiusura la fa una volta sola. Se l'utente riapre a mano un'attivita'
//    che il gestionale aveva chiuso, il gestionale non la richiude: sarebbe una
//    guerra fra lui e chi lavora, e a decidere e' chi lavora. Vale anche per il
//    passaggio visto mentre l'attivita' era gia' spuntata: quel passaggio si
//    consuma lo stesso, cosi' una riapertura a mano resta aperta.
//
// Il giorno del ritiro e' sempre la FINE TRASPORTO, mai la chiusura a portale
// (regola 1): il ritiro e' avvenuto quando il camion ha finito, non quando
// qualcuno a portale ha premuto Chiudi giorni dopo. I terminati si riconoscono
// con ritiriTerminati, la stessa funzione delle richieste del consorzio, cosi'
// i due moduli non possono dire due cose diverse sullo stesso ordine.
//
// Lo stato "eseguito" e' un limbo e si segnala sempre (regola dell'utente): dati
// tutti inseriti ma nessuno ha premuto Chiudi a portale. Non e' terminato, quindi
// non chiude niente, ed e' l'unico stato per cui l'attesa ha un motivo preciso da
// dire a chi lavora.
import { ritiriTerminati } from "./richiesteEct.ts";
import { eEseguito, eCancellato, motivoCancellazione } from "./movimenti.ts";

const pulisci = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const gg = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '');
/** "ET26000001 e ET26000002", "ET1, ET2 e ET3": un elenco come si legge. */
const elenco = (ids) => (ids.length <= 1 ? (ids[0] || '') : ids.slice(0, -1).join(', ') + ' e ' + ids[ids.length - 1]);

// Un ID ordine del portale: due-quattro lettere e almeno sei cifre (ET26084363,
// SEC26154852). E' la stessa forma che riconosce la prefattura.
const E_ORDINE = /^[A-Z]{2,4}\d{6,}$/;

/**
 * Gli ID ordine scritti su un'attivita'. Possono essere piu' di uno, separati
 * come viene - virgola, punto e virgola, spazio - come nel modulo delle
 * richieste del consorzio. Quello che non ha la forma di un ID ordine si salta,
 * cosi' "ET26000001 e ET26000002" o "sollecito ordine ET26000001" funzionano lo
 * stesso e nessuna parola diventa un ordine per sbaglio.
 */
export function ordiniAttivita(todo) {
  const pezzi = String((todo && todo.riferimento_ordine) || '').toUpperCase().split(/[^A-Z0-9]+/);
  return [...new Set(pezzi.filter(p => E_ORDINE.test(p)))];
}

// Un ordine che il portale ha cancellato: quel ritiro non si fara'. Gli ordini
// cancellati restano nell'archivio delle primarie, col motivo. La regola e' quella
// canonica di movimenti.ts, e il motivo si legge come in Evasione Assegnati
// (motivoCancellazione, che toglie il prefisso "altro: " e alza l'iniziale): lo
// stesso ordine non puo' comparire nei due moduli con il motivo scritto in due modi.

/**
 * Lo stato degli ordini negli archivi:
 *   terminati  - id -> giorno italiano di fine trasporto (il ritiro e' fatto);
 *   senzaFine  - terminati a portale ma senza la data: il ritiro non si conta
 *                (regola 1), pero' c'e' e va detto;
 *   eseguiti   - il limbo del portale: dati tutti inseriti, Chiudi non premuto;
 *   cancellati - id -> motivo scritto dal portale;
 *   presenti   - tutti gli ID che si trovano, per riconoscere un ID scritto male.
 *
 * Terminati e cancellati si leggono solo fra i MOVIMENTI (primarie di rete, ACI
 * ed extra raccolta); gli assegnati dicono soltanto che quell'ordine esiste. Qui
 * non si somma niente, si guarda un ordine per volta: i canali restano separati
 * perche' nessun numero passa da uno all'altro. Un ordine terminato con la sua
 * data resta terminato anche se un'altra sua riga risulta cancellata: il camion
 * e' andato, e il ritiro e' quello che conta.
 */
export function statoOrdini(movimenti, assegnati = []) {
  const { terminati, senzaFine } = ritiriTerminati(movimenti);
  const cancellati = new Map();
  const eseguiti = new Set();
  const presenti = new Set();
  for (const o of movimenti || []) {
    const id = String((o && o.id_ordine) || '').trim();
    if (!id) continue;
    presenti.add(id);
    if (eEseguito(o) && !terminati.has(id)) eseguiti.add(id);
    if (!eCancellato(o) || terminati.has(id) || cancellati.has(id)) continue;
    cancellati.set(id, motivoCancellazione(o));
  }
  for (const o of assegnati || []) {
    const id = String((o && o.id_ordine) || '').trim();
    if (id) presenti.add(id);
  }
  return { terminati, senzaFine, eseguiti, cancellati, presenti };
}

/** Gli ID che un'attivita' sta aspettando, come si tengono scritti: "ET1, ET2". */
export const attesiScritti = (ids) => (ids || []).join(', ');

/** Gli ID ordine dentro un campo scritto da noi ("ET1, ET2"). */
const attesiLetti = (v) => String(v ?? '').toUpperCase().split(/[^A-Z0-9]+/).filter(p => E_ORDINE.test(p));

/**
 * A che punto sono gli ordini di un'attivita': quali sono fatti, quali
 * cancellati, quali eseguiti, quali terminati senza la data e quali non si
 * trovano affatto.
 *
 * `aperti` sono quelli di cui si aspetta ancora qualcosa: ne' ritirati ne'
 * cancellati. Un terminato senza la data di fine trasporto resta fra gli aperti,
 * perche' senza la data il ritiro non si conta (regola 1), e cosi' un ID che non
 * si trova negli archivi e uno in stato "eseguito".
 *
 * `ultima` e' il giorno del ritiro piu' recente, e c'e' solo quando sono
 * terminati TUTTI: con un ordine ancora aperto l'attivita' non e' finita.
 */
export function esitoAttivita(todo, stato) {
  const ids = ordiniAttivita(todo);
  const fatti = ids.filter(id => stato.terminati.has(id));
  const cancellati = ids.filter(id => stato.cancellati.has(id));
  const date = fatti.map(id => stato.terminati.get(id)).filter(Boolean).sort();
  return {
    ids,
    fatti,
    cancellati,
    // C'e' scritto qualcosa nel campo dell'ordine, ma non un ID ordine: va detto,
    // altrimenti l'utente aspetta una chiusura che non arrivera' mai.
    scritto_non_riconosciuto: ids.length === 0 && pulisci(todo && todo.riferimento_ordine) !== '',
    aperti: ids.filter(id => !stato.terminati.has(id) && !stato.cancellati.has(id)),
    senza_fine: ids.filter(id => stato.senzaFine.has(id)),
    eseguiti: ids.filter(id => !!stato.eseguiti && stato.eseguiti.has(id)),
    sconosciuti: ids.filter(id => !stato.presenti.has(id)),
    ultima: ids.length > 0 && fatti.length === ids.length ? date[date.length - 1] : null,
  };
}

/** "l'ordine ET1 risulta terminato, trasporto finito il ...", al plurale se sono piu' di uno. */
function testoTerminati(e) {
  if (e.ids.length === 1) return `l'ordine ${e.ids[0]} risulta terminato${e.ultima ? `, trasporto finito il ${gg(e.ultima)}` : ''}`;
  return `gli ordini ${elenco(e.ids)} risultano terminati${e.ultima ? `, l'ultimo trasporto finito il ${gg(e.ultima)}` : ''}`;
}

/**
 * Perche' un'attivita' NON si chiude, o che cosa c'e' da guardare sui suoi
 * ordini. Vuoto quando non c'e' niente da dire.
 *
 * Su un'attivita' GIA' COMPLETATA non si dice "l'attivita' resta aperta": e'
 * chiusa, e la frase sarebbe smentita dalla riga su cui compare.
 */
export function avvisoOrdini(esito, stato, todo = null) {
  const parti = [];
  const chiusa = !!todo && todo.stato === 'completato';
  const resta = chiusa ? '' : " l'attività resta aperta e";
  if (esito.scritto_non_riconosciuto) {
    parti.push("Sull'ordine da completare c'è scritto qualcosa che non è un ID ordine (due-quattro lettere e almeno sei cifre, come ET26012345): così l'attività non si chiuderà da sola.");
  }
  const c = esito.cancellati;
  if (c.length) {
    const quali = c.map(id => { const m = stato.cancellati.get(id); return m ? `${id} (${m})` : id; });
    parti.push(c.length === 1
      ? `L'ordine ${quali[0]} risulta cancellato:${resta} quel ritiro non si farà, e che cosa farne lo decidi tu.`
      : `${c.length} ordini risultano cancellati (${quali.join('; ')}):${resta} quei ritiri non si faranno, e che cosa farne lo decidi tu.`);
  }
  // Lo stato "eseguito" e' il limbo del portale, e si segnala sempre: senza quel
  // clic l'ordine non risulta terminato, e l'attesa sembrerebbe senza motivo.
  const x9 = esito.eseguiti || [];
  if (x9.length === 1) parti.push(`L'ordine ${x9[0]} risulta “eseguito” a portale: i dati ci sono tutti ma nessuno ha premuto il pulsante Chiudi, quindi quel ritiro non si conta ancora${chiusa ? '' : ' e al prossimo caricamento avrà lo stato definitivo'}.`);
  else if (x9.length > 1) parti.push(`Gli ordini ${elenco(x9)} risultano “eseguiti” a portale: i dati ci sono tutti ma nessuno ha premuto il pulsante Chiudi, quindi quei ritiri non si contano ancora${chiusa ? '' : ' e al prossimo caricamento avranno lo stato definitivo'}.`);
  // Un "eseguito" e' anche un terminato senza fine trasporto per chi legge lo
  // stato: si dice una volta sola, col motivo giusto.
  const s = (esito.senza_fine || []).filter(id => !x9.includes(id));
  if (s.length === 1) parti.push(`L'ordine ${s[0]} risulta terminato a portale ma senza la data di fine trasporto:${resta || ''} si aspetta che la data arrivi.`);
  else if (s.length > 1) parti.push(`Gli ordini ${elenco(s)} risultano terminati a portale ma senza la data di fine trasporto:${resta || ''} si aspetta che le date arrivino.`);
  // Un ID che non si trova puo' essere scritto male, essere un ordine non ancora
  // caricato, oppure un codice che non e' un ordine: si dicono tutte e tre le
  // cose, perche' mandare a ricaricare un file che c'e' gia' e' una bugia comoda.
  const nf = esito.sconosciuti;
  if (nf.length === 1) parti.push(`L'ordine ${nf[0]} non si trova fra gli ordini caricati: può essere un ID scritto male, un ordine non ancora caricato dal portale, oppure un codice che non è un ID ordine.`);
  else if (nf.length > 1) parti.push(`Gli ordini ${elenco(nf)} non si trovano fra gli ordini caricati: possono essere ID scritti male, ordini non ancora caricati dal portale, oppure codici che non sono ID ordine.`);
  return parti.join(' ');
}

/**
 * La nota neutra di un'attivita' che non si chiudera' da sola perche' il passaggio
 * non e' mai avvenuto sotto i nostri occhi: l'ordine risultava gia' terminato
 * quando l'attivita' e' comparsa. Non e' un'anomalia e non e' un avviso, e' il
 * motivo per cui quell'attivita' aspetta una spunta a mano.
 */
export function notaOrdini(todo) {
  if (!todo || todo.stato === 'completato' || todo.chiusa_dal_gestionale) return '';
  if (!todo.ordini_attesi || pulisci(todo.ordini_da_attendere) !== '') return '';
  const n = Number(todo.ordini_totali) || 0;
  if (!n || Number(todo.ordini_terminati) !== n) return '';
  return n === 1
    ? 'l’ordine risultava già terminato quando questa attività è comparsa: da allora nessun passaggio da assegnato a terminato, quindi la spunta la metti tu'
    : 'gli ordini risultavano già terminati quando questa attività è comparsa: da allora nessun passaggio da assegnato a terminato, quindi la spunta la metti tu';
}

/**
 * Che cosa fare di un'attivita': { esito, campi, chiusa }.
 *
 * `campi` sono i campi da salvare, compresi quelli della chiusura quando si
 * chiude; chi chiama li confronta con quelli che l'attivita' ha gia' e scrive
 * solo se e' cambiato qualcosa. Niente si riapre e niente si cancella: il
 * gestionale chiude, non torna indietro.
 *
 * COME SI VEDE IL PASSAGGIO. `ordini_attesi` sono gli ID che stiamo guardando,
 * `ordini_da_attendere` quelli che erano ancora aperti quando abbiamo cominciato:
 *
 *  - ID cambiati, o attivita' mai controllata: si scrive che cosa si guarda e che
 *    cosa c'e' da attendere, e NON si chiude niente. E' il giro che GUARDA;
 *  - c'era qualcosa da attendere e adesso non resta nessun ordine aperto: il
 *    passaggio c'e' stato, e si chiude;
 *  - non c'era niente da attendere: l'ordine era gia' terminato quando l'attivita'
 *    e' comparsa. Non si chiude mai da sola, e notaOrdini dice perche'.
 *
 * Il passaggio si CONSUMA (ordini_da_attendere si svuota) anche quando non porta a
 * una chiusura: cosi' un'attivita' spuntata a mano e poi riaperta non viene
 * richiusa dal gestionale un giro dopo.
 *
 * Un ritiro con la fine trasporto NEL FUTURO non chiude niente: una data cosi' e'
 * un errore di digitazione a portale, e chiudere un'attivita' per un trasporto che
 * non e' ancora avvenuto sarebbe dire una cosa falsa.
 */
export function controlloAttivita(todo, stato, oggi) {
  const esito = esitoAttivita(todo, stato);
  const attesi = attesiScritti(esito.ids);
  const gliStessi = String(todo.ordini_attesi || '') === attesi;
  const daAttendere = attesiLetti(todo.ordini_da_attendere);
  const campi = {
    ordini_totali: esito.ids.length,
    ordini_terminati: esito.fatti.length,
    avviso_ordini: avvisoOrdini(esito, stato, todo),
    ordini_attesi: attesi,
  };
  // Il primo giro su questi ID: si scrive che cosa c'e' da attendere, e basta.
  if (!gliStessi) return { esito, chiusa: false, campi: { ...campi, ordini_da_attendere: attesiScritti(esito.aperti) } };
  const passaggio = esito.ids.length > 0 && daAttendere.length > 0 && esito.aperti.length === 0;
  if (!passaggio) return { esito, campi, chiusa: false };
  const campiPassaggio = { ...campi, ordini_da_attendere: '' };
  const nelFuturo = !!esito.ultima && !!oggi && esito.ultima > String(oggi).slice(0, 10);
  // NESSUNO CANCELLATO: un ritiro che non si fara' non e' un lavoro finito,
  // l'attivita' resta aperta e la decisione e' dell'utente. E il gestionale non
  // chiude due volte: se e' tornata aperta, l'ha riaperta lui apposta.
  const chiudere = esito.cancellati.length === 0 && !nelFuturo
    && todo.stato !== 'completato' && todo.chiusa_dal_gestionale !== true;
  if (!chiudere) return { esito, campi: campiPassaggio, chiusa: false };
  return {
    esito,
    chiusa: true,
    campi: {
      ...campiPassaggio,
      stato: 'completato',
      chiusa_dal_gestionale: true,
      chiusa_dal_gestionale_il: oggi,
      chiusura_nota: `chiusa dal gestionale il ${gg(oggi)}: ${testoTerminati(esito)}`,
    },
  };
}

/** "2 ordini su 3 terminati": a che punto e' un'attivita' con piu' di un ordine. */
export function testoAvanzamento(fatti, totali) {
  if (!totali || totali < 2) return '';
  return `${fatti} ${fatti === 1 ? 'ordine' : 'ordini'} su ${totali} ${fatti === 1 ? 'terminato' : 'terminati'}`;
}

/**
 * La riga che il caricamento delle primarie mostra per la to-do list, quando il
 * controllo ha chiuso qualcosa o c'e' qualcosa da guardare. Vuota se non c'e'
 * niente da dire: un ricalcolo silenzioso e' un ricalcolo andato bene.
 */
export function testoControlloTodo(chiuse, daGuardare) {
  const a = (chiuse || []).length, b = (daGuardare || []).length;
  const parti = [];
  if (a) parti.push(a === 1
    ? `Nella to-do list un'attività si è chiusa da sola: ${chiuse[0].titolo} (${chiuse[0].ordini}).`
    : `Nella to-do list ${a} attività si sono chiuse da sole: ${chiuse.slice(0, 5).map(x => x.titolo).join(', ')}${a > 5 ? ` e altre ${a - 5}` : ''}.`);
  if (b) parti.push(b === 1
    ? `Un'attività della to-do list resta aperta e va guardata: ${daGuardare[0].titolo} - ${daGuardare[0].avviso}`
    : `${b} attività della to-do list restano aperte e vanno guardate: ${daGuardare.slice(0, 5).map(x => x.titolo).join(', ')}${b > 5 ? ` e altre ${b - 5}` : ''}.`);
  return parti.join(' ');
}
