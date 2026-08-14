import React from 'react';
import { X, FileText } from 'lucide-react';
import { formatNumber } from '@/lib/utils';

// Modale di dettaglio che mostra lo schema analitico (Colonne I:M del file Excel):
// Mese | Totale [t] | Costo di Raccolta [€/t] | EER | TOTALE
export default function RigaDetailModalRete({ riga, mese, anno, onClose }) {
  if (!riga) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-card z-10">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h3 className="font-heading font-semibold text-lg">Dettaglio Fatturazione — {riga.trasportatore}</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="border rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Regione</p>
              <p className="font-semibold">{riga.regione}</p>
            </div>
            <div className="border rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Metodo</p>
              <p className="font-semibold">{riga.unita_misura || 'N/D'}</p>
            </div>
            <div className="border rounded-lg p-3">
              <p className="text-xs text-muted-foreground">N° Viaggi</p>
              <p className="font-semibold">{riga.num_viaggi}</p>
            </div>
            <div className="border rounded-lg p-3">
              <p className="text-xs text-muted-foreground">N° FIR</p>
              <p className="font-semibold">{riga.firCount || 0}</p>
            </div>
            <div className="border rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Classi</p>
              <p className="font-semibold">{riga.classi || '-'}</p>
            </div>
          </div>

          {/* Schema analitico I:M */}
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left px-3 py-2 font-heading font-semibold">Mese</th>
                  <th className="text-right px-3 py-2 font-heading font-semibold">Totale [t]</th>
                  <th className="text-right px-3 py-2 font-heading font-semibold">Costo di Raccolta</th>
                  <th className="text-left px-3 py-2 font-heading font-semibold">EER</th>
                  <th className="text-right px-3 py-2 font-heading font-semibold">TOTALE [€]</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-3 py-2 font-medium">{mese} {anno}</td>
                  <td className="px-3 py-2 text-right">{formatNumber(riga.totale_t)}</td>
                  <td className="px-3 py-2 text-right">
                    {riga.tariffa_valore ? `${formatNumber(riga.tariffa_valore, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${riga.unita_misura}` : 'N/D'}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{riga.eer || '-'}</td>
                  <td className="px-3 py-2 text-right font-bold text-primary">{formatNumber(riga.totale_euro, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {!riga.has_tariffa && (
            <div className="border border-amber-300 bg-amber-50 rounded-lg p-3 text-sm text-amber-800">
              ⚠ Nessuna tariffa configurata per questo fornitore/regione. Configurare una tariffa nella tab "Gestione Tariffe" per calcolare il totale.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}