import React, { useContext, useState } from 'react';
import { CalendarClock, Loader2, StickyNote } from 'lucide-react';
import Annotazioni from '@/components/todo/Annotazioni';
import { ScrittureTodo } from '@/components/todo/scrittureTodo';
import { annotazioniSalvate } from '@/lib/annotazioni';
import { correzioneDelTermine, soloData, termineRichiesta, testoTermine } from '@/lib/richiesteEct';

// LA NOTA INTERNA E LE ANNOTAZIONI DI UNA RICHIESTA ECT (15/10/2026). Richiesta
// dell'utente, testuale: «nella to-do list permetti la modifica delle richieste
// aperte per successive integrazioni e\o annotazioni». Su una richiesta ancora
// da ritirare l'amministratore scrive e corregge la nota interna (note_interne,
// che l'archivio aveva gia' e nessuna pagina mostrava) e accoda le annotazioni,
// come sulle attivita' (Annotazioni.jsx). Sulle richieste completate si leggono
// e basta.
//
// IL CARICAMENTO DEL FOGLIO NON LE TOCCA. importaRichiesteEct riscrive i campi
// che vengono dal foglio e dai ritiri, e la nota interna e le annotazioni non
// sono fra quelli; lo stesso il ricalcolo dei ritiri dopo le primarie
// (importaBlocco, ritiri_ect). La prova e' sul banco, con le funzioni vere
// (prove/todoModificaAnnotazioni.mjs).
//
// IL TERMINE CORRETTO A MANO (15/10/2026, stessa richiesta). Il termine chiesto
// dal consorzio il caricamento lo ricalcola dalla nota del foglio a ogni giro
// (scadenza): corretto li', tornava com'era. La correzione sta in un campo suo,
// scadenza_manuale, che il caricamento non nomina mai, come id_ordine_manuale:
// su una richiesta aperta l'amministratore apre «Correggi il termine», sceglie il
// giorno e salva; svuotato (o «Torna al termine del foglio», o col giorno del
// foglio) si scrive null e vale di nuovo quello del foglio. Da quel momento il termine che vale e' quello
// (scadenzaDi, src/lib/richiesteEct.js): la colonna «Entro», le richieste in
// ritardo, la dashboard, EcoTyna. Qui sotto si legge «entro il gg/mm/aaaa
// (corretto a mano; dal foglio: gg/mm/aaaa)», anche da chi non e'
// amministratore, quando chi disegna la riga passa `termine`. Prova:
// prove/termineRichiesteEct.mjs.
//
// Sta nella colonna del produttore, che a 375 px resta ferma a sinistra: la
// nota, il termine e le annotazioni si leggono senza scorrere la tabella.
//
// Qui non si scrive niente: la nota interna e le annotazioni le scrive la
// pagina To-Do List (ScrittureTodo, scrittureTodo.js), il termine la scheda
// delle richieste (RichiesteEct.jsx, `onTermine`), che aggiorna anche la sua
// riga senza rileggere l'elenco. Senza chi scrive i pulsanti non ci sono.

const messaggioDi = (e) => (e && e.response && e.response.data && e.response.data.error) || (e && e.message) || String(e);
// Un giorno vero: «31/02/2026» non lo e', anche se ha la forma giusta.
const giornoVero = (d) => !!d && !isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;
const gg = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '');

