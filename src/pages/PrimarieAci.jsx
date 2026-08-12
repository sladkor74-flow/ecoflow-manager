import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, RefreshCw, Truck, Factory, Package, Filter, X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTableSort } from '@/hooks/useTableSort';
import SortHeader from '@/components/shared/SortHeader';
import MultiSelect from '@/components/shared/MultiSelect';
import { formatNumber, fmtTon } from '@/lib/utils';

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
  const [filterMese, setFilterMese] = useState([]);
  const [filterDestinazione, setFilterDestinazione] = useState([]);
  const [filterProvincia, setFilterProvincia] = useState([]);
  const [filterTrasportatore, setFilterTrasportatore] = useState([]);
  const [filterData, setFilterData] = useState('');
  const [filterRegione, setFilterRegione] = useState([]);
  const [filterStato, setFilterStato] = useState([]);
  const [filterAnno, setFilterAnno] = useState([]);

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
  const regioni = [...new Set(records.map(r => (r.regione || '').trim()).filter(Boolean))].sort();
  const stati = [...new Set(records.map(r => (r.stato || '').trim()).filter(Boolean))].sort();
  const anni = [...new Set(records.map(r => {
    const d = r.ordine_chiuso_il || r.trasporto_finito_il || r.ordine_immesso_il;
    if (!d) return null;
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? null : dt.getFullYear();
  }).filter(Boolean))].sort((a, b) => b - a);

  const filtered = records.filter(r => {
    if (filterMese.length > 0 && !filterMese.includes(r.mese)) return false;
    if (filterDestinazione.length > 0 && !filterDestinazione.includes(r.destinazione)) return false;
    if (filterProvincia.length > 0 && !filterProvincia.includes((r.provincia || '').trim())) return false;
    if (filterTrasportatore.length > 0 && !filterTrasportatore.includes((r.trasportatore || '').trim())) return false;
    if (filterRegione.length > 0 && !filterRegione.includes((r.regione || '').trim())) return false;
    if (filterStato.length > 0 && !filterStato.includes((r.stato || '').trim())) return false;
    if (filterAnno.length > 0) {
      const d = r.ordine_chiuso_il || r.trasporto_finito_il || r.ordine_immesso_il;
      const dt = d ? new Date(d) : null;
      const anno = dt && !isNaN(dt.getTime()) ? dt.getFullYear() : null;
      if (!filterAnno.map(String).includes(String(anno))) return false;
    }
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
    return <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Caricamento Terminati ACI...</div>;
  }

  return (
    <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold flex items-center gap-2"><Factory className="w-7 h-7 text-primary" /> Terminati ACI</h1>
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
          <p className="text-xl font-bold">{formatNumber(filtered.length, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
        </div>
        <div className="border rounded-lg p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Truck className="w-3.5 h-3.5" /> Kg Totali</div>
          <p className="text-xl font-bold">{fmtTon(totalKg / 1000)}</p>
        </div>
        <div className="border rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">Quantità Richiesta</div>
          <p className="text-xl font-bold">{formatNumber(totalRichiesti, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
        </div>
        <div className="border rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">Quantità Ritirata</div>
          <p className="text-xl font-bold">{formatNumber(totalRitirati, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
        </div>
      </div>

      {/* Filtri */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium inline-flex items-center gap-1.5"><Filter className="w-4 h-4" /> Filtri rapidi</span>
          {(filterMese.length > 0 || filterDestinazione.length > 0 || filterProvincia.length > 0 || filterTrasportatore.length > 0 || filterData || filterRegione.length > 0 || filterStato.length > 0 || filterAnno.length > 0) && (
            <button onClick={() => { setFilterMese([]); setFilterDestinazione([]); setFilterProvincia([]); setFilterTrasportatore([]); setFilterData(''); setFilterRegione([]); setFilterStato([]); setFilterAnno([]); }} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <X className="w-3 h-3" /> Reset
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <MultiSelect allLabel="Tutte le regioni" options={regioni} selected={filterRegione} onChange={setFilterRegione} />
          <MultiSelect allLabel="Tutti gli stati" options={stati} selected={filterStato} onChange={setFilterStato} />
          <MultiSelect allLabel="Tutti i mesi" options={MESI} selected={filterMese} onChange={setFilterMese} />
          <MultiSelect allLabel="Tutti gli anni" options={anni.map(String)} selected={filterAnno.map(String)} onChange={v => setFilterAnno(v.map(Number))} />
          <MultiSelect allLabel="Tutte le destinazioni" options={destinazioni} selected={filterDestinazione} onChange={setFilterDestinazione} />
          <MultiSelect allLabel="Tutte le province" options={province} selected={filterProvincia} onChange={setFilterProvincia} />
          <MultiSelect allLabel="Tutti i trasportatori" options={trasportatori} selected={filterTrasportatore} onChange={setFilterTrasportatore} />
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
                    <td className="px-3 py-2 text-right">{formatNumber(v.count, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                    <td className="px-3 py-2 text-right">{formatNumber(v.kg, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                    <td className="px-3 py-2 text-right font-bold">{fmtTon(v.kg / 1000)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="bg-primary text-primary-foreground font-bold">
                <td className="px-3 py-3">TOTALE</td>
                <td className="px-3 py-3 text-right">{formatNumber(filtered.length, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                <td className="px-3 py-3 text-right">{formatNumber(totalKg, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                <td className="px-3 py-3 text-right">{fmtTon(totalKg / 1000)}</td>
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
                    <td className="px-3 py-2 text-right">{formatNumber(v.count, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                    <td className="px-3 py-2 text-right">{formatNumber(v.kg, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                    <td className="px-3 py-2 text-right font-bold">{fmtTon(v.kg / 1000)}</td>
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
                      if (col.format === 'number') val = val != null ? formatNumber(val) : '';
                      else if (col.format === 'date') val = val ? new Date(val).toLocaleDateString('it-IT') : '';
                      return <td key={col.key} className={`px-2 py-1.5 whitespace-nowrap ${col.format === 'number' ? 'text-right' : ''} ${col.key === 'ragione_sociale' || col.key === 'destinazione' ? 'truncate max-w-[200px]' : ''}`}>{val ?? ''}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sortedDetail.sorted.length > 500 && <p className="text-xs text-muted-foreground mt-2">Mostrati primi 500 di {formatNumber(sortedDetail.sorted.length, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} record.</p>}
        </TabsContent>
      </Tabs>
    </div>
  );
}