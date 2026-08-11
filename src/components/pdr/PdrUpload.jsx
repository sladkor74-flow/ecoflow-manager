import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function PdrUpload({ onImported }) {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setResult(null);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const res = await base44.functions.invoke('importPdrFile', { file_url, nome_file: file.name, replace_existing: true });
      setResult({ ok: true, data: res.data });
      if (onImported) onImported();
    } catch (e) {
      setResult({ ok: false, error: e.response?.data?.error || e.message });
    }
    setUploading(false);
  };

  return (
    <div className="border rounded-lg p-5 bg-amber-50 border-amber-200">
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2 rounded-md bg-white shadow-sm">
          <Upload className="w-5 h-5 text-foreground" />
        </div>
        <div className="flex-1">
          <h3 className="font-heading font-semibold">Carica file PDR</h3>
          <p className="text-sm text-muted-foreground">Elenco clienti Ecotyre (gommisti e autodemolitori). Sostituisce i dati precedenti.</p>
        </div>
      </div>
      <label className="block">
        <input
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => handleUpload(e.target.files[0])}
          disabled={uploading}
        />
        <div className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-md cursor-pointer transition-colors ${uploading ? 'bg-muted cursor-wait' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}>
          {uploading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Caricamento...</>
          ) : (
            <><Upload className="w-4 h-4" /> Seleziona file Excel</>
          )}
        </div>
      </label>
      {result && (
        <div className={`mt-3 flex items-start gap-2 text-sm ${result.ok ? 'text-green-700' : 'text-red-700'}`}>
          {result.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
          <span>
            {result.ok
              ? `${result.data.righe_importate} PDR importati${result.data.righe_fallite > 0 ? ` (${result.data.righe_fallite} fallite)` : ''}`
              : `Errore: ${result.error}`}
          </span>
        </div>
      )}
    </div>
  );
}