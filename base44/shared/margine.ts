// Il margine della commessa: ricavo (fatturazione attiva) meno costo
// (fatturazione passiva), mese per mese e canale per canale.
//
// Non ha regole sue: il ricavo sono le righe di attivaCalcolo.ts, il costo e'
// calcolaPassivaMese di passivaCalcolo.ts, cioe' gli stessi numeri, al centesimo,
// che si vedono nelle due fatturazioni. Rete, ACI ed extra raccolta sono tre
// commesse: tre margini, mai un totale che li somma.
//
// Avvertenza di lettura: il costo di un mese comprende stoccaggio, trattamento e
// trasporto delle secondarie di QUEL mese, che possono riguardare tonnellate
// raccolte prima. Il margine del singolo mese oscilla per questo; quello
// dell'anno e' il numero che conta.
//
// Un viaggio di secondaria che porta rete e ACI insieme, a prezzo per viaggio,
// pesa su tutti e due i margini, ciascuno per la sua quota dei chili (regola
// dell'utente del 22/09/2026, quoteViaggioMisto in passivaCalcolo.ts): prima
// pesava tutto sulla rete.
//
// Un terminato senza fine trasporto non entra in nessun mese, quindi nemmeno nel
// margine: si dice per canale, una volta per l'anno (senza_fine_trasporto), e
// non fra le anomalie di ogni mese, dove lo stesso ordine si conterebbe dodici
// volte. Sono quelli che la passiva segnala in almeno un mese dell'anno, compresi
// gli immessi a fine dell'anno prima (anomaliaSenzaFineAnno).
//
// IL SURPLUS SULLE TARIFFE (il Fuel Surcharge del consorzio, 13/10/2026). I
// record di SurplusTariffa arrivano in dati.surplusAll e vanno tutti e due i
// calcoli: il ricavo comprende la riga del surplus dell'attiva, il costo quella
// della passiva, quindi ricavo, costo e margine sono gia' quelli veri. Un
// surplus che Ecotyre paga e SMOCO passa ai fornitori non cambia il margine (gli
// stessi €/t incassati e pagati sulle stesse tonnellate); lo cambiano tre cose,
// e ciascuna si dice: le tonnellate di un interno (SMOCO), su cui il surplus si
// incassa e non si paga a nessuno; importi diversi fra attiva e passiva (un
// accordo commerciale); un surplus solo passivo o solo attivo. Sui dati veri,
// con le tonnellate di settembre 2026 come esempio di un mese del Fuel
// Surcharge: +1.268,40 € sulla rete (253,68 t raccolte da SMOCO x 5 €/t) e
// +24,50 € sull'ACI. La riga del surplus non e' un ordine: ordini e tonnellate
// si contano sulle righe dei formulari (eRigaDiMovimento).
//
// LA RACCOLTA DI SMOCO E DEGLI ESTERNI (16/10/2026). SMOCO e' un fornitore
// interno: a se stessi non si fattura, e nella passiva le tonnellate che
// raccoglie coi suoi mezzi costano zero. Sul margine vero va bene cosi' (e' la
// fatturazione), ma su quelle tonnellate il margine e' piu' alto del vero: il
// costo di SMOCO come raccoglitore lo valuta un altro ufficio, coi costi
// diretti e indiretti, e il gestionale non lo ha. L'utente ha chiesto di
// simularlo nella scheda Margine, scritto a mano, senza che entri in nessun
// conto. Alla simulazione servono due numeri veri, che il calcolo ha gia' in
// mano mese per mese (l'oggetto della passiva qui sotto), quindi nessuna
// lettura in piu' e nessuna scrittura: le tonnellate di SMOCO, comprese quelle
// di chi raccoglie per lui nella catena dei subfornitori (fattura tramite
// SMOCO, e il costo scritto le comprende: si dicono col nome nei di_cui), e la
// media per tonnellata dei raccoglitori esterni dello stesso canale e dello
// stesso periodo, per dire se a quel costo conviene raccogliere da se' o
// affidare. Dalla media restano fuori due tipi di righe: il prezzo unico (la
// tariffa comprende anche il trattamento, Green Tyre sull'ACI a 225 €/t, e non
// e' sola raccolta) e le righe senza un prezzo, che hanno importo zero e la
// abbasserebbero (un valore mancante non e' zero). Il surplus pagato agli
// esterni si dice a parte: e' per fornitore e non per riga, e la media e' sulle
// tariffe di contratto. Anche i viaggi di secondarie che SMOCO fa da se' e gli
// stoccaggi interni costano zero: la simulazione non li tocca, ma li dice.
// Sono il campo `raccolta` di ogni mese e dell'anno (raccoltaDelMese,
// raccoltaDellAnno); nessun altro campo cambia.
import { calcolaRigheAttiva, eRigaDiMovimento, eRigaSurplus, TIPOLOGIE_ATTIVA } from "./attivaCalcolo.ts";
import { calcolaPassivaMese, movimentiDateDelCanale } from "./passivaCalcolo.ts";
import { anomaliaSenzaFineAnno } from "./filtroPeriodo.ts";
import { testoEuroT, euroTDi } from "./surplus.ts";
import { formatoTonnellate } from "./formato.ts";

