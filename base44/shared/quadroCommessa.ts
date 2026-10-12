// IL QUADRO DELLA COMMESSA PER LA DASHBOARD (migliorie dell'11/10/2026).
//
// Chiesto dall'utente: «sistema meglio anche il modulo dashboard [...] e rendilo
// piu' professionale ed esaustivo sulla commessa». La pagina diventa il quadro
// della commessa Ecotyre dell'anno scelto, a sezioni per canale: rete col
// contratto, ACI, extra raccolta. Qui ci sono i numeri che le servono, calcolati
// sugli stessi elenchi che getDashboardRaccolta legge gia' (le primarie
// terminate di rete e ACI, l'extra raccolta) piu' i target dei raccoglitori, due
// pagine piccole. Niente regole nuove: il periodo e' la fine trasporto sul giorno
// italiano (periodoMovimento), l'atteso e' quello del contratto
// (attesoContratto.ts), le righe dei raccoglitori sono quelle dell'Andamento di
// Target & Status (righeAndamento), province e tempi quelli di Terminati Rete
// (primarieReteAnalytics.ts).
//
// I CANALI NON SI SOMMANO MAI: rete, ACI ed extra raccolta hanno ciascuno il suo
// blocco e nessun campo li mette insieme. NESSUN EURO: il quadro lo vede
// chiunque, e prezzi e costi sono dell'amministratore (il margine ha la sua
// funzione). UN VALORE CHE MANCA E' null, mai 0: la pagina scrive «—» col
// perche'.
//
// Solo server, nessuno specchio: la pagina riceve i numeri fatti.
import { periodoMovimento, chiaveOrdine, eTerminato, MESI_MOVIMENTI } from "./movimenti.ts";
import { PROV_TO_REGION } from "./raccoltoCalculator.ts";
import { profiloMensile, quotaAttesa, frazioneDelMese, giorniDelMese } from "./attesoContratto.ts";
import { righeAndamento } from "./andamentoTarget.ts";
import { daConfermare } from "./annoTarget.ts";
import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";
import { computeSlaMetrics } from "./primarieReteAnalytics.ts";
import { statoMesiAttiva } from "./cruscotto.ts";

const t3 = (v) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Math.round(Number(v) * 1000) / 1000);
const lista = (json) => {
  try { const v = typeof json === 'string' ? JSON.parse(json || '[]') : json; return Array.isArray(v) ? v : []; } catch { return []; }
};
const regioneDaProvincia = (r) => PROV_TO_REGION[String((r && r.provincia) || '').toUpperCase().trim()] || 'Altro';
const due = (n) => String(n).padStart(2, '0');

/** Gli ordini distinti di un elenco di righe: un ordine con piu' righe conta uno. */
export const ordiniDistinti = (righe) => new Set((righe || []).map((r, i) => chiaveOrdine(r, i))).size;

/**
 * Il raccolto RETE per raccoglitore e regione dell'anno, nella forma di
 * computeRaccoltoData(...).by_raccoglitore: raccoglitore = trasportatore pulito,
 * regione = quella della provincia (o 'Altro'), mesi per fine trasporto. E' lo
 * stesso conto di Target & Status, e prove/quadroCommessa.mjs lo confronta riga
 * per riga.
 */
export function raccoltoPerRaccoglitore(righe, anno) {
  const by = {};
  for (const p of righe || []) {
    if (!eTerminato(p)) continue;
    const per = periodoMovimento(p);
    if (!per || per.anno !== Number(anno)) continue;
    const raccoglitore = (p.trasportatore || 'N/D').trim();
    const regione = regioneDaProvincia(p);
    const k = `${raccoglitore}|||${regione}`;
    if (!by[k]) {
      by[k] = { raccoglitore, regione, totale: 0, mesi: {} };
      for (const m of MESI_MOVIMENTI) by[k].mesi[m] = 0;
    }
    const peso = (p.peso_effettivo || 0) / 1000;
    by[k].totale += peso;
    by[k].mesi[per.mese] += peso;
  }
  return Object.values(by);
}

