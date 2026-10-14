// QUANTO CI SI ATTENDE DAL CONTRATTO A UNA DATA (chiusura dell'audit, 11/10/2026).
//
// Il numero che la direzione guarda per primo e' «Target RETE del contratto»:
// detto da solo (76,4%) non dice se e' buono o cattivo, ci vuole l'atteso a
// quella data. Prima c'era solo in Target & Status, nell'Andamento per regione,
// e si contava sul giorno del dispositivo; il controllo dei target mensili
// (checkTargetAlerts) lo contava invece sui giorni coperti dai dati. Due giorni
// di riferimento per la stessa domanda: con i dati fermi al 7 e oggi il 10 la
// pagina mostrava uno scarto peggiore di tre giorni di raccolta. La regola ora e'
// una, qui, e la usano la Dashboard (getDashboardRaccolta), l'Andamento per
// regione di Target & Status e checkTargetAlerts:
// - l'atteso segue il profilo mensile del contratto (target_mensile_json)
//   riportato all'annuo, perche' il profilo del 2026 somma 11.571,64 t e non
//   11.550; senza profilo, i dodicesimi;
// - i mesi finiti contano interi, il mese dei dati in proporzione ai giorni che
//   i dati coprono: fino al giorno dell'ultimo ritiro terminato, mai oltre oggi.
//
// IL TARGET ANNUO E IL RIPARTO PER REGIONE vengono dal contratto dell'anno
// (CommessaEcotyre, scelto con commessaDellAnno di annoTarget.ts). Le costanti
// del 2025 e del 2026 restano solo come ripiego dichiarato, e chi le usa lo
// dice: la Dashboard le aveva scritte per conto suo e il riparto del 2026 valeva
// per ogni anno, cosi' il 2027 prima della copia diceva «su 0 t» nel numero e
// 11.550 t nel grafico. Un anno senza contratto non ha target: «—» e un avviso,
// come in Target & Status.
//
// LE VARIAZIONI DEL CONTRATTO IN CORSO D'ANNO (14/10/2026) stanno in fondo:
// vedi variazioneDelContratto. Nell'atteso ognuna conta intera nel suo mese e
// nella sua regione: l'atteso di una regione si chiede ad attesoDellaRegione,
// non ad attesoAllaData col target della regione.
//
// Lo specchio per il browser e' src/lib/attesoContratto.js (prove/specchi.mjs).
import { daConfermare } from "./annoTarget.ts";
import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";
import { giornoRoma } from "./giornoItaliano.ts";

/** Il target annuo RETE quando il contratto dell'anno non c'e': solo per questi anni, e lo si dice. */
export const TARGET_ANNUO_RIPIEGO = { 2025: 11200, 2026: 11550 };

/** Il riparto per regione del contratto 2026, solo per il 2026 e solo se il contratto non lo porta. */
export const REGIONI_RIPIEGO = {
  2026: { Campania: 4400, Puglia: 2500, Basilicata: 500, Calabria: 1650, Sicilia: 2500 },
};

const lista = (json) => {
  try {
    const v = typeof json === 'string' ? JSON.parse(json || '[]') : json;
    return Array.isArray(v) ? v : [];
  } catch { return []; }
};
const due = (n) => String(n).padStart(2, '0');

/** I giorni di un mese (indice 0-11). */
export const giorniDelMese = (anno, meseIdx) => new Date(Date.UTC(Number(anno), meseIdx + 1, 0)).getUTCDate();

/**
 * Il giorno fin dove arrivano i dati: l'ultimo giorno con un dato, mai oltre
 * oggi (una data sbagliata nel futuro non deve far sembrare coperto un mese che
 * non lo e'). Stringa vuota se non c'e' nessun dato. Giorni italiani 'AAAA-MM-GG'.
 */
export const giornoDeiDati = (ultimo, oggi = '') => (!ultimo ? '' : oggi && ultimo > oggi ? oggi : ultimo);

/**
 * Quanti giorni di un mese coprono i dati: fino all'ultimo giorno con un dato e
 * mai oltre oggi. Un mese tutto prima conta intero, uno tutto dopo zero.
 */
export function giorniCopertiNelMese(anno, meseIdx, ultimoGiornoDati, oggi = '') {
  const limite = giornoDeiDati(ultimoGiornoDati, oggi);
  if (!limite) return 0;
  const tot = giorniDelMese(anno, meseIdx);
  const inizio = `${anno}-${due(meseIdx + 1)}-01`;
  const fine = `${anno}-${due(meseIdx + 1)}-${due(tot)}`;
  if (limite < inizio) return 0;
  if (limite >= fine) return tot;
  return Number(limite.slice(8, 10));
}

/** La parte di un mese coperta dai dati, fra 0 e 1. */
export const frazioneDelMese = (anno, meseIdx, ultimoGiornoDati, oggi = '') =>
  giorniCopertiNelMese(anno, meseIdx, ultimoGiornoDati, oggi) / giorniDelMese(anno, meseIdx);

/**
 * Il target annuo RETE di un anno: { t, fonte, da_confermare }.
 * fonte: 'contratto' (target_annuo_t del contratto), 'ripiego' (le costanti
 * qui sopra: il contratto non e' inserito o non ha il target annuo) o null
 * (nessun target: si mostra «—», mai 0). da_confermare: il contratto e' una
 * copia dell'anno prima non ancora confermata, e va detto.
 */
export function targetAnnuoDellAnno(commessa, anno) {
  const t = Number(commessa && commessa.target_annuo_t);
  if (t > 0) return { t, fonte: 'contratto', da_confermare: daConfermare(commessa) };
  const r = TARGET_ANNUO_RIPIEGO[Number(anno)];
  if (r) return { t: r, fonte: 'ripiego', da_confermare: false };
  return { t: null, fonte: null, da_confermare: false };
}

/**
 * Il contratto per regione di un anno: { righe: [{ regione, target_t, ... }], fonte }
 * con la stessa logica del target annuo; il riparto scritto nel codice vale solo
 * per il 2026, l'anno da cui viene.
 */
export function regioniDellAnno(commessa, anno) {
  const righe = commessa ? lista(commessa.regioni_json).filter(r => r && r.regione) : [];
  if (righe.length) return { righe: righe.map(r => ({ ...r, target_t: Number(r.target_t) || 0 })), fonte: 'contratto' };
  const r = REGIONI_RIPIEGO[Number(anno)];
  if (r) return { righe: Object.entries(r).map(([regione, target_t]) => ({ regione, target_t })), fonte: 'ripiego' };
  return { righe: [], fonte: null };
}

