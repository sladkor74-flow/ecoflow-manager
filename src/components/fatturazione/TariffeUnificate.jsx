import React, { useState, useEffect, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { notaTraccia } from '@/lib/scriviConTraccia';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Pencil, Copy, History, CalendarX, RotateCcw, Download, Trash2 } from 'lucide-react';
import { formatNumber } from '@/lib/utils';
import { fetchAllClient } from '@/lib/fetchAllClient';
import { chiaveMatch, chiaveMatchAttiva, periodiSovrapposti } from '@/lib/conflittiTariffa';
import { tariffaNonDisattivata } from '@/lib/validitaTariffa';
import { oggiRoma } from '@/lib/giornoItaliano';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import TariffeRuoliFornitori from './TariffeRuoliFornitori';
import TariffeForm from './TariffeForm';
import TariffeStorico from './TariffeStorico';
import { surplusDellaTariffa } from '@/lib/surplus';
import SurplusSezione, { PastiglieSurplus, FasciaSurplus } from './SurplusSezione';
import { schedeSurplus, tariffeDelleSchede, haSurplus, SEZIONI_TARIFFE } from './surplusTariffe';

const PRESTAZIONI_LABEL = { RACCOLTA: 'Raccolta', TRASPORTO_SECONDARIA: 'Trasporto secondaria', TRATTAMENTO: 'Trattamento', CONFERIMENTO_STOCCAGGIO: 'Conferimento stoccaggio' };
const TIPOLOGIA_LABEL = { RETE: 'Rete', ACI: 'ACI', EXTRA_RACCOLTA: 'Extra Raccolta', TUTTE: 'RETE + ACI' };

