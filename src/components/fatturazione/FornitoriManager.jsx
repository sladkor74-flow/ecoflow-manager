import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { fetchAllClient } from '@/lib/fetchAllClient';
import { notaTraccia } from '@/lib/scriviConTraccia';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2, Power, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import StoricoModifiche from '@/components/shared/StoricoModifiche';

// LA SCHEDA DEL FORNITORE (decisioni dell'utente del 13/10/2026). Prima qui si
// poteva solo aggiungere un fornitore (nome, tipo, partita IVA, regione) e i
// recapiti non si scrivevano da nessuna parte: i contratti cercavano in
// anagrafica cellulare, pec e referente (RECAPITI_DALL_ANAGRAFICA in
// segnapostiContratto) e non li trovavano mai, quindi venivano solo dal
// contratto dell'anno prima o restavano da scrivere. Ora la stessa scheda serve
// per aggiungere e per modificare, con i recapiti che il contratto legge:
// telefono, cellulare, email, pec e referente. Cellulare, pec e referente
// passano dallo storico delle modifiche (CAMPI_TRACCIATI).
const CAMPI_SCHEDA = ['ragione_sociale', 'tipo', 'piva', 'regione', 'telefono', 'cellulare', 'email', 'pec', 'referente'];
const VUOTA = { ragione_sociale: '', tipo: 'trasportatore', piva: '', regione: '', telefono: '', cellulare: '', email: '', pec: '', referente: '' };
const testo = (v) => String(v ?? '').trim();

/** La scheda riempita col record, o vuota per un fornitore nuovo. */
export function schedaDi(record) {
  if (!record) return { ...VUOTA };
  return Object.fromEntries(CAMPI_SCHEDA.map(c => [c, c === 'tipo' ? (record.tipo || 'altro') : testo(record[c])]));
}

/**
 * Che cosa scrivere: per un fornitore nuovo i campi scritti, per una modifica
 * solo quelli cambiati. Cosi' una modifica del solo nome non rilegge il record
 * per lo storico, e un campo che un altro ha cambiato nel frattempo non torna
 * indietro. Un campo svuotato si scrive null: un recapito tolto non e' un
 * recapito vuoto da tenere.
 */
export function datiDaScrivere(record, scheda) {
  const dati = {};
  for (const c of CAMPI_SCHEDA) {
    const nuovo = testo(scheda[c]);
    if (!record) { if (nuovo) dati[c] = nuovo; continue; }
    if (nuovo !== testo(c === 'tipo' ? (record.tipo || 'altro') : record[c])) dati[c] = nuovo || null;
  }
  return dati;
}

/**
 * Che cosa mostra la finestra quando l'eliminazione si ferma (409), o null se
 * la risposta non e' quella. Un fornitore con movimenti terminati non si
 * elimina (eliminabile: false, decisioni dell'utente del 13/10/2026): la
 * finestra propone solo di disattivarlo. Senza movimenti ma con tariffe, voci
 * o contratti si puo' eliminare lo stesso, a elenco mostrato.
 */
export function finestraDaRisposta(f, d) {
  if (!d || !d.riferimenti) return null;
  const proposta = d.riferimenti.proposta || d.proposta || 'disattiva';
  if (d.eliminabile === false || d.riferimenti.eliminabile === false) return { f, riferimenti: d.riferimenti, testo: d.error || '', eliminabile: false, proposta };
  if (d.richiede_conferma) return { f, riferimenti: d.riferimenti, testo: d.error || '', eliminabile: true, proposta };
  return null;
}