/** Il raccolto di un canale mese per mese, per fine trasporto: dodici numeri in tonnellate. */
function perMese(righe, pesoDi = (r) => Number(r.peso_effettivo) || 0) {
  const kg = Array(12).fill(0);
  for (const r of righe || []) {
    const p = periodoMovimento(r);
    if (p) kg[p.mese_idx] += pesoDi(r);
  }
  return kg.map(v => v / 1000);
}

/**
 * I mesi di un canale: il raccolto di un mese che i dati non coprono ancora, e
 * in cui non c'e' niente, e' null (assente), non zero.
 */
function mesiDelCanale(raccoltoMesi, coperto) {
  return raccoltoMesi.map((t, i) => {
    const futuro = coperto[i] === 0 && t === 0;
    return { mese: MESI_MOVIMENTI[i], raccolto_t: futuro ? null : t3(t), coperto: t3(coperto[i]), futuro };
  });
}

/**
 * I RACCOGLITORI DELLA RETE: chi e' piu' indietro e chi piu' avanti sul suo
 * target ad oggi. Le righe sono quelle dell'Andamento di Target & Status
 * (righeAndamento: il raccolto va al target col nome del portale o con la sua
 * abbreviazione). Il target ad oggi e' la somma dei target mensili, il mese dei
 * dati in proporzione ai giorni coperti, la regola del controllo dei target
 * mensili (frazioneDelMese). Un target copiato dall'anno prima e non confermato
 * non e' ancora un target: resta fuori dalla classifica e si conta, come fa
 * checkTargetAlerts (chiave raccoglitore normalizzato | regione).
 */
export function raccoglitoriRete({ righe, anno, giornoDati, oggi, mensili = [], annui = [] }) {
  const raccolto = raccoltoPerRaccoglitore(righe, anno);
  const andamento = righeAndamento({ mensili, annui, raccolto });
  const chiave = (nome, regione) => `${normalizzaRagioneSociale(nome || '')}|${String(regione || '').trim()}`;
  const copiati = new Set((mensili || []).filter(daConfermare).map(t => chiave(t.raccoglitore, t.regione)));
  const fraz = MESI_MOVIMENTI.map((_, i) => frazioneDelMese(Number(anno), i, giornoDati, oggi));
  const tutte = andamento.map(r => {
    const targetMesi = r.mesi.reduce((s, m) => s + (Number(m.target) || 0), 0);
    const adOggi = r.mesi.reduce((s, m, i) => s + (Number(m.target) || 0) * fraz[i], 0);
    const scarto = r.raccoltoTotale - adOggi;
    return {
      raccoglitore: r.raccoglitore, regione: r.regione,
      target_mesi_t: targetMesi > 0 ? t3(targetMesi) : null,
      target_annuo_t: r.targetAnnuo > 0 ? t3(r.targetAnnuo) : null,
      target_ad_oggi_t: targetMesi > 0 ? t3(adOggi) : null,
      raccolto_t: t3(r.raccoltoTotale),
      scarto_t: adOggi > 0 ? t3(scarto) : null,
      pct: adOggi > 0 ? (r.raccoltoTotale / adOggi) * 100 : null,
      copiata: copiati.has(chiave(r.raccoglitore, r.regione)),
      _adOggi: adOggi, _scarto: scarto, _target: targetMesi + r.targetAnnuo, _raccolto: r.raccoltoTotale,
    };
  });
  const inClassifica = tutte.filter(r => r._adOggi > 0 && !r.copiata);
  const pulita = ({ _adOggi, _scarto, _target, _raccolto, copiata, ...r }) => { void _adOggi; void _scarto; void _target; void _raccolto; void copiata; return r; };
  const senza = tutte.filter(r => r._target <= 0 && r._raccolto > 0);
  return {
    // in tonnellate, il peso sulla commessa: chi e' indietro di 50 t pesa piu'
    // di chi e' al 40% su un target di 10 t
    indietro: inClassifica.filter(r => r._scarto < 0).sort((a, b) => a._scarto - b._scarto).slice(0, 5).map(pulita),
    avanti: inClassifica.filter(r => r._scarto > 0).sort((a, b) => b._scarto - a._scarto).slice(0, 5).map(pulita),
    con_target: inClassifica.length,
    da_confermare: tutte.filter(r => r.copiata && r._target > 0).length,
    senza_target: { quanti: senza.length, raccolto_t: t3(senza.reduce((s, r) => s + r._raccolto, 0)) },
  };
}

