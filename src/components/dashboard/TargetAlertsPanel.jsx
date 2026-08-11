import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, TrendingDown, Loader2, ChevronRight } from 'lucide-react';

// Pannello dashboard: mostra trasportatori a rischio o sotto target per il mese corrente.
export default function TargetAlertsPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // crea_alerts: false — solo lettura per display, non crea alert
        const res = await base44.functions.invoke('checkTargetAlerts', { crea_alerts: false });
        setData(res.data);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="border rounded-lg p-4 flex items-center justify-center text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Controllo target in corso...
      </div>
    );
  }

  if (!data) return null;

  const { at_risk = [], missed = [], is_mese_corrente, mese, anno } = data;
  const hasIssues = at_risk.length > 0 || missed.length > 0;

  if (!hasIssues) {
    return (
      <div className="border rounded-lg p-4 bg-green-50 border-green-200">
        <div className="flex items-center gap-2 text-green-700">
          <TrendingDown className="w-4 h-4 rotate-180" />
          <span className="text-sm font-medium">Tutti i trasportatori in linea con il target di {mese} {anno}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600" />
        <span className="text-sm font-semibold text-amber-800">
          Avvisi Target {mese} {anno}
        </span>
        <span className="text-xs text-amber-600 ml-auto">
          {is_mese_corrente ? 'Proiezione fine mese' : 'Dato definitivo'}
        </span>
      </div>

      <div className="divide-y max-h-80 overflow-y-auto">
        {/* Trasportatori a rischio (mese corrente, proiezione < 90%) */}
        {at_risk.map((item, i) => (
          <div key={`risk-${i}`} className="px-4 py-3 flex items-start gap-3 bg-amber-50/50">
            <div className="flex-shrink-0 mt-0.5">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{item.raccoglitore}</p>
              <p className="text-xs text-muted-foreground">{item.regione}</p>
              <div className="flex items-center gap-3 mt-1 text-xs">
                <span className="text-amber-700 font-medium">
                  Proiezione: {item.pct_proiezione}% del target
                </span>
                <span className="text-muted-foreground">
                  {item.raccolto} / {item.target} ton
                </span>
              </div>
              {/* Barra progresso */}
              <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{ width: `${Math.min(item.pct_raggiungimento, 100)}%` }}
                />
              </div>
            </div>
          </div>
        ))}

        {/* Trasportatori sotto target (mese passato) */}
        {missed.map((item, i) => (
          <div key={`miss-${i}`} className="px-4 py-3 flex items-start gap-3 bg-red-50/50">
            <div className="flex-shrink-0 mt-0.5">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{item.raccoglitore}</p>
              <p className="text-xs text-muted-foreground">{item.regione}</p>
              <div className="flex items-center gap-3 mt-1 text-xs">
                <span className={`font-medium ${item.pct_raggiungimento < 50 ? 'text-red-700' : 'text-red-600'}`}>
                  Raggiunto: {item.pct_raggiungimento}% del target
                </span>
                <span className="text-muted-foreground">
                  {item.raccolto} / {item.target} ton (Δ {item.delta})
                </span>
              </div>
              <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${item.pct_raggiungimento < 50 ? 'bg-red-600' : 'bg-red-400'}`}
                  style={{ width: `${Math.min(item.pct_raggiungimento, 100)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <Link
        to="/target-status"
        className="flex items-center justify-between px-4 py-2.5 bg-muted/50 hover:bg-muted text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>Vai al dettaglio target</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}