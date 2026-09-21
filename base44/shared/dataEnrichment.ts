// Modulo condiviso per l'enrichment automatico delle colonne calcolate/derivate
// a partire dai dati grezzi importati dal portale Ecotyre.
// Le colonne derivate vengono calcolate e salvate affiancate ai dati grezzi,
// senza alterare la struttura sorgente.
import { PROV_TO_REGION, MESI } from "./raccoltoCalculator.ts";
import { giornoRoma, annoRoma, meseRoma } from "./giornoItaliano.ts";
import { eTerminato, settimanaIso, tempiRaccolta } from "./movimenti.ts";

export { giornoRoma, annoRoma, meseRoma };

// --- Helper di data ---


export function getMeseFromDate(dateStr) {
  const m = meseRoma(dateStr);
  return m < 0 ? null : MESI[m];
}

// Settimana e anno si leggono sul giorno italiano, come il mese: col fuso del
// server una mezzanotte italiana (22:00Z del giorno prima) finiva nella settimana
// e, a capodanno, nell'anno precedenti.
export function getSettimanaFromDate(dateStr) {
  return settimanaIso(giornoRoma(dateStr));
}

export function getAnnoFromDate(dateStr) {
  return annoRoma(dateStr);
}

export function getRegioneFromProvincia(provincia) {
  return PROV_TO_REGION[(provincia || '').toUpperCase().trim()] || '';
}

export function getClasseFromProdotto(prodotto) {
  if (!prodotto) return null;
  const s = String(prodotto).trim();
  // PFU Autodemolizione -> classe speciale ACI
  if (s.toLowerCase().includes('autodemolizione')) return 'PFU Autodemolizione';
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

// Entità per cui la "data riferimento" è l'immissione (Assegnati) vs la fine del trasporto (tutte le altre).
const ASSEGNATO_ENTITIES = new Set(['Assegnato']);

/**
 * La data che stabilisce a quale periodo appartiene un movimento.
 *
 * E' la FINE DEL TRASPORTO, mai la chiusura dell'ordine a portale. Le due date
 * non coincidono: il portale chiude l'ordine giorni dopo, e un trasporto finito
 * il 31 luglio con l'ordine chiuso l'11 agosto finirebbe contato ad agosto.
 * Contato sul 2026: succede su 96 primarie di rete (272,65 t), 2 ACI, una
 * secondaria e 65 terziarie su 99 (2.198,64 t).
 *
 * Vale in tutto il gestionale, per i conti come per i filtri, e non ha eccezioni
 * (regola dell'utente, 21/09/2026): nemmeno le giacenze, perche' il piazzale
 * cambia quando il camion arriva o parte, non quando il portale chiude la
 * pratica; nemmeno i tempi di raccolta, che vanno dall'immissione alla fine del
 * trasporto (tempiRaccolta in movimenti.ts). La chiusura si puo' solo mostrare.
 */
export function dataPeriodo(record) {
  if (!record) return null;
  // Un movimento terminato ha la sua fine trasporto, e il periodo e' quello. La
  // chiusura a portale non e' mai un periodo: arriva giorni dopo e sposta il
  // movimento nel mese sbagliato. Chi non ha avuto un trasporto (un ordine
  // aperto o cancellato) si colloca alla data di immissione.
  if (record.trasporto_finito_il) return record.trasporto_finito_il;
  // Un terminato senza fine trasporto non ha periodo: metterlo nel mese di
  // immissione sarebbe un ripiego, e un ritiro fatto a luglio su un ordine di
  // maggio risulterebbe raccolto a maggio. Resta senza mese e anno, e chi conta
  // lo esclude e lo segnala.
  if (eTerminato(record)) return null;
  return record.ordine_immesso_il;
}

/**
 * I campi dei tempi di raccolta come si salvano su una primaria di rete:
 * nr_giorni, scadenza_ordine e raccolta_nei_tempi, da tempiRaccolta (immissione
 * -> fine del trasporto). Dove non si misura sono vuoti, non quelli di prima: il
 * file Excel porta i suoi, con una regola che non e' la nostra, e un archivio
 * vecchio porta quelli misurati sulla chiusura a portale. Li usano il
 * caricamento (enrichRecord) e la migrazione migrateSlaFields, cosi' la regola
 * sta in un punto solo.
 *
 * La scadenza si salva a mezzogiorno UTC, che in Italia e' sempre lo stesso
 * giorno: l'istante di immissione piu' 30 giorni, attraversando il cambio
 * dell'ora legale, cadeva alle 23 italiane del giorno prima.
 */
export function campiTempiRaccolta(record) {
  const tempi = tempiRaccolta(record);
  return {
    nr_giorni: tempi && tempi.giorni != null ? tempi.giorni : null,
    scadenza_ordine: tempi ? `${tempi.scadenza}T12:00:00.000Z` : null,
    raccolta_nei_tempi: tempi && tempi.esito ? tempi.esito : null,
  };
}

function getDataRiferimento(record, entityType) {
  // Un assegnato non e' un movimento: non ha un trasporto, ha una data di immissione.
  if (ASSEGNATO_ENTITIES.has(entityType)) {
    return record.ordine_immesso_il;
  }
  return dataPeriodo(record);
}

// Arricchisce un record con tutte le colonne calcolate/derivate.
// Non altera i campi grezzi sorgente: calcola e scrive solo i campi derivati.
export function enrichRecord(record, entityType) {
  const r = { ...record };

  const dataRif = getDataRiferimento(r, entityType);

  // Mese, settimana ISO e anno di riferimento. Si scrivono sempre, anche vuoti:
  // il file porta le sue colonne Mese, Settimane e Anno, con una regola che non e'
  // la nostra, e dove il periodo non c'e' (un terminato senza fine trasporto)
  // restavano quelle, cioe' un periodo di cui nessuno sa la base.
  r.mese = getMeseFromDate(dataRif);
  r.settimane = getSettimanaFromDate(dataRif);
  r.anno = getAnnoFromDate(dataRif);

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

  // Tempi di raccolta: dall'immissione alla FINE DEL TRASPORTO, sul giorno
  // italiano (tempiRaccolta in movimenti.ts). Si misuravano fino alla chiusura a
  // portale, e un raccoglitore puntuale risultava fuori tempo quando la pratica si
  // chiudeva dopo. Il file Excel porta gia' Nr di Giorni e Raccolta nei tempi,
  // con una regola sua: qui si ricalcolano sempre, e senza fine trasporto si
  // svuotano invece di restare quelli del file.
  if (!ASSEGNATO_ENTITIES.has(entityType)) {
    const tempi = campiTempiRaccolta(r);
    if (tempi.nr_giorni != null || r.nr_giorni != null) r.nr_giorni = tempi.nr_giorni;

    // Scadenza (immissione + 30 giorni) ed esito, solo per le primarie di rete.
    // Anche la scadenza si svuota senza immissione: restava quella del file
    // mentre giorni ed esito si ricalcolavano.
    if (entityType === 'PrimariaRete') {
      r.scadenza_ordine = tempi.scadenza_ordine;
      r.raccolta_nei_tempi = tempi.raccolta_nei_tempi;
    }
  }

  return r;
}

// Arricchisce un array di record (bulk).
export function enrichRecords(records, entityType) {
  return records.map((r) => enrichRecord(r, entityType));
}