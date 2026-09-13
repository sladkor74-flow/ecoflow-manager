import React, { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  ChevronLeft, ChevronRight, Upload, Loader2, Download, Eye, Trash2, AlertTriangle, CheckCircle2, Clock, Info,
} from 'lucide-react';
import DettaglioVerifica from '@/components/verifiche/DettaglioVerifica';
import {
  GIORNI_CONSERVAZIONE, oggiRoma, aggiungiGiorni, settimanaIso, intervalloSettimana, settimaneNellAnno, descriviIntervallo,
  dataIt, tonnellate, tipoDiFile, leggiTabelleDaFile, fileInBase64, segnalazioni, analisiInCorso, analisiInterrotta, scaricaExcelVerifica,
} from '@/lib/verifiche';

// Sezione 1 del modulo Verifiche: confronto fra i report settimanali degli
// ingressi inviati da impianti e stoccaggi e i movimenti del gestionale.

const RUOLI = { trattamento: 'Impianto', stoccaggio: 'Stoccaggio' };
const LIMITE_EXCEL = 15 * 1024 * 1024;
const LIMITE_PDF = 5 * 1024 * 1024;

function Esito({ riga }) {
  const v = riga.verifica;
  if (!v) {
    return riga.viaggi > 0
      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs text-muted-foreground"><Clock className="w-3 h-3" />Da caricare</span>
      : <span className="text-xs text-muted-foreground">Nessun ingresso</span>;
  }
  if (analisiInCorso(v)) {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-violet-200 bg-violet-50 text-violet-800 text-xs"><Loader2 className="w-3 h-3 animate-spin" />{v.stato === 'in_lettura' ? 'Lettura' : 'Verifica'} in corso</span>;
  }
  if (analisiInterrotta(v) || v.stato === 'errore') {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-red-200 bg-red-50 text-red-800 text-xs"><AlertTriangle className="w-3 h-3" />{v.stato === 'errore' ? 'Errore' : 'Interrotta'}</span>;
  }
  const n = segnalazioni(v);
  if (n === 0) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs"><CheckCircle2 className="w-3 h-3" />Conforme</span>;
  const gravi = (v.non_trovate || 0) + (v.assenti_nel_report || 0) + (v.duplicate || 0) > 0;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${gravi ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
      <AlertTriangle className="w-3 h-3" />{n} {n === 1 ? 'segnalazione' : 'segnalazioni'}
    </span>
  );
}

