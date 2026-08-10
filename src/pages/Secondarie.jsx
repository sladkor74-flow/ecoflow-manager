import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, FileSpreadsheet, Filter, X, Table2, LayoutGrid, Route } from 'lucide-react';
import SecondarieUpload from '@/components/secondarie/SecondarieUpload';
import SecondarieKpi from '@/components/secondarie/SecondarieKpi';
import TrattaMatrix from '@/components/secondarie/TrattaMatrix';
import SecondarieTable from '@/components/secondarie/SecondarieTable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Secondarie() {
  const [data, setData] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState({ stoccaggio: '', destinazione: '', mese: '', settimana: '', classe: '', trasportatore: '', anno: '' });
  const [viewMode, setViewMode] = useState('matrix');

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
        if (filters.stoccaggio && (r.stoccaggio || '').trim() !== filters.stoccaggio) return false;
        if (filters.destinazione && (r.destinazione || '').trim() !== filters.destinazione) return false;
        if (filters.mese && r.mese !== filters.mese) return false;
        if (filters.settimana && String(r.settimane) !== String(filters.settimana)) return false;
        if (filters.classe && r.classe !== filters.classe) return false;
        if (filters.trasportatore && (r.trasportatore || '').trim() !== filters.trasportatore) return false;
        if (filters.anno) {
          const d = r.ordine_chiuso_il || r.trasporto_finito_il || r.ordine_immesso_il;
          const dt = d ? new Date(d) : null;
          const anno = dt && !isNaN(dt.getTime()) ? dt.getFullYear() : null;
          if (String(anno) !== String(filters.anno)) return false;
        }
        return true;
      }).map(r => ({ ...r, peso_t: +((r.peso_effettivo || r.peso_stimato || 0) / 1000).toFixed(2) }));
      setRecords(filtered);
    } catch (e) { console.error(e); }
    setLoadingRecords(false);
  }, [filters]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (viewMode === 'detail') loadRecords(); }, [loadRecords, viewMode]);

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

  const hasFilters = Object.values(filters).some(v => v);
  const resetFilters = () => setFilters({ stoccaggio: '', destinazione: '', mese: '', settimana: '', classe: '', trasportatore: '', anno: '' });
  const opts = data?.filterOptions || {};

  return (
    <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold">Secondarie — Trasporti tra Stoccaggi</h1>
          <p className="text-muted-foreground mt-1">Tracciamento, aggregazione e controllo dei trasporti secondari PFU per tratta operativa.</p>
        </div>
        <div className="flex items-center gap-2">
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
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <select value={filters.stoccaggio} onChange={e => setFilters(p => ({ ...p, stoccaggio: e.target.value }))} className="border rounded-md px-3 py-2 text-sm">
                <option value="">Tutte le origini</option>
                {opts.stoccaggi?.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={filters.destinazione} onChange={e => setFilters(p => ({ ...p, destinazione: e.target.value }))} className="border rounded-md px-3 py-2 text-sm">
                <option value="">Tutte le destinazioni</option>
                {opts.destinazioni?.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select value={filters.mese} onChange={e => setFilters(p => ({ ...p, mese: e.target.value }))} className="border rounded-md px-3 py-2 text-sm">
                <option value="">Tutti i mesi</option>
                {opts.mesi?.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <select value={filters.settimana} onChange={e => setFilters(p => ({ ...p, settimana: e.target.value }))} className="border rounded-md px-3 py-2 text-sm">
                <option value="">Tutte le settimane</option>
                {opts.settimane?.map(s => <option key={s} value={s}>Sett. {s}</option>)}
              </select>
              <select value={filters.classe} onChange={e => setFilters(p => ({ ...p, classe: e.target.value }))} className="border rounded-md px-3 py-2 text-sm">
                <option value="">Tutte le classi</option>
                {opts.classi?.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filters.trasportatore} onChange={e => setFilters(p => ({ ...p, trasportatore: e.target.value }))} className="border rounded-md px-3 py-2 text-sm">
                <option value="">Tutti i trasportatori</option>
                {opts.trasportatori?.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={filters.anno} onChange={e => setFilters(p => ({ ...p, anno: e.target.value }))} className="border rounded-md px-3 py-2 text-sm">
                <option value="">Tutti gli anni</option>
                {opts.anni?.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
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
                  <SecondarieTable records={records} loading={loadingRecords} />
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
                        <td className="px-3 py-2 text-right">{c.ordini.toLocaleString('it-IT')}</td>
                        <td className="px-3 py-2 text-right">{(c.peso_kg / 1000).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
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