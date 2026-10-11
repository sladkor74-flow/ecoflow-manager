import React from 'react';
import { Truck, Factory, Recycle, Target } from 'lucide-react';
import { formatNumber, formatIntero, fmtTon } from '@/lib/utils';
import { RiepilogoDate } from '@/components/primarie-rete/DateDaSistemare';

const fmtPct = (v) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? '—' : formatNumber(v, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%');
const giornoMese = (g) => (g ? `${g.slice(8, 10)}/${g.slice(5, 7)}` : '');

// IL TARGET DICE SE SIAMO IN LINEA, NON SOLO QUANTO MANCA (chiusura dell'audit,
// 11/10/2026). «76,4%» e «8.818,55 t su 11.550,00 t» non dicevano se fosse buono
// o cattivo: la card dice anche l'atteso a quella data, sui giorni coperti dai
// dati e col profilo mensile del contratto (getDashboardRaccolta, la stessa
// regola di Target & Status), e lo scarto, col colore dello scarto. Un anno
// senza contratto non ha target: «—» e il motivo, mai «0%» o «su 0 t». Un
// target copiato dall'anno prima si dice copiato, da confermare.
function cardTarget(kpi) {
  if (kpi.target === null || kpi.target === undefined) {
    return { value: '—', subtitle: `${fmtTon(kpi.raccolto_rete_anno)} raccolte · contratto non inserito`, colore: 'text-primary bg-primary/10' };
  }
  const a = kpi.atteso;
  const extra = [];
  if (kpi.target_da_confermare && kpi.target_da_confermare.length) extra.push('copiato, da confermare');
  if (kpi.target_ripiego && kpi.target_ripiego.length) extra.push('target di ripiego');
  return {
    value: fmtPct(kpi.raggiungimento_pct),
    subtitle: `dell'anno: ${fmtTon(kpi.raccolto_rete_anno)} su ${fmtTon(kpi.target)}${extra.length ? ` (${extra.join(', ')})` : ''}`,
    atteso: a ? `atteso al ${giornoMese(a.giorno)}: ${fmtPct(a.pct)} · scarto ${a.scarto_t >= 0 ? '+' : ''}${fmtTon(a.scarto_t)}` : null,
    attesoColore: a ? (a.scarto_t >= 0 ? 'text-emerald-700' : 'text-red-600') : '',
    colore: !a ? 'text-primary bg-primary/10' : a.scarto_t >= 0 ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50',
  };
}

// Regola 1: un terminato senza fine trasporto non ha periodo e resta fuori da
// questi numeri, ma si conta e si dice. Un canale per volta, solo chi ne ha, mai
// un totale dei tre (getDashboardRaccolta, senza_fine_trasporto).
// Dal 22/09/2026 si dicono tutte le date obbligatorie che mancano o non tornano
// (date_da_sistemare, una riga per canale); i soli senza fine trasporto restano
// per una risposta di prima.
const CANALI_SENZA_FINE = [['rete', 'Rete'], ['aci', 'ACI'], ['extra', 'Extra Raccolta']];

export default function DashboardKpi({ kpi, senzaFine, dateDaSistemare, avvisiTarget = [], loading }) {
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
  const t = cardTarget(kpi);
  const cards = [
    { label: 'Raccolta RETE', value: fmtTon(kpi.raccolta_rete), icon: Truck, color: 'text-green-600 bg-green-50', subtitle: `nell'anno ${fmtTon(kpi.raccolto_rete_anno)}` },
    { label: 'Raccolta ACI', value: fmtTon(kpi.raccolta_aci), icon: Factory, color: 'text-amber-600 bg-amber-50', subtitle: kpi.previsione_aci ? `nell'anno ${fmtTon(kpi.raccolto_aci_anno)} su previsione indicativa ${fmtTon(kpi.previsione_aci)}` : `nell'anno ${fmtTon(kpi.raccolto_aci_anno)}` },
    { label: 'Extra Raccolta', value: fmtTon(kpi.raccolta_extra), icon: Recycle, color: 'text-blue-600 bg-blue-50', subtitle: `terminati, nell'anno ${fmtTon(kpi.raccolto_extra_anno)}` },
    { label: 'Target RETE del contratto', value: t.value, icon: Target, color: t.colore, subtitle: t.subtitle, riga2: t.atteso, riga2Colore: t.attesoColore },
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
              {c.riga2 && <p className={`text-xs font-medium mt-0.5 ${c.riga2Colore}`}>{c.riga2}</p>}
            </div>
          );
        })}
      </div>
      {avvisiTarget.length > 0 && (
        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 space-y-0.5">
          {avvisiTarget.map(a => <p key={a}>{a}</p>)}
        </div>
      )}
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