/**
 * LE PROVINCE FERME: quelle che lavorano e non hanno avuto ritiri negli ultimi
 * due mesi finiti, ne' dopo (revisione delle migliorie, 11/10/2026). Solo per
 * l'anno in corso.
 *
 * Prima si passava l'elenco di Terminati Rete (province_with_zeros), che risponde
 * a un'altra domanda: due mesi a zero di fila in qualunque momento dell'anno. Sulla
 * copia dei dati veri dell'11/10/2026 dava per ferme KR (febbraio-marzo), VV
 * (gennaio-febbraio) e TP (luglio-agosto), che a settembre avevano raccolto: un
 * avviso che grida al lupo, tre su tre. Qui la domanda del riquadro.
 *
 * Il conto e' quello di Terminati Rete: ritiri terminati, nel mese della fine
 * trasporto sul giorno italiano, con la provincia del formulario e la sua
 * regione. Le province che lavorano sono quelle con un ritiro nell'anno o in
 * quello prima, tutto l'anno (revisione delle migliorie, 12/10/2026): fino ad
 * allora l'anno prima contava solo a gennaio e febbraio, e dal 1° marzo una
 * provincia ferma da novembre spariva dal riquadro mentre era ancora ferma, e
 * da piu' tempo. Chi non ha ritiri da due anni non lavora piu' qui e non si
 * dice. Un ritiro di questo mese, anche se il mese non e' finito, vuol dire che
 * la provincia ha ripreso: non e' ferma. oggi e' il giorno italiano che passa
 * chi chiama: qui non si legge l'orologio.
 */
export function provinceFerme(righe, anno, oggi) {
  const a = Number(anno);
  if (a !== Number(String(oggi).slice(0, 4))) return { anno_in_corso: false, dal: null, province: [] };
  const mi = Number(String(oggi).slice(5, 7)) - 1;
  // il primo dei due mesi finiti, come numero di mese assoluto (anno * 12 + mese)
  const assoluto = a * 12 + mi - 2;
  const annoDal = Math.floor(assoluto / 12);
  const per = new Map();
  for (const r of righe || []) {
    const provincia = String((r && r.provincia) || '').toUpperCase().trim();
    if (!provincia || !eTerminato(r)) continue;
    const p = periodoMovimento(r);
    if (!p || p.anno < a - 1 || p.anno > a) continue;
    if (!per.has(provincia)) per.set(provincia, { provincia, regione: r.regione || PROV_TO_REGION[provincia] || 'Altro', ultimo: '' });
    const x = per.get(provincia);
    if (p.giorno > x.ultimo) x.ultimo = p.giorno;
  }
  const dal = `${annoDal}-${due((assoluto % 12) + 1)}-01`;
  return {
    anno_in_corso: true,
    // il primo giorno dei due mesi finiti: «senza ritiri da agosto»
    dal: { giorno: dal, mese: MESI_MOVIMENTI[assoluto % 12], anno: annoDal },
    province: [...per.values()]
      .filter(x => x.ultimo < dal)
      .sort((x, y) => x.ultimo.localeCompare(y.ultimo) || x.provincia.localeCompare(y.provincia)),
  };
}

/**
 * I tempi di raccolta dell'anno: dall'immissione alla fine del trasporto, sui
 * ritiri terminati (computeSlaMetrics, la regola di Terminati Rete). I tre piu'
 * lenti fra chi ha almeno 20 ritiri misurati: con meno, la media non dice niente.
 */