export default function NoteRichiesta({ richiesta, modificabile = false, scrittore = null, termine = false, onTermine = null }) {
  const dallaPagina = useContext(ScrittureTodo);
  const scritture = scrittore || dallaPagina;
  const puo = !!modificabile && !!scritture && typeof scritture.notaInterna === 'function';
  const puoTermine = !!modificabile && typeof onTermine === 'function';
  const [scritta, setScritta] = useState(null); // { base, valore } dopo un salvataggio
  const [testo, setTesto] = useState(null); // null quando non si sta scrivendo
  const [termineScritto, setTermineScritto] = useState(null); // { base, valore } dopo un salvataggio
  const [giorno, setGiorno] = useState(null); // il campo del termine; null quando e' chiuso
  const [occupato, setOccupato] = useState(false);
  const [errore, setErrore] = useState('');
  if (!richiesta) return null;

  const salvata = String(richiesta.note_interne ?? '');
  const nota = scritta && scritta.base === salvata ? scritta.valore : salvata;
  // Il termine scritto qui vale finche' la riga non arriva aggiornata.
  const manualeSalvato = soloData(richiesta.scadenza_manuale) || null;
  const manuale = termineScritto && termineScritto.base === manualeSalvato ? termineScritto.valore : manualeSalvato;
  const conTermine = { ...richiesta, scadenza_manuale: manuale };
  const t = termineRichiesta(conTermine);
  const rigaTermine = termine && t.corretto_a_mano ? testoTermine(conTermine) : '';
  // A chi legge e basta, senza niente da leggere, non si disegna niente.
  if (!puo && !puoTermine && !nota && !rigaTermine && !annotazioniSalvate(richiesta).length) return null;

  const salva = async () => {
    if (!puo || occupato) return;
    const pulito = String(testo ?? '').replace(/\r\n?/g, '\n').trim();
    // Non toccata: non si riscrive.
    if (pulito === nota.trim()) { setTesto(null); return; }
    setOccupato(true);
    setErrore('');
    try {
      await scritture.notaInterna(richiesta.id, pulito);
      setScritta({ base: salvata, valore: pulito });
      setTesto(null);
    } catch (e) {
      setErrore(`La nota interna non è stata salvata: ${messaggioDi(e)}`);
    } finally {
      setOccupato(false);
    }
  };

  // Vuoto vuol dire «torna al termine del foglio»: si scrive null. Lo stesso
  // giorno del foglio anche: e' tornarci, non correggerlo (correzioneDelTermine).
  // Il giorno che vale gia' non si riscrive: il campo si apre col termine che
  // vale, e aperto e salvato senza toccare niente non scrive niente. Prima
  // scriveva il giorno del foglio come correzione a mano, e il termine restava
  // bloccato li' anche quando il foglio ricaricato portava un sollecito
  // (rilievo della revisione del 15/10/2026).
  const salvaTermine = async (valore) => {
    if (!puoTermine || occupato) return;
    const scritto = String(valore ?? '').trim();
    const nuovo = scritto ? soloData(scritto) : null;
    if (scritto && !giornoVero(nuovo)) { setErrore('Il termine non è un giorno: scrivilo come gg/mm/aaaa.'); return; }
    const voluto = correzioneDelTermine(conTermine, nuovo);
    if (nuovo === t.termine || voluto === manuale) { setGiorno(null); setErrore(''); return; }
    setOccupato(true);
    setErrore('');
    try {
      await onTermine(richiesta, voluto);
      setTermineScritto({ base: manualeSalvato, valore: voluto });
      setGiorno(null);
    } catch (e) {
      setErrore(`Il termine non è stato salvato: ${messaggioDi(e)}`);
    } finally {
      setOccupato(false);
    }
  };

  const pulsanteNota = puo && testo === null ? (
    <button type="button" onClick={() => setTesto(nota)} className="inline-flex items-center gap-1 text-primary hover:underline">
      <StickyNote className="w-3.5 h-3.5" /> {nota ? 'Correggi la nota interna' : 'Nota interna'}
    </button>
  ) : null;
  const pulsanteTermine = puoTermine && giorno === null ? (
    <button type="button" onClick={() => { setErrore(''); setGiorno(t.termine || ''); }} className="inline-flex items-center gap-1 text-primary hover:underline">
      <CalendarClock className="w-3.5 h-3.5" /> Correggi il termine
    </button>
  ) : null;
  // I pulsanti stanno sulla riga di «Aggiungi un'annotazione»; se le annotazioni
  // non hanno chi le scrive, quella riga non c'e' e stanno su una riga loro.
  const nelleAnnotazioni = !!modificabile && !!scritture && typeof scritture.annota === 'function';
  const accanto = pulsanteNota && pulsanteTermine ? <>{pulsanteNota}{pulsanteTermine}</> : (pulsanteNota || pulsanteTermine);

  return (
    <div className="space-y-1 text-xs font-normal" data-note-richiesta={richiesta.id}>
      {rigaTermine && giorno === null && (
        <p className="mt-1 break-words text-amber-900" data-termine-a-mano={richiesta.id}><span className="font-medium">Termine:</span> {rigaTermine}</p>
      )}
      {puoTermine && giorno !== null && (
        <div className="mt-1 space-y-1">
          <label className="flex flex-wrap items-center gap-2">
            <span className="font-medium">Termine corretto a mano</span>
            <input
              type="date"
              autoFocus
              value={giorno}
              onChange={(e) => setGiorno(e.target.value)}
              aria-label="Termine corretto a mano"
              className="border rounded-md px-2 py-1 text-xs bg-background"
            />
          </label>
          <p className="text-muted-foreground break-words">
            {t.dal_foglio ? `Dal foglio: entro il ${gg(t.dal_foglio)}.` : 'Il foglio non ne dice uno.'} Resta anche ricaricando il foglio; svuotato o col giorno del foglio, torna quello del foglio.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => salvaTermine(giorno)} disabled={occupato} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary text-primary-foreground text-xs disabled:opacity-50">
              {occupato && <Loader2 className="w-3 h-3 animate-spin" />} Salva il termine
            </button>
            {manuale && (
              <button type="button" onClick={() => salvaTermine('')} disabled={occupato} className="px-2 py-1 rounded-md border text-xs hover:bg-accent">Torna al termine del foglio</button>
            )}
            <button type="button" onClick={() => { setGiorno(null); setErrore(''); }} disabled={occupato} className="px-2 py-1 rounded-md border text-xs hover:bg-accent">Annulla</button>
          </div>
        </div>
      )}
      {nota && testo === null && (
        <p className="mt-1 whitespace-pre-wrap break-words"><span className="font-medium">Nota interna:</span> {nota}</p>
      )}
      {puo && testo !== null && (
        <div className="mt-1 space-y-1">
          <textarea
            autoFocus
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            rows={2}
            maxLength={2000}
            aria-label="Nota interna"
            className="w-full border rounded-md px-2 py-1 text-xs bg-background"
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={salva} disabled={occupato} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary text-primary-foreground text-xs disabled:opacity-50">
              {occupato && <Loader2 className="w-3 h-3 animate-spin" />} Salva la nota
            </button>
            <button type="button" onClick={() => setTesto(null)} disabled={occupato} className="px-2 py-1 rounded-md border text-xs hover:bg-accent">Annulla</button>
          </div>
        </div>
      )}
      {errore && <p className="text-red-700 break-words">{errore}</p>}
      {!nelleAnnotazioni && accanto && <div className="flex flex-wrap items-center gap-x-3 gap-y-1">{accanto}</div>}
      <Annotazioni archivio="RichiestaEct" record={richiesta} modificabile={modificabile} accanto={nelleAnnotazioni ? accanto : null} scrittore={scritture} />
    </div>
  );
}
