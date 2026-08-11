import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Filter, X, MapPin, Users } from 'lucide-react';
import PdrUpload from '@/components/pdr/PdrUpload';
import PdrTable from '@/components/pdr/PdrTable';

export default function Pdr() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ provincia: '', trasportatore_principale: '', codice_import: '', id_cliente: '' });
  const [search, setSearch] = useState({ ragione_sociale: '', comune: '', provincia: '', codice_fiscale: '', partita_iva: '', codice_import: '', id_cliente: '' });
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

  // Opzioni per i filtri (derivate dai dati)
  const filterOptions = useMemo(() => {
    const province = [...new Set(records.map(r => r.provincia).filter(Boolean))].sort();
    const trasportatori = [...new Set(records.map(r => r.trasportatore_principale).filter(Boolean))].sort();
    const codiciImport = [...new Set(records.map(r => r.codice_import).filter(Boolean))].sort();
    const idClienti = [...new Set(records.map(r => r.id_cliente).filter(v => v !== null && v !== undefined && v !== ''))].sort((a, b) => a - b);
    return { province, trasportatori, codiciImport, idClienti };
  }, [records]);

  // Filtri + ricerca applicati
  const filtered = useMemo(() => {
    const matchSearch = (val, term) => !term || (val || '').toLowerCase().includes(term.toLowerCase().trim());
    return records.filter(r => {
      if (filters.provincia && r.provincia !== filters.provincia) return false;
      if (filters.trasportatore_principale && r.trasportatore_principale !== filters.trasportatore_principale) return false;
      if (filters.codice_import && r.codice_import !== filters.codice_import) return false;
      if (filters.id_cliente && String(r.id_cliente) !== String(filters.id_cliente)) return false;
      if (soloAutodemolitori && !String(r.codice_import || '').toLowerCase().startsWith('d')) return false;
      if (!matchSearch(r.ragione_sociale, search.ragione_sociale)) return false;
      if (!matchSearch(r.comune, search.comune)) return false;
      if (!matchSearch(r.provincia, search.provincia)) return false;
      if (!matchSearch(r.codice_fiscale, search.codice_fiscale)) return false;
      if (!matchSearch(r.partita_iva, search.partita_iva)) return false;
      if (!matchSearch(r.codice_import, search.codice_import)) return false;
      if (!matchSearch(r.id_cliente, search.id_cliente)) return false;
      return true;
    });
  }, [records, filters, search, soloAutodemolitori]);

  const hasFilters = filters.provincia || filters.trasportatore_principale || filters.codice_import || filters.id_cliente ||
    Object.values(search).some(v => v) || soloAutodemolitori;
  const resetFilters = () => {
    setFilters({ provincia: '', trasportatore_principale: '', codice_import: '', id_cliente: '' });
    setSearch({ ragione_sociale: '', comune: '', provincia: '', codice_fiscale: '', partita_iva: '', codice_import: '', id_cliente: '' });
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
        {/* Filtri a tendina */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <select value={filters.id_cliente} onChange={e => setFilters(p => ({ ...p, id_cliente: e.target.value }))} className="border rounded-md px-3 py-2 text-sm">
            <option value="">Tutti gli ID Cliente (filtro)</option>
            {filterOptions.idClienti.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filters.provincia} onChange={e => setFilters(p => ({ ...p, provincia: e.target.value }))} className="border rounded-md px-3 py-2 text-sm">
            <option value="">Tutte le province (filtro)</option>
            {filterOptions.province.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={filters.trasportatore_principale} onChange={e => setFilters(p => ({ ...p, trasportatore_principale: e.target.value }))} className="border rounded-md px-3 py-2 text-sm">
            <option value="">Tutti i trasportatori</option>
            {filterOptions.trasportatori.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filters.codice_import} onChange={e => setFilters(p => ({ ...p, codice_import: e.target.value }))} className="border rounded-md px-3 py-2 text-sm">
            <option value="">Tutti i cod. import (filtro)</option>
            {filterOptions.codiciImport.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Ricerca per campi separati */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">ID Cliente</label>
            <input type="text" value={search.id_cliente} onChange={e => setSearch(p => ({ ...p, id_cliente: e.target.value }))} placeholder="Cerca..." className="w-full border rounded-md px-3 py-2 text-sm" />
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
            <label className="text-xs text-muted-foreground mb-1 block">Provincia</label>
            <input type="text" value={search.provincia} onChange={e => setSearch(p => ({ ...p, provincia: e.target.value }))} placeholder="Cerca..." className="w-full border rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Cod. Fiscale</label>
            <input type="text" value={search.codice_fiscale} onChange={e => setSearch(p => ({ ...p, codice_fiscale: e.target.value }))} placeholder="Cerca..." className="w-full border rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Partita IVA</label>
            <input type="text" value={search.partita_iva} onChange={e => setSearch(p => ({ ...p, partita_iva: e.target.value }))} placeholder="Cerca..." className="w-full border rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Codice Import</label>
            <input type="text" value={search.codice_import} onChange={e => setSearch(p => ({ ...p, codice_import: e.target.value }))} placeholder="Cerca..." className="w-full border rounded-md px-3 py-2 text-sm" />
          </div>
        </div>
      </div>

      <PdrTable records={filtered} loading={loading} />
    </div>
  );
}