import React, { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import GlobalFilters from '@/components/report-pivot/GlobalFilters';
import PivotTreeTable from '@/components/report-pivot/PivotTreeTable';
import PivotDetailTable from '@/components/report-pivot/PivotDetailTable';
import DrillDownModal from '@/components/report-pivot/DrillDownModal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, RefreshCw, FileSpreadsheet } from 'lucide-react';

const PIVOT_DEFS = {
  A: { title: 'Pivot A — Raccolta (Terminati Rete)', type: 'tree', source: 'primaria_rete', rowLabels: ['Raccoglitore', 'Regione', 'Classe'] },
  B: { title: 'Pivot B — Impianti (Terminati Rete)', type: 'tree', source: 'primaria_rete', rowLabels: ['Impianto', 'Classe'] },
  C: { title: 'Pivot C — ACI (Terminati ACI)', type: 'tree', source: 'primaria_aci', rowLabels: ['Raccoglitore', 'Regione', 'Classe'] },
  D: { title: 'Pivot D — Secondarie', type: 'tree', source: 'secondaria', rowLabels: ['Impianto', 'Classe'] },
  E: { title: 'Pivot E — Dettaglio FIR (Rete)', type: 'detail', source: 'primaria_rete', rowLabels: ['Classe', 'Mese', 'Settimana'] },
  F: { title: 'Pivot F — Dettaglio FIR (Secondarie)', type: 'detail', source: 'secondaria', rowLabels: ['Classe', 'Mese', 'Settimana'] },
  G: { title: 'Pivot G — Dettaglio FIR (ACI)', type: 'detail', source: 'primaria_aci', rowLabels: ['Classe', 'Mese', 'Settimana'] },
  H: { title: 'Pivot H — Richieste Aperte (Assegnati)', type: 'tree', source: 'assegnato', rowLabels: ['Anno', 'Regione', 'Provincia', 'Ragione Sociale'] },
};

const TAB_PIVOTS = {
  A: ['A'],
  B: ['B'],
  C: ['C'],
  D: ['D'],
  EFG: ['E', 'F', 'G'],
  H: ['H'],
};

const ROW_LABEL_TO_FILTER = {
  'Raccoglitore': 'raccoglitore', 'Regione': 'regione', 'Classe': 'classe',
  'Mese': 'mese', 'Settimana': 'settimana', 'Anno': 'anno',
  'Provincia': 'provincia', 'Ragione Sociale': 'ragione_sociale', 'Impianto': 'impianto',
};

export default function ReportMensile() {
  const [pivots, setPivots] = useState({});
  const [filterOptions, setFilterOptions] = useState(null);
  const [filters, setFilters] = useState({ mese: [], raccoglitore: [], anno: [], settimana: [] });
  const [activeTab, setActiveTab] = useState('A');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [drillDown, setDrillDown] = useState({ open: false, loading: false, title: '', records: [], total: 0 });
  const loadedKeysRef = useRef(new Set());

  // Reset cache when filters change
  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters);
    loadedKeysRef.current = new Set();
    setPivots({});
    setFilterOptions(null);
  };

  // Load pivots for the active tab
  useEffect(() => {
    const needed = TAB_PIVOTS[activeTab] || [];
    const toLoad = needed.filter(k => !loadedKeysRef.current.has(k));
    if (toLoad.length === 0) { setLoading(false); return; }

    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await base44.functions.invoke('computePivotData', { filters, pivotKey: toLoad });
        if (cancelled) return;
        setPivots(prev => ({ ...prev, ...res.data }));
        if (res.data.filterOptions) setFilterOptions(res.data.filterOptions);
        toLoad.forEach(k => loadedKeysRef.current.add(k));
      } catch (e) {
        console.error(e);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [activeTab, filters]);

  // Auto-refresh on new uploads
  useEffect(() => {
    const unsubscribe = base44.entities.UploadLog.subscribe((event) => {
      if (event.type === 'create') {
        loadedKeysRef.current = new Set();
        setPivots({});
        setFilterOptions(null);
      }
    });
    return unsubscribe;
  }, []);

  const handleCellClick = async (pivotKey, path, columnKey, valueKey) => {
    const def = PIVOT_DEFS[pivotKey];
    const drillFilters = { ...filters };
    for (let i = 0; i < path.length; i++) {
      const filterField = ROW_LABEL_TO_FILTER[def.rowLabels[i]];
      if (filterField) drillFilters[filterField] = path[i];
    }
    if (def.type === 'tree' && columnKey) {
      drillFilters.mese = columnKey;
    }
    const title = `${def.title} > ${path.join(' > ')}${columnKey ? ' > ' + columnKey : ''}`;
    setDrillDown({ open: true, loading: true, title, records: [], total: 0 });
    try {
      const res = await base44.functions.invoke('getDrillDownRecords', { source: def.source, filters: drillFilters });
      setDrillDown({ open: true, loading: false, title, records: res.data.records, total: res.data.total });
    } catch (e) {
      console.error(e);
      setDrillDown({ open: true, loading: false, title, records: [], total: 0 });
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const res = await base44.functions.invoke('exportPivotExcel', { filters });
      const blob = await (await fetch(`data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${res.data.file_base64}`)).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.data.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
    setExporting(false);
  };

  const renderPivot = (key) => {
    const def = PIVOT_DEFS[key];
    const data = pivots[`pivot${key}`];
    if (!data) return <div className="text-sm text-muted-foreground py-4">Caricamento {def.title}...</div>;
    const onCell = (path, col, vk) => handleCellClick(key, path, col, vk);
    return (
      <div className="space-y-2">
        <h2 className="text-base font-heading font-semibold">{def.title}</h2>
        {def.type === 'tree'
          ? <PivotTreeTable pivot={data} onCellClick={onCell} />
          : <PivotDetailTable pivot={data} onCellClick={onCell} />}
      </div>
    );
  };

  return (
    <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold">Report Mensile & Analisi Pivot</h1>
          <p className="text-muted-foreground mt-1">Tabelle dinamiche su Primarie, Secondarie e Assegnati con drill-down e filtri globali.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { loadedKeysRef.current = new Set(); setPivots({}); setFilterOptions(null); }}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-md hover:bg-accent"
          >
            <RefreshCw className="w-4 h-4" /> Aggiorna
          </button>
          <button onClick={handleExportExcel} disabled={exporting} className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-md hover:bg-accent disabled:opacity-50">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} Excel multi-foglio
          </button>
        </div>
      </div>

      <GlobalFilters filters={filters} onChange={handleFiltersChange} filterOptions={filterOptions || {}} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="A">Raccolta</TabsTrigger>
          <TabsTrigger value="B">Impianti</TabsTrigger>
          <TabsTrigger value="C">ACI</TabsTrigger>
          <TabsTrigger value="D">Secondarie</TabsTrigger>
          <TabsTrigger value="EFG">Dettaglio FIR</TabsTrigger>
          <TabsTrigger value="H">Richieste Aperte</TabsTrigger>
        </TabsList>
        <TabsContent value="A" className="space-y-2">
          {loading && !pivots.pivotA ? <div className="flex items-center py-8 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Calcolo pivot...</div> : renderPivot('A')}
        </TabsContent>
        <TabsContent value="B" className="space-y-2">
          {loading && !pivots.pivotB ? <div className="flex items-center py-8 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Calcolo pivot...</div> : renderPivot('B')}
        </TabsContent>
        <TabsContent value="C" className="space-y-2">
          {loading && !pivots.pivotC ? <div className="flex items-center py-8 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Calcolo pivot...</div> : renderPivot('C')}
        </TabsContent>
        <TabsContent value="D" className="space-y-2">
          {loading && !pivots.pivotD ? <div className="flex items-center py-8 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Calcolo pivot...</div> : renderPivot('D')}
        </TabsContent>
        <TabsContent value="EFG" className="space-y-4">
          {loading && !pivots.pivotE ? <div className="flex items-center py-8 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Calcolo pivot...</div> : (
            <>{renderPivot('E')}{renderPivot('F')}{renderPivot('G')}</>
          )}
        </TabsContent>
        <TabsContent value="H" className="space-y-2">
          {loading && !pivots.pivotH ? <div className="flex items-center py-8 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Calcolo pivot...</div> : renderPivot('H')}
        </TabsContent>
      </Tabs>

      <DrillDownModal
        open={drillDown.open}
        onClose={() => setDrillDown((d) => ({ ...d, open: false }))}
        title={drillDown.title}
        loading={drillDown.loading}
        records={drillDown.records}
        total={drillDown.total}
      />
    </div>
  );
}