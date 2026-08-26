import React, { useState } from 'react';
import { Loader2, Edit3, Warehouse, Truck } from 'lucide-react';
import { base44 } from '@/api/base44Client';

function fmt(n) { return (n || 0).toLocaleString('it-IT'); }

function EditableCell({ value, onSave, disabled }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(value || 0));
  const [saving, setSaving] = useState(false);

  const commit = async () => {
    setEditing(false);
    const num = Number(val.replace(/\./g, '').replace(',', '.'));
    if (Number.isNaN(num) || num === value) return;
    setSaving(true);
    try { await onSave(num); } catch (e) { /* ignore */ }
    setSaving(false);
  };

  if (saving) return <td className="px-2 py-1.5 text-right"><Loader2 className="w-3 h-3 animate-spin inline" /></td>;
  if (editing && !disabled) {
    return (
      <td className="px-1 py-1">
        <input
          autoFocus
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditing(false); setVal(String(value || 0)); } }}
          className="w-20 text-right text-xs border border-primary rounded px-1 py-0.5 focus:outline-none"
        />
      </td>
    );
  }
  return (
    <td
      className={`px-2 py-1.5 text-right text-xs group ${disabled ? '' : 'cursor-text hover:bg-primary/10'}`}
      onClick={() => !disabled && setEditing(true)}
      title={disabled ? '' : 'Click per modificare'}
    >
      {fmt(value)}
      {!disabled && <Edit3 className="w-2.5 h-2.5 inline ml-0.5 opacity-0 group-hover:opacity-50" />}
    </td>
  );
}

export default function PredittivitaSettimanale({ data, onReload }) {
  if (!data || !data.impianti || data.impianti.length === 0) {
    return <div className="text-center py-8 text-muted-foreground border rounded-lg">Nessun dato.</div>;
  }

  const settimane = data.settimane || [];
  const impianti = data.impianti;

  const saveCell = async (week, field, value) => {
    if (!week.record_id) return;
    const patch = { modificato_manuale: true };
    patch[field] = value;
    if (field === 'kg_previsti') patch.viaggi_previsti = Math.ceil(value / 14000);
    if (field === 'kg_effettivi') patch.viaggi_effettivi = value > 0 ? Math.ceil(value / 14000) : 0;
    await base44.entities.PianificazioneSettimanale.update(week.record_id, patch);
    if (onReload) onReload();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-heading font-semibold">Pianificazione Settimanale per Fornitore</h2>
        <p className="text-xs text-muted-foreground">Click su una cella PREV per override manuale. Settimane con EXEC reale congelate.</p>
      </div>
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-3 py-2 font-semibold sticky left-0 bg-muted" rowSpan={2}>Fornitore</th>
              {settimane.map(s => (
                <th key={s.numero} className="text-center px-2 py-1 font-semibold text-xs" colSpan={3}>{s.mese.slice(0,3)} {s.data_inizio.slice(8)}</th>
              ))}
              <th className="text-right px-3 py-2 font-semibold sticky right-0 bg-muted" rowSpan={2}>Res. cascata</th>
            </tr>
            <tr>
              {settimane.map(s => (
                <React.Fragment key={s.numero + '-sub'}>
                  <th className="text-right px-1 py-0.5 font-medium text-[10px]">PREV</th>
                  <th className="text-right px-1 py-0.5 font-medium text-[10px]">EXEC</th>
                  <th className="text-right px-1 py-0.5 font-medium text-[10px]">Δ</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {impianti.map(imp => (
              <React.Fragment key={imp.impianto.id}>
                <tr className="bg-primary/10">
                  <td className="px-3 py-2 font-bold uppercase text-xs sticky left-0 bg-primary/10" colSpan={settimane.length * 3 + 2}>
                    {imp.impianto.nome} · Target {fmt(imp.impianto.target)} · Consuntivo {fmt(imp.consuntivo)} · Residuo {fmt(imp.residuo)}
                  </td>
                </tr>
                {(imp.fornitori || []).map(f => {
                  const isStocc = f.tipo === 'stoccaggio';
                  const lastCascata = f.piano_settimanale?.length > 0 ? f.piano_settimanale[f.piano_settimanale.length - 1].residuo_cascata : 0;
                  const cascataColor = Math.abs(lastCascata) < 1000 ? 'text-green-700' : lastCascata > 0 ? 'text-amber-600' : 'text-red-600';
                  return (
                    <tr key={f.id} className={`border-t hover:bg-muted/20 ${isStocc ? 'bg-primary/5' : ''}`}>
                      <td className="px-3 py-1.5 text-xs font-medium sticky left-0 bg-background flex items-center gap-1.5">
                        {isStocc ? <Warehouse className="w-3 h-3 text-primary" /> : <Truck className="w-3 h-3 text-accent" />}
                        {f.nome}
                      </td>
                      {settimane.map((s, i) => {
                        const w = f.piano_settimanale?.[i];
                        if (!w) return <React.Fragment key={i}><td /><td /><td /></React.Fragment>;
                        const deltaColor = w.delta > 14000 ? 'text-amber-600' : w.delta < -14000 ? 'text-red-600' : 'text-green-600';
                        return (
                          <React.Fragment key={i}>
                            <EditableCell value={w.prev} onSave={(v) => saveCell(w, 'kg_previsti', v)} disabled={w.congelata} />
                            <EditableCell value={w.exec} onSave={(v) => saveCell(w, 'kg_effettivi', v)} />
                            <td className={`px-1 py-1.5 text-right text-xs font-medium ${deltaColor}`}>{w.delta > 0 ? '+' : ''}{fmt(w.delta)}</td>
                          </React.Fragment>
                        );
                      })}
                      <td className={`px-3 py-1.5 text-right text-xs font-bold sticky right-0 bg-background ${cascataColor}`}>{fmt(lastCascata)}</td>
                    </tr>
                  );
                })}
                {/* Riga totale impianto */}
                <tr className="border-t bg-muted/30 font-bold">
                  <td className="px-3 py-2 text-xs sticky left-0 bg-muted/30">TOTALE {imp.impianto.nome}</td>
                  {settimane.map((s, i) => {
                    const totPrev = (imp.fornitori || []).reduce((sum, f) => sum + (f.piano_settimanale?.[i]?.prev || 0), 0);
                    const totExec = (imp.fornitori || []).reduce((sum, f) => sum + (f.piano_settimanale?.[i]?.exec || 0), 0);
                    const totDelta = totPrev - totExec;
                    return (
                      <React.Fragment key={i}>
                        <td className="px-1 py-1.5 text-right text-xs">{fmt(totPrev)}</td>
                        <td className="px-1 py-1.5 text-right text-xs">{fmt(totExec)}</td>
                        <td className="px-1 py-1.5 text-right text-xs">{totDelta > 0 ? '+' : ''}{fmt(totDelta)}</td>
                      </React.Fragment>
                    );
                  })}
                  <td className="px-3 py-2 text-right text-xs sticky right-0 bg-muted/30">{fmt(imp.residuo)}</td>
                </tr>
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}