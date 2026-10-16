// LA SIMULAZIONE DEL MARGINE COL COSTO DI SMOCO RACCOGLITORE (16/10/2026).
//
// Richiesta dell'utente del 16/10/2026: simulare il margine della commessa al
// variare dell'unico valore che il gestionale non ha, il costo €/t di SMOCO come
// raccoglitore. Lo valuta un altro ufficio, coi costi diretti e indiretti, e
// l'utente lo scrive a mano, canale per canale (o uno solo per tutti), anche
// per mostrarlo al CEO di SMOCO. SMOCO e' un fornitore interno: a se stessi non
// si fattura, e nel margine vero le tonnellate che raccoglie coi suoi mezzi
// costano zero. La simulazione dice quanto sarebbe il margine se costassero il
// valore scritto, mese per mese e per l'anno, il costo di pareggio e il
// confronto coi raccoglitori esterni dello stesso canale e periodo.
//
// LA REGOLA STA SOLO QUI, NEL BROWSER, E NON HA COPIA NEL SERVER. La simulazione
// non deve entrare in nessun conto: fatturazione, margine vero, dashboard,
// alert, EcoTyna, riepilogo della settimana. Una copia dalla parte del server
// sarebbe il primo passo perche' uno di quei conti la usi, e qui non c'e'
// niente da specchiare. Non si salva negli archivi del gestionale: il browser
// ricorda solo l'ultimo valore scritto (CHIAVE_MEMORIA_SIMULAZIONE), ogni
// lettura e scrittura dentro try/catch, e la pagina funziona anche senza.
// Questo file non parla col server: niente client, niente richieste. I numeri
// veri che servono (le tonnellate di SMOCO, la media degli esterni) li fa il
// calcolo del margine nel campo `raccolta` di ogni mese e dell'anno, e arrivano
// con la risposta che la scheda Margine ha gia'.
//
// Tre canali, tre simulazioni: nessun campo somma Rete, ACI ed Extra raccolta.
// Un margine vero «—» (prezzi mancanti) resta «—» anche simulato, col perche':
// un valore mancante non e' zero.
//
// Le frasi finiscono anche nel PDF per il CEO: numeri all'italiana e solo i
// caratteri della codifica dei font standard (il meno e' «-», mai il segno
// tipografico U+2212, che fa scrivere a jspdf tutta la cella in due byte).
import { formatNumber, formatTonnellate, formatPercentuale } from '@/lib/utils';

export const CANALI_SIMULAZIONE = ['RETE', 'ACI', 'EXTRA_RACCOLTA'];
export const NOMI_SIMULAZIONE = { RETE: 'Rete', ACI: 'ACI', EXTRA_RACCOLTA: 'Extra raccolta' };
export const FRASE_SIMULAZIONE = 'Simulazione: il costo €/t di SMOCO come raccoglitore è scritto a mano; il risultato non si salva e non entra nella fatturazione, nel margine vero né in nessun altro conto del gestionale.';
export const CHIAVE_MEMORIA_SIMULAZIONE = 'eco_simulazione_margine';

const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
const pct1 = (v, su) => Math.round((v / su) * 1000) / 10;
const numero = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
// Il parametro di un canale: un numero non negativo al centesimo, o null.
const parametro = (v) => {
  const n = numero(v);
  if (n === null || n < 0) return null;
  const c = r2(n);
  return c === 0 ? 0 : c;
};

const ERRORE_NEGATIVO = 'Un costo non può essere negativo.';
const ERRORE_NUMERO = 'Scrivi un numero di euro per tonnellata, per esempio 62,50.';
// Senza il campo raccolta (una risposta del calcolo di prima) la simulazione non
// si fa: le tonnellate di SMOCO mancano, e non sono zero.
const FRASE_SENZA_RACCOLTA = 'il calcolo del margine non porta le tonnellate raccolte da SMOCO: ricarica la pagina';

