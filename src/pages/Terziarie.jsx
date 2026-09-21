import React, { useState, useEffect, useCallback } from 'react';
import { eTerminato, giornoMovimento, giornoElenco, annoElenco, meseElenco } from '@/lib/movimenti';
import { base44 } from '@/api/base44Client';
import { Loader2, FileSpreadsheet, Filter, X } from 'lucide-react';
import TerziarieKpi from '@/components/terziarie/TerziarieKpi';
import UscitePerImpianto from '@/components/terziarie/UscitePerImpianto';
import TerziarieTable from '@/components/terziarie/TerziarieTable';
import { getRegioneFromProvincia } from '@/lib/regioneMap';
import MultiSelect from '@/components/shared/MultiSelect';
import { fetchAllClient } from '@/lib/fetchAllClient';
import { formatIntero } from '@/lib/utils';

const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const MATERIALI = ['PFU SFUSO', 'CIAB/CIPP', 'FERRO'];

// Giorno, mese e anno sono quelli della fine trasporto, letti sul giorno
// italiano; per un ordine non terminato, quelli dell'immissione (giornoElenco).
// Un terminato senza fine trasporto non ha periodo: meseOrdine e annoOrdine lo
// mettevano nel mese di immissione, e il campo mese salvato, che puo' venire da
// un'importazione vecchia fatta sulla chiusura, gli faceva da ripiego. Resta
// fuori dai filtri di periodo, dagli indicatori e dalle uscite per impianto, e
// si conta nell'avviso sotto i filtri.
const SENZA_FINE = 'MANCA FINE TRASPORTO';
const senzaFineTrasporto = (r) => eTerminato(r) && !giornoMovimento(r);
function getMateriale(r) {
  if (r.peso_ciab_cipp) return 'CIAB/CIPP';
  if (r.ferro) return 'FERRO';
  return 'PFU SFUSO';
}

