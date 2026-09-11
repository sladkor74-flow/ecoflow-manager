import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, AlertCircle, ShieldCheck } from 'lucide-react';

// Estrae le informazioni di errore dalla risposta SDK (per HTTP 400/409/500)
export function extractUploadError(e) {
  const status = e.response?.status;
  const data = e.response?.data || {};
  return {
    type: 'error',
    status,
    error: data.error || e.message || 'Errore sconosciuto',
    dettaglio: data.dettaglio,
    tipo_rilevato: data.tipo_rilevato,
    fogli_trovati: data.fogli_trovati,
    esempi_mancanti: data.esempi_mancanti,
    richiede_conferma: data.richiede_conferma,
    righe_file: data.righe_file,
    righe_archivio: data.righe_archivio,
    mancanti: data.mancanti,
  };
}

// Estrae gli avvisi non bloccanti da una risposta di successo
export function extractUploadWarnings(data) {
  if (!data) return null;
  const hasColonne = data.avviso_colonne && data.avviso_colonne.length > 0;
  const hasDate = !!data.avviso_date;
  if (!hasColonne && !hasDate) return null;
  return {
    type: 'warning',
    avviso_colonne: data.avviso_colonne,
    avviso_date: data.avviso_date,
  };
}

// Dialog modale per risultati di caricamento (errore bloccante o avviso non bloccante)
// state: null | { type: 'error'|'warning', ... }
// state.onForza: callback opzionale per "Forza caricamento" (solo error con richiede_conferma)
export default function UploadResultDialog({ state, onClose }) {
  const [confirmingForza, setConfirmingForza] = useState(false);
  if (!state) return null;

  const isError = state.type === 'error';
  const title = isError
    ? (state.status === 409 ? 'Caricamento bloccato: rischio perdita dati' : 'Formato file non valido')
    : 'Caricamento completato con avvisi';
  const titleColor = isError ? 'text-red-700' : 'text-amber-700';
  const Icon = isError ? AlertTriangle : AlertCircle;
  const iconColor = isError ? 'text-red-600' : 'text-amber-600';

  const handleForza = () => {
    setConfirmingForza(false);
    onClose();
    if (state.onForza) state.onForza();
  };

  return (
    <Dialog open={!!state} onOpenChange={(open) => { if (!open) { setConfirmingForza(false); onClose(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${titleColor}`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {isError && state.error && (
            <p className="font-medium text-foreground">{state.error}</p>
          )}

          {state.tipo_rilevato && (
            <div className="p-2.5 rounded-md bg-amber-50 border border-amber-300 text-amber-900 font-medium">
              {state.tipo_rilevato}
            </div>
          )}

          {state.dettaglio && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Dettaglio</p>
              <p className="text-foreground">{state.dettaglio}</p>
            </div>
          )}

          {state.righe_archivio != null && state.mancanti != null && (
            <p className="text-foreground">
              Righe nel file: <strong>{state.righe_file ?? '—'}</strong> · In archivio: <strong>{state.righe_archivio}</strong> · Mancanti: <strong>{state.mancanti}</strong>
            </p>
          )}

          {state.esempi_mancanti && state.esempi_mancanti.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">ID mancanti (primi 10)</p>
              <ul className="list-disc pl-5 space-y-0.5">
                {state.esempi_mancanti.map((id, i) => (
                  <li key={i} className="font-mono text-xs text-foreground">{id}</li>
                ))}
              </ul>
            </div>
          )}

          {state.fogli_trovati && state.fogli_trovati.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Fogli rilevati nel file</p>
              <ul className="list-disc pl-5 space-y-0.5">
                {state.fogli_trovati.map((f, i) => (
                  <li key={i} className="text-foreground">{f}</li>
                ))}
              </ul>
            </div>
          )}

          {state.avviso_colonne && state.avviso_colonne.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Colonne mancanti (non bloccanti)</p>
              <ul className="list-disc pl-5 space-y-0.5">
                {state.avviso_colonne.map((c, i) => (
                  <li key={i} className="text-foreground">{c}</li>
                ))}
              </ul>
            </div>
          )}

          {state.avviso_date && (
            <div className="p-2.5 rounded-md bg-amber-50 border border-amber-300 text-amber-900 text-sm">
              <strong>Avviso date:</strong> ultima data nel file ({new Date(state.avviso_date.data_file).toLocaleDateString('it-IT')})
              {' '}precedente all'archivio ({new Date(state.avviso_date.data_archivio).toLocaleDateString('it-IT')}).
            </div>
          )}

          {isError && (
            <p className="flex items-center gap-1.5 text-green-700 font-medium pt-2 border-t">
              <ShieldCheck className="w-4 h-4" />
              Nessun dato è stato modificato o cancellato.
            </p>
          )}
        </div>

        <DialogFooter>
          {isError && state.richiede_conferma && state.onForza ? (
            confirmingForza ? (
              <>
                <Button variant="outline" onClick={() => setConfirmingForza(false)}>Annulla</Button>
                <Button variant="destructive" onClick={handleForza}>
                  Confermo, forza caricamento
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={onClose}>Chiudi</Button>
                <Button variant="destructive" onClick={() => setConfirmingForza(true)}>
                  Forza caricamento
                </Button>
              </>
            )
          ) : (
            <Button variant="outline" onClick={onClose}>Chiudi</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}