import React from 'react';
import { MESI_BREVI } from '@/lib/pfuConstants';
import EditableCell from './EditableCell';

export default function TargetTable({ data, onSaveTargetAnnuo, onSaveTargetMensile }) {
  return (
    <div className="border rounded-lg overflow-x-auto">
      <table className="text-xs whitespace-nowrap border-collapse">
        <thead className="bg-muted">
          <tr>
            <th className="sticky left-0 bg-muted px-3 py-2 text-left">Regione</th>
            <th className="sticky left-[100px] bg-muted px-3 py-2 text-left">Raccoglitore</th>
            <th className="px-2 py-2 text-right">Target Annuo</th>
            <th className="px-2 py-2 text-right">Raccolto</th>
            <th className="px-2 py-2 text-right">Leftover</th>
            {MESI_BREVI.map((m) => (
              <th key={m} className="px-1 py-1 text-center text-[10px] font-medium" colSpan={3}>{m}</th>
            ))}
          </tr>
          <tr className="bg-muted border-t">
            <th className="sticky left-0 bg-muted" colSpan={5}></th>
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
          {data.map((row, i) => (
            <tr key={i} className="border-t hover:bg-muted/30">
              <td className="sticky left-0 bg-card px-3 py-1.5">{row.regione}</td>
              <td className="sticky left-[100px] bg-card px-3 py-1.5 font-medium max-w-[180px] truncate">{row.raccoglitore}</td>
              <td className="px-2 py-1.5 text-right">
                <EditableCell value={row.targetAnnuo} onSave={(v) => onSaveTargetAnnuo(row.raccoglitore, row.regione, v)} />
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">{row.raccoltoTotale.toFixed(1)}</td>
              <td className={`px-2 py-1.5 text-right tabular-nums font-medium ${row.leftover < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {row.leftover.toFixed(1)}
              </td>
              {row.mesi.map((m, j) => (
                <React.Fragment key={j}>
                  <td className="px-1 py-1.5 text-right">
                    <EditableCell value={m.target} onSave={(v) => onSaveTargetMensile(row.raccoglitore, row.regione, m.mese, v)} />
                  </td>
                  <td className="px-1 py-1.5 text-right tabular-nums">{m.raccolto.toFixed(1)}</td>
                  <td className={`px-1 py-1.5 text-right tabular-nums ${m.delta > 0 ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'}`}>
                    {m.delta.toFixed(1)}
                  </td>
                </React.Fragment>
              ))}
            </tr>
          ))}
          {data.length === 0 && (
            <tr><td colSpan={41} className="px-3 py-4 text-center text-muted-foreground">Nessun dato disponibile</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}