// LE VARIAZIONI NELL'ATTESO (revisione del 14/10/2026). Una variazione del
// consorzio e' di un mese e di una regione: le 100 t in piu' di ottobre in
// Puglia si attendono tutte a ottobre e tutte in Puglia. Prima l'atteso di ogni
// regione era «target della regione per la quota nazionale»: le 100 t si
// spalmavano su tutto l'anno della Puglia (al 08/10 un atteso di 38,41 t
// troppo alto) e le altre quattro regioni, che non erano cambiate, vedevano
// cambiare atteso e scarto (la Campania 18,63 t in meno). Ora la parte del
// contratto senza variazioni segue il profilo di base, cioe' il target mensile
// rivisto senza le variazioni che ci sono state scritte dentro, e ogni
// variazione sta intera nel suo mese: per il totale (profiloMensile) e per la
// regione (attesoDellaRegione). Senza variazioni i conti sono quelli di prima.
// Contano solo le variazioni che il contratto comprende ancora (in_vigore, vedi
// variazioniDelContratto).

const meseValido = (v) => Number.isInteger(Number(v.mese_idx)) && Number(v.mese_idx) >= 0 && Number(v.mese_idx) <= 11;

// Il profilo di base: il target mensile rivisto senza le variazioni in vigore
// che ci sono state scritte, riportato a 1; senza profilo, i dodicesimi.
function pesiDiBase(commessa, inVigore) {
  const scritti = commessa ? lista(commessa.target_mensile_json) : [];
  const valori = Array.from({ length: 12 }, (_, i) => Number(scritti[i]) || 0);
  for (const v of inVigore) if (v.nel_mese && meseValido(v)) valori[Number(v.mese_idx)] -= Number(v.t) || 0;
  const base = valori.map(v => Math.max(0, v));
  const totale = base.reduce((s, v) => s + v, 0);
  return totale > 0 ? base.map(v => v / totale) : base.map(() => 1 / 12);
}

// I pesi mese per mese di un target (l'annuo o una regione) che comprende delle
// variazioni: la parte senza variazioni segue il profilo di base, ogni
// variazione sta tutta nel suo mese. Sommano 1.
function pesiConVariazioni(base, targetT, variazioni) {
  const t = Number(targetT);
  if (!(t > 0) || !variazioni.length) return base;
  const somma = variazioni.reduce((s, v) => s + (Number(v.t) || 0), 0);
  const pesi = base.map(p => ((t - somma) * p) / t);
  for (const v of variazioni) if (meseValido(v)) pesi[Number(v.mese_idx)] += (Number(v.t) || 0) / t;
  return pesi;
}

const inVigore = (commessa) => variazioniDelContratto(commessa).filter(v => v.in_vigore);

/**
 * Il profilo mensile del contratto riportato all'annuo: dodici pesi che sommano
 * 1. rivisto: il profilo viene dal contratto (altrimenti sono dodicesimi);
 * totale: quanto somma il profilo scritto, che puo' non essere il target annuo.
 * Le variazioni in vigore stanno intere nel loro mese (vedi sopra).
 */
export function profiloMensile(commessa) {
  const scritti = commessa ? lista(commessa.target_mensile_json) : [];
  const totale = Array.from({ length: 12 }, (_, i) => Number(scritti[i]) || 0).reduce((s, v) => s + v, 0);
  const variazioni = inVigore(commessa);
  const pesi = pesiConVariazioni(pesiDiBase(commessa, variazioni), commessa && commessa.target_annuo_t, variazioni);
  return totale > 0 ? { pesi, totale, rivisto: true } : { pesi, totale: 0, rivisto: false };
}

// La quota attesa di un profilo fino al giorno dei dati.
function quotaDeiPesi(pesi, anno, giornoDati) {
  if (!giornoDati) return null;
  const a = Number(anno);
  const annoDati = Number(giornoDati.slice(0, 4));
  if (annoDati > a) return 1;
  if (annoDati < a) return 0;
  let q = 0;
  for (let i = 0; i < 12; i++) q += pesi[i] * frazioneDelMese(a, i, giornoDati);
  return Math.min(1, q);
}

/**
 * La quota del target annuo attesa fino al giorno dei dati, fra 0 e 1: i mesi
 * coperti interi, il mese dei dati per i giorni coperti. null se non si sa fin
 * dove arrivano i dati (nessun dato).
 */
export function quotaAttesa(commessa, anno, giornoDati) {
  return quotaDeiPesi(profiloMensile(commessa).pesi, anno, giornoDati);
}

/**
 * L'atteso alla data: { giorno, quota, target_t, atteso_t }. target_t e' il
 * target annuo del contratto (targetAnnuoDellAnno) se chi chiama non ne passa
 * uno suo. Per una regione del contratto c'e' attesoDellaRegione: qui un target
 * passato prende la quota del totale, con le variazioni di tutte le regioni.
 * atteso_t e' null quando manca il target o il giorno dei dati: un atteso
 * inventato e' peggio di nessuno.
 */
export function attesoAllaData(commessa, anno, giornoDati, targetT = undefined) {
  const t = targetT === undefined ? targetAnnuoDellAnno(commessa, anno).t : targetT;
  const quota = quotaAttesa(commessa, anno, giornoDati);
  const conTarget = t !== null && t !== undefined && Number.isFinite(Number(t));
  return {
    giorno: giornoDati || null,
    quota,
    target_t: conTarget ? Number(t) : null,
    atteso_t: conTarget && quota !== null ? Number(t) * quota : null,
  };
}

/**
 * L'atteso alla data di una regione del contratto: { giorno, quota, target_t,
 * atteso_t, variazioni_t }. target_t e' il contratto della regione
 * (regioniDellAnno, con le variazioni); la parte senza variazioni segue il
 * profilo di base, le variazioni in vigore della regione stanno intere nel loro
 * mese, e quelle delle altre regioni non la toccano. Le regioni sommano
 * l'atteso del totale quando sommano il target annuo. Da usare al posto di
 * attesoAllaData col target della regione, che darebbe a ogni regione la quota
 * nazionale e quindi un pezzo delle variazioni di tutte.
 */
export function attesoDellaRegione(commessa, anno, giornoDati, regione) {
  const riga = regioniDellAnno(commessa, anno).righe.find(r => stessaRegione(r.regione, regione));
  const t = riga ? Number(riga.target_t) : null;
  const tutte = inVigore(commessa);
  const sue = tutte.filter(v => stessaRegione(v.regione, regione));
  const quota = quotaDeiPesi(pesiConVariazioni(pesiDiBase(commessa, tutte), t, sue), anno, giornoDati);
  return {
    giorno: giornoDati || null,
    quota,
    target_t: t,
    atteso_t: t !== null && Number.isFinite(t) && quota !== null ? t * quota : null,
    variazioni_t: tre(sue.reduce((s, v) => s + (Number(v.t) || 0), 0)),
  };
}

