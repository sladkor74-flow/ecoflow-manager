import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, RefreshCw, AlertTriangle, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import { usePermessi } from '@/lib/permessi';
import { BannerSolaLettura } from '@/components/shared/SolaLettura';
import { formatTonnellate } from '@/lib/utils';
import Riepilogo from '@/components/dichiarazioni/Riepilogo';
import SezioneImpianto from '@/components/dichiarazioni/SezioneImpianto';
import Quadratura from '@/components/dichiarazioni/Quadratura';
import DialogoMese from '@/components/dichiarazioni/DialogoMese';
import { esportaDichiarazioni } from '@/lib/dichiarazioniExport';

// Dichiarazioni degli impianti: che cosa ogni impianto ricava dai PFU che gli
// conferiamo, mese per mese, e come questo decurta la giacenza a portale.

const ANNI = [2026, 2025];

function Kpi({ titolo, valore, nota, tono }) {
  const colore = tono === 'buono' ? 'text-emerald-700' : tono === 'attenzione' ? 'text-amber-700' : tono === 'male' ? 'text-red-700' : '';
  return (
    <div className="border rounded-xl bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{titolo}</p>
      <p className={`text-xl font-semibold tabular-nums ${colore}`}>{valore}</p>
      {nota && <p className="text-xs text-muted-foreground mt-0.5">{nota}</p>}
    </div>
  );
}

export default function DichiarazioniImpianti() {
  const { isAdmin, soloLettura } = usePermessi();
  const [anno, setAnno] = useState(2026);
  const [dati, setDati] = useState(null);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState('');
  const [apertura, setApertura] = useState(null);

  const carica = useCallback(async () => {
    setCaricamento(true);
    setErrore('');
    try {
      const res = await base44.functions.invoke('riepilogoDichiarazioni', { anno });
      setDati(res.data);
    } catch (e) {
      setErrore(e?.response?.data?.error || e.message);
    } finally {
      setCaricamento(false);
    }
  }, [anno]);
  useEffect(() => { carica(); }, [carica]);

  const apri = (sito, flusso, mese) => { if (!soloLettura) setApertura({ sito, flusso, mese }); };
  const totali = dati ? dati.totali : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dichiarazioni Impianti</h1>
          <p className="text-sm text-muted-foreground max-w-3xl">
            Ogni mese gli impianti dichiarano che cosa hanno ricavato dai PFU che abbiamo conferito: granulo, metalli ferrosi e fibre
            per chi fa recupero di materia, ciabattato o cippato per chi fa valorizzazione energetica. Le dichiarazioni di Irigom le prepariamo noi.
            Quando una dichiarazione viene caricata a portale, decurta la giacenza dell'impianto.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(anno)} onValueChange={v => setAnno(Number(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{ANNI.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" className="gap-1" onClick={carica} disabled={caricamento}>
            {caricamento ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Aggiorna
          </Button>
          <Button variant="outline" className="gap-1" disabled={!dati} onClick={() => esportaDichiarazioni(dati)}>
            <FileSpreadsheet className="w-4 h-4" /> Esporta
          </Button>
        </div>
      </div>

      {soloLettura && <BannerSolaLettura cosa="le dichiarazioni degli impianti" />}
      {errore && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{errore}</p>}

      {caricamento && !dati && (
        <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carico le dichiarazioni…</p>
      )}

      {dati && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi titolo="Dichiarato e caricato a portale" valore={`${formatTonnellate(totali.dichiarato_caricato_t)} t`} nota={`su ${formatTonnellate(totali.dichiarato_totale_t)} t dichiarate`} />
            <Kpi titolo="Conferito rete nell'anno" valore={`${formatTonnellate(totali.conferito_t)} t`} />
            <Kpi titolo="Giacenza che risulta" valore={`${formatTonnellate(totali.giacenza_calcolata_t)} t`} nota={`a portale ${formatTonnellate(totali.giacenza_portale_t)} t`} />
            <Kpi
              titolo="Quadratura con il portale"
              valore={`${totali.siti_che_quadrano} su ${totali.siti_che_quadrano + totali.siti_da_quadrare}`}
              nota={totali.siti_da_quadrare ? `${totali.siti_da_quadrare} da verificare` : 'tutti in linea'}
              tono={totali.siti_da_quadrare ? 'male' : 'buono'}
            />
          </div>

          <Tabs defaultValue="riepilogo">
            <TabsList>
              <TabsTrigger value="riepilogo">Riepilogo</TabsTrigger>
              <TabsTrigger value="impianti">Impianti</TabsTrigger>
              <TabsTrigger value="quadratura" className="gap-1">
                Quadratura
                {totali.siti_da_quadrare > 0 ? <AlertTriangle className="w-3.5 h-3.5 text-red-600" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="riepilogo" className="mt-4">
              <Riepilogo dati={dati} onApri={apri} soloLettura={soloLettura} />
            </TabsContent>

            <TabsContent value="impianti" className="mt-4 space-y-4">
              {dati.siti.map(s => <SezioneImpianto key={s.chiave} sito={s} onApri={apri} soloLettura={soloLettura} />)}
            </TabsContent>

            <TabsContent value="quadratura" className="mt-4">
              <Quadratura dati={dati} />
            </TabsContent>
          </Tabs>
        </>
      )}

      {apertura && isAdmin && (
        <DialogoMese
          sito={apertura.sito}
          flusso={apertura.flusso}
          mese={apertura.mese}
          anno={anno}
          onChiudi={() => setApertura(null)}
          onSalvato={() => { setApertura(null); carica(); }}
        />
      )}
    </div>
  );
}
