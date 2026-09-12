import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Calculator, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { formatNumber } from '@/lib/utils';
import PassivaRaccoglitoriTable from './PassivaRaccoglitoriTable';
import PassivaImpiantiTable from './PassivaImpiantiTable';
import PassivaSecondariaTable from './PassivaSecondariaTable';
import PassivaAnomalie from './PassivaAnomalie';

const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const ANNI = [2024, 2025, 2026];

const TIPOLABEL = { 'RETE': 'Rete', 'ACI': 'ACI', 'EXTRA_RACCOLTA': 'Extra Raccolta' };

export default function PassivaModulo({ tipologia, periodo, setPeriodo }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const calcola = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await base44.functions.invoke('calcolaPassiva', {
        anno: periodo.anno, mese: periodo.mese, tipologia,
      });
      setResult(res.data || res);
    } catch (e) {
      setError(e.message || 'Errore durante il calcolo');
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      {/* Selettori e pulsante */}
      <div className="flex flex-wrap items-end gap-3 p-4 border rounded-lg bg-muted/30">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Anno</label>
          <Select value={String(periodo.anno)} onValueChange={v => setPeriodo({ ...periodo, anno: Number(v) })}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{ANNI.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Mese</label>
          <Select value={periodo.mese} onValueChange={v => setPeriodo({ ...periodo, mese: v })}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>{MESI.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button onClick={calcola} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Calculator className="w-4 h-4 mr-1.5" />}
          Calcola
        </Button>
        {tipologia === 'EXTRA_RACCOLTA' && (
          <Link to="/extra-raccolta" className="ml-auto text-sm text-primary hover:underline inline-flex items-center gap-1">
            <ExternalLink className="w-3.5 h-3.5" /> Inserisci o modifica gli interventi
          </Link>
        )}
      </div>

      {error && <div className="text-sm text-destructive bg-destructive/10 px-4 py-2 rounded">{error}</div>}

      {result && (
        <>
          {/* Riepilogo totali + quadratura */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="border rounded-lg p-3 bg-card">
              <div className="text-xs text-muted-foreground">Raccoglitori</div>
              <div className="text-lg font-bold tabular-nums">€ {formatNumber(result.totali.raccoglitori, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div className="border rounded-lg p-3 bg-card">
              <div className="text-xs text-muted-foreground">Impianti e stoccaggi</div>
              <div className="text-lg font-bold tabular-nums">€ {formatNumber(result.totali.impianti_stoccaggi, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div className="border rounded-lg p-3 bg-card">
              <div className="text-xs text-muted-foreground">Trasporti secondaria</div>
              <div className="text-lg font-bold tabular-nums">€ {formatNumber(result.totali.trasporti_secondaria, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div className="border-2 rounded-lg p-3 bg-card">
              <div className="text-xs text-muted-foreground">Totale complessivo</div>
              <div className="text-lg font-bold tabular-nums">€ {formatNumber(result.totali.totale_complessivo, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              {/* Quadratura */}
              <div className={`flex items-center gap-1 mt-1.5 text-xs font-medium ${result.quadratura.coincidente ? 'text-success' : 'text-destructive'}`}>
                {result.quadratura.coincidente
                  ? <><CheckCircle2 className="w-3.5 h-3.5" /> Quadratura OK</>
                  : <><XCircle className="w-3.5 h-3.5" /> Quadratura: {formatNumber(result.quadratura.tonnellate_totali)} vs {formatNumber(result.quadratura.tonnellate_raccoglitori)} t</>}
              </div>
            </div>
          </div>

          {/* Anomalie */}
          <PassivaAnomalie anomalie={result.anomalie} />

          {/* Tabelle */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-2">Raccoglitori (RACCOLTA)</h3>
              <PassivaRaccoglitoriTable data={result.raccoglitori} />
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2">Impianti e stoccaggi (TRATTAMENTO / CONFERIMENTO_STOCCAGGIO)</h3>
              <PassivaImpiantiTable data={result.impianti_stoccaggi} />
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2">Trasporti secondaria (TRASPORTO_SECONDARIA)</h3>
              <PassivaSecondariaTable data={result.trasporti_secondaria} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}