// Modulo condiviso per le analytics del modulo Primarie Rete:
// 1. Matrice mensile FIR per Regione/Provincia con detection 2 mesi consecutivi a zero
// 2. Mix classi PFU per Raccoglitore con confronto target consorziali

import { PROV_TO_REGION, MESI, riepilogoDate, riepilogoDateVista } from "./raccoltoCalculator.ts";
import { eTerminato, periodoMovimento, tempiRaccolta, dateIncoerenti } from "./movimenti.ts";
import { oggiRoma, annoRoma } from "./giornoItaliano.ts";
import { classePfu } from "./giacenzaStoccaggi.ts";
import { eAci } from "./canaleSecondaria.ts";
import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";
import { targetDelPortale } from "./targetRaccoglitori.ts";
import { regioniDellAnno } from "./attesoContratto.ts";
import { commessaDellAnno } from "./annoTarget.ts";

export const TARGET_MIX_CLASSI: Record<string, number> = {
  P: 75,
  M: 20,
  G1: 4,
  G2: 1,
};

// Il target annuo della commessa non si scrive qui: viene dal contratto
// dell'anno (attesoContratto.ts). TARGET_ANNUO_TON = 11550 non lo leggeva nessuno
// ed e' stata tolta l'11/10/2026 (chiusura dell'audit): una costante
// esportata e' un invito a usarla.

// --- 1. Matrice Province ---

const REGIONI_ITALIANE = [...new Set(Object.values(PROV_TO_REGION))];

/**
 * LE PROVINCE DEL CONTRATTO DI UN ANNO (segnalazione alta del 20/09, corretta il
 * 12/10/2026): [{ provincia, regione }], dal riparto per regione del contratto
 * Ecotyre (regioni_json, colonna «Province»). Nel contratto 2026 si legge
 * «Tutte le provincie» per Campania, Basilicata e Calabria, «BA,BR,TA,LE» per la
 * Puglia e «CT, SR, TP, AG, CL, EN, RG» per la Sicilia.
 * - «Tutte...», o la colonna vuota: tutte le province della regione. Una
 *   provincia segnalata per niente si corregge scrivendo il contratto; una mai
 *   servita che nessuno vede no.
 * - Altrimenti le sigle che si riconoscono; un testo senza nessuna sigla non da'
 *   province, perche' non si inventano.
 * - Il riparto di ripiego scritto nel codice (contratto non inserito) non dice
 *   le province: non ne da' nessuna, per non segnalare FG o PA che il contratto
 *   2026 non comprende.
 */
export function provinceDelContratto(commessa, anno) {
  const { righe, fonte } = regioniDellAnno(commessa, anno);
  if (fonte !== 'contratto') return [];
  const out = new Map();
  for (const r of righe) {
    const regione = REGIONI_ITALIANE.find(x => x.toUpperCase() === String(r.regione || '').trim().toUpperCase()) || String(r.regione || '').trim();
    const testo = String(r.province ?? '').trim();
    const sigle = !testo || /tutt/i.test(testo)
      ? Object.keys(PROV_TO_REGION).filter(p => PROV_TO_REGION[p] === regione)
      : testo.toUpperCase().split(/[^A-Z]+/).filter(p => PROV_TO_REGION[p]);
    for (const p of sigle) if (!out.has(p)) out.set(p, { provincia: p, regione: PROV_TO_REGION[p] || regione });
  }
  return [...out.values()];
}

/**
 * La matrice dei ritiri per provincia e mese dell'anno in corso.
 * opzioni.commesse: i contratti Ecotyre (CommessaEcotyre), di qualunque anno:
 * le province del contratto dell'anno entrano nella matrice anche senza un
 * ritiro, a zero (provinceDelContratto). Prima la matrice nasceva solo dalle
 * province con movimenti, e una provincia del contratto mai servita non
 * compariva e non poteva avere «due mesi consecutivi a zero»: da marzo in poi
 * restava muta proprio quella da scovare (segnalazione alta del 20/09, corretta
 * il 12/10/2026). Senza opzioni.commesse la matrice resta quella dei movimenti.
 */
