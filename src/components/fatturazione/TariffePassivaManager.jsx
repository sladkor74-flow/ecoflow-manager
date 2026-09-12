import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Save, X, AlertTriangle, Pencil, Lock, CalendarX, RotateCcw } from 'lucide-react';
import { formatNumber } from '@/lib/utils';
import { fetchAllClient } from '@/lib/fetchAllClient';

const REGIONI = ['Campania', 'Puglia', 'Basilicata', 'Calabria', 'Lazio', 'Molise', 'Abruzzo', 'Sicilia', 'Sardegna', 'Toscana', 'Lombardia', 'Piemonte', 'Veneto', 'Emilia-Romagna', 'Marche', 'Umbria', 'Liguria', 'Friuli-Venezia Giulia', 'Trentino-Alto Adige', 'Valle d\'Aosta'];

// Verifica se una tariffa è archiviata (non più modificabile nelle date)
const isArchiviata = (t) => {
  if (t.stato === 'non_attivo') return true;
  if (t.data_fine_validita) {
    const fine = new Date(t.data_fine_validita);
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    if (fine < oggi) return true;
  }
  return false;
};

// Verifica se una tariffa è "aperta" (attiva senza data fine)
const isAperta = (t) => t.stato === 'attivo' && !t.data_fine_validita;

