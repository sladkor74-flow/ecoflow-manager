import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Save, ChevronLeft } from 'lucide-react';
import { calcExtraRaccolta } from '@/lib/extraRaccoltaCalc';
import { PROV_TO_REGION } from '@/lib/regioneMap';
import { normalizzaRagioneSociale } from '@/lib/normalizzaRagioneSocialeClient';
import { formatNumber } from '@/lib/utils';
import { giornoDaData, dataDaGiorno, competenza, datiChiusuraCompleti } from '@/lib/extraRaccoltaStato';

const CLASSI = ['P', 'M', 'G1', 'G2'];

const EMPTY = {
  stato: 'assegnato', ordine_immesso_il: '',
  numero_fir: '', tipologia_trasporto: '', tipo_movimento: 'primaria', stoccaggio: '',
  trasporto_iniziato_il: '', trasporto_finito_il: '',
  produttore: '', trasportatore: '', destinazione: '', tipo_destinazione: 'imp',
  provincia: '', automezzo: '',
  cer: '160103', classe: '', peso_effettivo: '',
  prezzo_attivo_t: 0, sovracosto_raccolta: 0, sovracosto_trasporto: 0, sovracosto_trattamento: 0,
  costo_raccolta_t: 0, costo_stoccaggio_t: 0, costo_trattamento_t: 0,
  costo_pulizia: 0, costi_aggiuntivi: 0, note_costi: '', note: '',
};


