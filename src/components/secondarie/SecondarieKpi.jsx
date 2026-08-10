import React from 'react';
import { Truck, Weight, Package, Route } from 'lucide-react';

export default function SecondarieKpi({ kpi, byClasse }) {
  if (!kpi) return null;

  const cards = [
    { label: 'Trasporti Secondari', value: (kpi.total_orders || 0).toLocaleString('it-IT'), icon: Truck, color: 'text-purple-600 bg-purple-50' },
    { label: 'Tonnellate Totali', value: (kpi.total_ton || 0).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' t', icon: Weight, color: 'text-amber-600 bg-amber-50' },
    { label: 'Quantità (Pezzi)', value: (kpi.total_quantita || 0).toLocaleString('it-IT'), icon: Package, color: 'text-blue-600 bg-blue-50' },
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
          </div>
        );
      })}
    </div>
  );
}