import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import {
  MODULI, REGOLE, SOGLIE, VERSIONE_BANCA, partiVerifica, bancaDi, caricaBanca, estraiQuiz, preparaQuiz, mescola,
  calcolaPunteggio, quizDaRipassare, bancaDaId, durata,
} from '@/lib/quizRT';
import { dataOra } from '@/lib/target';
import { GraduationCap, Timer, CheckCircle2, XCircle, MinusCircle, Loader2, Sparkles, RotateCcw, ChevronLeft, ChevronRight, Flag } from 'lucide-react';

// Esercitazione per l'esame di responsabile tecnico con i quiz ufficiali dell'Albo.
// Tre modalita': simulazione d'esame con tempo e punteggio ufficiali, allenamento
// con la correzione subito dopo ogni risposta, ripasso dei quiz sbagliati.

const LETTERE = ['A', 'B', 'C', 'D'];
const numero = (v) => (Number(v) || 0).toLocaleString('it-IT', { maximumFractionDigits: 1 });

function Spiegazione({ quiz, scelta, onClose }) {
  const [stato, setStato] = useState({ caricamento: true, testo: '', errore: '' });
  useEffect(() => {
    let attivo = true;
    base44.functions.invoke('chiediAssistente', {
      domanda: `Spiegami questo quiz dell'esame da responsabile tecnico: "${quiz.domanda}"`,
      contesto: { tipo: 'quiz', banca: quiz.banca, id: quiz.id, domanda: quiz.domanda, risposte: quiz.opzioni || quiz.risposte, esatta: quiz.esatta, scelta: scelta || '' },
    }).then(res => {
      if (attivo) setStato({ caricamento: false, testo: res.data?.record?.risposta || '', errore: '' });
    }).catch(e => {
      if (attivo) setStato({ caricamento: false, testo: '', errore: e?.response?.data?.error || e.message || 'Errore' });
    });
    return () => { attivo = false; };
  }, [quiz, scelta]);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-violet-600" /> Spiegazione dell'Assistente</DialogTitle>
          <DialogDescription>{quiz.domanda}</DialogDescription>
        </DialogHeader>
        <p className="text-sm"><span className="font-medium text-emerald-700">Risposta esatta:</span> {quiz.esatta}</p>
        {stato.caricamento && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> L'Assistente sta controllando le norme…</p>}
        {stato.errore && <p className="text-sm text-red-600">{stato.errore}</p>}
        {stato.testo && <div className="prose prose-sm max-w-none"><ReactMarkdown>{stato.testo}</ReactMarkdown></div>}
        {!stato.caricamento && <p className="text-xs text-muted-foreground">La spiegazione resta anche nell'archivio delle domande. All'esame vale sempre la risposta della banca dati ufficiale.</p>}
      </DialogContent>
    </Dialog>
  );
}

function Opzioni({ quiz, scelta, onScegli, correzione }) {
  return (
    <div className="space-y-2">
      {quiz.opzioni.map((o, i) => {
        const selezionata = scelta === o;
        let stile = selezionata ? 'border-primary bg-primary/5' : 'hover:bg-muted/60';
        if (correzione) {
          if (o === quiz.esatta) stile = 'border-emerald-500 bg-emerald-50';
          else if (selezionata) stile = 'border-red-400 bg-red-50';
          else stile = 'opacity-70';
        }
        return (
          <button
            key={i}
            type="button"
            disabled={correzione}
            onClick={() => onScegli(selezionata ? '' : o)}
            className={`w-full text-left border rounded-lg px-3 py-2.5 text-sm flex gap-3 transition-colors ${stile}`}
          >
            <span className="font-semibold text-muted-foreground w-4 shrink-0">{LETTERE[i]}</span>
            <span>{o}</span>
          </button>
        );
      })}
    </div>
  );
}

