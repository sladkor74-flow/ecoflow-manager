// Quanto ci si attende dal contratto a una data (chiusura dell'audit, 11/10/2026):
// il target annuo e il riparto per regione dell'anno, il profilo mensile
// riportato all'annuo e i giorni coperti dai dati.
//
// Specchio di base44/shared/attesoContratto.ts per il browser: deve restare
// identico (prove/specchi.mjs). Le ragioni stanno nell'originale.
import { daConfermare } from './annoTarget.js';

/** Il target annuo RETE quando il contratto dell'anno non c'e': solo per questi anni, e lo si dice. */
export const TARGET_ANNUO_RIPIEGO = { 2025: 11200, 2026: 11550 };

/** Il riparto per regione del contratto 2026, solo per il 2026 e solo se il contratto non lo porta. */
export const REGIONI_RIPIEGO = {
  2026: { Campania: 4400, Puglia: 2500, Basilicata: 500, Calabria: 1650, Sicilia: 2500 },
};

const lista = (json) => {
  try {
    const v = typeof json === 'string' ? JSON.parse(json || '[]') : json;
    return Array.isArray(v) ? v : [];
  } catch { return []; }
};
const due = (n) => String(n).padStart(2, '0');

/** I giorni di un mese (indice 0-11). */
export const giorniDelMese = (anno, meseIdx) => new Date(Date.UTC(Number(anno), meseIdx + 1, 0)).getUTCDate();

/**
 * Il giorno fin dove arrivano i dati: l'ultimo giorno con un dato, mai oltre
 * oggi (una data sbagliata nel futuro non deve far sembrare coperto un mese che
 * non lo e'). Stringa vuota se non c'e' nessun dato. Giorni italiani 'AAAA-MM-GG'.
 */
export const giornoDeiDati = (ultimo, oggi = '') => (!ultimo ? '' : oggi && ultimo > oggi ? oggi : ultimo);

/**
 * Quanti giorni di un mese coprono i dati: fino all'ultimo giorno con un dato e
 * mai oltre oggi. Un mese tutto prima conta intero, uno tutto dopo zero.
 */
export function giorniCopertiNelMese(anno, meseIdx, ultimoGiornoDati, oggi = '') {
  const limite = giornoDeiDati(ultimoGiornoDati, oggi);
  if (!limite) return 0;
  const tot = giorniDelMese(anno, meseIdx);
  const inizio = `${anno}-${due(meseIdx + 1)}-01`;
  const fine = `${anno}-${due(meseIdx + 1)}-${due(tot)}`;
  if (limite < inizio) return 0;
  if (limite >= fine) return tot;
  return Number(limite.slice(8, 10));
}

/** La parte di un mese coperta dai dati, fra 0 e 1. */
export const frazioneDelMese = (anno, meseIdx, ultimoGiornoDati, oggi = '') =>
  giorniCopertiNelMese(anno, meseIdx, ultimoGiornoDati, oggi) / giorniDelMese(anno, meseIdx);

/**
 * Il target annuo RETE di un anno: { t, fonte, da_confermare }.
 * fonte: 'contratto' (target_annuo_t del contratto), 'ripiego' (le costanti
 * qui sopra: il contratto non e' inserito o non ha il target annuo) o null
 * (nessun target: si mostra «—», mai 0). da_confermare: il contratto e' una
 * copia dell'anno prima non ancora confermata, e va detto.
 */
export function targetAnnuoDellAnno(commessa, anno) {
  const t = Number(commessa && commessa.target_annuo_t);
  if (t > 0) return { t, fonte: 'contratto', da_confermare: daConfermare(commessa) };
  const r = TARGET_ANNUO_RIPIEGO[Number(anno)];
  if (r) return { t: r, fonte: 'ripiego', da_confermare: false };
  return { t: null, fonte: null, da_confermare: false };
}

/**
 * Il contratto per regione di un anno: { righe: [{ regione, target_t, ... }], fonte }
 * con la stessa logica del target annuo; il riparto scritto nel codice vale solo
 * per il 2026, l'anno da cui viene.
 */
export function regioniDellAnno(commessa, anno) {
  const righe = commessa ? lista(commessa.regioni_json).filter(r => r && r.regione) : [];
  if (righe.length) return { righe: righe.map(r => ({ ...r, target_t: Number(r.target_t) || 0 })), fonte: 'contratto' };
  const r = REGIONI_RIPIEGO[Number(anno)];
  if (r) return { righe: Object.entries(r).map(([regione, target_t]) => ({ regione, target_t })), fonte: 'ripiego' };
  return { righe: [], fonte: null };
}

/**
 * Il profilo mensile del contratto riportato all'annuo: dodici pesi che sommano
 * 1. rivisto: il profilo viene dal contratto (altrimenti sono dodicesimi);
 * totale: quanto somma il profilo scritto, che puo' non essere il target annuo.
 */
export function profiloMensile(commessa) {
  const scritti = commessa ? lista(commessa.target_mensile_json) : [];
  const valori = Array.from({ length: 12 }, (_, i) => Number(scritti[i]) || 0);
  const totale = valori.reduce((s, v) => s + v, 0);
  if (totale > 0) return { pesi: valori.map(v => v / totale), totale, rivisto: true };
  return { pesi: valori.map(() => 1 / 12), totale: 0, rivisto: false };
}

/**
 * La quota del target annuo attesa fino al giorno dei dati, fra 0 e 1: i mesi
 * coperti interi, il mese dei dati per i giorni coperti. null se non si sa fin
 * dove arrivano i dati (nessun dato).
 */
export function quotaAttesa(commessa, anno, giornoDati) {
  if (!giornoDati) return null;
  const a = Number(anno);
  const annoDati = Number(giornoDati.slice(0, 4));
  if (annoDati > a) return 1;
  if (annoDati < a) return 0;
  const { pesi } = profiloMensile(commessa);
  let q = 0;
  for (let i = 0; i < 12; i++) q += pesi[i] * frazioneDelMese(a, i, giornoDati);
  return Math.min(1, q);
}

/**
 * L'atteso alla data: { giorno, quota, target_t, atteso_t }. target_t e' il
 * target annuo del contratto (targetAnnuoDellAnno) se chi chiama non ne passa
 * uno suo, per esempio quello di una regione. atteso_t e' null quando manca il
 * target o il giorno dei dati: un atteso inventato e' peggio di nessuno.
 */
export function attesoAllaData(commessa, anno, giornoDati, targetT = undefined) {
  const t = targetT === undefined ? targetAnnuoDellAnno(commessa, anno).t : targetT;
  const quota = quotaAttesa(commessa, anno, giornoDati);
  const conTarget = t !== null && t !== undefined && Number.isFinite(Number(t));
  return {
    giorno: giornoDati || null,
    quota,
    target_t: conTarget ? Number(t) : null,
    atteso_t: conTarget && quota !== null ? Number(t) * quota : null,
  };
}
