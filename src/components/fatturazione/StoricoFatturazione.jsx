import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, FileText } from 'lucide-react';

const STATI = {
  bozza: 'bg-gray-100 text-gray-700',
  elaborata: 'bg-blue-100 text-blue-700',
  verificata: 'bg-green-100 text-green-700',
  approvata: 'bg-purple-100 text-purple-700',
  chiusa: 'bg-emerald-100 text-emerald-700',
};

export default function StoricoFatturazione({ onOpen }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);

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
  if (docs.length === 0) return <div className="text-center py-8 text-muted-foreground border rounded-lg">Nessuna fatturazione elaborata.</div>;

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
            <tr key={d.id} className={i % 2 ? 'bg-muted/30' : ''}>
              <td className="px-3 py-2 font-medium">{d.anno}</td>
              <td className="px-3 py-2">{d.mese}</td>
              <td className="text-center px-3 py-2"><span className={`text-xs px-2 py-0.5 rounded ${STATI[d.stato] || ''}`}>{d.stato}</span></td>
              <td className="px-3 py-2 text-right">{d.numero_fornitori || 0}</td>
              <td className="px-3 py-2 text-right">{d.numero_voci || 0}</td>
              <td className="px-3 py-2 text-right font-medium">€ {(d.totale || 0).toFixed(2)}</td>
              <td className="px-3 py-2 text-xs">{d.data_elaborazione ? new Date(d.data_elaborazione).toLocaleDateString('it-IT') : '-'}</td>
              <td className="px-3 py-2 text-xs">{d.data_chiusura ? new Date(d.data_chiusura).toLocaleDateString('it-IT') : '-'}</td>
              <td className="text-right px-3 py-2"><button onClick={() => onOpen(d.anno, d.mese)} className="text-blue-600 hover:underline text-xs"><FileText className="w-4 h-4 inline" /> Apri</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}