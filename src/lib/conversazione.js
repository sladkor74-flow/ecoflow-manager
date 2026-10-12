// LA MODALITA' CONVERSAZIONE DI ECOTYNA (11/10/2026).
//
// L'utente voleva un'EcoTyna «piu' realistica»: con la voce accesa si parlava
// a turni rigidi. Si premeva il microfono, si dettava, si premeva Invia, si
// ascoltava fino in fondo; per chiedere un'altra cosa si ricominciava. Con una
// persona non si fa cosi'. Qui, se la modalita' e' accesa:
//
// - finita la risposta, EcoTyna torna ad ascoltare da sola;
// - se le si parla sopra, si ferma (e quello che si e' detto e' l'inizio della
//   domanda nuova): il microfono pero' sente anche lei dalle casse, e la sua eco
//   non deve interromperla. Lo decide eInterruzione (parlato.js): servono almeno
//   due parole che lei non sta dicendo, la meta' o con una parola da domanda che
//   non sia una sua parola capita male («quanto» per il suo «quando»).
//   «Basta» o «ferma» la fermano, se non sono parole della sua risposta; «ok
//   basta» e «basta grazie» anche quando lo sono, e non sono una domanda;
// - la domanda dettata parte da sola dopo una pausa di silenzio, ma prima c'e'
//   un momento (il conto) in cui si vede che sta per partire e la si puo'
//   annullare, o mandare subito. Una domanda costa una risposta del modello: non
//   deve partire per sbaglio. Riprendere a parlare durante il conto lo ferma.
//
// I modi: spenta | pronta (accesa, non ascolta) | sorveglia (ascolta mentre lei
// parla, solo per accorgersi di un'interruzione) | domanda (ascolta la domanda)
// | conto (la domanda sta per partire).
//
// Niente React e niente browser: il riconoscimento e i timer si passano, cosi'
// si prova con node (prove/conversazione.mjs). Il collegamento sta in voce.js
// (useConversazione).

import { eInterruzione, togliEco, soloComando } from './parlato.js';

/** I tempi, in millesimi. */
export const TEMPI = {
  silenzio: 1200,      // pausa dopo l'ultima parola prima del conto
  conto: 1800,         // quanto si vede il conto prima che la domanda parta
  attesa: 8000,        // senza una parola entro questo tempo si smette di ascoltare
  riprova: 300,        // riaprire l'ascolto chiuso dal browser mentre lei parla
  ripreseMassime: 30,  // ...ma non all'infinito
};

/**
 * @param {object} p
 * @param {{ avvia: (o:{continuo:boolean})=>void, annulla: ()=>void }} p.ascolto
 * @param {{ setTimeout: Function, clearTimeout: Function }} p.timer
 * @param {(testo:string)=>void} p.onTesto    il testo della domanda, man mano
 * @param {(domanda:string)=>void} p.onInvia  la domanda da mandare
 * @param {()=>void} p.onInterrompi           fermare la voce
 * @param {(s:{modo:string,domanda:string,negato?:boolean})=>void} p.onStato
 */
