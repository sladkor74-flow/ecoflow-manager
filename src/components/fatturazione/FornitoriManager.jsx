import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2, Power } from 'lucide-react';

export default function FornitoriManager() {
  const [fornitori, setFornitori] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ragione_sociale: '', tipo: 'trasportatore', piva: '', regione: '' });

  const load = async () => {
    setLoading(true);
    try { setFornitori(await base44.entities.Fornitore.list('-created_date', 500)); } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.ragione_sociale) return;
    await base44.entities.Fornitore.create({ ...form, stato: 'attivo' });
    setForm({ ragione_sociale: '', tipo: 'trasportatore', piva: '', regione: '' });
    setShowForm(false); load();
  };

  const toggle = async (f) => {
    await base44.entities.Fornitore.update(f.id, { stato: f.stato === 'attivo' ? 'non_attivo' : 'attivo' });
    load();
  };

  const remove = async (f) => {
    if (!confirm(`Eliminare ${f.ragione_sociale}?`)) return;
    await base44.entities.Fornitore.delete(f.id); load();
  };

  if (loading) return <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin inline" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="font-heading font-semibold">Anagrafica Fornitori ({fornitori.length})</h2>
        <Button size="sm" onClick={() => setShowForm(!showForm)}><Plus className="w-4 h-4 mr-1" /> Aggiungi</Button>
      </div>
      {showForm && (
        <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Input placeholder="Ragione sociale" value={form.ragione_sociale} onChange={e => setForm({ ...form, ragione_sociale: e.target.value })} />
            <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="trasportatore">Trasportatore</SelectItem>
                <SelectItem value="impianto">Impianto</SelectItem>
                <SelectItem value="stoccaggio">Stoccaggio</SelectItem>
                <SelectItem value="altro">Altro</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="P.IVA" value={form.piva} onChange={e => setForm({ ...form, piva: e.target.value })} />
            <Input placeholder="Regione" value={form.regione} onChange={e => setForm({ ...form, regione: e.target.value })} />
          </div>
          <Button size="sm" onClick={add}>Salva</Button>
        </div>
      )}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted"><tr>
            <th className="text-left px-3 py-2 font-semibold">Ragione Sociale</th>
            <th className="text-left px-3 py-2 font-semibold">Tipo</th>
            <th className="text-left px-3 py-2 font-semibold">P.IVA</th>
            <th className="text-left px-3 py-2 font-semibold">Regione</th>
            <th className="text-center px-3 py-2 font-semibold">Stato</th>
            <th className="text-right px-3 py-2 font-semibold">Azioni</th>
          </tr></thead>
          <tbody>
            {fornitori.map((f, i) => (
              <tr key={f.id} className={i % 2 ? 'bg-muted/30' : ''}>
                <td className="px-3 py-2 font-medium">{f.ragione_sociale}</td>
                <td className="px-3 py-2">{f.tipo}</td>
                <td className="px-3 py-2">{f.piva || '-'}</td>
                <td className="px-3 py-2">{f.regione || '-'}</td>
                <td className="text-center px-3 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${f.stato === 'attivo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{f.stato}</span>
                </td>
                <td className="text-right px-3 py-2">
                  <button onClick={() => toggle(f)} className="p-1 hover:bg-muted rounded"><Power className="w-4 h-4" /></button>
                  <button onClick={() => remove(f)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}