import React from 'react';
import { MESI, MESI_BREVI } from '@/lib/pfuConstants';
import { tonnellate, percentuale } from '@/lib/target';
import { sommaRighe, valoriAnno, impiantiDellAnno, DA_ASSEGNARE } from '@/lib/reportGeneraleVista';

// L'ANNO INTERO IN UNA TABELLA SOLA (05/10/2026).
//
// Chiesto dall'utente: «mi serve una panoramica che mi spieghi subito a colpo
// d'occhio l'andamento della raccolta», con raccoglitori, impianti e regioni in
// un unico schema. Il Report generale lo faceva un mese per volta; qui ci sono i
// dodici mesi affiancati, e sotto ogni raccoglitore gli impianti dove ha
// davvero portato, con il target ripartito secondo la regola scritta in
// reportGeneraleVista.js (dove e' arrivato il materiale il delta e' zero,
// l'ammanco resta all'impianto di riferimento).
//
// A colpo d'occhio vuol dire due cose: la striscia dei dodici mesi qui sopra la
// tabella, e il colore del delta dentro. Rosso = manca raccolta, verde = oltre il
// target.

const num = (v) => (v === null || v === undefined || v === 0 ? '—' : tonnellate(v));
const coloreDelta = (v) => (v > 0.0005 ? 'text-red-700 bg-red-50' : v < -0.0005 ? 'text-emerald-800 bg-emerald-50' : 'text-muted-foreground');

