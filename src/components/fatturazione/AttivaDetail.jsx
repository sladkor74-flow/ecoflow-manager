import React, { useState } from 'react';
import { Loader2, FileSpreadsheet, FileDown } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import RigaDetailModal from './RigaDetailModal';
import { formatKg, formatNumber } from '@/lib/utils';
import { esportaTabellaExcel, esportaTabellaPdf } from '@/lib/esportaTabella';

const TIPS = [
  { key: 'RETE', label: 'Rete' },
  { key: 'ACI', label: 'ACI' },
  { key: 'EXTRA_RACCOLTA', label: 'Extra' },
];
const NOMI = { RETE: 'Rete', ACI: 'ACI', EXTRA_RACCOLTA: 'Extra raccolta', anomalie: 'Anomalie e sospesi' };

const statoRiga = (r) => (r.sospesa ? 'sospesa' : r.stato_validazione === 'errore' ? 'errore' : 'ok');
const euro = (v) => `€ ${formatNumber(v || 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Colonne del dettaglio, uguali a video e nelle esportazioni. La regione e' quella
// del punto di raccolta in cui e' avvenuto il ritiro.
const COLONNE = [
  { titolo: 'Ordine', valore: r => r.ordine || '', tipo: 'testo', peso: 1.25 },
  { titolo: 'Fine trasporto', valore: r => r.data_fine_trasporto || null, tipo: 'data', peso: 0.95 },
  { titolo: 'FIR', valore: r => r.numero_fir || '', tipo: 'testo', peso: 1.35 },
  { titolo: 'Regione ritiro', valore: r => r.regione || '', tipo: 'testo', peso: 1.1 },
  { titolo: 'Classe', valore: r => r.classe || '', tipo: 'testo', peso: 0.7 },
  { titolo: 'Quantità (kg)', valore: r => r.quantita ?? null, tipo: 'kg', peso: 0.95 },
  { titolo: 'Prezzo unitario', valore: r => r.tariffa_valore ?? null, tipo: 'prezzo', peso: 1 },
  { titolo: 'Totale', valore: r => r.totale ?? null, tipo: 'euro', peso: 1 },
  { titolo: 'Stato', valore: statoRiga, tipo: 'testo', peso: 0.7 },
];
const I_KG = 5, I_TOT = 7;

export default function AttivaDetail({ data, loading, periodo }) {
  const [subTab, setSubTab] = useState('RETE');
  const [selectedRiga, setSelectedRiga] = useState(null);
  const [esportando, setEsportando] = useState(null);
  const { toast } = useToast();

  if (loading) return <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin inline" /></div>;

  const allRighe = [...(data.RETE?.righe || []), ...(data.ACI?.righe || []), ...(data.EXTRA_RACCOLTA?.righe || [])];
  const sospese = allRighe.filter(r => r.sospesa);
  const errori = allRighe.filter(r => r.stato_validazione === 'errore');
  const periodoTesto = periodo ? `${periodo.mese} ${periodo.anno}` : '';

  const esporta = async (formato, chiave, righe) => {
    if (!righe.length) { toast({ title: 'Nessuna riga da esportare' }); return; }
    setEsportando(`${chiave}-${formato}`);
    try {
      // Il totale fatturabile esclude le prestazioni sospese, come nelle esportazioni ufficiali.
      const valide = righe.filter(r => !r.sospesa);
      const opzioni = {
        nomeFile: `Fatturazione attiva ${NOMI[chiave]} ${periodoTesto}`,
        foglio: NOMI[chiave],
        intestazione: 'SMOCO S.r.l.  ·  COMMESSA ECOTYRE  ·  FATTURAZIONE ATTIVA',
        titolo: `Dettaglio ${NOMI[chiave]} — ${periodoTesto}`,
        sottotitolo: `${righe.length} ${righe.length === 1 ? 'riga' : 'righe'}`,
        colonne: COLONNE,
        righe,
        totali: {
          etichetta: valide.length === righe.length ? 'TOTALE' : 'TOTALE (escluse sospese)',
          valori: { [I_KG]: valide.reduce((s, r) => s + (Number(r.quantita) || 0), 0), [I_TOT]: Math.round(valide.reduce((s, r) => s + (Number(r.totale) || 0), 0) * 100) / 100 },
        },
        colore: (r) => (r.sospesa ? 'ambra' : r.stato_validazione === 'errore' ? 'rosso' : null),
      };
      if (formato === 'excel') await esportaTabellaExcel(opzioni);
      else await esportaTabellaPdf(opzioni);
    } catch (e) {
      toast({ title: 'Esportazione non riuscita', description: e.message || String(e), variant: 'destructive' });
    }
    setEsportando(null);
  };

  function barraEsportazione(chiave, righe) {
    const kg = righe.filter(r => !r.sospesa).reduce((s, r) => s + (Number(r.quantita) || 0), 0);
    const totale = righe.filter(r => !r.sospesa).reduce((s, r) => s + (Number(r.totale) || 0), 0);
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <p className="text-sm text-muted-foreground">
          {righe.length} righe · {formatKg(kg)} kg · <span className="font-medium text-foreground">{euro(totale)}</span>
          {righe.some(r => r.sospesa) && ' (escluse le sospese)'}
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={!righe.length || !!esportando} onClick={() => esporta('excel', chiave, righe)}>
            {esportando === `${chiave}-excel` ? <Loader2 className="animate-spin" /> : <FileSpreadsheet className="text-emerald-700" />} Excel
          </Button>
          <Button size="sm" variant="outline" disabled={!righe.length || !!esportando} onClick={() => esporta('pdf', chiave, righe)}>
            {esportando === `${chiave}-pdf` ? <Loader2 className="animate-spin" /> : <FileDown className="text-red-700" />} PDF
          </Button>
        </div>
      </div>
    );
  }

  function renderTable(righe) {
    if (!righe || righe.length === 0) return <div className="text-center py-6 text-muted-foreground">Nessuna riga.</div>;
    return (
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted"><tr>
            <th className="text-left px-2 py-2 font-semibold">Ordine</th>
            <th className="text-left px-2 py-2 font-semibold">FIR</th>
            <th className="text-left px-2 py-2 font-semibold">Regione ritiro</th>
            <th className="text-left px-2 py-2 font-semibold">Classe</th>
            <th className="text-right px-2 py-2 font-semibold">Quantità</th>
            <th className="text-right px-2 py-2 font-semibold">Prezzo</th>
            <th className="text-right px-2 py-2 font-semibold">Totale</th>
            <th className="text-center px-2 py-2 font-semibold">Stato</th>
          </tr></thead>
          <tbody>
            {righe.map((r, i) => (
              <tr key={r.id || i} className={`cursor-pointer hover:bg-muted/30 ${r.sospesa ? 'opacity-50' : ''} ${i % 2 ? 'bg-muted/20' : ''}`} onClick={() => setSelectedRiga(r)}>
                <td className="px-2 py-1.5 font-mono text-xs">{r.ordine || '-'}</td>
                <td className="px-2 py-1.5 text-xs">{r.numero_fir || '-'}</td>
                <td className="px-2 py-1.5">{r.regione || <span className="text-muted-foreground">—</span>}</td>
                <td className="px-2 py-1.5">{r.classe || '-'}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatKg(r.quantita)} kg</td>
                <td className="px-2 py-1.5 text-right tabular-nums">€ {formatNumber(r.tariffa_valore || 0, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</td>
                <td className="px-2 py-1.5 text-right tabular-nums font-medium">{euro(r.totale)}</td>
                <td className="text-center px-2 py-1.5">
                  {r.sospesa ? <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">sospesa</span>
                    : r.stato_validazione === 'errore' ? <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">errore</span>
                    : <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">ok</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const anomalie = [...sospese, ...errori.filter(r => !r.sospesa)];

  return (
    <>
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList>
          {TIPS.map(t => <TabsTrigger key={t.key} value={t.key}>{t.label} ({data[t.key]?.righe?.length || 0})</TabsTrigger>)}
          <TabsTrigger value="anomalie">Anomalie & Sospesi ({sospese.length + errori.length})</TabsTrigger>
        </TabsList>
        {TIPS.map(t => (
          <TabsContent key={t.key} value={t.key} className="mt-3">
            {barraEsportazione(t.key, data[t.key]?.righe || [])}
            {renderTable(data[t.key]?.righe)}
          </TabsContent>
        ))}
        <TabsContent value="anomalie" className="mt-3">
          {sospese.length === 0 && errori.length === 0 ? (
            <div className="text-center py-6 text-green-600">Nessuna anomalia. Tutte le prestazioni sono verificate.</div>
          ) : (
            <div className="space-y-3">
              {barraEsportazione('anomalie', anomalie)}
              {sospese.length > 0 && (
                <div>
                  <h3 className="font-semibold text-amber-700 mb-2">⚠ Prestazioni Sospese ({sospese.length})</h3>
                  {renderTable(sospese)}
                </div>
              )}
              {errori.length > 0 && (
                <div>
                  <h3 className="font-semibold text-red-700 mb-2">🔴 Prestazioni con Errori ({errori.length})</h3>
                  {renderTable(errori)}
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
      <RigaDetailModal riga={selectedRiga} onClose={() => setSelectedRiga(null)} />
    </>
  );
}
