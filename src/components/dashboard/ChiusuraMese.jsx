import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { CalendarCheck, CheckCircle2, Circle, MinusCircle, ChevronDown, ChevronRight, ArrowRight, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';

// LA CHIUSURA DEL MESE, PASSO PASSO (migliorie dell'11/10/2026).
//
// Il lavoro di fine mese stava in sette moduli e la dashboard ne seguiva uno.
// Qui c'e' una riga sola - «Settembre 2026: 6 di 9 fatti, mancano ...» - che si
// apre nei passi, ognuno con il suo stato, il perche' e il collegamento al
// modulo dove si rimedia; sotto, i mesi prima ancora aperti, che si aprono uno
// per volta. Le regole stanno in base44/shared/chiusuraMese.ts e la lettura
// nella funzione statoChiusuraMese: qui si mostra soltanto.
//
// Nessun importo: il pannello lo vede chiunque, e i costi dei fornitori sono
// dell'amministratore. I canali hanno ciascuno il suo passo, mai sommati.
//
// Props: { isAdmin, anno }. anno puo' arrivare come i filtri della dashboard,
// un elenco: con un anno solo si guarda quello, altrimenti l'anno di oggi.

const STILE = {
  fatto: { Icona: CheckCircle2, colore: 'text-emerald-700', fondo: 'border-emerald-200 bg-emerald-50/50', etichetta: 'fatto' },
  da_fare: { Icona: Circle, colore: 'text-amber-700', fondo: 'border-amber-200 bg-amber-50/50', etichetta: 'da fare' },
  non_serve: { Icona: MinusCircle, colore: 'text-muted-foreground', fondo: 'border-border bg-muted/20', etichetta: 'non serve' },
};
const PALLINO = { fatto: 'bg-emerald-500', da_fare: 'bg-amber-500', non_serve: 'bg-slate-300', info: 'bg-slate-300' };
const TESTO_VOCE = { fatto: 'text-foreground/80', da_fare: 'text-amber-900', non_serve: 'text-muted-foreground', info: 'text-muted-foreground' };

const giorno = (v) => (v ? String(v).slice(0, 10).split('-').reverse().join('/') : '—');
// L'errore di una funzione si legge dal corpo della risposta (11/10/2026).
const motivo = (e) => e?.response?.data?.error || e?.data?.error || e?.message || String(e);
const annoDa = (anno) => (Array.isArray(anno) ? (anno.length === 1 ? Number(anno[0]) || null : null) : Number(anno) || null);

async function chiedi(corpo) {
  const r = await base44.functions.invoke('statoChiusuraMese', corpo);
  if (r?.data?.error) throw new Error(r.data.error);
  return r.data;
}

function Avanzamento({ conteggio }) {
  if (!conteggio || !conteggio.totale) return null;
  const quota = Math.round((conteggio.fatti / conteggio.totale) * 100);
  return (
    <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-2" role="progressbar" aria-valuemin={0} aria-valuemax={conteggio.totale} aria-valuenow={conteggio.fatti} aria-label="Passi fatti">
      <div className={`h-full ${quota === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${quota}%` }} />
    </div>
  );
}