// LE VARIAZIONI DEL CONTRATTO IN CORSO D'ANNO (14/10/2026).
//
// Richiesta dell'utente del 14/10/2026: per ottobre il consorzio ha dato a SMOCO
// 100 t in piu' in Puglia, e lui le aveva aggiunte al target di SMOCO nella
// scheda dei raccoglitori («il target è passato a 11.650 t»). Il contratto era
// rimasto a 11.550 t, e dashboard, atteso alla data, proiezione, Andamento ed
// EcoTyna, che leggono il contratto, non si muovevano: «non sto notando che da
// altre parti la modifica viene interessata». Una variazione del consorzio si
// registra nel contratto, con una scrittura sola: target annuo, target della
// regione, target mensile rivisto del mese e, se si dice, la quantita' della
// destinazione; piu' una voce nello storico della commessa (storico_json) col
// motivo e il giorno della comunicazione. Tutti i moduli leggono gia' quei
// campi, e nessun conto si rifa' altrove. Le variazioni dell'anno sono le voci
// dello storico che portano «variazione».

const NOMI_MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

/** Sotto mezza tonnellata la differenza fra raccoglitori e contratto e' un arrotondamento: la scheda dei raccoglitori la colora gia' cosi'. */
export const SOGLIA_VARIAZIONE_T = 0.5;

const tre = (n) => Math.round(Number(n) * 1000) / 1000;
const stessaRegione = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
const nomeSemplice = (s) => normalizzaRagioneSociale(String(s || '')).replace(/[^a-z0-9]/g, '');
// Un giorno vero 'AAAA-MM-GG': il 31/02 non c'e' (Date.parse lo accetterebbe).
const giornoValido = (g) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(g || ''));
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
};

/**
 * La destinazione del contratto (destinazioni_json) che corrisponde a un
 * impianto dei target dei raccoglitori, se il nome si riconosce («IRIGOM SRL» e'
 * «IRIGOM»). Stringa vuota se no: allora non si propone niente.
 */
export function destinazioneDelContratto(commessa, impianto) {
  const k = nomeSemplice(impianto);
  if (!k) return '';
  const d = lista(commessa && commessa.destinazioni_json).find(x => x && x.destinazione && nomeSemplice(x.destinazione) === k);
  return d ? d.destinazione : '';
}

// QUANDO UNA VARIAZIONE NON E' PIU' NEL CONTRATTO (revisione del 14/10/2026).
// La voce resta nello storico per sempre, ma i numeri si possono riscrivere
// dopo: un foglio del contratto importato e salvato, una tabella corretta a
// mano, una scheda aperta prima della variazione e salvata dopo. Prima l'elenco
// continuava a dire «compresa nel contratto», «senza le variazioni sarebbe»
// sbagliava di 100 t e la stessa variazione si poteva registrare due volte. Ora
// si segue, voce per voce, il numero che ogni variazione ha scritto (il target
// della regione e, se l'ha scritto, quello del mese): finche' resta quello, la
// variazione e' in vigore; se un salvataggio lo cambia, o lo trova gia' diverso,
// la variazione e' superata da quel salvataggio e vale il contratto scritto.
// Basta lo storico: ogni salvataggio della tabella mette nella sua voce i
// valori di prima, la voce seguente (o il contratto di oggi) quelli di dopo.
// Una correzione del solo target annuo, o di un'altra regione o di un altro
// mese, non la tocca.

const MEZZO_CHILO = 0.0005;
const valoreDi = (campo, json, regione, meseIdx) => {
  if (campo === 'regioni_json') {
    const r = lista(json).find(x => x && stessaRegione(x.regione, regione));
    return r ? Number(r.target_t) || 0 : null;
  }
  return Number(lista(json)[meseIdx]) || 0;
};
const diverso = (a, b) => (a === null || b === null ? a !== b : Math.abs(a - b) >= MEZZO_CHILO);

/**
 * Le variazioni registrate nel contratto dell'anno, dalla prima all'ultima:
 * [{ il, da, mese_idx, mese, regione, t, destinazione, motivo, comunicata_il,
 * nel_mese, in_vigore, superata }]. il e da sono quando e chi l'ha registrata;
 * comunicata_il il giorno della comunicazione del consorzio; nel_mese dice se e'
 * stata scritta anche nel target mensile rivisto. in_vigore: il contratto di
 * oggi la comprende ancora; altrimenti superata e' { il, da, nota } del
 * salvataggio che ha riscritto i suoi numeri (il vuoto se non e' nello storico).
 */
export function variazioniDelContratto(commessa) {
  const storico = lista(commessa && commessa.storico_json);
  const out = [];
  const posto = []; // la voce dello storico di ogni variazione
  // per ogni numero scritto da variazioni: il valore che deve avere e quali variazioni lo portano
  const seguiti = new Map();
  const supera = (chiave, chi) => {
    for (const i of seguiti.get(chiave).variazioni) if (out[i].in_vigore) { out[i].in_vigore = false; out[i].superata = chi; }
    seguiti.delete(chiave);
  };
  const leggi = (s, json) => valoreDi(s.campo, json, s.regione, s.mese_idx);
  // il valore di un campo subito dopo la voce j: il «prima» della prima voce che segue e lo porta, o quello di oggi
  const dopo = (j, campo) => {
    for (let x = j + 1; x < storico.length; x++) {
      const p = storico[x] && storico[x].prima;
      if (p && typeof p === 'object' && campo in p) return p[campo];
    }
    return commessa[campo];
  };
  let ultimaAltra = null;
  storico.forEach((voce, j) => {
    if (!voce || typeof voce !== 'object') return;
    const p = voce.prima && typeof voce.prima === 'object' ? voce.prima : null;
    const chi = { il: voce.il || '', da: voce.da || '', nota: voce.nota || '', j };
    // prima di questa voce il numero era gia' cambiato, senza passare dallo storico o da una scheda aperta prima
    for (const [k, s] of [...seguiti]) if (p && s.campo in p && diverso(leggi(s, p[s.campo]), s.valore)) supera(k, chi);
    const v = voce.variazione && typeof voce.variazione === 'object' ? voce.variazione : null;
    if (!v) {
      // un salvataggio che riscrive il numero
      for (const [k, s] of [...seguiti]) if (p && s.campo in p && diverso(leggi(s, dopo(j, s.campo)), s.valore)) supera(k, chi);
      ultimaAltra = chi;
      return;
    }
    const meseIdx = Number(v.mese_idx);
    const nelMese = !!(p && 'target_mensile_json' in p);
    const i = out.push({ il: voce.il || '', da: voce.da || '', ...v, mese: NOMI_MESI[meseIdx] || '', nel_mese: nelMese, in_vigore: true, superata: null }) - 1;
    posto[i] = j;
    const numeri = [{ k: `regione|${String(v.regione || '').trim().toLowerCase()}`, campo: 'regioni_json', regione: v.regione }];
    if (nelMese) numeri.push({ k: `mese|${meseIdx}`, campo: 'target_mensile_json', mese_idx: meseIdx });
    for (const n of numeri) {
      if (!p || !(n.campo in p)) continue;
      const primaT = leggi(n, p[n.campo]);
      seguiti.set(n.k, { ...n, valore: tre((primaT || 0) + (Number(v.t) || 0)), variazioni: [...(seguiti.has(n.k) ? seguiti.get(n.k).variazioni : []), i] });
    }
  });
  // e il contratto di oggi li deve portare ancora
  for (const [k, s] of [...seguiti]) {
    if (!diverso(leggi(s, commessa[s.campo]), s.valore)) continue;
    const ultimaSua = Math.max(...s.variazioni.map(i => posto[i]));
    supera(k, ultimaAltra && ultimaAltra.j > ultimaSua ? ultimaAltra : { il: '', da: '', nota: '', j: -1 });
  }
  return out.map(v => ({ ...v, superata: v.superata ? { il: v.superata.il, da: v.superata.da, nota: v.superata.nota } : null }));
}

