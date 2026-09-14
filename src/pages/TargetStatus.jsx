import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { MESI, meseCorrente as getMeseCorrente } from '@/lib/pfuConstants';
import { exportExcel, exportPDF, exportPPT } from '@/lib/statusExports';
import KpiCards from '@/components/target-status/KpiCards';
import TargetTable from '@/components/target-status/TargetTable';
import RegionTable from '@/components/target-status/RegionTable';
import ImpiantiTable from '@/components/target-status/ImpiantiTable';
import TargetChart from '@/components/target-status/TargetChart';
import ExportButtons from '@/components/target-status/ExportButtons';
import TargetRaccoglitoriGrid from '@/components/target-status/TargetRaccoglitoriGrid';
import CommessaEcotyreForm from '@/components/target-status/CommessaEcotyreForm';
import TargetAnnuali from '@/pages/TargetAnnuali';
import ReportGenerale from '@/components/target-status/ReportGenerale';
import CanaleAci from '@/components/target-status/CanaleAci';
import MultiSelect from '@/components/shared/MultiSelect';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/AuthContext';
import { normalizzaRagioneSociale } from '@/lib/normalizzaRagioneSocialeClient';
import { fetchAllClient } from '@/lib/fetchAllClient';
import { tonnellate, ANNI_TARGET } from '@/lib/target';
import { Loader2, RefreshCw, Filter, X } from 'lucide-react';

// Target & Status: unico punto in cui si scrivono i target.
// RETE, ACI ed Extra Raccolta sono canali indipendenti: i target si confrontano
// solo con la RETE e l'ACI si guarda a parte, contro la previsione del suo contratto.
// - Andamento: target contro raccolto per raccoglitore, regione e impianto, e il
//   raccolto per regione confrontato con il contratto. Solo lettura.
// - Target raccoglitori: annuo e mensile per raccoglitore, regione e impianto.
// - Commessa Ecotyre: quanto richiede il contratto.
// - Impianti e stoccaggi: target annuali degli impianti e plafond degli stoccaggi.
// Tutti gli altri moduli leggono questi dati.

