import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  Upload, ExternalLink, RefreshCw, PencilLine, Loader2, AlertOctagon, AlertTriangle, Info, Copy, UserX, Truck,
} from 'lucide-react';
import { RUOLI, STATI_REQUISITO, STATI_SOGGETTO, dataIt, quandoScade, problemiDi } from '@/lib/qualifica';

const ICONA_GRAVITA = {
  bloccante: { Icona: AlertOctagon, classe: 'text-red-600' },
  attenzione: { Icona: AlertTriangle, classe: 'text-amber-600' },
  informativo: { Icona: Info, classe: 'text-muted-foreground' },
};

function Pill({ stato, mappa }) {
  const s = mappa[stato] || { etichetta: stato, classe: 'bg-muted text-muted-foreground border-border' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium whitespace-nowrap ${s.classe}`}>{s.etichetta}</span>;
}

function Requisito({ req, soggetto, isAdmin, occupato, onCarica, onApri, onAnalizza, onSalvaCorrezione }) {
  const inputRef = useRef(null);
  const [correggi, setCorreggi] = useState(false);
  const [scadenza, setScadenza] = useState('');
  const [verificato, setVerificato] = useState(false);
  const [note, setNote] = useState('');
  const [mostraTesto, setMostraTesto] = useState(false);
  const { toast } = useToast();

  const doc = req.documento;
  const problemi = problemiDi(req);
  const inAnalisi = req.stato === 'in_analisi';
  const stile = STATI_REQUISITO[req.stato] || STATI_REQUISITO.mancante;

  const apriCorrezione = () => {
    setScadenza(doc?.data_scadenza_manuale || doc?.data_scadenza || '');
    setVerificato(!!doc?.verificato_manualmente);
    setNote('');
    setCorreggi(true);
  };

  const copia = async () => {
    try {
      await navigator.clipboard.writeText(doc.richiesta_al_fornitore);
      toast({ title: 'Testo copiato' });
    } catch (_e) {
      toast({ title: 'Copia non riuscita', variant: 'destructive' });
    }
  };

  return (
    <div className="border rounded-lg p-3 space-y-2 bg-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${stile.punto}`} />
          <div className="min-w-0">
            <div className="font-medium leading-tight">{req.tipo_nome}</div>
            <div className="text-xs text-muted-foreground">
              {req.obbligatorio ? 'Obbligatorio' : 'Facoltativo'}
              {doc && doc.file_nome ? ' · ' + doc.file_nome : ''}
            </div>
          </div>
        </div>
        <Pill stato={req.stato} mappa={STATI_REQUISITO} />
      </div>

      {doc && (
        <div className="text-sm grid grid-cols-2 gap-x-4 gap-y-0.5 pl-4">
          <span className="text-muted-foreground">Emesso</span>
          <span className="tabular-nums">{dataIt(doc.data_emissione)}</span>
          <span className="text-muted-foreground">Scadenza</span>
          <span className="tabular-nums">
            {req.scadenza ? dataIt(req.scadenza) : (req.tipo_scadenza === 'nessuna' ? 'Non scade' : '—')}
            {req.giorni != null && <span className="text-muted-foreground"> · {quandoScade(req.giorni)}</span>}
            {doc.data_scadenza_manuale && <span className="text-muted-foreground"> · corretta a mano</span>}
          </span>
        </div>
      )}

      {inAnalisi && (
        <div className="flex items-center gap-2 text-sm text-violet-700 pl-4">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> L'agente sta leggendo il documento e verificando la normativa…
        </div>
      )}

      {doc && doc.sintesi && !inAnalisi && <p className="text-sm text-muted-foreground pl-4">{doc.sintesi}</p>}

      {problemi.length > 0 && !inAnalisi && (
        <ul className="space-y-1 pl-4">
          {problemi.map((p, i) => {
            const g = ICONA_GRAVITA[p.gravita] || ICONA_GRAVITA.attenzione;
            return (
              <li key={i} className="flex items-start gap-1.5 text-sm">
                <g.Icona className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${g.classe}`} />
                <span>{p.messaggio}</span>
              </li>
            );
          })}
        </ul>
      )}

      {doc && doc.verificato_manualmente && (
        <p className="text-xs text-emerald-700 pl-4">Verificato manualmente da un amministratore.</p>
      )}

      {doc && doc.errore_analisi && req.stato !== 'in_analisi' && (
        <p className="text-xs text-red-700 pl-4">Analisi non riuscita: {doc.errore_analisi}</p>
      )}

      {doc && doc.richiesta_al_fornitore && !inAnalisi && (
        <div className="pl-4">
          <button onClick={() => setMostraTesto(v => !v)} className="text-xs text-primary hover:underline">
            {mostraTesto ? 'Nascondi' : 'Mostra'} il testo da inviare al fornitore
          </button>
          {mostraTesto && (
            <div className="mt-1 p-2 rounded bg-muted/50 text-sm whitespace-pre-wrap">
              {doc.richiesta_al_fornitore}
              <div className="mt-1">
                <button onClick={copia} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  <Copy className="w-3 h-3" /> Copia
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {isAdmin && (
        <div className="flex flex-wrap gap-1.5 pt-1 pl-4">
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) onCarica(req, f); }}
          />
          <Button size="sm" variant={doc ? 'outline' : 'default'} className="h-7" disabled={occupato} onClick={() => inputRef.current && inputRef.current.click()}>
            {occupato ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Upload className="w-3 h-3 mr-1" />}
            {doc ? 'Sostituisci' : 'Carica'}
          </Button>
          {doc && (
            <>
              <Button size="sm" variant="ghost" className="h-7" onClick={() => onApri(doc)}>
                <ExternalLink className="w-3 h-3 mr-1" /> Apri
              </Button>
              <Button size="sm" variant="ghost" className="h-7" disabled={inAnalisi || occupato} onClick={() => onAnalizza(doc.id)}>
                <RefreshCw className="w-3 h-3 mr-1" /> Rianalizza
              </Button>
              <Button size="sm" variant="ghost" className="h-7" onClick={apriCorrezione}>
                <PencilLine className="w-3 h-3 mr-1" /> Correggi
              </Button>
            </>
          )}
        </div>
      )}

      {correggi && doc && (
        <div className="ml-4 p-3 rounded-md border bg-muted/30 space-y-2">
          <label className="block text-xs text-muted-foreground">
            Scadenza corretta
            <input type="date" value={scadenza || ''} onChange={(e) => setScadenza(e.target.value)} className="block mt-1 px-2 py-1 rounded border bg-card text-sm text-foreground" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={verificato} onChange={(e) => setVerificato(e.target.checked)} />
            Ho controllato il documento: è valido nonostante le segnalazioni
          </label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota facoltativa" rows={2} className="w-full px-2 py-1 rounded border bg-card text-sm" />
          <p className="text-xs text-muted-foreground">La correzione ha la precedenza sull'analisi e non viene sovrascritta se il documento viene rianalizzato.</p>
          <div className="flex gap-2">
            <Button size="sm" className="h-7" onClick={async () => { await onSalvaCorrezione(doc, { scadenza, verificato, note }); setCorreggi(false); }}>Salva</Button>
            <Button size="sm" variant="ghost" className="h-7" onClick={() => setCorreggi(false)}>Annulla</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SoggettoDettaglio({ soggetto, anno, isAdmin, open, onClose, onAggiorna, onEscludi }) {
  const [occupato, setOccupato] = useState(null);
  const { toast } = useToast();

  if (!soggetto) return null;

  const contesto = {
    nome: soggetto.nome,
    piva: soggetto.piva,
    codice_fiscale: soggetto.codice_fiscale,
    ruoli: soggetto.ruoli,
    targhe: soggetto.targhe,
  };

  // L'analisi puo' durare anche un minuto. Se la richiesta scade lato browser
  // la funzione continua comunque a lavorare: il modulo ricontrolla da solo lo
  // stato dei documenti in analisi finche' non cambia.
  const analizza = async (documentoId) => {
    try {
      await base44.functions.invoke('analizzaDocumentoQualifica', { documento_id: documentoId, contesto });
    } catch (e) {
      const msg = e && e.response && e.response.data && e.response.data.error;
      if (msg) toast({ title: 'Analisi non riuscita', description: msg, variant: 'destructive' });
    }
    await onAggiorna();
  };

  const carica = async (req, file) => {
    setOccupato(req.tipo_id);
    try {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      const nuovo = await base44.entities.DocumentoQualifica.create({
        soggetto_chiave: soggetto.chiave,
        soggetto_nome: soggetto.nome,
        tipo_documento_id: req.tipo_id,
        tipo_documento_nome: req.tipo_nome,
        file_uri,
        file_nome: file.name,
        stato: 'attivo',
        analisi_stato: 'in_attesa',
      });
      // Il documento precedente si archivia solo dopo che il nuovo e' stato
      // salvato: se il caricamento fallisse, il fornitore non resterebbe scoperto.
      const precedenti = await base44.entities.DocumentoQualifica.filter({
        soggetto_chiave: soggetto.chiave, tipo_documento_id: req.tipo_id, stato: 'attivo',
      });
      for (const p of precedenti) {
        if (p.id !== nuovo.id) await base44.entities.DocumentoQualifica.update(p.id, { stato: 'sostituito' });
      }
      setOccupato(null);
      await onAggiorna();
      analizza(nuovo.id);
    } catch (e) {
      setOccupato(null);
      toast({ title: 'Caricamento non riuscito', description: e.message || String(e), variant: 'destructive' });
    }
  };

  // La finestra si apre subito, prima di chiedere il link temporaneo: aprirla
  // dopo un'attesa la farebbe bloccare dal browser come popup.
  const apri = async (doc) => {
    const finestra = window.open('', '_blank');
    try {
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: doc.file_uri, expires_in: 300 });
      if (finestra) finestra.location.href = signed_url; else window.open(signed_url, '_blank');
    } catch (e) {
      if (finestra) finestra.close();
      toast({ title: 'Impossibile aprire il documento', description: e.message || String(e), variant: 'destructive' });
    }
  };

  const salvaCorrezione = async (doc, { scadenza, verificato, note }) => {
    try {
      await base44.entities.DocumentoQualifica.update(doc.id, {
        data_scadenza_manuale: scadenza || null,
        verificato_manualmente: !!verificato,
        ...(note ? { note } : {}),
      });
      await onAggiorna();
      toast({ title: 'Correzione salvata' });
    } catch (e) {
      toast({ title: 'Salvataggio non riuscito', description: e.message || String(e), variant: 'destructive' });
    }
  };

  const obbligatori = soggetto.requisiti.filter(r => r.obbligatorio);
  const facoltativi = soggetto.requisiti.filter(r => !r.obbligatorio);

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="space-y-2 text-left">
          <div className="flex items-start justify-between gap-3 pr-6">
            <SheetTitle className="text-xl">{soggetto.nome}</SheetTitle>
            <Pill stato={soggetto.stato} mappa={STATI_SOGGETTO} />
          </div>
          <SheetDescription asChild>
            <div className="space-y-1.5">
              <div className="flex flex-wrap gap-1">
                {soggetto.ruoli.map(r => (
                  <span key={r} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">{RUOLI[r] || r}</span>
                ))}
                {soggetto.origine === 'manuale' && (
                  <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs">Incluso manualmente</span>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                {soggetto.piva ? 'P.IVA ' + soggetto.piva + ' · ' : ''}
                {soggetto.movimenti > 0
                  ? `${soggetto.movimenti.toLocaleString('it-IT')} movimentazioni nel ${anno}, ${soggetto.tonnellate.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t`
                  : `Nessuna movimentazione nel ${anno}`}
              </div>
              {soggetto.targhe.length > 0 && (
                <div className="text-xs text-muted-foreground flex items-start gap-1">
                  <Truck className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>Mezzi usati: {soggetto.targhe.join(', ')}</span>
                </div>
              )}
            </div>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {soggetto.requisiti.length === 0 && (
            <p className="text-sm text-muted-foreground">Il catalogo non prevede documenti per i ruoli di questo soggetto.</p>
          )}

          {obbligatori.length > 0 && (
            <section className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Documenti obbligatori · {soggetto.obbligatori_validi} di {soggetto.obbligatori_totali} validi
              </h4>
              {obbligatori.map(r => (
                <Requisito key={r.tipo_id} req={r} soggetto={soggetto} isAdmin={isAdmin} occupato={occupato === r.tipo_id}
                  onCarica={carica} onApri={apri} onAnalizza={analizza} onSalvaCorrezione={salvaCorrezione} />
              ))}
            </section>
          )}

          {facoltativi.length > 0 && (
            <section className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Documenti facoltativi</h4>
              {facoltativi.map(r => (
                <Requisito key={r.tipo_id} req={r} soggetto={soggetto} isAdmin={isAdmin} occupato={occupato === r.tipo_id}
                  onCarica={carica} onApri={apri} onAnalizza={analizza} onSalvaCorrezione={salvaCorrezione} />
              ))}
            </section>
          )}

          {isAdmin && (
            <div className="pt-4 border-t">
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => onEscludi(soggetto)}>
                <UserX className="w-3.5 h-3.5 mr-1" />
                {soggetto.origine === 'manuale' ? `Togli dalla qualifica ${anno}` : `Escludi dalla qualifica ${anno}`}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
