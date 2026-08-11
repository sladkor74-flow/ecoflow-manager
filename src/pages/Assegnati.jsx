import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, FileSpreadsheet, Filter, X, Table2, LayoutGrid, Search } from 'lucide-react';
import AssegnatiKpi from '@/components/assegnati/AssegnatiKpi';
import AssegnatiMatrix from '@/components/assegnati/AssegnatiMatrix';
import AssegnatiTable from '@/components/assegnati/AssegnatiTable';
import ProvinceRanking from '@/components/assegnati/ProvinceRanking';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Assegnati({ entity = 'Assegnato', title = 'Assegnati Rete — Backlog Richieste', description = 'Ordini in stato "assegnato" di classe diversa da PFU Autodemolizione, derivati automaticamente dal caricamento delle Primarie.' }) {
  const [data, setData] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState({ anno: '', mese: '', regione: '', provincia: '', partner_operativo: '', classe: '', stato: '', data: '', ragione_sociale: '' });
  const [ragioneSocialeInput, setRagioneSocialeInput] = useState('');
  const [viewMode, setViewMode] = useState('matrix');

  const applyRagioneSociale = () => setFilters(p => ({ ...p, ragione_sociale: ragioneSocialeInput }));

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('computeAssegnatiMatrix', { filters, entity });
      setData(res.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [filters]);

  const loadRecords = useCallback(async () => {
    setLoadingRecords(true);
    try {
      const all = await base44.entities[entity].list('-ordine_immesso_il', 10000);
      const filtered = all.filter(r => {
        if (filters.anno && String(r.anno) !== String(filters.anno)) return false;
        if (filters.mese && r.mese !== filters.mese) return false;
        if (filters.regione && r.regione !== filters.regione) return false;
        if (filters.provincia && (r.provincia || '').toUpperCase().trim() !== filters.provincia) return false;
        if (filters.partner_operativo && (r.partner_operativo || '').trim() !== filters.partner_operativo) return false;
        if (filters.classe && r.classe !== filters.classe) return false;
        if (filters.stato && (r.stato || '').trim() !== filters.stato) return false;
        if (filters.ragione_sociale) {
          const search = filters.ragione_sociale.toLowerCase().trim();
          if (!(r.ragione_sociale || '').toLowerCase().includes(search)) return false;
        }
        if (filters.data) {
          const d = r.ordine_immesso_il;
          if (!d || new Date(d).toISOString().slice(0, 10) !== filters.data) return false;
        }
        return true;
      }).map(r => ({ ...r, peso_t: +((r.peso_stimato || 0) / 1000).toFixed(2) }));
      setRecords(filtered);
    } catch (e) { console.error(e); }
    setLoadingRecords(false);
  }, [filters]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (viewMode === 'detail') loadRecords(); }, [loadRecords, viewMode]);

  // Auto-refresh on new uploads
  useEffect(() => {
    const unsub = base44.entities.UploadLog.subscribe((event) => {
      if (event.type === 'create' && event.data?.tipo_file === 'primarie') loadData();
    });
    return unsub;
  }, [loadData]);

  const handleExport = async (mode) => {
    setExporting(true);
    try {
      const res = await base44.functions.invoke('exportAssegnati', { filters, mode, entity });
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
  const resetFilters = () => { setFilters({ anno: '', mese: '', regione: '', provincia: '', partner_operativo: '', classe: '', stato: '', data: '', ragione_sociale: '' }); setRagioneSocialeInput(''); };
  const opts = data?.filterOptions || {};

  return (
    <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold">{title}</h1>
          <p className="text-muted-foreground mt-1">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleExport('matrix')} disabled={exporting} className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-md hover:bg-accent disabled:opacity-50">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LayoutGrid className="w-4 h-4" />} Excel Matrice
          </button>
          <button onClick={() => handleExport('detail')} disabled={exporting} className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-md hover:bg-accent disabled:opacity-50">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} Excel Dettaglio
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Calcolo matrice in corso...
        </div>
      ) : (
        <>
          <AssegnatiKpi kpi={data?.kpi} />

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
              <div className="col-span-full flex gap-2">
                <input
                  type="text"
                  placeholder="Cerca per ragione sociale produttore..."
                  value={ragioneSocialeInput}
                  onChange={e => setRagioneSocialeInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') applyRagioneSociale(); }}
                  className="border rounded-md px-3 py-2 text-sm flex-1"
                />
                <button onClick={applyRagioneSociale} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 whitespace-nowrap">
                  <Search className="w-4 h-4" /> Cerca
                </button>
              </div>
              <select value={filters.anno} onChange={e => setFilters(p => ({ ...p, anno: e.target.value }))} className="border rounded-md px-3 py-2 text-sm">
                <option value="">Tutti gli anni</option>
                {opts.anni?.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <select value={filters.mese} onChange={e => setFilters(p => ({ ...p, mese: e.target.value }))} className="border rounded-md px-3 py-2 text-sm">
                <option value="">Tutti i mesi</option>
                {opts.mesi?.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <select value={filters.regione} onChange={e => setFilters(p => ({ ...p, regione: e.target.value }))} className="border rounded-md px-3 py-2 text-sm">
                <option value="">Tutte le regioni</option>
                {opts.regioni?.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <select value={filters.provincia} onChange={e => setFilters(p => ({ ...p, provincia: e.target.value }))} className="border rounded-md px-3 py-2 text-sm">
                <option value="">Tutte le province</option>
                {opts.province?.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={filters.partner_operativo} onChange={e => setFilters(p => ({ ...p, partner_operativo: e.target.value }))} className="border rounded-md px-3 py-2 text-sm">
                <option value="">Tutti i partner</option>
                {opts.partner?.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={filters.classe} onChange={e => setFilters(p => ({ ...p, classe: e.target.value }))} className="border rounded-md px-3 py-2 text-sm">
                <option value="">Tutte le classi</option>
                {opts.classi?.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-3">
              <Tabs value={viewMode} onValueChange={setViewMode}>
                <TabsList>
                  <TabsTrigger value="matrix"><LayoutGrid className="w-4 h-4 mr-1.5" /> Matrice Aggregata</TabsTrigger>
                  <TabsTrigger value="detail"><Table2 className="w-4 h-4 mr-1.5" /> Dettaglio Ordini</TabsTrigger>
                </TabsList>
                <TabsContent value="matrix" className="space-y-3 mt-3">
                  <h2 className="text-lg font-heading font-semibold">Matrice Analitica Backlog</h2>
                  <AssegnatiMatrix matrix={data?.matrix} />
                </TabsContent>
                <TabsContent value="detail" className="space-y-3 mt-3">
                  <h2 className="text-lg font-heading font-semibold">Dettaglio Ordini Assegnati ({records.length})</h2>
                  <AssegnatiTable records={records} loading={loadingRecords} ragioneSocialeFilter={filters.ragione_sociale} />
                </TabsContent>
              </Tabs>
            </div>
            <div className="space-y-3">
              <h2 className="text-lg font-heading font-semibold">Concentrazione Geografica</h2>
              <ProvinceRanking ranking={data?.provinceRanking} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}