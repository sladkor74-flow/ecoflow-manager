// I numeri del gestionale per la quadratura settimanale dei formulari.
//
// Si leggono come nel modulo Report Mensile: stato terminato e fine trasporto
// dentro la settimana, peso sempre effettivo. Di ogni cella - impianto di
// destinazione e trasportatore - si tiene il conteggio, il peso e l'elenco dei
// formulari con il loro ID ordine, che e' quello che serve per capire da dove
// viene uno scostamento.
//
// Oltre alla settimana si guarda una fascia di quattro giorni prima e dopo: un
// formulario che a portale cade nella settimana e nel gestionale no si spiega
// quasi sempre con una fine trasporto a cavallo del lunedi' o della domenica.
//
// Il giorno di un movimento e' quello italiano della fine trasporto
// (giornoMovimento), come in tutto il gestionale: tagliando la stringa UTC un
// trasporto finito a mezzanotte italiana del lunedi' (22:00Z della domenica)
// cadeva nella settimana prima. Un terminato senza fine trasporto non ha
// settimana: non si conta, e l'esito lo dice flusso per flusso.
//
// Immissione, inizio e fine trasporto sono obbligatorie nei formulari (regola
// dell'utente del 22/09/2026, per ogni modulo dove ci sono ordini terminati):
// oltre ai senza fine trasporto, l'esito dice flusso per flusso - quindi canale
// per canale - i formulari della settimana a cui manca l'immissione o l'inizio
// del trasporto, o che hanno le date incoerenti. Quelli si contano, perche' la
// fine trasporto c'e', ma le date vanno inserite o corrette.
//
// Qui sta anche il riconfronto di una quadratura gia' fatta con i movimenti di
// adesso (rifaiQuadratura): l'esito salvato il giorno della stampa non si
// aggiornava piu', e i formulari caricati dopo restavano "mancanti nel
// gestionale" finche' qualcuno non premeva il pulsante.

import { fetchAll, perPagina } from "./fetchAll.ts";
import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";
import { ticketDi } from "./formulari.ts";
import { eAci } from "./canaleSecondaria.ts";
import { eTerminato, giornoMovimento, dateDaSistemare, testoDate } from "./movimenti.ts";
import { statoCaricamenti } from "./reportSettimanali.ts";
import { FLUSSI, ORDINE_FLUSSI, normalizzaLettura, confronta, sintesi } from "./quadraturaFir.ts";
import { valoreCampo, leggiCampo, leggiJson } from "./testoLungo.ts";

export const GIORNI_FASCIA = 4;

// I flussi che il gestionale sa contare, con l'entita' da cui si leggono.
//
// Le secondarie stanno tutte nello stesso archivio, come nel file del portale:
// quelle dell'autodemolizione si riconoscono dalla classe e vanno contate a
// parte, perche' ACI e rete sono canali indipendenti.
export const FLUSSI_DATI = [
  { chiave: 'rete_primarie', entita: 'PrimariaRete', movimento: null, caricamenti: ['primarie_rete', 'primarie'] },
  { chiave: 'rete_secondarie', entita: 'Secondaria', movimento: null, canale: 'RETE', caricamenti: ['secondarie'] },
  { chiave: 'aci_primarie', entita: 'PrimariaAci', movimento: null, caricamenti: ['primarie_aci', 'primarie'] },
  { chiave: 'aci_secondarie', entita: 'Secondaria', movimento: null, canale: 'ACI', caricamenti: ['secondarie'] },
  { chiave: 'extra_primarie', entita: 'ExtraRaccolta', movimento: 'primaria', caricamenti: ['extra_raccolta'] },
  { chiave: 'extra_secondarie', entita: 'ExtraRaccolta', movimento: 'secondaria', caricamenti: ['extra_raccolta'] },
];

function utc(ymd) {
  return new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)));
}

function piuGiorni(ymd, giorni) {
  const d = utc(ymd);
  d.setUTCDate(d.getUTCDate() + giorni);
  return d.toISOString().slice(0, 10);
}

const nome = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

