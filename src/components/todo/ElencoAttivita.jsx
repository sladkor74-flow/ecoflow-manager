import React from 'react';
import { CheckSquare, Square, AlertCircle, CheckCircle2, Trash2 } from 'lucide-react';
import OrdiniAttivita from '@/components/todo/OrdiniAttivita';
import SezioneCompletati from '@/components/todo/SezioneCompletati';
import { dividiAttivita, daFareDelFiltro, completamentoAttivita, testoCompletamento, testoElencoVuoto } from '@/lib/todoSezioni';

// LE ATTIVITA' DELLA TO-DO LIST: l'elenco da fare e, sotto, la sezione dei
// completati (richiesta dell'utente del 12/10/2026). Prima un'attivita'
// completata restava nell'elenco barrata e sbiadita; adesso, a mano o da sola,
// ESCE dall'elenco e va fra i completati, col giorno e il perche'. Chi la riapre
// la riporta fra i da fare. La divisione e' quella di src/lib/todoSezioni.js, la
// regola e' lo stato salvato: qui non si scrive niente, scrive la pagina quando
// l'amministratore spunta o cambia lo stato.

export const PRIORITA = {
  urgente: { label: 'Urgente', color: 'bg-red-100 text-red-700 border-red-200' },
  alta: { label: 'Alta', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  media: { label: 'Media', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  bassa: { label: 'Bassa', color: 'bg-gray-100 text-gray-700 border-gray-200' },
};

const STATO = {
  aperto: { label: 'Aperto', color: 'bg-blue-50 text-blue-700' },
  in_corso: { label: 'In Corso', color: 'bg-amber-50 text-amber-700' },
};

function Dettagli({ todo }) {
  return (
    <>
      {todo.descrizione && <p className="text-sm text-muted-foreground break-words">{todo.descrizione}</p>}
      {(todo.categoria || todo.data_scadenza) && (
        <div className="flex items-center gap-x-3 gap-y-1 flex-wrap mt-1 text-xs text-muted-foreground">
          {todo.categoria && <span>Categoria: {todo.categoria}</span>}
          {todo.data_scadenza && <span>Scadenza: {new Date(todo.data_scadenza).toLocaleDateString('it-IT')}</span>}
        </div>
      )}
    </>
  );
}

/** Un'attivita' da fare: la spunta la completa, la targhetta dello stato la fa avanzare. */
function RigaDaFare({ todo, isAdmin, onSpunta, onCiclo, onElimina, onSalvaOrdine }) {
  const pr = PRIORITA[todo.priorita] || PRIORITA.media;
  const st = STATO[todo.stato] || STATO.aperto;
  const isOverdue = todo.data_scadenza && new Date(todo.data_scadenza) < new Date();
  return (
    <div className="border rounded-lg p-3 flex items-start gap-3" data-attivita={todo.id}>
      <button onClick={() => onSpunta(todo)} className="mt-0.5 flex-shrink-0" disabled={!isAdmin} aria-label="Segna come completata">
        <Square className="w-5 h-5 text-muted-foreground" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h3 className="font-heading font-semibold text-sm break-words">{todo.titolo}</h3>
          <span className={`text-xs px-2 py-0.5 rounded border ${pr.color}`}>{pr.label}</span>
          {isAdmin
            ? <button onClick={() => onCiclo(todo)} className={`text-xs px-2 py-0.5 rounded ${st.color} hover:opacity-80`}>{st.label}</button>
            : <span className={`text-xs px-2 py-0.5 rounded ${st.color}`}>{st.label}</span>}
          {isOverdue && <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Scaduto</span>}
        </div>
        <Dettagli todo={todo} />
        {/* L'ordine da completare, a che punto e' e perche' non si chiude. */}
        <OrdiniAttivita todo={todo} isAdmin={isAdmin} onSalva={(ordini) => onSalvaOrdine(todo, ordini)} />
      </div>
      {isAdmin && <button onClick={() => onElimina(todo)} className="p-2 rounded-md hover:bg-red-50 flex-shrink-0" aria-label="Elimina"><Trash2 className="w-4 h-4 text-red-500" /></button>}
    </div>
  );
}

/** Un'attivita' completata: quando e perche', e la spunta che la riapre. */
function RigaCompletata({ todo, isAdmin, onSpunta, onElimina, onSalvaOrdine }) {
  const pr = PRIORITA[todo.priorita] || PRIORITA.media;
  const c = completamentoAttivita(todo);
  return (
    <div className="border rounded-lg p-3 flex items-start gap-3 bg-muted/20" data-completata={todo.id}>
      <button onClick={() => onSpunta(todo)} className="mt-0.5 flex-shrink-0" disabled={!isAdmin} aria-label="Riapri: torna fra i da fare">
        <CheckSquare className="w-5 h-5 text-green-600" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h3 className="font-heading font-semibold text-sm break-words">{todo.titolo}</h3>
          <span className={`text-xs px-2 py-0.5 rounded border ${pr.color}`}>{pr.label}</span>
          {isAdmin && (
            <button onClick={() => onSpunta(todo)} className="text-xs px-2 py-0.5 rounded border hover:bg-accent">Riapri</button>
          )}
        </div>
        <p className="flex items-start gap-1 text-xs text-green-700 mb-1">
          <CheckCircle2 className="w-3.5 h-3.5 mt-px shrink-0" />
          <span>{testoCompletamento(c)}</span>
        </p>
        <Dettagli todo={todo} />
        <OrdiniAttivita todo={todo} isAdmin={isAdmin} onSalva={(ordini) => onSalvaOrdine(todo, ordini)} />
      </div>
      {isAdmin && <button onClick={() => onElimina(todo)} className="p-2 rounded-md hover:bg-red-50 flex-shrink-0" aria-label="Elimina"><Trash2 className="w-4 h-4 text-red-500" /></button>}
    </div>
  );
}

/**
 * `filtro`: 'tutti' (aperte e in corso), 'aperto' o 'in_corso'. Le completate non
 * stanno in nessun filtro: stanno nella loro sezione.
 */
export default function ElencoAttivita({ todos, filtro = 'tutti', isAdmin, onSpunta, onCiclo, onElimina, onSalvaOrdine }) {
  // Le cancellate dal portale (14/10/2026) stanno nella loro sezione, sotto i
  // completati: l'elenco vuoto lo dice, invece di «Nessuna attività».
  const { daFare, completati, cancellati } = dividiAttivita(todos);
  const visibili = daFareDelFiltro(daFare, filtro);
  const azioni = { isAdmin, onSpunta, onCiclo, onElimina, onSalvaOrdine };
  return (
    <div className="space-y-4">
      <div className="space-y-2" data-elenco="da-fare">
        {visibili.map((todo) => <RigaDaFare key={todo.id} todo={todo} {...azioni} />)}
        {visibili.length === 0 && (
          <div className="text-center py-8 px-3 text-muted-foreground border rounded-lg">{testoElencoVuoto(filtro, { daFare: daFare.length, completati: completati.length, cancellati: cancellati.length }, isAdmin)}</div>
        )}
      </div>
      <SezioneCompletati
        titolo="Completati"
        numero={completati.length}
        vuota="Ancora nessuna attività completata: quando ne completi una, a mano o da sola, esce dall'elenco qui sopra e la trovi qui."
      >
        {completati.map((todo) => <RigaCompletata key={todo.id} todo={todo} {...azioni} />)}
      </SezioneCompletati>
    </div>
  );
}
