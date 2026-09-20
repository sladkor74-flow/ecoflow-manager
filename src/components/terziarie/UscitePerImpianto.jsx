import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Warehouse, ArrowRight } from 'lucide-react';
import { formatTonnellate, formatIntero } from '@/lib/utils';

const MATERIALI = ['PFU SFUSO', 'CIAB/CIPP', 'FERRO'];

// Le uscite di prodotti per impianto, dai trasporti terziari filtrati nella pagina.
// Qui prima c'era una "giacenza in tempo reale" fatta di ingressi meno uscite:
// sommava rete e ACI, non guardava lo stato, e toglieva alle tonnellate di PFU
// entrate le uscite di prodotti (granulo, ferro), che sono un'altra cosa. La
// giacenza vera e' quella del modulo Giacenze, che parte dal saldo del portale.
export default function UscitePerImpianto({ records, loading }) {
  const righe = useMemo(() => {
    const per = new Map();
    for (const r of records || []) {
      const imp = (r.unita_locale_origine || '').trim() || '(senza impianto)';
      if (!per.has(imp)) per.set(imp, { impianto: imp, spedizioni: 0, totale: 0, materiali: {} });
      const e = per.get(imp);
      e.spedizioni += 1;
      e.totale += r.peso_t || 0;
      e.materiali[r.materiale] = (e.materiali[r.materiale] || 0) + (r.peso_t || 0);
    }
    return [...per.values()].sort((a, b) => b.totale - a.totale);
  }, [records]);

  if (loading) return <div className="flex items-center justify-center py-8 text-muted-foreground">Caricamento...</div>;

  return (
    <div className="space-y-2">
      {righe.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border rounded-lg">Nessun trasporto terziario con questi filtri.</div>
      ) : (
        <div className="border rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-4 py-3 font-medium"><span className="inline-flex items-center gap-1.5"><Warehouse className="w-4 h-4" /> Impianto</span></th>
                {MATERIALI.map(m => <th key={m} className="text-right px-4 py-3 font-medium">{m} [t]</th>)}
                <th className="text-right px-4 py-3 font-medium">Totale uscito [t]</th>
                <th className="text-right px-4 py-3 font-medium">Spedizioni</th>
              </tr>
            </thead>
            <tbody>
              {righe.map(g => (
                <tr key={g.impianto} className="border-t hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium">{g.impianto}</td>
                  {MATERIALI.map(m => <td key={m} className="px-4 py-3 text-right tabular-nums">{g.materiali[m] ? formatTonnellate(g.materiali[m]) : '—'}</td>)}
                  <td className="px-4 py-3 text-right font-bold tabular-nums">{formatTonnellate(g.totale)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">{formatIntero(g.spedizioni)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Le giacenze di impianti e stoccaggi stanno nel modulo{' '}
        <Link to="/giacenze" className="text-primary hover:underline inline-flex items-center gap-0.5">Giacenze <ArrowRight className="w-3 h-3" /></Link>,
        che parte dal saldo del portale: un bilancio fra PFU entrati e prodotti usciti non è una giacenza.
      </p>
    </div>
  );
}
