import React from 'react';
import { ClipboardList, Weight, CalendarRange, Hourglass } from 'lucide-react';
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

  const eta = kpi.eta;
  const vecchio = eta && eta.piu_vecchio;
  const quota = (n) => (kpi.total_orders ? ` · ${Math.round((n / kpi.total_orders) * 100)}%` : '');

  return (
    <div className="space-y-4">
    {/* Da quanto aspettano: il numero degli ordini da solo non dice se la coda e' ferma */}
    {eta && (
      <div className="border rounded-lg p-4">
        <p className="text-sm font-medium inline-flex items-center gap-1.5 mb-3"><Hourglass className="w-4 h-4 text-primary" /> Da quanto aspettano gli ordini aperti</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <div><p className="text-xl font-heading font-bold tabular-nums">{intFmt(eta.entro_30)}</p><p className="text-xs text-muted-foreground">entro 30 giorni{quota(eta.entro_30)}</p></div>
          <div><p className="text-xl font-heading font-bold tabular-nums text-amber-600">{intFmt(eta.da_31_a_60)}</p><p className="text-xs text-muted-foreground">da 31 a 60 giorni{quota(eta.da_31_a_60)}</p></div>
          <div><p className="text-xl font-heading font-bold tabular-nums text-red-600">{intFmt(eta.oltre_60)}</p><p className="text-xs text-muted-foreground">da oltre 60 giorni{quota(eta.oltre_60)} · {fmtTon((eta.kg_oltre_60 || 0) / 1000)} stimate</p></div>
          <div>
            <p className="text-xl font-heading font-bold tabular-nums">{vecchio ? `${intFmt(vecchio.giorni)} giorni` : '—'}</p>
            <p className="text-xs text-muted-foreground">il più vecchio{vecchio ? `: ${vecchio.id_ordine} · ${vecchio.ragione_sociale}${vecchio.provincia ? ` (${vecchio.provincia})` : ''}, immesso il ${vecchio.immesso_il.split('-').reverse().join('/')}` : ''}</p>
          </div>
        </div>
      </div>
    )}
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
    </div>
  );
}