// Modulo condiviso per l'enrichment automatico delle colonne calcolate/derivate
// a partire dai dati grezzi importati dal portale Ecotyre.
// Le colonne derivate vengono calcolate e salvate affiancate ai dati grezzi,
// senza alterare la struttura sorgente.
import { PROV_TO_REGION, MESI } from "./raccoltoCalculator.ts";

// --- Helper di data ---

export function getMeseFromDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return MESI[d.getMonth()];
}

export function getSettimanaFromDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  return 1 + Math.ceil((firstThursday - target) / 604800000);
}

export function getAnnoFromDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.getFullYear();
}

export function getRegioneFromProvincia(provincia) {
  return PROV_TO_REGION[(provincia || '').toUpperCase().trim()] || '';
}

export function getClasseFromProdotto(prodotto) {
  if (!prodotto) return null;
  const s = String(prodotto).trim();
  // Estrai caratteri a sinistra di " -" (es. "P - fino a 35 kg" -> "P")
  const idx = s.indexOf(' -');
  if (idx > 0) {
    const classe = s.substring(0, idx).trim();
    if (classe) return classe;
  }
  // Fallback regex
  const m = s.match(/^([A-Z0-9]{1,3})\s*-/i);
  return m ? m[1].toUpperCase() : null;
}

// --- Enrichment ---

// Entità per cui la "data riferimento" è l'immissione (Assegnati) vs la chiusura (tutte le altre).
const ASSEGNATO_ENTITIES = new Set(['Assegnato']);

function getDataRiferimento(record, entityType) {
  if (ASSEGNATO_ENTITIES.has(entityType)) {
    return record.ordine_immesso_il;
  }
  return record.ordine_chiuso_il || record.trasporto_finito_il || record.ordine_immesso_il;
}

// Arricchisce un record con tutte le colonne calcolate/derivate.
// Non altera i campi grezzi sorgente: calcola e scrive solo i campi derivati.
export function enrichRecord(record, entityType) {
  const r = { ...record };

  const dataRif = getDataRiferimento(r, entityType);

  // Mese (riferimento)
  const mese = getMeseFromDate(dataRif);
  if (mese) r.mese = mese;

  // Settimana (ISO week)
  const sett = getSettimanaFromDate(dataRif);
  if (sett != null) r.settimane = sett;

  // Anno
  const anno = getAnnoFromDate(dataRif);
  if (anno != null) r.anno = anno;

  // Mese di immissione (solo per entità non-Assegnato)
  if (!ASSEGNATO_ENTITIES.has(entityType) && r.ordine_immesso_il) {
    const meseImm = getMeseFromDate(r.ordine_immesso_il);
    if (meseImm) r.mese_immissione = meseImm;
  }

  // Classe PFU dal prodotto (solo se non già presente dal Excel)
  if (!r.classe) {
    const classe = getClasseFromProdotto(r.prodotto);
    if (classe) r.classe = classe;
  }

  // Regione dalla provincia
  const regione = getRegioneFromProvincia(r.provincia);
  if (regione) r.regione = regione;

  // Sigla = provincia
  if (r.provincia) r.sigla = r.provincia.toUpperCase().trim();

  // Nr di giorni (tempo evasione) - solo per entità con ordine_chiuso_il
  if (!ASSEGNATO_ENTITIES.has(entityType) && r.ordine_immesso_il && r.ordine_chiuso_il) {
    const d1 = new Date(r.ordine_immesso_il);
    const d2 = new Date(r.ordine_chiuso_il);
    if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
      r.nr_giorni = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
    }
  }

  // Scadenza ordine (immissione + 30 giorni) e esito tempi - solo per PrimariaRete
  if (entityType === 'PrimariaRete' && r.ordine_immesso_il) {
    const d = new Date(r.ordine_immesso_il);
    if (!isNaN(d.getTime())) {
      d.setDate(d.getDate() + 30);
      r.scadenza_ordine = d.toISOString();
      if (r.ordine_chiuso_il) {
        const chiusura = new Date(r.ordine_chiuso_il);
        if (!isNaN(chiusura.getTime())) {
          r.raccolta_nei_tempi = chiusura.getTime() <= d.getTime() ? 'OK' : 'DOPO SCADENZA';
        }
      }
    }
  }

  return r;
}

// Arricchisce un array di record (bulk).
export function enrichRecords(records, entityType) {
  return records.map((r) => enrichRecord(r, entityType));
}