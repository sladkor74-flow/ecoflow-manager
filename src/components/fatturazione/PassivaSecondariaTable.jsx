import React from 'react';
import { formatNumber } from '@/lib/utils';

// Un viaggio di secondaria puo' portare insieme formulari di rete e formulari
// ACI. La tabella mostra le tonnellate del canale che si sta guardando: quelle
// dell'altro restano accanto, dichiarate, ma non entrano nel totale - i canali
// non si sommano mai.
export default function PassivaSecondariaTable({ data, tipologia }) {
  if (!data || data.length === 0) {
    return <div className="text-sm text-muted-foreground py-4 text-center">Nessun trasporto secondaria per questo periodo.</div>;
  }
  const canale = tipologia === 'ACI' ? 'ACI' : 'RETE';
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="px-3 py-2 font-semibold">Trasportatore</th>
              <th className="px-3 py-2 font-semibold">Tratta (stoccaggio → destinazione)</th>
              <th className="px-3 py-2 font-semibold text-right">Tonn. {canale}</th>
              <th className="px-3 py-2 font-semibold text-right">Viaggi</th>
              <th className="px-3 py-2 font-semibold text-right">Tariffa</th>
              <th className="px-3 py-2 font-semibold text-right">Importo €</th>
            </tr>
          </thead>
          <tbody>
            {data.map((f, fi) => (
              <React.Fragment key={fi}>
                {f.righe.map((r, ri) => (
                  <tr key={`${fi}-${ri}`} className={`border-t ${ri === 0 ? 'bg-primary/5' : ''} ${f.interno ? 'italic text-muted-foreground' : ''}`}>
                    <td className="px-3 py-1.5">
                      {ri === 0 && <span className="font-semibold">{f.fornitore}</span>}
                      {ri === 0 && f.interno && <span className="ml-1 text-xs">(interno, non fatturato)</span>}
                    </td>
                    <td className="px-3 py-1.5">
                      {r.stoccaggio} → {r.destinazione}
                      {r.viaggio_misto && <span className="ml-1.5 text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded dark:bg-amber-900/40 dark:text-amber-200">viaggio misto</span>}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {formatNumber(r.tonnellate)}
                      {r.tonnellate_altro_canale > 0 && (
                        <div className="text-[11px] font-normal text-muted-foreground">
                          + {formatNumber(r.tonnellate_altro_canale)} t {r.canale_altro}, fuori da questo canale
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{r.viaggi}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {r.tariffa_valore ? `${formatNumber(r.tariffa_valore)} ${r.unita_misura}` : '—'}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-medium">
                      {formatNumber(r.importo, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      {r.note && <div className="text-xs text-destructive font-normal">{r.note}</div>}
                    </td>
                  </tr>
                ))}
                <tr className="border-t bg-muted/30 font-semibold">
                  <td className="px-3 py-1.5">Totale {f.fornitore}</td>
                  <td></td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatNumber(f.totale_tonnellate)} t</td>
                  <td colSpan={2}></td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatNumber(f.totale_euro, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
