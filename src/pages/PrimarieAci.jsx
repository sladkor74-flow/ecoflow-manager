import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { eTerminato, giornoElenco, giornoMovimento, dateDaSistemare, testoDate } from '@/lib/movimenti';
import { dataPortaleIt } from '@/lib/giornoItaliano';
import { base44 } from '@/api/base44Client';
import { Loader2, RefreshCw, Truck, Factory, Package, Filter, X, AlertTriangle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ReportConferimenti from '@/components/report-conferimenti/ReportConferimenti';
import { useTableSort } from '@/hooks/useTableSort';
import SortHeader from '@/components/shared/SortHeader';
import MultiSelect from '@/components/shared/MultiSelect';
import { formatNumber, formatIntero, fmtTon } from '@/lib/utils';
import { fetchAllClient } from '@/lib/fetchAllClient';
import CercaIdOrdine, { corrispondeIdOrdine } from '@/components/shared/CercaIdOrdine';
import AvvisoDateDaSistemare, { SegnoDate } from '@/components/primarie-rete/DateDaSistemare';
import AvvisoEseguiti from '@/components/primarie-rete/AvvisoEseguiti';
import { contaFormulariConNumero } from '@/lib/formulari';
import { controlliPortaleAci, problemiDellaRiga } from '@/lib/controlliPortaleAci';
import { creaAscoltoCaricamenti } from '@/lib/ascoltoCaricamenti';

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

// Il giorno con cui la pagina colloca un ordine e' giornoElenco
// (src/lib/movimenti.js): la fine del trasporto; per un ordine non terminato
// (cancellato prima del ritiro) l'immissione. Un terminato senza fine trasporto
// non ha giorno, mese ne' anno: giornoOrdine ripiegava sull'immissione, e un
// ritiro di luglio su un ordine di maggio finiva nel riepilogo di maggio. Resta
// fuori da conteggi e riepiloghi e si segnala.
//
// Immissione, inizio e fine trasporto sono obbligatorie in ogni formulario
// terminato (regola dell'utente, 22/09/2026): l'avviso non conta piu' i soli
// senza fine trasporto ma ogni terminato con una data che manca o non torna, le
// righe del dettaglio hanno il segno e il filtro "Solo date da sistemare" le
// mostra, anche quelle senza periodo con un mese scelto.

// I caricamenti che riscrivono l'archivio delle primarie ACI.
const CARICAMENTI_ACI = ['primarie', 'primarie_aci'];

// Il formulario, il ticket e lo stimato accanto al peso effettivo (audit del
// 20/09, alte A12 e A13; corrette il 12/10/2026). Senza, un formulario ripartito
// su due ordini sembrava un doppione e un ordine oltre la soglia del suo ticket
// non si vedeva: il ticket e' quello che distingue le quote, e le due regole del
// portale (stimato non sotto i 1.500 kg, effettivo non oltre il 110% dello
// stimato) si leggono solo con lo stimato accanto all'effettivo.
const DETAIL_COLUMNS = [
  { key: 'id_ordine', label: 'ID Ordine' },
  { key: 'numero_fir', label: 'Formulario' },
  { key: 'ragione_sociale', label: 'Ragione Sociale' },
  { key: 'provincia', label: 'Provincia' },
  { key: 'destinazione', label: 'Destinazione' },
  { key: 'classe', label: 'Classe' },
  { key: 'quantita_richiesta', label: 'Q.Rich', format: 'number' },
  { key: 'quantita_ritirata', label: 'Q.Ritir', format: 'number' },
  { key: 'numero_ordine_interno', label: 'Ticket' },
  { key: 'peso_stimato', label: 'Stimato (kg)', format: 'number' },
  { key: 'peso_effettivo', label: 'Effettivo (kg)', format: 'number' },
  { key: 'mese', label: 'Mese' },
  { key: 'trasportatore', label: 'Trasportatore' },
  { key: 'fine_trasporto', label: 'Fine trasporto', format: 'date' },
  { key: 'stato', label: 'Stato' },
  // la chiusura a portale si mostra soltanto: non ordina e non filtra niente
  { key: 'ordine_chiuso_il', label: 'Chiuso il', format: 'date' },
];

// Le date si mostrano 'GG/MM/AAAA' con dataPortaleIt: il giorno scritto nel file
// del portale (difetto 9, 16/10/2026). La chiusura e' l'ora italiana del
// portale salvata con la Z, e letta col fuso italiano (giornoRoma, com'era qui)
// una chiusura dopo le 22 d'estate o dopo le 23 d'inverno usciva col giorno
// dopo. La fine del trasporto qui e' gia' un giorno (giornoMovimento).

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
  const [soloDate, setSoloDate] = useState(false);
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
  //
  // UNA RILETTURA PER CARICAMENTO (revisione del 13/10/2026). Ogni evento del
  // registro che non fosse «in_corso» rileggeva l'archivio: un caricamento delle
  // primarie ne manda tre, la riga vecchia chiusa in errore mentre quello nuovo
  // si apre (proprio prima che l'archivio si svuoti), la chiusura e la nota
  // «moduli collegati aggiornati» a ricalcoli finiti, con l'archivio cambiato una
  // volta sola. Ora si rilegge alla chiusura (src/lib/ascoltoCaricamenti.js). La
  // pagina mostra solo l'archivio, niente di quello che i ricalcoli scrivono
  // dopo: alla nota non c'e' niente da rileggere.
  useEffect(() => {
    const leggi = creaAscoltoCaricamenti(CARICAMENTI_ACI);
    const unsub = base44.entities.UploadLog.subscribe((event) => {
      const e = leggi(event);
      if (e && e.concluso) load();
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
      date_da_sistemare: testoDate(r),
    };
  }), [records]);

  // La destinazione si legge sempre senza gli spazi ai lati, come in ogni altro
  // modulo che la guarda (secondarie, giacenze, passiva): un "Irigom " scritto con
  // uno spazio in piu' a portale faceva due voci nella tendina, e scegliendone una
  // gli ordini dell'altra restavano fuori senza dirlo (05/10/2026).
  const destinazioni = [...new Set(records.map(r => (r.destinazione || '').trim()).filter(Boolean))].sort();
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
    if (filterDestinazione.length > 0 && !filterDestinazione.includes((r.destinazione || '').trim())) return false;
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
  const contati = scelti.filter(r => r.giorno_ordine && passaPeriodo(r));
  // Per le date da sistemare: gli ordini dell'elenco e i terminati senza fine
  // trasporto che rispondono agli altri filtri, che nessun filtro di periodo prende.
  const perDate = righe.filter(r => passaAltri(r) && (passaPeriodo(r) || (eTerminato(r) && !r.fine_trasporto)));

  // Il dettaglio si apre sui piu' recenti per fine trasporto: ordinato per
  // chiusura, fra i primi 500 mancava chi aveva ritirato ieri e non era ancora
  // chiuso a portale.
  const dettaglio = cercaId.trim()
    ? righe.filter(r => corrispondeIdOrdine(r, cercaId))
    : soloDate ? perDate.filter(dateDaSistemare) : filtered;
  const vediDate = (v) => { setSoloDate(v); if (v) setScheda('dettaglio'); };
  const sortedDetail = useTableSort(dettaglio, 'giorno_ordine', 'desc');

  const totalKg = contati.reduce((s, r) => s + (r.peso_effettivo || 0), 0);
  const totalRichiesti = contati.reduce((s, r) => s + (r.quantita_richiesta || 0), 0);
  const totalRitirati = contati.reduce((s, r) => s + (r.quantita_ritirata || 0), 0);
  // Gli ordini sono righe, i formulari si contano una volta per numero
  // (12/10/2026): un formulario ripartito su due ordini ACI, ciascuno col suo
  // ticket, e' un documento solo, come lo elenca il portale.
  // Solo le righe col numero del formulario (revisione del 13/10/2026): con un
  // filtro sugli stati non terminati, un ordine cancellato o assegnato un
  // formulario non l'ha, e contato per uno «cancellato» diceva 6 formulari per
  // 6 ordini che non ne hanno nessuno. Senza nessun formulario si scrive «—».
  const totalFormulari = contaFormulariConNumero(contati);
  const testoFormulari = (n) => (n > 0 ? formatIntero(n) : '—');
  // I controlli del portale sui terminati contati, con le regole della passiva.
  const controlli = controlliPortaleAci(contati);
  const daControllare = controlli.sotto_minimo.length + controlli.oltre_soglia.length + controlli.doppi.length;

  // Aggregazione per destinazione
  const byDest = {};
  contati.forEach(r => {
    const d = (r.destinazione || '').trim() || 'N/D';
    if (!byDest[d]) byDest[d] = { count: 0, kg: 0, righe: [] };
    byDest[d].count++;
    byDest[d].kg += r.peso_effettivo || 0;
    byDest[d].righe.push(r);
  });
  const destRows = Object.entries(byDest).sort((a, b) => b[1].kg - a[1].kg);

  // Aggregazione per mese, quello della fine del trasporto, e per anno: l'archivio
  // ACI copre piu' anni, e raggruppando per il solo nome del mese "Luglio"
  // sommava luglio 2025 e luglio 2026. I contati hanno tutti giorno, mese e anno.
  const byMese = {};
  contati.forEach(r => {
    const k = `${r.anno_ordine}|${r.mese}`;
    if (!byMese[k]) byMese[k] = { anno: r.anno_ordine, meseIdx: MESI.indexOf(r.mese), count: 0, kg: 0, righe: [] };
    byMese[k].count++;
    byMese[k].kg += r.peso_effettivo || 0;
    byMese[k].righe.push(r);
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
          <p className="text-xs text-muted-foreground">{totalFormulari > 0 ? `${formatIntero(totalFormulari)} ${totalFormulari === 1 ? 'formulario' : 'formulari'}` : 'formulari: —'}</p>
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
      <AvvisoDateDaSistemare
        righe={perDate}
        canale="ACI"
        nota="Chi non ha la fine trasporto non ha un mese e resta fuori da indicatori e riepiloghi; gli altri sono contati nel mese della fine trasporto."
        attivo={soloDate}
        onFiltra={vediDate}
      />
      {/* Gli ordini "eseguito" a portale: tutti i dati, ma nessuno ha premuto
          Chiudi. Non si sommano ai terminati e non cambiano nessun conto: si
          contano a parte. Si guarda tutto l'archivio ACI, non i filtri: un
          ordine senza fine trasporto non risponde a nessun filtro di periodo. */}
      <AvvisoEseguiti righe={records} canale="ACI" />

      {/* Le due regole del portale e il formulario ripetuto sullo stesso ordine,
          sugli ordini contati (12/10/2026): le stesse della passiva, che fino a
          oggi era l'unica a vederle. Non tolgono niente dai conti: si dicono. */}
      {daControllare > 0 && (
        <div className="border border-amber-300 bg-amber-50 text-amber-900 rounded-lg px-4 py-3 text-sm space-y-1">
          <div className="font-semibold">Controlli del portale sugli ordini contati: {formatIntero(daControllare)} da guardare</div>
          {controlli.sotto_minimo.length > 0 && (
            <div>
              {controlli.sotto_minimo.length === 1 ? 'Un ordine stimato' : `${formatIntero(controlli.sotto_minimo.length)} ordini stimati`} sotto i 1.500 kg ammessi per una richiesta ACI:{' '}
              {controlli.sotto_minimo.slice(0, 5).map(r => `${r.id_ordine || '—'} (ticket ${r.numero_ordine_interno || '—'}, stimato ${formatIntero(r.peso_stimato)} kg)`).join('; ')}
              {controlli.sotto_minimo.length > 5 ? ` e altri ${controlli.sotto_minimo.length - 5}` : ''}.
            </div>
          )}
          {controlli.oltre_soglia.length > 0 && (
            <div>
              {controlli.oltre_soglia.length === 1 ? 'Un formulario chiuso' : `${formatIntero(controlli.oltre_soglia.length)} formulari chiusi`} oltre il 110% dello stimato del ticket, da ripartire su un altro ordine:{' '}
              {controlli.oltre_soglia.slice(0, 5).map(o => `${o.riga.numero_fir || '—'} su ${o.riga.id_ordine || '—'} (ticket ${o.riga.numero_ordine_interno || '—'}, ${formatIntero(o.riga.peso_effettivo)} kg su ${formatIntero(o.massimo_kg)} ammessi)`).join('; ')}
              {controlli.oltre_soglia.length > 5 ? ` e altri ${controlli.oltre_soglia.length - 5}` : ''}.
            </div>
          )}
          {controlli.doppi.length > 0 && (
            <div className="text-red-800">
              {controlli.doppi.length === 1 ? 'Un formulario compare' : `${formatIntero(controlli.doppi.length)} formulari compaiono`} più volte sullo stesso ordine, cioè lo stesso ritiro caricato due volte:{' '}
              {controlli.doppi.slice(0, 5).map(d => `${d.numero_fir} su ${d.ordine} (${d.righe.map(r => `${formatIntero(r.peso_effettivo)} kg`).join(' + ')})`).join('; ')}
              {controlli.doppi.length > 5 ? ` e altri ${controlli.doppi.length - 5}` : ''}.
            </div>
          )}
          <div className="text-xs">Un formulario ripartito su due ordini, ciascuno col suo ticket, è la regola del portale e non un doppione: nei conti vale una volta. Le righe sono segnate nel dettaglio.</div>
        </div>
      )}

      <CercaIdOrdine value={cercaId} onChange={setCercaId} trovati={loading || !records.length ? null : dettaglio.length} />

      {/* Filtri */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm font-medium inline-flex items-center gap-1.5"><Filter className="w-4 h-4" /> Filtri rapidi</span>
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer text-muted-foreground hover:text-foreground" title="Solo i terminati a cui manca l'immissione, l'inizio o la fine del trasporto, o con le date nell'ordine sbagliato">
              <input type="checkbox" checked={soloDate} onChange={e => vediDate(e.target.checked)} /> Solo date da sistemare
            </label>
          </div>
          {(soloDate || filterMese.length > 0 || filterDestinazione.length > 0 || filterProvincia.length > 0 || filterTrasportatore.length > 0 || filterData || filterRegione.length > 0 || filterStato.length > 0 || filterAnno.length > 0) && (
            <button onClick={() => { setFilterMese([]); setFilterDestinazione([]); setFilterProvincia([]); setFilterTrasportatore([]); setFilterData(''); setFilterRegione([]); setFilterStato([]); setFilterAnno([]); setSoloDate(false); }} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <X className="w-3 h-3" /> Reset
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-2">
          <MultiSelect allLabel="Tutte le regioni" breve="Regioni" options={regioni} selected={filterRegione} onChange={setFilterRegione} />
          <MultiSelect allLabel="Tutti gli stati" breve="Stati" options={stati} selected={filterStato} onChange={setFilterStato} />
          <MultiSelect allLabel="Tutti i mesi" breve="Mesi" options={MESI} selected={filterMese} onChange={setFilterMese} />
          <MultiSelect allLabel="Tutti gli anni" breve="Anni" options={anni.map(String)} selected={filterAnno.map(String)} onChange={v => setFilterAnno(v.map(Number))} />
          <MultiSelect allLabel="Tutte le destinazioni" breve="Destinazioni" options={destinazioni} selected={filterDestinazione} onChange={setFilterDestinazione} />
          <MultiSelect allLabel="Tutte le province" breve="Province" options={province} selected={filterProvincia} onChange={setFilterProvincia} />
          <MultiSelect allLabel="Tutti i trasportatori" breve="Trasportatori" options={trasportatori} selected={filterTrasportatore} onChange={setFilterTrasportatore} />
          <input type="date" value={filterData} onChange={e => setFilterData(e.target.value)} className="border rounded-md px-3 py-2 text-sm" placeholder="Fine trasporto" title="Giorno di fine trasporto (per gli ordini non terminati, giorno di immissione)" aria-label="Giorno di fine trasporto" />
        </div>
      </div>

      <Tabs value={scheda} onValueChange={setScheda}>
        <TabsList>
          <TabsTrigger value="destinazioni">Per Destinazione</TabsTrigger>
          <TabsTrigger value="mese">Per Mese</TabsTrigger>
          <TabsTrigger value="dettaglio">Dettaglio Record ({formatNumber(dettaglio.length, { minimumFractionDigits: 0, maximumFractionDigits: 0 })})</TabsTrigger>
          <TabsTrigger value="conferimenti">Conferimenti per settimana</TabsTrigger>
        </TabsList>

        <TabsContent value="destinazioni" className="mt-4">
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted"><tr>
                <th className="text-left px-3 py-2 font-semibold">Destinazione</th>
                <th className="text-right px-3 py-2 font-semibold">Ordini</th>
                <th className="text-right px-3 py-2 font-semibold" title="Formulari distinti: uno ripartito su due ordini conta una volta">Formulari</th>
                <th className="text-right px-3 py-2 font-semibold">Kg Totali</th>
                <th className="text-right px-3 py-2 font-semibold">Ton</th>
              </tr></thead>
              <tbody>
                {destRows.map(([dest, v], i) => (
                  <tr key={dest} className={`border-t ${i % 2 ? 'bg-muted/20' : ''}`}>
                    <td className="px-3 py-2 font-medium">{dest}</td>
                    <td className="px-3 py-2 text-right">{formatNumber(v.count, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                    <td className="px-3 py-2 text-right">{testoFormulari(contaFormulariConNumero(v.righe))}</td>
                    <td className="px-3 py-2 text-right">{formatNumber(v.kg, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                    <td className="px-3 py-2 text-right font-bold">{fmtTon(v.kg / 1000)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="bg-primary text-primary-foreground font-bold">
                <td className="px-3 py-3">TOTALE</td>
                <td className="px-3 py-3 text-right">{formatIntero(contati.length)}</td>
                <td className="px-3 py-3 text-right">{testoFormulari(totalFormulari)}</td>
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
                <th className="text-right px-3 py-2 font-semibold">Ordini</th>
                <th className="text-right px-3 py-2 font-semibold" title="Formulari distinti: uno ripartito su due ordini conta una volta">Formulari</th>
                <th className="text-right px-3 py-2 font-semibold">Kg Totali</th>
                <th className="text-right px-3 py-2 font-semibold">Ton</th>
              </tr></thead>
              <tbody>
                {meseRows.map(([m, v], i) => (
                  <tr key={m} className={`border-t ${i % 2 ? 'bg-muted/20' : ''}`}>
                    <td className="px-3 py-2 font-medium">{m}</td>
                    <td className="px-3 py-2 text-right">{formatNumber(v.count, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                    <td className="px-3 py-2 text-right">{testoFormulari(contaFormulariConNumero(v.righe))}</td>
                    <td className="px-3 py-2 text-right">{formatNumber(v.kg, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                    <td className="px-3 py-2 text-right font-bold">{fmtTon(v.kg / 1000)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* I conferimenti ACI del mese ripartiti sulle settimane che lo coprono
            (richiesta dell utente, 29/09/2026): stesso motore delle secondarie, con
            il canale ACI. */}
        <TabsContent value="conferimenti" className="mt-4 space-y-3">
          <ReportConferimenti canale="ACI" tipo="primaria" titolo="Conferimenti primarie ACI" />
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
                {sortedDetail.sorted.slice(0, 500).map((r, i) => {
                  // le regole del portale e il formulario ripetuto, sui terminati (12/10/2026)
                  const problemi = eTerminato(r) ? problemiDellaRiga(r, controlli.doppi) : [];
                  return (
                  <tr key={r.id} className={`border-t hover:bg-muted/30 ${problemi.length ? 'bg-red-50/60' : r.date_da_sistemare ? 'bg-amber-50/60' : i % 2 ? 'bg-muted/10' : ''}`}>
                    {DETAIL_COLUMNS.map((col) => {
                      let val = r[col.key];
                      // un numero che manca non e' zero: si scrive «—»
                      if (col.format === 'number') val = val != null && val !== '' ? formatNumber(val, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '—';
                      else if (col.format === 'date') val = dataPortaleIt(val);
                      return (
                        <td key={col.key} className={`px-2 py-1.5 whitespace-nowrap ${col.format === 'number' ? 'text-right' : ''} ${col.key === 'ragione_sociale' || col.key === 'destinazione' ? 'truncate max-w-[200px]' : ''}`}>
                          {/* il segno delle date da sistemare, col dettaglio nel title (22/09/2026) */}
                          {col.key === 'id_ordine' && <SegnoDate testo={r.date_da_sistemare} />}
                          {col.key === 'id_ordine' && problemi.length > 0 && (
                            <span title={`Controlli del portale: ${problemi.join('; ')}`} aria-label={`Controlli del portale: ${problemi.join('; ')}`} className="inline-flex align-middle mr-1 text-red-600">
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </span>
                          )}
                          {val ?? ''}
                        </td>
                      );
                    })}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {sortedDetail.sorted.length > 500 && <p className="text-xs text-muted-foreground mt-2">Mostrati primi 500 di {formatNumber(sortedDetail.sorted.length, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} record{sortedDetail.sortKey === 'giorno_ordine' && sortedDetail.sortDir === 'desc' ? ', i più recenti per fine trasporto (per un ordine non terminato, per immissione; i terminati senza fine trasporto in cima)' : ''}.</p>}
        </TabsContent>
      </Tabs>
    </div>
  );
}