export const MESI_MARGINE = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
const r3 = (v) => Math.round((v + Number.EPSILON) * 1000) / 1000;
// Gli euro di una frase, all'italiana.
const euroIt = (v) => {
  const n = r2(Number(v) || 0);
  const [intero, dec] = Math.abs(n).toFixed(2).split('.');
  return (n < 0 ? '-' : '') + intero.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + dec;
};

// UN MARGINE CON PREZZI MANCANTI NON E' UN NUMERO (prova del cambio d'anno,
// 15/10/2026). Il 15/01/2027, senza le tariffe 2027, la rete faceva ricavo 0,
// costo 0, margine «€ 0,00 · nessun ricavo · 7,10 t», e l'extra raccolta, con un
// intervento senza prezzo, «€ -113,50 · -77,2% del ricavo»: un margine fatto da
// un ricavo che manca. Gli avvisi c'erano solo nelle righe della tabella. Ora
// ogni mese e l'anno portano prezzi_mancanti, le righe senza un prezzo:
// righe_senza_prezzo (le righe dell'attiva in errore) piu' passive_senza_tariffa
// (le anomalie «senza tariffa» della passiva). Con prezzi_mancanti > 0 margine,
// margine_pct e gli €/t sono null («—» nelle pagine, col perche'), mentre ricavo
// e costo restano, con `parziale` a dire che sono una parte. Un valore mancante
// non e' zero. «Nessun ricavo» resta per un periodo senza tonnellate.
// Le parole stanno nel dato (testo_prezzi_mancanti, testo_da_confermare): le
// pagine non importano da base44/shared, e la scheda, la dashboard e il PDF
// della settimana dicono cosi' la stessa frase.
function chiudi(x, anno = null) {
  const parziale = (Number(x.prezzi_mancanti) || 0) > 0;
  const margine = parziale ? null : r2(x.ricavo - x.costo);
  return {
    ...x,
    testo_prezzi_mancanti: testoPrezziMancanti(x),
    testo_da_confermare: testoDaConfermare(x, anno),
    tonnellate: r3(x.tonnellate), ricavo: r2(x.ricavo), costo: r2(x.costo),
    costo_raccolta: r2(x.costo_raccolta), costo_impianti: r2(x.costo_impianti), costo_trasporti: r2(x.costo_trasporti),
    ricavo_surplus: r2(x.ricavo_surplus || 0), costo_surplus: r2(x.costo_surplus || 0),
    surplus_netto: r2((x.ricavo_surplus || 0) - (x.costo_surplus || 0)),
    tonnellate_surplus_interni: r3(x.tonnellate_surplus_interni || 0),
    parziale,
    margine,
    margine_pct: !parziale && x.ricavo ? Math.round((margine / x.ricavo) * 1000) / 10 : null,
    ricavo_t: !parziale && x.tonnellate ? r2(x.ricavo / x.tonnellate) : null,
    costo_t: !parziale && x.tonnellate ? r2(x.costo / x.tonnellate) : null,
    margine_t: !parziale && x.tonnellate ? r2(margine / x.tonnellate) : null,
  };
}

