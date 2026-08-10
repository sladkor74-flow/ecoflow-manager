import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function SlaMetrics({ data }) {
  if (!data) return null;

  const { trasportatori, totale_ordini, avg_giorni, pct_nei_tempi_globale } = data;

  return (
    <div className="space-y-4">
      {/* KPI summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="border rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Ordini totali</p>
          <p className="text-xl font-heading font-bold">{totale_ordini}</p>
        </div>
        <div className="border rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Nr Giorni medio</p>
          <p className={`text-xl font-heading font-bold ${avg_giorni > 12 ? 'text-red-600' : avg_giorni > 10 ? 'text-amber-600' : ''}`}>
            {avg_giorni.toFixed(1)}
          </p>
        </div>
        <div className="border rounded-lg p-3">
          <p className="text-xs text-muted-foreground">% Nei tempi</p>
          <p className="text-xl font-heading font-bold text-green-600">{pct_nei_tempi_globale.toFixed(1)}%</p>
        </div>
        <div className="border rounded-lg p-3">
          <p className="text-xs text-muted-foreground">% Dopo scadenza</p>
          <p className="text-xl font-heading font-bold text-red-600">{(100 - pct_nei_tempi_globale).toFixed(1)}%</p>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-3 py-2 font-heading font-semibold">Trasportatore</th>
              <th className="text-right px-3 py-2 font-heading font-semibold">Ordini</th>
              <th className="text-right px-3 py-2 font-heading font-semibold">Nr Giorni medio</th>
              <th className="text-right px-3 py-2 font-heading font-semibold">% Nei tempi</th>
              <th className="text-right px-3 py-2 font-heading font-semibold">% Dopo scad.</th>
              <th className="text-right px-3 py-2 font-heading font-semibold">Oltre 10 gg</th>
              <th className="text-right px-3 py-2 font-heading font-semibold">Oltre 12 gg</th>
              <th className="text-center px-3 py-2 font-heading font-semibold">Stato</th>
            </tr>
          </thead>
          <tbody>
            {trasportatori.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-8 text-muted-foreground">Nessun dato disponibile.</td>
              </tr>
            )}
            {trasportatori.map((t, idx) => (
              <tr key={t.trasportatore} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                <td className="px-3 py-2 font-medium">{t.trasportatore}</td>
                <td className="px-3 py-2 text-right">{t.totale}</td>
                <td className={`px-3 py-2 text-right font-medium ${t.nr_giorni_medio > 12 ? 'text-red-600' : t.nr_giorni_medio > 10 ? 'text-amber-600' : ''}`}>
                  {t.nr_giorni_medio.toFixed(1)}
                </td>
                <td className="px-3 py-2 text-right text-green-600">{t.pct_nei_tempi.toFixed(1)}%</td>
                <td className={`px-3 py-2 text-right ${t.pct_dopo_scadenza > 20 ? 'text-red-600 font-medium' : ''}`}>
                  {t.pct_dopo_scadenza.toFixed(1)}%
                </td>
                <td className="px-3 py-2 text-right">{t.oltre_10gg}</td>
                <td className="px-3 py-2 text-right text-red-600">{t.oltre_12gg}</td>
                <td className="text-center px-3 py-2">
                  {t.has_sla_critical ? (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">
                      <AlertTriangle className="w-3 h-3" /> Critico
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 border border-green-200">
                      <CheckCircle2 className="w-3 h-3" /> OK
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}