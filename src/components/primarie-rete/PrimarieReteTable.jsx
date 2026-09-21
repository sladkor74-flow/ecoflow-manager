import React, { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useTableSort } from '@/hooks/useTableSort';
import SortHeader from '@/components/shared/SortHeader';
import { formatNumber } from '@/lib/utils';
import { eTerminato, giornoMovimento, giornoOrdine, meseOrdine, tempiRaccolta } from '@/lib/movimenti';
import { giornoRoma } from '@/lib/giornoItaliano';

const COLUMNS = [
  { key: 'id_ordine', label: 'ID Ordine' },
  { key: 'ragione_sociale', label: 'Ragione Sociale' },
  { key: 'provincia', label: 'Prov.' },
  { key: 'regione', label: 'Regione' },
  { key: 'destinazione', label: 'Destinazione' },
  { key: 'classe', label: 'Classe' },
  { key: 'quantita_richiesta', label: 'Q.Rich', format: 'number' },
  { key: 'quantita_ritirata', label: 'Q.Ritir', format: 'number' },
  { key: 'peso_effettivo', label: 'Kg', format: 'number' },
  { key: 'mese', label: 'Mese' },
  { key: 'trasportatore', label: 'Trasportatore' },
  { key: 'fine_trasporto', label: 'Fine trasporto', format: 'date' },
  { key: 'nr_giorni', label: 'Giorni', format: 'number' },
  { key: 'raccolta_nei_tempi', label: 'Tempi' },
  { key: 'stato', label: 'Stato' },
  // la chiusura a portale si mostra soltanto: non ordina e non misura niente
  { key: 'ordine_chiuso_il', label: 'Chiuso il', format: 'date' },
];

// Le date si mostrano come giorno italiano, 'GG/MM/AAAA'.
const dataIt = (v) => { const g = giornoRoma(v); return g ? `${g.slice(8, 10)}/${g.slice(5, 7)}/${g.slice(0, 4)}` : ''; };

// Le segnalazioni della colonna Tempi, in ambra: un terminato che non si puo'
// misurare lo dice, invece di restare vuoto come un ordine ancora aperto.
const SENZA_FINE = 'MANCA FINE TRASPORTO';
const SENZA_IMMISSIONE = 'MANCA IMMISSIONE';
const DATE_INCOERENTI = 'DATE INCOERENTI';
const SEGNALAZIONI = new Set([SENZA_FINE, SENZA_IMMISSIONE, DATE_INCOERENTI]);

function esitoTempi(r, tempi, fine) {
  if (tempi && tempi.esito) return tempi.esito;
  // una fine trasporto prima dell'immissione e' un dato sporco, non un ritiro in anticipo
  if (tempi && tempi.incoerente) return DATE_INCOERENTI;
  if (!eTerminato(r)) return null;
  if (!fine) return SENZA_FINE;
  return tempi ? null : SENZA_IMMISSIONE;
}

export default function PrimarieReteTable({ records, loading }) {
  // Mese, giorni e tempi si ricalcolano dalla fine del trasporto (movimenti.js)
  // invece di leggere i campi salvati: nr_giorni e raccolta_nei_tempi venivano
  // dalla chiusura a portale, e un archivio caricato prima della correzione li
  // porta ancora. Un terminato senza fine trasporto non si misura e si segnala,
  // e non ha nemmeno un mese: giornoOrdine e meseOrdine ripiegherebbero
  // sull'immissione, e la colonna Mese direbbe il mese dell'ordine mentre la
  // colonna Tempi dice che il ritiro non ha una data.
  const righe = useMemo(() => records.map((r) => {
    const tempi = tempiRaccolta(r);
    const fine = giornoMovimento(r);
    const senzaPeriodo = eTerminato(r) && !fine;
    return {
      ...r,
      giorno_ordine: senzaPeriodo ? null : giornoOrdine(r) || null,
      fine_trasporto: fine || null,
      mese: senzaPeriodo ? null : meseOrdine(r),
      nr_giorni: tempi && tempi.giorni != null ? tempi.giorni : null,
      raccolta_nei_tempi: esitoTempi(r, tempi, fine),
    };
  }), [records]);
  // I 500 mostrati sono gli ultimi per fine trasporto (l'immissione per un ordine
  // non terminato): ordinati per chiusura, un ritiro di ieri non ancora chiuso a
  // portale finiva in fondo e poteva non comparire. I terminati senza fine
  // trasporto non hanno giorno e nell'ordine decrescente stanno in cima.
  const sorted = useTableSort(righe, 'giorno_ordine', 'desc');

  if (loading) {
    return <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Caricamento record...</div>;
  }

  if (records.length === 0) {
    return <div className="text-center py-8 text-muted-foreground text-sm">Nessun record trovato per i filtri selezionati.</div>;
  }

  return (
    <div className="border rounded-lg overflow-x-auto max-h-[600px]">
      <table className="w-full text-xs">
        <thead className="bg-muted sticky top-0">
          <tr>
            {COLUMNS.map((col) => (
              <SortHeader key={col.key} col={col} sortKey={sorted.sortKey} sortDir={sorted.sortDir} onSort={sorted.toggleSort} className="px-2 py-2 text-xs" />
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.sorted.slice(0, 500).map((r, i) => (
            <tr key={r.id} className={`border-t hover:bg-muted/30 ${i % 2 ? 'bg-muted/10' : ''}`}>
              {COLUMNS.map((col) => {
                let val = r[col.key];
                if (col.format === 'number') val = val != null ? formatNumber(val, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '';
                else if (col.format === 'date') val = dataIt(val);
                const isTempi = col.key === 'raccolta_nei_tempi';
                return (
                  <td
                    key={col.key}
                    className={`px-2 py-1.5 whitespace-nowrap ${col.format === 'number' ? 'text-right' : ''} ${col.key === 'ragione_sociale' || col.key === 'destinazione' ? 'truncate max-w-[200px]' : ''} ${isTempi && val === 'DOPO SCADENZA' ? 'text-red-600 font-medium' : ''} ${isTempi && val === 'OK' ? 'text-green-600 font-medium' : ''} ${isTempi && SEGNALAZIONI.has(val) ? 'text-amber-600 font-medium' : ''}`}
                  >
                    {val ?? ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {sorted.sorted.length > 500 && <p className="text-xs text-muted-foreground p-2">Mostrati primi 500 di {formatNumber(sorted.sorted.length, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} record{sorted.sortKey === 'giorno_ordine' && sorted.sortDir === 'desc' ? ', i più recenti per fine trasporto (per un ordine non terminato, per immissione; i terminati senza fine trasporto in cima)' : ''}.</p>}
    </div>
  );
}
