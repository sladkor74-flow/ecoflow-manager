import React, { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  ChevronLeft, ChevronRight, Upload, Loader2, FileText, AlertTriangle, CheckCircle2, Info, Trash2, RefreshCw, Eye, EyeOff,
} from 'lucide-react';
import { formatKg } from '@/lib/utils';
import Storia from '@/components/shared/Storia';
import { conCampiCompleti, eliminaParti } from '@/lib/testoLungo';
import {
  oggiRoma, aggiungiGiorni, settimanaIso, intervalloSettimana, settimaneNellAnno, descriviIntervallo, dataIt,
} from '@/lib/verifiche';
import { NOME_VERDETTO, COLORE_VERDETTO, misura, tonnellate, giornoRoma, FORMATI, tipoDiFile, leggiPivotDaExcel, formulariConDate, descriviConDate } from '@/lib/quadraturaFir';
import { esportaQuadraturaFirPdf } from '@/lib/quadraturaFirPdf';

// Sezione del modulo Verifiche: la quadratura settimanale dei formulari.
//
// Ogni settimana si carica la stampa con il conteggio e la somma dei FIR di
// WINSINFO e del portale Ecotyre, e il gestionale fa da terza fonte. Nella
// quadratura restano i numeri letti e l'esito del confronto.
//
// I canali non si mischiano: rete, ACI ed extra raccolta hanno ognuno la propria
// tabella, il proprio totale e il proprio esito. Un esito unico per la settimana
// dava "da sistemare" alla rete per una riga dell'extra raccolta.
//
// L'esito arriva gia' rifatto dal server sui movimenti di adesso: quello salvato
// il giorno della stampa non conosceva i formulari caricati dopo.

const LIMITE = 5 * 1024 * 1024;

const NOME_CANALE = { RETE: 'Rete', ACI: 'ACI', 'EXTRA RACCOLTA': 'Extra raccolta' };

// I QUATTRO FLUSSI CHE SI QUADRANO, come li ha elencati l'utente il 30/09/2026:
// "le verifiche sono solo di questo tipo... solo negli stati terminati:
// a) primarie rete b) primarie aci c) secondarie rete d) secondarie aci".
const FLUSSI_SCELTA = [
  { valore: 'rete_primarie', nome: 'Primarie rete' },
  { valore: 'rete_secondarie', nome: 'Secondarie rete' },
  { valore: 'aci_primarie', nome: 'Primarie ACI' },
  { valore: 'aci_secondarie', nome: 'Secondarie ACI' },
];
const FONTI_SCELTA = [
  { valore: 'winsinfo', nome: 'WINSINFO' },
  { valore: 'ecotyre', nome: 'Portale Ecotyre' },
];

const SELECT = 'h-8 rounded-md border border-input bg-background px-2 text-sm';

// I caricamenti aperti come li descrive il server: tipo, giorno, chi, file, e se
// risulta interrotto (allora va ripetuto) o si e' concluso durante la lettura.
const descriviInCorso = (elenco) => elenco
  .map(a => a.descrizione || `${String(a.tipo_file || '').replace(/_/g, ' ')}${a.data ? ` del ${dataIt(a.data)}` : ''}: non ancora concluso`)
  .join('; ');

