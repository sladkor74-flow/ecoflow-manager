import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { usePermessi } from '@/lib/permessi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Inbox, Send, Check, X, Hammer, Clock } from 'lucide-react';

// Modulo Richieste.
//
// Il gestionale lo modifica solo l'amministratore. Chi lo usa per lavorare, se
// ha bisogno di un caricamento o di una correzione, lo scrive qui: la richiesta
// arriva all'amministratore, che la valuta, la esegue e risponde. Cosi' resta
// traccia di cosa e' stato chiesto, da chi e com'e' finita.

const MODULI = [
  'Caricamento Dati', 'Assegnati Rete', 'Assegnati ACI', 'PDR', 'Terminati Rete', 'Terminati ACI',
  'Secondarie', 'Terziarie', 'Giacenze', 'Extra Raccolta', 'Target & Status', 'Report', 'Report Mensile',
  'Alert & Controllo', 'Fatturazione', 'Qualifica Fornitori', 'Verifiche', 'Assistente',
  'Predittività Secondarie', 'To-Do List', 'Altro',
];

const TIPI = {
  caricamento: 'Caricare un file o dei dati',
  correzione: 'Correggere un dato sbagliato',
  modifica: 'Modificare qualcosa che c\'è già',
  nuova_funzione: 'Aggiungere qualcosa che non c\'è',
  altro: 'Altro',
};

const URGENZE = { bassa: 'Con calma', media: 'Normale', alta: 'Urgente' };

const STATI = {
  in_attesa: { testo: 'In attesa', classe: 'bg-amber-50 text-amber-800 border-amber-200', Icona: Clock },
  approvata: { testo: 'Approvata', classe: 'bg-blue-50 text-blue-800 border-blue-200', Icona: Check },
  eseguita: { testo: 'Eseguita', classe: 'bg-green-50 text-green-800 border-green-200', Icona: Hammer },
  respinta: { testo: 'Non accolta', classe: 'bg-slate-100 text-slate-700 border-slate-300', Icona: X },
};

const VUOTA = { titolo: '', modulo: '', tipo: 'caricamento', descrizione: '', urgenza: 'media' };

