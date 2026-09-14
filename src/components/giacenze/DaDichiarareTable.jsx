import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { RefreshCw, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { exportDaDichiarareExcel } from '@/lib/giacenzeDaDichiarareExport';

function fmt(n, dec = 2) {
  if (n == null || n === '' || isNaN(n)) return '—';
  // Conteggi interi; tonnellate con due decimali, tre se i kg non sono tondi.
  return Number(n).toLocaleString('it-IT', dec === 0 ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 3 });
}

function fmtData(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const PAGE_SIZE = 100;

export default function DaDichiarareTable({ filtroSitoEsterno, onPulisciFiltroSito }) {
  const [sito, setSito] = useState('');
  const [provincia, setProvincia] = useState('');
  const [annoChiusura, setAnnoChiusura] = useState('');
  const [ricerca, setRicerca] = useState('');
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filterOptions, setFilterOptions] = useState({ siti_distinti: [], province_distinte: [], anni_distinti: [] });

  // Sincronizza filtro esterno (dal pulsante nella scheda Situazione)
  useEffect(() => {
    if (filtroSitoEsterno) {
      setSito(filtroSitoEsterno);
      setOffset(0);
    }
  }, [filtroSitoEsterno]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = { limite: PAGE_SIZE, offset };
      if (sito) payload.sito = sito;
      if (provincia) payload.provincia = provincia;
      if (annoChiusura) payload.anno_chiusura = Number(annoChiusura);
      if (ricerca) payload.ricerca = ricerca;
      const res = await base44.functions.invoke('getOrdiniDaDichiarare', payload);
      setData(res.data);
      if (res.data.siti_distinti) setFilterOptions(res.data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [sito, provincia, annoChiusura, ricerca, offset]);

  useEffect(() => { load(); }, [load]);

  // Reset offset quando cambiano i filtri
  useEffect(() => { setOffset(0); }, [sito, provincia, annoChiusura, ricerca]);

  const handlePulisciSito = () => {
    setSito('');
    onPulisciFiltroSito();
  };

  const handleExport = async () => {
    // Scarica tutto l'elenco filtrato (senza limite) per l'export
    try {
      const payload = { limite: 100000, offset: 0 };
      if (sito) payload.sito = sito;
      if (provincia) payload.provincia = provincia;
      if (annoChiusura) payload.anno_chiusura = Number(annoChiusura);
      if (ricerca) payload.ricerca = ricerca;
      const res = await base44.functions.invoke('getOrdiniDaDichiarare', payload);
      exportDaDichiarareExcel(res.data.righe, res.data.totale_righe, res.data.totale_kg);
    } catch (e) {
      alert('Errore nell\'export: ' + e.message);
    }
  };

  const righe = data?.righe || [];
  const totaleRighe = data?.totale_righe || 0;
  const totaleKg = data?.totale_kg || 0;
  const hasPrev = offset > 0;
  const hasNext = righe.length === PAGE_SIZE && offset + PAGE_SIZE < totaleRighe;

  return (
    <div className="space-y-3">
      {/* Filtri */}
      <div className="bg-card border rounded-lg p-3 flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Sito</label>
          <Select value={sito} onValueChange={v => { setSito(v === '__all__' ? '' : v); }}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Tutti i siti" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tutti i siti</SelectItem>
              {filterOptions.siti_distinti?.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Provincia</label>
          <Select value={provincia} onValueChange={v => { setProvincia(v === '__all__' ? '' : v); }}>
            <SelectTrigger className="w-[120px]"><SelectValue placeholder="Tutte" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tutte</SelectItem>
              {filterOptions.province_distinte?.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Anno chiusura</label>
          <Select value={annoChiusura} onValueChange={v => { setAnnoChiusura(v === '__all__' ? '' : v); }}>
            <SelectTrigger className="w-[100px]"><SelectValue placeholder="Tutti" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tutti</SelectItem>
              {filterOptions.anni_distinti?.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 flex-1 min-w-[180px]">
          <label className="text-xs text-muted-foreground">Cerca FIR / ordine</label>
          <Input
            placeholder="Numero FIR o ordine..."
            value={ricerca}
            onChange={e => setRicerca(e.target.value)}
            className="h-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={loading}>
          <Download className="w-4 h-4 mr-1" /> Esporta Excel
        </Button>
        {sito && (
          <Button variant="ghost" size="sm" onClick={handlePulisciSito}>
            Pulisci sito
          </Button>
        )}
      </div>

      {/* Conteggio e peso totale */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span><strong className="text-foreground">{totaleRighe}</strong> ordini</span>
        <span><strong className="text-foreground">{fmt(totaleKg)}</strong> kg totali</span>
        {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
      </div>

      {/* Tabella */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-2 py-2 font-semibold">Ordine</th>
                <th className="px-2 py-2 font-semibold">FIR</th>
                <th className="px-2 py-2 font-semibold">Data chiusura</th>
                <th className="px-2 py-2 font-semibold">Punto di raccolta</th>
                <th className="px-2 py-2 font-semibold">Comune</th>
                <th className="px-2 py-2 font-semibold">Prov.</th>
                <th className="px-2 py-2 font-semibold">Prodotto</th>
                <th className="px-2 py-2 font-semibold text-right">Peso da dichiarare</th>
                <th className="px-2 py-2 font-semibold">Destinazione</th>
                <th className="px-2 py-2 font-semibold">Trasferito a</th>
              </tr>
            </thead>
            <tbody>
              {righe.length === 0 && (
                <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">Nessun ordine da dichiarare</td></tr>
              )}
              {righe.map((r, i) => {
                const giorni = r.giorni_attesa;
                let rowClass = 'border-t hover:bg-muted/30';
                if (giorni != null && giorni > 180) rowClass = 'border-t bg-red-50 hover:bg-red-100';
                else if (giorni != null && giorni > 90) rowClass = 'border-t bg-amber-50 hover:bg-amber-100';
                return (
                  <tr key={i} className={rowClass}>
                    <td className="px-2 py-1.5 font-mono text-xs">{r.ordine_primaria}</td>
                    <td className="px-2 py-1.5 font-mono text-xs">{r.numero_fir || '—'}</td>
                    <td className="px-2 py-1.5">{fmtData(r.data_chiusura)}</td>
                    <td className="px-2 py-1.5">{r.punto_di_raccolta || '—'}</td>
                    <td className="px-2 py-1.5">{r.comune || '—'}</td>
                    <td className="px-2 py-1.5">{r.provincia || '—'}</td>
                    <td className="px-2 py-1.5">{r.prodotto || '—'}</td>
                    <td className="px-2 py-1.5 text-right font-medium">{fmt(r.peso_non_dichiarato_kg)} kg</td>
                    <td className="px-2 py-1.5">{r.destinazione || '—'}</td>
                    <td className="px-2 py-1.5">{r.destinazione_secondaria || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
            {righe.length > 0 && (
              <tfoot className="bg-muted/50 font-bold border-t-2">
                <tr>
                  <td className="px-2 py-2" colSpan={7}>TOTALE ({totaleRighe} ordini)</td>
                  <td className="px-2 py-2 text-right">{fmt(totaleKg)} kg</td>
                  <td className="px-2 py-2" colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Paginazione */}
      {totaleRighe > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {offset + 1}–{Math.min(offset + righe.length, totaleRighe)} di {totaleRighe}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={!hasPrev} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
              <ChevronLeft className="w-4 h-4" /> Precedenti
            </Button>
            <Button variant="outline" size="sm" disabled={!hasNext} onClick={() => setOffset(offset + PAGE_SIZE)}>
              Successivi <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}