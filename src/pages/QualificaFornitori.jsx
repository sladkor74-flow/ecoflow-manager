import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ContrattiAnno from '@/components/qualifica/ContrattiAnno';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import {
  Loader2, ShieldCheck, BookOpen, UserPlus, Send, Search, ChevronRight, AlertTriangle, Users, CheckCircle2, ClipboardList, Bell,
} from 'lucide-react';
import SoggettoDettaglio from '@/components/qualifica/SoggettoDettaglio';
import CatalogoDocumenti from '@/components/qualifica/CatalogoDocumenti';
import { normalizzaRagioneSociale } from '@/lib/normalizzaRagioneSocialeClient';
import {
  RUOLI, STATI_REQUISITO, STATI_SOGGETTO, STATI_ALERT, URGENZA, EVENTO_AGGIORNAMENTO, dataIt, quandoScade, problemiDi,
} from '@/lib/qualifica';

// Campi del soggetto che si rimandano al backend per rivalutare i soli documenti,
// senza rileggere tutte le movimentazioni.
const CAMPI_BASE = ['chiave', 'nome', 'ruoli', 'origine', 'inclusione_id', 'motivo_inclusione', 'fornitore_id', 'piva', 'codice_fiscale', 'email'];

const FILTRI = [
  { chiave: 'alert', etichetta: 'Con alert' },
  { chiave: 'tutti', etichetta: 'Tutti' },
  { chiave: 'critico', etichetta: 'Critici' },
  { chiave: 'da_completare', etichetta: 'Da completare' },
  { chiave: 'qualificato', etichetta: 'Qualificati' },
];

