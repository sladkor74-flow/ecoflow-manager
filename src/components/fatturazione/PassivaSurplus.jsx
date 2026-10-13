import React from 'react';
import { formatNumber } from '@/lib/utils';
import { DESTINATARI, NOMI_PRESTAZIONE, testoEuroT, aiDestinatari } from '@/lib/surplus';
import { periodoDelSurplus } from '@/lib/passivaAmministrazione';

// IL SURPLUS SULLE TARIFFE NELLA PAGINA DELLA PASSIVA (13/10/2026).
//
// Richiesta dell'utente del 12/10/2026: accanto alla tariffa un eventuale
// surplus in €/t con le sue date, e in fattura «una riga con l'importo standard
// ed una per il surplus (sempre riferito alle stesse tonnellate raccolte o
// trattate nel mese)», il tutto «ordinato, elegante e professionale nonché
// semplice a colpo d'occhio». Il primo e' il Fuel Surcharge del consorzio
// Ecotyre, +5 €/t a tutti i raccoglitori dal 01/10/2026 al 31/12/2026.
//
// Qui stanno i pezzi che le tre tabelle e il modulo usano insieme, cosi' la riga
// del surplus e' la stessa dappertutto: una barretta indaco a sinistra (l'ambra e
// il rosso in questa pagina vogliono dire «c'e' un problema», il surplus no),
// l'etichetta «Surplus» per chi non distingue il colore, il nome in corsivo, e le
// tonnellate fra parentesi e in grigio: sono le stesse del mese, si leggono ma
// l'occhio non le somma. Il colore e' il token --eco-surplus di src/index.css,
// lo stesso delle tariffe e dell'attiva, chiaro e scuro; il suo indaco (6366F1)
// e' quello del foglio Excel e del PDF.
// I numeri arrivano fatti dal calcolo della passiva: qui non si conta niente.

const euro = (v) => formatNumber(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Chi riceve il surplus di una prestazione, al singolare: «a 1 raccoglitore».
const DESTINATARIO = { RACCOLTA: 'raccoglitore', TRATTAMENTO: 'impianto', CONFERIMENTO_STOCCAGGIO: 'stoccaggio', TRASPORTO_SECONDARIA: 'trasportatore delle secondarie' };
/** Su che cosa si paga, con l'articolo giusto: «sullo stoccaggio». */
export const SULLA_PRESTAZIONE = { RACCOLTA: 'sulla raccolta', TRATTAMENTO: 'sul trattamento', CONFERIMENTO_STOCCAGGIO: 'sullo stoccaggio', TRASPORTO_SECONDARIA: 'sul trasporto delle secondarie' };

/** Lo sfondo della riga del surplus nelle tabelle. */
export const RIGA_SURPLUS = 'border-t bg-[hsl(var(--eco-surplus)/0.06)]';

/** Il nome dei surplus del mese, per i «di cui»: quello vero se ce n'e' uno solo. */
export function nomeSurplusDelMese(result) {
  const nomi = [...new Set(((result && result.surplus_del_mese) || []).map(s => String((s && s.nome) || '').trim()).filter(Boolean))];
  return nomi.length === 1 ? nomi[0] : 'surplus';
}

/** La prima cella della riga del surplus: barretta, etichetta e nome. */
export function EtichettaSurplus({ s }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span aria-hidden="true" className="h-4 w-1 shrink-0 rounded-full bg-[hsl(var(--eco-surplus))]" />
      <span className="shrink-0 rounded bg-[hsl(var(--eco-surplus)/0.14)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[hsl(var(--eco-surplus))]">Surplus</span>
      <span className="italic font-medium text-foreground">{s.nome}</span>
    </div>
  );
}

/** Le tonnellate della riga del surplus: fra parentesi, perche' non si sommano. */
export function TonnellateSurplus({ t }) {
  return (
    <span className="italic text-muted-foreground tabular-nums" title="Stesse tonnellate del mese: non si sommano una seconda volta">
      ({formatNumber(t)})
    </span>
  );
}

/** Da dove viene e quando vale: «consorzio Ecotyre · dal 01/10/2026 al 31/12/2026». */
export function OrigineSurplus({ s }) {
  return (
    <span className="text-xs text-muted-foreground">
      {[s.origine, periodoDelSurplus(s)].filter(Boolean).join(' · ')}
    </span>
  );
}

