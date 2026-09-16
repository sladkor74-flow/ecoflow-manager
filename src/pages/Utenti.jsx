import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { usePermessi } from '@/lib/permessi';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Users, ShieldCheck, Eye, CheckCircle2, AlertTriangle } from 'lucide-react';

// Modulo Utenti: chi entra nel gestionale e con quale livello.
//
// I livelli sono due. L'amministratore carica i file e modifica tutto; chi e' in
// consultazione guarda ed esporta, e per un caricamento o una correzione apre una
// richiesta. Il livello si cambia da qui e vale dal primo accesso successivo.
//
// La pagina la vede solo l'amministratore, e non puo' cambiare il proprio livello:
// togliersi i permessi da soli lascerebbe il gestionale senza nessuno che lo governa.

const LIVELLI = {
  admin: {
    nome: 'Amministratore',
    Icona: ShieldCheck,
    classe: 'text-primary',
    spiegazione: 'Carica i file, importa i dati e modifica ogni modulo.',
  },
  user: {
    nome: 'Consultazione',
    Icona: Eye,
    classe: 'text-slate-600',
    spiegazione: 'Consulta ed esporta tutto; per modifiche apre una richiesta.',
  },
};

const data = (v) => (v ? new Date(v).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');

export default function Utenti() {
  const { user, isAdmin } = usePermessi();
  const { toast } = useToast();
  const [utenti, setUtenti] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [inCorso, setInCorso] = useState(null);
  const [errore, setErrore] = useState(null);

  const carica = useCallback(async () => {
    setCaricamento(true);
    setErrore(null);
    try {
      const elenco = await base44.entities.User.list('-created_date', 200);
      setUtenti((elenco || []).filter(u => !u.is_service));
    } catch (e) {
      setErrore(e.message || 'Non riesco a leggere gli utenti.');
    }
    setCaricamento(false);
  }, []);

  useEffect(() => { if (isAdmin) carica(); else setCaricamento(false); }, [isAdmin, carica]);

  const cambiaLivello = async (u, livello) => {
    if (livello === u.role) return;
    const nome = u.full_name || u.email;
    const avviso = livello === 'admin'
      ? `Vuoi dare a ${nome} i permessi di amministratore? Potrà caricare file e modificare ogni modulo, fatturazione compresa.`
      : `Vuoi mettere ${nome} in sola consultazione? Potrà guardare ed esportare, ma non modificare più nulla.`;
    if (!window.confirm(avviso)) return;
    setInCorso(u.id);
    try {
      await base44.entities.User.update(u.id, { role: livello });
      toast({ title: 'Livello aggiornato', description: `${nome}: ${LIVELLI[livello].nome}. Vale dal suo prossimo accesso.` });
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

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold flex items-center gap-2">
          <Users className="w-7 h-7 text-primary" /> Utenti
        </h1>
        <p className="text-muted-foreground mt-1 max-w-3xl">
          Chi entra nel gestionale e che cosa può farci. Il livello si cambia da qui e vale dal primo accesso successivo.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {Object.entries(LIVELLI).map(([chiave, l]) => {
          const { Icona } = l;
          return (
            <div key={chiave} className="border rounded-lg bg-card p-4">
              <div className={`flex items-center gap-2 font-semibold ${l.classe}`}><Icona className="w-4 h-4" /> {l.nome}</div>
              <p className="text-sm text-muted-foreground mt-1">{l.spiegazione}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {utenti.filter(u => (u.role || 'user') === chiave).length} {utenti.filter(u => (u.role || 'user') === chiave).length === 1 ? 'persona' : 'persone'}
              </p>
            </div>
          );
        })}
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
                const livello = u.role || 'user';
                const sonoIo = user && u.id === user.id;
                return (
                  <tr key={u.id} className="border-t">
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
                        <Select value={livello} onValueChange={(v) => cambiaLivello(u, v)}>
                          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(LIVELLI).map(([k, l]) => <SelectItem key={k} value={k}>{l.nome}</SelectItem>)}
                          </SelectContent>
                        </Select>
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
        si passa dagli inviti dell'app: qui si decide solo che cosa può fare chi è già dentro.
      </p>
    </div>
  );
}
