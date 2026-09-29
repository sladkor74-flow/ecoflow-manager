// I CONFERIMENTI DI UN MESE, RIPARTITI SULLE SETTIMANE CHE LO COPRONO.
//
// Richiesta dell'utente (29/09/2026): nel modulo Secondarie una sezione report,
// come nel modulo Report, con i conferimenti nei vari impianti ripartiti sulle
// settimane del mese di competenza, con stoccaggio di origine, destinazione,
// trasportatore e peso effettivo, e i totali per ciascuno. Poi la stessa cosa su
// ACI ed extra raccolta, primarie e secondarie.
//
// UN MOTORE SOLO, TANTE VISTE. Rete, ACI ed extra raccolta non si mescolano mai
// (regola 3): il canale si sceglie, non si somma. Primarie e secondarie hanno
// colonne diverse solo in quello che si legge da un record - da dove parte il
// carico - e il resto del conto e' identico. Tre report che si somigliano scritti
// in tre posti diventerebbero, nel giro di qualche mese, tre modi diversi di
// contare gli stessi chili.
//
// LE SETTIMANE SONO QUELLE DEL FILE DI GESTIONE (settimaneDelMese di
// reportSettimanale.ts): lunedi'-domenica, la settimana 1 e' quella che contiene
// il 1 gennaio, e una settimana a cavallo di due mesi conta nel mese solo per i
// suoi giorni. E' la stessa numerazione del report settimanale della raccolta, coi
// cui numeri questo report verra' letto accanto. Nel 2026 coincide con la
// numerazione ISO usata dalle verifiche; dal 2027 no, e per questo ogni colonna
// porta scritto anche il suo intervallo di giorni: il numero da solo, un anno,
// vorrebbe dire due cose.
//
// IL PERIODO E' LA FINE DEL TRASPORTO, sempre (regola 1): un carico sta nella
// settimana in cui il camion ha finito, non in quella in cui il portale ha chiuso
// l'ordine giorni dopo. Un terminato senza fine trasporto non sta in nessuna
// settimana: resta fuori dal conto, si conta a parte e si dice, come ovunque.
import { eTerminato, giornoMovimento, canaleMovimento } from "./movimenti.ts";
import { contaFormulari } from "./formulari.ts";
import { dateDaSegnalare } from "./filtroPeriodo.ts";
import { settimaneDelMese } from "./reportSettimanale.ts";
import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";

const kg = (v) => Math.round(Number(v) || 0);
const t3 = (v) => Math.round((Number(v) || 0) * 1000) / 1000;
const pulisci = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

/** I tre canali, con il nome che si legge a video. */
export const CANALI_CONFERIMENTI = [
  { chiave: 'RETE', nome: 'Rete' },
  { chiave: 'ACI', nome: 'ACI' },
  { chiave: 'EXTRA_RACCOLTA', nome: 'Extra raccolta' },
];

/**
 * DA DOVE PARTE, DOVE ARRIVA E CHI LO PORTA, per un movimento.
 *
 * Una SECONDARIA parte da uno stoccaggio: l'origine e' il piazzale, ed e' il dato
 * che l'utente ha chiesto per primo. Una PRIMARIA parte da un punto di raccolta:
 * metterne il nome farebbe un elenco di centinaia di righe irripetibili, e il
 * report non servirebbe a niente. Per le primarie l'origine e' la PROVINCIA del
 * ritiro - la zona da cui il materiale e' arrivato - che e' la cosa che si guarda
 * davvero quando si controlla un conferimento.
 */
export function daDoveADove(r, tipo) {
  const destinazione = pulisci(r && r.destinazione);
  const trasportatore = pulisci(r && r.trasportatore);
  if (tipo === 'secondaria') {
    return { origine: pulisci(r && r.stoccaggio), destinazione, trasportatore };
  }
  return { origine: pulisci(r && r.provincia).toUpperCase(), destinazione, trasportatore };
}

/** La chiave di una riga del report: la tratta piu' chi la fa. */
const chiaveTratta = (d) => [
  normalizzaRagioneSociale(d.origine) || d.origine.toLowerCase(),
  normalizzaRagioneSociale(d.destinazione) || d.destinazione.toLowerCase(),
  normalizzaRagioneSociale(d.trasportatore) || d.trasportatore.toLowerCase(),
].join('|');

/**
 * In quale settimana del mese cade un giorno, fra quelle passate. Null se il
 * giorno non cade in nessuna: e' il caso di un movimento di un altro mese.
 */
export function settimanaDelGiorno(settimane, giorno) {
  if (!giorno) return null;
  for (const s of settimane) if (giorno >= s.dal && giorno <= s.al) return s.numero;
  return null;
}

