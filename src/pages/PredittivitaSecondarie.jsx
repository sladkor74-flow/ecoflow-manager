import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, BarChart3, Table, Settings } from 'lucide-react';
import PredittivitaDashboard from '@/components/predittivita/PredittivitaDashboard';
import PredittivitaSettimanale from '@/components/predittivita/PredittivitaSettimanale';
import PredittivitaImpiantiManager from '@/components/predittivita/PredittivitaImpiantiManager';

export default function PredittivitaSecondarie() {
  const [tab, setTab] = useState('dashboard');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('calcolaPianificazioneSecondaria', {});
      setData(res.data);
    } catch (e) { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold">Predittività Secondarie</h1>
        <p className="text-muted-foreground mt-1">Pianificazione viaggi IRIGOM e TECNOGUM fino al 18 dicembre.</p>
      </div>
      {loading ? (
        <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin inline" /></div>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="dashboard"><BarChart3 className="w-4 h-4 mr-1.5" /> Dashboard</TabsTrigger>
            <TabsTrigger value="settimanale"><Table className="w-4 h-4 mr-1.5" /> Settimanale</TabsTrigger>
            <TabsTrigger value="config"><Settings className="w-4 h-4 mr-1.5" /> Configurazione</TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard" className="mt-4"><PredittivitaDashboard data={data} onReload={load} /></TabsContent>
          <TabsContent value="settimanale" className="mt-4"><PredittivitaSettimanale data={data} /></TabsContent>
          <TabsContent value="config" className="mt-4"><PredittivitaImpiantiManager onReload={load} /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}