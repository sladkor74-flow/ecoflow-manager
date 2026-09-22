import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Trash2, Edit3 } from 'lucide-react';
import { normalizzaRagioneSociale } from '@/lib/normalizzaRagioneSocialeClient';
import { formatKg } from '@/lib/utils';
import { oggiRoma } from '@/lib/giornoItaliano';

// L'anno di lavoro e' quello del giorno italiano, come nella funzione che
// calcola il piano. La fine della programmazione al 18 dicembre vale solo per il
// 2026 (base44/shared/fineProgrammazione.ts): per gli altri anni resta da
// scrivere, e finche' manca la funzione usa il 31 dicembre e lo dice.
const annoCorrente = () => Number(oggiRoma().slice(0, 4));
const fineDefault = () => (annoCorrente() === 2026 ? '2026-12-18' : '');
const it = (g) => (g ? String(g).slice(0, 10).split('-').reverse().join('/') : '');

function ruoloBadgeClass(ruolo) {
  switch (ruolo) {
    case 'raccoglitore': return 'bg-sky-100 text-sky-700 border-sky-300';
    case 'impianto': return 'bg-blue-100 text-blue-700 border-blue-300';
    case 'stoccaggio': return 'bg-amber-100 text-amber-700 border-amber-300';
    case 'doppio_ruolo': return 'bg-violet-100 text-violet-700 border-violet-300';
    default: return 'bg-muted text-muted-foreground border-border';
  }
}

function InlineEditTarget({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(value || 0));
  const [saving, setSaving] = useState(false);

  useEffect(() => { setVal(String(value || 0)); }, [value]);

  const commit = async () => {
    setEditing(false);
    const num = Number(String(val).replace(/\./g, '').replace(',', '.'));
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
        className="w-28 text-sm border border-primary rounded px-1 py-0.5 focus:outline-none"
      />
    );
  }
  return (
    <span className="font-medium text-foreground cursor-text hover:bg-primary/10 rounded px-1 inline-flex items-center" onClick={() => setEditing(true)}>
      {formatKg(value || 0)}
      <Edit3 className="w-3 h-3 ml-1 opacity-40" />
    </span>
  );
}

