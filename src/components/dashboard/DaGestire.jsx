import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertOctagon, AlertTriangle, Info, CheckCircle, ChevronDown, ChevronRight, EyeOff, Eye, ArrowRight, Sparkles, X, Loader2 } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { testoTornata } from '@/lib/avvisiNascosti';
import { giornoMese } from '@/components/dashboard/formato';
import { passaFiltro, FILTRO_CONTROLLI } from '@/components/dashboard/vociDashboard';

// «DA GESTIRE»: L'UNICO ELENCO DEI PROBLEMI (migliorie dell'11/10/2026).
//
// Prima le stesse cose si dicevano in quattro posti della pagina (le righe
// gialle sotto le card, il riquadro degli avvisi del contratto, tre riepiloghi
// delle date, il pannello dei target, il badge in alto) da tre calcoli fatti in
// momenti diversi. Ora le dice solo questo pannello; le sezioni mostrano un segno
// che porta qui, filtrato sulla loro parte.
//
// AVVISI A SCOMPARSA (chiesti dall'utente): il pannello si chiude e si apre, e
// ogni voce si nasconde per oggi o per sette giorni (le critiche solo per oggi).
// Torna da sola quando ha qualcosa di nuovo da dire (src/lib/avvisiNascosti.js),
// e le critiche nascoste restano nel conteggio: una critica non sparisce mai in
// silenzio. Nascondere e' una comodita' di chi guarda e vive nel browser; la
// decisione su un alert («ignora») resta nella pagina Alert.
//
// Una voce e' una riga, non un collegamento intero: il titolo porta dove si
// risolve, e accanto ci sono i pulsanti (Apri, Chiedi a EcoTyna, Nascondi), che
// dentro un collegamento non si potrebbero mettere.

const TONI = {
  critico: { Icona: AlertOctagon, riga: 'border-red-200 bg-red-50', testo: 'text-red-800', etichetta: 'critico' },
  attenzione: { Icona: AlertTriangle, riga: 'border-amber-200 bg-amber-50', testo: 'text-amber-900', etichetta: 'da guardare' },
  info: { Icona: Info, riga: 'border-border bg-muted/30', testo: 'text-foreground', etichetta: 'da sapere' },
};
// Oltre alle sezioni, il filtro dei controlli automatici: le voci dei lavori
// pianificati e delle identita' fra moduli, dovunque stiano (vociDashboard.js).
export const NOMI_SEZIONE = { rete: 'Rete', aci: 'ACI', extra: 'Extra raccolta', impianti: 'Impianti', fatturazione: 'Fatturazione', economia: 'Economia', dati: 'Dati', generale: 'Generale', [FILTRO_CONTROLLI]: 'Controlli automatici' };

/** La domanda per EcoTyna: quella che la voce porta, o una spiegazione della voce. In tutto al massimo 400 caratteri. */
export function domandaPerEcotyna(v) {
  if (v.domanda) return String(v.domanda).slice(0, 400);
  const dettaglio = String(v.dettaglio || '').slice(0, 200);
  return `Mi spieghi questa voce della dashboard e che cosa devo fare? «${String(v.titolo || '').slice(0, 150)}»${dettaglio ? ` ${dettaglio}` : ''}`.slice(0, 400);
}

const conta = (voci, g) => voci.filter(v => v.gravita === g).length;

function Nascondi({ voce, onNascondi }) {
  const [aperto, setAperto] = useState(false);
  const scegli = (giorni) => { setAperto(false); onNascondi(voce, giorni); };
  return (
    <Popover open={aperto} onOpenChange={setAperto}>
      <PopoverTrigger asChild>
        <button type="button" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <EyeOff className="w-3.5 h-3.5" aria-hidden="true" /> Nascondi
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2 text-sm">
        <p className="px-2 pb-1.5 text-xs text-muted-foreground">
          {voce.gravita === 'critico'
            ? 'Una voce critica si nasconde solo fino a stasera, e resta nel conteggio.'
            : 'Torna da sola se diventa più grave, se un suo numero sale o se cambia.'}
        </p>
        <button type="button" onClick={() => scegli(0)} className="w-full text-left rounded px-2 py-1.5 hover:bg-muted">Per oggi</button>
        {voce.gravita !== 'critico' && <button type="button" onClick={() => scegli(7)} className="w-full text-left rounded px-2 py-1.5 hover:bg-muted">Per 7 giorni</button>}
      </PopoverContent>
    </Popover>
  );
}

