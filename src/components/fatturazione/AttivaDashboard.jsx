import React from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Play, CheckCircle, AlertTriangle, Lock } from 'lucide-react';

const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const ANNI = [2024, 2025, 2026];
const STATI = {
  elaborata: 'bg-blue-100 text-blue-700', verificata: 'bg-green-100 text-green-700',
  approvata: 'bg-purple-100 text-purple-700', esportata: 'bg-cyan-100 text-cyan-700',
  chiusa: 'bg-emerald-100 text-emerald-700', bozza: 'bg-gray-100 text-gray-700',
};
const TIPS = [
  { key: 'RETE', label: 'Rete' },
  { key: 'ACI', label: 'ACI' },
  { key: 'EXTRA_RACCOLTA', label: 'Extra Raccolta' },
];

export default function AttivaDashboard({ periodo, setPeriodo, data, loading, elaborating, onElabora, onReload }) {
  const { anno, mese } = periodo;

  const cambiaStato = async (azione) => {
    for (const t of TIPS) {
      const doc = data[t.key]?.documento;
      if (doc) {
        try { await base44.functions.invoke('cambiaStatoFatturazione', { documento_id: doc.id, azione }); } catch (e) {}
      }
    }
    await onReload();
  };

  const totaleRete = data.RETE?.documento?.totale || 0;
  const totaleAci = data.ACI?.documento?.totale || 0;
  const totaleExtra = data.EXTRA_RACCOLTA?.documento?.totale || 0;
  const totaleGenerale = totaleRete + totaleAci + totaleExtra;
  const errori = TIPS.reduce((s, t) => s + (data[t.key]?.documento?.voci_errore || 0), 0);
  const sospesi = TIPS.reduce((s, t) => s + (data[t.key]?.documento?.voci_sospese || 0), 0);
  const tuttiElaborati = TIPS.every(t => data[t.key]?.documento);
  const tuttiVerificati = TIPS.every(t => data[t.key]?.documento?.stato === 'verificata');
  const tuttiApprovati = TIPS.every(t => data[t.key]?.documento?.stato === 'approvata' || data[t.key]?.documento?.stato === 'esportata');

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
        <Button onClick={onElabora} disabled={elaborating}>
          {elaborating ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Play className="w-4 h-4 mr-1.5" />}
          Elabora Mese
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Caricamento...</div>
      ) : !tuttiElaborati ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          Nessuna fatturazione attiva elaborata per {mese} {anno}.<br />Clicca "Elabora Mese" per generare.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {TIPS.map(t => {
              const doc = data[t.key]?.documento;
              const tot = data[t.key]?.documento?.totale || 0;
              const voci = data[t.key]?.documento?.numero_voci || 0;
              return (
                <div key={t.key} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-heading font-semibold">{t.label}</h3>
                    {doc && <span className={`text-xs px-2 py-0.5 rounded ${STATI[doc.stato] || ''}`}>{doc.stato}</span>}
                  </div>
                  <p className="text-2xl font-bold">€ {tot.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{voci} prestazioni</p>
                </div>
              );
            })}
          </div>

          <div className="border rounded-lg p-4 bg-primary/5">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-lg">TOTALE FATTURAZIONE ATTIVA</h3>
              <span className="text-2xl font-bold">€ {totaleGenerale.toFixed(2)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="border rounded-lg p-3"><p className="text-xs text-muted-foreground">Prestazioni</p><p className="text-lg font-bold">{TIPS.reduce((s, t) => s + (data[t.key]?.documento?.numero_voci || 0), 0)}</p></div>
            <div className="border rounded-lg p-3"><p className="text-xs text-muted-foreground">🟢 Verificate</p><p className="text-lg font-bold text-green-600">{TIPS.reduce((s, t) => s + (data[t.key]?.righe?.filter(r => r.stato_validazione === 'verificato').length || 0), 0)}</p></div>
            <div className="border rounded-lg p-3"><p className="text-xs text-muted-foreground">🔴 Errori</p><p className={`text-lg font-bold ${errori > 0 ? 'text-red-600' : 'text-green-600'}`}>{errori}</p></div>
            <div className="border rounded-lg p-3"><p className="text-xs text-muted-foreground">⚠ Sospese</p><p className={`text-lg font-bold ${sospesi > 0 ? 'text-amber-600' : 'text-green-600'}`}>{sospesi}</p></div>
          </div>

          {errori > 0 && (
            <div className="text-sm text-red-600 flex items-center gap-1 border border-red-200 bg-red-50 p-3 rounded-lg">
              <AlertTriangle className="w-4 h-4" /> {errori} prestazioni con errori (tariffa mancante). Verificare le tariffe nella tab "Tariffe".
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => cambiaStato('verifica')}><CheckCircle className="w-4 h-4 mr-1.5" /> Verifica</Button>
            {tuttiVerificati && <Button variant="outline" onClick={() => cambiaStato('approva')}><CheckCircle className="w-4 h-4 mr-1.5" /> Approva</Button>}
            {tuttiApprovati && <Button onClick={() => cambiaStato('chiudi')}><Lock className="w-4 h-4 mr-1.5" /> Chiudi Periodo</Button>}
          </div>
        </>
      )}
    </div>
  );
}