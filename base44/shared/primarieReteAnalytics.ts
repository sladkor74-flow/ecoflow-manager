// Modulo condiviso per le analytics del modulo Primarie Rete:
// 1. Matrice mensile FIR per Regione/Provincia con detection 2 mesi consecutivi a zero
// 2. Mix classi PFU per Raccoglitore con confronto target consorziali

import { PROV_TO_REGION, MESI } from "./raccoltoCalculator.ts";

export const TARGET_MIX_CLASSI: Record<string, number> = {
  P: 75,
  M: 20,
  G1: 4,
  G2: 1,
};

export const TARGET_ANNUO_TON = 11550;

// --- 1. Matrice Province ---

export function computeProvinceMatrixData(records, currentMonthIdx = null) {
  const now = new Date();
  const currMonth = currentMonthIdx != null ? currentMonthIdx : now.getMonth();
  const currYear = now.getFullYear();

  // Build province -> { regione, mesi: { Mese: count }, totale, fir_total }
  const byProvince: Record<string, any> = {};

  for (const r of records) {
    const provincia = (r.provincia || '').toUpperCase().trim();
    if (!provincia) continue;
    const regione = r.regione || PROV_TO_REGION[provincia] || 'Altro';

    const dataChiusura = r.ordine_chiuso_il ? new Date(r.ordine_chiuso_il)
      : r.trasporto_finito_il ? new Date(r.trasporto_finito_il) : null;
    if (!dataChiusura) continue;

    // Only count current year
    if (dataChiusura.getFullYear() !== currYear) continue;

    const meseIdx = dataChiusura.getMonth();
    const mese = MESI[meseIdx];
    const hasFir = r.numero_fir && String(r.numero_fir).trim() !== '';

    if (!byProvince[provincia]) {
      byProvince[provincia] = { provincia, regione, mesi: {}, totale: 0, fir_total: 0 };
      for (const m of MESI) byProvince[provincia].mesi[m] = 0;
    }

    byProvince[provincia].totale += 1;
    if (hasFir) byProvince[provincia].fir_total += 1;
    byProvince[provincia].mesi[mese] += 1;
  }

  // Convert to array and compute 2-consecutive-zero flags
  const provinceArray = Object.values(byProvince).map((p: any) => {
    const mesiValues = MESI.map((m, idx) => ({
      mese: m,
      idx,
      count: p.mesi[m],
      passed: idx <= currMonth,
    }));

    // Check for 2 consecutive passed months with 0
    let consecutiveZeros = 0;
    let has2Consecutive = false;
    let lastZeroPair = null;

    for (let i = 0; i < MESI.length; i++) {
      const mv = mesiValues[i];
      if (!mv.passed) break;
      if (mv.count === 0) {
        consecutiveZeros++;
        if (consecutiveZeros >= 2) {
          has2Consecutive = true;
          lastZeroPair = { start: MESI[i - 1], end: MESI[i] };
        }
      } else {
        consecutiveZeros = 0;
      }
    }

    return {
      ...p,
      mesiValues,
      has_2_consecutive_zeros: has2Consecutive,
      last_zero_pair: lastZeroPair,
    };
  });

  // Sort by regione then provincia
  provinceArray.sort((a, b) => a.regione.localeCompare(b.regione) || a.provincia.localeCompare(b.provincia));

  // Group by regione
  const byRegione: Record<string, any[]> = {};
  for (const p of provinceArray) {
    if (!byRegione[p.regione]) byRegione[p.regione] = [];
    byRegione[p.regione].push(p);
  }

  const provinceWithZeros = provinceArray.filter(p => p.has_2_consecutive_zeros);

  return {
    province: provinceArray,
    by_regione: byRegione,
    province_with_zeros: provinceWithZeros,
    current_month: MESI[currMonth],
    current_year: currYear,
  };
}

// --- 2. Mix Classi Raccoglitori ---

