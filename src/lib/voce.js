// Voce di EcoTyna: lettura delle risposte, dettatura delle domande e modalita'
// conversazione.
//
// Tutto passa dalla sintesi e dal riconoscimento vocale del browser: il
// gestionale non chiama nessun servizio e non paga niente. Due precisazioni,
// perche' fino all'11/10/2026 qui c'era scritto «nessun dato che esce dal
// gestionale», e non era vero fino in fondo:
// - la DETTATURA in Chrome e in Edge e' fatta dal servizio vocale del browser
//   (Google, Microsoft): l'audio esce dal computer, come per la dettatura di
//   qualunque sito. Per questo la modalita' conversazione, che ascolta anche
//   mentre EcoTyna parla, e' spenta finche' non la si accende;
// - le VOCI ONLINE (Edge «Elsa Online (Natural)», Chrome «Google italiano»)
//   sono le piu' naturali, ma ricevono il testo da dire. Non si scelgono da
//   sole: si propongono una volta, e decide l'utente (voceDaUsare, in
//   parlato.js). Le voci del computer non mandano niente a nessuno.
// La voce e' spenta finche' non la si accende, e le scelte restano su questo
// computer.
//
// Il testo da dire lo prepara parlato.js (numeri, date, sigle, nomi detti come
// si dicono), si legge frase per frase (leggiAVoce) e la bocca dell'avatar segue
// le sillabe di ogni frase (visemi.js).

import { useCallback, useEffect, useRef, useState } from 'react';
import { traccia, visemaA, istanteDelCarattere, RIPOSO } from './visemi.js';
import { frasiDaDire, leggiAVoce, ordinaVoci, qualitaVoce, voceDaUsare, voceDaProporre } from './parlato.js';
import { creaConversazione } from './conversazione.js';

const CHIAVE_ATTIVA = 'eco_voce_attiva';
const CHIAVE_VOCE = 'eco_voce_nome';
const CHIAVE_ONLINE = 'eco_voce_online';
const CHIAVE_CONVERSAZIONE = 'eco_conversazione';

// Quanto spesso si guarda l'orario della bocca: 45 millesimi, cioe' ventidue
// volte al secondo. Le forme durano dai 55 ai 115 millesimi, quindi nessuna
// sfugge, e il disegno le raccorda con una transizione.
const PASSO = 45;
const VELOCITA = 1;

const adesso = () =>
  (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

// Qualche voce non manda l'avviso di parola (onboundary): se la traccia finisce
// prima della voce vera, la bocca non si blocca chiusa mentre si sente ancora
// parlare, ma tira avanti piano finche' la frase non e' finita per davvero.
const tiraAvanti = (ms) => (Math.floor(ms / 170) % 2 ? 'A' : 'C');

const leggiPreferenza = (chiave, predefinito) => {
  try { const v = localStorage.getItem(chiave); return v === null ? predefinito : v; } catch { return predefinito; }
};
const scriviPreferenza = (chiave, valore) => {
  try { localStorage.setItem(chiave, valore); } catch { /* niente da fare */ }
};

/** Le voci italiane disponibili, dalla piu' naturale (ordinaVoci in parlato.js). */
export function vociItaliane() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  return ordinaVoci(window.speechSynthesis.getVoices());
}

/**
 * Lettura ad alta voce con la bocca per l'avatar.
 * Ritorna { disponibile, attiva, accendi, voci, voce, scegliVoce, proposta,
 * usaOnline, stato, bocca, parla, ferma, alParlare }.
 *
 * `bocca` e' un riferimento, non uno stato: dentro c'e' la forma della bocca in
 * questo istante e cambia ventidue volte al secondo. Se fosse uno stato di React
 * farebbe ridisegnare ventidue volte al secondo tutta la pagina della chat,
 * elenco dei messaggi compreso; cosi' invece lo guarda solo l'avatar, che e'
 * l'unico a cui serve.
 *
 * `proposta` e' una voce online piu' naturale di quella in uso, finche'
 * l'utente non ha detto si' o no (usaOnline): la pagina la propone.
 *
 * `alParlare(fn)` avvisa quando comincia una lettura ({ tipo: 'inizio', detto })
 * e quando finisce ({ tipo: 'fine', motivo: 'finito' | 'fermata' }): serve alla
 * conversazione per sapere quando tornare ad ascoltare.
 */
