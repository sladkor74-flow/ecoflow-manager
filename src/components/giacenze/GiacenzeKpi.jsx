import React from 'react';
import { Warehouse, PackageOpen, Target, TrendingDown, AlertTriangle } from 'lucide-react';

function fmt(n) { return n == null ? '—' : Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export default function GiacenzeKpi({ totali }) {
  const residuoComplessivo = totali.giacenza_attuale_t != null ? totali.giacenza_attuale_t : 0;
  const giacenzaPortale = totali.giacenza_portale_t || 0;
  const giacenzaReale = totali.giacenza_attuale_t || 0;

  const cards = [
    { label: 'Giacenza attuale totale', value: fmt(totali.giacenza_attuale_t), unit: 't', icon: Warehouse, color: 'text-primary' },
    { label: 'Conferito totale', value: fmt(totali.conferito_t), unit: 't', icon: PackageOpen, color: 'text-accent' },
    { label: 'Target totale', value: fmt(totali.target_totale_t), unit: 't', icon: Target, color: 'text-muted-foreground' },
    { label: 'Residuo complessivo', value: fmt(residuoComplessivo), unit: 't', icon: TrendingDown, color: 'text-muted-foreground' },
    { label: 'Divergenza a portale', value: fmt(totali.divergenza_portale_t), unit: 't', icon: AlertTriangle, color: 'text-amber-600', subtitle: `giacenza a portale: ${fmt(giacenzaPortale)} t contro ${fmt(giacenzaReale)} t reali` },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <div key={i} className="bg-card border rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon className={`w-3.5 h-3.5 ${c.color}`} />
              {c.label}
            </div>
            <div className={`text-xl font-bold ${c.color}`}>
              {c.value} <span className="text-xs font-normal text-muted-foreground">{c.unit}</span>
            </div>
            {c.subtitle && <div className="text-[10px] text-muted-foreground leading-tight">{c.subtitle}</div>}
          </div>
        );
      })}
    </div>
  );
}