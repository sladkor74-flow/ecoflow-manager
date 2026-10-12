import React, { useState, useEffect, useMemo, useRef } from 'react';
import { anniDaScegliere } from '@/lib/periodoPagine';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Pencil, Trash2, Copy, FileSpreadsheet, FileText, AlertTriangle } from 'lucide-react';
import { usePermessi } from '@/lib/permessi';
import { BannerSolaLettura } from '@/components/shared/SolaLettura';
import { MESI } from '@/lib/pfuConstants';
import { calcExtraRaccolta, contestoPrezzi, avvisoPesoMancante } from '@/lib/extraRaccoltaCalc';
import { formatNumber, formatTonnellate, formatKg } from '@/lib/utils';
import { exportExtraRaccoltaExcel, exportExtraRaccoltaPDF } from '@/lib/extraRaccoltaExport';
import ExtraRaccoltaForm from '@/components/fatturazione/ExtraRaccoltaForm';
import { STATI_EXTRA, statoExtra, eTerminato, datiChiusuraCompleti, dateDaCorreggere, competenza } from '@/lib/extraRaccoltaStato';
import { giornoRoma, oggiRoma } from '@/lib/giornoItaliano';
import { giornoMovimento, giornoElenco, dateDaSistemare, testoDate, MESI_MOVIMENTI } from '@/lib/movimenti';
import { dopoCaricamento, testoRicalcoli } from '@/lib/importGrandeFile';
import AvvisoDateDaSistemare, { SegnoDate, NotaDate } from '@/components/primarie-rete/DateDaSistemare';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ReportConferimenti from '@/components/report-conferimenti/ReportConferimenti';
import { useToast } from '@/components/ui/use-toast';
import { scriviConTraccia, eliminaConTraccia, avvisoTraccia } from '@/lib/scriviConTraccia';

const ANNI = anniDaScegliere();

// Dove si colloca una scheda, come in tutto il gestionale: un terminato sul giorno
// italiano della fine trasporto, e se non ce l'ha non si colloca (niente ripiego
// sulla richiesta); una richiesta ancora aperta, che non e' un movimento, sulla
// data della richiesta. E' giornoElenco (src/lib/movimenti.js), la regola di
// tutti gli elenchi. Mese e anno salvati sulla scheda non decidono: possono
// venire da una scrittura vecchia.
const giornoIt = (v) => { const g = giornoRoma(v); return g ? `${g.slice(8, 10)}/${g.slice(5, 7)}/${g.slice(0, 4)}` : ''; };
// Immissione (la data della richiesta), inizio e fine trasporto sono obbligatorie
// in ogni formulario terminato (regola dell'utente, 22/09/2026). Un intervento
// terminato a cui ne manca una, o con le date nell'ordine sbagliato, ha il segno
// sulla riga e si conta nell'avviso; il filtro Date lo mostra, anche senza un
// mese: chi non ha la fine trasporto non ne ha uno. La validazione sul
// salvataggio sta nel modulo di inserimento (ExtraRaccoltaForm): qui l'elenco.
const eSecondaria = (r) => String((r && r.tipo_movimento) || 'primaria').toLowerCase().trim() === 'secondaria';

// Le schede si salvano una dopo l'altra, e ogni salvataggio lanciava tutti i
// ricalcoli: con piu' schede di fila partivano giri sovrapposti, e sotto il
// titolo restava l'esito di quello finito per ultimo, non per forza dell'ultimo
// salvataggio. Ora le modifiche si accumulano (con i loro giorni di fine
// trasporto) e i ricalcoli partono una volta sola, qualche secondo dopo l'ultima;
// se ne arrivano mentre un giro e' in corso, se ne fa un altro alla fine, e si
// mostra solo l'esito del giro che le comprende tutte.
const ATTESA_RICALCOLI_MS = 4000;
const nuovaCoda = () => ({ giorni: new Set(), pendente: false, timer: null, inCorso: false, mostra: null });
function avviaRicalcoli(c) {
  c.timer = null;
  if (c.inCorso || !c.pendente) return;
  const giorni = [...c.giorni];
  c.giorni = new Set();
  c.pendente = false;
  c.inCorso = true;
  const fine = (esiti) => {
    c.inCorso = false;
    // modifiche arrivate durante il giro: se il loro timer e' gia' scaduto si riparte subito
    if (c.pendente) { if (!c.timer) avviaRicalcoli(c); return; }
    if (c.mostra) c.mostra(esiti);
  };
  dopoCaricamento('extra_raccolta', { giorni })
    .then(fine, (e) => fine([{ nome: 'moduli collegati', ok: false, errore: e && e.message ? e.message : String(e) }]));
}