export function computeProvinceMatrixData(records, currentMonthIdx = null, opzioni: any = {}) {
  const oggi = oggiRoma();
  const currMonth = currentMonthIdx != null ? currentMonthIdx : Number(oggi.slice(5, 7)) - 1;
  const currYear = Number(oggi.slice(0, 4));
  const delContratto = opzioni && opzioni.commesse ? provinceDelContratto(commessaDellAnno(opzioni.commesse, currYear), currYear) : [];

  const byProvince: Record<string, any> = {};
  // i ritiri contati nella matrice, per le date da sistemare (in fondo)
  const contati = [];
  // Novembre e dicembre dell'anno prima, per provincia: servono solo a gennaio e
  // febbraio, per la coppia a cavallo d'anno (piu' sotto).
  const codaAnnoPrima = new Map(); // provincia -> { regione, nov, dic }

  for (const r of records) {
    const provincia = (r.provincia || '').toUpperCase().trim();
    if (!provincia) continue;
    const regione = r.regione || PROV_TO_REGION[provincia] || 'Altro';

    // Conta un ritiro fatto: terminato, nel mese in cui e' finito il trasporto
    // (base44/shared/movimenti.ts). Prima entravano anche i cancellati.
    if (!eTerminato(r)) continue;
    const periodo = periodoMovimento(r);
    if (periodo && periodo.anno === currYear - 1) {
      if (!codaAnnoPrima.has(provincia)) codaAnnoPrima.set(provincia, { regione, nov: 0, dic: 0 });
      const coda = codaAnnoPrima.get(provincia);
      if (periodo.mese_idx === 10) coda.nov++;
      if (periodo.mese_idx === 11) coda.dic++;
      continue;
    }
    if (!periodo || periodo.anno !== currYear) continue;

    const mese = MESI[periodo.mese_idx];
    const hasFir = r.numero_fir && String(r.numero_fir).trim() !== '';

    if (!byProvince[provincia]) {
      byProvince[provincia] = { provincia, regione, mesi: {}, totale: 0, fir_total: 0 };
      for (const m of MESI) byProvince[provincia].mesi[m] = 0;
    }

    byProvince[provincia].totale += 1;
    if (hasFir) byProvince[provincia].fir_total += 1;
    byProvince[provincia].mesi[mese] += 1;
    contati.push(r);
  }

  // Le province del contratto senza un ritiro nell'anno, a zero: cosi' una mai
  // servita ha la sua riga e i suoi mesi a zero si contano come quelli delle
  // altre (12/10/2026).
  for (const { provincia, regione } of delContratto) {
    if (byProvince[provincia]) continue;
    byProvince[provincia] = { provincia, regione, mesi: {}, totale: 0, fir_total: 0 };
    for (const m of MESI) byProvince[provincia].mesi[m] = 0;
  }
  const inContratto = new Set(delContratto.map(p => p.provincia));

  const provinceArray = Object.values(byProvince).map((p: any) => {
    const mesiValues = MESI.map((m, idx) => ({
      mese: m,
      idx,
      count: p.mesi[m],
      passed: idx <= currMonth,
    }));

    let consecutiveZeros = 0;
    let has2Consecutive = false;
    let lastZeroPair = null;

    for (let i = 0; i < MESI.length; i++) {
      const mv = mesiValues[i];
      // SOLO I MESI FINITI (audit del 10/10/2026). Il mese in corso entrava nel
      // conto: il primo del mese, una provincia col mese prima a zero diventava
      // «2 mesi consecutivi senza raccolte» per un mese cominciato da un giorno, e
      // l'avviso si spegneva al primo ritiro. Un avviso che si accende e si spegne
      // ogni mese sullo stesso dato si impara a ignorare. `passed` resta com'e':
      // serve alla tabella per mostrare il mese in corso.
      if (!mv.passed || mv.idx >= currMonth) break;
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
      // del contratto dell'anno; e senza nessun ritiro nell'anno
      del_contratto: inContratto.has(p.provincia),
      senza_ritiri: p.totale === 0,
    };
  });

  provinceArray.sort((a, b) => a.regione.localeCompare(b.regione) || a.provincia.localeCompare(b.provincia));

  const byRegione: Record<string, any[]> = {};
  for (const p of provinceArray) {
    if (!byRegione[p.regione]) byRegione[p.regione] = [];
    byRegione[p.regione].push(p);
  }

  // LA COPPIA A CAVALLO D'ANNO (revisione del 10/10/2026). Contano solo i mesi
  // finiti, e a gennaio dell'anno non ce n'e' nessuno: novembre e dicembre a zero
  // non li segnalava piu' nessuno - a dicembre il mese non era finito, a gennaio
  // l'anno era cambiato. Prima del 10/10 l'avviso nasceva il primo dicembre, da un
  // mese cominciato da un giorno. A gennaio e febbraio si guardano anche novembre
  // e dicembre dell'anno prima, per le province che l'anno prima lavoravano; una
  // ferma da allora, senza ritiri quest'anno, non ha una riga nella tabella
  // dell'anno ma va nell'avviso.
  const fermeDallAnnoPrima = [];
  if (currMonth <= 1) {
    const prima = currYear - 1;
    const nome = (i) => (i < 0 ? `${MESI[12 + i]} ${prima}` : MESI[i]);
    const coppiaVuota = (coda, correnti) => {
      const serie = [[-2, coda.nov], [-1, coda.dic], ...correnti.map((c, i) => [i, c])];
      let coppia = null;
      for (let i = 1; i < serie.length; i++) {
        if (serie[i - 1][1] === 0 && serie[i][1] === 0) coppia = { start: nome(serie[i - 1][0]), end: nome(serie[i][0]) };
      }
      return coppia;
    };
    for (const p of provinceArray) {
      const coda = codaAnnoPrima.get(p.provincia);
      if (!coda) continue;
      const coppia = coppiaVuota(coda, MESI.slice(0, currMonth).map(m => p.mesi[m]));
      if (coppia) { p.has_2_consecutive_zeros = true; p.last_zero_pair = coppia; }
    }
    for (const [provincia, coda] of codaAnnoPrima) {
      if (byProvince[provincia]) continue;
      const coppia = coppiaVuota(coda, MESI.slice(0, currMonth).map(() => 0));
      if (coppia) fermeDallAnnoPrima.push({ provincia, regione: coda.regione, has_2_consecutive_zeros: true, last_zero_pair: coppia, solo_anno_prima: true });
    }
  }

  const provinceWithZeros = [...provinceArray.filter(p => p.has_2_consecutive_zeros), ...fermeDallAnnoPrima];

  return {
    province: provinceArray,
    by_regione: byRegione,
    province_with_zeros: provinceWithZeros,
    current_month: MESI[currMonth],
    current_year: currYear,
    // Le date da sistemare della rete (regola dell'utente, 22/09/2026): i
    // terminati senza fine trasporto, di qualunque anno e fuori da ogni mese, e i
    // ritiri contati qui con un'altra data che manca o non torna.
    date_da_sistemare: riepilogoDateVista(records, contati),
  };
}

