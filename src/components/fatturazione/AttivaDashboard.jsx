import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Loader2, Play, CheckCircle, AlertTriangle, Lock, RotateCcw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { oggiRoma } from '@/lib/giornoItaliano';
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
const ADMIN = "Riservato all'amministratore";

export default function AttivaDashboard({ periodo, setPeriodo, data, loading, elaborating, onElabora, onReload, isAdmin, anomalie, onVaiTariffe }) {
  const { anno, mese } = periodo;
  const [anomalieAnteprima, setAnomalieAnteprima] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);
  // Chiusura e riapertura valgono per un canale alla volta: qui c'e' quale
  const [daRiaprire, setDaRiaprire] = useState(null);
  // La chiusura chiede la conferma dell'amministrazione: giorno e, se c'e', numero di fattura
  const [daChiudere, setDaChiudere] = useState(null);
  const [conferma, setConferma] = useState({ data: oggiRoma(), numero: '' });
  const [inCorso, setInCorso] = useState('');
  const [versione, setVersione] = useState(0);
  // Rielaborare un canale solo: quale aspetta conferma, e le anomalie che ne
  // escono, che sostituiscono solo quelle del suo canale.
  const [daRielaborare, setDaRielaborare] = useState(null);
  const [anomalieLocali, setAnomalieLocali] = useState(null);
  const { toast } = useToast();

  // Un'elaborazione del mese intero o un altro periodo: valgono di nuovo le anomalie che arrivano da fuori
  useEffect(() => { setAnomalieLocali(null); }, [anomalie, anno, mese]);

  // Rete, ACI ed extra raccolta sono commesse indipendenti, ciascuna col suo
  // documento e il suo ciclo di vita. Prima Verifica, Approva e Chiudi agivano
  // sui tre documenti insieme e comparivano solo se lo erano tutti e tre: due
  // righe ACI senza tariffa bastavano a far sparire "Approva" anche alla rete
  // verificata al 100%. Ora ogni azione vale per il documento del suo canale.
  // Un'azione rifiutata si dice: prima l'errore veniva inghiottito e il
  // pulsante sembrava non fare niente.
  const cambiaStato = async (t, azione, extra = {}) => {
    const doc = data[t.key]?.documento;
    if (!doc) return;
    setInCorso(`${t.key}|${azione}`);
    try {
      const res = await base44.functions.invoke('cambiaStatoFatturazione', { documento_id: doc.id, azione, ...extra });
      if (azione === 'verifica' && res.data?.errori > 0) toast({ title: `${t.label}: non verificato`, description: `${res.data.errori} righe senza tariffa, il documento resta "elaborata"`, variant: 'destructive' });
    } catch (e) {
      toast({ title: `${t.label}: azione non completata`, description: e?.response?.data?.error || e.message, variant: 'destructive' });
    }
    setInCorso('');
    await onReload();
    setVersione(v => v + 1);
  };

  const senzaTariffa = anomalieAnteprima.filter(a => !a.tipo || a.tipo === 'senza_tariffa');
  // Un documento gia' approvato o esportato non si cancella: resta nello storico come superato.
  const giaUsciti = TIPS.filter(t => ['approvata', 'esportata'].includes(data[t.key]?.documento?.stato));
  // "Elabora Mese" rifa' i canali non chiusi: uno chiuso resta com'e' finche' non lo si riapre.
  const chiusi = TIPS.filter(t => data[t.key]?.documento?.stato === 'chiusa');
  const tuttiChiusi = chiusi.length === TIPS.length;

  const handleElabora = () => {
    if (senzaTariffa.length > 0 || giaUsciti.length > 0 || chiusi.length > 0) setShowConfirm(true);
    else avviaElabora();
  };

  // Un canale si rielabora da solo, senza toccare i documenti degli altri: la
  // rete chiusa non impedisce piu' di rifare l'ACI a cui si e' appena aggiunta
  // la tariffa, e la rete approvata non finisce fra i superati per questo.
  const senzaTariffaDi = (t) => senzaTariffa.filter(a => a.tipologia === t.key);
  const chiediRielabora = (t) => {
    const documento = data[t.key]?.documento;
    const stato = documento?.stato;
    // anche un documento riaperto: era stato chiuso, e resta nello storico come superato
    const riaperto = /Riaperto il /.test(String(documento?.note || ''));
    if (['approvata', 'esportata'].includes(stato) || riaperto || senzaTariffaDi(t).length > 0) setDaRielaborare(t);
    else rielaboraCanale(t);
  };
  const rielaboraCanale = async (t) => {
    setInCorso(`${t.key}|rielabora`);
    try {
      const res = await base44.functions.invoke('elaboraFatturazioneAttiva', { anno, mese, tipologie: [t.key] });
      const nuove = (res.data?.anomalie || []).filter(a => a.tipologia === t.key);
      setAnomalieLocali(prima => [...(prima ?? anomalie ?? []).filter(a => a.tipologia !== t.key), ...nuove]);
      const superati = res.data?.superati || [];
      toast({ title: `${t.label}: rielaborato`, description: superati.length ? `Il documento ${superati[0].stato} resta nello storico come superato. Gli altri canali non sono cambiati.` : 'Gli altri canali non sono cambiati.' });
    } catch (e) {
      toast({ title: `${t.label}: non rielaborato`, description: e?.response?.data?.error || e.message, variant: 'destructive' });
    }
    setInCorso('');
    await onReload();
    setVersione(v => v + 1);
  };

  const avviaElabora = async () => {
    await onElabora();
    setVersione(v => v + 1);
  };

  const confermaElabora = () => {
    setShowConfirm(false);
    avviaElabora();
  };

  const apriChiusura = (t) => {
    setConferma({ data: oggiRoma(), numero: '' });
    setDaChiudere(t);
  };

  // Il documento di un canale si mostra anche quando quello di un altro manca.
  const qualcunoElaborato = TIPS.some(t => data[t.key]?.documento);
  const conErrori = TIPS.filter(t => (data[t.key]?.documento?.voci_errore || 0) > 0);

  const Pulsante = ({ t, azione, children, variant = 'outline', onClick }) => (
    <Button size="sm" variant={variant} disabled={!isAdmin || !!inCorso || !!elaborating} title={!isAdmin ? ADMIN : ''} onClick={onClick || (() => cambiaStato(t, azione))}>
      {inCorso === `${t.key}|${azione}` && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
      {children}
    </Button>
  );

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
        <Button onClick={handleElabora} disabled={elaborating || !isAdmin || !!inCorso || tuttiChiusi} title={!isAdmin ? ADMIN : tuttiChiusi ? 'Tutti i canali del mese sono chiusi: per rielaborarne uno va prima riaperto' : 'Rifà i canali non chiusi; quelli chiusi restano come sono'}>
          {elaborating ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Play className="w-4 h-4 mr-1.5" />}
          Elabora Mese
        </Button>
      </div>

      {/* Riepilogo automatico dovuto da Ecotyre (anteprima) */}
      <RiepilogoEcotyre periodo={periodo} onAnomalieChange={setAnomalieAnteprima} onVaiTariffe={onVaiTariffe} versione={versione} />

      {/* Anomalie rilevate dopo elaborazione (documenta) */}
      <AttivaAnomalie anomalie={anomalieLocali ?? anomalie} />

      {loading ? (
        <div className="text-center py-8 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Caricamento...</div>
      ) : !qualcunoElaborato ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          Nessuna fatturazione attiva elaborata per {mese} {anno}.<br />Clicca "Elabora Mese" per generare.
        </div>
      ) : (
        <>
          {/* Un riquadro per canale, con i suoi numeri e i suoi pulsanti: nessuna
              somma fra i canali, nemmeno delle prestazioni o degli errori. */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {TIPS.map(t => {
              const doc = data[t.key]?.documento;
              if (!doc) {
                return (
                  <div key={t.key} className="border rounded-lg p-4 border-amber-200 bg-amber-50/50 flex flex-col">
                    <h3 className="font-heading font-semibold mb-2">{t.label}</h3>
                    <p className="text-sm text-amber-800">Non elaborato per {mese} {anno}.</p>
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-amber-200">
                      <Pulsante t={t} azione="rielabora" onClick={() => chiediRielabora(t)}><Play className="w-3.5 h-3.5 mr-1" /> Elabora {t.label}</Pulsante>
                    </div>
                  </div>
                );
              }
              const verificate = data[t.key]?.righe?.filter(r => r.stato_validazione === 'verificato').length || 0;
              const errori = doc.voci_errore || 0;
              const sospese = doc.voci_sospese || 0;
              return (
                <div key={t.key} className="border rounded-lg p-4 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-heading font-semibold">{t.label}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded ${STATI[doc.stato] || ''}`}>{doc.stato}</span>
                  </div>
                  <p className="text-2xl font-bold">€ {(doc.totale || 0).toFixed(2)}</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs mt-2">
                    <span className="text-muted-foreground">Prestazioni</span><span className="text-right tabular-nums font-medium">{doc.numero_voci || 0}</span>
                    <span className="text-muted-foreground">Verificate</span><span className="text-right tabular-nums font-medium text-green-600">{verificate}</span>
                    <span className="text-muted-foreground">Errori</span><span className={`text-right tabular-nums font-medium ${errori > 0 ? 'text-red-600' : 'text-green-600'}`}>{errori}</span>
                    <span className="text-muted-foreground">Sospese</span><span className={`text-right tabular-nums font-medium ${sospese > 0 ? 'text-amber-600' : 'text-green-600'}`}>{sospese}</span>
                  </div>
                  {doc.stato === 'chiusa' && doc.fattura_confermata_il && (
                    <p className="text-xs text-emerald-700 mt-2">Fatturazione confermata il {doc.fattura_confermata_il.split('-').reverse().join('/')}{doc.fattura_numero ? ` · fattura ${doc.fattura_numero}` : ''}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
                    {['elaborata', 'verificata'].includes(doc.stato) && <Pulsante t={t} azione="verifica"><CheckCircle className="w-3.5 h-3.5 mr-1" /> Verifica</Pulsante>}
                    {doc.stato === 'verificata' && <Pulsante t={t} azione="approva"><CheckCircle className="w-3.5 h-3.5 mr-1" /> Approva</Pulsante>}
                    {['approvata', 'esportata'].includes(doc.stato) && <Pulsante t={t} azione="chiudi" variant="default" onClick={() => apriChiusura(t)}><Lock className="w-3.5 h-3.5 mr-1" /> Chiudi</Pulsante>}
                    {doc.stato === 'chiusa' && <Pulsante t={t} azione="riapri" onClick={() => setDaRiaprire(t)}><RotateCcw className="w-3.5 h-3.5 mr-1" /> Riapri</Pulsante>}
                    {doc.stato !== 'chiusa' && <Pulsante t={t} azione="rielabora" onClick={() => chiediRielabora(t)}><Play className="w-3.5 h-3.5 mr-1" /> Rielabora</Pulsante>}
                  </div>
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

          {conErrori.length > 0 && (
            <div className="text-sm text-red-600 flex items-center gap-1 border border-red-200 bg-red-50 p-3 rounded-lg">
              <AlertTriangle className="w-4 h-4 shrink-0" /> Prestazioni con errori (tariffa mancante): {conErrori.map(t => `${t.label} ${data[t.key].documento.voci_errore}`).join(' · ')}. Verificare le tariffe nella tab "Tariffe": finché mancano, quel documento non si può verificare; gli altri canali vanno avanti per conto loro.
            </div>
          )}
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
                {chiusi.length > 0 && <p>{chiusi.map(t => t.label).join(', ')}: il documento è chiuso e resta com'è. Si rielaborano solo gli altri canali; per rifare un canale chiuso va prima riaperto.</p>}
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

      <AlertDialog open={!!daChiudere} onOpenChange={(v) => { if (!v) setDaChiudere(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Chiudere {daChiudere?.label} di {mese} {anno}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>Il documento si chiude quando l'amministrazione conferma che la fattura a Ecotyre per questo canale è stata emessa ed è andata a buon fine. Da chiuso non si rielabora più, se non riaprendolo. Gli altri canali restano come sono.</p>
                <div>
                  <label className="text-xs block mb-1 text-foreground">Giorno della conferma dell'amministrazione</label>
                  <Input type="date" className="w-44" value={conferma.data} max={oggiRoma()} onChange={e => setConferma(c => ({ ...c, data: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs block mb-1 text-foreground">Fattura {daChiudere?.label} (facoltativo)</label>
                  <Input placeholder="numero" className="w-56" value={conferma.numero} onChange={e => setConferma(c => ({ ...c, numero: e.target.value }))} />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction disabled={!conferma.data} onClick={() => { const t = daChiudere; setDaChiudere(null); cambiaStato(t, 'chiudi', { conferma: { data: conferma.data, numero: conferma.numero || '' } }); }}>Conferma e chiudi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!daRiaprire} onOpenChange={(v) => { if (!v) setDaRiaprire(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Riaprire {daRiaprire?.label} di {mese} {anno}?</AlertDialogTitle>
            <AlertDialogDescription>
              Il documento torna allo stato "elaborata" e si può rielaborare col suo pulsante "Rielabora". La riapertura resta scritta nelle sue note: chi, quando, da che stato e la conferma di fattura che aveva. Gli altri canali restano come sono.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const t = daRiaprire; setDaRiaprire(null); cambiaStato(t, 'riapri'); }}>Riapri</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rielaborare un canale solo: si chiede conferma quando il suo documento
          e' gia' uscito o quando restano righe senza tariffa, come per il mese. */}
      <AlertDialog open={!!daRielaborare} onOpenChange={(v) => { if (!v) setDaRielaborare(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rielaborare {daRielaborare?.label} di {mese} {anno}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                {daRielaborare && senzaTariffaDi(daRielaborare).length > 0 && <p>{senzaTariffaDi(daRielaborare).length} gruppi di righe di questo canale non hanno una tariffa applicabile: saranno salvati a zero euro e segnati come errore, e il documento non potrà essere verificato finché la tariffa manca.</p>}
                {daRielaborare && ['approvata', 'esportata'].includes(data[daRielaborare.key]?.documento?.stato) && <p>Il documento è già stato {data[daRielaborare.key].documento.stato}. Non viene cancellato: resta nello storico come superato, con la data e i due totali a confronto.</p>}
                {daRielaborare && !['approvata', 'esportata'].includes(data[daRielaborare.key]?.documento?.stato) && /Riaperto il /.test(String(data[daRielaborare.key]?.documento?.note || '')) && <p>Il documento era stato chiuso e poi riaperto. Non viene cancellato: resta nello storico come superato, con la nota della riapertura e della fattura, e la nota passa al documento nuovo.</p>}
                <p>Gli altri canali non vengono toccati.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const t = daRielaborare; setDaRielaborare(null); rielaboraCanale(t); }}>Rielabora</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