/**
 * Le parole dei prezzi che mancano in un mese o nell'anno di un canale, per le
 * pagine e il PDF: «3 righe senza prezzo (3 dell'attiva): margine non
 * calcolabile». '' se non ne mancano. Le righe con una tariffa copiata
 * dall'anno prima e non confermata si dicono a parte (testoDaConfermare).
 */
export function testoPrezziMancanti(x) {
  const n = Number(x && x.prezzi_mancanti) || 0;
  if (!(n > 0)) return '';
  const att = Number(x.righe_senza_prezzo) || 0;
  const pas = Number(x.passive_senza_tariffa) || 0;
  const dove = [att ? `${att} dell'attiva` : '', pas ? `${pas} della passiva` : ''].filter(Boolean).join(', ');
  return `${n} ${n === 1 ? 'riga' : 'righe'} senza prezzo${dove ? ` (${dove})` : ''}: margine non calcolabile`;
}

/**
 * Le righe prezzate con una tariffa copiata dall'anno prima e non ancora
 * confermata (CA3-1 della prova del cambio d'anno, 15/10/2026). Per D4,
 * decisione dell'utente del 15/10/2026, una riga cosi' ferma un documento come
 * una riga senza prezzo, e la conferma e' in Target & Status › Nuovo anno: qui
 * si conta e si dice, ma il margine non diventa «—» (il prezzo c'e', e' da
 * confermare). '' senza.
 */
export function testoDaConfermare(x, anno) {
  const n = Number(x && x.righe_da_confermare) || 0;
  if (!(n > 0)) return '';
  const prima = Number(anno) ? ` dal ${Number(anno) - 1}` : " dall'anno prima";
  return `${n} ${n === 1 ? 'riga' : 'righe'} con la tariffa copiata${prima}, da confermare in Target & Status › Nuovo anno`;
}

// Le anomalie della passiva che sono una tariffa che manca: «Raccoglitore senza
// tariffa RACCOLTA: ...», «Impianto/stoccaggio senza tariffa ...», «Tratta
// secondaria senza tariffa ...», e il trasferimento di extra raccolta la cui
// tratta «non ha una tariffa» (non viene pagato a nessuno). Le altre (una stima
// ACI sotto i 1.500 kg, le date) restano anomalie e non toccano il margine.
const eSenzaTariffa = (a) => !!a && a.tipo !== 'tariffa_da_confermare' && /senza tariffa|la tratta non ha una tariffa/i.test(String(a.descrizione || ''));
const eDaConfermare = (a) => !!a && a.tipo === 'tariffa_da_confermare';
// Le righe con la tariffa da confermare: un'anomalia puo' riassumerne piu' d'una
// (`quanti`, come fa il calcolo dell'attiva: una per canale), altrimenti e' una.
const righeDaConfermare = (anomalie) => (anomalie || []).filter(eDaConfermare)
  .reduce((s, a) => s + (Number(a.quanti) > 0 ? Number(a.quanti) : 1), 0);

// Perche' un surplus cambia il margine, in parole: una frase per ragione.
function perche(v) {
  const frasi = [];
  const att = v.euro_t_attiva, pas = v.euro_t_passiva;
  if (v.incassato > 0 && v.tonnellate_interni > 0) {
    const chi = v.interni.length ? v.interni.join(', ') : 'SMOCO';
    const come = { RACCOLTA: 'raccolte da', TRATTAMENTO: 'trattate da', CONFERIMENTO_STOCCAGGIO: 'stoccate da' }[v.prestazione] || 'di';
    frasi.push(`sulle ${formatoTonnellate(v.tonnellate_interni)} t ${come} ${chi}, interno, si incassa e non si paga a nessuno`);
  }
  if (att !== null && pas !== null && Math.abs(att - pas) > 0.0005) frasi.push(`importi diversi: ${testoEuroT(att)} da Ecotyre, ${testoEuroT(pas)} ai fornitori`);
  if (att === null && pas !== null) frasi.push('solo ai fornitori: Ecotyre non lo paga');
  if (pas === null && att !== null) frasi.push('solo da Ecotyre: ai fornitori non si paga');
  return frasi;
}

