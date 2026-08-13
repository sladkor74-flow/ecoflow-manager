import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { formatNumber } from '@/lib/utils';

const CLASSI = ['P', 'M', 'G1', 'G2'];

export default function RaccoglitoriMix({ data }) {
  const [view, setView] = useState('raccolto'); // 'raccolto' | 'target'

  if (!data) return null;

  const { raccoglitori, target_mix, target_totale, raccoglitori_con_deviazione } = data;

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
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => setView('raccolto')}
          className={`px-4 py-2 text-sm font-semibold rounded-md transition-all border-2 ${view === 'raccolto' ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-background text-foreground border-border hover:bg-accent hover:border-primary/40'}`}
        >
          % SUL RACCOLTO PER CLASSI
        </button>
        <button
          onClick={() => setView('target')}
          className={`px-4 py-2 text-sm font-semibold rounded-md transition-all border-2 ${view === 'target' ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-background text-foreground border-border hover:bg-accent hover:border-primary/40'}`}
        >
          % SUL TARGET PER CLASSI
        </button>
        <span className="text-xs text-muted-foreground ml-1">
          Totale target assegnati: {formatNumber(target_totale || 0)} ton
        </span>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-3 py-2 font-heading font-semibold">Raccoglitore</th>
              <th className="text-right px-3 py-2 font-heading font-semibold">Totale (ton)</th>
              <th className="text-right px-3 py-2 font-heading font-semibold">Target (ton)</th>
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
                <td colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nessun dato disponibile. Carica i file delle Primarie Rete per popolare la matrice.
                </td>
              </tr>
            )}
            {raccoglitori.map((r, idx) => (
              <tr key={r.raccoglitore} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                <td className="px-3 py-2 font-medium">{r.raccoglitore}</td>
                <td className="px-3 py-2 text-right font-semibold">{formatNumber(r.totale_peso)}</td>
                <td className="px-3 py-2 text-right text-muted-foreground">{formatNumber(r.target_raccoglitore || 0)}</td>
                {CLASSI.map(c => {
                  const val = view === 'raccolto' ? r.percentuali[c] : r.percentuali_target[c];
                  const dev = r.deviazioni[c];
                  const isDev = Math.abs(dev) > 5;
                  return (
                    <td
                      key={c}
                      className={`text-center px-3 py-2 ${isDev && view === 'raccolto' ? 'bg-amber-100 text-amber-800 font-medium border-2 border-amber-300' : ''}`}
                    >
                      {formatNumber(val)}%
                      {isDev && view === 'raccolto' && (
                        <div className="text-xs text-amber-600 mt-0.5">
                          Δ{dev > 0 ? '+' : ''}{formatNumber(dev)}%
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