/**
 * IL REPORT DI UN MESE, per un canale e un tipo di movimento.
 *
 * Restituisce le settimane che coprono il mese, una riga per tratta con i chili
 * settimana per settimana e il totale, i totali di colonna, e a parte i terminati
 * del mese che una fine trasporto non ce l'hanno - che nel conto non entrano
 * (regola 1) ma non spariscono.
 *
 * I movimenti si contano per RIGA e si sommano i pesi effettivi: uno stesso
 * formulario ripartito su due ordini ha due righe e in fattura conta la somma dei
 * pesi, quindi sommare e' giusto. I FORMULARI si contano invece con
 * contaFormulari(), che raggruppa per NUMERO di formulario: due quote dello stesso
 * documento sono un documento solo, ed e' l'unico modo di farsi leggere accanto a
 * una stampa del portale, che quel formulario lo elenca una volta. Contarli per ID
 * ordine - come faceva la prima stesura di questo file - dava due formulari su
 * ogni ripartizione, che sull'ACI e' la regola e non l'eccezione.
 *
 * @param movimenti i record dell'archivio (Secondaria, PrimariaAci, ExtraRaccolta...)
 * @param opzioni { anno, mese (1-12), canale, archivio, tipo: 'primaria'|'secondaria' }
 */
export function reportConferimenti(movimenti, { anno, mese, canale, archivio = '', tipo = 'secondaria', filtro = null } = {}) {
  const annoNum = Number(anno);
  const meseNum = Number(mese);
  const settimane = settimaneDelMese(annoNum, meseNum);
  const mm = String(meseNum).padStart(2, '0');
  const daA = { dal: `${annoNum}-${mm}-01`, al: settimane.length ? settimane[settimane.length - 1].al : `${annoNum}-${mm}-31` };

  const perTratta = new Map();
  const righePerTratta = new Map();
  let totaleKg = 0;
  const perSettimana = new Map(settimane.map(s => [s.numero, { kg: 0, righe: 0 }]));

  // I terminati senza fine trasporto si segnalano (regola dell'utente,
  // 22/09/2026), ma solo quelli che POTREBBERO essere di questo mese: la finestra
  // la decide dateDaSegnalare di filtroPeriodo.ts, la stessa che usano la
  // fatturazione passiva e il margine. Senza quella finestra un terminato senza
  // data del 2024 sarebbe comparso identico sotto ogni mese di ogni anno, per
  // sempre: e' l'incidente che filtroPeriodo.ts racconta nel suo commento, e che
  // la prima stesura di questo file aveva rifatto.
  const suoi = (movimenti || []).filter(r => {
    if (!eTerminato(r)) return false;
    if (canale && canaleMovimento(r, archivio) !== canale) return false;
    return !filtro || filtro(r);
  });
  const segnalate = dateDaSegnalare(suoi, annoNum, meseNum - 1);
  const senzaFine = segnalate.senza_fine;

  for (const r of suoi) {
    const giorno = giornoMovimento(r);
    if (!giorno) continue;
    // A decidere se un carico e' del mese sono le settimane, che coprono
    // esattamente i suoi giorni: un secondo controllo sugli estremi direbbe la
    // stessa cosa, e due regole per la stessa domanda prima o poi divergono.
    const n = settimanaDelGiorno(settimane, giorno);
    if (n === null) continue;
    const d = daDoveADove(r, tipo);
    const k = chiaveTratta(d);
    if (!perTratta.has(k)) {
      perTratta.set(k, {
        chiave: k, ...d,
        settimane: Object.fromEntries(settimane.map(s => [s.numero, { kg: 0, righe: 0 }])),
        kg: 0, righe: 0, formulari: 0,
      });
      righePerTratta.set(k, []);
    }
    const riga = perTratta.get(k);
    // I chili si sommano GREZZI e si arrotondano una volta sola alla fine:
    // arrotondando riga per riga, quattro carichi da 10.000,5 kg facevano 40.004
    // dove la fatturazione passiva - che somma e poi arrotonda - dice 40.002, e la
    // quadratura dichiarava uno scarto che non esiste.
    const peso = Number(r.peso_effettivo) || 0;
    riga.settimane[n].kg += peso;
    riga.settimane[n].righe += 1;
    riga.kg += peso;
    riga.righe += 1;
    righePerTratta.get(k).push(r);
    const col = perSettimana.get(n);
    col.kg += peso;
    col.righe += 1;
    totaleKg += peso;
  }

  for (const [k, riga] of perTratta) {
    riga.formulari = contaFormulari(righePerTratta.get(k));
    riga.kg = kg(riga.kg);
    for (const s of settimane) riga.settimane[s.numero].kg = kg(riga.settimane[s.numero].kg);
  }
  for (const [, col] of perSettimana) col.kg = kg(col.kg);
  totaleKg = kg(totaleKg);

  const righe = [...perTratta.values()].sort((a, b) => b.kg - a.kg
    || a.origine.localeCompare(b.origine, 'it')
    || a.destinazione.localeCompare(b.destinazione, 'it'));

  // I totali per destinazione: "i conferimenti nei vari impianti" sono la domanda
  // di partenza, e un impianto puo' ricevere da piu' piazzali e piu' trasportatori.
  const perDestinazione = new Map();
  const righeDest = new Map();
  for (const r of righe) {
    const k = normalizzaRagioneSociale(r.destinazione) || r.destinazione.toLowerCase();
    if (!perDestinazione.has(k)) {
      perDestinazione.set(k, { destinazione: r.destinazione, kg: 0, righe: 0, formulari: 0, tratte: 0 });
      righeDest.set(k, []);
    }
    const d = perDestinazione.get(k);
    d.kg += r.kg; d.righe += r.righe; d.tratte += 1;
    righeDest.get(k).push(...righePerTratta.get(r.chiave));
  }
  // I formulari di un impianto si ricontano sui suoi movimenti, non sommando i
  // conteggi delle tratte: lo stesso formulario ripartito fra due trasportatori
  // conterebbe due volte.
  for (const [k, d] of perDestinazione) d.formulari = contaFormulari(righeDest.get(k));

  return {
    anno: annoNum,
    mese: meseNum,
    canale,
    tipo,
    dal: daA.dal,
    al: daA.al,
    settimane,
    righe,
    per_destinazione: [...perDestinazione.values()].sort((a, b) => b.kg - a.kg),
    totali_settimana: Object.fromEntries([...perSettimana.entries()].map(([n, v]) => [n, v])),
    totale_kg: totaleKg,
    totale_t: t3(totaleKg / 1000),
    totale_righe: righe.reduce((s, r) => s + r.righe, 0),
    // Anche il totale dei formulari si riconta su tutti i movimenti del mese: uno
    // stesso formulario su due tratte e' un documento solo.
    totale_formulari: contaFormulari([...righePerTratta.values()].flat()),
    // I terminati senza la data che potrebbero essere di questo mese: fuori dal
    // conto (senza la data non stanno in nessuna settimana), contati e nominati.
    senza_fine: senzaFine.length,
    senza_fine_kg: senzaFine.reduce((s, v) => s + kg(v.kg), 0),
    senza_fine_ordini: senzaFine.slice(0, 20).map(v => v.ordine || v.numero_fir).filter(Boolean),
  };
}

