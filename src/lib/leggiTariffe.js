// Le tariffe per una pagina che serve anche a chi non e' amministratore
// (decisione del 14/10/2026).
//
// Tariffa la legge solo l'amministratore: le tariffe passive sono i prezzi dei
// fornitori, che sono costi. Una pagina che leggesse l'archivio direttamente,
// aperta da un altro utente, riceverebbe un elenco vuoto e userebbe la sola base
// dell'anno senza un errore. Qui si chiede alla funzione leggiTariffe, che decide
// sul server chi sta chiedendo: all'amministratore tutte le tariffe, agli altri
// le sole attive (base44/shared/tariffeVisibili.ts). E' la strada di
// leggiSurplus (src/lib/leggiSurplus.js).
//
// Le pagine dell'amministratore (Tariffe & Anagrafiche, la Passiva) possono
// continuare a leggere l'archivio direttamente.
import { base44 } from '@/api/base44Client';

/**
 * Le tariffe che chi e' collegato puo' leggere: { parte, tariffe }. parte e'
 * 'tutto' per l'amministratore (tutto l'archivio) e 'attiva' per gli altri (le
 * sole tariffe attive). Le tariffe arrivano per data di creazione, la piu'
 * recente prima. Se la funzione non risponde con un elenco lancia un errore: la
 * pagina deve dire che le tariffe non si sono lette, non che non ce ne sono.
 */
export async function leggiTariffe() {
  const res = await base44.functions.invoke('leggiTariffe', {});
  const dati = res && res.data;
  if (!dati || !Array.isArray(dati.tariffe) || (dati.parte !== 'tutto' && dati.parte !== 'attiva')) {
    throw new Error((dati && dati.error) || 'Le tariffe non si sono potute leggere.');
  }
  return { parte: dati.parte, tariffe: dati.tariffe };
}
