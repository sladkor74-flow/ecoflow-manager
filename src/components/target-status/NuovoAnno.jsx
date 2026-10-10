import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { RefreshCw, CheckCircle2, AlertTriangle, Circle, Copy } from 'lucide-react';

// L'ANNO NUOVO: CHE COSA GLI MANCA PER COMINCIARE.
//
// Il contratto con Ecotyre e con tutti i fornitori e' annuale senza tacito
// rinnovo (regola dell'utente, 06/10/2026): il 31 dicembre scade tutto. La voce
// che morde per prima sono le tariffe, perche' dal 1° gennaio una riga senza
// tariffa vale zero euro e nasce in errore, sulla attiva come sulla passiva - e
// fino al 10/10/2026 nessuno le copiava, mentre impianti, target e contratto
// l'anno nuovo se li portava dietro da solo.
//
// Questa scheda non decide niente: dice, voce per voce, se l'anno e' pronto,
// che cosa manca e dove si rimedia. L'unica cosa che fa da se' e' preparare le
// tariffe, col prezzo dell'anno prima e la nota «da confermare»: la riga c'e' e
// la fatturazione riparte, ma il dubbio resta scritto finche' qualcuno non la
// guarda sul contratto.
//
// La regola sta in base44/shared/inizializzazioneAnno.ts, con le sue prove.

const STILE = {
  pronto: { fondo: 'border-emerald-300 bg-emerald-50', testo: 'text-emerald-800', Icona: CheckCircle2 },
  parziale: { fondo: 'border-amber-300 bg-amber-50', testo: 'text-amber-900', Icona: AlertTriangle },
  manca: { fondo: 'border-amber-300 bg-amber-50', testo: 'text-amber-900', Icona: AlertTriangle },
};

