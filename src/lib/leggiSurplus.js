// I surplus sulle tariffe (il Fuel Surcharge del consorzio Ecotyre) per una
// pagina che serve anche a chi non e' amministratore (decisione del 13/10/2026).
//
// SurplusTariffa lo legge solo l'amministratore: c'e' dentro quanto SMOCO paga in
// piu' ai fornitori, che e' un costo. Una pagina che lo leggesse direttamente,
// aperta da un altro utente, riceverebbe un elenco vuoto e direbbe «nessun
// surplus» senza un errore. Qui si chiede alla funzione leggiSurplus, che decide
// sul server chi sta chiedendo: all'amministratore tutti i record, agli altri la
// sola parte che SMOCO fattura a Ecotyre (base44/shared/surplusVisibile.ts).
//
// Le pagine dell'amministratore (Tariffe & Anagrafiche, la Passiva) possono
// continuare a leggere l'archivio direttamente.
import { base44 } from '@/api/base44Client';

/**
 * Tutti i surplus che chi e' collegato puo' leggere: i record dell'archivio
 * all'amministratore, la parte attiva agli altri. Se la funzione non risponde
 * con un elenco lancia un errore: la pagina deve dire che i surplus non si sono
 * letti, non che non ce ne sono.
 */
export async function leggiSurplus() {
  const res = await base44.functions.invoke('leggiSurplus', {});
  const dati = res && res.data;
  if (!dati || !Array.isArray(dati.surplus)) {
    throw new Error((dati && dati.error) || 'I surplus sulle tariffe non si sono potuti leggere.');
  }
  return dati.surplus;
}