export default function TariffePassivaManager() {
  const [tariffe, setTariffe] = useState([]);
  const [fornitori, setFornitori] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showOnlyActive, setShowOnlyActive] = useState(true);
  const [erroreSalvataggio, setErroreSalvataggio] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ valore: 0, unita_misura: '€/t', note: '', regione: '', provincia: '', data_inizio_validita: '', data_fine_validita: '' });
  const [editErrore, setEditErrore] = useState('');
  const [province, setProvince] = useState([]);
  const [form, setForm] = useState({
    fornitore_id: '', fornitore_nome: '',
    unita_misura: '€/t', valore: 0, regione: '', provincia: '', data_inizio_validita: '', data_fine_validita: '', note: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const [t, f, primarie] = await Promise.all([
        base44.entities.Tariffa.filter({ direzione: 'PASSIVA', tipologia: 'RETE' }),
        base44.entities.Fornitore.filter({ stato: 'attivo' }),
        fetchAllClient(base44.entities.PrimariaRete),
      ]);
      // Estrai province distinte dai record PrimariaRete (sigle di 2 lettere)
      const provSet = new Set();
      for (const r of primarie) {
        const p = (r.provincia || '').trim().toUpperCase();
        if (p && p.length >= 2) provSet.add(p);
      }
      setProvince(Array.from(provSet).sort());
      // Ordina per fornitore poi provincia poi regione poi data inizio desc
      t.sort((a, b) =>
        (a.fornitore_nome || '').localeCompare(b.fornitore_nome || '') ||
        (a.provincia || '').localeCompare(b.provincia || '') ||
        (a.regione || '').localeCompare(b.regione || '') ||
        new Date(b.data_inizio_validita || 0).getTime() - new Date(a.data_inizio_validita || 0).getTime()
      );
      setTariffe(t); setFornitori(f);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.fornitore_id) return;
    setErroreSalvataggio('');
    const f = fornitori.find(x => x.id === form.fornitore_id);
    try {
      await base44.functions.invoke('gestisciAnagrafiche', {
        entita: 'Tariffa', operazione: 'create',
        dati: {
          fornitore_id: form.fornitore_id,
          fornitore_nome: f?.ragione_sociale,
          servizio_id: '', servizio_nome: 'TRASPORTO RETE',
          prestazione: 'RACCOLTA',
          unita_misura: form.unita_misura,
          valore: Number(form.valore),
          regione: form.regione,
          provincia: form.provincia || undefined,
          data_inizio_validita: form.data_inizio_validita || undefined,
          data_fine_validita: form.data_fine_validita || undefined,
          direzione: 'PASSIVA',
          tipologia: 'RETE',
          stato: 'attivo',
          note: form.note,
        },
      });
      setForm({ fornitore_id: '', fornitore_nome: '', unita_misura: '€/t', valore: 0, regione: '', provincia: '', data_inizio_validita: '', data_fine_validita: '', note: '' });
      setShowForm(false); load();
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Errore durante il salvataggio';
      setErroreSalvataggio(msg);
      load();
    }
  };

  // Avvia modifica di una tariffa
  const startEdit = (t) => {
    setEditingId(t.id);
    setEditErrore('');
    setEditForm({
      valore: t.valore || 0,
      unita_misura: t.unita_misura || '€/t',
      note: t.note || '',
      regione: t.regione || '',
      provincia: t.provincia || '',
      data_inizio_validita: t.data_inizio_validita ? t.data_inizio_validita.slice(0, 10) : '',
      data_fine_validita: t.data_fine_validita ? t.data_fine_validita.slice(0, 10) : '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditErrore('');
  };

  const saveEdit = async (t) => {
    setEditErrore('');
    const archiviata = isArchiviata(t);
    const updateData = {
      valore: Number(editForm.valore),
      unita_misura: editForm.unita_misura,
      note: editForm.note,
    };

    // Per tariffe non archiviate, permetti modifica anche di regione e date
    if (!archiviata) {
      updateData.regione = editForm.regione;
      updateData.provincia = editForm.provincia || undefined;
      updateData.data_inizio_validita = editForm.data_inizio_validita || undefined;
      updateData.data_fine_validita = editForm.data_fine_validita || undefined;
    }

    try {
      await base44.functions.invoke('gestisciAnagrafiche', { entita: 'Tariffa', operazione: 'update', id: t.id, dati: updateData });
      setEditingId(null);
      load();
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Errore durante il salvataggio';
      setEditErrore(msg);
    }
  };

  // Chiudi il periodo di validità di una tariffa aperta
  const closePeriod = async (t) => {
    const dataFine = prompt('Inserisci la data di fine validità (YYYY-MM-DD):', new Date().toISOString().slice(0, 10));
    if (!dataFine) return;
    const dt = new Date(dataFine);
    if (isNaN(dt.getTime())) {
      alert('Data non valida');
      return;
    }
    await base44.functions.invoke('gestisciAnagrafiche', {
      entita: 'Tariffa', operazione: 'update', id: t.id,
      dati: { data_fine_validita: dataFine, stato: 'non_attivo' },
    });
    load();
  };

  // Riapri una tariffa archiviata (rimuovi data fine, riattiva)
  const reopenPeriod = async (t) => {
    if (!confirm('Riaprire questa tariffa? Verrà impostata come attiva senza data di fine. Verifica che non ci siano sovrapposizioni.')) return;
    await base44.functions.invoke('gestisciAnagrafiche', {
      entita: 'Tariffa', operazione: 'update', id: t.id,
      dati: { data_fine_validita: undefined, stato: 'attivo' },
    });
    load();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  const tariffeVisibili = showOnlyActive ? tariffe.filter(t => t.stato === 'attivo') : tariffe;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-heading font-semibold text-lg">Tariffe Fatturazione Passiva — Rete (Raccoglitori)</h2>
          <p className="text-sm text-muted-foreground">Configura i compensi ai raccoglitori per la raccolta RETE. Metodo esclusivo: €/t oppure €/Viaggio. Le tariffe sono storicizzate: la modifica chiude automaticamente il periodo precedente.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlyActive}
              onChange={(e) => setShowOnlyActive(e.target.checked)}
              className="w-4 h-4 rounded border-input accent-primary"
            />
            <span className="text-muted-foreground">Mostra solo tariffe attive</span>
          </label>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
            {showForm ? 'Annulla' : 'Aggiungi Tariffa'}
          </Button>
        </div>
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
              <label className="text-xs text-muted-foreground block mb-1">Provincia (opzionale - vuoto = tutta la regione)</label>
              <Select value={form.provincia} onValueChange={v => setForm({ ...form, provincia: v })}>
                <SelectTrigger><SelectValue placeholder="Tutte le province" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Tutte le province</SelectItem>
                  {province.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
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
              <label className="text-xs text-muted-foreground block mb-1">Data Fine Validità (opz.)</label>
              <Input type="date" value={form.data_fine_validita} onChange={e => setForm({ ...form, data_fine_validita: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Note</label>
              <Input placeholder="Note opzionali" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
            </div>
          </div>
          {erroreSalvataggio && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3 text-sm text-destructive flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{erroreSalvataggio}</span>
            </div>
          )}
          <Button size="sm" onClick={add} disabled={!form.fornitore_id}>
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
              <th className="text-left px-3 py-2 font-heading font-semibold">Provincia</th>
              <th className="text-right px-3 py-2 font-heading font-semibold">Valore</th>
              <th className="text-left px-3 py-2 font-heading font-semibold">Validità dal</th>
              <th className="text-left px-3 py-2 font-heading font-semibold">Validità al</th>
              <th className="text-left px-3 py-2 font-heading font-semibold">Stato</th>
              <th className="text-left px-3 py-2 font-heading font-semibold">Note</th>
              <th className="text-right px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {tariffeVisibili.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center py-8 text-muted-foreground">
                  Nessuna tariffa {showOnlyActive ? 'attiva' : 'configurata'}. Clicca "Aggiungi Tariffa" per iniziare.
                </td>
              </tr>
            )}
            {tariffeVisibili.map((t, i) => {
              const archiviata = isArchiviata(t);
              const aperta = isAperta(t);
              const isEditing = editingId === t.id;
              return (
                <tr key={t.id} className={`${i % 2 ? 'bg-muted/30' : ''} ${archiviata ? 'opacity-60' : ''}`}>
                  <td className="px-3 py-2 font-medium">{t.fornitore_nome || '-'}</td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <Select value={editForm.unita_misura} onValueChange={v => setEditForm({ ...editForm, unita_misura: v })}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="€/t">€/t</SelectItem>
                          <SelectItem value="€/viaggio">€/Viaggio</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">{t.unita_misura}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing && !archiviata ? (
                      <Select value={editForm.regione} onValueChange={v => setEditForm({ ...editForm, regione: v })}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={null}>Tutte</SelectItem>
                          {REGIONI.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      t.regione || <span className="text-muted-foreground italic">Tutte</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing && !archiviata ? (
                      <Select value={editForm.provincia} onValueChange={v => setEditForm({ ...editForm, provincia: v })}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={null}>Tutte</SelectItem>
                          {province.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      t.provincia || <span className="text-muted-foreground italic">Tutte</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isEditing ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={editForm.valore}
                        onChange={e => setEditForm({ ...editForm, valore: e.target.value })}
                        className="h-8 w-24 text-right"
                      />
                    ) : (
                      <span className="font-semibold">{formatNumber(t.valore, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {isEditing && !archiviata ? (
                      <Input type="date" value={editForm.data_inizio_validita} onChange={e => setEditForm({ ...editForm, data_inizio_validita: e.target.value })} className="h-8 w-36" />
                    ) : (
                      t.data_inizio_validita ? new Date(t.data_inizio_validita).toLocaleDateString('it-IT') : '-'
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {isEditing && !archiviata ? (
                      <Input type="date" value={editForm.data_fine_validita} onChange={e => setEditForm({ ...editForm, data_fine_validita: e.target.value })} className="h-8 w-36" />
                    ) : (
                      t.data_fine_validita ? new Date(t.data_fine_validita).toLocaleDateString('it-IT') : <span className="italic">aperto</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {t.stato === 'attivo' ? (
                      <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 font-medium">Attivo</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium">Archiviata</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">
                    {isEditing ? (
                      <Input value={editForm.note} onChange={e => setEditForm({ ...editForm, note: e.target.value })} className="h-8" />
                    ) : (
                      t.note || '-'
                    )}
                  </td>
                  <td className="text-right px-3 py-2 whitespace-nowrap">
                    {isEditing ? (
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => saveEdit(t)} className="p-1 hover:bg-green-50 rounded" title="Salva">
                          <Save className="w-4 h-4 text-green-600" />
                        </button>
                        <button onClick={cancelEdit} className="p-1 hover:bg-muted rounded" title="Annulla">
                          <X className="w-4 h-4 text-muted-foreground" />
                        </button>
                        {editErrore && <span className="text-xs text-destructive ml-1" title={editErrore}>⚠</span>}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => startEdit(t)} className="p-1 hover:bg-muted rounded" title={archiviata ? 'Modifica valore/note (date bloccate)' : 'Modifica'}>
                          {archiviata ? <Lock className="w-4 h-4 text-muted-foreground" /> : <Pencil className="w-4 h-4 text-blue-500" />}
                        </button>
                        {aperta && (
                          <button onClick={() => closePeriod(t)} className="p-1 hover:bg-amber-50 rounded" title="Chiudi periodo (imposta data fine)">
                            <CalendarX className="w-4 h-4 text-amber-500" />
                          </button>
                        )}
                        {archiviata && (
                          <button onClick={() => reopenPeriod(t)} className="p-1 hover:bg-green-50 rounded" title="Riapri (riattiva senza data fine)">
                            <RotateCcw className="w-4 h-4 text-green-500" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!showOnlyActive && tariffe.length > tariffeVisibili.length && (
        <p className="text-xs text-muted-foreground text-center">
          {tariffe.length - tariffeVisibili.length} tariffe archiviate nascoste. Disattiva il filtro per visualizzarle.
        </p>
      )}
    </div>
  );
}