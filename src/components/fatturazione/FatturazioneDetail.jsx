import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export default function FatturazioneDetail({ fornitori, totale, onVoceClick }) {
  const [expanded, setExpanded] = useState(new Set());

  const toggle = (nome) => {
    const next = new Set(expanded);
    next.has(nome) ? next.delete(nome) : next.add(nome);
    setExpanded(next);
  };

  if (!fornitori || fornitori.length === 0) {
    return <div className="text-center py-8 text-muted-foreground border rounded-lg">Nessuna voce.</div>;
  }

  return (
    <div className="border rounded-lg overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="text-left px-3 py-2 font-semibold">Fornitore / Voce</th>
            <th className="text-right px-3 py-2 font-semibold">Quantità</th>
            <th className="text-right px-3 py-2 font-semibold">Tariffa</th>
            <th className="text-right px-3 py-2 font-semibold">Totale</th>
          </tr>
        </thead>
        <tbody>
          {fornitori.map((f) => (
            <React.Fragment key={f.fornitore_nome}>
              <tr className="bg-muted/50 font-medium cursor-pointer hover:bg-muted" onClick={() => toggle(f.fornitore_nome)}>
                <td className="px-3 py-2">
                  {expanded.has(f.fornitore_nome) ? <ChevronDown className="w-4 h-4 inline mr-1" /> : <ChevronRight className="w-4 h-4 inline mr-1" />}
                  {f.fornitore_nome}
                </td>
                <td colSpan={2} className="px-3 py-2 text-right text-muted-foreground text-xs">{f.voci.length} voci</td>
                <td className="px-3 py-2 text-right font-bold">€ {f.totale.toFixed(2)}</td>
              </tr>
              {expanded.has(f.fornitore_nome) && f.voci.map((v) => (
                <tr key={v.id} className="cursor-pointer hover:bg-muted/30" onClick={() => onVoceClick(v)}>
                  <td className="px-3 py-1.5 pl-10">{v.descrizione || `${v.servizio_nome} ${v.classe || ''}`.trim()}</td>
                  <td className="px-3 py-1.5 text-right">{v.quantita.toFixed(2)} {v.unita_misura?.replace('€/', '')}</td>
                  <td className="px-3 py-1.5 text-right">€ {v.tariffa_valore.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right">€ {v.totale.toFixed(2)}</td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-primary text-primary-foreground font-bold">
            <td className="px-3 py-3" colSpan={3}>TOTALE GENERALE</td>
            <td className="px-3 py-3 text-right">€ {totale.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}