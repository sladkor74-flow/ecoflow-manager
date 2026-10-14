import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Loader2, AlertTriangle, CalendarCheck, ChevronDown, ChevronRight } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { oggiRoma } from '@/lib/giornoItaliano';
import { anniDaScegliere, annoDiOggi, meseDiLavoro } from '@/lib/periodoPagine';
import { smista, nascondi, leggiMemoria, scriviMemoria } from '@/lib/avvisiNascosti';
import { useTargetCambiati, testoRilettura, oraRoma } from '@/lib/eventiDati';
import EsportaPdf from '@/components/shared/EsportaPdf';
import IntestazioneCommessa, { IndiceSezioni } from '@/components/dashboard/IntestazioneCommessa';
import DaGestire from '@/components/dashboard/DaGestire';
import QuadroInBreve from '@/components/dashboard/QuadroInBreve';
import SezioneRete from '@/components/dashboard/SezioneRete';
import SezioneAci from '@/components/dashboard/SezioneAci';
import SezioneExtra from '@/components/dashboard/SezioneExtra';
import SezioneImpianti from '@/components/dashboard/SezioneImpianti';
import SezioneFatturazione from '@/components/dashboard/SezioneFatturazione';
import SezioneEconomia from '@/components/dashboard/SezioneEconomia';
import FreschezzaDati from '@/components/dashboard/FreschezzaDati';
import { vociDalMargine, unisciVoci, contaPerSezione, riassuntoControlli } from '@/components/dashboard/vociDashboard';
import { argomentiQuadroPdf } from '@/components/dashboard/esportaQuadro';

// La chiusura del mese legge una dozzina di archivi (statoChiusuraMese): si
// scarica e si legge solo quando si apre la sua sezione, che parte sempre chiusa.
const ChiusuraMese = lazy(() => import('@/components/dashboard/ChiusuraMese'));

// IL QUADRO DELLA COMMESSA (migliorie dell'11/10/2026).
//
// Chiesto dall'utente: «sistema meglio anche il modulo dashboard, permetti gli
// alert a scomparsa e rendilo piu' professionale ed esaustivo sulla commessa».
//
// - La pagina e' il quadro della commessa Ecotyre dell'anno scelto, per SMOCO
//   partner operativo: un anno solo, scritto nell'indirizzo (/?anno=2025). Prima
//   si potevano scegliere piu' anni e piu' mesi, e «2025, 2026» sommava due
//   contratti e due raccolti; il filtro dei mesi cambiava solo meta' dei numeri.
// - «Da gestire» e' l'unico elenco dei problemi: le sezioni dicono come sta la
//   commessa e mostrano solo un segno che porta alle loro voci. Spariscono le
//   righe gialle sotto le card, il riquadro degli avvisi del contratto, i
//   riepiloghi delle date, il pannello dei target e il badge in alto, che
//   dicevano le stesse cose da tre calcoli fatti in momenti diversi.
// - Gli avvisi si nascondono per oggi o per sette giorni e tornano da soli
//   (src/lib/avvisiNascosti.js). La memoria e' nel browser, per utente.
// - Meno richieste all'apertura, non di piu': due funzioni (getDashboardRaccolta
//   col quadro, cruscottoOperativo con gli impianti della notte) e, solo per
//   l'amministratore e dopo le prime due, il margine dell'anno scelto. Via
//   getDashboardStats e la lettura del pannello dei target (checkTargetAlerts).
//   La chiusura del mese si legge quando si apre.
// - Rete, ACI ed extra raccolta non si sommano in nessun punto, nemmeno nel PDF.

