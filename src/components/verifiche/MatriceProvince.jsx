import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, RefreshCw, FileSpreadsheet, FileText, Info } from 'lucide-react';
import { formatKg, formatIntero, formatTonnellate } from '@/lib/utils';
import { esportaTabellaExcel, esportaTabellaPdf } from '@/lib/esportaTabella';

// Sezioni 3 e 4 del modulo Verifiche: la raccolta della RETE per provincia e mese,
// nei chilogrammi effettivi e nel numero di ritiri. Sono le due tabelle che
// stavano nel file Excel, ora costruite sui dati del gestionale.
//
// tipo: 'peso' | 'ritiri'

const DESCRIZIONE = {
  peso: 'Peso effettivo dei ritiri terminati della rete, provincia per provincia e mese per mese. Il mese e\' quello di fine trasporto. ACI ed extra raccolta restano fuori: sono canali a se\'.',
  ritiri: 'Numero di ritiri terminati della rete, cioe\' di formulari, provincia per provincia e mese per mese. Il mese e\' quello di fine trasporto. ACI ed extra raccolta restano fuori: sono canali a se\'.',
};

export default function MatriceProvince({ tipo = 'peso' }) {
  const { toast } = useToast();
  const [dati, setDati] = useState(null);
  const [anno, setAnno] = useState(null);
  const [caricando, setCaricando] = useState(true);
  const [errore, setErrore] = useState(null);
  const [esportando, setEsportando] = useState(null);

  const carica = useCallback(async (annoRichiesto) => {
    setCaricando(true);
    setErrore(null);
    try {
      const res = await base44.functions.invoke('matriceProvinceRete', annoRichiesto ? { anno: annoRichiesto } : {});
      const d = res.data || res;
      setDati(d);
      setAnno(d.anno);
    } catch (e) {
      setErrore((e && e.data && e.data.error) || e.message || 'Errore nel caricamento');
    }
    setCaricando(false);
  }, []);

  useEffect(() => { carica(); }, [carica]);

  const peso = tipo === 'peso';
  const valore = (riga, i) => (peso ? riga.kg[i] : riga.ritiri[i]);
  const totaleRiga = (riga) => (peso ? riga.kg_totale : riga.ritiri_totale);
  const mostra = (v) => (v ? (peso ? formatKg(v) : formatIntero(v)) : <span className="text-muted-foreground">—</span>);

  const colonneExport = () => [
    { titolo: 'Regione', valore: (r) => r.regione, tipo: 'testo', peso: 1.4 },
    { titolo: 'Provincia', valore: (r) => r.provincia, tipo: 'testo', peso: 0.7 },
    ...(dati ? dati.mesi : []).map((m, i) => ({ titolo: m.slice(0, 3), valore: (r) => valore(r, i) || null, tipo: peso ? 'kg' : 'intero', peso: 0.8 })),
    { titolo: 'Totale', valore: (r) => totaleRiga(r), tipo: peso ? 'kg' : 'intero', peso: 1 },
  ];

  const totaliExport = () => {
    const valori = {};
    (dati ? dati.mesi : []).forEach((_, i) => { valori[i + 2] = peso ? dati.totali.kg[i] : dati.totali.ritiri[i]; });
    valori[(dati ? dati.mesi.length : 0) + 2] = peso ? dati.totali.kg_totale : dati.totali.ritiri_totale;
    return { etichetta: 'TOTALE', valori };
  };

  const esporta = async (formato) => {
    if (!dati) return;
    setEsportando(formato);
    try {
      const titolo = peso ? `Raccolto per provincia ${anno} (kg)` : `Ritiri per provincia ${anno}`;
      const sottotitolo = peso
        ? `Rete, peso effettivo dei ritiri terminati per mese di fine trasporto · totale ${formatTonnellate(dati.totali.kg_totale / 1000)} t`
        : `Rete, numero di ritiri terminati per mese di fine trasporto · totale ${formatIntero(dati.totali.ritiri_totale)}`;
      const comuni = { nomeFile: titolo, colonne: colonneExport(), righe: dati.righe, totali: totaliExport() };
      if (formato === 'excel') await esportaTabellaExcel({ ...comuni, foglio: peso ? 'Raccolto' : 'Ritiri', titolo, sottotitolo });
      else await esportaTabellaPdf({ ...comuni, titolo, sottotitolo });
    } catch (e) {
      toast({ title: 'Esportazione non riuscita', description: e.message || String(e), variant: 'destructive' });
    }
    setEsportando(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <select
            value={anno || ''}
            onChange={(e) => { const a = Number(e.target.value); setAnno(a); carica(a); }}
            className="px-2 py-1.5 rounded-md border bg-card text-sm"
            disabled={caricando || !dati}
          >
            {(dati ? dati.anni : []).map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => carica(anno)} disabled={caricando}>
            {caricando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Aggiorna
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1" onClick={() => esporta('excel')} disabled={!dati || !!esportando}>
            {esportando === 'excel' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} Excel
          </Button>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => esporta('pdf')} disabled={!dati || !!esportando}>
            {esportando === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} PDF
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>{DESCRIZIONE[tipo]}</span>
      </div>

      {errore && (
        <div className="border border-red-300 bg-red-50 text-red-800 rounded-lg px-4 py-3 text-sm">{errore}</div>
      )}

      {caricando && !dati ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Calcolo la raccolta per provincia…
        </div>
      ) : dati && dati.righe.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">Nessun ritiro terminato nel {anno}.</div>
      ) : dati && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Tessera etichetta={peso ? 'Totale raccolto' : 'Totale ritiri'}
              valore={peso ? `${formatTonnellate(dati.totali.kg_totale / 1000)} t` : formatIntero(dati.totali.ritiri_totale)}
              dettaglio={peso ? `${formatKg(dati.totali.kg_totale)} kg` : `${formatTonnellate(dati.totali.kg_totale / 1000)} t raccolte`} />
            <Tessera etichetta="Province con ritiri" valore={formatIntero(dati.righe.length)} dettaglio={`${new Set(dati.righe.map(r => r.regione)).size} regioni`} />
            <Tessera etichetta="Mese migliore" {...mesePiuAlto(dati, peso)} />
            <Tessera etichetta={peso ? 'Media per ritiro' : 'Media ritiri al mese'}
              valore={peso
                ? `${formatKg(dati.totali.ritiri_totale ? dati.totali.kg_totale / dati.totali.ritiri_totale : 0)} kg`
                : formatIntero(mesiConDati(dati) ? dati.totali.ritiri_totale / mesiConDati(dati) : 0)}
              dettaglio={peso ? 'peso effettivo medio' : `su ${mesiConDati(dati)} mesi con ritiri`} />
          </div>

          <div className="border rounded-lg overflow-x-auto bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="text-left px-3 py-2 font-medium sticky left-0 bg-muted/50">Regione</th>
                  <th className="text-left px-2 py-2 font-medium">Prov.</th>
                  {dati.mesi.map(m => <th key={m} className="text-right px-2 py-2 font-medium whitespace-nowrap">{m.slice(0, 3)}</th>)}
                  <th className="text-right px-3 py-2 font-medium">Totale</th>
                </tr>
              </thead>
              <tbody>
                {dati.righe.map(r => (
                  <tr key={r.provincia} className="border-t hover:bg-muted/30 tabular-nums">
                    <td className="px-3 py-1.5 sticky left-0 bg-card">{r.regione || '—'}</td>
                    <td className="px-2 py-1.5 font-medium">{r.provincia}</td>
                    {dati.mesi.map((m, i) => <td key={m} className="px-2 py-1.5 text-right">{mostra(valore(r, i))}</td>)}
                    <td className="px-3 py-1.5 text-right font-semibold">{peso ? formatKg(r.kg_totale) : formatIntero(r.ritiri_totale)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/50 font-semibold border-t-2">
                <tr className="tabular-nums">
                  <td className="px-3 py-2 sticky left-0 bg-muted/50">TOTALE</td>
                  <td className="px-2 py-2"></td>
                  {dati.mesi.map((m, i) => (
                    <td key={m} className="px-2 py-2 text-right">{peso ? formatKg(dati.totali.kg[i]) : formatIntero(dati.totali.ritiri[i])}</td>
                  ))}
                  <td className="px-3 py-2 text-right">{peso ? formatKg(dati.totali.kg_totale) : formatIntero(dati.totali.ritiri_totale)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {peso && (
            <p className="text-xs text-muted-foreground">
              Totale dell'anno: {formatTonnellate(dati.totali.kg_totale / 1000)} t in {formatIntero(dati.totali.ritiri_totale)} ritiri.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Tessera({ etichetta, valore, dettaglio }) {
  return (
    <div className="border rounded-lg p-3 bg-card">
      <div className="text-xs text-muted-foreground">{etichetta}</div>
      <div className="text-xl font-bold tabular-nums">{valore}</div>
      {dettaglio && <div className="text-xs text-muted-foreground">{dettaglio}</div>}
    </div>
  );
}

const mesiConDati = (dati) => dati.totali.ritiri.filter(v => v > 0).length;

function mesePiuAlto(dati, peso) {
  const serie = peso ? dati.totali.kg : dati.totali.ritiri;
  let i = 0;
  serie.forEach((v, k) => { if (v > serie[i]) i = k; });
  if (!serie[i]) return { valore: '—' };
  return {
    valore: dati.mesi[i],
    dettaglio: peso ? `${formatTonnellate(serie[i] / 1000)} t` : `${formatIntero(serie[i])} ritiri`,
  };
}
