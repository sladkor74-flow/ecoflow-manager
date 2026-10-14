// IL CONTRATTO ECOTYRE DELLA RETE DI UN ANNO, CON I NUMERI DELLA DASHBOARD
// (variazione del contratto del 14/10/2026).
//
// L'utente, il 14/10/2026, dopo la variazione di ottobre (Puglia +100 t): «fai in
// modo che quando si faccia una tale variazione i moduli collegati come la
// dashboard si aggiornino di conseguenza». Dashboard e Andamento si muovevano;
// EcoTyna no. Alla domanda «Qual è oggi il target annuo 2026 del contratto
// Ecotyre sulla rete, e com'è messa la Puglia rispetto all'atteso?» il
// pianificatore sceglieva target_raccoglitori, che il contratto non lo legge: la
// risposta diceva 11.650 t prendendo la SOMMA DEI TARGET DEI RACCOGLITORI (che
// quel giorno coincideva per caso: il giorno prima sarebbe stata 11.650 contro
// un contratto di 11.550) e sulla Puglia «non è possibile estrapolare il
// target». Qui c'e' il contratto della rete come lo conta la dashboard
// (getDashboardRaccolta), per un anno: lo usano gli strumenti di EcoTyna
// contratto_ecotyre e target_raccoglitori (strumentiAssistente.ts), e
// prove/ecotynaContratto.mjs lo confronta campo per campo con getDashboardRaccolta
// sulla copia dei dati veri.
//
// Le regole sono quelle della dashboard, nello stesso ordine e con le stesse
// somme (anche l'ordine delle somme: i numeri devono essere identici, non
// vicini):
// - il contratto e' il modificato per ultimo dell'anno (commessaDellAnno);
//   target annuo e riparto per regione da targetAnnuoDellAnno e regioniDellAnno,
//   col ripiego del 2025-2026 detto come tale;
// - il raccolto sono i terminati della RETE nel giorno italiano della fine
//   trasporto (periodoMovimento), mai la chiusura a portale; l'archivio delle
//   primarie di rete ha solo le righe di SMOCO partner operativo (il file del
//   portale e' il suo);
// - la regione di un ritiro e' quella della dashboard: il campo regione, poi la
//   provincia, poi «Altro» (regioneDellaDashboard);
// - il giorno dei dati e' l'ultima fine trasporto di un terminato, mai oltre
//   oggi (giornoDeiDati); l'atteso del totale e' attesoAllaData, quello di una
//   regione attesoDellaRegione, con le variazioni del consorzio intere nel loro
//   mese e nella loro regione;
// - residuo, proiezione, ritmo, mesi, regioni con lo scarto e il raccolto fuori
//   dalle regioni del contratto sono quelli del quadro della dashboard
//   (quadroRete di quadroCommessa.ts), con lo stesso giorno dei dati.
// Nessuna lettura: chi chiama passa i contratti e le primarie di rete terminate
// che ha gia' letto. Solo server, nessuno specchio.
import { periodoMovimento, giornoMovimento } from "./movimenti.ts";
import { PROV_TO_REGION } from "./raccoltoCalculator.ts";
import { commessaDellAnno } from "./annoTarget.ts";
import { targetAnnuoDellAnno, regioniDellAnno, attesoAllaData, attesoDellaRegione, giornoDeiDati } from "./attesoContratto.ts";
import { formatoTonnellate } from "./formato.ts";
import { quadroRete, giornoDellaMisura } from "./quadroCommessa.ts";

/** La regione di un ritiro come la conta la dashboard (getDashboardRaccolta): il campo regione, poi la provincia, poi «Altro». */
export const regioneDellaDashboard = (r) => r.regione || PROV_TO_REGION[(r.provincia || '').toUpperCase().trim()] || 'Altro';

/**
 * Il contratto della rete di un anno, con i numeri della dashboard.
 * commesse: tutti i contratti letti (null se la lettura non e' riuscita: allora
 * vale il ripiego, e lo dice un avviso, come la dashboard); rete: le primarie di
 * rete terminate, di tutti gli anni (il giorno dei dati si legge su tutte);
 * oggi: il giorno italiano 'AAAA-MM-GG'.
 * Restituisce { anno, commessa, giorno_dati, giorno_misura, anno_chiuso, target,
 * fonte_regioni, kpi, target_vs_raccolto, con_riparto, raccolto_per_regione,
 * avvisi_target, rete }: kpi, target_vs_raccolto e avvisi_target sono quelli di
 * getDashboardRaccolta con un anno solo, rete e' il suo quadro.rete,
 * giorno_misura e anno_chiuso quelli del suo quadro.
 */