/**
 * LA QUADRATURA CON LA FATTURAZIONE PASSIVA.
 *
 * Il report dice quanti chili sono arrivati su ogni tratta; la passiva dice quante
 * tonnellate paga su quella stessa tratta. Devono essere gli stessi chili: se non
 * lo sono, o un movimento non ha una tariffa e la passiva lo lascia fuori, o il
 * report conta qualcosa che la passiva non paga. In tutti e due i casi si dice, e
 * NON SI AGGIUSTA NIENTE.
 *
 * Si confrontano i CHILI, non gli euro: gli euro della passiva dipendono anche dai
 * viaggi e dalle tariffe, e un report di conferimenti non li conosce. L'importo
 * della passiva si porta accanto per informazione, con la sua unita' di misura.
 *
 * Attenzione (vale solo per le SECONDARIE): le righe della passiva sono per tratta
 * stoccaggio → destinazione con il suo trasportatore, la stessa chiave del report.
 * Per le PRIMARIE la passiva raggruppa in un altro modo (per provincia, tariffa e
 * destinazione) e una quadratura per tratta non avrebbe senso: li' si confronta il
 * TOTALE del canale, che e' l'unico numero confrontabile senza inventare.
 */
// Un chilo di tolleranza, e non di piu'. Il report somma i chili grezzi e
// arrotonda una volta; la passiva ragiona in tonnellate a tre decimali, quindi il
// suo numero riportato in chili puo' cadere di un'unita'. Tutto quello che supera
// il chilo e' uno scarto vero e va detto.
export const TOLLERANZA_KG = 1;

/**
 * Quando la quadratura per tratta NON si puo' fare, e perche'. Dirlo e' l'unica
 * risposta onesta: un verdetto "non quadra" calcolato su un confronto che non
 * esiste manderebbe a cercare un errore che non c'e'.
 */