export function computeRaccoglitoriMixData(records, targetAnnuo = TARGET_ANNUO_TON, filters: any = {}) {
  const toArray = (v: any) => Array.isArray(v) ? v : (v != null ? [v] : []);
  const fAnno = toArray(filters.anno).map(Number);
  const fMese = toArray(filters.mese);
  const fRegione = toArray(filters.regione);
  const fStato = toArray(filters.stato);

  const filtered = records.filter((r: any) => {
    const regione = r.regione || PROV_TO_REGION[(r.provincia || '').toUpperCase().trim()] || 'Altro';
    const stato = (r.stato || '').trim();
    const dataChiusura = r.ordine_chiuso_il ? new Date(r.ordine_chiuso_il)
      : r.trasporto_finito_il ? new Date(r.trasporto_finito_il) : null;
    const meseIdx = dataChiusura ? dataChiusura.getMonth() : -1;
    const mese = meseIdx >= 0 ? MESI[meseIdx] : 'N/D';
    const anno = dataChiusura ? dataChiusura.getFullYear() : null;

    if (fAnno.length > 0 && !fAnno.includes(anno)) return false;
    if (fMese.length > 0 && !fMese.includes(mese)) return false;
    if (fRegione.length > 0 && !fRegione.includes(regione)) return false;
    if (fStato.length > 0 && !fStato.includes(stato)) return false;
    return true;
  });

  const byRaccoglitore: Record<string, any> = {};

  for (const r of filtered) {
    const raccoglitore = (r.trasportatore || 'N/D').trim();
    const classe = (r.classe || '').toUpperCase().trim();
    const peso = (r.peso_effettivo || 0) / 1000; // kg -> ton

    if (!byRaccoglitore[raccoglitore]) {
      byRaccoglitore[raccoglitore] = {
        raccoglitore,
        totale_peso: 0,
        classi: { P: 0, M: 0, G1: 0, G2: 0, ALTRO: 0 },
      };
    }

    byRaccoglitore[raccoglitore].totale_peso += peso;
    if (classe && byRaccoglitore[raccoglitore].classi[classe] !== undefined) {
      byRaccoglitore[raccoglitore].classi[classe] += peso;
    } else if (classe) {
      byRaccoglitore[raccoglitore].classi.ALTRO += peso;
    }
  }

  const deviazioneThreshold = 5; // ±5% absolute deviation

  const raccoglitoriArray = Object.values(byRaccoglitore).map((r: any) => {
    const totale = r.totale_peso;
    const percentuali: Record<string, number> = {};
    const percentuali_target: Record<string, number> = {};
    const deviazioni: Record<string, number> = {};

    for (const [classe, targetPct] of Object.entries(TARGET_MIX_CLASSI)) {
      const pesoClasse = r.classi[classe] || 0;
      const pct = totale > 0 ? (pesoClasse / totale) * 100 : 0;
      const pctTarget = (pesoClasse / targetAnnuo) * 100;
      const deviazione = pct - targetPct;

      percentuali[classe] = pct;
      percentuali_target[classe] = pctTarget;
      deviazioni[classe] = deviazione;
    }

    const deviazioni_significative = Object.entries(deviazioni)
      .filter(([_, d]) => Math.abs(d) > deviazioneThreshold)
      .map(([classe, d]) => ({
        classe,
        deviazione: d,
        target: TARGET_MIX_CLASSI[classe],
        attuale: percentuali[classe],
      }));

    return {
      ...r,
      percentuali,
      percentuali_target,
      deviazioni,
      deviazioni_significative,
      has_deviazione: deviazioni_significative.length > 0,
    };
  });

  raccoglitoriArray.sort((a, b) => b.totale_peso - a.totale_peso);

  return {
    raccoglitori: raccoglitoriArray,
    target_mix: TARGET_MIX_CLASSI,
    target_annuo: targetAnnuo,
    raccoglitori_con_deviazione: raccoglitoriArray.filter(r => r.has_deviazione),
  };
}

// --- 3. SLA Metrics per Trasportatore ---

export function computeSlaMetrics(records) {
  const byTrasportatore: Record<string, any> = {};

  for (const r of records) {
    const trasportatore = (r.trasportatore || 'N/D').trim();

    if (!byTrasportatore[trasportatore]) {
      byTrasportatore[trasportatore] = {
        trasportatore,
        totale: 0,
        nei_tempi: 0,
        dopo_scadenza: 0,
        nr_giorni_sum: 0,
        nr_giorni_count: 0,
        oltre_10gg: 0,
        oltre_12gg: 0,
      };
    }

    const t = byTrasportatore[trasportatore];
    t.totale += 1;

    if (r.raccolta_nei_tempi === 'OK') t.nei_tempi += 1;
    else if (r.raccolta_nei_tempi === 'DOPO SCADENZA') t.dopo_scadenza += 1;

    if (r.nr_giorni != null && !isNaN(r.nr_giorni)) {
      t.nr_giorni_sum += r.nr_giorni;
      t.nr_giorni_count += 1;
      if (r.nr_giorni > 10) t.oltre_10gg += 1;
      if (r.nr_giorni > 12) t.oltre_12gg += 1;
    }
  }

  const trasportatori = Object.values(byTrasportatore).map((t: any) => {
    const nr_giorni_medio = t.nr_giorni_count > 0 ? t.nr_giorni_sum / t.nr_giorni_count : 0;
    const pct_nei_tempi = t.totale > 0 ? (t.nei_tempi / t.totale) * 100 : 0;
    const pct_dopo_scadenza = t.totale > 0 ? (t.dopo_scadenza / t.totale) * 100 : 0;
    return {
      ...t,
      nr_giorni_medio,
      pct_nei_tempi,
      pct_dopo_scadenza,
      has_sla_critical: nr_giorni_medio > 12 || pct_dopo_scadenza > 20,
    };
  });

  trasportatori.sort((a, b) => b.totale - a.totale);

  const totale_ordini = trasportatori.reduce((s, t) => s + t.totale, 0);
  const totale_nei_tempi = trasportatori.reduce((s, t) => s + t.nei_tempi, 0);
  const totale_giorni = trasportatori.reduce((s, t) => s + t.nr_giorni_sum, 0);
  const totale_giorni_count = trasportatori.reduce((s, t) => s + t.nr_giorni_count, 0);

  return {
    trasportatori,
    totale_ordini,
    avg_giorni: totale_giorni_count > 0 ? totale_giorni / totale_giorni_count : 0,
    pct_nei_tempi_globale: totale_ordini > 0 ? (totale_nei_tempi / totale_ordini) * 100 : 0,
  };
}