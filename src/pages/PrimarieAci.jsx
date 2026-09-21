import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { eTerminato, giornoElenco, giornoMovimento } from '@/lib/movimenti';
import { giornoRoma } from '@/lib/giornoItaliano';
import { base44 } from '@/api/base44Client';
import { Loader2, RefreshCw, Truck, Factory, Package, Filter, X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTableSort } from '@/hooks/useTableSort';
import SortHeader from '@/components/shared/SortHeader';
import MultiSelect from '@/components/shared/MultiSelect';
import { formatNumber, formatIntero, fmtTon } from '@/lib/utils';
import { fetchAllClient } from '@/lib/fetchAllClient';
import CercaIdOrdine, { corrispondeIdOrdine } from '@/components/shared/CercaIdOrdine';

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

// Il giorno con cui la pagina colloca un ordine e' giornoElenco
// (src/lib/movimenti.js): la fine del trasporto; per un ordine non terminato
// (cancellato prima del ritiro) l'immissione. Un terminato senza fine trasporto
// non ha giorno, mese ne' anno: giornoOrdine ripiegava sull'immissione, e un
// ritiro di luglio su un ordine di maggio finiva nel riepilogo di maggio. Resta
// fuori da conteggi e riepiloghi e si segnala.

// I caricamenti che riscrivono l'archivio delle primarie ACI.
const CARICAMENTI_ACI = ['primarie', 'primarie_aci'];

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
  { key: 'fine_trasporto', label: 'Fine trasporto', format: 'date' },
  { key: 'stato', label: 'Stato' },
  // la chiusura a portale si mostra soltanto: non ordina e non filtra niente
  { key: 'ordine_chiuso_il', label: 'Chiuso il', format: 'date' },
];