export function motivoNonApplicabile(report) {
  if (report.canale === 'EXTRA_RACCOLTA') {
    return report.tipo === 'secondaria'
      ? "La fatturazione passiva non ha un blocco trasporti per l'extra raccolta: il costo del trasporto di una secondaria di extra raccolta non passa dalle tariffe, si scrive sull'intervento, e la passiva lo segnala a parte perche' va verificato a mano. Non c'e' niente con cui quadrare questi chili: non e' uno scarto."
      : "I costi dell'extra raccolta si scrivono sull'intervento, non vengono dalle tariffe, e la passiva li raggruppa per fornitore: un confronto per tratta direbbe differenze che non esistono.";
  }
  if (report.tipo !== 'secondaria') {
    return 'Per le primarie la fatturazione passiva raggruppa per provincia, tariffa e destinazione, non per tratta: un confronto riga per riga direbbe differenze che non esistono. Il conto della passiva non viene nemmeno letto, per non leggere sei archivi interi senza motivo.';
  }
  return '';
}

export function quadraturaPassiva(report, passiva, { tolleranza_kg = TOLLERANZA_KG } = {}) {
  const nonApplicabile = motivoNonApplicabile(report);
  if (nonApplicabile) return { disponibile: false, applicabile: false, motivo: nonApplicabile };
  if (!passiva) return { disponibile: false, motivo: 'Il conto della fatturazione passiva non e\' stato letto.' };

  const righePassiva = [];
  for (const f of passiva.trasporti_secondaria || []) {
    for (const r of f.righe || []) {
      righePassiva.push({
        origine: pulisci(r.stoccaggio), destinazione: pulisci(r.destinazione), trasportatore: pulisci(r.trasportatore),
        kg: Math.round((Number(r.tonnellate) || 0) * 1000),
        importo: Number(r.importo) || 0, unita_misura: r.unita_misura, fornitore: f.fornitore,
      });
    }
  }

  const perChiave = new Map();
  const chiave = (d) => chiaveTratta(d);
  for (const r of righePassiva) {
    const k = chiave(r);
    if (!perChiave.has(k)) perChiave.set(k, { ...r, kg: 0, importo: 0 });
    const v = perChiave.get(k);
    v.kg += r.kg;
    v.importo += r.importo;
  }

  const voci = [];
  const viste = new Set();
  for (const riga of report.righe) {
    const k = riga.chiave;
    viste.add(k);
    const p = perChiave.get(k) || null;
    const kgPassiva = p ? p.kg : null;
    const scarto = p ? riga.kg - p.kg : null;
    voci.push({
      origine: riga.origine, destinazione: riga.destinazione, trasportatore: riga.trasportatore,
      kg_report: riga.kg,
      kg_passiva: kgPassiva,
      scarto_kg: scarto,
      torna: p ? Math.abs(scarto) <= tolleranza_kg : null,
      importo_passiva: p ? Math.round(p.importo * 100) / 100 : null,
      unita_misura: p ? p.unita_misura : null,
      fornitore: p ? p.fornitore : null,
      // Una tratta che il report ha e la passiva no: di solito e' una tratta senza
      // tariffa, e allora nessuno la paga. Va guardata, non nascosta.
      solo_report: !p,
    });
  }
  for (const [k, p] of perChiave) {
    if (viste.has(k)) continue;
    voci.push({
      origine: p.origine, destinazione: p.destinazione, trasportatore: p.trasportatore,
      kg_report: 0, kg_passiva: p.kg, scarto_kg: -p.kg, torna: false,
      importo_passiva: Math.round(p.importo * 100) / 100, unita_misura: p.unita_misura, fornitore: p.fornitore,
      solo_passiva: true,
    });
  }

  const fuori = voci.filter(v => v.torna === false || v.solo_report);
  return {
    disponibile: true,
    applicabile: true,
    voci: voci.sort((a, b) => b.kg_report - a.kg_report),
    quadra: fuori.length === 0,
    n_difformi: fuori.length,
    totale_report_kg: report.totale_kg,
    totale_passiva_kg: [...perChiave.values()].reduce((s, p) => s + p.kg, 0),
    importo_passiva: Math.round([...perChiave.values()].reduce((s, p) => s + p.importo, 0) * 100) / 100,
  };
}

/** "Settimana 37 (7–13 set)": il numero non basta, l'intervallo lo rende certo. */
export function etichettaSettimana(s) {
  const gg = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  return `Settimana ${s.numero} (${gg(s.dal)}–${gg(s.al)})`;
}
