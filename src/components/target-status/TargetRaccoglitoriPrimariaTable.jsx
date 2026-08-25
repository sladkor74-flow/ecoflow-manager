import React, { useMemo } from 'react';
import { formatNumber } from '@/lib/utils';
import EditableCell from '@/components/target-status/EditableCell';
import { MESI } from '@/lib/pfuConstants';

const STATO_STYLE = {
  conforme: { label: 'Conforme', cls: 'bg-green-100 text-green-700' },
  in_anticipo: { label: 'Anticipo', cls: 'bg-blue-100 text-blue-700' },
  in_ritardo: { label: 'Ritardo', cls: 'bg-red-100 text-red-700' },
  senza_dati: { label: 'Senza dati', cls: 'bg-muted text-muted-foreground' },
};

export default function TargetRaccoglitoriPrimariaTable({ righe, anno, onSave, isAdmin }) {
  // Pivot: raccoglitore -> { mese -> row }
  const { raccoglitori, matrix, totals } = useMemo(() => {
    const raccSet = new Set();
    const m = {}; // racc -> { mese -> row }
    for (const r of righe) {
      raccSet.add(r.raccoglitore);
      if (!m[r.raccoglitore]) m[r.raccoglitore] = {};
      m[r.raccoglitore][r.mese] = r;
    }
    const raccList = Array.from(raccSet).sort((a, b) => a.localeCompare(b));
    const tot = { target: 0, raccolto: 0 };
    for (const r of righe) {
      tot.target += r.target_kg || 0;
      tot.raccolto += r.raccolto_kg || 0;
    }
    return { raccoglitori: raccList, matrix: m, totals: tot };
  }, [righe]);

  return (
    <div className="space-y-3">
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left px-3 py-3 font-heading font-semibold bg-primary text-primary-foreground sticky left-0">RACCOGLITORE</th>
              {MESI.map(m => (
                <th key={m} className="text-center px-2 py-3 font-heading font-semibold bg-sidebar-accent text-sidebar-accent-foreground">{m.slice(0, 3)}</th>
              ))}
              <th className="text-right px-3 py-3 font-heading font-semibold bg-primary text-primary-foreground">Totale</th>
            </tr>
          </thead>
          <tbody>
            {raccoglitori.length === 0 && (
              <tr><td colSpan={MESI.length + 2} className="text-center py-8 text-muted-foreground">
                Nessun target configurato per il {anno}. Usa "Aggiungi raccoglitore primaria" per crearne.
              </td></tr>
            )}
            {raccoglitori.map((racc, idx) => {
              let totTarget = 0, totRacc = 0;
              for (const m of MESI) { totTarget += matrix[racc]?.[m]?.target_kg || 0; totRacc += matrix[racc]?.[m]?.raccolto_kg || 0; }
              return (
                <React.Fragment key={racc}>
                  <tr className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                    <td className="px-3 py-2 font-medium sticky left-0 bg-inherit">{racc}</td>
                    {MESI.map(m => {
                      const row = matrix[racc]?.[m];
                      const st = row?.stato ? STATO_STYLE[row.stato] : null;
                      return (
                        <td key={m} className="px-2 py-2 text-center align-top">
                          <div className="flex flex-col items-center gap-0.5">
                            <EditableCell value={row?.target_kg || 0} onSave={(v) => onSave(row, racc, m, v)} disabled={!isAdmin} />
                            <span className="text-[10px] text-muted-foreground">{formatNumber(row?.raccolto_kg || 0)}</span>
                            {st && <span className={`text-[9px] px-1 rounded ${st.cls}`}>{st.label}</span>}
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right font-bold tabular-nums">{formatNumber(totTarget)}</td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-foreground/20 bg-muted">
              <td className="px-3 py-3 font-heading font-bold text-right">Totale {anno}:</td>
              {MESI.map(m => {
                const t = righe.filter(r => r.mese === m).reduce((s, r) => s + (r.target_kg || 0), 0);
                return <td key={m} className="px-2 py-3 text-center text-xs font-bold tabular-nums">{formatNumber(t)}</td>;
              })}
              <td className="px-3 py-3 text-right font-heading font-bold tabular-nums">{formatNumber(totals.target)}</td>
            </tr>
            <tr className="bg-muted/50">
              <td className="px-3 py-2 text-right text-xs text-muted-foreground">Raccolto:</td>
              {MESI.map(m => {
                const t = righe.filter(r => r.mese === m).reduce((s, r) => s + (r.raccolto_kg || 0), 0);
                return <td key={m} className="px-2 py-2 text-center text-xs tabular-nums text-muted-foreground">{formatNumber(t)}</td>;
              })}
              <td className="px-3 py-2 text-right text-xs font-bold tabular-nums">{formatNumber(totals.raccolto)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Valori in kg. La prima riga di ogni cella è il target mensile (modificabile), la seconda il raccolto effettivo aggregato da Primaria Rete + ACI, il badge lo stato del confronto.</p>
    </div>
  );
}