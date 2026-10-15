import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, TrendingUp, FileText, AlertTriangle, ArrowRight, CheckCircle, ChevronDown, Info } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { formatTonnellate, formatKg, formatIntero, formatNumber } from '@/lib/utils';
import { STILE_SURPLUS, baseSurplus, dettaglioSurplus } from '@/lib/surplusVista';
import { giornoRoma } from '@/lib/giornoItaliano';
import NomeSurplus from './NomeSurplus';

const euro = (v) => `€ ${formatNumber(v || 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const conSegno = (v, testo) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${testo}`;
// IL GIORNO ITALIANO, NON I PRIMI DIECI CARATTERI (13/10/2026). La data di
// elaborazione e' un istante UTC (toISOString), e la fine del trasporto arriva
// dal portale come mezzanotte italiana, cioe' le 22:00 o le 23:00 UTC del giorno
// prima: tagliando la stringa un documento elaborato alle 00:30 del 1° ottobre
// diceva «del 30/09», e un ritiro del 1° settembre «31/08», nel mese prima.
const giorno = (v) => {
  const g = giornoRoma(v);
  return g ? g.split('-').reverse().join('/') : '—';
};

// Il documento salvato contro i dati di oggi: i movimenti che il portale ha
// chiuso dopo l'elaborazione del mese si vedono qui, invece di restare non fatturati.
//
// LA RIGA DEL SURPLUS NON E' UN MOVIMENTO (il Fuel Surcharge, 13/10/2026).
// riconciliaAttiva la mette fra i nuovi, i cambiati o gli spariti come le altre
// (un ordine arrivato dopo cambia anche lei), ma qui la si conta a parte: prima
// un ordine arrivato dopo diceva «1 movimento arrivato, 1 con peso o importo
// cambiato», e il secondo era il surplus, con «0 kg» nella tabella. Il surplus
// ha la sua frase (spiegazione, dal calcolo), e su un documento chiuso la
// riconciliazione dice quanto va fatturato o stornato a parte (surplus_a_parte):
// il documento non si riapre da solo.
//
// UN DOCUMENTO CHIUSO CON DEI MOVIMENTI E IL SURPLUS CAMBIATI (revisione del
// 13/10/2026). Prima il riquadro dava due indicazioni: «va riaperto; in
// alternativa questi movimenti si fatturano con un'integrazione» e, sotto,
// «Fuel Surcharge, 29,70 € in più, va fatturato a parte». Ma rielaborando, il
// documento nuovo ha gia' il surplus delle tonnellate arrivate dopo, e la
// «Differenza» lo comprende gia': seguendole tutte e due il surplus si fatturava
// due volte. Ora c'e' una frase sola, con le due strade e i loro importi, e la
// frase di surplus_a_parte, che vale quando e' cambiato solo il surplus, qui non
// c'e'.
const PAROLE_RIGHE = { 2: 'due', 3: 'tre', 4: 'quattro', 5: 'cinque' };
function fraseChiusoMisto(r, delSurplus, euroSurplus) {
  const centSurplus = delSurplus.map(x => Math.round(euroSurplus(x) * 100));
  const centMovimenti = Math.round((Number(r.delta_euro) || 0) * 100) - centSurplus.reduce((s, c) => s + c, 0);
  const importo = (cent) => conSegno(cent, euro(Math.abs(cent) / 100));
  const voci = [`formulari ${importo(centMovimenti)}`, ...delSurplus.map((x, i) => `${x.descrizione || 'surplus'} ${importo(centSurplus[i])}`)];
  const nomi = [...new Set(delSurplus.map(x => x.descrizione || 'surplus'))];
  const righeSurplus = nomi.length === 1 ? `la riga del ${nomi[0]} giusta` : `le righe del ${nomi.join(' e del ')} giuste`;
  const totale = Math.round((Number(r.delta_euro) || 0) * 100);
  const elenco = `${voci.slice(0, -1).join(', ')} e ${voci[voci.length - 1]}`;
  return `Il periodo è chiuso, e si corregge in uno solo di due modi: riaprendo il documento e rielaborandolo, e il documento nuovo ha già ${righeSurplus}; oppure con ${totale < 0 ? 'uno storno' : 'un\'integrazione'} di ${importo(totale)} in ${PAROLE_RIGHE[voci.length] || voci.length} righe, ${elenco}. Non tutti e due, o il surplus si fattura due volte.`;
}

