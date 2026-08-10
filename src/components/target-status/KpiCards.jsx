import React from 'react';
import { Target, TrendingUp, AlertTriangle, CalendarClock } from 'lucide-react';

export default function KpiCards({ kpis }) {
  const cards = [
    { label: 'Target Annuo Complessivo', value: kpis.targetAnnuoTotale, icon: Target, color: 'text-blue-600 bg-blue-50' },
    { label: 'Totale Progressivo Raccolto', value: kpis.raccoltoTotale, icon: TrendingUp, color: 'text-green-600 bg-green-50' },
    { label: 'Leftover Complessivo Annuo', value: kpis.leftoverTotale, icon: AlertTriangle, color: kpis.leftoverTotale < 0 ? 'text-red-600 bg-red-50' : 'text-amber-600 bg-amber-50' },
    { label: 'Delta Mese In Corso', value: kpis.deltaMeseCorrente, icon: CalendarClock, color: kpis.deltaMeseCorrente > 0 ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <div key={i} className="border rounded-lg p-4 bg-card">
            <div className={`inline-flex p-2 rounded-md mb-2 ${c.color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-heading font-bold tabular-nums">
              {c.value.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">t</span>
            </p>
            <p className="text-sm text-muted-foreground">{c.label}</p>
          </div>
        );
      })}
    </div>
  );
}