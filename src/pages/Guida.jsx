import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePermessi } from '@/lib/permessi';
import {
  MODULI, cercaNellaGuida, livelliDaMostrare, livelloDellaGuida, nomeLivello, notePerLivello,
  pezziEvidenziati, idDelModulo, moduloApribile, domandaPerEcoTyna, sezioniVisibili,
} from '@/lib/guida';
import { BookOpen, Search, X, ChevronRight, Lock, ArrowRight, ArrowUp, Check } from 'lucide-react';

// LA GUIDA (14/10/2026).
//
// Proposta all'utente il 14/10/2026 e accettata lo stesso giorno: una guida
// dentro il gestionale per chi non e' amministratore - che cosa vede, che cosa
// puo' esportare, come apre una richiesta - e per l'amministratore anche i
// passi del mese. I testi stanno in src/lib/guida.js; qui si mostrano soltanto.
//
// Chi legge vede la guida del suo livello; l'amministratore vede anche le parti
// degli altri livelli, segnate col loro nome, per sapere che cosa vedono loro.
// La pagina non legge nessun archivio: il livello viene da usePermessi, che lo
// ha gia' letto il menu, e il resto e' testo. Nessuna richiesta in piu' al
// server per chi la apre.
//
// Sul telefono (375 px) e' una colonna sola: i moduli si aprono al tocco,
// nessuna tabella larga. La ricerca sta in cima alla pagina e scorre con lei:
// non puo' restare ferma, perche' il <main> del Layout ha un suo scorrimento
// che non scorre mai (a scorrere e' la finestra), e un elemento sticky si
// aggancia a quello (15/10/2026; prove/guida.mjs, sezione 7). In fondo,
// «Torna alla ricerca» riporta su.

const ID_RICERCA = 'cerca-guida';

/** Il testo con le parole cercate evidenziate. */
export function Evidenziato({ testo, radici }) {
  const pezzi = pezziEvidenziati(testo, radici);
  return (
    <>
      {pezzi.map((p, i) => (p.evidenziato
        ? <mark key={i} className="rounded-sm bg-amber-200/80 px-0.5 text-foreground">{p.testo}</mark>
        : <React.Fragment key={i}>{p.testo}</React.Fragment>))}
    </>
  );
}

/** Un collegamento della guida: dentro il gestionale, mai fuori. */
function Collegamento({ percorso, testo }) {
  return (
    <Link to={percorso} className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-2 hover:underline">
      {testo} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
    </Link>
  );
}

/** Un elenco di frasi, con un titolo piccolo sopra. */
function Blocco({ titolo, voci, vuoto, radici, icona = null }) {
  if (!(voci && voci.length) && !vuoto) return null;
  return (
    <div className="space-y-1">
      <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{icona}{titolo}</h4>
      {voci && voci.length ? (
        <ul className="list-disc space-y-1 pl-5">
          {voci.map((v, i) => <li key={i} className="break-words"><Evidenziato testo={v} radici={radici} /></li>)}
        </ul>
      ) : (
        <p className="break-words text-muted-foreground"><Evidenziato testo={vuoto} radici={radici} /></p>
      )}
    </div>
  );
}

/** Che cosa puo' fare chi legge: il suo livello, o tutti e tre all'amministratore. */
export function LivelliGuida({ livelli, radici }) {
  return (
    <section id="livello" className="scroll-mt-24 space-y-3 rounded-lg border bg-card p-4">
      <h2 className="font-heading text-lg font-semibold">{livelli.length > 1 ? 'I livelli' : 'Il tuo livello'}</h2>
      {livelli.map(l => (
        <div key={l.chiave} className={`space-y-2 rounded-md border p-3 ${l.tuo ? 'border-primary/40 bg-primary/5' : ''}`}>
          <p className="font-semibold">
            <Evidenziato testo={l.nome} radici={radici} />
            {l.tuo && livelli.length > 1 && <span className="ml-2 text-xs font-normal text-muted-foreground">(il tuo)</span>}
          </p>
          <p className="break-words text-sm"><Evidenziato testo={l.intro} radici={radici} /></p>
          <ul className="space-y-1 text-sm">
            {l.puo.map(p => (
              <li key={p} className="flex gap-1.5 break-words"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" aria-hidden="true" /><span><Evidenziato testo={p} radici={radici} /></span></li>
            ))}
            {l.nonPuo.map(p => (
              <li key={p} className="flex gap-1.5 break-words text-muted-foreground"><X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" aria-hidden="true" /><span><Evidenziato testo={p} radici={radici} /></span></li>
            ))}
          </ul>
        </div>
      ))}
      {livelli.length === 1 && (
        <p className="text-xs text-muted-foreground">Il livello lo decide l’amministratore. Se ti serve qualcosa in più, chiedilo con una richiesta.</p>
      )}
    </section>
  );
}

