// IL CONTRATTO ECOTYRE DELLA RETE, CON I NUMERI DELLA DASHBOARD
// (variazione del contratto del 14/10/2026; una regola sola dal 14/10/2026).
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
// target».
//
// UNA REGOLA SOLA (migliorie del 14/10/2026, «per me ok sulle cose da
// sistemare»). Il primo giro aveva qui una COPIA delle regole con cui
// getDashboardRaccolta conta il contratto della rete, tenuta allineata da
// prove/ecotynaContratto.mjs campo per campo: una regola nuova della dashboard
// andava portata anche qui a mano. Ora la regola e' qui e basta:
// - contrattoReteDegliAnni e' il contratto della rete degli anni scelti, e lo
//   chiama getDashboardRaccolta per il suo kpi, il grafico delle regioni e gli
//   avvisi del target;
// - contrattoDellaRete e' lo stesso conto per un anno, piu' il quadro della rete
//   (quadroRete di quadroCommessa.ts): lo usano gli strumenti di EcoTyna
//   contratto_ecotyre e target_raccoglitori (strumentiAssistente.ts).
// Dashboard ed EcoTyna dicono gli stessi numeri perche' fanno lo stesso conto,
// non perche' una prova confronta due copie. prove/ecotynaContratto.mjs continua
// a confrontarli sulla funzione vera, e prove/dashboardContrattoUnaRegola.mjs
// mostra che la dashboard risponde come prima, al carattere, sui dati veri.
//
// Le regole:
// - il contratto e' il modificato per ultimo dell'anno (commessaDellAnno);
//   target annuo e riparto per regione da targetAnnuoDellAnno e regioniDellAnno,
//   col ripiego del 2025-2026 detto come tale; un anno senza contratto non ha
//   target (null e un avviso, mai 0), e con piu' anni basta uno senza;
// - il raccolto sono i terminati della RETE nel giorno italiano della fine
//   trasporto (periodoMovimento), mai la chiusura a portale; l'archivio delle
//   primarie di rete ha solo le righe di SMOCO partner operativo (il file del
//   portale e' il suo);
// - la regione di un ritiro e' quella della dashboard: il campo regione, poi la
//   provincia, poi «Altro» (regioneDellaDashboard);
// - il giorno dei dati e' l'ultima fine trasporto di un terminato, mai oltre
//   oggi (giornoDeiDati); ogni anno si misura sul suo giorno della misura
//   (giornoDellaMisura: il 31/12 per un anno chiuso, nessuno per l'anno in corso
//   senza ritiri suoi; 15/10/2026); l'atteso del totale e' attesoAllaData,
//   quello di una regione attesoDellaRegione, con le variazioni del consorzio
//   intere nel loro mese e nella loro regione;
// - residuo, proiezione, ritmo, mesi, regioni con lo scarto e il raccolto fuori
//   dalle regioni del contratto sono quelli del quadro della dashboard
//   (quadroRete di quadroCommessa.ts), con lo stesso giorno dei dati.
// Le somme sono nell'ordine di sempre (anni nell'ordine scelto, regioni in
// quello del contratto): i numeri devono essere identici, non vicini.
// Nessuna lettura: chi chiama passa i contratti e le primarie di rete terminate
// che ha gia' letto. Solo server, nessuno specchio.
import { periodoMovimento, giornoMovimento } from "./movimenti.ts";
import { PROV_TO_REGION } from "./raccoltoCalculator.ts";
import { commessaDellAnno } from "./annoTarget.ts";
import { targetAnnuoDellAnno, regioniDellAnno, attesoAllaData, attesoDellaRegione, giornoDeiDati, giornoDellaMisura } from "./attesoContratto.ts";
import { formatoTonnellate } from "./formato.ts";
import { quadroRete } from "./quadroCommessa.ts";

/** La regione di un ritiro come la conta la dashboard (getDashboardRaccolta): il campo regione, poi la provincia, poi «Altro». */
export const regioneDellaDashboard = (r) => r.regione || PROV_TO_REGION[(r.provincia || '').toUpperCase().trim()] || 'Altro';