export default function PredittivitaImpiantiManager({ onReload }) {
  const [impianti, setImpianti] = useState([]);
  const [fornitori, setFornitori] = useState([]);
  const [targetMap, setTargetMap] = useState({}); // nomeNormalizzato -> target_kg
  const [loading, setLoading] = useState(true);
  const [showImpiantoForm, setShowImpiantoForm] = useState(false);
  const [fornitoreFormFor, setFornitoreFormFor] = useState(null);
  const [impiantoForm, setImpiantoForm] = useState({ nome_impianto: '', target: 0, data_fine: fineDefault() });
  const [fornitoreForm, setFornitoreForm] = useState({ nome: '', ruolo: 'raccoglitore', plafond_stoccaggio_kg: 0 });

  const load = async () => {
    setLoading(true);
    try {
      const [imps, forns, targets] = await Promise.all([
        base44.entities.ImpiantoTargetSecondaria.list('-created_date', 50),
        base44.entities.FornitoreSecondaria.list('-created_date', 200),
        base44.entities.TargetRaccoglitore.filter({ anno: annoCorrente() }),
      ]);
      setImpianti(imps); setFornitori(forns);
      // Target di rete (gli unici che esistono). Un raccoglitore diviso per
      // regione ha piu' righe: si sommano, come fa la funzione del piano;
      // prima qui vinceva l'ultima riga letta e il numero non tornava col piano.
      const tm = {};
      for (const t of targets) {
        const key = normalizzaRagioneSociale(t.raccoglitore);
        if (key) tm[key] = (tm[key] || 0) + (t.target_tonnellate || 0) * 1000;
      }
      setTargetMap(tm);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addImpianto = async () => {
    if (!impiantoForm.nome_impianto) return;
    await base44.entities.ImpiantoTargetSecondaria.create({ ...impiantoForm, target: Number(impiantoForm.target), stato: 'attivo' });
    setImpiantoForm({ nome_impianto: '', target: 0, data_fine: fineDefault() });
    setShowImpiantoForm(false); load(); onReload();
  };

  const addFornitore = async (impiantoId) => {
    if (!fornitoreForm.nome) return;
    const imp = impianti.find(i => i.id === impiantoId);
    const isStocRole = fornitoreForm.ruolo === 'stoccaggio' || fornitoreForm.ruolo === 'doppio_ruolo';
    await base44.entities.FornitoreSecondaria.create({
      nome: fornitoreForm.nome, impianto_id: impiantoId, impianto_nome: imp?.nome_impianto,
      ruolo: fornitoreForm.ruolo, tipo: isStocRole ? 'stoccaggio' : 'primaria_diretta', stato: 'attivo',
      plafond_stoccaggio_kg: isStocRole ? Number(fornitoreForm.plafond_stoccaggio_kg) : 0,
    });
    setFornitoreForm({ nome: '', ruolo: 'raccoglitore', plafond_stoccaggio_kg: 0 }); setFornitoreFormFor(null); load(); onReload();
  };

  const updateImpianto = async (imp, patch) => {
    await base44.entities.ImpiantoTargetSecondaria.update(imp.id, patch);
    load(); onReload();
  };

  const removeImpianto = async (imp) => {
    if (!confirm(`Eliminare ${imp.nome_impianto}?`)) return;
    await base44.entities.ImpiantoTargetSecondaria.delete(imp.id); load(); onReload();
  };

  const removeFornitore = async (f) => {
    if (!confirm(`Eliminare ${f.nome}?`)) return;
    await base44.entities.FornitoreSecondaria.delete(f.id); load(); onReload();
  };

  const updateFornitore = async (f, patch) => {
    await base44.entities.FornitoreSecondaria.update(f.id, patch);
    load(); onReload();
  };

  if (loading) return <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin inline" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-heading font-semibold">Impianti Target ({impianti.length})</h2>
        <Button size="sm" onClick={() => setShowImpiantoForm(!showImpiantoForm)}><Plus className="w-4 h-4 mr-1" /> Aggiungi Impianto</Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Solo rete: ACI ed extra raccolta non entrano nella predittività. Il target dell&apos;impianto è quello di rete, e fra i fornitori
        vanno registrati solo raccoglitori e stoccaggi che lavorano sulla rete: chi lavora solo per l&apos;ACI o l&apos;extra raccolta non ha
        niente da pianificare qui, e la pagina lo segnala.
        {/* Regola del 22/09/2026: le primarie scaricate nel piazzale dell'impianto sono gia' nel suo gia' arrivato, e i viaggi dal piazzale all'impianto non si contano. */}
        {' '}Il piazzale dell&apos;impianto stesso non va registrato come suo stoccaggio: le primarie che ci arrivano sono già nel
        già arrivato di rete dell&apos;impianto (tolto quello che riparte per gli altri impianti, che lo contano loro), e i viaggi dal
        piazzale all&apos;impianto non abbassano il residuo. Va registrato solo come stoccaggio degli altri impianti a cui spedisce.
      </p>

      {showImpiantoForm && (
        <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
          <div className="grid grid-cols-3 gap-2">
            <Input placeholder="Nome impianto" value={impiantoForm.nome_impianto} onChange={e => setImpiantoForm({ ...impiantoForm, nome_impianto: e.target.value })} />
            <Input type="number" placeholder="Target (kg)" value={impiantoForm.target} onChange={e => setImpiantoForm({ ...impiantoForm, target: e.target.value })} />
            <Input type="date" value={impiantoForm.data_fine} onChange={e => setImpiantoForm({ ...impiantoForm, data_fine: e.target.value })} />
          </div>
          <Button size="sm" onClick={addImpianto}>Salva</Button>
        </div>
      )}

      {impianti.map(imp => (
        <div key={imp.id} className="border rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-heading font-semibold">{imp.nome_impianto}</h3>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                Target:
                <InlineEditTarget value={imp.target || 0} onSave={(v) => updateImpianto(imp, { target: v })} />
                <span>kg di rete · Scadenza: {imp.data_fine ? it(imp.data_fine) : (fineDefault() ? it(fineDefault()) : '31/12, finché non si scrive la fine della programmazione')}</span>
              </p>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => setFornitoreFormFor(fornitoreFormFor === imp.id ? null : imp.id)}><Plus className="w-4 h-4 mr-1" /> Fornitore</Button>
              <button onClick={() => removeImpianto(imp)} className="p-2 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
            </div>
          </div>
          {fornitoreFormFor === imp.id && (
            <div className="border rounded p-2 bg-muted/30 flex flex-wrap gap-2">
              <Input placeholder="Nome fornitore" value={fornitoreForm.nome} onChange={e => setFornitoreForm({ ...fornitoreForm, nome: e.target.value })} className="flex-1 min-w-[180px]" />
              <select value={fornitoreForm.ruolo} onChange={e => setFornitoreForm({ ...fornitoreForm, ruolo: e.target.value })} className="border rounded px-2 text-sm bg-background">
                <option value="raccoglitore">Raccoglitore</option>
                <option value="impianto">Impianto</option>
                <option value="stoccaggio">Stoccaggio</option>
                <option value="doppio_ruolo">Doppio ruolo (impianto+stoccaggio)</option>
              </select>
              {(fornitoreForm.ruolo === 'stoccaggio' || fornitoreForm.ruolo === 'doppio_ruolo') && (
                <Input type="number" placeholder="Plafond stoccaggio (kg)" value={fornitoreForm.plafond_stoccaggio_kg} onChange={e => setFornitoreForm({ ...fornitoreForm, plafond_stoccaggio_kg: e.target.value })} className="w-48" />
              )}
              <Button size="sm" onClick={() => addFornitore(imp.id)}>Salva</Button>
            </div>
          )}
          <div className="space-y-1">
            {fornitori.filter(f => f.impianto_id === imp.id).map(f => (
              <div key={f.id} className="border rounded px-2 py-1.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm flex items-center gap-1.5">
                    {f.nome}
                    <select
                      value={f.ruolo || (f.tipo === 'stoccaggio' ? 'stoccaggio' : 'raccoglitore')}
                      onChange={e => {
                        const newRuolo = e.target.value;
                        const isStoc = newRuolo === 'stoccaggio' || newRuolo === 'doppio_ruolo';
                        updateFornitore(f, { ruolo: newRuolo, tipo: isStoc ? 'stoccaggio' : 'primaria_diretta' });
                      }}
                      className={`text-[10px] border rounded px-1 py-0.5 bg-background font-semibold ${ruoloBadgeClass(f.ruolo || (f.tipo === 'stoccaggio' ? 'stoccaggio' : 'raccoglitore'))}`}
                    >
                      <option value="raccoglitore">Raccoglitore</option>
                      <option value="impianto">Impianto</option>
                      <option value="stoccaggio">Stoccaggio</option>
                      <option value="doppio_ruolo">Doppio ruolo</option>
                    </select>
                  </span>
                  <button onClick={() => removeFornitore(f)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-3 h-3 text-red-500" /></button>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Target annuo di rete (da Target Annuali): <span className="font-medium text-foreground">{formatKg(targetMap[normalizzaRagioneSociale(f.nome)] || 0)} kg</span>
                    {(f.ruolo === 'stoccaggio' || f.ruolo === 'doppio_ruolo' || (!f.ruolo && f.tipo === 'stoccaggio')) && f.plafond_stoccaggio_kg != null && (
                      <span className="ml-2">· Plafond: <span className="font-medium text-foreground">{formatKg(f.plafond_stoccaggio_kg || 0)} kg</span></span>
                    )}
                  </span>
                  <span className="flex items-center gap-1">Ipotesi mese corr.:
                    <InlineEditTarget value={f.ipotesi_mese_corrente || 0} onSave={(v) => updateFornitore(f, { ipotesi_mese_corrente: v })} />
                  </span>
                </div>
              </div>
            ))}
            {fornitori.filter(f => f.impianto_id === imp.id).length === 0 && <p className="text-xs text-muted-foreground">Nessun fornitore configurato.</p>}
          </div>
        </div>
      ))}
    </div>
  );
}