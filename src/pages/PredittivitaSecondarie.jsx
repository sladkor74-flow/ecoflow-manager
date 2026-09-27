import React, { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Loader2, CalendarCheck, Factory, Warehouse, CalendarRange, Settings, Bot, AlertTriangle, ChevronDown, ChevronRight, Lock, RefreshCw } from 'lucide-react';
import ProgrammaSettimana from '@/components/predittivita/ProgrammaSettimana';
import SchedaImpianti from '@/components/predittivita/SchedaImpianti';
import SchedaStoccaggi from '@/components/predittivita/SchedaStoccaggi';
import SchedaSettimane from '@/components/predittivita/SchedaSettimane';
import EsportaSituazione from '@/components/predittivita/EsportaSituazione';
import PredittivitaImpiantiManager from '@/components/predittivita/PredittivitaImpiantiManager';
import PredittivitaAgent from '@/components/predittivita/PredittivitaAgent';
import { it, testoErrore, avvisiDaMostrare, Vuoto } from '@/components/predittivita/Comuni';
import { usePermessi } from '@/lib/permessi';
import { oggiRoma } from '@/lib/giornoItaliano';

// La predittivita' delle secondarie, un anno alla volta (26/09/2026): parte
// dall'ancora delle giacenze al 31/12 dell'anno prima, sola rete, per fine
// trasporto. Un motore solo (base44/shared/predittivita.ts), letto dalla
// funzione calcolaPianificazioneSecondaria, da cui escono tutte le schede.
// Il 1 gennaio la pagina mostra l'anno nuovo; gli anni chiusi si riaprono in
// sola lettura scegliendo l'anno.

// L'anno in cui la predittivita' e' nata: prima non c'e' una configurazione.
const PRIMO_ANNO = 2026;
// I caricamenti che cambiano i numeri, e quanto si aspetta dopo che si sono
// chiusi: la registrazione finale arriva un momento dopo l'ultima scrittura.
const TIPI_RICALCOLO = ['primarie', 'primarie_rete', 'secondarie'];
const ATTESA_RICALCOLO_MS = 4000;
const NOMI_TIPI = { primarie: 'primarie', primarie_rete: 'primarie di rete', secondarie: 'secondarie' };

const annoCorrente = () => Number(oggiRoma().slice(0, 4));

/** La risposta del calcolo, o null se non ha la forma attesa. */
function rispostaValida(d) {
  const r = d && d.risposta && Array.isArray(d.risposta.impianti) ? d.risposta : d;
  return r && Array.isArray(r.impianti) && Array.isArray(r.programma) && Array.isArray(r.stoccaggi) && Array.isArray(r.settimane) ? r : null;
}

