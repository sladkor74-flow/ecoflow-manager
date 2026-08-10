import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Upload, MapPin, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import AlertBadge from '@/components/alerts/AlertBadge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProvinceMatrix from '@/components/primarie-rete/ProvinceMatrix';
import RaccoglitoriMix from '@/components/primarie-rete/RaccoglitoriMix';

export default function PrimarieRete() {
  const [provinceData, setProvinceData] = useState(null);
  const [mixData, setMixData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alertCount, setAlertCount] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [provRes, mixRes, alertRes] = await Promise.all([
        base44.functions.invoke('computeProvinceMatrix', {}),
        base44.functions.invoke('computeRaccoglitoriMix', {}),
        base44.functions.invoke('getAlerts', { modulo: 'primarie_rete', solo_aperti: true }),
      ]);
      setProvinceData(provRes.data);
      setMixData(mixRes.data);
      setAlertCount(alertRes.data?.total || 0);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold">Primarie Rete — Terminati Rete</h1>
          <p className="text-muted-foreground mt-1">
            Monitoraggio raccolte PFU per provincia e mix classi consorziali per raccoglitore.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {alertCount > 0 && <AlertBadge count={alertCount} modulo="primarie_rete" />}
          <Link to="/caricamento-dati" className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-md hover:bg-accent">
            <Upload className="w-4 h-4" /> Carica dati
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Calcolo analytics in corso...
        </div>
      ) : (
        <Tabs defaultValue="province">
          <TabsList>
            <TabsTrigger value="province"><MapPin className="w-4 h-4 mr-1.5" /> Province & FIR</TabsTrigger>
            <TabsTrigger value="mix"><BarChart3 className="w-4 h-4 mr-1.5" /> Mix Classi Raccoglitori</TabsTrigger>
          </TabsList>

          <TabsContent value="province" className="mt-4">
            <div className="mb-3 text-sm text-muted-foreground">
              Matrice mensile dei formulari/FIR raccolti per Regione e Provincia.
              I mesi con 0 raccolte sono evidenziati in rosso. Le province con 2 mesi consecutivi a zero generano un warning.
            </div>
            <ProvinceMatrix data={provinceData} />
          </TabsContent>

          <TabsContent value="mix" className="mt-4">
            <div className="mb-3 text-sm text-muted-foreground">
              Distribuzione percentuale del peso raccolto per classe PFU per ciascun raccoglitore.
              Target consorziali: P=75%, M=20%, G1=4%, G2=1%. Deviazioni significative ({'>'}±5%) evidenziate come warning.
            </div>
            <RaccoglitoriMix data={mixData} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}