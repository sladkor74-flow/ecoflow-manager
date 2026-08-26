import React, { useMemo } from 'react';
import { formatNumber } from '@/lib/utils';
import EditableCell from '@/components/target-status/EditableCell';
import { normalizzaRagioneSociale } from '@/lib/normalizzaRagioneSocialeClient';

export default function TargetRaccoglitoriTable({ data, anno, onSave, isAdmin, excludedNorms }) {
  // Esclude i record il cui nome e' un impianto doppio ruolo / impianto (quote impianto, non raccoglitori)
  const visibili = useMemo(() => {
    if (!excludedNorms || excludedNorms.size === 0) return data;
    return data.filter(r => !excludedNorms.has(normalizzaRagioneSociale(r.raccoglitore)));
  }, [data, excludedNorms]);

  const hasRegionale = useMemo(() => visibili.some(r => r.regione), [visibili]);
  const totale = visibili.reduce((s, r) => s + (r.target_tonnellate || 0), 0);

  return (
    <div className="border rounded-lg overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left px-4 py-3 font-heading font-semibold bg-primary text-primary-foreground">
              RACCOGLITORI
            </th>
            {hasRegionale && (
              <th className="text-left px-4 py-3 font-heading font-semibold bg-sidebar-accent text-sidebar-accent-foreground">
                Regione
              </th>
            )}
            <th className="text-right px-4 py-3 font-heading font-semibold bg-sidebar-accent text-sidebar-accent-foreground">
              target anno {anno} espresso in tonnellate [t]
            </th>
          </tr>
        </thead>
        <tbody>
          {visibili.length === 0 && (
            <tr>
              <td colSpan={hasRegionale ? 3 : 2} className="text-center py-8 text-muted-foreground">
                Nessun target configurato per l'anno {anno}. Usa il pulsante "Aggiungi raccoglitore" per creare nuovi target.
              </td>
            </tr>
          )}
          {visibili.map((r, idx) => (
            <tr key={r.id || r.raccoglitore + (r.regione || '')} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
              <td className="px-4 py-2 font-medium">{r.raccoglitore}</td>
              {hasRegionale && <td className="px-4 py-2 text-muted-foreground">{r.regione || '—'}</td>}
              <td className="px-4 py-2 text-right">
                <EditableCell
                  value={r.target_tonnellate}
                  onSave={(val) => onSave(r, val)}
                  disabled={!isAdmin}
                />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-foreground/20 bg-muted">
            <td className="px-4 py-3 font-heading font-bold text-right" colSpan={hasRegionale ? 2 : 1}>Totale anno {anno}:</td>
            <td className="px-4 py-3 text-right font-heading font-bold tabular-nums">{formatNumber(totale)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}