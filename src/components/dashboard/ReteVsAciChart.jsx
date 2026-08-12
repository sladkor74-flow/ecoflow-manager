import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';

const fmtTon = (v) => (Number(v) || 0).toLocaleString('it-IT', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' t';

export default function ReteVsAciChart({ data }) {
  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Nessun dato per i filtri selezionati.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart layout="vertical" data={data} margin={{ top: 10, right: 60, left: 20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis type="number" domain={[0, 'auto']} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="regione" tick={{ fontSize: 11 }} width={90} />
        <Tooltip formatter={fmtTon} />
        <Legend />
        <Bar dataKey="rete" name="Rete" fill="hsl(142 71% 45%)" radius={[0, 4, 4, 0]}>
          <LabelList dataKey="rete" position="right" formatter={fmtTon} style={{ fontSize: 11 }} />
        </Bar>
        <Bar dataKey="aci" name="ACI" fill="hsl(38 92% 50%)" radius={[0, 4, 4, 0]}>
          <LabelList dataKey="aci" position="right" formatter={fmtTon} style={{ fontSize: 11 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}