export default function ExtraRaccolta() {
  const { isAdmin } = usePermessi();
  const { toast } = useToast();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ anno: '', mese: '', stato: '', trasportatore: '', destinazione: '', tipologia_trasporto: '', date: '' });
  const [sistemando, setSistemando] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formInitial, setFormInitial] = useState(null);
  const [ricalcoli, setRicalcoli] = useState(null);
  // Le tariffe attive dell'extra raccolta e i fornitori che cambiano la dicitura:
  // il prezzo di un intervento senza prezzo scritto si sceglie con quelle, come
  // in fattura (chiusura dell'audit, 11/10/2026). Si leggono una volta: sono
  // poche righe, e la scheda le riceve da qui invece di rileggerle.
  const [tariffeAttive, setTariffeAttive] = useState([]);
  const [fornitoriDicitura, setFornitoriDicitura] = useState([]);
  const [tariffeNonLette, setTariffeNonLette] = useState(false);
  const coda = useRef(null);
  if (!coda.current) coda.current = nuovaCoda();

  // Uscendo dalla pagina un ricalcolo in attesa parte subito, invece di perdersi.
  useEffect(() => {
    const c = coda.current;
    c.mostra = setRicalcoli;
    return () => {
      c.mostra = null;
      if (c.timer) { clearTimeout(c.timer); avviaRicalcoli(c); }
    };
  }, []);

  // Chiudendo la scheda del browser, invece, i ricalcoli non ancora partiti si
  // perderebbero: finche' ce ne sono, lo si chiede.
  const ricalcoliInCorso = !!(ricalcoli && ricalcoli.in_corso);
  useEffect(() => {
    if (!ricalcoliInCorso) return undefined;
    const avviso = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', avviso);
    return () => window.removeEventListener('beforeunload', avviso);
  }, [ricalcoliInCorso]);

  // Una scheda di extra raccolta e' un movimento come quelli dei file del portale:
  // scriverla, correggerla o cancellarla cambia le dichiarazioni di nessuna
  // movimentazione, le verifiche dei report e le quadrature FIR della sua
  // settimana, la qualifica. Si ricalcola come dopo un caricamento (elenco unico
  // in dopoCaricamento), sui giorni italiani di fine trasporto di prima e di dopo.
  const aggiornaModuli = (record) => {
    const c = coda.current;
    for (const r of record) { const g = giornoMovimento(r); if (g) c.giorni.add(g); }
    c.pendente = true;
    setRicalcoli({ in_corso: true });
    clearTimeout(c.timer);
    c.timer = setTimeout(() => avviaRicalcoli(c), ATTESA_RICALCOLI_MS);
  };

  const load = async () => {
    setLoading(true);
    try {
      const all = await base44.entities.ExtraRaccolta.list('-created_date', 5000);
      setRecords(all);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      // Senza le tariffe la pagina sa solo il prezzo scritto e la base
      // dell'anno, e senza i fornitori non sa la dicitura: lo dice, invece di
      // mostrare un ricavo che la fattura potrebbe non avere. Le due letture
      // sono separate, perche' una che non risponde non si porti via l'altra.
      try {
        // Tutte le EXTRA_RACCOLTA attive, anche non_attivo con una data di fine:
        // la fattura le considera (tariffeAttiveValide), e un filtro sullo stato
        // qui farebbe scegliere un altro prezzo.
        const t = await base44.entities.Tariffa.filter({ direzione: 'ATTIVA', tipologia: 'EXTRA_RACCOLTA' }, '-created_date', 500);
        if (vivo) setTariffeAttive(t || []);
      } catch {
        if (vivo) setTariffeNonLette(true);
      }
      try {
        const f = await base44.entities.Fornitore.filter({ trattamento_fatturato_da_ecotyre: true }, 'ragione_sociale', 500);
        if (vivo) setFornitoriDicitura(f || []);
      } catch {
        if (vivo) setTariffeNonLette(true);
      }
    })();
    return () => { vivo = false; };
  }, []);
  const contesto = useMemo(() => contestoPrezzi(tariffeAttive, fornitoriDicitura), [tariffeAttive, fornitoriDicitura]);

  // I filtri si dividono in due, come negli altri elenchi: quelli di periodo
  // leggono giornoElenco, gli altri la scheda. Separati, per contare le date da
  // sistemare anche di chi un periodo non l'ha (un terminato senza fine trasporto).
  const passaAltri = (r) => {
    if (filters.stato && statoExtra(r) !== (filters.stato === 'senza' ? '' : filters.stato)) return false;
    if (filters.trasportatore && r.trasportatore !== filters.trasportatore) return false;
    if (filters.destinazione && r.destinazione !== filters.destinazione) return false;
    if (filters.tipologia_trasporto && r.tipologia_trasporto !== filters.tipologia_trasporto) return false;
    if (filters.date === 'da_sistemare' && !dateDaSistemare(r)) return false;
    return true;
  };
  const passaPeriodo = (r) => {
    if (!filters.anno && !filters.mese) return true;
    const g = giornoElenco(r);
    if (!g) return false;
    if (filters.anno && Number(g.slice(0, 4)) !== Number(filters.anno)) return false;
    if (filters.mese && MESI_MOVIMENTI[Number(g.slice(5, 7)) - 1] !== filters.mese) return false;
    return true;
  };
  const senzaPeriodo = (r) => eTerminato(r) && !giornoMovimento(r);

  // Con il filtro Date un terminato senza fine trasporto resta anche con un anno
  // o un mese scelto: e' proprio quello da correggere. passaAltri e passaPeriodo
  // leggono solo filters, che e' fra le dipendenze.
  const filtered = useMemo(() => {
    return records.filter(r => passaAltri(r) && (passaPeriodo(r) || (filters.date === 'da_sistemare' && senzaPeriodo(r)))).sort((a, b) => {
      // Prima le richieste da evadere, poi le altre dalla piu' recente.
      const aperta = (r) => Number(statoExtra(r) === 'assegnato');
      return (aperta(b) - aperta(a)) || giornoElenco(b).localeCompare(giornoElenco(a));
    });
  }, [records, filters]);
  // Le schede da guardare per le date da sistemare: quelle dell'elenco e i
  // terminati senza fine trasporto che rispondono agli altri filtri.
  const perDate = useMemo(() => records.filter(r => passaAltri(r) && (passaPeriodo(r) || senzaPeriodo(r))), [records, filters]);

  // Solo i terminati entrano nei totali e nelle esportazioni, come in fatturazione,
  // e solo con la fine trasporto: senza, non hanno un mese e fuori da qui non
  // contano da nessuna parte. Non si ripiega sulla richiesta: si contano e si dicono.
  const terminati = useMemo(() => filtered.filter(r => eTerminato(r) && giornoMovimento(r)), [filtered]);
  const senzaStato = useMemo(() => records.filter(r => !statoExtra(r)), [records]);
  const daSegnare = senzaStato.filter(datiChiusuraCompleti);

  // Le tonnellate sono la raccolta dal produttore, sul peso effettivo, come nella
  // dashboard: un trasferimento in secondaria porta lo stesso peso una seconda
  // volta, e sommarlo dava due numeri diversi per la stessa extra raccolta. Ricavi
  // e costi restano tutti: il trasferimento si paga.
  const kpi = useMemo(() => {
    let kg = 0, ricavi = 0, costi = 0, margine = 0;
    for (const r of terminati) {
      const c = calcExtraRaccolta(r, contesto);
      if (!eSecondaria(r)) kg += Number(r.peso_effettivo) || 0;
      ricavi += c.ricavo;
      costi += c.costo_totale;
      margine += c.margine;
    }
    const margine_perc = ricavi !== 0 ? (margine / ricavi * 100) : 0;
    return { tonnellate: kg / 1000, ricavi, costi, margine, margine_perc };
  }, [terminati, contesto]);

  // QUELLO CHE LA FATTURA SEGNALA, LA PAGINA LO DICE UGUALE (11/10/2026).
  // Un terminato senza peso effettivo non si fattura e non si valuta: prima qui
  // si prendeva la quantita' ritirata al suo posto. E un intervento senza prezzo
  // scritto che prende il prezzo di una tariffa di un altro anno, rimasta aperta,
  // in fattura esce con l'avviso «prezzo di un altro anno»: qui lo stesso.
  const senzaPeso = useMemo(() => terminati.filter(r => calcExtraRaccolta(r, contesto).senza_peso), [terminati, contesto]);
  const prezzoAltroAnno = useMemo(() => terminati.filter(r => { const c = calcExtraRaccolta(r, contesto); return c.fatturato && c.prezzo.altro_anno; }), [terminati, contesto]);

  const trasportatori = useMemo(() => [...new Set(records.map(r => r.trasportatore).filter(Boolean))].sort(), [records]);
  const destinatari = useMemo(() => [...new Set(records.map(r => r.destinazione).filter(Boolean))].sort(), [records]);
  const tipologie = useMemo(() => [...new Set(records.map(r => r.tipologia_trasporto).filter(Boolean))].sort(), [records]);

  // I costi e i prezzi scritti sull'intervento finiscono nello storico delle
  // modifiche (11/10/2026), che si apre nella scheda; se il dato e' salvato ma
  // la traccia no, lo si dice.
  const save = async (payload) => {
    try {
      const esito = formInitial?.id
        ? await scriviConTraccia('ExtraRaccolta', formInitial.id, payload, { origine: 'Extra Raccolta' })
        : await scriviConTraccia('ExtraRaccolta', null, payload, { origine: 'Extra Raccolta' });
      const avviso = avvisoTraccia(esito);
      if (avviso) toast(avviso);
      aggiornaModuli([formInitial, payload]);
      setFormOpen(false);
      setFormInitial(null);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const remove = async (r) => {
    if (!confirm('Eliminare questo intervento?')) return;
    const esito = await eliminaConTraccia('ExtraRaccolta', r.id, { origine: 'Extra Raccolta' });
    const avviso = avvisoTraccia(esito);
    if (avviso) toast(avviso);
    aggiornaModuli([r]);
    load();
  };

  const duplicate = (r) => {
    const { id, id_ordine, numero_fir, trasporto_iniziato_il, trasporto_finito_il, created_date, updated_date, created_by_id, ...rest } = r;
    setFormInitial({ ...rest, stato: 'assegnato', numero_fir: '', trasporto_iniziato_il: null, trasporto_finito_il: null });
    setFormOpen(true);
  };

  // Le schede inserite prima dello stato: quelle con FIR, peso e le tre date
  // si segnano terminate, riportando le date al giorno di calendario giusto.
  const segnaTerminati = async () => {
    if (!confirm(`Segnare come terminati ${daSegnare.length} interventi con FIR, peso e date di immissione, inizio e fine trasporto? Da quel momento entrano in fatturazione, giacenze, report e verifiche nel mese della loro fine trasporto.`)) return;
    setSistemando(true);
    const toccati = [];
    try {
      for (const r of daSegnare) {
        const date = dateDaCorreggere(r);
        // mese e anno scritti sulla scheda: quelli del giorno italiano della fine
        // trasporto, come li legge il resto del gestionale
        const fine = giornoRoma(date.trasporto_finito_il || r.trasporto_finito_il);
        await scriviConTraccia('ExtraRaccolta', r.id, { stato: 'terminato', ...date, ...competenza(fine) }, { origine: 'Extra Raccolta' });
        toccati.push(r, { trasporto_finito_il: date.trasporto_finito_il });
      }
    } catch (e) {
      alert(e.message);
    }
    setSistemando(false);
    if (toccati.length) aggiornaModuli(toccati);
    load();
  };

  // Senza un anno scelto, quello di oggi in Italia. I file ricevono le tariffe
  // che la pagina ha letto (contesto): senza, conoscevano solo il prezzo scritto
  // e la base dell'anno, e con la tabella a un altro valore dicevano un prezzo
  // diverso da pagina e fattura (chiusura dell'audit, 11/10/2026).
  const exportExcel = async () => {
    const mese = filters.mese || 'Tutti';
    const anno = filters.anno || Number(oggiRoma().slice(0, 4));
    await exportExtraRaccoltaExcel(terminati, mese, anno, contesto);
  };

  const exportPDF = async () => {
    const mese = filters.mese || 'Tutti';
    const anno = filters.anno || Number(oggiRoma().slice(0, 4));
    await exportExtraRaccoltaPDF(terminati, mese, anno, contesto);
  };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold">Extra Raccolta</h1>
          <p className="text-muted-foreground mt-1">Richieste e interventi di extra raccolta: si inseriscono come assegnati e si chiudono come terminati con FIR, fine trasporto e peso. Solo i terminati vanno in fatturazione.</p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setFormInitial(null); setFormOpen(true); }}>
            <Plus className="w-4 h-4 mr-1.5" /> Aggiungi intervento
          </Button>
        )}
      </div>

      <BannerSolaLettura cosa="gli interventi di extra raccolta" />

      {(() => {
        const r = testoRicalcoli(ricalcoli);
        return r ? <p className={`text-xs ${r.classe}`}>{r.testo}</p> : null;
      })()}

      {!loading && (
        <AvvisoDateDaSistemare
          righe={perDate}
          canale="Extra Raccolta"
          nomi={['intervento terminato', 'interventi terminati']}
          nota="Chi non ha la fine trasporto non ha un mese e resta escluso da totali, esportazioni, fatturazione, giacenze, report e verifiche."
          correzione={isAdmin ? 'Aprili e correggi le date.' : "Le corregge l'amministratore, aprendo l'intervento."}
          attivo={filters.date === 'da_sistemare'}
          onFiltra={(v) => setFilters({ ...filters, date: v ? 'da_sistemare' : '' })}
        />
      )}

      {senzaPeso.length > 0 && (
        <div className="flex items-start gap-3 border border-amber-300 bg-amber-50 text-amber-900 rounded-lg px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1 space-y-1">
            <p>
              <strong>{senzaPeso.length} {senzaPeso.length === 1 ? 'intervento terminato è' : 'interventi terminati sono'} senza peso effettivo</strong>:
              {senzaPeso.length === 1 ? ' non entra' : ' non entrano'} nella fattura a Ecotyre e i costi a tonnellata valgono zero, come in fattura e in passiva, finché il peso non si scrive sull&apos;intervento. La quantità ritirata non lo sostituisce.
            </p>
            <ul className="text-xs list-disc pl-4">
              {senzaPeso.slice(0, 5).map(r => <li key={r.id}>{avvisoPesoMancante(r)}</li>)}
              {senzaPeso.length > 5 && <li>e altri {senzaPeso.length - 5}.</li>}
            </ul>
          </div>
        </div>
      )}

      {prezzoAltroAnno.length > 0 && (
        <div className="flex items-start gap-3 border border-amber-300 bg-amber-50 text-amber-900 rounded-lg px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <p>
            <strong>{prezzoAltroAnno.length} {prezzoAltroAnno.length === 1 ? 'intervento senza prezzo scritto prende' : 'interventi senza prezzo scritto prendono'} il prezzo di un altro anno</strong>,
            da una tariffa di extra raccolta rimasta aperta: in fattura {prezzoAltroAnno.length === 1 ? 'esce' : 'escono'} con lo stesso avviso. Scrivi sull&apos;intervento il prezzo concordato per la campagna.
          </p>
        </div>
      )}

      {tariffeNonLette && (
        <p className="text-xs text-amber-700">Le tariffe attive dell&apos;extra raccolta o i fornitori non si sono potuti leggere: i ricavi degli interventi senza prezzo scritto usano solo la base dell&apos;anno, e possono non essere quelli della fattura. Ricarica la pagina.</p>
      )}

      {senzaStato.length > 0 && (
        <div className="flex items-start gap-3 border border-amber-300 bg-amber-50 text-amber-900 rounded-lg px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1 space-y-1">
            <p>
              <strong>{senzaStato.length} {senzaStato.length === 1 ? 'intervento è stato salvato' : 'interventi sono stati salvati'} senza stato</strong> e
              {senzaStato.length === 1 ? ' non viene conteggiato' : ' non vengono conteggiati'} in fatturazione, giacenze, report e verifiche.
            </p>
            {daSegnare.length > 0 && <p>{daSegnare.length} {daSegnare.length === 1 ? 'ha' : 'hanno'} FIR, peso e le tre date (immissione, inizio e fine trasporto): si possono segnare come terminati.</p>}
            {senzaStato.length > daSegnare.length && <p>{senzaStato.length - daSegnare.length} {senzaStato.length - daSegnare.length === 1 ? 'è incompleto' : 'sono incompleti'} (manca il FIR, il peso o una delle tre date, o le date non tornano): aprili con il filtro Stato «Senza stato», completali e scegli lo stato.</p>}
          </div>
          {isAdmin && daSegnare.length > 0 && (
            <Button size="sm" onClick={segnaTerminati} disabled={sistemando}>
              {sistemando && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}Segna {daSegnare.length} come terminati
            </Button>
          )}
        </div>
      )}

      {/* Filtri */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 p-4 border rounded-lg bg-muted/30">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Anno</label>
          <Select value={filters.anno ? String(filters.anno) : 'all'} onValueChange={v => setFilters({ ...filters, anno: v === 'all' ? '' : Number(v) })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti</SelectItem>
              {ANNI.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Mese</label>
          <Select value={filters.mese || 'all'} onValueChange={v => setFilters({ ...filters, mese: v === 'all' ? '' : v })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti</SelectItem>
              {MESI.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Stato</label>
          <Select value={filters.stato || 'all'} onValueChange={v => setFilters({ ...filters, stato: v === 'all' ? '' : v })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti</SelectItem>
              <SelectItem value="assegnato">Assegnati</SelectItem>
              <SelectItem value="terminato">Terminati</SelectItem>
              <SelectItem value="senza">Senza stato</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Trasportatore</label>
          <Select value={filters.trasportatore || 'all'} onValueChange={v => setFilters({ ...filters, trasportatore: v === 'all' ? '' : v })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti</SelectItem>
              {trasportatori.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Destinatario</label>
          <Select value={filters.destinazione || 'all'} onValueChange={v => setFilters({ ...filters, destinazione: v === 'all' ? '' : v })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti</SelectItem>
              {destinatari.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Tipologia trasporto</label>
          <Select value={filters.tipologia_trasporto || 'all'} onValueChange={v => setFilters({ ...filters, tipologia_trasporto: v === 'all' ? '' : v })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte</SelectItem>
              {tipologie.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Date</label>
          <Select value={filters.date || 'all'} onValueChange={v => setFilters({ ...filters, date: v === 'all' ? '' : v })}>
            <SelectTrigger className="h-9" title="Da sistemare: i terminati a cui manca l'immissione, l'inizio o la fine del trasporto, o con le date nell'ordine sbagliato"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte</SelectItem>
              <SelectItem value="da_sistemare">Da sistemare</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="border rounded-lg p-3 bg-card">
          <div className="text-xs text-muted-foreground">Tonnellate raccolte (senza le secondarie)</div>
          <div className="text-lg font-bold tabular-nums">{formatTonnellate(kpi.tonnellate)} t</div>
        </div>
        <div className="border rounded-lg p-3 bg-card">
          <div className="text-xs text-muted-foreground">Ricavi</div>
          <div className="text-lg font-bold tabular-nums">€ {formatNumber(kpi.ricavi, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div className="border rounded-lg p-3 bg-card">
          <div className="text-xs text-muted-foreground">Costi</div>
          <div className="text-lg font-bold tabular-nums">€ {formatNumber(kpi.costi, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div className="border rounded-lg p-3 bg-card">
          <div className="text-xs text-muted-foreground">Margine</div>
          <div className={`text-lg font-bold tabular-nums ${kpi.margine >= 0 ? 'text-success' : 'text-destructive'}`}>
            € {formatNumber(kpi.margine, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="text-xs font-normal ml-1">({formatNumber(kpi.margine_perc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%)</span>
          </div>
        </div>
      </div>

      {/* Export. Accanto ai pulsanti, quanti degli interventi che vanno nel file
          hanno le date da sistemare (regola del 22/09/2026): i terminati senza
          fine trasporto nel file non ci sono, gli altri si', e chi manda la
          fatturazione deve saperlo prima. */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={exportExcel} disabled={terminati.length === 0}>
          <FileSpreadsheet className="w-4 h-4 mr-1.5" /> Esporta Excel
        </Button>
        <Button variant="outline" size="sm" onClick={exportPDF} disabled={terminati.length === 0}>
          <FileText className="w-4 h-4 mr-1.5" /> Esporta PDF
        </Button>
        <span className="self-center text-xs text-muted-foreground">Totali ed esportazioni comprendono solo i terminati.</span>
        <NotaDate righe={terminati} nomi={['intervento esportato', 'interventi esportati']} className="self-center" />
      </div>

      {/* Tabella */}
      {loading ? (
        <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          Nessun intervento trovato. Clicca "Aggiungi intervento" per inserire una richiesta o un intervento.
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Stato</th>
                <th className="text-left px-3 py-2 font-semibold">Nr. FIR</th>
                <th className="text-left px-3 py-2 font-semibold">Data fine trasporto</th>
                <th className="text-left px-3 py-2 font-semibold">Produttore o stoccaggio</th>
                <th className="text-left px-3 py-2 font-semibold">Trasportatore</th>
                <th className="text-left px-3 py-2 font-semibold">Destinatario</th>
                <th className="text-left px-3 py-2 font-semibold">Tipologia</th>
                <th className="text-left px-3 py-2 font-semibold">Classe</th>
                <th className="text-right px-3 py-2 font-semibold">Quantità (kg)</th>
                <th className="text-right px-3 py-2 font-semibold">Ricavo</th>
                <th className="text-right px-3 py-2 font-semibold">Costo totale</th>
                <th className="text-right px-3 py-2 font-semibold">Margine</th>
                <th className="text-center px-3 py-2 font-semibold">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const c = calcExtraRaccolta(r, contesto);
                const stato = statoExtra(r);
                const conta = stato === 'terminato';
                const euro = (v) => (conta ? `€ ${formatNumber(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—');
                // Il ricavo che la fattura non ha non si scrive come un incasso:
                // una secondaria non si fattura, un terminato senza peso nemmeno.
                const perche = eSecondaria(r) ? 'Una secondaria non si fattura a Ecotyre: il ricavo sta sulla raccolta.' : avvisoPesoMancante(r);
                const date = testoDate(r);
                return (
                  <tr key={r.id} className={`border-t hover:bg-muted/20 ${date ? 'bg-amber-50/60' : ''}`}>
                    <td className="px-3 py-2"><span className={`inline-block px-1.5 py-0.5 rounded border text-[11px] font-medium whitespace-nowrap ${STATI_EXTRA[stato].classe}`}>{STATI_EXTRA[stato].etichetta}</span></td>
                    <td className="px-3 py-2 font-mono text-xs">{r.numero_fir || '-'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {/* il segno delle date da sistemare, col dettaglio nel title */}
                      <SegnoDate testo={date} />
                      {giornoMovimento(r)
                        ? giornoIt(r.trasporto_finito_il)
                        : conta
                          ? <span className="text-amber-700 font-medium" title={date}>manca</span>
                          : r.ordine_immesso_il ? <span className="text-muted-foreground">richiesta il {giornoIt(r.ordine_immesso_il)}</span> : '-'}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {r.tipo_movimento === 'secondaria' && <span className="inline-block mr-1 px-1.5 py-0.5 rounded bg-accent/15 text-[10px] font-medium uppercase tracking-wide">Secondaria</span>}
                      {(r.tipo_movimento === 'secondaria' ? r.stoccaggio : r.produttore) || '-'}
                    </td>
                    <td className="px-3 py-2 text-xs">{r.trasportatore || '-'}</td>
                    <td className="px-3 py-2 text-xs">{r.destinazione || '-'}</td>
                    <td className="px-3 py-2 text-xs">{r.tipologia_trasporto || '-'}</td>
                    <td className="px-3 py-2">{r.classe || '-'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {!c.senza_peso ? formatKg(c.kg)
                        : conta ? <span className="text-amber-700 font-medium" title={avvisoPesoMancante(r)}>manca</span> : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {conta && !c.fatturato
                        ? <span className="text-muted-foreground" title={perche}>—</span>
                        : <>
                          {conta && c.prezzo.altro_anno && <span className="text-amber-700 font-medium mr-1" title={c.prezzo.nota}>!</span>}
                          {euro(c.ricavo)}
                        </>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{euro(c.costo_totale)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums font-medium ${!conta ? 'text-muted-foreground' : c.margine >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {euro(c.margine)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 justify-center">
                        {isAdmin ? (<>
                          <button onClick={() => { setFormInitial(r); setFormOpen(true); }} className="p-1 hover:bg-muted rounded" title="Modifica"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => duplicate(r)} className="p-1 hover:bg-muted rounded" title="Duplica"><Copy className="w-3.5 h-3.5" /></button>
                          <button onClick={() => remove(r)} className="p-1 hover:bg-red-50 rounded" title="Elimina"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                        </>) : <span className="text-muted-foreground">—</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* I conferimenti di extra raccolta del mese, ripartiti sulle settimane che
          lo coprono (richiesta dell'utente, 29/09/2026). Stesso motore delle
          secondarie; qui primarie e secondarie stanno nello stesso archivio e si
          distinguono dal tipo di movimento, quindi sono due schede. */}
      <div className="bg-card border rounded-lg p-3 space-y-3">
        <div>
          <h2 className="text-lg font-heading font-semibold">Conferimenti per settimana</h2>
          <p className="text-xs text-muted-foreground">I chili di extra raccolta del mese, settimana per settimana, con origine, destinazione, trasportatore e totali. L&apos;extra raccolta è un canale a sé: non si somma mai a rete e ACI.</p>
        </div>
        <Tabs defaultValue="primarie">
          <TabsList>
            <TabsTrigger value="primarie">Primarie</TabsTrigger>
            <TabsTrigger value="secondarie">Secondarie</TabsTrigger>
          </TabsList>
          <TabsContent value="primarie" className="mt-3">
            <ReportConferimenti canale="EXTRA_RACCOLTA" tipo="primaria" titolo="Conferimenti primarie extra raccolta" />
          </TabsContent>
          <TabsContent value="secondarie" className="mt-3">
            <ReportConferimenti canale="EXTRA_RACCOLTA" tipo="secondaria" titolo="Conferimenti secondarie extra raccolta" />
          </TabsContent>
        </Tabs>
      </div>

      <ExtraRaccoltaForm
        open={formOpen}
        contesto={contesto}
        initial={formInitial}
        onSave={save}
        onCancel={() => { setFormOpen(false); setFormInitial(null); }}
      />
    </div>
  );
}