import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'react-router-dom';
import { Plus, Trash2, X, Pencil, ExternalLink } from 'lucide-react';
import { formatTonnellate } from '@/lib/utils';
import { annoChiuso } from '@/lib/annoTarget';
import { anniTarget } from '@/lib/target';

const TIPOLOGIE = ['EoW', 'Frantumazione/R1', 'n.a.'];

function fmt(n) {
  if (n == null || n === '' || isNaN(n)) return '—';
  return formatTonnellate(Number(n));
}

// I target non si scrivono piu' qui (27/09/2026): il target totale dell'impianto
// si scrive in Target & Status -> Impianti e stoccaggi, e quello delle primarie e'
// la somma dei target dei raccoglitori di quel sito. Qui si vedono soltanto,
// come li calcola calcolaGiacenze (righe), e si tiene l'elenco dei siti.
const chiaveRiga = (sito, td) => `${String(sito || '').trim().toLowerCase()}|${td}`;

export default function TargetManager({ open, onClose, anno, destinazioni, righe = [], onSaved }) {
  const targetDi = new Map(righe.map(r => [chiaveRiga(r.sito, r.tipo_destinazione), r]));
  const tgt = (s) => targetDi.get(chiaveRiga(s.sito, s.tipo_destinazione)) || null;
  // L'elenco dei siti e' un dato dell'anno, come in Target & Status: un anno
  // chiuso si legge soltanto (28/09/2026).
  const solaLettura = annoChiuso(anno);
  const inTargetStatus = anniTarget().includes(Number(anno));
  const indirizzoImpianti = `/target-status?tab=impianti&anno=${anno}`;
  const indirizzoRaccoglitori = `/target-status?tab=raccoglitori&anno=${anno}`;
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
    setForm({ sito: '', tipo_destinazione: 'imp', giacenza_riferimento_t: 0, tipologia_trattamento: 'EoW', note: '' });
  };
  const startEdit = (s) => { setEditing(s.id); setForm({ ...s }); };

  const save = async () => {
    if (solaLettura) return;
    try {
      const payload = {
        sito: form.sito,
        tipo_destinazione: form.tipo_destinazione,
        anno,
        // target_totale_t e target_primarie_t non si toccano: i vecchi valori
        // restano dove sono e servono solo finche' il target non e' portato
        // in Target & Status.
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
    if (solaLettura) return;
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
          <DialogTitle>Siti e target delle giacenze - {anno}</DialogTitle>
        </DialogHeader>
        {editing && !solaLettura ? (
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
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Target primarie (t)</label>
                <div className="h-9 px-3 flex items-center rounded-md border bg-muted/50 tabular-nums">{fmt(editing !== 'new' ? tgt(form)?.target_primarie_t : null)}</div>
                <Link to={indirizzoRaccoglitori} className="text-[11px] text-primary hover:underline">Si scrive in Target & Status (target dei raccoglitori)</Link>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Target totale (t)</label>
                <div className="h-9 px-3 flex items-center rounded-md border bg-muted/50 tabular-nums">{fmt(editing !== 'new' ? tgt(form)?.target_totale_t : null)}</div>
                <Link to={indirizzoImpianti} className="text-[11px] text-primary hover:underline">Si scrive in Target & Status</Link>
              </div>
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground max-w-xl">
                I target si scrivono in Target & Status: il target totale sull'impianto, quello delle primarie
                è la somma dei target dei raccoglitori legati al sito. Qui si vedono soltanto.{' '}
                {inTargetStatus ? (
                  <Link to={indirizzoImpianti} className="text-primary hover:underline inline-flex items-center gap-0.5">
                    Apri Target & Status <ExternalLink className="w-3 h-3" />
                  </Link>
                ) : (
                  <>Il {anno} in Target & Status non c'è: qui valgono i target scritti allora.</>
                )}
                {solaLettura && <> Il {anno} è chiuso: l'elenco dei siti si consulta soltanto.</>}
              </p>
              {!solaLettura && <Button size="sm" onClick={startNew}><Plus className="w-4 h-4 mr-1" /> Aggiungi sito</Button>}
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
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmt(tgt(s)?.target_primarie_t)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmt(tgt(s)?.target_totale_t)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmt(s.giacenza_riferimento_t)}</td>
                      <td className="px-2 py-1.5">{s.tipologia_trattamento || '—'}</td>
                      <td className="px-2 py-1.5 max-w-[160px] truncate">{s.note || '—'}</td>
                      <td className="px-2 py-1.5">
                        {!solaLettura && (
                          <div className="flex gap-1">
                            <button onClick={() => startEdit(s)} className="text-primary hover:opacity-70" aria-label={`Modifica ${s.sito}`}><Pencil className="w-3 h-3" /></button>
                            <button onClick={() => remove(s.id)} className="text-destructive hover:opacity-70" aria-label={`Elimina ${s.sito}`}><Trash2 className="w-3 h-3" /></button>
                          </div>
                        )}
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