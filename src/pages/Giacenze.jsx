import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { RefreshCw, Download, FileText, Settings, ClipboardList, Upload } from 'lucide-react';
import GiacenzeKpi from '@/components/giacenze/GiacenzeKpi';
import GiacenzeTable from '@/components/giacenze/GiacenzeTable';
import AciTable from '@/components/giacenze/AciTable';
import DichiarazioniMancanti from '@/components/giacenze/DichiarazioniMancanti';
import SitiManager from '@/components/giacenze/SitiManager';
import DichiarazioniGrid from '@/components/giacenze/DichiarazioniGrid';
import { exportGiacenzeExcel, exportGiacenzePDF } from '@/lib/giacenzeExport';

export default function Giacenze() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [anno, setAnno] = useState(2026);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSiti, setShowSiti] = useState(false);
  const [showDichiarazioni, setShowDichiarazioni] = useState(false);
  const [seedSimula, setSeedSimula] = useState(null);
  const [seedConfirm, setSeedConfirm] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try { const res = await base44.functions.invoke('calcolaGiacenze', { anno }); setData(res.data); } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { loadData(); }, [anno]);

  const destinazioni = data ? [...new Set(data.righe.map(r => r.sito))].sort() : [];

  const handleSeed = async () => {
    setSeeding(true);
    try { const res = await base44.functions.invoke('seedGiacenze2026', { simula: true }); setSeedSimula(res.data); setSeedConfirm(true); } catch (e) { alert(e.message); }
    setSeeding(false);
  };
  const confirmSeed = async () => {
    setSeeding(true);
    try { await base44.functions.invoke('seedGiacenze2026', { simula: false }); setSeedConfirm(false); await loadData(); } catch (e) { alert(e.message); }
    setSeeding(false);
  };

  const aciRighe = data ? data.righe.filter(r => r.aci_in_primarie_t || r.aci_in_sec_t || r.aci_out_sec_t || r.aci_dichiarato_t || r.aci_predisposto_t || r.giacenza_aci_t || r.divergenza_portale_t) : [];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-heading font-bold text-xl">Giacenze</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(anno)} onValueChange={v => setAnno(Number(v))}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>{[2024, 2025, 2026, 2027].map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}><RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Ricalcola</Button>
          {isAdmin && <Button variant="outline" size="sm" onClick={() => setShowSiti(true)}><Settings className="w-4 h-4 mr-1" /> Configura siti</Button>}
          {isAdmin && <Button variant="outline" size="sm" onClick={() => setShowDichiarazioni(true)}><ClipboardList className="w-4 h-4 mr-1" /> Dichiarazioni</Button>}
          {isAdmin && <Button variant="outline" size="sm" onClick={handleSeed} disabled={seeding}><Upload className="w-4 h-4 mr-1" /> Importa 2026</Button>}
          <Button variant="outline" size="sm" onClick={() => exportGiacenzeExcel(data.righe, data.totali, aciRighe, anno)} disabled={!data}><FileText className="w-4 h-4 mr-1" /> Excel</Button>
          <Button variant="outline" size="sm" onClick={() => exportGiacenzePDF(data.righe, data.totali, aciRighe, anno)} disabled={!data}><Download className="w-4 h-4 mr-1" /> PDF</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : data ? (
        <>
          <GiacenzeKpi totali={data.totali} />
          <DichiarazioniMancanti mancanti={data.dichiarazioni_mancanti} />
          <div className="space-y-1">
            <h3 className="font-heading font-semibold text-sm">Giacenze impianti e stoccaggi</h3>
            <GiacenzeTable righe={data.righe} totali={data.totali} />
          </div>
          <AciTable righe={aciRighe} />
        </>
      ) : <div className="text-center py-12 text-muted-foreground">Errore nel caricamento.</div>}

      <SitiManager open={showSiti} onClose={() => setShowSiti(false)} anno={anno} destinazioni={destinazioni} />
      <DichiarazioniGrid open={showDichiarazioni} onClose={() => setShowDichiarazioni(false)} anno={anno} />

      <AlertDialog open={seedConfirm} onOpenChange={setSeedConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Importa configurazione 2026</AlertDialogTitle>
            <AlertDialogDescription>
              {seedSimula && (
                <span>
                  Verranno inseriti {seedSimula.giacenze_da_creare} siti e {seedSimula.dichiarazioni_da_creare} dichiarazioni.
                  {seedSimula.giacenze_gia_presenti > 0 && ` (${seedSimula.giacenze_gia_presenti} siti e ${seedSimula.dichiarazioni_gia_presenti} dichiarazioni già presenti e saranno saltati).`}
                  {' '}Confermi l'inserimento?
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={seeding}>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSeed} disabled={seeding}>{seeding ? 'Inserimento...' : 'Conferma'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}