// I tipi di file da cui vengono i flussi: dicono quando il gestionale e' stato
// aggiornato e se un archivio si sta riscrivendo proprio adesso.
export const TIPI_CARICAMENTO = [...new Set(FLUSSI_DATI.flatMap(f => f.caricamenti))];

function chiaveCella(r) {
  return normalizzaRagioneSociale(r.destinazione) + '|' + normalizzaRagioneSociale(r.trasportatore);
}

/**
 * I movimenti con la fine trasporto dentro la fascia, chiesti direttamente
 * all'archivio: sono una manciata, e rileggere per intero le primarie - oltre
 * diecimila record - per guardare una settimana costa un minuto di attesa.
 *
 * Se il filtro per intervallo non restituisce niente si rilegge tutto e si
 * filtra qui: meglio lento che dire che non ci sono movimenti quando ci sono.
 *
 * L'archivio confronta istanti UTC, il gestionale ragiona sul giorno italiano:
 * la mezzanotte italiana del primo giorno e' ancora il giorno prima in UTC
 * (22:00Z d'estate), quindi si chiede un giorno in piu' e il taglio vero lo fa
 * il giorno italiano, in caricaGestionale.
 */
async function nellaFascia(svc, entita, primo, ultimo) {
  const filtro = { trasporto_finito_il: { $gte: piuGiorni(primo, -1), $lte: ultimo + 'T23:59:59.999Z' } };
  try {
    const righe = await fetchAll(svc[entita], filtro, 'id');
    if (righe.length) return righe;
  } catch (e) {
    // filtro non accettato: si passa alla lettura completa
  }
  const tutte = [];
  await perPagina(svc[entita], null, (r) => {
    const d = giornoMovimento(r);
    if (d && d >= primo && d <= ultimo) tutte.push(r);
  });
  return tutte;
}

/**
 * I movimenti senza fine trasporto, chiesti all'archivio con un filtro a parte:
 * la lettura per intervallo non li restituisce mai. Il filtro su un campo vuoto
 * riporta anche gli ordini ancora aperti o annullati, che si scartano dopo. Se
 * l'archivio non accetta il filtro si restituisce null: il conteggio non si e'
 * potuto fare, e lo si dice invece di scrivere zero.
 */
async function senzaFineTrasporto(svc, entita) {
  try {
    return await fetchAll(svc[entita], { trasporto_finito_il: null }, 'id');
  } catch (e) {
    return null;
  }
}

function formulario(r) {
  return {
    fir: nome(r.numero_fir),
    ordine: nome(r.id_ordine),
    // Il ticket distingue le quote di un formulario chiuso su piu' ordini: e'
    // quello che rende il conto leggibile invece che sospetto.
    ticket: ticketDi(r),
    kg: Math.round(Number(r.peso_effettivo) || 0),
    data: giornoMovimento(r) || null,
    impianto: nome(r.destinazione),
    trasportatore: nome(r.trasportatore),
  };
}

// I formulari contati una volta sola. La stampa del portale elenca un
// formulario una volta, col suo peso intero: se qui si contassero le righe, un
// formulario chiuso su due ordini varrebbe due formulari e la quadratura non
// tornerebbe mai. I chili invece si sommano, perche' ogni quota e' peso vero.
export function contaDistinti(formulari) {
  const numeri = new Set();
  let senzaNumero = 0;
  for (const f of formulari) {
    if (f.fir) numeri.add(f.fir.toUpperCase());
    else senzaNumero++;
  }
  return numeri.size + senzaNumero;
}

/**
 * I formulari con le date obbligatorie da sistemare, uno per numero di FIR: un
 * formulario chiuso su piu' ordini e' una voce sola, con gli ordini uniti
 * ('ET0 + ET1'), i chili sommati e le date che mancano a ciascuno. Le voci sono
 * tante quante ne conta contaDistinti, cosi' gli esempi e "e altri" tornano col
 * numero dei formulari: contati sulle quote, 7 voci per 4 formulari (22/09/2026).
 * Una voce gia' raggruppata resta com'e': si puo' ripassare senza danni, e le
 * pagine lo fanno con la stessa regola (src/lib/quadraturaFir.js) sugli esiti
 * salvati prima, che hanno ancora una voce per quota.
 */