function Voce({ voce, tornata, onNascondi }) {
  const t = TONI[voce.gravita] || TONI.info;
  const etichetta = testoTornata(tornata);
  return (
    <li className={`border rounded-md px-3 py-2 ${t.riga}`}>
      <div className="flex items-start gap-2.5">
        <t.Icona className={`w-4 h-4 mt-0.5 shrink-0 ${t.testo}`} aria-label={t.etichetta} />
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium ${t.testo}`}>
            <span className="text-xs font-normal opacity-70 mr-2">{voce.area}</span>
            <Link to={voce.link || '/'} className="hover:underline">{voce.titolo}</Link>
          </p>
          {voce.dettaglio && <p className="text-xs text-muted-foreground mt-0.5 break-words">{voce.dettaglio}</p>}
          {etichetta && <p className="text-[11px] font-medium text-foreground/80 mt-1 inline-flex items-center gap-1 rounded bg-background/70 px-1.5 py-0.5"><Eye className="w-3 h-3" aria-hidden="true" /> {etichetta}</p>}
          <div className="flex flex-wrap items-center gap-1 mt-1.5 -ml-2">
            <Link to={voce.link || '/'} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-primary hover:bg-background">
              Apri <ArrowRight className="w-3 h-3" aria-hidden="true" />
            </Link>
            {voce.ecotyna && (
              <Link to={`/assistente?domanda=${encodeURIComponent(domandaPerEcotyna(voce))}`} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-violet-700 hover:bg-background">
                <Sparkles className="w-3 h-3" aria-hidden="true" /> Chiedi a EcoTyna
              </Link>
            )}
            <Nascondi voce={voce} onNascondi={onNascondi} />
          </div>
        </div>
      </div>
    </li>
  );
}

/**
 * visibili: [{ voce, tornata }]; nascoste: [{ voce, riga }] (da smista);
 * filtro: una sezione ('rete', ...), i controlli automatici ('controlli') o
 * null; aperto: il pannello e' aperto.
 */
export default function DaGestire({
  visibili, nascoste, filtro, onTogliFiltro, aperto, onApri, onNascondi, onRimetti, onRimettiTutte,
  caricamento = false, errore = '', attesaPrezzi = false,
}) {
  const [mostraNascoste, setMostraNascoste] = useState(false);
  const tutte = [...visibili.map(x => x.voce), ...nascoste.map(x => x.voce)];
  const delFiltro = (v) => passaFiltro(v, filtro);
  const vis = visibili.filter(x => delFiltro(x.voce));
  const nasc = nascoste.filter(x => delFiltro(x.voce));
  const conteggio = tutte.length === 0
    ? 'niente in sospeso'
    : `${conta(tutte, 'critico')} critici · ${conta(tutte, 'attenzione')} da guardare · ${conta(tutte, 'info')} da sapere`;
  const criticheNascoste = nascoste.filter(x => x.voce.gravita === 'critico').length;
  return (
    <section id="da-gestire" aria-labelledby="da-gestire-titolo" className="border rounded-lg p-4 lg:p-5 scroll-mt-4 bg-card">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button type="button" onClick={onApri} aria-expanded={aperto} aria-controls="da-gestire-elenco" className="flex items-center gap-2 text-left rounded-md hover:bg-muted/40 -mx-1 px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {aperto ? <ChevronDown className="w-4 h-4 text-muted-foreground" aria-hidden="true" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />}
          <h2 id="da-gestire-titolo" className="font-heading font-semibold text-lg">Da gestire</h2>
          <span className="sr-only">{aperto ? 'chiudi' : 'apri'}</span>
        </button>
        <p className="text-xs text-muted-foreground">
          {caricamento ? 'controllo di che cosa c\'è da gestire…' : conteggio}
          {nascoste.length > 0 && ` · ${nascoste.length} ${nascoste.length === 1 ? 'nascosto' : 'nascosti'}${criticheNascoste ? ` (${criticheNascoste} ${criticheNascoste === 1 ? 'critico' : 'critici'} fino a stasera)` : ''}`}
          {attesaPrezzi && ' · sto ancora controllando i prezzi delle fatturazioni…'}
        </p>
      </div>

      {aperto && (
        <div id="da-gestire-elenco" className="mt-3">
          {filtro && (
            <button type="button" onClick={onTogliFiltro} className="mb-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover:bg-muted">
              Solo {NOMI_SEZIONE[filtro] || filtro} <X className="w-3 h-3" aria-label="togli il filtro" />
            </button>
          )}
          {errore ? (
            <p className="text-sm text-destructive flex items-center gap-2"><AlertTriangle className="w-4 h-4" aria-hidden="true" /> L&apos;elenco non si è caricato: {errore}</p>
          ) : caricamento ? (
            <p className="flex items-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" /> Controllo di che cosa c&apos;è da gestire…</p>
          ) : vis.length === 0 ? (
            <p className="flex items-center gap-2 text-emerald-700 text-sm">
              <CheckCircle className="w-5 h-5" aria-hidden="true" />
              {nasc.length ? 'Niente di nuovo: le voci aperte sono fra le nascoste.' : filtro ? 'Niente da gestire in questa parte.' : 'Nessuna anomalia aperta nei moduli controllati.'}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {vis.map(({ voce, tornata }) => <Voce key={voce.chiave} voce={voce} tornata={tornata} onNascondi={onNascondi} />)}
            </ul>
          )}

          {nasc.length > 0 && (
            <div className="mt-3 border-t pt-2">
              <button type="button" onClick={() => setMostraNascoste(m => !m)} aria-expanded={mostraNascoste} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                {mostraNascoste ? <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" /> : <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />}
                {nasc.length} {nasc.length === 1 ? 'avviso nascosto' : 'avvisi nascosti'} · {mostraNascoste ? 'nascondi l\'elenco' : 'mostra'}
              </button>
              {mostraNascoste && (
                <ul className="mt-2 space-y-1">
                  {nasc.map(({ voce, riga }) => (
                    <li key={voce.chiave} className="flex items-start justify-between gap-2 rounded-md bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
                      <span className="min-w-0">
                        <span className="opacity-70 mr-1.5">{voce.area}</span>
                        <Link to={voce.link || '/'} className="hover:underline">{voce.titolo}</Link>
                        <span className="ml-1.5">· fino al {giornoMese(riga.fino_al)}{voce.gravita === 'critico' ? ' (critico)' : ''}</span>
                      </span>
                      <button type="button" onClick={() => onRimetti(riga.chiave)} className="shrink-0 text-primary hover:underline">Rimetti</button>
                    </li>
                  ))}
                </ul>
              )}
              {mostraNascoste && nasc.length > 1 && (
                <button type="button" onClick={() => onRimettiTutte(nasc.map(x => x.riga.chiave))} className="mt-1.5 text-xs text-primary hover:underline">Rimettile tutte</button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
