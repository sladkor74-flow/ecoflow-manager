import React from 'react';
import { TrendingDown, AlertCircle, CheckCircle, Calendar } from 'lucide-react';

const STATO_CONFIG = {
  verde: { label: 'Target in linea', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  arancio: { label: 'A rischio', color: 'bg-amber-100 text-amber-700', icon: AlertCircle },
  rosso: { label: 'Non raggiungibile', color: 'bg-red-100 text-red-700', icon: TrendingDown },
  blu: { label: 'Target raggiunto', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
};

export default function PredittivitaDashboard({ data }) {
  if (!data || !data.impianti || data.impianti.length === 0) {
    return <div className="text-center py-8 text-muted-foreground border rounded-lg">Nessun impianto configurato. Vai in "Configurazione" per aggiungerne.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
        <div className="text-sm"><span className="text-muted-foreground">Periodo: </span><span className="font-medium">{data.data_inizio} → {data.data_fine}</span></div>
        <div className="text-sm"><span className="text-muted-foreground">Settimane: </span><span className="font-bold">{data.num_settimane}</span></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data.impianti.map(imp => {
          const sc = STATO_CONFIG[imp.stato] || STATO_CONFIG.verde;
          const SIcon = sc.icon;
          return (
            <div key={imp.impianto.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-heading font-bold text-lg">{imp.impianto.nome}</h2>
                <span className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${sc.color}`}><SIcon className="w-3 h-3" /> {sc.label}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                <div className="border rounded p-2"><p className="text-xs text-muted-foreground">Target</p><p className="font-bold">{imp.impianto.target.toLocaleString()} kg</p></div>
                <div className="border rounded p-2"><p className="text-xs text-muted-foreground">Consuntivo</p><p className="font-bold">{imp.consuntivo.toLocaleString()} kg</p></div>
                <div className="border rounded p-2"><p className="text-xs text-muted-foreground">Residuo</p><p className="font-bold text-amber-600">{imp.residuo.toLocaleString()} kg</p></div>
                <div className="border rounded p-2"><p className="text-xs text-muted-foreground">Pianificato</p><p className="font-bold">{imp.totale_pianificato.toLocaleString()} kg</p></div>
                <div className="border rounded p-2"><p className="text-xs text-muted-foreground">Viaggi necessari</p><p className="font-bold">{imp.viaggi_necessari}</p></div>
                <div className="border rounded p-2"><p className="text-xs text-muted-foreground">Capacità prev.</p><p className="font-bold">{imp.capacita_prevista.toLocaleString()} kg</p></div>
              </div>
              <div className="flex items-center justify-between border-t pt-2 text-sm">
                <div><span className="text-muted-foreground">Delta: </span><span className={`font-bold ${imp.delta > 0 ? 'text-amber-600' : imp.delta < 0 ? 'text-red-600' : 'text-green-600'}`}>{imp.delta > 0 ? `+${imp.delta.toLocaleString()}` : imp.delta.toLocaleString()} kg</span></div>
                <div className="flex items-center gap-1"><Calendar className="w-3 h-3 text-muted-foreground" /><span className="text-muted-foreground">Previsto: </span><span className="font-medium">{imp.data_prevista_raggiungimento || 'N/D'}</span></div>
              </div>
              {imp.gap > 0 && <div className="text-sm text-red-700 bg-red-50 border border-red-200 p-2 rounded flex items-center gap-1"><AlertCircle className="w-4 h-4" /> Gap: {imp.gap.toLocaleString()} kg non coperti dalla capacità prevista.</div>}
              <div className="border-t pt-2">
                <h3 className="text-sm font-semibold mb-1">Fornitori</h3>
                <div className="space-y-1">
                  {imp.fornitori.map(f => (
                    <div key={f.id} className="flex items-center justify-between text-xs border rounded px-2 py-1">
                      <span className="font-medium">{f.nome}</span>
                      <span className="text-muted-foreground">{f.consuntivo.toLocaleString()} / {(f.quota_target || 0).toLocaleString()} kg · {f.viaggi_totali} viaggi · {f.avg_kg_per_viaggio} kg/v</span>
                    </div>
                  ))}
                  {imp.fornitori.length === 0 && <p className="text-xs text-muted-foreground">Nessun fornitore configurato.</p>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border rounded-lg p-4">
        <h3 className="font-heading font-semibold mb-3">Scenari</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted"><tr>
              <th className="text-left px-3 py-2 font-semibold">Impianto</th>
              <th className="text-right px-3 py-2 font-semibold">Conservativo (80%)</th>
              <th className="text-right px-3 py-2 font-semibold">Previsionale (100%)</th>
              <th className="text-right px-3 py-2 font-semibold">Ottimistico (120%)</th>
              <th className="text-right px-3 py-2 font-semibold">Residuo</th>
            </tr></thead>
            <tbody>
              {data.impianti.map(imp => (
                <tr key={imp.impianto.id}>
                  <td className="px-3 py-2 font-medium">{imp.impianto.nome}</td>
                  <td className="px-3 py-2 text-right">{imp.capacita_conservativa.toLocaleString()} kg</td>
                  <td className="px-3 py-2 text-right">{imp.capacita_prevista.toLocaleString()} kg</td>
                  <td className="px-3 py-2 text-right">{imp.capacita_ottimistica.toLocaleString()} kg</td>
                  <td className="px-3 py-2 text-right font-bold">{imp.residuo.toLocaleString()} kg</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}