import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Pencil, Copy, History, CalendarX, RotateCcw, Download, Trash2 } from 'lucide-react';
import { formatNumber } from '@/lib/utils';
import { fetchAllClient } from '@/lib/fetchAllClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import TariffeRuoliFornitori from './TariffeRuoliFornitori';
import TariffeForm from './TariffeForm';
import TariffeStorico from './TariffeStorico';

const PRESTAZIONI_LABEL = { RACCOLTA: 'Raccolta', TRASPORTO_SECONDARIA: 'Trasporto secondaria', TRATTAMENTO: 'Trattamento', CONFERIMENTO_STOCCAGGIO: 'Conferimento stoccaggio' };
const TIPOLOGIA_LABEL = { RETE: 'Rete', ACI: 'ACI', EXTRA_RACCOLTA: 'Extra Raccolta', TUTTE: 'RETE + ACI' };

function isArchiviata(t) {
  if (t.stato === 'non_attivo') return true;
  if (t.data_fine_validita) { const f = new Date(t.data_fine_validita); const o = new Date(); o.setHours(0,0,0,0); if (f < o) return true; }
  return false;
}
function isAperta(t) { return t.stato === 'attivo' && !t.data_fine_validita; }
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
function chiaviTariffaCoincidenti(a, b) {
  const aAttiva = normVal(a.direzione) === 'ATTIVA';
  const bAttiva = normVal(b.direzione) === 'ATTIVA';
  if (aAttiva || bAttiva) {
    if (aAttiva !== bAttiva) return false;
    const campi = ['cliente', 'tipologia', 'classe_materiale', 'regione', 'eer_codice'];
    for (const c of campi) { if (normVal(a[c]) !== normVal(b[c])) return false; }
    return true;
  }
  const campi = ['fornitore_id', 'direzione', 'tipologia', 'prestazione', 'classe_materiale', 'provincia', 'regione', 'destinazione', 'produttore', 'destinatario'];
  for (const c of campi) { if (normVal(a[c]) !== normVal(b[c])) return false; }
  return true;
}
function periodiSovrappostiClient(inizio1, fine1, inizio2, fine2) {
  const i1 = inizio1 ? new Date(inizio1).getTime() : 0;
  const f1 = fine1 ? new Date(fine1).getTime() : Infinity;
  const i2 = inizio2 ? new Date(inizio2).getTime() : 0;
  const f2 = fine2 ? new Date(fine2).getTime() : Infinity;
  return i1 <= f2 && i2 <= f1;
}
function calcolaDuplicate(tariffe) {
  const attive = tariffe.filter(t => normVal(t.stato) === 'ATTIVO');
  const dupIds = new Set();
  for (let i = 0; i < attive.length; i++) {
    for (let j = i + 1; j < attive.length; j++) {
      if (chiaviTariffaCoincidenti(attive[i], attive[j]) &&
          periodiSovrappostiClient(attive[i].data_inizio_validita, attive[i].data_fine_validita, attive[j].data_inizio_validita, attive[j].data_fine_validita)) {
        dupIds.add(attive[i].id);
        dupIds.add(attive[j].id);
      }
    }
  }
  return dupIds;
}