const quando = (v) => (v ? new Date(v).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

function Etichetta({ stato }) {
  const s = STATI[stato] || STATI.in_attesa;
  const { Icona } = s;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${s.classe}`}>
      <Icona className="w-3 h-3" /> {s.testo}
    </span>
  );
}

export default function Richieste() {
  const { user, isAdmin } = usePermessi();
  const { toast } = useToast();
  const [richieste, setRichieste] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [form, setForm] = useState(VUOTA);
  const [invio, setInvio] = useState(false);
  const [filtro, setFiltro] = useState('in_attesa');
  const [risposte, setRisposte] = useState({});
  const [inCorso, setInCorso] = useState(null);

  const carica = useCallback(async () => {
    setCaricamento(true);
    try {
      const dati = await base44.entities.RichiestaUtente.list('-created_date', 500);
      setRichieste(dati || []);
    } catch (e) {
      toast({ title: 'Non riesco a leggere le richieste', description: e.message, variant: 'destructive' });
    }
    setCaricamento(false);
  }, [toast]);

  useEffect(() => { carica(); }, [carica]);

  // Ognuno vede le proprie; l'amministratore le vede tutte.
  const mie = useMemo(() => {
    const email = (user && user.email) || '';
    return richieste.filter(r => !email || (r.richiedente_email || '') === email);
  }, [richieste, user]);

  const elenco = useMemo(() => {
    const base = isAdmin ? richieste : mie;
    return filtro === 'tutte' ? base : base.filter(r => (r.stato || 'in_attesa') === filtro);
  }, [richieste, mie, isAdmin, filtro]);

  const inAttesa = richieste.filter(r => (r.stato || 'in_attesa') === 'in_attesa').length;

  const invia = async () => {
    if (!form.titolo.trim() || !form.descrizione.trim()) {
      toast({ title: 'Manca qualcosa', description: 'Servono almeno il titolo e la descrizione.', variant: 'destructive' });
      return;
    }
    setInvio(true);
    try {
      await base44.entities.RichiestaUtente.create({
        ...form,
        titolo: form.titolo.trim(),
        descrizione: form.descrizione.trim(),
        stato: 'in_attesa',
        richiedente_nome: (user && (user.full_name || user.email)) || '',
        richiedente_email: (user && user.email) || '',
        inviata_il: new Date().toISOString(),
      });
      setForm(VUOTA);
      toast({ title: 'Richiesta inviata', description: "L'amministratore la valuta e ti risponde qui." });
      await carica();
    } catch (e) {
      toast({ title: 'Invio non riuscito', description: e.message, variant: 'destructive' });
    }
    setInvio(false);
  };

  const decidi = async (r, stato) => {
    setInCorso(r.id + stato);
    try {
      await base44.entities.RichiestaUtente.update(r.id, {
        stato,
        risposta: (risposte[r.id] !== undefined ? risposte[r.id] : r.risposta || '').trim(),
        decisa_da: (user && (user.full_name || user.email)) || '',
        decisa_il: new Date().toISOString(),
      });
      await carica();
    } catch (e) {
      toast({ title: 'Non riesco a salvare', description: e.message, variant: 'destructive' });
    }
    setInCorso(null);
  };

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold flex items-center gap-2">
          <Inbox className="w-7 h-7 text-primary" /> Richieste
        </h1>
        <p className="text-muted-foreground mt-1 max-w-3xl">
          {isAdmin
            ? 'Quello che gli altri utenti chiedono di caricare, correggere o aggiungere. Le valuti qui e, quando hai fatto, segni la richiesta come eseguita.'
            : 'I caricamenti e le modifiche li fa l\'amministratore. Scrivi qui cosa ti serve: la richiesta gli arriva e la risposta la trovi in questa pagina.'}
        </p>
      </div>

      {!isAdmin && (
        <div className="border rounded-lg bg-card p-4 space-y-3">
          <div className="font-semibold">Nuova richiesta</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs text-muted-foreground">Titolo</label>
              <Input value={form.titolo} onChange={(e) => setForm({ ...form, titolo: e.target.value })}
                placeholder="Per esempio: caricare il file delle primarie della settimana 38" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Modulo</label>
              <Select value={form.modulo} onValueChange={(v) => setForm({ ...form, modulo: v })}>
                <SelectTrigger><SelectValue placeholder="Scegli il modulo" /></SelectTrigger>
                <SelectContent>{MODULI.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Che cosa serve</label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(TIPI).map(([k, t]) => <SelectItem key={k} value={k}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-muted-foreground">Descrizione</label>
              <Textarea rows={4} value={form.descrizione} onChange={(e) => setForm({ ...form, descrizione: e.target.value })}
                placeholder="Racconta cosa serve e perché. Se riguarda un movimento, indica il formulario e l'ID ordine." />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Urgenza</label>
              <Select value={form.urgenza} onValueChange={(v) => setForm({ ...form, urgenza: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(URGENZE).map(([k, t]) => <SelectItem key={k} value={k}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={invia} disabled={invio}>
                {invio ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />} Invia la richiesta
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {['in_attesa', 'approvata', 'eseguita', 'respinta', 'tutte'].map(s => (
          <Button key={s} size="sm" variant={filtro === s ? 'default' : 'outline'} onClick={() => setFiltro(s)}>
            {s === 'tutte' ? 'Tutte' : STATI[s].testo}
            {s === 'in_attesa' && inAttesa > 0 ? ` (${inAttesa})` : ''}
          </Button>
        ))}
      </div>

      {caricamento ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Leggo le richieste…</div>
      ) : elenco.length === 0 ? (
        <div className="border rounded-lg bg-card px-4 py-8 text-center text-muted-foreground text-sm">
          {filtro === 'in_attesa' ? 'Nessuna richiesta in attesa.' : 'Nessuna richiesta con questo stato.'}
        </div>
      ) : (
        <div className="space-y-3">
          {elenco.map(r => (
            <div key={r.id} className="border rounded-lg bg-card p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold">{r.titolo}</div>
                <Etichetta stato={r.stato} />
              </div>
              <div className="text-xs text-muted-foreground">
                {[r.modulo, TIPI[r.tipo] || '', r.urgenza === 'alta' ? 'Urgente' : '', r.richiedente_nome, quando(r.inviata_il || r.created_date)]
                  .filter(Boolean).join(' · ')}
              </div>
              <div className="text-sm whitespace-pre-wrap">{r.descrizione}</div>

              {r.risposta && (
                <div className="text-sm border-l-2 border-primary/40 pl-3">
                  <span className="text-muted-foreground text-xs">Risposta{r.decisa_da ? ` di ${r.decisa_da}` : ''}{r.decisa_il ? ` · ${quando(r.decisa_il)}` : ''}:</span>
                  <div className="whitespace-pre-wrap">{r.risposta}</div>
                </div>
              )}

              {isAdmin && (
                <div className="space-y-2 pt-1">
                  <Textarea rows={2} placeholder="Risposta per chi ha scritto (facoltativa)"
                    value={risposte[r.id] !== undefined ? risposte[r.id] : (r.risposta || '')}
                    onChange={(e) => setRisposte({ ...risposte, [r.id]: e.target.value })} />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => decidi(r, 'approvata')} disabled={!!inCorso}>
                      {inCorso === r.id + 'approvata' ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />} Approva
                    </Button>
                    <Button size="sm" onClick={() => decidi(r, 'eseguita')} disabled={!!inCorso}>
                      {inCorso === r.id + 'eseguita' ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Hammer className="w-4 h-4 mr-1" />} Fatto
                    </Button>
                    <Button size="sm" variant="ghost" className="text-slate-600" onClick={() => decidi(r, 'respinta')} disabled={!!inCorso}>
                      {inCorso === r.id + 'respinta' ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <X className="w-4 h-4 mr-1" />} Non accolgo
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
