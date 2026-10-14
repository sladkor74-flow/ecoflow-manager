import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Plus, CheckSquare, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { usePermessi } from '@/lib/permessi';
import { oggiRoma } from '@/lib/giornoItaliano';
import { conteggiAttivita, campiCambioStato, EVENTO_TODO } from '@/lib/todoSezioni';
import { BannerSolaLettura } from '@/components/shared/SolaLettura';
import RichiesteEct from '@/components/todo/RichiesteEct';
import ElencoAttivita, { PRIORITA } from '@/components/todo/ElencoAttivita';

// Un giorno 'AAAA-MM-GG' scritto all'italiana, senza passare da new Date: la
// data del ritiro e' un giorno, non un istante, e non deve scivolare di un fuso.
const gg = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '');

// I filtri dell'elenco DA FARE. Le completate non stanno in nessun filtro: dal
// 12/10/2026 hanno la loro sezione sotto l'elenco (richiesta dell'utente: «gli
// ordini della 'to-do list' quando sono completati vanno spostati nella sezione
// completati e non solo evidenziati come tali»), e i numeri dei filtri contano
// solo quello che resta da fare. Si apre su tutti i da fare, aperti e in corso:
// prima si apriva sugli aperti perche' «Tutti» si portava dietro le completate.
const FILTRI = [['tutti', 'Da fare', 'da_fare'], ['aperto', 'Aperti', 'aperto'], ['in_corso', 'In corso', 'in_corso']];

export default function TodoPage() {
  const { isAdmin } = usePermessi();
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterStato, setFilterStato] = useState('tutti');
  const [form, setForm] = useState({ titolo: '', descrizione: '', categoria: '', priorita: 'media', data_scadenza: '', riferimento_ordine: '' });
  // Un cambio di stato che non si salva si dice sulla pagina: prima finiva solo
  // nella console, e la spunta sembrava ignorata.
  const [errore, setErrore] = useState('');
  // L'esito del controllo degli ordini: quali attivita' si sono chiuse da sole e
  // quali restano aperte perche' c'e' qualcosa da guardare.
  const [esitoOrdini, setEsitoOrdini] = useState(null);
  // Due elenchi diversi: le nostre attivita' e le richieste che arrivano dal
  // consorzio per email. Tenerle separate evita di mescolare cose che si
  // chiudono in modo diverso.
  const [sezione, setSezione] = useState('attivita');

  // L'elenco e' completo quando la lettura ha portato meno del massimo: solo
  // allora il suo «Da fare» e' quello vero, e si puo' dire al menu.
  const [elencoIntero, setElencoIntero] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Todo.list('-created_date', 500);
      setTodos(data);
      setElencoIntero(data.length < 500);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // IL NUMERO DEL MENU SENZA LETTURE (decisioni dell'utente del 13/10/2026;
  // chiusura del giro, 14/10/2026). Il menu accanto a «To-Do List» dice il «Da
  // fare» e lo rilegge uscendo da qui e ogni cinque minuti: ogni volta che
  // l'elenco cambia (letto, un'attivita' aggiunta, chiusa, riaperta, eliminata)
  // la pagina gli manda il numero con EVENTO_TODO, e il menu cambia subito.
  // Prima della prima lettura, o con l'elenco tagliato a 500, non manda niente.
  useEffect(() => {
    if (!elencoIntero || typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
    window.dispatchEvent(new CustomEvent(EVENTO_TODO, { detail: { da_fare: conteggiAttivita(todos).da_fare } }));
  }, [todos, elencoIntero]);

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
        // il giorno italiano: toISOString e' UTC e fra mezzanotte e l'una (le due
        // d'estate) scriveva il giorno prima (13/10/2026)
        data_ricezione: oggiRoma(),
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

  // Il cambio di stato a mano (la spunta, o la targhetta che lo fa avanzare) lo
  // fa solo l'amministratore. Scrive lo stato e, quando l'attivita' diventa
  // completata, il giorno italiano della spunta (`completata_il`), che la sezione
  // dei completati mostra e su cui ordina; riaprendola il giorno si toglie e
  // l'attivita' torna fra i da fare (campiCambioStato, src/lib/todoSezioni.js).
  // La nota di una chiusura fatta dal gestionale resta scritta (non si cancella
  // niente), e resta anche il segno chiusa_dal_gestionale, cosi' un'attivita'
  // riaperta a mano non viene richiusa al controllo dopo - a decidere e' chi lavora.
  const cambiaStato = async (todo, next) => {
    if (!isAdmin) return;
    setErrore('');
    try {
      await base44.entities.Todo.update(todo.id, campiCambioStato(todo, next, oggiRoma()));
      load();
    } catch (e) {
      console.error(e);
      setErrore(`«${todo.titolo || 'Attività'}» non è cambiata: ${(e && e.message) || String(e)}`);
    }
  };
  const toggleStato = (todo) => cambiaStato(todo, todo.stato === 'completato' ? 'aperto' : 'completato');
  const cycleStato = (todo) => {
    const order = ['aperto', 'in_corso', 'completato'];
    return cambiaStato(todo, order[(order.indexOf(todo.stato) + 1) % order.length]);
  };

  const handleDelete = async (todo) => {
    if (!confirm(`Eliminare "${todo.titolo}"?`)) return;
    try {
      await base44.entities.Todo.delete(todo.id);
      load();
    } catch (e) { console.error(e); }
  };

  // Solo i da fare: aperte e in corso. Le completate hanno il loro numero sulla
  // loro sezione.
  const counts = conteggiAttivita(todos);

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
        Il controllo si rifà a ogni caricamento delle primarie e ogni volta che apri questa pagina. Un&apos;attività completata,
        a mano o da sola, esce dall&apos;elenco e passa fra i <strong>completati</strong>, in fondo alla pagina; se la riapri torna qui.
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
            {esitoOrdini.chiuse.length === 1 ? ' La trovi fra i completati.' : ' Le trovi fra i completati.'}
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

      {/* I filtri dei da fare, coi loro numeri. */}
      <div className="flex flex-wrap gap-2">
        {FILTRI.map(([k, nome, chiave]) => (
          <button key={k} onClick={() => setFilterStato(k)} className={`px-3 py-1.5 rounded-md text-sm border ${filterStato === k ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>{nome} ({counts[chiave]})</button>
        ))}
      </div>

      {errore && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{errore}</p>}

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
        <ElencoAttivita
          todos={todos}
          filtro={filterStato}
          isAdmin={isAdmin}
          onSpunta={toggleStato}
          onCiclo={cycleStato}
          onElimina={handleDelete}
          onSalvaOrdine={salvaOrdine}
        />
      )}
      </>)}
    </div>
  );
}