/** La striscia dei dodici mesi: una barra per mese, il target come tacca. */
function Striscia({ totale, anno, meseInCorso }) {
  const massimo = Math.max(...totale.mesi.map(m => Math.max(m.target, m.raccolto)), 1);
  return (
    <div className="border rounded-lg bg-card px-3 py-3">
      <div className="text-xs text-muted-foreground mb-2">
        L&apos;anno a colpo d&apos;occhio · barra piena = raccolto, tacca = target del mese · {anno}
      </div>
      <div className="flex items-end gap-1.5">
        {MESI_BREVI.map((m, i) => {
          const v = totale.mesi[i];
          const delta = v.target - v.raccolto;
          const hR = Math.round((v.raccolto / massimo) * 100);
          const hT = Math.round((v.target / massimo) * 100);
          const sotto = v.target > 0 && delta > 0.0005;
          return (
            <div key={m} className="flex-1 flex flex-col items-center gap-1" title={`${MESI[i]}: target ${tonnellate(v.target)} t, raccolto ${tonnellate(v.raccolto)} t`}>
              <div className="relative w-full h-20 bg-muted/40 rounded-sm overflow-hidden">
                <div
                  className={`absolute bottom-0 left-0 right-0 ${sotto ? 'bg-red-400' : v.raccolto > 0 ? 'bg-emerald-500' : ''}`}
                  style={{ height: `${hR}%` }}
                />
                {v.target > 0 && (
                  <div className="absolute left-0 right-0 border-t-2 border-foreground/70" style={{ bottom: `${hT}%` }} />
                )}
              </div>
              <div className="text-[10px] text-muted-foreground">{m}</div>
              <div className={`text-[10px] tabular-nums px-1 rounded ${coloreDelta(delta)}`}>
                {v.target || v.raccolto ? tonnellate(delta) : '—'}
              </div>
              {/* Il mese in corso e' quasi tutto da fare: senza dirlo, il suo
                  delta sembra un ammanco grande quanto il mese. */}
              {i === meseInCorso && <div className="text-[9px] text-muted-foreground">in corso</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Le dodici terzine T/R/Δ di una riga, piu' i totali dell'anno. */
function CelleAnno({ r, vista, forte }) {
  const v = valoriAnno(r);
  const c = forte ? 'font-semibold' : '';
  return (
    <>
      {r.mesi.map((m, i) => {
        const delta = Math.round((m.target - m.raccolto) * 1000) / 1000;
        return (
          <React.Fragment key={i}>
            {vista !== 'raccolto' && vista !== 'delta' && <td className={`px-1.5 py-1 text-right tabular-nums text-muted-foreground ${c}`}>{num(m.target)}</td>}
            {vista !== 'delta' && <td className={`px-1.5 py-1 text-right tabular-nums ${c}`}>{num(m.raccolto)}</td>}
            {vista !== 'raccolto' && (
              <td className={`px-1.5 py-1 text-right tabular-nums ${coloreDelta(delta)} ${c}`}>
                {m.target || m.raccolto ? tonnellate(delta) : '—'}
              </td>
            )}
          </React.Fragment>
        );
      })}
      <td className={`px-2 py-1 text-right tabular-nums border-l text-muted-foreground ${c}`}>{num(v.annuo || v.target)}</td>
      <td className={`px-2 py-1 text-right tabular-nums ${c}`}>{num(v.raccolto)}</td>
      <td className={`px-2 py-1 text-right tabular-nums ${coloreDelta(v.delta)} ${c}`}>{v.target || v.raccolto ? tonnellate(v.delta) : '—'}</td>
      <td className={`px-2 py-1 ${c}`}>
        {v.percentualeAnnuo === null ? <span className="text-muted-foreground">—</span> : (
          <div className="flex items-center gap-1.5 min-w-[84px]">
            <span className="text-[11px] tabular-nums w-11 text-right">{percentuale(v.percentualeAnnuo)}%</span>
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${v.percentualeAnnuo > 100 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(v.percentualeAnnuo, 100)}%` }} />
            </div>
          </div>
        )}
      </td>
    </>
  );
}

export default function ReportGeneraleAnno({ anno, gruppi, righe, dettaglio, vista, meseInCorso = -1 }) {
  const totale = sommaRighe(righe);
  const colonneMese = vista === 'tutto' ? 3 : vista === 'delta' ? 1 : 2;

  return (
    <div className="space-y-3">
      <Striscia totale={totale} anno={anno} meseInCorso={meseInCorso} />
      <div className="border rounded-lg overflow-x-auto bg-card">
        <table className="text-xs whitespace-nowrap border-collapse w-full">
          <thead className="bg-muted/60">
            <tr>
              <th className="px-2 py-2 text-left min-w-[240px]">Regione / raccoglitore / impianto</th>
              {MESI_BREVI.map((m, i) => (
                <th key={m} className="px-1 py-1 text-center font-medium border-l" colSpan={colonneMese} title={`${MESI[i]} ${anno}`}>{m}</th>
              ))}
              <th className="px-2 py-1 text-center font-medium border-l" colSpan={3}>Anno</th>
              <th className="px-2 py-1 text-center font-medium">% del target</th>
            </tr>
            <tr className="bg-muted/60 border-t">
              <th />
              {MESI_BREVI.map(m => (
                <React.Fragment key={m}>
                  {vista === 'tutto' && <th className="px-1 py-0.5 text-right text-[10px] font-normal text-muted-foreground border-l">T</th>}
                  {vista !== 'delta' && <th className={`px-1 py-0.5 text-right text-[10px] font-normal text-muted-foreground ${vista === 'raccolto' ? 'border-l' : ''}`}>R</th>}
                  {vista !== 'raccolto' && <th className={`px-1 py-0.5 text-right text-[10px] font-normal text-muted-foreground ${vista === 'delta' ? 'border-l' : ''}`}>Δ</th>}
                </React.Fragment>
              ))}
              <th className="px-2 py-0.5 text-right text-[10px] font-normal text-muted-foreground border-l">Target</th>
              <th className="px-2 py-0.5 text-right text-[10px] font-normal text-muted-foreground">Raccolto</th>
              <th className="px-2 py-0.5 text-right text-[10px] font-normal text-muted-foreground">Δ</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {gruppi.map(g => (
              <React.Fragment key={g.regione}>
                <tr className="border-t-2 bg-primary/5">
                  <td className="px-2 py-1.5 font-semibold">{g.regione || 'Regione non indicata'}</td>
                  <CelleAnno r={sommaRighe(g.righe)} vista={vista} forte />
                </tr>
                {g.righe.map(r => (
                  <React.Fragment key={`${r.regione}|${r.kRaccoglitore}`}>
                    <tr className="border-t hover:bg-muted/30">
                      <td className="px-2 py-1.5 pl-5">
                        {r.raccoglitore}
                        {!r.conTarget && <span className="ml-2 text-[10px] rounded bg-amber-100 text-amber-800 px-1.5 py-0.5">senza target</span>}
                      </td>
                      <CelleAnno r={r} vista={vista} />
                    </tr>
                    {dettaglio && impiantiDellAnno(r).map(i => (
                      <tr key={`${r.kRaccoglitore}|${i.k}`} className="text-[11px] text-muted-foreground">
                        <td className="px-2 py-0.5 pl-10">
                          → {i.impianto === DA_ASSEGNARE ? <span className="text-amber-700">quota da assegnare</span> : i.impianto}
                          {i.stimato && <span className="ml-1.5 text-[10px] text-amber-700" title="Il target di un mese senza conferimenti e' una previsione: e' dove questo raccoglitore porta oggi, non un impegno">previsto</span>}
                        </td>
                        <CelleAnno r={i} vista={vista} />
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </React.Fragment>
            ))}
            <tr className="border-t-2 bg-muted/60 font-semibold">
              <td className="px-2 py-2">Totale complessivo</td>
              <CelleAnno r={totale} vista={vista} forte />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
