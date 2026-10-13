import React from 'react';
import { CheckCircle2, ChevronRight } from 'lucide-react';

// LA SEZIONE DEI COMPLETATI della to-do list (richiesta dell'utente del
// 12/10/2026: «gli ordini della 'to-do list' quando sono completati vanno spostati
// nella sezione completati e non solo evidenziati come tali»). La usano le due
// schede, le attivita' e le richieste ECT, cosi' si presentano allo stesso modo.
//
// E' CHIUSA ALL'APERTURA: un <details> senza `open`, che apre e chiude chi guarda
// e che la pagina non scrive da nessuna parte. Sull'intestazione il numero, e la
// nota che non deve sparire quando e' chiusa (le richieste che aspettano ancora
// la risposta al consorzio). Dentro, chi la riempie mette i piu' recenti in alto
// (src/lib/todoSezioni.js).
//
// `numero` e' quanti se ne vedono; `di`, se c'e', quanti sono in tutto (con una
// ricerca in corso). Niente larghezze fisse: a 375 px l'intestazione va a capo.
export default function SezioneCompletati({ titolo = 'Completati', numero = 0, di = null, nota = '', vuota = '', children }) {
  const quanti = di !== null && di !== numero ? `${numero} di ${di}` : `${numero}`;
  return (
    <details className="group border rounded-lg" data-sezione="completati">
      <summary className="list-none px-3 py-2 text-sm font-medium cursor-pointer select-none flex flex-wrap items-center gap-x-2 gap-y-1 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
        <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600" />
        <span>{titolo} ({quanti})</span>
        {nota && <span className="text-xs font-normal text-amber-800">{nota}</span>}
      </summary>
      <div className="border-t px-3 py-3 space-y-2">
        {numero > 0 && <p className="text-xs text-muted-foreground">I più recenti in alto, ognuno col giorno e il perché del completamento.</p>}
        {numero > 0 ? children : <p className="text-sm text-muted-foreground">{vuota}</p>}
      </div>
    </details>
  );
}
