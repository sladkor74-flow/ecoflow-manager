import React from 'react';
import { formatNumber } from '@/lib/utils';

// Un viaggio di secondaria puo' portare insieme formulari di rete e formulari
// ACI. La tabella mostra le tonnellate del canale che si sta guardando: quelle
// dell'altro, sugli stessi viaggi misti, restano accanto, dichiarate, ma non
// entrano nel totale - i canali non si sommano mai. A prezzo per viaggio un
// viaggio misto si divide fra i due canali in proporzione ai chili (regola
// dell'utente del 22/09/2026): sotto i viaggi si legge quanti sono misti e la
// quota pagata qui, e la nota della riga spiega il conto. Se l'altro canale non
// ha una tariffa per la tratta, la sua quota dei misti non la paga nessuno: la
// nota lo dice in ambra, con l'importo (altro_canale_da_pagare).
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
                      {r.viaggio_misto && <span className="ml-1.5 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded" title="Lo stesso viaggio porta formulari di rete e formulari ACI: ogni canale paga la sua parte, in proporzione ai chili">viaggio misto</span>}
                      {r.trasportatore && r.trasportatore !== f.fornitore && (
                        <div className="text-[11px] text-muted-foreground">guidato da {r.trasportatore}</div>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {formatNumber(r.tonnellate)}
                      {r.tonnellate_altro_canale > 0 && (
                        <div className="text-[11px] font-normal text-muted-foreground">
                          {formatNumber(r.tonnellate_altro_canale)} t {r.canale_altro} sugli stessi viaggi, fuori da questo canale
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {r.viaggi}
                      {r.viaggi_misti > 0 && (
                        <div className="text-[11px] font-normal text-muted-foreground">
                          di cui {r.viaggi_misti} {r.viaggi_misti === 1 ? 'misto' : 'misti'}
                          {r.unita_misura === '€/viaggio' && !f.interno && <> · pagati {formatNumber(r.viaggi_quota, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {r.tariffa_valore ? `${formatNumber(r.tariffa_valore)} ${r.unita_misura}` : '—'}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-medium">
                      {formatNumber(r.importo, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      {r.note && <div className={`text-xs font-normal ${r.nota_informativa ? 'text-muted-foreground max-w-xs ml-auto' : r.altro_canale_da_pagare ? 'text-amber-700 max-w-xs ml-auto' : 'text-destructive'}`}>{r.note}</div>}
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
