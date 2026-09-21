import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatNumber, formatTonnellate } from '@/lib/utils';
import { giornoRoma } from '@/lib/giornoItaliano';

function fmt(n, dec = 2) {
  if (n == null || isNaN(n)) return '—';
  // Conteggi interi; tonnellate con due decimali, tre se i kg non sono tondi.
  return dec === 0 ? formatNumber(n, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : dec === 2 ? formatTonnellate(n) : formatNumber(n, { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
// Il giorno italiano della rilevazione, non quello del fuso del browser.
function fmtDate(d) {
  const g = giornoRoma(d);
  return g ? `${g.slice(8, 10)}/${g.slice(5, 7)}/${g.slice(0, 4)}` : '—';
}

// Rete (classi 1-4) e ACI (classe 9) sono canali separati: un totale unico, e la
// sua variazione, li mescolavano. Se la rete scendeva di 8 t e l'ACI saliva di
// 8 t la variazione diceva zero. Ogni canale ha il suo totale e la sua variazione.
const kgRete = (r) => (r.class1_kg || 0) + (r.class2_kg || 0) + (r.class3_kg || 0) + (r.class4_kg || 0);
const kgAci = (r) => r.class9_kg || 0;

function Variazione({ kg }) {
  const classe = kg == null ? 'text-muted-foreground' : kg > 0 ? 'text-success' : kg < 0 ? 'text-destructive' : '';
  return <td className={`px-2 py-2 text-right ${classe}`}>{kg == null ? '—' : (kg > 0 ? '+' : '') + fmt(kg / 1000)}</td>;
}

export default function StoricoRilevazioni({ open, onClose, sito, rilevazioni }) {
  const rows = (rilevazioni || []).map((r, i) => {
    const prev = rilevazioni[i + 1];
    const rete = kgRete(r);
    const aci = kgAci(r);
    return {
      r, rete, aci,
      variazRete: prev ? rete - kgRete(prev) : null,
      variazAci: prev ? aci - kgAci(prev) : null,
    };
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Storico rilevazioni — {sito}</DialogTitle>
        </DialogHeader>
        <div className="overflow-x-auto max-h-[60vh]">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr className="text-left">
                <th className="px-2 pt-2" />
                <th className="px-2 pt-2 font-semibold text-center border-b" colSpan={6}>Rete (classi 1-4)</th>
                <th className="px-2 pt-2 font-semibold text-center border-b" colSpan={2}>ACI (classe 9)</th>
              </tr>
              <tr className="text-left">
                <th className="px-2 py-2 font-semibold">Data</th>
                <th className="px-2 py-2 font-semibold text-right">P (kg)</th>
                <th className="px-2 py-2 font-semibold text-right">M (kg)</th>
                <th className="px-2 py-2 font-semibold text-right">G1 (kg)</th>
                <th className="px-2 py-2 font-semibold text-right">G2 (kg)</th>
                <th className="px-2 py-2 font-semibold text-right">Totale (t)</th>
                <th className="px-2 py-2 font-semibold text-right">Variazione (t)</th>
                <th className="px-2 py-2 font-semibold text-right">Totale (t)</th>
                <th className="px-2 py-2 font-semibold text-right">Variazione (t)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ r, rete, aci, variazRete, variazAci }) => (
                <tr key={r.id} className="border-t">
                  <td className="px-2 py-2">{fmtDate(r.data_rilevazione)}</td>
                  <td className="px-2 py-2 text-right">{fmt(r.class1_kg, 0)}</td>
                  <td className="px-2 py-2 text-right">{fmt(r.class2_kg, 0)}</td>
                  <td className="px-2 py-2 text-right">{fmt(r.class3_kg, 0)}</td>
                  <td className="px-2 py-2 text-right">{fmt(r.class4_kg, 0)}</td>
                  <td className="px-2 py-2 text-right font-medium">{fmt(rete / 1000)}</td>
                  <Variazione kg={variazRete} />
                  <td className="px-2 py-2 text-right font-medium">{fmt(aci / 1000)}</td>
                  <Variazione kg={variazAci} />
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={9} className="px-2 py-4 text-center text-muted-foreground">Nessuna rilevazione</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