// La riga della scheda: «Fuel Surcharge: incassato 5.601,20 € · pagato 4.332,80 € ·
// resta 1.268,40 € · sulle 253,68 t raccolte da SMOCO S.R.L., interno, ...».
const testoSurplus = (x) => [`${x.nome}: incassato ${euroIt(x.incassato)} €`, `pagato ${euroIt(x.pagato)} €`, `resta ${euroIt(x.resta)} €`, ...x.perche].join(' · ');

// I surplus di un mese e di un canale, uno per record: quanto si incassa
// (attiva), quanto si paga (passiva), quanto resta e perche'. Si uniscono per
// id: un record di SurplusTariffa ha la sua parte attiva e la sua parte passiva,
// e i due importi si leggono dal record (recordPerId), non da quale dei due
// calcoli ha una riga: un surplus e' «solo passivo» perche' il record non ha
// l'importo da Ecotyre, non perche' l'attiva del mese e' vuota.
function surplusDelMeseMargine(attivi, passivi, recordPerId = new Map()) {
  const perId = new Map();
  const voce = (id, s) => {
    if (!perId.has(id)) {
      const record = recordPerId.get(id);
      perId.set(id, {
        surplus_id: id, gruppo: s.gruppo || '', nome: s.nome || 'Surplus', origine: s.origine || '', prestazione: s.prestazione || '',
        dal: s.dal || '', al: s.al || '',
        euro_t_attiva: record ? euroTDi(record, 'ATTIVA') : null, euro_t_passiva: record ? euroTDi(record, 'PASSIVA') : null,
        incassato: 0, tonnellate_incassate: 0, pagato: 0, tonnellate_pagate: 0, tonnellate_interni: 0, interni: [],
      });
    }
    return perId.get(id);
  };
  for (const a of attivi || []) {
    const v = voce(String(a.surplus_id || a.nome), a);
    if (v.euro_t_attiva === null) v.euro_t_attiva = a.euro_t ?? null;
    v.incassato += Number(a.totale) || 0;
    v.tonnellate_incassate += (Number(a.kg) || 0) / 1000;
  }
  for (const p of passivi || []) {
    const v = voce(String(p.surplus_id || p.nome), p);
    if (v.euro_t_passiva === null && p.euro_t !== null && p.euro_t !== undefined) v.euro_t_passiva = p.euro_t;
    v.pagato += Number(p.importo) || 0;
    v.tonnellate_pagate += Number(p.tonnellate_pagate) || 0;
    v.tonnellate_interni += Number(p.tonnellate_interni) || 0;
    for (const i of p.interni || []) if (i && i.fornitore && !v.interni.includes(i.fornitore)) v.interni.push(i.fornitore);
    if (!v.prestazione) v.prestazione = p.prestazione || '';
  }
  return [...perId.values()]
    .filter(v => v.incassato || v.pagato)
    .map(v => {
      const x = {
        ...v,
        incassato: r2(v.incassato), pagato: r2(v.pagato), resta: r2(v.incassato - v.pagato),
        tonnellate_incassate: r3(v.tonnellate_incassate), tonnellate_pagate: r3(v.tonnellate_pagate), tonnellate_interni: r3(v.tonnellate_interni),
      };
      x.perche = perche(x);
      x.testo = testoSurplus(x);
      return x;
    })
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'it') || String(a.dal).localeCompare(String(b.dal)));
}

