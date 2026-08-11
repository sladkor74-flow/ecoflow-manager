import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { LayoutDashboard, Table, DollarSign, Download } from 'lucide-react';
import AttivaDashboard from './AttivaDashboard';
import AttivaDetail from './AttivaDetail';
import AttivaTariffe from './AttivaTariffe';
import AttivaEsportazioni from './AttivaEsportazioni';

export default function FatturazioneAttiva() {
  const [tab, setTab] = useState('dashboard');
  const [periodo, setPeriodo] = useState({ anno: 2026, mese: 'Luglio' });
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [elaborating, setElaborating] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('getFatturazioneAttivaDetail', { anno: periodo.anno, mese: periodo.mese });
      setData(res.data || {});
    } catch (e) { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [periodo]);

  const elabora = async () => {
    setElaborating(true);
    try {
      await base44.functions.invoke('elaboraFatturazioneAttiva', { anno: periodo.anno, mese: periodo.mese });
      await loadData();
    } catch (e) { alert(e.message); }
    setElaborating(false);
  };

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="dashboard"><LayoutDashboard className="w-4 h-4 mr-1.5" /> Dashboard</TabsTrigger>
        <TabsTrigger value="dettaglio"><Table className="w-4 h-4 mr-1.5" /> Dettaglio</TabsTrigger>
        <TabsTrigger value="tariffe"><DollarSign className="w-4 h-4 mr-1.5" /> Tariffe</TabsTrigger>
        <TabsTrigger value="esportazioni"><Download className="w-4 h-4 mr-1.5" /> Esportazioni</TabsTrigger>
      </TabsList>
      <TabsContent value="dashboard" className="mt-4">
        <AttivaDashboard periodo={periodo} setPeriodo={setPeriodo} data={data} loading={loading} elaborating={elaborating} onElabora={elabora} onReload={loadData} />
      </TabsContent>
      <TabsContent value="dettaglio" className="mt-4">
        <AttivaDetail data={data} loading={loading} />
      </TabsContent>
      <TabsContent value="tariffe" className="mt-4"><AttivaTariffe /></TabsContent>
      <TabsContent value="esportazioni" className="mt-4">
        <AttivaEsportazioni periodo={periodo} data={data} onReload={loadData} />
      </TabsContent>
    </Tabs>
  );
}