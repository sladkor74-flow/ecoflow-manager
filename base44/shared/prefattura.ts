// La prefattura del portale Ecotyre contro il gestionale.
//
// Ogni mese il portale produce una prefattura: l'elenco degli ordini che Ecotyre
// riconosce, col peso e l'importo. Prima di esportare la fatturazione del mese la
// si confronta, ordine per ordine, con le righe che il gestionale calcola
// (attivaCalcolo.ts): quello che non coincide va chiarito PRIMA di fatturare.
//
// Qui ci sono le due parti pure, senza letture: riconoscere le colonne di un
// foglio qualunque (la prefattura non ha un tracciato garantito) e confrontare.
// Il canale di un ordine non si chiede a nessuno: e' quello che l'ordine ha nel
// gestionale.

// Il surplus di un ordine come lo arrotonda il portale, ordine per ordine: la
// stessa funzione della riga del gestionale (13/10/2026).
import { importoSurplus } from "./surplus.ts";

const pulisci = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
// Gli importi si sommano in centesimi interi: sommando quattrocento importi con
// la virgola mobile il totale di luglio 2026 usciva 226.692,48 da una parte e
// 226.692,49 dall'altra, con tutte le righe identiche.
const centesimi = (v) => Math.round((Number(v) || 0) * 100);
// Gli euro e le tonnellate delle frasi del surplus, all'italiana (13/10/2026).
const euroIt = (v) => {
  const n = r2(Number(v) || 0);
  const [intero, dec] = Math.abs(n).toFixed(2).split('.');
  return (n < 0 ? '-' : '') + intero.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + dec;
};
const tIt = (kg) => {
  const n = Math.round(Number(kg) || 0) / 1000;
  const [intero, decimali] = n.toFixed(3).split('.');
  return intero.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + (decimali.endsWith('0') ? decimali.slice(0, 2) : decimali);
};
const euroTIt = (v) => {
  const [intero, decimali] = (Number(v) || 0).toFixed(3).split('.');
  return intero.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + (decimali.endsWith('0') ? decimali.slice(0, 2) : decimali) + ' €/t';
};

// Il tracciato vero (prefattura provvisoria 3716, luglio 2026): ID Prefattura,
// Fatturante, Periodo, KeyAccount, Tipo (Trasp / Trasp+Tratt), Ordine, Data fine
// trasporto, Numero FIR, Prodotto, Quantità (kg), Prezzo Unitario (Euro/Kg),
// Prezzo Totale. Un foglio solo, rete e ACI insieme, l'extra raccolta non c'e'.

// Un ID ordine del portale: due-quattro lettere e almeno sei cifre (ET26084363, SEC26154852)
const E_ORDINE = /^[A-Z]{2,4}\d{6,}$/;
export const comeOrdine = (v) => pulisci(v).toUpperCase().replace(/[\s.]/g, '');

/** Il tipo di servizio come lo scrive il gestionale: "Trasp+Tratt" -> TRASP_TRATT, "Trasp" -> TRASP. */
export const comeServizio = (v) => { const t = pulisci(v).toUpperCase(); return /TRATT/.test(t) ? 'TRASP_TRATT' : /TRASP/.test(t) ? 'TRASP' : ''; };

// IL SURPLUS NELLA PREFATTURA (13/10/2026). Dal 01/10/2026 il consorzio
// riconosce ai raccoglitori il Fuel Surcharge, +5 €/t, e SMOCO lo fattura a
// Ecotyre con una riga sua, sotto quelle dei formulari (attivaCalcolo.ts). Come
// lo scrivera' il portale nella prefattura non si sa ancora (la prima e' quella
// di ottobre; nella cartella ci sono i mesi fino ad agosto, dove il Tipo e' solo
// «Trasp» o «Trasp+Tratt» e il Prodotto e' la classe). Le forme possibili sono
// quattro, e il confronto le riconosce tutte:
//   a. nel prezzo: ogni ordine a 0,207 €/kg invece di 0,202;
//   b. una riga per ordine, col Tipo o il Prodotto «Fuel Surcharge»;
//   c. una riga sola, senza ordine;
//   d. niente: il surplus arriva con una comunicazione a parte, e si fattura a
//      parte (risposta dell'utente del 13/10/2026): il confronto lo scrive, non
//      lo conta fra le differenze e l'esportazione non chiede conferma per lui.
// Una riga di surplus si riconosce dalle parole, nel Tipo o nel Prodotto (su una
// riga senza ordine, in qualunque cella): mai dal Prodotto vuoto, che hanno
// anche le terziarie.
export const eTestoSurplus = (v) => /\bfuel\b|surcharge|carburant|\bsurplus\b/i.test(pulisci(v));
// La riga del surplus del gestionale (eRigaSurplus di attivaCalcolo.ts, qui
// riscritta per non portarsi dietro tutto il calcolo dell'attiva): una per canale,
// senza ordine e con zero chili.
const eRigaSurplusGestionale = (r) => !!r && (!!r.surplus_id || r.origine_dato === 'SURPLUS');

const INTESTAZIONI = [
  ['ordine', /(id|n|num|numero|cod|codice)?[\s._°-]*ordine|^order/i],
  ['fir', /\bfir\b|formulario/i],
  ['kg', /peso|\bkg\b|quantit|q\.?t[aà]/i],
  ['importo', /importo|imponibile|totale|valore|corrispettivo/i],
  ['prezzo', /prezzo|tariffa|€\s*\/\s*t|eur\s*\/\s*t/i],
  ['servizio', /servizio|prestazione|tipo/i],
  // Il Prodotto (la classe, «.class1»): non serve al confronto, ma e' dove il
  // portale potrebbe scrivere «Fuel Surcharge» (13/10/2026).
  ['prodotto', /prodotto|descrizione|causale|articolo/i],
  // La data della prefattura e' la FINE del trasporto: e' quella che colloca il
  // movimento nel mese (regola 1), e da lei periodoPrefattura ricava il periodo del
  // file. Cercarla con /data|trasporto/ prendeva la prima colonna da sinistra il cui
  // titolo contenesse "data": oggi il tracciato ne ha una sola, "Data fine
  // trasporto", ma basterebbe che il portale aggiungesse prima una "Data chiusura" o
  // una "Data immissione" perche' il mese venisse preso da quella, e il caricamento
  // rifiutasse la prefattura giusta dicendo che e' di un altro mese.
  ['data', /fine.*trasporto|trasporto.*fine|scarico|arrivo/i],
  // Se la fine trasporto non si riconosce, una colonna di data generica va bene -
  // ma non la chiusura a portale, non l'immissione e non l'inizio del trasporto.
  ['data', /data/i, /chiusur|chius|immissione|immesso|inizio|partenza|emissione|documento|fattura|scadenz/i],
];