// Le tonnellate di un interno su cui il surplus si incassa e non si paga: dei
// soli surplus con la parte attiva, una volta per prestazione (due surplus sulla
// stessa prestazione sono sulle stesse tonnellate di SMOCO, e non si contano due
// volte).
function tonnellateTrattenute(voci) {
  const perPrestazione = new Map();
  for (const v of voci) {
    if (!(v.incassato > 0)) continue;
    const k = v.prestazione || '';
    perPrestazione.set(k, Math.max(perPrestazione.get(k) || 0, v.tonnellate_interni || 0));
  }
  return [...perPrestazione.values()].reduce((s, t) => s + t, 0);
}

// LA RACCOLTA DI SMOCO E DEGLI ESTERNI (16/10/2026, vedi in testa). Le unita'
// con cui la passiva sa fare un importo: una riga esterna con un'altra unita',
// o con un valore non positivo, e' senza prezzo e non entra nella media.
const UNITA_CON_PREZZO = ['€/t', '€/kg', '€/viaggio'];
const perTonnellate = (a, b) => b.tonnellate - a.tonnellate || String(a.fornitore).localeCompare(String(b.fornitore), 'it');

/**
 * Le tonnellate di SMOCO (gli interni) e la media dei raccoglitori esterni di
 * un mese e di un canale, dall'oggetto della passiva che il margine ha gia'
 * (calcolaPassivaMese): nessuna lettura in piu'. Tre classi di righe esterne,
 * in quest'ordine: prezzo unico (la tariffa scelta, tariffa_id, comprende il
 * trattamento), senza prezzo (unita' non letta o valore <= 0), paragonabile.
 * La media e' solo sulle paragonabili, senza il surplus, che si dice a parte.
 */
function raccoltaDelMese(costo, tariffePassivePerId) {
  let tInterni = 0, tEsterni = 0, eEsterni = 0, tUnico = 0, eUnico = 0, tSenza = 0, surplus = 0;
  const interni = [], esterni = [];
  for (const f of (costo && costo.raccoglitori) || []) {
    if (f.interno === true) {
      const t = Number(f.totale_tonnellate) || 0;
      tInterni += t;
      interni.push({
        fornitore: f.fornitore, tonnellate: r3(t),
        di_cui: (f.di_cui || []).map(d => ({ fornitore: d.fornitore, tonnellate: r3(Number(d.tonnellate) || 0) })).sort(perTonnellate),
      });
      continue;
    }
    surplus += Number(f.totale_surplus) || 0;
    let t = 0, e = 0, paragonabili = 0;
    for (const riga of f.righe || []) {
      const tr = Number(riga.tonnellate) || 0, imp = Number(riga.importo) || 0;
      const tariffa = tariffePassivePerId.get(String(riga.tariffa_id));
      if (tariffa && tariffa.comprensiva_trattamento === true) { tUnico += tr; eUnico += imp; continue; }
      if (!UNITA_CON_PREZZO.includes(String(riga.unita_misura || '').trim()) || !(Number(riga.tariffa_valore) > 0)) { tSenza += tr; continue; }
      t += tr; e += imp; paragonabili++;
    }
    if (!paragonabili) continue;
    tEsterni += t; eEsterni += e;
    const tt = r3(t), ee = r2(e);
    esterni.push({ fornitore: f.fornitore, tonnellate: tt, euro: ee, euro_t: tt > 0 ? r2(ee / tt) : null });
  }
  let tSec = 0, viaggiSec = 0, tImp = 0;
  for (const f of (costo && costo.trasporti_secondaria) || []) {
    if (f.interno !== true) continue;
    tSec += Number(f.totale_tonnellate) || 0;
    viaggiSec += (f.righe || []).reduce((s, r) => s + (Number(r.viaggi) || 0), 0);
  }
  for (const f of (costo && costo.impianti_stoccaggi) || []) if (f.interno === true) tImp += Number(f.totale_tonnellate) || 0;
  const tonnellate_esterni = r3(tEsterni), euro_esterni = r2(eEsterni);
  return {
    tonnellate_interni: r3(tInterni),
    interni: interni.sort(perTonnellate),
    tonnellate_esterni, euro_esterni,
    euro_t_esterni: tonnellate_esterni > 0 ? r2(euro_esterni / tonnellate_esterni) : null,
    esterni: esterni.sort(perTonnellate),
    tonnellate_prezzo_unico: r3(tUnico), euro_prezzo_unico: r2(eUnico),
    tonnellate_senza_prezzo: r3(tSenza),
    surplus_esterni: r2(surplus),
    secondarie_interni: { tonnellate: r3(tSec), viaggi: r2(viaggiSec) },
    impianti_interni: { tonnellate: r3(tImp) },
  };
}

