import React from 'react';
import { useTableSort } from '@/hooks/useTableSort';
import SortHeader from '@/components/shared/SortHeader';

const COLUMNS = [
  { key: 'id_ordine', label: 'ID Ordine' },
  { key: 'stoccaggio', label: 'Stoccaggio Origine' },
  { key: 'destinazione', label: 'Destinazione' },
  { key: 'tipo_destinazione', label: 'Tipo Dest.' },
  { key: 'comune', label: 'Comune' },
  { key: 'provincia', label: 'Prov' },
  { key: 'classe', label: 'Classe' },
  { key: 'cer', label: 'CER' },
  { key: 'quantita_ritirata', label: 'Q.tà', format: 'number' },
  { key: 'peso_effettivo', label: 'Peso Eff. (kg)', format: 'number' },
  { key: 'peso_t', label: 'Peso (t)', format: 'ton' },
  { key: 'mese', label: 'Mese' },
  { key: 'settimane', label: 'Sett.' },
  { key: 'trasportatore', label: 'Trasportatore' },
  { key: 'partner_operativo', label: 'Partner Op.' },
  { key: 'fatturato_trasporto', label: 'Fatt. Trasporto' },
  { key: 'fatturato_riciclo', label: 'Fatt. Riciclo' },
  { key: 'numero_fir', label: 'FIR' },
  { key: 'ordine_chiuso_il', label: 'Chiuso il', format: 'date' },
];

export default function SecondarieTable({ records, loading }) {
  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(records || [], 'ordine_chiuso_il', 'desc');

  if (loading) {
    return <div className="flex items-center justify-center py-8 text-muted-foreground">Caricamento trasporti secondari...</div>;
  }
  if (!records || records.length === 0) {
    return <div className="text-center py-8 text-muted-foreground border rounded-lg">Nessun trasporto secondario trovato.</div>;
  }

  return (
    <div className="border rounded-lg overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            {COLUMNS.map((col) => (
              <SortHeader key={col.key} col={col} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id} className="border-t hover:bg-muted/50">
              {COLUMNS.map((col) => {
                let val = r[col.key];
                if (col.format === 'number') val = val != null ? val.toLocaleString('it-IT') : '';
                else if (col.format === 'ton') val = val != null ? val.toLocaleString('it-IT', { minimumFractionDigits: 2 }) : '';
                else if (col.format === 'date') val = val ? new Date(val).toLocaleDateString('it-IT') : '';
                return <td key={col.key} className="px-3 py-2 whitespace-nowrap">{val ?? ''}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}