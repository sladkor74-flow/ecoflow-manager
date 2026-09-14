import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Plus, History, Info, FileSpreadsheet, Factory } from 'lucide-react';
import { MESI, MESI_BREVI } from '@/lib/pfuConstants';
import { fetchAllClient } from '@/lib/fetchAllClient';
import { tonnellate, leggiNumero, leggiStorico, conModifica, nomeUtente, chiaveNome, dataOra, REGIONI_COMMESSA } from '@/lib/target';
import ImportaReportGenerale from '@/components/target-status/ImportaReportGenerale';
import AssegnaImpianti from '@/components/target-status/AssegnaImpianti';

// Target dei raccoglitori: l'unico punto in cui si scrivono.
// Per ogni raccoglitore, regione e impianto di destinazione, come nel Report
// Generale, il target
// annuo definito a inizio anno o alla contrattualizzazione e, mese per mese,
// quanto gli si affida. Dashboard, alert, Verifiche e gli altri moduli leggono
// questi valori: una modifica, anche a meta' mese, vale subito ovunque.

function Storico({ json, formato }) {
  const voci = leggiStorico(json);
  if (!voci.length) return null;
  return (
    <div className="border-t pt-2 mt-2 space-y-1 max-h-40 overflow-y-auto">
      <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1"><History className="w-3 h-3" />Modifiche</div>
      {[...voci].reverse().map((v, i) => (
        <div key={i} className="text-[11px] text-muted-foreground leading-snug">
          {dataOra(v.il)}{v.da ? ` · ${v.da}` : ''}: {v.prima ? `prima ${formato(v.prima)}` : 'primo inserimento'}{v.nota ? ` — ${v.nota}` : ''}
        </div>
      ))}
    </div>
  );
}

const formatoMese = (p) => (p.non_raccoglie ? 'non raccoglie' : `${tonnellate(p.target, 3)} t`);
const formatoAnnuo = (p) => `${tonnellate(p.target_tonnellate, 3)} t${p.attivo_dal ? `, attivo dal ${p.attivo_dal.split('-').reverse().join('/')}` : ''}`;

function CellaMese({ record, riga, mese, anno, isAdmin, onSalva }) {
  const [aperta, setAperta] = useState(false);
  const [valore, setValore] = useState('');
  const [nr, setNr] = useState(false);
  const [nota, setNota] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState('');
  const apri = (v) => {
    setAperta(v);
    if (!v) return;
    setValore(record && record.target != null && !record.non_raccoglie ? String(record.target).replace('.', ',') : '');
    setNr(!!(record && record.non_raccoglie));
    setNota('');
    setErrore('');
  };
  const modificato = !!record && leggiStorico(record.storico_json).some(s => s.prima);
  const salva = async () => {
    const n = leggiNumero(valore);
    if (!nr && (Number.isNaN(n) || (n !== null && n < 0))) { setErrore('Scrivi le tonnellate, per esempio 50 o 47,5'); return; }
    const target = nr || n === null ? 0 : Math.round(n * 1000) / 1000;
    if (record && (Number(record.target) || 0) === target && !!record.non_raccoglie === nr) { setAperta(false); return; }
    if (!record && target === 0 && !nr) { setAperta(false); return; }
    setSalvando(true);
    try {
      await onSalva(riga, mese, { target, non_raccoglie: nr, nota });
      setAperta(false);
    } catch (e) {
      setErrore(e.message || String(e));
    }
    setSalvando(false);
  };
  return (
    <Popover open={aperta} onOpenChange={apri}>
      <PopoverTrigger asChild>
        <button className="relative w-full px-1.5 py-1.5 text-right tabular-nums rounded hover:bg-primary/10 focus:outline-none focus:ring-1 focus:ring-primary">
          {record
            ? (record.non_raccoglie ? <span className="px-1 rounded bg-muted text-muted-foreground text-[10px] font-semibold">NR</span> : tonnellate(record.target))
            : <span className="text-muted-foreground/40">—</span>}
          {modificato && <span className="absolute top-1 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500" />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <div className="text-xs text-muted-foreground mb-2">{riga.nome}{riga.regione ? ` · ${riga.regione}` : ''} · {mese} {anno}</div>
        {isAdmin ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Input autoFocus value={valore} onChange={e => setValore(e.target.value)} disabled={nr} placeholder="0" inputMode="decimal"
                className="h-8 text-right" onKeyDown={e => { if (e.key === 'Enter') salva(); }} />
              <span className="text-sm text-muted-foreground">t</span>
            </div>
            <label className="flex items-center justify-between gap-2 text-sm">
              <span>Non raccoglie in questo mese</span>
              <Switch checked={nr} onCheckedChange={setNr} />
            </label>
            <Input value={nota} onChange={e => setNota(e.target.value)} placeholder="Motivo della modifica (facoltativo)" className="h-8 text-xs" />
            {errore && <p className="text-xs text-destructive">{errore}</p>}
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setAperta(false)}>Annulla</Button>
              <Button size="sm" onClick={salva} disabled={salvando}>{salvando && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}Salva</Button>
            </div>
          </div>
        ) : (
          <p className="text-sm">{record ? formatoMese(record) : 'Nessun target'}</p>
        )}
        <Storico json={record && record.storico_json} formato={formatoMese} />
      </PopoverContent>
    </Popover>
  );
}