export function tempiRaccoltaAnno(righe, anno) {
  const s = computeSlaMetrics(righe || [], anno);
  const misurati = s.totale_ordini || 0;
  const nm = s.non_misurati || {};
  return {
    misurati,
    media_giorni: misurati ? s.avg_giorni : null,
    pct_nei_tempi: misurati ? s.pct_nei_tempi_globale : null,
    peggiori: (s.trasportatori || []).filter(t => t.totale >= 20).sort((a, b) => b.nr_giorni_medio - a.nr_giorni_medio).slice(0, 3)
      .map(t => ({ raccoglitore: t.trasportatore, media_giorni: t.nr_giorni_medio, pct_nei_tempi: t.pct_nei_tempi, misurati: t.totale })),
    non_misurati: (Number(nm.senza_fine_trasporto) || 0) + (Number(nm.senza_immissione) || 0) + (Number(nm.date_incoerenti) || 0),
    registrati_dopo: Number(nm.immissione_dopo_ritiro) || 0,
  };
}

/**
 * LA RETE: il contratto, l'atteso, la proiezione, i mesi, le regioni, i
 * raccoglitori. kpi e' quello di getDashboardRaccolta (target, raccolto,
 * percentuale e atteso si ricopiano, cosi' tessera, sezione e card dicono lo
 * stesso numero); targetVsRaccolto e raccoltoPerRegione sono i suoi elenchi per
 * regione, con la sua regola della regione.
 */
