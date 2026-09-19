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
  const c = String(record.classe || '').trim().toLowerCase();
  const p = String(record.prodotto || '').trim().toLowerCase();
  const aci = c.includes('autodemolizione') || c.includes('aci')
    || p.includes('autodemolizione') || p.includes('aci');
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
