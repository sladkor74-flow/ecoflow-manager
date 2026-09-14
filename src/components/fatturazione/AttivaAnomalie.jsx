import React, { useState } from 'react';
import { ChevronDown, AlertTriangle } from 'lucide-react';
import { formatTonnellate } from '@/lib/utils';

export default function AttivaAnomalie({ anomalie }) {
  const [expanded, setExpanded] = useState(false);
  if (!anomalie || anomalie.length === 0) return null;

  return (
    <div className="border-2 border-destructive/40 bg-destructive/5 rounded-lg p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full"
      >
        <div className="flex items-center gap-2 text-destructive font-semibold">
          <AlertTriangle className="w-5 h-5" />
          <span>{anomalie.length} {anomalie.length === 1 ? 'anomalia rilevata' : 'anomalie rilevate'}</span>
        </div>
        <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <div className="mt-3 space-y-1.5 max-h-80 overflow-y-auto">
          {anomalie.map((a, i) => (
            <div key={i} className="text-sm bg-background/60 rounded px-3 py-1.5 border border-destructive/20">
              <span className="text-muted-foreground">[{a.tipologia}]</span>{' '}
              <span className="font-medium">{a.descrizione}</span>{' '}
              {a.tonnellate > 0 && <span className="text-muted-foreground">({formatTonnellate(a.tonnellate)} t)</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}