import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, CheckSquare, Square, AlertTriangle, Search, Upload } from 'lucide-react';
import { giorniAllaScadenza, statoRichiesta, listaOrdini, testoTerminatiSenzaFine, testoOrdiniDateDaSistemare, testoAvanzamentoRichiesta, richiesteDellaTodo, annoRichiesta } from '@/lib/richiesteEct';
import { fetchAllClient } from '@/lib/fetchAllClient';
import { dividiRichieste, esitoDellaPagina } from '@/lib/todoSezioni';
import RichiesteCompletate from '@/components/todo/RichiesteCompletate';

// Richieste del consorzio arrivate via email: ci chiedono di anticipare certi
// ritiri. L'ID ordine lo porta il foglio quando e' scritto nella colonna «numero
// d'ordine» (dal 09/10/2026: vale come scritto a mano), altrimenti lo riconosce il
// gestionale fra gli assegnati; quando quell'ordine risulta terminato l'evasione
// si propone da sola e la spunta la mette chi poi risponde alla mail.
//
// DA FARE E COMPLETATE (richiesta dell'utente del 12/10/2026: «gli ordini della
// 'to-do list' quando sono completati vanno spostati nella sezione completati e
// non solo evidenziati come tali»). La tabella tiene solo le richieste ancora da
// ritirare; un'evasa o un'annullata passa nella sezione delle completate, sotto
// (RichiesteCompletate), e ci resta finche' una spunta tolta non la riapre.
// Divide l'esito della pagina (esitoDellaPagina, src/lib/todoSezioni.js): quello
// salvato, o statoRichiesta quando manca o e' il «da_confermare» di prima del
// 29/09/2026. Non si scrive niente per dividerle, e i numeri dei filtri contano
// solo le da fare.

const OGGI = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
const gg = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—');

