// Stato e date degli interventi di extra raccolta inseriti a mano.
//
// Una richiesta si inserisce come "assegnato" e diventa "terminato" quando ha
// FIR, data di fine trasporto e peso effettivo. Solo i terminati vanno in
// fatturazione, giacenze, report e verifiche.
//
// Le date si salvano come giorno di calendario a mezzanotte UTC, come quelle
// importate dal portale, cosi' che ogni funzione legga lo stesso giorno. Le
// schede salvate in precedenza portano la mezzanotte italiana, cioe' le 22 o le
// 23 UTC del giorno prima: si riconoscono e si riportano al giorno giusto.

import { MESI } from '@/lib/pfuConstants';
import { dateMancanti, dateIncoerenti } from '@/lib/movimenti';

export const STATI_EXTRA = {
  assegnato: { etichetta: 'Assegnato', classe: 'bg-sky-50 text-sky-800 border-sky-200' },
  terminato: { etichetta: 'Terminato', classe: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  '': { etichetta: 'Senza stato', classe: 'bg-amber-50 text-amber-900 border-amber-300' },
};

export const statoExtra = (r) => {
  const s = String((r && r.stato) || '').toLowerCase().trim();
  return s === 'assegnato' || s === 'terminato' ? s : '';
};

export const eTerminato = (r) => statoExtra(r) === 'terminato';

// Per chiudere una scheda servono FIR, peso effettivo e le tre date obbligatorie
// del formulario - immissione, inizio e fine trasporto - in ordine (regola
// dell'utente del 22/09/2026): prima bastava la fine trasporto.
export const datiChiusuraCompleti = (r) => {
  if (!(r && r.numero_fir && Number(r.peso_effettivo) > 0)) return false;
  const comeTerminato = { ...r, stato: 'terminato' };
  return dateMancanti(comeTerminato).length === 0 && dateIncoerenti(comeTerminato).length === 0;
};

const mezzanotteItaliana = (d) => (d.getUTCHours() === 22 || d.getUTCHours() === 23) && !d.getUTCMinutes() && !d.getUTCSeconds() && !d.getUTCMilliseconds();

// Giorno di calendario (aaaa-mm-gg) di una data salvata.
export function giornoDaData(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  return (mezzanotteItaliana(d) ? new Date(d.getTime() + 3 * 3600000) : d).toISOString().slice(0, 10);
}

// Data da salvare per un giorno di calendario (aaaa-mm-gg).
export function dataDaGiorno(giorno) {
  return /^\d{4}-\d{2}-\d{2}$/.test(giorno || '') ? `${giorno}T00:00:00.000Z` : null;
}

// Mese e anno di competenza di un giorno di calendario.
export function competenza(giorno) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(giorno || '')) return {};
  return { mese: MESI[Number(giorno.slice(5, 7)) - 1], anno: Number(giorno.slice(0, 4)) };
}

// Date di un intervento riportate al giorno giusto: solo i campi da correggere.
export function dateDaCorreggere(r) {
  const campi = {};
  for (const k of ['ordine_immesso_il', 'trasporto_iniziato_il', 'trasporto_finito_il']) {
    if (!r[k]) continue;
    const corretta = dataDaGiorno(giornoDaData(r[k]));
    if (corretta && corretta.slice(0, 10) !== String(r[k]).slice(0, 10)) campi[k] = corretta;
  }
  return campi;
}