// I passi di un mese, uno sotto l'altro. Esportato perche' la prova lo disegna
// (prove/chiusuraMesePannello.mjs): il pannello intero aspetta la funzione.
export function Passi({ passi }) {
  return (
    <ol className="mt-3 space-y-1.5">
      {(passi || []).map(p => {
        const s = STILE[p.stato] || STILE.da_fare;
        // Una voce che ripete il dettaglio (la chiusura dell'attiva) non si dice due volte.
        const voci = (p.voci || []).filter(v => v.testo !== p.dettaglio);
        const stato = p.lettura_non_riuscita ? 'non verificato' : p.stato === 'da_fare' && p.dal ? `da fare dal ${giorno(p.dal)}` : s.etichetta;
        return (
          <li key={p.chiave} className={`border rounded-md px-3 py-2 ${s.fondo}`}>
            <div className="flex items-start gap-2.5">
              <s.Icona className={`w-4 h-4 mt-0.5 shrink-0 ${s.colore}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <p className="text-sm font-medium">
                    {p.titolo} <span className={`text-xs font-normal ${s.colore}`}>· {stato}</span>
                  </p>
                  {p.link && (
                    <Link to={p.link} className="text-xs text-primary hover:underline inline-flex items-center gap-1 shrink-0">
                      Apri il modulo <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>
                {p.dettaglio && <p className="text-xs text-foreground/80 mt-0.5">{p.dettaglio}</p>}
                {voci.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {voci.map((v, i) => (
                      <li key={i} className={`text-xs flex items-start gap-1.5 ${TESTO_VOCE[v.stato] || ''}`}>
                        <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${PALLINO[v.stato] || PALLINO.info}`} aria-hidden="true" />
                        {v.link && v.link !== p.link ? <Link to={v.link} className="hover:underline">{v.testo}</Link> : <span>{v.testo}</span>}
                      </li>
                    ))}
                  </ul>
                )}
                {p.perche && (
                  <details className="mt-1">
                    <summary className="text-[11px] text-muted-foreground cursor-pointer select-none">Perché serve</summary>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{p.perche}</p>
                  </details>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function ChiusuraMese({ isAdmin, anno }) {
  const annoScelto = annoDa(anno);
  const [dati, setDati] = useState(null);
  const [errore, setErrore] = useState('');
  const [aperto, setAperto] = useState(false);
  const [giro, setGiro] = useState(0);
  // Il mese prima ancora aperto che si sta guardando: { chiave, dati, errore }.
  const [altro, setAltro] = useState(null);

  useEffect(() => {
    let vivo = true;
    setDati(null); setErrore(''); setAltro(null);
    chiedi(annoScelto ? { anno: annoScelto } : {})
      .then(d => { if (vivo) setDati(d); })
      .catch(e => { if (vivo) setErrore(motivo(e)); });
    return () => { vivo = false; };
  }, [annoScelto, giro]);

  const apriMese = async (m) => {
    const chiave = `${m.anno}-${m.numero}`;
    if (altro?.chiave === chiave) { setAltro(null); return; }
    setAltro({ chiave, dati: null, errore: '' });
    try {
      const d = await chiedi({ anno: m.anno, mese: m.mese });
      setAltro(a => (a?.chiave === chiave ? { chiave, dati: d, errore: '' } : a));
    } catch (e) {
      setAltro(a => (a?.chiave === chiave ? { chiave, dati: null, errore: motivo(e) } : a));
    }
  };

  return (
    <div className="border rounded-lg p-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-heading font-semibold text-lg flex items-center gap-2">
          <CalendarCheck className="w-5 h-5 text-primary" /> Chiusura del mese
        </h2>
        {dati?.conteggio && (
          <span className="text-xs text-muted-foreground">
            {dati.conteggio.fatti} di {dati.conteggio.totale} passi fatti{dati.conteggio.non_serve ? ` · ${dati.conteggio.non_serve} non servono` : ''}
          </span>
        )}
      </div>

      {errore ? (
        <div className="mt-3 text-sm text-destructive flex items-center gap-2 flex-wrap">
          <AlertTriangle className="w-4 h-4" /> La chiusura del mese non si è caricata: {errore}
          <button type="button" onClick={() => setGiro(g => g + 1)} className="text-xs text-primary hover:underline inline-flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Riprova
          </button>
        </div>
      ) : !dati ? (
        <div className="flex items-center mt-3 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Controllo dei passi del mese...</div>
      ) : !dati.mese ? (
        <p className="mt-3 text-sm text-muted-foreground">{dati.perche || dati.sintesi}</p>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setAperto(a => !a)}
            aria-expanded={aperto}
            className="w-full text-left mt-3 flex items-start gap-2 rounded-md hover:bg-muted/40 -mx-1 px-1 py-1"
          >
            {aperto ? <ChevronDown className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />}
            <span className="text-sm font-medium">{dati.sintesi}</span>
          </button>
          <Avanzamento conteggio={dati.conteggio} />
          {aperto && <Passi passi={dati.passi} />}

          {dati.mesi_aperti?.length > 0 && (
            <div className="mt-4 border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Mesi prima ancora aperti</p>
              <ul className="space-y-1">
                {dati.mesi_aperti.map(m => {
                  const chiave = `${m.anno}-${m.numero}`;
                  const suo = altro?.chiave === chiave ? altro : null;
                  return (
                    <li key={chiave}>
                      <button type="button" onClick={() => apriMese(m)} aria-expanded={!!suo} className="w-full text-left flex items-start gap-2 text-sm rounded-md hover:bg-muted/40 -mx-1 px-1 py-0.5">
                        {suo ? <ChevronDown className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />}
                        <span className="text-amber-900">{m.sintesi}</span>
                      </button>
                      {suo && (
                        suo.errore ? <p className="text-xs text-destructive ml-6 mt-1">{suo.errore}</p>
                          : !suo.dati ? <div className="flex items-center ml-6 mt-1 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin mr-1.5" /> Controllo dei passi di {m.etichetta}...</div>
                            : (
                              <div className="ml-6">
                                <p className="text-xs text-muted-foreground mt-1">{suo.dati.sintesi}</p>
                                <Passi passi={suo.dati.passi} />
                              </div>
                            )
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {dati.letture_non_riuscite?.length > 0 && (
            <p className="text-xs text-amber-800 mt-3">
              Alcune letture non sono riuscite: i passi che ne dipendono restano «non verificato» finché non riprovi.
              {' '}<button type="button" onClick={() => setGiro(g => g + 1)} className="text-primary hover:underline">Riprova</button>
            </p>
          )}
          {!isAdmin && (
            <p className="text-xs text-muted-foreground mt-3">
              I passi della chiusura li fa l&apos;amministratore. Se qualcosa non ti torna, <Link to="/richieste" className="text-primary hover:underline">apri una richiesta</Link>.
            </p>
          )}
        </>
      )}
    </div>
  );
}