// Una prova in corso: simulazione (tempo, nessuna correzione fino alla consegna)
// oppure allenamento e ripasso (correzione subito).
function Prova({ prova, onConsegna, onAbbandona }) {
  const [indice, setIndice] = useState(0);
  const [scelte, setScelte] = useState({});
  const [corrette, setCorrette] = useState({});
  const [secondi, setSecondi] = useState(0);
  const [conferma, setConferma] = useState(false);
  const [spiega, setSpiega] = useState(null);
  const inizio = useRef(Date.now());
  const consegnata = useRef(false);
  const simulazione = prova.tipo === 'simulazione';
  const limite = simulazione ? REGOLE.minuti * 60 : null;
  const quiz = prova.quiz[indice];

  const consegna = useCallback(() => {
    if (consegnata.current) return;
    consegnata.current = true;
    onConsegna({ scelte, secondi: Math.round((Date.now() - inizio.current) / 1000) });
  }, [onConsegna, scelte]);

  useEffect(() => {
    const t = setInterval(() => setSecondi(Math.round((Date.now() - inizio.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (limite && secondi >= limite) consegna();
  }, [secondi, limite, consegna]);

  const risposte = Object.values(scelte).filter(Boolean).length;
  const residuo = limite ? limite - secondi : null;
  const mostraCorrezione = !simulazione && corrette[quiz.id];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold">{prova.titolo}</p>
          <p className="text-xs text-muted-foreground">Quiz {indice + 1} di {prova.quiz.length} · {quiz.materia}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{risposte}/{prova.quiz.length} risposte</Badge>
          <Badge variant={residuo !== null && residuo < 300 ? 'destructive' : 'secondary'} className="gap-1"><Timer className="w-3 h-3" />{residuo !== null ? durata(residuo) : durata(secondi)}</Badge>
          <Button variant="ghost" size="sm" onClick={onAbbandona}>Abbandona</Button>
        </div>
      </div>

      <div className="border rounded-xl p-4 bg-card space-y-4">
        <p className="font-medium leading-relaxed">{quiz.domanda}</p>
        <Opzioni
          quiz={quiz}
          scelta={scelte[quiz.id] || ''}
          correzione={!!mostraCorrezione}
          onScegli={(v) => setScelte(s => ({ ...s, [quiz.id]: v }))}
        />
        {!simulazione && (
          <div className="flex flex-wrap items-center gap-2">
            {!mostraCorrezione ? (
              <Button size="sm" disabled={!scelte[quiz.id]} onClick={() => setCorrette(c => ({ ...c, [quiz.id]: true }))}>Controlla</Button>
            ) : (
              <>
                {scelte[quiz.id] === quiz.esatta
                  ? <span className="flex items-center gap-1 text-sm text-emerald-700"><CheckCircle2 className="w-4 h-4" /> Esatta</span>
                  : <span className="flex items-center gap-1 text-sm text-red-600"><XCircle className="w-4 h-4" /> Sbagliata</span>}
                <Button size="sm" variant="outline" className="gap-1" onClick={() => setSpiega(quiz)}><Sparkles className="w-3.5 h-3.5" /> Spiegamela</Button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" disabled={indice === 0} onClick={() => setIndice(i => i - 1)}><ChevronLeft className="w-4 h-4" /> Precedente</Button>
        {indice < prova.quiz.length - 1
          ? <Button size="sm" onClick={() => setIndice(i => i + 1)}>Successivo <ChevronRight className="w-4 h-4" /></Button>
          : <Button size="sm" className="gap-1" onClick={() => setConferma(true)}><Flag className="w-4 h-4" /> Consegna</Button>}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {prova.quiz.map((q, i) => {
          const data = !!scelte[q.id];
          let stile = data ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground';
          if (!simulazione && corrette[q.id]) stile = scelte[q.id] === q.esatta ? 'bg-emerald-600 text-white' : 'bg-red-500 text-white';
          return (
            <button key={q.id} type="button" onClick={() => setIndice(i)} className={`w-8 h-8 rounded text-xs font-medium ${stile} ${i === indice ? 'ring-2 ring-offset-1 ring-primary' : ''}`}>{i + 1}</button>
          );
        })}
      </div>
      {indice < prova.quiz.length - 1 && <div className="text-right"><Button variant="ghost" size="sm" onClick={() => setConferma(true)}>Consegna ora</Button></div>}

      <AlertDialog open={conferma} onOpenChange={setConferma}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Consegnare la prova?</AlertDialogTitle>
            <AlertDialogDescription>
              Hai risposto a {risposte} quiz su {prova.quiz.length}. {simulazione ? 'Le risposte non date valgono 0 punti, quelle sbagliate tolgono mezzo punto.' : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continua</AlertDialogCancel>
            <AlertDialogAction onClick={consegna}>Consegna</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {spiega && <Spiegazione quiz={spiega} scelta={scelte[spiega.id]} onClose={() => setSpiega(null)} />}
    </div>
  );
}

function Risultato({ esiti, onNuova }) {
  const [spiega, setSpiega] = useState(null);
  const [soloErrori, setSoloErrori] = useState(true);
  const simulazione = esiti[0]?.tipo === 'simulazione';
  const superata = simulazione && esiti.every(e => e.superata);
  return (
    <div className="space-y-4">
      {simulazione && (
        <div className={`rounded-xl border p-4 ${superata ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <p className={`font-semibold ${superata ? 'text-emerald-800' : 'text-red-700'}`}>{superata ? 'Verifica superata' : 'Verifica non superata'}</p>
          <p className="text-sm text-muted-foreground">Per superarla serve la soglia in ogni modulo.</p>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {esiti.map(e => (
          <div key={e.titolo} className="border rounded-xl p-4 bg-card">
            <p className="font-medium">{e.titolo}</p>
            <p className="text-3xl font-semibold tabular-nums mt-1">{numero(e.punteggio)}<span className="text-base text-muted-foreground font-normal">{e.soglia ? ` / soglia ${e.soglia}` : ` su ${e.quiz.length}`}</span></p>
            <p className="text-sm text-muted-foreground mt-1">{e.esatte} esatte · {e.errate} sbagliate · {e.omesse} non date · {durata(e.secondi)}</p>
            {e.soglia ? <Badge className="mt-2" variant={e.superata ? 'default' : 'destructive'}>{e.superata ? 'Superato' : 'Non superato'}</Badge> : null}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">Correzione</p>
        <Button variant="ghost" size="sm" onClick={() => setSoloErrori(v => !v)}>{soloErrori ? 'Mostra tutti i quiz' : 'Solo errori e non date'}</Button>
      </div>
      <div className="space-y-2">
        {esiti.flatMap(e => e.quiz.map(q => ({ q, scelta: e.scelte[q.id] || '' })))
          .filter(({ q, scelta }) => !soloErrori || scelta !== q.esatta)
          .map(({ q, scelta }) => (
            <div key={q.id} className="border rounded-lg p-3 bg-card text-sm space-y-1">
              <p className="font-medium flex gap-2">
                {scelta === q.esatta ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> : scelta ? <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /> : <MinusCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />}
                <span>{q.domanda}</span>
              </p>
              {scelta && scelta !== q.esatta && <p className="pl-6 text-red-600">La tua risposta: {scelta}</p>}
              <p className="pl-6 text-emerald-700">Esatta: {q.esatta}</p>
              <div className="pl-6 flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{q.materia}</span>
                <Button variant="ghost" size="sm" className="gap-1 h-7" onClick={() => setSpiega({ q, scelta })}><Sparkles className="w-3.5 h-3.5" /> Spiegamela</Button>
              </div>
            </div>
          ))}
      </div>
      <Button onClick={onNuova} className="gap-1"><RotateCcw className="w-4 h-4" /> Nuova esercitazione</Button>
      {spiega && <Spiegazione quiz={spiega.q} scelta={spiega.scelta} onClose={() => setSpiega(null)} />}
    </div>
  );
}

export default function EsercitazioneRT() {
  const { toast } = useToast();
  const [verifica, setVerifica] = useState('iniziale');
  const [modulo, setModulo] = useState('cat145');
  const [tipo, setTipo] = useState('simulazione');
  const [materia, setMateria] = useState('tutte');
  const [quanti, setQuanti] = useState('20');
  const [materie, setMaterie] = useState([]);
  const [storico, setStorico] = useState([]);
  const [caricamento, setCaricamento] = useState(false);
  const [prove, setProve] = useState(null);     // parti ancora da svolgere
  const [esiti, setEsiti] = useState([]);       // parti consegnate
  const [fase, setFase] = useState('scelta');

  const caricaStorico = useCallback(async () => {
    try {
      setStorico(await base44.entities.EsercitazioneRT.list('-created_date', 200));
    } catch (e) {
      console.error(e);
    }
  }, []);
  useEffect(() => { caricaStorico(); }, [caricaStorico]);

  // Materie della banca scelta per l'allenamento
  useEffect(() => {
    if (tipo !== 'allenamento') return;
    let attivo = true;
    const banche = verifica === 'aggiornamento' ? [bancaDi('aggiornamento', modulo)] : [bancaDi('iniziale', modulo, 'generale'), bancaDi('iniziale', modulo, 'specialistico')];
    Promise.all(banche.map(caricaBanca)).then(bs => {
      if (attivo) setMaterie([...new Set(bs.flatMap(b => b.materie))]);
    });
    return () => { attivo = false; };
  }, [tipo, verifica, modulo]);

  const daRipassare = useMemo(() => quizDaRipassare(storico), [storico]);

  const avvia = async () => {
    setCaricamento(true);
    try {
      if (tipo === 'simulazione') {
        const parti = partiVerifica(verifica, modulo);
        const preparate = [];
        for (const p of parti) {
          const b = await caricaBanca(p.banca);
          preparate.push({ ...p, tipo, verifica, titolo: p.titolo, quiz: estraiQuiz(b.quiz, REGOLE.quiz) });
        }
        setProve(preparate);
      } else if (tipo === 'allenamento') {
        const banche = verifica === 'aggiornamento' ? [bancaDi('aggiornamento', modulo)] : [bancaDi('iniziale', modulo, 'generale'), bancaDi('iniziale', modulo, 'specialistico')];
        const bs = await Promise.all(banche.map(caricaBanca));
        const tutti = bs.flatMap(b => b.quiz).filter(q => materia === 'tutte' || q.materia === materia);
        const quiz = mescola(tutti).slice(0, Number(quanti)).map(q => preparaQuiz(q));
        setProve([{ tipo, verifica, modulo, banca: banche.join(','), materia: materia === 'tutte' ? '' : materia, titolo: materia === 'tutte' ? 'Allenamento' : `Allenamento: ${materia}`, quiz }]);
      } else {
        const perBanca = new Map();
        for (const id of daRipassare) {
          const b = bancaDaId(id);
          if (!perBanca.has(b)) perBanca.set(b, []);
          perBanca.get(b).push(id);
        }
        const quiz = [];
        for (const [b, ids] of perBanca) {
          const banca = await caricaBanca(b);
          const set = new Set(ids);
          quiz.push(...banca.quiz.filter(q => set.has(q.id)));
        }
        setProve([{ tipo, verifica: '', modulo: '', banca: [...perBanca.keys()].join(','), titolo: 'Ripasso degli errori', quiz: mescola(quiz).slice(0, 20).map(q => preparaQuiz(q)) }]);
      }
      setEsiti([]);
      setFase('prova');
    } catch (e) {
      toast({ title: 'Impossibile avviare l\'esercitazione', description: e.message, variant: 'destructive' });
    } finally {
      setCaricamento(false);
    }
  };

  const consegna = async ({ scelte, secondi }) => {
    const p = prove[0];
    const risposte = p.quiz.map(q => ({ scelta: scelte[q.id] || '', esatta: q.esatta }));
    const conti = calcolaPunteggio(risposte);
    const esito = { ...p, ...conti, scelte, secondi, superata: p.soglia ? conti.punteggio >= p.soglia : null };
    const nuoviEsiti = [...esiti, esito];
    setEsiti(nuoviEsiti);
    try {
      const fine = new Date();
      await base44.entities.EsercitazioneRT.create({
        tipo: p.tipo,
        verifica: p.verifica || undefined,
        modulo: p.modulo,
        banca: p.banca,
        versione_banca: VERSIONE_BANCA,
        materia: p.materia || '',
        domande: p.quiz.length,
        esatte: conti.esatte,
        errate: conti.errate,
        omesse: conti.omesse,
        punteggio: conti.punteggio,
        soglia: p.soglia || null,
        superata: esito.superata,
        durata_secondi: secondi,
        iniziata_il: new Date(fine.getTime() - secondi * 1000).toISOString(),
        terminata_il: fine.toISOString(),
        risposte_json: JSON.stringify(p.quiz.map(q => ({ id: q.id, scelta: scelte[q.id] || '', ok: scelte[q.id] === q.esatta }))),
      });
      caricaStorico();
    } catch (e) {
      toast({ title: 'Risultato non salvato', description: e.message, variant: 'destructive' });
    }
    if (prove.length > 1) {
      setProve(prove.slice(1));
    } else {
      setProve(null);
      setFase('risultato');
    }
  };

  if (fase === 'prova' && prove) {
    return (
      <Prova
        key={prove[0].titolo + prove.length}
        prova={prove[0]}
        onConsegna={consegna}
        onAbbandona={() => { setProve(null); setFase('scelta'); }}
      />
    );
  }
  if (fase === 'risultato') {
    return <Risultato esiti={esiti} onNuova={() => { setEsiti([]); setFase('scelta'); }} />;
  }

  const simulazioni = storico.filter(e => e.tipo === 'simulazione');
  return (
    <div className="space-y-6">
      <div className="border rounded-xl p-4 bg-card space-y-4">
        <div className="flex items-start gap-3">
          <GraduationCap className="w-6 h-6 text-primary shrink-0" />
          <div>
            <p className="font-semibold">Esame di responsabile tecnico gestione rifiuti</p>
            <p className="text-sm text-muted-foreground">
              Quiz ufficiali dell'Albo Nazionale Gestori Ambientali (Delibera n. 6/2025, pubblicati il 19/12/2025). Ogni modulo: {REGOLE.quiz} quiz in {REGOLE.minuti} minuti,
              +1 per risposta esatta, −0,5 per sbagliata, 0 per non data. Soglie: modulo generale {SOGLIE.generale}, specialistico {SOGLIE.specialistico}, aggiornamento {SOGLIE.aggiornamento}.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Verifica</p>
            <Select value={verifica} onValueChange={setVerifica}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="iniziale">Iniziale (generale + specialistico)</SelectItem>
                <SelectItem value="aggiornamento">Aggiornamento quinquennale</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Modulo specialistico</p>
            <Select value={modulo} onValueChange={(v) => { setModulo(v); setMateria('tutte'); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MODULI.map(m => <SelectItem key={m.modulo} value={m.modulo}>{m.titolo} · {m.sottotitolo}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Modalità</p>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="simulazione">Simulazione d'esame</SelectItem>
                <SelectItem value="allenamento">Allenamento con correzione</SelectItem>
                <SelectItem value="ripasso" disabled={daRipassare.length === 0}>Ripasso degli errori ({daRipassare.length})</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {tipo === 'allenamento' && (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1 sm:col-span-2">
              <p className="text-xs font-medium text-muted-foreground">Materia</p>
              <Select value={materia} onValueChange={setMateria}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tutte">Tutte le materie</SelectItem>
                  {materie.map(m => <SelectItem key={m} value={m}>{m.length > 90 ? m.slice(0, 90) + '…' : m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Quanti quiz</p>
              <Select value={quanti} onValueChange={setQuanti}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['10', '20', '40'].map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          {tipo === 'simulazione' && (verifica === 'iniziale'
            ? `Due prove da ${REGOLE.quiz} quiz, prima il modulo generale e poi quello specialistico, estratti rispettando il peso delle materie.`
            : `Una prova da ${REGOLE.quiz} quiz del modulo di aggiornamento, che comprende anche domande generali.`)}
          {tipo === 'allenamento' && 'Nessun limite di tempo: dopo ogni risposta vedi subito se è giusta e puoi chiedere la spiegazione all\'Assistente.'}
          {tipo === 'ripasso' && 'I quiz sbagliati o saltati nelle esercitazioni precedenti, finché non li indovini.'}
        </p>
        <Button onClick={avvia} disabled={caricamento || (tipo === 'ripasso' && daRipassare.length === 0)} className="gap-2">
          {caricamento ? <Loader2 className="w-4 h-4 animate-spin" /> : <GraduationCap className="w-4 h-4" />} Inizia
        </Button>
      </div>

      <div className="space-y-2">
        <p className="font-medium">Le tue esercitazioni</p>
        {storico.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessuna esercitazione ancora.</p>
        ) : (
          <div className="border rounded-lg overflow-x-auto bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left">
                <tr>
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">Modalità</th>
                  <th className="px-3 py-2">Modulo</th>
                  <th className="px-3 py-2 text-right">Punteggio</th>
                  <th className="px-3 py-2 text-right">Esatte</th>
                  <th className="px-3 py-2">Esito</th>
                </tr>
              </thead>
              <tbody>
                {storico.slice(0, 15).map(e => (
                  <tr key={e.id} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap">{dataOra(e.terminata_il || e.created_date)}</td>
                    <td className="px-3 py-2">{e.tipo === 'simulazione' ? 'Simulazione' : e.tipo === 'allenamento' ? 'Allenamento' : 'Ripasso'}</td>
                    <td className="px-3 py-2">{e.modulo === 'generale' ? 'Generale' : (MODULI.find(m => m.modulo === e.modulo)?.titolo || '—')}{e.verifica === 'aggiornamento' ? ' (aggiornamento)' : ''}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{numero(e.punteggio)}{e.soglia ? ` / ${e.soglia}` : ''}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{e.esatte}/{e.domande}</td>
                    <td className="px-3 py-2">{e.soglia ? <Badge variant={e.superata ? 'default' : 'destructive'}>{e.superata ? 'Superato' : 'Non superato'}</Badge> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {simulazioni.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Simulazioni superate: {simulazioni.filter(e => e.superata).length} su {simulazioni.length}.
          </p>
        )}
      </div>
    </div>
  );
}