export default function TariffeUnificate() {
  const [tab, setTab] = useState('tariffe');
  const [tariffe, setTariffe] = useState([]);
  const [fornitori, setFornitori] = useState([]);
  const [province, setProvince] = useState([]);
  const [destRaccolta, setDestRaccolta] = useState([]);
  const [stoccaggi, setStoccaggi] = useState([]);
  const [destSecondaria, setDestSecondaria] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ direzione: '', tipologia: '', prestazione: '', fornitore_id: '', showArchived: false });
  const [formState, setFormState] = useState({ open: false, editing: null, duplicating: null, excludePrestazione: '' });
  const [storico, setStorico] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [import2026, setImport2026] = useState(null);
  const [importAttive2026, setImportAttive2026] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showOnlyDup, setShowOnlyDup] = useState(false);
  const [showOnlyNoPrest, setShowOnlyNoPrest] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [t, f, primarie, secondarie] = await Promise.all([
        fetchAllClient(base44.entities.Tariffa),
        base44.entities.Fornitore.filter({ stato: 'attivo' }),
        fetchAllClient(base44.entities.PrimariaRete),
        fetchAllClient(base44.entities.Secondaria),
      ]);
      setTariffe(t); setFornitori(f);
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
    } catch (e) {}
    setLoading(false);
  };
  useEffect(() => {
    load();
    base44.auth.me().then(u => setIsAdmin(u?.role === 'admin')).catch(() => {});
  }, []);

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
      return true;
    });
    result.sort((a, b) => {
      const f = (a.fornitore_nome || '').localeCompare(b.fornitore_nome || ''); if (f) return f;
      const p = (a.prestazione || '').localeCompare(b.prestazione || ''); if (p) return p;
      const c = (a.classe_materiale || '').localeCompare(b.classe_materiale || ''); if (c) return c;
      return new Date(b.data_inizio_validita || 0) - new Date(a.data_inizio_validita || 0);
    });
    return result;
  }, [tariffe, filters, showOnlyDup, showOnlyNoPrest, duplicateIds]);

  const closePeriod = async (t) => {
    const dataFine = prompt('Inserisci la data di fine validità (YYYY-MM-DD):', new Date().toISOString().slice(0, 10));
    if (!dataFine) return;
    try {
      // Solo la data di fine: la tariffa resta valida per i giorni che ha
      // coperto, altrimenti i mesi gia' fatturati con quel prezzo resterebbero
      // senza prezzo. Dall'elenco sparisce lo stesso, per data di fine passata.
      await base44.functions.invoke('gestisciAnagrafiche', { entita: 'Tariffa', operazione: 'update', id: t.id, dati: { data_fine_validita: dataFine } });
      load();
    } catch (e) { alert(e?.response?.data?.error || e?.message); }
  };
  const reopenPeriod = async (t) => {
    if (!confirm('Riaprire questa tariffa? Verrà impostata come attiva senza data di fine.')) return;
    try {
      await base44.functions.invoke('gestisciAnagrafiche', { entita: 'Tariffa', operazione: 'update', id: t.id, dati: { data_fine_validita: undefined, stato: 'attivo' } });
      load();
    } catch (e) { alert(e?.response?.data?.error || e?.message); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await base44.functions.invoke('gestisciAnagrafiche', { entita: 'Tariffa', operazione: 'delete', id: deleteTarget.id });
      setDeleteTarget(null);
      load();
    } catch (e) { alert(e?.response?.data?.error || e?.message); }
    setDeleting(false);
  };

  const openCreate = () => setFormState({ open: true, editing: null, duplicating: null, excludePrestazione: '' });
  const openEdit = (t) => setFormState({ open: true, editing: t, duplicating: null, excludePrestazione: '' });
  const openDuplicate = (t) => setFormState({ open: true, editing: null, duplicating: t, excludePrestazione: t.prestazione });
  const closeForm = () => setFormState({ open: false, editing: null, duplicating: null, excludePrestazione: '' });

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="tariffe">Tariffe</TabsTrigger>
          <TabsTrigger value="ruoli">Ruoli fornitori</TabsTrigger>
        </TabsList>
        <TabsContent value="tariffe" className="mt-4 space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Gestione unificata di tutte le tariffe per prestazione e fornitore.</p>
            <div className="flex gap-2">
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
            <label className="flex items-center gap-2 text-sm cursor-pointer px-1">
              <input type="checkbox" checked={filters.showArchived} onChange={e => setFilters({ ...filters, showArchived: e.target.checked })} className="w-4 h-4 rounded border-input accent-primary" />
              <span className="text-muted-foreground text-xs">Mostra archiviate</span>
            </label>
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
                          {arch && <button onClick={() => reopenPeriod(t)} className="p-1 hover:bg-muted rounded" title="Riapri"><RotateCcw className="w-3.5 h-3.5 text-success" /></button>}
                          <button onClick={() => setDeleteTarget(t)} className="p-1 hover:bg-destructive/10 rounded" title="Elimina tariffa"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && <tr><td colSpan={12} className="text-center py-8 text-muted-foreground">Nessuna tariffa. Clicca "Aggiungi tariffa" per iniziare.</td></tr>}
              </tbody>
            </table>
          </div>
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

      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
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
                <div><span className="text-muted-foreground">Periodo:</span> <span className="font-medium">{deleteTarget.data_inizio_validita || 'n.d.'} → {deleteTarget.data_fine_validita || 'aperto'}</span></div>
              </div>
              <div className="bg-amber-50 border border-amber-300 rounded p-3 text-amber-800 text-xs">
                L'eliminazione è definitiva. Se il prezzo è stato applicato a fatturazioni già emesse, usa "Chiudi periodo" invece di eliminare, così lo storico resta consultabile.
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Annulla</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
              Elimina definitivamente
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