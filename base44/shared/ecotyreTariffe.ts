// Tariffe e logica di calcolo per la fatturazione attiva Ecotyre.
// Condiviso tra elaboraFatturazioneAttiva e getRiepilogoEcotyre.
// Nessun valore predefinito: la tariffa deve esistere in tabella Tariffa (direzione ATTIVA).
// Risoluzione con validita' temporale e cliente case-insensitive.

function normText(v) { return String(v || '').trim().toUpperCase(); }

export function sortTariffe(tariffe) {
  return [...tariffe].map(t => ({
    ...t,
    specificity: (t.classe_materiale ? 1 : 0) + (t.eer_codice ? 1 : 0) + (t.regione ? 1 : 0),
  })).sort((a, b) => b.specificity - a.specificity);
}

// Ricerca tariffa attiva per tipologia/cliente/classe/regione/EER con validita' temporale.
// dataRiferimento opzionale (ISO): se valorizzata, esclude tariffe fuori periodo.
export function findTariffa(tariffeSorted, tipologia, cliente, classe, regione, eer, dataRiferimento) {
  const dt = dataRiferimento ? new Date(dataRiferimento).getTime() : null;
  for (const t of tariffeSorted) {
    if (t.tipologia !== tipologia) continue;
    if (t.cliente && normText(t.cliente) !== normText(cliente)) continue;
    if (t.classe_materiale && t.classe_materiale !== classe) continue;
    if (t.regione && t.regione !== regione) continue;
    if (t.eer_codice && t.eer_codice !== eer) continue;
    if (dt !== null) {
      if (t.data_inizio_validita && new Date(t.data_inizio_validita).getTime() > dt) continue;
      if (t.data_fine_validita && new Date(t.data_fine_validita).getTime() < dt) continue;
    }
    return t;
  }
  return null;
}

// Risolve la tariffa per il committente ECOTYRE. Nessun default: restituisce null se non trovata.
export function resolveTariffa(tariffeSorted, tipologia, classe, regione, eer, dataRiferimento) {
  return findTariffa(tariffeSorted, tipologia, 'ECOTYRE', classe, regione, eer, dataRiferimento);
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