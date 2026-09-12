import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

function fmt(n) { return Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export default function DichiarazioniMancanti({ mancanti }) {
  const [open, setOpen] = useState(false);
  if (!mancanti || mancanti.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-amber-800">
          <AlertTriangle className="w-4 h-4" />
          <span className="font-medium text-sm">{mancanti.length} dichiarazioni predisposte ma non inviate a portale</span>
        </div>
        <button onClick={() => setOpen(!open)} className="text-amber-700 hover:text-amber-900">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>
      <p className="text-xs text-amber-700">Queste quantità non decurtano la giacenza finché non risultano caricate e inviate.</p>
      {open && (
        <div className="space-y-1 border-t border-amber-200 pt-2">
          {mancanti.map((m, i) => (
            <div key={i} className="text-xs text-amber-800">
              <span className="font-medium">{m.sito}</span> — {m.operazione} {m.canale}{m.provenienza ? ` ${m.provenienza}` : ''} — {m.mese}: <span className="font-medium">{fmt(m.tonnellate)} t</span> predisposte ma non inviate a portale
            </div>
          ))}
        </div>
      )}
    </div>
  );
}