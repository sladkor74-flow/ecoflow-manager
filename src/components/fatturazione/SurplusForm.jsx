import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { notaTraccia } from '@/lib/scriviConTraccia';
import { oggiRoma } from '@/lib/giornoItaliano';
import { CANALI_SURPLUS, NOMI_CANALE, DESTINATARI } from '@/lib/surplus';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Save, Loader2, Fuel, AlertTriangle, Info } from 'lucide-react';
import {
  bozzaVuota, bozzaDaScheda, schedeSurplus, pianoDelSalvataggio, esitiDelModulo, fraseDelSurplus, toccaMesiPassati,
  scriviSurplus, erroreDellaRisposta, resocontoDelSalvataggio, canaliAParole, NOMI_PRESTAZIONE_MODULO,
  RUOLO_DELLA_PRESTAZIONE, CAMPO_DEL_MODULO, testoDateDiverse,
} from './surplusTariffe';

// IL MODULO DEL SURPLUS (13/10/2026).
//
// Quattro blocchi, ognuno col suo titolo, come li pensa chi legge la
// comunicazione del consorzio: che cosa (nome, origine, riferimento), su che
// cosa (canali, prestazione, a chi), quanto (€/t ai fornitori e da Ecotyre) e
// quando (dal, al). Sotto, prima di salvare, la frase che dice che cosa
// succede; gli errori e gli avvisi stanno sotto il campo che li causa, con le
// stesse regole del server (src/lib/surplus.js), e i mesi gia' chiusi che il
// salvataggio cambierebbe si chiedono al server in anteprima e si confermano.
//
// Si salva solo da gestisciAnagrafiche (entita' SurplusTariffa): un record per
// canale con lo stesso gruppo, ognuno con la sua traccia nello storico delle
// modifiche. Se la traccia non si scrive il surplus resta salvato e lo si dice.
// Se un salvataggio su piu' canali si ferma a meta', il modulo resta aperto e
// il salvataggio dopo finisce quello che manca sul gruppo gia' scritto.

const TINTA = 'text-[hsl(var(--eco-surplus))]';
const SCELTO = 'border-[hsl(var(--eco-surplus))] bg-[hsl(var(--eco-surplus)/0.08)] text-foreground font-medium';
const invoca = (nome, corpo) => base44.functions.invoke(nome, corpo);

function Blocco({ numero, titolo, children }) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--eco-surplus)/0.14)] text-[11px] ${TINTA}`}>{numero}</span>
        {titolo}
      </h3>
      <div className="space-y-3 sm:pl-7">{children}</div>
    </section>
  );
}

function Esiti({ esiti }) {
  if (!esiti || !esiti.length) return null;
  return (
    <div className="space-y-0.5">
      {esiti.map((e, i) => (
        <p key={i} className={`flex items-start gap-1 text-xs ${e.gravita === 'errore' ? 'text-destructive' : 'text-amber-700 dark:text-amber-400'}`}>
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" /><span>{e.messaggio}</span>
        </p>
      ))}
    </div>
  );
}

function Campo({ id, etichetta, facoltativo = false, aiuto = '', esiti, children }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-medium">
        {etichetta}{facoltativo && <span className="font-normal text-muted-foreground"> · facoltativo</span>}
      </label>
      {children}
      {aiuto && <p className="text-xs text-muted-foreground">{aiuto}</p>}
      <Esiti esiti={esiti} />
    </div>
  );
}

// Una scelta fra poche voci, a pulsanti: si vede tutto senza aprire un menu.
function Scelte({ valore, opzioni, onScegli, colonne = 'grid-cols-2', etichetta }) {
  return (
    <div role="radiogroup" aria-label={etichetta} className={`grid gap-1.5 ${colonne}`}>
      {opzioni.map(([v, testo]) => (
        <button
          key={v} type="button" role="radio" aria-checked={valore === v} onClick={() => onScegli(v)}
          className={`rounded-md border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${valore === v ? SCELTO : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
        >
          {testo}
        </button>
      ))}
    </div>
  );
}

// Un importo in €/t, scritto all'italiana («5,00»).
function CampoImporto({ id, valore, onCambia, segnaposto = '5,00', disabilitato = false }) {
  return (
    <div className="relative">
      <Input id={id} inputMode="decimal" autoComplete="off" value={valore} onChange={e => onCambia(e.target.value)} placeholder={segnaposto} disabled={disabilitato} className="pr-11 tabular-nums" />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">€/t</span>
    </div>
  );
}

