import React from 'react';
import { AlertTriangle } from 'lucide-react';

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

export default function ProvinceMatrix({ data }) {
  if (!data) return null;

  const { by_regione, province_with_zeros, current_month, current_year } = data;
  const regioni = Object.keys(by_regione || {}).sort();

  return (
    <div className="space-y-4">
      {/* Warning banner for provinces with 2 consecutive zeros */}
      {province_with_zeros && province_with_zeros.length > 0 && (
        <div className="border border-amber-300 bg-amber-50 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h3 className="font-heading font-semibold text-amber-900">
              {province_with_zeros.length} provincia/e con 2 mesi consecutivi a zero
            </h3>
            <p className="text-sm text-amber-800 mt-1">
              Pianificare raccolte nel terzo mese per rispettare i requisiti consorziali.
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {province_with_zeros.map(p => (
                <span key={p.provincia} className="text-xs px-2 py-0.5 rounded bg-amber-200 text-amber-900 font-medium">
                  {p.provincia} ({p.regione})
                  {p.last_zero_pair && ` — ${p.last_zero_pair.start}+${p.last_zero_pair.end}`}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="text-sm text-muted-foreground">
        Anno {current_year} — mese corrente: {current_month}. Le celle rosse indicano 0 FIR nel mese (mese già trascorso).
      </div>

      {/* Matrix table */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-3 py-2 font-heading font-semibold sticky left-0 bg-muted">Regione</th>
              <th className="text-left px-3 py-2 font-heading font-semibold sticky left-0 bg-muted">Provincia</th>
              <th className="text-right px-3 py-2 font-heading font-semibold">Totale FIR</th>
              {MESI.map(m => (
                <th key={m} className="text-center px-2 py-2 font-heading font-semibold whitespace-nowrap text-xs">
                  {m.substring(0, 3)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {regioni.length === 0 && (
              <tr>
                <td colSpan={15} className="text-center py-8 text-muted-foreground">
                  Nessun dato disponibile. Carica i file delle Primarie Rete per popolare la matrice.
                </td>
              </tr>
            )}
            {regioni.map(regione => (
              <React.Fragment key={regione}>
                {by_regione[regione].map((p, idx) => (
                  <tr key={p.provincia} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                    {idx === 0 ? (
                      <td className="px-3 py-2 font-medium align-top border-r" rowSpan={by_regione[regione].length}>
                        {regione}
                      </td>
                    ) : null}
                    <td className="px-3 py-2 border-r">
                      <span className="font-medium">{p.provincia}</span>
                      {p.has_2_consecutive_zeros && (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 inline ml-1.5" />
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">{p.fir_total}</td>
                    {p.mesiValues.map(mv => (
                      <td
                        key={mv.mese}
                        className={`text-center px-2 py-2 ${
                          mv.count === 0 && mv.passed
                            ? 'bg-red-100 text-red-700 font-medium'
                            : mv.count > 0
                            ? ''
                            : 'text-muted-foreground/40'
                        }`}
                      >
                        {mv.count > 0 ? mv.count : mv.passed ? '0' : '–'}
                      </td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}