/** Una sezione generale: richieste, parole del portale, EcoTyna, passi del mese. */
export function SezioneGuida({ sezione, radici }) {
  return (
    <section id={sezione.id} className="scroll-mt-24 space-y-3 rounded-lg border bg-card p-4">
      <h2 className="flex flex-wrap items-center gap-2 font-heading text-lg font-semibold">
        <Evidenziato testo={sezione.titolo} radici={radici} />
        {sezione.soloPer && <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-normal text-muted-foreground"><Lock className="h-3 w-3" aria-hidden="true" /> solo amministratore</span>}
      </h2>
      {sezione.intro && <p className="break-words text-sm"><Evidenziato testo={sezione.intro} radici={radici} /></p>}
      {(sezione.gruppi || []).map((g, gi) => {
        const Elenco = g.numerato ? 'ol' : 'ul';
        return (
          <div key={gi} className="space-y-1.5">
            {g.titolo && <h3 className="text-sm font-semibold"><Evidenziato testo={g.titolo} radici={radici} /></h3>}
            <Elenco className={`space-y-1.5 pl-5 text-sm ${g.numerato ? 'list-decimal' : 'list-disc'}`}>
              {g.elementi.map((e, i) => (
                <li key={i} className="break-words">
                  {e.titolo && <><strong><Evidenziato testo={e.titolo} radici={radici} /></strong>{' — '}</>}
                  <Evidenziato testo={e.testo} radici={radici} />
                  {e.link && <> <Collegamento percorso={e.link.percorso} testo={e.link.testo} /></>}
                </li>
              ))}
            </Elenco>
          </div>
        );
      })}
      {sezione.collegamento && <Collegamento percorso={sezione.collegamento.percorso} testo={sezione.collegamento.testo} />}
    </section>
  );
}

/** Un modulo del menu: si apre al tocco; durante una ricerca e' gia' aperto. */
export function ModuloGuida({ modulo, chi, radici, aperto }) {
  const note = notePerLivello(modulo, chi);
  const admin = chi === 'admin';
  return (
    <details id={idDelModulo(modulo)} open={aperto || undefined} className="group scroll-mt-24 rounded-lg border bg-card">
      <summary className="flex cursor-pointer list-none items-start gap-2 p-4 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 transition-transform group-open:rotate-90" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">
            <Evidenziato testo={modulo.nome} radici={radici} />
            {modulo.soloAdmin && <span className="ml-2 inline-flex items-center gap-1 align-middle text-xs font-normal text-muted-foreground"><Lock className="h-3 w-3" aria-hidden="true" /> solo amministratore</span>}
          </span>
          <span className="block break-words text-sm text-muted-foreground"><Evidenziato testo={modulo.aCosaServe} radici={radici} /></span>
        </span>
      </summary>
      <div className="space-y-3 px-4 pb-4 text-sm">
        <Blocco titolo="Che cosa vedi" voci={modulo.cosaVedi} radici={radici} />
        <Blocco titolo="Che cosa puoi esportare" voci={modulo.esporti} vuoto={modulo.senzaEsportazioni} radici={radici} />
        {note.map(n => (
          <div key={n.livello} className="rounded-md border-l-4 border-primary/50 bg-muted/40 px-3 py-2">
            <p className="text-xs font-semibold text-muted-foreground">{n.tuo ? (admin ? 'Per te, amministratore' : `Per il tuo livello: ${n.nome}`) : `Per chi è ${n.nome}`}</p>
            <p className="break-words"><Evidenziato testo={n.testo} radici={radici} /></p>
          </div>
        ))}
        {modulo.soloAmministratore && modulo.soloAmministratore.length > 0 && (
          <Blocco
            titolo={admin ? 'Solo tu, come amministratore' : 'Lo fa solo l’amministratore'}
            voci={modulo.soloAmministratore}
            radici={radici}
            icona={<Lock className="h-3 w-3" aria-hidden="true" />}
          />
        )}
        {modulo.nienteDaModificare && <p className="break-words text-muted-foreground"><Evidenziato testo={modulo.nienteDaModificare} radici={radici} /></p>}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
          {moduloApribile(modulo, chi)
            ? <Collegamento percorso={modulo.percorso} testo={`Apri ${modulo.nome}`} />
            : <span className="text-muted-foreground">Questa pagina la vede solo l’amministratore.</span>}
          {!admin && modulo.soloAmministratore && modulo.soloAmministratore.length > 0 && (
            <Collegamento percorso="/richieste" testo="Ti serve? Apri una richiesta" />
          )}
        </div>
      </div>
    </details>
  );
}

// Porta a una parte della pagina senza cambiare indirizzo; un modulo chiuso si apre.
function vaiA(id) {
  const el = typeof document !== 'undefined' ? document.getElementById(id) : null;
  if (!el) return;
  if (el.tagName === 'DETAILS') el.open = true;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Dal fondo della pagina alla ricerca, pronta per scrivere.
function tornaAllaRicerca() {
  const el = typeof document !== 'undefined' ? document.getElementById(ID_RICERCA) : null;
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.focus({ preventScroll: true });
}

export default function Guida() {
  const { isAdmin, livello } = usePermessi();
  const chi = livelloDellaGuida(livello, isAdmin);
  const [domanda, setDomanda] = useState('');
  const esito = useMemo(() => cercaNellaGuida(domanda, chi), [domanda, chi]);
  const livelli = useMemo(() => livelliDaMostrare(chi), [chi]);
  const radici = esito.attiva ? esito.radici : [];
  const cercata = domanda.trim();

  // L'ordine: il livello, come chiedere, le pagine del menu, poi il resto.
  const richieste = esito.sezioni.filter(s => s.id === 'richieste');
  const altre = esito.sezioni.filter(s => s.id !== 'richieste');
  const indice = [
    { id: 'livello', testo: livelli.length > 1 ? 'I livelli' : 'Il tuo livello' },
    ...sezioniVisibili(chi).filter(s => s.id === 'richieste').map(s => ({ id: s.id, testo: 'Come chiedere' })),
    { id: 'moduli', testo: 'Le pagine del menu' },
    ...sezioniVisibili(chi).filter(s => s.id !== 'richieste').map(s => ({ id: s.id, testo: s.titolo })),
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 lg:p-8">
      <div>
        <h1 className="flex items-center gap-2 font-heading text-2xl font-bold lg:text-3xl">
          <BookOpen className="h-7 w-7 text-primary" aria-hidden="true" /> Guida
        </h1>
        <p className="mt-1 text-muted-foreground">
          Come si usa il gestionale, pagina per pagina: a che cosa serve, che cosa vedi, che cosa puoi esportare e che cosa fa solo l’amministratore.
        </p>
        <p className="mt-2 text-sm">
          Stai leggendo la guida per il livello <strong>{nomeLivello(chi)}</strong>.
          {chi === 'admin' ? ' Vedi anche le parti degli altri livelli, segnate col loro nome.' : ''}
        </p>
      </div>

      <div className="-mx-4 border-b px-4 pb-3 lg:-mx-8 lg:px-8">
        <label htmlFor={ID_RICERCA} className="sr-only">Cerca nella guida</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            id={ID_RICERCA}
            type="search"
            value={domanda}
            onChange={(e) => setDomanda(e.target.value)}
            placeholder="Cerca: esportare, eseguito, richiesta…"
            className="h-10 w-full rounded-md border bg-card pl-9 pr-9 text-sm"
            autoComplete="off"
          />
          {domanda && (
            <button type="button" onClick={() => setDomanda('')} aria-label="Cancella la ricerca" className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
        {esito.attiva && (
          <p role="status" className="mt-1 text-xs text-muted-foreground">
            {esito.quanti === 0
              ? `Nessun risultato per «${cercata}».`
              : `${esito.quanti} ${esito.quanti === 1 ? 'risultato' : 'risultati'} per «${cercata}».`}
          </p>
        )}
      </div>

      {!esito.attiva && (
        <nav aria-label="Indice della guida" className="flex flex-wrap gap-2">
          {indice.map(v => (
            <button key={v.id} type="button" onClick={() => vaiA(v.id)} className="rounded-full border bg-card px-3 py-1 text-sm hover:bg-muted">
              {v.testo}
            </button>
          ))}
        </nav>
      )}

      {esito.attiva && esito.quanti === 0 && (
        <div className="space-y-2 rounded-lg border bg-card p-4 text-sm">
          <p>Prova con un’altra parola, più corta. Oppure chiedi a chi sa:</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Collegamento percorso={domandaPerEcoTyna(cercata)} testo="Chiedilo a EcoTyna" />
            <Collegamento percorso="/richieste" testo="Apri una richiesta" />
          </div>
        </div>
      )}

      {esito.livelli && <LivelliGuida livelli={livelli} radici={radici} />}

      {richieste.map(s => <SezioneGuida key={s.id} sezione={s} radici={radici} />)}

      {esito.moduli.length > 0 && (
        <section id="moduli" className="scroll-mt-24 space-y-3">
          <h2 className="font-heading text-lg font-semibold">Le pagine del menu</h2>
          {!esito.attiva && (
            <div className="flex flex-wrap gap-1.5">
              {MODULI.map(m => (
                <button key={m.percorso} type="button" onClick={() => vaiA(idDelModulo(m))} className="rounded border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
                  {m.nome}
                </button>
              ))}
            </div>
          )}
          {esito.moduli.map(m => <ModuloGuida key={m.percorso} modulo={m} chi={chi} radici={radici} aperto={esito.attiva} />)}
        </section>
      )}

      {altre.map(s => <SezioneGuida key={s.id} sezione={s} radici={radici} />)}

      <div className="flex justify-end">
        <button type="button" onClick={tornaAllaRicerca} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-primary hover:bg-muted">
          <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" /> Torna alla ricerca
        </button>
      </div>
    </div>
  );
}
