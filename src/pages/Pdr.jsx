import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Filter, X, MapPin, Users } from 'lucide-react';
import PdrUpload from '@/components/pdr/PdrUpload';
import PdrTable from '@/components/pdr/PdrTable';
import MultiSelect from '@/components/shared/MultiSelect';
import { getRegioneFromProvincia } from '@/lib/regioneMap';

export default function Pdr() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ regione: [], provincia: [], trasportatore_principale: [], codice_import: [] });
  const [search, setSearch] = useState({ ragione_sociale: '', comune: '', codice_fiscale: '', partita_iva: '' });
  const [soloAutodemolitori, setSoloAutodemolitori] = useState(false);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const all = await base44.entities.Pdr.list('-created_date', 10000);
      setRecords(all);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  useEffect(() => {
    const unsub = base44.entities.UploadLog.subscribe((event) => {
      if (event.type === 'create' && event.data?.tipo_file === 'pdr') loadRecords();
    });
    return unsub;
  }, [loadRecords]);

  const filterOptions = useMemo(() => {
    const province = [...new Set(records.map(r => r.provincia).filter(Boolean))].sort();
    const trasportatori = [...new Set(records.map(r => r.trasportatore_principale).filter(Boolean))].sort();
    const codiciImport = [...new Set(records.map(r => r.codice_import).filter(Boolean))].sort();
    const regioni = [...new Set(records.map(r => getRegioneFromProvincia(r.provincia)).filter(Boolean))].sort();
    return { province, trasportatori, codiciImport, regioni };
  }, [records]);

  const filtered = useMemo(() => {
    const matchSearch = (val, term) => !term || (val || '').toLowerCase().includes(term.toLowerCase().trim());
    return records.filter(r => {
      if (filters.regione.length > 0 && !filters.regione.includes(getRegioneFromProvincia(r.provincia))) return false;
      if (filters.provincia.length > 0 && !filters.provincia.includes(r.provincia)) return false;
      if (filters.trasportatore_principale.length > 0 && !filters.trasportatore_principale.includes(r.trasportatore_principale)) return false;
      if (filters.codice_import.length > 0 && !filters.codice_import.includes(r.codice_import)) return false;
      if (soloAutodemolitori && !String(r.codice_import || '').toLowerCase().startsWith('d')) return false;
      if (!matchSearch(r.ragione_sociale, search.ragione_sociale)) return false;
      if (!matchSearch(r.comune, search.comune)) return false;
      if (!matchSearch(r.codice_fiscale, search.codice_fiscale)) return false;
      if (!matchSearch(r.partita_iva, search.partita_iva)) return false;
      return true;
    });
  }, [records, filters, search, soloAutodemolitori]);

  const hasFilters = Object.values(filters).some(v => Array.isArray(v) ? v.length > 0 : v) ||
    Object.values(search).some(v => v) || soloAutodemolitori;
  const resetFilters = () => {
    setFilters({ regione: [], provincia: [], trasportatore_principale: [], codice_import: [] });
    setSearch({ ragione_sociale: '', comune: '', codice_fiscale: '', partita_iva: '' });
    setSoloAutodemolitori(false);
  };

  return (
    <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold flex items-center gap-2">
            <MapPin className="w-7 h-7 text-primary" /> PDR — Elenco Clienti Ecotyre
          </h1>
          <p className="text-muted-foreground mt-1">Gommisti e autodemolitori con relativi punti di raccolta.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="w-4 h-4" /> {filtered.length} di {records.length} record
        </div>
      </div>

      <PdrUpload onImported={loadRecords} />

      {/* Filtri e ricerca */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium inline-flex items-center gap-1.5"><Filter className="w-4 h-4" /> Filtri e ricerca</span>
          <div className="flex items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
              <input
                type="checkbox"
                checked={soloAutodemolitori}
                onChange={e => setSoloAutodemolitori(e.target.checked)}
                className="w-4 h-4 rounded border-border accent-primary"
              />
              Solo Autodemolitori
            </label>
            {hasFilters && (
              <button onClick={resetFilters} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                <X className="w-3 h-3" /> Reset
              </button>
            )}
          </div>
        </div>
        {/* Filtri MultiSelect e ricerca testuale */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Regione</label>
            <MultiSelect allLabel="Tutte le regioni" options={filterOptions.regioni} selected={filters.regione} onChange={v => setFilters(p => ({ ...p, regione: v }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Provincia</label>
            <MultiSelect allLabel="Tutte le province" options={filterOptions.province} selected={filters.provincia} onChange={v => setFilters(p => ({ ...p, provincia: v }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Trasportatore</label>
            <MultiSelect allLabel="Tutti i trasportatori" options={filterOptions.trasportatori} selected={filters.trasportatore_principale} onChange={v => setFilters(p => ({ ...p, trasportatore_principale: v }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Cod. Import</label>
            <MultiSelect allLabel="Tutti i cod. import" options={filterOptions.codiciImport} selected={filters.codice_import} onChange={v => setFilters(p => ({ ...p, codice_import: v }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Ragione Sociale</label>
            <input type="text" value={search.ragione_sociale} onChange={e => setSearch(p => ({ ...p, ragione_sociale: e.target.value }))} placeholder="Cerca..." className="w-full border rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Comune</label>
            <input type="text" value={search.comune} onChange={e => setSearch(p => ({ ...p, comune: e.target.value }))} placeholder="Cerca..." className="w-full border rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Cod. Fiscale</label>
            <input type="text" value={search.codice_fiscale} onChange={e => setSearch(p => ({ ...p, codice_fiscale: e.target.value }))} placeholder="Cerca..." className="w-full border rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Partita IVA</label>
            <input type="text" value={search.partita_iva} onChange={e => setSearch(p => ({ ...p, partita_iva: e.target.value }))} placeholder="Cerca..." className="w-full border rounded-md px-3 py-2 text-sm" />
          </div>
        </div>
      </div>

      <PdrTable records={filtered} loading={loading} />
    </div>
  );
}