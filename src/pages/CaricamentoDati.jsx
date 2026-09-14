import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, Clock, Trash2 } from 'lucide-react';
import UploadResultDialog, { extractUploadError, extractUploadWarnings } from '@/components/shared/UploadResultDialog';
import { importaGrandeFile, TIPI_LETTURA_BROWSER } from '@/lib/importGrandeFile';
import { formatIntero } from '@/lib/utils';

const TIPI_FILE = [
  { key: 'primarie', label: 'Primarie', desc: 'File unico delle primarie (un solo foglio con tutto). Suddivide automaticamente le righe in Primarie Rete, Primarie ACI, Assegnati Rete e Assegnati ACI in base a stato e classe.', colore: 'bg-green-50 border-green-200' },
  { key: 'secondarie', label: 'Secondarie', desc: 'Viaggi stoccaggio → impianto (foglio SECONDARIE)', colore: 'bg-purple-50 border-purple-200' },
  { key: 'terziarie', label: 'Terziarie', desc: 'Viaggi impianto → cementeria/impianto (foglio TERZIARIE)', colore: 'bg-pink-50 border-pink-200' },
  { key: 'dichiarazioni_trattamento', label: 'Dichiarazioni Trattamento', desc: 'Report delle dichiarazioni di recupero con la ripartizione dei derivati: granulo, fibre, metallo, cippato, ciabattato', colore: 'bg-cyan-50 border-cyan-200' },
  { key: 'ordini_non_dichiarati', label: 'Ordini Non Dichiarati', desc: 'Ordini in attesa di dichiarazione di trattamento: determina la giacenza a portale di ciascun impianto', colore: 'bg-amber-50 border-amber-200' },
];