export function quadroRete({ anno, oggi, giornoDati, commessa, kpi, fonteTarget = null, reteAnno, rete, targetVsRaccolto = [], conRiparto = false, raccoltoPerRegione = {}, mensili, annui, senzaFine = null }) {
  const a = Number(anno);
  const annoDati = giornoDati ? Number(giornoDati.slice(0, 4)) : null;
  const target = kpi.target === null || kpi.target === undefined ? null : Number(kpi.target);
  const raccolto = Number(kpi.raccolto_rete_anno) || 0;
  // Il 2 gennaio, senza nessun ritiro dell'anno, il giorno dei dati e' nell'anno
  // prima: l'atteso non e' zero, non c'e' (la card scriveva «atteso al 31/12: 0,0%»).
  const quota = annoDati === a ? quotaAttesa(commessa, a, giornoDati) : annoDati !== null && annoDati > a ? 1 : null;
  // Per un anno chiuso l'atteso e' quello dell'anno intero, al 31/12: il giorno
  // dei dati e' dell'anno dopo (revisione delle migliorie, 11/10/2026). Le
  // etichette scrivevano «Atteso al 08/10» guardando il 2025, e si leggeva l'8
  // ottobre 2025 su un numero che e' il target intero.
  const atteso = kpi.atteso && annoDati !== null && annoDati >= a
    ? { giorno: annoDati > a ? `${a}-12-31` : kpi.atteso.giorno, fine_anno: annoDati > a, quota, atteso_t: kpi.atteso.atteso_t, scarto_t: kpi.atteso.scarto_t, pct_atteso: kpi.atteso.pct }
    : null;

  // LA PROIEZIONE A FINE ANNO: se il resto dell'anno va come finora rispetto al
  // profilo del contratto, raccolto diviso la quota del profilo coperta dai dati.
  // Si da' quando i dati coprono gennaio e febbraio interi: prima, pochi giorni
  // moltiplicati per l'anno non vogliono dire niente. Un anno finito ha la sua
  // proiezione: il raccolto.
  const fineFebbraio = `${a}-02-${due(giorniDelMese(a, 1))}`;
  let proiezione = null, proiezionePerche = '';
  if (target === null) proiezionePerche = `Il contratto Ecotyre del ${a} non ha un target: non c'è niente da proiettare.`;
  else if (annoDati === null || annoDati < a) proiezionePerche = `Nessun ritiro del ${a} ancora terminato.`;
  else if (annoDati > a) proiezione = { t: t3(raccolto), pct_target: target ? (raccolto / target) * 100 : null, finale: true };
  else if (giornoDati < fineFebbraio) proiezionePerche = 'Si dà da quando i dati coprono gennaio e febbraio interi: prima, pochi giorni moltiplicati per l\'anno non vogliono dire niente.';
  else if (quota && quota > 0) proiezione = { t: t3(raccolto / quota), pct_target: target ? (raccolto / quota / target) * 100 : null, finale: false };

  // IL RITMO CHE SERVE: quello che manca al target diviso i mesi che restano dopo
  // il giorno dei dati, contro quello che il profilo del contratto prevede per gli
  // stessi mesi. Solo per l'anno in corso e finche' il target non e' raggiunto.
  const residuo = target === null ? null : target - raccolto;
  let ritmo = null;
  if (target !== null && residuo > 0 && annoDati === a && a === Number(String(oggi).slice(0, 4)) && quota !== null && quota < 1) {
    const mi = Number(giornoDati.slice(5, 7)) - 1;
    const mesiRestanti = 12 - (mi + Number(giornoDati.slice(8, 10)) / giorniDelMese(a, mi));
    if (mesiRestanti > 0) {
      const servono = residuo / mesiRestanti;
      const contratto = (target * (1 - quota)) / mesiRestanti;
      ritmo = { servono_t_mese: t3(servono), contratto_t_mese: t3(contratto), pct_ritmo: contratto > 0 ? (servono / contratto) * 100 : null, mesi_restanti: Math.round(mesiRestanti * 10000) / 10000 };
    }
  }

  // MESE PER MESE: il target del profilo, il budget di SMOCO, il raccolto, e i
  // progressivi. Un mese che i dati non coprono e senza raccolto e' futuro.
  const profilo = profiloMensile(commessa);
  const budget = lista(commessa && commessa.budget_rete_json).map(Number);
  const coperto = MESI_MOVIMENTI.map((_, i) => frazioneDelMese(a, i, giornoDati, oggi));
  const raccoltoMesi = perMese(reteAnno);
  let cumTarget = 0, cumRaccolto = 0;
  const mesi = mesiDelCanale(raccoltoMesi, coperto).map((m, i) => {
    const t = target === null ? null : target * profilo.pesi[i];
    if (t !== null) cumTarget += t;
    if (!m.futuro) cumRaccolto += raccoltoMesi[i];
    return {
      ...m,
      target_t: t3(t),
      atteso_t: t !== null && !m.futuro ? t3(t * coperto[i]) : null,
      budget_t: Number.isFinite(budget[i]) && budget[i] > 0 ? t3(budget[i]) : null,
      target_cum_t: t === null ? null : t3(cumTarget),
      raccolto_cum_t: m.futuro ? null : t3(cumRaccolto),
    };
  });

  // LE REGIONI, sul riparto del contratto (getDashboardRaccolta,
  // target_vs_raccolto) e con lo scarto sull'atteso. Il raccolto delle province
  // fuori dalle regioni del contratto non spariva solo dal grafico: la somma delle
  // regioni non tornava col raccolto della card. Ora sta in una riga sua.
  const conAtteso = atteso !== null;
  const regioni = (targetVsRaccolto || []).map(r => {
    const at = conAtteso && r.atteso !== null && r.atteso !== undefined ? Number(r.atteso) : null;
    return {
      regione: r.regione,
      target_t: r.target === null || r.target === undefined ? null : t3(r.target),
      atteso_t: t3(at),
      raccolto_t: t3(r.raccolto),
      scarto_t: at === null ? null : t3(r.raccolto - at),
      pct_atteso: at ? (r.raccolto / at) * 100 : null,
    };
  });
  const nelContratto = new Set(regioni.map(r => r.regione));
  const fuori = conRiparto ? Object.entries(raccoltoPerRegione || {}).filter(([reg]) => !nelContratto.has(reg)).sort((x, y) => y[1] - x[1]) : [];

  return {
    target_t: target, fonte_target: fonteTarget,
    da_confermare: (kpi.target_da_confermare || []).includes(a),
    ripiego: (kpi.target_ripiego || []).includes(a),
    raccolto_t: kpi.raccolto_rete_anno,
    ritiri: ordiniDistinti(reteAnno),
    pct_target: kpi.raggiungimento_pct,
    atteso,
    residuo_t: t3(residuo),
    proiezione, proiezione_perche: proiezionePerche,
    ritmo,
    // quanto somma il profilo scritto, che puo' non essere il target (11.571,64 t
    // contro 11.550 nel 2026): lo dice il perche' della sezione
    profilo: { rivisto: profilo.rivisto, somma_t: profilo.rivisto ? t3(profilo.totale) : null },
    mesi,
    regioni,
    fuori_contratto: { raccolto_t: t3(fuori.reduce((s, [, t]) => s + t, 0)), regioni: fuori.map(([regione, t]) => ({ regione, raccolto_t: t3(t) })) },
    raccoglitori: raccoglitoriRete({ righe: rete, anno: a, giornoDati, oggi, mensili, annui }),
    province_ferme: provinceFerme(rete, a, oggi),
    tempi: tempiRaccoltaAnno(rete, a),
    senza_fine_trasporto: senzaFine,
  };
}