/**
 * La raccolta dell'anno: la somma dei mesi calcolati, con le liste unite per
 * fornitore. Gli €/t si rifanno dalle somme, mai come media delle medie: un
 * mese con poche tonnellate non deve pesare quanto uno pieno.
 */
function raccoltaDellAnno(mesi) {
  const somma = (f) => mesi.reduce((s, x) => s + (Number(f(x.raccolta || {})) || 0), 0);
  const interni = new Map(), esterni = new Map();
  for (const x of mesi) {
    const r = x.raccolta || {};
    for (const i of r.interni || []) {
      const v = interni.get(i.fornitore) || { fornitore: i.fornitore, tonnellate: 0, di_cui: new Map() };
      v.tonnellate += i.tonnellate;
      for (const d of i.di_cui || []) v.di_cui.set(d.fornitore, (v.di_cui.get(d.fornitore) || 0) + d.tonnellate);
      interni.set(i.fornitore, v);
    }
    for (const e of r.esterni || []) {
      const v = esterni.get(e.fornitore) || { fornitore: e.fornitore, tonnellate: 0, euro: 0 };
      v.tonnellate += e.tonnellate; v.euro += e.euro;
      esterni.set(e.fornitore, v);
    }
  }
  const tonnellate_esterni = r3(somma(r => r.tonnellate_esterni)), euro_esterni = r2(somma(r => r.euro_esterni));
  return {
    tonnellate_interni: r3(somma(r => r.tonnellate_interni)),
    interni: [...interni.values()].map(v => ({
      fornitore: v.fornitore, tonnellate: r3(v.tonnellate),
      di_cui: [...v.di_cui.entries()].map(([fornitore, t]) => ({ fornitore, tonnellate: r3(t) })).sort(perTonnellate),
    })).sort(perTonnellate),
    tonnellate_esterni, euro_esterni,
    euro_t_esterni: tonnellate_esterni > 0 ? r2(euro_esterni / tonnellate_esterni) : null,
    esterni: [...esterni.values()].map(v => {
      const t = r3(v.tonnellate), e = r2(v.euro);
      return { fornitore: v.fornitore, tonnellate: t, euro: e, euro_t: t > 0 ? r2(e / t) : null };
    }).sort(perTonnellate),
    tonnellate_prezzo_unico: r3(somma(r => r.tonnellate_prezzo_unico)), euro_prezzo_unico: r2(somma(r => r.euro_prezzo_unico)),
    tonnellate_senza_prezzo: r3(somma(r => r.tonnellate_senza_prezzo)),
    surplus_esterni: r2(somma(r => r.surplus_esterni)),
    secondarie_interni: { tonnellate: r3(somma(r => r.secondarie_interni && r.secondarie_interni.tonnellate)), viaggi: r2(somma(r => r.secondarie_interni && r.secondarie_interni.viaggi)) },
    impianti_interni: { tonnellate: r3(somma(r => r.impianti_interni && r.impianti_interni.tonnellate)) },
  };
}

/**
 * dati: { reteAll, aciAll, extraAll, secondarieAll, fornitori, tariffe, surplusAll } letti una volta sola.
 * surplusAll: i record di SurplusTariffa, tutti (facoltativo: senza, i numeri
 * sono quelli di prima del surplus).
 * finoAlMese: indice 0-11 dell'ultimo mese da calcolare.
 */
