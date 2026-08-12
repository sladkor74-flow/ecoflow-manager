import React from 'react';
import { MESI } from '@/lib/pfuConstants';
import { Filter, X } from 'lucide-react';
import MultiSelect from '@/components/shared/MultiSelect';

export default function GlobalFilters({ filters, onChange, filterOptions }) {
  const handleChange = (field, value) => {
    onChange({ ...filters, [field]: value });
  };

  const hasFilters = Object.values(filters).some((v) => Array.isArray(v) ? v.length > 0 : v);

  return (
    <div className="flex flex-wrap gap-3 items-end p-4 border rounded-lg bg-card">
      <Filter className="w-4 h-4 text-muted-foreground mb-2" />
      <div className="min-w-[160px]">
        <label className="block text-xs text-muted-foreground mb-1">Mese</label>
        <MultiSelect
          allLabel="Tutti"
          options={MESI}
          selected={filters.mese || []}
          onChange={(v) => handleChange('mese', v)}
        />
      </div>
      <div className="min-w-[200px]">
        <label className="block text-xs text-muted-foreground mb-1">Raccoglitore / Partner</label>
        <MultiSelect
          allLabel="Tutti"
          options={filterOptions.raccoglitori || []}
          selected={filters.raccoglitore || []}
          onChange={(v) => handleChange('raccoglitore', v)}
        />
      </div>
      <div className="min-w-[120px]">
        <label className="block text-xs text-muted-foreground mb-1">Anno</label>
        <MultiSelect
          allLabel="Tutti"
          options={(filterOptions.anni || []).map(String)}
          selected={(filters.anno || []).map(String)}
          onChange={(v) => handleChange('anno', v)}
        />
      </div>
      <div className="min-w-[120px]">
        <label className="block text-xs text-muted-foreground mb-1">Settimana</label>
        <MultiSelect
          allLabel="Tutte"
          options={(filterOptions.settimane || []).map((s) => ({ value: String(s), label: `Sett. ${s}` }))}
          selected={(filters.settimana || []).map(String)}
          onChange={(v) => handleChange('settimana', v)}
        />
      </div>
      {hasFilters && (
        <button onClick={() => onChange({ mese: [], raccoglitore: [], anno: [], settimana: [] })} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded-md hover:bg-accent">
          <X className="w-3 h-3" /> Reset
        </button>
      )}
    </div>
  );
}