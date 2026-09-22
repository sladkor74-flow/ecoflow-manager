import React, { useState, useEffect, useCallback, useRef } from 'react';
import { eTerminato, giornoElenco, settimanaIso, dateDaSistemare, testoDate, MESI_MOVIMENTI } from '@/lib/movimenti';
import { base44 } from '@/api/base44Client';
import { Loader2, FileSpreadsheet, Filter, X, Table2, LayoutGrid, Route } from 'lucide-react';
import AlertBadge from '@/components/alerts/AlertBadge';
import SecondarieUpload from '@/components/secondarie/SecondarieUpload';
import SecondarieKpi from '@/components/secondarie/SecondarieKpi';
import TrattaMatrix from '@/components/secondarie/TrattaMatrix';
import SecondarieTable from '@/components/secondarie/SecondarieTable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getRegioneFromProvincia } from '@/lib/regioneMap';
import { fmtTon, formatIntero } from '@/lib/utils';
import MultiSelect from '@/components/shared/MultiSelect';
import { fetchAllClient } from '@/lib/fetchAllClient';
import { canaleDi } from '@/lib/canaleSecondaria';

// Rete e ACI stanno nello stesso archivio ma sono commesse separate: la pagina
// ne guarda una alla volta, e si apre sulla rete. Il filtro partiva vuoto, con
// l'etichetta "Rete e ACI insieme", e il titolo del dettaglio contava i viaggi
// dei due canali in un numero solo.
const CANALI = ['Rete', 'ACI'];
const canaleRiga = (r) => (canaleDi(r) === 'ACI' ? 'ACI' : 'Rete');
// date_da_sistemare: il filtro dei terminati a cui manca l'immissione, l'inizio
// o la fine del trasporto, o con le date incoerenti (regola dell'utente,
// 22/09/2026). Va anche alle funzioni: matrice, KPI ed Excel dicono le stesse
// righe dello schermo.
const filtriVuoti = (canale) => ({ canale: [canale], stoccaggio: [], destinazione: [], mese: [], settimana: [], classe: [], trasportatore: [], anno: [], provincia: [], regione: [], stato: [], data: '', date_da_sistemare: false });

// Il periodo di una secondaria, con la stessa regola di computeSecondarieMatrix
// e di exportSecondarie (giornoElenco): un terminato si colloca solo sulla fine
// del trasporto (giorno italiano); un ordine non terminato, che non e' un
// movimento, all'immissione; un terminato senza fine trasporto non ha periodo
// (null) e nessun filtro di periodo lo prende. Il dettaglio filtrava sui campi
// mese e settimane salvati sul record; ora il periodo e' lo stesso della
// matrice. L'insieme invece no: senza un filtro sullo stato la matrice e i KPI
// contano i soli terminati con la fine trasporto, il dettaglio elenca tutti gli
// ordini (anche assegnati, cancellati e terminati senza fine trasporto). Per
// questo il suo titolo li conta separati: senza filtro sullo stato il primo
// numero e' quello del KPI.
function periodoDi(r) {
  const g = giornoElenco(r);
  if (g) return { giorno: g, anno: Number(g.slice(0, 4)), mese: MESI_MOVIMENTI[Number(g.slice(5, 7)) - 1], settimana: settimanaIso(g) };
  return eTerminato(r) ? null : { giorno: '', anno: null, mese: 'N/D', settimana: 'N/D' };
}

