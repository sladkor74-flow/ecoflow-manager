import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Trash2, Edit3, Target, Factory, Warehouse, Calendar, RefreshCw } from 'lucide-react';
import { normalizzaRagioneSociale } from '@/lib/normalizzaRagioneSocialeClient';

const ANNO_DEFAULT = 2026;
const ANNI = [2024, 2025, 2026, 2027];

function fmt(n) { return (Number(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 3, maximumFractionDigits: 3 }); }
function fmtInt(n) { return (Number(n) || 0).toLocaleString('it-IT'); }

function EditableCell({ value, onSave, unit, decimals = 3 }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(value || 0));
  const [saving, setSaving] = useState(false);

  useEffect(() => { setVal(String(value || 0)); }, [value]);

  const commit = async () => {
    setEditing(false);
    const cleaned = String(val).replace(/\./g, '').replace(',', '.');
    const num = Number(cleaned);
    if (Number.isNaN(num) || num === value) return;
    setSaving(true);
    try { await onSave(num); } catch (e) { setVal(String(value || 0)); }
    setSaving(false);
  };

  if (saving) return <Loader2 className="w-3 h-3 animate-spin inline" />;
  if (editing) {
    return (
      <input
        autoFocus
        type="text"
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditing(false); setVal(String(value || 0)); } }}
        className="w-28 text-sm border border-primary rounded px-1 py-0.5 focus:outline-none bg-background"
      />
    );
  }
  const display = decimals === 0 ? fmtInt(value) : fmt(value);
  return (
    <span className="font-medium text-foreground cursor-text hover:bg-primary/10 rounded px-1 inline-flex items-center" onClick={() => setEditing(true)}>
      {display}
      {unit && <span className="text-xs text-muted-foreground ml-1">{unit}</span>}
      <Edit3 className="w-3 h-3 ml-1 opacity-40" />
    </span>
  );
}

