import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Calendar, Layers, Edit3, Loader2, Warehouse, Truck, Factory } from 'lucide-react';
import { normalizzaRagioneSociale } from '@/lib/normalizzaRagioneSocialeClient';

function fmt(n) { return (n || 0).toLocaleString('it-IT'); }

function EditableIpotesi({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(value || 0));
  const [saving, setSaving] = useState(false);

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
        className="w-24 text-xs border border-primary rounded px-1 py-0.5 focus:outline-none"
      />
    );
  }
  return (
    <span className="font-medium text-foreground cursor-text hover:bg-primary/10 rounded px-1 inline-flex items-center" onClick={() => setEditing(true)}>
      {fmt(value)}
      <Edit3 className="w-3 h-3 ml-1 opacity-40" />
    </span>
  );
}

function TipoBadge({ tipo }) {
  if (tipo === 'stoccaggio') {
    return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary text-primary-foreground"><Warehouse className="w-2.5 h-2.5" />Stoccaggio</span>;
  }
  return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-accent text-accent-foreground"><Truck className="w-2.5 h-2.5" />Primaria diretta</span>;
}

export default function PredittivitaDashboard({ data, onReload }) {
  if (!data || !data.impianti || data.impianti.length === 0) {
    return <div className="text-center py-8 text-muted-foreground border rounded-lg">Nessun impianto configurato. Vai in "Configurazione" per aggiungerne.</div>;
  }

  const saveIpotesi = async (fornitoreId, value) => {
    await base44.entities.FornitoreSecondaria.update(fornitoreId, { ipotesi_mese_corrente: value });
    if (onReload) onReload();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30 flex-wrap gap-2">
        <div className="text-sm"><span className="text-muted-foreground">Periodo: </span><span className="font-medium">{data.data_inizio} → {data.data_fine}</span></div>
        <div className="text-sm"><span className="text-muted-foreground">Settimane: </span><span className="font-bold">{data.num_settimane}</span></div>
      </div>

      {/* Plafond Stoccaggi (generalizzato) */}
      {data.stoccaggi && data.stoccaggi.length > 0 && (
        <div className="space-y-3">
          {data.stoccaggi.map(stoc => {
            const pct = stoc.plafond > 0 ? Math.min(100, (stoc.kg_partiti / stoc.plafond) * 100) : 0;
            return (
              <div key={stoc.nome_normalizzato} className="border rounded-lg p-4 bg-gradient-to-r from-primary/10 to-accent/10">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Layers className="w-4 h-4 text-primary" />
                  <h3 className="font-heading font-semibold">Plafond {stoc.nome} (stoccaggio)</h3>
                  <span className="text-xs text-muted-foreground">→ {stoc.impianti_collegati?.join(', ') || '—'}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">Plafond</p><p className="font-bold">{fmt(stoc.plafond)} kg</p></div>
                  <div><p className="text-xs text-muted-foreground">Kg entrati in stoccaggio</p><p className="font-bold text-primary">{fmt(stoc.kg_entrati)} kg</p></div>
                  <div><p className="text-xs text-muted-foreground">Kg partiti (secondarie)</p><p className="font-bold text-amber-600">{fmt(stoc.kg_partiti)} kg</p></div>
                  <div><p className="text-xs text-muted-foreground">Residuo plafond</p><p className="font-bold text-green-700">{fmt(stoc.residuo_plafond)} kg</p></div>
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">Utilizzo plafond</span><span className="font-medium">{pct.toFixed(1)}%</span></div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data.impianti.map(imp => {
          const target = imp.impianto.target || 0;
          const pct = target > 0 ? Math.min(100, (imp.consuntivo / target) * 100) : 0;
          return (
            <div key={imp.impianto.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-heading font-bold text-lg uppercase">{imp.impianto.nome}</h2>
                <span className="text-xs text-muted-foreground">Scadenza: {imp.impianto.data_fine}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <div className="border rounded p-2"><p className="text-xs text-muted-foreground">Target</p><p className="font-bold">{fmt(target)} kg</p></div>
                <div className="border rounded p-2"><p className="text-xs text-muted-foreground">Consuntivo</p><p className="font-bold">{fmt(imp.consuntivo)} kg</p>
                  <p className="text-[10px] text-muted-foreground">Prim {fmt(imp.consuntivo_primarie)} · Sec {fmt(imp.consuntivo_secondarie)}</p></div>
                <div className="border rounded p-2"><p className="text-xs text-muted-foreground">Residuo</p><p className="font-bold text-amber-600">{fmt(imp.residuo)} kg</p></div>
                <div className="border rounded p-2"><p className="text-xs text-muted-foreground">Pianificato</p><p className="font-bold">{fmt(imp.totale_pianificato)} kg</p></div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">Avanzamento</span><span className="font-medium">{pct.toFixed(1)}%</span></div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </div>

              {imp.fornitori && imp.fornitori.length > 0 && (
                <div className="border-t pt-2 space-y-2">
                  <h3 className="text-sm font-semibold">Fornitori ({imp.fornitori.length})</h3>
                  {imp.fornitori.map(f => {
                    const isStocc = f.tipo === 'stoccaggio';
                    const refTarget = isStocc ? target : (f.target_raccoglitore_kg || 0);
                    const refConsuntivo = isStocc ? f.consuntivo_secondarie : f.consuntivo;
                    const fPct = refTarget > 0 ? Math.min(100, (refConsuntivo / refTarget) * 100) : 0;
                    const resColor = f.residuo <= 0 ? 'text-green-700' : 'text-amber-600';
                    return (
                      <div key={f.id} className={`border rounded-lg p-2.5 space-y-1.5 ${isStocc ? 'bg-primary/5' : 'bg-muted/20'}`}>
                        <div className="flex items-center justify-between flex-wrap gap-1">
                          <span className="font-medium text-sm flex items-center gap-1.5">{f.nome} <TipoBadge tipo={f.tipo} /></span>
                          <span className={`text-xs font-bold ${resColor}`}>Residuo: {fmt(f.residuo)} kg</span>
                        </div>
                        {isStocc ? (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 text-xs">
                            <div><span className="text-muted-foreground">Plafond: </span><span className="font-medium">{fmt(f.plafond)}</span></div>
                            <div><span className="text-muted-foreground">Entrati stocc.: </span><span className="font-medium text-primary">{fmt(f.kg_entrati_stoccaggio)}</span></div>
                            <div><span className="text-muted-foreground">Usciti imp.: </span><span className="font-medium">{fmt(f.consuntivo_secondarie)}</span></div>
                            <div><span className="text-muted-foreground">Residuo plafond: </span><span className="font-medium text-green-700">{fmt(f.residuo_plafond)}</span></div>
                            <div><span className="text-muted-foreground">Quota plafond imp.: </span><span className="font-medium">{fmt(f.quota_plafond_impianto)}</span></div>
                            <div className="flex items-center gap-1"><span className="text-muted-foreground">Ipotesi mese corr.: </span>
                              <EditableIpotesi value={f.ipotesi_mese_corrente || 0} onSave={(v) => saveIpotesi(f.id, v)} /></div>
                            <div><span className="text-muted-foreground">Kg/sett: </span><span className="font-medium">{fmt(f.kg_per_settimana)} · {f.viaggi_per_settimana} viaggi</span></div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 text-xs">
                            <div><span className="text-muted-foreground">Target annuo: </span><span className="font-medium">{fmt(f.target_raccoglitore_kg)}</span></div>
                            <div><span className="text-muted-foreground">Consuntivo: </span><span className="font-medium">{fmt(f.consuntivo)}</span></div>
                            <div className="flex items-center gap-1"><span className="text-muted-foreground">Ipotesi mese corr.: </span>
                              <EditableIpotesi value={f.ipotesi_mese_corrente || 0} onSave={(v) => saveIpotesi(f.id, v)} /></div>
                            <div><span className="text-muted-foreground">Kg/sett: </span><span className="font-medium">{fmt(f.kg_per_settimana)} · {f.viaggi_per_settimana} viaggi</span></div>
                          </div>
                        )}
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full ${isStocc ? 'bg-primary' : 'bg-accent'}`} style={{ width: `${fPct}%` }} />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Sett. rimaste: {f.settimane_rimanenti}</span>
                          <span>Avanz.: {fPct.toFixed(1)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="border rounded-lg p-4">
        <h3 className="font-heading font-semibold mb-3">Sintesi per Fornitore</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted"><tr>
              <th className="text-left px-3 py-2 font-semibold">Impianto</th>
              <th className="text-left px-3 py-2 font-semibold">Fornitore</th>
              <th className="text-left px-3 py-2 font-semibold">Tipo</th>
              <th className="text-right px-3 py-2 font-semibold">Target annuo</th>
              <th className="text-right px-3 py-2 font-semibold">Consuntivo</th>
              <th className="text-right px-3 py-2 font-semibold">Ipotesi</th>
              <th className="text-right px-3 py-2 font-semibold">Residuo</th>
              <th className="text-right px-3 py-2 font-semibold">Kg/sett.</th>
              <th className="text-right px-3 py-2 font-semibold">Viaggi/sett.</th>
              <th className="text-right px-3 py-2 font-semibold">Sett. rimaste</th>
            </tr></thead>
            <tbody>
              {data.impianti.flatMap(imp => {
                if (imp.impianto.is_double_role) {
                  const stocMetric = (data.stoccaggi || []).find(s => s.nome_normalizzato === normalizzaRagioneSociale(imp.impianto.nome));
                  return [
                    <tr key={imp.impianto.id + '-imp'} className="border-t bg-primary/5">
                      <td className="px-3 py-2 uppercase text-xs">{imp.impianto.nome}</td>
                      <td className="px-3 py-2 font-medium">{imp.impianto.nome}</td>
                      <td className="px-3 py-2"><span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary text-primary-foreground"><Factory className="w-2.5 h-2.5" />Impianto</span></td>
                      <td className="px-3 py-2 text-right">{fmt(imp.impianto.target)}</td>
                      <td className="px-3 py-2 text-right">{fmt(imp.consuntivo_primarie)}</td>
                      <td className="px-3 py-2 text-right">—</td>
                      <td className={`px-3 py-2 text-right font-bold ${imp.residuo <= 0 ? 'text-green-700' : 'text-amber-600'}`}>{fmt(imp.residuo)}</td>
                      <td className="px-3 py-2 text-right">—</td>
                      <td className="px-3 py-2 text-right">—</td>
                      <td className="px-3 py-2 text-right">—</td>
                    </tr>,
                    ...(imp.conferitori || []).map(c => (
                      <tr key={c.id} className="border-t">
                        <td className="px-3 py-2 uppercase text-xs">{imp.impianto.nome}</td>
                        <td className="px-3 py-2 font-medium">{c.nome} <span className="text-[10px] text-muted-foreground">(auto)</span></td>
                        <td className="px-3 py-2"><TipoBadge tipo="primaria_diretta" /></td>
                        <td className="px-3 py-2 text-right">{fmt(c.target_raccoglitore_kg)}</td>
                        <td className="px-3 py-2 text-right">{fmt(c.consuntivo)}</td>
                        <td className="px-3 py-2 text-right">—</td>
                        <td className={`px-3 py-2 text-right font-bold ${c.residuo <= 0 ? 'text-green-700' : 'text-amber-600'}`}>{fmt(c.residuo)}</td>
                        <td className="px-3 py-2 text-right">{fmt(c.kg_per_settimana)}</td>
                        <td className="px-3 py-2 text-right">{c.viaggi_per_settimana}</td>
                        <td className="px-3 py-2 text-right">—</td>
                      </tr>
                    )),
                    ...(stocMetric ? [(
                      <tr key={imp.impianto.id + '-stoc'} className="border-t bg-accent/5">
                        <td className="px-3 py-2 uppercase text-xs">{imp.impianto.nome}</td>
                        <td className="px-3 py-2 font-medium">{imp.impianto.nome}</td>
                        <td className="px-3 py-2"><span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-accent text-accent-foreground"><Warehouse className="w-2.5 h-2.5" />Stoccaggio</span></td>
                        <td className="px-3 py-2 text-right">{fmt(stocMetric.plafond)}</td>
                        <td className="px-3 py-2 text-right text-primary">{fmt(stocMetric.kg_entrati)}</td>
                        <td className="px-3 py-2 text-right text-amber-600">{fmt(stocMetric.kg_partiti)}</td>
                        <td className={`px-3 py-2 text-right font-bold ${stocMetric.residuo_plafond <= 0 ? 'text-green-700' : 'text-amber-600'}`}>{fmt(stocMetric.residuo_plafond)}</td>
                        <td className="px-3 py-2 text-right">—</td>
                        <td className="px-3 py-2 text-right">—</td>
                        <td className="px-3 py-2 text-right">—</td>
                      </tr>
                    )] : []),
                  ];
                }
                return (imp.fornitori || []).map(f => (
                  <tr key={f.id} className="border-t">
                    <td className="px-3 py-2 uppercase text-xs">{imp.impianto.nome}</td>
                    <td className="px-3 py-2 font-medium">{f.nome}</td>
                    <td className="px-3 py-2"><TipoBadge tipo={f.tipo} /></td>
                    <td className="px-3 py-2 text-right">{fmt(f.target_raccoglitore_kg)}</td>
                    <td className="px-3 py-2 text-right">{fmt(f.consuntivo)}</td>
                    <td className="px-3 py-2 text-right">{fmt(f.ipotesi_mese_corrente)}</td>
                    <td className={`px-3 py-2 text-right font-bold ${f.residuo <= 0 ? 'text-green-700' : 'text-amber-600'}`}>{fmt(f.residuo)}</td>
                    <td className="px-3 py-2 text-right">{fmt(f.kg_per_settimana)}</td>
                    <td className="px-3 py-2 text-right">{f.viaggi_per_settimana}</td>
                    <td className="px-3 py-2 text-right">{f.settimane_rimanenti}</td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}