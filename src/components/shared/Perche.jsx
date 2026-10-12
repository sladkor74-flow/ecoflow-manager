import React from 'react';
import { Info } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

// IL PERCHE' DI UN NUMERO, AL TOCCO (migliorie dell'11/10/2026).
//
// Le spiegazioni stavano in title=, che si legge solo passando col mouse: su
// iPhone e iPad, dove il gestionale si installa da Safari, non si vedevano mai.
// Qui un pulsante con la «i» apre un riquadro al tocco e da tastiera, e si chiude
// toccando fuori o con Esc. Comune: le altre pagine possono sostituire i loro
// title= con questo, una alla volta.
export default function Perche({ children, etichetta = 'Da dove viene questo numero', className = '', allinea = 'start' }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={etichetta}
          className={`inline-flex items-center justify-center w-6 h-6 -my-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring align-middle shrink-0 ${className}`}
        >
          <Info className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align={allinea} className="w-80 max-w-[calc(100vw-2rem)] text-xs leading-relaxed space-y-1.5">
        {children}
      </PopoverContent>
    </Popover>
  );
}
