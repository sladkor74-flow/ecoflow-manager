import React from 'react';
import { formatNumber, fmtTon, formatIntero } from '@/lib/utils';
import { useIndiceOmologhe } from '@/lib/omologheIndice';
import BadgeOmologa from '@/components/shared/BadgeOmologa';
import { useIndiceRentri } from '@/lib/rentriIndice';
import BadgeRentri from '@/components/shared/BadgeRentri';

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
  { key: 'peso_stimato', label: 'Peso stimato (kg)', format: 'number' },
  { key: 'peso_t', label: 'Peso (t)', format: 'ton' },
  { key: 'mese', label: 'Mese' },
  { key: 'anno', label: 'Anno' },
  { key: 'partner_operativo', label: 'Partner Op.' },
  { key: 'trasportatore', label: 'Trasportatore' },
];

// L'omologa si mostra subito dopo la ragione sociale: e' li' che si guarda quando
// si programma il ritiro.
const DOPO_COLONNA_OMOLOGA = 'ragione_sociale';

export default function AssegnatiTable({ records, loading, ragioneSocialeFilter, posizioni = null, totaleCoda = 0 }) {
  const indiceOmologhe = useIndiceOmologhe();
  const indiceRentri = useIndiceRentri();
  if (loading) {
    return <div className="flex items-center justify-center py-8 text-muted-foreground">Caricamento ordini assegnati...</div>;
  }
  if (!records || records.length === 0) {
    if (ragioneSocialeFilter && ragioneSocialeFilter.trim()) {
      return <div className="text-center py-8 text-muted-foreground border rounded-lg">Non sono presenti ordini aperti per questo produttore</div>;
    }
    return <div className="text-center py-8 text-muted-foreground border rounded-lg">Nessun ordine assegnato trovato.</div>;
  }

  return (
    <div className="border rounded-lg overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            {posizioni && (
              <th className="text-left px-3 py-2.5 font-medium whitespace-nowrap" title="Posizione in coda e richieste piu' vecchie che la precedono, con i filtri attivi">
                In coda
              </th>
            )}
            {COLUMNS.map((col) => (
              <React.Fragment key={col.key}>
                <th className="text-left px-3 py-2.5 font-medium whitespace-nowrap">{col.label}</th>
                {col.key === DOPO_COLONNA_OMOLOGA && (
                  <>
                    <th className="text-left px-3 py-2.5 font-medium whitespace-nowrap" title="Omologa registrata per il punto di raccolta, con la sua scadenza">Omologa</th>
                    <th className="text-left px-3 py-2.5 font-medium whitespace-nowrap" title="Iscrizione al RENTRI e tipo di formulario del punto di raccolta, dal portale e dalla dichiarazione">RENTRI</th>
                  </>
                )}
              </React.Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} className="border-t hover:bg-muted/50">
              {posizioni && (
                <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                  {posizioni.get(r.id) ? (
                    <>
                      <span className="font-semibold">{formatIntero(posizioni.get(r.id))}ª</span>
                      <span className="text-muted-foreground"> su {formatIntero(totaleCoda)}</span>
                      <span className="block text-xs text-muted-foreground">{formatIntero(posizioni.get(r.id) - 1)} prima</span>
                    </>
                  ) : <span className="text-muted-foreground" title="Fuori dai filtri attivi">—</span>}
                </td>
              )}
              {COLUMNS.map((col) => {
                let val = r[col.key];
                if (col.format === 'number') val = val != null ? formatNumber(val, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '';
                else if (col.format === 'ton') val = val != null ? fmtTon(val) : '';
                else if (col.format === 'date') val = val ? new Date(val).toLocaleDateString('it-IT') : '';
                return (
                  <React.Fragment key={col.key}>
                    <td className="px-3 py-2 whitespace-nowrap">{val ?? ''}</td>
                    {col.key === DOPO_COLONNA_OMOLOGA && (
                      <>
                        <td className="px-3 py-2"><BadgeOmologa indice={indiceOmologhe} idPdr={r.id_pdr} idCliente={r.id_cliente} nome={r.ragione_sociale} /></td>
                        <td className="px-3 py-2"><BadgeRentri indice={indiceRentri} idPdr={r.id_pdr} nome={r.ragione_sociale} /></td>
                      </>
                    )}
                  </React.Fragment>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}