import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, TrendingUp, FileText, AlertTriangle, ArrowRight } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

export default function RiepilogoEcotyre({ periodo, onAnomalieChange, onVaiTariffe }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('getRiepilogoEcotyre', { anno: periodo.anno, mese: periodo.mese });
      setData(res.data);
      if (onAnomalieChange) onAnomalieChange(res.data?.anomalie || []);
    } catch (e) {
      console.error(e);
      if (onAnomalieChange) onAnomalieChange([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [periodo.anno, periodo.mese]);

  if (loading) {
    return <div className="flex items-center justify-center py-6 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Calcolo riepilogo...</div>;
  }

  if (!data) return null;

  const tipologie = data.tipologie || [];
  const anomalie = data.anomalie || [];
  const tonnSenzaPrezzo = anomalie.reduce((s, a) => s + (a.tonnellate || 0), 0);

  function renderBadge(badge) {
    if (!badge) return null;
    if (badge.tipo === 'uniforme') {
      return <span className="text-xs text-muted-foreground">{badge.valore} {badge.unita_misura}</span>;
    }
    if (badge.tipo === 'variabile') {
      const tip = badge.valori.map(v => `${v.valore} ${v.unita_misura}${v.ambiti && v.ambiti.length ? ` (${v.ambiti.join(', ')})` : ''}`).join('; ');
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild><span className="text-xs text-muted-foreground underline decoration-dotted cursor-help">variabile</span></TooltipTrigger>
            <TooltipContent className="max-w-xs"><p className="text-xs">{tip}</p></TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    if (badge.tipo === 'mancante') {
      const tip = `${badge.tonnellate_mancanti.toFixed(2).replace('.', ',')} t senza prezzo (${badge.count_mancanti} righe)`;
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild><span className="text-xs text-destructive font-medium underline decoration-dotted cursor-help">tariffa mancante</span></TooltipTrigger>
            <TooltipContent className="max-w-xs"><p className="text-xs">{tip}</p></TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Totale principale */}
      <div className="border rounded-lg p-5 bg-gradient-to-r from-primary/10 to-primary/5">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h3 className="font-heading font-bold text-lg">Totale dovuto da Ecotyre — {data.periodo.mese} {data.periodo.anno}</h3>
        </div>
        <div className="flex items-end gap-6 flex-wrap">
          <div>
            <p className="text-xs text-muted-foreground">Importo totale</p>
            <p className="text-3xl font-bold">€ {data.totale_generale.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Volume raccolto</p>
            <p className="text-xl font-semibold">{data.totale_ton.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} t</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ordini</p>
            <p className="text-xl font-semibold">{data.totale_ordini}</p>
          </div>
        </div>
      </div>

      {/* Avviso anomalie (righe senza tariffa) */}
      {anomalie.length > 0 && (
        <div className="border-2 border-destructive/40 bg-destructive/5 rounded-lg p-4">
          <div className="flex items-center gap-2 text-destructive font-semibold mb-2">
            <AlertTriangle className="w-5 h-5" />
            <span>{anomalie.length} combinazioni senza tariffa — {tonnSenzaPrezzo.toFixed(2).replace('.', ',')} t senza prezzo</span>
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {anomalie.map((a, i) => (
              <div key={i} className="text-sm bg-background/60 rounded px-3 py-1.5 border border-destructive/20">
                <span className="font-medium">{a.tipologia}</span>
                {a.regione && <span> — {a.regione}</span>}
                {a.classe && <span> — classe {a.classe}</span>}
                {a.eer_codice && <span> — EER {a.eer_codice}</span>}
                <span className="text-muted-foreground">: {a.tonnellate.toFixed(2).replace('.', ',')} t senza tariffa</span>
              </div>
            ))}
          </div>
          {onVaiTariffe && (
            <button onClick={onVaiTariffe} className="mt-2 text-sm text-primary hover:underline inline-flex items-center gap-1">
              Vai alle tariffe <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Breakdown per tipologia */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {tipologie.map(t => (
          <div key={t.tipologia} className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-heading font-semibold">{t.label}</h4>
              {renderBadge(t.badge)}
            </div>
            <p className="text-2xl font-bold">€ {t.totale.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span>{t.volume_ton.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} t</span>
              <span>•</span>
              <span>{t.ordini} ordini</span>
            </div>
            {t.by_regione && t.by_regione.length > 0 && (
              <div className="mt-3 pt-3 border-t space-y-1.5">
                {t.by_regione.slice(0, 5).map(r => (
                  <div key={r.regione} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground truncate">{r.regione}</span>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums">{(r.kg / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 })} t</span>
                      <span className="font-medium tabular-nums">€ {r.totale.toLocaleString('it-IT', { maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>
                ))}
                {t.by_regione.length > 5 && (
                  <p className="text-xs text-muted-foreground">+ {t.by_regione.length - 5} altre regioni</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Riscontro con la prefattura Ecotyre */}
      <div className="border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-primary" />
          <h4 className="font-heading font-semibold">Riscontro con la prefattura Ecotyre</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Tipologia</th>
                <th className="py-2 pr-4 font-medium text-right">Ordini</th>
                <th className="py-2 pr-4 font-medium text-right">Kg</th>
                <th className="py-2 font-medium text-right">Importo (€)</th>
              </tr>
            </thead>
            <tbody>
              {tipologie.map(t => (
                <tr key={t.tipologia} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{t.label}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{t.ordini}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{Math.round(t.volume_kg).toLocaleString('it-IT')}</td>
                  <td className="py-2 text-right tabular-nums">{t.totale.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
            {data.ripartizione_servizio && (
              <tbody>
                <tr className="border-t-2 bg-muted/40">
                  <td className="py-2 pr-4 font-medium" colSpan={4}><span className="text-xs text-muted-foreground uppercase tracking-wide">Ripartizione per tipo di servizio</span></td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4 font-medium">Trasp (pri)</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{data.ripartizione_servizio.TRASP.ordini}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{data.ripartizione_servizio.TRASP.kg.toLocaleString('it-IT')}</td>
                  <td className="py-2 text-right tabular-nums">{data.ripartizione_servizio.TRASP.totale.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4 font-medium">Trasp+Tratt (pri)</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{data.ripartizione_servizio.TRASP_TRATT.ordini}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{data.ripartizione_servizio.TRASP_TRATT.kg.toLocaleString('it-IT')}</td>
                  <td className="py-2 text-right tabular-nums">{data.ripartizione_servizio.TRASP_TRATT.totale.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            )}
            <tfoot>
              <tr className="border-t-2 font-semibold">
                <td className="py-2 pr-4">Totale</td>
                <td className="py-2 pr-4 text-right tabular-nums">{data.totale_ordini}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{Math.round(data.totale_kg).toLocaleString('it-IT')}</td>
                <td className="py-2 text-right tabular-nums">{data.totale_generale.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
        <FileText className="w-3.5 h-3.5" />
        Calcolo automatico basato sulle tariffe attive e sui volumi del periodo (stato terminato, trasporto_finito_il). Premi "Elabora Mese" per generare i documenti.
      </div>
    </div>
  );
}