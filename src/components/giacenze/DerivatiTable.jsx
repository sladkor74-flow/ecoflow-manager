import React from 'react';

function fmt(n) {
  if (n == null || n === '' || isNaN(n)) return '—';
  return Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(val, tot) {
  if (!tot || tot === 0) return null;
  return (val / tot * 100);
}

function fmtPct(p) {
  if (p == null) return '';
  return Number(p).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
}

const COLS = [
  { key: 'granulo_t', label: 'Granulo' },
  { key: 'fibre_t', label: 'Fibre' },
  { key: 'metallo_t', label: 'Metallo' },
  { key: 'cippato_t', label: 'Cippato' },
  { key: 'ciabattato_t', label: 'Ciabattato' },
];

export default function DerivatiTable({ righe, totali }) {
  return (
    <div className="space-y-2">
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-3 py-2 font-semibold">Sito</th>
                <th className="px-3 py-2 font-semibold text-right">Dichiarato</th>
                {COLS.map(c => (
                  <th key={c.key} className="px-3 py-2 font-semibold text-right">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {righe.filter(r => r.dichiarato_t > 0).map((r, i) => {
                const tot = r.dichiarato_t;
                return (
                  <tr key={i} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 align-top">{r.sito}</td>
                    <td className="px-3 py-2 text-right align-top font-medium">{fmt(tot)} t</td>
                    {COLS.map(c => {
                      const v = r[c.key] || 0;
                      const p = pct(v, tot);
                      return (
                        <td key={c.key} className="px-3 py-2 text-right align-top">
                          <div className="font-medium">{fmt(v)} t</div>
                          {p != null && <div className="text-[10px] text-muted-foreground">{fmtPct(p)}</div>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {righe.filter(r => r.dichiarato_t > 0).length === 0 && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Nessun dichiarato nell'anno</td></tr>
              )}
            </tbody>
            <tfoot className="bg-muted/50 font-bold border-t-2">
              <tr>
                <td className="px-3 py-2">TOTALE</td>
                <td className="px-3 py-2 text-right">{fmt(totali.dichiarato_t)} t</td>
                {COLS.map(c => (
                  <td key={c.key} className="px-3 py-2 text-right">{fmt(totali[c.key])} t</td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed max-w-4xl">
        Il granulo è materia prima secondaria, end of waste, e viaggia con documento di trasporto anziché con formulario.
        Cippato e ciabattato sono recupero R12 con codice EER 19.12.04. Il metallo separato dal cippato ha codice EER 19.12.02.
      </p>
    </div>
  );
}