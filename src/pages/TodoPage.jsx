import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Plus, Trash2, CheckSquare, Square, AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { usePermessi } from '@/lib/permessi';
import { BannerSolaLettura } from '@/components/shared/SolaLettura';
import RichiesteEct from '@/components/todo/RichiesteEct';
import OrdiniAttivita from '@/components/todo/OrdiniAttivita';

const PRIORITA = {
  urgente: { label: 'Urgente', color: 'bg-red-100 text-red-700 border-red-200' },
  alta: { label: 'Alta', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  media: { label: 'Media', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  bassa: { label: 'Bassa', color: 'bg-gray-100 text-gray-700 border-gray-200' },
};

// Un giorno 'AAAA-MM-GG' scritto all'italiana, senza passare da new Date: la
// data del ritiro e' un giorno, non un istante, e non deve scivolare di un fuso.
const gg = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '');

const STATO = {
  aperto: { label: 'Aperto', color: 'bg-blue-50 text-blue-700' },
  in_corso: { label: 'In Corso', color: 'bg-amber-50 text-amber-700' },
  completato: { label: 'Completato', color: 'bg-green-50 text-green-700' },
};

export default function TodoPage() {
  const { isAdmin } = usePermessi();
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterStato, setFilterStato] = useState('aperto');
  const [form, setForm] = useState({ titolo: '', descrizione: '', categoria: '', priorita: 'media', data_scadenza: '', riferimento_ordine: '' });
  // L'esito del controllo degli ordini: quali attivita' si sono chiuse da sole e
  // quali restano aperte perche' c'e' qualcosa da guardare.
  const [esitoOrdini, setEsitoOrdini] = useState(null);
  // Due elenchi diversi: le nostre attivita' e le richieste che arrivano dal
  // consorzio per email. Tenerle separate evita di mescolare cose che si
  // chiudono in modo diverso.
  const [sezione, setSezione] = useState('attivita');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Todo.list('-created_date', 500);
      setTodos(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Un'attivita' con un ID ordine scritto sopra si chiude da sola quando quell'
  // ordine risulta terminato: il controllo gira a ogni caricamento delle primarie
  // (RICALCOLI in src/lib/importGrandeFile.js) e anche qui, all'apertura della
  // pagina. Serve perche' se quel ricalcolo non e' partito - la scheda chiusa, la
  // rete caduta - un'attivita' gia' fatta resterebbe aperta fino al caricamento
  // dopo, e si starebbe dietro a un ritiro che c'e' gia'. Scrive, quindi solo per
  // l'amministratore; se non risponde la pagina si apre comunque.
  const controllaOrdini = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await base44.functions.invoke('controllaTodoOrdini', {});
      const dati = res.data || res;
      setEsitoOrdini(dati);
      if (dati.aggiornate > 0) await load();
    } catch (e) { /* il controllo si rifa' da solo al prossimo caricamento */ }
  }, [isAdmin, load]);
  useEffect(() => { controllaOrdini(); }, [controllaOrdini]);

  const handleAdd = async () => {
    if (!form.titolo) return;
    try {
      await base44.entities.Todo.create({
        ...form,
        stato: 'aperto',
        data_ricezione: new Date().toISOString().split('T')[0],
      });
      setForm({ titolo: '', descrizione: '', categoria: '', priorita: 'media', data_scadenza: '', riferimento_ordine: '' });
      setShowForm(false);
      load();
      // L'ordine scritto adesso puo' essere gia' terminato: si controlla subito,
      // invece di aspettare il prossimo caricamento.
      controllaOrdini();
    } catch (e) { alert(e.message); }
  };

  // L'ID ordine si corregge anche dopo, sull'attivita' che c'e' gia'. Appena
  // salvato si ricontrolla: se quell'ordine e' terminato l'attivita' si chiude
  // da sola senza aspettare altro.
  const salvaOrdine = async (todo, ordini) => {
    try {
      await base44.entities.Todo.update(todo.id, { riferimento_ordine: ordini });
      await load();
      await controllaOrdini();
    } catch (e) { alert(e.message); }
  };

  // La spunta a mano cambia solo lo stato: la nota di una chiusura fatta dal
  // gestionale resta scritta (non si cancella niente), e resta anche il segno
  // chiusa_dal_gestionale, cosi' un'attivita' riaperta a mano non viene richiusa
  // al controllo dopo - a decidere e' chi lavora.
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
          <p className="text-muted-foreground mt-1">Attività, solleciti e pratiche con scadenze, e le richieste di ritiro che il consorzio manda per email.</p>
        </div>
        {isAdmin && sezione === 'attivita' && (
          <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
            <Plus className="w-4 h-4" /> Nuovo To-Do
          </button>
        )}
      </div>

      <BannerSolaLettura cosa="le attività" />

      <div className="flex gap-2 border-b">
        {[['attivita', 'Attività'], ['ect', 'Richieste ECT']].map(([k, nome]) => (
          <button
            key={k}
            onClick={() => setSezione(k)}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 ${sezione === k ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {nome}
          </button>
        ))}
      </div>

      {sezione === 'ect' && <RichiesteEct isAdmin={isAdmin} />}

      {sezione === 'attivita' && (<>
      <p className="text-sm text-muted-foreground max-w-3xl">
        Su ogni attività puoi indicare l&apos;<strong>ID ordine da completare</strong>: il gestionale guarda da sé quando quell&apos;ordine
        passa da assegnato a terminato e solo allora segna l&apos;attività come completata, con la data della fine trasporto e il
        motivo scritto sotto. Il passaggio deve avvenire <strong>da quando l&apos;attività c&apos;è</strong>: se l&apos;ordine risultava già
        terminato quando l&apos;hai scritta, la chiusura automatica non scatta e la riga te lo dice, perché il lavoro di cui parla
        l&apos;attività — un sollecito, una pratica, una fattura — quello nessuno l&apos;ha ancora fatto. Se l&apos;ordine risulta
        <strong> cancellato</strong> l&apos;attività resta aperta e te lo dice: quel ritiro non si farà e la decisione è tua.
        Il controllo si rifà a ogni caricamento delle primarie e ogni volta che apri questa pagina.
      </p>

      {/* Che cosa ha fatto il controllo degli ordini appena aperta la pagina. */}
      {esitoOrdini && esitoOrdini.chiuse?.length > 0 && (
        <div className="flex items-start gap-2 text-sm border border-green-200 bg-green-50 text-green-800 rounded-lg px-3 py-2">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            {esitoOrdini.chiuse.length === 1
              ? "Un'attività si è chiusa da sola, il suo ordine risulta terminato: "
              : `${esitoOrdini.chiuse.length} attività si sono chiuse da sole, i loro ordini risultano terminati: `}
            {esitoOrdini.chiuse.map(x => `${x.titolo} (${x.ordini}${x.ritiro ? `, ritiro del ${gg(x.ritiro)}` : ''})`).join('; ')}.
          </span>
        </div>
      )}
      {esitoOrdini && esitoOrdini.da_guardare?.length > 0 && (
        <div className="space-y-1">
          {/* Le prime cinque: le altre si leggono sulla loro riga, dove si agisce. */}
          {esitoOrdini.da_guardare.slice(0, 5).map(x => (
            <div key={x.id} className="flex items-start gap-2 text-sm border border-amber-200 bg-amber-50 text-amber-900 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span><strong>{x.titolo}</strong>: {x.avviso}</span>
            </div>
          ))}
          {esitoOrdini.da_guardare.length > 5 && (
            <p className="text-xs text-muted-foreground">Altre {esitoOrdini.da_guardare.length - 5} attività hanno qualcosa da guardare sull&apos;ordine: lo dice la loro riga.</p>
          )}
        </div>
      )}
      {esitoOrdini && esitoOrdini.rinviato && (
        <p className="text-sm border rounded-lg px-3 py-2 bg-muted/40 text-muted-foreground">{esitoOrdini.avviso}</p>
      )}

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
            <div className="md:col-span-2">
              <label className="text-xs font-medium">ID ordine da completare</label>
              <input
                value={form.riferimento_ordine}
                onChange={e => setForm({ ...form, riferimento_ordine: e.target.value })}
                className="w-full border rounded-md px-3 py-2 text-sm font-mono"
                placeholder="ET26012345, ET26012346"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Quando l&apos;ordine passa da assegnato a terminato il gestionale segna l&apos;attività come completata da sé,
                con la data della fine trasporto. Puoi metterne più di uno separati da virgola: si chiude quando sono terminati tutti.
                Se un ordine risulta cancellato l&apos;attività resta aperta e te lo dice, perché quel ritiro non si farà. Un ordine
                già terminato adesso non chiude niente: il passaggio si conta da quando l&apos;attività c&apos;è.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={!form.titolo} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"><Plus className="w-4 h-4" /> Aggiungi</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm btn-secondario">Annulla</button>
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
                <button onClick={() => toggleStato(todo)} className="mt-0.5 flex-shrink-0" disabled={!isAdmin}>
                  {todo.stato === 'completato' ? <CheckSquare className="w-5 h-5 text-green-600" /> : <Square className="w-5 h-5 text-muted-foreground" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className={`font-heading font-semibold text-sm ${todo.stato === 'completato' ? 'line-through' : ''}`}>{todo.titolo}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded border ${pr.color}`}>{pr.label}</span>
                    {isAdmin
                      ? <button onClick={() => cycleStato(todo)} className={`text-xs px-2 py-0.5 rounded ${st.color} hover:opacity-80`}>{st.label}</button>
                      : <span className={`text-xs px-2 py-0.5 rounded ${st.color}`}>{st.label}</span>}
                    {isOverdue && <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Scaduto</span>}
                  </div>
                  {todo.descrizione && <p className="text-sm text-muted-foreground">{todo.descrizione}</p>}
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {todo.categoria && <span>Categoria: {todo.categoria}</span>}
                    {todo.data_scadenza && <span>Scadenza: {new Date(todo.data_scadenza).toLocaleDateString('it-IT')}</span>}
                  </div>
                  {/* L'ordine da completare, a che punto e' e perche' si e' chiusa
                      (o perche' non si chiude). */}
                  <OrdiniAttivita todo={todo} isAdmin={isAdmin} onSalva={(ordini) => salvaOrdine(todo, ordini)} />
                </div>
                {isAdmin && <button onClick={() => handleDelete(todo)} className="p-2 rounded-md hover:bg-red-50 flex-shrink-0"><Trash2 className="w-4 h-4 text-red-500" /></button>}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-8 text-muted-foreground border rounded-lg">Nessun to-do {filterStato !== 'tutti' ? `con stato "${filterStato}"` : ''}. Crea il primo elemento.</div>
          )}
        </div>
      )}
      </>)}
    </div>
  );
}