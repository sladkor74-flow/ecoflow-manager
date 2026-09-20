import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, RefreshCw, FileSpreadsheet, AlertTriangle, Info } from 'lucide-react';
import { formatTonnellate, formatNumber, formatPercentuale } from '@/lib/utils';
import { esportaTabellaExcel } from '@/lib/esportaTabella';

const NOMI = { RETE: 'Rete', ACI: 'ACI', EXTRA_RACCOLTA: 'Extra raccolta' };
const ANNI = [2024, 2025, 2026];
const euro = (v) => (v === null || v === undefined ? '—' : formatNumber(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const perc = (v) => (v === null || v === undefined ? '—' : `${formatPercentuale(v)}%`);

const COLONNE = [
  { titolo: 'Mese', valore: r => r.mese, tipo: 'testo', peso: 1 },
  { titolo: 'Tonnellate', valore: r => r.tonnellate, tipo: 't', peso: 0.9 },
  { titolo: 'Ricavo', valore: r => r.ricavo, tipo: 'euro', peso: 1.1 },
  { titolo: 'Costo raccolta', valore: r => r.costo_raccolta, tipo: 'euro', peso: 1.1 },
  { titolo: 'Costo impianti e stoccaggi', valore: r => r.costo_impianti, tipo: 'euro', peso: 1.3 },
  { titolo: 'Costo trasporto secondarie', valore: r => r.costo_trasporti, tipo: 'euro', peso: 1.3 },
  { titolo: 'Costo totale', valore: r => r.costo, tipo: 'euro', peso: 1.1 },
  { titolo: 'Margine', valore: r => r.margine, tipo: 'euro', peso: 1.1 },
  { titolo: 'Margine %', valore: r => (r.margine_pct === null ? '' : `${formatPercentuale(r.margine_pct)}%`), tipo: 'testo', peso: 0.8 },
  { titolo: 'Ricavo €/t', valore: r => r.ricavo_t, tipo: 'euro', peso: 0.9 },
  { titolo: 'Costo €/t', valore: r => r.costo_t, tipo: 'euro', peso: 0.9 },
  { titolo: 'Margine €/t', valore: r => r.margine_t, tipo: 'euro', peso: 0.9 },
];

// Il margine della commessa: ricavo della fatturazione attiva meno costo della
// passiva, per canale. Tre commesse, tre tabelle: non esiste un totale unico.
export default function MargineCommessa() {
  const [anno, setAnno] = useState(new Date().getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState('');
  const { toast } = useToast();

  const carica = async () => {
    setLoading(true); setErrore('');
    try {
      const res = await base44.functions.invoke('calcolaMargine', { anno });
      setData(res.data);
    } catch (e) {
      setData(null);
      setErrore(e?.response?.data?.error || e.message || 'Errore sconosciuto');
    }
    setLoading(false);
  };
  useEffect(() => { carica(); }, [anno]);

  const esporta = async (c) => {
    try {
      await esportaTabellaExcel({
        nomeFile: `Margine ${NOMI[c.canale]} ${data.anno}`,
        foglio: NOMI[c.canale],
        intestazione: 'SMOCO S.r.l.  ·  COMMESSA ECOTYRE  ·  MARGINE',
        titolo: `Margine ${NOMI[c.canale]} — ${data.anno}`,
        sottotitolo: 'Ricavo della fatturazione attiva meno costo della fatturazione passiva',
        colonne: COLONNE,
        righe: [...c.mesi, c.anno],
      });
    } catch (e) {
      toast({ title: 'Esportazione non riuscita', description: e.message || String(e), variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 p-4 border rounded-lg bg-muted/30">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Anno</label>
          <Select value={String(anno)} onValueChange={v => setAnno(Number(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{ANNI.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={carica} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />} Ricalcola
        </Button>
        <p className="text-xs text-muted-foreground max-w-2xl flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>Sono gli stessi numeri delle due fatturazioni: il ricavo è il dovuto da Ecotyre, il costo è la passiva del mese. Il costo di un mese comprende stoccaggio, trattamento e secondarie di quel mese, che possono riguardare tonnellate raccolte prima: il singolo mese oscilla, il numero che conta è quello dell'anno. I tre canali non si sommano.</span>
        </p>
      </div>

      {loading && <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Calcolo del margine sui dati di oggi...</div>}
      {errore && <div className="border border-destructive/40 bg-destructive/5 rounded-lg p-4 text-sm text-destructive flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {errore}</div>}

      {!loading && data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {data.canali.map(c => (
              <div key={c.canale} className="border rounded-lg p-4">
                <h3 className="font-heading font-semibold">{NOMI[c.canale]} — {data.anno}</h3>
                <p className={`text-2xl font-bold mt-1 ${c.anno.margine < 0 ? 'text-red-600' : ''}`}>€ {euro(c.anno.margine)}</p>
                <p className="text-xs text-muted-foreground">margine · {perc(c.anno.margine_pct)} del ricavo</p>
                <div className="mt-3 pt-3 border-t text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Ricavo</span><span className="tabular-nums">€ {euro(c.anno.ricavo)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Costo</span><span className="tabular-nums">€ {euro(c.anno.costo)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Tonnellate</span><span className="tabular-nums">{formatTonnellate(c.anno.tonnellate)} t</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Per tonnellata: ricavo / costo / margine</span><span className="tabular-nums">{euro(c.anno.ricavo_t)} / {euro(c.anno.costo_t)} / {euro(c.anno.margine_t)}</span></div>
                </div>
              </div>
            ))}
          </div>

          {data.canali.map(c => (
            <div key={c.canale} className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-semibold">{NOMI[c.canale]}</h3>
                <Button variant="outline" size="sm" onClick={() => esporta(c)}><FileSpreadsheet className="w-4 h-4 mr-1.5" /> Excel</Button>
              </div>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted"><tr>
                    <th className="text-left px-3 py-2 font-semibold">Mese</th>
                    <th className="text-right px-3 py-2 font-semibold">t</th>
                    <th className="text-right px-3 py-2 font-semibold">Ricavo €</th>
                    <th className="text-right px-3 py-2 font-semibold">Raccolta €</th>
                    <th className="text-right px-3 py-2 font-semibold">Impianti e stoccaggi €</th>
                    <th className="text-right px-3 py-2 font-semibold">Secondarie €</th>
                    <th className="text-right px-3 py-2 font-semibold">Costo €</th>
                    <th className="text-right px-3 py-2 font-semibold">Margine €</th>
                    <th className="text-right px-3 py-2 font-semibold">%</th>
                    <th className="text-right px-3 py-2 font-semibold">Margine €/t</th>
                  </tr></thead>
                  <tbody>
                    {[...c.mesi, c.anno].map(r => {
                      const rigaAnno = r.mese === 'Anno';
                      const vuoto = !r.ricavo && !r.costo;
                      return (
                        <tr key={r.mese} className={`border-t ${rigaAnno ? 'bg-primary/5 font-semibold border-t-2' : ''} ${vuoto && !rigaAnno ? 'text-muted-foreground' : ''}`}>
                          <td className="px-3 py-1.5">
                            {r.mese}
                            {(r.righe_senza_prezzo > 0 || r.anomalie_passiva > 0) && (
                              <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-amber-700" title="Un prezzo mancante o un'anomalia della passiva rendono il margine meno affidabile: i dettagli sono nelle due fatturazioni.">
                                <AlertTriangle className="w-3 h-3" />
                                {r.righe_senza_prezzo > 0 && `${r.righe_senza_prezzo} senza prezzo`}
                                {r.righe_senza_prezzo > 0 && r.anomalie_passiva > 0 && ' · '}
                                {r.anomalie_passiva > 0 && `${r.anomalie_passiva} ${r.anomalie_passiva === 1 ? 'anomalia' : 'anomalie'} in passiva`}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{formatTonnellate(r.tonnellate)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{euro(r.ricavo)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{euro(r.costo_raccolta)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{euro(r.costo_impianti)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{euro(r.costo_trasporti)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{euro(r.costo)}</td>
                          <td className={`px-3 py-1.5 text-right tabular-nums ${r.margine < 0 ? 'text-red-600' : ''}`}>{euro(r.margine)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{perc(r.margine_pct)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{euro(r.margine_t)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
