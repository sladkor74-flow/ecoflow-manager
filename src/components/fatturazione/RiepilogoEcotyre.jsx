import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, TrendingUp, FileText } from 'lucide-react';

const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

export default function RiepilogoEcotyre({ periodo }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('getRiepilogoEcotyre', { anno: periodo.anno, mese: periodo.mese });
      setData(res.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [periodo.anno, periodo.mese]);

  if (loading) {
    return <div className="flex items-center justify-center py-6 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Calcolo riepilogo...</div>;
  }

  if (!data) return null;

  const tipologie = data.tipologie || [];

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

      {/* Breakdown per tipologia */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {tipologie.map(t => (
          <div key={t.tipologia} className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-heading font-semibold">{t.label}</h4>
              <span className="text-xs text-muted-foreground">
                {typeof t.tariffa_default === 'number' ? `${t.tariffa_default} €/t` : t.tariffa_default}
              </span>
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

      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
        <FileText className="w-3.5 h-3.5" />
        Calcolo automatico basato sulle tariffe attive e sui volumi di raccolta del periodo. Premi "Elabora Mese" per generare i documenti di fatturazione.
      </div>
    </div>
  );
}