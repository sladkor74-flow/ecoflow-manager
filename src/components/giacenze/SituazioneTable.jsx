import React from 'react';
import { Button } from '@/components/ui/button';

function fmt(n, dec = 2) {
  if (n == null || n === '' || isNaN(n)) return '—';
  return Number(n).toLocaleString('it-IT', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export default function SituazioneTable({ righe, totali, onVaiDaDichiarare }) {
  const maxGiacenza = Math.max(...righe.map(r => r.giacenza_portale_t || 0), 0.01);

  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="px-3 py-2 font-semibold">Sito</th>
              <th className="px-3 py-2 font-semibold">Ruolo</th>
              <th className="px-3 py-2 font-semibold text-right">Giacenza a portale</th>
              <th className="px-3 py-2 font-semibold text-right">Giacenza fisica</th>
              <th className="px-3 py-2 font-semibold text-right">Divergenza</th>
              <th className="px-3 py-2 font-semibold text-right">Ordini da dichiarare</th>
              <th className="px-3 py-2 font-semibold text-right">Dichiarato nell'anno</th>
              <th className="px-3 py-2 font-semibold">Tipologia trattamento</th>
            </tr>
          </thead>
          <tbody>
            {righe.map((r, i) => {
              const barWidth = Math.max((r.giacenza_portale_t / maxGiacenza) * 100, 1);
              return (
                <tr key={i} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2">{r.sito}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      r.tipo_destinazione === 'imp'
                        ? 'bg-primary/15 text-primary'
                        : 'bg-accent/15 text-accent-foreground'
                    }`}>
                      {r.tipo_destinazione === 'imp' ? 'Impianto' : 'Stoccaggio'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="font-bold">{fmt(r.giacenza_portale_t)} t</div>
                    <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${barWidth}%` }} />
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">{fmt(r.giacenza_fisica_t)} t</td>
                  <td className={`px-3 py-2 text-right ${Math.abs(r.divergenza_t) > 0.01 ? 'text-amber-600 font-medium' : ''}`}>{fmt(r.divergenza_t)} t</td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7"
                      onClick={() => onVaiDaDichiarare(r.sito)}
                    >
                      {r.ordini_da_dichiarare || 0}
                    </Button>
                  </td>
                  <td className="px-3 py-2 text-right">{fmt(r.dichiarato_t)} t</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.tipologia_trattamento || '—'}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-muted/50 font-bold border-t-2">
            <tr>
              <td className="px-3 py-2">TOTALE</td>
              <td className="px-3 py-2"></td>
              <td className="px-3 py-2 text-right">{fmt(totali.giacenza_portale_t)} t</td>
              <td className="px-3 py-2 text-right">{fmt(totali.giacenza_fisica_t)} t</td>
              <td className="px-3 py-2 text-right">{fmt(totali.divergenza_t)} t</td>
              <td className="px-3 py-2 text-right">{totali.ordini_da_dichiarare || 0}</td>
              <td className="px-3 py-2 text-right">{fmt(totali.dichiarato_t)} t</td>
              <td className="px-3 py-2"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}