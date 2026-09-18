import React, { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  ChevronLeft, ChevronRight, Upload, Loader2, FileText, AlertTriangle, CheckCircle2, Info, Trash2, RefreshCw, Eye, EyeOff,
} from 'lucide-react';
import { formatKg } from '@/lib/utils';
import { conCampiCompleti, eliminaParti } from '@/lib/testoLungo';
import {
  oggiRoma, aggiungiGiorni, settimanaIso, intervalloSettimana, settimaneNellAnno, descriviIntervallo, dataIt, fileInBase64,
} from '@/lib/verifiche';
import { NOME_VERDETTO, COLORE_VERDETTO, misura, tonnellate, FORMATI, tipoDiFile, leggiPivotDaExcel } from '@/lib/quadraturaFir';
import { esportaQuadraturaFirPdf } from '@/lib/quadraturaFirPdf';

// Sezione del modulo Verifiche: la quadratura settimanale dei formulari.
//
// Ogni settimana si carica la stampa con il conteggio e la somma dei FIR di
// WINSINFO e del portale Ecotyre, e il gestionale fa da terza fonte. Il file non
// viene conservato: restano i numeri letti e l'esito del confronto.
//
// I canali non si mischiano: rete, ACI ed extra raccolta hanno ognuno la propria
// tabella e il proprio totale.

const LIMITE = 5 * 1024 * 1024;

function Pastiglia({ verdetto }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs whitespace-nowrap ${COLORE_VERDETTO[verdetto] || ''}`}>
      {verdetto === 'congruente' ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
      {NOME_VERDETTO[verdetto] || verdetto}
    </span>
  );
}

function Quadra({ ok, testo }) {
  if (ok === null || ok === undefined) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${ok ? 'text-emerald-700' : 'text-red-700 font-medium'}`}>
      {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}{testo}
    </span>
  );
}

function Totale({ etichetta, valore }) {
  return (
    <div className="px-3 py-1.5 rounded-md border bg-muted/30 min-w-[150px]">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{etichetta}</div>
      {valore
        ? <div className="tabular-nums text-sm"><strong>{valore.n}</strong> FIR · {formatKg(valore.kg)} kg <span className="text-muted-foreground">({tonnellate(valore.kg)} t)</span></div>
        : <div className="text-sm text-muted-foreground">non presente</div>}
    </div>
  );
}

