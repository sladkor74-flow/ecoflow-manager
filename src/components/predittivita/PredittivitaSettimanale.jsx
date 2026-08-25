import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Edit3 } from 'lucide-react';
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
          className="w-full text-right text-sm border border-primary rounded px-1 py-0.5 focus:outline-none"
        />
      </td>
    );
  }
  return (
    <td
      className={`px-2 py-1.5 text-right text-sm group ${disabled ? '' : 'cursor-text hover:bg-primary/10'}`}
      onClick={() => !disabled && setEditing(true)}
      title={disabled ? '' : 'Click per modificare'}
    >
      {fmt(value)}
      {!disabled && <Edit3 className="w-3 h-3 inline ml-1 opacity-0 group-hover:opacity-50" />}
    </td>
  );
}

export default function PredittivitaSettimanale({ data, onReload }) {
  const [expanded, setExpanded] = useState(null);

  if (!data || !data.impianti || data.impianti.length === 0) {
    return <div className="text-center py-8 text-muted-foreground border rounded-lg">Nessun dato.</div>;
  }

  const settimane = data.settimane || [];
  const impianti = data.impianti;
  const colCount = 2 + impianti.length * 3 + 1;

  const saveCell = async (imp, week, field, value) => {
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
        <h2 className="font-heading font-semibold">Pianificazione Settimanale Editabile</h2>
        <p className="text-xs text-muted-foreground">Click su una cella PREV/EXEC per override manuale. Le settimane con EXEC reale sono congelate.</p>
      </div>
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-3 py-2 font-semibold" rowSpan={2}>Sett.</th>
              <th className="text-left px-3 py-2 font-semibold" rowSpan={2}>Periodo</th>
              {impianti.map(imp => (
                <th key={imp.impianto.id} className="text-center px-3 py-2 font-semibold uppercase" colSpan={3}>{imp.impianto.nome}</th>
              ))}
              <th className="text-right px-3 py-2 font-semibold" rowSpan={2}>Tot kg</th>
            </tr>
            <tr>
              {impianti.map(imp => (
                <React.Fragment key={imp.impianto.id + '-sub'}>
                  <th className="text-right px-2 py-1 font-medium text-xs">PREV kg</th>
                  <th className="text-right px-2 py-1 font-medium text-xs">EXEC kg</th>
                  <th className="text-right px-2 py-1 font-medium text-xs">Δ kg</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {settimane.map((sett, i) => {
              const isExp = expanded === i;
              const totPrev = impianti.reduce((s, imp) => s + (imp.piano_settimanale?.[i]?.prev || 0), 0);
              return (
                <React.Fragment key={i}>
                  <tr className={`cursor-pointer hover:bg-muted/30 ${isExp ? 'bg-muted/40' : ''} ${i % 2 ? 'bg-muted/10' : ''}`} onClick={() => setExpanded(isExp ? null : i)}>
                    <td className="px-3 py-2 font-medium">{isExp ? <ChevronDown className="w-4 h-4 inline" /> : <ChevronRight className="w-4 h-4 inline" />} {sett.numero}</td>
                    <td className="px-3 py-2 text-xs">{sett.data_inizio} → {sett.data_fine}</td>
                    {impianti.map(imp => {
                      const w = imp.piano_settimanale?.[i];
                      if (!w) return <React.Fragment key={imp.impianto.id}><td /><td /><td /></React.Fragment>;
                      const deltaColor = w.delta > 14000 ? 'text-amber-600' : w.delta < -14000 ? 'text-red-600' : 'text-green-600';
                      return (
                        <React.Fragment key={imp.impianto.id}>
                          <EditableCell value={w.prev} onSave={(v) => saveCell(imp, w, 'kg_previsti', v)} disabled={w.congelata} />
                          <EditableCell value={w.exec} onSave={(v) => saveCell(imp, w, 'kg_effettivi', v)} />
                          <td className={`px-2 py-1.5 text-right text-sm font-medium ${deltaColor}`}>{w.delta > 0 ? '+' : ''}{fmt(w.delta)}</td>
                        </React.Fragment>
                      );
                    })}
                    <td className="px-3 py-2 text-right font-bold">{fmt(totPrev)}</td>
                  </tr>
                  {isExp && (
                    <tr className="bg-muted/10">
                      <td colSpan={colCount} className="p-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {impianti.map(imp => {
                            const w = imp.piano_settimanale?.[i];
                            if (!w) return null;
                            return (
                              <div key={imp.impianto.id} className="border rounded p-2">
                                <h4 className="text-xs font-semibold mb-1 uppercase">{imp.impianto.nome}</h4>
                                <div className="text-xs space-y-0.5">
                                  <div className="flex justify-between"><span>PREV</span><span className="font-medium">{fmt(w.prev)} kg · {w.viaggi_prev} viaggi</span></div>
                                  <div className="flex justify-between"><span>EXEC</span><span className="font-medium">{fmt(w.exec)} kg · {w.viaggi_eff} viaggi {w.congelata ? '🔒' : ''}</span></div>
                                  <div className="flex justify-between"><span>Δ</span><span className="font-medium">{w.delta > 0 ? '+' : ''}{fmt(w.delta)} kg</span></div>
                                  {w.override && <p className="text-amber-600">Override manuale attivo</p>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-primary text-primary-foreground font-bold">
              <td className="px-3 py-3" colSpan={2}>TOTALE PIANIFICATO</td>
              {impianti.map(imp => (
                <React.Fragment key={imp.impianto.id}>
                  <td className="px-2 py-3 text-right">{fmt(imp.totale_pianificato)}</td>
                  <td className="px-2 py-3 text-right">{fmt(imp.consuntivo)}</td>
                  <td className="px-2 py-3 text-right">{fmt(imp.totale_pianificato - imp.consuntivo)}</td>
                </React.Fragment>
              ))}
              <td className="px-3 py-3 text-right">{fmt(impianti.reduce((s, imp) => s + imp.totale_pianificato, 0))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}