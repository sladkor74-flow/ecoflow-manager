import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import UploadResultDialog, { extractUploadError, extractUploadWarnings } from '@/components/shared/UploadResultDialog';
import { importaGrandeFile, importaPrimarie, TIPI_LETTURA_BROWSER, dopoCaricamento, testoRicalcoli, testoVerificaArchivio, testoEseguiti, ricalcoliDaRecuperare, recuperiDaFare, moduliDaRicalcolare, ricalcoliFermi, confermeAccumulate } from '@/lib/importGrandeFile';
import { formatIntero, dataServer } from '@/lib/utils';
import { usePermessi } from '@/lib/permessi';
import { BannerSolaLettura } from '@/components/shared/SolaLettura';

const TIPI_FILE = [
  { key: 'primarie', label: 'Primarie', desc: 'File unico delle primarie (un solo foglio con tutto). Suddivide automaticamente le righe in Primarie Rete, Primarie ACI, Assegnati Rete e Assegnati ACI in base a stato e classe.', colore: 'bg-green-50 border-green-200' },
  { key: 'secondarie', label: 'Secondarie', desc: 'Viaggi stoccaggio → impianto (foglio SECONDARIE)', colore: 'bg-purple-50 border-purple-200' },
  { key: 'terziarie', label: 'Terziarie', desc: 'Viaggi impianto → cementeria/impianto (foglio TERZIARIE)', colore: 'bg-pink-50 border-pink-200' },
  { key: 'dichiarazioni_trattamento', label: 'Dichiarazioni Trattamento', desc: 'Report delle dichiarazioni di recupero con la ripartizione dei derivati: granulo, fibre, metallo, cippato, ciabattato', colore: 'bg-cyan-50 border-cyan-200' },
  { key: 'ordini_non_dichiarati', label: 'Ordini Non Dichiarati', desc: 'Ordini in attesa di dichiarazione di trattamento: determina la giacenza a portale di ciascun impianto', colore: 'bg-amber-50 border-amber-200' },
];

// Cosa ha riconosciuto l'allineamento delle dichiarazioni mensili. I nostri mesi
// senza riscontro non sono tutti uguali: quelli dell'ultimo anno del report
// possono ancora comparire; quelli degli anni prima no. E il dicembre di un anno
// chiuso si carica a portale a gennaio dell'anno dopo, mentre l'aggancio cerca i
// caricamenti nello stesso anno (base44/shared/agganciaDichiarazioni.ts): usciva
// a ogni caricamento fra i "non ancora ritrovati", come se dovesse arrivare.
// Una risposta senza l'anno delle righe (versione precedente) conta tutto sull'ultimo.
// Un canale per volta: rete e ACI non si sommano nemmeno qui (regola 3).
const NOMI_CANALE = { RETE: 'Rete', ACI: 'ACI', EXTRA_RACCOLTA: 'Extra raccolta' };
function testoAllineamento(allineamento) {
  const anni = (allineamento.anni || []).map(Number).filter(Boolean);
  const ultimo = anni.length ? Math.max(...anni) : null;
  const chiuso = (n) => ultimo && n.anno && Number(n.anno) < ultimo;
  const canaleDi = (n) => n.canale || 'RETE';
  const tutte = [...(allineamento.aggiornate || []), ...(allineamento.non_trovate || [])];
  const canali = Object.keys(NOMI_CANALE).filter(c => tutte.some(n => canaleDi(n) === c));
  if (!canali.length) canali.push('RETE');
  const perCanale = canali.map(c => {
    const lista = (allineamento.non_trovate || []).filter(n => canaleDi(n) === c);
    const dicembri = lista.filter(n => chiuso(n) && String(n.mese || '').toLowerCase() === 'dicembre').length;
    const vecchi = lista.filter(n => chiuso(n) && String(n.mese || '').toLowerCase() !== 'dicembre').length;
    const recenti = lista.length - dicembri - vecchi;
    const parti = [`${formatIntero((allineamento.aggiornate || []).filter(n => canaleDi(n) === c).length)} aggiornate`];
    if (recenti) parti.push(`${formatIntero(recenti)} nostri mesi${ultimo ? ` del ${ultimo}` : ''} non ancora ritrovati nel report`);
    if (vecchi) parti.push(`${formatIntero(vecchi)} mesi degli anni prima senza riscontro: da controllare in Dichiarazioni Impianti`);
    if (dicembri) parti.push(`${formatIntero(dicembri)} dicembre di anni chiusi non agganciati (si caricano a portale a gennaio dell'anno dopo)`);
    return `${NOMI_CANALE[c]}: ${parti.join(', ')}`;
  });
  return `Dichiarazioni mensili riconosciute come caricate a portale. ${perCanale.join('. ')}.`;
}

