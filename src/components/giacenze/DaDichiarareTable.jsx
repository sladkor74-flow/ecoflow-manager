import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { RefreshCw, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { exportDaDichiarareExcel } from '@/lib/giacenzeDaDichiarareExport';
import { formatKg, formatIntero } from '@/lib/utils';
import { giornoRoma } from '@/lib/giornoItaliano';

// I pesi di questa lista sono chilogrammi: sempre interi. Si scrivevano con
// formatTonnellate, e un peso in kg usciva con i decimali delle tonnellate.
const kg = (n) => (n == null || n === '' || isNaN(n) ? '—' : formatKg(n));

// Il formulario nel gestionale (regola dell'utente, 22/09/2026): immissione,
// inizio e fine trasporto sono obbligatorie. Se al movimento che ha portato il
// carico all'impianto manca la fine trasporto, il portale lo conta nella sua
// giacenza e il gestionale non lo colloca in nessun mese.
function Formulario({ r }) {
  const date = r.date_da_sistemare || [];
  if (!date.length) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="text-amber-700">
      {date.map(d => <span key={`${d.tipo}-${d.id_ordine}`} className="block">{d.tipo} {d.id_ordine}: {d.testo}</span>)}
      {r.fuori_dai_mesi && <span className="block text-[11px]">il portale lo conta nella giacenza, il gestionale non lo colloca in nessun mese</span>}
      {r.fine_a_portale && <span className="block text-[11px]">il portale scrive la fine trasporto ({fmtData(r.fine_a_portale)}): va riportata nella primaria</span>}
    </span>
  );
}

// Il giorno italiano, GG/MM/AAAA. Con toLocaleDateString una data 'AAAA-MM-GG'
// (mezzanotte UTC) si leggeva nel fuso del computer, e fuori dall'Italia usciva
// il giorno prima.
function fmtData(v) {
  const g = giornoRoma(v);
  return g ? g.split('-').reverse().join('/') : '—';
}

const PAGE_SIZE = 100;