export default function Secondarie() {
  const [data, setData] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [filters, setFilters] = useState(() => filtriVuoti('Rete'));
  const [viewMode, setViewMode] = useState('matrix');
  const [searchIdOrdine, setSearchIdOrdine] = useState('');
  // Ogni caricamento del file aggiorna tutta la pagina: matrice, KPI, avvisi e
  // anche il dettaglio, che prima restava quello di prima del caricamento.
  const [versione, setVersione] = useState(0);
  const aggiorna = useCallback(() => setVersione(v => v + 1), []);
  // Vale solo l'ultima richiesta: passando da Rete ad ACI, una risposta della
  // rete arrivata in ritardo finiva sotto la scheda ACI.
  const ultimaMatrice = useRef(0);
  const ultimoDettaglio = useRef(0);

  const canale = filters.canale[0] || 'Rete';

  const loadData = useCallback(async () => {
    const n = ++ultimaMatrice.current;
    setLoading(true);
    try {
      const res = await base44.functions.invoke('computeSecondarieMatrix', { filters });
      if (n === ultimaMatrice.current) setData(res.data);
    } catch (e) { console.error(e); }
    if (n === ultimaMatrice.current) setLoading(false);
  }, [filters]);

  const loadRecords = useCallback(async () => {
    const n = ++ultimoDettaglio.current;
    setLoadingRecords(true);
    try {
      const all = await fetchAllClient(base44.entities.Secondaria);
      const cerca = searchIdOrdine.toLowerCase().trim();
      const righe = [];
      for (const r of all) {
        if (cerca && !(r.id_ordine || '').toLowerCase().includes(cerca)) continue;
        if (filters.canale.length > 0 && !filters.canale.includes(canaleRiga(r))) continue;
        if (filters.stoccaggio.length > 0 && !filters.stoccaggio.includes((r.stoccaggio || '').trim())) continue;
        if (filters.destinazione.length > 0 && !filters.destinazione.includes((r.destinazione || '').trim())) continue;
        if (filters.classe.length > 0 && !filters.classe.includes(r.classe)) continue;
        if (filters.trasportatore.length > 0 && !filters.trasportatore.includes((r.trasportatore || '').trim())) continue;
        if (filters.provincia.length > 0 && !filters.provincia.includes((r.provincia || '').trim())) continue;
        if (filters.regione.length > 0) {
          const reg = r.regione || getRegioneFromProvincia(r.provincia);
          if (!filters.regione.includes((reg || '').trim())) continue;
        }
        if (filters.stato.length > 0 && !filters.stato.map(s => s.toLowerCase()).includes((r.stato || '').trim().toLowerCase())) continue;
        if (filters.date_da_sistemare && !dateDaSistemare(r)) continue;
        // Mese, settimana, giorno e anno come nel server (matchesFilter e
        // matchesFilterString): senza periodo vale 'N/D', che nessuna opzione
        // dei filtri propone. Con il filtro delle date da sistemare un terminato
        // senza fine trasporto resta anche con un periodo scelto, come
        // nell'Excel: e' proprio quello da correggere, e un periodo non l'ha.
        const p = periodoDi(r);
        const fuoriPeriodo = filters.date_da_sistemare && p === null;
        if (!fuoriPeriodo) {
          if (filters.mese.length > 0 && !filters.mese.includes(p ? p.mese : 'N/D')) continue;
          if (filters.settimana.length > 0 && !filters.settimana.map(String).includes(String(p ? p.settimana : 'N/D'))) continue;
          if (filters.data && (!p || p.giorno !== filters.data)) continue;
          if (filters.anno.length > 0 && (!p || p.anno == null || !filters.anno.map(String).includes(String(p.anno)))) continue;
        }
        righe.push({
          ...r,
          peso_t: +((r.peso_effettivo || 0) / 1000).toFixed(3),
          // Le colonne della tabella vengono dal periodo, non dai campi mese e
          // settimane salvati. Un terminato senza fine trasporto non ha giorno:
          // nell'ordinamento per data sta in cima, marcato, perche' va corretto.
          giorno_ordine: p && p.giorno ? p.giorno : null,
          fine_trasporto: r.trasporto_finito_il || null,
          mese: p && p.mese !== 'N/D' ? p.mese : null,
          settimana: p && typeof p.settimana === 'number' ? p.settimana : null,
          senza_fine_trasporto: p === null,
          // quale data obbligatoria manca o non torna, per il segno sulla riga
          date_da_sistemare: testoDate(r),
        });
      }
      if (n === ultimoDettaglio.current) setRecords(righe);
    } catch (e) { console.error(e); }
    if (n === ultimoDettaglio.current) setLoadingRecords(false);
  }, [filters, searchIdOrdine]);

  useEffect(() => { loadData(); }, [loadData, versione]);
  useEffect(() => { if (viewMode === 'detail') loadRecords(); }, [loadRecords, viewMode, versione]);

  useEffect(() => {
    (async () => {
      try {
        const res = await base44.functions.invoke('getAlerts', { modulo: 'secondarie', solo_aperti: true });
        setAlertCount(res.data?.total || 0);
      } catch { /* il contatore degli avvisi non e' essenziale */ }
    })();
  }, [versione]);

  useEffect(() => {
    const unsub = base44.entities.UploadLog.subscribe((event) => {
      if ((event.type === 'create' || event.type === 'update') && event.data?.esito !== 'in_corso' && event.data?.tipo_file === 'secondarie') aggiorna();
    });
    return unsub;
  }, [aggiorna]);

  const handleExport = async (mode) => {
    setExporting(true);
    try {
      const res = await base44.functions.invoke('exportSecondarie', { filters, mode });
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

  // Il canale non e' un filtro da azzerare: e' la scheda che si sta guardando.
  const hasFilters = Object.entries(filters).some(([k, v]) => k !== 'canale' && (Array.isArray(v) ? v.length > 0 : v)) || searchIdOrdine;
  const resetFilters = () => { setFilters(filtriVuoti(canale)); setSearchIdOrdine(''); };
  const scegliCanale = (c) => setFilters(p => ({ ...p, canale: [c] }));
  // Il filtro delle date da sistemare apre il dettaglio: e' li' che si vedono.
  const vediDate = (v) => { setFilters(p => ({ ...p, date_da_sistemare: v })); if (v) setViewMode('detail'); };
  const opts = data?.filterOptions || {};

  // Stati garantiti sempre presenti nel filtro, anche senza record (valori normalizzati in minuscolo)
  const GUARANTEED_STATI = ['assegnato', 'eseguito'];
  const statiOptions = [...new Set([
    ...(opts.stati || []).map(s => (s || '').trim().toLowerCase()),
    ...GUARANTEED_STATI
  ])].sort();
  const prettyStato = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

  // Messaggio vuoto personalizzato in base allo stato selezionato
  const getEmptyMessage = () => {
    if (filters.stato.length === 1) {
      const s = filters.stato[0].toLowerCase();
      if (s === 'eseguito') return `Non sono presenti secondarie ${canale === 'ACI' ? 'ACI' : 'di rete'} in stato di eseguito`;
      if (s === 'assegnato') return `Non sono presenti secondarie ${canale === 'ACI' ? 'ACI' : 'di rete'} in stato di assegnato`;
    }
    return `Nessun trasporto secondario ${canale === 'ACI' ? 'ACI' : 'di rete'} trovato.`;
  };

  // Gli ordini del dettaglio divisi come li contano KPI e matrice: un terminato
  // senza fine trasporto e' escluso dai conti ma si conta e si dice (regola 1).
  const conteggiDettaglio = {
    conFine: records.filter(r => eTerminato(r) && !r.senza_fine_trasporto).length,
    senzaFine: records.filter(r => r.senza_fine_trasporto).length,
    nonTerminati: records.filter(r => !eTerminato(r)).length,
    // i terminati con una data obbligatoria che manca o non torna, fra quelli elencati
    daSistemare: records.filter(r => r.date_da_sistemare).length,
  };

  // La sintesi per classe e' gia' per canale (una riga per canale|classe): qui
  // si tengono solo le righe della scheda aperta.
  const classiDelCanale = (data?.byClasse || []).filter(c => !c.canale || c.canale === canale);

  return (
    <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold">Secondarie — Trasporti tra Stoccaggi</h1>
          <p className="text-muted-foreground mt-1">Tracciamento, aggregazione e controllo dei trasporti secondari PFU per tratta operativa.</p>
        </div>
        <div className="flex items-center gap-2">
          {alertCount > 0 && <AlertBadge count={alertCount} modulo="secondarie" />}
          <button onClick={() => handleExport('matrix')} disabled={exporting} className="inline-flex items-center gap-2 px-3 py-2 text-sm btn-secondario">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LayoutGrid className="w-4 h-4" />} Excel Sintesi {canale}
          </button>
          <button onClick={() => handleExport('detail')} disabled={exporting} className="inline-flex items-center gap-2 px-3 py-2 text-sm btn-secondario">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} Excel Dettaglio {canale}
          </button>
        </div>
      </div>

      <SecondarieUpload onImported={aggiorna} />

      <div className="flex items-center gap-3 flex-wrap">
        <Tabs value={canale} onValueChange={scegliCanale}>
          <TabsList>
            {CANALI.map(c => <TabsTrigger key={c} value={c}>{c}</TabsTrigger>)}
          </TabsList>
        </Tabs>
        <p className="text-xs text-muted-foreground">Rete e ACI sono commesse separate: numeri, matrice, dettaglio ed Excel sono sempre di un canale solo.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Calcolo matrici in corso...
        </div>
      ) : (
        <>
          <SecondarieKpi kpi={data?.kpi} byClasse={data?.byClasse} canali={data?.canali} elencoSenzaFine={data?.senza_fine_trasporto} filtroDate={filters.date_da_sistemare} onFiltroDate={vediDate} />

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
              <input type="text" value={searchIdOrdine} onChange={e => setSearchIdOrdine(e.target.value)} placeholder="Cerca ID ordine..." className="w-full border rounded-md px-3 py-2 text-sm" />
              <MultiSelect allLabel="Tutte le regioni" options={opts.regioni || []} selected={filters.regione} onChange={v => setFilters(p => ({ ...p, regione: v }))} />
              <MultiSelect allLabel="Tutti gli stati" options={statiOptions.map(s => ({ value: s, label: prettyStato(s) }))} selected={filters.stato} onChange={v => setFilters(p => ({ ...p, stato: v }))} />
              <input type="date" value={filters.data} onChange={e => setFilters(p => ({ ...p, data: e.target.value }))} title="Giorno di fine trasporto" className="border rounded-md px-3 py-2 text-sm" />
              <MultiSelect allLabel="Tutte le origini" options={opts.stoccaggi || []} selected={filters.stoccaggio} onChange={v => setFilters(p => ({ ...p, stoccaggio: v }))} />
              <MultiSelect allLabel="Tutte le destinazioni" options={opts.destinazioni || []} selected={filters.destinazione} onChange={v => setFilters(p => ({ ...p, destinazione: v }))} />
              <MultiSelect allLabel="Tutte le province" options={opts.province || []} selected={filters.provincia} onChange={v => setFilters(p => ({ ...p, provincia: v }))} />
              <MultiSelect allLabel="Tutti i mesi" options={opts.mesi || []} selected={filters.mese} onChange={v => setFilters(p => ({ ...p, mese: v }))} />
              <MultiSelect allLabel="Tutte le settimane" options={(opts.settimane || []).map(s => ({ value: String(s), label: `Sett. ${s}` }))} selected={filters.settimana} onChange={v => setFilters(p => ({ ...p, settimana: v }))} />
              <MultiSelect allLabel="Tutte le classi" options={opts.classi || []} selected={filters.classe} onChange={v => setFilters(p => ({ ...p, classe: v }))} />
              <MultiSelect allLabel="Tutti i trasportatori" options={opts.trasportatori || []} selected={filters.trasportatore} onChange={v => setFilters(p => ({ ...p, trasportatore: v }))} />
              <MultiSelect allLabel="Tutti gli anni" options={(opts.anni || []).map(a => String(a))} selected={filters.anno.map(String)} onChange={v => setFilters(p => ({ ...p, anno: v }))} />
              <label className="inline-flex items-center gap-2 border rounded-md px-3 py-2 text-sm cursor-pointer" title="Solo i terminati a cui manca l'immissione, l'inizio o la fine del trasporto, o con le date nell'ordine sbagliato">
                <input type="checkbox" checked={!!filters.date_da_sistemare} onChange={e => vediDate(e.target.checked)} /> Solo date da sistemare
              </label>
            </div>
            <p className="text-xs text-muted-foreground">Giorno, settimana, mese e anno sono quelli della fine del trasporto; per un ordine non ancora trasportato, quelli dell&apos;immissione.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-3">
              <Tabs value={viewMode} onValueChange={setViewMode}>
                <TabsList>
                  <TabsTrigger value="matrix"><Route className="w-4 h-4 mr-1.5" /> Matrice per Tratta</TabsTrigger>
                  <TabsTrigger value="detail"><Table2 className="w-4 h-4 mr-1.5" /> Dettaglio Ordini</TabsTrigger>
                </TabsList>
                <TabsContent value="matrix" className="space-y-3 mt-3">
                  <h2 className="text-lg font-heading font-semibold">Matrice Tratte {canale}: Origine → Destinazione</h2>
                  <TrattaMatrix matrix={data?.matrix} />
                </TabsContent>
                <TabsContent value="detail" className="space-y-3 mt-3">
                  {/* I conteggi sono del solo canale aperto (prima sommavano i
                      viaggi di rete e quelli ACI) e divisi: un numero solo
                      metteva insieme ai terminati gli assegnati, i cancellati e
                      i terminati senza fine trasporto, e non tornava col KPI. */}
                  <h2 className="text-lg font-heading font-semibold">
                    Dettaglio Ordini Secondari {canale}
                    {!loadingRecords && (
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        (terminati con fine trasporto {formatIntero(conteggiDettaglio.conFine)}, senza fine trasporto {formatIntero(conteggiDettaglio.senzaFine)}, non terminati {formatIntero(conteggiDettaglio.nonTerminati)}{conteggiDettaglio.daSistemare > 0 ? `; con date da sistemare ${formatIntero(conteggiDettaglio.daSistemare)}` : ''})
                      </span>
                    )}
                  </h2>
                  <SecondarieTable records={records} loading={loadingRecords} emptyMessage={getEmptyMessage()} />
                </TabsContent>
              </Tabs>
            </div>
            <div className="space-y-3">
              <h2 className="text-lg font-heading font-semibold">Sintesi per Classe PFU · {canale}</h2>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Classe</th>
                      <th className="text-right px-3 py-2 font-medium">Ordini</th>
                      <th className="text-right px-3 py-2 font-medium">Peso (t)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classiDelCanale.length === 0 && (
                      <tr><td colSpan={3} className="px-3 py-4 text-center text-muted-foreground">Nessun trasporto nella vista.</td></tr>
                    )}
                    {/* Una riga per canale e classe: la chiave era la sola classe,
                        e una classe presente nei due canali dava chiavi doppie. */}
                    {classiDelCanale.map((c) => (
                      <tr key={`${c.canale}|${c.classe}`} className="border-t hover:bg-muted/50">
                        <td className="px-3 py-2 font-medium">
                          {c.classe}
                          {c.canale === 'ACI' && <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[11px] align-middle">ACI</span>}
                        </td>
                        <td className="px-3 py-2 text-right">{formatIntero(c.ordini)}</td>
                        <td className="px-3 py-2 text-right">{fmtTon(c.peso_kg / 1000)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