// I ricalcoli rimasti appesi si recuperano UNA VOLTA per sessione, non a ogni
// apertura della pagina. Se una funzione e' rotta per un motivo stabile la nota
// "moduli collegati aggiornati" non si scrive mai, e senza questo freno si
// rifacevano piu' funzioni pesanti a ogni accesso, per ogni utente, contro un
// limite di circa settanta richieste al minuto per tutta l'app. Sta fuori dal
// componente apposta: deve sopravvivere a un rimontaggio della pagina, non a un
// ricaricamento del browser.
const recuperiGiaTentati = new Set();

export default function CaricamentoDati() {
  // livello serve solo a far ripartire il recupero quando il permesso cambia:
  // puoCaricare e' una funzione nuova a ogni disegno della pagina, e metterla
  // fra le dipendenze avrebbe fatto rileggere il registro a ogni disegno.
  const { isAdmin, puoCaricare, livello } = usePermessi();
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [uploading, setUploading] = useState(null);
  const [risultato, setRisultato] = useState({});
  const [dialogState, setDialogState] = useState(null);
  const [progresso, setProgresso] = useState({});
  const [ricalcoli, setRicalcoli] = useState({});
  const pendingFileUrlRef = useRef({});
  // Le conferme gia' date per ogni tipo di file. I due controlli anti-regressione
  // possono scattare insieme: mandandone una sola, l'ultima, ognuna spegneva un
  // controllo e riaccendeva l'altro e il caricamento non passava mai piu'. Si
  // azzerano quando si sceglie un file nuovo (una conferma data ieri non vale
  // per il file di domani). La regola sta in confermeAccumulate, dove la
  // controllano le prove.
  const confermeDate = useRef({});
  // Quali ricalcoli ha chiesto CHI STA CARICANDO: solo quelli tengono la pagina
  // aperta con l'avviso "vuoi lasciare il sito?". Quelli di recupero partono da
  // soli all'apertura e si rifanno la volta dopo: non devono fermare nessuno che
  // sta solo passando di qui.
  const ricalcoliMiei = useRef(new Set());

  // Ogni caricamento aggiorna tutto: i ricalcoli che dipendono dal file partono
  // in background (elenco unico in dopoCaricamento) e il loro esito resta sotto
  // la scheda, cosi' uno non riuscito si vede invece di restare fermo in silenzio.
  //
  // Si parte solo su un caricamento RIUSCITO: la regola sta in
  // moduliDaRicalcolare (src/lib/importGrandeFile.js), dove la controllano le
  // prove. Dopo una riparazione riuscita l'esito e' "successo" e i ricalcoli
  // partono da soli: e' la seconda regola.
  // E quando non partono si dice PERCHE' e quali moduli restano indietro
  // (ricalcoliFermi): con setRicalcoli(null) non compariva niente, e dopo una
  // secondaria chiusa parziale - basta una riga non entrata - verifiche,
  // quadrature FIR e qualifica fornitori restavano fermi al
  // caricamento di prima senza che nessuno lo dicesse.
  const aggiornaModuli = (tipoKey, data) => {
    if (!moduliDaRicalcolare(data)) { setRicalcoli(prev => ({ ...prev, [tipoKey]: ricalcoliFermi(tipoKey, data) })); return; }
    ricalcoliMiei.current.add(tipoKey);
    setRicalcoli(prev => ({ ...prev, [tipoKey]: { in_corso: true } }));
    dopoCaricamento(tipoKey).then(esiti => setRicalcoli(prev => ({ ...prev, [tipoKey]: esiti })));
  };

  const caricaLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await base44.entities.UploadLog.list('-created_date', 20);
      setLogs(res);
    } catch (e) {
      setLogs([]);
    }
    setLoadingLogs(false);
  };

  useEffect(() => { caricaLogs(); }, []);

  // I ricalcoli rimasti appesi si rifanno da soli. Un caricamento riuscito puo'
  // lasciarli indietro - la scheda chiusa a meta', la rete caduta, il browser
  // spento - e l'unico modo di accorgersene era leggere il testo rosso sotto la
  // scheda, che al prossimo accesso non c'e' piu'. Aprendo la pagina si guarda
  // il registro: se l'ultimo caricamento di un tipo e' riuscito ma non porta la
  // nota dei moduli aggiornati, si rifanno. E' la seconda regola assoluta: ogni
  // caricamento aggiorna tutto.
  //
  // Due freni, che prima non c'erano:
  //  - LI FA SOLO CHI PUO' CARICARE. I ricalcoli (quattro per le primarie, due
  //    per le secondarie: l'elenco e' RICALCOLI) rileggono archivi interi
  //    e ci SCRIVONO (riepilogo della qualifica, verifiche dei report e
  //    quadrature FIR, ritiri ECT, evasione assegnati), e nessuna di quelle
  //    funzioni guarda il livello: la pagina si apre a tutti, quindi bastava
  //    che un collega in sola consultazione la aprisse per far riscrivere
  //    tutto. Va contro la regola dei permessi: gli altri consultano.
  //  - UNA VOLTA PER SESSIONE. Se un ricalcolo fallisce sempre, la nota non si
  //    scrive mai e senza freno la raffica si ripeteva a ogni apertura.
  useEffect(() => {
    let vivo = true;
    // Uno alla volta, come dentro dopoCaricamento: ognuno rilegge archivi interi
    // e in parallelo la piattaforma respinge le richieste troppo ravvicinate.
    (async () => {
      if (!isAdmin && !TIPI_FILE.some(t => puoCaricare(t.key))) return;
      const tipi = recuperiDaFare(await ricalcoliDaRecuperare(), {
        puoFare: (tipo) => isAdmin || puoCaricare(tipo),
        giaTentati: recuperiGiaTentati,
      });
      for (const tipo of tipi) {
        if (!vivo) return;
        recuperiGiaTentati.add(tipo);
        setRicalcoli(prev => (prev[tipo] ? prev : { ...prev, [tipo]: { in_corso: true } }));
        const esiti = await dopoCaricamento(tipo);
        if (!vivo) return;
        setRicalcoli(prev => ({ ...prev, [tipo]: esiti }));
      }
    })();
    return () => { vivo = false; };
  }, [isAdmin, livello]);

  // Durante un caricamento l'archivio viene riscritto: chiudere la pagina lo
  // lascerebbe a meta'. Anche durante i ricalcoli di CHI HA CARICATO: partono
  // dal browser uno alla volta, e chiudendo la pagina quelli ancora da fare non
  // partirebbero piu'. Quelli di recupero no: partono da soli all'apertura e si
  // rifanno la volta dopo, e chiedere "vuoi lasciare il sito?" a chi non ha
  // chiesto niente non ha senso.
  const ricalcoliInCorso = Object.entries(ricalcoli).some(([tipo, r]) => r && r.in_corso && ricalcoliMiei.current.has(tipo));
  useEffect(() => {
    if (!uploading && !ricalcoliInCorso) return undefined;
    const avviso = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', avviso);
    return () => window.removeEventListener('beforeunload', avviso);
  }, [uploading, ricalcoliInCorso]);

  const handleUpload = async (tipoKey, file, conferma_forzatura = false) => {
    if (!file) return;
    // Un file scelto adesso comincia senza nessuna conferma alle spalle: quelle
    // date per il file di prima non valgono per questo.
    if (!conferma_forzatura) confermeDate.current[tipoKey] = [];
    setUploading(tipoKey);
    setRisultato(prev => ({ ...prev, [tipoKey]: null }));
    setRicalcoli(prev => ({ ...prev, [tipoKey]: null }));
    try {
      // Le primarie e i due report del portale sono troppo grandi per essere
      // importati dentro una sola function: la lettura avviene nel browser e al
      // backend arrivano blocchi di poche centinaia di righe gia' estratte.
      if (tipoKey === 'primarie' || TIPI_LETTURA_BROWSER.includes(tipoKey)) {
        const onProgress = (p) => setProgresso(prev => ({ ...prev, [tipoKey]: p }));
        const data = tipoKey === 'primarie'
          ? await importaPrimarie({ file, confermaForzatura: conferma_forzatura, onProgress })
          : await importaGrandeFile({ file, tipoFile: tipoKey, confermaForzatura: conferma_forzatura, onProgress });
        setProgresso(prev => ({ ...prev, [tipoKey]: null }));
        setRisultato(prev => ({ ...prev, [tipoKey]: { ok: true, data } }));
        aggiornaModuli(tipoKey, data);
        const warnings = extractUploadWarnings(data);
        if (warnings) setDialogState(warnings);
        caricaLogs();
        setUploading(null);
        return;
      }

      let fileUrl;
      if (conferma_forzatura && pendingFileUrlRef.current[tipoKey]) {
        fileUrl = pendingFileUrlRef.current[tipoKey];
      } else {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        fileUrl = file_url;
        pendingFileUrlRef.current[tipoKey] = fileUrl;
      }
      const fnName = 'importEcotyreFile';
      const params = { file_url: fileUrl, tipo_file: tipoKey, nome_file: file.name, replace_existing: true };
      if (conferma_forzatura) params.conferma_forzatura = true;
      const res = await base44.functions.invoke(fnName, params);
      setRisultato(prev => ({ ...prev, [tipoKey]: { ok: true, data: res.data } }));
      aggiornaModuli(tipoKey, res.data);
      const warnings = extractUploadWarnings(res.data);
      if (warnings) setDialogState(warnings);
      caricaLogs();
    } catch (e) {
      setProgresso(prev => ({ ...prev, [tipoKey]: null }));
      const errInfo = extractUploadError(e);
      setRisultato(prev => ({ ...prev, [tipoKey]: { ok: false, error: errInfo.error } }));
      // Si conferma UN controllo per volta: il gettone dice quale. Con un flag
      // unico, confermare "l'archivio si e' rimpicciolito" - che dopo un
      // caricamento parziale capita a tutti - spegneva nello stesso tentativo
      // anche il controllo degli ordini che sparirebbero.
      //
      // Le conferme si ACCUMULANO. I due controlli sono in fila e possono
      // scattare insieme (un tentativo morto ha svuotato un archivio E nel file
      // nuovo qualche ordine non c'e' piu'): mandandone una sola, l'ultima,
      // ogni conferma spegneva un controllo e riaccendeva l'altro, e il
      // pulsante "Forza caricamento" girava in tondo senza arrivare mai a
      // destinazione - proprio nel caso per cui quel pulsante esiste.
      setDialogState({
        ...errInfo,
        onForza: () => {
          confermeDate.current[tipoKey] = confermeAccumulate(confermeDate.current[tipoKey], errInfo.conferma);
          handleUpload(tipoKey, file, confermeDate.current[tipoKey]);
        },
      });
    }
    setUploading(null);
  };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold">Caricamento Dati</h1>
        <p className="text-muted-foreground mt-1">
          Carica i file Excel scaricati dal portale Ecotyre per aggiornare il gestionale. Ogni caricamento sostituisce i dati precedenti della stessa tipologia.
        </p>
      </div>

      {!isAdmin && !TIPI_FILE.some(t => puoCaricare(t.key)) && <BannerSolaLettura cosa="i caricamenti" />}

      {/* Card di upload */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TIPI_FILE.map((tipo) => {
          const res = risultato[tipo.key];
          const isUploading = uploading === tipo.key;
          return (
            <div key={tipo.key} className={`rounded-lg border p-5 ${tipo.colore}`}>
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 rounded-md bg-white shadow-sm">
                  <FileSpreadsheet className="w-6 h-6 text-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="font-heading font-semibold">{tipo.label}</h3>
                  <p className="text-sm text-muted-foreground">{tipo.desc}</p>
                </div>
              </div>

              {puoCaricare(tipo.key) ? (
                <label className="block">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => handleUpload(tipo.key, e.target.files[0])}
                    disabled={isUploading}
                  />
                  <div className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-md cursor-pointer transition-colors ${isUploading ? 'bg-muted cursor-wait' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}>
                    {isUploading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Caricamento...</>
                    ) : (
                      <><Upload className="w-4 h-4" /> Seleziona file Excel</>
                    )}
                  </div>
                </label>
              ) : (
                <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-muted text-muted-foreground text-sm">
                  <Upload className="w-4 h-4" /> Questo caricamento non è nel tuo livello
                </div>
              )}

              {progresso[tipo.key] && (
                <div className="mt-3 text-xs text-muted-foreground">
                  {progresso[tipo.key].blocco ? (
                    <>
                      <div className="flex justify-between mb-1">
                        <span>
                          {progresso[tipo.key].archivio ? `${progresso[tipo.key].archivio} · ` : ''}
                          Blocco {progresso[tipo.key].blocco} di {progresso[tipo.key].totaleBlocchi}
                          {progresso[tipo.key].fase === 'ritentativo' && (
                            <span className="text-amber-700"> · ritentativo {progresso[tipo.key].tentativo}</span>
                          )}
                        </span>
                        <span className="tabular-nums">
                          {formatIntero(progresso[tipo.key].righeScritte || 0)} / {formatIntero(progresso[tipo.key].totaleRighe || 0)} righe
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${Math.round((progresso[tipo.key].blocco / progresso[tipo.key].totaleBlocchi) * 100)}%` }}
                        />
                      </div>
                    </>
                  ) : (
                    <span>{progresso[tipo.key].fase}…</span>
                  )}
                  <p className="mt-1 text-amber-700">Non chiudere e non ricaricare la pagina fino al termine.</p>
                </div>
              )}

              {/* La spunta verde parla di un caricamento riuscito. Per un
                  parziale restava verde coi numeri e l'allarme stava sotto in
                  piccolo: adesso il colore dice subito com'e' andata. */}
              {res && res.ok && (
                <div className={`mt-3 flex items-start gap-2 text-sm ${res.data.esito && res.data.esito !== 'successo' ? 'text-amber-700' : 'text-green-700'}`}>
                  {res.data.esito && res.data.esito !== 'successo'
                    ? <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    : <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                  <span>
                    {res.data.records_creati != null
                      ? `${formatIntero(res.data.records_creati)} target caricati (${formatIntero(res.data.raccoglitori)} raccoglitori)`
                      : (tipo.key === 'primarie' && res.data.primarie_rete_importati != null
                        ? `Rete: ${formatIntero(res.data.primarie_rete_importati)} · ACI: ${formatIntero(res.data.primarie_aci_importati)} · Ass. Rete: ${formatIntero(res.data.assegnati_importati)} · Ass. ACI: ${formatIntero(res.data.assegnati_aci_importati)}`
                        : `${formatIntero(res.data.righe_importate)} righe importate${res.data.righe_fallite > 0 ? ` (${formatIntero(res.data.righe_fallite)} fallite)` : ''}`)}
                    {/* Non "ritentati": un blocco non si riscrive mai. E
                        nemmeno "confermati": sono i blocchi la cui scrittura NON
                        ha risposto e che un conteggio ha dato per entrati, e un
                        conteggio non conferma niente — due righe più sotto si
                        leggeva che quelle righe non si erano potute confermare.
                        "Dato per entrato" è come li chiama il codice, e dice il
                        vero. */}
                    {res.data.blocchi_confermati_dal_conteggio > 0
                      ? ` · ${formatIntero(res.data.blocchi_confermati_dal_conteggio)} ${res.data.blocchi_confermati_dal_conteggio === 1 ? 'blocco dato per entrato' : 'blocchi dati per entrati'} dall'archivio`
                      : ''}
                  </span>
                </div>
              )}

              {res && res.ok && res.data.esito === 'errore' && (
                // Nessuna riga entrata dopo lo svuotamento: il registro lo tiene aperto
                // e i moduli collegati non si ricalcolano finche' non si ricarica.
                //
                // «L'ARCHIVIO E' VUOTO» SI DICE SOLO SE SI E' CONTATO. Le righe
                // che il gestionale conta qui sono quelle che la piattaforma ha
                // CONFERMATO di aver scritto, non quelle che stanno in archivio:
                // se ogni risposta si perde e nessun conteggio risponde, quel
                // numero e' zero e l'archivio puo' essere completo. Si leggeva
                // «l'archivio e' vuoto» in rosso e, nella riga subito sotto,
                // «480 righe sono rimaste in sospeso».
                <p className="mt-1 text-xs text-red-700">
                  {res.data.avviso_non_verificato
                    ? "Il gestionale non è riuscito a confermare nessuna riga e non è riuscito a contare l'archivio: non si sa che cosa ci sia dentro e i moduli collegati non si aggiornano. Ricarica il file."
                    : "Nessuna riga è entrata dopo lo svuotamento: l'archivio è vuoto e i moduli collegati non si aggiornano. Ricarica il file."}
                </p>
              )}

              {/* Righe entrate due volte, righe rimaste in sospeso o un archivio
                  che non si e' riusciti a contare: si dice quante, quali e che
                  cosa fare. */}
              {(() => {
                const r = res && res.ok ? testoVerificaArchivio(res.data) : null;
                return r ? <p className={`mt-1 text-xs ${r.classe}`}>{r.testo}</p> : null;
              })()}

              {/* Gli ordini che a portale sono in stato "eseguito": hanno tutti
                  i dati ma nessuno ha premuto Chiudi, e finche' restano cosi'
                  non entrano in nessun conto. Contati a parte, rete e ACI
                  separati, e non sommati ai terminati. */}
              {(() => {
                const t = res && res.ok ? testoEseguiti(res.data.avviso_eseguiti) : null;
                return t ? <p className="mt-1 text-xs text-amber-700">{t}</p> : null;
              })()}

              {res && res.ok && res.data.allineamento && (
                // Il report delle dichiarazioni riconosce da solo i nostri mesi caricati a portale.
                <p className={`mt-1 text-xs ${res.data.allineamento.errore ? 'text-amber-700' : 'text-muted-foreground'}`}>
                  {res.data.allineamento.errore
                    ? `Dichiarazioni mensili non riconosciute (${res.data.allineamento.errore}): premi «Allinea dal portale» in Dichiarazioni Impianti.`
                    : testoAllineamento(res.data.allineamento)}
                </p>
              )}

              {(() => {
                const r = testoRicalcoli(ricalcoli[tipo.key]);
                return r ? <p className={`mt-1 text-xs ${r.classe}`}>{r.testo}</p> : null;
              })()}
            </div>
          );
        })}
      </div>

      {/* Log upload */}
      <div>
        <h2 className="text-xl font-heading font-semibold mb-4">Storico Caricamenti</h2>
        {loadingLogs ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Caricamento...
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border rounded-lg">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
            Nessun caricamento effettuato
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Data</th>
                  <th className="text-left px-4 py-3 font-medium">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium">File</th>
                  <th className="text-left px-4 py-3 font-medium">Da</th>
                  {/* Il numero e' quello delle righe del FILE entrate in
                      archivio. Per le primarie sono i quattro archivi insieme,
                      assegnati compresi: contando solo rete e ACI diceva
                      10.817 su un file di 11.293 righe, e proprio quando si
                      vuole capire se e' entrato tutto quel numero confondeva.
                      La spiegazione vale per tutte le righe della tabella, che
                      mostra anche secondarie, terziarie e dichiarazioni. */}
                  <th className="text-right px-4 py-3 font-medium" title="Quante righe del file sono entrate in archivio (per le primarie, i quattro archivi insieme)">Righe entrate</th>
                  <th className="text-center px-4 py-3 font-medium">Esito</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t hover:bg-muted/50">
                    <td className="px-4 py-3 text-muted-foreground">{dataServer(log.created_date).toLocaleString('it-IT')}</td>
                    <td className="px-4 py-3 font-medium">{log.tipo_file}</td>
                    <td className="px-4 py-3">{log.nome_file}</td>
                    <td className="px-4 py-3 text-muted-foreground">{log.utente || '—'}</td>
                    <td className="px-4 py-3 text-right">{formatIntero(log.righe_importate)}</td>
                    <td className="px-4 py-3 text-center">
                      {(() => {
                        // una riga rimasta "in corso" oltre dieci minuti e' un caricamento interrotto;
                        // una fallita dopo lo svuotamento resta "in_corso" (e' l'archivio a essere
                        // vuoto) col messaggio che lo dice: non e' in corso, va ricaricata subito
                        const nonRiuscito = log.esito === 'in_corso' && String(log.messaggio || '').startsWith('Caricamento non riuscito');
                        const interrotto = log.esito === 'in_corso' && !nonRiuscito && Date.now() - dataServer(log.created_date).getTime() > 10 * 60 * 1000;
                        const classe = log.esito === 'successo' ? 'bg-green-100 text-green-700' : log.esito === 'parziale' ? 'bg-amber-100 text-amber-700' : log.esito === 'in_corso' && !interrotto && !nonRiuscito ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700';
                        return (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${classe}`} title={interrotto ? "Il caricamento non è mai stato concluso: l'archivio può essere vuoto o incompleto. Ricarica il file." : log.messaggio || ''}>
                            {nonRiuscito ? 'non riuscito: ricarica il file' : interrotto ? 'interrotto: ricarica il file' : log.esito === 'in_corso' ? 'in corso' : log.esito}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <UploadResultDialog state={dialogState} onClose={() => setDialogState(null)} />
    </div>
  );
}