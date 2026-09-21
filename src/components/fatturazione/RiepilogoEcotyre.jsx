import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, TrendingUp, FileText, AlertTriangle, ArrowRight, CheckCircle, ChevronDown, Info } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { formatTonnellate, formatKg, formatIntero, formatNumber } from '@/lib/utils';

const euro = (v) => `€ ${formatNumber(v || 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const conSegno = (v, testo) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${testo}`;
const giorno = (v) => (v ? String(v).slice(0, 10).split('-').reverse().join('/') : '—');

// Il documento salvato contro i dati di oggi: i movimenti che il portale ha
// chiuso dopo l'elaborazione del mese si vedono qui, invece di restare non fatturati.
function Riconciliazione({ t }) {
  const [aperto, setAperto] = useState(false);
  const r = t.riconciliazione;
  if (!r) return null;
  if (r.allineato) {
    return (
      <div className="text-xs text-emerald-700 flex items-center gap-1.5">
        <CheckCircle className="w-3.5 h-3.5" /> {t.label}: il documento del {giorno(r.data_elaborazione)} coincide con i dati di oggi.
      </div>
    );
  }
  const chiuso = r.stato === 'chiusa';
  const righe = [
    ...r.nuovi.map(x => ({ ...x, tipo: 'arrivato dopo', kg_mostrati: x.kg, euro_mostrati: x.totale })),
    ...r.cambiati.map(x => ({ ...x, tipo: 'cambiato', kg_mostrati: x.kg_oggi - x.kg_documento, euro_mostrati: x.totale_oggi - x.totale_documento })),
    ...r.spariti.map(x => ({ ...x, tipo: 'non più nel mese', kg_mostrati: -x.kg, euro_mostrati: -x.totale })),
  ];
  return (
    <div className="border-2 border-amber-300 bg-amber-50 rounded-lg p-4">
      <button onClick={() => setAperto(!aperto)} className="flex items-start justify-between w-full text-left gap-3">
        <div>
          <div className="flex items-center gap-2 font-semibold text-amber-900">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{t.label}: il documento del {giorno(r.data_elaborazione)} non coincide più con i dati di oggi</span>
          </div>
          <p className="text-sm text-amber-900/80 mt-1">
            {r.nuovi.length > 0 && <span>{r.nuovi.length} {r.nuovi.length === 1 ? 'movimento arrivato' : 'movimenti arrivati'} dopo l'elaborazione. </span>}
            {r.cambiati.length > 0 && <span>{r.cambiati.length} con peso o importo cambiato. </span>}
            {r.spariti.length > 0 && <span>{r.spariti.length} non più in questo mese. </span>}
            Differenza: <span className="font-medium tabular-nums">{conSegno(r.delta_kg, formatTonnellate(Math.abs(r.delta_kg) / 1000))} t</span>,{' '}
            <span className="font-medium tabular-nums">{conSegno(r.delta_euro, euro(Math.abs(r.delta_euro)))}</span>.
          </p>
          <p className="text-xs text-amber-900/70 mt-1">
            {chiuso
              ? 'Il periodo è chiuso: per correggere il documento va riaperto; in alternativa questi movimenti si fatturano con un\'integrazione.'
              : 'Premi "Elabora Mese" per aggiornare il documento.'}
          </p>
        </div>
        <ChevronDown className={`w-5 h-5 text-amber-900/60 shrink-0 transition-transform ${aperto ? 'rotate-180' : ''}`} />
      </button>
      {aperto && (
        <div className="mt-3 overflow-x-auto max-h-72 overflow-y-auto bg-background/70 rounded border border-amber-200">
          <table className="w-full text-xs">
            <thead className="bg-amber-100/60 sticky top-0"><tr className="text-left">
              <th className="px-2 py-1.5 font-semibold">ID ordine</th>
              <th className="px-2 py-1.5 font-semibold">Formulario</th>
              <th className="px-2 py-1.5 font-semibold">Fine trasporto</th>
              <th className="px-2 py-1.5 font-semibold">Differenza</th>
              <th className="px-2 py-1.5 font-semibold text-right">kg</th>
              <th className="px-2 py-1.5 font-semibold text-right">€</th>
            </tr></thead>
            <tbody>
              {righe.map((x, i) => (
                <tr key={i} className="border-t border-amber-100">
                  <td className="px-2 py-1 font-mono">{x.ordine || '—'}</td>
                  <td className="px-2 py-1">{x.numero_fir || '—'}{x.descrizione ? ` · ${x.descrizione}` : ''}</td>
                  <td className="px-2 py-1">{giorno(x.data_fine_trasporto)}</td>
                  <td className="px-2 py-1">{x.tipo}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{conSegno(x.kg_mostrati, formatKg(Math.abs(x.kg_mostrati)))}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{conSegno(x.euro_mostrati, formatNumber(Math.abs(x.euro_mostrati), { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function RiepilogoEcotyre({ periodo, onAnomalieChange, onVaiTariffe, versione }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState('');

  const load = async () => {
    setLoading(true);
    setErrore('');
    try {
      const res = await base44.functions.invoke('getRiepilogoEcotyre', { anno: periodo.anno, mese: periodo.mese });
      setData(res.data);
      if (onAnomalieChange) onAnomalieChange(res.data?.anomalie || []);
    } catch (e) {
      setData(null);
      setErrore(e?.response?.data?.error || e.message || 'Errore sconosciuto');
      if (onAnomalieChange) onAnomalieChange([]);
    }
    setLoading(false);
  };

  // versione cambia quando il mese viene rielaborato: l'anteprima e la
  // riconciliazione si rileggono insieme ai documenti.
  useEffect(() => { load(); }, [periodo.anno, periodo.mese, versione]);

  if (loading) {
    return <div className="flex items-center justify-center py-6 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Calcolo riepilogo...</div>;
  }
  if (errore) {
    return (
      <div className="border border-destructive/40 bg-destructive/5 rounded-lg p-4 text-sm text-destructive flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" /> Il riepilogo non è stato calcolato: {errore}
      </div>
    );
  }
  if (!data) return null;

  const tipologie = data.tipologie || [];
  const tutte = data.anomalie || [];
  const senzaTariffa = tutte.filter(a => !a.tipo || a.tipo === 'senza_tariffa');
  const altre = tutte.filter(a => a.tipo && a.tipo !== 'senza_tariffa');
  // Le tonnellate senza prezzo si contano per canale: una somma unica di rete,
  // ACI ed extra raccolta non appartiene a nessuna commessa.
  const canaleDi = (a) => String(a.tipologia || 'N/D').toUpperCase();
  const senzaPrezzoPerCanale = [...new Set(['RETE', 'ACI', 'EXTRA_RACCOLTA', ...senzaTariffa.map(canaleDi)])]
    .map(c => {
      const sue = senzaTariffa.filter(a => canaleDi(a) === c);
      return { canale: c, combinazioni: sue.length, tonnellate: sue.reduce((s, a) => s + (a.tonnellate || 0), 0) };
    })
    .filter(x => x.combinazioni > 0);
  const nomeCanale = (c) => ({ RETE: 'Rete', ACI: 'ACI', EXTRA_RACCOLTA: 'Extra Raccolta' }[c] || c);

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
      const tip = `${formatTonnellate(badge.tonnellate_mancanti)} t senza prezzo (${badge.count_mancanti} righe)`;
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
      {/* Rete, ACI ed extra raccolta sono commesse indipendenti: tre importi,
          mai un totale unico che li somma. */}
      <div className="border rounded-lg p-4 bg-gradient-to-r from-primary/10 to-primary/5">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h3 className="font-heading font-bold text-lg">Dovuto da Ecotyre — {data.periodo.mese} {data.periodo.anno}</h3>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Calcolato sui dati di oggi, canale per canale. Le tre commesse non si sommano.</p>
      </div>

      {/* Il documento salvato contro i dati di oggi */}
      {tipologie.map(t => <Riconciliazione key={t.tipologia} t={t} />)}

      {/* Righe senza tariffa */}
      {senzaTariffa.length > 0 && (
        <div className="border-2 border-destructive/40 bg-destructive/5 rounded-lg p-4">
          <div className="flex items-center gap-2 text-destructive font-semibold mb-2">
            <AlertTriangle className="w-5 h-5" />
            <span>Combinazioni senza tariffa, per canale: {senzaPrezzoPerCanale.map(x => `${nomeCanale(x.canale)} ${x.combinazioni} (${formatTonnellate(x.tonnellate)} t senza prezzo)`).join(' · ')}</span>
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {senzaTariffa.map((a, i) => (
              <div key={i} className="text-sm bg-background/60 rounded px-3 py-1.5 border border-destructive/20">
                <span className="font-medium">{a.tipologia}</span>
                {a.regione && <span> — {a.regione}</span>}
                {a.classe && <span> — classe {a.classe}</span>}
                {a.eer_codice && <span> — EER {a.eer_codice}</span>}
                <span className="text-muted-foreground">: {formatTonnellate(a.tonnellate)} t senza tariffa</span>
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

      {/* Avvisi sull'extra raccolta: prezzo a zero, secondarie non fatturate */}
      {altre.length > 0 && (
        <div className="border rounded-lg p-3 bg-muted/30 space-y-1">
          {altre.map((a, i) => (
            <div key={i} className={`text-sm flex items-start gap-2 ${a.tipo === 'prezzo_zero' ? 'text-amber-800' : 'text-muted-foreground'}`}>
              {a.tipo === 'prezzo_zero' ? <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> : <Info className="w-4 h-4 mt-0.5 shrink-0" />}
              <span>{a.descrizione}</span>
            </div>
          ))}
        </div>
      )}

      {/* Un riquadro per canale */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {tipologie.map(t => (
          <div key={t.tipologia} className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-heading font-semibold">{t.label}</h4>
              {renderBadge(t.badge)}
            </div>
            <p className="text-2xl font-bold">{euro(t.totale)}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span>{formatTonnellate(t.volume_ton)} t</span>
              <span>•</span>
              <span>{formatIntero(t.ordini)} ordini</span>
            </div>
            {t.by_regione && t.by_regione.length > 0 && (
              <div className="mt-3 pt-3 border-t space-y-1.5">
                {t.by_regione.slice(0, 5).map(r => (
                  <div key={r.regione} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground truncate">{r.regione}</span>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums">{formatTonnellate((r.kg / 1000))} t</span>
                      <span className="font-medium tabular-nums">€ {formatNumber(r.totale, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
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

      {/* Riscontro con la prefattura Ecotyre: per canale e, dentro il canale, per tipo di servizio */}
      <div className="border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-primary" />
          <h4 className="font-heading font-semibold">Riscontro con la prefattura Ecotyre</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Canale e servizio</th>
                <th className="py-2 pr-4 font-medium text-right">Ordini</th>
                <th className="py-2 pr-4 font-medium text-right">Kg</th>
                <th className="py-2 font-medium text-right">Importo (€)</th>
              </tr>
            </thead>
            {tipologie.map(t => (
              <tbody key={t.tipologia}>
                <tr className="border-t-2 font-semibold">
                  <td className="py-2 pr-4">{t.label}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{formatIntero(t.ordini)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{formatKg(t.volume_kg)}</td>
                  <td className="py-2 text-right tabular-nums">{formatNumber(t.totale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                {[['TRASP', 'Trasp (pri)'], ['TRASP_TRATT', 'Trasp+Tratt (pri)']].map(([k, nome]) => {
                  const s = t.ripartizione_servizio?.[k];
                  if (!s || (!s.ordini && !s.totale)) return null;
                  return (
                    <tr key={k} className="text-muted-foreground">
                      <td className="py-1 pr-4 pl-4 text-xs">{nome}</td>
                      <td className="py-1 pr-4 text-right tabular-nums text-xs">{formatIntero(s.ordini)}</td>
                      <td className="py-1 pr-4 text-right tabular-nums text-xs">{formatKg(s.kg)}</td>
                      <td className="py-1 text-right tabular-nums text-xs">{formatNumber(s.totale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
      </div>

      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
        <FileText className="w-3.5 h-3.5" />
        Movimenti terminati con fine trasporto nel mese. Rete e ACI al prezzo della tabella tariffe; extra raccolta al prezzo e ai sovracosti scritti sull'intervento.
      </div>
    </div>
  );
}
