import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { MESI } from '@/lib/pfuConstants';
import { formatTonnellate, formatPercentuale } from '@/lib/utils';
import { dataOra } from '@/lib/target';
import { esportaReportSettimanalePdf } from '@/lib/reportSettimanaleExport';
import { Loader2, RefreshCw, FileDown, CalendarRange, Target, Truck, TrendingUp, Hourglass, Sigma } from 'lucide-react';

// Report settimanale della raccolta primaria RETE: target del mese, raccolto per
// settimana, residuo del mese e andamento annuo per regione e raccoglitore. Si
// calcola ogni volta dai dati, quindi segue da solo i caricamenti delle primarie.

const t = (v) => formatTonnellate(v);
const dataBreve = (iso) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '');

function somma(righe, nSett) {
  const tot = { target_mese: 0, settimane: Array(nSett).fill(0), raccolto_mese: 0, residuo_mese: 0, annuo: 0, totale_anno: 0, residuo_anno: 0 };
  for (const r of righe) {
    tot.target_mese += r.target_mese;
    r.settimane.forEach((v, i) => { tot.settimane[i] += v; });
    tot.raccolto_mese += r.raccolto_mese;
    tot.residuo_mese += r.residuo_mese;
    tot.annuo += r.annuo;
    tot.totale_anno += r.totale_anno;
    tot.residuo_anno += r.residuo_anno;
  }
  return tot;
}

function Kpi({ icona: Icona, etichetta, valore, dettaglio, colore }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className={`inline-flex p-1.5 rounded-md ${colore}`}><Icona className="w-3.5 h-3.5" /></span>
        {etichetta}
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums">{valore}</div>
      {dettaglio && <div className="text-xs text-muted-foreground mt-0.5">{dettaglio}</div>}
    </div>
  );
}

function Barra({ fatto, atteso }) {
  if (!(atteso > 0)) return null;
  const perc = (fatto / atteso) * 100;
  const colore = perc >= 100 ? 'bg-emerald-500' : perc >= 70 ? 'bg-sky-500' : perc >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="h-1.5 flex-1 min-w-[60px] rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${colore}`} style={{ width: `${Math.min(perc, 100)}%` }} />
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground w-10 text-right">{formatPercentuale(perc)}%</span>
    </div>
  );
}

