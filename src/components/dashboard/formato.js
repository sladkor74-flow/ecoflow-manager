// I numeri del quadro della commessa, all'italiana (migliorie dell'11/10/2026).
//
// Un valore che manca e' «—», mai 0: `tonnellate` e `percentuale` di
// src/lib/target.js lo fanno gia', mentre fmtTon e formatTonnellate di utils.js
// per null scrivono 0,00. Tonnellate con due decimali, tre se i chili non sono
// tondi; percentuali con uno; giorni gg/mm/aaaa.
import { tonnellate, percentuale } from '@/lib/target';
import { formatIntero, formatNumber } from '@/lib/utils';

const vuoto = (v) => v === null || v === undefined || v === '' || !Number.isFinite(Number(v));

/** Tonnellate con l'unita': «8.818,55 t», o «—». */
export const t = (v) => (vuoto(v) ? '—' : `${tonnellate(v)} t`);
/** La grandezza di uno scarto, senza segno: il segno lo dicono le parole («avanti di»). */
export const tAssoluto = (v) => (vuoto(v) ? '—' : `${tonnellate(Math.abs(Number(v)))} t`);
/** Tonnellate col segno davanti: «+129,319 t», «-37,773 t». */
export const tSegno = (v) => (vuoto(v) ? '—' : `${Number(v) > 0 ? '+' : Number(v) < 0 ? '−' : ''}${tonnellate(Math.abs(Number(v)))} t`);
/** Percentuale con una cifra: «76,4%», o «—». */
export const pct = (v, decimali = 1) => (vuoto(v) ? '—' : `${percentuale(v, decimali)}%`);
/** Un conteggio: «3.104», o «—». */
export const intero = (v) => (vuoto(v) ? '—' : formatIntero(v));
/** Il giorno italiano gg/mm/aaaa. */
export const giorno = (g) => (g ? String(g).slice(0, 10).split('-').reverse().join('/') : '—');
/** Il giorno senza l'anno: gg/mm. */
export const giornoMese = (g) => (g ? `${String(g).slice(8, 10)}/${String(g).slice(5, 7)}` : '—');
/** Avanti o indietro, a parole: lo scarto non si dice col solo colore. */
export const avantiIndietro = (scarto) => (vuoto(scarto) ? '—' : Number(scarto) >= 0 ? `avanti di ${tAssoluto(scarto)}` : `indietro di ${tAssoluto(scarto)}`);

export const NOMI_CANALE = { RETE: 'Rete', ACI: 'ACI', EXTRA_RACCOLTA: 'Extra raccolta' };
export const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

// I colori dei canali seguono il canale in tutta la pagina, come prima: rete
// verde, ACI ambra, extra raccolta blu. Target e atteso in tinte neutre, mai
// ambra: prima l'atteso del grafico per regione era ambra come l'ACI del grafico
// sopra, un colore con due significati.
export const COLORI = {
  rete: 'hsl(142 71% 45%)',
  aci: 'hsl(38 92% 50%)',
  extra: 'hsl(217 91% 60%)',
  target: 'hsl(197 82% 22%)',
  targetChiaro: 'hsl(197 30% 75%)',
};

/** Il segno dello scarto: freccia e parola, mai il solo colore. */
export const segnoScarto = (scarto) => (vuoto(scarto) ? '' : Number(scarto) >= 0 ? '▲' : '▼');
export const coloreScarto = (scarto) => (vuoto(scarto) ? 'text-muted-foreground' : Number(scarto) >= 0 ? 'text-emerald-700' : 'text-red-700');

/**
 * Da dove viene il target della rete, quando non e' il contratto confermato:
 * «copiato, da confermare», «target di ripiego». Un anno senza contratto ha il
 * target null: lo si dice, e i numeri che ne dipendono restano «—».
 */
export function qualificatoriTarget(rete) {
  if (!rete || rete.target_t === null || rete.target_t === undefined) return 'contratto non inserito';
  const q = [];
  if (rete.da_confermare) q.push('copiato, da confermare');
  if (rete.ripiego) q.push('target di ripiego');
  return q.join(', ');
}

/** Giorni medi, con un decimale se c'e': «12,4». */
export const giorniMedi = (v) => (vuoto(v) ? '—' : formatNumber(Number(v), { minimumFractionDigits: 0, maximumFractionDigits: 1 }));

/** Euro all'italiana, due decimali, il segno davanti: «€ 1.234,56». Solo per l'amministratore. */
export const euro = (v) => (vuoto(v) ? '—' : `€ ${formatNumber(Number(v), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
