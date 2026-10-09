import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { RefreshCw, Download, Settings } from 'lucide-react';
import GiacenzeKpi from '@/components/giacenze/GiacenzeKpi';
import AnomalieAlert from '@/components/giacenze/AnomalieAlert';
import SituazioneTable from '@/components/giacenze/SituazioneTable';
import DaDichiarareTable from '@/components/giacenze/DaDichiarareTable';
import DerivatiTable from '@/components/giacenze/DerivatiTable';
import TargetTable from '@/components/giacenze/TargetTable';
import TargetManager from '@/components/giacenze/TargetManager';
import StoccaggiManager from '@/components/giacenze/StoccaggiManager';
import ChiusuraAnno from '@/components/giacenze/ChiusuraAnno';
import { exportGiacenzeAllExcel } from '@/lib/giacenzeExportAll';
import EsportaPdf from '@/components/shared/EsportaPdf';
import { situazionePdf, derivatiPdf, targetPdf } from '@/lib/giacenzePdf';

export default function Giacenze() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [anno, setAnno] = useState(2026);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('situazione');
  const [filtroSito, setFiltroSito] = useState('');
  // Un sito puo' essere impianto e piazzale insieme: il pulsante dice quale dei due.
  const [filtroRuolo, setFiltroRuolo] = useState('');
  const [showTargetManager, setShowTargetManager] = useState(false);
  const [exporting, setExporting] = useState(false);

  // PERCHE' NON HA RISPOSTO, E UN MODO PER RIPROVARE (09/10/2026).
  //
  // Il calcolo delle giacenze e' una funzione sola e lunga: ogni tanto non
  // risponde - succede sempre subito dopo una pubblicazione, mentre la
  // piattaforma rimette su le funzioni - e la pagina diceva «Errore nel
  // caricamento.» e basta, senza il motivo e senza niente da premere. E' la
  // regola della casa, scritta per i riquadri indipendenti e valida anche qui:
  // chi non ha risposto si dice per nome, con «Riprova», e il resto resta a
  // video.
  const [errore, setErrore] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('calcolaGiacenze', { anno });
      setData(res.data);
      setErrore('');
    } catch (e) {
      console.error(e);
      setErrore(e?.response?.data?.error || e?.message || String(e));
    }
    setLoading(false);
  }, [anno]);

  useEffect(() => { loadData(); }, [loadData]);

  const destinazioni = data ? [...new Set(data.righe.map(r => r.sito))].sort() : [];

  const vaiDaDichiarareConSito = (sito, ruolo) => {
    setFiltroSito(sito);
    setFiltroRuolo(ruolo || '');
    setTab('dichiarare');
  };

  const handleExportAll = async () => {
    setExporting(true);
    try {
      // Recupera l'intero elenco ordini da dichiarare (senza filtri): tutte le
      // righe, non le prime mille sotto il totale di tutte.
      const ordRes = await base44.functions.invoke('getOrdiniDaDichiarare', { tutte: true, offset: 0 });
      await exportGiacenzeAllExcel(data, ordRes.data, anno);
    } catch (e) { alert('Errore export: ' + e.message); }
    setExporting(false);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-heading font-bold text-xl">Giacenze</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(anno)} onValueChange={v => setAnno(Number(v))}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>{[2024, 2025, 2026, 2027].map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Ricalcola
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportAll} disabled={!data || exporting}>
            <Download className="w-4 h-4 mr-1" /> {exporting ? 'Esportazione...' : 'Esporta Excel'}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : data ? (
        <>
          {/* Un ricalcolo che non risponde non cancella quello che si ha davanti:
              si dice che i numeri sono quelli di prima, e si puo' riprovare. */}
          {errore && (
            <div className="border border-amber-300 bg-amber-50 text-amber-900 rounded-lg px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-2">
              <span>L&apos;ultimo ricalcolo non ha risposto ({errore}): a video ci sono i numeri di prima.</span>
              <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>Riprova</Button>
            </div>
          )}
          <GiacenzeKpi totali={data.totali} />

          {data.anomalie && data.anomalie.length > 0 && (
            <AnomalieAlert anomalie={data.anomalie} />
          )}

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="situazione">Situazione</TabsTrigger>
              <TabsTrigger value="dichiarare">Da dichiarare</TabsTrigger>
              <TabsTrigger value="derivati">Derivati</TabsTrigger>
              <TabsTrigger value="target">Target</TabsTrigger>
              <TabsTrigger value="stoccaggi">Stoccaggi</TabsTrigger>
              <TabsTrigger value="chiusura">Chiusura anno</TabsTrigger>
            </TabsList>

            <TabsContent value="situazione">
              <div className="space-y-3">
                <div className="flex justify-end"><EsportaPdf sezioni={() => situazionePdf(anno, data.righe, data.totali)} /></div>
                <SituazioneTable righe={data.righe} totali={data.totali} onVaiDaDichiarare={vaiDaDichiarareConSito} />
              </div>
            </TabsContent>

            <TabsContent value="dichiarare">
              <DaDichiarareTable filtroSitoEsterno={filtroSito} filtroRuoloEsterno={filtroRuolo} onPulisciFiltroSito={() => { setFiltroSito(''); setFiltroRuolo(''); }} />
            </TabsContent>

            <TabsContent value="derivati">
              <div className="space-y-3">
                <div className="flex justify-end"><EsportaPdf sezioni={() => derivatiPdf(anno, data.righe, data.totali)} /></div>
                <DerivatiTable righe={data.righe} totali={data.totali} />
              </div>
            </TabsContent>

            <TabsContent value="target">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2 justify-between items-center">
                  {isAdmin ? (
                    <Button variant="outline" size="sm" onClick={() => setShowTargetManager(true)}>
                      <Settings className="w-4 h-4 mr-1" /> Siti e target
                    </Button>
                  ) : <span />}
                  <EsportaPdf sezioni={() => targetPdf(anno, data.righe, data.totali)} />
                </div>
                <TargetTable righe={data.righe} totali={data.totali} />
              </div>
            </TabsContent>

            {/* La chiusura d'anno prepara la fotografia da cui parte l'anno dopo:
                si chiude l'anno prima di quello che si sta guardando. */}
            <TabsContent value="chiusura">
              <ChiusuraAnno anno={Number(anno) - 1} isAdmin={isAdmin} onSaved={loadData} />
            </TabsContent>

            <TabsContent value="stoccaggi">
              <StoccaggiManager
                // Con i formulari da sistemare dello stoccaggio: senza fine trasporto
                // non entrano fra i movimenti dopo la rilevazione (22/09/2026).
                // E col controllo della rilevazione piu' recente, che si mostra a
                // chi la inserisce (23/09/2026).
                stoccaggiFromCalcolo={data.righe.filter(r => r.tipo_destinazione === 'stoc').map(r => ({
                  sito: r.sito,
                  date_da_sistemare: r.date_da_sistemare || [],
                  verifica_rilevazione: r.verifica_rilevazione || null,
                  // La giacenza di OGGI, accanto alla fotografia del giorno in cui
                  // e' stata letta: senza, una lettura vecchia si legge come la
                  // giacenza di adesso (06/10/2026).
                  giacenza_rete_t: r.giacenza_portale_t,
                  giacenza_aci_t: r.giacenza_aci_t,
                  aggiornata_al: r.aggiornata_al || null,
                  // l'estratto conto del piazzale, con lo storico delle letture
                  riconciliazione: r.riconciliazione || null,
                }))}
                isAdmin={isAdmin}
                onSaved={loadData}
              />
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <div className="text-center py-12 space-y-3">
          <p className="text-muted-foreground">
            Il calcolo delle giacenze non ha risposto{errore ? <>: <span className="text-foreground">{errore}</span></> : '.'}
          </p>
          <p className="text-xs text-muted-foreground">Capita subito dopo una pubblicazione, mentre le funzioni vengono rimesse su: di solito basta riprovare.</p>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Riprova
          </Button>
        </div>
      )}

      <TargetManager
        open={showTargetManager}
        onClose={() => setShowTargetManager(false)}
        anno={anno}
        destinazioni={destinazioni}
        righe={data?.righe || []}
        onSaved={loadData}
      />

    </div>
  );
}