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

function chiudi(x) {
  const margine = r2(x.ricavo - x.costo);
  return {
    ...x,
    tonnellate: r3(x.tonnellate), ricavo: r2(x.ricavo), costo: r2(x.costo),
    costo_raccolta: r2(x.costo_raccolta), costo_impianti: r2(x.costo_impianti), costo_trasporti: r2(x.costo_trasporti),
    ricavo_surplus: r2(x.ricavo_surplus || 0), costo_surplus: r2(x.costo_surplus || 0),
    surplus_netto: r2((x.ricavo_surplus || 0) - (x.costo_surplus || 0)),
    tonnellate_surplus_interni: r3(x.tonnellate_surplus_interni || 0),
    margine,
    margine_pct: x.ricavo ? Math.round((margine / x.ricavo) * 1000) / 10 : null,
    ricavo_t: x.tonnellate ? r2(x.ricavo / x.tonnellate) : null,
    costo_t: x.tonnellate ? r2(x.costo / x.tonnellate) : null,
    margine_t: x.tonnellate ? r2(margine / x.tonnellate) : null,
  };
}

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
        // un ricavo o un costo calcolato con un prezzo mancante e' un margine falso: si dice
        righe_senza_prezzo: righe.filter(r => r.stato_validazione === 'errore').length,
        // senza i terminati senza fine trasporto, che si dicono una volta per l'anno
        anomalie_passiva: (costo.anomalie || []).filter(a => a.tipo !== 'date_senza_fine').length,
      }));
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
      righe_senza_prezzo: somma('righe_senza_prezzo'), anomalie_passiva: somma('anomalie_passiva'),
    });
  }
  return { anno: annoNum, canali: TIPOLOGIE_ATTIVA.map(c => canali[c]) };
}
