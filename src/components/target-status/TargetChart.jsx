import React, { useMemo } from 'react';
import { MESI } from '@/lib/pfuConstants';

export default function TargetChart({ data, mese, onMeseChange }) {
  const chartData = useMemo(() => {
    const regioniMap = {};
    for (const r of data) {
      if (!regioniMap[r.regione]) regioniMap[r.regione] = { name: r.regione, target: 0, raccolto: 0 };
      const m = r.mesi.find((x) => x.mese === mese);
      if (m) {
        regioniMap[r.regione].target += m.target;
        regioniMap[r.regione].raccolto += m.raccolto;
      }
    }
    return Object.values(regioniMap).sort((a, b) => b.target - a.target);
  }, [data, mese]);

  const maxVal = useMemo(() => {
    if (chartData.length === 0) return 1;
    return Math.max(...chartData.flatMap((d) => [d.target, d.raccolto]), 1);
  }, [chartData]);

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-semibold">Target vs Raccolto per Regione</h3>
        <select
          value={mese}
          onChange={(e) => onMeseChange(e.target.value)}
          className="text-sm border rounded px-2 py-1 bg-background"
        >
          {MESI.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        {chartData.length === 0 && (
          <p className="text-sm text-muted-foreground py-4">Nessun dato per il mese selezionato.</p>
        )}
        {chartData.map((d) => (
          <div key={d.name} className="grid grid-cols-[140px_1fr] items-center gap-2">
            <span className="text-xs font-medium truncate" title={d.name}>{d.name}</span>
            <div className="space-y-1">
              <div className="relative h-4 bg-amber-50 rounded-sm overflow-hidden">
                <div
                  className="absolute top-0 left-0 h-full bg-amber-400 rounded-sm transition-all"
                  style={{ width: `${(d.target / maxVal) * 100}%` }}
                />
                <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] font-medium tabular-nums">
                  {d.target.toFixed(1)} t
                </span>
              </div>
              <div className="relative h-4 bg-green-50 rounded-sm overflow-hidden">
                <div
                  className="absolute top-0 left-0 h-full bg-green-500 rounded-sm transition-all"
                  style={{ width: `${(d.raccolto / maxVal) * 100}%` }}
                />
                <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] font-medium tabular-nums">
                  {d.raccolto.toFixed(1)} t
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-amber-400 rounded-sm" /> Target
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-green-500 rounded-sm" /> Raccolto
        </div>
      </div>
    </div>
  );
}