function RigaSoggetto({ riga, isAdmin, occupato, onCarica, onApri, onElimina, onScarica }) {
  const input = useRef(null);
  const v = riga.verifica;
  return (
    <tr className="border-t hover:bg-muted/30">
      <td className="px-4 py-3">
        <div className="font-medium">{riga.nome}</div>
        <div className="flex gap-1 mt-1">
          {riga.ruoli.map(r => <span key={r} className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[11px]">{RUOLI[r] || r}</span>)}
        </div>
        {v && v.stato === 'errore' && <div className="text-xs text-red-700 mt-1 max-w-md">{v.errore}</div>}
      </td>
      <td className="px-4 py-3 tabular-nums whitespace-nowrap">
        {riga.viaggi > 0 ? <>{riga.viaggi} <span className="text-muted-foreground">·</span> {tonnellate(riga.kg)} t</> : <span className="text-muted-foreground">—</span>}
      </td>
      <td className="px-4 py-3 max-w-[220px]">
        {v ? (
          <>
            <div className="text-sm truncate" title={v.file_nome}>{v.file_nome}</div>
            <div className="text-xs text-muted-foreground">
              {v.stato === 'completata' ? `${v.righe_report} righe · ${tonnellate(v.peso_report_kg)} t` : ''}
            </div>
          </>
        ) : <span className="text-muted-foreground text-sm">—</span>}
      </td>
      <td className="px-4 py-3"><Esito riga={riga} /></td>
      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{v && v.scade_il ? dataIt(v.scade_il) : ''}</td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          {isAdmin && (
            <>
              <input ref={input} type="file" className="hidden" accept=".xlsx,.xls,.xlsm,.ods,.csv,.pdf,.png,.jpg,.jpeg,.webp"
                onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) onCarica(riga, f); }} />
              <Button size="sm" variant={v ? 'ghost' : 'outline'} className="h-8" disabled={occupato || analisiInCorso(v)} onClick={() => input.current && input.current.click()}>
                {occupato ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
                {v ? 'Sostituisci' : 'Carica report'}
              </Button>
            </>
          )}
          {v && (
            <>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Dettaglio" onClick={() => onApri(v.id)}><Eye className="w-4 h-4" /></Button>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Scarica Excel" disabled={v.stato !== 'completata'} onClick={() => onScarica(v.id)}><Download className="w-4 h-4" /></Button>
              {isAdmin && <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-600 hover:text-red-700" title="Elimina" onClick={() => onElimina(riga)}><Trash2 className="w-4 h-4" /></Button>}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function ReportSettimanali({ isAdmin }) {
  const { toast } = useToast();
  const precedente = settimanaIso(aggiungiGiorni(oggiRoma(), -7));
  const [anno, setAnno] = useState(precedente.anno);
  const [settimana, setSettimana] = useState(precedente.settimana);
  const [dati, setDati] = useState(null);
  const [caricando, setCaricando] = useState(true);
  const [errore, setErrore] = useState(null);
  const [occupato, setOccupato] = useState(null);
  const [aperta, setAperta] = useState(null);
  const intervallo = intervalloSettimana(anno, settimana);

  const carica = useCallback(async (silenzioso = false) => {
    if (!silenzioso) setCaricando(true);
    setErrore(null);
    try {
      const res = await base44.functions.invoke('verificheReport', { anno, settimana });
      setDati(res.data || res);
    } catch (e) {
      const msg = e && e.response && e.response.data && e.response.data.error;
      setErrore(msg || e.message || 'Errore nel caricamento');
    }
    if (!silenzioso) setCaricando(false);
  }, [anno, settimana]);

  useEffect(() => { setDati(null); carica(); }, [carica]);

  // Finche' c'e' una lettura o una verifica in corso la tabella si aggiorna da sola.
  const inCorso = !!dati && dati.soggetti.some(r => analisiInCorso(r.verifica));
  useEffect(() => {
    if (!inCorso) return undefined;
    const t = setTimeout(() => carica(true), 8000);
    return () => clearTimeout(t);
  }, [inCorso, dati, carica]);

  const sposta = (passo) => {
    let a = anno, s = settimana + passo;
    if (s < 1) { a -= 1; s = settimaneNellAnno(a); }
    if (s > settimaneNellAnno(a)) { a += 1; s = 1; }
    setAnno(a);
    setSettimana(s);
  };

  const carica_report = async (riga, file) => {
    const tipo = tipoDiFile(file);
    if (!tipo) { toast({ title: 'Formato non supportato', description: 'Carica un file Excel, CSV, PDF o un\'immagine.', variant: 'destructive' }); return; }
    if ((tipo === 'excel' || tipo === 'csv') && file.size > LIMITE_EXCEL) { toast({ title: 'File troppo grande', variant: 'destructive' }); return; }
    if ((tipo === 'pdf' || tipo === 'immagine') && file.size > LIMITE_PDF) {
      toast({ title: 'File troppo grande', description: 'Per i PDF e le immagini il limite è 5 MB: se possibile carica la versione Excel.', variant: 'destructive' });
      return;
    }
    const precedenteVerifica = riga.verifica;
    if (precedenteVerifica && !window.confirm(`Sostituire la verifica già presente per ${riga.nome} nella settimana ${settimana}?`)) return;

    setOccupato(riga.chiave);
    try {
      // Il file si apre qui, prima di creare la verifica: se non e' leggibile non
      // resta traccia di un tentativo fallito.
      const payload = {};
      if (tipo === 'excel' || tipo === 'csv') {
        payload.tabelle = await leggiTabelleDaFile(file);
        if (payload.tabelle.length === 0) throw new Error('Il file è vuoto.');
      } else {
        payload.file = { nome: file.name, mime: file.type || (tipo === 'pdf' ? 'application/pdf' : 'image/png'), base64: await fileInBase64(file) };
      }

      const nuova = await base44.entities.VerificaReport.create({
        soggetto_chiave: riga.chiave,
        soggetto_nome: riga.nome,
        anno,
        settimana,
        data_inizio: intervallo.inizio,
        data_fine: intervallo.fine,
        file_nome: file.name,
        file_tipo: tipo,
        stato: 'in_lettura',
        avviata_il: new Date().toISOString(),
        scade_il: aggiungiGiorni(oggiRoma(), GIORNI_CONSERVAZIONE),
      });
      if (precedenteVerifica) await base44.entities.VerificaReport.delete(precedenteVerifica.id);
      setOccupato(null);
      await carica(true);

      base44.functions.invoke('elaboraReportSettimanale', { verifica_id: nuova.id, ...payload })
        .catch((e) => {
          const msg = e && e.response && e.response.data && e.response.data.error;
          if (msg) toast({ title: `Report di ${riga.nome} non verificato`, description: msg, variant: 'destructive' });
        })
        .finally(() => carica(true));
    } catch (e) {
      setOccupato(null);
      toast({ title: 'Caricamento non riuscito', description: e.message || String(e), variant: 'destructive' });
    }
  };

  const elimina = async (riga) => {
    if (!window.confirm(`Eliminare la verifica del report di ${riga.nome} per la settimana ${settimana}? L'operazione non si può annullare.`)) return;
    try {
      await base44.entities.VerificaReport.delete(riga.verifica.id);
      await carica(true);
    } catch (e) {
      toast({ title: 'Eliminazione non riuscita', description: e.message || String(e), variant: 'destructive' });
    }
  };

  const scarica = async (id) => {
    try {
      const v = await base44.entities.VerificaReport.get(id);
      await scaricaExcelVerifica(v);
    } catch (e) {
      toast({ title: 'Esportazione non riuscita', description: e.message || String(e), variant: 'destructive' });
    }
  };

  const soggetti = dati ? dati.soggetti : [];
  const conIngressi = soggetti.filter(r => r.viaggi > 0 || r.verifica);
  const senzaIngressi = soggetti.filter(r => r.viaggi === 0 && !r.verifica);
  const caricati = soggetti.filter(r => r.verifica && r.verifica.stato === 'completata');
  const daCaricare = soggetti.filter(r => r.viaggi > 0 && !r.verifica).length;
  const conSegnalazioni = caricati.filter(r => segnalazioni(r.verifica) > 0).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => sposta(-1)} title="Settimana precedente"><ChevronLeft className="w-4 h-4" /></Button>
          <div className="px-3 text-center min-w-[210px]">
            <div className="font-heading font-semibold text-lg leading-tight">Settimana {settimana}</div>
            <div className="text-xs text-muted-foreground">{descriviIntervallo(intervallo)}</div>
          </div>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => sposta(1)} title="Settimana successiva"><ChevronRight className="w-4 h-4" /></Button>
          <select value={anno} onChange={(e) => { const a = Number(e.target.value); setAnno(a); setSettimana(Math.min(settimana, settimaneNellAnno(a))); }}
            className="ml-2 px-2 py-1.5 rounded-md border bg-card text-sm">
            {[precedente.anno + 1, precedente.anno, precedente.anno - 1].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        {dati && (
          <div className="flex gap-4 text-sm">
            <span><strong className="tabular-nums">{daCaricare}</strong> <span className="text-muted-foreground">da caricare</span></span>
            <span><strong className="tabular-nums">{caricati.length}</strong> <span className="text-muted-foreground">verificati</span></span>
            <span><strong className={`tabular-nums ${conSegnalazioni ? 'text-red-600' : ''}`}>{conSegnalazioni}</strong> <span className="text-muted-foreground">con segnalazioni</span></span>
          </div>
        )}
      </div>

      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          Carica il report degli ingressi inviato da ciascun impianto o stoccaggio: Excel, CSV, PDF o immagine. Il file non viene conservato:
          restano solo i dati letti e l'esito, che si cancellano da soli {GIORNI_CONSERVAZIONE} giorni dopo il caricamento.
        </span>
      </div>

      {errore && (
        <div className="flex items-start gap-2 border border-red-300 bg-red-50 text-red-800 rounded-lg px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{errore}</span>
        </div>
      )}

      {caricando && !dati ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" />Leggo gli ingressi della settimana…</div>
      ) : dati && (
        <div className="border rounded-lg overflow-x-auto bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Impianto o stoccaggio</th>
                <th className="px-4 py-2.5 font-semibold">Ingressi nel gestionale</th>
                <th className="px-4 py-2.5 font-semibold">Report</th>
                <th className="px-4 py-2.5 font-semibold">Esito</th>
                <th className="px-4 py-2.5 font-semibold">Si cancella il</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {conIngressi.map(r => (
                <RigaSoggetto key={r.chiave} riga={r} isAdmin={isAdmin} occupato={occupato === r.chiave}
                  onCarica={carica_report} onApri={setAperta} onElimina={elimina} onScarica={scarica} />
              ))}
              {senzaIngressi.length > 0 && (
                <tr className="border-t bg-muted/20">
                  <td colSpan={6} className="px-4 py-2 text-xs text-muted-foreground uppercase tracking-wide">Senza ingressi in questa settimana</td>
                </tr>
              )}
              {senzaIngressi.map(r => (
                <RigaSoggetto key={r.chiave} riga={r} isAdmin={isAdmin} occupato={occupato === r.chiave}
                  onCarica={carica_report} onApri={setAperta} onElimina={elimina} onScarica={scarica} />
              ))}
              {soggetti.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nessun impianto o stoccaggio attivo nel {anno}.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <DettaglioVerifica verificaId={aperta} isAdmin={isAdmin} open={!!aperta} onClose={() => setAperta(null)} onModificata={() => carica(true)} />
    </div>
  );
}