/** Il caricamento in corso, i gravi in evidenza, gli altri compatti e da aprire. */
function Avvisi({ risposta, aperti }) {
  const [apri, setApri] = useState(false);
  // gli stessi del PDF; quello dei dati incompleti sta nella riga "Dati caricati fino al"
  const { caricamento, gravi, altri } = avvisiDaMostrare(risposta);
  const locali = caricamento.length ? [] : aperti;
  return (
    <div className="space-y-2">
      {caricamento.map((a, n) => (
        <div key={`c${n}`} className="flex items-start gap-2 text-sm text-amber-900 bg-amber-50 border-2 border-amber-400 rounded-lg px-3 py-2">
          <Loader2 className="w-4 h-4 mt-0.5 shrink-0 animate-spin" />
          <span>{a.testo}</span>
        </div>
      ))}
      {locali.length > 0 && (
        <div className="flex items-start gap-2 text-sm text-amber-900 bg-amber-50 border-2 border-amber-400 rounded-lg px-3 py-2">
          <Loader2 className="w-4 h-4 mt-0.5 shrink-0 animate-spin" />
          <span>
            È in corso un caricamento di {[...new Set(locali.map(x => NOMI_TIPI[x.tipo_file] || x.tipo_file))].join(' e ')}
            {locali.some(x => x.utente) ? ` (${[...new Set(locali.map(x => x.utente).filter(Boolean))].join(', ')})` : ''}:
            i numeri possono cambiare, la pagina si ricalcola da sola quando finisce.
          </span>
        </div>
      )}
      {gravi.map((a, n) => (
        <div key={`g${n}`} className="flex items-start gap-2 text-sm text-red-900 bg-red-50 border border-red-300 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{a.testo}</span>
        </div>
      ))}
      {altri.length > 0 && (
        <div className="border border-amber-300 bg-amber-50/60 rounded-lg">
          <button type="button" onClick={() => setApri(v => !v)} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-amber-900 text-left">
            {apri ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <AlertTriangle className="w-4 h-4" />
            <span className="font-medium">Da guardare ({altri.length})</span>
            {!apri && <span className="truncate text-xs text-amber-800/80">{altri[0].testo}</span>}
          </button>
          {apri && (
            <ul className="text-sm text-amber-900 space-y-1 list-disc pl-9 pr-3 pb-2">
              {altri.map((a, n) => <li key={`${a.tipo}-${n}`}>{a.testo}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function PredittivitaSecondarie() {
  const { isAdmin } = usePermessi();
  const corrente = annoCorrente();
  const [anno, setAnno] = useState(corrente);
  const [tab, setTab] = useState('programma');
  const [risposta, setRisposta] = useState(null);
  const [errore, setErrore] = useState(null);
  const [ricalcolo, setRicalcolo] = useState(false);
  const [aperti, setAperti] = useState({}); // caricamenti aperti visti arrivare: id -> { tipo_file, utente }

  // Un calcolo alla volta: se ne serve un altro mentre il primo e' in volo, si
  // rifa' appena finisce. Le risposte si numerano: una piu' vecchia di quella
  // gia' mostrata (per esempio un ricalcolo partito prima di "Fissa") si scarta.
  const annoRef = useRef(anno);
  const inVolo = useRef(false);
  const daRifare = useRef(false);
  const numero = useRef(0);
  const applicato = useRef(0);

  const applica = useCallback((n, r) => {
    if (n < applicato.current || Number(r.anno) !== annoRef.current) return false;
    applicato.current = n;
    setRisposta(r);
    setErrore(null);
    return true;
  }, []);

  const carica = useCallback(async () => {
    if (inVolo.current) { daRifare.current = true; return; }
    inVolo.current = true;
    setRicalcolo(true);
    do {
      daRifare.current = false;
      const a = annoRef.current;
      const n = ++numero.current;
      try {
        const res = await base44.functions.invoke('calcolaPianificazioneSecondaria', { anno: a });
        if (a !== annoRef.current) { daRifare.current = true; continue; }
        const r = rispostaValida(res.data);
        if (!r) throw new Error((res.data && res.data.error) || 'la risposta del calcolo non ha la forma attesa');
        applica(n, r);
      } catch (e) {
        if (a === annoRef.current && n >= applicato.current) setErrore(testoErrore(e));
      }
    } while (daRifare.current);
    inVolo.current = false;
    setRicalcolo(false);
  }, [applica]);

  const caricaRef = useRef(carica);
  caricaRef.current = carica;

  useEffect(() => {
    annoRef.current = anno;
    setRisposta(null);
    setErrore(null);
    carica();
  }, [anno, carica]);

  // Ricalcolo a ogni caricamento concluso di primarie o secondarie, dopo una
  // breve attesa; piu' caricamenti vicini fanno un calcolo solo.
  useEffect(() => {
    let attesa = null;
    const unsubscribe = base44.entities.UploadLog.subscribe((event) => {
      const d = event && event.data;
      if (!d || !TIPI_RICALCOLO.includes(d.tipo_file) || (event.type !== 'create' && event.type !== 'update')) return;
      const id = d.id || event.id;
      if (d.esito === 'in_corso') {
        setAperti(m => ({ ...m, [id]: { tipo_file: d.tipo_file, utente: d.utente } }));
        return;
      }
      setAperti(m => { if (!(id in m)) return m; const x = { ...m }; delete x[id]; return x; });
      clearTimeout(attesa);
      attesa = setTimeout(() => caricaRef.current(), ATTESA_RICALCOLO_MS);
    });
    return () => { clearTimeout(attesa); if (typeof unsubscribe === 'function') unsubscribe(); };
  }, []);

  // "Fissa il programma": la funzione scrive e risponde con la situazione aggiornata.
  // Un ricalcolo partito durante il salvataggio (il pulsante, o un caricamento
  // che si chiude) puo' aver letto il programma prima della scrittura: se la sua
  // risposta ha preso il posto di questa, o se e' ancora in volo, se ne fa un
  // altro, che legge il programma appena fissato. Lo stesso se la funzione ha
  // salvato ma non ha potuto rileggere.
  const fissa = async ({ settimana, righe }) => {
    const n = ++numero.current;
    const res = await base44.functions.invoke('calcolaPianificazioneSecondaria', { azione: 'fissa', anno, settimana, righe });
    const r = rispostaValida(res.data);
    if (!r) {
      if (res.data && res.data.error) throw new Error(res.data.error);
      carica();
      return;
    }
    const mostrata = applica(n, r);
    if (!mostrata || inVolo.current || (r.avvisi || []).some(a => a.tipo === 'programma_non_riletto')) carica();
  };

  const anni = [];
  for (let a = corrente; a >= Math.min(PRIMO_ANNO, corrente); a--) anni.push(a);
  const chiuso = anno < corrente;
  const schedaAttiva = !isAdmin && tab === 'config' ? 'programma' : tab;

  // Le quattro schede dei numeri: finche' il calcolo non c'e' si aspetta, o si
  // dice perche' manca. Configurazione e Assistente restano usabili comunque.
  const conDati = (Scheda) => {
    if (!risposta) {
      if (errore) {
        return (
          <div className="text-center py-10 space-y-3 border rounded-lg">
            <p className="text-red-700 font-medium">Il calcolo non è riuscito: {errore}</p>
            <Button onClick={carica} disabled={ricalcolo}>{ricalcolo && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Riprova</Button>
            <p className="text-xs text-muted-foreground">Configurazione e Assistente funzionano lo stesso.</p>
          </div>
        );
      }
      return <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin inline" /><p className="text-sm text-muted-foreground mt-2">Calcolo del {anno} in corso…</p></div>;
    }
    if (risposta.configurazione_vuota) {
      return <Vuoto>Per il {risposta.anno} non ci sono impianti seguiti con un target.{isAdmin && !risposta.sola_lettura ? ' Aggiungili nella scheda Configurazione.' : ''}</Vuoto>;
    }
    return <Scheda risposta={risposta} onFissa={fissa} isAdmin={isAdmin} />;
  };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl lg:text-3xl font-heading font-bold">Predittività delle secondarie</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            Solo rete. Il già arrivato di un impianto sono le primarie arrivate all&apos;impianto e al suo piazzale
            (tolto quello che riparte per altri impianti) più le secondarie da altri stoccaggi.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-sm text-muted-foreground flex items-center gap-1.5">
            Anno
            <select
              value={anno}
              onChange={e => setAnno(Number(e.target.value))}
              className="border rounded-md px-2 h-9 text-sm bg-background text-foreground"
            >
              {anni.map(a => <option key={a} value={a}>{a}{a < corrente ? ' (chiuso, sola lettura)' : ' (in corso)'}</option>)}
            </select>
          </label>
          <Button size="sm" variant="ghost" onClick={carica} disabled={ricalcolo} title="Ricalcola adesso">
            <RefreshCw className={`w-4 h-4 ${ricalcolo ? 'animate-spin' : ''}`} />
          </Button>
          <EsportaSituazione risposta={risposta} />
        </div>
      </div>

      {chiuso && (
        <div className="flex items-start gap-2 text-sm bg-muted border rounded-lg px-3 py-2">
          <Lock className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Il {anno} è chiuso: lo vedi com&apos;era al 31/12/{anno}, in sola lettura. Niente si cancella.</span>
        </div>
      )}

      {risposta && (
        <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-sm">
          <span>Dati caricati fino al <strong>{it(risposta.dati_al)}</strong></span>
          {!risposta.sola_lettura && !risposta.settimana_scorsa_completa && (
            <span className="text-amber-800 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" /> La settimana scorsa potrebbe non essere ancora tutta caricata: i numeri possono crescere.
            </span>
          )}
          {risposta.fine && <span className="text-muted-foreground">Programmazione fino al {it(risposta.fine)}</span>}
          {ricalcolo && <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />ricalcolo…</span>}
        </div>
      )}

      {risposta && errore && (
        <div className="text-sm text-red-900 bg-red-50 border border-red-300 rounded-lg px-3 py-2 flex items-start gap-2 flex-wrap">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="flex-1">L&apos;ultimo ricalcolo non è riuscito ({errore}): i numeri sono quelli di prima.</span>
          <Button size="sm" variant="outline" onClick={carica} disabled={ricalcolo}>Riprova</Button>
        </div>
      )}

      <Avvisi risposta={risposta} aperti={Object.values(aperti)} />

      <Tabs value={schedaAttiva} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="programma"><CalendarCheck className="w-4 h-4 mr-1.5" /> Programma della settimana</TabsTrigger>
          <TabsTrigger value="impianti"><Factory className="w-4 h-4 mr-1.5" /> Impianti</TabsTrigger>
          <TabsTrigger value="stoccaggi"><Warehouse className="w-4 h-4 mr-1.5" /> Stoccaggi</TabsTrigger>
          <TabsTrigger value="settimane"><CalendarRange className="w-4 h-4 mr-1.5" /> Settimane</TabsTrigger>
          {isAdmin && <TabsTrigger value="config"><Settings className="w-4 h-4 mr-1.5" /> Configurazione</TabsTrigger>}
          <TabsTrigger value="agente"><Bot className="w-4 h-4 mr-1.5" /> Assistente</TabsTrigger>
        </TabsList>
        {/* resta montata: i viaggi corretti a mano non si perdono passando a un'altra scheda */}
        <TabsContent value="programma" forceMount className="mt-4 data-[state=inactive]:hidden">{conDati(ProgrammaSettimana)}</TabsContent>
        <TabsContent value="impianti" className="mt-4">{conDati(SchedaImpianti)}</TabsContent>
        <TabsContent value="stoccaggi" className="mt-4">{conDati(SchedaStoccaggi)}</TabsContent>
        <TabsContent value="settimane" className="mt-4">{conDati(SchedaSettimane)}</TabsContent>
        {isAdmin && (
          <TabsContent value="config" className="mt-4">
            {/* una per anno: niente di un anno resta a video, modificabile, quando si passa a un altro */}
            <PredittivitaImpiantiManager key={anno} anno={anno} solaLettura={chiuso} onReload={carica} />
          </TabsContent>
        )}
        <TabsContent value="agente" className="mt-4"><PredittivitaAgent /></TabsContent>
      </Tabs>
    </div>
  );
}
