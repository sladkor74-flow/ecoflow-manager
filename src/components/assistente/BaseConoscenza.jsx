import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/components/ui/use-toast';
import { conModifica, dataOra, nomeUtente } from '@/lib/target';
import { AREE } from '@/components/assistente/ChatAssistente';
import { Loader2, ShieldCheck, Plus, Pencil, Check, X, RefreshCw, Sparkles } from 'lucide-react';

// Base di conoscenza dell'Assistente: voci verificate nel codice, voci aggiunte
// nel gestionale (FAQ confermate, regole interne, aggiornamenti approvati) e
// proposte di aggiornamento in attesa di decisione. Nulla cambia senza approvazione.

const nomeArea = (a) => AREE.find(x => x.valore === a)?.etichetta || a;
const TIPI = { faq: 'FAQ', regola_interna: 'Regola interna', aggiornamento_normativo: 'Aggiornamento normativo' };
const leggiFonti = (json) => { try { const v = JSON.parse(json || '[]'); return Array.isArray(v) ? v.map(String) : []; } catch { return []; } };
const oggi = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());

function DialogVoce({ voce, onClose, onSalvato }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const nuova = !voce.id;
  const [dati, setDati] = useState({
    tipo: voce.tipo || 'regola_interna',
    area: voce.area || 'gestionale',
    titolo: voce.titolo || '',
    testo: voce.testo || '',
    fonti: leggiFonti(voce.fonti_json).join('\n'),
  });
  const [nota, setNota] = useState('');
  const [salvataggio, setSalvataggio] = useState(false);
  const imposta = (k, v) => setDati(d => ({ ...d, [k]: v }));

  const salva = async () => {
    setSalvataggio(true);
    try {
      const campi = {
        tipo: dati.tipo,
        area: dati.area,
        titolo: dati.titolo.trim(),
        testo: dati.testo.trim(),
        fonti_json: JSON.stringify(dati.fonti.split('\n').map(s => s.trim()).filter(Boolean)),
        verificato_il: oggi(),
      };
      if (nuova) {
        await base44.entities.ConoscenzaAssistente.create({ ...campi, stato: 'approvata', attiva: true, origine: 'manuale', deciso_da: nomeUtente(user), deciso_il: new Date().toISOString() });
      } else {
        await base44.entities.ConoscenzaAssistente.update(voce.id, {
          ...campi,
          storico_json: conModifica(voce.storico_json, { utente: nomeUtente(user), nota: nota.trim() || 'modifica del testo', prima: { titolo: voce.titolo, testo: voce.testo } }),
        });
      }
      toast({ title: nuova ? 'Voce aggiunta' : 'Voce aggiornata' });
      onSalvato();
    } catch (e) {
      toast({ title: 'Salvataggio non riuscito', description: e.message, variant: 'destructive' });
    } finally {
      setSalvataggio(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{nuova ? 'Nuova voce' : 'Modifica voce'}</DialogTitle>
          <DialogDescription>Le voci attive entrano in tutte le risposte dell'Assistente; quelle normative anche nel controllo dei documenti dei fornitori.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Tipo</p>
              <Select value={dati.tipo} onValueChange={v => imposta('tipo', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="regola_interna">Regola interna</SelectItem>
                  <SelectItem value="faq">FAQ</SelectItem>
                  {!nuova && <SelectItem value="aggiornamento_normativo">Aggiornamento normativo</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Area</p>
              <Select value={dati.area} onValueChange={v => imposta('area', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{AREE.map(a => <SelectItem key={a.valore} value={a.valore}>{a.etichetta}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Titolo o domanda</p>
            <Input value={dati.titolo} onChange={e => imposta('titolo', e.target.value)} />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Testo</p>
            <Textarea rows={8} value={dati.testo} onChange={e => imposta('testo', e.target.value)} />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Fonti, una per riga</p>
            <Textarea rows={2} value={dati.fonti} onChange={e => imposta('fonti', e.target.value)} placeholder="Per esempio: D.Lgs. 152/2006 art. 193" />
          </div>
          {!nuova && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Motivo della modifica</p>
              <Input value={nota} onChange={e => setNota(e.target.value)} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button onClick={salva} disabled={salvataggio || !dati.testo.trim() || !dati.titolo.trim()}>{salvataggio && <Loader2 className="w-4 h-4 animate-spin mr-1" />} Salva</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Proposta({ p, admin, onDecidi }) {
  const [testo, setTesto] = useState(p.testo || '');
  const [modifica, setModifica] = useState(false);
  const fonti = leggiFonti(p.fonti_json);
  return (
    <div className="border rounded-xl p-4 bg-amber-50/60 border-amber-200 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{p.titolo}</p>
          <p className="text-xs text-muted-foreground">{nomeArea(p.area)} · proposta il {dataOra(p.created_date)} {p.origine === 'controllo_mensile' ? 'dal controllo mensile' : 'durante una domanda'}</p>
        </div>
        <Badge variant="outline">{p.voce_id ? 'Aggiorna una voce' : 'Voce nuova'}</Badge>
      </div>
      {p.motivazione && <p className="text-sm"><span className="font-medium">Novità: </span>{p.motivazione}</p>}
      {fonti.length > 0 && (
        <p className="text-xs text-muted-foreground">Fonti: {fonti.map((f, i) => /^https?:\/\//.test(f) ? <a key={i} href={f} target="_blank" rel="noreferrer" className="underline mr-2">{f}</a> : <span key={i} className="mr-2">{f}</span>)}</p>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {p.testo_precedente && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Testo attuale</p>
            <p className="text-sm bg-white border rounded p-2 whitespace-pre-wrap">{p.testo_precedente}</p>
          </div>
        )}
        <div className={`space-y-1 ${p.testo_precedente ? '' : 'md:col-span-2'}`}>
          <p className="text-xs font-medium text-muted-foreground">Testo proposto</p>
          {modifica
            ? <Textarea rows={8} value={testo} onChange={e => setTesto(e.target.value)} />
            : <p className="text-sm bg-white border rounded p-2 whitespace-pre-wrap">{testo}</p>}
        </div>
      </div>
      {admin ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="gap-1" onClick={() => onDecidi(p, 'approvata', testo)}><Check className="w-4 h-4" /> Approva</Button>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setModifica(m => !m)}><Pencil className="w-4 h-4" /> {modifica ? 'Chiudi modifica' : 'Modifica il testo'}</Button>
          <Button size="sm" variant="ghost" className="gap-1" onClick={() => onDecidi(p, 'scartata', testo)}><X className="w-4 h-4" /> Scarta</Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Solo un amministratore può approvare o scartare.</p>
      )}
    </div>
  );
}

export default function BaseConoscenza() {
  const { user } = useAuth();
  const admin = user?.role === 'admin';
  const { toast } = useToast();
  const [voci, setVoci] = useState([]);
  const [codice, setCodice] = useState({ voci: [], verificato_il: '' });
  const [controlli, setControlli] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [controllo, setControllo] = useState(false);
  const [modifica, setModifica] = useState(null);
  const [mostraDisattive, setMostraDisattive] = useState(false);

  const carica = useCallback(async () => {
    try {
      const [v, c, k] = await Promise.all([
        base44.entities.ConoscenzaAssistente.list('-created_date', 500),
        base44.entities.ControlloNormativo.list('-created_date', 5),
        base44.functions.invoke('baseConoscenzaAssistente', {}).then(r => r.data).catch(() => null),
      ]);
      setVoci(v);
      setControlli(c);
      if (k && Array.isArray(k.voci)) setCodice(k);
    } catch (e) {
      console.error(e);
    } finally {
      setCaricamento(false);
    }
  }, []);
  useEffect(() => { carica(); }, [carica]);

  const proposte = voci.filter(v => v.stato === 'proposta');
  const approvate = voci.filter(v => v.stato === 'approvata' && (mostraDisattive || v.attiva !== false));
  const sostituzioni = useMemo(() => new Map(voci.filter(v => v.stato === 'approvata' && v.attiva !== false && v.tipo === 'aggiornamento_normativo' && v.voce_id).map(v => [v.voce_id, v])), [voci]);
  const BASE_CONOSCENZA = codice.voci;
  const aggiunte = approvate.filter(v => !(v.tipo === 'aggiornamento_normativo' && v.voce_id && BASE_CONOSCENZA.some(b => b.id === v.voce_id)));

  const decidi = async (p, stato, testo) => {
    try {
      await base44.entities.ConoscenzaAssistente.update(p.id, {
        stato,
        testo: testo || p.testo,
        deciso_da: nomeUtente(user),
        deciso_il: new Date().toISOString(),
        storico_json: testo && testo !== p.testo ? conModifica(p.storico_json, { utente: nomeUtente(user), nota: 'testo modificato prima dell\'approvazione', prima: { testo: p.testo } }) : p.storico_json,
      });
      // Un aggiornamento approvato prende il posto del precedente sulla stessa voce.
      if (stato === 'approvata' && p.voce_id) {
        for (const vecchio of voci.filter(v => v.id !== p.id && v.stato === 'approvata' && v.voce_id === p.voce_id && v.attiva !== false)) {
          await base44.entities.ConoscenzaAssistente.update(vecchio.id, { attiva: false, storico_json: conModifica(vecchio.storico_json, { utente: nomeUtente(user), nota: 'sostituita da un aggiornamento successivo' }) });
        }
      }
      toast({ title: stato === 'approvata' ? 'Aggiornamento approvato' : 'Proposta scartata' });
      carica();
    } catch (e) {
      toast({ title: 'Operazione non riuscita', description: e.message, variant: 'destructive' });
    }
  };

  const attiva = async (v, valore) => {
    try {
      await base44.entities.ConoscenzaAssistente.update(v.id, { attiva: valore, storico_json: conModifica(v.storico_json, { utente: nomeUtente(user), nota: valore ? 'riattivata' : 'disattivata' }) });
      carica();
    } catch (e) {
      toast({ title: 'Operazione non riuscita', description: e.message, variant: 'destructive' });
    }
  };

  const controllaOra = async () => {
    setControllo(true);
    try {
      const res = await base44.functions.invoke('controlloNormativo', { manuale: true });
      toast({ title: 'Controllo completato', description: res.data?.sintesi || '' });
    } catch (e) {
      toast({ title: 'Controllo non riuscito', description: e?.response?.data?.error || e.message, variant: 'destructive' });
    } finally {
      setControllo(false);
      carica();
    }
  };

  if (caricamento) return <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carico la base di conoscenza…</p>;

  const ultimo = controlli[0];
  return (
    <div className="space-y-6">
      <div className="border rounded-xl p-4 bg-card flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Controllo delle novità normative</p>
          <p className="text-sm text-muted-foreground">
            Ogni primo del mese l'Assistente cerca sulle fonti ufficiali novità su PFU, rifiuti, Albo e RENTRI e le propone qui; se ne trova, gli amministratori ricevono un'email.
          </p>
          {ultimo && (
            <p className="text-sm mt-1">
              Ultimo controllo {dataOra(ultimo.eseguito_il || ultimo.created_date)}: {ultimo.esito === 'in_corso' ? 'in corso' : ultimo.sintesi || ultimo.errore || ultimo.esito}
            </p>
          )}
        </div>
        {admin && (
          <Button variant="outline" className="gap-1" onClick={controllaOra} disabled={controllo}>
            {controllo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} {controllo ? 'Controllo in corso, qualche minuto…' : 'Controlla ora'}
          </Button>
        )}
      </div>

      <div className="space-y-3">
        <p className="font-semibold">Proposte da approvare {proposte.length > 0 && <Badge variant="destructive" className="ml-1">{proposte.length}</Badge>}</p>
        {proposte.length === 0
          ? <p className="text-sm text-muted-foreground">Nessuna proposta in attesa.</p>
          : proposte.map(p => <Proposta key={p.id} p={p} admin={admin} onDecidi={decidi} />)}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold">Aggiunte nel gestionale</p>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground"><Switch checked={mostraDisattive} onCheckedChange={setMostraDisattive} /> Mostra disattivate</label>
            <Button size="sm" className="gap-1" onClick={() => setModifica({})}><Plus className="w-4 h-4" /> Nuova regola o FAQ</Button>
          </div>
        </div>
        {aggiunte.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessuna voce aggiunta. Le risposte confermate nella scheda Domande e le regole interne che scrivi qui compaiono in questo elenco.</p>
        ) : (
          <div className="space-y-2">
            {aggiunte.map(v => (
              <div key={v.id} className={`border rounded-lg p-3 bg-card ${v.attiva === false ? 'opacity-60' : ''}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">{v.titolo}</p>
                    <p className="text-xs text-muted-foreground">{TIPI[v.tipo]} · {nomeArea(v.area)} · {v.verificato_il ? `del ${v.verificato_il}` : dataOra(v.created_date)}{v.deciso_da ? ` · ${v.deciso_da}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={v.attiva !== false} onCheckedChange={(val) => attiva(v, val)} />
                    <Button variant="ghost" size="sm" onClick={() => setModifica(v)}><Pencil className="w-4 h-4" /></Button>
                  </div>
                </div>
                <p className="text-sm mt-2 whitespace-pre-wrap line-clamp-6">{v.testo}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="font-semibold flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-600" /> Voci verificate</p>
        <p className="text-sm text-muted-foreground">Studiate e verificate sulle fonti ufficiali (ultima verifica complessiva {codice.verificato_il || '—'}). Un aggiornamento approvato ne prende il posto finché non viene riscritto nel codice.</p>
        <Accordion type="multiple" className="border rounded-xl bg-card px-4">
          {AREE.map(a => {
            const delArea = BASE_CONOSCENZA.filter(v => v.area === a.valore);
            if (!delArea.length) return null;
            return (
              <AccordionItem key={a.valore} value={a.valore}>
                <AccordionTrigger className="text-sm">{a.etichetta} ({delArea.length})</AccordionTrigger>
                <AccordionContent className="space-y-3">
                  {delArea.map(v => {
                    const s = sostituzioni.get(v.id);
                    return (
                      <div key={v.id} className="border-l-2 pl-3 border-muted">
                        <p className="text-sm font-medium">{v.titolo} {s && <Badge className="ml-1 bg-amber-500 font-normal">Aggiornata il {s.verificato_il}</Badge>}</p>
                        <p className="text-sm whitespace-pre-wrap mt-1">{s ? s.testo : v.testo}</p>
                        <p className="text-xs text-muted-foreground mt-1">Fonti: {(s ? leggiFonti(s.fonti_json) : v.fonti).join('; ') || v.fonti.join('; ')} · verificata il {s ? s.verificato_il : v.verificato_il}</p>
                      </div>
                    );
                  })}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>

      {modifica && <DialogVoce voce={modifica} onClose={() => setModifica(null)} onSalvato={() => { setModifica(null); carica(); }} />}
    </div>
  );
}