export function calcolaMargineAnno(dati, anno, finoAlMese = 11) {
  const annoNum = Number(anno);
  const tariffeAttive = (dati.tariffe || []).filter(t => t.direzione === 'ATTIVA');
  const surplusAll = dati.surplusAll || dati.surplus || [];
  const recordPerId = new Map(surplusAll.filter(s => s && s.id).map(s => [String(s.id), s]));
  const passiva = {
    primarieRete: dati.reteAll, primarieAci: dati.aciAll, secondarieAll: dati.secondarieAll, extraRaccoltaAll: dati.extraAll,
    tariffeAll: (dati.tariffe || []).filter(t => t.direzione === 'PASSIVA'),
    fornitoriAll: (dati.fornitori || []).filter(f => f.stato === 'attivo'),
    surplusAll,
  };
  // le tariffe passive per id, una volta per chiamata: dicono quale riga della
  // raccolta e' a prezzo unico (raccoltaDelMese, 16/10/2026)
  const tariffePassivePerId = new Map(passiva.tariffeAll.filter(t => t && t.id).map(t => [String(t.id), t]));
  const canali = Object.fromEntries(TIPOLOGIE_ATTIVA.map(c => [c, { canale: c, mesi: [], senza_fine_trasporto: null }]));

  for (let m = 0; m <= Math.min(11, finoAlMese); m++) {
    const mese = MESI_MARGINE[m];
    const attiva = calcolaRigheAttiva({ reteAll: dati.reteAll, aciAll: dati.aciAll, extraAll: dati.extraAll, fornitori: dati.fornitori, tariffe: tariffeAttive, anno: annoNum, mese, surplus: surplusAll });
    for (const canale of TIPOLOGIE_ATTIVA) {
      const righe = attiva.righe[canale];
      const movimenti = righe.filter(eRigaDiMovimento);
      const costo = calcolaPassivaMese(passiva, annoNum, m, mese, canale);
      const surplus = surplusDelMeseMargine((attiva.surplus_del_mese || {})[canale], costo.surplus_del_mese, recordPerId);
      canali[canale].mesi.push(chiudi({
        mese,
        tonnellate: movimenti.reduce((s, r) => s + r.quantita, 0) / 1000,
        ordini: movimenti.length,
        ricavo: righe.reduce((s, r) => s + r.totale, 0),
        costo: costo.totali.totale_complessivo,
        costo_raccolta: costo.totali.raccoglitori,
        costo_impianti: costo.totali.impianti_stoccaggi,
        costo_trasporti: costo.totali.trasporti_secondaria,
        // il surplus del mese: gia' dentro ricavo e costo, qui detto a parte
        ricavo_surplus: righe.filter(eRigaSurplus).reduce((s, r) => s + r.totale, 0),
        costo_surplus: (costo.totali.surplus && Number(costo.totali.surplus.totale)) || 0,
        tonnellate_surplus_interni: tonnellateTrattenute(surplus),
        surplus,
        // le tonnellate di SMOCO e la media degli esterni, per la simulazione
        // della scheda (16/10/2026): dallo stesso oggetto, nessuna lettura in piu'
        raccolta: raccoltaDelMese(costo, tariffePassivePerId),
        // un ricavo o un costo calcolato con un prezzo mancante e' un margine falso: si dice
        righe_senza_prezzo: righe.filter(r => r.stato_validazione === 'errore').length,
        // e dal 15/10/2026 non si mostra: le righe della passiva senza tariffa e il
        // totale dei prezzi che mancano, che fa il margine null (chiudi)
        passive_senza_tariffa: (costo.anomalie || []).filter(eSenzaTariffa).length,
        prezzi_mancanti: righe.filter(r => r.stato_validazione === 'errore').length + (costo.anomalie || []).filter(eSenzaTariffa).length,
        // le righe con la tariffa copiata dall'anno prima e non confermata, dove
        // il calcolo dell'attiva e quello della passiva le segnano (CA3-1, 15/10/2026):
        // finche' i due calcoli non le hanno, zero. L'anomalia dell'attiva e' una
        // per canale e porta in `quanti` le righe: si contano le righe.
        righe_da_confermare: righeDaConfermare((attiva.anomalie || []).filter(a => a && a.tipologia === canale))
          + righeDaConfermare(costo.anomalie),
        // senza i terminati senza fine trasporto, che si dicono una volta per l'anno
        anomalie_passiva: (costo.anomalie || []).filter(a => a.tipo !== 'date_senza_fine').length,
      }, annoNum));
    }
  }

  // I terminati senza fine trasporto dell'anno fin qui, ciascuno una volta: gli
  // stessi ordini che la passiva segnala mese per mese, primarie e secondarie del
  // canale (il suo elenco comprende quello dell'attiva). Prima si prendevano
  // quelli dell'ultimo mese calcolato, che bastava finche' un senza fine si
  // segnalava solo nell'anno di immissione. Dal 22/09/2026 un ordine immesso a
  // dicembre dell'anno prima si segnala solo nei primi mesi, e l'ultimo mese
  // calcolato (per esempio settembre) non lo vedrebbe.
  for (const canale of TIPOLOGIE_ATTIVA) {
    const s = anomaliaSenzaFineAnno(movimentiDateDelCanale(passiva, canale), annoNum, Math.min(11, finoAlMese), canale);
    canali[canale].senza_fine_trasporto = s ? { quanti: s.quanti, tonnellate: r3(s.kg / 1000), descrizione: s.descrizione } : null;
  }

  for (const canale of TIPOLOGIE_ATTIVA) {
    const somma = (campo) => canali[canale].mesi.reduce((s, x) => s + (x[campo] || 0), 0);
    // I surplus dell'anno, uno per record: i mesi in cui ha valso, sommati.
    const perId = new Map();
    for (const x of canali[canale].mesi) {
      for (const v of x.surplus || []) {
        const e = perId.get(v.surplus_id) || { ...v, incassato: 0, pagato: 0, tonnellate_incassate: 0, tonnellate_pagate: 0, tonnellate_interni: 0, interni: [], mesi: [] };
        e.incassato += v.incassato; e.pagato += v.pagato;
        e.tonnellate_incassate += v.tonnellate_incassate; e.tonnellate_pagate += v.tonnellate_pagate; e.tonnellate_interni += v.tonnellate_interni;
        for (const i of v.interni || []) if (!e.interni.includes(i)) e.interni.push(i);
        e.mesi.push(x.mese);
        perId.set(v.surplus_id, e);
      }
    }
    const surplusAnno = [...perId.values()].map(e => {
      const x = { ...e, incassato: r2(e.incassato), pagato: r2(e.pagato), resta: r2(e.incassato - e.pagato), tonnellate_incassate: r3(e.tonnellate_incassate), tonnellate_pagate: r3(e.tonnellate_pagate), tonnellate_interni: r3(e.tonnellate_interni) };
      x.perche = perche(x);
      x.testo = testoSurplus(x);
      return x;
    });
    canali[canale].anno = chiudi({
      mese: 'Anno',
      tonnellate: somma('tonnellate'), ordini: somma('ordini'), ricavo: somma('ricavo'), costo: somma('costo'),
      costo_raccolta: somma('costo_raccolta'), costo_impianti: somma('costo_impianti'), costo_trasporti: somma('costo_trasporti'),
      ricavo_surplus: somma('ricavo_surplus'), costo_surplus: somma('costo_surplus'), tonnellate_surplus_interni: somma('tonnellate_surplus_interni'),
      surplus: surplusAnno,
      raccolta: raccoltaDellAnno(canali[canale].mesi),
      righe_senza_prezzo: somma('righe_senza_prezzo'), anomalie_passiva: somma('anomalie_passiva'),
      // un mese con prezzi mancanti fa l'anno senza margine (15/10/2026)
      passive_senza_tariffa: somma('passive_senza_tariffa'), prezzi_mancanti: somma('prezzi_mancanti'),
      righe_da_confermare: somma('righe_da_confermare'),
    }, annoNum);
  }
  return { anno: annoNum, canali: TIPOLOGIE_ATTIVA.map(c => canali[c]) };
}