function isArchiviata(t) {
  if (t.stato === 'non_attivo') return true;
  if (t.data_fine_validita) { const f = new Date(t.data_fine_validita); const o = new Date(); o.setHours(0,0,0,0); if (f < o) return true; }
  return false;
}
function isAperta(t) { return t.stato === 'attivo' && !t.data_fine_validita; }
// Il periodo e' ancora aperto se la tariffa non ha una data di fine o se la
// data di fine e' dopo oggi (giorno italiano): solo allora «Chiudi periodo» la
// accorcia. A una tariffa gia' chiusa - dal 01/01/2027 tutte quelle del 2026 -
// lo stesso pulsante proponeva la data di oggi, e accettandola il prezzo valeva
// anche nell'anno dopo, contro i contratti annuali senza tacito rinnovo
// (revisione del 13/10/2026).
function periodoAncoraAperto(t) {
  const al = String((t && t.data_fine_validita) || '').slice(0, 10);
  return !al || al > oggiRoma();
}
const dataIt = (v) => (v ? String(v).slice(0, 10).split('-').reverse().join('/') : '');
// La data scritta a mano: gg/mm/aaaa, come le date a video; si accetta anche
// aaaa-mm-gg. Una data che non esiste (31/02) non passa.
function leggiDataScritta(testo) {
  const v = String(testo || '').trim();
  const it = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const iso = it ? `${it[3]}-${it[2].padStart(2, '0')}-${it[1].padStart(2, '0')}` : (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : null;
}
function countRuoli(f) { return ['ruolo_raccolta','ruolo_trasporto_secondaria','ruolo_trattamento','ruolo_stoccaggio'].filter(r => f[r]).length; }
function getAmbito(t) {
  if (t.direzione === 'ATTIVA') return t.regione || 'Tutte le regioni';
  // Il prezzo unico che comprende anche il trattamento si legge nell'ambito:
  // altrimenti una differenza importante resterebbe nascosta in un flag.
  if (t.prestazione === 'RACCOLTA') {
    let a = t.provincia || t.regione || 'Tutte le zone';
    if (t.destinazione) a += ` → ${t.destinazione}`;
    if (t.comprensiva_trattamento) a += ' — prezzo unico, comprende il trattamento';
    return a;
  }
  if (t.prestazione === 'TRASPORTO_SECONDARIA') return `${t.produttore || '?'} → ${t.destinatario || '?'}`;
  return '—';
}
function normVal(v) { return String(v || '').trim().toUpperCase(); }
// LA STESSA CHIAVE DEL SERVER (chiusura dell'audit, 11/10/2026): le regole sono
// quelle di gestisciAnagrafiche, nello specchio src/lib/conflittiTariffa.js.
// Prima qui si confrontava fornitore_id, e due prezzi di Gatim per lo stesso
// periodo - uno su «GATIM», uno su «GATIM S.R.L.» - non risultavano doppi,
// mentre la passiva, che sceglie per nome normalizzato, ne pagava uno a caso.
// servizio_ecotyre fa parte della chiave delle attive, come nel server: senza,
// una tariffa legata a una dicitura veniva segnata «Duplicata» di quella che
// vale per tutte, che e' una spiegazione falsa.
function chiaviTariffaCoincidenti(a, b) {
  const aAttiva = normVal(a.direzione) === 'ATTIVA';
  const bAttiva = normVal(b.direzione) === 'ATTIVA';
  if (aAttiva !== bAttiva) return false;
  return aAttiva ? chiaveMatchAttiva(a, b) : chiaveMatch(a, b);
}
function calcolaDuplicate(tariffe) {
  // le disattivate no: non valgono mai (validitaTariffa); lo stato vuoto e' 'attivo'
  const attive = tariffe.filter(tariffaNonDisattivata);
  const dupIds = new Set();
  for (let i = 0; i < attive.length; i++) {
    for (let j = i + 1; j < attive.length; j++) {
      if (chiaviTariffaCoincidenti(attive[i], attive[j]) &&
          periodiSovrapposti(attive[i].data_inizio_validita, attive[i].data_fine_validita, attive[j].data_inizio_validita, attive[j].data_fine_validita)) {
        dupIds.add(attive[i].id);
        dupIds.add(attive[j].id);
      }
    }
  }
  return dupIds;
}

// Che cosa dice il modulo delle tariffe aperto prima che gli elenchi di province
// e destinazioni siano arrivati (13/10/2026): funziona lo stesso, e le liste si
// riempiono da sole.
const AVVISO_ELENCHI = {
  in_arrivo: { title: 'Province e destinazioni in arrivo', description: 'Il modulo funziona già: gli elenchi di province, destinazioni e stoccaggi si riempiono da soli appena letti i movimenti.' },
  non_letti: { title: 'Province e destinazioni non lette', description: 'Si rileggono adesso. Intanto il modulo funziona: gli elenchi si riempiono appena arrivano.' },
};

/**
 * Tariffe & Anagrafiche. sezione: la linguetta da aprire ('tariffe', 'surplus',
 * 'ruoli'), dal collegamento ?tab=tariffe&sezione=surplus (13/10/2026).
 */
export default function TariffeUnificate({ sezione = null }) {
  const [tab, setTab] = useState(SEZIONI_TARIFFE.includes(sezione) ? sezione : 'tariffe');
  // Un collegamento nuovo con la scheda gia' aperta.
  useEffect(() => { if (SEZIONI_TARIFFE.includes(sezione)) setTab(sezione); }, [sezione]);
  const { toast } = useToast();
  const [tariffe, setTariffe] = useState([]);
  const [fornitori, setFornitori] = useState([]);
  const [province, setProvince] = useState([]);
  const [destRaccolta, setDestRaccolta] = useState([]);
  const [stoccaggi, setStoccaggi] = useState([]);
  const [destSecondaria, setDestSecondaria] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ direzione: '', tipologia: '', prestazione: '', fornitore_id: '', showArchived: false, conSurplus: false });
  // I surplus sulle tariffe (il Fuel Surcharge, 13/10/2026): null finche' non
  // si sono letti, o se la lettura non e' riuscita. Allora la colonna dice «non
  // letto» e non «—», che vorrebbe dire «nessun surplus».
  const [surplus, setSurplus] = useState(null);
  const [erroreSurplus, setErroreSurplus] = useState('');
  // «Scrivi il Fuel Surcharge» dalla fascia: la scheda Surplus apre il modulo.
  const [richiestaSurplus, setRichiestaSurplus] = useState(null);
  // Gli elenchi del modulo delle tariffe: 'in_arrivo', 'pronti' o 'non_letti'.
  const [elenchi, setElenchi] = useState('in_arrivo');
  const elenchiChiesti = useRef(false);
  const [formState, setFormState] = useState({ open: false, editing: null, duplicating: null, excludePrestazione: '' });
  const [storico, setStorico] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [import2026, setImport2026] = useState(null);
  const [importAttive2026, setImportAttive2026] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showOnlyDup, setShowOnlyDup] = useState(false);
  const [showOnlyNoPrest, setShowOnlyNoPrest] = useState(false);

  // I surplus si leggono tutti e il disattivato si toglie in memoria, come per
  // le tariffe (AGENTS.md, «Quando una tariffa vale»): mai con { stato: 'attivo' }.
  // Dopo una scrittura si rileggono solo loro, non le tariffe e i movimenti.
  const caricaSurplus = async () => {
    try {
      setSurplus(await fetchAllClient(base44.entities.SurplusTariffa));
      setErroreSurplus('');
    } catch (e) {
      setSurplus(null);
      setErroreSurplus(e?.response?.data?.error || e?.message || 'lettura non riuscita');
    }
  };
  // LA SCHEDA SI MOSTRA SUBITO (13/10/2026). Prima la scheda aspettava anche
  // tutte le primarie (10.487 l'11/10) e le secondarie, lette solo per gli
  // elenchi di province, destinazioni e stoccaggi del modulo delle tariffe: circa
  // 14 secondi di rotella a ogni apertura, e dopo la pubblicazione l'utente non
  // ha trovato la sezione dei surplus. Ora la scheda aspetta tariffe, fornitori e
  // surplus; gli elenchi si leggono dopo, una volta per apertura, senza tenere la
  // pagina in attesa, e dopo un salvataggio non si rileggono (non cambiano con
  // le tariffe): le letture sono le stesse di prima, e meno dopo ogni scrittura.
  const load = async () => {
    setLoading(true);
    // Tariffe e surplus sono due letture indipendenti (13/10/2026): se i
    // surplus non si leggono, le tariffe restano a video e la scheda lo dice.
    const [esito] = await Promise.allSettled([
      Promise.all([
        fetchAllClient(base44.entities.Tariffa),
        base44.entities.Fornitore.filter({ stato: 'attivo' }),
      ]),
      caricaSurplus(),
    ]);
    // Le tariffe non lette lasciano la tabella com'era.
    if (esito.status === 'fulfilled') {
      const [t, f] = esito.value;
      setTariffe(t); setFornitori(f);
    }
    setLoading(false);
  };
  const caricaElenchi = async () => {
    if (elenchiChiesti.current) return;
    elenchiChiesti.current = true;
    setElenchi('in_arrivo');
    try {
      const [primarie, secondarie] = await Promise.all([
        fetchAllClient(base44.entities.PrimariaRete),
        fetchAllClient(base44.entities.Secondaria),
      ]);
      const provSet = new Set(), destRacSet = new Set(), stocSet = new Set(), destSecSet = new Set();
      for (const r of primarie) {
        const p = (r.provincia || '').trim().toUpperCase();
        if (p && p.length >= 2) provSet.add(p);
        const d = (r.destinazione || '').trim();
        if (d) destRacSet.add(d);
      }
      for (const r of secondarie) {
        const s = (r.stoccaggio || '').trim();
        if (s) stocSet.add(s);
        const d = (r.destinazione || '').trim();
        if (d) destSecSet.add(d);
      }
      setProvince(Array.from(provSet).sort());
      setDestRaccolta(Array.from(destRacSet).sort());
      setStoccaggi(Array.from(stocSet).sort());
      setDestSecondaria(Array.from(destSecSet).sort());
      setElenchi('pronti');
    } catch {
      // Si riprova alla prossima apertura del modulo: le liste restano vuote, e
      // il modulo funziona con «Tutte le province» e «Qualsiasi destinazione».
      elenchiChiesti.current = false;
      setElenchi('non_letti');
    }
  };
  useEffect(() => {
    load().then(() => caricaElenchi());
    base44.auth.me().then(u => setIsAdmin(u?.role === 'admin')).catch(() => {});
  }, []);
  // Il modulo aperto prima degli elenchi lo dice, e si riempie quando arrivano.
  const avvisaElenchi = () => {
    if (elenchi === 'pronti') return;
    if (elenchi === 'non_letti') caricaElenchi();
    toast(AVVISO_ELENCHI[elenchi] || AVVISO_ELENCHI.in_arrivo);
  };

  const handleImport2026 = async () => {
    setImport2026({ summary: null, loading: true, inserting: false, error: null });
    try {
      const res = await base44.functions.invoke('seedTariffe2026', { simula: true });
      setImport2026({ summary: res.data, loading: false, inserting: false, error: null });
    } catch (e) {
      setImport2026({ summary: null, loading: false, inserting: false, error: e?.message || 'Errore' });
    }
  };

  const confirmImport2026 = async () => {
    setImport2026(prev => ({ ...prev, inserting: true, error: null }));
    try {
      await base44.functions.invoke('seedTariffe2026', {});
      setImport2026(null);
      load();
    } catch (e) {
      setImport2026(prev => ({ ...prev, inserting: false, error: e?.message || 'Errore' }));
    }
  };

  const handleImportAttive2026 = async () => {
    setImportAttive2026({ summary: null, loading: true, inserting: false, error: null });
    try {
      const res = await base44.functions.invoke('seedTariffeAttive2026', { simula: true });
      setImportAttive2026({ summary: res.data, loading: false, inserting: false, error: null });
    } catch (e) {
      setImportAttive2026({ summary: null, loading: false, inserting: false, error: e?.message || 'Errore' });
    }
  };

  const confirmImportAttive2026 = async () => {
    setImportAttive2026(prev => ({ ...prev, inserting: true, error: null }));
    try {
      await base44.functions.invoke('seedTariffeAttive2026', {});
      setImportAttive2026(null);
      load();
    } catch (e) {
      setImportAttive2026(prev => ({ ...prev, inserting: false, error: e?.message || 'Errore' }));
    }
  };

  const duplicateIds = useMemo(() => calcolaDuplicate(tariffe), [tariffe]);
  // LA COLONNA «SURPLUS» (13/10/2026): per ogni tariffa che cosa vale oggi e che
  // cosa arriva, con surplusDellaTariffa, la stessa regola della passiva e
  // dell'attiva (stesso canale, stessa prestazione, il fornitore della tariffa
  // in elenco o «tutti»). La fascia in cima conta le tariffe da qui, cosi'
  // colonna e fascia non dicono due numeri diversi.
  const oggi = oggiRoma();
  const surplusPerTariffa = useMemo(() => {
    const m = new Map();
    if (!surplus) return m;
    for (const t of tariffe) m.set(t.id, surplusDellaTariffa(t, surplus, oggi));
    return m;
  }, [tariffe, surplus, oggi]);
  const schede = useMemo(() => schedeSurplus(surplus || [], oggi), [surplus, oggi]);
  const contiSurplus = useMemo(() => tariffeDelleSchede(tariffe, surplusPerTariffa, isArchiviata), [tariffe, surplusPerTariffa]);
  const surplusInCorso = schede.filter(s => s.stato === 'in_corso').length;
  const noPrestCount = useMemo(() => tariffe.filter(t => !t.prestazione && t.direzione !== 'ATTIVA').length, [tariffe]);

  const filtered = useMemo(() => {
    let result = tariffe.filter(t => {
      if (filters.direzione && t.direzione !== filters.direzione) return false;
      if (filters.tipologia && t.tipologia !== filters.tipologia) return false;
      if (filters.prestazione && t.prestazione !== filters.prestazione) return false;
      if (filters.fornitore_id && t.fornitore_id !== filters.fornitore_id) return false;
      if (!filters.showArchived && isArchiviata(t)) return false;
      if (showOnlyDup && !duplicateIds.has(t.id)) return false;
      if (showOnlyNoPrest && (t.prestazione || t.direzione === 'ATTIVA')) return false;
      if (filters.conSurplus && (isArchiviata(t) || !haSurplus(surplusPerTariffa.get(t.id)))) return false;
      return true;
    });
    result.sort((a, b) => {
      const f = (a.fornitore_nome || '').localeCompare(b.fornitore_nome || ''); if (f) return f;
      const p = (a.prestazione || '').localeCompare(b.prestazione || ''); if (p) return p;
      const c = (a.classe_materiale || '').localeCompare(b.classe_materiale || ''); if (c) return c;
      return new Date(b.data_inizio_validita || 0) - new Date(a.data_inizio_validita || 0);
    });
    return result;
  }, [tariffe, filters, showOnlyDup, showOnlyNoPrest, duplicateIds, surplusPerTariffa]);

  const closePeriod = async (t) => {
    // Chiudere il periodo lo accorcia, mai lo allunga (revisione del 13/10/2026):
    // a una tariffa gia' chiusa non si propone niente, e una data dopo la fine
    // che la tariffa ha gia' non si accetta. La data proposta e' oggi in Italia.
    if (!periodoAncoraAperto(t)) {
      alert(`Il periodo di questa tariffa è già chiuso: vale fino al ${dataIt(t.data_fine_validita)} e non va allungato.`);
      return;
    }
    const scritta = prompt('Inserisci la data di fine validità (gg/mm/aaaa):', dataIt(oggiRoma()));
    if (!scritta) return;
    const dataFine = leggiDataScritta(scritta);
    if (!dataFine) { alert('Data non valida: scrivila come gg/mm/aaaa.'); return; }
    const fineAttuale = String(t.data_fine_validita || '').slice(0, 10);
    if (fineAttuale && dataFine > fineAttuale) {
      alert(`Chiudere il periodo non lo allunga: la tariffa vale fino al ${dataIt(fineAttuale)}. Per cambiare le date usa «Modifica».`);
      return;
    }
    try {
      // Solo la data di fine: la tariffa resta valida per i giorni che ha
      // coperto, altrimenti i mesi gia' fatturati con quel prezzo resterebbero
      // senza prezzo. Dall'elenco sparisce lo stesso, per data di fine passata.
      const res = await base44.functions.invoke('gestisciAnagrafiche', { entita: 'Tariffa', operazione: 'update', id: t.id, dati: { data_fine_validita: dataFine }, motivo: 'periodo chiuso dall\'elenco delle tariffe' });
      const fuoriStorico = notaTraccia(res.data);
      if (fuoriStorico) alert(fuoriStorico);
      load();
    } catch (e) { alert(e?.response?.data?.error || e?.message); }
  };
  const reopenPeriod = async (t) => {
    if (!confirm('Riaprire questa tariffa? Verrà impostata come attiva senza data di fine.')) return;
    try {
      // null cancella la data di fine; con undefined la chiave spariva nel JSON
      // e il server la rifondeva dal record, cosi' «Riapri» non riapriva niente
      // e nessuno lo diceva (06/10/2026).
      const res = await base44.functions.invoke('gestisciAnagrafiche', { entita: 'Tariffa', operazione: 'update', id: t.id, dati: { data_fine_validita: null, stato: 'attivo' }, motivo: 'riaperta dall\'elenco delle tariffe' });
      const fuoriStorico = notaTraccia(res.data);
      if (fuoriStorico) alert(fuoriStorico);
      load();
    } catch (e) { alert(e?.response?.data?.error || e?.message); }
  };

  // PRIMA DI ELIMINARE, CHI LA USA (audit del 20/09, alta A88; corretta il
  // 12/10/2026). gestisciAnagrafiche conta i movimenti terminati del periodo
  // della tariffa a cui puo' dare il prezzo: se ce ne sono non elimina, e qui si
  // mostra l'elenco con «Chiudi periodo» accanto. «Elimina comunque» manda la
  // conferma, e il motivo nello storico dice che cosa c'era.
  const [inUsoTariffa, setInUsoTariffa] = useState(null);
  const chiudiDialogElimina = () => { setDeleteTarget(null); setInUsoTariffa(null); };
  const handleDelete = async (conferma = false) => {
    setDeleting(true);
    try {
      const res = await base44.functions.invoke('gestisciAnagrafiche', {
        entita: 'Tariffa', operazione: 'delete', id: deleteTarget.id, motivo: 'eliminata dall\'elenco delle tariffe',
        ...(conferma === true ? { conferma_eliminazione: true } : {}),
      });
      const fuoriStorico = notaTraccia(res.data);
      if (fuoriStorico) alert(fuoriStorico);
      chiudiDialogElimina();
      load();
    } catch (e) {
      const d = e?.response?.data || e?.data || {};
      if (conferma !== true && d.richiede_conferma && d.riferimenti) setInUsoTariffa(d.riferimenti);
      else alert(d.error || e?.message);
    }
    setDeleting(false);
  };
  const chiudiPeriodoInvece = async () => {
    const t = deleteTarget;
    chiudiDialogElimina();
    await closePeriod(t);
  };

  const openCreate = () => { avvisaElenchi(); setFormState({ open: true, editing: null, duplicating: null, excludePrestazione: '' }); };
  const openEdit = (t) => { avvisaElenchi(); setFormState({ open: true, editing: t, duplicating: null, excludePrestazione: '' }); };
  const openDuplicate = (t) => { avvisaElenchi(); setFormState({ open: true, editing: null, duplicating: t, excludePrestazione: t.prestazione }); };
  // «Scrivi il Fuel Surcharge» dalla fascia: la linguetta Surplus col modulo aperto.
  const scriviFuel = () => { setRichiestaSurplus({ cosa: 'fuel' }); setTab('surplus'); };
  const closeForm = () => setFormState({ open: false, editing: null, duplicating: null, excludePrestazione: '' });

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="tariffe">Tariffe</TabsTrigger>
          <TabsTrigger value="surplus">
            Surplus
            {/* Quanti surplus sono in corso oggi, nel colore del surplus */}
            {surplusInCorso > 0 && <span className="ml-1.5 rounded-full bg-[hsl(var(--eco-surplus)/0.14)] px-1.5 text-[10px] font-semibold leading-4 text-[hsl(var(--eco-surplus))]">{surplusInCorso}<span className="sr-only"> in corso</span></span>}
          </TabsTrigger>
          <TabsTrigger value="ruoli">Ruoli fornitori</TabsTrigger>
        </TabsList>
        <TabsContent value="tariffe" className="mt-4 space-y-3">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <p className="text-sm text-muted-foreground">Gestione unificata di tutte le tariffe per prestazione e fornitore.</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1" /> Aggiungi tariffa</Button>
              {isAdmin && (
                <Button size="sm" variant="outline" onClick={handleImport2026}>
                  <Download className="w-4 h-4 mr-1" /> Importa tariffe 2026
                </Button>
              )}
              {isAdmin && (
                <Button size="sm" variant="outline" onClick={handleImportAttive2026}>
                  <Download className="w-4 h-4 mr-1" /> Importa tariffe attive 2026
                </Button>
              )}
            </div>
          </div>
          {/* I surplus in corso e in arrivo, con le tariffe che toccano; senza, la
              fascia breve che dice da dove si scrivono (13/10/2026) */}
          <FasciaSurplus schede={schede} conti={contiSurplus} conCosti={isAdmin} letti={surplus !== null} onVai={() => setTab('surplus')} onScrivi={isAdmin ? scriviFuel : null} />
          {surplus === null && erroreSurplus && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              I surplus non si sono letti ({erroreSurplus}): la colonna Surplus non dice niente finché non si rileggono. <button type="button" onClick={caricaSurplus} className="font-medium underline">Riprova</button>
            </div>
          )}
          {/* Filtri */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            <Select value={filters.direzione} onValueChange={v => setFilters({ ...filters, direzione: v })}>
              <SelectTrigger><SelectValue placeholder="Direzione" /></SelectTrigger>
              <SelectContent><SelectItem value={null}>Tutte le direzioni</SelectItem><SelectItem value="PASSIVA">Passiva</SelectItem><SelectItem value="ATTIVA">Attiva</SelectItem></SelectContent>
            </Select>
            <Select value={filters.tipologia} onValueChange={v => setFilters({ ...filters, tipologia: v })}>
              <SelectTrigger><SelectValue placeholder="Tipologia" /></SelectTrigger>
              <SelectContent><SelectItem value={null}>Tutte le tipologie</SelectItem><SelectItem value="RETE">Rete</SelectItem><SelectItem value="ACI">ACI</SelectItem><SelectItem value="EXTRA_RACCOLTA">Extra Raccolta</SelectItem><SelectItem value="TUTTE">RETE + ACI</SelectItem></SelectContent>
            </Select>
            <Select value={filters.prestazione} onValueChange={v => setFilters({ ...filters, prestazione: v })}>
              <SelectTrigger><SelectValue placeholder="Prestazione" /></SelectTrigger>
              <SelectContent><SelectItem value={null}>Tutte le prestazioni</SelectItem>{Object.entries(PRESTAZIONI_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filters.fornitore_id} onValueChange={v => setFilters({ ...filters, fornitore_id: v })}>
              <SelectTrigger><SelectValue placeholder="Fornitore" /></SelectTrigger>
              <SelectContent><SelectItem value={null}>Tutti i fornitori</SelectItem>{fornitori.map(f => <SelectItem key={f.id} value={f.id}>{f.ragione_sociale}</SelectItem>)}</SelectContent>
            </Select>
            <div className="flex flex-col justify-center gap-1 px-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={filters.showArchived} onChange={e => setFilters({ ...filters, showArchived: e.target.checked })} className="w-4 h-4 rounded border-input accent-primary" />
                <span className="text-muted-foreground text-xs">Mostra archiviate</span>
              </label>
              {/* Solo le tariffe con un surplus in corso o in arrivo (13/10/2026) */}
              <label className={`flex items-center gap-2 text-sm ${surplus ? 'cursor-pointer' : 'opacity-50'}`}>
                <input type="checkbox" checked={filters.conSurplus} disabled={!surplus} onChange={e => setFilters({ ...filters, conSurplus: e.target.checked })} className="w-4 h-4 rounded border-input accent-[hsl(var(--eco-surplus))]" />
                <span className="text-muted-foreground text-xs">Con surplus</span>
              </label>
            </div>
          </div>
          {/* Avvisi duplicati e senza prestazione */}
          {(duplicateIds.size > 0 || noPrestCount > 0) && (
            <div className="space-y-2">
              {duplicateIds.size > 0 && (
                <div className="border-2 border-amber-300 bg-amber-50 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm text-amber-800">
                      <span className="font-semibold">⚠ {duplicateIds.size} tariffe duplicate.</span> Più tariffe attive coprono lo stesso periodo per la stessa combinazione: il calcolo ne applica una sola, in modo non prevedibile. Elimina o chiudi quelle superflue.
                    </div>
                    <Button size="sm" variant="outline" className="shrink-0" onClick={() => { setShowOnlyDup(!showOnlyDup); if (showOnlyNoPrest) setShowOnlyNoPrest(false); }}>
                      {showOnlyDup ? 'Mostra tutte' : 'Mostra solo le duplicate'}
                    </Button>
                  </div>
                </div>
              )}
              {noPrestCount > 0 && (
                <div className="border-2 border-orange-300 bg-orange-50 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm text-orange-800">
                      <span className="font-semibold">⚠ {noPrestCount} tariffe senza prestazione.</span> Queste tariffe non vengono mai applicate dal calcolo. Assegna la prestazione corretta oppure eliminale se sostituite da quelle importate.
                    </div>
                    <Button size="sm" variant="outline" className="shrink-0" onClick={() => { setShowOnlyNoPrest(!showOnlyNoPrest); if (showOnlyDup) setShowOnlyDup(false); }}>
                      {showOnlyNoPrest ? 'Mostra tutte' : 'Mostra solo senza prestazione'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
          {/* Tabella */}
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Fornitore</th>
                  <th className="text-left px-2 py-2 font-semibold">Dir.</th>
                  <th className="text-left px-2 py-2 font-semibold">Tipologia</th>
                  <th className="text-left px-3 py-2 font-semibold">Prestazione</th>
                  <th className="text-left px-2 py-2 font-semibold">Classe</th>
                  <th className="text-left px-3 py-2 font-semibold">Ambito</th>
                  <th className="text-left px-2 py-2 font-semibold">Unità</th>
                  <th className="text-right px-3 py-2 font-semibold">Valore</th>
                  <th className="text-left px-2 py-2 font-semibold">Surplus</th>
                  <th className="text-left px-2 py-2 font-semibold">Dal</th>
                  <th className="text-left px-2 py-2 font-semibold">Al</th>
                  <th className="text-left px-2 py-2 font-semibold">Stato</th>
                  <th className="text-right px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => {
                  const arch = isArchiviata(t);
                  const aperta = isAperta(t);
                  const noPrest = !t.prestazione && t.direzione !== 'ATTIVA';
                  const zeroVal = Number(t.valore) === 0;
                  const f = fornitori.find(x => x.id === t.fornitore_id);
                  const multiRuolo = f ? countRuoli(f) > 1 : false;
                  const isDup = duplicateIds.has(t.id);
                  return (
                    <tr key={t.id} className={`${i % 2 ? 'bg-muted/30' : ''} ${arch ? 'opacity-50' : ''} ${noPrest ? 'bg-amber-50' : ''} ${isDup ? 'bg-red-50' : ''}`}>
                      <td className="px-3 py-2 font-medium">{t.direzione === 'ATTIVA' ? (t.cliente || '—') : (t.fornitore_nome || '—')}</td>
                      <td className="px-2 py-2 text-xs">{t.direzione || '—'}</td>
                      <td className="px-2 py-2 text-xs">{TIPOLOGIA_LABEL[t.tipologia] || t.tipologia || '—'}</td>
                      <td className="px-3 py-2">{noPrest ? <span className="text-xs px-1.5 py-0.5 rounded bg-amber-200 text-amber-800 font-medium">Prestazione da assegnare</span> : (PRESTAZIONI_LABEL[t.prestazione] || '—')}</td>
                      <td className="px-2 py-2">{t.classe_materiale || <span className="text-muted-foreground italic">Tutte</span>}</td>
                      <td className="px-3 py-2 text-xs">{getAmbito(t)}</td>
                      <td className="px-2 py-2 text-xs">{t.unita_misura || '—'}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatNumber(t.valore, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{zeroVal && <div className="text-xs text-muted-foreground">Nessun compenso</div>}</td>
                      {/* Niente sulle tariffe archiviate: il surplus di oggi non le riguarda */}
                      <td className="px-2 py-2">{arch ? null : <PastiglieSurplus col={surplus ? (surplusPerTariffa.get(t.id) || null) : null} tariffa={t} onVai={() => setTab('surplus')} />}</td>
                      <td className="px-2 py-2 text-xs text-muted-foreground">{t.data_inizio_validita ? new Date(t.data_inizio_validita).toLocaleDateString('it-IT') : '—'}</td>
                      <td className="px-2 py-2 text-xs text-muted-foreground">{t.data_fine_validita ? new Date(t.data_fine_validita).toLocaleDateString('it-IT') : <span className="italic">aperto</span>}</td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1 flex-wrap">
                          {t.stato === 'attivo' ? <span className="text-xs px-1.5 py-0.5 rounded bg-success/10 text-success">Attivo</span> : <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Archivata</span>}
                          {isDup && <span className="text-xs px-1.5 py-0.5 rounded bg-red-200 text-red-800 font-medium">Duplicata</span>}
                        </div>
                      </td>
                      <td className="text-right px-2 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-0.5 justify-end">
                          <button onClick={() => openEdit(t)} className="p-1 hover:bg-muted rounded" title="Modifica"><Pencil className="w-3.5 h-3.5 text-primary" /></button>
                          {multiRuolo && <button onClick={() => openDuplicate(t)} className="p-1 hover:bg-muted rounded" title="Duplica per altra prestazione"><Copy className="w-3.5 h-3.5 text-primary" /></button>}
                          <button onClick={() => setStorico(t)} className="p-1 hover:bg-muted rounded" title="Storico"><History className="w-3.5 h-3.5 text-muted-foreground" /></button>
                          {aperta && <button onClick={() => closePeriod(t)} className="p-1 hover:bg-muted rounded" title="Chiudi periodo"><CalendarX className="w-3.5 h-3.5 text-amber-500" /></button>}
                          {/* Si riapre anche una tariffa chiusa con una data futura: prima il
                              pulsante compariva solo dal giorno dopo la scadenza, e una chiusura
                              messa per sbaglio restava li' per mesi senza modo di toglierla. */}
                          {(arch || !!t.data_fine_validita) && <button onClick={() => reopenPeriod(t)} className="p-1 hover:bg-muted rounded" title="Riapri"><RotateCcw className="w-3.5 h-3.5 text-success" /></button>}
                          <button onClick={() => setDeleteTarget(t)} className="p-1 hover:bg-destructive/10 rounded" title="Elimina tariffa"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && <tr><td colSpan={13} className="text-center py-8 text-muted-foreground">Nessuna tariffa. Clicca "Aggiungi tariffa" per iniziare.</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="surplus" className="mt-4">
          <SurplusSezione surplus={surplus} erroreLettura={erroreSurplus} fornitori={fornitori} isAdmin={isAdmin} oggi={oggi} onCambiato={caricaSurplus} onRiprova={caricaSurplus} richiesta={richiestaSurplus} onRichiestaFatta={() => setRichiestaSurplus(null)} />
        </TabsContent>
        <TabsContent value="ruoli" className="mt-4"><TariffeRuoliFornitori /></TabsContent>
      </Tabs>
      <TariffeForm
        open={formState.open}
        onClose={closeForm}
        onSaved={load}
        editing={formState.editing}
        duplicating={formState.duplicating}
        excludePrestazione={formState.excludePrestazione}
        fornitori={fornitori}
        province={province}
        destinazioniRaccolta={destRaccolta}
        stoccaggi={stoccaggi}
        destinazioniSecondaria={destSecondaria}
        switchToRuoliTab={() => { closeForm(); setTab('ruoli'); }}
      />
      <TariffeStorico tariffa={storico} tariffe={tariffe} onClose={() => setStorico(null)} />

      <Dialog open={import2026 !== null} onOpenChange={(o) => !o && setImport2026(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importa tariffe 2026</DialogTitle>
          </DialogHeader>
          {import2026?.loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : import2026?.summary ? (
            <div className="space-y-4 text-sm">
              {import2026.summary.totali && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="border rounded p-2 text-center"><div className="text-xs text-muted-foreground">Fornitori creati</div><div className="text-lg font-bold">{import2026.summary.totali.fornitori_creati}</div></div>
                  <div className="border rounded p-2 text-center"><div className="text-xs text-muted-foreground">Fornitori aggiornati</div><div className="text-lg font-bold">{import2026.summary.totali.fornitori_aggiornati}</div></div>
                  <div className="border rounded p-2 text-center"><div className="text-xs text-muted-foreground">Fornitori interni</div><div className="text-lg font-bold">{import2026.summary.totali.fornitori_interni}</div></div>
                  <div className="border rounded p-2 text-center bg-success/10"><div className="text-xs text-muted-foreground">Tariffe da creare</div><div className="text-lg font-bold text-success">{import2026.summary.totali.tariffe_create}</div></div>
                  <div className="border rounded p-2 text-center bg-amber-50"><div className="text-xs text-muted-foreground">Già esistenti</div><div className="text-lg font-bold text-amber-600">{import2026.summary.totali.tariffe_ignorate}</div></div>
                  <div className="border rounded p-2 text-center bg-destructive/10"><div className="text-xs text-muted-foreground">Errori</div><div className="text-lg font-bold text-destructive">{import2026.summary.totali.errori}</div></div>
                </div>
              )}
              {import2026.summary.tariffe_create_summary && Object.keys(import2026.summary.tariffe_create_summary).length > 0 && (
                <div>
                  <div className="font-semibold mb-1">Tariffe da creare per prestazione/tipologia:</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(import2026.summary.tariffe_create_summary).map(([k, v]) => (
                      <span key={k} className="text-xs px-2 py-1 rounded bg-muted">{k}: {v}</span>
                    ))}
                  </div>
                </div>
              )}
              {import2026.summary.fornitori_creati?.length > 0 && (
                <div><div className="font-semibold mb-1">Nuovi fornitori:</div><div className="text-xs text-muted-foreground">{import2026.summary.fornitori_creati.join(', ')}</div></div>
              )}
              {import2026.summary.fornitori_aggiornati?.length > 0 && (
                <div><div className="font-semibold mb-1">Fornitori aggiornati:</div><div className="text-xs text-muted-foreground">{import2026.summary.fornitori_aggiornati.join('; ')}</div></div>
              )}
              {import2026.summary.fornitori_interni?.length > 0 && (
                <div><div className="font-semibold mb-1">Fornitori interni:</div><div className="text-xs text-muted-foreground">{import2026.summary.fornitori_interni.join(', ')}</div></div>
              )}
              {import2026.summary.tariffe_ignorate?.length > 0 && (
                <div>
                  <div className="font-semibold mb-1">Tariffe già esistenti (saranno ignorate):</div>
                  <div className="max-h-40 overflow-y-auto border rounded">
                    <table className="w-full text-xs">
                      <thead className="bg-muted sticky top-0"><tr><th className="text-left px-2 py-1">Fornitore</th><th className="text-left px-2 py-1">Prest.</th><th className="text-left px-2 py-1">Tip.</th><th className="text-left px-2 py-1">Classe</th><th className="text-left px-2 py-1">Ambito</th></tr></thead>
                      <tbody>
                        {import2026.summary.tariffe_ignorate.map((t, i) => (
                          <tr key={i} className="border-t"><td className="px-2 py-1">{t.fornitore}</td><td className="px-2 py-1">{t.prestazione}</td><td className="px-2 py-1">{t.tipologia}</td><td className="px-2 py-1">{t.classe || '—'}</td><td className="px-2 py-1">{t.ambito}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : null}
          {import2026?.error && <div className="bg-destructive/10 border border-destructive/30 rounded p-3 text-sm text-destructive">{import2026.error}</div>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImport2026(null)}>Annulla</Button>
            {import2026?.summary && (
              <Button onClick={confirmImport2026} disabled={import2026.inserting}>
                {import2026.inserting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                Conferma inserimento
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && chiudiDialogElimina()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Elimina tariffa</DialogTitle>
          </DialogHeader>
          {deleteTarget && (
            <div className="space-y-3 text-sm">
              <div className="border rounded-lg p-3 space-y-1 bg-muted/30">
                <div><span className="text-muted-foreground">Fornitore:</span> <span className="font-medium">{deleteTarget.fornitore_nome || '—'}</span></div>
                <div><span className="text-muted-foreground">Prestazione:</span> <span className="font-medium">{PRESTAZIONI_LABEL[deleteTarget.prestazione] || deleteTarget.prestazione || '—'}</span></div>
                <div><span className="text-muted-foreground">Tipologia:</span> <span className="font-medium">{TIPOLOGIA_LABEL[deleteTarget.tipologia] || deleteTarget.tipologia || '—'}</span></div>
                <div><span className="text-muted-foreground">Classe:</span> <span className="font-medium">{deleteTarget.classe_materiale || 'Tutte'}</span></div>
                <div><span className="text-muted-foreground">Ambito:</span> <span className="font-medium">{getAmbito(deleteTarget)}</span></div>
                <div><span className="text-muted-foreground">Valore:</span> <span className="font-medium">{formatNumber(deleteTarget.valore, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {deleteTarget.unita_misura}</span></div>
                <div><span className="text-muted-foreground">Periodo:</span> <span className="font-medium">{dataIt(deleteTarget.data_inizio_validita) || 'n.d.'} → {dataIt(deleteTarget.data_fine_validita) || 'aperto'}</span></div>
              </div>
              <div className="bg-amber-50 border border-amber-300 rounded p-3 text-amber-800 text-xs">
                {periodoAncoraAperto(deleteTarget)
                  ? 'L\'eliminazione è definitiva. Se il prezzo è stato applicato a fatturazioni già emesse, usa "Chiudi periodo" invece di eliminare, così lo storico resta consultabile.'
                  : `L'eliminazione è definitiva. Il periodo di questa tariffa è già chiuso (vale fino al ${dataIt(deleteTarget.data_fine_validita)}): se il prezzo è stato applicato a fatturazioni già emesse, lasciala com'è, così lo storico resta consultabile.`}
              </div>
              {inUsoTariffa && (
                <div className="bg-red-50 border border-red-300 rounded p-3 text-red-800 text-xs space-y-1">
                  <div className="font-semibold">Questa tariffa è ancora usata:</div>
                  <ul className="list-disc pl-4">
                    {(inUsoTariffa.elenco || []).map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                  <div>
                    Eliminandola, quei movimenti restano senza prezzo, anche nei mesi già fatturati.
                    {inUsoTariffa.proposta === 'chiudi_periodo' && periodoAncoraAperto(deleteTarget)
                      ? ' Chiudendo il periodo resta valida per i giorni che ha coperto.'
                      : ' Il suo periodo è già chiuso: lasciandola com\'è vale solo per i giorni che ha coperto.'}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={chiudiDialogElimina} disabled={deleting}>Annulla</Button>
            {/* «Chiudi periodo» solo a una tariffa ancora aperta (13/10/2026) */}
            {inUsoTariffa && inUsoTariffa.proposta === 'chiudi_periodo' && deleteTarget && periodoAncoraAperto(deleteTarget) && (
              <Button variant="outline" onClick={chiudiPeriodoInvece} disabled={deleting}>
                <CalendarX className="w-4 h-4 mr-1" /> Chiudi periodo
              </Button>
            )}
            <Button variant="destructive" onClick={() => handleDelete(!!inUsoTariffa)} disabled={deleting}>
              {deleting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
              {inUsoTariffa ? 'Elimina comunque' : 'Elimina definitivamente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importAttive2026 !== null} onOpenChange={(o) => !o && setImportAttive2026(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importa tariffe attive 2026</DialogTitle>
          </DialogHeader>
          {importAttive2026?.loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : importAttive2026?.summary ? (
            <div className="space-y-4 text-sm">
              {importAttive2026.summary.totali && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="border rounded p-2 text-center bg-success/10"><div className="text-xs text-muted-foreground">Da creare</div><div className="text-lg font-bold text-success">{importAttive2026.summary.totali.tariffe_create}</div></div>
                  <div className="border rounded p-2 text-center bg-amber-50"><div className="text-xs text-muted-foreground">Già esistenti</div><div className="text-lg font-bold text-amber-600">{importAttive2026.summary.totali.tariffe_ignorate}</div></div>
                  <div className="border rounded p-2 text-center bg-destructive/10"><div className="text-xs text-muted-foreground">Errori</div><div className="text-lg font-bold text-destructive">{importAttive2026.summary.totali.errori}</div></div>
                </div>
              )}
              {importAttive2026.summary.tariffe_create?.length > 0 && (
                <div>
                  <div className="font-semibold mb-1">Tariffe da creare:</div>
                  <div className="max-h-40 overflow-y-auto border rounded">
                    <table className="w-full text-xs">
                      <thead className="bg-muted sticky top-0"><tr><th className="text-left px-2 py-1">Tipologia</th><th className="text-left px-2 py-1">Regione</th><th className="text-right px-2 py-1">Valore</th></tr></thead>
                      <tbody>
                        {importAttive2026.summary.tariffe_create.map((t, i) => (
                          <tr key={i} className="border-t"><td className="px-2 py-1">{t.tipologia}</td><td className="px-2 py-1">{t.regione || 'Tutte'}</td><td className="px-2 py-1 text-right">{t.valore} {t.unita_misura}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {importAttive2026.summary.tariffe_ignorate?.length > 0 && (
                <div>
                  <div className="font-semibold mb-1">Tariffe già esistenti (saranno ignorate):</div>
                  <div className="max-h-40 overflow-y-auto border rounded">
                    <table className="w-full text-xs">
                      <thead className="bg-muted sticky top-0"><tr><th className="text-left px-2 py-1">Tipologia</th><th className="text-left px-2 py-1">Regione</th><th className="text-right px-2 py-1">Valore</th></tr></thead>
                      <tbody>
                        {importAttive2026.summary.tariffe_ignorate.map((t, i) => (
                          <tr key={i} className="border-t"><td className="px-2 py-1">{t.tipologia}</td><td className="px-2 py-1">{t.regione || 'Tutte'}</td><td className="px-2 py-1 text-right">{t.valore} {t.unita_misura}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : null}
          {importAttive2026?.error && <div className="bg-destructive/10 border border-destructive/30 rounded p-3 text-sm text-destructive">{importAttive2026.error}</div>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportAttive2026(null)}>Annulla</Button>
            {importAttive2026?.summary && (
              <Button onClick={confirmImportAttive2026} disabled={importAttive2026.inserting}>
                {importAttive2026.inserting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                Conferma inserimento
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}