const ESITI = {
  aperta: { nome: 'In attesa del ritiro', classe: 'bg-amber-50 text-amber-800 border-amber-200' },
  // Resta per le richieste salvate prima del 29/09/2026, quando l'evasione si
  // spuntava a mano: da allora una richiesta i cui ordini sono tutti terminati si
  // chiude da sola.
  da_confermare: { nome: 'Ritiro fatto, da spuntare', classe: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  evasa: { nome: 'Evasa', classe: 'bg-emerald-600 text-white border-emerald-700' },
  annullata: { nome: 'Annullata', classe: 'bg-slate-100 text-slate-700 border-slate-200' },
};

// Lo stato di ogni singolo ordine di una richiesta, com'e' stato rilevato
// all'ultimo caricamento delle primarie.
// La targhetta porta il MINIMO che si legge a colpo d'occhio - un segno e, per chi
// e' stato ritirato, il giorno - e la frase intera sta nel suggerimento. Mettendo
// la frase nella targhetta ("non si trova fra gli ordini caricati"), una richiesta
// con cinque ordini faceva una riga lunghissima che spingeva la tabella fuori
// dallo schermo: la spiegazione va data a chi la cerca, non a tutta la colonna.
const STATO_ORDINE = {
  terminato: { segno: '✓', breve: '', testo: 'ritirato', classe: 'bg-emerald-100 text-emerald-900' },
  assegnato: { segno: '•', breve: 'da ritirare', testo: 'ancora assegnato: il ritiro non e\' stato fatto', classe: 'bg-amber-100 text-amber-900' },
  eseguito: { segno: '•', breve: 'eseguito', testo: 'eseguito a portale: i dati ci sono tutti ma nessuno ha premuto Chiudi', classe: 'bg-amber-100 text-amber-900' },
  senza_data: { segno: '•', breve: 'senza data', testo: 'terminato a portale ma senza la data di fine trasporto: il ritiro non si conta finche\' la data non arriva', classe: 'bg-amber-100 text-amber-900' },
  cancellato: { segno: '✕', breve: 'cancellato', testo: 'cancellato a portale: quel ritiro non si fara\'', classe: 'bg-slate-200 text-slate-700' },
  sconosciuto: { segno: '?', breve: '', testo: 'non si trova fra gli ordini caricati: puo\' essere un ID scritto male o un ordine non ancora caricato dal portale', classe: 'bg-slate-100 text-slate-600' },
};

function DettaglioOrdini({ richiesta, ids }) {
  let stati = [];
  try { stati = richiesta.ordini_stato_json ? JSON.parse(richiesta.ordini_stato_json) : []; } catch { stati = []; }
  if (!stati.length) return null;
  const perId = new Map(stati.map(s => [s.id_ordine, s]));
  return (
    <span className="flex flex-wrap gap-1 mt-1">
      {ids.map(id => {
        const s = perId.get(id);
        const d = STATO_ORDINE[s && s.stato] || STATO_ORDINE.sconosciuto;
        const coda = s && s.stato === 'terminato' ? gg(s.giorno) : d.breve;
        return (
          <span key={id} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap ${d.classe}`}
            title={`${id}: ${d.testo}${s && s.giorno ? `, fine trasporto ${gg(s.giorno)}` : ''}${s && s.motivo ? ` (${s.motivo})` : ''}`}>
            <span>{d.segno}</span><span className="font-mono">{id}</span>{coda ? <span>{coda}</span> : null}
          </span>
        );
      })}
    </span>
  );
}

// Una richiesta a cui manca l'ID ordine: ne' riconosciuto ne' scritto a mano.
const senzaOrdine = (r) => !r.id_ordine && !r.id_ordine_manuale;
// L'anno di una richiesta: quello salvato, o quello della sua mail.
const annoDellaRiga = (r) => Number(r && r.anno) || annoRichiesta(r);

function Scadenza({ r, esito }) {
  if (!r.scadenza) return <span className="text-muted-foreground">—</span>;
  const g = giorniAllaScadenza(String(r.scadenza).slice(0, 10), OGGI());
  const chiusa = esito === 'evasa' || esito === 'annullata';
  const colore = chiusa ? 'text-muted-foreground' : g < 0 ? 'text-red-700 font-medium' : g <= 7 ? 'text-amber-700 font-medium' : '';
  const quando = chiusa ? '' : g < 0 ? ` (in ritardo di ${-g} ${-g === 1 ? 'giorno' : 'giorni'})` : g === 0 ? ' (oggi)' : ` (fra ${g} ${g === 1 ? 'giorno' : 'giorni'})`;
  return <span className={colore}>{gg(r.scadenza)}{quando}</span>;
}

export default function RichiesteEct({ isAdmin }) {
  const [righe, setRighe] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState('');
  const [filtro, setFiltro] = useState('da_fare');
  const [cerca, setCerca] = useState('');
  const [occupato, setOccupato] = useState(null);
  const [caricando, setCaricando] = useState(false);
  const [modifica, setModifica] = useState(null); // { id, testo }
  const [esitoImport, setEsitoImport] = useState(null);
  const [ritiri, setRitiri] = useState(null); // esito del ricontrollo fra i terminati

  const carica = useCallback(async () => {
    setCaricamento(true);
    setErrore('');
    try {
      // L'anno di lavoro e' quello italiano, come "oggi" per le scadenze. Si
      // leggevano solo le richieste di quell'anno: il 1° gennaio una richiesta di
      // dicembre ancora aperta, o evasa e non ancora risposta, spariva dalla
      // pagina, che non ha un selettore d'anno (prova del cambio d'anno,
      // 15/10/2026, difetto 2). Adesso una lettura sola di tutte - sono poche
      // decine l'anno - e restano quelle dell'anno piu' quelle degli anni prima
      // non ancora chiuse (richiesteDaSeguire): la regola della dashboard e del
      // ricalcolo dopo le primarie. Le chiuse restano nel loro anno, tranne
      // quelle chiuse quest'anno (richiesteDellaTodo, revisione del 15/10/2026):
      // una richiesta di dicembre spuntata a gennaio resta fra le completate, e
      // la spunta si puo' togliere.
      const anno = Number(OGGI().slice(0, 4));
      const tutte = await fetchAllClient(base44.entities.RichiestaEct, null, '-mail_inviata_il');
      setRighe(richiesteDellaTodo(tutte, anno));
    } catch (e) {
      setErrore(e?.message || String(e));
    } finally {
      setCaricamento(false);
    }
  }, []);
  useEffect(() => { carica(); }, [carica]);

  // Il ritiro di una richiesta si riconosce fra i terminati delle primarie. Lo fa
  // gia' ogni caricamento delle primarie (dopoCaricamento), ma se quel ricalcolo
  // non e' partito la riga restava "in attesa" e in ritardo finche' non si
  // ricaricava il file delle richieste, col rischio di sollecitare un ritiro gia'
  // fatto. All'apertura lo si ripete, in background, sulla fine trasporto (giorno
  // italiano); scrive, quindi solo per l'amministratore.
  useEffect(() => {
    if (!isAdmin) return undefined;
    let vivo = true;
    base44.functions.invoke('importaBlocco', { azione: 'ritiri_ect', tipo_file: 'primarie' })
      .then(res => {
        const dati = res.data || res;
        if (!vivo) return;
        setRitiri(dati);
        if (dati.aggiornate > 0) carica();
      })
      .catch(() => {});
    return () => { vivo = false; };
  }, [isAdmin, carica]);

  // Il file di gestione si carica da qui: le richieste arrivano da un foglio suo
  // e non c'entrano con gli export del portale.
  const importa = async (file) => {
    if (!file) return;
    setCaricando(true);
    setErrore('');
    setEsitoImport(null);
    try {
      // Il foglio delle richieste porta nomi di produttori e indirizzi: sale in
      // area PRIVATA. Si apre solo con un link firmato che scade, l'indirizzo non
      // lo conserva nessun record e finita la lettura quel file non è più
      // raggiungibile. Vedi base44/shared/fileScaricabile.ts.
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      const res = await base44.functions.invoke('importaRichiesteEct', { file_uri });
      setEsitoImport(res.data);
      await carica();
    } catch (e) {
      setErrore(e?.response?.data?.error || e?.message || String(e));
    } finally {
      setCaricando(false);
    }
  };

  // Gli ID ordine si possono scrivere a mano, anche piu' di uno: un produttore
  // con piu' richieste aperte ne ha spesso due lo stesso giorno (le classi P e M).
  // Quello che si scrive qui resta anche ai caricamenti successivi.
  const salvaOrdini = async (r, testo) => {
    const pulito = String(testo || '').split(/[,;\s]+/).map(x => x.trim().toUpperCase()).filter(Boolean).join(', ');
    setModifica(null);
    if (pulito === String(r.id_ordine_manuale || '')) return;
    setOccupato(r.id);
    try {
      await base44.entities.RichiestaEct.update(r.id, { id_ordine_manuale: pulito });
      await carica();
    } catch (e) {
      setErrore(e?.message || String(e));
    } finally {
      setOccupato(null);
    }
  };

  const spunta = async (r) => {
    if (!isAdmin) return;
    setOccupato(r.id);
    try {
      const adesso = !r.evasione_confermata;
      const campi = {
        evasione_confermata: adesso,
        evasione_confermata_il: adesso ? OGGI() : '',
      };
      campi.esito = statoRichiesta({ ...r, ...campi });
      if (adesso && !r.evaso_il && r.evasione_rilevata_il) campi.evaso_il = String(r.evasione_rilevata_il).slice(0, 10);
      await base44.entities.RichiestaEct.update(r.id, campi);
      await carica();
    } catch (e) {
      setErrore(e?.message || String(e));
    } finally {
      setOccupato(null);
    }
  };

  // L'esito con cui si divide: quello salvato, o la regola di adesso se manca o
  // e' di prima del 29/09/2026. Le richieste divise: la tabella ha le da fare,
  // la sezione sotto le completate, gia' coi ritiri piu' recenti in alto.
  const esitoDi = useCallback((r) => esitoDellaPagina(r, statoRichiesta), []);
  const { daFare, completate } = useMemo(() => dividiRichieste(righe, esitoDi), [righe, esitoDi]);

  // I numeri contano solo le da fare.
  const conteggi = useMemo(() => ({
    da_fare: daFare.length,
    senza_ordine: daFare.filter(senzaOrdine).length,
    in_ritardo: daFare.filter(r => esitoDi(r) === 'aperta' && r.scadenza && giorniAllaScadenza(String(r.scadenza).slice(0, 10), OGGI()) < 0).length,
  }), [daFare, esitoDi]);

  const trovata = useCallback((r) => {
    const q = cerca.trim().toLowerCase();
    return !q || `${r.pdr_nome} ${r.provincia} ${r.id_ordine} ${r.id_ordine_manuale || ''} ${r.id_ordine_candidati || ''} ${r.trasportatore}`.toLowerCase().includes(q);
  }, [cerca]);

  const viste = useMemo(() => {
    let v = daFare;
    if (filtro === 'senza_ordine') v = v.filter(senzaOrdine);
    v = v.filter(trovata);
    return [...v].sort((a, b) => String(a.scadenza || '9999').localeCompare(String(b.scadenza || '9999'))
      || String(b.mail_inviata_il || '').localeCompare(String(a.mail_inviata_il || '')));
  }, [daFare, filtro, trovata]);
  const completateViste = useMemo(() => completate.filter(trovata), [completate, trovata]);

  const FILTRI = [
    ['da_fare', 'Da ritirare', conteggi.da_fare],
    ['senza_ordine', 'Senza ID ordine', conteggi.senza_ordine],
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground max-w-3xl">
        Le richieste che il consorzio ci manda per email, fuori dal portale, per anticipare certi ritiri. Se il foglio porta il
        numero d&apos;ordine vale quello, come scritto a mano; altrimenti lo riconosce il gestionale fra gli assegnati, dal nome del
        produttore e dalla data di immissione. Una richiesta dell&apos;anno prima resta qui finché non si chiude, e se si chiude
        quest&apos;anno resta fra le completate.
        Quando quell&apos;ordine compare fra i terminati la richiesta si chiude da sola ed esce dalla tabella: la trovi fra le
        <strong> completate</strong>, in fondo, con la data del ritiro da comunicare al consorzio, e la spunta la metti tu quando
        hai risposto alla mail. Sull&apos;ID ordine puoi scrivere, e correggere, anche più di un ordine separati da virgola: resta
        così anche ai caricamenti successivi.
      </p>

      {isAdmin && (
        <div className="flex flex-wrap items-center gap-3 border rounded-lg px-3 py-2 bg-muted/30">
          <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${caricando ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer'}`}>
            {caricando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {caricando ? 'Leggo il foglio…' : 'Carica il file di gestione'}
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              disabled={caricando}
              onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; importa(file); }}
            />
          </label>
          <span className="text-xs text-muted-foreground max-w-xl">
            Il file «Gestione Ecotyre», foglio «Richieste ECT». Le richieste nuove si aggiungono, quelle già in elenco si
            aggiornano e le tue spunte non vengono toccate.
          </span>
        </div>
      )}

      {esitoImport && (
        <div className="text-sm border rounded-lg px-3 py-2 bg-muted/40 space-y-1">
          <p>
            Lette <strong>{esitoImport.righe_lette}</strong> richieste: {esitoImport.creati} nuove, {esitoImport.aggiornati} aggiornate,
            {' '}{esitoImport.invariati} già in linea. ID ordine riconosciuto per <strong>{esitoImport.riconosciuti}</strong>.
          </p>
          {esitoImport.da_confermare?.length > 0 && (
            <p className="text-emerald-800">
              Risultano ritirate e aspettano la tua spunta: {esitoImport.da_confermare.map(x => `${x.pdr} (${String(x.evasa_il).split('-').reverse().join('/')})`).join(', ')}. Le trovi fra le completate.
            </p>
          )}
          {/* L'ID ordine scritto nel foglio vale come scritto a mano (15/10/2026);
              uno gia' nel gestionale resta, e se il foglio ne dice un altro si
              dice. Un ID del foglio che non si trova fra gli ordini caricati non
              si prende, e si dice anche questo (revisione del 15/10/2026). */}
          {esitoImport.id_dal_foglio > 0 && (
            <p className="text-muted-foreground">
              ID ordine preso dal foglio per {esitoImport.id_dal_foglio === 1 ? 'una richiesta' : `${esitoImport.id_dal_foglio} richieste`}: vale come scritto a mano.
            </p>
          )}
          {esitoImport.id_del_foglio_non_trovati?.length > 0 && (
            <p className="text-amber-800">
              {esitoImport.id_del_foglio_non_trovati.length === 1 ? 'Per una richiesta il foglio dice' : `Per ${esitoImport.id_del_foglio_non_trovati.length} richieste il foglio dice`} un
              ID ordine che non si trova fra gli ordini caricati, e non è stato preso: {esitoImport.id_del_foglio_non_trovati.map(x => `${x.pdr} (${x.non_trovati})`).join(', ')}.
              Intanto vale il riconoscimento del gestionale. Se l&apos;ID è scritto male correggilo nel foglio; se l&apos;ordine è
              nuovo, si prende ricaricando il foglio dopo il caricamento delle primarie.
            </p>
          )}
          {esitoImport.id_diversi_dal_foglio?.length > 0 && (
            <p className="text-amber-800">
              {esitoImport.id_diversi_dal_foglio.length === 1 ? 'Per una richiesta il foglio dice' : `Per ${esitoImport.id_diversi_dal_foglio.length} richieste il foglio dice`} un ID ordine
              diverso da quello già nel gestionale (scritto a mano, o preso dal foglio a un caricamento di prima), che resta:{' '}
              {esitoImport.id_diversi_dal_foglio.map(x => `${x.pdr} (foglio ${x.foglio}, gestionale ${x.gestionale}${x.gestionale_trovato === false ? ', che non si trova fra gli ordini caricati' : ''})`).join(', ')}.
              Se è giusto quello del foglio, correggilo qui sull&apos;ID ordine.
            </p>
          )}
          {esitoImport.spostate > 0 && (
            <p className="text-muted-foreground">{esitoImport.spostate} richieste hanno cambiato riga nel foglio: sono state riconosciute dal produttore e dalla data, spunte e note sono rimaste al loro posto.</p>
          )}
          {esitoImport.orfane > 0 && (
            <p className="text-muted-foreground">{esitoImport.orfane} righe non sono più nel foglio: restano qui nello storico.</p>
          )}
        </div>
      )}

      {ritiri?.da_confermare?.length > 0 && (
        <p className="text-sm border rounded-lg px-3 py-2 bg-muted/40 text-emerald-800">
          Dai terminati caricati risultano ritirate e aspettano la tua spunta: {ritiri.da_confermare.map(x => `${x.pdr} (${String(x.evasa_il).split('-').reverse().join('/')})`).join(', ')}. Le trovi fra le completate.
        </p>
      )}

      {/* Un ordine terminato senza fine trasporto non conta come ritiro, ma si dice (regola 1). */}
      {((ritiri && ritiri.terminati_senza_fine) || (esitoImport && esitoImport.terminati_senza_fine) || []).length > 0 && (
        <p className="flex items-start gap-2 text-sm border border-amber-200 bg-amber-50 text-amber-900 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {testoTerminatiSenzaFine((ritiri && ritiri.terminati_senza_fine && ritiri.terminati_senza_fine.length ? ritiri : esitoImport).terminati_senza_fine)}
        </p>
      )}

      {/* Evasa da un ordine con un'altra data obbligatoria che manca o non torna:
          il ritiro conta, ma si dice anche questo (regola del 22/09/2026). */}
      {((ritiri && ritiri.ordini_con_date_da_sistemare) || (esitoImport && esitoImport.ordini_con_date_da_sistemare) || []).length > 0 && (
        <p className="flex items-start gap-2 text-sm border border-amber-200 bg-amber-50 text-amber-900 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {testoOrdiniDateDaSistemare((ritiri && ritiri.ordini_con_date_da_sistemare && ritiri.ordini_con_date_da_sistemare.length ? ritiri : esitoImport).ordini_con_date_da_sistemare)}
        </p>
      )}

      {conteggi.in_ritardo > 0 && (
        <div className="flex items-start gap-2 text-sm border border-red-200 bg-red-50 text-red-800 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            <strong>{conteggi.in_ritardo}</strong> {conteggi.in_ritardo === 1 ? 'richiesta ha superato' : 'richieste hanno superato'} il
            termine chiesto dal consorzio e {conteggi.in_ritardo === 1 ? 'aspetta' : 'aspettano'} ancora il ritiro: da sollecitare.
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {FILTRI.map(([k, nome, n]) => (
          <button
            key={k}
            onClick={() => setFiltro(k)}
            className={`px-3 py-1.5 rounded-md text-sm border ${filtro === k ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-muted'}`}
          >
            {nome} <span className="opacity-70">{n}</span>
          </button>
        ))}
        <div className="relative ml-auto">
          <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground" />
          <input
            value={cerca}
            onChange={e => setCerca(e.target.value)}
            placeholder="produttore, ID ordine, trasportatore"
            className="border rounded-md pl-8 pr-3 py-2 text-sm w-72"
          />
        </div>
      </div>

      {errore && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{errore}</p>}
      {caricamento && <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carico le richieste…</p>}

      {!caricamento && righe.length === 0 && (
        <p className="text-sm text-muted-foreground border rounded-lg px-3 py-6 text-center">
          Ancora nessuna richiesta. Si riempie col pulsante qui sopra, caricando il file di gestione.
        </p>
      )}

      {/* Tutte completate: la tabella vuota non serve, basta dire dove sono. */}
      {!caricamento && righe.length > 0 && daFare.length === 0 && (
        <p className="text-sm text-muted-foreground border rounded-lg px-3 py-6 text-center">
          Niente da ritirare: le richieste sono tutte completate, le trovi qui sotto.
        </p>
      )}

      {daFare.length > 0 && (
        <div className="border rounded-xl bg-card" data-scorre-lato>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-3 py-2 font-semibold sticky left-0 bg-muted/50 min-w-[230px]">Produttore</th>
                <th className="text-left px-2 py-2 font-semibold">Pr.</th>
                <th className="text-left px-2 py-2 font-semibold">Cl.</th>
                <th className="text-left px-2 py-2 font-semibold whitespace-nowrap">ID ordine</th>
                <th className="text-left px-2 py-2 font-semibold whitespace-nowrap">Ordine immesso</th>
                <th className="text-left px-2 py-2 font-semibold whitespace-nowrap">Mail del</th>
                <th className="text-left px-2 py-2 font-semibold whitespace-nowrap">Entro</th>
                <th className="text-left px-2 py-2 font-semibold">Trasportatore</th>
                <th className="text-left px-2 py-2 font-semibold whitespace-nowrap">Ritiro</th>
                <th className="text-left px-3 py-2 font-semibold">Stato</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {viste.map(r => {
                const esito = esitoDi(r);
                const e = ESITI[esito] || ESITI.aperta;
                const ids = listaOrdini(r);
                return (
                  <tr key={r.id} className="border-b last:border-b-0 align-top">
                    <td className="px-3 py-2 sticky left-0 bg-card">
                      <span className="font-medium">{r.pdr_nome}</span>
                      {/* Una richiesta di un anno prima ancora da chiudere lo dice
                          (prova del cambio d'anno, 15/10/2026): a gennaio quelle di
                          dicembre restano qui finche' non si chiudono. */}
                      {annoDellaRiga(r) && annoDellaRiga(r) !== Number(OGGI().slice(0, 4)) && (
                        <span className="block text-[11px] text-amber-800">richiesta del {annoDellaRiga(r)}</span>
                      )}
                      {r.nota && <span className="block text-[11px] text-muted-foreground">{r.nota}</span>}
                    </td>
                    <td className="px-2 py-2">{r.provincia || '—'}</td>
                    <td className="px-2 py-2">{r.classe || '—'}</td>
                    {/* La colonna ha una larghezza sua e il contenuto va a capo:
                        senza un limite, una richiesta con cinque ordini allargava la
                        tabella finche' le altre colonne uscivano dallo schermo. */}
                    <td className="px-2 py-2 max-w-[280px]">
                      {modifica && modifica.id === r.id ? (
                        <input
                          autoFocus
                          value={modifica.testo}
                          onChange={e => setModifica({ id: r.id, testo: e.target.value })}
                          onBlur={() => salvaOrdini(r, modifica.testo)}
                          onKeyDown={e => { if (e.key === 'Enter') salvaOrdini(r, modifica.testo); if (e.key === 'Escape') setModifica(null); }}
                          placeholder="ET26012345, ET26012346"
                          className="border rounded px-2 py-1 text-xs font-mono w-56"
                        />
                      ) : (
                        <button
                          type="button"
                          disabled={!isAdmin}
                          onClick={() => setModifica({ id: r.id, testo: (r.id_ordine_manuale || ids.join(', ')) })}
                          title={isAdmin ? 'Scrivi o correggi gli ID ordine: puoi metterne più di uno, separati da virgola' : ''}
                          className={`text-left ${isAdmin ? 'hover:underline' : 'cursor-default'}`}
                        >
                          {/* Con piu' di un ordine l'elenco per esteso non serve:
                              sotto ci sono le targhette, una per ordine, che dicono
                              anche a che punto sono. Qui basta quanti sono. */}
                          {ids.length === 0
                            ? <span className="text-amber-700 text-xs">da trovare</span>
                            : ids.length === 1
                              ? <span className="font-mono text-xs">{ids[0]}</span>
                              : <span className="text-xs text-muted-foreground">{ids.length} ordini</span>}
                        </button>
                      )}
                      {/* Con piu' ordini sulla stessa richiesta, "2 su 3" dice
                          quanti e non QUALI: qui si vede ordine per ordine chi e'
                          ancora assegnato e chi e' stato ritirato (richiesta
                          dell'utente, 29/09/2026). */}
                      {ids.length > 1 && (
                        <span className="block text-[11px] text-muted-foreground">
                          {testoAvanzamentoRichiesta(r.ordini_evasi || 0, r.ordini_totali || ids.length) || `${ids.length} ordini`}
                        </span>
                      )}
                      {ids.length > 1 && <DettaglioOrdini richiesta={r} ids={ids} />}
                      {r.id_ordine_stato === 'ambiguo' && !r.id_ordine_manuale && (
                        <span className="block text-[11px] text-amber-700">
                          più ordini possibili:{' '}
                          {isAdmin ? (
                            <button type="button" className="underline" onClick={() => salvaOrdini(r, r.id_ordine_candidati)}>
                              {r.id_ordine_candidati}
                            </button>
                          ) : r.id_ordine_candidati}
                        </span>
                      )}
                      {r.id_ordine_stato === 'approssimato' && !r.id_ordine_manuale && (
                        <span className="block text-[11px] text-muted-foreground" title="La data della richiesta e quella dell ordine non coincidono al giorno: da confermare">data non esatta</span>
                      )}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">{gg(r.ordine_immesso_il)}</td>
                    <td className="px-2 py-2 whitespace-nowrap">{gg(r.mail_inviata_il)}</td>
                    <td className="px-2 py-2 whitespace-nowrap"><Scadenza r={r} esito={esito} /></td>
                    <td className="px-2 py-2">{r.trasportatore || '—'}</td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      {gg(r.evaso_il || r.evasione_rilevata_il)}
                      {!r.evaso_il && r.evasione_rilevata_il && <span className="block text-[11px] text-muted-foreground">dai terminati</span>}
                      {!r.evaso_il && !r.evasione_rilevata_il && r.ordini_totali > 1 && r.ordini_evasi > 0 && (
                        <span className="block text-[11px] text-amber-700">{r.ordini_evasi} di {r.ordini_totali} ritirati</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded border text-xs ${e.classe}`}>{e.nome}</span>
                      {r.motivo_annullamento && <span className="block text-[11px] text-muted-foreground mt-0.5">{r.motivo_annullamento}</span>}
                      {r.evasione_confermata_il && <span className="block text-[11px] text-muted-foreground mt-0.5">spuntata il {gg(r.evasione_confermata_il)}</span>}
                    </td>
                    <td className="px-2 py-2">
                      {isAdmin && esito !== 'annullata' && (
                        <button
                          onClick={() => spunta(r)}
                          disabled={occupato === r.id}
                          title={r.evasione_confermata ? 'Togli la spunta' : 'Segna come evasa: la data del ritiro va nella risposta al consorzio'}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border hover:bg-muted whitespace-nowrap"
                        >
                          {occupato === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : r.evasione_confermata ? <CheckSquare className="w-3.5 h-3.5 text-emerald-700" /> : <Square className="w-3.5 h-3.5" />}
                          {r.evasione_confermata ? 'evasa' : 'spunta'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {viste.length === 0 && (
                <tr><td colSpan={11} className="text-center py-6 text-muted-foreground">Nessuna richiesta in questo filtro.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Le completate, chiuse all'apertura: evase e annullate, i ritiri piu'
          recenti in alto. La ricerca vale anche qui. */}
      {righe.length > 0 && (
        <RichiesteCompletate
          tutte={completate}
          righe={completateViste}
          esitoDi={esitoDi}
          isAdmin={isAdmin}
          occupato={occupato}
          onSpunta={spunta}
        />
      )}
    </div>
  );
}
