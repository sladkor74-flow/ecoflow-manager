import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, FileSpreadsheet, Filter, X, Table2, LayoutGrid, Route } from 'lucide-react';
import AlertBadge from '@/components/alerts/AlertBadge';
import SecondarieUpload from '@/components/secondarie/SecondarieUpload';
import SecondarieKpi from '@/components/secondarie/SecondarieKpi';
import TrattaMatrix from '@/components/secondarie/TrattaMatrix';
import SecondarieTable from '@/components/secondarie/SecondarieTable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getRegioneFromProvincia } from '@/lib/regioneMap';
import { fmtTon, formatNumber } from '@/lib/utils';
import MultiSelect from '@/components/shared/MultiSelect';

export default function Secondarie() {
  const [data, setData] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [filters, setFilters] = useState({ stoccaggio: [], destinazione: [], mese: [], settimana: [], classe: [], trasportatore: [], anno: [], provincia: [], regione: [], stato: [], data: '' });
  const [viewMode, setViewMode] = useState('matrix');
  const [searchIdOrdine, setSearchIdOrdine] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('computeSecondarieMatrix', { filters });
      setData(res.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [filters]);

  const loadRecords = useCallback(async () => {
    setLoadingRecords(true);
    try {
      const all = await base44.entities.Secondaria.list('-created_date', 10000);
      const filtered = all.filter(r => {
        if (searchIdOrdine && !(r.id_ordine || '').toLowerCase().includes(searchIdOrdine.toLowerCase().trim())) return false;
        if (filters.stoccaggio.length > 0 && !filters.stoccaggio.includes((r.stoccaggio || '').trim())) return false;
        if (filters.destinazione.length > 0 && !filters.destinazione.includes((r.destinazione || '').trim())) return false;
        if (filters.mese.length > 0 && !filters.mese.includes(r.mese)) return false;
        if (filters.settimana.length > 0 && !filters.settimana.map(String).includes(String(r.settimane))) return false;
        if (filters.classe.length > 0 && !filters.classe.includes(r.classe)) return false;
        if (filters.trasportatore.length > 0 && !filters.trasportatore.includes((r.trasportatore || '').trim())) return false;
        if (filters.provincia.length > 0 && !filters.provincia.includes((r.provincia || '').trim())) return false;
        if (filters.regione.length > 0) {
          const reg = r.regione || getRegioneFromProvincia(r.provincia);
          if (!filters.regione.includes((reg || '').trim())) return false;
        }
        if (filters.stato.length > 0 && !filters.stato.map(s => s.toLowerCase()).includes((r.stato || '').trim().toLowerCase())) return false;
        if (filters.data) {
          const d = r.ordine_chiuso_il || r.trasporto_finito_il || r.ordine_immesso_il;
          if (!d || new Date(d).toISOString().slice(0, 10) !== filters.data) return false;
        }
        if (filters.anno.length > 0) {
          const d = r.ordine_chiuso_il || r.trasporto_finito_il || r.ordine_immesso_il;
          const dt = d ? new Date(d) : null;
          const anno = dt && !isNaN(dt.getTime()) ? dt.getFullYear() : null;
          if (!filters.anno.map(String).includes(String(anno))) return false;
        }
        return true;
      }).map(r => ({ ...r, peso_t: +((r.peso_effettivo || r.peso_stimato || 0) / 1000).toFixed(3) }));
      setRecords(filtered);
    } catch (e) { console.error(e); }
    setLoadingRecords(false);
  }, [filters, searchIdOrdine]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (viewMode === 'detail') loadRecords(); }, [loadRecords, viewMode]);

  useEffect(() => {
    (async () => {
      try {
        const res = await base44.functions.invoke('getAlerts', { modulo: 'secondarie', solo_aperti: true });
        setAlertCount(res.data?.total || 0);
      } catch (e) { /* ignore */ }
    })();
  }, [loadData]);

  useEffect(() => {
    const unsub = base44.entities.UploadLog.subscribe((event) => {
      if (event.type === 'create' && event.data?.tipo_file === 'secondarie') loadData();
    });
    return unsub;
  }, [loadData]);

  const handleExport = async (mode) => {
    setExporting(true);
    try {
      const res = await base44.functions.invoke('exportSecondarie', { filters, mode });
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
  const resetFilters = () => setFilters({ stoccaggio: [], destinazione: [], mese: [], settimana: [], classe: [], trasportatore: [], anno: [], provincia: [], regione: [], stato: [], data: '' });
  const opts = data?.filterOptions || {};

  // Stati garantiti sempre presenti nel filtro, anche senza record (valori normalizzati in minuscolo)
  const GUARANTEED_STATI = ['assegnato', 'eseguito'];
  const statiOptions = [...new Set([
    ...(opts.stati || []).map(s => (s || '').trim().toLowerCase()),
    ...GUARANTEED_STATI
  ])].sort();
  const prettyStato = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

  // Messaggio vuoto personalizzato in base allo stato selezionato
  const getEmptyMessage = () => {
    if (filters.stato.length === 1) {
      const s = filters.stato[0].toLowerCase();
      if (s === 'eseguito') return 'Non sono presenti secondarie in stato di eseguito';
      if (s === 'assegnato') return 'Non sono presenti secondarie in stato di assegnato';
    }
    return 'Nessun trasporto secondario trovato.';
  };

  return (
    <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold">Secondarie — Trasporti tra Stoccaggi</h1>
          <p className="text-muted-foreground mt-1">Tracciamento, aggregazione e controllo dei trasporti secondari PFU per tratta operativa.</p>
        </div>
        <div className="flex items-center gap-2">
          {alertCount > 0 && <AlertBadge count={alertCount} modulo="secondarie" />}
          <button onClick={() => handleExport('matrix')} disabled={exporting} className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-md hover:bg-accent disabled:opacity-50">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LayoutGrid className="w-4 h-4" />} Excel Sintesi
          </button>
          <button onClick={() => handleExport('detail')} disabled={exporting} className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-md hover:bg-accent disabled:opacity-50">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} Excel Dettaglio
          </button>
        </div>
      </div>

      <SecondarieUpload onImported={loadData} />

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Calcolo matrici in corso...
        </div>
      ) : (
        <>
          <SecondarieKpi kpi={data?.kpi} byClasse={data?.byClasse} />

          {/* Filtri rapidi */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium inline-flex items-center gap-1.5"><Filter className="w-4 h-4" /> Filtri rapidi</span>
              {hasFilters && (
                <button onClick={resetFilters} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                  <X className="w-3 h-3" /> Reset
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <input type="text" value={searchIdOrdine} onChange={e => setSearchIdOrdine(e.target.value)} placeholder="Cerca ID ordine..." className="w-full border rounded-md px-3 py-2 text-sm" />
              <MultiSelect allLabel="Tutte le regioni" options={opts.regioni || []} selected={filters.regione} onChange={v => setFilters(p => ({ ...p, regione: v }))} />
              <MultiSelect allLabel="Tutti gli stati" options={statiOptions.map(s => ({ value: s, label: prettyStato(s) }))} selected={filters.stato} onChange={v => setFilters(p => ({ ...p, stato: v }))} />
              <input type="date" value={filters.data} onChange={e => setFilters(p => ({ ...p, data: e.target.value }))} className="border rounded-md px-3 py-2 text-sm" />
              <MultiSelect allLabel="Tutte le origini" options={opts.stoccaggi || []} selected={filters.stoccaggio} onChange={v => setFilters(p => ({ ...p, stoccaggio: v }))} />
              <MultiSelect allLabel="Tutte le destinazioni" options={opts.destinazioni || []} selected={filters.destinazione} onChange={v => setFilters(p => ({ ...p, destinazione: v }))} />
              <MultiSelect allLabel="Tutte le province" options={opts.province || []} selected={filters.provincia} onChange={v => setFilters(p => ({ ...p, provincia: v }))} />
              <MultiSelect allLabel="Tutti i mesi" options={opts.mesi || []} selected={filters.mese} onChange={v => setFilters(p => ({ ...p, mese: v }))} />
              <MultiSelect allLabel="Tutte le settimane" options={(opts.settimane || []).map(s => ({ value: String(s), label: `Sett. ${s}` }))} selected={filters.settimana} onChange={v => setFilters(p => ({ ...p, settimana: v }))} />
              <MultiSelect allLabel="Tutte le classi" options={opts.classi || []} selected={filters.classe} onChange={v => setFilters(p => ({ ...p, classe: v }))} />
              <MultiSelect allLabel="Tutti i trasportatori" options={opts.trasportatori || []} selected={filters.trasportatore} onChange={v => setFilters(p => ({ ...p, trasportatore: v }))} />
              <MultiSelect allLabel="Tutti gli anni" options={(opts.anni || []).map(a => String(a))} selected={filters.anno.map(String)} onChange={v => setFilters(p => ({ ...p, anno: v }))} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-3">
              <Tabs value={viewMode} onValueChange={setViewMode}>
                <TabsList>
                  <TabsTrigger value="matrix"><Route className="w-4 h-4 mr-1.5" /> Matrice per Tratta</TabsTrigger>
                  <TabsTrigger value="detail"><Table2 className="w-4 h-4 mr-1.5" /> Dettaglio Ordini</TabsTrigger>
                </TabsList>
                <TabsContent value="matrix" className="space-y-3 mt-3">
                  <h2 className="text-lg font-heading font-semibold">Matrice Tratte: Origine → Destinazione</h2>
                  <TrattaMatrix matrix={data?.matrix} />
                </TabsContent>
                <TabsContent value="detail" className="space-y-3 mt-3">
                  <h2 className="text-lg font-heading font-semibold">Dettaglio Trasporti Secondari ({records.length})</h2>
                  <SecondarieTable records={records} loading={loadingRecords} emptyMessage={getEmptyMessage()} />
                </TabsContent>
              </Tabs>
            </div>
            <div className="space-y-3">
              <h2 className="text-lg font-heading font-semibold">Sintesi per Classe PFU</h2>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Classe</th>
                      <th className="text-right px-3 py-2 font-medium">Ordini</th>
                      <th className="text-right px-3 py-2 font-medium">Peso (t)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.byClasse || []).map((c) => (
                      <tr key={c.classe} className="border-t hover:bg-muted/50">
                        <td className="px-3 py-2 font-medium">{c.classe}</td>
                        <td className="px-3 py-2 text-right">{formatNumber(c.ordini, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                        <td className="px-3 py-2 text-right">{fmtTon(c.peso_kg / 1000)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}