function CellaAnnuo({ record, riga, anno, isAdmin, onSalva }) {
  const [aperta, setAperta] = useState(false);
  const [valore, setValore] = useState('');
  const [dal, setDal] = useState('');
  const [nota, setNota] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState('');
  const apri = (v) => {
    setAperta(v);
    if (!v) return;
    setValore(record && record.target_tonnellate != null ? String(record.target_tonnellate).replace('.', ',') : '');
    setDal((record && record.attivo_dal) || '');
    setNota('');
    setErrore('');
  };
  const salva = async () => {
    const n = leggiNumero(valore);
    if (Number.isNaN(n) || (n !== null && n < 0)) { setErrore('Scrivi le tonnellate, per esempio 600'); return; }
    const target = n === null ? 0 : Math.round(n * 1000) / 1000;
    if (record && (Number(record.target_tonnellate) || 0) === target && (record.attivo_dal || '') === dal) { setAperta(false); return; }
    setSalvando(true);
    try {
      await onSalva(riga, { target_tonnellate: target, attivo_dal: dal, nota });
      setAperta(false);
    } catch (e) {
      setErrore(e.message || String(e));
    }
    setSalvando(false);
  };
  const modificato = !!record && leggiStorico(record.storico_json).some(s => s.prima);
  return (
    <Popover open={aperta} onOpenChange={apri}>
      <PopoverTrigger asChild>
        <button className="relative w-full px-2 py-1.5 text-right tabular-nums font-semibold rounded hover:bg-primary/10 focus:outline-none focus:ring-1 focus:ring-primary">
          {record ? tonnellate(record.target_tonnellate) : <span className="text-muted-foreground/40 font-normal">—</span>}
          {modificato && <span className="absolute top-1 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500" />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <div className="text-xs text-muted-foreground mb-2">{riga.nome}{riga.regione ? ` · ${riga.regione}` : ''} · target annuo {anno}</div>
        {isAdmin ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Input autoFocus value={valore} onChange={e => setValore(e.target.value)} placeholder="0" inputMode="decimal" className="h-8 text-right"
                onKeyDown={e => { if (e.key === 'Enter') salva(); }} />
              <span className="text-sm text-muted-foreground">t</span>
            </div>
            <label className="block text-xs text-muted-foreground">
              Attivo dal (se contrattualizzato in corso d'anno)
              <Input type="date" value={dal} onChange={e => setDal(e.target.value)} className="h-8 mt-1" />
            </label>
            <Input value={nota} onChange={e => setNota(e.target.value)} placeholder="Motivo della modifica (facoltativo)" className="h-8 text-xs" />
            {errore && <p className="text-xs text-destructive">{errore}</p>}
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setAperta(false)}>Annulla</Button>
              <Button size="sm" onClick={salva} disabled={salvando}>{salvando && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}Salva</Button>
            </div>
          </div>
        ) : (
          <p className="text-sm">{record ? formatoAnnuo(record) : 'Nessun target annuo'}</p>
        )}
        <Storico json={record && record.storico_json} formato={formatoAnnuo} />
      </PopoverContent>
    </Popover>
  );
}

