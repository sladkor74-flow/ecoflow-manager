import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, Loader2, FileSpreadsheet, CheckCircle } from 'lucide-react';
import UploadResultDialog, { extractUploadError, extractUploadWarnings } from '@/components/shared/UploadResultDialog';
import { dopoCaricamento, testoRicalcoli } from '@/lib/importGrandeFile';

export default function SecondarieUpload({ onImported }) {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [ricalcoli, setRicalcoli] = useState(null);
  const [dialogState, setDialogState] = useState(null);
  const inputRef = useRef(null);
  const pendingFileUrlRef = useRef(null);

  const handleFile = async (file, conferma_forzatura = false) => {
    if (!file) return;
    setUploading(true);
    setResult(null);
    setRicalcoli(null);
    try {
      let fileUrl;
      if (conferma_forzatura && pendingFileUrlRef.current) {
        fileUrl = pendingFileUrlRef.current;
      } else {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        fileUrl = file_url;
        pendingFileUrlRef.current = fileUrl;
      }
      const params = {
        file_url: fileUrl,
        tipo_file: 'secondarie',
        nome_file: file.name,
        replace_existing: true,
      };
      if (conferma_forzatura) params.conferma_forzatura = true;
      const res = await base44.functions.invoke('importEcotyreFile', params);
      setResult(res.data);
      const warnings = extractUploadWarnings(res.data);
      if (warnings) setDialogState(warnings);
      if (onImported) onImported();
      // Questo e' un secondo punto di caricamento delle secondarie: aggiorna gli
      // stessi moduli di Caricamento Dati (elenco unico in dopoCaricamento), non
      // solo la matrice della pagina. Un esito "errore" ha lasciato l'archivio a
      // meta' e non si ricalcola su quello.
      if (res.data && res.data.esito !== 'errore') {
        setRicalcoli({ in_corso: true });
        dopoCaricamento('secondarie').then(setRicalcoli);
      }
    } catch (e) {
      const errInfo = extractUploadError(e);
      setDialogState({ ...errInfo, onForza: () => handleFile(file, true) });
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
            {(() => {
              const r = testoRicalcoli(ricalcoli);
              return r ? <p className={`mt-1 text-xs ${r.classe}`}>{r.testo}</p> : null;
            })()}
          </div>
        </div>
      )}
      <UploadResultDialog state={dialogState} onClose={() => setDialogState(null)} />
    </div>
  );
}