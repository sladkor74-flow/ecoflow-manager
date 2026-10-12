import React, { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { History, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { usePermessi } from '@/lib/permessi';
import { scrittureDelloStorico } from '@/lib/storicoModifiche';

/**
 * La riga «Storico» nella scheda di un record (11/10/2026): chi ha cambiato un
 * target, un'apertura, una tariffa o la commessa, quando, da quale valore a
 * quale e perche'. Le righe le scrivono src/lib/scriviConTraccia.js e
 * shared/traccia.ts in ModificaDato.
 *
 * Chiusa non legge niente: una griglia di cento target non deve fare cento
 * richieste per mostrare cento pulsanti. Si legge quando si apre (aperto la
 * apre subito, per le schede con un record solo come la commessa).
 *
 * I costi dei fornitori (tariffe passive, costi dell'extra raccolta, voci
 * della passiva) li vede solo l'amministratore, come nel modulo Fatturazione.
 *
 * aggiornato (per esempio updated_date del record) rilegge lo storico aperto
 * quando il record cambia sotto gli occhi: una scheda che resta a video dopo
 * un salvataggio deve mostrare anche la modifica appena fatta.
 */
export default function StoricoModifiche({ entita, recordId, aperto: apertoIniziale = false, aggiornato = '', className = '' }) {
  const { isAdmin } = usePermessi();
  const [aperto, setAperto] = useState(apertoIniziale);
  const [righe, setRighe] = useState(null);
  const [errore, setErrore] = useState('');
  const [lettura, setLettura] = useState(false);
  // Le letture si numerano: una partita prima che il record cambiasse non
  // scrive a video lo storico di prima.
  const giro = useRef(0);

  const leggi = useCallback(async () => {
    if (!entita || !recordId) return;
    const n = ++giro.current;
    setLettura(true);
    setErrore('');
    try {
      const lette = await base44.entities.ModificaDato.filter({ entita, record_id: recordId }, '-created_date', 200);
      if (n === giro.current) setRighe(lette);
    } catch (e) {
      if (n === giro.current) setErrore(e?.response?.data?.error || e?.message || 'lettura non riuscita');
    }
    setLettura(false);
  }, [entita, recordId]);

  // Un altro record nella stessa scheda: quello di prima non vale piu'.
  useEffect(() => { giro.current++; setRighe(null); setErrore(''); }, [entita, recordId, aggiornato]);
  useEffect(() => { if (aperto && righe === null && !lettura && !errore) leggi(); }, [aperto, righe, lettura, errore, leggi]);

  if (!entita || !recordId) return null;
  const visibili = (righe || []).filter(r => isAdmin || !r.riservato);
  const nascoste = (righe || []).length - visibili.length;
  const scritture = scrittureDelloStorico(visibili);

  return (
    <div className={`text-xs ${className}`}>
      <button type="button" onClick={() => setAperto(v => !v)} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
        {aperto ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <History className="w-3 h-3" />
        Storico{righe && scritture.length ? ` (${scritture.length})` : ''}
      </button>
      {aperto && (
        <div className="mt-1 pl-4 space-y-1 max-h-48 overflow-y-auto">
          {lettura && <p className="text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Lettura dello storico…</p>}
          {errore && (
            <p className="text-red-700">
              Storico non letto: {errore}.{' '}
              <button type="button" className="underline" onClick={() => { setErrore(''); setRighe(null); }}>Riprova</button>
            </p>
          )}
          {!lettura && !errore && righe && scritture.length === 0 && (
            <p className="text-muted-foreground">
              Nessuna modifica registrata. Lo storico tiene le modifiche fatte a mano da ottobre 2026; i caricamenti dei file hanno il loro registro.
            </p>
          )}
          {scritture.map(s => (
            <div key={s.chiave} className="leading-snug">
              <span className="text-muted-foreground">{s.quando}{s.utente ? ` · ${s.utente}` : ''} · {s.azione}</span>
              {' — '}{s.voci.join('; ')}
              {s.motivo ? <span className="text-muted-foreground"> · perché: {s.motivo}</span> : null}
            </div>
          ))}
          {nascoste > 0 && <p className="text-muted-foreground">Le modifiche ai costi dei fornitori le vede solo l&apos;amministratore.</p>}
        </div>
      )}
    </div>
  );
}