export function contrattoDellaRete({ commesse, anno, rete, oggi }) {
  const a = Number(anno);
  const tutte = rete || [];
  const commessa = commessaDellAnno(commesse || [], a);

  // Il raccolto dell'anno, per fine trasporto sul giorno italiano.
  const getAnno = (r) => { const p = periodoMovimento(r); return p ? p.anno : 0; };
  const reteAnno = tutte.filter(r => getAnno(r) === a);
  const raccolto_rete_anno = reteAnno.reduce((s, r) => s + (r.peso_effettivo || 0), 0) / 1000;

  // Il target del contratto, con gli avvisi della dashboard.
  const target = { anno: a, ...targetAnnuoDellAnno(commessa, a) };
  const t = target.t === null ? null : 0 + target.t;
  const raggiungimento_pct = t ? (raccolto_rete_anno / t) * 100 : null;
  const avvisi_target = [];
  if (commesse === null) avvisi_target.push(`Il contratto Ecotyre non si è potuto leggere: il target è quello di ripiego, dove c'è.`);
  if (target.t === null) avvisi_target.push(`Il contratto Ecotyre del ${a} non è inserito in Target & Status: il target RETE e l'atteso non si calcolano.`);
  else if (target.fonte === 'ripiego') avvisi_target.push(`Il contratto Ecotyre del ${a} non ha il target annuo in Target & Status: si usano le ${formatoTonnellate(target.t)} t scritte nel gestionale come ripiego.`);
  if (target.da_confermare) avvisi_target.push(`Il contratto Ecotyre del ${a} è copiato dall'anno prima e va confermato in Target & Status.`);

  // L'atteso alla data: fino all'ultima fine trasporto della rete, mai oltre oggi.
  const giornoDati = giornoDeiDati(tutte.reduce((m, r) => { const g = giornoMovimento(r); return g > m ? g : m; }, ''), oggi);
  const attesoT = attesoAllaData(commessa, a, giornoDati).atteso_t;
  const attesoAnno = t === null || attesoT === null ? null : 0 + attesoT;
  const atteso = attesoAnno === null ? null : {
    giorno: giornoDati,
    atteso_t: attesoAnno,
    pct: t ? (attesoAnno / t) * 100 : null,
    // positivo: avanti sull'atteso; negativo: indietro
    scarto_t: raccolto_rete_anno - attesoAnno,
  };

  // Le regioni: il contratto di ognuna, il suo atteso e il raccolto, come il
  // grafico e la tabella della dashboard.
  const raccoltoRegRete = {};
  for (const r of reteAnno) {
    const reg = regioneDellaDashboard(r);
    raccoltoRegRete[reg] = (raccoltoRegRete[reg] || 0) + (r.peso_effettivo || 0) / 1000;
  }
  const regioni = regioniDellAnno(commessa, a);
  const conRiparto = regioni.righe.length > 0;
  if (!conRiparto && target.t !== null) avvisi_target.push(`Il contratto Ecotyre del ${a} non ha il riparto per regione: il grafico mostra il solo raccolto.`);
  const perRegione = new Map();
  if (conRiparto) {
    for (const r of regioni.righe) {
      const v = perRegione.get(r.regione) || { target: 0, atteso: 0 };
      const at = attesoDellaRegione(commessa, a, giornoDati, r.regione).atteso_t;
      v.target += r.target_t;
      v.atteso = v.atteso === null || at === null ? null : v.atteso + at;
      perRegione.set(r.regione, v);
    }
  }
  const target_vs_raccolto = conRiparto
    ? [...perRegione].map(([reg, v]) => ({ regione: reg, target: v.target, atteso: v.atteso, raccolto: raccoltoRegRete[reg] || 0 }))
    : Object.entries(raccoltoRegRete).sort((x, y) => y[1] - x[1]).map(([reg, x]) => ({ regione: reg, target: null, atteso: null, raccolto: x }));

  const kpi = {
    raccolto_rete_anno, target: t, raggiungimento_pct, atteso,
    target_ripiego: target.fonte === 'ripiego' ? [a] : [],
    target_da_confermare: target.da_confermare ? [a] : [],
  };
  // Il quadro della rete della dashboard: residuo, proiezione, ritmo, mesi,
  // regioni con lo scarto, fuori dalle regioni del contratto, variazioni. Senza
  // i target dei raccoglitori: la classifica dei raccoglitori qui non serve.
  const quadro = quadroRete({
    anno: a, oggi, giornoDati, commessa, kpi, fonteTarget: target.fonte,
    rete: tutte, reteAnno, targetVsRaccolto: target_vs_raccolto, conRiparto, raccoltoPerRegione: raccoltoRegRete,
    mensili: [], annui: [], senzaFine: tutte.filter(r => !periodoMovimento(r)).length,
  });
  // IL GIORNO DELL'ATTESO DI UN ANNO CHIUSO (revisione del 14/10/2026). Il
  // giorno dei dati e' l'ultima fine trasporto della rete: chiesto il 2025
  // l'11/10/2026, e' il 08/10/2026, mentre l'atteso e i numeri del 2025 sono al
  // 31/12/2025. La dashboard per le etichette usa il giorno della misura
  // (giornoDellaMisura), e cosi' EcoTyna. Il riparto per regione dice da dove
  // viene: contro il ripiego i target dei raccoglitori non si confrontano, come
  // nella scheda e nel cruscotto (vociContrattoRaccoglitori).
  return {
    anno: a, commessa, giorno_dati: giornoDati, giorno_misura: giornoDellaMisura(a, giornoDati),
    anno_chiuso: a < Number(String(oggi).slice(0, 4)), target, fonte_regioni: regioni.fonte,
    kpi, target_vs_raccolto, con_riparto: conRiparto, raccolto_per_regione: raccoltoRegRete, avvisi_target, rete: quadro,
  };
}
