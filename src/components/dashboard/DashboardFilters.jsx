import React from 'react';
import MultiSelect from '@/components/shared/MultiSelect';

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

export default function DashboardFilters({ mese, anno, onMeseChange, onAnnoChange }) {
  const anni = [2025, 2026, 2027];
  return (
    <div className="flex items-end gap-3 flex-wrap">
      <div className="min-w-[180px] flex-1 max-w-[300px]">
        <label className="text-xs text-muted-foreground mb-1 block">Mese</label>
        <MultiSelect
          allLabel="Tutti i mesi"
          options={MESI}
          selected={mese || []}
          onChange={onMeseChange}
        />
      </div>
      <div className="min-w-[140px] flex-1 max-w-[220px]">
        <label className="text-xs text-muted-foreground mb-1 block">Anno</label>
        {/* Senza anno scelto getDashboardStats e getDashboardRaccolta usano l'anno
            in corso: "Tutti gli anni" prometteva un totale che nessuno calcola. */}
        <MultiSelect
          allLabel="Anno in corso"
          options={anni.map(String)}
          selected={(anno || []).map(String)}
          onChange={(v) => onAnnoChange(v.map(Number))}
        />
      </div>
    </div>
  );
}