/**
 * L'ACI: un canale a se', senza target. La previsione del contratto ACI e'
 * indicativa. Le regioni dalla provincia, come in Target & Status (CanaleAci),
 * cosi' i numeri coincidono riga per riga; il prezzo della tabella non esce.
 */
export function quadroAci({ anno, oggi, giornoDati, commessa, kpi, aciAnno }) {
  const a = Number(anno);
  const previsione = lista(commessa && commessa.target_prezzo_regioni_json).filter(r => r && r.regione);
  const prev = Number(kpi.previsione_aci) || 0;
  const perRegione = new Map();
  for (const r of aciAnno || []) {
    const reg = regioneDaProvincia(r);
    perRegione.set(reg, (perRegione.get(reg) || 0) + (Number(r.peso_effettivo) || 0) / 1000);
  }
  const nomi = [...new Set([...previsione.map(p => String(p.regione)), ...perRegione.keys()])];
  const regioni = nomi.map(regione => {
    const p = previsione.find(x => String(x.regione).toLowerCase() === regione.toLowerCase());
    const pv = p ? Number(p.target_t) || 0 : 0;
    const fatto = [...perRegione.entries()].filter(([k]) => k.toLowerCase() === regione.toLowerCase()).reduce((s, [, t]) => s + t, 0);
    return { regione, previsione_t: pv > 0 ? t3(pv) : null, raccolto_t: t3(fatto), pct: pv > 0 ? (fatto / pv) * 100 : null };
  }).filter((r, i, tutte) => tutte.findIndex(x => x.regione.toLowerCase() === r.regione.toLowerCase()) === i);
  const budget = lista(commessa && commessa.budget_aci_json).map(Number).filter(Number.isFinite).reduce((s, v) => s + v, 0);
  const coperto = MESI_MOVIMENTI.map((_, i) => frazioneDelMese(a, i, giornoDati, oggi));
  return {
    raccolto_t: kpi.raccolto_aci_anno,
    previsione_t: prev > 0 ? prev : null,
    pct_previsione: prev > 0 ? (Number(kpi.raccolto_aci_anno) / prev) * 100 : null,
    ritiri: ordiniDistinti(aciAnno),
    budget_t: budget > 0 ? t3(budget) : null,
    regioni,
    mesi: mesiDelCanale(perMese(aciAnno), coperto),
  };
}

