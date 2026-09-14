import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ChatAssistente from '@/components/assistente/ChatAssistente';
import EsercitazioneRT from '@/components/assistente/EsercitazioneRT';
import BaseConoscenza from '@/components/assistente/BaseConoscenza';
import CorsoRT from '@/components/assistente/CorsoRT';
import { Sparkles } from 'lucide-react';

// Assistente: domande su norme e dati della commessa, esercitazione per l'esame
// di responsabile tecnico e base di conoscenza su cui si appoggiano le risposte.

const SCHEDE = ['domande', 'esercitazione', 'corso', 'conoscenza'];

export default function Assistente() {
  const [params, setParams] = useSearchParams();
  const scheda = SCHEDE.includes(params.get('tab')) ? params.get('tab') : 'domande';
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Sparkles className="w-6 h-6 text-violet-600" /> Assistente</h1>
        <p className="text-sm text-muted-foreground">Dubbi su norme e commessa, preparazione all'esame di responsabile tecnico e base di conoscenza verificata.</p>
      </div>
      <Tabs value={scheda} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="domande">Domande</TabsTrigger>
          <TabsTrigger value="esercitazione">Esercitazione RT</TabsTrigger>
          <TabsTrigger value="corso">Corso RT</TabsTrigger>
          <TabsTrigger value="conoscenza">Base di conoscenza</TabsTrigger>
        </TabsList>
        <TabsContent value="domande" className="mt-4"><ChatAssistente /></TabsContent>
        <TabsContent value="esercitazione" className="mt-4"><EsercitazioneRT /></TabsContent>
        <TabsContent value="corso" className="mt-4"><CorsoRT /></TabsContent>
        <TabsContent value="conoscenza" className="mt-4"><BaseConoscenza /></TabsContent>
      </Tabs>
    </div>
  );
}
