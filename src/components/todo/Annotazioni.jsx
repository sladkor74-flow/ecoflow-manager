import React, { useContext, useState } from 'react';
import { Loader2, MessageSquarePlus, Pencil } from 'lucide-react';
import { annotazioniSalvate, inOrdineDiTempo, vediAnnotazione, accodaAnnotazione, correggiAnnotazione, MAX_TESTO } from '@/lib/annotazioni';
import { ScrittureTodo } from '@/components/todo/scrittureTodo';

// LE ANNOTAZIONI DI UN'ATTIVITA' O DI UNA RICHIESTA ECT (15/10/2026). Richiesta
// dell'utente, testuale: «nella to-do list permetti la modifica delle richieste
// aperte per successive integrazioni e\o annotazioni».
//
// Sotto ogni voce l'elenco delle annotazioni in ordine di tempo, ognuna col
// giorno e l'ora italiani, chi l'ha scritta e il testo; se sono piu' di due se ne
// vedono le ultime due e «tutte (N)» apre le altre. Con `modificabile` (lo passa
// chi disegna la voce: l'amministratore, su una voce ancora da fare)
// «Aggiungi un'annotazione» ne accoda una senza toccare le altre, e «correggi»
// cambia il testo di una riga gia' scritta dicendolo («corretta il ...», e il
// testo di prima resta). Le regole e la scrittura stanno in src/lib/annotazioni.js:
// si rilegge il record appena prima di scrivere e non si toglie mai una riga.
//
// Sulle voci chiuse (attivita' completate e cancellate, richieste completate) le
// annotazioni si leggono e basta: una voce chiusa si cambia dopo averla
// riaperta. Chi non e' amministratore le legge e non ha i pulsanti; la regola
// dell'archivio (rls di Todo e RichiestaEct) non gli lascerebbe scrivere.
//
// Qui non si scrive niente: scrive la pagina To-Do List, che mette chi scrive
// in ScrittureTodo (scrittureTodo.js) - una lettura e una scrittura per ogni
// annotazione salvata, nessuna all'apertura. Senza chi scrive i pulsanti non ci
// sono. Dopo il salvataggio la riga mostra l'elenco scritto, senza far
// rileggere tutta la pagina; quando la pagina rilegge, vale di nuovo il record.
// Niente larghezze fisse: a 375 px si legge senza scorrere.

const messaggioDi = (e) => (e && e.response && e.response.data && e.response.data.error) || (e && e.message) || String(e);

function Editor({ valore, onCambia, onSalva, onAnnulla, occupato, salva = 'Salva', etichetta }) {
  return (
    <div className="space-y-1">
      <textarea
        autoFocus
        value={valore}
        onChange={(e) => onCambia(e.target.value)}
        rows={2}
        maxLength={MAX_TESTO}
        aria-label={etichetta}
        placeholder="es. sollecitato al telefono, risponde entro venerdì"
        className="w-full border rounded-md px-2 py-1 text-xs bg-background"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSalva}
          disabled={occupato || !String(valore || '').trim()}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary text-primary-foreground text-xs disabled:opacity-50"
        >
          {occupato && <Loader2 className="w-3 h-3 animate-spin" />} {salva}
        </button>
        <button type="button" onClick={onAnnulla} disabled={occupato} className="px-2 py-1 rounded-md border text-xs hover:bg-accent">Annulla</button>
      </div>
    </div>
  );
}

/**
 * `archivio`: 'Todo' o 'RichiestaEct'; `record`: la voce, con il suo campo
 * annotazioni; `modificabile`: si possono aggiungere e correggere; `accanto`:
 * un pulsante da mettere sulla stessa riga di «Aggiungi un'annotazione» (la nota
 * interna delle richieste ECT); `scrittore`: chi scrive, se non e' quello della
 * pagina (ScrittureTodo).
 */
