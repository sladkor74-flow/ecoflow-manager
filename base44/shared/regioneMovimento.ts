// LA REGIONE DI UN MOVIMENTO, LETTA IN UN MODO SOLO (chiusura dell'audit,
// 11/10/2026).
//
// Un ritiro porta tre campi che dicono la regione: la provincia, la regione che
// enrichRecord (dataEnrichment.ts) riscrive dalla provincia a ogni caricamento, e
// la colonna «Regioni» del file del portale, che arriva cosi' com'e' e non si
// ricalcola mai. Il raccolto, il report settimanale, gli avvisi dei target, la
// dashboard e le giacenze leggevano la provincia; il Report Mensile ed EcoTyna
// leggevano per primo il campo del file. Il 10/10 regione e provincia tornavano
// su tutti i 3.104 ritiri, ma una sola riga col campo del file scritto diverso
// bastava a spostare le sue tonnellate in un'altra regione in due moduli e non
// negli altri.
//
// L'ordine e' quello del dato piu' sicuro: la provincia, poi la regione che ne
// deriva, poi il campo del file, solo quando non c'e' altro. Stringa vuota se non
// c'e' niente: chi scrive l'etichetta decide come mostrarla («N/D»).

import { getRegioneFromProvincia } from "./regioneMap.ts";

export function regioneDi(r) {
  if (!r) return '';
  const dallaProvincia = getRegioneFromProvincia(r.provincia);
  if (dallaProvincia) return dallaProvincia;
  const regione = String(r.regione ?? '').replace(/\s+/g, ' ').trim();
  if (regione) return regione;
  return String(r.regioni ?? '').replace(/\s+/g, ' ').trim();
}
