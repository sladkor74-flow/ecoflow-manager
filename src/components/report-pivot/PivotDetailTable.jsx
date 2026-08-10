import React from 'react';

function fmt(v) {
  if (v == null) return '—';
  if (typeof v === 'number' && !Number.isInteger(v)) return v.toFixed(2);
  return String(v);
}

export default function PivotDetailTable({ pivot, onCellClick }) {
  if (!pivot || pivot.length === 0) return <div className="text-muted-foreground text-sm py-4">Nessun dato</div>;

  return (
    <div className="border rounded-lg overflow-x-auto">
      <table className="text-xs whitespace-nowrap border-collapse">
        <thead className="bg-muted">
          <tr>
            {pivot.rowLabels.map((l) => <th key={l} className="px-3 py-2 text-left">{l}</th>)}
            {pivot.valueLabels.map((l) => <th key={l} className="px-3 py-2 text-right">{l}</th>)}
          </tr>
        </thead>
        <tbody>
          {pivot.map((row, i) => (
            <tr key={i} className="border-t hover:bg-muted/30">
              {row.keys.map((k, j) => <td key={j} className="px-3 py-1.5">{k}</td>)}
              {pivot.valueKeys.map((vk) => (
                <td key={vk} className="px-3 py-1.5 text-right">
                  <button onClick={() => onCellClick?.(row.keys, null, vk)} className="hover:underline tabular-nums">
                    {fmt(row.values[vk])}
                  </button>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}