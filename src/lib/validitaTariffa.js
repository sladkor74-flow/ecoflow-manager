// Specchio per le pagine di base44/shared/validitaTariffa.ts: le pagine non
// possono importare da base44/shared. Deve restare IDENTICO all'originale, a
// meno di questa intestazione e degli import, e lo controlla prove/specchi.mjs.
// E' nato l'11/10/2026 (chiusura dell'audit): il foglio dell'amministrazione
// leggeva la validita' delle tariffe a modo suo, e una tariffa non_attivo con la
// data di fine valeva in fattura ma non nel foglio. Chi cambia la regola la
// cambia nell'originale e la ricopia qui.
// Import relativi con l'estensione: cosi' lo leggono anche le prove in node.
import { giornoRoma } from './giornoItaliano.js';

/** Vero se la tariffa non e' disattivata: 'non_attivo' non vale mai, lo stato vuoto e' 'attivo'. */
export const tariffaNonDisattivata = (t) => !!t && String(t.stato || 'attivo') !== 'non_attivo';

/** Le tariffe che possono valere in almeno un giorno: tutte tranne le disattivate. */
export const tariffeNonDisattivate = (tariffe) => (tariffe || []).filter(tariffaNonDisattivata);

/**
 * Vero se la tariffa vale nel giorno `quando` (una data o un istante, letto sul
 * giorno italiano): non disattivata, e il giorno sta fra inizio e fine di
 * validita', estremi compresi. Senza inizio vale da sempre, senza fine per
 * sempre. Senza un giorno leggibile non vale: una tariffa con una validita' non
 * si sceglie a caso.
 */
export function tariffaValeIl(t, quando) {
  if (!tariffaNonDisattivata(t)) return false;
  const giorno = giornoRoma(quando);
  if (!giorno) return false;
  const inizio = String(t.data_inizio_validita || '').slice(0, 10);
  if (inizio && inizio > giorno) return false;
  const fine = String(t.data_fine_validita || '').slice(0, 10);
  if (fine && fine < giorno) return false;
  return true;
}

/**
 * Le tariffe 'non_attivo' CON UNA DATA DI FINE che si sovrappone al periodo
 * [dal, al] (giorni 'aaaa-mm-gg'). Fino all'11/10/2026 la fattura e la passiva
 * le facevano valere nella loro finestra; da quel giorno non valgono piu'. Se
 * ce n'e' una, chi calcola il mese lo dice: un prezzo che smette di valere non
 * deve sparire in silenzio, e se deve valere basta rimetterla attiva.
 */
export function disattivateNelPeriodo(tariffe, dal, al) {
  return (tariffe || []).filter(t => {
    if (!t || tariffaNonDisattivata(t)) return false;
    const fine = String(t.data_fine_validita || '').slice(0, 10);
    if (!fine) return false;
    const inizio = String(t.data_inizio_validita || '').slice(0, 10);
    return fine >= dal && (!inizio || inizio <= al);
  });
}

// LE TARIFFE DI RETE E ACI SONO ANNUALI COME I CONTRATTI (prova generale del
// cambio d'anno, 15/10/2026, difetto 7).
//
// I contratti di rete e ACI, attivi e passivi, sono annuali senza tacito
// rinnovo (regola dell'utente, 06/10/2026). Le tariffe seminate chiudono al
// 31/12, ma una scritta a mano dalle anagrafiche si salvava senza data di fine
// (il modulo proponeva «Al» vuoto), e «Riapri» la toglieva: nel 2027 la tariffa
// rete del 2026 fatturava gennaio a 202 €/t senza un avviso, e la lista del 2028
// contava «pronte» le tariffe del 2027 rimaste aperte. Un prezzo vecchio che
// passa per nuovo e' peggio di un prezzo che manca.
//
// La regola, per RETE, ACI e TUTTE (il trasporto delle secondarie di rete e
// ACI), attive e passive: inizio e fine obbligatori, e la fine al piu' il 31/12
// dell'anno in cui la tariffa comincia. L'extra raccolta resta libera: sono
// campagne occasionali, e il prezzo si concorda intervento per intervento
// (utente, 06/10/2026). Una tariffa 'non_attivo' non vale mai, e il suo periodo
// non conta. La usano gestisciAnagrafiche (create e update), il modulo delle
// tariffe, «Riapri» e la lista dell'anno nuovo (inizializzazioneAnno.ts).
export const TIPOLOGIE_ANNUALI = ['RETE', 'ACI', 'TUTTE'];