export function formulariConDate(voci) {
  const gruppi = [];
  const perFir = new Map();
  for (const x of voci || []) {
    const k = x && x.fir ? String(x.fir).toUpperCase() : '';
    if (k && perFir.has(k)) { perFir.get(k).push(x); continue; }
    const quote = [x];
    if (k) perFir.set(k, quote);
    gruppi.push(quote);
  }
  return gruppi.map((quote) => {
    if (quote.length === 1) return quote[0];
    const ordini = [...new Set(quote.map(q => q.ordine).filter(Boolean))];
    const testi = [...new Set(quote.map(q => q.date).filter(Boolean))];
    // stesse date che mancano a tutte le quote: una volta; se no, ordine per ordine
    const date = testi.length <= 1 ? (testi[0] || '')
      : testi.map(t => `${t} (${[...new Set(quote.filter(q => q.date === t).map(q => q.ordine).filter(Boolean))].join(' + ') || 'ordine senza numero'})`).join(' · ');
    const kg = quote.some(q => typeof q.kg === 'number') ? quote.reduce((t, q) => t + (Number(q.kg) || 0), 0) : undefined;
    return { ...quote[0], ordine: ordini.join(' + '), date, ...(kg !== undefined ? { kg } : {}) };
  });
}

/**
 * I movimenti del gestionale della settimana, flusso per flusso.
 *
 * @param {object} base44   client con asServiceRole
 * @param {object} periodo  { inizio, fine } giorni compresi
 * @param {array}  soloFlussi chiavi da calcolare; se vuoto, tutte
 * @param {object} pronti   { archivi, caricamenti } gia' letti, per chi rifa' piu'
 *                          settimane di fila: archivi per entita', interi
 *                          (annullati compresi), e l'esito di statoCaricamenti
 */
