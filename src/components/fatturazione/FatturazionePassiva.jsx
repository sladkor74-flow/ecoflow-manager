import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Play, CheckCircle, Lock, RotateCcw, AlertTriangle } from 'lucide-react';
import FatturazioneDetail from './FatturazioneDetail';
import VoceDetailModal from './VoceDetailModal';

const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const ANNI = [2024, 2025, 2026];
const STATI = {
  bozza: { label: 'Bozza', color: 'bg-gray-100 text-gray-700' },
  elaborata: { label: 'Elaborata', color: 'bg-blue-100 text-blue-700' },
  verificata: { label: 'Verificata', color: 'bg-green-100 text-green-700' },
  approvata: { label: 'Approvata', color: 'bg-purple-100 text-purple-700' },
  chiusa: { label: 'Chiusa', color: 'bg-emerald-100 text-emerald-700' },
};

export default function FatturazionePassiva({ periodo, setPeriodo }) {
  const [doc, setDoc] = useState(null);
  const [fornitori, setFornitori] = useState([]);
  const [totale, setTotale] = useState(0);
  const [loading, setLoading] = useState(true);
  const [elaborating, setElaborating] = useState(false);
  const [selectedVoce, setSelectedVoce] = useState(null);
  const [error, setError] = useState('');

  const { anno, mese } = periodo;

  const loadDetail = async () => {
    setLoading(true); setError('');
    try {
      const res = await base44.functions.invoke('getFatturazioneDetail', { anno, mese });
      setDoc(res.data.documento);
      setFornitori(res.data.fornitori || []);
      setTotale(res.data.totale || 0);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { loadDetail(); }, [anno, mese]);

  const elabora = async () => {
    setElaborating(true); setError('');
    try {
      await base44.functions.invoke('elaboraFatturazionePassiva', { anno, mese });
      await loadDetail();
    } catch (e) { setError(e.message); }
    setElaborating(false);
  };

  const cambiaStato = async (azione) => {
    if (!doc) return;
    setError('');
    try {
      await base44.functions.invoke('cambiaStatoFatturazione', { documento_id: doc.id, azione });
      await loadDetail();
    } catch (e) { setError(e.message); }
  };

  const stato = doc?.stato || 'bozza';
  const statoInfo = STATI[stato] || STATI.bozza;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 p-4 border rounded-lg bg-muted/30">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Anno</label>
          <Select value={String(anno)} onValueChange={v => setPeriodo({ ...periodo, anno: Number(v) })}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{ANNI.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Mese</label>
          <Select value={mese} onValueChange={v => setPeriodo({ ...periodo, mese: v })}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>{MESI.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button onClick={elabora} disabled={elaborating || stato === 'chiusa'}>
          {elaborating ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Play className="w-4 h-4 mr-1.5" />}
          {doc ? 'Rielabora' : 'Elabora Fatturazione'}
        </Button>
        {doc && <span className={`text-xs px-2 py-1 rounded ${statoInfo.color}`}>● {statoInfo.label}</span>}
      </div>

      {error && <div className="text-sm text-red-600 flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> {error}</div>}

      {loading ? (
        <div className="text-center py-8 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Caricamento...</div>
      ) : !doc ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          Nessuna fatturazione elaborata per {mese} {anno}.<br />Seleziona il periodo e clicca "Elabora Fatturazione".
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="border rounded-lg p-3"><p className="text-xs text-muted-foreground">Fornitori</p><p className="text-xl font-bold">{doc.numero_fornitori || 0}</p></div>
            <div className="border rounded-lg p-3"><p className="text-xs text-muted-foreground">Voci</p><p className="text-xl font-bold">{doc.numero_voci || 0}</p></div>
            <div className="border rounded-lg p-3"><p className="text-xs text-muted-foreground">Totale</p><p className="text-xl font-bold">€ {(doc.totale || 0).toFixed(2)}</p></div>
            <div className="border rounded-lg p-3"><p className="text-xs text-muted-foreground">Errori</p><p className={`text-xl font-bold ${doc.voci_errore > 0 ? 'text-red-600' : 'text-green-600'}`}>{doc.voci_errore || 0}</p></div>
          </div>

          <FatturazioneDetail fornitori={fornitori} totale={totale} onVoceClick={setSelectedVoce} />

          <div className="flex flex-wrap gap-2">
            {stato === 'elaborata' && <Button variant="outline" onClick={() => cambiaStato('verifica')}><CheckCircle className="w-4 h-4 mr-1.5" /> Verifica</Button>}
            {stato === 'verificata' && <Button variant="outline" onClick={() => cambiaStato('approva')}><CheckCircle className="w-4 h-4 mr-1.5" /> Approva</Button>}
            {stato === 'approvata' && <Button onClick={() => cambiaStato('chiudi')}><Lock className="w-4 h-4 mr-1.5" /> Chiudi Periodo</Button>}
            {stato === 'chiusa' && <Button variant="outline" onClick={() => cambiaStato('riapri')}><RotateCcw className="w-4 h-4 mr-1.5" /> Riapri</Button>}
          </div>
        </>
      )}

      <VoceDetailModal voce={selectedVoce} onClose={() => setSelectedVoce(null)} />
    </div>
  );
}