const codiceTipologia = (v) => String(v || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
// Un giorno 'aaaa-mm-gg' scritto davvero, o '' se manca o non e' una data.
const giornoScritto = (v) => {
  const s = String(v === null || v === undefined ? '' : v).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  const d = new Date(`${s}T12:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : '';
};
const dataItaliana = (g) => g.split('-').reverse().join('/');

/** Vero per le tariffe di rete, ACI e TUTTE: annuali, chiuse al 31/12 dell'anno in cui cominciano. */
export const tariffaAnnuale = (t) => !!t && TIPOLOGIE_ANNUALI.includes(codiceTipologia(t.tipologia));

/** Il 31/12 dell'anno di un giorno ('aaaa-12-31'), o '' se il giorno non c'e'. */
export const fineDellAnno = (giorno) => { const g = giornoScritto(giorno); return g ? `${g.slice(0, 4)}-12-31` : ''; };

/**
 * Vero se una tariffa annuale, non disattivata, vale oltre l'anno in cui
 * comincia: senza data di fine, o con la fine dopo il 31/12 di quell'anno. E'
 * la tariffa che la lista dell'anno nuovo segnala «da chiudere» invece di
 * contarla pronta.
 */
export function oltreLAnno(t) {
  if (!tariffaAnnuale(t) || !tariffaNonDisattivata(t)) return false;
  const fine = giornoScritto(t.data_fine_validita);
  if (!fine) return true;
  const finoA = fineDellAnno(t.data_inizio_validita);
  return !!finoA && fine > finoA;
}

/**
 * I controlli sul periodo di una tariffa, prima di salvarla: [{ gravita:
 * 'errore', campo, messaggio }], vuoto se va bene, nella forma di
 * controlliSurplus. Si controlla il record com'e' dopo il salvataggio (per una
 * modifica, quello di prima fuso coi dati nuovi). Solo rete, ACI e TUTTE; una
 * tariffa disattivata non vale mai, e il suo periodo non si controlla.
 */
export function controlliPeriodoTariffa(t) {
  const esiti = [];
  if (!tariffaAnnuale(t) || !tariffaNonDisattivata(t)) return esiti;
  const errore = (campo, messaggio) => esiti.push({ gravita: 'errore', campo, messaggio });
  const scritto = (v) => String(v === null || v === undefined ? '' : v).trim() !== '';
  const inizio = giornoScritto(t.data_inizio_validita);
  const fine = giornoScritto(t.data_fine_validita);
  const anno = inizio ? inizio.slice(0, 4) : '';
  if (!scritto(t.data_inizio_validita)) errore('data_inizio_validita', 'Manca la data di inizio validità: le tariffe di rete e ACI valgono dentro un anno di contratto.');
  else if (!inizio) errore('data_inizio_validita', 'La data di inizio validità non è una data.');
  if (!scritto(t.data_fine_validita)) {
    errore('data_fine_validita', `Manca la data di fine validità: i contratti di rete e ACI sono annuali senza tacito rinnovo, quindi la tariffa vale al più fino al ${anno ? `31/12/${anno}` : '31/12 dell\'anno in cui comincia'}. Per l'anno dopo si scrive una tariffa nuova, col contratto nuovo.`);
  } else if (!fine) errore('data_fine_validita', 'La data di fine validità non è una data.');
  else if (inizio && fine < inizio) errore('data_fine_validita', `La fine validità (${dataItaliana(fine)}) viene prima dell'inizio (${dataItaliana(inizio)}).`);
  else if (inizio && fine > fineDellAnno(inizio)) {
    errore('data_fine_validita', `La tariffa comincia nel ${anno} e finirebbe il ${dataItaliana(fine)}: i contratti di rete e ACI sono annuali senza tacito rinnovo, quindi al più fino al 31/12/${anno}. Per l'anno dopo si scrive una tariffa nuova, col contratto nuovo.`);
  }
  return esiti;
}

/**
 * Fino a quando «Riapri» rimette una tariffa: per rete, ACI e TUTTE il 31/12
 * dell'anno in cui comincia (una tariffa del 2026 non si riapre sul 2027: per il
 * 2027 serve la sua), '' se l'inizio non si legge; per l'extra raccolta null,
 * cioe' senza data di fine, come prima.
 */
export function fineRiapertura(t) {
  if (!tariffaAnnuale(t)) return null;
  return fineDellAnno(t && t.data_inizio_validita);
}
