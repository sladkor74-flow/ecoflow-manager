import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X } from 'lucide-react';
import { normalizzaRagioneSociale } from '@/lib/normalizzaRagioneSocialeClient';
import { formatTonnellate } from '@/lib/utils';

const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const MESI_SHORT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];

function fmt(n) { return formatTonnellate(Number(n || 0)); }

export default function DichiarazioniGrid({ open, onClose, anno }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [extraFlussi, setExtraFlussi] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newFlusso, setNewFlusso] = useState({ sito: '', operazione: 'R3', canale: 'RETE', provenienza: '' });

  const load = async () => {
    setLoading(true);
    try { setRecords(await base44.entities.DichiarazioneSito.filter({ anno })); } catch (e) {}
    setLoading(false);
  };
  useEffect(() => { if (open) { load(); setExtraFlussi([]); } }, [open]);

  const flussi = useMemo(() => {
    const map = new Map();
    for (const r of records) {
      const key = `${normalizzaRagioneSociale(r.sito)}|${r.operazione}|${r.canale}|${r.provenienza || ''}`;
      if (!map.has(key)) map.set(key, { sito: r.sito, operazione: r.operazione, canale: r.canale, provenienza: r.provenienza || '' });
    }
    for (const f of extraFlussi) {
      const key = `${normalizzaRagioneSociale(f.sito)}|${f.operazione}|${f.canale}|${f.provenienza || ''}`;
      if (!map.has(key)) map.set(key, f);
    }
    return Array.from(map.values());
  }, [records, extraFlussi]);

  function getCell(flusso, mese) {
    return records.find(r =>
      normalizzaRagioneSociale(r.sito) === normalizzaRagioneSociale(flusso.sito) &&
      r.operazione === flusso.operazione && r.canale === flusso.canale &&
      (r.provenienza || '') === (flusso.provenienza || '') && r.mese === mese
    );
  }

  const saveCell = async (flusso, mese, quantita, caricata) => {
    const existing = getCell(flusso, mese);
    try {
      if (existing) {
        await base44.entities.DichiarazioneSito.update(existing.id, { quantita_kg: quantita, caricata_inviata: caricata });
      } else {
        const created = await base44.entities.DichiarazioneSito.create({ sito: flusso.sito, operazione: flusso.operazione, canale: flusso.canale, provenienza: flusso.provenienza || '', anno, mese, quantita_kg: quantita, caricata_inviata: caricata });
        setRecords(prev => [...prev, created]); return;
      }
      setRecords(prev => prev.map(r => r.id === existing.id ? { ...r, quantita_kg: quantita, caricata_inviata: caricata } : r));
    } catch (e) { alert(e?.message); }
  };

  const addFlusso = () => {
    if (!newFlusso.sito) return;
    setExtraFlussi(prev => [...prev, { ...newFlusso }]);
    setShowAdd(false); setNewFlusso({ sito: '', operazione: 'R3', canale: 'RETE', provenienza: '' });
  };

  const totaleInviato = (flusso) => {
    return records.filter(r => r.caricata_inviata === true &&
      normalizzaRagioneSociale(r.sito) === normalizzaRagioneSociale(flusso.sito) &&
      r.operazione === flusso.operazione && r.canale === flusso.canale &&
      (r.provenienza || '') === (flusso.provenienza || ''))
      .reduce((s, r) => s + (r.quantita_kg || 0) / 1000, 0);
  };

  const totaleMese = (mese) => {
    return records.filter(r => r.mese === mese && r.caricata_inviata === true).reduce((s, r) => s + (r.quantita_kg || 0) / 1000, 0);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Dichiarazioni mensili - {anno}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground bg-muted/30 border rounded p-2">Le dichiarazioni di Irigom si inseriscono a mano, perché non sono esportabili da portale. Solo i mesi contrassegnati come inviati decurtano la giacenza. Le dichiarazioni ACI non si caricano a portale: incidono sulla posizione ACI ma non sulla giacenza rete.</p>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowAdd(!showAdd)}><Plus className="w-4 h-4 mr-1" /> Aggiungi flusso</Button>
        </div>
        {showAdd && (
          <div className="border rounded-lg p-3 bg-muted/30 space-y-2">
            <div className="grid grid-cols-4 gap-2">
              <div><label className="text-xs text-muted-foreground block mb-1">Sito</label><Input value={newFlusso.sito} onChange={e => setNewFlusso({ ...newFlusso, sito: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground block mb-1">Operazione</label><Select value={newFlusso.operazione} onValueChange={v => setNewFlusso({ ...newFlusso, operazione: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="R3">R3</SelectItem><SelectItem value="R1">R1</SelectItem></SelectContent></Select></div>
              <div><label className="text-xs text-muted-foreground block mb-1">Canale</label><Select value={newFlusso.canale} onValueChange={v => setNewFlusso({ ...newFlusso, canale: v, provenienza: v === 'ACI' ? newFlusso.provenienza : '' })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="RETE">RETE</SelectItem><SelectItem value="ACI">ACI</SelectItem><SelectItem value="EXTRA_RACCOLTA">Extra Raccolta</SelectItem></SelectContent></Select></div>
              <div><label className="text-xs text-muted-foreground block mb-1">Provenienza</label><Select value={newFlusso.provenienza || ''} onValueChange={v => setNewFlusso({ ...newFlusso, provenienza: v })} disabled={newFlusso.canale !== 'ACI'}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger><SelectContent><SelectItem value={null}>—</SelectItem><SelectItem value="primaria">Primaria</SelectItem><SelectItem value="secondaria">Secondaria</SelectItem></SelectContent></Select></div>
            </div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowAdd(false)}><X className="w-4 h-4 mr-1" /> Annulla</Button><Button onClick={addFlusso}>Aggiungi</Button></div>
          </div>
        )}
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted"><tr>
              <th className="text-left px-2 py-2 font-semibold whitespace-nowrap sticky left-0 bg-muted">Sito · Operazione</th>
              {MESI_SHORT.map(m => <th key={m} className="text-center px-1 py-2 font-semibold">{m}</th>)}
              <th className="text-right px-2 py-2 font-semibold whitespace-nowrap">Tot. inviato (t)</th>
            </tr></thead>
            <tbody>
              {flussi.map((f, fi) => (
                <tr key={fi} className={`border-b ${fi % 2 ? 'bg-muted/20' : ''}`}>
                  <td className="px-2 py-1 font-medium whitespace-nowrap sticky left-0 bg-inherit">
                    {f.sito} · {f.operazione} {f.canale}{f.provenienza ? ` ${f.provenienza}` : ''}
                  </td>
                  {MESI.map((m, mi) => {
                    const cell = getCell(f, m);
                    const q = cell?.quantita_kg || 0;
                    const inv = cell?.caricata_inviata || false;
                    const isMancante = q > 0 && !inv;
                    return (
                      <td key={mi} className={`px-1 py-1 ${isMancante ? 'bg-amber-100' : ''}`}>
                        <div className="flex flex-col items-center gap-0.5">
                          <input type="number" value={q || ''} onChange={e => saveCell(f, m, Number(e.target.value) || 0, inv)} className="w-14 text-right text-xs border rounded px-1 py-0.5" placeholder="—" />
                          <label className="flex items-center gap-0.5 cursor-pointer">
                            <input type="checkbox" checked={inv} onChange={e => saveCell(f, m, q, e.target.checked)} className="w-3 h-3 accent-primary" />
                            <span className="text-[9px] text-muted-foreground">inv.</span>
                          </label>
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-2 py-1 text-right tabular-nums font-medium">{fmt(totaleInviato(f))}</td>
                </tr>
              ))}
              {flussi.length === 0 && <tr><td colSpan={14} className="text-center py-4 text-muted-foreground">Nessuna dichiarazione.</td></tr>}
            </tbody>
            <tfoot className="bg-muted font-bold"><tr>
              <td className="px-2 py-2 sticky left-0 bg-muted">TOTALE inviato (t)</td>
              {MESI.map((m, mi) => <td key={mi} className="px-1 py-2 text-center tabular-nums">{fmt(totaleMese(m))}</td>)}
              <td className="px-2 py-2 text-right tabular-nums">{fmt(MESI.reduce((s, m) => s + totaleMese(m), 0))}</td>
            </tr></tfoot>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}