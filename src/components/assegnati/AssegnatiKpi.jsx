import React from 'react';
import { ClipboardList, Weight, CalendarRange, MapPin } from 'lucide-react';

export default function AssegnatiKpi({ kpi }) {
  if (!kpi) return null;

  const cards = [
    { label: 'Ordini Assegnati / Arretrati', value: (kpi.total_orders || 0).toLocaleString('it-IT'), icon: ClipboardList, color: 'text-blue-600 bg-blue-50' },
    { label: 'Tonnellaggio Stimato in Attesa', value: (kpi.total_ton || 0).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' t', icon: Weight, color: 'text-amber-600 bg-amber-50' },
    { label: '1° Semestre', value: (kpi.sem1_ton || 0).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' t', icon: CalendarRange, color: 'text-green-600 bg-green-50' },
    { label: '2° Semestre', value: (kpi.sem2_ton || 0).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' t', icon: CalendarRange, color: 'text-purple-600 bg-purple-50' },
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