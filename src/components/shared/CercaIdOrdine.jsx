import React from 'react';
import { Search, X } from 'lucide-react';
import { formatIntero } from '@/lib/utils';

// Ricerca per ID ordine del portale: cerca in tutto l'archivio del modulo, a
// prescindere dagli altri filtri, e basta una parte dell'ID (es. 26001380).

/** Vero se l'ordine contiene il testo cercato nell'ID, senza badare a maiuscole e spazi. */
export function corrispondeIdOrdine(record, testo) {
  const cercato = String(testo || '').toUpperCase().replace(/\s+/g, '');
  if (!cercato) return true;
  return String(record?.id_ordine || '').toUpperCase().replace(/\s+/g, '').includes(cercato);
}

export default function CercaIdOrdine({ value, onChange, trovati = null, className = '' }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <div className="relative w-full sm:w-80">
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="search"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Cerca ID ordine (es. ET26001380)"
          aria-label="Cerca ID ordine"
          className="w-full rounded-md border border-slate-300 bg-white pl-9 pr-9 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-600/30 focus:border-sky-700 [&::-webkit-search-cancel-button]:hidden"
        />
        {value && (
          <button type="button" onClick={() => onChange('')} title="Cancella la ricerca" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {value && trovati !== null && (
        <span className="text-xs text-slate-600">
          {trovati === 0 ? 'Nessun ordine trovato' : `${formatIntero(trovati)} ${trovati === 1 ? 'ordine trovato' : 'ordini trovati'}`} in tutto l'archivio, senza gli altri filtri
        </span>
      )}
    </div>
  );
}
