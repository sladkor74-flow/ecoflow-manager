import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { dataOra, nomeUtente } from '@/lib/target';
import { Send, Loader2, Plus, Search, ThumbsUp, ThumbsDown, Globe, Database, BookOpen, MessageSquare, AlertTriangle, RefreshCw } from 'lucide-react';

// Spazio domande: conversazioni con l'Assistente, archiviate nel gestionale.
// Una risposta confermata diventa una FAQ della base di conoscenza; una risposta
// sbagliata si annota e la correzione, se la si salva, diventa la FAQ giusta.

export const AREE = [
  { valore: 'pfu', etichetta: 'PFU e DM 182/2019' },
  { valore: 'tua', etichetta: 'D.Lgs. 152/2006' },
  { valore: 'albo', etichetta: 'Albo e responsabile tecnico' },
  { valore: 'rentri', etichetta: 'RENTRI e FIR' },
  { valore: 'documenti', etichetta: 'Documenti dei fornitori' },
  { valore: 'gestionale', etichetta: 'Regole del gestionale' },
];

const ESEMPI = [
  'Dal 16 settembre un gommista con 6 dipendenti deve usare il FIR digitale?',
  'Come stiamo con il contratto in Campania rispetto all\'atteso a oggi?',
  'Quali raccoglitori sono sotto target questo mese?',
  'Che cosa deve verificare il responsabile tecnico prima di affidare i PFU a un impianto?',
  'Quali impianti e stoccaggi sono vicini al target?',
];

const CERTEZZA = {
  alta: { etichetta: 'Certezza alta', classe: 'bg-emerald-100 text-emerald-800' },
  media: { etichetta: 'Certezza media', classe: 'bg-amber-100 text-amber-800' },
  bassa: { etichetta: 'Certezza bassa: da confermare', classe: 'bg-red-100 text-red-700' },
};

