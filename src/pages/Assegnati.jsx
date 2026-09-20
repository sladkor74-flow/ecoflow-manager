import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, FileSpreadsheet, Filter, X, Table2, LayoutGrid, Search, ListOrdered } from 'lucide-react';
import { formatIntero } from '@/lib/utils';
import AssegnatiKpi from '@/components/assegnati/AssegnatiKpi';
import AssegnatiMatrix from '@/components/assegnati/AssegnatiMatrix';
import AssegnatiTable from '@/components/assegnati/AssegnatiTable';
import ProvinceRanking from '@/components/assegnati/ProvinceRanking';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MultiSelect from '@/components/shared/MultiSelect';
import { fetchAllClient } from '@/lib/fetchAllClient';
import CercaIdOrdine, { corrispondeIdOrdine } from '@/components/shared/CercaIdOrdine';

export default function Assegnati({ entity = 'Assegnato', title = 'Assegnati Rete — Backlog Richieste', description = 'Ordini in stato "assegnato" di classe diversa da PFU Autodemolizione, derivati automaticamente dal caricamento delle Primarie.' }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState({ anno: [], mese: [], regione: [], provincia: [], partner_operativo: [], classe: [], stato: [], data: '', ragione_sociale: '' });
  const [ragioneSocialeInput, setRagioneSocialeInput] = useState('');
  const [viewMode, setViewMode] = useState('matrix');
  const [cercaId, setCercaId] = useState('');
  const [tuttiRecords, setTuttiRecords] = useState(null);

  const applyRagioneSociale = () => setFilters(p => ({ ...p, ragione_sociale: ragioneSocialeInput }));

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('computeAssegnatiMatrix', { filters, entity });
      setData(res.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [filters]);

  // Gli ordini si leggono una volta sola: i filtri si applicano qui, cosi' la
  // posizione in coda si puo' ricalcolare senza rileggere l'archivio.
  const loadRecords = useCallback(async () => {
    setLoadingRecords(true);
    try {
      const all = await fetchAllClient(base44.entities[entity], null, '-ordine_immesso_il');
      // Sull'ACI un formulario non si chiude a piu' del 10% del peso stimato del
      // suo ticket: il massimo si mostra accanto allo stimato, cosi' chi evade
      // l'ordine sa fin dove puo' arrivare senza doverlo ripartire.
      const eAciRiga = (r) => /autodemoliz|class ?9/i.test(`${r.classe || ''} ${r.prodotto || ''} ${r.codice_prodotto || ''}`);
      setTuttiRecords(all.map(r => ({
        ...r,
        peso_t: +((r.peso_stimato || 0) / 1000).toFixed(3),
        max_chiudibile_kg: eAciRiga(r) && Number(r.peso_stimato) > 0 ? Math.round(Number(r.peso_stimato) * 1.1) : null,
      })));
    } catch (e) { console.error(e); }
    setLoadingRecords(false);
  }, [entity]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (viewMode === 'detail' && !tuttiRecords && !loadingRecords) loadRecords(); }, [loadRecords, viewMode, tuttiRecords, loadingRecords]);
  // Cercando un ID si passa al dettaglio degli ordini.
  useEffect(() => { if (cercaId.trim()) setViewMode('detail'); }, [cercaId]);

  // Filtri diversi dalla ricerca del punto di raccolta: sono questi a definire la coda.
  const inFiltri = useCallback((r) => {
    if (filters.anno.length > 0 && !filters.anno.map(String).includes(String(r.anno))) return false;
    if (filters.mese.length > 0 && !filters.mese.includes(r.mese)) return false;
    if (filters.regione.length > 0 && !filters.regione.includes(r.regione)) return false;
    if (filters.provincia.length > 0 && !filters.provincia.includes((r.provincia || '').toUpperCase().trim())) return false;
    if (filters.partner_operativo.length > 0 && !filters.partner_operativo.includes((r.partner_operativo || '').trim())) return false;
    if (filters.classe.length > 0 && !filters.classe.includes(r.classe)) return false;
    if (filters.stato.length > 0 && !filters.stato.includes((r.stato || '').trim())) return false;
    if (filters.data) {
      const d = r.ordine_immesso_il;
      if (!d || new Date(d).toISOString().slice(0, 10) !== filters.data) return false;
    }
    return true;
  }, [filters]);

  // La coda di evasione: prima le richieste piu' vecchie, come si lavora davvero.
  // La posizione tiene conto dei filtri attivi (province, classi, mesi...) ma non
  // della ricerca, altrimenti cercando un punto di raccolta risulterebbe sempre primo.
  const coda = useMemo(() => {
    const lista = (tuttiRecords || []).filter(inFiltri)
      .sort((a, b) => String(a.ordine_immesso_il || '').localeCompare(String(b.ordine_immesso_il || '')) || String(a.id_ordine || '').localeCompare(String(b.id_ordine || '')));
    const posizioni = new Map();
    lista.forEach((r, i) => posizioni.set(r.id, i + 1));
    return { posizioni, totale: lista.length };
  }, [tuttiRecords, inFiltri]);

  const cercaPdr = (filters.ragione_sociale || '').toLowerCase().trim();
  const records = useMemo(() => (tuttiRecords || []).filter(r => inFiltri(r) && (!cercaPdr
    || `${r.ragione_sociale || ''} ${r.punto_di_raccolta || ''} ${r.id_pdr ?? ''}`.toLowerCase().includes(cercaPdr))),
  [tuttiRecords, inFiltri, cercaPdr]);

  const ordiniMostrati = cercaId.trim() ? (tuttiRecords || []).filter(r => corrispondeIdOrdine(r, cercaId)) : records;
  // Del punto di raccolta cercato interessa la richiesta piu' avanti in coda.
  const primoInCoda = useMemo(() => {
    if (!cercaPdr && !cercaId.trim()) return null;
    let migliore = null;
    for (const r of ordiniMostrati) {
      const p = coda.posizioni.get(r.id);
      if (p && (!migliore || p < migliore.posizione)) migliore = { posizione: p, record: r };
    }
    return migliore;
  }, [ordiniMostrati, coda, cercaPdr, cercaId]);

  // Auto-refresh on new uploads
  useEffect(() => {
    const unsub = base44.entities.UploadLog.subscribe((event) => {
      if ((event.type === 'create' || event.type === 'update') && event.data?.esito !== 'in_corso' && event.data?.tipo_file === 'primarie') loadData();
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

  const hasFilters = Object.values(filters).some(v => Array.isArray(v) ? v.length > 0 : v);
  const hasFiltriCoda = Object.entries(filters).some(([k, v]) => k !== 'ragione_sociale' && (Array.isArray(v) ? v.length > 0 : v));
  const resetFilters = () => { setFilters({ anno: [], mese: [], regione: [], provincia: [], partner_operativo: [], classe: [], stato: [], data: '', ragione_sociale: '' }); setRagioneSocialeInput(''); };
  const opts = data?.filterOptions || {};

  return (
    <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold">{title}</h1>
          <p className="text-muted-foreground mt-1">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleExport('matrix')} disabled={exporting} className="inline-flex items-center gap-2 px-3 py-2 text-sm btn-secondario">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LayoutGrid className="w-4 h-4" />} Excel Matrice
          </button>
          <button onClick={() => handleExport('detail')} disabled={exporting} className="inline-flex items-center gap-2 px-3 py-2 text-sm btn-secondario">
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

          <CercaIdOrdine value={cercaId} onChange={setCercaId} trovati={loadingRecords || !tuttiRecords ? null : ordiniMostrati.length} />

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
                  placeholder="Cerca punto di raccolta: ragione sociale, nome o codice PDR..."
                  value={ragioneSocialeInput}
                  onChange={e => setRagioneSocialeInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') applyRagioneSociale(); }}
                  className="border rounded-md px-3 py-2 text-sm flex-1"
                />
                <button onClick={applyRagioneSociale} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 whitespace-nowrap">
                  <Search className="w-4 h-4" /> Cerca
                </button>
              </div>
              <MultiSelect allLabel="Tutti gli anni" options={(opts.anni || []).map(a => String(a))} selected={filters.anno.map(String)} onChange={v => setFilters(p => ({ ...p, anno: v }))} />
              <MultiSelect allLabel="Tutti i mesi" options={opts.mesi || []} selected={filters.mese} onChange={v => setFilters(p => ({ ...p, mese: v }))} />
              <MultiSelect allLabel="Tutte le regioni" options={opts.regioni || []} selected={filters.regione} onChange={v => setFilters(p => ({ ...p, regione: v }))} />
              <MultiSelect allLabel="Tutte le province" options={opts.province || []} selected={filters.provincia} onChange={v => setFilters(p => ({ ...p, provincia: v }))} />
              <MultiSelect allLabel="Tutti i partner" options={opts.partner || []} selected={filters.partner_operativo} onChange={v => setFilters(p => ({ ...p, partner_operativo: v }))} />
              <MultiSelect allLabel="Tutte le classi" options={opts.classi || []} selected={filters.classe} onChange={v => setFilters(p => ({ ...p, classe: v }))} />
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
                  <h2 className="text-lg font-heading font-semibold">Dettaglio Ordini Assegnati ({ordiniMostrati.length})</h2>
                  {primoInCoda && (
                    <div className="border rounded-lg px-3 py-2 text-sm bg-sky-50 border-sky-200 text-sky-900 flex items-start gap-2">
                      <ListOrdered className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>
                        <strong>{primoInCoda.record.ragione_sociale || primoInCoda.record.punto_di_raccolta}</strong>: la richiesta più avanti è la{' '}
                        <strong>{formatIntero(primoInCoda.posizione)}ª</strong> su {formatIntero(coda.totale)} in coda{hasFiltriCoda ? ' con i filtri attivi' : ''}.
                        Prima di lei ci sono <strong>{formatIntero(primoInCoda.posizione - 1)}</strong> richieste più vecchie.
                      </span>
                    </div>
                  )}
                  <AssegnatiTable
                    records={ordiniMostrati}
                    loading={loadingRecords}
                    ragioneSocialeFilter={cercaId.trim() ? '' : filters.ragione_sociale}
                    posizioni={coda.posizioni}
                    totaleCoda={coda.totale}
                  />
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