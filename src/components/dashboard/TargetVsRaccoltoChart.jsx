import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function TargetVsRaccoltoChart({ data }) {
  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Nessun dato disponibile.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart layout="vertical" data={data} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="regione" tick={{ fontSize: 11 }} width={90} />
        <Tooltip formatter={(v) => v.toLocaleString('it-IT', { maximumFractionDigits: 1 }) + ' t'} />
        <Legend />
        <Bar dataKey="target" name="Target" fill="hsl(197 82% 22%)" radius={[0, 4, 4, 0]} />
        <Bar dataKey="raccolto" name="Raccolto" fill="hsl(198 93% 60%)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}