import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { MESI, meseCorrente as getMeseCorrente } from '@/lib/pfuConstants';
import { exportExcel, exportPDF, exportPPT } from '@/lib/statusExports';
import KpiCards from '@/components/target-status/KpiCards';
import TargetTable from '@/components/target-status/TargetTable';
import RegionTable from '@/components/target-status/RegionTable';
import ImpiantiTable from '@/components/target-status/ImpiantiTable';
import TargetChart from '@/components/target-status/TargetChart';
import ExportButtons from '@/components/target-status/ExportButtons';
import MultiSelect from '@/components/shared/MultiSelect';
import { Loader2, RefreshCw, Filter, X } from 'lucide-react';

const TARGET_BY_YEAR = { 2025: 11200, 2026: 11550 };
const getTargetForYear = (year) => TARGET_BY_YEAR[year] || (year >= 2026 ? 11550 : 11200);

export default function TargetStatus() {
  const [raccolto, setRaccolto] = useState(null);
  const [targets, setTargets] = useState([]);
  const [impiantoTargets, setImpiantoTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meseSelezionato, setMeseSelezionato] = useState(getMeseCorrente());
  const [filters, setFilters] = useState({ anno: [], mese: [], regione: [], raccoglitore: [], impianto: [] });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [raccoltoRes, targetRes, impTargetRes] = await Promise.all([
        base44.functions.invoke('computeRaccolto', { filters }),
        base44.entities.TargetMensile.list('-created_date', 10000),
        base44.entities.ImpiantoTarget.list('-created_date', 10000),
      ]);
      setRaccolto(raccoltoRes.data);
      setTargets(targetRes);
      setImpiantoTargets(impTargetRes);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [filters]);

  useEffect(() => { loadData(); }, [loadData]);

  const filterOptions = raccolto?.filterOptions || { anni: [], mesi: MESI, regioni: [], raccoglitori: [], impianti: [] };

  // Merged data: raccoglitori with targets + raccolto
  const mergedData = useMemo(() => {
    if (!raccolto) return [];
    const targetMap = {};
    const targetAnnuoMap = {};
    const allKeys = new Set();
    for (const t of targets) {
      const key = `${t.raccoglitore}|||${t.regione}`;
      allKeys.add(key);
      targetMap[`${key}|${t.mese}`] = t.target || 0;
      if (t.target_annuo != null) targetAnnuoMap[key] = t.target_annuo;
    }
    const raccMap = {};
    for (const r of raccolto.by_raccoglitore) {
      const key = `${r.raccoglitore}|||${r.regione}`;
      allKeys.add(key);
      raccMap[key] = r;
    }
    return Array.from(allKeys).map((key) => {
      const [raccoglitore, regione] = key.split('|||');
      const r = raccMap[key];
      const targetAnnuo = targetAnnuoMap[key] || 0;
      const raccoltoTotale = r?.totale || 0;
      const leftover = targetAnnuo - raccoltoTotale;
      const mesi = MESI.map((m) => ({
        mese: m,
        target: targetMap[`${key}|${m}`] || 0,
        raccolto: r?.mesi[m] || 0,
        delta: (targetMap[`${key}|${m}`] || 0) - (r?.mesi[m] || 0),
      }));
      return { raccoglitore, regione, targetAnnuo, raccoltoTotale, leftover, mesi };
    }).filter(row => {
      if (filters.regione.length > 0 && !filters.regione.includes(row.regione)) return false;
      if (filters.raccoglitore.length > 0 && !filters.raccoglitore.includes(row.raccoglitore)) return false;
      return true;
    }).sort((a, b) => a.regione.localeCompare(b.regione) || a.raccoglitore.localeCompare(b.raccoglitore));
  }, [raccolto, targets, filters]);

  // Region table data
  const regioneData = useMemo(() => {
    if (!raccolto) return [];
    const map = {};
    for (const t of targets) {
      if (filters.regione.length > 0 && !filters.regione.includes(t.regione)) continue;
      if (!map[t.regione]) { map[t.regione] = { regione: t.regione, totale: 0, mesi: {} }; for (const m of MESI) map[t.regione].mesi[m] = { target: 0, raccolto: 0 }; }
      if (t.target) map[t.regione].mesi[t.mese].target += t.target;
    }
    for (const r of raccolto.by_regione) {
      if (filters.regione.length > 0 && !filters.regione.includes(r.regione)) continue;
      if (!map[r.regione]) { map[r.regione] = { regione: r.regione, totale: 0, mesi: {} }; for (const m of MESI) map[r.regione].mesi[m] = { target: 0, raccolto: 0 }; }
      map[r.regione].totale += r.totale;
      for (const m of MESI) map[r.regione].mesi[m].raccolto += r.mesi[m] || 0;
    }
    return Object.values(map).map((r) => ({
      regione: r.regione,
      totale: r.totale,
      mesi: MESI.map((m) => ({ mese: m, target: r.mesi[m].target, raccolto: r.mesi[m].raccolto, delta: r.mesi[m].target - r.mesi[m].raccolto })),
    }));
  }, [raccolto, targets, filters]);

  // Impianti data
  const impiantiData = useMemo(() => {
    if (!raccolto) return [];
    const impTargetMap = {};
    for (const t of impiantoTargets) impTargetMap[`${t.impianto}|${t.mese}`] = t.target || 0;
    return raccolto.by_impianto
      .filter(i => filters.impianto.length === 0 || filters.impianto.includes(i.impianto))
      .map((i) => ({
        impianto: i.impianto,
        totale: i.totale,
        mesi: MESI.map((m) => ({
          mese: m,
          target: impTargetMap[`${i.impianto}|${m}`] || 0,
          raccolto: i.mesi[m] || 0,
          delta: (impTargetMap[`${i.impianto}|${m}`] || 0) - (i.mesi[m] || 0),
        })),
      }));
  }, [raccolto, impiantoTargets, filters]);

  // KPIs
  const kpis = useMemo(() => {
    const selectedAnni = filters.anno || [];
    const targetAnnuoTotale = selectedAnni.length === 1
      ? getTargetForYear(Number(selectedAnni[0]))
      : selectedAnni.length > 1
        ? selectedAnni.reduce((s, a) => s + getTargetForYear(Number(a)), 0)
        : getTargetForYear(new Date().getFullYear());

    const raccoltoTotale = raccolto?.totale_raccolto || 0;
    const leftoverTotale = targetAnnuoTotale - raccoltoTotale;
    const selectedMesi = filters.mese || [];
    const deltaMeseCorrente = mergedData.reduce((s, r) => {
      if (selectedMesi.length > 0) {
        return s + r.mesi.filter(m => selectedMesi.includes(m.mese)).reduce((ds, m) => ds + m.delta, 0);
      }
      const mc = getMeseCorrente();
      const m = r.mesi.find((x) => x.mese === mc);
      return s + (m ? m.delta : 0);
    }, 0);
    return { targetAnnuoTotale, raccoltoTotale, leftoverTotale, deltaMeseCorrente };
  }, [mergedData, raccolto, filters]);

  // Save handlers
  const saveTargetAnnuo = async (raccoglitore, regione, value) => {
    const existing = targets.filter((t) => t.raccoglitore === raccoglitore && t.regione === regione);
    if (existing.length === 0) {
      const created = await base44.entities.TargetMensile.bulkCreate(
        MESI.map((m) => ({ raccoglitore, regione, mese: m, anno: new Date().getFullYear(), target: 0, target_annuo: value }))
      );
      setTargets((prev) => [...prev, ...created]);
    } else {
      await base44.entities.TargetMensile.updateMany({ raccoglitore, regione }, { $set: { target_annuo: value } });
      setTargets((prev) => prev.map((t) => (t.raccoglitore === raccoglitore && t.regione === regione ? { ...t, target_annuo: value } : t)));
    }
  };

  const saveTargetMensile = async (raccoglitore, regione, mese, value) => {
    const existing = targets.find((t) => t.raccoglitore === raccoglitore && t.regione === regione && t.mese === mese);
    if (existing) {
      await base44.entities.TargetMensile.update(existing.id, { target: value });
      setTargets((prev) => prev.map((t) => (t.id === existing.id ? { ...t, target: value } : t)));
    } else {
      const created = await base44.entities.TargetMensile.create({ raccoglitore, regione, mese, anno: new Date().getFullYear(), target: value, target_annuo: 0 });
      setTargets((prev) => [...prev, created]);
    }
  };

  const saveImpiantoTarget = async (impianto, mese, value) => {
    const existing = impiantoTargets.find((t) => t.impianto === impianto && t.mese === mese);
    if (existing) {
      await base44.entities.ImpiantoTarget.update(existing.id, { target: value });
      setImpiantoTargets((prev) => prev.map((t) => (t.id === existing.id ? { ...t, target: value } : t)));
    } else {
      const created = await base44.entities.ImpiantoTarget.create({ impianto, mese, anno: new Date().getFullYear(), target: value });
      setImpiantoTargets((prev) => [...prev, created]);
    }
  };

  const hasFilters = Object.values(filters).some(v => Array.isArray(v) ? v.length > 0 : v);
  const resetFilters = () => setFilters({ anno: [], mese: [], regione: [], raccoglitore: [], impianto: [] });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Caricamento dati...
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold">Status & Target Management</h1>
          <p className="text-muted-foreground mt-1">Monitoraggio avanzamento commessa PFU Ecotyre — Target, raccolto e scostamenti in tempo reale.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData} className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-md hover:bg-accent">
            <RefreshCw className="w-4 h-4" /> Aggiorna
          </button>
          <ExportButtons onExcel={exportExcel} onPDF={() => exportPDF(kpis, mergedData, regioneData, impiantiData)} onPPT={() => exportPPT(kpis, mergedData, regioneData, impiantiData)} />
        </div>
      </div>

      {/* Filtri */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium inline-flex items-center gap-1.5"><Filter className="w-4 h-4" /> Filtri</span>
          {hasFilters && (
            <button onClick={resetFilters} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <X className="w-3 h-3" /> Reset
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Anno</label>
            <MultiSelect allLabel="Tutti gli anni" options={(filterOptions.anni || []).map(String)} selected={filters.anno.map(String)} onChange={v => setFilters(p => ({ ...p, anno: v.map(Number) }))} />
          </div>
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

      <KpiCards kpis={kpis} />

      <div>
        <h2 className="text-lg font-heading font-semibold mb-3">Target & Performance Raccoglitori</h2>
        <TargetTable data={mergedData} onSaveTargetAnnuo={saveTargetAnnuo} onSaveTargetMensile={saveTargetMensile} />
      </div>

      <TargetChart data={mergedData} mese={meseSelezionato} onMeseChange={setMeseSelezionato} />

      <div>
        <h2 className="text-lg font-heading font-semibold mb-3">Target e Scostamento per Regione</h2>
        <RegionTable data={regioneData} />
      </div>

      <div>
        <h2 className="text-lg font-heading font-semibold mb-3">Progressivo e Avanzamento Impianti</h2>
        <ImpiantiTable data={impiantiData} onSaveTarget={saveImpiantoTarget} />
      </div>
    </div>
  );
}