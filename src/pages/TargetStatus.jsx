import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { MESI } from '@/lib/pfuConstants';
import { exportExcel, exportPDF, exportPPT } from '@/lib/statusExports';
import KpiCards, { variazioniPerLaCard } from '@/components/target-status/KpiCards';
import TargetTable from '@/components/target-status/TargetTable';
import RegionTable from '@/components/target-status/RegionTable';
import ImpiantiTable from '@/components/target-status/ImpiantiTable';
import TargetChart from '@/components/target-status/TargetChart';
import ExportButtons from '@/components/target-status/ExportButtons';
import ReportGenerale from '@/components/target-status/ReportGenerale';
import CanaleAci from '@/components/target-status/CanaleAci';
import { RiepilogoDate } from '@/components/primarie-rete/DateDaSistemare';
import MultiSelect from '@/components/shared/MultiSelect';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/AuthContext';
import { fetchAllClient } from '@/lib/fetchAllClient';
import { tonnellate, percentuale, anniTarget } from '@/lib/target';
import { annoCorrenteRoma, annoChiuso, commessaDellAnno } from '@/lib/annoTarget';
import { righeAndamento, targetMensiliValidi } from '@/lib/andamentoTarget';
// i target copiati dell'anno, per la frase sopra la tabella per raccoglitore (15/10/2026)
import { targetCopiatiDellAnno } from '@/lib/andamentoTarget';
import { filtraRaccolto } from '@/lib/raccoltoFiltrato';
import { targetAnnuoDellAnno, regioniDellAnno, attesoDellaRegione, profiloMensile, frazioneDelMese, giornoDeiDati, giornoDellaMisura, variazioniDelContratto } from '@/lib/attesoContratto';
import { oggiRoma, giornoRoma } from '@/lib/giornoItaliano';
import { useTargetCambiati, testoRilettura, oraRoma } from '@/lib/eventiDati';
import { Loader2, RefreshCw, Filter, X, Lock } from 'lucide-react';

// LE SCHEDE SI SCARICANO QUANDO SI APRONO (14/10/2026).
//
// La pagina si apre sull'Andamento, e le altre cinque schede - target dei
// raccoglitori, commessa, impianti e stoccaggi, zone, nuovo anno - erano tutte
// nel suo pacchetto: circa 280 kB, coi loro elenchi a tendina e lo storico delle
// modifiche, che chi guarda l'Andamento non usa. Ora ciascuna e' un file a
// parte, scaricato la prima volta che la si apre, come le pagine in App.jsx;
// nell'attesa la scheda mostra il cerchio che gira e le linguette restano a
// video. Gli altri 385 kB erano la presentazione (pptxgenjs, ora presa dentro
// exportPPT in statusExports.js). La prima apertura della pagina, avvio
// compreso, passa da 1.221 a 556 kB: prova in prove/pacchettiLeggeri.mjs.
const TargetRaccoglitoriGrid = lazy(() => import('@/components/target-status/TargetRaccoglitoriGrid'));
const CommessaEcotyreForm = lazy(() => import('@/components/target-status/CommessaEcotyreForm'));
const ConfigurazioneImpianti = lazy(() => import('@/components/target-status/ConfigurazioneImpianti'));
const ZoneRaccoglitori = lazy(() => import('@/components/target-status/ZoneRaccoglitori'));
const NuovoAnno = lazy(() => import('@/components/target-status/NuovoAnno'));
const AttesaScheda = () => (
  <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Apertura della scheda…</div>
);

// Target & Status: unico punto in cui si scrivono i target.
// RETE, ACI ed Extra Raccolta sono canali indipendenti: i target si confrontano
// solo con la RETE e l'ACI si guarda a parte, contro la previsione del suo contratto.
// - Andamento: target contro raccolto per raccoglitore, regione e impianto, e il
//   raccolto per regione confrontato con il contratto. Solo lettura.
// - Target raccoglitori: annuo e mensile per raccoglitore, regione e impianto.
// - Commessa Ecotyre: quanto richiede il contratto.
// - Impianti e stoccaggi: impianti col target, stoccaggi con plafond e priorita',
//   fine della programmazione e chili per viaggio dell'anno.
// Tutti gli altri moduli leggono questi dati.
//
// Si lavora un anno alla volta, dal 2025 all'anno prossimo (27/09/2026). Un anno
// chiuso (prima di quello in corso, a Roma) e' in sola lettura in tutte le
// schede; chi non e' amministratore consulta soltanto.

// 'zone' c'era come linguetta ma non in questo elenco: cliccandola la pagina
// tornava sempre ad Andamento, e la scheda non si apriva (06/10/2026).
const SCHEDE = ['andamento', 'raccoglitori', 'commessa', 'impianti', 'zone', 'nuovo-anno'];
// Un giorno 'AAAA-MM-GG' come gg/mm, per «atteso al 07/10».
const giornoMese = (g) => (g ? `${g.slice(8, 10)}/${g.slice(5, 7)}` : '');

