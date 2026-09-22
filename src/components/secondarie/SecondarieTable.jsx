import React from 'react';
import { useTableSort } from '@/hooks/useTableSort';
import SortHeader from '@/components/shared/SortHeader';
import { formatNumber, fmtTon } from '@/lib/utils';
import { giornoRoma } from '@/lib/giornoItaliano';
import { SegnoDate } from '@/components/primarie-rete/DateDaSistemare';

// giorno_ordine, fine_trasporto, mese e settimana li prepara la pagina
// (Secondarie.jsx) dalla fine del trasporto, con la stessa regola della matrice:
// i campi mese e settimane salvati sul record possono venire da importazioni
// vecchie, quando il riferimento era la chiusura a portale.
const COLUMNS = [
  { key: 'id_ordine', label: 'ID Ordine' },
  { key: 'stato', label: 'Stato' },
  { key: 'fine_trasporto', label: 'Fine trasporto', format: 'date' },
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
  { key: 'settimana', label: 'Sett.' },
  { key: 'trasportatore', label: 'Trasportatore' },
  { key: 'partner_operativo', label: 'Partner Op.' },
  { key: 'fatturato_trasporto', label: 'Fatt. Trasporto' },
  { key: 'fatturato_riciclo', label: 'Fatt. Riciclo' },
  { key: 'numero_fir', label: 'FIR' },
  // la chiusura a portale si mostra soltanto: non ordina, non filtra e non
  // colloca niente
  { key: 'ordine_chiuso_il', label: 'Chiuso il', format: 'date' },
];

// Le date si mostrano come giorno italiano, 'GG/MM/AAAA'.
const dataIt = (v) => { const g = giornoRoma(v); return g ? `${g.slice(8, 10)}/${g.slice(5, 7)}/${g.slice(0, 4)}` : ''; };

// Un terminato senza fine trasporto non ha mese ne' settimana: si scrive, invece
// di collocarlo all'immissione (la pagina lo marca con senza_fine_trasporto).
// Ogni terminato con una data obbligatoria che manca o non torna ha il segno
// accanto all'ID, col dettaglio nel title: la pagina lo prepara in
// date_da_sistemare con testoDate (regola dell'utente, 22/09/2026).
const SENZA_FINE = 'MANCA FINE TRASPORTO';

export default function SecondarieTable({ records, loading, emptyMessage }) {
  // Si apre sui piu' recenti per fine trasporto (per chi non l'ha, per
  // immissione), come le tabelle delle primarie: ordinata per chiusura, un
  // viaggio di ieri non ancora chiuso a portale finiva in fondo.
  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(records || [], 'giorno_ordine', 'desc');

  if (loading) {
    return <div className="flex items-center justify-center py-8 text-muted-foreground">Caricamento trasporti secondari...</div>;
  }
  if (!records || records.length === 0) {
    return <div className="text-center py-8 text-muted-foreground border rounded-lg">{emptyMessage || 'Nessun trasporto secondario trovato.'}</div>;
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
            <tr key={r.id} className={`border-t hover:bg-muted/50 ${r.date_da_sistemare ? 'bg-amber-50/60' : ''}`}>
              {COLUMNS.map((col) => {
                let val = r[col.key];
                if (col.format === 'number') val = val != null ? formatNumber(val, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '';
                else if (col.format === 'ton') val = val != null ? fmtTon(val) : '';
                else if (col.format === 'date') val = dataIt(val);
                if (col.key === 'mese' && r.senza_fine_trasporto) val = SENZA_FINE;
                return (
                  <td key={col.key} className={`px-3 py-2 whitespace-nowrap ${val === SENZA_FINE ? 'text-amber-600 font-medium' : ''}`}>
                    {col.key === 'id_ordine' && <SegnoDate testo={r.date_da_sistemare || ''} />}
                    {val ?? ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
