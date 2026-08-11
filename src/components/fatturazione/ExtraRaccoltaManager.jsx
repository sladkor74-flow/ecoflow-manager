import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, Plus, Trash2, FileSpreadsheet, Pencil } from 'lucide-react';
import ExtraRaccoltaForm from './ExtraRaccoltaForm';

export default function ExtraRaccoltaManager({ periodo }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editRecord, setEditRecord] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const filter = {};
      if (periodo?.mese) filter.mese = periodo.mese;
      setRecords(await base44.entities.ExtraRaccolta.filter(filter, '-created_date', 5000));
    } catch (e) { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, [periodo?.mese]);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const res = await base44.functions.invoke('importEcotyreFile', {
        file_url, tipo_file: 'extra_raccolta', nome_file: file.name,
        periodo_riferimento: periodo?.mese || '', replace_existing: false,
      });
      const data = res.data || res;
      alert(`Importazione completata: ${data.righe_importate || 0} righe importate su ${data.righe_da_importare || 0}.`);
      await load();
    } catch (err) {
      alert('Errore importazione: ' + (err.message || 'errore sconosciuto'));
    }
    setUploading(false);
    e.target.value = '';
  };

  const save = async (payload) => {
    if (editRecord) {
      await base44.entities.ExtraRaccolta.update(editRecord.id, payload);
      setEditRecord(null);
    } else {
      await base44.entities.ExtraRaccolta.create(payload);
      setShowForm(false);
    }
    load();
  };

  const remove = async (r) => {
    if (!confirm('Eliminare questo record?')) return;
    await base44.entities.ExtraRaccolta.delete(r.id);
    load();
  };

  const totKg = records.reduce((s, r) => s + (r.peso_effettivo || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading font-semibold text-lg">Extra Raccolta</h2>
          <p className="text-sm text-muted-foreground">
            Dati non gestiti a portale. Fatturati a ECOTYRE a 202 €/t.
            {records.length > 0 && <span className="ml-2 font-medium">· {records.length} record · {(totKg / 1000).toFixed(2)} t · € {(totKg / 1000 * 202).toFixed(2)}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <label className={`inline-flex items-center gap-2 px-3 py-2 text-xs border rounded-md hover:bg-accent cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} />
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            Importa Excel
          </label>
          <Button size="sm" onClick={() => { setEditRecord(null); setShowForm(!showForm); }}>
            <Plus className="w-4 h-4 mr-1.5" /> Nuovo
          </Button>
        </div>
      </div>

      {showForm && !editRecord && (
        <ExtraRaccoltaForm periodo={periodo} onSave={save} onCancel={() => setShowForm(false)} />
      )}

      {editRecord && (
        <ExtraRaccoltaForm periodo={periodo} initial={editRecord} onSave={save} onCancel={() => setEditRecord(null)} />
      )}

      {loading ? (
        <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
      ) : records.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          <Upload className="w-8 h-8 mx-auto mb-2 opacity-40" />
          Nessun record extra raccolta per {periodo?.mese || 'il periodo selezionato'}.
          <br />Importa un file Excel o inserisci i dati manualmente con "Nuovo".
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-2 py-2 font-semibold">ID Ordine</th>
                <th className="text-left px-2 py-2 font-semibold">Mese</th>
                <th className="text-left px-2 py-2 font-semibold">Regione</th>
                <th className="text-left px-2 py-2 font-semibold">Prov.</th>
                <th className="text-left px-2 py-2 font-semibold">Trasportatore</th>
                <th className="text-left px-2 py-2 font-semibold">Destinazione</th>
                <th className="text-left px-2 py-2 font-semibold">FIR</th>
                <th className="text-left px-2 py-2 font-semibold">Classe</th>
                <th className="text-right px-2 py-2 font-semibold">Peso (kg)</th>
                <th className="text-right px-2 py-2 font-semibold">Totale (€)</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={r.id} className={`border-t hover:bg-muted/20 ${i % 2 ? 'bg-muted/10' : ''}`}>
                  <td className="px-2 py-1.5 font-mono text-xs">{r.id_ordine}</td>
                  <td className="px-2 py-1.5">{r.mese || '-'}</td>
                  <td className="px-2 py-1.5">{r.regione || '-'}</td>
                  <td className="px-2 py-1.5">{r.provincia || '-'}</td>
                  <td className="px-2 py-1.5 text-xs">{r.trasportatore || '-'}</td>
                  <td className="px-2 py-1.5 text-xs">{r.destinazione || '-'}</td>
                  <td className="px-2 py-1.5 text-xs">{r.numero_fir || '-'}</td>
                  <td className="px-2 py-1.5">{r.classe || '-'}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{(r.peso_effettivo || 0).toFixed(0)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-medium">€ {((r.peso_effettivo || 0) / 1000 * 202).toFixed(2)}</td>
                  <td className="text-right px-2 py-1.5">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => { setEditRecord(r); setShowForm(false); }} className="p-1 hover:bg-muted rounded"><Pencil className="w-3.5 h-3.5 text-muted-foreground" /></button>
                      <button onClick={() => remove(r)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 bg-muted/50 font-semibold">
                <td colSpan={8} className="px-2 py-2 text-right">Totale</td>
                <td className="px-2 py-2 text-right tabular-nums">{totKg.toFixed(0)}</td>
                <td className="px-2 py-2 text-right tabular-nums">€ {(totKg / 1000 * 202).toFixed(2)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}