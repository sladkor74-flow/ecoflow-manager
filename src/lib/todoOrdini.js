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
// Le regole decise con l'utente:
//
//  - un ordine CANCELLATO a portale manda l'attivita' FRA LE CANCELLATE, da
//    sola e senza chiedere niente (richiesta dell'utente del 14/10/2026,
//    testuale: «qualora vi fossero degli ordini tra quelli aperti che venissero
//    non eseguiti e quindi terminati bensi' cancellati a portale devono comparire
//    automaticamente nei cancellati con data di cancellazione; a me non serve
//    decidere sul gestionale cio' che e' gia' chiaro ed evidente sul portale").
//    Fino a quel giorno valeva la regola del 28/09/2026: l'attivita' restava
//    aperta con l'avviso "che cosa farne lo decidi tu", e restava li' finche'
//    qualcuno non la spuntava. ANCHE QUI IL PASSAGGIO SI DEVE VEDERE: «ordini
//    tra quelli aperti che venissero cancellati» sono ordini che il gestionale ha
//    visto aperti e poi cancellati. Un'attivita' scritta su un ordine GIA'
//    cancellato parla d'altro - contestare la cancellazione, rifare l'ordine - e
//    passando fra le cancellate sparirebbe dai da fare appena salvata, perche' la
//    pagina la controlla subito: resta aperta, e l'avviso dice perche'. Fino alla
//    revisione del 14/10/2026 la cancellazione non aspettava il passaggio, e
//    succedeva proprio questo;
//  - LA RISPOSTA DATA UNA VOLTA SOLA. Il gestionale di prima consumava il
//    passaggio anche quando l'ordine risultava cancellato, senza chiudere, e
//    chiedeva "che cosa farne lo decidi tu" (DOMANDA_DI_PRIMA): su quelle
//    attivita' il passaggio c'e' stato ma non si rivede piu'. L'utente ha
//    risposto il 14/10/2026 («a me non serve decidere»): al primo controllo con
//    la regola nuova, un'attivita' che porta ancora quella domanda e i cui ordini
//    sono tutti cancellati passa fra le cancellate. La domanda si toglie con la
//    stessa scrittura, quindi vale una volta e non diventa una regola;
//  - un'attivita' puo' portare PIU' DI UN ordine (si leggono come nel modulo
//    delle richieste del consorzio): si chiude quando, dopo il passaggio, non ne
//    resta nessuno aperto. Tutti terminati: completata. Tutti cancellati:
//    cancellata. Alcuni terminati e altri cancellati: completata ed EVASA IN
//    PARTE, detto cosi' nella nota. Intanto si mostra a che punto e';
//  - la chiusura la fa una volta sola. Se l'utente riapre a mano un'attivita'
//    che il gestionale aveva chiuso o cancellato, il gestionale non la richiude:
//    sarebbe una guerra fra lui e chi lavora, e a decidere e' chi lavora. Vale
//    anche per il passaggio visto mentre l'attivita' era gia' spuntata: quel
//    passaggio si consuma lo stesso, cosi' una riapertura a mano resta aperta.
//
// LA DATA DELLA CANCELLAZIONE. Il file del portale non la porta: un ordine
// cancellato ha lo stato e il motivo, e nessuna colonna col giorno. Ordine_chiuso_il
// c'e' solo sui cancellati gia' passati dal trasporto ed e' il giorno in cui si e'
// premuto Chiudi, non quello della cancellazione (file PRIMARIE del 12/10/2026: 460
// cancellati, 3 con Ordine_chiuso_il, tutti con fine trasporto e FIR e la chiusura
// da uno a tre giorni dopo il trasporto; ET26163752, cancellato dopo il trasporto,
// non ce l'ha). Fino alla revisione del 14/10/2026 lo si usava come giorno della
// cancellazione: un dato dedotto scritto come certo. Il giorno che si sa e' quello
// in cui il gestionale l'ha VISTA cancellata (chiusa_dal_gestionale_il: il
// controllo gira dopo ogni caricamento delle primarie e a ogni apertura della
// pagina), e a video si dice per quello che e'. Mai un giorno inventato.
//
// Il giorno del ritiro e' sempre la FINE TRASPORTO, mai la chiusura a portale
// (regola 1): il ritiro e' avvenuto quando il camion ha finito, non quando
// qualcuno a portale ha premuto Chiudi giorni dopo. I terminati si riconoscono
// con ritiriTerminati, la stessa funzione delle richieste del consorzio, cosi'
// i due moduli non possono dire due cose diverse sullo stesso ordine.
//
// Lo stato "eseguito" e' un limbo e si segnala sempre (regola dell'utente): dati
// tutti inseriti ma nessuno ha premuto Chiudi a portale. Non e' terminato ne'
// cancellato, quindi non chiude niente: l'attivita' resta aperta, ed e' l'unico
// stato per cui l'attesa ha un motivo preciso da dire a chi lavora.
import { ritiriTerminati } from "@/lib/richiesteEct";
import { eEseguito, eCancellato, motivoCancellazione } from "@/lib/movimenti";

