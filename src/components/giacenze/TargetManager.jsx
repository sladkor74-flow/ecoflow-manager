import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, X, Pencil } from 'lucide-react';

const TIPOLOGIE = ['EoW', 'Frantumazione/R1', 'n.a.'];

function fmt(n) {
  if (n == null || n === '' || isNaN(n)) return '—';
  return Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function TargetManager({ open, onClose, anno, destinazioni, onSaved }) {
  const [siti, setSiti] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      setSiti(await base44.entities.GiacenzaSito.filter({ anno }));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { if (open) load(); }, [open]);

  const startNew = () => {
    setEditing('new');
    setForm({ sito: '', tipo_destinazione: 'imp', target_primarie_t: 0, target_totale_t: 0, giacenza_riferimento_t: 0, tipologia_trattamento: 'EoW', note: '' });
  };
  const startEdit = (s) => { setEditing(s.id); setForm({ ...s }); };

  const save = async () => {
    try {
      const payload = {
        sito: form.sito,
        tipo_destinazione: form.tipo_destinazione,
        anno,
        target_primarie_t: Number(form.target_primarie_t) || 0,
        target_totale_t: Number(form.target_totale_t) || 0,
        giacenza_riferimento_t: Number(form.giacenza_riferimento_t) || 0,
        tipologia_trattamento: form.tipologia_trattamento || 'n.a.',
        note: form.note || '',
      };
      if (editing === 'new') {
        await base44.entities.GiacenzaSito.create(payload);
      } else {
        await base44.entities.GiacenzaSito.update(editing, payload);
      }
      setEditing(null);
      await load();
      onSaved?.();
    } catch (e) { alert(e?.response?.data?.error || e?.message); }
  };

  const remove = async (id) => {
    if (!confirm('Eliminare questo sito?')) return;
    try {
      await base44.entities.GiacenzaSito.delete(id);
      await load();
      onSaved?.();
    } catch (e) { alert(e?.message); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configura target - {anno}</DialogTitle>
        </DialogHeader>
        {editing ? (
          <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Sito</label>
                <Input list="destinazioni-list" value={form.sito || ''} onChange={e => setForm({ ...form, sito: e.target.value })} placeholder="Seleziona o inserisci" />
                <datalist id="destinazioni-list">{destinazioni.map(d => <option key={d} value={d} />)}</datalist>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Ruolo</label>
                <Select value={form.tipo_destinazione} onValueChange={v => setForm({ ...form, tipo_destinazione: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="imp">Impianto</SelectItem><SelectItem value="stoc">Stoccaggio</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><label className="text-xs text-muted-foreground block mb-1">Target primarie (t)</label><Input type="number" step="0.01" value={form.target_primarie_t || 0} onChange={e => setForm({ ...form, target_primarie_t: Number(e.target.value) })} /></div>
              <div><label className="text-xs text-muted-foreground block mb-1">Target totale (t)</label><Input type="number" step="0.01" value={form.target_totale_t || 0} onChange={e => setForm({ ...form, target_totale_t: Number(e.target.value) })} /></div>
              <div><label className="text-xs text-muted-foreground block mb-1">Giacenza di riferimento (t)</label><Input type="number" step="0.01" value={form.giacenza_riferimento_t || 0} onChange={e => setForm({ ...form, giacenza_riferimento_t: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Tipologia trattamento</label>
                <Select value={form.tipologia_trattamento || 'n.a.'} onValueChange={v => setForm({ ...form, tipologia_trattamento: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOLOGIE.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><label className="text-xs text-muted-foreground block mb-1">Note</label><Input value={form.note || ''} onChange={e => setForm({ ...form, note: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}><X className="w-4 h-4 mr-1" /> Annulla</Button>
              <Button onClick={save} disabled={!form.sito}>Salva</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex justify-end">
              <Button size="sm" onClick={startNew}><Plus className="w-4 h-4 mr-1" /> Aggiungi sito</Button>
            </div>
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted"><tr>
                  <th className="text-left px-2 py-2 font-semibold">Sito</th>
                  <th className="text-center px-2 py-2 font-semibold">Ruolo</th>
                  <th className="text-right px-2 py-2 font-semibold">Target prim.</th>
                  <th className="text-right px-2 py-2 font-semibold">Target tot.</th>
                  <th className="text-right px-2 py-2 font-semibold">Giac. rif.</th>
                  <th className="text-left px-2 py-2 font-semibold">Tipo tratt.</th>
                  <th className="text-left px-2 py-2 font-semibold">Note</th>
                  <th></th>
                </tr></thead>
                <tbody>
                  {siti.map((s) => (
                    <tr key={s.id} className="border-b hover:bg-muted/20">
                      <td className="px-2 py-1.5 font-medium">{s.sito}</td>
                      <td className="px-2 py-1.5 text-center">{s.tipo_destinazione === 'imp' ? 'Impianto' : 'Stoccaggio'}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmt(s.target_primarie_t)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmt(s.target_totale_t)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmt(s.giacenza_riferimento_t)}</td>
                      <td className="px-2 py-1.5">{s.tipologia_trattamento || '—'}</td>
                      <td className="px-2 py-1.5 max-w-[160px] truncate">{s.note || '—'}</td>
                      <td className="px-2 py-1.5">
                        <div className="flex gap-1">
                          <button onClick={() => startEdit(s)} className="text-primary hover:opacity-70"><Pencil className="w-3 h-3" /></button>
                          <button onClick={() => remove(s.id)} className="text-destructive hover:opacity-70"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {siti.length === 0 && !loading && <tr><td colSpan={8} className="text-center py-4 text-muted-foreground">Nessun sito configurato.</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}