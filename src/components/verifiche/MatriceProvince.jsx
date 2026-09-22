import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, RefreshCw, FileSpreadsheet, FileText, Info, AlertTriangle } from 'lucide-react';
import { formatKg, formatIntero, formatTonnellate } from '@/lib/utils';
import { esportaTabellaExcel, esportaTabellaPdf } from '@/lib/esportaTabella';
import { oggiRoma } from '@/lib/giornoItaliano';

// Sezioni 3 e 4 del modulo Verifiche: la raccolta della RETE per provincia e mese,
// nei chilogrammi effettivi e nel numero di ritiri. Sono le due tabelle che
// stavano nel file Excel, ora costruite sui dati del gestionale.
//
// tipo: 'peso' | 'ritiri'

// Due mesi di fila senza ritiri in una provincia sono il primo segnale: al terzo
// mese consecutivo il consorzio considera la provincia scoperta. I mesi non ancora
// passati non contano, altrimenti da gennaio tutto l'anno sarebbe rosso.
function mesiSenzaRitiri(riga, mesiTrascorsi) {
  const serie = [];
  let inizio = null;
  for (let i = 0; i < mesiTrascorsi; i++) {
    if (riga.ritiri[i] === 0) {
      if (inizio === null) inizio = i;
      if (i === mesiTrascorsi - 1) serie.push({ da: inizio, a: i });
    } else if (inizio !== null) {
      serie.push({ da: inizio, a: i - 1 });
      inizio = null;
    }
  }
  return serie.filter(s => s.a - s.da + 1 >= 2);
}

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
  // Nell'anno in corso valgono i mesi fino a quello corrente, come nel motore di
  // alert. Anno e mese sono quelli di oggi in Italia, non dell'orologio del
  // dispositivo: fra il 31/12 e l'1/1 e a cavallo di fine mese sbagliava di un mese.
  const oggi = oggiRoma();
  const annoOggi = Number(oggi.slice(0, 4));
  const mesiTrascorsi = dati ? (dati.anno < annoOggi ? 12 : dati.anno === annoOggi ? Number(oggi.slice(5, 7)) : 0) : 0;
  // Regola 1: chi resta fuori dalla matrice si conta e si dice, solo se c'e'.
  // I terminati senza fine trasporto sono di qualunque anno, i ritiri senza
  // provincia dell'anno mostrato.
  //
  // Dal 22/09/2026 si dicono tutte le date obbligatorie dei formulari terminati
  // che mancano o non tornano (regola dell'utente: immissione, inizio e fine
  // trasporto), non solo la fine trasporto: date_da_sistemare di
  // matriceProvinceRete, del solo canale RETE. Chi ha la fine trasporto e' nella
  // matrice, nel mese della fine trasporto, ma va corretto lo stesso. Una
  // risposta di prima porta solo i senza fine trasporto, e si dice quello.
  const nSenzaFine = dati ? Number(dati.senza_fine_trasporto) || 0 : 0;
  const riepDate = dati && dati.date_da_sistemare;
  const nDate = riepDate ? Number(riepDate.totale) || 0 : 0;
  const altriDate = riepDate ? Math.max(0, nDate - (Number(riepDate.senza_fine_trasporto) || 0)) : 0;
  const testoDateRete = nDate > 0
    ? `rete: ${formatIntero(nDate)} ${nDate === 1 ? 'ritiro terminato' : 'ritiri terminati'} con date da sistemare (${riepDate.testo})`
      + [nSenzaFine > 0 ? `${formatIntero(nSenzaFine)} ${nSenzaFine === 1 ? 'escluso' : 'esclusi'} da ogni mese perché senza fine trasporto` : '',
        altriDate > 0 ? `${formatIntero(altriDate)} ${altriDate === 1 ? 'contato' : 'contati'} nel mese della fine trasporto` : ''].filter(Boolean).map((t, i) => (i ? `, ${t}` : `: ${t}`)).join('')
    : '';
  const senzaProvincia = (dati && dati.senza_provincia) || { ritiri: 0, kg: 0 };
  const esclusi = [
    riepDate
      ? testoDateRete
      : nSenzaFine > 0 ? `${formatIntero(nSenzaFine)} ${nSenzaFine === 1 ? 'terminato' : 'terminati'} di rete senza fine trasporto, ${nSenzaFine === 1 ? 'escluso' : 'esclusi'} da ogni mese` : '',
    senzaProvincia.ritiri > 0 ? `${formatIntero(senzaProvincia.ritiri)} ${senzaProvincia.ritiri === 1 ? 'ritiro' : 'ritiri'} del ${dati.anno} senza provincia (${formatTonnellate(senzaProvincia.kg / 1000)} t), ${senzaProvincia.ritiri === 1 ? 'escluso' : 'esclusi'} dalle righe e dai totali` : '',
  ].filter(Boolean);
  const vuoti = new Map();
  if (dati) for (const r of dati.righe) { const s = mesiSenzaRitiri(r, mesiTrascorsi); if (s.length) vuoti.set(r.provincia, s); }
  const gravi = [...vuoti.entries()].filter(([, s]) => s.some(x => x.a - x.da + 1 >= 3));
  const nomeMesi = (s) => (dati ? `${dati.mesi[s.da]}${s.a > s.da ? ` - ${dati.mesi[s.a]}` : ''}` : '');
  // Rosso pieno dal terzo mese di fila, rosso chiaro dal secondo.
  const stileVuoto = (provincia, i) => {
    const serie = vuoti.get(provincia);
    if (!serie) return '';
    const s = serie.find(x => i >= x.da && i <= x.a);
    if (!s) return '';
    return s.a - s.da + 1 >= 3 ? 'bg-red-200 text-red-900 font-semibold' : 'bg-red-50 text-red-700';
  };
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
      const sottotitolo = (peso
        ? `Rete, peso effettivo dei ritiri terminati per mese di fine trasporto · totale ${formatTonnellate(dati.totali.kg_totale / 1000)} t`
        : `Rete, numero di ritiri terminati per mese di fine trasporto · totale ${formatIntero(dati.totali.ritiri_totale)}`)
        // Anche nel file si dice chi e' rimasto fuori dai totali.
        + esclusi.map(e => ` · ${e}`).join('');
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

      {dati && vuoti.size > 0 && (
        <div className={`border rounded-lg px-4 py-3 text-sm ${gravi.length ? 'border-red-300 bg-red-50 text-red-900' : 'border-amber-300 bg-amber-50 text-amber-900'}`}>
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <div className="font-semibold">
                {gravi.length > 0
                  ? `${gravi.length === 1 ? '1 provincia è ferma' : gravi.length + ' province sono ferme'} da tre mesi o più`
                  : `${vuoti.size} ${vuoti.size === 1 ? 'provincia ha' : 'province hanno'} due mesi di fila senza ritiri`}
              </div>
              <ul className="space-y-0.5">
                {[...vuoti.entries()].map(([provincia, serie]) => {
                  const riga = dati.righe.find(r => r.provincia === provincia);
                  const massimo = Math.max(...serie.map(s => s.a - s.da + 1));
                  return (
                    <li key={provincia}>
                      <strong>{provincia}</strong> ({riga ? riga.regione : ''}): {serie.map(nomeMesi).join(', ')} — {massimo} mesi di fila senza ritiri
                      {massimo >= 3 ? ', da recuperare subito' : ', da coprire entro il mese prossimo'}
                    </li>
                  );
                })}
              </ul>
              <div className="text-xs">
                Al terzo mese consecutivo senza ritiri la provincia risulta scoperta: pianificare una raccolta prima che accada.
                Il motore di alert apre da solo una segnalazione al secondo mese a zero.
              </div>
            </div>
          </div>
        </div>
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
                    <td className="px-2 py-1.5 font-medium">
                      {r.provincia}
                      {vuoti.has(r.provincia) && (
                        <AlertTriangle
                          className={`w-3.5 h-3.5 inline-block ml-1 -mt-0.5 ${vuoti.get(r.provincia).some(s => s.a - s.da + 1 >= 3) ? 'text-red-700' : 'text-red-500'}`}
                          aria-label="Mesi consecutivi senza ritiri"
                        />
                      )}
                    </td>
                    {dati.mesi.map((m, i) => (
                      <td key={m} className={`px-2 py-1.5 text-right ${stileVuoto(r.provincia, i)}`}>
                        {i < mesiTrascorsi && valore(r, i) === 0 ? '0' : mostra(valore(r, i))}
                      </td>
                    ))}
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
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-red-50 border border-red-200" /> due mesi di fila senza ritiri</span>
            <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-red-200 border border-red-300" /> tre mesi o più: provincia scoperta</span>
            {peso && <span>Totale dell'anno: {formatTonnellate(dati.totali.kg_totale / 1000)} t in {formatIntero(dati.totali.ritiri_totale)} ritiri.</span>}
          </div>
        </>
      )}

      {/* Fuori dalla tabella, cosi' si vede anche in un anno senza righe. */}
      {dati && esclusi.length > 0 && (
        <div className="flex items-start gap-2 text-xs text-amber-800 border border-amber-200 bg-amber-50 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            {esclusi.map(e => <div key={e}>{e[0].toUpperCase() + e.slice(1)}.</div>)}
          </div>
        </div>
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