export function useVoce() {
  const disponibile = typeof window !== 'undefined' && !!window.speechSynthesis && typeof window.SpeechSynthesisUtterance === 'function';
  const [attiva, setAttiva] = useState(() => leggiPreferenza(CHIAVE_ATTIVA, '0') === '1');
  const [voci, setVoci] = useState([]);
  const [nomeVoce, setNomeVoce] = useState(() => leggiPreferenza(CHIAVE_VOCE, ''));
  const [online, setOnline] = useState(() => leggiPreferenza(CHIAVE_ONLINE, ''));
  const [stato, setStato] = useState('ferma');
  const bocca = useRef(RIPOSO);
  const battito = useRef(null);
  const avvio = useRef(0);
  const scarto = useRef(0);
  const orario = useRef(null);
  const lettura = useRef(null);
  const ascoltatori = useRef(new Set());

  useEffect(() => {
    if (!disponibile) return undefined;
    const aggiorna = () => setVoci(vociItaliane());
    aggiorna();
    window.speechSynthesis.addEventListener('voiceschanged', aggiorna);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', aggiorna);
  }, [disponibile]);

  // La finestra che si chiude o la pagina che cambia non devono lasciare la voce
  // accesa, ne' il battito della bocca a girare a vuoto.
  useEffect(() => () => {
    clearInterval(battito.current);
    if (lettura.current) lettura.current.ferma();
    if (disponibile) window.speechSynthesis.cancel();
  }, [disponibile]);

  const voce = voceDaUsare(voci, { nome: nomeVoce, online: online === 'si' });
  const proposta = !nomeVoce && !online ? voceDaProporre(voci, voce) : null;
  // Se la voce online non risponde (niente rete), la frase si ripete con questa.
  const ripiego = voci.find(v => !qualitaVoce(v).online) || null;

  const avvisa = useCallback((evento) => {
    for (const fn of ascoltatori.current) {
      try { fn(evento); } catch { /* un ascoltatore che sbaglia non ferma gli altri */ }
    }
  }, []);

  const alParlare = useCallback((fn) => {
    ascoltatori.current.add(fn);
    return () => ascoltatori.current.delete(fn);
  }, []);

  const ferma = useCallback(() => {
    if (lettura.current) lettura.current.ferma();
    else if (disponibile) window.speechSynthesis.cancel();
    clearInterval(battito.current);
    bocca.current = RIPOSO;
    setStato('ferma');
  }, [disponibile]);

  const parla = useCallback((testo) => {
    if (!disponibile) return;
    const frasi = frasiDaDire(testo);
    if (!frasi.length) return;
    // La lettura di prima finisce qui: la nuova non le si accoda.
    if (lettura.current) lettura.current.ferma();

    // L'orario delle forme della bocca per ogni frase: si prepara prima, cosi'
    // mentre si parla c'e' solo da leggere l'ora.
    const tracce = frasi.map(f => traccia(f.testo, { velocita: VELOCITA }));
    // Quello che lei dice, scritto e detto: la conversazione lo usa per non
    // scambiare la sua voce, che il microfono sente dalle casse, per l'utente.
    const detto = `${testo}\n${frasi.map(f => f.testo).join(' ')}`;
    setStato('parla');
    avvisa({ tipo: 'inizio', detto });

    let questa = null;
    questa = leggiAVoce({
      sintesi: window.speechSynthesis,
      Enunciato: window.SpeechSynthesisUtterance,
      frasi,
      voce,
      ripiego,
      velocita: VELOCITA,
      timer: window,
      alInizio: (k) => {
        orario.current = tracce[k];
        avvio.current = adesso();
        scarto.current = 0;
        clearInterval(battito.current);
        battito.current = setInterval(() => {
          const o = orario.current;
          const ms = adesso() - avvio.current + scarto.current;
          bocca.current = o && ms < o.durata ? visemaA(o, ms) : tiraAvanti(ms);
        }, PASSO);
      },
      // La voce dice a che parola e' arrivata: qui si sa dove dovrebbe essere la
      // bocca e dove e', e la differenza si corregge in un colpo. Non e' un
      // ritardo che si somma: ogni parola rifa' il conto da zero, quindi una
      // risposta lunga non si sfasa, e non importa se la voce scelta legge piu'
      // piano o piu' svelta di quanto si era stimato.
      alConfine: (k, carattere) => {
        scarto.current = istanteDelCarattere(tracce[k], carattere) - (adesso() - avvio.current);
      },
      // Fra una frase e l'altra la bocca si chiude: e' la pausa del respiro.
      allaFineFrase: () => {
        clearInterval(battito.current);
        bocca.current = RIPOSO;
      },
      allaFine: (motivo) => {
        clearInterval(battito.current);
        bocca.current = RIPOSO;
        if (lettura.current === questa) lettura.current = null;
        setStato(s => (lettura.current ? s : 'ferma'));
        avvisa({ tipo: 'fine', motivo });
      },
    });
    lettura.current = questa;
  }, [disponibile, voce, ripiego, avvisa]);

  const accendi = useCallback((valore) => {
    setAttiva(valore);
    scriviPreferenza(CHIAVE_ATTIVA, valore ? '1' : '0');
    if (!valore) ferma();
  }, [ferma]);

  const scegliVoce = useCallback((nome) => {
    setNomeVoce(nome);
    scriviPreferenza(CHIAVE_VOCE, nome);
  }, []);

  /** La risposta alla proposta della voce online: true la usa, false resta sul computer. */
  const usaOnline = useCallback((si) => {
    const valore = si ? 'si' : 'no';
    setOnline(valore);
    scriviPreferenza(CHIAVE_ONLINE, valore);
  }, []);

  return { disponibile, attiva, accendi, voci, voce, scegliVoce, proposta, usaOnline, stato, bocca, parla, ferma, alParlare };
}

