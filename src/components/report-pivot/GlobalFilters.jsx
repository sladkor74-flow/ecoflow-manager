import React from 'react';
import { MESI } from '@/lib/pfuConstants';
import { Filter, X } from 'lucide-react';

export default function GlobalFilters({ filters, onChange, filterOptions }) {
  const handleChange = (field, value) => {
    onChange({ ...filters, [field]: value || null });
  };

  const hasFilters = Object.values(filters).some((v) => v);

  return (
    <div className="flex flex-wrap gap-3 items-end p-4 border rounded-lg bg-card">
      <Filter className="w-4 h-4 text-muted-foreground mb-2" />
      <div>
        <label className="block text-xs text-muted-foreground mb-1">Mese</label>
        <select value={filters.mese || ''} onChange={(e) => handleChange('mese', e.target.value)} className="block border rounded px-2 py-1.5 text-sm bg-background min-w-[120px]">
          <option value="">Tutti</option>
          {MESI.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1">Raccoglitore / Partner</label>
        <select value={filters.raccoglitore || ''} onChange={(e) => handleChange('raccoglitore', e.target.value)} className="block border rounded px-2 py-1.5 text-sm bg-background min-w-[200px]">
          <option value="">Tutti</option>
          {filterOptions.raccoglitori?.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1">Anno</label>
        <select value={filters.anno || ''} onChange={(e) => handleChange('anno', e.target.value)} className="block border rounded px-2 py-1.5 text-sm bg-background min-w-[90px]">
          <option value="">Tutti</option>
          {filterOptions.anni?.map((a) => <option key={a} value={String(a)}>{a}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1">Settimana</label>
        <select value={filters.settimana || ''} onChange={(e) => handleChange('settimana', e.target.value)} className="block border rounded px-2 py-1.5 text-sm bg-background min-w-[90px]">
          <option value="">Tutte</option>
          {filterOptions.settimane?.map((s) => <option key={s} value={String(s)}>Sett. {s}</option>)}
        </select>
      </div>
      {hasFilters && (
        <button onClick={() => onChange({ mese: null, raccoglitore: null, anno: null, settimana: null })} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded-md hover:bg-accent">
          <X className="w-3 h-3" /> Reset
        </button>
      )}
    </div>
  );
}