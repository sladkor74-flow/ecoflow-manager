import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { FlaskConical, FileSpreadsheet, Loader2, Info } from 'lucide-react';
import EsportaPdf from '@/components/shared/EsportaPdf';
import { oggiRoma, giornoRoma } from '@/lib/giornoItaliano';
import { formatNumber, formatTonnellate, formatPercentuale } from '@/lib/utils';
import {
  simulaMargine, margineACostiDiversi, parametriDaValori, leggiMemoriaSimulazione, scriviMemoriaSimulazione,
  testoParametri, testoPeriodo, scriviEuro, scriviEuroT, FRASE_SIMULAZIONE, NOMI_SIMULAZIONE, CANALI_SIMULAZIONE,
} from '@/lib/simulazioneMargine';

// LA SIMULAZIONE DEL MARGINE COL COSTO DI SMOCO COME RACCOGLITORE (16/10/2026).
//
// L'utente, 16/10/2026: simulare il margine della commessa al variare
// dell'unico valore che il gestionale non ha, il costo €/t di SMOCO come
// raccoglitore, che fa un altro ufficio coi costi diretti e indiretti, «senza
// inficiare tutto il resto dei calcoli e della fatturazione», anche per
// mostrarlo al CEO di SMOCO. SMOCO e' un fornitore interno: a se stessi non si
// fattura, quindi nel margine vero la sua raccolta costa zero e su quelle
// tonnellate il margine e' piu' alto del vero.
//
// LE REGOLE DELLA SEZIONE:
// - Sta dentro la scheda Margine, che e' solo dell'amministratore: costi e
//   margine li vede solo lui. La sezione non apre niente ad altri.
// - Usa la risposta del margine che la scheda ha gia' (data): nessuna richiesta
//   al server, nessuna scrittura. Tutti i conti e le frasi vengono dalla regola
//   (src/lib/simulazioneMargine.js): qui si disegnano soltanto.
// - Il costo si scrive a mano, canale per canale, con la comodita' di un valore
//   unico. Rete, ACI ed Extra raccolta sono tre simulazioni: nessuna riga e
//   nessun riquadro li somma.
// - Non si salva mai negli archivi e non entra in niente: tariffe, passiva,
//   attiva, fatturazione, margine vero, dashboard, alert, EcoTyna. Il browser
//   ricorda solo l'ultimo valore scritto (leggi/scriviMemoriaSimulazione, che
//   non lanciano mai: senza memoria la sezione funziona lo stesso).
// - Un mese col margine vero «—» (prezzi mancanti) resta «—» anche simulato,
//   col perche' sotto il mese. Un valore che manca non e' zero.
// - Il PDF e l'Excel per il CEO (src/lib/simulazioneMargineExport.js) si
//   caricano al clic, con jspdf ed exceljs: la sezione resta leggera.
// - Il colore e' suo, fucsia col bordo tratteggiato: non l'ambra o il rosso,
//   che vogliono dire «c'e' un problema», non l'indaco, che e' il surplus.