export function creaConversazione({ ascolto, timer = globalThis, onTesto, onInvia, onInterrompi, onStato, tempi = TEMPI }) {
  let modo = 'spenta';
  let parla = false;      // lei sta parlando
  let detto = '';         // quello che sta dicendo, per riconoscere la sua eco
  let daEco = false;      // l'ascolto e' nato mentre lei parlava
  let inizio = 0;         // da quale risultato della sessione comincia la domanda
  let domanda = '';
  let riprese = 0;
  let tSilenzio = null;
  let tConto = null;
  let tAttesa = null;
  let tRiprova = null;

  const avvisa = (extra = {}) => { if (onStato) onStato({ modo, domanda, ...extra }); };
  const cambia = (m) => { modo = m; avvisa(); };
  const pulisci = () => {
    for (const t of [tSilenzio, tConto, tAttesa, tRiprova]) timer.clearTimeout(t);
    tSilenzio = tConto = tAttesa = tRiprova = null;
  };
  const apri = (nataDaEco) => { daEco = nataDaEco; inizio = 0; ascolto.avvia({ continuo: true }); };
  const chiudi = () => { ascolto.annulla(); };

  const smetti = () => { pulisci(); chiudi(); cambia('pronta'); };
  const nienteDetto = () => { if (modo === 'domanda' && !domanda) smetti(); };
  const invia = () => {
    const q = domanda;
    pulisci();
    chiudi();
    domanda = '';
    cambia('pronta');
    if (q && onInvia) onInvia(q);
  };
  const contaEInvia = () => {
    if (!domanda) return;
    cambia('conto');
    tConto = timer.setTimeout(invia, tempi.conto);
  };
  const ascoltaDomanda = () => {
    pulisci();
    domanda = '';
    chiudi();
    apri(false);
    cambia('domanda');
    tAttesa = timer.setTimeout(nienteDetto, tempi.attesa);
  };
  const sorveglia = () => {
    pulisci();
    domanda = '';
    riprese = 0;
    chiudi();
    apri(true);
    cambia('sorveglia');
  };

  return {
    get modo() { return modo; },

    /** Accesa. Se lei sta parlando si comincia a sorvegliare; con ascolta, si ascolta subito. */
    accendi({ ascolta = false } = {}) {
      if (modo !== 'spenta') return;
      cambia('pronta');
      if (parla) sorveglia();
      else if (ascolta) ascoltaDomanda();
    },

    spegni() {
      pulisci();
      chiudi();
      domanda = '';
      if (modo !== 'spenta') cambia('spenta');
    },

    iniziaAParlare(testoDetto) {
      parla = true;
      detto = String(testoDetto || '');
      if (modo === 'spenta') return;
      sorveglia();
    },

    finitoDiParlare(motivo) {
      parla = false;
      // Interrotta: la domanda la si sta gia' ascoltando. Spenta o pronta: niente.
      if (modo !== 'sorveglia') return;
      if (motivo === 'finito') ascoltaDomanda();
      else smetti();   // fermata col pulsante: chi la ferma non vuole essere ascoltato
    },

    /** I risultati della sessione d'ascolto: [{ testo, definitivo }] e il primo cambiato. */
    risultato(risultati, daQui = 0) {
      const elenco = Array.isArray(risultati) ? risultati : [];
      if (modo === 'sorveglia') {
        const nuovo = elenco.slice(daQui).map(r => r.testo).join(' ');
        if (!eInterruzione(nuovo, detto)) return;
        inizio = daQui;
        // Prima si cambia modo, poi la si ferma: la fine della sua lettura non
        // deve chiudere l'ascolto della domanda appena cominciata.
        cambia('domanda');
        if (onInterrompi) onInterrompi();
      }
      if (modo !== 'domanda' && modo !== 'conto') return;
      const sentito = elenco.slice(inizio).map(r => r.testo).join(' ').replace(/\s+/g, ' ').trim();
      // Nata mentre lei parlava, la trascrizione comincia con la sua eco e con il
      // «basta» che l'ha fermata: si tolgono (togliEco toglie solo i pezzi della
      // sua frase, non le sue parole sparse con cui comincia una domanda vera).
      // Una domanda dettata a voce ferma si prende com'e'. Un «basta», anche con
      // un'altra parola («ok basta», «basta grazie»), non e' una domanda in
      // nessuno dei due casi (verifica, 12/10/2026).
      domanda = soloComando(sentito) ? '' : daEco ? togliEco(sentito, detto) : sentito;
      if (onTesto) onTesto(domanda);
      pulisci();
      cambia('domanda');
      if (domanda) tSilenzio = timer.setTimeout(contaEInvia, tempi.silenzio);
      else tAttesa = timer.setTimeout(nienteDetto, tempi.attesa);
    },

    /** La sessione d'ascolto e' finita da sola: silenzio lungo, rete, permesso negato. */
    fineAscolto(motivo = '') {
      if (motivo === 'negato') {
        pulisci();
        domanda = '';
        modo = 'spenta';
        avvisa({ negato: true });
        return;
      }
      if (modo === 'sorveglia') {
        // Il browser chiude l'ascolto dopo qualche secondo senza parole: mentre
        // lei parla lo si riapre, perche' l'interruzione puo' arrivare a meta'.
        if (parla && riprese < tempi.ripreseMassime) {
          riprese++;
          tRiprova = timer.setTimeout(() => { if (modo === 'sorveglia' && parla) apri(true); }, tempi.riprova);
        }
        return;
      }
      if (modo === 'domanda') {
        pulisci();
        if (domanda) contaEInvia();
        else cambia('pronta');
      }
    },

    /** «Annulla» durante l'ascolto o il conto: la domanda resta scritta e non parte. */
    annullaInvio() { if (modo === 'domanda' || modo === 'conto') smetti(); },

    /** «Invia ora»: senza aspettare il conto. */
    inviaOra() { if ((modo === 'domanda' || modo === 'conto') && domanda) invia(); },

    /** Chi comincia a scrivere a mano non vuole che la domanda parta da sola. */
    utenteScrive() { if (modo === 'domanda' || modo === 'conto') smetti(); },

    /** Il microfono premuto a conversazione accesa. */
    ascoltaOra() {
      if (modo === 'spenta') return;
      if (modo === 'domanda' || modo === 'conto') { smetti(); return; }
      if (parla && onInterrompi) { cambia('domanda'); onInterrompi(); }
      ascoltaDomanda();
    },
  };
}