// --- 2. Mix Classi Raccoglitori ---
//
// Due domande diverse, una per vista (06/10/2026, su richiesta dell'utente:
// «quanto di ciascuna classe, sia in termini % che come tonnellate, e' stato
// raccolto rispettivamente rispetto al raccolto e rispetto al target annuale»):
//
// Vista A, % SUL RACCOLTO: che mix ha raccolto, cioe' peso della classe sul suo
//   raccolto di rete. E' il numero che si confronta con i target consorziali
//   (P=75, M=20, G1=4, G2=1) e da cui esce il delta, soglia ±5 punti.
// Vista B, % SUL TARGET: quanto ha fatto del target DI QUELLA CLASSE, cioe'
//   peso della classe sul target annuo del raccoglitore ripartito col mix
//   consorziale (target × 75% per la P, × 20% per la M, e cosi' via).
//
// Prima la vista B divideva il peso di una classe per il target INTERO: con 1.000
// t di target e 600 t di P diceva 60%, che non e' ne' la quota di P (75%) ne'
// quanto di P e' stato fatto (600 su 750, cioe' l'80%). Un numero che non
// rispondeva a nessuna domanda.
//
// E il target del raccoglitore si cercava per nome esatto: "SMOCO S.R.L." dei
// file del portale non trovava "SMOCO S.r.l." dei target, e il piu' grande dei
// raccoglitori risultava senza target, con tutta la vista B a zero. Inoltre chi
// ha piu' righe di target - una per regione - ne vedeva contare una sola, perche'
// la mappa si sovrascriveva invece di sommare.

