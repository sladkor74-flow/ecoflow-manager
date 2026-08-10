import React from 'react';
import { MapPin } from 'lucide-react';

// Classifica della concentrazione per provincia
export default function ProvinceRanking({ ranking }) {
  if (!ranking || ranking.length === 0) {
    return <div className="text-center py-6 text-muted-foreground text-sm">Nessun dato provincia.</div>;
  }

  const maxOrdini = ranking[0].ordini || 1;
  const top10 = ranking.slice(0, 10);

  return (
    <div className="border rounded-lg p-4 space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <MapPin className="w-4 h-4 text-primary" />
        <h3 className="font-heading font-semibold text-sm">Concentrazione per Provincia (Top 10)</h3>
      </div>
      {top10.map((p, i) => (
        <div key={p.provincia} className="flex items-center gap-3">
          <span className="text-xs font-mono text-muted-foreground w-6">{i + 1}.</span>
          <span className="text-sm font-medium w-12">{p.provincia}</span>
          <div className="flex-1 bg-muted rounded-full h-5 overflow-hidden relative">
            <div
              className="h-full bg-primary/70 transition-all"
              style={{ width: `${(p.ordini / maxOrdini) * 100}%` }}
            />
            <span className="absolute inset-0 flex items-center px-2 text-xs font-medium">
              {p.ordini} ord · {(p.peso_kg / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 })} t
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}