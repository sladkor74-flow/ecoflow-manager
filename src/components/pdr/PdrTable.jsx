import React from 'react';
import { Loader2, MapPin } from 'lucide-react';

export default function PdrTable({ records, loading }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Caricamento elenco PDR...
      </div>
    );
  }
  if (records.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border rounded-lg">
        <MapPin className="w-8 h-8 mx-auto mb-2 opacity-40" />
        Nessun PDR trovato.
      </div>
    );
  }
  return (
    <div className="border rounded-lg overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="text-left px-3 py-2.5 font-medium">Cod. Esterno</th>
            <th className="text-left px-3 py-2.5 font-medium">Ragione Sociale</th>
            <th className="text-left px-3 py-2.5 font-medium">Comune</th>
            <th className="text-left px-3 py-2.5 font-medium">Prov.</th>
            <th className="text-left px-3 py-2.5 font-medium">Cod. Fiscale</th>
            <th className="text-left px-3 py-2.5 font-medium">Partita IVA</th>
            <th className="text-left px-3 py-2.5 font-medium">Cod. Import</th>
            <th className="text-left px-3 py-2.5 font-medium">Trasportatore</th>
            <th className="text-left px-3 py-2.5 font-medium">Key Account</th>
            <th className="text-left px-3 py-2.5 font-medium">Partner</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} className="border-t hover:bg-muted/50">
              <td className="px-3 py-2 font-mono text-xs">{r.codice_esterno || '—'}</td>
              <td className="px-3 py-2 font-medium">{r.ragione_sociale || '—'}</td>
              <td className="px-3 py-2">{r.comune || '—'}</td>
              <td className="px-3 py-2">{r.provincia || '—'}</td>
              <td className="px-3 py-2 font-mono text-xs">{r.codice_fiscale || '—'}</td>
              <td className="px-3 py-2 font-mono text-xs">{r.partita_iva || '—'}</td>
              <td className="px-3 py-2">{r.codice_import || '—'}</td>
              <td className="px-3 py-2">{r.trasportatore_principale || '—'}</td>
              <td className="px-3 py-2">{r.key_account || '—'}</td>
              <td className="px-3 py-2">{r.partner_operativo || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}