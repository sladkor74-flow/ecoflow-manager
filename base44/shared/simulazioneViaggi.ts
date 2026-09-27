// La simulazione dei viaggi della predittivita' delle secondarie (utente,
// 27/09/2026): "permettere a me una simulazione se io variassi quanto dice la
// predittivita', al fine di prendere decisioni piu' mirate ... cercando sempre
// di accontentare quanto possibile le esigenze di entrambi gli impianti".
//
// Chi programma sceglie quanti viaggi a settimana fare su ogni percorso
// (stoccaggio -> impianto) da qui alla fine della programmazione, e vede subito
// cosa succede: quanto arriva a ogni impianto, se e quando raggiunge il target,
// quanto manca o avanza, e se lo stoccaggio ha il materiale per farli. Accanto
// c'e' la proposta del gestionale, calcolata allo stesso modo.
//
// Lavora sulla risposta della predittivita' (predittivitaRisposta.ts), non
// rilegge niente: la pagina la ricalcola a ogni numero cambiato. Le regole:
// - un viaggio vale kg_per_viaggio (13 t nel 2026);
// - i viaggi a settimana valgono per le settimane che restano all'impianto fino
//   alla fine della sua programmazione (orizzonte.settimane); si possono dare
//   anche mezzi viaggi, cioe' una media (2,5 = tre e due a settimane alterne);
// - lo stoccaggio da' al massimo il materiale che avra' (disponibile sul
//   target, giacenza + entrate nei limiti del plafond): se i viaggi chiesti sono
//   di piu', quelli possibili si dividono in proporzione a quelli chiesti, e si
//   dice quanti ne mancano;
// - la primaria che arrivera' ancora e' quella della predittivita', nei due
//   modi: sul target dei raccoglitori e sul ritmo reale.
//
// Specchio in src/lib/simulazioneViaggi.js per la pagina (prove/specchi.mjs).

const SCENARI_SIM = ['target', 'ritmo'];
const aUtcSim = (g) => Date.UTC(+g.slice(0, 4), +g.slice(5, 7) - 1, +g.slice(8, 10));
const piuGiorniSim = (g, n) => new Date(aUtcSim(g) + n * 86400000).toISOString().slice(0, 10);

/** La chiave di un percorso nella simulazione: nome dello stoccaggio e chiave dell'impianto. */
export const chiavePercorso = (stoccaggio, impianto) => `${stoccaggio}|${impianto}`;

/**
 * I percorsi che si possono simulare: quelli del programma della settimana
 * prossima, con la media della predittivita' e i viaggi programmati.
 *
 * @returns {Array<{ chiave, stoccaggio, impianto, nome_impianto, media, programmati }>}
 */
export function percorsiDaSimulare(risposta) {
  const impianti = new Map(((risposta && risposta.impianti) || []).map(i => [i.chiave, i]));
  const stoccaggi = new Map(((risposta && risposta.stoccaggi) || []).map(s => [s.nome, s]));
  const out = [];
  for (const r of (risposta && risposta.programma) || []) {
    const imp = impianti.get(r.chiave_impianto);
    const s = stoccaggi.get(r.stoccaggio);
    if (!imp || !s) continue;
    const rotta = (imp.da_stoccaggi || []).find(x => x.stoccaggio === s.chiave);
    const media = rotta && rotta.viaggi_settimana ? Number(rotta.viaggi_settimana.target) || 0 : 0;
    const programmati = r.fissato ? Number(r.fissato.viaggi) || 0 : Number(r.viaggi) || 0;
    out.push({ chiave: chiavePercorso(r.stoccaggio, r.chiave_impianto), stoccaggio: r.stoccaggio, impianto: r.chiave_impianto, nome_impianto: imp.nome, media, programmati });
  }
  return out;
}

/**
 * Cosa succede con quei viaggi a settimana.
 *
 * @param {object} risposta  la risposta della predittivita'
 * @param {object} scelte    chiavePercorso -> viaggi a settimana (anche con i decimali)
 * @returns {{ impianti: Array, stoccaggi: Array }}
 */
