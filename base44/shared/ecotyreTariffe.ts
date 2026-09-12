// Tariffe e logica di calcolo per la fatturazione attiva Ecotyre.
// Condiviso tra elaboraFatturazioneAttiva e getRiepilogoEcotyre.
// Nessun valore predefinito: la tariffa deve esistere in tabella Tariffa (direzione ATTIVA).
// Risoluzione con validita' temporale, cliente case-insensitive e preferenza servizio_ecotyre.

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
  const dt = dataRiferimento ? new Date(dataRiferimento).getTime() : null;
  for (const t of tariffeSorted) {
    if (t.tipologia !== tipologia) continue;
    if (t.cliente && normText(t.cliente) !== normText(cliente)) continue;
    if (t.classe_materiale && t.classe_materiale !== classe) continue;
    if (t.regione && t.regione !== regione) continue;
    if (t.eer_codice && t.eer_codice !== eer) continue;
    if (servizioEcotyre !== undefined && (t.servizio_ecotyre || '') !== servizioEcotyre) continue;
    if (dt !== null) {
      if (t.data_inizio_validita && new Date(t.data_inizio_validita).getTime() > dt) continue;
      if (t.data_fine_validita && new Date(t.data_fine_validita).getTime() < dt) continue;
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