const vuoto = (v) => v === null || v === undefined;
const tonn = (v) => (vuoto(v) ? '—' : `${formatTonnellate(v)} t`);
const soldi = (v) => (vuoto(v) ? '—' : `€ ${scriviEuro(v)}`);
const perc = (v) => (vuoto(v) ? '—' : `${formatPercentuale(v)}%`);
const rosso = (v) => (!vuoto(v) && v < 0 ? 'text-red-600' : '');
// Il valore da rimettere nel campo: all'italiana, come lo si scriverebbe a mano.
const nelCampo = (v) => formatNumber(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const giornoIt = (v) => { const g = giornoRoma(v); return g ? g.split('-').reverse().join('/') : ''; };
// «il 16/10/2026», ma «l'08/10/2026» e «l'11/10/2026»: si legge «otto», «undici».
const ilGiorno = (g) => (/^(08|11)\//.test(g) ? `l'${g}` : `il ${g}`);

/** Un campo del costo €/t: testo con la tastiera dei numeri, l'errore della regola sotto. */
function CampoEuroT({ id, etichetta, valore, errore, onCambia }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="text-xs text-muted-foreground block mb-1">{etichetta}</label>
      <div className="flex items-center gap-1.5">
        <Input
          id={id} type="text" inputMode="decimal" autoComplete="off" placeholder="es. 62,50"
          value={valore || ''} onChange={(e) => onCambia(e.target.value)}
          aria-invalid={errore ? 'true' : undefined} aria-describedby={errore ? `${id}-errore` : undefined}
          className="w-full sm:w-36 bg-background tabular-nums"
        />
        <span className="text-sm text-muted-foreground shrink-0">€/t</span>
      </div>
      {errore && <p id={`${id}-errore`} className="text-xs text-red-600 mt-1">{errore}</p>}
    </div>
  );
}

/** Un numero dell'anno: etichetta, valore, e sotto la riga che lo spiega. */
function Numero({ etichetta, valore, sotto, coloreValore = '', children }) {
  return (
    <div className="rounded-md border bg-background p-3 min-w-0">
      <span className="block text-[11px] text-muted-foreground">{etichetta}</span>
      <span className={`block text-lg font-semibold tabular-nums break-words ${coloreValore}`}>{valore}</span>
      {sotto && <span className="block text-[11px] text-muted-foreground break-words">{sotto}</span>}
      {children}
    </div>
  );
}

const TH = 'text-right px-3 py-2 font-semibold whitespace-nowrap';
const TD = 'px-3 py-1.5 text-right tabular-nums whitespace-nowrap';

/** La tabella dei mesi di un canale, con la riga Anno: l'anno del canale, non una somma di canali. */
function TabellaSimulata({ c }) {
  return (
    <div className="border rounded-lg overflow-x-auto bg-background">
      <table className="w-full text-sm">
        <thead className="bg-muted"><tr>
          <th className="text-left px-3 py-2 font-semibold">Mese</th>
          <th className={TH}>t SMOCO</th>
          <th className={TH}>Costo simulato €</th>
          <th className={TH}>Margine vero €</th>
          <th className={TH}>Margine simulato €</th>
          <th className={TH}>%</th>
          <th className={TH}>Margine simulato €/t</th>
          <th className={TH} title="Quanto si paga in media per tonnellata ai raccoglitori esterni del canale, alle tariffe di contratto">Esterni €/t</th>
        </tr></thead>
        <tbody>
          {[...c.mesi, c.anno].map(r => {
            const rigaAnno = r.mese === 'Anno';
            return (
              <tr key={r.mese} className={`border-t ${rigaAnno ? 'bg-primary/5 font-semibold border-t-2' : ''}`}>
                <td className="px-3 py-1.5 text-left">
                  {r.mese}
                  {/* Il margine vero «—» resta «—» anche simulato: si dice perche'. */}
                  {r.perche && (
                    <span className="block text-[11px] font-normal text-amber-700">{r.perche}</span>
                  )}
                </td>
                <td className={TD}>{vuoto(r.tonnellate_smoco) ? '—' : formatTonnellate(r.tonnellate_smoco)}</td>
                <td className={TD}>{scriviEuro(r.costo_simulato)}</td>
                <td className={`${TD} ${rosso(r.margine_vero)}`}>{scriviEuro(r.margine_vero)}</td>
                <td className={`${TD} ${rosso(r.margine_simulato)}`}>{scriviEuro(r.margine_simulato)}</td>
                <td className={TD}>{perc(r.margine_simulato_pct)}</td>
                <td className={`${TD} ${rosso(r.margine_simulato_t)}`}>{scriviEuro(r.margine_simulato_t)}</td>
                <td className={TD}>{scriviEuro(r.euro_t_esterni)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Il margine dell'anno a costi diversi di SMOCO: zero (oggi), il valore scritto, la media degli esterni, il pareggio. */
function TabellaCostiDiversi({ righe }) {
  return (
    <div className="border rounded-lg overflow-x-auto bg-background">
      <table className="w-full text-sm">
        <thead className="bg-muted"><tr>
          <th className="text-left px-3 py-2 font-semibold">Costo di SMOCO</th>
          <th className={TH}>Costo simulato €</th>
          <th className={TH}>Margine simulato €</th>
          <th className={TH}>%</th>
        </tr></thead>
        <tbody>
          {righe.map(r => (
            <tr key={`${r.euro_t}|${r.etichetta}`} className="border-t">
              <td className="px-3 py-1.5 text-left">
                <span className="tabular-nums font-medium">{scriviEuroT(r.euro_t)}</span>
                {r.etichetta && <span className="block text-[11px] text-muted-foreground">{r.etichetta}</span>}
              </td>
              <td className={TD}>{scriviEuro(r.costo_simulato)}</td>
              <td className={`${TD} ${rosso(r.margine_simulato)}`}>{scriviEuro(r.margine_simulato)}</td>
              <td className={TD}>{perc(r.margine_simulato_pct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * La simulazione coi costi diversi di ogni canale (margineACostiDiversi della
 * regola, sul canale del margine): la tabella a video e i due file li prendono
 * da qui, gia' fatti. Nessun altro conto.
 */
export function conCostiDiversi(sim, data) {
  if (!sim || !data || !Array.isArray(data.canali)) return sim;
  return {
    ...sim,
    canali: sim.canali.map(c => ({ ...c, costi_diversi: margineACostiDiversi(data.canali.find(x => x && x.canale === c.canale), c.euro_t) || [] })),
  };
}

/** Un canale simulato: i numeri dell'anno, le note, i mesi, i costi diversi e gli esterni. Mai sommato agli altri. */
function CanaleSimulato({ c, anno, periodo, onUsaMedia }) {
  const a = c.anno;
  const conCosto = !vuoto(c.euro_t);
  const media = c.confronto ? c.confronto.euro_t_esterni : null;
  const costiDiversi = c.costi_diversi || [];
  return (
    <div className="space-y-3 rounded-lg border bg-background/60 p-3" id={`simulazione-${c.canale}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h4 className="font-heading font-semibold">{c.nome} — {anno}</h4>
        <span className="text-xs text-muted-foreground">costo di SMOCO: {conCosto ? scriviEuroT(c.euro_t) : 'non scritto'}</span>
      </div>
      {!conCosto && <p className="text-xs text-muted-foreground">Scrivi il costo €/t di SMOCO per vedere il margine simulato.</p>}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Numero etichetta="Raccolte da SMOCO" valore={tonn(a.tonnellate_smoco)} sotto={`su ${tonn(a.tonnellate)} del canale`} />
        <Numero etichetta="Costo simulato" valore={soldi(a.costo_simulato)} sotto={conCosto ? `t di SMOCO × ${scriviEuroT(c.euro_t)}, mese per mese` : 'serve il costo €/t di SMOCO'} />
        {/* Il perche' sta sotto il margine vero solo quando il margine vero manca:
            se manca soltanto la raccolta di SMOCO (una risposta del calcolo di
            prima) il margine vero c'e' ed e' giusto, e la frase la dice il
            margine simulato (revisione del 16/10/2026, come il PDF e l'Excel). */}
        <Numero etichetta="Margine vero" valore={soldi(a.margine_vero)} coloreValore={rosso(a.margine_vero)}
          sotto={vuoto(a.margine_vero) ? a.perche : `${perc(a.margine_vero_pct)} del ricavo · quello della scheda, con SMOCO a costo zero`} />
        <Numero etichetta="Margine simulato" valore={soldi(a.margine_simulato)} coloreValore={rosso(a.margine_simulato)}
          sotto={vuoto(a.margine_simulato) ? (a.perche || 'serve il costo €/t di SMOCO') : `${perc(a.margine_simulato_pct)} del ricavo · ${scriviEuroT(a.margine_simulato_t)}`} />
        <Numero etichetta="Costo di pareggio" valore={scriviEuroT(c.pareggio && c.pareggio.euro_t)} sotto={c.pareggio && c.pareggio.testo} />
        <Numero etichetta="Media dei raccoglitori esterni" valore={scriviEuroT(media)} sotto={c.confronto && c.confronto.testo}>
          {c.confronto && !vuoto(c.confronto.margine_alla_media) && (
            <span className="block text-[11px] text-muted-foreground">margine se SMOCO costasse la media: <span className="tabular-nums">{soldi(c.confronto.margine_alla_media)}</span></span>
          )}
          {!vuoto(media) && (
            <Button type="button" variant="outline" size="sm" className="mt-2 h-auto whitespace-normal text-left" onClick={() => onUsaMedia(c.canale, media)}>
              Usa la media degli esterni ({scriviEuroT(media)})
            </Button>
          )}
        </Numero>
      </div>

      {(c.note || []).length > 0 && (
        <ul className="list-disc pl-5 space-y-0.5 text-xs text-muted-foreground">
          {c.note.map((n, i) => <li key={i} className="break-words">{n}</li>)}
        </ul>
      )}

      <TabellaSimulata c={c} />

      {costiDiversi.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium">Il margine dell'anno a costi diversi di SMOCO</p>
          <TabellaCostiDiversi righe={costiDiversi} />
        </div>
      )}

      <details className="border rounded-lg bg-background">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
          I raccoglitori esterni di {periodo}: {(c.esterni || []).length} {(c.esterni || []).length === 1 ? 'fornitore' : 'fornitori'}, alle tariffe di contratto
        </summary>
        <div className="overflow-x-auto border-t">
          <table className="w-full text-sm">
            <thead className="bg-muted"><tr>
              <th className="text-left px-3 py-2 font-semibold">Fornitore</th>
              <th className={TH}>t</th>
              <th className={TH}>€</th>
              <th className={TH}>€/t</th>
            </tr></thead>
            <tbody>
              {(c.esterni || []).length === 0 && (
                <tr className="border-t"><td colSpan={4} className="px-3 py-1.5 text-muted-foreground">Nessun raccoglitore esterno con una tariffa paragonabile nel periodo.</td></tr>
              )}
              {(c.esterni || []).map(e => (
                <tr key={e.fornitore} className="border-t">
                  <td className="px-3 py-1.5 text-left break-words">{e.fornitore}</td>
                  <td className={TD}>{vuoto(e.tonnellate) ? '—' : formatTonnellate(e.tonnellate)}</td>
                  <td className={TD}>{scriviEuro(e.euro)}</td>
                  <td className={TD}>{scriviEuro(e.euro_t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/**
 * La sezione. data: la risposta del margine gia' caricata dalla scheda
 * (MargineCommessa). Senza data.canali non disegna niente.
 */
export default function SimulazioneMargine({ data }) {
  const { toast } = useToast();
  // L'ultimo valore scritto, dal browser: solo per comodita' di chi guarda.
  const [valori, setValori] = useState(() => leggiMemoriaSimulazione());
  const [inExcel, setInExcel] = useState(false);
  useEffect(() => { scriviMemoriaSimulazione(valori); }, [valori]);

  const { parametri, errori } = useMemo(() => parametriDaValori(valori), [valori]);
  const conCanali = !!data && Array.isArray(data.canali);
  const sim = useMemo(() => (conCanali ? conCostiDiversi(simulaMargine(data, parametri), data) : null), [conCanali, data, parametri]);
  if (!conCanali || !sim) return null;

  const haParametro = CANALI_SIMULAZIONE.some(k => !vuoto(parametri[k]));
  const erroreUnico = errori.RETE || errori.ACI || errori.EXTRA_RACCOLTA || '';

  // La casella del valore unico: spenta, i tre campi partono dal valore unico;
  // accesa, il valore unico parte dal primo canale scritto.
  const cambiaUguali = (acceso) => setValori(v => {
    if (acceso) return { ...v, uguali: true, unico: v.unico || CANALI_SIMULAZIONE.map(k => v[k]).find(Boolean) || '' };
    return v.unico ? { ...v, uguali: false, ...Object.fromEntries(CANALI_SIMULAZIONE.map(k => [k, v.unico])) } : { ...v, uguali: false };
  });
  // La media degli esterni nel campo del suo canale: col valore unico acceso,
  // si spegne e gli altri due canali tengono il valore unico di prima.
  const usaMedia = (canale, media) => setValori(v => {
    const testo = nelCampo(media);
    if (v.uguali) return { ...v, uguali: false, ...Object.fromEntries(CANALI_SIMULAZIONE.map(k => [k, v.unico || ''])), [canale]: testo };
    return { ...v, [canale]: testo };
  });

  const esportaExcel = async () => {
    setInExcel(true);
    try {
      // exceljs e il corredo dei documenti si caricano qui, al clic.
      const m = await import('@/lib/simulazioneMargineExport');
      const nome = await m.esportaSimulazioneExcel(sim, { oggi: oggiRoma() });
      toast({ title: 'Excel della simulazione esportato', description: nome || '' });
    } catch (e) {
      toast({ title: 'Esportazione non riuscita', description: e.message || String(e), variant: 'destructive' });
    }
    setInExcel(false);
  };

  const calcolato = giornoIt(sim.calcolato_il);
  return (
    <section aria-label="Simulazione del margine" className="rounded-lg border-2 border-dashed border-fuchsia-400 bg-fuchsia-50/50 p-3 sm:p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded bg-fuchsia-700 px-2 py-0.5 text-[11px] font-bold tracking-widest text-white">
            <FlaskConical className="w-3.5 h-3.5" /> SIMULAZIONE
          </span>
          <h3 className="font-heading font-semibold text-fuchsia-950 break-words">Simulazione — il costo di SMOCO come raccoglitore</h3>
          <p className="text-xs text-fuchsia-900 max-w-3xl break-words">{FRASE_SIMULAZIONE}</p>
          <p className="text-[11px] text-muted-foreground break-words">
            Periodo: {testoPeriodo(sim)}, per fine trasporto{calcolato ? ` · margine calcolato ${ilGiorno(calcolato)}` : ''}{haParametro ? ` · ${testoParametri(sim.parametri)}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <EsportaPdf
            etichetta="PDF della simulazione"
            disabilitato={!haParametro}
            sezioni={async () => {
              const m = await import('@/lib/simulazioneMargineExport');
              return m.argomentiSimulazionePdf(sim, { oggi: oggiRoma() });
            }}
          />
          <Button size="sm" variant="outline" onClick={esportaExcel} disabled={!haParametro || inExcel}>
            {inExcel ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-1" />} Excel della simulazione
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-fuchsia-200 bg-background p-3 space-y-3">
        <p className="text-sm font-medium">Il costo €/t di SMOCO come raccoglitore, scritto a mano</p>
        <label className="flex items-center gap-2 text-sm cursor-pointer w-fit">
          <input type="checkbox" className="h-4 w-4 accent-fuchsia-700" checked={!!valori.uguali} onChange={(e) => cambiaUguali(e.target.checked)} />
          Lo stesso costo per i tre canali
        </label>
        {valori.uguali ? (
          <CampoEuroT id="simulazione-costo-unico" etichetta="Rete, ACI ed Extra raccolta" valore={valori.unico} errore={erroreUnico}
            onCambia={(t) => setValori(v => ({ ...v, unico: t }))} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {CANALI_SIMULAZIONE.map(k => (
              <CampoEuroT key={k} id={`simulazione-costo-${k}`} etichetta={NOMI_SIMULAZIONE[k]} valore={valori[k]} errore={errori[k]}
                onCambia={(t) => setValori(v => ({ ...v, [k]: t }))} />
            ))}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          È solo una prova: il valore non si salva nel gestionale. Questo browser ricorda l'ultimo valore scritto, per la prossima volta.
        </p>
        {!haParametro && (
          <p className="text-xs text-muted-foreground flex items-start gap-1">
            <Info className="w-3 h-3 mt-0.5 shrink-0" />
            <span>Scrivi il costo €/t di SMOCO per vedere il margine simulato. Qui sotto, intanto, le tonnellate di SMOCO, il margine vero, il costo di pareggio e la media dei raccoglitori esterni.</span>
          </p>
        )}
      </div>

      {sim.canali.map(c => (
        <CanaleSimulato key={c.canale} c={c} anno={sim.anno} periodo={testoPeriodo(sim)} onUsaMedia={usaMedia} />
      ))}
    </section>
  );
}
