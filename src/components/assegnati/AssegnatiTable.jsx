import React from 'react';

const COLUMNS = [
  { key: 'id_ordine', label: 'ID Ordine' },
  { key: 'ordine_immesso_il', label: 'Immesso il', format: 'date' },
  { key: 'ragione_sociale', label: 'Ragione Sociale' },
  { key: 'comune', label: 'Comune' },
  { key: 'provincia', label: 'Prov' },
  { key: 'regione', label: 'Regione' },
  { key: 'classe', label: 'Classe' },
  { key: 'prodotto', label: 'Prodotto' },
  { key: 'quantita_richiesta', label: 'Q.tà Rich.', format: 'number' },
  { key: 'peso_stimato', label: 'Peso (kg)', format: 'number' },
  { key: 'peso_t', label: 'Peso (t)', format: 'ton' },
  { key: 'mese', label: 'Mese' },
  { key: 'anno', label: 'Anno' },
  { key: 'partner_operativo', label: 'Partner Op.' },
  { key: 'trasportatore', label: 'Trasportatore' },
];

export default function AssegnatiTable({ records, loading }) {
  if (loading) {
    return <div className="flex items-center justify-center py-8 text-muted-foreground">Caricamento ordini assegnati...</div>;
  }
  if (!records || records.length === 0) {
    return <div className="text-center py-8 text-muted-foreground border rounded-lg">Nessun ordine assegnato trovato.</div>;
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