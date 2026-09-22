import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, BarChart3, Table, Settings, Bot, CalendarRange, AlertTriangle, Info } from 'lucide-react';
import PredittivitaDashboard from '@/components/predittivita/PredittivitaDashboard';
import ProiezioneAnnuale from '@/components/predittivita/ProiezioneAnnuale';
import PredittivitaSettimanale from '@/components/predittivita/PredittivitaSettimanale';
import PredittivitaImpiantiManager from '@/components/predittivita/PredittivitaImpiantiManager';
import PredittivitaAgent from '@/components/predittivita/PredittivitaAgent';
import { usePermessi } from '@/lib/permessi';

const it = (g) => (g ? String(g).slice(0, 10).split('-').reverse().join('/') : '');

// Quello che la pianificazione ha lasciato fuori o trovato storto: i formulari
// terminati con le date obbligatorie da sistemare (immissione, inizio e fine
// trasporto, regola del 22/09/2026; quelli senza fine trasporto sono esclusi dai
// conti, mai ricollocati sulla chiusura), i ruoli discordi e i fornitori
// registrati che sulla rete non lavorano. La funzione li restituiva e nessuno li
// mostrava.
function Segnalazioni({ data }) {
  const anomalie = (data && data.anomalie) || [];
  if (!data || (!anomalie.length && !data.caricamento_in_corso)) return null;
  return (
    <div className="space-y-2">
      {data.caricamento_in_corso && (
        <div className="flex items-start gap-2 text-sm text-amber-900 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2">
          <Loader2 className="w-4 h-4 mt-0.5 shrink-0 animate-spin" />
          <span>
            {data.caricamento_in_corso} I numeri qui sotto possono essere incompleti e il piano settimanale non viene salvato:
            la pagina si ricalcola da sola quando il caricamento si chiude.
          </span>
        </div>
      )}
      {anomalie.length > 0 && (
        <div className="border border-amber-300 bg-amber-50 rounded-lg px-3 py-2 space-y-1.5">
          <p className="text-sm font-semibold text-amber-900 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" /> Da controllare ({anomalie.length})
          </p>
          <ul className="text-xs text-amber-900 space-y-1 list-disc pl-5">
            {anomalie.map((a, i) => <li key={`${a.tipo}-${i}`}>{a.testo}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function PredittivitaSecondarie() {
  const { isAdmin } = usePermessi();
  const [tab, setTab] = useState('dashboard');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Cresce a ogni caricamento chiuso: la proiezione ha la sua funzione e il suo
  // stato, e senza questo restava ai numeri di quando la scheda era stata aperta.
  const [versione, setVersione] = useState(0);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const res = await base44.functions.invoke('calcolaPianificazioneSecondaria', {});
      setData(res.data);
    } catch (e) { setError(e?.data?.error || e?.message || 'Errore di caricamento'); }
    setLoading(false);
  };

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => { load(); }, []);

  // Ricalcolo automatico a ogni caricamento che si chiude (anche uno aperto che
  // risulta interrotto): tutte le schede, proiezione compresa.
  useEffect(() => {
    const unsubscribe = base44.entities.UploadLog.subscribe((event) => {
      if ((event.type === 'create' || event.type === 'update') && event.data?.esito !== 'in_corso') {
        loadRef.current();
        setVersione(v => v + 1);
      }
    });
    return unsubscribe;
  }, []);

  const dataFine = data && data.data_fine ? it(data.data_fine) : '';

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold">Predittività Secondarie</h1>
        <p className="text-muted-foreground mt-1">
          Pianificazione dei viaggi di secondaria verso gli impianti{dataFine ? ` fino al ${dataFine}` : ''}.
          {loading && data && <span className="ml-2 text-xs inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />ricalcolo…</span>}
        </p>
        <p className="mt-2 inline-flex items-start gap-1.5 text-xs text-primary bg-primary/5 border border-primary/20 rounded px-2 py-1">
          <Info className="w-3.5 h-3.5 mt-px shrink-0" />
          <span>
            Solo rete: ACI ed extra raccolta non entrano nella predittività. Target, consuntivi, primarie, secondarie,
            giacenze degli stoccaggi (classi 1-4 della rilevazione e movimenti di rete), ipotesi e proiezioni sono tutti della rete.
            Il già arrivato di rete di un impianto è lo stesso in tutte le schede: le primarie arrivate al suo sito, anche quelle
            scaricate nel suo piazzale al netto di quello che ne riparte per altri impianti (lo contano loro), più le secondarie
            da altri stoccaggi; residuo = target meno già arrivato.
          </span>
        </p>
      </div>
      {loading && !data ? (
        <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin inline" /></div>
      ) : error ? (
        <div className="text-center py-12 space-y-2">
          <p className="text-destructive font-medium">Errore: {error}</p>
          <button onClick={load} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm">Riprova</button>
        </div>
      ) : (
        <>
          <Segnalazioni data={data} />
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="dashboard"><BarChart3 className="w-4 h-4 mr-1.5" /> Dashboard</TabsTrigger>
              <TabsTrigger value="proiezione"><CalendarRange className="w-4 h-4 mr-1.5" /> Proiezione a fine anno</TabsTrigger>
              <TabsTrigger value="settimanale"><Table className="w-4 h-4 mr-1.5" /> Settimanale</TabsTrigger>
              {isAdmin && <TabsTrigger value="config"><Settings className="w-4 h-4 mr-1.5" /> Configurazione</TabsTrigger>}
              <TabsTrigger value="agente"><Bot className="w-4 h-4 mr-1.5" /> Assistente</TabsTrigger>
            </TabsList>
            <TabsContent value="dashboard" className="mt-4"><PredittivitaDashboard data={data} onReload={load} /></TabsContent>
            <TabsContent value="proiezione" className="mt-4"><ProiezioneAnnuale isAdmin={isAdmin} versione={versione} /></TabsContent>
            <TabsContent value="settimanale" className="mt-4"><PredittivitaSettimanale data={data} onReload={load} /></TabsContent>
            {isAdmin && <TabsContent value="config" className="mt-4"><PredittivitaImpiantiManager onReload={load} /></TabsContent>}
            <TabsContent value="agente" className="mt-4"><PredittivitaAgent /></TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
