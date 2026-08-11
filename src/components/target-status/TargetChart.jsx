import React, { useMemo, useRef, useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { MESI } from '@/lib/pfuConstants';

export default function TargetChart({ data, mese, onMeseChange }) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(0);

  // Misura manuale del container (sostituisce ResponsiveContainer)
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const update = () => setWidth(el.offsetWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const chartData = useMemo(() => {
    const regioniMap = {};
    for (const r of data) {
      if (!regioniMap[r.regione]) regioniMap[r.regione] = { name: r.regione, target: 0, raccolto: 0 };
      const m = r.mesi.find((x) => x.mese === mese);
      if (m) {
        regioniMap[r.regione].target += m.target;
        regioniMap[r.regione].raccolto += m.raccolto;
      }
    }
    return Object.values(regioniMap);
  }, [data, mese]);

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-semibold">Target vs Raccolto per Regione</h3>
        <select
          value={mese}
          onChange={(e) => onMeseChange(e.target.value)}
          className="text-sm border rounded px-2 py-1 bg-background"
        >
          {MESI.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>
      <div ref={containerRef} style={{ width: '100%', height: 300 }}>
        {width > 0 && (
          <BarChart key={mese} width={width} height={300} data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit=" t" />
            <Tooltip formatter={(v) => (v != null ? v.toFixed(1) + ' t' : '—')} />
            <Legend />
            <Bar dataKey="target" fill="#f59e0b" name="Target [t]" radius={[4, 4, 0, 0]} />
            <Bar dataKey="raccolto" fill="#22c55e" name="Raccolto [t]" radius={[4, 4, 0, 0]} />
          </BarChart>
        )}
      </div>
    </div>
  );
}