/**
 * Il riconoscimento vocale del browser, con le sessioni messe in fila: se ne
 * apre una nuova solo quando la vecchia ha davvero chiuso (Chrome ne tiene una
 * per pagina, e aprirne un'altra prima fa fallire la nuova in silenzio), e una
 * sessione annullata non manda piu' niente, nemmeno la sua fine.
 *
 * onRisultato(risultati, daQui): tutti i risultati della sessione, [{ testo,
 * definitivo }], e l'indice del primo cambiato. onFine(motivo): la sessione e'
 * finita da sola ('negato' se il microfono non e' permesso). onAscolto(bool).
 */
export function creaRiconoscimento(Riconoscimento, { onRisultato, onFine, onAscolto }) {
  let corrente = null;
  let prossima = null;
  const apri = (opzioni) => {
    const r = new Riconoscimento();
    r.lang = 'it-IT';
    r.continuous = !!opzioni.continuo;
    r.interimResults = true;
    const sessione = { r, viva: true, motivo: '' };
    r.onresult = (e) => {
      if (!sessione.viva) return;
      const risultati = [...e.results].map(x => ({ testo: x[0].transcript, definitivo: !!x.isFinal }));
      onRisultato(risultati, typeof e.resultIndex === 'number' ? e.resultIndex : 0);
    };
    r.onerror = (e) => {
      if (e && (e.error === 'not-allowed' || e.error === 'service-not-allowed')) sessione.motivo = 'negato';
    };
    r.onend = () => {
      if (corrente === sessione) corrente = null;
      const eraViva = sessione.viva;
      sessione.viva = false;
      if (eraViva) { onAscolto(false); onFine(sessione.motivo); }
      if (prossima && !corrente) { const o = prossima; prossima = null; apri(o); }
    };
    corrente = sessione;
    try {
      r.start();
      onAscolto(true);
    } catch {
      corrente = null;
      sessione.viva = false;
      onAscolto(false);
      onFine('');
    }
  };
  return {
    avvia(opzioni = {}) {
      if (corrente) {
        prossima = opzioni;
        corrente.viva = false;
        try { corrente.r.abort(); } catch { /* gia' chiusa */ }
        return;
      }
      apri(opzioni);
    },
    annulla() {
      prossima = null;
      if (!corrente) return;
      corrente.viva = false;
      onAscolto(false);
      try { corrente.r.abort(); } catch { /* gia' chiusa */ }
    },
  };
}

const riconoscimentoDelBrowser = () =>
  (typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null);

/**
 * Dettatura della domanda. Ritorna { disponibile, inAscolto, avvia, interrompi }.
 * onTesto riceve il testo riconosciuto, parziale mentre si parla e definitivo alla fine.
 */
