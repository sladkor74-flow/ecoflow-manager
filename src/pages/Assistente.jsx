import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ChatAssistente from '@/components/assistente/ChatAssistente';
import EsercitazioneRT from '@/components/assistente/EsercitazioneRT';
import BaseConoscenza from '@/components/assistente/BaseConoscenza';
import CorsoRT from '@/components/assistente/CorsoRT';
import { usePermessi } from '@/lib/permessi';
import { Sparkles } from 'lucide-react';

// EcoTyna: domande su norme e dati della commessa, esercitazione per l'esame di
// responsabile tecnico e base di conoscenza su cui si appoggiano le risposte.
//
// Un nome solo (chiusura dell'audit, 11/10/2026): nel menu «Assistente», nel
// titolo «Assistente», nella casella «Chiedi all'Assistente» e nelle risposte
// «EcoTyna». Ora e' EcoTyna dappertutto.

const SCHEDE = ['domande', 'esercitazione', 'corso', 'conoscenza'];

export default function Assistente() {
  const { isAdmin } = usePermessi();
  const [params, setParams] = useSearchParams();
  // UNA DOMANDA PREPARATA DA UN'ALTRA PAGINA: /assistente?domanda=... (chiusura
  // dell'audit, 11/10/2026). Si scrive nella casella e si ferma li': la manda chi
  // legge, quando l'ha guardata. Poi esce dall'indirizzo, cosi' ricaricando la
  // pagina o cambiando scheda non torna a riempire la casella.
  const domanda = String(params.get('domanda') || '').slice(0, 4000);
  const scheda = domanda ? 'domande' : (SCHEDE.includes(params.get('tab')) ? params.get('tab') : 'domande');
  useEffect(() => {
    if (!params.get('domanda')) return;
    const resto = new URLSearchParams(params);
    resto.delete('domanda');
    setParams(resto, { replace: true });
  }, [params, setParams]);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold flex items-center gap-2"><Sparkles className="w-6 h-6 text-violet-600" /> EcoTyna</h1>
        <p className="text-sm text-muted-foreground">Dubbi su norme e commessa, preparazione all'esame di responsabile tecnico e base di conoscenza verificata.</p>
      </div>
      <Tabs value={scheda} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="domande">Domande</TabsTrigger>
          <TabsTrigger value="esercitazione">Esercitazione RT</TabsTrigger>
          <TabsTrigger value="corso">Corso RT</TabsTrigger>
          {isAdmin && <TabsTrigger value="conoscenza">Base di conoscenza</TabsTrigger>}
        </TabsList>
        <TabsContent value="domande" className="mt-4"><ChatAssistente domandaIniziale={domanda} /></TabsContent>
        <TabsContent value="esercitazione" className="mt-4"><EsercitazioneRT /></TabsContent>
        <TabsContent value="corso" className="mt-4"><CorsoRT /></TabsContent>
        {isAdmin && <TabsContent value="conoscenza" className="mt-4"><BaseConoscenza /></TabsContent>}
      </Tabs>
    </div>
  );
}
