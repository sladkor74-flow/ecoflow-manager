import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

function fmt(n) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
}

function RuoloBadge({ td }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${td === 'imp' ? 'bg-primary/15 text-primary' : 'bg-accent/20 text-accent-foreground'}`}>
      {td === 'imp' ? 'Impianto' : 'Stoccaggio'}
    </span>
  );
}

function Num({ value, className = '', bold = false }) {
  const isNeg = value < 0;
  return (
    <span className={`tabular-nums text-right block ${bold ? 'font-bold' : ''} ${isNeg ? 'text-destructive' : ''} ${className}`}>
      {fmt(value)}
    </span>
  );
}

export default function GiacenzeTable({ righe, totali }) {
  return (
    <div className="border rounded-lg overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-muted sticky top-0">
          <tr>
            <th className="text-left px-2 py-2 font-semibold whitespace-nowrap">Sito</th>
            <th className="text-center px-2 py-2 font-semibold">Ruolo</th>
            <th className="text-right px-2 py-2 font-semibold whitespace-nowrap">Target prim.</th>
            <th className="text-right px-2 py-2 font-semibold whitespace-nowrap">Target tot.</th>
            <th className="text-right px-2 py-2 font-semibold whitespace-nowrap">Giac. iniz.</th>
            <th className="text-right px-2 py-2 font-semibold whitespace-nowrap">Conf. prim.</th>
            <th className="text-right px-2 py-2 font-semibold whitespace-nowrap">Secondarie</th>
            <th className="text-right px-2 py-2 font-semibold whitespace-nowrap">Terziarie</th>
            <th className="text-right px-2 py-2 font-semibold whitespace-nowrap">Uscite CSS-C</th>
            <th className="text-right px-2 py-2 font-semibold whitespace-nowrap">Uscite Ferro</th>
            <th className="text-right px-2 py-2 font-semibold whitespace-nowrap">Dich. R3</th>
            <th className="text-right px-2 py-2 font-semibold whitespace-nowrap">Giacenza attuale</th>
            <th className="text-right px-2 py-2 font-semibold whitespace-nowrap">Conferito</th>
            <th className="text-right px-2 py-2 font-semibold whitespace-nowrap">Residuo</th>
          </tr>
        </thead>
        <tbody>
          {righe.map((r, i) => (
            <tr key={i} className={`border-b ${i % 2 ? 'bg-muted/20' : ''}`}>
              <td className="px-2 py-1.5 font-medium whitespace-nowrap">{r.sito}</td>
              <td className="px-2 py-1.5 text-center"><RuoloBadge td={r.tipo_destinazione} /></td>
              <td className="px-2 py-1.5 text-right tabular-nums">{fmt(r.target_primarie_t)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{r.target_totale_t > 0 ? fmt(r.target_totale_t) : '—'}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{fmt(r.giacenza_iniziale_t)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{fmt(r.conferito_primarie_t)}</td>
              <td className="px-2 py-1.5 text-right">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={`tabular-nums cursor-help ${r.secondarie_nette_t < 0 ? 'text-destructive' : ''}`}>{fmt(r.secondarie_nette_t)}</span>
                    </TooltipTrigger>
                    {r.secondarie_in_t > 0 && r.secondarie_out_t > 0 && (
                      <TooltipContent>in arrivo {fmt(r.secondarie_in_t)} t, in uscita {fmt(r.secondarie_out_t)} t</TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">{fmt(r.terziarie_t)}</td>
              <td className="px-2 py-1.5 text-right">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="tabular-nums cursor-help">{fmt(r.uscite_css_t)}</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>calcolata come dichiarato R1 meno terziarie</p>
                      {r.css_override_active && <p className="text-amber-600">valore corretto manualmente</p>}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">{fmt(r.uscite_ferro_t)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{fmt(r.dichiarato_r3_t)}</td>
              <td className="px-2 py-1.5 text-right">
                <span className={`tabular-nums font-bold ${r.giacenza_attuale_t < 0 ? 'text-destructive' : ''}`}>{fmt(r.giacenza_attuale_t)}</span>
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">{fmt(r.conferito_t)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{r.residuo_t != null && r.residuo_t !== 0 ? fmt(r.residuo_t) : '—'}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-muted font-bold sticky bottom-0">
          <tr>
            <td className="px-2 py-2">TOTALE</td>
            <td></td>
            <td className="px-2 py-2 text-right tabular-nums">{fmt(totali.target_primarie_t)}</td>
            <td className="px-2 py-2 text-right tabular-nums">{fmt(totali.target_totale_t)}</td>
            <td className="px-2 py-2 text-right tabular-nums">{fmt(totali.giacenza_iniziale_t)}</td>
            <td className="px-2 py-2 text-right tabular-nums">{fmt(totali.conferito_primarie_t)}</td>
            <td className="px-2 py-2 text-right tabular-nums">{fmt(totali.secondarie_nette_t)}</td>
            <td className="px-2 py-2 text-right tabular-nums">{fmt(totali.terziarie_t)}</td>
            <td className="px-2 py-2 text-right tabular-nums">{fmt(totali.uscite_css_t)}</td>
            <td className="px-2 py-2 text-right tabular-nums">{fmt(totali.uscite_ferro_t)}</td>
            <td className="px-2 py-2 text-right tabular-nums">{fmt(totali.dichiarato_r3_t)}</td>
            <td className="px-2 py-2 text-right tabular-nums">{fmt(totali.giacenza_attuale_t)}</td>
            <td className="px-2 py-2 text-right tabular-nums">{fmt(totali.conferito_t)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}