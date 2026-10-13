import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { notaTraccia } from '@/lib/scriviConTraccia';
import { oggiRoma } from '@/lib/giornoItaliano';
import { NOMI_CANALE, aiDestinatari } from '@/lib/surplus';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import StoricoModifiche from '@/components/shared/StoricoModifiche';
import { Plus, Fuel, Pencil, CalendarX, History, Trash2, Loader2, ChevronDown, ChevronRight, ArrowRight, AlertTriangle, X, RotateCcw } from 'lucide-react';
import SurplusForm from './SurplusForm';
import {
  schedeSurplus, schedaNellaFascia, avanzamento, dataIt, dataBreve, piuEuroT, canaliAParole, importiAParole, testoTariffe,
  NOMI_STATO, NOMI_PRESTAZIONE_MODULO, bozzaVuota, bozzaFuelSurcharge, chiusuraDelPeriodo, eliminazioneDellaScheda,
  toccaMesiPassati, scriviSurplus, erroreDellaRisposta, resocontoDelSalvataggio,
} from './surplusTariffe';

// LA SCHEDA DEI SURPLUS DI TARIFFE & ANAGRAFICHE (13/10/2026).
//
// Richiesta dell'utente del 12/10/2026: accanto alle tariffe dei fornitori un
// eventuale surplus in €/t, con le sue date, quando il consorzio o un accordo
// commerciale lo indicano (il Fuel Surcharge del consorzio Ecotyre: +5 €/t da
// ottobre a dicembre su rete, ACI ed extra raccolta), «in modo ordinato,
// elegante e professionale nonche' semplice a colpo d'occhio».
//
// Qui: la scheda «Surplus» (una carta per surplus, i suoi canali insieme), la
// fascia dei surplus in corso in cima alle tariffe e le pastiglie della colonna
// «Surplus». Il colore e' uno solo, il token --eco-surplus di src/index.css:
// l'indaco delle righe del surplus in passiva, in attiva e nei fogli. Si scrive solo
// attraverso gestisciAnagrafiche (solo l'amministratore, ogni record con la sua
// traccia nello storico delle modifiche); i conti stanno in surplusTariffe.js e
// in src/lib/surplus.js, le regole sono quelle del calcolo.
//
// L'importo ai fornitori e' un costo: a chi non e' amministratore non si
// mostra (la pagina e' sua, ma la scheda non lo deve dare per scontato).
// Nessuna spiegazione in title=, che sul telefono non si vede: al tocco si apre
// un riquadro.

// Il colore del surplus, scritto per intero perche' Tailwind lo trovi nel sorgente.
const TINTA = 'text-[hsl(var(--eco-surplus))]';
const FONDO = 'bg-[hsl(var(--eco-surplus)/0.08)]';
const FONDO_PIENO = 'bg-[hsl(var(--eco-surplus)/0.14)]';
const BORDO = 'border-[hsl(var(--eco-surplus)/0.45)]';
const BARRETTA = 'border-l-[3px] border-l-[hsl(var(--eco-surplus))]';

const invoca = (nome, corpo) => base44.functions.invoke(nome, corpo);
const giorniTesto = (n) => `${n} ${n === 1 ? 'giorno' : 'giorni'}`;

// === La colonna «Surplus» delle tariffe ===

