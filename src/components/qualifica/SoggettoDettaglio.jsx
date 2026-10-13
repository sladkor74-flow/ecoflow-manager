import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  Upload, ExternalLink, RefreshCw, PencilLine, Loader2, AlertOctagon, AlertTriangle, Info, Copy, UserX,
} from 'lucide-react';
import { RUOLI, STATI_REQUISITO, STATI_SOGGETTO, dataIt, quandoScade, problemiDi } from '@/lib/qualifica';
import { linkFile, motivoApertura } from '@/lib/apriFile';

const ICONA_GRAVITA = {
  bloccante: { Icona: AlertOctagon, classe: 'text-red-600' },
  attenzione: { Icona: AlertTriangle, classe: 'text-amber-600' },
  informativo: { Icona: Info, classe: 'text-muted-foreground' },
};

// LA SPUNTA SENZA DATA NON SI SALVA (segnalazione alta A65 del 20/09, corretta
// il 12/10/2026). La maschera salvava «verificato a mano» anche senza scadenza,
// e per un documento che scade quella spunta lo rendeva valido per sempre. Il
// modulo ora lo tiene «da verificare» comunque (statoRequisito in
// base44/shared/qualificaFornitori.ts); qui lo si dice prima, e non si salva.
// Restituisce il motivo per cui la correzione non si salva, o null.
export function motivoCorrezioneNonSalvabile(req, { scadenza, verificato }) {
  if (!verificato || scadenza || !req || req.tipo_scadenza === 'nessuna') return null;
  return 'Per confermarlo a mano scrivi la data di scadenza: questo documento scade, e senza la data la conferma non basta.';
}

