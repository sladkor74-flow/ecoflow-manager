import React, { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  ChevronLeft, ChevronRight, Upload, Loader2, Download, Eye, Trash2, AlertTriangle, CheckCircle2, Clock, Info, FileText, MailX,
} from 'lucide-react';
import DettaglioVerifica from '@/components/verifiche/DettaglioVerifica';
import { conCampiCompleti, eliminaParti } from '@/lib/testoLungo';
import { esportaEsitoVerificaPdf } from '@/lib/esitoVerificaPdf';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

// Caricamenti ravvicinati possono incontrare il limite di richieste della piattaforma: si riprova dopo una pausa.
async function conRitentativi(fn) {
  const attese = [3000, 8000, 15000];
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const messaggio = String((e && e.data && e.data.error) || (e && e.message) || e);
      if (!/rate limit|too many requests|429/i.test(messaggio) || i >= attese.length) throw e;
      await new Promise(r => setTimeout(r, attese[i]));
    }
  }
}
import {
  GIORNI_CONSERVAZIONE, oggiRoma, aggiungiGiorni, settimanaIso, intervalloSettimana, settimaneNellAnno, descriviIntervallo,
  dataIt, tonnellate, tipoDiFile, leggiTabelleDaFile, segnalazioni, analisiInCorso, analisiInterrotta, scaricaExcelVerifica,
} from '@/lib/verifiche';
import { giornoRoma } from '@/lib/giornoItaliano';
// Gli istanti del server possono arrivare senza la Z: letti come ora locale, un
// confronto salvato fra le 22 e mezzanotte UTC risultava del giorno prima.
import { dataServer } from '@/lib/utils';

// Sezione 1 del modulo Verifiche: confronto fra i report settimanali inviati da
// impianti e stoccaggi e il gestionale. Gli ingressi si verificano sulle
// primarie, le uscite sulle secondarie.
//
// Ingressi e uscite si mostrano canale per canale: rete, ACI ed extra raccolta
// non si sommano mai, nemmeno nel numero di formulari di una riga. L'esito di
// ogni verifica e' rifatto dal server sui movimenti di adesso a ogni apertura.

const RUOLI = { trattamento: 'Impianto', stoccaggio: 'Stoccaggio' };
const NOME_CANALE = { rete: 'Rete', aci: 'ACI', extra: 'Extra' };

/** "Rete 20 · 260,00 t" una riga per canale, solo i canali che hanno movimenti. */
function PerCanale({ canali, tipo }) {
  const righe = (canali || []).filter(c => c[tipo] > 0);
  if (!righe.length) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="space-y-0.5">
      {righe.map(c => (
        <div key={c.canale}>
          <span className="inline-block min-w-[38px] text-[11px] text-muted-foreground">{NOME_CANALE[c.canale] || c.canale}</span>
          {c[tipo]} <span className="text-muted-foreground">·</span> {tonnellate(c[`kg_${tipo}`])} t
        </div>
      ))}
    </div>
  );
}

/** "rete 2 ingressi, ACI 1 uscita": i movimenti di un soggetto, un canale alla volta. */
function descriviPerCanale(canali) {
  const parti = [];
  for (const c of canali || []) {
    const nome = c.canale === 'aci' ? 'ACI' : c.canale === 'extra' ? 'extra raccolta' : 'rete';
    const voci = [];
    if (c.ingressi) voci.push(`${c.ingressi} ${c.ingressi === 1 ? 'ingresso' : 'ingressi'}`);
    if (c.uscite) voci.push(`${c.uscite} ${c.uscite === 1 ? 'uscita' : 'uscite'}`);
    if (voci.length) parti.push(`${nome} ${voci.join(' e ')}`);
  }
  return parti.join(', ');
}

/** "Secondarie ACI", "Primarie di extra raccolta": un gruppo di terminati con le date da sistemare, col suo canale. */
function nomeGruppoDate(g) {
  const tipo = /secondaria/i.test(g.fonte) ? 'Secondarie' : 'Primarie';
  if (g.canale === 'extra') return `${tipo} di extra raccolta`;
  return `${tipo} ${g.canale === 'aci' ? 'ACI' : 'di rete'}`;
}