/**
 * Una variazione del contratto prima di scriverla. variazione: { mese_idx (0-11),
 * regione, t (in piu', o in meno col segno), destinazione (facoltativa), motivo,
 * comunicata_il ('AAAA-MM-GG') }. Restituisce { errori, avvisi, patch, prima,
 * righe, voce }:
 * - errori: perche' non si puo' registrare (vuoto se si puo');
 * - patch: i campi della commessa da scrivere, prima: gli stessi com'erano;
 * - righe: [{ cosa, prima_t, dopo_t }], per mostrarla prima di confermare;
 * - voce: la variazione come resta nello storico (storicoConVariazione).
 * I target che cambiano si arrotondano al chilo; nessuno puo' andare sotto zero.
 */
export function variazioneDelContratto(commessa, variazione) {
  const v = variazione || {};
  const nulla = (errori, avvisi = []) => ({ errori, avvisi, patch: null, prima: null, righe: [], voce: null });
  if (!commessa) return nulla(["Il contratto dell'anno non è inserito: inseriscilo prima nella scheda Commessa Ecotyre."]);
  const errori = [];
  const avvisi = [];
  const annuo = Number(commessa.target_annuo_t);
  const meseIdx = v.mese_idx === '' || v.mese_idx === null || v.mese_idx === undefined ? NaN : Number(v.mese_idx);
  const t = v.t === '' || v.t === null || v.t === undefined ? NaN : Number(v.t);
  const motivo = String(v.motivo || '').trim();
  const comunicataIl = String(v.comunicata_il || '').trim();
  const destinazione = String(v.destinazione || '').trim();
  if (!(annuo > 0)) errori.push('Il contratto non ha il target annuo: scrivilo prima nella tabella del contratto.');
  if (!Number.isInteger(meseIdx) || meseIdx < 0 || meseIdx > 11) errori.push('Scegli il mese della variazione.');
  const regioni = lista(commessa.regioni_json);
  const iRegione = regioni.findIndex(r => r && stessaRegione(r.regione, v.regione));
  if (!String(v.regione || '').trim()) errori.push('Scegli la regione.');
  else if (iRegione < 0) errori.push(`${String(v.regione).trim()} non è fra le regioni del contratto: aggiungila prima nella tabella del contratto.`);
  if (!Number.isFinite(t) || Math.abs(t) < 0.001) errori.push('Scrivi le tonnellate in più o in meno, per esempio 100 o -50.');
  const destinazioni = lista(commessa.destinazioni_json);
  const iDest = destinazione ? destinazioni.findIndex(d => d && String(d.destinazione || '').trim().toLowerCase() === destinazione.toLowerCase()) : -1;
  if (destinazione && iDest < 0) errori.push(`${destinazione} non è fra le destinazioni del contratto.`);
  if (!motivo) errori.push('Scrivi il motivo, per esempio «assegnazione del consorzio di ottobre».');
  if (!giornoValido(comunicataIl)) errori.push('Indica il giorno della comunicazione.');
  if (errori.length) return nulla(errori);

  const righe = [{ cosa: 'Target annuo', prima_t: annuo, dopo_t: tre(annuo + t) }];
  const patch = { target_annuo_t: tre(annuo + t) };
  const prima = { target_annuo_t: commessa.target_annuo_t ?? null };
  const regione = regioni[iRegione];
  const primaRegione = Number(regione.target_t) || 0;
  righe.push({ cosa: regione.regione, prima_t: primaRegione, dopo_t: tre(primaRegione + t) });
  patch.regioni_json = JSON.stringify(regioni.map((r, i) => (i === iRegione ? { ...r, target_t: tre(primaRegione + t) } : r)));
  prima.regioni_json = commessa.regioni_json ?? null;
  // Il mese, solo se il contratto ha il target mensile rivisto: scrivere un mese
  // in un profilo vuoto ne farebbe tutto il profilo, e l'atteso dell'anno
  // cadrebbe intero in quel mese.
  if (profiloMensile(commessa).rivisto) {
    const scritti = lista(commessa.target_mensile_json);
    const dodici = Array.from({ length: 12 }, (_, i) => (scritti[i] === undefined ? null : scritti[i]));
    const primaMese = Number(dodici[meseIdx]) || 0;
    dodici[meseIdx] = tre(primaMese + t);
    righe.push({ cosa: `${NOMI_MESI[meseIdx]}, target mensile rivisto`, prima_t: primaMese, dopo_t: dodici[meseIdx] });
    patch.target_mensile_json = JSON.stringify(dodici);
    prima.target_mensile_json = commessa.target_mensile_json ?? null;
  } else {
    avvisi.push("Il contratto non ha il target mensile rivisto: la variazione va nel target annuo e nella regione; nell'atteso conta nel suo mese, il resto del contratto in dodicesimi.");
  }
  if (iDest >= 0) {
    const d = destinazioni[iDest];
    const primaDest = Number(d.target_t) || 0;
    righe.push({ cosa: `Destinazione ${d.destinazione}`, prima_t: primaDest, dopo_t: tre(primaDest + t) });
    patch.destinazioni_json = JSON.stringify(destinazioni.map((x, i) => (i === iDest ? { ...x, target_t: tre(primaDest + t) } : x)));
    prima.destinazioni_json = commessa.destinazioni_json ?? null;
  }
  const sottoZero = righe.filter(r => r.dopo_t < 0).map(r => r.cosa);
  if (sottoZero.length) return nulla([`Con questa variazione andrebbe sotto zero: ${sottoZero.join(', ')}.`]);
  // Come ogni salvataggio dopo la copia, la voce nello storico conferma il contratto (daConfermare).
  if (daConfermare(commessa)) avvisi.push("Il contratto è copiato dall'anno prima e non è ancora confermato: registrando la variazione lo confermi.");
  const voce = { mese_idx: meseIdx, regione: regione.regione, t: tre(t), destinazione: iDest >= 0 ? destinazioni[iDest].destinazione : '', motivo, comunicata_il: comunicataIl };
  return { errori: [], avvisi, patch, prima, righe, voce };
}