/**
 * Il contratto della rete degli anni scelti, come lo conta la dashboard: e' il
 * conto che getDashboardRaccolta fa con gli anni del filtro e
 * contrattoDellaRete con un anno.
 * commesse: tutti i contratti letti (null se la lettura non e' riuscita: allora
 * vale il ripiego, e lo dice un avviso); anni: gli anni scelti, nell'ordine della
 * richiesta; rete: le primarie di rete terminate, di tutti gli anni (il giorno
 * dei dati si legge su tutte); reteAnno: quelle degli anni scelti, quando chi
 * chiama le ha gia' (la dashboard, che le usa anche per i mesi e per il quadro),
 * altrimenti si scelgono qui con la stessa regola, la fine trasporto sul giorno
 * italiano; oggi: il giorno italiano 'AAAA-MM-GG'.
 * Restituisce { contratti, giorno_dati, rete_anno, kpi, target_vs_raccolto,
 * con_riparto, raccolto_per_regione, avvisi_target }: contratti ha un elemento
 * per anno, { anno, commessa, target, regioni } (target e' targetAnnuoDellAnno
 * con l'anno, regioni e' regioniDellAnno); kpi e' la parte della rete del kpi
 * della dashboard (raccolto_rete_anno, target, raggiungimento_pct, atteso,
 * target_ripiego, target_da_confermare); target_vs_raccolto e avvisi_target
 * sono i suoi.
 */
