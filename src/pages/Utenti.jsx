import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { usePermessi } from '@/lib/permessi';
import { LIVELLI, LIVELLO_PREDEFINITO, chiaveEmail, livelloValido } from '@/lib/livelli';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Users, ShieldCheck, Eye, Upload, CheckCircle2, AlertTriangle, Check, X } from 'lucide-react';

// Modulo Utenti: chi entra nel gestionale e che cosa puo' farci.
//
// I livelli stanno in un posto solo, src/lib/livelli.js, con l'elenco di quello
// che ciascuno puo' e non puo' fare. Quell'elenco si vede qui e ricompare nella
// domanda di conferma: chi assegna un livello deve sapere cosa sta concedendo,
// senza andarselo a ricordare.
//
// L'amministratore e' tale per la piattaforma; gli altri livelli li tiene il
// gestionale nell'entita' LivelloUtente, una riga per persona.

const ICONE = { admin: ShieldCheck, operatore_base: Upload, consultazione: Eye };
const COLORI = { admin: 'text-primary', operatore_base: 'text-amber-700', consultazione: 'text-slate-600' };
const ORDINE = ['admin', 'operatore_base', 'consultazione'];

const data = (v) => (v ? new Date(v).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');

function SchedaLivello({ chiave, quante }) {
  const l = LIVELLI[chiave];
  const Icona = ICONE[chiave];
  return (
    <div className="border rounded-lg bg-card p-4 space-y-2">
      <div className={`flex items-center gap-2 font-semibold ${COLORI[chiave]}`}><Icona className="w-4 h-4" /> {l.nome}</div>
      <p className="text-sm text-muted-foreground">{l.sommario}</p>
      <ul className="text-xs space-y-0.5">
        {l.puo.map(p => <li key={p} className="flex gap-1.5"><Check className="w-3 h-3 mt-0.5 shrink-0 text-green-600" /><span>{p}</span></li>)}
        {l.nonPuo.map(p => <li key={p} className="flex gap-1.5 text-muted-foreground"><X className="w-3 h-3 mt-0.5 shrink-0 text-red-500" /><span>{p}</span></li>)}
      </ul>
      <p className="text-xs text-muted-foreground pt-1 border-t">{quante} {quante === 1 ? 'persona' : 'persone'}</p>
    </div>
  );
}

export default function Utenti() {
  const { user, isAdmin } = usePermessi();
  const { toast } = useToast();
  const [utenti, setUtenti] = useState([]);
  const [livelli, setLivelli] = useState({});
  const [caricamento, setCaricamento] = useState(true);
  const [inCorso, setInCorso] = useState(null);
  const [errore, setErrore] = useState(null);

  const carica = useCallback(async () => {
    setCaricamento(true);
    setErrore(null);
    try {
      const [elenco, righe] = await Promise.all([
        base44.entities.User.list('-created_date', 200),
        base44.entities.LivelloUtente.list('-updated_date', 500),
      ]);
      const perEmail = {};
      for (const r of righe || []) {
        const k = chiaveEmail(r.email);
        if (k && !perEmail[k]) perEmail[k] = r;
      }
      setLivelli(perEmail);
      setUtenti((elenco || []).filter(u => !u.is_service));
    } catch (e) {
      setErrore(e.message || 'Non riesco a leggere gli utenti.');
    }
    setCaricamento(false);
  }, []);

  useEffect(() => { if (isAdmin) carica(); else setCaricamento(false); }, [isAdmin, carica]);

  const livelloDi = (u) => (u.role === 'admin' ? 'admin' : livelloValido(livelli[chiaveEmail(u.email)] ? livelli[chiaveEmail(u.email)].livello : null));

  const cambiaLivello = async (u, nuovo) => {
    const attuale = livelloDi(u);
    if (nuovo === attuale) return;
    const l = LIVELLI[nuovo];
    const nome = u.full_name || u.email;
    const testo = [
      `Vuoi dare a ${nome} il livello «${l.nome}»?`,
      '',
      'Potrà:',
      ...l.puo.map(p => '  • ' + p),
      ...(l.nonPuo.length ? ['', 'Non potrà:', ...l.nonPuo.map(p => '  • ' + p)] : []),
      '',
      'Vale dal suo prossimo accesso.',
    ].join('\n');
    if (!window.confirm(testo)) return;

    setInCorso(u.id);
    try {
      // Il ruolo della piattaforma distingue solo l'amministratore; il resto lo
      // dice la riga del gestionale.
      const ruolo = nuovo === 'admin' ? 'admin' : 'user';
      if ((u.role || 'user') !== ruolo) await base44.entities.User.update(u.id, { role: ruolo });

      const email = chiaveEmail(u.email);
      const riga = livelli[email];
      const dati = {
        email,
        nome: u.full_name || '',
        livello: nuovo === 'admin' ? LIVELLO_PREDEFINITO : nuovo,
        assegnato_da: (user && (user.full_name || user.email)) || '',
        assegnato_il: new Date().toISOString(),
      };
      if (riga) await base44.entities.LivelloUtente.update(riga.id, dati);
      else await base44.entities.LivelloUtente.create(dati);

      toast({ title: 'Livello aggiornato', description: `${nome}: ${l.nome}. Vale dal suo prossimo accesso.` });
      await carica();
    } catch (e) {
      toast({ title: 'Non riesco a cambiare il livello', description: e.message, variant: 'destructive' });
    }
    setInCorso(null);
  };

  if (!isAdmin) {
    return (
      <div className="p-4 lg:p-8 max-w-3xl mx-auto">
        <div className="flex items-start gap-2 border border-slate-300 bg-slate-50 text-slate-700 rounded-lg px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>Gli accessi al gestionale li gestisce l'amministratore.</div>
        </div>
      </div>
    );
  }

  const quante = (chiave) => utenti.filter(u => livelloDi(u) === chiave).length;

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold flex items-center gap-2">
          <Users className="w-7 h-7 text-primary" /> Utenti
        </h1>
        <p className="text-muted-foreground mt-1 max-w-3xl">
          Chi entra nel gestionale e che cosa può farci. Il livello si cambia da qui e vale dal primo accesso successivo;
          prima di applicarlo ti viene ricordato per esteso che cosa stai concedendo.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {ORDINE.map(k => <SchedaLivello key={k} chiave={k} quante={quante(k)} />)}
      </div>

      {errore && <div className="border border-red-300 bg-red-50 text-red-800 rounded-lg px-4 py-3 text-sm">{errore}</div>}

      {caricamento ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Leggo gli utenti…</div>
      ) : (
        <div className="border rounded-lg bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Persona</th>
                <th className="text-left px-3 py-2">Registrata il</th>
                <th className="text-left px-3 py-2">Accesso</th>
                <th className="text-left px-3 py-2">Livello</th>
              </tr>
            </thead>
            <tbody>
              {utenti.map(u => {
                const livello = livelloDi(u);
                const sonoIo = user && u.id === user.id;
                const riga = livelli[chiaveEmail(u.email)];
                return (
                  <tr key={u.id} className="border-t align-top">
                    <td className="px-3 py-2">
                      <div className="font-medium">{u.full_name || '(senza nome)'}{sonoIo ? ' · tu' : ''}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{data(u.created_date)}</td>
                    <td className="px-3 py-2">
                      {u.disabled
                        ? <span className="text-red-700">Sospeso</span>
                        : <span className="inline-flex items-center gap-1 text-green-700"><CheckCircle2 className="w-3.5 h-3.5" /> Attivo</span>}
                      {!u.is_verified && <div className="text-xs text-amber-700">email non confermata</div>}
                    </td>
                    <td className="px-3 py-2">
                      {sonoIo ? (
                        <span className="text-muted-foreground">{LIVELLI[livello].nome} — il tuo livello non si cambia da qui</span>
                      ) : inCorso === u.id ? (
                        <span className="inline-flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> salvo…</span>
                      ) : (
                        <>
                          <Select value={livello} onValueChange={(v) => cambiaLivello(u, v)}>
                            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {ORDINE.map(k => <SelectItem key={k} value={k}>{LIVELLI[k].nome}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <div className="text-xs text-muted-foreground mt-1 max-w-xs">{LIVELLI[livello].sommario}</div>
                          {riga && riga.assegnato_da && livello !== 'admin' && (
                            <div className="text-xs text-muted-foreground">assegnato da {riga.assegnato_da} il {data(riga.assegnato_il)}</div>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {utenti.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">Nessun utente registrato.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground max-w-3xl">
        Chi entra per la prima volta parte sempre in consultazione. Per sospendere un accesso o togliere del tutto una persona
        si passa dagli inviti dell'app: qui si decide che cosa può fare chi è già dentro.
      </p>
    </div>
  );
}
