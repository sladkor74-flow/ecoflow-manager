import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { leggiCollegamento, periodoDelCollegamento } from '@/lib/collegamenti';
import { meseDiLavoro } from '@/lib/periodoPagine';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { FileText, Users, DollarSign, History, TrendingUp, Scale } from 'lucide-react';
import PassivaModulo from '@/components/fatturazione/PassivaModulo';
import FornitoriManager from '@/components/fatturazione/FornitoriManager';
import TariffeUnificate from '@/components/fatturazione/TariffeUnificate';
import StoricoFatturazione from '@/components/fatturazione/StoricoFatturazione';
import FatturazioneAttiva from '@/components/fatturazione/FatturazioneAttiva';
import MargineCommessa from '@/components/fatturazione/MargineCommessa';
import { useAuth } from '@/lib/AuthContext';

// Le schede che chi guarda ha davvero: un collegamento a una scheda
// dell'amministratore, aperto da un altro utente, apre la pagina come sempre.
// COSTI E MARGINE SOLO ALL'AMMINISTRATORE (13/10/2026). La passiva (calcolaPassiva
// risponde 403 a chi non lo e') e lo Storico, che sono i documenti della passiva
// coi loro importi, sono costi: chi non e' amministratore vede la sola Attiva.
const schedeDi = (isAdmin) => (isAdmin ? ['passiva', 'attiva', 'margine', 'fornitori', 'tariffe', 'storico'] : ['attiva']);

export default function Fatturazione() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  // ?tab=passiva&anno=2026&mese=Settembre&canale=ACI (la chiusura del mese e la
  // dashboard): si apre il punto dove si lavora. Vedi src/lib/collegamenti.js.
  const location = useLocation();
  const arrivo = leggiCollegamento(location.search, schedeDi(isAdmin));
  const [tab, setTab] = useState(arrivo.tab || 'passiva');
  const [periodo, setPeriodo] = useState(() => periodoDelCollegamento(arrivo, meseDiLavoro()));
  const [canalePassiva, setCanalePassiva] = useState(arrivo.canale || 'RETE');
  // Un collegamento nuovo con la pagina gia' aperta, o il ruolo che arriva dopo
  // la prima apertura (le schede dell'amministratore).
  useEffect(() => {
    const a = leggiCollegamento(location.search, schedeDi(isAdmin));
    if (a.tab) setTab(a.tab);
    if (a.anno && a.mese) setPeriodo({ anno: a.anno, mese: a.mese });
    if (a.canale) setCanalePassiva(a.canale);
  }, [location.search, isAdmin]);
  // Il ruolo arriva dopo la prima apertura: chi non e' amministratore, se la
  // scheda aperta non e' fra le sue, va sull'Attiva.
  useEffect(() => {
    if (user && !schedeDi(isAdmin).includes(tab)) setTab(schedeDi(isAdmin)[0]);
  }, [user, isAdmin, tab]);

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
          {isAdmin && <TabsTrigger value="passiva"><FileText className="w-4 h-4 mr-1.5" /> Passiva</TabsTrigger>}
          <TabsTrigger value="attiva"><TrendingUp className="w-4 h-4 mr-1.5" /> Attiva</TabsTrigger>
          {isAdmin && <TabsTrigger value="margine"><Scale className="w-4 h-4 mr-1.5" /> Margine</TabsTrigger>}
          {isAdmin && <TabsTrigger value="fornitori"><Users className="w-4 h-4 mr-1.5" /> Fornitori</TabsTrigger>}
          {isAdmin && <TabsTrigger value="tariffe"><DollarSign className="w-4 h-4 mr-1.5" /> Tariffe & Anagrafiche</TabsTrigger>}
          {isAdmin && <TabsTrigger value="storico"><History className="w-4 h-4 mr-1.5" /> Storico</TabsTrigger>}
        </TabsList>
        {isAdmin && <TabsContent value="passiva" className="mt-4">
          <Tabs value={canalePassiva} onValueChange={setCanalePassiva}>
            <TabsList>
              <TabsTrigger value="RETE">Rete</TabsTrigger>
              <TabsTrigger value="ACI">ACI</TabsTrigger>
              <TabsTrigger value="EXTRA_RACCOLTA">Extra Raccolta</TabsTrigger>
            </TabsList>
            <TabsContent value="RETE" className="mt-4"><PassivaModulo tipologia="RETE" periodo={periodo} setPeriodo={setPeriodo} /></TabsContent>
            <TabsContent value="ACI" className="mt-4"><PassivaModulo tipologia="ACI" periodo={periodo} setPeriodo={setPeriodo} /></TabsContent>
            <TabsContent value="EXTRA_RACCOLTA" className="mt-4"><PassivaModulo tipologia="EXTRA_RACCOLTA" periodo={periodo} setPeriodo={setPeriodo} /></TabsContent>
          </Tabs>
        </TabsContent>}
        <TabsContent value="attiva" className="mt-4"><FatturazioneAttiva isAdmin={isAdmin} onVaiTariffe={() => setTab('tariffe')} periodoIniziale={periodoDelCollegamento(arrivo, null)} /></TabsContent>
        {isAdmin && <TabsContent value="margine" className="mt-4"><MargineCommessa /></TabsContent>}
        {isAdmin && <TabsContent value="fornitori" className="mt-4"><FornitoriManager /></TabsContent>}
        {isAdmin && <TabsContent value="tariffe" className="mt-4"><TariffeUnificate /></TabsContent>}
        {isAdmin && <TabsContent value="storico" className="mt-4"><StoricoFatturazione onOpen={openPeriod} /></TabsContent>}
      </Tabs>
    </div>
  );
}