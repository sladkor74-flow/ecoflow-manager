import React, { useState } from 'react';
import { ChevronDown, Split } from 'lucide-react';
import { formatNumber, formatIntero } from '@/lib/utils';

// Un formulario il cui peso e' stato ripartito su piu' ordini. Nell'ACI e' il
// modo normale di stare dentro le regole del portale: una richiesta non si stima
// sotto i 1.500 kg e un formulario non si chiude a piu' del 10% del peso stimato
// del suo ticket, quindi quando il carico supera quella soglia il peso effettivo
// si divide su un secondo ordine. In fattura conta la somma dei pesi effettivi:
// qui si vede da dove viene.
export default function PassivaFormulariRipartiti({ formulari }) {
  const [aperto, setAperto] = useState(false);
  if (!formulari || formulari.length === 0) return null;

  return (
    <div className="rounded-lg border bg-muted/20 px-4 py-3">
      <button onClick={() => setAperto(v => !v)} className="w-full flex items-center justify-between text-left">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Split className="w-4 h-4 text-muted-foreground" />
          {formulari.length} formular{formulari.length === 1 ? 'io ripartito' : 'i ripartiti'} su più ordini
          <span className="font-normal text-muted-foreground">— non è un errore: è come si resta sotto la soglia del ticket</span>
        </span>
        <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${aperto ? 'rotate-180' : ''}`} />
      </button>

      {aperto && (
        <div className="mt-3 space-y-3">
          {formulari.map((f, i) => (
            <div key={i} className="rounded border bg-background/60 p-3">
              <div className="text-sm">
                <span className="font-semibold">{f.numero_fir}</span>
                <span className="text-muted-foreground"> — {f.trasportatore} → {f.destinazione}, classe {f.classe}</span>
              </div>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr className="text-left">
                      <th className="py-1 pr-3 font-medium">ID ordine</th>
                      <th className="py-1 pr-3 font-medium">Ticket</th>
                      <th className="py-1 pr-3 font-medium text-right">Stimato</th>
                      <th className="py-1 pr-3 font-medium text-right">Massimo (+10%)</th>
                      <th className="py-1 font-medium text-right">Effettivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.quote.map((q, qi) => (
                      <tr key={qi} className="border-t">
                        <td className="py-1 pr-3 font-medium">{q.id_ordine}</td>
                        <td className="py-1 pr-3">{q.ticket}</td>
                        <td className="py-1 pr-3 text-right tabular-nums">{formatIntero(q.peso_stimato_kg)} kg</td>
                        <td className="py-1 pr-3 text-right tabular-nums text-muted-foreground">{formatIntero(q.massimo_ammesso_kg)} kg</td>
                        <td className={`py-1 text-right tabular-nums ${q.oltre_soglia ? 'text-destructive font-semibold' : ''}`}>
                          {formatIntero(q.peso_effettivo_kg)} kg
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t bg-muted/40 font-semibold">
                      <td className="py-1 pr-3" colSpan={4}>In fattura</td>
                      <td className="py-1 text-right tabular-nums">{formatNumber(f.tonnellate_fatturate)} t</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