export default function Terziarie() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState({ impianto: [], destinazione: [], mese: [], trasportatore: [], materiale: [], anno: [], provincia: [], regione: [], stato: [], data: '' });
  const [filterOptions, setFilterOptions] = useState({ impianti: [], destinazioni: [], trasportatori: [], anni: [], province: [], regioni: [], stati: [] });
  const [searchIdOrdine, setSearchIdOrdine] = useState('');
  // i terminati senza fine trasporto che rispondono ai filtri che non sono di periodo
  const [senzaFine, setSenzaFine] = useState([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const all = await fetchAllClient(base44.entities.Terziaria);
      // Build filter options
      setFilterOptions({
        impianti: [...new Set(all.map(r => (r.unita_locale_origine || '').trim()).filter(Boolean))].sort(),
        destinazioni: [...new Set(all.map(r => (r.destinazione || '').trim()).filter(Boolean))].sort(),
        trasportatori: [...new Set(all.map(r => (r.trasportatore || '').trim()).filter(Boolean))].sort(),
        province: [...new Set(all.map(r => (r.provincia || '').trim()).filter(Boolean))].sort(),
        regioni: [...new Set(all.map(r => (getRegioneFromProvincia(r.provincia) || '').trim()).filter(Boolean))].sort(),
        stati: [...new Set(all.map(r => (r.stato || '').trim()).filter(Boolean))].sort(),
        anni: [...new Set(all.map(annoElenco).filter(Boolean))].sort(),
      });
      // I filtri si dividono in due, come nelle primarie: quelli di periodo
      // leggono giornoElenco, gli altri il record. Separati, per contare i
      // terminati senza fine trasporto anche quando si guarda un mese.
      const passaAltri = (r) => {
        if (searchIdOrdine && !(r.id_ordine || '').toLowerCase().includes(searchIdOrdine.toLowerCase().trim())) return false;
        if (filters.impianto.length > 0 && !filters.impianto.includes((r.unita_locale_origine || '').trim())) return false;
        if (filters.destinazione.length > 0 && !filters.destinazione.includes((r.destinazione || '').trim())) return false;
        if (filters.provincia.length > 0 && !filters.provincia.includes((r.provincia || '').trim())) return false;
        if (filters.regione.length > 0 && !filters.regione.includes((getRegioneFromProvincia(r.provincia) || '').trim())) return false;
        if (filters.stato.length > 0 && !filters.stato.includes((r.stato || '').trim())) return false;
        if (filters.trasportatore.length > 0 && !filters.trasportatore.includes((r.trasportatore || '').trim())) return false;
        if (filters.materiale.length > 0 && !filters.materiale.includes(getMateriale(r))) return false;
        return true;
      };
      const passaPeriodo = (r) => {
        if (filters.data && giornoElenco(r) !== filters.data) return false;
        if (filters.mese.length > 0 && !filters.mese.includes(meseElenco(r))) return false;
        if (filters.anno.length > 0 && !filters.anno.map(String).includes(String(annoElenco(r)))) return false;
        return true;
      };
      const filtered = all.filter(r => passaAltri(r) && passaPeriodo(r)).map(r => {
        const senza = senzaFineTrasporto(r);
        return { ...r, mese: senza ? SENZA_FINE : meseElenco(r), senza_fine_trasporto: senza, materiale: getMateriale(r), peso_t: +((r.peso_effettivo || 0) / 1000).toFixed(3) };
      });
      setRecords(filtered);
      setSenzaFine(all.filter(r => passaAltri(r) && senzaFineTrasporto(r)));
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [filters, searchIdOrdine]);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh on new uploads
  useEffect(() => {
    const unsub = base44.entities.UploadLog.subscribe((event) => {
      if ((event.type === 'create' || event.type === 'update') && event.data?.esito !== 'in_corso') loadData();
    });
    return unsub;
  }, [loadData]);

  // Indicatori e uscite per impianto senza i terminati senza fine trasporto:
  // non hanno un periodo, e si contano nell'avviso (regola 1).
  const contati = records.filter(r => !r.senza_fine_trasporto);
  const senzaFineInElenco = records.length - contati.length;
  const kpi = {
    totale_t: contati.reduce((s, r) => s + (r.peso_t || 0), 0),
    spedizioni: contati.length,
    impianti_attivi: new Set(contati.map(r => r.unita_locale_origine).filter(Boolean)).size,
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await base44.functions.invoke('exportTerziarie', { filters });
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

  const hasFilters = Object.values(filters).some(v => Array.isArray(v) ? v.length > 0 : v) || searchIdOrdine;
  const resetFilters = () => setFilters({ impianto: [], destinazione: [], mese: [], trasportatore: [], materiale: [], anno: [], provincia: [], regione: [], stato: [], data: '' });

  return (
    <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold">Terziarie</h1>
          <p className="text-muted-foreground mt-1">Trasporti terziari: i prodotti che escono dagli impianti, per impianto e per materiale.</p>
        </div>
        <button onClick={handleExport} disabled={exporting} className="inline-flex items-center gap-2 px-4 py-2 text-sm btn-secondario">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} Esporta Excel
        </button>
      </div>

      <TerziarieKpi kpi={kpi} />

      {/* Filters */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium inline-flex items-center gap-1.5"><Filter className="w-4 h-4" /> Filtri</span>
          {hasFilters && (
            <button onClick={resetFilters} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <X className="w-3 h-3" /> Reset
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <input type="text" value={searchIdOrdine} onChange={e => setSearchIdOrdine(e.target.value)} placeholder="Cerca ID ordine..." className="w-full border rounded-md px-3 py-2 text-sm" />
          <MultiSelect allLabel="Tutte le regioni" options={filterOptions.regioni || []} selected={filters.regione} onChange={v => setFilters(p => ({ ...p, regione: v }))} />
          <MultiSelect allLabel="Tutti gli stati" options={filterOptions.stati || []} selected={filters.stato} onChange={v => setFilters(p => ({ ...p, stato: v }))} />
          <input type="date" value={filters.data} onChange={e => setFilters(p => ({ ...p, data: e.target.value }))} className="border rounded-md px-3 py-2 text-sm" title="Giorno di fine trasporto (per gli ordini non terminati, giorno di immissione)" aria-label="Giorno di fine trasporto" />
          <MultiSelect allLabel="Tutti gli impianti" options={filterOptions.impianti || []} selected={filters.impianto} onChange={v => setFilters(p => ({ ...p, impianto: v }))} />
          <MultiSelect allLabel="Tutte le destinazioni" options={filterOptions.destinazioni || []} selected={filters.destinazione} onChange={v => setFilters(p => ({ ...p, destinazione: v }))} />
          <MultiSelect allLabel="Tutte le province" options={filterOptions.province || []} selected={filters.provincia} onChange={v => setFilters(p => ({ ...p, provincia: v }))} />
          <MultiSelect allLabel="Tutti i mesi" options={MESI} selected={filters.mese} onChange={v => setFilters(p => ({ ...p, mese: v }))} />
          <MultiSelect allLabel="Tutti i trasportatori" options={filterOptions.trasportatori || []} selected={filters.trasportatore} onChange={v => setFilters(p => ({ ...p, trasportatore: v }))} />
          <MultiSelect allLabel="Tutti i materiali" options={MATERIALI} selected={filters.materiale} onChange={v => setFilters(p => ({ ...p, materiale: v }))} />
          <MultiSelect allLabel="Tutti gli anni" options={(filterOptions.anni || []).map(a => String(a))} selected={filters.anno.map(String)} onChange={v => setFilters(p => ({ ...p, anno: v }))} />
        </div>
        <p className="text-xs text-muted-foreground">Giorno, mese e anno sono quelli della fine del trasporto; per un ordine non ancora trasportato, quelli dell&apos;immissione.</p>
        {senzaFine.length > 0 && (
          <div className="border border-amber-300 bg-amber-50 text-amber-900 rounded-lg px-3 py-2 text-sm">
            {senzaFine.length === 1 ? '1 trasporto terziario terminato non ha' : `${formatIntero(senzaFine.length)} trasporti terziari terminati non hanno`} la fine del trasporto
            {senzaFine.some(r => r.id_ordine) && <> (es. {senzaFine.map(r => r.id_ordine).filter(Boolean).slice(0, 5).join(', ')})</>}:
            {senzaFine.length === 1
              ? ' senza giorno, mese e anno resta fuori dai filtri di periodo, dagli indicatori e dalle uscite per impianto. Si vede nel dettaglio senza filtri di periodo o cercando l\'ID; va corretto nel file del portale e ricaricato.'
              : ' senza giorno, mese e anno restano fuori dai filtri di periodo, dagli indicatori e dalle uscite per impianto. Si vedono nel dettaglio senza filtri di periodo o cercando l\'ID; vanno corretti nel file del portale e ricaricati.'}
          </div>
        )}
      </div>

      {/* Uscite di prodotti per impianto, dagli stessi trasporti filtrati qui
          sotto, senza i terminati senza fine trasporto */}
      <div className="space-y-3">
        <h2 className="text-lg font-heading font-semibold">Uscite per impianto</h2>
        <UscitePerImpianto records={contati} loading={loading} />
      </div>

      {/* Data table */}
      <div className="space-y-3">
        <h2 className="text-lg font-heading font-semibold">Dettaglio Trasporti Terziari ({formatIntero(records.length)}{senzaFineInElenco > 0 ? `, di cui ${formatIntero(senzaFineInElenco)} senza fine trasporto` : ''})</h2>
        <TerziarieTable records={records} loading={loading} />
      </div>
    </div>
  );
}