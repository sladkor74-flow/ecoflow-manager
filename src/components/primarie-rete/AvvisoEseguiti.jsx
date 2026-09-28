import React from 'react';
import { Clock } from 'lucide-react';
import { riepilogoEseguiti } from '@/lib/movimenti';
import { formatIntero } from '@/lib/utils';

// Gli ordini che a portale sono in stato "eseguito": hanno tutti i dati
// inseriti - peso, date, formulario - ma nessuno ha premuto il pulsante
// "chiudi". E' un limbo.
//
// Il gestionale conta solo i "terminato" (eTerminato in src/lib/movimenti.js),
// quindi quegli ordini spariscono in silenzio dal raccolto, dalle giacenze, dai
// report, dalla copertura del target e dalla fatturazione. Sui dati veri
// (24/09/2026) ce n'era uno, ET26152600 da 3.620 kg, e mancava dal raccolto
// senza che nessuno lo dicesse.
//
// Non si sommano ai terminati, che sarebbe inventarsi un movimento, e non
// cambiano nessun conto: si contano a parte e si dicono, un canale per volta
// (regola 3). Spariscono da soli quando a portale l'ordine viene chiuso e il
// file si ricarica.
//
// La regola di chi e' "eseguito" e di quanti sono sta in src/lib/movimenti.js
// (eEseguito, chiaveOrdine, riepilogoEseguiti): qui c'e' solo come si mostra.
// La stessa regola la usa la finestra del caricamento
// (ordiniEseguitiDelFile in src/lib/importGrandeFile.js, che gira le righe del
// file nella forma dell'archivio e passa di li'), cosi' questa pagina e quella
// finestra non possono dire due numeri diversi. Le funzioni lato server non la
// usano: la copia in base44/shared/movimenti.ts esiste perche' gli specchi
// restino identici e le prove li confrontino.

const MOSTRATI = 50;

/**
 * L'avviso in testa a un elenco di terminati. righe: le righe dell'archivio di
 * QUEL canale (mai rete e ACI insieme); canale: 'Rete', 'ACI'.
 */
export default function AvvisoEseguiti({ righe, canale, className = '' }) {
  const { ordini: n, kg, esempi } = riepilogoEseguiti(righe);
  if (!n) return null;
  return (
    <div className={`border border-amber-300 bg-amber-50 text-amber-900 rounded-lg px-3 py-2 text-sm space-y-1 ${className}`}>
      <div className="flex items-start gap-2">
        <Clock className="w-4 h-4 mt-0.5 shrink-0" />
        <p className="flex-1">
          <strong>{canale ? `${canale} · ` : ''}{formatIntero(n)} {n === 1 ? 'ordine ha' : 'ordini hanno'} tutti i dati ma a portale non è stato premuto Chiudi</strong>
          {kg ? ` (${formatIntero(kg)} kg)` : ''}: finché resta così non {n === 1 ? 'entra' : 'entrano'} in nessun conto —
          {' '}raccolto, giacenze, report, copertura del target e fatturazione.
          {' '}Vanno chiusi a portale, poi si ricarica il file delle primarie.
        </p>
      </div>
      <details className="pl-6 text-xs">
        <summary className="cursor-pointer select-none">Quali sono{n > MOSTRATI ? ` (i primi ${MOSTRATI})` : ''}</summary>
        <ul className="mt-1 space-y-0.5">
          {esempi.slice(0, MOSTRATI).map((o, i) => (
            <li key={`${o.id_ordine || o.numero_fir}|${i}`}>
              <span className="font-mono">{o.id_ordine || o.numero_fir || 'senza ID'}</span>
              {o.id_ordine && o.numero_fir ? <> · FIR <span className="font-mono">{o.numero_fir}</span></> : null}
              {o.righe > 1 ? ` · ${formatIntero(o.righe)} righe` : ''}
              {o.kg ? ` · ${formatIntero(o.kg)} kg` : ''}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
