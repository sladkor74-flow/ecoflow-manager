import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export default function PredittivitaSettimanale({ data }) {
  const [expanded, setExpanded] = useState(null);

  if (!data || !data.impianti || data.impianti.length === 0) {
    return <div className="text-center py-8 text-muted-foreground border rounded-lg">Nessun dato.</div>;
  }

  const settimane = data.settimane || [];
  const impianti = data.impianti;
  const colCount = 2 + impianti.length * 2 + 1;

  return (
    <div className="space-y-3">
      <h2 className="font-heading font-semibold">Pianificazione Settimanale</h2>
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted"><tr>
            <th className="text-left px-3 py-2 font-semibold">Sett.</th>
            <th className="text-left px-3 py-2 font-semibold">Periodo</th>
            {impianti.map(imp => (
              <React.Fragment key={imp.impianto.id}>
                <th className="text-right px-3 py-2 font-semibold">{imp.impianto.nome} kg</th>
                <th className="text-right px-3 py-2 font-semibold">Viaggi</th>
              </React.Fragment>
            ))}
            <th className="text-right px-3 py-2 font-semibold">Tot kg</th>
          </tr></thead>
          <tbody>
            {settimane.map((sett, i) => {
              const isExp = expanded === i;
              const totKg = impianti.reduce((s, imp) => s + (imp.piano_settimanale?.[i]?.totale_kg || 0), 0);
              const totViaggi = impianti.reduce((s, imp) => s + (imp.piano_settimanale?.[i]?.totale_viaggi || 0), 0);
              return (
                <React.Fragment key={i}>
                  <tr className={`cursor-pointer hover:bg-muted/30 ${isExp ? 'bg-muted/40' : ''} ${i % 2 ? 'bg-muted/20' : ''}`} onClick={() => setExpanded(isExp ? null : i)}>
                    <td className="px-3 py-2 font-medium">{isExp ? <ChevronDown className="w-4 h-4 inline" /> : <ChevronRight className="w-4 h-4 inline" />} {sett.numero}</td>
                    <td className="px-3 py-2 text-xs">{sett.data_inizio} → {sett.data_fine}</td>
                    {impianti.map(imp => (
                      <React.Fragment key={imp.impianto.id}>
                        <td className="px-3 py-2 text-right">{(imp.piano_settimanale?.[i]?.totale_kg || 0).toLocaleString()}</td>
                        <td className="px-3 py-2 text-right">{imp.piano_settimanale?.[i]?.totale_viaggi || 0}</td>
                      </React.Fragment>
                    ))}
                    <td className="px-3 py-2 text-right font-bold">{totKg.toLocaleString()}</td>
                  </tr>
                  {isExp && (
                    <tr className="bg-muted/10">
                      <td colSpan={colCount} className="p-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {impianti.map(imp => (
                            <div key={imp.impianto.id} className="border rounded p-2">
                              <h4 className="text-xs font-semibold mb-1">{imp.impianto.nome}</h4>
                              <div className="space-y-1">
                                {imp.piano_settimanale?.[i]?.fornitori.map(f => (
                                  <div key={f.fornitore_id} className="flex justify-between text-xs">
                                    <span className="font-medium">{f.fornitore_nome}</span>
                                    <span className="text-muted-foreground">{f.kg_previsti.toLocaleString()} kg · {f.viaggi_previsti} viaggi {f.capacita_settimanale > 0 && f.viaggi_previsti > f.capacita_settimanale ? '🔴' : ''}</span>
                                  </div>
                                ))}
                                {(!imp.piano_settimanale?.[i]?.fornitori || imp.piano_settimanale[i].fornitori.length === 0) && <p className="text-xs text-muted-foreground">Nessun fornitore.</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-primary text-primary-foreground font-bold">
              <td className="px-3 py-3" colSpan={2}>TOTALE</td>
              {impianti.map(imp => (
                <React.Fragment key={imp.impianto.id}>
                  <td className="px-3 py-3 text-right">{imp.totale_pianificato.toLocaleString()}</td>
                  <td className="px-3 py-3 text-right">{imp.viaggi_necessari}</td>
                </React.Fragment>
              ))}
              <td className="px-3 py-3 text-right">{impianti.reduce((s, imp) => s + imp.totale_pianificato, 0).toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}