import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

function fmt(n) {
  if (n == null || n === '' || isNaN(n)) return '—';
  return Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(n) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
}

function dashIfZero(v) {
  if (v == null || v === 0) return '—';
  return fmt(v) + ' t';
}

export default function TargetTable({ righe, totali }) {
  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="px-2 py-2 font-semibold">Sito</th>
              <th className="px-2 py-2 font-semibold">Ruolo</th>
              <th className="px-2 py-2 font-semibold text-right">Target primarie</th>
              <th className="px-2 py-2 font-semibold text-right">Target totale</th>
              <th className="px-2 py-2 font-semibold text-right">Conferito primarie</th>
              <th className="px-2 py-2 font-semibold text-right">Secondarie</th>
              <th className="px-2 py-2 font-semibold text-right">Terziarie</th>
              <th className="px-2 py-2 font-semibold text-right">Conferito</th>
              <th className="px-2 py-2 font-semibold text-right">Residuo</th>
              <th className="px-2 py-2 font-semibold">Copertura</th>
            </tr>
          </thead>
          <tbody>
            {righe.map((r, i) => {
              const cop = r.percentuale_target;
              const barColor = cop != null && cop > 100 ? 'bg-amber-500' : 'bg-success';
              const barWidth = cop != null ? Math.min(cop, 100) : 0;
              const secNet = r.secondarie_nette_t;
              const hasBothSec = r.secondarie_in_t > 0 && r.secondarie_out_t > 0;
              return (
                <tr key={i} className="border-t hover:bg-muted/30">
                  <td className="px-2 py-2">{r.sito}</td>
                  <td className="px-2 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      r.tipo_destinazione === 'imp'
                        ? 'bg-primary/15 text-primary'
                        : 'bg-accent/15 text-accent-foreground'
                    }`}>
                      {r.tipo_destinazione === 'imp' ? 'Impianto' : 'Stoccaggio'}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right">{fmt(r.target_primarie_t)} t</td>
                  <td className="px-2 py-2 text-right">{dashIfZero(r.target_totale_t)}</td>
                  <td className="px-2 py-2 text-right">{fmt(r.conferito_primarie_t)} t</td>
                  <td className={`px-2 py-2 text-right ${secNet < 0 ? 'text-destructive' : ''}`}>
                    {hasBothSec ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help underline decoration-dotted">{fmt(secNet)} t</span>
                          </TooltipTrigger>
                          <TooltipContent>in arrivo {fmt(r.secondarie_in_t)} t, in uscita {fmt(r.secondarie_out_t)} t</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <span className={secNet < 0 ? 'text-destructive' : ''}>{fmt(secNet)} t</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right">{fmt(r.terziarie_t)} t</td>
                  <td className="px-2 py-2 text-right font-medium">{fmt(r.conferito_t)} t</td>
                  <td className="px-2 py-2 text-right">{dashIfZero(r.residuo_t)}</td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium tabular-nums w-12 text-right">{fmtPct(cop)}</span>
                      <div className="flex-1 min-w-[60px] h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${barWidth}%` }} />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-muted/50 font-bold border-t-2">
            <tr>
              <td className="px-2 py-2">TOTALE</td>
              <td className="px-2 py-2"></td>
              <td className="px-2 py-2 text-right">{fmt(totali.target_primarie_t)} t</td>
              <td className="px-2 py-2 text-right">{dashIfZero(totali.target_totale_t)}</td>
              <td className="px-2 py-2 text-right">{fmt(totali.conferito_primarie_t)} t</td>
              <td className="px-2 py-2 text-right">{fmt(totali.secondarie_nette_t)} t</td>
              <td className="px-2 py-2 text-right">{fmt(totali.terziarie_t)} t</td>
              <td className="px-2 py-2 text-right">{fmt(totali.conferito_t)} t</td>
              <td className="px-2 py-2 text-right">{dashIfZero(totali.target_totale_t > 0 ? totali.target_totale_t - totali.conferito_primarie_t : null)}</td>
              <td className="px-2 py-2 text-right">{fmtPct(totali.target_totale_t > 0 ? (totali.conferito_primarie_t / totali.target_totale_t * 100) : null)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}