export default function DaDichiarareTable({ filtroSitoEsterno, onPulisciFiltroSito }) {
  const [sito, setSito] = useState('');
  const [provincia, setProvincia] = useState('');
  const [annoChiusura, setAnnoChiusura] = useState('');
  const [ricerca, setRicerca] = useState('');
  const [soloDate, setSoloDate] = useState(false);
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
      if (annoChiusura) payload.anno = Number(annoChiusura);
      if (ricerca) payload.ricerca = ricerca;
      if (soloDate) payload.solo_date_da_sistemare = true;
      const res = await base44.functions.invoke('getOrdiniDaDichiarare', payload);
      setData(res.data);
      if (res.data.siti_distinti) setFilterOptions(res.data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [sito, provincia, annoChiusura, ricerca, soloDate, offset]);

  useEffect(() => { load(); }, [load]);

  // Reset offset quando cambiano i filtri
  useEffect(() => { setOffset(0); }, [sito, provincia, annoChiusura, ricerca, soloDate]);

  const handlePulisciSito = () => {
    setSito('');
    onPulisciFiltroSito();
  };

  const handleExport = async () => {
    // Scarica tutto l'elenco filtrato (senza limite) per l'export
    try {
      // tutte: le righe non si tagliano a mille, come il totale.
      const payload = { tutte: true, offset: 0 };
      if (sito) payload.sito = sito;
      if (provincia) payload.provincia = provincia;
      if (annoChiusura) payload.anno = Number(annoChiusura);
      if (ricerca) payload.ricerca = ricerca;
      if (soloDate) payload.solo_date_da_sistemare = true;
      const res = await base44.functions.invoke('getOrdiniDaDichiarare', payload);
      exportDaDichiarareExcel(res.data.righe, res.data.totale_righe, res.data.totale_kg);
    } catch (e) {
      alert('Errore nell\'export: ' + e.message);
    }
  };

  const righe = data?.righe || [];
  const totaleRighe = data?.totale_righe || 0;
  const totaleKg = data?.totale_kg || 0;
  const dateInfo = data?.date_da_sistemare || { n: 0 };
  const senzaFineAPortale = data?.senza_fine_a_portale || 0;
  const senzaFineDalGestionale = data?.senza_fine_dal_gestionale || 0;
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
          <label className="text-xs text-muted-foreground" title="L'anno della fine del trasporto">Anno (fine trasporto)</label>
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
        <label className="flex items-center gap-1.5 text-xs h-9" title="Solo gli ordini il cui formulario, nel gestionale, non ha tutte le date obbligatorie o le ha incoerenti">
          <input type="checkbox" checked={soloDate} onChange={e => setSoloDate(e.target.checked)} />
          Solo con le date da sistemare
        </label>
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
        <span><strong className="text-foreground">{formatIntero(totaleRighe)}</strong> ordini</span>
        <span><strong className="text-foreground">{kg(totaleKg)}</strong> kg totali</span>
        {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
      </div>
      {(dateInfo.n > 0 || senzaFineAPortale > 0) && (
        <div className="text-xs border border-amber-300 bg-amber-50 text-amber-900 rounded-lg px-3 py-2 space-y-0.5">
          {dateInfo.n > 0 && (
            <p>
              <strong>{formatIntero(dateInfo.n)}</strong> {dateInfo.n === 1 ? 'ordine ha' : 'ordini hanno'}, nel gestionale, un formulario terminato senza tutte le date obbligatorie ({kg(dateInfo.kg)} kg da dichiarare): immissione, inizio e fine trasporto vanno completate.
              {dateInfo.fuori_dai_mesi > 0 && ` A ${formatIntero(dateInfo.fuori_dai_mesi)} (${kg(dateInfo.fuori_dai_mesi_kg)} kg) manca la fine trasporto dell'arrivo all'impianto: il portale li conta nella giacenza, il gestionale non li colloca in nessun mese finche' la data non arriva.`}
            </p>
          )}
          {senzaFineAPortale > 0 && (
            <p>
              {formatIntero(senzaFineAPortale)} {senzaFineAPortale === 1 ? 'riga' : 'righe'} del file del portale senza fine trasporto
              {senzaFineDalGestionale > 0 ? `: ${formatIntero(senzaFineDalGestionale)} la ${senzaFineDalGestionale === 1 ? 'prende' : 'prendono'} dal formulario del gestionale` : ''}
              {senzaFineAPortale - senzaFineDalGestionale > 0 ? `${senzaFineDalGestionale > 0 ? ', le altre' : ':'} in fondo alla lista, fuori dal filtro per anno` : ''}.
            </p>
          )}
        </div>
      )}

      {/* Tabella */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-2 py-2 font-semibold">Ordine</th>
                <th className="px-2 py-2 font-semibold">FIR</th>
                <th className="px-2 py-2 font-semibold">Fine trasporto</th>
                <th className="px-2 py-2 font-semibold">Punto di raccolta</th>
                <th className="px-2 py-2 font-semibold">Comune</th>
                <th className="px-2 py-2 font-semibold">Prov.</th>
                <th className="px-2 py-2 font-semibold">Prodotto</th>
                <th className="px-2 py-2 font-semibold text-right">Peso da dichiarare</th>
                <th className="px-2 py-2 font-semibold">Destinazione</th>
                <th className="px-2 py-2 font-semibold">Trasferito a</th>
                <th className="px-2 py-2 font-semibold" title="Il formulario nel gestionale: le date obbligatorie che mancano o non tornano">Formulario nel gestionale</th>
              </tr>
            </thead>
            <tbody>
              {righe.length === 0 && (
                <tr><td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">Nessun ordine da dichiarare</td></tr>
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
                    <td className="px-2 py-1.5" title={r.data_chiusura ? `chiuso a portale il ${fmtData(r.data_chiusura)}` : ''}>{fmtData(r.fine_trasporto)}{r.fine_dal_gestionale && <span className="block text-[10px] text-muted-foreground" title="Il file del portale non la scrive: e' quella del formulario nel gestionale">dal gestionale</span>}</td>
                    <td className="px-2 py-1.5">{r.punto_di_raccolta || '—'}</td>
                    <td className="px-2 py-1.5">{r.comune || '—'}</td>
                    <td className="px-2 py-1.5">{r.provincia || '—'}</td>
                    <td className="px-2 py-1.5">{r.prodotto || '—'}</td>
                    <td className="px-2 py-1.5 text-right font-medium">{kg(r.peso_non_dichiarato_kg)} kg</td>
                    <td className="px-2 py-1.5">{r.destinazione || '—'}</td>
                    <td className="px-2 py-1.5">{r.destinazione_secondaria || '—'}</td>
                    <td className="px-2 py-1.5 text-xs"><Formulario r={r} /></td>
                  </tr>
                );
              })}
            </tbody>
            {righe.length > 0 && (
              <tfoot className="bg-muted/50 font-bold border-t-2">
                <tr>
                  <td className="px-2 py-2" colSpan={7}>TOTALE ({formatIntero(totaleRighe)} ordini)</td>
                  <td className="px-2 py-2 text-right">{kg(totaleKg)} kg</td>
                  <td className="px-2 py-2" colSpan={3}></td>
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