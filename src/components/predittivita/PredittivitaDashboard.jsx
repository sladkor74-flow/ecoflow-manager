import React from 'react';
import { TrendingDown, AlertCircle, CheckCircle, Calendar, Layers } from 'lucide-react';

function fmt(n) { return (n || 0).toLocaleString('it-IT'); }

export default function PredittivitaDashboard({ data }) {
  if (!data || !data.impianti || data.impianti.length === 0) {
    return <div className="text-center py-8 text-muted-foreground border rounded-lg">Nessun impianto configurato. Vai in "Configurazione" per aggiungerne.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30 flex-wrap gap-2">
        <div className="text-sm"><span className="text-muted-foreground">Periodo: </span><span className="font-medium">{data.data_inizio} → {data.data_fine}</span></div>
        <div className="text-sm"><span className="text-muted-foreground">Settimane: </span><span className="font-bold">{data.num_settimane}</span></div>
      </div>

      {/* Plafond Nappi Sud */}
      <div className="border rounded-lg p-4 bg-gradient-to-r from-primary/10 to-accent/10">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="w-4 h-4 text-primary" />
          <h3 className="font-heading font-semibold">Plafond Nappi Sud</h3>
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div><p className="text-xs text-muted-foreground">Plafond</p><p className="font-bold">{fmt(data.plafond_nappi_sud)} kg</p></div>
          <div><p className="text-xs text-muted-foreground">Kg partiti</p><p className="font-bold text-amber-600">{fmt(data.kg_partiti_nappi)} kg</p></div>
          <div><p className="text-xs text-muted-foreground">Residuo</p><p className="font-bold text-green-700">{fmt(data.residuo_plafond)} kg</p></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data.impianti.map(imp => {
          const target = imp.impianto.target || 0;
          const pct = target > 0 ? Math.min(100, (imp.consuntivo / target) * 100) : 0;
          const residuoPct = target > 0 ? (imp.residuo / target) * 100 : 0;
          return (
            <div key={imp.impianto.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-heading font-bold text-lg uppercase">{imp.impianto.nome}</h2>
                <span className="text-xs text-muted-foreground">Scadenza: {imp.impianto.data_fine}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                <div className="border rounded p-2"><p className="text-xs text-muted-foreground">Target</p><p className="font-bold">{fmt(target)} kg</p></div>
                <div className="border rounded p-2"><p className="text-xs text-muted-foreground">Consuntivo</p><p className="font-bold">{fmt(imp.consuntivo)} kg</p></div>
                <div className="border rounded p-2"><p className="text-xs text-muted-foreground">Residuo</p><p className="font-bold text-amber-600">{fmt(imp.residuo)} kg</p></div>
                <div className="border rounded p-2"><p className="text-xs text-muted-foreground">Pianificato</p><p className="font-bold">{fmt(imp.totale_pianificato)} kg</p></div>
                <div className="border rounded p-2"><p className="text-xs text-muted-foreground">Kg/sett. costanti</p><p className="font-bold">{fmt(imp.kg_per_settimana)} kg</p></div>
                <div className="border rounded p-2"><p className="text-xs text-muted-foreground">Viaggi/sett.</p><p className="font-bold">{imp.viaggi_per_settimana}</p></div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">Avanzamento</span><span className="font-medium">{pct.toFixed(1)}%</span></div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="flex items-center justify-between border-t pt-2 text-sm">
                <div className="flex items-center gap-1"><Calendar className="w-3 h-3 text-muted-foreground" /><span className="text-muted-foreground">Settimane rimanenti: </span><span className="font-medium">{imp.settimane_rimanenti}</span></div>
                <div><span className="text-muted-foreground">Residuo: </span><span className="font-bold">{residuoPct.toFixed(1)}%</span></div>
              </div>
              {imp.fornitori && imp.fornitori.length > 0 && (
                <div className="border-t pt-2">
                  <h3 className="text-sm font-semibold mb-1">Fornitori</h3>
                  <div className="space-y-1">
                    {imp.fornitori.map(f => (
                      <div key={f.id} className="flex items-center justify-between text-xs border rounded px-2 py-1">
                        <span className="font-medium">{f.nome}</span>
                        <span className="text-muted-foreground">Quota: {fmt(f.quota_target)} kg</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="border rounded-lg p-4">
        <h3 className="font-heading font-semibold mb-3">Sintesi Costanza Settimanale</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted"><tr>
              <th className="text-left px-3 py-2 font-semibold">Impianto</th>
              <th className="text-right px-3 py-2 font-semibold">Target</th>
              <th className="text-right px-3 py-2 font-semibold">Consuntivo</th>
              <th className="text-right px-3 py-2 font-semibold">Residuo</th>
              <th className="text-right px-3 py-2 font-semibold">Kg/sett.</th>
              <th className="text-right px-3 py-2 font-semibold">Viaggi/sett.</th>
              <th className="text-right px-3 py-2 font-semibold">Sett. rimaste</th>
            </tr></thead>
            <tbody>
              {data.impianti.map(imp => (
                <tr key={imp.impianto.id}>
                  <td className="px-3 py-2 font-medium uppercase">{imp.impianto.nome}</td>
                  <td className="px-3 py-2 text-right">{fmt(imp.impianto.target)} kg</td>
                  <td className="px-3 py-2 text-right">{fmt(imp.consuntivo)} kg</td>
                  <td className="px-3 py-2 text-right font-bold text-amber-600">{fmt(imp.residuo)} kg</td>
                  <td className="px-3 py-2 text-right">{fmt(imp.kg_per_settimana)} kg</td>
                  <td className="px-3 py-2 text-right">{imp.viaggi_per_settimana}</td>
                  <td className="px-3 py-2 text-right">{imp.settimane_rimanenti}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}