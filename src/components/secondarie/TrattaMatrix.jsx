import React, { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { formatNumber } from '@/lib/utils';

// Matrice gerarchica per tratta: Tratta -> Mese -> Classe
export default function TrattaMatrix({ matrix }) {
  const [expanded, setExpanded] = useState({});

  const toggle = (key) => setExpanded((p) => ({ ...p, [key]: !p[key] }));

  const fmt = (n) => formatNumber(n || 0, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const fmtTon = (kg) => formatNumber((kg || 0) / 1000);

  if (!matrix || matrix.length === 0) {
    return <div className="text-center py-8 text-muted-foreground border rounded-lg">Nessun dato tratta disponibile.</div>;
  }

  return (
    <div className="border rounded-lg overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="text-left px-3 py-2.5 font-medium">Tratta (Origine → Destinazione)</th>
            <th className="text-right px-3 py-2.5 font-medium">N. Ordini</th>
            <th className="text-right px-3 py-2.5 font-medium">Peso (t)</th>
            <th className="text-right px-3 py-2.5 font-medium">Quantità</th>
            <th className="text-left px-3 py-2.5 font-medium">Trasportatore</th>
          </tr>
        </thead>
        <tbody>
          {matrix.map((tratta) => {
            const trattaKey = `t:${tratta.origine}|${tratta.destinazione}`;
            const totalKg = Object.values(tratta.mesi || {}).reduce((s, m) => s + m.peso_kg, 0);
            const totalOrd = Object.values(tratta.mesi || {}).reduce((s, m) => s + m.ordini, 0);
            const totalQuant = Object.values(tratta.mesi || {}).reduce((s, m) => s + m.quantita, 0);
            return (
              <React.Fragment key={trattaKey}>
                <tr className="bg-muted/40 font-medium cursor-pointer hover:bg-muted/60" onClick={() => toggle(trattaKey)}>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1">
                      {expanded[trattaKey] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      {tratta.origine} → {tratta.destinazione}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">{fmt(totalOrd)}</td>
                  <td className="px-3 py-2.5 text-right">{fmtTon(totalKg)}</td>
                  <td className="px-3 py-2.5 text-right">{fmt(totalQuant)}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{tratta.trasportatore || 'N/D'}</td>
                </tr>
                {expanded[trattaKey] && (
                  <>
                    {Object.entries(tratta.mesi || {}).map(([mese, m]) => {
                      const meseKey = `${trattaKey}|m:${mese}`;
                      return (
                        <React.Fragment key={meseKey}>
                          <tr className="cursor-pointer hover:bg-muted/30" onClick={() => toggle(meseKey)}>
                            <td className="px-3 py-2 pl-10">
                              <span className="inline-flex items-center gap-1">
                                {expanded[meseKey] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                {mese}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right">{fmt(m.ordini)}</td>
                            <td className="px-3 py-2 text-right">{fmtTon(m.peso_kg)}</td>
                            <td className="px-3 py-2 text-right">{fmt(m.quantita)}</td>
                            <td></td>
                          </tr>
                          {expanded[meseKey] && Object.entries(tratta.classi || {}).map(([classe, c]) => (
                            <tr key={`${meseKey}|c:${classe}`} className="hover:bg-muted/20">
                              <td className="px-3 py-2 pl-20 text-muted-foreground">Classe {classe}</td>
                              <td className="px-3 py-2 text-right">{fmt(c.ordini)}</td>
                              <td className="px-3 py-2 text-right">{fmtTon(c.peso_kg)}</td>
                              <td className="px-3 py-2 text-right">{fmt(c.quantita)}</td>
                              <td></td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}