/** Lo storico della commessa con la variazione in coda: { il, da, nota, prima, variazione }. */
export function storicoConVariazione(storicoJson, { il, da = '', voce, prima = null }) {
  const storico = lista(storicoJson);
  storico.push({ il, da, nota: voce.motivo, prima, variazione: voce });
  return JSON.stringify(storico);
}

/**
 * Le variazioni in vigore che un salvataggio della tabella del contratto
 * toglierebbe dai numeri (revisione del 14/10/2026): valori sono i campi che il
 * salvataggio scrive. Si prova il salvataggio sullo storico, con la stessa
 * regola di variazioniDelContratto, cosi' la scheda lo dice prima di salvare.
 */
export function variazioniCheSiChiudono(commessa, valori) {
  if (!commessa || !valori) return [];
  const oggi = variazioniDelContratto(commessa);
  if (!oggi.some(v => v.in_vigore)) return [];
  const prima = Object.fromEntries(Object.keys(valori).filter(k => k !== 'anno').map(k => [k, commessa[k] ?? null]));
  const storico = JSON.stringify([...lista(commessa.storico_json), { il: '9999-12-31T23:59:59.999Z', da: '', nota: '', prima }]);
  const dopo = variazioniDelContratto({ ...commessa, ...valori, storico_json: storico });
  return oggi.filter((v, i) => v.in_vigore && dopo[i] && !dopo[i].in_vigore);
}

// IL CONTRATTO CHE SI COPIA NELL'ANNO DOPO (decisione dell'utente del
// 14/10/2026). Una variazione del consorzio e' di un mese di quell'anno: le
// 100 t in piu' di ottobre 2026 in Puglia sono l'assegnazione di quell'ottobre,
// non un pezzo del contratto. La copia dell'anno (pianoCopiaAnno di
// annoTarget.ts) portava nel 2027 i numeri variati (11.650 t, Puglia 2.600,
// ottobre 1.200, IRIGOM 4.550) col solo «copiato dal 2026, da confermare»: la
// voce della variazione restava nello storico del 2026, i suoi numeri passavano
// nel 2027, e confermando il 2027 si confermava senza saperlo anche
// un'assegnazione di un ottobre passato. Ora si copia il contratto di oggi meno
// ogni variazione in vigore, e una nota le elenca: se il consorzio le conferma
// anche per l'anno nuovo, si registrano come variazione di quell'anno. Le
// superate non si tolgono, perche' non sono piu' nei numeri. Il target mensile
// iniziale, i budget, le classi e la previsione ACI nessuna variazione li tocca,
// e si copiano come sono.
//
// Tre ritocchi dopo la revisione dello stesso giorno:
// - una variazione si toglie da una riga sola, la prima della sua regione e
//   della sua destinazione, cioe' quella dove variazioneDelContratto l'ha
//   scritta: con due righe IRIGOM (4.100 e 450) la copia toglieva 100 t da
//   tutte e due, 200 t per una variazione di 100;
// - la destinazione non decide se una variazione e' in vigore (lo decidono la
//   regione e il mese). Se dopo la variazione la destinazione e' stata
//   riscritta, per esempio le 100 t spostate da IRIGOM a T_CYCLE, toglierle di
//   nuovo da IRIGOM faceva un numero che nessuno aveva scritto (4.350): ora la
//   destinazione si segue nello storico come la regione, le destinazioni
//   riscritte si copiano come sono e la nota lo dice. Allo stesso modo una
//   variazione superata da un salvataggio del solo mese lascia le sue
//   tonnellate nell'annuo e nella regione: si copia com'e' scritta, perche' le
//   superate non si tolgono, ma la nota lo dice;
// - i target dei raccoglitori si copiano come sono (pianoCopiaAnno). Se la
//   variazione era anche nei raccoglitori, il 2027 nasce col contratto senza le
//   100 t e i raccoglitori con: il cruscotto dice subito «I raccoglitori della
//   Puglia hanno 100,00 t più del contratto 2027». La nota lo dice prima, coi
//   numeri, a chi conferma la copia.

// Le tonnellate all'italiana nelle note: due decimali, tre se i chili non sono tondi.
const tonnellateIt = (v) => {
  const n = tre(v);
  const [intero, decimali] = Math.abs(n).toFixed(3).split('.');
  return `${n < 0 ? '-' : ''}${intero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${decimali.endsWith('0') ? decimali.slice(0, 2) : decimali}`;
};
const conSegnoIt = (t) => `${Number(t) > 0 ? '+' : ''}${tonnellateIt(t)} t`;
const inPiuOMeno = (t) => `${tonnellateIt(Math.abs(Number(t) || 0))} t ${Number(t) > 0 ? 'in più' : 'in meno'}`;
// il giorno italiano di un istante dello storico, gg/mm/aaaa ('' se non c'e')
const giornoIt = (il) => { const g = giornoRoma(il); return g ? g.split('-').reverse().join('/') : ''; };
const nomeDest = (s) => String(s || '').trim().toLowerCase();
// la riga che una variazione scrive: la prima della sua regione o della sua destinazione (findIndex)
const rigaRegione = (righe, regione) => righe.findIndex(r => r && stessaRegione(r.regione, regione));
const rigaDestinazione = (righe, destinazione) => righe.findIndex(d => d && nomeDest(d.destinazione) === nomeDest(destinazione));