function Pill({ stato, mappa }) {
  const s = mappa[stato] || { etichetta: stato, classe: 'bg-muted text-muted-foreground border-border' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium whitespace-nowrap ${s.classe}`}>{s.etichetta}</span>;
}

// IL CONTRATTO IN CORSO NON SI SOSTITUISCE A MANO (revisione del 13/10/2026).
// «Sostituisci» mandava fra i sostituiti tutti i documenti attivi della voce: il
// contratto dell'anno dopo caricato da qui a dicembre toglieva di mezzo il 2026,
// valido fino al 31/12, e finche' il nuovo non era letto bene il fornitore
// scendeva «da completare» o «critico». Restano attivi i contratti che il modulo
// dice in vigore oggi, con la scadenza non passata (req.contratti_in_corso,
// documentoDelRequisito in base44/shared/qualificaFornitori.ts): il requisito
// sceglie fra i due e la qualifica chiude il vecchio quando scade
// (chiudiContrattiSuperati), senza alert. Gli altri documenti, e i contratti
// scaduti, non conformi o da verificare, si sostituiscono come sempre.
// Restituisce i documenti attivi della voce da mandare fra i sostituiti.
export function documentiDaSostituire(req, precedenti, nuovoId) {
  const inCorso = new Set((req && Array.isArray(req.contratti_in_corso)) ? req.contratti_in_corso : []);
  return (precedenti || []).filter(p => p && p.id !== nuovoId && !inCorso.has(p.id));
}

// Che cosa e' per il requisito un documento accanto a quello su cui si regge.
const RELAZIONE = {
  successivo: 'Caricato dopo: finché non risulta valido, il requisito si regge sul documento sopra.',
  in_corso: 'Contratto in corso: il requisito si regge già sul documento sopra; questo vale fino alla sua scadenza, poi la qualifica lo chiude da sola.',
  insieme: 'Vale insieme al documento sopra: il requisito prende lo stato peggiore.',
};

// APRI, RIANALIZZA E CORREGGI PER OGNI DOCUMENTO (revisione del 13/10/2026).
// I pulsanti stavano solo sul documento del requisito. Col contratto dell'anno
// dopo accanto a quello in corso il requisito si regge sul vecchio finche' il
// nuovo non e' valido, e il nuovo letto male restava una nota: non si apriva,
// non si rileggeva, e «Correggi», sotto la nota che parlava del nuovo,
// scriveva sul vecchio (la scadenza del 2027 finiva sul 2026). Ora ogni
// documento ha i suoi pulsanti e la sua maschera, che scrive solo su di lui.
export function AzioniDocumento({ doc, req, isAdmin, inAnalisi, occupato, onApri, onAnalizza, onSalvaCorrezione, prima = null, conNome = false }) {
  const [correggi, setCorreggi] = useState(false);
  const [scadenza, setScadenza] = useState('');
  const [verificato, setVerificato] = useState(false);
  const [note, setNote] = useState('');
  const nonSalvabile = motivoCorrezioneNonSalvabile(req, { scadenza, verificato });

  const apriCorrezione = () => {
    setScadenza(doc?.data_scadenza_manuale || doc?.data_scadenza || '');
    setVerificato(!!doc?.verificato_manualmente);
    setNote('');
    setCorreggi(true);
  };

  if (!isAdmin) return null;
  return (
    <>
      <div className="flex flex-wrap gap-1.5 pt-1 pl-4">
        {prima}
        {doc && (
          <>
            {/* Il file si apre solo se c'e' ancora: il dettaglio dei documenti
                si conserva quaranta giorni, dopo resta la storia scritta. */}
            {doc.ha_file && (
              <Button size="sm" variant="ghost" className="h-7" onClick={() => onApri(doc)}>
                <ExternalLink className="w-3 h-3 mr-1" /> Apri
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-7" disabled={inAnalisi || occupato} onClick={() => onAnalizza(doc.id)}>
              <RefreshCw className="w-3 h-3 mr-1" /> Rianalizza
            </Button>
            <Button size="sm" variant="ghost" className="h-7" onClick={apriCorrezione}>
              <PencilLine className="w-3 h-3 mr-1" /> Correggi
            </Button>
          </>
        )}
      </div>

      {correggi && doc && (
        <div className="ml-4 p-3 rounded-md border bg-muted/30 space-y-2">
          {/* Con piu' documenti sulla voce si dice su quale si scrive. */}
          {conNome && doc.file_nome && <p className="text-xs font-medium">Correzione di «{doc.file_nome}»</p>}
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
          {nonSalvabile && <p className="text-xs text-amber-700">{nonSalvabile}</p>}
          <div className="flex gap-2">
            <Button size="sm" className="h-7" disabled={!!nonSalvabile} onClick={async () => { if (await onSalvaCorrezione(doc, { scadenza, verificato, note }, req)) setCorreggi(false); }}>Salva</Button>
            <Button size="sm" variant="ghost" className="h-7" onClick={() => setCorreggi(false)}>Annulla</Button>
          </div>
        </div>
      )}
    </>
  );
}

// Un altro contratto attivo della voce (req.altri_documenti, 13/10/2026): il
// contratto dell'anno dopo non ancora valido, quello in corso che lo aspetta,
// o il contratto che vale insieme a quello del requisito. Col suo stato, il
// perche' e i suoi pulsanti.
export function DocumentoAccanto({ altro, req, isAdmin, occupato, onApri, onAnalizza, onSalvaCorrezione }) {
  const inAnalisi = altro.stato === 'in_analisi';
  const problemi = Array.isArray(altro.problemi) ? altro.problemi : [];
  return (
    <div className="ml-4 pl-3 border-l-2 space-y-1.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium break-words">{altro.file_nome || 'Documento senza nome'}</div>
          <div className="text-xs text-muted-foreground">{RELAZIONE[altro.relazione] || ''}</div>
        </div>
        <Pill stato={altro.stato} mappa={STATI_REQUISITO} />
      </div>
      <div className="text-sm grid grid-cols-2 gap-x-4 gap-y-0.5 pl-4">
        <span className="text-muted-foreground">Emesso</span>
        <span className="tabular-nums">{dataIt(altro.data_emissione)}</span>
        <span className="text-muted-foreground">Scadenza</span>
        <span className="tabular-nums">
          {altro.scadenza ? dataIt(altro.scadenza) : '—'}
          {altro.giorni != null && <span className="text-muted-foreground"> · {quandoScade(altro.giorni)}</span>}
          {altro.data_scadenza_manuale && <span className="text-muted-foreground"> · corretta a mano</span>}
        </span>
      </div>
      {inAnalisi && (
        <div className="flex items-center gap-2 text-sm text-violet-700 pl-4">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> L'agente sta leggendo il documento e verificando la normativa…
        </div>
      )}
      {altro.sintesi && !inAnalisi && <p className="text-sm text-muted-foreground pl-4">{altro.sintesi}</p>}
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
      {altro.verificato_manualmente && <p className="text-xs text-emerald-700 pl-4">Verificato manualmente da un amministratore.</p>}
      {altro.errore_analisi && !inAnalisi && <p className="text-xs text-red-700 pl-4">Analisi non riuscita: {altro.errore_analisi}</p>}
      <AzioniDocumento doc={altro} req={req} isAdmin={isAdmin} inAnalisi={inAnalisi} occupato={occupato} conNome
        onApri={onApri} onAnalizza={onAnalizza} onSalvaCorrezione={onSalvaCorrezione} />
    </div>
  );
}

export function Requisito({ req, soggetto, isAdmin, occupato, onCarica, onApri, onAnalizza, onSalvaCorrezione }) {
  const inputRef = useRef(null);
  const [mostraTesto, setMostraTesto] = useState(false);
  const { toast } = useToast();

  const doc = req.documento;
  const altri = Array.isArray(req.altri_documenti) ? req.altri_documenti : [];
  // La nota sul contratto caricato dopo sta col suo documento, accanto ai suoi
  // pulsanti, non sopra i pulsanti del documento del requisito (13/10/2026).
  const idAltri = new Set(altri.map(a => a.id));
  const problemi = problemiDi(req).filter(p => !(p && p.documento_id && idAltri.has(p.documento_id)));
  const inAnalisi = req.stato === 'in_analisi';
  const stile = STATI_REQUISITO[req.stato] || STATI_REQUISITO.mancante;

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
              {/* chiesto a questo fornitore per nome, non a tutta la sua categoria */}
              {req.nominale ? ' · chiesto solo a lui' : ''}
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

      <AzioniDocumento doc={doc} req={req} isAdmin={isAdmin} inAnalisi={inAnalisi} occupato={occupato} conNome={altri.length > 0}
        onApri={onApri} onAnalizza={onAnalizza} onSalvaCorrezione={onSalvaCorrezione}
        prima={(
          <>
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
          </>
        )} />

      {/* Gli altri contratti attivi della voce, ciascuno coi suoi pulsanti. */}
      {altri.length > 0 && (
        <div className="space-y-2 pt-1">
          <p className="text-xs font-medium text-muted-foreground pl-4">Altri contratti attivi di questa voce</p>
          {altri.map(a => (
            <DocumentoAccanto key={a.id} altro={a} req={req} isAdmin={isAdmin} occupato={occupato}
              onApri={onApri} onAnalizza={onAnalizza} onSalvaCorrezione={onSalvaCorrezione} />
          ))}
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

  // Un documento di qualifica sta in poche centinaia di chili: se pesa molto di
  // piu' e' quasi sempre una scansione a colori ad alta risoluzione. Moltiplicato
  // per trenta documenti e venti fornitori l'archivio diventa ingestibile, quindi
  // conviene dirlo prima di caricare, quando rifare la scansione costa niente.
  const LIMITE_MB = 5;
  const troppoPesante = (file) => {
    const mb = file.size / (1024 * 1024);
    if (mb <= LIMITE_MB) return false;
    const quanto = mb.toFixed(1).replace('.', ',');
    return !window.confirm(
      `Questo file pesa ${quanto} MB, molto piu' dei pochi decimi di un documento normale.\n\n`
      + 'Di solito e\' una scansione a colori ad alta risoluzione: rifatta in scala di grigi a 200 dpi pesa circa un decimo, '
      + 'e si legge uguale. L\'archivio della qualifica arrivera\' a centinaia di documenti.\n\n'
      + 'Caricarlo lo stesso?');
  };

  const carica = async (req, file) => {
    if (troppoPesante(file)) return;
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
      // Il contratto ancora in vigore resta attivo fino alla sua scadenza
      // (documentiDaSostituire, 13/10/2026).
      const precedenti = await base44.entities.DocumentoQualifica.filter({
        soggetto_chiave: soggetto.chiave, tipo_documento_id: req.tipo_id, stato: 'attivo',
      });
      const daSostituire = documentiDaSostituire(req, precedenti, nuovo.id);
      for (const p of daSostituire) {
        await base44.entities.DocumentoQualifica.update(p.id, { stato: 'sostituito' });
      }
      const tenuti = precedenti.filter(p => p.id !== nuovo.id && !daSostituire.includes(p));
      if (tenuti.length) {
        const uno = tenuti.length === 1;
        toast({
          title: uno ? 'Il contratto in corso resta attivo' : 'I contratti in corso restano attivi',
          description: `${tenuti.map(p => `«${p.file_nome || 'senza nome'}»`).join(', ')} ${uno ? 'vale' : 'valgono'} fino alla scadenza: il requisito passa al nuovo quando risulta valido, e `
            + (uno ? 'il vecchio si chiude da solo quando scade.' : 'i vecchi si chiudono da soli quando scadono.'),
        });
      }
      setOccupato(null);
      await onAggiorna();
      analizza(nuovo.id);
    } catch (e) {
      setOccupato(null);
      toast({ title: 'Caricamento non riuscito', description: e.message || String(e), variant: 'destructive' });
    }
  };

  // IL LINK LO CHIEDE IL SERVER (05/10/2026).
  //
  // Qui il browser firmava da solo, col file_uri che la funzione gli mandava nel
  // riepilogo. L'assistenza della piattaforma ha spiegato che quella firma non e'
  // controllata contro l'utente ne' contro le regole RLS del record: un file_uri
  // e' la chiave del file per chiunque sia collegato. Questi sono DURC, polizze,
  // visure e patenti degli autisti dei fornitori, e il pulsante era gia' riservato
  // all'amministratore: adesso lo e' davvero, perche' il permesso lo controlla
  // apriFile e il file_uri non arriva piu' nel browser.
  //
  // La finestra si apre subito, prima di chiedere il link temporaneo: aprirla
  // dopo un'attesa la farebbe bloccare dal browser come popup.
  const apri = async (doc) => {
    const finestra = window.open('', '_blank');
    try {
      const url = await linkFile('DocumentoQualifica', doc.id);
      if (finestra) finestra.location.href = url; else window.open(url, '_blank');
    } catch (e) {
      if (finestra) finestra.close();
      toast({ title: 'Impossibile aprire il documento', description: motivoApertura(e), variant: 'destructive' });
    }
  };

  // Restituisce true se la correzione e' salvata: altrimenti la maschera resta
  // aperta, con quello che si era scritto.
  const salvaCorrezione = async (doc, { scadenza, verificato, note }, req) => {
    const motivo = motivoCorrezioneNonSalvabile(req, { scadenza, verificato });
    if (motivo) {
      toast({ title: 'Correzione non salvata', description: motivo, variant: 'destructive' });
      return false;
    }
    try {
      await base44.entities.DocumentoQualifica.update(doc.id, {
        data_scadenza_manuale: scadenza || null,
        verificato_manualmente: !!verificato,
        ...(note ? { note } : {}),
      });
      await onAggiorna();
      toast({ title: 'Correzione salvata' });
      return true;
    } catch (e) {
      toast({ title: 'Salvataggio non riuscito', description: e.message || String(e), variant: 'destructive' });
      return false;
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
              {(soggetto.piva || soggetto.codice_fiscale) && (
                <div className="text-sm text-muted-foreground">
                  {soggetto.piva ? 'P.IVA ' + soggetto.piva : ''}
                  {soggetto.piva && soggetto.codice_fiscale && soggetto.codice_fiscale !== soggetto.piva ? ' · ' : ''}
                  {soggetto.codice_fiscale && soggetto.codice_fiscale !== soggetto.piva ? 'C.F. ' + soggetto.codice_fiscale : ''}
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
