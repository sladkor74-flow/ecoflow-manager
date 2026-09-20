// Specchio di base44/shared/movimenti.ts per il browser.
// Quando si cambia una regola va cambiata in tutti e due i file: lo controlla
// prove/specchi.mjs (npm run prove).
//
// Le regole con cui si legge un movimento, in un punto solo.
//
// Ogni modulo rileggeva gli archivi e riapplicava a modo suo stato, periodo e
// canale: era la radice di quasi tutte le incongruenze trovate dall'audit del
// 20/09/2026 (periodo letto in quattro modi, regola ACI riscritta in 26 file, 21
// funzioni senza filtro sullo stato). Chi deve decidere "questo movimento conta?
// in che mese? in che canale?" lo chiede qui.
//
// - CONTA un movimento terminato. Cancellati e assegnati non sono raccolto.
// - Il PERIODO e' la fine del trasporto, letta sul giorno italiano. Mai la
//   chiusura a portale (serve solo ai tempi di evasione), mai il fuso del server.
// - Il CANALE e' rete, ACI o extra raccolta, con la regola condivisa eAci().
//   I canali non si sommano mai.
//
// Questo file ha uno specchio per il browser: src/lib/movimenti.js. Una regola
// cambiata qui va cambiata la'.
import { giornoRoma } from '@/lib/giornoItaliano';
import { eAci } from '@/lib/canaleSecondaria';

export const MESI_MOVIMENTI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

export const eTerminato = (r) => String((r && r.stato) || '').toLowerCase().trim() === 'terminato';

/** Il giorno italiano in cui e' finito il trasporto, 'AAAA-MM-GG'. Stringa vuota se manca. */
export const giornoMovimento = (r) => giornoRoma(r && r.trasporto_finito_il);

/** Numero della settimana ISO di un giorno 'AAAA-MM-GG' (lunedi'-domenica), senza passare da nessun fuso. */
export function settimanaIso(giorno) {
  if (!giorno) return null;
  const d = new Date(Date.UTC(+giorno.slice(0, 4), +giorno.slice(5, 7) - 1, +giorno.slice(8, 10)));
  const g = (d.getUTCDay() + 6) % 7;            // lunedi' = 0
  d.setUTCDate(d.getUTCDate() - g + 3);         // il giovedi' della stessa settimana
  const capodanno = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - capodanno) / 86400000 + 1) / 7);
}

/** Il periodo di un movimento: { giorno, anno, mese_idx (0-11), mese, settimana } oppure null. */
export function periodoMovimento(r) {
  const giorno = giornoMovimento(r);
  if (!giorno) return null;
  const meseIdx = Number(giorno.slice(5, 7)) - 1;
  return { giorno, anno: Number(giorno.slice(0, 4)), mese_idx: meseIdx, mese: MESI_MOVIMENTI[meseIdx], settimana: settimanaIso(giorno) };
}

/**
 * Il giorno con cui un elenco colloca un ordine: la fine del trasporto; per chi
 * non l'ha (un ordine cancellato prima del ritiro) la data di immissione. Mai la
 * chiusura a portale: i filtri per anno e per giorno delle pagine la usavano, e
 * un ritiro del 31 dicembre chiuso a gennaio finiva nell'anno dopo mentre il
 * filtro per mese, che legge la fine trasporto, lo teneva a dicembre.
 */
export const giornoOrdine = (r) => giornoMovimento(r) || giornoRoma(r && r.ordine_immesso_il);
export const annoOrdine = (r) => { const g = giornoOrdine(r); return g ? Number(g.slice(0, 4)) : null; };
export const meseOrdine = (r) => { const g = giornoOrdine(r); return g ? MESI_MOVIMENTI[Number(g.slice(5, 7)) - 1] : null; };

/** Il canale di una primaria o di una secondaria. L'archivio dell'extra raccolta si dichiara. */
export const canaleMovimento = (r, archivio = '') => (archivio === 'ExtraRaccolta' ? 'EXTRA_RACCOLTA' : archivio === 'PrimariaAci' || eAci(r) ? 'ACI' : 'RETE');

const comeLista = (v) => (v === undefined || v === null || v === '' ? [] : Array.isArray(v) ? v : [v]);

/**
 * I movimenti che contano per un periodo. filtro: { anno, mese, canale, archivio,
 * ancheNonTerminati }. anno e mese accettano un valore o un elenco; il mese e' il
 * nome italiano o l'indice 0-11. Senza filtro restano i terminati con una fine
 * trasporto leggibile.
 */
export function filtraMovimenti(records, filtro = {}) {
  const anni = comeLista(filtro.anno).map(Number);
  const mesi = comeLista(filtro.mese).map(m => (typeof m === 'number' ? m : MESI_MOVIMENTI.findIndex(x => x.toLowerCase() === String(m).toLowerCase().trim())));
  const canali = comeLista(filtro.canale);
  return (records || []).filter(r => {
    if (!filtro.ancheNonTerminati && !eTerminato(r)) return false;
    const p = periodoMovimento(r);
    if (!p) return false;
    if (anni.length && !anni.includes(p.anno)) return false;
    if (mesi.length && !mesi.includes(p.mese_idx)) return false;
    if (canali.length && !canali.includes(canaleMovimento(r, filtro.archivio))) return false;
    return true;
  });
}