const leggiFonti = (json) => { try { const v = JSON.parse(json || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
const oggi = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
const areaPredefinita = (d) => (d.ambito === 'operativa' ? 'gestionale' : d.ambito === 'esercitazione' ? 'albo' : 'tua');

function DialogValutazione({ domanda, modo, onClose, onSalvato }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [titolo, setTitolo] = useState(domanda.domanda.slice(0, 200));
  const [testo, setTesto] = useState(modo === 'corretta' ? domanda.risposta || '' : '');
  const [nota, setNota] = useState('');
  const [area, setArea] = useState(areaPredefinita(domanda));
  const [salvaFaq, setSalvaFaq] = useState(modo === 'corretta');
  const [salvataggio, setSalvataggio] = useState(false);

  const salva = async () => {
    setSalvataggio(true);
    try {
      let conoscenzaId = domanda.conoscenza_id || '';
      if (salvaFaq && testo.trim()) {
        const voce = await base44.entities.ConoscenzaAssistente.create({
          tipo: 'faq',
          stato: 'approvata',
          attiva: true,
          area,
          titolo: titolo.trim(),
          testo: testo.trim(),
          fonti_json: modo === 'corretta' ? domanda.fonti_json || '[]' : JSON.stringify(['Correzione della direzione SMOCO']),
          verificato_il: oggi(),
          origine: 'domanda',
          domanda_id: domanda.id,
          deciso_da: nomeUtente(user),
          deciso_il: new Date().toISOString(),
        });
        conoscenzaId = voce.id;
      }
      await base44.entities.DomandaAssistente.update(domanda.id, {
        valutazione: modo,
        nota_valutazione: nota.trim(),
        conoscenza_id: conoscenzaId,
      });
      toast({ title: salvaFaq ? 'Salvata nella base di conoscenza' : 'Valutazione salvata', description: salvaFaq ? 'L\'Assistente la userà nelle prossime risposte.' : undefined });
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
          <DialogTitle>{modo === 'corretta' ? 'Risposta corretta' : 'Risposta da correggere'}</DialogTitle>
          <DialogDescription>
            {modo === 'corretta'
              ? 'Salvala come FAQ: l\'Assistente la userà come riferimento nelle prossime risposte. Puoi ritoccare il testo prima di salvare.'
              : 'Spiega cosa non va. Se scrivi la risposta giusta e la salvi come FAQ, l\'Assistente userà quella.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {modo === 'da_correggere' && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Cosa non va</p>
              <Textarea rows={3} value={nota} onChange={e => setNota(e.target.value)} placeholder="Per esempio: la scadenza indicata è sbagliata, da noi la regola è un'altra…" />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={salvaFaq} onChange={e => setSalvaFaq(e.target.checked)} />
            {modo === 'corretta' ? 'Salva come FAQ nella base di conoscenza' : 'Salva la risposta giusta come FAQ'}
          </label>
          {salvaFaq && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1 sm:col-span-2">
                  <p className="text-xs font-medium text-muted-foreground">Domanda</p>
                  <Input value={titolo} onChange={e => setTitolo(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Area</p>
                  <Select value={area} onValueChange={setArea}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{AREE.map(a => <SelectItem key={a.valore} value={a.valore}>{a.etichetta}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">{modo === 'corretta' ? 'Risposta' : 'Risposta giusta'}</p>
                <Textarea rows={10} value={testo} onChange={e => setTesto(e.target.value)} />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button onClick={salva} disabled={salvataggio || (salvaFaq && !testo.trim()) || (modo === 'da_correggere' && !nota.trim() && !salvaFaq)}>
            {salvataggio && <Loader2 className="w-4 h-4 animate-spin mr-1" />} Salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Messaggio({ d, onValuta }) {
  const fonti = leggiFonti(d.fonti_json);
  const certezza = CERTEZZA[d.certezza];
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-2 text-sm whitespace-pre-wrap">{d.domanda}</div>
      </div>
      <div className="max-w-[95%] rounded-2xl rounded-tl-sm border bg-card px-4 py-3 space-y-3">
        {d.stato === 'in_corso' && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            {d.ricerca_online ? 'Controllo la base di conoscenza e le fonti ufficiali…' : 'Leggo i dati del gestionale…'}
          </p>
        )}
        {d.stato === 'errore' && (
          <p className="flex items-center gap-2 text-sm text-red-600"><AlertTriangle className="w-4 h-4" /> Non sono riuscito a rispondere: {d.errore || 'errore sconosciuto'}. Riprova.</p>
        )}
        {d.stato === 'completata' && (
          <>
            <div className="prose prose-sm max-w-none prose-p:my-2 prose-ul:my-2"><ReactMarkdown>{d.risposta || ''}</ReactMarkdown></div>
            <div className="flex flex-wrap gap-1.5">
              {certezza && <span className={`text-xs rounded px-2 py-0.5 ${certezza.classe}`}>{certezza.etichetta}</span>}
              {d.ricerca_online && <Badge variant="outline" className="gap-1 font-normal"><Globe className="w-3 h-3" /> Verificata sulle fonti</Badge>}
              {d.dati_gestionale && <Badge variant="outline" className="gap-1 font-normal"><Database className="w-3 h-3" /> Dati del gestionale</Badge>}
              {d.valutazione === 'corretta' && <Badge className="bg-emerald-600 font-normal">Confermata</Badge>}
              {d.valutazione === 'da_correggere' && <Badge variant="destructive" className="font-normal">Da correggere</Badge>}
            </div>
            {fonti.length > 0 && (
              <div className="text-xs text-muted-foreground border-t pt-2 space-y-0.5">
                <p className="font-medium flex items-center gap-1"><BookOpen className="w-3 h-3" /> Fonti</p>
                {fonti.map((f, i) => (
                  <p key={i}>
                    {f.url ? <a href={f.url} target="_blank" rel="noreferrer" className="underline hover:text-foreground">{f.titolo || f.riferimento || f.url}</a> : (f.titolo || f.riferimento)}
                    {f.titolo && f.riferimento ? ` — ${f.riferimento}` : ''}
                    {f.verificato_il ? ` (verificata il ${f.verificato_il})` : ''}
                  </p>
                ))}
              </div>
            )}
            {d.nota_valutazione && <p className="text-xs text-red-700 bg-red-50 rounded px-2 py-1">Nota: {d.nota_valutazione}</p>}
            {d.valutazione === 'nessuna' || !d.valutazione ? (
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => onValuta(d, 'corretta')}><ThumbsUp className="w-3.5 h-3.5" /> Corretta, salva come FAQ</Button>
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => onValuta(d, 'da_correggere')}><ThumbsDown className="w-3.5 h-3.5" /> Da correggere</Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

export default function ChatAssistente() {
  const { toast } = useToast();
  const [domande, setDomande] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [attiva, setAttiva] = useState(null);
  const [testo, setTesto] = useState('');
  const [invio, setInvio] = useState(false);
  const [cerca, setCerca] = useState('');
  const [valuta, setValuta] = useState(null);
  const fine = useRef(null);

  const carica = useCallback(async () => {
    try {
      setDomande(await base44.entities.DomandaAssistente.list('-created_date', 500));
    } catch (e) {
      console.error(e);
    } finally {
      setCaricamento(false);
    }
  }, []);
  useEffect(() => { carica(); }, [carica]);

  const conversazioni = useMemo(() => {
    const mappa = new Map();
    for (const d of domande) {
      const k = d.conversazione_id || d.id;
      if (!mappa.has(k)) mappa.set(k, { id: k, titolo: d.titolo_conversazione || d.domanda, ultima: d.created_date, domande: [] });
      mappa.get(k).domande.push(d);
    }
    const q = cerca.trim().toLowerCase();
    return [...mappa.values()]
      .filter(c => !q || c.domande.some(d => `${d.domanda} ${d.risposta || ''}`.toLowerCase().includes(q)))
      .sort((a, b) => String(b.ultima).localeCompare(String(a.ultima)));
  }, [domande, cerca]);

  const messaggi = useMemo(
    () => (attiva ? domande.filter(d => (d.conversazione_id || d.id) === attiva).sort((a, b) => String(a.created_date).localeCompare(String(b.created_date))) : []),
    [domande, attiva],
  );

  useEffect(() => { fine.current?.scrollIntoView({ behavior: 'smooth' }); }, [messaggi.length, invio]);

  // Se la connessione cade mentre l'Assistente lavora, la risposta arriva comunque:
  // si ricontrolla finche' ci sono domande in corso da meno di cinque minuti.
  const inCorso = messaggi.some(d => d.stato === 'in_corso' && Date.now() - new Date(d.created_date).getTime() < 5 * 60 * 1000);
  useEffect(() => {
    if (!inCorso || invio) return;
    const t = setInterval(carica, 5000);
    return () => clearInterval(t);
  }, [inCorso, invio, carica]);

  const invia = async (domanda) => {
    const q = String(domanda || testo).trim();
    if (!q || invio) return;
    setInvio(true);
    setTesto('');
    const conversazione = attiva && attiva !== 'nuova' ? attiva : null;
    const provvisoria = { id: `tmp-${Date.now()}`, conversazione_id: conversazione || 'nuova', domanda: q, stato: 'in_corso', ricerca_online: true, created_date: new Date().toISOString() };
    if (!conversazione) setAttiva('nuova');
    setDomande(ds => [provvisoria, ...ds]);
    try {
      const res = await base44.functions.invoke('chiediAssistente', { domanda: q, conversazione_id: conversazione || undefined });
      const record = res.data?.record;
      if (record) {
        setAttiva(record.conversazione_id);
        if (res.data.proposte) toast({ title: 'Possibile novità normativa', description: 'L\'Assistente ha proposto un aggiornamento della base di conoscenza: lo trovi nella scheda Base di conoscenza.' });
      }
      await carica();
    } catch (e) {
      const messaggio = e?.response?.data?.error || e.message;
      toast({ title: 'L\'Assistente non ha risposto', description: messaggio, variant: 'destructive' });
      await carica();
      if (!conversazione) setAttiva(null);
    } finally {
      setInvio(false);
    }
  };

  // Con la conversazione "nuova" ancora provvisoria si mostra solo la domanda in corso.
  const visibili = attiva === 'nuova' ? domande.filter(d => d.conversazione_id === 'nuova') : messaggi;

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <aside className="border rounded-xl bg-card p-3 space-y-3 lg:h-[calc(100vh-220px)] lg:overflow-y-auto">
        <Button className="w-full gap-1" variant="outline" onClick={() => setAttiva(null)}><Plus className="w-4 h-4" /> Nuova domanda</Button>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground" />
          <Input className="pl-8" placeholder="Cerca nell'archivio" value={cerca} onChange={e => setCerca(e.target.value)} />
        </div>
        {caricamento ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carico l'archivio…</p>
        ) : conversazioni.length === 0 ? (
          <p className="text-sm text-muted-foreground">{cerca ? 'Nessuna domanda trovata.' : 'L\'archivio è vuoto.'}</p>
        ) : (
          <div className="space-y-1 max-h-72 lg:max-h-none overflow-y-auto">
            {conversazioni.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setAttiva(c.id)}
                className={`w-full text-left rounded-lg px-2.5 py-2 text-sm hover:bg-muted ${attiva === c.id ? 'bg-muted font-medium' : ''}`}
              >
                <span className="flex items-start gap-2">
                  <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                  <span className="line-clamp-2">{c.titolo}</span>
                </span>
                <span className="block pl-5 text-xs text-muted-foreground">{dataOra(c.ultima)} · {c.domande.length} {c.domande.length === 1 ? 'domanda' : 'domande'}</span>
              </button>
            ))}
          </div>
        )}
      </aside>

      <section className="border rounded-xl bg-card flex flex-col lg:h-[calc(100vh-220px)]">
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {!attiva ? (
            <div className="max-w-2xl mx-auto py-6 space-y-4">
              <div>
                <p className="text-lg font-semibold">Chiedi all'Assistente</p>
                <p className="text-sm text-muted-foreground">
                  Norme su PFU, rifiuti, RENTRI, Albo e responsabile tecnico, oppure i dati della commessa: target, raccolto, liste, giacenze e qualifica dei fornitori.
                  Ogni risposta cita le fonti e, per le norme, controlla online che non ci siano novità.
                </p>
              </div>
              <div className="grid gap-2">
                {ESEMPI.map(e => (
                  <button key={e} type="button" onClick={() => invia(e)} className="text-left text-sm border rounded-lg px-3 py-2 hover:bg-muted">{e}</button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Le risposte sulle norme controllano anche le fonti online. Per decisioni con conseguenze legali verifica sempre il testo vigente.</p>
            </div>
          ) : (
            visibili.map(d => <Messaggio key={d.id} d={d} onValuta={(dd, modo) => setValuta({ d: dd, modo })} />)
          )}
          {inCorso && !invio && (
            <p className="text-xs text-muted-foreground flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin" /> Aggiorno appena la risposta è pronta…</p>
          )}
          <div ref={fine} />
        </div>
        <form
          className="border-t p-3 flex gap-2 items-end"
          onSubmit={(e) => { e.preventDefault(); invia(); }}
        >
          <Textarea
            rows={2}
            value={testo}
            onChange={e => setTesto(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); invia(); } }}
            placeholder={attiva ? 'Continua la conversazione…' : 'Scrivi la tua domanda…'}
            className="resize-none"
            maxLength={4000}
          />
          <Button type="submit" disabled={invio || !testo.trim()} className="gap-1">
            {invio ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Invia
          </Button>
        </form>
      </section>

      {valuta && (
        <DialogValutazione
          domanda={valuta.d}
          modo={valuta.modo}
          onClose={() => setValuta(null)}
          onSalvato={() => { setValuta(null); carica(); }}
        />
      )}
    </div>
  );
}
