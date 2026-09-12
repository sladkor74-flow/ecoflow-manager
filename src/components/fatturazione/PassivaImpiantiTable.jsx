import React from 'react';
import { formatNumber } from '@/lib/utils';

export default function PassivaImpiantiTable({ data }) {
  if (!data || data.length === 0) {
    return <div className="text-sm text-muted-foreground py-4 text-center">Nessun impianto/stoccaggio per questo periodo.</div>;
  }
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="px-3 py-2 font-semibold">Fornitore</th>
              <th className="px-3 py-2 font-semibold">Prestazione</th>
              <th className="px-3 py-2 font-semibold">Classe</th>
              <th className="px-3 py-2 font-semibold">Proven.</th>
              <th className="px-3 py-2 font-semibold text-right">Tonnellate</th>
              <th className="px-3 py-2 font-semibold text-right">Tariffa</th>
              <th className="px-3 py-2 font-semibold text-right">Importo €</th>
            </tr>
          </thead>
          <tbody>
            {data.map((f, fi) => (
              <React.Fragment key={fi}>
                {f.righe.map((r, ri) => (
                  <tr key={`${fi}-${ri}`} className={`border-t ${ri === 0 ? 'bg-primary/5' : ''} ${f.interno ? 'italic text-muted-foreground' : ''}`}>
                    <td className="px-3 py-1.5">
                      {ri === 0 && <span className="font-semibold">{f.fornitore}</span>}
                      {ri === 0 && f.interno && <span className="ml-1 text-xs">(interno, non fatturato)</span>}
                    </td>
                    <td className="px-3 py-1.5">{r.prestazione}</td>
                    <td className="px-3 py-1.5">{r.classe}</td>
                    <td className="px-3 py-1.5">{r.provenienza}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{formatNumber(r.tonnellate)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {r.tariffa_valore ? `${formatNumber(r.tariffa_valore)} ${r.unita_misura}` : '—'}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-medium">{formatNumber(r.importo, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
                <tr className="border-t bg-muted/30 font-semibold">
                  <td className="px-3 py-1.5">Totale {f.fornitore}</td>
                  <td colSpan={3}></td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatNumber(f.totale_tonnellate)}</td>
                  <td></td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatNumber(f.totale_euro, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}