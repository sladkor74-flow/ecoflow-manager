import React, { useContext, useState } from 'react';
import { Loader2, StickyNote } from 'lucide-react';
import Annotazioni from '@/components/todo/Annotazioni';
import { ScrittureTodo } from '@/components/todo/scrittureTodo';
import { annotazioniSalvate } from '@/lib/annotazioni';

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
// (prove/todoModificaAnnotazioni.mjs). Il TERMINE chiesto dal consorzio invece
// non si cambia da qui: lo ricalcola dalla nota del foglio ogni caricamento.
//
// Sta nella colonna del produttore, che a 375 px resta ferma a sinistra: la
// nota e le annotazioni si leggono senza scorrere la tabella.
//
// Qui non si scrive niente: scrive la pagina To-Do List (ScrittureTodo,
// scrittureTodo.js). Senza chi scrive i pulsanti non ci sono.

const messaggioDi = (e) => (e && e.response && e.response.data && e.response.data.error) || (e && e.message) || String(e);

export default function NoteRichiesta({ richiesta, modificabile = false, scrittore = null }) {
  const dallaPagina = useContext(ScrittureTodo);
  const scritture = scrittore || dallaPagina;
  const puo = !!modificabile && !!scritture && typeof scritture.notaInterna === 'function';
  const [scritta, setScritta] = useState(null); // { base, valore } dopo un salvataggio
  const [testo, setTesto] = useState(null); // null quando non si sta scrivendo
  const [occupato, setOccupato] = useState(false);
  const [errore, setErrore] = useState('');
  if (!richiesta) return null;

  const salvata = String(richiesta.note_interne ?? '');
  const nota = scritta && scritta.base === salvata ? scritta.valore : salvata;
  // A chi legge e basta, senza niente da leggere, non si disegna niente.
  if (!puo && !nota && !annotazioniSalvate(richiesta).length) return null;

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

  const pulsanteNota = puo && testo === null ? (
    <button type="button" onClick={() => setTesto(nota)} className="inline-flex items-center gap-1 text-primary hover:underline">
      <StickyNote className="w-3.5 h-3.5" /> {nota ? 'Correggi la nota interna' : 'Nota interna'}
    </button>
  ) : null;

  return (
    <div className="space-y-1 text-xs font-normal" data-note-richiesta={richiesta.id}>
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
      <Annotazioni archivio="RichiestaEct" record={richiesta} modificabile={modificabile} accanto={pulsanteNota} scrittore={scritture} />
    </div>
  );
}
