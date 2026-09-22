import React, { useState, useEffect, useCallback } from 'react';
import { eTerminato, giornoMovimento, giornoElenco, meseElenco, annoElenco, dateDaSistemare } from '@/lib/movimenti';
import { base44 } from '@/api/base44Client';
import { Loader2, Upload, MapPin, BarChart3, Clock, Table2, Filter, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import AlertBadge from '@/components/alerts/AlertBadge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProvinceMatrix from '@/components/primarie-rete/ProvinceMatrix';
import RaccoglitoriMix from '@/components/primarie-rete/RaccoglitoriMix';
import SlaMetrics from '@/components/primarie-rete/SlaMetrics';
import PrimarieReteTable from '@/components/primarie-rete/PrimarieReteTable';
import AvvisoDateDaSistemare from '@/components/primarie-rete/DateDaSistemare';
import MultiSelect from '@/components/shared/MultiSelect';
import { fetchAllClient } from '@/lib/fetchAllClient';
import CercaIdOrdine, { corrispondeIdOrdine } from '@/components/shared/CercaIdOrdine';

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

// Il giorno con cui l'elenco colloca un ordine, per i filtri di giorno, mese e
// anno, e' giornoElenco (src/lib/movimenti.js): la fine del trasporto; per un
// ordine non terminato (cancellato prima del ritiro) l'immissione. Un terminato
// senza fine trasporto non ha giorno: con giornoOrdine ripiegava
// sull'immissione, e un ritiro di luglio su un ordine di maggio rispondeva al
// filtro di maggio. Resta fuori dai filtri di periodo e si conta nell'avviso
// sopra l'elenco. Il campo mese salvato sul record non si usa: puo' venire da
// un'importazione vecchia, quando il riferimento era la chiusura.
//
// Immissione, inizio e fine trasporto sono obbligatorie in ogni formulario
// terminato (regola dell'utente, 22/09/2026): l'avviso sopra l'elenco non conta
// piu' i soli senza fine trasporto ma ogni terminato con una data che manca o
// non torna (dateDaSistemare), le righe hanno il segno, e il filtro "Solo date
// da sistemare" le mostra, anche quelle senza periodo con un mese scelto.

// I caricamenti che riscrivono l'archivio delle primarie di rete.
const CARICAMENTI_RETE = ['primarie', 'primarie_rete'];

export default function PrimarieRete() {
  const [provinceData, setProvinceData] = useState(null);
  const [mixData, setMixData] = useState(null);
  const [slaData, setSlaData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alertCount, setAlertCount] = useState(0);
  // i riquadri che non hanno risposto: si dice quali, invece di lasciarli vuoti
  const [nonCaricati, setNonCaricati] = useState([]);

  const [records, setRecords] = useState([]);
  const [allRecords, setAllRecords] = useState([]);
  // Gli ordini da guardare per le date da sistemare: quelli dell'elenco e, fra
  // quelli che rispondono ai filtri di regione e stato, i terminati senza fine
  // trasporto, che nessun filtro di periodo prende.
  const [perDate, setPerDate] = useState([]);
  // il filtro "Solo date da sistemare": non rilegge l'archivio ne' i riquadri
  const [soloDate, setSoloDate] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [filters, setFilters] = useState({ regione: [], stato: [], data: '', mese: [], anno: [] });
  const [cercaId, setCercaId] = useState('');
  const [scheda, setScheda] = useState('dettaglio');

  // I quattro riquadri sono indipendenti e leggono archivi pesanti: se uno non
  // risponde gli altri tre devono restare a video lo stesso. Prima bastava una
  // chiamata caduta per lasciare la pagina vuota senza dire perche'.
  const loadData = useCallback(async () => {
    setLoading(true);
    const mixFilters = { regione: filters.regione, stato: filters.stato, mese: filters.mese, anno: filters.anno };
    // I tempi si misurano su un anno: quello scelto nel filtro, se e' uno solo,
    // altrimenti l'anno in corso. Prima la scheda restava sempre sull'anno in
    // corso anche filtrando un altro anno, e non lo diceva.
    const annoSla = filters.anno.length === 1 ? filters.anno[0] : null;
    const esiti = await Promise.allSettled([
      base44.functions.invoke('computeProvinceMatrix', {}),
      base44.functions.invoke('computeRaccoglitoriMix', { filters: mixFilters }),
      base44.functions.invoke('computeSlaMetrics', annoSla ? { anno: annoSla } : {}),
      base44.functions.invoke('getAlerts', { modulo: 'primarie_rete', solo_aperti: true }),
    ]);
    const [provRes, mixRes, slaRes, alertRes] = esiti;
    const dato = (r) => (r.status === 'fulfilled' ? r.value.data : null);
    setProvinceData(dato(provRes));
    setMixData(dato(mixRes));
    setSlaData(dato(slaRes));
    setAlertCount(dato(alertRes)?.total || 0);
    const nomi = ['la matrice per provincia', 'il mix dei raccoglitori', 'i tempi di raccolta', 'gli alert aperti'];
    setNonCaricati(esiti.map((r, i) => (r.status === 'rejected' ? nomi[i] : null)).filter(Boolean));
    esiti.filter(r => r.status === 'rejected').forEach(r => console.error(r.reason));
    setLoading(false);
  }, [filters]);

  const loadRecords = useCallback(async () => {
    setLoadingRecords(true);
    try {
      const all = await fetchAllClient(base44.entities.PrimariaRete);
      setAllRecords(all);
      // Regione e stato si leggono sul record, giorno, mese e anno sul periodo
      // (giornoElenco). Separati, per contare i terminati senza fine trasporto
      // anche quando si guarda un mese: nessun filtro di periodo li prende.
      const passaAltri = (r) => {
        if (filters.regione.length > 0 && !filters.regione.includes((r.regione || '').trim())) return false;
        if (filters.stato.length > 0 && !filters.stato.includes((r.stato || '').trim())) return false;
        return true;
      };
      const passaPeriodo = (r) => {
        if (filters.mese.length > 0 && !filters.mese.includes(meseElenco(r))) return false;
        if (filters.anno.length > 0 && !filters.anno.map(String).includes(String(annoElenco(r)))) return false;
        if (filters.data && giornoElenco(r) !== filters.data) return false;
        return true;
      };
      setRecords(all.filter(r => passaAltri(r) && passaPeriodo(r)));
      setPerDate(all.filter(r => passaAltri(r) && (passaPeriodo(r) || (eTerminato(r) && !giornoMovimento(r)))));
    } catch (e) { console.error(e); }
    setLoadingRecords(false);
  }, [filters]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { loadRecords(); }, [loadRecords]);
  // Ogni caricamento delle primarie aggiorna la pagina, riquadri ed elenco: la
  // pagina restava quella di prima finche' qualcuno non la riapriva. Si ricarica
  // a caricamento concluso, mai mentre l'archivio si sta riscrivendo (in_corso).
  useEffect(() => {
    const unsub = base44.entities.UploadLog.subscribe((event) => {
      if ((event.type === 'create' || event.type === 'update') && event.data?.esito !== 'in_corso' && CARICAMENTI_RETE.includes(event.data?.tipo_file)) {
        loadData();
        loadRecords();
      }
    });
    return unsub;
  }, [loadData, loadRecords]);
  // Cercando un ID si passa al dettaglio degli ordini, in tutto l'archivio.
  useEffect(() => { if (cercaId.trim()) setScheda('dettaglio'); }, [cercaId]);
  const ordiniMostrati = cercaId.trim()
    ? allRecords.filter(r => corrispondeIdOrdine(r, cercaId))
    : soloDate ? perDate.filter(dateDaSistemare) : records;

  const regioni = [...new Set(allRecords.map(r => (r.regione || '').trim()).filter(Boolean))].sort();
  const stati = [...new Set(allRecords.map(r => (r.stato || '').trim()).filter(Boolean))].sort();
  const anni = [...new Set(allRecords.map(annoElenco).filter(Boolean))].sort((a, b) => b - a);

  const hasFilters = soloDate || Object.values(filters).some(v => Array.isArray(v) ? v.length > 0 : v);
  const resetFilters = () => { setFilters({ regione: [], stato: [], data: '', mese: [], anno: [] }); setSoloDate(false); };
  const vediDate = (v) => { setSoloDate(v); if (v) setScheda('dettaglio'); };

  return (
    <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold">Terminati Rete</h1>
          <p className="text-muted-foreground mt-1">
            Monitoraggio raccolte PFU per provincia e mix classi consorziali per raccoglitore.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {alertCount > 0 && <AlertBadge count={alertCount} modulo="primarie_rete" />}
          <Link to="/caricamento-dati" className="inline-flex items-center gap-2 px-3 py-2 text-sm btn-secondario">
            <Upload className="w-4 h-4" /> Carica dati
          </Link>
        </div>
      </div>

      {nonCaricati.length > 0 && (
        <div className="border border-amber-300 bg-amber-50 text-amber-900 rounded-lg px-3 py-2 text-sm flex flex-wrap items-center gap-2">
          <span>Non {nonCaricati.length === 1 ? 'si è caricato' : 'si sono caricati'} {nonCaricati.join(', ')}. Il resto della pagina è aggiornato.</span>
          <button type="button" onClick={loadData} className="text-primary hover:underline font-medium">Riprova</button>
        </div>
      )}

      <CercaIdOrdine value={cercaId} onChange={setCercaId} trovati={loadingRecords || !allRecords.length ? null : ordiniMostrati.length} />

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
          <input type="date" value={filters.data} onChange={e => setFilters(p => ({ ...p, data: e.target.value }))} className="border rounded-md px-3 py-2 text-sm" title="Giorno di fine trasporto (per gli ordini non terminati, giorno di immissione)" aria-label="Giorno di fine trasporto" />
          <label className="inline-flex items-center gap-2 border rounded-md px-3 py-2 text-sm cursor-pointer" title="Solo i terminati a cui manca l'immissione, l'inizio o la fine del trasporto, o con le date nell'ordine sbagliato">
            <input type="checkbox" checked={soloDate} onChange={e => vediDate(e.target.checked)} /> Solo date da sistemare
          </label>
        </div>
        {!loadingRecords && (
          <AvvisoDateDaSistemare
            righe={perDate}
            canale="Rete"
            nota="Chi non ha la fine trasporto non ha giorno, mese e anno: resta fuori dai filtri di periodo e dai tempi di raccolta. Anche chi non ha l'immissione o ha le date incoerenti resta fuori dai tempi."
            attivo={soloDate}
            onFiltra={vediDate}
          />
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Calcolo analytics in corso...
        </div>
      ) : (
        <Tabs value={scheda} onValueChange={setScheda}>
          <TabsList>
            <TabsTrigger value="dettaglio"><Table2 className="w-4 h-4 mr-1.5" /> Dettaglio Ordini ({ordiniMostrati.length})</TabsTrigger>
            <TabsTrigger value="province"><MapPin className="w-4 h-4 mr-1.5" /> Province & FIR</TabsTrigger>
            <TabsTrigger value="mix"><BarChart3 className="w-4 h-4 mr-1.5" /> % di scostamento per classi</TabsTrigger>
            <TabsTrigger value="sla"><Clock className="w-4 h-4 mr-1.5" /> SLA & Tempi</TabsTrigger>
          </TabsList>

          <TabsContent value="dettaglio" className="mt-4">
            <PrimarieReteTable records={ordiniMostrati} loading={loadingRecords} />
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
              Scostamento del mix classi PFU per ciascun raccoglitore rispetto ai target consorziali.
              Target: P=75%, M=20%, G1=4%, G2=1%. Soglia deviazione: ±5%.
            </div>
            <RaccoglitoriMix data={mixData} />
          </TabsContent>

          <TabsContent value="sla" className="mt-4">
            <div className="mb-3 text-sm text-muted-foreground">
              Tempi di raccolta per trasportatore, dall'immissione dell'ordine alla fine del trasporto. Alert critico se Nr Giorni medio {'>'} 12 o % fuori tempo {'>'} 20%.
            </div>
            <SlaMetrics data={slaData} anniFiltro={filters.anno} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}