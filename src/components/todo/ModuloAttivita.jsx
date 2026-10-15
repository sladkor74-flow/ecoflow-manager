import React, { useState } from 'react';
import { Loader2, Plus, Save } from 'lucide-react';
import { PRIORITA } from '@/components/todo/ElencoAttivita';

// IL MODULO DI UN'ATTIVITA' DELLA TO-DO LIST: quello del «Nuovo To-Do» e, dal
// 15/10/2026, lo stesso gia' compilato per modificarne una ancora da fare
// (richiesta dell'utente, testuale: «nella to-do list permetti la modifica delle
// richieste aperte per successive integrazioni e\o annotazioni»). Titolo,
// descrizione, categoria, priorita', scadenza e ordini da completare; chi lo
// usa decide che cosa salvare (TodoPage.jsx: la creazione, o i soli campi
// cambiati con campiModificaAttivita di src/lib/todoSezioni.js).
//
// Lo disegna la pagina solo all'amministratore. Un salvataggio che non riesce
// si dice qui, sotto i pulsanti, e il modulo resta compilato. Niente larghezze
// fisse: a 375 px i campi vanno uno sotto l'altro.

export const MODULO_VUOTO = { titolo: '', descrizione: '', categoria: '', priorita: 'media', data_scadenza: '', riferimento_ordine: '' };

const messaggioDi = (e) => (e && e.response && e.response.data && e.response.data.error) || (e && e.message) || String(e);

/**
 * `iniziale`: i valori con cui si apre; `modifica`: vero sul modulo di
 * un'attivita' che c'e' gia' (cambiano intestazione, pulsante e spiegazione
 * degli ordini); `chiusaDalGestionale`: vero se il gestionale l'aveva gia'
 * chiusa una volta e l'attivita' e' stata riaperta (lo si dice: con gli stessi
 * ordini non si richiude); `onSalva(valori)`: salva, e se non riesce lancia
 * l'errore che il modulo mostra; `onAnnulla`: lo chiude senza salvare.
 */
export default function ModuloAttivita({ iniziale = MODULO_VUOTO, modifica = false, chiusaDalGestionale = false, onSalva, onAnnulla }) {
  const [form, setForm] = useState(() => ({ ...MODULO_VUOTO, ...(iniziale || {}) }));
  const [occupato, setOccupato] = useState(false);
  const [errore, setErrore] = useState('');
  const campo = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const salva = async () => {
    if (!form.titolo.trim() || occupato) return;
    setOccupato(true);
    setErrore('');
    try {
      await onSalva(form);
    } catch (e) {
      setErrore(`${modifica ? 'Le modifiche non sono state salvate' : 'L’attività non è stata aggiunta'}: ${messaggioDi(e)}`);
    } finally {
      setOccupato(false);
    }
  };

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-muted/30" data-modulo={modifica ? 'modifica' : 'nuovo'}>
      <h3 className="font-heading font-semibold">{modifica ? 'Modifica l’attività' : 'Nuovo To-Do'}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="md:col-span-2">
          <label className="text-xs font-medium">Titolo *</label>
          <input value={form.titolo} onChange={campo('titolo')} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="es. Sollecito Ecotyre ordine XYZ" />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-medium">Descrizione</label>
          <textarea value={form.descrizione} onChange={campo('descrizione')} rows={2} className="w-full border rounded-md px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium">Categoria</label>
          <input value={form.categoria} onChange={campo('categoria')} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="es. Comunicazione consorzio" />
        </div>
        <div>
          <label className="text-xs font-medium">Priorità</label>
          <select value={form.priorita} onChange={campo('priorita')} className="w-full border rounded-md px-3 py-2 text-sm">
            {Object.entries(PRIORITA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium">Data Scadenza</label>
          <input type="date" value={form.data_scadenza} onChange={campo('data_scadenza')} className="w-full border rounded-md px-3 py-2 text-sm" />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-medium">ID ordine da completare</label>
          <input
            value={form.riferimento_ordine}
            onChange={campo('riferimento_ordine')}
            className="w-full border rounded-md px-3 py-2 text-sm font-mono"
            placeholder="ET26012345, ET26012346"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Quando l&apos;ordine passa da assegnato a terminato il gestionale segna l&apos;attività come completata da sé,
            con la data della fine trasporto. Puoi metterne più di uno separati da virgola: si chiude quando sono terminati tutti.
            Se il portale cancella gli ordini l&apos;attività passa da sola fra i cancellati, col motivo; se alcuni sono
            terminati e gli altri cancellati si chiude come evasa in parte. Un ordine già terminato o già cancellato adesso non
            chiude niente: il passaggio si conta da quando l&apos;attività c&apos;è.
            {/* In modifica (revisione del 15/10/2026): che cosa succede cambiando
                gli ordini, e - su una riaperta dopo una chiusura del gestionale -
                che con gli stessi ordini non si richiude da sola. Prima il modulo
                prometteva «come per un'attivita' nuova» anche li', e non era vero:
                adesso gli ordini diversi lo rendono vero (campiOrdiniNuovi,
                src/lib/todoSezioni.js), e gli stessi lo dicono. */}
            {modifica && ' Se scrivi ordini diversi il gestionale li guarda da quando salvi, come su un’attività nuova: se uno era già terminato o cancellato non chiude niente, e la riga te lo dice.'}
            {modifica && chiusaDalGestionale && ' Questa attività il gestionale l’aveva già chiusa una volta e l’hai riaperta: con gli stessi ordini non la richiude, la spunta la metti tu; con ordini diversi torna a chiuderla da sé, e la chiusura di prima resta scritta fra le annotazioni.'}
          </p>
        </div>
      </div>
      {modifica && (
        <p className="text-xs text-muted-foreground">
          Si salvano solo i campi che cambi. Le annotazioni non si toccano da qui: si aggiungono sotto l’attività, e restano.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button onClick={salva} disabled={!form.titolo.trim() || occupato} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
          {occupato ? <Loader2 className="w-4 h-4 animate-spin" /> : modifica ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {modifica ? 'Salva le modifiche' : 'Aggiungi'}
        </button>
        <button onClick={onAnnulla} disabled={occupato} className="px-4 py-2 text-sm btn-secondario">Annulla</button>
      </div>
      {errore && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 break-words">{errore}</p>}
    </div>
  );
}
