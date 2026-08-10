import React from 'react';
import { Warehouse, ArrowDownToLine, ArrowUpFromLine, Scale } from 'lucide-react';

export default function GiacenzeTable({ giacenze, loading }) {
  if (loading) {
    return <div className="flex items-center justify-center py-8 text-muted-foreground">Calcolo giacenze in tempo reale...</div>;
  }
  if (!giacenze || giacenze.length === 0) {
    return <div className="text-center py-8 text-muted-foreground border rounded-lg">Nessun dato giacenze disponibile.</div>;
  }

  return (
    <div className="border rounded-lg overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="text-left px-4 py-3 font-medium">
              <span className="inline-flex items-center gap-1.5"><Warehouse className="w-4 h-4" /> Impianto</span>
            </th>
            <th className="text-right px-4 py-3 font-medium">
              <span className="inline-flex items-center gap-1.5 justify-end"><ArrowDownToLine className="w-4 h-4 text-green-600" /> Ingressi [t]</span>
            </th>
            <th className="text-right px-4 py-3 font-medium">
              <span className="inline-flex items-center gap-1.5 justify-end"><ArrowUpFromLine className="w-4 h-4 text-red-600" /> Uscite [t]</span>
            </th>
            <th className="text-right px-4 py-3 font-medium">
              <span className="inline-flex items-center gap-1.5 justify-end"><Scale className="w-4 h-4" /> Giacenza [t]</span>
            </th>
            <th className="text-right px-4 py-3 font-medium">Sped. In</th>
            <th className="text-right px-4 py-3 font-medium">Sped. Out</th>
          </tr>
        </thead>
        <tbody>
          {giacenze.map((g) => (
            <tr key={g.impianto} className="border-t hover:bg-muted/50">
              <td className="px-4 py-3 font-medium">{g.impianto}</td>
              <td className="px-4 py-3 text-right text-green-700">{g.ingressi_t.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</td>
              <td className="px-4 py-3 text-right text-red-700">{g.uscite_t.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</td>
              <td className={`px-4 py-3 text-right font-bold ${g.giacenza_t < 0 ? 'text-red-600' : 'text-foreground'}`}>
                {g.giacenza_t.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground">{g.spedizioni_ingresso}</td>
              <td className="px-4 py-3 text-right text-muted-foreground">{g.spedizioni_uscita}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}