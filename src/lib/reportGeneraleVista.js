// Vista "Report Generale": target assegnati contro raccolto, calcolati dai target
// di Target & Status e dalle primarie terminate.
//
// Il target e' del raccoglitore in una regione. L'impianto di destinazione non si
// fissa a priori: un raccoglitore puo' conferire a impianti diversi, quindi
// l'impianto si legge a consuntivo, mese per mese, dal raccolto. Per ogni
// raccoglitore e regione: target del mese, raccolto, delta (target meno raccolto),
// progressivo e residuo del target annuo; la media mensile residua divide cio' che
// manca all'inizio del mese per i mesi rimasti, mese compreso. Sotto, il raccolto
// ripartito per impianto effettivo.
//
// Solo canale RETE: ACI ed Extra Raccolta sono canali indipendenti.

import { MESI } from '@/lib/pfuConstants';

const parole = (k) => k.split(' ').filter(p => p.length > 2);

// Il nome del target e' lo stesso del portale oppure un'abbreviazione le cui
// parole stanno tutte nel nome del portale; mai il contrario.
export function stessoNome(chiaveTarget, chiavePortale) {
  if (!chiaveTarget || !chiavePortale) return false;
  if (chiaveTarget === chiavePortale) return true;
  const p = parole(chiaveTarget);
  const set = new Set(chiavePortale.split(' '));
  return p.length > 0 && p.every(x => set.has(x));
}

const vuotiMesi = () => MESI.map(() => ({ target: 0, raccolto: 0 }));

/**
 * mensili: TargetMensile; annui: TargetRaccoglitore; raccolto: by_raccoglitore_impianto
 * del canale RETE; chiave: funzione di normalizzazione dei nomi.
 * Righe per raccoglitore e regione; i target di piu' impianti si sommano.
 */
export function calcolaReportGenerale({ mensili = [], annui = [], raccolto = [], chiave }) {
  const righe = new Map();
  const riga = (regione, raccoglitore) => {
    const k = `${regione || ''}|${chiave(raccoglitore)}`;
    if (!righe.has(k)) {
      righe.set(k, {
        regione: regione || '', raccoglitore: raccoglitore || '', kRaccoglitore: chiave(raccoglitore),
        annuo: 0, conTarget: false, mesi: vuotiMesi(), impianti: new Map(),
      });
    }
    return righe.get(k);
  };

  for (const a of annui) {
    const r = riga(a.regione, a.raccoglitore);
    r.annuo += Number(a.target_tonnellate) || 0;
    r.conTarget = true;
  }
  for (const t of mensili) {
    const i = MESI.indexOf(t.mese);
    if (i < 0) continue;
    const r = riga(t.regione, t.raccoglitore);
    r.conTarget = true;
    if (!t.non_raccoglie) r.mesi[i].target += Number(t.target) || 0;
  }

  const conTarget = [...righe.values()];
  for (const x of raccolto) {
    const kRac = chiave(x.raccoglitore);
    // Prima il target con lo stesso nome; l'abbreviazione solo se non c'e': cosi'
    // "Logistica Srl" non prende il raccolto di "Logistica & Pneumatici".
    const dest = conTarget.find(r => r.regione === x.regione && r.kRaccoglitore === kRac)
      || conTarget.find(r => r.regione === x.regione && stessoNome(r.kRaccoglitore, kRac))
      || riga(x.regione, x.raccoglitore);
    const kImp = chiave(x.impianto) || 'nd';
    if (!dest.impianti.has(kImp)) dest.impianti.set(kImp, { impianto: x.impianto || 'N/D', mesi: MESI.map(() => 0) });
    const imp = dest.impianti.get(kImp);
    MESI.forEach((m, i) => {
      const v = Number(x.mesi && x.mesi[m]) || 0;
      dest.mesi[i].raccolto += v;
      imp.mesi[i] += v;
    });
  }

  // Fuori le righe senza nessun target e senza raccolto: non dicono nulla.
  return [...righe.values()].filter(r => r.annuo > 0 || r.mesi.some(m => m.target > 0 || m.raccolto > 0));
}

/** Valori di una riga (o di un gruppo sommato) per il mese scelto, indice 0-11. */
export function valoriMese(r, meseIdx) {
  const progressivoPrima = r.mesi.slice(0, meseIdx).reduce((s, m) => s + m.raccolto, 0);
  const mese = r.mesi[meseIdx] || { target: 0, raccolto: 0 };
  const progressivo = progressivoPrima + mese.raccolto;
  const mesiRimasti = 12 - meseIdx;
  return {
    annuo: r.annuo,
    mediaResidua: r.annuo > 0 ? (r.annuo - progressivoPrima) / mesiRimasti : null,
    target: mese.target,
    raccolto: mese.raccolto,
    delta: mese.target - mese.raccolto,
    progressivo,
    residuo: r.annuo - progressivo,
    percentualeAnnuo: r.annuo > 0 ? (progressivo / r.annuo) * 100 : null,
  };
}

/** Raccolto per impianto effettivo di una riga: mese scelto e progressivo. */
export function impiantiMese(r, meseIdx) {
  return [...r.impianti.values()]
    .map(i => ({ impianto: i.impianto, raccolto: i.mesi[meseIdx] || 0, progressivo: i.mesi.slice(0, meseIdx + 1).reduce((s, v) => s + v, 0) }))
    .filter(i => i.progressivo > 0)
    .sort((a, b) => b.raccolto - a.raccolto || b.progressivo - a.progressivo);
}

/** Somma piu' righe in una riga di gruppo. */
export function sommaRighe(elenco) {
  const tot = { annuo: 0, mesi: vuotiMesi() };
  for (const r of elenco) {
    tot.annuo += r.annuo;
    r.mesi.forEach((m, i) => { tot.mesi[i].target += m.target; tot.mesi[i].raccolto += m.raccolto; });
  }
  return tot;
}

/** Regione -> righe, in ordine alfabetico. */
export function raggruppa(righe) {
  const regioni = new Map();
  for (const r of righe) {
    if (!regioni.has(r.regione)) regioni.set(r.regione, []);
    regioni.get(r.regione).push(r);
  }
  return [...regioni.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'it'))
    .map(([regione, elenco]) => ({ regione, righe: elenco.sort((a, b) => a.raccoglitore.localeCompare(b.raccoglitore, 'it')) }));
}

/** Raccolto di tutte le righe per impianto effettivo: mese scelto e progressivo. */
export function totaliPerImpianto(righe, meseIdx) {
  const mappa = new Map();
  for (const r of righe) {
    for (const [k, i] of r.impianti) {
      if (!mappa.has(k)) mappa.set(k, { impianto: i.impianto, mesi: MESI.map(() => 0) });
      i.mesi.forEach((v, j) => { mappa.get(k).mesi[j] += v; });
    }
  }
  return impiantiMese({ impianti: mappa }, meseIdx);
}