const pulisci = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const gg = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '');
/** "ET26000001 e ET26000002", "ET1, ET2 e ET3": un elenco come si legge. */
const elenco = (ids) => (ids.length <= 1 ? (ids[0] || '') : ids.slice(0, -1).join(', ') + ' e ' + ids[ids.length - 1]);

// La domanda che il gestionale di prima del 14/10/2026 scriveva sulle attivita'
// aperte con un ordine cancellato («...e che cosa farne lo decidi tu»). Serve solo
// a riconoscere, una volta, le attivita' a cui l'utente ha gia' risposto: vedi
// «LA RISPOSTA DATA UNA VOLTA SOLA» qui sopra e controlloAttivita.
export const DOMANDA_DI_PRIMA = /che cosa farne lo decidi tu/;

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
 *   terminati    - id -> giorno italiano di fine trasporto (il ritiro e' fatto);
 *   senzaFine    - terminati a portale ma senza la data: il ritiro non si conta
 *                  (regola 1), pero' c'e' e va detto;
 *   eseguiti     - il limbo del portale: dati tutti inseriti, Chiudi non premuto;
 *   cancellati   - id -> motivo scritto dal portale (il giorno il file non lo
 *                  porta: vedi «LA DATA DELLA CANCELLAZIONE» qui sopra);
 *   presenti     - tutti gli ID che si trovano, per riconoscere un ID scritto male.
 *
 * Terminati e cancellati si leggono solo fra i MOVIMENTI (primarie di rete, ACI
 * ed extra raccolta); gli assegnati dicono che quell'ordine esiste ed e' aperto
 * adesso. Qui non si somma niente, si guarda un ordine per volta: i canali
 * restano separati perche' nessun numero passa da uno all'altro. Un ordine
 * terminato con la sua data resta terminato anche se un'altra sua riga risulta
 * cancellata: il camion e' andato, e il ritiro e' quello che conta.
 *
 * UN ORDINE FRA GLI ASSEGNATI NON E' CANCELLATO (14/10/2026). Da quel giorno un
 * cancellato manda l'attivita' fra le cancellate da sola, quindi deve esserlo
 * adesso, non in una riga rimasta: un ordine cancellato per errore torna
 * assegnato con lo stesso ID (AGENTS.md, «cancellatiDaLasciare»), e la lista
 * degli assegnati e' quella dell'ultimo file del portale.
 */
export function statoOrdini(movimenti, assegnati = []) {
  const { terminati, senzaFine } = ritiriTerminati(movimenti);
  const cancellati = new Map();
  const eseguiti = new Set();
  const presenti = new Set();
  const assegnatiOra = new Set();
  for (const o of assegnati || []) {
    const id = String((o && o.id_ordine) || '').trim();
    if (!id) continue;
    presenti.add(id);
    assegnatiOra.add(id);
  }
  for (const o of movimenti || []) {
    const id = String((o && o.id_ordine) || '').trim();
    if (!id) continue;
    presenti.add(id);
    if (eEseguito(o) && !terminati.has(id)) eseguiti.add(id);
    if (!eCancellato(o) || terminati.has(id) || assegnatiOra.has(id) || cancellati.has(id)) continue;
    cancellati.set(id, motivoCancellazione(o));
  }
  return { terminati, senzaFine, eseguiti, cancellati, presenti };
}

/** Gli ID che un'attivita' sta aspettando, come si tengono scritti: "ET1, ET2". */
export const attesiScritti = (ids) => (ids || []).join(', ');

/** Gli ID ordine dentro un campo scritto da noi ("ET1, ET2"). */
const attesiLetti = (v) => String(v ?? '').toUpperCase().split(/[^A-Z0-9]+/).filter(p => E_ORDINE.test(p));

// Gli ID di un'attivita' si confrontano come INSIEME, non come stringa: conta
// QUALI ordini sono, non in che ordine l'utente li ha scritti. Difetto trovato il
// 02/10/2026: ordiniAttivita tiene gli ID nell'ordine in cui compaiono nel testo,
// e riscrivere gli STESSI ordini al contrario ("ET2, ET1" dove c'era "ET1, ET2")
// faceva sembrare l'attivita' mai controllata. Il primo giro non chiude mai, per
// la regola dell'utente ("solo allora"), quindi l'attivita' restava aperta anche
// con tutti i suoi ordini terminati. Quello che si SCRIVE in ordini_attesi resta
// invece nell'ordine scritto dall'utente: a video quell'ordine ha il suo senso.
const chiaveAttesi = (ids) => [...(ids || [])].sort().join(', ');

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
 * `ultimo_ritiro` e' il piu' recente dei ritiri che ci sono, anche se non sono
 * tutti: serve all'attivita' evasa in parte.
 */
export function esitoAttivita(todo, stato) {
  const ids = ordiniAttivita(todo);
  const fatti = ids.filter(id => stato.terminati.has(id));
  const cancellati = ids.filter(id => stato.cancellati.has(id));
  const date = fatti.map(id => stato.terminati.get(id)).filter(Boolean).sort();
  const aperti = ids.filter(id => !stato.terminati.has(id) && !stato.cancellati.has(id));
  return {
    ids,
    fatti,
    cancellati,
    // C'e' scritto qualcosa nel campo dell'ordine, ma non un ID ordine: va detto,
    // altrimenti l'utente aspetta una chiusura che non arrivera' mai.
    scritto_non_riconosciuto: ids.length === 0 && pulisci(todo && todo.riferimento_ordine) !== '',
    aperti,
    senza_fine: ids.filter(id => stato.senzaFine.has(id)),
    eseguiti: ids.filter(id => !!stato.eseguiti && stato.eseguiti.has(id)),
    sconosciuti: ids.filter(id => !stato.presenti.has(id)),
    ultima: ids.length > 0 && fatti.length === ids.length ? date[date.length - 1] : null,
    ultimo_ritiro: date.length ? date[date.length - 1] : null,
  };
}

/**
 * "l'ordine ET1 risulta terminato, trasporto finito il ...", al plurale se sono
 * piu' di uno. `ultima` e' il giorno del ritiro piu' recente fra quegli ordini.
 */
function testoTerminati(ids, ultima) {
  if (ids.length === 1) return `l'ordine ${ids[0]} risulta terminato${ultima ? `, trasporto finito il ${gg(ultima)}` : ''}`;
  return `gli ordini ${elenco(ids)} risultano terminati${ultima ? `, l'ultimo trasporto finito il ${gg(ultima)}` : ''}`;
}

/**
 * "l'ordine ET1 risulta cancellato a portale (Mancanza di pfu)", al plurale se
 * sono piu' di uno, ognuno col suo motivo. Il giorno no: il portale non lo dice,
 * e quello in cui il gestionale l'ha vista lo dice una volta sola la riga della
 * sezione (chiusa_dal_gestionale_il).
 */
export function testoCancellati(ids, stato) {
  const quali = (ids || []).map(id => { const m = stato && stato.cancellati && stato.cancellati.get(id); return m ? `${id} (${m})` : id; });
  if (quali.length === 1) return `l'ordine ${quali[0]} risulta cancellato a portale`;
  return `gli ordini ${elenco(quali)} risultano cancellati a portale`;
}

/**
 * Perche' un'attivita' NON si chiude, o che cosa c'e' da guardare sui suoi
 * ordini. Vuoto quando non c'e' niente da dire.
 *
 * Su un'attivita' GIA' CHIUSA - completata o cancellata - non si dice
 * "l'attivita' resta aperta": la frase sarebbe smentita dalla riga su cui
 * compare. E sui suoi ordini cancellati non si dice niente: quando e perche' lo
 * dice gia' la riga della sua sezione.
 *
 * `fermo`: l'attivita' e' da fare, nessun suo ordine e' piu' aperto e almeno uno
 * e' cancellato, ma il passaggio il gestionale non l'ha visto mentre lei era da
 * fare (ordini gia' chiusi quando e' comparsa, o passaggio consumato mentre era
 * spuntata): non si chiudera' da sola, e l'avviso dice perche'.
 */
export function avvisoOrdini(esito, stato, todo = null, fermo = false) {
  const parti = [];
  const chiusa = !!todo && (todo.stato === 'completato' || todo.stato === 'cancellato');
  const resta = chiusa ? '' : " l'attività resta aperta e";
  if (esito.scritto_non_riconosciuto) {
    parti.push("Sull'ordine da completare c'è scritto qualcosa che non è un ID ordine (due-quattro lettere e almeno sei cifre, come ET26012345): così l'attività non si chiuderà da sola.");
  }
  // Un ordine cancellato su un'attivita' ancora aperta: o ci sono altri ordini da
  // aspettare, o il passaggio non si e' visto, o l'attivita' l'ha riaperta
  // l'utente dopo che il gestionale l'aveva chiusa. Si dice il fatto, senza
  // chiedere una decisione: quella l'ha gia' presa il portale (14/10/2026).
  const c = esito.cancellati;
  if (c.length && !chiusa) {
    const altri = esito.aperti.length;
    const perAltri = altri ? `, e l'attività resta aperta per ${altri === 1 ? "l'altro ordine" : 'gli altri ordini'}` : '';
    const frase = testoCancellati(c, stato);
    parti.push(`${frase[0].toUpperCase()}${frase.slice(1)}: ${c.length === 1 ? 'quel ritiro non si farà' : 'quei ritiri non si faranno'}${perAltri}.`);
    if (fermo && !esito.fatti.length) {
      parti.push(c.length === 1
        ? "L'attività non passa da sola fra le cancellate perché il gestionale non ha visto l'ordine passare da assegnato a cancellato mentre lei era da fare: se non serve più, spuntala o eliminala tu."
        : "L'attività non passa da sola fra le cancellate perché il gestionale non ha visto gli ordini passare da assegnati a cancellati mentre lei era da fare: se non serve più, spuntala o eliminala tu.");
    } else if (fermo) {
      parti.push("L'attività non si chiude da sola perché il gestionale non ha visto i suoi ordini passare da assegnati a terminati o cancellati mentre lei era da fare: la spunta la metti tu.");
    }
  }
  // Cancellata dal gestionale, ma il portale l'ordine l'ha riaperto (un ordine
  // cancellato per errore torna assegnato con lo stesso ID). Il gestionale non
  // torna indietro da solo: lo dice, e riaprirla e' un clic.
  if (todo && todo.stato === 'cancellato' && todo.chiusa_dal_gestionale === true) {
    const tornati = esito.aperti.filter(id => stato.presenti.has(id) && !(stato.eseguiti && stato.eseguiti.has(id)) && !stato.senzaFine.has(id));
    if (tornati.length === 1) parti.push(`L'ordine ${tornati[0]} risulta di nuovo assegnato a portale: l'attività era passata fra le cancellate, se serve ancora riaprila.`);
    else if (tornati.length > 1) parti.push(`Gli ordini ${elenco(tornati)} risultano di nuovo assegnati a portale: l'attività era passata fra le cancellate, se serve ancora riaprila.`);
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
  if (!todo || todo.stato === 'completato' || todo.stato === 'cancellato' || todo.chiusa_dal_gestionale) return '';
  if (!todo.ordini_attesi || pulisci(todo.ordini_da_attendere) !== '') return '';
  const n = Number(todo.ordini_totali) || 0;
  if (!n || Number(todo.ordini_terminati) !== n) return '';
  return n === 1
    ? 'l’ordine risultava già terminato quando questa attività è comparsa: da allora nessun passaggio da assegnato a terminato, quindi la spunta la metti tu'
    : 'gli ordini risultavano già terminati quando questa attività è comparsa: da allora nessun passaggio da assegnato a terminato, quindi la spunta la metti tu';
}

/**
 * Che cosa fare di un'attivita': { esito, campi, chiusa, come }.
 *
 * `campi` sono i campi da salvare, compresi quelli della chiusura quando si
 * chiude; chi chiama li confronta con quelli che l'attivita' ha gia' e scrive
 * solo se e' cambiato qualcosa. Niente si riapre e niente si cancella: il
 * gestionale chiude, non torna indietro. `come` dice dove va l'attivita' chiusa:
 * 'completata' e 'in_parte' fra i completati, 'cancellata' fra le cancellate;
 * null se resta com'e'. `chiusa` e' vero in tutti e tre i casi.
 *
 * COME SI VEDE IL PASSAGGIO. `ordini_attesi` sono gli ID che stiamo guardando,
 * `ordini_da_attendere` quelli che erano ancora aperti quando abbiamo cominciato:
 *
 *  - ID cambiati davvero - ordini diversi, non gli stessi riscritti in un altro
 *    ordine - o attivita' mai controllata: si scrive che cosa si guarda e che
 *    cosa c'e' da attendere. E' il giro che GUARDA, e non chiude niente;
 *  - c'era qualcosa da attendere e adesso non resta nessun ordine aperto: il
 *    passaggio c'e' stato, e si chiude. Dove va lo dicono gli ordini: tutti
 *    terminati fra i completati, tutti cancellati fra le cancellate, alcuni
 *    terminati e gli altri cancellati fra i completati ed «evasa in parte»
 *    (14/10/2026);
 *  - non c'era niente da attendere: gli ordini erano gia' chiusi quando
 *    l'attivita' e' comparsa. Non si chiude mai da sola: notaOrdini lo dice per i
 *    terminati, l'avviso per i cancellati.
 *
 * Il passaggio vale per i cancellati come per i terminati (revisione del
 * 14/10/2026): prima un'attivita' su un ordine gia' cancellato passava fra le
 * cancellate al primo giro, cioe' appena salvata, e una con un ordine terminato da
 * mesi e uno cancellato si chiudeva «evasa in parte» senza nessun passaggio. La
 * sola eccezione e' la domanda del gestionale di prima (DOMANDA_DI_PRIMA): la
 * risposta dell'utente vale una volta, sulle attivita' coi loro ordini tutti
 * cancellati. Un ordine ancora assegnato, "eseguito", terminato senza la data o
 * che non si trova tiene l'attivita' aperta.
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
  const primoGiro = chiaveAttesi(attesiLetti(todo.ordini_attesi)) !== chiaveAttesi(esito.ids);
  const daAttendere = attesiLetti(todo.ordini_da_attendere);
  // Il primo giro su questi ID scrive che cosa c'e' da attendere; un passaggio
  // visto si consuma.
  const passaggio = !primoGiro && esito.ids.length > 0 && daAttendere.length > 0 && esito.aperti.length === 0;
  const attesa = primoGiro ? { ordini_da_attendere: attesiScritti(esito.aperti) } : passaggio ? { ordini_da_attendere: '' } : {};

  // Si chiude solo chi e' ancora da fare e non e' mai stato chiuso dal
  // gestionale: se e' tornata aperta, l'ha riaperta l'utente apposta.
  const daFare = todo.stato !== 'completato' && todo.stato !== 'cancellato' && todo.chiusa_dal_gestionale !== true;
  const nelFuturo = !!esito.ultimo_ritiro && !!oggi && esito.ultimo_ritiro > String(oggi).slice(0, 10);
  const nessunoAperto = esito.ids.length > 0 && esito.aperti.length === 0;
  const tuttiCancellati = nessunoAperto && esito.cancellati.length === esito.ids.length;
  // La domanda di prima conta solo sugli stessi ordini su cui era stata scritta.
  const giaChiesto = !primoGiro && DOMANDA_DI_PRIMA.test(String(todo.avviso_ordini || ''));
  let come = null;
  if (daFare && !nelFuturo && nessunoAperto) {
    if (tuttiCancellati && (passaggio || giaChiesto)) come = 'cancellata';
    else if (passaggio) come = esito.cancellati.length ? 'in_parte' : 'completata';
  }
  // Ordini tutti chiusi e almeno uno cancellato, ma nessun passaggio visto: resta
  // da fare, e l'avviso dice perche' non si chiudera' da sola.
  const fermo = !come && daFare && !nelFuturo && nessunoAperto && esito.cancellati.length > 0;

  const statoNuovo = come === 'cancellata' ? 'cancellato' : come ? 'completato' : null;
  const terminati = testoTerminati(esito.fatti, esito.ultimo_ritiro);
  const nota = come === 'cancellata' ? `cancellata dal gestionale il ${gg(oggi)}: ${testoCancellati(esito.cancellati, stato)}`
    : come === 'in_parte' ? `chiusa dal gestionale il ${gg(oggi)}: evasa in parte, ${terminati}, e ${testoCancellati(esito.cancellati, stato)}`
      : `chiusa dal gestionale il ${gg(oggi)}: ${terminati}`;
  const chiusura = !come ? {} : {
    stato: statoNuovo,
    chiusa_dal_gestionale: true,
    // per una cancellata e' anche il giorno in cui il gestionale l'ha vista
    // cancellata: il portale quello della cancellazione non lo scrive
    chiusa_dal_gestionale_il: oggi,
    chiusura_nota: nota,
  };
  const campi = {
    ordini_totali: esito.ids.length,
    ordini_terminati: esito.fatti.length,
    // L'avviso si scrive sullo stato in cui l'attivita' resta: su una chiusa
    // adesso non si dice che resta aperta.
    avviso_ordini: avvisoOrdini(esito, stato, come ? { ...todo, stato: statoNuovo } : todo, fermo),
    ordini_attesi: attesi,
    ...attesa,
    ...chiusura,
  };
  return { esito, campi, chiusa: !!come, come };
}

/** "2 ordini su 3 terminati": a che punto e' un'attivita' con piu' di un ordine. */
export function testoAvanzamento(fatti, totali) {
  if (!totali || totali < 2) return '';
  return `${fatti} ${fatti === 1 ? 'ordine' : 'ordini'} su ${totali} ${fatti === 1 ? 'terminato' : 'terminati'}`;
}

/**
 * La riga che il caricamento delle primarie mostra per la to-do list, quando il
 * controllo ha chiuso o cancellato qualcosa o c'e' qualcosa da guardare. Vuota se
 * non c'e' niente da dire: un ricalcolo silenzioso e' un ricalcolo andato bene.
 *
 * Fra quelle da guardare (`daGuardare`, ognuna con lo `stato` in cui resta) ci
 * possono essere attivita' gia' chiuse: una cancellata il cui ordine il portale
 * ha riassegnato, una completata con un ID che non si trova. Di quelle non si
 * dice che «restano aperte»: hanno la loro frase (revisione del 14/10/2026).
 */
export function testoControlloTodo(chiuse, daGuardare, cancellate = []) {
  const chiusaOra = (x) => !!x && (x.stato === 'completato' || x.stato === 'cancellato');
  const aperte = (daGuardare || []).filter(x => !chiusaOra(x));
  const giaChiuse = (daGuardare || []).filter(chiusaOra);
  const a = (chiuse || []).length, b = aperte.length, k = (cancellate || []).length, z = giaChiuse.length;
  const parti = [];
  if (a) parti.push(a === 1
    ? `Nella to-do list un'attività si è chiusa da sola: ${chiuse[0].titolo} (${chiuse[0].ordini}).`
    : `Nella to-do list ${a} attività si sono chiuse da sole: ${chiuse.slice(0, 5).map(x => x.titolo).join(', ')}${a > 5 ? ` e altre ${a - 5}` : ''}.`);
  if (k) parti.push(k === 1
    ? `Un'attività è passata da sola fra le cancellate, il suo ordine risulta cancellato a portale: ${cancellate[0].titolo} (${cancellate[0].ordini}).`
    : `${k} attività sono passate da sole fra le cancellate, i loro ordini risultano cancellati a portale: ${cancellate.slice(0, 5).map(x => x.titolo).join(', ')}${k > 5 ? ` e altre ${k - 5}` : ''}.`);
  if (b) parti.push(b === 1
    ? `Un'attività della to-do list resta aperta e va guardata: ${aperte[0].titolo} - ${aperte[0].avviso}`
    : `${b} attività della to-do list restano aperte e vanno guardate: ${aperte.slice(0, 5).map(x => x.titolo).join(', ')}${b > 5 ? ` e altre ${b - 5}` : ''}.`);
  if (z) parti.push(z === 1
    ? `Fra le attività già chiuse della to-do list una ha qualcosa da guardare: ${giaChiuse[0].titolo} - ${giaChiuse[0].avviso}`
    : `Fra le attività già chiuse della to-do list ${z} hanno qualcosa da guardare: ${giaChiuse.slice(0, 5).map(x => x.titolo).join(', ')}${z > 5 ? ` e altre ${z - 5}` : ''}.`);
  return parti.join(' ');
}
