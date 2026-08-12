import React from 'react';
import { ClipboardList, Weight, CalendarRange, MapPin } from 'lucide-react';
import { formatNumber, fmtTon } from '@/lib/utils';

export default function AssegnatiKpi({ kpi }) {
  if (!kpi) return null;

  const intFmt = (v) => formatNumber(v, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const cards = [
    { label: 'Ordini Assegnati / Arretrati', value: intFmt(kpi.total_orders || 0), icon: ClipboardList, color: 'text-blue-600 bg-blue-50' },
    { label: 'Tonnellaggio Stimato in Attesa', value: fmtTon(kpi.total_ton || 0), icon: Weight, color: 'text-amber-600 bg-amber-50' },
    { label: '1° Semestre', value: fmtTon(kpi.sem1_ton || 0), icon: CalendarRange, color: 'text-green-600 bg-green-50' },
    { label: '2° Semestre', value: fmtTon(kpi.sem2_ton || 0), icon: CalendarRange, color: 'text-purple-600 bg-purple-50' },
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