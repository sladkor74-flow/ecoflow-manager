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

import { MESI } from './pfuConstants.js';
import { ripartisciQuota } from './ripartizioneTarget.js';

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

/** Tonnellate arrotondate al chilo. */
const t3 = (v) => Math.round(v * 1000) / 1000;

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
        annuo: 0, conTarget: false, mesi: vuotiMesi(), impianti: new Map(), scritti: new Map(),
      });
    }
    return righe.get(k);
  };
  // L'impianto scritto a mano sulla riga del target: non dice quanto, ma dice
  // dove quel raccoglitore deve portare, ed e' l'unica cosa che lo dice prima che
  // il materiale si muova (serve a impiantoDiRiferimento).
  const segnaScritto = (r, nome, annuo, meseIdx = -1, target = 0) => {
    const k = chiave(nome);
    if (!k) return;
    const x = r.scritti.get(k) || { impianto: nome, annuo: 0, mesi: MESI.map(() => 0) };
    x.annuo += annuo;
    if (meseIdx >= 0) x.mesi[meseIdx] = t3(x.mesi[meseIdx] + target);
    r.scritti.set(k, x);
  };

  for (const a of annui) {
    const r = riga(a.regione, a.raccoglitore);
    r.annuo += Number(a.target_tonnellate) || 0;
    r.conTarget = true;
    segnaScritto(r, a.impianto, Number(a.target_tonnellate) || 0);
  }
  for (const t of mensili) {
    const i = MESI.indexOf(t.mese);
    if (i < 0) continue;
    const r = riga(t.regione, t.raccoglitore);
    r.conTarget = true;
    const quanto = t.non_raccoglie ? 0 : Number(t.target) || 0;
    r.mesi[i].target += quanto;
    // Il target mensile scritto verso un impianto resta legato a quell'impianto:
    // la griglia dei target salva una riga per raccoglitore, regione E impianto,
    // ed e' la ripartizione decisa a mano, quella che vince su ogni consuntivo.
    segnaScritto(r, t.impianto, 0, i, quanto);
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

/** L'etichetta della quota che non si sa dove mettere. */
export const DA_ASSEGNARE = 'da assegnare';

/**
 * L'IMPIANTO DI RIFERIMENTO DI UN RACCOGLITORE: dove porta, oggi.
 *
 * Serve a dire di chi e' il target che il raccoglitore non ha ancora raccolto -
 * i mesi futuri, e la parte mancante di un mese chiuso. Si prende, in ordine:
 * 1) l'impianto scritto a mano sulla sua riga in Target & Status, che e' una
 *    decisione dell'utente e vince su tutto (se ne ha piu' d'uno, quello col
 *    target annuo piu' alto);
 * 2) altrimenti l'impianto dell'ULTIMO mese in cui ha conferito, non il piu'
 *    grande dell'anno: un impianto fermo per un guasto o un incendio sposta i
 *    conferimenti per qualche mese, e quando riapre e' li' che tornano. L'utente,
 *    il 05/10/2026: «Emmesse per due mesi ha conferito su Irigom a causa
 *    dell'incendio in Gatim, ma da qui a fine anno conferira' sempre su Gatim».
 */
export function riferimentoDellaRiga(r) {
  // Fra piu' impianti scritti a mano vale quello a cui l'utente ha dato di piu',
  // annuo o sui mesi. Prima si guardava il solo target annuo, che per le righe
  // mensili e' zero: con gli impianti scritti solo sui mesi - il caso di chi
  // cambia destinazione in corso d'anno - a decidere finiva l'ordine alfabetico.
  const peso = (s) => s.annuo + s.mesi.reduce((a, b) => a + b, 0);
  const scritti = [...(r.scritti ? r.scritti.entries() : [])]
    .sort((a, b) => peso(b[1]) - peso(a[1]) || a[1].impianto.localeCompare(b[1].impianto, 'it'));
  if (scritti.length) return { k: scritti[0][0], impianto: scritti[0][1].impianto };
  for (let i = MESI.length - 1; i >= 0; i--) {
    let scelto = null;
    for (const [k, v] of r.impianti) {
      // 'N/D' e' la riga del portale senza destinazione: non e' un impianto, e
      // scriverci sopra il target non raccolto direbbe una cosa falsa.
      if (!k || k === 'nd' || v.impianto === 'N/D') continue;
      const kg = v.mesi[i] || 0;
      if (kg > 0 && (!scelto || kg > scelto.kg)) scelto = { k, impianto: v.impianto, kg };
    }
    if (scelto) return { k: scelto.k, impianto: scelto.impianto };
  }
  return { k: '', impianto: '' };
}

/** Solo il nome dell'impianto di riferimento. */
export const impiantoDiRiferimento = (r) => riferimentoDellaRiga(r).impianto;

/**
 * IL TARGET DI UN MESE RIPARTITO FRA GLI IMPIANTI (05/10/2026).
 *
 * Il target e' del raccoglitore in una regione: un impianto non ha un target per
 * raccoglitore, e inventarglielo dividendo a meta' farebbe comparire ammanchi che
 * nessuno ha mai promesso. La regola, chiesta dall'utente:
 *
 * - DOVE IL MATERIALE E' ARRIVATO IL TARGET E' QUELLO CHE E' ARRIVATO, e il delta
 *   torna a zero. «Emmesse per due mesi ha conferito su Irigom a causa
 *   dell'incendio in Gatim [...] li' non c'e' un vero target, metti esattamente
 *   quello che ha raccolto in quei due mesi e fai tornare a zero il delta».
 * - QUELLO CHE MANCA RESTA UN AMMANCO, e va dove quel raccoglitore avrebbe
 *   dovuto portarlo: l'impianto di riferimento. Se il mese e' andato come doveva,
 *   di ammanco non ce n'e' e all'impianto di riferimento non si scrive niente.
 * - SE HA RACCOLTO PIU' DEL TARGET il target si divide fra gli impianti che hanno
 *   ricevuto, in proporzione ai chili: cosi' nessuno dei due mostra un ammanco e
 *   il di piu' si vede dove e' davvero andato.
 * - UN MESE ANCORA DA FARE e' tutto dell'impianto di riferimento: e' una
 *   previsione, non un impegno, e chi legge lo deve sapere (campo stimato).
 *
 * La somma dei target degli impianti fa sempre il target del mese del
 * raccoglitore, al chilo: la colonna torna.
 *
 * @returns [{ impianto, target, raccolto, delta, stimato }]
 */
export function impiantiDelMese(r, meseIdx, riferimento = null) {
  const rif = riferimento === null ? riferimentoDellaRiga(r) : riferimento;
  const target = r.mesi[meseIdx]?.target || 0;
  const voci = new Map();
  // UN IMPIANTO SOLO, ANCHE SE SI CHIAMA IN DUE MODI (05/10/2026).
  //
  // Le voci si tengono per chiave normalizzata, non per come sono scritte: in
  // Target & Status l'utente scrive «GATIM S.R.L.» e il portale dice «Gatim»,
  // e tenendole per nome l'ammanco finiva su una seconda riga dello stesso
  // impianto - due righe Gatim sotto lo stesso raccoglitore, una col raccolto e
  // una col target. Il nome che si vede e' quello della prima voce, cioe' quello
  // del portale quando il materiale e' arrivato davvero.
  const voce = (k, nome) => {
    const chiave = k || DA_ASSEGNARE;
    if (!voci.has(chiave)) voci.set(chiave, { k: chiave, impianto: nome || DA_ASSEGNARE, target: 0, raccolto: 0, stimato: false });
    return voci.get(chiave);
  };
  for (const [k, v] of r.impianti) {
    const kg = v.mesi[meseIdx] || 0;
    if (kg > 0) voce(k, v.impianto).raccolto = t3(kg);
  }
  // La regola di che cosa va dove sta in un posto solo, condivisa con le Giacenze
  // (src/lib/ripartizioneTarget.js, specchio di base44/shared): qui si
  // preparano i suoi tre ingredienti - quello che l'utente ha scritto per questo
  // mese, quello che e' arrivato, e dove va quello che non e' arrivato.
  const scritto = new Map();
  for (const [k, s] of (r.scritti || new Map())) {
    const q = s.mesi[meseIdx] || 0;
    if (q > 0) { voce(k, s.impianto); scritto.set(k, q); }
  }
  const arrivato = new Map([...voci.values()].map(v => [v.k, v.raccolto]));
  for (const [k, q] of ripartisciQuota({ target, scritto, arrivato, riferimento: rif.k })) {
    const v = k === rif.k ? voce(rif.k, rif.impianto) : voce(k, k);
    v.target = q.target;
    v.stimato = q.stimato;
  }
  return [...voci.values()]
    .map(v => ({ ...v, delta: t3(v.target - v.raccolto) }))
    .sort((a, b) => b.raccolto - a.raccolto || b.target - a.target || a.impianto.localeCompare(b.impianto, 'it'));
}

/**
 * Gli impianti di una riga con i dodici mesi, nella stessa forma di una riga
 * (mesi[] di { target, raccolto }): cosi' la tabella dell'anno li disegna con lo
 * stesso codice. stimato dice che almeno un mese e' una previsione.
 */
export function impiantiDellAnno(r) {
  const rif = riferimentoDellaRiga(r);
  const mappa = new Map();
  MESI.forEach((m, i) => {
    for (const v of impiantiDelMese(r, i, rif)) {
      if (!mappa.has(v.k)) mappa.set(v.k, { k: v.k, impianto: v.impianto, mesi: vuotiMesi(), stimato: false, annuo: 0 });
      const x = mappa.get(v.k);
      x.mesi[i].target = t3(x.mesi[i].target + v.target);
      x.mesi[i].raccolto = t3(x.mesi[i].raccolto + v.raccolto);
      // annuo resta zero: un impianto non ha un target annuo suo, ha solo quello
      // che gli arriva dalla ripartizione dei mesi
      // fra due modi di scrivere lo stesso impianto si mostra quello del portale,
      // cioe' quello dei mesi in cui il materiale e' arrivato davvero
      if (v.raccolto > 0) x.impianto = v.impianto;
      if (v.stimato) x.stimato = true;
    }
  });
  const somma = (x, campo) => x.mesi.reduce((s, m) => s + m[campo], 0);
  return [...mappa.values()].sort((a, b) => (somma(b, 'raccolto') - somma(a, 'raccolto'))
    || (somma(b, 'target') - somma(a, 'target'))
    || a.impianto.localeCompare(b.impianto, 'it'));
}

/**
 * I totali dell'anno di una riga: target dei dodici mesi, raccolto, delta e
 * percentuale. La percentuale si misura sul target annuo quando c'e' (i mesi
 * possono non sommare l'annuo: la colonna "Da ripartire" della griglia dei target
 * dice proprio quanto manca), altrimenti sulla somma dei mesi.
 */
export function valoriAnno(r) {
  const target = t3(r.mesi.reduce((s, m) => s + m.target, 0));
  const raccolto = t3(r.mesi.reduce((s, m) => s + m.raccolto, 0));
  const base = r.annuo > 0 ? r.annuo : target;
  return {
    annuo: r.annuo || 0, target, raccolto, delta: t3(target - raccolto),
    residuo: base > 0 ? t3(base - raccolto) : null,
    percentualeAnnuo: base > 0 ? (raccolto / base) * 100 : null,
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
