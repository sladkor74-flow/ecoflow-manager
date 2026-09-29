import React from 'react';
import { Archive } from 'lucide-react';

const dataIt = (d) => { const s = String(d || '').slice(0, 10); return s.length === 10 ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : ''; };

/**
 * La storia scritta di un documento a cui e' stato tolto il dettaglio.
 *
 * Al quarantesimo giorno dal caricamento i documenti dei fornitori perdono le
 * righe lette e il confronto riga per riga, per non appesantire il dominio
 * (richiesta dell'utente, 29/09/2026). Il record resta con i suoi numeri, e
 * questa e' la parte scritta: che cosa era arrivato, com'era andata, che cosa non
 * tornava.
 *
 * Si mostra sempre, anche se la storia e' vuota: sapere che il dettaglio e' stato
 * tolto e' un'informazione, vedere una scheda vuota senza spiegazioni no.
 */
export default function Storia({ testo, alleggeritoIl, cosa = 'documento' }) {
  const righe = String(testo || '').split('\n').map(r => r.trim()).filter(Boolean);
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 space-y-2">
      <div className="flex items-center gap-2 font-semibold text-slate-800 text-sm">
        <Archive className="w-4 h-4 shrink-0" />
        Storia conservata
      </div>
      <p className="text-xs text-muted-foreground">
        {alleggeritoIl
          ? `Il ${dataIt(alleggeritoIl)} a questo ${cosa} è stato tolto il dettaglio. Restano i numeri di sintesi e quello che c'è scritto qui sotto; le righe lette e il confronto riga per riga non ci sono più, e per rivederli va ricaricato il file. Il motivo è nell'ultima riga.`
          : `Di questo ${cosa} restano i numeri di sintesi e la storia scritta.`}
      </p>
      {righe.length > 0 ? (
        <div className="space-y-1.5 text-sm text-slate-800">
          {righe.map((r, i) => <p key={i} className="leading-relaxed">{r}</p>)}
        </div>
      ) : (
        <p className="text-sm text-slate-600 italic">Per questo {cosa} non è stata scritta nessuna storia.</p>
      )}
    </div>
  );
}
