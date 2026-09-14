import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

function fmt(n, dec = 2) {
  if (n == null || isNaN(n)) return '—';
  // Conteggi interi; tonnellate con due decimali, tre se i kg non sono tondi.
  return Number(n).toLocaleString('it-IT', dec === 0 ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 3 });
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('it-IT');
}

export default function StoricoRilevazioni({ open, onClose, sito, rilevazioni }) {
  const rows = (rilevazioni || []).map((r, i) => {
    const prev = rilevazioni[i + 1];
    const tot = (r.class1_kg || 0) + (r.class2_kg || 0) + (r.class3_kg || 0) + (r.class4_kg || 0) + (r.class9_kg || 0);
    const prevTot = prev ? (prev.class1_kg || 0) + (prev.class2_kg || 0) + (prev.class3_kg || 0) + (prev.class4_kg || 0) + (prev.class9_kg || 0) : null;
    const variaz = prevTot != null ? tot - prevTot : null;
    return { r, tot, variaz };
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Storico rilevazioni — {sito}</DialogTitle>
        </DialogHeader>
        <div className="overflow-x-auto max-h-[60vh]">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr className="text-left">
                <th className="px-2 py-2 font-semibold">Data</th>
                <th className="px-2 py-2 font-semibold text-right">P (kg)</th>
                <th className="px-2 py-2 font-semibold text-right">M (kg)</th>
                <th className="px-2 py-2 font-semibold text-right">G1 (kg)</th>
                <th className="px-2 py-2 font-semibold text-right">G2 (kg)</th>
                <th className="px-2 py-2 font-semibold text-right">ACI (kg)</th>
                <th className="px-2 py-2 font-semibold text-right">Totale (t)</th>
                <th className="px-2 py-2 font-semibold text-right">Variazione</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ r, tot, variaz }) => (
                <tr key={r.id} className="border-t">
                  <td className="px-2 py-2">{fmtDate(r.data_rilevazione)}</td>
                  <td className="px-2 py-2 text-right">{fmt(r.class1_kg, 0)}</td>
                  <td className="px-2 py-2 text-right">{fmt(r.class2_kg, 0)}</td>
                  <td className="px-2 py-2 text-right">{fmt(r.class3_kg, 0)}</td>
                  <td className="px-2 py-2 text-right">{fmt(r.class4_kg, 0)}</td>
                  <td className="px-2 py-2 text-right">{fmt(r.class9_kg, 0)}</td>
                  <td className="px-2 py-2 text-right font-medium">{fmt(tot / 1000)}</td>
                  <td className={`px-2 py-2 text-right ${variaz == null ? 'text-muted-foreground' : variaz > 0 ? 'text-success' : variaz < 0 ? 'text-destructive' : ''}`}>
                    {variaz == null ? '—' : (variaz > 0 ? '+' : '') + fmt(variaz / 1000)}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={8} className="px-2 py-4 text-center text-muted-foreground">Nessuna rilevazione</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}