export default function NuovoAnno({ anno: annoCorrente }) {
  const { toast } = useToast();
  const prossimo = Number(annoCorrente) + 1;
  const [anno, setAnno] = useState(prossimo);
  const [dati, setDati] = useState(null);
  const [errore, setErrore] = useState('');
  const [caricamento, setCaricamento] = useState(true);
  const [inCorso, setInCorso] = useState('');
  const [conferma, setConferma] = useState(null);

  const carica = useCallback(async () => {
    setCaricamento(true);
    try {
      const res = await base44.functions.invoke('preparaAnno', { anno, azione: 'verifica' });
      if (res.data && res.data.error) throw new Error(res.data.error);
      setDati(res.data);
      setErrore('');
    } catch (e) {
      setErrore(e?.response?.data?.error || e?.message || String(e));
    }
    setCaricamento(false);
  }, [anno]);

  useEffect(() => { carica(); }, [carica]);

  const simula = async () => {
    setInCorso('simula');
    try {
      const res = await base44.functions.invoke('preparaAnno', { anno, azione: 'copia_tariffe', simula: true });
      if (res.data && res.data.error) throw new Error(res.data.error);
      setConferma(res.data);
    } catch (e) {
      toast({ title: 'Non si e’ riusciti a preparare le tariffe', description: e?.response?.data?.error || e?.message, variant: 'destructive' });
    }
    setInCorso('');
  };

  const copia = async () => {
    setInCorso('copia');
    try {
      const res = await base44.functions.invoke('preparaAnno', { anno, azione: 'copia_tariffe' });
      if (res.data && res.data.error) throw new Error(res.data.error);
      setDati(res.data);
      setConferma(null);
      const falliti = (res.data.falliti || []).length;
      toast({
        title: `${res.data.creati} ${res.data.creati === 1 ? 'tariffa preparata' : 'tariffe preparate'} per il ${anno}`,
        description: falliti
          ? `${falliti} non si sono potute scrivere: ${res.data.falliti.map(f => `${f.chi} (${f.motivo})`).join(' · ')}`
          : 'Portano il prezzo dell’anno prima e la nota «da confermare»: vanno controllate sul contratto.',
        variant: falliti ? 'destructive' : undefined,
      });
    } catch (e) {
      toast({ title: 'Non si e’ riusciti a preparare le tariffe', description: e?.response?.data?.error || e?.message, variant: 'destructive' });
    }
    setInCorso('');
  };

  if (caricamento && !dati) {
    return <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!dati) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-muted-foreground">La verifica dell&apos;anno non ha risposto{errore ? <>: <span className="text-foreground">{errore}</span></> : '.'}</p>
        <Button variant="outline" size="sm" onClick={carica}><RefreshCw className="w-4 h-4 mr-1" /> Riprova</Button>
      </div>
    );
  }

  const giorni = dati.giorni_al_primo_gennaio;
  const anni = [prossimo - 1, prossimo, prossimo + 1];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-heading font-bold text-lg">Preparare il {dati.anno}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-3xl">
            Il contratto con Ecotyre e con tutti i fornitori è annuale senza tacito rinnovo: il 31 dicembre scade tutto.
            Qui c&apos;è che cosa serve all&apos;anno nuovo per cominciare e che cosa gli manca ancora.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(anno)} onValueChange={v => setAnno(Number(v))}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>{anni.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={carica} disabled={caricamento}>
            <RefreshCw className={`w-4 h-4 mr-1 ${caricamento ? 'animate-spin' : ''}`} /> Ricontrolla
          </Button>
        </div>
      </div>

      {/* Il conto, e quanto manca. A dicembre si insiste; a ottobre no, perché
          un avviso dato troppo presto si impara a ignorarlo. */}
      <div className={`rounded-lg border px-3 py-2 text-sm flex flex-wrap items-center gap-x-4 gap-y-1 ${dati.pronto ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : dati.urgente ? 'border-amber-300 bg-amber-50 text-amber-900' : 'bg-muted/50'}`}>
        {dati.pronto
          ? <span className="flex items-center gap-1.5 font-medium"><CheckCircle2 className="w-4 h-4" /> Il {dati.anno} è pronto: non manca niente.</span>
          : <span className="flex items-center gap-1.5 font-medium">
            {dati.urgente ? <AlertTriangle className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
            {dati.mancanti > 0 && `${dati.mancanti} ${dati.mancanti === 1 ? 'voce manca' : 'voci mancano'}`}
            {dati.mancanti > 0 && dati.parziali > 0 && ', '}
            {dati.parziali > 0 && `${dati.parziali} ${dati.parziali === 1 ? 'è da confermare' : 'sono da confermare'}`}
          </span>}
        {giorni !== null && giorni !== undefined && (
          <span className="text-xs">
            {giorni > 0 ? `${giorni} ${giorni === 1 ? 'giorno' : 'giorni'} al 1° gennaio ${dati.anno}`
              : giorni === 0 ? `È il 1° gennaio ${dati.anno}`
                : `Il ${dati.anno} è cominciato ${-giorni} ${giorni === -1 ? 'giorno' : 'giorni'} fa`}
          </span>
        )}
      </div>

      <div className="space-y-2">
        {dati.voci.map(v => {
          const s = STILE[v.stato] || STILE.manca;
          return (
            <div key={v.chiave} className={`rounded-lg border px-3 py-2.5 ${s.fondo}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`text-sm font-medium flex items-center gap-1.5 ${s.testo}`}>
                    <s.Icona className="w-4 h-4 shrink-0" />{v.titolo}
                  </p>
                  <p className="text-xs mt-0.5">{v.dettaglio}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{v.perche}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {v.azione === 'copia_tariffe' && dati.puo_scrivere && (
                    <Button size="sm" variant="outline" onClick={simula} disabled={!!inCorso}>
                      <Copy className="w-4 h-4 mr-1" /> Prepara dal {dati.anno - 1}
                    </Button>
                  )}
                  <span className="text-[11px] text-muted-foreground">{v.dove}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Le tariffe preparate da qui portano il prezzo dell&apos;anno prima e la nota «da confermare»: servono perché la
        fatturazione non si fermi al primo formulario di gennaio, ma il prezzo vero arriva dal contratto nuovo e va
        controllato riga per riga. Finché nessuno le conferma, questa lista resta gialla.
      </p>

      <AlertDialog open={!!conferma} onOpenChange={(v) => !v && setConferma(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Preparare {conferma?.quante} tariffe per il {anno}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Si copiano dal {anno - 1} con lo stesso prezzo e la validità spostata a tutto il {anno}. Nessuna riga
                  esistente viene toccata, e l&apos;operazione si può ripetere: completa quello che manca e basta.
                </p>
                {conferma?.esempi?.length > 0 && (
                  <ul className="text-xs space-y-0.5 max-h-48 overflow-y-auto">
                    {conferma.esempi.map((e, i) => (
                      <li key={i}>
                        <span className="font-medium">{e.chi || e.tipologia}</span> · {e.direzione.toLowerCase()} · {e.tipologia}
                        {e.prestazione ? ` · ${e.prestazione.toLowerCase()}` : ''}{e.regione ? ` · ${e.regione}` : ''} · {e.valore} {e.unita_misura}
                      </li>
                    ))}
                    {conferma.quante > conferma.esempi.length && <li className="text-muted-foreground">e altre {conferma.quante - conferma.esempi.length}.</li>}
                  </ul>
                )}
                <p className="text-xs text-amber-800">
                  Nascono tutte segnate «da confermare»: il prezzo è quello vecchio finché non lo si verifica sul contratto {anno}.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={inCorso === 'copia'}>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); copia(); }} disabled={inCorso === 'copia'}>
              {inCorso === 'copia' ? 'Preparazione…' : 'Prepara le tariffe'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