/** Un numero scritto all'italiana ("1.234,56"), all'inglese o gia' numero. null se non e' un numero. */
export function comeNumero(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  let s = pulisci(v).replace(/[€\s]|kg|ton|t$/gi, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  // senza virgola, un punto seguito da tre cifre e' il separatore delle migliaia
  // all'italiana ("2.500" sono duemilacinquecento): il documento e' italiano
  else if ((s.match(/\./g) || []).length > 1 || /^-?\d{1,3}\.\d{3}$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return isFinite(n) ? n : null;
}

/** Il giorno 'AAAA-MM-GG' di una cella: seriale di Excel, data o testo (gg/mm/aaaa o aaaa-mm-gg). */
export function comeGiorno(v) {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000).toISOString().slice(0, 10);
  if (v instanceof Date && !isNaN(v.getTime())) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  const s = pulisci(v);
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
}

/**
 * Il mese a cui si riferisce la prefattura, ricavato dalle date di fine trasporto
 * delle sue righe: e' scritto nel file, non serve che lo dica chi lo carica.
 * { anno, mese_idx, quota } col mese piu' frequente, oppure null se le date mancano.
 */
export function periodoPrefattura(righe) {
  const conta = new Map();
  for (const r of righe || []) if (r.giorno) conta.set(r.giorno.slice(0, 7), (conta.get(r.giorno.slice(0, 7)) || 0) + 1);
  const ordinati = [...conta.entries()].sort((a, b) => b[1] - a[1]);
  if (!ordinati.length) return null;
  const totale = ordinati.reduce((s, e) => s + e[1], 0);
  return { anno: Number(ordinati[0][0].slice(0, 4)), mese_idx: Number(ordinati[0][0].slice(5, 7)) - 1, quota: ordinati[0][1] / totale };
}

/**
 * Legge una prefattura da una o piu' tabelle (una per foglio): righe come array
 * di celle. Cerca la riga delle intestazioni, riconosce le colonne dai nomi e,
 * se il nome non basta, la colonna degli ordini dalla forma dei valori.
 * Restituisce { righe: [{ id_ordine, numero_fir, kg, importo, prezzo, servizio }], note: [] }.
 */
export function leggiTabellePrefattura(tabelle) {
  const righe = [];
  const note = [];
  for (const { nome, celle } of tabelle || []) {
    const t = celle || [];
    // la riga delle intestazioni: la prima, fra le prime 40, con almeno due nomi riconosciuti
    let iTesta = -1, colonne = {};
    for (let i = 0; i < Math.min(40, t.length); i++) {
      const trovate = {};
      (t[i] || []).forEach((c, j) => {
        const testo = pulisci(c);
        if (!testo || comeNumero(testo) !== null) return;
        for (const [chiave, re, mai] of INTESTAZIONI) {
          // `mai`: intestazioni che NON vanno prese con quella regola, per esempio
          // una "Data chiusura" al posto della fine trasporto.
          if (mai && mai.test(testo)) continue;
          if (trovate[chiave] === undefined && re.test(testo)) { trovate[chiave] = { j, testo }; break; }
        }
      });
      // il Prodotto non conta per dire che e' la riga delle intestazioni: una riga
      // «Descrizione ... Totale» sopra la tabella non lo e' (13/10/2026)
      if (Object.keys(trovate).filter(k => k !== 'prodotto').length >= 2 && (trovate.ordine || trovate.importo)) { iTesta = i; colonne = trovate; break; }
    }
    const corpo = t.slice(iTesta + 1);
    // la colonna degli ordini dalla forma dei valori, se l'intestazione non l'ha detta
    let jOrdine = colonne.ordine ? colonne.ordine.j : -1;
    if (jOrdine < 0) {
      const conta = new Map();
      for (const r of corpo) (r || []).forEach((c, j) => { if (E_ORDINE.test(comeOrdine(c))) conta.set(j, (conta.get(j) || 0) + 1); });
      const migliore = [...conta.entries()].sort((a, b) => b[1] - a[1])[0];
      if (migliore) jOrdine = migliore[0];
    }
    if (jOrdine < 0) { if (corpo.some(r => (r || []).some(c => pulisci(c)))) note.push(`Foglio "${nome}": nessuna colonna con gli ID ordine, saltato.`); continue; }

    const col = (k) => (colonne[k] ? colonne[k].j : -1);
    // il peso e' in tonnellate se lo dice l'intestazione, oppure se i valori sono piccoli e con decimali
    const valoriPeso = col('kg') >= 0 ? corpo.map(r => comeNumero((r || [])[col('kg')])).filter(v => v !== null && v > 0) : [];
    const mediana = valoriPeso.length ? [...valoriPeso].sort((a, b) => a - b)[Math.floor(valoriPeso.length / 2)] : 0;
    const inTonnellate = col('kg') >= 0 && (/\bt\b|tonn/i.test(colonne.kg.testo) && !/kg/i.test(colonne.kg.testo) || (mediana > 0 && mediana < 60));
    if (inTonnellate) note.push(`Foglio "${nome}": pesi letti come tonnellate e convertiti in kg.`);

    let lette = 0, diSurplus = 0;
    for (const r of corpo) {
      const celle = r || [];
      const id = comeOrdine(celle[jOrdine]);
      const conOrdine = E_ORDINE.test(id);
      const servizio = col('servizio') >= 0 ? pulisci(celle[col('servizio')]) : '';
      const prodotto = col('prodotto') >= 0 ? pulisci(celle[col('prodotto')]) : '';
      // Una riga di surplus (13/10/2026): su un ordine la dicono il Tipo o il
      // Prodotto (un produttore che si chiama «Fuel ...» non la fa diventare
      // surplus); senza ordine, qualunque cella di testo, purche' non sia la riga
      // dei totali e abbia un importo.
      // Senza ordine il testo e' tutta la riga: puo' dire anche il canale («...
      // ACI»), e serve a darla al canale giusto.
      const testi = celle.map(pulisci).filter(t => t && comeNumero(t) === null);
      const testoSurplus = conOrdine
        ? [servizio, prodotto].find(eTestoSurplus)
        : (testi.some(eTestoSurplus) ? testi.join(' · ') : '');
      const importo = col('importo') >= 0 ? comeNumero(celle[col('importo')]) : null;
      if (!conOrdine && (!testoSurplus || importo === null || celle.some(c => /^totale\b/i.test(pulisci(c))))) continue;
      const peso = col('kg') >= 0 ? comeNumero(celle[col('kg')]) : null;
      righe.push({
        id_ordine: conOrdine ? id : '',
        numero_fir: col('fir') >= 0 ? pulisci(celle[col('fir')]).toUpperCase() : '',
        kg: peso === null ? null : Math.round(inTonnellate ? peso * 1000 : peso),
        importo,
        prezzo: col('prezzo') >= 0 ? comeNumero(celle[col('prezzo')]) : null,
        servizio,
        giorno: col('data') >= 0 ? comeGiorno(celle[col('data')]) : '',
        foglio: nome || '',
        ...(testoSurplus ? { surplus: true, testo: testoSurplus } : {}),
      });
      lette++;
      if (testoSurplus) diSurplus++;
    }
    if (diSurplus) note.push(`Foglio "${nome}": ${diSurplus === 1 ? 'una riga' : `${diSurplus} righe`} di surplus (Fuel Surcharge) ${diSurplus === 1 ? 'letta' : 'lette'} a parte: i chili non si sommano agli ordini, l'importo va nel riquadro del surplus.`);
    if (lette && col('importo') < 0) note.push(`Foglio "${nome}": nessuna colonna con l'importo, si confrontano solo ordini e pesi.`);
    if (lette && col('kg') < 0) note.push(`Foglio "${nome}": nessuna colonna col peso, si confrontano solo ordini e importi.`);
  }
  return { righe, note };
}

/**
 * Legge la prefattura dal TESTO del suo PDF: le righe arrivano gia' ricostruite
 * (un array di celle per riga, da sinistra a destra), estratte nel browser con
 * pdf.js. Niente agente: con oltre quattrocento righe l'agente si rifiuta di
 * restituirle tutte (provato il 20/09/2026), mentre il testo del PDF e' esatto.
 *
 * Una riga di dettaglio: ID ordine, KeyAccount, produttore, classe, data
 * (gg-mm-aaaa), formulario, tipo, chili ("4 700"), prezzo al chilo ("0,2020"),
 * importo ("949,40"). Le celle a volte si fondono, percio' si lavora sulla riga
 * intera. In testa al documento c'e' il riepilogo stampato, per classi 1-4 e
 * per classe 9: i suoi totali dicono se la lettura e' completa.
 */
export function leggiLineePdfPrefattura(linee) {
  const righe = [];
  const note = [];
  let periodo = null;
  const stampati = { ordini: 0, kg: 0, euro: 0, blocchi: 0 };
  const numero = (t) => comeNumero(String(t).replace(/\s/g, '').replace(/Kg|Euro/gi, ''));
  for (const celle of linee || []) {
    const riga = (celle || []).map(pulisci).filter(Boolean).join(' ');
    if (!riga) continue;
    const mese = riga.match(/nel mese:\s*(\d{1,2})\/(\d{4})/i);
    if (mese) { periodo = { anno: Number(mese[2]), mese_idx: Number(mese[1]) - 1, quota: 1 }; continue; }
    // "Totale 410 1 122 240 Kg 226 692,48 Euro"
    const tot = riga.match(/^Totale\s+(\d+)\s+([\d ]+)\s*Kg\s+([\d .]+,\d{2})\s*Euro/i);
    if (tot) { stampati.ordini += Number(tot[1]); stampati.kg += numero(tot[2]) || 0; stampati.euro += Math.round((numero(tot[3]) || 0) * 100); stampati.blocchi++; continue; }
    const id = (riga.match(/^([A-Z]{2,4}\d{6,})\b/) || [])[1];
    const coda = id ? riga.match(/(\d{2})-(\d{2})-(\d{4})\s+(\S+)\s+(Trasp\+Tratt|Trasp|Tratt)\s+([\d ]+?)\s+(\d+,\d{3,6})\s+([\d .]*\d,\d{2})$/) : null;
    // UNA RIGA DI SURPLUS (13/10/2026): il PDF di una prefattura col Fuel
    // Surcharge non l'abbiamo ancora visto. Una riga che non e' quella di un
    // formulario (Trasp o Trasp+Tratt: un produttore che si chiama «Carburanti
    // ...» resta un formulario), nomina il surplus e finisce con un importo e' una
    // riga di surplus, con o senza ordine; una che porta anche «Kg ... Euro» e'
    // del riepilogo stampato in testa, e non si legge come riga. I suoi chili non
    // contano nella completezza della lettura (sono quelli dell'ordine), e il suo
    // importo vale coi totali stampati o senza. Una riga che comincia con
    // «Totale» («Totale Fuel Surcharge 15,00») e' la somma delle righe sopra, non
    // una riga in piu': come nell'Excel, si salta (revisione del 13/10/2026: il
    // PDF contava il surplus due volte, l'Excel dello stesso file una).
    if (!coda && eTestoSurplus(riga) && !/^Totale\b/i.test(riga) && !/\bKg\b[\s\S]*\bEuro\b/i.test(riga)) {
      // l'importo in fondo, con le migliaia separate da spazio o punto («5 611,20»)
      const imp = riga.match(/(?:^|\s)(\d{1,3}(?:[ .]\d{3})*,\d{2})\s*(?:€|Euro)?\s*$/i);
      if (imp) {
        const prezzo = riga.match(/\s(\d+,\d{3,6})\s+\d{1,3}(?:[ .]\d{3})*,\d{2}\s*(?:€|Euro)?\s*$/i);
        righe.push({ id_ordine: id || '', numero_fir: '', kg: null, importo: numero(imp[1]), prezzo: prezzo ? numero(prezzo[1]) : null, servizio: '', giorno: '', foglio: 'PDF', surplus: true, testo: riga.slice(0, 120) });
        continue;
      }
    }
    if (!id) continue;
    if (!coda) { note.push(`Riga dell'ordine ${id} non riconosciuta: "${riga.slice(0, 120)}".`); continue; }
    righe.push({
      id_ordine: id, numero_fir: coda[4].toUpperCase(), kg: Math.round(numero(coda[6]) || 0), importo: numero(coda[8]), prezzo: numero(coda[7]),
      servizio: coda[5], giorno: `${coda[3]}-${coda[2]}-${coda[1]}`, foglio: 'PDF',
    });
  }
  // la completezza si misura sugli ordini; le righe di surplus si contano a parte
  const ordinarie = righe.filter(r => !r.surplus);
  const sKg = ordinarie.reduce((s, r) => s + (r.kg || 0), 0), sCent = ordinarie.reduce((s, r) => s + Math.round((r.importo || 0) * 100), 0);
  const sCentSurplus = righe.filter(r => r.surplus).reduce((s, r) => s + Math.round((r.importo || 0) * 100), 0);
  const totali = stampati.blocchi ? { ordini: stampati.ordini, kg: stampati.kg, euro: stampati.euro / 100 } : null;
  let completa = null;
  if (totali) {
    // sugli importi il portale arrotonda il totale a modo suo: un centesimo per blocco e' tollerato
    const euroTornano = (cent) => Math.abs(cent - stampati.euro) <= 2 * stampati.blocchi;
    completa = ordinarie.length === totali.ordini && sKg === totali.kg && (euroTornano(sCent) || (sCentSurplus > 0 && euroTornano(sCent + sCentSurplus)));
    if (!completa) note.push(`ATTENZIONE: lette ${ordinarie.length} righe per ${sKg} kg e ${(sCent / 100).toFixed(2)} euro, ma il riepilogo stampato dice ${totali.ordini} ordini, ${totali.kg} kg e ${totali.euro.toFixed(2)} euro: la lettura non e' completa.`);
  } else note.push('Nel PDF non ho trovato il riepilogo stampato dei totali: non posso controllare che la lettura sia completa.');
  if (righe.length > ordinarie.length) {
    const n = righe.length - ordinarie.length;
    note.push(`${n === 1 ? 'Una riga' : `${n} righe`} di surplus (Fuel Surcharge) per ${euroIt(sCentSurplus / 100)} euro, ${n === 1 ? 'letta' : 'lette'} a parte.`);
  }
  return { righe, note, totali_stampati: totali, periodo: periodo || periodoPrefattura(righe), completa };
}

const somma = (m, id, kg, importo) => {
  const e = m.get(id) || { id_ordine: id, kg: 0, importo: 0, righe: 0, conKg: false, conImporto: false, servizio: '', fir: '' };
  if (kg !== null && kg !== undefined) { e.kg += kg; e.conKg = true; }
  if (importo !== null && importo !== undefined) { e.importo += importo; e.conImporto = true; }
  e.righe++;
  m.set(id, e);
};

/**
 * Confronta la prefattura con le righe del mese calcolate dal gestionale.
 * righePrefattura: da leggiTabellePrefattura. righeVive: { RETE: [...], ACI: [...],
 * EXTRA_RACCOLTA: [...] } da calcolaRigheAttiva. altrove: Map ordine -> { canale,
 * stato, giorno, date? } su tutti gli archivi (date: cosa manca o non torna nelle
 * date obbligatorie di un terminato, a parole), per dire dove sta un ordine che il mese
 * non ha. Una prefattura puo' avere piu' righe per lo stesso ordine (trasporto e
 * trattamento): si sommano, come le righe a corpo del gestionale.
 *
 * surplusDelMese (13/10/2026): il surplus_del_mese di calcolaRigheAttiva,
 * { RETE: [{ nome, euro_t, kg, totale, ordini_ids }], ... }. Dice su quali ordini
 * vale un surplus e con quanti €/t, per riconoscerlo anche dentro il prezzo di un
 * ordine (forma a). Senza, vale la riga del surplus del canale su tutti i suoi
 * ordini. Il surplus di ogni canale si confronta nel suo riquadro (surplus),
 * qualunque sia la forma in cui la prefattura lo porta.
 */
export function confrontaPrefattura(righePrefattura, righeVive, altrove = new Map(), surplusDelMese = null) {
  const pre = new Map();
  // Le righe di surplus della prefattura (forme b e c) si tengono a parte: i loro
  // chili sono quelli dell'ordine, e sommati all'ordine darebbero un «peso
  // diverso» su ogni ordine del mese.
  const preSurplus = [];
  for (const r of righePrefattura || []) {
    if (r && r.surplus) { preSurplus.push(r); continue; }
    somma(pre, r.id_ordine, r.kg, r.importo);
    const e = pre.get(r.id_ordine);
    if (!e.servizio) e.servizio = comeServizio(r.servizio);
    if (!e.fir) e.fir = pulisci(r.numero_fir).toUpperCase();
  }
  const conImporti = [...pre.values()].some(e => e.conImporto);
  const conPesi = [...pre.values()].some(e => e.conKg);

  // Il canale di ogni ordine del gestionale: una riga di surplus su un ordine va
  // nel canale di quell'ordine.
  const canaleDi = new Map();
  for (const canale of Object.keys(righeVive || {})) {
    for (const r of righeVive[canale] || []) if (!eRigaSurplusGestionale(r) && r.ordine) canaleDi.set(comeOrdine(r.ordine), canale);
  }

  const canali = [];
  const visti = new Set();
  // per canale: le righe del surplus del gestionale e il surplus trovato dentro i prezzi
  const surplusDi = new Map();
  for (const canale of Object.keys(righeVive || {})) {
    const gest = new Map();
    const surplusGest = [];
    for (const r of righeVive[canale] || []) {
      // la riga del surplus non ha ordine: sommata sotto l'ordine vuoto usciva un
      // «solo nel gestionale» senza numero
      if (eRigaSurplusGestionale(r)) { surplusGest.push(r); continue; }
      const id = comeOrdine(r.ordine);
      const e = gest.get(id) || { id_ordine: id, numero_fir: r.numero_fir || '', kg: 0, importo: 0, prezzo: 0, servizio: r.servizio_ecotyre || '' };
      e.kg += Number(r.quantita) || 0;
      e.importo += Number(r.totale) || 0;
      if (r.quantita > 0) e.prezzo = r.tariffa_valore;
      gest.set(id, e);
    }
    // I €/t di surplus che il gestionale applica a ogni ordine: dal surplus del
    // mese (gli ordini su cui vale), altrimenti la riga del canale su tutti.
    const attesoPerOrdine = new Map();
    const delMese = surplusDelMese && surplusDelMese[canale];
    if (Array.isArray(delMese)) {
      for (const s of delMese) {
        for (const o of s.ordini_ids || []) { const k = comeOrdine(o); attesoPerOrdine.set(k, (attesoPerOrdine.get(k) || 0) + (Number(s.euro_t) || 0)); }
      }
    } else if (surplusGest.length) {
      const euroT = surplusGest.reduce((s, r) => s + (Number(r.tariffa_valore) || 0), 0);
      for (const k of gest.keys()) attesoPerOrdine.set(k, euroT);
    }
    // Il surplus atteso su ogni ordine, arrotondato ordine per ordine come lo
    // farebbe il portale (revisione del 13/10/2026): ogni ordine si controlla col
    // suo, e la somma, contro la riga del gestionale arrotondata sul mese, dice di
    // quanto puo' scostarsi davvero l'arrotondamento (a luglio 2026, sulla rete,
    // un centesimo). Prima la tolleranza era mezzo centesimo per ordine: fino a
    // 2,05 € sulla rete, e ci passavano un ordine senza surplus o con il surplus
    // due volte.
    const attesoCent = new Map();
    for (const [id, g] of gest) {
      const euroT = attesoPerOrdine.get(id) || 0;
      if (euroT > 0) attesoCent.set(id, Math.round(importoSurplus(g.kg, euroT) * 100));
    }
    // per = il surplus trovato nel prezzo di ogni ordine, in centesimi
    const nelPrezzo = { ordini: 0, cent: 0, per: new Map() };
    // gli ordini gia' fra le differenze (mancano, peso o importo diversi): il loro
    // surplus non si puo' controllare da solo, si chiarisce con loro
    const giaDiverso = new Set();
    const soloGestionale = [], pesoDiverso = [], importoDiverso = [], servizioDiverso = [], firDiverso = [];
    let kgPre = 0, euroPre = 0, ordiniPre = 0;
    for (const [id, g] of gest) {
      const p = pre.get(id);
      if (!p) { soloGestionale.push({ id_ordine: id, numero_fir: g.numero_fir, kg: g.kg, importo: r2(g.importo) }); giaDiverso.add(id); continue; }
      visti.add(id);
      ordiniPre++; kgPre += p.kg; euroPre += centesimi(p.importo);
      // il tipo di servizio decide il prezzo: se la prefattura dice Trasp e il gestionale Trasp+Tratt va saputo
      if (p.servizio && g.servizio && p.servizio !== g.servizio) servizioDiverso.push({ id_ordine: id, numero_fir: g.numero_fir, servizio_prefattura: p.servizio, servizio_gestionale: g.servizio, kg: Math.round(g.kg) });
      const firGest = pulisci(g.numero_fir).toUpperCase();
      if (p.fir && firGest && p.fir !== firGest) firDiverso.push({ id_ordine: id, fir_prefattura: p.fir, fir_gestionale: firGest, kg: Math.round(g.kg) });
      const kgDiversi = p.conKg && Math.round(p.kg) !== Math.round(g.kg);
      if (kgDiversi) { pesoDiverso.push({ id_ordine: id, numero_fir: g.numero_fir, kg_prefattura: Math.round(p.kg), kg_gestionale: Math.round(g.kg), importo_prefattura: p.conImporto ? r2(p.importo) : null, importo_gestionale: r2(g.importo) }); giaDiverso.add(id); }
      else if (p.conImporto && Math.abs(p.importo - g.importo) > 0.015) {
        // FORMA a: IL SURPLUS NEL PREZZO (13/10/2026). Se lo scarto dell'ordine e'
        // proprio il surplus che il gestionale applica a quell'ordine (5 €/t sulle
        // sue tonnellate), non e' una differenza: va nel riquadro del surplus.
        const atteso = (attesoPerOrdine.get(id) || 0) * g.kg / 1000;
        if (atteso > 0 && Math.abs(p.importo - (g.importo + atteso)) <= 0.015) {
          const cent = centesimi(p.importo) - centesimi(g.importo);
          nelPrezzo.ordini++;
          nelPrezzo.cent += cent;
          nelPrezzo.per.set(id, cent);
          continue;
        }
        giaDiverso.add(id);
        importoDiverso.push({
          id_ordine: id, numero_fir: g.numero_fir, kg: Math.round(g.kg),
          importo_prefattura: r2(p.importo), importo_gestionale: r2(g.importo),
          // il prezzo che la prefattura sta applicando, ricavato: dice subito se e' una tariffa diversa
          prezzo_prefattura_t: g.kg ? r2(p.importo / (g.kg / 1000)) : null, prezzo_gestionale_t: g.prezzo || null,
        });
      }
    }
    const kgGest = [...gest.values()].reduce((s, e) => s + e.kg, 0);
    const euroGest = [...gest.values()].reduce((s, e) => s + centesimi(e.importo), 0) / 100;
    // L'extra raccolta non passa dalla prefattura del portale (verificato sulla
    // 3716 di luglio 2026: 416 ordini fra rete e ACI, l'intervento extra non c'e').
    // Se la prefattura non ne porta nessun ordine, le sue righe non sono differenze.
    const fuoriPrefattura = canale === 'EXTRA_RACCOLTA' && ordiniPre === 0;
    // arrotondamento: quanto la somma ordine per ordine si scosta dalla riga del
    // gestionale, arrotondata una volta sul mese
    const centGestCanale = surplusGest.reduce((s, r) => s + centesimi(r.totale), 0);
    const attesoTot = [...attesoCent.values()].reduce((s, v) => s + v, 0);
    surplusDi.set(canale, {
      righe: surplusGest, nelPrezzo, perOrdine: [], sole: [], insieme: [],
      gest, attesoCent, giaDiverso, arrotondamento: attesoCent.size ? attesoTot - centGestCanale : 0,
    });
    canali.push({
      canale, fuori_prefattura: fuoriPrefattura,
      // euro: gli ordini, cioe' lo standard; il surplus sta nel suo riquadro, e
      // nella prefattura si toglie anche quello trovato dentro i prezzi
      gestionale: { ordini: gest.size, kg: Math.round(kgGest), euro: r2(euroGest) },
      prefattura: { ordini: ordiniPre, kg: conPesi ? Math.round(kgPre) : null, euro: conImporti ? (euroPre - nelPrezzo.cent) / 100 : null },
      solo_gestionale: soloGestionale, peso_diverso: pesoDiverso, importo_diverso: importoDiverso,
      servizio_diverso: servizioDiverso, fir_diverso: firDiverso,
      surplus: null,
    });
  }

  // LE RIGHE DI SURPLUS DELLA PREFATTURA (forme b e c, 13/10/2026). Una riga su
  // un ordine va nel canale di quell'ordine. Una riga sola, senza ordine, va nel
  // canale che nomina («... ACI»), o in quello di tutti gli ordini del file se e'
  // uno solo, o in quello il cui surplus ha proprio quell'importo; se e' il
  // surplus di tutti i canali insieme si dice, e se non si capisce si chiede. Un
  // canale non prende mai il surplus di un altro.
  const nomeCanale = { RETE: 'rete', ACI: 'ACI', EXTRA_RACCOLTA: 'extra raccolta' };
  const centGest = (canale) => (surplusDi.get(canale)?.righe || []).reduce((s, r) => s + centesimi(r.totale), 0);
  const canaliDelFile = [...new Set([...pre.keys()].map(id => canaleDi.get(id)).filter(Boolean))];
  // i canali col surplus nel gestionale che passano dalla prefattura (l'extra
  // raccolta no: il suo surplus non puo' essere in una riga del file)
  const conSurplusGest = canali.filter(c => !c.fuori_prefattura && centGest(c.canale) > 0).map(c => c.canale);
  const daAttribuire = [];
  for (const r of preSurplus) {
    const id = comeOrdine(r.id_ordine);
    const voce = { id_ordine: id, testo: pulisci(r.testo || r.servizio), kg: r.kg ?? null, importo: r.importo ?? null, prezzo: r.prezzo ?? null };
    if (id) {
      const canale = canaleDi.get(id) || (altrove.get(id) || {}).canale || '';
      if (surplusDi.has(canale)) { surplusDi.get(canale).perOrdine.push(voce); continue; }
      const a = altrove.get(id);
      daAttribuire.push({ ...voce, spiegazione: !a ? `riga di surplus sull'ordine ${id}, che il gestionale non conosce` : `riga di surplus sull'ordine ${id}, che nel gestionale non è del mese (${a.canale === 'TERZIARIE' ? 'è una terziaria' : a.giorno ? `fine trasporto il ${a.giorno.split('-').reverse().join('/')}` : `è ${a.stato || 'senza stato'}`})` });
      continue;
    }
    const cent = centesimi(r.importo);
    const scritto = /\baci\b/i.test(voce.testo) ? 'ACI' : /\bextra\b/i.test(voce.testo) ? 'EXTRA_RACCOLTA' : /\brete\b/i.test(voce.testo) ? 'RETE' : '';
    // l'importo «giusto» di una riga sola: quello del gestionale, o la somma
    // arrotondata ordine per ordine, con un centesimo in piu' o in meno
    const arrot = (c) => Math.abs(surplusDi.get(c).arrotondamento) + 1;
    const perImporto = conSurplusGest.filter(c => Math.abs(centGest(c) - cent) <= arrot(c));
    const canale = surplusDi.has(scritto) ? scritto : canaliDelFile.length === 1 && surplusDi.has(canaliDelFile[0]) ? canaliDelFile[0] : perImporto.length === 1 ? perImporto[0] : '';
    if (canale) { surplusDi.get(canale).sole.push(voce); continue; }
    if (conSurplusGest.length > 1 && Math.abs(conSurplusGest.reduce((s, c) => s + centGest(c), 0) - cent) <= Math.abs(conSurplusGest.reduce((s, c) => s + surplusDi.get(c).arrotondamento, 0)) + 1) {
      for (const c of conSurplusGest) surplusDi.get(c).insieme.push({ ...voce, canali: conSurplusGest, quota_cent: centGest(c) });
      continue;
    }
    daAttribuire.push({ ...voce, spiegazione: `riga sola di surplus (${euroIt(r.importo)} €) senza ordine: non si capisce di quale canale sia${conSurplusGest.length ? `; nel gestionale ${conSurplusGest.map(c => `${nomeCanale[c]} ${euroIt(centGest(c) / 100)} €`).join(', ')}` : ', e il gestionale non ha surplus nel mese'}` });
  }

  // IL RIQUADRO DEL SURPLUS DI OGNI CANALE: gestionale, prefattura (con la forma
  // riconosciuta), scarto, esito. Il riquadro conta fra le differenze che fermano
  // l'esportazione solo se non torna. Senza surplus ne' di qua ne' di la' non c'e'.
  //
  // UNA PREFATTURA SENZA IL SURPLUS NON E' UNA DIFFERENZA (risposta dell'utente
  // del 13/10/2026). Se Ecotyre comunica il Fuel Surcharge fuori dalla
  // prefattura, la prefattura non lo porta mai: contarlo fra le differenze
  // voleva dire una conferma a ogni esportazione, ogni mese, per una cosa gia'
  // saputa. Ora il confronto lo SCRIVE soltanto («Fuel Surcharge, 1.609,15 €,
  // non è nella prefattura: si fattura a parte»), nel riquadro del canale e in
  // surplus_a_parte, e non lo conta. Solo quando la prefattura non porta nessun
  // surplus (surplusNelFile): se lo porta su una parte degli ordini resta «non
  // torna», e se lo porta su un altro canale, o in una riga che non si sa di
  // chi sia, il canale dove manca conta ancora, perche' allora non e' una
  // comunicazione a parte ma un surplus mancato.
  //
  // QUANDO UNO SCARTO E' ARROTONDAMENTO (revisione del 13/10/2026). Nelle forme a
  // e b la prefattura porta il surplus ordine per ordine: ogni ordine si controlla
  // col suo (i chili del gestionale per i suoi €/t, arrotondati), entro un
  // centesimo, e si dice quali ordini non l'hanno, quali l'hanno diverso (due
  // volte, per esempio) e quali l'hanno senza che il gestionale lo preveda. Se
  // ogni ordine torna, lo scarto col gestionale (che arrotonda una volta sul mese)
  // e' arrotondamento, e lo e' davvero. Nella forma c (una riga sola) di
  // arrotondamenti ce n'e' uno: la riga torna se fa quello del gestionale o la
  // somma arrotondata ordine per ordine, con un centesimo in piu' o in meno. Prima
  // la tolleranza era mezzo centesimo per ordine (2,05 € sulla rete di luglio
  // 2026) e ci passavano una riga sola sbagliata di 2,00 €, un ordine senza
  // surplus e un ordine col surplus due volte.
  const elencoOrdini = (ids) => (ids.length <= 3 ? ids.join(', ') : `${ids.slice(0, 3).join(', ')} e altri ${ids.length - 3}`);
  const suOrdini = (n) => (n === 1 ? 'un ordine' : `${n} ordini`);
  const senzaNumero = (v) => v === null || v === undefined;
  // Le forme in cui la prefattura porta il surplus di un canale.
  const formeDi = (s) => [
    s.nelPrezzo.ordini ? 'nel_prezzo' : '',
    s.perOrdine.length ? 'riga_per_ordine' : '',
    s.sole.length ? 'riga_sola' : '',
    s.insieme.length ? 'insieme' : '',
  ].filter(Boolean);
  // Nessun surplus nel gestionale ma lo stesso €/t in piu' su tanti ordini:
  // e' probabilmente un surplus che il gestionale non ha ancora. Gli ordini
  // restano «importo diverso»; il riquadro lo dice.
  const ipotesiDi = (c) => {
    if (centGest(c.canale) || formeDi(surplusDi.get(c.canale)).length || c.importo_diverso.length < 3 || !c.importo_diverso.every(x => x.kg > 0)) return null;
    // l'€/t si legge sull'ordine piu' pesante (il centesimo pesa meno), e ogni
    // ordine deve tornarci entro il suo arrotondamento
    const grande = c.importo_diverso.reduce((a, x) => (x.kg > a.kg ? x : a));
    const euroT = (grande.importo_prefattura - grande.importo_gestionale) / (grande.kg / 1000);
    if (!(euroT > 0) || !c.importo_diverso.every(x => Math.abs((x.importo_prefattura - x.importo_gestionale) - euroT * x.kg / 1000) <= 0.015)) return null;
    return { euro_t: r2(euroT), ordini: c.importo_diverso.length, euro: r2(c.importo_diverso.reduce((x, d) => x + d.importo_prefattura - d.importo_gestionale, 0)) };
  };
  // La prefattura porta un surplus da qualche parte: una riga (anche di un
  // canale che non si capisce), un prezzo con dentro il surplus, o lo stesso €/t
  // in piu' su tanti ordini. Allora un canale dove non c'e' non vuol dire «lo
  // comunica fuori»: e' un surplus mancato, e resta una differenza. Si fattura a
  // parte senza contarlo solo quando la prefattura non ne porta nessuno.
  const surplusNelFile = preSurplus.length > 0 || canali.some(c => formeDi(surplusDi.get(c.canale)).length > 0 || !!ipotesiDi(c));
  for (const c of canali) {
    const s = surplusDi.get(c.canale);
    const gestCent = centGest(c.canale);
    const gestKg = s.righe.reduce((x, r) => x + (Number(r.kg_riferimento) || 0), 0);
    // le righe per ordine della prefattura, ordine per ordine; un importo che
    // manca non e' zero: si conta a parte
    const perId = new Map();
    for (const v of s.perOrdine) {
      const e = perId.get(v.id_ordine) || { cent: 0, righe: 0, senza_importo: 0 };
      e.righe++;
      if (senzaNumero(v.importo)) e.senza_importo++; else e.cent += centesimi(v.importo);
      perId.set(v.id_ordine, e);
    }
    const righeSenzaImporto = s.perOrdine.filter(v => senzaNumero(v.importo)).length;
    const centPerOrdine = [...perId.values()].reduce((x, e) => x + e.cent, 0);
    const centSole = s.sole.reduce((x, v) => x + centesimi(v.importo), 0);
    const centInsieme = s.insieme.reduce((x, v) => x + v.quota_cent, 0);
    const forme = formeDi(s);
    const ipotesi = ipotesiDi(c);
    if (!gestCent && !forme.length && !ipotesi) continue;
    // Tutte le righe di surplus senza importo (una prefattura senza la colonna
    // dell'importo): il surplus c'e', quanto non si sa, e non si confronta.
    const tuttoSenzaImporto = righeSenzaImporto > 0 && righeSenzaImporto === s.perOrdine.length && !s.nelPrezzo.ordini && !s.sole.length && !s.insieme.length;
    const preCent = s.nelPrezzo.cent + centPerOrdine + centSole + centInsieme;
    const scarto = forme.length && !tuttoSenzaImporto ? preCent - gestCent : null;

    // Ordine per ordine (forme a e b, senza righe sole): ogni ordine col suo.
    const perOrdine = (s.nelPrezzo.ordini > 0 || s.perOrdine.length > 0) && !s.sole.length && !s.insieme.length;
    const ordini = { senza: [], diversi: [], in_piu: [], senza_importo: [], gia_fra_le_differenze: [] };
    // la parte dello scarto che viene da ordini gia' fra le differenze
    let centGia = 0;
    // e quella che viene dagli ordini che non tornano (senza importo esclusi)
    let centSbagliati = 0;
    if (perOrdine && gestCent && !tuttoSenzaImporto) {
      const ids = new Set([...s.attesoCent.keys(), ...perId.keys(), ...s.nelPrezzo.per.keys()]);
      for (const id of ids) {
        const atteso = s.attesoCent.get(id) || 0;
        const linee = perId.get(id);
        const trovato = (s.nelPrezzo.per.get(id) || 0) + (linee ? linee.cent : 0);
        const g = s.gest.get(id);
        const kg = g ? Math.round(g.kg) : null;
        // mancano nella prefattura, hanno peso o importo diversi, o non sono del
        // mese: sono gia' differenze, il loro surplus si chiarisce con loro
        if (s.giaDiverso.has(id) || (!g && pre.has(id))) { ordini.gia_fra_le_differenze.push(id); centGia += trovato - atteso; continue; }
        const p = pre.get(id);
        if ((linee && linee.senza_importo) || (!linee && s.nelPrezzo.ordini && p && !p.conImporto)) { ordini.senza_importo.push({ id_ordine: id, kg, atteso: atteso / 100 }); continue; }
        if (Math.abs(trovato - atteso) <= 1) continue;
        centSbagliati += trovato - atteso;
        if (!trovato) ordini.senza.push({ id_ordine: id, kg, atteso: atteso / 100 });
        else if (!atteso) ordini.in_piu.push({ id_ordine: id, kg, importo: trovato / 100, righe: linee ? linee.righe : 0 });
        else ordini.diversi.push({ id_ordine: id, kg, importo: trovato / 100, atteso: atteso / 100, righe: linee ? linee.righe : 0 });
      }
    }
    const sbagliati = ordini.senza.length + ordini.diversi.length + ordini.in_piu.length + ordini.senza_importo.length;
    const esito = ipotesi ? 'ipotesi'
      : !forme.length ? (c.fuori_prefattura ? 'fuori_prefattura' : 'assente')
        : tuttoSenzaImporto ? 'senza_importo'
          : !gestCent ? 'solo_prefattura'
            : sbagliati ? 'non_torna'
              : perOrdine ? (centGia ? 'non_torna' : scarto === 0 ? 'torna' : 'arrotondamento')
                : scarto === 0 ? 'torna'
                  : Math.abs(scarto) <= Math.abs(s.arrotondamento) + 1 ? 'arrotondamento'
                    : 'non_torna';
    const nomi = [...new Set(s.righe.map(r => r.descrizione).filter(Boolean))].join(' e ') || 'Surplus';
    // non nella prefattura, che non ne porta nessuno: si fattura a parte
    const aParte = esito === 'assente' && !surplusNelFile;
    // su che cosa si conta: «1.122,24 t × 5,00 €/t», o le righe una per una
    const base = s.righe.length === 1
      ? `${tIt(gestKg)} t × ${euroTIt(s.righe[0].tariffa_valore)}`
      : s.righe.map(r => `${tIt(r.kg_riferimento)} t × ${euroTIt(r.tariffa_valore)}`).join(' + ');
    const quanto = `${euroIt(gestCent / 100)} € nel gestionale (${base})`;
    const come = [
      s.nelPrezzo.ordini ? `nel prezzo di ${suOrdini(s.nelPrezzo.ordini)}` : '',
      s.perOrdine.length ? `con ${s.perOrdine.length === 1 ? 'una riga' : `${s.perOrdine.length} righe`} per ordine` : '',
      s.sole.length ? `con ${s.sole.length === 1 ? 'una riga sola' : `${s.sole.length} righe senza ordine`}` : '',
      s.insieme.length ? `in una riga sola insieme a ${s.insieme[0].canali.filter(x => x !== c.canale).map(x => nomeCanale[x]).join(' e ')}` : '',
    ].filter(Boolean).join(', ');
    const quantoScarto = scarto ? `${euroIt(Math.abs(scarto) / 100)} € ${scarto > 0 ? 'in più' : 'in meno'}` : '';
    const cosaNonTorna = [
      ordini.senza.length ? `manca su ${suOrdini(ordini.senza.length)} (${elencoOrdini(ordini.senza.map(x => x.id_ordine))})` : '',
      ordini.diversi.length ? `è diverso su ${suOrdini(ordini.diversi.length)} (${ordini.diversi.slice(0, 3).map(x => `${x.id_ordine}: ${euroIt(x.importo)} € invece di ${euroIt(x.atteso)} €`).join(', ')}${ordini.diversi.length > 3 ? ` e altri ${ordini.diversi.length - 3}` : ''})` : '',
      ordini.in_piu.length ? `c'è su ${suOrdini(ordini.in_piu.length)} che nel gestionale non l'${ordini.in_piu.length === 1 ? 'ha' : 'hanno'} (${elencoOrdini(ordini.in_piu.map(x => x.id_ordine))})` : '',
      ordini.senza_importo.length ? `è senza importo su ${suOrdini(ordini.senza_importo.length)} (${elencoOrdini(ordini.senza_importo.map(x => x.id_ordine))})` : '',
    ].filter(Boolean).join('; ');
    const gia = ordini.gia_fra_le_differenze;
    const conclusione = esito === 'torna' ? 'Torna al centesimo.'
      : esito === 'arrotondamento' ? (perOrdine
        ? `${quantoScarto}: è l'arrotondamento ordine per ordine (il gestionale arrotonda una volta sul mese), e ogni ordine torna col suo surplus entro il centesimo.`
        : `${quantoScarto}: è l'arrotondamento (il surplus arrotondato ordine per ordine fa ${euroIt((gestCent + s.arrotondamento) / 100)} €, sul mese ${euroIt(gestCent / 100)} €).`)
        : sbagliati ? `${!centSbagliati && sbagliati > ordini.senza_importo.length ? 'In tutto torna, ma solo perché le differenze si compensano. ' : ''}Ordine per ordine non torna${centSbagliati ? `, ${euroIt(Math.abs(centSbagliati) / 100)} € ${centSbagliati > 0 ? 'in più' : 'in meno'}` : ''}: ${cosaNonTorna}. Va chiarito prima di fatturare.`
          : centGia ? `${quantoScarto} del gestionale, per ${gia.length === 1 ? `l'ordine ${gia[0]}, che è` : `gli ordini ${elencoOrdini(gia)}, che sono`} già fra le differenze qui sopra: si chiarisce con ${gia.length === 1 ? 'quella' : 'quelle'}. Sugli altri ordini torna entro il centesimo.`
            : `${quantoScarto} del gestionale: va chiarito prima di fatturare.`;
    const testo = esito === 'ipotesi'
      ? `${ipotesi.ordini} ordini hanno ${euroTIt(ipotesi.euro_t)} in più del gestionale, tutti uguali (${euroIt(ipotesi.euro)} €): se è un surplus del consorzio, come il Fuel Surcharge, scrivilo nella scheda Surplus delle tariffe con le sue date, e il confronto lo riconoscerà nel prezzo.`
      : esito === 'fuori_prefattura' ? `${nomi}: ${quanto}. L'extra raccolta non passa dalla prefattura: il surplus si fattura col canale.`
        : esito === 'assente' ? (aParte
          ? `${nomi}, ${euroIt(gestCent / 100)} € (${base}), non è nella prefattura: si fattura a parte. Non è una differenza: la prefattura non porta nessun surplus, né nei prezzi né in una riga.`
          : `${nomi}: ${quanto}, ma la prefattura su questo canale non lo porta, mentre altrove un surplus lo porta: va chiarito prima di fatturare.`)
          : esito === 'senza_importo' ? `${gestCent ? `${nomi}: ${quanto}; la prefattura lo porta` : 'La prefattura porta un surplus'} ${come}, ma senza importo (—): non si può confrontare${conImporti ? ', e va chiarito prima di fatturare.' : ' (il file non ha la colonna degli importi).'}`
            : esito === 'solo_prefattura' ? `La prefattura porta un surplus di ${euroIt(preCent / 100)} € ${come}, che il gestionale non ha: se vale, scrivilo nella scheda Surplus delle tariffe con le sue date.`
              : `${nomi}: ${quanto}; la prefattura lo porta ${come}, ${euroIt(preCent / 100)} €. ${conclusione}`;
    c.surplus = {
      gestionale: { righe: s.righe.map(r => ({ surplus_id: r.surplus_id || '', nome: r.descrizione || '', euro_t: Number(r.tariffa_valore) || 0, kg: Number(r.kg_riferimento) || 0, ordini: Number(r.record_count) || 0, totale: r2(Number(r.totale) || 0) })), kg: Math.round(gestKg), euro: gestCent / 100 },
      prefattura: { forme, euro: forme.length && !tuttoSenzaImporto ? preCent / 100 : null, ordini_nel_prezzo: s.nelPrezzo.ordini, righe_per_ordine: s.perOrdine.length, righe_sole: s.sole.length + s.insieme.length },
      scarto: scarto === null ? null : scarto / 100,
      // quanto l'arrotondamento ordine per ordine si scosta dalla riga sul mese
      arrotondamento: s.arrotondamento / 100,
      esito,
      // ordine per ordine (forme a e b): dove non torna
      ordini,
      // conta fra le differenze se non torna; l'ipotesi no, perche' i suoi ordini
      // sono gia' fra gli importi diversi; un surplus senza importo si', se il
      // resto del file gli importi li ha. Quello che la prefattura non porta
      // affatto no: si fattura a parte, e si scrive (13/10/2026, vedi sopra).
      conta: ['solo_prefattura', 'non_torna'].includes(esito) || (esito === 'senza_importo' && conImporti) || (esito === 'assente' && !aParte),
      // vero quando si fattura a parte: la prefattura non porta nessun surplus
      a_parte: aParte,
      ipotesi,
      testo,
    };
  }

  // Le terziarie (ordini TER...): il portale le paga come "Trasp" a 8 euro la
  // tonnellata con l'allegato VII e a 10 col formulario (prefatture gennaio-agosto
  // 2026: 105 ordini, 25.846,51 euro). Decisione della direzione (20/09/2026): per
  // ora restano FUORI dalla fatturazione attiva e dai tre report, in una sezione
  // a parte tenuta pronta per quando servira'. Percio' non sono una differenza:
  // si mostrano col loro totale, e basta.
  const terziarie = { ordini: 0, kg: 0, euro: 0, righe: [] };
  for (const [id, p] of pre) {
    if (visti.has(id) || !/^TER/.test(id)) continue;
    visti.add(id);
    terziarie.ordini++; terziarie.kg += p.kg; terziarie.euro += centesimi(p.importo);
    const a = altrove.get(id) || null;
    // Le date obbligatorie del formulario nell'archivio Terziarie (22/09/2026):
    // a.date e' il testoDate() di movimenti.ts, '' se sono a posto.
    terziarie.righe.push({
      id_ordine: id, numero_fir: p.fir, kg: Math.round(p.kg), importo: r2(p.importo), prezzo_t: p.kg ? r2(p.importo / (p.kg / 1000)) : null, in_archivio: !!a,
      date: a && a.stato === 'terminato' ? (a.date || '') : '',
    });
  }
  terziarie.kg = Math.round(terziarie.kg); terziarie.euro = terziarie.euro / 100;
  terziarie.non_in_archivio = terziarie.righe.filter(x => !x.in_archivio).length;
  terziarie.date_da_sistemare = terziarie.righe.filter(x => x.date).length;

  // Ordini della prefattura che il mese del gestionale non ha: si dice dove stanno
  const soloPrefattura = [];
  for (const [id, p] of pre) {
    if (visti.has(id)) continue;
    const a = altrove.get(id) || null;
    soloPrefattura.push({
      id_ordine: id, kg: p.conKg ? Math.round(p.kg) : null, importo: p.conImporto ? r2(p.importo) : null,
      canale: a ? a.canale : '', stato: a ? a.stato : '', giorno: a ? a.giorno : '',
      // Un terminato senza fine trasporto non e' in nessun mese: si dice quale
      // data manca, perche' le tre date del formulario sono obbligatorie
      // (22/09/2026); a.date e' il testoDate() di movimenti.ts, se c'e'.
      spiegazione: !a ? 'ordine sconosciuto al gestionale'
        : a.stato !== 'terminato' ? `nel gestionale è ${a.stato || 'senza stato'}`
        : !a.giorno ? `nel gestionale è terminato ma ${a.date || 'manca la data di fine trasporto'}: resta fuori da ogni mese finché la data non si scrive (immissione, inizio e fine trasporto sono obbligatorie)`
        : `nel gestionale la fine trasporto è il ${a.giorno.split('-').reverse().join('/')}: un altro mese${a.date ? ` (e le date sono da sistemare: ${a.date})` : ''}`,
    });
  }
  // UNA DICITURA DIVERSA NON E' UNA DIFFERENZA DI FATTURAZIONE (06/10/2026).
  //
  // Quello che deve quadrare sono i chili e gli importi. La dicitura - «Trasp.»
  // o «Trasp.+Tratt.» - non cambia il prezzo: a Ecotyre la rete si fattura con
  // una tariffa unica (202 €/t nel 2026), e nella prefattura di luglio tutte le
  // 410 righe di rete sono a 0,202 €/kg, comprese le 37 che il portale etichetta
  // «Trasp». Contandola fra le differenze, l'avviso che ferma la mano prima di
  // esportare compariva su un mese che quadrava al centesimo.
  //
  // Resta scritta e si vede, perche' dice da chi il portale si aspetta il
  // trattamento: e' un'osservazione, non un errore di fatturazione.
  // Il surplus: un riquadro che non torna conta una volta per canale, e una riga
  // di surplus che non si sa di quale canale sia conta anche lei (13/10/2026).
  const differenze = soloPrefattura.length + daAttribuire.length
    + canali.reduce((s, c) => s + (c.fuori_prefattura ? 0 : c.solo_gestionale.length) + c.peso_diverso.length + c.importo_diverso.length + c.fir_diverso.length + (c.surplus && c.surplus.conta ? 1 : 0), 0);
  const diciture_diverse = canali.reduce((s, c) => s + c.servizio_diverso.length, 0);
  // Il surplus che la prefattura non porta e si fattura a parte, canale per
  // canale: non e' una differenza, ma la pagina delle esportazioni lo dice
  // accanto all'esito del confronto (13/10/2026).
  const surplus_a_parte = canali.filter(c => c.surplus && c.surplus.a_parte).map(c => ({
    canale: c.canale,
    nome: [...new Set(c.surplus.gestionale.righe.map(r => r.nome).filter(Boolean))].join(' e ') || 'Surplus',
    euro: c.surplus.gestionale.euro,
    testo: c.surplus.testo,
  }));
  return {
    coincide: differenze === 0 && pre.size > 0,
    differenze,
    // quante righe hanno solo la dicitura diversa: si dicono, non fermano niente
    diciture_diverse,
    ordini_prefattura: pre.size,
    con_importi: conImporti, con_pesi: conPesi,
    canali, solo_prefattura: soloPrefattura, terziarie,
    // le righe di surplus della prefattura che non si sa a quale canale dare
    surplus_da_attribuire: daAttribuire,
    // il surplus che la prefattura non porta: si fattura a parte, non conta
    surplus_a_parte,
  };
}
