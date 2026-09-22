import React from 'react';
import { Truck, Factory, Recycle, Target } from 'lucide-react';
import { formatNumber, formatIntero, fmtTon } from '@/lib/utils';
import { RiepilogoDate } from '@/components/primarie-rete/DateDaSistemare';

const fmtPct = (v) => formatNumber(v, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';

// Regola 1: un terminato senza fine trasporto non ha periodo e resta fuori da
// questi numeri, ma si conta e si dice. Un canale per volta, solo chi ne ha, mai
// un totale dei tre (getDashboardRaccolta, senza_fine_trasporto).
// Dal 22/09/2026 si dicono tutte le date obbligatorie che mancano o non tornano
// (date_da_sistemare, una riga per canale); i soli senza fine trasporto restano
// per una risposta di prima.
const CANALI_SENZA_FINE = [['rete', 'Rete'], ['aci', 'ACI'], ['extra', 'Extra Raccolta']];

export default function DashboardKpi({ kpi, senzaFine, dateDaSistemare, loading }) {
  if (loading || !kpi) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="border rounded-lg p-4 animate-pulse bg-muted/30 h-28" />
        ))}
      </div>
    );
  }

  // RETE, ACI ed EXTRA RACCOLTA sono canali indipendenti: nessun totale che li
  // sommi; il target del contratto riguarda solo la RETE.
  const cards = [
    { label: 'Raccolta RETE', value: fmtTon(kpi.raccolta_rete), icon: Truck, color: 'text-green-600 bg-green-50', subtitle: `nell'anno ${fmtTon(kpi.raccolto_rete_anno)}` },
    { label: 'Raccolta ACI', value: fmtTon(kpi.raccolta_aci), icon: Factory, color: 'text-amber-600 bg-amber-50', subtitle: kpi.previsione_aci ? `nell'anno ${fmtTon(kpi.raccolto_aci_anno)} su previsione indicativa ${fmtTon(kpi.previsione_aci)}` : `nell'anno ${fmtTon(kpi.raccolto_aci_anno)}` },
    { label: 'Extra Raccolta', value: fmtTon(kpi.raccolta_extra), icon: Recycle, color: 'text-blue-600 bg-blue-50', subtitle: `terminati, nell'anno ${fmtTon(kpi.raccolto_extra_anno)}` },
    { label: 'Target RETE del contratto', value: fmtPct(kpi.raggiungimento_pct), icon: Target, color: 'text-primary bg-primary/10', subtitle: `${fmtTon(kpi.raccolto_rete_anno)} su ${fmtTon(kpi.target)}` },
  ];
  const esclusi = dateDaSistemare ? [] : CANALI_SENZA_FINE.filter(([k]) => senzaFine && Number(senzaFine[k]) > 0)
    .map(([k, nome]) => `${nome} ${formatIntero(senzaFine[k])}`);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="border rounded-lg p-4">
              <div className={`inline-flex p-2 rounded-md mb-3 ${c.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-2xl font-heading font-bold">{c.value}</p>
              <p className="text-sm text-muted-foreground">{c.label}</p>
              {c.subtitle && <p className="text-xs text-muted-foreground mt-0.5">{c.subtitle}</p>}
            </div>
          );
        })}
      </div>
      {dateDaSistemare && CANALI_SENZA_FINE.map(([k, nome]) => (
        <RiepilogoDate
          key={k}
          canale={nome}
          riepilogo={dateDaSistemare[k]}
          nomi={k === 'extra' ? ['intervento terminato', 'interventi terminati'] : ['ritiro terminato', 'ritiri terminati']}
          nota={k === 'extra' ? 'Si correggono nel modulo Extra Raccolta.' : 'Si correggono sul portale e si ricarica il file.'}
        />
      ))}
      {esclusi.length > 0 && (
        <p className="text-xs text-amber-700" title="La data di fine trasporto va inserita sul portale, o nel modulo Extra Raccolta">
          Terminati esclusi perché senza fine trasporto (qualunque anno): {esclusi.join(' · ')}
        </p>
      )}
    </div>
  );
}