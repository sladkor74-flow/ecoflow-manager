import React from 'react';
import { Warehouse, ClipboardList, FileCheck, PackageOpen, Target, ArrowLeftRight } from 'lucide-react';

function fmt(n, dec = 2) {
  if (n == null || n === '' || isNaN(n)) return '—';
  return Number(n).toLocaleString('it-IT', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export default function GiacenzeKpi({ totali }) {
  const copertura = totali.target_totale_t > 0
    ? (totali.conferito_t / totali.target_totale_t * 100)
    : null;

  const cards = [
    { label: 'Giacenza a portale', value: fmt(totali.giacenza_portale_t), unit: 't', icon: Warehouse, color: 'text-primary' },
    { label: 'Ordini da dichiarare', value: fmt(totali.ordini_da_dichiarare, 0), unit: '', icon: ClipboardList, color: 'text-amber-600' },
    { label: 'Dichiarato nell\'anno', value: fmt(totali.dichiarato_t), unit: 't', icon: FileCheck, color: 'text-success' },
    { label: 'Conferito nell\'anno', value: fmt(totali.conferito_t), unit: 't', icon: PackageOpen, color: 'text-accent' },
    { label: 'Copertura target', value: copertura != null ? fmt(copertura, 1) : '—', unit: '%', icon: Target, color: copertura != null && copertura >= 100 ? 'text-success' : 'text-amber-600' },
    { label: 'Divergenza totale', value: fmt(totali.divergenza_t), unit: 't', icon: ArrowLeftRight, color: 'text-amber-600', subtitle: 'materiale trasferito in attesa di dichiarazione' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <div key={i} className="bg-card border rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon className={`w-3.5 h-3.5 ${c.color}`} />
              {c.label}
            </div>
            <div className={`text-xl font-bold ${c.color}`}>
              {c.value} {c.unit && <span className="text-xs font-normal text-muted-foreground">{c.unit}</span>}
            </div>
            {c.subtitle && (
              <div className="text-[10px] leading-tight text-muted-foreground">{c.subtitle}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}