// Le date si mostrano come giorno italiano, 'GG/MM/AAAA'.
const dataIt = (v) => { const g = giornoRoma(v); return g ? `${g.slice(8, 10)}/${g.slice(5, 7)}/${g.slice(0, 4)}` : ''; };

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
  const [cercaId, setCercaId] = useState('');
  const [scheda, setScheda] = useState('destinazioni');
  // Cercando un ID si passa al dettaglio dei record, in tutto l'archivio.
  useEffect(() => { if (cercaId.trim()) setScheda('dettaglio'); }, [cercaId]);

  // Tutto l'archivio, a pagine: una lettura sola si ferma al suo limite e i
  // conteggi restavano corti senza dirlo.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllClient(base44.entities.PrimariaAci);
      setRecords(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  // Ogni caricamento delle primarie aggiorna la pagina: restava quella di prima
  // finche' qualcuno non premeva Aggiorna. Si ricarica a caricamento concluso,
  // mai mentre l'archivio si sta riscrivendo (in_corso).
  useEffect(() => {
    const unsub = base44.entities.UploadLog.subscribe((event) => {
      if ((event.type === 'create' || event.type === 'update') && event.data?.esito !== 'in_corso' && CARICAMENTI_ACI.includes(event.data?.tipo_file)) load();
    });
    return unsub;
  }, [load]);

  // Mese, anno e giorno di ogni ordine si ricavano una volta per caricamento
  // (giornoElenco): il campo mese salvato puo' venire da un'importazione vecchia,
  // quando il riferimento era la chiusura a portale, e filtro per mese e
  // riepilogo mensile lo usavano.
  const righe = useMemo(() => records.map(r => {
    const g = giornoElenco(r);
    return {
      ...r,
      giorno_ordine: g || null,
      anno_ordine: g ? Number(g.slice(0, 4)) : null,
      fine_trasporto: giornoMovimento(r) || null,
      mese: g ? MESI[Number(g.slice(5, 7)) - 1] : null,
    };
  }), [records]);

  const destinazioni = [...new Set(records.map(r => r.destinazione).filter(Boolean))].sort();
  const province = [...new Set(records.map(r => (r.provincia || '').trim()).filter(Boolean))].sort();
  const trasportatori = [...new Set(records.map(r => (r.trasportatore || '').trim()).filter(Boolean))].sort();
  const regioni = [...new Set(records.map(r => (r.regione || '').trim()).filter(Boolean))].sort();
  const stati = [...new Set(records.map(r => (r.stato || '').trim()).filter(Boolean))].sort();
  const anni = [...new Set(righe.map(r => r.anno_ordine).filter(Boolean))].sort((a, b) => b - a);

  // I filtri si dividono in due, come nelle secondarie (computeSecondarieMatrix):
  // quelli di periodo leggono giorno, mese e anno ricavati sopra, gli altri il
  // record. Servono separati per contare i terminati senza fine trasporto anche
  // quando si guarda un mese, che nessun filtro di periodo prende.
  const passaAltri = (r) => {
    if (filterDestinazione.length > 0 && !filterDestinazione.includes(r.destinazione)) return false;
    if (filterProvincia.length > 0 && !filterProvincia.includes((r.provincia || '').trim())) return false;
    if (filterTrasportatore.length > 0 && !filterTrasportatore.includes((r.trasportatore || '').trim())) return false;
    if (filterRegione.length > 0 && !filterRegione.includes((r.regione || '').trim())) return false;
    if (filterStato.length > 0 && !filterStato.includes((r.stato || '').trim())) return false;
    return true;
  };
  const passaPeriodo = (r) => {
    if (filterMese.length > 0 && !filterMese.includes(r.mese)) return false;
    if (filterAnno.length > 0 && !filterAnno.map(String).includes(String(r.anno_ordine))) return false;
    if (filterData && r.giorno_ordine !== filterData) return false;
    return true;
  };
  // L'elenco mostra ogni ordine che risponde ai filtri, qualunque sia lo stato.
  const filtered = righe.filter(r => passaAltri(r) && passaPeriodo(r));
  // KPI e riepiloghi parlano di ritiri fatti: senza un filtro sullo stato contano
  // solo i terminati, nel giorno della fine del trasporto. Prima entravano anche
  // i cancellati, che l'archivio ACI contiene, e i terminati senza fine
  // trasporto, messi nel mese di immissione: questi si contano a parte.
  const conStato = filterStato.length > 0;
  const scelti = righe.filter(r => passaAltri(r) && (conStato || eTerminato(r)));
  const senzaFine = scelti.filter(r => eTerminato(r) && !r.fine_trasporto);
  const contati = scelti.filter(r => r.giorno_ordine && passaPeriodo(r));

  // Il dettaglio si apre sui piu' recenti per fine trasporto: ordinato per
  // chiusura, fra i primi 500 mancava chi aveva ritirato ieri e non era ancora
  // chiuso a portale.
  const dettaglio = cercaId.trim() ? righe.filter(r => corrispondeIdOrdine(r, cercaId)) : filtered;
  const sortedDetail = useTableSort(dettaglio, 'giorno_ordine', 'desc');

  const totalKg = contati.reduce((s, r) => s + (r.peso_effettivo || 0), 0);
  const totalRichiesti = contati.reduce((s, r) => s + (r.quantita_richiesta || 0), 0);
  const totalRitirati = contati.reduce((s, r) => s + (r.quantita_ritirata || 0), 0);

  // Aggregazione per destinazione
  const byDest = {};
  contati.forEach(r => {
    const d = r.destinazione || 'N/D';
    if (!byDest[d]) byDest[d] = { count: 0, kg: 0 };
    byDest[d].count++;
    byDest[d].kg += r.peso_effettivo || 0;
  });
  const destRows = Object.entries(byDest).sort((a, b) => b[1].kg - a[1].kg);

  // Aggregazione per mese, quello della fine del trasporto, e per anno: l'archivio
  // ACI copre piu' anni, e raggruppando per il solo nome del mese "Luglio"
  // sommava luglio 2025 e luglio 2026. I contati hanno tutti giorno, mese e anno.
  const byMese = {};
  contati.forEach(r => {
    const k = `${r.anno_ordine}|${r.mese}`;
    if (!byMese[k]) byMese[k] = { anno: r.anno_ordine, meseIdx: MESI.indexOf(r.mese), count: 0, kg: 0 };
    byMese[k].count++;
    byMese[k].kg += r.peso_effettivo || 0;
  });
  const meseRows = Object.values(byMese)
    .sort((a, b) => (a.anno - b.anno) || (a.meseIdx - b.meseIdx))
    .map(v => [`${MESI[v.meseIdx]} ${v.anno}`, v]);
  // Di quali anni sono i numeri: senza un anno scelto, di tutti quelli in archivio.
  const anniScelti = [...filterAnno].sort((a, b) => a - b);
  const anniDeiNumeri = anniScelti.length === 0
    ? 'di tutti gli anni in archivio (scegli un anno per vederne uno solo)'
    : `${anniScelti.length === 1 ? "dell'anno" : 'degli anni'} ${anniScelti.join(', ')}`;

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
        <button onClick={load} className="inline-flex items-center gap-2 px-3 py-2 text-sm btn-secondario">
          <RefreshCw className="w-4 h-4" /> Aggiorna
        </button>
      </div>

      {/* KPI: sui ritiri fatti (contati), non sull'elenco */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="border rounded-lg p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Package className="w-3.5 h-3.5" /> {conStato ? 'Ordini' : 'Ordini terminati'}</div>
          <p className="text-xl font-bold">{formatIntero(contati.length)}</p>
        </div>
        <div className="border rounded-lg p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Truck className="w-3.5 h-3.5" /> Tonnellate</div>
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
      <p className="text-xs text-muted-foreground -mt-3">
        Indicatori e riepiloghi per destinazione e per mese contano {conStato ? 'gli ordini degli stati scelti' : 'gli ordini terminati'} {anniDeiNumeri}, ciascuno nel mese e nell&apos;anno in cui è finito il trasporto{conStato ? ' (un ordine non terminato, in quelli dell\'immissione)' : ''}; il dettaglio elenca tutti gli ordini che rispondono ai filtri.
      </p>
      {senzaFine.length > 0 && (
        <div className="border border-amber-300 bg-amber-50 text-amber-900 rounded-lg px-3 py-2 text-sm">
          {senzaFine.length === 1 ? '1 ordine terminato non ha' : `${formatIntero(senzaFine.length)} ordini terminati non hanno`} la fine del trasporto
          {senzaFine.some(r => r.id_ordine) && <> (es. {senzaFine.map(r => r.id_ordine).filter(Boolean).slice(0, 5).join(', ')})</>}:
          {senzaFine.length === 1
            ? ' non ha un mese e resta fuori da indicatori e riepiloghi. Si vede nel dettaglio senza filtri di periodo o cercando l\'ID.'
            : ' non hanno un mese e restano fuori da indicatori e riepiloghi. Si vedono nel dettaglio senza filtri di periodo o cercando l\'ID.'}
        </div>
      )}

      <CercaIdOrdine value={cercaId} onChange={setCercaId} trovati={loading || !records.length ? null : dettaglio.length} />

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
          <input type="date" value={filterData} onChange={e => setFilterData(e.target.value)} className="border rounded-md px-3 py-2 text-sm" placeholder="Fine trasporto" title="Giorno di fine trasporto (per gli ordini non terminati, giorno di immissione)" aria-label="Giorno di fine trasporto" />
        </div>
      </div>

      <Tabs value={scheda} onValueChange={setScheda}>
        <TabsList>
          <TabsTrigger value="destinazioni">Per Destinazione</TabsTrigger>
          <TabsTrigger value="mese">Per Mese</TabsTrigger>
          <TabsTrigger value="dettaglio">Dettaglio Record ({formatNumber(dettaglio.length, { minimumFractionDigits: 0, maximumFractionDigits: 0 })})</TabsTrigger>
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
                <td className="px-3 py-3 text-right">{formatIntero(contati.length)}</td>
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
                      if (col.format === 'number') val = val != null ? formatNumber(val, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '';
                      else if (col.format === 'date') val = dataIt(val);
                      return <td key={col.key} className={`px-2 py-1.5 whitespace-nowrap ${col.format === 'number' ? 'text-right' : ''} ${col.key === 'ragione_sociale' || col.key === 'destinazione' ? 'truncate max-w-[200px]' : ''}`}>{val ?? ''}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sortedDetail.sorted.length > 500 && <p className="text-xs text-muted-foreground mt-2">Mostrati primi 500 di {formatNumber(sortedDetail.sorted.length, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} record{sortedDetail.sortKey === 'giorno_ordine' && sortedDetail.sortDir === 'desc' ? ', i più recenti per fine trasporto (per un ordine non terminato, per immissione; i terminati senza fine trasporto in cima)' : ''}.</p>}
        </TabsContent>
      </Tabs>
    </div>
  );
}