// Raccolto per regione confrontato con il contratto. L'atteso alla data segue il
// profilo del target mensile del contratto riportato all'annuo (o i dodicesimi),
// e il mese dei dati conta per i giorni che i dati coprono, non per il giorno del
// dispositivo: la regola e' attesoAllaData (src/lib/attesoContratto.js), la
// stessa della Dashboard e del controllo dei target mensili (chiusura
// dell'audit, 11/10/2026). Prima qui si contava sull'orologio del dispositivo:
// con i dati fermi al 7 e oggi il 10, lo scarto era peggiore di tre giorni di
// raccolta.
// L'atteso di ogni regione e' attesoDellaRegione (revisione del 14/10/2026): una
// variazione del consorzio conta intera nel suo mese e nella sua regione. Col
// target della regione per la quota nazionale le 100 t di ottobre della Puglia
// si spalmavano sul suo anno e cambiavano l'atteso delle altre regioni.
// IL GIORNO DELLA MISURA (prova generale del cambio d'anno, 15/10/2026):
// qui giornoDati e' il giorno della misura dell'anno (giornoDellaMisura,
// src/lib/attesoContratto.js), che la pagina calcola, e non piu' l'ultima fine
// trasporto di qualunque anno. Il 05/01/2027, coi dati fermi al 30/12/2026, il
// 2027 scriveva «Atteso al 30/12 (t)» con 0,00 e lo scarto +0,00 in verde in
// tutte le regioni, e il 2026 «Atteso al 30/12» invece del 31/12. Ora il 2027
// senza ritiri suoi dice «—» col perche', e un anno chiuso si misura al 31/12.
// ultimoRitiro (l'ultima fine trasporto caricata) serve solo a dire perche'
// l'atteso manca.
export function AndamentoRegioni({ raccolto, commessa, anno, giornoDati, ultimoRitiro = '' }) {
  const { righe: regioni, fonte } = regioniDellAnno(commessa, anno);
  if (!regioni.length) {
    return <p className="text-sm text-muted-foreground border rounded-lg px-4 py-3">Inserisci o importa il contratto del {anno} nella scheda Commessa Ecotyre per confrontare il raccolto di ogni regione con quanto richiesto.</p>;
  }
  const profilo = profiloMensile(commessa);
  // Le variazioni del consorzio sono gia' nei numeri del contratto (14/10/2026):
  // sotto la tabella si dice quali sono, perche' il contratto non e' piu' quello
  // inserito a inizio anno. Solo quelle che il contratto comprende ancora.
  const variazioni = variazioniDelContratto(commessa).filter(v => v.in_vigore);
  const perRegione = new Map((raccolto?.by_regione || []).map(r => [String(r.regione).toLowerCase(), r]));
  const righe = regioni.map(r => {
    const racc = perRegione.get(String(r.regione).toLowerCase());
    const contratto = Number(r.target_t) || 0;
    const raccoltoT = racc ? racc.totale : 0;
    const atteso = attesoDellaRegione(commessa, anno, giornoDati, r.regione).atteso_t;
    return { ...r, contratto, raccolto: raccoltoT, atteso, percentuale: contratto ? (raccoltoT / contratto) * 100 : null, scarto: atteso === null ? null : raccoltoT - atteso };
  });
  const somma = (k) => (righe.some(r => r[k] === null) ? null : righe.reduce((s, r) => s + r[k], 0));
  const tot = { contratto: somma('contratto'), raccolto: somma('raccolto'), atteso: somma('atteso') };
  const scartoTot = tot.atteso === null ? null : tot.raccolto - tot.atteso;
  const conSegno = (v) => (v === null ? '—' : `${v >= 0 ? '+' : ''}${tonnellate(v)}`);
  // un anno chiuso: l'atteso e' il contratto intero, al 31/12
  const chiusoAl31 = !!giornoDati && giornoDati === `${anno}-12-31` && annoChiuso(anno);
  const colore = (v) => (v === null ? 'text-muted-foreground' : v >= 0 ? 'text-emerald-700' : 'text-red-600');
  return (
    <div className="border rounded-lg overflow-x-auto bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-left">
          <tr>
            <th className="px-3 py-2">Regione</th>
            <th className="px-3 py-2">Province</th>
            <th className="px-3 py-2 text-right">Contratto (t)</th>
            <th className="px-3 py-2 text-right">Raccolto {anno} (t)</th>
            <th className="px-3 py-2 text-right">% del contratto</th>
            <th className="px-3 py-2 text-right">{giornoDati ? `Atteso al ${giornoMese(giornoDati)} (t)` : 'Atteso (t)'}</th>
            <th className="px-3 py-2 text-right">Scarto sull'atteso (t)</th>
          </tr>
        </thead>
        <tbody>
          {righe.map(r => (
            <tr key={r.regione} className="border-t">
              <td className="px-3 py-2 font-medium">{r.regione}</td>
              <td className="px-3 py-2 text-xs text-muted-foreground">{r.province || '—'}</td>
              <td className="px-3 py-2 text-right tabular-nums">{tonnellate(r.contratto)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{tonnellate(r.raccolto)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.percentuale !== null ? `${percentuale(r.percentuale)}%` : '—'}</td>
              <td className="px-3 py-2 text-right tabular-nums">{tonnellate(r.atteso)}</td>
              <td className={`px-3 py-2 text-right tabular-nums font-medium ${colore(r.scarto)}`}>{conSegno(r.scarto)}</td>
            </tr>
          ))}
          <tr className="border-t-2 font-semibold bg-muted/30">
            <td className="px-3 py-2" colSpan={2}>Totale</td>
            <td className="px-3 py-2 text-right tabular-nums">{tonnellate(tot.contratto)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{tonnellate(tot.raccolto)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{tot.contratto ? `${percentuale((tot.raccolto / tot.contratto) * 100)}%` : '—'}</td>
            <td className="px-3 py-2 text-right tabular-nums">{tonnellate(tot.atteso)}</td>
            <td className={`px-3 py-2 text-right tabular-nums ${colore(scartoTot)}`}>{conSegno(scartoTot)}</td>
          </tr>
        </tbody>
      </table>
      <p className="px-3 py-2 text-xs text-muted-foreground border-t">
        Raccolto del solo canale RETE dai formulari terminati, per data di fine trasporto: l&apos;ACI è nella sezione Canale ACI.
        {chiusoAl31
          ? ` Il ${anno} è chiuso: l'atteso è il contratto intero di ogni regione, al 31/12, qualunque sia l'ultimo ritiro caricato.`
          : giornoDati
            ? ` L'atteso è quanto il contratto di ogni regione chiede fino al ${giornoMese(giornoDati)}, il giorno fin dove arrivano i dati (l'ultima fine trasporto caricata, mai oltre oggi): i mesi finiti interi, quello in corso per i giorni coperti.`
            : ultimoRitiro
              ? ` L'atteso non si calcola: nessun ritiro del ${anno} è ancora terminato (non è zero).`
              : " L'atteso non si calcola: non c'è ancora nessun ritiro terminato con la fine trasporto."}
        {profilo.rivisto
          ? ` Segue il target mensile del contratto, riportato all'annuo (il profilo scritto somma ${tonnellate(profilo.totale)} t).`
          : ' Il target mensile del contratto non è inserito: per ora in dodicesimi.'}
        {" Scarto positivo: avanti sull'atteso; negativo: indietro."}
        {fonte === 'ripiego' && ` Il contratto del ${anno} non ha il riparto per regione: questo è quello scritto nel gestionale come ripiego, va inserito nella scheda Commessa Ecotyre.`}
        {variazioni.length > 0 && ` Il contratto comprende le variazioni del consorzio registrate nella scheda Commessa Ecotyre: ${variazioni.map(v => `${v.mese.toLowerCase()}, ${v.regione} ${v.t > 0 ? '+' : ''}${tonnellate(v.t)} t (${v.motivo})`).join('; ')}. Nell'atteso ognuna conta intera nel suo mese e nella sua regione: le altre regioni non cambiano.`}
      </p>
    </div>
  );
}

export default function TargetStatus() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [params, setParams] = useSearchParams();
  const scheda = SCHEDE.includes(params.get('tab')) ? params.get('tab') : 'andamento';
  const anni = useMemo(() => anniTarget(), []);
  // L'anno si tiene nell'indirizzo (?anno=), cosi' un collegamento da un altro
  // modulo apre l'anno giusto.
  const annoIndirizzo = Number(params.get('anno'));
  const anno = anni.includes(annoIndirizzo) ? annoIndirizzo : annoCorrenteRoma();
  const chiuso = annoChiuso(anno);
  const puoScrivere = isAdmin && !chiuso;
  // La commessa si scrive tutta e si salva con un pulsante: chi cambia anno o
  // scheda con modifiche non salvate le perderebbe, e allora glielo si chiede.
  const [commessaModificata, setCommessaModificata] = useState(false);
  const vaiA = (tab, a) => {
    if (commessaModificata && (tab !== scheda || a !== anno)
      && !window.confirm(`La commessa Ecotyre del ${anno} ha modifiche non salvate: se cambi ${a !== anno ? 'anno' : 'scheda'} si perdono. Vuoi continuare?`)) return;
    if (tab !== scheda || a !== anno) setCommessaModificata(false);
    setParams({ tab, anno: String(a) }, { replace: true });
  };
  const setAnno = (a) => vaiA(scheda, a);
  // IL RACCOLTO DELL'ANNO SI LEGGE SENZA FILTRI (segnalazione alta del 20/09,
  // corretta il 12/10/2026). I filtri della scheda entravano nella chiamata, e
  // le card dell'anno, la tabella per contratto e il Report generale ricevevano
  // il raccolto filtrato: con Mese = Settembre il «Residuo dell'anno» era il
  // contratto meno settembre. Ora raccoltoAnno e' l'anno intero del canale RETE
  // e va a quei tre; raccolto e' lo stesso con i filtri applicati in memoria
  // (filtraRaccolto, src/lib/raccoltoFiltrato.js) e va alle tabelle che li
  // prevedono. Un filtro cambiato non fa piu' una chiamata.
  const [raccoltoAnno, setRaccoltoAnno] = useState(null);
  const [raccoltoAci, setRaccoltoAci] = useState(null);
  const [targets, setTargets] = useState([]);
  const [annui, setAnnui] = useState([]);
  const [commessa, setCommessa] = useState(null);
  // Il giorno fin dove arrivano i dati della rete: l'ultima fine trasporto di un
  // terminato, mai oltre oggi (giornoDeiDati). '' se non si sa.
  const [giornoDati, setGiornoDati] = useState('');
  const [loading, setLoading] = useState(false);
  // La riga che dice che l'Andamento si e' riletto per un cambio fatto in
  // un'altra scheda (14/10/2026, vedi useTargetCambiati qui sotto).
  const [riletto, setRiletto] = useState(null);
  // Il mese di oggi e' quello italiano, non quello del dispositivo (11/10/2026).
  const meseDiOggi = MESI[Number(oggiRoma().slice(5, 7)) - 1];
  const [meseSelezionato, setMeseSelezionato] = useState(meseDiOggi);
  const [filters, setFilters] = useState({ mese: [], regione: [], raccoglitore: [], impianto: [] });
  // Le letture si numerano: una superata (l'anno o i filtri sono cambiati nel
  // frattempo) non tocca niente, cosi' i target di un altro anno non restano a
  // video e non si scrivono su quello sbagliato.
  const ultimaLettura = useRef(0);
  const raccolto = useMemo(() => filtraRaccolto(raccoltoAnno, filters), [raccoltoAnno, filters]);

  const leggiTutto = useCallback(async () => {
    const n = ++ultimaLettura.current;
    setLoading(true);
    // la riga di una rilettura parziale (qui sotto) non vale piu': si rilegge tutto
    setRiletto(null);
    try {
      // Il target mensile per impianto (ImpiantoTarget) non si legge piu': non
      // l'ha mai scritto nessuno, e la tabella mostrava zero con un delta verde
      // (chiusura dell'audit, 11/10/2026). Il target dell'impianto e' quello di
      // Impianti e stoccaggi, e si confronta in Giacenze.
      const [raccoltoRes, aciRes, targetRes, annuiRes, commessaRes, ultimeFini] = await Promise.all([
        base44.functions.invoke('computeRaccolto', { filters: { anno: [anno], canale: 'rete' } }),
        base44.functions.invoke('computeRaccolto', { filters: { anno: [anno], canale: 'aci' } }).catch(() => null),
        fetchAllClient(base44.entities.TargetMensile, { anno }),
        fetchAllClient(base44.entities.TargetRaccoglitore, { anno }),
        base44.entities.CommessaEcotyre.filter({ anno }).catch(() => []),
        // le ultime fini trasporto della rete: dicono fin dove arrivano i dati
        base44.entities.PrimariaRete.filter({ stato: 'terminato' }, '-trasporto_finito_il', 5).catch(() => []),
      ]);
      if (n !== ultimaLettura.current) return;
      setRaccoltoAnno(raccoltoRes.data);
      setRaccoltoAci(aciRes ? aciRes.data : null);
      setTargets(targetRes);
      setAnnui(annuiRes);
      setCommessa(commessaDellAnno(commessaRes, anno));
      setGiornoDati(giornoDeiDati((ultimeFini || []).map(r => giornoRoma(r.trasporto_finito_il)).filter(Boolean).sort().pop() || '', oggiRoma()));
    } catch (e) {
      if (n !== ultimaLettura.current) return;
      console.error(e);
    }
    setLoading(false);
  }, [anno]);
  // La lettura intera in volo: una rilettura dei target la aspetta, perche' i
  // suoi numeri potrebbero essere di prima del cambio e arrivare dopo.
  const letturaInCorso = useRef(null);
  const loadData = useCallback(() => {
    const lettura = leggiTutto();
    letturaInCorso.current = lettura;
    return lettura;
  }, [leggiTutto]);

  useEffect(() => { if (scheda === 'andamento') loadData(); }, [scheda, loadData]);

  // IL CONTRATTO O I TARGET CAMBIATI IN UN'ALTRA SCHEDA (14/10/2026, richiesta
  // dell'utente: «fai in modo che quando si faccia una tale variazione i moduli
  // collegati come la dashboard si aggiornino di conseguenza»). Nella stessa
  // scheda l'Andamento si rilegge intero quando ci si torna (l'effetto qui
  // sopra): una variazione registrata nella scheda Commessa e' gia' nei numeri.
  // Aperto in un'altra scheda del browser, invece, restava col contratto letto
  // all'apertura. Ora, a un cambio dell'anno a video annunciato da chi scrive
  // (src/lib/eventiDati.js), l'Andamento rilegge solo la parte toccata - il
  // contratto, i target annui o i target mensili dei raccoglitori - e non il
  // raccolto, che non e' cambiato: card, tabella per regione e contratto,
  // Report generale, tabelle per raccoglitore e per regione e Canale ACI
  // ripartono da li'. Una volta per raffica, a scheda visibile; chi e' su
  // un'altra scheda della pagina non rilegge, perche' tornando all'Andamento
  // la pagina rilegge tutto.
  const attuale = useRef({ anno, scheda });
  attuale.current = { anno, scheda };
  useTargetCambiati(
    (m) => (scheda === 'andamento' && m.anno === anno ? m.parti.map(p => `${p}|${m.anno}`) : []),
    async (cosa) => {
      const annoQui = anno;
      const parti = cosa.filter(c => c.endsWith(`|${annoQui}`)).map(c => c.split('|')[0]);
      if (!parti.length) return;
      if (letturaInCorso.current) await letturaInCorso.current.catch(() => {});
      if (attuale.current.anno !== annoQui || attuale.current.scheda !== 'andamento') return;
      const n = ultimaLettura.current;
      let motivoErrore = '';
      let letti = null;
      try {
        const [comm, annuiNuovi, mensiliNuovi] = await Promise.all([
          parti.includes('contratto') ? base44.entities.CommessaEcotyre.filter({ anno: annoQui }) : null,
          parti.includes('annui') ? fetchAllClient(base44.entities.TargetRaccoglitore, { anno: annoQui }) : null,
          parti.includes('mensili') ? fetchAllClient(base44.entities.TargetMensile, { anno: annoQui }) : null,
        ]);
        letti = { comm, annuiNuovi, mensiliNuovi };
      } catch (e) {
        motivoErrore = (e && e.message) || String(e);
      }
      // Una lettura intera partita nel frattempo (anno cambiato, «Aggiorna») vale lei.
      if (n !== ultimaLettura.current) return;
      if (letti) {
        if (letti.comm) setCommessa(commessaDellAnno(letti.comm, annoQui));
        if (letti.annuiNuovi) setAnnui(letti.annuiNuovi);
        if (letti.mensiliNuovi) setTargets(letti.mensiliNuovi);
      }
      setRiletto({
        testo: testoRilettura({ parti, anno: annoQui, dove: "in un'altra scheda", esiti: [{ nome: 'Andamento', motivo: motivoErrore }], ora: oraRoma() }),
        errore: !!motivoErrore,
        anno: annoQui,
      });
    },
  );

  const filterOptions = raccoltoAnno?.filterOptions || { mesi: MESI, regioni: [], raccoglitori: [], impianti: [] };

  // Target e raccolto per raccoglitore e regione: le stesse righe del file Excel
  // (righeAndamento, src/lib/andamentoTarget.js), con il nome del target
  // abbinato a quello del portale anche quando e' scritto abbreviato (chiusura
  // dell'audit, 11/10/2026). Prima la pagina aveva un conto suo, l'Excel un
  // altro, e i due non tornavano.
  const mergedData = useMemo(() => {
    if (!raccolto) return [];
    return righeAndamento({ mensili: targets, annui, raccolto: raccolto.by_raccoglitore, filtri: filters });
  }, [raccolto, targets, annui, filters]);
  // I target dell'anno copiati dall'anno prima e non confermati, per la frase
  // sopra la tabella per raccoglitore: la stessa del Report generale (prova
  // generale del cambio d'anno, 15/10/2026).
  const copiatiDellAnno = useMemo(() => targetCopiatiDellAnno({ mensili: targets, annui }), [targets, annui]);

  // La tabella per regione dell'Andamento. Del target mensile scritto due volte
  // (stesso raccoglitore, regione, impianto, ruolo e mese) vale l'ultimo
  // modificato, come nella tabella per raccoglitore qui sopra e nelle card
  // (targetMensiliValidi, revisione del 13/10/2026): sommava le righe grezze, e
  // con 80 t e poi 50 t la stessa pagina diceva 50 per raccoglitore e 130 per
  // regione. Il PDF e la presentazione di regioneData leggono solo il raccolto.
  const regioneData = useMemo(() => {
    if (!raccolto) return [];
    const map = {};
    const ensure = (reg) => {
      if (!map[reg]) { map[reg] = { regione: reg, totale: 0, mesi: {} }; for (const m of MESI) map[reg].mesi[m] = { target: 0, raccolto: 0 }; }
      return map[reg];
    };
    for (const t of targetMensiliValidi(targets)) {
      if (!t.regione || (filters.regione.length > 0 && !filters.regione.includes(t.regione))) continue;
      if (MESI.includes(t.mese) && !t.non_raccoglie) ensure(t.regione).mesi[t.mese].target += Number(t.target) || 0;
    }
    for (const r of raccolto.by_regione) {
      if (filters.regione.length > 0 && !filters.regione.includes(r.regione)) continue;
      const x = ensure(r.regione);
      x.totale += r.totale;
      for (const m of MESI) x.mesi[m].raccolto += r.mesi[m] || 0;
    }
    return Object.values(map).map(r => ({
      regione: r.regione,
      totale: r.totale,
      mesi: MESI.map(m => ({ mese: m, target: r.mesi[m].target, raccolto: r.mesi[m].raccolto, delta: r.mesi[m].target - r.mesi[m].raccolto })),
    }));
  }, [raccolto, targets, filters]);

  // Le primarie RETE che ogni impianto ha ricevuto, mese per mese. Niente target
  // mensile per impianto: vedi loadData.
  const impiantiData = useMemo(() => {
    if (!raccolto) return [];
    return raccolto.by_impianto
      .filter(i => filters.impianto.length === 0 || filters.impianto.includes(i.impianto))
      .map(i => ({ impianto: i.impianto, totale: i.totale, mesi: MESI.map(m => ({ mese: m, raccolto: i.mesi[m] || 0 })) }));
  }, [raccolto, filters]);

  // LE CARD DELL'ANDAMENTO (chiusura dell'audit, 11/10/2026). Il target annuo e'
  // quello del contratto dell'anno, le costanti del 2025 e del 2026 solo come
  // ripiego dichiarato, e un anno senza contratto non ha target: «—», non zero.
  // «Leftover Complessivo Annuo» e «Delta Mese In Corso», col positivo in
  // rosso e senza dire il segno, diventano il residuo dell'anno (target meno
  // raccolto: quanto manca) e lo scarto del mese sull'atteso (raccolto meno
  // atteso: positivo avanti, negativo indietro). L'atteso del mese e' il suo
  // target per i giorni che i dati coprono (frazioneDelMese), come nel
  // controllo dei target mensili.
  // Il raccolto e il residuo DELL'ANNO vengono da raccoltoAnno, senza filtri;
  // lo scarto e' quello dei mesi scelti, sulle righe filtrate, e la card dice
  // quali altri filtri valgono (12/10/2026).
  const hasFilters = Object.values(filters).some(v => (Array.isArray(v) ? v.length > 0 : v));
  // Il giorno su cui si misura l'anno scelto (giornoDellaMisura, prova generale
  // del cambio d'anno del 15/10/2026): il 31/12 per un anno chiuso, nessuno per
  // l'anno in corso senza ancora un ritiro suo, altrimenti il giorno dei dati.
  // Lo usano la tabella per regione e contratto e la card dello scarto del mese:
  // il 05/01/2027 la card del 2027 contava l'atteso di gennaio sul 30/12/2026
  // (zero) e scriveva lo scarto +0,00.
  const giornoMisura = giornoDellaMisura(anno, giornoDati, oggiRoma());
  const kpis = useMemo(() => {
    const contratto = targetAnnuoDellAnno(commessa, anno);
    const raccoltoTotale = raccoltoAnno?.totale_raccolto || 0;
    const mesiScelti = (filters.mese || []).length > 0 ? filters.mese : [meseDiOggi];
    let raccoltoMese = 0;
    let attesoMese = 0;
    let deltaMese = 0;
    // i target dei mesi scelti copiati dall'anno prima e non confermati: l'atteso
    // li conta, e la card lo dice (15/10/2026)
    let copiatiMese = 0;
    for (const r of mergedData) {
      for (const m of r.mesi) {
        if (!mesiScelti.includes(m.mese)) continue;
        if (m.daConfermare) copiatiMese++;
        raccoltoMese += m.raccolto;
        attesoMese += m.target * frazioneDelMese(anno, MESI.indexOf(m.mese), giornoMisura, oggiRoma());
        deltaMese += m.delta;
      }
    }
    return {
      targetAnnuoTotale: contratto.t,
      fonteTarget: contratto.fonte,
      targetDaConfermare: contratto.da_confermare,
      // Le variazioni del consorzio che il target comprende, per la nota della
      // card (giro del 14/10/2026): solo quelle in vigore, dal contratto della pagina.
      variazioni: contratto.fonte === 'contratto' ? variazioniPerLaCard(variazioniDelContratto(commessa).filter(v => v.in_vigore), contratto.t) : null,
      raccoltoTotale,
      residuoAnno: contratto.t === null ? null : contratto.t - raccoltoTotale,
      scartoMese: giornoMisura ? raccoltoMese - attesoMese : null,
      attesoMese: giornoMisura ? attesoMese : null,
      mesiScarto: mesiScelti,
      targetCopiatiMese: copiatiMese,
      filtriScarto: ['regione', 'raccoglitore', 'impianto'].filter(k => (filters[k] || []).length > 0).map(k => `${k} ${filters[k].join(', ')}`),
      conFiltri: hasFilters,
      // il giorno della misura (l'etichetta della card) e l'ultimo ritiro
      // caricato, che dice perche' l'atteso manca
      giornoDati: giornoMisura,
      ultimoRitiro: giornoDati,
      // per la presentazione (statusExports.js), con i nomi e il segno di prima
      leftoverTotale: contratto.t === null ? null : contratto.t - raccoltoTotale,
      deltaMeseCorrente: deltaMese,
    };
  }, [mergedData, raccoltoAnno, filters, hasFilters, commessa, anno, giornoDati, giornoMisura, meseDiOggi]);
  // Il riepilogo del PDF vuole un elenco di voci: gli si passava l'oggetto delle
  // card, e il PDF si fermava con un errore (11/10/2026).
  const riepilogoPdf = [
    { etichetta: 'Target annuo del contratto', valore: kpis.targetAnnuoTotale, tipo: 't' },
    { etichetta: "Raccolto RETE nell'anno", valore: kpis.raccoltoTotale, tipo: 't' },
    { etichetta: "Residuo dell'anno", valore: kpis.residuoAnno, tipo: 't' },
    // L'etichetta della card: lo scarto e' quello dei mesi scelti nel filtro.
    { etichetta: `Scarto ${(kpis.mesiScarto || []).length ? `di ${kpis.mesiScarto.join(', ').toLowerCase()}` : 'del mese'} sull'atteso`, valore: kpis.scartoMese, tipo: 't' },
  ];

  const resetFilters = () => setFilters({ mese: [], regione: [], raccoglitore: [], impianto: [] });

  return (
    <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold">Target & Status</h1>
          <p className="text-muted-foreground mt-1">L'unico punto in cui si scrivono i target: contratto Ecotyre, raccoglitori, impianti e stoccaggi. Tutti i moduli leggono da qui.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={anno} onChange={e => setAnno(Number(e.target.value))} className="border rounded-md px-3 py-2 text-sm bg-background" title="Anno">
            {anni.map(a => <option key={a} value={a}>{a}{annoChiuso(a) ? ' (chiuso)' : ''}</option>)}
          </select>
          {scheda === 'andamento' && (
            <>
              <button onClick={loadData} className="inline-flex items-center gap-2 px-3 py-2 text-sm btn-secondario">
                <RefreshCw className="w-4 h-4" /> Aggiorna
              </button>
              {/* il conto dei target copiati dell'anno, per la frase dei file come quella sopra la tabella (revisione del 15/10/2026) */}
              <ExportButtons onExcel={() => exportExcel(anno)} onPDF={() => exportPDF(riepilogoPdf, mergedData, regioneData, impiantiData, anno, copiatiDellAnno)} onPPT={() => exportPPT(kpis, mergedData, regioneData, impiantiData, anno, copiatiDellAnno)} />
            </>
          )}
        </div>
      </div>

      {annoIndirizzo > 0 && !anni.includes(annoIndirizzo) && (
        <div className="text-sm bg-amber-50 border border-amber-300 text-amber-900 rounded-lg px-3 py-2">
          Il {annoIndirizzo} in Target &amp; Status non c&apos;è (gli anni vanno dal {anni[anni.length - 1]} al {anni[0]}): stai vedendo il {anno}.
        </div>
      )}

      {chiuso && (
        <div className="flex items-start gap-2 text-sm bg-muted border rounded-lg px-3 py-2">
          <Lock className="w-4 h-4 mt-0.5 shrink-0" />
          <span><strong>Anno chiuso: sola lettura.</strong> Il {anno} si consulta com&apos;è, in tutte le schede; niente si cancella.</span>
        </div>
      )}

      <Tabs value={scheda} onValueChange={v => vaiA(v, anno)}>
        <TabsList>
          <TabsTrigger value="andamento">Andamento</TabsTrigger>
          <TabsTrigger value="raccoglitori">Target raccoglitori</TabsTrigger>
          <TabsTrigger value="commessa">Commessa Ecotyre</TabsTrigger>
          <TabsTrigger value="impianti">Impianti e stoccaggi</TabsTrigger>
          <TabsTrigger value="zone">Zone dei raccoglitori</TabsTrigger>
          {/* L'anno nuovo: il contratto e le tariffe sono annuali senza tacito
              rinnovo, e dal 1° gennaio una riga senza tariffa vale zero euro.
              Sta qui perche' qui vive gia' la copia dell'anno (10/10/2026). */}
          <TabsTrigger value="nuovo-anno">Nuovo anno</TabsTrigger>
        </TabsList>

        <TabsContent value="andamento" className="mt-4 space-y-6">
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium inline-flex items-center gap-1.5"><Filter className="w-4 h-4" /> Filtri {anno}</span>
              {hasFilters && <button onClick={resetFilters} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><X className="w-3 h-3" /> Reset</button>}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Mese</label>
                <MultiSelect allLabel="Tutti i mesi" options={MESI} selected={filters.mese} onChange={v => setFilters(p => ({ ...p, mese: v }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Regione</label>
                <MultiSelect allLabel="Tutte le regioni" options={filterOptions.regioni || []} selected={filters.regione} onChange={v => setFilters(p => ({ ...p, regione: v }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Raccoglitore</label>
                <MultiSelect allLabel="Tutti i raccoglitori" options={filterOptions.raccoglitori || []} selected={filters.raccoglitore} onChange={v => setFilters(p => ({ ...p, raccoglitore: v }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Impianto</label>
                <MultiSelect allLabel="Tutti gli impianti" options={filterOptions.impianti || []} selected={filters.impianto} onChange={v => setFilters(p => ({ ...p, impianto: v }))} />
              </div>
            </div>
            {hasFilters && (
              <p className="text-xs text-muted-foreground">I filtri valgono per le tabelle per raccoglitore, per regione mese per mese e degli impianti, e per lo scarto sull&apos;atteso. Il raccolto e il residuo dell&apos;anno, la tabella per regione e contratto e il Report generale guardano sempre l&apos;anno intero.</p>
            )}
          </div>

          {loading || !raccoltoAnno ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Caricamento dati…</div>
          ) : (
            <>
              {/* Immissione, inizio e fine trasporto sono obbligatorie (regola del
                  22/09/2026): computeRaccolto dice i terminati di rete senza fine
                  trasporto, esclusi dal raccolto contro il target, e quelli contati
                  con un'altra data da sistemare. L'ACI ha la sua riga nella sezione
                  Canale ACI: i due canali non si sommano. */}
              <RiepilogoDate canale="Rete" riepilogo={raccoltoAnno?.date_da_sistemare} esempi />
              {riletto && riletto.anno === anno && (
                <p role="status" className={`text-xs rounded-md px-3 py-1.5 ${riletto.errore ? 'text-amber-900 bg-amber-50 border border-amber-300' : 'text-muted-foreground bg-muted/40'}`}>
                  {riletto.testo}{riletto.errore ? ' Oppure premi «Aggiorna».' : ''}
                </p>
              )}
              <KpiCards kpis={kpis} anno={anno} />
              <div>
                <h2 className="text-lg font-heading font-semibold mb-3">Raccolta RETE per regione e contratto</h2>
                <AndamentoRegioni raccolto={raccoltoAnno} commessa={commessa} anno={anno} giornoDati={giornoMisura} ultimoRitiro={giornoDati} />
              </div>
              <div>
                <h2 className="text-lg font-heading font-semibold mb-1">Report generale</h2>
                <p className="text-xs text-muted-foreground mb-3">Target assegnati e raccolto RETE per regione e raccoglitore; l'impianto di destinazione si legge a consuntivo, mese per mese.</p>
                <ReportGenerale anno={anno} mensili={targets} annui={annui} raccolto={raccoltoAnno} commessa={commessa} />
              </div>
              <div>
                <h2 className="text-lg font-heading font-semibold mb-1">Target e raccolto per raccoglitore</h2>
                <p className="text-xs text-muted-foreground mb-3">Solo lettura: i target si modificano nella scheda Target raccoglitori.</p>
                <TargetTable data={mergedData} anno={anno} copiati={copiatiDellAnno} />
              </div>
              <TargetChart data={mergedData} mese={meseSelezionato} onMeseChange={setMeseSelezionato} />
              <div>
                <h2 className="text-lg font-heading font-semibold mb-3">Target e scostamento per regione, mese per mese</h2>
                <RegionTable data={regioneData} />
              </div>
              <div>
                <h2 className="text-lg font-heading font-semibold mb-1">Primarie RETE ricevute dagli impianti</h2>
                <p className="text-xs text-muted-foreground mb-3">Solo le primarie, per impianto di destinazione e mese di fine trasporto: non è il «Conferito RETE» delle Giacenze, che conta anche le secondarie in arrivo. Il target degli impianti si scrive in Impianti e stoccaggi e si confronta in Giacenze.</p>
                <ImpiantiTable data={impiantiData} />
              </div>
              <div>
                <h2 className="text-lg font-heading font-semibold mb-1">Canale ACI</h2>
                <p className="text-xs text-muted-foreground mb-3">Ritiri dai centri di demolizione, separati dalla RETE.</p>
                <RiepilogoDate canale="ACI" riepilogo={raccoltoAci?.date_da_sistemare} esempi className="mb-3" />
                <CanaleAci raccoltoAci={raccoltoAci} commessa={commessa} anno={anno} />
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="raccoglitori" className="mt-4">
          {scheda === 'raccoglitori' && <Suspense fallback={<AttesaScheda />}><TargetRaccoglitoriGrid key={anno} anno={anno} isAdmin={puoScrivere} user={user} /></Suspense>}
        </TabsContent>

        <TabsContent value="commessa" className="mt-4">
          {scheda === 'commessa' && <Suspense fallback={<AttesaScheda />}><CommessaEcotyreForm key={anno} anno={anno} isAdmin={puoScrivere} user={user} onModificato={setCommessaModificata} /></Suspense>}
        </TabsContent>

        <TabsContent value="impianti" className="mt-4">
          {/* una per anno: niente di un anno resta a video, modificabile, quando si passa a un altro */}
          {scheda === 'impianti' && <Suspense fallback={<AttesaScheda />}><ConfigurazioneImpianti key={anno} anno={anno} solaLettura={!puoScrivere} user={user} /></Suspense>}
        </TabsContent>

        {/* Le zone di competenza stanno qui, con gli altri perimetri della commessa
            (decisione dell'utente, 29/09/2026): a leggerle e' Verifiche Fornitori. */}
        <TabsContent value="nuovo-anno" className="mt-4">
          {scheda === 'nuovo-anno' && <Suspense fallback={<AttesaScheda />}><NuovoAnno anno={anno} /></Suspense>}
        </TabsContent>

        <TabsContent value="zone" className="mt-4">
          {scheda === 'zone' && <Suspense fallback={<AttesaScheda />}><ZoneRaccoglitori isAdmin={puoScrivere} /></Suspense>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
