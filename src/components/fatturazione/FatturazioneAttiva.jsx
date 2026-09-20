import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { LayoutDashboard, Table, Download, FileCheck } from 'lucide-react';
import AttivaDashboard from './AttivaDashboard';
import AttivaDetail from './AttivaDetail';
import AttivaEsportazioni from './AttivaEsportazioni';
import PrefatturaEcotyre from './PrefatturaEcotyre';

export default function FatturazioneAttiva({ isAdmin, onVaiTariffe }) {
  const [tab, setTab] = useState('dashboard');
  const [periodo, setPeriodo] = useState({ anno: 2026, mese: 'Luglio' });
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [elaborating, setElaborating] = useState(false);
  const [anomalie, setAnomalie] = useState([]);

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
      const res = await base44.functions.invoke('elaboraFatturazioneAttiva', { anno: periodo.anno, mese: periodo.mese });
      setAnomalie(res.data?.anomalie || []);
      await loadData();
    } catch (e) { alert(e?.response?.data?.error || e.message); }
    setElaborating(false);
  };

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="dashboard"><LayoutDashboard className="w-4 h-4 mr-1.5" /> Dashboard</TabsTrigger>
        <TabsTrigger value="dettaglio"><Table className="w-4 h-4 mr-1.5" /> Dettaglio</TabsTrigger>
        <TabsTrigger value="prefattura"><FileCheck className="w-4 h-4 mr-1.5" /> Prefattura Ecotyre</TabsTrigger>
        <TabsTrigger value="esportazioni"><Download className="w-4 h-4 mr-1.5" /> Esportazioni</TabsTrigger>
      </TabsList>
      <TabsContent value="dashboard" className="mt-4">
        <AttivaDashboard periodo={periodo} setPeriodo={setPeriodo} data={data} loading={loading} elaborating={elaborating} onElabora={elabora} onReload={loadData} isAdmin={isAdmin} anomalie={anomalie} onVaiTariffe={onVaiTariffe} />
      </TabsContent>
      <TabsContent value="dettaglio" className="mt-4">
        <AttivaDetail data={data} loading={loading} periodo={periodo} />
      </TabsContent>
      <TabsContent value="prefattura" className="mt-4">
        <PrefatturaEcotyre periodo={periodo} isAdmin={isAdmin} />
      </TabsContent>
      <TabsContent value="esportazioni" className="mt-4">
        <AttivaEsportazioni periodo={periodo} data={data} onReload={loadData} onVaiPrefattura={() => setTab('prefattura')} />
      </TabsContent>
    </Tabs>
  );
}