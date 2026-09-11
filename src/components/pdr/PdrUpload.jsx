import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, Loader2, CheckCircle2 } from 'lucide-react';
import UploadResultDialog, { extractUploadError, extractUploadWarnings } from '@/components/shared/UploadResultDialog';

export default function PdrUpload({ onImported }) {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [dialogState, setDialogState] = useState(null);
  const pendingFileUrlRef = useRef(null);

  const handleUpload = async (file, conferma_forzatura = false) => {
    if (!file) return;
    setUploading(true);
    setResult(null);
    try {
      let fileUrl;
      if (conferma_forzatura && pendingFileUrlRef.current) {
        fileUrl = pendingFileUrlRef.current;
      } else {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        fileUrl = file_url;
        pendingFileUrlRef.current = fileUrl;
      }
      const params = { file_url: fileUrl, nome_file: file.name, replace_existing: true };
      if (conferma_forzatura) params.conferma_forzatura = true;
      const res = await base44.functions.invoke('importPdrFile', params);
      setResult({ ok: true, data: res.data });
      const warnings = extractUploadWarnings(res.data);
      if (warnings) setDialogState(warnings);
      if (onImported) onImported();
    } catch (e) {
      const errInfo = extractUploadError(e);
      setDialogState({ ...errInfo, onForza: () => handleUpload(file, true) });
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
      {result && result.ok && (
        <div className="mt-3 flex items-start gap-2 text-sm text-green-700">
          <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            {result.data.righe_importate} PDR importati{result.data.righe_fallite > 0 ? ` (${result.data.righe_fallite} fallite)` : ''}
          </span>
        </div>
      )}
      <UploadResultDialog state={dialogState} onClose={() => setDialogState(null)} />
    </div>
  );
}