import React from 'react';
import { MESI_BREVI } from '@/lib/pfuConstants';
import { formatNumber } from '@/lib/utils';

// Le primarie RETE ricevute da ogni impianto, mese per mese (chiusura
// dell'audit, 11/10/2026). C'erano anche, per ogni mese, un target e un delta:
// il target mensile per impianto (ImpiantoTarget) non l'ha mai scritto nessuno,
// nessun calcolo lo leggeva e la copia dell'anno non lo portava, quindi la
// colonna era sempre zero e il delta un «avanzo» verde grande quanto il
// raccolto. Il target di un impianto e' quello annuo di Impianti e stoccaggi, e
// si confronta in Giacenze. E «Totale conferito» non era il conferito delle
// Giacenze (che conta anche le secondarie in arrivo): sono le sole primarie, e
// la colonna ora lo dice.
export default function ImpiantiTable({ data }) {
  return (
    <div className="border rounded-lg overflow-x-auto">
      <table className="text-xs whitespace-nowrap border-collapse">
        <thead className="bg-muted">
          <tr>
            <th className="sticky left-0 bg-muted px-3 py-2 text-left">Impianto</th>
            <th className="px-2 py-2 text-right">Primarie RETE ricevute [t]</th>
            {MESI_BREVI.map((m) => (
              <th key={m} className="px-2 py-2 text-right text-[10px] font-medium">{m}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.impianto} className="border-t hover:bg-muted/30">
              <td className="sticky left-0 bg-card px-3 py-1.5 font-medium max-w-[200px] truncate">{r.impianto}</td>
              <td className="px-2 py-1.5 text-right tabular-nums font-medium">{formatNumber(r.totale)}</td>
              {r.mesi.map((m) => (
                <td key={m.mese} className="px-2 py-1.5 text-right tabular-nums">{formatNumber(m.raccolto)}</td>
              ))}
            </tr>
          ))}
          {data.length === 0 && (
            <tr><td colSpan={14} className="px-3 py-4 text-center text-muted-foreground">Nessun dato</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
