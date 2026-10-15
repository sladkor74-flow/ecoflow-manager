import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { normalizzaRagioneSociale } from '@/lib/normalizzaRagioneSocialeClient';
import { oggiRoma } from '@/lib/giornoItaliano';

// IL GIORNO PROPOSTO E' QUELLO ITALIANO (15/10/2026, prova generale del cambio
// d'anno, difetto 29). Si proponeva il giorno UTC: l'01/01/2027 alle 00:30 il
// modulo diceva 31/12/2026, e la lettura del portale di quel momento, salvata
// col giorno proposto, diventava l'ultima rilevazione del 31/12 al posto della
// fotografia della chiusura (25,88 t invece di 35,88 su Nappi Sud).
function today() {
  return oggiRoma();
}

// La fotografia del 31/12 salvata dalla chiusura dell'anno: ha l'istante del
// salvataggio, o la nota che la chiusura scrive.
const eFotografiaDellaChiusura = (r) => !!r && (!!r.chiusura_salvata_il || /^Chiusura \d{4}, fotografia del/.test(String(r.note || '')));

export default function RilevazioneForm({ open, onClose, precompilato, sitiSuggeriti, unitaPerSito, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  // C'e' gia' la fotografia della chiusura per questo piazzale e questo 31/12?
  const [fotoChiusura, setFotoChiusura] = useState(null);

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

  // UNA LETTURA DEL 31/12 SOSTITUIREBBE LA FOTOGRAFIA DELLA CHIUSURA (15/10/2026,
  // difetto 29): a parita' di giorno vale l'ultima registrata, e la fotografia
  // salvata dalla chiusura - con la rettifica di dicembre dentro - non sarebbe
  // piu' il punto da cui riparte l'anno dopo. Si avvisa prima di salvare, e solo
  // quando il giorno scelto e' un 31 dicembre: una lettura sola, a richiesta.
  useEffect(() => {
    const giorno = String(form.data_rilevazione || '').slice(0, 10);
    const sito = normalizzaRagioneSociale(form.sito || '');
    if (!open || !sito || !/-12-31$/.test(giorno)) { setFotoChiusura(null); return undefined; }
    let attivo = true;
    base44.entities.GiacenzaStoccaggio.filter({ data_rilevazione: giorno })
      .then((righe) => {
        if (!attivo) return;
        const foto = (righe || []).find(r => normalizzaRagioneSociale(r.sito || '') === sito && eFotografiaDellaChiusura(r));
        setFotoChiusura(foto ? { giorno } : null);
      })
      .catch(() => { if (attivo) setFotoChiusura(null); });
    return () => { attivo = false; };
  }, [open, form.sito, form.data_rilevazione]);

  // L'UNITA' LOCALE SI RIPRENDE DA SOLA (06/10/2026).
  //
  // L'identificativo, la descrizione, il comune e la provincia sono del sito, non
  // della singola lettura, e l'utente li ha gia' scritti la prima volta. Scrivendo
  // una rilevazione dal pulsante in alto restavano vuoti e la riga compariva senza
  // nome, come se fosse un altro piazzale. Si riempiono appena si sceglie il sito,
  // e solo se sono vuoti: quello che si scrive a mano non si tocca.
  const scegliSito = (nome) => {
    const nota = unitaPerSito?.get?.(normalizzaRagioneSociale(nome || ''));
    setForm(f => ({
      ...f,
      sito: nome,
      id_unita_stoccaggio: f.id_unita_stoccaggio !== '' && f.id_unita_stoccaggio != null ? f.id_unita_stoccaggio : (nota?.id_unita_stoccaggio ?? ''),
      descrizione_unita: f.descrizione_unita || nota?.descrizione_unita || '',
      comune: f.comune || nota?.comune || '',
      provincia: f.provincia || nota?.provincia || '',
    }));
  };

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
      // Chi ha salvato vuole sapere subito se la lettura torna con i movimenti:
      // si dice quale rilevazione e' appena entrata, il controllo lo mostra chi
      // ci sta sopra. Il salvataggio non si blocca mai - la lettura del portale
      // e' un fatto - si avvisa (23/09/2026).
      onSaved?.({ sito: form.sito, data_rilevazione: String(form.data_rilevazione).slice(0, 10) });
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
            <Input list="siti-stoccaggio" value={form.sito || ''} onChange={e => scegliSito(e.target.value)} placeholder="Seleziona o inserisci" />
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
            {fotoChiusura && (
              <p className="mt-1 text-xs text-amber-800" data-avviso="fotografia-chiusura">
                Per questo piazzale c&apos;e&apos; gia&apos; la fotografia della chiusura del {fotoChiusura.giorno.split('-').reverse().join('/')}: una rilevazione dello stesso giorno la sostituirebbe come punto da cui riparte l&apos;anno dopo, senza la rettifica di dicembre. Se la lettura e&apos; di oggi, scrivi la data di oggi.
              </p>
            )}
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