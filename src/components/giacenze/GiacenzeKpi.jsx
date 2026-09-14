import React from 'react';
import { Warehouse, ClipboardList, FileCheck, PackageOpen, Target } from 'lucide-react';

function fmt(n, dec = 2) {
  if (n == null || n === '' || isNaN(n)) return '—';
  return Number(n).toLocaleString('it-IT', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export default function GiacenzeKpi({ totali }) {
  // Il target Ecotyre e' di raccolta, quindi la copertura si misura sulle sole
  // primarie. Sommarci le secondarie conterebbe due volte lo stesso pneumatico:
  // una quando viene raccolto e una quando passa dallo stoccaggio all'impianto.
  // Solo canale RETE: ACI ed Extra Raccolta sono canali indipendenti e non
  // entrano nel target.
  const copertura = totali.target_totale_t > 0
    ? (totali.conferito_primarie_t / totali.target_totale_t * 100)
    : null;

  const cards = [
    { label: 'Giacenza a portale', value: fmt(totali.giacenza_portale_t), unit: 't', icon: Warehouse, color: 'text-primary' },
    { label: 'Ordini da dichiarare', value: fmt(totali.ordini_da_dichiarare, 0), unit: '', icon: ClipboardList, color: 'text-amber-600' },
    { label: 'Dichiarato nell\'anno', value: fmt(totali.dichiarato_t), unit: 't', icon: FileCheck, color: 'text-success' },
    { label: 'Raccolto RETE nell\'anno', value: fmt(totali.conferito_primarie_t), unit: 't', icon: PackageOpen, color: 'text-accent', subtitle: `ACI ${fmt(totali.conferito_aci_t)} t · Extra ${fmt(totali.conferito_extra_t)} t, fuori target` },
    { label: 'Copertura target RETE', value: copertura != null ? fmt(copertura, 1) : '—', unit: '%', icon: Target, color: copertura != null && copertura >= 100 ? 'text-success' : 'text-amber-600' },
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