// Vista "Report Generale": la stessa lettura del foglio del file di gestione,
// calcolata dai target di Target & Status e dalle primarie terminate.
//
// Righe per impianto di destinazione -> regione -> raccoglitore. Per ogni mese:
// target assegnato, raccolto, delta (target meno raccolto), raccolto progressivo
// e residuo del target annuo; la media mensile residua divide cio' che manca
// all'inizio del mese per i mesi rimasti, mese compreso.
//
// Solo canale RETE: ACI ed Extra Raccolta sono canali indipendenti e non hanno
// nulla a che fare con questi target.

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
 */
export function calcolaReportGenerale({ mensili = [], annui = [], raccolto = [], chiave }) {
  const righe = new Map();
  const riga = (impianto, regione, raccoglitore) => {
    const k = `${chiave(impianto)}|${regione || ''}|${chiave(raccoglitore)}`;
    if (!righe.has(k)) {
      righe.set(k, {
        impianto: impianto || '', regione: regione || '', raccoglitore: raccoglitore || '',
        kImpianto: chiave(impianto), kRaccoglitore: chiave(raccoglitore),
        annuo: 0, conTarget: false, mesi: vuotiMesi(), nomiPortale: new Set(),
      });
    }
    return righe.get(k);
  };

  for (const a of annui) {
    const r = riga(a.impianto, a.regione, a.raccoglitore);
    r.annuo += Number(a.target_tonnellate) || 0;
    r.conTarget = true;
  }
  for (const t of mensili) {
    const i = MESI.indexOf(t.mese);
    if (i < 0) continue;
    const r = riga(t.impianto, t.regione, t.raccoglitore);
    r.conTarget = true;
    if (!t.non_raccoglie) r.mesi[i].target += Number(t.target) || 0;
  }

  // Il raccolto va alla riga con stesso impianto, regione e raccoglitore; poi a una
  // riga dello stesso raccoglitore e regione senza impianto; altrimenti a una riga
  // nuova, senza target.
  const conTarget = [...righe.values()];
  for (const x of raccolto) {
    const kImp = chiave(x.impianto);
    const kRac = chiave(x.raccoglitore);
    let dest = conTarget.find(r => r.kImpianto && r.kImpianto === kImp && r.regione === x.regione && stessoNome(r.kRaccoglitore, kRac));
    if (!dest) dest = conTarget.find(r => !r.kImpianto && r.regione === x.regione && stessoNome(r.kRaccoglitore, kRac));
    if (!dest) dest = riga(x.impianto, x.regione, x.raccoglitore);
    dest.nomiPortale.add(x.raccoglitore);
    MESI.forEach((m, i) => { dest.mesi[i].raccolto += Number(x.mesi && x.mesi[m]) || 0; });
  }

  return [...righe.values()].filter(r => r.conTarget || r.mesi.some(m => m.raccolto > 0));
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

/** Somma piu' righe in una riga di gruppo. */
export function sommaRighe(elenco) {
  const tot = { annuo: 0, mesi: vuotiMesi() };
  for (const r of elenco) {
    tot.annuo += r.annuo;
    r.mesi.forEach((m, i) => { tot.mesi[i].target += m.target; tot.mesi[i].raccolto += m.raccolto; });
  }
  return tot;
}

/** Impianto -> regione -> righe, in ordine alfabetico; le righe senza impianto in fondo. */
export function raggruppa(righe) {
  const impianti = new Map();
  for (const r of righe) {
    const kI = r.kImpianto || '~';
    if (!impianti.has(kI)) impianti.set(kI, { impianto: r.impianto || 'Senza impianto di destinazione', regioni: new Map() });
    const imp = impianti.get(kI);
    if (!imp.regioni.has(r.regione)) imp.regioni.set(r.regione, []);
    imp.regioni.get(r.regione).push(r);
  }
  return [...impianti.entries()]
    .sort((a, b) => (a[0] === '~') - (b[0] === '~') || a[1].impianto.localeCompare(b[1].impianto, 'it'))
    .map(([, imp]) => ({
      impianto: imp.impianto,
      regioni: [...imp.regioni.entries()]
        .sort((a, b) => a[0].localeCompare(b[0], 'it'))
        .map(([regione, elenco]) => ({ regione, righe: elenco.sort((a, b) => a.raccoglitore.localeCompare(b.raccoglitore, 'it')) })),
    }));
}