function PastigliaSurplus({ voce, inArrivo, attiva, prestazione, onVai }) {
  const importo = piuEuroT(voce.euro_t);
  const testo = inArrivo ? `dal ${dataBreve(voce.dal)} ${importo}` : importo;
  const verso = attiva
    ? 'da Ecotyre'
    : voce.a_chi === 'elenco' ? 'a questo fornitore' : aiDestinatari(prestazione, 'elenco').replace(/ dell'elenco$/, '');
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${voce.nome}: ${testo}`}
          className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${TINTA} ${inArrivo ? `border border-dashed ${BORDO} hover:bg-[hsl(var(--eco-surplus)/0.08)]` : `${FONDO_PIENO} hover:bg-[hsl(var(--eco-surplus)/0.22)]`}`}
        >
          {testo}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 max-w-[calc(100vw-2rem)] space-y-2 text-xs leading-relaxed">
        <div>
          <div className="text-sm font-semibold">{voce.nome}</div>
          {(voce.origine || voce.riferimento) && <div className="text-muted-foreground">{[voce.origine, voce.riferimento].filter(Boolean).join(' · ')}</div>}
        </div>
        <div><span className={`font-semibold tabular-nums ${TINTA}`}>{importo}</span> {verso}{voce.tipologie && voce.tipologie.length ? ` · ${canaliAParole(voce.tipologie)}` : ''}</div>
        <div>{inArrivo ? 'Comincia' : 'Vale'} dal {dataIt(voce.dal)} al {dataIt(voce.al)}.</div>
        <div className="text-muted-foreground">Si conta sulle stesse tonnellate del mese, con una riga a parte sotto quella della tariffa.</div>
        {onVai && (
          <button type="button" onClick={onVai} className={`inline-flex items-center gap-1 font-medium ${TINTA} hover:underline`}>
            Vedi i surplus <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * La cella della colonna «Surplus»: col e' il risultato di surplusDellaTariffa
 * per la tariffa, null se i surplus non si sono letti (allora non si dice «—»,
 * che vorrebbe dire «nessuno»: un valore mancante non e' zero).
 */
export function PastiglieSurplus({ col, tariffa, onVai }) {
  if (col === null || col === undefined) return <span className="text-xs italic text-muted-foreground">non letto</span>;
  const oggi = col.oggi || [];
  const arrivo = col.in_arrivo || [];
  if (!oggi.length && !arrivo.length) return <span className="text-muted-foreground">—</span>;
  const attiva = String((tariffa && tariffa.direzione) || '').toUpperCase() === 'ATTIVA';
  const prestazione = String((tariffa && tariffa.prestazione) || '').toUpperCase();
  return (
    <div className="flex flex-wrap items-center gap-1">
      {oggi.map(v => <PastigliaSurplus key={`o-${v.id}-${v.dal}`} voce={v} inArrivo={false} attiva={attiva} prestazione={prestazione} onVai={onVai} />)}
      {arrivo.map(v => <PastigliaSurplus key={`a-${v.id}-${v.dal}`} voce={v} inArrivo attiva={attiva} prestazione={prestazione} onVai={onVai} />)}
    </div>
  );
}

/**
 * La fascia in cima alle tariffe: i surplus in corso (e quelli in arrivo), con
 * quante tariffe toccano. Si nasconde se non ce ne sono. Neutra e sottile: qui
 * l'ambra e il rosso vogliono dire «c'e' un problema», e un surplus non lo e'.
 * Di ogni surplus dice solo i canali vivi, ognuno fino al suo giorno
 * (schedaNellaFascia, revisione del 13/10/2026): un canale chiuso prima non
 * deve sembrare prendere due surplus.
 */
export function FasciaSurplus({ schede, conti, conCosti = true, onVai }) {
  const vive = (schede || []).map(schedaNellaFascia).filter(Boolean);
  if (!vive.length) return null;
  return (
    <div className={`rounded-lg border ${BARRETTA} bg-[hsl(var(--eco-surplus)/0.04)] px-3 py-2.5 text-sm`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <ul className="space-y-1.5">
          {vive.map(s => (
            <li key={s.chiave} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className={`text-[11px] font-semibold uppercase tracking-wide ${TINTA}`}>{s.etichetta}</span>
              <span className="font-semibold">{s.nome}</span>
              <span className={`font-semibold tabular-nums ${TINTA}`}>{importiAParole(s, { conCosti })}</span>
              <span className="text-muted-foreground">
                {[s.origine_testo, ...s.dove, testoTariffe(conti && conti.get(s.chiave))].filter(Boolean).join(' · ')}
              </span>
            </li>
          ))}
        </ul>
        {onVai && (
          <button type="button" onClick={onVai} className={`inline-flex shrink-0 items-center gap-1 self-start text-xs font-medium ${TINTA} hover:underline`}>
            Vedi i surplus <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

// === La scheda di un surplus ===

function StatoSurplus({ stato }) {
  const stile = stato === 'in_corso'
    ? `${FONDO_PIENO} ${TINTA}`
    : stato === 'in_arrivo' ? `border border-dashed ${BORDO} ${TINTA}` : 'bg-muted text-muted-foreground';
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${stile}`}>{NOMI_STATO[stato] || stato}</span>;
}

function BarraPeriodo({ scheda, oggi }) {
  const { pct, giorni } = avanzamento(scheda.dal, scheda.al, oggi);
  const spenta = scheda.stato === 'concluso' || scheda.stato === 'disattivato';
  const testo = scheda.stato === 'in_corso'
    ? (giorni === 0 ? `oggi ${dataIt(oggi)} · ultimo giorno` : `oggi ${dataIt(oggi)} · ancora ${giorniTesto(giorni)}`)
    : scheda.stato === 'in_arrivo' ? `comincia fra ${giorniTesto(giorni || 0)}`
      : scheda.stato === 'concluso' ? `concluso il ${dataIt(scheda.al)}`
        : 'disattivato: non vale mai, nemmeno nelle sue date';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-medium tabular-nums">
        <span>{dataIt(scheda.dal) || '—'}</span>
        <span>{dataIt(scheda.al) || '—'}</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-muted" role="img" aria-label={`Periodo dal ${dataIt(scheda.dal)} al ${dataIt(scheda.al)}: ${testo}`}>
        {pct !== null && <div className={`absolute inset-y-0 left-0 rounded-full ${spenta ? 'bg-muted-foreground/40' : 'bg-[hsl(var(--eco-surplus))]'}`} style={{ width: `${pct}%` }} />}
        {scheda.stato === 'in_corso' && pct !== null && (
          <div className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-[hsl(var(--eco-surplus))]" style={{ left: `${pct}%` }} />
        )}
      </div>
      <p className="text-xs text-muted-foreground">{testo}</p>
    </div>
  );
}

function Importo({ etichetta, valore, vuoto }) {
  return (
    <div className={`rounded-md px-3 py-2 ${valore !== null ? FONDO : 'bg-muted/40'}`}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{etichetta}</div>
      {valore !== null
        ? <div className={`text-lg font-semibold tabular-nums leading-tight ${TINTA}`}>{piuEuroT(valore)}</div>
        : <div className="text-sm text-muted-foreground">{vuoto}</div>}
    </div>
  );
}

function ImportiDellaScheda({ scheda, conCosti }) {
  const ai = aiDestinatari(scheda.prestazione, 'elenco').replace(/ dell'elenco$/, '');
  const destinatari = ai.charAt(0).toUpperCase() + ai.slice(1);
  const secondarie = scheda.prestazione === 'TRASPORTO_SECONDARIA';
  if (scheda.importiUguali) {
    return (
      <div className={`grid grid-cols-1 gap-2 ${conCosti ? 'sm:grid-cols-2' : ''}`}>
        {conCosti && <Importo etichetta={destinatari} valore={scheda.passiva} vuoto="non si paga: solo da Ecotyre" />}
        <Importo etichetta="Da Ecotyre" valore={scheda.attiva} vuoto={secondarie ? 'le secondarie non si fatturano a Ecotyre' : 'non si fattura: solo ai fornitori'} />
      </div>
    );
  }
  // Importi diversi fra i canali: una riga per canale, cosi' non si sommano
  // nemmeno a occhio.
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
          <th className="py-1 pr-2 text-left font-medium">Canale</th>
          {conCosti && <th className="px-2 py-1 text-right font-medium">{destinatari}</th>}
          <th className="py-1 pl-2 text-right font-medium">Da Ecotyre</th>
        </tr>
      </thead>
      <tbody>
        {scheda.canali.map(c => (
          <tr key={c.canale} className="border-t">
            <td className="py-1.5 pr-2">{NOMI_CANALE[c.canale] || c.canale}</td>
            {conCosti && <td className={`px-2 py-1.5 text-right font-semibold tabular-nums ${c.passiva !== null ? TINTA : 'text-muted-foreground font-normal'}`}>{c.passiva !== null ? piuEuroT(c.passiva) : 'non si paga'}</td>}
            <td className={`py-1.5 pl-2 text-right font-semibold tabular-nums ${c.attiva !== null ? TINTA : 'text-muted-foreground font-normal'}`}>{c.attiva !== null ? piuEuroT(c.attiva) : 'non si fattura'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function aChiTesto(scheda) {
  if (scheda.a_chi !== 'elenco') return aiDestinatari(scheda.prestazione, 'tutti');
  const nomi = scheda.fornitori.map(f => f.nome).filter(Boolean);
  if (!nomi.length) return 'solo ai fornitori scelti';
  return nomi.length <= 3 ? `solo a ${nomi.join(', ')}` : `solo a ${nomi.length} fornitori: ${nomi.join(', ')}`;
}

function SchedaSurplus({ scheda, oggi, conCosti, isAdmin, onModifica, onChiudi, onStorico, onElimina }) {
  const spenta = scheda.stato === 'concluso' || scheda.stato === 'disattivato';
  return (
    <article className={`space-y-3 rounded-lg border border-l-4 bg-card p-4 shadow-sm ${spenta ? 'border-l-muted-foreground/30' : 'border-l-[hsl(var(--eco-surplus))]'}`}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-tight">{scheda.nome}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{[scheda.origine_testo, scheda.riferimento].filter(Boolean).join(' · ') || 'origine non scritta'}</p>
        </div>
        <StatoSurplus stato={scheda.stato} />
      </header>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {scheda.canali.map(c => (
          <span key={c.canale} className={`rounded-md border px-1.5 py-0.5 font-medium ${c.stato === 'disattivato' ? 'text-muted-foreground line-through' : ''}`}>{NOMI_CANALE[c.canale] || c.canale}</span>
        ))}
        <span className="text-muted-foreground">{NOMI_PRESTAZIONE_MODULO[scheda.prestazione] || scheda.prestazione} · {aChiTesto(scheda)}</span>
      </div>
      <ImportiDellaScheda scheda={scheda} conCosti={conCosti} />
      <BarraPeriodo scheda={scheda} oggi={oggi} />
      {!scheda.dateUguali && (
        <p className="text-xs text-muted-foreground">
          Le date cambiano da canale a canale: {scheda.canali.map(c => `${NOMI_CANALE[c.canale] || c.canale} dal ${dataIt(c.dal)} al ${dataIt(c.al)}`).join(' · ')}.
        </p>
      )}
      {scheda.note && <p className="text-xs italic text-muted-foreground">{scheda.note}</p>}
      {isAdmin && (
        <footer className="flex flex-wrap gap-1 border-t pt-2">
          <Button size="sm" variant="ghost" className="h-8 px-2" onClick={onModifica}><Pencil className="mr-1 h-3.5 w-3.5" /> Modifica</Button>
          {scheda.stato === 'in_corso' && <Button size="sm" variant="ghost" className="h-8 px-2" onClick={onChiudi}><CalendarX className="mr-1 h-3.5 w-3.5" /> Chiudi il periodo</Button>}
          <Button size="sm" variant="ghost" className="h-8 px-2" onClick={onStorico}><History className="mr-1 h-3.5 w-3.5" /> Storico</Button>
          <Button size="sm" variant="ghost" className="h-8 px-2 text-destructive hover:text-destructive" onClick={onElimina}><Trash2 className="mr-1 h-3.5 w-3.5" /> Elimina</Button>
        </footer>
      )}
    </article>
  );
}

// === Le finestre: chiudere il periodo, eliminare, lo storico ===

function MesiChiusi({ mesi }) {
  return (
    <div className="space-y-1.5 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
      <div className="flex items-center gap-1.5 text-sm font-semibold"><AlertTriangle className="h-4 w-4" aria-hidden="true" /> Questo cambia mesi già chiusi</div>
      <ul className="list-disc space-y-1 pl-4">{mesi.map((m, i) => <li key={i}>{m.messaggio}</li>)}</ul>
    </div>
  );
}

// Chiudere il periodo e eliminare hanno lo stesso passo: prima, se il cambio
// tocca un mese passato o in corso, si chiede al server quali mesi gia' chiusi
// cambiano; se ce ne sono si mostra e si aspetta la conferma.
function useScrittura(oggi, onFatto) {
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState('');
  const [mesi, setMesi] = useState(null);
  const esegui = async (richieste, cambi, confermato = false) => {
    setLavoro(true);
    setErrore('');
    try {
      const esito = await scriviSurplus(invoca, richieste, { anteprima: !confermato && toccaMesiPassati(cambi, oggi) });
      if (esito.stato === 'da_confermare') { setMesi(esito.mesi); return; }
      onFatto(resocontoDelSalvataggio(esito.data, notaTraccia(esito.data)));
    } catch (e) {
      setErrore(erroreDellaRisposta(e).testo);
    } finally {
      setLavoro(false);
    }
  };
  return { lavoro, errore, setErrore, mesi, setMesi, esegui };
}

function FinestraChiudiPeriodo({ scheda, oggi, onClose, onFatto }) {
  const [giorno, setGiorno] = useState(oggi);
  const [motivo, setMotivo] = useState('');
  const s = useScrittura(oggi, (righe) => onFatto(`${scheda.nome}: periodo chiuso al ${dataIt(giorno)}.`, righe));
  const conferma = (confermato) => {
    const piano = chiusuraDelPeriodo(scheda, giorno, motivo);
    if (piano.errore) { s.setErrore(piano.errore); return; }
    s.esegui(piano.richieste, piano.cambi, confermato);
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Chiudi il periodo</DialogTitle>
          <DialogDescription>{scheda.nome} vale fino al {dataIt(scheda.al)}. Chiudere il periodo lo accorcia: fino alla data che scrivi resta valido com'è.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="chiudi-surplus-al" className="block text-xs font-medium">Ultimo giorno di validità</label>
            <Input id="chiudi-surplus-al" type="date" value={giorno} onChange={e => { setGiorno(e.target.value); s.setMesi(null); s.setErrore(''); }} />
          </div>
          <div className="space-y-1">
            <label htmlFor="chiudi-surplus-motivo" className="block text-xs font-medium">Motivo <span className="font-normal text-muted-foreground">· facoltativo, resta nello storico</span></label>
            <Input id="chiudi-surplus-motivo" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Per esempio: comunicazione del consorzio" />
          </div>
          {s.mesi && <MesiChiusi mesi={s.mesi} />}
          {s.errore && <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{s.errore}</p>}
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={onClose} disabled={s.lavoro}>Annulla</Button>
            <Button onClick={() => conferma(!!s.mesi)} disabled={s.lavoro}>
              {s.lavoro ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CalendarX className="mr-1 h-4 w-4" />}
              {s.mesi ? 'Chiudi comunque' : 'Chiudi il periodo'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FinestraElimina({ scheda, oggi, onClose, onFatto }) {
  const [motivo, setMotivo] = useState('');
  const s = useScrittura(oggi, (righe) => onFatto(`${scheda.nome} eliminato da ${canaliAParole(scheda.canali.map(c => c.canale))}.`, righe));
  const conferma = (confermato) => {
    const piano = eliminazioneDellaScheda(scheda, motivo);
    s.esegui(piano.richiesta, piano.cambi, confermato);
  };
  const giaUsato = scheda.stato === 'in_corso' || scheda.stato === 'concluso';
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Elimina il surplus</DialogTitle>
          <DialogDescription>
            {scheda.nome}, {canaliAParole(scheda.canali.map(c => c.canale))}, dal {dataIt(scheda.dal)} al {dataIt(scheda.al)}. L'eliminazione vale per tutti i canali ed è definitiva; resta solo nello storico delle modifiche.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {giaUsato && (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              Il surplus ha già coperto dei giorni: eliminandolo sparisce anche dai mesi passati. Se deve solo finire prima, chiudi il periodo: i mesi che ha coperto restano com'erano.
            </p>
          )}
          <div className="space-y-1">
            <label htmlFor="elimina-surplus-motivo" className="block text-xs font-medium">Motivo <span className="font-normal text-muted-foreground">· facoltativo, resta nello storico</span></label>
            <Input id="elimina-surplus-motivo" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Per esempio: scritto per sbaglio" />
          </div>
          {s.mesi && <MesiChiusi mesi={s.mesi} />}
          {s.errore && <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{s.errore}</p>}
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={onClose} disabled={s.lavoro}>Annulla</Button>
            <Button variant="destructive" onClick={() => conferma(!!s.mesi)} disabled={s.lavoro}>
              {s.lavoro ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1 h-4 w-4" />}
              {s.mesi ? 'Elimina comunque' : 'Elimina'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FinestraStorico({ scheda, onClose }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Storico: {scheda.nome}</DialogTitle>
          <DialogDescription>Chi ha scritto o cambiato il surplus, quando, da che cosa a che cosa e perché. Un canale per volta.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {scheda.canali.map(c => (
            <section key={c.id || c.canale} className="space-y-1">
              <h4 className="text-sm font-semibold">{NOMI_CANALE[c.canale] || c.canale}</h4>
              <StoricoModifiche entita="SurplusTariffa" recordId={c.id} aperto />
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Il resoconto dell'ultima scrittura, in cima alla scheda finche' non si chiude.
function Resoconto({ resoconto, onChiudi }) {
  return (
    <div role="status" className={`flex items-start justify-between gap-3 rounded-lg border ${BARRETTA} bg-card px-3 py-2 text-sm`}>
      <div className="space-y-1">
        <div className="font-medium">{resoconto.titolo}</div>
        {resoconto.righe.map((r, i) => <p key={i} className="text-xs text-muted-foreground">{r}</p>)}
      </div>
      <button type="button" onClick={onChiudi} aria-label="Chiudi il messaggio" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button>
    </div>
  );
}

/**
 * La scheda «Surplus». surplus: i record di SurplusTariffa letti tutti (null se
 * la lettura non e' riuscita: erroreLettura dice perche'); onCambiato rilegge
 * i surplus dopo una scrittura, e solo quelli.
 */
export default function SurplusSezione({ surplus, erroreLettura = '', fornitori = [], isAdmin = false, oggi: oggiDato = '', onCambiato, onRiprova }) {
  const oggi = oggiDato || oggiRoma();
  const schede = useMemo(() => schedeSurplus(surplus || [], oggi), [surplus, oggi]);
  const [mostraPassati, setMostraPassati] = useState(false);
  const [modulo, setModulo] = useState(null);
  const [aperture, setAperture] = useState(0);
  const [daChiudere, setDaChiudere] = useState(null);
  const [daEliminare, setDaEliminare] = useState(null);
  const [storico, setStorico] = useState(null);
  const [resoconto, setResoconto] = useState(null);

  const vive = schede.filter(s => s.stato === 'in_corso' || s.stato === 'in_arrivo');
  const passate = schede.filter(s => s.stato === 'concluso' || s.stato === 'disattivato');
  const apri = (m) => { setAperture(n => n + 1); setModulo(m); setResoconto(null); };
  const fatto = (titolo, righe) => {
    setModulo(null); setDaChiudere(null); setDaEliminare(null);
    setResoconto({ titolo, righe: righe || [] });
    if (onCambiato) onCambiato();
  };
  const scheda = (s) => (
    <SchedaSurplus
      key={s.chiave} scheda={s} oggi={oggi} conCosti={isAdmin} isAdmin={isAdmin}
      onModifica={() => apri({ scheda: s })}
      onChiudi={() => { setResoconto(null); setDaChiudere(s); }}
      onStorico={() => setStorico(s)}
      onElimina={() => { setResoconto(null); setDaEliminare(s); }}
    />
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Un surplus è un importo in più, sempre in €/t, che il consorzio o un accordo commerciale riconosce per un periodo.
          Si paga ai fornitori e si fattura a Ecotyre con una riga a parte, sulle stesse tonnellate del mese: ogni canale ha la sua riga, e i canali non si sommano.
        </p>
        {isAdmin && (
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button size="sm" onClick={() => apri({ bozza: bozzaVuota() })}><Plus className="mr-1 h-4 w-4" /> Nuovo surplus</Button>
            <Button size="sm" variant="outline" onClick={() => apri({ bozza: bozzaFuelSurcharge(oggi), fuel: true })}><Fuel className="mr-1 h-4 w-4" /> Fuel Surcharge del consorzio</Button>
          </div>
        )}
      </div>

      {resoconto && <Resoconto resoconto={resoconto} onChiudi={() => setResoconto(null)} />}

      {surplus === null && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <span>I surplus non si sono letti{erroreLettura ? ` (${erroreLettura})` : ''}: finché non si rileggono non si sa quali valgono.</span>
          {onRiprova && <Button size="sm" variant="outline" onClick={onRiprova}><RotateCcw className="mr-1 h-3.5 w-3.5" /> Riprova</Button>}
        </div>
      )}

      {surplus !== null && !schede.length && (
        <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          Nessun surplus. Quando il consorzio o un accordo commerciale riconosce un importo in più, scrivilo qui: comparirà accanto alle tariffe e nella fatturazione del mese, con la sua riga.
        </div>
      )}

      {vive.length > 0 && <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">{vive.map(scheda)}</div>}

      {passate.length > 0 && (
        <div className="space-y-3">
          <button type="button" onClick={() => setMostraPassati(v => !v)} className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
            {mostraPassati ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {mostraPassati ? 'Nascondi' : 'Mostra'} i conclusi e i disattivati ({passate.length})
          </button>
          {mostraPassati && <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">{passate.map(scheda)}</div>}
        </div>
      )}

      {isAdmin && (
        <SurplusForm
          aperto={!!modulo}
          chiave={aperture}
          scheda={modulo && modulo.scheda}
          bozzaIniziale={modulo && modulo.bozza}
          fuel={!!(modulo && modulo.fuel)}
          surplus={surplus || []}
          fornitori={fornitori}
          oggi={oggi}
          onClose={() => setModulo(null)}
          onCambiato={onCambiato}
          onSalvato={fatto}
        />
      )}
      {daChiudere && <FinestraChiudiPeriodo scheda={daChiudere} oggi={oggi} onClose={() => setDaChiudere(null)} onFatto={fatto} />}
      {daEliminare && <FinestraElimina scheda={daEliminare} oggi={oggi} onClose={() => setDaEliminare(null)} onFatto={fatto} />}
      {storico && <FinestraStorico scheda={storico} onClose={() => setStorico(null)} />}
    </div>
  );
}
