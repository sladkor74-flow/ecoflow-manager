import React from 'react';
import { formatNumber } from '@/lib/utils';
import { testoEuroT } from '@/lib/surplus';
import { EtichettaSurplus, OrigineSurplus, RIGA_SURPLUS, TonnellateSurplus, TotaleStandardSurplus } from './PassivaSurplus';

// Il surplus sulle tariffe (13/10/2026): sotto le righe standard di ogni
// fornitore e prima del suo totale, una riga per surplus (il Fuel Surcharge del
// consorzio Ecotyre), sulle stesse tonnellate del mese. Il totale del fornitore
// in tonnellate resta quello delle righe; in euro comprende il surplus, e sotto
// si legge come si compone. Un interno non ha la riga: a se stessi non si fattura.
export default function PassivaRaccoglitoriTable({ data }) {
  if (!data || data.length === 0) {
    return <div className="text-sm text-muted-foreground py-4 text-center">Nessun raccoglitore per questo periodo.</div>;
  }
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="px-3 py-2 font-semibold">Fornitore</th>
              <th className="px-3 py-2 font-semibold">Destinazione</th>
              <th className="px-3 py-2 font-semibold text-right">Tonnellate</th>
              <th className="px-3 py-2 font-semibold text-right">Viaggi</th>
              <th className="px-3 py-2 font-semibold text-right">Tariffa</th>
              <th className="px-3 py-2 font-semibold text-right">Importo €</th>
              <th className="px-3 py-2 font-semibold">Dettaglio</th>
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
                    <td className="px-3 py-1.5">{r.destinazione !== '—' ? r.destinazione : ''}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{formatNumber(r.tonnellate)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{r.viaggi}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {r.tariffa_valore ? `${formatNumber(r.tariffa_valore)} ${r.unita_misura}` : '—'}
                      {r.tariffa_criterio === 'destinazione' && <span className="ml-1 text-[10px] font-normal text-primary" title="Tariffa specifica per questa destinazione, come da contratto">per dest.</span>}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-medium">
                      {formatNumber(r.importo, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      {/* Con un sovracosto l'importo non e' piu' tariffa per peso: si
                          dice quanto di quell'importo e' sovracosto, altrimenti la
                          moltiplicazione che si vede accanto sembra sbagliata. */}
                      {r.sovracosto_euro > 0 && (
                        <div className="text-[10px] font-normal text-muted-foreground">
                          di cui {formatNumber(r.sovracosto_euro, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € di sovracosto
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-xs text-muted-foreground">
                      {r.provincia !== '—' && `Prov: ${r.provincia} `}
                      {r.destinazione !== '—' && `Dest: ${r.destinazione} `}
                      {r.classe !== '—' && `Classe: ${r.classe}`}
                      {r.note && <span className={r.nota_informativa ? '' : 'text-destructive'}> {r.note}</span>}
                      {r.sovracosto_motivo && <span className="block">Motivo del sovracosto: {r.sovracosto_motivo}</span>}
                    </td>
                  </tr>
                ))}
                {(f.surplus || []).map((s, si) => (
                  <tr key={`${fi}-surplus-${si}`} className={RIGA_SURPLUS}>
                    <td className="px-3 py-1.5"><EtichettaSurplus s={s} /></td>
                    <td className="px-3 py-1.5"><OrigineSurplus s={s} /></td>
                    <td className="px-3 py-1.5 text-right"><TonnellateSurplus t={s.tonnellate} /></td>
                    <td className="px-3 py-1.5 text-right text-muted-foreground" title="Il surplus è a tonnellata">—</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{testoEuroT(s.euro_t)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-medium">{formatNumber(s.importo, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-3 py-1.5 text-xs text-muted-foreground">sulle stesse tonnellate del mese</td>
                  </tr>
                ))}
                <tr className="border-t bg-muted/30 font-semibold">
                  <td className="px-3 py-1.5">Totale {f.fornitore}</td>
                  <td></td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatNumber(f.totale_tonnellate)}</td>
                  <td colSpan={2}></td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {formatNumber(f.totale_euro, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    <TotaleStandardSurplus f={f} />
                  </td>
                  <td></td>
                </tr>
                {/* Le tonnellate di un subraccoglitore sono già dentro il totale
                    del fornitore che le fattura: qui si dice solo quante sono. */}
                {(f.di_cui || []).map((d, di) => (
                  <tr key={`${fi}-dicui-${di}`} className="bg-muted/10 text-xs text-muted-foreground">
                    <td className="px-3 py-1 pl-8">di cui {d.fornitore}</td>
                    <td></td>
                    <td className="px-3 py-1 text-right tabular-nums">{formatNumber(d.tonnellate)}</td>
                    <td className="px-3 py-1 text-right tabular-nums">{d.viaggi}</td>
                    <td colSpan={2}></td>
                    <td className="px-3 py-1">subraccoglitore, fatturato da {f.fornitore}</td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}