import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { formatNumber } from '@/lib/utils';

export default function DrillDownModal({ open, onClose, title, loading, records, total }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">{title}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Caricamento dettaglio...
          </div>
        ) : records.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">Nessun record trovato</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-2">
              {records.length} di {total} record{total > records.length ? ' (primi 100)' : ''}
            </p>
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-left">ID Ordine</th>
                    <th className="px-2 py-2 text-left">Stato</th>
                    <th className="px-2 py-2 text-left">Ragione Sociale</th>
                    <th className="px-2 py-2 text-left">Comune</th>
                    <th className="px-2 py-2 text-left">Prov.</th>
                    <th className="px-2 py-2 text-left">Classe</th>
                    <th className="px-2 py-2 text-right">Peso Eff. [kg]</th>
                    <th className="px-2 py-2 text-left">N. FIR</th>
                    <th className="px-2 py-2 text-left">Data Chiusura</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => (
                    <tr key={i} className="border-t hover:bg-muted/30">
                      <td className="px-2 py-1.5 font-mono">{r.id_ordine}</td>
                      <td className="px-2 py-1.5">{r.stato}</td>
                      <td className="px-2 py-1.5 max-w-[200px] truncate" title={r.ragione_sociale}>{r.ragione_sociale}</td>
                      <td className="px-2 py-1.5">{r.comune}</td>
                      <td className="px-2 py-1.5">{r.provincia}</td>
                      <td className="px-2 py-1.5">{r.classe}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{r.peso_effettivo != null ? formatNumber(r.peso_effettivo, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '—'}</td>
                      <td className="px-2 py-1.5 font-mono">{r.numero_fir}</td>
                      <td className="px-2 py-1.5">{r.ordine_chiuso_il ? new Date(r.ordine_chiuso_il).toLocaleDateString('it-IT') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}