/** Il pallino di un canale nello storico: verde se quadra, ambra se c'e' da sistemare. */
function Pallino({ c }) {
  const piena = c.conformita === 'piena';
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${piena ? 'bg-emerald-600' : 'bg-amber-500'}`} />;
}

// Il verdetto di un canale in una frase: le righe da sistemare, oppure perche'
// quadra solo in parte anche senza righe diverse.
function verdettoCanale(c) {
  if (c.conformita === 'piena') return 'Le tre fonti quadrano';
  if (c.incongruenti > 0) return `${c.incongruenti} ${c.incongruenti === 1 ? 'riga da sistemare' : 'righe da sistemare'}`;
  // Righe che la stampa non copre: non sono scostamenti, e chiamarle "da
  // sistemare" era un'accusa a dei formulari di cui non si sa ancora niente.
  if (c.fuori_stampa > 0) return `${c.fuori_stampa} ${c.fuori_stampa === 1 ? 'riga non confrontata' : 'righe non confrontate'}: manca la tabella nel file`;
  if (!c.lettura_verificata) return 'Le righe quadrano, ma una tabella non è stata attribuita';
  return 'Le righe quadrano, ma il confronto è incompleto: vedi le note';
}

/**
 * Perche' la lettura del file non e' confermata. Sono tre cose diverse - le
 * somme, la fonte, il flusso - e vanno dette per quello che sono: accusare la
 * trascrizione quando i totali tornavano al chilo mandava l'utente a ricontrollare
 * un originale che era giusto.
 */
function motivoLetturaNonConfermata(esito) {
  const e = esito || {};
  if (e.totali_quadrano === false) {
    return 'La somma delle righe lette non torna con i totali stampati sul file: controlla la trascrizione sull\'originale prima di fidarti dell\'esito.';
  }
  const parti = [];
  if (e.flussi_riconosciuti === false) parti.push('di una tabella non si sa a quale flusso appartiene, o due tabelle sono finite sullo stesso');
  if (e.fonti_riconosciute === false) parti.push('di una tabella non si sa se è di WINSINFO o del portale');
  if (!parti.length) return 'La lettura del file non è confermata: vedi le note qui sotto.';
  return `I numeri letti tornano con i totali stampati sul file, ma ${parti.join(' e ')}. Assegna le tabelle qui sotto e rifai il confronto: finché restano così, quei formulari non entrano in nessun confronto.`;
}

/**
 * LE TABELLE LETTE, E A QUALE FLUSSO VANNO.
 *
 * Il modulo capiva il flusso dal testo scritto sopra la pivot. Ma le intestazioni
 * le scrive chi manda la stampa - parole dell'utente, 30/09/2026: "non le faccio
 * io, a me tocca riceverle e controllarle" - e nella settimana 39 la scommessa si
 * e' persa: "WIN SEC" non era niente, "WINSINFO ECT SEC-ACI" e' finita fra le
 * primarie ACI, e due pivot sullo stesso flusso ne hanno fatta sparire una.
 *
 * Adesso la proposta automatica resta, ma si vede e si corregge: il menu c'e'
 * sempre e arriva gia' compilato (scelta dell'utente). Qualunque cosa ci sia
 * scritto sopra la pivot, la quadratura viene giusta.
 */
function AssegnaTabelle({ tabelle, onCambia, onRifai, occupato }) {
  if (!tabelle || !tabelle.length) return null;
  const mancanti = tabelle.filter(t => !t.flusso || !t.fonte).length;
  const doppie = new Set();
  const visti = new Set();
  for (const t of tabelle) {
    if (!t.flusso || !t.fonte) continue;
    const k = `${t.flusso}|${t.fonte}`;
    if (visti.has(k)) doppie.add(k); else visti.add(k);
  }
  return (
    <div className="rounded-lg border px-4 py-3 bg-card space-y-2">
      <div className="text-sm font-medium">Le tabelle lette dal file, e a quale flusso appartengono</div>
      <div className="text-sm text-muted-foreground">
        La proposta viene dall&apos;intestazione stampata sopra la pivot. Le intestazioni cambiano di settimana in settimana: se una proposta è sbagliata, correggila qui e rifai il confronto.
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="text-left">
              <th className="py-1 pr-3 font-medium">Intestazione sul file</th>
              <th className="py-1 pr-3 font-medium">Fonte</th>
              <th className="py-1 pr-3 font-medium">Flusso</th>
              <th className="py-1 pr-3 font-medium text-right">Formulari</th>
              <th className="py-1 font-medium text-right">Chili</th>
            </tr>
          </thead>
          <tbody>
            {tabelle.map((t, i) => {
              const doppia = t.flusso && t.fonte && doppie.has(`${t.flusso}|${t.fonte}`);
              return (
                <tr key={i} className={`border-t ${doppia ? 'bg-amber-50' : ''}`}>
                  <td className="py-1.5 pr-3">
                    {t.titolo || <span className="text-muted-foreground italic">senza intestazione</span>}
                    {t.foglio ? <span className="text-xs text-muted-foreground"> · {t.foglio}</span> : null}
                  </td>
                  <td className="py-1.5 pr-3">
                    <select className={SELECT} value={t.fonte || ''} disabled={occupato} onChange={(e) => onCambia(i, { fonte: e.target.value })}>
                      <option value="">— da scegliere —</option>
                      {FONTI_SCELTA.map(f => <option key={f.valore} value={f.valore}>{f.nome}</option>)}
                    </select>
                  </td>
                  <td className="py-1.5 pr-3">
                    <select className={SELECT} value={t.flusso || ''} disabled={occupato} onChange={(e) => onCambia(i, { flusso: e.target.value })}>
                      <option value="">— da scegliere —</option>
                      {FLUSSI_SCELTA.map(f => <option key={f.valore} value={f.valore}>{f.nome}</option>)}
                    </select>
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{t.totale_conteggio}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatKg(t.totale_kg)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {(mancanti > 0 || doppie.size > 0) && (
        <div className="text-sm text-amber-900 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            {mancanti > 0 && `${mancanti === 1 ? 'Una tabella è' : `${mancanti} tabelle sono`} senza flusso o senza fonte: i suoi formulari non entrano in nessun confronto. `}
            {doppie.size > 0 && 'Due tabelle hanno lo stesso flusso e la stessa fonte: quel flusso non si confronta finché non le distingui.'}
          </span>
        </div>
      )}
      <div className="flex justify-end">
        <Button size="sm" onClick={onRifai} disabled={occupato}>
          {occupato ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
          Rifai il confronto con queste assegnazioni
        </Button>
      </div>
    </div>
  );
}

function EsitoCanale({ c }) {
  const piena = c.conformita === 'piena';
  return (
    <div className={`rounded-md border px-3 py-2 ${piena ? 'border-emerald-200 bg-emerald-50' : 'border-amber-300 bg-amber-50'}`}>
      <div className="flex items-center gap-1.5">
        {piena ? <CheckCircle2 className="w-4 h-4 text-emerald-700" /> : <AlertTriangle className="w-4 h-4 text-amber-700" />}
        <span className={`text-sm font-semibold ${piena ? 'text-emerald-900' : 'text-amber-900'}`}>{NOME_CANALE[c.canale] || c.canale}</span>
      </div>
      <div className={`text-sm ${piena ? 'text-emerald-900' : 'text-amber-900'}`}>{verdettoCanale(c)}</div>
      <div className="text-xs text-muted-foreground">{c.congruenti} {c.congruenti === 1 ? 'riga congruente' : 'righe congruenti'}</div>
      {/* Immissione, inizio e fine trasporto sono obbligatorie (22/09/2026):
          non cambiano il verdetto delle tre fonti, ma nel canale si dicono. */}
      {c.date_da_sistemare > 0 && (
        <div className="text-xs text-red-700 mt-0.5">
          {c.date_da_sistemare === 1 ? '1 formulario registrato' : `${c.date_da_sistemare} formulari registrati`} senza una data obbligatoria o con date incoerenti
        </div>
      )}
    </div>
  );
}

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
  // Uno per formulario, anche se ripartito su piu' ordini: "e altri" conta i
  // formulari, come il riquadro del canale (22/09/2026).
  const conDate = formulariConDate(flusso.date_da_sistemare || []);
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
        {/* I formulari del flusso contati nella settimana ma senza l'immissione o
            l'inizio del trasporto, o con date incoerenti: le date vanno inserite. */}
        {conDate.length > 0 && (
          <div className="flex items-start gap-2 text-xs text-red-800 bg-red-50 border border-red-200 rounded px-2 py-1.5">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              Formulari registrati senza una data obbligatoria o con date incoerenti, contati nella settimana perché la fine trasporto c&apos;è:{' '}
              {conDate.slice(0, 8).map(descriviConDate).join('; ')}
              {conDate.length > 8 ? `; e altri ${conDate.length - 8}` : ''}. Le date vanno inserite o corrette.
            </span>
          </div>
        )}
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
  // Le tabelle lette dal file con la loro assegnazione, per il menu dei flussi.
  const [assegna, setAssegna] = useState(null);
  // La settimana e l'anno letti sul file: si rimandano con le tabelle, altrimenti
  // a ogni correzione l'esito direbbe che sul file la settimana non c'è.
  const [assegnaMeta, setAssegnaMeta] = useState(null);
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
      // Ricaricando il file la quadratura torna intera: alleggerito_il e la storia
      // vanno azzerati, altrimenti resterebbe segnata come alleggerita per sempre,
      // i pulsanti resterebbero spenti e non le si toglierebbe mai piu' il
      // dettaglio nuovo.
      await base44.entities.QuadraturaFir.update(precedente.id, { ...campi, stato: 'in_lettura', errore: '', avviata_il: new Date().toISOString(), alleggerito_il: '', storia: '' });
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
      // Un Excel si legge qui nel browser, senza agente e senza caricare niente.
      // Un PDF o una foto vanno caricati: l'agente li legge da un link firmato
      // e subito dopo si prova a cancellare il file.
      const payload = tipo === 'excel'
        ? { tabelle: await leggiPivotDaExcel(file) }
        : { file_uri: (await base44.integrations.Core.UploadPrivateFile({ file })).file_uri };
      await elabora(payload, { file_nome: file.name, file_tipo: tipo, ...(payload.file_uri ? { file_uri: payload.file_uri } : {}) });
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

  // Le righe lette e la loro assegnazione stanno in due campi lunghi del record,
  // che la pagina non carica con l'elenco: si leggono quando servono, cioe' quando
  // c'e' una quadratura completata di cui si puo' ancora correggere il flusso.
  // Di una alleggerita non restano piu' le righe: solo la storia scritta.
  const q0 = dati && dati.quadratura;
  const idQuadratura = q0 && q0.stato === 'completata' && !q0.alleggerito_il ? q0.id : null;
  useEffect(() => {
    let vivo = true;
    if (!idQuadratura) { setAssegna(null); setAssegnaMeta(null); return () => { vivo = false; }; }
    (async () => {
      try {
        const piena = await conCampiCompleti('QuadraturaFir', await base44.entities.QuadraturaFir.get(idQuadratura), ['righe_json', 'lettura_json']);
        const righe = piena.righe_json ? JSON.parse(piena.righe_json) : null;
        const lettura = piena.lettura_json ? JSON.parse(piena.lettura_json) : null;
        if (!vivo || !righe || !Array.isArray(righe.tabelle)) { if (vivo) { setAssegna(null); setAssegnaMeta(null); } return; }
        setAssegnaMeta({ settimana: righe.settimana ?? null, anno: righe.anno ?? null, note: righe.note || '' });
        // Le due liste sono nello stesso ordine: righe_json porta i numeri,
        // lettura_json l'assegnazione che il server ha calcolato.
        setAssegna(righe.tabelle.map((t, i) => {
          const l = lettura && Array.isArray(lettura.tabelle) ? lettura.tabelle[i] : null;
          return { ...t, fonte: t.fonte || (l && l.fonte) || '', flusso: t.flusso || (l && l.flusso) || '' };
        }));
      } catch { if (vivo) setAssegna(null); }
    })();
    return () => { vivo = false; };
  }, [idQuadratura]);

  const cambiaAssegnazione = (i, patch) => {
    setAssegna(prima => (prima || []).map((t, j) => (j === i ? { ...t, ...patch } : t)));
  };

  // Si rimanda tutto al server come se fosse una lettura nuova, con il flusso e la
  // fonte scelti: il confronto si rifa' e l'esito si salva.
  const rifaiConAssegnazioni = async () => {
    setOccupato(true);
    setErrore(null);
    try {
      await base44.functions.invoke('elaboraQuadraturaFir', {
        quadratura_id: dati.quadratura.id,
        tabelle: assegna,
        settimana_file: assegnaMeta ? assegnaMeta.settimana : null,
        anno_file: assegnaMeta ? assegnaMeta.anno : null,
        note: assegnaMeta ? assegnaMeta.note : '',
      });
      await carica(true);
    } catch (e) {
      toast({ title: 'Confronto non riuscito', description: e.message || String(e), variant: 'destructive' });
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

  // Il PDF porta l'esito che si vede a video, rifatto sui movimenti di adesso,
  // con la conformita' canale per canale e la data di quel confronto: con la
  // data del record, quando l'esito rifatto non era salvato, contenuto e data
  // non corrispondevano. Dal record serve solo come e' stato letto il file.
  const scarica = async () => {
    try {
      const salvata = await conCampiCompleti('QuadraturaFir', await base44.entities.QuadraturaFir.get(dati.quadratura.id), ['lettura_json']);
      const { esito_json: _esito, righe_json: _righe, lettura_json: _lettura, ...aggiornata } = dati.quadratura;
      const rifatto = dati.ricalcolo || {};
      const confronto = rifatto.rifatto && rifatto.eseguito_il ? { verificata_il: rifatto.eseguito_il } : {};
      await esportaQuadraturaFirPdf({ ...salvata, ...aggiornata, ...confronto }, { ...(dati.esito || {}), per_canale: dati.per_canale || null },
        salvata.lettura_json ? JSON.parse(salvata.lettura_json) : null);
    } catch (e) {
      toast({ title: 'Esportazione non riuscita', description: e.message || String(e), variant: 'destructive' });
    }
  };

  const q = dati && dati.quadratura;
  // Al quarantesimo giorno la quadratura perde le righe lette e il confronto cella
  // per cella: restano il verdetto per canale, che e' un campo del record, e la
  // storia scritta.
  const alleggerita = !!(q && q.alleggerito_il);
  const esito = dati && dati.esito;
  const perCanale = (dati && dati.per_canale) || [];
  const ricalcolo = (dati && dati.ricalcolo) || {};
  const inCorso = (dati && dati.caricamenti_in_corso) || [];
  const gestionale = (dati && dati.gestionale) || {};
  const flussiGestionale = Object.entries(gestionale).filter(([, v]) => v.totale && v.totale.n > 0);
  // null: il conteggio dei senza fine trasporto non si e' potuto fare, e si dice.
  const senzaFine = Object.entries(gestionale).filter(([, v]) => v.senza_fine === null || (v.senza_fine && v.senza_fine.n > 0));
  // i formulari della settimana senza l'immissione o l'inizio del trasporto, o con date incoerenti
  const conDate = Object.entries(gestionale).filter(([, v]) => v.date_da_sistemare && v.date_da_sistemare.n > 0);
  // Fino a quando i movimenti del gestionale sono aggiornati: l'ultimo caricamento di ogni tipo.
  const aggiornatoAl = [...new Map(Object.values(gestionale).filter(v => v.ultimo_caricamento && v.ultimo_caricamento.data)
    .map(v => [v.ultimo_caricamento.data + v.ultimo_caricamento.nome_file, v.ultimo_caricamento])).values()]
    .sort((a, b) => String(b.data).localeCompare(String(a.data)));

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
              <Button variant="outline" onClick={scarica} disabled={alleggerita}
                title={alleggerita ? 'Di questa quadratura resta la storia scritta: senza il confronto cella per cella il PDF sarebbe vuoto' : undefined}><FileText className="w-4 h-4 mr-2" />Report PDF</Button>
              {isAdmin && (
                <Button
                  variant="ghost" size="icon"
                  title={alleggerita ? 'Di questa quadratura resta la storia scritta: senza le righe lette il confronto non si può rifare' : 'Ripeti il confronto con i dati del gestionale di ora'}
                  disabled={occupato || alleggerita}
                  onClick={ripeti}
                ><RefreshCw className="w-4 h-4" /></Button>
              )}
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
          Rete, ACI ed extra raccolta restano separati e non si sommano mai fra loro. Nella quadratura restano soltanto i numeri letti e l&apos;esito, e quaranta giorni dopo il caricamento
          se ne vanno anche quelli: restano il verdetto per canale e la storia scritta, con gli scostamenti che non tornavano. La quadratura non si cancella da sola.
          Un Excel si legge qui nel browser senza caricare niente, mentre un PDF o una foto vengono caricati nell&apos;archivio privato perché l&apos;agente li possa leggere, e cancellati subito dopo.
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
            <div className="rounded-lg border px-4 py-3 bg-card space-y-2">
              <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
                <span>{q.righe_lette} righe lette in {q.tabelle} tabelle · {q.file_nome}</span>
                <span className="ml-auto">
                  {ricalcolo.rifatto
                    ? `Esito rifatto ora sui movimenti del gestionale${aggiornatoAl.length ? `, caricati il ${aggiornatoAl.map(c => dataIt(c.data)).filter((d, i, a) => a.indexOf(d) === i).join(', ')}` : ''}`
                    : q.verificata_il ? `Confronto del ${giornoRoma(q.verificata_il)}` : ''}
                  {ricalcolo.rifatto && ricalcolo.cambiato && !ricalcolo.salvato ? ' · diverso da quello salvato, che si aggiorna quando lo apre un amministratore' : ''}
                </span>
              </div>
              {(ricalcolo.motivo || inCorso.length > 0) && (
                <div className="text-sm text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{ricalcolo.motivo || `Caricamento ${descriviInCorso(inCorso)}. I numeri del gestionale possono essere incompleti.`}</span>
                </div>
              )}
              {perCanale.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-3">
                  {perCanale.map(c => <EsitoCanale key={c.canale} c={c} />)}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Nel file e nel gestionale non c&apos;è nessun flusso da confrontare in questa settimana.</div>
              )}
              {alleggerita && <Storia testo={q.storia} alleggeritoIl={q.alleggerito_il} cosa="quadratura" />}
              {/* TRE MOTIVI DIVERSI, TRE FRASI DIVERSE. Qui c'era una frase sola,
                  "la somma delle righe lette non torna con i totali stampati", e
                  la si leggeva anche quando le somme tornavano tutte al chilo e il
                  motivo vero era un'intestazione non riconosciuta: si dava la
                  colpa a una trascrizione che era esatta. */}
              {!alleggerita && !q.lettura_verificata && (
                <div className="mt-2 text-sm text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{motivoLetturaNonConfermata(esito)}</span>
                </div>
              )}
              {esito && esito.osservazioni && esito.osservazioni.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm list-disc pl-5">
                  {esito.osservazioni.map((o, i) => <li key={i}>{o}</li>)}
                </ul>
              )}
            </div>
          )}

          {!alleggerita && (
            <AssegnaTabelle tabelle={assegna} onCambia={cambiaAssegnazione} onRifai={rifaiConAssegnazioni} occupato={occupato} />
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
              {/* Immissione, inizio e fine trasporto sono obbligatorie (regola
                  dell'utente del 22/09/2026). I terminati senza fine trasporto non
                  stanno in nessuna settimana: non sono contati qui sopra, e si dice
                  quanti sono, flusso per flusso. Quelli della settimana senza
                  immissione o inizio, o con date incoerenti, sono contati e si dicono. */}
              {(senzaFine.length > 0 || conDate.length > 0) && (
                <div className="text-sm text-red-900 space-y-0.5">
                  {senzaFine.map(([k, v]) => (
                    <div key={k} className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>
                        {v.titolo} · {v.canale}: {v.senza_fine === null
                          ? 'non si è potuto contare quanti formulari sono terminati senza data di fine trasporto.'
                          : `${v.senza_fine.n} ${v.senza_fine.n === 1 ? 'formulario terminato' : 'formulari terminati'} senza data di fine trasporto (${v.senza_fine.esempi.map(descriviConDate).join('; ')}${v.senza_fine.n > v.senza_fine.esempi.length ? '; …' : ''}): la data è obbligatoria e va inserita. Finché manca non stanno in nessuna settimana e non sono contati.`}
                      </span>
                    </div>
                  ))}
                  {conDate.map(([k, v]) => (
                    <div key={`date-${k}`} className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>
                        {v.titolo} · {v.canale}: {v.date_da_sistemare.n} {v.date_da_sistemare.n === 1 ? 'formulario della settimana registrato' : 'formulari della settimana registrati'} senza una data obbligatoria o con date incoerenti
                        {' '}({v.date_da_sistemare.esempi.map(descriviConDate).join('; ')}{v.date_da_sistemare.n > v.date_da_sistemare.esempi.length ? '; …' : ''}): sono contati, ma le date vanno inserite o corrette.
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {inCorso.length > 0 && (
                <p className="text-sm text-amber-900">
                  Caricamento {descriviInCorso(inCorso)}. Questi numeri possono essere incompleti.
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Carica la stampa della settimana per confrontarla con WINSINFO e con il portale.
              </p>
            </div>
          )}

          {/* Lo storico elenca le settimane con una stampa caricata e, sotto il
              numero, un pallino per canale: mai un colore solo per settimana, che
              sarebbe un verdetto comune ai tre canali. Il server manda l'esito solo
              se e' stato confermato dopo l'ultimo caricamento; altrimenti la
              settimana resta senza colore, e l'esito vero si vede aprendola. */}
          {dati && dati.storico && dati.storico.length > 1 && (
            <div className="text-xs text-muted-foreground">
              Settimane con la stampa caricata nel {anno}:{' '}
              {dati.storico.map(s => {
                const canali = Array.isArray(s.per_canale) ? s.per_canale : [];
                const titolo = s.stato === 'errore' ? 'La lettura del file non è riuscita'
                  : canali.length ? canali.map(c => `${NOME_CANALE[c.canale] || c.canale}: ${verdettoCanale(c).toLowerCase()}`).join(' · ')
                  : 'Esito da rifare sui movimenti di adesso: apri la settimana';
                return (
                  <button key={s.id} type="button" onClick={() => setSettimana(s.settimana)} title={titolo}
                    className={`mx-0.5 px-1.5 py-0.5 rounded border inline-flex flex-col items-center align-top ${s.settimana === settimana ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/30'} ${s.stato === 'errore' ? 'text-red-700' : ''}`}>
                    <span>{s.settimana}</span>
                    {canali.length > 0 && <span className="flex gap-0.5">{canali.map(c => <Pallino key={c.canale} c={c} />)}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
