import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import EvasioneAssegnati from '@/components/verifiche/EvasioneAssegnati';
import AndamentoRaccoglitori from '@/components/verifiche-fornitori/AndamentoRaccoglitori';
import Consuntivi from '@/components/verifiche-fornitori/Consuntivi';

// VERIFICHE FORNITORI (richiesta dell'utente, 29/09/2026).
//
// Qui si controlla come lavorano i fornitori, non come stanno i dati: l'evasione
// delle richieste assegnate ai raccoglitori e l'andamento della loro raccolta.
// Il modulo Verifiche resta quello dei controlli sui DATI inviati (report
// settimanali, quadratura FIR, province, rotte).
//
// L'«Evasione assegnati» e' stata SPOSTATA qui da Verifiche, non duplicata
// (decisione dell'utente, 29/09/2026): due posti dove caricare le stesse liste
// avrebbero voluto dire due archivi di liste e due controlli che possono divergere.
// I file li carica l'amministratore, uno per raccoglitore, come gia' faceva.
//
// L'andamento invece non si carica: si calcola ogni volta dall'archivio delle
// primarie, quindi e' sempre la fotografia di adesso e si aggiorna da sola a ogni
// caricamento (regola 2).

export default function VerificheFornitori() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold flex items-center gap-2">
          <Users className="w-7 h-7 text-primary" /> Verifiche Fornitori
        </h1>
        <p className="text-muted-foreground mt-1 max-w-3xl">
          Come lavorano i fornitori: se le richieste assegnate vengono evase nell&apos;ordine in cui sono arrivate, e come va la
          raccolta di ciascun raccoglitore mese per mese e zona per zona. I controlli sui dati che i fornitori ci mandano —
          report settimanali, quadratura FIR — restano nel modulo Verifiche.
        </p>
      </div>

      <Tabs defaultValue="evasione">
        <TabsList>
          <TabsTrigger value="evasione">Evasione assegnati</TabsTrigger>
          <TabsTrigger value="andamento">Andamento e zone</TabsTrigger>
          <TabsTrigger value="consuntivi">Consuntivi e costi</TabsTrigger>
        </TabsList>
        <TabsContent value="evasione" className="pt-4">
          <EvasioneAssegnati isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="andamento" className="pt-4">
          <AndamentoRaccoglitori isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="consuntivi" className="pt-4">
          <Consuntivi isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
