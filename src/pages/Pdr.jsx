import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Filter, X, MapPin, Users, Download, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import PdrUpload from '@/components/pdr/PdrUpload';
import PdrTable from '@/components/pdr/PdrTable';
import PdrClientiTable from '@/components/pdr/PdrClientiTable';
import MultiSelect from '@/components/shared/MultiSelect';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { getRegioneFromProvincia } from '@/lib/regioneMap';
import { precisioneCoordinata } from '@/lib/geoLinks';
import { formatIntero } from '@/lib/utils';
import { fetchAllClient } from '@/lib/fetchAllClient';
const PdrMap = React.lazy(() => import('@/components/pdr/PdrMap'));

export default function Pdr() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState('pdr');
  const [filters, setFilters] = useState({ regione: [], provincia: [], trasportatore_principale: [], codice_import: [] });
  const [search, setSearch] = useState({ ragione_sociale: '', comune: '', codice_fiscale: '', partita_iva: '', contatto: '', indirizzo_pdr: '' });
  const [statoPdr, setStatoPdr] = useState('tutti');
  const [precisionePdr, setPrecisionePdr] = useState('tutti');
  const [soloAutodemolitori, setSoloAutodemolitori] = useState(false);
  const [selectedPdrId, setSelectedPdrId] = useState(null);

  const handleSelectPdr = useCallback((id) => {
    setSelectedPdrId(id);
    if (id !== null) setActiveTab('mappa');
  }, []);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      setRecords(await fetchAllClient(base44.entities.Pdr));
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  useEffect(() => {
    const unsub = base44.entities.UploadLog.subscribe((event) => {
      if ((event.type === 'create' || event.type === 'update') && event.data?.esito !== 'in_corso' && event.data?.tipo_file === 'pdr') loadRecords();
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
    const matchMulti = (val, arr) => arr.length === 0 || arr.includes(val);
    return records.filter(r => {
      if (!matchMulti(getRegioneFromProvincia(r.provincia), filters.regione)) return false;
      if (!matchMulti(r.provincia, filters.provincia)) return false;
      if (!matchMulti(r.trasportatore_principale, filters.trasportatore_principale)) return false;
      if (!matchMulti(r.codice_import, filters.codice_import)) return false;
      if (soloAutodemolitori && !String(r.codice_import || '').toLowerCase().startsWith('d')) return false;
      if (!matchSearch(r.ragione_sociale, search.ragione_sociale)) return false;
      // Comune: sede legale OPPURE comune PDR
      if (search.comune && !matchSearch(r.comune, search.comune) && !matchSearch(r.comune_pdr, search.comune)) return false;
      if (!matchSearch(r.codice_fiscale, search.codice_fiscale)) return false;
      if (!matchSearch(r.partita_iva, search.partita_iva)) return false;
      // Contatto: tel, email, riferimento
      if (search.contatto) {
        const t = search.contatto.toLowerCase().trim();
        const hay = [r.tel, r.email, r.riferimento, r.tel_pdr, r.email_pdr, r.riferimento_pdr].map(v => (v || '').toLowerCase());
        if (!hay.some(v => v.includes(t))) return false;
      }
      // Indirizzo PDR: indirizzo_pdr, descrizione_pdr
      if (search.indirizzo_pdr) {
        const t = search.indirizzo_pdr.toLowerCase().trim();
        const hay = [r.indirizzo_pdr, r.descrizione_pdr].map(v => (v || '').toLowerCase());
        if (!hay.some(v => v.includes(t))) return false;
      }
      // Stato PDR
      const isSospeso = !!(r.sospeso && String(r.sospeso).trim() !== '');
      if (statoPdr === 'attivi' && isSospeso) return false;
      if (statoPdr === 'sospesi' && !isSospeso) return false;
      // Precisione coordinate
      if (precisionePdr !== 'tutti') {
        const lat = parseFloat(r.latitudine);
        const lng = parseFloat(r.longitudine);
        const hasCoords = !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
        const prec = precisioneCoordinata(r.geo_approssimazione);
        if (precisionePdr === 'ignoto') {
          if (hasCoords && prec.livello !== 'ignoto') return false;
        } else {
          if (!hasCoords || prec.livello !== precisionePdr) return false;
        }
      }
      return true;
    });
  }, [records, filters, search, soloAutodemolitori, statoPdr, precisionePdr]);

  const precisionCounts = useMemo(() => {
    const counts = { ok: 0, medio: 0, basso: 0, ignoto: 0 };
    for (const r of filtered) {
      const lat = parseFloat(r.latitudine);
      const lng = parseFloat(r.longitudine);
      const hasCoords = !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
      if (!hasCoords) { counts.ignoto++; continue; }
      const prec = precisioneCoordinata(r.geo_approssimazione);
      counts[prec.livello] = (counts[prec.livello] || 0) + 1;
    }
    return counts;
  }, [filtered]);

  const hasFilters = Object.values(filters).some(v => Array.isArray(v) ? v.length > 0 : v) ||
    Object.values(search).some(v => v) || soloAutodemolitori || statoPdr !== 'tutti' || precisionePdr !== 'tutti';
  const resetFilters = () => {
    setFilters({ regione: [], provincia: [], trasportatore_principale: [], codice_import: [] });
    setSearch({ ragione_sociale: '', comune: '', codice_fiscale: '', partita_iva: '', contatto: '', indirizzo_pdr: '' });
    setStatoPdr('tutti');
    setPrecisionePdr('tutti');
    setSoloAutodemolitori(false);
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const wb = XLSX.utils.book_new();

      if (activeTab === 'pdr') {
        const rows = filtered.map(r => ({
          'Cod. Esterno': r.codice_esterno || '',
          'ID Cliente': r.id_cliente || '',
          'Ragione Sociale': r.ragione_sociale || '',
          'Sede Legale': r.sede_legale || '',
          'Comune': r.comune || '',
          'Prov.': r.provincia || '',
          'CAP': r.cap || '',
          'Nazione': r.nazione || '',
          'Riferimento': r.riferimento || '',
          'Tel': r.tel || '',
          'Fax': r.fax || '',
          'Email': r.email || '',
          'Cod. Fiscale': r.codice_fiscale || '',
          'Partita IVA': r.partita_iva || '',
          'Cod. Import': r.codice_import || '',
          'ID PDR': r.id_pdr || '',
          'Cod. Esterno PDR': r.codice_esterno_pdr || '',
          'Descrizione PDR': r.descrizione_pdr || '',
          'Indirizzo PDR': r.indirizzo_pdr || '',
          'CAP PDR': r.cap_pdr || '',
          'Comune PDR': r.comune_pdr || '',
          'Prov. PDR': r.provincia_pdr || '',
          'Sospeso': r.sospeso || '',
          'KeyAccount': r.key_account || '',
          'Partner Operativo': r.partner_operativo || '',
          'Trasportatore Principale': r.trasportatore_principale || '',
          'Riferimento PDR': r.riferimento_pdr || '',
          'Tel PDR': r.tel_pdr || '',
          'Fax PDR': r.fax_pdr || '',
          'Email PDR': r.email_pdr || '',
          'Iscrizione RENTRi': r.rentri_iscrizione || '',
          'ID U/L RENTRi': r.rentri_id_ul || '',
          'Tipo Formulario': r.tipo_formulario || '',
          'Latitudine': r.latitudine || '',
          'Longitudine': r.longitudine || '',
          'Geo Approssimazione': r.geo_approssimazione || '',
          'Precisione': precisioneCoordinata(r.geo_approssimazione).etichetta,
          'PlaceID': r.place_id || '',
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'Punti di Raccolta');
      } else {
        // Raggruppa per id_cliente
        const gruppi = {};
        for (const r of filtered) {
          const key = r.id_cliente;
          if (!gruppi[key]) {
            gruppi[key] = {
              'Ragione Sociale': r.ragione_sociale || '',
              'Partita IVA': r.partita_iva || '',
              'Comune sede': r.comune || '',
              'Provincia': r.provincia || '',
              'Numero di PDR': 0,
              'Trasportatore principale': r.trasportatore_principale || '',
            };
          }
          gruppi[key]['Numero di PDR']++;
        }
        const rows = Object.values(gruppi);
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'Clienti');
      }

      XLSX.writeFile(wb, `PDR_Ecotyre_${today}.xlsx`);
    } catch (e) {
      console.error(e);
      alert('Errore export: ' + (e.message || 'errore sconosciuto'));
    }
    setExporting(false);
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
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="w-4 h-4" /> {filtered.length} di {records.length} record
          </div>
          <button
            onClick={exportExcel}
            disabled={exporting || filtered.length === 0}
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 btn-secondario"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Esporta Excel
          </button>
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
        {/* Riga 1: filtri MultiSelect + Stato PDR */}
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
            <label className="text-xs text-muted-foreground mb-1 block">Stato PDR</label>
            <select
              value={statoPdr}
              onChange={e => setStatoPdr(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            >
              <option value="tutti">Tutti</option>
              <option value="attivi">Solo attivi</option>
              <option value="sospesi">Solo sospesi</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Precisione coordinate</label>
            <select
              value={precisionePdr}
              onChange={e => setPrecisionePdr(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            >
              <option value="tutti">Tutte</option>
              <option value="ok">Precisa (edificio)</option>
              <option value="medio">Da verificare</option>
              <option value="basso">Approssimativa</option>
              <option value="ignoto">Senza coordinate o non nota</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Precise {formatIntero(precisionCounts.ok)} · Da verificare {formatIntero(precisionCounts.medio)} · Approssimative {formatIntero(precisionCounts.basso)} · Non note {formatIntero(precisionCounts.ignoto)}
            </p>
          </div>
        </div>
        {/* Riga 2: ricerca testuale */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Ragione Sociale</label>
            <input type="text" value={search.ragione_sociale} onChange={e => setSearch(p => ({ ...p, ragione_sociale: e.target.value }))} placeholder="Cerca..." className="w-full border rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Comune (sede o PDR)</label>
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
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Contatto</label>
            <input type="text" value={search.contatto} onChange={e => setSearch(p => ({ ...p, contatto: e.target.value }))} placeholder="Tel, email, riferimento..." className="w-full border rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Indirizzo PDR</label>
            <input type="text" value={search.indirizzo_pdr} onChange={e => setSearch(p => ({ ...p, indirizzo_pdr: e.target.value }))} placeholder="Indirizzo o descrizione..." className="w-full border rounded-md px-3 py-2 text-sm" />
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pdr">Punti di raccolta</TabsTrigger>
          <TabsTrigger value="clienti">Clienti</TabsTrigger>
          <TabsTrigger value="mappa"><MapPin className="w-4 h-4 mr-1.5" /> Mappa</TabsTrigger>
        </TabsList>
        <TabsContent value="pdr">
          <PdrTable records={filtered} loading={loading} onSelectPdr={handleSelectPdr} />
        </TabsContent>
        <TabsContent value="clienti">
          <PdrClientiTable records={filtered} loading={loading} />
        </TabsContent>
        <TabsContent value="mappa">
          <React.Suspense fallback={<div className="flex items-center justify-center h-[400px]"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
            <PdrMap records={filtered} selectedPdrId={selectedPdrId} onSelect={handleSelectPdr} />
          </React.Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}