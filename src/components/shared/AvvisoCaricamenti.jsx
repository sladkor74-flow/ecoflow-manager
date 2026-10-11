import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertOctagon, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { leggiRegistro, statoDelRegistro, avvisoCaricamento, TIPI_GIACENZE } from '@/lib/registroCaricamenti';

// «ARCHIVIO IN CARICAMENTO» O «CARICAMENTO NON RIUSCITO», SOPRA I TOTALI
// (chiusura dell'audit, 11/10/2026).
//
// Mentre le primarie si riscrivono, o dopo una riscrittura finita a meta', le
// pagine che leggono gli archivi mostravano numeri a meta' come se fossero
// interi: il motore degli alert rinviava, la dashboard no, la pagina neppure.
// Qui la regola e' quella dei motori e della dashboard (registroCaricamenti,
// specchio di base44/shared/registroCaricamenti.ts) e il testo e' lo stesso
// della voce della dashboard (avvisoCaricamento).
//
// Una lettura sola del registro (pochi record, chiunque lo puo' leggere). Se la
// lettura non riesce l'avviso non compare: e' un servizio in piu', e i numeri
// della pagina si vedono lo stesso. aggiorna: un valore che cambia quando la
// pagina ricalcola, cosi' l'avviso si rilegge insieme ai numeri.
//
// tipi: gli archivi che la pagina legge davvero, gli stessi su cui la sua
// funzione rinvia (registroCaricamenti: TIPI_GIACENZE per Giacenze e
// Dichiarazioni, TIPI_ATTIVA per l'attiva, TIPI_PASSIVA per passiva, margine e
// consuntivi). Un caricamento delle terziarie a meta' non rende a meta' i
// totali dell'attiva, e un avviso che lo dicesse griderebbe al lupo (11/10/2026).
export default function AvvisoCaricamenti({ tipi = TIPI_GIACENZE, aggiorna = null, className = '' }) {
  const [avvisi, setAvvisi] = useState([]);
  const chiave = tipi.join(',');

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const elenco = chiave ? chiave.split(',') : [];
        if (!elenco.length) { if (vivo) setAvvisi([]); return; }
        const perTipo = await leggiRegistro(base44.entities.UploadLog, elenco);
        const stato = statoDelRegistro(perTipo, elenco, Date.now());
        if (vivo) setAvvisi(stato.in_corso.map(avvisoCaricamento));
      } catch (_e) {
        if (vivo) setAvvisi([]);
      }
    })();
    return () => { vivo = false; };
  }, [chiave, aggiorna]);

  if (!avvisi.length) return null;
  return (
    <div className={`space-y-1.5 ${className}`}>
      {avvisi.map((a, i) => {
        const inCorso = a.stato === 'in_corso';
        const Icona = inCorso ? Loader2 : AlertOctagon;
        return (
          <div key={i} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${inCorso ? 'border-blue-200 bg-blue-50 text-blue-900' : 'border-red-300 bg-red-50 text-red-900'}`}>
            <Icona className={`w-4 h-4 mt-0.5 shrink-0 ${inCorso ? 'animate-spin' : ''}`} />
            <div>
              <p className="font-medium">{a.titolo}</p>
              <p className="text-xs mt-0.5">
                {a.dettaglio} I totali qui sotto possono essere a metà.{' '}
                {!inCorso && <Link to="/caricamento-dati" className="font-medium underline underline-offset-2">Vai al Caricamento Dati</Link>}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