/** L'extra raccolta: gli interventi terminati, per fine trasporto, senza i trasferimenti in secondaria. */
export function quadroExtra({ anno, oggi, giornoDati, kpi, extraAnno }) {
  const righe = (extraAnno || []).map(x => (x && x.r ? x.r : x));
  const giorni = righe.map(r => (periodoMovimento(r) || {}).giorno).filter(Boolean).sort();
  const coperto = MESI_MOVIMENTI.map((_, i) => frazioneDelMese(Number(anno), i, giornoDati, oggi));
  return {
    interventi: ordiniDistinti(righe),
    raccolto_t: kpi.raccolto_extra_anno,
    ultimo_giorno: giorni.length ? giorni[giorni.length - 1] : null,
    mesi: mesiDelCanale(perMese(righe), coperto),
  };
}

/**
 * I MESI DELL'ATTIVA DI UN ANNO PASSATO (revisione delle migliorie, 11/10/2026).
 *
 * statoMesiAttiva elenca sempre i dodici mesi dell'anno guardato. Per il 2025,
 * fatturato prima che il gestionale esistesse e senza un documento qui, la
 * sezione e il PDF che si manda fuori scrivevano dodici mesi «da elaborare» su
 * tutti e tre i canali; e la vista del 2026, nella stessa pagina, il 2025 lo
 * saltava. Vale la regola del cruscotto per l'anno prima: si parte dal primo
 * mese che ha un documento, e un anno senza documenti non si guarda. Quello che
 * resta fuori lo dice la nota, mai uno stato inventato.
 * { mesi, nota }
 */
export function mesiAttivaAnnoPassato(documenti, prefatture, anno, oggi) {
  const a = Number(anno);
  const tutti = statoMesiAttiva(documenti, prefatture, a, oggi);
  const primo = tutti.findIndex(m => m.elaborato);
  if (primo < 0) {
    return { mesi: [], nota: `Nessun documento della fatturazione attiva del ${a} nel gestionale: i mesi fatturati prima del gestionale non si elaborano qui.` };
  }
  const ultimoPrima = MESI_MOVIMENTI[primo - 1] ? MESI_MOVIMENTI[primo - 1].toLowerCase() : '';
  const prima = primo === 0 ? '' : primo === 1 ? 'gennaio' : `da gennaio ${/^a/.test(ultimoPrima) ? 'ad' : 'a'} ${ultimoPrima}`;
  return {
    mesi: tutti.slice(primo),
    nota: prima ? `Il ${a} si guarda da ${MESI_MOVIMENTI[primo].toLowerCase()}, il primo mese con un documento nel gestionale: ${prima} è stato fatturato prima del gestionale.` : '',
  };
}

/**
 * Il giorno su cui si misurano atteso e target dell'anno scelto: il giorno dei
 * dati per l'anno in corso, il 31/12 per un anno chiuso (i suoi dati sono
 * completi), niente per un anno senza ancora un ritiro. Le etichette («Atteso
 * al ...», «sul loro target al ...») lo leggono da qui.
 */
export function giornoDellaMisura(anno, giornoDati) {
  const a = Number(anno);
  const annoDati = giornoDati ? Number(String(giornoDati).slice(0, 4)) : null;
  return annoDati === null || annoDati < a ? '' : annoDati > a ? `${a}-12-31` : String(giornoDati);
}

/**
 * Il quadro intero di un anno. documenti e prefatture servono solo per un anno
 * passato: quello in corso ha i suoi mesi dell'attiva dal cruscotto.
 */
export function quadroCommessa(d) {
  const a = Number(d.anno);
  const annoOggi = Number(String(d.oggi).slice(0, 4));
  const attiva = a < annoOggi && d.documenti ? mesiAttivaAnnoPassato(d.documenti, d.prefatture || [], a, d.oggi) : null;
  return {
    anno: a,
    oggi: d.oggi,
    giorno_dati: d.giornoDati || '',
    giorno_misura: giornoDellaMisura(a, d.giornoDati),
    anno_chiuso: a < annoOggi,
    rete: quadroRete(d),
    aci: quadroAci(d),
    extra: quadroExtra(d),
    mesi_attiva: attiva ? attiva.mesi : null,
    mesi_attiva_nota: attiva ? attiva.nota : '',
  };
}