export default function Annotazioni({ archivio = 'Todo', record, modificabile = false, accanto = null, scrittore = null }) {
  const dallaPagina = useContext(ScrittureTodo);
  const scritture = scrittore || dallaPagina;
  // Si aggiunge e si corregge solo se chi disegna la riga lo permette e se la
  // pagina ha detto chi scrive.
  const puo = !!modificabile && !!scritture && typeof scritture.annota === 'function';
  const salvateSulRecord = annotazioniSalvate(record);
  const chiave = JSON.stringify(salvateSulRecord);
  const [scritte, setScritte] = useState(null); // { base, elenco } dopo un salvataggio
  const [tutte, setTutte] = useState(false);
  const [nuova, setNuova] = useState(null); // il testo della nuova; null se chiusa
  const [correzione, setCorrezione] = useState(null); // { id, testo }
  const [occupato, setOccupato] = useState(false);
  const [errore, setErrore] = useState('');

  // Quello scritto qui vale finche' la pagina non rilegge il record.
  const elenco = scritte && scritte.base === chiave ? scritte.elenco : salvateSulRecord;
  const ordinate = inOrdineDiTempo(elenco);
  if (!record || (!ordinate.length && !puo)) return null;
  const mostrate = tutte ? ordinate : ordinate.slice(-2);

  // cambia(elencoSalvato, chi) dice l'elenco nuovo: chi scrive lo chiama sul
  // record appena riletto, con l'email di chi e' collegato.
  const scrivi = async (cambia) => {
    if (!puo || occupato) return;
    setOccupato(true);
    setErrore('');
    try {
      const esito = await scritture.annota(archivio, record.id, cambia);
      setScritte({ base: chiave, elenco: esito.elenco });
      setNuova(null);
      setCorrezione(null);
    } catch (e) {
      setErrore(`L’annotazione non è stata salvata: ${messaggioDi(e)}`);
    } finally {
      setOccupato(false);
    }
  };

  return (
    <div className="mt-2 space-y-1 text-xs" data-annotazioni={record.id}>
      {ordinate.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-2 text-muted-foreground">
          <span className="font-medium">{ordinate.length === 1 ? 'Annotazione' : 'Annotazioni'}</span>
          {ordinate.length > 2 && (
            <button type="button" onClick={() => setTutte(!tutte)} className="underline hover:text-foreground">
              {tutte ? 'solo le ultime due' : `tutte (${ordinate.length})`}
            </button>
          )}
        </p>
      )}
      {mostrate.length > 0 && (
        <ul className="space-y-1">
          {mostrate.map((a, i) => {
            const v = vediAnnotazione(a);
            const inCorrezione = correzione && a.id && correzione.id === a.id;
            return (
              <li key={a.id || `${v.quando}-${i}`} className="border-l-2 border-primary/30 pl-2" data-annotazione={a.id || ''}>
                <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                  <span>{v.quando}</span>
                  {v.chi && <span className="break-all">{v.chi}</span>}
                  {puo && a.id && !inCorrezione && (
                    <button type="button" onClick={() => { setNuova(null); setCorrezione({ id: a.id, testo: v.testo }); }} className="inline-flex items-center gap-0.5 underline hover:text-foreground">
                      <Pencil className="w-3 h-3" /> correggi
                    </button>
                  )}
                </p>
                {inCorrezione ? (
                  <Editor
                    valore={correzione.testo}
                    onCambia={(testo) => setCorrezione({ id: a.id, testo })}
                    onSalva={() => scrivi((prima, chi) => correggiAnnotazione(prima, a.id, correzione.testo, chi))}
                    onAnnulla={() => setCorrezione(null)}
                    occupato={occupato}
                    salva="Salva la correzione"
                    etichetta="Correggi l’annotazione"
                  />
                ) : (
                  <p className="whitespace-pre-wrap break-words">{v.testo}</p>
                )}
                {v.correzione && (
                  <p className="text-[11px] italic text-muted-foreground break-words">
                    {v.correzione}{v.prima ? ` · prima diceva: «${v.prima}»` : ''}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {puo && (nuova !== null ? (
        <Editor
          valore={nuova}
          onCambia={setNuova}
          onSalva={() => scrivi((prima, chi) => accodaAnnotazione(prima, nuova, chi))}
          onAnnulla={() => setNuova(null)}
          occupato={occupato}
          salva="Salva l’annotazione"
          etichetta="Nuova annotazione"
        />
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <button type="button" onClick={() => { setCorrezione(null); setNuova(''); }} className="inline-flex items-center gap-1 text-primary hover:underline">
            <MessageSquarePlus className="w-3.5 h-3.5" /> Aggiungi un’annotazione
          </button>
          {accanto}
        </div>
      ))}
      {errore && <p className="text-red-700 break-words">{errore}</p>}
    </div>
  );
}
