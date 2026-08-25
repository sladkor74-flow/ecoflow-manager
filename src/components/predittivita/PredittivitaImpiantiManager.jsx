import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Trash2, Edit3 } from 'lucide-react';

function InlineEditTarget({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(value || 0));
  const [saving, setSaving] = useState(false);

  useEffect(() => { setVal(String(value || 0)); }, [value]);

  const commit = async () => {
    setEditing(false);
    const num = Number(String(val).replace(/\./g, '').replace(',', '.'));
    if (Number.isNaN(num) || num === value) return;
    setSaving(true);
    try { await onSave(num); } catch (e) { setVal(String(value || 0)); }
    setSaving(false);
  };

  if (saving) return <Loader2 className="w-3 h-3 animate-spin inline" />;
  if (editing) {
    return (
      <input
        autoFocus
        type="text"
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditing(false); setVal(String(value || 0)); } }}
        className="w-28 text-sm border border-primary rounded px-1 py-0.5 focus:outline-none"
      />
    );
  }
  return (
    <span className="font-medium text-foreground cursor-text hover:bg-primary/10 rounded px-1 inline-flex items-center" onClick={() => setEditing(true)}>
      {(value || 0).toLocaleString('it-IT')}
      <Edit3 className="w-3 h-3 ml-1 opacity-40" />
    </span>
  );
}

export default function PredittivitaImpiantiManager({ onReload }) {
  const [impianti, setImpianti] = useState([]);
  const [fornitori, setFornitori] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showImpiantoForm, setShowImpiantoForm] = useState(false);
  const [fornitoreFormFor, setFornitoreFormFor] = useState(null);
  const [impiantoForm, setImpiantoForm] = useState({ nome_impianto: '', target: 0, data_fine: '2026-12-18' });
  const [fornitoreForm, setFornitoreForm] = useState({ nome: '', quota_target: 0 });

  const load = async () => {
    setLoading(true);
    try {
      const [imps, forns] = await Promise.all([
        base44.entities.ImpiantoTargetSecondaria.list('-created_date', 50),
        base44.entities.FornitoreSecondaria.list('-created_date', 200),
      ]);
      setImpianti(imps); setFornitori(forns);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addImpianto = async () => {
    if (!impiantoForm.nome_impianto) return;
    await base44.entities.ImpiantoTargetSecondaria.create({ ...impiantoForm, target: Number(impiantoForm.target), stato: 'attivo' });
    setImpiantoForm({ nome_impianto: '', target: 0, data_fine: '2026-12-18' });
    setShowImpiantoForm(false); load(); onReload();
  };

  const addFornitore = async (impiantoId) => {
    if (!fornitoreForm.nome) return;
    const imp = impianti.find(i => i.id === impiantoId);
    await base44.entities.FornitoreSecondaria.create({
      nome: fornitoreForm.nome, impianto_id: impiantoId, impianto_nome: imp?.nome_impianto,
      quota_target: Number(fornitoreForm.quota_target), stato: 'attivo',
    });
    setFornitoreForm({ nome: '', quota_target: 0 }); setFornitoreFormFor(null); load(); onReload();
  };

  const updateImpianto = async (imp, patch) => {
    await base44.entities.ImpiantoTargetSecondaria.update(imp.id, patch);
    load(); onReload();
  };

  const removeImpianto = async (imp) => {
    if (!confirm(`Eliminare ${imp.nome_impianto}?`)) return;
    await base44.entities.ImpiantoTargetSecondaria.delete(imp.id); load(); onReload();
  };

  const removeFornitore = async (f) => {
    if (!confirm(`Eliminare ${f.nome}?`)) return;
    await base44.entities.FornitoreSecondaria.delete(f.id); load(); onReload();
  };

  if (loading) return <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin inline" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-heading font-semibold">Impianti Target ({impianti.length})</h2>
        <Button size="sm" onClick={() => setShowImpiantoForm(!showImpiantoForm)}><Plus className="w-4 h-4 mr-1" /> Aggiungi Impianto</Button>
      </div>

      {showImpiantoForm && (
        <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
          <div className="grid grid-cols-3 gap-2">
            <Input placeholder="Nome impianto" value={impiantoForm.nome_impianto} onChange={e => setImpiantoForm({ ...impiantoForm, nome_impianto: e.target.value })} />
            <Input type="number" placeholder="Target (kg)" value={impiantoForm.target} onChange={e => setImpiantoForm({ ...impiantoForm, target: e.target.value })} />
            <Input type="date" value={impiantoForm.data_fine} onChange={e => setImpiantoForm({ ...impiantoForm, data_fine: e.target.value })} />
          </div>
          <Button size="sm" onClick={addImpianto}>Salva</Button>
        </div>
      )}

      {impianti.map(imp => (
        <div key={imp.id} className="border rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-heading font-semibold">{imp.nome_impianto}</h3>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                Target:
                <InlineEditTarget value={imp.target || 0} onSave={(v) => updateImpianto(imp, { target: v })} />
                <span>kg · Scadenza: {imp.data_fine || '18/12'}</span>
              </p>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => setFornitoreFormFor(fornitoreFormFor === imp.id ? null : imp.id)}><Plus className="w-4 h-4 mr-1" /> Fornitore</Button>
              <button onClick={() => removeImpianto(imp)} className="p-2 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
            </div>
          </div>
          {fornitoreFormFor === imp.id && (
            <div className="border rounded p-2 bg-muted/30 flex gap-2">
              <Input placeholder="Nome fornitore" value={fornitoreForm.nome} onChange={e => setFornitoreForm({ ...fornitoreForm, nome: e.target.value })} className="flex-1" />
              <Input type="number" placeholder="Quota target (kg)" value={fornitoreForm.quota_target} onChange={e => setFornitoreForm({ ...fornitoreForm, quota_target: e.target.value })} className="w-48" />
              <Button size="sm" onClick={() => addFornitore(imp.id)}>Salva</Button>
            </div>
          )}
          <div className="space-y-1">
            {fornitori.filter(f => f.impianto_id === imp.id).map(f => (
              <div key={f.id} className="flex items-center justify-between text-sm border rounded px-2 py-1">
                <span className="font-medium">{f.nome}</span>
                <span className="text-muted-foreground text-xs">Quota: {(f.quota_target || 0).toLocaleString()} kg</span>
                <button onClick={() => removeFornitore(f)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-3 h-3 text-red-500" /></button>
              </div>
            ))}
            {fornitori.filter(f => f.impianto_id === imp.id).length === 0 && <p className="text-xs text-muted-foreground">Nessun fornitore configurato.</p>}
          </div>
        </div>
      ))}
    </div>
  );
}