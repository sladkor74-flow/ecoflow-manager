import { eAci } from "./canaleSecondaria.ts";
// Il file unico delle primarie si divide in quattro archivi secondo stato e classe:
// ordini assegnati o no, classe ACI (PFU Autodemolizione) o rete. La regola e' una
// sola per l'importazione lato server e per quella a blocchi letta nel browser.

export const ARCHIVI_PRIMARIE = ['PrimariaRete', 'PrimariaAci', 'Assegnato', 'AssegnatoAci'];

// Colonne del file che portano una data: immissione, inizio e fine trasporto
// sono obbligatorie (la fine trasporto e' quella su cui si ragiona), la chiusura
// a portale le accompagna.
export const DATE_PRIMARIE = new Set(['ordine_immesso_il', 'trasporto_iniziato_il', 'trasporto_finito_il', 'ordine_chiuso_il']);

/**
 * La data di un ritiro, da qualunque forma esca l'export del portale.
 * Il foglio si legge con cellDates, che restituisce un oggetto Date solo per le
 * celle con formato data: la stessa colonna esportata come testo ("13/09/2026")
 * o come numero generico (seriale 45905,54) arrivava come stringa e finiva in
 * archivio cosi' com'era, dove giornoRoma la legge vuota. Bastava un export
 * fatto in modo diverso perche' tutte e tre le date obbligatorie risultassero
 * mancanti su ogni riga del caricamento. Una data che resta illeggibile torna
 * null: e' un avviso visibile, non una data inventata.
 */
export function dataPrimaria(val) {
  if (val === undefined || val === null || val === '') return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val.toISOString();
  const s = String(val).trim();
  if (s === '') return null;
  // Seriale Excel, numero o testo: il portale registra al secondo, i millesimi
  // sono solo il resto del calcolo.
  const n = typeof val === 'number' ? val : Number(s.replace(',', '.'));
  if (!isNaN(n) && n > 20000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n * 86400) * 1000);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  // Testo italiano gg/mm/aaaa, con o senza orario: e' l'export "come si vede a
  // video". Mese e giorno fuori scala non si raddrizzano da soli (13/09 letto
  // all'americana farebbe gennaio dell'anno dopo): meglio nessuna data.
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const [, gg, mm, aaaa, ora = 0, min = 0, sec = 0] = m;
    if (Number(mm) < 1 || Number(mm) > 12 || Number(gg) < 1 || Number(gg) > 31) return null;
    const d = new Date(Date.UTC(Number(aaaa), Number(mm) - 1, Number(gg), Number(ora), Number(min), Number(sec)));
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

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