export function computeRaccoglitoriMixData(records, targetsMap: Record<string, number> = {}, filters: any = {}) {
  const toArray = (v: any) => Array.isArray(v) ? v : (v != null ? [v] : []);
  const fAnno = toArray(filters.anno).map(Number);
  const fMese = toArray(filters.mese);
  const fRegione = toArray(filters.regione);
  const fStato = toArray(filters.stato);

  // Default: anno in corso se nessun filtro anno specificato
  const effectiveAnni = fAnno.length > 0 ? fAnno : [Number(oggiRoma().slice(0, 4))];

  // Regione e stato valgono anche per le date da sistemare: i terminati senza
  // fine trasporto non hanno anno ne' mese, e nessun filtro di periodo li prende.
  const passaNonPeriodo = (r: any) => {
    const regione = r.regione || PROV_TO_REGION[(r.provincia || '').toUpperCase().trim()] || 'Altro';
    if (fRegione.length > 0 && !fRegione.includes(regione)) return false;
    if (fStato.length > 0 && !fStato.includes((r.stato || '').trim())) return false;
    return true;
  };

  const filtered = records.filter((r: any) => {
    const regione = r.regione || PROV_TO_REGION[(r.provincia || '').toUpperCase().trim()] || 'Altro';
    const stato = (r.stato || '').trim();
    // Il periodo e' la fine del trasporto sul giorno italiano; il mix si valuta
    // sul raccolto, cioe' sui terminati, a meno che il filtro chieda altro.
    const periodo = periodoMovimento(r);
    const mese = periodo ? periodo.mese : 'N/D';
    const anno = periodo ? periodo.anno : null;

    if (fStato.length === 0 && !eTerminato(r)) return false;
    if (!effectiveAnni.includes(anno)) return false;
    if (fMese.length > 0 && !fMese.includes(mese)) return false;
    if (fRegione.length > 0 && !fRegione.includes(regione)) return false;
    if (fStato.length > 0 && !fStato.includes(stato)) return false;
    return true;
  });

  const byRaccoglitore: Record<string, any> = {};

  for (const r of filtered) {
    // IL CANALE LO DECIDE IL MATERIALE (regola dell'utente: rete, ACI ed extra
    // raccolta non si sommano mai). Una riga di autodemolizione finita
    // nell'archivio di rete non e' rete: starebbe nel totale del raccoglitore
    // abbassando la quota di tutte le classi, senza comparire in nessuna.
    if (eAci(r)) continue;
    const raccoglitore = (r.trasportatore || 'N/D').trim();
    // La classe si legge col prodotto, non col solo campo classe: quando quel
    // campo e' vuoto il peso restava fuori da ogni classe ma dentro il totale, e
    // il mix usciva piu' basso del vero su tutte e quattro.
    const classe = classePfu(r.classe, r.prodotto);
    const peso = (r.peso_effettivo || 0) / 1000; // kg -> ton

    if (!byRaccoglitore[raccoglitore]) {
      byRaccoglitore[raccoglitore] = {
        raccoglitore,
        totale_peso: 0,
        classi: { P: 0, M: 0, G1: 0, G2: 0, ALTRO: 0 },
      };
    }

    byRaccoglitore[raccoglitore].totale_peso += peso;
    if (byRaccoglitore[raccoglitore].classi[classe] !== undefined) {
      byRaccoglitore[raccoglitore].classi[classe] += peso;
    } else {
      // niente sparisce in silenzio: quello che non e' una classe di rete si
      // vede, e il mix dice su che cosa e' calcolato
      byRaccoglitore[raccoglitore].classi.ALTRO += peso;
    }
  }

  const deviazioneThreshold = 5; // ±5% absolute deviation

  // I target per raccoglitore, per nome normalizzato e SOMMATI: un raccoglitore
  // puo' avere piu' righe di target, una per regione o per impianto.
  const targetPer = new Map<string, number>();
  for (const [nome, t] of Object.entries(targetsMap || {})) {
    const k = normalizzaRagioneSociale(nome);
    if (!k) continue;
    targetPer.set(k, (targetPer.get(k) || 0) + (Number(t) || 0));
  }

  // Il nome del portale trova il target con lo stesso nome o, se non c'e', con il
  // nome abbreviato (targetDelPortale, come gli alert, l'Andamento e il Report
  // generale): un target scritto «PNEUSERVICE SRL» valeva zero per «PNEUSERVICE
  // CONVERSANO SRL», e la vista B diceva 0% su ogni classe (11/10/2026).
  const nomiTarget = Object.keys(targetsMap || {});
  const targetDelNome = (nome) => {
    const t = targetDelPortale(nomiTarget, nome);
    return t === null ? 0 : targetPer.get(normalizzaRagioneSociale(t)) || 0;
  };
  const raccoglitoriArray = Object.values(byRaccoglitore).map((r: any) => {
    const totale = r.totale_peso;
    const targetRaccoglitore = targetDelNome(r.raccoglitore);
    const percentuali: Record<string, number> = {};
    const percentuali_target: Record<string, number> = {};
    const deviazioni: Record<string, number> = {};
    // le tonnellate, che la percentuale da sola non dice
    const tonnellate: Record<string, number> = {};
    const target_classi: Record<string, number> = {};

    for (const [classe, targetPct] of Object.entries(TARGET_MIX_CLASSI)) {
      const pesoClasse = r.classi[classe] || 0;
      // Vista A: % sul raccolto del raccoglitore
      const pct = totale > 0 ? (pesoClasse / totale) * 100 : 0;
      // Il target di QUELLA classe: il target annuo ripartito col mix consorziale
      const targetClasse = (targetRaccoglitore * targetPct) / 100;
      // Vista B: quanto ha fatto del target di quella classe
      const pctTarget = targetClasse > 0 ? (pesoClasse / targetClasse) * 100 : 0;
      // Deviazione calcolata sulla Vista A rispetto al target consorziale
      const deviazione = pct - targetPct;

      percentuali[classe] = pct;
      percentuali_target[classe] = pctTarget;
      deviazioni[classe] = deviazione;
      tonnellate[classe] = pesoClasse;
      target_classi[classe] = targetClasse;
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
      target_raccoglitore: targetRaccoglitore,
      percentuali,
      percentuali_target,
      deviazioni,
      tonnellate,
      target_classi,
      // quello che non e' una classe di rete, se c'e': si vede invece di diluire
      altro_t: r.classi.ALTRO || 0,
      deviazioni_significative,
      has_deviazione: deviazioni_significative.length > 0,
    };
  });

  raccoglitoriArray.sort((a, b) => b.totale_peso - a.totale_peso);

  const targetTotale = Object.values(targetsMap).reduce((s, v) => s + (v || 0), 0);

  return {
    raccoglitori: raccoglitoriArray,
    target_mix: TARGET_MIX_CLASSI,
    target_totale: targetTotale,
    raccoglitori_con_deviazione: raccoglitoriArray.filter(r => r.has_deviazione),
    // le date da sistemare della rete, con gli stessi filtri (22/09/2026)
    date_da_sistemare: riepilogoDateVista(records.filter(passaNonPeriodo), filtered),
  };
}

