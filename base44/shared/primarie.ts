import { eAci } from "./canaleSecondaria.ts";
// Il file unico delle primarie si divide in quattro archivi secondo stato e classe:
// ordini assegnati o no, classe ACI (PFU Autodemolizione) o rete. La regola e' una
// sola per l'importazione lato server e per quella a blocchi letta nel browser.

export const ARCHIVI_PRIMARIE = ['PrimariaRete', 'PrimariaAci', 'Assegnato', 'AssegnatoAci'];

// Colonne del file che portano una data (seriale Excel).
export const DATE_PRIMARIE = new Set(['ordine_immesso_il', 'trasporto_iniziato_il', 'trasporto_finito_il', 'ordine_chiuso_il']);

// Campi conservati negli archivi degli assegnati.
export const CAMPI_ASSEGNATO = [
  'id_ordine', 'stato', 'ordine_immesso_il', 'id_cliente', 'ragione_sociale',
  'id_pdr', 'punto_di_raccolta', 'indirizzo', 'cap', 'comune', 'provincia',
  'codice_regione', 'macroarea', 'codice_prodotto', 'prodotto', 'classe',
  'cer', 'tipo_contenitori', 'quantita_richiesta', 'quantita_ritirata',
  // Il ticket serve mentre l'ordine e' ancora assegnato: sull'ACI e' li' che si
  // legge il peso stimato su cui misurare la soglia del 10% quando si chiude il
  // formulario.
  'numero_ordine_interno',
  'peso_stimato', 'peso_effettivo', 'key_account', 'partner_operativo',
  'id_partner_operativo', 'id_trasportatore', 'trasportatore', 'regioni', 'mese', 'anno', 'sigla', 'regione'
];

/** Archivio di destinazione di un record gia' mappato e arricchito (con la classe). */
export function archivioPrimaria(record) {
  // Il canale si decide con la regola di tutto il gestionale (canaleSecondaria.ts),
  // non con una copia: questa guardava solo classe e prodotto, cercava "aci" anche
  // dentro altre parole e ignorava il codice prodotto ".class9". Un ordine
  // smistato qui in un archivio e letto altrove nell'altro canale non quadra piu'
  // da nessuna parte. Verificato il 20/09/2026 su 11.249 record: stesso esito.
  const aci = eAci(record);
  const assegnato = String(record.stato || '').toLowerCase().trim() === 'assegnato';
  if (assegnato) return aci ? 'AssegnatoAci' : 'Assegnato';
  return aci ? 'PrimariaAci' : 'PrimariaRete';
}

/** Record ridotto ai campi degli assegnati. */
export function recordAssegnato(record) {
  const o = {};
  for (const f of CAMPI_ASSEGNATO) o[f] = record[f] ?? null;
  return o;
}