function Flusso({ flusso, tutte }) {
  const celle = tutte ? flusso.celle : flusso.celle.filter(c => c.verdetto !== 'congruente' || c.osservazione);
  const nascoste = flusso.celle.length - celle.length;
  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/20 space-y-2">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h3 className="font-heading font-semibold">{flusso.titolo}</h3>
          <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">{flusso.canale}</span>
          <div className="flex gap-3 ml-auto">
            <Quadra ok={flusso.quadra.winsinfo_ecotyre} testo="WINSINFO = portale" />
            <Quadra ok={flusso.quadra.ecotyre_gestionale} testo="portale = gestionale" />
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Totale etichetta="WINSINFO" valore={flusso.totali.winsinfo} />
          <Totale etichetta="Portale Ecotyre" valore={flusso.totali.ecotyre} />
          <Totale etichetta="Gestionale" valore={flusso.totali.gestionale} />
        </div>
        {flusso.note.map((n, i) => (
          <div key={i} className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" /><span>{n}</span>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2 font-semibold">Impianto</th>
              <th className="px-3 py-2 font-semibold">Trasportatore</th>
              <th className="px-3 py-2 font-semibold whitespace-nowrap">WINSINFO</th>
              <th className="px-3 py-2 font-semibold whitespace-nowrap">Portale</th>
              <th className="px-3 py-2 font-semibold whitespace-nowrap">Gestionale</th>
              <th className="px-3 py-2 font-semibold">Esito</th>
            </tr>
          </thead>
          <tbody>
            {celle.map((c) => (
              <React.Fragment key={c.chiave}>
                <tr className="border-t">
                  <td className="px-3 py-2">{c.impianto || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-2">{c.trasportatore || <span className="text-muted-foreground">—</span>}</td>
                  {['winsinfo', 'ecotyre', 'gestionale'].map(f => (
                    <td key={f} className="px-3 py-2 tabular-nums whitespace-nowrap">
                      {misura(c[f]) || <span className="text-muted-foreground">—</span>}
                    </td>
                  ))}
                  <td className="px-3 py-2"><Pastiglia verdetto={c.verdetto} /></td>
                </tr>
                {(c.motivi && c.motivi.length > 0) || c.osservazione ? (
                  <tr className="border-t border-dashed bg-muted/10">
                    <td colSpan={6} className="px-3 py-2">
                      <ul className="space-y-1 text-xs text-muted-foreground list-disc pl-4">
                        {c.osservazione && <li className="text-amber-800">{c.osservazione}</li>}
                        {(c.motivi || []).map((m, i) => <li key={i}>{m}</li>)}
                      </ul>
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            ))}
            {celle.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground text-sm">
                {flusso.celle.length === 1 ? 'L\'unica riga di questo flusso quadra.' : `Tutte le ${flusso.celle.length} righe di questo flusso quadrano.`}
              </td></tr>
            )}
            {nascoste > 0 && celle.length > 0 && (
              <tr className="border-t bg-muted/20">
                <td colSpan={6} className="px-3 py-2 text-xs text-muted-foreground">
                  Altre {nascoste} righe quadrano e non sono elencate.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function QuadraturaFir({ isAdmin }) {
  const { toast } = useToast();
  const precedente = settimanaIso(aggiungiGiorni(oggiRoma(), -7));
  const [anno, setAnno] = useState(precedente.anno);
  const [settimana, setSettimana] = useState(precedente.settimana);
  const [dati, setDati] = useState(null);
  const [caricando, setCaricando] = useState(true);
  const [occupato, setOccupato] = useState(false);
  const [errore, setErrore] = useState(null);
  const [tutte, setTutte] = useState(false);
  const input = useRef(null);
  const intervallo = intervalloSettimana(anno, settimana);

  const carica = useCallback(async (silenzioso = false) => {
    if (!silenzioso) setCaricando(true);
    setErrore(null);
    try {
      const res = await base44.functions.invoke('quadraturaFir', { anno, settimana });
      setDati(res.data || res);
    } catch (e) {
      const msg = (e && e.data && e.data.error) || (e && e.response && e.response.data && e.response.data.error);
      setErrore(msg || e.message || 'Errore nel caricamento');
    }
    if (!silenzioso) setCaricando(false);
  }, [anno, settimana]);

  useEffect(() => { setDati(null); carica(); }, [carica]);

  const sposta = (passo) => {
    let a = anno, s = settimana + passo;
    if (s < 1) { a -= 1; s = settimaneNellAnno(a); }
    if (s > settimaneNellAnno(a)) { a += 1; s = 1; }
    setAnno(a);
    setSettimana(s);
  };

  // La quadratura della settimana e' una sola: se c'e' gia' si riusa, cosi' non
  // restano due esiti per la stessa settimana.
  const elabora = async (payload, campi) => {
    const precedente = dati && dati.quadratura;
    let id;
    if (precedente) {
      await base44.entities.QuadraturaFir.update(precedente.id, { ...campi, stato: 'in_lettura', errore: '', avviata_il: new Date().toISOString() });
      id = precedente.id;
    } else {
      const nuova = await base44.entities.QuadraturaFir.create({
        anno, settimana, data_inizio: intervallo.inizio, data_fine: intervallo.fine,
        avviata_il: new Date().toISOString(), stato: 'in_lettura', ...campi,
      });
      id = nuova.id;
    }
    await base44.functions.invoke('elaboraQuadraturaFir', { quadratura_id: id, ...payload });
  };

  const caricaStampa = async (file) => {
    const tipo = tipoDiFile(file);
    if (!tipo) { toast({ title: 'Formato non supportato', description: 'Carica il PDF della stampa, una foto o il file Excel delle pivot.', variant: 'destructive' }); return; }
    if (tipo !== 'excel' && file.size > LIMITE) {
      toast({ title: 'File troppo grande', description: 'Per PDF e immagini il limite è 5 MB.', variant: 'destructive' });
      return;
    }
    if (dati && dati.quadratura && !window.confirm(`Sostituire la quadratura già presente per la settimana ${settimana}?`)) return;

    setOccupato(true);
    setErrore(null);
    try {
      const payload = tipo === 'excel'
        ? { tabelle: await leggiPivotDaExcel(file) }
        : { file: { nome: file.name, mime: file.type || (tipo === 'pdf' ? 'application/pdf' : 'image/png'), base64: await fileInBase64(file) } };
      await elabora(payload, { file_nome: file.name, file_tipo: tipo });
      await carica(true);
    } catch (e) {
      const msg = (e && e.data && e.data.error) || (e && e.response && e.response.data && e.response.data.error) || e.message || String(e);
      setErrore(msg);
      await carica(true);
    }
    setOccupato(false);
  };

  const ripeti = async () => {
    setOccupato(true);
    setErrore(null);
    try {
      await base44.functions.invoke('elaboraQuadraturaFir', { quadratura_id: dati.quadratura.id, solo_confronto: true });
      await carica(true);
    } catch (e) {
      const msg = (e && e.data && e.data.error) || e.message || String(e);
      setErrore(msg);
    }
    setOccupato(false);
  };

  const elimina = async () => {
    if (!window.confirm(`Eliminare la quadratura della settimana ${settimana}? L'operazione non si può annullare.`)) return;
    setOccupato(true);
    try {
      await eliminaParti('QuadraturaFir', dati.quadratura.id);
      await base44.entities.QuadraturaFir.delete(dati.quadratura.id);
      await carica(true);
    } catch (e) {
      toast({ title: 'Eliminazione non riuscita', description: e.message || String(e), variant: 'destructive' });
    }
    setOccupato(false);
  };

  const scarica = async () => {
    try {
      const q = await conCampiCompleti('QuadraturaFir', await base44.entities.QuadraturaFir.get(dati.quadratura.id), ['esito_json', 'lettura_json']);
      await esportaQuadraturaFirPdf(q, JSON.parse(q.esito_json || '{}'), q.lettura_json ? JSON.parse(q.lettura_json) : null);
    } catch (e) {
      toast({ title: 'Esportazione non riuscita', description: e.message || String(e), variant: 'destructive' });
    }
  };

  const q = dati && dati.quadratura;
  const esito = dati && dati.esito;
  const gestionale = (dati && dati.gestionale) || {};
  const flussiGestionale = Object.entries(gestionale).filter(([, v]) => v.totale && v.totale.n > 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => sposta(-1)} title="Settimana precedente"><ChevronLeft className="w-4 h-4" /></Button>
          <div className="px-2 text-center min-w-[200px]">
            <div className="font-heading font-semibold text-lg leading-tight flex items-center justify-center gap-1">
              Settimana
              <input type="number" min={1} max={settimaneNellAnno(anno)} value={settimana}
                onChange={(e) => { const n = Number(e.target.value); if (n >= 1 && n <= settimaneNellAnno(anno)) setSettimana(n); }}
                className="w-16 px-1 py-0 border rounded bg-card text-lg font-heading font-semibold text-center"
                title="Il numero di settimana: di norma quella precedente a quella in corso" />
            </div>
            <div className="text-xs text-muted-foreground">{descriviIntervallo(intervallo)}</div>
          </div>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => sposta(1)} title="Settimana successiva"><ChevronRight className="w-4 h-4" /></Button>
          <select value={anno} onChange={(e) => { const a = Number(e.target.value); setAnno(a); setSettimana(Math.min(settimana, settimaneNellAnno(a))); }}
            className="ml-2 px-2 py-1.5 rounded-md border bg-card text-sm">
            {[precedente.anno + 1, precedente.anno, precedente.anno - 1].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <input ref={input} type="file" className="hidden" accept={FORMATI}
                onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) caricaStampa(f); }} />
              <Button variant={q ? 'outline' : 'default'} disabled={occupato} onClick={() => input.current && input.current.click()}>
                {occupato ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                {q ? 'Sostituisci la stampa' : 'Carica la stampa'}
              </Button>
            </>
          )}
          {q && q.stato === 'completata' && (
            <>
              <Button variant="outline" onClick={scarica}><FileText className="w-4 h-4 mr-2" />Report PDF</Button>
              {isAdmin && <Button variant="ghost" size="icon" title="Ripeti il confronto con i dati del gestionale di ora" disabled={occupato} onClick={ripeti}><RefreshCw className="w-4 h-4" /></Button>}
            </>
          )}
          {q && isAdmin && <Button variant="ghost" size="icon" className="text-red-600" title="Elimina la quadratura" disabled={occupato} onClick={elimina}><Trash2 className="w-4 h-4" /></Button>}
        </div>
      </div>

      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          Carica la stampa settimanale del conteggio e della somma dei FIR: le due pivot di WINSINFO e del portale Ecotyre si confrontano fra loro
          e con il gestionale, che conta i formulari terminati con la fine trasporto dentro la settimana. Va bene il PDF, una foto o il file Excel
          da cui hai stampato. Il numero di settimana si legge dal titolo della stampa; se non c&apos;è, vale quello scelto qui sopra.
          Rete, ACI ed extra raccolta restano separati e non si sommano mai fra loro. Il file non viene conservato: restano soltanto i numeri letti e l&apos;esito.
        </span>
      </div>

      {errore && (
        <div className="flex items-start gap-2 border border-red-300 bg-red-50 text-red-800 rounded-lg px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{errore}</span>
        </div>
      )}

      {caricando && !dati ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" />Leggo i movimenti della settimana…</div>
      ) : (
        <>
          {q && q.stato === 'errore' && (
            <div className="flex items-start gap-2 border border-red-300 bg-red-50 text-red-800 rounded-lg px-4 py-3 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span><strong>La lettura del file non è riuscita.</strong> {q.errore}</span>
            </div>
          )}

          {q && q.stato === 'completata' && (
            <div className={`rounded-lg border px-4 py-3 ${q.conformita === 'piena' ? 'border-emerald-200 bg-emerald-50' : 'border-amber-300 bg-amber-50'}`}>
              <div className="flex items-center gap-2 flex-wrap">
                {q.conformita === 'piena'
                  ? <><CheckCircle2 className="w-5 h-5 text-emerald-700" /><span className="font-semibold text-emerald-900">Le tre fonti quadrano su tutti i flussi.</span></>
                  : <><AlertTriangle className="w-5 h-5 text-amber-700" /><span className="font-semibold text-amber-900">{q.incongruenti} {q.incongruenti === 1 ? 'riga da sistemare' : 'righe da sistemare'} prima di riaggiornare il gestionale.</span></>}
                <span className="text-sm text-muted-foreground ml-auto">
                  {q.congruenti} righe congruenti · {q.righe_lette} righe lette in {q.tabelle} tabelle · {q.file_nome}
                  {q.verificata_il ? ` · confronto del ${dataIt(q.verificata_il)}` : ''}
                </span>
              </div>
              {!q.lettura_verificata && (
                <div className="mt-2 text-sm text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>La somma delle righe lette non torna con i totali stampati sul file: controlla la trascrizione sull&apos;originale prima di fidarti dell&apos;esito.</span>
                </div>
              )}
              {esito && esito.osservazioni && esito.osservazioni.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm list-disc pl-5">
                  {esito.osservazioni.map((o, i) => <li key={i}>{o}</li>)}
                </ul>
              )}
            </div>
          )}

          {esito && esito.flussi && esito.flussi.length > 0 ? (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => setTutte(!tutte)}>
                  {tutte ? <><EyeOff className="w-3.5 h-3.5 mr-1" />Solo le righe da guardare</> : <><Eye className="w-3.5 h-3.5 mr-1" />Mostra tutte le righe</>}
                </Button>
              </div>
              {esito.flussi.map(f => <Flusso key={f.chiave} flusso={f} tutte={tutte} />)}
            </div>
          ) : (
            <div className="border rounded-lg bg-card p-4 space-y-3">
              <div className="text-sm font-medium">Quello che il gestionale ha in questa settimana</div>
              {flussiGestionale.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nessun movimento terminato in questa settimana.</p>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  {flussiGestionale.map(([k, v]) => (
                    <div key={k} className="px-3 py-2 rounded-md border bg-muted/30 min-w-[190px]">
                      <div className="text-xs text-muted-foreground">{v.titolo} <span className="px-1 rounded bg-primary/10 text-primary">{v.canale}</span></div>
                      <div className="tabular-nums text-sm"><strong>{v.totale.n}</strong> FIR · {formatKg(v.totale.kg)} kg</div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Carica la stampa della settimana per confrontarla con WINSINFO e con il portale.
              </p>
            </div>
          )}

          {dati && dati.storico && dati.storico.length > 1 && (
            <div className="text-xs text-muted-foreground">
              Settimane già verificate nel {anno}:{' '}
              {dati.storico.map(s => (
                <button key={s.id} type="button" onClick={() => setSettimana(s.settimana)}
                  className={`mx-0.5 px-1.5 py-0.5 rounded border ${s.conformita === 'piena' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}
                  title={s.conformita === 'piena' ? 'Quadra' : `${s.incongruenti} righe da sistemare`}>
                  {s.settimana}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
