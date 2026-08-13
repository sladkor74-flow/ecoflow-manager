import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2, Save, X } from 'lucide-react';
import { formatNumber } from '@/lib/utils';

const REGIONI = ['Campania', 'Puglia', 'Basilicata', 'Calabria', 'Lazio', 'Molise', 'Abruzzo', 'Sicilia', 'Sardegna', 'Toscana', 'Lombardia', 'Piemonte', 'Veneto', 'Emilia-Romagna', 'Marche', 'Umbria', 'Liguria', 'Friuli-Venezia Giulia', 'Trentino-Alto Adige', 'Valle d\'Aosta'];

export default function TariffePassivaManager() {
  const [tariffe, setTariffe] = useState([]);
  const [fornitori, setFornitori] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    fornitore_id: '', fornitore_nome: '',
    unita_misura: '€/t', valore: 0, regione: '', data_inizio_validita: '', note: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const [t, f] = await Promise.all([
        base44.entities.Tariffa.filter({ direzione: 'PASSIVA', tipologia: 'RETE' }),
        base44.entities.Fornitore.filter({ stato: 'attivo' }),
      ]);
      // Ordina per fornitore poi regione
      t.sort((a, b) => (a.fornitore_nome || '').localeCompare(b.fornitore_nome || '') || (a.regione || '').localeCompare(b.regione || ''));
      setTariffe(t); setFornitori(f);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.fornitore_id || !form.valore) return;
    const f = fornitori.find(x => x.id === form.fornitore_id);
    await base44.entities.Tariffa.create({
      fornitore_id: form.fornitore_id,
      fornitore_nome: f?.ragione_sociale,
      servizio_id: '', servizio_nome: 'TRASPORTO RETE',
      unita_misura: form.unita_misura,
      valore: Number(form.valore),
      regione: form.regione,
      data_inizio_validita: form.data_inizio_validita || undefined,
      direzione: 'PASSIVA',
      tipologia: 'RETE',
      stato: 'attivo',
      note: form.note,
    });
    setForm({ fornitore_id: '', fornitore_nome: '', unita_misura: '€/t', valore: 0, regione: '', data_inizio_validita: '', note: '' });
    setShowForm(false); load();
  };

  const remove = async (t) => {
    if (!confirm('Eliminare questa tariffa?')) return;
    await base44.entities.Tariffa.delete(t.id); load();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-heading font-semibold text-lg">Tariffe Fatturazione Passiva — Rete (Raccoglitori)</h2>
          <p className="text-sm text-muted-foreground">Configura i compensi ai raccoglitori per la raccolta RETE. Metodo esclusivo: €/t oppure €/Viaggio.</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
          {showForm ? 'Annulla' : 'Aggiungi Tariffa'}
        </Button>
      </div>

      {showForm && (
        <div className="border-2 border-primary/30 rounded-lg p-4 space-y-3 bg-muted/30">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Fornitore (Raccoglitore) *</label>
              <Select value={form.fornitore_id} onValueChange={v => setForm({ ...form, fornitore_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleziona fornitore" /></SelectTrigger>
                <SelectContent>
                  {fornitori.filter(f => f.tipo === 'trasportatore' || !f.tipo).map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.ragione_sociale}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Metodo di Calcolo *</label>
              <Select value={form.unita_misura} onValueChange={v => setForm({ ...form, unita_misura: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="€/t">€/t (al tonnellaggio)</SelectItem>
                  <SelectItem value="€/viaggio">€/Viaggio (a viaggio)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Zona/Regione (opzionale)</label>
              <Select value={form.regione} onValueChange={v => setForm({ ...form, regione: v })}>
                <SelectTrigger><SelectValue placeholder="Tutte le zone" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Tutte le zone</SelectItem>
                  {REGIONI.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Valore Tariffa *</label>
              <Input type="number" step="0.01" placeholder="es. 71" value={form.valore} onChange={e => setForm({ ...form, valore: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Data Inizio Validità</label>
              <Input type="date" value={form.data_inizio_validita} onChange={e => setForm({ ...form, data_inizio_validita: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Note</label>
              <Input placeholder="Note opzionali" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
            </div>
          </div>
          <Button size="sm" onClick={add} disabled={!form.fornitore_id || !form.valore}>
            <Save className="w-4 h-4 mr-1" /> Salva Tariffa
          </Button>
        </div>
      )}

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-3 py-2 font-heading font-semibold">Fornitore (Raccoglitore)</th>
              <th className="text-left px-3 py-2 font-heading font-semibold">Metodo</th>
              <th className="text-left px-3 py-2 font-heading font-semibold">Zona/Regione</th>
              <th className="text-right px-3 py-2 font-heading font-semibold">Valore</th>
              <th className="text-left px-3 py-2 font-heading font-semibold">Validità dal</th>
              <th className="text-left px-3 py-2 font-heading font-semibold">Note</th>
              <th className="text-right px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {tariffe.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nessuna tariffa configurata. Clicca "Aggiungi Tariffa" per iniziare.
                </td>
              </tr>
            )}
            {tariffe.map((t, i) => (
              <tr key={t.id} className={i % 2 ? 'bg-muted/30' : ''}>
                <td className="px-3 py-2 font-medium">{t.fornitore_nome || '-'}</td>
                <td className="px-3 py-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">{t.unita_misura}</span>
                </td>
                <td className="px-3 py-2">{t.regione || <span className="text-muted-foreground italic">Tutte</span>}</td>
                <td className="px-3 py-2 text-right font-semibold">{formatNumber(t.valore, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="px-3 py-2 text-muted-foreground">{t.data_inizio_validita ? new Date(t.data_inizio_validita).toLocaleDateString('it-IT') : '-'}</td>
                <td className="px-3 py-2 text-muted-foreground text-xs">{t.note || '-'}</td>
                <td className="text-right px-3 py-2">
                  <button onClick={() => remove(t)} className="p-1 hover:bg-red-50 rounded">
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}