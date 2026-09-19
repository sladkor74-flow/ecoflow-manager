import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, FileText, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';

const STATI = {
  bozza: 'bg-gray-100 text-gray-700',
  elaborata: 'bg-blue-100 text-blue-700',
  verificata: 'bg-green-100 text-green-700',
  approvata: 'bg-purple-100 text-purple-700',
  chiusa: 'bg-emerald-100 text-emerald-700',
};

function Tabella({ docs, onOpen, superati }) {
  return (
    <div className="border rounded-lg overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted"><tr>
          <th className="text-left px-3 py-2 font-semibold">Anno</th>
          <th className="text-left px-3 py-2 font-semibold">Mese</th>
          <th className="text-center px-3 py-2 font-semibold">Stato</th>
          <th className="text-right px-3 py-2 font-semibold">Fornitori</th>
          <th className="text-right px-3 py-2 font-semibold">Voci</th>
          <th className="text-right px-3 py-2 font-semibold">Totale</th>
          <th className="text-left px-3 py-2 font-semibold">Elaborata</th>
          <th className="text-left px-3 py-2 font-semibold">Chiusa</th>
          <th className="text-right px-3 py-2"></th>
        </tr></thead>
        <tbody>
          {docs.map((d, i) => (
            <React.Fragment key={d.id}>
              <tr className={`${i % 2 ? 'bg-muted/30' : ''} ${superati ? 'text-muted-foreground' : ''}`}>
                <td className="px-3 py-2 font-medium">{d.anno}</td>
                <td className="px-3 py-2">{d.mese}</td>
                <td className="text-center px-3 py-2"><span className={`text-xs px-2 py-0.5 rounded ${STATI[d.stato] || ''}`}>{d.stato}</span></td>
                <td className="px-3 py-2 text-right">{d.numero_fornitori || 0}</td>
                <td className="px-3 py-2 text-right">{d.numero_voci || 0}</td>
                <td className="px-3 py-2 text-right font-medium">€ {(d.totale || 0).toFixed(2)}</td>
                <td className="px-3 py-2 text-xs">{d.data_elaborazione ? new Date(d.data_elaborazione).toLocaleDateString('it-IT') : '-'}</td>
                <td className="px-3 py-2 text-xs">{d.data_chiusura ? new Date(d.data_chiusura).toLocaleDateString('it-IT') : '-'}</td>
                <td className="text-right px-3 py-2">
                  <button onClick={() => onOpen(d.anno, d.mese)} className="text-blue-600 hover:underline text-xs">
                    <FileText className="w-4 h-4 inline" /> {superati ? 'Ricalcola' : 'Apri'}
                  </button>
                </td>
              </tr>
              {superati && d.motivo_superato && (
                <tr className={i % 2 ? 'bg-muted/30' : ''}>
                  <td colSpan={9} className="px-3 pb-2 pl-8 text-xs text-muted-foreground italic">{d.motivo_superato}</td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function StoricoFatturazione({ onOpen }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mostraSuperati, setMostraSuperati] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await base44.entities.DocumentoFatturazione.filter({ tipo: 'PASSIVA' }, '-anno,-mese', 100);
        setDocs(data);
      } catch (e) {}
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin inline" /></div>;

  // Un documento superato resta nello storico, col motivo scritto accanto, ma
  // non sta in mezzo a quelli buoni: i suoi importi non fanno piu' testo e
  // affiancati a quelli veri sembrerebbero una contraddizione.
  const validi = docs.filter(d => !d.superato);
  const superati = docs.filter(d => d.superato);

  return (
    <div className="space-y-4">
      {validi.length > 0
        ? <Tabella docs={validi} onOpen={onOpen} superati={false} />
        : (
          <div className="text-center py-8 text-muted-foreground border rounded-lg">
            Nessuna fatturazione passiva archiviata.
            <div className="text-xs mt-1">La passiva di un mese si ottiene dalla scheda «Passiva», che la ricalcola sui dati aggiornati.</div>
          </div>
        )}

      {superati.length > 0 && (
        <div>
          <button
            onClick={() => setMostraSuperati(v => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            {mostraSuperati ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            <AlertTriangle className="w-3.5 h-3.5" />
            {superati.length} document{superati.length === 1 ? 'o superato' : 'i superati'} — importi non piu' validi
          </button>
          {mostraSuperati && <div className="mt-2"><Tabella docs={superati} onOpen={onOpen} superati={true} /></div>}
        </div>
      )}
    </div>
  );
}