// Segue nello storico un numero scritto da una variazione (la voce j) fino al
// contratto di oggi, con la regola di variazioniDelContratto per la regione e il
// mese: finche' nessun salvataggio lo riscrive, porta la variazione (e quelle
// registrate dopo sullo stesso numero). riga trova la riga nell'elenco del
// campo; stessoNumero dice se un'altra variazione scrive lo stesso numero.
// null se la variazione non l'ha scritto; altrimenti { porta, il }, con il
// l'istante del salvataggio che l'ha riscritto ('' se lo storico non lo dice).
function numeroDellaVariazione(commessa, storico, j, campo, riga, stessoNumero) {
  const leggiRiga = (json) => { const righe = lista(json); const i = riga(righe); return i < 0 ? null : Number(righe[i].target_t) || 0; };
  const voce = storico[j];
  const p = voce && voce.prima && typeof voce.prima === 'object' ? voce.prima : null;
  const scritto = p && campo in p ? leggiRiga(p[campo]) : null;
  if (scritto === null) return null;
  let atteso = tre(scritto + (Number(voce.variazione.t) || 0));
  let ultima = null; // l'ultima voce dopo la variazione che ha scritto il campo
  const riscritto = () => ({ porta: false, il: ultima && !ultima.variazione ? String(ultima.il || '') : '' });
  for (let x = j + 1; x < storico.length; x++) {
    const s = storico[x];
    const px = s && s.prima && typeof s.prima === 'object' ? s.prima : null;
    if (!px || !(campo in px)) continue;
    if (diverso(leggiRiga(px[campo]), atteso)) return riscritto();
    const vx = s.variazione && typeof s.variazione === 'object' ? s.variazione : null;
    if (vx && stessoNumero(vx)) atteso = tre(atteso + (Number(vx.t) || 0));
    ultima = s;
  }
  return diverso(leggiRiga(commessa[campo]), atteso) ? riscritto() : { porta: true, il: '' };
}

/**
 * Il contratto da copiare nell'anno dopo: quello di oggi senza le variazioni
 * del consorzio in vigore. Restituisce { campi, variazioni, righe, raccoglitori,
 * parti, nota, motivo }:
 * - campi: i numeri senza le variazioni, solo quelli che cambiano (target
 *   annuo, regioni, target mensile rivisto, destinazioni). Ogni variazione si
 *   toglie dal target annuo e dalla prima riga della sua regione; dal mese solo
 *   se ci e' stata scritta (nel_mese); dalla prima riga della sua destinazione
 *   se la dice, il contratto la ha ancora e nessun salvataggio l'ha riscritta
 *   dopo (altrimenti le destinazioni restano come sono, e la nota lo dice). Al
 *   chilo come la variazione, mai sotto zero; un target annuo che manca resta
 *   mancante. Senza variazioni in vigore e' {}, e la copia e' quella di sempre;
 * - variazioni: quelle tolte [{ mese_idx, mese, regione, t, destinazione,
 *   motivo, comunicata_il, nel_mese }];
 * - righe: [{ cosa, con_t, senza_t }], per l'anteprima della copia;
 * - raccoglitori: le regioni dove i target annui dei raccoglitori dell'anno
 *   nuovo (raccoglitori, se chi chiama li passa: quelli che l'anno avra' dopo la
 *   copia) col contratto senza variazioni non fanno piu' la regione, e prima la
 *   facevano o ci andavano piu' vicino: [{ regione, raccoglitori_t,
 *   contratto_t, con_variazioni_t, differenza_t }];
 * - parti: le frasi della nota, una per cosa (le variazioni non copiate, le
 *   destinazioni riscritte, i raccoglitori, le superate che la regione porta
 *   ancora), per l'anteprima;
 * - nota: le parti in una frase sola, per lo storico del contratto copiato;
 * - motivo: le variazioni tolte in breve, per lo storico delle modifiche.
 * nota e motivo sono '' se non c'e' niente da dire o da togliere. annoNuovo e'
 * l'anno in cui si copia (se manca, quello dopo il contratto).
 */