export function useAscolto(onTesto) {
  const Riconoscimento = riconoscimentoDelBrowser();
  const [inAscolto, setInAscolto] = useState(false);
  const motore = useRef(null);
  const richiamo = useRef(onTesto);
  richiamo.current = onTesto;

  const interrompi = useCallback(() => {
    try { motore.current?.stop(); } catch { /* gia' fermo */ }
    setInAscolto(false);
  }, []);

  useEffect(() => () => { try { motore.current?.abort(); } catch { /* gia' fermo */ } }, []);

  const avvia = useCallback(() => {
    if (!Riconoscimento) return;
    if (motore.current) { interrompi(); return; }
    const r = new Riconoscimento();
    r.lang = 'it-IT';
    r.continuous = false;
    r.interimResults = true;
    r.onresult = (e) => {
      const testo = [...e.results].map(x => x[0].transcript).join(' ').trim();
      const definitivo = e.results[e.results.length - 1].isFinal;
      richiamo.current(testo, definitivo);
    };
    const chiudi = () => { motore.current = null; setInAscolto(false); };
    r.onend = chiudi;
    r.onerror = chiudi;
    motore.current = r;
    setInAscolto(true);
    r.start();
  }, [Riconoscimento, interrompi]);

  return { disponibile: !!Riconoscimento, inAscolto, avvia, interrompi };
}

/**
 * LA MODALITA' CONVERSAZIONE (11/10/2026): dopo la risposta EcoTyna torna ad
 * ascoltare, se le si parla sopra si ferma, e la domanda dettata parte da sola
 * dopo una pausa, con un momento per annullarla. La logica sta in
 * conversazione.js, che si prova con node; qui c'e' solo il collegamento con la
 * voce, col microfono e con la pagina.
 *
 * Ritorna { disponibile, attiva, accendi, modo, inAscolto, conto, negato,
 * annullaInvio, inviaOra, utenteScrive, ascoltaOra }.
 */
export function useConversazione({ voce, onTesto, onInvia }) {
  const Riconoscimento = riconoscimentoDelBrowser();
  const disponibile = !!Riconoscimento && !!voce.disponibile;
  const [attiva, setAttiva] = useState(() => leggiPreferenza(CHIAVE_CONVERSAZIONE, '0') === '1');
  const [modo, setModo] = useState('spenta');
  const [negato, setNegato] = useState(false);
  const motore = useRef(null);
  const richiami = useRef({});
  richiami.current = { onTesto, onInvia, ferma: voce.ferma };
  const { alParlare } = voce;
  // Acceso da un clic: si ascolta subito. Ritrovato acceso aprendo la pagina:
  // si aspetta che lei parli o che si prema il microfono, perche' una pagina
  // che apre il microfono da sola non la vuole nessuno.
  const subito = useRef(false);

  useEffect(() => {
    if (!disponibile) return undefined;
    const riconoscimento = creaRiconoscimento(Riconoscimento, {
      onRisultato: (risultati, daQui) => motore.current && motore.current.risultato(risultati, daQui),
      onFine: (motivo) => motore.current && motore.current.fineAscolto(motivo),
      onAscolto: () => {},
    });
    const c = creaConversazione({
      ascolto: riconoscimento,
      timer: window,
      onTesto: (t) => richiami.current.onTesto && richiami.current.onTesto(t),
      onInvia: (q) => richiami.current.onInvia && richiami.current.onInvia(q),
      onInterrompi: () => richiami.current.ferma && richiami.current.ferma(),
      onStato: (s) => {
        setModo(s.modo);
        if (s.negato) {
          setNegato(true);
          setAttiva(false);
          scriviPreferenza(CHIAVE_CONVERSAZIONE, '0');
        }
      },
    });
    motore.current = c;
    const via = alParlare((ev) => (ev.tipo === 'inizio' ? c.iniziaAParlare(ev.detto) : c.finitoDiParlare(ev.motivo)));
    return () => { via(); c.spegni(); motore.current = null; };
  }, [disponibile, Riconoscimento, alParlare]);

  useEffect(() => {
    const c = motore.current;
    if (!c) return;
    if (attiva) { c.accendi({ ascolta: subito.current }); subito.current = false; } else c.spegni();
  }, [attiva, disponibile]);

  const accendi = useCallback((valore) => {
    subito.current = !!valore;
    if (valore) setNegato(false);
    setAttiva(!!valore);
    scriviPreferenza(CHIAVE_CONVERSAZIONE, valore ? '1' : '0');
  }, []);

  const chiama = (nome) => () => motore.current && motore.current[nome]();
  return {
    disponibile,
    attiva: disponibile && attiva,
    accendi,
    modo,
    inAscolto: modo === 'domanda' || modo === 'conto',
    conto: modo === 'conto',
    negato,
    annullaInvio: chiama('annullaInvio'),
    inviaOra: chiama('inviaOra'),
    utenteScrive: chiama('utenteScrive'),
    ascoltaOra: chiama('ascoltaOra'),
  };
}