// --- 3. SLA Metrics per Trasportatore ---

// Si misura sui ritiri fatti (terminati) dell'anno richiesto, per default quello
// in corso: prima entravano tutti gli anni dell'archivio e i cancellati, e la
// media giorni a video non era dell'anno di lavoro.
//
// I giorni e l'esito si ricalcolano qui dall'immissione alla fine del trasporto
// (tempiRaccolta), senza leggere nr_giorni e raccolta_nei_tempi salvati sul
// record: erano misurati sulla chiusura a portale, e un archivio caricato prima
// della correzione li porta ancora. Cosi' anche il badge "Critico" e l'alert di
// ritardo guardano il ritiro, non la pratica.
//
// Un terminato senza fine trasporto (o senza immissione) non si misura: si conta
// a parte e si segnala, e l'anno per contarlo e' quello dell'immissione. Lo
// stesso con le date incoerenti (dateIncoerenti in movimenti.ts), cioe' una fine
// trasporto prima dell'inizio: una delle due e' sbagliata e non si sa quale.
// Un ordine misurato a cui manca solo l'inizio del trasporto resta nei tempi,
// che non lo usano, ma si conta in date_da_sistemare.
//
// Un ritiro finito PRIMA dell'immissione non si misura nemmeno lui, ma non e' un
// errore: a portale l'immissione e' la registrazione dell'ordine e arriva spesso
// dopo il ritiro (426 primarie di rete, 99 del 2026; misurato il 22/09/2026). Il
// raccoglitore non ha tardato, solo non c'e' niente da misurare: contarlo zero
// giorni e "nei tempi" abbassava la media di tutti e alzava la percentuale. Si
// conta in non_misurati.immissione_dopo_ritiro, una voce che va detta per quello
// che e': non c'e' niente da correggere a portale.
export function computeSlaMetrics(records, anno = null) {
  const byTrasportatore: Record<string, any> = {};
  const annoNum = Number(anno) || Number(oggiRoma().slice(0, 4));
  const nonMisurati = {
    senza_fine_trasporto: 0, senza_immissione: 0, date_incoerenti: 0, esempi: [] as string[],
    // non e' un errore: sta a parte anche negli esempi, che l'altro elenco e' di date da correggere
    immissione_dopo_ritiro: 0, esempi_immissione_dopo_ritiro: [] as string[],
  };
  const segnala = (r: any, perche: 'senza_fine_trasporto' | 'senza_immissione' | 'date_incoerenti') => {
    nonMisurati[perche] += 1;
    if (nonMisurati.esempi.length < 5 && r.id_ordine) nonMisurati.esempi.push(String(r.id_ordine));
  };
  const segnalaImmissioneDopo = (r: any) => {
    nonMisurati.immissione_dopo_ritiro += 1;
    if (nonMisurati.esempi_immissione_dopo_ritiro.length < 5 && r.id_ordine) nonMisurati.esempi_immissione_dopo_ritiro.push(String(r.id_ordine));
  };
  // i terminati dell'anno della scheda, misurati o no, per le date da sistemare
  const dellAnno = [];

  for (const r of records) {
    if (!eTerminato(r)) continue;
    const periodo = periodoMovimento(r);
    if (!periodo) {
      if (annoRoma(r.ordine_immesso_il) === annoNum) { segnala(r, 'senza_fine_trasporto'); dellAnno.push(r); }
      continue;
    }
    if (periodo.anno !== annoNum) continue;
    dellAnno.push(r);
    const tempi = tempiRaccolta(r);
    if (!tempi) { segnala(r, 'senza_immissione'); continue; }
    if (tempi.giorni == null || dateIncoerenti(r).length > 0) { segnala(r, 'date_incoerenti'); continue; }
    // fuori dai giorni e dai "nei tempi": non c'e' un tempo da misurare
    if (tempi.prima_dell_immissione) { segnalaImmissioneDopo(r); continue; }
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

    if (tempi.esito === 'OK') t.nei_tempi += 1;
    else t.dopo_scadenza += 1;

    t.nr_giorni_sum += tempi.giorni;
    t.nr_giorni_count += 1;
    if (tempi.giorni > 10) t.oltre_10gg += 1;
    if (tempi.giorni > 12) t.oltre_12gg += 1;
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
  const totale_dopo_scadenza = trasportatori.reduce((s, t) => s + t.dopo_scadenza, 0);
  const totale_giorni = trasportatori.reduce((s, t) => s + t.nr_giorni_sum, 0);
  const totale_giorni_count = trasportatori.reduce((s, t) => s + t.nr_giorni_count, 0);

  return {
    trasportatori,
    totale_ordini,
    anno: annoNum,
    avg_giorni: totale_giorni_count > 0 ? totale_giorni / totale_giorni_count : 0,
    pct_nei_tempi_globale: totale_ordini > 0 ? (totale_nei_tempi / totale_ordini) * 100 : 0,
    // contato, non ricavato come 100 - nei tempi
    pct_dopo_scadenza_globale: totale_ordini > 0 ? (totale_dopo_scadenza / totale_ordini) * 100 : 0,
    non_misurati: nonMisurati,
    // tutte le date da sistemare dell'anno, anche degli ordini misurati
    date_da_sistemare: riepilogoDate(dellAnno),
  };
}