export default function ReportSettimanale() {
  const { toast } = useToast();
  const oggi = new Date();
  const [anno, setAnno] = useState(oggi.getFullYear());
  const [mese, setMese] = useState(oggi.getMonth() + 1);
  const [report, setReport] = useState(null);
  const [caricamento, setCaricamento] = useState(true);
  const [impianti, setImpianti] = useState(false);

  const carica = useCallback(async () => {
    setCaricamento(true);
    try {
      const res = await base44.functions.invoke('reportSettimanale', { anno, mese });
      setReport(res.data);
    } catch (e) {
      toast({ title: 'Report non disponibile', description: e?.response?.data?.error || e.message, variant: 'destructive' });
    } finally {
      setCaricamento(false);
    }
  }, [anno, mese, toast]);

  useEffect(() => { carica(); }, [carica]);

  const nSett = report?.settimane?.length || 0;
  const gruppi = useMemo(() => {
    if (!report) return [];
    const mappa = new Map();
    for (const r of report.righe) {
      if (!mappa.has(r.regione)) mappa.set(r.regione, []);
      mappa.get(r.regione).push(r);
    }
    return [...mappa.entries()].map(([regione, righe]) => ({ regione, righe, totale: somma(righe, nSett) }));
  }, [report, nSett]);
  const totale = useMemo(() => (report ? somma(report.righe, nSett) : null), [report, nSett]);

  // Settimana in corso: evidenziata nella tabella quando il mese e' quello attuale.
  const oggiIso = report?.oggi || '';
  const settimanaCorrente = report ? report.settimane.findIndex(s => s.dal <= oggiIso && oggiIso <= s.al) : -1;

  const esporta = () => {
    try {
      esportaReportSettimanalePdf(report, gruppi, totale);
    } catch (e) {
      toast({ title: 'Esportazione non riuscita', description: e.message, variant: 'destructive' });
    }
  };

  const anni = [oggi.getFullYear() - 1, oggi.getFullYear()];

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-r from-[#0f4c5c] to-[#1a7f8e] text-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/70">Raccolta primaria rete</p>
            <h2 className="text-2xl font-bold">Ecotyre {MESI[mese - 1]} {anno}</h2>
            <p className="text-sm text-white/80 mt-1">
              Formulari terminati per data di fine trasporto
              {report?.dati_fino_al ? `, dati fino al ${report.dati_fino_al.split('-').reverse().join('/')}` : ''}
              {report?.ultimo_caricamento ? ` · ultimo caricamento primarie ${dataOra(report.ultimo_caricamento.il)}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={mese} onChange={e => setMese(Number(e.target.value))} className="rounded-md bg-white/15 border border-white/30 px-2 py-1.5 text-sm text-white [&>option]:text-slate-900">
              {MESI.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select value={anno} onChange={e => setAnno(Number(e.target.value))} className="rounded-md bg-white/15 border border-white/30 px-2 py-1.5 text-sm text-white [&>option]:text-slate-900">
              {anni.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <Button size="sm" onClick={carica} disabled={caricamento} className="gap-1 bg-white/15 text-white border border-white/30 hover:bg-white/25">
              {caricamento ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Aggiorna
            </Button>
            <Button size="sm" onClick={esporta} disabled={!report || caricamento} className="gap-1 bg-white text-[#0f4c5c] hover:bg-white/90">
              <FileDown className="w-4 h-4" /> Esporta PDF
            </Button>
          </div>
        </div>
      </div>

      {caricamento && !report ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Calcolo del report…</div>
      ) : report && totale ? (
        <>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
            <Kpi icona={Target} etichetta={`Target ${MESI[mese - 1]}`} valore={`${t(totale.target_mese)} t`} colore="bg-sky-100 text-sky-700" />
            <Kpi icona={Truck} etichetta={`Raccolto ${MESI[mese - 1]}`} valore={`${t(totale.raccolto_mese)} t`}
              dettaglio={totale.target_mese > 0 ? `${formatPercentuale(totale.raccolto_mese / totale.target_mese * 100)}% del target` : null} colore="bg-emerald-100 text-emerald-700" />
            <Kpi icona={Hourglass} etichetta="Residuo del mese" valore={`${t(totale.residuo_mese)} t`} colore="bg-amber-100 text-amber-700" />
            <Kpi icona={CalendarRange} etichetta={settimanaCorrente >= 0 ? `Settimana in corso W${report.settimane[settimanaCorrente].numero}` : 'Ultima settimana del mese'}
              valore={`${t(totale.settimane[settimanaCorrente >= 0 ? settimanaCorrente : nSett - 1] || 0)} t`}
              dettaglio={settimanaCorrente >= 0 ? `dal ${dataBreve(report.settimane[settimanaCorrente].dal)} al ${dataBreve(report.settimane[settimanaCorrente].al)}` : null} colore="bg-violet-100 text-violet-700" />
            <Kpi icona={Sigma} etichetta={`Totale ${anno}`} valore={`${t(totale.totale_anno)} t`} dettaglio={`residuo annuo ${t(totale.residuo_anno)} t`} colore="bg-slate-100 text-slate-700" />
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-medium flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Raccolto per settimana, regione e raccoglitore</p>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={impianti} onChange={e => setImpianti(e.target.checked)} /> Mostra gli impianti di destinazione del mese
            </label>
          </div>

          <div className="rounded-xl border bg-card overflow-x-auto shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0f4c5c] text-white">
                  <th className="px-3 py-2.5 text-left font-semibold">Raccoglitore</th>
                  <th className="px-2 py-2.5 text-right font-semibold whitespace-nowrap">Target {MESI[mese - 1]}</th>
                  {report.settimane.map((s, i) => (
                    <th key={s.numero} className={`px-2 py-2.5 text-right font-semibold whitespace-nowrap ${i === settimanaCorrente ? 'bg-white/15' : ''}`}>
                      W{s.numero}
                      <div className="text-[10px] font-normal text-white/70">{dataBreve(s.dal)}–{dataBreve(s.al)}</div>
                    </th>
                  ))}
                  <th className="px-2 py-2.5 text-right font-semibold whitespace-nowrap border-l border-white/20">Residue {String(mese).padStart(2, '0')}/{anno}</th>
                  <th className="px-2 py-2.5 text-right font-semibold whitespace-nowrap">Raccolte {String(mese).padStart(2, '0')}/{anno}</th>
                  <th className="px-2 py-2.5 text-right font-semibold whitespace-nowrap border-l border-white/20">Residuo annuo</th>
                  <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">Totale {anno}</th>
                </tr>
              </thead>
              <tbody>
                {gruppi.map(g => (
                  <React.Fragment key={g.regione}>
                    <tr className="bg-[#e2eef1] font-semibold text-[#0f4c5c] border-t">
                      <td className="px-3 py-2">{g.regione}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{t(g.totale.target_mese)}</td>
                      {g.totale.settimane.map((v, i) => <td key={i} className={`px-2 py-2 text-right tabular-nums ${i === settimanaCorrente ? 'bg-[#0f4c5c]/5' : ''}`}>{t(v)}</td>)}
                      <td className="px-2 py-2 text-right tabular-nums border-l">{t(g.totale.residuo_mese)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{t(g.totale.raccolto_mese)}</td>
                      <td className="px-2 py-2 text-right tabular-nums border-l">{t(g.totale.residuo_anno)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{t(g.totale.totale_anno)}</td>
                    </tr>
                    {g.righe.map(r => (
                      <tr key={g.regione + r.raccoglitore} className="border-t hover:bg-muted/40 align-top">
                        <td className="px-3 py-2 pl-6">
                          <div className="font-medium">
                            {r.raccoglitore}
                            {r.non_raccoglie && <span className="ml-2 text-[10px] rounded bg-muted px-1.5 py-0.5 text-muted-foreground font-semibold">NON RACCOGLIE</span>}
                            {r.senza_target && <span className="ml-2 text-[10px] rounded bg-amber-100 px-1.5 py-0.5 text-amber-800 font-semibold">SENZA TARGET</span>}
                          </div>
                          <Barra fatto={r.raccolto_mese} atteso={r.target_mese} />
                          {r.fuori_regione.length > 0 && <div className="text-[11px] text-muted-foreground mt-0.5">di cui fuori regione nell'anno: {r.fuori_regione.map(f => `${f.regione} ${t(f.t)} t`).join(', ')}</div>}
                          {impianti && r.impianti.length > 0 && <div className="text-[11px] text-muted-foreground mt-0.5">{r.impianti.map(i => `${i.impianto} ${t(i.t)} t`).join(' · ')}</div>}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">{r.non_raccoglie ? <span className="text-muted-foreground">NR</span> : t(r.target_mese)}</td>
                        {r.settimane.map((v, i) => (
                          <td key={i} className={`px-2 py-2 text-right tabular-nums ${v === 0 ? 'text-muted-foreground/60' : ''} ${i === settimanaCorrente ? 'bg-[#0f4c5c]/5 font-medium' : ''}`}>{t(v)}</td>
                        ))}
                        <td className={`px-2 py-2 text-right tabular-nums border-l ${r.target_mese > 0 && r.residuo_mese > 0 ? 'text-red-600' : r.residuo_mese < 0 ? 'text-emerald-700' : ''}`}>{t(r.residuo_mese)}</td>
                        <td className="px-2 py-2 text-right tabular-nums font-semibold">{t(r.raccolto_mese)}</td>
                        <td className={`px-2 py-2 text-right tabular-nums border-l ${r.residuo_anno < 0 ? 'text-emerald-700' : ''}`}>{t(r.residuo_anno)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{t(r.totale_anno)}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
                <tr className="bg-[#0f4c5c] text-white font-bold">
                  <td className="px-3 py-2.5">TOTALE</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{t(totale.target_mese)}</td>
                  {totale.settimane.map((v, i) => <td key={i} className="px-2 py-2.5 text-right tabular-nums">{t(v)}</td>)}
                  <td className="px-2 py-2.5 text-right tabular-nums border-l border-white/20">{t(totale.residuo_mese)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{t(totale.raccolto_mese)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums border-l border-white/20">{t(totale.residuo_anno)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{t(totale.totale_anno)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Settimane da lunedì a domenica, come nel file di gestione: quelle a cavallo di due mesi contano solo i giorni del mese. Residue = target del mese meno raccolto del mese;
            residuo annuo = target annuo meno raccolto dell'anno. Solo canale RETE: ACI ed Extra Raccolta sono canali separati. Il report si ricalcola a ogni apertura e dopo ogni caricamento delle primarie.
          </p>
        </>
      ) : null}
    </div>
  );
}