export function contrattoReteDegliAnni({ commesse, anni, rete, reteAnno = null, oggi }) {
  const elenco = (anni || []).map(Number);
  const tutte = rete || [];
  const lette = commesse || [];

  // Il raccolto degli anni scelti, per fine trasporto sul giorno italiano.
  const getAnno = (r) => { const p = periodoMovimento(r); return p ? p.anno : 0; };
  const righeAnno = reteAnno || tutte.filter(r => elenco.includes(getAnno(r)));
  const raccolto_rete_anno = righeAnno.reduce((s, r) => s + (r.peso_effettivo || 0), 0) / 1000;

  // IL TARGET DEL CONTRATTO, COME IN TARGET & STATUS (chiusura dell'audit,
  // 11/10/2026). Il contratto dell'anno e' il modificato per ultimo
  // (commessaDellAnno): la dashboard prendeva il creato per ultimo, fra i primi
  // 50. Target annuo e riparto per regione vengono da li' (attesoContratto.ts);
  // le costanti del 2025 e del 2026 solo come ripiego dichiarato. Un anno senza
  // contratto non ha target: niente «0%» e niente 11.550 t nel grafico, ma null e
  // un avviso, come Target & Status.
  const contratti = elenco.map(a => ({ anno: a, commessa: commessaDellAnno(lette, a) }));
  const targetAnni = contratti.map(({ anno: a, commessa }) => ({ anno: a, ...targetAnnuoDellAnno(commessa, a) }));
  const target = targetAnni.some(x => x.t === null) ? null : targetAnni.reduce((s, x) => s + x.t, 0);
  const raggiungimento_pct = target ? (raccolto_rete_anno / target) * 100 : null;
  const avvisi_target = [];
  if (commesse === null) avvisi_target.push(`Il contratto Ecotyre non si è potuto leggere: il target è quello di ripiego, dove c'è.`);
  for (const x of targetAnni) {
    if (x.t === null) avvisi_target.push(`Il contratto Ecotyre del ${x.anno} non è inserito in Target & Status: il target RETE e l'atteso non si calcolano.`);
    else if (x.fonte === 'ripiego') avvisi_target.push(`Il contratto Ecotyre del ${x.anno} non ha il target annuo in Target & Status: si usano le ${formatoTonnellate(x.t)} t scritte nel gestionale come ripiego.`);
    if (x.da_confermare) avvisi_target.push(`Il contratto Ecotyre del ${x.anno} è copiato dall'anno prima e va confermato in Target & Status.`);
  }

  // L'ATTESO ALLA DATA: «76,4%» da solo non dice se si e' in linea. Si conta sui
  // giorni coperti dai dati - l'ultima fine trasporto della rete, mai oltre
  // oggi - e col profilo mensile del contratto, come l'Andamento per regione di
  // Target & Status e il controllo dei target mensili (attesoContratto.ts).
  const giornoDati = giornoDeiDati(tutte.reduce((m, r) => { const g = giornoMovimento(r); return g > m ? g : m; }, ''), oggi);
  // Ogni anno si misura sul suo giorno della misura (giornoDellaMisura, prova
  // generale del cambio d'anno del 15/10/2026): un anno chiuso al 31/12 anche se
  // l'ultimo ritiro caricato e' del 22/12 e quelli dell'anno nuovo non ci sono
  // ancora; l'anno in corso senza ritiri suoi non ha atteso (null, non zero).
  // Il giorno dell'atteso (atteso.giorno) resta il giorno dei dati, com'era: le
  // etichette leggono il giorno della misura del quadro (quadroRete).
  const misure = contratti.map(({ anno: a }) => giornoDellaMisura(a, giornoDati, oggi));
  const attesi = contratti.map(({ anno: a, commessa }, i) => attesoAllaData(commessa, a, misure[i]));
  const attesoAnno = target === null || attesi.some(x => x.atteso_t === null) ? null : attesi.reduce((s, x) => s + x.atteso_t, 0);
  const atteso = attesoAnno === null ? null : {
    giorno: giornoDati,
    atteso_t: attesoAnno,
    pct: target ? (attesoAnno / target) * 100 : null,
    // positivo: avanti sull'atteso; negativo: indietro
    scarto_t: raccolto_rete_anno - attesoAnno,
  };

  // Target contro raccolto per regione (solo rete, tutti i mesi degli anni
  // scelti). Il contratto per regione dell'anno, sommato sugli anni scelti; il
  // riparto scritto nel codice vale solo per il 2026, l'anno da cui viene: prima
  // valeva per ogni anno, e il 2027 senza contratto mostrava 11.550 t nel grafico
  // e «su 0 t» nel numero sopra. Se un anno scelto non ha il riparto, il grafico
  // mostra il solo raccolto, con il target null. Accanto, l'atteso alla data di
  // ogni regione, con il profilo del contratto dell'anno.
  const raccoltoRegRete = {};
  for (const r of righeAnno) {
    const reg = regioneDellaDashboard(r);
    raccoltoRegRete[reg] = (raccoltoRegRete[reg] || 0) + (r.peso_effettivo || 0) / 1000;
  }
  const regioniAnni = contratti.map(({ anno: a, commessa }, i) => ({ anno: a, commessa, misura: misure[i], ...regioniDellAnno(commessa, a) }));
  const conRiparto = regioniAnni.every(x => x.righe.length > 0);
  for (const x of regioniAnni) {
    if (!x.righe.length && targetAnni.some(t => t.anno === x.anno && t.t !== null)) avvisi_target.push(`Il contratto Ecotyre del ${x.anno} non ha il riparto per regione: il grafico mostra il solo raccolto.`);
  }
  const perRegione = new Map();
  if (conRiparto) {
    for (const x of regioniAnni) {
      for (const r of x.righe) {
        const v = perRegione.get(r.regione) || { target: 0, atteso: 0 };
        // L'ATTESO DI UNA REGIONE E' SUO (variazioni del contratto, 14/10/2026):
        // attesoDellaRegione mette le variazioni in vigore della regione intere
        // nel loro mese, e quelle delle altre regioni non la toccano. Col target
        // della regione per la quota nazionale, le 100 t di ottobre in Puglia
        // spostavano un pezzo di atteso anche su Campania e Sicilia.
        const a = attesoDellaRegione(x.commessa, x.anno, x.misura, r.regione).atteso_t;
        v.target += r.target_t;
        v.atteso = v.atteso === null || a === null ? null : v.atteso + a;
        perRegione.set(r.regione, v);
      }
    }
  }
  const target_vs_raccolto = conRiparto
    ? [...perRegione].map(([reg, v]) => ({ regione: reg, target: v.target, atteso: v.atteso, raccolto: raccoltoRegRete[reg] || 0 }))
    : Object.entries(raccoltoRegRete).sort((x, y) => y[1] - x[1]).map(([reg, t]) => ({ regione: reg, target: null, atteso: null, raccolto: t }));

  return {
    contratti: contratti.map((c, i) => ({ ...c, target: targetAnni[i], regioni: { righe: regioniAnni[i].righe, fonte: regioniAnni[i].fonte } })),
    giorno_dati: giornoDati,
    rete_anno: righeAnno,
    // target_ripiego e target_da_confermare dicono gli anni il cui target non e'
    // quello confermato del contratto
    kpi: {
      raccolto_rete_anno, target, raggiungimento_pct, atteso,
      target_ripiego: targetAnni.filter(x => x.fonte === 'ripiego').map(x => x.anno),
      target_da_confermare: targetAnni.filter(x => x.da_confermare).map(x => x.anno),
    },
    target_vs_raccolto,
    con_riparto: conRiparto,
    raccolto_per_regione: raccoltoRegRete,
    avvisi_target,
  };
}

