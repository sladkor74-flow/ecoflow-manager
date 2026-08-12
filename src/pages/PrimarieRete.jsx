import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Upload, MapPin, BarChart3, Clock, Table2, Filter, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import AlertBadge from '@/components/alerts/AlertBadge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProvinceMatrix from '@/components/primarie-rete/ProvinceMatrix';
import RaccoglitoriMix from '@/components/primarie-rete/RaccoglitoriMix';
import SlaMetrics from '@/components/primarie-rete/SlaMetrics';
import PrimarieReteTable from '@/components/primarie-rete/PrimarieReteTable';
import MultiSelect from '@/components/shared/MultiSelect';

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

export default function PrimarieRete() {
  const [provinceData, setProvinceData] = useState(null);
  const [mixData, setMixData] = useState(null);
  const [slaData, setSlaData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alertCount, setAlertCount] = useState(0);

  const [records, setRecords] = useState([]);
  const [allRecords, setAllRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [filters, setFilters] = useState({ regione: [], stato: [], data: '', mese: [], anno: [] });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const mixFilters = { regione: filters.regione, stato: filters.stato, mese: filters.mese, anno: filters.anno };
      const [provRes, mixRes, slaRes, alertRes] = await Promise.all([
        base44.functions.invoke('computeProvinceMatrix', {}),
        base44.functions.invoke('computeRaccoglitoriMix', { filters: mixFilters }),
        base44.functions.invoke('computeSlaMetrics', {}),
        base44.functions.invoke('getAlerts', { modulo: 'primarie_rete', solo_aperti: true }),
      ]);
      setProvinceData(provRes.data);
      setMixData(mixRes.data);
      setSlaData(slaRes.data);
      setAlertCount(alertRes.data?.total || 0);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [filters]);

  const loadRecords = useCallback(async () => {
    setLoadingRecords(true);
    try {
      const all = await base44.entities.PrimariaRete.list('-created_date', 10000);
      setAllRecords(all);
      const filtered = all.filter(r => {
        if (filters.regione.length > 0 && !filters.regione.includes((r.regione || '').trim())) return false;
        if (filters.stato.length > 0 && !filters.stato.includes((r.stato || '').trim())) return false;
        if (filters.mese.length > 0 && !filters.mese.includes(r.mese)) return false;
        if (filters.anno.length > 0) {
          const d = r.ordine_chiuso_il || r.trasporto_finito_il || r.ordine_immesso_il;
          const dt = d ? new Date(d) : null;
          const anno = dt && !isNaN(dt.getTime()) ? dt.getFullYear() : null;
          if (!filters.anno.map(String).includes(String(anno))) return false;
        }
        if (filters.data) {
          const d = r.ordine_chiuso_il || r.trasporto_finito_il || r.ordine_immesso_il;
          if (!d || new Date(d).toISOString().slice(0, 10) !== filters.data) return false;
        }
        return true;
      });
      setRecords(filtered);
    } catch (e) { console.error(e); }
    setLoadingRecords(false);
  }, [filters]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { loadRecords(); }, [loadRecords]);

  const regioni = [...new Set(allRecords.map(r => (r.regione || '').trim()).filter(Boolean))].sort();
  const stati = [...new Set(allRecords.map(r => (r.stato || '').trim()).filter(Boolean))].sort();
  const anni = [...new Set(allRecords.map(r => {
    const d = r.ordine_chiuso_il || r.trasporto_finito_il || r.ordine_immesso_il;
    if (!d) return null;
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? null : dt.getFullYear();
  }).filter(Boolean))].sort((a, b) => b - a);

  const hasFilters = Object.values(filters).some(v => Array.isArray(v) ? v.length > 0 : v);
  const resetFilters = () => setFilters({ regione: [], stato: [], data: '', mese: [], anno: [] });

  return (
    <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold">Terminati Rete — Terminati Rete</h1>
          <p className="text-muted-foreground mt-1">
            Monitoraggio raccolte PFU per provincia e mix classi consorziali per raccoglitore.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {alertCount > 0 && <AlertBadge count={alertCount} modulo="primarie_rete" />}
          <Link to="/caricamento-dati" className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-md hover:bg-accent">
            <Upload className="w-4 h-4" /> Carica dati
          </Link>
        </div>
      </div>

      {/* Filtri rapidi per dettaglio ordini */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium inline-flex items-center gap-1.5"><Filter className="w-4 h-4" /> Filtri ordini</span>
          {hasFilters && (
            <button onClick={resetFilters} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <X className="w-3 h-3" /> Reset
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <MultiSelect allLabel="Tutte le regioni" options={regioni} selected={filters.regione} onChange={v => setFilters(p => ({ ...p, regione: v }))} />
          <MultiSelect allLabel="Tutti gli stati" options={stati} selected={filters.stato} onChange={v => setFilters(p => ({ ...p, stato: v }))} />
          <MultiSelect allLabel="Tutti i mesi" options={MESI} selected={filters.mese} onChange={v => setFilters(p => ({ ...p, mese: v }))} />
          <MultiSelect allLabel="Tutti gli anni" options={anni.map(String)} selected={filters.anno.map(String)} onChange={v => setFilters(p => ({ ...p, anno: v.map(Number) }))} />
          <input type="date" value={filters.data} onChange={e => setFilters(p => ({ ...p, data: e.target.value }))} className="border rounded-md px-3 py-2 text-sm" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Calcolo analytics in corso...
        </div>
      ) : (
        <Tabs defaultValue="dettaglio">
          <TabsList>
            <TabsTrigger value="dettaglio"><Table2 className="w-4 h-4 mr-1.5" /> Dettaglio Ordini ({records.length})</TabsTrigger>
            <TabsTrigger value="province"><MapPin className="w-4 h-4 mr-1.5" /> Province & FIR</TabsTrigger>
            <TabsTrigger value="mix"><BarChart3 className="w-4 h-4 mr-1.5" /> Mix Classi</TabsTrigger>
            <TabsTrigger value="sla"><Clock className="w-4 h-4 mr-1.5" /> SLA & Tempi</TabsTrigger>
          </TabsList>

          <TabsContent value="dettaglio" className="mt-4">
            <PrimarieReteTable records={records} loading={loadingRecords} />
          </TabsContent>

          <TabsContent value="province" className="mt-4">
            <div className="mb-3 text-sm text-muted-foreground">
              Matrice mensile dei formulari/FIR raccolti per Regione e Provincia.
              I mesi con 0 raccolte sono evidenziati in rosso. Le province con 2 mesi consecutivi a zero generano un warning.
            </div>
            <ProvinceMatrix data={provinceData} />
          </TabsContent>

          <TabsContent value="mix" className="mt-4">
            <div className="mb-3 text-sm text-muted-foreground">
              Distribuzione percentuale del peso raccolto per classe PFU per ciascun raccoglitore.
              Target consorziali: P=75%, M=20%, G1=4%, G2=1%. Deviazioni significative ({'>'}±5%) evidenziate come warning.
            </div>
            <RaccoglitoriMix data={mixData} />
          </TabsContent>

          <TabsContent value="sla" className="mt-4">
            <div className="mb-3 text-sm text-muted-foreground">
              Tempi di evasione e puntualità delle raccolte per trasportatore. Alert critico se Nr Giorni medio {'>'} 12 o % fuori tempo {'>'} 20%.
            </div>
            <SlaMetrics data={slaData} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}