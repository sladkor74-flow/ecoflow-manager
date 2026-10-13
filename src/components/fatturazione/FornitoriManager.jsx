import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { fetchAllClient } from '@/lib/fetchAllClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2, Power } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

export default function FornitoriManager() {
  const [fornitori, setFornitori] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ragione_sociale: '', tipo: 'trasportatore', piva: '', regione: '' });
  const [errore, setErrore] = useState('');

  // Tutta l'anagrafica, non le prime 500 righe (chiusura dell'audit, 11/10/2026).
  const load = async () => {
    setLoading(true);
    try { setFornitori(await fetchAllClient(base44.entities.Fornitore, null, '-created_date')); } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // IL NOME GIA' PRESENTE SI DICE (chiusura dell'audit, 11/10/2026): dall'11/10
  // gestisciAnagrafiche rifiuta un fornitore il cui nome normalizzato c'e' gia'
  // («GATIM S.R.L.» e «GATIM» sono lo stesso), e qui il rifiuto si mostrava come
  // niente - il modulo si chiudeva lo stesso e il fornitore non c'era.
  const add = async () => {
    if (!form.ragione_sociale) return;
    setErrore('');
    try {
      await base44.functions.invoke('gestisciAnagrafiche', { entita: 'Fornitore', operazione: 'create', dati: { ...form, stato: 'attivo' } });
    } catch (e) {
      setErrore(e?.response?.data?.error || e?.message || 'Il fornitore non si è potuto salvare.');
      return;
    }
    setForm({ ragione_sociale: '', tipo: 'trasportatore', piva: '', regione: '' });
    setShowForm(false); load();
  };

  const toggle = async (f) => {
    await base44.functions.invoke('gestisciAnagrafiche', { entita: 'Fornitore', operazione: 'update', id: f.id, dati: { stato: f.stato === 'attivo' ? 'non_attivo' : 'attivo' } });
    load();
  };

  // PRIMA DI ELIMINARE, CHI LO USA (audit del 20/09, alta A88; corretta il
  // 12/10/2026). Qui si chiedeva solo «Eliminare X?» e il fornitore spariva con
  // le sue tariffe, le voci della passiva e i movimenti che lo nominano senza
  // piu' un soggetto. Ora gestisciAnagrafiche conta i riferimenti e, se ce ne
  // sono, non elimina: risponde con l'elenco, e qui si propone di disattivarlo
  // (resta per i conti gia' fatti) o di eliminarlo lo stesso, con una conferma
  // che l'elenco l'ha mostrato. Anche un errore si dice: prima non si vedeva.
  const [inUso, setInUso] = useState(null);
  const [erroreAzione, setErroreAzione] = useState('');
  const datiErrore = (e) => e?.response?.data || e?.data || {};
  const elimina = async (f, conferma = false) => {
    setErroreAzione('');
    try {
      await base44.functions.invoke('gestisciAnagrafiche', {
        entita: 'Fornitore', operazione: 'delete', id: f.id, motivo: 'eliminato dall\'anagrafica dei fornitori',
        ...(conferma ? { conferma_eliminazione: true } : {}),
      });
      setInUso(null);
      load();
    } catch (e) {
      const d = datiErrore(e);
      if (!conferma && d.richiede_conferma && d.riferimenti) { setInUso({ f, riferimenti: d.riferimenti, testo: d.error }); return; }
      setInUso(null);
      setErroreAzione(d.error || e?.message || 'Il fornitore non si è potuto eliminare.');
    }
  };
  const remove = async (f) => {
    if (!confirm(`Eliminare ${f.ragione_sociale}?`)) return;
    await elimina(f);
  };
  const disattivaInUso = async () => {
    const { f } = inUso;
    setInUso(null);
    try {
      await base44.functions.invoke('gestisciAnagrafiche', { entita: 'Fornitore', operazione: 'update', id: f.id, dati: { stato: 'non_attivo' }, motivo: 'disattivato invece di eliminarlo: è ancora usato' });
    } catch (e) {
      setErroreAzione(datiErrore(e).error || e?.message || 'Il fornitore non si è potuto disattivare.');
    }
    load();
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
          {errore && <div className="text-sm text-destructive">{errore}</div>}
          <Button size="sm" onClick={add}>Salva</Button>
        </div>
      )}
      {erroreAzione && <div className="text-sm text-destructive">{erroreAzione}</div>}
      <Dialog open={inUso !== null} onOpenChange={(o) => !o && setInUso(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{inUso ? `${inUso.f.ragione_sociale} è ancora usato` : ''}</DialogTitle>
          </DialogHeader>
          {inUso && (
            <div className="space-y-3 text-sm">
              <ul className="list-disc pl-5 space-y-0.5">
                {(inUso.riferimenti.elenco || []).map((r, i) => <li key={i}>{r}</li>)}
              </ul>
              <div className="bg-amber-50 border border-amber-300 rounded p-3 text-amber-800 text-xs">
                Eliminandolo, questi restano senza il loro fornitore: la passiva non sa più a chi fatturare e il foglio dell&apos;amministrazione perde il soggetto. Disattivandolo resta per i conti già fatti e non si propone più nelle scelte.
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setInUso(null)}>Annulla</Button>
            <Button variant="outline" onClick={disattivaInUso}><Power className="w-4 h-4 mr-1" /> Disattiva</Button>
            <Button variant="destructive" onClick={() => inUso && elimina(inUso.f, true)}><Trash2 className="w-4 h-4 mr-1" /> Elimina comunque</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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