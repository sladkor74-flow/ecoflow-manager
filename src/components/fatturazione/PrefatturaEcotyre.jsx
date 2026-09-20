import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Upload, CheckCircle, AlertTriangle, FileText, Info } from 'lucide-react';
import { formatKg, formatNumber, formatIntero } from '@/lib/utils';
import { giornoRoma } from '@/lib/giornoItaliano';

const NOMI = { RETE: 'Rete', ACI: 'ACI', EXTRA_RACCOLTA: 'Extra raccolta' };
const SERVIZI = { TRASP: 'Trasp', TRASP_TRATT: 'Trasp+Tratt' };
const euro = (v) => (v === null || v === undefined ? '—' : formatNumber(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const kg = (v) => (v === null || v === undefined ? '—' : formatKg(v));
// il giorno e' quello italiano: un caricamento fatto dopo mezzanotte non deve risultare del giorno prima
const giorno = (v) => (v ? (giornoRoma(v) || String(v).slice(0, 10)).split('-').reverse().join('/') : '—');
const messaggio = (e) => e?.response?.data?.error || e?.data?.error || e.message || String(e);

function Tabella({ titolo, spiega, colonne, righe, tono = 'amber' }) {
  if (!righe || righe.length === 0) return null;
  const c = tono === 'red' ? 'border-red-200 bg-red-50/60' : tono === 'grigio' ? 'border-border bg-muted/30' : 'border-amber-200 bg-amber-50/60';
  return (
    <div className={`border rounded-lg p-3 ${c}`}>
      <p className="text-sm font-semibold">{titolo} ({righe.length})</p>
      {spiega && <p className="text-xs text-muted-foreground mb-2">{spiega}</p>}
      <div className="overflow-x-auto max-h-64 overflow-y-auto bg-background/80 rounded border">
        <table className="w-full text-xs">
          <thead className="bg-muted sticky top-0"><tr>{colonne.map(k => <th key={k.t} className={`px-2 py-1.5 font-semibold ${k.d ? 'text-right' : 'text-left'}`}>{k.t}</th>)}</tr></thead>
          <tbody>
            {righe.map((r, i) => (
              <tr key={i} className="border-t">{colonne.map(k => <td key={k.t} className={`px-2 py-1 ${k.d ? 'text-right tabular-nums' : ''} ${k.m ? 'font-mono' : ''}`}>{k.v(r)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// La prefattura scaricata dal portale Ecotyre, confrontata ordine per ordine con
// quello che il gestionale calcola per lo stesso mese. Si guarda PRIMA di esportare.
export default function PrefatturaEcotyre({ periodo, isAdmin, onEsito }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [occupato, setOccupato] = useState(false);
  const [errore, setErrore] = useState('');
  const input = useRef(null);
  const { toast } = useToast();

  const carica = async () => {
    setLoading(true); setErrore('');
    try {
      const res = await base44.functions.invoke('prefatturaEcotyre', { azione: 'confronta', anno: periodo.anno, mese: periodo.mese });
      setData(res.data);
      if (onEsito) onEsito(res.data);
    } catch (e) { setData(null); setErrore(messaggio(e)); if (onEsito) onEsito(null); }
    setLoading(false);
  };
  useEffect(() => { carica(); }, [periodo.anno, periodo.mese]);

  const scegli = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    if (!/\.(xlsx|xlsm|xls|csv|pdf)$/i.test(file.name)) { toast({ title: 'Formato non ammesso', description: 'La prefattura si carica in Excel o in PDF.', variant: 'destructive' }); return; }
    if (data?.prefattura && !window.confirm(`Per ${periodo.mese} ${periodo.anno} c'è già la prefattura "${data.prefattura.nome_file}". La nuova la sostituisce; la precedente resta nello storico come superata. Continuare?`)) return;
    setOccupato(true); setErrore('');
    try {
      // L'Excel si carica e lo legge la funzione; del PDF si estrae qui il testo, riga per riga, e si manda quello.
      const corpo = /\.pdf$/i.test(file.name)
        ? { linee_pdf: await (await import('@/lib/pdfTesto')).lineeDelPdf(file) }
        : { file_uri: (await base44.integrations.Core.UploadPrivateFile({ file })).file_uri };
      const res = await base44.functions.invoke('prefatturaEcotyre', { azione: 'carica', anno: periodo.anno, mese: periodo.mese, nome_file: file.name, ...corpo });
      setData(res.data);
      if (onEsito) onEsito(res.data);
      toast({ title: 'Prefattura letta', description: `${res.data?.prefattura?.numero_righe || 0} righe da ${file.name}` });
    } catch (e) { setErrore(messaggio(e)); }
    setOccupato(false);
  };

  const p = data?.prefattura, c = data?.confronto;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 border rounded-lg bg-muted/30">
        <div>
          <h2 className="font-heading font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Prefattura Ecotyre — {periodo.mese} {periodo.anno}</h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">Carica la prefattura scaricata dal portale (Excel, oppure PDF): viene confrontata ordine per ordine con quello che il gestionale calcola per il mese. Il canale di ogni ordine non va indicato: è quello che l'ordine ha nel gestionale.</p>
        </div>
        <div>
          <input ref={input} type="file" accept=".xlsx,.xlsm,.xls,.csv,.pdf" className="hidden" onChange={scegli} />
          <Button onClick={() => input.current?.click()} disabled={!isAdmin || occupato} title={!isAdmin ? "Riservato all'amministratore" : ''}>
            {occupato ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Upload className="w-4 h-4 mr-1.5" />}
            {p ? 'Sostituisci prefattura' : 'Carica prefattura'}
          </Button>
        </div>
      </div>

      {errore && <div className="border border-destructive/40 bg-destructive/5 rounded-lg p-3 text-sm text-destructive flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {errore}</div>}
      {loading && <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Confronto con i dati di oggi...</div>}

      {!loading && !p && !errore && (
        <div className="text-center py-10 text-muted-foreground border rounded-lg">Nessuna prefattura caricata per {periodo.mese} {periodo.anno}.</div>
      )}

      {!loading && p && c && (
        <>
          <div className={`border-2 rounded-lg p-4 ${c.coincide ? 'border-emerald-300 bg-emerald-50' : 'border-amber-300 bg-amber-50'}`}>
            <div className={`flex items-center gap-2 font-semibold ${c.coincide ? 'text-emerald-800' : 'text-amber-900'}`}>
              {c.coincide ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              {c.coincide ? 'La prefattura coincide con il gestionale, ordine per ordine.' : `${c.differenze} ${c.differenze === 1 ? 'differenza' : 'differenze'} fra la prefattura e il gestionale: da chiarire prima di esportare.`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {p.nome_file} · {formatIntero(p.numero_righe)} righe, {formatIntero(c.ordini_prefattura)} ordini · caricata il {giorno(p.caricata_il)} da {p.caricata_da || '—'}
              {!c.con_importi && ' · senza importi: confronto su ordini e pesi'}{!c.con_pesi && ' · senza pesi: confronto su ordini e importi'}
            </p>
            {p.note_lettura && <p className="text-xs mt-2 whitespace-pre-line flex items-start gap-1.5"><Info className="w-3.5 h-3.5 mt-0.5 shrink-0" /><span>{p.note_lettura}</span></p>}
          </div>

          {/* Un riquadro per canale: i tre canali non si sommano */}
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted"><tr>
                <th className="text-left px-3 py-2 font-semibold">Canale</th>
                <th className="text-right px-3 py-2 font-semibold">Ordini prefattura</th>
                <th className="text-right px-3 py-2 font-semibold">Ordini gestionale</th>
                <th className="text-right px-3 py-2 font-semibold">Kg prefattura</th>
                <th className="text-right px-3 py-2 font-semibold">Kg gestionale</th>
                <th className="text-right px-3 py-2 font-semibold">€ prefattura</th>
                <th className="text-right px-3 py-2 font-semibold">€ gestionale</th>
                <th className="text-right px-3 py-2 font-semibold">Differenza €</th>
              </tr></thead>
              <tbody>
                {c.canali.map(x => {
                  // l'extra raccolta non passa dalla prefattura: niente zeri e niente differenza, che non esistono
                  const fuori = x.fuori_prefattura;
                  const d = fuori || x.prefattura.euro === null ? null : Math.round((x.prefattura.euro - x.gestionale.euro) * 100) / 100;
                  return (
                    <tr key={x.canale} className="border-t">
                      <td className="px-3 py-1.5 font-medium">{NOMI[x.canale]}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fuori ? '—' : formatIntero(x.prefattura.ordini)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatIntero(x.gestionale.ordini)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fuori ? '—' : kg(x.prefattura.kg)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{kg(x.gestionale.kg)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fuori ? '—' : euro(x.prefattura.euro)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{euro(x.gestionale.euro)}</td>
                      <td className={`px-3 py-1.5 text-right tabular-nums font-medium ${d ? 'text-amber-700' : ''}`}>{d === null ? '—' : euro(d)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">Nelle colonne della prefattura entrano solo gli ordini che il gestionale ha nello stesso mese; gli altri sono elencati qui sotto.</p>

          {c.terziarie?.ordini > 0 && (
            <Tabella tono="grigio" titolo={`Terziarie in prefattura (sezione a parte): € ${euro(c.terziarie.euro)} su ${kg(c.terziarie.kg)} kg`}
              spiega={`Il portale le paga come trasporto (8 €/t con l'allegato VII, 10 €/t col formulario). Per ora restano fuori dalla fatturazione attiva e dai tre report: non sono una differenza, l'importo è qui per quando servirà.${c.terziarie.non_in_archivio > 0 ? ` ${c.terziarie.non_in_archivio} di questi ordini non sono nell'archivio Terziarie.` : ''}`}
              righe={c.terziarie.righe}
              colonne={[{ t: 'ID ordine', v: r => r.id_ordine, m: true }, { t: 'Documento', v: r => r.numero_fir || '—' }, { t: 'kg', v: r => kg(r.kg), d: true }, { t: '€/t', v: r => euro(r.prezzo_t), d: true }, { t: '€', v: r => euro(r.importo), d: true }, { t: 'In archivio', v: r => (r.in_archivio ? 'sì' : 'no') }]} />
          )}

          <Tabella tono="red" titolo="Nella prefattura ma non nel mese del gestionale" spiega="Ecotyre li riconosce in questo mese, il gestionale no: la ragione è scritta accanto."
            righe={c.solo_prefattura}
            colonne={[{ t: 'ID ordine', v: r => r.id_ordine, m: true }, { t: 'Canale', v: r => NOMI[r.canale] || '—' }, { t: 'Perché', v: r => r.spiegazione }, { t: 'kg', v: r => kg(r.kg), d: true }, { t: '€', v: r => euro(r.importo), d: true }]} />

          {c.canali.map(x => (
            <React.Fragment key={x.canale}>
              {x.fuori_prefattura && x.solo_gestionale.length > 0 && (
                <p className="text-xs text-muted-foreground flex items-start gap-1.5"><Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{NOMI[x.canale]}: {x.solo_gestionale.length} {x.solo_gestionale.length === 1 ? 'intervento' : 'interventi'} per € {euro(x.gestionale.euro)}. L'extra raccolta non passa dalla prefattura del portale e si fattura a parte: non è una differenza.</span></p>
              )}
              <Tabella tono="red" titolo={`${NOMI[x.canale]}: nel gestionale ma non nella prefattura`} spiega="Il gestionale li fatturerebbe, Ecotyre non li ha messi in prefattura."
                righe={x.fuori_prefattura ? [] : x.solo_gestionale}
                colonne={[{ t: 'ID ordine', v: r => r.id_ordine, m: true }, { t: 'Formulario', v: r => r.numero_fir || '—' }, { t: 'kg', v: r => kg(r.kg), d: true }, { t: '€', v: r => euro(r.importo), d: true }]} />
              <Tabella titolo={`${NOMI[x.canale]}: peso diverso`}
                righe={x.peso_diverso}
                colonne={[{ t: 'ID ordine', v: r => r.id_ordine, m: true }, { t: 'Formulario', v: r => r.numero_fir || '—' }, { t: 'kg prefattura', v: r => kg(r.kg_prefattura), d: true }, { t: 'kg gestionale', v: r => kg(r.kg_gestionale), d: true }, { t: '€ prefattura', v: r => euro(r.importo_prefattura), d: true }, { t: '€ gestionale', v: r => euro(r.importo_gestionale), d: true }]} />
              <Tabella titolo={`${NOMI[x.canale]}: tipo di servizio diverso`} spiega="Il tipo di servizio dipende dall'impianto di destinazione: Trasp quando il trattamento lo fattura Ecotyre, Trasp+Tratt negli altri casi."
                righe={x.servizio_diverso}
                colonne={[{ t: 'ID ordine', v: r => r.id_ordine, m: true }, { t: 'Formulario', v: r => r.numero_fir || '—' }, { t: 'Prefattura', v: r => SERVIZI[r.servizio_prefattura] || r.servizio_prefattura }, { t: 'Gestionale', v: r => SERVIZI[r.servizio_gestionale] || r.servizio_gestionale }, { t: 'kg', v: r => kg(r.kg), d: true }]} />
              <Tabella titolo={`${NOMI[x.canale]}: numero di formulario diverso`}
                righe={x.fir_diverso}
                colonne={[{ t: 'ID ordine', v: r => r.id_ordine, m: true }, { t: 'FIR prefattura', v: r => r.fir_prefattura }, { t: 'FIR gestionale', v: r => r.fir_gestionale }, { t: 'kg', v: r => kg(r.kg), d: true }]} />
              <Tabella titolo={`${NOMI[x.canale]}: stesso peso, importo diverso`} spiega="Il prezzo per tonnellata della prefattura è ricavato dall'importo: dice subito se è una tariffa diversa."
                righe={x.importo_diverso}
                colonne={[{ t: 'ID ordine', v: r => r.id_ordine, m: true }, { t: 'Formulario', v: r => r.numero_fir || '—' }, { t: 'kg', v: r => kg(r.kg), d: true }, { t: '€ prefattura', v: r => euro(r.importo_prefattura), d: true }, { t: '€ gestionale', v: r => euro(r.importo_gestionale), d: true }, { t: '€/t prefattura', v: r => euro(r.prezzo_prefattura_t), d: true }, { t: '€/t gestionale', v: r => euro(r.prezzo_gestionale_t), d: true }]} />
            </React.Fragment>
          ))}
        </>
      )}
    </div>
  );
}
