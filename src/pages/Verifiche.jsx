import React from 'react';
import ControlloRotte from '@/components/verifiche/ControlloRotte';
import { useAuth } from '@/lib/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClipboardCheck } from 'lucide-react';
import ReportSettimanali from '@/components/verifiche/ReportSettimanali';
import QuadraturaFir from '@/components/verifiche/QuadraturaFir';
import MatriceProvince from '@/components/verifiche/MatriceProvince';

// Modulo Verifiche: controlli periodici sui dati che arrivano dai fornitori.
// Ogni controllo e' una sezione. Il DETTAGLIO che producono e' temporaneo: al
// quarantesimo giorno dal caricamento se ne vanno le righe lette e il confronto
// riga per riga (base44/shared/conservazione.ts). La verifica invece resta, con i
// suoi numeri di sintesi e una storia scritta: fino al 29/09/2026 si cancellava
// tutta, e l'utente ha chiesto di tenere il contenuto.

export default function Verifiche() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold flex items-center gap-2">
          <ClipboardCheck className="w-7 h-7 text-primary" /> Verifiche
        </h1>
        <p className="text-muted-foreground mt-1 max-w-3xl">
          Controlli periodici sui dati inviati dai fornitori, confrontati con il gestionale.
          Quaranta giorni dopo il caricamento a ogni verifica viene tolto il dettaglio riga per riga, per non appesantire l’archivio: restano i numeri di sintesi e una storia scritta, che non si cancella.
          Come <em>lavorano</em> i fornitori — l&apos;evasione delle richieste assegnate e l&apos;andamento della raccolta — sta in Verifiche Fornitori.
        </p>
      </div>

      <Tabs defaultValue="report-settimanali">
        <TabsList>
          <TabsTrigger value="report-settimanali">Report settimanali</TabsTrigger>
          <TabsTrigger value="quadratura-fir">Quadratura FIR</TabsTrigger>
          <TabsTrigger value="raccolto-province">Raccolto per provincia</TabsTrigger>
          <TabsTrigger value="ritiri-province">Ritiri per provincia</TabsTrigger>
          <TabsTrigger value="rotte">Rotte</TabsTrigger>
        </TabsList>
        <TabsContent value="report-settimanali" className="pt-4">
          <ReportSettimanali isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="quadratura-fir" className="pt-4">
          <QuadraturaFir isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="raccolto-province" className="pt-4">
          <MatriceProvince tipo="peso" />
        </TabsContent>
        <TabsContent value="ritiri-province" className="pt-4">
          <MatriceProvince tipo="ritiri" />
        </TabsContent>
        <TabsContent value="rotte" className="pt-4">
          <ControlloRotte />
        </TabsContent>
      </Tabs>
    </div>
  );
}
