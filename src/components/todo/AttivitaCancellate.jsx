import React from 'react';
import { ChevronRight, XCircle, AlertTriangle, Trash2 } from 'lucide-react';
import { PRIORITA } from '@/components/todo/ElencoAttivita';
import { cancellazioneAttivita, testoCancellazione } from '@/lib/todoSezioni';
import { ordiniAttivita } from '@/lib/todoOrdini';
import Annotazioni from '@/components/todo/Annotazioni';

// LE ATTIVITA' CANCELLATE della to-do list (richiesta dell'utente del 14/10/2026,
// testuale: «qualora vi fossero degli ordini tra quelli aperti che venissero non
// eseguiti e quindi terminati bensi' cancellati a portale devono comparire
// automaticamente nei cancellati con data di cancellazione; a me non serve
// decidere sul gestionale cio' che e' gia' chiaro ed evidente sul portale»).
//
// Un'attivita' i cui ordini il portale da' tutti cancellati la passa qui il
// controllo degli ordini (base44/shared/todoOrdini.ts), da solo: esce dai da fare
// e non va fra i completati, perche' non e' un lavoro fatto. La sezione e' fatta
// come quella dei completati: chiusa all'apertura, col numero, le piu' recenti in
// alto (src/lib/todoSezioni.js), e per ognuna il giorno e il motivo. Il giorno
// della cancellazione il file del portale non lo porta: si dice quello in cui il
// gestionale l'ha trovata cancellata e l'ha passata qui, e la sezione lo spiega
// una volta (revisione del 14/10/2026: prima si scriveva come giorno della
// cancellazione Ordine_chiuso_il, che e' il clic su Chiudi di un trasporto).
//
// Qui non si scrive niente. L'amministratore puo' riaprirla (torna fra i da fare
// e il gestionale non la ricancella) o eliminarla: lo fa la pagina. Niente
// larghezze fisse, cosi' a 375 px si legge senza scorrere di lato.

function RigaCancellata({ todo, isAdmin, onRiapri, onElimina }) {
  const pr = PRIORITA[todo.priorita] || PRIORITA.media;
  const ids = ordiniAttivita(todo);
  return (
    <div className="border rounded-lg p-3 flex items-start gap-3 bg-muted/20" data-cancellata={todo.id}>
      <XCircle className="w-5 h-5 mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h3 className="font-heading font-semibold text-sm break-words">{todo.titolo}</h3>
          <span className={`text-xs px-2 py-0.5 rounded border ${pr.color}`}>{pr.label}</span>
          {isAdmin && (
            <button onClick={() => onRiapri(todo)} className="text-xs px-2 py-0.5 rounded border hover:bg-accent">Riapri</button>
          )}
        </div>
        <p className="text-xs text-slate-700 mb-1">{testoCancellazione(cancellazioneAttivita(todo))}</p>
        {ids.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {ids.length > 1 ? 'Ordini: ' : 'Ordine: '}<span className="font-mono break-all">{ids.join(', ')}</span>
          </p>
        )}
        {todo.descrizione && <p className="text-sm text-muted-foreground break-words">{todo.descrizione}</p>}
        {todo.categoria && <p className="text-xs text-muted-foreground">Categoria: {todo.categoria}</p>}
        {/* Il portale ha riaperto un suo ordine: lo dice, e riaprirla e' un clic. */}
        {todo.avviso_ordini && (
          <p className="flex items-start gap-1 text-xs text-amber-800 mt-1">
            <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
            <span>{todo.avviso_ordini}</span>
          </p>
        )}
        {/* Le annotazioni restano anche qui, da leggere (15/10/2026). */}
        <Annotazioni archivio="Todo" record={todo} />
      </div>
      {isAdmin && (
        <button onClick={() => onElimina(todo)} className="p-2 rounded-md hover:bg-red-50 flex-shrink-0" aria-label="Elimina">
          <Trash2 className="w-4 h-4 text-red-500" />
        </button>
      )}
    </div>
  );
}

/** `todos` sono le cancellate, gia' ordinate da dividiAttivita. */
export default function AttivitaCancellate({ todos = [], isAdmin = false, onRiapri = () => {}, onElimina = () => {} }) {
  const n = todos.length;
  return (
    <details className="group border rounded-lg" data-sezione="cancellati">
      <summary className="list-none px-3 py-2 text-sm font-medium cursor-pointer select-none flex flex-wrap items-center gap-x-2 gap-y-1 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
        <XCircle className="w-4 h-4 shrink-0 text-slate-500" />
        <span>Cancellati ({n})</span>
      </summary>
      <div className="border-t px-3 py-3 space-y-2">
        {n > 0 && <p className="text-xs text-muted-foreground">Le attività i cui ordini il portale ha cancellato: ci passano da sole, le più recenti in alto, ognuna col motivo della cancellazione. Il file del portale non porta il giorno della cancellazione: per ognuna c’è il giorno in cui il gestionale l’ha trovata cancellata e l’ha passata qui.</p>}
        {n > 0
          ? todos.map((todo) => <RigaCancellata key={todo.id} todo={todo} isAdmin={isAdmin} onRiapri={onRiapri} onElimina={onElimina} />)
          : <p className="text-sm text-muted-foreground">Nessuna attività cancellata: quando il portale cancella gli ordini di un’attività, lei esce dall’elenco qui sopra e la trovi qui.</p>}
      </div>
    </details>
  );
}