function SectionCard({ icon: Icon, title, subtitle, count, onAdd, showAdd, children }) {
  return (
    <div className="border rounded-lg bg-card">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-primary" />
          <div>
            <h2 className="font-heading font-semibold">{title}</h2>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          {count != null && <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded-full font-medium">{count}</span>}
        </div>
        {onAdd && (
          <Button size="sm" variant="outline" onClick={onAdd}><Plus className="w-4 h-4 mr-1" /> Aggiungi</Button>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default function TargetAnnuali() {
  const [anno, setAnno] = useState(ANNO_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [raccoglitori, setRaccoglitori] = useState([]);
  const [impianti, setImpianti] = useState([]);
  const [fornitori, setFornitori] = useState([]);

  const [showRaccForm, setShowRaccForm] = useState(false);
  const [showImpForm, setShowImpForm] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migratingRegionali, setMigratingRegionali] = useState(false);
  const [raccForm, setRaccForm] = useState({ raccoglitore: '', target_tonnellate: 0 });
  const [impForm, setImpForm] = useState({ nome_impianto: '', target: 0, data_fine: '2026-12-18' });

  const load = async () => {
    setLoading(true);
    try {
      const [racc, imp, forn] = await Promise.all([
        base44.entities.TargetRaccoglitore.filter({ anno }),
        base44.entities.ImpiantoTargetSecondaria.list('-created_date', 200),
        base44.entities.FornitoreSecondaria.list('-created_date', 500),
      ]);

      // Nomi normalizzati degli impianti doppio ruolo / impianto (da escludere dai raccoglitori)
      const excludedNorms = new Set(
        forn.filter(f => f.ruolo === 'doppio_ruolo' || f.ruolo === 'impianto').map(f => normalizzaRagioneSociale(f.nome))
      );
      // Unione: nomi raccoglitore da FornitoreSecondaria (esclusi impianti/doppio_ruolo)
      const nomiDaFornitori = new Set();
      for (const f of forn) {
        if (!f.nome) continue;
        if (excludedNorms.has(normalizzaRagioneSociale(f.nome))) continue;
        nomiDaFornitori.add(f.nome);
      }
      // Set dei raccoglitori che hanno gia' almeno un record (anche come split regionale)
      const raccNorms = new Set();
      for (const r of racc) {
        const key = normalizzaRagioneSociale(r.raccoglitore);
        if (key) raccNorms.add(key);
      }
      // Auto-crea record mancanti solo se non esiste gia' nessun record per quel raccoglitore
      const toCreate = [];
      const merged = [...racc];
      for (const nome of nomiDaFornitori) {
        const key = normalizzaRagioneSociale(nome);
        if (!raccNorms.has(key)) {
          toCreate.push({ raccoglitore: nome, anno, target_tonnellate: 0 });
        }
      }
      if (toCreate.length > 0) {
        try {
          const created = await base44.entities.TargetRaccoglitore.bulkCreate(toCreate);
          for (const c of created) merged.push(c);
        } catch (e) {}
      }

      setRaccoglitori(merged);
      setImpianti(imp);
      setFornitori(forn);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [anno]);

  // Stoccaggi: ruolo stoccaggio o doppio_ruolo (fallback su tipo per record non migrati)
  const stoccaggi = useMemo(() => fornitori.filter(f => f.ruolo === 'stoccaggio' || f.ruolo === 'doppio_ruolo' || (!f.ruolo && (f.tipo || 'primaria_diretta') === 'stoccaggio')), [fornitori]);

  // Impianti doppio ruolo: hanno un FornitoreSecondaria con ruolo=doppio_ruolo collegato, oppure fallback match nome
  const doubleRoleImpiantiIds = useMemo(() => new Set(fornitori.filter(f => f.ruolo === 'doppio_ruolo' && f.impianto_id).map(f => f.impianto_id)), [fornitori]);
  const stoccaggioNames = useMemo(() => new Set(stoccaggi.map(s => normalizzaRagioneSociale(s.nome))), [stoccaggi]);
  const doubleRoleImpianti = useMemo(() => impianti.filter(imp => doubleRoleImpiantiIds.has(imp.id) || stoccaggioNames.has(normalizzaRagioneSociale(imp.nome_impianto))), [impianti, doubleRoleImpiantiIds, stoccaggioNames]);

  // Esclude dai raccoglitori i nomi che sono impianti doppio ruolo (quote impianto)
  const excludedRaccoglitoriNorms = useMemo(() => new Set(fornitori.filter(f => f.ruolo === 'doppio_ruolo' || f.ruolo === 'impianto').map(f => normalizzaRagioneSociale(f.nome))), [fornitori]);
  const raccoglitoriVisibili = useMemo(() => raccoglitori.filter(r => !excludedRaccoglitoriNorms.has(normalizzaRagioneSociale(r.raccoglitore))), [raccoglitori, excludedRaccoglitoriNorms]);
  const hasRegionale = useMemo(() => raccoglitoriVisibili.some(r => r.regione), [raccoglitoriVisibili]);
  const totaleRacc = useMemo(() => raccoglitoriVisibili.reduce((s, r) => s + (r.target_tonnellate || 0), 0), [raccoglitoriVisibili]);

  const saveRacc = async (r, value) => {
    setSaving(true);
    await base44.entities.TargetRaccoglitore.update(r.id, { target_tonnellate: value });
    setRaccoglitori(prev => prev.map(x => x.id === r.id ? { ...x, target_tonnellate: value } : x));
    setSaving(false);
  };

  const addRacc = async () => {
    if (!raccForm.raccoglitore) return;
    setSaving(true);
    try {
      const created = await base44.entities.TargetRaccoglitore.create({ ...raccForm, anno, target_tonnellate: Number(raccForm.target_tonnellate) });
      setRaccoglitori(prev => [...prev, created]);
      setRaccForm({ raccoglitore: '', target_tonnellate: 0 });
      setShowRaccForm(false);
    } catch (e) {}
    setSaving(false);
  };

  const removeRacc = async (r) => {
    if (!confirm(`Eliminare ${r.raccoglitore} (${r.anno})?`)) return;
    await base44.entities.TargetRaccoglitore.delete(r.id);
    setRaccoglitori(prev => prev.filter(x => x.id !== r.id));
  };

  const saveImp = async (imp, patch) => {
    setSaving(true);
    await base44.entities.ImpiantoTargetSecondaria.update(imp.id, patch);
    setImpianti(prev => prev.map(x => x.id === imp.id ? { ...x, ...patch } : x));
    setSaving(false);
  };

  const addImp = async () => {
    if (!impForm.nome_impianto) return;
    setSaving(true);
    try {
      const created = await base44.entities.ImpiantoTargetSecondaria.create({ ...impForm, target: Number(impForm.target), stato: 'attivo' });
      setImpianti(prev => [...prev, created]);
      setImpForm({ nome_impianto: '', target: 0, data_fine: '2026-12-18' });
      setShowImpForm(false);
    } catch (e) {}
    setSaving(false);
  };

  const removeImp = async (imp) => {
    if (!confirm(`Eliminare ${imp.nome_impianto}?`)) return;
    await base44.entities.ImpiantoTargetSecondaria.delete(imp.id);
    setImpianti(prev => prev.filter(x => x.id !== imp.id));
  };

  const savePlafond = async (f, value) => {
    setSaving(true);
    await base44.entities.FornitoreSecondaria.update(f.id, { plafond_stoccaggio_kg: value });
    setFornitori(prev => prev.map(x => x.id === f.id ? { ...x, plafond_stoccaggio_kg: value } : x));
    setSaving(false);
  };

  const saveTotale = async (imp, value) => {
    setSaving(true);
    await base44.entities.ImpiantoTargetSecondaria.update(imp.id, { totale_capacity_kg: value });
    setImpianti(prev => prev.map(x => x.id === imp.id ? { ...x, totale_capacity_kg: value } : x));
    setSaving(false);
  };

  const runMigrazione = async () => {
    setMigrating(true);
    try {
      const res = await base44.functions.invoke('migraFornitoriRuolo', {});
      const data = res.data || res;
      alert(`Migrazione completata: ${data.migrati || 0} record migrati, ${data.gia_migrati || 0} già migrati.`);
      load();
    } catch (e) {
      alert('Errore migrazione: ' + (e.message || 'errore sconosciuto'));
    }
    setMigrating(false);
  };

  const runMigrazioneRegionali = async () => {
    setMigratingRegionali(true);
    try {
      const res = await base44.functions.invoke('migraTargetRaccoglitoriRegionali', {});
      const data = res.data || res;
      alert(`Migrazione target regionali completata:\n• ${data.eliminati_quote_impianto || 0} quote impianto eliminate dai raccoglitori\n• ${data.smoco_regionali_creati || 0} record Smoco regionali creati\n• Record Smoco singolo: ${data.smoco_singolo_eliminato ? 'eliminato' : 'non presente'}`);
      load();
    } catch (e) {
      alert('Errore migrazione target regionali: ' + (e.message || 'errore sconosciuto'));
    }
    setMigratingRegionali(false);
  };

  if (loading) {
    return <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin inline" /></div>;
  }

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold">Target Annuali</h1>
          <p className="text-muted-foreground mt-1">Fonte unica per target raccoglitori, impianti e plafond stoccaggi.</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <select value={anno} onChange={e => setAnno(Number(e.target.value))} className="border rounded px-3 py-1.5 text-sm bg-background">
            {ANNI.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          {saving && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
          <Button size="sm" variant="outline" onClick={runMigrazione} disabled={migrating}>
            {migrating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Migra ruoli
          </Button>
          <Button size="sm" variant="outline" onClick={runMigrazioneRegionali} disabled={migratingRegionali}>
            {migratingRegionali ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Migra target regionali
          </Button>
        </div>
      </div>

      {/* Sezione Raccoglitori */}
      <SectionCard icon={Target} title="Target Raccoglitori" subtitle="Target annuo di raccolta (tonnellate)" count={raccoglitori.length} onAdd={() => setShowRaccForm(!showRaccForm)} showAdd={showRaccForm}>
        {showRaccForm && (
          <div className="border rounded-lg p-3 mb-3 bg-muted/30 flex flex-wrap gap-2 items-end">
            <Input placeholder="Nome raccoglitore" value={raccForm.raccoglitore} onChange={e => setRaccForm({ ...raccForm, raccoglitore: e.target.value })} className="flex-1 min-w-[200px]" />
            <Input type="number" placeholder="Target (ton)" value={raccForm.target_tonnellate} onChange={e => setRaccForm({ ...raccForm, target_tonnellate: e.target.value })} className="w-40" />
            <Button size="sm" onClick={addRacc}>Salva</Button>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Raccoglitore</th>
                {hasRegionale && <th className="text-left px-3 py-2 font-semibold">Regione</th>}
                <th className="text-left px-3 py-2 font-semibold">Anno</th>
                <th className="text-right px-3 py-2 font-semibold">Target (ton)</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {raccoglitoriVisibili.map(r => (
                <tr key={r.id} className="border-t hover:bg-muted/20">
                  <td className="px-3 py-2 font-medium">{r.raccoglitore}</td>
                  {hasRegionale && <td className="px-3 py-2 text-muted-foreground">{r.regione || '—'}</td>}
                  <td className="px-3 py-2 text-muted-foreground">{r.anno}</td>
                  <td className="px-3 py-2 text-right">
                    <EditableCell value={r.target_tonnellate || 0} onSave={(v) => saveRacc(r, v)} unit="ton" />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => removeRacc(r)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                  </td>
                </tr>
              ))}
              {raccoglitoriVisibili.length === 0 && (
                <tr><td colSpan={hasRegionale ? 5 : 4} className="px-3 py-6 text-center text-muted-foreground">Nessun raccoglitore per l'anno {anno}.</td></tr>
              )}
            </tbody>
            {raccoglitoriVisibili.length > 0 && (
              <tfoot>
                <tr className="border-t-2 bg-muted/30 font-semibold">
                  <td className="px-3 py-2" colSpan={hasRegionale ? 3 : 2}>Totale Raccoglitori</td>
                  <td className="px-3 py-2 text-right">{fmt(totaleRacc)} ton</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </SectionCard>

      {/* Sezione Impianti */}
      <SectionCard icon={Factory} title="Target Impianti" subtitle="Target di destinazione (kg) per le secondarie" count={impianti.length} onAdd={() => setShowImpForm(!showImpForm)} showAdd={showImpForm}>
        {showImpForm && (
          <div className="border rounded-lg p-3 mb-3 bg-muted/30 flex flex-wrap gap-2 items-end">
            <Input placeholder="Nome impianto" value={impForm.nome_impianto} onChange={e => setImpForm({ ...impForm, nome_impianto: e.target.value })} className="flex-1 min-w-[200px]" />
            <Input type="number" placeholder="Target (kg)" value={impForm.target} onChange={e => setImpForm({ ...impForm, target: e.target.value })} className="w-40" />
            <Input type="date" value={impForm.data_fine} onChange={e => setImpForm({ ...impForm, data_fine: e.target.value })} className="w-44" />
            <Button size="sm" onClick={addImp}>Salva</Button>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Impianto</th>
                <th className="text-right px-3 py-2 font-semibold">Target (kg)</th>
                <th className="text-left px-3 py-2 font-semibold">Scadenza</th>
                <th className="text-left px-3 py-2 font-semibold">Stato</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {impianti.map(imp => (
                <tr key={imp.id} className="border-t hover:bg-muted/20">
                  <td className="px-3 py-2 font-medium uppercase">{imp.nome_impianto}</td>
                  <td className="px-3 py-2 text-right">
                    <EditableCell value={imp.target || 0} onSave={(v) => saveImp(imp, { target: v })} unit="kg" />
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{imp.data_fine || '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${imp.stato === 'attivo' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>{imp.stato || 'attivo'}</span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => removeImp(imp)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                  </td>
                </tr>
              ))}
              {impianti.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Nessun impianto configurato.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Sezione Quote Target Impianto */}
      {doubleRoleImpianti.length > 0 && (
        <SectionCard icon={Factory} title="Quote Target Impianto" subtitle="Quote impianto di destinazione (es. T-CYCLE) - non comprese nel totale raccoglitori" count={doubleRoleImpianti.length}>
          <div className="space-y-3">
            {doubleRoleImpianti.map(imp => {
              const stocMatch = stoccaggi.find(s => normalizzaRagioneSociale(s.nome) === normalizzaRagioneSociale(imp.nome_impianto));
              const targetImp = imp.target || 0;
              const plafondStoc = stocMatch?.plafond_stoccaggio_kg || 0;
              const totale = imp.totale_capacity_kg || 0;
              const somma = targetImp + plafondStoc;
              const incongruente = totale > 0 && somma !== totale;
              return (
                <div key={imp.id} className={`border rounded-lg p-4 ${incongruente ? 'border-amber-400 bg-amber-50' : 'bg-card'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-heading font-bold uppercase">{imp.nome_impianto}</h3>
                    {incongruente && (
                      <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded">
                        ⚠ Split ({fmtInt(somma)} kg) ≠ Totale ({fmtInt(totale)} kg)
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div className="border rounded p-3">
                      <p className="text-xs text-muted-foreground mb-1">Totale capacità (editabile)</p>
                      <EditableCell value={totale} onSave={(v) => saveTotale(imp, v)} unit="kg" />
                    </div>
                    <div className="border rounded p-3">
                      <p className="text-xs text-muted-foreground mb-1">Target impianto (primarie imp)</p>
                      <EditableCell value={targetImp} onSave={(v) => saveImp(imp, { target: v })} unit="kg" />
                    </div>
                    <div className="border rounded p-3">
                      <p className="text-xs text-muted-foreground mb-1">Plafond stoccaggio (primarie stoc)</p>
                      <p className="font-bold">{fmtInt(plafondStoc)} kg</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Split: {fmtInt(targetImp)} + {fmtInt(plafondStoc)} = {fmtInt(somma)} kg {incongruente ? '⚠' : '✓'}</p>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Sezione Plafond Stoccaggi */}
      <SectionCard icon={Warehouse} title="Plafond Stoccaggi" subtitle="Capacità totale conferibile (kg) - include tutti i conferitori, non solo il raccoglitore" count={stoccaggi.length}>
        {stoccaggi.length === 0 ? (
          <p className="text-center text-muted-foreground py-6">Nessuno stoccaggio configurato. Configura un fornitore di tipo "stoccaggio" in Predittività → Configurazione.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Stoccaggio</th>
                  <th className="text-left px-3 py-2 font-semibold">Impianto collegato</th>
                  <th className="text-right px-3 py-2 font-semibold">Plafond (kg)</th>
                </tr>
              </thead>
              <tbody>
                {stoccaggi.map(f => (
                  <tr key={f.id} className="border-t hover:bg-muted/20">
                    <td className="px-3 py-2 font-medium">{f.nome}</td>
                    <td className="px-3 py-2 text-muted-foreground">{f.impianto_nome || '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <EditableCell value={f.plafond_stoccaggio_kg || 0} onSave={(v) => savePlafond(f, v)} unit="kg" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}