export function contrattoSenzaVariazioni(commessa, annoNuovo = undefined, raccoglitori = undefined) {
  const vuoto = { campi: {}, variazioni: [], righe: [], raccoglitori: [], parti: [], nota: '', motivo: '' };
  if (!commessa) return vuoto;
  const storico = lista(commessa.storico_json);
  // la voce dello storico di ogni variazione, nell'ordine di variazioniDelContratto
  const posti = storico.map((s, j) => (s && typeof s === 'object' && s.variazione && typeof s.variazione === 'object' ? j : -1)).filter(j => j >= 0);
  const tutte = variazioniDelContratto(commessa).map((v, i) => ({ ...v, j: posti[i] }));
  const tolte = tutte.filter(v => v.in_vigore);

  const nuovo = Number(annoNuovo) || (Number(commessa.anno) ? Number(commessa.anno) + 1 : null);
  const vecchio = nuovo ? nuovo - 1 : null;
  const delVecchio = vecchio ? ` del ${vecchio}` : '';
  const delNuovo = nuovo ? ` ${nuovo}` : '';
  const perIlNuovo = nuovo ? ` per il ${nuovo}` : '';

  // le superate che la regione porta ancora: si copiano come sono, ma si dice
  const superate = [];
  for (const v of tutte) {
    if (v.in_vigore || v.j === undefined) continue;
    const n = numeroDellaVariazione(commessa, storico, v.j, 'regioni_json', (righe) => rigaRegione(righe, v.regione), (x) => stessaRegione(x.regione, v.regione));
    if (!n || !n.porta) continue;
    const quando = v.superata && giornoIt(v.superata.il) ? ` dal salvataggio del ${giornoIt(v.superata.il)}` : '';
    const motivoSuo = String(v.motivo || '').trim() ? `, «${String(v.motivo).trim()}»` : '';
    superate.push(`La variazione di ${String(v.mese || '').toLowerCase()} (${v.regione} ${conSegnoIt(v.t)}${motivoSuo}) è superata${quando} e il contratto si copia come è scritto, ma la regione ${v.regione} non è stata riscritta e porta ancora le sue ${inPiuOMeno(v.t)}. Se il consorzio non le conferma${perIlNuovo}, correggi il contratto copiato nella scheda Commessa Ecotyre.`);
  }
  if (!tolte.length && !superate.length) return vuoto;

  const togli = (x, vv) => Math.max(0, tre((Number(x) || 0) - vv.reduce((s, v) => s + (Number(v.t) || 0), 0)));
  const campi = {};
  const righe = [];
  const annuo = commessa.target_annuo_t;
  if (tolte.length && annuo !== null && annuo !== undefined && annuo !== '' && Number.isFinite(Number(annuo))) {
    campi.target_annuo_t = togli(annuo, tolte);
    righe.push({ cosa: 'Target annuo', con_t: Number(annuo), senza_t: campi.target_annuo_t });
  }
  // le regioni: ogni variazione dalla prima riga della sua regione
  const regioni = lista(commessa.regioni_json);
  const perRegione = new Map();
  for (const v of tolte) {
    const i = rigaRegione(regioni, v.regione);
    if (i >= 0) perRegione.set(i, [...(perRegione.get(i) || []), v]);
  }
  const senzaRegioni = regioni.map((r, i) => {
    const sue = perRegione.get(i);
    if (!sue) return r;
    const senza = togli(r.target_t, sue);
    righe.push({ cosa: r.regione, con_t: Number(r.target_t) || 0, senza_t: senza });
    return { ...r, target_t: senza };
  });
  if (perRegione.size) campi.regioni_json = JSON.stringify(senzaRegioni);
  // il mese solo per le variazioni che ci sono scritte: una registrata su un
  // contratto senza profilo e' solo nell'annuo e nella regione
  const nelMese = tolte.filter(v => v.nel_mese && meseValido(v));
  const mesi = lista(commessa.target_mensile_json).slice();
  const mesiToccati = [...new Set(nelMese.map(v => Number(v.mese_idx)))].filter(i => i < mesi.length).sort((a, b) => a - b);
  for (const i of mesiToccati) {
    const con = Number(mesi[i]) || 0;
    mesi[i] = togli(con, nelMese.filter(v => Number(v.mese_idx) === i));
    righe.push({ cosa: `${NOMI_MESI[i]}, target mensile rivisto`, con_t: con, senza_t: mesi[i] });
  }
  if (mesiToccati.length) campi.target_mensile_json = JSON.stringify(mesi);
  // le destinazioni: dalla prima riga della sua, se la porta ancora
  const destinazioni = lista(commessa.destinazioni_json);
  const perDestinazione = new Map();
  const riscritte = new Map();
  for (const v of tolte) {
    if (!nomeDest(v.destinazione)) continue;
    const i = rigaDestinazione(destinazioni, v.destinazione);
    if (i < 0) continue;
    const n = numeroDellaVariazione(commessa, storico, v.j, 'destinazioni_json', (righe) => rigaDestinazione(righe, v.destinazione), (x) => nomeDest(x.destinazione) === nomeDest(v.destinazione));
    if (!n) continue;
    if (n.porta) perDestinazione.set(i, [...(perDestinazione.get(i) || []), v]);
    else {
      const gia = riscritte.get(i) || { variazioni: [], il: '' };
      riscritte.set(i, { variazioni: [...gia.variazioni, v], il: n.il || gia.il });
    }
  }
  const senzaDestinazioni = destinazioni.map((d, i) => {
    const sue = perDestinazione.get(i);
    if (!sue) return d;
    const senza = togli(d.target_t, sue);
    righe.push({ cosa: `Destinazione ${d.destinazione}`, con_t: Number(d.target_t) || 0, senza_t: senza });
    return { ...d, target_t: senza };
  });
  if (perDestinazione.size) campi.destinazioni_json = JSON.stringify(senzaDestinazioni);

  // i raccoglitori dell'anno nuovo, regione per regione, come li confronta il cruscotto
  const fuori = [];
  const ilNuovo = Array.isArray(raccoglitori) ? raccoglitori.filter(Boolean) : [];
  if (ilNuovo.length) {
    for (const i of [...perRegione.keys()].sort((a, b) => a - b)) {
      const reg = regioni[i].regione;
      const con = Number(regioni[i].target_t) || 0;
      const senza = senzaRegioni[i].target_t;
      const loro = tre(ilNuovo.filter(x => stessaRegione(x.regione, reg)).reduce((s, x) => s + (Number(x.target_tonnellate) || 0), 0));
      const scarto = Math.abs(loro - senza);
      if (scarto >= SOGLIA_VARIAZIONE_T && scarto > Math.abs(loro - con) + MEZZO_CHILO) {
        fuori.push({ regione: reg, raccoglitori_t: loro, contratto_t: senza, con_variazioni_t: con, differenza_t: tre(loro - senza) });
      }
    }
  }

  const giorno = (g) => (giornoValido(g) ? String(g).split('-').reverse().join('/') : '');
  // senza parentesi: il motivo scritto dall'utente le ha spesso gia' («... (+100 t)»)
  const voce = (v) => [
    `${String(v.mese || '').toLowerCase()}, ${v.regione} ${conSegnoIt(v.t)}`,
    v.destinazione ? `destinazione ${v.destinazione}` : '',
    String(v.motivo || '').trim() ? `«${String(v.motivo).trim()}»` : '',
    giorno(v.comunicata_il) ? `comunicata il ${giorno(v.comunicata_il)}` : '',
  ].filter(Boolean).join(', ');
  const breve = (v) => `${String(v.mese || '').toLowerCase()}, ${v.regione} ${conSegnoIt(v.t)}`;
  const una = tolte.length === 1;
  const perIl = vecchio ? `per il ${vecchio}` : "per l'anno del contratto";
  const nelNuovo = nuovo ? ` anche per il ${nuovo}` : " anche per l'anno nuovo";
  const parti = [];
  if (tolte.length) {
    parti.push(una
      ? `La variazione del consorzio${delVecchio} non è copiata, perché valeva ${perIl}: ${voce(tolte[0])}. Se il consorzio la conferma${nelNuovo}, registrala come variazione${nuovo ? ` del ${nuovo}` : ''} nella scheda Commessa Ecotyre.`
      : `Le ${tolte.length} variazioni del consorzio${delVecchio} non sono copiate, perché valevano ${perIl}: ${tolte.map(voce).join('; ')}. Se il consorzio le conferma${nelNuovo}, registrale come variazioni${nuovo ? ` del ${nuovo}` : ''} nella scheda Commessa Ecotyre.`);
  }
  for (const [i, r] of [...riscritte].sort((a, b) => a[0] - b[0])) {
    const somma = tre(r.variazioni.reduce((s, v) => s + (Number(v.t) || 0), 0));
    const quando = giornoIt(r.il) ? ` (salvataggio del ${giornoIt(r.il)})` : '';
    parti.push(r.variazioni.length === 1
      ? `La destinazione ${destinazioni[i].destinazione} è stata riscritta dopo la variazione${quando}, quindi la variazione (${conSegnoIt(somma)}) non si toglie dalle destinazioni, che si copiano come sono scritte: controllale nella scheda Commessa Ecotyre.`
      : `La destinazione ${destinazioni[i].destinazione} è stata riscritta dopo le variazioni${quando}, quindi le ${r.variazioni.length} variazioni (${conSegnoIt(somma)} in tutto) non si tolgono dalle destinazioni, che si copiano come sono scritte: controllale nella scheda Commessa Ecotyre.`);
  }
  if (fuori.length) {
    const laVariazione = una ? 'la variazione' : 'le variazioni';
    const piuMeno = (d) => `${tonnellateIt(Math.abs(d))} t ${d > 0 ? 'più' : 'meno'}`;
    parti.push(fuori.length === 1
      ? `I target dei raccoglitori si copiano come sono, e quelli della ${fuori[0].regione} fanno ${tonnellateIt(fuori[0].raccoglitori_t)} t: ${piuMeno(fuori[0].differenza_t)} del contratto${delNuovo} copiato (${tonnellateIt(fuori[0].contratto_t)} t). Se il consorzio non conferma ${laVariazione}${perIlNuovo}, correggili nella scheda Target raccoglitori; se ${una ? 'la' : 'le'} conferma, ${una ? 'registrandola' : 'registrandole'} tornano a fare il contratto.`
      : `I target dei raccoglitori si copiano come sono, e non fanno il contratto${delNuovo} copiato: ${fuori.map(f => `${f.regione} ${tonnellateIt(f.raccoglitori_t)} t contro ${tonnellateIt(f.contratto_t)} t (${conSegnoIt(f.differenza_t)})`).join('; ')}. Se il consorzio non conferma ${laVariazione}${perIlNuovo}, correggili nella scheda Target raccoglitori; se ${una ? 'la' : 'le'} conferma, ${una ? 'registrandola' : 'registrandole'} tornano a fare il contratto.`);
  }
  parti.push(...superate);
  const motivo = tolte.length ? `senza ${una ? 'la variazione' : `le ${tolte.length} variazioni`} del consorzio${delVecchio} (${tolte.map(breve).join('; ')})` : '';
  const variazioni = tolte.map(v => ({
    mese_idx: Number(v.mese_idx), mese: v.mese || '', regione: v.regione || '', t: tre(v.t),
    destinazione: v.destinazione || '', motivo: v.motivo || '', comunicata_il: v.comunicata_il || '', nel_mese: !!v.nel_mese,
  }));
  return { campi, variazioni, righe, raccoglitori: fuori, parti, nota: parti.join(' '), motivo };
}