const LIMITE_EXCEL = 15 * 1024 * 1024;
// Excel (.xlsx, .xls, .xlsm), LibreOffice/OpenOffice (.ods), CSV, PDF e immagini:
// estensioni e tipi MIME, cosi' la finestra di scelta non nasconde nessun formato.
const FORMATI_REPORT = [
  '.xlsx', '.xls', '.xlsm', '.ods', '.csv', '.pdf', '.png', '.jpg', '.jpeg', '.webp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.ms-excel.sheet.macroEnabled.12',
  'application/vnd.oasis.opendocument.spreadsheet',
  'text/csv', 'application/pdf', 'image/png', 'image/jpeg', 'image/webp',
].join(',');
const LIMITE_PDF = 5 * 1024 * 1024;

function Esito({ riga }) {
  const v = riga.verifica;
  if (!v) {
    return riga.movimentato
      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs text-muted-foreground"><Clock className="w-3 h-3" />Da caricare</span>
      : <span className="text-xs text-muted-foreground">Nessun movimento</span>;
  }
  if (analisiInCorso(v)) {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-violet-200 bg-violet-50 text-violet-800 text-xs"><Loader2 className="w-3 h-3 animate-spin" />{v.stato === 'in_lettura' ? 'Lettura' : 'Verifica'} in corso</span>;
  }
  // Confronto rinviato da elaboraReportSettimanale perche' un archivio si stava
  // riscrivendo: le righe sono lette, l'esito arriva a caricamento finito.
  if (v.stato === 'errore' && /^Confronto rinviato/.test(v.errore || '')) {
    return <span title={v.errore} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-800 text-xs"><Clock className="w-3 h-3" />Rinviata</span>;
  }
  if (analisiInterrotta(v) || v.stato === 'errore') {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-red-200 bg-red-50 text-red-800 text-xs"><AlertTriangle className="w-3 h-3" />{v.stato === 'errore' ? 'Errore' : 'Interrotta'}</span>;
  }
  const n = segnalazioni(v);
  if (v.file_tipo === 'dichiarazione') {
    // Senza un numero di formulari: sommerebbe i canali. Quali movimenti la
    // smentiscono lo dicono le colonne accanto, canale per canale.
    return v.conformita === 'piena'
      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs"><CheckCircle2 className="w-3 h-3" />Confermata</span>
      : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-red-200 bg-red-50 text-red-800 text-xs font-medium"><AlertTriangle className="w-3 h-3" />Smentita dai formulari registrati</span>;
  }
  // Un verdetto per canale: una riga ACI sbagliata non rende parziale la rete.
  if (Array.isArray(v.per_canale) && v.per_canale.length) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        {v.per_canale.map(c => (
          <span key={c.canale} title={c.conformita === 'piena' ? `${c.nome}: conformità piena` : `${c.nome}: ${c.anomalie} ${c.anomalie === 1 ? 'anomalia' : 'anomalie'}${c.assenti ? `, di cui ${c.assenti} formulari mancanti nel report` : ''}`}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs ${c.conformita === 'piena' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : c.assenti ? 'border-red-200 bg-red-50 text-red-800 font-medium' : 'border-amber-200 bg-amber-50 text-amber-800 font-medium'}`}>
            {c.conformita === 'piena' ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
            {c.nome}{c.conformita === 'piena' ? '' : ` · ${c.anomalie}`}
          </span>
        ))}
        {(v.non_trovate || 0) > 0 && (
          <span title="Formulari del report che il gestionale non conosce: non hanno canale" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-red-200 bg-red-50 text-red-800 text-xs font-medium">
            <AlertTriangle className="w-3 h-3" />{v.non_trovate} non registrati
          </span>
        )}
        {/* Gia' contati fra le anomalie del loro canale: qui si dice perche'. */}
        {(v.date_da_sistemare || 0) > 0 && (
          <span title="Formulari registrati senza una data obbligatoria (immissione, inizio o fine trasporto) o con date incoerenti: la data va inserita o corretta" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-red-200 bg-red-50 text-red-800 text-xs">
            <AlertTriangle className="w-3 h-3" />{v.date_da_sistemare} senza date obbligatorie
          </span>
        )}
      </span>
    );
  }
  if (v.conformita ? v.conformita === 'piena' : n === 0) {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs"><CheckCircle2 className="w-3 h-3" />Conformità piena</span>;
  }
  const gravi = (v.non_trovate || 0) + (v.assenti_nel_report || 0) + (v.duplicate || 0) > 0;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${gravi ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
      <AlertTriangle className="w-3 h-3" />Parziale · {n} {n === 1 ? 'anomalia' : 'anomalie'}
    </span>
  );
}

function RigaSoggetto({ riga, isAdmin, occupato, onCarica, onDichiara, onApri, onElimina, onScarica }) {
  const input = useRef(null);
  const v = riga.verifica;
  return (
    <tr className="border-t hover:bg-muted/30">
      <td className="px-4 py-3">
        <div className="font-medium">{riga.nome}</div>
        <div className="flex gap-1 mt-1">
          {riga.ruoli.map(r => <span key={r} className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[11px]">{RUOLI[r] || r}</span>)}
        </div>
        {v && v.stato === 'errore' && <div className={`text-xs mt-1 max-w-md ${/^Confronto rinviato/.test(v.errore || '') ? 'text-amber-800' : 'text-red-700'}`}>{v.errore}</div>}
      </td>
      <td className="px-4 py-3 tabular-nums whitespace-nowrap">
        <PerCanale canali={riga.canali} tipo="ingressi" />
      </td>
      <td className="px-4 py-3 tabular-nums whitespace-nowrap">
        <PerCanale canali={riga.canali} tipo="uscite" />
      </td>
      <td className="px-4 py-3 max-w-[220px]">
        {v ? (
          <>
            <div className="text-sm truncate" title={v.file_nome}>{v.file_nome}</div>
            <div className="text-xs text-muted-foreground truncate" title={v.nota || ''}>
              {v.file_tipo === 'dichiarazione' ? (v.nota || 'comunicata dall\'impianto')
                : v.stato === 'completata' && v.verificata_il ? `confronto del ${dataIt(giornoRoma(dataServer(v.verificata_il)))}` : ''}
            </div>
            {v.esito_ricalcolato === 'solo_a_video' && (
              <div className="text-[11px] text-amber-700" title="Il dettaglio, il PDF e l'Excel mostrano ancora il confronto salvato: si aggiornano quando un amministratore apre la settimana o dopo il prossimo caricamento.">
                esito rifatto sui movimenti di oggi
              </div>
            )}
          </>
        ) : <span className="text-muted-foreground text-sm">—</span>}
      </td>
      <td className="px-4 py-3"><Esito riga={riga} /></td>
      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{v && v.scade_il ? dataIt(v.scade_il) : ''}</td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          {isAdmin && (
            <>
              <input ref={input} type="file" className="hidden" accept={FORMATI_REPORT}
                onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) onCarica(riga, f); }} />
              <Button size="sm" variant={v ? 'ghost' : 'outline'} className="h-8" disabled={occupato || analisiInCorso(v)} onClick={() => input.current && input.current.click()}>
                {occupato ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
                {v ? 'Sostituisci' : 'Carica report'}
              </Button>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="L'impianto comunica nessuna movimentazione" disabled={occupato || analisiInCorso(v)} onClick={() => onDichiara(riga)}>
                <MailX className="w-4 h-4" />
              </Button>
            </>
          )}
          {v && (
            <>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Dettaglio" onClick={() => onApri(v.id)}><Eye className="w-4 h-4" /></Button>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="PDF per l'impianto" disabled={v.stato !== 'completata'} onClick={() => onScarica(v.id, 'pdf')}><FileText className="w-4 h-4" /></Button>
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

  // Una lettura della settimana costa una quarantina di richieste (movimenti,
  // registro dei caricamenti, testi delle verifiche). Le richieste di rilettura
  // che arrivano mentre una e' in corso - dopo un caricamento, a verifica finita,
  // dal ricontrollo - si fondono: finita quella, se ne fa una sola. Prima un
  // report ne faceva partire tre o quattro, e con due o tre report di fila si
  // superava il limite di richieste al minuto della piattaforma (22/09/2026).
  const inVolo = useRef(null);
  const carica = useCallback(async (silenzioso = false) => {
    const chiave = `${anno}-${settimana}`;
    if (inVolo.current && inVolo.current.chiave === chiave) {
      inVolo.current.ancora = true;
      return inVolo.current.promessa;
    }
    if (!silenzioso) setCaricando(true);
    const volo = { chiave, ancora: false, promessa: null };
    volo.promessa = (async () => {
      do {
        volo.ancora = false;
        setErrore(null);
        try {
          const res = await base44.functions.invoke('verificheReport', { anno, settimana });
          setDati(res.data || res);
        } catch (e) {
          const msg = (e && e.data && e.data.error) || (e && e.response && e.response.data && e.response.data.error);
          setErrore(msg || e.message || 'Errore nel caricamento');
        }
      } while (volo.ancora);
    })();
    inVolo.current = volo;
    try {
      await volo.promessa;
    } finally {
      if (inVolo.current === volo) inVolo.current = null;
      if (!silenzioso) setCaricando(false);
    }
  }, [anno, settimana]);

  useEffect(() => { setDati(null); carica(); }, [carica]);

  // Le verifiche avviate da questa pagina: a confronto finito le rilegge la
  // chiamata stessa (avviaVerifica), il ricontrollo non le rilegge una seconda volta.
  const avviateQui = useRef(new Set());

  // Finche' c'e' una lettura o una verifica in corso la tabella si aggiorna da sola.
  // Ogni 8 secondi si guarda solo lo stato delle verifiche in corso, una richiesta:
  // un passaggio da lettura a verifica si scrive nella riga, e la settimana intera
  // si rilegge solo quando una verifica finisce (completata o in errore).
  // Rileggerla a ogni giro voleva dire rileggere tutti i movimenti e, con qualche
  // report aperto insieme, superare il limite di richieste al minuto della
  // piattaforma: la pagina si fermava su "rate limit exceeded" (22/09/2026).
  const inCorso = !!dati && dati.soggetti.some(r => analisiInCorso(r.verifica));
  const [giro, setGiro] = useState(0);
  useEffect(() => {
    if (!inCorso) return undefined;
    let spento = false;
    const t = setTimeout(async () => {
      const aperte = dati.soggetti.filter(r => analisiInCorso(r.verifica)).map(r => r.verifica);
      try {
        const attuali = await base44.entities.VerificaReport.filter({ anno, settimana }, '-created_date', 500, 0, ['id', 'stato']);
        if (spento) return;
        const stato = new Map((attuali || []).map(v => [v.id, v.stato]));
        const cambiate = aperte.filter(v => stato.get(v.id) !== v.stato);
        const finite = cambiate.filter(v => !['in_lettura', 'in_verifica'].includes(stato.get(v.id)) && !avviateQui.current.has(v.id));
        if (finite.length) { carica(true); return; }
        // solo i passaggi fra lettura e verifica: un esito arriva con la rilettura
        const passaggi = cambiate.filter(v => ['in_lettura', 'in_verifica'].includes(stato.get(v.id)));
        if (passaggi.length) {
          setDati(d => (d ? {
            ...d,
            soggetti: d.soggetti.map(r => (r.verifica && passaggi.some(v => v.id === r.verifica.id)
              ? { ...r, verifica: { ...r.verifica, stato: stato.get(r.verifica.id) } } : r)),
          } : d));
        }
        setGiro(g => g + 1);
      } catch (e) {
        if (!spento) setGiro(g => g + 1);
      }
    }, 8000);
    return () => { spento = true; clearTimeout(t); };
  }, [inCorso, dati, carica, giro, anno, settimana]);

  const sposta = (passo) => {
    let a = anno, s = settimana + passo;
    if (s < 1) { a -= 1; s = settimaneNellAnno(a); }
    if (s > settimaneNellAnno(a)) { a += 1; s = 1; }
    setAnno(a);
    setSettimana(s);
  };

  // Sostituisce la verifica di un soggetto: crea la nuova, avvia il confronto e poi
  // cancella la precedente. Se la cancellazione non riesce, la nuova non resta ferma.
  const avviaVerifica = async (riga, campi, payload) => {
    const precedenteVerifica = riga.verifica;
    const nuova = await conRitentativi(() => base44.entities.VerificaReport.create({
      soggetto_chiave: riga.chiave,
      soggetto_nome: riga.nome,
      anno,
      settimana,
      data_inizio: intervallo.inizio,
      data_fine: intervallo.fine,
      avviata_il: new Date().toISOString(),
      scade_il: aggiungiGiorni(oggiRoma(), GIORNI_CONSERVAZIONE),
      ...campi,
    }));

    avviateQui.current.add(nuova.id);
    base44.functions.invoke('elaboraReportSettimanale', { verifica_id: nuova.id, ...payload })
      .catch((e) => {
        const risposta = (e && e.data) || (e && e.response && e.response.data) || {};
        // Rinviata (409): un archivio dei movimenti si sta riscrivendo. Le righe
        // lette sono salvate e il confronto si completa a caricamento finito.
        if (risposta.error) {
          toast(risposta.rinviato
            ? { title: `Verifica di ${riga.nome} rinviata`, description: risposta.error }
            : { title: `Verifica di ${riga.nome} non riuscita`, description: risposta.error, variant: 'destructive' });
        }
      })
      .finally(() => { avviateQui.current.delete(nuova.id); carica(true); });

    if (precedenteVerifica) {
      try {
        await conRitentativi(() => eliminaParti('VerificaReport', precedenteVerifica.id));
        await conRitentativi(() => base44.entities.VerificaReport.delete(precedenteVerifica.id));
      } catch (e) {
        toast({ title: 'La verifica precedente non è stata cancellata', description: 'Si cancellerà da sola alla scadenza. ' + (e.message || ''), variant: 'destructive' });
      }
    }
  };

  const [dichiara, setDichiara] = useState(null);
  const [notaDichiarazione, setNotaDichiarazione] = useState('');

  const registraDichiarazione = async () => {
    const riga = dichiara;
    setDichiara(null);
    setOccupato(riga.chiave);
    try {
      await avviaVerifica(riga, {
        file_nome: 'Nessuna movimentazione dichiarata',
        file_tipo: 'dichiarazione',
        nota: notaDichiarazione.trim(),
        stato: 'in_verifica',
      }, { nessuna_movimentazione: true });
      setOccupato(null);
      await carica(true);
    } catch (e) {
      setOccupato(null);
      toast({ title: 'Registrazione non riuscita', description: e.message || String(e), variant: 'destructive' });
    }
  };

  const carica_report = async (riga, file) => {
    const tipo = tipoDiFile(file);
    if (!tipo) { toast({ title: 'Formato non supportato', description: 'Carica un file Excel (.xlsx, .xls), LibreOffice (.ods), CSV, PDF o un\'immagine.', variant: 'destructive' }); return; }
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
        payload.tabelle = await leggiTabelleDaFile(file, { inizio: intervallo.inizio, fine: intervallo.fine });
        if (payload.tabelle.length === 0) throw new Error('Il file è vuoto.');
      } else {
        // Un PDF o un'immagine il codice non li sa leggere: si caricano perché
        // l'agente li legga da un link firmato, e poi si prova a cancellarli.
        const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
        payload.file = { file_uri, mime: tipo };
      }

      await avviaVerifica(riga, { file_nome: file.name, file_tipo: tipo, stato: 'in_lettura' }, payload);
      setOccupato(null);
      await carica(true);
    } catch (e) {
      setOccupato(null);
      toast({ title: 'Caricamento non riuscito', description: e.message || String(e), variant: 'destructive' });
    }
  };

  const elimina = async (riga) => {
    if (!window.confirm(`Eliminare la verifica del report di ${riga.nome} per la settimana ${settimana}? L'operazione non si può annullare.`)) return;
    try {
      await eliminaParti('VerificaReport', riga.verifica.id);
      await base44.entities.VerificaReport.delete(riga.verifica.id);
      await carica(true);
    } catch (e) {
      toast({ title: 'Eliminazione non riuscita', description: e.message || String(e), variant: 'destructive' });
    }
  };

  const scarica = async (id, formato = 'excel') => {
    try {
      const v = await conCampiCompleti('VerificaReport', await base44.entities.VerificaReport.get(id), ['esito_json', 'lettura_json']);
      if (formato === 'pdf') await esportaEsitoVerificaPdf(v);
      else await scaricaExcelVerifica(v);
    } catch (e) {
      toast({ title: 'Esportazione non riuscita', description: e.message || String(e), variant: 'destructive' });
    }
  };

  const soggetti = dati ? dati.soggetti : [];
  const movimentato = (r) => !!r.movimentato;
  const ricalcolo = dati && dati.ricalcolo;
  const conMovimenti = soggetti.filter(r => movimentato(r) || r.verifica);
  const senzaMovimenti = soggetti.filter(r => !movimentato(r) && !r.verifica);
  const caricati = soggetti.filter(r => r.verifica && r.verifica.stato === 'completata');
  const daCaricare = soggetti.filter(r => movimentato(r) && !r.verifica).length;
  const conSegnalazioni = caricati.filter(r => (r.verifica.conformita ? r.verifica.conformita !== 'piena' : segnalazioni(r.verifica) > 0)).length;

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
            <span><strong className={`tabular-nums ${conSegnalazioni ? 'text-red-600' : ''}`}>{conSegnalazioni}</strong> <span className="text-muted-foreground">con conformità parziale</span></span>
          </div>
        )}
      </div>

      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          Il report deve riportare tutte le movimentazioni: ingressi in primaria e ingressi e uscite in secondaria, di rete, ACI ed extra raccolta.
          Se l'impianto comunica che non ce ne sono state, registralo con l'icona della busta: la comunicazione viene verificata e, se i dati la smentiscono, si apre un alert.
          Carica il report inviato da ciascun impianto o stoccaggio: Excel, CSV, PDF o immagine. Gli ingressi si confrontano con le primarie,
          le uscite con le secondarie; il peso al chilogrammo, la data su quella di fine trasporto. Immissione, inizio e fine trasporto sono
          obbligatorie: un formulario registrato a cui ne manca una, o con le date incoerenti, è un&apos;anomalia del suo canale. Nella verifica restano solo i dati letti
          e l'esito, che si cancellano da soli {GIORNI_CONSERVAZIONE} giorni dopo il caricamento: un Excel si legge qui nel browser senza
          caricare niente, un PDF o un'immagine vengono caricati nell'archivio privato perché l'agente li possa leggere.
          Il confronto si rifà da solo sui movimenti di adesso dopo ogni caricamento di primarie e secondarie e a ogni apertura della settimana.
        </span>
      </div>

      {ricalcolo && ricalcolo.rinviato && ricalcolo.rinviato.length > 0 && (
        <div className="flex items-start gap-2 border border-amber-300 bg-amber-50 text-amber-900 rounded-lg px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Caricamento {ricalcolo.rinviato.map(a => a.descrizione || `${a.tipo_file.replace(/_/g, ' ')}${a.data ? ` del ${dataIt(a.data)}` : ''}${a.utente ? `, ${a.utente}` : ''}`).join('; ')}.
            {' '}L&apos;archivio può essere a metà, quindi gli esiti mostrati sono quelli dell&apos;ultimo confronto e anche ingressi e uscite possono essere incompleti.
            Si aggiornano da soli a caricamento finito; se il caricamento si è interrotto o non è riuscito, va ripetuto.
          </span>
        </div>
      )}

      {/* Immissione, inizio e fine trasporto sono obbligatorie nei formulari
          (regola dell'utente del 22/09/2026): i terminati a cui ne manca una, o
          con date incoerenti, si dicono qui per canale e archivio, di qualunque
          anno. Nel report di un impianto la loro riga e' un'anomalia del canale. */}
      {dati && dati.date_da_sistemare && dati.date_da_sistemare.length > 0 && (
        <div className="flex items-start gap-2 border border-red-300 bg-red-50 text-red-900 rounded-lg px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <div>
              Ordini terminati senza una data obbligatoria (immissione, inizio o fine trasporto) o con date incoerenti: le date vanno inserite o corrette.
              Se un loro formulario compare nel report di un impianto, la riga è un&apos;anomalia del suo canale. Chi non ha la fine trasporto non sta
              in nessuna settimana, quindi non è né fra gli ingressi e le uscite né nella quadratura. La data si sistema con un nuovo caricamento del file che la riporti,
              o nella scheda per l&apos;extra raccolta.
            </div>
            <ul className="list-disc pl-5 text-xs">
              {dati.date_da_sistemare.map(g => (
                <li key={g.canale + g.fonte}>
                  <strong>{nomeGruppoDate(g)}</strong>: {g.n} {g.n === 1 ? 'ordine' : 'ordini'}{g.senza_fine ? `, di cui ${g.senza_fine} senza fine trasporto` : ''} ·{' '}
                  {g.esempi.map(x => `${x.ordine || 'senza ID'}${x.fir ? ` (FIR ${x.fir})` : ' (senza formulario)'}: ${x.date}`).join('; ')}
                  {g.n > g.esempi.length ? `; e altri ${g.n - g.esempi.length}` : ''}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {ricalcolo && ricalcolo.errori && ricalcolo.errori.length > 0 && (
        <div className="flex items-start gap-2 border border-red-300 bg-red-50 text-red-800 rounded-lg px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Per {ricalcolo.errori.length === 1 ? 'una verifica' : `${ricalcolo.errori.length} verifiche`} il confronto non si è potuto rifare con i movimenti di adesso,
            e resta quello salvato: {ricalcolo.errori.map(e => e.errore).join('; ')}
          </span>
        </div>
      )}

      {errore && (
        <div className="flex items-start gap-2 border border-red-300 bg-red-50 text-red-800 rounded-lg px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{errore}</span>
        </div>
      )}

      {caricando && !dati ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" />Leggo i movimenti della settimana…</div>
      ) : dati && (
        <div className="border rounded-lg overflow-x-auto bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Impianto o stoccaggio</th>
                <th className="px-4 py-2.5 font-semibold">Ingressi <span className="font-normal text-muted-foreground">per canale</span></th>
                <th className="px-4 py-2.5 font-semibold">Uscite <span className="font-normal text-muted-foreground">per canale</span></th>
                <th className="px-4 py-2.5 font-semibold">Report</th>
                <th className="px-4 py-2.5 font-semibold">Esito</th>
                <th className="px-4 py-2.5 font-semibold">Si cancella il</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {conMovimenti.map(r => (
                <RigaSoggetto key={r.chiave} riga={r} isAdmin={isAdmin} occupato={occupato === r.chiave}
                  onCarica={carica_report} onDichiara={(r) => { setNotaDichiarazione(""); setDichiara(r); }} onApri={setAperta} onElimina={elimina} onScarica={scarica} />
              ))}
              {senzaMovimenti.length > 0 && (
                <tr className="border-t bg-muted/20">
                  <td colSpan={7} className="px-4 py-2 text-xs text-muted-foreground uppercase tracking-wide">Senza movimenti in questa settimana</td>
                </tr>
              )}
              {senzaMovimenti.map(r => (
                <RigaSoggetto key={r.chiave} riga={r} isAdmin={isAdmin} occupato={occupato === r.chiave}
                  onCarica={carica_report} onDichiara={(r) => { setNotaDichiarazione(""); setDichiara(r); }} onApri={setAperta} onElimina={elimina} onScarica={scarica} />
              ))}
              {soggetti.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nessun impianto o stoccaggio attivo nel {anno}.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <DettaglioVerifica verificaId={aperta} isAdmin={isAdmin} open={!!aperta} onClose={() => setAperta(null)} onModificata={() => carica(true)} />

      <Dialog open={!!dichiara} onOpenChange={(x) => { if (!x) setDichiara(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nessuna movimentazione comunicata</DialogTitle>
            <DialogDescription>
              {dichiara ? `${dichiara.nome} comunica che nella settimana ${settimana} (${descriviIntervallo(intervallo)}) non ci sono state movimentazioni.` : ''}
              {' '}La comunicazione viene confrontata con i formulari registrati: se ne risultano, si apre un alert. Il controllo si ripete a ogni nuovo caricamento di primarie e secondarie.
            </DialogDescription>
          </DialogHeader>
          {dichiara && dichiara.movimentato && (
            <div className="flex items-start gap-2 text-sm text-red-800 border border-red-200 bg-red-50 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Nel gestionale risultano già movimenti in questa settimana ({descriviPerCanale(dichiara.canali)}): la comunicazione sarà smentita.</span>
            </div>
          )}
          {dichiara && dichiara.verifica && (
            <div className="text-sm text-amber-800">La verifica già presente ({dichiara.verifica.file_nome}) sarà sostituita.</div>
          )}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="nota-dichiarazione">Riferimento della comunicazione</label>
            <Textarea id="nota-dichiarazione" rows={2} value={notaDichiarazione} onChange={(e) => setNotaDichiarazione(e.target.value)}
              placeholder="Es. email del 15/09/2026 di Mario Rossi" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDichiara(null)}>Annulla</Button>
            <Button onClick={registraDichiarazione}>Registra e verifica</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