const motivo = (e) => e?.response?.data?.error || e?.data?.error || e?.message || String(e);
const vai = (id) => {
  const el = typeof document !== 'undefined' ? document.getElementById(id) : null;
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [params, setParams] = useSearchParams();

  // L'anno in corso e' quello italiano; l'anno scelto sta nell'indirizzo.
  const oggi = oggiRoma();
  const annoOggi = annoDiOggi(oggi);
  const anni = useMemo(() => anniDaScegliere({ dal: 2025, dopo: 1, oggi }), [oggi]);
  const annoChiesto = Number(params.get('anno'));
  const anno = anni.includes(annoChiesto) ? annoChiesto : annoOggi;
  const annoInCorso = anno === annoOggi;
  const scegliAnno = (a) => setParams(a === annoOggi ? {} : { anno: String(a) }, { replace: true });

  // Il cruscotto: le voci da gestire, gli ordini aperti, la freschezza dei dati,
  // i mesi dell'attiva, gli impianti della notte. E' di oggi: non segue l'anno.
  // Le letture si numerano: vale l'ultima partita, anche quando una rilettura
  // (qui sotto, il contratto cambiato) parte mentre la prima e' ancora in volo.
  const [cruscotto, setCruscotto] = useState(null);
  const [erroreCruscotto, setErroreCruscotto] = useState('');
  const letturaCruscotto = useRef(0);
  const cruscottoAVideo = useRef(false);
  cruscottoAVideo.current = !!cruscotto;
  const leggiCruscotto = useCallback((rilettura = false) => {
    const n = ++letturaCruscotto.current;
    return base44.functions.invoke('cruscottoOperativo', {})
      .then(r => {
        if (n !== letturaCruscotto.current) return null;
        setCruscotto(r.data);
        setErroreCruscotto('');
        return '';
      })
      .catch(e => {
        if (n !== letturaCruscotto.current) return null;
        // Una rilettura che cade lascia a video l'elenco di prima, e la riga
        // della rilettura lo dice; senza un elenco a video vale l'errore di sempre.
        if (!rilettura || !cruscottoAVideo.current) setErroreCruscotto(motivo(e));
        return motivo(e);
      });
  }, []);
  useEffect(() => {
    leggiCruscotto();
    return () => { letturaCruscotto.current++; };
  }, [leggiCruscotto]);

  // Il quadro dell'anno scelto.
  const [raccolta, setRaccolta] = useState({ anno: null, dati: null, errore: '' });
  const letturaQuadro = useRef(0);
  const leggiQuadro = useCallback((rilettura = false) => {
    const n = ++letturaQuadro.current;
    // La rilettura non svuota il quadro: i numeri di prima restano a video finche'
    // arrivano i nuovi, e il margine, che parte a quadro pronto, non riparte.
    if (!rilettura) setRaccolta({ anno, dati: null, errore: '' });
    return base44.functions.invoke('getDashboardRaccolta', { anno: [anno] })
      .then(r => {
        if (n !== letturaQuadro.current) return null;
        setRaccolta({ anno, dati: r.data, errore: '' });
        return '';
      })
      .catch(e => {
        if (n !== letturaQuadro.current) return null;
        if (!rilettura) setRaccolta({ anno, dati: null, errore: motivo(e) });
        else setRaccolta(x => (x.anno === anno && x.dati ? x : { anno, dati: null, errore: motivo(e) }));
        return motivo(e);
      });
  }, [anno]);
  useEffect(() => {
    leggiQuadro();
    return () => { letturaQuadro.current++; };
  }, [leggiQuadro]);
  const raccoltaPronta = raccolta.anno === anno && (raccolta.dati || raccolta.errore);
  const quadro = raccolta.anno === anno && raccolta.dati ? raccolta.dati.quadro : null;

  // IL CONTRATTO O I TARGET CAMBIATI IN UN'ALTRA SCHEDA (14/10/2026, richiesta
  // dell'utente dopo la variazione di ottobre in Puglia: «fai in modo che quando
  // si faccia una tale variazione i moduli collegati come la dashboard si
  // aggiornino di conseguenza»). La dashboard legge il contratto quando si apre:
  // aperta in un'altra scheda restava a 11.550 t finche' non la si ricaricava.
  // Target & Status ora lo annuncia (src/lib/eventiDati.js) e qui si rilegge
  // solo la parte toccata, una volta per raffica e a scheda visibile:
  // - il quadro, se il cambio e' dell'anno a video (contratto, target annui o
  //   mensili dei raccoglitori: getDashboardRaccolta li legge tutti e tre);
  // - l'elenco «Da gestire», se cambiano contratto o target annui dell'anno in
  //   corso: la voce «I raccoglitori della Puglia hanno 100,00 t più del
  //   contratto» (vociContrattoRaccoglitori) li confronta, e dopo la variazione
  //   deve sparire. Per i target mensili no: la voce «Target raccoglitori» viene
  //   dagli alert, che riscrive il controllo delle 9 (checkTargetAlerts), e
  //   rileggere il cruscotto non la cambierebbe;
  // - l'elenco «Da gestire» anche se cambiano contratto o target annui
  //   dell'anno dopo (revisione del 14/10/2026): la voce «Nuovo anno»
  //   (cruscotto.ts, listaAnno) conta il contratto Ecotyre e i target dei
  //   raccoglitori del prossimo anno, e da novembre, salvata la commessa 2027 o
  //   fatta la copia in un'altra scheda, restava a dire che mancavano. A gennaio e
  //   febbraio la voce guarda l'anno appena cominciato, che e' l'anno in corso.
  // Margine e chiusura del mese non leggono i target: restano come sono.
  const [riletto, setRiletto] = useState(null);
  useTargetCambiati(
    (m) => {
      const cosa = [];
      if (m.anno === anno) cosa.push(`quadro|${m.anno}`);
      if ((m.anno === annoOggi || m.anno === annoOggi + 1) && m.parti.some(p => p === 'contratto' || p === 'annui')) cosa.push('cruscotto');
      return cosa.length ? [...cosa, ...m.parti.map(p => `parte|${p}|${m.anno}`)] : [];
    },
    async (cosa) => {
      const lavori = [];
      if (cosa.includes(`quadro|${anno}`)) lavori.push(leggiQuadro(true).then(m => ({ nome: 'quadro', motivo: m })));
      if (cosa.includes('cruscotto')) lavori.push(leggiCruscotto(true).then(m => ({ nome: 'elenco «Da gestire»', motivo: m })));
      if (!lavori.length) return;
      // null: superata da una lettura partita dopo, che vale lei
      const esiti = (await Promise.all(lavori)).filter(e => e.motivo !== null);
      if (!esiti.length) return;
      const cambi = cosa.filter(c => c.startsWith('parte|')).map(c => c.split('|'));
      const parti = [...new Set(cambi.map(c => c[1]))];
      const anni = [...new Set(cambi.map(c => c[2]))].sort();
      setRiletto({ testo: testoRilettura({ parti, anno: anni.join(' e '), esiti, ora: oraRoma() }), errore: esiti.some(e => e.motivo) });
    },
  );

  // Il margine dell'anno scelto: solo per l'amministratore, e solo dopo che le
  // prime due hanno risposto (stessa somma di letture, meno picco nel minuto).
  const [margine, setMargine] = useState({ anno: null, dati: null, errore: '' });
  const prontoPerMargine = isAdmin && !!(cruscotto || erroreCruscotto) && !!raccoltaPronta;
  useEffect(() => {
    if (!prontoPerMargine) return undefined;
    let vivo = true;
    setMargine({ anno, dati: null, errore: '' });
    base44.functions.invoke('calcolaMargine', { anno })
      .then(r => { if (vivo) setMargine({ anno, dati: r.data, errore: '' }); })
      .catch(e => { if (vivo) setMargine({ anno, dati: null, errore: motivo(e) }); });
    return () => { vivo = false; };
  }, [prontoPerMargine, anno]);
  const margineAnno = isAdmin && margine.anno === anno ? margine.dati : null;
  const margineErrore = isAdmin && margine.anno === anno ? margine.errore : '';

  // La memoria di chi guarda: le voci nascoste e i pannelli aperti o chiusi.
  const chiaveUtente = user ? (user.id || user.email || '') : null;
  const [memoria, setMemoria] = useState(null);
  useEffect(() => { setMemoria(user ? leggiMemoria(user) : null); }, [chiaveUtente]);
  useEffect(() => { if (user && memoria) scriviMemoria(user, memoria); }, [memoria]);
  const cambiaMemoria = useCallback((fn) => setMemoria(m => (m ? fn(m) : m)), []);

  // L'elenco unico, e chi e' nascosto.
  const voci = useMemo(() => unisciVoci(cruscotto?.da_gestire || [], vociDalMargine(margineAnno, isAdmin)), [cruscotto, margineAnno, isAdmin]);
  const smistate = useMemo(() => smista(voci, memoria?.nascoste || [], oggi), [voci, memoria, oggi]);
  // «tornata: ...» resta scritto fino al prossimo caricamento della pagina,
  // anche dopo che la sua riga e' uscita dalla memoria.
  const [tornate, setTornate] = useState({});
  useEffect(() => {
    if (!memoria) return;
    const nuove = {};
    for (const x of smistate.visibili) if (x.tornata && x.tornata.motivo !== 'scaduta') nuove[x.voce.chiave] = x.tornata;
    if (Object.keys(nuove).length) setTornate(t => ({ ...t, ...nuove }));
    // chi e' tornato o scaduto esce dalla memoria
    if (smistate.memoria.length !== memoria.nascoste.length) cambiaMemoria(m => ({ ...m, nascoste: smistate.memoria }));
  }, [smistate]);
  const visibili = smistate.visibili.map(x => ({ voce: x.voce, tornata: x.tornata || tornate[x.voce.chiave] || null }));
  const nascoste = smistate.nascoste;
  const visibiliDi = (sezione) => contaPerSezione(visibili.map(x => x.voce), sezione);

  const onNascondi = (voce, giorni) => {
    cambiaMemoria(m => ({ ...m, nascoste: [nascondi(voce, oggi, { giorni }), ...m.nascoste.filter(r => r.chiave !== voce.chiave)] }));
    setTornate(t => { const c = { ...t }; delete c[voce.chiave]; return c; });
  };
  const onRimetti = (chiave) => cambiaMemoria(m => ({ ...m, nascoste: m.nascoste.filter(r => r.chiave !== chiave) }));
  const onRimettiTutte = (chiavi) => cambiaMemoria(m => ({ ...m, nascoste: m.nascoste.filter(r => !chiavi.includes(r.chiave)) }));

  // Il pannello aperto o chiuso, ricordato; la prima volta e' aperto.
  const daGestireAperto = memoria?.aperte?.daGestire !== false;
  const apriDaGestire = (aperto) => cambiaMemoria(m => ({ ...m, aperte: { ...(m.aperte || {}), daGestire: aperto } }));
  const [filtro, setFiltro] = useState(null);
  const onDaGestire = (sezione) => {
    setFiltro(sezione);
    if (!daGestireAperto) apriDaGestire(true);
    vai('da-gestire');
  };

  // La chiusura del mese parte chiusa e non si ricorda aperta: la sua lettura
  // pesa piu' di dieci pagine, e aperta d'abitudine si sommerebbe a ogni apertura.
  const [chiusuraAperta, setChiusuraAperta] = useState(false);
  const meseLavoro = meseDiLavoro(oggi);

  const [conEconomia, setConEconomia] = useState(false);
  const impianti = cruscotto?.impianti || null;
  // I mesi dell'attiva: quelli di oggi dal cruscotto; di un anno chiuso dal
  // quadro, dal primo mese con un documento, con la nota di quelli che restano
  // fuori; un anno che deve ancora cominciare non ne ha.
  const mesiAttiva = annoInCorso ? (cruscotto ? cruscotto.mesi_attiva : null) : anno > annoOggi ? [] : (quadro ? quadro.mesi_attiva : null);
  const notaAttiva = !annoInCorso && anno < annoOggi && quadro ? quadro.mesi_attiva_nota || '' : '';
  const primarie = (cruscotto?.caricamenti?.archivi || []).find(a => a.tipo_file === 'primarie');

  const indice = [
    { id: 'da-gestire', testo: 'Da gestire' },
    { id: 'rete', testo: 'Rete' },
    { id: 'aci', testo: 'ACI' },
    { id: 'extra', testo: 'Extra raccolta' },
    { id: 'impianti', testo: 'Impianti' },
    { id: 'fatturazione', testo: 'Fatturazione' },
    ...(isAdmin ? [{ id: 'economia', testo: 'Economia' }] : []),
    { id: 'chiusura', testo: 'Chiusura del mese' },
    { id: 'dati', testo: 'Dati' },
  ];
  const segni = (id) => (id === 'da-gestire' ? visibili.length : visibiliDi(id));
  const sezioneProps = (id) => ({ daGestire: visibiliDi(id), onDaGestire });

  const esporta = (
    <div className="flex items-center gap-2 flex-wrap">
      {isAdmin && (
        <label className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
          <input type="checkbox" checked={conEconomia} onChange={(e) => setConEconomia(e.target.checked)} className="rounded border-input" />
          con l&apos;economia
        </label>
      )}
      <EsportaPdf
        etichetta="Esporta il quadro (PDF)"
        disabilitato={!quadro}
        sezioni={() => argomentiQuadroPdf({ quadro, impianti, annoInCorso, mesiAttiva, margine: margineAnno, conEconomia, isAdmin })}
      />
    </div>
  );

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-5">
      <IntestazioneCommessa
        anno={anno} anni={anni} onAnno={scegliAnno}
        giornoDati={quadro ? quadro.giorno_dati : ''}
        ultimoCaricamento={primarie ? primarie.il : null}
        annoChiuso={!annoInCorso && anno < annoOggi}
        caricamento={!raccoltaPronta}
        errore={!!raccolta.errore}
        azioni={esporta}
      />

      {riletto && (
        <p role="status" className={`text-xs rounded-md px-3 py-1.5 ${riletto.errore ? 'text-amber-900 bg-amber-50 border border-amber-300' : 'text-muted-foreground bg-muted/40'}`}>{riletto.testo}</p>
      )}

      <IndiceSezioni voci={indice} contaPerSezione={segni} onVai={vai} />

      <DaGestire
        visibili={visibili} nascoste={nascoste}
        filtro={filtro} onTogliFiltro={() => setFiltro(null)}
        aperto={daGestireAperto} onApri={() => apriDaGestire(!daGestireAperto)}
        onNascondi={onNascondi} onRimetti={onRimetti} onRimettiTutte={onRimettiTutte}
        caricamento={!cruscotto && !erroreCruscotto} errore={erroreCruscotto}
        attesaPrezzi={isAdmin && !margineAnno && !margineErrore}
      />

      {raccoltaPronta && raccolta.errore ? (
        <div className="border border-destructive/40 bg-destructive/5 rounded-lg p-4 text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" aria-hidden="true" /> Il quadro della commessa non si è caricato: {raccolta.errore}
        </div>
      ) : (
        <QuadroInBreve quadro={quadro} impianti={impianti} annoInCorso={annoInCorso} caricamento={!quadro} onVai={vai} />
      )}

      {!raccoltaPronta ? (
        <div className="flex items-center py-6 text-muted-foreground text-sm"><Loader2 className="w-5 h-5 animate-spin mr-2" aria-hidden="true" /> Lettura della commessa del {anno}…</div>
      ) : quadro ? (
        <>
          <SezioneRete quadro={quadro} arretrato={cruscotto?.arretrato?.RETE || null} annoInCorso={annoInCorso} {...sezioneProps('rete')} />
          <SezioneAci quadro={quadro} arretrato={cruscotto?.arretrato?.ACI || null} annoInCorso={annoInCorso} {...sezioneProps('aci')} />
          <SezioneExtra quadro={quadro} {...sezioneProps('extra')} />
        </>
      ) : !raccolta.errore ? (
        <p className="text-sm text-muted-foreground">{raccolta.dati?.quadro_perche || 'Il quadro della commessa non è arrivato.'}</p>
      ) : null}

      <SezioneImpianti impianti={impianti} annoInCorso={annoInCorso} anno={anno} {...sezioneProps('impianti')} />
      <SezioneFatturazione mesi={mesiAttiva} nota={notaAttiva} anno={anno} caricamento={annoInCorso ? !cruscotto && !erroreCruscotto : !raccoltaPronta} {...sezioneProps('fatturazione')} />
      {isAdmin && <SezioneEconomia margine={margineAnno} errore={margineErrore} anno={anno} {...sezioneProps('economia')} />}

      <section id="chiusura" aria-labelledby="chiusura-titolo" className="scroll-mt-4">
        {!chiusuraAperta ? (
          <button
            type="button" onClick={() => setChiusuraAperta(true)} aria-expanded={false}
            className="w-full text-left border rounded-lg p-4 lg:p-5 bg-card hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <h2 id="chiusura-titolo" className="font-heading font-semibold text-lg flex items-center gap-2">
              <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <CalendarCheck className="w-5 h-5 text-primary" aria-hidden="true" />
              {annoInCorso ? `Chiusura di ${meseLavoro.mese.toLowerCase()} ${meseLavoro.anno}` : `Chiusura del mese, ${anno}`}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">I passi di fine mese, modulo per modulo: si controllano quando apri la sezione.</p>
          </button>
        ) : (
          <div className="space-y-1">
            <button type="button" onClick={() => setChiusuraAperta(false)} aria-expanded className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" /> <span id="chiusura-titolo">Chiudi la chiusura del mese</span>
            </button>
            <Suspense fallback={<div className="flex items-center py-6 text-muted-foreground text-sm"><Loader2 className="w-5 h-5 animate-spin mr-2" aria-hidden="true" /> Apertura…</div>}>
              <ChiusuraMese isAdmin={isAdmin} anno={anno} />
            </Suspense>
          </div>
        )}
      </section>

      {/* I controlli automatici: le voci dei presidi e del guardiano, ovunque stiano;
          finche' il cruscotto non risponde non si sa, e non si dice «tutti regolari». */}
      <FreschezzaDati
        caricamenti={cruscotto?.caricamenti}
        controlli={cruscotto ? riassuntoControlli(voci) : null}
        notteAssente={!!cruscotto && !!cruscotto.impianti && cruscotto.impianti.stato === 'assente'}
        {...sezioneProps('dati')}
      />
    </div>
  );
}
