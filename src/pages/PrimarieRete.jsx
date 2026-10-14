import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { eTerminato, giornoMovimento, giornoElenco, meseElenco, annoElenco, dateDaSistemare } from '@/lib/movimenti';
import { base44 } from '@/api/base44Client';
import { Loader2, Upload, MapPin, BarChart3, Clock, Table2, Filter, X, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import AlertBadge from '@/components/alerts/AlertBadge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProvinceMatrix from '@/components/primarie-rete/ProvinceMatrix';
import RaccoglitoriMix from '@/components/primarie-rete/RaccoglitoriMix';
import SlaMetrics from '@/components/primarie-rete/SlaMetrics';
import PrimarieReteTable from '@/components/primarie-rete/PrimarieReteTable';
import AvvisoDateDaSistemare from '@/components/primarie-rete/DateDaSistemare';
import AvvisoEseguiti from '@/components/primarie-rete/AvvisoEseguiti';
import MultiSelect from '@/components/shared/MultiSelect';
import { fetchAllClient } from '@/lib/fetchAllClient';
import { creaSequenza } from '@/lib/ultimaRichiesta';
import CercaIdOrdine, { corrispondeIdOrdine } from '@/components/shared/CercaIdOrdine';
import CercaPdr, { corrispondePdr, cercaPdrAttiva, puntiDiRaccolta } from '@/components/shared/CercaPdr';
import { creaAscoltoCaricamenti } from '@/lib/ascoltoCaricamenti';

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
//
// L'avviso riceve perDate, cioe' due insiemi in uno: gli ordini del periodo
// scelto e i terminati senza fine trasporto di QUALUNQUE anno. Il componente
// scrive le due quote separate (erano sommate senza dirlo: "446 segnalati" a chi
// nel 2026 ne vedeva 200) e conta ordini distinti, non righe. Qui sotto la
// scheda del dettaglio dice righe, perche' righe sono quelle che mostra.
//
// UNA LETTURA SOLA, I FILTRI IN MEMORIA (segnalazione alta A14 del 20/09,
// corretta il 12/10/2026). Ogni filtro - anche il giorno, il trasportatore o la
// destinazione, che nessun riquadro guarda - rileggeva tutto l'archivio delle
// primarie (10.487 righe l'11/10/2026, tre pagine) e richiamava le quattro
// funzioni dei riquadri: sette richieste a ogni clic, sul limite al minuto che
// vale per tutta l'app. Ora l'archivio si legge all'apertura e dopo ogni
// caricamento delle primarie, e regione, stato, periodo, trasportatore,
// destinazione, «Solo date da sistemare» e le due ricerche lo filtrano in
// memoria, con le stesse regole di prima: i numeri a video sono gli stessi
// (prove/terminatiReteUnaLettura.mjs). Dei riquadri si richiama solo chi dipende dal
// filtro cambiato: il mix delle classi da regione, stato, mese e anno; i tempi
// di raccolta dall'anno, se e' uno solo. La matrice per provincia e gli alert
// non guardano i filtri e si leggono una volta.

// I caricamenti che riscrivono l'archivio delle primarie di rete.
const CARICAMENTI_RETE = ['primarie', 'primarie_rete'];

// I riquadri e l'elenco, nell'ordine in cui si nominano quando non rispondono.
const NOMI_NON_CARICATI = {
  archivio: "l'elenco degli ordini",
  province: 'la matrice per provincia',
  mix: 'il mix dei raccoglitori',
  sla: 'i tempi di raccolta',
  alert: 'gli alert aperti',
};

const FILTRI_VUOTI = { regione: [], stato: [], trasportatore: [], destinazione: [], data: '', mese: [], anno: [] };

function InAttesa({ cosa }) {
  return (
    <div className="flex items-center justify-center py-12 text-muted-foreground">
      <Loader2 className="w-6 h-6 animate-spin mr-2" /> {cosa}
    </div>
  );
}

export default function PrimarieRete() {
  const [provinceData, setProvinceData] = useState(null);
  const [mixData, setMixData] = useState(null);
  const [slaData, setSlaData] = useState(null);
  // Gli alert aperti del modulo: undefined finche' non si sono letti la prima
  // volta (non si mostra niente), null se getAlerts non ha risposto (si mostra
  // «—», non letto), altrimenti il numero (13/10/2026: prima una lettura caduta
  // metteva 0 e il segno spariva, come se non ci fossero alert aperti).
  const [alertCount, setAlertCount] = useState(undefined);
  // Chi sta ancora calcolando: ogni scheda aspetta il suo riquadro, e l'elenco
  // degli ordini resta a video mentre si ricalcola il mix.
  const [inCorso, setInCorso] = useState({ fissi: true, mix: true, sla: true });
  // i riquadri che non hanno risposto: si dice quali, invece di lasciarli vuoti
  const [nonCaricati, setNonCaricati] = useState({});

  const [allRecords, setAllRecords] = useState([]);
  // il filtro "Solo date da sistemare": non rilegge l'archivio ne' i riquadri
  const [soloDate, setSoloDate] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [filters, setFilters] = useState(FILTRI_VUOTI);
  const [cercaId, setCercaId] = useState('');
  const [cercaPdr, setCercaPdr] = useState('');
  const [scheda, setScheda] = useState('dettaglio');

  // Vale solo l'ultima richiesta partita (src/lib/ultimaRichiesta.js): due
  // filtri cambiati di fila mandano due mix, e quello del primo non deve
  // prendersi lo schermo se torna per ultimo.
  const seqArchivio = useRef(creaSequenza()).current;
  const seqFissi = useRef(creaSequenza()).current;
  const seqMix = useRef(creaSequenza()).current;
  const seqSla = useRef(creaSequenza()).current;
  const seqAlert = useRef(creaSequenza()).current;

  const leggiArchivio = useCallback(async () => {
    const mia = seqArchivio.inizia();
    setLoadingRecords(true);
    try {
      const all = await fetchAllClient(base44.entities.PrimariaRete);
      if (!seqArchivio.valida(mia)) return;
      setAllRecords(all);
      setNonCaricati(p => ({ ...p, archivio: false }));
    } catch (e) {
      console.error(e);
      if (!seqArchivio.valida(mia)) return;
      setNonCaricati(p => ({ ...p, archivio: true }));
    }
    setLoadingRecords(false);
  }, [seqArchivio]);

  // I quattro riquadri sono indipendenti e leggono archivi pesanti: se uno non
  // risponde gli altri devono restare a video lo stesso. Prima bastava una
  // chiamata caduta per lasciare la pagina vuota senza dire perche'.
  // Matrice per provincia e alert non dipendono da nessun filtro.
  //
  // Gli alert si leggono anche da soli (revisione del 13/10/2026): li scrive
  // runAlertEngine, che il workflow lancia sullo stesso aggiornamento del
  // registro che chiude il caricamento, quindi alla chiusura il contatore
  // risponde con gli alert di prima. Si rileggono alla nota «moduli collegati
  // aggiornati», senza la matrice e senza l'archivio. Hanno la loro sequenza:
  // vale l'ultima lettura partita, che sia quella dei riquadri o quella della nota.
  const caricaAlert = useCallback(async () => {
    const mia = seqAlert.inizia();
    let dato = null, fallito = false;
    try {
      dato = (await base44.functions.invoke('getAlerts', { modulo: 'primarie_rete', solo_aperti: true })).data;
    } catch (e) {
      console.error(e);
      fallito = true;
    }
    if (!seqAlert.valida(mia)) return;
    // Un valore mancante non e' zero: senza risposta, o con una risposta senza
    // il conteggio, il contatore dice «—» e l'avviso sopra la pagina lo spiega.
    const totale = !fallito && Number.isFinite(dato?.total) ? dato.total : null;
    setAlertCount(totale);
    setNonCaricati(p => ({ ...p, alert: totale === null }));
  }, [seqAlert]);

  const caricaFissi = useCallback(async () => {
    const mia = seqFissi.inizia();
    setInCorso(p => ({ ...p, fissi: true }));
    const [provRes] = await Promise.allSettled([
      base44.functions.invoke('computeProvinceMatrix', {}),
      caricaAlert(),
    ]);
    if (!seqFissi.valida(mia)) return;
    setProvinceData(provRes.status === 'fulfilled' ? provRes.value.data : null);
    setNonCaricati(p => ({ ...p, province: provRes.status === 'rejected' }));
    if (provRes.status === 'rejected') console.error(provRes.reason);
    setInCorso(p => ({ ...p, fissi: false }));
  }, [seqFissi, caricaAlert]);

  // Il mix guarda regione, stato, mese e anno: la sua chiave cambia solo con
  // quelli, e con gli altri filtri non riparte.
  const chiaveMix = JSON.stringify({ regione: filters.regione, stato: filters.stato, mese: filters.mese, anno: filters.anno });
  const caricaMix = useCallback(async () => {
    const mia = seqMix.inizia();
    setInCorso(p => ({ ...p, mix: true }));
    let dato = null, fallito = false;
    try {
      dato = (await base44.functions.invoke('computeRaccoglitoriMix', { filters: JSON.parse(chiaveMix) })).data;
    } catch (e) {
      console.error(e);
      fallito = true;
    }
    if (!seqMix.valida(mia)) return;
    setMixData(dato);
    setNonCaricati(p => ({ ...p, mix: fallito }));
    setInCorso(p => ({ ...p, mix: false }));
  }, [chiaveMix, seqMix]);

  // I tempi si misurano su un anno: quello scelto nel filtro, se e' uno solo,
  // altrimenti l'anno in corso. Prima la scheda restava sempre sull'anno in
  // corso anche filtrando un altro anno, e non lo diceva.
  const annoSla = filters.anno.length === 1 ? filters.anno[0] : null;
  const caricaSla = useCallback(async () => {
    const mia = seqSla.inizia();
    setInCorso(p => ({ ...p, sla: true }));
    let dato = null, fallito = false;
    try {
      dato = (await base44.functions.invoke('computeSlaMetrics', annoSla ? { anno: annoSla } : {})).data;
    } catch (e) {
      console.error(e);
      fallito = true;
    }
    if (!seqSla.valida(mia)) return;
    setSlaData(dato);
    setNonCaricati(p => ({ ...p, sla: fallito }));
    setInCorso(p => ({ ...p, sla: false }));
  }, [annoSla, seqSla]);

  useEffect(() => { leggiArchivio(); }, [leggiArchivio]);
  useEffect(() => { caricaFissi(); }, [caricaFissi]);
  useEffect(() => { caricaMix(); }, [caricaMix]);
  useEffect(() => { caricaSla(); }, [caricaSla]);

  // Ogni caricamento delle primarie aggiorna la pagina, riquadri ed elenco: la
  // pagina restava quella di prima finche' qualcuno non la riapriva. Si ricarica
  // a caricamento concluso, mai mentre l'archivio si sta riscrivendo (in_corso).
  // L'iscrizione e' una sola per tutta la vita della pagina: prima si rifaceva a
  // ogni filtro, perche' dipendeva dalle funzioni che cambiavano coi filtri; ora
  // chiama sempre l'ultima versione dei caricatori.
  //
  // UNA RILETTURA PER CARICAMENTO (revisione del 13/10/2026). Ogni evento che non
  // fosse «in_corso» rileggeva tutto: un caricamento ne manda tre, la riga vecchia
  // chiusa in errore mentre quello nuovo si apre, la sua chiusura e la nota
  // «moduli collegati aggiornati» a ricalcoli finiti. Erano tre letture
  // dell'archivio e dodici funzioni, con l'archivio cambiato una volta sola. Ora
  // si rilegge una volta per riga del registro, quando passa a un esito che ha
  // riscritto l'archivio (src/lib/ascoltoCaricamenti.js).
  //
  // Alla nota «moduli collegati aggiornati» si rileggono solo gli alert, con una
  // funzione e nessuna pagina dell'archivio (revisione del 13/10/2026): alla
  // chiusura il motore degli alert stava ancora leggendo, e il contatore restava
  // quello di prima finche' non si riapriva la pagina (regola 2). Con la regola
  // di prima la terza rilettura, quella della nota, li prendeva.
  const ricaricaTutto = useRef(null);
  ricaricaTutto.current = () => { leggiArchivio(); caricaFissi(); caricaMix(); caricaSla(); };
  const ricaricaAlert = useRef(null);
  ricaricaAlert.current = caricaAlert;
  useEffect(() => {
    const leggi = creaAscoltoCaricamenti(CARICAMENTI_RETE);
    const unsub = base44.entities.UploadLog.subscribe((event) => {
      const e = leggi(event);
      if (e && e.concluso) ricaricaTutto.current();
      else if (e && e.moduli_aggiornati) ricaricaAlert.current();
    });
    return unsub;
  }, []);

  // Regione e stato si leggono sul record, giorno, mese e anno sul periodo
  // (giornoElenco). Separati, per contare i terminati senza fine trasporto
  // anche quando si guarda un mese: nessun filtro di periodo li prende.
  const { records, perDate } = useMemo(() => {
    const passaAltri = (r) => {
      if (filters.regione.length > 0 && !filters.regione.includes((r.regione || '').trim())) return false;
      if (filters.trasportatore.length > 0 && !filters.trasportatore.includes((r.trasportatore || '').trim())) return false;
      if (filters.destinazione.length > 0 && !filters.destinazione.includes((r.destinazione || '').trim())) return false;
      if (filters.stato.length > 0 && !filters.stato.includes((r.stato || '').trim())) return false;
      return true;
    };
    const passaPeriodo = (r) => {
      if (filters.mese.length > 0 && !filters.mese.includes(meseElenco(r))) return false;
      if (filters.anno.length > 0 && !filters.anno.map(String).includes(String(annoElenco(r)))) return false;
      if (filters.data && giornoElenco(r) !== filters.data) return false;
      return true;
    };
    return {
      records: allRecords.filter(r => passaAltri(r) && passaPeriodo(r)),
      perDate: allRecords.filter(r => passaAltri(r) && (passaPeriodo(r) || (eTerminato(r) && !giornoMovimento(r)))),
    };
  }, [allRecords, filters]);

  // Cercando un ID o un punto di raccolta si passa al dettaglio degli ordini.
  // L'ID si cerca in tutto l'archivio, senza gli altri filtri: e' un ordine
  // solo, e lo si vuole trovare comunque. Il punto di raccolta invece si cerca
  // dentro i filtri, come in Assegnati Rete: un PDR ha centinaia di ritiri in
  // piu' anni, e «i suoi ordini di settembre» e' la domanda vera. Perche' un
  // filtro dimenticato non faccia credere che non ce ne siano, il conteggio dice
  // anche quanti ne ha in tutto l'archivio.
  const idAttivo = !!cercaId.trim();
  const pdrAttivo = cercaPdrAttiva(cercaPdr);
  useEffect(() => { if (cercaId.trim() || cercaPdrAttiva(cercaPdr)) setScheda('dettaglio'); }, [cercaId, cercaPdr]);
  const perId = useMemo(() => (idAttivo ? allRecords.filter(r => corrispondeIdOrdine(r, cercaId)) : null), [idAttivo, allRecords, cercaId]);
  const ordiniMostrati = useMemo(() => {
    const base = perId || (soloDate ? perDate.filter(dateDaSistemare) : records);
    return pdrAttivo ? base.filter(r => corrispondePdr(r, cercaPdr)) : base;
  }, [perId, soloDate, perDate, records, pdrAttivo, cercaPdr]);
  const puntiTrovati = useMemo(() => (pdrAttivo ? puntiDiRaccolta(ordiniMostrati) : []), [pdrAttivo, ordiniMostrati]);
  const archivioLetto = !loadingRecords && allRecords.length > 0;
  const hasFilters = soloDate || Object.values(filters).some(v => Array.isArray(v) ? v.length > 0 : v);
  const pdrInArchivio = useMemo(() => (pdrAttivo && !idAttivo && hasFilters ? allRecords.filter(r => corrispondePdr(r, cercaPdr)).length : null),
    [pdrAttivo, idAttivo, hasFilters, allRecords, cercaPdr]);

  const regioni = useMemo(() => [...new Set(allRecords.map(r => (r.regione || '').trim()).filter(Boolean))].sort(), [allRecords]);
  const stati = useMemo(() => [...new Set(allRecords.map(r => (r.stato || '').trim()).filter(Boolean))].sort(), [allRecords]);
  // Il trasportatore e' il raccoglitore del formulario: filtrarci sopra e' il modo
  // di vedere il lavoro di uno solo (richiesta dell'utente, 29/09/2026).
  const trasportatori = useMemo(() => [...new Set(allRecords.map(r => (r.trasportatore || '').trim()).filter(Boolean))].sort(), [allRecords]);
  // L'impianto di destinazione e' dove il raccoglitore conferisce, e un raccoglitore
  // puo' conferire a piu' di uno (Emmesse va a Irigom e a Gatim): filtrarci sopra e'
  // il modo di vedere i conferimenti di un impianto solo (richiesta dell'utente,
  // 05/10/2026). Terminati ACI lo aveva gia', qui mancava.
  const destinazioni = useMemo(() => [...new Set(allRecords.map(r => (r.destinazione || '').trim()).filter(Boolean))].sort(), [allRecords]);
  const anni = useMemo(() => [...new Set(allRecords.map(annoElenco).filter(Boolean))].sort((a, b) => b - a), [allRecords]);

  // Il Reset rimette OGNI filtro, elencati tutti: lasciandone fuori uno la chiave
  // sparisce dall'oggetto e passaAltri leggeva .length di undefined, cosi' l'elenco
  // restava quello di prima senza dire niente. Era il caso di trasportatore, aggiunto
  // ai filtri ma non al Reset (trovato il 05/10/2026 aggiungendo la destinazione).
  const resetFilters = () => { setFilters(FILTRI_VUOTI); setSoloDate(false); };
  const vediDate = (v) => { setSoloDate(v); if (v) setScheda('dettaglio'); };

  const elencoNonCaricati = Object.keys(NOMI_NON_CARICATI).filter(k => nonCaricati[k]).map(k => NOMI_NON_CARICATI[k]);
  // Riprova solo chi non ha risposto: gli altri sono gia' aggiornati.
  const riprova = () => {
    if (nonCaricati.archivio) leggiArchivio();
    if (nonCaricati.province) caricaFissi();
    else if (nonCaricati.alert) caricaAlert();
    if (nonCaricati.mix) caricaMix();
    if (nonCaricati.sla) caricaSla();
  };

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
          {/* Gli alert non letti: «—», mai 0 e mai niente (13/10/2026). Porta alla
              pagina degli alert, dove si possono guardare lo stesso. */}
          {alertCount === null && (
            <Link to="/alert-engine" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-muted text-muted-foreground hover:bg-muted/70">
              <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" /> Alert aperti: — <span className="font-normal">(non letti)</span>
            </Link>
          )}
          <Link to="/caricamento-dati" className="inline-flex items-center gap-2 px-3 py-2 text-sm btn-secondario">
            <Upload className="w-4 h-4" /> Carica dati
          </Link>
        </div>
      </div>

      {elencoNonCaricati.length > 0 && (
        <div className="border border-amber-300 bg-amber-50 text-amber-900 rounded-lg px-3 py-2 text-sm flex flex-wrap items-center gap-2">
          <span>Non {elencoNonCaricati.length === 1 ? 'si è caricato' : 'si sono caricati'} {elencoNonCaricati.join(', ')}. Il resto della pagina è aggiornato.</span>
          <button type="button" onClick={riprova} className="text-primary hover:underline font-medium">Riprova</button>
        </div>
      )}

      {/* Gli ordini "eseguito" a portale: tutti i dati, ma nessuno ha premuto
          Chiudi. Il gestionale conta solo i terminati, quindi spariscono in
          silenzio da raccolto, giacenze, report, copertura del target e
          fatturazione. Si contano a parte, non si sommano ai terminati e non
          cambiano nessun conto. Si guarda tutto l'archivio di rete, non i
          filtri: sono ordini che nessun filtro di periodo prende per forza. */}
      {!loadingRecords && <AvvisoEseguiti righe={allRecords} canale="Rete" />}

      {/* Le due ricerche, una accanto all'altra (una sopra l'altra sul telefono):
          per ID ordine e per punto di raccolta (richiesta dell'utente del
          12/10/2026, «nei terminati rete serve un campo ricerca per pdr»). */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:gap-6">
        <CercaIdOrdine value={cercaId} onChange={setCercaId} trovati={archivioLetto && perId ? perId.length : null} />
        <CercaPdr value={cercaPdr} onChange={setCercaPdr} trovati={archivioLetto ? ordiniMostrati.length : null} inArchivio={pdrInArchivio}
          conFiltri={hasFilters} conIdOrdine={idAttivo} punti={puntiTrovati} />
      </div>

      {/* Filtri rapidi per dettaglio ordini */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm font-medium inline-flex items-center gap-1.5"><Filter className="w-4 h-4" /> Filtri ordini</span>
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer text-muted-foreground hover:text-foreground" title="Solo i terminati a cui manca l'immissione, l'inizio o la fine del trasporto, o con le date nell'ordine sbagliato">
              <input type="checkbox" checked={soloDate} onChange={e => vediDate(e.target.checked)} /> Solo date da sistemare
            </label>
          </div>
          {hasFilters && (
            <button onClick={resetFilters} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <X className="w-3 h-3" /> Reset
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-7 gap-2">
          <MultiSelect allLabel="Tutte le regioni" breve="Regioni" options={regioni} selected={filters.regione} onChange={v => setFilters(p => ({ ...p, regione: v }))} />
          <MultiSelect allLabel="Tutti gli stati" breve="Stati" options={stati} selected={filters.stato} onChange={v => setFilters(p => ({ ...p, stato: v }))} />
          <MultiSelect allLabel="Tutti i trasportatori" breve="Trasportatori" options={trasportatori} selected={filters.trasportatore} onChange={v => setFilters(p => ({ ...p, trasportatore: v }))} />
          <MultiSelect allLabel="Tutte le destinazioni" breve="Destinazioni" options={destinazioni} selected={filters.destinazione} onChange={v => setFilters(p => ({ ...p, destinazione: v }))} />
          <MultiSelect allLabel="Tutti i mesi" breve="Mesi" options={MESI} selected={filters.mese} onChange={v => setFilters(p => ({ ...p, mese: v }))} />
          <MultiSelect allLabel="Tutti gli anni" breve="Anni" options={anni.map(String)} selected={filters.anno.map(String)} onChange={v => setFilters(p => ({ ...p, anno: v.map(Number) }))} />
          <input type="date" value={filters.data} onChange={e => setFilters(p => ({ ...p, data: e.target.value }))} className="border rounded-md px-3 py-2 text-sm" title="Giorno di fine trasporto (per gli ordini non terminati, giorno di immissione)" aria-label="Giorno di fine trasporto" />
        </div>
        {!loadingRecords && (
          <AvvisoDateDaSistemare
            righe={perDate}
            canale="Rete"
            nota="Chi non ha la fine trasporto non ha giorno, mese e anno e resta fuori anche dai tempi di raccolta; ne restano fuori pure chi non ha l'immissione e chi ha le date incoerenti."
            attivo={soloDate}
            onFiltra={vediDate}
          />
        )}
      </div>

      <Tabs value={scheda} onValueChange={setScheda}>
        <TabsList>
          <TabsTrigger value="dettaglio"><Table2 className="w-4 h-4 mr-1.5" /> Dettaglio Ordini ({ordiniMostrati.length} righe)</TabsTrigger>
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
          {inCorso.fissi ? <InAttesa cosa="Calcolo della matrice per provincia..." /> : <ProvinceMatrix data={provinceData} />}
        </TabsContent>

        <TabsContent value="mix" className="mt-4">
          <div className="mb-3 text-sm text-muted-foreground">
            Scostamento del mix classi PFU per ciascun raccoglitore rispetto ai target consorziali.
            Target: P=75%, M=20%, G1=4%, G2=1%. Soglia deviazione: ±5%.
          </div>
          {inCorso.mix ? <InAttesa cosa="Calcolo del mix per i filtri scelti..." /> : <RaccoglitoriMix data={mixData} />}
        </TabsContent>

        <TabsContent value="sla" className="mt-4">
          <div className="mb-3 text-sm text-muted-foreground">
            Tempi di raccolta per trasportatore, dall'immissione dell'ordine alla fine del trasporto. Alert critico se Nr Giorni medio {'>'} 12 o % fuori tempo {'>'} 20%.
          </div>
          {inCorso.sla ? <InAttesa cosa="Calcolo dei tempi di raccolta..." /> : <SlaMetrics data={slaData} anniFiltro={filters.anno} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
