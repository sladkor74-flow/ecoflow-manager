import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { MESI, meseCorrente } from '@/lib/pfuConstants';
import { formatNumber } from '@/lib/utils';

export default function TargetDashboard() {
  const currentMonth = useMemo(() => meseCorrente(), []);
  const [mese, setMese] = useState(currentMonth);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('getTargetDashboard', { mese });
      setData(res.data);
    } catch (e) { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, [mese]);

  const regioni = data?.regioni || [];
  const totals = data?.totals || {};

  const maxKg = useMemo(() => {
    if (regioni.length === 0) return 1;
    return Math.max(...regioni.flatMap((r) => [r.rete_kg, r.aci_kg, r.totale_kg]), 1);
  }, [regioni]);

  const maxTarget = useMemo(() => {
    if (regioni.length === 0) return 1;
    return Math.max(...regioni.map((r) => Math.max(r.target_t, r.raccolto_t / 1000)), 1);
  }, [regioni]);

  return (
    <div className="space-y-6">
      {/* Selettore mese */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Mese:</label>
        <select
          value={mese}
          onChange={(e) => setMese(e.target.value)}
          className="text-sm border rounded-md px-3 py-1.5 bg-background"
        >
          <option value="">Tutto l'anno</option>
          {MESI.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin inline text-muted-foreground" /></div>
      ) : regioni.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          Nessun dato disponibile per {mese}. Carica i file delle primarie RETE e ACI.
        </div>
      ) : (
        <>
          {/* KPI riepilogo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Raccolta RETE" value={`${formatNumber(totals.rete_kg / 1000)} t`} color="text-green-600 bg-green-50" />
            <KpiCard label="Raccolta ACI" value={`${formatNumber(totals.aci_kg / 1000)} t`} color="text-amber-600 bg-amber-50" />
            <KpiCard label="Totale Raccolto" value={`${formatNumber(totals.totale_kg / 1000)} t`} color="text-blue-600 bg-blue-50" />
            <KpiCard
              label="Raggiungimento Target"
              value={`${formatNumber(totals.raggiungimento, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}%`}
              color={totals.raggiungimento >= 100 ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}
              icon={totals.raggiungimento >= 100 ? TrendingUp : TrendingDown}
            />
          </div>

          {/* Grafico RETE vs ACI per regione */}
          <div className="border rounded-lg p-4">
            <h3 className="font-heading font-semibold mb-1">Raccolta RETE vs ACI per Regione</h3>
            <p className="text-xs text-muted-foreground mb-4">Confronto dei kg raccolti per tipologia — {mese}</p>
            <div className="space-y-2.5">
              {regioni.map((r) => (
                <div key={r.regione} className="grid grid-cols-[100px_1fr] items-center gap-2">
                  <span className="text-xs font-medium truncate" title={r.regione}>{r.regione}</span>
                  <div className="space-y-1">
                    {/* Barra RETE */}
                    <div className="relative h-5 bg-green-50 rounded-sm overflow-hidden">
                      <div
                        className="absolute top-0 left-0 h-full bg-green-500 rounded-sm transition-all"
                        style={{ width: `${(r.rete_kg / maxKg) * 100}%` }}
                      />
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold tabular-nums text-green-900">
                        {formatNumber(r.rete_kg / 1000)} t
                      </span>
                    </div>
                    {/* Barra ACI */}
                    <div className="relative h-5 bg-amber-50 rounded-sm overflow-hidden">
                      <div
                        className="absolute top-0 left-0 h-full bg-amber-500 rounded-sm transition-all"
                        style={{ width: `${(r.aci_kg / maxKg) * 100}%` }}
                      />
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold tabular-nums text-amber-900">
                        {formatNumber(r.aci_kg / 1000)} t
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-4 text-xs">
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-green-500 rounded-sm" /> RETE</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-amber-500 rounded-sm" /> ACI</div>
            </div>
          </div>

          {/* Grafico Target vs Raccolto per regione */}
          <div className="border rounded-lg p-4">
            <h3 className="font-heading font-semibold mb-1">Target vs Raccolto per Regione</h3>
            <p className="text-xs text-muted-foreground mb-4">Raggiungimento target mensile (ton) — {mese}</p>
            <div className="space-y-2.5">
              {regioni.map((r) => (
                <div key={r.regione} className="grid grid-cols-[100px_1fr] items-center gap-2">
                  <span className="text-xs font-medium truncate" title={r.regione}>{r.regione}</span>
                  <div className="space-y-1">
                    <div className="relative h-5 bg-blue-50 rounded-sm overflow-hidden">
                      <div
                        className="absolute top-0 left-0 h-full bg-blue-300 rounded-sm transition-all"
                        style={{ width: `${(r.target_t / maxTarget) * 100}%` }}
                      />
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold tabular-nums text-blue-900">
                        {formatNumber(r.target_t)} t
                      </span>
                    </div>
                    <div className="relative h-5 bg-muted rounded-sm overflow-hidden">
                      <div
                        className={`absolute top-0 left-0 h-full rounded-sm transition-all ${r.raggiungimento >= 100 ? 'bg-green-500' : 'bg-orange-400'}`}
                        style={{ width: `${(r.totale_kg / 1000 / maxTarget) * 100}%` }}
                      />
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold tabular-nums">
                        {formatNumber(r.totale_kg / 1000)} t ({formatNumber(r.raggiungimento, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}%)
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-4 text-xs">
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-blue-300 rounded-sm" /> Target</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-green-500 rounded-sm" /> Raccolto (≥100%)</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-orange-400 rounded-sm" /> Raccolto (&lt;100%)</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value, color, icon: Icon }) {
  return (
    <div className="border rounded-lg p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        {Icon && (
          <span className={`inline-flex p-1 rounded ${color}`}>
            <Icon className="w-3.5 h-3.5" />
          </span>
        )}
      </div>
      <p className="text-xl font-heading font-bold tabular-nums">{value}</p>
    </div>
  );
}