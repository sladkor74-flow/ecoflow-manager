import React from 'react';
import { Loader2 } from 'lucide-react';
import { useTableSort } from '@/hooks/useTableSort';
import SortHeader from '@/components/shared/SortHeader';
import { formatNumber } from '@/lib/utils';

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
  { key: 'nr_giorni', label: 'Giorni', format: 'number' },
  { key: 'raccolta_nei_tempi', label: 'Tempi' },
  { key: 'stato', label: 'Stato' },
  { key: 'ordine_chiuso_il', label: 'Chiuso il', format: 'date' },
];

export default function PrimarieReteTable({ records, loading }) {
  const sorted = useTableSort(records, 'ordine_chiuso_il', 'desc');

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
                if (col.format === 'number') val = val != null ? formatNumber(val) : '';
                else if (col.format === 'date') val = val ? new Date(val).toLocaleDateString('it-IT') : '';
                const isTempi = col.key === 'raccolta_nei_tempi';
                return (
                  <td
                    key={col.key}
                    className={`px-2 py-1.5 whitespace-nowrap ${col.format === 'number' ? 'text-right' : ''} ${col.key === 'ragione_sociale' || col.key === 'destinazione' ? 'truncate max-w-[200px]' : ''} ${isTempi && val === 'DOPO SCADENZA' ? 'text-red-600 font-medium' : ''} ${isTempi && val === 'OK' ? 'text-green-600 font-medium' : ''}`}
                  >
                    {val ?? ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {sorted.sorted.length > 500 && <p className="text-xs text-muted-foreground p-2">Mostrati primi 500 di {formatNumber(sorted.sorted.length, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} record.</p>}
    </div>
  );
}