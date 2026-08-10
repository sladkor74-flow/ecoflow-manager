import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, Loader2, FileSpreadsheet, AlertCircle, CheckCircle } from 'lucide-react';

export default function SecondarieUpload({ onImported }) {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const res = await base44.functions.invoke('importEcotyreFile', {
        file_url,
        tipo_file: 'secondarie',
        nome_file: file.name,
      });
      setResult(res.data);
      if (onImported) onImported();
    } catch (e) {
      setError(e.message || 'Errore durante il caricamento');
    }
    setUploading(false);
  };

  return (
    <div className="border-2 border-dashed rounded-lg p-6 space-y-3">
      <div className="flex items-center gap-2">
        <FileSpreadsheet className="w-5 h-5 text-primary" />
        <h3 className="font-heading font-semibold">Importa estratto Secondarie dal portale Ecotyre</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Carica il file Excel con i dati a partire dalla cella A1. Le colonne derivate (Regioni, Mese, Classe PFU, Settimana)
        vengono calcolate automaticamente all'atto dell'importazione.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => handleFile(e.target.files[0])}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
      >
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {uploading ? 'Importazione in corso...' : 'Seleziona file Excel/CSV'}
      </button>

      {result && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-green-50 border border-green-200 text-sm">
          <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-green-900">Importazione completata</p>
            <p className="text-green-800">
              {result.righe_importate} righe importate su {result.righe_da_importare} da importare.
              {result.righe_fallite > 0 && ` · ${result.righe_fallite} fallite.`}
            </p>
          </div>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 border border-red-200 text-sm">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-red-900">Errore</p>
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}