export async function caricaGestionale(base44, periodo, soloFlussi = null, pronti = null) {
  const svc = base44.asServiceRole.entities;
  const { inizio, fine } = periodo;
  const primoFascia = piuGiorni(inizio, -GIORNI_FASCIA);
  const ultimoFascia = piuGiorni(fine, GIORNI_FASCIA);

  const flussi = FLUSSI_DATI.filter(f => !soloFlussi || soloFlussi.includes(f.chiave));
  // Un'entita' si legge una volta sola anche quando serve a due flussi (extra raccolta).
  const entita = [...new Set(flussi.map(f => f.entita))];
  const raccolta = {};
  for (const f of flussi) {
    raccolta[f.chiave] = { celle: new Map(), vicini: [], annullati: [], senza_peso: [], senza_fine: [], date_da_sistemare: [], totale: { n: 0, kg: 0 } };
  }

  const perEntita = {};
  // I terminati senza fine trasporto non stanno in nessuna settimana: non si
  // contano, ma si dicono. Con gli archivi interi gia' in memoria sono li'
  // dentro; altrimenti si chiedono a parte.
  const senzaFinePerEntita = {};
  if (pronti && pronti.archivi) {
    // In ordine di id, come li restituisce la lettura per intervallo: dall'ordine
    // dipendono i nomi mostrati per ogni cella.
    for (const e of entita) perEntita[e] = [...(pronti.archivi[e] || [])].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    for (const e of entita) senzaFinePerEntita[e] = perEntita[e];
  } else {
    await Promise.all(entita.map(async (e) => {
      const [fascia, senzaFine] = await Promise.all([nellaFascia(svc, e, primoFascia, ultimoFascia), senzaFineTrasporto(svc, e)]);
      perEntita[e] = fascia;
      senzaFinePerEntita[e] = senzaFine;
    }));
  }

  // Primaria o secondaria dell'extra raccolta, rete o ACI delle secondarie.
  const delFlusso = (f, r) => {
    const movimento = String(r.tipo_movimento || 'primaria').toLowerCase().trim();
    if (f.movimento && movimento !== f.movimento) return false;
    if (f.canale && (f.canale === 'ACI') !== eAci(r)) return false;
    return true;
  };

  for (const f of flussi) {
    const dati = raccolta[f.chiave];
    const senzaFine = senzaFinePerEntita[f.entita];
    // Del senza fine trasporto si dicono tutte le date che mancano: spesso manca anche l'inizio.
    if (senzaFine === null) dati.senza_fine = null;
    else for (const r of (senzaFine || [])) if (eTerminato(r) && !giornoMovimento(r) && delFlusso(f, r)) dati.senza_fine.push({ ...formulario(r), date: testoDate(r) });

    for (const r of (perEntita[f.entita] || [])) {
      const d = giornoMovimento(r);
      if (!d || d < primoFascia || d > ultimoFascia) continue;
      if (!delFlusso(f, r)) continue;
      const dentro = d >= inizio && d <= fine;
      const fir = formulario(r);
      if (!eTerminato(r)) {
        if (dentro) dati.annullati.push({ ...fir, motivo: nome(r.motivo_cancellazione) || nome(r.stato) });
        continue;
      }
      if (!dentro) {
        dati.vicini.push({ ...fir, giorni: d < inizio ? -1 : 1 });
        continue;
      }
      const k = chiaveCella(r);
      if (!dati.celle.has(k)) {
        dati.celle.set(k, { impianto: fir.impianto, trasportatore: fir.trasportatore, n: 0, kg: 0, formulari: [] });
      }
      const cella = dati.celle.get(k);
      cella.kg += fir.kg;
      cella.formulari.push(fir);
      dati.totale.kg += fir.kg;
      if (!fir.kg) dati.senza_peso.push(fir);
      // contato nella settimana, ma senza l'immissione o l'inizio del trasporto, o con date incoerenti
      if (dateDaSistemare(r)) dati.date_da_sistemare.push({ ...fir, date: testoDate(r) });
    }
  }

  // L'ultimo caricamento di ogni tipo di file spiega un gestionale non aggiornato;
  // uno ancora aperto dice che l'archivio si sta riscrivendo.
  const tipi = [...new Set(flussi.flatMap(f => f.caricamenti))];
  const { ultimi, in_corso: aperti } = (pronti && pronti.caricamenti) || await statoCaricamenti(base44, tipi);

  // I conteggi si fanno alla fine, sui formulari distinti.
  for (const f of flussi) {
    const dati = raccolta[f.chiave];
    let totale = 0;
    for (const cella of dati.celle.values()) {
      cella.n = contaDistinti(cella.formulari);
      totale += cella.n;
    }
    dati.totale.n = totale;
  }

  // Gli elenchi in un ordine che non dipende da come e' stato letto l'archivio:
  // lo stesso confronto deve dare lo stesso esito, altrimenti il riconfronto lo
  // crederebbe cambiato e lo riscriverebbe ogni volta.
  const perData = (a, b) => String(a.data).localeCompare(String(b.data)) || a.fir.localeCompare(b.fir) || a.ordine.localeCompare(b.ordine);
  const out = {};
  for (const f of flussi) {
    const dati = raccolta[f.chiave];
    const caricamenti = f.caricamenti.map(t => ultimi[t]).filter(Boolean).sort((a, b) => String(b.data).localeCompare(String(a.data)));
    out[f.chiave] = {
      celle: [...dati.celle.values()].map(c => ({ ...c, kg: Math.round(c.kg), formulari: [...c.formulari].sort(perData) })),
      vicini: [...dati.vicini].sort(perData),
      annullati: [...dati.annullati].sort(perData),
      senza_peso: [...dati.senza_peso].sort(perData),
      // i formulari della settimana con le date obbligatorie da sistemare, uno
      // per numero di FIR: le quote di un formulario ripartito sono una voce sola
      date_da_sistemare: formulariConDate([...dati.date_da_sistemare].sort(perData)),
      // null se il conteggio non si e' potuto fare; i formulari contati una volta
      // sola, e anche gli esempi: cinque formulari, non cinque quote
      senza_fine: dati.senza_fine === null ? null
        : { n: contaDistinti(dati.senza_fine), esempi: formulariConDate([...dati.senza_fine].sort(perData)).slice(0, 5).map(x => ({ fir: x.fir, ordine: x.ordine, date: x.date })) },
      totale: { n: dati.totale.n, kg: Math.round(dati.totale.kg) },
      ultimo_caricamento: caricamenti[0] || null,
      caricamento_in_corso: (aperti || []).find(a => f.caricamenti.includes(a.tipo_file)) || null,
    };
  }
  return out;
}

