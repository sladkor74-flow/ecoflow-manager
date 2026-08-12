import React from 'react';

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

export default function DashboardFilters({ mese, anno, onMeseChange, onAnnoChange }) {
  const anni = [2025, 2026, 2027];
  return (
    <div className="flex items-end gap-3 flex-wrap">
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Mese</label>
        <select
          value={mese}
          onChange={e => onMeseChange(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm bg-background min-w-[140px]"
        >
          <option value="Tutti i mesi">Tutti i mesi</option>
          {MESI.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Anno</label>
        <select
          value={anno}
          onChange={e => onAnnoChange(Number(e.target.value))}
          className="border rounded-md px-3 py-2 text-sm bg-background min-w-[100px]"
        >
          {anni.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
    </div>
  );
}