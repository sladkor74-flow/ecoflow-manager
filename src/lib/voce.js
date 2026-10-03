// Voce di EcoTyna: lettura delle risposte e dettatura delle domande.
//
// Tutto avviene nel browser, con la sintesi vocale e il riconoscimento vocale che
// Chrome mette a disposizione: nessun servizio esterno, nessun dato che esce dal
// gestionale e nessun costo. La voce e' spenta finche' non la si accende, e la
// scelta resta su questo computer.

import { useCallback, useEffect, useRef, useState } from 'react';
import { traccia, visemaA, istanteDelCarattere, RIPOSO } from './visemi';

const CHIAVE_ATTIVA = 'eco_voce_attiva';
const CHIAVE_VOCE = 'eco_voce_nome';

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

/** Le voci italiane disponibili, femminili per prime. */
export function vociItaliane() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  const femminili = /elsa|isabella|alice|federica|carla|paola|giulia|female|donna/i;
  return window.speechSynthesis.getVoices()
    .filter(v => /^it/i.test(v.lang))
    .sort((a, b) => (femminili.test(b.name) ? 1 : 0) - (femminili.test(a.name) ? 1 : 0));
}

/**
 * Testo pronunciabile: via i segni del markdown, le tabelle e i link, che letti
 * ad alta voce diventano incomprensibili.
 */
export function testoDaLeggere(markdown) {
  return String(markdown || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\s*\|.*\|\s*$/gm, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[#*_`>]/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Lettura ad alta voce con la bocca per l'avatar.
 * Ritorna { disponibile, attiva, accendi, voci, voce, scegliVoce, stato, bocca, parla, ferma }.
 *
 * `bocca` e' un riferimento, non uno stato: dentro c'e' la forma della bocca in
 * questo istante e cambia ventidue volte al secondo. Se fosse uno stato di React
 * farebbe ridisegnare ventidue volte al secondo tutta la pagina della chat,
 * elenco dei messaggi compreso; cosi' invece lo guarda solo l'avatar, che e'
 * l'unico a cui serve.
 */
export function useVoce() {
  const disponibile = typeof window !== 'undefined' && !!window.speechSynthesis;
  const [attiva, setAttiva] = useState(() => leggiPreferenza(CHIAVE_ATTIVA, '0') === '1');
  const [voci, setVoci] = useState([]);
  const [nomeVoce, setNomeVoce] = useState(() => leggiPreferenza(CHIAVE_VOCE, ''));
  const [stato, setStato] = useState('ferma');
  const bocca = useRef(RIPOSO);
  const battito = useRef(null);
  const avvio = useRef(0);
  const scarto = useRef(0);

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
    if (disponibile) window.speechSynthesis.cancel();
  }, [disponibile]);

  const voce = voci.find(v => v.name === nomeVoce) || voci[0] || null;

  const ferma = useCallback(() => {
    if (disponibile) window.speechSynthesis.cancel();
    clearInterval(battito.current);
    bocca.current = RIPOSO;
    setStato('ferma');
  }, [disponibile]);

  const parla = useCallback((testo) => {
    if (!disponibile) return;
    const pulito = testoDaLeggere(testo);
    if (!pulito) return;
    window.speechSynthesis.cancel();
    const frase = new SpeechSynthesisUtterance(pulito);
    frase.lang = 'it-IT';
    if (voce) frase.voice = voce;
    frase.rate = VELOCITA;
    frase.pitch = 1.05;

    // L'orario delle forme della bocca per questa frase: si prepara prima, cosi'
    // mentre si parla c'e' solo da leggere l'ora.
    const orario = traccia(pulito, { velocita: VELOCITA });

    frase.onstart = () => {
      setStato('parla');
      avvio.current = adesso();
      scarto.current = 0;
      clearInterval(battito.current);
      battito.current = setInterval(() => {
        const ms = adesso() - avvio.current + scarto.current;
        bocca.current = ms < orario.durata ? visemaA(orario, ms) : tiraAvanti(ms);
      }, PASSO);
    };

    // La voce dice a che parola e' arrivata: qui si sa dove dovrebbe essere la
    // bocca e dove e', e la differenza si corregge in un colpo. Non e' un
    // ritardo che si somma: ogni parola rifa' il conto da zero, quindi una
    // risposta lunga non si sfasa, e non importa se la voce scelta legge piu'
    // piano o piu' svelta di quanto si era stimato.
    frase.onboundary = (e) => {
      if (typeof e.charIndex !== 'number') return;
      scarto.current = istanteDelCarattere(orario, e.charIndex) - (adesso() - avvio.current);
    };

    const chiudi = () => {
      clearInterval(battito.current);
      bocca.current = RIPOSO;
      setStato('ferma');
    };
    frase.onend = chiudi;
    frase.onerror = chiudi;
    window.speechSynthesis.speak(frase);
  }, [disponibile, voce]);

  const accendi = useCallback((valore) => {
    setAttiva(valore);
    scriviPreferenza(CHIAVE_ATTIVA, valore ? '1' : '0');
    if (!valore) ferma();
  }, [ferma]);

  const scegliVoce = useCallback((nome) => {
    setNomeVoce(nome);
    scriviPreferenza(CHIAVE_VOCE, nome);
  }, []);

  return { disponibile, attiva, accendi, voci, voce, scegliVoce, stato, bocca, parla, ferma };
}

/**
 * Dettatura della domanda. Ritorna { disponibile, inAscolto, avvia, interrompi }.
 * onTesto riceve il testo riconosciuto, parziale mentre si parla e definitivo alla fine.
 */
export function useAscolto(onTesto) {
  const Riconoscimento = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
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