/** I caricamenti ancora aperti fra quelli dei flussi letti, senza doppioni. */
export function caricamentiAperti(gestionale) {
  const visti = new Map();
  for (const dati of Object.values(gestionale || {})) {
    const a = dati && dati.caricamento_in_corso;
    if (a && !visti.has(a.tipo_file)) visti.set(a.tipo_file, a);
  }
  return [...visti.values()];
}

// === conformita' per canale ===

export const CANALI_QUADRATURA = ['RETE', 'ACI', 'EXTRA RACCOLTA'];

/**
 * La conformita' della settimana canale per canale. sintesi() ne da' una sola
 * per tutti i flussi, e una settimana in cui la rete quadrava al chilo ma
 * l'extra raccolta aveva una riga diversa compariva "da sistemare" anche per la
 * rete: un verdetto che mescolava i canali.
 *
 * La lettura del file conta per il canale delle sue tabelle; una tabella di cui
 * non si e' capito il flusso potrebbe essere di qualunque canale, e allora la
 * lettura e' in dubbio per tutti. Senza la lettura (esiti salvati prima) vale
 * il controllo complessivo salvato con l'esito.
 */
export function sintesiPerCanale(esito, lettura = null) {
  const tabelle = lettura && Array.isArray(lettura.tabelle) ? lettura.tabelle : null;
  const senzaFlusso = !!tabelle && tabelle.some(t => !t.flusso);
  const out = [];
  for (const canale of CANALI_QUADRATURA) {
    const flussi = ((esito && esito.flussi) || []).filter(f => f.canale === canale);
    if (!flussi.length) continue;
    const letturaVerificata = tabelle
      ? !senzaFlusso && tabelle.filter(t => FLUSSI[t.flusso] && FLUSSI[t.flusso].canale === canale).every(t => t.quadra && t.fonte)
      : !!esito.lettura_verificata;
    const s = sintesi({ flussi, osservazioni: [], lettura_verificata: letturaVerificata, settimana_discorde: esito.settimana_discorde });
    // I formulari del canale, contati nella settimana, con le date obbligatorie
    // da sistemare (22/09/2026): non cambiano il verdetto delle tre fonti, ma si
    // dicono accanto, canale per canale.
    const conDate = flussi.flatMap(f => f.date_da_sistemare || []);
    out.push({ canale, ...s, lettura_verificata: letturaVerificata, ...(conDate.length ? { date_da_sistemare: contaDistinti(conDate) } : {}) });
  }
  return out;
}

// "FIR RGYTR000001AA, ordine ET26000001: manca la data di inizio trasporto";
// "ordini ET0 + ET1" per un formulario ripartito
const descriviConDate = (x) => (x.fir ? `FIR ${x.fir}` : 'formulario senza numero') + (x.ordine ? `, ${/ \+ /.test(x.ordine) ? 'ordini' : 'ordine'} ${x.ordine}` : '') + (x.date ? `: ${x.date}` : '');

/**
 * Le date obbligatorie dei formulari (immissione, inizio e fine trasporto,
 * regola dell'utente del 22/09/2026), flusso per flusso e quindi canale per
 * canale:
 *   - i terminati senza fine trasporto, di qualunque periodo, non stanno in
 *     nessuna settimana e non si contano, ma senza dirlo un loro formulario a
 *     portale risultava "Manca nel gestionale" senza spiegazione;
 *   - i formulari della settimana senza immissione o senza inizio del
 *     trasporto, o con date incoerenti, si contano (la fine c'e'), e si dicono.
 */
