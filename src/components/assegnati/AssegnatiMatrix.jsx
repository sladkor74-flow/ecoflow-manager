import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

// Matrice analitica aggregata con raggruppamento gerarchico:
// Anno -> Semestre -> Regione -> Provincia
export default function AssegnatiMatrix({ matrix }) {
  const [expanded, setExpanded] = useState({});

  const tree = useMemo(() => {
    const t = {};
    for (const row of matrix || []) {
      if (!t[row.anno]) t[row.anno] = {};
      if (!t[row.anno][row.semestre]) t[row.anno][row.semestre] = {};
      if (!t[row.anno][row.semestre][row.regione]) t[row.anno][row.semestre][row.regione] = {};
      const prov = t[row.anno][row.semestre][row.regione];
      if (!prov[row.provincia]) prov[row.provincia] = { ordini: 0, peso_kg: 0, quantita: 0 };
      prov[row.provincia].ordini += row.ordini;
      prov[row.provincia].peso_kg += row.peso_kg;
      prov[row.provincia].quantita += row.quantita;
    }
    return t;
  }, [matrix]);

  const toggle = (key) => setExpanded((p) => ({ ...p, [key]: !p[key] }));

  const fmt = (n) => (n || 0).toLocaleString('it-IT', { maximumFractionDigits: 1 });
  const fmtTon = (kg) => ((kg || 0) / 1000).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const rows = [];
  for (const [anno, semestri] of Object.entries(tree)) {
    const annoKey = `a:${anno}`;
    const annoTot = (matrix || []).filter(r => r.anno === anno).reduce((s, r) => s + r.ordini, 0);
    const annoKg = (matrix || []).filter(r => r.anno === anno).reduce((s, r) => s + r.peso_kg, 0);
    rows.push(
      <tr key={annoKey} className="bg-muted/60 font-semibold cursor-pointer hover:bg-muted" onClick={() => toggle(annoKey)}>
        <td className="px-3 py-2.5">
          <span className="inline-flex items-center gap-1">
            {expanded[annoKey] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            Anno {anno}
          </span>
        </td>
        <td className="px-3 py-2.5 text-right">{fmt(annoTot)}</td>
        <td className="px-3 py-2.5 text-right">{fmtTon(annoKg)}</td>
        <td className="px-3 py-2.5 text-right">{fmt((matrix || []).filter(r => r.anno === anno).reduce((s, r) => s + r.quantita, 0))}</td>
      </tr>
    );
    if (expanded[annoKey]) {
      for (const [semestre, regioni] of Object.entries(semestri)) {
        const semKey = `${annoKey}|s:${semestre}`;
        const semTot = (matrix || []).filter(r => r.anno === anno && r.semestre === semestre).reduce((s, r) => s + r.ordini, 0);
        const semKg = (matrix || []).filter(r => r.anno === anno && r.semestre === semestre).reduce((s, r) => s + r.peso_kg, 0);
        rows.push(
          <tr key={semKey} className="cursor-pointer hover:bg-muted/40" onClick={() => toggle(semKey)}>
            <td className="px-3 py-2 pl-8">
              <span className="inline-flex items-center gap-1">
                {expanded[semKey] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                {semestre}
              </span>
            </td>
            <td className="px-3 py-2.5 text-right">{fmt(semTot)}</td>
            <td className="px-3 py-2.5 text-right">{fmtTon(semKg)}</td>
            <td className="px-3 py-2.5 text-right">{fmt((matrix || []).filter(r => r.anno === anno && r.semestre === semestre).reduce((s, r) => s + r.quantita, 0))}</td>
          </tr>
        );
        if (expanded[semKey]) {
          for (const [regione, province] of Object.entries(regioni)) {
            const regKey = `${semKey}|r:${regione}`;
            const regTot = (matrix || []).filter(r => r.anno === anno && r.semestre === semestre && r.regione === regione).reduce((s, r) => s + r.ordini, 0);
            const regKg = (matrix || []).filter(r => r.anno === anno && r.semestre === semestre && r.regione === regione).reduce((s, r) => s + r.peso_kg, 0);
            rows.push(
              <tr key={regKey} className="cursor-pointer hover:bg-muted/40" onClick={() => toggle(regKey)}>
                <td className="px-3 py-2 pl-16">
                  <span className="inline-flex items-center gap-1">
                    {expanded[regKey] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    {regione}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">{fmt(regTot)}</td>
                <td className="px-3 py-2.5 text-right">{fmtTon(regKg)}</td>
                <td className="px-3 py-2.5 text-right">{fmt((matrix || []).filter(r => r.anno === anno && r.semestre === semestre && r.regione === regione).reduce((s, r) => s + r.quantita, 0))}</td>
              </tr>
            );
            if (expanded[regKey]) {
              for (const [provincia, m] of Object.entries(province)) {
                rows.push(
                  <tr key={`${regKey}|p:${provincia}`} className="hover:bg-muted/30">
                    <td className="px-3 py-2 pl-24 text-muted-foreground">{provincia}</td>
                    <td className="px-3 py-2.5 text-right">{fmt(m.ordini)}</td>
                    <td className="px-3 py-2.5 text-right">{fmtTon(m.peso_kg)}</td>
                    <td className="px-3 py-2.5 text-right">{fmt(m.quantita)}</td>
                  </tr>
                );
              }
            }
          }
        }
      }
    }
  }

  if (!matrix || matrix.length === 0) {
    return <div className="text-center py-8 text-muted-foreground border rounded-lg">Nessun dato aggregato disponibile.</div>;
  }

  return (
    <div className="border rounded-lg overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted sticky top-0">
          <tr>
            <th className="text-left px-3 py-2.5 font-medium">Anno / Semestre / Regione / Provincia</th>
            <th className="text-right px-3 py-2.5 font-medium">N. Ordini</th>
            <th className="text-right px-3 py-2.5 font-medium">Peso Stimato (t)</th>
            <th className="text-right px-3 py-2.5 font-medium">Quantità Richiesta</th>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
}