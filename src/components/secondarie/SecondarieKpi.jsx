import React from 'react';
import { Truck, Weight, Package, Route } from 'lucide-react';
import { formatNumber, fmtTon } from '@/lib/utils';

export default function SecondarieKpi({ kpi, byClasse, canali }) {
  if (!kpi) return null;

  const intFmt = (v) => formatNumber(v, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  // Rete e ACI non si sommano: quando ci sono tutti e due, sotto il totale si
  // legge quanto e' dell'uno e quanto dell'altro.
  const perCanale = (canali || []).length > 1 ? canali : null;
  const cards = [
    {
      label: 'Trasporti Secondari', value: intFmt(kpi.total_orders || 0), icon: Truck, color: 'text-purple-600 bg-purple-50',
      sotto: perCanale && perCanale.map(c => `${c.canale} ${intFmt(c.ordini)}`).join(' · '),
    },
    {
      label: 'Tonnellate Totali', value: fmtTon(kpi.total_ton || 0), icon: Weight, color: 'text-amber-600 bg-amber-50',
      sotto: perCanale && perCanale.map(c => `${c.canale} ${fmtTon((c.peso_kg || 0) / 1000)}`).join(' · '),
    },
    { label: 'Quantità (Pezzi)', value: intFmt(kpi.total_quantita || 0), icon: Package, color: 'text-blue-600 bg-blue-50' },
    { label: 'Tratte Attive', value: (byClasse?.length || 0), icon: Route, color: 'text-green-600 bg-green-50' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.label} className="border rounded-lg p-4">
            <div className={`inline-flex p-2 rounded-md mb-3 ${c.color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-heading font-bold">{c.value}</p>
            <p className="text-sm text-muted-foreground">{c.label}</p>
            {c.sotto && <p className="text-xs text-muted-foreground mt-0.5">{c.sotto}</p>}
          </div>
        );
      })}
    </div>
  );
}