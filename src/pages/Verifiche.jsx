import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClipboardCheck } from 'lucide-react';
import ReportSettimanali from '@/components/verifiche/ReportSettimanali';

// Modulo Verifiche: controlli periodici sui dati che arrivano dai fornitori.
// Ogni controllo e' una sezione; il lavoro che producono e' temporaneo e si
// cancella da solo, a differenza di cio' che avviene negli altri moduli.

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
          Ogni verifica produce un Excel con i controlli fatti e le discrepanze da comunicare.
        </p>
      </div>

      <Tabs defaultValue="report-settimanali">
        <TabsList>
          <TabsTrigger value="report-settimanali">Report settimanali</TabsTrigger>
        </TabsList>
        <TabsContent value="report-settimanali" className="pt-4">
          <ReportSettimanali isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