const valoreTarget = (x) => (x && !x.non_raccoglie ? Number(x.target) || 0 : 0);

// I cambi dei target mensili dei raccoglitori di una regione dopo un momento,
// letti dallo storico di ogni record (storico_json: chi lo scrive mette in ogni
// voce il valore di prima; quello di dopo e' la voce seguente o il valore di
// oggi). Un cambio del solo impianto vale zero e non conta.
function cambiDeiMensili(mensili, regione, dal) {
  const cambi = [];
  for (const m of mensili || []) {
    if (!m || !stessaRegione(m.regione, regione)) continue;
    const meseIdx = NOMI_MESI.findIndex(n => n.toLowerCase() === String(m.mese || '').trim().toLowerCase());
    if (meseIdx < 0) continue;
    const voci = lista(m.storico_json).filter(s => s && s.il);
    voci.forEach((s, k) => {
      if (dal && String(s.il) <= dal) return;
      const primaT = s.prima ? valoreTarget(s.prima) : 0;
      const dopoT = k + 1 < voci.length ? valoreTarget(voci[k + 1].prima) : valoreTarget(m);
      if (Math.abs(dopoT - primaT) < SOGLIA_VARIAZIONE_T) return;
      cambi.push({ il: String(s.il), mese_idx: meseIdx, raccoglitore: m.raccoglitore || '', impianto: m.impianto || '', prima_t: s.prima ? primaT : null, dopo_t: dopoT, delta_t: tre(dopoT - primaT) });
    });
  }
  return cambi.sort((a, b) => a.il.localeCompare(b.il));
}

// Il mese da proporre per una differenza fra raccoglitori e contratto, «se si
// capisce» (richiesta del 14/10/2026): il cambio piu' recente di un target
// mensile della regione che vale proprio la differenza; altrimenti l'unico mese
// i cui cambi la sommano. Si guardano i cambi dopo l'ultima variazione in
// vigore registrata per quella regione, o dopo l'inserimento del contratto: una
// variazione superata non e' piu' nei numeri, e il cambio che spiegava torna a
// proporsi. null se non si capisce: il mese lo sceglie l'amministratore.
function propostaDelMese(commessa, mensili, regione, differenza) {
  const registrate = variazioniDelContratto(commessa).filter(x => x.in_vigore && stessaRegione(x.regione, regione));
  const inserito = lista(commessa && commessa.storico_json).map(s => s && s.il).filter(Boolean)[0] || '';
  const dal = registrate.length ? registrate[registrate.length - 1].il : inserito;
  const cambi = cambiDeiMensili(mensili, regione, dal);
  const uguale = (x) => Math.abs(x - differenza) < SOGLIA_VARIAZIONE_T;
  const esatto = cambi.filter(c => uguale(c.delta_t)).pop();
  if (esatto) return { mese_idx: esatto.mese_idx, mese: NOMI_MESI[esatto.mese_idx], cambi: [esatto], destinazione: destinazioneDelContratto(commessa, esatto.impianto) };
  const perMese = new Map();
  for (const c of cambi) perMese.set(c.mese_idx, [...(perMese.get(c.mese_idx) || []), c]);
  const mesi = [...perMese].filter(([, cs]) => uguale(cs.reduce((s, c) => s + c.delta_t, 0)));
  if (mesi.length !== 1) return null;
  const [meseIdx, cs] = mesi[0];
  const destinazioni = [...new Set(cs.map(c => destinazioneDelContratto(commessa, c.impianto)))];
  return { mese_idx: meseIdx, mese: NOMI_MESI[meseIdx], cambi: cs, destinazione: destinazioni.length === 1 ? destinazioni[0] : '' };
}

/**
 * Le regioni dove la somma dei target annui dei raccoglitori non fa il
 * contratto: [{ regione, contratto_t, raccoglitori_t, differenza_t, proposta }].
 * differenza_t e' raccoglitori meno contratto (positiva: i raccoglitori hanno di
 * piu'); proposta e' { mese_idx, mese, cambi, destinazione } o null (vedi
 * propostaDelMese). perRegione: [{ regione, annuo, contratto }], come la tabella
 * per regione della scheda dei raccoglitori; senza contratto una regione non si
 * confronta, e sotto mezza tonnellata la differenza e' un arrotondamento.
 */
export function scartiDalContratto(commessa, perRegione, mensili) {
  return (perRegione || [])
    .filter(r => r && r.contratto !== null && r.contratto !== undefined && Number.isFinite(Number(r.contratto))
      && Math.abs((Number(r.annuo) || 0) - Number(r.contratto)) >= SOGLIA_VARIAZIONE_T)
    .map(r => {
      const differenza = tre((Number(r.annuo) || 0) - Number(r.contratto));
      return { regione: r.regione, contratto_t: Number(r.contratto), raccoglitori_t: Number(r.annuo) || 0, differenza_t: differenza, proposta: propostaDelMese(commessa, mensili, r.regione, differenza) };
    });
}
