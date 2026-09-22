// Tariffe e logica di calcolo per la fatturazione attiva Ecotyre.
// Condiviso tra elaboraFatturazioneAttiva e getRiepilogoEcotyre.
// Rete e ACI non hanno un valore predefinito: la tariffa deve esistere in tabella
// Tariffa (direzione ATTIVA). L'unica base scritta qui e' quella dell'extra
// raccolta, piu' sotto, e vale solo quando l'intervento non ha un prezzo suo.
// Risoluzione con validita' temporale, cliente case-insensitive e preferenza servizio_ecotyre.

import { giornoRoma } from "./giornoItaliano.ts";

// La tariffa base dell'extra raccolta verso Ecotyre, un valore per anno. Regola
// dell'utente del 22/09/2026: «la tariffa dell'extra raccolta di base per la
// fatturazione attiva e' sempre 202 €/t nel 2026». Vale quando sull'intervento
// il prezzo attivo e' zero o vuoto e nella tabella delle tariffe attive non c'e'
// una EXTRA_RACCOLTA valida alla fine del trasporto (seedTariffeAttive2026 la
// semina a 202: i due numeri devono restare uguali). Un anno che qui non c'e' non
// ha una base: il prezzo va scritto sull'intervento o messo in tabella, e fino ad
// allora la riga e' un errore.
// Il modulo Extra Raccolta ne ha una copia per il browser, in
// src/lib/extraRaccoltaCalc.js: prove/attivaCalcolo.mjs controlla che siano uguali.
export const TARIFFA_BASE_EXTRA_RACCOLTA: Record<number, number> = { 2026: 202 };

/** La tariffa base dell'extra raccolta (€/t) per un anno, oppure null se per quell'anno non c'e'. */
export const tariffaBaseExtraRaccolta = (anno) => TARIFFA_BASE_EXTRA_RACCOLTA[Number(anno)] || null;

function normText(v) { return String(v || '').trim().toUpperCase(); }

export function sortTariffe(tariffe) {
  return [...tariffe].map(t => ({
    ...t,
    specificity: (t.classe_materiale ? 1 : 0) + (t.eer_codice ? 1 : 0) + (t.regione ? 1 : 0) + (t.servizio_ecotyre ? 1 : 0),
  })).sort((a, b) => b.specificity - a.specificity);
}

// Ricerca tariffa attiva per tipologia/cliente/classe/regione/EER/servizio_ecotyre con validita' temporale.
// servizioEcotyre undefined = non filtrare per servizio_ecotyre (backward compat).
// servizioEcotyre '' = solo tariffe con servizio_ecotyre vuoto (valgono per entrambi).
// servizioEcotyre 'TRASP'/'TRASP_TRATT' = solo tariffe con quel servizio_esatto.
export function findTariffa(tariffeSorted, tipologia, cliente, classe, regione, eer, dataRiferimento, servizioEcotyre) {
  // La validita' si confronta sul giorno italiano, non sull'istante: una tariffa
  // che finisce il 30 giugno vale per tutto il 30 giugno, anche per un trasporto
  // memorizzato con l'ora vera. Stessa regola di calcolaPassiva.
  const giorno = dataRiferimento ? giornoRoma(dataRiferimento) : '';
  for (const t of tariffeSorted) {
    if (t.tipologia !== tipologia) continue;
    if (t.cliente && normText(t.cliente) !== normText(cliente)) continue;
    if (t.classe_materiale && t.classe_materiale !== classe) continue;
    if (t.regione && t.regione !== regione) continue;
    if (t.eer_codice && t.eer_codice !== eer) continue;
    if (servizioEcotyre !== undefined && (t.servizio_ecotyre || '') !== servizioEcotyre) continue;
    if (giorno) {
      const inizio = String(t.data_inizio_validita || '').slice(0, 10);
      const fine = String(t.data_fine_validita || '').slice(0, 10);
      if (inizio && inizio > giorno) continue;
      if (fine && fine < giorno) continue;
    }
    return t;
  }
  return null;
}

// Risolve la tariffa per il committente ECOTYRE con preferenza servizio_ecotyre:
// 1) tariffa con servizio_ecotyre uguale al tipo determinato (TRASP o TRASP_TRATT)
// 2) se non esiste, tariffa con servizio_ecotyre vuoto (vale per entrambi)
// Nessun default: restituisce null se nessuna delle due esiste.
export function resolveTariffa(tariffeSorted, tipologia, classe, regione, eer, dataRiferimento, servizioEcotyre) {
  let t = findTariffa(tariffeSorted, tipologia, 'ECOTYRE', classe, regione, eer, dataRiferimento, servizioEcotyre);
  if (t) return t;
  return findTariffa(tariffeSorted, tipologia, 'ECOTYRE', classe, regione, eer, dataRiferimento, '');
}

export function calcolaTotale(quantitaKg, tariffa) {
  if (!tariffa) return 0;
  const u = tariffa.unita_misura;
  if (u === '€/kg') return quantitaKg * tariffa.valore;
  if (u === '€/ton' || u === '€/t') return (quantitaKg / 1000) * tariffa.valore;
  if (u === '€/viaggio' || u === '€/vg') return tariffa.valore;
  return quantitaKg * tariffa.valore;
}

export function fattoreConv(tariffa) {
  if (!tariffa) return 1000;
  const u = tariffa.unita_misura;
  return (u === '€/ton' || u === '€/t') ? 1000 : 1;
}