function NuovoRaccoglitore({ open, onClose, anno, nomiSuggeriti, impiantiSuggeriti, onCrea }) {
  const [nome, setNome] = useState('');
  const [regione, setRegione] = useState('');
  const [impianto, setImpianto] = useState('');
  const [valore, setValore] = useState('');
  const [dal, setDal] = useState('');
  const [errore, setErrore] = useState('');
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { if (open) { setNome(''); setRegione(''); setImpianto(''); setValore(''); setDal(''); setErrore(''); } }, [open]);
  const crea = async () => {
    const n = leggiNumero(valore);
    if (!nome.trim()) { setErrore('Indica il raccoglitore'); return; }
    if (!regione) { setErrore('Indica la regione'); return; }
    if (Number.isNaN(n) || (n !== null && n < 0)) { setErrore('Il target annuo deve essere un numero di tonnellate'); return; }
    setSalvando(true);
    try {
      await onCrea({ raccoglitore: nome.trim(), regione, impianto: impianto.trim(), target_tonnellate: n === null ? 0 : n, attivo_dal: dal });
      onClose();
    } catch (e) {
      setErrore(e.message || String(e));
    }
    setSalvando(false);
  };
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuova riga di target {anno}</DialogTitle>
          <DialogDescription>Una riga per raccoglitore, regione e impianto di destinazione, come nel Report Generale.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block text-sm">
            Raccoglitore
            <Input list="nomi-raccoglitori" value={nome} onChange={e => setNome(e.target.value)} className="mt-1" placeholder="Come compare sul portale" />
            <datalist id="nomi-raccoglitori">{nomiSuggeriti.map(n => <option key={n} value={n} />)}</datalist>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              Regione
              <select value={regione} onChange={e => setRegione(e.target.value)} className="mt-1 w-full h-9 border rounded-md px-2 bg-background text-sm">
                <option value="">Scegli…</option>
                {REGIONI_COMMESSA.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              Impianto
              <Input list="nomi-impianti" value={impianto} onChange={e => setImpianto(e.target.value)} className="mt-1" placeholder="Destinazione" />
              <datalist id="nomi-impianti">{impiantiSuggeriti.map(n => <option key={n} value={n} />)}</datalist>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              Target annuo (t)
              <Input value={valore} onChange={e => setValore(e.target.value)} inputMode="decimal" className="mt-1 text-right" placeholder="0" />
            </label>
            <label className="block text-sm">
              Attivo dal
              <Input type="date" value={dal} onChange={e => setDal(e.target.value)} className="mt-1" />
            </label>
          </div>
          {errore && <p className="text-sm text-destructive">{errore}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annulla</Button>
          <Button onClick={crea} disabled={salvando}>{salvando && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Aggiungi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const valoreMese = (m) => (m && !m.non_raccoglie ? Number(m.target) || 0 : 0);
const sommaMesi = (riga) => MESI.reduce((s, m) => s + valoreMese(riga.mesi[m]), 0);
const valoreAnnuo = (riga) => (riga.annuo ? Number(riga.annuo.target_tonnellate) || 0 : 0);

export default function TargetRaccoglitoriGrid({ anno, isAdmin, user }) {
  const { toast } = useToast();
  const [caricando, setCaricando] = useState(true);
  const [annui, setAnnui] = useState([]);
  const [mensili, setMensili] = useState([]);
  const [quoteImpianto, setQuoteImpianto] = useState(new Set());
  const [commessa, setCommessa] = useState(null);
  const [raccolto, setRaccolto] = useState([]);
  const [raccoltoImpianto, setRaccoltoImpianto] = useState([]);
  const [nuovo, setNuovo] = useState(false);
  const [importa, setImporta] = useState(false);
  const [assegna, setAssegna] = useState(false);

  const carica = useCallback(async () => {
    setCaricando(true);
    try {
      const [a, m, forn, comm, racc] = await Promise.all([
        fetchAllClient(base44.entities.TargetRaccoglitore, { anno }),
        fetchAllClient(base44.entities.TargetMensile, { anno }),
        base44.entities.FornitoreSecondaria.list('-created_date', 500).catch(() => []),
        base44.entities.CommessaEcotyre.filter({ anno }).catch(() => []),
        base44.functions.invoke('computeRaccolto', { filters: { anno: [anno], canale: 'rete' } }).then(r => r.data || r).catch(() => ({})),
      ]);
      setAnnui(a);
      setMensili(m);
      setQuoteImpianto(new Set(forn.filter(f => f.ruolo === 'doppio_ruolo' || f.ruolo === 'impianto').map(f => chiaveNome(f.nome))));
      setCommessa(comm[0] || null);
      setRaccolto(racc.by_raccoglitore || []);
      setRaccoltoImpianto(racc.by_raccoglitore_impianto || []);
    } catch (e) {
      toast({ title: 'Caricamento non riuscito', description: e.message || String(e), variant: 'destructive' });
    }
    setCaricando(false);
  }, [anno, toast]);

  useEffect(() => { carica(); }, [carica]);

  const trasportatori = useMemo(() => new Set(raccolto.map(r => chiaveNome(r.raccoglitore))), [raccolto]);

  // Regione prevalente di ogni raccoglitore nel raccolto dell'anno.
  const regionePrevalente = useMemo(() => {
    const m = new Map();
    for (const r of raccolto) {
      const k = chiaveNome(r.raccoglitore);
      const prima = m.get(k);
      if (!prima || r.totale > prima.totale) m.set(k, { regione: r.regione, totale: r.totale });
    }
    return m;
  }, [raccolto]);

  const righe = useMemo(() => {
    const elenco = [];
    const conMensili = new Set(mensili.map(m => chiaveNome(m.raccoglitore)));
    // Le quote impianto dei doppio ruolo registrate come target annui non sono
    // raccoglitori, a meno che quel nome raccolga davvero.
    const quota = (nome) => quoteImpianto.has(chiaveNome(nome)) && !trasportatori.has(chiaveNome(nome)) && !conMensili.has(chiaveNome(nome));
    const stessa = (r, nome, regione, impianto) => r.chiave === chiaveNome(nome) && r.regione === (regione || '') && r.impiantoChiave === chiaveNome(impianto || '');
    for (const a of annui) {
      if (quota(a.raccoglitore)) continue;
      const derivata = !a.regione;
      const regione = a.regione || (regionePrevalente.get(chiaveNome(a.raccoglitore)) || {}).regione || '';
      elenco.push({ chiave: chiaveNome(a.raccoglitore), nome: a.raccoglitore, regione, regioneDerivata: derivata, impianto: a.impianto || '', impiantoChiave: chiaveNome(a.impianto || ''), annuo: a, mesi: {} });
    }
    const doppioni = [];
    for (const m of [...mensili].sort((x, y) => String(x.updated_date || '').localeCompare(String(y.updated_date || '')))) {
      let riga = elenco.find(r => stessa(r, m.raccoglitore, m.regione, m.impianto));
      if (!riga) {
        riga = elenco.find(r => r.chiave === chiaveNome(m.raccoglitore) && r.regioneDerivata && !r.impianto && !m.impianto && !Object.keys(r.mesi).length);
        if (riga && m.regione) { riga.regione = m.regione; riga.regioneDerivata = false; }
      }
      if (!riga) {
        riga = { chiave: chiaveNome(m.raccoglitore), nome: m.raccoglitore, regione: m.regione || '', regioneDerivata: false, impianto: m.impianto || '', impiantoChiave: chiaveNome(m.impianto || ''), annuo: null, mesi: {} };
        elenco.push(riga);
      }
      if (riga.mesi[m.mese]) doppioni.push(`${riga.nome} ${m.mese}`);
      riga.mesi[m.mese] = m;
    }
    elenco.sort((x, y) => (!x.impianto - !y.impianto) || x.impianto.localeCompare(y.impianto, 'it') || x.regione.localeCompare(y.regione, 'it') || x.nome.localeCompare(y.nome, 'it'));
    return { elenco, doppioni };
  }, [annui, mensili, quoteImpianto, trasportatori, regionePrevalente]);

  const gruppi = useMemo(() => {
    const g = [];
    for (const r of righe.elenco) {
      const ultimo = g[g.length - 1];
      if (ultimo && ultimo.chiave === r.impiantoChiave) ultimo.righe.push(r);
      else g.push({ chiave: r.impiantoChiave, impianto: r.impianto, righe: [r] });
    }
    return g;
  }, [righe]);

  const salvaMese = async (riga, mese, { target, non_raccoglie, nota }) => {
    const r = riga.mesi[mese];
    const utente = nomeUtente(user);
    if (r) {
      const storico_json = conModifica(r.storico_json, { utente, nota, prima: { target: r.target ?? null, non_raccoglie: !!r.non_raccoglie } });
      await base44.entities.TargetMensile.update(r.id, { target, non_raccoglie, storico_json });
      setMensili(prev => prev.map(x => (x.id === r.id ? { ...x, target, non_raccoglie, storico_json, updated_date: new Date().toISOString() } : x)));
    } else {
      const creato = await base44.entities.TargetMensile.create({
        raccoglitore: riga.nome, regione: riga.regione || '', impianto: riga.impianto || '', mese, anno, target, non_raccoglie,
        storico_json: conModifica('[]', { utente, nota, prima: null }),
      });
      setMensili(prev => [...prev, creato]);
    }
  };

  const salvaAnnuo = async (riga, { target_tonnellate, attivo_dal, nota }) => {
    const r = riga.annuo;
    const utente = nomeUtente(user);
    if (r) {
      const storico_json = conModifica(r.storico_json, { utente, nota, prima: { target_tonnellate: r.target_tonnellate ?? null, attivo_dal: r.attivo_dal || '' } });
      await base44.entities.TargetRaccoglitore.update(r.id, { target_tonnellate, attivo_dal, storico_json });
      setAnnui(prev => prev.map(x => (x.id === r.id ? { ...x, target_tonnellate, attivo_dal, storico_json } : x)));
    } else {
      const creato = await base44.entities.TargetRaccoglitore.create({
        raccoglitore: riga.nome, regione: riga.regione || null, impianto: riga.impianto || '', anno, target_tonnellate, attivo_dal,
        storico_json: conModifica('[]', { utente, nota, prima: null }),
      });
      setAnnui(prev => [...prev, creato]);
    }
  };

  const creaRiga = async ({ raccoglitore, regione, impianto, target_tonnellate, attivo_dal }) => {
    if (righe.elenco.some(r => r.chiave === chiaveNome(raccoglitore) && r.regione === regione && r.impiantoChiave === chiaveNome(impianto))) {
      throw new Error(`${raccoglitore} in ${regione}${impianto ? ` verso ${impianto}` : ''} è già presente.`);
    }
    const creato = await base44.entities.TargetRaccoglitore.create({
      raccoglitore, regione, impianto, anno, target_tonnellate, attivo_dal,
      storico_json: conModifica('[]', { utente: nomeUtente(user), nota: 'nuova riga', prima: null }),
    });
    setAnnui(prev => [...prev, creato]);
  };

  const nomiSuggeriti = useMemo(() => [...new Set(raccolto.map(r => r.raccoglitore).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'it')), [raccolto]);
  const impiantiSuggeriti = useMemo(() => [...new Set(righe.elenco.map(r => r.impianto).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'it')), [righe]);

  const leggiLista = (json) => { try { const v = JSON.parse(json || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
  const totaliMese = MESI.map(m => righe.elenco.reduce((s, r) => s + valoreMese(r.mesi[m]), 0));
  const totaleAnnui = righe.elenco.reduce((s, r) => s + valoreAnnuo(r), 0);
  const totaleMesi = totaliMese.reduce((s, v) => s + v, 0);
  const targetRivisto = commessa ? leggiLista(commessa.target_mensile_json) : [];
  const haRivisto = targetRivisto.some(v => Number(v) > 0);
  const regioniContratto = commessa ? leggiLista(commessa.regioni_json) : [];
  const perRegione = [...new Set([...regioniContratto.map(r => r.regione), ...righe.elenco.map(r => r.regione).filter(Boolean)])].map(reg => {
    const qui = righe.elenco.filter(r => r.regione === reg);
    const contratto = regioniContratto.find(x => x.regione === reg);
    return { regione: reg, annuo: qui.reduce((s, r) => s + valoreAnnuo(r), 0), mesi: qui.reduce((s, r) => s + sommaMesi(r), 0), contratto: contratto ? Number(contratto.target_t) || 0 : null };
  });

  if (caricando) {
    return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" />Caricamento target {anno}…</div>;
  }

  const colonneMesi = (valori, classe = '') => valori.map((v, i) => <td key={i} className={`px-1.5 py-1 text-right tabular-nums ${classe}`}>{v === null ? '' : tonnellate(v)}</td>);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground max-w-3xl">
          L'unico punto in cui si scrivono i target dei raccoglitori, in tonnellate, per impianto di destinazione e regione come nel Report Generale. Il target
          annuo si definisce a inizio anno o alla contrattualizzazione; a inizio mese si scrive quanto si affida. Clicca su una cella per modificarla: vale subito
          in dashboard, alert, Verifiche e negli altri moduli, e la modifica resta nello storico <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 align-middle" />.
        </p>
        {isAdmin && (
          <div className="flex gap-2">
            {righe.elenco.some(r => !r.impianto && r.regione) && (
              <Button size="sm" variant="outline" onClick={() => setAssegna(true)}><Factory className="w-4 h-4 mr-1" />Assegna impianti</Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setImporta(true)}><FileSpreadsheet className="w-4 h-4 mr-1" />Importa dal Report Generale</Button>
            <Button size="sm" variant="outline" onClick={() => setNuovo(true)}><Plus className="w-4 h-4 mr-1" />Aggiungi riga</Button>
          </div>
        )}
      </div>

      {righe.doppioni.length > 0 && (
        <div className="flex items-start gap-2 text-xs text-amber-800"><Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />Target mensili doppi sulla stessa riga, vale l'ultimo modificato: {righe.doppioni.slice(0, 5).join(', ')}{righe.doppioni.length > 5 ? '…' : ''}</div>
      )}

      <div className="border rounded-lg overflow-x-auto bg-card">
        <table className="text-xs whitespace-nowrap border-collapse w-full">
          <thead className="bg-muted/60">
            <tr>
              <th className="sticky left-0 z-10 bg-muted px-3 py-2 text-left min-w-[210px]">Raccoglitore</th>
              <th className="px-2 py-2 text-left">Regione</th>
              <th className="px-2 py-2 text-right">Annuo</th>
              {MESI_BREVI.map(m => <th key={m} className="px-1.5 py-2 text-right min-w-[52px]">{m}</th>)}
              <th className="px-2 py-2 text-right">Somma mesi</th>
              <th className="px-2 py-2 text-right">Da ripartire</th>
            </tr>
          </thead>
          {gruppi.map(g => (
            <tbody key={g.chiave || 'senza'}>
              <tr className="bg-primary/5 border-t font-semibold">
                <td className="sticky left-0 z-10 bg-muted px-3 py-1.5" colSpan={2}>{g.impianto || 'Senza impianto indicato'}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{tonnellate(g.righe.reduce((s, r) => s + valoreAnnuo(r), 0))}</td>
                {colonneMesi(MESI.map(m => { const v = g.righe.reduce((s, r) => s + valoreMese(r.mesi[m]), 0); return v || null; }))}
                <td className="px-2 py-1.5 text-right tabular-nums">{tonnellate(g.righe.reduce((s, r) => s + sommaMesi(r), 0))}</td>
                <td />
              </tr>
              {g.righe.map(r => {
                const somma = sommaMesi(r);
                const annuo = r.annuo ? valoreAnnuo(r) : null;
                const resto = annuo !== null ? annuo - somma : null;
                return (
                  <tr key={`${r.chiave}|${r.regione}|${r.impiantoChiave}`} className="border-t hover:bg-muted/20">
                    <td className="sticky left-0 z-10 bg-card px-3 py-1 font-medium pl-5">
                      {r.nome}
                      {r.annuo && r.annuo.attivo_dal && <div className="text-[10px] font-normal text-muted-foreground">attivo dal {r.annuo.attivo_dal.split('-').reverse().join('/')}</div>}
                    </td>
                    <td className="px-2 py-1 text-muted-foreground" title={r.regioneDerivata ? 'Regione ricavata dal raccolto dell\'anno' : undefined}>{r.regione || '—'}{r.regioneDerivata && r.regione ? '*' : ''}</td>
                    <td className="px-1 py-0.5 border-l"><CellaAnnuo record={r.annuo} riga={r} anno={anno} isAdmin={isAdmin} onSalva={salvaAnnuo} /></td>
                    {MESI.map(m => (
                      <td key={m} className="px-0.5 py-0.5 border-l"><CellaMese record={r.mesi[m]} riga={r} mese={m} anno={anno} isAdmin={isAdmin} onSalva={salvaMese} /></td>
                    ))}
                    <td className="px-2 py-1 text-right tabular-nums border-l">{tonnellate(somma)}</td>
                    <td className={`px-2 py-1 text-right tabular-nums ${resto === null ? 'text-muted-foreground' : Math.abs(resto) < 0.5 ? 'text-emerald-700' : resto < 0 ? 'text-red-600' : 'text-amber-700'}`}>
                      {resto === null ? '—' : tonnellate(resto)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          ))}
          {righe.elenco.length === 0 && (
            <tbody><tr><td colSpan={17} className="px-3 py-8 text-center text-muted-foreground">Nessun target per il {anno}. Importali dal Report Generale o aggiungi una riga.</td></tr></tbody>
          )}
          {righe.elenco.length > 0 && (
            <tfoot className="border-t-2 bg-muted/30 font-semibold">
              <tr>
                <td className="sticky left-0 z-10 bg-muted px-3 py-1.5" colSpan={2}>Totale raccoglitori</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{tonnellate(totaleAnnui)}</td>
                {colonneMesi(totaliMese)}
                <td className="px-2 py-1.5 text-right tabular-nums">{tonnellate(totaleMesi)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{tonnellate(totaleAnnui - totaleMesi)}</td>
              </tr>
              {haRivisto && (
                <>
                  <tr className="font-normal text-muted-foreground">
                    <td className="sticky left-0 z-10 bg-muted px-3 py-1" colSpan={2}>Target mensile del contratto</td>
                    <td className="px-2 py-1 text-right tabular-nums">{tonnellate(commessa.target_annuo_t)}</td>
                    {colonneMesi(MESI.map((m, i) => Number(targetRivisto[i]) || 0))}
                    <td className="px-2 py-1 text-right tabular-nums">{tonnellate(targetRivisto.reduce((s, v) => s + (Number(v) || 0), 0))}</td>
                    <td />
                  </tr>
                  <tr className="font-normal">
                    <td className="sticky left-0 z-10 bg-muted px-3 py-1" colSpan={3}>Affidato meno contratto</td>
                    {MESI.map((m, i) => {
                      const d = totaliMese[i] - (Number(targetRivisto[i]) || 0);
                      return <td key={m} className={`px-1.5 py-1 text-right tabular-nums ${totaliMese[i] === 0 ? 'text-muted-foreground/40' : d < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{totaliMese[i] === 0 ? '—' : tonnellate(d)}</td>;
                    })}
                    <td colSpan={2} />
                  </tr>
                </>
              )}
            </tfoot>
          )}
        </table>
      </div>

      {perRegione.length > 0 && (
        <div className="border rounded-lg overflow-x-auto bg-card max-w-2xl">
          <table className="w-full text-xs">
            <thead className="bg-muted/60 text-left">
              <tr>
                <th className="px-3 py-2">Regione</th>
                <th className="px-3 py-2 text-right">Annuo raccoglitori</th>
                <th className="px-3 py-2 text-right">Somma mesi</th>
                <th className="px-3 py-2 text-right">Contratto</th>
                <th className="px-3 py-2 text-right">Annuo meno contratto</th>
              </tr>
            </thead>
            <tbody>
              {perRegione.map(r => (
                <tr key={r.regione} className="border-t">
                  <td className="px-3 py-1.5 font-medium">{r.regione}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{tonnellate(r.annuo)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{tonnellate(r.mesi)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{r.contratto !== null ? tonnellate(r.contratto) : '—'}</td>
                  <td className={`px-3 py-1.5 text-right tabular-nums ${r.contratto === null ? 'text-muted-foreground' : Math.abs(r.annuo - r.contratto) < 0.5 ? 'text-emerald-700' : r.annuo < r.contratto ? 'text-red-600' : 'text-amber-700'}`}>
                    {r.contratto !== null ? tonnellate(r.annuo - r.contratto) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!commessa && <p className="px-3 py-2 text-xs text-muted-foreground border-t">Il contratto per regione si inserisce nella scheda Commessa Ecotyre.</p>}
        </div>
      )}

      <NuovoRaccoglitore open={nuovo} onClose={() => setNuovo(false)} anno={anno} nomiSuggeriti={nomiSuggeriti} impiantiSuggeriti={impiantiSuggeriti} onCrea={creaRiga} />
      {assegna && (
        <AssegnaImpianti
          open={assegna}
          onClose={() => setAssegna(false)}
          righe={righe.elenco}
          raccoltoImpianto={raccoltoImpianto}
          impiantiNoti={[...new Set([...impiantiSuggeriti, ...raccoltoImpianto.map(x => x.impianto).filter(x => x && x !== 'N/D')])].sort((a, b) => a.localeCompare(b, 'it'))}
          anno={anno}
          user={user}
          onFatto={async () => { setAssegna(false); await carica(); }}
        />
      )}
      <ImportaReportGenerale open={importa} onClose={() => setImporta(false)} anno={anno} annui={annui} mensili={mensili} user={user}
        onImportato={async () => { setImporta(false); await carica(); }} />
    </div>
  );
}
