import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, RefreshCw, Download, AlertCircle } from 'lucide-react';
import ReportPivotTable from '@/components/report-mensile/ReportPivotTable';

// Riproduce le otto pivot del foglio REPORT MENSILE del gestionale Excel.
// Le definizioni vivono nel backend, in shared/reportMensile.ts: qui restano solo
// il raggruppamento in schede e la scelta del periodo.

const MESI = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

const GRUPPI = [
  { chiave: 'rete', titolo: 'Rete', pivot: ['raccolta', 'impianti', 'viaggiRete'] },
  { chiave: 'aci', titolo: 'ACI', pivot: ['aci', 'secondarieAci', 'viaggiSecondarieAci'] },
  { chiave: 'secondarie', titolo: 'Secondarie di rete', pivot: ['secondarie', 'viaggiSecondarie'] },
  { chiave: 'terziarie', titolo: 'Terziarie ed extra', pivot: ['terziarie', 'extra', 'extraSecondarie'] },
];

function anniDisponibili() {
  const corrente = new Date().getFullYear();
  return [corrente + 1, corrente, corrente - 1, corrente - 2];
}

// Appiattisce le pivot di una scheda in un CSV leggibile da Excel:
// punto e virgola come separatore, virgola come segno decimale.
function componiCsv(pivots, gruppo, etichettaPeriodo) {
  const righe = [];
  const num = (v) => String(v == null ? 0 : v).replace('.', ',');

  for (const k of gruppo.pivot) {
    const p = pivots[k];
    if (!p) continue;
    const colonne = p.senzaColonne ? [] : p.colonne;
    const unaMisura = p.misure.length === 1;

    righe.push([p.titolo, etichettaPeriodo]);
    righe.push([
      p.etichetteRiga.join(' > '),
      ...colonne.flatMap(c => p.misure.map((m, i) => (unaMisura ? c : c + ' ' + p.etichetteMisure[i]))),
      ...p.misure.map((m, i) => (p.senzaColonne ? p.etichetteMisure[i] : 'Totale ' + p.etichetteMisure[i])),
    ]);

    const visita = (nodo, prefisso) => {
      if (!nodo.figli) return;
      for (const f of nodo.figli) {
        const etichetta = prefisso ? prefisso + ' > ' + f.etichetta : f.etichetta;
        righe.push([
          etichetta,
          ...colonne.flatMap(c => p.misure.map(m => num(f.valori[c] ? f.valori[c][m] : 0))),
          ...p.misure.map(m => num(f.totali[m])),
        ]);
        visita(f, etichetta);
      }
    };
    visita(p.radice, '');

    righe.push([
      'Totale complessivo',
      ...colonne.flatMap(c => p.misure.map(m => num(p.radice.valori[c] ? p.radice.valori[c][m] : 0))),
      ...p.misure.map(m => num(p.radice.totali[m])),
    ]);
    righe.push([]);
  }

  return righe
    .map(r => r.map(c => {
      const s = String(c ?? '');
      return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(';'))
    .join('\n');
}

export default function ReportMensile() {
  const oggi = new Date();
  const [anno, setAnno] = useState(oggi.getFullYear());
  const [mese, setMese] = useState(MESI[oggi.getMonth()]);
  const [scheda, setScheda] = useState('rete');
  const [pivots, setPivots] = useState({});
  const [caricando, setCaricando] = useState(true);
  const [errore, setErrore] = useState(null);
  const caricatiRef = useRef(new Set());

  const azzera = () => { caricatiRef.current = new Set(); setPivots({}); };

  useEffect(() => { azzera(); }, [anno, mese]);

  useEffect(() => {
    const gruppo = GRUPPI.find(g => g.chiave === scheda);
    if (!gruppo) return;
    const daCaricare = gruppo.pivot.filter(k => !caricatiRef.current.has(k));
    if (daCaricare.length === 0) { setCaricando(false); return; }

    let annullato = false;
    setCaricando(true);
    setErrore(null);
    (async () => {
      try {
        const res = await base44.functions.invoke('reportMensile', { anno, mese, pivot: daCaricare });
        if (annullato) return;
        const dati = res.data || res;
        setPivots(prev => ({ ...prev, ...dati.pivots }));
        daCaricare.forEach(k => caricatiRef.current.add(k));
      } catch (e) {
        if (annullato) return;
        const dati = e && e.response && e.response.data;
        setErrore(dati && dati.error ? dati.error : (e.message || 'Errore nel calcolo delle pivot'));
      }
      if (!annullato) setCaricando(false);
    })();
    return () => { annullato = true; };
  }, [scheda, anno, mese]);

  const gruppoAttivo = GRUPPI.find(g => g.chiave === scheda);
  const etichettaMese = `${mese} ${anno}`;
  const etichettaAnno = `Anno ${anno}`;

  const scarica = () => {
    const csv = componiCsv(pivots, gruppoAttivo, etichettaMese);
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-mensile-${gruppoAttivo.chiave}-${anno}-${mese.toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const prontoPerScarico = gruppoAttivo.pivot.every(k => pivots[k]);

  return (
    <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold">Report Mensile</h1>
          <p className="text-muted-foreground mt-1">
            Le stesse pivot del foglio Excel. Quattro guardano il mese scelto, quattro l'anno intero:
            l'etichetta accanto a ogni titolo dice quale periodo sta leggendo.
          </p>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          <label className="text-xs text-muted-foreground">
            Anno
            <select
              value={anno}
              onChange={(e) => setAnno(Number(e.target.value))}
              className="block mt-1 px-2 py-1.5 rounded-md border bg-card text-sm text-foreground"
            >
              {anniDisponibili().map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            Mese
            <select
              value={mese}
              onChange={(e) => setMese(e.target.value)}
              className="block mt-1 px-2 py-1.5 rounded-md border bg-card text-sm text-foreground"
            >
              {MESI.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <button
            onClick={azzera}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm hover:bg-muted"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Ricalcola
          </button>
          <button
            onClick={scarica}
            disabled={!prontoPerScarico}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm hover:bg-muted disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" /> Esporta scheda
          </button>
        </div>
      </div>

      <Tabs value={scheda} onValueChange={setScheda}>
        <TabsList>
          {GRUPPI.map(g => <TabsTrigger key={g.chiave} value={g.chiave}>{g.titolo}</TabsTrigger>)}
        </TabsList>

        {GRUPPI.map(g => (
          <TabsContent key={g.chiave} value={g.chiave} className="space-y-8 pt-4">
            {errore && (
              <div className="flex items-start gap-2 border border-red-300 bg-red-50 text-red-800 rounded-lg px-4 py-3 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{errore}</span>
              </div>
            )}
            {caricando && !g.pivot.every(k => pivots[k]) ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Calcolo in corso...
              </div>
            ) : (
              g.pivot.map(k => pivots[k] && (
                <ReportPivotTable
                  key={k}
                  pivot={pivots[k]}
                  periodo={pivots[k].periodo === 'mese' ? etichettaMese : etichettaAnno}
                />
              ))
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
