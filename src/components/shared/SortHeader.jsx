import React from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

// Header di colonna cliccabile per ordinamento.
export default function SortHeader({ col, sortKey, sortDir, onSort, className = '' }) {
  const active = sortKey === col.key;
  return (
    <th
      className={`text-left px-3 py-2.5 font-medium whitespace-nowrap cursor-pointer select-none hover:bg-muted-foreground/10 transition-colors ${className}`}
      onClick={() => onSort(col.key)}
    >
      <span className="inline-flex items-center gap-1">
        {col.label}
        {active ? (
          sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-30" />
        )}
      </span>
    </th>
  );
}