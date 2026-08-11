import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const STATO_COLOR = {
  verificato: 'bg-green-100 text-green-700',
  da_controllare: 'bg-amber-100 text-amber-700',
  errore: 'bg-red-100 text-red-700',
};

export default function VoceDetailModal({ voce, onClose }) {
  return (
    <Dialog open={!!voce} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Dettaglio Voce</DialogTitle></DialogHeader>
        {voce && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Fornitore:</span> <span className="font-medium">{voce.fornitore_nome}</span></div>
              <div><span className="text-muted-foreground">Servizio:</span> <span className="font-medium">{voce.servizio_nome}</span></div>
              <div><span className="text-muted-foreground">Quantità:</span> <span className="font-medium">{voce.quantita?.toFixed(2)} {voce.unita_misura?.replace('€/', '')}</span></div>
              <div><span className="text-muted-foreground">Tariffa:</span> <span className="font-medium">€ {voce.tariffa_valore?.toFixed(2)}/{voce.unita_misura?.replace('€/', '')}</span></div>
              <div><span className="text-muted-foreground">EER:</span> <span className="font-medium">{voce.eer_codice || 'N/D'}</span></div>
              <div><span className="text-muted-foreground">Classe:</span> <span className="font-medium">{voce.classe || 'N/D'}</span></div>
              <div><span className="text-muted-foreground">Origine:</span> <span className="font-medium">{voce.origine_dato}</span></div>
              <div><span className="text-muted-foreground">Record sorgente:</span> <span className="font-medium">{voce.record_count || 0}</span></div>
            </div>
            <div className="border-t pt-3">
              <div className="text-sm text-muted-foreground mb-1">Formula applicata:</div>
              <div className="text-sm font-mono bg-muted p-2 rounded">
                Totale = {voce.quantita?.toFixed(2)} × € {voce.tariffa_valore?.toFixed(2)} = € {voce.totale?.toFixed(2)}
              </div>
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <span className={`text-xs px-2 py-1 rounded ${STATO_COLOR[voce.stato_validazione] || ''}`}>{voce.stato_validazione}</span>
              <span className="text-lg font-bold">€ {voce.totale?.toFixed(2)}</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}