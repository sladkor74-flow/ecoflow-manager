import React from 'react';
import { Truck, Weight, Package, Route, AlertTriangle } from 'lucide-react';
import { formatNumber, fmtTon } from '@/lib/utils';

export default function SecondarieKpi({ kpi, byClasse, canali }) {
  if (!kpi) return null;

  const intFmt = (v) => formatNumber(v, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  // Rete e ACI non si sommano: quando ci sono tutti e due ogni riquadro mostra i
  // due numeri, uno per canale, e nessun totale che li metta insieme. Prima la
  // quantita' in pezzi restava un numero solo, rete piu' ACI.
  const perCanale = (canali || []).length > 1 ? canali : null;
  const numeroDi = (valore, fmt) => (valore === null || valore === undefined ? '—' : fmt(valore));
  // Le tratte vengono dalla funzione; byClasse contava le classi, non le tratte,
  // e resta solo come ripiego per una risposta di prima.
  const tratte = kpi.tratte !== undefined ? kpi.tratte : (byClasse?.length || 0);
  const cards = [
    {
      label: 'Trasporti Secondari', value: numeroDi(kpi.total_orders, intFmt), icon: Truck, color: 'text-purple-600 bg-purple-50',
      canali: perCanale && perCanale.map(c => ({ nome: c.canale, valore: intFmt(c.ordini) })),
    },
    {
      label: 'Tonnellate', value: numeroDi(kpi.total_ton, fmtTon), icon: Weight, color: 'text-amber-600 bg-amber-50',
      canali: perCanale && perCanale.map(c => ({ nome: c.canale, valore: fmtTon((c.peso_kg || 0) / 1000) })),
    },
    {
      label: 'Quantità (Pezzi)', value: numeroDi(kpi.total_quantita, intFmt), icon: Package, color: 'text-blue-600 bg-blue-50',
      canali: perCanale && perCanale.map(c => ({ nome: c.canale, valore: intFmt(c.quantita || 0) })),
    },
    {
      label: 'Tratte Attive', value: numeroDi(tratte, intFmt), icon: Route, color: 'text-green-600 bg-green-50',
      canali: perCanale && perCanale.map(c => ({ nome: c.canale, valore: intFmt(c.tratte || 0) })),
    },
  ];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="border rounded-lg p-4">
              <div className={`inline-flex p-2 rounded-md mb-3 ${c.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              {c.canali ? (
                <div className="space-y-0.5">
                  {c.canali.map(x => (
                    <p key={x.nome} className="flex items-baseline justify-between gap-2">
                      <span className="text-xs text-muted-foreground">{x.nome}</span>
                      <span className="text-xl font-heading font-bold tabular-nums">{x.valore}</span>
                    </p>
                  ))}
                </div>
              ) : <p className="text-2xl font-heading font-bold">{c.value}</p>}
              <p className="text-sm text-muted-foreground">{c.label}{kpi.canale && !perCanale ? ` · ${kpi.canale}` : ''}</p>
            </div>
          );
        })}
      </div>
      {/* Un terminato senza fine trasporto non ha un mese: resta fuori dai conti e si dice. */}
      {kpi.senza_fine_trasporto > 0 && (
        <p className="text-xs text-amber-700 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" />
          {kpi.senza_fine_trasporto} {kpi.senza_fine_trasporto === 1 ? 'trasporto terminato senza data di fine trasporto, escluso' : 'trasporti terminati senza data di fine trasporto, esclusi'} dai conti: va corretto nel file del portale e ricaricato.
        </p>
      )}
    </div>
  );
}