export function simulaViaggi(risposta, scelte) {
  const kgv = Number(risposta && risposta.kg_per_viaggio) || 13000;
  const impianti = new Map(((risposta && risposta.impianti) || []).map(i => [i.chiave, i]));
  const percorsi = percorsiDaSimulare(risposta);
  const settimaneDi = (imp) => (imp && imp.orizzonte && Number(imp.orizzonte.giorni) > 0 ? Number(imp.orizzonte.settimane) || 0 : 0);
  const viaggiDi = (p) => Math.max(0, Number(scelte && scelte[p.chiave]) || 0);

  // --- gli stoccaggi: bastano i viaggi chiesti? ---
  const perStoccaggio = new Map();
  for (const p of percorsi) {
    if (!perStoccaggio.has(p.stoccaggio)) perStoccaggio.set(p.stoccaggio, []);
    perStoccaggio.get(p.stoccaggio).push(p);
  }
  const fattore = new Map();
  const stoccaggi = [];
  for (const s of (risposta && risposta.stoccaggi) || []) {
    const ps = perStoccaggio.get(s.nome);
    if (!ps) continue;
    const chiesti_kg = ps.reduce((t, p) => t + viaggiDi(p) * kgv * settimaneDi(impianti.get(p.impianto)), 0);
    const disponibile_kg = Math.max(0, Number(s.disponibile && s.disponibile.target) || 0);
    // mezzo viaggio di troppo e' un arrotondamento, non materiale che manca
    const f = chiesti_kg - disponibile_kg >= kgv / 2 && chiesti_kg > 0 ? disponibile_kg / chiesti_kg : 1;
    fattore.set(s.nome, f);
    stoccaggi.push({
      stoccaggio: s.nome,
      viaggi_chiesti: chiesti_kg / kgv,
      viaggi_possibili: disponibile_kg / kgv,
      chiesti_kg: Math.round(chiesti_kg), disponibile_kg: Math.round(disponibile_kg),
      basta: f === 1,
      mancano_kg: Math.round(Math.max(0, chiesti_kg - disponibile_kg)),
      avanza_kg: Math.round(Math.max(0, disponibile_kg - chiesti_kg)),
    });
  }

  // --- gli impianti: quanto arriva, se e quando raggiungono il target ---
  const out = [];
  for (const imp of impianti.values()) {
    const settimane = settimaneDi(imp);
    const miei = percorsi.filter(p => p.impianto === imp.chiave);
    const viaggiSettimana = miei.reduce((t, p) => t + viaggiDi(p) * (fattore.get(p.stoccaggio) ?? 1), 0);
    const secondarie_kg = viaggiSettimana * kgv * settimane;
    const residuo = Number(imp.residuo_kg) || 0;
    const scenari = {};
    for (const sc of SCENARI_SIM) {
      const primaria = Number(imp.primaria_attesa && imp.primaria_attesa[sc]) || 0;
      const arriva = primaria + secondarie_kg;
      const differenza = Math.round(arriva - residuo); // sotto zero: manca
      let quando = null;
      if (residuo <= 0) quando = 'gia';
      else if (settimane > 0 && arriva >= residuo - kgv / 2) {
        // settimana per settimana, al passo costante: il primo giorno in cui ci arriva
        const alGiorno = arriva / (settimane * 7);
        const giorni = Math.ceil(Math.max(0, residuo - kgv / 2) / alGiorno);
        const g = piuGiorniSim(imp.orizzonte.dal, Math.max(0, giorni - 1));
        quando = g > imp.fine ? imp.fine : g;
      }
      scenari[sc] = { primaria_kg: Math.round(primaria), arriva_kg: Math.round(arriva), finale_kg: Math.round((Number(imp.gia_arrivato_kg) || 0) + arriva), differenza_kg: differenza, raggiunge: differenza > -kgv / 2, quando };
    }
    out.push({
      chiave: imp.chiave, nome: imp.nome, target_kg: imp.target_kg, gia_arrivato_kg: imp.gia_arrivato_kg, residuo_kg: residuo, fine: imp.fine,
      settimane, viaggi_settimana: viaggiSettimana, viaggi_totali: viaggiSettimana * settimane, secondarie_kg: Math.round(secondarie_kg),
      limitato: miei.some(p => (fattore.get(p.stoccaggio) ?? 1) < 1 && viaggiDi(p) > 0),
      scenari,
    });
  }
  return { impianti: out, stoccaggi };
}

/** Le scelte di partenza: la media della predittivita' su ogni percorso, a un decimale. */
export const scelteDellaProposta = (risposta) => Object.fromEntries(percorsiDaSimulare(risposta).map(p => [p.chiave, Math.round(p.media * 10) / 10]));
/** Le scelte come il programma della settimana prossima, ripetuto fino alla fine. */
export const scelteDelProgramma = (risposta) => Object.fromEntries(percorsiDaSimulare(risposta).map(p => [p.chiave, p.programmati]));
/**
 * Almeno un viaggio a settimana a ogni impianto che lo stoccaggio puo' servire
 * (media sopra zero), senza superare i viaggi che lo stoccaggio puo' fare la
 * settimana prossima: il viaggio in piu' si toglie a chi ne ha di piu'.
 */
export function scelteAlmenoUno(risposta) {
  const percorsi = percorsiDaSimulare(risposta);
  const scelte = Object.fromEntries(percorsi.map(p => [p.chiave, p.programmati]));
  for (const s of (risposta && risposta.stoccaggi) || []) {
    const ps = percorsi.filter(p => p.stoccaggio === s.nome);
    const possibili = s.viaggi_prossima_settimana ? Number(s.viaggi_prossima_settimana.possibili) || 0 : Infinity;
    for (const p of ps) {
      if (scelte[p.chiave] >= 1 || !(p.media > 0)) continue;
      const totale = ps.reduce((t, x) => t + scelte[x.chiave], 0);
      if (totale + 1 > possibili) {
        const piuCarico = ps.filter(x => x.chiave !== p.chiave && scelte[x.chiave] > 1).sort((a, b) => scelte[b.chiave] - scelte[a.chiave])[0];
        if (!piuCarico) continue;
        scelte[piuCarico.chiave]--;
      }
      scelte[p.chiave] = 1;
    }
  }
  return scelte;
}
