import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { RefreshCw, Download, Settings, Upload } from 'lucide-react';
import GiacenzeKpi from '@/components/giacenze/GiacenzeKpi';
import AnomalieAlert from '@/components/giacenze/AnomalieAlert';
import SituazioneTable from '@/components/giacenze/SituazioneTable';
import DaDichiarareTable from '@/components/giacenze/DaDichiarareTable';
import DerivatiTable from '@/components/giacenze/DerivatiTable';
import TargetTable from '@/components/giacenze/TargetTable';
import TargetManager from '@/components/giacenze/TargetManager';
import { exportGiacenzeAllExcel } from '@/lib/giacenzeExportAll';

export default function Giacenze() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [anno, setAnno] = useState(2026);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('situazione');
  const [filtroSito, setFiltroSito] = useState('');
  const [showTargetManager, setShowTargetManager] = useState(false);
  const [seedSimula, setSeedSimula] = useState(null);
  const [seedConfirm, setSeedConfirm] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('calcolaGiacenze', { anno });
      setData(res.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [anno]);

  useEffect(() => { loadData(); }, [loadData]);

  const destinazioni = data ? [...new Set(data.righe.map(r => r.sito))].sort() : [];

  const vaiDaDichiarareConSito = (sito) => {
    setFiltroSito(sito);
    setTab('dichiarare');
  };

  const handleSeedSimula = async () => {
    setSeeding(true);
    try {
      const res = await base44.functions.invoke('seedTargetSiti2026', { simula: true });
      setSeedSimula(res.data);
      setSeedConfirm(true);
    } catch (e) { alert(e.message); }
    setSeeding(false);
  };

  const handleSeedConfirm = async () => {
    setSeeding(true);
    try {
      await base44.functions.invoke('seedTargetSiti2026', { simula: false });
      setSeedConfirm(false);
      await loadData();
    } catch (e) { alert(e.message); }
    setSeeding(false);
  };

  const handleExportAll = async () => {
    setExporting(true);
    try {
      // Recupera l'intero elenco ordini da dichiarare (senza filtri)
      const ordRes = await base44.functions.invoke('getOrdiniDaDichiarare', { limite: 100000, offset: 0 });
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
            </TabsList>

            <TabsContent value="situazione">
              <SituazioneTable righe={data.righe} totali={data.totali} onVaiDaDichiarare={vaiDaDichiarareConSito} />
            </TabsContent>

            <TabsContent value="dichiarare">
              <DaDichiarareTable filtroSitoEsterno={filtroSito} onPulisciFiltroSito={() => setFiltroSito('')} />
            </TabsContent>

            <TabsContent value="derivati">
              <DerivatiTable righe={data.righe} totali={data.totali} />
            </TabsContent>

            <TabsContent value="target">
              <div className="space-y-3">
                {isAdmin && (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowTargetManager(true)}>
                      <Settings className="w-4 h-4 mr-1" /> Configura target
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleSeedSimula} disabled={seeding}>
                      <Upload className="w-4 h-4 mr-1" /> Importa target 2026
                    </Button>
                  </div>
                )}
                <TargetTable righe={data.righe} totali={data.totali} />
              </div>
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <div className="text-center py-12 text-muted-foreground">Errore nel caricamento.</div>
      )}

      <TargetManager
        open={showTargetManager}
        onClose={() => setShowTargetManager(false)}
        anno={anno}
        destinazioni={destinazioni}
        onSaved={loadData}
      />

      <AlertDialog open={seedConfirm} onOpenChange={setSeedConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Importa target 2026</AlertDialogTitle>
            <AlertDialogDescription>
              {seedSimula && (
                <span>
                  Verranno inseriti {seedSimula.da_creare} record GiacenzaSito per il 2026.
                  {seedSimula.ignorati > 0 && ` (${seedSimula.ignorati} già presenti e saranno saltati).`}
                  {' '}Confermi l'inserimento?
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={seeding}>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleSeedConfirm} disabled={seeding}>
              {seeding ? 'Inserimento...' : 'Conferma'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}