/** La finestra di chi usa il fornitore che si vuole eliminare. */
export function FinestraInUso({ inUso, onChiudi, onDisattiva, onElimina }) {
  const bloccato = !!inUso && inUso.eliminabile === false;
  const giaSpento = !!inUso && inUso.proposta === 'gia_disattivato';
  // Un fornitore gia' disattivato non ha il pulsante «Disattiva», e il testo
  // non glielo propone (revisione del 14/10/2026): dice che lo e' gia'.
  const eliminabileTesto = giaSpento
    ? 'È già disattivato: resta per i conti già fatti e non si propone nelle scelte. Eliminandolo, questi restano senza il loro fornitore: la passiva non sa più a chi fatturare e il foglio dell\'amministrazione perde il soggetto.'
    : 'Eliminandolo, questi restano senza il loro fornitore: la passiva non sa più a chi fatturare e il foglio dell\'amministrazione perde il soggetto. Disattivandolo resta per i conti già fatti e non si propone più nelle scelte.';
  return (
    <Dialog open={inUso !== null} onOpenChange={(o) => !o && onChiudi()}>
      {/* Su un telefono la finestra scorre (14/10/2026): i pulsanti restano raggiungibili. */}
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{inUso ? (bloccato ? `${inUso.f.ragione_sociale} non si può eliminare` : `${inUso.f.ragione_sociale} è ancora usato`) : ''}</DialogTitle>
        </DialogHeader>
        {inUso && (
          <div className="space-y-3 text-sm">
            <ul className="list-disc pl-5 space-y-0.5">
              {(inUso.riferimenti.elenco || []).map((r, i) => <li key={i}>{r}</li>)}
            </ul>
            <div className="bg-amber-50 border border-amber-300 rounded p-3 text-amber-800 text-xs">
              {bloccato
                ? <>I suoi movimenti terminati sono già nei conti, fatturati o da fatturare: eliminandolo resterebbero senza il loro fornitore. {giaSpento ? 'È già disattivato: resta così, per i conti già fatti.' : 'Si disattiva: resta per i conti già fatti e non si propone più nelle scelte.'}</>
                : eliminabileTesto}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onChiudi}>{bloccato && giaSpento ? 'Chiudi' : 'Annulla'}</Button>
          {inUso && !giaSpento && <Button variant="outline" onClick={onDisattiva}><Power className="w-4 h-4 mr-1" /> Disattiva</Button>}
          {inUso && !bloccato && <Button variant="destructive" onClick={onElimina}><Trash2 className="w-4 h-4 mr-1" /> Elimina comunque</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * La scheda: aggiunge (record null) o modifica un fornitore. Si salva solo da
 * gestisciAnagrafiche, che rifiuta un nome gia' presente e scrive lo storico.
 * onSalvato riceve la nota dello storico, se la traccia non si e' scritta.
 */
export function SchedaFornitore({ aperta, record, onChiudi, onSalvato }) {
  const [scheda, setScheda] = useState(() => schedaDi(record));
  const [errore, setErrore] = useState('');
  const [salva, setSalva] = useState(false);
  useEffect(() => { setScheda(schedaDi(record)); setErrore(''); }, [record, aperta]);
  const metti = (c) => (e) => setScheda(s => ({ ...s, [c]: e.target.value }));

  const conferma = async () => {
    if (!testo(scheda.ragione_sociale)) { setErrore('Il fornitore ha bisogno di una ragione sociale.'); return; }
    const dati = datiDaScrivere(record, scheda);
    if (record && !Object.keys(dati).length) { onChiudi(); return; }
    setErrore('');
    setSalva(true);
    let res;
    try {
      res = await base44.functions.invoke('gestisciAnagrafiche', record
        ? { entita: 'Fornitore', operazione: 'update', id: record.id, dati }
        : { entita: 'Fornitore', operazione: 'create', dati: { ...dati, stato: 'attivo' } });
    } catch (e) {
      // IL NOME GIA' PRESENTE SI DICE (chiusura dell'audit, 11/10/2026):
      // gestisciAnagrafiche rifiuta un fornitore il cui nome normalizzato c'e'
      // gia' («GATIM S.R.L.» e «GATIM» sono lo stesso), e il rifiuto si mostra
      // qui, a scheda aperta.
      setErrore(e?.response?.data?.error || e?.message || 'Il fornitore non si è potuto salvare.');
      setSalva(false);
      return;
    }
    setSalva(false);
    onSalvato(notaTraccia(res && res.data) || '');
  };

  const campo = (c, etichetta, segnaposto = '') => (
    <label className="space-y-1 text-xs">
      <span className="text-muted-foreground">{etichetta}</span>
      <Input value={scheda[c]} placeholder={segnaposto} onChange={metti(c)} />
    </label>
  );

  return (
    <Dialog open={aperta} onOpenChange={(o) => !o && onChiudi()}>
      {/* SU UN TELEFONO LA SCHEDA SCORRE (revisione del 14/10/2026). A 375 px le
          nove caselle stanno una per riga e la scheda supera l'altezza dello
          schermo: senza un'altezza massima Salva e Annulla uscivano dallo
          schermo e non si raggiungevano. Come le altre finestre di Fatturazione. */}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{record ? `Scheda di ${record.ragione_sociale}` : 'Nuovo fornitore'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {campo('ragione_sociale', 'Ragione sociale')}
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">Tipo</span>
              <Select value={scheda.tipo} onValueChange={v => setScheda(s => ({ ...s, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="trasportatore">Trasportatore</SelectItem>
                  <SelectItem value="impianto">Impianto</SelectItem>
                  <SelectItem value="stoccaggio">Stoccaggio</SelectItem>
                  <SelectItem value="altro">Altro</SelectItem>
                </SelectContent>
              </Select>
            </label>
            {campo('piva', 'Partita IVA')}
            {campo('regione', 'Regione')}
          </div>
          {/* LA RAGIONE SOCIALE DI UN FORNITORE GIA' USATO NON CAMBIA (revisione
              del 14/10/2026): movimenti, tariffe e contratti lo cercano per
              nome. gestisciAnagrafiche rifiuta la rinomina con l'elenco di chi
              lo usa, e il rifiuto si legge in fondo, a scheda aperta. */}
          {record && (
            <p className="text-xs text-muted-foreground">La ragione sociale resta quella dei formulari del portale: di un fornitore già usato si corregge solo la scrittura (maiuscole, punti, S.R.L.). Se è cambiata davvero, si aggiunge il fornitore col nome nuovo e questo si disattiva.</p>
          )}
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recapiti per i contratti</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {campo('referente', 'Referente', 'nome e cognome')}
              {campo('cellulare', 'Cellulare')}
              {campo('telefono', 'Telefono')}
              {campo('email', 'Email')}
              {campo('pec', 'PEC')}
            </div>
            <p className="text-xs text-muted-foreground">I contratti dell&apos;anno li prendono da qui: un recapito che manca resta da scrivere nel contratto, non si deduce da un altro.</p>
          </div>
          {errore && <div className="text-sm text-destructive">{errore}</div>}
          {record && record.id && <StoricoModifiche entita="Fornitore" recordId={record.id} aggiornato={record.updated_date || ''} />}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onChiudi}>Annulla</Button>
          <Button onClick={conferma} disabled={salva}>{salva && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Salva</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function FornitoriManager() {
  const [fornitori, setFornitori] = useState([]);
  const [loading, setLoading] = useState(true);
  // La scheda aperta: { record } per modificare, { record: null } per aggiungere.
  const [aperta, setAperta] = useState(null);
  const [avvisoStorico, setAvvisoStorico] = useState('');

  // Tutta l'anagrafica, non le prime 500 righe (chiusura dell'audit, 11/10/2026).
  const load = async () => {
    setLoading(true);
    try { setFornitori(await fetchAllClient(base44.entities.Fornitore, null, '-created_date')); } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const salvata = (nota) => { setAperta(null); setAvvisoStorico(nota || ''); load(); };

  // PRIMA DI ELIMINARE, CHI LO USA (audit del 20/09, alta A88; corretta il
  // 12/10/2026). Qui si chiedeva solo «Eliminare X?» e il fornitore spariva con
  // le sue tariffe, le voci della passiva e i movimenti che lo nominano senza
  // piu' un soggetto. Ora gestisciAnagrafiche conta i riferimenti e, se ce ne
  // sono, non elimina: risponde con l'elenco. Con movimenti terminati, che sono
  // gia' nei conti, il fornitore non si elimina piu' nemmeno con la conferma, e
  // la finestra propone solo di disattivarlo (decisioni dell'utente del
  // 13/10/2026: niente «elimina comunque»). Senza movimenti si puo' ancora
  // eliminarlo, con una conferma che l'elenco l'ha mostrato. Anche un errore si
  // dice: prima non si vedeva.
  const [inUso, setInUso] = useState(null);
  const [erroreAzione, setErroreAzione] = useState('');
  const datiErrore = (e) => e?.response?.data || e?.data || {};

  const toggle = async (f) => {
    setErroreAzione('');
    try {
      await base44.functions.invoke('gestisciAnagrafiche', { entita: 'Fornitore', operazione: 'update', id: f.id, dati: { stato: f.stato === 'attivo' ? 'non_attivo' : 'attivo' } });
    } catch (e) {
      setErroreAzione(datiErrore(e).error || e?.message || 'Lo stato del fornitore non si è potuto cambiare.');
    }
    load();
  };

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
      const finestra = conferma ? null : finestraDaRisposta(f, d);
      if (finestra) { setInUso(finestra); return; }
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
        <Button size="sm" onClick={() => setAperta({ record: null })}><Plus className="w-4 h-4 mr-1" /> Aggiungi</Button>
      </div>
      {avvisoStorico && <div className="text-xs bg-amber-50 border border-amber-300 rounded p-2 text-amber-800">{avvisoStorico}</div>}
      {erroreAzione && <div className="text-sm text-destructive">{erroreAzione}</div>}
      <SchedaFornitore aperta={aperta !== null} record={aperta ? aperta.record : null} onChiudi={() => setAperta(null)} onSalvato={salvata} />
      <FinestraInUso
        inUso={inUso}
        onChiudi={() => setInUso(null)}
        onDisattiva={disattivaInUso}
        onElimina={() => inUso && inUso.eliminabile && elimina(inUso.f, true)}
      />
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted"><tr>
            <th className="text-left px-3 py-2 font-semibold">Ragione Sociale</th>
            <th className="text-left px-3 py-2 font-semibold">Tipo</th>
            <th className="text-left px-3 py-2 font-semibold">P.IVA</th>
            <th className="text-left px-3 py-2 font-semibold">Regione</th>
            <th className="text-left px-3 py-2 font-semibold">Referente e recapiti</th>
            <th className="text-center px-3 py-2 font-semibold">Stato</th>
            <th className="text-right px-3 py-2 font-semibold">Azioni</th>
          </tr></thead>
          <tbody>
            {fornitori.map((f, i) => {
              const recapiti = [f.cellulare, f.pec].map(testo).filter(Boolean).join(' · ');
              return (
                <tr key={f.id} className={i % 2 ? 'bg-muted/30' : ''}>
                  <td className="px-3 py-2 font-medium">{f.ragione_sociale}</td>
                  <td className="px-3 py-2">{f.tipo}</td>
                  <td className="px-3 py-2">{f.piva || '—'}</td>
                  <td className="px-3 py-2">{f.regione || '—'}</td>
                  <td className="px-3 py-2">
                    <div>{testo(f.referente) || '—'}</div>
                    {recapiti && <div className="text-xs text-muted-foreground">{recapiti}</div>}
                  </td>
                  <td className="text-center px-3 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${f.stato === 'attivo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{f.stato}</span>
                  </td>
                  <td className="text-right px-3 py-2 whitespace-nowrap">
                    <button onClick={() => setAperta({ record: f })} className="p-1 hover:bg-muted rounded" title="Scheda del fornitore"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => toggle(f)} className="p-1 hover:bg-muted rounded" title={f.stato === 'attivo' ? 'Disattiva' : 'Riattiva'}><Power className="w-4 h-4" /></button>
                    <button onClick={() => remove(f)} className="p-1 hover:bg-red-50 rounded" title="Elimina"><Trash2 className="w-4 h-4 text-red-500" /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
