import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Download, FileSpreadsheet } from 'lucide-react';
import { exportFatturazioneAttiva } from '@/lib/fatturazioneExport';

const TIPS = [
  { key: 'RETE', label: 'Rete' },
  { key: 'ACI', label: 'ACI' },
  { key: 'EXTRA_RACCOLTA', label: 'Extra Raccolta' },
];

export default function AttivaEsportazioni({ periodo, data, onReload }) {
  const [exporting, setExporting] = useState(false);
  const [storico, setStorico] = useState([]);
  const [loadingStorico, setLoadingStorico] = useState(true);

  const loadStorico = async () => {
    setLoadingStorico(true);
    try { setStorico(await base44.entities.EsportazioneFatturazione.list('-data_esportazione', 50)); } catch (e) {}
    setLoadingStorico(false);
  };

  useEffect(() => { loadStorico(); }, []);

  const esporta = async (tipologia) => {
    setExporting(true);
    try {
      const righe = data[tipologia]?.righe || [];
      if (righe.length === 0) { alert(`Nessuna riga da esportare per ${tipologia}`); setExporting(false); return; }
      const nomeFile = `Fatturazione_${tipologia}_${periodo.mese}_${periodo.anno}.xlsx`;
      exportFatturazioneAttiva(tipologia, righe, periodo.anno, periodo.mese);
      const doc = data[tipologia]?.documento;
      await base44.functions.invoke('registraEsportazione', {
        tipologia, anno: periodo.anno, mese: periodo.mese,
        documento_ids: doc ? [doc.id] : [], nome_file: nomeFile,
      });
      await loadStorico(); await onReload();
    } catch (e) { alert(e.message); }
    setExporting(false);
  };

  const esportaTutto = async () => {
    setExporting(true);
    for (const t of TIPS) {
      try {
        const righe = data[t.key]?.righe || [];
        if (righe.length === 0) continue;
        const nomeFile = `Fatturazione_${t.key}_${periodo.mese}_${periodo.anno}.xlsx`;
        exportFatturazioneAttiva(t.key, righe, periodo.anno, periodo.mese);
        const doc = data[t.key]?.documento;
        await base44.functions.invoke('registraEsportazione', {
          tipologia: t.key, anno: periodo.anno, mese: periodo.mese,
          documento_ids: doc ? [doc.id] : [], nome_file: nomeFile,
        });
      } catch (e) {}
    }
    await loadStorico(); await onReload();
    setExporting(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading font-semibold mb-2">Esportazione Excel — {periodo.mese} {periodo.anno}</h2>
        <p className="text-sm text-muted-foreground mb-3">Genera i file Excel nel formato dei modelli SMOCO. I file vengono scaricati automaticamente.</p>
        <div className="flex flex-wrap gap-2">
          {TIPS.map(t => (
            <Button key={t.key} variant="outline" onClick={() => esporta(t.key)} disabled={exporting || !data[t.key]?.documento}>
              <FileSpreadsheet className="w-4 h-4 mr-1.5" /> Esporta {t.label}
            </Button>
          ))}
          <Button onClick={esportaTutto} disabled={exporting}>
            {exporting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
            Esporta Tutto
          </Button>
        </div>
      </div>

      <div>
        <h3 className="font-heading font-semibold mb-2">Storico Esportazioni</h3>
        {loadingStorico ? (
          <div className="text-center py-4"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
        ) : storico.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground border rounded-lg">Nessuna esportazione registrata.</div>
        ) : (
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted"><tr>
                <th className="text-left px-3 py-2 font-semibold">Tipologia</th>
                <th className="text-left px-3 py-2 font-semibold">Periodo</th>
                <th className="text-left px-3 py-2 font-semibold">File</th>
                <th className="text-left px-3 py-2 font-semibold">Utente</th>
                <th className="text-left px-3 py-2 font-semibold">Data</th>
              </tr></thead>
              <tbody>
                {storico.map((e, i) => (
                  <tr key={e.id} className={i % 2 ? 'bg-muted/30' : ''}>
                    <td className="px-3 py-2 font-medium">{e.tipologia}</td>
                    <td className="px-3 py-2">{e.mese} {e.anno}</td>
                    <td className="px-3 py-2 text-xs font-mono">{e.nome_file}</td>
                    <td className="px-3 py-2">{e.utente || '-'}</td>
                    <td className="px-3 py-2 text-xs">{e.data_esportazione ? new Date(e.data_esportazione).toLocaleString('it-IT') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}