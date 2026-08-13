import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Play, FileSpreadsheet, FileText, AlertTriangle, Eye } from 'lucide-react';
import { formatNumber } from '@/lib/utils';
import TariffePassivaManager from './TariffePassivaManager';
import RigaDetailModalRete from './RigaDetailModalRete';

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const ANNI = [2024, 2025, 2026];

export default function FatturazionePassivaRete() {
  const [tab, setTab] = useState('elaborazione');
  const [anno, setAnno] = useState(2026);
  const [mese, setMese] = useState('Luglio');
  const [fornitori, setFornitori] = useState([]);
  const [fornitoreId, setFornitoreId] = useState('');
  const [risultato, setRisultato] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedRiga, setSelectedRiga] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    base44.entities.Fornitore.filter({ stato: 'attivo' }).then(f => {
      // Solo trasportatori
      setFornitori(f.filter(x => x.tipo === 'trasportatore' || !x.tipo));
    }).catch(() => {});
  }, []);

  const calcola = async () => {
    setLoading(true); setError('');
    try {
      const res = await base44.functions.invoke('elaboraFatturazionePassivaRete', {
        anno, mese, fornitoreId: fornitoreId || undefined,
      });
      setRisultato(res.data);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const exportExcel = async () => {
    if (!risultato?.dettaglio) return;
    setExporting(true);
    try {
      const XLSX = await import('xlsx');
      const data = risultato.dettaglio.map(r => ({
        'TRASPORTATORE': r.trasportatore,
        'ZONA DI RACCOLTA': r.regione,
        'METODO': r.unita_misura || '',
        'TOTALE [t]': r.totale_t,
        'N° VIAGGI': r.num_viaggi,
        'COSTO UNITARIO': r.tariffa_valore,
        'EER': r.eer || '',
        'TOTALE [€]': r.totale_euro,
      }));
      data.push({
        'TRASPORTATORE': 'TOTALE',
        'ZONA DI RACCOLTA': '',
        'METODO': '',
        'TOTALE [t]': risultato.dettaglio.reduce((s, r) => s + r.totale_t, 0),
        'N° VIAGGI': risultato.dettaglio.reduce((s, r) => s + r.num_viaggi, 0),
        'COSTO UNITARIO': '',
        'EER': '',
        'TOTALE [€]': risultato.totale_complessivo,
      });
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Fatturazione ${mese} ${anno}`);
      XLSX.writeFile(wb, `Fatturazione_Passiva_Rete_${mese}_${anno}.xlsx`);
    } catch (e) { setError('Export Excel fallito: ' + e.message); }
    setExporting(false);
  };

  const exportPDF = async () => {
    if (!risultato?.dettaglio) return;
    setExporting(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      doc.setFontSize(14);
      doc.text(`Fatturazione Passiva Rete — ${mese} ${anno}`, 14, 15);
      doc.setFontSize(10);
      doc.text(`Totale complessivo: € ${formatNumber(risultato.totale_complessivo, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 14, 22);

      const headers = ['Trasportatore', 'Regione', 'Metodo', 'Totale [t]', 'Viaggi', 'Costo', 'EER', 'Totale [€]'];
      const colWidths = [45, 30, 18, 20, 15, 18, 18, 22];
      let x = 14;
      let y = 30;
      doc.setFillColor(200, 200, 200);
      doc.rect(x, y - 5, colWidths.reduce((a, b) => a + b, 0), 6, 'F');
      doc.setFontSize(8);
      headers.forEach((h, i) => {
        doc.text(h, x + 1, y);
        x += colWidths[i];
      });
      y += 5;
      doc.setFontSize(7);
      risultato.dettaglio.forEach(r => {
        if (y > 195) { doc.addPage(); y = 15; }
        x = 14;
        doc.text(String(r.trasportatore || '').substring(0, 28), x + 1, y); x += colWidths[0];
        doc.text(String(r.regione || '').substring(0, 18), x + 1, y); x += colWidths[1];
        doc.text(String(r.unita_misura || ''), x + 1, y); x += colWidths[2];
        doc.text(formatNumber(r.totale_t), x + 1, y); x += colWidths[3];
        doc.text(String(r.num_viaggi), x + 1, y); x += colWidths[4];
        doc.text(formatNumber(r.tariffa_valore, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), x + 1, y); x += colWidths[5];
        doc.text(String(r.eer || '').substring(0, 16), x + 1, y); x += colWidths[6];
        doc.text(formatNumber(r.totale_euro, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), x + 1, y);
        y += 5;
      });
      doc.save(`Fatturazione_Passiva_Rete_${mese}_${anno}.pdf`);
    } catch (e) { setError('Export PDF fallito: ' + e.message); }
    setExporting(false);
  };

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="elaborazione"><Play className="w-4 h-4 mr-1.5" /> Elaborazione Mensile</TabsTrigger>
        <TabsTrigger value="tariffe"><FileText className="w-4 h-4 mr-1.5" /> Gestione Tariffe</TabsTrigger>
      </TabsList>

      <TabsContent value="elaborazione" className="mt-4 space-y-4">
        <div className="flex flex-wrap items-end gap-3 p-4 border rounded-lg bg-muted/30">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Anno</label>
            <Select value={String(anno)} onValueChange={v => setAnno(Number(v))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>{ANNI.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Mese</label>
            <Select value={mese} onValueChange={setMese}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{MESI.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground block mb-1">Fornitore (opzionale — vuoto = tutti)</label>
            <Select value={fornitoreId} onValueChange={setFornitoreId}>
              <SelectTrigger><SelectValue placeholder="Tutti i fornitori" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Tutti i fornitori</SelectItem>
                {fornitori.map(f => <SelectItem key={f.id} value={f.id}>{f.ragione_sociale}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={calcola} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Play className="w-4 h-4 mr-1.5" />}
            Calcola Fatturato
          </Button>
        </div>

        {error && <div className="text-sm text-red-600 flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> {error}</div>}

        {risultato && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="grid grid-cols-4 gap-3 flex-1">
                <div className="border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Raccoglitori</p>
                  <p className="text-xl font-bold">{risultato.dettaglio.length}</p>
                </div>
                <div className="border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Totale [t]</p>
                  <p className="text-xl font-bold">{formatNumber(risultato.dettaglio.reduce((s, r) => s + r.totale_t, 0))}</p>
                </div>
                <div className="border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Totale FIR (Viaggi)</p>
                  <p className="text-xl font-bold">{formatNumber(risultato.dettaglio.reduce((s, r) => s + r.num_viaggi, 0))}</p>
                </div>
                <div className="border rounded-lg p-3 bg-primary/5">
                  <p className="text-xs text-muted-foreground">Totale [€]</p>
                  <p className="text-xl font-bold text-primary">{formatNumber(risultato.totale_complessivo, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportExcel} disabled={exporting}>
                  {exporting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-1" />}
                  Excel
                </Button>
                <Button variant="outline" size="sm" onClick={exportPDF} disabled={exporting}>
                  {exporting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileText className="w-4 h-4 mr-1" />}
                  PDF
                </Button>
              </div>
            </div>

            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left px-3 py-2 font-heading font-semibold">Trasportatore</th>
                    <th className="text-left px-3 py-2 font-heading font-semibold">Regione</th>
                    <th className="text-right px-3 py-2 font-heading font-semibold">Totale [t]</th>
                    <th className="text-right px-3 py-2 font-heading font-semibold">N° Viaggi</th>
                    <th className="text-left px-3 py-2 font-heading font-semibold">Metodo</th>
                    <th className="text-right px-3 py-2 font-heading font-semibold">Costo</th>
                    <th className="text-right px-3 py-2 font-heading font-semibold">Totale [€]</th>
                    <th className="text-center px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {risultato.dettaglio.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Nessun dato per il periodo selezionato.</td></tr>
                  )}
                  {risultato.dettaglio.map((r, i) => (
                    <tr key={i} className={i % 2 ? 'bg-muted/30' : ''}>
                      <td className="px-3 py-2 font-medium">{r.trasportatore}</td>
                      <td className="px-3 py-2">{r.regione}</td>
                      <td className="px-3 py-2 text-right">{formatNumber(r.totale_t)}</td>
                      <td className="px-3 py-2 text-right">{r.num_viaggi}</td>
                      <td className="px-3 py-2">
                        {r.unita_misura ? <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">{r.unita_misura}</span> : <span className="text-red-500 text-xs">N/D</span>}
                      </td>
                      <td className="px-3 py-2 text-right">{r.tariffa_valore ? formatNumber(r.tariffa_valore, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                      <td className={`px-3 py-2 text-right font-bold ${r.has_tariffa ? 'text-primary' : 'text-red-500'}`}>
                        {formatNumber(r.totale_euro, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="text-center px-3 py-2">
                        <button onClick={() => setSelectedRiga(r)} className="p-1 hover:bg-muted rounded" title="Dettaglio">
                          <Eye className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!risultato && !loading && (
          <div className="text-center py-12 text-muted-foreground border rounded-lg">
            Seleziona il periodo e clicca "Calcola Fatturato" per elaborare i compensi ai raccoglitori.
          </div>
        )}
      </TabsContent>

      <TabsContent value="tariffe" className="mt-4">
        <TariffePassivaManager />
      </TabsContent>

      <RigaDetailModalRete riga={selectedRiga} mese={mese} anno={anno} onClose={() => setSelectedRiga(null)} />
    </Tabs>
  );
}