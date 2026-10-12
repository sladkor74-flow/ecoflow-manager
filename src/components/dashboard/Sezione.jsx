import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown, ChevronRight } from 'lucide-react';
import Perche from '@/components/shared/Perche';

// UNA SEZIONE DEL QUADRO DELLA COMMESSA (migliorie dell'11/10/2026).
//
// Titolo, sottotitolo, il perche' dei numeri al tocco, i collegamenti ai moduli
// e, se ci sono voci di «Da gestire» che la riguardano, solo il segno «2 da
// gestire» che porta a loro: una sezione dice come sta la commessa e non ripete
// mai il testo di una voce. Apribile, per le parti che costano una lettura
// (la chiusura del mese).
export function SegnoDaGestire({ quante, onApri }) {
  if (!quante) return null;
  return (
    <button
      type="button"
      onClick={onApri}
      className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {quante} da gestire <ArrowRight className="w-3 h-3" aria-hidden="true" />
    </button>
  );
}

export default function Sezione({
  id, titolo, sottotitolo, perche, icona: Icona, collegamenti = [], daGestire = 0, onDaGestire,
  apribile = false, aperta = true, onApri, destra = null, children, className = '',
}) {
  const idTitolo = `${id}-titolo`;
  const intestazione = (
    <div className="min-w-0 flex-1">
      <h2 id={idTitolo} className="font-heading font-semibold text-lg flex items-center gap-2 flex-wrap">
        {apribile && (aperta ? <ChevronDown className="w-4 h-4 text-muted-foreground" aria-hidden="true" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />)}
        {Icona && <Icona className="w-5 h-5 text-primary shrink-0" aria-hidden="true" />}
        <span>{titolo}</span>
      </h2>
      {sottotitolo && <p className="text-xs text-muted-foreground mt-0.5">{sottotitolo}</p>}
    </div>
  );
  return (
    <section id={id} aria-labelledby={idTitolo} className={`border rounded-lg p-4 lg:p-5 scroll-mt-4 bg-card ${className}`}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        {apribile ? (
          <button type="button" onClick={onApri} aria-expanded={aperta} className="text-left flex-1 min-w-0 rounded-md hover:bg-muted/40 -mx-1 px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {intestazione}
          </button>
        ) : intestazione}
        <div className="flex items-center gap-2 flex-wrap">
          {perche && <Perche>{perche}</Perche>}
          <SegnoDaGestire quante={daGestire} onApri={() => onDaGestire && onDaGestire(id)} />
          {destra}
        </div>
      </div>
      {collegamenti.length > 0 && (!apribile || aperta) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
          {collegamenti.map(c => (
            <Link key={c.a} to={c.a} className="text-xs text-primary hover:underline inline-flex items-center gap-1">
              {c.testo} <ArrowRight className="w-3 h-3" aria-hidden="true" />
            </Link>
          ))}
        </div>
      )}
      {(!apribile || aperta) && <div className="mt-4">{children}</div>}
    </section>
  );
}

/** Una cifra della sezione: etichetta piccola, numero, una riga sotto. */
export function Cifra({ etichetta, valore, sotto, tono = '', perche = null }) {
  return (
    <div className="rounded-md border bg-background px-3 py-2.5 min-w-0">
      <p className="text-xs text-muted-foreground flex items-center gap-1">{etichetta}{perche && <Perche>{perche}</Perche>}</p>
      <p className={`text-lg font-heading font-semibold mt-0.5 break-words ${tono}`}>{valore}</p>
      {sotto && <p className="text-xs text-muted-foreground mt-0.5">{sotto}</p>}
    </div>
  );
}

/** Una tabella che puo' scorrere di lato senza far scorrere la pagina (regola globale di index.css). */
export function Tabella({ children, className = '' }) {
  return (
    <div className={`overflow-x-auto ${className}`} data-scorre-lato="">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}
