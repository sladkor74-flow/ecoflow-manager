import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, RefreshCw, Truck, Factory, Package, Filter, X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTableSort } from '@/hooks/useTableSort';
import SortHeader from '@/components/shared/SortHeader';

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

const DETAIL_COLUMNS = [
  { key: 'id_ordine', label: 'ID Ordine' },
  { key: 'ragione_sociale', label: 'Ragione Sociale' },
  { key: 'provincia', label: 'Provincia' },
  { key: 'destinazione', label: 'Destinazione' },
  { key: 'classe', label: 'Classe' },
  { key: 'quantita_richiesta', label: 'Q.Rich', format: 'number' },
  { key: 'quantita_ritirata', label: 'Q.Ritir', format: 'number' },
  { key: 'peso_effettivo', label: 'Kg', format: 'number' },
  { key: 'mese', label: 'Mese' },
  { key: 'trasportatore', label: 'Trasportatore' },
  { key: 'ordine_chiuso_il', label: 'Chiuso il', format: 'date' },
  { key: 'stato', label: 'Stato' },
];

export default function PrimarieAci() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterMese, setFilterMese] = useState(null);
  const [filterDestinazione, setFilterDestinazione] = useState(null);
  const [filterProvincia, setFilterProvincia] = useState(null);
  const [filterTrasportatore, setFilterTrasportatore] = useState(null);
  const [filterData, setFilterData] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await base44.entities.PrimariaAci.list('-created_date', 5000);
      setRecords(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const destinazioni = [...new Set(records.map(r => r.destinazione).filter(Boolean))].sort();
  const province = [...new Set(records.map(r => (r.provincia || '').trim()).filter(Boolean))].sort();
  const trasportatori = [...new Set(records.map(r => (r.trasportatore || '').trim()).filter(Boolean))].sort();

  const filtered = records.filter(r => {
    if (filterMese && r.mese !== filterMese) return false;
    if (filterDestinazione && r.destinazione !== filterDestinazione) return false;
    if (filterProvincia && (r.provincia || '').trim() !== filterProvincia) return false;
    if (filterTrasportatore && (r.trasportatore || '').trim() !== filterTrasportatore) return false;
    if (filterData) {
      const d = r.ordine_chiuso_il || r.trasporto_finito_il || r.ordine_immesso_il;
      if (!d || new Date(d).toISOString().slice(0, 10) !== filterData) return false;
    }
    return true;
  });

  // Aggiorna i record ordinati per il dettaglio
  const sortedDetail = useTableSort(filtered, 'ordine_chiuso_il', 'desc');

  const totalKg = filtered.reduce((s, r) => s + (r.peso_effettivo || 0), 0);
  const totalRichiesti = filtered.reduce((s, r) => s + (r.quantita_richiesta || 0), 0);
  const totalRitirati = filtered.reduce((s, r) => s + (r.quantita_ritirata || 0), 0);

  // Aggregazione per destinazione
  const byDest = {};
  filtered.forEach(r => {
    const d = r.destinazione || 'N/D';
    if (!byDest[d]) byDest[d] = { count: 0, kg: 0 };
    byDest[d].count++;
    byDest[d].kg += r.peso_effettivo || 0;
  });
  const destRows = Object.entries(byDest).sort((a, b) => b[1].kg - a[1].kg);

  // Aggregazione per mese
  const byMese = {};
  filtered.forEach(r => {
    const m = r.mese || 'N/D';
    if (!byMese[m]) byMese[m] = { count: 0, kg: 0 };
    byMese[m].count++;
    byMese[m].kg += r.peso_effettivo || 0;
  });
  const meseRows = MESI.filter(m => byMese[m]).map(m => [m, byMese[m]]);

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Caricamento Primarie ACI...</div>;
  }

  return (
    <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold flex items-center gap-2"><Factory className="w-7 h-7 text-primary" /> Primarie ACI</h1>
          <p className="text-muted-foreground mt-1">Monitoraggio ordini ACI (Auto Club Italia) con analisi per destinazione e mese.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-md hover:bg-accent">
          <RefreshCw className="w-4 h-4" /> Aggiorna
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="border rounded-lg p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Package className="w-3.5 h-3.5" /> Record</div>
          <p className="text-xl font-bold">{filtered.length.toLocaleString()}</p>
        </div>
        <div className="border rounded-lg p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Truck className="w-3.5 h-3.5" /> Kg Totali</div>
          <p className="text-xl font-bold">{(totalKg / 1000).toFixed(1)} t</p>
        </div>
        <div className="border rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">Quantità Richiesta</div>
          <p className="text-xl font-bold">{totalRichiesti.toLocaleString()}</p>
        </div>
        <div className="border rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">Quantità Ritirata</div>
          <p className="text-xl font-bold">{totalRitirati.toLocaleString()}</p>
        </div>
      </div>

      {/* Filtri */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium inline-flex items-center gap-1.5"><Filter className="w-4 h-4" /> Filtri rapidi</span>
          {(filterMese || filterDestinazione || filterProvincia || filterTrasportatore || filterData) && (
            <button onClick={() => { setFilterMese(null); setFilterDestinazione(null); setFilterProvincia(null); setFilterTrasportatore(null); setFilterData(''); }} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <X className="w-3 h-3" /> Reset
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <select value={filterMese || ''} onChange={e => setFilterMese(e.target.value || null)} className="border rounded-md px-3 py-2 text-sm">
            <option value="">Tutti i mesi</option>
            {MESI.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={filterDestinazione || ''} onChange={e => setFilterDestinazione(e.target.value || null)} className="border rounded-md px-3 py-2 text-sm">
            <option value="">Tutte le destinazioni</option>
            {destinazioni.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={filterProvincia || ''} onChange={e => setFilterProvincia(e.target.value || null)} className="border rounded-md px-3 py-2 text-sm">
            <option value="">Tutte le province</option>
            {province.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={filterTrasportatore || ''} onChange={e => setFilterTrasportatore(e.target.value || null)} className="border rounded-md px-3 py-2 text-sm">
            <option value="">Tutti i trasportatori</option>
            {trasportatori.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input type="date" value={filterData} onChange={e => setFilterData(e.target.value)} className="border rounded-md px-3 py-2 text-sm" placeholder="Data chiusura" />
        </div>
      </div>

      <Tabs defaultValue="destinazioni">
        <TabsList>
          <TabsTrigger value="destinazioni">Per Destinazione</TabsTrigger>
          <TabsTrigger value="mese">Per Mese</TabsTrigger>
          <TabsTrigger value="dettaglio">Dettaglio Record</TabsTrigger>
        </TabsList>

        <TabsContent value="destinazioni" className="mt-4">
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted"><tr>
                <th className="text-left px-3 py-2 font-semibold">Destinazione</th>
                <th className="text-right px-3 py-2 font-semibold">Record</th>
                <th className="text-right px-3 py-2 font-semibold">Kg Totali</th>
                <th className="text-right px-3 py-2 font-semibold">Ton</th>
              </tr></thead>
              <tbody>
                {destRows.map(([dest, v], i) => (
                  <tr key={dest} className={`border-t ${i % 2 ? 'bg-muted/20' : ''}`}>
                    <td className="px-3 py-2 font-medium">{dest}</td>
                    <td className="px-3 py-2 text-right">{v.count.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">{v.kg.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-bold">{(v.kg / 1000).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="bg-primary text-primary-foreground font-bold">
                <td className="px-3 py-3">TOTALE</td>
                <td className="px-3 py-3 text-right">{filtered.length.toLocaleString()}</td>
                <td className="px-3 py-3 text-right">{totalKg.toLocaleString()}</td>
                <td className="px-3 py-3 text-right">{(totalKg / 1000).toFixed(1)}</td>
              </tr></tfoot>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="mese" className="mt-4">
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted"><tr>
                <th className="text-left px-3 py-2 font-semibold">Mese</th>
                <th className="text-right px-3 py-2 font-semibold">Record</th>
                <th className="text-right px-3 py-2 font-semibold">Kg Totali</th>
                <th className="text-right px-3 py-2 font-semibold">Ton</th>
              </tr></thead>
              <tbody>
                {meseRows.map(([m, v], i) => (
                  <tr key={m} className={`border-t ${i % 2 ? 'bg-muted/20' : ''}`}>
                    <td className="px-3 py-2 font-medium">{m}</td>
                    <td className="px-3 py-2 text-right">{v.count.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">{v.kg.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-bold">{(v.kg / 1000).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="dettaglio" className="mt-4">
          <div className="border rounded-lg overflow-x-auto max-h-[600px]">
            <table className="w-full text-xs">
              <thead className="bg-muted sticky top-0"><tr>
                {DETAIL_COLUMNS.map((col) => (
                  <SortHeader key={col.key} col={col} sortKey={sortedDetail.sortKey} sortDir={sortedDetail.sortDir} onSort={sortedDetail.toggleSort} className="px-2 py-2 text-xs" />
                ))}
              </tr></thead>
              <tbody>
                {sortedDetail.sorted.slice(0, 500).map((r, i) => (
                  <tr key={r.id} className={`border-t hover:bg-muted/30 ${i % 2 ? 'bg-muted/10' : ''}`}>
                    {DETAIL_COLUMNS.map((col) => {
                      let val = r[col.key];
                      if (col.format === 'number') val = val != null ? val.toLocaleString('it-IT') : '';
                      else if (col.format === 'date') val = val ? new Date(val).toLocaleDateString('it-IT') : '';
                      return <td key={col.key} className={`px-2 py-1.5 whitespace-nowrap ${col.format === 'number' ? 'text-right' : ''} ${col.key === 'ragione_sociale' || col.key === 'destinazione' ? 'truncate max-w-[200px]' : ''}`}>{val ?? ''}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sortedDetail.sorted.length > 500 && <p className="text-xs text-muted-foreground mt-2">Mostrati primi 500 di {sortedDetail.sorted.length.toLocaleString()} record.</p>}
        </TabsContent>
      </Tabs>
    </div>
  );
}