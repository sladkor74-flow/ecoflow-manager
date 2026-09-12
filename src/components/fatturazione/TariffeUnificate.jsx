import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Pencil, Copy, History, CalendarX, RotateCcw } from 'lucide-react';
import { formatNumber } from '@/lib/utils';
import { fetchAllClient } from '@/lib/fetchAllClient';
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
  if (t.prestazione === 'RACCOLTA') { let a = t.provincia || t.regione || 'Tutte le zone'; if (t.destinazione) a += ` → ${t.destinazione}`; return a; }
  if (t.prestazione === 'TRASPORTO_SECONDARIA') return `${t.produttore || '?'} → ${t.destinatario || '?'}`;
  return '—';
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
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let result = tariffe.filter(t => {
      if (filters.direzione && t.direzione !== filters.direzione) return false;
      if (filters.tipologia && t.tipologia !== filters.tipologia) return false;
      if (filters.prestazione && t.prestazione !== filters.prestazione) return false;
      if (filters.fornitore_id && t.fornitore_id !== filters.fornitore_id) return false;
      if (!filters.showArchived && isArchiviata(t)) return false;
      return true;
    });
    result.sort((a, b) => {
      const f = (a.fornitore_nome || '').localeCompare(b.fornitore_nome || ''); if (f) return f;
      const p = (a.prestazione || '').localeCompare(b.prestazione || ''); if (p) return p;
      const c = (a.classe_materiale || '').localeCompare(b.classe_materiale || ''); if (c) return c;
      return new Date(b.data_inizio_validita || 0) - new Date(a.data_inizio_validita || 0);
    });
    return result;
  }, [tariffe, filters]);

  const closePeriod = async (t) => {
    const dataFine = prompt('Inserisci la data di fine validità (YYYY-MM-DD):', new Date().toISOString().slice(0, 10));
    if (!dataFine) return;
    try {
      await base44.functions.invoke('gestisciAnagrafiche', { entita: 'Tariffa', operazione: 'update', id: t.id, dati: { data_fine_validita: dataFine, stato: 'non_attivo' } });
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
            <Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1" /> Aggiungi tariffa</Button>
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
                  const noPrest = !t.prestazione;
                  const zeroVal = Number(t.valore) === 0;
                  const f = fornitori.find(x => x.id === t.fornitore_id);
                  const multiRuolo = f ? countRuoli(f) > 1 : false;
                  return (
                    <tr key={t.id} className={`${i % 2 ? 'bg-muted/30' : ''} ${arch ? 'opacity-50' : ''} ${noPrest ? 'bg-amber-50' : ''}`}>
                      <td className="px-3 py-2 font-medium">{t.fornitore_nome || '—'}</td>
                      <td className="px-2 py-2 text-xs">{t.direzione || '—'}</td>
                      <td className="px-2 py-2 text-xs">{TIPOLOGIA_LABEL[t.tipologia] || t.tipologia || '—'}</td>
                      <td className="px-3 py-2">{noPrest ? <span className="text-xs px-1.5 py-0.5 rounded bg-amber-200 text-amber-800 font-medium">Prestazione da assegnare</span> : (PRESTAZIONI_LABEL[t.prestazione] || '—')}</td>
                      <td className="px-2 py-2">{t.classe_materiale || <span className="text-muted-foreground italic">Tutte</span>}</td>
                      <td className="px-3 py-2 text-xs">{getAmbito(t)}</td>
                      <td className="px-2 py-2 text-xs">{t.unita_misura || '—'}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatNumber(t.valore, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{zeroVal && <div className="text-xs text-muted-foreground">Nessun compenso</div>}</td>
                      <td className="px-2 py-2 text-xs text-muted-foreground">{t.data_inizio_validita ? new Date(t.data_inizio_validita).toLocaleDateString('it-IT') : '—'}</td>
                      <td className="px-2 py-2 text-xs text-muted-foreground">{t.data_fine_validita ? new Date(t.data_fine_validita).toLocaleDateString('it-IT') : <span className="italic">aperto</span>}</td>
                      <td className="px-2 py-2">{t.stato === 'attivo' ? <span className="text-xs px-1.5 py-0.5 rounded bg-success/10 text-success">Attivo</span> : <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Archivata</span>}</td>
                      <td className="text-right px-2 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-0.5 justify-end">
                          <button onClick={() => openEdit(t)} className="p-1 hover:bg-muted rounded" title="Modifica"><Pencil className="w-3.5 h-3.5 text-primary" /></button>
                          {multiRuolo && <button onClick={() => openDuplicate(t)} className="p-1 hover:bg-muted rounded" title="Duplica per altra prestazione"><Copy className="w-3.5 h-3.5 text-primary" /></button>}
                          <button onClick={() => setStorico(t)} className="p-1 hover:bg-muted rounded" title="Storico"><History className="w-3.5 h-3.5 text-muted-foreground" /></button>
                          {aperta && <button onClick={() => closePeriod(t)} className="p-1 hover:bg-muted rounded" title="Chiudi periodo"><CalendarX className="w-3.5 h-3.5 text-amber-500" /></button>}
                          {arch && <button onClick={() => reopenPeriod(t)} className="p-1 hover:bg-muted rounded" title="Riapri"><RotateCcw className="w-3.5 h-3.5 text-success" /></button>}
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
    </div>
  );
}