/** Sotto il totale di un fornitore che ha un surplus: come si compone. */
export function TotaleStandardSurplus({ f }) {
  if (!(Number(f && f.totale_surplus) > 0)) return null;
  return (
    <div className="text-[10px] font-normal text-muted-foreground whitespace-nowrap">
      standard {euro(f.totale_standard)} · surplus {euro(f.totale_surplus)}
    </div>
  );
}

/** Sotto il numero di un riquadro: «di cui Fuel Surcharge 4.332,80». */
export function DiCuiSurplus({ valore, nome }) {
  if (!(Number(valore) > 0)) return null;
  return (
    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[hsl(var(--eco-surplus))] tabular-nums">
      <span aria-hidden="true" className="h-3 w-0.5 shrink-0 rounded-full bg-[hsl(var(--eco-surplus))]" />
      <span>di cui {nome} {euro(valore)}</span>
    </div>
  );
}

/**
 * LE FASCE DEI SURPLUS DEL MESE, sopra le tabelle: una per surplus in corso nel
 * mese su questo canale, anche quando non c'e' niente da pagare (il surplus
 * vale, ma il mese non ha tonnellate). Neutre, non ambra: sono un'informazione.
 * Dicono che cosa vale, a chi, su quante tonnellate e quanto fa; le tonnellate
 * di un fornitore interno, che il surplus non lo riceve; e chi, in un elenco, nel
 * mese non ha righe di quella prestazione, perche' un elenco sbagliato
 * altrimenti tacerebbe.
 */
export function FasceSurplus({ surplus }) {
  const elenco = (surplus || []).filter(Boolean);
  if (!elenco.length) return null;
  return (
    <div className="space-y-2">
      {elenco.map((s, i) => {
        const chi = DESTINATARI[s.prestazione] || 'fornitori';
        const uno = DESTINATARIO[s.prestazione] || 'fornitore';
        const pagati = (s.fornitori || []).length;
        const testa = [
          s.nome,
          s.origine,
          `+${testoEuroT(s.euro_t)} ${aiDestinatari(s.prestazione, s.a_chi)}`,
          periodoDelSurplus(s),
        ].filter(Boolean);
        const senza = s.senza_righe || [];
        return (
          <div key={`${s.surplus_id || s.nome}-${i}`} className="flex gap-3 rounded-lg border bg-muted/30 px-4 py-2.5 text-sm">
            <span aria-hidden="true" className="w-1 shrink-0 self-stretch rounded-full bg-[hsl(var(--eco-surplus))]" />
            <div className="min-w-0 space-y-0.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="rounded bg-[hsl(var(--eco-surplus)/0.14)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[hsl(var(--eco-surplus))]">Surplus</span>
                {testa.map((pezzo, k) => (
                  <React.Fragment key={k}>
                    {k > 0 && <span aria-hidden="true" className="text-muted-foreground">·</span>}
                    <span className={k === 0 ? 'font-semibold italic' : ''}>{pezzo}</span>
                  </React.Fragment>
                ))}
              </div>
              <div className="text-muted-foreground tabular-nums">
                {pagati
                  ? <>Si paga {SULLA_PRESTAZIONE[s.prestazione] || ''}, sulle stesse tonnellate del mese: {formatNumber(s.tonnellate_pagate)} t a {pagati} {pagati === 1 ? uno : chi}, <span className="font-medium text-foreground">{euro(s.importo)} €</span>.</>
                  : <>Nel mese non ci sono tonnellate su cui pagarlo.</>}
              </div>
              {(s.interni || []).map((f, k) => (
                <div key={k} className="text-muted-foreground tabular-nums">
                  {f.fornitore} (interno) {formatNumber(f.tonnellate)} t: non si paga, a se stessi non si fattura.
                </div>
              ))}
              {s.riferimento && <div className="text-xs text-muted-foreground">Riferimento: {s.riferimento}</div>}
              {senza.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  {senza.length === 1
                    ? `Nell'elenco c'è ${senza[0]}, che in questo mese non ha righe di ${NOMI_PRESTAZIONE[s.prestazione] || 'questa prestazione'} in questo canale: controlla l'elenco del surplus.`
                    : `Nell'elenco ci sono ${senza.join(', ')}, che in questo mese non hanno righe di ${NOMI_PRESTAZIONE[s.prestazione] || 'questa prestazione'} in questo canale: controlla l'elenco del surplus.`}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
