import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Loader2, Play, CheckCircle, AlertTriangle, Lock, RotateCcw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import RiepilogoEcotyre from './RiepilogoEcotyre';
import AttivaAnomalie from './AttivaAnomalie';

const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const ANNI = [2024, 2025, 2026];
const STATI = {
  elaborata: 'bg-blue-100 text-blue-700', verificata: 'bg-green-100 text-green-700',
  approvata: 'bg-purple-100 text-purple-700', esportata: 'bg-cyan-100 text-cyan-700',
  chiusa: 'bg-emerald-100 text-emerald-700', bozza: 'bg-gray-100 text-gray-700',
};
const TIPS = [
  { key: 'RETE', label: 'Rete' },
  { key: 'ACI', label: 'ACI' },
  { key: 'EXTRA_RACCOLTA', label: 'Extra Raccolta' },
];

export default function AttivaDashboard({ periodo, setPeriodo, data, loading, elaborating, onElabora, onReload, isAdmin, anomalie, onVaiTariffe }) {
  const { anno, mese } = periodo;
  const [anomalieAnteprima, setAnomalieAnteprima] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showRiapri, setShowRiapri] = useState(false);
  // La chiusura chiede la conferma dell'amministrazione: giorno e, se c'e', numero di fattura per canale
  const [showChiudi, setShowChiudi] = useState(false);
  const [conferma, setConferma] = useState({ data: new Date().toISOString().slice(0, 10), numeri: {} });
  const [versione, setVersione] = useState(0);
  const { toast } = useToast();

  // Un'azione rifiutata si dice: prima l'errore veniva inghiottito e il pulsante
  // sembrava non fare niente.
  const cambiaStato = async (azione, extra = null) => {
    const rifiuti = [];
    for (const t of TIPS) {
      const doc = data[t.key]?.documento;
      if (!doc) continue;
      try {
        const res = await base44.functions.invoke('cambiaStatoFatturazione', { documento_id: doc.id, azione, ...(extra ? extra(t) : {}) });
        if (azione === 'verifica' && res.data?.errori > 0) rifiuti.push(`${t.label}: ${res.data.errori} righe senza tariffa, il documento resta "elaborata"`);
      } catch (e) {
        rifiuti.push(`${t.label}: ${e?.response?.data?.error || e.message}`);
      }
    }
    if (rifiuti.length > 0) toast({ title: 'Azione non completata', description: rifiuti.join(' — '), variant: 'destructive' });
    await onReload();
    setVersione(v => v + 1);
  };

  const senzaTariffa = anomalieAnteprima.filter(a => !a.tipo || a.tipo === 'senza_tariffa');
  // Un documento gia' approvato o esportato non si cancella: resta nello storico come superato.
  const giaUsciti = TIPS.filter(t => ['approvata', 'esportata'].includes(data[t.key]?.documento?.stato));

  const handleElabora = () => {
    if (senzaTariffa.length > 0 || giaUsciti.length > 0) setShowConfirm(true);
    else avviaElabora();
  };

  const avviaElabora = async () => {
    await onElabora();
    setVersione(v => v + 1);
  };

  const confermaElabora = () => {
    setShowConfirm(false);
    avviaElabora();
  };

  const errori = TIPS.reduce((s, t) => s + (data[t.key]?.documento?.voci_errore || 0), 0);
  const sospesi = TIPS.reduce((s, t) => s + (data[t.key]?.documento?.voci_sospese || 0), 0);
  const tuttiElaborati = TIPS.every(t => data[t.key]?.documento);
  const tuttiVerificati = TIPS.every(t => data[t.key]?.documento?.stato === 'verificata');
  const tuttiApprovati = TIPS.every(t => data[t.key]?.documento?.stato === 'approvata' || data[t.key]?.documento?.stato === 'esportata');
  const qualcunoChiuso = TIPS.some(t => data[t.key]?.documento?.stato === 'chiusa');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 p-4 border rounded-lg bg-muted/30">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Anno</label>
          <Select value={String(anno)} onValueChange={v => setPeriodo({ ...periodo, anno: Number(v) })}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{ANNI.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Mese</label>
          <Select value={mese} onValueChange={v => setPeriodo({ ...periodo, mese: v })}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>{MESI.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button onClick={handleElabora} disabled={elaborating || !isAdmin} title={!isAdmin ? "Riservato all'amministratore" : ''}>
          {elaborating ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Play className="w-4 h-4 mr-1.5" />}
          Elabora Mese
        </Button>
      </div>

      {/* Riepilogo automatico dovuto da Ecotyre (anteprima) */}
      <RiepilogoEcotyre periodo={periodo} onAnomalieChange={setAnomalieAnteprima} onVaiTariffe={onVaiTariffe} versione={versione} />

      {/* Anomalie rilevate dopo elaborazione (documenta) */}
      <AttivaAnomalie anomalie={anomalie} />

      {loading ? (
        <div className="text-center py-8 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Caricamento...</div>
      ) : !tuttiElaborati ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          Nessuna fatturazione attiva elaborata per {mese} {anno}.<br />Clicca "Elabora Mese" per generare.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {TIPS.map(t => {
              const doc = data[t.key]?.documento;
              const tot = data[t.key]?.documento?.totale || 0;
              const voci = data[t.key]?.documento?.numero_voci || 0;
              return (
                <div key={t.key} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-heading font-semibold">{t.label}</h3>
                    {doc && <span className={`text-xs px-2 py-0.5 rounded ${STATI[doc.stato] || ''}`}>{doc.stato}</span>}
                  </div>
                  <p className="text-2xl font-bold">€ {tot.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{voci} prestazioni</p>
                  {doc?.stato === 'chiusa' && doc.fattura_confermata_il && (
                    <p className="text-xs text-emerald-700 mt-1">Fatturazione confermata il {doc.fattura_confermata_il.split('-').reverse().join('/')}{doc.fattura_numero ? ` · fattura ${doc.fattura_numero}` : ''}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Rete, ACI ed extra raccolta sono commesse indipendenti: i totali
              restano tre, uno accanto all'altro. Un totale unico che li somma
              non vuol dire niente e non si fattura a nessuno. */}
          <div className="border rounded-lg p-4 bg-primary/5">
            <h3 className="font-heading font-bold text-lg mb-1">TOTALE FATTURAZIONE ATTIVA</h3>
            <p className="text-xs text-muted-foreground mb-3">Le tre commesse sono indipendenti e non si sommano.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {TIPS.map(t => (
                <div key={t.key} className="flex items-baseline justify-between gap-2 border-t pt-2 sm:border-t-0 sm:pt-0">
                  <span className="text-sm font-medium">{t.label}</span>
                  <span className="text-xl font-bold tabular-nums">€ {(data[t.key]?.documento?.totale || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="border rounded-lg p-3"><p className="text-xs text-muted-foreground">Prestazioni</p><p className="text-lg font-bold">{TIPS.reduce((s, t) => s + (data[t.key]?.documento?.numero_voci || 0), 0)}</p></div>
            <div className="border rounded-lg p-3"><p className="text-xs text-muted-foreground">🟢 Verificate</p><p className="text-lg font-bold text-green-600">{TIPS.reduce((s, t) => s + (data[t.key]?.righe?.filter(r => r.stato_validazione === 'verificato').length || 0), 0)}</p></div>
            <div className="border rounded-lg p-3"><p className="text-xs text-muted-foreground">🔴 Errori</p><p className={`text-lg font-bold ${errori > 0 ? 'text-red-600' : 'text-green-600'}`}>{errori}</p></div>
            <div className="border rounded-lg p-3"><p className="text-xs text-muted-foreground">⚠ Sospese</p><p className={`text-lg font-bold ${sospesi > 0 ? 'text-amber-600' : 'text-green-600'}`}>{sospesi}</p></div>
          </div>

          {errori > 0 && (
            <div className="text-sm text-red-600 flex items-center gap-1 border border-red-200 bg-red-50 p-3 rounded-lg">
              <AlertTriangle className="w-4 h-4" /> {errori} prestazioni con errori (tariffa mancante). Verificare le tariffe nella tab "Tariffe".
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={!isAdmin} title={!isAdmin ? "Riservato all'amministratore" : ''} onClick={() => cambiaStato('verifica')}><CheckCircle className="w-4 h-4 mr-1.5" /> Verifica</Button>
            {tuttiVerificati && <Button variant="outline" disabled={!isAdmin} title={!isAdmin ? "Riservato all'amministratore" : ''} onClick={() => cambiaStato('approva')}><CheckCircle className="w-4 h-4 mr-1.5" /> Approva</Button>}
            {tuttiApprovati && <Button disabled={!isAdmin} title={!isAdmin ? "Riservato all'amministratore" : ''} onClick={() => setShowChiudi(true)}><Lock className="w-4 h-4 mr-1.5" /> Chiudi Periodo</Button>}
            {qualcunoChiuso && <Button variant="outline" disabled={!isAdmin} title={!isAdmin ? "Riservato all'amministratore" : ''} onClick={() => setShowRiapri(true)}><RotateCcw className="w-4 h-4 mr-1.5" /> Riapri periodo</Button>}
          </div>
        </>
      )}

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confermi l'elaborazione?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                {senzaTariffa.length > 0 && <p>Alcune tonnellate non hanno una tariffa applicabile: le righe saranno salvate a zero euro e segnate come errore, e il documento non potrà essere verificato finché la tariffa manca.</p>}
                {giaUsciti.length > 0 && <p>{giaUsciti.map(t => t.label).join(', ')}: il documento di questo mese è già stato approvato o esportato. Non viene cancellato: resta nello storico come superato, con la data e i due totali a confronto.</p>}
                <p>Confermi di voler elaborare?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={confermaElabora}>Elabora comunque</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showChiudi} onOpenChange={setShowChiudi}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Chiudere {mese} {anno}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>Il mese si chiude quando l'amministrazione conferma che la fattura a Ecotyre è stata emessa ed è andata a buon fine. Da chiuso non si rielabora più, se non riaprendolo.</p>
                <div>
                  <label className="text-xs block mb-1 text-foreground">Giorno della conferma dell'amministrazione</label>
                  <Input type="date" className="w-44" value={conferma.data} max={new Date().toISOString().slice(0, 10)} onChange={e => setConferma(c => ({ ...c, data: e.target.value }))} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {TIPS.filter(t => (data[t.key]?.documento?.totale || 0) > 0).map(t => (
                    <div key={t.key}>
                      <label className="text-xs block mb-1 text-foreground">Fattura {t.label} (facoltativo)</label>
                      <Input placeholder="numero" value={conferma.numeri[t.key] || ''} onChange={e => setConferma(c => ({ ...c, numeri: { ...c.numeri, [t.key]: e.target.value } }))} />
                    </div>
                  ))}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction disabled={!conferma.data} onClick={() => { setShowChiudi(false); cambiaStato('chiudi', (t) => ({ conferma: { data: conferma.data, numero: conferma.numeri[t.key] || '' } })); }}>Conferma e chiudi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showRiapri} onOpenChange={setShowRiapri}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Riaprire {mese} {anno}?</AlertDialogTitle>
            <AlertDialogDescription>
              I documenti tornano allo stato "elaborata" e il mese si può rielaborare. La riapertura resta scritta nelle note di ogni documento: chi, quando e da che stato.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowRiapri(false); cambiaStato('riapri'); }}>Riapri</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}