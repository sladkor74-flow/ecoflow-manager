import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
import { fmtTon } from '@/lib/utils';

// Target, atteso alla data e raccolto RETE per regione (getDashboardRaccolta,
// target_vs_raccolto). L'atteso c'e' dall'11/10/2026: il target da solo non
// dice se una regione e' in linea. Un anno senza contratto non ha target ne'
// atteso (null): il grafico mostra il solo raccolto, senza barre a zero.
export default function TargetVsRaccoltoChart({ data, giorno }) {
  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Nessun dato disponibile.</p>;
  }
  const conTarget = data.some(r => r.target !== null && r.target !== undefined);
  const conAtteso = data.some(r => r.atteso !== null && r.atteso !== undefined);
  const etichettaAtteso = giorno ? `Atteso al ${giorno.slice(8, 10)}/${giorno.slice(5, 7)}` : 'Atteso';
  const formato = (v) => (v === null || v === undefined ? '—' : fmtTon(v));
  return (
    <ResponsiveContainer width="100%" height={conAtteso ? 360 : 300}>
      <BarChart layout="vertical" data={data} margin={{ top: 10, right: 60, left: 20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis type="number" domain={[0, 'auto']} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="regione" tick={{ fontSize: 11 }} width={90} />
        <Tooltip formatter={formato} />
        <Legend />
        {conTarget && (
          <Bar dataKey="target" name="Target" fill="hsl(197 82% 22%)" radius={[0, 4, 4, 0]}>
            <LabelList dataKey="target" position="right" formatter={formato} style={{ fontSize: 11 }} />
          </Bar>
        )}
        {conAtteso && (
          <Bar dataKey="atteso" name={etichettaAtteso} fill="hsl(38 92% 55%)" radius={[0, 4, 4, 0]}>
            <LabelList dataKey="atteso" position="right" formatter={formato} style={{ fontSize: 11 }} />
          </Bar>
        )}
        <Bar dataKey="raccolto" name="Raccolto" fill="hsl(198 93% 60%)" radius={[0, 4, 4, 0]}>
          <LabelList dataKey="raccolto" position="right" formatter={formato} style={{ fontSize: 11 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
