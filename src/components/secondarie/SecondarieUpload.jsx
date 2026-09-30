import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, Loader2, FileSpreadsheet, CheckCircle } from 'lucide-react';
import UploadResultDialog, { extractUploadError, extractUploadWarnings } from '@/components/shared/UploadResultDialog';
import { dopoCaricamento, testoRicalcoli, moduliDaRicalcolare, ricalcoliFermi } from '@/lib/importGrandeFile';

export default function SecondarieUpload({ onImported }) {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [ricalcoli, setRicalcoli] = useState(null);
  const [dialogState, setDialogState] = useState(null);
  const inputRef = useRef(null);
  const pendingFileUriRef = useRef(null);

  const handleFile = async (file, conferma_forzatura = false) => {
    if (!file) return;
    setUploading(true);
    setResult(null);
    setRicalcoli(null);
    try {
      // Documento aziendale: sale in area PRIVATA, si apre solo con un link
      // firmato che scade. Vedi base44/shared/fileScaricabile.ts.
      let fileUri;
      if (conferma_forzatura && pendingFileUriRef.current) {
        fileUri = pendingFileUriRef.current;
      } else {
        const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
        fileUri = file_uri;
        pendingFileUriRef.current = fileUri;
      }
      const params = {
        file_uri: fileUri,
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
      // solo la matrice della pagina. La regola di QUANDO si ricalcola e' una
      // sola e sta in moduliDaRicalcolare: solo su un caricamento riuscito.
      // Qui si guardava ancora il solo "errore", quindi dopo una secondaria
      // chiusa parziale - archivio con righe di troppo, mancanti o non contato -
      // i ricalcoli partivano lo stesso sopra dati inaffidabili (per le secondarie
      // sono due: verifiche e qualifica).
      // E quando non partono si dice PERCHE' e quali moduli restano indietro:
      // una secondaria chiusa parziale - basta una riga non entrata - lasciava
      // verifiche dei report, quadrature FIR e qualifica fornitori fermi al
      // caricamento di prima, in silenzio.
      if (moduliDaRicalcolare(res.data)) {
        setRicalcoli({ in_corso: true });
        dopoCaricamento('secondarie').then(setRicalcoli);
      } else {
        setRicalcoli(ricalcoliFermi('secondarie', res.data));
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

      {/* Il colore dice subito com'è andata: un caricamento chiuso "parziale"
          non è "Importazione completata", e sotto c'è scritto che i moduli
          collegati sono rimasti indietro. Verde e ambra come in Caricamento Dati. */}
      {result && (() => {
        const riuscito = !result.esito || result.esito === 'successo';
        return (
        <div className={`flex items-start gap-2 p-3 rounded-md text-sm ${riuscito ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-300'}`}>
          <CheckCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${riuscito ? 'text-green-600' : 'text-amber-600'}`} />
          <div>
            <p className={`font-medium ${riuscito ? 'text-green-900' : 'text-amber-900'}`}>
              {/* Per le secondarie basta UNA riga non entrata perche' l'esito
                  sia "parziale": l'archivio puo' tornare benissimo e mancare
                  solo quella. Dire "l'archivio non torna con il file" era una
                  cosa piu' grossa di quella successa. */}
              {riuscito ? 'Importazione completata' : 'Importazione a metà: alcune righe non sono entrate'}
            </p>
            <p className={riuscito ? 'text-green-800' : 'text-amber-900'}>
              {result.righe_importate} righe importate su {result.righe_da_importare} da importare.
              {result.righe_fallite > 0 && ` · ${result.righe_fallite} fallite.`}
            </p>
            {(() => {
              const r = testoRicalcoli(ricalcoli);
              return r ? <p className={`mt-1 text-xs ${r.classe}`}>{r.testo}</p> : null;
            })()}
          </div>
        </div>
        );
      })()}
      <UploadResultDialog state={dialogState} onClose={() => setDialogState(null)} />
    </div>
  );
}