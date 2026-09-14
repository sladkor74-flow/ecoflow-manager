import React, { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/components/ui/use-toast';
import { dataOra } from '@/lib/target';
import { formatIntero } from '@/lib/utils';
import { BookOpen, Loader2, Upload, AlertTriangle, Video, FileText } from 'lucide-react';

// Materiale del corso per responsabile tecnico: avanzamento dell'elaborazione in
// background e schede di studio per modulo. Le schede servono sia allo studio sia
// all'Assistente, che usa quelle pertinenti alle domande.

const PARTI_PER_ORA = 3;
const elenco = (json) => { try { const v = JSON.parse(json || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
const erroreDi = (e) => e?.data?.error || e?.response?.data?.error || e?.message || 'Errore';

function Scheda({ p }) {
  const [risposte, setRisposte] = useState(false);
  const concetti = elenco(p.concetti_json);
  const riferimenti = elenco(p.riferimenti_json);
  const verificare = elenco(p.da_verificare_json);
  const domande = elenco(p.domande_json);
  return (
    <div className="border rounded-lg p-3 space-y-2 bg-card">
      <p className="text-xs font-medium text-muted-foreground">Parte {p.parte}{p.parti_totali ? ` di ${p.parti_totali}` : ''}</p>
      <p className="text-sm whitespace-pre-line">{p.sintesi}</p>
      {concetti.length > 0 && (
        <ul className="text-sm list-disc pl-5 space-y-0.5">{concetti.map((c, i) => <li key={i}>{c}</li>)}</ul>
      )}
      {riferimenti.length > 0 && (
        <p className="text-xs text-muted-foreground"><span className="font-medium">Norme citate:</span> {riferimenti.map(r => [r.norma, r.articolo].filter(Boolean).join(' ')).join(' · ')}</p>
      )}
      {verificare.length > 0 && (
        <div className="rounded-md bg-amber-50 border border-amber-200 p-2 text-xs text-amber-900">
          <p className="font-medium flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Da verificare con le norme vigenti</p>
          <ul className="list-disc pl-5">{verificare.map((v, i) => <li key={i}>{v}</li>)}</ul>
        </div>
      )}
      {domande.length > 0 && (
        <div className="text-sm space-y-1">
          <button type="button" className="text-xs font-medium text-violet-700 hover:underline" onClick={() => setRisposte(!risposte)}>
            {risposte ? 'Nascondi le risposte' : `Domande di ripasso (${domande.length}): mostra le risposte`}
          </button>
          {domande.map((d, i) => (
            <div key={i}>
              <p className="font-medium">{i + 1}. {d.domanda}</p>
              {risposte && <p className="text-muted-foreground">{d.risposta}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SchedeModulo({ fonte }) {
  const [parti, setParti] = useState(null);
  useEffect(() => {
    base44.entities.MaterialeCorso.filter({ fonte_file: fonte, stato: 'elaborato' }, 'parte', 500)
      .then(setParti)
      .catch(() => setParti([]));
  }, [fonte]);
  if (!parti) return <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carico le schede…</p>;
  if (!parti.length) return <p className="text-sm text-muted-foreground">Nessuna scheda ancora pronta per questo modulo.</p>;
  return <div className="space-y-2">{parti.map(p => <Scheda key={p.id} p={p} />)}</div>;
}

export default function CorsoRT() {
  const { user } = useAuth();
  const admin = user?.role === 'admin';
  const { toast } = useToast();
  const [stato, setStato] = useState(null);
  const [caricamento, setCaricamento] = useState(false);
  const input = useRef(null);

  const aggiorna = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('caricaMaterialeCorso', { azione: 'stato' });
      setStato(res.data);
    } catch (e) {
      setStato({ totale: 0, elaborate: 0, errori: 0, moduli: [], errore: erroreDi(e) });
    }
  }, []);
  useEffect(() => { aggiorna(); }, [aggiorna]);

  // Pacchetti JSON { parti: [...] } preparati dal materiale del corso.
  const carica = async (files) => {
    setCaricamento(true);
    let caricate = 0, presenti = 0;
    try {
      for (const file of files) {
        const dati = JSON.parse(await file.text());
        const parti = Array.isArray(dati.parti) ? dati.parti : [];
        for (let i = 0; i < parti.length; i += 20) {
          const res = await base44.functions.invoke('caricaMaterialeCorso', { azione: 'carica', parti: parti.slice(i, i + 20) });
          caricate += res.data.caricate || 0;
          presenti += res.data.gia_presenti || 0;
        }
      }
      toast({ title: 'Materiale caricato', description: `${formatIntero(caricate)} parti nuove${presenti ? `, ${formatIntero(presenti)} già presenti` : ''}.` });
    } catch (e) {
      toast({ title: 'Caricamento non riuscito', description: erroreDi(e), variant: 'destructive' });
    } finally {
      setCaricamento(false);
      if (input.current) input.current.value = '';
      aggiorna();
    }
  };

  if (!stato) return <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carico il materiale del corso…</p>;

  const mancanti = stato.totale - stato.elaborate - stato.errori;
  const perc = stato.totale ? Math.round((stato.elaborate / stato.totale) * 100) : 0;
  const giorni = mancanti > 0 ? Math.ceil(mancanti / PARTI_PER_ORA / 24) : 0;
  const categorie = [...new Set(stato.moduli.map(m => m.categoria))];

  return (
    <div className="space-y-5">
      <div className="border rounded-xl p-4 bg-card space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-medium flex items-center gap-2"><BookOpen className="w-4 h-4 text-violet-600" /> Corso per responsabile tecnico gestione rifiuti</p>
            <p className="text-sm text-muted-foreground">
              Dispense e videolezioni del corso diventano schede di studio, {PARTI_PER_ORA} parti ogni ora in background. L'Assistente usa le schede pertinenti alle domande, ma prevalgono sempre le norme vigenti: il materiale ha qualche anno.
            </p>
          </div>
          {admin && (
            <>
              <input ref={input} type="file" accept=".json,application/json" multiple className="hidden" onChange={e => e.target.files.length && carica([...e.target.files])} />
              <Button size="sm" variant="outline" onClick={() => input.current?.click()} disabled={caricamento} className="gap-1">
                {caricamento ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Carica materiale preparato
              </Button>
            </>
          )}
        </div>
        {stato.totale > 0 ? (
          <div className="space-y-1">
            <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-violet-600 transition-all" style={{ width: `${perc}%` }} /></div>
            <p className="text-xs text-muted-foreground">
              {formatIntero(stato.elaborate)} parti elaborate su {formatIntero(stato.totale)} ({perc}%)
              {mancanti > 0 ? ` · circa ${giorni} ${giorni === 1 ? 'giorno' : 'giorni'} per completare` : ' · elaborazione completata'}
              {stato.errori ? ` · ${formatIntero(stato.errori)} parti non elaborabili` : ''}
              {stato.ultima_elaborazione ? ` · ultima scheda ${dataOra(stato.ultima_elaborazione)}` : ''}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{stato.errore || 'Nessun materiale caricato.'}</p>
        )}
      </div>

      {categorie.map(cat => (
        <div key={cat} className="space-y-2">
          <h3 className="text-sm font-semibold">{cat}</h3>
          <Accordion type="multiple" className="border rounded-xl bg-card px-3">
            {stato.moduli.filter(m => m.categoria === cat).map(m => (
              <AccordionItem key={m.fonte_file} value={m.fonte_file}>
                <AccordionTrigger className="text-sm text-left">
                  <span className="flex items-center gap-2 flex-wrap">
                    {m.tipo === 'videolezione' ? <Video className="w-4 h-4 text-muted-foreground" /> : <FileText className="w-4 h-4 text-muted-foreground" />}
                    {m.modulo}
                    <Badge variant={m.elaborate === m.totale ? 'default' : 'secondary'} className="font-normal">{m.elaborate}/{m.totale}</Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent><SchedeModulo fonte={m.fonte_file} /></AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      ))}
    </div>
  );
}
