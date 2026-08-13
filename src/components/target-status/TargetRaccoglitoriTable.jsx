import React from 'react';
import { formatNumber } from '@/lib/utils';
import EditableCell from '@/components/target-status/EditableCell';

export default function TargetRaccoglitoriTable({ data, anno, onSave, isAdmin }) {
  const totale = data.reduce((s, r) => s + (r.target_tonnellate || 0), 0);

  return (
    <div className="border rounded-lg overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left px-4 py-3 font-heading font-semibold bg-primary text-primary-foreground">
              RACCOGLITORI
            </th>
            <th className="text-right px-4 py-3 font-heading font-semibold bg-sidebar-accent text-sidebar-accent-foreground">
              target anno {anno} espresso in tonnellate [t]
            </th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 && (
            <tr>
              <td colSpan={2} className="text-center py-8 text-muted-foreground">
                Nessun target configurato per l'anno {anno}. Usa il pulsante "Aggiungi raccoglitore" per creare nuovi target.
              </td>
            </tr>
          )}
          {data.map((r, idx) => (
            <tr key={r.id || r.raccoglitore} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
              <td className="px-4 py-2 font-medium">{r.raccoglitore}</td>
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
            <td className="px-4 py-3 font-heading font-bold text-right">Totale anno {anno}:</td>
            <td className="px-4 py-3 text-right font-heading font-bold tabular-nums">{formatNumber(totale)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}