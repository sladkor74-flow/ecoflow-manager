import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function RilevazioneForm({ open, onClose, precompilato, sitiSuggeriti, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        sito: precompilato?.sito || '',
        id_unita_stoccaggio: precompilato?.id_unita_stoccaggio ?? '',
        descrizione_unita: precompilato?.descrizione_unita || '',
        comune: precompilato?.comune || '',
        provincia: precompilato?.provincia || '',
        data_rilevazione: today(),
        class1_kg: precompilato?.class1_kg ?? 0,
        class2_kg: precompilato?.class2_kg ?? 0,
        class3_kg: precompilato?.class3_kg ?? 0,
        class4_kg: precompilato?.class4_kg ?? 0,
        class9_kg: precompilato?.class9_kg ?? 0,
        note: '',
      });
    }
  }, [open, precompilato]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.sito || !form.data_rilevazione) {
      toast({ title: 'Sito e data rilevazione sono obbligatori', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await base44.entities.GiacenzaStoccaggio.create({
        sito: form.sito,
        id_unita_stoccaggio: form.id_unita_stoccaggio !== '' ? Number(form.id_unita_stoccaggio) : undefined,
        descrizione_unita: form.descrizione_unita || undefined,
        comune: form.comune || undefined,
        provincia: form.provincia || undefined,
        data_rilevazione: form.data_rilevazione,
        class1_kg: Number(form.class1_kg) || 0,
        class2_kg: Number(form.class2_kg) || 0,
        class3_kg: Number(form.class3_kg) || 0,
        class4_kg: Number(form.class4_kg) || 0,
        class9_kg: Number(form.class9_kg) || 0,
        note: form.note || undefined,
      });
      toast({ title: 'Rilevazione salvata' });
      onSaved?.();
      onClose();
    } catch (e) {
      toast({ title: 'Errore: ' + e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuova rilevazione giacenza stoccaggio</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto py-2">
          <div className="col-span-2">
            <Label>Sito</Label>
            <Input list="siti-stoccaggio" value={form.sito || ''} onChange={e => set('sito', e.target.value)} placeholder="Seleziona o inserisci" />
            <datalist id="siti-stoccaggio">
              {sitiSuggeriti.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>
          <div>
            <Label>Id unità di stoccaggio</Label>
            <Input type="number" value={form.id_unita_stoccaggio ?? ''} onChange={e => set('id_unita_stoccaggio', e.target.value)} />
          </div>
          <div>
            <Label>Descrizione unità</Label>
            <Input value={form.descrizione_unita || ''} onChange={e => set('descrizione_unita', e.target.value)} />
          </div>
          <div>
            <Label>Comune</Label>
            <Input value={form.comune || ''} onChange={e => set('comune', e.target.value)} />
          </div>
          <div>
            <Label>Provincia</Label>
            <Input value={form.provincia || ''} onChange={e => set('provincia', e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>Data rilevazione</Label>
            <Input type="date" value={form.data_rilevazione || ''} onChange={e => set('data_rilevazione', e.target.value)} />
          </div>
          <div><Label>P (kg)</Label><Input type="number" value={form.class1_kg ?? 0} onChange={e => set('class1_kg', e.target.value)} /></div>
          <div><Label>M (kg)</Label><Input type="number" value={form.class2_kg ?? 0} onChange={e => set('class2_kg', e.target.value)} /></div>
          <div><Label>G1 (kg)</Label><Input type="number" value={form.class3_kg ?? 0} onChange={e => set('class3_kg', e.target.value)} /></div>
          <div><Label>G2 (kg)</Label><Input type="number" value={form.class4_kg ?? 0} onChange={e => set('class4_kg', e.target.value)} /></div>
          <div><Label>ACI (kg)</Label><Input type="number" value={form.class9_kg ?? 0} onChange={e => set('class9_kg', e.target.value)} /></div>
          <div className="col-span-2">
            <Label>Note</Label>
            <Textarea value={form.note || ''} onChange={e => set('note', e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Annulla</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvataggio...' : 'Salva rilevazione'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}