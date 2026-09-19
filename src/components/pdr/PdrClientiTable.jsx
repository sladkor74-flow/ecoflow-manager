import React, { useState, useMemo } from 'react';
import { Loader2, Users, ChevronDown, ChevronRight } from 'lucide-react';

export default function PdrClientiTable({ records, loading }) {
  const [expanded, setExpanded] = useState(null);

  const gruppi = useMemo(() => {
    const map = {};
    for (const r of records) {
      const key = r.id_cliente;
      if (!map[key]) {
        map[key] = {
          id_cliente: key,
          ragione_sociale: r.ragione_sociale || '—',
          partita_iva: r.partita_iva || '—',
          comune: r.comune || '—',
          provincia: r.provincia || '—',
          trasportatore_principale: r.trasportatore_principale || '—',
          pdr: [],
        };
      }
      map[key].pdr.push(r);
    }
    return Object.values(map).sort((a, b) => (a.ragione_sociale || '').localeCompare(b.ragione_sociale || ''));
  }, [records]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Caricamento elenco clienti...
      </div>
    );
  }
  if (gruppi.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border rounded-lg">
        <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
        Nessun cliente trovato.
      </div>
    );
  }

  const toggle = (key) => setExpanded(prev => prev === key ? null : key);

  return (
    <div className="border rounded-lg overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="text-left px-3 py-2.5 font-medium w-8"></th>
            <th className="text-left px-3 py-2.5 font-medium">Ragione Sociale</th>
            <th className="text-left px-3 py-2.5 font-medium">Partita IVA</th>
            <th className="text-left px-3 py-2.5 font-medium">Comune sede</th>
            <th className="text-left px-3 py-2.5 font-medium">Provincia</th>
            <th className="text-right px-3 py-2.5 font-medium">N. PDR</th>
            <th className="text-left px-3 py-2.5 font-medium">Trasportatore principale</th>
          </tr>
        </thead>
        <tbody>
          {gruppi.map((g) => (
            <React.Fragment key={g.id_cliente}>
              <tr
                className="border-t hover:bg-muted/50 cursor-pointer"
                onClick={() => toggle(g.id_cliente)}
              >
                <td className="px-3 py-2">
                  {expanded === g.id_cliente
                    ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </td>
                <td className="px-3 py-2 font-medium">{g.ragione_sociale}</td>
                <td className="px-3 py-2 font-mono text-xs">{g.partita_iva}</td>
                <td className="px-3 py-2">{g.comune}</td>
                <td className="px-3 py-2">{g.provincia}</td>
                <td className="px-3 py-2 text-right font-semibold">{g.pdr.length}</td>
                <td className="px-3 py-2">{g.trasportatore_principale}</td>
              </tr>
              {expanded === g.id_cliente && (
                <tr className="bg-muted/20">
                  <td></td>
                  <td colSpan={6} className="px-3 py-3">
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left px-2 py-1.5 font-medium">Descrizione</th>
                            <th className="text-left px-2 py-1.5 font-medium">Indirizzo</th>
                            <th className="text-left px-2 py-1.5 font-medium">Comune</th>
                            <th className="text-left px-2 py-1.5 font-medium">Prov.</th>
                            <th className="text-left px-2 py-1.5 font-medium">Stato</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.pdr.map((p) => {
                            const isSospeso = !!(p.sospeso && String(p.sospeso).trim() !== '');
                            return (
                              <tr key={p.id} className="border-t">
                                <td className="px-2 py-1.5">{p.descrizione_pdr || '—'}</td>
                                <td className="px-2 py-1.5">{p.indirizzo_pdr || '—'}</td>
                                <td className="px-2 py-1.5">{p.comune_pdr || '—'}</td>
                                <td className="px-2 py-1.5">{p.provincia_pdr || '—'}</td>
                                <td className="px-2 py-1.5">
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${isSospeso ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                    {isSospeso ? 'Sospeso' : 'Attivo'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}