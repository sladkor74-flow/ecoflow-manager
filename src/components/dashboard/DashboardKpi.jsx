import React from 'react';
import { Truck, Factory, Package, Target } from 'lucide-react';

function fmtTon(v) {
  return (v || 0).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' t';
}
function fmtPct(v) {
  return (v || 0).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
}

export default function DashboardKpi({ kpi, loading }) {
  if (loading || !kpi) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="border rounded-lg p-4 animate-pulse bg-muted/30 h-28" />
        ))}
      </div>
    );
  }

  const cards = [
    { label: 'Raccolta RETE', value: fmtTon(kpi.raccolta_rete), icon: Truck, color: 'text-green-600 bg-green-50' },
    { label: 'Raccolta ACI', value: fmtTon(kpi.raccolta_aci), icon: Factory, color: 'text-amber-600 bg-amber-50' },
    { label: 'Totale Raccolto', value: fmtTon(kpi.totale_raccolto), icon: Package, color: 'text-blue-600 bg-blue-50' },
    { label: 'Raggiungimento Target', value: fmtPct(kpi.raggiungimento_pct), icon: Target, color: 'text-primary bg-primary/10', subtitle: `su ${fmtTon(kpi.target)}` },
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
            {c.subtitle && <p className="text-xs text-muted-foreground mt-0.5">{c.subtitle}</p>}
          </div>
        );
      })}
    </div>
  );
}