const TARGET_BY_YEAR = { 2025: 11200, 2026: 11550 };
const SCHEDE = ['andamento', 'raccoglitori', 'commessa', 'impianti'];
const leggiLista = (json) => { try { const v = JSON.parse(json || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };

// Raccolto per regione confrontato con il contratto: quanto ci si attende fino a
// oggi segue il profilo del target mensile del contratto (o, in mancanza, i mesi
// in parti uguali), con il mese in corso contato per i giorni trascorsi.
function AndamentoRegioni({ raccolto, commessa, anno }) {
  const regioni = commessa ? leggiLista(commessa.regioni_json) : [];
  if (!regioni.length) {
    return <p className="text-sm text-muted-foreground border rounded-lg px-4 py-3">Inserisci o importa il contratto nella scheda Commessa Ecotyre per confrontare il raccolto di ogni regione con quanto richiesto.</p>;
  }
  const profilo = leggiLista(commessa.target_mensile_json).map(v => Number(v) || 0);
  const totaleProfilo = profilo.reduce((s, v) => s + v, 0);
  const pesi = totaleProfilo > 0 ? profilo.map(v => v / totaleProfilo) : MESI.map(() => 1 / 12);
  const oggi = new Date();
  let quota;
  if (anno < oggi.getFullYear()) quota = 1;
  else if (anno > oggi.getFullYear()) quota = 0;
  else {
    const m = oggi.getMonth();
    const giorniMese = new Date(anno, m + 1, 0).getDate();
    quota = pesi.slice(0, m).reduce((s, v) => s + v, 0) + pesi[m] * (oggi.getDate() / giorniMese);
  }
  const perRegione = new Map((raccolto?.by_regione || []).map(r => [String(r.regione).toLowerCase(), r]));
  const righe = regioni.map(r => {
    const racc = perRegione.get(String(r.regione).toLowerCase());
    const contratto = Number(r.target_t) || 0;
    const raccoltoT = racc ? racc.totale : 0;
    const atteso = contratto * quota;
    return { ...r, contratto, raccolto: raccoltoT, atteso, percentuale: contratto ? (raccoltoT / contratto) * 100 : null, scarto: raccoltoT - atteso };
  });
  const tot = righe.reduce((s, r) => ({ contratto: s.contratto + r.contratto, raccolto: s.raccolto + r.raccolto, atteso: s.atteso + r.atteso }), { contratto: 0, raccolto: 0, atteso: 0 });
  return (
    <div className="border rounded-lg overflow-x-auto bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-left">
          <tr>
            <th className="px-3 py-2">Regione</th>
            <th className="px-3 py-2">Province</th>
            <th className="px-3 py-2 text-right">Contratto (t)</th>
            <th className="px-3 py-2 text-right">Raccolto {anno} (t)</th>
            <th className="px-3 py-2 text-right">% del contratto</th>
            <th className="px-3 py-2 text-right">Atteso a oggi (t)</th>
            <th className="px-3 py-2 text-right">Scarto sull'atteso (t)</th>
          </tr>
        </thead>
        <tbody>
          {righe.map(r => (
            <tr key={r.regione} className="border-t">
              <td className="px-3 py-2 font-medium">{r.regione}</td>
              <td className="px-3 py-2 text-xs text-muted-foreground">{r.province || '—'}</td>
              <td className="px-3 py-2 text-right tabular-nums">{tonnellate(r.contratto)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{tonnellate(r.raccolto)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.percentuale !== null ? `${tonnellate(r.percentuale)}%` : '—'}</td>
              <td className="px-3 py-2 text-right tabular-nums">{tonnellate(r.atteso)}</td>
              <td className={`px-3 py-2 text-right tabular-nums font-medium ${r.scarto >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{r.scarto >= 0 ? '+' : ''}{tonnellate(r.scarto)}</td>
            </tr>
          ))}
          <tr className="border-t-2 font-semibold bg-muted/30">
            <td className="px-3 py-2" colSpan={2}>Totale</td>
            <td className="px-3 py-2 text-right tabular-nums">{tonnellate(tot.contratto)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{tonnellate(tot.raccolto)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{tot.contratto ? `${tonnellate((tot.raccolto / tot.contratto) * 100)}%` : '—'}</td>
            <td className="px-3 py-2 text-right tabular-nums">{tonnellate(tot.atteso)}</td>
            <td className={`px-3 py-2 text-right tabular-nums ${tot.raccolto - tot.atteso >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{tot.raccolto - tot.atteso >= 0 ? '+' : ''}{tonnellate(tot.raccolto - tot.atteso)}</td>
          </tr>
        </tbody>
      </table>
      <p className="px-3 py-2 text-xs text-muted-foreground border-t">
        Raccolto rete e ACI dei formulari terminati, per data di fine trasporto. L'atteso a oggi ripartisce il contratto di ogni regione secondo il target mensile
        {totaleProfilo > 0 ? ' rivisto' : ''} del contratto{totaleProfilo > 0 ? '' : ', che non è ancora inserito: per ora in dodicesimi'}.
      </p>
    </div>
  );
}

export default function TargetStatus() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [params, setParams] = useSearchParams();
  const scheda = SCHEDE.includes(params.get('tab')) ? params.get('tab') : 'andamento';
  const [anno, setAnno] = useState(new Date().getFullYear());
  const [raccolto, setRaccolto] = useState(null);
  const [raccoltoAci, setRaccoltoAci] = useState(null);
  const [targets, setTargets] = useState([]);
  const [annui, setAnnui] = useState([]);
  const [commessa, setCommessa] = useState(null);
  const [impiantoTargets, setImpiantoTargets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [meseSelezionato, setMeseSelezionato] = useState(getMeseCorrente());
  const [filters, setFilters] = useState({ mese: [], regione: [], raccoglitore: [], impianto: [] });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [raccoltoRes, aciRes, targetRes, annuiRes, commessaRes, impTargetRes] = await Promise.all([
        base44.functions.invoke('computeRaccolto', { filters: { ...filters, anno: [anno], canale: 'rete' } }),
        base44.functions.invoke('computeRaccolto', { filters: { anno: [anno], canale: 'aci' } }).catch(() => null),
        fetchAllClient(base44.entities.TargetMensile, { anno }),
        fetchAllClient(base44.entities.TargetRaccoglitore, { anno }),
        base44.entities.CommessaEcotyre.filter({ anno }).catch(() => []),
        fetchAllClient(base44.entities.ImpiantoTarget),
      ]);
      setRaccolto(raccoltoRes.data);
      setRaccoltoAci(aciRes ? aciRes.data : null);
      setTargets(targetRes);
      setAnnui(annuiRes);
      setCommessa(commessaRes[0] || null);
      setImpiantoTargets(impTargetRes.filter(t => !t.anno || Number(t.anno) === anno));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [filters, anno]);

  useEffect(() => { if (scheda === 'andamento') loadData(); }, [scheda, loadData]);

  const filterOptions = raccolto?.filterOptions || { mesi: MESI, regioni: [], raccoglitori: [], impianti: [] };

  // Target e raccolto per raccoglitore e regione. I target sono per impianto e si
  // sommano; i nomi si confrontano normalizzati.
  const mergedData = useMemo(() => {
    if (!raccolto) return [];
    const righe = new Map();
    const riga = (nome, regione) => {
      const k = `${normalizzaRagioneSociale(nome || '')}|||${regione || ''}`;
      if (!righe.has(k)) righe.set(k, { raccoglitore: nome, regione: regione || '', target: {}, racc: null, annuo: 0, nomi: new Set() });
      const r = righe.get(k);
      r.nomi.add(nome);
      return r;
    };
    for (const t of targets) {
      const r = riga(t.raccoglitore, t.regione);
      r.target[t.mese] = (r.target[t.mese] || 0) + (t.non_raccoglie ? 0 : Number(t.target) || 0);
    }
    for (const x of raccolto.by_raccoglitore) riga(x.raccoglitore, x.regione).racc = x;
    for (const a of annui) {
      const nome = normalizzaRagioneSociale(a.raccoglitore || '');
      let candidati = [...righe.values()].filter(r => normalizzaRagioneSociale(r.raccoglitore) === nome && (!a.regione || r.regione === a.regione));
      if (!a.regione && candidati.length > 1) candidati = [candidati.sort((x, y) => ((y.racc && y.racc.totale) || 0) - ((x.racc && x.racc.totale) || 0))[0]];
      (candidati[0] || riga(a.raccoglitore, a.regione)).annuo += Number(a.target_tonnellate) || 0;
    }
    return [...righe.values()].map(r => {
      const raccoltoTotale = r.racc ? r.racc.totale : 0;
      const mesi = MESI.map(m => {
        const target = r.target[m] || 0;
        const racc = r.racc ? r.racc.mesi[m] || 0 : 0;
        return { mese: m, target, raccolto: racc, delta: target - racc };
      });
      return { raccoglitore: r.raccoglitore, regione: r.regione, targetAnnuo: r.annuo, raccoltoTotale, leftover: r.annuo - raccoltoTotale, mesi, nomi: [...r.nomi] };
    }).filter(row => {
      if (filters.regione.length > 0 && !filters.regione.includes(row.regione)) return false;
      if (filters.raccoglitore.length > 0 && !row.nomi.some(n => filters.raccoglitore.includes(n))) return false;
      return row.targetAnnuo || row.raccoltoTotale || row.mesi.some(m => m.target);
    }).sort((a, b) => a.regione.localeCompare(b.regione) || a.raccoglitore.localeCompare(b.raccoglitore));
  }, [raccolto, targets, annui, filters]);

  const regioneData = useMemo(() => {
    if (!raccolto) return [];
    const map = {};
    const ensure = (reg) => {
      if (!map[reg]) { map[reg] = { regione: reg, totale: 0, mesi: {} }; for (const m of MESI) map[reg].mesi[m] = { target: 0, raccolto: 0 }; }
      return map[reg];
    };
    for (const t of targets) {
      if (!t.regione || (filters.regione.length > 0 && !filters.regione.includes(t.regione))) continue;
      if (MESI.includes(t.mese) && !t.non_raccoglie) ensure(t.regione).mesi[t.mese].target += Number(t.target) || 0;
    }
    for (const r of raccolto.by_regione) {
      if (filters.regione.length > 0 && !filters.regione.includes(r.regione)) continue;
      const x = ensure(r.regione);
      x.totale += r.totale;
      for (const m of MESI) x.mesi[m].raccolto += r.mesi[m] || 0;
    }
    return Object.values(map).map(r => ({
      regione: r.regione,
      totale: r.totale,
      mesi: MESI.map(m => ({ mese: m, target: r.mesi[m].target, raccolto: r.mesi[m].raccolto, delta: r.mesi[m].target - r.mesi[m].raccolto })),
    }));
  }, [raccolto, targets, filters]);

  const impiantiData = useMemo(() => {
    if (!raccolto) return [];
    const impTargetMap = {};
    for (const t of impiantoTargets) impTargetMap[`${t.impianto}|${t.mese}`] = t.target || 0;
    return raccolto.by_impianto
      .filter(i => filters.impianto.length === 0 || filters.impianto.includes(i.impianto))
      .map(i => ({
        impianto: i.impianto,
        totale: i.totale,
        mesi: MESI.map(m => ({ mese: m, target: impTargetMap[`${i.impianto}|${m}`] || 0, raccolto: i.mesi[m] || 0, delta: (impTargetMap[`${i.impianto}|${m}`] || 0) - (i.mesi[m] || 0) })),
      }));
  }, [raccolto, impiantoTargets, filters]);

  const kpis = useMemo(() => {
    const targetAnnuoTotale = commessa && Number(commessa.target_annuo_t) > 0 ? Number(commessa.target_annuo_t) : (TARGET_BY_YEAR[anno] || 0);
    const raccoltoTotale = raccolto?.totale_raccolto || 0;
    const selectedMesi = filters.mese || [];
    const deltaMeseCorrente = mergedData.reduce((s, r) => {
      if (selectedMesi.length > 0) return s + r.mesi.filter(m => selectedMesi.includes(m.mese)).reduce((ds, m) => ds + m.delta, 0);
      const m = r.mesi.find(x => x.mese === getMeseCorrente());
      return s + (m ? m.delta : 0);
    }, 0);
    return { targetAnnuoTotale, raccoltoTotale, leftoverTotale: targetAnnuoTotale - raccoltoTotale, deltaMeseCorrente };
  }, [mergedData, raccolto, filters, commessa, anno]);

  const saveImpiantoTarget = async (impianto, mese, value) => {
    const existing = impiantoTargets.find(t => t.impianto === impianto && t.mese === mese);
    if (existing) {
      await base44.entities.ImpiantoTarget.update(existing.id, { target: value });
      setImpiantoTargets(prev => prev.map(t => (t.id === existing.id ? { ...t, target: value } : t)));
    } else {
      const created = await base44.entities.ImpiantoTarget.create({ impianto, mese, anno, target: value });
      setImpiantoTargets(prev => [...prev, created]);
    }
  };

  const hasFilters = Object.values(filters).some(v => (Array.isArray(v) ? v.length > 0 : v));
  const resetFilters = () => setFilters({ mese: [], regione: [], raccoglitore: [], impianto: [] });

  return (
    <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold">Target & Status</h1>
          <p className="text-muted-foreground mt-1">L'unico punto in cui si scrivono i target: contratto Ecotyre, raccoglitori, impianti e stoccaggi. Tutti i moduli leggono da qui.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={anno} onChange={e => setAnno(Number(e.target.value))} className="border rounded-md px-3 py-2 text-sm bg-background" title="Anno">
            {ANNI_TARGET.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          {scheda === 'andamento' && (
            <>
              <button onClick={loadData} className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-md hover:bg-accent">
                <RefreshCw className="w-4 h-4" /> Aggiorna
              </button>
              <ExportButtons onExcel={exportExcel} onPDF={() => exportPDF(kpis, mergedData, regioneData, impiantiData)} onPPT={() => exportPPT(kpis, mergedData, regioneData, impiantiData)} />
            </>
          )}
        </div>
      </div>

      <Tabs value={scheda} onValueChange={v => setParams({ tab: v }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="andamento">Andamento</TabsTrigger>
          <TabsTrigger value="raccoglitori">Target raccoglitori</TabsTrigger>
          <TabsTrigger value="commessa">Commessa Ecotyre</TabsTrigger>
          <TabsTrigger value="impianti">Impianti e stoccaggi</TabsTrigger>
        </TabsList>

        <TabsContent value="andamento" className="mt-4 space-y-6">
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium inline-flex items-center gap-1.5"><Filter className="w-4 h-4" /> Filtri {anno}</span>
              {hasFilters && <button onClick={resetFilters} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><X className="w-3 h-3" /> Reset</button>}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Mese</label>
                <MultiSelect allLabel="Tutti i mesi" options={MESI} selected={filters.mese} onChange={v => setFilters(p => ({ ...p, mese: v }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Regione</label>
                <MultiSelect allLabel="Tutte le regioni" options={filterOptions.regioni || []} selected={filters.regione} onChange={v => setFilters(p => ({ ...p, regione: v }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Raccoglitore</label>
                <MultiSelect allLabel="Tutti i raccoglitori" options={filterOptions.raccoglitori || []} selected={filters.raccoglitore} onChange={v => setFilters(p => ({ ...p, raccoglitore: v }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Impianto</label>
                <MultiSelect allLabel="Tutti gli impianti" options={filterOptions.impianti || []} selected={filters.impianto} onChange={v => setFilters(p => ({ ...p, impianto: v }))} />
              </div>
            </div>
          </div>

          {loading || !raccolto ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Caricamento dati…</div>
          ) : (
            <>
              <KpiCards kpis={kpis} />
              <div>
                <h2 className="text-lg font-heading font-semibold mb-3">Raccolta RETE per regione e contratto</h2>
                <AndamentoRegioni raccolto={raccolto} commessa={commessa} anno={anno} />
              </div>
              <div>
                <h2 className="text-lg font-heading font-semibold mb-1">Report generale</h2>
                <p className="text-xs text-muted-foreground mb-3">Target assegnati e raccolto RETE per impianto, regione e raccoglitore, come nel foglio del file di gestione.</p>
                <ReportGenerale anno={anno} mensili={targets} annui={annui} raccolto={raccolto} commessa={commessa} />
              </div>
              <div>
                <h2 className="text-lg font-heading font-semibold mb-1">Target e raccolto per raccoglitore</h2>
                <p className="text-xs text-muted-foreground mb-3">Solo lettura: i target si modificano nella scheda Target raccoglitori.</p>
                <TargetTable data={mergedData} />
              </div>
              <TargetChart data={mergedData} mese={meseSelezionato} onMeseChange={setMeseSelezionato} />
              <div>
                <h2 className="text-lg font-heading font-semibold mb-3">Target e scostamento per regione, mese per mese</h2>
                <RegionTable data={regioneData} />
              </div>
              <div>
                <h2 className="text-lg font-heading font-semibold mb-3">Progressivo e avanzamento impianti</h2>
                <ImpiantiTable data={impiantiData} onSaveTarget={saveImpiantoTarget} />
              </div>
              <div>
                <h2 className="text-lg font-heading font-semibold mb-1">Canale ACI</h2>
                <p className="text-xs text-muted-foreground mb-3">Ritiri dai centri di demolizione, separati dalla RETE.</p>
                <CanaleAci raccoltoAci={raccoltoAci} commessa={commessa} anno={anno} />
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="raccoglitori" className="mt-4">
          {scheda === 'raccoglitori' && <TargetRaccoglitoriGrid anno={anno} isAdmin={isAdmin} user={user} />}
        </TabsContent>

        <TabsContent value="commessa" className="mt-4">
          {scheda === 'commessa' && <CommessaEcotyreForm anno={anno} isAdmin={isAdmin} user={user} />}
        </TabsContent>

        <TabsContent value="impianti" className="mt-4">
          {scheda === 'impianti' && <TargetAnnuali incorporato anno={anno} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
