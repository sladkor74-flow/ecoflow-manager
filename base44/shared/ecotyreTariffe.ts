// Tariffe e logica di calcolo per la fatturazione attiva Ecotyre.
// Condiviso tra elaboraFatturazioneAttiva e getRiepilogoEcotyre.

export const ECOTYRE_TARIFFE = {
  RETE: 202,
  EXTRA_RACCOLTA: 202,
  ACI: {
    'Puglia': 240,
    'Campania': 240,
    'Basilicata': 230,
    'Sicilia': 230,
    'Calabria': 230,
  },
};

export function getDefaultTariffa(tipologia, regione) {
  if (tipologia === 'RETE') return { valore: ECOTYRE_TARIFFE.RETE, unita_misura: '€/t' };
  if (tipologia === 'EXTRA_RACCOLTA') return { valore: ECOTYRE_TARIFFE.EXTRA_RACCOLTA, unita_misura: '€/t' };
  if (tipologia === 'ACI') {
    const val = ECOTYRE_TARIFFE.ACI[regione] || 230;
    return { valore: val, unita_misura: '€/t' };
  }
  return null;
}

export function sortTariffe(tariffe) {
  return [...tariffe].map(t => ({
    ...t,
    specificity: (t.classe_materiale ? 1 : 0) + (t.eer_codice ? 1 : 0) + (t.regione ? 1 : 0),
  })).sort((a, b) => b.specificity - a.specificity);
}

export function findTariffa(tariffeSorted, tipologia, cliente, classe, regione, eer) {
  for (const t of tariffeSorted) {
    if (t.tipologia !== tipologia) continue;
    if (t.cliente && t.cliente !== cliente) continue;
    if (t.classe_materiale && t.classe_materiale !== classe) continue;
    if (t.regione && t.regione !== regione) continue;
    if (t.eer_codice && t.eer_codice !== eer) continue;
    return t;
  }
  return null;
}

export function resolveTariffa(tariffeSorted, tipologia, classe, regione, eer) {
  const custom = findTariffa(tariffeSorted, tipologia, 'ECOTYRE', classe, regione, eer);
  if (custom) return custom;
  return getDefaultTariffa(tipologia, regione);
}

export function calcolaTotale(quantitaKg, tariffa) {
  if (!tariffa) return 0;
  const u = tariffa.unita_misura;
  if (u === '€/kg') return quantitaKg * tariffa.valore;
  if (u === '€/ton' || u === '€/t') return (quantitaKg / 1000) * tariffa.valore;
  if (u === '€/viaggio' || u === '€/vg' || u === '€/mese') return tariffa.valore;
  return quantitaKg * tariffa.valore;
}