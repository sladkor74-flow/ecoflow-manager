import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { formatIntero } from '@/lib/utils';

// I tempi arrivano gia' calcolati da computeSlaMetrics (primarieReteAnalytics.ts):
// dall'immissione dell'ordine alla fine del trasporto, mai alla chiusura a portale.
// Qui si dice a parole cosa misurano, di quale anno, e quanti terminati non si
// sono potuti misurare.
export default function SlaMetrics({ data, anniFiltro = [] }) {
  if (!data) return null;

  const { trasportatori, totale_ordini, avg_giorni, pct_nei_tempi_globale } = data;
  // una risposta della funzione precedente non ha il dato contato
  const pctDopoScadenza = data.pct_dopo_scadenza_globale ?? (100 - pct_nei_tempi_globale);
  const nonMisurati = data.non_misurati;
  const quantiNonMisurati = nonMisurati
    ? (nonMisurati.senza_fine_trasporto || 0) + (nonMisurati.senza_immissione || 0) + (nonMisurati.date_incoerenti || 0)
    : 0;
  // I tempi si misurano su un anno alla volta: con piu' anni scelti nel filtro
  // la scheda resta sull'anno in corso, e va detto invece di lasciarlo credere.
  const annoIgnorato = anniFiltro.length > 1;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Giorni dall'immissione dell'ordine alla fine del trasporto, sul giorno italiano, per i ritiri terminati con fine trasporto {data.anno ? `nel ${data.anno}` : 'nell\'anno in corso'}. Un ritiro è nei tempi se il trasporto finisce entro 30 giorni dall'immissione. La chiusura dell'ordine a portale non conta.
        {annoIgnorato && <> I tempi si misurano un anno alla volta: per un altro anno sceglierne uno solo nel filtro.</>}
      </p>
      {quantiNonMisurati > 0 && (
        <div className="border border-amber-300 bg-amber-50 text-amber-900 rounded-lg px-3 py-2 text-sm">
          {formatIntero(quantiNonMisurati)} {quantiNonMisurati === 1 ? 'ordine terminato non è stato misurato' : 'ordini terminati non sono stati misurati'}
          {nonMisurati.senza_fine_trasporto > 0 && <> · {formatIntero(nonMisurati.senza_fine_trasporto)} senza fine trasporto</>}
          {nonMisurati.senza_immissione > 0 && <> · {formatIntero(nonMisurati.senza_immissione)} senza data di immissione</>}
          {nonMisurati.date_incoerenti > 0 && <> · {formatIntero(nonMisurati.date_incoerenti)} con la fine trasporto prima dell'immissione</>}
          {nonMisurati.esempi?.length > 0 && <> (es. {nonMisurati.esempi.join(', ')})</>}
          : {quantiNonMisurati === 1 ? 'resta fuori' : 'restano fuori'} dai tempi finché le date non si correggono a portale.
        </div>
      )}
      {/* KPI summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="border rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Ordini misurati{data.anno ? ` nel ${data.anno}` : ''}</p>
          <p className="text-xl font-heading font-bold">{formatIntero(totale_ordini)}</p>
        </div>
        <div className="border rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Nr Giorni medio</p>
          <p className={`text-xl font-heading font-bold ${avg_giorni > 12 ? 'text-red-600' : avg_giorni > 10 ? 'text-amber-600' : ''}`}>
            {avg_giorni.toFixed(1)}
          </p>
        </div>
        <div className="border rounded-lg p-3">
          <p className="text-xs text-muted-foreground">% Nei tempi</p>
          <p className="text-xl font-heading font-bold text-green-600">{pct_nei_tempi_globale.toFixed(1)}%</p>
        </div>
        <div className="border rounded-lg p-3">
          <p className="text-xs text-muted-foreground">% Dopo scadenza</p>
          <p className="text-xl font-heading font-bold text-red-600">{pctDopoScadenza.toFixed(1)}%</p>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-3 py-2 font-heading font-semibold">Trasportatore</th>
              <th className="text-right px-3 py-2 font-heading font-semibold">Ordini</th>
              <th className="text-right px-3 py-2 font-heading font-semibold">Nr Giorni medio</th>
              <th className="text-right px-3 py-2 font-heading font-semibold">% Nei tempi</th>
              <th className="text-right px-3 py-2 font-heading font-semibold">% Dopo scad.</th>
              <th className="text-right px-3 py-2 font-heading font-semibold">Oltre 10 gg</th>
              <th className="text-right px-3 py-2 font-heading font-semibold">Oltre 12 gg</th>
              <th className="text-center px-3 py-2 font-heading font-semibold">Stato</th>
            </tr>
          </thead>
          <tbody>
            {trasportatori.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-8 text-muted-foreground">Nessun dato disponibile.</td>
              </tr>
            )}
            {trasportatori.map((t, idx) => (
              <tr key={t.trasportatore} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                <td className="px-3 py-2 font-medium">{t.trasportatore}</td>
                <td className="px-3 py-2 text-right">{t.totale}</td>
                <td className={`px-3 py-2 text-right font-medium ${t.nr_giorni_medio > 12 ? 'text-red-600' : t.nr_giorni_medio > 10 ? 'text-amber-600' : ''}`}>
                  {t.nr_giorni_medio.toFixed(1)}
                </td>
                <td className="px-3 py-2 text-right text-green-600">{t.pct_nei_tempi.toFixed(1)}%</td>
                <td className={`px-3 py-2 text-right ${t.pct_dopo_scadenza > 20 ? 'text-red-600 font-medium' : ''}`}>
                  {t.pct_dopo_scadenza.toFixed(1)}%
                </td>
                <td className="px-3 py-2 text-right">{t.oltre_10gg}</td>
                <td className="px-3 py-2 text-right text-red-600">{t.oltre_12gg}</td>
                <td className="text-center px-3 py-2">
                  {t.has_sla_critical ? (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">
                      <AlertTriangle className="w-3 h-3" /> Critico
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 border border-green-200">
                      <CheckCircle2 className="w-3 h-3" /> OK
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}