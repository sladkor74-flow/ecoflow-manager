import React from 'react';
import { Truck, Weight, Package, Route, AlertTriangle } from 'lucide-react';
import { formatNumber, fmtTon } from '@/lib/utils';
import { RiepilogoDate } from '@/components/primarie-rete/DateDaSistemare';

export default function SecondarieKpi({ kpi, byClasse, canali, elencoSenzaFine, filtroDate = false, onFiltroDate }) {
  if (!kpi) return null;

  const intFmt = (v) => formatNumber(v, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  // Le date da sistemare, canale per canale (computeSecondarieMatrix): i
  // terminati senza fine trasporto, fuori dai conti, e quelli contati con
  // un'altra data obbligatoria che manca o non torna (regola dell'utente,
  // 22/09/2026). Quando la funzione le manda, sostituiscono l'avviso dei soli
  // senza fine trasporto qui sotto, che resta per una risposta di prima.
  const datePerCanale = kpi.date_da_sistemare_per_canale;
  // I terminati senza fine trasporto, canale per canale: un numero solo per rete
  // e ACI insieme sarebbe un conteggio che somma le due commesse. Una risposta
  // di prima porta solo il numero, ed e' del canale della vista.
  const senzaFine = datePerCanale ? [] : kpi.senza_fine_trasporto_per_canale
    ? ['Rete', 'ACI'].map(c => ({ canale: c, n: kpi.senza_fine_trasporto_per_canale[c] || 0 })).filter(x => x.n > 0)
    : kpi.senza_fine_trasporto > 0 ? [{ canale: kpi.canale, n: kpi.senza_fine_trasporto }] : [];
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
      {datePerCanale && ['Rete', 'ACI'].map(c => (
        <RiepilogoDate
          key={c}
          canale={c}
          riepilogo={datePerCanale[c]}
          nomi={['trasporto terminato', 'trasporti terminati']}
          esempi
          nota="Vanno corretti nel file del portale e ricaricati."
          attivo={filtroDate}
          onFiltra={onFiltroDate}
        />
      ))}
      {/* Un terminato senza fine trasporto non ha un mese: resta fuori dai conti e si dice. */}
      {senzaFine.length > 0 && (
        <div className="text-xs text-amber-700 space-y-1">
          <p className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>
              {senzaFine.length === 1
                ? `${senzaFine[0].canale && senzaFine[0].canale !== kpi.canale ? `${senzaFine[0].canale}: ` : ''}${intFmt(senzaFine[0].n)} ${senzaFine[0].n === 1 ? 'trasporto terminato senza data di fine trasporto, escluso' : 'trasporti terminati senza data di fine trasporto, esclusi'}`
                : `Trasporti terminati senza data di fine trasporto, esclusi: ${senzaFine.map(x => `${x.canale} ${intFmt(x.n)}`).join(', ')}`}
              {' '}dai conti di ogni mese: vanno corretti nel file del portale e ricaricati.
            </span>
          </p>
          {elencoSenzaFine && elencoSenzaFine.length > 0 && (
            <details className="pl-5">
              <summary className="cursor-pointer select-none">Quali sono{elencoSenzaFine.length >= 50 ? ' (i primi 50)' : ''}</summary>
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                {elencoSenzaFine.map((o, i) => (
                  <li key={`${o.canale}|${o.id_ordine}|${i}`}>
                    <span className="font-mono">{o.id_ordine || 'senza ID'}</span>
                    {o.numero_fir ? <> · FIR <span className="font-mono">{o.numero_fir}</span></> : null}
                    {' · '}{o.stoccaggio || 'N/D'} → {o.destinazione || 'N/D'}
                    {o.canale === 'ACI' && <span className="ml-1.5 px-1 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px]">ACI</span>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
