import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Plus, Trash2, CheckSquare, Square, AlertCircle } from 'lucide-react';

const PRIORITA = {
  urgente: { label: 'Urgente', color: 'bg-red-100 text-red-700 border-red-200' },
  alta: { label: 'Alta', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  media: { label: 'Media', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  bassa: { label: 'Bassa', color: 'bg-gray-100 text-gray-700 border-gray-200' },
};

const STATO = {
  aperto: { label: 'Aperto', color: 'bg-blue-50 text-blue-700' },
  in_corso: { label: 'In Corso', color: 'bg-amber-50 text-amber-700' },
  completato: { label: 'Completato', color: 'bg-green-50 text-green-700' },
};

export default function TodoPage() {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterStato, setFilterStato] = useState('aperto');
  const [form, setForm] = useState({ titolo: '', descrizione: '', categoria: '', priorita: 'media', data_scadenza: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Todo.list('-created_date', 500);
      setTodos(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!form.titolo) return;
    try {
      await base44.entities.Todo.create({
        ...form,
        stato: 'aperto',
        data_ricezione: new Date().toISOString().split('T')[0],
      });
      setForm({ titolo: '', descrizione: '', categoria: '', priorita: 'media', data_scadenza: '' });
      setShowForm(false);
      load();
    } catch (e) { alert(e.message); }
  };

  const toggleStato = async (todo) => {
    const next = todo.stato === 'completato' ? 'aperto' : 'completato';
    try {
      await base44.entities.Todo.update(todo.id, { stato: next });
      load();
    } catch (e) { console.error(e); }
  };

  const cycleStato = async (todo) => {
    const order = ['aperto', 'in_corso', 'completato'];
    const next = order[(order.indexOf(todo.stato) + 1) % order.length];
    try {
      await base44.entities.Todo.update(todo.id, { stato: next });
      load();
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (todo) => {
    if (!confirm(`Eliminare "${todo.titolo}"?`)) return;
    try {
      await base44.entities.Todo.delete(todo.id);
      load();
    } catch (e) { console.error(e); }
  };

  const filtered = filterStato === 'tutti' ? todos : todos.filter(t => t.stato === filterStato);
  const counts = {
    aperto: todos.filter(t => t.stato === 'aperto').length,
    in_corso: todos.filter(t => t.stato === 'in_corso').length,
    completato: todos.filter(t => t.stato === 'completato').length,
  };

  return (
    <div className="p-4 lg:p-8 max-w-[1200px] mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold flex items-center gap-2"><CheckSquare className="w-7 h-7 text-primary" /> To-Do List</h1>
          <p className="text-muted-foreground mt-1">Gestione attività, solleciti e pratiche con scadenze.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Nuovo To-Do
        </button>
      </div>

      {/* KPI filtri */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilterStato('tutti')} className={`px-3 py-1.5 rounded-md text-sm border ${filterStato === 'tutti' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>Tutti ({todos.length})</button>
        <button onClick={() => setFilterStato('aperto')} className={`px-3 py-1.5 rounded-md text-sm border ${filterStato === 'aperto' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>Aperti ({counts.aperto})</button>
        <button onClick={() => setFilterStato('in_corso')} className={`px-3 py-1.5 rounded-md text-sm border ${filterStato === 'in_corso' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>In Corso ({counts.in_corso})</button>
        <button onClick={() => setFilterStato('completato')} className={`px-3 py-1.5 rounded-md text-sm border ${filterStato === 'completato' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>Completati ({counts.completato})</button>
      </div>

      {showForm && (
        <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
          <h3 className="font-heading font-semibold">Nuovo To-Do</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="text-xs font-medium">Titolo *</label>
              <input value={form.titolo} onChange={e => setForm({ ...form, titolo: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="es. Sollecito Ecotyre ordine XYZ" />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium">Descrizione</label>
              <textarea value={form.descrizione} onChange={e => setForm({ ...form, descrizione: e.target.value })} rows={2} className="w-full border rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium">Categoria</label>
              <input value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="es. Comunicazione consorzio" />
            </div>
            <div>
              <label className="text-xs font-medium">Priorità</label>
              <select value={form.priorita} onChange={e => setForm({ ...form, priorita: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm">
                {Object.entries(PRIORITA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">Data Scadenza</label>
              <input type="date" value={form.data_scadenza} onChange={e => setForm({ ...form, data_scadenza: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={!form.titolo} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"><Plus className="w-4 h-4" /> Aggiungi</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-md border text-sm hover:bg-accent">Annulla</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Caricamento...</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((todo) => {
            const pr = PRIORITA[todo.priorita] || PRIORITA.media;
            const st = STATO[todo.stato] || STATO.aperto;
            const isOverdue = todo.data_scadenza && new Date(todo.data_scadenza) < new Date() && todo.stato !== 'completato';
            return (
              <div key={todo.id} className={`border rounded-lg p-3 flex items-start gap-3 ${todo.stato === 'completato' ? 'opacity-60' : ''}`}>
                <button onClick={() => toggleStato(todo)} className="mt-0.5 flex-shrink-0">
                  {todo.stato === 'completato' ? <CheckSquare className="w-5 h-5 text-green-600" /> : <Square className="w-5 h-5 text-muted-foreground" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className={`font-heading font-semibold text-sm ${todo.stato === 'completato' ? 'line-through' : ''}`}>{todo.titolo}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded border ${pr.color}`}>{pr.label}</span>
                    <button onClick={() => cycleStato(todo)} className={`text-xs px-2 py-0.5 rounded ${st.color} hover:opacity-80`}>{st.label}</button>
                    {isOverdue && <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Scaduto</span>}
                  </div>
                  {todo.descrizione && <p className="text-sm text-muted-foreground">{todo.descrizione}</p>}
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {todo.categoria && <span>Categoria: {todo.categoria}</span>}
                    {todo.data_scadenza && <span>Scadenza: {new Date(todo.data_scadenza).toLocaleDateString('it-IT')}</span>}
                    {todo.riferimento_ordine && <span>Ordine: {todo.riferimento_ordine}</span>}
                  </div>
                </div>
                <button onClick={() => handleDelete(todo)} className="p-2 rounded-md hover:bg-red-50 flex-shrink-0"><Trash2 className="w-4 h-4 text-red-500" /></button>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-8 text-muted-foreground border rounded-lg">Nessun to-do {filterStato !== 'tutti' ? `con stato "${filterStato}"` : ''}. Crea il primo elemento.</div>
          )}
        </div>
      )}
    </div>
  );
}