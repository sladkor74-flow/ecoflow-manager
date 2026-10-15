import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Plus, CheckSquare, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { usePermessi } from '@/lib/permessi';
import { oggiRoma } from '@/lib/giornoItaliano';
import { conteggiAttivita, dividiAttivita, campiCambioStato, campiModificaAttivita, campiOrdiniNuovi, notaOrdiniNuovi, valoriDelModulo, eCompletata, eCancellata, EVENTO_TODO } from '@/lib/todoSezioni';
import { ordiniAttivita } from '@/lib/todoOrdini';
import { scriviAnnotazioni, accodaAnnotazione } from '@/lib/annotazioni';
import { BannerSolaLettura } from '@/components/shared/SolaLettura';
import RichiesteEct from '@/components/todo/RichiesteEct';
import ElencoAttivita from '@/components/todo/ElencoAttivita';
import ModuloAttivita, { MODULO_VUOTO } from '@/components/todo/ModuloAttivita';
import AttivitaCancellate from '@/components/todo/AttivitaCancellate';
import { ScrittureTodo } from '@/components/todo/scrittureTodo';

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
  const { isAdmin, user } = usePermessi();
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterStato, setFilterStato] = useState('tutti');
  // L'attivita' da fare che si sta modificando (il suo id): il modulo, gia'
  // compilato, prende il posto della sua riga (15/10/2026).
  const [inModifica, setInModifica] = useState(null);
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
  // «Caricamento...» al posto dell'elenco solo alla PRIMA lettura (revisione del
  // 15/10/2026). Le riletture - una spunta, un'attivita' eliminata o aggiunta,
  // il controllo degli ordini che chiude qualcosa - lasciano l'elenco al suo
  // posto: dentro ci sono il modulo di una modifica e i campi delle annotazioni,
  // e togliendolo quello che l'amministratore stava scrivendo spariva senza un
  // avviso (il modulo rinasceva coi valori salvati).
  const [letto, setLetto] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Todo.list('-created_date', 500);
      setTodos(data);
      setElencoIntero(data.length < 500);
    } catch (e) { console.error(e); }
    setLoading(false);
    setLetto(true);
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
  // ordine risulta terminato, e dal 14/10/2026 passa da sola fra le cancellate
  // quando il portale lo da' cancellato (in tutti e due i casi col passaggio
  // visto: uno gia' chiuso quando l'attivita' compare non la chiude, e cosi' una
  // appena scritta non sparisce al controllo subito dopo): il controllo gira a ogni caricamento delle primarie
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

  // Il modulo (ModuloAttivita) e' lo stesso per la creazione e per la modifica:
  // un salvataggio che non riesce lo dice lui, sotto i pulsanti, e resta compilato.
  const handleAdd = async (valori) => {
    if (!isAdmin || !String(valori.titolo || '').trim()) return;
    await base44.entities.Todo.create({
      ...valori,
      stato: 'aperto',
      // il giorno italiano: toISOString e' UTC e fra mezzanotte e l'una (le due
      // d'estate) scriveva il giorno prima (13/10/2026)
      data_ricezione: oggiRoma(),
    });
    setShowForm(false);
    load();
    // L'ordine scritto adesso puo' essere gia' terminato: si controlla subito,
    // invece di aspettare il prossimo caricamento.
    controllaOrdini();
  };

  // LA MODIFICA DI UN'ATTIVITA' DA FARE (15/10/2026). Richiesta dell'utente,
  // testuale: «nella to-do list permetti la modifica delle richieste aperte per
  // successive integrazioni e\o annotazioni». Solo l'amministratore, solo su
  // un'attivita' aperta o in corso (una completata o cancellata si riapre prima),
  // e si scrivono solo i campi cambiati (campiModificaAttivita): il segno e la
  // nota di una chiusura del gestionale, il giorno della spunta e le annotazioni
  // non passano da qui. Todo non e' fra gli archivi dei numeri che fanno i conti
  // (CAMPI_TRACCIATI): la scrittura e' quella dell'archivio. Cambiati gli ordini
  // si rifa' subito il controllo, come alla creazione: un ordine gia' terminato o
  // cancellato quando lo aggiungi non chiude niente, e la riga lo dice.
  // «Da fare» e' quello che dice l'elenco (dividiAttivita): anche una vecchia
  // attivita' senza lo stato salvato, che la riga mostra come aperta.
  const apriModifica = (todo) => {
    if (!isAdmin || !todo || eCompletata(todo) || eCancellata(todo)) return;
    setShowForm(false);
    setInModifica(todo.id);
  };
  const salvaModifica = async (todo, valori) => {
    if (!isAdmin) return;
    const campi = campiModificaAttivita(todo, valori, ordiniAttivita);
    if (!campi) throw new Error('il titolo è obbligatorio');
    if (Object.keys(campi).length) await scriviAttivita(todo, campi);
    setInModifica(null);
    if (!Object.keys(campi).length) return;
    await load();
    if ('riferimento_ordine' in campi) await controllaOrdini();
  };

  // Chi e' collegato, per le righe che si accodano: l'email dei permessi, o
  // quella del profilo se la pagina non l'ha ancora.
  const chiScrive = useCallback(async () => {
    const io = user && user.email ? user : await base44.auth.me().catch(() => null);
    return (io && io.email) || '';
  }, [user]);

  // LA SCRITTURA DI UN'ATTIVITA' DA FARE, dalla modifica e dalla casella degli
  // ordini. Ordini diversi su un'attivita' che il gestionale aveva chiuso e che
  // e' stata riaperta tolgono il segno di quella chiusura (chiusa_dal_gestionale:
  // false, campiOrdiniNuovi: revisione del 15/10/2026), cosi' si guardano come su
  // un'attivita' nuova; la chiusura di prima si copia in un'annotazione, con la
  // stessa scrittura, perche' la sua nota (chiusura_nota) la prossima chiusura
  // del gestionale la riscriverebbe. La lettura in piu' (l'elenco delle
  // annotazioni, riletto) c'e' solo in quel caso.
  const scriviAttivita = async (todo, campi) => {
    if (campi.chiusa_dal_gestionale !== false) return base44.entities.Todo.update(todo.id, campi);
    const chi = await chiScrive();
    const testo = notaOrdiniNuovi(todo, campi.riferimento_ordine, ordiniAttivita);
    return scriviAnnotazioni(base44.entities.Todo, todo.id, (prima) => accodaAnnotazione(prima, testo, chi), campi);
  };

  // CHI SCRIVE LE ANNOTAZIONI E LA NOTA INTERNA (15/10/2026), per le righe delle
  // due schede (scrittureTodo.js): solo l'amministratore. Le annotazioni si
  // accodano sul record riletto appena prima (scriviAnnotazioni), con l'email di
  // chi e' collegato; la nota interna di una richiesta ECT si scrive com'e'.
  // Todo e RichiestaEct non sono archivi dei numeri che fanno i conti
  // (CAMPI_TRACCIATI): niente storico delle modifiche, la storia e' l'elenco stesso.
  const scritture = useMemo(() => (!isAdmin ? null : {
    annota: async (archivio, id, cambia) => {
      const chi = await chiScrive();
      const gestore = archivio === 'RichiestaEct' ? base44.entities.RichiestaEct : base44.entities.Todo;
      return scriviAnnotazioni(gestore, id, (prima) => cambia(prima, chi));
    },
    notaInterna: (id, testo) => base44.entities.RichiestaEct.update(id, { note_interne: testo }),
  }), [isAdmin, chiScrive]);

  // Il modulo gia' compilato al posto della riga che si sta modificando. Sa se il
  // gestionale l'aveva gia' chiusa una volta: lo dice, con che cosa succede
  // cambiando gli ordini.
  const moduloDi = (todo) => (inModifica && todo.id === inModifica ? (
    <ModuloAttivita key={`modifica-${todo.id}`} modifica chiusaDalGestionale={todo.chiusa_dal_gestionale === true} iniziale={valoriDelModulo(todo)} onSalva={(valori) => salvaModifica(todo, valori)} onAnnulla={() => setInModifica(null)} />
  ) : null);

  // L'ID ordine si corregge anche dopo, sull'attivita' che c'e' gia'. Appena
  // salvato si ricontrolla: se quell'ordine e' terminato l'attivita' si chiude
  // da sola senza aspettare altro. Ordini diversi su una riaperta: come dalla
  // modifica (scriviAttivita), perche' le due strade non dicano due cose diverse.
  const salvaOrdine = async (todo, ordini) => {
    try {
      await scriviAttivita(todo, { riferimento_ordine: ordini, ...campiOrdiniNuovi(todo, ordini, ordiniAttivita) });
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
  // Una cancellata si riapre e basta: torna fra i da fare, e il segno
  // chiusa_dal_gestionale che resta le evita di essere ricancellata (14/10/2026).
  // La spunta non serve qui: farebbe di una cancellata una completata.
  const riapri = (todo) => cambiaStato(todo, 'aperto');
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

  // Solo i da fare: aperte e in corso. Le completate e le cancellate hanno il
  // loro numero sulla loro sezione.
  const counts = conteggiAttivita(todos);
  const { cancellati } = dividiAttivita(todos);

  return (
    <ScrittureTodo.Provider value={scritture}>
    <div className="p-4 lg:p-8 max-w-[1200px] mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold flex items-center gap-2"><CheckSquare className="w-7 h-7 text-primary" /> To-Do List</h1>
          <p className="text-muted-foreground mt-1">Attività, solleciti e pratiche con scadenze, e le richieste di ritiro che il consorzio manda per email.</p>
        </div>
        {isAdmin && sezione === 'attivita' && (
          <button onClick={() => { setInModifica(null); setShowForm(!showForm); }} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
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
        l&apos;attività — un sollecito, una pratica, una fattura — quello nessuno l&apos;ha ancora fatto. Allo stesso modo, se il
        portale dà <strong>cancellati</strong> gli ordini che l&apos;attività aspettava, lei passa da sola fra i <strong>cancellati</strong>,
        col motivo e il giorno in cui il gestionale l&apos;ha visto: non c&apos;è niente da decidere qui. Se alcuni ordini sono terminati e
        gli altri cancellati si chiude come evasa in parte. Un ordine ancora assegnato o «eseguito» la tiene aperta. Se invece
        l&apos;ordine era già cancellato quando l&apos;hai scritta, l&apos;attività resta qui, perché parla d&apos;altro (contestare la
        cancellazione, rifare l&apos;ordine), e la riga te lo dice.
        Il controllo si rifà a ogni caricamento delle primarie e ogni volta che apri questa pagina. Un&apos;attività completata,
        a mano o da sola, esce dall&apos;elenco e passa fra i <strong>completati</strong>, in fondo alla pagina; se la riapri torna qui.
        Un&apos;attività da fare si corregge con <strong>Modifica</strong> (titolo, descrizione, categoria, priorità, scadenza e
        ordini), e sotto ognuna puoi <strong>aggiungere un&apos;annotazione</strong> — un sollecito fatto, una risposta ricevuta,
        un&apos;integrazione — col giorno, l&apos;ora e chi l&apos;ha scritta: le annotazioni si accodano, restano anche quando
        l&apos;attività si chiude e si leggono fra i completati e i cancellati. Un&apos;attività che il gestionale aveva chiuso e che
        hai riaperto, con gli stessi ordini non si richiude; se ci scrivi ordini diversi li guarda da adesso come su
        un&apos;attività nuova, e la chiusura di prima resta scritta fra le annotazioni.
      </p>

      {/* Che cosa ha fatto il controllo degli ordini appena aperta la pagina. */}
      {esitoOrdini && esitoOrdini.chiuse?.length > 0 && (
        <div className="flex items-start gap-2 text-sm border border-green-200 bg-green-50 text-green-800 rounded-lg px-3 py-2">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            {esitoOrdini.chiuse.length === 1
              ? "Un'attività si è chiusa da sola: "
              : `${esitoOrdini.chiuse.length} attività si sono chiuse da sole: `}
            {esitoOrdini.chiuse.map(x => `${x.titolo} (${x.ordini}${x.ritiro ? `, ritiro del ${gg(x.ritiro)}` : ''}${x.come === 'in_parte' ? ', evasa in parte: qualche ordine risulta cancellato a portale' : ''})`).join('; ')}.
            {esitoOrdini.chiuse.length === 1 ? ' La trovi fra i completati.' : ' Le trovi fra i completati.'}
          </span>
        </div>
      )}
      {/* Le attivita' passate da sole fra le cancellate: il portale ha cancellato i
          loro ordini (richiesta dell'utente del 14/10/2026). Non e' un allarme:
          e' quello che e' successo, e dove trovarle. */}
      {esitoOrdini && esitoOrdini.cancellate?.length > 0 && (
        <div className="flex items-start gap-2 text-sm border border-slate-200 bg-slate-50 text-slate-800 rounded-lg px-3 py-2">
          <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            {esitoOrdini.cancellate.length === 1
              ? "Un'attività è passata da sola fra i cancellati, il portale dà i suoi ordini cancellati: "
              : `${esitoOrdini.cancellate.length} attività sono passate da sole fra i cancellati, il portale dà i loro ordini cancellati: `}
            {esitoOrdini.cancellate.map(x => `${x.titolo} (${x.ordini})`).join('; ')}.
            {esitoOrdini.cancellate.length === 1 ? ' La trovi in fondo alla pagina.' : ' Le trovi in fondo alla pagina.'}
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
        <ModuloAttivita iniziale={MODULO_VUOTO} onSalva={handleAdd} onAnnulla={() => setShowForm(false)} />
      )}

      {loading && !letto ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Caricamento...</div>
      ) : (
        <div className="space-y-4" aria-busy={loading}>
          {/* Una rilettura non toglie l'elenco: lo dice e basta. */}
          {loading && <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Aggiorno l&apos;elenco…</p>}
          <ElencoAttivita
            todos={todos}
            filtro={filterStato}
            isAdmin={isAdmin}
            onSpunta={toggleStato}
            onCiclo={cycleStato}
            onElimina={handleDelete}
            onSalvaOrdine={salvaOrdine}
            onModifica={apriModifica}
            modificaDi={moduloDi}
          />
          {/* Sotto i completati, le cancellate: i loro ordini il portale li ha
              cancellati, e ci passano da sole (14/10/2026). */}
          <AttivitaCancellate todos={cancellati} isAdmin={isAdmin} onRiapri={riapri} onElimina={handleDelete} />
        </div>
      )}
      </>)}
    </div>
    </ScrittureTodo.Provider>
  );
}
