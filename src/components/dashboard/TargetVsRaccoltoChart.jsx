import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
import { fmtTon } from '@/lib/utils';

export default function TargetVsRaccoltoChart({ data }) {
  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Nessun dato disponibile.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart layout="vertical" data={data} margin={{ top: 10, right: 60, left: 20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis type="number" domain={[0, 'auto']} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="regione" tick={{ fontSize: 11 }} width={90} />
        <Tooltip formatter={fmtTon} />
        <Legend />
        <Bar dataKey="target" name="Target" fill="hsl(197 82% 22%)" radius={[0, 4, 4, 0]}>
          <LabelList dataKey="target" position="right" formatter={fmtTon} style={{ fontSize: 11 }} />
        </Bar>
        <Bar dataKey="raccolto" name="Raccolto" fill="hsl(198 93% 60%)" radius={[0, 4, 4, 0]}>
          <LabelList dataKey="raccolto" position="right" formatter={fmtTon} style={{ fontSize: 11 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}