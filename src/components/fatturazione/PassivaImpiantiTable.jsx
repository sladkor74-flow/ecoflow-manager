import React from 'react';
import { formatNumber } from '@/lib/utils';

// Il "di cui" dice chi ha portato materialmente il carico al sito. Si mostra
// quando aggiunge qualcosa: se a conferire sono stati in piu' d'uno, oppure se
// l'unico conferente non e' il titolare del sito. Serve a rendere evidente che
// lo stoccaggio e il trattamento si pagano su tutto cio' che arriva - su Nappi
// Sud conferiscono anche altri raccoglitori, su Gatim conferisce anche Emmesse.
function conferentiDaMostrare(riga, fornitore) {
  const elenco = riga.di_cui || [];
  if (elenco.length > 1) return elenco;
  if (elenco.length === 1 && elenco[0].fornitore !== fornitore) return elenco;
  return [];
}

export default function PassivaImpiantiTable({ data }) {
  if (!data || data.length === 0) {
    return <div className="text-sm text-muted-foreground py-4 text-center">Nessun impianto/stoccaggio per questo periodo.</div>;
  }
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="px-3 py-2 font-semibold">Fornitore</th>
              <th className="px-3 py-2 font-semibold">Prestazione</th>
              <th className="px-3 py-2 font-semibold">Classe</th>
              <th className="px-3 py-2 font-semibold">Proven.</th>
              <th className="px-3 py-2 font-semibold text-right">Tonnellate</th>
              <th className="px-3 py-2 font-semibold text-right">Tariffa</th>
              <th className="px-3 py-2 font-semibold text-right">Importo €</th>
            </tr>
          </thead>
          <tbody>
            {data.map((f, fi) => (
              <React.Fragment key={fi}>
                {f.righe.map((r, ri) => (
                  <React.Fragment key={`${fi}-${ri}`}>
                    <tr className={`border-t ${ri === 0 ? 'bg-primary/5' : ''} ${f.interno ? 'italic text-muted-foreground' : ''}`}>
                      <td className="px-3 py-1.5">
                        {ri === 0 && <span className="font-semibold">{f.fornitore}</span>}
                        {ri === 0 && f.interno && <span className="ml-1 text-xs">(interno, non fatturato)</span>}
                      </td>
                      <td className="px-3 py-1.5">
                        {r.prestazione}
                        {r.compreso_nella_raccolta && (
                          <span className="ml-1.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                            prezzo unico
                          </span>
                        )}
                        {!r.compreso_nella_raccolta && r.note === 'senza tariffa' && (
                          <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                            senza tariffa
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5">{r.classe}</td>
                      <td className="px-3 py-1.5">{r.provenienza}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatNumber(r.tonnellate)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {r.tariffa_valore ? `${formatNumber(r.tariffa_valore)} ${r.unita_misura}` : '—'}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-medium">
                        {r.compreso_nella_raccolta
                          ? <span className="text-xs font-normal text-muted-foreground">già nella raccolta</span>
                          : formatNumber(r.importo, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                    {conferentiDaMostrare(r, f.fornitore).map((d, di) => (
                      <tr key={`${fi}-${ri}-dicui-${di}`} className="bg-muted/10 text-xs text-muted-foreground">
                        <td className="px-3 py-1 pl-8">di cui conferito da {d.fornitore}</td>
                        <td colSpan={3}></td>
                        <td className="px-3 py-1 text-right tabular-nums">{formatNumber(d.tonnellate)}</td>
                        <td className="px-3 py-1 text-right tabular-nums">{d.viaggi} viaggi</td>
                        <td></td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
                <tr className="border-t bg-muted/30 font-semibold">
                  <td className="px-3 py-1.5">Totale {f.fornitore}</td>
                  <td colSpan={3}></td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatNumber(f.totale_tonnellate)}</td>
                  <td></td>
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