export function osservazioniDate(gestionale) {
  const out = [];
  for (const chiave of ORDINE_FLUSSI) {
    const dati = gestionale && gestionale[chiave];
    if (!dati) continue;
    const nome = `${FLUSSI[chiave].titolo} · ${FLUSSI[chiave].canale}`;
    const sf = dati.senza_fine;
    if (sf === null) {
      out.push(`${nome}: non si è potuto contare quanti formulari sono terminati senza data di fine trasporto. Un formulario che a portale risulta "Manca nel gestionale" può essere uno di questi.`);
    } else if (sf && sf.n) {
      const esempi = sf.esempi.map(descriviConDate).join('; ');
      const altri = sf.n > sf.esempi.length ? `; e altri ${sf.n - sf.esempi.length}` : '';
      out.push(sf.n === 1
        ? `${nome}: nel gestionale c'è un formulario terminato senza data di fine trasporto (${esempi}). La data è obbligatoria e va inserita: finché manca non sta in nessuna settimana e qui non è contato, e se a portale è della settimana la sua riga risulta "Manca nel gestionale". Si sistema con un nuovo caricamento del file che la riporti.`
        : `${nome}: nel gestionale ci sono ${sf.n} formulari terminati senza data di fine trasporto (${esempi}${altri}). La data è obbligatoria e va inserita: finché manca non stanno in nessuna settimana e qui non sono contati, e se a portale uno di questi è della settimana la sua riga risulta "Manca nel gestionale". Si sistemano con un nuovo caricamento del file che riporti la data.`);
    }
    // Un formulario ripartito su piu' ordini e' una voce sola: gli esempi e "e
    // altri" si contano sui formulari, come il numero che li precede.
    const conDate = formulariConDate(dati.date_da_sistemare || []);
    if (conDate.length) {
      const n = conDate.length;
      const esempi = conDate.slice(0, 5).map(descriviConDate).join('; ');
      const altri = n > 5 ? `; e altri ${n - 5}` : '';
      out.push(n === 1
        ? `${nome}: un formulario della settimana è registrato senza una data obbligatoria o con date incoerenti (${esempi}). È contato nella settimana, perché la fine trasporto c'è, ma le date vanno inserite o corrette.`
        : `${nome}: ${n} formulari della settimana sono registrati senza una data obbligatoria o con date incoerenti (${esempi}${altri}). Sono contati nella settimana, perché la fine trasporto c'è, ma le date vanno inserite o corrette.`);
    }
  }
  return out;
}

// Il nome di prima, per chi lo chiamava cosi'.
export const osservazioniSenzaFine = osservazioniDate;

/**
 * Il confronto di una settimana, con dentro la conformita' canale per canale e
 * le osservazioni sulle date obbligatorie dei formulari.
 */
export function confrontaSettimana(lettura, gestionale, periodo) {
  const esito = confronta(lettura, gestionale, periodo);
  esito.osservazioni.push(...osservazioniDate(gestionale));
  esito.per_canale = sintesiPerCanale(esito, lettura);
  return esito;
}

// === righe lette dalla stampa ===

/**
 * Le righe da conservare per rifare il confronto senza rileggere il file, nella
 * stessa forma che normalizzaLettura si aspetta dal file (conteggio, non n).
 * Si salvavano le righe gia' normalizzate, col conteggio in "n": rilette,
 * valevano zero formulari, e "ripeti il confronto" dava ogni cella in
 * scostamento.
 */
export function righeDaConservare(lettura) {
  const riga = (r) => ({ impianto: r.impianto, trasportatore: r.trasportatore, conteggio: r.n, kg: r.kg });
  const subtotale = (s) => ({ impianto: s.impianto, conteggio: s.n, kg: s.kg });
  return {
    settimana: lettura.settimana_indicata, anno: lettura.anno_indicato, note: lettura.note,
    tabelle: lettura.tabelle.map(t => ({
      titolo: t.titolo, fonte: t.fonte, righe: t.righe.map(riga), subtotali: (t.subtotali || []).map(subtotale),
      totale_conteggio: t.stampato.n, totale_kg: t.stampato.kg,
    })),
  };
}

