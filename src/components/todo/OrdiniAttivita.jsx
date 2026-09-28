import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { ordiniAttivita, testoAvanzamento, notaOrdini } from '@/lib/todoOrdini';

// Gli ID ordine di un'attivita': si scrivono qui e da qui si vede a che punto
// sono. Quando quell'ordine passa da assegnato a terminato l'attivita' si chiude
// da sola, e la riga porta scritto perche' e quando (base44/shared/todoOrdini.ts).
// Gli ordini si possono scrivere piu' di uno, separati da virgola, come nelle
// richieste del consorzio: allora si chiude quando sono terminati tutti.
//
// Scrive, quindi l'ID lo cambia solo l'amministratore; gli altri lo leggono.

const gg = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '');

export default function OrdiniAttivita({ todo, isAdmin, onSalva }) {
  const [testo, setTesto] = useState(null); // null quando non si sta scrivendo
  const [occupato, setOccupato] = useState(false);

  const ids = ordiniAttivita(todo);
  const totali = todo.ordini_totali || ids.length;
  const avanzamento = testoAvanzamento(todo.ordini_terminati || 0, totali);
  const nota = notaOrdini(todo);

  const salva = async (valore) => {
    const originale = String(todo.riferimento_ordine || '');
    setTesto(null);
    // SE NON E' STATO TOCCATO, NON SI RISCRIVE. Il campo esisteva da prima e
    // voleva dire "ordine correlato": su un'attivita' vecchia puo' contenere
    // testo libero ("da chiedere a Ecotyre"), e di quel campo non c'e' storico.
    // Aprendolo e chiudendolo senza scrivere, il confronto con la forma
    // normalizzata lo faceva sembrare cambiato e lo riscriveva: "DA, CHIEDERE, A,
    // ECOTYRE". Si confronta con quello che c'era, non con quello che diventerebbe.
    if (String(valore ?? '') === originale) return;
    // Un elenco di soli ID ordine si riscrive ordinato, come nelle richieste del
    // consorzio; se c'e' anche altro si salva come l'utente l'ha scritto, perche'
    // normalizzare una frase la rovina.
    const pezzi = String(valore || '').split(/[,;\s]+/).filter(Boolean);
    const soloId = pezzi.length > 0 && pezzi.every(p => ordiniAttivita({ riferimento_ordine: p }).length === 1);
    const pulito = soloId ? pezzi.map(x => x.toUpperCase()).join(', ') : String(valore || '').replace(/\s+/g, ' ').trim();
    if (pulito === originale.trim()) return;
    setOccupato(true);
    try {
      await onSalva(pulito);
    } finally {
      setOccupato(false);
    }
  };

  if (!ids.length && !todo.riferimento_ordine && !isAdmin && !todo.chiusura_nota && !todo.avviso_ordini && !nota) return null;

  return (
    <div className="mt-1 space-y-1 text-xs">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-muted-foreground">Ordine da completare:</span>
        {testo !== null ? (
          <input
            autoFocus
            value={testo}
            onChange={e => setTesto(e.target.value)}
            onBlur={() => salva(testo)}
            onKeyDown={e => { if (e.key === 'Enter') salva(testo); if (e.key === 'Escape') setTesto(null); }}
            placeholder="ET26012345, ET26012346"
            className="border rounded px-2 py-1 text-xs font-mono w-56"
          />
        ) : (
          <button
            type="button"
            disabled={!isAdmin || occupato}
            onClick={() => setTesto(todo.riferimento_ordine || '')}
            title={isAdmin ? "Scrivi o correggi gli ID ordine: puoi metterne più di uno, separati da virgola. Quando risultano tutti terminati l'attività si chiude da sola" : ''}
            className={isAdmin ? 'hover:underline' : 'cursor-default'}
          >
            {occupato ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : ids.length ? <span className="font-mono">{ids.join(', ')}</span>
                /* Quello che c'e' scritto si mostra com'e' anche quando non e' un
                   ID ordine: nasconderlo farebbe sembrare il campo vuoto. */
                : todo.riferimento_ordine ? <span className="font-mono text-amber-800">{todo.riferimento_ordine}</span>
                  : <span className="text-muted-foreground">{isAdmin ? 'scrivi l’ID ordine e si chiuderà da sola' : 'non indicato'}</span>}
          </button>
        )}
        {avanzamento && <span className="text-muted-foreground">({avanzamento})</span>}
      </div>

      {/* Perche' si e' chiusa, e quando: non si cancella, resta scritto. */}
      {todo.chiusura_nota && (
        <p className="flex items-start gap-1 text-green-700">
          <CheckCircle2 className="w-3.5 h-3.5 mt-px shrink-0" />
          <span>
            {todo.stato === 'completato'
              ? todo.chiusura_nota
              : `riaperta a mano: il gestionale l’aveva chiusa (${todo.chiusura_nota})`}
          </span>
        </p>
      )}

      {/* Perche' NON si chiude: ordine cancellato, terminato senza la data di
          fine trasporto, ID che non si trova. */}
      {todo.avviso_ordini && (
        <p className="flex items-start gap-1 text-amber-800">
          <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
          <span>{todo.avviso_ordini}</span>
        </p>
      )}

      {/* Il passaggio non c'e' mai stato: l'ordine risultava gia' terminato quando
          l'attivita' e' comparsa. Non e' un avviso, e' il motivo per cui questa
          riga aspetta una spunta a mano: testo neutro, non ambra. */}
      {nota && <p className="text-muted-foreground">{nota}</p>}

      {todo.chiusa_dal_gestionale_il && !todo.chiusura_nota && (
        <p className="text-muted-foreground">chiusa dal gestionale il {gg(todo.chiusa_dal_gestionale_il)}</p>
      )}
    </div>
  );
}
