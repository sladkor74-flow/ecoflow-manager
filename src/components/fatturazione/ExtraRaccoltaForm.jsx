import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ChevronDown, ChevronUp, Save, X } from 'lucide-react';
import { MESI } from '@/lib/pfuConstants';

const REGIONI = ['Puglia', 'Campania', 'Basilicata', 'Sicilia', 'Calabria', 'Lazio', 'Toscana', 'Abruzzo', 'Molise', 'Altro'];
const CLASSI = ['P', 'M', 'G1', 'G2', ''];
const STATI = ['aperto', 'in corso', 'completato', 'annullato', ''];

const EMPTY = {
  id_ordine: '', stato: '', ordine_immesso_il: '', numero_ordine_interno: '', numero_fir: '',
  id_cliente: '', ragione_sociale: '', id_pdr: '', punto_di_raccolta: '', indirizzo: '', cap: '', comune: '', provincia: '', regione: '', codice_regione: '', macroarea: '',
  codice_prodotto: '', prodotto: '', classe: '', cer: '', tipo_contenitori: '', quantita_richiesta: '', quantita_ritirata: '', peso_stimato: '', peso_effettivo: '',
  key_account: '', partner_operativo: '', id_trasportatore: '', trasportatore: '', id_destinazione: '', tipo_destinazione: '', destinazione: '', automezzo: '', rimorchio: '', distanza: '',
  trasporto_iniziato_il: '', trasporto_finito_il: '', ordine_chiuso_il: '',
  mese: '', settimane: '', anno: '', sigla: '', regioni: '',
};

function toInputDate(v) {
  if (!v) return '';
  try { return new Date(v).toISOString().split('T')[0]; } catch { return ''; }
}

export default function ExtraRaccoltaForm({ periodo, initial, onSave, onCancel }) {
  const [form, setForm] = useState(() => ({
    ...EMPTY,
    mese: periodo?.mese || '',
    anno: periodo?.anno || new Date().getFullYear(),
    ...(initial || {}),
  }));
  const [openSections, setOpenSections] = useState({
    identificazione: true, cliente: false, prodotto: false, logistica: false, date: false,
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggle = (s) => setOpenSections(o => ({ ...o, [s]: !o[s] }));

  const save = () => {
    const payload = { ...form };
    // numerici
    ['id_cliente','id_pdr','id_trasportatore','id_destinazione','codice_regione','quantita_richiesta','quantita_ritirata','peso_stimato','peso_effettivo','distanza','settimane','anno'].forEach(k => {
      payload[k] = payload[k] === '' ? null : Number(payload[k]);
    });
    // date
    ['ordine_immesso_il','trasporto_iniziato_il','trasporto_finito_il','ordine_chiuso_il'].forEach(k => {
      payload[k] = payload[k] ? new Date(payload[k]).toISOString() : null;
    });
    onSave(payload);
  };

  const Section = ({ id, title, children }) => (
    <div className="border rounded-lg overflow-hidden">
      <button type="button" onClick={() => toggle(id)} className="w-full flex items-center justify-between px-3 py-2 bg-muted/50 hover:bg-muted text-sm font-medium">
        {title}
        {openSections[id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {openSections[id] && <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-3">{children}</div>}
    </div>
  );

  const Field = ({ label, k, type = 'text', opts = [] }) => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {opts.length > 0 ? (
        <Select value={form[k] || ''} onValueChange={v => set(k, v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={label} /></SelectTrigger>
          <SelectContent>{opts.map(o => <SelectItem key={o || 'ND'} value={o || ''}>{o || '—'}</SelectItem>)}</SelectContent>
        </Select>
      ) : (
        <Input type={type} className="h-8 text-xs" placeholder={label} value={form[k] || ''} onChange={e => set(k, e.target.value)} />
      )}
    </div>
  );

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-card">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{initial ? 'Modifica record' : 'Nuovo record Extra Raccolta'}</h3>
        {onCancel && <button onClick={onCancel} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>}
      </div>

      <Section id="identificazione" title="Identificazione ordine">
        <Field label="ID Ordine *" k="id_ordine" />
        <Field label="Stato" k="stato" opts={STATI} />
        <Field label="N. ordine interno" k="numero_ordine_interno" />
        <Field label="N. FIR" k="numero_fir" />
        <Field label="Mese" k="mese" opts={MESI} />
        <Field label="Anno" k="anno" type="number" />
        <Field label="Settimane" k="settimane" type="number" />
      </Section>

      <Section id="cliente" title="Cliente e punto di raccolta">
        <Field label="ID Cliente" k="id_cliente" type="number" />
        <Field label="Ragione sociale" k="ragione_sociale" />
        <Field label="ID PDR" k="id_pdr" type="number" />
        <Field label="Punto di raccolta" k="punto_di_raccolta" />
        <Field label="Indirizzo" k="indirizzo" />
        <Field label="CAP" k="cap" />
        <Field label="Comune" k="comune" />
        <Field label="Provincia (sigla)" k="provincia" />
        <Field label="Regione" k="regione" opts={REGIONI} />
        <Field label="Cod. regione" k="codice_regione" type="number" />
        <Field label="Macroarea" k="macroarea" />
        <Field label="Regioni (testo)" k="regioni" />
      </Section>

      <Section id="prodotto" title="Prodotto e quantità">
        <Field label="Cod. prodotto" k="codice_prodotto" />
        <Field label="Prodotto" k="prodotto" />
        <Field label="Classe" k="classe" opts={CLASSI} />
        <Field label="CER" k="cer" />
        <Field label="Tipo contenitori" k="tipo_contenitori" />
        <Field label="Q.tà richiesta" k="quantita_richiesta" type="number" />
        <Field label="Q.tà ritirata" k="quantita_ritirata" type="number" />
        <Field label="Peso stimato (kg)" k="peso_stimato" type="number" />
        <Field label="Peso effettivo (kg) *" k="peso_effettivo" type="number" />
      </Section>

      <Section id="logistica" title="Logistica e trasporto">
        <Field label="Key account" k="key_account" />
        <Field label="Partner operativo" k="partner_operativo" />
        <Field label="ID Trasportatore" k="id_trasportatore" type="number" />
        <Field label="Trasportatore" k="trasportatore" />
        <Field label="ID Destinazione" k="id_destinazione" type="number" />
        <Field label="Tipo destinazione" k="tipo_destinazione" />
        <Field label="Destinazione" k="destinazione" />
        <Field label="Automezzo" k="automezzo" />
        <Field label="Rimorchio" k="rimorchio" />
        <Field label="Distanza (km)" k="distanza" type="number" />
      </Section>

      <Section id="date" title="Date trasporto">
        <Field label="Ordine immesso il" k="ordine_immesso_il" type="date" />
        <Field label="Trasporto iniziato il" k="trasporto_iniziato_il" type="date" />
        <Field label="Trasporto finito il" k="trasporto_finito_il" type="date" />
        <Field label="Ordine chiuso il" k="ordine_chiuso_il" type="date" />
      </Section>

      <div className="flex justify-end gap-2 pt-1">
        <Button size="sm" onClick={save} disabled={!form.id_ordine || !form.peso_effettivo}>
          <Save className="w-4 h-4 mr-1.5" /> Salva record
        </Button>
      </div>
    </div>
  );
}