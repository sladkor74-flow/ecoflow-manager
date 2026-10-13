import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Upload, CheckCircle, AlertTriangle, FileText, Info } from 'lucide-react';
import { formatKg, formatNumber, formatIntero } from '@/lib/utils';
import { giornoRoma } from '@/lib/giornoItaliano';
import { STILE_SURPLUS, ESITI_SURPLUS, FORME_SURPLUS, ordiniSurplusDaChiarire, baseSurplus } from '@/lib/surplusVista';
import { testoEuroT } from '@/lib/surplus';
import NomeSurplus from './NomeSurplus';

const NOMI = { RETE: 'Rete', ACI: 'ACI', EXTRA_RACCOLTA: 'Extra raccolta' };
const SERVIZI = { TRASP: 'Trasp', TRASP_TRATT: 'Trasp+Tratt' };
const euro = (v) => (v === null || v === undefined ? '—' : formatNumber(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const kg = (v) => (v === null || v === undefined ? '—' : formatKg(v));
// un importo col segno davanti all'euro: «+€ 1.268,40», «−€ 0,02»
const euroConSegno = (v) => (v === null || v === undefined ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}€ ${euro(Math.abs(v))}`);
const TONI = {
  ok: 'bg-emerald-100 text-emerald-800', errore: 'bg-red-100 text-red-800', attenzione: 'bg-amber-100 text-amber-900',
  osservazione: 'bg-sky-100 text-sky-800', neutro: 'bg-muted text-muted-foreground',
};

// IL SURPLUS DI UN CANALE CONTRO LA PREFATTURA (il Fuel Surcharge, 13/10/2026).
// Come lo portera' la prefattura di Ecotyre non si sa ancora (la prima e' quella
// di ottobre): nel prezzo di ogni ordine, una riga per ordine, una riga sola, o
// niente. Il confronto (confrontaPrefattura) le riconosce tutte e qui si dice in
// tre numeri, gestionale, prefattura e scarto, con l'esito in un cartellino e la
// frase del calcolo; sotto, gli ordini su cui non torna. Le tonnellate e gli
// importi della tabella dei canali restano quelli dei formulari: il surplus non
// si somma agli ordini.
export function RiquadroSurplus({ canale, s }) {
  if (!s) return null;
  const esito = ESITI_SURPLUS[s.esito] || { testo: s.esito, tono: 'neutro' };
  const righe = s.gestionale?.righe || [];
  // senza righe nel gestionale (un surplus che c'e' solo nella prefattura) il nome non c'e'
  const nomi = [...new Set(righe.map(r => r.nome).filter(Boolean))].join(' e ') || 'non nel gestionale';
  const forme = (s.prefattura?.forme || []).map(f => FORME_SURPLUS[f] || f).join(', ');
  const daChiarire = ordiniSurplusDaChiarire(s.ordini);
  const gia = s.ordini?.gia_fra_le_differenze || [];
  const fuori = s.esito === 'fuori_prefattura';
  return (
    <div className={`rounded-lg p-3 ${STILE_SURPLUS.riquadro} ${STILE_SURPLUS.barretta}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold flex flex-wrap items-center gap-2">{NOMI[canale] || canale} <NomeSurplus nome={nomi} /></p>
        <span className={`text-xs px-2 py-0.5 rounded ${TONI[esito.tono] || TONI.neutro}`}>{esito.testo}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2 text-sm">
        <div className="rounded bg-background/70 px-2.5 py-1.5">
          <span className="block text-xs text-muted-foreground">Gestionale</span>
          {righe.length
            ? <><span className="font-semibold tabular-nums">€ {euro(s.gestionale.euro)}</span><span className="block text-xs text-muted-foreground tabular-nums">{righe.map(r => baseSurplus(r.kg, r.euro_t)).join(' + ')}</span></>
            : <span className="text-muted-foreground">nessun surplus nel mese</span>}
        </div>
        <div className="rounded bg-background/70 px-2.5 py-1.5">
          <span className="block text-xs text-muted-foreground">Prefattura</span>
          {fuori
            ? <span className="text-muted-foreground">non passa dalla prefattura</span>
            : s.esito === 'ipotesi' && s.ipotesi
              // lo stesso €/t in piu' su tanti ordini, che il gestionale non ha come surplus
              ? <><span className="font-semibold tabular-nums">€ {euro(s.ipotesi.euro)}</span><span className="block text-xs text-muted-foreground">{testoEuroT(s.ipotesi.euro_t)} in più su {s.ipotesi.ordini} ordini</span></>
              : <><span className="font-semibold tabular-nums">{s.prefattura?.euro === null || s.prefattura?.euro === undefined ? '—' : `€ ${euro(s.prefattura.euro)}`}</span><span className="block text-xs text-muted-foreground">{forme || 'non lo porta'}</span></>}
        </div>
        <div className="rounded bg-background/70 px-2.5 py-1.5">
          <span className="block text-xs text-muted-foreground">Scarto</span>
          <span className="font-semibold tabular-nums">{euroConSegno(s.scarto)}</span>
          {s.esito === 'arrotondamento' && <span className="block text-xs text-muted-foreground">arrotondamento ordine per ordine</span>}
        </div>
      </div>
      {s.testo && <p className="text-xs mt-2">{s.testo}</p>}
      {daChiarire.length > 0 && (
        <div className="mt-2 overflow-x-auto max-h-56 overflow-y-auto bg-background/80 rounded border">
          <table className="w-full text-xs">
            <thead className="bg-muted sticky top-0"><tr>
              <th className="px-2 py-1.5 font-semibold text-left">ID ordine</th>
              <th className="px-2 py-1.5 font-semibold text-right">kg</th>
              <th className="px-2 py-1.5 font-semibold text-right">Surplus atteso €</th>
              <th className="px-2 py-1.5 font-semibold text-right">In prefattura €</th>
              <th className="px-2 py-1.5 font-semibold text-left">Che cosa</th>
            </tr></thead>
            <tbody>
              {daChiarire.map((o, i) => (
                <tr key={`${o.id_ordine}|${i}`} className="border-t">
                  <td className="px-2 py-1 font-mono">{o.id_ordine || '—'}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{kg(o.kg)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{euro(o.atteso)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{euro(o.trovato)}</td>
                  <td className="px-2 py-1">{o.cosa}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {gia.length > 0 && (
        <p className="text-xs text-muted-foreground mt-2">{gia.length === 1 ? `L'ordine ${gia[0]} è già fra le differenze qui sopra` : `${gia.length} ordini sono già fra le differenze qui sopra`}: il loro surplus si chiarisce con quelle.</p>
      )}
    </div>
  );
}
// il giorno e' quello italiano: un caricamento fatto dopo mezzanotte non deve risultare del giorno prima
const giorno = (v) => (v ? (giornoRoma(v) || String(v).slice(0, 10)).split('-').reverse().join('/') : '—');
const messaggio = (e) => e?.response?.data?.error || e?.data?.error || e.message || String(e);

function Tabella({ titolo, spiega, colonne, righe, tono = 'amber' }) {
  if (!righe || righe.length === 0) return null;
  // 'sky': un'osservazione, non un errore - si vede ma non e' un allarme.
  const c = tono === 'red' ? 'border-red-200 bg-red-50/60' : tono === 'grigio' ? 'border-border bg-muted/30' : tono === 'sky' ? 'border-sky-200 bg-sky-50/60' : 'border-amber-200 bg-amber-50/60';
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

          {/* Le date obbligatorie dei formulari del mese (immissione, inizio e fine
              trasporto, regola dell'utente del 22/09/2026): una riga per canale e
              per tipo, mai sommate. Le calcola la fatturazione attiva. */}
          {(data.anomalie_date || []).length > 0 && (
            <div className="border border-amber-300 bg-amber-50 text-amber-900 rounded-lg p-3 text-sm space-y-1">
              {data.anomalie_date.map((a, i) => (
                <p key={`${a.tipologia}|${a.tipo}|${i}`} className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span><strong>{NOMI[a.tipologia] || a.tipologia}:</strong> {a.descrizione}</span>
                </p>
              ))}
            </div>
          )}

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
          {/* Il surplus (il Fuel Surcharge, 13/10/2026): gli importi della tabella sono
              quelli dei formulari, il surplus ha il suo riquadro in fondo a ogni canale.
              Qui l'esito in una riga, per vederlo subito. */}
          {c.canali.some(x => x.surplus) && (
            <p className="text-xs -mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-muted-foreground">Gli importi qui sopra sono quelli dei formulari; il surplus si confronta a parte, in fondo a ogni canale:</span>
              {c.canali.filter(x => x.surplus).map(x => {
                const e = ESITI_SURPLUS[x.surplus.esito] || { testo: x.surplus.esito, tono: 'neutro' };
                return <span key={x.canale} className="inline-flex items-center gap-1"><span className="font-medium">{NOMI[x.canale]}</span><span className={`px-1.5 py-0.5 rounded ${TONI[e.tono] || TONI.neutro}`}>{e.testo}</span></span>;
              })}
            </p>
          )}

          {c.terziarie?.ordini > 0 && (
            <Tabella tono="grigio" titolo={`Terziarie in prefattura (sezione a parte): € ${euro(c.terziarie.euro)} su ${kg(c.terziarie.kg)} kg`}
              spiega={`Il portale le paga come trasporto (8 €/t con l'allegato VII, 10 €/t col formulario). Per ora restano fuori dalla fatturazione attiva e dai tre report: non sono una differenza, l'importo è qui per quando servirà.${c.terziarie.non_in_archivio > 0 ? ` ${c.terziarie.non_in_archivio} di questi ordini non sono nell'archivio Terziarie.` : ''}${c.terziarie.date_da_sistemare > 0 ? ` ${c.terziarie.date_da_sistemare === 1 ? "Uno ha" : `${c.terziarie.date_da_sistemare} hanno`} le date obbligatorie del formulario da sistemare (immissione, inizio e fine trasporto).` : ''}`}
              righe={c.terziarie.righe}
              colonne={[{ t: 'ID ordine', v: r => r.id_ordine, m: true }, { t: 'Documento', v: r => r.numero_fir || '—' }, { t: 'kg', v: r => kg(r.kg), d: true }, { t: '€/t', v: r => euro(r.prezzo_t), d: true }, { t: '€', v: r => euro(r.importo), d: true }, { t: 'In archivio', v: r => (r.in_archivio ? 'sì' : 'no') }, { t: 'Date da sistemare', v: r => r.date || '—' }]} />
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
              {/* Una dicitura diversa non e' una differenza di fatturazione: a
                  Ecotyre la rete si fattura con una tariffa unica, e il prezzo
                  non cambia (06/10/2026). Si dice perche' racconta da chi il
                  portale si aspetta il trattamento, e resta un'osservazione. */}
              <Tabella tono="sky" titolo={`${NOMI[x.canale]}: dicitura diversa (non cambia la fatturazione)`} spiega="Il prezzo è lo stesso: alla commessa Ecotyre la rete si fattura con una tariffa unica. La dicitura dice solo da chi il portale si aspetta il trattamento."
                righe={x.servizio_diverso}
                colonne={[{ t: 'ID ordine', v: r => r.id_ordine, m: true }, { t: 'Formulario', v: r => r.numero_fir || '—' }, { t: 'Prefattura', v: r => SERVIZI[r.servizio_prefattura] || r.servizio_prefattura }, { t: 'Gestionale', v: r => SERVIZI[r.servizio_gestionale] || r.servizio_gestionale }, { t: 'kg', v: r => kg(r.kg), d: true }]} />
              <Tabella titolo={`${NOMI[x.canale]}: numero di formulario diverso`}
                righe={x.fir_diverso}
                colonne={[{ t: 'ID ordine', v: r => r.id_ordine, m: true }, { t: 'FIR prefattura', v: r => r.fir_prefattura }, { t: 'FIR gestionale', v: r => r.fir_gestionale }, { t: 'kg', v: r => kg(r.kg), d: true }]} />
              <Tabella titolo={`${NOMI[x.canale]}: stesso peso, importo diverso`} spiega="Il prezzo per tonnellata della prefattura è ricavato dall'importo: dice subito se è una tariffa diversa."
                righe={x.importo_diverso}
                colonne={[{ t: 'ID ordine', v: r => r.id_ordine, m: true }, { t: 'Formulario', v: r => r.numero_fir || '—' }, { t: 'kg', v: r => kg(r.kg), d: true }, { t: '€ prefattura', v: r => euro(r.importo_prefattura), d: true }, { t: '€ gestionale', v: r => euro(r.importo_gestionale), d: true }, { t: '€/t prefattura', v: r => euro(r.prezzo_prefattura_t), d: true }, { t: '€/t gestionale', v: r => euro(r.prezzo_gestionale_t), d: true }]} />
              <RiquadroSurplus canale={x.canale} s={x.surplus} />
            </React.Fragment>
          ))}

          {/* Una riga di surplus della prefattura che non si sa di quale canale sia,
              o su un ordine che il mese non ha: conta fra le differenze. */}
          <Tabella tono="red" titolo="Righe di surplus della prefattura senza un canale" spiega="Il gestionale non sa a quale canale darle: la ragione è scritta accanto. Un canale non prende mai il surplus di un altro."
            righe={c.surplus_da_attribuire || []}
            colonne={[{ t: 'ID ordine', v: r => r.id_ordine || '—', m: true }, { t: 'Riga della prefattura', v: r => r.testo || '—' }, { t: '€', v: r => euro(r.importo), d: true }, { t: 'Perché', v: r => r.spiegazione }]} />
        </>
      )}
    </div>
  );
}
