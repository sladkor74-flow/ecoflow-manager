import React from 'react';
import { Ship, Scale, TrendingDown, Warehouse } from 'lucide-react';
import { formatNumber } from '@/lib/utils';

export default function TerziarieKpi({ kpi }) {
  const cards = [
    { label: 'Totale Terziarie', value: formatNumber(kpi.totale_t), unit: 't', icon: Ship, color: 'text-pink-600 bg-pink-50' },
    { label: 'Spedizioni / Navi', value: kpi.spedizioni, unit: '', icon: TrendingDown, color: 'text-blue-600 bg-blue-50' },
    { label: 'Impianti Attivi', value: kpi.impianti_attivi, unit: '', icon: Warehouse, color: 'text-amber-600 bg-amber-50' },
    { label: 'Giacenza Residua', value: formatNumber(kpi.giacenza_totale), unit: 't', icon: Scale, color: 'text-green-600 bg-green-50' },
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
            <p className="text-2xl font-heading font-bold">
              {c.value}<span className="text-sm font-normal text-muted-foreground ml-1">{c.unit}</span>
            </p>
            <p className="text-sm text-muted-foreground">{c.label}</p>
          </div>
        );
      })}
    </div>
  );
}