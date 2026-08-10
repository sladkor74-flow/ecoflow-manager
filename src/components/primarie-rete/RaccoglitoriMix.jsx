import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

const CLASSI = ['P', 'M', 'G1', 'G2'];

export default function RaccoglitoriMix({ data }) {
  const [view, setView] = useState('raccolto'); // 'raccolto' | 'target'

  if (!data) return null;

  const { raccoglitori, target_mix, target_annuo, raccoglitori_con_deviazione } = data;

  return (
    <div className="space-y-4">
      {/* Warning banner */}
      {raccoglitori_con_deviazione && raccoglitori_con_deviazione.length > 0 && (
        <div className="border border-amber-300 bg-amber-50 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-heading font-semibold text-amber-900">
              {raccoglitori_con_deviazione.length} raccoglitore/i con deviazione significativa del mix classi
            </h3>
            <p className="text-sm text-amber-800 mt-1">
              Target consorziali: P={target_mix.P}%, M={target_mix.M}%, G1={target_mix.G1}%, G2={target_mix.G2}%.
              Soglia deviazione: ±5%.
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {raccoglitori_con_deviazione.map(r => (
                <span key={r.raccoglitore} className="text-xs px-2 py-0.5 rounded bg-amber-200 text-amber-900 font-medium">
                  {r.raccoglitore}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* View toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setView('raccolto')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${view === 'raccolto' ? 'bg-primary text-primary-foreground' : 'border hover:bg-accent'}`}
        >
          % sul raccolto effettivo
        </button>
        <button
          onClick={() => setView('target')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${view === 'target' ? 'bg-primary text-primary-foreground' : 'border hover:bg-accent'}`}
        >
          % rispetto al target annuo ({target_annuo?.toLocaleString()} ton)
        </button>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-3 py-2 font-heading font-semibold">Raccoglitore</th>
              <th className="text-right px-3 py-2 font-heading font-semibold">Totale (ton)</th>
              {CLASSI.map(c => (
                <th key={c} className="text-center px-3 py-2 font-heading font-semibold">
                  {c}
                  <div className="text-xs font-normal text-muted-foreground">target {target_mix[c]}%</div>
                </th>
              ))}
              <th className="text-center px-3 py-2 font-heading font-semibold">Stato</th>
            </tr>
          </thead>
          <tbody>
            {raccoglitori.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nessun dato disponibile. Carica i file delle Primarie Rete per popolare la matrice.
                </td>
              </tr>
            )}
            {raccoglitori.map((r, idx) => (
              <tr key={r.raccoglitore} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                <td className="px-3 py-2 font-medium">{r.raccoglitore}</td>
                <td className="px-3 py-2 text-right font-semibold">{r.totale_peso.toFixed(1)}</td>
                {CLASSI.map(c => {
                  const val = view === 'raccolto' ? r.percentuali[c] : r.percentuali_target[c];
                  const dev = r.deviazioni[c];
                  const isDev = Math.abs(dev) > 5;
                  return (
                    <td
                      key={c}
                      className={`text-center px-3 py-2 ${isDev && view === 'raccolto' ? 'bg-amber-100 text-amber-800 font-medium' : ''}`}
                    >
                      {val.toFixed(1)}%
                      {isDev && view === 'raccolto' && (
                        <div className="text-xs text-amber-600">
                          Δ{dev > 0 ? '+' : ''}{dev.toFixed(1)}%
                        </div>
                      )}
                    </td>
                  );
                })}
                <td className="text-center px-3 py-2">
                  {r.has_deviazione ? (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
                      <AlertTriangle className="w-3 h-3" /> Deviazione
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 border border-green-200">
                      <CheckCircle2 className="w-3 h-3" /> Conforme
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