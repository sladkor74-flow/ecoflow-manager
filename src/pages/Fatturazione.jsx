import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { FileText, Users, DollarSign, History, TrendingUp } from 'lucide-react';
import FatturazionePassiva from '@/components/fatturazione/FatturazionePassiva';
import FatturazionePassivaRete from '@/components/fatturazione/FatturazionePassivaRete';
import FornitoriManager from '@/components/fatturazione/FornitoriManager';
import TariffeManager from '@/components/fatturazione/TariffeManager';
import StoricoFatturazione from '@/components/fatturazione/StoricoFatturazione';
import FatturazioneAttiva from '@/components/fatturazione/FatturazioneAttiva';

export default function Fatturazione() {
  const [tab, setTab] = useState('passiva');
  const [periodo, setPeriodo] = useState({ anno: 2026, mese: 'Luglio' });

  const openPeriod = (anno, mese) => {
    setPeriodo({ anno, mese });
    setTab('passiva');
  };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold">Fatturazione</h1>
        <p className="text-muted-foreground mt-1">Gestione fatturazione passiva e attiva.</p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="passiva"><FileText className="w-4 h-4 mr-1.5" /> Passiva</TabsTrigger>
          <TabsTrigger value="passiva-rete"><FileText className="w-4 h-4 mr-1.5" /> Passiva Rete (a)</TabsTrigger>
          <TabsTrigger value="attiva"><TrendingUp className="w-4 h-4 mr-1.5" /> Attiva</TabsTrigger>
          <TabsTrigger value="fornitori"><Users className="w-4 h-4 mr-1.5" /> Fornitori</TabsTrigger>
          <TabsTrigger value="tariffe"><DollarSign className="w-4 h-4 mr-1.5" /> Tariffe & Anagrafiche</TabsTrigger>
          <TabsTrigger value="storico"><History className="w-4 h-4 mr-1.5" /> Storico</TabsTrigger>
        </TabsList>
        <TabsContent value="passiva" className="mt-4"><FatturazionePassiva periodo={periodo} setPeriodo={setPeriodo} /></TabsContent>
        <TabsContent value="passiva-rete" className="mt-4"><FatturazionePassivaRete /></TabsContent>
        <TabsContent value="attiva" className="mt-4"><FatturazioneAttiva /></TabsContent>
        <TabsContent value="fornitori" className="mt-4"><FornitoriManager /></TabsContent>
        <TabsContent value="tariffe" className="mt-4"><TariffeManager /></TabsContent>
        <TabsContent value="storico" className="mt-4"><StoricoFatturazione onOpen={openPeriod} /></TabsContent>
      </Tabs>
    </div>
  );
}