/** Le righe conservate, pronte per normalizzaLettura: anche quelle salvate col conteggio in "n". */
export function righeConservate(salvate) {
  if (!salvate) return null;
  const conConteggio = (x) => ({ ...x, conteggio: x.conteggio ?? x.n });
  return {
    ...salvate,
    tabelle: (salvate.tabelle || []).map(t => ({
      ...t, righe: (t.righe || []).map(conConteggio), subtotali: (t.subtotali || []).map(conConteggio),
    })),
  };
}

// === riconfronto ===

/**
 * Rifa' il confronto di una quadratura gia' fatta, sulle righe lette dalla
 * stampa e con i movimenti di adesso, e lo salva se e' cambiato e se scrivi e'
 * vero.
 *
 * I problemi di lettura restano quelli trovati quando il file e' stato letto
 * (la seconda lettura, la ricostruzione dai subtotali): le righe conservate sono
 * gia' quelle buone e da sole non li racconterebbero piu'.
 *
 * Non si rifa' niente mentre un archivio dei flussi si sta riscrivendo: un
 * confronto su un archivio a meta' darebbe scostamenti che non esistono.
 *
 * Sul record si salva la conformita' canale per canale (per_canale), che lo
 * storico mostra; i conteggi e il verdetto complessivi non si scrivono piu',
 * perche' sommavano rete, ACI ed extra raccolta. Una quadratura salvata prima,
 * senza per_canale, si riscrive anche se l'esito e' lo stesso.
 *
 * Restituisce null se non c'e' niente da rifare, altrimenti { esito, per_canale,
 * lettura_verificata, cambiato, salvato, verificata_il, eseguito_il } oppure
 * { rinviato }. eseguito_il e' l'istante di questo confronto, anche quando non
 * si salva: e' la data da stampare accanto a un esito rifatto adesso.
 */
export async function rifaiQuadratura(base44, q, gestionale, { scrivi = false } = {}) {
  if (!q || q.stato !== 'completata' || !q.righe_json) return null;
  const aperti = caricamentiAperti(gestionale);
  if (aperti.length) return { rinviato: aperti };

  const letto = righeConservate(await leggiJson(base44, 'QuadraturaFir', q, 'righe_json', null));
  if (!letto) return null;
  const lettura = normalizzaLettura(letto);
  let letturaSalvata = null;
  try { letturaSalvata = await leggiJson(base44, 'QuadraturaFir', q, 'lettura_json', null); } catch { /* restano i problemi di adesso */ }
  if (letturaSalvata && Array.isArray(letturaSalvata.problemi)) lettura.problemi = letturaSalvata.problemi;

  const periodo = { anno: q.anno, settimana: q.settimana, inizio: q.data_inizio, fine: q.data_fine };
  const eseguito_il = new Date().toISOString();
  const esito = confrontaSettimana(lettura, gestionale, periodo);
  const testo = JSON.stringify(esito);
  let prima = '';
  try { prima = await leggiCampo(base44, 'QuadraturaFir', q, 'esito_json'); } catch { /* si riscrive */ }
  const cambiato = testo !== prima;
  const daSalvare = cambiato || !Array.isArray(q.per_canale);

  let verificata_il = q.verificata_il || null;
  let salvato = false;
  if (daSalvare && scrivi) {
    verificata_il = eseguito_il;
    await base44.asServiceRole.entities.QuadraturaFir.update(q.id, {
      per_canale: esito.per_canale,
      lettura_verificata: !!lettura.verificata,
      verificata_il,
      esito_json: await valoreCampo(base44, 'QuadraturaFir', q.id, 'esito_json', testo),
    });
    salvato = true;
  } else if (scrivi) {
    // Stesso esito sui movimenti di adesso: si segna solo quando e' stato
    // confermato. Lo storico mostra l'esito salvato solo se e' successivo
    // all'ultimo caricamento, e senza questa data un esito ancora buono
    // sembrerebbe vecchio.
    verificata_il = eseguito_il;
    await base44.asServiceRole.entities.QuadraturaFir.update(q.id, { verificata_il });
  }
  return { esito, per_canale: esito.per_canale, lettura_verificata: !!lettura.verificata, cambiato, salvato, verificata_il, eseguito_il };
}