export default function CaricamentoDati() {
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [uploading, setUploading] = useState(null);
  const [risultato, setRisultato] = useState({});
  const [dialogState, setDialogState] = useState(null);
  const [progresso, setProgresso] = useState({});
  const pendingFileUrlRef = useRef({});

  const caricaLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await base44.entities.UploadLog.list('-created_date', 20);
      setLogs(res);
    } catch (e) {
      setLogs([]);
    }
    setLoadingLogs(false);
  };

  useEffect(() => { caricaLogs(); }, []);

  const handleUpload = async (tipoKey, file, conferma_forzatura = false) => {
    if (!file) return;
    setUploading(tipoKey);
    setRisultato(prev => ({ ...prev, [tipoKey]: null }));
    try {
      // I due report del portale sono troppo grandi per essere letti dentro una
      // function: la lettura avviene nel browser e al backend arrivano blocchi di
      // poche centinaia di righe gia' estratte.
      if (TIPI_LETTURA_BROWSER.includes(tipoKey)) {
        const data = await importaGrandeFile({
          file,
          tipoFile: tipoKey,
          confermaForzatura: conferma_forzatura,
          onProgress: (p) => setProgresso(prev => ({ ...prev, [tipoKey]: p })),
        });
        setProgresso(prev => ({ ...prev, [tipoKey]: null }));
        setRisultato(prev => ({ ...prev, [tipoKey]: { ok: true, data } }));
        const warnings = extractUploadWarnings(data);
        if (warnings) setDialogState(warnings);
        caricaLogs();
        setUploading(null);
        return;
      }

      let fileUrl;
      if (conferma_forzatura && pendingFileUrlRef.current[tipoKey]) {
        fileUrl = pendingFileUrlRef.current[tipoKey];
      } else {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        fileUrl = file_url;
        pendingFileUrlRef.current[tipoKey] = fileUrl;
      }
      const fnName = 'importEcotyreFile';
      const params = { file_url: fileUrl, tipo_file: tipoKey, nome_file: file.name, replace_existing: true };
      if (conferma_forzatura) params.conferma_forzatura = true;
      const res = await base44.functions.invoke(fnName, params);
      setRisultato(prev => ({ ...prev, [tipoKey]: { ok: true, data: res.data } }));
      // Nuove primarie: si aggiorna il controllo delle liste di assegnati del
      // modulo Verifiche. Gira in background e non blocca il caricamento.
      if (tipoKey === 'primarie') base44.functions.invoke('controllaEvasioneAssegnati', {}).catch(() => {});
      const warnings = extractUploadWarnings(res.data);
      if (warnings) setDialogState(warnings);
      caricaLogs();
    } catch (e) {
      setProgresso(prev => ({ ...prev, [tipoKey]: null }));
      const errInfo = extractUploadError(e);
      setRisultato(prev => ({ ...prev, [tipoKey]: { ok: false, error: errInfo.error } }));
      setDialogState({ ...errInfo, onForza: () => handleUpload(tipoKey, file, true) });
    }
    setUploading(null);
  };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold">Caricamento Dati</h1>
        <p className="text-muted-foreground mt-1">
          Carica i file Excel scaricati dal portale Ecotyre per aggiornare il gestionale. Ogni caricamento sostituisce i dati precedenti della stessa tipologia.
        </p>
      </div>

      {/* Card di upload */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TIPI_FILE.map((tipo) => {
          const res = risultato[tipo.key];
          const isUploading = uploading === tipo.key;
          return (
            <div key={tipo.key} className={`rounded-lg border p-5 ${tipo.colore}`}>
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 rounded-md bg-white shadow-sm">
                  <FileSpreadsheet className="w-6 h-6 text-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="font-heading font-semibold">{tipo.label}</h3>
                  <p className="text-sm text-muted-foreground">{tipo.desc}</p>
                </div>
              </div>

              <label className="block">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => handleUpload(tipo.key, e.target.files[0])}
                  disabled={isUploading}
                />
                <div className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-md cursor-pointer transition-colors ${isUploading ? 'bg-muted cursor-wait' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}>
                  {isUploading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Caricamento...</>
                  ) : (
                    <><Upload className="w-4 h-4" /> Seleziona file Excel</>
                  )}
                </div>
              </label>

              {progresso[tipo.key] && (
                <div className="mt-3 text-xs text-muted-foreground">
                  {progresso[tipo.key].blocco ? (
                    <>
                      <div className="flex justify-between mb-1">
                        <span>
                          Blocco {progresso[tipo.key].blocco} di {progresso[tipo.key].totaleBlocchi}
                          {progresso[tipo.key].fase === 'ritentativo' && (
                            <span className="text-amber-700"> · ritentativo {progresso[tipo.key].tentativo}</span>
                          )}
                        </span>
                        <span className="tabular-nums">
                          {formatIntero(progresso[tipo.key].righeScritte || 0)} / {formatIntero(progresso[tipo.key].totaleRighe || 0)} righe
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${Math.round((progresso[tipo.key].blocco / progresso[tipo.key].totaleBlocchi) * 100)}%` }}
                        />
                      </div>
                    </>
                  ) : (
                    <span>{progresso[tipo.key].fase}…</span>
                  )}
                </div>
              )}

              {res && res.ok && (
                <div className="mt-3 flex items-start gap-2 text-sm text-green-700">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>
                    {res.data.records_creati != null
                      ? `${res.data.records_creati} target caricati (${res.data.raccoglitori} raccoglitori)`
                      : (res.data.primarie_rete_importati != null
                        ? `Rete: ${res.data.primarie_rete_importati} · ACI: ${res.data.primarie_aci_importati} · Ass. Rete: ${res.data.assegnati_importati} · Ass. ACI: ${res.data.assegnati_aci_importati}`
                        : `${res.data.righe_importate} righe importate${res.data.righe_fallite > 0 ? ` (${res.data.righe_fallite} fallite)` : ''}${res.data.blocchi_ritentati > 0 ? ` · ${res.data.blocchi_ritentati} blocchi ritentati` : ''}`)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Log upload */}
      <div>
        <h2 className="text-xl font-heading font-semibold mb-4">Storico Caricamenti</h2>
        {loadingLogs ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Caricamento...
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border rounded-lg">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
            Nessun caricamento effettuato
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Data</th>
                  <th className="text-left px-4 py-3 font-medium">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium">File</th>
                  <th className="text-right px-4 py-3 font-medium">Righe</th>
                  <th className="text-center px-4 py-3 font-medium">Esito</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t hover:bg-muted/50">
                    <td className="px-4 py-3 text-muted-foreground">{new Date(log.created_date).toLocaleString('it-IT')}</td>
                    <td className="px-4 py-3 font-medium">{log.tipo_file}</td>
                    <td className="px-4 py-3">{log.nome_file}</td>
                    <td className="px-4 py-3 text-right">{formatIntero(log.righe_importate)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        log.esito === 'successo' ? 'bg-green-100 text-green-700' :
                        log.esito === 'parziale' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {log.esito}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <UploadResultDialog state={dialogState} onClose={() => setDialogState(null)} />
    </div>
  );
}