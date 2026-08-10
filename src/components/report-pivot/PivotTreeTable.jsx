import React, { useState, useMemo, useEffect } from 'react';

function flatten(node, expanded, parentKey = '', level = 0, parentPath = []) {
  const result = [];
  if (!node.children) return result;
  for (const child of node.children) {
    const path = [...parentPath, child.label];
    const key = parentKey ? `${parentKey}|||${child.label}` : child.label;
    result.push({ ...child, path, key, level });
    if (child.children && expanded.has(key)) {
      result.push(...flatten(child, expanded, key, level + 1, path));
    }
  }
  return result;
}

function fmt(v) {
  if (v == null) return '—';
  if (typeof v === 'number' && !Number.isInteger(v)) return v.toFixed(1);
  return String(v);
}

export default function PivotTreeTable({ pivot, onCellClick }) {
  const [expanded, setExpanded] = useState(new Set());

  useEffect(() => {
    if (pivot?.tree?.children) {
      setExpanded(new Set(pivot.tree.children.map((c) => c.label)));
    }
  }, [pivot]);

  const rows = useMemo(() => (pivot ? flatten(pivot.tree, expanded) : []), [pivot, expanded]);

  if (!pivot || !pivot.tree) return <div className="text-muted-foreground text-sm py-4">Nessun dato</div>;

  const toggle = (key) => setExpanded((prev) => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  return (
    <div className="border rounded-lg overflow-x-auto">
      <table className="text-xs whitespace-nowrap border-collapse">
        <thead className="bg-muted">
          <tr>
            <th className="px-3 py-2 text-left sticky left-0 bg-muted min-w-[200px]">Riga</th>
            {pivot.columns.map((col) => pivot.valueLabels.map((vl) => (
              <th key={col + vl} className="px-2 py-2 text-right whitespace-nowrap">{col} {vl}</th>
            )))}
            {pivot.valueLabels.map((vl) => <th key={'tot' + vl} className="px-2 py-2 text-right bg-muted-foreground/10">Tot {vl}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t hover:bg-muted/30">
              <td className="px-3 py-1.5 sticky left-0 bg-card" style={{ paddingLeft: `${row.level * 20 + 12}px` }}>
                {row.children && row.children.length > 0 && (
                  <button onClick={() => toggle(row.key)} className="mr-1 w-4 inline-flex justify-center hover:bg-accent rounded">
                    {expanded.has(row.key) ? '−' : '+'}
                  </button>
                )}
                <span className={row.level === 0 ? 'font-semibold' : ''}>{row.label}</span>
              </td>
              {pivot.columns.map((col) => pivot.valueKeys.map((vk) => {
                const val = row.values[col]?.[vk];
                return (
                  <td key={col + vk} className="px-2 py-1.5 text-right">
                    <button onClick={() => onCellClick?.(row.path, col, vk)} className="hover:underline tabular-nums">
                      {fmt(val)}
                    </button>
                  </td>
                );
              }))}
              {pivot.valueKeys.map((vk) => (
                <td key={'tot' + vk} className="px-2 py-1.5 text-right font-medium bg-muted-foreground/5 tabular-nums">
                  {fmt(row.totals[vk])}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={50} className="px-3 py-4 text-center text-muted-foreground">Nessun dato</td></tr>}
        </tbody>
      </table>
    </div>
  );
}