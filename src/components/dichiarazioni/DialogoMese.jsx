import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, AlertTriangle, Info, Check } from 'lucide-react';
import { materialiDi, sommaMateriali, controlliDichiarazione, CANALI } from '@/lib/dichiarazioniImpianti';
import { formatKg } from '@/lib/utils';

// La dichiarazione di un mese: quanto ha dichiarato l'impianto, che cosa ne è
// uscito, se il documento è in mano e se è stato caricato a portale.

const kg = (v) => formatKg(v);
const numero = (v) => { const n = Number(String(v).replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const oggi = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());

export default function DialogoMese({ sito, flusso, mese, anno, onChiudi, onSalvato }) {
  const { toast } = useToast();
  const d = mese.dichiarazione;
  const materiali = materialiDi(flusso.operazione);
  const [dati, setDati] = useState(() => ({
    quantita_kg: d ? d.quantita_kg : 0,
    ricevuta_email: d ? d.ricevuta_email : false,
    ricevuta_il: (d && d.ricevuta_il) || '',
    caricata_inviata: d ? d.caricata_inviata : false,
    caricata_il: (d && d.caricata_il) || '',
    note: (d && d.note) || '',
    ...Object.fromEntries(materiali.map(m => [m.chiave, d ? d[m.chiave] || 0 : 0])),
  }));
  const [salvataggio, setSalvataggio] = useState(false);
  const imposta = (k, v) => setDati(x => ({ ...x, [k]: v }));

  // Il totale segue i materiali finché chi compila non lo forza a mano.
  const totaleMateriali = useMemo(() => sommaMateriali(dati), [dati]);
  useEffect(() => {
    if (totaleMateriali > 0 && Number(dati.quantita_kg) === 0) imposta('quantita_kg', totaleMateriali);
  }, [totaleMateriali]);

  const controlli = controlliDichiarazione({ ...dati }, mese.conferito_kg, flusso.operazione, { tipo_destinazione: sito.tipo_destinazione, canale: flusso.canale });
  const canale = CANALI.find(c => c.chiave === flusso.canale);

  const salva = async () => {
    setSalvataggio(true);
    try {
      const campi = {
        ...dati,
        quantita_kg: numero(dati.quantita_kg),
        ricevuta_il: dati.ricevuta_email ? (dati.ricevuta_il || oggi()) : '',
        caricata_il: dati.caricata_inviata ? (dati.caricata_il || oggi()) : '',
        ...Object.fromEntries(materiali.map(m => [m.chiave, numero(dati[m.chiave])])),
      };
      if (d && d.id) await base44.entities.DichiarazioneSito.update(d.id, campi);
      else {
        await base44.entities.DichiarazioneSito.create({
          sito: sito.sito, operazione: flusso.operazione || 'R3', canale: flusso.canale,
          provenienza: flusso.provenienza || '', anno, mese: mese.mese, ...campi,
        });
      }
      toast({ title: 'Dichiarazione salvata', description: `${sito.sito} · ${mese.mese} ${anno}` });
      onSalvato();
    } catch (e) {
      toast({ title: 'Salvataggio non riuscito', description: e?.response?.data?.error || e.message, variant: 'destructive' });
    } finally {
      setSalvataggio(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onChiudi()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{sito.sito} · {mese.mese} {anno}</DialogTitle>
          <DialogDescription>
            Canale {canale ? canale.nome : flusso.canale}{flusso.provenienza ? `, ${flusso.provenienza}` : ''}
            {flusso.operazione ? ` · ${flusso.operazione}` : ''} · conferiti nel mese <strong>{kg(mese.conferito_kg)} kg</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Quantità ricavate dalla lavorazione</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {materiali.map(m => (
                <label key={m.chiave} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                  <span className="text-sm">{m.nome}{m.eer ? <span className="text-xs text-muted-foreground"> · EER {m.eer}</span> : null}</span>
                  <span className="flex items-center gap-1">
                    <Input className="w-28 text-right tabular-nums" inputMode="numeric" value={dati[m.chiave] || ''} onChange={e => imposta(m.chiave, e.target.value)} placeholder="0" />
                    <span className="text-xs text-muted-foreground">kg</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="rounded-lg border px-3 py-2">
              <span className="text-sm font-medium block mb-1">PFU dichiarati nel mese</span>
              <span className="flex items-center gap-1">
                <Input className="text-right tabular-nums" inputMode="numeric" value={dati.quantita_kg || ''} onChange={e => imposta('quantita_kg', e.target.value)} placeholder="0" />
                <span className="text-xs text-muted-foreground">kg</span>
              </span>
              <span className="text-xs text-muted-foreground">Somma dei materiali: {kg(totaleMateriali)} kg</span>
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <input type="checkbox" checked={!!dati.ricevuta_email} onChange={e => imposta('ricevuta_email', e.target.checked)} />
                <span>Dichiarazione in mano (ricevuta via email o prodotta da noi)</span>
              </label>
              {dati.ricevuta_email && (
                <Input type="date" value={dati.ricevuta_il || ''} onChange={e => imposta('ricevuta_il', e.target.value)} />
              )}
              <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <input type="checkbox" checked={!!dati.caricata_inviata} onChange={e => imposta('caricata_inviata', e.target.checked)} />
                <span>Caricata a portale: decurta la giacenza</span>
              </label>
              {dati.caricata_inviata && (
                <Input type="date" value={dati.caricata_il || ''} onChange={e => imposta('caricata_il', e.target.value)} />
              )}
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Note</p>
            <Textarea rows={2} value={dati.note} onChange={e => imposta('note', e.target.value)} placeholder="Per esempio: dichiarazione che comprende la lavorazione della giacenza di luglio" />
          </div>

          {controlli.length > 0 && (
            <div className="space-y-1">
              {controlli.map((c, i) => (
                <p key={i} className={`flex items-start gap-2 text-xs rounded-md px-2 py-1.5 ${c.livello === 'attenzione' ? 'bg-amber-50 text-amber-900' : 'bg-sky-50 text-sky-900'}`}>
                  {c.livello === 'attenzione' ? <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> : <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                  {c.testo}
                </p>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onChiudi}>Annulla</Button>
          <Button onClick={salva} disabled={salvataggio} className="gap-1">
            {salvataggio ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