export function Riconciliazione({ t }) {
  const [aperto, setAperto] = useState(false);
  const r = t.riconciliazione;
  if (!r) return null;
  if (r.allineato) {
    return (
      <div className="text-xs text-emerald-700 flex items-center gap-1.5">
        <CheckCircle className="w-3.5 h-3.5" /> {t.label}: il documento del {giorno(r.data_elaborazione)} coincide con i dati di oggi.
      </div>
    );
  }
  const chiuso = r.stato === 'chiusa';
  const movimento = (x) => !x.surplus;
  const nuovi = (r.nuovi || []).filter(movimento);
  const cambiati = (r.cambiati || []).filter(movimento);
  const spariti = (r.spariti || []).filter(movimento);
  const delSurplus = [...(r.nuovi || []), ...(r.cambiati || []), ...(r.spariti || [])].filter(x => x.surplus);
  const euroSurplus = (x) => ((r.nuovi || []).includes(x) ? x.totale : (r.spariti || []).includes(x) ? -x.totale : x.totale_oggi - x.totale_documento);
  // la frase del riassunto: una riga nuova, tolta o cambiata, o piu' righe
  const nomeS = (x) => `la riga del ${x.descrizione || 'surplus'}`;
  const fraseSurplus = delSurplus.length > 1 ? `${delSurplus.length} righe di surplus sono cambiate`
    : delSurplus.length === 0 ? ''
      : (r.nuovi || []).includes(delSurplus[0]) ? `C'è ${nomeS(delSurplus[0])}, che il documento non ha`
        : (r.spariti || []).includes(delSurplus[0]) ? `Il documento ha ${nomeS(delSurplus[0])}, che oggi non vale più`
          : `${nomeS(delSurplus[0]).replace(/^l/, 'L')} è cambiata`;
  const righe = [
    ...nuovi.map(x => ({ ...x, tipo: 'arrivato dopo', kg_mostrati: x.kg, euro_mostrati: x.totale })),
    ...cambiati.map(x => ({ ...x, tipo: 'cambiato', kg_mostrati: x.kg_oggi - x.kg_documento, euro_mostrati: x.totale_oggi - x.totale_documento })),
    ...spariti.map(x => ({ ...x, tipo: 'non più nel mese', kg_mostrati: -x.kg, euro_mostrati: -x.totale })),
  ];
  const movimenti = righe.length > 0;
  const misto = chiuso && movimenti && delSurplus.length > 0;
  return (
    <div className="border-2 border-amber-300 bg-amber-50 rounded-lg p-4">
      <button onClick={() => setAperto(!aperto)} className="flex items-start justify-between w-full text-left gap-3">
        <div>
          <div className="flex items-center gap-2 font-semibold text-amber-900">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{t.label}: il documento del {giorno(r.data_elaborazione)} non coincide più con i dati di oggi</span>
          </div>
          <p className="text-sm text-amber-900/80 mt-1">
            {nuovi.length > 0 && <span>{nuovi.length} {nuovi.length === 1 ? 'movimento arrivato' : 'movimenti arrivati'} dopo l'elaborazione. </span>}
            {cambiati.length > 0 && <span>{cambiati.length} con peso o importo cambiato. </span>}
            {spariti.length > 0 && <span>{spariti.length} non più in questo mese. </span>}
            {fraseSurplus && <span>{fraseSurplus}. </span>}
            Differenza: <span className="font-medium tabular-nums">{conSegno(r.delta_kg, formatTonnellate(Math.abs(r.delta_kg) / 1000))} t</span>,{' '}
            <span className="font-medium tabular-nums">{conSegno(r.delta_euro, euro(Math.abs(r.delta_euro)))}</span>.
          </p>
          {/* su un documento chiuso con il solo surplus cambiato parla surplus_a_parte, qui sotto */}
          {!(chiuso && !movimenti && delSurplus.length > 0) && (
            <p className={`text-xs mt-1 ${misto ? 'font-medium text-amber-900' : 'text-amber-900/70'}`}>
              {misto ? fraseChiusoMisto(r, delSurplus, euroSurplus)
                : chiuso ? 'Il periodo è chiuso: per correggere il documento va riaperto; in alternativa questi movimenti si fatturano con un\'integrazione.'
                  : 'Premi "Elabora Mese" per aggiornare il documento.'}
            </p>
          )}
        </div>
        {movimenti && <ChevronDown className={`w-5 h-5 text-amber-900/60 shrink-0 transition-transform ${aperto ? 'rotate-180' : ''}`} />}
      </button>
      {/* Il surplus si dice sempre, anche a riquadro chiuso: e' una riga sola per canale */}
      {delSurplus.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {delSurplus.map((x, i) => (
            <div key={i} className={`rounded px-3 py-1.5 text-xs flex items-start justify-between gap-3 bg-background/70 ${STILE_SURPLUS.barretta}`}>
              <span>{x.spiegazione || x.descrizione}</span>
              <span className="tabular-nums font-medium shrink-0">{conSegno(euroSurplus(x), euro(Math.abs(euroSurplus(x))))}</span>
            </div>
          ))}
          {r.surplus_a_parte && !misto && <p className="text-xs font-medium text-amber-900">{r.surplus_a_parte.testo}</p>}
        </div>
      )}
      {aperto && movimenti && (
        <div className="mt-3 overflow-x-auto max-h-72 overflow-y-auto bg-background/70 rounded border border-amber-200">
          <table className="w-full text-xs">
            <thead className="bg-amber-100/60 sticky top-0"><tr className="text-left">
              <th className="px-2 py-1.5 font-semibold">ID ordine</th>
              <th className="px-2 py-1.5 font-semibold">Formulario</th>
              <th className="px-2 py-1.5 font-semibold">Fine trasporto</th>
              <th className="px-2 py-1.5 font-semibold">Differenza</th>
              <th className="px-2 py-1.5 font-semibold text-right">kg</th>
              <th className="px-2 py-1.5 font-semibold text-right">€</th>
            </tr></thead>
            <tbody>
              {righe.map((x, i) => (
                <tr key={i} className="border-t border-amber-100">
                  <td className="px-2 py-1 font-mono">{x.ordine || '—'}</td>
                  <td className="px-2 py-1">{x.numero_fir || '—'}{x.descrizione ? ` · ${x.descrizione}` : ''}</td>
                  <td className="px-2 py-1">{giorno(x.data_fine_trasporto)}</td>
                  <td className="px-2 py-1">{x.tipo}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{conSegno(x.kg_mostrati, formatKg(Math.abs(x.kg_mostrati)))}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{conSegno(x.euro_mostrati, formatNumber(Math.abs(x.euro_mostrati), { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Badge({ badge }) {
  if (!badge) return null;
  if (badge.tipo === 'uniforme') {
    return <span className="text-xs text-muted-foreground">{badge.valore} {badge.unita_misura}</span>;
  }
  if (badge.tipo === 'variabile') {
    const tip = badge.valori.map(v => `${v.valore} ${v.unita_misura}${v.ambiti && v.ambiti.length ? ` (${v.ambiti.join(', ')})` : ''}`).join('; ');
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild><span className="text-xs text-muted-foreground underline decoration-dotted cursor-help">variabile</span></TooltipTrigger>
          <TooltipContent className="max-w-xs"><p className="text-xs">{tip}</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  if (badge.tipo === 'mancante') {
    // Le righe in errore sono a zero euro: senza tariffa, con un'unita' che non
    // si legge o, sull'ACI, senza provincia (13/10/2026). «tariffa mancante»
    // mandava a cercare una tariffa anche quando mancava la provincia.
    const tip = `${formatTonnellate(badge.tonnellate_mancanti)} t senza prezzo (${formatIntero(badge.count_mancanti)} ${badge.count_mancanti === 1 ? 'riga' : 'righe'} in errore): il documento non si verifica finché restano`;
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild><span className="text-xs text-destructive font-medium underline decoration-dotted cursor-help">senza prezzo</span></TooltipTrigger>
          <TooltipContent className="max-w-xs"><p className="text-xs">{tip}</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  return null;
}

// IL RIQUADRO DI UN CANALE DICE LA FATTURA COM'E' (13/10/2026). Senza surplus non
// cambia niente: il totale, le tonnellate, gli ordini e le regioni. Con un
// surplus (il Fuel Surcharge del consorzio) il totale e' quello che si fattura e
// sotto ci sono le due righe della fattura, come le ha chieste l'utente: lo
// standard, cioe' i formulari, e il surplus sulle stesse tonnellate («1.120,24 t
// × 5,00 €/t»), con la sua origine e le sue date. Le regioni restano quelle dei
// formulari: il surplus non ha regione.
export function SchedaCanale({ t }) {
  const surplus = t.surplus || [];
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-heading font-semibold">{t.label}</h4>
        <Badge badge={t.badge} />
      </div>
      <p className="text-2xl font-bold tabular-nums">{euro(t.totale)}</p>
      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
        <span>{formatTonnellate(t.volume_ton)} t</span>
        <span>•</span>
        <span>{formatIntero(t.ordini)} ordini</span>
      </div>
      {surplus.length > 0 && (
        <div className="mt-3 rounded-md border overflow-hidden text-xs">
          <div className="flex items-baseline justify-between gap-2 px-2.5 py-1.5">
            <span className="text-muted-foreground">Standard <span className="text-[11px]">· formulari del mese</span></span>
            <span className="tabular-nums font-medium">{euro(t.totale_standard)}</span>
          </div>
          {surplus.map(s => (
            <div key={s.surplus_id || s.nome} className={`flex items-start justify-between gap-2 px-2.5 py-1.5 border-t ${STILE_SURPLUS.fondo}`}>
              <span className="min-w-0">
                <NomeSurplus nome={s.nome} />
                <span className="block text-[11px] text-muted-foreground tabular-nums">{baseSurplus(s.kg, s.euro_t)}</span>
                {dettaglioSurplus(s) && <span className="block text-[11px] text-muted-foreground">{dettaglioSurplus(s)}</span>}
              </span>
              <span className="tabular-nums font-medium shrink-0">{euro(s.totale)}</span>
            </div>
          ))}
        </div>
      )}
      {t.by_regione && t.by_regione.length > 0 && (
        <div className="mt-3 pt-3 border-t space-y-1.5">
          {surplus.length > 0 && <p className="text-[11px] text-muted-foreground">Formulari per regione del ritiro</p>}
          {t.by_regione.slice(0, 5).map(r => (
            <div key={r.regione} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground truncate">{r.regione}</span>
              <div className="flex items-center gap-2">
                <span className="tabular-nums">{formatTonnellate((r.kg / 1000))} t</span>
                <span className="font-medium tabular-nums">€ {formatNumber(r.totale, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
              </div>
            </div>
          ))}
          {t.by_regione.length > 5 && (
            <p className="text-xs text-muted-foreground">+ {t.by_regione.length - 5} altre regioni</p>
          )}
        </div>
      )}
    </div>
  );
}

// Il riscontro per canale e per tipo di servizio, come lo scrive la prefattura.
// La riga del surplus sta sotto i due servizi del canale (13/10/2026): ha il suo
// importo, e gli ordini e i chili su cui vale fra parentesi, come nei fogli della
// passiva, perche' sono quelli dei servizi qui sopra e sommati due volte
// gonfierebbero il canale.
export function RiscontroServizi({ tipologie }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="py-2 pr-4 font-medium">Canale e servizio</th>
          <th className="py-2 pr-4 font-medium text-right">Ordini</th>
          <th className="py-2 pr-4 font-medium text-right">Kg</th>
          <th className="py-2 font-medium text-right">Importo (€)</th>
        </tr>
      </thead>
      {tipologie.map(t => (
        <tbody key={t.tipologia}>
          <tr className="border-t-2 font-semibold">
            <td className="py-2 pr-4">{t.label}</td>
            <td className="py-2 pr-4 text-right tabular-nums">{formatIntero(t.ordini)}</td>
            <td className="py-2 pr-4 text-right tabular-nums">{formatKg(t.volume_kg)}</td>
            <td className="py-2 text-right tabular-nums">{formatNumber(t.totale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          </tr>
          {[['TRASP', 'Trasp (pri)'], ['TRASP_TRATT', 'Trasp+Tratt (pri)']].map(([k, nome]) => {
            const s = t.ripartizione_servizio?.[k];
            if (!s || (!s.ordini && !s.totale)) return null;
            return (
              <tr key={k} className="text-muted-foreground">
                <td className="py-1 pr-4 pl-4 text-xs">{nome}</td>
                <td className="py-1 pr-4 text-right tabular-nums text-xs">{formatIntero(s.ordini)}</td>
                <td className="py-1 pr-4 text-right tabular-nums text-xs">{formatKg(s.kg)}</td>
                <td className="py-1 text-right tabular-nums text-xs">{formatNumber(s.totale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            );
          })}
          {(t.surplus || []).map(s => (
            <tr key={s.surplus_id || s.nome} className={`text-xs border-t ${STILE_SURPLUS.fondo}`}>
              <td className="py-1 pr-4 pl-2">
                <NomeSurplus nome={s.nome} />
                <span className="text-muted-foreground"> · {baseSurplus(s.kg, s.euro_t)}</span>
              </td>
              <td className={`py-1 pr-4 text-right ${STILE_SURPLUS.parentesi}`}>({formatIntero(s.ordini)})</td>
              <td className={`py-1 pr-4 text-right ${STILE_SURPLUS.parentesi}`}>({formatKg(s.kg)})</td>
              <td className="py-1 text-right tabular-nums">{formatNumber(s.totale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  );
}

export default function RiepilogoEcotyre({ periodo, onAnomalieChange, onVaiTariffe, versione }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState('');

  const load = async () => {
    setLoading(true);
    setErrore('');
    try {
      const res = await base44.functions.invoke('getRiepilogoEcotyre', { anno: periodo.anno, mese: periodo.mese });
      setData(res.data);
      if (onAnomalieChange) onAnomalieChange(res.data?.anomalie || []);
    } catch (e) {
      setData(null);
      setErrore(e?.response?.data?.error || e.message || 'Errore sconosciuto');
      if (onAnomalieChange) onAnomalieChange([]);
    }
    setLoading(false);
  };

  // versione cambia quando il mese viene rielaborato: l'anteprima e la
  // riconciliazione si rileggono insieme ai documenti.
  useEffect(() => { load(); }, [periodo.anno, periodo.mese, versione]);

  if (loading) {
    return <div className="flex items-center justify-center py-6 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Calcolo riepilogo...</div>;
  }
  if (errore) {
    return (
      <div className="border border-destructive/40 bg-destructive/5 rounded-lg p-4 text-sm text-destructive flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" /> Il riepilogo non è stato calcolato: {errore}
      </div>
    );
  }
  if (!data) return null;

  const tipologie = data.tipologie || [];
  const tutte = data.anomalie || [];
  const senzaTariffa = tutte.filter(a => !a.tipo || a.tipo === 'senza_tariffa');
  // GLI ERRORI STANNO A PARTE, IN ROSSO (decisione del 13/10/2026). L'ACI senza
  // provincia ne' regione era un avviso in ambra, in mezzo agli altri: ora e' un
  // errore, la riga e' a zero euro e il documento ACI non si verifica finche' non
  // si corregge. Il calcolo lo dice con gravita 'errore'; il tipo resta, per
  // riconoscerlo anche in una risposta di prima.
  // Dal 15/10/2026 anche le righe prezzate con una tariffa copiata da «Prepara
  // le tariffe» e non ancora confermata (difetto 15 della prova generale del
  // cambio d'anno): D4, decisione dell'utente del 15/10/2026, fermano il
  // documento come una riga senza prezzo, e la conferma e' in Target & Status ›
  // Nuovo anno. Prima gennaio 2027 si mostrava «uniforme 202 €/t» senza un avviso.
  const ERRORI = ['regione_mancante', 'tariffa_da_confermare'];
  const eErrore = (a) => a.gravita === 'errore' || ERRORI.includes(a.tipo);
  const errori = tutte.filter(a => a.tipo && a.tipo !== 'senza_tariffa' && eErrore(a));
  const altre = tutte.filter(a => a.tipo && a.tipo !== 'senza_tariffa' && !eErrore(a));
  // un prezzo che manca, uno preso dall'anno sbagliato o delle date da sistemare
  // si guardano; il resto e' informazione. Dall'11/10/2026 anche un terminato
  // senza peso effettivo (fuori dalla fattura finche' il peso non si scrive) e le
  // righe messe a zero da un'unita' di misura sconosciuta o da una tariffa
  // disattivata: uscivano in grigio, come se fossero un'informazione. Dal
  // 13/10/2026 anche il formulario ripetuto sullo stesso ordine
  // (calcolaRigheAttiva, 12/10/2026): e' da decidere, non da leggere e basta.
  const DA_GUARDARE = ['prezzo_zero', 'prezzo_altro_anno', 'peso_mancante', 'unita_sconosciuta', 'tariffa_disattivata', 'formulario_ripetuto', 'tariffa_da_confermare'];
  const daGuardare = (a) => DA_GUARDARE.includes(a.tipo) || String(a.tipo || '').startsWith('date_');
  // Le tonnellate senza prezzo si contano per canale: una somma unica di rete,
  // ACI ed extra raccolta non appartiene a nessuna commessa.
  const canaleDi = (a) => String(a.tipologia || 'N/D').toUpperCase();
  const senzaPrezzoPerCanale = [...new Set(['RETE', 'ACI', 'EXTRA_RACCOLTA', ...senzaTariffa.map(canaleDi)])]
    .map(c => {
      const sue = senzaTariffa.filter(a => canaleDi(a) === c);
      return { canale: c, combinazioni: sue.length, tonnellate: sue.reduce((s, a) => s + (a.tonnellate || 0), 0) };
    })
    .filter(x => x.combinazioni > 0);
  const nomeCanale = (c) => ({ RETE: 'Rete', ACI: 'ACI', EXTRA_RACCOLTA: 'Extra Raccolta' }[c] || c);
  // i surplus del mese, per la nota in fondo: uno per nome, anche se vale su piu' canali
  const nomiSurplus = [...new Set(tipologie.flatMap(t => (t.surplus || []).map(s => s.nome)))];

  return (
    <div className="space-y-4">
      {/* Rete, ACI ed extra raccolta sono commesse indipendenti: tre importi,
          mai un totale unico che li somma. */}
      <div className="border rounded-lg p-4 bg-gradient-to-r from-primary/10 to-primary/5">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h3 className="font-heading font-bold text-lg">Dovuto da Ecotyre — {data.periodo.mese} {data.periodo.anno}</h3>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Calcolato sui dati di oggi, canale per canale. Le tre commesse non si sommano.</p>
      </div>

      {/* Il documento salvato contro i dati di oggi */}
      {tipologie.map(t => <Riconciliazione key={t.tipologia} t={t} />)}

      {/* Righe senza tariffa */}
      {senzaTariffa.length > 0 && (
        <div className="border-2 border-destructive/40 bg-destructive/5 rounded-lg p-4">
          <div className="flex items-center gap-2 text-destructive font-semibold mb-2">
            <AlertTriangle className="w-5 h-5" />
            <span>Combinazioni senza tariffa, per canale: {senzaPrezzoPerCanale.map(x => `${nomeCanale(x.canale)} ${x.combinazioni} (${formatTonnellate(x.tonnellate)} t senza prezzo)`).join(' · ')}</span>
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {senzaTariffa.map((a, i) => (
              <div key={i} className="text-sm bg-background/60 rounded px-3 py-1.5 border border-destructive/20">
                <span className="font-medium">{a.tipologia}</span>
                {a.regione && <span> — {a.regione}</span>}
                {a.classe && <span> — classe {a.classe}</span>}
                {a.eer_codice && <span> — EER {a.eer_codice}</span>}
                <span className="text-muted-foreground">: {formatTonnellate(a.tonnellate)} t senza tariffa</span>
              </div>
            ))}
          </div>
          {onVaiTariffe && (
            <button onClick={onVaiTariffe} className="mt-2 text-sm text-primary hover:underline inline-flex items-center gap-1">
              Vai alle tariffe <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Gli errori che tengono fermo un documento: prima di verificarlo vanno corretti */}
      {errori.length > 0 && (
        <div className="border-2 border-destructive/40 bg-destructive/5 rounded-lg p-4">
          <div className="flex items-center gap-2 text-destructive font-semibold mb-2">
            <AlertTriangle className="w-5 h-5" />
            <span>Da correggere: il documento del canale non si verifica finché restano</span>
          </div>
          <div className="space-y-1">
            {errori.map((a, i) => (
              <div key={i} className="text-sm bg-background/60 rounded px-3 py-1.5 border border-destructive/20">{a.descrizione}</div>
            ))}
          </div>
        </div>
      )}

      {/* Avvisi: extra raccolta senza prezzo ne' base, secondarie non fatturate, e
          le date obbligatorie dei formulari (22/09/2026), per canale */}
      {altre.length > 0 && (
        <div className="border rounded-lg p-3 bg-muted/30 space-y-1">
          {altre.map((a, i) => (
            <div key={i} className={`text-sm flex items-start gap-2 ${daGuardare(a) ? 'text-amber-800' : 'text-muted-foreground'}`}>
              {daGuardare(a) ? <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> : <Info className="w-4 h-4 mt-0.5 shrink-0" />}
              <span>{a.descrizione}</span>
            </div>
          ))}
        </div>
      )}

      {/* Un riquadro per canale */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {tipologie.map(t => <SchedaCanale key={t.tipologia} t={t} />)}
      </div>

      {/* Riscontro con la prefattura Ecotyre: per canale e, dentro il canale, per tipo di servizio */}
      <div className="border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-primary" />
          <h4 className="font-heading font-semibold">Riscontro con la prefattura Ecotyre</h4>
        </div>
        <div className="overflow-x-auto">
          <RiscontroServizi tipologie={tipologie} />
        </div>
      </div>

      <div className="text-xs text-muted-foreground flex items-start gap-1.5">
        <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          Movimenti terminati con fine trasporto nel mese: un terminato senza la data resta fuori e si segnala fra gli avvisi. Rete e ACI al prezzo della tabella tariffe; extra raccolta al prezzo e ai sovracosti scritti sull'intervento, e, se il prezzo non è scritto, alla tariffa base Ecotyre dell'anno.
          {nomiSurplus.length > 0 && ` ${nomiSurplus.join(' e ')}: una riga per canale sulle stesse tonnellate dei formulari, arrotondata una volta sul mese, nel totale del canale e non nelle regioni.`}
        </span>
      </div>
    </div>
  );
}