const stessoFornitore = (a, b) => (a.id && b.id ? a.id === b.id : String(a.nome || '').trim().toLowerCase() === String(b.nome || '').trim().toLowerCase());

function SceltaFornitori({ fornitori, prestazione, scelti, onCambia }) {
  const [cerca, setCerca] = useState('');
  const ruolo = RUOLO_DELLA_PRESTAZIONE[prestazione];
  const candidati = useMemo(() => {
    const conRuolo = (fornitori || []).filter(f => f && f.id && (!ruolo || f[ruolo])).map(f => ({ id: f.id, nome: String(f.ragione_sociale || '').trim(), interno: !!f.interno }));
    // Chi e' gia' nell'elenco resta visibile anche se oggi non ha il ruolo o
    // non e' attivo: toglierlo deve essere una scelta, non un effetto del menu.
    const altri = (scelti || []).filter(s => !conRuolo.some(f => stessoFornitore(f, s))).map(s => ({ ...s, fuori: true }));
    return [...conRuolo, ...altri].sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
  }, [fornitori, ruolo, scelti]);
  const filtro = cerca.trim().toLowerCase();
  const visibili = filtro ? candidati.filter(f => f.nome.toLowerCase().includes(filtro)) : candidati;
  const dentro = (f) => (scelti || []).some(s => stessoFornitore(s, f));
  const tocca = (f) => onCambia(dentro(f) ? scelti.filter(s => !stessoFornitore(s, f)) : [...(scelti || []), { id: f.id || '', nome: f.nome }]);
  return (
    <div className="rounded-md border">
      {candidati.length > 8 && (
        <div className="border-b p-2"><Input value={cerca} onChange={e => setCerca(e.target.value)} placeholder="Cerca un fornitore" aria-label="Cerca un fornitore" className="h-8" /></div>
      )}
      <div className="max-h-48 overflow-y-auto p-1">
        {visibili.map(f => (
          <label key={f.id || f.nome} className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
            <input type="checkbox" checked={dentro(f)} onChange={() => tocca(f)} className="mt-0.5 h-4 w-4 shrink-0 accent-[hsl(var(--eco-surplus))]" />
            <span className="min-w-0">
              {f.nome}
              {f.interno && <span className="block text-xs text-muted-foreground">interno: la parte ai fornitori non la riceve</span>}
              {f.fuori && <span className="block text-xs text-muted-foreground">nell'elenco, ma oggi senza questo ruolo in anagrafica</span>}
            </span>
          </label>
        ))}
        {!visibili.length && <p className="px-2 py-3 text-xs text-muted-foreground">Nessun fornitore con questo ruolo in anagrafica.</p>}
      </div>
      <div className="border-t px-2 py-1.5 text-xs text-muted-foreground">{scelti && scelti.length ? `${scelti.length} ${scelti.length === 1 ? 'scelto' : 'scelti'}` : 'Nessuno scelto'}</div>
    </div>
  );
}

function ImportiPerCanale({ bozza, cambia, esitiPassiva, esitiAttiva, destinatari, secondarie }) {
  const canali = CANALI_SURPLUS.filter(c => bozza.canali.includes(c));
  const scrivi = (c, campo, v) => cambia({ importi: { ...bozza.importi, [c]: { ...(bozza.importi[c] || {}), [campo]: v } } });
  return (
    <div className="space-y-2">
      <div className={`grid items-end gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground ${secondarie ? 'grid-cols-[minmax(0,7rem)_1fr]' : 'grid-cols-[minmax(0,7rem)_1fr_1fr]'}`}>
        <span>Canale</span><span>Ai {destinatari}</span>{!secondarie && <span>Da Ecotyre</span>}
      </div>
      {canali.map(c => (
        <div key={c} className={`grid items-center gap-2 ${secondarie ? 'grid-cols-[minmax(0,7rem)_1fr]' : 'grid-cols-[minmax(0,7rem)_1fr_1fr]'}`}>
          <span className="text-sm font-medium">{NOMI_CANALE[c]}</span>
          <CampoImporto id={`surplus-passiva-${c}`} valore={(bozza.importi[c] || {}).passiva || ''} onCambia={v => scrivi(c, 'passiva', v)} />
          {!secondarie && <CampoImporto id={`surplus-attiva-${c}`} valore={(bozza.importi[c] || {}).attiva || ''} onCambia={v => scrivi(c, 'attiva', v)} />}
        </div>
      ))}
      <p className="text-xs text-muted-foreground">Lascia vuoto l'importo che non si paga: ai fornitori, se SMOCO non paga niente in più; da Ecotyre, se Ecotyre non lo riconosce.</p>
      <Esiti esiti={[...(esitiPassiva || []), ...(esitiAttiva || [])]} />
    </div>
  );
}

/**
 * Il corpo del modulo, fuori dalla finestra cosi' si puo' disegnare anche da
 * solo (prove/surplusPagina.mjs). scheda: il surplus che si modifica (una
 * scheda di schedeSurplus); bozzaIniziale: il modulo di partenza di un surplus
 * nuovo (vuoto, o il Fuel Surcharge del consorzio).
 */
export function CorpoSurplusForm({ scheda = null, bozzaIniziale = null, surplus = [], fornitori = [], oggi: oggiDato = '', onClose, onCambiato, onSalvato }) {
  const oggi = oggiDato || oggiRoma();
  const [bozza, setBozza] = useState(() => (scheda ? bozzaDaScheda(scheda) : { ...(bozzaIniziale || bozzaVuota()) }));
  const [motivo, setMotivo] = useState('');
  const [tentato, setTentato] = useState(false);
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState('');
  const [erroriServer, setErroriServer] = useState({});
  const [mesi, setMesi] = useState(null);
  // Il gruppo di un salvataggio fermato a meta': da li' in poi e' una modifica.
  const [gruppoDaFinire, setGruppoDaFinire] = useState('');

  const schedaInModifica = useMemo(
    () => scheda || (gruppoDaFinire ? schedeSurplus(surplus, oggi).find(s => s.gruppo === gruppoDaFinire) || null : null),
    [scheda, gruppoDaFinire, surplus, oggi],
  );
  const iniziale = useMemo(() => (schedaInModifica ? bozzaDaScheda(schedaInModifica) : null), [schedaInModifica]);
  const piano = useMemo(() => pianoDelSalvataggio(bozza, { scheda: schedaInModifica, iniziale, motivo }), [bozza, schedaInModifica, iniziale, motivo]);
  const esiti = useMemo(() => esitiDelModulo(bozza, piano.cambi, surplus), [bozza, piano, surplus]);
  // La frase dice le date che si salveranno, canale per canale (revisione del
  // 13/10/2026): in una modifica un canale con date sue le tiene finche' Dal e
  // Al non si toccano, e la frase non deve dare a tutti quelle del primo.
  const frase = useMemo(() => fraseDelSurplus(bozza, piano.cambi), [bozza, piano]);
  const attesaGruppo = !!gruppoDaFinire && !schedaInModifica;

  const prestazione = bozza.prestazione;
  const destinatari = DESTINATARI[prestazione] || 'fornitori';
  const secondarie = prestazione === 'TRASPORTO_SECONDARIA';
  const tolti = schedaInModifica ? schedaInModifica.canali.map(c => c.canale).filter(c => !bozza.canali.includes(c)) : [];

  const cambia = (patch) => { setBozza(b => ({ ...b, ...patch })); setErroriServer({}); setMesi(null); setErrore(''); };
  // Gli errori si mostrano dal primo «Salva»; avvisi e conflitti subito, perche'
  // dicono qualcosa che conviene sapere mentre si scrive.
  const esitiDi = (campo) => [
    ...(esiti.perCampo[campo] || []).filter(e => tentato || e.gravita !== 'errore' || esiti.conflitti.includes(e.messaggio)),
    ...(erroriServer[campo] || []),
  ];

  const toccaCanale = (c) => {
    const ora = bozza.canali.includes(c);
    const canali = ora ? bozza.canali.filter(x => x !== c) : [...bozza.canali, c];
    const patch = { canali };
    if (!ora && bozza.perCanale && !((bozza.importi[c] || {}).passiva || (bozza.importi[c] || {}).attiva)) {
      patch.importi = { ...bozza.importi, [c]: { passiva: bozza.passiva, attiva: bozza.uguale ? bozza.passiva : bozza.attiva } };
    }
    cambia(patch);
  };
  const perCanale = (acceso) => {
    if (acceso) {
      const importi = { ...bozza.importi };
      for (const c of bozza.canali) if (!((importi[c] || {}).passiva || (importi[c] || {}).attiva)) importi[c] = { passiva: bozza.passiva, attiva: bozza.uguale ? bozza.passiva : bozza.attiva };
      cambia({ perCanale: true, importi });
    } else {
      const primo = bozza.importi[CANALI_SURPLUS.find(c => bozza.canali.includes(c))] || {};
      cambia({ perCanale: false, passiva: primo.passiva || bozza.passiva, attiva: primo.attiva || bozza.attiva, uguale: (primo.passiva || '') === (primo.attiva || '') && !!primo.passiva });
    }
  };
  const cambiaDal = (dal) => {
    const patch = { dal };
    // La fine proposta e' il 31/12 dell'anno di inizio: i contratti sono annuali.
    if (/^\d{4}-\d{2}-\d{2}$/.test(dal) && !bozza.al) patch.al = `${dal.slice(0, 4)}-12-31`;
    cambia(patch);
  };

  const salva = async (confermato = false) => {
    setTentato(true);
    if (esiti.errori || attesaGruppo) return;
    if (piano.nulla) { onClose(); return; }
    setLavoro(true);
    setErrore('');
    setErroriServer({});
    try {
      const esito = await scriviSurplus(invoca, piano.richiesta, { anteprima: !confermato && toccaMesiPassati(piano.cambi, oggi) });
      if (esito.stato === 'da_confermare') { setMesi(esito.mesi); return; }
      const nome = bozza.nome.trim() || 'Il surplus';
      const titolo = schedaInModifica && !gruppoDaFinire
        ? `${nome} aggiornato.`
        : `${nome} salvato: ${canaliAParole(bozza.canali)}${bozza.canali.length > 1 ? ', una riga per canale' : ''}.`;
      onSalvato(titolo, resocontoDelSalvataggio(esito.data, notaTraccia(esito.data)));
    } catch (e) {
      const err = erroreDellaRisposta(e);
      const perCampo = {};
      for (const x of err.errori) {
        const campo = CAMPO_DEL_MODULO[x.campo] || 'nome';
        const messaggio = x.canale && bozza.canali.length > 1 ? `${NOMI_CANALE[x.canale] || x.canale}: ${x.messaggio}` : x.messaggio;
        (perCampo[campo] = perCampo[campo] || []).push({ gravita: 'errore', messaggio });
      }
      setErroriServer(perCampo);
      setErrore(err.errori.length ? 'Il salvataggio non è riuscito: le ragioni sono sotto i campi.' : err.testo);
      if (err.gruppo && err.fatti.length) {
        setGruppoDaFinire(err.gruppo);
        if (onCambiato) onCambiato();
      }
    } finally {
      setLavoro(false);
    }
  };

  const nErrori = esiti.errori + Object.values(erroriServer).flat().length;

  return (
    <div className="space-y-5">
      <Blocco numero={1} titolo="Che cosa">
        <Campo id="surplus-nome" etichetta="Nome" aiuto="È la descrizione della riga in fattura." esiti={esitiDi('nome')}>
          <Input id="surplus-nome" value={bozza.nome} onChange={e => cambia({ nome: e.target.value })} placeholder="Fuel Surcharge" />
        </Campo>
        <Campo etichetta="Chi lo riconosce" esiti={esitiDi('origine')}>
          <Scelte etichetta="Chi lo riconosce" valore={bozza.origine} onScegli={v => cambia({ origine: v })} opzioni={[['CONSORZIO', 'Consorzio Ecotyre'], ['ACCORDO_COMMERCIALE', 'Accordo commerciale']]} />
        </Campo>
        <Campo id="surplus-riferimento" etichetta="Riferimento" facoltativo aiuto="La comunicazione o l'accordo da cui nasce." esiti={esitiDi('riferimento')}>
          <Input id="surplus-riferimento" value={bozza.riferimento} onChange={e => cambia({ riferimento: e.target.value })} placeholder="Per esempio: comunicazione Ecotyre del …" />
        </Campo>
      </Blocco>

      <Blocco numero={2} titolo="Su che cosa">
        <Campo etichetta="Canali" aiuto="Ogni canale ha la sua riga, e i canali non si sommano." esiti={esitiDi('canali')}>
          <div role="group" aria-label="Canali" className="grid grid-cols-3 gap-1.5">
            {CANALI_SURPLUS.map(c => (
              <button
                key={c} type="button" aria-pressed={bozza.canali.includes(c)} onClick={() => toccaCanale(c)}
                className={`rounded-md border px-2 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${bozza.canali.includes(c) ? SCELTO : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
              >
                {NOMI_CANALE[c]}
              </button>
            ))}
          </div>
        </Campo>
        <Campo etichetta="Su quale prestazione dei fornitori" esiti={esitiDi('prestazione')}>
          <Scelte etichetta="Prestazione" colonne="grid-cols-2 sm:grid-cols-4" valore={prestazione} onScegli={v => cambia({ prestazione: v })} opzioni={Object.entries(NOMI_PRESTAZIONE_MODULO)} />
        </Campo>
        <Campo etichetta="A chi" esiti={esitiDi('a_chi')}>
          <Scelte etichetta="A chi" valore={bozza.a_chi} onScegli={v => cambia({ a_chi: v })} opzioni={[['tutti', `Tutti i ${destinatari}`], ['elenco', 'Solo questi fornitori']]} />
          {bozza.a_chi === 'elenco' && <SceltaFornitori fornitori={fornitori} prestazione={prestazione} scelti={bozza.fornitori} onCambia={f => cambia({ fornitori: f })} />}
          {bozza.a_chi === 'tutti' && <p className="text-xs text-muted-foreground">Anche quelli che arriveranno dopo: vale per chiunque abbia nel mese una riga di questa prestazione.</p>}
        </Campo>
      </Blocco>

      <Blocco numero={3} titolo="Quanto">
        {bozza.perCanale ? (
          <ImportiPerCanale bozza={bozza} cambia={cambia} esitiPassiva={esitiDi('passiva')} esitiAttiva={esitiDi('attiva')} destinatari={destinatari} secondarie={secondarie} />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo id="surplus-passiva" etichetta={`Ai ${destinatari}`} aiuto="Quanto SMOCO paga in più. Vuoto se non paga niente." esiti={esitiDi('passiva')}>
              <CampoImporto id="surplus-passiva" valore={bozza.passiva} onCambia={v => cambia({ passiva: v })} />
            </Campo>
            <Campo id="surplus-attiva" etichetta="Da Ecotyre" esiti={esitiDi('attiva')}>
              {secondarie ? (
                <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">Il trasporto delle secondarie non si fattura a Ecotyre: questo surplus ha solo la parte ai fornitori.</p>
              ) : (
                <>
                  {bozza.uguale
                    ? <div className="flex h-10 items-center rounded-md border bg-muted/30 px-3 text-sm tabular-nums text-muted-foreground">{bozza.passiva ? `${bozza.passiva} €/t` : 'come ai fornitori'}</div>
                    : <CampoImporto id="surplus-attiva" valore={bozza.attiva} onCambia={v => cambia({ attiva: v })} />}
                  <label className="flex cursor-pointer items-center gap-2 text-xs">
                    <input type="checkbox" checked={bozza.uguale} onChange={e => cambia({ uguale: e.target.checked, attiva: e.target.checked ? bozza.attiva : bozza.passiva })} className="h-4 w-4 accent-[hsl(var(--eco-surplus))]" />
                    uguale a quello dei fornitori
                  </label>
                  <p className="text-xs text-muted-foreground">Quanto SMOCO fattura in più a Ecotyre. Vuoto se Ecotyre non lo paga.</p>
                </>
              )}
            </Campo>
          </div>
        )}
        {bozza.canali.length > 1 && (
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input type="checkbox" checked={bozza.perCanale} onChange={e => perCanale(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--eco-surplus))]" />
            importi diversi per canale
          </label>
        )}
      </Blocco>

      <Blocco numero={4} titolo="Quando">
        <div className="grid grid-cols-2 gap-3">
          <Campo id="surplus-dal" etichetta="Dal" esiti={esitiDi('dal')}>
            <Input id="surplus-dal" type="date" value={bozza.dal} onChange={e => cambiaDal(e.target.value)} />
          </Campo>
          <Campo id="surplus-al" etichetta="Al" esiti={esitiDi('al')}>
            <Input id="surplus-al" type="date" value={bozza.al} onChange={e => cambia({ al: e.target.value })} />
          </Campo>
        </div>
        {/* Le date della scorciatoia del consorzio sono una proposta, da
            confermare ogni anno (13/10/2026): si dice finche' Dal e Al restano
            quelli proposti. */}
        {bozza.proposta && bozza.dal === bozza.proposta.dal && bozza.al === bozza.proposta.al && (
          <div role="note" className="flex items-start gap-2 rounded-md border border-dashed border-[hsl(var(--eco-surplus)/0.45)] bg-[hsl(var(--eco-surplus)/0.05)] px-3 py-2 text-xs leading-relaxed">
            <Info className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${TINTA}`} aria-hidden="true" />
            <p><span className={`font-semibold ${TINTA}`}>Date da confermare.</span> {bozza.proposta.testo}</p>
          </div>
        )}
        <p className="text-xs text-muted-foreground">Sul giorno della fine del trasporto, estremi compresi. Al più fino al 31/12 dell'anno in cui comincia: i contratti sono annuali.</p>
        {schedaInModifica && !schedaInModifica.dateUguali && (
          <p className="text-xs text-amber-700 dark:text-amber-400">{testoDateDiverse(schedaInModifica)}</p>
        )}
      </Blocco>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo id="surplus-note" etichetta="Note" facoltativo>
          <Input id="surplus-note" value={bozza.note} onChange={e => cambia({ note: e.target.value })} />
        </Campo>
        <Campo id="surplus-motivo" etichetta="Motivo" facoltativo aiuto="Resta nello storico delle modifiche.">
          <Input id="surplus-motivo" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Per esempio: comunicazione del consorzio" />
        </Campo>
      </div>

      <div className="space-y-2 rounded-lg border border-l-[3px] border-l-[hsl(var(--eco-surplus))] bg-[hsl(var(--eco-surplus)/0.05)] p-3 text-sm">
        <div className={`text-[11px] font-semibold uppercase tracking-wide ${TINTA}`}>Che cosa succede</div>
        <p className="leading-relaxed">{frase}</p>
        {tolti.length > 0 && <p className="text-xs">Togliendo {canaliAParole(tolti)}, il surplus su {tolti.length === 1 ? 'quel canale' : 'quei canali'} si elimina: resta solo nello storico delle modifiche.</p>}
        {esiti.chiusure.map((m, i) => <p key={`c${i}`} className="flex items-start gap-1 text-xs"><Info className={`mt-0.5 h-3 w-3 shrink-0 ${TINTA}`} aria-hidden="true" />{m}</p>)}
        {esiti.avvisi.map((m, i) => <p key={`a${i}`} className="flex items-start gap-1 text-xs text-amber-700 dark:text-amber-400"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />{m}</p>)}
      </div>

      {mesi && (
        <div className="space-y-1.5 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <div className="flex items-center gap-1.5 text-sm font-semibold"><AlertTriangle className="h-4 w-4" aria-hidden="true" /> Questo cambia mesi già chiusi</div>
          <ul className="list-disc space-y-1 pl-4">{mesi.map((m, i) => <li key={i}>{m.messaggio}</li>)}</ul>
          <p>Se va bene così, premi «Salva comunque».</p>
        </div>
      )}
      {errore && <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{errore}</p>}

      <div className="flex flex-col-reverse gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-destructive">{tentato && nErrori ? `${nErrori === 1 ? 'C\'è una cosa' : `Ci sono ${nErrori} cose`} da sistemare: ${nErrori === 1 ? 'la trovi' : 'le trovi'} sotto i campi.` : ''}</p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" onClick={onClose} disabled={lavoro}>Annulla</Button>
          <Button onClick={() => salva(!!mesi)} disabled={lavoro || attesaGruppo}>
            {lavoro ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            {mesi ? 'Salva comunque' : gruppoDaFinire ? 'Salva quello che manca' : 'Salva'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Il titolo e la riga sotto, secondo che cosa si apre. */
export function testaDelModulo({ scheda = null, fuel = false } = {}) {
  if (scheda) return { titolo: `Modifica: ${scheda.nome}`, descrizione: 'Le modifiche valgono per tutti i canali del surplus. Nello storico resta chi le ha fatte, quando e perché.' };
  if (fuel) return { titolo: 'Fuel Surcharge del consorzio', descrizione: 'Il modulo è già compilato come il Fuel Surcharge del consorzio Ecotyre: controlla importi e date con la comunicazione prima di salvare.' };
  return { titolo: 'Nuovo surplus', descrizione: 'Un importo in più, sempre in €/t, con le sue date. Si paga e si fattura con una riga a parte, sulle stesse tonnellate del mese.' };
}

/** La finestra del modulo. chiave cambia a ogni apertura: il modulo riparte pulito. */
export default function SurplusForm({ aperto, chiave = 0, onClose, ...resto }) {
  const { titolo, descrizione } = testaDelModulo(resto);
  return (
    <Dialog open={!!aperto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">{resto.fuel && <Fuel className={`h-5 w-5 ${TINTA}`} aria-hidden="true" />}{titolo}</DialogTitle>
          <DialogDescription>{descrizione}</DialogDescription>
        </DialogHeader>
        {aperto && <CorpoSurplusForm key={chiave} onClose={onClose} {...resto} />}
      </DialogContent>
    </Dialog>
  );
}
