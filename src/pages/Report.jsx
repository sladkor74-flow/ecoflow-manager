import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ReportSettimanale from '@/components/report/ReportSettimanale';
import { FileBarChart } from 'lucide-react';

// Report: prospetti pronti da consultare ed esportare, calcolati dai dati del
// gestionale e quindi sempre aggiornati ai caricamenti.

const SCHEDE = ['settimanale'];

export default function Report() {
  const [params, setParams] = useSearchParams();
  const scheda = SCHEDE.includes(params.get('tab')) ? params.get('tab') : 'settimanale';
  return (
    <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-4">
      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold flex items-center gap-2"><FileBarChart className="w-7 h-7 text-primary" /> Report</h1>
        <p className="text-muted-foreground mt-1">Prospetti della commessa sempre aggiornati ai dati caricati, da consultare ed esportare.</p>
      </div>
      <Tabs value={scheda} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="settimanale">Report Settimanale</TabsTrigger>
        </TabsList>
        <TabsContent value="settimanale" className="mt-4"><ReportSettimanale /></TabsContent>
      </Tabs>
    </div>
  );
}