function Pill({ stato, mappa }) {
  const s = mappa[stato] || { etichetta: stato, classe: 'bg-muted text-muted-foreground border-border' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium whitespace-nowrap ${s.classe}`}>{s.etichetta}</span>;
}

function Kpi({ etichetta, valore, Icona, tono }) {
  return (
    <div className="bg-card border rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icona className={`w-3.5 h-3.5 ${tono}`} /> {etichetta}
      </div>
      <div className={`text-2xl font-bold tabular-nums mt-1 ${tono}`}>{valore}</div>
    </div>
  );
}

function dettaglioAlert(r) {
  if (r.stato === 'scaduto') return `Scaduto il ${dataIt(r.scadenza)}`;
  if (r.stato === 'in_scadenza') return `Scade il ${dataIt(r.scadenza)}, ${quandoScade(r.giorni)}`;
  if (r.stato === 'mancante') return 'Documento da richiedere';
  const p = problemiDi(r);
  const principale = p.find(x => x.gravita === 'bloccante') || p[0];
  return principale ? principale.messaggio : (r.stato === 'da_verificare' ? 'Scadenza non determinata: verifica il documento' : '');
}

function PannelloAlert({ soggetti, onApri }) {
  const [tutti, setTutti] = useState(false);
  const alert = useMemo(() => soggetti
    .flatMap(s => s.requisiti.filter(r => STATI_ALERT.includes(r.stato)).map(r => ({ s, r })))
    .sort((a, b) => (URGENZA[a.r.stato] - URGENZA[b.r.stato]) || ((a.r.giorni ?? 99999) - (b.r.giorni ?? 99999)) || a.s.nome.localeCompare(b.s.nome, 'it')),
  [soggetti]);

  if (alert.length === 0) {
    return (
      <div className="flex items-center gap-2 border border-emerald-200 bg-emerald-50 text-emerald-800 rounded-lg px-4 py-3 text-sm">
        <CheckCircle2 className="w-4 h-4" /> Nessun alert aperto: tutti i documenti richiesti sono presenti e validi.
      </div>
    );
  }

  const visibili = tutti ? alert : alert.slice(0, 8);
  return (
    <section className="border border-amber-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-amber-50 border-b border-amber-200">
        <h2 className="font-heading font-semibold text-amber-900 flex items-center gap-2">
          <Bell className="w-4 h-4" /> Alert da gestire
          <span className="px-2 py-0.5 rounded-full bg-amber-600 text-white text-xs tabular-nums">{alert.length}</span>
        </h2>
        <span className="text-xs text-amber-900/70">dal più urgente</span>
      </div>
      <ul className="divide-y bg-card">
        {visibili.map(({ s, r }) => (
          <li key={s.chiave + r.tipo_id}>
            <button onClick={() => onApri(s.chiave)} className="w-full text-left px-4 py-2.5 hover:bg-muted/40 flex items-center gap-3">
              <Pill stato={r.stato} mappa={STATI_REQUISITO} />
              <div className="min-w-0 flex-1">
                <div className="text-sm">
                  <span className="font-medium">{s.nome}</span>
                  <span className="text-muted-foreground"> · {r.tipo_nome}</span>
                </div>
                <div className="text-xs text-muted-foreground truncate">{dettaglioAlert(r)}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          </li>
        ))}
      </ul>
      {alert.length > 8 && (
        <button onClick={() => setTutti(v => !v)} className="w-full px-4 py-2 text-sm text-primary hover:bg-muted/40 border-t bg-card">
          {tutti ? 'Mostra solo i più urgenti' : `Mostra tutti gli alert (${alert.length})`}
        </button>
      )}
    </section>
  );
}

export default function QualificaFornitori() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { toast } = useToast();

  const [anno, setAnno] = useState(new Date().getFullYear());
  const [dati, setDati] = useState(null);
  const [caricando, setCaricando] = useState(true);
  const [errore, setErrore] = useState(null);
  const [aperto, setAperto] = useState(null);
  const [filtro, setFiltro] = useState('alert');
  const [ricerca, setRicerca] = useState('');
  const [catalogoAperto, setCatalogoAperto] = useState(false);
  const [includiAperto, setIncludiAperto] = useState(false);
  const [inControllo, setInControllo] = useState(false);
  const datiRef = useRef(null);
  datiRef.current = dati;

  const notificaMenu = (d) => {
    window.dispatchEvent(new CustomEvent(EVENTO_AGGIORNAMENTO, { detail: { anno: d.anno, alert_aperti: d.riepilogo.alert_aperti } }));
  };

  // Calcolo completo: individua i soggetti dalle movimentazioni dell'anno.
  const caricaTutto = useCallback(async () => {
    setCaricando(true);
    setErrore(null);
    try {
      const res = await base44.functions.invoke('qualificaFornitori', { anno });
      const d = res.data || res;
      setDati(d);
      notificaMenu(d);
    } catch (e) {
      const msg = e && e.response && e.response.data && e.response.data.error;
      setErrore(msg || e.message || 'Errore nel calcolo della qualifica');
    }
    setCaricando(false);
  }, [anno]);

  // Aggiornamento rapido: rivaluta i soli documenti dei soggetti gia' noti.
  const aggiorna = useCallback(async () => {
    const attuali = datiRef.current;
    if (!attuali) return caricaTutto();
    try {
      const soggetti = attuali.soggetti.map(s => Object.fromEntries(CAMPI_BASE.map(k => [k, s[k]])));
      const res = await base44.functions.invoke('qualificaFornitori', { anno: attuali.anno, soggetti, esclusi: attuali.esclusi });
      const d = res.data || res;
      setDati(d);
      notificaMenu(d);
    } catch (e) {
      toast({ title: 'Aggiornamento non riuscito', description: e.message || String(e), variant: 'destructive' });
    }
  }, [caricaTutto, toast]);

  useEffect(() => { caricaTutto(); }, [caricaTutto]);

  // Finche' c'e' un documento in analisi il modulo ricontrolla da solo.
  const inAnalisi = !!dati && dati.soggetti.some(s => s.requisiti.some(r => r.stato === 'in_analisi'));
  useEffect(() => {
    if (!inAnalisi) return undefined;
    const t = setTimeout(() => { aggiorna(); }, 10000);
    return () => clearTimeout(t);
  }, [inAnalisi, dati, aggiorna]);

  const soggettiFiltrati = useMemo(() => {
    if (!dati) return [];
    const q = ricerca.trim().toLowerCase();
    return dati.soggetti
      .filter(s => !q || s.nome.toLowerCase().includes(q) || (s.piva || '').includes(q))
      .filter(s => {
        if (filtro === 'tutti') return true;
        if (filtro === 'alert') return s.requisiti.some(r => STATI_ALERT.includes(r.stato));
        if (filtro === 'qualificato') return s.stato === 'qualificato' || s.stato === 'in_scadenza';
        return s.stato === filtro;
      })
      .sort((a, b) => b.gravita - a.gravita || a.nome.localeCompare(b.nome, 'it'));
  }, [dati, filtro, ricerca]);

  const soggettoAperto = dati && aperto ? dati.soggetti.find(s => s.chiave === aperto) : null;

  const controllaEInvia = async () => {
    setInControllo(true);
    try {
      const res = await base44.functions.invoke('controlloQualifiche', { anno, forza: true });
      const d = res.data || res;
      if (d.inviata) toast({ title: 'Promemoria inviato', description: `Destinatari: ${d.destinatari.join(', ')}` });
      else toast({ title: 'Nessun promemoria da inviare', description: 'Non ci sono alert aperti.' });
      await aggiorna();
    } catch (e) {
      const msg = e && e.response && e.response.data && e.response.data.error;
      toast({ title: 'Controllo non riuscito', description: msg || e.message || String(e), variant: 'destructive' });
    }
    setInControllo(false);
  };

  const escludi = async (soggetto) => {
    try {
      if (soggetto.origine === 'manuale' && soggetto.inclusione_id) {
        await base44.entities.QualificaInclusione.delete(soggetto.inclusione_id);
      } else {
        const motivo = window.prompt(`Perché ${soggetto.nome} non va qualificato nel ${anno}?`, 'Non contrattualizzato nel ' + anno);
        if (motivo === null) return;
        await base44.entities.QualificaInclusione.create({
          anno, soggetto_chiave: soggetto.chiave, soggetto_nome: soggetto.nome, azione: 'escludi', motivo,
        });
      }
      setAperto(null);
      await caricaTutto();
    } catch (e) {
      toast({ title: 'Operazione non riuscita', description: e.message || String(e), variant: 'destructive' });
    }
  };

  const reincludi = async (escluso) => {
    try {
      await base44.entities.QualificaInclusione.delete(escluso.inclusione_id);
      await caricaTutto();
    } catch (e) {
      toast({ title: 'Operazione non riuscita', description: e.message || String(e), variant: 'destructive' });
    }
  };

  const annoCorrente = new Date().getFullYear();
  const anni = [annoCorrente + 1, annoCorrente, annoCorrente - 1];
  const r = dati ? dati.riepilogo : null;

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-primary" /> Qualifica Fornitori
          </h1>
          <p className="text-muted-foreground mt-1 max-w-3xl">
            Presenza e validità dei documenti richiesti ai fornitori e al cliente contrattualizzati nel {anno}.
            Un agente legge ogni documento caricato, ne verifica validità e scadenza e segnala cosa chiedere, e a chi.
          </p>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          <label className="text-xs text-muted-foreground">
            Anno
            <select value={anno} onChange={(e) => { setAnno(Number(e.target.value)); setAperto(null); setDati(null); }} className="block mt-1 px-2 py-1.5 rounded-md border bg-card text-sm text-foreground">
              {anni.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          {isAdmin && (
            <>
              <Button variant="outline" size="sm" onClick={() => setCatalogoAperto(true)}><BookOpen className="w-4 h-4 mr-1" />Catalogo documenti</Button>
              <Button variant="outline" size="sm" onClick={() => setIncludiAperto(true)}><UserPlus className="w-4 h-4 mr-1" />Includi un soggetto</Button>
              <Button size="sm" onClick={controllaEInvia} disabled={inControllo || caricando}>
                {inControllo ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
                Invia promemoria ora
              </Button>
            </>
          )}
        </div>
      </div>

      {errore && (
        <div className="flex items-start gap-2 border border-red-300 bg-red-50 text-red-800 rounded-lg px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{errore}</span>
        </div>
      )}

      {caricando && !dati ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Individuo i fornitori attivi nel {anno}…
        </div>
      ) : dati && (
        <>
          {r.catalogo_vuoto && (
            <div className="flex items-center justify-between gap-3 border border-sky-200 bg-sky-50 text-sky-900 rounded-lg px-4 py-3 text-sm flex-wrap">
              <span>Il catalogo dei documenti è vuoto: senza di esso non c'è nulla da richiedere ai fornitori.</span>
              {isAdmin && <Button size="sm" variant="outline" onClick={() => setCatalogoAperto(true)}>Apri il catalogo</Button>}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Kpi etichetta={`Soggetti ${anno}`} valore={r.soggetti} Icona={Users} tono="text-foreground" />
            <Kpi etichetta="Qualificati" valore={r.qualificati} Icona={CheckCircle2} tono="text-emerald-600" />
            <Kpi etichetta="Da completare" valore={r.da_completare} Icona={ClipboardList} tono="text-orange-600" />
            <Kpi etichetta="Critici" valore={r.critici} Icona={AlertTriangle} tono="text-red-600" />
            <Kpi etichetta="Alert aperti" valore={r.alert_aperti} Icona={Bell} tono="text-amber-600" />
          </div>

          <Tabs defaultValue="documenti">
            <TabsList>
              <TabsTrigger value="documenti">Documenti</TabsTrigger>
              <TabsTrigger value="contratti">Contratti</TabsTrigger>
            </TabsList>

            <TabsContent value="contratti" className="mt-4">
              <ContrattiAnno anno={anno} isAdmin={isAdmin} />
            </TabsContent>

            <TabsContent value="documenti" className="mt-4 space-y-4">
          <PannelloAlert soggetti={dati.soggetti} onApri={setAperto} />

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex flex-wrap gap-1.5">
                {FILTRI.map(f => (
                  <button key={f.chiave} onClick={() => setFiltro(f.chiave)}
                    className={`px-3 py-1 rounded-full border text-sm ${filtro === f.chiave ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}>
                    {f.etichetta}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input value={ricerca} onChange={(e) => setRicerca(e.target.value)} placeholder="Cerca per nome o P.IVA"
                  className="pl-8 pr-3 py-1.5 rounded-md border bg-card text-sm w-64" />
              </div>
            </div>

            <div className="border rounded-lg overflow-x-auto bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Soggetto</th>
                    <th className="px-4 py-2.5 font-semibold">Documenti obbligatori</th>
                    <th className="px-4 py-2.5 font-semibold">Prossima scadenza</th>
                    <th className="px-4 py-2.5 font-semibold text-center">Alert</th>
                    <th className="px-4 py-2.5 font-semibold">Stato</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {soggettiFiltrati.map(s => {
                    const nAlert = s.requisiti.filter(x => STATI_ALERT.includes(x.stato)).length;
                    const perc = s.obbligatori_totali ? Math.round((s.obbligatori_validi / s.obbligatori_totali) * 100) : 0;
                    return (
                      <tr key={s.chiave} onClick={() => setAperto(s.chiave)} className="border-t hover:bg-muted/30 cursor-pointer">
                        <td className="px-4 py-3">
                          <div className="font-medium">{s.nome}</div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {s.ruoli.map(x => <span key={x} className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[11px]">{RUOLI[x] || x}</span>)}
                          </div>
                        </td>
                        <td className="px-4 py-3 min-w-[160px]">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                              <div className={`h-full rounded-full ${perc === 100 ? 'bg-emerald-500' : perc >= 50 ? 'bg-amber-500' : 'bg-orange-500'}`} style={{ width: `${perc}%` }} />
                            </div>
                            <span className="text-xs tabular-nums text-muted-foreground w-10 text-right">{s.obbligatori_validi}/{s.obbligatori_totali}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 tabular-nums">{s.prossima_scadenza ? dataIt(s.prossima_scadenza) : <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-4 py-3 text-center">
                          {nAlert > 0
                            ? <span className="inline-flex min-w-[1.5rem] justify-center px-1.5 py-0.5 rounded-full bg-amber-600 text-white text-xs font-semibold tabular-nums">{nAlert}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3"><Pill stato={s.stato} mappa={STATI_SOGGETTO} /></td>
                        <td className="pr-3"><ChevronRight className="w-4 h-4 text-muted-foreground" /></td>
                      </tr>
                    );
                  })}
                  {soggettiFiltrati.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      {dati.soggetti.length === 0 ? `Nessun fornitore attivo nel ${anno}.` : 'Nessun soggetto corrisponde al filtro.'}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {dati.esclusi.length > 0 && (
            <section className="text-sm">
              <h3 className="font-semibold text-muted-foreground mb-2">Esclusi dalla qualifica {anno}</h3>
              <div className="border rounded-lg divide-y bg-card">
                {dati.esclusi.map(e => (
                  <div key={e.chiave} className="flex items-center justify-between gap-3 px-4 py-2">
                    <div>
                      <span className="font-medium">{e.nome}</span>
                      {e.motivo && <span className="text-muted-foreground"> · {e.motivo}</span>}
                    </div>
                    {isAdmin && <Button size="sm" variant="ghost" onClick={() => reincludi(e)}>Reincludi</Button>}
                  </div>
                ))}
              </div>
            </section>
          )}
            </TabsContent>
          </Tabs>
        </>
      )}

      <SoggettoDettaglio
        soggetto={soggettoAperto}
        anno={anno}
        isAdmin={isAdmin}
        open={!!soggettoAperto}
        onClose={() => setAperto(null)}
        onAggiorna={aggiorna}
        onEscludi={escludi}
      />

      {isAdmin && (
        <CatalogoDocumenti open={catalogoAperto} onClose={() => setCatalogoAperto(false)} onModificato={aggiorna} />
      )}

      {isAdmin && (
        <IncludiSoggetto open={includiAperto} anno={anno} onClose={() => setIncludiAperto(false)} onFatto={caricaTutto} />
      )}
    </div>
  );
}

// Inclusione manuale: per chi va qualificato prima ancora del primo viaggio,
// per esempio un fornitore appena contrattualizzato.
function IncludiSoggetto({ open, anno, onClose, onFatto }) {
  const [nome, setNome] = useState('');
  const [ruoli, setRuoli] = useState([]);
  const [motivo, setMotivo] = useState('');
  const [anagrafica, setAnagrafica] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    setNome(''); setRuoli([]); setMotivo('');
    base44.entities.Fornitore.list('ragione_sociale', 1000).then(setAnagrafica).catch(() => setAnagrafica([]));
  }, [open]);

  const salva = async () => {
    const chiave = normalizzaRagioneSociale(nome);
    if (!chiave) { toast({ title: 'Indica la ragione sociale', variant: 'destructive' }); return; }
    if (ruoli.length === 0) { toast({ title: 'Scegli almeno un ruolo', variant: 'destructive' }); return; }
    setSalvando(true);
    try {
      await base44.entities.QualificaInclusione.create({
        anno, soggetto_chiave: chiave, soggetto_nome: nome.trim(), azione: 'includi', ruoli: ruoli.join(','), motivo,
      });
      onClose();
      await onFatto();
    } catch (e) {
      toast({ title: 'Salvataggio non riuscito', description: e.message || String(e), variant: 'destructive' });
    }
    setSalvando(false);
  };

  const campo = 'block mt-1 w-full px-2 py-1.5 rounded-md border bg-card text-sm text-foreground';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Includi un soggetto nella qualifica {anno}</DialogTitle>
          <DialogDescription>
            Serve per un fornitore appena contrattualizzato che non ha ancora lavorato nell'anno.
            Gli altri compaiono da soli.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block text-xs text-muted-foreground">
            Ragione sociale
            <input list="anagrafica-fornitori" className={campo} value={nome} onChange={(e) => setNome(e.target.value)} />
            <datalist id="anagrafica-fornitori">
              {anagrafica.map(f => <option key={f.id} value={f.ragione_sociale} />)}
            </datalist>
          </label>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Ruoli</div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(RUOLI).map(([k, v]) => (
                <button key={k} type="button" onClick={() => setRuoli(r => (r.includes(k) ? r.filter(x => x !== k) : [...r, k]))}
                  className={`px-2.5 py-1 rounded-full border text-xs ${ruoli.includes(k) ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>
          <label className="block text-xs text-muted-foreground">
            Motivo
            <input className={campo} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Es. contratto firmato il 10/01" />
          </label>
          <div className="flex gap-2 pt-1">
            <Button onClick={salva} disabled={salvando}>{salvando && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Includi</Button>
            <Button variant="ghost" onClick={onClose}>Annulla</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