// Select con opzioni + "Altro..." che rivela un input di testo libero
function ComboSelect({ value, onChange, options, placeholder }) {
  const isCustomInit = !!value && !options.some(o => o.value === value);
  const [custom, setCustom] = useState(isCustomInit);

  // Rivaluta quando le opzioni vengono caricate (async)
  useEffect(() => {
    if (options.length > 0) {
      setCustom(!!value && !options.some(o => o.value === value));
    }
  }, [options]);

  if (custom) {
    return (
      <div className="flex gap-1">
        <Input
          className="h-9 text-sm"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Inserisci nome..."
        />
        <Button size="sm" variant="outline" type="button" className="px-2 shrink-0" onClick={() => { setCustom(false); onChange(''); }}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <Select value={value || undefined} onValueChange={v => {
      if (v === '__altro__') { setCustom(true); onChange(''); }
      else onChange(v);
    }}>
      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        <SelectItem value="__altro__">Altro...</SelectItem>
      </SelectContent>
    </Select>
  );
}

export default function ExtraRaccoltaForm({ open, initial, onSave, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY });
  const [fornitori, setFornitori] = useState([]);
  const [tariffe, setTariffe] = useState([]);
  const [province, setProvince] = useState([]);
  const [tipologie, setTipologie] = useState([]);
  const [daContrattoR, setDaContrattoR] = useState(false);
  const [daContrattoD, setDaContrattoD] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const f = await base44.entities.Fornitore.filter({ stato: 'attivo' }, 'ragione_sociale', 500);
        setFornitori(f);
      } catch {}
      try {
        const t = await base44.entities.Tariffa.filter({ direzione: 'PASSIVA', stato: 'attivo' }, '-created_date', 2000);
        setTariffe(t);
      } catch {}
      // Tutte le province italiane: leggerle dalle primarie ne caricava solo una parte.
      setProvince(Object.keys(PROV_TO_REGION).sort());
      try {
        const r = await base44.entities.ExtraRaccolta.list('-created_date', 5000);
        setTipologie([...new Set(r.map(r => r.tipologia_trasporto).filter(Boolean))].sort());
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (open) {
      const d = { ...EMPTY, ...(initial || {}) };
      // Una scheda gia' salvata senza stato resta senza: lo stato va scelto.
      if (initial?.id) d.stato = String(initial.stato || '').toLowerCase().trim();
      d.ordine_immesso_il = giornoDaData(initial?.ordine_immesso_il);
      d.trasporto_iniziato_il = giornoDaData(initial?.trasporto_iniziato_il);
      d.trasporto_finito_il = giornoDaData(initial?.trasporto_finito_il);
      setForm(d);
      setDaContrattoR(false);
      setDaContrattoD(false);
      setErrors({});
    }
  }, [open, initial]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // SMOCO raccoglie anche con i suoi mezzi: va indicata come trasportatore per
  // chiarezza e completezza, anche se non puo' fatturare a se stessa. Nella
  // passiva compare a zero con questa motivazione; qui lo si dice gia' nella
  // scelta, cosi' nessuno si aspetta una fattura.
  const trasportatori = useMemo(
    () => fornitori.filter(f => f.ruolo_raccolta).map(f => ({
      value: f.ragione_sociale,
      label: f.interno ? `${f.ragione_sociale} — interno, non fatturato` : f.ragione_sociale,
    })),
    [fornitori]
  );
  const destinatari = useMemo(
    () => fornitori.filter(f => f.ruolo_trattamento || f.ruolo_stoccaggio).map(f => ({ value: f.ragione_sociale, label: f.ragione_sociale })),
    [fornitori]
  );
  const stoccaggi = useMemo(
    () => fornitori.filter(f => f.ruolo_stoccaggio).map(f => ({ value: f.ragione_sociale, label: f.ragione_sociale })),
    [fornitori]
  );
  const secondaria = form.tipo_movimento === 'secondaria';
  const terminato = form.stato === 'terminato';
  // Vero quando il trasportatore scelto e' interno: la raccolta non si paga.
  // Si ricava dal trasportatore, non si tiene a parte: cosi' e' giusto anche
  // aprendo un ritiro gia' salvato.
  const raccoltaInterna = useMemo(() => {
    if (secondaria || !form.trasportatore) return false;
    const f = fornitori.find(x => normalizzaRagioneSociale(x.ragione_sociale) === normalizzaRagioneSociale(form.trasportatore));
    return !!(f && f.interno);
  }, [fornitori, form.trasportatore, secondaria]);

  const precompila = (nome, prestazione, dataRif) => {
    if (!nome) return;
    if (prestazione === 'RACCOLTA' && form.tipo_movimento === 'secondaria') return;
    const forn = fornitori.find(f => normalizzaRagioneSociale(f.ragione_sociale) === normalizzaRagioneSociale(nome));
    if (!forn) return;
    // Un trasportatore interno non fattura a SMOCO: il costo di raccolta e' zero.
    // Va scritto esplicitamente, altrimenti resterebbe il costo del trasportatore
    // scelto prima e la passiva lo conterebbe.
    if (prestazione === 'RACCOLTA' && forn.interno) {
      set('costo_raccolta_t', 0); setDaContrattoR(false);
      return;
    }
    const data = dataRif || form.trasporto_finito_il || new Date().toISOString().split('T')[0];
    const candidate = tariffe.find(t => {
      if (t.fornitore_id !== forn.id || t.prestazione !== prestazione || t.direzione !== 'PASSIVA' || t.stato !== 'attivo') return false;
      if (t.tipologia !== 'EXTRA_RACCOLTA' && t.tipologia !== 'RETE') return false;
      if (t.data_inizio_validita && data < t.data_inizio_validita) return false;
      if (t.data_fine_validita && data > t.data_fine_validita) return false;
      if (t.classe_materiale && t.classe_materiale !== form.classe) return false;
      return true;
    });
    if (candidate) {
      if (prestazione === 'RACCOLTA') { set('costo_raccolta_t', candidate.valore); setDaContrattoR(true); }
      else if (prestazione === 'TRATTAMENTO') { set('costo_trattamento_t', candidate.valore); setDaContrattoD(true); }
      else if (prestazione === 'CONFERIMENTO_STOCCAGGIO') { set('costo_stoccaggio_t', candidate.valore); setDaContrattoD(true); }
    }
  };

  const onTrasportatoreChange = (v) => {
    set('trasportatore', v);
    setDaContrattoR(false);
    if (v) precompila(v, 'RACCOLTA');
  };

  const onDestinatarioChange = (v) => {
    set('destinazione', v);
    setDaContrattoD(false);
    if (v) {
      const prest = form.tipo_destinazione === 'stoc' ? 'CONFERIMENTO_STOCCAGGIO' : 'TRATTAMENTO';
      precompila(v, prest);
    }
  };

  const onTipoDestChange = (v) => {
    set('tipo_destinazione', v);
    setDaContrattoD(false);
    if (form.destinazione) {
      const prest = v === 'stoc' ? 'CONFERIMENTO_STOCCAGGIO' : 'TRATTAMENTO';
      precompila(form.destinazione, prest);
    }
  };

  const onClasseChange = (v) => {
    set('classe', v);
    setDaContrattoR(false); setDaContrattoD(false);
    if (form.trasportatore) precompila(form.trasportatore, 'RACCOLTA');
    if (form.destinazione) {
      const prest = form.tipo_destinazione === 'stoc' ? 'CONFERIMENTO_STOCCAGGIO' : 'TRATTAMENTO';
      precompila(form.destinazione, prest);
    }
  };

  const onDataFineChange = (v) => {
    set('trasporto_finito_il', v);
    setDaContrattoR(false); setDaContrattoD(false);
    if (form.trasportatore) precompila(form.trasportatore, 'RACCOLTA', v);
    if (form.destinazione) {
      const prest = form.tipo_destinazione === 'stoc' ? 'CONFERIMENTO_STOCCAGGIO' : 'TRATTAMENTO';
      precompila(form.destinazione, prest, v);
    }
  };

  // Assegnato: la richiesta, con chi la deve evadere e da quando. Terminato: in
  // piu' FIR, fine trasporto e peso effettivo, perche' va in fatturazione.
  const validate = () => {
    const e = {};
    if (!form.stato) e.stato = 'Scegli lo stato';
    if (form.tipo_movimento === 'secondaria') {
      if (!form.stoccaggio) e.stoccaggio = 'Obbligatorio';
      if (terminato && !form.destinazione) e.destinazione = 'Obbligatorio';
    } else if (!form.produttore) {
      e.produttore = 'Obbligatorio';
    }
    if (!form.classe) e.classe = 'Obbligatorio';
    if (form.stato === 'assegnato') {
      if (!form.ordine_immesso_il) e.ordine_immesso_il = 'Obbligatoria';
      if (!form.trasportatore) e.trasportatore = 'Obbligatorio';
    }
    if (terminato) {
      if (!form.numero_fir) e.numero_fir = 'Obbligatorio';
      if (!form.trasporto_finito_il) e.trasporto_finito_il = 'Obbligatorio';
      if (!form.peso_effettivo || Number(form.peso_effettivo) <= 0) e.peso_effettivo = 'Maggiore di zero';
    } else if (form.peso_effettivo !== '' && form.peso_effettivo !== null && Number(form.peso_effettivo) < 0) {
      e.peso_effettivo = 'Non negativo';
    }
    if ((Number(form.costo_pulizia) > 0 || Number(form.costi_aggiuntivi) > 0) && !form.note_costi)
      e.note_costi = 'Obbligatorio quando costo pulizia o costi aggiuntivi > 0';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = () => {
    if (!validate()) return;
    const p = { ...form };
    if (p.stato === 'assegnato' && datiChiusuraCompleti(p)
      && window.confirm('Hai inserito FIR, data di fine trasporto e peso effettivo. Segnare l\'intervento come terminato? Solo i terminati vanno in fatturazione.')) {
      p.stato = 'terminato';
    }
    ['peso_effettivo', 'prezzo_attivo_t', 'sovracosto_raccolta', 'sovracosto_trasporto', 'sovracosto_trattamento',
     'costo_raccolta_t', 'costo_stoccaggio_t', 'costo_trattamento_t', 'costo_pulizia', 'costi_aggiuntivi'].forEach(k => {
      p[k] = Number(p[k]) || 0;
    });
    p.ordine_immesso_il = dataDaGiorno(form.ordine_immesso_il);
    p.trasporto_iniziato_il = dataDaGiorno(form.trasporto_iniziato_il);
    p.trasporto_finito_il = dataDaGiorno(form.trasporto_finito_il);
    // Competenza dalla fine trasporto; per una richiesta ancora aperta dalla data della richiesta.
    Object.assign(p, competenza(form.trasporto_finito_il || form.ordine_immesso_il));
    if (!p.id_ordine) p.id_ordine = p.numero_fir || `ER-${Date.now()}`;
    // In una secondaria il soggetto da cui parte il carico e' lo stoccaggio.
    if (p.tipo_movimento === 'secondaria') p.produttore = p.stoccaggio;
    else p.stoccaggio = '';
    onSave(p);
  };

  const calc = calcExtraRaccolta(form);

  const NumField = ({ label, k }) => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type="number" className="h-9 text-sm" value={form[k]} onChange={e => set(k, e.target.value)} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial?.id ? 'Modifica intervento' : 'Nuovo intervento Extra Raccolta'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* GRUPPO Intervento */}
          <fieldset className="border rounded-lg p-3">
            <legend className="text-sm font-semibold px-1">Intervento</legend>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Stato *</Label>
                <Select value={form.stato || undefined} onValueChange={v => set('stato', v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Scegli..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="assegnato">Assegnato: da evadere</SelectItem>
                    <SelectItem value="terminato">Terminato: evaso</SelectItem>
                  </SelectContent>
                </Select>
                {errors.stato && <p className="text-xs text-destructive">{errors.stato}</p>}
                <p className="text-xs text-muted-foreground">Solo i terminati vanno in fatturazione</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data richiesta{form.stato === 'assegnato' ? ' *' : ''}</Label>
                <Input type="date" className="h-9 text-sm" value={form.ordine_immesso_il} onChange={e => set('ordine_immesso_il', e.target.value)} />
                {errors.ordine_immesso_il && <p className="text-xs text-destructive">{errors.ordine_immesso_il}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Nr. FIR{terminato ? ' *' : ''}</Label>
                <Input className="h-9 text-sm" value={form.numero_fir} onChange={e => set('numero_fir', e.target.value)} />
                {errors.numero_fir && <p className="text-xs text-destructive">{errors.numero_fir}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Movimento *</Label>
                <Select value={form.tipo_movimento || 'primaria'} onValueChange={v => { set('tipo_movimento', v); if (v === 'secondaria') { set('tipo_destinazione', 'imp'); setDaContrattoR(false); } }}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primaria">Primaria: raccolta</SelectItem>
                    <SelectItem value="secondaria">Secondaria: da stoccaggio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tipologia trasporto</Label>
                <Input className="h-9 text-sm" list="tipologie-list" value={form.tipologia_trasporto} onChange={e => set('tipologia_trasporto', e.target.value)} placeholder="es. PFU ZERO - MAREVIVO" />
                <datalist id="tipologie-list">{tipologie.map(t => <option key={t} value={t} />)}</datalist>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data inizio trasporto</Label>
                <Input type="date" className="h-9 text-sm" value={form.trasporto_iniziato_il} onChange={e => set('trasporto_iniziato_il', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data fine trasporto{terminato ? ' *' : ''}</Label>
                <Input type="date" className="h-9 text-sm" value={form.trasporto_finito_il} onChange={e => onDataFineChange(e.target.value)} />
                {errors.trasporto_finito_il && <p className="text-xs text-destructive">{errors.trasporto_finito_il}</p>}
                <p className="text-xs text-muted-foreground">Determina il mese di competenza</p>
              </div>
            </div>
          </fieldset>

          {/* GRUPPO Soggetti */}
          <fieldset className="border rounded-lg p-3">
            <legend className="text-sm font-semibold px-1">Soggetti</legend>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
              {secondaria ? (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Stoccaggio di partenza *</Label>
                  <ComboSelect value={form.stoccaggio} onChange={v => set('stoccaggio', v)} options={stoccaggi} placeholder="Seleziona..." />
                  {errors.stoccaggio && <p className="text-xs text-destructive">{errors.stoccaggio}</p>}
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Produttore *</Label>
                  <Input className="h-9 text-sm" value={form.produttore} onChange={e => set('produttore', e.target.value)} placeholder="Ente esterno" />
                  {errors.produttore && <p className="text-xs text-destructive">{errors.produttore}</p>}
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Trasportatore{form.stato === 'assegnato' ? ' *' : ''}</Label>
                <ComboSelect value={form.trasportatore} onChange={onTrasportatoreChange} options={trasportatori} placeholder="Seleziona..." />
                {errors.trasportatore && <p className="text-xs text-destructive">{errors.trasportatore}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Destinatario{secondaria && terminato ? ' *' : ''}</Label>
                <ComboSelect value={form.destinazione} onChange={onDestinatarioChange} options={destinatari} placeholder="Seleziona..." />
                {errors.destinazione && <p className="text-xs text-destructive">{errors.destinazione}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tipo destinazione</Label>
                <Select value={form.tipo_destinazione} onValueChange={onTipoDestChange}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="imp">Impianto (trattamento)</SelectItem>
                    <SelectItem value="stoc">Stoccaggio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Provincia</Label>
                <Select value={form.provincia || undefined} onValueChange={v => set('provincia', v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                  <SelectContent>
                    {province.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Automezzo</Label>
                <Input className="h-9 text-sm" value={form.automezzo} onChange={e => set('automezzo', e.target.value)} />
                <p className="text-xs text-muted-foreground">Serve al conteggio viaggi se tariffa a viaggio</p>
              </div>
            </div>
          </fieldset>

          {/* GRUPPO Merce */}
          <fieldset className="border rounded-lg p-3">
            <legend className="text-sm font-semibold px-1">Merce</legend>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">CER</Label>
                <Input className="h-9 text-sm" value={form.cer} onChange={e => set('cer', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Classe *</Label>
                <Select value={form.classe || undefined} onValueChange={onClasseChange}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                  <SelectContent>
                    {CLASSI.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.classe && <p className="text-xs text-destructive">{errors.classe}</p>}
                <p className="text-xs text-muted-foreground">Solo RETE: PFU Autodemolizione non ammessa</p>
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs text-muted-foreground">Peso effettivo in kg{terminato ? ' *' : ''}</Label>
                <Input type="number" className="h-9 text-sm" value={form.peso_effettivo} onChange={e => set('peso_effettivo', e.target.value)} />
                {errors.peso_effettivo && <p className="text-xs text-destructive">{errors.peso_effettivo}</p>}
              </div>
            </div>
          </fieldset>

          {/* GRUPPO Prezzi e costi */}
          <fieldset className="border rounded-lg p-3">
            <legend className="text-sm font-semibold px-1">Prezzi e costi</legend>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
              <NumField label="Prezzo attivo (€/t)" k="prezzo_attivo_t" />
              <NumField label="Sovracosto raccolta (€)" k="sovracosto_raccolta" />
              <NumField label="Sovracosto trasporto (€)" k="sovracosto_trasporto" />
              <NumField label="Sovracosto trattamento (€)" k="sovracosto_trattamento" />
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Costo raccolta (€/t)</Label>
                <Input type="number" className="h-9 text-sm" value={form.costo_raccolta_t} onChange={e => { set('costo_raccolta_t', e.target.value); setDaContrattoR(false); }} />
                {daContrattoR && <p className="text-xs text-success">da contratto</p>}
                {raccoltaInterna && <p className="text-xs text-muted-foreground">trasportatore interno: non fatturato</p>}
              </div>
              <NumField label="Costo stoccaggio (€/t)" k="costo_stoccaggio_t" />
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Costo trattamento (€/t)</Label>
                <Input type="number" className="h-9 text-sm" value={form.costo_trattamento_t} onChange={e => { set('costo_trattamento_t', e.target.value); setDaContrattoD(false); }} />
                {daContrattoD && <p className="text-xs text-success">da contratto</p>}
              </div>
              <NumField label="Costo pulizia (€)" k="costo_pulizia" />
              <NumField label="Costi aggiuntivi (€)" k="costi_aggiuntivi" />
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs text-muted-foreground">Note costi {(Number(form.costo_pulizia) > 0 || Number(form.costi_aggiuntivi) > 0) ? '*' : ''}</Label>
                <Input className="h-9 text-sm" value={form.note_costi} onChange={e => set('note_costi', e.target.value)} />
                {errors.note_costi && <p className="text-xs text-destructive">{errors.note_costi}</p>}
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs text-muted-foreground">Note</Label>
                <Input className="h-9 text-sm" value={form.note} onChange={e => set('note', e.target.value)} />
              </div>
            </div>
          </fieldset>

          {/* Riepilogo in tempo reale */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 border-2 rounded-lg bg-muted/30">
            <div>
              <div className="text-xs text-muted-foreground">Ricavo</div>
              <div className="text-base font-bold tabular-nums">€ {formatNumber(calc.ricavo, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Costo totale</div>
              <div className="text-base font-bold tabular-nums">€ {formatNumber(calc.costo_totale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Margine</div>
              <div className={`text-base font-bold tabular-nums ${calc.margine >= 0 ? 'text-success' : 'text-destructive'}`}>
                € {formatNumber(calc.margine, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Margine %</div>
              <div className={`text-base font-bold tabular-nums ${calc.margine >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatNumber(calc.margine_perc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Annulla</Button>
          <Button onClick={save}><Save className="w-4 h-4 mr-1.5" /> Salva</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}