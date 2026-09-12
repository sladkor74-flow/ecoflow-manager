import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatNumber } from '@/lib/utils';

function sameKey(a, b) {
  const norm = v => String(v || '').trim().toUpperCase();
  const campi = ['fornitore_id', 'direzione', 'tipologia', 'prestazione', 'classe_materiale', 'provincia', 'regione', 'destinazione', 'produttore', 'destinatario'];
  for (const c of campi) { if (norm(a[c]) !== norm(b[c])) return false; }
  return true;
}

export default function TariffeStorico({ tariffa, tariffe, onClose }) {
  if (!tariffa) return null;
  const storico = tariffe
    .filter(t => sameKey(t, tariffa))
    .sort((a, b) => new Date(b.data_inizio_validita || 0) - new Date(a.data_inizio_validita || 0));
  const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
  const inVigore = t => {
    const i = t.data_inizio_validita ? new Date(t.data_inizio_validita) : null;
    const f = t.data_fine_validita ? new Date(t.data_fine_validita) : null;
    if (i && oggi < i) return false;
    if (f && oggi > f) return false;
    return true;
  };
  return (
    <Dialog open={!!tariffa} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Storico prezzi — {tariffa.fornitore_nome || ''} · {tariffa.prestazione || '?'}</DialogTitle>
        </DialogHeader>
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Periodo</th>
                <th className="text-right px-3 py-2 font-semibold">Valore</th>
                <th className="text-left px-3 py-2 font-semibold">Unità</th>
                <th className="text-left px-3 py-2 font-semibold">Note</th>
              </tr>
            </thead>
            <tbody>
              {storico.map((t, i) => (
                <tr key={t.id} className={i % 2 ? 'bg-muted/30' : ''}>
                  <td className="px-3 py-2">
                    {t.data_inizio_validita ? new Date(t.data_inizio_validita).toLocaleDateString('it-IT') : 'n.d.'}
                    {' → '}
                    {t.data_fine_validita ? new Date(t.data_fine_validita).toLocaleDateString('it-IT') : 'aperto'}
                    {inVigore(t) && <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-success/10 text-success font-medium">in vigore</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">{formatNumber(t.valore, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-3 py-2">{t.unita_misura}</td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">{t.note || '—'}</td>
                </tr>
              ))}
              {storico.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">Nessuno storico.</td></tr>}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}