/** Gli euro all'italiana, due decimali: '412.967,03'; '—' se il valore manca. */
export function scriviEuro(v) {
  const n = numero(v);
  return n === null ? '—' : formatNumber(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Gli euro per tonnellata: '60,00 €/t'; '—' se il valore manca. */
export function scriviEuroT(v) {
  const n = numero(v);
  return n === null ? '—' : `${scriviEuro(n)} €/t`;
}

const scriviT = (v) => `${formatTonnellate(Number(v) || 0)} t`;
const scriviPct = (v) => (numero(v) === null ? '—' : `${formatPercentuale(v)}%`);

/**
 * Il costo scritto a mano: un numero, o un testo all'italiana con o senza «€» e
 * «€/t» ('60', '60,5', '1.234,56'). Senza virgola un punto seguito da tre cifre
 * e' delle migliaia ('1.234' fa 1234), seguito da una o due e' il decimale
 * ('60.5'): chi scrive dal tastierino lo mette cosi'. Si arrotonda al centesimo.
 * Vuoto: nessun valore e nessun errore (il canale non si simula).
 */
export function leggiEuroT(testo) {
  if (testo === null || testo === undefined) return { valore: null, errore: '' };
  if (typeof testo === 'number') {
    if (!Number.isFinite(testo)) return { valore: null, errore: ERRORE_NUMERO };
    if (testo < 0) return { valore: null, errore: ERRORE_NEGATIVO };
    return { valore: parametro(testo), errore: '' };
  }
  let s = String(testo).trim();
  if (!s) return { valore: null, errore: '' };
  s = s.replace(/\s+/g, '')
    .replace(/\/(t|ton|tonn|tonnellata|tonnellate)\.?$/i, '')
    .replace(/€/g, '')
    .replace(/(eur|euro|euri)$/i, '')
    .replace(/^(eur|euro)/i, '');
  if (!s) return { valore: null, errore: ERRORE_NUMERO };
  let negativo = false;
  if (/^[+\-−]/.test(s)) { negativo = s[0] !== '+'; s = s.slice(1); }
  let normale = null;
  if (/^\d+$/.test(s)) normale = s;
  else if (/^\d+,\d+$/.test(s)) normale = s.replace(',', '.');
  else if (/^[1-9]\d{0,2}(\.\d{3})+(,\d+)?$/.test(s)) normale = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d+\.\d{1,2}$/.test(s)) normale = s;
  if (normale === null) return { valore: null, errore: ERRORE_NUMERO };
  const n = Number(normale);
  if (!Number.isFinite(n)) return { valore: null, errore: ERRORE_NUMERO };
  if (negativo && n > 0) return { valore: null, errore: ERRORE_NEGATIVO };
  return { valore: parametro(n), errore: '' };
}

/** I campi della sezione, vuoti: un valore unico per i tre canali. */
export function valoriIniziali() {
  return { uguali: true, unico: '', RETE: '', ACI: '', EXTRA_RACCOLTA: '' };
}

// Solo la forma di valoriIniziali, solo testi brevi: da una memoria del browser
// puo' arrivare di tutto (un'altra versione, un valore scritto a mano).
const testoBreve = (v) => (typeof v === 'string' ? v.slice(0, 40) : '');
function formaDeiValori(x) {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return valoriIniziali();
  return {
    uguali: x.uguali !== false,
    unico: testoBreve(x.unico),
    RETE: testoBreve(x.RETE), ACI: testoBreve(x.ACI), EXTRA_RACCOLTA: testoBreve(x.EXTRA_RACCOLTA),
  };
}

/** I parametri dei tre canali dai campi della sezione, con l'errore di ciascuno. */
export function parametriDaValori(valori) {
  const v = formaDeiValori(valori);
  const parametri = {}, errori = {};
  for (const c of CANALI_SIMULAZIONE) {
    const l = leggiEuroT(v.uguali ? v.unico : v[c]);
    parametri[c] = l.valore;
    errori[c] = l.errore;
  }
  return { parametri, errori };
}

// LA MEMORIA DEL BROWSER (16/10/2026). Ricorda solo l'ultimo valore scritto, per
// chi riapre la scheda; non e' un archivio e non la legge nessun altro. In una
// finestra privata, coi dati del sito bloccati o in un'anteprima, anche solo
// guardare localStorage puo' lanciare: per questo la memoria si cerca dentro il
// try (un valore di default nella firma lancerebbe prima), e senza memoria si
// torna ai campi vuoti, senza errori.
/** L'ultimo valore scritto, o i campi vuoti. Non lancia mai. */
export function leggiMemoriaSimulazione(memoria) {
  try {
    const m = memoria === undefined ? globalThis.localStorage : memoria;
    if (!m || typeof m.getItem !== 'function') return valoriIniziali();
    const testo = m.getItem(CHIAVE_MEMORIA_SIMULAZIONE);
    if (!testo) return valoriIniziali();
    return formaDeiValori(JSON.parse(testo));
  } catch {
    return valoriIniziali();
  }
}

/** Ricorda i campi della sezione: true se ci riesce. Non lancia mai. */
export function scriviMemoriaSimulazione(valori, memoria) {
  try {
    const m = memoria === undefined ? globalThis.localStorage : memoria;
    if (!m || typeof m.setItem !== 'function') return false;
    m.setItem(CHIAVE_MEMORIA_SIMULAZIONE, JSON.stringify(formaDeiValori(valori)));
    return true;
  } catch {
    return false;
  }
}

// Il costo simulato di un insieme di mesi: ogni mese arrotondato al centesimo e
// poi la somma, come la colonna dei costi del margine. null se un mese non ha
// le tonnellate di SMOCO (risposta senza raccolta) o senza parametro.
function costoDeiMesi(mesi, euroT) {
  if (euroT === null) return null;
  let s = 0;
  for (const x of mesi || []) {
    if (!x || !x.raccolta) return null;
    s += r2((Number(x.raccolta.tonnellate_interni) || 0) * euroT);
  }
  return r2(s);
}

// Un mese o l'anno, simulato. Il costo dell'anno e' la somma dei mesi.
function periodo(x, costo) {
  const r = x.raccolta || null;
  const margineVero = numero(x.margine);
  const ms = margineVero === null || costo === null ? null : r2(margineVero - costo);
  const ricavo = Number(x.ricavo) || 0, tonnellate = Number(x.tonnellate) || 0;
  return {
    mese: x.mese,
    tonnellate: x.tonnellate,
    ricavo: x.ricavo,
    tonnellate_smoco: r ? r.tonnellate_interni : null,
    costo_simulato: costo,
    margine_vero: margineVero,
    margine_vero_pct: numero(x.margine_pct),
    margine_simulato: ms,
    margine_simulato_pct: ms !== null && ricavo ? pct1(ms, ricavo) : null,
    margine_simulato_t: ms !== null && tonnellate ? r2(ms / tonnellate) : null,
    euro_t_esterni: r ? r.euro_t_esterni : null,
    tonnellate_esterni: r ? r.tonnellate_esterni : null,
    perche: margineVero === null ? (x.testo_prezzi_mancanti || 'margine non calcolabile') : (!r ? FRASE_SENZA_RACCOLTA : ''),
  };
}

/**
 * IL COSTO DI PAREGGIO: il piu' alto valore al centesimo p per cui il margine
 * simulato dell'anno, anno.margine - la somma dei mesi r2(t x p), non va sotto
 * zero. Si parte da floor(margine / t x 100) / 100 e ci si sposta di un
 * centesimo: l'arrotondamento dei mesi sposta solo qualche centesimo
 * (sull'extra raccolta del 2026 il floor dice 118,08 ma anche 118,09 fa 0,00),
 * quindi bastano cento passi per verso. Non dipende dal parametro.
 */
function pareggioDi(c) {
  const a = c.anno || {};
  const r = a.raccolta;
  if (!r || (c.mesi || []).some(x => !x.raccolta)) return { euro_t: null, testo: `Pareggio non calcolabile: ${FRASE_SENZA_RACCOLTA}.` };
  const margine = numero(a.margine);
  if (margine === null) return { euro_t: null, testo: `Pareggio non calcolabile: ${a.testo_prezzi_mancanti || 'margine non calcolabile'}.` };
  const t = Number(r.tonnellate_interni) || 0;
  if (!(t > 0)) return { euro_t: null, testo: 'Pareggio non calcolabile: SMOCO non ha raccolto in questo canale nel periodo, e il suo costo non sposta il margine.' };
  if (!(margine > 0)) return { euro_t: null, testo: `Pareggio non calcolabile: il margine vero è già ${scriviEuro(margine)} €, e nessun costo lo tiene in pari.` };
  const resta = (k) => r2(margine - costoDeiMesi(c.mesi, k / 100));
  let k = Math.floor((margine / t) * 100);
  for (let i = 0; i < 100 && resta(k + 1) >= 0; i++) k++;
  for (let i = 0; i < 100 && resta(k) < 0; i++) k--;
  const p = k / 100;
  return { euro_t: p, testo: `Pareggio a ${scriviEuroT(p)}: a quel costo il margine simulato dell'anno resta ${scriviEuro(resta(k))} €, con un centesimo in più va sotto zero.` };
}

// IL CONFRONTO CON I RACCOGLITORI ESTERNI, sull'anno: la media e' sulle tariffe
// di contratto delle righe paragonabili dello stesso canale e periodo (il campo
// raccolta del margine: fuori il prezzo unico, le righe senza prezzo e il
// surplus). Dice se a quel costo conviene raccogliere da se' o affidare.
// Il risparmio (differenza_affidando) e' il costo alla media meno il costo
// scritto, tutti e due mese per mese come la colonna dei costi: cosi' e' al
// centesimo il margine simulato meno il margine alla media, che lo stesso
// documento scrive (chiusura del giro del 16/10/2026: con (media - costo) x t
// sull'anno l'ACI a 60 €/t diceva 2.895,63 € e i due margini 2.895,61).
function confrontoDi(c, euroT) {
  const a = c.anno || {};
  const r = a.raccolta || null;
  const media = r ? numero(r.euro_t_esterni) : null;
  const tEst = r ? r.tonnellate_esterni : null;
  const tSmoco = r ? Number(r.tonnellate_interni) || 0 : 0;
  const margine = numero(a.margine);
  const costoAllaMedia = media === null ? null : costoDeiMesi(c.mesi, media);
  const margine_alla_media = margine === null || costoAllaMedia === null ? null : r2(margine - costoAllaMedia);
  const scarto_euro_t = euroT === null || media === null ? null : r2(euroT - media);
  const costoScritto = euroT === null ? null : costoDeiMesi(c.mesi, euroT);
  const differenza_affidando = costoScritto === null || costoAllaMedia === null ? null : r2(costoAllaMedia - costoScritto);
  const esito = scarto_euro_t === null ? null : scarto_euro_t <= -0.005 ? 'smoco' : scarto_euro_t >= 0.005 ? 'esterni' : 'pari';
  let testo;
  if (!r) testo = `Confronto non disponibile: ${FRASE_SENZA_RACCOLTA}.`;
  else if (media === null) testo = 'Nessun raccoglitore esterno con un prezzo paragonabile in questo canale nel periodo: il confronto non si fa.';
  else {
    const base = `I raccoglitori esterni costano in media ${scriviEuroT(media)} su ${scriviT(tEst)}`;
    const allaMedia = margine_alla_media === null ? '' : `; se SMOCO costasse la media il margine dell'anno sarebbe ${scriviEuro(margine_alla_media)} € (${scriviPct(Number(a.ricavo) ? pct1(margine_alla_media, Number(a.ricavo)) : null)} del ricavo)`;
    if (esito === null) testo = `${base}${allaMedia}. Scrivi il costo di SMOCO per il confronto.`;
    else if (!(tSmoco > 0)) testo = `${base}${allaMedia}. SMOCO non ha raccolto in questo canale nel periodo: il confronto è solo sul prezzo.`;
    else if (esito === 'smoco') testo = `${base}: a ${scriviEuroT(euroT)} SMOCO costa ${scriviEuroT(-scarto_euro_t)} in meno, e raccogliere da sé fa risparmiare ${scriviEuro(differenza_affidando)} € sulle ${scriviT(tSmoco)} di SMOCO${allaMedia}.`;
    else if (esito === 'esterni') testo = `${base}: a ${scriviEuroT(euroT)} SMOCO costa ${scriviEuroT(scarto_euro_t)} in più, e affidare le ${scriviT(tSmoco)} di SMOCO agli esterni alla loro media farebbe risparmiare ${scriviEuro(-differenza_affidando)} €${allaMedia}.`;
    else testo = `${base}: a ${scriviEuroT(euroT)} SMOCO costa quanto la media${allaMedia}.`;
  }
  return { euro_t_esterni: media, tonnellate_esterni: tEst, scarto_euro_t, differenza_affidando, margine_alla_media, esito, testo };
}

// Le note di un canale, una frase per caso: cosa la simulazione comprende,
// cosa resta fuori dal confronto e cosa costa zero senza essere simulato.
function noteDi(c) {
  const a = c.anno || {};
  const r = a.raccolta;
  const mesi = c.mesi || [];
  const note = [];
  if (!r) return [`La simulazione non si può fare: ${FRASE_SENZA_RACCOLTA}.`];
  for (const i of r.interni || []) {
    if (!(i.di_cui || []).length) continue;
    const chi = i.di_cui.map(d => `${scriviT(d.tonnellate)} di ${d.fornitore}`).join(', ');
    note.push(`Nelle ${scriviT(i.tonnellate)} di ${i.fornitore} ci sono ${chi}, che fattura tramite ${i.fornitore}: anche nella simulazione sono sue, e il costo scritto le comprende.`);
  }
  if (r.tonnellate_prezzo_unico > 0) note.push(`${scriviT(r.tonnellate_prezzo_unico)} dei raccoglitori esterni sono a prezzo unico (${scriviEuro(r.euro_prezzo_unico)} €): la tariffa comprende anche il trattamento, non è sola raccolta, e resta fuori dalla media.`);
  if (r.tonnellate_senza_prezzo > 0) note.push(`${scriviT(r.tonnellate_senza_prezzo)} dei raccoglitori esterni non hanno un prezzo e restano fuori dalla media: un valore mancante non è zero.`);
  if (r.surplus_esterni > 0) note.push(`Il surplus pagato ai raccoglitori esterni (${scriviEuro(r.surplus_esterni)} €) è fuori dalla media, che è sulle tariffe di contratto.`);
  if (Number(a.tonnellate_surplus_interni) > 0) note.push(`Sulle ${scriviT(a.tonnellate_surplus_interni)} di SMOCO Ecotyre paga anche il surplus, che resta nel ricavo: il costo da scrivere è quello pieno di SMOCO.`);
  const sec = r.secondarie_interni || {};
  if (sec.tonnellate > 0 || sec.viaggi > 0) {
    const viaggi = formatNumber(sec.viaggi || 0, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    note.push(`Anche ${sec.viaggi === 1 ? "l'unico viaggio" : `i ${viaggi} viaggi`} di secondarie che SMOCO fa coi suoi mezzi (${scriviT(sec.tonnellate)}) costano zero nel margine: la simulazione non li tocca.`);
  }
  if ((r.impianti_interni || {}).tonnellate > 0) note.push(`Anche le ${scriviT(r.impianti_interni.tonnellate)} stoccate o trattate da SMOCO costano zero nel margine: la simulazione non le tocca.`);
  if (mesi.length > 0 && mesi.length < 12) {
    const primo = String(mesi[0].mese || '').toLowerCase(), ultimo = String(mesi[mesi.length - 1].mese || '').toLowerCase();
    note.push(`L'anno è quello fin qui, ${mesi.length === 1 ? `solo ${primo}` : `${primo}–${ultimo}`}: i mesi che mancano non sono stimati.`);
  }
  if (numero(a.margine) === null) {
    const quali = mesi.filter(x => numero(x.margine) === null).map(x => String(x.mese || '').toLowerCase());
    note.push(`Il margine dell'anno non è calcolabile (${a.testo_prezzi_mancanti || 'prezzi mancanti'}): la simulazione dell'anno resta «—»${quali.length ? `, come quella di ${quali.join(', ')}` : ''}.`);
  }
  return note;
}

/**
 * Un canale simulato. c e' un elemento di canali della risposta del margine;
 * euroT il costo di SMOCO del canale (null: non scritto, e i costi e i margini
 * simulati sono null, mentre pareggio e media ci sono lo stesso).
 */
export function simulaCanale(c, euroT) {
  const v = parametro(euroT);
  const mesiDati = (c && c.mesi) || [];
  const annoDati = (c && c.anno) || { mese: 'Anno' };
  const mesi = mesiDati.map(x => periodo(x, v === null || !x.raccolta ? null : r2((Number(x.raccolta.tonnellate_interni) || 0) * v)));
  const anno = periodo(annoDati, annoDati.raccolta ? costoDeiMesi(mesiDati, v) : null);
  const r = annoDati.raccolta || null;
  return {
    canale: c && c.canale,
    nome: NOMI_SIMULAZIONE[c && c.canale] || String((c && c.canale) || ''),
    euro_t: v,
    mesi,
    anno,
    pareggio: pareggioDi({ mesi: mesiDati, anno: annoDati }),
    confronto: confrontoDi({ mesi: mesiDati, anno: annoDati }, v),
    esterni: r ? r.esterni || [] : [],
    interni: r ? r.interni || [] : [],
    note: noteDi({ mesi: mesiDati, anno: annoDati }),
  };
}

/**
 * La simulazione dei tre canali, dalla risposta del margine che la scheda ha
 * gia' e dai parametri { RETE, ACI, EXTRA_RACCOLTA }. Mai un totale dei canali.
 * null senza dati.
 */
export function simulaMargine(dati, parametri) {
  if (!dati || !Array.isArray(dati.canali)) return null;
  const p = {};
  for (const c of CANALI_SIMULAZIONE) p[c] = parametro(parametri && parametri[c]);
  const canali = CANALI_SIMULAZIONE.map(cod => simulaCanale(dati.canali.find(x => x && x.canale === cod) || { canale: cod, mesi: [], anno: { mese: 'Anno' } }, p[cod]));
  return { anno: dati.anno, calcolato_il: dati.calcolato_il || null, parametri: p, canali };
}

/**
 * Il margine dell'anno a costi diversi, per la tabella e il PDF: 0 €/t (nel
 * gestionale oggi), il valore scritto, la media degli esterni e il pareggio,
 * senza doppioni (un valore che coincide unisce le etichette), per €/t.
 */
export function margineACostiDiversi(c, euroT) {
  const a = (c && c.anno) || {};
  const mesi = (c && c.mesi) || [];
  if (!a.raccolta || mesi.some(x => !x.raccolta)) return [];
  const v = parametro(euroT);
  const media = numero(a.raccolta.euro_t_esterni);
  const pareggio = pareggioDi({ mesi, anno: a }).euro_t;
  const voci = [
    [0, 'nel gestionale oggi'],
    [v, 'il costo scritto'],
    [media, 'la media dei raccoglitori esterni'],
    [pareggio, 'il pareggio'],
  ].filter(([e]) => e !== null);
  const perCentesimi = new Map();
  for (const [e, etichetta] of voci) {
    const k = Math.round(e * 100);
    const x = perCentesimi.get(k);
    if (x) x.etichette.push(etichetta);
    else perCentesimi.set(k, { euro_t: k / 100, etichette: [etichetta] });
  }
  const margine = numero(a.margine), ricavo = Number(a.ricavo) || 0;
  return [...perCentesimi.values()].sort((x, y) => x.euro_t - y.euro_t).map(x => {
    const costo = costoDeiMesi(mesi, x.euro_t);
    const ms = margine === null || costo === null ? null : r2(margine - costo);
    return {
      euro_t: x.euro_t,
      etichetta: x.etichette.join(' · '),
      costo_simulato: costo,
      margine_simulato: ms,
      margine_simulato_pct: ms !== null && ricavo ? pct1(ms, ricavo) : null,
    };
  });
}

/** I parametri in una riga: '60,00 €/t per i tre canali' o canale per canale. */
export function testoParametri(parametri) {
  const p = CANALI_SIMULAZIONE.map(c => parametro(parametri && parametri[c]));
  if (p[0] !== null && p.every(x => x === p[0])) return `${scriviEuroT(p[0])} per i tre canali`;
  return CANALI_SIMULAZIONE.map((c, i) => `${NOMI_SIMULAZIONE[c]} ${scriviEuroT(p[i])}`).join(' · ');
}

/** Il periodo della simulazione: 'gennaio–ottobre 2026', 'gennaio 2026', '2026'. */
export function testoPeriodo(sim) {
  if (!sim) return '';
  const anno = sim.anno === undefined || sim.anno === null ? '' : String(sim.anno);
  const mesi = ((sim.canali || [])[0] || {}).mesi || [];
  if (!mesi.length || mesi.length >= 12) return anno;
  const primo = String(mesi[0].mese || '').toLowerCase();
  const ultimo = String(mesi[mesi.length - 1].mese || '').toLowerCase();
  return `${mesi.length === 1 ? primo : `${primo}–${ultimo}`} ${anno}`.trim();
}
