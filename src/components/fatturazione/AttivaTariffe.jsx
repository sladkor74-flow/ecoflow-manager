import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2 } from 'lucide-react';

const TIPologie = ['RETE', 'ACI', 'EXTRA_RACCOLTA'];
const UNITA = ['€/kg', '€/ton', '€/t', '€/viaggio', '€/vg', '€/mese'];

export default function AttivaTariffe() {
  const [tariffe, setTariffe] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ tipologia: 'RETE', cliente: '', classe_materiale: '', regione: '', unita_misura: '€/kg', valore: 0, data_inizio_validita: '', data_fine_validita: '' });

  const load = async () => {
    setLoading(true);
    try { setTariffe(await base44.entities.Tariffa.filter({ direzione: 'ATTIVA' }, '-created_date', 500)); } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.tipologia || !form.valore) return;
    await base44.entities.Tariffa.create({
      ...form, valore: Number(form.valore), direzione: 'ATTIVA', stato: 'attivo',
      fornitore_id: form.cliente || 'ATTIVA',
    });
    setForm({ tipologia: 'RETE', cliente: '', classe_materiale: '', regione: '', unita_misura: '€/kg', valore: 0, data_inizio_validita: '', data_fine_validita: '' });
    setShowForm(false); load();
  };

  const remove = async (t) => {
    if (!confirm('Eliminare questa tariffa?')) return;
    await base44.entities.Tariffa.delete(t.id); load();
  };

  if (loading) return <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin inline" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="font-heading font-semibold">Tariffe Fatturazione Attiva ({tariffe.length})</h2>
        <Button size="sm" onClick={() => setShowForm(!showForm)}><Plus className="w-4 h-4 mr-1" /> Aggiungi</Button>
      </div>
      <p className="text-sm text-muted-foreground">Le tariffe sono associate a tipologia + cliente + classe + regione. Il sistema applica automaticamente la tariffa valida per il periodo.</p>
      {showForm && (
        <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Select value={form.tipologia} onValueChange={v => setForm({ ...form, tipologia: v })}>
              <SelectTrigger><SelectValue placeholder="Tipologia" /></SelectTrigger>
              <SelectContent>{TIPologie.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Cliente (es. ECOTYRE, ACI)" value={form.cliente} onChange={e => setForm({ ...form, cliente: e.target.value })} />
            <Input placeholder="Classe (P/M/G1/G2)" value={form.classe_materiale} onChange={e => setForm({ ...form, classe_materiale: e.target.value })} />
            <Input placeholder="Regione (opz.)" value={form.regione} onChange={e => setForm({ ...form, regione: e.target.value })} />
            <Select value={form.unita_misura} onValueChange={v => setForm({ ...form, unita_misura: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{UNITA.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="number" step="0.0001" placeholder="Valore" value={form.valore} onChange={e => setForm({ ...form, valore: e.target.value })} />
            <Input type="date" placeholder="Validità da" value={form.data_inizio_validita} onChange={e => setForm({ ...form, data_inizio_validita: e.target.value })} />
            <Input type="date" placeholder="Validità a" value={form.data_fine_validita} onChange={e => setForm({ ...form, data_fine_validita: e.target.value })} />
          </div>
          <Button size="sm" onClick={add}>Salva</Button>
        </div>
      )}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted"><tr>
            <th className="text-left px-3 py-2 font-semibold">Tipologia</th>
            <th className="text-left px-3 py-2 font-semibold">Cliente</th>
            <th className="text-left px-3 py-2 font-semibold">Classe</th>
            <th className="text-left px-3 py-2 font-semibold">Regione</th>
            <th className="text-left px-3 py-2 font-semibold">Unità</th>
            <th className="text-right px-3 py-2 font-semibold">Valore</th>
            <th className="text-left px-3 py-2 font-semibold">Validità</th>
            <th className="text-right px-3 py-2"></th>
          </tr></thead>
          <tbody>
            {tariffe.map((t, i) => (
              <tr key={t.id} className={i % 2 ? 'bg-muted/30' : ''}>
                <td className="px-3 py-2 font-medium">{t.tipologia || '-'}</td>
                <td className="px-3 py-2">{t.cliente || '-'}</td>
                <td className="px-3 py-2">{t.classe_materiale || '-'}</td>
                <td className="px-3 py-2">{t.regione || '-'}</td>
                <td className="px-3 py-2">{t.unita_misura}</td>
                <td className="px-3 py-2 text-right font-medium">€ {t.valore}</td>
                <td className="px-3 py-2 text-xs">{t.data_inizio_validita || ''} → {t.data_fine_validita || ''}</td>
                <td className="text-right px-3 py-2"><button onClick={() => remove(t)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}