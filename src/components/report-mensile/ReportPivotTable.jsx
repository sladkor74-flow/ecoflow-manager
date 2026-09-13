import React, { useState, useMemo, useEffect } from 'react';
import { ChevronRight, ChevronDown, Maximize2, Minimize2 } from 'lucide-react';
import { formatNumber } from '@/lib/utils';

// Resa di una pivot del Report Mensile.
//
// Le righe sono un albero: si apre il primo livello e si lasciano chiusi gli
// altri, perche' una pivot a tre livelli tutta aperta e' illeggibile. I due
// comandi in alto aprono e chiudono l'intera gerarchia.

function appiattisci(nodo, espansi, chiavePadre = '', livello = 0) {
  const out = [];
  if (!nodo.figli) return out;
  for (const f of nodo.figli) {
    const chiave = chiavePadre ? chiavePadre + ' › ' + f.etichetta : f.etichetta;
    out.push({ nodo: f, chiave, livello });
    if (f.figli && f.figli.length > 0 && espansi.has(chiave)) {
      out.push(...appiattisci(f, espansi, chiave, livello + 1));
    }
  }
  return out;
}

function tutteLeChiavi(nodo, chiavePadre = '', acc = []) {
  if (!nodo.figli) return acc;
  for (const f of nodo.figli) {
    const chiave = chiavePadre ? chiavePadre + ' › ' + f.etichetta : f.etichetta;
    if (f.figli && f.figli.length > 0) { acc.push(chiave); tutteLeChiavi(f, chiave, acc); }
  }
  return acc;
}

function Numero({ valore, misura }) {
  if (valore == null || valore === 0) return <span className="text-muted-foreground/30">—</span>;
  const opts = misura === 'conteggio'
    ? { minimumFractionDigits: 0, maximumFractionDigits: 0 }
    : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  return <>{formatNumber(valore, opts)}</>;
}

export default function ReportPivotTable({ pivot, periodo }) {
  const [espansi, setEspansi] = useState(new Set());

  useEffect(() => {
    setEspansi(new Set());
  }, [pivot]);

  const righe = useMemo(() => (pivot ? appiattisci(pivot.radice, espansi) : []), [pivot, espansi]);

  if (!pivot) return null;

  const vuota = !pivot.radice.figli || pivot.radice.figli.length === 0;
  const colonne = pivot.senzaColonne ? [] : pivot.colonne;
  const misure = pivot.misure;
  const etichette = pivot.etichetteMisure;
  const unaMisura = misure.length === 1;

  const apriTutto = () => setEspansi(new Set(tutteLeChiavi(pivot.radice)));
  const chiudiTutto = () => setEspansi(new Set());
  const commuta = (k) => setEspansi(prev => {
    const next = new Set(prev);
    next.has(k) ? next.delete(k) : next.add(k);
    return next;
  });

  const haLivelli = pivot.etichetteRiga.length > 1;

  return (
    <section className="space-y-2">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-heading font-semibold flex items-center gap-2">
            {pivot.titolo}
            <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {periodo}
            </span>
          </h3>
          <p className="text-sm text-muted-foreground">{pivot.nota}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {pivot.etichetteRiga.join(' › ')}
            {pivot.etichettaColonna ? ' per ' + pivot.etichettaColonna.toLowerCase() : ''}
            {' · '}{formatNumber(pivot.righeLette, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ordini
          </p>
        </div>
        {haLivelli && !vuota && (
          <div className="flex gap-1 shrink-0">
            <button onClick={apriTutto} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border hover:bg-muted">
              <Maximize2 className="w-3 h-3" /> Espandi
            </button>
            <button onClick={chiudiTutto} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border hover:bg-muted">
              <Minimize2 className="w-3 h-3" /> Comprimi
            </button>
          </div>
        )}
      </div>

      {vuota ? (
        <div className="border rounded-lg px-4 py-6 text-center text-sm text-muted-foreground">
          Nessun dato per il periodo selezionato.
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-muted/60">
              <tr>
                <th className="px-3 py-2 text-left font-semibold sticky left-0 bg-muted/60 min-w-[220px]">
                  {pivot.etichetteRiga[0]}
                </th>
                {colonne.map(col => misure.map((m, i) => (
                  <th key={col + m} className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                    {unaMisura ? col : col + ' · ' + etichette[i]}
                  </th>
                )))}
                {misure.map((m, i) => (
                  <th key={'tot' + m} className="px-3 py-2 text-right font-semibold whitespace-nowrap bg-muted">
                    {pivot.senzaColonne ? etichette[i] : 'Totale' + (unaMisura ? '' : ' ' + etichette[i])}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {righe.map((r) => {
                const apribile = r.nodo.figli && r.nodo.figli.length > 0;
                const aperto = espansi.has(r.chiave);
                return (
                  <tr key={r.chiave} className={`border-t hover:bg-muted/30 ${r.livello === 0 ? 'font-medium' : ''}`}>
                    <td
                      className="px-3 py-1.5 sticky left-0 bg-card"
                      style={{ paddingLeft: `${r.livello * 18 + 12}px` }}
                    >
                      {apribile ? (
                        <button onClick={() => commuta(r.chiave)} className="inline-flex items-center gap-1 text-left hover:text-primary">
                          {aperto ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                          {r.nodo.etichetta}
                        </button>
                      ) : (
                        <span className="pl-[18px] inline-block text-muted-foreground">{r.nodo.etichetta}</span>
                      )}
                    </td>
                    {colonne.map(col => misure.map(m => (
                      <td key={col + m} className="px-3 py-1.5 text-right tabular-nums">
                        <Numero valore={r.nodo.valori[col] ? r.nodo.valori[col][m] : 0} misura={m} />
                      </td>
                    )))}
                    {misure.map(m => (
                      <td key={'tot' + m} className="px-3 py-1.5 text-right tabular-nums font-medium bg-muted/30">
                        <Numero valore={r.nodo.totali[m]} misura={m} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-muted/60 font-bold border-t-2">
              <tr>
                <td className="px-3 py-2 sticky left-0 bg-muted/60">Totale complessivo</td>
                {colonne.map(col => misure.map(m => (
                  <td key={col + m} className="px-3 py-2 text-right tabular-nums">
                    <Numero valore={pivot.radice.valori[col] ? pivot.radice.valori[col][m] : 0} misura={m} />
                  </td>
                )))}
                {misure.map(m => (
                  <td key={'tot' + m} className="px-3 py-2 text-right tabular-nums bg-muted">
                    <Numero valore={pivot.radice.totali[m]} misura={m} />
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
