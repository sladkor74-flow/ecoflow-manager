import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import RigaDetailModal from './RigaDetailModal';

const TIPS = [
  { key: 'RETE', label: 'Rete' },
  { key: 'ACI', label: 'ACI' },
  { key: 'EXTRA_RACCOLTA', label: 'Extra' },
];

export default function AttivaDetail({ data, loading }) {
  const [subTab, setSubTab] = useState('RETE');
  const [selectedRiga, setSelectedRiga] = useState(null);

  if (loading) return <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin inline" /></div>;

  const allRighe = [...(data.RETE?.righe || []), ...(data.ACI?.righe || []), ...(data.EXTRA_RACCOLTA?.righe || [])];
  const sospese = allRighe.filter(r => r.sospesa);
  const errori = allRighe.filter(r => r.stato_validazione === 'errore');

  function renderTable(righe) {
    if (!righe || righe.length === 0) return <div className="text-center py-6 text-muted-foreground">Nessuna riga.</div>;
    return (
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted"><tr>
            <th className="text-left px-2 py-2 font-semibold">Ordine</th>
            <th className="text-left px-2 py-2 font-semibold">FIR</th>
            <th className="text-left px-2 py-2 font-semibold">Classe</th>
            <th className="text-right px-2 py-2 font-semibold">Quantità</th>
            <th className="text-right px-2 py-2 font-semibold">Prezzo</th>
            <th className="text-right px-2 py-2 font-semibold">Totale</th>
            <th className="text-center px-2 py-2 font-semibold">Stato</th>
          </tr></thead>
          <tbody>
            {righe.map((r, i) => (
              <tr key={r.id || i} className={`cursor-pointer hover:bg-muted/30 ${r.sospesa ? 'opacity-50' : ''} ${i % 2 ? 'bg-muted/20' : ''}`} onClick={() => setSelectedRiga(r)}>
                <td className="px-2 py-1.5 font-mono text-xs">{r.ordine || '-'}</td>
                <td className="px-2 py-1.5 text-xs">{r.numero_fir || '-'}</td>
                <td className="px-2 py-1.5">{r.classe || '-'}</td>
                <td className="px-2 py-1.5 text-right">{r.quantita?.toFixed(0)} kg</td>
                <td className="px-2 py-1.5 text-right">€ {r.tariffa_valore?.toFixed(4)}</td>
                <td className="px-2 py-1.5 text-right font-medium">€ {r.totale?.toFixed(2)}</td>
                <td className="text-center px-2 py-1.5">
                  {r.sospesa ? <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">sospesa</span>
                    : r.stato_validazione === 'errore' ? <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">errore</span>
                    : <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">ok</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <>
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList>
          {TIPS.map(t => <TabsTrigger key={t.key} value={t.key}>{t.label} ({data[t.key]?.righe?.length || 0})</TabsTrigger>)}
          <TabsTrigger value="anomalie">Anomalie & Sospesi ({sospese.length + errori.length})</TabsTrigger>
        </TabsList>
        {TIPS.map(t => (
          <TabsContent key={t.key} value={t.key} className="mt-3">{renderTable(data[t.key]?.righe)}</TabsContent>
        ))}
        <TabsContent value="anomalie" className="mt-3">
          {sospese.length === 0 && errori.length === 0 ? (
            <div className="text-center py-6 text-green-600">Nessuna anomalia. Tutte le prestazioni sono verificate.</div>
          ) : (
            <div className="space-y-3">
              {sospese.length > 0 && (
                <div>
                  <h3 className="font-semibold text-amber-700 mb-2">⚠ Prestazioni Sospese ({sospese.length})</h3>
                  {renderTable(sospese)}
                </div>
              )}
              {errori.length > 0 && (
                <div>
                  <h3 className="font-semibold text-red-700 mb-2">🔴 Prestazioni con Errori ({errori.length})</h3>
                  {renderTable(errori)}
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
      <RigaDetailModal riga={selectedRiga} onClose={() => setSelectedRiga(null)} />
    </>
  );
}