import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, FileSpreadsheet, Filter, X } from 'lucide-react';
import TerziarieKpi from '@/components/terziarie/TerziarieKpi';
import GiacenzeTable from '@/components/terziarie/GiacenzeTable';
import TerziarieTable from '@/components/terziarie/TerziarieTable';
import { getRegioneFromProvincia } from '@/lib/regioneMap';
import MultiSelect from '@/components/shared/MultiSelect';

const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const MATERIALI = ['PFU SFUSO', 'CIAB/CIPP', 'FERRO'];

function getMeseFromRecord(r) {
  if (r.mese) return r.mese;
  const d = r.ordine_chiuso_il || r.trasporto_finito_il || r.ordine_immesso_il;
  if (!d) return null;
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : MESI[dt.getMonth()];
}
function getMateriale(r) {
  if (r.peso_ciab_cipp) return 'CIAB/CIPP';
  if (r.ferro) return 'FERRO';
  return 'PFU SFUSO';
}

export default function Terziarie() {
  const [records, setRecords] = useState([]);
  const [giacenze, setGiacenze] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingGiac, setLoadingGiac] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState({ impianto: [], destinazione: [], mese: [], trasportatore: [], materiale: [], anno: [], provincia: [], regione: [], stato: [], data: '' });
  const [filterOptions, setFilterOptions] = useState({ impianti: [], destinazioni: [], trasportatori: [], anni: [], province: [], regioni: [], stati: [] });
  const [searchIdOrdine, setSearchIdOrdine] = useState('');

  const loadGiacenze = useCallback(async () => {
    setLoadingGiac(true);
    try {
      const res = await base44.functions.invoke('computeGiacenze', { filters: { impianto: filters.impianto, mese: filters.mese, anno: filters.anno } });
      setGiacenze(res.data.giacenze);
    } catch (e) { console.error(e); }
    setLoadingGiac(false);
  }, [filters.impianto, filters.mese, filters.anno]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const all = await base44.entities.Terziaria.list('-created_date', 10000);
      // Build filter options
      setFilterOptions({
        impianti: [...new Set(all.map(r => (r.unita_locale_origine || '').trim()).filter(Boolean))].sort(),
        destinazioni: [...new Set(all.map(r => (r.destinazione || '').trim()).filter(Boolean))].sort(),
        trasportatori: [...new Set(all.map(r => (r.trasportatore || '').trim()).filter(Boolean))].sort(),
        province: [...new Set(all.map(r => (r.provincia || '').trim()).filter(Boolean))].sort(),
        regioni: [...new Set(all.map(r => (getRegioneFromProvincia(r.provincia) || '').trim()).filter(Boolean))].sort(),
        stati: [...new Set(all.map(r => (r.stato || '').trim()).filter(Boolean))].sort(),
        anni: [...new Set(all.map(r => {
          const d = r.ordine_chiuso_il || r.trasporto_finito_il || r.ordine_immesso_il;
          if (!d) return null;
          const dt = new Date(d);
          return isNaN(dt.getTime()) ? null : dt.getFullYear();
        }).filter(Boolean))].sort(),
      });
      // Apply filters
      const filtered = all.filter((r) => {
        if (searchIdOrdine && !(r.id_ordine || '').toLowerCase().includes(searchIdOrdine.toLowerCase().trim())) return false;
        if (filters.impianto.length > 0 && !filters.impianto.includes((r.unita_locale_origine || '').trim())) return false;
        if (filters.destinazione.length > 0 && !filters.destinazione.includes((r.destinazione || '').trim())) return false;
        if (filters.provincia.length > 0 && !filters.provincia.includes((r.provincia || '').trim())) return false;
        if (filters.regione.length > 0 && !filters.regione.includes((getRegioneFromProvincia(r.provincia) || '').trim())) return false;
        if (filters.stato.length > 0 && !filters.stato.includes((r.stato || '').trim())) return false;
        if (filters.data) {
          const d = r.ordine_chiuso_il || r.trasporto_finito_il || r.ordine_immesso_il;
          if (!d || new Date(d).toISOString().slice(0, 10) !== filters.data) return false;
        }
        if (filters.mese.length > 0 && !filters.mese.includes(getMeseFromRecord(r))) return false;
        if (filters.trasportatore.length > 0 && !filters.trasportatore.includes((r.trasportatore || '').trim())) return false;
        if (filters.materiale.length > 0 && !filters.materiale.includes(getMateriale(r))) return false;
        if (filters.anno.length > 0) {
          const d = r.ordine_chiuso_il || r.trasporto_finito_il || r.ordine_immesso_il;
          const dt = d ? new Date(d) : null;
          const anno = dt && !isNaN(dt.getTime()) ? dt.getFullYear() : null;
          if (!filters.anno.map(String).includes(String(anno))) return false;
        }
        return true;
      }).map(r => ({ ...r, mese: getMeseFromRecord(r), materiale: getMateriale(r), peso_t: +((r.peso_effettivo || 0) / 1000).toFixed(3) }));
      setRecords(filtered);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [filters, searchIdOrdine]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { loadGiacenze(); }, [loadGiacenze]);

  // Auto-refresh on new uploads
  useEffect(() => {
    const unsub = base44.entities.UploadLog.subscribe((event) => {
      if (event.type === 'create') { loadData(); loadGiacenze(); }
    });
    return unsub;
  }, [loadData, loadGiacenze]);

  const kpi = {
    totale_t: records.reduce((s, r) => s + (r.peso_t || 0), 0),
    spedizioni: records.length,
    impianti_attivi: new Set(records.map(r => r.unita_locale_origine).filter(Boolean)).size,
    giacenza_totale: giacenze.reduce((s, g) => s + (g.giacenza_t || 0), 0),
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await base44.functions.invoke('exportTerziarie', { filters });
      const blob = await (await fetch(`data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${res.data.file_base64}`)).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.data.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
    setExporting(false);
  };

  const hasFilters = Object.values(filters).some(v => Array.isArray(v) ? v.length > 0 : v) || searchIdOrdine;
  const resetFilters = () => setFilters({ impianto: [], destinazione: [], mese: [], trasportatore: [], materiale: [], anno: [], provincia: [], regione: [], stato: [], data: '' });

  return (
    <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold">Terziarie</h1>
          <p className="text-muted-foreground mt-1">Trasporti terziari, uscite PFU e giacenze impianto in tempo reale.</p>
        </div>
        <button onClick={handleExport} disabled={exporting} className="inline-flex items-center gap-2 px-4 py-2 text-sm border rounded-md hover:bg-accent disabled:opacity-50">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} Esporta Excel
        </button>
      </div>

      <TerziarieKpi kpi={kpi} />

      {/* Filters */}
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
          <input type="text" value={searchIdOrdine} onChange={e => setSearchIdOrdine(e.target.value)} placeholder="Cerca ID ordine..." className="w-full border rounded-md px-3 py-2 text-sm" />
          <MultiSelect allLabel="Tutte le regioni" options={filterOptions.regioni || []} selected={filters.regione} onChange={v => setFilters(p => ({ ...p, regione: v }))} />
          <MultiSelect allLabel="Tutti gli stati" options={filterOptions.stati || []} selected={filters.stato} onChange={v => setFilters(p => ({ ...p, stato: v }))} />
          <input type="date" value={filters.data} onChange={e => setFilters(p => ({ ...p, data: e.target.value }))} className="border rounded-md px-3 py-2 text-sm" />
          <MultiSelect allLabel="Tutti gli impianti" options={filterOptions.impianti || []} selected={filters.impianto} onChange={v => setFilters(p => ({ ...p, impianto: v }))} />
          <MultiSelect allLabel="Tutte le destinazioni" options={filterOptions.destinazioni || []} selected={filters.destinazione} onChange={v => setFilters(p => ({ ...p, destinazione: v }))} />
          <MultiSelect allLabel="Tutte le province" options={filterOptions.province || []} selected={filters.provincia} onChange={v => setFilters(p => ({ ...p, provincia: v }))} />
          <MultiSelect allLabel="Tutti i mesi" options={MESI} selected={filters.mese} onChange={v => setFilters(p => ({ ...p, mese: v }))} />
          <MultiSelect allLabel="Tutti i trasportatori" options={filterOptions.trasportatori || []} selected={filters.trasportatore} onChange={v => setFilters(p => ({ ...p, trasportatore: v }))} />
          <MultiSelect allLabel="Tutti i materiali" options={MATERIALI} selected={filters.materiale} onChange={v => setFilters(p => ({ ...p, materiale: v }))} />
          <MultiSelect allLabel="Tutti gli anni" options={(filterOptions.anni || []).map(a => String(a))} selected={filters.anno.map(String)} onChange={v => setFilters(p => ({ ...p, anno: v }))} />
        </div>
      </div>

      {/* Giacenze real-time */}
      <div className="space-y-3">
        <h2 className="text-lg font-heading font-semibold">Giacenze Impianto (Real-Time)</h2>
        <GiacenzeTable giacenze={giacenze} loading={loadingGiac} />
      </div>

      {/* Data table */}
      <div className="space-y-3">
        <h2 className="text-lg font-heading font-semibold">Dettaglio Trasporti Terziari ({records.length})</h2>
        <TerziarieTable records={records} loading={loading} />
      </div>
    </div>
  );
}