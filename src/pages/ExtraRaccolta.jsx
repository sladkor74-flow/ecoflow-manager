import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Pencil, Trash2, Copy, FileSpreadsheet, FileText } from 'lucide-react';
import { MESI } from '@/lib/pfuConstants';
import { calcExtraRaccolta } from '@/lib/extraRaccoltaCalc';
import { formatNumber } from '@/lib/utils';
import { exportExtraRaccoltaExcel, exportExtraRaccoltaPDF } from '@/lib/extraRaccoltaExport';
import ExtraRaccoltaForm from '@/components/fatturazione/ExtraRaccoltaForm';

const ANNI = [2024, 2025, 2026];

export default function ExtraRaccolta() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ anno: '', mese: '', trasportatore: '', destinazione: '', tipologia_trasporto: '' });
  const [formOpen, setFormOpen] = useState(false);
  const [formInitial, setFormInitial] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const all = await base44.entities.ExtraRaccolta.list('-created_date', 5000);
      setRecords(all);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return records.filter(r => {
      if (filters.anno && String(r.anno) !== String(filters.anno)) return false;
      if (filters.mese && r.mese !== filters.mese) return false;
      if (filters.trasportatore && r.trasportatore !== filters.trasportatore) return false;
      if (filters.destinazione && r.destinazione !== filters.destinazione) return false;
      if (filters.tipologia_trasporto && r.tipologia_trasporto !== filters.tipologia_trasporto) return false;
      return true;
    }).sort((a, b) => {
      const da = a.trasporto_finito_il ? new Date(a.trasporto_finito_il).getTime() : 0;
      const db = b.trasporto_finito_il ? new Date(b.trasporto_finito_il).getTime() : 0;
      return db - da;
    });
  }, [records, filters]);

  const kpi = useMemo(() => {
    let tonnellate = 0, ricavi = 0, costi = 0, margine = 0;
    for (const r of filtered) {
      const c = calcExtraRaccolta(r);
      tonnellate += c.tonnellate;
      ricavi += c.ricavo;
      costi += c.costo_totale;
      margine += c.margine;
    }
    const margine_perc = ricavi !== 0 ? (margine / ricavi * 100) : 0;
    return { tonnellate, ricavi, costi, margine, margine_perc };
  }, [filtered]);

  const trasportatori = useMemo(() => [...new Set(records.map(r => r.trasportatore).filter(Boolean))].sort(), [records]);
  const destinatari = useMemo(() => [...new Set(records.map(r => r.destinazione).filter(Boolean))].sort(), [records]);
  const tipologie = useMemo(() => [...new Set(records.map(r => r.tipologia_trasporto).filter(Boolean))].sort(), [records]);

  const save = async (payload) => {
    try {
      if (formInitial?.id) {
        await base44.entities.ExtraRaccolta.update(formInitial.id, payload);
      } else {
        await base44.entities.ExtraRaccolta.create(payload);
      }
      setFormOpen(false);
      setFormInitial(null);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const remove = async (r) => {
    if (!confirm('Eliminare questo intervento?')) return;
    await base44.entities.ExtraRaccolta.delete(r.id);
    load();
  };

  const duplicate = (r) => {
    const { id, numero_fir, trasporto_iniziato_il, trasporto_finito_il, created_date, updated_date, created_by_id, ...rest } = r;
    setFormInitial({ ...rest, numero_fir: '', trasporto_iniziato_il: null, trasporto_finito_il: null });
    setFormOpen(true);
  };

  const exportExcel = () => {
    const mese = filters.mese || 'Tutti';
    const anno = filters.anno || new Date().getFullYear();
    exportExtraRaccoltaExcel(filtered, mese, anno);
  };

  const exportPDF = () => {
    const mese = filters.mese || 'Tutti';
    const anno = filters.anno || new Date().getFullYear();
    exportExtraRaccoltaPDF(filtered, mese, anno);
  };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold">Extra Raccolta</h1>
          <p className="text-muted-foreground mt-1">Inserimento e gestione interventi extra raccolta (canale RETE).</p>
        </div>
        <Button onClick={() => { setFormInitial(null); setFormOpen(true); }}>
          <Plus className="w-4 h-4 mr-1.5" /> Aggiungi intervento
        </Button>
      </div>

      {/* Filtri */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 border rounded-lg bg-muted/30">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Anno</label>
          <Select value={filters.anno ? String(filters.anno) : 'all'} onValueChange={v => setFilters({ ...filters, anno: v === 'all' ? '' : Number(v) })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti</SelectItem>
              {ANNI.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Mese</label>
          <Select value={filters.mese || 'all'} onValueChange={v => setFilters({ ...filters, mese: v === 'all' ? '' : v })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti</SelectItem>
              {MESI.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Trasportatore</label>
          <Select value={filters.trasportatore || 'all'} onValueChange={v => setFilters({ ...filters, trasportatore: v === 'all' ? '' : v })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti</SelectItem>
              {trasportatori.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Destinatario</label>
          <Select value={filters.destinazione || 'all'} onValueChange={v => setFilters({ ...filters, destinazione: v === 'all' ? '' : v })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti</SelectItem>
              {destinatari.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Tipologia trasporto</label>
          <Select value={filters.tipologia_trasporto || 'all'} onValueChange={v => setFilters({ ...filters, tipologia_trasporto: v === 'all' ? '' : v })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte</SelectItem>
              {tipologie.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="border rounded-lg p-3 bg-card">
          <div className="text-xs text-muted-foreground">Tonnellate</div>
          <div className="text-lg font-bold tabular-nums">{formatNumber(kpi.tonnellate)} t</div>
        </div>
        <div className="border rounded-lg p-3 bg-card">
          <div className="text-xs text-muted-foreground">Ricavi</div>
          <div className="text-lg font-bold tabular-nums">€ {formatNumber(kpi.ricavi, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div className="border rounded-lg p-3 bg-card">
          <div className="text-xs text-muted-foreground">Costi</div>
          <div className="text-lg font-bold tabular-nums">€ {formatNumber(kpi.costi, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div className="border rounded-lg p-3 bg-card">
          <div className="text-xs text-muted-foreground">Margine</div>
          <div className={`text-lg font-bold tabular-nums ${kpi.margine >= 0 ? 'text-success' : 'text-destructive'}`}>
            € {formatNumber(kpi.margine, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="text-xs font-normal ml-1">({formatNumber(kpi.margine_perc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%)</span>
          </div>
        </div>
      </div>

      {/* Export */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={exportExcel} disabled={filtered.length === 0}>
          <FileSpreadsheet className="w-4 h-4 mr-1.5" /> Esporta Excel
        </Button>
        <Button variant="outline" size="sm" onClick={exportPDF} disabled={filtered.length === 0}>
          <FileText className="w-4 h-4 mr-1.5" /> Esporta PDF
        </Button>
      </div>

      {/* Tabella */}
      {loading ? (
        <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          Nessun intervento trovato. Clicca "Aggiungi intervento" per inserirne uno nuovo.
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Nr. FIR</th>
                <th className="text-left px-3 py-2 font-semibold">Data fine trasporto</th>
                <th className="text-left px-3 py-2 font-semibold">Produttore o stoccaggio</th>
                <th className="text-left px-3 py-2 font-semibold">Trasportatore</th>
                <th className="text-left px-3 py-2 font-semibold">Destinatario</th>
                <th className="text-left px-3 py-2 font-semibold">Tipologia</th>
                <th className="text-left px-3 py-2 font-semibold">Classe</th>
                <th className="text-right px-3 py-2 font-semibold">Quantità (kg)</th>
                <th className="text-right px-3 py-2 font-semibold">Ricavo</th>
                <th className="text-right px-3 py-2 font-semibold">Costo totale</th>
                <th className="text-right px-3 py-2 font-semibold">Margine</th>
                <th className="text-center px-3 py-2 font-semibold">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const c = calcExtraRaccolta(r);
                return (
                  <tr key={r.id} className="border-t hover:bg-muted/20">
                    <td className="px-3 py-2 font-mono text-xs">{r.numero_fir || '-'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.trasporto_finito_il ? new Date(r.trasporto_finito_il).toLocaleDateString('it-IT') : '-'}</td>
                    <td className="px-3 py-2 text-xs">
                      {r.tipo_movimento === 'secondaria' && <span className="inline-block mr-1 px-1.5 py-0.5 rounded bg-accent/15 text-[10px] font-medium uppercase tracking-wide">Secondaria</span>}
                      {(r.tipo_movimento === 'secondaria' ? r.stoccaggio : r.produttore) || '-'}
                    </td>
                    <td className="px-3 py-2 text-xs">{r.trasportatore || '-'}</td>
                    <td className="px-3 py-2 text-xs">{r.destinazione || '-'}</td>
                    <td className="px-3 py-2 text-xs">{r.tipologia_trasporto || '-'}</td>
                    <td className="px-3 py-2">{r.classe || '-'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatNumber(r.peso_effettivo || 0)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">€ {formatNumber(c.ricavo, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2 text-right tabular-nums">€ {formatNumber(c.costo_totale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className={`px-3 py-2 text-right tabular-nums font-medium ${c.margine >= 0 ? 'text-success' : 'text-destructive'}`}>
                      € {formatNumber(c.margine, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 justify-center">
                        <button onClick={() => { setFormInitial(r); setFormOpen(true); }} className="p-1 hover:bg-muted rounded" title="Modifica"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => duplicate(r)} className="p-1 hover:bg-muted rounded" title="Duplica"><Copy className="w-3.5 h-3.5" /></button>
                        <button onClick={() => remove(r)} className="p-1 hover:bg-red-50 rounded" title="Elimina"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ExtraRaccoltaForm
        open={formOpen}
        initial={formInitial}
        onSave={save}
        onCancel={() => { setFormOpen(false); setFormInitial(null); }}
      />
    </div>
  );
}