import React from 'react';
import { MESI_BREVI } from '@/lib/pfuConstants';

export default function RegionTable({ data }) {
  return (
    <div className="border rounded-lg overflow-x-auto">
      <table className="text-xs whitespace-nowrap border-collapse">
        <thead className="bg-muted">
          <tr>
            <th className="sticky left-0 bg-muted px-3 py-2 text-left">Regione</th>
            <th className="px-2 py-2 text-right">Totale Raccolto [t]</th>
            {MESI_BREVI.map((m) => (
              <React.Fragment key={m}>
                <th className="px-1 py-1 text-right text-[10px] font-medium" colSpan={3}>{m}</th>
              </React.Fragment>
            ))}
          </tr>
          <tr className="bg-muted border-t">
            <th className="sticky left-0 bg-muted"></th>
            <th></th>
            {MESI_BREVI.map((m) => (
              <React.Fragment key={m}>
                <th className="px-1 py-1 text-right text-[10px] font-normal text-muted-foreground">T</th>
                <th className="px-1 py-1 text-right text-[10px] font-normal text-muted-foreground">R</th>
                <th className="px-1 py-1 text-right text-[10px] font-normal text-muted-foreground">Δ</th>
              </React.Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((r, i) => (
            <tr key={i} className="border-t hover:bg-muted/30">
              <td className="sticky left-0 bg-card px-3 py-1.5 font-medium">{r.regione}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{r.totale.toFixed(1)}</td>
              {r.mesi.map((m, j) => (
                <React.Fragment key={j}>
                  <td className="px-1 py-1.5 text-right tabular-nums">{m.target.toFixed(1)}</td>
                  <td className="px-1 py-1.5 text-right tabular-nums">{m.raccolto.toFixed(1)}</td>
                  <td className={`px-1 py-1.5 text-right tabular-nums ${m.delta > 0 ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'}`}>
                    {m.delta.toFixed(1)}
                  </td>
                </React.Fragment>
              ))}
            </tr>
          ))}
          {data.length === 0 && (
            <tr><td colSpan={38} className="px-3 py-4 text-center text-muted-foreground">Nessun dato</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}