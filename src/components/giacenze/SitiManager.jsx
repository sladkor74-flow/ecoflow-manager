import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, X } from 'lucide-react';
import { formatTonnellate } from '@/lib/utils';

const TIPOLOGIE = ['EoW', 'Frantumazione/R1', 'n.a.'];

function fmt(n) { return formatTonnellate(Number(n || 0)); }

export default function SitiManager({ open, onClose, anno, destinazioni }) {
  const [siti, setSiti] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});

  const load = async () => {
    setLoading(true);
    try { setSiti(await base44.entities.GiacenzaSito.filter({ anno })); } catch (e) {}
    setLoading(false);
  };
  useEffect(() => { if (open) load(); }, [open]);

  const startNew = () => { setEditing('new'); setForm({ sito: '', tipo_destinazione: 'imp', target_primarie_t: 0, target_totale_t: 0, giacenza_iniziale_t: 0, tipologia_trattamento: 'EoW', uscite_ferro_t: 0, css_override_t: 0, note: '' }); };
  const startEdit = (s) => { setEditing(s.id); setForm({ ...s }); };

  const save = async () => {
    try {
      if (editing === 'new') {
        await base44.entities.GiacenzaSito.create({ ...form, anno });
      } else {
        await base44.entities.GiacenzaSito.update(editing, form);
      }
      setEditing(null); await load();
    } catch (e) { alert(e?.response?.data?.error || e?.message); }
  };

  const remove = async (id) => {
    if (!confirm('Eliminare questo sito?')) return;
    await base44.entities.GiacenzaSito.delete(id); await load();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configura siti - {anno}</DialogTitle>
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
              <div><label className="text-xs text-muted-foreground block mb-1">Giacenza iniziale (t)</label><Input type="number" step="0.01" value={form.giacenza_iniziale_t || 0} onChange={e => setForm({ ...form, giacenza_iniziale_t: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Tipologia trattamento</label>
                <Select value={form.tipologia_trattamento || 'n.a.'} onValueChange={v => setForm({ ...form, tipologia_trattamento: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOLOGIE.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><label className="text-xs text-muted-foreground block mb-1">Uscite Ferro (t)</label><Input type="number" step="0.01" value={form.uscite_ferro_t || 0} onChange={e => setForm({ ...form, uscite_ferro_t: Number(e.target.value) })} /></div>
              <div><label className="text-xs text-muted-foreground block mb-1">Correzione CSS (t)</label><Input type="number" step="0.01" value={form.css_override_t || 0} onChange={e => setForm({ ...form, css_override_t: Number(e.target.value) })} /></div>
            </div>
            <div><label className="text-xs text-muted-foreground block mb-1">Note</label><Input value={form.note || ''} onChange={e => setForm({ ...form, note: e.target.value })} /></div>
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
                  <th className="text-left px-2 py-2 font-semibold">Sito</th><th className="text-center px-2 py-2 font-semibold">Ruolo</th>
                  <th className="text-right px-2 py-2 font-semibold">T.prim</th><th className="text-right px-2 py-2 font-semibold">T.tot</th>
                  <th className="text-right px-2 py-2 font-semibold">G.iniz</th><th className="text-left px-2 py-2 font-semibold">Tipo tratt.</th>
                  <th className="text-right px-2 py-2 font-semibold">Ferro</th><th className="text-right px-2 py-2 font-semibold">CSS corr.</th>
                  <th className="text-left px-2 py-2 font-semibold">Note</th><th></th>
                </tr></thead>
                <tbody>
                  {siti.map((s, i) => (
                    <tr key={s.id} className={`border-b ${i % 2 ? 'bg-muted/20' : ''}`}>
                      <td className="px-2 py-1.5 font-medium">{s.sito}</td>
                      <td className="px-2 py-1.5 text-center">{s.tipo_destinazione === 'imp' ? 'Imp' : 'Stoc'}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmt(s.target_primarie_t)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmt(s.target_totale_t)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmt(s.giacenza_iniziale_t)}</td>
                      <td className="px-2 py-1.5">{s.tipologia_trattamento || '—'}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmt(s.uscite_ferro_t)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmt(s.css_override_t)}</td>
                      <td className="px-2 py-1.5 max-w-[120px] truncate">{s.note || '—'}</td>
                      <td className="px-2 py-1.5">
                        <div className="flex gap-1">
                          <button onClick={() => startEdit(s)} className="text-xs text-primary hover:underline">modifica</button>
                          <button onClick={() => remove(s.id)} className="text-destructive hover:underline"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {siti.length === 0 && <tr><td colSpan={10} className="text-center py-4 text-muted-foreground">Nessun sito configurato.</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}