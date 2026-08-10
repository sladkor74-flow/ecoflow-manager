import React from 'react';

const COLUMNS = [
  { key: 'id_ordine', label: 'ID Ordine' },
  { key: 'unita_locale_origine', label: 'Impianto Origine' },
  { key: 'destinazione', label: 'Destinazione' },
  { key: 'tipo_destinazione', label: 'Tipo Dest.' },
  { key: 'ragione_sociale', label: 'Ragione Sociale' },
  { key: 'comune', label: 'Comune' },
  { key: 'provincia', label: 'Prov' },
  { key: 'cer', label: 'CER' },
  { key: 'materiale', label: 'Materiale' },
  { key: 'peso_effettivo', label: 'Peso (kg)', format: 'number' },
  { key: 'peso_t', label: 'Peso (t)', format: 'ton' },
  { key: 'mese', label: 'Mese' },
  { key: 'trasportatore', label: 'Trasportatore' },
  { key: 'numero_fir', label: 'FIR' },
  { key: 'trasporto_finito_il', label: 'Trasporto finito', format: 'date' },
];

export default function TerziarieTable({ records, loading }) {
  if (loading) {
    return <div className="flex items-center justify-center py-8 text-muted-foreground">Caricamento...</div>;
  }
  if (!records || records.length === 0) {
    return <div className="text-center py-8 text-muted-foreground border rounded-lg">Nessun record terziaria trovato.</div>;
  }

  return (
    <div className="border rounded-lg overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            {COLUMNS.map((col) => (
              <th key={col.key} className="text-left px-3 py-2.5 font-medium whitespace-nowrap">{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id + r.id_ordine} className="border-t hover:bg-muted/50">
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