/**
 * Il contratto della rete di un anno, con i numeri della dashboard: il conto di
 * contrattoReteDegliAnni con quell'anno solo, piu' il quadro della rete.
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
  const c = contrattoReteDegliAnni({ commesse, anni: [a], rete: tutte, oggi });
  const { commessa, target, regioni } = c.contratti[0];
  // Il quadro della rete della dashboard: residuo, proiezione, ritmo, mesi,
  // regioni con lo scarto, fuori dalle regioni del contratto, variazioni. Senza
  // i target dei raccoglitori: la classifica dei raccoglitori qui non serve.
  const quadro = quadroRete({
    anno: a, oggi, giornoDati: c.giorno_dati, commessa, kpi: c.kpi, fonteTarget: target.fonte,
    rete: tutte, reteAnno: c.rete_anno, targetVsRaccolto: c.target_vs_raccolto, conRiparto: c.con_riparto, raccoltoPerRegione: c.raccolto_per_regione,
    mensili: [], annui: [], senzaFine: tutte.filter(r => !periodoMovimento(r)).length,
  });
  // IL GIORNO DELL'ATTESO DI UN ANNO CHIUSO (revisione del 14/10/2026). Il
  // giorno dei dati e' l'ultima fine trasporto della rete: chiesto il 2025
  // l'11/10/2026, e' il 08/10/2026, mentre l'atteso e i numeri del 2025 sono al
  // 31/12/2025. La dashboard per le etichette usa il giorno della misura
  // (giornoDellaMisura), e cosi' EcoTyna. Il riparto per regione dice da dove
  // viene: contro il ripiego i target dei raccoglitori non si confrontano, come
  // nella scheda e nel cruscotto (vociContrattoRaccoglitori).
  // Dalla prova generale del cambio d'anno (15/10/2026) il giorno della misura
  // guarda anche oggi: il 05/01/2027, con l'ultimo ritiro del 2026 al 22/12,
  // EcoTyna scriveva «i numeri sono al 31/12/2026» accanto a dati_fino_al
  // 2026-12-22.
  return {
    anno: a, commessa, giorno_dati: c.giorno_dati, giorno_misura: giornoDellaMisura(a, c.giorno_dati, oggi),
    anno_chiuso: a < Number(String(oggi).slice(0, 4)), target, fonte_regioni: regioni.fonte,
    kpi: c.kpi, target_vs_raccolto: c.target_vs_raccolto, con_riparto: c.con_riparto, raccolto_per_regione: c.raccolto_per_regione,
    avvisi_target: c.avvisi_target, rete: quadro,
  };
}
