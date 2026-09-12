import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { RefreshCw } from 'lucide-react';
import GiacenzeKpi from '@/components/giacenze/GiacenzeKpi';
import AnomalieAlert from '@/components/giacenze/AnomalieAlert';
import SituazioneTable from '@/components/giacenze/SituazioneTable';
import DaDichiarareTable from '@/components/giacenze/DaDichiarareTable';

export default function Giacenze() {
  const [anno, setAnno] = useState(2026);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('situazione');
  const [filtroSito, setFiltroSito] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('calcolaGiacenze', { anno });
      setData(res.data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [anno]);

  useEffect(() => { loadData(); }, [loadData]);

  const vaiDaDichiarareConSito = (sito) => {
    setFiltroSito(sito);
    setTab('dichiarare');
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header: selettore anno + Ricalcola */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-heading font-bold text-xl">Giacenze</h1>
        <div className="flex items-center gap-2">
          <Select value={String(anno)} onValueChange={v => setAnno(Number(v))}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>{[2024, 2025, 2026, 2027].map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Ricalcola
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : data ? (
        <>
          {/* KPI riepilogativi */}
          <GiacenzeKpi totali={data.totali} />

          {/* Anomalie */}
          {data.anomalie && data.anomalie.length > 0 && (
            <AnomalieAlert anomalie={data.anomalie} />
          )}

          {/* Schede */}
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
              <div className="bg-card border rounded-lg p-12 text-center text-muted-foreground">
                In preparazione
              </div>
            </TabsContent>

            <TabsContent value="target">
              <div className="bg-card border rounded-lg p-12 text-center text-muted-foreground">
                In preparazione
              </div>
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <div className="text-center py-12 text-muted-foreground">Errore nel caricamento.</div>
      )}
    </div>
  );
}