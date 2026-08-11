import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const STATO_COLOR = {
  verificato: 'bg-green-100 text-green-700',
  da_controllare: 'bg-amber-100 text-amber-700',
  errore: 'bg-red-100 text-red-700',
};

export default function RigaDetailModal({ riga, onClose }) {
  return (
    <Dialog open={!!riga} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Dettaglio Riga Fatturazione</DialogTitle></DialogHeader>
        {riga && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Tipologia:</span> <span className="font-medium">{riga.tipologia}</span></div>
              <div><span className="text-muted-foreground">Fatturante:</span> <span className="font-medium">{riga.fatturante || 'N/D'}</span></div>
              <div><span className="text-muted-foreground">Regione:</span> <span className="font-medium">{riga.regione || 'N/D'}</span></div>
              <div><span className="text-muted-foreground">Ordine:</span> <span className="font-medium font-mono">{riga.ordine || 'N/D'}</span></div>
              <div><span className="text-muted-foreground">Numero FIR:</span> <span className="font-medium">{riga.numero_fir || 'N/D'}</span></div>
              <div><span className="text-muted-foreground">Ticket n°:</span> <span className="font-medium">{riga.ticket_n || 'N/D'}</span></div>
              <div><span className="text-muted-foreground">Classe:</span> <span className="font-medium">{riga.classe || 'N/D'}</span></div>
              <div><span className="text-muted-foreground">EER:</span> <span className="font-medium">{riga.eer_codice || 'N/D'}</span></div>
              <div><span className="text-muted-foreground">Data fine trasporto:</span> <span className="font-medium">{riga.data_fine_trasporto ? new Date(riga.data_fine_trasporto).toLocaleDateString('it-IT') : 'N/D'}</span></div>
              <div><span className="text-muted-foreground">Origine dato:</span> <span className="font-medium">{riga.origine_dato}</span></div>
            </div>
            <div className="border-t pt-3">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div><span className="text-muted-foreground block text-xs">Quantità</span><span className="font-bold">{riga.quantita?.toFixed(2)} {riga.unita_quantita || 'kg'}</span></div>
                <div><span className="text-muted-foreground block text-xs">Prezzo unitario</span><span className="font-bold">€ {riga.tariffa_valore?.toFixed(4)} {riga.unita_misura}</span></div>
                <div><span className="text-muted-foreground block text-xs">Totale</span><span className="font-bold text-lg">€ {riga.totale?.toFixed(2)}</span></div>
              </div>
            </div>
            <div className="border-t pt-3">
              <div className="text-sm text-muted-foreground mb-1">Formula applicata:</div>
              <div className="text-sm font-mono bg-muted p-2 rounded">
                {riga.unita_misura === '€/kg'
                  ? `${riga.quantita?.toFixed(2)} kg × € ${riga.tariffa_valore?.toFixed(4)}/kg = € ${riga.totale?.toFixed(2)}`
                  : `${riga.quantita?.toFixed(2)} kg ÷ 1000 × € ${riga.tariffa_valore?.toFixed(4)}/ton = € ${riga.totale?.toFixed(2)}`}
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Record sorgente: <span className="font-mono">{riga.origine_record_id || 'N/D'}</span>
            </div>
            {riga.sospesa && (
              <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded">
                ⚠ Sospesa: {riga.motivo_sospensione || 'Motivo non specificato'}
              </div>
            )}
            <div className="flex items-center justify-between border-t pt-3">
              <span className={`text-xs px-2 py-1 rounded ${STATO_COLOR[riga.stato_validazione] || ''}`}>{riga.stato_validazione}</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}